// === src/ui/mobile.js ===

// ════════════════════════════════════════════════════════════════════════════
// MODULE: MOBILE CONTROLS  (touch sticks, rotate prompt, pause/restart menu)
// Mobile controls are already isolated in this module.
// ════════════════════════════════════════════════════════════════════════════
(function(){
  // ── ИСПОЛЬЗУЕМ РАННИЙ ДЕТЕКТ (см. начало основного скрипта) ──────────────
  // Стики и зоны только для мобиля (guard внутри каждого блока)
  // Меню оверлей работает на всех устройствах

  function applyOrientation(){
    const portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('is-portrait', portrait);
    if(!portrait){
      // Камера "отдалена": целимся в ~14 клеток (55px) по вертикали, как на ПК.
      // Увеличиваем ВНУТРЕННЕЕ разрешение canvas (логический мир) сверх
      // физического размера экрана — браузер сжимает картинку через CSS,
      // визуально получаем "зум аут" без искажения пропорций объектов.
      const targetRows = sv('camrows'); // настраиваемое кол-во клеток (55px) по вертикали
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
  // Дефолт камеры на мобиле — 12 клеток (компактнее чем на ПК)
  const camSlider0 = document.getElementById('sl-camrows');
  if(camSlider0){
    camSlider0.value = 12;
    const camLabel0 = document.getElementById('vl-camrows');
    if(camLabel0) camLabel0.textContent = '12';
  }

  // ── АВТОФУЛЛСКРИН ──────────────────────────────────────────────────────
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

  // Видимая кнопка "На весь экран" — надёжнее чем авто-триггер на первый тап
  // Старт-оверлей только на мобиле
  if(window.IS_MOBILE){
    // Полноэкранный оверлей "СТАРТ" — скрывает всё (canvas/UI/стики) до запуска
    const startOverlay = document.createElement('div');
    startOverlay.id = 'mob-start-overlay';
    startOverlay.style.cssText = 'position:fixed;inset:0;z-index:3000;'
      + 'background:#060a0e;display:flex;align-items:center;justify-content:center;'
      + 'flex-direction:column;gap:20px;';
    document.body.appendChild(startOverlay);

    const fsBtn = document.createElement('button');
    fsBtn.id = 'mob-fullscreen-btn';
    fsBtn.textContent = '▶ СТАРТ';
    fsBtn.style.cssText = 'background:#ff4757;color:#fff;border:none;padding:18px 50px;'
      + 'font-size:18px;font-weight:bold;border-radius:30px;font-family:monospace;'
      + 'box-shadow:0 5px 15px rgba(255,71,87,0.4);letter-spacing:2px;';
    startOverlay.appendChild(fsBtn);

    // Скрываем игровые элементы пока не нажат СТАРТ
    document.body.classList.add('mob-pregame');

    function hideFsBtn(){
      startOverlay.style.display = 'none';
      document.body.classList.remove('mob-pregame');
      // Пересчёт размеров после смены fullscreen/баров браузера
      setTimeout(applyOrientation, 100);
      setTimeout(applyOrientation, 400); // повторно — на случай задержки скрытия баров
    }

    fsBtn.addEventListener('touchend', e => {
      e.preventDefault();
      requestFS();
      hideFsBtn();
    }, {passive:false});
    fsBtn.addEventListener('click', () => { requestFS(); hideFsBtn(); });

    // Если fullscreen уже активен (или сработал) — скрываем кнопку
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
  // Перестроить камеру при изменении ползунка "Дальность камеры"
  const camSlider = document.getElementById('sl-camrows');
  if(camSlider) camSlider.addEventListener('input', applyOrientation);

  // ── СПАВН БОТА ────────────────────────────────────────────────────────────
  const spawnBtn = document.getElementById('mob-spawn-btn');
  spawnBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    toggleAI();
    spawnBtn.textContent = '🤖';
    spawnBtn.style.borderColor = dummyOn ? '#4acc70' : '#1a4060';
  }, {passive: false});

  // ── ЩИТ БОТА (переключение типа щита у бота) ───────────────────────────────
  const botShieldBtn = document.getElementById('mob-bot-shield-btn');
  botShieldBtn?.addEventListener('touchstart', e => {
    e.preventDefault();
    if(typeof D==='undefined' || typeof setShield!=='function') return;
    D.shield = (D.shield+1)%SHIELD_TYPES.length; setShield(D, D.shield);
  }, {passive: false});

  // ── ОРУЖИЕ БОТА (переключение вида оружия у бота) ───────────────────────
  const botWeaponBtn = document.getElementById('mob-bot-weapon-btn');
  botWeaponBtn?.addEventListener('touchstart', e => {
    e.preventDefault();
    if(typeof D==='undefined' || typeof setWeapon!=='function') return;
    if(D.hasWeapon === false) return;
    D.weaponType = (D.weaponType+1)%WEAPON_TYPES.length; setWeapon(D, D.weaponType);
  }, {passive: false});

  // ── МЕНЮ (пауза/рестарт/настройки) ──────────────────────────────────────
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
    if(!(typeof NET_SYNC!=='undefined'&&NET_SYNC.active)) AI.enabled = true;
  }
  document.getElementById('mob-resume').addEventListener('touchstart', e=>{e.preventDefault();window.doResume();},{passive:false});
  document.getElementById('mob-resume').addEventListener('click', window.doResume);

window.doRestart=function(){
  // Полный ресет состояния
  if(typeof resetWins==='function') resetWins();
  
  // 🗑️ ЕДИНЫЙ СБРОС ИГРОКА
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
    const camSec = document.getElementById('sec-mobile-cam');
    if(camSec && camSec.parentElement !== settingsEmbed) settingsEmbed.appendChild(camSec);
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


  // fireDodge — работает на всех устройствах (ПК + мобиль)
  window.fireDodge=function(dx, dy, bypassCooldown){
    if(typeof P==='undefined') return;
    if(!bypassCooldown&&window._dodgeCooldownMob>0) return;
    const len=Math.hypot(dx,dy)||1;
    const force=8;
    P._dvx=(dx/len)*force;
    P._dvy=(dy/len)*force;
    // Окно "активного доджа" — во время него взмахи не тратят стамину
    P._dodgeActiveUntil = GameTime + 0.3;
    // Кулдаун доджа: если щит в той же руке что меч — перезарядка в 3 раза дольше
    const _dodgeSameSide = typeof shieldDef==='function' && shieldDef(P) && shieldSameSideAsSword(P);
    window._dodgeCooldownMob = _dodgeSameSide ? 0.8*3 : 0.8;
    if(P.stamina!==undefined) P.stamina=Math.max(0,P.stamina-30);
    if(typeof spawnDust==='function')
      for(let i=0;i<8;i++) spawnDust(P.x+Math.random()*24-12,P.y+Math.random()*12,-dx/len*8,-dy/len*8);
    playSound('dodgeSound');
    if(typeof DODGE_TRAIL==='undefined') window.DODGE_TRAIL=[];
    window._dodgeTrailFrames=12;
    if(typeof hitFX!=='undefined') hitFX.push({x:P.x,y:P.y-30,t:'DODGE',life:35,big:false,col:'rgba(200,200,200,0.6)'});
    // Додж со щитом в правильной руке → bladeblind + отброс
    // Только если двигаемся К цели (не убегаем)
    if(typeof shieldDef==='function' && shieldDef(P) && !shieldSameSideAsSword(P)){
      const _dt2=(typeof D!=='undefined'&&dummyOn)?D:null;
      if(_dt2){
        const _ax=_dt2.x-P.x, _ay=_dt2.y-P.y;
        const _dist=Math.hypot(_ax,_ay);
        const _al=_dist||1;
        // Проверяем что движемся К цели: dot(dodge_dir, to_target) > 0
        const _movingToward = (dx/_al)*(_ax/_al) + (dy/_al)*(_ay/_al);
        if(_dist<180 && _movingToward>0.3){
          if(typeof triggerBladeBind==='function') triggerBladeBind(P,_dt2);
          _dt2.vx+=_ax/_al*4; _dt2.vy+=_ay/_al*4;
// Шипастый щит — тот же доп. урон телом, что и в основном баше (update())
const _shDefBash2 = shieldDef(P);
const _spiked2 = _shDefBash2 && _shDefBash2.spiked;
if(_spiked2 && typeof GameTime!=='undefined'){
  const spikeDmg2 = _shDefBash2.spikeDmg || 12;
  
  // ════════════════════════════════════════════════════════════════════
  // 🔥 ЕДИНЫЙ ВЫЗОВ applyDamage
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
    playSound: false // звук воспроизводим отдельно
  });
  
  // ── ДОПОЛНИТЕЛЬНЫЕ ЭФФЕКТЫ (специфичные для доджа) ──
  hitFX.push({x:_dt2.x, y:_dt2.y-52, t:'-'+spikeDmg2, life:40, big:false});
  if(typeof spawnBlood==='function') spawnBlood(_dt2.x, _dt2.y, _ax/_al, _ay/_al);
  playSound('damageHammer');
  
  if(_dt2.hp<=0 && typeof handleCombatDeath==='function') handleCombatDeath(_dt2);
}
          hitFX.push({x:_dt2.x,y:_dt2.y-30,t: _spiked2?'🗡🛡 ШИП-БАШ!':'🛡 BIND!',life:45,big:false,col:'#60ccff'});
        }
      }
    }
  };
  window._dodgeCooldownMob=0;

  // Кнопка управления — на ПК показывает справку по клавишам
  document.getElementById('mob-control-mode-btn')?.addEventListener('click', ()=>{
    if(window.IS_MOBILE) return; // мобиль обрабатывается ниже
    const settOv=document.getElementById('mob-settings-overlay');
    if(!settOv) return;
    const embed=document.getElementById('mob-settings-embed');
    if(embed){
      // Настоящие слайдеры (sec-mobile-cam) могли быть перемещены сюда через
      // doOpenSettings — паркуем их снаружи, чтобы innerHTML= их не удалил насовсем
      const camSec = document.getElementById('sec-mobile-cam');
      if(camSec && camSec.parentElement === embed){
        camSec.style.display = 'none';
        document.body.appendChild(camSec);
      }
      embed.innerHTML=`<div style="font-family:monospace;font-size:13px;color:#8ab8c8;line-height:2.2;padding:8px 0;">
      <b style="color:#4acc80;letter-spacing:2px;">УПРАВЛЕНИЕ (ПК)</b><br>
      <span style="color:#6ab0d0;">WASD</span> — движение<br>
      <span style="color:#6ab0d0;">Мышь</span> — меч / прицел<br>
      <span style="color:#6ab0d0;">ЛКМ</span> — удержать меч в позиции<br>
      <span style="color:#6ab0d0;">Shift</span> — ДОДЖ<br>
      <span style="color:#6ab0d0;">T</span> — спавн бота<br>
      <span style="color:#6ab0d0;">E</span> — AI вкл / выкл<br>
      <span style="color:#6ab0d0;">O / Щ</span> — зона арены<br>
      <span style="color:#6ab0d0;">Enter</span> — меню паузы<br>
      <span style="color:#6ab0d0;">Esc</span> — закрыть меню
    </div>`;
    }
    settOv.style.display='flex';
  });

  // На ПК — стики, старт-экран и ориентация не нужны
  if(!window.IS_MOBILE) return;

  // ── ПЛАВАЮЩИЕ ДЖОЙСТИКИ ──────────────────────────────────────────────────
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
  let _crossbowTapPending = false; // тап по арбалету — выстрел произойдёт на touchend

  // ── ЛЕВЫЙ — движение ──────────────────────────────────────────────────────
  // Получаем смещение зоны относительно экрана (один раз)
  function getZoneOffset(zone){
    const r=zone.getBoundingClientRect();
    return {x:r.left, y:r.top};
  }

  zoneMove.addEventListener('touchstart', e => {
    // Не перехватываем касание, если оно попало по кнопке поверх зоны
    // (щит/оружие/бросок и т.п. лежат в верхней части левой зоны движения)
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

  // ── РЕЖИМ УПРАВЛЕНИЯ МЕЧОМ: floating (по умолчанию) / fixed (видимый стик) ──
  const fixedStickBase = document.getElementById('fixed-stick-base');
  const fixedStickKnob = document.getElementById('fixed-stick-knob');
  const fixedStickReticle = document.getElementById('fixed-stick-reticle');
  let controlMode = localStorage.getItem('gg_control_mode') || 'floating';

  function applyControlMode(){
    document.body.classList.toggle('fixed-stick-mode', controlMode==='fixed');
    // кнопка управления — текст не меняем
    if(controlMode==='fixed') positionFixedStick();
  }

  function positionFixedStick(){
    // Правый нижний угол экрана, с отступом
    const r = 65; // половина width фиксированного стика (130px/2)
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
      // На ПК — показываем справку по клавишам
      const settOv=document.getElementById('mob-settings-overlay');
      if(!settOv) return;
      const embed=document.getElementById('mob-settings-embed');
      if(embed){
        // Не удаляем настоящие слайдеры (sec-mobile-cam), если они сейчас внутри embed
        const camSec = document.getElementById('sec-mobile-cam');
        if(camSec && camSec.parentElement === embed){
          camSec.style.display = 'none';
          document.body.appendChild(camSec);
        }
        embed.innerHTML=`<div style="font-family:monospace;font-size:12px;color:#8ab8c8;line-height:2;padding:8px;">
        <b style="color:#6ab0d0;">УПРАВЛЕНИЕ (ПК)</b><br>
        WASD — движение<br>
        Мышь — меч/прицел<br>
        ЛКМ — удержать меч<br>
        Shift — ДОДЖ<br>
        T — спавн бота<br>
        E — AI вкл/выкл<br>
        O/Щ — зона арены<br>
        Enter — меню<br>
        Esc — закрыть
      </div>`;
      }
      settOv.style.display='flex';
    }
  });

  applyControlMode();

  // updateSwordFixed — направление от ЦЕНТРА фиксированного стика к пальцу,
  // прицел вращается на постоянном расстоянии от персонажа в этом направлении.
  // В отличие от floating-режима, здесь стик не двигается с пальцем — он
  // всегда на месте, и обрабатывается именно УГОЛ (направление), а не offset.
  const FIXED_RETICLE_R = 50; // расстояние прицела от центра стика (px, визуально)
  function updateSwordFixed(cx, cy){
    const dx = cx - fixedStickOrigin.x;
    const dy = cy - fixedStickOrigin.y;
    const dist = Math.hypot(dx,dy);
    const angle = Math.atan2(dy,dx);

    // Knob двигается чуть в направлении пальца (визуальная отдача), но ограничен малым радиусом
    const knobR = Math.min(dist, 30);
    fixedStickKnob.style.left = (65+Math.cos(angle)*knobR)+'px';
    fixedStickKnob.style.top  = (65+Math.sin(angle)*knobR)+'px';

    // Прицел всегда на фиксированном расстоянии FIXED_RETICLE_R, вращается по углу
    fixedStickReticle.style.left = (65+Math.cos(angle)*FIXED_RETICLE_R)+'px';
    fixedStickReticle.style.top  = (65+Math.sin(angle)*FIXED_RETICLE_R)+'px';

    // Применяем направление к прицеливанию игрока (mX/mY) — целик далеко от персонажа
    // по тому же углу, дистанция не зависит от силы отклонения пальца (только направление)
    if(dist > 8){ // мёртвая зона чтобы не дёргалось от микро-касаний
      const rc = rootCenter();
      const aimRadius = Math.min(W,H)*0.35;
      mX = rc.x + Math.cos(angle)*aimRadius;
      mY = rc.y + Math.sin(angle)*aimRadius;
    }
  }

  // ── ПРАВЫЙ — меч / прицел ────────────────────────────────────────────────
  zoneSword.addEventListener('touchstart', e => {
    // Не перехватываем касание, если оно попало по кнопке поверх зоны
    // (стиль боя/додж/зона арены и т.п. лежат в верхней части правой зоны)
    if(e.target.closest('button')) return;
    e.preventDefault();
    enableAudioSystem();
    if(swordId !== null) return;
    const t = e.changedTouches[0];

    // ── Лук: одиночный тап сразу натягивает (mDown=true, отпускание — выстрел).
    // Арбалет: выстрел должен происходить именно в момент ОТПУСКАНИЯ тапа
    // (как спуск курка), поэтому здесь mDown НЕ включаем — только
    // отмечаем, что тап был по арбалету, и стреляем в touchend.
    // Маг. посох и жезл требуют удержания и остаются на двойном тапе, как
    // ближний бой — иначе они срабатывали бы от случайного тапа.
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
        // Двойной тап: LMB зажат ПОКА держишь палец, отпустил — отжалось
        doubleTapLMB = true;
        mDown = true;
        swordKnob.classList.add('lmb-active');
        fixedStickKnob.classList.add('lmb-active');
      }
      lastSwordTap = now;
    }

    swordId = t.identifier;

    if(controlMode==='fixed'){
      // Фиксированный режим: стик уже на месте, не двигаем базу
      updateSwordFixed(t.clientX, t.clientY);
    } else {
      // Плавающий режим: появляется в точке касания
      swordOrigin = {x: t.clientX, y: t.clientY};
      swordBase.style.left = swordOrigin.x+'px';
      swordBase.style.top  = swordOrigin.y+'px';
      swordBase.classList.add('active');
      updateSword(t.clientX, t.clientY);
    }

    // Одиночный тап НЕ активирует LMB для ближнего боя — только управляет мечом
    // Двойной тап переключает режим LMB (залипание). Для лука —
    // одиночный тап уже натягивает (см. выше). Для арбалета — стреляет
    // при отпускании (см. touchend).
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
      swordId = null;
      if(controlMode==='fixed'){
        fixedStickKnob.style.left='65px'; fixedStickKnob.style.top='65px';
      } else {
        swordBase.classList.remove('active');
        updateSwordKnob(0,0);
      }
      // Арбалет: выстрел происходит именно сейчас, при отпускании тапа —
      // на один кадр включаем mDown, чтобы updateRangedWeaponFire увидел
      // fireHeld=true и сделал выстрел, затем сразу гасим.
      if(_crossbowTapPending){
        _crossbowTapPending = false;
        mDown = true;
        requestAnimationFrame(() => { mDown = false; });
      }
      // Отпустили палец — LMB всегда отжимается (лук/ближний бой с двойным тапом)
      const _wk2 = typeof weaponKeyOf==='function' && typeof P!=='undefined' ? weaponKeyOf(P) : null;
      if(doubleTapLMB || _wk2 === 'bow'){
        doubleTapLMB = false;
        mDown = false;
        swordKnob.classList.remove('lmb-active');
        fixedStickKnob.classList.remove('lmb-active');
      }
    }
  }, {passive:false});

  function updateSword(cx, cy){
    const dx = cx - swordOrigin.x;
    const dy = cy - swordOrigin.y;
    const dist = Math.hypot(dx,dy);
    const nx = dist>SWORD_R ? dx/dist*SWORD_R : dx;
    const ny = dist>SWORD_R ? dy/dist*SWORD_R : dy;
    updateSwordKnob(nx,ny);

    const rc = rootCenter();
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

  // Запрет скролла/зума
  document.addEventListener('touchmove', e => { if(e.cancelable) e.preventDefault(); }, {passive:false});
  document.addEventListener('gesturestart', e => e.preventDefault());
})();
// ════════════════ END MODULE: MOBILE CONTROLS ═══════════════════════════════
