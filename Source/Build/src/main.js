// === src/main.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: UPDATE TICK — главная функция обновления кадра (использует всё выше)
// Module section: update tick.
// ════════════════════════════════════════════════════════════════════════════

function update(dt){
  if(DEATH.pDead) return; // мертв — нет обновления
  updateBuffs(P, dt);
    // ⏱ ОБНОВЛЕНИЕ ДЕБАФФОВ
  if (P._debuffActive && (P._debuffUntil || 0) < GameTime) {
    P._debuffActive = false;
    P._debuffType = null;
    P._debuffIntensity = 0;
    P.exhausted = 0;
  }
  // --- движение рута ---
  let mx=0, my=0;
  if(keys['a']||keys['ф']) mx=-1; if(keys['d']||keys['в']) mx=1;
  if(keys['w']||keys['ц']) my=-1; if(keys['s']||keys['ы']) my=1;
  if(mx||my){ const l=Math.hypot(mx,my); mx/=l; my/=l; }
  
// Восстановление стамины
regenStamina(P, dt, mDown);
  
  // ── ОБНОВЛЕНИЕ ЗАЩИТЫ ОТ МУЛЬТИУРОНА ────────────
  if(P._multiHitProtection){
    P._multiHitProtectionTimer -= dt;
    if(P._multiHitProtectionTimer <= 0){
      P._multiHitProtection = false;
      P._multiHitProtectionMult = 1.0;
      P._hitCount = 0;
    }
  }


  const inRageBuff = P.rageBuffEnd > GameTime;
  const lmbStaminaCost = P.stamMax * (sv('lmbcost') / 100) * weaponLmbStaminaMult(P);

  if(isRangedWeapon(P)){
    // ── Жезл/Арбалет: ЛКМ полностью заменяет бафф ярости — вместо него стрельба ──
    P.lmbWasDown = mDown;
    P.lmbHoldStart = -1;
    if(isExhausted(P)) mDown = false; // усталость гасит ЛКМ так же, как и раньше
    updateRangedWeaponFire(P, mDown);
    updateCrossbowReloadSound(P);
  } else {
    P._wandCharging = false;
    // ── БАФФ ЯРОСТИ: пока ЛКМ зажата тратит 30/сек, продлевает бафф ──────
    if(inRageBuff && mDown){
      P.rage = Math.max(0, P.rage - 30 * dt);
      if(P.rage > 0) P.rageBuffEnd = Math.max(P.rageBuffEnd, GameTime + 0.1);
    }

    // ── ЛКМ: активация баффа СРАЗУ при нажатии, текст через 0.5 сек ──────
    if(isExhausted(P) && mDown){
      // Усталость: ЛКМ принудительно отжимается
      mDown = false;
    }
    // Не начинаем ЛКМ, если нельзя оплатить его полностью.
    if(!inRageBuff && P.rage < 30 && mDown && !P.lmbWasDown && weaponKeyOf(P) !== 'flail' && P.stamina < lmbStaminaCost){
      mDown = false;
      if((P._lmbNoStaminaTextUntil || 0) <= GameTime){
        const rc = rootCenter();
        hitFX.push({x:rc.x, y:rc.y-55, t:'⚠ НЕТ СТАМИНЫ', life:35, big:false, col:'#ff8844'});
        P._lmbNoStaminaTextUntil = GameTime + 0.5;
      }
    }
    if(mDown && weaponKeyOf(P) !== 'flail'){
      if(!P.lmbWasDown){
        P.lmbWasDown = true;
        P.lmbHoldStart = GameTime;
        
        if (!isRangedWeapon(P)) {
          playSound('hammerSwing');
        }
        if(!inRageBuff){
          P.stamina = Math.max(0, P.stamina - lmbStaminaCost);
          if(P.rage >= 30){
            P.rage = Math.max(0, P.rage - 30);
            P.rageBuffEnd = GameTime + 1.0;
            P._rageTextShown = false;
            playSound('rage');
          }
        }
      }
      if(P.rageBuffEnd > GameTime && !P._rageTextShown && (GameTime - (P.lmbHoldStart||0)) >= 0.5){
        P._rageTextShown = true;
        hitFX.push({x:W/2,y:H/2-50,t:'🔥 ЯРОСТЬ!',life:40,big:true,col:'#ff2020'});
      }
    } else {
      P.lmbWasDown = false;
      P.lmbHoldStart = -1;
    }
  }

  // Усталость при стамина=0 (только если нет баффа)
if(P.stamina <= 0 && !isExhausted(P) && !(P.rageBuffEnd > GameTime) && (P._exhaustedEndTime||0) <= GameTime){
  P.stamina = 0;
  applyExhaust(P);
  P._exhaustedEndTime = GameTime + (P.exhaustDur||sv('exhdur2')) + P.exhaustRegenDelay;
  playSound('exhaust');
}
const exhMult = getMod(P, 'moveSlow', 1);
  const blockSlowMult = (P._blockSlow||0) > GameTime ? sv('blockSlowMult') : 1;
  const pSpeedMult = exhMult * blockSlowMult;
  const _shDef=shieldDef(P);
  const _shWeight=_shDef?_shDef.weight:0;
  const _shWrongSide = _shDef && shieldSameSideAsSword(P);
  const _shBaseMult = _shDef ? (1 - 0.15 - _shWeight*0.1) : 1.0;
  const _shWrongMult = _shWrongSide ? 0.8 : 1.0;
  const maxV = 7 * pSpeedMult * sv('globalspd') * _shBaseMult * _shWrongMult * weaponMoveSpeedMult(P);

  const realMove = Math.hypot(P.x - (P._prevX||P.x), P.y - (P._prevY||P.y));
  P._prevX = P.x; P._prevY = P.y;
  const actuallyMoving = realMove > 0.08;

  if(actuallyMoving){
    P._dustCD = (P._dustCD||0) - rawDt;
    if(P._dustCD <= 0){
      P._dustCD = rf(0.08,0.06);
      const feetY = P.y + P.by + 7;
      spawnDust(P.x + 5 + P.bx, feetY, P.vx, P.vy);
    }
  }

  const actualSpd = Math.hypot(P.vx, P.vy);
  let swordBackMult = 1.0;
  let swordIsBehind = false;
  if(actuallyMoving){
    const moveAng = Math.atan2(P.vy, P.vx);
    const swordRelAng = Math.abs(angDiff(P.angle, moveAng));
    swordIsBehind = swordRelAng > Math.PI * 0.917;
    const backBoost = sv('swordback') + (1.0 - sv('swordback')) / 3.0;
    swordBackMult = swordRelAng > Math.PI * 0.6 ? backBoost : sv('swordback');
  }

  if(P._wandCharging){ mx = 0; my = 0; P.vx = 0; P.vy = 0; }
  const hasInput = mx !== 0 || my !== 0;
  const _pMoveLocked = GameTime < (P._moveLockUntil||0);
  
  if(_pMoveLocked){
    P.vx = decayDT(P.vx, sv('inertia'), rawDt);
    P.vy = decayDT(P.vy, sv('inertia'), rawDt);
  } else if(hasInput){
    P.vx = lerpDT(P.vx, mx*maxV*swordBackMult, 0.28, rawDt);
    P.vy = lerpDT(P.vy, my*maxV*swordBackMult, 0.28, rawDt);
  } else {
    P.vx = decayDT(P.vx, sv('inertia'), rawDt);
    P.vy = decayDT(P.vy, sv('inertia'), rawDt);
  }
  
  (() => {
    const mLR = 40;
    const mT  = 30;
    const mB  = 35;
    if((P.x<mLR&&P.vx<0)||(P.x>W-mLR-80&&P.vx>0)) P.vx*=0.5;
    if((P.y<mT &&P.vy<0)||(P.y>H-mB -40&&P.vy>0))  P.vy*=0.5;
  })();
  P.vx = clamp(P.vx, -15, 15); P.vy = clamp(P.vy, -15, 15);
  
  if(P._dvx||P._dvy){
    if(P.shield>0 && typeof shieldDef==='function' && shieldDef(P)
       && typeof D!=='undefined' && dummyOn){
      const _dodgeDist = Math.hypot(D.x-P.x, D.y-P.y);
      const _dvLen = Math.hypot(P._dvx||0, P._dvy||0)||1;
      const _movDir_x = (P._dvx||0)/_dvLen;
      const _movDir_y = (P._dvy||0)/_dvLen;
      const _toD_x = (D.x-P.x)/(_dodgeDist||1);
      const _toD_y = (D.y-P.y)/(_dodgeDist||1);
      const _toward = _movDir_x*_toD_x + _movDir_y*_toD_y;
      if(_dodgeDist < 70 && _toward > 0.3 && !(P._shieldBodyHitCD > GameTime)){
        P._shieldBodyHitCD = GameTime + 0.5;
        if(typeof triggerBladeBind==='function') triggerBladeBind(P, D);
        D.vx += _toD_x*5; D.vy += _toD_y*5;
        // replace with:
if(!isUnbalanced(D)) applyDisbalance(D, 1.5);
        P.rage = Math.max(0, (P.rage||0) - 20);
        
        const _shDefBash = shieldDef(P);
        const _spiked = _shDefBash && _shDefBash.spiked;
        if(_spiked){
          const spikeDmg = _shDefBash.spikeDmg || 12;
          applyDamage(D, spikeDmg, P, {
            isMagic: false,
            isExplosion: false,
            knockbackMult: 0.3,
            hitstopFrames: 3,
            shakePower: 4,
            textColor: '#ff6644',
            textSuffix: '🛡',
            bloodCount: 6,
            playSound: false
          });
          hitFX.push({x:D.x, y:D.y-52, t:'-'+spikeDmg, life:40, big:false});
          if(typeof spawnBlood==='function') spawnBlood(D.x, D.y, _toD_x, _toD_y);
          playSound('damageHammer');
          if(D.hp<=0 && typeof handleCombatDeath==='function') handleCombatDeath(D);
        }
        hitFX.push({x:D.x,y:D.y-30,t: _spiked?'🗡🛡 ШИП-БАШ!':'🛡 BASH!',life:45,big:true,col:'#60ccff'});
        playSound?.('shieldblock');
        if(typeof triggerHitstop==='function') triggerHitstop(3,3);
      }
    }
    const _preX=P.x+P.vx+(P._dvx||0);
    P.x=clamp(_preX, 40, W-80);
    if(Math.abs(_preX-P.x)>2 && Math.abs(P._dvx||0)>1){
      const _rc=rootCenter();
      const _td=Math.hypot(mX-_rc.x,mY-_rc.y)||1;
      P._dvx=(mX-_rc.x)/_td*Math.abs(P._dvx)*0.5;
      P._dvy=(mY-_rc.y)/_td*Math.abs(P._dvy||0)*0.5;
    }
    const _preY=P.y+P.vy+(P._dvy||0);
    P.y=clamp(_preY, 40, H-40);
    if(Math.abs(_preY-P.y)>2 && Math.abs(P._dvy||0)>1 && Math.abs(P._dvx||0)<2){
      const _rc2=rootCenter();
      const _td2=Math.hypot(mX-_rc2.x,mY-_rc2.y)||1;
      P._dvx=(mX-_rc2.x)/_td2*Math.abs(P._dvx||0)*0.5;
      P._dvy=(mY-_rc2.y)/_td2*Math.abs(P._dvy)*0.5;
    }
    const decay=Math.pow(0.01, dt);
    P._dvx*=decay; P._dvy*=decay;
    if(Math.hypot(P._dvx,P._dvy)<0.1){ P._dvx=0; P._dvy=0; }
  } else {
    P.x=clamp(P.x+P.vx, 40, W-80);
    P.y=clamp(P.y+P.vy, 40, H-40);
  }
  resolveBoxCollision(P);

  // 🔥 АНИМАЦИЯ ОТДАЧИ
  if(P._recoilAnimTime > 0){
    P._recoilAnimTime -= dt;
    const progress = 1 - (P._recoilAnimTime / 0.15);
    if(progress < 0.5){
      P._recoilOffset = -6 * (progress * 2);
    } else {
      P._recoilOffset = -6 * (1 - (progress - 0.5) * 2);
    }
    if(P._recoilAnimTime <= 0){
      P._recoilOffset = 0;
    }
  }
  if(P._recoilOffset !== 0){
    const ang = P.angle;
    P.x += Math.cos(ang) * P._recoilOffset * 0.3;
    P.y += Math.sin(ang) * P._recoilOffset * 0.3;
  }

  // 🔥 ПОЛУЧАЕМ СТИЛЬ
  const isRanged = isRangedWeapon(P);
  const style = isRanged ? getRangedStyle() : {
    dist: csv('dist'),
    ex: csv('ex'),
    ey: csv('ey'),
    blk: sv('blk'),
    adaY: cb('adaY'),
    adaD: cb('adaD'),
    adaXb: csv('adaXb'),
    adaXp: csv('adaXp'),
    ada12: cb('ada12')
  };

  // --- оффсет тела ---
  const rc = rootCenter();
  const dzone = csv('dzone');
  const rawMouseDist = Math.hypot(mX - rc.x, mY - rc.y);

  let effectiveMX = mX, effectiveMY = mY;
  if(dzone > 0 && rawMouseDist > 0.1){
    if(rawMouseDist < dzone){
      const t = rawMouseDist / dzone;
      const clampedX = rc.x + (mX - rc.x) / rawMouseDist * dzone;
      const clampedY = rc.y + (mY - rc.y) / rawMouseDist * dzone;
      const smooth = t * t;
      effectiveMX = clampedX;
      effectiveMY = clampedY;
    }
  } else if(dzone > 0 && rawMouseDist < 0.1){
    effectiveMX = rc.x + dzone;
    effectiveMY = rc.y;
  }

  if(!P._eMX){ P._eMX = effectiveMX; P._eMY = effectiveMY; }

  const smoothSpd = rawMouseDist < dzone ? 0.18 : 0.45;
  P._eMX += (effectiveMX - P._eMX) * smoothSpd;
  P._eMY += (effectiveMY - P._eMY) * smoothSpd;
  effectiveMX = P._eMX;
  effectiveMY = P._eMY;

  const toCursor = Math.atan2(effectiveMY - rc.y, effectiveMX - rc.x);
  const oppAng = toCursor + Math.PI;

  let dist = style.dist;
  if(shieldDef(P) && shieldSameSideAsSword(P)) dist = Math.min(dist, 14);
  const mouseDist = Math.hypot(effectiveMX - rc.x, effectiveMY - rc.y);
  const scaledDist = dist * clamp(mouseDist / 120, 0, 1);
  P.tbx = Math.cos(oppAng) * scaledDist;
  P.tby = Math.sin(oppAng) * scaledDist;

  // 🔥 ТЕЛО — замедляем при усталости
const exhBodyMult = isExhausted(P) ? 0.3 : 1.0;
  const bspd = sv('spd') * exhBodyMult;
  P.bx = lerpDT(P.bx, P.tbx, bspd, dt);
  P.by = lerpDT(P.by, P.tby, bspd, dt);

  // --- скейл меча ---
  const meleePoseActive = mDown && !isRangedWeapon(P) && weaponKeyOf(P) !== 'flail';
  const targetScale = meleePoseActive ? sv('sc1') : sv('sc0');
  P.swordScale += (targetScale - P.swordScale) * sv('scs');

  // --- КОМБО пивот ---
  if(meleePoseActive){
    const aex = csv('aex'), aey = csv('aey');
    let aspd = sv('as') * 3.5;
    const toD = Math.atan2(D.y - rc.y, D.x - rc.x);
    const angM = Math.atan2(effectiveMY - rc.y, effectiveMX - rc.x);
    const localAng = angM - toD;
    const lx = Math.cos(localAng) * aex;
    const ly = Math.sin(localAng) * aey;
    const cosD = Math.cos(toD), sinD = Math.sin(toD);
    const tx = lx*cosD - ly*sinD;
    const ty = lx*sinD + ly*cosD;
    P.tpX = lerpDT(P.tpX, tx, aspd, dt);
    P.tpY = lerpDT(P.tpY, ty, aspd, dt);
  } else {
    const ang = Math.atan2(effectiveMY - rc.y, effectiveMX - rc.x);
    const inv = ang + Math.PI;

    let ex = style.ex;
    if(!isRanged && cb('adaX')){
      const xBase = csv('adaXb');
      const xPeak = csv('adaXp');
      const t = Math.sin(ang) * Math.sin(ang);
      ex = xBase + (xPeak - xBase) * t;
    }

    let eyOffset = 0;
    if(style.adaY){
      const t = clamp(-Math.sin(ang), 0, 1);
      eyOffset -= t * (isRanged ? 60 : csv('adaY'));
    }
    if(style.adaD){
      const ang6 = ang - Math.PI/2;
      const tc = Math.cos(ang6);
      const tDown = clamp(tc * tc * (tc > 0 ? 1 : 0), 0, 1);
      eyOffset += tDown * (isRanged ? 45 : csv('adaD'));
    }
    let pivDownOffset = 0;
    if(style.ada12){
      const ang12 = ang + Math.PI/2;
      const t12 = clamp(Math.cos(ang12 * 2), 0, 1);
      pivDownOffset = t12 * (isRanged ? 25 : csv('ada12'));
    }

    const tx = Math.cos(inv) * ex;
    const ty = Math.sin(inv) * style.ey + eyOffset + pivDownOffset;
    P.tpX = lerpDT(P.tpX, tx, style.blk, dt);
    P.tpY = lerpDT(P.tpY, ty, style.blk, dt);
  }

  // 🔥 ПИВОТ МЕЧА (рука) — при усталости едва двигается
  const exhPivotMult = isExhausted(P) ? 0.05 : 0.35;
  P.pvX += (P.tpX - P.pvX) * exhPivotMult;
  P.pvY += (P.tpY - P.pvY) * exhPivotMult;

  // --- УГОЛ МЕЧА ---
  const _orbitDetected1 = updateOrbitDetect(P.angle, rawDt);
  if(_orbitDetected1 && !isExhausted(P) && weaponKeyOf(P) !== 'flail'){
    P.stamina = Math.max(0, P.stamina - sv('stamorbit'));
    if(P.stamina <= 0 && !isExhausted(P)) applyExhaust(P);
    hitFX.push({x: rc.x + P.pvX, y: rc.y + P.pvY - 30, t:'🌀 ОРБИТА', life:35, big:false, col:'#ff8840'});
    playSound('whoosh');
  }

  const pivX = rc.x + P.pvX;
  const pivY = rc.y + P.pvY;
  const arad = 0;
  const abrad = 0;
  const cursorDistFromRoot = Math.hypot(effectiveMX - rc.x, effectiveMY - rc.y);
  const inAutoBlock = !mDown && abrad > 1 && cursorDistFromRoot < abrad;

  let ta;
  
  // ---- ВНУТРИ КРУГА ----
  if(inAutoBlock){
    const aex = 26, aey = 40;
    const abOxo = 0, abOyo = 0;
    const aspd = 0.22;
    const toD = Math.atan2(D.y - rc.y, D.x - rc.x);
    const angM = Math.atan2(effectiveMY - rc.y, effectiveMX - rc.x);
    const localAng = angM - toD;
    const lx = Math.cos(localAng) * aex;
    const ly = Math.sin(localAng) * aey;
    const cosD = Math.cos(toD), sinD = Math.sin(toD);
    const tx = lx*cosD - ly*sinD + abOxo;
    const ty = lx*sinD + ly*cosD + abOyo;
    P.tpX = lerpDT(P.tpX, tx, aspd, dt);
    P.tpY = lerpDT(P.tpY, ty, aspd, dt);
    P.pvX = P.tpX;
    P.pvY = P.tpY;

    const angToCursor = Math.atan2(effectiveMY - rc.y, effectiveMX - rc.x);
    const abBodyDist = 45;
    const oppAB = angToCursor + Math.PI;
    P.tbx = Math.cos(oppAB) * abBodyDist;
    P.tby = Math.sin(oppAB) * abBodyDist;
    P.bx += (P.tbx - P.bx) * sv('spd');
    P.by += (P.tby - P.by) * sv('spd');

    ta = Math.atan2(mY - (rc.y + P.pvY), mX - (rc.x + P.pvX));
    P.vel = P.vel*0.6 + angDiff(ta, P.angle)*0.4*weaponSwingSpeedMult(P);
    const mobileBoost = window.IS_MOBILE ? 1.35 : 1.0;
    P.angle = angLerpDT(P.angle, ta, aspd * mobileBoost * getMod(P, 'swordSlow', 1), dt);
    P._inABang = angToCursor;
    
  // ---- ВИРТУАЛЬНЫЙ ПРИЦЕЛ ----
  } else if(arad > 1){
    const dmx = mX - P._pmX, dmy = mY - P._pmY;
    P._vcX += dmx; P._vcY += dmy;
    const vd = Math.hypot(P._vcX, P._vcY) || 0.001;
    if(vd > arad){ P._vcX = P._vcX/vd*arad; P._vcY = P._vcY/vd*arad; }
    ta = Math.atan2(P._vcY, P._vcX);
    P.vel = P.vel*0.6 + angDiff(ta, P.angle)*0.4*weaponSwingSpeedMult(P);
    P.angle += angDiff(ta, P.angle) * 0.28 * getMod(P, 'swordSlow', 1);
    
    // ---- ОБЫЧНЫЙ РЕЖИМ (включая цеп) ----
  } else {
    const isFlail = weaponKeyOf(P) === 'flail';
    
    if (isFlail) {
      const targetAng = Math.atan2(effectiveMY - pivY, effectiveMX - pivX);
      updateFlailSwing(P, targetAng, rawDt);
    } else {
      ta = Math.atan2(effectiveMY - pivY, effectiveMX - pivX);
      
      // 🔥 УСТАЛОСТЬ: запоминаем, что меч был заморожен
      const wasExhausted = isExhausted(P);
      
      // Если усталость только что закончилась — запускаем плавный возврат
      if (P._wasExhausted && !wasExhausted) {
        P._recoverStartAngle = P.angle;
        P._recoverTargetAngle = ta;
        P._recoverProgress = 0;
        P._recoverDuration = 1.0; // 1 секунда на восстановление
        P._recovering = true;
      }
      P._wasExhausted = wasExhausted;
      
           // 🌀 ПЛАВНЫЙ ВОЗВРАТ ПОСЛЕ УСТАЛОСТИ
      if (P._recovering) {
        // Увеличиваем время восстановления до 2.5 секунд
        P._recoverDuration = 0.3;
        P._recoverProgress += rawDt / P._recoverDuration;
        const progress = Math.min(1, P._recoverProgress);
        
        // Медленное начало, потом ускорение
        const eased = progress * progress * (3 - 2 * progress);
        
        // Интерполируем угол от замороженного к целевому
        let diff = angDiff(P._recoverTargetAngle, P._recoverStartAngle);
        let targetAngle = P._recoverStartAngle + diff * eased;
        
        // 🔥 ОГРАНИЧИВАЕМ МАКСИМАЛЬНЫЙ ПОВОРОТ ЗА КАДР
        const MAX_TURN_PER_FRAME = 0.04; // ~2.3° за кадр (очень медленно)
        let angleDiff = angDiff(targetAngle, P.angle);
        let clampedDiff = Math.max(-MAX_TURN_PER_FRAME, Math.min(MAX_TURN_PER_FRAME, angleDiff));
        P.angle += clampedDiff;
        
        // Скорость плавно нарастает
        P.vel = P.vel * (1 - eased * 0.3) + diff * eased * 0.5;
        
        if (progress >= 1) {
          P._recovering = false;
          P.angle = P._recoverTargetAngle;
          P.vel = 0;
        }
      } else {
        // 🔥 Усталость через exhswd2 (слайдер)
       const exhSwordMult = getMod(P, 'swordSlow', 1);
        
        // 🏋️‍♂️ ВЕС ОРУЖИЯ — замедляет поворот
        const baseW = weaponWeight(P);
        const isRageActive = (P.rageBuffEnd || 0) > GameTime;
        let effectiveW = baseW;
        if (isRageActive) {
          effectiveW = baseW * 0.4;
          effectiveW = Math.max(0.2, effectiveW);
        }
        
        const LIGHT_ZONE = 0.6;
        const HEAVY_ZONE = 2.4;
        const CURVE_SHARPNESS = 2.5;
        
        function smoothstep(edge0, edge1, x) {
          const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
          return t * t * (3 - 2 * t);
        }
        
        const slowProgress = smoothstep(LIGHT_ZONE, HEAVY_ZONE, effectiveW);
        const shapedProgress = Math.pow(slowProgress, 1 / CURVE_SHARPNESS);
        
        const MAX_SPEED = 0.35;
        const MIN_SPEED_LIMIT = 0.02;
        const speedRange = MAX_SPEED - MIN_SPEED_LIMIT;
        const currentMaxSpeed = MAX_SPEED - speedRange * shapedProgress;
        const weightSpeed = currentMaxSpeed * weaponSwingSpeedMult(P);
        
        const isLMBHeld = mDown && !isRangedWeapon(P) && weaponKeyOf(P) !== 'flail';
        const lmbMult = isLMBHeld ? 1 : 1.0;
        const finalSpeed = weightSpeed * exhSwordMult * lmbMult;
        
if (hasMod(P, 'weaponRecoil')) {
  // Detached phase: ignore the cursor and keep rotating from the hit impulse.
  // Decay is continuous, so the subsequent normal lerp has no angle jump.
  P._disbalanceAngularVelocity = (P._disbalanceAngularVelocity || 0) * Math.pow(0.12, dt);
  P.angle += P._disbalanceAngularVelocity * dt;
  P.vel = P._disbalanceAngularVelocity;
} else {
          P.vel = P.vel * 0.6 + angDiff(ta, P.angle) * 0.4 * weaponSwingSpeedMult(P) * exhSwordMult;
          P.angle = angLerpDT(P.angle, ta, finalSpeed, dt);
        }
      }
    }
  }

  // --- Детект флика и замаха ---
  if(!P._swingCD) P._swingCD = -1;
  if(P.hasWeapon === false || isRangedWeapon(P)){
    P._swingFX = false;
  } else {
    if(!isExhausted(P) && updateFlickDetect(P._realAngVel ?? P.vel, dt) && (P._swingBlockCD||0) < GameTime){
      if (weaponKeyOf(P) === 'flail' && P._flailExt < 0.97) {
        // Игнорируем
      } else if (!(GameTime < (P._dodgeActiveUntil||0))) {
        P.stamina = Math.max(0, P.stamina - sv('stamflick') * weaponStaminaMult(P));
        if(P.stamina <= 0 && !isExhausted(P)) applyExhaust(P);
        P._swingBlockCD = GameTime + 0.15;
        hitFX.push({x: rc.x + P.pvX, y: rc.y + P.pvY - 25, t:'⚡ ФЛИК', life:30, big:false, col:'#ffaa20'});
        playSound(isHeavySwingWeapon(P) ? 'hammerSwing' : 'whoosh');
      }
    }

    const swingThreshold = weaponKeyOf(P) === 'flail' ? sv('swthresh') * 5 : sv('swthresh');
    if(!isExhausted(P) && Math.abs(P.vel) > swingThreshold && (P._swingBlockCD||0) < GameTime){
      if (weaponKeyOf(P) === 'flail' && P._flailExt < 0.97) {
        P._swingFX = false;
      } else {
        if(!P._swingFX){
          P._swingFX = true;
          const rc0 = rootCenter();
          hitFX.push({x: rc0.x + P.pvX, y: rc0.y + P.pvY - 30, t:'⚔ ЗАМАХ', life:35, big:false, col:'#ffcc44'});
          if(isHeavySwingWeapon(P)) playSound('hammerSwing');
          else if(P.rageBuffEnd>GameTime) playSound('whooshRage'); else playSound('whoosh');
          if(cb('bbind') && mDown) bladeBind_checkSwing(P);
        }
        if(P._swingCD <= GameTime){
          if(!(GameTime < (P._dodgeActiveUntil||0))){
            let staminaCost = sv('stamswing') * weaponStaminaMult(P);
            const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
            if(botCount > 1){
              const costMult = Math.max(0.3, 1 / (1 + (botCount - 1) * 0.25));
              staminaCost = staminaCost * costMult;
            }
            P.stamina = Math.max(0, P.stamina - staminaCost*0.8);
            if(P.stamina <= 0 && !isExhausted(P)) applyExhaust(P);
          }
          P._swingCD = GameTime + 1.0;
        }
      }
    } else {
      P._swingFX = false;
    }
  }

  // --- детект попадания шарика ---
  {
    const rc0 = rootCenter();
    const bodyCX = rc0.x + P.bx;
    const bodyCY = rc0.y + P.by;
    const BODY_HIT_R = 18 * sv('cscl');
    for(let i = BALLS.length-1; i >= 0; i--){
      const b = BALLS[i];
      if(b.hit > 0) continue;
      const d = Math.hypot(b.x - bodyCX, b.y - bodyCY);
      if(d < BODY_HIT_R + b.r && (P._ballHitCD||0) <= GameTime){
        P._ballHitCD = GameTime + 0.5;
        const dmg = Math.round(Math.hypot(b.vx, b.vy) * 4);
        P.hp = Math.max(0, P.hp - dmg);
        P.hitFlash = GameTime + 0.25;
        hitFX.push({x: bodyCX, y: bodyCY - 20, t: '-'+dmg+'HP', life:45, big:true});
        const nx = (bodyCX - b.x)/(d||1), ny = (bodyCY - b.y)/(d||1);
        const kbf = sv('bodyKB') * 0.5;
        P.vx += nx * kbf; P.vy += ny * kbf;
        spawnBlood(bodyCX, bodyCY, -nx, -ny);
        b.vx = nx * 3; b.vy = ny * 3 - 1;
        b.hit = 30;
        BALLS.splice(i, 1);
        if(P.hp <= 0){ triggerDeath(P, false); }
      }
    }
  }

  // --- HUD ---
  if(!_infRootEl) _infRootEl = document.getElementById('inf-root');
  if(!_infBoffEl) _infBoffEl = document.getElementById('inf-boff');
  if(_infRootEl) _infRootEl.textContent = `${Math.round(rc.x)},${Math.round(rc.y)}`;
  if(_infBoffEl) _infBoffEl.textContent = `${P.bx.toFixed(1)},${P.by.toFixed(1)}`;
}


// ──────────────── END LAYER: UPDATE_TICK ────────────────

// ════════════════════════════════════════════════════════════════════════════
// LAYER: GAME LOOP — фиксированный таймстеп, requestAnimationFrame, вкл/выкл ИИ
// Module section: game loop.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
const TARGET_FPS = 120;
// ════════════════ END MODULE: COMBAT ═══════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// MODULE: GAME LOOP  (фиксированный таймстеп, requestAnimationFrame)
// ════════════════════════════════════════════════════════════════════════════
const FRAME_MIN_MS = 1000 / TARGET_FPS;
const FIXED_DT = 1 / 120; // фиксированный шаг физики — всегда 1/60 сек
let lastRenderT = 0;
let accumulator = 0; // накопитель реального времени

// ════════════════════════════════════════════════════════════════════════════
// MODULE: VISIBILITY  (пауза игры и музыки при сворачивании/уходе со страницы)
// ════════════════════════════════════════════════════════════════════════════
let gamePaused = false;
// Пауза, вызванная ОТКРЫТЫМ МЕНЮ (не сворачиванием вкладки). Пока этот флаг
// true, возврат на вкладку НЕ должен снимать паузу — иначе меню виснет на
// экране, а бой (и боты) продолжает идти под ним.
let uiMenuPaused = false;
window._setUiMenuPaused = function(v){ uiMenuPaused = v; };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    gamePaused = true;
    if (typeof currentMusicObj !== 'undefined' && currentMusicObj) currentMusicObj.pause();
  } else {
    if (!uiMenuPaused) gamePaused = false; // не снимаем паузу, если открыто меню
    lastT = performance.now(); // сброс таймера чтобы не было гигантского dt
    lastRenderT = lastT;
    if (typeof currentMusicObj !== 'undefined' && currentMusicObj && musicEnabled && audioEnabledFlag) {
      currentMusicObj.play().catch(()=>{});
    }
  }
});
// ════════════════ END MODULE: VISIBILITY ════════════════════════════════════

function loop(ts){
  if (gamePaused) { requestAnimationFrame(loop); return; }
  rawDt = Math.min(0.1, (ts-lastT)/1000); lastT = ts;
  RealTime += rawDt;

  accumulator += rawDt;
  const maxSteps = 3;
  let steps = 0;
  while(accumulator >= FIXED_DT && steps < maxSteps){
    accumulator -= FIXED_DT;
    const dt = FIXED_DT * sv('gamespeed');
    GameTime += dt;
    update(dt);
    duelUpdate(dt);
    updateDroppedWeapons(dt);
    updateProjectiles(dt);
    
    if(P._wandCharging) updateWandChargeParticles(dt, P);
    if(dummyOn){ for(const _wb of ALL_BOTS){ if(_wb.hp > 0 && _wb._wandCharging) updateWandChargeParticles(dt, _wb); } }
    
    updateWandParticles(dt);
    updateWandExplosions(dt);
    updateArrowShatterFX(dt);
    updateProjectileDodgeAI();

    // 🔥 ЭФФЕКТЫ МАГИЧЕСКОГО ПОСОХА
    updateMagicStaffLightning(rawDt);
    updateMagicStaffGlow(rawDt);
    updateMagicStaffChargeFX(rawDt);
	updateLightningHitFX(rawDt);
// 🔥 ЕДИНАЯ ТРЯСКА ДЛЯ ВСЕХ
updateChargeShake(P, rawDt);
    if(dummyOn){
      for(const bot of ALL_BOTS){
        if(!revealBotIfReady(bot)) continue;
        if(bot.hp <= 0) continue;
        updateAIDispatch(dt, bot);
        updateDummy(dt, bot);
      }
      updateMainBotRotation(dt);
    }
    
    updateFlailExtension(P, dt);
    if(dummyOn){ for(const bot of ALL_BOTS){ if(bot.hp > 0) updateFlailExtension(bot, dt); } }
if(dummyOn) {
  for(const bot of ALL_BOTS) {
    if(bot.hp > 0) updateChargeShake(bot, rawDt);
  }
}
	
	
    if(dummyOn){
      for(const bot of ALL_BOTS){
        if(bot._awaitingReveal) continue;
        if(bot.hp <= 0) continue;
        updateAtkPoints(P, bot, dt);
        updateAtkPoints(bot, P, dt);
        P.isAttacker = P.atkPts >= bot.atkPts;
        bot.isAttacker = bot.atkPts > P.atkPts;
        checkSwordCollision(P, bot, dt);
      }
    }
    
    updateBalls(dt);
    updateBlood(dt);
    updateFX(dt);
    steps++;
  }

  for(let i=DEATH.deathCross.length-1;i>=0;i--){
    DEATH.deathCross[i].timer -= rawDt;
    if(DEATH.deathCross[i].timer<=0) DEATH.deathCross.splice(i,1);
  }
  updateHUD();
  if(isExhausted(P)) drawSweat(P);
  if(isUnbalanced(P)) drawUnbalancedStars(P)
if(dummyOn&&isExhausted(D)) drawSweat(D);          
if(dummyOn&&isUnbalanced(D)) drawUnbalancedStars(D); 

  const rc = rootCenter();
  const _orbitDetected2 = updateOrbitDetect(P.angle, rawDt);
  if(_orbitDetected2 && !isExhausted(P) && weaponKeyOf(P) !== 'flail'){
    P.stamina = Math.max(0, P.stamina - sv('stamorbit')*0.8);
    if(P.stamina <= 0 && !isExhausted(P)) applyExhaust(P);
    hitFX.push({x: rc.x + P.pvX, y: rc.y + P.pvY - 30, t:'🌀 ОРБИТА', life:35, big:false, col:'#ff8840'});
    playSound('whoosh');
  }

  const doRender = (ts - lastRenderT) >= FRAME_MIN_MS - 1;
  if(doRender) lastRenderT = ts;
  if(doRender){
    const pivX = rc.x + P.pvX;
    const pivY = rc.y + P.pvY;
    window._shakeApplied = typeof window._applyScreenShake==='function' ? window._applyScreenShake() : false;
    drawArena();
    
    if(typeof drawBloodPools==='function') drawBloodPools();
    if(typeof DODGE_TRAIL!=='undefined'&&DODGE_TRAIL.length){
      ctx.save();
      for(let i=DODGE_TRAIL.length-1;i>=0;i--){
        const tr=DODGE_TRAIL[i];
        tr.life-=1;
        if(tr.life<=0){DODGE_TRAIL.splice(i,1);continue;}
        const a=(tr.life/tr.maxLife)*0.55;
        ctx.globalAlpha=a;
        ctx.fillStyle=`rgba(60,160,255,${a})`;
        ctx.beginPath();
        ctx.arc(tr.x,tr.y,tr.r*(tr.life/tr.maxLife),0,Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha=1;
      ctx.restore();
    }
    
    drawBoxes();
    drawBalls();
    drawDroppedWeapons();
    drawProjectiles();
    drawWandParticles();
    drawWandExplosions();
    drawArrowShatterFX();
    updateBowTensionFX(rawDt);
    drawBowTensionFX();
    
    // 🔥 РИСУЕМ ЭФФЕКТЫ МАГИЧЕСКОГО ПОСОХА
    drawMagicStaffLightning();
    drawMagicStaffGlow();
    drawMagicStaffChargeFX();
    drawLightningHitFX();
    // Радиус для игрока
    if (P._magicCharging && weaponKeyOf(P) === 'magicstaff') {
      drawMagicStaffRadius(P);
    }
    
    // Радиус для ботов
    if(dummyOn){
      for(const _b of ALL_BOTS){
        if(_b.hp > 0 && _b._magicCharging && weaponKeyOf(_b) === 'magicstaff'){
          drawMagicStaffRadius(_b);
        }
      }
    }
    
    { // Рисуем ВСЕХ ботов
      const _realD = D;
      for(const _b of ALL_BOTS){ D = _b; drawDummy(); }
      D = _realD;
    }
    
    const _pSwordBehind = shieldDef(P) && shieldSameSideAsSword(P);
    if(_pSwordBehind && P.hasWeapon !== false) drawSword(pivX, pivY, P.angle);
    drawPlayer();
    if(!_pSwordBehind && P.hasWeapon !== false) drawSword(pivX, pivY, P.angle);
    
    if(dummyOn){
      for(const _b of ALL_BOTS){ if(_b.shield>0 && !isShieldSuppressed(_b)) drawShield(_b, P.x); }
    }
    if(P.shield>0 && !isShieldSuppressed(P)) drawShield(P, mX);
    
    drawCursor();
    drawBlood();
    drawFXEffects();
    drawDustFX(rawDt);
    drawDeathCrosses();
    drawFX();
    
    if(typeof drawZone==='function') drawZone();
    if(typeof window._restoreScreenShake==='function') window._restoreScreenShake(window._shakeApplied);
  }

  if(typeof updateBloodPools==='function') updateBloodPools(rawDt);
  if(typeof updateZone==='function') updateZone(rawDt);
  if(typeof NET_SYNC !== 'undefined') NET_SYNC.tick(rawDt);
  if(typeof window._dodgeTick==='function') window._dodgeTick(rawDt);

  requestAnimationFrame(loop);
}

// ── ВВОД ────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e=>{ const r=canvas.getBoundingClientRect(); mX=e.clientX-r.left; mY=e.clientY-r.top; });
canvas.addEventListener('mousedown', e=>{ if(e.button!==0)return; mDown=true; });
canvas.addEventListener('mouseup',   e=>{ if(e.button!==0)return; mDown=false; });
// Глобальные обработчики: если ЛКМ отжата за пределами canvas/окна, или окно
// теряет фокус (alt-tab, переключение вкладки) — сбрасываем mDown, чтобы
// игра не "застревала" в режиме зажатой кнопки.
window.addEventListener('mouseup', e=>{ if(e.button===0) mDown=false; });
window.addEventListener('blur', ()=>{ mDown=false; });
document.addEventListener('mouseleave', ()=>{ mDown=false; });
window.addEventListener('keydown', e=>{
  // Пропускаем если фокус в любом input/textarea (чтобы не блокировать ввод в overlay)
  const tag = document.activeElement?.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA') return;
  // Пропускаем если открыто любое game-overlay (Enter/Escape обрабатываются отдельно)
  if(document.querySelector('.game-overlay.open')) return;
  const k = e.key.toLowerCase();
  // Открыть/скрыть панель настроек (~, ` или Ё)
  if(e.code === 'Backquote' || e.key === 'ё' || e.key === 'Ё'){
    if(!window.IS_MOBILE){
      const panel = document.getElementById('panel');
      panel.classList.toggle('open');
      // Панель — оверлей поверх игры (z-index), канвас/HUD никогда не сдвигаются и не сужаются
    }
    return;
  }
  keys[k]=true;
  if(k==='t'||k==='т'||k==='е') toggleDummy();  // T/т/е (рус. "е" — та же физич. клавиша, что T) = ПАУЗА
  if(k==='e'||k==='у'){ if(typeof tryManualPickup==='function') tryManualPickup(P); } // E/у = ПОДБОР ОРУЖИЯ
  // Дебаг щитов
  if(k==='r'||k==='к'){ window.toggleSwordStyle(); }
  if(k==='q'||k==='й'){
    P._shieldFlipped = !P._shieldFlipped;
  }
  if(k==='y'||k==='н'){ toggleAI(); } // Y/н (та же физич. клавиша, что Y) = СПАВН БОТОВ
  if(k==='z'||k==='я'){
    P.shield=(P.shield+1)%SHIELD_TYPES.length; setShield(P,P.shield);
    const n=SHIELD_TYPES[P.shield]; hitFX.push({x:P.x,y:P.y-40,t:'ЩИТ P: '+(n?n.name:'нет'),life:60,big:false,col:'#88ccff'});
  }
  if(k==='x'||k==='ч'){
    D.shield=(D.shield+1)%SHIELD_TYPES.length; setShield(D,D.shield);
    const n=SHIELD_TYPES[D.shield]; hitFX.push({x:D.x,y:D.y-40,t:'ЩИТ D: '+(n?n.name:'нет'),life:60,big:false,col:'#ffaa44'});
  }
if(k==='c'||k==='с'){ // смена оружия игрока
  if(P.hasWeapon !== false){
    const next=(P.weaponType+1)%WEAPON_TYPES.length; 
    setWeapon(P,next);
    clearBowTensionFX();
    // 🔥 ЗАЩИТА ОТ ОШИБКИ
    const weaponName = WEAPON_TYPES[next] ? WEAPON_TYPES[next].name : 'НЕИЗВЕСТНО';
    hitFX.push({x:P.x,y:P.y-40,t:'ОРУЖИЕ: '+weaponName,life:60,big:false,col:'#88ccff'});
  }
}

if(k==='v'||k==='м'){ // смена оружия бота
  if(D.hasWeapon !== false){
    const next=(D.weaponType+1)%WEAPON_TYPES.length; 
    setWeapon(D,next);
    // 🔥 ЗАЩИТА ОТ ОШИБКИ
    const weaponName = WEAPON_TYPES[next] ? WEAPON_TYPES[next].name : 'НЕИЗВЕСТНО';
    hitFX.push({x:D.x,y:D.y-40,t:'ОРУЖИЕ: '+weaponName,life:60,big:false,col:'#ffaa44'});
  }
}
  if(k==='1'){ throwWeapon(P); } // бросок оружия игроком
  if(e.key==='g' || k==='g' || k==='п'){
    // Тот же путь, что и при естественном истощении стамины.
    applyExhaust(P);
    P.stamina = 0;
  }
  if(e.key==='h' || k==='h' || k==='р'){
    addRage(P, 100);
    hitFX.push({x:W/3,y:H/2-40,t:'🔥+100 ЯРОСТЬ',life:45,big:true,col:'#ff4020'});
  }
  if(e.key==='j' || k==='j' || k==='о'){
    if(dummyOn){
      D.rageBuffEnd = GameTime + 4.0;
      D.rage = 100;
      hitFX.push({x:W*0.6,y:H/2-40,t:'🔥 БОТ ЯРОСТЬ',life:45,big:true,col:'#ff6030'});
    }
  }
  if(e.key==='U' || k==='u' || k==='Г'|| k==='г'){
    // Тестовый вызов того же дисбаланса, что применяется при блоке.
    if(!isUnbalanced(P)) applyDisbalance(P);
  }
  e.preventDefault();
});
window.addEventListener('keyup',   e=>{ keys[e.key.toLowerCase()]=false; });
window.addEventListener('resize',  ()=>{
  W=canvas.width = window.innerWidth;
  H=canvas.height = window.innerHeight;
  applyCanvasSmoothing();
  initBoxes(); arenaDirty=true;
});

function toggleDummy(){
  // T/Е = пауза AI у ВСЕХ ботов разом, манекены остаются видимыми
  AI.enabled = !AI.enabled;
  // Синхронизируем флаг паузы со всеми ботами, а не только с "главным" (D)
  for(const _b of ALL_BOTS){
    if(_b._aiState) _b._aiState.enabled = AI.enabled;
  }
  const b=document.getElementById('dtoggle');
  b.textContent=AI.enabled?'🤖 МАНЕКЕН: ВКЛ':'⏸ МАНЕКЕН: ПАУЗА';
  b.classList.toggle('on', AI.enabled);
  hitFX.push({x:W/2, y:H/2-60, t: AI.enabled?'▶ AI ВКЛ':'⏸ AI ПАУЗА', life:55, big:true, col: AI.enabled?'#44ffaa':'#ffaa44'});
}
function toggleAI(){
  dummyOn=!dummyOn;
  const b=document.getElementById('dtoggle');
  b.textContent=dummyOn?'🤖 МАНЕКЕН: ВКЛ':'🤖 МАНЕКЕН: ВЫКЛ';
  b.classList.toggle('on',dummyOn);
  if(dummyOn){
    // 🔥 ЕДИНЫЙ СБРОС ИГРОКА
    resetPlayerState();
    
    // Полный сброс Entity D
    D.hp=100; D.stamina=100; D.exhausted=0; D.unbalanced=0;
    D.x=W/2+110; D.y=H/2; D.vx=0; D.vy=0;
    D.bx=0; D.by=0; D.pvX=0; D.pvY=-8; D.tpX=0; D.tpY=-8;
    D.angle=0; D.vel=0; D._hitCD=-1;
    D.atkPts=0; D.isAttacker=false;
    D._wasExhausted = false;
    D._recovering = false;
    D._recoverProgress = 0;
    D._swingBlockCD = -1;
    D._exhaustedEndTime = 0;
    if(D._wandCharging) { D._wandCharging = false; if(D._wandChargeSoundObj) { try{D._wandChargeSoundObj.pause();}catch(e){} D._wandChargeSoundObj = null; } }
    if(D._magicCharging) { D._magicCharging = false; if(D._magicChargeSoundObj) { try{D._magicChargeSoundObj.pause();}catch(e){} D._magicChargeSoundObj = null; } }
    if(D._bowCharging) { D._bowCharging = false; if(D._bowTensionSound) { try{D._bowTensionSound.pause();}catch(e){} D._bowTensionSound = null; } }
    if(D.hasWeapon===false && typeof setWeapon==='function') setWeapon(D, D.weaponType);
    
    // Полный сброс AI состояния
    AI.enabled=true;
    AI.phase='attack';
    AI._tacticTimer = -1;
    AI._contactCD = -1;
    AI._phaseEnd = -1;
    AI._retreatMode = false;
    AI._spinActive = false;
    AI._feintActive = false;
    AI._lungeActive = false;
    AI._duelPull = false;
    
    // Создаём ботов
    if(typeof applyBotCount==='function') applyBotCount();
    
    // 👇 СБРАСЫВАЕМ СТАТУСЫ У ВСЕХ БОТОВ (кроме первого)
    for(let i = 1; i < ALL_BOTS.length; i++){
      const _b = ALL_BOTS[i];
      if(_b._aiState){
        _b._aiState._isMain = false;
        _b._aiState._mode = 'defence';
        _b._aiState._phase = 'defence';
        _b._aiState._fakeMDown = false;
      }
      _b.hp=100; _b.stamina=100; _b.exhausted=0; _b.unbalanced=0;
      _b.vx=0; _b.vy=0; _b.angle=0; _b.vel=0; _b._hitCD=-1;
      _b.atkPts=0; _b.isAttacker=false;
      _b._wasExhausted = false;
      _b._recovering = false;
      _b._recoverProgress = 0;
      if(_b._wandCharging) { _b._wandCharging = false; if(_b._wandChargeSoundObj) { try{_b._wandChargeSoundObj.pause();}catch(e){} _b._wandChargeSoundObj = null; } }
      if(_b._magicCharging) { _b._magicCharging = false; if(_b._magicChargeSoundObj) { try{_b._magicChargeSoundObj.pause();}catch(e){} _b._magicChargeSoundObj = null; } }
      if(_b._bowCharging) { _b._bowCharging = false; if(_b._bowTensionSound) { try{_b._bowTensionSound.pause();}catch(e){} _b._bowTensionSound = null; } }
      if(_b.hasWeapon===false && typeof setWeapon==='function') setWeapon(_b, _b.weaponType);
    }
    
    // 👇 ПЕРВЫЙ БОТ — ГЛАВНЫЙ
    if(ALL_BOTS.length > 0){
      D = ALL_BOTS[0];
      D._aiState._isMain = true;
      D._aiState._mode = 'attack';
      D._aiState._phase = 'attack';
      D._aiState._fakeMDown = true;
      AI = D._aiState;
    }
    
    // 👇 ТАЙМЕР СМЕНЫ (9999 СЕКУНД)
    _lastCrownSwitchTime = GameTime;
    _mainBotSwapTime = GameTime + 9999;
  }
}

// ──────────────── END LAYER: GAME_LOOP ────────────────

// ════════════════════════════════════════════════════════════════════════════
// LAYER: BOOTSTRAP — финальный запуск: загрузка звуков, инициализация боксов, старт цикла
// Module section: game startup.
// ════════════════════════════════════════════════════════════════════════════

loadAudioDB(); // запускаем загрузку в фоне
initBoxes();

// ──────────────── END LAYER: BOOTSTRAP ────────────────

requestAnimationFrame(loop);
