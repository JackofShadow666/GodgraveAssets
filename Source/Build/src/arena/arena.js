// === src/arena/arena.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: ARENA & RENDER — фон арены, отрисовка персонажей/оружия/манекена
// Module file: arena.js
// ════════════════════════════════════════════════════════════════════════════




let _infRootEl=null, _infBoffEl=null;

// ── РИСОВАНИЕ ───────────────────────────────────────────────────────────────
// Offscreen canvas для статичного фона арены
let arenaCanvas = null, arenaCtx = null, arenaDirty = true;
let arenaBgImg = null; // фон, загружаемый из файла (см. ARENA_BG_FOLDER)

const ARENA_BG_FOLDER = 'Source/Background/';
// SPRITE_LISTS.background заполняется в loadAudioDB (см. MODULE: SPRITES)

function pickArenaBackground(){
  const url = pickRandomSprite('background');
  if(!url) return;
  arenaBgImg = loadSpriteImage(url);
  arenaBgImg.addEventListener('load', ()=>{ arenaDirty = true; }, {once:true});
}

function buildArena(){
  arenaCanvas = document.createElement('canvas');
  arenaCanvas.width  = W;
  arenaCanvas.height = H;
  arenaCtx = arenaCanvas.getContext('2d');
  const ac = arenaCtx;

  // Базовый фон: картинка из файла (если загружена) или сплошной цвет.
  // bgbright: 0..5. На 0 — тёмный (как раньше #080b10), на 5 — светлый "бумажный".
  // Интерполяция между тёмным и бумажным цветом по t=bgbright/5.
  const bgbright = sv('bgbright');
  const t = clamp(bgbright / 5, 0, 1);
  const darkR=8,  darkG=11, darkB=16;   // #080b10
  const paperR=240, paperG=232, paperB=216; // тёплый "бумажный" оттенок
  const bgR = Math.round(darkR + (paperR-darkR)*t);
  const bgG = Math.round(darkG + (paperG-darkG)*t);
  const bgB = Math.round(darkB + (paperB-darkB)*t);

  if(arenaBgImg && arenaBgImg.complete && arenaBgImg.naturalWidth > 0){
    ac.save();
    // brightness-фильтр для картинки: 0..5 -> 0..~1.6 (не делаем совсем белым)
    const imgBrightness = 0.3 + t * 1.3;
    ac.filter = `brightness(${imgBrightness})`;
    const ir = arenaBgImg.naturalWidth / arenaBgImg.naturalHeight;
    const cr = W / H;
    let dw, dh, dx, dy;
    if(ir > cr){ dh = H; dw = H*ir; dx = (W-dw)/2; dy = 0; }
    else { dw = W; dh = W/ir; dx = 0; dy = (H-dh)/2; }
    ac.drawImage(arenaBgImg, dx, dy, dw, dh);
    ac.restore();
  } else {
    ac.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ac.fillRect(0,0,W,H);
  }

  // Сетка — отдельный ползунок яркости/прозрачности
  const gridBright = sv('gridbright');
  // На светлом фоне сетка должна быть тёмной, на тёмном — светлой.
  // Берём контрастный к фону цвет линий, прозрачность зависит от gridBright.
  const gridAlpha = Math.min(1, 0.3 * gridBright);
  let gridR, gridG, gridB;
  if(t < 0.5){
    // тёмный фон -> светло-голубая сетка (как раньше)
    gridR=20; gridG=44; gridB=66;
  } else {
    // светлый/бумажный фон -> тёмная сетка
    gridR=90; gridG=80; gridB=60;
  }
  ac.strokeStyle=`rgba(${Math.min(255,Math.round(gridR*gridBright))},${Math.min(255,Math.round(gridG*gridBright))},${Math.min(255,Math.round(gridB*gridBright))},${gridAlpha})`;
  ac.lineWidth=1;
  for(let x=0;x<W;x+=55){ ac.beginPath(); ac.moveTo(x,0); ac.lineTo(x,H); ac.stroke(); }
  for(let y=0;y<H;y+=55){ ac.beginPath(); ac.moveTo(0,y); ac.lineTo(W,y); ac.stroke(); }

  // Виньетка по краям (затемнение) — оставляем как было
  const v=ac.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.85);
  v.addColorStop(0,'transparent'); v.addColorStop(1,'rgba(0,0,0,0.55)');
  ac.fillStyle=v; ac.fillRect(0,0,W,H);

  arenaDirty = false;
}

function drawArena(){
  if(arenaDirty || !arenaCanvas) buildArena();
  ctx.drawImage(arenaCanvas, 0, 0);
}

// ── ЛЁГКИЙ AI ДЛЯ "НЕ-УМНЫХ" БОТОВ (все, кроме текущего D) ────────────────────
// Простая логика: подойти/кружить + аггро-слот (макс N атакующих одновременно,
// см. sl-maxattackers), базовая атака и реактивный додж. Полные тактики
// (фейнты/прокруты/стили меча) тут не используются — это делает "умный" AI (D).
function updateLightweightBot(bot, dt){
  if(!dummyOn || bot.hp<=0) return;
  if(DEATH.pDead || DEATH.dDead) return;
  const pC = entityBodyCenter(P);
  const bC = entityBodyCenter(bot);
  const dx = pC.x-bC.x, dy = pC.y-bC.y;
  const dist = Math.hypot(dx,dy)||1;
  const angToPlayer = Math.atan2(dy,dx);
  const cscl = sv('cscl');

botUpdateExhaustion(bot, rawDt);
  botRegenStamina(bot, rawDt);

  // Аггро-слот: сколько других ботов ближе к игроку, чем этот
  const others = ALL_BOTS.filter(b=>b!==bot && b.hp>0 && b!==D);
  const rank = others.filter(b=>{
    const oc = entityBodyCenter(b);
    return Math.hypot(oc.x-pC.x, oc.y-pC.y) < dist;
  }).length;
  const canEngage = rank < engageSlots;

  const engageDist = 60*cscl, orbitDist = 135*cscl;
  let mx=0, my=0;
  if(canEngage){
    if(dist > engageDist*1.1){ mx=Math.cos(angToPlayer); my=Math.sin(angToPlayer); }
    else if(dist < engageDist*0.7){ mx=-Math.cos(angToPlayer); my=-Math.sin(angToPlayer); }
  } else {
    if(bot._orbitDir===undefined) bot._orbitDir = Math.random()<0.5?1:-1;
    const tangentAng = angToPlayer + Math.PI/2*bot._orbitDir;
    mx = Math.cos(tangentAng); my = Math.sin(tangentAng);
    if(dist > orbitDist*1.3){ mx += Math.cos(angToPlayer)*0.6; my += Math.sin(angToPlayer)*0.6; }
    else if(dist < orbitDist*0.7){ mx -= Math.cos(angToPlayer)*0.6; my -= Math.sin(angToPlayer)*0.6; }
    const l=Math.hypot(mx,my)||1; mx/=l; my/=l;
  }

  const maxV = getBotMaxSpeed(bot);

  if(mx||my){
    bot.vx = lerpDT(bot.vx, mx*maxV, 0.2, dt);
    bot.vy = lerpDT(bot.vy, my*maxV, 0.2, dt);
  } else {
    bot.vx = decayDT(bot.vx, sv('inertia'), dt);
    bot.vy = decayDT(bot.vy, sv('inertia'), dt);
  }
  bot.vx = clamp(bot.vx,-15,15); bot.vy = clamp(bot.vy,-15,15);
  bot.x = clamp(bot.x+bot.vx, 40, W-80);
  bot.y = clamp(bot.y+bot.vy, 40, H-40);
  resolveBoxCollision(bot);

  bot.prevAngle = bot.angle;
  bot.angle = angToPlayer;

  bot._atkCD = (bot._atkCD||0) - rawDt;
  if(canEngage && dist < engageDist*1.3 && bot._atkCD<=0 && bot.stamina>20 && bot.exhausted<=0){
    bot._atkCD = rf(0.6,0.8);
    const swingTarget = (Math.random()<0.5?1:-1) * (sv('swthresh')*1.6);
    if(weaponKeyOf(bot) === 'flail'){
      updateFlailSwing(bot, angToPlayer, rawDt);
    } else {
      bot.vel = swingTarget;
    }
  } else if(weaponKeyOf(bot) === 'flail' && bot._flailSwingTarget){
    bot.vel = lerpDT(bot.vel, bot._flailSwingTarget, 0.18, dt);
    if(Math.abs(bot.vel - bot._flailSwingTarget) < 0.05) bot._flailSwingTarget = 0;
  } else {
    bot.vel = decayDT(bot.vel, 0.85, dt);
  }

  bot._dodgeCD = (bot._dodgeCD||0) - rawDt;
  if(bot._dodgeCD<=0 && dist < 70*cscl && Math.random() < (sv('botdodgechance')/100)*dt*2){
    bot._dodgeCD = 1.5;
    bot._dvx = -Math.cos(angToPlayer)*8;
    bot._dvy = -Math.sin(angToPlayer)*8;
  }
  //if(bot._dvx||bot._dvy){
  //  bot.x = clamp(bot.x+bot._dvx, 40, W-80);
  //  bot.y = clamp(bot.y+bot._dvy, 40, H-40);
  //  bot._dvx = decayDT(bot._dvx, 0.85, dt);
  //  bot._dvy = decayDT(bot._dvy, 0.85, dt);
  //  if(Math.hypot(bot._dvx,bot._dvy)<0.3){ bot._dvx=0; bot._dvy=0; }
  //}
  botUpdateDodge(bot, dt);
}









// ── UPDATE DUMMY (AI Entity) ─────────────────────────────────────────────────
function updateDummy(dt, bot){
  if(!bot) return;
  if(DEATH.dDead || DEATH.pDead) return;
  
  const ai = bot._aiState;
  if(!ai) return;
  
  // 🔥 ЕСЛИ БОТ ЗАРЯЖАЕТ МАГИЮ - НЕ ДВИГАЕМ ЕГО
  if(bot._magicCharging === true){
    const pBodyC = entityBodyCenter(P);
    const bBodyC = entityBodyCenter(bot);
    const aimAngle = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
    bot.angle = aimAngle;
    // Стоим на месте
    bot.vx = lerpDT(bot.vx, 0, 0.9, dt);
    bot.vy = lerpDT(bot.vy, 0, 0.9, dt);
    bot.x = clamp(bot.x + bot.vx, 40, W-80);
    bot.y = clamp(bot.y + bot.vy, 40, H-40);
    return;
  }
  
  // 🔥 ЕСЛИ БОТ В КУЛДАУНЕ - ОТХОДИМ
  if(bot._magicStaffAI && bot._magicStaffAI.state === 'cooldown'){
    const pBodyC = entityBodyCenter(P);
    const bBodyC = entityBodyCenter(bot);
    const aimAngle = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
    bot.angle = aimAngle;
    
    // Отходим от игрока
    const awayAngle = Math.atan2(bot.y - P.y, bot.x - P.x);
    const targetX = P.x + Math.cos(awayAngle) * 300;
    const targetY = P.y + Math.sin(awayAngle) * 300;
    
    const dx = targetX - bot.x;
    const dy = targetY - bot.y;
    const d = Math.hypot(dx, dy) || 1;
    const maxV = 7 * sv('botspd') * sv('globalspd');
    bot.vx = lerpDT(bot.vx, (dx/d) * maxV, 0.22, dt);
    bot.vy = lerpDT(bot.vy, (dy/d) * maxV, 0.22, dt);
    bot.x = clamp(bot.x + bot.vx, 40, W-80);
    bot.y = clamp(bot.y + bot.vy, 40, H-40);
    return;
  }
  
  // ... остальной код updateDummy ...

  
  // Бот меняет стиль меча каждые 5-25 сек
  if(ai._styleTimer===undefined || GameTime>=ai._styleTimer){
    ai._styleTimer = GameTime + rf(5,20);
    ai._styleVals = pick(SWORD_STYLES);
  }
  // Бот меняет сторону щита каждые 5-30 сек
  if(ai._shieldFlipTimer===undefined || GameTime>=ai._shieldFlipTimer){
    ai._shieldFlipTimer = GameTime + rf(5,25);
    bot._shieldFlipped = !bot._shieldFlipped;
  }
  const fk = ai._fakeKeys;
  const fmX = ai._fakeMX, fmY = ai._fakeMY;
  const fDown = ai._fakeMDown;

  // Состояния: усталость и дисбаланс
botUpdateExhaustion(bot, rawDt);
  const speedMult = getMod(bot, 'moveSlow', 1);

  // Щит бота — замедление и трата стамины
  const _dShDef = shieldDef(bot);
  const _dShWeight = _dShDef ? _dShDef.weight : 0;
  const _dShWrong = _dShDef && shieldSameSideAsSword(bot);
  const _dShBaseMult = _dShDef ? (1 - 0.15 - _dShWeight*0.1) : 1.0;
  const _dShWrongMult = _dShWrong ? 0.8 : 1.0;

botRegenStamina(bot, rawDt);

  // Движение — пропускаем полностью, если этот бот в этом же кадре уже был
  // передвинут специализированным ranged-контроллером (лук/арбалет/жезл в
  // дальнем режиме, см. bot._rangedMovementHandled в updateAIDispatch).
  // Тот уже сам посчитал bot.vx/vy и применил bot.x/y. Раньше этот блок
  // читал ai._fakeKeys (для таких ботов они пустые/устаревшие), получал
  // mx=my=0 и КАЖДЫЙ КАДР гасил (decayDT) только что выставленную ranged-AI
  // скорость — из-за этого бот с луком, пытаясь отойти от стены, тут же
  // получал скорость обратно к нулю и физически не мог сдвинуться.
  if(!bot._rangedMovementHandled){
    let mx=0, my=0;
    const _dodgeLocked = GameTime < (ai._dodgeLockUntil||0) || GameTime < (bot._moveLockUntil||0);
    if(!_dodgeLocked){
      if(fk.a) mx=-1; if(fk.d) mx=1;
      if(fk.w) my=-1; if(fk.s) my=1;
      if(mx||my){ const l=Math.hypot(mx,my); mx/=l; my/=l; }
    }
    const retreatScale = ai._retreatMode ? 0.6 : 1.0;
    const dbBlockSlow = (bot._blockSlow||0) > GameTime ? sv('blockSlowMult') : 1;
    const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
    const botSpeedMult = Math.max(0.5, 1 - (botCount - 1) * 0.08);

    const maxV = 7 * sv('botspd') * speedMult * retreatScale * dbBlockSlow * sv('globalspd') * botSpeedMult * _dShBaseMult * _dShWrongMult * weaponMoveSpeedMult(bot);
    if(_dodgeLocked){
      bot.vx = decayDT(bot.vx, sv('inertia'), dt);
      bot.vy = decayDT(bot.vy, sv('inertia'), dt);
    } else if(mx || my){
      bot.vx = lerpDT(bot.vx, mx*maxV, 0.22, dt);
      bot.vy = lerpDT(bot.vy, my*maxV, 0.22, dt);
    } else {
      bot.vx = decayDT(bot.vx, sv('inertia'), dt);
      bot.vy = decayDT(bot.vy, sv('inertia'), dt);
    }
    bot.vx = clamp(bot.vx, -15, 15); bot.vy = clamp(bot.vy, -15, 15);
    bot.x = clamp(bot.x + bot.vx, 40, W-80);
    bot.y = clamp(bot.y + bot.vy, 40, H-40);
    resolveBoxCollision(bot);
  }

botSpawnDust(bot, rawDt);

  // В PVP или при ожидании старта — позиция управляется сетью
  if(typeof NET_SYNC!=='undefined' && (NET_SYNC.active || NET_CORE.isOpen())) return;
  // Тик кулдауна бот-доджа
if(ai._botDodgeCooldown>0) ai._botDodgeCooldown-=rawDt;
  botUpdateDodge(bot, rawDt);

  // Рут бота (без компенсации — у бота её нет)
  const drc = { x: bot.x + 5, y: bot.y - 8 };
  const angToFM = Math.atan2(fmY - drc.y, fmX - drc.x);
  const opp = angToFM + Math.PI;
  const distV = dstyle('dist');
  const fdist = Math.hypot(fmX-drc.x, fmY-drc.y);
  const scaledDist = distV * clamp(fdist/120,0,1);
  bot.tbx = Math.cos(opp)*scaledDist; bot.tby = Math.sin(opp)*scaledDist;
  bot.bx = lerpDT(bot.bx, bot.tbx, sv('spd'), dt);
  bot.by = lerpDT(bot.by, bot.tby, sv('spd'), dt);

  // Пивот бота
  bot.pvX += (bot.tpX - bot.pvX)*0.35;
  bot.pvY += (bot.tpY - bot.pvY)*0.35;

  // 🔥 РАСЧЁТ TPX/TPY С УЧЁТОМ ДАЛЬНОБОЙНОГО ОРУЖИЯ
  const ang = Math.atan2(fmY - drc.y, fmX - drc.x);
  const inv = ang + Math.PI;

  // Проверяем, дальнобойное ли оружие у бота
  const isRangedBot = weaponKeyOf(bot) === 'bow' || weaponKeyOf(bot) === 'crossbow' || weaponKeyOf(bot) === 'wand';

  if(!fDown || isRangedBot){
    let dex, dey, dblkVal;
    let eyOffset = 0;
    
    if (isRangedBot) {
      // 🔥 ДЛЯ ЛУКА/АРБАЛЕТА — ИСПОЛЬЗУЕМ СТИЛЬ КАК У ИГРОКА
      const style = getRangedStyle();
      dex = style.ex;      // 0
      dey = style.ey;      // -8
      dblkVal = style.blk; // 0.17
      // Адаптивные смещения отключаем
    } else {
      // Обычное оружие — настройки из слайдеров
      const adaXon = dstyleCb('adaX');
      if(adaXon){
        const t = Math.sin(ang)*Math.sin(ang);
        dex = dstyle('adaXb') + (dstyle('adaXp') - dstyle('adaXb')) * t;
      } else {
        dex = dstyle('ex');
      }
      dey = dstyle('ey');
      dblkVal = dblk();
      
      // Адаптивные смещения для ближнего боя
      const adaYon = dstyleCb('adaY');
      const adaDon = dstyleCb('adaD');
      const ada12on = dstyleCb('ada12');
      if(adaYon){ eyOffset -= clamp(-Math.sin(ang),0,1)*csv('adaY'); }
      if(adaDon){
        const tc = Math.cos(ang - Math.PI/2);
        eyOffset += clamp(tc*tc*(tc>0?1:0),0,1)*csv('adaD');
      }
      if(ada12on){
        eyOffset += clamp(Math.cos((ang+Math.PI/2)*2),0,1)*csv('ada12');
      }
    }
    
    bot.tpX += (Math.cos(inv)*dex - bot.tpX) * dblkVal;
    bot.tpY += (Math.sin(inv)*dey + eyOffset - bot.tpY) * dblkVal;
  } else {
    // ЛКМ зажат — атака (только для ближнего боя, у дальнобойного fDown всегда false)
    const aex = csv('aex'), aey = csv('aey');
    bot.tpX += (Math.cos(ang)*aex - bot.tpX) * sv('as');
    bot.tpY += (Math.sin(ang)*aey - bot.tpY) * sv('as');
  }

  // Угол меча
  const dpivX = drc.x + bot.pvX, dpivY = drc.y + bot.pvY;
  let ta = Math.atan2(fmY - dpivY, fmX - dpivX);
  // 🔥 УЧИТЫВАЕМ ДЕБАФФ ОТ ЩИТА
  // 🔥 УЧИТЫВАЕМ ДЕБАФФ ОТ ЩИТА (убрано, дебафф больше не ставится)
   // 🔥 ДЕБАФФ ДЛЯ БОТА
  const botDebuffMult = getDebuffSwordMult(bot);
  const spdMult2 = botDebuffMult;
  // 🔥 ОБРАБОТКА ЦЕПА — ОТДЕЛЬНО, С ВОЗВРАТОМ
  if(weaponKeyOf(bot) === 'flail'){
    // ── ЦЕП: РЕАЛИСТИЧНОЕ ПОВЕДЕНИЕ ДЛЯ БОТА ──
    if(!bot._flailSpinState) {
        bot._flailSpinState = 'idle'; // idle | spinning | retracting
        bot._flailSpinAngle = 0;
        bot._flailSpinDir = Math.random() < 0.5 ? 1 : -1;
        bot._flailSpinSpeed = 4.0;
        bot._flailTimer = 0;
    }
    
    bot._flailTimer -= rawDt;
    
    // ── МЕНЯЕМ СОСТОЯНИЕ КАЖДЫЕ 1-3 СЕКУНДЫ ──
    if(bot._flailTimer <= 0){
        const r = Math.random();
        if(r < 0.4){
            // 40% — вращение
            bot._flailSpinState = 'spinning';
            bot._flailSpinDir = Math.random() < 0.5 ? 1 : -1;
            bot._flailSpinSpeed = 3.0 + Math.random() * 3.0;
            bot._flailTimer = 0.8 + Math.random() * 1.5; // 0.8-2.3 сек вращения
        } else if(r < 0.7){
            // 30% — пауза (цепь складывается)
            bot._flailSpinState = 'idle';
            bot._flailTimer = 0.5 + Math.random() * 1.0; // 0.5-1.5 сек паузы
        } else {
            // 30% — резкая смена направления
            bot._flailSpinState = 'spinning';
            bot._flailSpinDir *= -1;
            bot._flailSpinSpeed = 4.0 + Math.random() * 2.0;
            bot._flailTimer = 0.5 + Math.random() * 1.0;
        }
    }
    
    // ── ПРИМЕНЯЕМ СОСТОЯНИЕ ──
    let fakeAng;
    if(bot._flailSpinState === 'spinning'){
        // Вращаем прицел по кругу
        bot._flailSpinAngle += bot._flailSpinDir * bot._flailSpinSpeed * rawDt;
        const spinRadius = 80;
        const fakeX = drc.x + Math.cos(bot._flailSpinAngle) * spinRadius;
        const fakeY = drc.y + Math.sin(bot._flailSpinAngle) * spinRadius;
        fakeAng = Math.atan2(fakeY - dpivY, fakeX - dpivX);
    } else {
        // Idle — смотрим на игрока (цепь будет складываться)
        fakeAng = ta;
    }
    
    // Раскручиваем цепь с правильным углом
    updateFlailSwing(bot, fakeAng, rawDt);
    
    // Если в режиме idle — принудительно ускоряем складывание
    if(bot._flailSpinState === 'idle'){
        bot._flailExt = Math.max(0, (bot._flailExt || 0) - 2.0 * rawDt);
    }
    
    bot.prevAngle = bot.angle;
    return;
  }
  
  // ── ОСТАЛЬНОЕ ОРУЖИЕ (НЕ ЦЕП) ──
  if(hasMod(bot, 'weaponRecoil')){
  bot._disbalanceAngularVelocity = (bot._disbalanceAngularVelocity || 0) * Math.pow(0.12, dt);
  bot.angle += bot._disbalanceAngularVelocity * dt;
  bot.vel = bot._disbalanceAngularVelocity;
} else {
    bot.vel = decayDT(bot.vel, 0.6, dt) + angDiff(ta, bot.angle)*0.4*weaponSwingSpeedMult(bot);
    bot.angle = angLerpDT(bot.angle, ta, 0.28*spdMult2, dt);
  }
  bot.prevAngle = bot.angle;
}








function updateChargeShake(ent, dt){
  if(!ent) return;
  
  // Определяем, заряжается ли оружие
  const key = weaponKeyOf(ent);
  let isCharging = false;
  let chargeStart = 0;
  let chargeTime = 1.0;
  let intensityMult = 1.0;
  
  if(key === 'wand') {
    isCharging = ent._wandCharging || false;
    chargeStart = ent._wandChargeStart || 0;
    chargeTime = wandChargeTimeFor(ent);
    intensityMult = 1.2;
  } else if(key === 'magicstaff') {
    isCharging = ent._magicCharging || false;
    chargeStart = ent._magicChargeStart || 0;
    chargeTime = MAGICSTAFF_CHARGE_FULLTIME;
    intensityMult = 1.0;
  } else if(key === 'bow') {
    isCharging = ent._bowCharging || false;
    chargeStart = ent._bowChargeStart || 0;
    chargeTime = BOW_RELOAD;
    intensityMult = 0.8;
  }
  
  if(isCharging && chargeTime > 0) {
    const progress = Math.min(1, (GameTime - chargeStart) / chargeTime);
    const intensity = 0.3 + progress * 1.5 * intensityMult;
    const time = GameTime * 20;
    const seed = ent._chargeSeed || 0;
    
    ent._chargeShakeX = Math.sin(time * 1.3 + seed) * intensity * 0.8 +
                        Math.sin(time * 2.7 + seed * 1.7) * intensity * 0.4;
    ent._chargeShakeY = Math.cos(time * 1.7 + seed * 0.7) * intensity * 0.6 +
                        Math.sin(time * 3.1 + seed * 2.3) * intensity * 0.3;
    ent._chargeShakeAngle = Math.sin(time * 2.1 + seed * 1.3) * intensity * 0.02 +
                            Math.cos(time * 3.7 + seed * 0.5) * intensity * 0.01;
  } else {
    // Плавное затухание
    ent._chargeShakeX = (ent._chargeShakeX || 0) * 0.9;
    ent._chargeShakeY = (ent._chargeShakeY || 0) * 0.9;
    ent._chargeShakeAngle = (ent._chargeShakeAngle || 0) * 0.9;
    if(Math.abs(ent._chargeShakeX) < 0.01) ent._chargeShakeX = 0;
    if(Math.abs(ent._chargeShakeY) < 0.01) ent._chargeShakeY = 0;
    if(Math.abs(ent._chargeShakeAngle) < 0.001) ent._chargeShakeAngle = 0;
  }
}











let boxesOn = false;

function drawBoxes(){
  if(!boxesOn) return;
  for(const b of BOXES){
    // тень
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.fillRect(b.x+4, b.y+6, b.w, b.h);
    // основа ящика
    ctx.fillStyle='#2a1e10';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // верхняя грань
    ctx.fillStyle='#4a3218';
    ctx.fillRect(b.x+2, b.y+2, b.w-4, b.h*0.35);
    // доски — горизонтальные линии
    ctx.strokeStyle='#1a1008'; ctx.lineWidth=1;
    for(let i=1;i<3;i++){
      const ly = b.y + b.h * i/3;
      ctx.beginPath(); ctx.moveTo(b.x+2,ly); ctx.lineTo(b.x+b.w-2,ly); ctx.stroke();
    }
    // вертикальная полоска по центру
    ctx.beginPath(); ctx.moveTo(b.x+b.w/2,b.y+2); ctx.lineTo(b.x+b.w/2,b.y+b.h-2); ctx.stroke();
    // рамка
    ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // блик
    ctx.strokeStyle='rgba(120,80,30,0.25)'; ctx.lineWidth=1;
    ctx.strokeRect(b.x+2, b.y+2, b.w-4, b.h-4);
  }
}

function drawBowArrow(ent){
  if(!ent || weaponKeyOf(ent) !== 'bow') return;
  if(!ent._bowCharging) return;
  
  const tip = weaponTipPos(ent);
  const progress = Math.min(1, (GameTime - ent._bowChargeStart) / BOW_RELOAD);
  
  // Дрожание
  const intensity = 0.3 + progress * 0.7;
  const time = GameTime * 25;
  const seed = ent._bowSeed || 0;
  const shakeX = Math.sin(time * 1.7 + seed) * 0.6 * intensity;
  const shakeY = Math.cos(time * 2.3 + seed * 1.3) * 0.8 * intensity;
  const shakeAngle = Math.sin(time * 3.1 + seed * 0.7) * 0.015 * intensity;
  
  const arrowUrl = ent._bowArrowUrl || (ent._bowArrowUrl = pickRandomSprite('arrow'));
  const img = arrowUrl ? loadSpriteImage(arrowUrl) : null;
  
  ctx.save();
  ctx.translate(tip.x + shakeX, tip.y + shakeY);
  ctx.rotate(ent.angle + shakeAngle);
  
  ctx.globalAlpha = 0.5 + progress * 0.5;
  
  // 🔥 РАЗМЕР СТРЕЛЫ (маленький)
  const arrowSize = 4 + progress * 3;
  
  if(img && img.complete && img.naturalWidth > 0){
    // 🔥 ПРАВИЛЬНЫЕ ПРОПОРЦИИ
    const aspect = img.naturalWidth / img.naturalHeight;
    const w = arrowSize;
    const h = arrowSize / aspect; // ширина = arrowSize, высота = arrowSize / aspect
    
    // 🔥 ПОВОРОТ НА 90° (чтобы остриё смотрело вперёд)
    ctx.rotate(Math.PI / 2);
    
    // 🔥 СМЕЩЕНИЕ: остриё в точке (0,0), т.е. сдвигаем на -w/2 по X
    ctx.drawImage(img, -w/4, -h/4, w, h);
  } else {
    // Рисованная стрела
    ctx.rotate(Math.PI / 2);
    ctx.strokeStyle = '#c8a878';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-arrowSize * 0.2, 0);
    ctx.lineTo(arrowSize * 0.8, 0);
    ctx.stroke();
    
    ctx.fillStyle = '#c0c8d8';
    ctx.beginPath();
    ctx.moveTo(arrowSize * 0.85, 0);
    ctx.lineTo(arrowSize * 0.7, -3);
    ctx.lineTo(arrowSize * 0.7, 3);
    ctx.closePath();
    ctx.fill();
  }
  
  // Свечение
  if(progress > 0.3){
    const glowAlpha = progress * 0.3;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 20 + progress * 15);
    grad.addColorStop(0, `rgba(255,220,150,${glowAlpha * 0.5})`);
    grad.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + progress * 15, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
  ctx.restore();
}


// Рисует тело с body offset (с учётом скейла персонажа)
function drawPlayer(){
  drawChar(P, sv('cscl'), '#1e4a72', '#2a6a9a');
   drawBowArrow(P);
}


// Пот при усталости
function drawSweat(ent){
  // Используем новую систему баффов вместо прямого обращения к полю
  if(!isExhausted(ent)) return;
  
  const bc = entityBodyCenter(ent);
  const cscl = sv('cscl');
  
  // Капли появляются с небольшой вероятностью каждый кадр
  if(Math.random() < 0.05){
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 16 * cscl;
    hitFX.push({
      x: bc.x + Math.cos(angle) * dist,
      y: bc.y - 18 * cscl + (Math.random() - 0.5) * 8,
      t: '💧', 
      life: rf(45, 20), 
      big: false, 
      col: '#88ccff'
    });
  }
}

function drawUnbalancedStars(ent){
  // Legacy call site retained; stars are rendered in drawStatusEffects.
  if(!isUnbalanced(ent)) return;
  // Используем новую систему баффов
  if(!isUnbalanced(ent)) return;
  
  const bc = entityBodyCenter(ent);
  const cscl = sv('cscl');
  if(false && Math.random() < 0.08){
    hitFX.push({
      x: bc.x + (Math.random()-0.5)*14*cscl,
      y: bc.y - 26*cscl,
      t: '⭐', 
      life: rf(35,15), 
      big: false, 
      col:'#ffe066'
    });
  }
}

// Дебаг: показываем рут и линию рут→тело
function drawRootDebug(){ return; }


function drawPivotDebug(pivX, pivY){
  const rc = rootCenter();

  // линия рут → пивот
  ctx.strokeStyle='rgba(60,120,180,0.4)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(rc.x, rc.y); ctx.lineTo(pivX, pivY); ctx.stroke();

  // линия пивот → кончик → курсор
  const tipX=pivX+Math.cos(P.angle)*SWORD_LEN, tipY=pivY+Math.sin(P.angle)*SWORD_LEN;
  ctx.strokeStyle='rgba(80,160,220,0.1)'; ctx.lineWidth=1; ctx.setLineDash([2,6]);
  ctx.beginPath(); ctx.moveTo(tipX,tipY); ctx.lineTo(mX,mY); ctx.stroke();
  ctx.setLineDash([]);

  // трейл пивота
  trailPts.push({x:pivX, y:pivY, life:35});
  if(trailPts.length>55) trailPts.shift();
  for(let i=0;i<trailPts.length-1;i++){
    trailPts[i].life--;
    const a=trailPts[i].life/35;
    ctx.strokeStyle=`rgba(80,180,255,${a*0.3})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(trailPts[i].x,trailPts[i].y); ctx.lineTo(trailPts[i+1].x,trailPts[i+1].y); ctx.stroke();
  }

  // точка пивота
  ctx.fillStyle=mDown?'rgba(220,160,80,0.85)':'rgba(100,200,255,0.75)';
  ctx.beginPath(); ctx.arc(pivX,pivY,4,0,Math.PI*2); ctx.fill();

  // круг автоблока + визуализация наклона лезвия
  const abrad = 0;
  if(abrad > 1){
    const rc2 = rootCenter();
    const inAB = P._inAutoBlock;

    // внешнее кольцо зоны
    ctx.strokeStyle = inAB ? 'rgba(80,200,120,0.5)' : 'rgba(60,140,220,0.2)';
    ctx.lineWidth = inAB ? 2 : 1;
    ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.arc(rc2.x, rc2.y, abrad, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    if(inAB && P._inABang !== undefined){
      const angTC = P._inABang;
      const pivDist2 = 45;
      const pivX2 = rc2.x + Math.cos(angTC) * pivDist2;
      const pivY2 = rc2.y + Math.sin(angTC) * pivDist2;

      // линия рут → пивот (направление угрозы)
      ctx.strokeStyle = 'rgba(80,200,120,0.25)';
      ctx.lineWidth = 1; ctx.setLineDash([3,5]);
      ctx.beginPath(); ctx.moveTo(rc2.x, rc2.y); ctx.lineTo(pivX2, pivY2); ctx.stroke();
      ctx.setLineDash([]);

      // дуга наклона лезвия — показывает диапазон и текущий tilt
      const tiltNorm = (P._abTilt || 0) / (60 * Math.PI / 180);
      const arcR = 28;
      const baseAng = angTC + Math.PI / 2;
      ctx.strokeStyle = 'rgba(80,200,120,0.18)';
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(pivX2, pivY2, arcR, baseAng - 60*Math.PI/180, baseAng + 60*Math.PI/180);
      ctx.stroke();
      // текущий наклон — яркая точка на дуге
      ctx.fillStyle = 'rgba(120,255,160,0.9)';
      ctx.beginPath();
      ctx.arc(pivX2 + Math.cos(baseAng + (P._abTilt||0)) * arcR,
              pivY2 + Math.sin(baseAng + (P._abTilt||0)) * arcR, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.lineCap = 'butt';
    }

    // надпись
    ctx.fillStyle = inAB ? 'rgba(80,200,120,0.6)' : 'rgba(60,140,220,0.35)';
    ctx.font = '8px Share Tech Mono';
    ctx.fillText(inAB ? 'АВТОБЛОК' : 'авт.зона', rc2.x - abrad + 4, rc2.y - abrad + 12);
  }

  // мёртвая зона курсора (красный круг)
  const dzone = csv('dzone');
  if(dzone > 1){
    const rc3 = rootCenter();
    ctx.strokeStyle='rgba(200,50,50,0.5)';
    ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(rc3.x, rc3.y, dzone, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(200,60,60,0.06)';
    ctx.beginPath(); ctx.arc(rc3.x, rc3.y, dzone, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(200,60,60,0.4)'; ctx.font='8px Share Tech Mono';
    ctx.fillText('мёртв.зона', rc3.x - dzone + 4, rc3.y - dzone + 12);
  }

  // круг виртуального прицела (если включён)
  const arad = 0;
  if(arad > 1){
    // серый круг = радиус взмаха меча (минимальный рабочий радиус)
    ctx.strokeStyle='rgba(100,100,100,0.2)'; ctx.lineWidth=1; ctx.setLineDash([2,8]);
    ctx.beginPath(); ctx.arc(pivX, pivY, SWORD_LEN, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    // оранжевый круг = активный радиус прицела
    ctx.strokeStyle='rgba(255,140,40,0.35)'; ctx.lineWidth=1; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.arc(pivX, pivY, arad, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    // надпись радиуса
    ctx.fillStyle='rgba(255,140,40,0.4)'; ctx.font='8px Share Tech Mono';
    ctx.fillText('r='+arad, pivX+arad+4, pivY+3);
    // виртуальная точка прицела
    ctx.fillStyle='rgba(255,120,60,0.85)';
    ctx.beginPath(); ctx.arc(pivX + P._vcX, pivY + P._vcY, 3, 0, Math.PI*2); ctx.fill();
    // линия пивот → виртуальный прицел
    ctx.strokeStyle='rgba(255,120,60,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(pivX+P._vcX, pivY+P._vcY); ctx.stroke();
  }
}


function drawSwordSprite(ctx2, img, length, glowColor, glowBlur, centerGrip, weaponKey){
  const width = length * spriteAspectFor(img);
  if(glowColor){ ctx2.shadowColor = glowColor; ctx2.shadowBlur = glowBlur; }
  
  // ✅ Для копья — хват ближе к острию (40% от длины)
  if(weaponKey === 'spear'){
    const gripOffset = length * 0.3; // хват на 40% от основания (ближе к острию)
    ctx2.drawImage(img, -width/2, gripOffset, width, -length);
  }
  else if(centerGrip){
    // Посох — по центру
    ctx2.drawImage(img, -width/2, length/2, width, -length);
  } else {
    // Меч, кинжал, топор, молот — за рукоять
    const hiltShift = length * SWORD_HILT_OFFSET;
    ctx2.drawImage(img, -width/2, hiltShift, width, -length);
  }
  
  ctx2.shadowBlur = 0;
}


function updateMagicStaffShake(ent, dt){
  if(!ent || !ent._magicCharging) {
    // Плавно возвращаем в исходное положение
    ent._magicShakeX = (ent._magicShakeX || 0) * 0.9;
    ent._magicShakeY = (ent._magicShakeY || 0) * 0.9;
    ent._magicShakeAngle = (ent._magicShakeAngle || 0) * 0.9;
    return;
  }
  
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const intensity = 0.3 + progress * 1.5; // усиливается со временем
  
  // Случайное дрожание с синусоидальной составляющей
  const time = GameTime * 20;
  const seed = ent._magicSeed || 0;
  
  ent._magicShakeX = Math.sin(time * 1.3 + seed) * intensity * 0.8 +
                      Math.sin(time * 2.7 + seed * 1.7) * intensity * 0.4;
  ent._magicShakeY = Math.cos(time * 1.7 + seed * 0.7) * intensity * 0.6 +
                      Math.sin(time * 3.1 + seed * 2.3) * intensity * 0.3;
  ent._magicShakeAngle = Math.sin(time * 2.1 + seed * 1.3) * intensity * 0.02 +
                          Math.cos(time * 3.7 + seed * 0.5) * intensity * 0.01;
}


function drawWeaponWithShake(ent, pivX, pivY){
  if(!ent) return;
  
  const weaponKey = weaponKeyOf(ent);
  const isBow = weaponKey === 'bow';
  const isMagicStaff = weaponKey === 'magicstaff';
  
  if(!isBow && !isMagicStaff) return;
  
  const img = ent._weaponImg;
  if(!img || !img.complete || img.naturalWidth <= 0) return;
  
  // Определяем прогресс зарядки
  let progress = 0;
  if(isBow && ent._bowCharging){
    progress = Math.min(1, (GameTime - ent._bowChargeStart) / BOW_RELOAD);
  } else if(isMagicStaff && ent._magicCharging){
    progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  }
  
  ctx.save();
  ctx.translate(pivX, pivY);
  
  let shakeX = 0, shakeY = 0, shakeAngle = 0;
  let scaleY = 1, skewX = 0;
  let baseScale = 1.0;
  let maxScale = 1.0;
  let bowScale = 1.0;
  
  if(progress > 0.05){
    const intensity = 0.3 + progress * 0.7;
    const time = GameTime * 25;
    const seed = ent._bowSeed || ent._magicSeed || 0;
    
    // 🔥 ДЛЯ МАГИЧЕСКОГО ПОСОХА — СИЛЬНЕЕ ТРЯСКА
    const shakeMult = isMagicStaff ? 2.0 : 1.0;
    
    shakeX = Math.sin(time * 1.7 + seed) * 0.6 * intensity * shakeMult;
    shakeY = Math.cos(time * 2.3 + seed * 1.3) * 0.8 * intensity * shakeMult;
    shakeAngle = Math.sin(time * 3.1 + seed * 0.7) * 0.015 * intensity * shakeMult;
    
    if(isBow){
      // Сжатие по Y при натяжении лука
      scaleY = 1 - progress * 0.18;
      skewX = progress * 0.12;
      baseScale = 0.75;
      maxScale = 1.0;
      bowScale = baseScale + (maxScale - baseScale) * progress;
    } else if(isMagicStaff){
      // 🔥 ДЛЯ МАГИЧЕСКОГО ПОСОХА — СВЕЧЕНИЕ И ТРЯСКА
      scaleY = 1 - progress * 0.05;
      skewX = progress * 0.03;
      baseScale = 0.9;
      maxScale = 1.1;
      bowScale = baseScale + (maxScale - baseScale) * progress;
    }
  }
  
  ctx.translate(shakeX, shakeY);
  ctx.rotate(ent.angle + Math.PI/2 + shakeAngle);
  
  // Применяем скейл
  if(isBow || isMagicStaff){
    ctx.scale(bowScale, bowScale * scaleY);
    ctx.transform(1, 0, skewX * 0.4, 1, 0, 0);
  }
  
  // 🔥 СВЕЧЕНИЕ ДЛЯ МАГИЧЕСКОГО ПОСОХА
  if(isMagicStaff && ent._magicCharging && progress > 0.1){
    const glowIntensity = 0.3 + progress * 0.7;
    const glowSize = 20 + progress * 40;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    grad.addColorStop(0, `rgba(100, 200, 255, ${glowIntensity * 0.5})`);
    grad.addColorStop(0.5, `rgba(80, 180, 255, ${glowIntensity * 0.25})`);
    grad.addColorStop(1, 'rgba(40, 120, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Скейл оружия
  const swScale = effSwordScale(ent) * sv('swlen') * (isBot(ent) ? sv('botswordscale') : 1);
  ctx.scale(swScale, swScale);
  
  const baseLen = weaponLenFor(ent);
  const width = baseLen * spriteAspectFor(img);
  const centerGrip = CENTER_GRIP_CATEGORIES.includes(weaponDefFor(ent).category);
  
  if(weaponKey === 'flail'){
    drawFlailSprite(ctx, ent, baseLen, null, 0);
  } else {
    drawSwordSprite(ctx, img, baseLen, null, 0, centerGrip, weaponKey);
  }
  
  ctx.restore();
}

function drawSword(pivX, pivY, angle){
  const swScale = effSwordScale(P) * sv('swlen');
  const BASE_L = weaponLenFor(P);
  const centerGrip = CENTER_GRIP_CATEGORIES.includes(weaponDefFor(P).category);
  const weaponKey = weaponDefFor(P).key;
  const spd = Math.abs(P.vel);
  const meleePoseActive = mDown && !isRangedWeapon(P) && weaponKeyOf(P) !== 'flail';
  let shapeRot = 0;
  if(!meleePoseActive){
    const dx = mX - W/2, dy = mY - H/2;
    const halfDiag = Math.hypot(W, H) / 2;
    const t = clamp((dx - dy) / halfDiag, -1, 1);
    const amplitude = sv('srot') * Math.PI / 180;
    shapeRot = -t * amplitude;
  }
  const sox = meleePoseActive ? 0 : sv('sox');
  const soy = meleePoseActive ? 0 : sv('soy');
    // 🔥 ПРОЗРАЧНОСТЬ ОТ ДЕБАФФА
  const _exhAlpha = getDebuffAlpha(P);
  
  // 🔥 ДЛЯ ЛУКА — ИСПОЛЬЗУЕМ СПЕЦИАЛЬНУЮ ФУНКЦИЮ С ДРОЖАНИЕМ
  if(weaponKey === 'bow'){
    ctx.save();
    ctx.globalAlpha = _exhAlpha;
    drawWeaponWithShake(P, pivX, pivY);
    ctx.restore();
    return;
  }
  
  // 🔥 ЕДИНАЯ ТРЯСКА ДЛЯ ЖЕЗЛА И МАГИЧЕСКОГО ПОСОХА
  let shakeX = 0, shakeY = 0, shakeAngle = 0;
  if((weaponKey === 'wand' || weaponKey === 'magicstaff') && 
     (P._wandCharging || P._magicCharging)){
    shakeX = P._chargeShakeX || 0;
    shakeY = P._chargeShakeY || 0;
    shakeAngle = P._chargeShakeAngle || 0;
  }
  
  ctx.save();
  ctx.globalAlpha = _exhAlpha;
  ctx.translate(pivX + shakeX, pivY + shakeY);
  ctx.rotate(angle + Math.PI/2 + shakeAngle);
  ctx.translate(soy, -sox);
  ctx.rotate(shapeRot);
  ctx.scale(swScale, swScale);

  const rageActive = P.rageBuffEnd > GameTime;
  let glowColor = null, glowBlur = 0;
  if(rageActive){
    glowColor = 'rgba(255,40,0,0.9)';
    glowBlur = 18 + spd * 15;
  }

  const img = P._weaponImg;
  if(weaponKey === 'flail'){
    drawFlailSprite(ctx, P, BASE_L, glowColor, glowBlur);
  } else if(img && img.complete && img.naturalWidth > 0){
    drawSwordSprite(ctx, img, BASE_L, glowColor, glowBlur, centerGrip, weaponKey);
  }
  ctx.restore();
}

// ── РИСОВАНИЕ ЩИТА ──────────────────────────────────────────────────────────
function drawShield(ent, cursorX){
  const def = shieldDef(ent);
  if(!def || !def.url) return;
  const img = ent._shieldImg;
  const imgReady = img && img.complete && img.naturalWidth > 0;

  const CHAR_H = CHAR_SPRITE_H * sv('cscl') * 1.2;
  const shH = CHAR_H * def.scale;
  const aspectRatio = (imgReady && img.naturalHeight>0) ? (img.naturalWidth/img.naturalHeight) : 0.75;
  const shW = shH * aspectRatio;
  ent._shieldW = shW; ent._shieldH = shH; ent._shieldType = ent.shield;

  // 🔥 ВОТ ЭТО БЫЛО ПРОПУЩЕНО!
  const sc = shieldCenter(ent, cursorX);
  if(!sc) return;
  
  // Башенный (3) и большой (2) щиты — дополнительный offset от тела
  if(ent.shield===3) sc.x += sc.side * shW * 0.2;
  if(ent.shield===2) sc.x += sc.side * shW * 0.2;
  
  const _shExhMult = (ent.exhausted > 0 || ent.unbalanced > 0) ? 0.85 : 1.0;
  const _shExhOffY = (ent.exhausted > 0 || ent.unbalanced > 0) ? shH * 0.15 : 0;

  const _rawTilt = Math.sin(ent.angle) * (15*Math.PI/180);
  const _maxTilt = 15*Math.PI/180;
  const shieldAngle = clamp(_rawTilt, -_maxTilt, _maxTilt);

  const lmbActive = (ent===P) ? (mDown && !isRangedWeapon(ent) && weaponKeyOf(ent) !== 'flail')
    : (typeof AI!=='undefined' && AI._fakeMDown && !isRangedWeapon(ent) && weaponKeyOf(ent) !== 'flail');
  const _shDisabled = isExhausted(ent) || isUnbalanced(ent);
  ent._shieldAlpha = lmbActive ? 0.25 : (_shDisabled ? 0.3 : 1.0);

  const _shWf = shW * _shExhMult;
  const _shHf = shH * _shExhMult;
  ctx.save();
  ctx.globalAlpha = ent._shieldAlpha;
  ctx.translate(sc.x, sc.y + _shExhOffY);
  ctx.rotate(shieldAngle);
  if(imgReady){
    ctx.drawImage(img, -_shWf/2, -_shHf/2, _shWf, _shHf);
  } else {
    ctx.fillStyle = 'rgba(100,180,255,0.5)';
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 2;
    ctx.fillRect(-_shWf/2, -_shHf/2, _shWf, _shHf);
    ctx.strokeRect(-_shWf/2, -_shHf/2, _shWf, _shHf);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Persistent status indicators are drawn with the character, rather than as
// one-frame hitFX particles. This makes them visible at every frame rate.
function drawStatusEffects(ent, cscl){
  const c = entityBodyCenter(ent);
  const headY = c.y - 30 * cscl;
  const t = GameTime;
  ctx.save();

  if(isUnbalanced(ent)){
    // Wide horizontal ellipse around the head. Scale and alpha pulse by the
    // star's orbit phase, giving depth without allocating transient FX.
    for(let i = 0; i < 4; i++){
      const phase = t * 3.2 + i * Math.PI / 2;
      const depth = (Math.sin(phase) + 1) * 0.5;
      const x = c.x + Math.cos(phase) * 22 * cscl;
      const y = headY + Math.sin(phase) * 8 * cscl;
      const size = (3.2 + depth * 3.8) * cscl;
      ctx.globalAlpha = 0.35 + depth * 0.65;
      ctx.fillStyle = '#ffe066';
      ctx.shadowColor = '#c88000';
      ctx.shadowBlur = 4 + depth * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(phase * 0.7);
      ctx.beginPath();
      for(let p = 0; p < 10; p++){
        const radius = p % 2 === 0 ? size : size * 0.42;
        const angle = -Math.PI / 2 + p * Math.PI / 5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if(p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawChar(ent, cscl, torsoCol, headCol){
  const bx = ent.x + 5 + ent.bx;
  const by = ent.y - 8 + ent.by;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(cscl, cscl);
  const _hitTiltElapsed = GameTime - (ent._hitTiltT0!==undefined ? ent._hitTiltT0 : -99);
  const _hitTilt = (ent._hitTiltAmp||0) * Math.exp(-Math.max(0,_hitTiltElapsed) * 10);
  ctx.rotate((ent.vx||0)*0.02 + _hitTilt);

  // тень
  ctx.fillStyle='rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0,22,18,7,0,0,Math.PI*2); ctx.fill();

  const flash = ent.hitFlash > GameTime;
  const img = ent._skinImg;

  // Ширина из реальных пропорций PNG (без искажения аспекта)
  let spriteW = 16; // дефолт пока картинка не загрузилась
  if(img && img.naturalWidth > 0 && img.naturalHeight > 0){
    spriteW = CHAR_SPRITE_H * (img.naturalWidth / img.naturalHeight);
  }

  // Мягкое белое свечение позади игрока (у бота — нет) — радиальный градиент,
  // без видимого сплошного круга, только затухающее гало.
  if(ent === P){
    const glowIntensity = sv('playerglow');
    if(glowIntensity > 0.01){
      const glowCX = 0, glowCY = CHAR_SPRITE_OFFSET_Y + CHAR_SPRITE_H/2;
      const glowR = Math.max(spriteW, CHAR_SPRITE_H) * 0.7 * glowIntensity;
      const grad = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, glowR);
      const centerAlpha = Math.min(0.55, 0.25 * glowIntensity);
      grad.addColorStop(0,    `rgba(255,255,255,${centerAlpha})`);
      grad.addColorStop(0.5,  `rgba(255,255,255,${centerAlpha*0.35})`);
      grad.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(glowCX, glowCY, glowR, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  if(img && img.complete && img.naturalWidth > 0){
    if(flash){
      ctx.save();
      ctx.filter = 'sepia(1) saturate(6) hue-rotate(-30deg) brightness(0.9)';
    } else if(ent === P){
      ctx.save();
      ctx.filter = 'brightness(1.2)'; // игрок на 20% ярче остальных
    }
    ctx.drawImage(img, -spriteW/2, CHAR_SPRITE_OFFSET_Y, spriteW, CHAR_SPRITE_H);
    if(flash || ent === P) ctx.restore();
  } else {
    // Спрайт ещё не загрузился — временный плейсхолдер-силуэт,
    // чтобы не было пустоты пока качается PNG
    ctx.fillStyle = ent===P ? 'rgba(90,160,255,0.25)' : 'rgba(255,80,70,0.25)';
    ctx.fillRect(-spriteW/2, CHAR_SPRITE_OFFSET_Y, spriteW, CHAR_SPRITE_H);
  }
  ctx.restore();
  drawStatusEffects(ent, cscl);
}
function drawDummy(){
  if(!dummyOn) return;
  const drc = {x: D.x+5, y: D.y-8};
  const dpivX = drc.x + D.pvX, dpivY = drc.y + D.pvY;
 

function _drawDummySword(){
  const weaponKey = weaponDefFor(D).key;
  
  // 🔥 ДЛЯ ЛУКА — ИСПОЛЬЗУЕМ СПЕЦИАЛЬНУЮ ФУНКЦИЮ
  if(weaponKey === 'bow'){
    drawWeaponWithShake(D, dpivX, dpivY);
    return;
  }
  
  // 🔥 ЕДИНАЯ ТРЯСКА ДЛЯ ЖЕЗЛА И МАГИЧЕСКОГО ПОСОХА БОТА
  let shakeX = 0, shakeY = 0, shakeAngle = 0;
  if((weaponKey === 'wand' || weaponKey === 'magicstaff') && 
     (D._wandCharging || D._magicCharging)){
    shakeX = D._chargeShakeX || 0;
    shakeY = D._chargeShakeY || 0;
    shakeAngle = D._chargeShakeAngle || 0;
  }
  
  ctx.save();
  ctx.translate(dpivX + shakeX, dpivY + shakeY);
  ctx.rotate(D.angle + Math.PI/2 + shakeAngle);
  const dSw = effSwordScale(D) * sv('swlen') * sv('botswordscale');
  ctx.scale(dSw, dSw);
  const spd2 = Math.abs(D.vel);
  let dGlowColor = null, dGlowBlur = 0;
  if(D.rageBuffEnd > GameTime){
    dGlowColor = 'rgba(255,20,0,1.0)';
    dGlowBlur = 30 + spd2 * 20;
  }
  const dImg = D._weaponImg;
  if(weaponKey === 'flail'){
    drawFlailSprite(ctx, D, weaponLenFor(D), dGlowColor, dGlowBlur);
  } else if(dImg && dImg.complete && dImg.naturalWidth > 0){
    drawSwordSprite(ctx, dImg, weaponLenFor(D), dGlowColor, dGlowBlur, 
      CENTER_GRIP_CATEGORIES.includes(weaponDefFor(D).category), weaponKey);
  }
  ctx.restore();
}

  // Если щит в той же руке что меч — рисуем меч ЗА телом
  const _dSwordBehind = shieldDef(D) && shieldSameSideAsSword(D);
  if(_dSwordBehind) _drawDummySword();
  drawChar(D, sv('cscl') * sv('botscale'), '#4a1a10', '#6a2a18');
  if(!_dSwordBehind) _drawDummySword();

  // 🔥 РИСУЕМ СТРЕЛУ НА ЛУКЕ БОТА (поверх всего)
  drawBowArrow(D);

  // хит-флеш бота
  if(dummyOn && D.hitFlash > GameTime){
    const flashAlphaD = Math.min(0.25, (D.hitFlash - GameTime) / 0.25 * 0.25);
    ctx.fillStyle=`rgba(255,40,40,${flashAlphaD})`;
    ctx.fillRect(0,0,W,H);
  }
}







function drawCursor(){
  ctx.strokeStyle=mDown?'rgba(220,160,60,0.85)':'rgba(100,190,255,0.65)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(mX-9,mY); ctx.lineTo(mX+9,mY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mX,mY-9); ctx.lineTo(mX,mY+9); ctx.stroke();
  ctx.beginPath(); ctx.arc(mX,mY,5,0,Math.PI*2); ctx.stroke();

  // debug удалён

  ctx.textAlign = 'left';
}

function drawFX(){
  for(let i=hitFX.length-1;i>=0;i--){
    const f=hitFX[i];
    ctx.globalAlpha=Math.max(0,f.life/40);
    ctx.font=f.big?'bold 22px Oswald':'bold 12px Share Tech Mono';
    ctx.fillStyle=f.col||(f.big?'#ffcc44':'#ff7744');
    ctx.shadowColor=f.big?'#ff8800':'#ff4400'; ctx.shadowBlur=8;
    ctx.textAlign='center'; ctx.fillText(f.t, f.x, f.y-(40-f.life)*0.4);
    ctx.globalAlpha=1; ctx.shadowBlur=0; f.life--;
    if(f.life<=0) hitFX.splice(i,1);
  }
  ctx.textAlign='left';
}

// ──────────────── END LAYER: ARENA ────────────────

// ════════════════════════════════════════════════════════════════════════════
