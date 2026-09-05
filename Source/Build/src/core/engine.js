// === src/core/engine.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// ════════════════════════════════════════════════════════════════════════════
// ═══ ЯДРО ДВИЖКА (ENGINE CORE) ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// Аналог common.j/Blizzard.j из Warcraft III — сюда собрано только то, что
// реально общее для ВСЕХ блоков игры (canvas/ctx, размеры арены, игровое
// время, ссылки на игрока/ботов, общие FX-массивы). Любой блок ниже
// (combat, ai, ranged-weapons, audio, ui, network...) может свободно читать
// и писать эти переменные — они не принадлежат ни одному конкретному блоку.
//
// Правило простое: если переменную использует только один блок — она should
// жить внутри этого блока. Если её использует 3+ разных блока — ей место
// здесь, в ядре, чтобы не тащить её объявление откуда-то из середины
// "чужого" по смыслу блока.
//
// Ядро уже выделено в отдельный классический модуль и загружается первым из
// Build.html. Затем подключаются системы, игровой код, UI и сеть.
// ════════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════════════
// LAYER: CORE — канвас, ввод, время, математика, хелперы сущностей (аналог common.j)
// Module file: core/engine.js
// ════════════════════════════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function applyCanvasSmoothing(){
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}
applyCanvasSmoothing();

// ── Раннее определение мобильного устройства (до расчёта W/H) ──────────────
const _ua = navigator.userAgent || '';
const _isTouchDevice = (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
const _isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(_ua);
window.IS_MOBILE = _isTouchDevice && _isMobileUA;
if(window.IS_MOBILE) document.body.classList.add('is-mobile');

let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;
let WORLD_W = W, WORLD_H = H;
let CAM_X = 0, CAM_Y = 0;
let CAM_SCALE = 1;
let mouseScreenX = W / 2, mouseScreenY = H / 2;

function updateWorldSize(){
  const aspect = Math.max(0.1, W / Math.max(1, H));
  const minWorldH = Math.max(H * 3, 55 * 42);
  WORLD_H = Math.round(minWorldH);
  WORLD_W = Math.round(Math.max(W * 3, minWorldH * aspect));
}

function updateCameraScale(){
  const rows = parseFloat(document.getElementById('sl-camrows')?.value || 14);
  const visibleH = Math.max(55 * 4, rows * 55);
  CAM_SCALE = Math.max(0.05, H / visibleH);
  window.CAM_SCALE = CAM_SCALE;
}

function clampCamera(){
  const viewW = W / CAM_SCALE;
  const viewH = H / CAM_SCALE;
  CAM_X = $.M ? $.M.clamp(CAM_X, 0, Math.max(0, WORLD_W - viewW)) : Math.max(0, Math.min(CAM_X, Math.max(0, WORLD_W - viewW)));
  CAM_Y = $.M ? $.M.clamp(CAM_Y, 0, Math.max(0, WORLD_H - viewH)) : Math.max(0, Math.min(CAM_Y, Math.max(0, WORLD_H - viewH)));
}

function screenToWorld(x, y){
  return { x: CAM_X + x / CAM_SCALE, y: CAM_Y + y / CAM_SCALE };
}

function worldToScreen(x, y){
  return { x: (x - CAM_X) * CAM_SCALE, y: (y - CAM_Y) * CAM_SCALE };
}

function updateMouseWorld(){
  const p = screenToWorld(mouseScreenX, mouseScreenY);
  mX = p.x;
  mY = p.y;
}

function activeCameraSubjects(){
  const subjects = [];
  const seen = new Set();
  function add(ent){
    if(!ent || seen.has(ent) || ent.hp <= 0 || ent._awaitingReveal || ent._defeated) return;
    seen.add(ent);
    subjects.push(ent);
  }
  if(Array.isArray(window.PLAYER_SLOTS)){
    for(const slot of window.PLAYER_SLOTS){
      if(slot && slot.source) add(slot.entity);
    }
  }
  add(typeof P !== 'undefined' ? P : null);
  return subjects;
}

function clampEntityToCameraView(ent, cageMargin){
  if(!ent || !$.M) return;
  const viewW = W / CAM_SCALE;
  const viewH = H / CAM_SCALE;
  const minX = CAM_X + cageMargin;
  const maxX = CAM_X + viewW - cageMargin;
  const minY = CAM_Y + cageMargin;
  const maxY = CAM_Y + viewH - cageMargin;
  const prevX = ent.x;
  const prevY = ent.y;
  ent.x = $.M.clamp(ent.x, minX, maxX);
  ent.y = $.M.clamp(ent.y, minY, maxY);
  if(ent.x !== prevX){
    if((prevX < minX && ent.vx < 0) || (prevX > maxX && ent.vx > 0)) ent.vx = 0;
    if((prevX < minX && ent._dvx < 0) || (prevX > maxX && ent._dvx > 0)) ent._dvx = 0;
  }
  if(ent.y !== prevY){
    if((prevY < minY && ent.vy < 0) || (prevY > maxY && ent.vy > 0)) ent.vy = 0;
    if((prevY < minY && ent._dvy < 0) || (prevY > maxY && ent._dvy > 0)) ent._dvy = 0;
  }
}

function enforceCameraCage(){
  if(!cb('followcam') || !$.M) return;
  updateCameraScale();
  const subjects = activeCameraSubjects();
  if(!subjects.length) return;
  const viewW = W / CAM_SCALE;
  const viewH = H / CAM_SCALE;
  const maxCamX = Math.max(0, WORLD_W - viewW);
  const maxCamY = Math.max(0, WORLD_H - viewH);
  const cageMargin = Math.min(CELL_PX * 0.5, Math.max(0, Math.min(viewW, viewH) * 0.5 - 1));
  let minAllowedX = -Infinity, maxAllowedX = Infinity;
  let minAllowedY = -Infinity, maxAllowedY = Infinity;
  for(const ent of subjects){
    minAllowedX = Math.max(minAllowedX, ent.x + cageMargin - viewW);
    maxAllowedX = Math.min(maxAllowedX, ent.x - cageMargin);
    minAllowedY = Math.max(minAllowedY, ent.y + cageMargin - viewH);
    maxAllowedY = Math.min(maxAllowedY, ent.y - cageMargin);
  }
  if(minAllowedX <= maxAllowedX) CAM_X = $.M.clamp(CAM_X, Math.max(0, minAllowedX), Math.min(maxCamX, maxAllowedX));
  if(minAllowedY <= maxAllowedY) CAM_Y = $.M.clamp(CAM_Y, Math.max(0, minAllowedY), Math.min(maxCamY, maxAllowedY));
  clampCamera();
  for(const ent of subjects) clampEntityToCameraView(ent, cageMargin);
  updateMouseWorld();
}

const cameraMotion = {};
function resetCameraMotion(){
  Object.assign(cameraMotion, { x: null, y: null, moveTime: 0, idleTime: 0, distance: 0,
    dirX: 0, dirY: 0, aheadX: 0, aheadY: 0, edgeTime: 0, centerRamp: 0, following: false, centering: false, centerX: false, centerY: false, driver: null, driverDirX: 0, driverDirY: 0 });
  window.DEBUG_CAMERA_DRIVER = null;
}
resetCameraMotion();

function updateCamera(dt){
  updateCameraScale();
  const step = Math.min(0.05, Math.max(0, dt || 1 / 60));
  if(!cb('followcam')){
    CAM_X = (WORLD_W - W / CAM_SCALE) / 2;
    CAM_Y = (WORLD_H - H / CAM_SCALE) / 2;
    resetCameraMotion();
  } else if(typeof P !== 'undefined'){
    const c = cameraMotion;
    const viewW = W / CAM_SCALE, viewH = H / CAM_SCALE;
    const edgeMargin = Math.min(Math.max(CELL_PX * 0.5, (sv('camedge') || 3.5) * CELL_PX), Math.max(CELL_PX * 0.5, Math.min(viewW, viewH) * 0.5 - 1));
    const subjects = activeCameraSubjects();
    let driver = null;
    let bestPressure = 0;

    for(const ent of subjects){
      const prevX = Number.isFinite(ent._camTrackX) ? ent._camTrackX : ent.x;
      const prevY = Number.isFinite(ent._camTrackY) ? ent._camTrackY : ent.y;
      const dx = ent.x - prevX;
      const dy = ent.y - prevY;
      ent._camTrackX = ent.x;
      ent._camTrackY = ent.y;
      const dist = Math.hypot(dx, dy);
      const moving = dist > step * 8 && dist < Math.min(viewW, viewH) * 0.5;
      ent._camFrameDx = dx;
      ent._camFrameDy = dy;
      ent._camFrameMoving = moving;

      if(c.centering) continue;
      const px = ent.x - CAM_X;
      const py = ent.y - CAM_Y;
      const edgeX = px < edgeMargin ? -1 : (px > viewW - edgeMargin ? 1 : 0);
      const edgeY = py < edgeMargin ? -1 : (py > viewH - edgeMargin ? 1 : 0);
      const movingOutward = moving && ((edgeX !== 0 && dx * edgeX > 0) || (edgeY !== 0 && dy * edgeY > 0));
      if(!movingOutward) continue;
      const pressureX = edgeX < 0 ? edgeMargin - px : (edgeX > 0 ? px - (viewW - edgeMargin) : 0);
      const pressureY = edgeY < 0 ? edgeMargin - py : (edgeY > 0 ? py - (viewH - edgeMargin) : 0);
      const pressure = Math.max(pressureX, pressureY);
      if(pressure >= bestPressure){
        bestPressure = pressure;
        driver = { ent, dx, dy, moving, edgeX, edgeY };
      }
    }

    const centerDelay = Math.max(0, sv('camdelay') || 0.5);
    if(!c.centering){
      c.edgeTime = driver ? c.edgeTime + step : 0;
      window.DEBUG_CAMERA_DRIVER = driver ? driver.ent : null;
      if(driver && c.edgeTime >= centerDelay){
        c.centering = true;
        c.centerX = driver.edgeX !== 0;
        c.centerY = driver.edgeY !== 0;
        c.driver = driver.ent;
        c.driverDirX = driver.edgeX;
        c.driverDirY = driver.edgeY;
      }
    }

    if(c.centering){
      const ent = c.driver || P;
      const dx = ent._camFrameDx || 0;
      const dy = ent._camFrameDy || 0;
      const moving = !!ent._camFrameMoving;
      const movedOpposite = (c.centerX && c.driverDirX && dx * c.driverDirX < -step * 8) || (c.centerY && c.driverDirY && dy * c.driverDirY < -step * 8);
      window.DEBUG_CAMERA_DRIVER = ent;
      if(!moving || movedOpposite){
        c.centering = false;
        c.centerX = false;
        c.centerY = false;
        c.edgeTime = 0;
        c.centerRamp = 0;
        c.driver = null;
        c.driverDirX = 0;
        c.driverDirY = 0;
        window.DEBUG_CAMERA_DRIVER = null;
      } else {
        c.edgeTime += step;
        c.centerRamp = $.M.clamp((c.edgeTime - centerDelay) / 0.75, 0, 1);
        const targetX = $.M.clamp(ent.x - viewW / 2, 0, Math.max(0, WORLD_W - viewW));
        const targetY = $.M.clamp(ent.y - viewH / 2, 0, Math.max(0, WORLD_H - viewH));
        const moveAng = Math.atan2(dy, dx);
        const aimAligned = Number.isFinite(ent.angle) && Math.abs($.M.angDiff(ent.angle, moveAng)) <= Math.PI * 70 / 180;
        const intentBoost = aimAligned ? 2 : 1;
        const speed = Math.min(0.07, Math.max(0.003, sv('camlerp') || 0.25)) / 3 * intentBoost * c.centerRamp;
        const alpha = 1 - Math.pow(1 - speed, step * 60);
        const maxStep = Math.max(0.25, Math.min(viewW, viewH) * 0.006 * step * 60 * intentBoost * c.centerRamp);
        const nextX = CAM_X + (targetX - CAM_X) * alpha;
        const nextY = CAM_Y + (targetY - CAM_Y) * alpha;
        if(c.centerX) CAM_X += $.M.clamp(nextX - CAM_X, -maxStep, maxStep);
        if(c.centerY) CAM_Y += $.M.clamp(nextY - CAM_Y, -maxStep, maxStep);
      }
    }
  }
  clampCamera();
  updateMouseWorld();
}
function entityCameraPoint(ent){
  if(!ent) return { x: WORLD_W / 2, y: WORLD_H / 2 };
  return {
    x: isFinite(ent._pendingSpawnX) ? ent._pendingSpawnX : ent.x,
    y: isFinite(ent._pendingSpawnY) ? ent._pendingSpawnY : ent.y
  };
}

function factionSpawnPoint(side, index = 0, total = 1){
  const viewW = W / CAM_SCALE;
  const viewH = H / CAM_SCALE;
  const centerX = WORLD_W / 2;
  const centerY = WORLD_H / 2;
  const edgeGap = CELL_PX * 4;
  const offsetX = Math.max(CELL_PX * 7, viewW / 2 - edgeGap);
  const spreadY = Math.min(180, viewH * 0.2);
  const row = index - (Math.max(1, total) - 1) / 2;
  const dir = side === 'right' ? 1 : -1;
  return {
    x: $.M.clamp(centerX + dir * offsetX, 60, WORLD_W - 100),
    y: $.M.clamp(centerY + row * spreadY, 60, WORLD_H - 60)
  };
}

function snapCameraToPoint(x, y){
  resetCameraMotion();
  updateCameraScale();
  CAM_X = x - (W / CAM_SCALE) / 2;
  CAM_Y = y - (H / CAM_SCALE) / 2;
  clampCamera();
  updateMouseWorld();
}

function snapCameraBetweenEntities(a, b){
  resetCameraMotion();
  updateCameraScale();
  const ap = entityCameraPoint(a);
  const bp = entityCameraPoint(b);
  const ax = isFinite(ap.x) ? ap.x : WORLD_W / 2;
  const ay = isFinite(ap.y) ? ap.y : WORLD_H / 2;
  const bx = isFinite(bp.x) ? bp.x : ax;
  const by = isFinite(bp.y) ? bp.y : ay;
  CAM_X = ((ax + bx) * 0.5) - (W / CAM_SCALE) / 2;
  CAM_Y = ((ay + by) * 0.5) - (H / CAM_SCALE) / 2;
  clampCamera();
  updateMouseWorld();
}

function applyDuelSpawnLayout(){
  if(typeof P === 'undefined') return null;
  const pSpawn = factionSpawnPoint('left');
  P.x = pSpawn.x;
  P.y = pSpawn.y;
  let mainBot = null;
  if(typeof D !== 'undefined' && D) mainBot = D;
  else if(typeof ALL_BOTS !== 'undefined' && ALL_BOTS.length) mainBot = ALL_BOTS[0];
  if(mainBot){
    const bSpawn = factionSpawnPoint('right');
    mainBot.x = bSpawn.x;
    mainBot.y = bSpawn.y;
    mainBot._pendingSpawnX = bSpawn.x;
    mainBot._pendingSpawnY = bSpawn.y;
  }
  if(typeof P !== 'undefined') P._cameraCombatUntil = GameTime + 8;
  if(mainBot) snapCameraBetweenEntities(P, mainBot);
  else snapCameraToTarget();
  return mainBot;
}

function snapCameraToTarget(){
  resetCameraMotion();
  updateCameraScale();
  if(!cb('followcam')){
    CAM_X = (WORLD_W - W / CAM_SCALE) / 2;
    CAM_Y = (WORLD_H - H / CAM_SCALE) / 2;
  } else {
    CAM_X = (typeof P !== 'undefined' ? P.x + 5 : WORLD_W / 2) - (W / CAM_SCALE) / 2;
    CAM_Y = (typeof P !== 'undefined' ? P.y - 8 : WORLD_H / 2) - (H / CAM_SCALE) / 2;
  }
  clampCamera();
  updateMouseWorld();
}

function applyCamScale(){
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.position = 'fixed';
  canvas.style.left = '0'; canvas.style.top = '0';
  updateWorldSize();
  updateCameraScale();
  clampCamera();
  updateMouseWorld();
}
updateWorldSize();
updateCameraScale();

const keys = {};
window.addEventListener('blur', () => {
  // Сбрасываем все зажатые клавиши когда окно теряет фокус
  for(const k in keys) keys[k] = false;
});
window.addEventListener('visibilitychange', () => {
  if(document.hidden) for(const k in keys) keys[k] = false;
});
let mX = W/2, mY = H/2, mDown = false;
let dummyOn = false;

// ── Игровое время (читается практически каждым модулем: AI, combat, FX,
//    ranged-weapons, audio-cooldowns...) — раньше объявлялось в середине
//    файла под MODULE: GAME LOOP, хотя используется значительно раньше по
//    файлу (внутри функций — там порядок объявления не важен благодаря
//    hoisting, но логически это часть ядра, а не часть конкретно "game loop").
let lastT = 0;
let GameTime = 0;
let RealTime = 0;
let rawDt = 0.016; // глобальный, обновляется каждый тик

// ── Периодическое "окно" отклонения меча при блоке ──────────────────────
// Базовое значение отклонения = 5°, но раз в 3-7 сек на короткое время
// (0.4 сек) подскакивает до 100°. Не трогает сам слайдер sl-deflectMax —
// переопределяет значение только в момент вызова doClash().
const DEFLECT_MAX_BASE = 5;
// Bootstrap fallback: math.js is intentionally loaded after engine.js.
function rf(base, spread){ return base + Math.random() * spread; }
const DEFLECT_MAX_SPIKE = 100;
const DEFLECT_SPIKE_DURATION = 0.4; // сек — как долго держится 100°
let _deflectSpikeNextAt = rf(3, 4); // следующее срабатывание (3-7 сек от старта)
let _deflectSpikeUntil = -1;        // пока GameTime < это — активен спайк

function getDynamicDeflectMax(){
  if(GameTime >= _deflectSpikeNextAt && _deflectSpikeUntil < GameTime){
    _deflectSpikeUntil = GameTime + DEFLECT_SPIKE_DURATION;
    _deflectSpikeNextAt = GameTime + DEFLECT_SPIKE_DURATION + rf(3, 4); // след. через 3-7 сек ПОСЛЕ окончания спайка
  }
  return GameTime < _deflectSpikeUntil ? DEFLECT_MAX_SPIKE : DEFLECT_MAX_BASE;
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// Shared micro-macros for repetitive gameplay checks across classic scripts.
const $ = window.$ || (window.$ = {});

$.K = $.K || {
  of(ent){
    if(!ent) return null;
    if(typeof weaponKeyOf === 'function') return weaponKeyOf(ent);
    if(typeof weaponDefFor === 'function'){
      const def = weaponDefFor(ent);
      return def ? def.key : null;
    }
    return null;
  },
  is(ent, ...keys){
    const key = $.K.of(ent);
    return key != null && keys.includes(key);
  },
  isKey(key, ...keys){
    return key != null && keys.includes(key);
  },
  not(ent, ...keys){
    return !$.K.is(ent, ...keys);
  }
};

$.E = $.E || {
  charging(ent){
    return !!(ent && (ent._bowCharging || ent._magicCharging || ent._wandCharging));
  },
  chargeShake(ent){
    return !!(ent && $.K.is(ent, 'wand', 'magicstaff') && (ent._wandCharging || ent._magicCharging));
  },
  shieldOff(ent){
    return !!ent && (isExhausted(ent) || isUnbalanced(ent));
  }
};

$.A = $.A || {
  meleeHold(ent, held){
    return !!held && !isRangedWeapon(ent) && $.K.not(ent, 'flail');
  },
  isAttacking(ent, held){
    if(held !== undefined) return $.A.meleeHold(ent, held);
    if(ent === P) return $.A.meleeHold(ent, mDown);
    const aiHeld = ent?._aiState?._fakeMDown ?? (typeof AI!=='undefined' ? AI?._fakeMDown : false);
    return $.A.meleeHold(ent, aiHeld);
  }
};

$.M = $.M || {
  clamp(v, a, b){ return Math.max(a, Math.min(b, v)); },
  lerpDT(current, target, speed, dt){
    if(!isFinite(current)||!isFinite(target)||!isFinite(dt)) return current;
    const alpha = 1 - Math.pow(1 - Math.min(Math.max(speed,0), 0.9999), dt * 60);
    return current + (target - current) * alpha;
  },
  decayDT(val, decay, dt){
    if(!isFinite(val)||!isFinite(dt)) return 0;
    return val * Math.pow(Math.min(Math.max(decay,0), 0.9999), dt * 60);
  },
  decay(val, decay, dt){
    if(!isFinite(val)||!isFinite(dt)) return 0;
    return val * Math.pow(Math.min(Math.max(decay,0), 0.9999), dt * 60);
  },
  angDiff(a, b){
    let d = a - b;
    while(d > Math.PI) d -= Math.PI * 2;
    while(d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  angLerpDT(current, target, speed, dt){
    if(!isFinite(current)||!isFinite(target)||!isFinite(dt)) return current;
    const alpha = 1 - Math.pow(1 - Math.min(Math.max(speed,0), 0.9999), dt * 60);
    return current + $.M.angDiff(target, current) * alpha;
  },
  dist(ax, ay, bx, by){ return Math.hypot(bx - ax, by - ay); },
  angleTo(ax, ay, bx, by){ return Math.atan2(by - ay, bx - ax); },
  step(dt){ return Math.max(0, Number.isFinite(dt) ? dt * SIM_TICK_RATE : 0); }
};

$.POS = $.POS || {
  center(ent){
    return ent ? { x: ent.x + 5, y: ent.y - 8 } : { x: 0, y: 0 };
  },
  body(ent){
    return ent ? { x: ent.x + 5 + ent.bx, y: ent.y - 8 + ent.by } : { x: 0, y: 0 };
  },
  pivot(ent){
    if(!ent) return { x: 0, y: 0 };
    const c = $.POS.center(ent);
    return { x: c.x + ent.pvX, y: c.y + ent.pvY };
  },
  tip(ent){
    if(!ent) return { x: 0, y: 0 };
    const piv = $.POS.pivot(ent);
    const reach = typeof weaponReach === 'function'
      ? weaponReach(ent) * sv('swlen') * (typeof isBot === 'function' && isBot(ent) ? sv('botswordscale') : 1)
      : 0;
    return { x: piv.x + Math.cos(ent.angle) * reach, y: piv.y + Math.sin(ent.angle) * reach };
  },
  root(){
    return typeof P !== 'undefined' && P ? { x: P.x + 5, y: P.y - 8 } : { x: 0, y: 0 };
  }
};

$.PHY = $.PHY || {
  move(ent, dt, minX = 40, maxX = WORLD_W - 80, minY = 40, maxY = WORLD_H - 40){
    const step = $.M.step(dt);
    ent.x = $.M.clamp(ent.x + ent.vx * step, minX, maxX);
    ent.y = $.M.clamp(ent.y + ent.vy * step, minY, maxY);
    return ent;
  },
  moveSimple(ent, step, minX = 40, maxX = WORLD_W - 80, minY = 40, maxY = WORLD_H - 40){
    ent.x = $.M.clamp(ent.x + ent.vx * step, minX, maxX);
    ent.y = $.M.clamp(ent.y + ent.vy * step, minY, maxY);
    return ent;
  },
  dodge(ent, vx, vy){
    ent._dvx = vx;
    ent._dvy = vy;
    return ent;
  },
  updateDodge(ent, dt, minX = 40, maxX = WORLD_W - 80, minY = 40, maxY = WORLD_H - 40){
    if(!ent || (!ent._dvx && !ent._dvy)) return ent;
    const step = decayingImpulseStep(dt);
    ent.x = $.M.clamp(ent.x + ent._dvx * step, minX, maxX);
    ent.y = $.M.clamp(ent.y + ent._dvy * step, minY, maxY);
    const decay = Math.pow(0.01, dt);
    ent._dvx *= decay;
    ent._dvy *= decay;
    if(Math.hypot(ent._dvx, ent._dvy) < 0.1){ ent._dvx = 0; ent._dvy = 0; }
    return ent;
  }
};

$.NET = $.NET || {
  active(){
    const sync = typeof globalThis !== 'undefined' ? globalThis.NET_SYNC : undefined;
    return !!(sync && sync.active);
  },
  send(msg){
    const core = typeof globalThis !== 'undefined' ? globalThis.NET_CORE : undefined;
    if(core && typeof core.send === 'function') core.send(msg);
  },
  sendFast(msg){
    const core = typeof globalThis !== 'undefined' ? globalThis.NET_CORE : undefined;
    if(core && typeof core.sendFast === 'function') core.sendFast(msg);
  }
};

// Short aliases for the hottest paths.
$.IS = $.K.is;
$.ISK = $.K.isKey;
$.NOT = $.K.not;


















// Вспомогательные функции для entity
function entityCenter(e){
  return { x: e.x + 5, y: e.y - 8 };
}
function entityBodyCenter(e){ return { x: e.x+5+e.bx, y: e.y-8+e.by }; }
function entityPivot(e){
  const c = $.POS.center(e);
  return { x: c.x + e.pvX, y: c.y + e.pvY };
}

// "Клетка" арены в px (та же величина, что и в camrows-масштабировании фона).
const CELL_PX = 55;
// Максимальный HP бойца — везде в игре используется фиксированное значение 100
// при респавне/сбросе. Используется как база для процентных ограничений урона
// (см. updateDroppedWeapons/updateProjectiles), чтобы урон НЕ уменьшался по
// мере снижения текущего HP цели.
const MAX_HP = 100;

function angDiff(a,b){ let d=a-b; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; }
// ── Frame-rate независимые helpers ───────────────────────────────────────────
// speed: скорость lerp при 60fps (напр. 0.28)
// decay: затухание при 60fps (напр. 0.6)
function lerpDT(current, target, speed, dt){
  if(!isFinite(current)||!isFinite(target)||!isFinite(dt)) return current;
  const alpha = 1 - Math.pow(1 - Math.min(Math.max(speed,0), 0.9999), dt * 60);
  return current + (target - current) * alpha;
}
function decayDT(val, decay, dt){
  if(!isFinite(val)||!isFinite(dt)) return 0;
  return val * Math.pow(Math.min(Math.max(decay,0), 0.9999), dt * 60);
}
// Linear velocities in the older gameplay code are expressed in pixels per
// 120 Hz simulation tick. Scale every displacement by game time as well as
// scaling acceleration/decay, otherwise slow motion makes impulses travel
// farther (at 0.1x a dodge used to last roughly ten times as many ticks).
const SIM_TICK_RATE = 120;
function simStep(dt){
  return Math.max(0, Number.isFinite(dt) ? dt * SIM_TICK_RATE : 0);
}
function decayingImpulseStep(dt, decayPerSecond = 0.01){
  if(!Number.isFinite(dt) || dt <= 0) return 0;
  const decay = $.M.clamp(decayPerSecond, 0, 0.999999);
  return (1 - Math.pow(decay, dt)) / (1 - Math.pow(decay, 1 / SIM_TICK_RATE));
}
// Integral of a legacy per-tick value while that value decays every tick.
// Useful for spinning/flying objects whose velocity constants predate dt.
function decayingTickStep(dt, perTickDecay){
  if(!Number.isFinite(dt) || dt <= 0) return 0;
  const decay = $.M.clamp(perTickDecay, 0, 0.999999);
  const ticks = $.M.step(dt);
  return (1 - Math.pow(decay, ticks)) / (1 - decay);
}
function angLerpDT(current, target, speed, dt){
  if(!isFinite(current)||!isFinite(target)||!isFinite(dt)) return current;
  const alpha = 1 - Math.pow(1 - Math.min(Math.max(speed,0), 0.9999), dt * 60);
  return current + $.M.angDiff(target, current) * alpha;
}

// ════════════════════════════════════════════════════════════════════════════
