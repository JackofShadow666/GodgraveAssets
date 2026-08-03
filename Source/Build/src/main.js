// === src/main.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: UPDATE TICK — main frame update function (uses everything above)
// Module section: update tick.
// =======================================================================================


function update(dt){
  if(DEATH.pDead) return; // dead — no update
  const step = $.M.step(dt);
  updateBuffs(P, dt);
    // ? DEBUFF UPDATE
  if (P._debuffActive && (P._debuffUntil || 0) < GameTime) {
    P._debuffActive = false;
    P._debuffType = null;
    P._debuffIntensity = 0;
    P.exhausted = 0;
  }
  // --- character movement ---
  let mx=0, my=0;
  if(keys['a']||keys['ф']) mx=-1; if(keys['d']||keys['в']) mx=1;
  if(keys['w']||keys['ц']) my=-1; if(keys['s']||keys['ы']) my=1;
  if(mx||my){ const l=Math.hypot(mx,my); mx/=l; my/=l; }
  if(P._shieldDashCharging){
    mx = 0; my = 0;
    P.vx = 0; P.vy = 0;
  }
  
// Stamina regeneration
if(window.IS_MOBILE && GameTime < (P._shieldHeldUntil || 0) && P.shield>0 && !isExhausted(P) && P.stamina>0) P._shieldHeld = true;
if(mDown && !(window.IS_MOBILE && GameTime < (P._shieldHeldUntil || 0))) P._shieldHeld = false;
const shieldDrainActive = typeof shieldHeld === 'function' && shieldHeld(P);
regenStamina(P, dt, mDown || shieldDrainActive);
if(shieldDrainActive){
  drainStamina(P, 2 * dt);
  if(P.stamina <= 0){
    P._shieldHeld = false;
    if(!isExhausted(P)) applyExhaust(P);
  }
}
  
  // -- MULTIHIT PROTECTION UPDATE ------------------------------
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
    // -- Staff/Crossbow: LMB fully replaces rage buff — shooting instead --
    P.lmbWasDown = mDown;
    P.lmbHoldStart = -1;
    if(isExhausted(P)) mDown = false; // exhaustion cancels LMB just like before
    updateRangedWeaponFire(P, mDown);
    updateCrossbowReloadSound(P);
  } else {
    P._wandCharging = false;
    // -- RAGE BUFF: while LMB held spends 30/sec, extends buff --------------
    if(inRageBuff && mDown){
      P.rage = Math.max(0, P.rage - 30 * dt);
      if(P.rage > 0) P.rageBuffEnd = Math.max(P.rageBuffEnd, GameTime + 0.1);
    }

    // -- LMB: activates buff IMMEDIATELY on press, text after 0.5 sec --------------
    if(isExhausted(P) && mDown){
      // Exhaustion: LMB forcibly released
      mDown = false;
    }
    // Do not start LMB if cannot afford its full cost.
    if(!inRageBuff && P.rage < 30 && mDown && !P.lmbWasDown && $.NOT(P, 'flail') && P.stamina < lmbStaminaCost){
      mDown = false;
      if((P._lmbNoStaminaTextUntil || 0) <= GameTime){
        const rc = $.POS.root();
        $.FX.hit({x:rc.x, y:rc.y-55, t:(window.I18N ? window.I18N.t('main.staminaWarningShort') : 'NO STAMINA'), life:35, big:false, col:'#ff8844'});
        P._lmbNoStaminaTextUntil = GameTime + 0.5;
      }
    }
    if(mDown && $.NOT(P, 'flail')){
      if(!P.lmbWasDown){
        P.lmbWasDown = true;
        P.lmbHoldStart = GameTime;
        
        if (!isRangedWeapon(P)) {
          $.S.play('hammerSwing');
        }
        if(!inRageBuff){
          if(P.rage >= 30){
            P.rage = Math.max(0, P.rage - 30);
            P.rageBuffEnd = GameTime + 1.0;
            P._rageTextShown = false;
            $.S.play('rage');
            // During rage activation LMB does not drain stamina.
            P._lmbHoldDrainRate = P.stamina;
          } else {
            drainStamina(P, lmbStaminaCost);
            // Fixed remainder should be exactly enough for one second of hold.
            P._lmbHoldDrainRate = P.stamina;
          }
        }
      }
      if(P.rageBuffEnd > GameTime && !P._rageTextShown && (GameTime - (P.lmbHoldStart||0)) >= 0.5){
        P._rageTextShown = true;
        $.FX.hit({x:W/2,y:H/2-50,t:(window.I18N ? window.I18N.t('main.rageActivatedShort') : 'RAGE!'),life:40,big:true,col:'#ff2020'});
      }
      // Normal LMB hold without active rage constantly drains stamina.
      if(P.rageBuffEnd <= GameTime){
        drainStamina(P, (P._lmbHoldDrainRate || 0) * dt);
      }
    } else {
      P.lmbWasDown = false;
      P.lmbHoldStart = -1;
      P._lmbHoldDrainRate = 0;
    }
  }

  // Exhaustion when stamina=0 (only if no buff)
if(P.stamina <= 0 && !isExhausted(P) && !(P.rageBuffEnd > GameTime) && (P._exhaustedEndTime||0) <= GameTime){
  P.stamina = 0;
  applyExhaust(P);
  P._exhaustedEndTime = GameTime + (P.exhaustDur||sv('exhdur2')) + P.exhaustRegenDelay;
  $.S.play('exhaust');
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
    P._dustCD = (P._dustCD||0) - dt;
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
    const swordRelAng = Math.abs($.M.angDiff(P.angle, moveAng));
    swordIsBehind = swordRelAng > Math.PI * 0.917;
    const backBoost = sv('swordback') + (1.0 - sv('swordback')) / 3.0;
    swordBackMult = swordRelAng > Math.PI * 0.6 ? backBoost : sv('swordback');
  }

  if(P._wandCharging){ mx = 0; my = 0; P.vx = 0; P.vy = 0; }
  const hasInput = mx !== 0 || my !== 0;
  const _pMoveLocked = GameTime < (P._moveLockUntil||0);
  
  if(_pMoveLocked){
    P.vx = $.M.decay(P.vx, sv('inertia'), dt);
    P.vy = $.M.decay(P.vy, sv('inertia'), dt);
  } else if(hasInput){
    P.vx = $.M.lerpDT(P.vx, mx*maxV*swordBackMult, 0.28, dt);
    P.vy = $.M.lerpDT(P.vy, my*maxV*swordBackMult, 0.28, dt);
  } else {
    P.vx = $.M.decay(P.vx, sv('inertia'), dt);
    P.vy = $.M.decay(P.vy, sv('inertia'), dt);
  }
  
  (() => {
    const mLR = 40;
    const mT  = 30;
    const mB  = 35;
    if((P.x<mLR&&P.vx<0)||(P.x>WORLD_W-mLR-80&&P.vx>0)) P.vx*=0.5;
    if((P.y<mT &&P.vy<0)||(P.y>WORLD_H-mB -40&&P.vy>0))  P.vy*=0.5;
  })();
  P.vx = $.M.clamp(P.vx, -15, 15); P.vy = $.M.clamp(P.vy, -15, 15);
  
  if(P._dvx||P._dvy){
    const impulseStep = decayingImpulseStep(dt);
    if(P.shield>0 && (P._shieldDashBashActiveUntil||0) > GameTime && typeof shieldDef==='function' && shieldDef(P)
       && typeof shieldHeld==='function' && shieldHeld(P)
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
        const _chargePower = Math.max(0, Math.min(1, P._shieldDashChargePower || 0));
        D.vx += _toD_x*(5 + _chargePower*5); D.vy += _toD_y*(5 + _chargePower*5);
        if(!isUnbalanced(D)) applyDisbalance(D, P);
        P._shieldDashBashActiveUntil = 0;
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
            textSuffix: '??',
            bloodCount: 6,
            playSound: false
          });
          $.FX.hit({x:D.x, y:D.y-52, t:'-'+spikeDmg, life:40, big:false});
          if(typeof spawnBlood==='function') spawnBlood(D.x, D.y, _toD_x, _toD_y);
          $.S.play('damageHammer');
          if(D.hp<=0 && typeof handleCombatDeath==='function') handleCombatDeath(D);
        }
        $.FX.hit({x:D.x,y:D.y-30,t: _spiked?(window.I18N?window.I18N.t('main.spikedBash'):'???? SPIKE BASH!'):(window.I18N?window.I18N.t('main.bash'):'?? BASH!'),life:45,big:true,col:'#60ccff'});
        if(typeof FX_EFFECTS!=='undefined') FX_EFFECTS.push({type:'shieldwave', x:P.x, y:P.y, t:0, duration:22, angle:Math.atan2(_toD_y, _toD_x), followEntity:P, followShield:true, cursorX:mX});
        playSound?.('shieldblock');
        if(typeof triggerHitstop==='function') triggerHitstop(3,3);
      }
    }
    const _preX=P.x+P.vx*step+(P._dvx||0)*impulseStep;
    P.x=$.M.clamp(_preX, 40, WORLD_W-80);
    if(Math.abs(_preX-P.x)>2 && Math.abs(P._dvx||0)>1){
      const _rc=$.POS.root();
      const _td=Math.hypot(mX-_rc.x,mY-_rc.y)||1;
      P._dvx=(mX-_rc.x)/_td*Math.abs(P._dvx)*0.5;
      P._dvy=(mY-_rc.y)/_td*Math.abs(P._dvy||0)*0.5;
    }
    const _preY=P.y+P.vy*step+(P._dvy||0)*impulseStep;
    P.y=$.M.clamp(_preY, 40, WORLD_H-40);
    if(Math.abs(_preY-P.y)>2 && Math.abs(P._dvy||0)>1 && Math.abs(P._dvx||0)<2){
      const _rc2=$.POS.root();
      const _td2=Math.hypot(mX-_rc2.x,mY-_rc2.y)||1;
      P._dvx=(mX-_rc2.x)/_td2*Math.abs(P._dvx||0)*0.5;
      P._dvy=(mY-_rc2.y)/_td2*Math.abs(P._dvy)*0.5;
    }
    const decay=Math.pow(0.01, dt);
    P._dvx*=decay; P._dvy*=decay;
    if(Math.hypot(P._dvx,P._dvy)<0.1){ P._dvx=0; P._dvy=0; }
  } else {
    P.x=$.M.clamp(P.x+P.vx*step, 40, WORLD_W-80);
    P.y=$.M.clamp(P.y+P.vy*step, 40, WORLD_H-40);
  }
  resolveBoxCollision(P);

  // ?? RECOIL ANIMATION
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

  // ?? GET STYLE
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

  // --- body offset ---
  updateCamera(rawDt);
  const rc = $.POS.root();
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
  const scaledDist = dist * $.M.clamp(mouseDist / 120, 0, 1);
  P.tbx = Math.cos(oppAng) * scaledDist;
  P.tby = Math.sin(oppAng) * scaledDist;

  // ?? BODY — slow down when exhausted
const exhBodyMult = isExhausted(P) ? 0.3 : 1.0;
  const bspd = sv('spd') * exhBodyMult;
  P.bx = $.M.lerpDT(P.bx, P.tbx, bspd, dt);
  P.by = $.M.lerpDT(P.by, P.tby, bspd, dt);

  // --- sword scale ---
  const meleePoseActive = $.A.meleeHold(P, mDown);
  const targetScale = meleePoseActive ? sv('sc1') : sv('sc0');
  P.swordScale += (targetScale - P.swordScale) * sv('scs');

  // --- COMBO PIVOT ---
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
    P.tpX = $.M.lerpDT(P.tpX, tx, aspd, dt);
    P.tpY = $.M.lerpDT(P.tpY, ty, aspd, dt);
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
      const t = $.M.clamp(-Math.sin(ang), 0, 1);
      eyOffset -= t * (isRanged ? 60 : csv('adaY'));
    }
    if(style.adaD){
      const ang6 = ang - Math.PI/2;
      const tc = Math.cos(ang6);
      const tDown = $.M.clamp(tc * tc * (tc > 0 ? 1 : 0), 0, 1);
      eyOffset += tDown * (isRanged ? 45 : csv('adaD'));
    }
    let pivDownOffset = 0;
    if(style.ada12){
      const ang12 = ang + Math.PI/2;
      const t12 = $.M.clamp(Math.cos(ang12 * 2), 0, 1);
      pivDownOffset = t12 * (isRanged ? 25 : csv('ada12'));
    }

    const tx = Math.cos(inv) * ex;
    const ty = Math.sin(inv) * style.ey + eyOffset + pivDownOffset;
    P.tpX = $.M.lerpDT(P.tpX, tx, style.blk, dt);
    P.tpY = $.M.lerpDT(P.tpY, ty, style.blk, dt);
  }

  // ?? SWORD PIVOT (hand) — barely moves when exhausted
  const exhPivotMult = isExhausted(P) ? 0.05 : 0.35;
  P.pvX += (P.tpX - P.pvX) * exhPivotMult;
  P.pvY += (P.tpY - P.pvY) * exhPivotMult;

  // --- SWORD ANGLE ---
  const pivX = rc.x + P.pvX;
  const pivY = rc.y + P.pvY;
  const arad = 0;
  const abrad = 0;
  const cursorDistFromRoot = Math.hypot(effectiveMX - rc.x, effectiveMY - rc.y);
  const inAutoBlock = !mDown && abrad > 1 && cursorDistFromRoot < abrad;

  let ta;
  
  // ---- INSIDE CIRCLE ----
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
    P.tpX = $.M.lerpDT(P.tpX, tx, aspd, dt);
    P.tpY = $.M.lerpDT(P.tpY, ty, aspd, dt);
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
    P.vel = P.vel*0.6 + $.M.angDiff(ta, P.angle)*0.4*weaponSwingSpeedMult(P);
    const mobileBoost = window.IS_MOBILE ? 1.35 : 1.0;
    P.angle = $.M.angLerpDT(P.angle, ta, aspd * mobileBoost * getMod(P, 'swordSlow', 1), dt);
    P._inABang = angToCursor;
    
  // ---- VIRTUAL AIM ----
  } else if(arad > 1){
    const dmx = mX - P._pmX, dmy = mY - P._pmY;
    P._vcX += dmx; P._vcY += dmy;
    const vd = Math.hypot(P._vcX, P._vcY) || 0.001;
    if(vd > arad){ P._vcX = P._vcX/vd*arad; P._vcY = P._vcY/vd*arad; }
    ta = Math.atan2(P._vcY, P._vcX);
    P.vel = P.vel*0.6 + $.M.angDiff(ta, P.angle)*0.4*weaponSwingSpeedMult(P);
    P.angle += $.M.angDiff(ta, P.angle) * 0.28 * getMod(P, 'swordSlow', 1);
    
    // ---- NORMAL MODE (including flail) ----
  } else {
    const isFlail = $.IS(P, 'flail');
    
    if (isFlail) {
      const targetAng = Math.atan2(effectiveMY - pivY, effectiveMX - pivX);
      updateFlailSwing(P, targetAng, dt);
    } else {
      ta = Math.atan2(effectiveMY - pivY, effectiveMX - pivX);
      
      // ?? EXHAUSTION: remember that sword was frozen
      const wasExhausted = isExhausted(P);
      
      // If exhaustion just ended — start smooth recovery
      if (P._wasExhausted && !wasExhausted) {
        P._recoverStartAngle = P.angle;
        P._recoverTargetAngle = ta;
        P._recoverProgress = 0;
        P._recoverDuration = 1.0; // 1 second to recover
        P._recovering = true;
      }
      P._wasExhausted = wasExhausted;
      
           // ?? SMOOTH RECOVERY AFTER EXHAUSTION
      if (P._recovering) {
        // Increase recovery time to 2.5 seconds
        P._recoverDuration = 0.3;
        P._recoverProgress += dt / P._recoverDuration;
        const progress = Math.min(1, P._recoverProgress);
        
        // Slow start, then acceleration
        const eased = progress * progress * (3 - 2 * progress);
        
        // Interpolate angle from frozen to target
        let diff = $.M.angDiff(P._recoverTargetAngle, P._recoverStartAngle);
        let targetAngle = P._recoverStartAngle + diff * eased;
        
        // ?? LIMIT MAXIMUM TURN PER FRAME
        const MAX_TURN_PER_FRAME = 0.04; // ~2.3° per frame (very slow)
        let angleDiff = $.M.angDiff(targetAngle, P.angle);
        let clampedDiff = Math.max(-MAX_TURN_PER_FRAME, Math.min(MAX_TURN_PER_FRAME, angleDiff));
        P.angle += clampedDiff;
        
        // Speed gradually increases
        P.vel = P.vel * (1 - eased * 0.3) + diff * eased * 0.5;
        
        if (progress >= 1) {
          P._recovering = false;
          P.angle = P._recoverTargetAngle;
          P.vel = 0;
        }
      } else {
        // ?? Exhaustion via exhswd2 (slider)
       const exhSwordMult = getMod(P, 'swordSlow', 1);
        
        // ????>? WEAPON WEIGHT — slows turning
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
        
        const isLMBHeld = $.A.meleeHold(P, mDown);
        const lmbMult = isLMBHeld ? 1 : 1.0;
        const finalSpeed = weightSpeed * exhSwordMult * lmbMult;
        
if (hasMod(P, 'weaponRecoil')) {
  // Detached phase: ignore the cursor and keep rotating from the hit impulse.
  // Decay is continuous, so the subsequent normal lerp has no angle jump.
  P._disbalanceAngularVelocity = (P._disbalanceAngularVelocity || 0) * Math.pow(0.12, dt);
  P.angle += P._disbalanceAngularVelocity * dt;
  P.vel = P._disbalanceAngularVelocity;
} else {
          P.vel = P.vel * 0.6 + $.M.angDiff(ta, P.angle) * 0.4 * weaponSwingSpeedMult(P) * exhSwordMult;
          P.angle = $.M.angLerpDT(P.angle, ta, finalSpeed, dt);
        }
      }
    }
  }

  // --- Flick and swing detection ---
  const _flickAimAngle = Number.isFinite(ta) ? ta : P.angle;
  const _flickPrevAngle = P._flickPrevAngle;
  P._realAngVel = _flickPrevAngle === undefined ? 0 : $.M.angDiff(_flickAimAngle, _flickPrevAngle) / Math.max(dt, 0.001);
  P._flickPrevAngle = _flickAimAngle;
  const orbitSwingPenaltyReady = () => GameTime - (P._lastOrbitSwingPenaltyTime || -99) >= 1.3;
  const markOrbitSwingPenalty = () => { P._lastOrbitSwingPenaltyTime = GameTime; };
  const _orbitDetected1 = updateOrbitDetect(P.angle, dt);
  if(_orbitDetected1 && !isExhausted(P) && $.NOT(P, 'flail')){
    if(orbitSwingPenaltyReady()){
      drainStamina(P, sv('stamorbit'));
      markOrbitSwingPenalty();
      if(P.stamina <= 0 && !isExhausted(P)) applyExhaust(P);
    }
    $.FX.hit({x: rc.x + P.pvX, y: rc.y + P.pvY - 30, t:(window.I18N ? window.I18N.t('main.orbit') : 'ORBIT'), life:35,big:false,col:'#ff8840'});
    $.S.play('whoosh');
  }
  if(!P._swingCD) P._swingCD = -1;
  if(P.hasWeapon === false || isRangedWeapon(P)){
    P._swingFX = false;
  } else {
    if(!isExhausted(P) && updateFlickDetect(P._realAngVel ?? P.vel, dt) && (P._swingBlockCD||0) < GameTime){
      if($.IS(P, 'flail') && P._flailExt < 0.97){
        // Ignore
      } else if (!(GameTime < (P._dodgeActiveUntil||0))) {
        drainStamina(P, sv('stamflick'));
        if(P.stamina <= 0 && !isExhausted(P)) applyExhaust(P);
        P._swingBlockCD = GameTime + 0.15;
        $.FX.hit({x: rc.x + P.pvX, y: rc.y + P.pvY - 25, t:(window.I18N ? window.I18N.t('main.flick') : 'FLICK'), life:30, big:false, col:'#ffaa20'});
        $.S.play(isHeavySwingWeapon(P) ? 'hammerSwing' : 'whoosh');
      }
    }

    const swingThreshold = $.IS(P, 'flail') ? sv('swthresh') * 5 : sv('swthresh');
    if(!isExhausted(P) && Math.abs(P.vel) > swingThreshold && (P._swingBlockCD||0) < GameTime){
      if($.IS(P, 'flail') && P._flailExt < 0.97){
        P._swingFX = false;
      } else {
        if(!P._swingFX){
          P._swingFX = true;
          const rc0 = $.POS.root();
          $.FX.hit({x: rc0.x + P.pvX, y: rc0.y + P.pvY - 30, t:(window.I18N ? window.I18N.t('main.swing') : 'SWING'), life:35, big:false, col:'#ffcc44'});
          if(isHeavySwingWeapon(P)) $.S.play('hammerSwing');
          else if(P.rageBuffEnd>GameTime) $.S.play('whooshRage'); else $.S.play('whoosh');
        }
        if(P._swingCD <= GameTime){
          if(!(GameTime < (P._dodgeActiveUntil||0))){
            let staminaCost = sv('stamswing') * weaponStaminaMult(P);
            const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
            if(botCount > 1){
              const costMult = Math.max(0.3, 1 / (1 + (botCount - 1) * 0.25));
              staminaCost = staminaCost * costMult;
            }
            if(orbitSwingPenaltyReady()){
              drainStamina(P, staminaCost*0.8);
              markOrbitSwingPenalty();
              if(P.stamina <= 0 && !isExhausted(P)) applyExhaust(P);
            }
          }
          P._swingCD = GameTime + 1.0;
        }
      }
    } else {
      P._swingFX = false;
    }
  }

  // --- ball hit detection ---
  {
    const rc0 = $.POS.root();
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
        $.FX.hit({x: bodyCX, y: bodyCY - 20, t:(window.I18N ? window.I18N.t('main.hitDamage',{damage:dmg}) : ('-'+dmg+'HP')), life:45, big:true});
        const nx = (bodyCX - b.x)/(d||1), ny = (bodyCY - b.y)/(d||1);
        const kbf = sv('bodyKB') * 0.5;
        P.vx += nx * kbf; P.vy += ny * kbf;
        spawnBlood(bodyCX, bodyCY, -nx, -ny);
        b.vx = nx * 3; b.vy = ny * 3 - 1;
        b.hit = 30;
        BALLS.splice(i, 1);
        if(P.hp <= 0){
          if(typeof handleCombatDeath === 'function') handleCombatDeath(P);
          else triggerDeath(P, false);
        }
      }
    }
  }

  // --- HUD ---
  if(!_infRootEl) _infRootEl = document.getElementById('inf-root');
  if(!_infBoffEl) _infBoffEl = document.getElementById('inf-boff');
  if(_infRootEl) _infRootEl.textContent = `${Math.round(rc.x)},${Math.round(rc.y)}`;
  if(_infBoffEl) _infBoffEl.textContent = `${P.bx.toFixed(1)},${P.by.toFixed(1)}`;
}


// ---------------------------------------------------------------------------------
// LAYER: GAME LOOP — fixed timestep, requestAnimationFrame, II toggle
// Module section: game loop.
// =======================================================================================
// =======================================================================================
const TARGET_FPS = 120;
// ============================ END MODULE: COMBAT =====================================

// =======================================================================================
// MODULE: GAME LOOP  (fixed timestep, requestAnimationFrame)
// =======================================================================================
const FRAME_MIN_MS = 1000 / TARGET_FPS;
const FIXED_DT = 1 / SIM_TICK_RATE;
let lastRenderT = 0;
let accumulator = 0; // accumulated real time

// =======================================================================================
// MODULE: VISIBILITY  (pause game and music on tab/page switch)
// =======================================================================================
let gamePaused = false;
// Pause caused by OPEN MENU (not tab switch). While this flag
// is true, returning to the tab MUST NOT unpause — otherwise the menu
// stays on screen but combat (and bots) continues underneath it.
let uiMenuPaused = false;
window._setUiMenuPaused = function(v){ uiMenuPaused = v; };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    gamePaused = true;
    if (typeof currentMusicObj !== 'undefined' && currentMusicObj) currentMusicObj.pause();
  } else {
    if (!uiMenuPaused) gamePaused = false; // don't unpause if menu is open
    lastT = performance.now(); // reset timer to avoid giant dt
    lastRenderT = lastT;
    if (typeof currentMusicObj !== 'undefined' && currentMusicObj && musicEnabled && audioEnabledFlag) {
      currentMusicObj.play().catch(()=>{});
    }
  }
});
// ================================ END MODULE: VISIBILITY ===============================

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

    // ?? MAGIC STAFF EFFECTS
    updateMagicStaffLightning(dt);
    updateMagicStaffGlow(dt);
    updateMagicStaffChargeFX(dt);
    updateLightningHitFX(dt);
// ?? SINGLE SHAKE FOR ALL
updateChargeShake(P, dt);
    if(typeof LocalPlayerControls!=='undefined') LocalPlayerControls.update(dt);
    if(dummyOn){
      for(const bot of ALL_BOTS){
        if(!revealBotIfReady(bot)) continue;
        if(bot.hp <= 0) continue;
        if(!bot._manualControl) updateAIDispatch(dt, bot);
        updateDummy(dt, bot);
        if(typeof LocalPlayerControls!=='undefined') LocalPlayerControls.afterEntityUpdate(bot,dt);
      }
      updateMainBotRotation(dt);
    }
    
    updateFlailExtension(P, dt);
    if(dummyOn){ for(const bot of ALL_BOTS){ if(bot.hp > 0) updateFlailExtension(bot, dt); } }
if(dummyOn) {
  for(const bot of ALL_BOTS) {
    if(bot.hp > 0) updateChargeShake(bot, dt);
  }
}
	
	
    if(dummyOn){
      const combatants=[P,...ALL_BOTS].filter(ent=>ent && ent.hp>0 && !ent._awaitingReveal && !ent._defeated);
      for(let i=0;i<combatants.length;i++){
        for(let j=i+1;j<combatants.length;j++){
          const a=combatants[i], b=combatants[j];
          resolveEntityCollision(a,b);
          if(typeof FactionRules!=='undefined' && !FactionRules.canFight(a,b)) continue;
          updateAtkPoints(a,b,dt); updateAtkPoints(b,a,dt);
          a.isAttacker=a.atkPts>=b.atkPts; b.isAttacker=b.atkPts>a.atkPts;
          checkSwordCollision(a,b,dt);
        }
      }
    }
    
    updateBalls(dt);
    updateBlood(dt);
    updateFX(dt);
    if(typeof window._dodgeTick==='function') window._dodgeTick(dt);
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

  const rc = $.POS.root();

  const doRender = (ts - lastRenderT) >= FRAME_MIN_MS - 1;
  if(doRender) lastRenderT = ts;
  if(doRender){
    const pivX = rc.x + P.pvX;
    const pivY = rc.y + P.pvY;
    window._shakeApplied = typeof window._applyScreenShake==='function' ? window._applyScreenShake() : false;
    ctx.setTransform(CAM_SCALE, 0, 0, CAM_SCALE, -CAM_X * CAM_SCALE, -CAM_Y * CAM_SCALE);
    drawArena();
    if(typeof drawScreenVignette === 'function') drawScreenVignette();
    
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
    
    // ?? DRAW MAGIC STAFF EFFECTS
    drawMagicStaffLightning();
    drawMagicStaffGlow();
    drawMagicStaffChargeFX();
    drawLightningHitFX();
    // Player radius
    if(P._magicCharging && $.IS(P, 'magicstaff')){
      drawMagicStaffRadius(P);
    }
    
    // Bot radius
    if(dummyOn){
      for(const _b of ALL_BOTS){
        if(_b.hp > 0 && _b._magicCharging && $.IS(_b, 'magicstaff')){
          drawMagicStaffRadius(_b);
        }
      }
    }
    
    { // Draw ALL bots
      for(const _b of ALL_BOTS){ drawDummy(_b); }
    }
    
    const _pSwordBehind = shieldDef(P) && shieldSameSideAsSword(P);
    if(_pSwordBehind && P.hasWeapon !== false) drawSword(pivX, pivY, P.angle);
    drawPlayer();
    if(!_pSwordBehind && P.hasWeapon !== false) drawSword(pivX, pivY, P.angle);
    
    if(dummyOn){
      for(const _b of ALL_BOTS){ if(_b.shield>0 && !isShieldSuppressed(_b)) drawShield(_b, P.x); }
    }
    if(P.shield>0 && !isShieldSuppressed(P)) drawShield(P, mX);
    
    drawBlood();
    drawFXEffects();
    drawDustFX(rawDt);
    drawDeathCrosses();
    drawFX();
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if(typeof drawZone==='function') drawZone();
    drawCursor();
    if(typeof window._restoreScreenShake==='function') window._restoreScreenShake(window._shakeApplied);
  }

  if(typeof updateBloodPools==='function') updateBloodPools(rawDt);
  if(typeof updateZone==='function') updateZone(rawDt);
  if(typeof NET_SYNC !== 'undefined') NET_SYNC.tick(rawDt);

  requestAnimationFrame(loop);
}

// -- INPUT --------------------------------------------------------------------------
canvas.addEventListener('mousemove', e=>{
  const r=canvas.getBoundingClientRect();
  mouseScreenX=e.clientX-r.left;
  mouseScreenY=e.clientY-r.top;
  updateMouseWorld();
});
canvas.addEventListener('mousedown', e=>{
  if(e.button===0){ mDown=true; P._shieldHeld=false; return; }
  if(e.button===2 && !window.IS_MOBILE){
    e.preventDefault();
    if(P.shield>0 && !isExhausted(P) && P.stamina>0) P._shieldHeld=true;
  }
});
canvas.addEventListener('mouseup',   e=>{
  if(e.button===0){ mDown=false; return; }
  if(e.button===2) P._shieldHeld=false;
});
function browserInputLocked(){
  const cfgUnlock = !!(window.GG_DEBUG_CONFIG && window.GG_DEBUG_CONFIG.unlockBrowserInput);
  const queryUnlock = typeof URLSearchParams !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debugbrowser') === '1';
  let storageUnlock = false;
  try{
    storageUnlock = localStorage.getItem('gg_unlock_browser_input') === '1';
  }catch(_err){}
  if(cfgUnlock || queryUnlock || storageUnlock) return false;
  return !(typeof cb === 'function' && cb('debugbrowser'));
}
// RMB is intentionally unused: block browser context menus and any future
// accidental right-button gameplay bindings.
function blockRmbBrowserEvent(e){
  if(!browserInputLocked()) return false;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  return false;
}




function isRmbBrowserEvent(e){
  return e.button===2 || (typeof e.buttons === 'number' && (e.buttons & 2) !== 0);
}

window.addEventListener('contextmenu', e=>{ blockRmbBrowserEvent(e); }, true);
window.addEventListener('pointerdown', e=>{
  if(isRmbBrowserEvent(e) && browserInputLocked()){
    if(!window.IS_MOBILE && P.shield>0 && !isExhausted(P) && P.stamina>0) P._shieldHeld=true;
    blockRmbBrowserEvent(e);
  }
}, true);
window.addEventListener('pointerup', e=>{
  if(isRmbBrowserEvent(e) && browserInputLocked()){
    P._shieldHeld=false;
    blockRmbBrowserEvent(e);
  }
}, true);
window.addEventListener('mousedown', e=>{
  if(isRmbBrowserEvent(e) && browserInputLocked()){
    if(!window.IS_MOBILE && P.shield>0 && !isExhausted(P) && P.stamina>0) P._shieldHeld=true;
    blockRmbBrowserEvent(e);
  }
}, true);
window.addEventListener('mouseup', e=>{
  if(isRmbBrowserEvent(e) && browserInputLocked()){
    P._shieldHeld=false;
    blockRmbBrowserEvent(e);
  }
}, true);
window.addEventListener('auxclick', e=>{ if(isRmbBrowserEvent(e)) blockRmbBrowserEvent(e); }, true);
// Global handlers: if LMB released outside canvas/window, or window loses focus (alt-tab, tab switch) — reset mDown so
// the game doesn't "stick" in held-button mode.
window.addEventListener('mouseup', e=>{ if(e.button===0) mDown=false; if(e.button===2) P._shieldHeld=false; });
window.addEventListener('blur', ()=>{ mDown=false; P._shieldHeld=false; });
document.addEventListener('mouseleave', ()=>{ mDown=false; P._shieldHeld=false; });
const FALLBACK_KEYBOARD_CODE_ALIASES = {
  KeyW: ['w', 'ц'],
  KeyA: ['a', 'ф'],
  KeyS: ['s', 'ы'],
  KeyD: ['d', 'в'],
  KeyT: ['t', 'е'],
  KeyE: ['e', 'у'],
  KeyR: ['r', 'к'],
  KeyQ: ['q', 'й'],
  KeyY: ['y', 'н'],
  KeyZ: ['z', 'я'],
  KeyX: ['x', 'ч'],
  KeyC: ['c', 'с'],
  KeyV: ['v', 'м'],
  KeyG: ['g', 'п'],
  KeyH: ['h', 'р'],
  KeyU: ['u', 'г'],
  KeyI: ['i', 'ш'],
  KeyJ: ['j', 'о'],
  KeyO: ['o', 'щ'],
  Digit1: ['1'],
  Space: [' '],
  Enter: ['enter'],
  Escape: ['escape']
};
function getKeyAliases(event){
  if(window.GG_KEYBOARD_LAYOUT?.getAliases){
    return window.GG_KEYBOARD_LAYOUT.getAliases(event);
  }
  const aliases = new Set();
  const key = String(event?.key || '').toLowerCase();
  if(key) aliases.add(key);
  const byCode = FALLBACK_KEYBOARD_CODE_ALIASES[event?.code];
  if(Array.isArray(byCode)){
    for(const alias of byCode) aliases.add(alias);
  }
  return aliases;
}
function setKeyState(event, pressed){
  for(const alias of getKeyAliases(event)) keys[alias] = pressed;
}
function isVisibleElement(el){
  if(!el) return false;
  if(el === document.body) return true;
  if(el.offsetParent !== null) return true;
  const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
  return !!style && style.display !== 'none' && style.visibility !== 'hidden';
}
function shouldIgnoreGameplayKeydown(){
  const active = document.activeElement;
  if(!active || active === document.body) return false;
  if(active.isContentEditable) return true;
  const tag = active.tagName;
  if(tag === 'TEXTAREA') return true;
  if(tag === 'SELECT') return true;
  if(tag !== 'INPUT') return false;
  const type = String(active.type || '').toLowerCase();
  const textTypes = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number']);
  if(textTypes.has(type)) return isVisibleElement(active);
  return false;
}
window.addEventListener('keydown', e=>{
  const lockBrowserKeys = browserInputLocked();
  if((e.code==='Equal' || e.code==='NumpadAdd') && !e.repeat){
    window._keyboardCrosshairVisible = window._keyboardCrosshairVisible === false;
    e.preventDefault();
    return;
  }
  // Text-entry UI keeps keyboard focus; range/checkbox controls must not
  // disable gameplay hotkeys after a click.
  if(shouldIgnoreGameplayKeydown()) return;
  // Skip if any game-overlay is open (Enter/Escape are handled separately)
  if(document.querySelector('.game-overlay.open')) return;
  const k = e.key.toLowerCase();
  if(typeof LocalPlayerControls!=='undefined' && LocalPlayerControls.isLocalPvP() &&
     ['x','ч','v','м','j','о','i','ш'].includes(k)){
    // Bot-only debug hotkeys must not mutate an entity owned by player 2.
    return;
  }
  // Open/close settings panel (~, ` or Ё)
  if(e.code === 'Backquote' || e.key === 'ё' || e.key === 'Ё'){
    if(!window.IS_MOBILE){
      const panel = document.getElementById('panel');
      panel.classList.toggle('open');
      // Panel — overlay on top of the game (z-index), canvas/HUD never shift or shrink
    }
    return;
  }
  setKeyState(e, true);
  if(e.code==='Space' && !e.repeat){
    if(typeof window.beginDodgePress==='function') window.beginDodgePress('Space');
    else if(typeof window.doDodge==='function') window.doDodge(true);
  }
  if(k==='t'||k==='т'||k==='е') toggleDummy();  // T/т/е (rus. "е" is same physical key as T) = PAUSE
  if(k==='e'||k==='у'){ if(typeof tryManualPickup==='function') tryManualPickup(P); } // E/у = PICK UP WEAPON
  // Debug shields
  if(k==='r'||k==='к'){ window.toggleSwordStyle(); }
  if(k==='y'||k==='н'){ toggleAI(); } // Y/н (same physical key as Y) = SPAWN BOT
  if(k==='z'||k==='я'){
    P.shield=(P.shield+1)%SHIELD_TYPES.length; setShield(P,P.shield);
    const n=SHIELD_TYPES[P.shield]; $.FX.hit({x:P.x,y:P.y-40,t:(window.I18N?window.I18N.t('main.shieldPlayer',{name:n?n.name:window.I18N.t('main.shieldNone')}):('SHIELD P: '+(n?n.name:'none'))),life:60,big:false,col:'#88ccff'});
  }
  if(k==='x'||k==='ч'){
    D.shield=(D.shield+1)%SHIELD_TYPES.length; setShield(D,D.shield);
    const n=SHIELD_TYPES[D.shield]; $.FX.hit({x:D.x,y:D.y-40,t:(window.I18N?window.I18N.t('main.shieldBot',{name:n?n.name:window.I18N.t('main.shieldNone')}):('SHIELD D: '+(n?n.name:'none'))),life:60,big:false,col:'#ffaa44'});
  }
if(k==='c'||k==='с'){ // player weapon switch
  if(P.hasWeapon !== false){
    const next=(P.weaponType+1)%WEAPON_TYPES.length; 
    setWeapon(P,next);
    clearBowTensionFX();
    // ?? ERROR PROTECTION
    const weaponName = WEAPON_TYPES[next] ? WEAPON_TYPES[next].name : (window.I18N?window.I18N.t('main.unknownWeapon'):'UNKNOWN');
    $.FX.hit({x:P.x,y:P.y-40,t:(window.I18N?window.I18N.t('main.weaponPlayer',{name:weaponName}):('WEAPON: '+weaponName)),life:60,big:false,col:'#88ccff'});
  }
}

if(k==='v'||k==='м'){ // bot weapon switch
  if(D.hasWeapon !== false){
    const next=(D.weaponType+1)%WEAPON_TYPES.length; 
    setWeapon(D,next);
    D._manualWeaponType = next;
    window._manualBotWeaponType = next;
    // ?? ERROR PROTECTION
    const weaponName = WEAPON_TYPES[next] ? WEAPON_TYPES[next].name : (window.I18N?window.I18N.t('main.unknownWeapon'):'UNKNOWN');
    $.FX.hit({x:D.x,y:D.y-40,t:(window.I18N?window.I18N.t('main.weaponBot',{name:weaponName}):('WEAPON: '+weaponName)),life:60,big:false,col:'#ffaa44'});
  }
}
  if(k==='1'){ throwWeapon(P); } // player throws weapon
  if(e.key==='g' || k==='g' || k==='п'){
    // Same path as natural stamina exhaustion.
    applyExhaust(P);
    P.stamina = 0;
  }
  if(e.key==='h' || k==='h' || k==='р'){
    addRage(P, 100);
    $.FX.hit({x:W/3,y:H/2-40,t:(window.I18N?window.I18N.t('main.rageAdd'):'??+100 RAGE'),life:45,big:true,col:'#ff4020'});
  }
  if(e.key==='j' || k==='j' || k==='о'){
    if(dummyOn){
      D.rageBuffEnd = GameTime + 4.0;
      D.rage = 100;
      $.FX.hit({x:W*0.6,y:H/2-40,t:(window.I18N?window.I18N.t('main.botRage'):'?? BOT RAGE'),life:45,big:true,col:'#ff6030'});
    }
  }
  if(e.key==='U' || k==='u' || k==='Г'|| k==='г'){
    // Test call of the same disbalance applied on block.
    if(!isUnbalanced(P)) applyDisbalance(P);
  }
  if(e.key==='I' || k==='i' || k==='Ш'|| k==='ш'){
    // Debug: exactly the same effect and duration, but on the bot.
    if(dummyOn && D && !isUnbalanced(D)) applyDisbalance(D);
  }
  if(lockBrowserKeys) e.preventDefault();
});
window.addEventListener('keyup',   e=>{
  setKeyState(e, false);
  if(e.code==='Space' && typeof window.endDodgePress==='function') window.endDodgePress('Space');
});
window.addEventListener('resize',  ()=>{
  applyCamScale();
  applyCanvasSmoothing();
  initBoxes(); arenaDirty=true;
});

function toggleDummy(){
  // T/Е = pause AI for ALL bots at once, mannequins remain visible
  AI.enabled = !AI.enabled;
  // Sync pause flag with all bots, not just the "main" one (D)
  for(const _b of ALL_BOTS){
    if(_b._aiState) _b._aiState.enabled = AI.enabled;
  }
  const b=document.getElementById('dtoggle');
  b.textContent=window.I18N?window.I18N.buttonText('dtoggle', AI.enabled?'on':'pause'):(AI.enabled?'ON':'PAUSE');
  b.classList.toggle('on', AI.enabled);
  $.FX.hit({x:W/2, y:H/2-60, t: AI.enabled?(window.I18N?window.I18N.t('main.aiOn'):'? AI ON'):(window.I18N?window.I18N.t('main.aiPause'):'? AI PAUSE'), life:55, big:true, col: AI.enabled?'#44ffaa':'#ffaa44'});
}
function toggleAI(){
  if(typeof LocalPlayerControls!=='undefined' && LocalPlayerControls.isLocalPvP()){
    dummyOn=true;
    const input=document.getElementById('sl-botcount');
    if(input){
      const current=Math.max(0,Number(input.value)||0);
      if(current>0){
        window._localBotSpawnPreset=current;
        input.value='0';
      } else {
        input.value=String(Math.min(Number(input.max)||10,window._localBotSpawnPreset||1));
      }
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return;
  }
  dummyOn=!dummyOn;
  const b=document.getElementById('dtoggle');
  b.textContent=window.I18N?window.I18N.buttonText('dtoggle', dummyOn?'on':'off'):(dummyOn?'ON':'OFF');
  b.classList.toggle('on',dummyOn);
  if(dummyOn){
    // Full Entity D reset
    D.hp=100; D.stamina=100; D.exhausted=0; D.unbalanced=0;
    const dSpawn = typeof factionSpawnPoint === 'function' ? factionSpawnPoint('right') : { x:P.x+190, y:P.y };
    D.x=dSpawn.x; D.y=dSpawn.y; D.vx=0; D.vy=0;
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
    
    // Full AI state reset
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
    
    // Spawn bots
    if(typeof applyBotCount==='function') applyBotCount();
    if(typeof applyDuelSpawnLayout === 'function') applyDuelSpawnLayout();
    
    // ?? RESET STATUSES FOR ALL BOTS (except the first one)
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
    
    // ?? FIRST BOT — MAIN
    if(ALL_BOTS.length > 0){
      D = ALL_BOTS[0];
      D._aiState._isMain = true;
      D._aiState._mode = 'attack';
      D._aiState._phase = 'attack';
      D._aiState._fakeMDown = true;
      AI = D._aiState;
    }
    
    // ?? SWAP TIMER (9999 SECONDS)
    _lastCrownSwitchTime = GameTime;
    _mainBotSwapTime = GameTime + 9999;
  }
}

// ---------------------------------------------------------------------------------
// LAYER: BOOTSTRAP — final launch: load sounds, init boxes, start loop
// Module section: game startup.
// =======================================================================================

loadAudioDB(); // start loading in background
initBoxes();
if(typeof applyBotCount === 'function') applyBotCount();
if(typeof applyDuelSpawnLayout === 'function') applyDuelSpawnLayout();
else if(typeof snapCameraToTarget === 'function') snapCameraToTarget();

// ---------------------------------------------------------------------------------

requestAnimationFrame(loop);
