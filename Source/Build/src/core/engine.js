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
let CAM_FOLLOW_SPEED = 0.25;
let mouseScreenX = W / 2, mouseScreenY = H / 2;

function updateWorldSize(){
  const aspect = Math.max(0.1, window.innerWidth / Math.max(1, window.innerHeight));
  const minWorldH = Math.max(window.innerHeight * 3, 55 * 42);
  WORLD_H = Math.round(minWorldH);
  WORLD_W = Math.round(Math.max(window.innerWidth * 3, minWorldH * aspect));
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

function updateCamera(dt){
  updateCameraScale();
  if(!cb('followcam')){
    CAM_X = (WORLD_W - W / CAM_SCALE) / 2;
    CAM_Y = (WORLD_H - H / CAM_SCALE) / 2;
    clampCamera();
    updateMouseWorld();
    return;
  }
  const target = cameraTargetPoint();
  const targetX = target.x - (W / CAM_SCALE) / 2;
  const targetY = target.y - (H / CAM_SCALE) / 2;
  const spd = cameraFollowSpeed(dt || 1 / 60);
  CAM_X = $.M.lerpDT(CAM_X, targetX, spd, dt || 1 / 60);
  CAM_Y = $.M.lerpDT(CAM_Y, targetY, spd, dt || 1 / 60);
  keepCameraContainingPlayer();
  clampCamera();
  updateMouseWorld();
}

// Применяет размер viewport и масштаб зоны видимости.
function cameraTargetPoint(){
  if(typeof P === 'undefined') return { x: WORLD_W / 2, y: WORLD_H / 2 };
  const combatBot = cameraCombatBot();
  if(combatBot){
    const bp = entityCameraPoint(combatBot);
    return { x: (P.x + bp.x) * 0.5, y: (P.y + bp.y) * 0.5 };
  }
  return { x: P.x + 5, y: P.y - 8 };
}

function cameraCombatBot(){
  if(typeof P === 'undefined' || (P._cameraCombatUntil || 0) <= GameTime) return null;
  if(typeof DEATH !== 'undefined' && DEATH && (DEATH.fadeIn || DEATH.pDead || DEATH.dDead)){
    if(typeof D !== 'undefined' && D && !D._awaitingReveal) return D;
  }
  if(typeof D !== 'undefined' && D && D.hp > 0 && !D._defeated) return D;
  if(typeof ALL_BOTS !== 'undefined'){
    for(const bot of ALL_BOTS){
      if(bot && bot.hp > 0 && !bot._defeated) return bot;
    }
  }
  return null;
}

function entityCameraPoint(ent){
  if(!ent) return { x: WORLD_W / 2, y: WORLD_H / 2 };
  return {
    x: isFinite(ent._pendingSpawnX) ? ent._pendingSpawnX : ent.x,
    y: isFinite(ent._pendingSpawnY) ? ent._pendingSpawnY : ent.y
  };
}

function cameraFollowSpeed(dt){
  const normal = Math.max(0.003, sv('camlerp') || 0.25);
  const desired = cameraCombatBot() ? 0.003 : normal;
  CAM_FOLLOW_SPEED = $.M.lerpDT(CAM_FOLLOW_SPEED, desired, 0.08, dt || 1 / 60);
  return CAM_FOLLOW_SPEED;
}

function keepCameraContainingPlayer(){
  if(typeof P === 'undefined') return;
  const viewW = W / CAM_SCALE;
  const viewH = H / CAM_SCALE;
  const marginX = 18;
  const marginY = 18;
  if(P.x < CAM_X + marginX) CAM_X = P.x - marginX;
  if(P.x > CAM_X + viewW - marginX) CAM_X = P.x - viewW + marginX;
  if(P.y < CAM_Y + marginY) CAM_Y = P.y - marginY;
  if(P.y > CAM_Y + viewH - marginY) CAM_Y = P.y - viewH + marginY;
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
  updateCameraScale();
  CAM_X = x - (W / CAM_SCALE) / 2;
  CAM_Y = y - (H / CAM_SCALE) / 2;
  clampCamera();
  updateMouseWorld();
}

function snapCameraBetweenEntities(a, b){
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
