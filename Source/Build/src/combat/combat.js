// === src/combat/combat.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: COMBAT — коллизии, блоки, стамина, статусы и отладочные шарики.
// First module section: debug balls.
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// MODULE: DEBUG BALLS  (тестовый режим "спавн шариков" — НЕ боевые снаряды)
// Debug balls are already isolated as the first section of this module.
// Это отдельная песочница для проверки коллизии оружия/тела с летящими
// объектами; не путать с PROJECTILES (реальные снаряды жезла/арбалета,
// см. MODULE: RANGED WEAPONS дальше в файле).
// ════════════════════════════════════════════════════════════════════════════

// ── ШАРИКИ ──────────────────────────────────────────────────────────────────
const BALLS = [];
let ballsActive = false;
let ballSpawnTimer = 0;

function spawnBall(){
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const rc0 = rootCenter();
  if(side === 0){ x = Math.random()*W; y = -16; }
  else if(side === 1){ x = W+16; y = Math.random()*H; }
  else if(side === 2){ x = Math.random()*W; y = H+16; }
  else { x = -16; y = Math.random()*H; }
  // целимся прямо в тело игрока (не рут), небольшой разброс
  const targetX = rc0.x + P.bx + (Math.random()-0.5)*30;
  const targetY = rc0.y + P.by + (Math.random()-0.5)*30;
  const ang = Math.atan2(targetY - y, targetX - x);
  const spd = rf(4.5,3.0);
  const vx = Math.cos(ang) * spd;
  const vy = Math.sin(ang) * spd;
  BALLS.push({ x, y, vx, vy, r: rf(10,5), life: 500, hit: 0,
               initVx: vx, initVy: vy }); // запоминаем начальную скорость
}

document.getElementById('btn-balls').addEventListener('click', () => {
  ballsActive = !ballsActive;
  const btn = document.getElementById('btn-balls');
  if(ballsActive){
    btn.textContent = '⏹ СТОП ШАРИКИ';
    btn.style.borderColor = '#aa3030';
    btn.style.background = '#2a0e0e';
  } else {
    BALLS.length = 0;
    btn.textContent = '⚽ СПАВН ШАРИКОВ';
    btn.style.borderColor = '#5a1a1a';
    btn.style.background = '#1a0e0e';
  }
});

function updateBalls(dt){
  if(!ballsActive) return;
  ballSpawnTimer += dt;
  if(ballSpawnTimer > 0.9){ ballSpawnTimer = 0; spawnBall(); }

  const pivX = rootCenter().x + P.pvX;
  const pivY = rootCenter().y + P.pvY;
  const swLen = weaponReach(P) * sv('swlen');

  // позиция наконечника и ПРЕДЫДУЩЕГО наконечника (для sweep-коллизии)
  const tipX = pivX + Math.cos(P.angle) * swLen;
  const tipY = pivY + Math.sin(P.angle) * swLen;
  const prevTipX = pivX + Math.cos(P.angle - P.vel*0.8) * swLen;
  const prevTipY = pivY + Math.sin(P.angle - P.vel*0.8) * swLen;

  for(let i = BALLS.length-1; i >= 0; i--){
    const b = BALLS[i];

    // мягкое наведение на тело игрока (homing)
    if(b.hit === 0){
      const rc1 = rootCenter();
      const targetX = rc1.x + P.bx, targetY = rc1.y + P.by;
      const angToPlayer = Math.atan2(targetY - b.y, targetX - b.x);
      const homingStr = 0.012;
      b.vx += Math.cos(angToPlayer) * homingStr;
      b.vy += Math.sin(angToPlayer) * homingStr;
      const spd2 = Math.hypot(b.vx, b.vy);
      const maxSpd = Math.hypot(b.initVx, b.initVy) * 1.15;
      if(spd2 > maxSpd){ b.vx = b.vx/spd2*maxSpd; b.vy = b.vy/spd2*maxSpd; }
    }

    b.x += b.vx; b.y += b.vy;
    b.life--;
    if(b.hit > 0) b.hit--;

    // ── Коллизия с мечом ─────────────────────────────────────────────────
    let hit = false;
    if(b.hit === 0){
      const BLADE_W = 6;
      for(const [ax,ay,bx2,by2] of [
        [pivX, pivY, tipX, tipY],
        [pivX, pivY, prevTipX, prevTipY],
      ]){
        if(hit) break;
        const {d, nx, ny, t} = distPointToSegment(b.x, b.y, ax, ay, bx2, by2);
        if(d < b.r + BLADE_W){
          const bladeX = Math.cos(P.angle), bladeY = Math.sin(P.angle);
          const alongBlade = Math.abs(nx*bladeX + ny*bladeY);
          if(alongBlade > 0.8) continue;

          const swordSpd = Math.abs(P.vel) * 200;
          b.vx = nx*(5 + swordSpd*0.06) + bladeX*swordSpd*0.035;
          b.vy = ny*(5 + swordSpd*0.06) + bladeY*swordSpd*0.035;
          b.hit = 22;
          hitFX.push({x: b.x, y: b.y-14, t:'вњ¦', life:28, big:false});
          
          const aikb = sv('bodyKB') * 0.5;
          if(aikb > 0){
            const rc1 = rootCenter();
            const bodyCX1 = rc1.x + P.bx, bodyCY1 = rc1.y + P.by;
            const kbAng = Math.atan2(bodyCY1 - b.y, bodyCX1 - b.x);
            P.vx += Math.cos(kbAng) * aikb;
            P.vy += Math.sin(kbAng) * aikb;
          }
          hit = true;
        }
      }
    }

    // ── ПОПАДАНИЕ ШАРИКА В ТЕЛО ИГРОКА ──────────────────────────────────
    {
      const rc0 = rootCenter();
      const bodyCX = rc0.x + P.bx;
      const bodyCY = rc0.y + P.by;
      const BODY_HIT_R = 18 * sv('cscl');
      
      if(b.hit === 0){
        const d = Math.hypot(b.x - bodyCX, b.y - bodyCY);
        if(d < BODY_HIT_R + b.r && (P._ballHitCD||0) <= GameTime){
          P._ballHitCD = GameTime + 0.5;
          const dmg = Math.round(Math.hypot(b.vx, b.vy) * 4);
          
          // ════════════════════════════════════════════════════════════════
          // 🔥 ЕДИНЫЙ ВЫЗОВ applyDamage
          // ════════════════════════════════════════════════════════════════
          applyDamage(P, dmg, null, {
            isMagic: false,
            isExplosion: false,
            knockbackMult: 0.5,
            hitstopFrames: 4,
            shakePower: 4,
            textColor: '#ff4040',
            textSuffix: 'вљЅ',
            bloodCount: 8,
            playSound: true
          });
          
          // ── ДОПОЛНИТЕЛЬНЫЕ ЭФФЕКТЫ (специфичные для шариков) ──
          const nx = (bodyCX - b.x)/(d||1), ny = (bodyCY - b.y)/(d||1);
          const kbf = sv('bodyKB') * 0.5;
          P.vx += nx * kbf; P.vy += ny * kbf;
          b.vx = nx * 3; b.vy = ny * 3 - 1;
          b.hit = 30;
          BALLS.splice(i, 1);
        }
      }
    }

    if(b.life <= 0 || b.x < -120 || b.x > W+120 || b.y < -120 || b.y > H+120){
      BALLS.splice(i, 1);
    }
  }
}

function drawBalls(){
  for(const b of BALLS){
    const alpha = Math.min(1, b.life / 60);
    ctx.save();
    ctx.globalAlpha = alpha;
    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(b.x+3, b.y+5, b.r*0.8, b.r*0.4, 0, 0, Math.PI*2); ctx.fill();
    // шар
    const g = ctx.createRadialGradient(b.x - b.r*0.3, b.y - b.r*0.3, b.r*0.1, b.x, b.y, b.r);
    if(b.hit > 0){
      g.addColorStop(0, '#fff8c0'); g.addColorStop(0.4, '#ffcc40'); g.addColorStop(1, '#cc6010');
    } else {
      g.addColorStop(0, '#e0f0ff'); g.addColorStop(0.4, '#4090d0'); g.addColorStop(1, '#0a2850');
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    // блик
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(b.x - b.r*0.3, b.y - b.r*0.3, b.r*0.25, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ──────────────── END LAYER: DEBUG_BALLS ────────────────

// ════════════════════════════════════════════════════════════════════════════
// LAYER: COMBAT — коллизии мечей, блок/клинч, ярость, смерть/респавн
// Module file: combat.js
// ════════════════════════════════════════════════════════════════════════════
// ── СОСТОЯНИЕ ИГРОКА ────────────────────────────────────────────────────────
function makeEntity(x, y, swordScale, color, charParams){
  const defaults = {
    stamRegen: 28,       // восст. стамины в сек
    stamMax: 100,        // макс стамина
    exhaustRegenDelay: 0.1, // короткая пауза перед регенерацией после усталости
	_bowSeed: Math.random() * 100, // 🔥 ДЛЯ ДРОЖАНИЯ ЛУКА
	   _recoilOffset: 0,
    _recoilAnimTime: 0,
	   _magicShakeX: 0,
    _magicShakeY: 0,
    _magicShakeAngle: 0,
	_rageWarningCD: 0,
    _wandSeed: Math.random() * 100,
    // 🔥 ЕДИНАЯ СИСТЕМА ТРЯСКИ
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
    // ── Параметры персонажа ──
    stamRegen: p.stamRegen,
    stamMax: p.stamMax,
    exhaustDur: p.exhaustDur,
    exhaustSpd: p.exhaustSpd,
    exhaustSwd: p.exhaustSwd,
    exhaustRegenDelay: p.exhaustRegenDelay,
    // ──────────────────────────
    _vcX:50, _vcY:0, _pmX:0, _pmY:0,
    hp:100, hitFlash:0,
    stamina:100,
    exhausted:0, unbalanced:0, unbAngle:0,
    atkPts:0, isAttacker:false,
    trailPts:[],
    rage:0, rageBuffEnd:-1, lmbWasDown:false,
    _bbWait:-1, _bbDefender:null,
    _blockSlow:-1, _hitCD:-1,
    // ── Щит ──────────────────────────────────
    shield: 0,          // 0=нет, 1=малый, 2=большой, 3=башенный
    _shieldImg: null,   // Image объект
    _shieldUrl: null,
    _shieldAlpha: 1,    // прозрачность (снижается при LMB атаке)
    _shieldW: 0,        // ширина хитбокса в пикселях (из пропорций картинки)
    _shieldH: 0,        // высота хитбокса
	
    // ── Цеп ──────────────────────────────────
	    _flailAngle: 0,        // отдельный накопитель угла для цепа
    _flailDirection: 1,    // направление вращения
    _flailIsRotating: false,
    _lastCursorAng: 0,     // предыдущий угол курсора для детекта направления
	    _flailInertiaVel: 0,   // скорость инерции цепа
    _prevFlailAngle: 0,    // предыдущий угол для вычисления скорости
	  _flailInertia: 0,        // инерция вращения цепа
    _flailExt: 0,            // текущая длина цепи (0-1)
    _flailMode: 'follow',     // 'follow' или 'free'
    _flailFreeAngle: 0,

    _recoilOffset: 0,
    _recoilAnimTime: 0,
	
// ── Защита от мультиурона ──────────────────────
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

// ── ЯЩИКИ ─────────────────────────────────────────────────────────────────
// Инициализируются после W/H (см. initBoxes внизу)
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

// Разрешить коллизию тела (bx/by) с ящиками
// Тело = визуальный центр: (P.x+5+P.bx, P.y-8+P.by), радиус ~14
function resolveBoxCollision(ent){
  if(!boxesOn) return;
  const BODY_R = 14 * sv('cscl');
  const bCX = ent.x + 5 + ent.bx;
  const bCY = ent.y - 8 + ent.by;
  for(const b of BOXES){
    const nearX = clamp(bCX, b.x, b.x + b.w);
    const nearY = clamp(bCY, b.y, b.y + b.h);
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

// ════════════════════ END MODULE: FX ══════════════════════════════════════

function updateAtkPoints(ent, opponent, dt){
  const exC = entityCenter(ent);
  const opC = entityBodyCenter(opponent);
  const toOp = Math.atan2(opC.y - exC.y, opC.x - exC.x);
  const movAng = Math.atan2(ent.vy, ent.vx);
  const movSpd = Math.hypot(ent.vx, ent.vy);

  // +1 если движется к противнику
  if(movSpd > 0.5 && Math.abs(angDiff(movAng, toOp)) < Math.PI/2)
    ent.atkPts += dt * 1;

  // +1 если кончик меча касается (tip близко к телу противника)
  const piv = entityPivot(ent);
  const tipX = piv.x + Math.cos(ent.angle) * weaponReach(ent);
  const tipY = piv.y + Math.sin(ent.angle) * weaponReach(ent);
  if(Math.hypot(tipX - opC.x, tipY - opC.y) < 30) ent.atkPts += dt * 1;

  // +1 за замах (высокая угловая скорость)
  if(Math.abs(ent.vel) > sv('swthresh')) ent.atkPts += dt * 1;

  // +2 если ЛКМ-атака (только для игрока)
  if(ent === P && mDown) ent.atkPts += dt * 2;

  // затухание
  ent.atkPts *= Math.pow(0.92, dt*60);
}

function determineAttacker(){
  P.isAttacker   = P.atkPts >= D.atkPts;
  D.isAttacker   = D.atkPts > P.atkPts;
}

// Обработка столкновения мечей
function blockStaminaCost(attacker){
  // Зажатая ЛКМ отменяет расход, когда удар игрока блокирует противник.
  if(attacker === P && mDown) return 0;
  return sv('stamblock') * (isBot(attacker) ? 2 : 1);
}
function swordHit(entA, entB){
  const attacker = entA.isAttacker ? entA : entB;
  const defender = entA.isAttacker ? entB : entA;
  const cost = blockStaminaCost(attacker);
  attacker.stamina = Math.max(0, attacker.stamina - cost);
  if(attacker.stamina <= 0 && !isExhausted(attacker)){
    applyExhaust(attacker);
    return;
  }
  const disbalanceWindow = defender && defender.hasWeapon !== false && !isRangedWeapon(defender) && weaponKeyOf(defender) !== 'flail' &&
    (defender === P ? (mDown && (GameTime - (P.lmbHoldStart || -99)) <= 0.6) : !!defender._fakeMDown);
  if(disbalanceWindow && !isUnbalanced(attacker)){
    attacker.unbAngle = attacker.angle;
    applyDisbalance(attacker);
  }
}

// Ближайшее расстояние между двумя отрезками
function segSegDist(ax,ay,bx,by,cx,cy,dx,dy){
  const d1x=bx-ax,d1y=by-ay,d2x=dx-cx,d2y=dy-cy,d12x=ax-cx,d12y=ay-cy;
  const a=d1x*d1x+d1y*d1y, e=d2x*d2x+d2y*d2y;
  if(a<0.001&&e<0.001) return {d:Math.hypot(ax-cx,ay-cy),mx:(ax+cx)/2,my:(ay+cy)/2};
  let s,t;
  if(a<0.001){t=clamp((d2x*d12x+d2y*d12y)/e,0,1);s=0;}
  else{const c2=d1x*d12x+d1y*d12y;
    if(e<0.001){s=clamp(-c2/a,0,1);t=0;}
    else{const b2=d1x*d2x+d1y*d2y,den=a*e-b2*b2;
      s=den>0.001?clamp((b2*(d2x*d12x+d2y*d12y)-e*c2)/den,0,1):0;
      t=clamp((b2*s+(d2x*d12x+d2y*d12y))/e,0,1);
      s=clamp((-c2+b2*t)/a,0,1);t=clamp((b2*s+(d2x*d12x+d2y*d12y))/e,0,1);}}
  const px=ax+s*d1x,py=ay+s*d1y,qx=cx+t*d2x,qy=cy+t*d2y;
  return {d:Math.hypot(px-qx,py-qy),mx:(px+qx)/2,my:(py+qy)/2,px,py,qx,qy,s,t};
}

// Коллизия меч→меч: физический блок + стамина + искры
// Коллизия меч→тело: урон + отбрасывание, кулдаун 0.5с

function checkSwordCollision(entA, entB, dt){

  // Если оба — боты, то ничего не делаем
  if(isBot(entA) && isBot(entB)) return;
  
  // Если у кого-то нет оружия — пропускаем碰撞 мечей
  if(entA.hasWeapon === false || entB.hasWeapon === false) {
    const pivA = entityPivot(entA);
    const pivB = entityPivot(entB);
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
  
  const pivA = entityPivot(entA);
  const pivB = entityPivot(entB);

  // ── Концы полного сегмента оружия (перёд + зад для center-grip) ──
  // spanA/spanB уже включают BLADEFIXSCALE (см. weaponColliderSpan) — так
  // BLADEFIXSCALE реально меняет РАЗМЕР коллайдера оружия, а не просто
  // толщину линии, как было раньше (там эффект был почти незаметен).
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

  // ── HANDRANGE — «мёртвая зона» у рукояти для клинок-клинок/клинок-щит ──
  // Отступаем HANDRANGE от pivot в сторону клинка (перёд/зад), не дальше
  // фактической длины этой половины оружия.
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

  // ── ЧИСТЫЕ (без BLADEFIXSCALE) координаты — ТОЛЬКО для попадания по ТЕЛУ ──
  // checkBladeVsBody не должен зависеть от BLADEFIXSCALE (тот только для
  // клинок-клинок/клинок-щит выше), поэтому передаём туда оригинальную,
  // немасштабированную длину/pivot оружия отдельно.
const BODY_HIT_RATIO = 0.82; // 82% от полной длины
const bodySwA = weaponReach(entA) * sv('swlen') * BODY_HIT_RATIO;
const bodySwB = weaponReach(entB) * sv('swlen') * (isBot(entB)?sv('botswordscale'):1) * BODY_HIT_RATIO;
  const bodyTipAx = pivA.x + dirAx*bodySwA;
  const bodyTipAy = pivA.y + dirAy*bodySwA;
  const bodyTipBx = pivB.x + dirBx*bodySwB;
  const bodyTipBy = pivB.y + dirBy*bodySwB;

  if(entA._bladeCD === undefined) entA._bladeCD = -1;

  // ── МЕЧ A vs МЕЧ B ──────────────────────────────────────────────────────
  // Проверяем ОБЕ части каждого клинка (передняя за мёртвой зоной, и задняя
  // за мёртвой зоной, если она есть у center-grip оружия) против обеих
  // частей клинка соперника — иначе задняя половина посоха не коллизирует.
  const segsA = [[bladeAx,bladeAy, tipAx,tipAy]];
  if(spanA.back > 0) segsA.push([backHandAx,backHandAy, backAx,backAy]);
  const segsB = [[bladeBx,bladeBy, tipBx,tipBy]];
  if(spanB.back > 0) segsB.push([backHandBx,backHandBy, backBx,backBy]);

  if(!isExhausted(entA) && !isExhausted(entB)){
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
    entA.x += nx*sepClamped*0.5;
    entA.y += ny*sepClamped*0.5;
    entB.x -= nx*sepClamped*0.5;
    entB.y -= ny*sepClamped*0.5;

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
        entB.vx -= mxA * aikb * 0.4 * proj;
        entB.vy -= myA * aikb * 0.4 * proj;
      } else {
        entB.vx -= nx * aikb * 0.3;
        entB.vy -= ny * aikb * 0.3;
      }
      if(spdB > MOVE_THRESH){
        const mxB = entB.vx/spdB, myB = entB.vy/spdB;
        const proj = Math.max(0, mxB*nx + myB*ny);
        entA.vx -= mxB * aikb * 0.4 * proj;
        entA.vy -= myB * aikb * 0.4 * proj;
      } else {
        entA.vx -= nx * aikb * 0.3;
        entA.vy -= ny * aikb * 0.3;
      }
    }
    
    if(entA._bladeCD <= GameTime){
      entA._bladeCD = GameTime + 0.4;
      const strongSwing = Math.abs(entA.vel) > sv('swthresh')*2.5 || Math.abs(entB.vel) > sv('swthresh')*2.5;
      doClash(entA, entB, res, strongSwing);
      swordHit(entA, entB);
      if(strongSwing) playSound('clashHard'); else playSound('clash');
      if(typeof triggerHitstop==='function') triggerHitstop(strongSwing?3:2, strongSwing?3:1.5);
      entA._clashFrame = GameTime;
      entB._clashFrame = GameTime;
      const rageGain = 100/sv('rageper') * 0.5;
      addRage(entA, rageGain);
      addRage(entB, rageGain);
      if(cb('bbind')){
        bladeBind_onContact(entA, entB, nx, ny);
      }
      const _otherBot = entA===P ? entB : (entB===P ? entA : null);
      if(_otherBot && isBot(_otherBot)) switchSmartBot(_otherBot);
      aiNotifyContact();
    }
    } // столкновение активных клинков
  }

  // ── ПРОВЕРКА УРОНА ПО ТЕЛУ ────────────────────────────────────────────
  checkBladeVsBody(entA, entB, pivA.x, pivA.y, bodyTipAx, bodyTipAy);
  checkBladeVsBody(entB, entA, pivB.x, pivB.y, bodyTipBx, bodyTipBy);
  
  // ── СМЕНА ГЛАВНОГО ПРИ КАСАНИИ ─────────────────
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
} // ← ЗАКРЫВАЕМ ВСЮ ФУНКЦИЮ

function checkBladeVsBody(attacker, defender, pivX, pivY, tipX2, tipY2) {
  // Нет урона во время экрана победы/поражения
  if (DEATH.pDead || DEATH.dDead) return;
  // Оружие уставшего персонажа не имеет активного коллайдера.
  if (isExhausted(attacker)) return;
  // В сетевом ПВП D — локальная интерполированная кукла противника
  if (defender === P && attacker === D && typeof NET_SYNC !== 'undefined' && NET_SYNC.active) return;
  // Iframes во время доджа
  if (defender === P && Math.hypot(P._dvx || 0, P._dvy || 0) > 200) return;
  
  const bC = entityBodyCenter(defender);
  const key = weaponKeyOf(attacker);
  
  // ============================================================
  // 🔥 БЛОК ДЛЯ КОПЬЯ (отдельная логика)
  // ============================================================
  if (key === 'spear') {
    const _dirX = Math.cos(attacker.angle);
    const _dirY = Math.sin(attacker.angle);
    
    // Полная длина оружия с учётом ВСЕХ скейлов
    const fullReach = weaponLenFor(attacker) * effSwordScale(attacker) * sv('swlen') * (isBot(attacker) ? sv('botswordscale') : 1);
    
    // 🔥 КОЭФФИЦИЕНТ, КОТОРЫЙ ПОДГОНЯЕТ ДЛИНУ ПОД СПРАЙТ
    // Подбери его так, чтобы 🎯 был точно на кончике копья
    const SPEAR_RATIO = 0.68; // ← меняй это число (0.7–0.85)
    
    // Кончик копья (от руки до точки удара)
    const tipX_adj = pivX + _dirX * fullReach * SPEAR_RATIO;
    const tipY_adj = pivY + _dirY * fullReach * SPEAR_RATIO;
    
    // Проверка попадания (расстояние от кончика до центра тела)
    const distToBody = Math.hypot(bC.x - tipX_adj, bC.y - tipY_adj);
    const BODY_HIT_R = 14;
    const hitR = BODY_HIT_R * sv('cscl');
    

    
    if (distToBody >= hitR) {
    return;
    }

    // ------------------------------------------------------------
    // Проверка на додж бота (оригинальный код)
    // ------------------------------------------------------------
    if (defender === D && attacker === P && typeof AI !== 'undefined' && AI.enabled !== false &&
        !(typeof NET_SYNC !== 'undefined' && NET_SYNC.active) &&
        !(AI._botDodgeCooldown > 0) && D.stamina >= D.stamMax * 0.5) {

      const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
      const scaledChancePct = Math.max(20, 100 - botCount * 10);
      const finalChance = Math.min(sv('botdodgechance'), scaledChancePct) / 100;

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
        hitFX.push({ x: D.x, y: D.y - 30, t: 'DODGE', life: 35, big: false, col: 'rgba(200,200,200,0.6)' });
        playSound('dodgeSound');
        return;
      }
    }
    
    // ------------------------------------------------------------
    // Проверка на щит (оригинальный код, адаптированный для копья)
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
            if (Math.random() < 0.10 && typeof triggerBladeBind === 'function')
              triggerBladeBind(defender, attacker);
            defender._hitCD = GameTime + 0.3;
            return;
          }
        }
      }
    }
    
    // ------------------------------------------------------------
    // Кулдаун удара
    // ------------------------------------------------------------
    if (defender._hitCD === undefined) defender._hitCD = -1;
    if (defender._hitCD >= GameTime) return;
    
    if (attacker.exhausted > 0) return;
    if (attacker.hasWeapon === false) return;
    
    // ------------------------------------------------------------
    // Расчёт урона для копья
    // ------------------------------------------------------------
    let dmg = Math.round(6 + Math.abs(attacker.vel) * 20);
    
    // Выпад (укол)
    const _isPoke = (attacker === P && mDown && P.lmbWasDown && (GameTime - (P.lmbHoldStart || -99)) <= 0.18) ||
                    (attacker === D && typeof AI !== 'undefined' && AI._pokeDodgeActive && (GameTime - (D._pokeStartTime || -99)) <= 0.3) ||
                    (attacker === D && typeof AI !== 'undefined' && AI._lungeActive && AI._lungePhase === 'lunge');
    if (_isPoke) dmg = Math.round(dmg * 1.5);
    dmg = Math.max(20, dmg);
    
    // Модификаторы
    if (defender === P && mDown) dmg = Math.round(dmg * sv('lmbdmg'));
    if (defender === D && typeof AI !== 'undefined' && AI._fakeMDown) dmg = Math.round(dmg * 1.5);
    if (attacker.rageBuffEnd > GameTime) dmg *= 2;
    if (shieldDef(attacker) && shieldSameSideAsSword(attacker)) dmg = Math.round(dmg * 0.85);
    if (isBot(attacker) && key === 'spear') dmg = Math.round(dmg * 1.5);
    const _defScale = (isBot(defender) ? sv('cscl') * sv('botscale') : sv('cscl')) || 1;
    dmg = Math.round(dmg / _defScale);
    dmg = applyCutSwingPenalty(attacker, dmg);
    
    // Защита от мультиурона (игрок)
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
    
    // Эффекты удара (тряска)
    defender._hitTiltAmp = (Math.random() < 0.5 ? -1 : 1) * 15 * Math.PI / 180;
    defender._hitTiltT0 = GameTime;
    
    // Нокбэк
    const kbf = sv('bodyKB') * 0.5;
    const _noDoubleKB = (attacker._clashFrame || 0) > GameTime - 0.05;
    if (kbf > 0 && !_noDoubleKB) {
      const _bkX = bC.x - entityBodyCenter(attacker).x;
      const _bkY = bC.y - entityBodyCenter(attacker).y;
      const _bkL = Math.hypot(_bkX, _bkY) || 1;
      defender.vx += (_bkX / _bkL) * kbf;
      defender.vy += (_bkY / _bkL) * kbf;
    }
    
    // Шанс выбить оружие
    if (!_isPoke && defender.hasWeapon !== false && attacker.hasWeapon !== false) {
      const swingPower = Math.abs(attacker.vel) / sv('swthresh');
      let disarmChance = 0.03 + swingPower * 0.07;
      if (weaponHasFlag(attacker, 'disarm')) disarmChance += 0.15;
      if (attacker.rageBuffEnd > GameTime) disarmChance += 0.10;
      disarmChance = Math.min(disarmChance, 0.50);
      
      if (Math.random() < disarmChance) {
        const _dkX = bC.x - entityBodyCenter(attacker).x;
        const _dkY = bC.y - entityBodyCenter(attacker).y;
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
        hitFX.push({ x: bC.x, y: bC.y - 52, t: '💥 ОРУЖИЕ ВЫБИТО!', life: 40, big: true, col: '#ffaa44' });
      }
    }
    
    // Разоружение (флаг 'disarm') — не гарантировано, шанс 30%
    if (!_isPoke && weaponHasFlag(attacker, 'disarm') && defender.hasWeapon !== false && Math.random() < 0.30) {
      const _dkX = bC.x - entityBodyCenter(attacker).x;
      const _dkY = bC.y - entityBodyCenter(attacker).y;
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
      hitFX.push({ x: bC.x, y: bC.y - 52, t: '💥 ОРУЖИЕ ВЫБИТО!', life: 40, big: true, col: '#ffaa44' });
    }
    
    // ------------------------------------------------------------
    // Применяем урон
    // ------------------------------------------------------------
    hitFX.push({
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
      textSuffix: _isPoke ? '⚔' : '🗡',
      bloodCount: _isPoke ? 4 : 6,
      playSound: false
    });
    
    playSound('damage');
    
    if (defender.hp <= 0) {
      if (defender === P) triggerDeath(defender, false);
      else handleCombatDeath(defender);
    }
    
    if (typeof NET_SYNC !== 'undefined' && NET_SYNC.active && attacker === P && defender === D) {
      NET_CORE.send({ type: 'hit', dmg, newHp: defender.hp });
    }
    
    const _otherBot2 = attacker === P ? defender : (defender === P ? attacker : null);
    if (_otherBot2 && isBot(_otherBot2)) switchSmartBot(_otherBot2);
    aiNotifyContact();
    
    return; // Выход, чтобы не дублировать урон
  }
  
  // ============================================================
  // 🔥 ОСТАЛЬНОЕ ОРУЖИЕ (меч, алебарда, посох, цеп и т.д.)
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
  
  const t2 = clamp(((bC.x - pivX_adj) * segDX + (bC.y - pivY_adj) * segDY) / segL2, 0, 1);
  const nearX = pivX_adj + t2 * segDX;
  const nearY = pivY_adj + t2 * segDY;
  const dist = Math.hypot(bC.x - nearX, bC.y - nearY);
  const hand = entityPivot(attacker);
  if(Math.hypot(nearX - hand.x, nearY - hand.y) < HANDRANGE) return;
  
  const BODY_HIT_R = 14;
  const hitR = BODY_HIT_R * sv('cscl');
  if (dist >= hitR) return;
  
  // Додж бота
  if (defender === D && attacker === P && typeof AI !== 'undefined' && AI.enabled !== false &&
      !(typeof NET_SYNC !== 'undefined' && NET_SYNC.active) &&
      !(AI._botDodgeCooldown > 0) && D.stamina >= D.stamMax * 0.5) {

    const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
    const scaledChancePct = Math.max(20, 100 - botCount * 10);
    const finalChance = Math.min(sv('botdodgechance'), scaledChancePct) / 100;

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
      hitFX.push({ x: D.x, y: D.y - 30, t: 'DODGE', life: 35, big: false, col: 'rgba(200,200,200,0.6)' });
      playSound('dodgeSound');
      return;
    }
  }
  
  // Блок щитом
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
            attacker.stamina = Math.max(0, attacker.stamina - blockCost);
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
            if (Math.random() < 0.10 && typeof triggerBladeBind === 'function')
              triggerBladeBind(defender, attacker);
            defender._hitCD = GameTime + 0.3;
            return;
          }
        }
      }
    }
    
    // Определяем нормаль и alongBlade
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
    
    // Проверка на выпад
    const _isPoke = key !== 'flail' && (
      (attacker === P && mDown && P.lmbWasDown && (GameTime - (P.lmbHoldStart || -99)) <= 0.18) ||
      (attacker === D && typeof AI !== 'undefined' && AI._pokeDodgeActive && (GameTime - (D._pokeStartTime || -99)) <= 0.3) ||
      (attacker === D && typeof AI !== 'undefined' && AI._lungeActive && AI._lungePhase === 'lunge')
    ) && Math.abs(attacker.vel) < sv('swthresh') * 0.3;
    
    // Для остальных оружий (не копьё) — стандартная проверка
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
      
      // Модификаторы
      if (defender === P && mDown) dmg = Math.round(dmg * sv('lmbdmg'));
      if (defender === D && typeof AI !== 'undefined' && AI._fakeMDown) dmg = Math.round(dmg * 1.5);
      if (attacker.rageBuffEnd > GameTime) dmg *= 2;
      if (shieldDef(attacker) && shieldSameSideAsSword(attacker)) dmg = Math.round(dmg * 0.85);
      if (isBot(attacker) && (key === 'spear' || key === 'staff')) dmg = Math.round(dmg * 1.5);
      const _defScale = (isBot(defender) ? sv('cscl') * sv('botscale') : sv('cscl')) || 1;
      dmg = Math.round(dmg / _defScale);
      dmg = applyCutSwingPenalty(attacker, dmg);
      
      // Мультиурон
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
      
      // Нокбэк
      const kbf = sv('bodyKB') * 0.5;
      const _noDoubleKB = (attacker._clashFrame || 0) > GameTime - 0.05;
      if (kbf > 0 && !_noDoubleKB) {
        const _bkX = bC.x - entityBodyCenter(attacker).x;
        const _bkY = bC.y - entityBodyCenter(attacker).y;
        const _bkL = Math.hypot(_bkX, _bkY) || 1;
        defender.vx += (_bkX / _bkL) * kbf;
        defender.vy += (_bkY / _bkL) * kbf;
      }
      
      // Выбивание оружия
      if (!_isPoke && defender.hasWeapon !== false && attacker.hasWeapon !== false) {
        const swingPower = Math.abs(attacker.vel) / sv('swthresh');
        let disarmChance = 0.03 + swingPower * 0.07;
        if (weaponHasFlag(attacker, 'disarm')) disarmChance += 0.15;
        if (attacker.rageBuffEnd > GameTime) disarmChance += 0.10;
        disarmChance = Math.min(disarmChance, 0.50);
        
        if (Math.random() < disarmChance) {
          const _dkX = bC.x - entityBodyCenter(attacker).x;
          const _dkY = bC.y - entityBodyCenter(attacker).y;
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
          hitFX.push({ x: bC.x, y: bC.y - 52, t: '💥 ОРУЖИЕ ВЫБИТО!', life: 40, big: true, col: '#ffaa44' });
        }
      }
      
      // Разоружение (флаг 'disarm') — не гарантировано, шанс 30%
      if (!_isPoke && weaponHasFlag(attacker, 'disarm') && defender.hasWeapon !== false && Math.random() < 0.30) {
        const _dkX = bC.x - entityBodyCenter(attacker).x;
        const _dkY = bC.y - entityBodyCenter(attacker).y;
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
        hitFX.push({ x: bC.x, y: bC.y - 52, t: '💥 ОРУЖИЕ ВЫБИТО!', life: 40, big: true, col: '#ffaa44' });
      }
      
      // Доп. нокбэк для молота/посоха
      if (weaponHasFlag(attacker, 'knockback_hammer')) {
        const _kkX = bC.x - entityBodyCenter(attacker).x;
        const _kkY = bC.y - entityBodyCenter(attacker).y;
        const _kkL = Math.hypot(_kkX, _kkY) || 1;
        defender.vx += (_kkX / _kkL) * 18;
        defender.vy += (_kkY / _kkL) * 18;
        if(!isUnbalanced(defender)) applyDisbalance(defender, 0.8);
      }
      if (weaponHasFlag(attacker, 'knockback_staff')) {
        const _kkX = bC.x - entityBodyCenter(attacker).x;
        const _kkY = bC.y - entityBodyCenter(attacker).y;
        const _kkL = Math.hypot(_kkX, _kkY) || 1;
        defender.vx += (_kkX / _kkL) * 10;
        defender.vy += (_kkY / _kkL) * 10;
        if(!isUnbalanced(defender)) applyDisbalance(defender, 0.4);
      }
      
      // Применяем урон
      const isPoke = _isPoke;
      applyDamage(defender, dmg, attacker, {
        isMagic: false,
        isExplosion: false,
        knockbackMult: 0,
        hitstopFrames: 4,
        shakePower: dmg > 15 ? 6 : 3,
        textColor: isPoke ? '#ffdd44' : '#ff4040',
        textSuffix: isPoke ? 'вљ”' : '',
        bloodCount: isPoke ? 4 : 8,
        playSound: false
      });
      
      if (_isPoke) {
        hitFX.push({ x: bC.x, y: bC.y - 36, t: 'ВЫПАД!', life: 40, big: true, col: '#ffdd44' });
      }
      
      playSound(isHeavySwingWeapon(attacker) ? 'damageHammer' : 'damage');
      
      if (typeof NET_SYNC !== 'undefined' && NET_SYNC.active && attacker === P && defender === D) {
        NET_CORE.send({ type: 'hit', dmg, newHp: defender.hp });
      }
      
      const _otherBot2 = attacker === P ? defender : (defender === P ? attacker : null);
      if (_otherBot2 && isBot(_otherBot2)) switchSmartBot(_otherBot2);
      aiNotifyContact();
    }
  }
}






// ════════════════ END MODULE: MATH HELPERS ══════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────


// ════════════════════════════════════════════════════════════════════════════
// MODULE: COMBAT  (blade bind, clash, deflection, death/respawn)
// Combat logic is already isolated in this module.
// ════════════════════════════════════════════════════════════════════════════

// ── Общая реакция на "блок щитом" ───────────────────────────────────────────
// Раньше этот паттерн (иконка щита + текст "БЛОК!" + звук + hitstop +
// волна от щита + дисбаланс атакующего) был скопирован почти дословно в
// 4 местах: checkBladeVsBody, checkShieldVsBlade, отбрасывание оружия щитом
// и блок снарядов жезла/арбалета. Теперь один вызов вместо ~10-15 строк.
function applyShieldBlockFX(x, y, attacker, defender, opts){
  opts = opts || {};
  const hitstopMag = opts.hitstopMag != null ? opts.hitstopMag : 2;
  const waveDuration = opts.waveDuration != null ? opts.waveDuration : 18;
  hitFX.push({x, y: y-4, t:'🛡', life:16, big:true, col:'#aaddff'});
  hitFX.push({x, y: y+14, t:'БЛОК!', life:opts.textLife||30, big:false, col:'#88bbcc'});
  playSound('shieldblock');
  if(typeof triggerHitstop === 'function') triggerHitstop(hitstopMag, hitstopMag);
  
  const ang = opts.waveAngle != null ? opts.waveAngle
    : (attacker && defender) ? Math.atan2(attacker.y - defender.y, attacker.x - defender.x)
    : 0;
  FX_EFFECTS.push({type:'shieldwave', x, y, t:0, duration:waveDuration, angle:ang, followEntity:null});
  
  // 🔥 БЛОК ЩИТОМ — ТОЛЬКО ВИЗУАЛ И ЗВУК, БЕЗ ДЕБАФФА
  // (атакующий может продолжать двигать мечом)
}

// ── Общий прирост ярости при клэше/блоке ────────────────────────────────────
// Формула 100/sv('rageper')*0.5 была продублирована в 3 местах.
function clashRageGain(){ return 100/sv('rageper') * 0.5; }
function addRage(ent, amount){ if(ent) ent.rage = Math.min(100, (ent.rage||0) + amount); }

// ── BLADE BIND ───────────────────────────────────────────────────────────────
const BB = {
  active: false,
  contactSide: 0,   // +1 или -1 — с какой стороны был контакт (относительно лезвия attacker)
  contactTime: -1,
  attacker: null,   // кто атаковал (чтобы засечь его следующий удар)
  defender: null,
};

// ── BladeBind: блок БЕЗ ярости открывает окно. Если В ТЕЧЕНИЕ окна
// (sv('bbwindow') сек) у того же entity появляется ярость И происходит
// замах/удар (LMB или замах с ускорением) — срабатывает BladeBind.
// Не срабатывает мгновенно в момент блока даже если ярость уже активна —
// нужен отдельный последующий удар.
function bladeBind_onContact(entA, entB, nx, ny){
  const hasSwing = Math.abs(entA.vel) > sv('swthresh') || Math.abs(entB.vel) > sv('swthresh');
  if(!hasSwing) return;

  [entA, entB].forEach((ent, idx) => {
    const other = idx===0 ? entB : entA;
    // Блок без ярости — открываем окно для последующего удара
    if(ent.rageBuffEnd <= GameTime){
      ent._bbWait = GameTime + sv('bbwindow');
      ent._bbDefender = other;
    }
    // Если ярость уже активна — НЕ триггерим здесь.
    // Срабатывание только через bladeBind_checkSwing при следующем ударе.
  });
}



// ── ЕДИНАЯ СИСТЕМА ДЕБАФФОВ ─────────────────────────────────────────────
function applyDebuff(ent, type, duration, intensity) {
    // type: 'exhaust' | 'bladebind' | 'stun'
    // duration: длительность в секундах
    // intensity: 0-1 (сила эффекта)
    
    if (!ent) return;
    
    // Сбрасываем старый дебафф того же типа
    if (ent._debuffType === type) {
        // Продлеваем
    }
    
    ent._debuffType = type;
    ent._debuffUntil = GameTime + duration;
    ent._debuffIntensity = intensity || 1.0;
    ent._debuffActive = true;
    
    // Устанавливаем exhausted для совместимости со старым кодом
    if (type === 'exhaust') {
        ent.exhausted = duration;
        applyExhaust(ent, duration);
    } else if (type === 'bladebind') {
        applyBladeBind(ent, 2);
    }
    
    // Визуальный эффект
    const labels = {
        'exhaust': '😫 УСТАЛОСТЬ',
        'bladebind': '💥 BLADE BIND!',
        'stun': '⚡ ОГЛУШЕНИЕ'
    };
    const colors = {
        'exhaust': '#ffaa44',
        'bladebind': '#ffaa00',
        'stun': '#cc44ff'
    };
    
    if (type === 'bladebind') return;
    const c = entityBodyCenter(ent);
    hitFX.push({
        x: c.x, 
        y: c.y - 50, 
        t: labels[type] || '💫 ДЕБАФФ',
        life: 45, 
        big: true, 
        col: colors[type] || '#ff8844'
    });
}
// ── ПОЛУЧИТЬ МНОЖИТЕЛЬ СКОРОСТИ МЕЧА ОТ ДЕБАФФА ────────────────────────
function getDebuffSwordMult(ent) {
    if (!ent || !ent._debuffActive || (ent._debuffUntil || 0) < GameTime) {
        // Дебафф истёк
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
            // Обычная усталость - из слайдера
            return sv('exhswd2') * (1 - intensity * 0.3);
        case 'bladebind':
            // BladeBind - почти полная остановка
            return 0.03 * (1 - intensity * 0.5);
        case 'stun':
            // Оглушение - полная остановка
            return 0.01;
        default:
            return 1.0;
    }
}

// ── ПОЛУЧИТЬ ПРОЗРАЧНОСТЬ МЕЧА ОТ ДЕБАФФА ──────────────────────────────
function getDebuffAlpha(ent) {
    if (ent && isExhausted(ent)) return 0.3;
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
        case 'bladebind':
            return 0.2 + (1 - intensity) * 0.3;
        case 'stun':
            return 0.3;
        default:
            return 1.0;
    }
}

// ── ПОЛУЧИТЬ ТЕКСТ ДЕБАФФА ДЛЯ HUD ──────────────────────────────────────
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
            return '😫 УСТАЛОСТЬ ' + remaining.toFixed(1) + 's';
        case 'bladebind':
            return '💥 BLADE BIND ' + remaining.toFixed(1) + 's';
        case 'stun':
            return '⚡ ОГЛУШЕНИЕ ' + remaining.toFixed(1) + 's';
        default:
            return '';
    }
}
function triggerBladeBind(attacker, defender){
  if((BB._cd||0) > GameTime) return;
  BB._cd = GameTime + 1.0;
  attacker._bbWait = -1;
  const defC = entityBodyCenter(defender);
  const atkC = entityBodyCenter(attacker);

  const strikeAng = Math.atan2(defC.y - atkC.y, defC.x - atkC.x);
  const swingDir = attacker.vel > 0 ? -1 : 1;
  const openAng = strikeAng + Math.PI/2 * swingDir;
  const ellipseR = Math.max(csv('ex'), csv('ey')) * 1.5;
  defender.tpX = Math.cos(openAng) * ellipseR;
  defender.tpY = Math.sin(openAng) * ellipseR;
  defender.pvX = defender.tpX;
  defender.pvY = defender.tpY;
  
  // 💥 ОТСКОК МЕЧА
  const pushAngle = openAng + Math.PI/2 * (swingDir > 0 ? 1 : -1);
  const pushForce = 0.5 + Math.random() * 0.3;
  defender.pvX += Math.cos(pushAngle) * 25 * pushForce;
  defender.pvY += Math.sin(pushAngle) * 25 * pushForce;
  
  // 🔥 ЕДИНЫЙ ДЕБАФФ - BLADEBIND (2.5 сек, максимальная интенсивность)
  applyDebuff(defender, 'bladebind', 2, 1.0);
  applyBladeBind(defender, 2);
  
  // Шанс выбить оружие
  if(typeof disarmEntity==='function' && Math.random() < (sv('disarmchance')/100)){
    disarmEntity(defender);
    hitFX.push({x:defC.x, y:defC.y-70, t:'🗡 ВЫБИТО!', life:60, big:true, col:'#ff6644'});
  }
  
  // Blade Bind has no separate floating text; disbalance owns the status label.
  hitFX.push({x:defC.x, y:defC.y-35, t:(attacker.vel>0?'CW→CCW':'CCW→CW'), life:60, big:false, col:'#aaffaa'});
  FX_EFFECTS.push({type:'shieldwave', x:defC.x, y:defC.y, t:0, duration:30, angle:strikeAng, followEntity:defender});
  playSound('bladeblind');
}

// Вызывается при РЕАЛЬНОМ ударе/замахе (после открытия окна блоком).
// Срабатывает только если: окно открыто, есть активная ярость СЕЙЧАС,
// и это настоящий удар (vel выше порога — не воздушное кручение).
function bladeBind_checkSwing(ent){
  if((ent._bbWait||0) <= GameTime) return; // окно не открыто
  const hasRage = ent.rageBuffEnd > GameTime;
  if(!hasRage) return; // ярость должна быть активна именно в момент удара
  if(Math.abs(ent.vel) <= sv('swthresh')) return; // должен быть реальный удар
  const def = ent._bbDefender;
  if(!def) return;
  triggerBladeBind(ent, def);
  ent._bbWait = -1; // окно закрыто после использования
}

// ── СТИЛИ ВЛАДЕНИЯ МЕЧОМ (позиционирование без ЛКМ) ─────────────────────────
// Слайдеры: dist, ex, ey, blk, adaXb, adaXp; чекбоксы: adaY, adaD, ada12, adaX
const SWORD_STYLES = [
  { name:'Классика', dist:19, ex:21, ey:44, blk:0.2,  adaXb:40, adaXp:73, adaY:true, adaD:true,  ada12:false, adaX:false },
  { name:'Фехтовальщик', dist:9, ex:37, ey:40, blk:0.17, adaXb:0, adaXp:6, adaY:true, adaD:false, ada12:false, adaX:true },
];
window.SWORD_STYLE_IDX = 0;

// Применяет стиль к панели (меняет слайдеры и чекбоксы — влияет на игрока)
window.applySwordStyle = function(idx){
  const st = SWORD_STYLES[idx]; if(!st) return;
  window.SWORD_STYLE_IDX = idx;
  [['dist',st.dist],['ex',st.ex],['ey',st.ey],['blk',st.blk],['adaXb',st.adaXb],['adaXp',st.adaXp]].forEach(([id,v])=>{
    const el=document.getElementById('sl-'+id);
    // bubbles:true — обязателен: sv()/_slCache обновляются через делегированный
    // обработчик на document (см. выше), который слушает ВСПЛЫВАЮЩИЕ события.
    // Без bubbles:true событие не долетало до document, кэш не обновлялся,
    // и боевая логика (sv('dist') и т.п.) продолжала работать по старым
    // значениям — реально менялась только надпись "СТИЛЬ: ..." на экране.
    if(el){ el.value=v; el.dispatchEvent(new Event('input', {bubbles:true})); }
  });
  [['adaY',st.adaY],['adaD',st.adaD],['ada12',st.ada12],['adaX',st.adaX]].forEach(([id,v])=>{
    const cbEl=document.getElementById('cb-'+id);
    if(cbEl && cbEl.checked!==v){ cbEl.checked=v; cbEl.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  if(typeof hitFX!=='undefined'&&typeof P!=='undefined')
    hitFX.push({x:P.x,y:P.y-45,t:'СТИЛЬ: '+st.name,life:55,big:false,col:'#9ad0f0'});
};
window.toggleSwordStyle = function(){
  window.applySwordStyle((window.SWORD_STYLE_IDX+1)%SWORD_STYLES.length);
};

// Бот: свои значения стиля (не трогают панель)
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

// ── АПДЕЙТ ──────────────────────────────────────────────────────────────────
// ── СМЕРТЬ / ПОБЕДА / ПОРАЖЕНИЕ ─────────────────────────────────────────────
function resetPlayerState() {
    // 🗑️ УДАЛЯЕМ БРОШЕННОЕ ОРУЖИЕ
    if (typeof DROPPED_WEAPONS !== 'undefined') {
        DROPPED_WEAPONS.length = 0;
    }
    if (typeof PROJECTILES !== 'undefined') {
        PROJECTILES.length = 0;
    }
    
    // 🗑️ ОЧИЩАЕМ ЭФФЕКТЫ
    if (typeof WAND_PARTICLES !== 'undefined') WAND_PARTICLES.length = 0;
    if (typeof WAND_EXPLOSIONS !== 'undefined') WAND_EXPLOSIONS.length = 0;
    if (typeof MAGICSTAFF_CHARGE_FX !== 'undefined') MAGICSTAFF_CHARGE_FX.length = 0;
    if (typeof MAGICSTAFF_LIGHTNING_FX !== 'undefined') MAGICSTAFF_LIGHTNING_FX.length = 0;
    if (typeof MAGICSTAFF_GLOW_FX !== 'undefined') MAGICSTAFF_GLOW_FX.length = 0;
    if (typeof LIGHTNING_HIT_FX !== 'undefined') LIGHTNING_HIT_FX.length = 0;
    if (typeof BOW_TENSION_FX !== 'undefined') BOW_TENSION_FX.length = 0;
    if (typeof ARROW_SHATTER_FX !== 'undefined') ARROW_SHATTER_FX.length = 0;
    
    // 💪 СБРАСЫВАЕМ ИГРОКА
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
    P._bbWait = -1;
    P._bbDefender = null;
    P._rageTextShown = false;
    
    // 🛡️ СБРАСЫВАЕМ ДЕБАФФЫ ОТ ЩИТА
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
    
    // 🔥 СБРАСЫВАЕМ ФЛАГИ ВОССТАНОВЛЕНИЯ
    P._wasExhausted = false;
    P._recovering = false;
    P._recoverProgress = 0;
    P._recoverStartAngle = 0;
    P._recoverTargetAngle = 0;
    P._recoverDuration = 1.0;
    
    // 🌀 СБРАСЫВАЕМ ДЕБАФФЫ
    P._debuffActive = false;
    P._debuffType = null;
    P._debuffUntil = -1;
    P._debuffIntensity = 0;
    
    // ⚡ СБРАСЫВАЕМ ЗАРЯДКУ ОРУЖИЯ
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
    
    // 🗡️ ВОССТАНАВЛИВАЕМ ОРУЖИЕ, ЕСЛИ ВЫБИТО
    if (P.hasWeapon === false && typeof setWeapon === 'function') {
        setWeapon(P, P.weaponType || 0);
    }
    
    // 🛡️ СБРАСЫВАЕМ ЩИТ (опционально, если хотим сохранять щит — закомментировать)
    // P.shield = 0;
    // P._shieldFlipped = false;
    
    // 📍 ПОЗИЦИЯ — по умолчанию слева
    P.x = W * 0.15;
    P.y = H * 0.8;
}



const DEATH = { pDead: false, dDead: false, deathCross: [], fadeAlpha: 0, fadeIn: false, text: '', textCol: '#fff' };

// Смерть бойца при 1-10 ботах: если жив хотя бы один другой бот — этот просто
// выбывает из боя (небольшой эффект, без экрана победы). Полноценный
// triggerDeath (экран победы/поражения) вызывается только для последнего бота.
function handleCombatDeath(ent){
  if(ent === P){ triggerDeath(P, false); return; }
  if(!isBot(ent)) return;
  const aliveOthers = ALL_BOTS.filter(b=>b!==ent && b.hp>0);
  if(aliveOthers.length > 0){
    const bc = entityBodyCenter(ent);
    for(let i=0;i<8;i++) spawnBlood(bc.x, bc.y, Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4));
    DEATH.deathCross.push({x:bc.x, y:bc.y, timer:2.0, isBot:true});
    playSound('death');
    ent._defeated = true;
    ALL_BOTS.splice(ALL_BOTS.indexOf(ent), 1);
    if(ent === D){
      // "умный" бот пал — корона переходит ближайшему из живых
      const pC = entityBodyCenter(P);
      let best=null, bestDist=Infinity;
      for(const b of aliveOthers){
        const bcc = entityBodyCenter(b);
        const dd = Math.hypot(bcc.x-pC.x, bcc.y-pC.y);
        if(dd < bestDist){ bestDist = dd; best = b; }
      }
      if(best) switchSmartBot(best);
    }
  } else {
    triggerDeath(ent, true); // последний бот — полноценный конец боя
  }
}
function triggerDeath(ent, isBot){
  if(isBot && DEATH.dDead) return;
  if(!isBot && DEATH.pDead) return;
  const bc = entityBodyCenter(ent);
  for(let i=0;i<8;i++) spawnBlood(bc.x, bc.y, Math.cos(i*Math.PI/4), Math.sin(i*Math.PI/4));
  DEATH.deathCross.push({x:bc.x, y:bc.y, timer:2.0, isBot});
  DEATH.fadeAlpha = 0;
  DEATH.fadeIn = true;
  // Заморозка управления для обоих игроков
  if(typeof NET_SYNC!=='undefined'&&NET_SYNC.active) NET_CORE.send({type:'freeze'});
  playSound('death');

  const pvpActive = typeof NET_SYNC!=='undefined' && NET_SYNC.active;

  // Локальный ресет — всегда применяется к себе
    const localReset = (iWon)=>{
    // 🗑️ ЕДИНЫЙ СБРОС ИГРОКА
    resetPlayerState();
    
    // Победитель — слева, проигравший — справа
    if(pvpActive){
      P.x = iWon ? W*0.15 : W*0.82;
      P.y = H*0.6;
    } else {
      P.x = W*0.15;
      P.y = H*0.8;
    }
    
    if(dummyOn && !pvpActive){
      if(typeof applyBotCount==='function') applyBotCount();
      ALL_BOTS.forEach((b, idx)=>{
        // Сбрасываем состояние зарядки у ботов
        if(b._wandCharging) { b._wandCharging = false; if(b._wandChargeSoundObj) { try{b._wandChargeSoundObj.pause();}catch(e){} b._wandChargeSoundObj = null; } }
        if(b._magicCharging) { b._magicCharging = false; if(b._magicChargeSoundObj) { try{b._magicChargeSoundObj.pause();}catch(e){} b._magicChargeSoundObj = null; } }
        if(b._bowCharging) { b._bowCharging = false; if(b._bowTensionSound) { try{b._bowTensionSound.pause();}catch(e){} b._bowTensionSound = null; } }
        b.hp=100; b.stamina=100; b.rage=0;
        b._hadExhaustion=false; b.exhausted=0; b.unbalanced=0;
        b.vx=0; b.vy=0; b.vel=0;
        b._hitCD=-1;
        b._swingBlockCD=-1;
        b._blockSlow=-1;
		        // Сбрасываем дебаффы у ботов
        b._debuffActive = false;
        b._debuffType = null;
        b._debuffUntil = -1;
        b._debuffIntensity = 0;
        if(b.hasWeapon===false && typeof setWeapon==='function') setWeapon(b, b.weaponType);
        const ang = (idx/ALL_BOTS.length)*Math.PI*2;
        const bx = clamp(W/2+110+Math.cos(ang)*140, 60, W-100);
        const by = clamp(H/2+Math.sin(ang)*140, 60, H-60);
        if(typeof assignRandomSkin==='function') assignRandomSkin(b);
        if(typeof placeBotPendingReveal==='function') placeBotPendingReveal(b, bx, by);
        else { b.x = bx; b.y = by; }
        // Сбрасываем флаги восстановления у ботов
        b._wasExhausted = false;
        b._recovering = false;
        b._recoverProgress = 0;
      });
      D = ALL_BOTS[0];
      AI = D._aiState;
    }
    DEATH.dDead=false; DEATH.pDead=false;
    DEATH.fadeIn=false; DEATH.text='';
  };

  if(isBot){
    // D умер — мы победили. ТОЛЬКО победитель шлёт reset.
    DEATH.dDead = true;
    DEATH.text = '🏆 ПОБЕДА!';
    DEATH.textCol = '#ffdd44';
    playSound('whooshRage');
    playSound('victory');
    if(typeof addWin==='function' && !(typeof NET_SYNC!=='undefined'&&NET_SYNC.active)) addWin(false); // локально
    setTimeout(()=>{
      localReset(true); // победитель → влево
      if(pvpActive) NET_SYNC.sendReset(true);
    }, 2000);
  } else {
    // P умер — мы проиграли. Ждём reset от победителя.
    // Если за 3 сек не пришёл — делаем сами.
    DEATH.pDead = true;
    DEATH.text = '💀 ПОРАЖЕНИЕ';
    DEATH.textCol = '#ff6060';
    if(typeof addWin==='function' && !(typeof NET_SYNC!=='undefined'&&NET_SYNC.active)) addWin(true); // локально
    if(pvpActive){
      // Не шлём reset — победитель пришлёт
      // Но на случай потери пакета — fallback через 3.5 сек
      setTimeout(()=>{
        if(DEATH.pDead){ // если ещё не сбросили
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
  // Затемнение + текст победы/поражения
  if(DEATH.fadeIn || DEATH.fadeAlpha > 0){
    if(DEATH.fadeIn) DEATH.fadeAlpha = Math.min(0.78, DEATH.fadeAlpha + 0.022);
    else DEATH.fadeAlpha = Math.max(0, DEATH.fadeAlpha - 0.03);
    ctx.fillStyle = `rgba(0,0,0,${DEATH.fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);
    // Жирный текст по центру
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

// Оранжевая кнопка — переключение блок-отбрасывания
let blockKnockOn = false;

// ── КЛАЦ: отскок мечей ────────────────────────────────────────────────────────
function doClash(entA, entB, res, strongSwing){
  const ang = Math.atan2(entB.y - entA.y, entB.x - entA.x);
  // Определяем кто атакующий (у кого больше atkPts)
  const atkr = entA.isAttacker ? entA : entB;
  const defr = entA.isAttacker ? entB : entA;
  // Отклонение лезвия защищающегося: 5-30° в зависимости от силы удара (vel атакующего)
  const atkForce = Math.abs(atkr.vel);
  const deflectDeg = Math.min(getDynamicDeflectMax(), sv('deflectMin') + atkForce * 20);
  const deflectRad = deflectDeg * Math.PI / 180;

  // ── Направление отскока ────────────────────────────────────────────────
  // ВАЖНО: нельзя определять сторону через нормаль отрезка (px-qx,py-qy) —
  // у отрезка (линии) нет "лица" и "спины", поэтому такая нормаль симметрична
  // относительно поворота на 180° и на половине оборота лезвия защищающегося
  // даёт противоположный (неверный) знак.
  // Вместо этого берём РЕАЛЬНОЕ направление лезвия защищающегося (defr.angle) —
  // оно однозначно (от рукояти к острию), т.е. не симметрично на 360°.
  // Точка удара — ближайшая точка на клинке атакующего к клинку защищающегося.
  const defDirX = Math.cos(defr.angle), defDirY = Math.sin(defr.angle);
  const pivDefr = entityPivot(defr);
  let hitX, hitY;
  
   // 🔥 БАФФ "NO SLOW" — после блока (клэша) на 2 секунды отключаем разгон
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
  // Кросс-произведение направления лезвия защищающегося и вектора к точке удара.
  // Знак кросс-произведения не зависит от симметрии линии — только от того,
  // с какой стороны от лезвия (если смотреть от рукояти к острию) находится удар.
  const cross = defDirX*relY - defDirY*relX;
  // cross > 0 → удар пришёлся с одной стороны лезвия → по часовой (+1)
  // cross < 0 → удар пришёлся с другой стороны → против часовой (-1)
  const deflectDir = cross >= 0 ? -1 : 1;
  defr.angle += deflectDir * deflectRad;
  defr.vel += deflectDir * deflectRad * 4;

  // ── ДЕБАГ: направление отскока от удара игрока (только консоль) ───────────
  if(typeof document!=='undefined' && cb('clashdbg')
     && typeof P!=='undefined' && atkr===P){
    const dirTxt = deflectDir > 0 ? 'ПО ЧАСОВОЙ' : 'ПРОТИВ ЧАСОВОЙ';
    console.log(`[CLASH DEBUG] Отскок: ${dirTxt} | cross=${cross.toFixed(3)} | defr.angle=${(defr.angle*180/Math.PI).toFixed(1)}° | hitX=${hitX.toFixed(1)}, hitY=${hitY.toFixed(1)} | pivDefr=(${pivDefr.x.toFixed(1)},${pivDefr.y.toFixed(1)}) | atkr.vel=${atkr.vel.toFixed(2)}`);
  }

  // Отскок мечей: атакующий — сильно назад, defender — слабее назад
  // "Назад" = против текущего направления вращения
  const atkSign = atkr.vel >= 0 ? 1 : -1; // +1 = по часовой
  atkr.vel = clamp(-atkSign * 3.0, -8, 8);  // реверс направления
  defr.vel = clamp(-atkSign * 1.5, -8, 8);  // defender тоже реверс

  // Отталкивание — по вектору от тела к телу (надёжнее чем по нормали меча)
  // ±30° случайный разброс чтобы не было всегда перпендикулярно
  const push = Math.min(sv('bladeKB'), 25);
  if(push > 0){
    const bodyLen = Math.hypot(entB.x-entA.x, entB.y-entA.y) || 1;
    const bodyAng = Math.atan2(entB.y-entA.y, entB.x-entA.x);
    // Подмешиваем направление меча атакующего для +реализм (±30°)
    const swordBias = Math.atan2(
      Math.sin(atkr.angle)*0.5, Math.cos(atkr.angle)*0.5
    );
    const finalAng = bodyAng + clamp(angDiff(swordBias, bodyAng), -Math.PI/6, Math.PI/6);
    const pushX = Math.cos(finalAng), pushY = Math.sin(finalAng);
    // Separate knockback impulse cannot be overwritten by held movement.
    entA._dvx = (entA._dvx || 0) - pushX*push;
    entA._dvy = (entA._dvy || 0) - pushY*push;
    entB._dvx = (entB._dvx || 0) + pushX*push;
    entB._dvy = (entB._dvy || 0) + pushY*push;
    entA._moveLockUntil = Math.max(entA._moveLockUntil || 0, GameTime + 0.35);
    entB._moveLockUntil = Math.max(entB._moveLockUntil || 0, GameTime + 0.35);
  }

// Блок-отбрасывание если включено
  if(blockKnockOn){
    const bkb = sv('blockKB');
    // Атакованный (defender) летит ОТ атакующего
    const atkr = entA.isAttacker ? entA : entB;
    const defr = entA.isAttacker ? entB : entA;
    const bkAng = Math.atan2(defr.y-atkr.y, defr.x-atkr.x);
    // ── Используем _dvx/_dvy (тот же механизм, что и у доджа) вместо
    // прямой добавки к vx/vy ──────────────────────────────────────────
    // vx/vy каждый кадр пересчитываются через lerpDT() от текущего ввода
    // движения (WASD у игрока / ai._fakeKeys у бота) — если персонаж в
    // момент клэша продолжает жать движение, lerpDT почти мгновенно
    // "перетягивает" скорость обратно к вводу и одноразовая += к vx/vy
    // гасится за один-два тика, не успев сдвинуть персонажа. _dvx/_dvy —
    // отдельный импульс, который применяется ПОВЕРХ обычного движения
    // (см. блок "Применяем dodge impulse" в update()/updateDummy()) и
    // затухает сам по экспоненте, поэтому не может быть мгновенно
    // перебит зажатой клавишей.
    const _defrKick = bkb + sv('kbforce')*0.3;
    defr._dvx = (defr._dvx||0) + Math.cos(bkAng)*_defrKick;
    defr._dvy = (defr._dvy||0) + Math.sin(bkAng)*_defrKick;
    const _atkrKick = (bkb + sv('kbforce')*0.3) * 0.5;
    atkr._dvx = (atkr._dvx||0) - Math.cos(bkAng)*_atkrKick;
    atkr._dvy = (atkr._dvy||0) - Math.sin(bkAng)*_atkrKick;
    // Стан-лок движения: на 0.5 сек полностью глушим реакцию на
    // WASD/AI-ввод, иначе _dvx/_dvy просто СУММИРУЕТСЯ с обычным
    // ускорением от зажатой клавиши, и толчок ощущается как "поехал чуть
    // медленнее", а не как настоящий отскок назад.
    defr._moveLockUntil = GameTime + 0.5;
    atkr._moveLockUntil = GameTime + 0.5;
  }

  // Эффект: молния + КЛАЦ
  hitFX.push({x:hitX, y:hitY-4, t:'⚡', life:12, big:true, col:'#ffffff'});
  hitFX.push({x:hitX, y:hitY+14, t:'КЛАЦ!', life:35, big:false, col:'#ccccaa'});
  // strongSwing передаётся как параметр
  if(strongSwing && Math.random() < 0.04) spawnFX('flash', hitX, hitY);
  // Cross FX только при настоящем замахе
  if(strongSwing){
    spawnFX('cross', hitX, hitY);
  }
  // Замедление обоих при блоке
  const sld = sv('blockSlowDur');
  if(sld > 0){
    entA._blockSlow = GameTime + sld;
    entB._blockSlow = GameTime + sld;
  }
  // Отключаем детект замаха на 0.25 сек (блок резко отклоняет меч)
  entA._swingBlockCD = GameTime + 0.25;
  entB._swingBlockCD = GameTime + 0.25;
}



function shieldCenter(ent, cursorX){
  const c = entityBodyCenter(ent);
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


// ── КОЛЛИЗИЯ ЩИТ vs МЕЧ ─────────────────────────────────────────────────────
// Возвращает true если меч attacker попал по щиту defender и заблокирован
function checkShieldVsBlade(attacker, defender, bx1,by1, tx1,ty1){
  const def = shieldDef(defender);
  if(!def) return false;
  if(DEATH.pDead || DEATH.dDead) return false;

  // При LMB атаке щит не работает (жезл/арбалет в счёт не идут — это не замах)
  const lmbActive = (defender===P) ? (mDown && !isRangedWeapon(defender) && weaponKeyOf(defender) !== 'flail') : false;
  if(lmbActive) return false;
  if(defender._shieldAlpha < 0.5) return false;

  const curX = (defender===P) ? (typeof mX!=='undefined'?mX:W/2)
                               : (typeof P!=='undefined'?P.x:W/2);
  const sc = shieldCenter(defender, curX);
  if(!sc) return false;

  // Пересчитываем размер щита напрямую — не зависим от drawShield
  const _cDef = shieldDef(defender);
  const _cH = CHAR_SPRITE_H * sv('cscl') * 1.2 * (_cDef?_cDef.scale:1);
  const _cW = _cH * 0.75; // fallback aspect ratio
  const shW = (defender._shieldW>0 ? defender._shieldW : _cW);
  const shH = (defender._shieldH>0 ? defender._shieldH : _cH);
  // Башенный щит — чуть шире коллайдер
  const shWfinal = (defender.shield===3) ? shW*1.2 : shW;
  // Простая AABB для щита (немного упрощённо)
  const left=sc.x-shWfinal/2, right=sc.x+shWfinal/2;
  const top=sc.y-shH/2, bot=sc.y+shH/2;
  // debug коллайдер (раскомментировать при отладке)
  // ctx.strokeStyle='#f00'; ctx.strokeRect(left,top,shWfinal,shH);

  // Проверяем пересечение отрезка меча с прямоугольником щита
  // (используем общий segmentIntersectsRect из MODULE: MATH HELPERS —
  // раньше здесь была локальная копия той же логики)
  if(!segmentIntersectsRect(bx1,by1,tx1,ty1, left,top,right,bot)) return false;

  // Попадание по щиту
  const mx=(bx1+tx1)/2, my2=(by1+ty1)/2;
  applyShieldBlockFX(mx, my2, attacker, defender, {hitstopMag:3, waveDuration:22, unbalanceAmt:1.2, textLife:35});
  const _bvx=(tx1-bx1), _bvy=(ty1-by1), _bl=Math.hypot(_bvx,_bvy)||1;
  attacker.vx -= _bvx/_bl*4;
  attacker.vy -= _bvy/_bl*4;
  // 10% шанс bladeblind атакующего
  if(Math.random()<0.10 && typeof triggerBladeBind==='function'){
    triggerBladeBind(defender, attacker);
    hitFX.push({x:mx,y:my2-25,t:'BIND!',life:40,big:false,col:'#ffcc44'});
  }
  return true;
}

// ── ЦИКЛ ────────────────────────────────────────────────────────────────────
// (lastT/GameTime/RealTime/rawDt перенесены в ЯДРО ДВИЖКА в начало файла —
// это общее игровое время, читается практически всеми модулями)

// ── Детектор флик-замаха (быстрое туда-сюда курсором) ────────────────────
// Работает через GameTime (не FPS-зависимо): накапливает угловую скорость
// за реальное время, детектит пик и смену направления.
const FLICK = {
  prevSwordAngle: null, // P.angle предыдущего кадра (для realAngVel)
  curDir: 0,        // направление текущего маха
  curAmp: 0,        // накопленная амплитуда текущего маха
  swings: [],       // история завершённых махов: {time, amp}
};

// ── Детектор орбиты меча (вращение вокруг себя без ЛКМ) ─────────────────
const ORBIT = {
  accumAngle: 0,   // накопленный угол (рад)
  lastAngle: null,
  windowStart: -1,
  lastDir: 0,
};

function updateOrbitDetect(swordAngle, rawDt) {
  if (!cb('orbitdet')) return false;
  if (mDown) { ORBIT.accumAngle = 0; ORBIT.lastAngle = null; ORBIT.lastDir = 0; return false; }
  
  // ✅ БЕЗ ОРУЖИЯ — НЕТ ОРБИТЫ
  if (P.hasWeapon === false) return false;

  if (ORBIT.lastAngle === null) { ORBIT.lastAngle = swordAngle; ORBIT.windowStart = RealTime; return false; }

  const orbitWindow = sv('orbitwindow');
  const minTurns = sv('orbitturns');

  if (RealTime - ORBIT.windowStart > orbitWindow) {
    ORBIT.accumAngle = 0; ORBIT.lastAngle = swordAngle;
    ORBIT.windowStart = RealTime; ORBIT.lastDir = 0;
    return false;
  }

  const dAng = angDiff(swordAngle, ORBIT.lastAngle);
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

// Детект серии быстрых махов туда-сюда: >= flickCount маха за flickWindow
// секунд, каждый мах с |realAngVel| > flickMinVel и амплитудой
// flickMinAmp <= amp <= flickMinAmp*flickmaxmult (откалибровано в FlickTest.html:
// flickcount=2, flickmaxmult=5 — "идеально").
// curAngle здесь — уже realAngVel (рад/сек), посчитанный снаружи с клампом шага.
function updateFlickDetect(realAngVel, rawDt) {
  if (!cb('flickdet')) return false;
if (weaponKeyOf(P) === 'flail' && P._flailExt < 0.97) return false;
  const flickWindow  = sv('flickwindow');
  const flickMinVel  = sv('flickminvel');
  const flickMinAmp  = sv('flickminamp');
  const flickMaxMult = sv('flickmaxmult');
  const flickCount   = sv('flickcount');

  const dir = Math.sign(realAngVel);
  const fastEnough = Math.abs(realAngVel) > flickMinVel;

  // Убираем устаревшие махи из истории (старше flickWindow)
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

  // Смена направления — завершаем текущий мах.
  if (FLICK.curAmp >= flickMinAmp && FLICK.curAmp <= flickMinAmp * flickMaxMult) {
    FLICK.swings.push({ time: RealTime, amp: FLICK.curAmp });
  } else if (FLICK.curAmp > flickMinAmp * flickMaxMult) {
    // Слишком широкий мах — сбрасывает серию
    FLICK.swings = [];
  }
  // amp < flickMinAmp — слишком мелкое движение, игнорируем без сброса

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

// ──────────────── END LAYER: COMBAT ────────────────

// ════════════════════════════════════════════════════════════════════════════
