// === src/systems/sprites.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: SPRITES — спрайты персонажа/оружия/щитов, загрузка ассетов
// Module file: sprites.js
// ════════════════════════════════════════════════════════════════════════════

// Фолбэк-пропорции (используется только пока картинка ещё не загрузилась —
// после загрузки ширина всегда берётся из РЕАЛЬНЫХ пропорций конкретного файла,
// чтобы оружие с другим соотношением сторон (топор/посох/копьё и т.д.) не искажалось).
const SWORD_SPRITE_ASPECT = 80 / 400; // width/height, дефолт до загрузки картинки

function spriteAspectFor(img){
  if(img && img.naturalWidth > 0 && img.naturalHeight > 0){
    return img.naturalWidth / img.naturalHeight;
  }
  return SWORD_SPRITE_ASPECT;
}

//#SETTING WeapoN
// ВСЕ спрайты оружия (меч, кинжал, топор, копьё, молот, посох) нарисованы
// ОДИНАКОВО: рукоять/хват — ВВЕРХУ файла, остриё/навершие — ВНИЗУ файла.
// Локально: pivot (0,0) = точка хвата в руке, +y = направление на цель (остриё).
const SWORD_HILT_OFFSET = 0.15; // доля длины — доп.сдвиг pivot вглубь рукояти (0 = без сдвига)

// Категории оружия, которые персонаж держит ЗА СЕРЕДИНУ (посох, копьё) —
// pivot ставится в центр спрайта (половина клинка/древка спереди, половина сзади),
// а не у самого торца рукояти, как у меча/кинжала/топора/молота.
const CENTER_GRIP_CATEGORIES = ['staff' ,'wand', 'magicstaff'];

// ── Толщина хитбокса оружия для столкновений КЛИНОК-КЛИНОК и КЛИНОК-ЩИТ ──
// (парирование/клэш/блок щитом). Небольшой технический зазор вокруг линии
// оружия — обычно трогать не нужно, реальный "размер коллайдера" правится
// через BLADEFIXSCALE ниже.
const BLADE_W = 7;

// ── BLADEFIXSCALE — скрытый ползунок 0..1 (можно и больше), уменьшающий/
// увеличивающий САМ КОЛЛАЙДЕР ОРУЖИЯ, как будто оружие физически короче или
// длиннее (а не толщину зазора вокруг линии — то не давало заметного эффекта).
// Применяется одинаково ко всем столкновениям оружия: клинок-клинок,
// клинок-щит и клинок-тело. Например 0.85 — коллайдер на 15% короче оригинала.
const BLADEFIXSCALE = 0.75;

// ── HANDRANGE — «мёртвая зона» у самой рукояти ──
// Относится ТОЛЬКО к столкновению клинок-клинок (парирование/клэш) и
// клинок-щит: часть оружия ближе HANDRANGE к руке (pivot) не участвует в
// этих столкновениях — иначе рукояти двух мечей задевали бы друг друга
// вплотную к рукам. Та же зона исключается из попаданий по телу.
const HANDRANGE = 10;

// Возвращает {back, front} — насколько далеко назад/вперёд от pivot (точки
// хвата в руке) простирается коллайдер оружия ВДОЛЬ его линии, в тех же
// единицах, что и weaponReach(), УЖЕ С УЧЁТОМ BLADEFIXSCALE. Для обычного
// хвата (меч/кинжал/топор/молот) коллайдер идёт только вперёд, как и раньше.
// Для оружия с центральным хватом (посох/копьё/жезл/магпосох) — спрайт
// нарисован и назад, и вперёд от pivot, поэтому и коллайдер должен покрывать
// ОБЕ стороны по всей длине спрайта.
function weaponColliderSpan(ent){
  const front = weaponReach(ent) * BLADEFIXSCALE; // уже full/2 для center-grip, full для остальных
  const key = weaponKeyOf(ent);
  if(key !== 'bow' && key !== 'crossbow' && CENTER_GRIP_CATEGORIES.includes(weaponDefFor(ent).category)){
    // center-grip: весь спрайт длиной full = front*2, pivot ровно в середине —
    // значит назад тоже front
    return { back: front, front: front };
  }
  return { back: 0, front: front };
}

// Базовый bounding box персонажа (логические единицы, до cscl):
// Целевая высота персонажа в логических единицах (до cscl).
// Ширина вычисляется из реальных пропорций PNG — без искажения аспекта.
const CHAR_SPRITE_H = 38;
const CHAR_SPRITE_OFFSET_Y = -23; // верх спрайта относительно bx,by

// ════════════════════════════════════════════════════════════════════════════
// MODULE: SPRITES  (PNG персонажа и оружия, тот же BuildMusicList.txt)
// Sprite logic is already isolated in this module; no global API is needed.
// ════════════════════════════════════════════════════════════════════════════
// ── Щиты ─────────────────────────────────────────────────────────────────────
// Исправленный SHIELD_TYPES
const SHIELD_TYPES = [
  null, // 0 — без щита
  
  // Обычные щиты
  { name:'Малый',    url:'Source/Weapon/Shield/T_Shield_01.png', weight:0.1, scale:0.5  },
  { name:'Большой',  url:'Source/Weapon/Shield/T_Shield_02.png', weight:0.3, scale:0.85 },
  { name:'Башенный', url:'Source/Weapon/Shield/T_Shield_03.png', weight:0.5, scale:1.1  },
  
  // 🔥 ШИПАСТЫЕ ЩИТЫ — каждый со своим спрайтом
  { name:'Шипастый (малый)', 
    url:'Source/Weapon/ShieldSpike/T_ShieldSpike_01.png',  // ← ОДИН файл
    weight:0.2, scale:0.6, spiked:true, spikeDmg:8 
  },
  { name:'Шипастый (средний)', 
    url:'Source/Weapon/ShieldSpike/T_ShieldSpike_02.png',  // ← ОДИН файл
    weight:0.4, scale:0.9, spiked:true, spikeDmg:12 
  },
  { name:'Шипастый (большой)', 
    url:'Source/Weapon/ShieldSpike/T_ShieldSpike_03.png',  // ← ОДИН файл
    weight:0.6, scale:1.2, spiked:true, spikeDmg:18 
  },
];

// Исправленная функция setShield
function setShield(ent, type){
  ent.shield = type;
  const def = SHIELD_TYPES[type];
  if(!def){ 
    ent._shieldImg = null; 
    ent._shieldUrl = null; 
    return; 
  }
  
  const base = (typeof PROJECT_PATH_AUDIO!=='undefined') ? PROJECT_PATH_AUDIO : '';
  const relUrl = def.url;  // ← всегда один URL, без массива
  
  if (!relUrl) {
    ent._shieldImg = null;
    ent._shieldUrl = null;
    return;
  }
  
  ent._shieldUrl = base + relUrl;
  ent._shieldImg = loadSpriteImage(ent._shieldUrl);
}

function setShield(ent, type){
  ent.shield = type;
  const def = SHIELD_TYPES[type];
  if(!def){ ent._shieldImg=null; ent._shieldUrl=null; return; }
  // Ассеты живут на GitHub — используем тот же префикс что и остальные спрайты
  const base = (typeof PROJECT_PATH_AUDIO!=='undefined') ? PROJECT_PATH_AUDIO : '';
  // def.urls (массив) — случайный вариант спрайта при экипировке (шипастый щит);
  // def.url (строка) — фиксированный спрайт, как у остальных щитов.
  const relUrl = def.urls ? pick(def.urls) : def.url;
  ent._shieldUrl = base + relUrl;
  ent._shieldImg = loadSpriteImage(ent._shieldUrl);
}

// ── Геттер параметров щита для сущности ─────────────────────────────────────
function shieldDef(ent){ return SHIELD_TYPES[ent.shield||0]||null; }

// Щит неактивен, пока натягивается лук / копится маг. посох или жезл —
// оружие держат двумя руками, щитом прикрыться нельзя.
function isShieldSuppressed(ent){
  if(!ent) return false;
  return !!(ent._bowCharging || ent._magicCharging || ent._wandCharging);
}

// Щит на той же стороне что меч (курсор) = флип активен
function shieldSameSideAsSword(ent){ return !!ent._shieldFlipped; }
// Эффективный масштаб меча: -40% размера, если щит держат в той же руке, что и меч
function effSwordScale(ent){
  const _shp = shieldDef(ent) && shieldSameSideAsSword(ent);
  return ent.swordScale * (_shp ? 0.85 : 1);
}
// Центр щита — с плавной сменой стороны
function drawShield(ent, cursorX){
  const def = shieldDef(ent);
  if(!def || !def.url) return;
  const img = ent._shieldImg;
  const imgReady = img && img.complete && img.naturalWidth > 0;

  const CHAR_H = CHAR_SPRITE_H * sv('cscl') * 1.2;
  const shH = CHAR_H * def.scale;
  const aspectRatio = (imgReady && img.naturalHeight>0) ? (img.naturalWidth/img.naturalHeight) : 0.75;
  const shW = shH * aspectRatio;
  ent._shieldW = shW; ent._shieldH = shH; ent._shieldType = ent.shield;

  const sc = shieldCenter(ent, cursorX); // ← теперь shieldCenter уже содержит коррекцию
  if(!sc) return;
  
  // Башенный (3) и большой (2) щиты — дополнительный offset от тела
  if(ent.shield===3) sc.x += sc.side * shW * 0.2;
  if(ent.shield===2) sc.x += sc.side * shW * 0.2;
  
  const _shExhMult = (ent.exhausted > 0 || ent.unbalanced > 0) ? 0.85 : 1.0;
  const _shExhOffY = (ent.exhausted > 0 || ent.unbalanced > 0) ? shH * 0.15 : 0;

  const _rawTilt = Math.sin(ent.angle) * (15*Math.PI/180);
  const _maxTilt = 15*Math.PI/180;
  const shieldAngle = clamp(_rawTilt, -_maxTilt, _maxTilt);

  const lmbActive = (ent===P) ? (mDown && !isRangedWeapon(ent) && weaponKeyOf(ent) !== 'flail')
    : (typeof AI!=='undefined' && AI._fakeMDown && !isRangedWeapon(ent) && weaponKeyOf(ent) !== 'flail');
  const _shDisabled = (ent.exhausted > 0) || (ent.unbalanced > 0);
  ent._shieldAlpha = lmbActive ? 0.25 : (_shDisabled ? 0.3 : 1.0);

  const _shWf = shW * _shExhMult;
  const _shHf = shH * _shExhMult;
  ctx.save();
  ctx.globalAlpha = ent._shieldAlpha;
  ctx.translate(sc.x, sc.y + _shExhOffY);
  ctx.rotate(shieldAngle);
  if(imgReady){
    ctx.drawImage(img, -_shWf/2, -_shHf/2, _shWf, _shHf);
  } else {
    ctx.fillStyle = 'rgba(100,180,255,0.5)';
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 2;
    ctx.fillRect(-_shWf/2, -_shHf/2, _shWf, _shHf);
    ctx.strokeRect(-_shWf/2, -_shHf/2, _shWf, _shHf);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ════════════════════════════════════════════════════════════════════════════
const SPRITE_FOLDERS = {
    knight:     'Source/Character/Knight/',
    sword:      'Source/Weapon/Sword/',
    knife:      'Source/Weapon/Knife/',
    spear:      'Source/Weapon/Spear/',
    halberd:    'Source/Weapon/Halberd/', 
    axe:        'Source/Weapon/Axe/',
    hammer:     'Source/Weapon/Hammer/',
    staff:      'Source/Weapon/Staff/',
    magicstaff: 'Source/Weapon/Magicstaff/',
    arrow:      'Source/Weapon/Arrow/',
    bow:        'Source/Weapon/Bow/',
    crossbow:   'Source/Weapon/Crossbow/',
    flail_ring: 'Source/Weapon/Flail/Ring/',   // ← кольца
    flail_tip:  'Source/Weapon/Flail/Tip/',   
    wand:       'Source/Weapon/Wand/',
    rapier:     'Source/Weapon/Rapier/',     
    shield:     'Source/Weapon/Shield/',      
    shieldspike: 'Source/Weapon/ShieldSpike/', 
    background: 'Source/Background/',
  
  
  
  
  
  
  
};

// Runtime: { knight: ["url1","url2",...], sword: [...] }
let SPRITE_LISTS = {};
// Кэш загруженных Image объектов: url -> Image
const SPRITE_IMG_CACHE = {};
let spritesDBReady = false;

function showSpriteErrorToast(url){
  const fname = url.split('/').pop();
  const toast = document.createElement('div');
  toast.textContent = `⚠ Файл не найден: ${fname}`;
  toast.style.cssText = 'position:fixed;top:14px;right:14px;z-index:5000;'
    + 'background:rgba(60,10,10,0.95);color:#ff8080;border:1px solid #aa3030;'
    + 'border-radius:6px;padding:10px 16px;font-family:monospace;font-size:12px;'
    + 'box-shadow:0 4px 12px rgba(0,0,0,0.5);max-width:320px;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function loadSpriteImage(url){
  // ✅ Если уже есть в кэше - возвращаем готовый Image
  if(SPRITE_IMG_CACHE[url]) {
    return SPRITE_IMG_CACHE[url];
  }
  
  const img = new Image();
  
  img.addEventListener('error', () => {
    if(!img._retried){
      img._retried = true;
      setTimeout(() => {
        img.src = url + (url.includes('?') ? '&' : '?') + 'retry=' + Date.now();
      }, 1000);
    } else {
      console.warn('⚠ Файл не загружен (404 после повтора):', url);
      showSpriteErrorToast(url);
    }
  });
  
  img.src = url;
  SPRITE_IMG_CACHE[url] = img;
  return img;
}

// Возвращает случайный URL из категории (или null если список пуст)
function pickRandomSprite(category){
  const arr = SPRITE_LISTS[category];
  if(!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Назначает случайный скин персонажа и оружие entity (вызывать при спавне/респавне)
function assignRandomSkin(ent){
  const knightUrl = pickRandomSprite('knight');
  ent._skinUrl   = knightUrl;
  ent._skinImg   = knightUrl ? loadSpriteImage(knightUrl) : null;
  setWeapon(ent, ent.weaponType || 0); // по умолчанию — меч (0)
}

// ──────────────── END LAYER: SPRITES ────────────────
// ════════════════════════════════════════════════════════════════════════════
// MODULE: BOT SHARED HELPERS  (общая логика для всех ботов)
// ════════════════════════════════════════════════════════════════════════════

// Использует те же правила восстановления, что и игрок.
function botRegenStamina(bot, dt){
  regenStamina(bot, dt, !!bot._fakeMDown);
}

// Обновляет усталость и дисбаланс
function botUpdateExhaustion(bot, dt){
  updateBuffs(bot, dt);
}

// Обновляет додж-импульс
function botUpdateDodge(bot, dt){
  if(bot._dvx || bot._dvy){
    const step = decayingImpulseStep(dt);
    bot.x = clamp(bot.x + bot._dvx * step, 40, W-80);
    bot.y = clamp(bot.y + bot._dvy * step, 40, H-40);
    const decay = Math.pow(0.01, dt);
    bot._dvx *= decay;
    bot._dvy *= decay;
    if(Math.hypot(bot._dvx, bot._dvy) < 0.1){
      bot._dvx = 0;
      bot._dvy = 0;
    }
  }
}

// Спавнит пыль под ногами при движении
function botSpawnDust(bot, dt){
  const dustSpd = typeof NET_SYNC!=='undefined' && NET_SYNC.active ? 8 : 0.5;
  if(Math.hypot(bot.vx, bot.vy) > dustSpd){
    bot._dustCD = (bot._dustCD||0) - dt;
    if(bot._dustCD <= 0){
      bot._dustCD = rf(0.08, 0.06);
      const feetY = bot.y + bot.by + 7;
      spawnDust(bot.x + 5 + bot.bx, feetY, bot.vx, bot.vy);
    }
  }
}

// Комбинирует все общие функции для бота
function updateBotState(bot, dt){
  botRegenStamina(bot, dt);
  botUpdateExhaustion(bot, dt);
  botUpdateDodge(bot, dt);
  botSpawnDust(bot, dt);
}

// Возвращает модификаторы щита для любого существа
function calcShieldModifiers(entity){
  const def = shieldDef(entity);
  const weight = def ? def.weight : 0;
  const wrongSide = def && shieldSameSideAsSword(entity);
  const baseMult = def ? (1 - 0.15 - weight * 0.1) : 1.0;
  const wrongMult = wrongSide ? 0.8 : 1.0;
  return { baseMult, wrongMult, weight, wrongSide };
}

// Рассчитывает все множители скорости
function calcSpeedMultipliers(entity, isPlayer){
const exhMult = getMod(entity, 'moveSlow', 1);
const unbMult = 1; // disbalance no longer blanket-slows movement; it only hits the
  const speedMult = exhMult * unbMult;
  const blockSlow = (entity._blockSlow||0) > GameTime ? sv('blockSlowMult') : 1;
  const shMods = calcShieldModifiers(entity);

  let maxV = 7 * speedMult * blockSlow * sv('globalspd') * shMods.baseMult * shMods.wrongMult * weaponMoveSpeedMult(entity);

  if(!isPlayer){
    const botCount = ALL_BOTS.filter(b => b.hp > 0).length;
    const botSpeedMult = Math.max(0.5, 1 - (botCount - 1) * 0.08);
    maxV *= sv('botspd') * botSpeedMult;
  }

  return maxV;
}
// ════════════════════════════════════════════════════════════════════════════
