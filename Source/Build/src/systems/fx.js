// === src/systems/fx.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: FX — визуальные эффекты (кровь, вспышки, ударные волны, пыль)
// Module file: fx.js
// ════════════════════════════════════════════════════════════════════════════
const hitFX = [];
const BLOOD = [];

function spawnBlood(x, y, nx, ny){
  const count = 6 + Math.floor(Math.random()*5);
  for(let i=0;i<count;i++){
    const spd = rf(3,7.5); // x1.5 дальше
    const ang = Math.atan2(ny,nx) + (Math.random()-0.5)*1.8;
    BLOOD.push({
      x, y,
      vx: Math.cos(ang)*spd,
      vy: Math.sin(ang)*spd - 1.5,
      life: rf(25,20),
      maxLife: 0,
      r: rf(2.5,4), // крупнее
    });
    BLOOD[BLOOD.length-1].maxLife = BLOOD[BLOOD.length-1].life;
  }
}

function updateBlood(dt){
  for(let i=BLOOD.length-1;i>=0;i--){
    const b=BLOOD[i];
    b.x+=b.vx*dt*60; b.y+=b.vy*dt*60;
    b.vy+=0.25*dt*60;
    b.vx=decayDT(b.vx,0.88,dt); b.vy=decayDT(b.vy,0.92,dt);
    b.life-=dt*60;
    if(b.life<=0) BLOOD.splice(i,1);
  }
}

function drawBlood(){
  for(const b of BLOOD){
    const t = b.life/b.maxLife;
    ctx.globalAlpha = t*0.95;
    // Яркий красный → тёмный по мере угасания
    ctx.fillStyle = t>0.5 ? '#ff2020' : '#cc1010';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── БОЕВАЯ СИСТЕМА ────────────────────────────────────────────────────────────
// Вычисляем очки атаки для entity (атакующий vs защищающийся)

// ════════════════════════════════════════════════════════════════════════════
// MODULE: FX  (visual effects — blood, flash, cross, impact)
// Visual effects are already isolated in this module; no global API is needed.
// ════════════════════════════════════════════════════════════════════════════
const FX_EFFECTS = [];
const DUST_FX = []; // пыль под ногами игрока
let LIGHTNING_HIT_FX = []; // молнии при попадании





function spawnLightningHit(x, y, targetX, targetY, intensity){
  console.log('⚡ СОЗДАЁМ МОЛНИЮ!', {x, y, targetX, targetY, intensity});
  
  if(!isFinite(x) || !isFinite(y) || !isFinite(targetX) || !isFinite(targetY)) return;
  
  // 🔥 БОЛЬШЕ ЗИГЗАГОВ ДЛЯ КРАСОТЫ
  const points = [];
  const segments = 8 + Math.floor(Math.random() * 4);
  
  for(let i = 0; i <= segments; i++){
    const t = i / segments;
    const cx = x + (targetX - x) * t;
    const cy = y + (targetY - y) * t;
    
    if(i > 0 && i < segments){
      const perpAngle = Math.atan2(targetY - y, targetX - x) + Math.PI/2;
      const jitter = (Math.random() - 0.5) * 50 * (1 - t * 0.3);
      points.push({
        x: cx + Math.cos(perpAngle) * jitter,
        y: cy + Math.sin(perpAngle) * jitter
      });
    } else {
      points.push({x: cx, y: cy});
    }
  }
  
  // 🔥 ДЕЛАЕМ МОЛНИЮ ЖИРНОЙ И ЯРКОЙ
  const baseWidth = 4 + intensity * 6; // было 3 + intensity * 4
  
  LIGHTNING_HIT_FX.push({
    points: points,
    life: 1,
    maxLife: 0.4 + intensity * 0.2, // живет дольше
    width: baseWidth,
    alpha: 1,
  });
  
  console.log('✅ Молния добавлена! всего молний:', LIGHTNING_HIT_FX.length);
}

function updateLightningHitFX(dt){
  for(let i = LIGHTNING_HIT_FX.length - 1; i >= 0; i--){
    const bolt = LIGHTNING_HIT_FX[i];
    bolt.life -= dt / bolt.maxLife;
    bolt.alpha *= 0.98;
    if(bolt.life <= 0 || bolt.alpha < 0.01){
      LIGHTNING_HIT_FX.splice(i, 1);
    }
  }
}

function drawLightningHitFX(){
  for(const bolt of LIGHTNING_HIT_FX){
    const a = bolt.life * bolt.alpha;
    if(a < 0.01) continue;
    
    ctx.save();
    ctx.globalAlpha = a;
    
    const points = bolt.points;
    ctx.shadowColor = 'rgba(100, 200, 255, 0.9)';
    ctx.shadowBlur = 15;
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
    
    ctx.shadowBlur = 25;
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.8)';
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

function spawnDust(x, y, vx, vy){
  DUST_FX.push({
    x: x + (Math.random()-0.5)*10,
    y: y + Math.random()*3,
    vx: (Math.random()-0.5)*16 - vx*0.15,
    vy: -4 - Math.random()*5,
    life: 1, maxLife: rf(0.15,0.1), // в 2 раза меньше
    r: rf(2,3),
  });
}

function drawDustFX(dt){
  for(let i = DUST_FX.length-1; i >= 0; i--){
    const d = DUST_FX[i];
    d.life -= dt / d.maxLife;
    if(d.life <= 0){ DUST_FX.splice(i,1); continue; }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 18 * dt; // лёгкая гравитация
    const a = d.life * 0.35;
    const r = d.r * (1 + (1-d.life)*0.5);
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(180,160,130,${a})`;
    ctx.fill();
  }
}
let FX_horizData = null;

function fxGetAlpha(effect){
  const prog = effect.t / (effect.duration||20);
  if(prog>=1) return 0;
  return Math.min(1, Math.max(0, 1 - Math.pow(prog, 1.25)));
}

function fxDrawBlood(ctx, p, x, y, angle){
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle || -0.68); ctx.scale(0.4,0.4);
  ctx.globalCompositeOperation='lighter';
  const g=ctx.createLinearGradient(-200,0,200,0);
  const a=Math.min(0.95,p*1.05);
  g.addColorStop(0,'rgba(100,0,0,0)');
  g.addColorStop(0.4,`rgba(210,25,20,${a})`);
  g.addColorStop(0.6,`rgba(255,50,30,${a*0.95})`);
  g.addColorStop(1,'rgba(100,0,0,0)');
  ctx.strokeStyle=g; ctx.lineWidth=80*p; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-200,0); ctx.lineTo(200,0); ctx.stroke();
  ctx.restore();
}

function fxDrawFlash(ctx, p){
  // Flash — полноэкранный (без масштаба, как в библиотеке)
  const intensity = Math.min(0.85, p * 1.2);
  ctx.fillStyle = `rgba(255,255,250,${intensity*0.85})`;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = `rgba(255,255,255,${intensity*0.25})`;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function fxDrawCross(ctx, p, x, y){
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4); ctx.scale(0.4,0.4);
  ctx.globalCompositeOperation='lighter';
  const a=Math.min(1,p*1.2), lw=60*p;
  function ln(rot){
    ctx.save(); ctx.rotate(rot);
    const g=ctx.createLinearGradient(-220,0,220,0);
    g.addColorStop(0,'rgba(255,255,220,0)'); g.addColorStop(0.47,`rgba(255,255,245,${a})`);
    g.addColorStop(0.53,`rgba(255,255,255,${a})`); g.addColorStop(1,'rgba(255,240,180,0)');
    ctx.strokeStyle=g; ctx.lineWidth=lw; ctx.beginPath();
    ctx.moveTo(-220,0); ctx.lineTo(220,0); ctx.stroke(); ctx.restore();
  }
  ln(0); ln(Math.PI/2); ctx.restore();
}

function drawRageAura(ent, cx, cy){} // устарело — используется ragering FX

function fxDrawRageRing(ctx, p, x, y, ent){
  // Привязываемся к телу персонажа как тень (bodyCenter.y + 22)
  let fx=x, fy=y;
  if(ent){
    const bc=entityBodyCenter(ent);
    fx=bc.x; fy=bc.y+22; // точно как тень
  }
  ctx.save();
  ctx.translate(fx, fy);
  ctx.globalCompositeOperation = 'lighter';
  const expand = Math.pow(1-p, 0.5);
  const rX = 12 + expand * 28;
  const rY = rX * 0.38;
  ctx.scale(1, rY/rX);
  for(let half=0; half<2; half++){
    const sA = half===0 ? 0 : Math.PI;
    const eA = half===0 ? Math.PI : Math.PI*2;
    ctx.beginPath();
    ctx.arc(0, 0, rX, sA, eA);
    ctx.strokeStyle = `rgba(60,160,255,${p * 0.9})`;
    ctx.lineWidth = (4 - expand*2) / (rY/rX);
    ctx.shadowColor = 'rgba(40,120,255,0.95)';
    ctx.shadowBlur = 14 * p;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function fxDrawImpact(ctx, p, x, y){
  // Синее кольцо-овал у ног (повторяет форму тени персонажа)
  ctx.save();
  ctx.translate(x, y + 22); // у ног (тень на +22 от центра)
  ctx.globalCompositeOperation='lighter';
  const t2=1-p, eased=Math.pow(t2,0.55);
  // Два полукольца расходятся вниз от ног
  const rX = 18 + eased*55; // горизонтальный радиус
  const rY = rX * 0.38;     // вертикальный (как тень — плоский овал)
  for(let half=0; half<2; half++){
    const startAng = half===0 ? 0 : Math.PI;
    const endAng = half===0 ? Math.PI : Math.PI*2;
    const offsetY = half===0 ? eased*12 : -eased*12; // расходятся вверх/вниз
    ctx.save();
    ctx.translate(0, offsetY);
    ctx.scale(1, rY/rX);
    ctx.beginPath();
    ctx.arc(0, 0, rX, startAng, endAng);
    ctx.strokeStyle=`rgba(60,160,255,${p*0.85})`;
    ctx.lineWidth=(4+p*3)/( rY/rX);
    ctx.shadowColor='rgba(40,120,255,0.9)';
    ctx.shadowBlur=12*p;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function spawnFX(type, x, y, angle, followEntity){
  FX_EFFECTS.push({type, x, y, t:0, duration: type==='impact'?18:20, angle: angle||0, followEntity: followEntity||null});
}

function updateFX(dt){
  for(let i=FX_EFFECTS.length-1;i>=0;i--){
    const fx=FX_EFFECTS[i];
    fx.t+=dt*60;
    if(fx.t>=fx.duration) FX_EFFECTS.splice(i,1);
  }
}

function drawFXEffects(){
  for(const fx of FX_EFFECTS){
    const p = fxGetAlpha(fx);
    if(p <= 0.01) continue;
    let fx_x = fx.x, fx_y = fx.y;
    if(fx.followEntity){
      const piv = entityPivot(fx.followEntity);
      fx_x = piv.x; fx_y = piv.y;
    }
    if(fx.type === 'blood'){
      fxDrawBlood(ctx,p,fx_x,fx_y,fx.angle);
    } else if(fx.type === 'impact'){
      fxDrawImpact(ctx,p,fx_x,fx_y);
    } else if(fx.type === 'cross'){
      fxDrawCross(ctx,p,fx_x,fx_y);
    } else if(fx.type === 'flash'){
      fxDrawFlash(ctx,p);
    } else if(fx.type === 'shieldwave'){
      fxDrawShieldWave(ctx,p,fx_x,fx_y,fx.angle,fx.t,fx.duration);
    } else if(fx.type === 'ragering'){
      fxDrawRageRing(ctx,p,fx_x,fx_y,fx.followEntity);
    } else if(fx.type === 'magic_explosion'){
      // 🔥 МАГИЧЕСКИЙ ВЗРЫВ
      fxDrawMagicExplosion(ctx, p, fx_x, fx_y, fx.radius || 100);
    }
  }
}
function fxDrawShieldWave(ctx, p, x, y, angle, t, dur){
  // Белые расходящиеся дуги в направлении врага
  const prog = t / dur; // 0→1
  const maxR = 55;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle); // направление к врагу
  for(let i=0;i<3;i++){
    const delay = i * 0.25;
    const wp = Math.max(0, (prog - delay) / (1 - delay));
    if(wp<=0) continue;
    const r = wp * maxR;
    const alpha = (1-wp) * p * 0.8;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5 - wp*1.5;
    ctx.beginPath();
    // Дуга только в сторону врага (±60°)
    ctx.arc(0, 0, r, -Math.PI/3, Math.PI/3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ──────────────── END LAYER: FX ────────────────

// ════════════════════════════════════════════════════════════════════════════
