// === src/combat/flail.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: WEAPONS: FLAIL — модуль цепа (динамическая длина, инерция)
// Module file: flail.js
// ════════════════════════════════════════════════════════════════════════════

// Цеп рисуется из 3 частей: навершие (ent._weaponImg) на самом конце цепи +
// вереница колец (чередуя ent._flailRing1Img / _flailRing2Img), заполняющая
// расстояние от рукояти до навершия. Кольца — ФИКСИРОВАННОГО размера
// (вариант "А"): при удлинении цепи колец физически становится больше,
// при укорачивании — меньше (а не растягиваются/сжимаются как одна деталь).
const FLAIL_HEAD_LEN = 32;  // локальный размер навершия (увеличен в 2 раза)
const FLAIL_RING_LEN = 11;  // локальный размер одного звена цепи
const FLAIL_MAX_LAG_PX = 50; // макс. боковой "провис" цепи у самого кончика (в местных единицах, база до слайдера)

function drawFlailSprite(ctx2, ent, length, glowColor, glowBlur){
    if(ent._flailNodes){ drawFlailChain(ctx2, ent, glowColor, glowBlur); return; }
    if(glowColor){ ctx2.shadowColor = glowColor; ctx2.shadowBlur = glowBlur; }

    const headImg  = ent._weaponImg;       // кончик = навершие (из Tip/)
    const ring1Img = ent._flailRing1Img;   // кольцо 1 (из Ring/)
    const ring2Img = ent._flailRing2Img;   // кольцо 2 (из Ring/)

    // Длина цепи = общая длина - навершие
    const chainLen = Math.max(0, length - FLAIL_HEAD_LEN);
    const ringCount = Math.max(2, chainLen > 0 ? Math.floor(chainLen / FLAIL_RING_LEN) : 2);
    const actualRingLen = Math.max(FLAIL_RING_LEN, chainLen / ringCount);

    // Провисание
    const lagFactor = ent._flailLagVel != null ? ent._flailLagVel : (ent.vel || 0);
    const normalizedLag = $.M.clamp(lagFactor / (sv('swthresh') || 1), -1, 1);
    const lagAmount = normalizedLag * 3;

    const hiltShift = length * SWORD_HILT_OFFSET * 0.4;
    let cursor = hiltShift;

    // ── 1️⃣ СНАЧАЛА РИСУЕМ КОЛЬЦА ──
    for(let i = 0; i < ringCount; i++){
        const ringImg = (i % 2 === 0) ? ring1Img : ring2Img;
        const t = (i + 1) / ringCount;
        const ringLag = lagAmount * t * 0.5;
        
        if(ringImg && ringImg.complete && ringImg.naturalWidth > 0){
            const rw = actualRingLen * spriteAspectFor(ringImg);
            ctx2.drawImage(ringImg, -rw/2 + ringLag, cursor, rw, -actualRingLen);
        }
        cursor -= actualRingLen;
    }
    
    // ── 2️⃣ ПОТОМ КОНЧИК В КОНЦЕ (ПОСЛЕ КОЛЕЦ) ──
    if(headImg && headImg.complete && headImg.naturalWidth > 0){
        const hw = FLAIL_HEAD_LEN * spriteAspectFor(headImg);
        const headLag = lagAmount * 0.9; // сильнее провисание на конце
        ctx2.drawImage(headImg, -hw/2 + headLag, cursor + 2, hw, -FLAIL_HEAD_LEN);
    }
    
    ctx2.shadowBlur = 0;
}

// Возвращает длину клинка для рендера с учётом масштаба вида оружия
// ── МОДУЛЬ ЦЕПА (flail): динамическая длина цепи ────────────────────────────
// Длина цепи не статична — она "разматывается" от скорости вращения оружия
// (ent.vel — та же угловая скорость замаха, что используется для урона мечом).
// FLAIL_MIN_SCALE — цепь сложена (длина как у кинжала, scale=0.4);
// FLAIL_MAX_SCALE — цепь полностью раскручена (длиннее огромного меча).
const FLAIL_MIN_SCALE = 0.4;
// ✅ Увеличено в 1.4 раза (было 2.2) — цеп на полном раскруте теперь достаёт
// заметно дальше.
const FLAIL_MAX_SCALE = 2.2 * 1.4; // = 3.08
// Насколько плавно pFlailExt/bFlailExt едет к целевому значению — не мгновенно,
// но достаточно отзывчиво, чтобы цепь ощутимо реагировала на скорость замаха
// (параметр в том же формате, что и у lerpDT в других местах файла: 0..1).
// ✅ Понижено (было 0.35) — растягивание цепи ощущалось слишком быстрым/резким.
const FLAIL_EXT_SMOOTH_RATE = 0.22;
// ✅ У бота цепь растягивалась ЕЩЁ быстрее, чем у игрока (bot.vel быстро выходит
// на целевую величину через свой отдельный lerp в updateDummy/updateBotAI до
// того, как попадёт сюда) — принудительно замедляем растяжение у бота до 0.7
// от скорости игрока, чтобы бот не раскручивался быстрее/резче игрока.
const FLAIL_EXT_BOT_MULT = 0.7;

const FLAIL_MAX_EXT_TRIGGER = 0.97; // порог, при котором считаем "цепь раскручена до конца"
const FLAIL_STAM_BONUS = 50;
const FLAIL_STAM_BONUS_CD = 3; // сек

// ── Инерция цепи при остановке/развороте вращения ───────────────────────────
// Раньше цепь можно было остановить мгновенно: как только vel падал/менял
// знак, target для _flailExt тут же обрушивался, и цепь (визуально) сжималась
// обратно почти как прямая палка. Физически цепь должна ещё какое-то время
// докручиваться по инерции, продолжая уменьшаться САМА, а не по новому
// управляющему вводу — и в это время игрок/бот не должен иметь возможность
// снова мгновенно раскрутить или остановить её через ввод (контроль вращений
// временно отбирается). Срабатывает только если цепь была раскручена больше
// чем на FLAIL_INERTIA_RING_TRIGGER звеньев — на коротком, почти сложенном
// цепе инерция не нужна и всё работает как раньше.
const FLAIL_INERTIA_RING_TRIGGER = 3;
const FLAIL_INERTIA_LOCK_TIME = 0.55; // сек — на столько отбирается контроль вращений цепи
const FLAIL_INERTIA_DECAY = 0.93;     // затухание _flailExt во время инерции (ближе к 1 = дольше крутится)

// Сколько звеньев цепи соответствует данному значению ext — используется,
// чтобы синхронно с drawFlailSprite решить, "раскручена ли цепь больше 3 звеньев".
function flailRingCountForExt(ext){
  const scale = FLAIL_MIN_SCALE + (FLAIL_MAX_SCALE - FLAIL_MIN_SCALE) * $.M.clamp(ext || 0, 0, 1);
  const length = SWORD_LEN * scale;
  const chainLen = Math.max(0, length - FLAIL_HEAD_LEN);
  return Math.max(2, chainLen > 0 ? Math.round(chainLen / FLAIL_RING_LEN) : 2);
}






// ── МОДУЛЬ ЦЕПА: ЕДИНАЯ механика — используется и для игрока, и для ЛЮБОГО
// бота через одну и ту же функцию (раньше у бота была отдельная, более
// простая логика растяжения — из-за этого поведение отличалось от игрока).
// targetAng — угол на цель (курсор у игрока / положение противника у бота),
// rawDt — РЕАЛЬНАЯ дельта кадра (не фиксированный физический тик).

function updateFlailSwing(ent, targetAng, rawDt, directAim = false){
    if(!directAim && ent._flailState==='AXE_SWING') ent._flailState='FOLLOW';
    // ⚠️ КОНСТАНТЫ В САМОМ НАЧАЛЕ
    // ⚠️ КОНСТАНТЫ В САМОМ НАЧАЛЕ
    const FLAIL_GROW_MIN_ANGLE = isBot(ent) ? 0.15 : 0.65; // +0.1 для игрока
    const FLAIL_GROW_MIN_SPEED = isBot(ent) ? 0.4 : 1.8;   // +0.2 для игрока
    
    if (ent._flailState === undefined) {
        ent._flailState = 'FOLLOW';
        ent._flailExt = 0;
        ent._flailSpinSpeed = 0;
        ent._flailDirection = 1;
        ent._flailFreeAngle = ent.angle;
        ent._flailPrevCursorAngle = targetAng;
        ent._flailTimeInState = 0;
        ent._flailAccumAngle = 0;
        ent._flailAccumDir = 0;
        ent._flailPrevAngle = ent.angle;
        ent._flailWasAtMax = false;
    }

    const cursorDelta = $.M.angDiff(targetAng, ent._flailPrevCursorAngle ?? targetAng);
    ent._flailPrevCursorAngle = targetAng;

    if(ent._flailOrbitPrevious==null) ent._flailOrbitPrevious=ent.angle;
    if(isExhausted(ent) || isUnbalanced(ent) ||
       (!ent._flailFoldLocked && !ent._flailAttack && detectFlailFlick(ent,cursorDelta,rawDt))){
        beginFlailFold(ent);
    }
    if(ent._flailAttack) return;
    if(ent._flailFoldLocked){ updateForcedFlailFold(ent,targetAng,rawDt); return; }

    const MAX_CURSOR_DELTA = 0.5;
    const clampedDelta = $.M.clamp(cursorDelta, -MAX_CURSOR_DELTA, MAX_CURSOR_DELTA);

    const isMouseMoving = Math.abs(clampedDelta) > 0.005;
    const mouseSpeed = Math.abs(clampedDelta) / Math.max(rawDt, 0.001);
    const mouseDirection = Math.sign(clampedDelta) || 1;

    // ── Накопитель устойчивого вращения ──
    if (isMouseMoving) {
        // ДЛЯ БОТОВ: ускоряем накопление мягче, чтобы цепь не раскрывалась за пол-оборота.
        const accumMult = isBot(ent) ? 1.5 : 2.0;
        if (ent._flailAccumDir === 0 || mouseDirection === ent._flailAccumDir) {
            ent._flailAccumAngle = (ent._flailAccumAngle || 0) + Math.abs(clampedDelta) * accumMult;
        } else {
            ent._flailAccumAngle = Math.abs(clampedDelta) * accumMult;
        }
        ent._flailAccumDir = mouseDirection;
    } else {
        ent._flailAccumAngle = Math.max(0, (ent._flailAccumAngle || 0) - 2.0 * rawDt);
        if (ent._flailAccumAngle <= 0) ent._flailAccumDir = 0;
    }

    // БОТЫ: принудительно считаем, что они всегда "двигают курсор"
    const isRealSpin = isMouseMoving
        && (mouseSpeed > FLAIL_GROW_MIN_SPEED || isBot(ent))
        && (ent._flailAccumAngle >= FLAIL_GROW_MIN_ANGLE || (isBot(ent) && ent._flailAccumAngle > 0.01));

    const chainLen = Math.max(0, weaponLenFor(ent) - FLAIL_HEAD_LEN);
    const ringCount = Math.max(2, chainLen > 0 ? Math.floor(chainLen / FLAIL_RING_LEN) : 2);
    const isShort = ringCount <= 4;
    const isLong = ringCount > 4;

    let directionChanged = isMouseMoving && mouseDirection !== ent._flailDirection;
    if(directAim && isBot(ent) && directionChanged && GameTime < (ent._flailDirectionLockUntil || 0)){
        directionChanged = false;
    }
    if(directAim){
        // Follow the axe AI's sweep/spin target; retain the chain's flick and status rules.
        ent._flailState='AXE_SWING';
        ent.angle+=$.M.clamp($.M.angDiff(targetAng,ent.angle),-11.2*rawDt,11.2*rawDt);
        const botGrowMult = isBot(ent) ? 0.5 : 1.0;
        ent._flailExt=$.M.clamp((ent._flailExt||0)+(isRealSpin?botGrowMult:-0.84)*rawDt,0,1);
        ent._flailFreeAngle=ent.angle;ent._flailIsLerping=false;
    }

    // ── СОСТОЯНИЕ 1: FOLLOW ──
       if (ent._flailState === 'FOLLOW') {
        // Если мы в процессе плавного поворота - не вмешиваемся
        if (!ent._flailIsLerping) {
            ent.angle = $.M.angLerpDT(ent.angle, targetAng, 0.25, rawDt);
        }
        if (isRealSpin && isLong) {
            ent._flailState = 'SPIN';
            ent._flailFreeAngle = ent.angle;
            ent._flailDirection = mouseDirection;
            if(isBot(ent)) ent._flailDirectionLockUntil = GameTime + 3;
            ent._flailSpinSpeed = Math.min(5.0, mouseSpeed * 0.8);
            // Боты получают бонусную скорость
            if(isBot(ent)) ent._flailSpinSpeed = Math.min(5.0, ent._flailSpinSpeed * 1.5);
            // Сбрасываем lerp если начали вращение
            ent._flailIsLerping = false;
        } else if (isRealSpin) {
            ent._flailExt = Math.min(1, ent._flailExt + 1.0 * rawDt);
            ent._flailIsLerping = false;
        } else {
            ent._flailExt = Math.max(0, ent._flailExt - 1.5 * rawDt);
        }
    }

    // ── СОСТОЯНИЕ 2: SPIN ──
        if (ent._flailState === 'SPIN') {
        if (isMouseMoving && mouseDirection === ent._flailDirection) {
            const targetSpeed = Math.min(5.0, mouseSpeed * 0.8);
            const speedDiff = targetSpeed - ent._flailSpinSpeed;
            ent._flailSpinSpeed += speedDiff * Math.min(1, 4.0 * rawDt);
            ent._flailSpinSpeed = Math.min(5.0, ent._flailSpinSpeed);
        }
        if (directionChanged || !isMouseMoving) {
            // 🌀 ПЛАВНЫЙ ПЕРЕХОД В RETRACT (сохраняем скорость)
            ent._flailState = 'RETRACT';
            ent._flailTimeInState = 0;
            // НЕ ОБНУЛЯЕМ ent._flailSpinSpeed!
        }
        if(ent._flailState==='SPIN'){
            ent._flailFreeAngle += ent._flailDirection * ent._flailSpinSpeed * 2.1 * rawDt;
            ent.angle = ent._flailFreeAngle;
            ent._flailExt = Math.min(1, ent._flailExt + 0.2 * rawDt);
        }
    }

    // ── СОСТОЯНИЕ 3: RETRACT ──
    if (ent._flailState === 'RETRACT') {
        // 🔄 ПРОВЕРЯЕМ: если игрок снова начал крутить - переходим обратно в SPIN
        // НО с более высоким порогом, чтобы цепь не дёргалась от малейшего движения!
        const RESUME_MIN_ANGLE = isBot(ent) ? 0.05 : 0.35; // Для игрока нужно накопить 0.35 рад (20°)
        const RESUME_MIN_SPEED = isBot(ent) ? 0.2 : 1.2;   // И скорость должна быть выше
        
        const isSpinningAgain = isMouseMoving && 
            mouseSpeed > RESUME_MIN_SPEED &&
            ent._flailAccumAngle >= RESUME_MIN_ANGLE &&
            isLong &&
            ent._flailExt > 0.05; // Не переходить если цепь уже почти скрутилась
        
        if (isSpinningAgain) {
            // Возобновляем вращение, но с плавным набором скорости
            ent._flailState = 'SPIN';
            ent._flailDirection = mouseDirection;
            if(isBot(ent)) ent._flailDirectionLockUntil = GameTime + 3;
            // Скорость растёт плавно от текущей, а не резко
            const targetSpinSpeed = Math.min(5.0, mouseSpeed * 0.6);
            ent._flailSpinSpeed = ent._flailSpinSpeed * 0.6 + targetSpinSpeed * 0.4;
            ent._flailFreeAngle = ent.angle;
            ent._flailIsLerping = false;
            // Сбрасываем накопленный угол, чтобы не было мгновенного повторного перехода
            ent._flailAccumAngle = 0;
            // Не уменьшаем _flailExt дальше
            return;
        }
        
        // ⚡ ВРАЩЕНИЕ ПРОДОЛЖАЕТСЯ (инерция) - НЕ ЗАТУХАЕТ, ПОКА ЦЕПЬ НЕ СКРУТИТСЯ
        ent._flailFreeAngle += ent._flailDirection * ent._flailSpinSpeed * 2.1 * rawDt;
        ent.angle = ent._flailFreeAngle;
        
        // Медленное скручивание цепи
        ent._flailExt = Math.max(0, ent._flailExt - 0.84 * rawDt);
        
        // Когда цепь полностью скрутилась - начинаем плавный поворот к курсору
        if (ent._flailExt <= 0) {
            ent._flailState = 'FOLLOW';
            // Сохраняем текущий угол для плавного перехода
            const currentAngle = ent.angle;
            ent._flailSpinSpeed = 0;
            
            // Запоминаем угол, с которого начинаем lerp
            ent._flailLerpStartAngle = currentAngle;
            ent._flailLerpTargetAngle = targetAng;
            ent._flailLerpTimer = 0;
            ent._flailLerpDuration = 1.0; // 1 секунда на плавный поворот
            ent._flailIsLerping = true;
        }
    }
    // ── ПЛАВНЫЙ LERP ПОСЛЕ СКРУЧИВАНИЯ ──
    if (ent._flailIsLerping) {
        ent._flailLerpTimer += rawDt;
        const progress = Math.min(1, ent._flailLerpTimer / ent._flailLerpDuration);
        
        // Плавный переход (ease-in-out)
        const eased = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // Интерполируем угол
        let diff = $.M.angDiff(ent._flailLerpTargetAngle, ent._flailLerpStartAngle);
        ent.angle = ent._flailLerpStartAngle + diff * eased;
        
        // Завершили lerp
        if (progress >= 1) {
            ent._flailIsLerping = false;
            ent.angle = ent._flailLerpTargetAngle;
        }
    }

    // ── Угловая скорость ──
    if (ent._flailPrevAngle !== undefined && ent._flailPrevAngle !== null) {
        const MAX_ANGLE_STEP = 11.2 * rawDt;
        const rawStep = $.M.angDiff(ent.angle, ent._flailPrevAngle);
        const clampedStep = Math.max(-MAX_ANGLE_STEP, Math.min(MAX_ANGLE_STEP, rawStep));
        ent.angle = ent._flailPrevAngle + clampedStep;
    }
    const realAngVel = (ent._flailPrevAngle !== undefined && ent._flailPrevAngle !== null)
        ? $.M.angDiff(ent.angle, ent._flailPrevAngle) / Math.max(rawDt, 0.004)
        : 0;
    ent._flailPrevAngle = ent.angle;
    ent.vel = realAngVel;
    ent._flailLagVel = ent.vel;

    // ── Бонус стамины за полную раскрутку ──
    const atMax = ent._flailExt >= FLAIL_MAX_EXT_TRIGGER;
    if (atMax && !ent._flailWasAtMax && GameTime >= (ent._flailStamCD||0)) {
        ent.stamina = Math.min(ent.stamMax||100, (ent.stamina||0) + FLAIL_STAM_BONUS);
        ent._flailStamCD = GameTime + FLAIL_STAM_BONUS_CD;
        const c = $.POS.body(ent);
        $.FX.hit({x:c.x, y:c.y-40, t:'⚡ РАЗГОН!', life:35, big:false, col:'#ffdd44'});
    }
    ent._flailWasAtMax = atMax;
}













// Сброс состояния цепа при смене оружия на НЕ-цеп — чтобы при повторном
// взятии цепа состояние стартовало заново с FOLLOW, а не "зависало".
function updateFlailExtension(ent, dt){
  if(!ent) return;
  if(weaponKeyOf(ent) !== 'flail'){
    ent._flailExt = 0;
    ent._flailState = undefined;
    ent._flailWasAtMax = false;
  }
}





// Текущий эффективный "scale" цепа — заменяет статичное def.scale из таблицы.
function flailScaleFor(ent){
  const ext = $.M.clamp(ent._flailExt || 0, 0, 1);
  return FLAIL_MIN_SCALE + (FLAIL_MAX_SCALE - FLAIL_MIN_SCALE) * ext;
}

// ──────────────── END LAYER: WEAPONS_FLAIL ────────────────

// ════════════════════════════════════════════════════════════════════════════

// Lunge authority belongs to the attacking peer; ring simulation is cosmetic.
const FLAIL_LUNGE_OUT_TIME = 0.18;
const FLAIL_LUNGE_RETURN_TIME = 0.32;
const FLAIL_PULL_TIME = 0.6;
const FLAIL_NODE_COUNT = 17;
let flailAttackSerial = Date.now();

function flailWorldScale(ent){
    return effSwordScale(ent) * sv('swlen') * (isBot(ent) ? sv('botswordscale') : 1);
}
function flailRemote(ent){ return typeof NET_SYNC !== 'undefined' && NET_SYNC.active && ent === D; }
function flailBusy(ent){ return !!ent._flailAttack || ent._flailAttackEnd === GameTime; }
function resetFlailCombat(ent){
    if(!ent) return;
    if(ent===P && ent._flailAttack && typeof NET_SYNC!=='undefined' && NET_SYNC.active)
        $.NET.send({type:'flailCancel',id:ent._flailAttack.id});
    if(ent._flailAttack && ent._flailAttack.target && ent._flailAttack.target._flailPull?.owner === ent)
        ent._flailAttack.target._flailPull = null;
    ent._flailAttack = null;
    ent._flailPull = null;
    ent._flailNodes = null;
    ent._flailDrawNodes = null;
    ent._flailChainAngle = null;
    ent._flailPress = false;
    ent._flailAttackEnd = -1;
    ent._flailNetTime = -1;
    ent._flailNetTarget = null;
    ent._flailFoldLocked=false;
    ent._flailFlick=null;
    ent._flailOrbitPrevious=null;
    ent._flailOrbitAccum=0;
    ent._flailOrbitDirection=0;
}
function flailTryHook(ent, angle){
    flailInput(ent, true, angle);
    flailInput(ent, false, angle);
}

function startFlailLunge(ent, angle, spendRage){
    if(flailRemote(ent) || weaponKeyOf(ent) !== 'flail' || flailBusy(ent) || ent._flailFoldLocked || isUnbalanced(ent) ||
       ent.hp <= 0 || ent.hasWeapon === false || isExhausted(ent) || !(ent.rage >= 50)) return false;
    const pivot = $.POS.pivot(ent), scale = flailWorldScale(ent);
    if(spendRage) ent.rage -= 50;
    ent._flailAttack = { id: ++flailAttackSerial, phase: 'out', angle, time: 0,
        reach: SWORD_LEN * FLAIL_MAX_SCALE * scale * 1.5, x: pivot.x, y: pivot.y,
        speed: Math.max(Math.abs(ent.vel || 0), sv('swthresh')),
        tested: new Set(), target: null };
    ent._flailIsLerping = false;
    $.S.play('hammerSwing');
    return true;
}

globalThis.tryMobileFlailLunge = function(ent, angle){ return startFlailLunge(ent, angle, false); };

function flailInput(ent, down, angle){
    const pressed = down && !ent._flailPress;
    ent._flailPress = !!down;
    if(pressed) startFlailLunge(ent, angle, true);
}
// Earliest intersection of a swept point with an expanded rectangle.
function flailRectHit(ax, ay, bx, by, x, y, w, h, radius){
    let lo = 0, hi = 1;
    for(const [a, d, min, max] of [[ax,bx-ax,x-radius,x+w+radius],[ay,by-ay,y-radius,y+h+radius]]){
        if(Math.abs(d) < 1e-9){ if(a < min || a > max) return null; }
        else {
            let t0 = (min-a)/d, t1 = (max-a)/d;
            if(t0 > t1) [t0,t1] = [t1,t0];
            lo = Math.max(lo,t0); hi = Math.min(hi,t1);
            if(lo > hi) return null;
        }
    }
    return lo;
}
function flailCircleHit(ax,ay,bx,by,cx,cy,r){
    const dx=bx-ax, dy=by-ay, ox=ax-cx, oy=ay-cy;
    const c=ox*ox+oy*oy-r*r;
    if(c<=0) return 0;
    const a=dx*dx+dy*dy, b=ox*dx+oy*dy, disc=b*b-a*c;
    if(a<1e-9 || disc<0) return null;
    const t=(-b-Math.sqrt(disc))/a;
    return t>=0 && t<=1 ? t : null;
}
function flailCapsuleHit(ax,ay,bx,by,cx,cy,dx,dy,r){
    const len=Math.hypot(dx-cx,dy-cy);
    if(len<1e-9) return flailCircleHit(ax,ay,bx,by,cx,cy,r);
    const ux=(dx-cx)/len, uy=(dy-cy)/len;
    const t=flailRectHit((ax-cx)*ux+(ay-cy)*uy, -(ax-cx)*uy+(ay-cy)*ux,
        (bx-cx)*ux+(by-cy)*uy, -(bx-cx)*uy+(by-cy)*ux, 0,-r,len,2*r,0);
    const hits=[t,flailCircleHit(ax,ay,bx,by,cx,cy,r),flailCircleHit(ax,ay,bx,by,dx,dy,r)].filter(v=>v!==null);
    return hits.length ? Math.min(...hits) : null;
}
function flailWallHit(ax,ay,bx,by,r){
    let first=null;
    const consider=t=>{ if(t!==null && (first===null || t<first)) first=t; };
    if(typeof boxesOn!=='undefined' && boxesOn){
        for(const b of BOXES) consider(flailRectHit(ax,ay,bx,by,b.x,b.y,b.w,b.h,r));
    }
    if(bx<r) consider(Math.max(0,(r-ax)/(bx-ax)));
    if(bx>WORLD_W-r) consider(Math.max(0,(WORLD_W-r-ax)/(bx-ax)));
    if(by<r) consider(Math.max(0,(r-ay)/(by-ay)));
    if(by>WORLD_H-r) consider(Math.max(0,(WORLD_H-r-ay)/(by-ay)));
    return first;
}
function flailLungeContact(ent,a,nx,ny,entities){
    const radius=5*flailWorldScale(ent), hits=[];
    const wall=flailWallHit(a.x,a.y,nx,ny,radius);
    if(wall!==null) hits.push({t:wall,kind:'wall'});
    if(typeof SurvivalMode!=='undefined' && SurvivalMode.segmentHitObject){
        const propHit=SurvivalMode.segmentHitObject(a.x,a.y,nx,ny,radius,0.8,false);
        if(propHit) hits.push({t:propHit.t,kind:'arenaProp',object:propHit.object});
    }
    for(const other of entities){
        if(other===ent || other.hp<=0 || other._defeated || other._awaitingReveal ||
            (typeof FactionRules!=='undefined' && !FactionRules.canDamage(ent,other))) continue;
        const c=$.POS.body(other);
        if(shieldHeld(other)){
            const sh=shieldCenter(other,ent.x);
            if(sh){
                const w=other._shieldW||20, h=other._shieldH||30;
                const t=flailRectHit(a.x,a.y,nx,ny,sh.x-w/2,sh.y-h/2,w,h,radius);
                if(t!==null) hits.push({t,kind:'shield',other});
            }
        }
        if(!a.tested.has(other) && !isWeaponDisabled(other) && weaponCollisionType(other)!=='none'){
            const p=$.POS.pivot(other), span=weaponColliderSpan(other);
            const sc=sv('swlen')*(isBot(other)?sv('botswordscale'):1);
            const dx=Math.cos(other.angle), dy=Math.sin(other.angle);
            const t=flailCapsuleHit(a.x,a.y,nx,ny,p.x-dx*span.back*sc,p.y-dy*span.back*sc,
                p.x+dx*span.front*sc,p.y+dy*span.front*sc,radius+BLADE_W/2);
            if(t!==null) hits.push({t,kind:'weapon',other});
        }
        const t=flailCircleHit(a.x,a.y,nx,ny,c.x,c.y,14*sv('cscl')*(other._bodyScaleMult||1)+radius);
        if(t!==null) hits.push({t,kind:'body',other});
    }
    hits.sort((a,b)=>a.t-b.t);
    for(const hit of hits){
        if(hit.kind==='weapon'){
            a.tested.add(hit.other);
            if(Math.random()>=0.5) continue;
        }
        return hit;
    }
    return null;
}
function finishFlailLunge(ent){
    ent._flailAttack=null;
    ent._flailAttackEnd=GameTime;
    ent._flailState='FOLLOW'; ent._flailExt=0; ent._flailSpinSpeed=0;
    ent._flailAccumAngle=0; ent._flailPrevAngle=ent.angle;
    ent._flailFreeAngle=ent.angle; ent.vel=0;
}
function flailPullStopFor(target,owner,halfPath){
    const normalStop=SWORD_LEN*flailWorldScale(owner);
    if(!halfPath) return normalStop;
    const c=$.POS.body(target), o=$.POS.body(owner);
    const dist=Math.hypot(o.x-c.x,o.y-c.y);
    return Math.max(normalStop,(dist+normalStop)*0.5);
}
function startFlailPull(target,owner,id,opts){
    if(target.hp<=0 || target._flailPull) return;
    target._flailPull={owner,id,time:0,stop:flailPullStopFor(target,owner,opts?.halfPath)};
    const recoil=Math.min(DISBALANCE_RECOIL_DURATION,1.5);
    startBuff(target,'DISBALANCE',recoil,1.5-recoil);
}
function updateFlailPull(ent,dt){
    const pull=ent._flailPull;
    if(!pull || flailRemote(ent)) return;
    const owner=pull.owner;
    pull.time+=dt;
    if(ent.hp<=0 || owner.hp<=0 || owner.hasWeapon===false || weaponKeyOf(owner)!=='flail' ||
       pull.time>FLAIL_PULL_TIME || (!flailRemote(owner) && owner._flailAttack?.id!==pull.id)){
        ent._flailPull=null; return;
    }
    const c=$.POS.body(ent), o=$.POS.body(owner), dx=o.x-c.x, dy=o.y-c.y;
    const dist=Math.hypot(dx,dy), stop=Math.max(pull.stop,32*sv('cscl'));
    if(dist<=stop){ ent._flailPull=null; return; }
    const step=Math.min(dist-stop,SWORD_LEN*FLAIL_MAX_SCALE*flailWorldScale(owner)/0.3*dt);
    const nx=c.x+dx/dist*step, ny=c.y+dy/dist*step;
    const wall=flailWallHit(c.x,c.y,nx,ny,14*sv('cscl'));
    const fraction=wall===null ? 1 : Math.max(0,wall-0.001);
    ent.x=$.M.clamp(ent.x+(nx-c.x)*fraction,40,WORLD_W-80);
    ent.y=$.M.clamp(ent.y+(ny-c.y)*fraction,40,WORLD_H-40);
    ent.vx=0; ent.vy=0; ent._dvx=0; ent._dvy=0;
    if(wall!==null) ent._flailPull=null;
}
function updateFlailLunge(ent,dt,entities){
    const a=ent._flailAttack;
    if(!a || flailRemote(ent)) return;
    if(ent.hp<=0 || ent.hasWeapon===false || weaponKeyOf(ent)!=='flail'){
        resetFlailCombat(ent); return;
    }
    const p=$.POS.pivot(ent);
    a.time+=dt;
    ent.angle=a.angle; ent.vel=0;
    if(a.phase==='out'){
        const distance=a.reach*Math.min(1,a.time/FLAIL_LUNGE_OUT_TIME);
        let nx=p.x+Math.cos(a.angle)*distance, ny=p.y+Math.sin(a.angle)*distance;
        const hit=flailLungeContact(ent,a,nx,ny,entities);
        if(hit){
            nx=a.x+(nx-a.x)*hit.t; ny=a.y+(ny-a.y)*hit.t;
            if(hit.kind==='body'){
                if(applyFlailLungeDamage(ent,hit.other,a.speed)){
                    a.target=hit.other;
                    if(!flailRemote(hit.other)) startFlailPull(hit.other,ent,a.id);
                    else $.NET.send({type:'flailHit',id:a.id,newHp:hit.other.hp,dmg:ent._flailLastDamage});
                }
            } else if(hit.other){
                if(hit.kind==='shield') applyShieldBlockFX(nx,ny,ent,hit.other);
                else $.S.play(blockClashSoundFor(hit.other));
                a.target=hit.other;
                if(!flailRemote(hit.other)) startFlailPull(hit.other,ent,a.id,{halfPath:true});
                else $.NET.send({type:'flailHit',id:a.id,newHp:hit.other.hp,dmg:0,pullHalf:true});
            } else if(hit.kind==='arenaProp'){
                if(SurvivalMode.segmentHitObject) SurvivalMode.segmentHitObject(a.x,a.y,nx,ny,5*flailWorldScale(ent),0.8,true);
                $.S.play('clash');
            }
        }
        a.x=nx; a.y=ny;
        if(hit || a.time>=FLAIL_LUNGE_OUT_TIME){ a.phase='back'; a.time=0; }
    } else {
        if(a.target && a.target.hp>0 && a.time<FLAIL_PULL_TIME &&
           (flailRemote(a.target) || a.target._flailPull?.owner===ent)){
            const c=$.POS.body(a.target); a.x=c.x; a.y=c.y;
        } else {
            const dx=p.x-a.x,dy=p.y-a.y,dist=Math.hypot(dx,dy);
            const step=a.reach/FLAIL_LUNGE_RETURN_TIME*dt;
            if(dist<=step || a.time>FLAIL_PULL_TIME+FLAIL_LUNGE_RETURN_TIME){finishFlailLunge(ent);return;}
            a.x+=dx/dist*step; a.y+=dy/dist*step;
        }
    }
}
// Fixed-size Verlet chain; endpoints are authoritative, internal nodes are visual only.
function updateFlailChain(ent,dt){
    if(flailRemote(ent) && ent._flailAttack && ent._flailNetTarget){
        const t=1-Math.exp(-30*dt);
        ent._flailAttack.x+=(ent._flailNetTarget.x-ent._flailAttack.x)*t;
        ent._flailAttack.y+=(ent._flailNetTarget.y-ent._flailAttack.y)*t;
    }
    const scale=flailWorldScale(ent), p=$.POS.pivot(ent), a=ent._flailAttack;
    const length=weaponLenFor(ent)*scale;
    const hx=a?a.x:p.x+Math.cos(ent.angle)*length;
    const hy=a?a.y:p.y+Math.sin(ent.angle)*length;
    const chainAngle=Math.atan2(hy-p.y,hx-p.x);
    const angularSpeed=ent._flailChainAngle==null ? 0 : $.M.clamp(
        $.M.angDiff(chainAngle,ent._flailChainAngle)/Math.max(dt,0.001),-11.2,11.2);
    ent._flailChainAngle=chainAngle;
    const normalX=-Math.sin(chainAngle), normalY=Math.cos(chainAngle);
    const spin=a?0:angularSpeed;
    const headLen=FLAIL_HEAD_LEN*scale;
    const distance=Math.hypot(hx-p.x,hy-p.y)||1;
    const endX=hx-(hx-p.x)/distance*Math.min(headLen,distance);
    const endY=hy-(hy-p.y)/distance*Math.min(headLen,distance);
    let nodes=ent._flailNodes;
    if(!nodes || Math.hypot(nodes[0].x-p.x,nodes[0].y-p.y)>Math.max(100,length)){
        nodes=ent._flailNodes=Array.from({length:FLAIL_NODE_COUNT},(_,i)=>{
            const t=i/(FLAIL_NODE_COUNT-1),x=p.x+(endX-p.x)*t,y=p.y+(endY-p.y)*t;
            return {x,y,px:x,py:y};
        });
    }
    const n=nodes.length-1;
    const taut=a && a.phase==='out';
    const slack=taut?0:Math.min(0.22,0.16/(1+Math.abs(ent.vel||0)*0.15));
    const segment=Math.max(1,Math.hypot(endX-p.x,endY-p.y)*(1+slack)/n);
    const damp=Math.exp(-8*dt);
    for(let i=1;i<n;i++){
        const v=nodes[i], x=v.x,y=v.y;
        // Centrifugal tension plus lag opposite the actual rotation, not a fixed screen-side bend.
        const lagForce=-spin*120*scale*dt*dt;
        v.x+=(x-v.px)*damp+normalX*lagForce;
        v.y+=(y-v.py)*damp+normalY*lagForce+500*scale*dt*dt/(1+Math.abs(spin));
        v.px=x;v.py=y;
    }
    for(let pass=0;pass<6;pass++){
        nodes[0].x=p.x;nodes[0].y=p.y;nodes[n].x=endX;nodes[n].y=endY;
        for(let i=0;i<n;i++){
            const u=nodes[i],v=nodes[i+1],dx=v.x-u.x,dy=v.y-u.y,d=Math.hypot(dx,dy)||1;
            const error=(d-segment)/d;
            const w=i===0 || i+1===n ? 1 : 0.5;
            if(i!==0){u.x+=dx*error*w;u.y+=dy*error*w;}
            if(i+1!==n){v.x-=dx*error*w;v.y-=dy*error*w;}
        }
    }
    // The anchored tip must not make slack buckle ahead of a rotating chain.
    if(Math.abs(spin)>0.3){
        const direction=Math.sign(spin);
        for(let i=1;i<n;i++){
            const v=nodes[i],side=(v.x-p.x)*normalX+(v.y-p.y)*normalY;
            if(side*direction>0){
                const dx=normalX*side,dy=normalY*side;
                v.x-=dx;v.y-=dy;v.px-=dx;v.py-=dy;
            }
        }
    }
    nodes[0].x=p.x;nodes[0].y=p.y;nodes[n].x=endX;nodes[n].y=endY;
    // Keep Verlet history independent of visual bend amplitude. With the head anchored,
    // the visible chain bows toward rotation (the head trails the hand), not behind it.
    const drawn=ent._flailDrawNodes || (ent._flailDrawNodes=nodes.map(()=>({x:0,y:0})));
    const bendScale=Math.abs(spin)>0.3 ? -0.5 : 0.5;
    for(let i=0;i<=n;i++){
        const v=nodes[i],side=(v.x-p.x)*normalX+(v.y-p.y)*normalY;
        drawn[i].x=v.x+normalX*side*(bendScale-1);
        drawn[i].y=v.y+normalY*side*(bendScale-1);
    }
    ent._flailHeadX=hx;ent._flailHeadY=hy;
}
function drawFlailChain(c,ent,glow,blur){
    const nodes=ent._flailDrawNodes || ent._flailNodes, scale=flailWorldScale(ent);
    c.save();
    c.setTransform(CAM_SCALE,0,0,CAM_SCALE,-CAM_X*CAM_SCALE,-CAM_Y*CAM_SCALE);
    if(glow){c.shadowColor=glow;c.shadowBlur=blur;}
    let total=0;
    for(let i=1;i<nodes.length;i++) total+=Math.hypot(nodes[i].x-nodes[i-1].x,nodes[i].y-nodes[i-1].y);
    const count=Math.min(80,Math.max(2,Math.ceil(total/(FLAIL_RING_LEN*scale))));
    let index=1, walked=0;
    for(let i=0;i<count;i++){
        const distance=(i+0.5)/count*total;
        let u=nodes[index-1],v=nodes[index],len=Math.hypot(v.x-u.x,v.y-u.y);
        while(index<nodes.length-1 && walked+len<distance){walked+=len;index++;u=nodes[index-1];v=nodes[index];len=Math.hypot(v.x-u.x,v.y-u.y);}
        const t=Math.min(1,(distance-walked)/Math.max(len,0.001));
        const img=i%2?ent._flailRing2Img:ent._flailRing1Img;
        c.save();c.translate(u.x+(v.x-u.x)*t,u.y+(v.y-u.y)*t);c.rotate(Math.atan2(v.y-u.y,v.x-u.x)+Math.PI/2);
        const h=FLAIL_RING_LEN*scale;
        if(img && img.complete && img.naturalWidth){const w=h*spriteAspectFor(img);c.drawImage(img,-w/2,-h/2,w,h);}
        else {c.strokeStyle='#aaa';c.lineWidth=2*scale;c.strokeRect(-2*scale,-h/2,4*scale,h);}
        c.restore();
    }
    const last=nodes[nodes.length-1],img=ent._weaponImg,h=FLAIL_HEAD_LEN*scale;
    c.translate(ent._flailHeadX,ent._flailHeadY);
    c.rotate(Math.atan2(ent._flailHeadY-last.y,ent._flailHeadX-last.x)+Math.PI/2);
    if(img && img.complete && img.naturalWidth){const w=h*spriteAspectFor(img);c.drawImage(img,-w/2,0,w,h);}
    c.restore();
}
function updateFlailCombat(dt){
    const entities=[P,...(dummyOn?ALL_BOTS:[])];
    if(typeof NET_SYNC!=='undefined' && NET_SYNC.active && !entities.includes(D)) entities.push(D);
    for(const ent of entities) updateFlailPull(ent,dt);
    for(const ent of entities){
        if(ent.hp<=0 || ent._defeated || ent.hasWeapon===false || weaponKeyOf(ent)!=='flail'){
            if(ent._flailAttack || ent._flailNodes) resetFlailCombat(ent);
            continue;
        }
        if(flailRemote(ent) && GameTime-(ent._flailNetTime||0)>1) ent._flailAttack=null;
        if(!flailRemote(ent) && (isExhausted(ent) || isUnbalanced(ent))) beginFlailFold(ent);
        updateFlailLunge(ent,dt,entities);
        updateFlailTurns(ent);
        updateFlailChain(ent,dt);
    }
}

// Three quick directional strokes (out/back/out), independent of extension and global sword flick settings.
function detectFlailFlick(ent,delta,dt){
    let f=ent._flailFlick;
    if(!f || (f.time+=dt)>0.7) f=ent._flailFlick={time:0,dir:0,amp:0,turns:0};
    if(Math.abs(delta)/Math.max(dt,0.001)<2.5) return false;
    if(!f.dir) f.time=0; // Start the gesture window on movement, not on an arbitrary idle tick.
    const dir=Math.sign(delta),amp=Math.abs(delta);
    if(f.dir && dir!==f.dir){
        f.turns=f.amp>=0.18 && f.amp<=1.6 ? f.turns+1 : 0;
        f.amp=0;
    }
    f.dir=dir;f.amp+=amp;
    if(f.amp>1.6) f.turns=0;
    if(f.turns>=2 && f.amp>=0.18){ent._flailFlick=null;return true;}
    return false;
}
function beginFlailFold(ent){
    if(ent._flailFoldLocked) return;
    ent._flailFoldLocked=true;
    ent._flailExt=Math.max(0,ent._flailExt||0);
    ent._flailFlick=null;ent._flailAccumAngle=0;ent._flailIsLerping=false;
    ent._flailFreeAngle=ent.angle;
    // DISBALANCE changes ent.vel before this tick; retain the chain's own momentum.
    const wasSpinning=(ent._flailState==='SPIN' || ent._flailState==='RETRACT') &&
        Number.isFinite(ent._flailSpinSpeed) && ent._flailSpinSpeed>0;
    if(!wasSpinning){
        const velocity=ent._flailLagVel ?? ent.vel ?? 0;
        ent._flailDirection=Math.sign(velocity)||ent._flailDirection||1;
        ent._flailSpinSpeed=Math.min(5,Math.abs(velocity)/2.1);
    }
    ent._flailState='RETRACT';
    const a=ent._flailAttack;
    if(a){
        if(a.target?._flailPull?.owner===ent) a.target._flailPull=null;
        if(ent===P && typeof NET_SYNC!=='undefined' && NET_SYNC.active)
            $.NET.send({type:'flailCancel',id:a.id,retract:true});
        a.target=null;a.phase='back';a.time=0;
    }
}
function updateForcedFlailFold(ent,targetAng,dt){
    const previous=ent.angle;
    if((ent._flailExt||0)>0){
        ent.angle+=ent._flailDirection*ent._flailSpinSpeed*2.1*dt;
        ent._flailExt=Math.max(0,ent._flailExt-0.84*dt);
    }
    ent._flailFreeAngle=ent.angle;
    ent._flailPrevAngle=ent.angle;
    ent.vel=$.M.angDiff(ent.angle,previous)/Math.max(dt,0.001);
    ent._flailLagVel=ent.vel;
    if(ent._flailExt<=0){
        ent._flailSpinSpeed=0;ent.vel=0;ent._flailWasAtMax=false;
        if(!isExhausted(ent) && !isUnbalanced(ent)){
            ent._flailFoldLocked=false;ent._flailState='FOLLOW';
            ent._flailLerpStartAngle=ent.angle;ent._flailLerpTargetAngle=targetAng;
            ent._flailLerpTimer=0;ent._flailLerpDuration=1;ent._flailIsLerping=true;
            ent._flailFlick=null;
        }
    }
}
function updateFlailTurns(ent){
    if(flailRemote(ent)) return; // The remote peer owns both counting and stamina.
    const previous=ent._flailOrbitPrevious;
    ent._flailOrbitPrevious=ent.angle;
    if(previous==null || ent._flailAttack || ent._flailIsLerping || ent._flailAttackEnd===GameTime){
        ent._flailOrbitAccum=0;ent._flailOrbitDirection=0;return;
    }
    const delta=$.M.angDiff(ent.angle,previous),direction=Math.sign(delta);
    if(Math.abs(delta)<1e-7) return;
    if(ent._flailOrbitDirection && direction!==ent._flailOrbitDirection) ent._flailOrbitAccum=0;
    ent._flailOrbitDirection=direction;
    ent._flailOrbitAccum=(ent._flailOrbitAccum||0)+Math.abs(delta);
    while(ent._flailOrbitAccum>=Math.PI*2-1e-9){
        ent._flailOrbitAccum=Math.max(0,ent._flailOrbitAccum-Math.PI*2);
        ent._flailTurnSerial=(ent._flailTurnSerial||0)+1;
        $.S.play('hammerSwing');
        drainStamina(ent,15);
        if(ent.stamina<=0){
            if(!isExhausted(ent)) applyExhaust(ent);
            beginFlailFold(ent);
        }
    }
}
