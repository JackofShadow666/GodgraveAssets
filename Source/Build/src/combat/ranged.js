// === src/combat/ranged.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: RANGED WEAPONS — жезл и арбалет (снаряды, зарядка, AI стрельбы)
// Module file: ranged.js
// ════════════════════════════════════════════════════════════════════════════

// ── Настройки жезла ──
// WAND_CHARGE_TIME — запасное значение, если в WeaponTalbe.txt не задано поле chargeTime.
const WAND_CHARGE_TIME = 0.5;   // сек подготовки перед выстрелом (герой не двигается)
const WAND_PROJ_SPEED  = 13;    // скорость магического снаряда, px/кадр
const WAND_BASE_DMG    = 20;    // базовый урон, множится на 1x..2x от ярости
const WAND_SHOT_CD     = 0.35;  // пауза после выстрела перед след. накоплением
const WAND_MAX_DMG_PCT = 0.25;  // потолок урона за попадание (% от MAX_HP цели)

// Время накопления заряда жезла — берётся из WeaponTalbe.txt (поле chargeTime),
// если не задано — используется WAND_CHARGE_TIME.
function wandChargeTimeFor(ent){
  const d = weaponDefFor(ent);
  return (d && d.chargeTime != null) ? d.chargeTime : WAND_CHARGE_TIME;
}


// ── Настройки магического посоха ──
const MAGICSTAFF_CHARGE_FULLTIME = 1.5;   // сек до полной зарядки
const MAGICSTAFF_CHARGE_MINTIME  = 0.4;   // сек до первого выстрела

const MAGICSTAFF_DMG_MIN = 20;        // до 2 сек урона нет
const MAGICSTAFF_DMG_MAX = 50;       // макс урон как у жезла
const MAGICSTAFF_RADIUS = 280;        // радиус взрыва (2 посоха)
const MAGICSTAFF_KB_FORCE = 15;       // сила отбрасывания
const MAGICSTAFF_SHOT_CD = 1.0;       // кулдаун после взрыва
const MAGICSTAFF_STAMINADRAIN =2.5;  // расход стамины в сек

// ── Эффекты магического посоха ──

let MAGICSTAFF_CHARGE_FX = [];
let MAGICSTAFF_LIGHTNING_FX = [];
let MAGICSTAFF_GLOW_FX = [];


// ── Настройки арбалета ──
const CROSSBOW_PROJ_SPEED = 25;  // скорость стрелы, px/кадр (в 2 раза медленнее прежней)
const CROSSBOW_DMG_MIN    = 20;
const CROSSBOW_DMG_MAX    = 56;
const CROSSBOW_RELOAD     = 1.6;  // сек между выстрелами (перезарядка в 1.5 раза медленнее прежней)
const CROSSBOW_MAX_DMG_PCT= 0.45;
// ── Настройки лука ──
const BOW_PROJ_SPEED = 15;    // скорость стрелы, px/кадр (чуть быстрее арбалета)
const BOW_DMG_MIN    = 4;
const BOW_DMG_MAX    = 50;
const BOW_RELOAD     = 1.0;   // сек между выстрелами (1 сек натяжение)
const BOW_MAX_DMG_PCT= 0.35;  // потолок урона


// Шанс, с которым БОТ уворачивается от снаряда (жезл/арбалет) в момент попадания.
const PROJECTILE_DODGE_CHANCE = 0.15;
// Шанс, с которым БОТ проактивно уворачивается ЗАРАНЕЕ, увидев летящий в него снаряд.
const PROJECTILE_PREDODGE_CHANCE = 0.25;

let PROJECTILES = []; // {kind:'wand'|'arrow', x,y,vx,vy,rot,owner,dmg,ownerImmuneUntil,bornAt,fade,img}
let WAND_PARTICLES = []; // {x,y,tx,ty,life,maxLife,owner} — синие частицы, стягивающиеся к наконечнику жезла во время накопления

// Выстрел: сохраняет либо готовый урон (жезл — уже умноженный на ярость),
// либо диапазон, который был рассчитан заранее (арбалет — 5..20 при выстреле).
function spawnProjectile(owner, kind, angle, dmg, speedOverride, maxDmgPct){
  const c = weaponTipPos(owner);
  
  let speed;
  if (speedOverride !== undefined) {
    speed = speedOverride;
  } else if (kind === 'wand') {
    speed = WAND_PROJ_SPEED;
  } else {
    speed = CROSSBOW_PROJ_SPEED;
  }
  
  // 🔥 СОХРАНЯЕМ maxDmgPct
  const maxPct = maxDmgPct || (kind === 'wand' ? WAND_MAX_DMG_PCT : CROSSBOW_MAX_DMG_PCT);
  
  PROJECTILES.push({
    kind, x: c.x, y: c.y,
    vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
    rot: angle, owner, dmg,
    maxDmgPct: maxPct,
    ownerImmuneUntil: GameTime + 0.15,
    bornAt: GameTime,
    // 🔥 ДЛЯ МОЛНИИ — запоминаем позицию стрелка
    shooterPos: {x: c.x, y: c.y},
  });
  hitFX.push({x:c.x, y:c.y-30, t: kind==='wand' ? '✨' : '🏹', life:20, big:false, col: kind==='wand'?'#c090ff':'#d9c08a'});
}





// ── Частицы накопления жезла: синие искры притягиваются к кончику ──────────
// Вызывается каждый кадр, пока ent._wandCharging === true.
function updateWandChargeParticles(dt, ent){
  const tip = weaponTipPos(ent);
  // Периодически спавним новые частицы вокруг персонажа
  ent._wandParticleSpawnCD = (ent._wandParticleSpawnCD||0) - dt;
  if(ent._wandParticleSpawnCD <= 0){
    ent._wandParticleSpawnCD = 0.02;
    const c = entityBodyCenter(ent);
    const a = Math.random()*Math.PI*2;
    const r = 30 + Math.random()*40;
    WAND_PARTICLES.push({
      x: c.x + Math.cos(a)*r, y: c.y + Math.sin(a)*r - 10,
      owner: ent, life: 1, maxLife: 1,
    });
  }
  // Двигаем существующие частицы этого владельца к текущему кончику жезла
  for(const p of WAND_PARTICLES){
    if(p.owner !== ent) continue;
    p.x += (tip.x - p.x) * clamp(dt*6, 0, 1);
    p.y += (tip.y - p.y) * clamp(dt*6, 0, 1);
    p.life -= dt*1.6;
  }
}
function updateWandParticles(dt){
  for(let i = WAND_PARTICLES.length-1; i >= 0; i--){
    const p = WAND_PARTICLES[i];
    if(!p.owner || p.owner.hp <= 0 || !p.owner._wandCharging || p.life <= 0){
      WAND_PARTICLES.splice(i,1);
    }
  }
}
function drawWandParticles(){
  for(const p of WAND_PARTICLES){
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const grad = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,5);
    grad.addColorStop(0,'rgba(200,225,255,0.95)');
    grad.addColorStop(1,'rgba(90,140,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ── Взрыв снаряда жезла: синие частицы разлетаются в разные стороны ────────
let WAND_EXPLOSIONS = []; // {x,y,vx,vy,life,maxLife,r}
function spawnWandExplosion(x, y){
  const n = 16;
  for(let i = 0; i < n; i++){
    const a = (Math.PI*2*i/n) + (Math.random()-0.5)*0.5;
    const spd = 2.5 + Math.random()*4.5;
    WAND_EXPLOSIONS.push({
      x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
      life: 1, maxLife: 1, r: 3 + Math.random()*3,
    });
  }
}
function updateWandExplosions(dt){
  for(let i = WAND_EXPLOSIONS.length-1; i >= 0; i--){
    const p = WAND_EXPLOSIONS[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.90; p.vy *= 0.90;
    p.life -= dt*2.4;
    if(p.life <= 0) WAND_EXPLOSIONS.splice(i,1);
  }
}
function drawWandExplosions(){
  for(const p of WAND_EXPLOSIONS){
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const grad = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.4);
    grad.addColorStop(0,'rgba(210,230,255,0.95)');
    grad.addColorStop(0.55,'rgba(120,160,255,0.55)');
    grad.addColorStop(1,'rgba(90,130,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2.4*a+1,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}



function fxDrawMagicExplosion(ctx, p, x, y, radius){
  const prog = 1 - p;
  const r = radius * (0.2 + prog * 0.8);
  
  ctx.save();
  ctx.globalAlpha = p * 0.6;
  
  // Внешнее кольцо
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, 'rgba(200, 240, 255, 0)');
  grad.addColorStop(0.3, `rgba(150, 220, 255, ${p * 0.3})`);
  grad.addColorStop(0.7, `rgba(80, 180, 255, ${p * 0.2})`);
  grad.addColorStop(1, 'rgba(40, 120, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  
  // Белое свечение в центре
  const innerGrad = ctx.createRadialGradient(x, y, 0, x, y, r * 0.3);
  innerGrad.addColorStop(0, `rgba(255, 255, 255, ${p * 0.5})`);
  innerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}



function drawMagicStaffRadius(ent){
  if(!ent._magicCharging) return;
  
  const c = entityBodyCenter(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  
  // Только после 1.5 сек показываем радиус
  const chargeTime = GameTime - ent._magicChargeStart;
  if(chargeTime < 1.5) return;
  
  const alpha = (chargeTime - 1.5) / 0.5 * 0.3;
  const pulse = 0.8 + 0.2 * Math.sin(GameTime * 3);
  
  ctx.save();
  ctx.globalAlpha = Math.min(0.3, alpha * pulse);
  

  
  // Внутреннее кольцо (пульсирующее)
  const innerRadius = radius * (0.7 + 0.3 * Math.sin(GameTime * 2));
  ctx.strokeStyle = 'rgba(150, 220, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.x, c.y, innerRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Метки по краям (показывают направление)
  for(let i = 0; i < 8; i++){
    const angle = (i / 8) * Math.PI * 2 + GameTime * 0.2;
    const x = c.x + Math.cos(angle) * radius;
    const y = c.y + Math.sin(angle) * radius;
    const size = 3 + 2 * Math.sin(GameTime * 4 + i);
    ctx.fillStyle = `rgba(100, 200, 255, ${0.3 * alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}


function spawnMagicStaffGlow(ent){
  const tip = weaponTipPos(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  
  // Мерцание (синус + случайность)
  const flicker = 0.7 + 0.3 * Math.sin(GameTime * 15 + ent._magicSeed || 0);
  const size = 5 + progress * 25 * flicker;
  const alpha = 0.3 + progress * 0.6 * flicker;
  
  MAGICSTAFF_GLOW_FX.push({
    x: tip.x,
    y: tip.y,
    size: size,
    alpha: alpha,
    life: 1,
    maxLife: 0.1,
  });
}

function updateMagicStaffGlow(dt){
  const arr = MAGICSTAFF_GLOW_FX;
  for(let i = arr.length - 1; i >= 0; i--){
    arr[i].life -= dt / arr[i].maxLife;
    if(arr[i].life <= 0){
      // Порядок частиц не важен — удаление свапом с последним элементом
      // вместо splice() дешевле (O(1) вместо сдвига всего хвоста массива).
      arr[i] = arr[arr.length - 1];
      arr.pop();
    }
  }
}







function drawMagicStaffGlow(){
  for(const g of MAGICSTAFF_GLOW_FX){
    const a = g.life * g.alpha;
    if(a < 0.01) continue;
    
    // 🔥 ПРОВЕРКА НА КОРРЕКТНЫЕ ЗНАЧЕНИЯ
    if(!isFinite(g.x) || !isFinite(g.y) || !isFinite(g.size) || g.size <= 0) continue;
    
    ctx.save();
    ctx.globalAlpha = a;
    
    // Свечение на кончике
    try {
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.size);
      grad.addColorStop(0, 'rgba(200, 240, 255, 0.95)');
      grad.addColorStop(0.2, 'rgba(150, 220, 255, 0.7)');
      grad.addColorStop(0.5, 'rgba(80, 180, 255, 0.4)');
      grad.addColorStop(1, 'rgba(40, 120, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
      ctx.fill();
    } catch(e) {
      // Если градиент не создался — рисуем простой круг
      ctx.fillStyle = `rgba(100, 200, 255, ${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, Math.max(1, g.size * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Яркая точка в центре
    ctx.shadowColor = 'rgba(150, 220, 255, 0.9)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(220, 245, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(g.x, g.y, Math.max(1, g.size * 0.15), 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

function spawnMagicStaffLightning(ent){
  const c = entityBodyCenter(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const numBolts = 3 + Math.floor(progress * 5); // 3-8 молний
  
  for(let i = 0; i < numBolts; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + progress * 80 + Math.random() * 40;
    const startX = c.x + Math.cos(angle) * dist;
    const startY = c.y + Math.sin(angle) * dist - 10;
    
    // Создаём зигзаг (молнию) с несколькими сегментами
    const segments = 3 + Math.floor(progress * 3);
    let points = [{x: startX, y: startY}];
    let currentX = startX, currentY = startY;
    
    for(let s = 0; s < segments; s++){
      const t = (s + 1) / segments;
      const targetX = c.x + Math.cos(angle) * dist * (1 - t * 0.9);
      const targetY = c.y + Math.sin(angle) * dist * (1 - t * 0.9) - 10;
      // Зигзаг: отклонение в сторону
      const perpAngle = angle + Math.PI/2;
      const jitter = (Math.random() - 0.5) * 15 * (1 - t * 0.5);
      currentX = targetX + Math.cos(perpAngle) * jitter;
      currentY = targetY + Math.sin(perpAngle) * jitter;
      points.push({x: currentX, y: currentY});
    }
    
    MAGICSTAFF_LIGHTNING_FX.push({
      points: points,
      life: 1,
      maxLife: 0.15 + progress * 0.15,
      alpha: 0.3 + progress * 0.5,
      width: 1 + progress * 3,
      owner: ent,
    });
  }
}

function updateMagicStaffLightning(dt){
  const arr = MAGICSTAFF_LIGHTNING_FX;
  for(let i = arr.length - 1; i >= 0; i--){
    const bolt = arr[i];
    bolt.life -= dt / bolt.maxLife;
    if(bolt.life <= 0){
      arr[i] = arr[arr.length - 1];
      arr.pop();
    }
  }
}

function drawMagicStaffLightning(){
  for(const bolt of MAGICSTAFF_LIGHTNING_FX){
    const a = bolt.life * bolt.alpha;
    if(a < 0.01) continue;
    
    ctx.save();
    ctx.globalAlpha = a;
    
    const points = bolt.points;
    // Основная линия молнии
    ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#88ddff';
    ctx.lineWidth = bolt.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i = 1; i < points.length; i++){
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    
    // Яркая внутренняя линия (белая)
    ctx.shadowBlur = 20;
    ctx.strokeStyle = 'rgba(200, 240, 255, 0.6)';
    ctx.lineWidth = bolt.width * 0.4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i = 1; i < points.length; i++){
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    
    ctx.restore();
  }
}


function spawnMagicStaffChargeFX(ent){
  if(!ent || !ent._magicCharging) return;
  
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const c = entityBodyCenter(ent);
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  const count = 3 + Math.floor(progress * 5);
  
  for(let i = 0; i < count; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.3 + Math.random() * 0.7);
    const speed = 0.5 + progress * 2;
    
    // 🔥 УБЕДИТЕСЬ, ЧТО ВСЕ ЗНАЧЕНИЯ — ЧИСЛА
    const x = c.x + Math.cos(angle) * dist * 0.2;
    const y = c.y + Math.sin(angle) * dist * 0.2 - 10;
    const targetX = c.x + Math.cos(angle) * dist;
    const targetY = c.y + Math.sin(angle) * dist - 10;
    const r = 2 + progress * 4 + Math.random() * 3;
    
    // Проверка на NaN
    if(!isFinite(x) || !isFinite(y) || !isFinite(targetX) || !isFinite(targetY) || !isFinite(r)) continue;
    
    MAGICSTAFF_CHARGE_FX.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed * 0.5,
      vy: Math.sin(angle) * speed * 0.5 - 0.5,
      life: 1,
      maxLife: 0.8 + Math.random() * 0.4,
      r: r,
      alpha: 0.3 + progress * 0.5,
      targetX: targetX,
      targetY: targetY,
      type: 'charge'
    });
  }
}

function updateMagicStaffChargeFX(dt){
  const arr = MAGICSTAFF_CHARGE_FX;
  for(let i = arr.length - 1; i >= 0; i--){
    const p = arr[i];
    p.life -= dt / p.maxLife;
    // Движение к цели
    p.x += (p.targetX - p.x) * dt * 2;
    p.y += (p.targetY - p.y) * dt * 2;
    p.alpha *= 0.995;
    if(p.life <= 0 || p.alpha < 0.01){
      // Порядок не важен для рендера частиц — свап с последним даёт O(1)
      // удаление вместо splice(), который сдвигает весь хвост массива.
      arr[i] = arr[arr.length - 1];
      arr.pop();
    }
  }
}



function spawnMagicStaffRadiusParticles(ent){
  const c = entityBodyCenter(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  
  // Количество частиц увеличивается с прогрессом (меньше на мобиле — тяжёлый эффект)
  const count = window.IS_MOBILE ? 1 + Math.floor(progress * 2) : 2 + Math.floor(progress * 4);
  
  for(let i = 0; i < count; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.6 + Math.random() * 0.4);
    const speed = 0.5 + progress * 1.5;
    
    // Частица летит по радиусу наружу (от центра к краю)
    const outwardAngle = angle;
    const vx = Math.cos(outwardAngle) * speed * (0.3 + Math.random() * 0.3);
    const vy = Math.sin(outwardAngle) * speed * (0.3 + Math.random() * 0.3);
    
    MAGICSTAFF_CHARGE_FX.push({
      x: c.x + Math.cos(angle) * dist * 0.1,
      y: c.y + Math.sin(angle) * dist * 0.1 - 10,
      vx: vx,
      vy: vy,
      life: 1,
      maxLife: 0.6 + progress * 0.4 + Math.random() * 0.3,
      r: 1.5 + progress * 3 + Math.random() * 2,
      alpha: 0.3 + progress * 0.5,
      targetX: c.x + Math.cos(angle) * dist,
      targetY: c.y + Math.sin(angle) * dist - 10,
      type: 'charge'
    });
  }
}


function drawMagicStaffChargeFX(){
  // Сначала обновляем позиции частиц
  for(const p of MAGICSTAFF_CHARGE_FX){
    if(p.targetX !== undefined && p.targetY !== undefined){
      p.x += (p.targetX - p.x) * 0.05;
      p.y += (p.targetY - p.y) * 0.05;
    }
    if(p.vx !== undefined && p.vy !== undefined){
      p.x += p.vx * 0.05;
      p.y += p.vy * 0.05;
    }
    p.life -= 0.02;
    p.alpha *= 0.995;
  }
  
  // Удаляем мёртвые или некорректные частицы
  MAGICSTAFF_CHARGE_FX = MAGICSTAFF_CHARGE_FX.filter(p => {
    return p.life > 0 && 
           p.alpha > 0.01 && 
           isFinite(p.x) && 
           isFinite(p.y) && 
           isFinite(p.r) &&
           p.r > 0;
  });
  
  // Рисуем все частицы
  for(const p of MAGICSTAFF_CHARGE_FX){
    const a = p.life * p.alpha;
    if(a < 0.01) continue;
    
    // 🔥 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ПЕРЕД РИСОВАНИЕМ
    if(!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.r) || p.r <= 0) continue;
    
    ctx.save();
    ctx.globalAlpha = a * 0.8;
    
    // 🔥 БЕЗОПАСНОЕ СОЗДАНИЕ ГРАДИЕНТА
    const radius = Math.max(1, p.r * 2); // гарантируем положительное число
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    
    if(p.type === 'particle'){
      grad.addColorStop(0, `rgba(180, 230, 255, ${a * 0.9})`);
      grad.addColorStop(0.3, `rgba(120, 200, 255, ${a * 0.6})`);
      grad.addColorStop(1, `rgba(60, 150, 255, 0)`);
    } else if(p.type === 'explosion'){
      grad.addColorStop(0, `rgba(255, 230, 200, ${a * 0.9})`);
      grad.addColorStop(0.3, `rgba(255, 200, 150, ${a * 0.6})`);
      grad.addColorStop(1, `rgba(200, 150, 100, 0)`);
    } else if(p.type === 'wave'){
      grad.addColorStop(0, `rgba(200, 240, 255, ${a * 0.8})`);
      grad.addColorStop(0.5, `rgba(150, 220, 255, ${a * 0.4})`);
      grad.addColorStop(1, `rgba(80, 180, 255, 0)`);
    } else {
      grad.addColorStop(0, `rgba(100, 200, 255, ${a * 0.9})`);
      grad.addColorStop(0.3, `rgba(80, 180, 255, ${a * 0.6})`);
      grad.addColorStop(1, `rgba(40, 120, 255, 0)`);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Яркая точка в центре
    ctx.shadowColor = 'rgba(200, 240, 255, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.7})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, p.r * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.restore();
  }
}



// ════════════════════════════════════════════════════════════════════
// 🔥 ЕДИНАЯ ФУНКЦИЯ НАНЕСЕНИЯ УРОНА
// ════════════════════════════════════════════════════════════════════
function applyDamage(defender, damage, attacker, options){
const dC2 = entityBodyCenter(defender);

  if(!defender || defender.hp <= 0) return;

  if(damage <= 0) return;
  if(defender._hitCD !== undefined && defender._hitCD >= GameTime) return;
// ── БАЗОВЫЕ ПАРАМЕТРЫ ──
  const opts = options || {};
  const isMagic = opts.isMagic || false;

  const isExplosion = opts.isExplosion || false;
  const isProjectile = opts.isProjectile || false;
 
  const knockbackMult = opts.knockbackMult || 1.0;
  const hitstopFrames = opts.hitstopFrames || 4;

  const shakePower = opts.shakePower || (damage > 15 ? 5 : 3);
  const textColor = opts.textColor || '#ff4040';
  const bloodCount = opts.bloodCount || 8;
  const textSuffix = opts.textSuffix || '';
 
  const spawnLightning = opts.spawnLightning || null;
  const playSoundOpt = opts.playSound !== undefined ? opts.playSound : true;

  // ── ПРИМЕНЯЕМ УРОН ──
  const finalDmg = Math.min(damage, Math.max(1, Math.round(MAX_HP * 0.70))); // 70 макс урон
  defender.hp = Math.max(0, defender.hp - finalDmg);
  defender._hitCD = Math.max(defender._hitCD || -1, GameTime + 1.0);
  defender.hitFlash = GameTime + 0.3;

  // ── МОЛНИЯ (если передана) ──
  if(spawnLightning && typeof spawnLightningHit === 'function'){
    const dC = entityBodyCenter(defender);
    spawnLightningHit(
      spawnLightning.fromX, 
      spawnLightning.fromY, 
      dC.x, 
      dC.y, 
      spawnLightning.intensity
    );
  }

  // ── ОТБРАСЫВАНИЕ ──
  if(attacker && knockbackMult > 0){
    const aC = entityBodyCenter(attacker);
    const dC = entityBodyCenter(defender);
    const dx = dC.x - aC.x;
    const dy = dC.y - aC.y;
    const len = Math.hypot(dx, dy) || 1;
    const kb = sv('bodyKB') * 0.5 * knockbackMult;
    defender.vx += (dx / len) * kb;
    defender.vy += (dy / len) * kb;
  }
  

  
  // ── КРОВЬ ──

  for(let i = 0; i < bloodCount; i++){
    const angle = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 6;
    if(typeof spawnBlood === 'function'){
      spawnBlood(
        dC2.x + (Math.random() - 0.5) * 20,
        dC2.y + (Math.random() - 0.5) * 20,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd
      );
    }
  }
  
  // ── ЛУЖА КРОВИ ──
  if(typeof spawnBloodPool === 'function'){
    spawnBloodPool(dC2.x, dC2.y, finalDmg);
  }
  
  // ── ТЕКСТ УРОНА (ТОЛЬКО ОДИН РАЗ!) ──
  let label = '-' + finalDmg;
  if(isMagic) label += ' ✨';
  if(isExplosion) label += ' 💥';
  if(isProjectile) label += ' 🏹';
  if(textSuffix) label += ' ' + textSuffix;
  
  hitFX.push({
    x: dC2.x,
    y: dC2.y - 35 - (Math.random() - 0.5) * 8, // небольшой разброс
    t: label,
    life: 45,
    big: finalDmg > 15,
    col: textColor
  });
  
  // ── ХИТСТОП И ТРЯСКА ──
  if(typeof triggerHitstop === 'function'){
    triggerHitstop(hitstopFrames, shakePower);
  }
  
  // ── ЗВУК ──
  if(playSoundOpt !== false){
    if(isMagic || isExplosion){
      playSound('magicHit');
      if(finalDmg > 30) playSound('clashHard');
    } else if(isProjectile){
      playSound('arrowHit');
    } else {
      playSound(isHeavySwingWeapon(attacker) ? 'damageHammer' : 'damage');
    }
  }
  
  // ── СМЕРТЬ ──
  if(defender.hp <= 0){
    if(defender === P){
      if(typeof triggerDeath === 'function') triggerDeath(defender, false);
    } else {
      if(typeof handleCombatDeath === 'function') handleCombatDeath(defender);
    }
  }
}







// ════════════════════════════════════════════════════════════════════
// 🔥 ЕДИНАЯ ФУНКЦИЯ НАНЕСЕНИЯ УРОНА
// ════════════════════════════════════════════════════════════════════
// Взрыв магического посоха A
function spawnMagicStaffExplosion(ent, radius, dmg){
  const c = entityBodyCenter(ent);
  console.log('💥🔮 ВЗРЫВ МАГИЧЕСКОГО ПОСОХА!', {radius, dmg});
  
  // ── КОЛЬЦО ВЗРЫВА (50 частиц) ──
  for(let i = 0; i < 50; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const speed = 2 + Math.random() * 6;
    MAGICSTAFF_CHARGE_FX.push({
      x: c.x + Math.cos(angle) * dist * 0.2,
      y: c.y + Math.sin(angle) * dist * 0.2 - 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 1,
      maxLife: rf(0.8, 0.4),
      r: 3 + Math.random() * 6,
      alpha: 1,
      targetX: c.x + Math.cos(angle) * dist,
      targetY: c.y + Math.sin(angle) * dist - 10,
    });
  }
  
  // ── ВСПЫШКА ──
  FX_EFFECTS.push({
    type: 'flash', 
    x: c.x, y: c.y, 
    t: 0, 
    duration: 20, 
    angle: 0, 
    followEntity: ent
  });
  

  
  // ── МАГИЧЕСКИЙ ВЗРЫВ ──
  FX_EFFECTS.push({
    type: 'magic_explosion', 
    x: c.x, y: c.y, 
    t: 0, 
    duration: 30, 
    angle: 0, 
    followEntity: ent,
    radius: radius
  });
  playSound('magicExplode');
  // ════════════════════════════════════════════════════════════════════
  // 🔥 УРОН ПО ВСЕМ ВРАГАМ ЧЕРЕЗ applyDamage
  // ════════════════════════════════════════════════════════════════════
  const defenders = [P, ...ALL_BOTS];
  
  for(const defender of defenders){
    if(defender === ent || defender.hp <= 0) continue;
    const dC = entityBodyCenter(defender);
    const dist = Math.hypot(dC.x - c.x, dC.y - c.y);
    
    if(dist < radius){
const minFactor = 0.5; // 50% от урона — минимум
const distFactor = Math.max(minFactor, 1 - dist / radius);
let finalDmg = Math.round(dmg * distFactor);
      const intensity = Math.min(1, distFactor * 1.5);
      // ════════════════════════════════════════════════════════════════
      // 🔥 ЕДИНЫЙ ВЫЗОВ applyDamage СО ВСЕМИ ЭФФЕКТАМИ
      // ════════════════════════════════════════════════════════════════
applyDamage(defender, finalDmg, ent, {
  isMagic: true,
  isExplosion: true,
  knockbackMult: 2.0 + distFactor,
  hitstopFrames: 6,
  shakePower: Math.min(10, 3 + finalDmg / 12),
  textColor: '#ff6644',
  textSuffix: '💥',
  bloodCount: 12,
  spawnLightning: {
    fromX: c.x,
    fromY: c.y,
    intensity: intensity
  }
});
    }
  }
}










// ── Разрушение стрелы при блоке: щепки древка + перья разлетаются ──────────
// В отличие от WAND_EXPLOSIONS (радиальная магическая вспышка), здесь
// направленный "веер" обломков — стрела не взрывается, а буквально
// разлетается кусками от точки удара, преимущественно назад по своей
// прежней траектории и немного в стороны (гравитация утягивает их вниз).
let ARROW_SHATTER_FX = []; // {x,y,vx,vy,life,maxLife,rot,rotSpd,len,kind}
function spawnArrowShatter(x, y, incomingAngle){
  const n = 7;
  const backAngle = incomingAngle + Math.PI; // назад относительно полёта стрелы
  for(let i = 0; i < n; i++){
    const spread = (Math.random()-0.5) * 1.8; // веер разлёта, не строго назад
    const a = backAngle + spread;
    const spd = 1.5 + Math.random()*3.5;
    const isFeather = i < 2; // пара кусочков — оперение (короче, светлее)
    ARROW_SHATTER_FX.push({
      x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 1, // лёгкий начальный подброс вверх
      life: 1, maxLife: 1,
      rot: Math.random()*Math.PI*2, rotSpd: (Math.random()-0.5)*10,
      len: isFeather ? 5+Math.random()*3 : 8+Math.random()*8,
      kind: isFeather ? 'feather' : 'shaft',
    });
  }
}
function updateArrowShatterFX(dt){
  for(let i = ARROW_SHATTER_FX.length-1; i >= 0; i--){
    const p = ARROW_SHATTER_FX[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += dt*9; // гравитация утягивает щепки вниз
    p.vx *= 0.96; p.vy *= 0.98;
    p.rot += p.rotSpd*dt;
    p.life -= dt*1.8;
    if(p.life <= 0) ARROW_SHATTER_FX.splice(i,1);
  }
}
function drawArrowShatterFX(){
  for(const p of ARROW_SHATTER_FX){
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if(p.kind === 'feather'){
      ctx.fillStyle = '#e8d9b8';
      ctx.fillRect(-p.len/2, -1.5, p.len, 3);
    } else {
      ctx.strokeStyle = '#8a5a30';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-p.len/2,0); ctx.lineTo(p.len/2,0); ctx.stroke();
    }
    ctx.restore();
  }
}

let BOW_TENSION_FX = []; // частицы натяжения тетивы
function spawnBowTensionFX(ent){
  const tip = weaponTipPos(ent);
  const progress = Math.min(1, (GameTime - ent._bowChargeStart) / BOW_RELOAD);
  
  // 🔥 МЕНЬШЕ ЧАСТИЦ
  const count = Math.random() < 0.6 ? 1 : 0; // 60% шанс 1 частицы, 40% шанс 0
  
  for(let i = 0; i < count; i++){
    const spread = (Math.random() - 0.5) * 0.25; // узкий конус
    const angle = ent.angle + spread;
    const dist = 3 + Math.random() * 5;
    const speed = 0.3 + Math.random() * 0.8;
    
    BOW_TENSION_FX.push({
      x: tip.x + Math.cos(angle) * dist,
      y: tip.y + Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: rf(0.15, 0.1),
      r: 0.8 + Math.random() * 1.2, // маленькие частицы
      alpha: 0.3 + Math.random() * 0.3,
    });
  }
}

function updateBowTensionFX(dt){
  for(let i = BOW_TENSION_FX.length - 1; i >= 0; i--){
    const p = BOW_TENSION_FX[i];
    p.life -= dt / p.maxLife;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += 0.5 * dt * 60;
    p.alpha *= 0.995;
    if(p.life <= 0 || p.alpha < 0.01){
      BOW_TENSION_FX.splice(i, 1);
    }
  }
}
function drawBowTensionFX(){
  for(const p of BOW_TENSION_FX){
    const a = p.life * p.alpha;
    ctx.save();
    ctx.globalAlpha = a * 0.8;
    
    // Свечение
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
    grad.addColorStop(0, `rgba(255, 200, 100, ${a * 0.9})`);
    grad.addColorStop(0.3, `rgba(255, 180, 80, ${a * 0.6})`);
    grad.addColorStop(1, `rgba(255, 150, 50, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Яркая точка в центре
    ctx.fillStyle = `rgba(255, 220, 150, ${a * 0.9})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}


function clearBowTensionFX(){
  BOW_TENSION_FX = [];
  if(P) P._bowCharging = false;
  if(D) D._bowCharging = false;
}

function clearMagicStaffFX(ent){
  // Очищаем массивы эффектов
  MAGICSTAFF_CHARGE_FX = [];
  MAGICSTAFF_LIGHTNING_FX = [];
  MAGICSTAFF_GLOW_FX = [];
  
  // Сбрасываем состояние у сущности
  if(ent){
    ent._magicCharging = false;
    ent._magicSpawnCD = 0;
    ent._radiusParticleCD = 0;
    ent._lightningCD = 0;
    ent._particleCD = 0;
    ent._magicChargeStart = 0;
    if(ent._magicChargeSoundObj){
      try {
        ent._magicChargeSoundObj.pause();
        ent._magicChargeSoundObj = null;
      } catch(e) {}
    }
  }
}
function spawnMagicStaffParticles(ent){
  const c = entityBodyCenter(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  const count = 2 + Math.floor(progress * 3);
  
  for(let i = 0; i < count; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.2 + Math.random() * 0.6);
    const speed = 1 + progress * 4 + Math.random() * 2;
    
    MAGICSTAFF_CHARGE_FX.push({
      x: c.x + Math.cos(angle) * dist,
      y: c.y + Math.sin(angle) * dist - 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -speed - Math.random() * 1.5,
      life: 1,
      maxLife: 0.4 + progress * 0.4 + Math.random() * 0.3,
      r: 2 + progress * 3 + Math.random() * 2,
      alpha: 0.4 + progress * 0.5,
      type: 'particle'
    });
  }
}
// Общая функция стрельбы — используется и игроком (mDown из мыши), и ботами
// (виртуальный "зажат ли спуск", вычисленный их ИИ). aimAngleOverride нужен
// для ботов, у которых нет курсора мыши.
function updateRangedWeaponFire(ent, fireHeld, aimAngleOverride){
  const key = weaponKeyOf(ent);
  
  // ============================================================
  // 🔥 ЖЕЗЛ
  // ============================================================
  if(key === 'wand'){
  
  
  
  
    if(fireHeld && ent.hasWeapon !== false && !isExhausted(ent) && !(GameTime < (ent._rangedShotCD||0))){
      if(!ent._wandCharging){
        ent._wandCharging = true;
        ent._wandChargeStart = GameTime;
        ent._wandChargeSoundObj = playControllableSound('magicEnergy');
      }
    } else if(!fireHeld){
	
	



      if(ent._wandCharging){
  // Молнии (каждые 0.1 сек)
  if(!ent._lightningCD) ent._lightningCD = 0;
  ent._lightningCD -= rawDt;
  if(ent._lightningCD <= 0){
    ent._lightningCD = 0.1;
    spawnMagicStaffLightning(ent);
  }
  
  // Свечение на кончике (каждый кадр)
  spawnMagicStaffGlow(ent);
  
  
  
  
  // Частицы вверх (каждые 0.05 сек)
  if(!ent._particleCD) ent._particleCD = 0;
  ent._particleCD -= rawDt;
  if(ent._particleCD <= 0){
    ent._particleCD = 0.05;
    spawnMagicStaffParticles(ent);
  }
	  
        const chargedEnough = GameTime - ent._wandChargeStart >= wandChargeTimeFor(ent);
        ent._wandCharging = false;
        fadeOutSound(ent._wandChargeSoundObj, 0.3);
        ent._wandChargeSoundObj = null;
        if(chargedEnough){
          const aimAngle = aimAngleOverride != null ? aimAngleOverride
            : (ent === P ? Math.atan2(mY - rootCenter().y, mX - rootCenter().x) : ent.angle);
          const rageMult = 1 + clamp(ent.rage||0, 0, 100)/100;
          spawnProjectile(ent, 'wand', aimAngle, WAND_BASE_DMG * rageMult);
          ent.stamina = Math.max(0, ent.stamina - sv('stamswing') * weaponStaminaMult(ent));
          if(ent.stamina <= 0 && !isExhausted(ent)) ent.exhausted = sv('exhdur2');
          playSound('magicPush');
          ent.rage = 0;
          ent._rangedShotCD = GameTime + WAND_SHOT_CD;
          ent.vx -= Math.cos(aimAngle) * 7;
          ent.vy -= Math.sin(aimAngle) * 7;
        }
      }
    }
    
  // ============================================================
  // 🔥 ЛУК
  // ============================================================
// 🔥 ЛУК
  } else if(key === 'bow'){
    if(fireHeld && ent.hasWeapon !== false && !isExhausted(ent) && !(GameTime < (ent._rangedShotCD||0))){
      if(!ent._bowCharging){
        ent._bowCharging = true;
        ent._bowChargeStart = GameTime;
        ent._bowSeed = Math.random() * 100;
        ent._bowTensionSound = playControllableSound('bowTension');
        ent._reloadSoundPlayed = false;
      }
      
      // ✅ ДРЕЙН ВО ВРЕМЯ УДЕРЖАНИЯ
      const staminaDrain = 3 * rawDt;
      ent.stamina = Math.max(0, ent.stamina - staminaDrain);
      
      // ✅ Если стамина кончилась - включаем усталость, НО НЕ ПРЕРЫВАЕМ
      if(ent.stamina <= 0 && !isExhausted(ent)){
        ent.exhausted = sv('exhdur2');
		 ent._hadExhaustion = true;  // ← ДОБАВИТЬ ЭТУ СТРОЧКУ
      }
      
      if(ent === P || ent === D){
        ent._bowSpawnCD = (ent._bowSpawnCD || 0) - rawDt;
        if(ent._bowSpawnCD <= 0){
          ent._bowSpawnCD = 0.06;
          spawnBowTensionFX(ent);
        }
      }
      
    } else if(!fireHeld){
      if(ent._bowCharging){
        const chargeTime = GameTime - ent._bowChargeStart;
        ent._bowCharging = false;
        ent._bowSpawnCD = 0;
        
        if(ent._bowTensionSound){
          fadeOutSound(ent._bowTensionSound, 0.2);
          ent._bowTensionSound = null;
        }
        
        clearBowTensionFX();
        
        const aimAngle = aimAngleOverride != null ? aimAngleOverride
          : (ent === P ? Math.atan2(mY - rootCenter().y, mX - rootCenter().x) : ent.angle);
        
        const maxCharge = BOW_RELOAD;
        const progress = Math.min(1, chargeTime / maxCharge);
        const dmg = BOW_DMG_MIN + (BOW_DMG_MAX - BOW_DMG_MIN) * progress;
        
        const tip = weaponTipPos(ent);
        for(let i = 0; i < 6; i++){
          const angle = ent.angle + (Math.random() - 0.5) * 0.8;
          const dist = 3 + Math.random() * 6;
          BOW_TENSION_FX.push({
            x: tip.x + Math.cos(angle) * dist,
            y: tip.y + Math.sin(angle) * dist,
            vx: Math.cos(angle) * (1 + Math.random() * 2),
            vy: Math.sin(angle) * (1 + Math.random() * 2) - 0.5,
            life: 1,
            maxLife: rf(0.25, 0.1),
            r: 2 + Math.random() * 2.5,
            alpha: 1,
          });
        }
        
        spawnProjectile(ent, 'arrow', aimAngle, dmg, BOW_PROJ_SPEED, BOW_MAX_DMG_PCT);
        
        // ✅ ТРАТИМ 15 ИЛИ ВСЁ ЧТО ОСТАЛОСЬ
const staminaCost = Math.min(15, ent.stamina);
ent.stamina = Math.max(0, ent.stamina - staminaCost);
        
        // ✅ ЕСЛИ СТАМИНА СТАЛА 0 - УСТАЛОСТЬ
        if(ent.stamina <= 0 && !isExhausted(ent)){
          ent.exhausted = sv('exhdur2');
		   ent._hadExhaustion = true;  // ← ДОБАВИТЬ ЭТУ СТРОЧКУ
        }
        
        playSound('bowPush');
        ent._rangedShotCD = GameTime + 0.5;
        
        const recoilForce = 2;
        if(!(ent === P && dummyOn)){
          ent.vx -= Math.cos(aimAngle) * recoilForce;
          ent.vy -= Math.sin(aimAngle) * recoilForce;
        }
        ent._recoilOffset = -6;
        ent._recoilAnimTime = 0.1;
        
        hitFX.push({x:ent.x, y:ent.y-40, t:'🏹 ' + Math.round(dmg), life:30, big:false, col:'#ffdd88'});
      }
    }
  
  // ============================================================
  // 🔥 АРБАЛЕТ
  // ============================================================
 // ============================================================
// 🔥 АРБАЛЕТ
// ============================================================
} else if(key === 'crossbow'){
    if(fireHeld && ent.hasWeapon !== false && !isExhausted(ent)){
        if(GameTime < (ent._rangedShotCD||0)){
            if(!ent._reloadSoundPlayed){
                ent._reloadSoundPlayed = true;
                const tip = weaponTipPos(ent);
                hitFX.push({x:tip.x, y:tip.y-16, t:'⏳ ЗАРЯЖАЮ...', life:35, big:false, col:'#ff8844'});
            }
        } else {
            const aimAngle = aimAngleOverride != null ? aimAngleOverride
                : (ent === P ? Math.atan2(mY - rootCenter().y, mX - rootCenter().x) : ent.angle);
            const dmg = CROSSBOW_DMG_MIN + Math.random()*(CROSSBOW_DMG_MAX - CROSSBOW_DMG_MIN);
            spawnProjectile(ent, 'arrow', aimAngle, dmg, CROSSBOW_PROJ_SPEED, CROSSBOW_MAX_DMG_PCT);
            
            // ✅ ТРАТИМ 15 ИЛИ ВСЁ ЧТО ОСТАЛОСЬ
   const staminaCost = Math.min(15, ent.stamina);
ent.stamina = Math.max(0, ent.stamina - staminaCost);
            
            // ✅ ЕСЛИ СТАМИНА СТАЛА 0 - УСТАЛОСТЬ
if(ent.stamina <= 0 && !isExhausted(ent)){
  applyExhaust(ent);
  ent._hadExhaustion = true;
}
            
            playSound('arrowPush');
            
            ent._rangedShotCD = GameTime + CROSSBOW_RELOAD;
            ent._reloadSoundPlayed = false;
            
            const recoilForce = 4;
            ent.vx -= Math.cos(aimAngle) * recoilForce;
            ent.vy -= Math.sin(aimAngle) * recoilForce;
            ent._recoilOffset = -14;
            ent._recoilAnimTime = 0.15;
        }
    }



    
// ============================================================
// 🔥 МАГИЧЕСКИЙ ПОСОХ — ГИБРИДНЫЙ РЕЖИМ
// ============================================================

// Добавляем флаг для детекта "клик" vs "удержание"
  } else if (weaponKeyOf(ent) === 'magicstaff') {
  // Инициализация состояния
  if (!ent._magicStaffState) {
    ent._magicStaffState = {
      clickStartTime: 0,
      isHeld: false,
      hasFired: false,
      rageConsumed: false,
      staminaConsumed: false,
      rageDrainTimer: 0,
      holdStartTime: 0,
      wasReleased: false,
      releaseTime: 0,
      _releaseProcessed: false,
      _penaltyApplied: false,    // ← ФЛАГ: применили ли штраф через 1 сек
      _penaltyTimer: 0,           // ← ТАЙМЕР ДЛЯ ШТРАФА
	  _explosionTriggered: false
    };
  }
  
  const state = ent._magicStaffState;
  
  // ── ОБРАБОТКА НАЖАТИЯ ──────────────────────────────────
  if (fireHeld && ent.hasWeapon !== false && !isExhausted(ent) && !(GameTime < (ent._rangedShotCD||0))) {
    // Запоминаем время нажатия (только если только что нажали)
    if (!state.isHeld) {
      state.isHeld = true;
      state.clickStartTime = GameTime;
      state.holdStartTime = GameTime;
      state.hasFired = false;
      state.rageConsumed = false;
      state.staminaConsumed = false;
      state.rageDrainTimer = 0;
      state.wasReleased = false;
      state.releaseTime = 0;
      state._releaseProcessed = false;
      state._penaltyApplied = false;
      state._penaltyTimer = 0;
    }
    
    const holdTime = GameTime - state.clickStartTime;
    
    // ── ЕСЛИ УДЕРЖИВАЕМ БОЛЬШЕ 0.3 СЕК — РЕЖИМ НАКОПЛЕНИЯ ──
    if (holdTime > 0.3) {
      // Зарядка
      if (!ent._magicCharging) {
        ent._magicCharging = true;
        ent._magicChargeStart = GameTime;
        ent._magicChargeSoundObj = playControllableSound('magicEnergy');
        ent._magicSeed = Math.random() * 100;
      }
      
      // Тратим ярость и стамину вместе (каждые 0.1 сек)
      state.rageDrainTimer += rawDt;
      if (state.rageDrainTimer >= 0.1) {
        state.rageDrainTimer = 0;
        
        if ((ent.rage || 0) >= 1) {
          ent.rage = Math.max(0, ent.rage - 1);
          state.rageConsumed = true;
        }
        //if (ent.stamina >= 1) {
         // ent.stamina = Math.max(0, ent.stamina - 1);
        //  state.staminaConsumed = true;
        //}
        
if ((ent.rage || 0) < 1 || ent.stamina < 1) {
  const chargeTime = GameTime - ent._magicChargeStart;
  
  // 🔥 ЕСЛИ ЗАРЯЖАЛИ БОЛЬШЕ 2 СЕК — СНАЧАЛА ВЗРЫВ!
  if (chargeTime > MAGICSTAFF_CHARGE_MINTIME && state.rageConsumed) {
    const progress = Math.min(1, (chargeTime - 2.0) / 2.0);
    const dmg = MAGICSTAFF_DMG_MIN + (MAGICSTAFF_DMG_MAX - MAGICSTAFF_DMG_MIN) * progress * 3;
    const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
    spawnMagicStaffExplosion(ent, radius, dmg);
    playSound('magicPush');
    ent.vx -= Math.cos(ent.angle) * 5;
    ent.vy -= Math.sin(ent.angle) * 5;
    ent._rangedShotCD = GameTime + MAGICSTAFF_SHOT_CD;
    //hitFX.push({x: ent.x, y: ent.y - 50, t: '💥 ВЗРЫВ!', life: 50, big: true, col: '#88ddff'});
    state._explosionTriggered = true;  // ← помечаем что взрыв уже был
  }
  
  // Потом прерываем зарядку
  ent._magicCharging = false;
  if (ent._magicChargeSoundObj) {
    fadeOutSound(ent._magicChargeSoundObj, 0.2);
    ent._magicChargeSoundObj = null;
  }
  clearMagicStaffFX(ent);
  if (!isExhausted(ent)) ent.exhausted = sv('exhdur2');
  
  // Показываем сообщение о нехватке ресурсов
  if ((ent.rage || 0) < 1) {
   // hitFX.push({x: ent.x, y: ent.y - 30, t: '🔥 НЕТ ЯРОСТИ!', life: 30, big: false, col: '#ff8844'});
  } else if (ent.stamina < 1) {
   // hitFX.push({x: ent.x, y: ent.y - 30, t: '😫 НЕТ СТАМИНЫ!', life: 30, big: false, col: '#ff8844'});
  }
  
  state.isHeld = false;
  return;
}}
    
      
      // Эффекты зарядки
      // На мобиле эффект заряжания посоха ощутимо тормозит — снижаем частоту
      // спавна частиц и молний (реже создаём, меньше живых объектов разом).
      const _fxMobileMult = window.IS_MOBILE ? 2.2 : 1;
      ent._magicSpawnCD = (ent._magicSpawnCD || 0) - rawDt;
      if (ent._magicSpawnCD <= 0) {
        ent._magicSpawnCD = 0.05 * _fxMobileMult;
        spawnMagicStaffChargeFX(ent);
      }
      ent._radiusParticleCD = (ent._radiusParticleCD || 0) - rawDt;
      if (ent._radiusParticleCD <= 0) {
        ent._radiusParticleCD = 0.04 * _fxMobileMult;
        spawnMagicStaffRadiusParticles(ent);
      }
      ent._lightningCD = (ent._lightningCD || 0) - rawDt;
      if (ent._lightningCD <= 0) {
        ent._lightningCD = 0.1 * _fxMobileMult;
        spawnMagicStaffLightning(ent);
      }
      spawnMagicStaffGlow(ent);
      ent._particleCD = (ent._particleCD || 0) - rawDt;
      if (ent._particleCD <= 0) {
        ent._particleCD = 0.05;
        spawnMagicStaffParticles(ent);
      }
      
      return; // Всё, дальше не идём
    }
    
    // ── КОРОТКОЕ НАЖАТИЕ (< 0.3 сек) — МАГИЧЕСКИЙ ВЫПАД ──
    if (!state.hasFired) {
      const hasRage = (ent.rage || 0) >= 30;
      
      if (hasRage) {
        // 🔥 МАГИЧЕСКИЙ УДАР
        const aimAngle = aimAngleOverride != null ? aimAngleOverride
          : (ent === P ? Math.atan2(mY - rootCenter().y, mX - rootCenter().x) : ent.angle);
        
        const tip = weaponTipPos(ent);
        
        ent.angle = aimAngle;
        ent.vel = sv('swthresh') * 2.5;
        
        const lungeDist = sv('dist') * 3.5;
        ent.tpX = Math.cos(aimAngle) * lungeDist;
        ent.tpY = Math.sin(aimAngle) * lungeDist;
        
        spawnWandExplosion(tip.x, tip.y);
        
        // Молния (тонкая)
        const lightningPoints = [];
        const segments = 6;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const cx = tip.x + Math.cos(aimAngle) * t * 50;
          const cy = tip.y + Math.sin(aimAngle) * t * 50;
          if (i > 0 && i < segments) {
            const perpAngle = aimAngle + Math.PI/2;
            const jitter = (Math.random() - 0.5) * 15 * (1 - t * 0.3);
            lightningPoints.push({
              x: cx + Math.cos(perpAngle) * jitter,
              y: cy + Math.sin(perpAngle) * jitter
            });
          } else {
            lightningPoints.push({x: cx, y: cy});
          }
        }
        
        LIGHTNING_HIT_FX.push({
          points: lightningPoints,
          life: 1,
          maxLife: 0.3,
          width: 1.5,
          alpha: 1,
        });
        
        // Магический урон 10 ед.
        const defenders = [P, ...ALL_BOTS];
        let closestEnemy = null;
        let closestDist = Infinity;
        
        for (const defender of defenders) {
          if (defender === ent || defender.hp <= 0) continue;
          const dC = entityBodyCenter(defender);
          const dist = Math.hypot(dC.x - tip.x, dC.y - tip.y);
          
          const toEnemy = Math.atan2(dC.y - tip.y, dC.x - tip.x);
          const angleDiff = Math.abs(angDiff(toEnemy, aimAngle));
          
          if (dist < 120 && angleDiff < Math.PI / 4 && dist < closestDist) {
            closestDist = dist;
            closestEnemy = defender;
          }
        }
        
        if (closestEnemy) {
          applyDamage(closestEnemy, 10, ent, {
            isMagic: true,
            isExplosion: false,
            knockbackMult: 0.3,
            hitstopFrames: 3,
            shakePower: 3,
            textColor: '#c090ff',
            textSuffix: '✨',
            bloodCount: 4,
            spawnLightning: {
              fromX: tip.x,
              fromY: tip.y,
              intensity: 0.6
            }
          });
        }
        
        //hitFX.push({x: ent.x, y: ent.y - 40, t: '✨ МАГИЯ!', life: 35, big: true, col: '#c090ff'});
        playSound('magicPush');
        
        ent._rangedShotCD = GameTime + 0.3;
        
      } else {
        // 🔥 ОБЫЧНЫЙ ВЫПАД (без магии)
        const aimAngle = aimAngleOverride != null ? aimAngleOverride
          : (ent === P ? Math.atan2(mY - rootCenter().y, mX - rootCenter().x) : ent.angle);
        
        ent.angle = aimAngle;
        ent.vel = sv('swthresh') * 2;
        
        const lungeDist = sv('dist') * 6.5;
        ent.tpX = Math.cos(aimAngle) * lungeDist;
        ent.tpY = Math.sin(aimAngle) * lungeDist;
        
        hitFX.push({x: ent.x, y: ent.y - 40, t: '⚔ ВЫПАД', life: 30, big: false, col: '#ffaa44'});
        playSound('hammerSwing');
      }
      
      state.hasFired = true;
      // 🔥 ЗАПУСКАЕМ ТАЙМЕР ШТРАФА (через 1 сек)
      state._penaltyTimer = 0.3;
      state._penaltyApplied = false;
    }
    
    return;
  }
  
  // ── ОТПУСКАНИЕ ──────────────────────────────────────────
  if (!fireHeld) {
    // Обрабатываем отпуск ТОЛЬКО ОДИН РАЗ
    if (!state._releaseProcessed) {
      state._releaseProcessed = true;
      
      const holdTime = GameTime - state.clickStartTime;
      
      // Если был режим накопления — взрыв
      if (ent._magicCharging) {
        const chargeTime = GameTime - ent._magicChargeStart;
        ent._magicCharging = false;
        if (ent._magicChargeSoundObj) {
          fadeOutSound(ent._magicChargeSoundObj, 0.2);
          ent._magicChargeSoundObj = null;
        }
        clearMagicStaffFX(ent);
        
        // Взрыв только если заряжали > 2 сек
        if (chargeTime > MAGICSTAFF_CHARGE_MINTIME) {
          const progress = Math.min(1, (chargeTime - 2.0) / 2.0);
          const dmg = MAGICSTAFF_DMG_MIN + (MAGICSTAFF_DMG_MAX - MAGICSTAFF_DMG_MIN) * progress * 3;
          const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
          spawnMagicStaffExplosion(ent, radius, dmg);
          playSound('magicPush');
          ent.vx -= Math.cos(ent.angle) * 5;
          ent.vy -= Math.sin(ent.angle) * 5;
          ent._rangedShotCD = GameTime + MAGICSTAFF_SHOT_CD;
          hitFX.push({x: ent.x, y: ent.y - 50, t: '💥 ВЗРЫВ!', life: 50, big: true, col: '#88ddff'});
        } else {
          hitFX.push({x: ent.x, y: ent.y - 40, t: '❌ нужно >2 сек', life: 30, big: false, col: '#ff8844'});
        }
      }
    }
    
    // Сбрасываем состояние
    state.isHeld = false;
    state.rageDrainTimer = 0;
  }
  
  // ── ЕЖЕКАДРОВАЯ ПРОВЕРКА ШТРАФА ──
if (state.hasFired && !state._penaltyApplied && state._penaltyTimer > 0) {
  state._penaltyTimer -= rawDt;
  
  // ЧЕРЕЗ 1 СЕКУНДУ ПОСЛЕ ВЫПАДА — ТРАТИМ 50 ЯРОСТИ И 50 СТАМИНЫ
  if (state._penaltyTimer <= 0 && !state._penaltyApplied) {
    state._penaltyApplied = true;
    
    // Проверяем есть ли ярость
    const hasRage = (ent.rage || 0) >= 30;
    
    if (hasRage) {
      // ✅ ЕСТЬ ЯРОСТЬ: тратим 30 ярости и 30 стамины
      ent.rage = Math.max(0, ent.rage - 30);
      ent.stamina = Math.max(0, ent.stamina - 30);
    //  hitFX.push({x: ent.x, y: ent.y - 50, t: '🔥 -30 ЯРОСТИ! 💧 -30 СТАМ', life: 35, big: true, col: '#ff6030'});
    } else {
      // ❌ НЕТ ЯРОСТИ: тратим только 50 стамины (штраф)
      ent.stamina = Math.max(0, ent.stamina -30);
     // hitFX.push({x: ent.x, y: ent.y - 40, t: '❌ НЕТ ЯРОСТИ! 💧 -30 СТАМ', life: 35, big: true, col: '#ff8844'});
    }
    
    if (ent.stamina <= 0 && !isExhausted(ent)) ent.exhausted = sv('exhdur2');
    
    // Сбрасываем флаг
    state.hasFired = false;
  }
}
}
}

// Проверяет всех сущностей с арбалетом: если КД перезарядки только что истёк
// (GameTime >= _rangedShotCD) и звук перезарядки ещё не был сыгран для этого
// цикла — играет 'crossbowReload' ровно в момент готовности оружия, а не по
// приблизительному таймеру после выстрела.
function updateCrossbowReloadSound(ent){
  const key = weaponKeyOf(ent);
  if(key !== 'crossbow' && key !== 'bow') return;
  if(ent._reloadSoundPlayed) return;
  if(ent._rangedShotCD == null) return;
  if(GameTime >= ent._rangedShotCD){
    if(key === 'crossbow') {
      playSound('crossbowReload');
    } else if(key === 'bow') {
      playSound('bowReload');
    }
    ent._reloadSoundPlayed = true;
  }
}

// ── Физика/столкновения снарядов (как у DROPPED_WEAPONS, но без подбора) ──
function updateProjectiles(dt){
  const BOUND_L = 40, BOUND_R = W-80, BOUND_T = 40, BOUND_B = H-40;
  for(let i = PROJECTILES.length-1; i >= 0; i--){
    const w = PROJECTILES[i];
    w.x += w.vx; w.y += w.vy;

    // Улетел за пределы арены или слишком долго летит — исчезает
    if(w.x < BOUND_L-60 || w.x > BOUND_R+60 || w.y < BOUND_T-60 || w.y > BOUND_B+60 || (GameTime - w.bornAt) > 3.0){
      PROJECTILES.splice(i,1); continue;
    }

    // Стрела арбалета: теряет скорость и "истаивает" через прозрачность
    if(w.kind === 'arrow'){
      w.vx *= 0.996; w.vy *= 0.996;
      if(Math.hypot(w.vx,w.vy) < CROSSBOW_PROJ_SPEED*0.35){
        w.fade = (w.fade!=null ? w.fade : 1) - dt*1.5;
        if(w.fade <= 0){ PROJECTILES.splice(i,1); continue; }
      }
    }

    // ── Блок клинком/щитом ──
    let blocked = false, blockedByBlade = false, blockedByShield = false, blocker = null;
    const defenders = [P, ...ALL_BOTS];
    const wSpd = Math.hypot(w.vx, w.vy);
    const wPrevX = w.x - w.vx, wPrevY = w.y - w.vy;
    
    for(const ent of defenders){
      if(!ent || ent.hp <= 0 || ent._awaitingReveal) continue;
      if(ent === w.owner && GameTime < w.ownerImmuneUntil) continue;
      
      // Блок клинком
      if(ent.hasWeapon !== false){
        const piv = entityPivot(ent);
        const reach = weaponReach(ent) * sv('swlen') * (isBot(ent)?sv('botswordscale'):1);
        const tipX = piv.x + Math.cos(ent.angle)*reach, tipY = piv.y + Math.sin(ent.angle)*reach;
        // Оружие с коллизией 'tip' (копьё, алебарда) блокирует снаряды только
        // ближним к концу участком клинка, а не всей длиной древка.
        const isTipOnly = weaponCollisionType(ent) === 'tip';
        const segStartX = isTipOnly ? (piv.x + (tipX-piv.x)*0.7) : piv.x;
        const segStartY = isTipOnly ? (piv.y + (tipY-piv.y)*0.7) : piv.y;
        const segDX=tipX-segStartX, segDY=tipY-segStartY, segL2=segDX*segDX+segDY*segDY||1;
        // Радиус коллайдера снаряда: у стрелы по древку копья/алебарды он был
        // заметно шире визуального древка — сужаем именно для 'tip'-оружия.
        // Магический снаряд, наоборот, крупнее и должен блокироваться легче —
        // радиус для него вдвое больше базового.
        let BLOCK_R = 14;
        if(w.kind === 'wand') BLOCK_R = 28;
        else if(w.kind === 'arrow' && isTipOnly) BLOCK_R = 7;
        
        const t = clamp(((w.x-segStartX)*segDX+(w.y-segStartY)*segDY)/segL2, 0, 1);
        const nearX=segStartX+t*segDX, nearY=segStartY+t*segDY;
        let hitBlade = Math.hypot(w.x-nearX, w.y-nearY) < BLOCK_R;
        
        if(!hitBlade && wSpd > BLOCK_R){
          const t2 = clamp(((segStartX-wPrevX)*w.vx+(segStartY-wPrevY)*w.vy)/(wSpd*wSpd||1), 0, 1);
          const nearPathX = wPrevX + w.vx*t2, nearPathY = wPrevY + w.vy*t2;
          const t3 = clamp(((nearPathX-segStartX)*segDX+(nearPathY-segStartY)*segDY)/segL2, 0, 1);
          const bladeX2 = segStartX+t3*segDX, bladeY2 = segStartY+t3*segDY;
          if(Math.hypot(nearPathX-bladeX2, nearPathY-bladeY2) < BLOCK_R) hitBlade = true;
        }
        if(hitBlade){ blocked = true; blockedByBlade = true; blocker = ent; break; }
      }
      
      // Блок щитом
      if(shieldDef(ent) && !isShieldSuppressed(ent) && ent._shieldSide !== undefined){
        const shc = entityBodyCenter(ent);
        const scx = shc.x + ent._shieldSide*20*0.9, scy = shc.y + Math.sin(ent.angle)*14;
        const halfW=(ent._shieldW||20)/2, halfH=(ent._shieldH||30)/2;
        if(Math.abs(w.x-scx)<halfW+12 && Math.abs(w.y-scy)<halfH+12){
          blocked = true;
          blockedByShield = true;
          blocker = ent;
          applyShieldBlockFX(w.x, w.y, null, null, {waveAngle: Math.atan2(w.vy, w.vx), hitstopMag:0});
          break;
        }
      }
    }
    
    if(blocked){
      // Стамина за блок снаряда: у игрока 1x, у бота 2x от базовой стоимости блока
      const staminaTarget = w.owner || blocker;
      if(staminaTarget){
        const projStamCost = sv('stamblock') * (isBot(staminaTarget) ? 2 : 1);
        staminaTarget.stamina = Math.max(0, staminaTarget.stamina - projStamCost);
if(staminaTarget.stamina <= 0 && !isExhausted(staminaTarget)){
  applyExhaust(staminaTarget);
}
      }
      playSound(w.kind==='wand' ? 'magicHit' : 'arrowHit');
      if(blockedByBlade){
        const flySpdAtBlock = Math.hypot(w.vx, w.vy);
        const strongHit = flySpdAtBlock > 6;
        hitFX.push({x:w.x, y:w.y-8, t:'✦', life:18, big:strongHit, col:'#ffdd88'});
        playSound(strongHit ? 'clashHard' : 'clash');
        if(typeof triggerHitstop === 'function') triggerHitstop(strongHit?3:2, strongHit?3:1.5);
        if(blocker) addRage(blocker, clashRageGain());
      } else {
        hitFX.push({x:w.x,y:w.y-8,t:'✦',life:16,big:false,col:'#ffdd88'});
        if(typeof triggerHitstop === 'function') triggerHitstop(2,2);
      }
      if(w.kind === 'wand'){
        spawnWandExplosion(w.x, w.y);
      } else {
        spawnArrowShatter(w.x, w.y, w.rot);
      }
      PROJECTILES.splice(i,1); continue;
    }

    // ── Попадание в тело ──
    let hit = false;
    for(const ent of defenders){
      if(!ent || ent.hp <= 0 || ent._awaitingReveal) continue;
      if(ent === w.owner && GameTime < w.ownerImmuneUntil) continue;
      const c = entityBodyCenter(ent);
      const hitR = 22 * (isBot(ent) ? sv('cscl')*sv('botscale') : sv('cscl'));
      const d = Math.hypot(c.x-w.x, c.y-w.y);
      if(d < hitR){
        // ── Уворот ботов ──
        if(isBot(ent) && (!ent._aiState || ent._aiState.enabled !== false)){
          if(!w._dodgeRolled) w._dodgeRolled = new Set();
          if(!w._dodgeRolled.has(ent)){
            w._dodgeRolled.add(ent);
            if(Math.random() < PROJECTILE_DODGE_CHANCE){
              const dodgeDir = Math.random() < 0.5 ? -1 : 1;
              const perpX = -Math.sin(w.rot)*dodgeDir, perpY = Math.cos(w.rot)*dodgeDir;
              ent.vx += perpX*4; ent.vy += perpY*4;
              hitFX.push({x:c.x, y:c.y-20, t:'УВОРОТ!', life:30, big:false, col:'#8fd6ff'});
              continue;
            }
          }
        }
        
        // ── РАСЧЁТ УРОНА ──
        const maxPct = w.maxDmgPct || (w.kind === 'wand' ? WAND_MAX_DMG_PCT : CROSSBOW_MAX_DMG_PCT);
        let dmg = Math.round(w.dmg);
        dmg = Math.min(dmg, Math.max(1, Math.round(MAX_HP*maxPct)));
        
        // ── МОЛНИЯ ДЛЯ ЖЕЗЛА ──
        if(w.kind === 'wand' && w.shooterPos){
          const intensity = Math.min(1, (w.dmg || 10) / 30);
          spawnLightningHit(w.shooterPos.x, w.shooterPos.y, c.x, c.y, intensity);
        }
        
        // ════════════════════════════════════════════════════════════════
        // 🔥 ЕДИНЫЙ ВЫЗОВ applyDamage
        // ════════════════════════════════════════════════════════════════
        const isMagic = w.kind === 'wand';
        
        applyDamage(ent, dmg, w.owner, {
          isMagic: isMagic,
          isProjectile: true,
          knockbackMult: isMagic ? 1.5 : 1.0,
          hitstopFrames: isMagic ? 5 : 3,
          shakePower: dmg > 15 ? (isMagic ? 6 : 4) : 3,
          textColor: isMagic ? '#c090ff' : '#ff8844',
          textSuffix: isMagic ? '✨' : '🏹',
          bloodCount: isMagic ? 6 : 4,
          playSound: false
        });
        
        // ── ДОПОЛНИТЕЛЬНЫЙ СДВИГ (специфично для снарядов) ──
        const nx = d>0.1?(c.x-w.x)/d:0, ny = d>0.1?(c.y-w.y)/d:-1;
        const kb = w.kind==='wand' ? 14 : 8;
        ent.x += nx*kb*0.7; ent.y += ny*kb*0.7;
        
        // ── ВЗРЫВ ДЛЯ ЖЕЗЛА ──
        if(w.kind === 'wand') spawnWandExplosion(w.x, w.y);
        
        // ── ЗВУК ──
        playSound(w.kind==='wand' ? 'magicHit' : 'arrowHit');
        
        hit = true; break;
      }
    }
    if(hit){ PROJECTILES.splice(i,1); continue; }
  }
}

// ── ИИ: проактивный уворот ботов от летящих снарядов (жезл/арбалет) ────────
// В отличие от PROJECTILE_DODGE_CHANCE (который решает уже В МОМЕНТ попадания),
// эта проверка запускается КАЖДЫЙ кадр для каждого летящего снаряда и пытается
// заметить, что снаряд летит прямо в бота, ПОКА он ещё далеко — и увернуться
// заранее, а не стоять на месте до последнего.
function updateProjectileDodgeAI(){
  if(!dummyOn || PROJECTILES.length === 0) return;
  for(const w of PROJECTILES){
    if(!w.owner) continue;
    const spd = Math.hypot(w.vx, w.vy);
    if(spd < 0.1) continue;
    const dirX = w.vx/spd, dirY = w.vy/spd;
    for(const bot of ALL_BOTS){
      if(!bot || bot.hp <= 0 || bot._awaitingReveal || bot === w.owner) continue;
      if(bot._aiState && bot._aiState.enabled === false) continue; // манекен на паузе (T) — не уворачивается
      if(!w._preDodgeRolled) w._preDodgeRolled = new Set();
      if(w._preDodgeRolled.has(bot)) continue;

      const bc = entityBodyCenter(bot);
      const toBotX = bc.x - w.x, toBotY = bc.y - w.y;
      const along = toBotX*dirX + toBotY*dirY; // расстояние вдоль полёта до ближайшей точки к боту
      if(along <= 0 || along > 260) continue;   // снаряд либо уже пролетел мимо, либо ещё слишком далеко
      const perp = Math.abs(toBotX*(-dirY) + toBotY*dirX); // насколько снаряд "прицелен" в бота
      if(perp > 46) continue; // мимо — не целится в бота

      w._preDodgeRolled.add(bot);
      if(Math.random() < PROJECTILE_PREDODGE_CHANCE){
        const dodgeDir = Math.random() < 0.5 ? -1 : 1;
        bot._dvx = (bot._dvx||0) + (-dirY)*dodgeDir*7;
        bot._dvy = (bot._dvy||0) + (dirX)*dodgeDir*7;
        hitFX.push({x:bc.x, y:bc.y-24, t:'УВОРОТ!', life:26, big:false, col:'#8fd6ff'});
      }
    }
  }
}

function drawProjectiles(){
  for(const w of PROJECTILES){
    if(w.kind === 'wand'){
      const r = 18; // визуально в 2x крупнее (было 9)
      ctx.save();
      const grad = ctx.createRadialGradient(w.x,w.y,0,w.x,w.y,r*2.2);
      grad.addColorStop(0,'rgba(210,150,255,0.95)');
      grad.addColorStop(0.5,'rgba(150,80,255,0.5)');
      grad.addColorStop(1,'rgba(150,80,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(w.x,w.y,r*2.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0e0ff';
      ctx.beginPath(); ctx.arc(w.x,w.y,r*0.55,0,Math.PI*2); ctx.fill();
      ctx.restore();
    } else {
      const fadeA = w.fade != null ? clamp(w.fade,0,1) : 1;

      // ── Трейл: след из недавних позиций стрелы, тускнеющий к хвосту ──
      if(!w._trail) w._trail = [];
      const last = w._trail[w._trail.length-1];
      if(!last || Math.hypot(w.x-last.x, w.y-last.y) > 1){
        w._trail.push({x:w.x, y:w.y});
        if(w._trail.length > 10) w._trail.shift();
      }
      if(w._trail.length > 1){
        ctx.save();
        for(let ti = 0; ti < w._trail.length-1; ti++){
          const t0 = w._trail[ti], t1 = w._trail[ti+1];
          const frac = (ti+1) / w._trail.length;
          ctx.globalAlpha = frac * 0.5 * fadeA;
          ctx.strokeStyle = '#ffdf9a';
          ctx.lineWidth = 3 * frac;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(t0.x,t0.y); ctx.lineTo(t1.x,t1.y); ctx.stroke();
        }
        ctx.restore();
      }

      const url = w._arrowUrl || (w._arrowUrl = pickRandomSprite('arrow'));
      const img = url ? loadSpriteImage(url) : null;
      ctx.save();
      ctx.globalAlpha = fadeA;
      // ── Свечение наконечника/древка стрелы ──
      ctx.shadowColor = 'rgba(255,215,140,0.95)';
      ctx.shadowBlur = 16;
      if(img && img.complete && img.naturalWidth > 0){
        const L = 34;
        ctx.translate(w.x,w.y);
        // Допущение: спрайт стрелы нарисован ГОРИЗОНТАЛЬНО (остриём вправо).
        // Если исходный T_Arrow_01.png нарисован вертикально — раскомментировать
        // следующую строку (добавит поворот на 90°):
        // ctx.rotate(Math.PI/2);
        ctx.rotate(w.rot);
        const width = L * spriteAspectFor(img);
        ctx.drawImage(img, -L/2, -width/2, L, width);
      } else {
        // Пока спрайт не загружен — рисуем временную полоску, чтобы снаряд был виден
        ctx.translate(w.x,w.y); ctx.rotate(w.rot);
        ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(16,0); ctx.stroke();
      }
      ctx.restore();
      // Мягкое дополнительное свечение вокруг наконечника стрелы (кончик = вперёд по rot)
      const glowGrad = ctx.createRadialGradient(w.x,w.y,0,w.x,w.y,10);
      glowGrad.addColorStop(0,'rgba(255,225,160,0.55)');
      glowGrad.addColorStop(1,'rgba(255,225,160,0)');
      ctx.save();
      ctx.globalAlpha = fadeA;
      ctx.fillStyle = glowGrad;
      ctx.beginPath(); ctx.arc(w.x,w.y,10,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
}
function updateCrossbowBotAI(dt, bot){
  const target = P;
  if(target.hp <= 0) return;
  const dist = Math.hypot(target.x-bot.x, target.y-bot.y);
  const aimAngle = Math.atan2(target.y-bot.y, target.x-bot.x);
  bot.prevAngle = bot.angle;
  bot.angle = aimAngle;

  // ── Гистерезис для порогов дистанции ──
  const AVOID_DIST_ENTER = 5 * CELL_PX;
  const AVOID_DIST_EXIT  = 6.4 * CELL_PX;
  const MELEE_PANIC_ENTER = 110;
  const MELEE_PANIC_EXIT  = 170;

  if(bot._cbDecisionCD == null) bot._cbDecisionCD = 0;
  if(bot._cbPanicState == null) bot._cbPanicState = false;
  if(bot._cbAvoidState == null) bot._cbAvoidState = false;
  bot._cbDecisionCD -= rawDt;

  if(bot._cbPanicState){ if(dist > MELEE_PANIC_EXIT) bot._cbPanicState = false; }
  else { if(dist < MELEE_PANIC_ENTER) bot._cbPanicState = true; }
  if(bot._cbAvoidState){ if(dist > AVOID_DIST_EXIT) bot._cbAvoidState = false; }
  else { if(dist < AVOID_DIST_ENTER) bot._cbAvoidState = true; }

  if(bot._cbDecisionCD <= 0 || bot._cbPanicState){
    bot._cbDecisionCD = 0.15 + Math.random()*0.2;
    let mx=0, my=0;
    const prevMode = bot._cbLastMode;
    if(bot._cbPanicState){
      mx=-Math.cos(aimAngle); my=-Math.sin(aimAngle);
      bot._cbLastMode = 'panic';
    } else if(bot._cbAvoidState){
      mx=-Math.cos(aimAngle)*0.8; my=-Math.sin(aimAngle)*0.8;
      bot._cbLastMode = 'avoid';
    } else {
      if(prevMode !== 'wander') bot._cbWanderTarget = null;
      if(bot._cbWanderTarget == null || Math.hypot(bot._cbWanderTarget.x-bot.x, bot._cbWanderTarget.y-bot.y) < 40){
        bot._cbWanderTarget = { x: randRange(60, W-100), y: randRange(60, H-60) };
      }
      const wdx = bot._cbWanderTarget.x-bot.x, wdy = bot._cbWanderTarget.y-bot.y;
      const wl = Math.hypot(wdx,wdy) || 1;
      mx = wdx/wl; my = wdy/wl;
      bot._cbLastMode = 'wander';
    }
    // Отталкивание от стен
    const WALL_MARGIN = 130;
    const _bl=40, _br=W-80, _bt=40, _bb=H-40;
    const dL=bot.x-_bl, dR=_br-bot.x, dT=bot.y-_bt, dB=_bb-bot.y;
    let wallX=0, wallY=0;
    if(dL<WALL_MARGIN) wallX += (WALL_MARGIN-dL)/WALL_MARGIN;
    if(dR<WALL_MARGIN) wallX -= (WALL_MARGIN-dR)/WALL_MARGIN;
    if(dT<WALL_MARGIN) wallY += (WALL_MARGIN-dT)/WALL_MARGIN;
    if(dB<WALL_MARGIN) wallY -= (WALL_MARGIN-dB)/WALL_MARGIN;
    if(wallX||wallY){
      mx += wallX*1.3; my += wallY*1.3;
      const mLen=Math.hypot(mx,my);
      if(mLen>0.001){ mx/=mLen; my/=mLen; }
    }
    const jitter = (Math.random()-0.5) * 0.5;
    mx += -Math.sin(aimAngle)*jitter; my += Math.cos(aimAngle)*jitter;
    bot._cbMoveX = mx; bot._cbMoveY = my;
  }
  let mx = bot._cbMoveX||0, my = bot._cbMoveY||0;

  // Скорость
  const exhMult = bot.exhausted > 0 ? bot.exhaustSpd : 1;
  const unbMult = hasMod(bot, 'weaponRecoil') ? 0.3 : 1;
  const speedMult = exhMult * unbMult;
  const _dShDef = shieldDef(bot);
  const _dShWeight = _dShDef ? _dShDef.weight : 0;
  const _dShWrong = _dShDef && shieldSameSideAsSword(bot);
  const _dShBaseMult = _dShDef ? (1 - 0.15 - _dShWeight*0.1) : 1.0;
  const _dShWrongMult = _dShWrong ? 0.8 : 1.0;
  const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
  const botSpeedMult = Math.max(0.5, 1 - (botCount - 1) * 0.08);
  const retreatScale = bot._cbPanicState ? 1.0 : 0.85;
  const dbBlockSlow = (bot._blockSlow||0) > GameTime ? sv('blockSlowMult') : 1;
  const maxV = 6 * sv('botspd') * speedMult * retreatScale * dbBlockSlow * sv('globalspd') * botSpeedMult * _dShBaseMult * _dShWrongMult * weaponMoveSpeedMult(bot);
  
  bot.vx = lerpDT(bot.vx, mx*maxV, 0.16, dt);
  bot.vy = lerpDT(bot.vy, my*maxV, 0.16, dt);
  bot.vx = clamp(bot.vx,-15,15); bot.vy = clamp(bot.vy,-15,15);
  bot.x = clamp(bot.x+bot.vx, 40, W-80);
  bot.y = clamp(bot.y+bot.vy, 40, H-40);
  resolveBoxCollision(bot);

// Усталость/стамина/дисбаланс бота обрабатывает updateDummy(), которая
  // вызывается для этого же бота следующим шагом в игровом цикле —
  // здесь ничего не трогаем, чтобы не декрементить exhausted дважды за кадр.

// 🔥 СТРЕЛЬБА (лук и арбалет — единая точка входа)
  let ready = bot.stamina > 0 && bot.exhausted <= 0 && !(GameTime < (bot._rangedShotCD||0));

  const _wKey = weaponKeyOf(bot);

  // Лук: бот не должен держать тетиву натянутой вечно — отпускаем
  // (стреляем) через случайные 1-6 сек после начала натяжения.
  if(_wKey === 'bow'){
    if(bot._bowCharging){
      if(bot._bowHoldLimit === undefined){
        bot._bowHoldLimit = rf(1, 5) + 1; // 1..6 сек
      }
      if(GameTime - bot._bowChargeStart >= bot._bowHoldLimit){
        ready = false; // сигнал updateRangedWeaponFire отпустить тетиву
      }
    } else {
      bot._bowHoldLimit = undefined; // сброс перед следующим натяжением
    }
  }

  // Арбалет: запоминаем прежний CD, чтобы после выстрела иногда
  // добавить случайную доп. задержку (см. ниже).
  const _prevRangedCD = bot._rangedShotCD || 0;

  updateRangedWeaponFire(bot, ready, aimAngle);

  // Арбалет: иногда (40%) добавляем случайную доп. паузу 1-3 сек к КД,
  // чтобы боты не стреляли строго метрономом.
  if(_wKey === 'crossbow' && bot._rangedShotCD > _prevRangedCD && Math.random() < 0.4){
    bot._rangedShotCD += rf(1, 2) + 1; // доп. 1..3 сек
  }

  updateCrossbowReloadSound(bot);
}


// 🔥 ОБЩАЯ ФУНКЦИЯ ДЛЯ РАСЧЁТА МАКСИМАЛЬНОЙ СКОРОСТИ БОТА
function getBotMaxSpeed(bot){
  return calcSpeedMultipliers(bot, false);
}









// ── ИИ: Жезл — циклический режим дальнего боя, откат в ближний бой вплотную ──
// Возвращает true, если в этот тик отработал дальний режим (обычный updateAI
// вызывать НЕ нужно); false — если сейчас фаза ближнего боя (пусть работает
// обычный updateAI, как для любого другого оружия).
function updateWandBotAI(dt, bot){
  const target = P;
  const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
  const aimAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
  const weaponKey = weaponKeyOf(bot);

  // ════════════════════════════════════════════════════════════════════
  // 🔥 МАГИЧЕСКИЙ ПОСОХ - ДОПОЛНИТЕЛЬНАЯ ЛОГИКА К ОБЫЧНОМУ БОЮ
  // ════════════════════════════════════════════════════════════════════
  if(weaponKey === 'magicstaff'){
    // Инициализация
    if(bot._magicStaffAI === undefined){
      bot._magicStaffAI = {
        state: 'idle',        // idle | charging | cooldown
        chargeStart: 0,
        timeInState: 0,
        fireHeld: false,
        lastChargeAttempt: 0,
      };
    }
    
    const magicAI = bot._magicStaffAI;
    magicAI.timeInState += dt;
    
// ── УСЛОВИЯ ДЛЯ МАГИИ ──
const isPlayerExhausted = isExhausted(P) || P.stamina < 30;
const isInRange = dist < MAGICSTAFF_RADIUS * 0.9  && dist > 30;
const hasStamina = bot.stamina > 10;
const isReady = GameTime >= (bot._rangedShotCD || 0);
const notCharging = magicAI.state !== 'charging' && magicAI.state !== 'cooldown';

// 🔥 ПРОВЕРКА ЯРОСТИ ДЛЯ БОТА (НУЖНО >= 50)
const hasRage = (bot.rage || 0) >= 50;

// ════════════════════════════════════════════════════════════════════
// 🔥 РЕШЕНИЕ: ИСПОЛЬЗОВАТЬ МАГИЮ
// ════════════════════════════════════════════════════════════════════
let shouldUseMagic = false;

// Случай 1: Игрок устал - 70% шанс начать зарядку
if(isPlayerExhausted && isInRange && hasStamina && isReady && notCharging && hasRage){
  shouldUseMagic = Math.random() < 0.7;
}

// Случай 2: Игрок НЕ устал - 20% шанс начать зарядку (для разнообразия)
if(!shouldUseMagic && isInRange && hasStamina && isReady && notCharging && hasRage && Math.random() < 0.6){
  shouldUseMagic = true;
  console.log('🔮 БОТ РЕШИЛ КАСТОВАТЬ, ХОТЯ ИГРОК НЕ УСТАЛ!');
}

// ════════════════════════════════════════════════════════════════════
// 🔥 ЕСЛИ МОЖНО ИСПОЛЬЗОВАТЬ МАГИЮ - НАЧИНАЕМ ЗАРЯДКУ
// ════════════════════════════════════════════════════════════════════
if(shouldUseMagic){
  console.log('🔮 БОТ НАЧИНАЕТ ЗАРЯДКУ МАГИИ! (ярость:', Math.round(bot.rage), ')');
  magicAI.state = 'charging';
  magicAI.chargeStart = GameTime;
  magicAI.fireHeld = true;
  magicAI.timeInState = 0;
  
  bot._magicCharging = true;
  bot._magicChargeStart = GameTime;
  bot._magicChargeSoundObj = playControllableSound('magicEnergy');
  

  
  hitFX.push({x: bot.x, y: bot.y - 40, t: '🔮 ЗАРЯДКА!', life: 30, big: false, col: '#88ddff'});
  bot.stamina = Math.max(0, bot.stamina - 10);
  
  // 🔥 ВОЗВРАЩАЕМ true - бот занят зарядкой
  return true;
}

// ── ПРОЦЕСС ЗАРЯДКИ ──
if(magicAI.state === 'charging'){
  const chargeTime = GameTime - magicAI.chargeStart;
  
  // Бот стоит на месте
  bot.vx = lerpDT(bot.vx, 0, 0.9, dt);
  bot.vy = lerpDT(bot.vy, 0, 0.9, dt);
  bot.x = clamp(bot.x + bot.vx, 40, W-80);
  bot.y = clamp(bot.y + bot.vy, 40, H-40);
  bot.angle = aimAngle;
  bot.stamina = Math.max(0, bot.stamina - 15 * dt);
  
  // Вызываем updateRangedWeaponFire с fireHeld = true
  updateRangedWeaponFire(bot, true, aimAngle);
  
  // ── УСЛОВИЯ ПРЕРЫВАНИЯ ──
  const playerRecovered = P.exhausted <= 0 && P.stamina > 60;
  const playerTooFar = dist > MAGICSTAFF_RADIUS * 2.5;
  const playerTooClose = dist < 10;
  const outOfStamina = bot.stamina < 5;
  
  if( playerTooFar || playerTooClose || outOfStamina){
    console.log('❌ ПРЕРЫВАНИЕ ЗАРЯДКИ');
    magicAI.state = 'idle';
    magicAI.fireHeld = false;
    bot._magicCharging = false;
    
    updateRangedWeaponFire(bot, false, aimAngle);
    
    if(bot._magicChargeSoundObj){
      fadeOutSound(bot._magicChargeSoundObj, 0.2);
      bot._magicChargeSoundObj = null;
    }
    
    let reason = 'ПРЕРВАНО';
    if(playerRecovered) reason = '💪 ИГРОК ОК';
    else if(playerTooFar) reason = '📏 ДАЛЕКО';
    else if(playerTooClose) reason = '😱 БЛИЗКО';
    else if(outOfStamina) reason = '😫 НЕТ СТАМ';
    hitFX.push({x: bot.x, y: bot.y - 40, t: '❌ ' + reason, life: 20, big: false, col: '#ff8844'});
    bot._rangedShotCD = GameTime + 0.5;
    
    // 🔥 ВОЗВРАЩАЕМ false - позволяем обычному AI взять управление
    return false;
  }
// ── ВЗРЫВ ──
if(chargeTime >= MAGICSTAFF_CHARGE_FULLTIME){
 bot.stamina = Math.min(bot.stamMax || 100, bot.stamina + dt * 30)
  console.log('💥 ВЗРЫВ МАГИИ!');
  const progress = Math.min(1, (chargeTime - 2.0) / 2.0);
  const dmg = MAGICSTAFF_DMG_MIN + (MAGICSTAFF_DMG_MAX - MAGICSTAFF_DMG_MIN) * progress ;
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  bot.rage = 0
  magicAI.fireHeld = false;
  bot._magicCharging = false;
  
  // ════════════════════════════════════════════════════════════════════
  // 🔥 ВЫЗЫВАЕМ ВЗРЫВ С ЭФФЕКТАМИ
  // ════════════════════════════════════════════════════════════════════
  spawnMagicStaffExplosion(bot, radius, dmg * 3);
  
  // Отдельно вызываем звук (если он уже есть в spawnMagicStaffExplosion, то можно убрать)
  playSound('magicPush');
  
  bot.vx -= Math.cos(aimAngle) * 5;
  bot.vy -= Math.sin(aimAngle) * 5;
  bot._rangedShotCD = GameTime + MAGICSTAFF_SHOT_CD + 1.5;
  
  if(bot._magicChargeSoundObj){
    fadeOutSound(bot._magicChargeSoundObj, 0.2);
    bot._magicChargeSoundObj = null;
  }
  
  magicAI.state = 'cooldown';
  magicAI.timeInState = 0;
  
  // Текст взрыва (уже есть внутри spawnMagicStaffExplosion, но можно оставить)
  hitFX.push({x: bot.x, y: bot.y - 50, t: '💥 ВЗРЫВ!', life: 50, big: true, col: '#88ddff'});
  
  // 🔥 ПОСЛЕ ВЗРЫВА - ВОЗВРАЩАЕМСЯ К ОБЫЧНОМУ БОЮ
  return false;
}
      
      // Показываем прогресс
      if(chargeTime > 1.0 && chargeTime < 2.0){
        const progress = (chargeTime - 1.0) / 1.0;
        if(Math.floor(chargeTime * 4) % 2 === 0){
          hitFX.push({x: bot.x, y: bot.y - 30, t: '⏳ ' + Math.round(progress * 100) + '%', life: 3, big: false, col: '#88ddff'});
        }
      }
      
      return true; // Всё ещё заряжаем
    }
    
    // ── КУЛДАУН ──
    if(magicAI.state === 'cooldown'){
      magicAI.timeInState += dt;
      
      if(GameTime >= bot._rangedShotCD){
        magicAI.state = 'idle';
        magicAI.timeInState = 0;
        console.log('✅ КУЛДАУН ЗАКОНЧИЛСЯ');
        // 🔥 ВОЗВРАЩАЕМ false - позволяем обычному AI взять управление
        return false;
      }
      
      // В кулдауне - просто ждём, обычный AI не должен двигать бота
      // Но разрешаем обычному AI драться
      return false;
    }
    
    // ── IDLE ──
    // Если не используем магию - ОТДАЁМ УПРАВЛЕНИЕ ОБЫЧНОМУ AI
    if(magicAI.state === 'idle'){
      // Проверяем, не пора ли начать зарядку (ещё раз)
      if(shouldUseMagic){
        // Если условия изменились - начинаем зарядку
        magicAI.state = 'charging';
        magicAI.chargeStart = GameTime;
        magicAI.fireHeld = true;
        magicAI.timeInState = 0;
        
        bot._magicCharging = true;
        bot._magicChargeStart = GameTime;
        bot._magicChargeSoundObj = playControllableSound('magicEnergy');
        
        hitFX.push({x: bot.x, y: bot.y - 40, t: '🔮 ЗАРЯДКА!', life: 30, big: false, col: '#88ddff'});
        bot.stamina = Math.max(0, bot.stamina - 10);
        return true;
      }
      
      // 🔥 ОТДАЁМ УПРАВЛЕНИЕ ОБЫЧНОМУ AI (ближний бой)
      return false;
    }
    
    return false;
  }
  // ════════════════════════════════════════════════════════════════════
  // 🔥 ЖЕЗЛ - ОБЫЧНАЯ ЛОГИКА
  // ════════════════════════════════════════════════════════════════════
  if(bot._wandMode == null) bot._wandMode = 'melee';
  if(bot._wandModeUntil == null) bot._wandModeUntil = GameTime + rf(7,9);

  const CLOSE_RANGE = 90;

  if(bot._wandMode === 'ranged' && dist < CLOSE_RANGE){
    bot._wandMode = 'melee';
    bot._wandModeUntil = GameTime + rf(7,9);
    bot._wandCharging = false;
    return false;
  }

  if(GameTime >= bot._wandModeUntil){
    if(bot._wandMode === 'melee'){
      bot._wandMode = 'ranged';
      bot._wandModeUntil = GameTime + randRange(2,4);
    } else {
      bot._wandMode = 'melee';
      bot._wandModeUntil = GameTime + rf(7,9);
      bot._wandCharging = false;
    }
  }

  if(bot._wandMode === 'melee') return false;

  // ── Режим дальнего боя (жезл) ──
  const PREF_DIST = 240;
  let mx=0, my=0;
  if(dist < PREF_DIST*0.8){ mx=-Math.cos(aimAngle); my=-Math.sin(aimAngle); }
else if(dist > PREF_DIST*1.3){ mx=Math.cos(aimAngle); my=Math.sin(aimAngle); }
const maxV = 5 * sv('gamespeed');
bot.vx = lerpDT(bot.vx, mx*maxV, 0.2, dt);
bot.vy = lerpDT(bot.vy, my*maxV, 0.2, dt);
bot.vx = clamp(bot.vx,-15,15); bot.vy = clamp(bot.vy,-15,15);
if(!bot._wandCharging){
  bot.x = clamp(bot.x+bot.vx, 40, W-80);
  bot.y = clamp(bot.y+bot.vy, 40, H-40);
}

// 🔥 ВАЖНО: синхронизируем угол меча с aimAngle перед выстрелом
bot.angle = aimAngle; // ← ДОБАВЬТЕ ЭТУ СТРОЧКУ

bot.stamina = Math.min(bot.stamMax||100, bot.stamina + rawDt*40);
const chargeDone = bot._wandCharging && (GameTime - bot._wandChargeStart >= wandChargeTimeFor(bot));
const fireHeld = bot.stamina > 20 && bot.exhausted <= 0 && !chargeDone;
updateRangedWeaponFire(bot, fireHeld, aimAngle);
return true;
}

// ──────────────── END LAYER: RANGED ────────────────

// ════════════════════════════════════════════════════════════════════════════
