// === src/combat/combat.js ===
// LAYER: COMBAT — sword collisions, block/clash, stamina, recovery, death/respawn
// Module file: combat.js
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// ─── ENTITY CREATION ──────────────────────────────────────────────────────
// ─── ENTITY CREATION ──────────────────────────────────────────────────────
function makeEntity(x, y, swordScale, color, charParams){
  const defaults = {
    stamRegen: 28,       // stamina restored per second
    stamMax: 100,        // maximum stamina
    exhaustRegenDelay: 0.1, // pause before stamina regeneration begins after exhaustion
	_bowSeed: Math.random() * 100, // random seed for bow effects
	   _recoilOffset: 0,
    _recoilAnimTime: 0,
	   _magicShakeX: 0,
    _magicShakeY: 0,
    _magicShakeAngle: 0,
	_rageWarningCD: 0,
    _wandSeed: Math.random() * 100,
    // ─── CHARGE SHAKE ──────────────────────────────────────────────
    _chargeShakeX: 0,
    _chargeShakeY: 0,
    _chargeShakeAngle: 0,
    _chargeSeed: Math.random() * 100,
	
  };
  const p = Object.assign({}, defaults, charParams);
  return Object.assign(new Entity(x, y, {
    isPlayer: color === '#1e4a72',
    isBot: color !== '#1e4a72',
  }), {
    x, y, vx:0, vy:0,
    bx:0, by:0, tbx:0, tby:0,
  _dvx:0, _dvy:0, // dodge impulse
    pvX:0, pvY:-8, tpX:0, tpY:-8,
    angle:0, vel:0, prevAngle:0,
    swordScale,
    color,
    // ─── PARAMETERS OVERRIDES ────────────────────────────────────
    stamRegen: p.stamRegen,
    stamMax: p.stamMax,
    exhaustDur: p.exhaustDur,
    exhaustSpd: p.exhaustSpd,
    exhaustSwd: p.exhaustSwd,
    exhaustRegenDelay: p.exhaustRegenDelay,
    // ─────────────────────────────────────────────────────────────
    _vcX:50, _vcY:0, _pmX:0, _pmY:0,
    hp:100, hitFlash:0,
    stamina:100,
    exhausted:0, unbalanced:0, unbAngle:0,
    atkPts:0, isAttacker:false,
    trailPts:[],
    rage:0, rageBuffEnd:-1, lmbWasDown:false,
    _blockSlow:-1, _hitCD:-1,
    // ─── SHIELD ──────────────────────────────────────────────────
    shield: 0,          // 0=none, 1=small, 2=large, 3=tower
    _shieldImg: null,   // Image object
    _shieldUrl: null,
    _shieldAlpha: 1,    // transparency (fades during LMB attack)
    _shieldW: 0,        // width in pixels (from shield definition)
    _shieldH: 0,        // height in pixels
    
    // ─── FLAIL ──────────────────────────────────────────────────
	    _flailAngle: 0,        // current chain angle relative to handle
    _flailDirection: 1,    // rotation direction
    _flailIsRotating: false,
    _lastCursorAng: 0,     // previous cursor angle for direction detection
	    _flailInertiaVel: 0,   // angular velocity inertia
    _prevFlailAngle: 0,    // previous angle for velocity calculation
	  _flailInertia: 0,        // angular inertia
    _flailExt: 0,            // extension (0-1)
    _flailMode: 'follow',     // 'follow' or 'free'
    _flailFreeAngle: 0,

    _recoilOffset: 0,
    _recoilAnimTime: 0,
	
// ─── MULTIHIT PROTECTION ──────────────────────────────────────────────
_multiHitProtection: false,
_multiHitProtectionTimer: 0,
_multiHitProtectionMult: 1.0,
_lastHitTime: -999,
_hitCount: 0,
  });
}

const P = makeEntity(W/2 - 80, H/2, 0.8, '#1e4a72', {
  stamRegen: 28
});
let D = makeEntity(W/2 + 110, H/2, 0.8, '#4a1a10', {
  stamRegen: 28
});
const trailPts = [];
const SWORD_LEN = 85;

// ─── BOXES ────────────────────────────────────────────────────────────────
// Initialized after W/H are set (see initBoxes in main).
const BOXES = [];
function initBoxes(){
  BOXES.length = 0;
  BOXES.push(
    { x: W/2+120, y: H/2-60,  w: 55, h: 55 },
    { x: W/2-180, y: H/2+80,  w: 55, h: 55 },
    { x: W/2+60,  y: H/2+130, w: 70, h: 40 },
    { x: W/2-80,  y: H/2-130, w: 40, h: 70 }
  );
}

// ─── BOX COLLISION ──────────────────────────────────────────────────────
// Push entities out of boxes and reflect velocity (partial).
function resolveBoxCollision(ent){
  if(!boxesOn) return;
  const BODY_R = 14 * sv('cscl');
  const bCX = ent.x + 5 + ent.bx;
  const bCY = ent.y - 8 + ent.by;
  for(const b of BOXES){
    const nearX = $.M.clamp(bCX, b.x, b.x + b.w);
    const nearY = $.M.clamp(bCY, b.y, b.y + b.h);
    const dx = bCX - nearX, dy = bCY - nearY;
    const dist = Math.hypot(dx, dy);
    if(dist < BODY_R && dist > 0){
      const pen = BODY_R - dist;
      const nx = dx/dist, ny = dy/dist;
      const penC = Math.min(pen, 6);
      ent.x += nx * penC; ent.y += ny * penC;
      const dot = ent.vx*nx + ent.vy*ny;
      if(dot < 0){ ent.vx -= dot*nx*1.2; ent.vy -= dot*ny*1.2; }
    }
  }
}

// ─── ENTITY COLLISION ──────────────────────────────────────────────────
// Keep living characters from occupying the same body space. This is separate
// from faction damage rules: allies collide too, but still cannot hurt each other.
function resolveEntityCollision(a, b){
  if(!a || !b || a===b || a.hp<=0 || b.hp<=0) return;
  const ca=$.POS.body(a), cb=$.POS.body(b);
  let dx=cb.x-ca.x, dy=cb.y-ca.y;
  let dist=Math.hypot(dx,dy);
  const minDist=28*sv('cscl');
  if(dist>=minDist) return;
  if(dist<0.001){ dx=1; dy=0; dist=1; }
  const nx=dx/dist, ny=dy/dist;
  const correction=Math.min((minDist-dist)*0.5,6);
  a.x-=nx*correction; a.y-=ny*correction;
  b.x+=nx*correction; b.y+=ny*correction;
  const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(relative<0){
    const impulse=-relative*0.5;
    a.vx-=nx*impulse; a.vy-=ny*impulse;
    b.vx+=nx*impulse; b.vy+=ny*impulse;
  }
}

// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••• END MODULE: FX ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••

function updateAtkPoints(ent, opponent, dt){
  const exC = $.POS.center(ent);
  const opC = $.POS.body(opponent);
  const toOp = Math.atan2(opC.y - exC.y, opC.x - exC.x);
  const movAng = Math.atan2(ent.vy, ent.vx);
  const movSpd = Math.hypot(ent.vx, ent.vy);

  // +1 if moving toward opponent
  if(movSpd > 0.5 && Math.abs($.M.angDiff(movAng, toOp)) < Math.PI/2)
    ent.atkPts += dt * 1;

  // +1 if weapon tip is close to opponent's body
  const piv = $.POS.pivot(ent);
  const tipX = piv.x + Math.cos(ent.angle) * weaponReach(ent);
  const tipY = piv.y + Math.sin(ent.angle) * weaponReach(ent);
  if(Math.hypot(tipX - opC.x, tipY - opC.y) < 30) ent.atkPts += dt * 1;

  // +1 for fast swing
  if(Math.abs(ent.vel) > sv('swthresh')) ent.atkPts += dt * 1;

  // +2 for LMB click (only for player)
  if(ent === P && mDown) ent.atkPts += dt * 2;

  // Decay
  ent.atkPts *= Math.pow(0.92, dt*60);
}

function determineAttacker(){
  P.isAttacker   = P.atkPts >= D.atkPts;
  D.isAttacker   = D.atkPts > P.atkPts;
}

// ─── BLOCK/COUNTER LOGIC ──────────────────────────────────────────────
// Safe counter window: after a successful block, the defender gets 1.5s
// to counterattack without stamina cost.
const SAFE_COUNTER_WINDOW = 1.5;
function openSafeCounterWindow(defender){
  if(defender && cb('safecounter')){
    defender._safeCounterUntil = GameTime + SAFE_COUNTER_WINDOW;
  }
}
function blockStaminaCost(attacker, ignoreLmbExemption = false){
  // A successful block gives its defender 1.5 seconds to make a counterattack.
  // If that counterattack is blocked too, it costs no stamina.
  if(attacker && cb('safecounter') && (attacker._safeCounterUntil || 0) >= GameTime){
    attacker._safeCounterUntil = 0;
    return 0;
  }
  // Default cost: 2/3 of stamblock, scaled for bots.
  if(!ignoreLmbExemption && attacker === P && mDown) return 0;
  return sv('stamblock') * (2 / 3) * (isBot(attacker) ? 1.2 : 1);
}
function disbalanceComboDebug(ent, text, col = '#ffcc44'){
  if(!cb('unbcombodbg') || ent !== P) return;
  const c = $.POS.body(ent);
  spawnFloatingText(ent, text, { x:c.x, y:c.y-58, col });
}

function updateDisbalanceCombo(attacker, defender){
  const windowDuration = Math.max(0.1, sv('unbcombo') || 2);
  // swordHit() is called only for a confirmed weapon clash. Its `defender`
  // is already the fighter who blocked the current attacking weapon, so an
  // extra LMB/AI-input check here incorrectly discarded most real blocks.
  const defenderCanBlock = defender && defender.hasWeapon !== false &&
    !isRangedWeapon(defender) && weaponKeyOf(defender) !== 'flail';

  // Final step: the same fighter who made the block now lands a strong
  // weapon-on-weapon swing or an active LMB lunge against the same opponent.
  const combo = attacker && attacker._disbalanceCombo;
  const isLmbLunge =
    (attacker === P && mDown && P.lmbWasDown &&
      (GameTime - (P.lmbHoldStart || -99)) <= 0.18) ||
    (attacker === D && typeof AI !== 'undefined' &&
      ((AI._pokeDodgeActive && (GameTime - (D._pokeStartTime || -99)) <= 0.3) ||
       (AI._lungeActive && AI._lungePhase === 'lunge')));
  const isStrongSwing = Math.abs(attacker.vel) > sv('swthresh') * 2.5;
  if(combo && GameTime - combo.startedAt <= windowDuration &&
     combo.target === defender &&
     (isStrongSwing || isLmbLunge)){
    delete attacker._disbalanceCombo;
    const chance = Math.min(100, combo.blocks * 40);
    const triggered = Math.random() * 100 < chance;
    if(triggered && !isUnbalanced(defender)) applyDisbalance(defender, attacker);
    disbalanceComboDebug(attacker,
      triggered
        ? (isLmbLunge ? `LUNGE — DISBALANCE! (${chance}%)` : `SWING — DISBALANCE! (${chance}%)`)
        : `DISBALANCE FAIL (${chance}%)`,
      triggered ? '#ff8830' : '#ff4040');
    return triggered;
  }

  if(!defenderCanBlock) return false;

  // Every weapon block adds a stack and restarts the expiration timer.
  const state = defender._disbalanceCombo;
  const expired = state && GameTime - state.startedAt > windowDuration;
  const blocks = state && state.target === attacker && !expired ? state.blocks + 1 : 1;
  defender._disbalanceCombo = { target: attacker, blocks, startedAt: GameTime };
  disbalanceComboDebug(defender,
    `Block: ${blocks}x → ${Math.min(100, blocks * 30)}%`,
    '#409cff');
  return false;
}

function swordHit(entA, entB){
  const attacker = entA.isAttacker ? entA : entB;
  const defender = entA.isAttacker ? entB : entA;
  openSafeCounterWindow(defender);
  const disbalanceTriggered = updateDisbalanceCombo(attacker, defender);
  if(disbalanceTriggered) return;
  const cost = blockStaminaCost(attacker);
  drainStamina(attacker, cost);
  if(attacker.stamina <= 0 && !isExhausted(attacker)){
    applyExhaust(attacker);
    return;
  }
}

// ─── SEGMENT DISTANCE ──────────────────────────────────────────────────
function segSegDist(ax,ay,bx,by,cx,cy,dx,dy){
  const d1x=bx-ax,d1y=by-ay,d2x=dx-cx,d2y=dy-cy,d12x=ax-cx,d12y=ay-cy;
  const a=d1x*d1x+d1y*d1y, e=d2x*d2x+d2y*d2y;
  if(a<0.001&&e<0.001) return {d:Math.hypot(ax-cx,ay-cy),mx:(ax+cx)/2,my:(ay+cy)/2};
  let s,t;
  if(a<0.001){t=$.M.clamp((d2x*d12x+d2y*d12y)/e,0,1);s=0;}
  else{const c2=d1x*d12x+d1y*d12y;
    if(e<0.001){s=$.M.clamp(-c2/a,0,1);t=0;}
    else{const b2=d1x*d2x+d1y*d2y,den=a*e-b2*b2;
      s=den>0.001?$.M.clamp((b2*(d2x*d12x+d2y*d12y)-e*c2)/den,0,1):0;
      t=$.M.clamp((b2*s+(d2x*d12x+d2y*d12y))/e,0,1);
      s=$.M.clamp((-c2+b2*t)/a,0,1);t=$.M.clamp((b2*s+(d2x*d12x+d2y*d12y))/e,0,1);}}
  const px=ax+s*d1x,py=ay+s*d1y,qx=cx+t*d2x,qy=cy+t*d2y;
  return {d:Math.hypot(px-qx,py-qy),mx:(px+qx)/2,my:(py+qy)/2,px,py,qx,qy,s,t};
}

// ─── SWORD COLLISION DETECTION ──────────────────────────────────────
// Detects weapon clashes: blade + stamina + knockback + hitstop.
function checkSwordCollision(entA, entB, dt){

  // A local player may reuse a bot entity. Skip only two actual AI actors,
  // never an AI actor fighting a locally controlled player slot.
  const aIsPlayer=typeof FactionRules!=='undefined' && FactionRules.isPlayer(entA);
  const bIsPlayer=typeof FactionRules!=='undefined' && FactionRules.isPlayer(entB);
  if(isBot(entA) && isBot(entB) && !aIsPlayer && !bIsPlayer) return;
  
  // ─── IF EITHER HAS NO WEAPON ──────────────────────────────────────
  if(entA.hasWeapon === false || entB.hasWeapon === false) {
    const pivA = $.POS.pivot(entA);
    const pivB = $.POS.pivot(entB);
    const swA = weaponReach(entA) * sv('swlen');
    const swB = weaponReach(entB) * sv('swlen') * (isBot(entB)?sv('botswordscale'):1);
    const tipAx = pivA.x + Math.cos(entA.angle)*swA;
    const tipAy = pivA.y + Math.sin(entA.angle)*swA;
    const tipBx = pivB.x + Math.cos(entB.angle)*swB;
    const tipBy = pivB.y + Math.sin(entB.angle)*swB;
    
    checkBladeVsBody(entA, entB, pivA.x, pivA.y, tipAx, tipAy);
    checkBladeVsBody(entB, entA, pivB.x, pivB.y, tipBx, tipBy);
    return;
  }
  
  const pivA = $.POS.pivot(entA);
  const pivB = $.POS.pivot(entB);

  // ─── BLADE SEGMENTS ──────────────────────────────────────────────
  // spanA/spanB already include BLADEFIXSCALE (see weaponColliderSpan) — that's
  // the real blade length, not just the physical model. This avoids the old
  // problem where only the tip collided, making clashes feel inconsistent.
  const dirAx = Math.cos(entA.angle), dirAy = Math.sin(entA.angle);
  const dirBx = Math.cos(entB.angle), dirBy = Math.sin(entB.angle);
  const spanA = weaponColliderSpan(entA);
  const spanBraw = weaponColliderSpan(entB);
  const botScaleB = isBot(entB) ? sv('botswordscale') : 1;
  const spanB = { back: spanBraw.back * botScaleB, front: spanBraw.front * botScaleB };

  const frontLenA = spanA.front * sv('swlen');
  const backLenA  = spanA.back  * sv('swlen');
  const frontLenB = spanB.front * sv('swlen');
  const backLenB  = spanB.back  * sv('swlen');

  const tipAx = pivA.x + dirAx*frontLenA;
  const tipAy = pivA.y + dirAy*frontLenA;
  const tipBx = pivB.x + dirBx*frontLenB;
  const tipBy = pivB.y + dirBy*frontLenB;
  const backAx = pivA.x - dirAx*backLenA;
  const backAy = pivA.y - dirAy*backLenA;
  const backBx = pivB.x - dirBx*backLenB;
  const backBy = pivB.y - dirBy*backLenB;

  // ─── HANDRANGE ────────────────────────────────────────────────────
  // Hand-to-hand/weapon clash range: how far from pivot the hand/blade tip is.
  const handFrontLenA = Math.min(HANDRANGE, frontLenA);
  const handFrontLenB = Math.min(HANDRANGE, frontLenB);
  const handBackLenA  = Math.min(HANDRANGE, backLenA);
  const handBackLenB  = Math.min(HANDRANGE, backLenB);

  const bladeAx = pivA.x + dirAx*handFrontLenA;
  const bladeAy = pivA.y + dirAy*handFrontLenA;
  const bladeBx = pivB.x + dirBx*handFrontLenB;
  const bladeBy = pivB.y + dirBy*handFrontLenB;
  const backHandAx = pivA.x - dirAx*handBackLenA;
  const backHandAy = pivA.y - dirAy*handBackLenA;
  const backHandBx = pivB.x - dirBx*handBackLenB;
  const backHandBy = pivB.y - dirBy*handBackLenB;

  // ─── BODY HIT RANGE ──────────────────────────────────────────────
  // checkBladeVsBody uses BLADEFIXSCALE already (same as for sword-vs-sword),
  // so it's consistent with the blade collision logic.
const BODY_HIT_RATIO = 0.82; // 82% of total weapon length for body hits
const bodySwA = weaponReach(entA) * sv('swlen') * BODY_HIT_RATIO;
const bodySwB = weaponReach(entB) * sv('swlen') * (isBot(entB)?sv('botswordscale'):1) * BODY_HIT_RATIO;
  const bodyTipAx = pivA.x + dirAx*bodySwA;
  const bodyTipAy = pivA.y + dirAy*bodySwA;
  const bodyTipBx = pivB.x + dirBx*bodySwB;
  const bodyTipBy = pivB.y + dirBy*bodySwB;

  if(entA._bladeCD === undefined) entA._bladeCD = -1;

  // ─── BLADE VS BLADE (weapon clash) ──────────────────────────────
  // We test two segments: front (blade) and back (if any) for each weapon.
  const segsA = [[bladeAx,bladeAy, tipAx,tipAy]];
  if(spanA.back > 0) segsA.push([backHandAx,backHandAy, backAx,backAy]);
  const segsB = [[bladeBx,bladeBy, tipBx,tipBy]];
  if(spanB.back > 0) segsB.push([backHandBx,backHandBy, backBx,backBy]);

  if(!isWeaponDisabled(entA) && !isWeaponDisabled(entB)){
    let res = null;
    for(const sa of segsA){
      for(const sb of segsB){
        const r = segSegDist(sa[0],sa[1],sa[2],sa[3], sb[0],sb[1],sb[2],sb[3]);
        if(!res || r.d < res.d) res = r;
      }
    }
    if(res.d < BLADE_W){
    const sep = BLADE_W - res.d;
    const nx = res.px!==undefined ? (res.px-res.qx)/(res.d||1) : Math.cos(entA.angle+Math.PI/2);
    const ny = res.py!==undefined ? (res.py-res.qy)/(res.d||1) : Math.sin(entA.angle+Math.PI/2);
    const swres = sv('swres');

    const sepClamped = Math.min(sep, 8);
    // This contact is evaluated every simulation tick. Without time scaling,
    // slow motion applies the same full positional shove many more times and
    // a held blade can tow the opponent at near-normal (or higher) speed.
    const contactStep = Math.min(1, $.M.step(dt));
    entA.x += nx*sepClamped*0.5*contactStep;
    entA.y += ny*sepClamped*0.5*contactStep;
    entB.x -= nx*sepClamped*0.5*contactStep;
    entB.y -= ny*sepClamped*0.5*contactStep;

    const dotA = entA.vx*nx + entA.vy*ny;
    if(dotA > 0){ entA.vx -= dotA*nx*swres; entA.vy -= dotA*ny*swres; }
    const dotB = entB.vx*nx + entB.vy*ny;
    if(dotB < 0){ entB.vx -= dotB*nx*swres; entB.vy -= dotB*ny*swres; }

    const aikb = sv('bodyKB');
    if(aikb > 0){
      const spdA = Math.hypot(entA.vx, entA.vy);
      const spdB = Math.hypot(entB.vx, entB.vy);
      const MOVE_THRESH = 1.0;
      if(spdA > MOVE_THRESH){
        const mxA = entA.vx/spdA, myA = entA.vy/spdA;
        const proj = Math.max(0, mxA*(-nx) + myA*(-ny));
        entB.vx -= mxA * aikb * 0.4 * proj * contactStep;
        entB.vy -= myA * aikb * 0.4 * proj * contactStep;
      } else {
        entB.vx -= nx * aikb * 0.3 * contactStep;
        entB.vy -= ny * aikb * 0.3 * contactStep;
      }
      if(spdB > MOVE_THRESH){
        const mxB = entB.vx/spdB, myB = entB.vy/spdB;
        const proj = Math.max(0, mxB*nx + myB*ny);
        entA.vx -= mxB * aikb * 0.4 * proj * contactStep;
        entA.vy -= myB * aikb * 0.4 * proj * contactStep;
      } else {
        entA.vx -= nx * aikb * 0.3 * contactStep;
        entA.vy -= ny * aikb * 0.3 * contactStep;
      }
    }
    
    if(entA._bladeCD <= GameTime){
      entA._bladeCD = GameTime + 0.1;
      const strongSwing = Math.abs(entA.vel) > sv('swthresh')*2.5 || Math.abs(entB.vel) > sv('swthresh')*2.5;
      doClash(entA, entB, res, strongSwing);
      swordHit(entA, entB);
      if(strongSwing) $.S.play('clashHard'); else $.S.play('clash');
      if(typeof triggerHitstop==='function') triggerHitstop(strongSwing?3:2, strongSwing?3:1.5);
      entA._clashFrame = GameTime;
      entB._clashFrame = GameTime;
      const rageGain = 100/sv('rageper') * 0.5;
      addRage(entA, rageGain);
      addRage(entB, rageGain);
      const _otherBot = entA===P ? entB : (entB===P ? entA : null);
      if(_otherBot && isBot(_otherBot)) switchSmartBot(_otherBot);
      aiNotifyContact();
    }
    } // End of blade clash handling
  }

  // ─── BLADE VS BODY ──────────────────────────────────────────────
  checkBladeVsBody(entA, entB, pivA.x, pivA.y, bodyTipAx, bodyTipAy);
  checkBladeVsBody(entB, entA, pivB.x, pivB.y, bodyTipBx, bodyTipBy);
  
  // ─── CROWN SWITCH ──────────────────────────────────────────────────
  const _crownReady = (GameTime - _lastCrownSwitchTime) >= CROWN_SWITCH_COOLDOWN;
  if(_crownReady && isBot(entA) && entA._aiState?._isMain && entB === P){
    if(Math.random() < 0.25){
      const alive = ALL_BOTS.filter(b => b !== entA && b.hp > 0);
      if(alive.length > 0){
        const newMain = alive[Math.floor(Math.random() * alive.length)];
      }
    }
  }
  if(_crownReady && isBot(entB) && entB._aiState?._isMain && entA === P){
  }
} // End of checkSwordCollision

// ─── BLADE VS BODY ──────────────────────────────────────────────────────
// Checks if the attacker's weapon tip hits the defender's body.
function checkBladeVsBody(attacker, defender, pivX, pivY, tipX2, tipY2) {
  // Skip if opponent is already dead
  if (DEATH.pDead || DEATH.dDead) return;
  // Skip if weapon is disabled (e.g., during disarm)
  if (isWeaponDisabled(attacker)) return;
  // In PvP, the player (P) is controlled locally; the opponent (D) is the remote player.
  if (defender === P && attacker === D && typeof NET_SYNC !== 'undefined' && $.NET.active()) return;
  // Iframes: dodge impulse overrides hit
  if (defender === P && Math.hypot(P._dvx || 0, P._dvy || 0) > 200) return;
  
  const bC = $.POS.body(defender);
  const key = weaponKeyOf(attacker);
  
  // ============================================================
  // ─── SPEAR SPECIFIC HANDLING ──────────────────────────────────
  // ============================================================
  if (key === 'spear') {
    const _dirX = Math.cos(attacker.angle);
    const _dirY = Math.sin(attacker.angle);
    
    // Full reach of the spear (including blade)
    const fullReach = weaponLenFor(attacker) * effSwordScale(attacker) * sv('swlen') * (isBot(attacker) ? sv('botswordscale') : 1);
    
    // Spear damage zone is only the tip, not the whole shaft
    // This keeps it consistent with the regular blade collision
    const SPEAR_RATIO = 0.68; // ~70% of the shaft is the tip (0.7–0.85)
    
    // Tip position (only the pointed end)
    const tipX_adj = pivX + _dirX * fullReach * SPEAR_RATIO;
    const tipY_adj = pivY + _dirY * fullReach * SPEAR_RATIO;
    
    // Distance to body center (for damage)
    const distToBody = Math.hypot(bC.x - tipX_adj, bC.y - tipY_adj);
    const BODY_HIT_R = 14;
    const hitR = BODY_HIT_R * sv('cscl');
    

    
    if (distToBody >= hitR) {
    return;
    }

    // ------------------------------------------------------------
    // BOT DODGE (only for AI-controlled bots)
    // ------------------------------------------------------------
    if (defender === D && attacker === P && typeof AI !== 'undefined' && AI.enabled !== false &&
        !(typeof NET_SYNC !== 'undefined' && $.NET.active()) &&
        !(AI._botDodgeCooldown > 0) && D.stamina >= D.stamMax * 0.5) {

      const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
      const scaledChancePct = Math.max(20, 100 - botCount * 10);
      const playerRageDodgeMult = (P.rageBuffEnd || 0) - GameTime > 1 ? 0.5 : 1;
      const finalChance = Math.min(sv('botdodgechance'), scaledChancePct) / 100 * playerRageDodgeMult;

      if (Math.random() < finalChance) {
        AI._botDodgeCooldown = 1.5;
        AI._dodgeLockUntil = GameTime + 0.35;
        let awayX = D.x - P.x,
            awayY = D.y - P.y;
        const canDodgeToward = Math.hypot(D.x - P.x, D.y - P.y) >= 400;
        if (canDodgeToward && Math.random() < (sv('botdodgetoward') / 100)) {
          awayX = -awayX; awayY = -awayY;
        }
        const awayLen = Math.hypot(awayX, awayY) || 1;
        D._dvx = (awayX / awayLen) * 8;
        D._dvy = (awayY / awayLen) * 8;
        D._hitCD = GameTime + 0.35;
        if (typeof spawnDust === 'function')
          for (let i = 0; i < 8; i++) spawnDust(D.x, D.y, -awayX / awayLen * 8, -awayY / awayLen * 8);
        $.FX.hit({ x: D.x, y: D.y - 30, t: (window.I18N ? window.I18N.t('common.dodge') : 'DODGE'), life: 35, big: false, col: 'rgba(200,200,200,0.6)' });
        $.S.play('dodgeSound');
        return;
      }
    }
    
    // ------------------------------------------------------------
    // SHIELD BLOCK
    // ------------------------------------------------------------
    if (shieldDef(defender) && !isShieldSuppressed(defender)) {
      const _shSc = shieldCenter(defender, attacker === P ? mX : (typeof P !== 'undefined' ? P.x : W / 2));
      if (_shSc) {
        const _shW2 = defender._shieldW || 20,
              _shH2 = defender._shieldH || 30;
        const _shL = _shSc.x - _shW2 / 2,
              _shR = _shSc.x + _shW2 / 2;
        const _shT = _shSc.y - _shH2 / 2,
              _shB = _shSc.y + _shH2 / 2;
        if (tipX_adj >= _shL && tipX_adj <= _shR && tipY_adj >= _shT && tipY_adj <= _shB) {
          const _mx2 = (bC.x + tipX_adj) / 2,
                _my2 = (bC.y + tipY_adj) / 2;
          const lmbActive = (defender === P) ? mDown : false;
          if (!lmbActive && (defender._shieldAlpha || 1) > 0.4) {
            applyShieldBlockFX(_mx2, _my2, attacker, defender);
            const _bvx = (tipX_adj - bC.x),
                  _bvy = (tipY_adj - bC.y),
                  _bl = Math.hypot(_bvx, _bvy) || 1;
            attacker.vx -= _bvx / _bl * 3;
            attacker.vy -= _bvy / _bl * 3;
            
            if (weaponHasFlag(attacker, 'knockback_hammer')) {
              defender.vx -= _bvx / _bl * 18;
              defender.vy -= _bvy / _bl * 18;
              defender.unbalanced = Math.max(defender.unbalanced, 0.8);
            }
            if (weaponHasFlag(attacker, 'knockback_staff')) {
              defender.vx -= _bvx / _bl * 8;
              defender.vy -= _bvy / _bl * 8;
              defender.unbalanced = Math.max(defender.unbalanced, 0.4);
            }
            defender._hitCD = GameTime + 0.3;
            return;
          }
        }
      }
    }
    
    // ------------------------------------------------------------
    // DAMAGE APPLICATION
    // ------------------------------------------------------------
    if (defender._hitCD === undefined) defender._hitCD = -1;
    if (defender._hitCD >= GameTime) return;
    
    if (attacker.exhausted > 0) return;
    if (attacker.hasWeapon === false) return;
    
    // ------------------------------------------------------------
    // DAMAGE CALCULATION
    // ------------------------------------------------------------
    let dmg = Math.round(6 + Math.abs(attacker.vel) * 20);
    
    // ─── POKE ──────────────────────────────────────────────────────
    const _isPoke = (attacker === P && mDown && P.lmbWasDown && (GameTime - (P.lmbHoldStart || -99)) <= 0.18) ||
                    (attacker === D && typeof AI !== 'undefined' && AI._pokeDodgeActive && (GameTime - (D._pokeStartTime || -99)) <= 0.3) ||
                    (attacker === D && typeof AI !== 'undefined' && AI._lungeActive && AI._lungePhase === 'lunge');
    if (_isPoke) dmg = Math.round(dmg * 1.5);
    dmg = Math.max(20, dmg);
    
    // ─── MODIFIERS ────────────────────────────────────────────────
    if (defender === P && mDown) dmg = Math.round(dmg * sv('lmbdmg'));
    if (defender === D && typeof AI !== 'undefined' && AI._fakeMDown) dmg = Math.round(dmg * 1.5);
    if (attacker.rageBuffEnd > GameTime) dmg *= 2;
    if (shieldDef(attacker) && shieldSameSideAsSword(attacker)) dmg = Math.round(dmg * 0.85);
    if (isBot(attacker) && key === 'spear') dmg = Math.round(dmg * 1.5);
    const _defScale = (isBot(defender) ? sv('cscl') * sv('botscale') : sv('cscl')) || 1;
    dmg = Math.round(dmg / _defScale);
    dmg = applyCutSwingPenalty(attacker, dmg);
    
    // ─── MULTIHIT PROTECTION ──────────────────────────────────────
    if (defender === P) {
      const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
      if (botCount > 1) {
        if (GameTime - P._lastHitTime < 2.0) P._hitCount++;
        else P._hitCount = 1;
        P._lastHitTime = GameTime;
        if (P._hitCount > 1) {
          P._multiHitProtection = true;
          P._multiHitProtectionTimer = 2.0;
          P._multiHitProtectionMult = 0.3;
        }
      }
      if (P._multiHitProtection) dmg = Math.round(dmg * P._multiHitProtectionMult);
    }
    
    // ─── HIT EFFECTS ──────────────────────────────────────────────
    defender._hitTiltAmp = (Math.random() < 0.5 ? -1 : 1) * 15 * Math.PI / 180;
    defender._hitTiltT0 = GameTime;
    
    // ─── KNOCKBACK ────────────────────────────────────────────────
    const kbf = sv('bodyKB') * 0.5;
    const _noDoubleKB = (attacker._clashFrame || 0) > GameTime - 0.05;
    if (kbf > 0 && !_noDoubleKB) {
      const _bkX = bC.x - $.POS.body(attacker).x;
      const _bkY = bC.y - $.POS.body(attacker).y;
      const _bkL = Math.hypot(_bkX, _bkY) || 1;
      defender.vx += (_bkX / _bkL) * kbf;
      defender.vy += (_bkY / _bkL) * kbf;
    }
    
    // ─── DISARM ────────────────────────────────────────────────────
    if (!_isPoke && defender.hasWeapon !== false && attacker.hasWeapon !== false) {
      const swingPower = Math.abs(attacker.vel) / sv('swthresh');
      let disarmChance = 0.03 + swingPower * 0.07;
      if (weaponHasFlag(attacker, 'disarm')) disarmChance += 0.15;
      if (attacker.rageBuffEnd > GameTime) disarmChance += 0.10;
      // Disarm chance caps at 30% for unbalanced targets, otherwise 50%
      disarmChance = isUnbalanced(defender) ? 0.30 : Math.min(disarmChance, 0.50) * 0.5;
      
      if (Math.random() < disarmChance) {
        const _dkX = bC.x - $.POS.body(attacker).x;
        const _dkY = bC.y - $.POS.body(attacker).y;
        const _dkL = Math.hypot(_dkX, _dkY) || 1;
        const dirX = _dkX / _dkL;
        const dirY = _dkY / _dkL;
        const randomAngle = (Math.random() - 0.5) * Math.PI * 1.2;
        const cosA = Math.cos(randomAngle);
        const sinA = Math.sin(randomAngle);
        const weaponDirX = dirX * cosA - dirY * sinA;
        const weaponDirY = dirY * cosA + dirX * sinA;
        const baseSpeed = 3 + Math.random() * 4;
        disarmEntity(defender, weaponDirX * baseSpeed, weaponDirY * baseSpeed - 1.5);
        $.FX.hit({ x: bC.x, y: bC.y - 52, t: (window.I18N ? window.I18N.t('combat.weaponDropped') : 'WEAPON DROPPED!'), life: 40, big: true, col: '#ffaa44' });
      }
    }
    
    // ─── EXTRA DISARM (for 'disarm' flag) ────────────────────────
    // This is a separate check for disarm flag, same as above but with 30% chance
    if (!_isPoke && weaponHasFlag(attacker, 'disarm') && defender.hasWeapon !== false && Math.random() < 0.30) {
      const _dkX = bC.x - $.POS.body(attacker).x;
      const _dkY = bC.y - $.POS.body(attacker).y;
      const _dkL = Math.hypot(_dkX, _dkY) || 1;
      const dirX = _dkX / _dkL;
      const dirY = _dkY / _dkL;
      const randomAngle = (Math.random() - 0.5) * Math.PI * 1.44;
      const cosA = Math.cos(randomAngle);
      const sinA = Math.sin(randomAngle);
      const weaponDirX = dirX * cosA - dirY * sinA;
      const weaponDirY = dirY * cosA + dirX * sinA;
      const baseSpeed = 7 + Math.random() * 5;
      disarmEntity(defender, weaponDirX * baseSpeed, weaponDirY * baseSpeed - 1.5);
      $.FX.hit({ x: bC.x, y: bC.y - 52, t: (window.I18N ? window.I18N.t('combat.weaponDropped') : 'WEAPON DROPPED!'), life: 40, big: true, col: '#ffaa44' });
    }
    
    // ------------------------------------------------------------
    // APPLY DAMAGE
    // ------------------------------------------------------------
    $.FX.hit({
      x: bC.x,
      y: bC.y - 60,
      t: '💥 ' + dmg + ' DMG',
      life: 25,
      big: true,
      col: '#ff8844'
    });
    
    applyDamage(defender, dmg, attacker, {
      isMagic: false,
      isExplosion: false,
      knockbackMult: 0,
      hitstopFrames: 4,
      shakePower: dmg > 15 ? 6 : 3,
      textColor: _isPoke ? '#ffdd44' : '#ff8844',
      textSuffix: _isPoke ? '💫' : '⚔',
      bloodCount: _isPoke ? 4 : 6,
      playSound: false
    });
    
    $.S.play('damage');
    
    if (defender.hp <= 0) {
      handleCombatDeath(defender);
    }
    
    if (typeof NET_SYNC !== 'undefined' && $.NET.active() && attacker === P && defender === D) {
      $.NET.send({ type: 'hit', dmg, newHp: defender.hp });
    }
    
    const _otherBot2 = attacker === P ? defender : (defender === P ? attacker : null);
    if (_otherBot2 && isBot(_otherBot2)) switchSmartBot(_otherBot2);
    aiNotifyContact();
    
    return; // Exit, don't double-apply damage
  }
  
  // ============================================================
  // ─── GENERIC BLADE VS BODY (swords, flails, staves, etc.) ───
  // ============================================================
  
  let pivX_adj = pivX;
  let pivY_adj = pivY;
  let tipX_adj = tipX2;
  let tipY_adj = tipY2;
  
  const isCenterGrip = key !== 'bow' && key !== 'crossbow' &&
    CENTER_GRIP_CATEGORIES.includes(weaponDefFor(attacker).category);
  
  if (isCenterGrip) {
    const _backLen = weaponReach(attacker) * sv('swlen') * (isBot(attacker) ? sv('botswordscale') : 1);
    const _dirX = Math.cos(attacker.angle);
    const _dirY = Math.sin(attacker.angle);
    pivX_adj = pivX - _dirX * _backLen;
    pivY_adj = pivY - _dirY * _backLen;
  }
  
  const segDX = tipX_adj - pivX_adj;
  const segDY = tipY_adj - pivY_adj;
  const segL2 = segDX * segDX + segDY * segDY || 1;
  
  const t2 = $.M.clamp(((bC.x - pivX_adj) * segDX + (bC.y - pivY_adj) * segDY) / segL2, 0, 1);
  const nearX = pivX_adj + t2 * segDX;
  const nearY = pivY_adj + t2 * segDY;
  const dist = Math.hypot(bC.x - nearX, bC.y - nearY);
  const hand = $.POS.pivot(attacker);
  if(Math.hypot(nearX - hand.x, nearY - hand.y) < HANDRANGE) return;
  
  const BODY_HIT_R = 14;
  const hitR = BODY_HIT_R * sv('cscl');
  if (dist >= hitR) return;
  
  // ─── BOT DODGE ──────────────────────────────────────────────────
if (defender === D && attacker === P && typeof AI !== 'undefined' && AI.enabled !== false &&
    !(typeof NET_SYNC !== 'undefined' && $.NET.active()) &&
    !(AI._botDodgeCooldown > 0) && D.stamina >= D.stamMax * 0.5 &&
    !isUnbalanced(defender)) { 

    const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
    const scaledChancePct = Math.max(20, 100 - botCount * 10);
    const playerRageDodgeMult = (P.rageBuffEnd || 0) - GameTime > 1 ? 0.5 : 1;
    const finalChance = Math.min(sv('botdodgechance'), scaledChancePct) / 100 * playerRageDodgeMult;

    if (Math.random() < finalChance) {
      AI._botDodgeCooldown = 1.5;
      AI._dodgeLockUntil = GameTime + 0.35;
      let awayX = D.x - P.x,
          awayY = D.y - P.y;
      const canDodgeToward = Math.hypot(D.x - P.x, D.y - P.y) >= 400;
      if (canDodgeToward && Math.random() < (sv('botdodgetoward') / 100)) {
        awayX = -awayX; awayY = -awayY;
      }
      const awayLen = Math.hypot(awayX, awayY) || 1;
      D._dvx = (awayX / awayLen) * 8;
      D._dvy = (awayY / awayLen) * 8;
      D._hitCD = GameTime + 0.35;
      if (typeof spawnDust === 'function')
        for (let i = 0; i < 8; i++) spawnDust(D.x, D.y, -awayX / awayLen * 8, -awayY / awayLen * 8);
      $.FX.hit({ x: D.x, y: D.y - 30, t: (window.I18N ? window.I18N.t('common.dodge') : 'DODGE'), life: 35, big: false, col: 'rgba(200,200,200,0.6)' });
      $.S.play('dodgeSound');
      return;
    }
  }
  
  // ─── SHIELD BLOCK ──────────────────────────────────────────────
  if (defender._hitCD === undefined) defender._hitCD = -1;
  if (defender._hitCD < GameTime) {
    if (shieldDef(defender) && !isShieldSuppressed(defender)) {
      const _shSc = shieldCenter(defender, attacker === P ? mX : (typeof P !== 'undefined' ? P.x : W / 2));
      if (_shSc) {
        const _shW2 = defender._shieldW || 20,
              _shH2 = defender._shieldH || 30;
        const _shL = _shSc.x - _shW2 / 2,
              _shR = _shSc.x + _shW2 / 2;
        const _shT = _shSc.y - _shH2 / 2,
              _shB = _shSc.y + _shH2 / 2;
        if (nearX >= _shL && nearX <= _shR && nearY >= _shT && nearY <= _shB) {
          const _mx2 = (bC.x + nearX) / 2,
                _my2 = (bC.y + nearY) / 2;
          const lmbActive = (defender === P) ? mDown : false;
          if (!lmbActive && (defender._shieldAlpha || 1) > 0.4) {
            applyShieldBlockFX(_mx2, _my2, attacker, defender);
            const _bvx = (nearX - bC.x),
                  _bvy = (nearY - bC.y),
                  _bl = Math.hypot(_bvx, _bvy) || 1;
            attacker.vx -= _bvx / _bl * 3;
            attacker.vy -= _bvy / _bl * 3;
            const blockCost = blockStaminaCost(attacker);
            drainStamina(attacker, blockCost);
            if(attacker.stamina <= 0 && !isExhausted(attacker)){
              applyExhaust(attacker);
            }
            
            if (weaponHasFlag(attacker, 'knockback_hammer')) {
              defender.vx -= _bvx / _bl * 18;
              defender.vy -= _bvy / _bl * 18;
              defender.unbalanced = Math.max(defender.unbalanced, 0.8);
            }
            if (weaponHasFlag(attacker, 'knockback_staff')) {
              defender.vx -= _bvx / _bl * 8;
              defender.vy -= _bvy / _bl * 8;
              defender.unbalanced = Math.max(defender.unbalanced, 0.4);
            }
            defender._hitCD = GameTime + 0.3;
            return;
          }
        }
      }
    }
    
    // ─── ALONG BLADE CHECK ──────────────────────────────────────
    let nx2, ny2;
    if (dist > 0.1) {
      nx2 = (bC.x - nearX) / dist;
      ny2 = (bC.y - nearY) / dist;
    } else {
      nx2 = -Math.sin(attacker.angle);
      ny2 = Math.cos(attacker.angle);
    }
    const bladeX = Math.cos(attacker.angle),
          bladeY = Math.sin(attacker.angle);
    let alongBlade = Math.abs(nx2 * bladeX + ny2 * bladeY);
    if (CENTER_GRIP_CATEGORIES.includes(weaponDefFor(attacker).category)) alongBlade = 0;
    
    // ─── POKE DETECTION ──────────────────────────────────────────
    const _isPoke = key !== 'flail' && (
      (attacker === P && mDown && P.lmbWasDown && (GameTime - (P.lmbHoldStart || -99)) <= 0.18) ||
      (attacker === D && typeof AI !== 'undefined' && AI._pokeDodgeActive && (GameTime - (D._pokeStartTime || -99)) <= 0.3) ||
      (attacker === D && typeof AI !== 'undefined' && AI._lungeActive && AI._lungePhase === 'lunge')
    ) && Math.abs(attacker.vel) < sv('swthresh') * 0.3;
    
    // ─── TIP-ONLY WEAPONS ────────────────────────────────────────
    const _tipOnly = weaponCollisionType(attacker) === 'tip';
    const TIP_MIN_T = 0.7;
    let shouldHit = (!_tipOnly || t2 >= TIP_MIN_T);
    
    let finalCondition = (alongBlade < 0.8 || _isPoke) && shouldHit;
    
    if (finalCondition) {
      if (attacker.exhausted > 0) return;
      if (attacker.hasWeapon === false) return;
      
      const VEL_DMG_MULT = 30;
      let dmg = (_isPoke) ? Math.round(sv('swthresh') * VEL_DMG_MULT + 3) : Math.round(Math.abs(attacker.vel) * VEL_DMG_MULT + 3);
      
      if (key === 'flail') dmg = Math.round(dmg / 6);
      
      const _pierceTierMult = _isPoke ? 1.0 : 0.5;
      dmg = Math.round(dmg * (_isPoke ? weaponPierceMult(attacker) * _pierceTierMult : weaponCutMult(attacker)));
      dmg = Math.max(20, dmg);
      
      // ─── MODIFIERS ──────────────────────────────────────────────
      if (defender === P && mDown) dmg = Math.round(dmg * sv('lmbdmg'));
      if (defender === D && typeof AI !== 'undefined' && AI._fakeMDown) dmg = Math.round(dmg * 1.5);
      if (attacker.rageBuffEnd > GameTime) dmg *= 2;
      if (shieldDef(attacker) && shieldSameSideAsSword(attacker)) dmg = Math.round(dmg * 0.85);
      if (isBot(attacker) && (key === 'spear' || key === 'staff')) dmg = Math.round(dmg * 1.5);
      const _defScale = (isBot(defender) ? sv('cscl') * sv('botscale') : sv('cscl')) || 1;
      dmg = Math.round(dmg / _defScale);
      dmg = applyCutSwingPenalty(attacker, dmg);
      
      // ─── MULTIHIT PROTECTION ──────────────────────────────────
      if (defender === P) {
        const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
        if (botCount > 1) {
          if (GameTime - P._lastHitTime < 2.0) P._hitCount++;
          else P._hitCount = 1;
          P._lastHitTime = GameTime;
          if (P._hitCount > 1) {
            P._multiHitProtection = true;
            P._multiHitProtectionTimer = 2.0;
            P._multiHitProtectionMult = 0.3;
          }
        }
        if (P._multiHitProtection) dmg = Math.round(dmg * P._multiHitProtectionMult);
      }
      
      defender._hitTiltAmp = (nx2 < 0 ? -1 : 1) * 15 * Math.PI / 180;
      defender._hitTiltT0 = GameTime;
      
      // ─── KNOCKBACK ──────────────────────────────────────────────
      const kbf = sv('bodyKB') * 0.5;
      const _noDoubleKB = (attacker._clashFrame || 0) > GameTime - 0.05;
      if (kbf > 0 && !_noDoubleKB) {
        const _bkX = bC.x - $.POS.body(attacker).x;
        const _bkY = bC.y - $.POS.body(attacker).y;
        const _bkL = Math.hypot(_bkX, _bkY) || 1;
        defender.vx += (_bkX / _bkL) * kbf;
        defender.vy += (_bkY / _bkL) * kbf;
      }
      
      // ─── DISARM ──────────────────────────────────────────────────
      if (!_isPoke && defender.hasWeapon !== false && attacker.hasWeapon !== false) {
        const swingPower = Math.abs(attacker.vel) / sv('swthresh');
        let disarmChance = 0.03 + swingPower * 0.07;
        if (weaponHasFlag(attacker, 'disarm')) disarmChance += 0.15;
        if (attacker.rageBuffEnd > GameTime) disarmChance += 0.10;
        // Disarm chance caps at 30% for unbalanced targets, otherwise 50%
        disarmChance = isUnbalanced(defender) ? 0.30 : Math.min(disarmChance, 0.50) * 0.5;
        
        if (Math.random() < disarmChance) {
          const _dkX = bC.x - $.POS.body(attacker).x;
          const _dkY = bC.y - $.POS.body(attacker).y;
          const _dkL = Math.hypot(_dkX, _dkY) || 1;
          const dirX = _dkX / _dkL;
          const dirY = _dkY / _dkL;
          const randomAngle = (Math.random() - 0.5) * Math.PI * 1.2;
          const cosA = Math.cos(randomAngle);
          const sinA = Math.sin(randomAngle);
          const weaponDirX = dirX * cosA - dirY * sinA;
          const weaponDirY = dirY * cosA + dirX * sinA;
          const baseSpeed = 3 + Math.random() * 4;
          disarmEntity(defender, weaponDirX * baseSpeed, weaponDirY * baseSpeed - 1.5);
          $.FX.hit({ x: bC.x, y: bC.y - 52, t: (window.I18N ? window.I18N.t('combat.weaponDropped') : 'WEAPON DROPPED!'), life: 40, big: true, col: '#ffaa44' });
        }
      }
      
      // ─── EXTRA DISARM (for 'disarm' flag) ──────────────────────
      if (!_isPoke && weaponHasFlag(attacker, 'disarm') && defender.hasWeapon !== false && Math.random() < 0.30) {
        const _dkX = bC.x - $.POS.body(attacker).x;
        const _dkY = bC.y - $.POS.body(attacker).y;
        const _dkL = Math.hypot(_dkX, _dkY) || 1;
        const dirX = _dkX / _dkL;
        const dirY = _dkY / _dkL;
        const randomAngle = (Math.random() - 0.5) * Math.PI * 1.44;
        const cosA = Math.cos(randomAngle);
        const sinA = Math.sin(randomAngle);
        const weaponDirX = dirX * cosA - dirY * sinA;
        const weaponDirY = dirY * cosA + dirX * sinA;
        const baseSpeed = 7 + Math.random() * 5;
        disarmEntity(defender, weaponDirX * baseSpeed, weaponDirY * baseSpeed - 1.5);
        $.FX.hit({ x: bC.x, y: bC.y - 52, t: (window.I18N ? window.I18N.t('combat.weaponDropped') : 'WEAPON DROPPED!'), life: 40, big: true, col: '#ffaa44' });
      }
      
      // ─── SPECIAL KNOCKBACK ──────────────────────────────────────
      if (weaponHasFlag(attacker, 'knockback_hammer')) {
        const _kkX = bC.x - $.POS.body(attacker).x;
        const _kkY = bC.y - $.POS.body(attacker).y;
        const _kkL = Math.hypot(_kkX, _kkY) || 1;
        defender.vx += (_kkX / _kkL) * 18;
        defender.vy += (_kkY / _kkL) * 18;
        if(!isUnbalanced(defender)) applyDisbalance(defender, attacker);
      }
      if (weaponHasFlag(attacker, 'knockback_staff')) {
        const _kkX = bC.x - $.POS.body(attacker).x;
        const _kkY = bC.y - $.POS.body(attacker).y;
        const _kkL = Math.hypot(_kkX, _kkY) || 1;
        defender.vx += (_kkX / _kkL) * 10;
        defender.vy += (_kkY / _kkL) * 10;
        if(!isUnbalanced(defender)) applyDisbalance(defender, attacker);
      }
      
      // ─── APPLY DAMAGE ────────────────────────────────────────────
      const isPoke = _isPoke;
      applyDamage(defender, dmg, attacker, {
        isMagic: false,
        isExplosion: false,
        knockbackMult: 0,
        hitstopFrames: 4,
        shakePower: dmg > 15 ? 6 : 3,
        textColor: isPoke ? '#ffdd44' : '#ff4040',
        textSuffix: isPoke ? '💫' : '',
        bloodCount: isPoke ? 4 : 8,
        playSound: false
      });
      
      if (_isPoke) {
        $.FX.hit({ x: bC.x, y: bC.y - 36, t: (window.I18N ? window.I18N.t('combat.poke') : 'POKE!'), life: 40, big: true, col: '#ffdd44' });
      }
      
      $.S.play(isHeavySwingWeapon(attacker) ? 'damageHammer' : 'damage');
      
      if (typeof NET_SYNC !== 'undefined' && $.NET.active() && attacker === P && defender === D) {
        $.NET.send({ type: 'hit', dmg, newHp: defender.hp });
      }
      
      const _otherBot2 = attacker === P ? defender : (defender === P ? attacker : null);
      if (_otherBot2 && isBot(_otherBot2)) switchSmartBot(_otherBot2);
      aiNotifyContact();
    }
  }
}






// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••• END MODULE: MATH HELPERS ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••

// ─────────────────────────────────────────────────────────────────────────────────
// ─── SHIELD BLOCK EFFECT ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────
// Called for "shield block" events: visual + sound + hitstop + counter window.
// Previously this was scattered across 4 places: checkBladeVsBody, checkShieldVsBlade, projectile deflection,
// and shield bash. Now unified in one function.
function applyShieldBlockFX(x, y, attacker, defender, opts){
  opts = opts || {};
  const hitstopMag = opts.hitstopMag != null ? opts.hitstopMag : 2;
  const waveDuration = opts.waveDuration != null ? opts.waveDuration : 18;
  $.FX.hit({x, y: y-4, t:'🛡', life:16, big:true, col:'#aaddff'});
  $.FX.hit({x, y: y+14, t:(window.I18N ? window.I18N.t('combat.block') : 'BLOCK!'), life:opts.textLife||30, big:false, col:'#88bbcc'});
  $.S.play('shieldblock');
  if(typeof triggerHitstop === 'function') triggerHitstop(hitstopMag, hitstopMag);
  openSafeCounterWindow(defender);
  if(typeof FactionRules!=='undefined') FactionRules.contact(attacker,defender);
  if(attacker) attacker._healthBarUntil = GameTime + 3;
  if(defender) defender._healthBarUntil = GameTime + 3;
  
  const ang = opts.waveAngle != null ? opts.waveAngle
    : (attacker && defender) ? Math.atan2(attacker.y - defender.y, attacker.x - defender.x)
    : 0;
  FX_EFFECTS.push({type:'shieldwave', x, y, t:0, duration:waveDuration, angle:ang, followEntity:null});
  
  // ─── EXTRA EFFECTS ──────────────────────────────────────────────
  // (could add more visual effects here later)
}

// ─── CLASH RAGE GAIN ──────────────────────────────────────────────────
// 100/sv('rageper')*0.5 per clash, capped at 3 hits.
function clashRageGain(){ return 100/sv('rageper') * 0.5; }
function addRage(ent, amount){ if(ent) ent.rage = Math.min(100, (ent.rage||0) + amount); }

// ─── DEBUFF SYSTEM ─────────────────────────────────────────────────────
// Unified debuff application (exhaust, stun, etc.)
function applyDebuff(ent, type, duration, intensity) {
    // type: 'exhaust' | 'stun'
    // duration: duration in seconds
    // intensity: 0-1 (effect strength)
    
    if (!ent) return;
    
    // Clear existing debuffs of the same type
    if (ent._debuffType === type) {
        // Extend
    }
    
    ent._debuffType = type;
    ent._debuffUntil = GameTime + duration;
    ent._debuffIntensity = intensity || 1.0;
    ent._debuffActive = true;
    
    // Also set exhausted flag for compatibility
    if (type === 'exhaust') {
        ent.exhausted = duration;
        applyExhaust(ent, duration);
    }
    
    // Visual feedback
    const labels = {
        'exhaust': '⚠ EXHAUSTED',
        'stun': '⚡ STUNNED'
    };
    const colors = {
        'exhaust': '#ffaa44',
        'stun': '#cc44ff'
    };
    
    const c = $.POS.body(ent);
    $.FX.hit({
        x: c.x, 
        y: c.y - 50, 
        t: labels[type] || '⚠ DEBUFF',
        life: 45, 
        big: true, 
        col: colors[type] || '#ff8844'
    });
}
// ─── GET DEBUFF SWORD MULTIPLIER ──────────────────────────────────
function getDebuffSwordMult(ent) {
    if (!ent || !ent._debuffActive || (ent._debuffUntil || 0) < GameTime) {
        // Debuff expired
        if (ent._debuffActive) {
            ent._debuffActive = false;
            ent._debuffType = null;
        }
        return 1.0;
    }
    
    const type = ent._debuffType;
    const intensity = ent._debuffIntensity || 1.0;
    
    switch(type) {
        case 'exhaust':
            // Exhaustion - reduced sword speed
            return sv('exhswd2') * (1 - intensity * 0.3);
        case 'stun':
            // Stun - almost no sword movement
            return 0.01;
        default:
            return 1.0;
    }
}

// ─── GET DEBUFF ALPHA ──────────────────────────────────────────────────
function getDebuffAlpha(ent) {
    if (isWeaponDisabled(ent)) return 0.3;
    if (!ent || !ent._debuffActive || (ent._debuffUntil || 0) < GameTime) {
        if (ent._debuffActive) {
            ent._debuffActive = false;
            ent._debuffType = null;
        }
        return 1.0;
    }
    
    const type = ent._debuffType;
    const intensity = ent._debuffIntensity || 1.0;
    
    switch(type) {
        case 'exhaust':
            return 0.45 + (1 - intensity) * 0.3;
        case 'stun':
            return 0.3;
        default:
            return 1.0;
    }
}

// ─── GET DEBUFF TEXT FOR HUD ──────────────────────────────────────────
function getDebuffText(ent) {
    if (!ent || !ent._debuffActive || (ent._debuffUntil || 0) < GameTime) {
        if (ent._debuffActive) {
            ent._debuffActive = false;
            ent._debuffType = null;
        }
        return '';
    }
    
    const type = ent._debuffType;
    const remaining = Math.ceil((ent._debuffUntil - GameTime) * 10) / 10;
    
    switch(type) {
        case 'exhaust':
            return '⚠ EXHAUSTED ' + remaining.toFixed(1) + 's';
        case 'stun':
            return '⚡ STUNNED ' + remaining.toFixed(1) + 's';
        default:
            return '';
    }
}
// ─── SWORD STYLES ──────────────────────────────────────────────────────
// Style presets: dist, ex, ey, blk, adaXb, adaXp, adaY, adaD, ada12, adaX
const SWORD_STYLES = [
  { name:'Classic', dist:19, ex:21, ey:44, blk:0.2,  adaXb:40, adaXp:73, adaY:true, adaD:true,  ada12:false, adaX:false },
  { name:'Fencer', dist:9, ex:37, ey:40, blk:0.17, adaXb:0, adaXp:6, adaY:true, adaD:false, ada12:false, adaX:true },
];
window.SWORD_STYLE_IDX = 0;

// ─── APPLY SWORD STYLE ──────────────────────────────────────────────
window.applySwordStyle = function(idx){
  const st = SWORD_STYLES[idx]; if(!st) return;
  window.SWORD_STYLE_IDX = idx;
  [['dist',st.dist],['ex',st.ex],['ey',st.ey],['blk',st.blk],['adaXb',st.adaXb],['adaXp',st.adaXp]].forEach(([id,v])=>{
    const el=document.getElementById('sl-'+id);
    // bubbles:true ensures sv()/_slCache updates via event listener on document
    // (see event binding in main), so it reflects immediately in sv('dist') etc.
    if(el){ el.value=v; el.dispatchEvent(new Event('input', {bubbles:true})); }
  });
  [['adaY',st.adaY],['adaD',st.adaD],['ada12',st.ada12],['adaX',st.adaX]].forEach(([id,v])=>{
    const cbEl=document.getElementById('cb-'+id);
    if(cbEl && cbEl.checked!==v){ cbEl.checked=v; cbEl.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  if(typeof hitFX!=='undefined'&&typeof P!=='undefined')
    $.FX.hit({x:P.x,y:P.y-45,t:(window.I18N ? window.I18N.t('combat.style',{name:st.name}) : ('STYLE: '+st.name)),life:55,big:false,col:'#9ad0f0'});
};
window.toggleSwordStyle = function(){
  window.applySwordStyle((window.SWORD_STYLE_IDX+1)%SWORD_STYLES.length);
};

// ─── STYLE HELPERS ────────────────────────────────────────────────────
// Shortcuts for style values (with AI overrides)
function dstyle(id){
  const s = (typeof AI!=='undefined') && AI._styleVals;
  return (s && s[id]!==undefined) ? s[id]*sv('cscl') : csv(id);
}
function dblk(){
  const s = (typeof AI!=='undefined') && AI._styleVals;
  return (s && s.blk!==undefined) ? s.blk : sv('blk');
}
function dstyleCb(id){
  const s = (typeof AI!=='undefined') && AI._styleVals;
  if(s && s[id]!==undefined) return s[id];
  return cb(id);
}

// ─── RESET PLAYER STATE ──────────────────────────────────────────────
// ─── RESET / RESTART ──────────────────────────────────────────────────
function resetPlayerState() {
    // Clear dropped weapons
    if (typeof DROPPED_WEAPONS !== 'undefined') {
        DROPPED_WEAPONS.length = 0;
    }
    if (typeof PROJECTILES !== 'undefined') {
        PROJECTILES.length = 0;
    }
    
    // Clear visual effects
    if (typeof WAND_PARTICLES !== 'undefined') WAND_PARTICLES.length = 0;
    if (typeof WAND_EXPLOSIONS !== 'undefined') WAND_EXPLOSIONS.length = 0;
    if (typeof MAGICSTAFF_CHARGE_FX !== 'undefined') MAGICSTAFF_CHARGE_FX.length = 0;
    if (typeof MAGICSTAFF_LIGHTNING_FX !== 'undefined') MAGICSTAFF_LIGHTNING_FX.length = 0;
    if (typeof MAGICSTAFF_GLOW_FX !== 'undefined') MAGICSTAFF_GLOW_FX.length = 0;
    if (typeof LIGHTNING_HIT_FX !== 'undefined') LIGHTNING_HIT_FX.length = 0;
    if (typeof BOW_TENSION_FX !== 'undefined') BOW_TENSION_FX.length = 0;
    if (typeof ARROW_SHATTER_FX !== 'undefined') ARROW_SHATTER_FX.length = 0;
    
    // Reset player P
    P.hp = 100;
    P.stamina = P.stamMax || 100;
    P.rage = 0;
    P.exhausted = 0;
    P.unbalanced = 0;
    P.vx = 0;
    P.vy = 0;
    P.vel = 0;
    P._swingBlockCD = -1;
    P._exhaustedEndTime = 0;
    P._staminaRegenBoostUntil = 0;
    P._hitCD = -1;
    P._blockSlow = -1;
    P._rageTextShown = false;
    
    // Reset shield-related timers
    P._shieldStunUntil = -1;
    P._shieldBodyHitCD = -1;
    P._dodgeActiveUntil = -1;
    P._moveLockUntil = -1;
    P._noSlowUntil = -1;
    P._swingBlockCD = -1;
    P._clashFrame = -1;
    P._inAutoBlock = false;
    P._inABang = 0;
    P._abTilt = 0;
    
    // Reset recovery state
    P._wasExhausted = false;
    P._recovering = false;
    P._recoverProgress = 0;
    P._recoverStartAngle = 0;
    P._recoverTargetAngle = 0;
    P._recoverDuration = 1.0;
    
    // Reset debuffs
    P._debuffActive = false;
    P._debuffType = null;
    P._debuffUntil = -1;
    P._debuffIntensity = 0;
    
    // ─── RESET CHARGE STATES ──────────────────────────────────────
    if (P._wandCharging) {
        P._wandCharging = false;
        if (P._wandChargeSoundObj) {
            try { P._wandChargeSoundObj.pause(); } catch(e) {}
            P._wandChargeSoundObj = null;
        }
    }
    if (P._magicCharging) {
        P._magicCharging = false;
        if (P._magicChargeSoundObj) {
            try { P._magicChargeSoundObj.pause(); } catch(e) {}
            P._magicChargeSoundObj = null;
        }
        if (typeof clearMagicStaffFX === 'function') clearMagicStaffFX(P);
    }
    if (P._bowCharging) {
        P._bowCharging = false;
        if (P._bowTensionSound) {
            try { P._bowTensionSound.pause(); } catch(e) {}
            P._bowTensionSound = null;
        }
        if (typeof clearBowTensionFX === 'function') clearBowTensionFX();
    }
    
    // ─── RESET WEAPON ─────────────────────────────────────────────
    if (P.hasWeapon === false && typeof setWeapon === 'function') {
        setWeapon(P, P.weaponType || 0);
    }
    
    // ─── RESET SHIELD (but keep its type) ────────────────────────
    // P.shield = 0;
    // P._shieldFlipped = false;
    
    // ─── RESET POSITION ────────────────────────────────────────────
    P.x = W * 0.15;
    P.y = H * 0.8;
}

function clearEntityChargeState(ent) {
    if (!ent) return;
    if (ent._wandCharging) {
        ent._wandCharging = false;
        if (ent._wandChargeSoundObj) {
            try { ent._wandChargeSoundObj.pause(); } catch(e) {}
            ent._wandChargeSoundObj = null;
        }
    }
    if (ent._magicCharging) {
        ent._magicCharging = false;
        if (ent._magicChargeSoundObj) {
            try { ent._magicChargeSoundObj.pause(); } catch(e) {}
            ent._magicChargeSoundObj = null;
        }
        if (typeof clearMagicStaffFX === 'function') clearMagicStaffFX(ent);
    }
    if (ent._bowCharging) {
        ent._bowCharging = false;
        if (ent._bowTensionSound) {
            try { ent._bowTensionSound.pause(); } catch(e) {}
            ent._bowTensionSound = null;
        }
        if (ent === P && typeof clearBowTensionFX === 'function') clearBowTensionFX();
    }
}

function resetBotRoundState(bot, index, totalBots, enableAI) {
    if (!bot) return;
    clearEntityChargeState(bot);
    bot.hp = 100;
    bot.stamina = 100;
    bot.rage = 0;
    bot.rageBuffEnd = -1;
    bot._hadExhaustion = false;
    bot.exhausted = 0;
    bot.unbalanced = 0;
    bot.vx = 0;
    bot.vy = 0;
    bot.vel = 0;
    bot._hitCD = -1;
    bot._swingBlockCD = -1;
    bot._blockSlow = -1;
    bot._debuffActive = false;
    bot._debuffType = null;
    bot._debuffUntil = -1;
    bot._debuffIntensity = 0;
    bot._wasExhausted = false;
    bot._recovering = false;
    bot._recoverProgress = 0;
    bot._defeated = false;
    if (bot.hasWeapon === false && typeof setWeapon === 'function') setWeapon(bot, bot.weaponType);
    const ang = totalBots > 0 ? (index / totalBots) * Math.PI * 2 : 0;
    const bx = $.M.clamp(W / 2 + 110 + Math.cos(ang) * 140, 60, W - 100);
    const by = $.M.clamp(H / 2 + Math.sin(ang) * 140, 60, H - 60);
    if (typeof assignRandomSkin === 'function') assignRandomSkin(bot);
    if (typeof placeBotPendingReveal === 'function') placeBotPendingReveal(bot, bx, by);
    else { bot.x = bx; bot.y = by; }
    if (bot._aiState) {
        bot._aiState.enabled = enableAI;
        bot._aiState._fakeMDown = false;
    }
}

function setBotAiEnabled(enabled) {
    for (const bot of ALL_BOTS) {
        if (bot && bot._aiState) bot._aiState.enabled = enabled;
    }
    if (AI) AI.enabled = enabled;
    const toggleBtn = document.getElementById('dtoggle');
    if (toggleBtn) {
        toggleBtn.textContent = window.I18N ? window.I18N.buttonText('dtoggle', enabled ? 'on' : 'pause') : (enabled ? 'ON' : 'PAUSE');
        toggleBtn.classList.toggle('on', enabled);
    }
}

window.restartCombatRound = function(options = {}) {
    const {
        resetScore = false,
        keepPlayerSide = false,
        playerWon = false,
        enableAI = true
    } = options;
    if (resetScore && typeof resetWins === 'function') resetWins();
    resetPlayerState();
    if (keepPlayerSide) {
        P.x = playerWon ? W * 0.15 : W * 0.82;
        P.y = H * 0.6;
    }
    if (dummyOn && typeof applyBotCount === 'function') applyBotCount();
    if (dummyOn) {
        ALL_BOTS.forEach((bot, index) => resetBotRoundState(bot, index, ALL_BOTS.length, enableAI));
        if (ALL_BOTS.length > 0) {
            const preferredMain = ALL_BOTS.find(bot => !bot._manualControl) || ALL_BOTS[0];
            for (const bot of ALL_BOTS) {
                if (!bot || !bot._aiState) continue;
                bot._aiState._isMain = bot === preferredMain;
                bot._aiState._mode = bot === preferredMain ? 'attack' : 'defence';
                bot._aiState._phase = bot === preferredMain ? 'attack' : 'defence';
            }
            D = preferredMain;
            AI = preferredMain._aiState;
        }
    }
    DEATH.dDead = false;
    DEATH.pDead = false;
    DEATH.fadeIn = false;
    DEATH.fadeAlpha = 0;
    DEATH.text = '';
    DEATH.textCol = '#fff';
    document.body.classList.remove('menu-open');
    if (typeof window._setUiMenuPaused === 'function') window._setUiMenuPaused(false);
    if (typeof gamePaused !== 'undefined') gamePaused = false;
    setBotAiEnabled(enableAI);
};



const DEATH = { pDead: false, dDead: false, deathCross: [], fadeAlpha: 0, fadeIn: false, text: '', textCol: '#fff' };

// ─── DEATH HANDLER ──────────────────────────────────────────────────
// Called when a character's HP reaches 0. Handles bot removal, victory/defeat logic.
function handleCombatDeath(ent){
  if(typeof FactionRules!=='undefined' && FactionRules.handleDeath(ent)) return;
  if(ent === P){ triggerDeath(P, false); return; }
  if(!isBot(ent)) return;
  if(typeof disarmEntity === 'function' && ent.hasWeapon !== false) disarmEntity(ent);
  ent._defeated = true;
  const entIndex = ALL_BOTS.indexOf(ent);
  if(entIndex !== -1) ALL_BOTS.splice(entIndex, 1);
  const aliveOthers = ALL_BOTS.filter(b=>b!==ent && b.hp>0);
  if(aliveOthers.length > 0){
    const bc = $.POS.body(ent);
    for(let i=0;i<8;i++) spawnBlood(bc.x, bc.y, Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4));
    DEATH.deathCross.push({x:bc.x, y:bc.y, timer:2.0, isBot:true});
    $.S.play('death');
    if(ent === D){
      // "Main" bot died — transfer crown to the nearest alive
      const pC = $.POS.body(P);
      let best=null, bestDist=Infinity;
      for(const b of aliveOthers){
        const bcc = $.POS.body(b);
        const dd = Math.hypot(bcc.x-pC.x, bcc.y-pC.y);
        if(dd < bestDist){ bestDist = dd; best = b; }
      }
      if(best) switchSmartBot(best);
    }
  } else {
    triggerDeath(ent, true); // Last bot — trigger victory
  }
}
function triggerDeath(ent, isBot){
  if(isBot && DEATH.dDead) return;
  if(!isBot && DEATH.pDead) return;
  const bc = $.POS.body(ent);
  for(let i=0;i<8;i++) spawnBlood(bc.x, bc.y, Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4));
  DEATH.deathCross.push({x:bc.x, y:bc.y, timer:2.0, isBot});
  DEATH.fadeAlpha = 0;
  DEATH.fadeIn = true;
  if(typeof NET_SYNC!=='undefined'&&$.NET.active()) $.NET.send({type:'freeze'});
  $.S.play('death');

  const pvpActive = typeof NET_SYNC!=='undefined' && $.NET.active();

  const localReset = (iWon)=>{
    window.restartCombatRound({
      keepPlayerSide: pvpActive,
      playerWon: iWon,
      enableAI: !pvpActive
    });
    return;
  };

  if(isBot){
    DEATH.dDead = true;
    // ─── ИЗМЕНЕНО ──────────────────────────────────────────────
    DEATH.text = I18N.t('combat.victory'); 
    DEATH.textCol = '#ffdd44';
    $.S.play('whooshRage');
    $.S.play('victory');
    if(typeof addWin==='function' && !(typeof NET_SYNC!=='undefined'&&$.NET.active())) addWin(false);
    setTimeout(()=>{
      localReset(true);
      if(pvpActive) NET_SYNC.sendReset(true);
    }, 2000);
  } else {
    DEATH.pDead = true;
    // ─── ИЗМЕНЕНО ──────────────────────────────────────────────
    DEATH.text = I18N.t('combat.defeat');
    DEATH.textCol = '#ff6060';
    if(typeof addWin==='function' && !(typeof NET_SYNC!=='undefined'&&$.NET.active())) addWin(true);
    if(pvpActive){
      setTimeout(()=>{
        if(DEATH.pDead){
          localReset(false);
          NET_SYNC.sendReset(false);
        }
      }, 3500);
    } else {
      setTimeout(()=>{ localReset(false); }, 2000);
    }
  }
}

function drawDeathCrosses(){
  // ─── DRAW DEATH CROSSES + FADE ──────────────────────────────────────
  if(DEATH.fadeIn || DEATH.fadeAlpha > 0){
    if(DEATH.fadeIn) DEATH.fadeAlpha = Math.min(0.78, DEATH.fadeAlpha + 0.022);
    else DEATH.fadeAlpha = Math.max(0, DEATH.fadeAlpha - 0.03);
    ctx.fillStyle = `rgba(0,0,0,${DEATH.fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);
    // ─── VICTORY/DEFEAT TEXT ──────────────────────────────────────
    if(DEATH.text && DEATH.fadeAlpha > 0.3){
      const textAlpha = Math.min(1, (DEATH.fadeAlpha-0.3)/0.4);
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.font = 'bold 72px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = DEATH.textCol;
      ctx.shadowBlur = 30;
      ctx.fillStyle = DEATH.textCol;
      ctx.fillText(DEATH.text, W/2, H/2);
      ctx.restore();
    }
  }
  for(const dc of DEATH.deathCross){
    ctx.save();
    ctx.globalAlpha = Math.min(1, dc.timer/2.0);
    ctx.strokeStyle='#cc2020'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(dc.x-12,dc.y-12); ctx.lineTo(dc.x+12,dc.y+12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dc.x+12,dc.y-12); ctx.lineTo(dc.x-12,dc.y+12); ctx.stroke();
    ctx.restore();
  }
}

// ─── BLOCK KNOCKBACK ──────────────────────────────────────────────────
// Global flag for block knockback (used in doClash)
let blockKnockOn = false;

// ─── CLASH HANDLER ────────────────────────────────────────────────────
// Called when two weapons collide: deflects defender's blade, pushes both apart, plays effects.
function doClash(entA, entB, res, strongSwing){
  const ang = Math.atan2(entB.y - entA.y, entB.x - entA.x);
  // Determine attacker/defender based on atkPts (who is more aggressive)
  const atkr = entA.isAttacker ? entA : entB;
  const defr = entA.isAttacker ? entB : entA;
  // Deflection: 5-30° depending on attacker's velocity (scaled by deflectMin/deflectMax)
  const atkForce = Math.abs(atkr.vel);
  const deflectDeg = Math.min(getDynamicDeflectMax(), sv('deflectMin') + atkForce * 20);
  const deflectRad = deflectDeg * Math.PI / 180;

  // ─── DEFLECTION DIRECTION ──────────────────────────────────────
  // Use the impact point (res.px/res.py) relative to defender's pivot to determine
  // which side of the blade the hit landed on — not the global angle.
  const defDirX = Math.cos(defr.angle), defDirY = Math.sin(defr.angle);
  const pivDefr = $.POS.pivot(defr);
  let hitX, hitY;
  
   // ─── "NO SLOW" FLAG ──────────────────────────────────────────
    if (entA === P || entB === P) {
        P._noSlowUntil = GameTime + 1.0;
    }
  if(res && res.px !== undefined){
    hitX = (atkr === entA) ? res.px : res.qx;
    hitY = (atkr === entA) ? res.py : res.qy;
  } else if(res){
    hitX = res.mx; hitY = res.my;
  } else {
    hitX = atkr.x; hitY = atkr.y;
  }
  const relX = hitX - pivDefr.x, relY = hitY - pivDefr.y;
  // Cross product: positive = hit from clockwise side, negative = counter-clockwise
  const cross = defDirX*relY - defDirY*relX;
  // cross > 0 → hit came from the clockwise side (+1)
  // cross < 0 → hit came from the counter-clockwise side (-1)
  const deflectDir = cross >= 0 ? -1 : 1;
  defr.angle += deflectDir * deflectRad;
  defr.vel += deflectDir * deflectRad * 4;

  // ─── APPLY PUSH ──────────────────────────────────────────────────
  // Push both fighters apart (attacker and defender) with a knockback effect.
  if(typeof document!=='undefined' && cb('clashdbg')
     && typeof P!=='undefined' && atkr===P){
    const dirTxt = deflectDir > 0 ? '⬅ CLOCKWISE' : '⬅ COUNTER-CLOCKWISE';
    console.log(`[CLASH DEBUG] Clash: ${dirTxt} | cross=${cross.toFixed(3)} | defr.angle=${(defr.angle*180/Math.PI).toFixed(1)}° | hitX=${hitX.toFixed(1)}, hitY=${hitY.toFixed(1)} | pivDefr=(${pivDefr.x.toFixed(1)},${pivDefr.y.toFixed(1)}) | atkr.vel=${atkr.vel.toFixed(2)}`);
  }

  // Clash: attacker's weapon goes backward, defender's weapon goes backward too (both rebound)
  const atkSign = atkr.vel >= 0 ? 1 : -1; // +1 = clockwise direction
  atkr.vel = $.M.clamp(-atkSign * 3.0, -8, 8);  // attacker rebounds
  defr.vel = $.M.clamp(-atkSign * 1.5, -8, 8);  // defender rebounds slightly less

  // ─── KNOCKBACK ──────────────────────────────────────────────────
  // Apply a physical push that separates the two fighters (like a real clash).
  const push = Math.min(sv('bladeKB'), 25);
  if(push > 0){
    const bodyLen = Math.hypot(entB.x-entA.x, entB.y-entA.y) || 1;
    const bodyAng = Math.atan2(entB.y-entA.y, entB.x-entA.x);
    // Apply knockback in the direction of the swing (with a 30° bias)
    const swordBias = Math.atan2(
      Math.sin(atkr.angle)*0.5, Math.cos(atkr.angle)*0.5
    );
    const finalAng = bodyAng + $.M.clamp($.M.angDiff(swordBias, bodyAng), -Math.PI/6, Math.PI/6);
    const pushX = Math.cos(finalAng), pushY = Math.sin(finalAng);
    // Separate knockback impulse cannot be overwritten by held movement.
    entA._dvx = (entA._dvx || 0) - pushX*push;
    entA._dvy = (entA._dvy || 0) - pushY*push;
    entB._dvx = (entB._dvx || 0) + pushX*push;
    entB._dvy = (entB._dvy || 0) + pushY*push;
    entA._moveLockUntil = Math.max(entA._moveLockUntil || 0, GameTime + 0.35);
    entB._moveLockUntil = Math.max(entB._moveLockUntil || 0, GameTime + 0.35);
  }

// ─── BLOCK KNOCKBACK ──────────────────────────────────────────────
  if(blockKnockOn){
    const bkb = sv('blockKB');
    // Attacker (aggressor) pushes defender (blocker) backward
    const atkr = entA.isAttacker ? entA : entB;
    const defr = entA.isAttacker ? entB : entA;
    const bkAng = Math.atan2(defr.y-atkr.y, defr.x-atkr.x);
    // ─── USE _dvx/_dvy (like dodge) instead of vx/vy directly ──
    // vx/vy are per-frame velocities that get overridden by $.M.lerpDT() with current input
    // (WASD for player / ai._fakeKeys for bot) — they won't persist if we just += to vx/vy
    // while input is held. _dvx/_dvy are impulse-based, applied in update()/updateDummy() and
    // decay over time, so they correctly override the current movement.
    const _defrKick = bkb + sv('kbforce')*0.3;
    defr._dvx = (defr._dvx||0) + Math.cos(bkAng)*_defrKick;
    defr._dvy = (defr._dvy||0) + Math.sin(bkAng)*_defrKick;
    const _atkrKick = (bkb + sv('kbforce')*0.3) * 0.5;
    atkr._dvx = (atkr._dvx||0) - Math.cos(bkAng)*_atkrKick;
    atkr._dvy = (atkr._dvy||0) - Math.sin(bkAng)*_atkrKick;
    // ─── MOVE LOCK ──────────────────────────────────────────────
    defr._moveLockUntil = GameTime + 0.5;
    atkr._moveLockUntil = GameTime + 0.5;
  }

  // ─── EFFECTS ──────────────────────────────────────────────────────
  $.FX.hit({x:hitX, y:hitY-4, t:'⚡', life:12, big:true, col:'#ffffff'});
  $.FX.hit({x:hitX, y:hitY+14, t:(window.I18N ? window.I18N.t('combat.clash') : 'CLASH!'), life:35, big:false, col:'#ccccaa'});
  // strongSwing creates a flash and cross effect
  if(strongSwing && Math.random() < 0.04) spawnFX('flash', hitX, hitY);
  // Cross FX at the clash point
  if(strongSwing){
    spawnFX('cross', hitX, hitY);
  }
  // ─── SLOW DOWN ──────────────────────────────────────────────────
  const sld = sv('blockSlowDur');
  if(sld > 0){
    entA._blockSlow = GameTime + sld;
    entB._blockSlow = GameTime + sld;
  }
  // ─── BLOCK COOLDOWN ────────────────────────────────────────────
  // Prevents spam (0.25s cooldown for both fighters)
  entA._swingBlockCD = GameTime + 0.25;
  entB._swingBlockCD = GameTime + 0.25;
}



function shieldCenter(ent, cursorX){
  const c = $.POS.body(ent);
  const def = shieldDef(ent);
  if(!def) return null;
  const _autoSide = (cursorX < c.x) ? 1 : -1;
  const targetSide = (ent._shieldFlipped) ? -_autoSide : _autoSide;
  if(ent._shieldSide===undefined) ent._shieldSide = targetSide;
  const spd = typeof sv==='function' ? (sv('shieldSideSpd')||3.3) : 3.3;
  ent._shieldSide += (targetSide - ent._shieldSide) * Math.min(1, rawDt * spd);
  const CHAR_W = 20;
  const _shVertOff = Math.sin(ent.angle) * 14;
  return { x: c.x + ent._shieldSide * CHAR_W * 0.9, y: c.y + _shVertOff, side: ent._shieldSide };
}


// ─── SHIELD VS BLADE ──────────────────────────────────────────────────
// Checks if the defender's shield blocks the attacker's blade.
function checkShieldVsBlade(attacker, defender, bx1,by1, tx1,ty1){
  const def = shieldDef(defender);
  if(!def) return false;
  if(DEATH.pDead || DEATH.dDead) return false;

  // ─── LMB ACTIVE ──────────────────────────────────────────────────
  // Shield doesn't block if LMB is held (weapon is active)
  const lmbActive = (defender===P) ? (mDown && !isRangedWeapon(defender) && weaponKeyOf(defender) !== 'flail') : false;
  if(lmbActive) return false;
  if(defender._shieldAlpha < 0.5) return false;

  const curX = (defender===P) ? (typeof mX!=='undefined'?mX:W/2)
                               : (typeof P!=='undefined'?P.x:W/2);
  const sc = shieldCenter(defender, curX);
  if(!sc) return false;

  // ─── SHIELD BOUNDS ──────────────────────────────────────────────
  const _cDef = shieldDef(defender);
  const _cH = CHAR_SPRITE_H * sv('cscl') * 1.2 * (_cDef?_cDef.scale:1);
  const _cW = _cH * 0.75; // fallback aspect ratio
  const shW = (defender._shieldW>0 ? defender._shieldW : _cW);
  const shH = (defender._shieldH>0 ? defender._shieldH : _cH);
  // ─── SHIELD SIZE ──────────────────────────────────────────────
  const shWfinal = (defender.shield===3) ? shW*1.2 : shW;
  // ─── SIMPLE AABB ──────────────────────────────────────────────
  const left=sc.x-shWfinal/2, right=sc.x+shWfinal/2;
  const top=sc.y-shH/2, bot=sc.y+shH/2;
  // debug collider (uncomment for testing)
  // ctx.strokeStyle='#f00'; ctx.strokeRect(left,top,shWfinal,shH);

  // ─── INTERSECTION TEST ────────────────────────────────────────
  // (using segmentIntersectsRect from MATH HELPERS module)
  if(!segmentIntersectsRect(bx1,by1,tx1,ty1, left,top,right,bot)) return false;

  // ─── HIT EFFECTS ──────────────────────────────────────────────
  const mx=(bx1+tx1)/2, my2=(by1+ty1)/2;
  applyShieldBlockFX(mx, my2, attacker, defender, {hitstopMag:3, waveDuration:22, unbalanceAmt:1.2, textLife:35});
  const _bvx=(tx1-bx1), _bvy=(ty1-by1), _bl=Math.hypot(_bvx,_bvy)||1;
  attacker.vx -= _bvx/_bl*4;
  attacker.vy -= _bvy/_bl*4;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ─── FLICK/ORBIT DETECTORS ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────
// (lastT/GameTime/RealTime/rawDt are global variables defined in main — 
// they are accessible here and updated every frame.)

// ─── ORBIT DETECTOR ──────────────────────────────────────────────────
// Detects continuous circular motion (orbit) without flicking.
const ORBIT = {
  accumAngle: 0,   // accumulated angle (radians)
  lastAngle: null,
  windowStart: -1,
  lastDir: 0,
};

const FLICK = {
  swings: [],
  curDir: 0,
  curAmp: 0,
};

function updateOrbitDetect(swordAngle, rawDt) {
  if (!cb('orbitdet')) return false;
  if (mDown) { ORBIT.accumAngle = 0; ORBIT.lastAngle = null; ORBIT.lastDir = 0; return false; }
  
  // ─── IF PLAYER HAS NO WEAPON ──────────────────────────────────
  if (P.hasWeapon === false) return false;

  if (ORBIT.lastAngle === null) { ORBIT.lastAngle = swordAngle; ORBIT.windowStart = RealTime; return false; }

  const orbitWindow = sv('orbitwindow');
  const minTurns = sv('orbitturns');

  if (RealTime - ORBIT.windowStart > orbitWindow) {
    ORBIT.accumAngle = 0; ORBIT.lastAngle = swordAngle;
    ORBIT.windowStart = RealTime; ORBIT.lastDir = 0;
    return false;
  }

  const dAng = $.M.angDiff(swordAngle, ORBIT.lastAngle);
  ORBIT.lastAngle = swordAngle;

  const curDir = Math.sign(dAng);
  if (Math.abs(dAng) < 0.001) return false;

  if (ORBIT.lastDir !== 0 && curDir !== 0 && curDir !== ORBIT.lastDir) {
    ORBIT.accumAngle = 0; ORBIT.windowStart = RealTime;
    ORBIT.lastDir = curDir;
    return false;
  }

  if (curDir !== 0) ORBIT.lastDir = curDir;
  ORBIT.accumAngle += Math.abs(dAng);

  if (ORBIT.accumAngle >= minTurns * Math.PI * 2) {
    ORBIT.accumAngle = 0; ORBIT.windowStart = RealTime; ORBIT.lastDir = 0;
    return true;
  }
  return false;
}

// ─── FLICK DETECTOR ──────────────────────────────────────────────────
// Detects rapid direction changes: >= flickCount swings within flickWindow
// seconds, with |realAngVel| > flickMinVel and amplitude between
// flickMinAmp <= amp <= flickMinAmp*flickmaxmult (from FlickTest.html:
// flickcount=2, flickmaxmult=5 — "ideal").
// curAngle here is the same as realAngVel (rad/frame), pre-calculated from sword angle.
function updateFlickDetect(realAngVel, rawDt) {
  if (!cb('flickdet')) return false;
  const flickWindow  = sv('flickwindow');
  const flickMinVel  = sv('flickminvel');
  const flickMinAmp  = sv('flickminamp');
  const flickMaxMult = sv('flickmaxmult');
  const flickCount   = sv('flickcount');

  const dir = Math.sign(realAngVel);
  const fastEnough = Math.abs(realAngVel) > flickMinVel;

  // ─── FILTER SWINGS WITHIN WINDOW ──────────────────────────────
  FLICK.swings = FLICK.swings.filter(s => RealTime - s.time <= flickWindow);

  if (dir === 0) return false;

  const contribution = Math.abs(realAngVel) * rawDt;

  if (FLICK.curDir === 0) {
    if (fastEnough) {
      FLICK.curDir = dir;
      FLICK.curAmp = contribution;
    }
    return false;
  }

  if (dir === FLICK.curDir) {
    FLICK.curAmp += contribution;
    return false;
  }

  // ─── DIRECTION CHANGE — record swing ──────────────────────────
  if (FLICK.curAmp >= flickMinAmp && FLICK.curAmp <= flickMinAmp * flickMaxMult) {
    FLICK.swings.push({ time: RealTime, amp: FLICK.curAmp });
  } else if (FLICK.curAmp > flickMinAmp * flickMaxMult) {
    // Too large swing — reset the sequence
    FLICK.swings = [];
  }
  // amp < flickMinAmp — ignore, keep accumulating

  if (fastEnough) {
    FLICK.curDir = dir;
    FLICK.curAmp = contribution;
  } else {
    FLICK.curDir = 0;
    FLICK.curAmp = 0;
  }

  if (FLICK.swings.length >= flickCount) {
    FLICK.swings = [];
    FLICK.curDir = 0; FLICK.curAmp = 0;
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────────
// END LAYER: COMBAT
// ─────────────────────────────────────────────────────────────────────────────────

// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
