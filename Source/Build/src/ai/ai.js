// === src/ai/ai.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: AI — контроллер ботов, тактики, профили, дуэль
// Module file: ai.js
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// MODULE: AI  (bot controller, tactics, sword styles, mirror/duelist/swordsman)
// AI logic is already isolated in this module; no global API is needed.
// ════════════════════════════════════════════════════════════════════════════
// ── AI CONTROLLER ────────────────────────────────────────────────────────────
// Все команды только через fakeKeys/fakeMDown/fakeMX/fakeMY — физику не трогаем.
// ════════════════════════════════════════════════════════════════════════════
// MODULE: AI PROFILES  (веса тактик/стилей — легко создавать разные "характеры" бота)
// Future: extract to ai-profiles.json, load via fetch
// ════════════════════════════════════════════════════════════════════════════
const AI_PROFILES = {
  default: {
    // Веса стилей меча (сумма не обязана быть 100, нормализуется автоматически)
    swordStyleWeights: { MIRROR: 50, SWORDSMAN: 25, DUELIST: 25 },
    // Шанс ярости при переходе в атаку из передышки/отступления
    rageOnAttackChance: 0.5,
    // Длительность ярости бота (сек)
    rageDuration: 4.0,
    // Шанс ложного шага (фейнт) при отступлении
    feintChance: 1.0, // используется как множитель к интервалу
    // Шанс выпада после контакта
    lungeChance: 0.2,
    // Дальность дуэльной зоны (доп. множитель к sl-duelrad)
    duelRadiusMult: 1.0,
  },
  // Пример агрессивного профиля — больше DUELIST, чаще ярость
  aggressive: {
    swordStyleWeights: { MIRROR: 30, SWORDSMAN: 20, DUELIST: 50 },
    rageOnAttackChance: 0.8,
    rageDuration: 5.0,
    feintChance: 0.6,
    lungeChance: 0.35,
    duelRadiusMult: 0.8,
  },
  // Пример défensive профиля — больше MIRROR, реже ярость
  defensive: {
    swordStyleWeights: { MIRROR: 70, SWORDSMAN: 20, DUELIST: 10 },
    rageOnAttackChance: 0.3,
    rageDuration: 3.0,
    feintChance: 1.4,
    lungeChance: 0.1,
    duelRadiusMult: 1.3,
  },
};
let AI_ACTIVE_PROFILE = 'default';
function getAIProfile(){ return AI_PROFILES[AI_ACTIVE_PROFILE] || AI_PROFILES.default; }

// Выбирает стиль меча по весам активного профиля
function pickSwordStyle(){
  const w = getAIProfile().swordStyleWeights;
  const total = w.MIRROR + w.SWORDSMAN + w.DUELIST;
  const roll = Math.random() * total;
  if(roll < w.MIRROR) return 'SWORD_STYLE_MIRROR';
  if(roll < w.MIRROR + w.SWORDSMAN) return 'SWORD_STYLE_SWORDSMAN';
  return 'SWORD_STYLE_DUELIST';
}
// ════════════════ END MODULE: AI PROFILES ════════════════════════════════════

// freshAIState(): создаёт новый, "чистый" объект AI-состояния такой же формы,
// как исходный AI ниже. Каждый бот носит свой собственный такой объект в
// bot._aiState — так что "умный" AI можно свободно переключать между ботами
// (см. switchSmartBot), просто меняя, на какой объект указывают D и AI.
function freshAIState(){
  return {
  enabled: true,
  phase: 'attack',
    _isMain: false,
    _mode: 'defence',
    _thinkTimer: rf(0.3,0.4),
    _orbitDir: Math.random() < 0.5 ? 1 : -1,
  tactic: 'COMBAT_RETREATING',
  swordStyle: 'SWORD_STYLE_SWORDSMAN',
  _tacticTimer: -1,
  _duelistBlocking: false,
  _harassPhase: 'approach',
  _harassTimer: -1,
  _harassStrikes: 0,
  _harassOrbitAng: 0,
  _harassOrbitDir: 1,
  _harassTotalEnd: -1,
  _fakeKeys: { w:false, a:false, s:false, d:false },
  _fakeMDown: false,
  _fakeMX: 0, _fakeMY: 0,
  _retreatMode: false,
  _spinActive: false, _spinAng: 0, _spinEndTime: -1, _spinSpeed: 0,
  _feintActive: false, _feintSteps: [], _feintIdx: 0, _feintStepEnd: -1, _feintCD: -1,
  _lungeActive: false, _lungePhase: 'back', _lungeEnd: -1,
  _smoothMX: 0, _smoothMY: 0, _smoothInited: false,
  _feintPattern: [], _feintStep: 0,
  _contactCD: -1,
  _phaseEnd: -1,
  _retreatTargX: 0, _retreatTargY: 0,
  _retreatMoveCD: -1,
  _circling: false, _circleDir: 1, _circleAng: 0,
  _posTimer: 0, _posIdx: 0,
  _breatherBackEnd: -1,
  _breatherArrived: false, _breatherEndAfterArrival: -1,
  _probingActive: false, _probingPhase: 'approach', _probingEnd: -1,
  _probingStrikes: 0, _probingSwingSide: 1, _probingRollDone: false,
  _probingRetreatStep: 0, _probingModeEnd: -1, _probingLastEnd: -999,
  _probingDistanceScale: 1, _probingWeaponContact: false,
  _probingAngleJitter: 0, _probingPauseBlockedUntil: -1, _probingMirrorBlock: false,
  };
}

// ── МУЛЬТИ-БОТ ИНФРАСТРУКТУРА ────────────────────────────────────────────
// ALL_BOTS: все боты в текущем бою (D — всегда один из элементов этого массива,
// а именно тот, кто сейчас управляется полным "умным" AI).
let ALL_BOTS = [];
function isBot(ent){ return ALL_BOTS.indexOf(ent) !== -1; }

// Бот считается "готовым" (можно рисовать/атаковать), когда его скин-спрайт
// реально загружен. Пока это не так — держим бота ФИЗИЧЕСКИ далеко за пределами
// арены (а не просто "невидимым" на месте спавна), чтобы по нему нельзя было
// случайно попасть мечом/брошенным оружием, пока он не отрисовывается.
const BOT_OFFMAP_X = -9999, BOT_OFFMAP_Y = -9999;
function placeBotPendingReveal(nb, targetX, targetY){
  nb._pendingSpawnX = targetX;
  nb._pendingSpawnY = targetY;
  nb._awaitingReveal = true;
  nb.x = BOT_OFFMAP_X; nb.y = BOT_OFFMAP_Y;
}
// Вызывается раз в кадр до апдейта AI/боя — переносит бота на реальную точку
// спавна, как только его картинка догрузилась (или сразу, если картинки нет).
function revealBotIfReady(bot){
  if(!bot._awaitingReveal) return true;
  const img = bot._skinImg;
  if(!img || img.complete){
    bot.x = bot._pendingSpawnX;
    bot.y = bot._pendingSpawnY;
    bot._awaitingReveal = false;
    return true;
  }
  return false;
}

// Единый глобальный кулдаун смены короны — не чаще 1 раза в секунду,
// независимо от того, что вызвало смену (клэш, удар, касание или таймер).
let _lastCrownSwitchTime = -999;
const CROWN_SWITCH_COOLDOWN = 1.0; // сек

// Переключить "умный" AI на другого бота (вызывается при контакте меча с игроком)
// Возвращает true, если смена реально произошла, false — если заблокирована кулдауном.
function switchSmartBot(newBot){
  if(!newBot || newBot === D) return false;
  // Защита от слишком частой смены короны (не чаще раза в секунду)
  if(GameTime - _lastCrownSwitchTime < CROWN_SWITCH_COOLDOWN) return false;
  _lastCrownSwitchTime = GameTime;
  
  // Снимаем статус у старого
  if(D && D._aiState){
    D._aiState._isMain = false;
    D._aiState._mode = 'defence';
    D._aiState._fakeMDown = false;
    D._aiState._phase = 'defence';
  }
  
  // Назначаем новому
  newBot._aiState._isMain = true;
  newBot._aiState._mode = 'attack';
  newBot._aiState._phase = 'attack';
  newBot._aiState._fakeMDown = true;
  
  D = newBot;
  AI = newBot._aiState;
  
  //if(typeof hitFX !== 'undefined'){
  //  hitFX.push({
  //    x: newBot.x, y: newBot.y - 50,
   //   t: '👑 КОРОНА!',
   //   life: 50, big: true, col: '#ffdd44'
   // });
 // }
 // playSound('uiNote');
  return true;
}


// Случайное целое число от min до max (включительно)
// (остальные хелперы случайных чисел — randRange/rf/pick/randSign — собраны
// в модуле MATH HELPERS ниже, чтобы не дублировать в двух местах)
function RndI(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Паттерны шагов финта (было продублировано как один и тот же литерал
// массива в двух местах AI-логики — пересоздавался на каждый вызов)
const FEINT_STEP_PATTERNS = [[1,-1],[-1,1],[-1,1,-1],[-1,-1],[1,1],[2,-2],[-2,2]];

let _mainBotSwapTime = rf(5,10); // 5–15 сек до первой смены

function updateMainBotRotation(){
  if(!dummyOn || ALL_BOTS.length < 2) return;
  
  // Проверяем, наступило ли время смены
  //_mainBotSwapTime = GameTime+ 9999 test
  if(GameTime >= _mainBotSwapTime){
    const alive = ALL_BOTS.filter(b => b.hp > 0 && b !== D);
    if(alive.length > 0){
      const newMain = alive[Math.floor(Math.random() * alive.length)];
      switchSmartBot(newMain);
    }
    // Ставим следующую смену через 999 секунд
    _mainBotSwapTime = GameTime + RndI(2, 10);
  }
}

// Создать/удалить ботов чтобы совпадало со слайдером "Кол-во ботов"



function applyBotCount(){
  const target = Math.round(sv('botcount')) || 1;
  while(ALL_BOTS.length < target){
    const idx = ALL_BOTS.length;
    const ang = (idx / target) * Math.PI * 2;
    const spawnX = clamp(W/2 + 110 + Math.cos(ang)*140, 60, W-100);
    const spawnY = clamp(H/2 + Math.sin(ang)*140, 60, H-60);
    const nb = makeEntity(spawnX, spawnY, 0.8, '#4a1a10', { stamRegen: 28 });
    nb._aiState = freshAIState();
    // Если игра сейчас на паузе (T/Е) — новый бот тоже должен родиться замороженным
    if(typeof AI!=='undefined' && AI && AI.enabled===false) nb._aiState.enabled = false;
    nb._isExtra = idx > 0;
    
    const rand = Math.random();
    let role;
    if(rand < 0.8){
      role = 'coward';
    } else {
      const roles = ['guard', 'harasser', 'flanker', 'distractor'];
      role = roles[Math.floor(Math.random() * roles.length)];
    }
    nb._aiState._role = role;
    nb._aiState._isMain = false;
    nb._aiState._mode = 'defence';
    nb._aiState._cowardPanic = false;
    nb._aiState._cowardTimer = 0;
    
    if(typeof spritesDBReady!=='undefined' && spritesDBReady && typeof assignRandomSkin==='function') assignRandomSkin(nb);
    // Держим бота за пределами арены, пока его скин реально не догрузится —
    // иначе он несколько кадров "невидим", но уже стоит на арене и может получать урон.
    placeBotPendingReveal(nb, spawnX, spawnY);
    ALL_BOTS.push(nb);
  }
  
  while(ALL_BOTS.length > target){
    const removed = ALL_BOTS.pop();
    // Если удалили главного — снимаем статус и назначаем нового
    if(removed === D && ALL_BOTS.length > 0){
      // Снимаем статус у всех
      for(const b of ALL_BOTS){
        if(b._aiState){
          b._aiState._isMain = false;
          b._aiState._mode = 'defence';
          b._aiState._fakeMDown = false;
          b._aiState._phase = 'defence';
        }
      }
      // Назначаем первого
      D = ALL_BOTS[0];
      D._aiState._isMain = true;
      D._aiState._mode = 'attack';
      D._aiState._phase = 'attack';
      D._aiState._fakeMDown = true;
      AI = D._aiState;
    }
  }
  
  // Только если D не существует
  if(ALL_BOTS.length > 0 && !D){
    D = ALL_BOTS[0];
    D._aiState._isMain = true;
    D._aiState._mode = 'attack';
    D._aiState._phase = 'attack';
    D._aiState._fakeMDown = true;
    AI = D._aiState;
  }
}










let AI = {
  enabled: true,
  phase: 'attack',  // 'attack' | 'retreat' | 'breather'
  tactic: 'COMBAT_RETREATING',
  swordStyle: 'SWORD_STYLE_SWORDSMAN', // SWORDSMAN | DUELIST | MIRROR // 'SWORD_STYLE_SWORDSMAN' | 'SWORD_STYLE_DUELIST'
  _tacticTimer: -1,
  _duelistBlocking: false,
  _harassPhase: 'approach', // approach | strike | orbit
  _harassTimer: -1,
  _harassStrikes: 0,
  _harassOrbitAng: 0,
  _harassOrbitDir: 1,
  _harassTotalEnd: -1,
  _fakeKeys: { w:false, a:false, s:false, d:false },
  _fakeMDown: false,
  _fakeMX: 0, _fakeMY: 0,
  _retreatMode: false,
  _spinActive: false, _spinAng: 0, _spinEndTime: -1, _spinSpeed: 0,
  _feintActive: false, _feintSteps: [], _feintIdx: 0, _feintStepEnd: -1, _feintCD: -1,
  _lungeActive: false, _lungePhase: 'back', _lungeEnd: -1,
  _smoothMX: 0, _smoothMY: 0, _smoothInited: false,
  _feintActive: false, _feintPattern: [], _feintStep: 0, _feintStepEnd: -1, _feintCD: -1,

  // таймеры и состояние
  _contactCD: -1,     // когда будет переход после контакта
  _phaseEnd: -1,      // конец текущей фазы
  _retreatTargX: 0, _retreatTargY: 0,
  _retreatMoveCD: -1,
  _circling: false, _circleDir: 1, _circleAng: 0,
  _posTimer: 0, _posIdx: 0,
  _breatherBackEnd: -1,
  _breatherArrived: false, _breatherEndAfterArrival: -1,
  _probingActive: false, _probingPhase: 'approach', _probingEnd: -1,
  _probingStrikes: 0, _probingSwingSide: 1, _probingRollDone: false,
  _probingRetreatStep: 0, _probingModeEnd: -1, _probingLastEnd: -999,
  _probingDistanceScale: 1, _probingWeaponContact: false,
  _probingAngleJitter: 0, _probingPauseBlockedUntil: -1, _probingMirrorBlock: false,
};

// D — бот №1 по умолчанию. Изначально он же и "умный" (владелец AI).
D._aiState = AI;
D._isExtra = false;
ALL_BOTS = [D];

function aiStartSpin(durationSec){
  if(!dummyOn || AI._spinActive) return;
  if(cb('nospin')) return;
  if(AI.swordStyle === 'SWORD_STYLE_DUELIST') return; // duelist не вращает
  const dBodyC = entityBodyCenter(D);
  const dpivX = dBodyC.x + D.pvX, dpivY = dBodyC.y + D.pvY;
  // Начинаем с текущего положения меча бота (fakeMX/MY относительно пивота)
  const curAngToFakeM = Math.atan2(AI._fakeMY - dpivY, AI._fakeMX - dpivX);
  AI._spinActive = true;
  AI._spinAng = curAngToFakeM; // стартуем с текущего угла — нет прыжка
  AI._spinEndTime = GameTime + durationSec;
  AI._spinSpeed = (Math.PI*2) / durationSec;
}

function aiSetPhase(phase){
  if(!dummyOn) return; // guard: не менять фазу пока бот не заспавнен
  const cscl = sv('cscl');
  AI.phase = phase;
  // Не сбрасываем smooth — продолжаем плавно от текущей позиции
  if(phase === 'attack'){
    AI._phaseEnd = -1;
    AI._retreatMode = false;
    // Бот включает ярость при переходе в атаку (50% шанс)
    if(dummyOn && Math.random() < getAIProfile().rageOnAttackChance){
      D.rageBuffEnd = GameTime + getAIProfile().rageDuration;
      D.rage = 100;
      hitFX.push({x:entityBodyCenter(D).x, y:entityBodyCenter(D).y-40, t:'🔥', life:35, big:false, col:'#ff4020'});
    }
    // при начале атаки — если игрок далеко, прокрут
    const pBodyC = entityBodyCenter(P);
    const dBodyC = entityBodyCenter(D);
    const cscl = sv('cscl');
    const dist = Math.hypot(pBodyC.x-dBodyC.x, pBodyC.y-dBodyC.y);
    if(dist > 150*cscl){
      aiStartSpin(sv('spindur'));
    }
  } else if(phase === 'retreat'){
    AI._retreatMode = true;
    AI._phaseEnd = GameTime + rf(5,4);
    AI._retreatMoveCD = -1;
    AI._circling = false;
    // 50% шанс прокрута при первой точке
    if(Math.random() < 0.5){
      aiStartSpin(sv('spindur'));
    }
  } else if(phase === 'breather'){
    AI._retreatMode = false;
    AI._phaseEnd = GameTime + rf(1,2);
    AI._breatherBackEnd = GameTime + rf(0.2,0.3);
  }
}

// Вычисляем точку отступления: d пикс от игрока по направлению от бота
function aiRetreatPoint(){
  const pBodyC = entityBodyCenter(P);
  const dBodyC = entityBodyCenter(D);
  const ang = Math.atan2(dBodyC.y - pBodyC.y, dBodyC.x - pBodyC.x);
  
  // 🔥 ЕСЛИ У ИГРОКА ЛУК/АРБАЛЕТ — ОТСТУПАЕМ ДАЛЬШЕ
  const isPlayerRanged = isRangedWeapon(P) && P.hasWeapon !== false;
  const retreatMult = isPlayerRanged ? 2.0 : 1.0;
  
  const d = (100 + (Math.floor(Math.random()*3)+1)*25) * sv('cscl') * retreatMult;
  return {
    x: pBodyC.x + Math.cos(ang)*d,
    y: pBodyC.y + Math.sin(ang)*d,
  };
}

// Установка fakeKeys на движение к точке target
function aiMoveToward(k, fromC, target, stopDist, cscl){
  const dx = target.x - fromC.x, dy = target.y - fromC.y;
  const dist = Math.hypot(dx, dy);
  if(dist < stopDist){ k.w=k.a=k.s=k.d=false; return; }
  const ax = dx/dist, ay = dy/dist;
  k.a = ax < -0.3; k.d = ax > 0.3;
  k.w = ay < -0.3; k.s = ay > 0.3;
}

// Установка fakeKeys на движение ОТ точки
function aiMoveAway(k, fromC, target, maxDist, cscl){
  const dx = fromC.x - target.x, dy = fromC.y - target.y;
  const dist = Math.hypot(dx, dy);
  if(dist > maxDist){ k.w=k.a=k.s=k.d=false; return; }
  const ax = dx/(dist||1), ay = dy/(dist||1);
  k.a = ax < -0.3; k.d = ax > 0.3;
  k.w = ay < -0.3; k.s = ay > 0.3;
}

const PROBING_WEAPON_KEYS = [
  'dagger', 'rapier', 'sword', 'longsword', 'greatsword',
  'staff', 'halberd', 'spear', 'wand'
];

// Deliberately short attack made outside body-hit range.
function aiUpdateProbing(ai, bot, k, bBodyC, pBodyC, distToPlayer, cscl){
  const reach = weaponReach(bot) * sv('swlen') * (isBot(bot) ? sv('botswordscale') : 1);
  const baseSafeDist = reach + 65 * cscl;
  // Each missed exchange closes the next attempt by 22%, but never removes
  // the minimum body-safe gap beyond the weapon tip.
  const safeDist = Math.max(reach + 20 * cscl,
    baseSafeDist * (ai._probingDistanceScale || 1));
  const retreatDist = safeDist + (ai._probingRetreatStep || 125 * cscl * sv('probingretreat'));
  const playerWeaponPivot = entityPivot(P);
  const playerWeaponTip = weaponTipPos(P);
  const playerWeaponCenter = {
    x: (playerWeaponPivot.x + playerWeaponTip.x) * 0.5,
    y: (playerWeaponPivot.y + playerWeaponTip.y) * 0.5,
  };
  const ang = Math.atan2(playerWeaponCenter.y - bBodyC.y, playerWeaponCenter.x - bBodyC.x);

  if(ai._probingPhase === 'approach'){
    ai._fakeMDown = false;
    if(distToPlayer < safeDist - 8 * cscl) aiMoveAway(k, bBodyC, pBodyC, safeDist, cscl);
    else if(distToPlayer > safeDist + 12 * cscl) aiMoveToward(k, bBodyC, pBodyC, safeDist, cscl);
    else {
      k.w=k.a=k.s=k.d=false;
      ai._probingPhase = 'strike';
      // Alternate between a 1-3 and a 2-3 hit series.
      ai._probingStrikes = Math.random() < 0.5
        ? 1 + Math.floor(Math.random() * 3)
        : 2 + Math.floor(Math.random() * 2);
      ai._probingSwingSide = Math.random() < 0.5 ? -1 : 1;
      ai._probingAngleJitter = (Math.random() * 2 - 1) * 10 * Math.PI / 180;
      ai._probingMirrorBlock = Math.random() < 0.3;
      ai._probingEnd = GameTime + 0.32;
    }
    // Fencing motion is only used while approaching.
    const approachAim = ang + Math.sin(GameTime * 7) * 0.36 + ai._probingAngleJitter;
    aiPointMouse(bBodyC,
      bBodyC.x + Math.cos(approachAim) * 150 * cscl,
      bBodyC.y + Math.sin(approachAim) * 150 * cscl);
    return true;
  }

  if(ai._probingPhase === 'strike'){
    if(distToPlayer < safeDist) aiMoveAway(k, bBodyC, pBodyC, safeDist, cscl);
    else k.w=k.a=k.s=k.d=false;
    const botWeaponPivot = entityPivot(bot);
    if(ai._probingMirrorBlock){
      // 30%: mirror into a block, limited to the forward +/-60 degree arc.
      const mirroredBlockAng = P.angle + Math.PI / 2 + (P.vel > 0 ? -0.3 : 0.3);
      const frontAng = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
      const maxFrontMirror = Math.PI / 3;
      const blockAng = frontAng + clamp(
        angDiff(mirroredBlockAng, frontAng), -maxFrontMirror, maxFrontMirror);
      aiPointMouse(bBodyC,
        botWeaponPivot.x + Math.cos(blockAng) * 150 * cscl,
        botWeaponPivot.y + Math.sin(blockAng) * 150 * cscl);
      ai._fakeMDown = false;
    } else {
      // 70%: hold the weapon pointed directly at the player. No side swing
      // and no attack input during this probing test.
      const pointAng = Math.atan2(pBodyC.y - botWeaponPivot.y, pBodyC.x - botWeaponPivot.x);
      aiPointMouse(bBodyC,
        botWeaponPivot.x + Math.cos(pointAng) * 150 * cscl,
        botWeaponPivot.y + Math.sin(pointAng) * 150 * cscl);
      ai._fakeMDown = false;
    }
    if(GameTime >= ai._probingEnd){
      ai._probingStrikes--;
      ai._probingSwingSide *= -1;
      if(ai._probingStrikes > 0){
        ai._probingAngleJitter = (Math.random() * 2 - 1) * 10 * Math.PI / 180;
        ai._probingEnd = GameTime + 0.32;
      }
      else {
        ai._fakeMDown = false;
        if(!ai._probingWeaponContact){
          ai._probingDistanceScale = Math.max(0.35, (ai._probingDistanceScale || 1) * 0.78);
        }
        ai._probingPhase = 'retreat';
        const normalRetreatDistance = (125 + Math.random() * 50) * cscl;
        ai._probingRetreatStep = normalRetreatDistance * Math.min(0.7, sv('probingretreat'));
        ai._probingEnd = GameTime + 1.1;
      }
    }
    return true;
  }

  ai._fakeMDown = false;
  if(ai._probingPhase === 'retreat'){
    // Keep the weapon still while stepping back: no tracking or fencing.
    const botWeaponPivot = entityPivot(bot);
    aiPointMouse(bBodyC,
      botWeaponPivot.x + Math.cos(bot.angle) * 150 * cscl,
      botWeaponPivot.y + Math.sin(bot.angle) * 150 * cscl,
      true);
    aiMoveAway(k, bBodyC, pBodyC, retreatDist, cscl);
    if(distToPlayer >= retreatDist || GameTime >= ai._probingEnd){
      k.w=k.a=k.s=k.d=false;
      if(GameTime < ai._probingModeEnd &&
         (GameTime < ai._probingPauseBlockedUntil || Math.random() < 0.85)){
        if(GameTime >= ai._probingPauseBlockedUntil){
          ai._probingPauseBlockedUntil = GameTime + rf(7, 5);
        }
        ai._probingPhase = 'approach';
        ai._probingRetreatStep = 0;
        ai._probingWeaponContact = false;
        ai._probingEnd = -1;
      } else {
        ai._probingPhase = 'pause';
        const shortPause = Math.random() < 0.5;
        ai._probingEnd = GameTime < ai._probingModeEnd
          ? GameTime + (shortPause ? rf(0.2, 0.2) : rf(1, 0.5))
          : GameTime;
      }
      ai._retreatMode = false;
    }
    return true;
  }

  // Rare breather: half are 0.2-0.4s, the rest are 1-1.5s.
  k.w=k.a=k.s=k.d=false;
  aiPointMouse(bBodyC, playerWeaponCenter.x, playerWeaponCenter.y);
  if(GameTime >= ai._probingEnd){
    if(GameTime < ai._probingModeEnd){
      // The mode is locked for 7-15 seconds: start another probing exchange.
      ai._probingPhase = 'approach';
      ai._probingRetreatStep = 0;
      ai._probingWeaponContact = false;
      ai._probingEnd = -1;
      ai._retreatMode = false;
    } else {
      ai._probingActive = false;
      ai._probingPhase = 'approach';
      ai._probingLastEnd = GameTime;
      ai.phase = 'retreat';
      ai._retreatMode = true;
      ai._phaseEnd = GameTime + rf(1.5, 0.8);
      ai._retreatMoveCD = -1;
    }
  }
  return true;
}

function aiPointMouse(dBodyC, targetX, targetY, instant, _dt){
  if(!AI._smoothInited || instant){
    AI._smoothMX = targetX;
    AI._smoothMY = targetY;
    AI._smoothInited = true;
  }
  // Плавный lerp к целевой точке
  const lerpSpd = 0.18;
  AI._smoothMX += (targetX - AI._smoothMX) * lerpSpd;
  AI._smoothMY += (targetY - AI._smoothMY) * lerpSpd;
  AI._fakeMX = AI._smoothMX;
  AI._fakeMY = AI._smoothMY;
}

// ── DUEL POSITION SYSTEM ────────────────────────────────────────────────────
const DUEL = {
  active: false,
  cx: 0, cy: 0,
  pLastInRange: 0, // инициализируем 0, не -1
};

function duelUpdate(dt){
  if(!dummyOn) return;
  if(!cb('duel')){ AI._duelPull=false; DUEL.active=false; return; }
  const pBodyC = entityBodyCenter(P);
  const dBodyC = entityBodyCenter(D);
  const cscl = sv('cscl');
  const duelRad = sv('duelrad') * cscl;
  const swReach = weaponReach(D) * sv('swlen') * 2.5;

  const distToPlayer = Math.hypot(pBodyC.x-dBodyC.x, pBodyC.y-dBodyC.y);
  const playerInReach = distToPlayer < swReach;
  if(playerInReach) DUEL.pLastInRange = GameTime;

  // Сброс если игрок далеко > 2 сек
  if(DUEL.active && !playerInReach && GameTime - DUEL.pLastInRange > 2.0){
    DUEL.active = false;
    AI._duelPull = false;
    DUEL.nextMoveCD = -1;
  }

  // Периодически выбираем новую цель внутри Duel Zone
  if(!DUEL.nextMoveCD) DUEL.nextMoveCD = -1;
  if(DUEL.active && AI.phase === 'attack'){
    const distFromCenter = Math.hypot(dBodyC.x-DUEL.cx, dBodyC.y-DUEL.cy);
    // Бот вышел за радиус — выдаём цель внутри зоны
    if(distFromCenter > duelRad && GameTime >= DUEL.nextMoveCD){
      const r = duelRad * 0.7;
      const ang = Math.random() * Math.PI * 2;
      AI._duelTargX = clamp(DUEL.cx + Math.cos(ang)*r*Math.random(), 60, W-100);
      AI._duelTargY = clamp(DUEL.cy + Math.sin(ang)*r*Math.random(), 60, H-60);
      AI._duelPull = true;
      DUEL.nextMoveCD = GameTime + rf(0.5,1.5);
    }
    // Бот дошёл до цели — снимаем pull, двигаемся к игроку
    if(AI._duelPull){
      const distToTarg = Math.hypot(dBodyC.x-AI._duelTargX, dBodyC.y-AI._duelTargY);
      if(distToTarg < 40*cscl) AI._duelPull = false;
    }
    // Бот внутри зоны — pull не нужен
    if(distFromCenter <= duelRad) AI._duelPull = false;
  } else {
    AI._duelPull = false;
  }
}

// Уведомление о контакте мечами (вызывается из checkSwordCollision)
function aiNotifyContact(){
  if(AI._probingActive){
    AI._probingWeaponContact = true;
    AI._probingDistanceScale = 1;
  }
  if(AI._contactCD > GameTime) return;
  const delay = 1 + Math.floor(Math.random()*4);
  AI._contactCD = GameTime + delay;

  // Фиксируем центр дуэли при первом контакте
  if(!DUEL.active){
    const dBodyC = entityBodyCenter(D);
    DUEL.cx = dBodyC.x;
    DUEL.cy = dBodyC.y;
    DUEL.active = true;
    DUEL.pLastInRange = GameTime;
    hitFX.push({x:DUEL.cx, y:DUEL.cy-20, t:'⚔', life:30, big:false, col:'rgba(200,180,60,0.7)'});
  }

  // 20% шанс на обычном оружии, 55% у рапиры (она заточена под уколы) —
  // шаг назад + выпад ЛКМ (цепом не колют и не делают выпад)
  const _lungeChance = weaponKeyOf(D) === 'rapier' ? 0.55 : 0.2;
  if(!AI._probingActive && Math.random() < _lungeChance && !AI._lungeActive && weaponKeyOf(D) !== 'flail'){
    AI._lungeActive = true;
    AI._lungePhase = 'back';
    AI._lungeEnd = GameTime + 0.35;
  }
}

// ── Бросок оружия ботом по уставшему игроку ─────────────────────────────
// Виды оружия, которые бот готов метнуть (список по запросу): молот, топор,
// копьё, кинжал, меч.
const THROWABLE_MELEE_KEYS = ['hammer','axe','spear','dagger','sword'];
// Общий (на всех ботов) таймер — защищает от того, чтобы несколько ботов
// подряд закидали игрока оружием один за другим.
let GLOBAL_THROW_COOLDOWN_UNTIL = 0;
// Примерная максимальная дальность полёта брошенного оружия — оценивается
// по той же физике затухания скорости, что в updateDroppedWeapons (коэф. 0.9887/тик).
function estimateThrowRange(def){
  if(!def) return 300;
  const v0 = (def.throwSpeed || 10) / 2; // throwWeapon() запускает снаряд с половиной табличной скорости
  return v0 / (1 - 0.9887);
}


 function updateAI(dt, bot){
  if(!bot || bot.hp <= 0 || !dummyOn) return;
  if(!bot._aiState) return;
  
  const ai = bot._aiState;
  if(!ai.enabled){
    ai._fakeKeys.w=ai._fakeKeys.a=ai._fakeKeys.s=ai._fakeKeys.d=false;
    ai._fakeMDown=false;
    return;
  }

  const pBodyC = entityBodyCenter(P);
  const bBodyC = entityBodyCenter(bot);
  const angToPlayer = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
  const distToPlayer = Math.hypot(pBodyC.x - bBodyC.x, pBodyC.y - bBodyC.y);
  const cscl = sv('cscl');
  const moveLocked = GameTime < (bot._moveLockUntil || 0);
  const lockedFakeKeys = { w:false, a:false, s:false, d:false };
  
  // ════════════════════════════════════════════════════════════════════
  // 🔥 ПРОВЕРКА: ИГРОК ЗАРЯЖАЕТ МАГИЧЕСКИЙ ПОСОХ?
  // ════════════════════════════════════════════════════════════════════
  const isChargingMagicStaff = P.hasWeapon !== false && 
                               weaponKeyOf(P) === 'magicstaff' && 
                               P._magicCharging === true;
  
  if(isChargingMagicStaff && bot === D){
    const chargeTime = GameTime - P._magicChargeStart;
    const progress = Math.min(1, chargeTime / MAGICSTAFF_CHARGE_FULLTIME);
    const currentRadius = MAGICSTAFF_RADIUS * (1 + progress * 0.5);
    const dangerZone = currentRadius * 1.3;
    const isInDangerZone = distToPlayer < dangerZone;
    
    // ── ПЕРВОЕ РЕШЕНИЕ В МОМЕНТ НАЧАЛА КАСТА ──
    if(!ai._magicDecisionMade){
      ai._magicDecisionMade = true;
      ai._magicDecisionTime = GameTime;
      
      if(isInDangerZone){
        if(Math.random() < 0.5){
          ai._magicFleeState = 'ignore';
          ai._magicFleeTimer = 0.5 + Math.random() * 1.0;
          if(Math.random() < 0.3){
            hitFX.push({x: bBodyC.x, y: bBodyC.y - 30, t: '😤 ИГНОР!', life: 25, big: false, col: '#ff8844'});
          }
        } else {
          ai._magicFleeState = 'flee';
          ai._magicFleeTimer = 1.0 + Math.random() * 2.0;
          if(Math.random() < 0.3){
            hitFX.push({x: bBodyC.x, y: bBodyC.y - 30, t: '😱 УБЕГАЮ!', life: 25, big: false, col: '#44aaff'});
          }
        }
      }
    }
    
    // ════════════════════════════════════════════════════════════════════
    // 🔥 ПЕРЕСМОТР РЕШЕНИЯ, ЕСЛИ ЗАРЯДКА ДЛИТСЯ > 2 СЕКУНД
    // ════════════════════════════════════════════════════════════════════
    const canReconsider = chargeTime > 2.0 && ai._magicFleeState === 'ignore';
    if(canReconsider && ai._magicReconsiderTimer === undefined){
      ai._magicReconsiderTimer = 0;
    }
    
    if(canReconsider){
      ai._magicReconsiderTimer -= dt;
      
      // Каждые 1-2 секунды пересматриваем решение
      if(ai._magicReconsiderTimer <= 0){
        // 🔥 ШАНС ПЕРЕСМОТРЕТЬ РЕШЕНИЕ
        if(isInDangerZone && Math.random() < 0.5){ // 30% шанс пересмотреть
          const oldState = ai._magicFleeState;
          
          // Меняем решение на противоположное
          if(ai._magicFleeState === 'ignore'){
            ai._magicFleeState = 'flee';
            ai._magicFleeTimer = 1.0 + Math.random() * 1.5;
            hitFX.push({x: bBodyC.x, y: bBodyC.y - 30, t: '🤔 ПЕРЕДУМАЛ!', life: 25, big: false, col: '#ffaa44'});
          } else if(ai._magicFleeState === 'flee'){
            // Если убегал - может перестать (но реже)
            if(Math.random() < 0.2){
              ai._magicFleeState = 'ignore';
              ai._magicFleeTimer = 0.5 + Math.random() * 0.5;
              hitFX.push({x: bBodyC.x, y: bBodyC.y - 30, t: '🤔 ХВАТИТ!', life: 25, big: false, col: '#88aaff'});
            }
          }
          
          // Сбрасываем таймер пересмотра
          ai._magicReconsiderTimer = 1.0 + Math.random() * 1.5;
        } else {
          // Не пересмотрели - проверим позже
          ai._magicReconsiderTimer = 1.0 + Math.random() * 1.0;
        }
      }
    } else {
      // Сбрасываем таймер пересмотра, если условие не выполняется
      ai._magicReconsiderTimer = undefined;
    }
    
    // ── ВЫПОЛНЕНИЕ РЕШЕНИЯ ──
    // Если бот решил убегать
    if(ai._magicFleeState === 'flee' && ai._magicFleeTimer > 0){
      ai._magicFleeTimer -= dt;
      
      const awayAngle = Math.atan2(bBodyC.y - pBodyC.y, bBodyC.x - pBodyC.x);
      const fleeDistance = dangerZone + 50;
      const targetX = pBodyC.x + Math.cos(awayAngle) * fleeDistance;
      const targetY = pBodyC.y + Math.sin(awayAngle) * fleeDistance;
      
      const dx = targetX - bBodyC.x;
      const dy = targetY - bBodyC.y;
      const d = Math.hypot(dx, dy) || 1;
      const ax = dx / d;
      const ay = dy / d;
      
      const fleeKeys = moveLocked ? lockedFakeKeys : ai._fakeKeys;
      fleeKeys.a = ax < -0.3;
      fleeKeys.d = ax > 0.3;
      fleeKeys.w = ay < -0.3;
      fleeKeys.s = ay > 0.3;
      
      const dpivX = bBodyC.x + bot.pvX;
      const dpivY = bBodyC.y + bot.pvY;
      const defAng = Math.atan2(pBodyC.y - dpivY, pBodyC.x - dpivX);
      bot.angle = angLerpDT(bot.angle, defAng, 0.15, dt);
      
      ai._fakeMDown = false;
      
      if(ai._magicFleeTimer <= 0){
        ai._magicFleeState = null;
        ai._magicReconsiderTimer = undefined;
      }
      
      return;
    }
    
    // Если игнорирует - просто тикает таймер
    if(ai._magicFleeState === 'ignore'){
      ai._magicFleeTimer -= dt;
      if(ai._magicFleeTimer <= 0){
        ai._magicFleeState = null;
        ai._magicReconsiderTimer = undefined;
      }
    }
  } else {
    // Когда каст закончился - сбрасываем всё состояние
    if(ai._magicDecisionMade){
      ai._magicDecisionMade = false;
      ai._magicFleeState = null;
      ai._magicFleeTimer = 0;
      ai._magicReconsiderTimer = undefined;
      ai._magicDecisionTime = 0;
    }
  }
  
  
  
  
  // 🔥 ПРОВЕРКА: у игрока лук или арбалет?
  const isPlayerRanged = isRangedWeapon(P) && P.hasWeapon !== false;
  // ── Бросок оружия по уставшему игроку ───────────────────────────────────
  // Условия: у бота одно из метательных видов оружия; игрок сейчас "устал"
  // (exhausted); дистанция больше 3 клеток, но меньше примерной дальности
  // броска этого оружия; глобальный таймер (30 сек на ВСЕХ ботов) не активен.
  // При выполнении условий раз в ~1-1.5 сек бросается кубик на 30%.
  if(bot.hasWeapon !== false && THROWABLE_MELEE_KEYS.includes(weaponKeyOf(bot)) &&
     isExhausted(P) && GameTime >= GLOBAL_THROW_COOLDOWN_UNTIL){
    bot._throwCheckCD = (bot._throwCheckCD||0) - dt;
    if(bot._throwCheckCD <= 0){
      bot._throwCheckCD = 1.0 + Math.random()*0.5;
      const throwRange = estimateThrowRange(weaponDefFor(bot));
      if(distToPlayer > 3*CELL_PX && distToPlayer < throwRange && Math.random() < 0.30){
        throwWeapon(bot);
        GLOBAL_THROW_COOLDOWN_UNTIL = GameTime + 30;
      }
    }
  }

  // ── БЕЗОРУЖНЫЙ БОТ: ищет упавшее оружие вместо боя ──────────────────────
  if(bot.hasWeapon === false){
    const k = moveLocked ? lockedFakeKeys : ai._fakeKeys;
    ai._fakeMDown = false;

    let nearest = null, nearestD = Infinity;
    for(const w of DROPPED_WEAPONS){
      const d = Math.hypot(w.x - bBodyC.x, w.y - bBodyC.y);
      if(d < nearestD){ nearestD = d; nearest = w; }
    }

    let tx, ty;
    if(nearest){
      ai._weaponSeekTimer = undefined; // оружие нашлось — сбрасываем таймер "нет оружия на карте"
      tx = nearest.x; ty = nearest.y;
    } else {
      // На карте нет вообще никакого оружия — ждём 3-5 сек и выдаём кинжал
      if(ai._weaponSeekTimer === undefined) ai._weaponSeekTimer = rf(3,5);
      ai._weaponSeekTimer -= dt;
      if(ai._weaponSeekTimer <= 0){
        setWeapon(bot, 1); // 1 = кинжал
        ai._weaponSeekTimer = undefined;
        k.w=k.a=k.s=k.d=false;
        return;
      }
      // Двигаемся в случайную точку, обходя игрока
      if(ai._wanderTarget === undefined || Math.hypot(ai._wanderTarget.x-bBodyC.x, ai._wanderTarget.y-bBodyC.y) < 30*cscl){
        const rndAng = Math.random()*Math.PI*2;
        ai._wanderTarget = { x: bBodyC.x + Math.cos(rndAng)*220*cscl, y: bBodyC.y + Math.sin(rndAng)*220*cscl };
      }
      tx = ai._wanderTarget.x; ty = ai._wanderTarget.y;
    }

    // Вектор к цели + отталкивание от игрока — чтобы обходить его стороной.
    // НО: если мы идём именно за конкретным оружием (nearest) и оно само лежит
    // в радиусе героя — обход отключаем, иначе отталкивание "от игрока" гасит
    // движение "к оружию" (они почти противоположны) и бот просто стоит на месте.
    let dx = tx - bBodyC.x, dy = ty - bBodyC.y;
    const weaponNearPlayer = nearest && Math.hypot(tx - pBodyC.x, ty - pBodyC.y) < 240 * cscl;
    if(distToPlayer < 240 * cscl && !weaponNearPlayer){
      const awayX = bBodyC.x - pBodyC.x, awayY = bBodyC.y - pBodyC.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      dx += (awayX / awayLen) * 180;
      dy += (awayY / awayLen) * 180;
    }
    const dlen = Math.hypot(dx, dy) || 1;
    const ax = dx / dlen, ay = dy / dlen;
    k.a = ax < -0.3; k.d = ax > 0.3;
    k.w = ay < -0.3; k.s = ay > 0.3;
    return;
  }
  const k = moveLocked ? lockedFakeKeys : ai._fakeKeys;

  // ── РЕЖИМ: ЗАЩИТА (не главный) ──────────────────
 // 👇 ЕСЛИ НЕ ГЛАВНЫЙ — ТОЛЬКО ЗАЩИТА, ВЫХОДИМ
 








// ── НЕ-ГЛАВНЫЙ — ЗАЩИТА С РОЛЯМИ ──────────────────
if(!ai._isMain){
  const role = ai._role || 'guard';
  let targetX, targetY;
  
// ── НЕ-ГЛАВНЫЙ — ЗАЩИТА С РОЛЯМИ ──────────────────
if(!ai._isMain){
  const role = ai._role || 'guard';
  let targetX, targetY;
  
  // ── ИНИЦИАЛИЗАЦИЯ ТАЙМЕРА РЕШЕНИЙ ──────────────
  if(ai._decisionTimer === undefined) ai._decisionTimer = 0;
  ai._decisionTimer -= dt;
  
  // ── РОЛЬ: ТРУС (80%) ─────────────────────────────
  if(role === 'coward'){
    const maxDist = 330 * cscl;
    const minDist = 200 * cscl;
    
    // Задержка реакции (дополнительно к основной)
    if(!ai._playerHistory) ai._playerHistory = [];
    ai._playerHistory.push({ x: pBodyC.x, y: pBodyC.y, time: GameTime });
    while(ai._playerHistory.length > 0 && GameTime - ai._playerHistory[0].time > 2.0){
      ai._playerHistory.shift();
    }
    if(!ai._reactionDelay){
      ai._reactionDelay = rf(0.5,1.5);
      ai._reactionChangeTimer = 0;
    }
    ai._reactionChangeTimer -= dt;
    if(ai._reactionChangeTimer <= 0){
      ai._reactionDelay = rf(0.5,1.5);
      ai._reactionChangeTimer = rf(3,5);
    }
    
    let targetPlayerX = pBodyC.x, targetPlayerY = pBodyC.y;
    const targetTime = GameTime - ai._reactionDelay;
    for(let i = ai._playerHistory.length - 1; i >= 0; i--){
      if(ai._playerHistory[i].time <= targetTime){
        targetPlayerX = ai._playerHistory[i].x;
        targetPlayerY = ai._playerHistory[i].y;
        break;
      }
    }
    
    // ── ПРИНЯТИЕ РЕШЕНИЯ (с задержкой) ──────────────
    if(ai._decisionTimer <= 0){
      ai._decisionTimer = rf(0.5,1.5);
      
      const distToPlayer = Math.hypot(targetPlayerX - bBodyC.x, targetPlayerY - bBodyC.y);
      const angToPlayer = Math.atan2(targetPlayerY - bBodyC.y, targetPlayerX - bBodyC.x);
      
      if(distToPlayer > maxDist * 1.1){
        ai._decisionX = targetPlayerX + Math.cos(angToPlayer) * maxDist * 0.9;
        ai._decisionY = targetPlayerY + Math.sin(angToPlayer) * maxDist * 0.9;
      } else if(distToPlayer < minDist * 1.2){
        const awayAng = angToPlayer + Math.PI;
        ai._decisionX = bBodyC.x + Math.cos(awayAng) * 100 * cscl;
        ai._decisionY = bBodyC.y + Math.sin(awayAng) * 100 * cscl;
      } else {
        const dir = ai._orbitDir || 1;
        const tangentAng = angToPlayer + Math.PI/2 * dir;
        const orbitR = maxDist * (0.9 + Math.sin(GameTime * 0.1) * 0.05);
        ai._decisionX = targetPlayerX + Math.cos(tangentAng) * orbitR;
        ai._decisionY = targetPlayerY + Math.sin(tangentAng) * orbitR;
        if(Math.random() < 0.005) ai._orbitDir = Math.random() < 0.5 ? 1 : -1;
      }
    }
    
    // ── ДВИЖЕНИЕ ──────────────────────────────────────
    const dx = ai._decisionX - bBodyC.x, dy = ai._decisionY - bBodyC.y;
    const d = Math.hypot(dx, dy) || 1;
    const deadZone = 15 * cscl;
    if(d > deadZone){
      const ax = dx/d, ay = dy/d;
      const cowardSpeedMult = 0.7;
      k.a = ax < -0.3 * cowardSpeedMult; 
      k.d = ax > 0.3 * cowardSpeedMult;
      k.w = ay < -0.3 * cowardSpeedMult; 
      k.s = ay > 0.3 * cowardSpeedMult;
    } else {
      k.w = k.a = k.s = k.d = false;
    }
    
    ai._fakeMDown = false;
    
    // ── МЕЧ ──────────────────────────────────────────
    if(ai._angleUpdateTimer === undefined) ai._angleUpdateTimer = 0;
    ai._angleUpdateTimer -= dt;
    if(ai._angleUpdateTimer <= 0){
      ai._angleUpdateTimer = rf(0.4,1.6);
      const dpivX = bBodyC.x + bot.pvX, dpivY = bBodyC.y + bot.pvY;
      const defAng = Math.atan2(targetPlayerY - dpivY, targetPlayerX - dpivX) + Math.PI/2 * (ai._orbitDir || 1);
      bot.angle = defAng;
    }
    
    bot.vel = decayDT(bot.vel, 0.95, dt);
    if(Math.abs(bot.vel) < 0.01) bot.vel = 0;
    
    return;
  }
  
  // ── РОЛЬ: GUARD (ОХРАННИК) ──────────────────────
  if(role === 'guard'){
    // ── ПРИНЯТИЕ РЕШЕНИЯ ──────────────────────────
    if(ai._decisionTimer <= 0){
      ai._decisionTimer = rf(0.5,1.0);
      
      if(D && D.hp > 0){
        const dBodyC = entityBodyCenter(D);
        // Держится между игроком и главным ботом
        const midX = (pBodyC.x + dBodyC.x) / 2;
        const midY = (pBodyC.y + dBodyC.y) / 2;
        const angToMid = Math.atan2(midY - bBodyC.y, midX - bBodyC.x);
        ai._decisionX = bBodyC.x + Math.cos(angToMid) * 200 * cscl;
        ai._decisionY = bBodyC.y + Math.sin(angToMid) * 200 * cscl;
      } else {
        // Если главный умер — просто кружим
        const ang = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
        const dir = ai._orbitDir || 1;
        ai._decisionX = pBodyC.x + Math.cos(ang + Math.PI/2 * dir) * 200 * cscl;
        ai._decisionY = pBodyC.y + Math.sin(ang + Math.PI/2 * dir) * 200 * cscl;
      }
    }
    
    // ── ДВИЖЕНИЕ ──────────────────────────────────────
    const dx = ai._decisionX - bBodyC.x, dy = ai._decisionY - bBodyC.y;
    const d = Math.hypot(dx, dy) || 1;
    const deadZone = 15 * cscl;
    if(d > deadZone){
      const ax = dx/d, ay = dy/d;
      k.a = ax < -0.3; k.d = ax > 0.3;
      k.w = ay < -0.3; k.s = ay > 0.3;
    } else {
      k.w = k.a = k.s = k.d = false;
    }
    
    ai._fakeMDown = false;
    bot.vel = decayDT(bot.vel, 0.95, dt);
    if(Math.abs(bot.vel) < 0.01) bot.vel = 0;
    
    return;
  }
  
  // ── РОЛЬ: HARASSER (ТРЕВОЖИТЕЛЬ) ────────────────
  if(role === 'harasser'){
    // ── ПРИНЯТИЕ РЕШЕНИЯ ──────────────────────────
    if(ai._decisionTimer <= 0){
      ai._decisionTimer = rf(0.3,0.6);
      
      const harassDist = 80 * cscl + Math.sin(GameTime * 0.5) * 30 * cscl;
      const harassAng = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x) 
                       + Math.PI/2 * Math.sin(GameTime * 0.3) * 0.5;
      ai._decisionX = pBodyC.x + Math.cos(harassAng) * harassDist;
      ai._decisionY = pBodyC.y + Math.sin(harassAng) * harassDist;
    }
    
    // ── ДВИЖЕНИЕ ──────────────────────────────────────
    const dx = ai._decisionX - bBodyC.x, dy = ai._decisionY - bBodyC.y;
    const d = Math.hypot(dx, dy) || 1;
    const deadZone = 10 * cscl;
    if(d > deadZone){
      const ax = dx/d, ay = dy/d;
      k.a = ax < -0.3; k.d = ax > 0.3;
      k.w = ay < -0.3; k.s = ay > 0.3;
    } else {
      k.w = k.a = k.s = k.d = false;
    }
    
    ai._fakeMDown = false;
    bot.vel = decayDT(bot.vel, 0.95, dt);
    if(Math.abs(bot.vel) < 0.01) bot.vel = 0;
    
    return;
  }
  
  // ── РОЛЬ: FLANKER (ФЛАНГОВЫЙ) ────────────────────
  if(role === 'flanker'){
    // ── ПРИНЯТИЕ РЕШЕНИЯ ──────────────────────────
    if(ai._decisionTimer <= 0){
      ai._decisionTimer = rf(0.8,1.2);
      
      const angToPlayer = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
      const flankOffset = Math.sin(GameTime * 0.1) * 200 * cscl;
      const flankAng = angToPlayer + Math.PI/2;
      const orbitDist = 430 * cscl + flankOffset;
      ai._decisionX = pBodyC.x + Math.cos(flankAng) * orbitDist;
      ai._decisionY = pBodyC.y + Math.sin(flankAng) * orbitDist;
    }
    
    // ── ДВИЖЕНИЕ ──────────────────────────────────────
    const dx = ai._decisionX - bBodyC.x, dy = ai._decisionY - bBodyC.y;
    const d = Math.hypot(dx, dy) || 1;
    const deadZone = 15 * cscl;
    if(d > deadZone){
      const ax = dx/d, ay = dy/d;
      k.a = ax < -0.3; k.d = ax > 0.3;
      k.w = ay < -0.3; k.s = ay > 0.3;
    } else {
      k.w = k.a = k.s = k.d = false;
    }
    
    ai._fakeMDown = false;
    bot.vel = decayDT(bot.vel, 0.95, dt);
    if(Math.abs(bot.vel) < 0.01) bot.vel = 0;
    
    return;
  }
  
  // ── РОЛЬ: DISTRACTOR (ОТВЛЕКАТЕЛЬ) ──────────────
  if(role === 'distractor'){
    // ── ПРИНЯТИЕ РЕШЕНИЯ ──────────────────────────
    if(ai._decisionTimer <= 0){
      ai._decisionTimer = rf(0.3,0.5);
      
      const angToPlayer = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
      const distAng = GameTime * 0.2 * (ai._orbitDir || 1);
      const distR = 430 * cscl + Math.sin(GameTime * 0.5) * 100 * cscl;
      ai._decisionX = pBodyC.x + Math.cos(distAng) * distR;
      ai._decisionY = pBodyC.y + Math.sin(distAng) * distR;
      
      // Иногда резкий рывок к игроку
      if(Math.random() < 0.02){
        ai._decisionX = pBodyC.x + Math.cos(angToPlayer) * 80 * cscl;
        ai._decisionY = pBodyC.y + Math.sin(angToPlayer) * 80 * cscl;
        hitFX.push({
          x: bBodyC.x, y: bBodyC.y - 20,
          t: '💨 РЫВОК!',
          life: 15, big: false, col: '#88ddff'
        });
      }
    }
    
    // ── ДВИЖЕНИЕ ──────────────────────────────────────
    const dx = ai._decisionX - bBodyC.x, dy = ai._decisionY - bBodyC.y;
    const d = Math.hypot(dx, dy) || 1;
    const deadZone = 10 * cscl;
    if(d > deadZone){
      const ax = dx/d, ay = dy/d;
      k.a = ax < -0.3; k.d = ax > 0.3;
      k.w = ay < -0.3; k.s = ay > 0.3;
    } else {
      k.w = k.a = k.s = k.d = false;
    }
    
    ai._fakeMDown = false;
    bot.vel = decayDT(bot.vel, 0.95, dt);
    if(Math.abs(bot.vel) < 0.01) bot.vel = 0;
    
    return;
  }
}

    // ── ОСТАЛЬНЫЕ РОЛИ ──────────────────────────────
    // ... (guard, harasser, flanker, distractor)
  }






  // ── РЕЖИМ: АТАКА (главный) ──────────────────────
  // Инициализация
  if(!ai._inited){
    ai._inited=true;
    ai.tactic = Math.random() < 0.5 ? 'COMBAT_RETREATING' : 'COMBAT_HARASS';
    if(ai.tactic==='COMBAT_HARASS') ai._harassTotalEnd = GameTime + rf(10,10);
    // aiSetPhase использует глобальный AI и D, поэтому подставляем
    ai.phase = 'attack';
    ai._phaseEnd = -1;
    ai._retreatMode = false;
    if(Math.random() < 0.5){
      bot.rageBuffEnd = GameTime + 4.0;
      bot.rage = 100;
      hitFX.push({x:entityBodyCenter(bot).x, y:entityBodyCenter(bot).y-40, t:'🔥', life:35, big:false, col:'#ff4020'});
    }
    const pBodyC2 = entityBodyCenter(P);
    const dBodyC2 = entityBodyCenter(bot);
    const dist2 = Math.hypot(pBodyC2.x-dBodyC2.x, pBodyC2.y-dBodyC2.y);
    if(dist2 > 150*cscl){
      // aiStartSpin с параметром bot
      if(!ai._spinActive && !cb('nospin') && ai.swordStyle !== 'SWORD_STYLE_DUELIST'){
        const dur = sv('spindur');
        const dBodyC3 = entityBodyCenter(bot);
        const dpivX3 = dBodyC3.x + bot.pvX, dpivY3 = dBodyC3.y + bot.pvY;
        const curAngToFakeM = Math.atan2(ai._fakeMY - dpivY3, ai._fakeMX - dpivX3);
        ai._spinActive = true;
        ai._spinAng = curAngToFakeM;
        ai._spinEndTime = GameTime + dur;
        ai._spinSpeed = (Math.PI*2) / dur;
      }
    }
  }
  
  // Авто-смена тактики каждые 10-20 сек
  if(ai._tacticTimer < 0) ai._tacticTimer = GameTime + rf(10,10);
  if(GameTime >= ai._tacticTimer && !ai._spinActive){
    ai._tacticTimer = GameTime + rf(10,10);
    if(ai.tactic === 'COMBAT_RETREATING') ai.tactic = 'COMBAT_HARASS';
    else { ai.tactic = 'COMBAT_RETREATING'; ai._harassPhase='approach'; }
    if(cb('alwaysmirror')){
      ai.swordStyle = 'SWORD_STYLE_MIRROR';
    } else {
      ai.swordStyle = pickSwordStyle();
    }
    ai._duelistBlocking = false;
  }
  if(ai.tactic==='COMBAT_HARASS' && ai._harassTotalEnd>0 && GameTime>=ai._harassTotalEnd){
    ai._harassTotalEnd = -1;
  }

  // Переход после контакта
if(ai._contactCD > 0 && ai.phase === 'attack' && ai._contactCD <= GameTime){
    ai._contactCD = -1;
    
    // 🔥 ПРОВЕРКА: у игрока лук или арбалет?
    const isPlayerRanged = isRangedWeapon(P) && P.hasWeapon !== false;
    
    // Если у игрока лук — чаще отступаем (50% вместо 25%)
    const retreatChance = isPlayerRanged ? 0.50 : 0.25;
    
    if(Math.random() < retreatChance){
      ai.phase = 'retreat';
      ai._retreatMode = true;
      ai._phaseEnd = GameTime + rf(5,4);
      ai._retreatMoveCD = -1;
      ai._circling = false;
      if(Math.random() < 0.5){
        if(!ai._spinActive && !cb('nospin') && ai.swordStyle !== 'SWORD_STYLE_DUELIST'){
          const dur = sv('spindur');
          const dBodyC4 = entityBodyCenter(bot);
          const dpivX4 = dBodyC4.x + bot.pvX, dpivY4 = dBodyC4.y + bot.pvY;
          const curAngToFakeM = Math.atan2(ai._fakeMY - dpivY4, ai._fakeMX - dpivX4);
          ai._spinActive = true;
          ai._spinAng = curAngToFakeM;
          ai._spinEndTime = GameTime + dur;
          ai._spinSpeed = (Math.PI*2) / dur;
        }
      }
    } else {
      ai.phase = 'breather';
      ai._retreatMode = false;
      ai._phaseEnd = GameTime + rf(1,2);
      ai._breatherBackEnd = GameTime + rf(0.2,0.3);
    }
  }

  if(ai._phaseEnd > 0 && GameTime >= ai._phaseEnd){
    ai.phase = 'attack';
    ai._phaseEnd = -1;
    ai._retreatMode = false;
    if(Math.random() < 0.5){
      bot.rageBuffEnd = GameTime + 4.0;
      bot.rage = 100;
      hitFX.push({x:entityBodyCenter(bot).x, y:entityBodyCenter(bot).y-40, t:'🔥', life:35, big:false, col:'#ff4020'});
    }
    const pBodyC4 = entityBodyCenter(P);
    const dBodyC4 = entityBodyCenter(bot);
    const dist4 = Math.hypot(pBodyC4.x-dBodyC4.x, pBodyC4.y-dBodyC4.y);
    if(dist4 > 150*cscl){
      if(!ai._spinActive && !cb('nospin') && ai.swordStyle !== 'SWORD_STYLE_DUELIST'){
        const dur = sv('spindur');
        const dBodyC5 = entityBodyCenter(bot);
        const dpivX5 = dBodyC5.x + bot.pvX, dpivY5 = dBodyC5.y + bot.pvY;
        const curAngToFakeM = Math.atan2(ai._fakeMY - dpivY5, ai._fakeMX - dpivX5);
        ai._spinActive = true;
        ai._spinAng = curAngToFakeM;
        ai._spinEndTime = GameTime + dur;
        ai._spinSpeed = (Math.PI*2) / dur;
      }
    }
  }

  // Roll exactly once when entering an attack phase. At 100% probing fully
  // replaces the attack, including approach, lunges and other attack tactics.
  if(ai.phase !== 'attack') ai._probingRollDone = false;
  const probingChance = sv('probingchance');
  const probingCooldownReady = probingChance >= 100 || GameTime - ai._probingLastEnd >= 20;
  if(ai.phase === 'attack' && !ai._probingActive && !ai._probingRollDone &&
     probingCooldownReady && bot.hasWeapon !== false &&
     PROBING_WEAPON_KEYS.includes(weaponKeyOf(bot))){
    ai._probingRollDone = true;
    if(Math.random() * 100 < probingChance){
      ai._probingActive = true;
      ai._probingPhase = 'approach';
      ai._probingEnd = -1;
      ai._probingRetreatStep = 0;
      ai._probingModeEnd = GameTime + rf(7, 8);
      ai._probingWeaponContact = false;
      ai._probingPauseBlockedUntil = -1;
      ai._spinActive = false;
      ai._lungeActive = false;
      ai._pokeDodgeActive = false;
      ai._feintActive = false;
      ai._fakeMDown = false;
    }
  }
  if(ai._probingActive){
    // Rage overrides probing unless the debug chance explicitly forces it.
    if(bot.rageBuffEnd > GameTime && sv('probingchance') < 100){
      ai._probingActive = false;
      ai._probingPhase = 'approach';
      ai._probingLastEnd = GameTime;
      ai._probingModeEnd = -1;
      ai._probingRetreatStep = 0;
      ai._probingWeaponContact = false;
      ai._retreatMode = false;
      ai._fakeMDown = false;
      ai.phase = 'attack';
      ai._phaseEnd = -1;
    }
  }
  if(ai._probingActive){
    ai._retreatMode = ai._probingPhase === 'retreat';
    aiUpdateProbing(ai, bot, k, bBodyC, pBodyC, distToPlayer, cscl);
    return;
  }

  // ── ЦЕП: доп. кручения вдвое чаще обычного ────────────
  // У остальных видов оружия "прокрут" запускается только при входе в фазу
  // атаки издалека / после контакта и т.п. — для цепа это редко и нерегулярно.
  // Цеп — оружие вращения по своей сути, поэтому у него отдельный периодический
  // таймер (в 2 раза чаще базового 10±10-секундного цикла смены тактики).
  if(weaponKeyOf(bot) === 'flail'){
    if(ai._flailSpinTimer === undefined) ai._flailSpinTimer = GameTime + rf(2.5,2.5);
    if(!ai._spinActive && !cb('nospin') && ai.swordStyle !== 'SWORD_STYLE_DUELIST'
       && GameTime >= ai._flailSpinTimer){
      ai._flailSpinTimer = GameTime + rf(2.5,2.5);
      const dur = sv('spindur');
      const dBodyCF = entityBodyCenter(bot);
      const dpivXF = dBodyCF.x + bot.pvX, dpivYF = dBodyCF.y + bot.pvY;
      const curAngToFakeM = Math.atan2(ai._fakeMY - dpivYF, ai._fakeMX - dpivXF);
      ai._spinActive = true;
      ai._spinAng = curAngToFakeM;
      ai._spinEndTime = GameTime + dur;
      ai._spinSpeed = (Math.PI*2) / dur;
    }
  }

  // ── ДОДЖ ВПЕРЁД С УКОЛОМ ──────────────────────
  if(ai._pokeDodgeTimer===undefined) ai._pokeDodgeTimer = GameTime + rf(5,15);
  if(!ai._pokeDodgeActive && GameTime >= ai._pokeDodgeTimer){
    ai._pokeDodgeTimer = GameTime + rf(5,15);
    // Реальная досягаемость текущего оружия бота — та же формула, что
    // используется для коллайдера удара (см. weaponTipPos/checkBladeVsBody).
    const _botReach = weaponReach(bot) * sv('swlen') * (isBot(bot) ? sv('botswordscale') : 1);
    // Додж вперёд подтягивает бота к игроку — нельзя допускать, чтобы
    // дистанция УЖЕ была меньше досягаемости оружия: в этом случае бот и так
    // может достать без доджа, а рывок вперёд утащит его сквозь/впритык к
    // цели вместо разумного сокращения дистанции для укола.
    const _canPokeDodge = ai.phase==='attack' && !ai._lungeActive && !ai._feintActive && !ai._spinActive
                        && bot.exhausted<=0 && bot.unbalanced<=0 && bot.stamina >= 30
                        && distToPlayer > Math.max(400, 55*cscl, _botReach)
                        && !(ai._botDodgeCooldown>0)
                        && weaponKeyOf(bot) !== 'flail'; // цепом боты не колют
    if(_canPokeDodge){
      ai._pokeDodgeActive = true;
      ai._pokeDodgeEnd = GameTime + 0.22;
      ai._botDodgeCooldown = 1.5;
      ai._dodgeLockUntil = GameTime + 0.3;
      bot._dvx = Math.cos(angToPlayer)*8;
      bot._dvy = Math.sin(angToPlayer)*8;
      bot._pokeStartTime = GameTime;
      if(typeof spawnDust==='function')
        for(let i=0;i<8;i++) spawnDust(bot.x,bot.y,-Math.cos(angToPlayer)*8,-Math.sin(angToPlayer)*8);
      hitFX.push({x:bot.x,y:bot.y-30,t:'DODGE',life:35,big:false,col:'rgba(200,200,200,0.6)'});
    }
  }
  if(ai._pokeDodgeActive){
    aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
    ai._fakeMDown = true;
    k.w=k.a=k.s=k.d=false;
    if(GameTime >= ai._pokeDodgeEnd){
      ai._pokeDodgeActive = false;
      ai._fakeMDown = false;
    }
    return;
  }

  // ── ВЫПАД ПОСЛЕ КОНТАКТА ──────────────────────────
  if(ai._lungeActive){
    if(GameTime >= ai._lungeEnd){
      if(ai._lungePhase === 'back'){
        ai._lungePhase = 'lunge';
        ai._lungeEnd = GameTime + 0.45;
        ai._fakeMDown = true;
      } else {
        ai._lungeActive = false;
        ai._fakeMDown = false;
      }
    }
    if(ai._lungeActive){
      const dir = ai._lungePhase === 'back' ? -1 : 1;
      const ax = Math.cos(angToPlayer)*dir, ay = Math.sin(angToPlayer)*dir;
      k.a = ax<-0.3; k.d = ax>0.3; k.w = ay<-0.3; k.s = ay>0.3;
      if(ai._lungePhase === 'lunge'){
        aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
        ai._fakeMDown = true;
      }
    }
  }

  // ── ЛОЖНЫЙ ШАГ ────────────────────────────────────
  if(ai._feintActive){
    if(GameTime >= ai._feintStepEnd){
      ai._feintStep++;
      if(ai._feintStep >= ai._feintPattern.length){
        ai._feintActive = false;
        ai._feintCD = GameTime + 2.5;
      } else {
        ai._feintStepEnd = GameTime + rf(0.14,0.07);
      }
    }
    if(ai._feintActive){
      const dir = ai._feintPattern[ai._feintStep];
      const angTP = Math.atan2(pBodyC.y-bBodyC.y, pBodyC.x-bBodyC.x);
      let moveAng;
      if(Math.abs(dir) === 1) moveAng = dir > 0 ? angTP : angTP + Math.PI;
      else moveAng = dir > 0 ? angTP + Math.PI/2 : angTP - Math.PI/2;
      const ax = Math.cos(moveAng), ay = Math.sin(moveAng);
      k.a = ax < -0.3; k.d = ax > 0.3;
      k.w = ay < -0.3; k.s = ay > 0.3;
    }
  }

  if(bot.exhausted > 0 || hasMod(bot, 'weaponRecoil')){
    k.w=k.a=k.s=k.d=false;
    ai._fakeMDown=false;
    aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
    return;
  }

  // ── COMBAT_HARASS ─────────────────────────────────
  if(ai.tactic === 'COMBAT_HARASS'){
    ai._retreatMode = false;
    const hp = ai._harassPhase;
    if(hp === 'approach'){
      if(!ai._feintActive) aiMoveToward(k, bBodyC, pBodyC, 65*cscl, cscl);
      if(!ai._spinActive) aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
      if(distToPlayer < 90*cscl){
        ai._harassPhase = 'strike';
        ai._harassStrikes = Math.floor(Math.random()*2) + 1;
        ai._harassTimer = GameTime + 0.6;
        ai._fakeMDown = true;
      }
    } else if(hp === 'strike'){
      k.w=k.a=k.s=k.d=false;
      aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
      ai._fakeMDown = true;
      if(GameTime >= ai._harassTimer){
        ai._harassStrikes--;
        if(ai._harassStrikes <= 0){
          ai._fakeMDown = false;
          ai._harassPhase = 'orbit';
          ai._harassOrbitDir = Math.random()<0.5 ? 1 : -1;
          ai._harassOrbitAng = angToPlayer + Math.PI;
          ai._harassTimer = GameTime + rf(0.8,0.6);
          if(!ai._spinActive && !cb('nospin') && ai.swordStyle !== 'SWORD_STYLE_DUELIST'){
            const dur = sv('spindur');
            const dBodyC6 = entityBodyCenter(bot);
            const dpivX6 = dBodyC6.x + bot.pvX, dpivY6 = dBodyC6.y + bot.pvY;
            const curAngToFakeM = Math.atan2(ai._fakeMY - dpivY6, ai._fakeMX - dpivX6);
            ai._spinActive = true;
            ai._spinAng = curAngToFakeM;
            ai._spinEndTime = GameTime + dur;
            ai._spinSpeed = (Math.PI*2) / dur;
          }
        } else {
          ai._harassTimer = GameTime + 0.5;
        }
      }
    } else if(hp === 'orbit'){
      ai._fakeMDown = false;
      ai._harassOrbitAng += ai._harassOrbitDir * 0.025;
      const orbitR = Math.max(60*cscl, distToPlayer);
      const tx = clamp(pBodyC.x + Math.cos(ai._harassOrbitAng)*orbitR, 60, W-100);
      const ty = clamp(pBodyC.y + Math.sin(ai._harassOrbitAng)*orbitR, 60, H-60);
      k.a=(tx-bBodyC.x)<-5; k.d=(tx-bBodyC.x)>5;
      k.w=(ty-bBodyC.y)<-5; k.s=(ty-bBodyC.y)>5;
      if(!ai._spinActive) aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
      if(GameTime >= ai._harassTimer) ai._harassPhase = 'approach';
    }
  } else
  // ── АТАКА ─────────────────────────────────────────
  if(ai.phase === 'attack'){
    ai._retreatMode = false;
if(!ai._feintActive){
  if(ai._duelPull){
    aiMoveToward(k, bBodyC, {x:ai._duelTargX, y:ai._duelTargY}, 30*cscl, cscl);
  } else {
    // 🔥 Если у игрока лук — бот подходит ближе только на 60% от обычного
    const attackDist = isPlayerRanged ? 50 * cscl : 80 * cscl;
    aiMoveToward(k, bBodyC, pBodyC, attackDist, cscl);
  }
}
    if(!ai._spinActive){
      ai._posTimer -= dt;
      if(ai._posTimer <= 0){
        ai._posIdx = (ai._posIdx+1)%3;
        ai._posTimer = rf(0.8,0.8);
      }
      const offsets = [0, sv('aiang')*Math.PI/180, -sv('aiang')*Math.PI/180];
      const aimAng = angToPlayer + offsets[ai._posIdx];
      aiPointMouse(bBodyC, bBodyC.x + Math.cos(aimAng)*150*cscl, bBodyC.y + Math.sin(aimAng)*150*cscl);
    }
    ai._fakeMDown = false;

  // ── ОТСТУПЛЕНИЕ ──────────────────────────────────
  } else if(ai.phase === 'retreat'){
    ai._retreatMode = true;
    if(GameTime >= ai._retreatMoveCD){
      if(Math.random() * 100 < sv('circchance')){
        ai._circling = true;
        ai._circleDir = Math.random() < 0.5 ? 1 : -1;
        ai._circleAng = angToPlayer + Math.PI;
        ai._retreatMoveCD = GameTime + rf(1.5,1.5);
      } else {
        ai._circling = false;
        const pt = aiRetreatPoint();
        ai._retreatTargX = clamp(pt.x, 60, W-100);
        ai._retreatTargY = clamp(pt.y, 60, H-60);
        ai._retreatMoveCD = GameTime + rf(1,2);
      }
    }

    if(ai._circling){
      const orbitDist = distToPlayer;
      ai._circleAng += ai._circleDir * 0.018;
      const targX = clamp(pBodyC.x + Math.cos(ai._circleAng) * orbitDist, 60, W-100);
      const targY = clamp(pBodyC.y + Math.sin(ai._circleAng) * orbitDist, 60, H-60);
      k.a = (targX - bBodyC.x) < -5; k.d = (targX - bBodyC.x) > 5;
      k.w = (targY - bBodyC.y) < -5; k.s = (targY - bBodyC.y) > 5;
    } else {
      const retreatTarg = {x: ai._retreatTargX, y: ai._retreatTargY};
      const distToRetTarg = Math.hypot(bBodyC.x-ai._retreatTargX, bBodyC.y-ai._retreatTargY);
      aiMoveToward(k, bBodyC, retreatTarg, 30*cscl, cscl);
      if(distToRetTarg < 40*cscl && !ai._feintActive && GameTime > ai._feintCD){
        ai._feintPattern = pick(FEINT_STEP_PATTERNS);
        ai._feintStep = 0;
        ai._feintStepEnd = GameTime + rf(0.14,0.07);
        ai._feintActive = true;
      }
    }
    if(!ai._spinActive){
      ai._posTimer -= dt;
      if(ai._posTimer <= 0){
        ai._posIdx = (ai._posIdx+1)%3;
        ai._posTimer = rf(1.0,0.6);
      }
      const offs2 = [0, sv('aiang')*Math.PI/180, -sv('aiang')*Math.PI/180];
      const blockAng = angToPlayer + offs2[ai._posIdx];
      aiPointMouse(bBodyC, bBodyC.x + Math.cos(blockAng)*120*cscl, bBodyC.y + Math.sin(blockAng)*120*cscl);
    }
    ai._fakeMDown = false;

  // ── ПЕРЕДЫШКА ────────────────────────────────────
  } else if(ai.phase === 'breather'){
    ai._retreatMode = false;
    if(GameTime < ai._breatherBackEnd){
      aiMoveAway(k, bBodyC, pBodyC, 999*cscl, cscl);
      ai._breatherArrived = false;
      ai._breatherEndAfterArrival = -1;
    } else {
      if(!ai._breatherArrived){
        ai._breatherArrived = true;
        ai._breatherEndAfterArrival = GameTime + rf(0.3,0.7);
      }
      if(ai._breatherEndAfterArrival > 0 && GameTime >= ai._breatherEndAfterArrival){
        ai.phase = 'attack';
        ai._phaseEnd = -1;
        ai._retreatMode = false;
        if(Math.random() < 0.5){
          bot.rageBuffEnd = GameTime + 4.0;
          bot.rage = 100;
          hitFX.push({x:entityBodyCenter(bot).x, y:entityBodyCenter(bot).y-40, t:'🔥', life:35, big:false, col:'#ff4020'});
        }
        const pBodyC5 = entityBodyCenter(P);
        const dBodyC5 = entityBodyCenter(bot);
        const dist5 = Math.hypot(pBodyC5.x-dBodyC5.x, pBodyC5.y-dBodyC5.y);
        if(dist5 > 150*cscl){
          if(!ai._spinActive && !cb('nospin') && ai.swordStyle !== 'SWORD_STYLE_DUELIST'){
            const dur = sv('spindur');
            const dBodyC7 = entityBodyCenter(bot);
            const dpivX7 = dBodyC7.x + bot.pvX, dpivY7 = dBodyC7.y + bot.pvY;
            const curAngToFakeM = Math.atan2(ai._fakeMY - dpivY7, ai._fakeMX - dpivX7);
            ai._spinActive = true;
            ai._spinAng = curAngToFakeM;
            ai._spinEndTime = GameTime + dur;
            ai._spinSpeed = (Math.PI*2) / dur;
          }
        }
        return;
      }
      if(!ai._feintActive && GameTime > ai._feintCD){
        ai._feintPattern = pick(FEINT_STEP_PATTERNS);
        ai._feintStep = 0;
        ai._feintStepEnd = GameTime + rf(0.14,0.07);
        ai._feintActive = true;
      }
      if(!ai._feintActive) k.w=k.a=k.s=k.d=false;
    }
    aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
    ai._fakeMDown = false;
  }

  // ── SWORD_STYLE_DUELIST / MIRROR ──────────────────
  if(!ai._mirrorCooldown) ai._mirrorCooldown = -1;
  if(!ai._mirrorBuf) { ai._mirrorBuf = []; ai._mirrorLag = rf(0.5,0.5); }
  ai._mirrorBuf.push({t: RealTime, angle: P.angle, vel: P.vel});
  const lagTarget = ai._mirrorLag;
  while(ai._mirrorBuf.length > 1 && RealTime - ai._mirrorBuf[0].t > lagTarget + 0.1)
    ai._mirrorBuf.shift();

  if(ai.swordStyle === 'SWORD_STYLE_MIRROR' && !ai._spinActive
     && (ai._mirrorCooldown < 0 || GameTime > ai._mirrorCooldown)){
    const angToP = Math.atan2(pBodyC.y - bBodyC.y, pBodyC.x - bBodyC.x);
    let laggedAngle = P.angle, laggedVel = P.vel;
    for(const entry of ai._mirrorBuf){
      if(RealTime - entry.t >= lagTarget){ laggedAngle = entry.angle; laggedVel = entry.vel; }
      else break;
    }
    const pSwordReach = weaponReach(P) * sv('swlen');
    const pPiv = entityPivot(P);
    const dPiv = entityPivot(bot);
    const pivDist = Math.hypot(pPiv.x - dPiv.x, pPiv.y - dPiv.y);
    const inStrikeRange = pivDist < pSwordReach * 1.2;
    let targetAng;
    if(inStrikeRange){
      const blockAng = laggedAngle + Math.PI/2 + (laggedVel > 0 ? -0.3 : 0.3);
      targetAng = blockAng;
    } else {
      const playerRelAng = angDiff(laggedAngle, angToP);
      const MAX_MIRROR = Math.PI / 4;
      const clampedRel = clamp(playerRelAng, -MAX_MIRROR, MAX_MIRROR);
      targetAng = angToP - clampedRel;
    }
    const dpiv2 = entityPivot(bot);
    const mirrorDist = 140 * cscl;
    aiPointMouse(bBodyC,
      dpiv2.x + Math.cos(targetAng)*mirrorDist,
      dpiv2.y + Math.sin(targetAng)*mirrorDist);
    ai._duelistBlocking = false;
  }

  if(ai.swordStyle === 'SWORD_STYLE_DUELIST' && !ai._spinActive){
    const swReach = weaponReach(bot) * sv('swlen') * 1.3;
    if(distToPlayer < swReach){
      const pPivX = rootCenter().x + P.pvX;
      const pPivY = rootCenter().y + P.pvY;
      const pBladeX = Math.cos(P.angle), pBladeY = Math.sin(P.angle);
      const blockAng = P.angle + Math.PI/2 + (P.vel > 0 ? -0.3 : 0.3);
      const dpiv = entityPivot(bot);
      const bDist = 140 * cscl;
      aiPointMouse(bBodyC, dpiv.x + Math.cos(blockAng)*bDist, dpiv.y + Math.sin(blockAng)*bDist);
      ai._duelistBlocking = true;
    } else {
      aiPointMouse(bBodyC, pBodyC.x, pBodyC.y);
      ai._duelistBlocking = false;
    }
  }

  // ── ПРОКРУТ МЕЧА ──────────────────────────────────
  if(ai._spinActive){
    if(GameTime >= ai._spinEndTime){
      ai._spinActive = false;
      ai._mirrorCooldown = GameTime + 1.0;
      ai._smoothMX = pBodyC.x; ai._smoothMY = pBodyC.y;
      ai._fakeMX = pBodyC.x;   ai._fakeMY = pBodyC.y;
    } else {
      ai._spinAng -= ai._spinSpeed * dt;
      const spinR = 120 * cscl;
      const sx = bBodyC.x + Math.cos(ai._spinAng) * spinR;
      const sy = bBodyC.y + Math.sin(ai._spinAng) * spinR;
      ai._smoothMX = sx; ai._smoothMY = sy;
      ai._fakeMX = sx;   ai._fakeMY = sy;
    }
  }
}








// Ложный шаг: серия быстрых шагов вперёд/назад — бот остаётся примерно на месте
function aiStartFeint(){
  if(AI._feintActive) return;
  if(AI._feintCD > GameTime) return;
  // выбираем паттерн
  const pBodyC = entityBodyCenter(P);
  const dBodyC = entityBodyCenter(D);
  const ang = Math.atan2(pBodyC.y-dBodyC.y, pBodyC.x-dBodyC.x);
  // fwd = к игроку, bwd = от игрока
  const fwd = { ang: ang };
  const bwd = { ang: ang + Math.PI };
  const patterns = [
    [fwd, bwd],           // вперёд-назад
    [bwd, fwd],           // назад-вперёд
    [bwd, fwd, bwd],      // назад-вперёд-назад
  ];
  const pat = pick(patterns);
  const stepTime = 0.28; // каждый шаг ~0.28с, всего ~1с
  AI._feintSteps = pat.map(s => ({ ...s, dur: stepTime }));
  AI._feintIdx = 0;
  AI._feintActive = true;
  AI._feintStepEnd = GameTime + AI._feintSteps[0].dur;
  AI._feintCD = GameTime + 2.5; // следующий не раньше чем через 2.5с
}

function updateFeint(k, dt){
  if(!AI._feintActive) return false;
  if(AI._feintIdx >= AI._feintSteps.length){
    AI._feintActive = false;
    k.w=k.a=k.s=k.d=false;
    return false;
  }
  if(GameTime >= AI._feintStepEnd){
    AI._feintIdx++;
    if(AI._feintIdx >= AI._feintSteps.length){
      AI._feintActive = false;
      k.w=k.a=k.s=k.d=false;
      return false;
    }
    AI._feintStepEnd = GameTime + AI._feintSteps[AI._feintIdx].dur;
  }
  // двигаемся в направлении текущего шага
  const step = AI._feintSteps[AI._feintIdx];
  const ax = Math.cos(step.ang), ay = Math.sin(step.ang);
  k.a = ax < -0.4; k.d = ax > 0.4;
  k.w = ay < -0.4; k.s = ay > 0.4;
  return true; // перехватываем управление
}

// ── Диспетчер: подменяет updateAI(dt,bot) для ботов с дальнобойным оружием ──
function updateAIDispatch(dt, bot){
  if(!bot || bot.hp <= 0 || !dummyOn) return;
  bot._rangedMovementHandled = false; // сброс каждый кадр (см. ФИКС 2)

  if(!bot._aiState || !bot._aiState.enabled){ updateAI(dt, bot); return; }

  // Безоружный бот (выбили лук/арбалет/жезл/что угодно) — всегда через
  // updateAI(), у которой есть логика поиска и подбора упавшего оружия.
  // Специализированные ranged-контроллеры этого не умеют, и раньше бот
  // навсегда оставался без оружия после разоружения.
  if(bot.hasWeapon === false){
    updateAI(dt, bot);
    return;
  }

  const key = weaponKeyOf(bot);

  // A weapon switch must not leave the probing controller holding stale
  // mouse targets. Magic staff is intentionally not probing-compatible.
  if(bot._aiState._probingActive && !PROBING_WEAPON_KEYS.includes(key)){
    bot._aiState._probingActive = false;
    bot._aiState._probingPhase = 'approach';
    bot._aiState._fakeMDown = false;
    bot._aiState._probingLastEnd = GameTime;
    bot._aiState._smoothInited = false;
  }
  
  if(key === 'crossbow' || key === 'bow'){ 
    bot._rangedMovementHandled = true;
    updateCrossbowBotAI(dt, bot); 
    return; 
  }
  
  if(key === 'wand' || key === 'magicstaff'){ 
    // 🔥 ЕСЛИ updateWandBotAI ВОЗВРАЩАЕТ false - ВЫПОЛНЯЕТСЯ ОБЫЧНЫЙ AI
    const result = updateWandBotAI(dt, bot);
    if(result === false){
      // 🔥 БОТ ДЕРЕТСЯ В БЛИЖНЕМ БОЮ КАК ОБЫЧНО
      updateAI(dt, bot);
    } else {
      bot._rangedMovementHandled = true;
    }
    return; 
  }
  
  updateAI(dt, bot);
}

// ──────────────── END LAYER: AI ────────────────

// ════════════════════════════════════════════════════════════════════════════
