// === src/ui/mobile.js ===

// ════════════════════════════════════════════════════════════════════════════
// MODULE: MOBILE CONTROLS  (touch sticks, rotate prompt, pause/restart menu)
// Mobile controls are already isolated in this module.
// ════════════════════════════════════════════════════════════════════════════
(function(){
  // ── USE EARLY DETECT (see start of main script) ──────────────
  // Sticks and zones are mobile-only (guard inside each block)
  // Menu overlay works on all devices

  function applyOrientation(){
    const portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('is-portrait', portrait);
    if(!portrait){
      // Camera "zoomed out": aim for ~14 cells (55px) vertically, like on PC.
      // Increase the INTERNAL canvas resolution (logical world) beyond
      // the physical screen size — browser scales it down via CSS,
      // visually achieving "zoom out" without distorting object proportions.
      const targetRows = sv('camrows'); // adjustable cell count (55px) vertically
      const targetWorldH = targetRows * 55;
      const camScale = Math.max(1, targetWorldH / window.innerHeight);
      window.CAM_SCALE = camScale;

      H = Math.round(window.innerHeight * camScale);
      W = Math.round(window.innerWidth  * camScale);
      canvas.width  = W;
      canvas.height = H;
      applyCanvasSmoothing();
      arenaDirty = true;
      initBoxes();
    }
  }
  // Default camera on mobile — 12 cells (more compact than PC)
  const camSlider0 = document.getElementById('sl-camrows');
  if(camSlider0){
    camSlider0.value = 12;
    const camLabel0 = document.getElementById('vl-camrows');
    if(camLabel0) camLabel0.textContent = '12';
  }

  // ── AUTO FULLSCREEN ──────────────────────────────────────────────────────
  function requestFS(){
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        const p = el.requestFullscreen();
        if (p && p.catch) p.catch(()=>{});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    } catch(e){}
  }

  // Visible "Fullscreen" button — more reliable than auto-trigger on first tap
  // Start overlay is mobile-only
  if(window.IS_MOBILE){
    // Fullscreen "START" overlay — hides everything (canvas/UI/sticks) until launch
    const startOverlay = document.createElement('div');
    startOverlay.id = 'mob-start-overlay';
    startOverlay.style.cssText = 'position:fixed;inset:0;z-index:3000;'
      + 'background:#060a0e;display:flex;align-items:center;justify-content:center;'
      + 'flex-direction:column;gap:20px;';
    document.body.appendChild(startOverlay);

    const fsBtn = document.createElement('button');
    fsBtn.id = 'mob-fullscreen-btn';
    fsBtn.textContent = '▶ START';
    fsBtn.style.cssText = 'background:#ff4757;color:#fff;border:none;padding:18px 50px;'
      + 'font-size:18px;font-weight:bold;border-radius:30px;font-family:monospace;'
      + 'box-shadow:0 5px 15px rgba(255,71,87,0.4);letter-spacing:2px;';
    startOverlay.appendChild(fsBtn);

    // Hide game elements until START is pressed
    document.body.classList.add('mob-pregame');

    function hideFsBtn(){
      startOverlay.style.display = 'none';
      document.body.classList.remove('mob-pregame');
      // Recalculate sizes after fullscreen/browser bar change
      setTimeout(applyOrientation, 100);
      setTimeout(applyOrientation, 400); // repeat — in case of delayed bar hiding
    }

    fsBtn.addEventListener('touchend', e => {
      e.preventDefault();
      requestFS();
      hideFsBtn();
    }, {passive:false});
    fsBtn.addEventListener('click', () => { requestFS(); hideFsBtn(); });

    // If fullscreen is already active (or triggered) — hide the button
    document.addEventListener('fullscreenchange', () => {
      if(document.fullscreenElement) hideFsBtn();
      setTimeout(applyOrientation, 100);
    });
  }
  document.addEventListener('webkitfullscreenchange', () => {
    if(document.webkitFullscreenElement) hideFsBtn();
    setTimeout(applyOrientation, 100);
  });

  applyOrientation();
  window.addEventListener('resize', () => setTimeout(applyOrientation, 150));
  window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 150));
  // Rebuild camera when "Camera Range" slider changes
  const camSlider = document.getElementById('sl-camrows');
  if(camSlider) camSlider.addEventListener('input', applyOrientation);

  // ── SPAWN BOT ────────────────────────────────────────────────────────────
  const spawnBtn = document.getElementById('mob-spawn-btn');
  spawnBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    toggleAI();
    spawnBtn.textContent = '🤖';
    spawnBtn.style.borderColor = dummyOn ? '#4acc70' : '#1a4060';
  }, {passive: false});

  // ── BOT SHIELD (cycle shield type for bot) ───────────────────────────────
  const botShieldBtn = document.getElementById('mob-bot-shield-btn');
  botShieldBtn?.addEventListener('touchstart', e => {
    e.preventDefault();
    if(typeof D==='undefined' || typeof setShield!=='function') return;
    D.shield = (D.shield+1)%SHIELD_TYPES.length; setShield(D, D.shield);
  }, {passive: false});

  // ── BOT WEAPON (cycle weapon type for bot) ──────────────────────────────
  const botWeaponBtn = document.getElementById('mob-bot-weapon-btn');
  botWeaponBtn?.addEventListener('touchstart', e => {
    e.preventDefault();
    if(typeof D==='undefined' || typeof setWeapon!=='function') return;
    if(D.hasWeapon === false) return;
    D.weaponType = (D.weaponType+1)%WEAPON_TYPES.length; setWeapon(D, D.weaponType);
  }, {passive: false});

  // ── MENU (pause/restart/settings) ──────────────────────────────────────
  const shieldHoldBtn = document.getElementById('mob-shield-flip-btn');
  let shieldTouchId = null;
  let shieldSwordUnlockAt = 0;
  let shieldReleaseTimer = null;
  function setPlayerShieldHeld(held){
    if(typeof P==='undefined') return;
    P._shieldHeld = !!(held && P.shield>0 && !isExhausted(P) && P.stamina>0);
    if(P._shieldHeld) P._shieldHeldUntil = 0;
    shieldHoldBtn?.classList.toggle('active', P._shieldHeld);
  }
  function holdPlayerShieldUntil(until){
    if(typeof P==='undefined') return;
    P._shieldHeldUntil = Math.max(P._shieldHeldUntil || 0, until);
    P._shieldHeld = !!(P.shield>0 && !isExhausted(P) && P.stamina>0);
    shieldHoldBtn?.classList.toggle('active', P._shieldHeld);
  }
  function releasePlayerShieldDelayed(){
    if(shieldReleaseTimer) clearTimeout(shieldReleaseTimer);
    holdPlayerShieldUntil(GameTime + 0.5);
    const finishShieldRelease = () => {
      if(typeof P!=='undefined' && GameTime < (P._shieldHeldUntil || 0)){
        holdPlayerShieldUntil(P._shieldHeldUntil || 0);
        shieldReleaseTimer = setTimeout(finishShieldRelease, Math.max(16, ((P._shieldHeldUntil || 0) - GameTime) * 1000));
        return;
      }
      shieldReleaseTimer = null;
      setPlayerShieldHeld(false);
    };
    shieldReleaseTimer = setTimeout(finishShieldRelease, 500);
  }
  shieldHoldBtn?.addEventListener('touchstart', e => {
    e.preventDefault();
    if(shieldReleaseTimer){
      clearTimeout(shieldReleaseTimer);
      shieldReleaseTimer = null;
    }
    const t = e.changedTouches && e.changedTouches[0];
    if(t){
      shieldTouchId = t.identifier;
      shieldSwordUnlockAt = Date.now() + 300;
    }
    setPlayerShieldHeld(true);
  }, {passive:false});
  shieldHoldBtn?.addEventListener('touchend', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== shieldTouchId) continue;
      if(t.identifier === swordId) endSwordTouch();
      shieldTouchId = null;
      shieldSwordUnlockAt = 0;
    }
    releasePlayerShieldDelayed();
  }, {passive:false});
  shieldHoldBtn?.addEventListener('touchcancel', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== shieldTouchId) continue;
      if(t.identifier === swordId) endSwordTouch();
      shieldTouchId = null;
      shieldSwordUnlockAt = 0;
    }
    releasePlayerShieldDelayed();
  }, {passive:false});
  shieldHoldBtn?.addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== shieldTouchId) continue;
      if(t.identifier === swordId){
        if(controlMode==='fixed') updateSwordFixed(t.clientX, t.clientY);
        else updateSword(t.clientX, t.clientY);
      } else if(Date.now() >= shieldSwordUnlockAt && pointInElement(t.clientX, t.clientY, zoneSword)){
        startSwordTouchFromShield(t);
      }
    }
  }, {passive:false});

  const menuBtn = document.getElementById('mob-menu-btn');
  const menuOverlay = document.getElementById('mob-menu-overlay');
  const settingsEmbed = document.getElementById('mob-settings-embed');
  const toggleSettingsBtn = document.getElementById('mob-toggle-settings');
  let pausedByMenu = false;

  function doOpenMenu(){
    menuOverlay.classList.add('open');
    pausedByMenu = true;
    gamePaused = true;
    uiMenuPaused = true;
    AI.enabled = false;
  }
  menuBtn.addEventListener('touchstart', e=>{e.preventDefault();doOpenMenu();},{passive:false});
  menuBtn.addEventListener('click', doOpenMenu);

  window.doResume=function(){
    menuOverlay.classList.remove('open');
    pausedByMenu = false;
    uiMenuPaused = false;
    gamePaused = false;
    document.body.classList.remove('menu-open');
    if(!(typeof NET_SYNC!=='undefined'&&$.NET.active())) AI.enabled = true;
  }
  document.getElementById('mob-resume').addEventListener('touchstart', e=>{e.preventDefault();window.doResume();},{passive:false});
  document.getElementById('mob-resume').addEventListener('click', window.doResume);

window.doRestart=function(){
  if(typeof window.restartCombatRound === 'function'){
    window.restartCombatRound({ resetScore:true, enableAI:true });
    menuOverlay.classList.remove('open');
    pausedByMenu = false;
    uiMenuPaused = false;
    gamePaused = false;
    document.body.classList.remove('menu-open');
    return;
  }
  // Full state reset
  if(typeof resetWins==='function') resetWins();
  
  // 🗑️ SINGLE PLAYER RESET
  resetPlayerState();
  
  if(dummyOn){
    if(typeof applyBotCount==='function') applyBotCount();
    D.hp=100; D.stamina=0; D.rage=0; D._hadExhaustion=false;
    D.exhausted=0; D.unbalanced=0; D.vx=0; D.vy=0;
    D.x=W*0.8; D.y=H*0.2;
    D._wasExhausted = false;
    D._recovering = false;
    D._recoverProgress = 0;
    D._swingBlockCD = -1;
    D._exhaustedEndTime = 0;
    if(D._wandCharging) { D._wandCharging = false; if(D._wandChargeSoundObj) { try{D._wandChargeSoundObj.pause();}catch(e){} D._wandChargeSoundObj = null; } }
    if(D._magicCharging) { D._magicCharging = false; if(D._magicChargeSoundObj) { try{D._magicChargeSoundObj.pause();}catch(e){} D._magicChargeSoundObj = null; } }
    if(D._bowCharging) { D._bowCharging = false; if(D._bowTensionSound) { try{D._bowTensionSound.pause();}catch(e){} D._bowTensionSound = null; } }
    if(D.hasWeapon===false && typeof setWeapon==='function') setWeapon(D, D.weaponType);
    
    for(const _b of ALL_BOTS){
      if(_b === D) continue;
      _b.hp=100; _b.stamina=100; _b.rage=0; _b.exhausted=0; _b.unbalanced=0;
      _b.vx=0; _b.vy=0;
      _b._wasExhausted = false;
      _b._recovering = false;
      _b._recoverProgress = 0;
      if(_b._wandCharging) { _b._wandCharging = false; if(_b._wandChargeSoundObj) { try{_b._wandChargeSoundObj.pause();}catch(e){} _b._wandChargeSoundObj = null; } }
      if(_b._magicCharging) { _b._magicCharging = false; if(_b._magicChargeSoundObj) { try{_b._magicChargeSoundObj.pause();}catch(e){} _b._magicChargeSoundObj = null; } }
      if(_b._bowCharging) { _b._bowCharging = false; if(_b._bowTensionSound) { try{_b._bowTensionSound.pause();}catch(e){} _b._bowTensionSound = null; } }
      if(_b.hasWeapon===false && typeof setWeapon==='function') setWeapon(_b, _b.weaponType);
    }
  }
  
  DEATH.dDead=false; DEATH.pDead=false; DEATH.fadeIn=false; DEATH.fadeAlpha=0; DEATH.text='';
  menuOverlay.classList.remove('open');
  pausedByMenu = false;
  uiMenuPaused = false;
  gamePaused = false;
  document.body.classList.remove('menu-open');
  AI.enabled = true;
}
  document.getElementById('mob-restart').addEventListener('touchstart', e=>{e.preventDefault();window.doRestart();},{passive:false});
  document.getElementById('mob-restart').addEventListener('click', window.doRestart);

  window.doOpenSettings=function(){
    const settOv = document.getElementById('mob-settings-overlay');
    if(!settOv) return;
    const playerSec = document.getElementById('sec-local-players');
    const camSec = document.getElementById('sec-mobile-cam');
    if(playerSec && playerSec.parentElement !== settingsEmbed) settingsEmbed.appendChild(playerSec);
    if(camSec && camSec.parentElement !== settingsEmbed) settingsEmbed.appendChild(camSec);
    if(playerSec) playerSec.style.display = 'block';
    if(camSec) camSec.style.display = 'block';
    settingsEmbed.style.display = 'block';
    settOv.style.display = 'flex';
  }
  toggleSettingsBtn.addEventListener('touchstart', e=>{e.preventDefault();window.doOpenSettings();},{passive:false});
  toggleSettingsBtn.addEventListener('click', window.doOpenSettings);

  document.getElementById('mob-settings-close')?.addEventListener('touchstart', e=>{
    e.preventDefault();
    document.getElementById('mob-settings-overlay').style.display = 'none';
  }, {passive:false});
  document.getElementById('mob-settings-close')?.addEventListener('click', ()=>{
    document.getElementById('mob-settings-overlay').style.display = 'none';
  });


  // fireDodge — works on all devices (PC + mobile)
  window.fireDodge=function(dx, dy, bypassCooldown, chargedPower){
    if(typeof P==='undefined') return;
    if(!bypassCooldown&&window._dodgeCooldownMob>0) return;
    const len=Math.hypot(dx,dy)||1;
    const charge = Math.max(0, Math.min(1, chargedPower || 0));
    const force=8 + charge * 7;
    P._dvx=(dx/len)*force;
    P._dvy=(dy/len)*force;
    // "Active dodge" window — during it, swings don't cost stamina
    P._dodgeActiveUntil = GameTime + 0.3 + charge * 0.12;
    if(charge >= 0.5){
      P._shieldDashBashActiveUntil = P._dodgeActiveUntil + 0.15;
      P._shieldDashChargePower = charge;
      P._shieldDashDirX = dx / len;
      P._shieldDashDirY = dy / len;
    }
    if((typeof shieldHeld === 'function' && shieldHeld(P)) || GameTime < (P._shieldHeldUntil || 0)){
      holdPlayerShieldUntil(P._dodgeActiveUntil + 0.5);
    }
    // Dodge cooldown: if shield is on the same side as sword — cooldown is 3x longer
    const _dodgeSameSide = typeof shieldDef==='function' && shieldDef(P) && shieldSameSideAsSword(P);
    window._dodgeCooldownMob = _dodgeSameSide ? 0.8*3 : 0.8;
    if(P.stamina!==undefined) drainStamina(P, 30 + charge * 15);
    if(typeof spawnDust==='function')
      for(let i=0;i<8 + Math.round(charge * 10);i++) spawnDust(P.x+Math.random()*24-12,P.y+Math.random()*12,-dx/len*(8 + charge*5),-dy/len*(8 + charge*5));
    $.S.play('dodgeSound');
    if(typeof DODGE_TRAIL==='undefined') window.DODGE_TRAIL=[];
    window._dodgeTrailFrames=12 + Math.round(charge * 12);
    if(typeof hitFX!=='undefined') $.FX.hit({x:P.x,y:P.y-30,t:charge>=0.5?(window.I18N ? window.I18N.t('runtime.fxShieldBash') : 'SHIELD BASH'):(window.I18N ? window.I18N.t('common.dodge') : 'DODGE'),life:35,big:charge>=0.5,col:charge>=0.5?'#60ccff':'rgba(200,200,200,0.6)'});
    if(charge > 0 && typeof FX_EFFECTS!=='undefined'){
      FX_EFFECTS.push({type:'shieldwave', x:P.x, y:P.y, t:0, duration:24, angle:Math.atan2(dy, dx), followEntity:P, followShield:true, cursorX:mX});
      FX_EFFECTS.push({type:'shieldwave', x:P.x, y:P.y, t:0, duration:18, angle:Math.atan2(dy, dx), followEntity:P, followShield:true, cursorX:mX});
    }
    // Dodge with shield in the correct hand → bladeblind + knockback
    // Only if moving TOWARD the target (not running away)
    if(false && typeof shieldDef==='function' && shieldDef(P) && typeof shieldHeld==='function' && shieldHeld(P)){
      const _dt2=(typeof D!=='undefined'&&dummyOn)?D:null;
      if(_dt2){
        const _ax=_dt2.x-P.x, _ay=_dt2.y-P.y;
        const _dist=Math.hypot(_ax,_ay);
        const _al=_dist||1;
        // Check that we're moving TOWARD target: dot(dodge_dir, to_target) > 0
        const _movingToward = (dx/_al)*(_ax/_al) + (dy/_al)*(_ay/_al);
        if(_dist<180 && _movingToward>0.3){
          _dt2.vx+=_ax/_al*4; _dt2.vy+=_ay/_al*4;
// Spiked shield — same bonus body damage as in the main bash (update())
const _shDefBash2 = shieldDef(P);
const _spiked2 = _shDefBash2 && _shDefBash2.spiked;
if(_spiked2 && typeof GameTime!=='undefined'){
  const spikeDmg2 = _shDefBash2.spikeDmg || 12;
  
  // ════════════════════════════════════════════════════════════════════
  // 🔥 UNIFIED applyDamage CALL
  // ════════════════════════════════════════════════════════════════════
  applyDamage(_dt2, spikeDmg2, P, {
    isMagic: false,
    isExplosion: false,
    knockbackMult: 0.3,
    hitstopFrames: 3,
    shakePower: 4,
    textColor: '#ff6644',
    textSuffix: '🛡',
    bloodCount: 6,
    playSound: false // sound played separately
  });
  
  // ── ADDITIONAL EFFECTS (dodge-specific) ──
  $.FX.hit({x:_dt2.x, y:_dt2.y-52, t:'-'+spikeDmg2, life:40, big:false});
  if(typeof spawnBlood==='function') spawnBlood(_dt2.x, _dt2.y, _ax/_al, _ay/_al);
  $.S.play('damageHammer');
  
  if(_dt2.hp<=0 && typeof handleCombatDeath==='function') handleCombatDeath(_dt2);
}
          $.FX.hit({x:_dt2.x,y:_dt2.y-30,t: _spiked2?(window.I18N?window.I18N.t('main.spikedBash'):'???? SPIKE BASH!'):(window.I18N?window.I18N.t('main.bash'):'?? BASH!'),life:45,big:false,col:'#60ccff'});
        }
      }
    }
  };
  window._dodgeCooldownMob=0;

  // Control button — on PC shows keybind help
  document.getElementById('mob-control-mode-btn')?.addEventListener('click', ()=>{
    if(window.IS_MOBILE) return; // mobile handled below
    const settOv=document.getElementById('mob-settings-overlay');
    if(!settOv) return;
    const embed=document.getElementById('mob-settings-embed');
    if(embed){
      // Real sliders (sec-mobile-cam) may have been moved here via
      // doOpenSettings — park them outside so innerHTML= doesn't delete them permanently
      const camSec = document.getElementById('sec-mobile-cam');
      const playerSec = document.getElementById('sec-local-players');
      if(playerSec && playerSec.parentElement === embed){
        playerSec.style.display = 'none';
        document.body.appendChild(playerSec);
      }
      if(camSec && camSec.parentElement === embed){
        camSec.style.display = 'none';
        document.body.appendChild(camSec);
      }
      embed.innerHTML=`<div style="font-family:monospace;font-size:13px;color:#8ab8c8;line-height:2.2;padding:8px 0;">
      <b style="color:#4acc80;letter-spacing:2px;">CONTROLS (PC)</b><br>
      <span style="color:#6ab0d0;">WASD</span> — movement<br>
      <span style="color:#6ab0d0;">Mouse</span> — sword / aim<br>
      <span style="color:#6ab0d0;">LMB</span> — hold sword in position<br>
      <span style="color:#6ab0d0;">Shift</span> — DODGE<br>
      <span style="color:#6ab0d0;">T</span> — spawn bot<br>
      <span style="color:#6ab0d0;">E</span> — AI on/off<br>
      <span style="color:#6ab0d0;">O / Щ</span> — arena zone<br>
      <span style="color:#6ab0d0;">Enter</span> — pause menu<br>
      <span style="color:#6ab0d0;">Esc</span> — close menu
    </div>`;
    }
    settOv.style.display='flex';
  });

  // On PC — sticks, start screen and orientation are not needed
  if(!window.IS_MOBILE) return;

  // ── FLOATING JOYSTICKS ──────────────────────────────────────────────────
  const zoneMove  = document.getElementById('zone-move');
  const zoneSword = document.getElementById('zone-sword');
  const moveBase  = document.getElementById('move-base');
  const moveKnob  = document.getElementById('move-knob');
  const swordBase = document.getElementById('sword-base');
  const swordKnob = document.getElementById('sword-knob');

  const MOVE_R  = 55;
  const SWORD_R = 75;

  let moveId = null, moveOrigin = {x:0,y:0};
  let swordId = null, swordOrigin = {x:0,y:0};
  let lastSwordTap = 0;
  let doubleTapLMB = false;
  let _crossbowTapPending = false; // crossbow tap — shot happens on touchend

  function pointInElement(x, y, el){
    if(!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function startSwordTouchFromShield(t){
    if(!t || swordId !== null) return;
    enableAudioSystem();
    swordId = t.identifier;
    if(controlMode==='fixed'){
      updateSwordFixed(t.clientX, t.clientY);
    } else {
      swordOrigin = {x: t.clientX, y: t.clientY};
      swordBase.style.left = swordOrigin.x+'px';
      swordBase.style.top  = swordOrigin.y+'px';
      swordBase.classList.add('active');
      updateSword(t.clientX, t.clientY);
    }
  }

  function endSwordTouch(){
    swordId = null;
    if(controlMode==='fixed'){
      fixedStickKnob.style.left='65px'; fixedStickKnob.style.top='65px';
    } else {
      swordBase.classList.remove('active');
      updateSwordKnob(0,0);
    }
    if(_crossbowTapPending){
      _crossbowTapPending = false;
      mDown = true;
      requestAnimationFrame(() => { mDown = false; });
    }
    const _wk2 = typeof weaponKeyOf==='function' && typeof P!=='undefined' ? weaponKeyOf(P) : null;
    if(doubleTapLMB || _wk2 === 'bow'){
      doubleTapLMB = false;
      mDown = false;
      swordKnob.classList.remove('lmb-active');
      fixedStickKnob.classList.remove('lmb-active');
    }
  }

  // ── LEFT — movement ──────────────────────────────────────────────────────
  // Get zone offset relative to screen (once)
  function getZoneOffset(zone){
    const r=zone.getBoundingClientRect();
    return {x:r.left, y:r.top};
  }

  zoneMove.addEventListener('touchstart', e => {
    // Don't intercept touch if it hits a button on top of the zone
    // (shield/weapon/throw etc. sit in the upper part of the left movement zone)
    if(e.target.closest('button')) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    if(moveId !== null) return;
    moveId = t.identifier;
    const zo = getZoneOffset(zoneMove);
    moveOrigin = {x: t.clientX - zo.x, y: t.clientY - zo.y};
    updateMoveKnob(0,0);
    moveBase.classList.add('active');
  }, {passive:false});

  zoneMove.addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== moveId) continue;
      const zo = getZoneOffset(zoneMove);
      const lx = t.clientX - zo.x;
      const ly = t.clientY - zo.y;
      const dx = lx - moveOrigin.x;
      const dy = ly - moveOrigin.y;
      const dist = Math.hypot(dx,dy);
      const nx = dist>MOVE_R ? dx/dist*MOVE_R : dx;
      const ny = dist>MOVE_R ? dy/dist*MOVE_R : dy;
      updateMoveKnob(nx,ny);
      const dead = 8;
      keys['w']=ny<-dead; keys['s']=ny>dead;
      keys['a']=nx<-dead; keys['d']=nx>dead;
    }
  }, {passive:false});

  zoneMove.addEventListener('touchend', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== moveId) continue;
      moveId = null;
      moveBase.classList.remove('active');
      updateMoveKnob(0,0,false);
      keys['w']=keys['s']=keys['a']=keys['d']=false;
    }
  }, {passive:false});

  function updateMoveKnob(dx,dy,show=true){
    moveBase.style.left = moveOrigin.x+'px';
    moveBase.style.top  = moveOrigin.y+'px';
    moveKnob.style.left = (moveOrigin.x+dx)+'px';
    moveKnob.style.top  = (moveOrigin.y+dy)+'px';
    moveKnob.style.visibility = show?'visible':'hidden';
  }

  // ── SWORD CONTROL MODE: floating (default) / fixed (visible stick) ──
  const fixedStickBase = document.getElementById('fixed-stick-base');
  const fixedStickKnob = document.getElementById('fixed-stick-knob');
  const fixedStickReticle = document.getElementById('fixed-stick-reticle');
  let controlMode = localStorage.getItem('gg_control_mode') || 'floating';

  function applyControlMode(){
    document.body.classList.toggle('fixed-stick-mode', controlMode==='fixed');
    // control button text doesn't change
    if(controlMode==='fixed') positionFixedStick();
  }

  function positionFixedStick(){
    // Bottom-right corner of the screen, with padding
    const r = 65; // half of fixed stick width (130px/2)
    const x = window.innerWidth - r - 40;
    const y = window.innerHeight - r - 40;
    fixedStickBase.style.left = x+'px';
    fixedStickBase.style.top  = y+'px';
    fixedStickBase.style.transform = 'translate(-50%,-50%)';
    fixedStickOrigin = {x, y};
  }

  let fixedStickOrigin = {x:0,y:0};
  window.addEventListener('resize', ()=>{ if(controlMode==='fixed') positionFixedStick(); });

  document.getElementById('mob-control-mode-btn')?.addEventListener('click', ()=>{
    if(window.IS_MOBILE){
      controlMode = controlMode==='floating' ? 'fixed' : 'floating';
      localStorage.setItem('gg_control_mode', controlMode);
      applyControlMode();
    } else {
      // On PC — show keybind help
      const settOv=document.getElementById('mob-settings-overlay');
      if(!settOv) return;
      const embed=document.getElementById('mob-settings-embed');
      if(embed){
        // Don't delete real sliders (sec-mobile-cam) if they're currently inside embed
        const camSec = document.getElementById('sec-mobile-cam');
        const playerSec = document.getElementById('sec-local-players');
        if(playerSec && playerSec.parentElement === embed){
          playerSec.style.display = 'none';
          document.body.appendChild(playerSec);
        }
        if(camSec && camSec.parentElement === embed){
          camSec.style.display = 'none';
          document.body.appendChild(camSec);
        }
        embed.innerHTML=`<div style="font-family:monospace;font-size:12px;color:#8ab8c8;line-height:2;padding:8px;">
        <b style="color:#6ab0d0;">CONTROLS (PC)</b><br>
        WASD — movement<br>
        Mouse — sword/aim<br>
        LMB — hold sword<br>
        Shift — DODGE<br>
        T — spawn bot<br>
        E — AI on/off<br>
        O/Щ — arena zone<br>
        Enter — menu<br>
        Esc — close
      </div>`;
      }
      settOv.style.display='flex';
    }
  });

  applyControlMode();

  // updateSwordFixed — direction from CENTER of the fixed stick to the finger,
  // the aim rotates at a constant distance from the character in that direction.
  // Unlike floating mode, the stick doesn't move with the finger — it's
  // always in place, and it processes the ANGLE (direction), not offset.
  const FIXED_RETICLE_R = 50; // aim distance from stick center (px, visual)
  function updateSwordFixed(cx, cy){
    const dx = cx - fixedStickOrigin.x;
    const dy = cy - fixedStickOrigin.y;
    const dist = Math.hypot(dx,dy);
    const angle = Math.atan2(dy,dx);

    // Knob moves slightly in the finger direction (visual feedback), but limited to small radius
    const knobR = Math.min(dist, 30);
    fixedStickKnob.style.left = (65+Math.cos(angle)*knobR)+'px';
    fixedStickKnob.style.top  = (65+Math.sin(angle)*knobR)+'px';

    // Reticle is always at fixed distance FIXED_RETICLE_R, rotates by angle
    fixedStickReticle.style.left = (65+Math.cos(angle)*FIXED_RETICLE_R)+'px';
    fixedStickReticle.style.top  = (65+Math.sin(angle)*FIXED_RETICLE_R)+'px';

    // Apply direction to player aiming (mX/mY) — crosshair far from the character
    // at the same angle, distance doesn't depend on finger offset strength (only direction)
    if(dist > 8){ // dead zone to prevent micro-touch jitter
      const rc = $.POS.root();
      const aimRadius = Math.min(W,H)*0.35;
      mX = rc.x + Math.cos(angle)*aimRadius;
      mY = rc.y + Math.sin(angle)*aimRadius;
    }
  }

  // ── RIGHT — sword / aim ────────────────────────────────────────────────
  zoneSword.addEventListener('touchstart', e => {
    // Don't intercept touch if it hits a button on top of the zone
    // (combat style/dodge/arena zone etc. sit in the upper part of the right zone)
    if(e.target.closest('button')) return;
    e.preventDefault();
    enableAudioSystem();
    if(swordId !== null) return;
    const t = e.changedTouches[0];

    // ── Bow: single tap immediately draws (mDown=true, release — shot).
    // Crossbow: shot should happen exactly on TOUCH RELEASE
    // (like trigger pull), so here mDown is NOT set — only
    // mark that a crossbow tap happened, and shoot on touchend.
    // Magic staff and wand require holding and stay on double tap, same as
    // melee — otherwise they'd trigger on accidental taps.
    const _wk = typeof weaponKeyOf==='function' ? weaponKeyOf(P) : null;
    const _rangedTap = (_wk === 'bow' || _wk === 'crossbow');
    if(_wk === 'bow'){
      mDown = true;
      swordKnob.classList.add('lmb-active');
      fixedStickKnob.classList.add('lmb-active');
    } else if(_wk === 'crossbow'){
      _crossbowTapPending = true;
    } else {
      const now = Date.now();
      if(now - lastSwordTap < 300){
        // Double tap: LMB held WHILE finger is down, release — released
        doubleTapLMB = true;
        mDown = true;
        swordKnob.classList.add('lmb-active');
        fixedStickKnob.classList.add('lmb-active');
      }
      lastSwordTap = now;
    }

    swordId = t.identifier;

    if(controlMode==='fixed'){
      // Fixed mode: stick is already in place, don't move the base
      updateSwordFixed(t.clientX, t.clientY);
    } else {
      // Floating mode: appears at touch point
      swordOrigin = {x: t.clientX, y: t.clientY};
      swordBase.style.left = swordOrigin.x+'px';
      swordBase.style.top  = swordOrigin.y+'px';
      swordBase.classList.add('active');
      updateSword(t.clientX, t.clientY);
    }

    // Single tap does NOT activate LMB for melee — only controls the sword
    // Double tap toggles LMB mode (latch). For bow —
    // single tap already draws (see above). For crossbow — shoots
    // on release (see touchend).
  }, {passive:false});

  zoneSword.addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== swordId) continue;
      if(controlMode==='fixed') updateSwordFixed(t.clientX, t.clientY);
      else updateSword(t.clientX, t.clientY);
    }
  }, {passive:false});

  zoneSword.addEventListener('touchend', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== swordId) continue;
      endSwordTouch();
    }
  }, {passive:false});

  function updateSword(cx, cy){
    const dx = cx - swordOrigin.x;
    const dy = cy - swordOrigin.y;
    const dist = Math.hypot(dx,dy);
    const nx = dist>SWORD_R ? dx/dist*SWORD_R : dx;
    const ny = dist>SWORD_R ? dy/dist*SWORD_R : dy;
    updateSwordKnob(nx,ny);

    const rc = $.POS.root();
    const aimRadius = Math.min(W,H)*0.35;
    const normX = nx/SWORD_R, normY = ny/SWORD_R;
    if(Math.hypot(normX,normY) > 0.05){
      mX = rc.x + normX*aimRadius;
      mY = rc.y + normY*aimRadius;
    }
  }

  function updateSwordKnob(dx,dy){
    swordKnob.style.left = (swordOrigin.x+dx)+'px';
    swordKnob.style.top  = (swordOrigin.y+dy)+'px';
    swordBase.style.left = swordOrigin.x+'px';
    swordBase.style.top  = swordOrigin.y+'px';
  }

  // Prevent scroll/zoom
  document.addEventListener('touchmove', e => { if(e.cancelable) e.preventDefault(); }, {passive:false});
  document.addEventListener('gesturestart', e => e.preventDefault());
})();
// ════════════════ END MODULE: MOBILE CONTROLS ═══════════════════════════════
