// === src/network/net.js ===

const GAME_ID = 'HOV_GODGRAVE_UNIQUE_ID';

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 1: ХРАНИЛИЩЕ ═══════════════════════════════════════════════════════
// localStorage — сохранение профиля и книжки контактов.
// Ключи привязаны к GAME_ID, а не к URL/имени файла, поэтому данные
// переживают смену версии HTML-файла (пока GAME_ID не меняется).
// ════════════════════════════════════════════════════════════════════════════
(function(){
  function lsSave(k,v){ try{ localStorage.setItem(GAME_ID+'_'+k,JSON.stringify(v)); }catch(e){} }
  function lsLoad(k){ try{ const v=localStorage.getItem(GAME_ID+'_'+k); return v?JSON.parse(v):null; }catch(e){ return null; } }

  // Перенос старых данных (сохранённых без префикса GAME_ID) в новую схему.
  // Выполняется один раз: если под новым ключом ещё пусто, а старый ключ
  // существует — копируем значение (старый ключ не трогаем, на случай
  // отката к прежней версии игры).
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

// ── Экранирование HTML (защита от XSS: имена/ID приходят от удалённых
//    пиров по сети и не должны попадать в innerHTML "как есть") ─────────────
function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 2: ПРОФИЛЬ ИГРОКА ══════════════════════════════════════════════════
// Имя, постоянный ID, книжка контактов
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
// ══ БЛОК 3: ЕДИНАЯ СИСТЕМА МЕНЮ ═════════════════════════════════════════════
// openMenu(id) — закрывает все, открывает нужное, скрывает HUD
// ════════════════════════════════════════════════════════════════════════════
(function(){
  function openMenu(id){
    document.querySelectorAll('.game-overlay.open').forEach(el=>{ if(el.id!==id) el.classList.remove('open'); });
    const el=document.getElementById(id);
    if(!el) return;
    el.classList.add('open');
    document.body.classList.add('menu-open');
    // В ПВП не паузим игру при открытии чата
    if(typeof gamePaused!=='undefined'&&!(typeof NET_SYNC!=='undefined'&&NET_SYNC.active)){
      gamePaused=true;
      uiMenuPaused=true;
    }
  }
  function closeMenu(id){
    const targets=id?[document.getElementById(id)]:document.querySelectorAll('.game-overlay.open');
    targets.forEach(el=>el?.classList.remove('open'));
    if(!document.querySelector('.game-overlay.open')){
      document.body.classList.remove('menu-open');
      // В ПВП не ставим паузу при закрытии меню
      if(typeof gamePaused!=='undefined'&&!(typeof NET_SYNC!=='undefined'&&NET_SYNC.active)){
        gamePaused=false;
        uiMenuPaused=false;
      }
    }
  }
  window.openMenu=openMenu;
  window.closeMenu=closeMenu;
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 4: OVERLAY ВВОДА ИМЕНИ ═════════════════════════════════════════════
// Показывается один раз при первом запуске
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

  // Применяем сохранённое имя
  if(PROFILE.name) applyNameToHUD(PROFILE.name);
  else setTimeout(()=>{ nameInput.value=''; openMenu('name-overlay'); setTimeout(()=>nameInput?.focus(),80); },800);

  // ── Выбор щита ───────────────────────────────────────────────────────────
const SHIELD_INFO_TEXT = [
  'Без щита',
  'Малый — скорость -6%',
  'Большой — скорость -18%',
  'Башенный — скорость -30%',
  'Шипастый малый — скор.-12%, баш 8 урона',
  'Шипастый средний — скор.-24%, баш 12 урона',
  'Шипастый большой — скор.-36%, баш 18 урона',
];
  window.pickShield = function(type){
    if(typeof setShield==='function'){ setShield(P, type); }
    localStorage.setItem('gg_shield', type);
    // Обновляем UI
    document.querySelectorAll('.shield-pick').forEach(b=>{
      b.classList.toggle('active', parseInt(b.dataset.shield)===type);
    });
    const info=document.getElementById('shield-info');
    if(info) info.textContent=SHIELD_INFO_TEXT[type]||'';
  };
  // Восстанавливаем щит из localStorage
  const savedShield = parseInt(localStorage.getItem('gg_shield')||'0');
  setTimeout(()=>{ window.pickShield(savedShield); }, 200);

  // Enter на ПК
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
        if(!(typeof NET_SYNC!=='undefined'&&NET_SYNC.active)) AI.enabled=true;
      }
    }
  });

  // Профиль кнопки
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
// ══ БЛОК 5: UI МЕНЮ СЕТИ ════════════════════════════════════════════════════
// Навигация между экранами, отображение профиля и книжки
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
    if(nameEl) nameEl.textContent=PROFILE.name||'(не задано)';
    if(idEl)   idEl.textContent=PROFILE.id;
    if(cntEl)  cntEl.textContent='('+PROFILE.book.length+'/30)';
    renderFriends();
  }
  window.updateNetUI=updateNetUI;

  function renderFriends(){
    const list=document.getElementById('net-friends-list');
    if(!list) return;
    if(!PROFILE.book.length){
      list.innerHTML='<div style="color:#1a4a5a;font-size:11px;padding:8px;">Пусто — добавь друга</div>';
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
    const newName=prompt('Имя:', c.name);
    if(newName===null) return;
    const newId=prompt('ID:', c.id);
    if(newId===null) return;
    c.name=newName.trim().slice(0,16)||c.name;
    c.id=newId.trim().toUpperCase()||c.id;
    PROFILE.book[i]=c;
    LS.save('gg_book', PROFILE.book);
    updateNetUI();
  };

  // Навигация
  document.getElementById('net-close-btn')?.addEventListener('click',()=>closeMenu('net-overlay'));
  document.getElementById('mob-net-btn')?.addEventListener('click',()=>{
    closeMenu();
    openMenu('net-overlay'); showNetScreen('net-screen-main'); updateNetUI();
  });

  // Кнопка доджа — рывок в направлении текущего движения стика
  window.doDodge=function doDodge(bypassCooldown){
    if(typeof P==='undefined') return;
    let dvx=0, dvy=0;
    // Проверяем все варианты написания клавиш (с Shift буквы могут быть заглавными)
    const kd=keys['d']||keys['D']||keys['в']||keys['В'];
    const ka=keys['a']||keys['A']||keys['ф']||keys['Ф'];
    const ks=keys['s']||keys['S']||keys['ы']||keys['Ы']||keys['і'];
    const kw=keys['w']||keys['W']||keys['ц']||keys['Ц'];
    if(kd) dvx=1; else if(ka) dvx=-1;
    if(ks) dvy=1; else if(kw) dvy=-1;

    if(dvx===0&&dvy===0){
      const pivX=(typeof rootCenter==='function'?rootCenter().x:P.x)+P.pvX;
      const pivY=(typeof rootCenter==='function'?rootCenter().y:P.y)+P.pvY;
      dvx=mX-pivX; dvy=mY-pivY;
    }
    window.fireDodge(dvx, dvy, bypassCooldown);
  }
  // Кнопка зоны арены
  document.getElementById('mob-zone-btn')?.addEventListener('touchstart', e=>{
    e.preventDefault();
    if(typeof toggleZone==='function') toggleZone();
  },{passive:false});

  // Кнопка музыки на мобиле
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
    shieldFlipBtn.addEventListener('touchstart', e=>{
      e.preventDefault(); e.stopPropagation();
      if(typeof P!=='undefined'){
        P._shieldFlipped = !P._shieldFlipped;
      }
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
      NET_CHAT.log('👆 Сначала выбери сервер (Основной/Запасной) выше');
      return;
    }
    showNetScreen('net-screen-lobby');
  };

  document.getElementById('mob-quickmatch-btn')?.addEventListener('click',()=>{
    // Закрываем мобильное меню
    const mobOv=document.getElementById('mob-menu-overlay');
    if(mobOv) mobOv.classList.remove('open');
    gamePaused=false;

    if(window._mainPeer?.open){
      // Уже подключены к серверу — сразу в лобби
      openMenu('net-overlay');
      showNetScreen('net-screen-lobby');
    } else {
      // Не подключены — автоматически выбираем Основной сервер (без VPN)
      // и показываем лог прямо поверх игры без открытия меню
      NET_CHAT.log('⏳ автоподключение к серверу...');
      chooseServer(0); // Основной (godgraveassets.onrender.com)
      // После подключения автоматически открываем лобби
      let _waitAttempts=0;
      const _waitInterval=setInterval(()=>{
        _waitAttempts++;
        if(window._mainPeer?.open){
          clearInterval(_waitInterval);
          openMenu('net-overlay');
          showNetScreen('net-screen-lobby');
        } else if(_waitAttempts>60){ // 30 сек — не подключился
          clearInterval(_waitInterval);
          NET_CHAT.log('❌ Не удалось подключиться. Попробуй через меню сети.');
          openMenu('net-overlay');
          showNetScreen('net-screen-main');
          updateNetUI();
        }
      },500);
    }
  });

  // Добавление друга
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

  // Копировать ID
  document.getElementById('net-copyid')?.addEventListener('click',()=>{
    navigator.clipboard?.writeText(PROFILE.id).then(()=>{
      const btn=document.getElementById('net-copyid');
      if(btn){btn.textContent='✅';setTimeout(()=>{btn.textContent='📋';},1400);}
    });
  });
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 6: PeerJS СОЕДИНЕНИЕ ════════════════════════════════════════════════
// Инициализация PeerJS, входящие/исходящие соединения
// ════════════════════════════════════════════════════════════════════════════
var NET_CORE = (function(){
  var peer=null, conn=null, fastConn=null, peerName='?';
  var _ping=50, _pingTimer=null;

  // ── Ping измерение ──
  function startPing(){
    if(_pingTimer) clearInterval(_pingTimer);
    _pingTimer=setInterval(()=>{
      if(conn&&conn.open) try{ conn.send({type:'ping',t:Date.now()}); }catch(e){}
    },2000);
  }
  function stopPing(){
    if(_pingTimer){ clearInterval(_pingTimer); _pingTimer=null; }
    _ping=50;
  }
  function getPing(){ return _ping; }

  // ── Список signaling-серверов (перебираются при недоступности) ──────────────
  // server: null = дефолтный публичный сервер PeerJS (cloud.peerjs.com)
  // Чтобы добавить свой сервер (Glitch/Render/Railway) — впиши его host сюда
  const SIGNAL_SERVERS = [
    { host:'godgraveassets.onrender.com', port:443, secure:true, path:'/', label:'Основной' },
    { host:'0.peerjs.com', port:443, secure:true, path:'/', label:'Запасной' },
  ];
  var _serverIdx=-1; // -1 = ещё не выбран
  var _connecting=false;
  const CONNECT_TIMEOUT_COLD=50000; // на случай "холодного" сервера

  // ── Общий ICE-конфиг (STUN+TURN) ──────────────────────────────────────────
  // Раньше дублировался в 3 местах (init/becomeHub/startLobby), причём у
  // лобби-пиров TURN вообще отсутствовал — за симметричным NAT/строгим
  // файрволом поиск через лобби мог не работать, хотя обычный "connect по ID"
  // работал. Теперь все Peer() создаются через один хелпер с одинаковым конфигом.
  const ICE_CONFIG={iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'turn:openrelay.metered.ca:80',  username:'openrelayproject', credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443', username:'openrelayproject', credential:'openrelayproject'},
  ]};
  function makePeer(id, srv){
    return new Peer(id, {
      host:srv.host, port:srv.port, secure:srv.secure, path:srv.path,
      config:ICE_CONFIG,
    });
  }

  // Явный выбор сервера пользователем — без автоматического перебора
  window.chooseServer=function(idx){
    if(_connecting) return; // уже идёт попытка
    _serverIdx=idx;
    if(peer){ try{peer.destroy();}catch(e){} peer=null; }
    init();
  };

  function setServerButtonsState(connecting){
    const b0=document.getElementById('net-srv-main');
    const b1=document.getElementById('net-srv-alt');
    [b0,b1].forEach(b=>{ if(b) b.disabled=connecting; });
  }

  function init(){
    if(_serverIdx<0){
      NET_CHAT.log('👆 выбери сервер выше (Основной/Запасной)');
      return;
    }
    const srv = SIGNAL_SERVERS[_serverIdx];
    _connecting=true;
    setServerButtonsState(true);
    NET_CHAT.log('⏳ подключение: '+srv.label+' ('+srv.host+')...');

    peer=makePeer(PROFILE.id, srv);

    let _opened=false;
    const failTimer=setTimeout(()=>{
      if(_opened) return;
      NET_CHAT.log('⏱ '+srv.label+' не отвечает. Попробуй другой сервер.');
      try{ peer.destroy(); }catch(e){}
      peer=null; _connecting=false; setServerButtonsState(false);
    }, CONNECT_TIMEOUT_COLD);

    peer.on('open',id=>{
      _opened=true; _connecting=false; clearTimeout(failTimer);
      _reconnectAttempts=0; // сброс backoff после успешного (пере)подключения
      setServerButtonsState(false);
      window._mainPeer=peer;
      PROFILE.setId(id);
      const idEl=document.getElementById('net-myid');
      if(idEl) idEl.textContent=id;
      NET_CHAT.log('✅ Онлайн ('+srv.label+') · ID: '+id);
      playSound('uiNote');
      // Подсвечиваем активную кнопку
      document.getElementById('net-srv-main')?.classList.toggle('accent', _serverIdx===0);
      document.getElementById('net-srv-alt')?.classList.toggle('accent', _serverIdx===1);
    });
    peer.on('connection',c=>{
      if(c.label==='fast'){ setupFastConn(c); return; }
      peerName=c.metadata?.name||c.peer;
      NET_CHAT.log('📞 входящее от '+peerName);
      setupConn(c);
    });
    peer.on('error',e=>{
      NET_CHAT.log('⚠ '+e.type);
      if(e.type==='unavailable-id'){
        clearTimeout(failTimer);
        PROFILE.setId(PROFILE.id.slice(0,3)+(Math.floor(Math.random()*90000)+10000));
        peer.destroy(); setTimeout(init,400);
      } else if(e.type==='peer-unavailable'){
        NET_CHAT.log('❌ Друг не найден');
      } else if(e.type==='network'||e.type==='server-error'){
        if(!_opened){
          clearTimeout(failTimer);
          NET_CHAT.log('❌ '+srv.label+' недоступен. Попробуй другой сервер.');
          try{ peer.destroy(); }catch(err){}
          peer=null; _connecting=false; setServerButtonsState(false);
        } else {
          scheduleReconnect();
        }
      }
    });
    peer.on('disconnected',()=>{
      NET_CHAT.log('↩ сервер: переподключение...');
      scheduleReconnect();
    });
  }

  // ── Backoff для переподключения к signaling-серверу ─────────────────────
  // Раньше reconnect() дёргался с фиксированным интервалом 1-2с без лимита —
  // при долгом падении сервера это бесконечно долбило его запросами.
  // Теперь интервал растёт экспоненциально (1с→2с→4с...→30с) и есть потолок
  // попыток, после которого просим пользователя выбрать сервер вручную.
  var _reconnectAttempts=0, _reconnectTimer=null;
  const RECONNECT_MAX_ATTEMPTS=8;
  function scheduleReconnect(){
    if(_reconnectTimer) return; // уже запланировано
    if(_reconnectAttempts>=RECONNECT_MAX_ATTEMPTS){
      NET_CHAT.log('❌ Не удалось переподключиться. Выбери сервер заново.');
      return;
    }
    const delay=Math.min(30000, 1000*Math.pow(2,_reconnectAttempts));
    _reconnectAttempts++;
    _reconnectTimer=setTimeout(()=>{
      _reconnectTimer=null;
      try{ peer?.reconnect(); }catch(e){}
    }, delay);
  }

  function connect(id, name){
    if(!peer?.open){ NET_CHAT.log('⚠ сервер не готов'); return; }
    // Закрываем предыдущие соединения, если они ещё были открыты —
    // иначе повторный connect() (например, гонка автоподключения из лобби)
    // оставлял старые DataConnection висеть с активными обработчиками.
    if(conn){ try{conn.close();}catch(e){} conn=null; }
    if(fastConn){ try{fastConn.close();}catch(e){} fastConn=null; }
    stopPing();
    NET_CHAT.log('🔗 подключение к '+id+'...');
    // Надёжный канал — чат, события, команды
    const c=peer.connect(id,{
      label:'reliable',
      metadata:{name:PROFILE.name||'Игрок'},
      reliable:true, serialization:'json',
    });
    peerName=name||id;
    setupConn(c);
    // Быстрый канал — позиции (ненадёжный, минимальная задержка)
    const f=peer.connect(id,{
      label:'fast',
      metadata:{name:PROFILE.name||'Игрок'},
      reliable:false, serialization:'json',
    });
    setupFastConn(f);
  }

  function setupFastConn(c){
    fastConn=c;
    c.on('open', ()=>{ NET_CHAT.log('⚡ быстрый канал открыт'); });
    c.on('data',d=>{
      try{
        const msg=typeof d==='string'?JSON.parse(d):d;
        // Быстрый канал использует msg.t='s' (delta state)
        if(msg.t==='s') NET_SYNC.onState(msg);
        // Fallback: старый формат
        if(msg.type==='state') NET_SYNC.onState(msg);
      }catch(e){}
    });
    c.on('error',()=>{});
  }

  function setupConn(c){
    conn=c; peerName=c.metadata?.name||c.peer;
    NET_CHAT.log('⏳ соединение с '+peerName+'...');
    c.on('open',()=>{
      NET_CHAT.log('🟢 соединено с '+peerName);
      NET_CHAT.onConnected(peerName);
      NET_SYNC.onConnected();
      startPing();
    });
    c.on('data',d=>{
      try{
        const msg=typeof d==='string'?JSON.parse(d):d;
        if(msg.type==='ping'){ try{conn.send({type:'pong',t:msg.t});}catch(e){} return; }
        if(msg.type==='pong'){ _ping=Math.round((Date.now()-msg.t)/2); NET_SYNC.onPingUpdate(_ping); return; }
        if(msg.type==='chat')      NET_CHAT.onMessage(msg);
        // state приходит через fastConn (msg.t='s'), здесь не обрабатываем
        if(msg.type==='startGame'){
          if(msg.name) NET_SYNC.setPeerName(msg.name);
          // Применяем скин инициатора к D
          if(msg.skinUrl)   { if(typeof D!=='undefined'){ D._skinUrl=msg.skinUrl;   D._skinImg=loadSpriteImage(msg.skinUrl); } }
          if(msg.weaponUrl) { if(typeof D!=='undefined'){ D._weaponUrl=msg.weaponUrl; D._weaponImg=loadSpriteImage(msg.weaponUrl); } }
          NET_SYNC.startGame(false);
        }
        if(msg.type==='readyGame') NET_SYNC.onReadyGame(msg);
        if(msg.type==='hit')       NET_SYNC.onHit(msg);
        if(msg.type==='pvp_reset') NET_SYNC.onPvpReset(msg);
        if(msg.type==='freeze'){ if(typeof DEATH!=='undefined'){DEATH.fadeIn=true;} }
        if(msg.type==='champion'){ if(typeof window._onChampionMsg==='function') window._onChampionMsg(msg.name); }
        if(msg.type==='disconnect'){ NET_SYNC.onDisconnected(); NET_CHAT.onDisconnected(); }
      }catch(e){}
    });
    c.on('close',()=>{
      NET_CHAT.log('🔴 разъединено');
      NET_CHAT.onDisconnected();
      NET_SYNC.onDisconnected();
      stopPing();
      conn=null; fastConn=null;
    });
    c.on('error',e=>NET_CHAT.log('⚠ '+e.type));
  }

  // Надёжная отправка (чат, хиты, команды)
  function send(msg){
    if(conn&&conn.open) try{ conn.send(msg); }catch(e){}
  }
  // Быстрая отправка позиций (ненадёжный канал, fallback на надёжный)
  function sendFast(msg){
    const ch=(fastConn&&fastConn.open)?fastConn:conn;
    if(ch&&ch.open) try{ ch.send(msg); }catch(e){}
  }

  return { init, connect, send, sendFast, getPeerName:()=>peerName, isOpen:()=>conn?.open, getPing,
    getPeer:()=>peer, // для лобби
    makePeer, // для лобби — единая точка создания Peer с ICE-конфигом
    getCurrentServer:()=>SIGNAL_SERVERS[_serverIdx>=0?_serverIdx:0] };
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 7: ЧАТ ══════════════════════════════════════════════════════════════
// UI чата, лог соединения, кнопки Play/Выйти
// ════════════════════════════════════════════════════════════════════════════
var NET_CHAT = (function(){
  var _chatEl=null, _logEl=null;

  function getChat(){ return _chatEl||(_chatEl=document.getElementById('net-chat-msgs')); }
  function getLog() { return _logEl||(_logEl=document.getElementById('net-log')); }

  function log(text){
    const el=getLog(); if(!el) return;
    const t=new Date().toTimeString().slice(0,5);
    const d=document.createElement('div');
    d.textContent=t+' '+text;
    d.style.cssText='font-size:10px;color:#2a6a7a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    while(el.children.length>=3) el.removeChild(el.firstChild);
    el.appendChild(d);
    Array.from(el.children).forEach((x,i,a)=>x.style.opacity=i===a.length-1?'1':'0.4');
  }

  function addMsg(who, text, name){
    const area=getChat(); if(!area) return;
    const d=document.createElement('div');
    d.className='net-msg '+(who==='me'?'me':who==='sys'?'sys':'them');
    if(who==='sys'){
      d.textContent='— '+text+' —';
    } else {
      const sp=document.createElement('span');
      sp.className='net-who';
      sp.textContent=who==='me'?(PROFILE.name||'Я'):(name||NET_CORE.getPeerName());
      d.appendChild(sp);
      d.appendChild(document.createTextNode(text));
    }
    area.appendChild(d);
    area.scrollTop=area.scrollHeight;
  }

  function sendChat(){
    const inp=document.getElementById('net-chat-input');
    const text=(inp?.value||'').trim();
    if(!text||!NET_CORE.isOpen()) return;
    NET_CORE.send({type:'chat', text, name:PROFILE.name||'?'});
    addMsg('me', text);
    if(inp) inp.value='';
  }

  function onConnected(name){
    const peerEl=document.getElementById('net-chat-peer');
    if(peerEl) peerEl.textContent=name;
    addMsg('sys','Соединено с '+name);
    // В авто-режиме (быстрый поиск) — не открывать чат
    if(typeof _autoPlay!=='undefined' && _autoPlay) return;
    openMenu('net-overlay');
    showNetScreen('net-screen-chat');
  }

  function onDisconnected(){
    addMsg('sys','Соединение разорвано');
    // Скрываем чат, показываем главное меню
    const chatPanel=document.getElementById('net-chat-panel');
    if(chatPanel) chatPanel.style.display='none';
    showNetScreen('net-screen-main');
  }

  function onMessage(msg){ addMsg('them', msg.text, msg.name); }

  // Кнопки
  document.getElementById('net-chat-send')?.addEventListener('click', sendChat);
  document.getElementById('net-chat-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); sendChat(); }
  });
  document.getElementById('net-chat-disconnect')?.addEventListener('click',()=>{
    NET_CORE.send({type:'disconnect'});
    onDisconnected();
  });
  document.getElementById('net-chat-play')?.addEventListener('click',()=>{
    // Локально запускаем игру и сообщаем другу
    NET_SYNC.startGame(true); // true = мы инициатор (отправляем startGame другу)
  });

  return { log, addMsg, onConnected, onDisconnected, onMessage };
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 8: СИНХРОНИЗАЦИЯ ИГРЫ
// ════════════════════════════════════════════════════════════════════════════
var NET_SYNC = (function(){
  var _active=false, _peerName='';
  var _cur={x:0,y:0,angle:0,vx:0,vy:0,hp:100,stamina:100,rage:0,vel:0,bx:0,by:0,pvX:0,pvY:-8};
  var _acceptAnyHp=false; // принимать HP в любую сторону после ресета

  // ── Буфер интерполяции (80ms задержка для плавности) ──
  var _buf=[], _bufDelay=80;

  function bufferPush(s){
    _buf.push({t:Date.now(), s:Object.assign({},s)});
    if(_buf.length>12) _buf.shift();
    // Адаптивная задержка: 1.5x пинг даёт запас для jitter
    const ping=NET_CORE.getPing();
    _bufDelay = Math.max(40, Math.min(150, ping*1.5));
  }

  function angDiffSafe(a,b){
    let d=(a-b)%(Math.PI*2);
    if(d> Math.PI) d-=Math.PI*2;
    if(d<-Math.PI) d+=Math.PI*2;
    return d;
  }

  function bufferTick(){
    if(!_buf.length) return null;
    const renderTime=Date.now()-_bufDelay;
    if(_buf[0].t>renderTime) return _buf[0].s;
    let a=null,b=null;
    for(let i=0;i<_buf.length;i++){
      if(_buf[i].t<=renderTime) a=_buf[i];
      else { b=_buf[i]; break; }
    }
    if(!b) return a.s;
    const frac=Math.min(1,(renderTime-a.t)/(b.t-a.t+1));
    const aA=a.s.angle??0, bA=b.s.angle??0;
    let ad=bA-aA; while(ad>Math.PI) ad-=Math.PI*2; while(ad<-Math.PI) ad+=Math.PI*2;
    return {
      x:     a.s.x+(b.s.x-a.s.x)*frac,
      y:     a.s.y+(b.s.y-a.s.y)*frac,
      angle: aA+ad*frac,
      vx:b.s.vx, vy:b.s.vy, vel:b.s.vel,
      hp:b.s.hp, stamina:b.s.stamina, rage:b.s.rage,
    };
  }

  // ── Квантование координат ──
  var _lastSent={nx:-9,ny:-9,vx:-9,vy:-9,angle:-9,vel:-9,hp:-9,stamina:-9,rage:-9};
  const DELTA_POS=2, DELTA_VEL=1, DELTA_ANG=0.02;

  function qEnc(v,max){ return Math.round(v/max*65535); }
  function qDec(v,max){ return v/65535*max; }
  function qaEnc(a){ return Math.round(((a%(Math.PI*2))+(Math.PI*2))%(Math.PI*2)/(Math.PI*2)*65535); }
  function qaDec(v){ return v/65535*Math.PI*2; }

  function buildDelta(p){
    const nx=qEnc(p.x,W), ny=qEnc(p.y,H);
    const vx=qEnc((p.vx||0)+W,W*2), vy=qEnc((p.vy||0)+H,H*2);
    const angle=qaEnc(p.angle||0);
    const vel=Math.round((p.vel||0)*100);
    const hp=Math.round(p.hp||0), stamina=Math.round(p.stamina||0), rage=Math.round(p.rage||0);
    const pvx=Math.round((p.pvX||0)*10+512), pvy=Math.round((p.pvY||0)*10+512);
    const bbx=Math.round((p.bx||0)*10+512),  bby=Math.round((p.by||0)*10+512);

    const d={t:'s'};
    if(Math.abs(nx-_lastSent.nx)>DELTA_POS||Math.abs(ny-_lastSent.ny)>DELTA_POS){
      d.x=nx; d.y=ny; _lastSent.nx=nx; _lastSent.ny=ny;
    }
    if(Math.abs(vx-_lastSent.vx)>DELTA_VEL||Math.abs(vy-_lastSent.vy)>DELTA_VEL){
      d.u=vx; d.v=vy; _lastSent.vx=vx; _lastSent.vy=vy;
    }
    if(Math.abs(angle-_lastSent.angle)>DELTA_ANG){
      d.a=angle; _lastSent.angle=angle;
    }
    if(vel!==_lastSent.vel){ d.l=vel; _lastSent.vel=vel; }
    if(hp!==_lastSent.hp){ d.h=hp; _lastSent.hp=hp; }
    if(stamina!==_lastSent.stamina){ d.s=stamina; _lastSent.stamina=stamina; }
    if(rage!==_lastSent.rage){ d.r=rage; _lastSent.rage=rage; }
    // Меч и тело — всегда
    d.px=pvx; d.py=pvy; d.bx=bbx; d.by=bby;
    d.a=angle; _lastSent.angle=angle; // угол всегда
    // Баффы/дебаффы — для отображения на HUD противника
    d.sh=p.shield||0;                        // тип щита
    d.shf=p._shieldFlipped?1:0;              // флип щита
    d.ex=Math.round((p.exhausted||0)*10);   // усталость
    d.ub=Math.round((p.unbalanced||0)*10);  // дисбаланс
    d.rb=p.rageBuffEnd>GameTime?Math.round((p.rageBuffEnd-GameTime)*10):0; // ярость
    d.wt=p.weaponType||0;                    // вид оружия (индекс в WEAPON_TYPES)
    d.hw=p.hasWeapon===false?0:1;            // вооружён ли (0 = обезоружен)
    return d;
  }

  // ── Адаптивная частота отправки ──
  var _sendTimer=null, _rateTimer=null;
  function getSendInterval(){ const p=NET_CORE.getPing(); return p<80?33:p<150?50:80; }
  var _curSendInterval=0;
  function startSendTimer(force){
    const wanted=getSendInterval();
    // Не пересоздаём interval, если частота не изменилась — раньше он
    // рестартовался на каждый pong (~раз в 2с) и на каждый rate-adapt тик
    // (раз в 5с), даже когда wanted тот же самый, что давало лишний джиттер
    // отправки без всякой пользы.
    if(!force && _sendTimer && wanted===_curSendInterval) return;
    if(_sendTimer) clearInterval(_sendTimer);
    _curSendInterval=wanted;
    _sendTimer=setInterval(()=>{
      if(!_active||!NET_CORE.isOpen()||typeof P==='undefined') return;
      const d=buildDelta(P);
      if(Object.keys(d).length>1) NET_CORE.sendFast(d);
    }, wanted);
  }
  function stopSendTimer(){ if(_sendTimer){clearInterval(_sendTimer);_sendTimer=null;_curSendInterval=0;} }
  function startRateAdapt(){
    if(_rateTimer) clearInterval(_rateTimer);
    _rateTimer=setInterval(()=>{ if(_active) startSendTimer(); },5000);
  }
  function stopRateAdapt(){ if(_rateTimer){clearInterval(_rateTimer);_rateTimer=null;} }

  // ── Пинг-дисплей ──
  function updatePingDisplay(ms){
    const el=document.getElementById('pvp-ping'); if(!el) return;
    el.textContent=ms+'ms';
    el.style.color=ms<80?'#4acc80':ms<160?'#ccaa20':'#cc4040';
  }
  function onPingUpdate(ms){ updatePingDisplay(ms); if(_active) startSendTimer(); }

  // ── PVP HUD ──
  function showPVPHud(on){
    const hud=document.getElementById('pvp-hud'); if(!hud) return;
    hud.style.display=on?'flex':'none';
    if(on){
      const el=document.getElementById('pvp-peer-name');
      if(el) el.textContent=_peerName||NET_CORE.getPeerName();
      updatePingDisplay(NET_CORE.getPing());
    }
  }

  // ── Активация манекена ──
  function activateDummy(){
    if(typeof dummyOn!=='undefined'&&!dummyOn&&typeof toggleAI==='function') toggleAI();
    if(typeof AI!=='undefined') AI.enabled=false;
    if(typeof D!=='undefined'){
      D.hp=100; D.stamina=100; D.rage=0;
      _cur={x:D.x,y:D.y,angle:D.angle||0,vx:0,vy:0,hp:100,stamina:100,rage:0,vel:0,bx:D.bx||0,by:D.by||0,pvX:D.pvX||0,pvY:D.pvY||-8};
      _buf=[]; _cur.bx=0; _cur.by=0; _cur.pvX=0; _cur.pvY=-8; _lastSent={nx:-9,ny:-9,vx:-9,vy:-9,angle:-9,vel:-9,hp:-9,stamina:-9,rage:-9};
      _acceptAnyHp=true;
    }
  }

  // ── Включение/выключение PVP ──
  function setNetPVP(on, peerNameOverride, isSender){
    const dtoggle=document.getElementById('dtoggle');
    const mobSpawn=document.getElementById('mob-spawn-btn');
    if(on){
      if(peerNameOverride) _peerName=peerNameOverride;
      activateDummy();
      if(dtoggle)  dtoggle.style.display='none';
      if(mobSpawn) mobSpawn.style.display='none';
      document.querySelectorAll('#hud-bot span').forEach(el=>{
        if(el.textContent.trim()==='БОТ') el.textContent=_peerName||'ИГРОК';
      });
      const bPhase=document.getElementById('hud-b-phase');
      if(bPhase) bPhase.textContent='ПВП';
      if(isSender){
        if(typeof P!=='undefined'){ P.x=W*0.15; P.y=H*0.6; }
        if(typeof D!=='undefined'){ D.x=W*0.82; D.y=H*0.6; _cur.x=D.x; _cur.y=D.y; }
      } else {
        if(typeof P!=='undefined'){ P.x=W*0.82; P.y=H*0.6; }
        if(typeof D!=='undefined'){ D.x=W*0.15; D.y=H*0.6; _cur.x=D.x; _cur.y=D.y; }
      }
      showPVPHud(true);
      document.querySelectorAll('.game-overlay.open').forEach(el=>el.classList.remove('open'));
      const mobOv=document.getElementById('mob-menu-overlay');
      if(mobOv) mobOv.classList.remove('open');
      document.body.classList.remove('menu-open');
      gamePaused=false;
      NET_CHAT.log('🎮 ПВП: '+_peerName);
      startSendTimer(); startRateAdapt();
    } else {
      if(dtoggle)  dtoggle.style.display='';
      if(mobSpawn) mobSpawn.style.display='';
      if(typeof AI!=='undefined') AI.enabled=true;
      showPVPHud(false);
      stopSendTimer(); stopRateAdapt();
    }
    _active=on;
  }

  function onConnected(){}

  // ── Handshake ──
  var _pendingStart=false;
  function startGame(isSender){
    if(isSender){
      _pendingStart=true;
      NET_CORE.send({type:'startGame', name:PROFILE.name,
        skinUrl:P?._skinUrl||null, weaponUrl:P?._weaponUrl||null,
        shield:P?.shield||0, shieldFlipped:P?._shieldFlipped?1:0});
      NET_CHAT.log('⏳ ждём...');
      setTimeout(()=>{
        if(_pendingStart && NET_CORE.isOpen()){ _pendingStart=false; setNetPVP(true,NET_CORE.getPeerName(),true); }
        else _pendingStart=false;
      },5000);
    } else {
      NET_CORE.send({type:'readyGame', skinUrl:P?._skinUrl||null, weaponUrl:P?._weaponUrl||null,
        shield:P?.shield||0, shieldFlipped:P?._shieldFlipped?1:0});
      setNetPVP(true,_peerName,false);
    }
  }
  function onReadyGame(msg){
    if(!_pendingStart) return;
    _pendingStart=false;
    if(msg?.skinUrl)   { D._skinUrl=msg.skinUrl;   D._skinImg=loadSpriteImage(msg.skinUrl); }
    if(msg?.weaponUrl) { D._weaponUrl=msg.weaponUrl; D._weaponImg=loadSpriteImage(msg.weaponUrl); }
    if(msg?.shield!=null) setShield(D, msg.shield);
    if(msg?.shieldFlipped!=null) D._shieldFlipped = !!msg.shieldFlipped;
    setNetPVP(true,NET_CORE.getPeerName(),true);
  }

  function disconnect(){
    NET_CORE.send({type:'disconnect'});
    setNetPVP(false);
    NET_CHAT.onDisconnected();
  }

  // sendReset: победитель отправляет команду с позициями обоих
  // iWon=true: я победил (D умер у меня) => на другой стороне умер P
  function sendReset(iWon){
    if(iWon && typeof addWin==='function') addWin(false); // PVP победа игрока
    _lastSent={nx:-9,ny:-9,vx:-9,vy:-9,angle:-9,vel:-9,hp:-9,stamina:-9,rage:-9};
    _acceptAnyHp=true;
    // Обновляем D локально у победителя немедленно
    if(typeof D!=='undefined'){
      D.hp=100; D.stamina=100; D.rage=0;
      D.exhausted=0; D.unbalanced=0;
      if(D.hasWeapon===false && typeof setWeapon==='function') setWeapon(D, D.weaponType);
      _cur.hp=100; _cur.stamina=100;
      _buf=[];
    }
    NET_CORE.send({
      type:'pvp_reset',
      iWon,
      myNx: Math.round(P.x/W*1000)/1000,
      myNy: Math.round(P.y/H*1000)/1000,
    });
  }
  // Совместимость
  function forceResync(){ sendReset(true); }

  // Получили ресет от противника
function onPvpReset(msg){
  if(!_active||typeof D==='undefined') return;
  
  // 🗑️ УДАЛЯЕМ ВСЁ БРОШЕННОЕ ОРУЖИЕ ПРИ РЕСЕТЕ В PVP
  if(typeof DROPPED_WEAPONS !== 'undefined') {
    DROPPED_WEAPONS.length = 0;
  }
  if(typeof PROJECTILES !== 'undefined') {
    PROJECTILES.length = 0;
  }
  if(typeof WAND_PARTICLES !== 'undefined') WAND_PARTICLES.length = 0;
  if(typeof WAND_EXPLOSIONS !== 'undefined') WAND_EXPLOSIONS.length = 0;
  if(typeof MAGICSTAFF_CHARGE_FX !== 'undefined') MAGICSTAFF_CHARGE_FX.length = 0;
  if(typeof MAGICSTAFF_LIGHTNING_FX !== 'undefined') MAGICSTAFF_LIGHTNING_FX.length = 0;
  if(typeof MAGICSTAFF_GLOW_FX !== 'undefined') MAGICSTAFF_GLOW_FX.length = 0;
  
  // Сбрасываем D (противника)
  D.hp=100; D.stamina=100; D.rage=0;
  D.exhausted=0; D.unbalanced=0; D.vx=0; D.vy=0;
  D.hitFlash=0; D.rageBuffEnd=-1; D._dvx=0; D._dvy=0;
  D._wasExhausted = false;
  D._recovering = false;
  D._recoverProgress = 0;
  D._swingBlockCD = -1;
  D._exhaustedEndTime = 0;
  // Сбрасываем состояние зарядки у D
  if(D._wandCharging) { D._wandCharging = false; if(D._wandChargeSoundObj) { try{D._wandChargeSoundObj.pause();}catch(e){} D._wandChargeSoundObj = null; } }
  if(D._magicCharging) { D._magicCharging = false; if(D._magicChargeSoundObj) { try{D._magicChargeSoundObj.pause();}catch(e){} D._magicChargeSoundObj = null; } }
  if(D._bowCharging) { D._bowCharging = false; if(D._bowTensionSound) { try{D._bowTensionSound.pause();}catch(e){} D._bowTensionSound = null; } }
  if(D.hasWeapon===false && typeof setWeapon==='function') setWeapon(D, D.weaponType);
  
  // Сбрасываем P (игрока)
  if(P.hasWeapon===false && typeof setWeapon==='function') setWeapon(P, P.weaponType);
  P.hp=100; P.stamina=P.stamMax||100; P.rage=0;
  P.exhausted=0; P.unbalanced=0; P.vx=0; P.vy=0;
  P.hitFlash=0; P.rageBuffEnd=-1; P._dvx=0; P._dvy=0;
  P._wasExhausted = false;
  P._recovering = false;
  P._recoverProgress = 0;
  P._swingBlockCD = -1;
  P._exhaustedEndTime = 0;
  
  // Буфер интерполяции
  _buf=[]; 
  _cur.hp=100; 
  _cur.stamina=100;
  _acceptAnyHp=true; // принять hp:100 от следующего пакета
  
  // Позиции в зависимости от победителя
  if(msg?.iWon){
    // Противник победил → мы проиграли (P справа)
    D.x = W * 0.15;
    D.y = H * 0.6;
    P.x = W * 0.82;
    P.y = H * 0.6;
    _cur.x = D.x;
    _cur.y = D.y;
    if(typeof addWin==='function') addWin(true); // PVP: противник победил
  } else {
    // Противник проиграл → мы победили (P слева)
    D.x = W * 0.82;
    D.y = H * 0.6;
    P.x = W * 0.15;
    P.y = H * 0.6;
    _cur.x = D.x;
    _cur.y = D.y;
  }
  
  // Сбрасываем экран смерти
  DEATH.dDead = false;
  DEATH.pDead = false;
  DEATH.fadeIn = false;
  DEATH.text = '';
  
  NET_CHAT.log('↺ раунд сброшен');
}
  // ── Приём состояния ──
  function onState(msg){
    if(!_active||typeof D==='undefined') return;
    const ping=NET_CORE.getPing()/2000;
    if(msg.t==='s'){
      if(msg.x!=null){
        _cur.x=qDec(msg.x,W); _cur.y=qDec(msg.y,H);
        // Первый пакет — мгновенно ставим D на позицию (нет рывка)
        if(_buf.length===0&&typeof D!=='undefined'){
          D.x=_cur.x; D.y=_cur.y;
        }
      }
      if(msg.u!=null){ _cur.vx=qDec(msg.u,W*2)-W; _cur.vy=qDec(msg.v,H*2)-H; }
      if(msg.a!=null){ _cur.angle=qaDec(msg.a); }
      if(msg.l!=null){ _cur.vel=msg.l/100; }
      if(msg.h!=null){ _cur.hp=msg.h; }
      if(msg.s!=null){ _cur.stamina=msg.s; }
      if(msg.r!=null){ _cur.rage=msg.r; }
      if(msg.px!=null){ _cur.pvX=(msg.px-512)/10; _cur.pvY=(msg.py-512)/10; }
      if(msg.bx!=null){ _cur.bx=(msg.bx-512)/10;  _cur.by=(msg.by-512)/10; }
      // Баффы
      // Щит противника
      if(msg.sh!=null && msg.sh!==D.shield){ setShield(D, msg.sh); }
      if(msg.shf!=null) D._shieldFlipped = !!msg.shf;
      // Усталость/дисбаланс — сохраняем таргет, применяем плавно в tick
      if(msg.ex!=null) _cur._exTarget  = msg.ex/10;
      if(msg.ub!=null) _cur._ubTarget  = msg.ub/10;
      if(msg.rb!=null) D.rageBuffEnd= msg.rb>0 ? GameTime+msg.rb/10 : -1;
      // Вид оружия противника — нужен для верной длины/скорости замаха при
      // рендере D. Спрайт (_weaponUrl/_weaponImg) синхронизируется отдельно
      // при хендшейке и при подборе оружия на карте, поэтому здесь трогаем
      // только индекс, а не пере-рандомизируем спрайт через setWeapon().
      if(msg.wt!=null && msg.wt!==D.weaponType){ D.weaponType=msg.wt; }
      // Обезоруживание противника — иначе D продолжает драться "вооружённым"
      // даже после того, как оппонент выбил у себя оружие (и наоборот).
      if(msg.hw!=null){
        const _hw=!!msg.hw;
        if(!_hw && D.hasWeapon!==false){ D.hasWeapon=false; D._weaponImg=null; }
        else if(_hw && D.hasWeapon===false){ D.hasWeapon=true; }
      }
    }
    // Client-side prediction
    const pred=Object.assign({},_cur,{
      x:_cur.x+(_cur.vx||0)*ping,
      y:_cur.y+(_cur.vy||0)*ping,
      angle:_cur.angle,
    });
    bufferPush(pred);
    // После ресета принимаем HP в любую сторону (флаг _acceptAnyHp)
    if(_acceptAnyHp || _cur.hp<D.hp-0.5)  D.hp=_cur.hp;
    if(_acceptAnyHp || _cur.stamina<D.stamina-0.5) D.stamina=_cur.stamina;
    D.rage=_cur.rage;
    if(_acceptAnyHp && _cur.hp>=99) _acceptAnyHp=false; // сбрасываем после получения 100
    if(typeof AI!=='undefined') AI.enabled=false;
    // debug

  }

  function onHit(msg){
    if(!_active||typeof P==='undefined') return;
    P.hp=Math.max(0,msg.newHp);
    P.hitFlash=(typeof GameTime!=='undefined'?GameTime:0)+0.25;
    hitFX.push({x:P.x,y:P.y-30,t:'-'+msg.dmg,life:40,big:false,col:'#ff4040'});
    playSound?.('damage');
    if(P.hp<=0&&typeof triggerDeath==='function') triggerDeath(P,false);
  }

  function onDisconnected(){ _pendingStart=false; setNetPVP(false); NET_CHAT.log('👋 ПВП завершён'); }

  // ── Tick — буфер интерполяции → D ──
  function tick(rawDt){
    if(!_active||typeof D==='undefined') return;
    if(typeof AI!=='undefined') AI.enabled=false;

    const target=bufferTick();
    if(!target) return;

    // Позиция — фиксированный lerp без dist-зависимости (убирает перелёт)
    const dist=Math.hypot(target.x-D.x,target.y-D.y);
    if(dist>W*0.4 || _buf.length<3){
      // Телепорт при большом расстоянии или старте
      D.x=target.x; D.y=target.y;
    } else {
      // Фиксированный коэффициент — нет нелинейного ускорения при большой дистанции
      const t=Math.min(1, rawDt*12);
      D.x+=(target.x-D.x)*t;
      D.y+=(target.y-D.y)*t;
    }

    // Усталость/дисбаланс — плавно
    if(_cur._exTarget!=null) D.exhausted  = D.exhausted  *0.8 + _cur._exTarget*0.2;
    if(_cur._ubTarget!=null) D.unbalanced = D.unbalanced *0.8 + _cur._ubTarget*0.2;

    // Velocity
    if(target.vx!=null){
      D.vx=D.vx*0.4+target.vx*0.6;
      D.vy=D.vy*0.4+target.vy*0.6;
    }
    if(target.vel!=null) D.vel=D.vel*0.5+target.vel*0.5;

    // Угол меча — из буфера интерполяции (та же плавность что и позиция)
    if(target.angle!=null){
      let diff=target.angle-D.angle;
      while(diff>Math.PI)  diff-=Math.PI*2;
      while(diff<-Math.PI) diff+=Math.PI*2;
      D.angle+=diff*Math.min(1, rawDt*12);
    }

    // Оффсет тела (bx/by) и пивот меча (pvX/pvY) — lerp с тем же коэффициентом
    // Раньше они прыгали мгновенно → рассинхрон с плавным движением тела
    const st=Math.min(1, rawDt*10); // чуть медленнее позиции — естественнее
    D.bx  += (_cur.bx  - D.bx)  * st;
    D.by  += (_cur.by  - D.by)  * st;
    D.pvX += (_cur.pvX - D.pvX) * st;
    D.pvY += (_cur.pvY - D.pvY) * st;
  }

  return { onConnected,onDisconnected,onState,onHit,onReadyGame,onPingUpdate,startGame,disconnect,tick,
    setPeerName(n){_peerName=n;}, get active(){return _active;}, get peerName(){return _peerName;},
    forceResync, sendReset, onPvpReset };
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 8.5: ЛОББИ — БЫСТРЫЙ ПОИСК
// Сначала пробуем стать хабом. Если ID занят — подключаемся как клиент.
// ════════════════════════════════════════════════════════════════════════════
(function(){
  const SLOT_MS=30*60*1000;
  function getHubId(){ return 'GG_HUB_'+Math.floor(Date.now()/SLOT_MS); }

  var _hubPeer=null, _clientConn=null, _players={}, _timer=null, _isHub=false;

  function status(txt,col){
    const el=document.getElementById('lobby-status');
    if(el){el.textContent=txt;el.style.color=col||'#2a7a9a';}
  }

  function render(){
    const list=document.getElementById('lobby-list'); if(!list) return;
    const now=Date.now();
    Object.keys(_players).forEach(id=>{ if(now-_players[id].ts>20000) delete _players[id]; });
    const entries=Object.entries(_players).filter(([id])=>id!==PROFILE.id);
    if(!entries.length){
      list.innerHTML='<div style="color:#1a4a5a;font-size:11px;padding:8px 0;">Пока никого. Жди...</div>';
      return;
    }
    list.innerHTML=entries.map(([id,p])=>`
      <div class="friend-item" style="justify-content:space-between;margin-bottom:6px;">
        <span class="fname">${escHtml(p.name)}</span>
        <span style="font-size:9px;color:#1a5a3a;">${escHtml(id)}</span>
        <button class="ov-btn accent" style="min-height:40px;flex:0 0 auto;" data-lobby-id="${escHtml(id)}" data-lobby-name="${escHtml(p.name)}">🔗 Войти</button>
      </div>`).join('');
    // Обработчик через data-атрибуты + delegation — раньше id/name из сети
    // подставлялись прямо в inline onclick="lobbyConnect('...','...')",
    // что было полноценной XSS-инъекцией (можно было выйти из кавычек).
    list.querySelectorAll('[data-lobby-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>window.lobbyConnect(btn.dataset.lobbyId, btn.dataset.lobbyName));
    });
    // Автоподключение — если нашли игрока и ещё не подключены
    if(entries.length>0 && !NET_SYNC.active && !NET_CORE.isOpen() && !_autoConnecting){
      _autoConnecting=true;
      const [firstId, firstP]=entries[0];
      status('🔗 Найден '+firstP.name+' — подключаемся...','#4acc80');
      setTimeout(()=>{ lobbyConnect(firstId, firstP.name); },800);
    }
  }

  window.lobbyConnect=function(id,name){
    stopLobby();
    _autoPlay=true;
    // Закрываем все меню без анимации
    document.querySelectorAll('.game-overlay.open').forEach(el=>el.classList.remove('open'));
    document.body.classList.remove('menu-open');
    if(typeof gamePaused!=='undefined') gamePaused=false;
    // Затенение на время коннекта
    const overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:monospace;color:#4acc80;font-size:14px;letter-spacing:2px;';
    overlay.textContent='🔗 ПОДКЛЮЧЕНИЕ К ' + name.toUpperCase() + '...';
    overlay.id='_lobby_overlay';
    document.body.appendChild(overlay);
    NET_CORE.connect(id,name);
    // Запускаем игру через 1.5 сек после соединения
    _autoPlayTimer=setTimeout(()=>{
      const ov=document.getElementById('_lobby_overlay');
      if(ov) ov.remove();
      _autoPlay=false;
      if(NET_SYNC.active) return;
      NET_SYNC.startGame(true);
    },1500);
  };
  var _autoPlayTimer=null;
  var _autoConnecting=false;
  var _autoPlay=false; // режим авто-старта — не открывать чат

  function myPresence(){ return {type:'lobby',id:PROFILE.id,name:PROFILE.name||'Игрок'}; }

  // ── Регистрация обработчиков хаба (используется из startLobby после
  //    успешного захвата ID хаба) ─────────────────────────────────────────
  function attachHubHandlers(){
    _hubPeer.on('connection',c=>{
      c.on('open',()=>{ c.send(myPresence()); });
      c.on('data',d=>{
        try{
          const msg=typeof d==='string'?JSON.parse(d):d;
          if(!msg||msg.type!=='lobby'||typeof msg.id!=='string'||typeof msg.name!=='string') return;
          _players[msg.id]={name:msg.name.slice(0,32),ts:Date.now()};
          // Ретранслируем всем клиентам
          Object.values(_hubPeer.connections||{}).forEach(arr=>
            arr.forEach(cc=>{ if(cc!==c&&cc.open) try{cc.send(msg);}catch(e){} })
          );
          render();
        }catch(e){}
      });
      c.on('error',()=>{});
    });
  }

  // ── Режим КЛИЕНТ ──
  function joinHub(){
    _isHub=false;
    const hubId=getHubId();
    const c=window._mainPeer.connect(hubId,{label:'lobby',reliable:true,serialization:'json'});
    _clientConn=c;
    let _hubOpened=false;
    const hubTimeout=setTimeout(()=>{
      if(_hubOpened) return;
      status('⚠ Хаб не отвечает (возможно на другом сервере у друга)','#cc5050');
      try{ c.close(); }catch(e){}
      _clientConn=null;
    }, 10000);
    c.on('open',()=>{
      _hubOpened=true; clearTimeout(hubTimeout);
      status('🟢 В лобби!','#4acc80');
      c.send(myPresence());
      _players[PROFILE.id]={name:PROFILE.name||'Игрок',ts:Date.now()};
      render();
    });
    c.on('data',d=>{
      try{
        const msg=typeof d==='string'?JSON.parse(d):d;
        if(msg&&msg.type==='lobby'&&typeof msg.id==='string'&&typeof msg.name==='string'){
          _players[msg.id]={name:msg.name.slice(0,32),ts:Date.now()};
          render();
        }
      }catch(e){}
    });
    c.on('close',()=>{ clearTimeout(hubTimeout); status('Отключено от лобби','#cc5050'); });
    c.on('error',e=>{
      clearTimeout(hubTimeout);
      status('⚠ Ошибка лобби: '+e.type,'#cc5050');
      _clientConn=null;
    });
  }

  // ── Запуск: сначала пробуем стать хабом ──
  window.startLobby=function(){
    stopLobby(); _players={}; _isHub=false;
    if(!window._mainPeer?.open){ status('⚠ Сначала подключись к серверу','#cc5050'); return; }
    status('Подключение...','#ccaa30');

    // Пробуем зарегистрировать ID хаба
    const hubId=getHubId();
    const _srv=NET_CORE.getCurrentServer(); _hubPeer=NET_CORE.makePeer(hubId,_srv);
    _hubPeer.on('open',()=>{
      // Успех — мы хаб
      status('🟢 Ты хост. Ждём игроков...','#4acc80');
      _isHub=true;
      _players[PROFILE.id]={name:PROFILE.name||'Игрок',ts:Date.now()};
      render();
      attachHubHandlers(); // принимаем клиентов
    });
    _hubPeer.on('error',e=>{
      if(e.type==='unavailable-id'){
        // Хаб уже есть — подключаемся как клиент
        try{_hubPeer.destroy();}catch(err){} _hubPeer=null;
        status('Хост найден, подключаемся...','#ccaa30');
        joinHub();
      } else {
        status('⚠ '+e.type,'#cc5050');
        try{_hubPeer?.destroy();}catch(err){} _hubPeer=null;
      }
    });

    // Обновляем список каждые 4 сек
    _timer=setInterval(()=>{
      render();
      _players[PROFILE.id]={name:PROFILE.name||'Игрок',ts:Date.now()};
      if(_clientConn?.open) _clientConn.send(myPresence());
    },4000);
  };

  window.stopLobby=function(){
    _autoConnecting=false;
    if(_timer){clearInterval(_timer);_timer=null;}
    try{_hubPeer?.destroy();}catch(e){} _hubPeer=null;
    try{_clientConn?.close();}catch(e){} _clientConn=null;
    _players={}; _isHub=false;
  };

  // Перехват showNetScreen
  const _orig=window.showNetScreen;
  window.showNetScreen=function(id){
    if(id==='net-screen-lobby') startLobby();
    else if(_timer) stopLobby();
    _orig(id);
  };
})();


// ════════════════════════════════════════════════════════════════════════════
// ДОДЖ ПК — Shift, та же логика что мобиль
// ════════════════════════════════════════════════════════════════════════════
(function(){
  let _pcDodgeCooldown=0;

  window.addEventListener('keydown', e=>{
    if(e.key!=='Shift') return;
    if(e.repeat) return;
    if(typeof gamePaused!=='undefined'&&gamePaused) return;
    if(_pcDodgeCooldown>0) return;
    _pcDodgeCooldown=0.8;
    // doDodge сам разбирается с направлением (keys или курсор)
    if(typeof window.doDodge==='function') window.doDodge(true);
  });

  window._dodgeTick=function(rawDt){
    if(_pcDodgeCooldown>0) _pcDodgeCooldown-=rawDt;
    if(typeof window._dodgeCooldownMob!=='undefined'&&window._dodgeCooldownMob>0)
      window._dodgeCooldownMob-=rawDt;
    // Трейл доджа — спавним каждый кадр пока активен
    if(typeof window._dodgeTrailFrames!=='undefined'&&window._dodgeTrailFrames>0&&typeof P!=='undefined'){
      window._dodgeTrailFrames--;
      if(typeof DODGE_TRAIL==='undefined') window.DODGE_TRAIL=[];
      DODGE_TRAIL.push({
        x:P.x+Math.random()*10-5,
        y:P.y+Math.random()*10-5,
        life:14, maxLife:14, r:7
      });
    }
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// HITSTOP + SCREEN SHAKE
// ════════════════════════════════════════════════════════════════════════════
(function(){
  var _hitstopFrames=0, _shakeX=0, _shakeY=0, _shakeMag=0;

  window.triggerHitstop=function(frames, shakeMag){
    _hitstopFrames=Math.max(_hitstopFrames, frames||5);
    _shakeMag=Math.max(_shakeMag, shakeMag||4);
  };

  // Патчим loop — вставляем hitstop перед обновлением
  const _origUpdateHUD=window.updateHUD;
  // Hitstop применяется через gamePaused-подобный механизм
  // Вместо этого патчим canvas transform
  const _origDrawChar=window.drawChar;

  // Canvas shake через transform
  window._applyScreenShake=function(){
    if(_shakeMag>0.1){
      _shakeX=(Math.random()-0.5)*_shakeMag*2;
      _shakeY=(Math.random()-0.5)*_shakeMag*2;
      _shakeMag*=0.75; // затухание
      ctx.save();
      ctx.translate(_shakeX, _shakeY);
      return true;
    }
    return false;
  };
  window._restoreScreenShake=function(applied){
    if(applied) ctx.restore();
  };

  // Hitstop — пропускаем обновление физики
  window._hitstopTick=function(){
    if(_hitstopFrames>0){ _hitstopFrames--; return true; } // true = заморожено
    return false;
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// СЧЁТЧИК ПОБЕД
// ════════════════════════════════════════════════════════════════════════════
(function(){
  var _wP=0, _wD=0;
  function updateWins(){
    const ep=document.getElementById('hud-p-wins');
    const eb=document.getElementById('hud-b-wins');
    if(ep) ep.textContent=_wP?'★'.repeat(Math.min(_wP,6)):'';
    if(eb) eb.textContent=_wD?'★'.repeat(Math.min(_wD,6)):'';
  }
  function getWinnerName(isBot){
    if(!isBot) return (typeof PROFILE!=='undefined'&&PROFILE.name) ? PROFILE.name : 'Игрок';
    // Имя бота — из HUD
    const botEl=document.getElementById('hud-bot-name');
    return (botEl&&botEl.textContent) ? botEl.textContent.trim() : 'Бот';
  }
  window.addWin = function(isBot){
  if(isBot) _wD++; else _wP++;
  
  // 1. Проверяем, не достиг ли кто-то 6 побед
  if(_wP>=6 || _wD>=6){
    const winnerName = getWinnerName(_wD>=6);
    if(typeof hitFX!=='undefined'){
      hitFX.push({x:typeof W!=='undefined'?W/2:400, y:typeof H!=='undefined'?H/2-60:240,
        t:'🏆 ПОБЕДИЛ ' + winnerName.toUpperCase() + '!',
        life:300, big:true, col:'#ffd700'});
    }
    if(typeof NET_CORE!=='undefined'&&NET_CORE.isOpen()){
      NET_CORE.send({type:'champion', name:winnerName});
    }
    // 2. Сбрасываем счётчики ПОСЛЕ 6-й победы (как было)
    setTimeout(()=>{ _wP=0; _wD=0; updateWins(); }, 3000);
    return; // <-- Важно: выходим, чтобы не обновить HUD раньше времени
  }
  
  // 3. Это ключевое изменение: после добавления очка (но до 6 побед)
  // мы просто сбрасываем счётчики для следующего раунда.
  // Сброс через 3 секунды, чтобы игроки видели результат раунда.
  setTimeout(() => {
    _wP = 0;
    _wD = 0;
    updateWins();
  }, 3000);
};
  window.resetWins=function(){
    _wP=0; _wD=0; updateWins();
  };
  // Получаем сообщение о чемпионе по сети
  window._onChampionMsg=function(name){
    if(typeof hitFX!=='undefined')
      hitFX.push({x:typeof W!=='undefined'?W/2:400, y:typeof H!=='undefined'?H/2-60:240,
        t:'🏆 ПОБЕДИЛ ' + name.toUpperCase() + '!',
        life:300, big:true, col:'#ffd700'});
    _wP=0; _wD=0; updateWins();
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// ЛУЖИ КРОВИ
// ════════════════════════════════════════════════════════════════════════════
(function(){
  const _pools=[];
  const POOL_LIFE=2.5;

  window.spawnBloodPool=function(x, y, dmg){
    const life = 3 + Math.min(7, (dmg||5)/5*7); // 3-10 сек в зависимости от урона
    const pr=(rf(6,8)+(dmg||5)*0.3)*0.8; // -20%
    _pools.push({x, y, r:pr, life, maxLife:life, alpha:rf(0.7,0.3)});
  };

  window.updateBloodPools=function(dt){
    for(let i=_pools.length-1;i>=0;i--){
      _pools[i].life-=dt;
      if(_pools[i].life<=0) _pools.splice(i,1);
    }
  };

  window.drawBloodPools=function(){
    if(!_pools.length) return;
    ctx.save();
    for(const p of _pools){
      const a=(p.life/(p.maxLife||POOL_LIFE))*p.alpha;
      ctx.globalAlpha=a*0.6;
      ctx.fillStyle='#6a0a0a';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r*1.6, p.r*0.6, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.restore();
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// ЗОНА АРЕНЫ (круговое сужение)
// ════════════════════════════════════════════════════════════════════════════
// ЗОНА АРЕНЫ (круговое сужение)
(function(){
  var _zoneActive=false;
  var _zoneTimer=0; // полное время с начала
  const ZONE_GRACE=5;   // сек без урона
  const ZONE_DMG_P=4;   // урон/сек игроку
  const ZONE_DMG_D=2;   // урон/сек боту (в 2 раза меньше)
  const ZONE_FADE=8;    // сек полного проявления затемнения

  function getZoneRadius(){
    return H*0.44;
  }
  function getZoneCenter(){
    return {x:W/2, y:H/2};
  }

  window.zoneActive=function(){ return _zoneActive; };

  window.toggleZone=function(){
    _zoneActive=!_zoneActive;
    _zoneTimer=0;
    const btn=document.getElementById('mob-zone-btn');
    if(btn) btn.classList.toggle('active', _zoneActive);
    if(typeof hitFX!=='undefined')
      hitFX.push({x:W/2,y:H/2-60,t:_zoneActive?'ЗОНА АКТИВНА':'ЗОНА ВЫКЛ',life:60,big:true,col:_zoneActive?'#ffaa30':'#888'});
  };

  var _pOutTime=0, _dOutTime=0; // время вне зоны

  window.updateZone=function(dt){
    if(!_zoneActive) return;
    _zoneTimer+=dt;
    if(_zoneTimer<=ZONE_GRACE) return;

    const c=getZoneCenter(), r=getZoneRadius();
    const ZONE_OUT_GRACE=1.0; // секунд вне зоны до начала урона

    // ── УРОН ИГРОКУ ──
    if(typeof P!=='undefined'){
      const d=Math.hypot(P.x-c.x, P.y-c.y);
      if(d>r){
        _pOutTime+=dt;
        if(_pOutTime>ZONE_OUT_GRACE){
          const zoneDmg = Math.round(ZONE_DMG_P * dt);
          
          // ════════════════════════════════════════════════════════════════
          // 🔥 ЕДИНЫЙ ВЫЗОВ applyDamage
          // ════════════════════════════════════════════════════════════════
          applyDamage(P, zoneDmg, null, {
            isMagic: false,
            isExplosion: false,
            knockbackMult: 0,
            hitstopFrames: 0,
            shakePower: 0,
            textColor: '#ff4444',
            textSuffix: '🔥',
            bloodCount: 2,
            playSound: true
          });
        }
      } else { _pOutTime=0; }
    }

    // ── УРОН БОТАМ ──
    if(typeof D!=='undefined' && typeof dummyOn!=='undefined' && dummyOn && !(typeof NET_SYNC!=='undefined' && NET_SYNC.active)){
      const d=Math.hypot(D.x-c.x, D.y-c.y);
      if(d>r){
        _dOutTime+=dt;
        if(_dOutTime>ZONE_OUT_GRACE){
          const zoneDmg = Math.round(ZONE_DMG_D * dt);
          
          // ════════════════════════════════════════════════════════════════
          // 🔥 ЕДИНЫЙ ВЫЗОВ applyDamage ДЛЯ БОТА
          // ════════════════════════════════════════════════════════════════
          applyDamage(D, zoneDmg, null, {
            isMagic: false,
            isExplosion: false,
            knockbackMult: 0,
            hitstopFrames: 0,
            shakePower: 0,
            textColor: '#ff4444',
            textSuffix: '🔥',
            bloodCount: 2,
            playSound: true
          });
        }
      } else { _dOutTime=0; }
    }
  };

  window.drawZone=function(){
    if(!_zoneActive) return;
    const c=getZoneCenter(), r=getZoneRadius();
    const fadeProgress=Math.min(1, Math.max(0, (_zoneTimer-ZONE_GRACE)/ZONE_FADE));
    const maxAlpha=0.72;
    const alpha=fadeProgress*maxAlpha;
    if(alpha<0.01) return;

    ctx.save();
    const grad=ctx.createRadialGradient(c.x,c.y,r*0.75, c.x,c.y,Math.max(W,H));
    grad.addColorStop(0, `rgba(0,0,0,0)`);
    grad.addColorStop(0.3, `rgba(0,0,0,${alpha*0.5})`);
    grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle=grad;
    ctx.fillRect(-10,-10,W+20,H+20);
    
    ctx.beginPath();
    ctx.arc(c.x,c.y,r,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,255,${alpha*0.15})`;
    ctx.lineWidth=1.5;
    ctx.stroke();
    ctx.restore();
  };

  // Кнопка арены на ПК — клавиша O/Щ
  document.addEventListener('keydown', e=>{
    if(e.key==='o'||e.key==='O'||e.key==='щ'||e.key==='Щ'){
      if(!(typeof gamePaused!=='undefined'&&gamePaused)) window.toggleZone();
    }
  });
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ БЛОК 9: ЗАПУСК И СОВМЕСТИМОСТЬ ══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
(function(){
  // Совместимость: window.NET для старого кода
  window.NET={ get active(){ return NET_SYNC.active; }, send:m=>NET_CORE.send(m) };

  // Не подключаемся автоматически — ждём явного выбора сервера пользователем
  // (см. кнопки "Основной"/"Запасной" в меню сети)
})();

