// === src/combat/ranged.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: RANGED WEAPONS — Wand, Crossbow, Magic Staff (projectiles, charging, AI behavior)
// Module file: ranged.js
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••

// ─── WAND SETTINGS ───
// WAND_CHARGE_TIME — charge duration, if not provided in WeaponTable.txt via chargeTime.
const WAND_CHARGE_TIME = 0.5;   // seconds before projectile fires (the longer, the more powerful)
const WAND_PROJ_SPEED  = 13;    // projectile speed, px/frame
const WAND_BASE_DMG    = 20;    // base damage, multiplied by 1x..2x depending on rage
const WAND_SHOT_CD     = 0.35;  // pause between shots. On mobile it's slightly longer
const WAND_MAX_DMG_PCT = 0.25;  // max damage as % of target's MAX_HP per hit

// ── WAND charge time from WeaponTable.txt (if available), otherwise WAND_CHARGE_TIME.
function wandChargeTimeFor(ent){
  const d = weaponDefFor(ent);
  return (d && d.chargeTime != null) ? d.chargeTime : WAND_CHARGE_TIME;
}


// ─── MAGIC STAFF SETTINGS ───
const MAGICSTAFF_CHARGE_FULLTIME = 1.5;   // seconds to fully charge
const MAGICSTAFF_CHARGE_MINTIME  = 0.4;   // minimum charge time before release

const MAGICSTAFF_DMG_MIN = 20;        // minimum damage
const MAGICSTAFF_DMG_MAX = 50;       // maximum damage at full charge
const MAGICSTAFF_RADIUS = 280;        // explosion radius (2 cells)
const MAGICSTAFF_KB_FORCE = 15;       // knockback strength
const MAGICSTAFF_SHOT_CD = 1.0;       // cooldown between explosions
const MAGICSTAFF_STAMINADRAIN = 2.5;  // stamina drain per second

// ─── MAGIC STAFF EFFECTS ───

let MAGICSTAFF_CHARGE_FX = [];
let MAGICSTAFF_LIGHTNING_FX = [];
let MAGICSTAFF_GLOW_FX = [];


// ─── CROSSBOW SETTINGS ───
const CROSSBOW_PROJ_SPEED = 25;  // projectile speed, px/frame (about 2x faster than wand)
const CROSSBOW_DMG_MIN    = 20;
const CROSSBOW_DMG_MAX    = 56;
const CROSSBOW_RELOAD     = 1.6;  // seconds between shots (about 1.5x slower than wand)
const CROSSBOW_MAX_DMG_PCT= 0.45;
// ─── BOW SETTINGS ───
const BOW_PROJ_SPEED = 15;    // projectile speed, px/frame (slower than crossbow)
const BOW_DMG_MIN    = 4;
const BOW_DMG_MAX    = 50;
const BOW_RELOAD     = 1.0;   // seconds between shots (1 second for full draw)
const BOW_MAX_DMG_PCT= 0.35;  // max damage as % of target's MAX_HP


// ── Chance for a bot to dodge a projectile completely (no damage).
const PROJECTILE_DODGE_CHANCE = 0.15;
// ── Chance for a bot to predictively dodge a projectile before it reaches them.
const PROJECTILE_PREDODGE_CHANCE = 0.25;

let PROJECTILES = []; // {kind:'wand'|'arrow', x,y,vx,vy,rot,owner,dmg,ownerImmuneUntil,bornAt,fade,img}
let WAND_PARTICLES = []; // {x,y,tx,ty,life,maxLife,owner} — particles during charging, attracted to wand tip

// ── Helper: spawns a projectile (wand or arrow) at the weapon tip with given angle and damage.
function spawnProjectile(owner, kind, angle, dmg, speedOverride, maxDmgPct){
  const c = $.POS.tip(owner);
  
  let speed;
  if (speedOverride !== undefined) {
    speed = speedOverride;
  } else if (kind === 'wand') {
    speed = WAND_PROJ_SPEED;
  } else {
    speed = CROSSBOW_PROJ_SPEED;
  }
  
  // Use provided maxDmgPct or default based on weapon type
  const maxPct = maxDmgPct || (kind === 'wand' ? WAND_MAX_DMG_PCT : CROSSBOW_MAX_DMG_PCT);
  
  PROJECTILES.push({
    kind, x: c.x, y: c.y,
    vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
    rot: angle, owner, dmg,
    maxDmgPct: maxPct,
    ownerImmuneUntil: GameTime + 0.15,
    bornAt: GameTime,
    // Save shooter position for lightning trail effects
    shooterPos: {x: c.x, y: c.y},
  });
  $.FX.hit({x:c.x, y:c.y-30, t: kind==='wand' ? '✨' : '➹', life:20, big:false, col: kind==='wand'?'#c090ff':'#d9c08a'});
}





// ─── WAND PARTICLES ──────────────────────────────────────────────────────
// Attracted particles orbiting the wand tip while charging.
function updateWandChargeParticles(dt, ent){
  const tip = $.POS.tip(ent);
  // Periodically spawn new particles around the character
  ent._wandParticleSpawnCD = (ent._wandParticleSpawnCD||0) - dt;
  if(ent._wandParticleSpawnCD <= 0){
    ent._wandParticleSpawnCD = 0.02;
    const c = $.POS.body(ent);
    const a = Math.random()*Math.PI*2;
    const r = 30 + Math.random()*40;
    WAND_PARTICLES.push({
      x: c.x + Math.cos(a)*r, y: c.y + Math.sin(a)*r - 10,
      owner: ent, life: 1, maxLife: 1,
    });
  }
  // Move existing particles toward the wand tip
  for(const p of WAND_PARTICLES){
    if(p.owner !== ent) continue;
    p.x += (tip.x - p.x) * $.M.clamp(dt*6, 0, 1);
    p.y += (tip.y - p.y) * $.M.clamp(dt*6, 0, 1);
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
    const a = $.M.clamp(p.life / p.maxLife, 0, 1);
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

// ─── WAND EXPLOSIONS ────────────────────────────────────────────────────
// Flash/spark effects when wand projectile hits something.
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
    const a = $.M.clamp(p.life / p.maxLife, 0, 1);
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
  
  // Outer glow
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, 'rgba(200, 240, 255, 0)');
  grad.addColorStop(0.3, `rgba(150, 220, 255, ${p * 0.3})`);
  grad.addColorStop(0.7, `rgba(80, 180, 255, ${p * 0.2})`);
  grad.addColorStop(1, 'rgba(40, 120, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  
  // Bright center core
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
  
  const c = $.POS.body(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  
  // Only show after 1.5 seconds of charging
  const chargeTime = GameTime - ent._magicChargeStart;
  if(chargeTime < 1.5) return;
  
  const alpha = (chargeTime - 1.5) / 0.5 * 0.3;
  const pulse = 0.8 + 0.2 * Math.sin(GameTime * 3);
  
  ctx.save();
  ctx.globalAlpha = Math.min(0.3, alpha * pulse);
  

  
  // Inner pulsing ring
  const innerRadius = radius * (0.7 + 0.3 * Math.sin(GameTime * 2));
  ctx.strokeStyle = 'rgba(150, 220, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.x, c.y, innerRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Orbiting dots along the radius
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
  const tip = $.POS.tip(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  
  // Flickering glow at the staff tip
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
      // Remove without using splice for O(1) performance
      arr[i] = arr[arr.length - 1];
      arr.pop();
    }
  }
}







function drawMagicStaffGlow(){
  for(const g of MAGICSTAFF_GLOW_FX){
    const a = g.life * g.alpha;
    if(a < 0.01) continue;
    
    // Safety check for invalid values
    if(!isFinite(g.x) || !isFinite(g.y) || !isFinite(g.size) || g.size <= 0) continue;
    
    ctx.save();
    ctx.globalAlpha = a;
    
    // Glow gradient
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
      // Fallback if gradient creation fails
      ctx.fillStyle = `rgba(100, 200, 255, ${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, Math.max(1, g.size * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Bright core
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
  const c = $.POS.body(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const numBolts = 3 + Math.floor(progress * 5); // 3-8 bolts
  
  for(let i = 0; i < numBolts; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + progress * 80 + Math.random() * 40;
    const startX = c.x + Math.cos(angle) * dist;
    const startY = c.y + Math.sin(angle) * dist - 10;
    
    // Create zigzag lightning (multiple segments) with random jitter
    const segments = 3 + Math.floor(progress * 3);
    let points = [{x: startX, y: startY}];
    let currentX = startX, currentY = startY;
    
    for(let s = 0; s < segments; s++){
      const t = (s + 1) / segments;
      const targetX = c.x + Math.cos(angle) * dist * (1 - t * 0.9);
      const targetY = c.y + Math.sin(angle) * dist * (1 - t * 0.9) - 10;
      // Jitter: random offset perpendicular to the main direction
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
    // Outer glow
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
    
    // Inner bright core
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
  const c = $.POS.body(ent);
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  const count = 3 + Math.floor(progress * 5);
  
  for(let i = 0; i < count; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.3 + Math.random() * 0.7);
    const speed = 0.5 + progress * 2;
    
    // Safety check for NaN
    const x = c.x + Math.cos(angle) * dist * 0.2;
    const y = c.y + Math.sin(angle) * dist * 0.2 - 10;
    const targetX = c.x + Math.cos(angle) * dist;
    const targetY = c.y + Math.sin(angle) * dist - 10;
    const r = 2 + progress * 4 + Math.random() * 3;
    
    // Skip if any value is NaN
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
    // Move toward target
    p.x += (p.targetX - p.x) * dt * 2;
    p.y += (p.targetY - p.y) * dt * 2;
    p.alpha *= 0.995;
    if(p.life <= 0 || p.alpha < 0.01){
      // Remove without using splice for O(1) performance
      arr[i] = arr[arr.length - 1];
      arr.pop();
    }
  }
}



function spawnMagicStaffRadiusParticles(ent){
  const c = $.POS.body(ent);
  const progress = Math.min(1, (GameTime - ent._magicChargeStart) / MAGICSTAFF_CHARGE_FULLTIME);
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  
  // Fewer particles on mobile for performance
  const count = window.IS_MOBILE ? 1 + Math.floor(progress * 2) : 2 + Math.floor(progress * 4);
  
  for(let i = 0; i < count; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.6 + Math.random() * 0.4);
    const speed = 0.5 + progress * 1.5;
    
    // Particle starts near center and drifts outward
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
  // Update existing particles
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
  
  // Filter out dead particles
  MAGICSTAFF_CHARGE_FX = MAGICSTAFF_CHARGE_FX.filter(p => {
    return p.life > 0 && 
           p.alpha > 0.01 && 
           isFinite(p.x) && 
           isFinite(p.y) && 
           isFinite(p.r) &&
           p.r > 0;
  });
  
  // Draw all particles
  for(const p of MAGICSTAFF_CHARGE_FX){
    const a = p.life * p.alpha;
    if(a < 0.01) continue;
    
    // Safety check for invalid values
    if(!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.r) || p.r <= 0) continue;
    
    ctx.save();
    ctx.globalAlpha = a * 0.8;
    
    // Glow with radius
    const radius = Math.max(1, p.r * 2); // Ensure positive radius
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
    
    // Bright core
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



// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// ─── UNIFIED DAMAGE FUNCTION ───
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
function applyDamage(defender, damage, attacker, options){
const dC2 = $.POS.body(defender);

  if(!defender || defender.hp <= 0) return;
  if(typeof FactionRules!=='undefined'){
    if(!FactionRules.canDamage(attacker,defender)) return;
    FactionRules.contact(attacker,defender);
  }

  if(damage <= 0) return;
  if(defender._hitCD !== undefined && defender._hitCD >= GameTime) return;
// ─── OPTIONS ───
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

  // ─── DAMAGE APPLICATION ───
  const finalDmg = Math.min(damage, Math.max(1, Math.round(MAX_HP * 0.70))); // 70% max per hit
  defender.hp = Math.max(0, defender.hp - finalDmg);
  defender._hitCD = Math.max(defender._hitCD || -1, GameTime + 0.4);
  defender.hitFlash = GameTime + 0.3;
  defender._healthBarUntil = GameTime + 3;
  if(attacker) attacker._healthBarUntil = GameTime + 3;

  // ─── LIGHTNING EFFECT ───
  if(spawnLightning && typeof spawnLightningHit === 'function'){
    const dC = $.POS.body(defender);
    spawnLightningHit(
      spawnLightning.fromX, 
      spawnLightning.fromY, 
      dC.x, 
      dC.y, 
      spawnLightning.intensity
    );
  }

  // ─── KNOCKBACK ───
  if(attacker && knockbackMult > 0){
    const aC = $.POS.body(attacker);
    const dC = $.POS.body(defender);
    const dx = dC.x - aC.x;
    const dy = dC.y - aC.y;
    const len = Math.hypot(dx, dy) || 1;
    const kb = sv('bodyKB') * 0.5 * knockbackMult;
    defender.vx += (dx / len) * kb;
    defender.vy += (dy / len) * kb;
  }
  

  
  // ─── BLOOD ───

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
  
  // ─── BLOOD POOL ───
  if(typeof spawnBloodPool === 'function'){
    spawnBloodPool(dC2.x, dC2.y, finalDmg);
  }
  
  // ─── DAMAGE TEXT ───
  let label = '-' + finalDmg;
  if(isMagic) label += ' ✨';
  if(isExplosion) label += ' 💥';
  if(isProjectile) label += ' ➹';
  if(textSuffix) label += ' ' + textSuffix;
  
  $.FX.hit({
    x: dC2.x,
    y: dC2.y - 35 - (Math.random() - 0.5) * 8, // slight vertical randomness
    t: label,
    life: 45,
    big: finalDmg > 15,
    col: textColor
  });
  
  // ─── HITSTOP ───
  if(typeof triggerHitstop === 'function'){
    triggerHitstop(hitstopFrames, shakePower);
  }
  
  // ─── SOUND ───
  if(playSoundOpt !== false){
    if(isMagic || isExplosion){
      $.S.play('magicHit');
      if(finalDmg > 30) $.S.play('clashHard');
    } else if(isProjectile){
      $.S.play('arrowHit');
    } else {
      $.S.play(isHeavySwingWeapon(attacker) ? 'damageHammer' : 'damage');
    }
  }
  
  // ─── DEATH ───
  if(defender.hp <= 0){
    if(typeof handleCombatDeath === 'function') handleCombatDeath(defender);
  }
}

// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// ─── MAGIC STAFF EXPLOSION ───
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// ─── Magic Staff Explosion A ───
function spawnMagicStaffExplosion(ent, radius, dmg){
  const c = $.POS.body(ent);
  console.log('💥 Magic Staff Explosion!', {radius, dmg});
  
  // ─── PARTICLE BURST (50 particles) ───
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
  
  // ─── FLASH EFFECT ───
  FX_EFFECTS.push({
    type: 'flash', 
    x: c.x, y: c.y, 
    t: 0, 
    duration: 20, 
    angle: 0, 
    followEntity: ent
  });
  

  
  // ─── EXPLOSION EFFECT ───
  FX_EFFECTS.push({
    type: 'magic_explosion', 
    x: c.x, y: c.y, 
    t: 0, 
    duration: 30, 
    angle: 0, 
    followEntity: ent,
    radius: radius
  });
  $.S.play('magicExplode');
  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
  // ─── DAMAGE APPLICATION VIA applyDamage ───
  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
  const defenders = [P, ...ALL_BOTS];
  
  for(const defender of defenders){
    if(defender === ent || defender.hp <= 0) continue;
    const dC = $.POS.body(defender);
    const dist = Math.hypot(dC.x - c.x, dC.y - c.y);
    
    if(dist < radius){
const minFactor = 0.5; // 50% damage minimum — closest hits deal full
const distFactor = Math.max(minFactor, 1 - dist / radius);
let finalDmg = Math.round(dmg * distFactor);
      const intensity = Math.min(1, distFactor * 1.5);
      // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
      // ─── UNIFIED applyDamage CALL ───
      // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
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










// ─── ARROW SHATTER EFFECT ──────────────────────────────────────────────────────
// Creates wood splinters and feather fragments when an arrow is blocked.
let ARROW_SHATTER_FX = []; // {x,y,vx,vy,life,maxLife,rot,rotSpd,len,kind}
function spawnArrowShatter(x, y, incomingAngle){
  const n = 7;
  const backAngle = incomingAngle + Math.PI; // opposite to incoming trajectory
  for(let i = 0; i < n; i++){
    const spread = (Math.random()-0.5) * 1.8; // wider spread, not too focused backwards
    const a = backAngle + spread;
    const spd = 1.5 + Math.random()*3.5;
    const isFeather = i < 2; // the first two are feathers (lighter)
    ARROW_SHATTER_FX.push({
      x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 1, // slight upward bias for visual variety
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
    p.vy += dt*9; // gravity, pulling fragments down
    p.vx *= 0.96; p.vy *= 0.98;
    p.rot += p.rotSpd*dt;
    p.life -= dt*1.8;
    if(p.life <= 0) ARROW_SHATTER_FX.splice(i,1);
  }
}
function drawArrowShatterFX(){
  for(const p of ARROW_SHATTER_FX){
    const a = $.M.clamp(p.life / p.maxLife, 0, 1);
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

let BOW_TENSION_FX = []; // particles for bow draw tension
function spawnBowTensionFX(ent){
  const tip = $.POS.tip(ent);
  const progress = Math.min(1, (GameTime - ent._bowChargeStart) / BOW_RELOAD);
  
  // Particle spawn chance
  const count = Math.random() < 0.6 ? 1 : 0; // 60% chance for 1 particle, 40% for 0
  
  for(let i = 0; i < count; i++){
    const spread = (Math.random() - 0.5) * 0.25; // slight spread angle
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
      r: 0.8 + Math.random() * 1.2, // particle size
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
    
    // Glow gradient
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
    grad.addColorStop(0, `rgba(255, 200, 100, ${a * 0.9})`);
    grad.addColorStop(0.3, `rgba(255, 180, 80, ${a * 0.6})`);
    grad.addColorStop(1, `rgba(255, 150, 50, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Bright center core
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
  // Clear all magic staff effect arrays
  MAGICSTAFF_CHARGE_FX = [];
  MAGICSTAFF_LIGHTNING_FX = [];
  MAGICSTAFF_GLOW_FX = [];
  
  // Reset entity state
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
  const c = $.POS.body(ent);
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
// ─── UNIFIED RANGED WEAPON FIRE HANDLER ─────────────────────────────────
// Called from update() for both player and bots (mDown and click/release), and can
// override aim angle for AI. aimAngleOverride is used for bots, otherwise
// the cursor position determines the aim.
function updateRangedWeaponFire(ent, fireHeld, aimAngleOverride){
  const key = weaponKeyOf(ent);
  
  // ============================================================
  // ─── WAND ───
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
  // Lightning bolts (every 0.1 sec)
  if(!ent._lightningCD) ent._lightningCD = 0;
  ent._lightningCD -= rawDt;
  if(ent._lightningCD <= 0){
    ent._lightningCD = 0.1;
    spawnMagicStaffLightning(ent);
  }
  
  // Glow at the tip (every frame)
  spawnMagicStaffGlow(ent);
  
  
  
  
  // Particles (every 0.05 sec)
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
            : (ent === P ? Math.atan2(mY - $.POS.root().y, mX - $.POS.root().x) : ent.angle);
          const rageMult = 1 + $.M.clamp(ent.rage||0, 0, 100)/100;
          spawnProjectile(ent, 'wand', aimAngle, WAND_BASE_DMG * rageMult);
          drainStamina(ent, sv('stamswing') * weaponStaminaMult(ent));
          if(ent.stamina <= 0 && !isExhausted(ent)) applyExhaust(ent);
          $.S.play('magicPush');
          ent.rage = 0;
          ent._rangedShotCD = GameTime + WAND_SHOT_CD;
          ent.vx -= Math.cos(aimAngle) * 7;
          ent.vy -= Math.sin(aimAngle) * 7;
        }
      }
    }
    
  // ============================================================
  // ─── BOW ───
  // ============================================================
// ─── BOW ───
  } else if(key === 'bow'){
    if(fireHeld && ent.hasWeapon !== false && !isExhausted(ent) && !(GameTime < (ent._rangedShotCD||0))){
      if(!ent._bowCharging){
        ent._bowCharging = true;
        ent._bowChargeStart = GameTime;
        ent._bowSeed = Math.random() * 100;
        ent._bowTensionSound = playControllableSound('bowTension');
        ent._reloadSoundPlayed = false;
      }
      
      // Drain stamina continuously while holding
      const staminaDrain = 3 * rawDt;
      drainStamina(ent, staminaDrain);
      
      // If stamina runs out - release immediately
      if(ent.stamina <= 0 && !isExhausted(ent)){
        applyExhaust(ent);
		 ent._hadExhaustion = true;  // mark that exhaustion happened
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
          : (ent === P ? Math.atan2(mY - $.POS.root().y, mX - $.POS.root().x) : ent.angle);
        
        const maxCharge = BOW_RELOAD;
        const progress = Math.min(1, chargeTime / maxCharge);
        const dmg = BOW_DMG_MIN + (BOW_DMG_MAX - BOW_DMG_MIN) * progress;
        
        const tip = $.POS.tip(ent);
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
        
        // Drain 15 stamina on release
const staminaCost = Math.min(15, ent.stamina);
drainStamina(ent, staminaCost);
        
        // If stamina reaches 0 - exhaust
        if(ent.stamina <= 0 && !isExhausted(ent)){
          applyExhaust(ent);
		   ent._hadExhaustion = true;  // mark that exhaustion happened
        }
        
        $.S.play('bowPush');
        ent._rangedShotCD = GameTime + 0.5;
        
        const recoilForce = 2;
        if(!(ent === P && dummyOn)){
          ent.vx -= Math.cos(aimAngle) * recoilForce;
          ent.vy -= Math.sin(aimAngle) * recoilForce;
        }
        ent._recoilOffset = -6;
        ent._recoilAnimTime = 0.1;
        
        $.FX.hit({x:ent.x, y:ent.y-40, t:'➹ ' + Math.round(dmg), life:30, big:false, col:'#ffdd88'});
      }
    }
  
  // ============================================================
  // ─── CROSSBOW ───
  // ============================================================
 // ============================================================
// ─── CROSSBOW ───
// ============================================================
} else if(key === 'crossbow'){
    if(fireHeld && ent.hasWeapon !== false && !isExhausted(ent)){
        if(GameTime < (ent._rangedShotCD||0)){
            if(!ent._reloadSoundPlayed){
                ent._reloadSoundPlayed = true;
                const tip = $.POS.tip(ent);
                $.FX.hit({x:tip.x, y:tip.y-16, t:(window.I18N ? window.I18N.t('ranged.crossbowReload') : 'RELOADING...'), life:35, big:false, col:'#ff8844'});
            }
        } else {
            const aimAngle = aimAngleOverride != null ? aimAngleOverride
                : (ent === P ? Math.atan2(mY - $.POS.root().y, mX - $.POS.root().x) : ent.angle);
            const dmg = CROSSBOW_DMG_MIN + Math.random()*(CROSSBOW_DMG_MAX - CROSSBOW_DMG_MIN);
            spawnProjectile(ent, 'arrow', aimAngle, dmg, CROSSBOW_PROJ_SPEED, CROSSBOW_MAX_DMG_PCT);
            
            // Drain 15 stamina on shot
   const staminaCost = Math.min(15, ent.stamina);
drainStamina(ent, staminaCost);
            
            // If stamina reaches 0 - exhaust
if(ent.stamina <= 0 && !isExhausted(ent)){
  applyExhaust(ent);
  ent._hadExhaustion = true;
}
            
            $.S.play('arrowPush');
            
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
// ─── MAGIC STAFF ─── (full rework: "click" vs "hold" modes)
// ============================================================

// Initialize state for magic staff if not exists
  } else if (weaponKeyOf(ent) === 'magicstaff') {
  // Initialize state for magic staff
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
      _penaltyApplied: false,    // Flag: penalty applied after 1 second
      _penaltyTimer: 0,           // Timer for penalty countdown
	  _explosionTriggered: false
    };
  }
  
  const state = ent._magicStaffState;
  
  // ─── HELD STATE ──────────────────────────────────────────────────────────────
  if (fireHeld && ent.hasWeapon !== false && !isExhausted(ent) && !(GameTime < (ent._rangedShotCD||0))) {
    // Start holding if not already
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
    
    // ─── AFTER 0.3 SECONDS — start charging ──────────────────────
    if (holdTime > 0.3) {
      // Start charging
      if (!ent._magicCharging) {
        ent._magicCharging = true;
        ent._magicChargeStart = GameTime;
        ent._magicChargeSoundObj = playControllableSound('magicEnergy');
        ent._magicSeed = Math.random() * 100;
      }
      
      // Drain rage and stamina gradually (every 0.1 sec)
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
  
  // If held for more than 2 seconds — trigger explosion!
  if (chargeTime > MAGICSTAFF_CHARGE_MINTIME && state.rageConsumed) {
    const progress = Math.min(1, (chargeTime - 2.0) / 2.0);
    const dmg = MAGICSTAFF_DMG_MIN + (MAGICSTAFF_DMG_MAX - MAGICSTAFF_DMG_MIN) * progress * 3;
    const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
    spawnMagicStaffExplosion(ent, radius, dmg);
    $.S.play('magicPush');
    ent.vx -= Math.cos(ent.angle) * 5;
    ent.vy -= Math.sin(ent.angle) * 5;
    ent._rangedShotCD = GameTime + MAGICSTAFF_SHOT_CD;
    //$.FX.hit({x: ent.x, y: ent.y - 50, t: '💥 EXPLOSION!', life: 50, big: true, col: '#88ddff'});
    state._explosionTriggered = true;  // mark that explosion has occurred
  }
  
  // Stop charging
  ent._magicCharging = false;
  if (ent._magicChargeSoundObj) {
    fadeOutSound(ent._magicChargeSoundObj, 0.2);
    ent._magicChargeSoundObj = null;
  }
  clearMagicStaffFX(ent);
  if (!isExhausted(ent)) applyExhaust(ent);
  
  // Show notification about resource depletion
  if ((ent.rage || 0) < 1) {
   // $.FX.hit({x: ent.x, y: ent.y - 30, t: '⚠ No rage!', life: 30, big: false, col: '#ff8844'});
  } else if (ent.stamina < 1) {
   // $.FX.hit({x: ent.x, y: ent.y - 30, t: '⚠ No stamina!', life: 30, big: false, col: '#ff8844'});
  }
  
  state.isHeld = false;
  return;
}}
    
      
      // ─── EFFECTS DURING CHARGING ──────────────────────────────
      // Mobile devices get fewer particles for performance
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
      
      return; // Exit, don't process further
    }
    
    // ─── QUICK CLICK (< 0.3 seconds) ─── ──────────────────────────────────
    if (!state.hasFired) {
      const hasRage = (ent.rage || 0) >= 30;
      
      if (hasRage) {
        // ─── QUICK CLICK WITH RAGE ───
        const aimAngle = aimAngleOverride != null ? aimAngleOverride
          : (ent === P ? Math.atan2(mY - $.POS.root().y, mX - $.POS.root().x) : ent.angle);
        
        const tip = $.POS.tip(ent);
        
        ent.angle = aimAngle;
        ent.vel = sv('swthresh') * 2.5;
        
        const lungeDist = sv('dist') * 3.5;
        ent.tpX = Math.cos(aimAngle) * lungeDist;
        ent.tpY = Math.sin(aimAngle) * lungeDist;
        
        spawnWandExplosion(tip.x, tip.y);
        
        // ─── LIGHTNING ───
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
        
        // ─── DAMAGE 10 HP ───
        const defenders = [P, ...ALL_BOTS];
        let closestEnemy = null;
        let closestDist = Infinity;
        
        for (const defender of defenders) {
          if (defender === ent || defender.hp <= 0) continue;
          const dC = $.POS.body(defender);
          const dist = Math.hypot(dC.x - tip.x, dC.y - tip.y);
          
          const toEnemy = Math.atan2(dC.y - tip.y, dC.x - tip.x);
          const angleDiff = Math.abs($.M.angDiff(toEnemy, aimAngle));
          
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
        
        //$.FX.hit({x: ent.x, y: ent.y - 40, t: '✨ QUICK!', life: 35, big: true, col: '#c090ff'});
        $.S.play('magicPush');
        
        ent._rangedShotCD = GameTime + 0.3;
        
      } else {
        // ─── QUICK CLICK WITHOUT RAGE ─── (just a push)
        const aimAngle = aimAngleOverride != null ? aimAngleOverride
          : (ent === P ? Math.atan2(mY - $.POS.root().y, mX - $.POS.root().x) : ent.angle);
        
        ent.angle = aimAngle;
        ent.vel = sv('swthresh') * 2;
        
        const lungeDist = sv('dist') * 6.5;
        ent.tpX = Math.cos(aimAngle) * lungeDist;
        ent.tpY = Math.sin(aimAngle) * lungeDist;
        
        $.FX.hit({x: ent.x, y: ent.y - 40, t: '💫 PUSH', life: 30, big: false, col: '#ffaa44'});
        $.S.play('hammerSwing');
      }
      
      state.hasFired = true;
      // Start penalty timer (after 1 second)
      state._penaltyTimer = 0.3;
      state._penaltyApplied = false;
    }
    
    return;
  }
  
  // ─── RELEASED ──────────────────────────────────────────────────────────────
  if (!fireHeld) {
    // Process release only once
    if (!state._releaseProcessed) {
      state._releaseProcessed = true;
      
      const holdTime = GameTime - state.clickStartTime;
      
      // If was charging — release explosion
      if (ent._magicCharging) {
        const chargeTime = GameTime - ent._magicChargeStart;
        ent._magicCharging = false;
        if (ent._magicChargeSoundObj) {
          fadeOutSound(ent._magicChargeSoundObj, 0.2);
          ent._magicChargeSoundObj = null;
        }
        clearMagicStaffFX(ent);
        
        // Release explosion if charged > 2 seconds
        if (chargeTime > MAGICSTAFF_CHARGE_MINTIME) {
          const progress = Math.min(1, (chargeTime - 2.0) / 2.0);
          const dmg = MAGICSTAFF_DMG_MIN + (MAGICSTAFF_DMG_MAX - MAGICSTAFF_DMG_MIN) * progress * 3;
          const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
          spawnMagicStaffExplosion(ent, radius, dmg);
          $.S.play('magicPush');
          ent.vx -= Math.cos(ent.angle) * 5;
          ent.vy -= Math.sin(ent.angle) * 5;
          ent._rangedShotCD = GameTime + MAGICSTAFF_SHOT_CD;
          $.FX.hit({x: ent.x, y: ent.y - 50, t: (window.I18N ? window.I18N.t('ranged.magicStaffExplosion') : 'EXPLOSION!'), life: 50, big: true, col: '#88ddff'});
        } else {
          $.FX.hit({x: ent.x, y: ent.y - 40, t: (window.I18N ? window.I18N.t('ranged.chargeNeedHold') : 'Hold >2 sec'), life: 30, big: false, col: '#ff8844'});
        }
      }
    }
    
    // Reset state
    state.isHeld = false;
    state.rageDrainTimer = 0;
  }
  
  // ─── PENALTY AFTER QUICK CLICK ─────────────────────────────────────────
if (state.hasFired && !state._penaltyApplied && state._penaltyTimer > 0) {
  state._penaltyTimer -= rawDt;
  
  // After 1 second — apply penalty: drain 50 rage and 50 stamina
  if (state._penaltyTimer <= 0 && !state._penaltyApplied) {
    state._penaltyApplied = true;
    
    // Check if rage is available
    const hasRage = (ent.rage || 0) >= 30;
    
    if (hasRage) {
      // Has rage: drain 30 rage and 30 stamina
      ent.rage = Math.max(0, ent.rage - 30);
      drainStamina(ent, 30);
    //  $.FX.hit({x: ent.x, y: ent.y - 50, t: '⚠ -30 RAGE! 💧 -30 STAM', life: 35, big: true, col: '#ff6030'});
    } else {
      // No rage: drain 50 stamina (penalty)
      drainStamina(ent, 30);
     // $.FX.hit({x: ent.x, y: ent.y - 40, t: '⚠ No rage! 💧 -30 STAM', life: 35, big: true, col: '#ff8844'});
    }
    
    if (ent.stamina <= 0 && !isExhausted(ent)) applyExhaust(ent);
    
    // Reset flag
    state.hasFired = false;
  }
}
}
}

// ─── CROSSBOW RELOAD SOUND ────────────────────────────────────────────────
// Plays a reload sound when the weapon is ready to fire again (GameTime >= _rangedShotCD)
// and prevents spamming by using _reloadSoundPlayed flag.
function updateCrossbowReloadSound(ent){
  const key = weaponKeyOf(ent);
  if(key !== 'crossbow' && key !== 'bow') return;
  if(ent._reloadSoundPlayed) return;
  if(ent._rangedShotCD == null) return;
  if(GameTime >= ent._rangedShotCD){
    if(key === 'crossbow') {
      $.S.play('crossbowReload');
    } else if(key === 'bow') {
      $.S.play('bowReload');
    }
    ent._reloadSoundPlayed = true;
  }
}

// ─── PROJECTILES UPDATE ────────────────────────────────────────────────────
// Updates all projectiles: movement, blocking by blade/shield, damage to entities.
function updateProjectiles(dt){
  const step = $.M.step(dt);
  const BOUND_L = 40, BOUND_R = WORLD_W-80, BOUND_T = 40, BOUND_B = WORLD_H-40;
  for(let i = PROJECTILES.length-1; i >= 0; i--){
    const w = PROJECTILES[i];
    w.x += w.vx*step; w.y += w.vy*step;

    // ─── OUT OF BOUNDS OR TOO OLD ───
    if(w.x < BOUND_L-60 || w.x > BOUND_R+60 || w.y < BOUND_T-60 || w.y > BOUND_B+60 || (GameTime - w.bornAt) > 3.0){
      PROJECTILES.splice(i,1); continue;
    }

    // ─── ARROW DRAG & FADE ──────────────────────────────────────────────
    if(w.kind === 'arrow'){
      w.vx = $.M.decay(w.vx, 0.996, dt/2);
      w.vy = $.M.decay(w.vy, 0.996, dt/2);
      if(Math.hypot(w.vx,w.vy) < CROSSBOW_PROJ_SPEED*0.35){
        w.fade = (w.fade!=null ? w.fade : 1) - dt*1.5;
        if(w.fade <= 0){ PROJECTILES.splice(i,1); continue; }
      }
    }

    // ─── BLOCK CHECK (blade/shield) ─────────────────────────────────────
    let blocked = false, blockedByBlade = false, blockedByShield = false, blocker = null;
    const defenders = [P, ...ALL_BOTS];
    const wSpd = Math.hypot(w.vx, w.vy);
    const wPrevX = w.x - w.vx, wPrevY = w.y - w.vy;
    
    for(const ent of defenders){
      if(!ent || ent.hp <= 0 || ent._awaitingReveal) continue;
      if(ent === w.owner && GameTime < w.ownerImmuneUntil) continue;
      
      // ─── BLADE BLOCK ──────────────────────────────────────────────────
      if(ent.hasWeapon !== false && !isExhausted(ent)){
        const piv = $.POS.pivot(ent);
        const reach = weaponReach(ent) * sv('swlen') * (isBot(ent)?sv('botswordscale'):1);
        const tipX = piv.x + Math.cos(ent.angle)*reach, tipY = piv.y + Math.sin(ent.angle)*reach;
        // Use 'tip' collision only for weapons where the blade is only at the tip
        // (e.g., spear) — otherwise use full blade length.
        const isTipOnly = weaponCollisionType(ent) === 'tip';
        const segStartX = isTipOnly ? (piv.x + (tipX-piv.x)*0.7) : piv.x;
        const segStartY = isTipOnly ? (piv.y + (tipY-piv.y)*0.7) : piv.y;
        const segDX=tipX-segStartX, segDY=tipY-segStartY, segL2=segDX*segDX+segDY*segDY||1;
        // Calculate distance from projectile to blade segment, with thickness.
        // For 'tip' weapons, only the tip area blocks projectiles.
        let BLOCK_R = 14;
        if(w.kind === 'wand') BLOCK_R = 28;
        else if(w.kind === 'arrow' && isTipOnly) BLOCK_R = 7;
        
        const t = $.M.clamp(((w.x-segStartX)*segDX+(w.y-segStartY)*segDY)/segL2, 0, 1);
        const nearX=segStartX+t*segDX, nearY=segStartY+t*segDY;
        let hitBlade = Math.hypot(w.x-nearX, w.y-nearY) < BLOCK_R;
        
        if(!hitBlade && wSpd > BLOCK_R){
          const t2 = $.M.clamp(((segStartX-wPrevX)*w.vx+(segStartY-wPrevY)*w.vy)/(wSpd*wSpd||1), 0, 1);
          const nearPathX = wPrevX + w.vx*t2, nearPathY = wPrevY + w.vy*t2;
          const t3 = $.M.clamp(((nearPathX-segStartX)*segDX+(nearPathY-segStartY)*segDY)/segL2, 0, 1);
          const bladeX2 = segStartX+t3*segDX, bladeY2 = segStartY+t3*segDY;
          if(Math.hypot(nearPathX-bladeX2, nearPathY-bladeY2) < BLOCK_R) hitBlade = true;
        }
        if(hitBlade){ blocked = true; blockedByBlade = true; blocker = ent; break; }
      }
      
      // ─── SHIELD BLOCK ──────────────────────────────────────────────────
      if(typeof shieldHeld === 'function' && shieldHeld(ent) && ent._shieldSide !== undefined){
        const shc = $.POS.body(ent);
        const scx = shc.x + ent._shieldSide*20*0.9, scy = shc.y + Math.sin(ent.angle)*14;
        const halfW=(ent._shieldW||20)/2, halfH=(ent._shieldH||30)/2;
        if(Math.abs(w.x-scx)<halfW+12 && Math.abs(w.y-scy)<halfH+12){
          blocked = true;
          blockedByShield = true;
          blocker = ent;
          applyShieldBlockFX(w.x, w.y, null, blocker, {waveAngle: Math.atan2(w.vy, w.vx), hitstopMag:0});
          break;
        }
      }
    }
    
    if(blocked){
      // ─── STAMINA COST FOR BLOCKING ─────────────────────────────────
      const staminaTarget = w.owner || blocker;
      if(staminaTarget){
        const projStamCost = blockStaminaCost(staminaTarget, true);
        drainStamina(staminaTarget, projStamCost);
if(staminaTarget.stamina <= 0 && !isExhausted(staminaTarget)){
  applyExhaust(staminaTarget);
}
      }
      $.S.play(w.kind==='wand' ? 'magicHit' : 'arrowHit');
      if(blockedByBlade){
        const flySpdAtBlock = Math.hypot(w.vx, w.vy);
        const strongHit = flySpdAtBlock > 6;
        $.FX.hit({x:w.x, y:w.y-8, t:'⚔', life:18, big:strongHit, col:'#ffdd88'});
        $.S.play(strongHit ? 'clashHard' : 'clash');
        if(typeof triggerHitstop === 'function') triggerHitstop(strongHit?3:2, strongHit?3:1.5);
        if(blocker) addRage(blocker, clashRageGain());
      } else {
        $.FX.hit({x:w.x,y:w.y-8,t:'⚔',life:16,big:false,col:'#ffdd88'});
        if(typeof triggerHitstop === 'function') triggerHitstop(2,2);
      }
      if(w.kind === 'wand'){
        spawnWandExplosion(w.x, w.y);
      } else {
        spawnArrowShatter(w.x, w.y, w.rot);
      }
      PROJECTILES.splice(i,1); continue;
    }

    // ─── HIT CHECK ──────────────────────────────────────────────────────
    let hit = false;
    for(const ent of defenders){
      if(!ent || ent.hp <= 0 || ent._awaitingReveal) continue;
      if(ent === w.owner && GameTime < w.ownerImmuneUntil) continue;
      const c = $.POS.body(ent);
      const hitR = 22 * (isBot(ent) ? sv('cscl')*sv('botscale') : sv('cscl'));
      const d = Math.hypot(c.x-w.x, c.y-w.y);
      if(d < hitR){
        // ─── BOT DODGE ─────────────────────────────────────────────────
        if(isBot(ent) && (!ent._aiState || ent._aiState.enabled !== false)){
          if(!w._dodgeRolled) w._dodgeRolled = new Set();
          if(!w._dodgeRolled.has(ent)){
            w._dodgeRolled.add(ent);
            if(Math.random() < PROJECTILE_DODGE_CHANCE){
              const dodgeDir = Math.random() < 0.5 ? -1 : 1;
              const perpX = -Math.sin(w.rot)*dodgeDir, perpY = Math.cos(w.rot)*dodgeDir;
              ent.vx += perpX*4; ent.vy += perpY*4;
              $.FX.hit({x:c.x, y:c.y-20, t:(window.I18N ? window.I18N.t('ranged.botDodge') : 'DODGE!'), life:30, big:false, col:'#8fd6ff'});
              continue;
            }
          }
        }
        
        // ─── DAMAGE CAP ──────────────────────────────────────────────────
        const maxPct = w.maxDmgPct || (w.kind === 'wand' ? WAND_MAX_DMG_PCT : CROSSBOW_MAX_DMG_PCT);
        let dmg = Math.round(w.dmg);
        dmg = Math.min(dmg, Math.max(1, Math.round(MAX_HP*maxPct)));
        
        // ─── LIGHTNING EFFECT ──────────────────────────────────────────
        if(w.kind === 'wand' && w.shooterPos){
          const intensity = Math.min(1, (w.dmg || 10) / 30);
          spawnLightningHit(w.shooterPos.x, w.shooterPos.y, c.x, c.y, intensity);
        }
        
        // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
        // ─── UNIFIED applyDamage CALL ───
        // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
        const isMagic = w.kind === 'wand';
        
        applyDamage(ent, dmg, w.owner, {
          isMagic: isMagic,
          isProjectile: true,
          knockbackMult: isMagic ? 1.5 : 1.0,
          hitstopFrames: isMagic ? 5 : 3,
          shakePower: dmg > 15 ? (isMagic ? 6 : 4) : 3,
          textColor: isMagic ? '#c090ff' : '#ff8844',
          textSuffix: isMagic ? '✨' : '➹',
          bloodCount: isMagic ? 6 : 4,
          playSound: false
        });
        
        // ─── EXTRA KNOCKBACK ───────────────────────────────────────────
        const nx = d>0.1?(c.x-w.x)/d:0, ny = d>0.1?(c.y-w.y)/d:-1;
        const kb = w.kind==='wand' ? 14 : 8;
        ent.x += nx*kb*0.7; ent.y += ny*kb*0.7;
        
        // ─── EXPLOSION EFFECT ─────────────────────────────────────────
        if(w.kind === 'wand') spawnWandExplosion(w.x, w.y);
        
        // ─── SOUND ─────────────────────────────────────────────────────
        $.S.play(w.kind==='wand' ? 'magicHit' : 'arrowHit');
        
        hit = true; break;
      }
    }
    if(hit){ PROJECTILES.splice(i,1); continue; }
  }
}

// ─── AI PRE-DODGE ──────────────────────────────────────────────────────────
// Gives bots a chance to dodge projectiles BEFORE they get close
// (PROJECTILE_PREDODGE_CHANCE). Unlike regular dodge, this happens early,
// before the projectile reaches the bot, and it's a proactive sidestep.
// This makes bots much harder to hit at range, while regular dodge
// (PROJECTILE_DODGE_CHANCE) is a last-second evasion.
function updateProjectileDodgeAI(){
  if(!dummyOn || PROJECTILES.length === 0) return;
  for(const w of PROJECTILES){
    if(!w.owner) continue;
    const spd = Math.hypot(w.vx, w.vy);
    if(spd < 0.1) continue;
    const dirX = w.vx/spd, dirY = w.vy/spd;
    for(const bot of ALL_BOTS){
      if(!bot || bot.hp <= 0 || bot._awaitingReveal || bot === w.owner) continue;
      if(bot._aiState && bot._aiState.enabled === false) continue; // Mannequin (T) — not controlled by AI
      if(!w._preDodgeRolled) w._preDodgeRolled = new Set();
      if(w._preDodgeRolled.has(bot)) continue;

      const bc = $.POS.body(bot);
      const toBotX = bc.x - w.x, toBotY = bc.y - w.y;
      const along = toBotX*dirX + toBotY*dirY; // Distance along projectile trajectory to bot
      if(along <= 0 || along > 260) continue;   // Projectile already passed or too far
      const perp = Math.abs(toBotX*(-dirY) + toBotY*dirX); // Perpendicular distance "off course" from bot
      if(perp > 46) continue; // Too far off course — won't hit

      w._preDodgeRolled.add(bot);
      if(Math.random() < PROJECTILE_PREDODGE_CHANCE){
        const dodgeDir = Math.random() < 0.5 ? -1 : 1;
        bot._dvx = (bot._dvx||0) + (-dirY)*dodgeDir*7;
        bot._dvy = (bot._dvy||0) + (dirX)*dodgeDir*7;
        $.FX.hit({x:bc.x, y:bc.y-24, t:(window.I18N ? window.I18N.t('ranged.botDodge') : 'DODGE!'), life:26, big:false, col:'#8fd6ff'});
      }
    }
  }
}

function drawProjectiles(){
  for(const w of PROJECTILES){
    if(w.kind === 'wand'){
      const r = 18; // Visual radius 2x larger (was 9)
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
      const fadeA = w.fade != null ? $.M.clamp(w.fade,0,1) : 1;

      // ─── TRAIL ──────────────────────────────────────────────────────
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
      // ─── GLOW ────────────────────────────────────────────────────────
      ctx.shadowColor = 'rgba(255,215,140,0.95)';
      ctx.shadowBlur = 16;
      if(img && img.complete && img.naturalWidth > 0){
        const L = 34;
        ctx.translate(w.x,w.y);
        // Fix: arrows are drawn horizontally by default (T_Arrow_01.png is horizontal)
        // ctx.rotate(Math.PI/2);
        ctx.rotate(w.rot);
        const width = L * spriteAspectFor(img);
        ctx.drawImage(img, -L/2, -width/2, L, width);
      } else {
        // Fallback if sprite not loaded — draw simple arrow
        ctx.translate(w.x,w.y); ctx.rotate(w.rot);
        ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(16,0); ctx.stroke();
      }
      ctx.restore();
      // Extra glow behind the arrow (independent of rot)
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
  const target = typeof FactionRules!=='undefined' ? FactionRules.getBotTarget(bot) : P;
  if(!target) return;
  if(target.hp <= 0) return;
  const dist = Math.hypot(target.x-bot.x, target.y-bot.y);
  const aimAngle = Math.atan2(target.y-bot.y, target.x-bot.x);
  bot.prevAngle = bot.angle;
  bot.angle = aimAngle;

  // ─── STATE MANAGEMENT ──────────────────────────────────────────────────
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
        bot._cbWanderTarget = { x: randRange(60, WORLD_W-100), y: randRange(60, WORLD_H-60) };
      }
      const wdx = bot._cbWanderTarget.x-bot.x, wdy = bot._cbWanderTarget.y-bot.y;
      const wl = Math.hypot(wdx,wdy) || 1;
      mx = wdx/wl; my = wdy/wl;
      bot._cbLastMode = 'wander';
    }
    // ─── WALL AVOIDANCE ──────────────────────────────────────────────
    const WALL_MARGIN = 130;
    const _bl=40, _br=WORLD_W-80, _bt=40, _bb=WORLD_H-40;
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

  // ─── SPEED ─────────────────────────────────────────────────────────────
  const exhMult = getMod(bot, 'moveSlow', 1);
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
  
  bot.vx = $.M.lerpDT(bot.vx, mx*maxV, 0.16, dt);
  bot.vy = $.M.lerpDT(bot.vy, my*maxV, 0.16, dt);
  bot.vx = $.M.clamp(bot.vx,-15,15); bot.vy = $.M.clamp(bot.vy,-15,15);
  const step = $.M.step(dt);
  bot.x = $.M.clamp(bot.x+bot.vx*step, 40, WORLD_W-80);
  bot.y = $.M.clamp(bot.y+bot.vy*step, 40, WORLD_H-40);
  resolveBoxCollision(bot);

// The rest of updateCrossbowBotAI is handled by updateDummy(), so we don't
// duplicate physics here — this ensures exhausted doesn't get stuck per frame.

// ─── FIRE LOGIC (bow/crossbow) ───────────────────────────────────────────
  let ready = bot.stamina > 0 && bot.exhausted <= 0 && !(GameTime < (bot._rangedShotCD||0));

  const _wKey = weaponKeyOf(bot);

  // ─── BOW: limit hold time ────────────────────────────────────────────
  if(_wKey === 'bow'){
    if(bot._bowCharging){
      if(bot._bowHoldLimit === undefined){
        bot._bowHoldLimit = rf(1, 5) + 1; // 1..6 seconds
      }
      if(GameTime - bot._bowChargeStart >= bot._bowHoldLimit){
        ready = false; // Force release in updateRangedWeaponFire
      }
    } else {
      bot._bowHoldLimit = undefined; // Reset after release
    }
  }

  // ─── CROSSBOW: extra random delay after reload ──────────────────────
  const _prevRangedCD = bot._rangedShotCD || 0;

  updateRangedWeaponFire(bot, ready, aimAngle);

  // ─── CROSSBOW: add random delay (40% chance) ────────────────────────
  if(_wKey === 'crossbow' && bot._rangedShotCD > _prevRangedCD && Math.random() < 0.4){
    bot._rangedShotCD += rf(1, 2) + 1; // Add 1..3 seconds
  }

  updateCrossbowReloadSound(bot);
}


// ─── HELPER: get bot max speed (wrapper for calcSpeedMultipliers) ───────
function getBotMaxSpeed(bot){
  return calcSpeedMultipliers(bot, false);
}









// ─── AI: WAND BOT ──────────────────────────────────────────────────────────
// Returns true if the bot is actively charging/using the wand (so the main
// updateAI should skip normal movement for this bot); false otherwise.
function updateWandBotAI(dt, bot){
  const target = typeof FactionRules!=='undefined' ? FactionRules.getBotTarget(bot) : P;
  if(!target) return false;
  const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
  const aimAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
  const weaponKey = weaponKeyOf(bot);

  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
  // ─── MAGIC STAFF AI ─────────────────────────────────────────────────────
  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
  if(weaponKey === 'magicstaff'){
    // Initialize AI state
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
    
// ─── DECISION: SHOULD WE USE MAGIC? ──────────────────────────────────────
const isPlayerExhausted = isExhausted(target) || target.stamina < 30;
const isInRange = dist < MAGICSTAFF_RADIUS * 0.9  && dist > 30;
const hasStamina = bot.stamina > 10;
const isReady = GameTime >= (bot._rangedShotCD || 0);
const notCharging = magicAI.state !== 'charging' && magicAI.state !== 'cooldown';

// Check if bot has enough rage (>= 50)
const hasRage = (bot.rage || 0) >= 50;

// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// ─── DECISION LOGIC: WHEN TO USE MAGIC ───
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
let shouldUseMagic = false;

// ─── RULE 1: Player exhausted - 70% chance ──────────────────────────────
if(isPlayerExhausted && isInRange && hasStamina && isReady && notCharging && hasRage){
  shouldUseMagic = Math.random() < 0.7;
}

// ─── RULE 2: Even if not exhausted - 20% chance ─────────────────────────
if(!shouldUseMagic && isInRange && hasStamina && isReady && notCharging && hasRage && Math.random() < 0.6){
  shouldUseMagic = true;
  console.log('🔮 Bot decided to charge magic, even though player is not exhausted!');
}

// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// ─── IF SHOULD USE MAGIC - START CHARGING ───
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
if(shouldUseMagic){
  console.log('🔮 Bot started charging magic! (Rage:', Math.round(bot.rage), ')');
  magicAI.state = 'charging';
  magicAI.chargeStart = GameTime;
  magicAI.fireHeld = true;
  magicAI.timeInState = 0;
  
  bot._magicCharging = true;
  bot._magicChargeStart = GameTime;
  bot._magicChargeSoundObj = playControllableSound('magicEnergy');
  

  
  $.FX.hit({x: bot.x, y: bot.y - 40, t: (window.I18N ? window.I18N.t('ranged.magicStaffCharge') : 'CHARGE!'), life: 30, big: false, col: '#88ddff'});
  drainStamina(bot, 10);
  
  // Return true to signal that bot is busy charging
  return true;
}

// ─── CHARGING STATE ──────────────────────────────────────────────────────
if(magicAI.state === 'charging'){
  const chargeTime = GameTime - magicAI.chargeStart;
  
  // Stop moving while charging
  bot.vx = $.M.lerpDT(bot.vx, 0, 0.9, dt);
  bot.vy = $.M.lerpDT(bot.vy, 0, 0.9, dt);
  const step = $.M.step(dt);
  bot.x = $.M.clamp(bot.x + bot.vx*step, 40, WORLD_W-80);
  bot.y = $.M.clamp(bot.y + bot.vy*step, 40, WORLD_H-40);
  bot.angle = aimAngle;
  drainStamina(bot, 15 * dt);
  
  // Call updateRangedWeaponFire with fireHeld = true
  updateRangedWeaponFire(bot, true, aimAngle);
  
  // ─── ABORT CONDITIONS ──────────────────────────────────────────────
  const playerRecovered = !isExhausted(target) && target.stamina > 60;
  const playerTooFar = dist > MAGICSTAFF_RADIUS * 2.5;
  const playerTooClose = dist < 10;
  const outOfStamina = bot.stamina < 5;
  
  if( playerTooFar || playerTooClose || outOfStamina){
    console.log('⛔ Bot aborted charging');
    magicAI.state = 'idle';
    magicAI.fireHeld = false;
    bot._magicCharging = false;
    
    updateRangedWeaponFire(bot, false, aimAngle);
    
    if(bot._magicChargeSoundObj){
      fadeOutSound(bot._magicChargeSoundObj, 0.2);
      bot._magicChargeSoundObj = null;
    }
    
    let reason = 'ABORT';
    if(playerRecovered) reason = 'PLAYER RECOVERED';
    else if(playerTooFar) reason = 'TOO FAR';
    else if(playerTooClose) reason = 'TOO CLOSE';
    else if(outOfStamina) reason = window.I18N ? window.I18N.t('ranged.abortReason.noStamina') : 'NO STAMINA';
    $.FX.hit({x: bot.x, y: bot.y - 40, t: '⛔ ' + reason, life: 20, big: false, col: '#ff8844'});
    bot._rangedShotCD = GameTime + 0.5;
    
    // Return false to let AI take over movement again
    return false;
  }
// ─── EXPLOSION ──────────────────────────────────────────────────────────
if(chargeTime >= MAGICSTAFF_CHARGE_FULLTIME){
  console.log('💥 MAGIC STAFF EXPLOSION!');
  const progress = Math.min(1, (chargeTime - 2.0) / 2.0);
  const dmg = MAGICSTAFF_DMG_MIN + (MAGICSTAFF_DMG_MAX - MAGICSTAFF_DMG_MIN) * progress ;
  const radius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
  bot.rage = 0
  magicAI.fireHeld = false;
  bot._magicCharging = false;
  
  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
  // ─── EXPLOSION WITH UNIFIED applyDamage ─────────────────────────────
  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
  spawnMagicStaffExplosion(bot, radius, dmg * 3);
  
  // Effect already handled in spawnMagicStaffExplosion, but we need to play sound here
  $.S.play('magicPush');
  
  bot.vx -= Math.cos(aimAngle) * 5;
  bot.vy -= Math.sin(aimAngle) * 5;
  bot._rangedShotCD = GameTime + MAGICSTAFF_SHOT_CD + 1.5;
  
  if(bot._magicChargeSoundObj){
    fadeOutSound(bot._magicChargeSoundObj, 0.2);
    bot._magicChargeSoundObj = null;
  }
  
  magicAI.state = 'cooldown';
  magicAI.timeInState = 0;
  
  // Extra explosion effect (already in spawnMagicStaffExplosion, but we want the text)
  $.FX.hit({x: bot.x, y: bot.y - 50, t: (window.I18N ? window.I18N.t('ranged.magicStaffExplosion') : 'EXPLOSION!'), life: 50, big: true, col: '#88ddff'});
  
  // Return false to let AI take over after explosion
  return false;
}
      
      // ─── PROGRESS INDICATOR ──────────────────────────────────────────
      if(chargeTime > 1.0 && chargeTime < 2.0){
        const progress = (chargeTime - 1.0) / 1.0;
        if(Math.floor(chargeTime * 4) % 2 === 0){
          $.FX.hit({x: bot.x, y: bot.y - 30, t: '⏳ ' + Math.round(progress * 100) + '%', life: 3, big: false, col: '#88ddff'});
        }
      }
      
      return true; // Still charging
    }
    
    // ─── COOLDOWN STATE ──────────────────────────────────────────────────
    if(magicAI.state === 'cooldown'){
      magicAI.timeInState += dt;
      
      if(GameTime >= bot._rangedShotCD){
        magicAI.state = 'idle';
        magicAI.timeInState = 0;
        console.log('⚡ Cooldown finished');
        // Return false to let AI take over after cooldown
        return false;
      }
      
      // In cooldown - just wait, don't control the bot
      // But still return false to let AI move
      return false;
    }
    
    // ─── IDLE STATE ────────────────────────────────────────────────────
    // If not using magic - let AI handle movement
    if(magicAI.state === 'idle'){
      // Check again if we should start charging (in case conditions changed)
      if(shouldUseMagic){
        // If shouldUseMagic is true - start charging
        magicAI.state = 'charging';
        magicAI.chargeStart = GameTime;
        magicAI.fireHeld = true;
        magicAI.timeInState = 0;
        
        bot._magicCharging = true;
        bot._magicChargeStart = GameTime;
        bot._magicChargeSoundObj = playControllableSound('magicEnergy');
        
        $.FX.hit({x: bot.x, y: bot.y - 40, t: (window.I18N ? window.I18N.t('ranged.magicStaffCharge') : 'CHARGE!'), life: 30, big: false, col: '#88ddff'});
        drainStamina(bot, 10);
        return true;
      }
      
      // If not using magic - let AI handle movement
      return false;
    }
    
    return false;
  }
  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
  // ─── WAND (regular wand) AI ────────────────────────────────────────────
  // ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
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

  // ─── MOVEMENT ──────────────────────────────────────────────────────────
  const PREF_DIST = 240;
  let mx=0, my=0;
  if(dist < PREF_DIST*0.8){ mx=-Math.cos(aimAngle); my=-Math.sin(aimAngle); }
else if(dist > PREF_DIST*1.3){ mx=Math.cos(aimAngle); my=Math.sin(aimAngle); }
const maxV = 5 * getMod(bot, 'moveSlow', 1);
bot.vx = $.M.lerpDT(bot.vx, mx*maxV, 0.2, dt);
bot.vy = $.M.lerpDT(bot.vy, my*maxV, 0.2, dt);
bot.vx = $.M.clamp(bot.vx,-15,15); bot.vy = $.M.clamp(bot.vy,-15,15);
if(!bot._wandCharging){
  const step = $.M.step(dt);
  bot.x = $.M.clamp(bot.x+bot.vx*step, 40, WORLD_W-80);
  bot.y = $.M.clamp(bot.y+bot.vy*step, 40, WORLD_H-40);
}

// ─── FIRE LOGIC ──────────────────────────────────────────────────────────
bot.angle = aimAngle; // Face target

const chargeDone = bot._wandCharging && (GameTime - bot._wandChargeStart >= wandChargeTimeFor(bot));
const fireHeld = bot.stamina > 20 && bot.exhausted <= 0 && !chargeDone;
updateRangedWeaponFire(bot, fireHeld, aimAngle);
return true;
}

// ─────────────────────────────────────────────────────────────────────────────────
// END LAYER: RANGED
// ─────────────────────────────────────────────────────────────────────────────────

// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
