// === src/combat/debug-balls.js ===
// Extracted from combat.js; loaded as a classic script to preserve shared runtime state.
// LAYER: DEBUG BALLS - isolated combat sandbox for projectile and sword collision testing.
// First module section: debug balls.
// ============================================================================
// ============================================================================
// MODULE: DEBUG BALLS  (тестовый режим "спавн шариков" — НЕ боевые снаряды)
// Debug balls are already isolated as the first section of this module.
// Это отдельная песочница для проверки коллизии оружия/тела с летящими
// объектами; не путать с PROJECTILES (реальные снаряды жезла/арбалета,
// см. MODULE: RANGED WEAPONS дальше в файле).
// ============================================================================

// -- ШАРИКИ ------------------------------------------------------------------
const BALLS = [];
let ballsActive = false;
let ballSpawnTimer = 0;

function spawnBall(){
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const rc0 = $.POS.root();
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
    btn.textContent = window.I18N ? window.I18N.buttonText('balls', 'on') : 'ON';
    btn.style.borderColor = '#aa3030';
    btn.style.background = '#2a0e0e';
  } else {
    BALLS.length = 0;
    btn.textContent = window.I18N ? window.I18N.buttonText('balls', 'off') : 'OFF';
    btn.style.borderColor = '#5a1a1a';
    btn.style.background = '#1a0e0e';
  }
});

function updateBalls(dt){
  if(!ballsActive) return;
  const step = $.M.step(dt);
  ballSpawnTimer += dt;
  if(ballSpawnTimer > 0.9){ ballSpawnTimer = 0; spawnBall(); }

  const pivX = $.POS.root().x + P.pvX;
  const pivY = $.POS.root().y + P.pvY;
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
      const rc1 = $.POS.root();
      const targetX = rc1.x + P.bx, targetY = rc1.y + P.by;
      const angToPlayer = Math.atan2(targetY - b.y, targetX - b.x);
      const homingStr = 0.012;
      b.vx += Math.cos(angToPlayer) * homingStr * step;
      b.vy += Math.sin(angToPlayer) * homingStr * step;
      const spd2 = Math.hypot(b.vx, b.vy);
      const maxSpd = Math.hypot(b.initVx, b.initVy) * 1.15;
      if(spd2 > maxSpd){ b.vx = b.vx/spd2*maxSpd; b.vy = b.vy/spd2*maxSpd; }
    }

    b.x += b.vx*step; b.y += b.vy*step;
    b.life-=step;
    if(b.hit > 0) b.hit-=step;

    // -- Коллизия с мечом -------------------------------------------------
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
          $.FX.hit({x: b.x, y: b.y-14, t:'вњ¦', life:28, big:false});
          
          const aikb = sv('bodyKB') * 0.5;
          if(aikb > 0){
            const rc1 = $.POS.root();
            const bodyCX1 = rc1.x + P.bx, bodyCY1 = rc1.y + P.by;
            const kbAng = Math.atan2(bodyCY1 - b.y, bodyCX1 - b.x);
            P.vx += Math.cos(kbAng) * aikb;
            P.vy += Math.sin(kbAng) * aikb;
          }
          hit = true;
        }
      }
    }

    // -- ПОПАДАНИЕ ШАРИКА В ТЕЛО ИГРОКА ----------------------------------
    {
      const rc0 = $.POS.root();
      const bodyCX = rc0.x + P.bx;
      const bodyCY = rc0.y + P.by;
      const BODY_HIT_R = 18 * sv('cscl');
      
      if(b.hit === 0){
        const d = Math.hypot(b.x - bodyCX, b.y - bodyCY);
        if(d < BODY_HIT_R + b.r && (P._ballHitCD||0) <= GameTime){
          P._ballHitCD = GameTime + 0.5;
          const dmg = Math.round(Math.hypot(b.vx, b.vy) * 4);
          
          // ================================================================
          // ?? ЕДИНЫЙ ВЫЗОВ applyDamage
          // ================================================================
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
          
          // -- ДОПОЛНИТЕЛЬНЫЕ ЭФФЕКТЫ (специфичные для шариков) --
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

// ---------------- END LAYER: DEBUG_BALLS ----------------

// ============================================================================
