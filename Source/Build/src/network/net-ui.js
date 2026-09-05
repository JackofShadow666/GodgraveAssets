// === src/network/net-ui.js ===

const GAME_ID = 'HOV_GODGRAVE_UNIQUE_ID';

// ════════════════════════════════════════════════════════════════════════════
// ══ BLOCK 1: STORAGE ═══════════════════════════════════════════════════════
// localStorage — profile and contact book storage.
// Keys are tied to GAME_ID, not to URL/filename, so data
// survives HTML file version changes (as long as GAME_ID stays the same).
// ════════════════════════════════════════════════════════════════════════════
(function(){
  function lsSave(k,v){ try{ localStorage.setItem(GAME_ID+'_'+k,JSON.stringify(v)); }catch(e){} }
  function lsLoad(k){ try{ const v=localStorage.getItem(GAME_ID+'_'+k); return v?JSON.parse(v):null; }catch(e){ return null; } }

  // Migrate old data (saved without GAME_ID prefix) to the new schema.
  // Runs once: if the new key is still empty and the old key exists —
  // copy the value (old key is left untouched, in case of rollback).
  function migrate(){
    try{
      const oldKeys = ['gg_profile2','gg_book'];
      oldKeys.forEach(function(k){
        const newKey = GAME_ID+'_'+k;
        if(localStorage.getItem(newKey) == null){
          const old = localStorage.getItem(k);
          if(old != null){ localStorage.setItem(newKey, old); }
        }
      });
    }catch(e){}
  }

  window.LS = { save:lsSave, load:lsLoad, migrate:migrate };
  window.LS.migrate();
})();

// ── HTML escaping (XSS protection: names/IDs come from remote
//    peers over the network and should not be inserted into innerHTML "as is") ──
function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ════════════════════════════════════════════════════════════════════════════
// ══ BLOCK 2: PLAYER PROFILE ══════════════════════════════════════════════════
// Name, persistent ID, contact book
// ════════════════════════════════════════════════════════════════════════════
(function(){
  function mkFingerprintId(){
    const raw=[navigator.userAgent,screen.width+'x'+screen.height,screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,navigator.language,
      navigator.hardwareConcurrency].join('|');
    let h=0; for(let i=0;i<raw.length;i++) h=Math.imul(31,h)+raw.charCodeAt(i)|0;
    h=Math.abs(h);
    const L='ABCDEFGHJKLMNPQRSTUVWXYZ';
    return L[h%L.length]+L[(h>>5)%L.length]+L[(h>>10)%L.length]+String(100000+(h%90000)).slice(0,5);
  }

  var prof = LS.load('gg_profile2') || { name:'', id:'' };
  var book = LS.load('gg_book') || [];
  if(!prof.id){ prof.id=mkFingerprintId(); LS.save('gg_profile2',prof); }

  function saveProf(){ LS.save('gg_profile2',prof); }
  function saveBook(){ LS.save('gg_book',book); }

  window.PROFILE = {
    get name(){ return prof.name; },
    get id()  { return prof.id; },
    setName(n){ prof.name=n; saveProf(); },
    setId(id) { prof.id=id; saveProf(); },
    book,
    addContact(name,id){
      const ex=book.findIndex(c=>c.id===id);
      if(ex>=0) book[ex].name=name;
      else if(book.length<30) book.push({name,id});
      saveBook();
    },
    removeContact(i){ book.splice(i,1); saveBook(); },
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ BLOCK 3: UNIFIED MENU SYSTEM ═════════════════════════════════════════════
// openMenu(id) — closes all, opens the specified one, hides HUD
// ════════════════════════════════════════════════════════════════════════════
(function(){
  function openMenu(id){
    document.querySelectorAll('.game-overlay.open').forEach(el=>{ if(el.id!==id) el.classList.remove('open'); });
    const el=document.getElementById(id);
    if(!el) return;
    el.classList.add('open');
    document.body.classList.add('menu-open');
    // Don't pause game in PVP when opening chat
    if(typeof gamePaused!=='undefined'&&!(typeof NET_SYNC!=='undefined'&&$.NET.active())){
      gamePaused=true;
      uiMenuPaused=true;
    }
  }
  function closeMenu(id){
    const targets=id?[document.getElementById(id)]:document.querySelectorAll('.game-overlay.open');
    targets.forEach(el=>el?.classList.remove('open'));
    if(!document.querySelector('.game-overlay.open')){
      document.body.classList.remove('menu-open');
      // Don't unpause in PVP when closing menu
      if(typeof gamePaused!=='undefined'&&!(typeof NET_SYNC!=='undefined'&&$.NET.active())){
        gamePaused=false;
        uiMenuPaused=false;
      }
    }
  }
  window.openMenu=openMenu;
  window.closeMenu=closeMenu;
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ BLOCK 4: NAME INPUT OVERLAY ═════════════════════════════════════════════
// Shown once on first launch
// ════════════════════════════════════════════════════════════════════════════
(function(){
  const nameInput   = document.getElementById('name-input');
  const nameConfirm = document.getElementById('name-confirm');

  function applyNameToHUD(n){
    const el=document.getElementById('hud-player-name');
    if(el) el.textContent=n.toUpperCase();
  }

  function confirmName(){
    const n=(nameInput?.value||'').trim().slice(0,16);
    if(!n){ nameInput?.focus(); return; }
    PROFILE.setName(n);
    closeMenu('name-overlay');
    applyNameToHUD(n);
    updateNetUI();
  }

  nameConfirm?.addEventListener('click', confirmName);
  nameInput?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.stopPropagation(); confirmName(); } });

  // Apply saved name
  if(PROFILE.name) applyNameToHUD(PROFILE.name);
  else setTimeout(()=>{ nameInput.value=''; openMenu('name-overlay'); setTimeout(()=>nameInput?.focus(),80); },800);

  // ── Shield selection ──────────────────────────────────────────────────────
const SHIELD_INFO_TEXT = [
  'No shield',
  'Small — speed -6%',
  'Large — speed -18%',
  'Tower — speed -30%',
  'Spiked small — speed -12%, bash 8 damage',
  'Spiked medium — speed -24%, bash 12 damage',
  'Spiked large — speed -36%, bash 18 damage',
];
  window.pickShield = function(type){
    if(typeof setShield==='function'){ setShield(P, type); }
    localStorage.setItem('gg_shield', type);
    // Update UI
    document.querySelectorAll('.shield-pick').forEach(b=>{
      b.classList.toggle('active', parseInt(b.dataset.shield)===type);
    });
    const info=document.getElementById('shield-info');
    if(info) info.textContent=SHIELD_INFO_TEXT[type]||'';
  };
  // Restore shield from localStorage
  const savedShield = parseInt(localStorage.getItem('gg_shield')||'0');
  setTimeout(()=>{ window.pickShield(savedShield); }, 200);

  // Enter on PC
  window.addEventListener('keydown', e=>{
    if(e.key==='Enter'&&!window.IS_MOBILE){
      const mobOv=document.getElementById('mob-menu-overlay');
      if(!mobOv) return;
      if(mobOv.classList.contains('open')){
        window.doResume&&window.doResume();
      } else {
        mobOv.classList.add('open');
        gamePaused=true; uiMenuPaused=true; AI.enabled=false;
      }
      e.preventDefault();
    }
    if(e.key==='Escape'){
      closeMenu();
      const mobOv=document.getElementById('mob-menu-overlay');
      if(mobOv?.classList.contains('open')){
        mobOv.classList.remove('open');
        gamePaused=false;
        uiMenuPaused=false;
        if(!(typeof NET_SYNC!=='undefined'&&$.NET.active())) AI.enabled=true;
      }
    }
  });

  // Profile buttons
  document.getElementById('net-rename')?.addEventListener('click',()=>{
    nameInput.value=PROFILE.name;
    openMenu('name-overlay'); setTimeout(()=>nameInput?.focus(),80);
  });
  document.getElementById('mob-profile-btn')?.addEventListener('click',()=>{
    closeMenu();
    nameInput.value=PROFILE.name;
    openMenu('name-overlay'); setTimeout(()=>nameInput?.focus(),80);
  });
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ BLOCK 5: NETWORK UI MENU ════════════════════════════════════════════════
// Navigation between screens, profile display and contact book
// ════════════════════════════════════════════════════════════════════════════
(function(){
  function showNetScreen(id){
    document.querySelectorAll('.net-screen').forEach(s=>s.style.display='none');
    const s=document.getElementById(id);
    if(s) s.style.display='';
  }
  window.showNetScreen=showNetScreen;

  function updateNetUI(){
    const nameEl=document.getElementById('net-myname');
    const idEl  =document.getElementById('net-myid');
    const cntEl =document.getElementById('net-friends-count');
    if(nameEl) nameEl.textContent=PROFILE.name||'(not set)';
    if(idEl)   idEl.textContent=PROFILE.id;
    if(cntEl)  cntEl.textContent='('+PROFILE.book.length+'/30)';
    renderFriends();
  }
  window.updateNetUI=updateNetUI;

  function renderFriends(){
    const list=document.getElementById('net-friends-list');
    if(!list) return;
    if(!PROFILE.book.length){
      list.innerHTML='<div style="color:#1a4a5a;font-size:11px;padding:8px;">Empty — add a friend</div>';
      return;
    }
    list.innerHTML=PROFILE.book.map((c,i)=>`
      <div class="friend-item" style="flex-wrap:wrap;gap:4px;">
        <div style="flex:1;min-width:0;">
          <div class="fname">${escHtml(c.name)}</div>
          <div style="font-size:9px;color:#1a7a50;letter-spacing:1px;word-break:break-all;">${escHtml(c.id)}</div>
        </div>
        <button class="ov-btn accent small" onclick="netConnectToFriend(${i})">🔗</button>
        <button class="ov-btn small" onclick="netEditFriend(${i})">✏</button>
        <button class="ov-btn danger small" onclick="netRemoveFriend(${i})">✕</button>
      </div>`).join('');
  }

  window.netRemoveFriend=function(i){
    PROFILE.removeContact(i); updateNetUI();
  };
  window.netEditFriend=function(i){
    const c=PROFILE.book[i]; if(!c) return;
    const newName=prompt('Name:', c.name);
    if(newName===null) return;
    const newId=prompt('ID:', c.id);
    if(newId===null) return;
    c.name=newName.trim().slice(0,16)||c.name;
    c.id=newId.trim().toUpperCase()||c.id;
    PROFILE.book[i]=c;
    LS.save('gg_book', PROFILE.book);
    updateNetUI();
  };

  // Navigation
  document.getElementById('net-close-btn')?.addEventListener('click',()=>closeMenu('net-overlay'));
  document.getElementById('mob-net-btn')?.addEventListener('click',()=>{
    closeMenu();
    openMenu('net-overlay'); showNetScreen('net-screen-main'); updateNetUI();
  });

  // Dodge button — dash in the current stick movement direction
  window.doDodge=function doDodge(bypassCooldown){
    if(typeof P==='undefined') return;
    let dvx=0, dvy=0;
    // Check all key variations (shift keys may be uppercase)
    const kd=keys['d']||keys['D']||keys['в']||keys['В'];
    const ka=keys['a']||keys['A']||keys['ф']||keys['Ф'];
    const ks=keys['s']||keys['S']||keys['ы']||keys['Ы']||keys['і'];
    const kw=keys['w']||keys['W']||keys['ц']||keys['Ц'];
    if(kd) dvx=1; else if(ka) dvx=-1;
    if(ks) dvy=1; else if(kw) dvy=-1;

    if(dvx===0&&dvy===0){
      const pivX=(typeof rootCenter==='function'?$.POS.root().x:P.x)+P.pvX;
      const pivY=(typeof rootCenter==='function'?$.POS.root().y:P.y)+P.pvY;
      dvx=mX-pivX; dvy=mY-pivY;
    }
    window.fireDodge(dvx, dvy, bypassCooldown);
  }
  // Mobile music button
  const mobMusicBtn=document.getElementById('mob-music-btn');
  if(mobMusicBtn){
    mobMusicBtn.addEventListener('touchstart', e=>{
      e.preventDefault(); e.stopPropagation();
      if(typeof toggleMusic==='function') toggleMusic();
      setTimeout(()=>{
        const on=typeof musicEnabled!=='undefined'&&musicEnabled;
        mobMusicBtn.textContent=on?'🎵':'🔇';
        mobMusicBtn.style.color=on?'#4acc70':'#cc4040';
      },50);
    },{passive:false});
  }

  const styleBtn=document.getElementById('mob-style-btn');
  if(styleBtn){
    styleBtn.addEventListener('touchstart', e=>{
      e.preventDefault(); e.stopPropagation();
      if(typeof window.toggleSwordStyle==='function') window.toggleSwordStyle();
    }, {passive:false});
  }

  const shieldFlipBtn=document.getElementById('mob-shield-flip-btn');
  if(shieldFlipBtn){
    const setShieldHold = held => {
      if(typeof P==='undefined') return;
      P._shieldHeld = !!(held && P.shield>0 && !isExhausted(P) && P.stamina>0);
      shieldFlipBtn.classList.toggle('active', P._shieldHeld);
    };
    shieldFlipBtn.addEventListener('touchstart', e=>{
      e.preventDefault();
      setShieldHold(true);
    },{passive:false});
    shieldFlipBtn.addEventListener('touchend', e=>{
      e.preventDefault();
      setShieldHold(false);
    },{passive:false});
    shieldFlipBtn.addEventListener('touchcancel', e=>{
      e.preventDefault();
      setShieldHold(false);
    },{passive:false});
  }

  const weaponBtn=document.getElementById('mob-weapon-btn');
  if(weaponBtn){
    weaponBtn.addEventListener('touchstart', e=>{
      e.preventDefault(); e.stopPropagation();
      if(typeof P!=='undefined' && typeof setWeapon==='function' && P.hasWeapon!==false){
        P.weaponType=(P.weaponType+1)%WEAPON_TYPES.length; setWeapon(P, P.weaponType);
      }
    },{passive:false});
  }

  const throwBtn=document.getElementById('mob-throw-btn');
  if(throwBtn){
    throwBtn.addEventListener('touchstart', e=>{
      e.preventDefault(); e.stopPropagation();
      if(typeof P!=='undefined' && typeof throwWeapon==='function') throwWeapon(P);
    },{passive:false});
  }

  const dodgeBtn=document.getElementById('mob-dodge-btn');
  if(dodgeBtn){
    dodgeBtn.addEventListener('touchstart', e=>{
      e.preventDefault();
      doDodge();
    }, {passive:false});
  }
  window.goToLobby=function(){
    if(!window._mainPeer?.open){
      NET_CHAT.log('👆 Select server (Main/Backup) above first');
      return;
    }
    showNetScreen('net-screen-lobby');
  };

  document.getElementById('mob-quickmatch-btn')?.addEventListener('click',()=>{
    // Close mobile menu
    const mobOv=document.getElementById('mob-menu-overlay');
    if(mobOv) mobOv.classList.remove('open');
    gamePaused=false;

    if(window._mainPeer?.open){
      // Already connected to server — go straight to lobby
      openMenu('net-overlay');
      showNetScreen('net-screen-lobby');
    } else {
      // Not connected — auto-select Main server (without VPN)
      // and show log directly over the game without opening menu
      NET_CHAT.log('⏳ auto-connecting to server...');
      chooseServer(0); // Main (godgraveassets.onrender.com)
      // After connection, automatically open lobby
      let _waitAttempts=0;
      const _waitInterval=setInterval(()=>{
        _waitAttempts++;
        if(window._mainPeer?.open){
          clearInterval(_waitInterval);
          openMenu('net-overlay');
          showNetScreen('net-screen-lobby');
        } else if(_waitAttempts>60){ // 30 sec — no connection
          clearInterval(_waitInterval);
          NET_CHAT.log('❌ Failed to connect. Try via network menu.');
          openMenu('net-overlay');
          showNetScreen('net-screen-main');
          updateNetUI();
        }
      },500);
    }
  });

  // Add friend
  document.getElementById('net-add-friend')?.addEventListener('click',()=>{
    const nEl=document.getElementById('net-friend-name');
    const iEl=document.getElementById('net-friend-id');
    const n=(nEl?.value||'').trim().slice(0,16);
    const id=(iEl?.value||'').trim().toUpperCase();
    if(!n||!id) return;
    PROFILE.addContact(n,id);
    if(nEl) nEl.value=''; if(iEl) iEl.value='';
    updateNetUI();
  });

  window.netConnectToFriend=function(i){
    const f=PROFILE.book[i]; if(!f) return;
    NET_CORE.connect(f.id, f.name);
  };

  // Copy ID
  document.getElementById('net-copyid')?.addEventListener('click',()=>{
    navigator.clipboard?.writeText(PROFILE.id).then(()=>{
      const btn=document.getElementById('net-copyid');
      if(btn){btn.textContent='✅';setTimeout(()=>{btn.textContent='📋';},1400);}
    });
  });
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ BLOCK 6: PeerJS CONNECTION ════════════════════════════════════════════════
// PeerJS initialization, incoming/outgoing connections
// ════════════════════════════════════════════════════════════════════════════
