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

function updateFlailSwing(ent, targetAng, rawDt){
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

    const cursorDelta = $.M.angDiff(targetAng, ent._flailPrevCursorAngle || targetAng);
    ent._flailPrevCursorAngle = targetAng;

    const MAX_CURSOR_DELTA = 0.5;
    const clampedDelta = $.M.clamp(cursorDelta, -MAX_CURSOR_DELTA, MAX_CURSOR_DELTA);

    const isMouseMoving = Math.abs(clampedDelta) > 0.005;
    const mouseSpeed = Math.abs(clampedDelta) / Math.max(rawDt, 0.001);
    const mouseDirection = Math.sign(clampedDelta) || 1;

    // ── Накопитель устойчивого вращения ──
    if (isMouseMoving) {
        // ДЛЯ БОТОВ: ускоряем накопление в 3 раза
        const accumMult = isBot(ent) ? 3.0 : 2.0;
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

    const directionChanged = isMouseMoving && mouseDirection !== ent._flailDirection;

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
            ent._flailSpinSpeed = Math.min(5.0, mouseSpeed * 0.8);
            // Боты получают бонусную скорость
            if(isBot(ent)) ent._flailSpinSpeed = Math.min(5.0, ent._flailSpinSpeed * 1.5);
            // Сбрасываем lerp если начали вращение
            ent._flailIsLerping = false;
        } else if (isRealSpin) {
            ent._flailExt = Math.min(1, ent._flailExt + 0.5 * rawDt);
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
        ent._flailFreeAngle += ent._flailDirection * ent._flailSpinSpeed * 1.5 * rawDt;
        ent.angle = ent._flailFreeAngle;
        ent._flailExt = Math.min(1, ent._flailExt + 0.1 * rawDt);
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
        ent._flailFreeAngle += ent._flailDirection * ent._flailSpinSpeed * 1.5 * rawDt;
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
        const MAX_ANGLE_STEP = 8 * rawDt;
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
