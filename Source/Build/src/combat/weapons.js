// === src/combat/weapons.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: WEAPONS — таблица оружия, подбор/бросок/урон/коллизии оружия
// Module file: weapons.js
// ════════════════════════════════════════════════════════════════════════════

// ── Оружие ───────────────────────────────────────────────────────────────
// Список видов оружия. Пока только меч и кинжал — расширяется добавлением
// новых элементов сюда (topор/копьё/посох/жезл/цеп/арбалет и т.д. позже).
// Это ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ (fallback) — если WeaponTalbe.txt успешно
// загрузится с сервера, он ПОЛНОСТЬЮ заменит этот массив (см. loadWeaponTable ниже).
const WEAPON_TYPES = [
  { key:'sword',    name:'Меч',         category:'sword', throwSpeed: 8, scale: 1.0,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0.24, spinMax: 0.48,
    weight: 1.0, staminaMult: 1.0, cutMult: 1.0, pierceMult: 1.0, collision: 'full', flags: '', lmbStaminaMult: 1.0 },
  // ── НОВОЕ: Рапира ── конфиг (хват/баланс/урон) временно 1-в-1 как у меча,
  // отличается только category → своя папка спрайтов (Source/Weapon/Claws/).
  // lmbStaminaMult 0.5 — укол ЛКМ у рапиры вдвое дешевле по стамине (25% вместо 50%).
  { key:'rapier',   name:'Рапира',      category:'rapier', throwSpeed: 8, scale: 1.0,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0.24, spinMax: 0.48,
    weight: 1.0, staminaMult: 1.0, cutMult: 1.0, pierceMult: 1.0, collision: 'full', flags: '', lmbStaminaMult: 0.5 },
  { key:'dagger',   name:'Кинжал',      category:'knife', throwSpeed: 8, scale: 0.4,
    dmgBase: 4, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0.24, spinMax: 0.48,
    weight: 0.4, staminaMult: 0.01, cutMult: 1.0, pierceMult: 2.0, collision: 'full', flags: '', lmbStaminaMult: 1.0 },
  { key:'spear',    name:'Копьё',       category:'spear', throwSpeed: 8, scale: 1.6,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0, spinMax: 0,
    weight: 1.0, staminaMult: 0.3, cutMult: 0.1, pierceMult: 1.5, collision: 'tip', flags: '', lmbStaminaMult: 1.0 },
{ key:'halberd',  name:'Алебарда',   category:'halberd', throwSpeed: 8, scale: 1.0,
  dmgBase: 4, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0, spinMax: 0,
  weight: 1.6, staminaMult: 1.6, cutMult: 1.2, pierceMult: 1.5, collision: 'tip', 
  flags: '', lmbStaminaMult: 1.0 },
  { key:'axe',      name:'Топор',       category:'axe', throwSpeed: 5, scale: 0.7,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0, spinMax: 0,
    weight: 1.2, staminaMult: 1.5, cutMult: 1.5, pierceMult: 0.5, collision: 'full', flags: '', lmbStaminaMult: 1.0 },
  { key:'longsword',name:'Длинный меч', category:'sword', throwSpeed: 5, scale: 1.0,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0, spinMax: 0,
    weight: 1.0, staminaMult: 0.5, cutMult: 1.1, pierceMult: 1.2, collision: 'full', flags: '', lmbStaminaMult: 1.0 },
  { key:'greatsword',name:'Огромный меч',category:'sword', throwSpeed: 2, scale: 1.6,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0, spinMax: 0,
    weight: 1.6, staminaMult: 2.0, cutMult: 1.2, pierceMult: 1.2, collision: 'full', flags: '', lmbStaminaMult: 1.0 },
  { key:'hammer',   name:'Молот',       category:'hammer', throwSpeed: 5, scale: 1.0,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0.24, spinMax: 0.48,
    weight: 1.2, staminaMult: 1.5, cutMult: 1.5, pierceMult: 0.1, collision: 'full', flags: 'disarm,knockback_hammer', lmbStaminaMult: 1.0 },
  { key:'staff',    name:'Посох',       category:'staff', throwSpeed: 7, scale: 1.8,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0.24, spinMax: 0.48,
    weight: 0.8, staminaMult: 0.3, cutMult: 0.5, pierceMult: 0.5, collision: 'full', flags: 'knockback_staff', lmbStaminaMult: 1.0 },
{ key:'magicstaff',  name:'Магический посох', category:'magicstaff', throwSpeed: 10.336, scale: 1.8,
  dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0.1, spinMax: 0.2,
  weight: 0.8, staminaMult: 1.5, cutMult: 0.5, pierceMult: 0.4, collision: 'full', 
  flags: 'ranged_magicstaff', chargeTime: 2.0, lmbStaminaMult: 1.0 },
	
	
  // Цеп: scale ниже — резервное значение, реальная длина в бою динамическая
  // (см. МОДУЛЬ ЦЕПА: flailScaleFor/updateFlailExtension).
  { key:'flail',    name:'Цеп',         category:'flail', throwSpeed: 8, scale: 0.7,
    dmgBase: 8, dmgPerSpeed: 6, maxDmgPercent: 0.20, spinMin: 0.24, spinMax: 0.24,
    weight: 1.2, staminaMult: 1.5, cutMult: 2, pierceMult: 0.1, collision: 'tip', flags: 'disarm,knockback', lmbStaminaMult: 1.0 },
  // ── Дальнобойное оружие (см. МОДУЛЬ ДАЛЬНЕГО БОЯ ниже) ──────────────────
  // throwSpeed/dmgBase/dmgPerSpeed здесь — ТОЛЬКО fallback на случай, если
  // это оружие выбьют/бросят обычным способом. Урон и скорость самого
  // магического/стрелкового выстрела считаются отдельно (WAND_*/CROSSBOW_*).
  { key:'wand',     name:'Жезл',        category:'wand', throwSpeed: 14, scale: 1.0,
    dmgBase: 10, dmgPerSpeed: 0, maxDmgPercent: 0.25, spinMin: 0.1, spinMax: 0.1,
    weight: 1.2, staminaMult: 1.5, cutMult: 0.4, pierceMult: 0.1, collision: 'full', flags: 'ranged_wand', chargeTime: 0.5, lmbStaminaMult: 1.0 },
{ key:'bow',      name:'Лук',         category:'bow', throwSpeed: 14, scale: 0.6,
  dmgBase: 2, dmgPerSpeed: 0, maxDmgPercent: 0.20, spinMin: 0, spinMax: 0,
  weight: 0.8, staminaMult: 0.2, cutMult: 0.01, pierceMult: 0.01, collision: 'none', 
  flags: 'ranged_bow', chargeTime: 1.0, lmbStaminaMult: 1.0 },
  { key:'crossbow', name:'Арбалет',     category:'crossbow', throwSpeed: 18, scale: 0.4,
    dmgBase: 5, dmgPerSpeed: 0, maxDmgPercent: 0.30, spinMin: 0, spinMax: 0,
    weight: 1.0, staminaMult: 0.1, cutMult: 0.01, pierceMult: 0.01, collision: 'none', flags: 'ranged_crossbow', lmbStaminaMult: 1.0 },
];

// ── Загрузка параметров оружия с сервера (WeaponTalbe.txt) ─────────────────
// Формат файла — по одной строке на вид оружия, поля через '|':
//   key|name|category|throwSpeed|scale|dmgBase|dmgPerSpeed|maxDmgPercent|spinMin|spinMax
//     |weight|staminaMult|cutMult|pierceMult|collision|flags|chargeTime|lmbStaminaMult
// chargeTime — время накопления заряда перед выстрелом, сек (используется
//   только жезлом; для остального оружия можно не указывать — не используется).
// lmbStaminaMult — множитель стоимости стамины ЛКМ-удара (сверху общего % из
//   настроек sl-lmbcost, по умолчанию 40%). 1.0 = обычная стоимость (40%),
//   0.5 = вдвое дешевле (20%, как у рапиры). Если не указано — 1.0.
// Строки, начинающиеся с '#', и пустые строки — игнорируются (комментарии).
// Если файл не найден/не грузится — остаёмся на встроенных значениях выше.
const WEAPON_TABLE_URL = PROJECT_PATH_AUDIO + "Source/Talbe/WeaponTalbe.txt";
async function loadWeaponTable(){
  try {
    // cache-bust: без этого браузер может годами отдавать старую закешированную
    // версию файла, и правки в таблице визуально "не будут действовать".
    const r = await fetchWithTimeout(WEAPON_TABLE_URL + '?v=' + Date.now());
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const parsed = [];
    for(const line of lines){
      const p = line.split('|').map(s => s.trim());
      if(p.length < 5) continue; // минимум key|name|category|throwSpeed|scale
      parsed.push({
        key: p[0], name: p[1], category: p[2],
        throwSpeed:    p[3]  !== undefined ? parseFloat(p[3])  : 16,
        scale:         p[4]  !== undefined ? parseFloat(p[4])  : 1.0,
        dmgBase:       p[5]  !== undefined ? parseFloat(p[5])  : 8,
        dmgPerSpeed:   p[6]  !== undefined ? parseFloat(p[6])  : 6,
        maxDmgPercent: p[7]  !== undefined ? parseFloat(p[7])  : 0.20,
        spinMin:       p[8]  !== undefined ? parseFloat(p[8])  : 0.24,
        spinMax:       p[9]  !== undefined ? parseFloat(p[9])  : 0.48,
        weight:        p[10] !== undefined ? parseFloat(p[10]) : 1.0,
        staminaMult:   p[11] !== undefined ? parseFloat(p[11]) : 1.0,
        cutMult:       p[12] !== undefined ? parseFloat(p[12]) : 1.0,
        pierceMult:    p[13] !== undefined ? parseFloat(p[13]) : 1.0,
        collision:     p[14] !== undefined && p[14] ? p[14] : 'full',
        flags:         p[15] !== undefined ? p[15] : '',
        chargeTime:    p[16] !== undefined && p[16] !== '' ? parseFloat(p[16]) : 0.5,
        lmbStaminaMult:p[17] !== undefined && p[17] !== '' ? parseFloat(p[17]) : 1.0,
      });
    }
    if(parsed.length){
      WEAPON_TYPES.length = 0;
      parsed.forEach(w => WEAPON_TYPES.push(w));
      console.log('✔ WeaponTalbe.txt загружен, видов оружия:', WEAPON_TYPES.length);
    } else {
      console.warn('⚠ WeaponTalbe.txt пуст или не распознан — используются встроенные параметры оружия');
    }
  } catch(e){
    console.warn('⚠ WeaponTalbe.txt недоступен, используются встроенные параметры оружия:', e.message);
  }
}
loadWeaponTable(); // запускаем загрузку в фоне, как и BuildList.txt для музыки/спрайтов

// ── Геттеры параметров вида оружия сущности ────────────────────────────────
function weaponDefFor(ent){
  return WEAPON_TYPES[ent.weaponType || 0] || WEAPON_TYPES[0];
}
function weaponWeight(ent){
  const d = weaponDefFor(ent);
  return (d && d.weight != null) ? d.weight : 1.0;
}
function weaponStaminaMult(ent){
  const d = weaponDefFor(ent);
  let m = (d && d.staminaMult != null) ? d.staminaMult : 1.0;
  // Скрытый бафф: боты с копьём/посохом тратят стамину медленнее.
  if(isBot(ent) && $.IS(ent, 'spear', 'staff')) m *= 0.8;
  return m;
}
function weaponCutMult(ent){
  const d = weaponDefFor(ent);
  return (d && d.cutMult != null) ? d.cutMult : 1.0;
}
function weaponPierceMult(ent){
  const d = weaponDefFor(ent);
  return (d && d.pierceMult != null) ? d.pierceMult : 1.0;
}

// Cutting weapons need a minimum blade swing to deal their full damage.
// The threshold mirrors 30% of the existing swing threshold setting.
function needsCutSwing(ent){
  return weaponCutMult(ent) > weaponPierceMult(ent);
}
function applyCutSwingPenalty(ent, damage){
  const minSwing = sv('swthresh') * 0.3;
  if(needsCutSwing(ent) && Math.abs(ent.vel || 0) < minSwing){
    return Math.max(1, Math.round(damage / 3));
  }
  return damage;
}
// Множитель стоимости стамины за ЛКМ-удар (поверх общего % из настроек sl-lmbcost).
// 1.0 = обычная стоимость (по умолчанию 40% из настроек), 0.5 = вдвое дешевле (20%).
function weaponLmbStaminaMult(ent){
  const d = weaponDefFor(ent);
  return (d && d.lmbStaminaMult != null) ? d.lmbStaminaMult : 1.0;
}
function weaponCollisionType(ent){
  const d = weaponDefFor(ent);
  return (d && d.collision) ? d.collision : 'full';
}
function weaponHasFlag(ent, flag){
  const d = weaponDefFor(ent);
  if(!d || !d.flags) return false;
  // ✅ Разбиваем строку по запятой и ищем точное совпадение
  return d.flags.split(',').map(s => s.trim()).includes(flag);
}
// Множитель скорости замаха/поворота оружия — тяжёлое оружие крутится медленнее
function weaponSwingSpeedMult(ent){
  if(ent.hasWeapon === false) return 1.0;
  return $.M.clamp(1 / weaponWeight(ent), 0.55, 1.35);
}
// Множитель скорости передвижения персонажа — тяжёлое оружие замедляет
function weaponMoveSpeedMult(ent){
  if(ent.hasWeapon === false) return 1.0;
  // 🔥 ДЛЯ ДАЛЬНОБОЙНОГО ОРУЖИЯ — ФИКСИРОВАННОЕ ЗАМЕДЛЕНИЕ 0.4
  // (лук/арбалет — нужно целиться натянутым луком, логично медленнее ходить)
 
  // 🔥 ЖЕЗЛ И МАГИЧЕСКИЙ ПОСОХ — ПОЛНАЯ СКОРОСТЬ (не должны замедлять, в
  // отличие от лука/арбалета — это ближе к обычному оружию по механике)
  if($.IS(ent, 'magicstaff', 'wand')){
    return 1.0;
  }else if(isRangedWeapon(ent)){
    return 0.4;  // 40% скорости (сильное замедление) — только лук/арбалет
  }
  
  const w = weaponWeight(ent);
  return $.M.clamp(1 - (w - 1) * 0.15, 0.7, 1.15);
}

function weaponLenFor(ent){
  const def = WEAPON_TYPES[ent.weaponType || 0] || WEAPON_TYPES[0];
  const scale = (def.key === 'flail') ? flailScaleFor(ent) : (def.scale != null ? def.scale : 1);
  return SWORD_LEN * scale;
}

// Реальная боевая длина оружия (для коллайдеров/дальности атаки) — учитывает
// И анимационный скейл (effSwordScale), И базовый скейл вида оружия (кинжал короче меча).
// ВАЖНО: раньше коллайдер везде считался как SWORD_LEN*effSwordScale(...), из-за чего
// кинжал (weaponLenFor даёт 0.55 от длины меча) дрался с досягаемостью полноразмерного меча.
function weaponReach(ent){
  if(ent.hasWeapon === false) return 0;
  
  const key = weaponKeyOf(ent);
  
  // 🔥 ДАЛЬНОБОЙНОЕ ОРУЖИЕ — МАЛЕНЬКИЕ КОЛЛАЙДЕРЫ
  if(key === 'bow')   return 5;   // лук — очень маленький
  if(key === 'crossbow') return 12; // арбалет — чуть больше
  
  // Обычное оружие
  const full = weaponLenFor(ent) * effSwordScale(ent);
  if(CENTER_GRIP_CATEGORIES.includes(weaponDefFor(ent).category)) return full / 2;
  return full;
}

// Брошенное/выбитое оружие, лежащее на карте: {x,y,vx,vy,weaponType,url,img}
let DROPPED_WEAPONS = [];

// Экипирует entity оружием типа typeIdx (случайный вариант из папки этого вида)
function setWeapon(ent, typeIdx) {
  // Drop controller state tied to the previous weapon. In particular, the
  // magic-staff controller writes the angle directly; keeping its state or an
  // old smoothed AI mouse target makes every later weapon twitch.
  if(ent._magicStaffAI){
    ent._magicStaffAI.state = 'idle';
    ent._magicStaffAI.fireHeld = false;
    ent._magicStaffAI.timeInState = 0;
  }
  if(ent._aiState){
    ent._aiState._probingActive = false;
    ent._aiState._probingPhase = 'approach';
    ent._aiState._fakeMDown = false;
    ent._aiState._smoothInited = false;
  }
  // 🔥 ОЧИЩАЕМ ЭФФЕКТЫ НАКОПЛЕНИЯ ПРИ СМЕНЕ ОРУЖИЯ
  // Жезл
  if (ent._wandCharging) {
    ent._wandCharging = false;
    if (ent._wandChargeSoundObj) {
      fadeOutSound(ent._wandChargeSoundObj, 0.2);
      ent._wandChargeSoundObj = null;
    }
  }
  
  // Магический посох
  if (ent._magicCharging) {
    ent._magicCharging = false;
    if (ent._magicChargeSoundObj) {
      fadeOutSound(ent._magicChargeSoundObj, 0.2);
      ent._magicChargeSoundObj = null;
    }
    clearMagicStaffFX(ent);
  }
  
  // Лук
  if (ent._bowCharging) {
    ent._bowCharging = false;
    if (ent._bowTensionSound) {
      fadeOutSound(ent._bowTensionSound, 0.2);
      ent._bowTensionSound = null;
    }
    clearBowTensionFX();
  }
  
  // Сбрасываем состояние магического посоха
  if (ent._magicStaffState) {
    ent._magicStaffState.isHeld = false;
    ent._magicStaffState.hasFired = false;
    ent._magicStaffState.rageConsumed = false;
    ent._magicStaffState.staminaConsumed = false;
    ent._magicStaffState._penaltyApplied = false;
    ent._magicStaffState._penaltyTimer = 0;
    ent._magicStaffState.rageDrainTimer = 0;
    ent._magicStaffState._releaseProcessed = false;
  }
  
  // Сбрасываем состояние цепа
  if (ent._flailState) {
    ent._flailState = 'FOLLOW';
    ent._flailExt = 0;
    ent._flailSpinSpeed = 0;
    ent._flailWasAtMax = false;
  }
  
  ent.weaponType = typeIdx;
  ent.hasWeapon = true;
  const def = WEAPON_TYPES[typeIdx] || WEAPON_TYPES[0];
  
  // 🔥 ИНИЦИАЛИЗИРУЕМ КЭШ ДЛЯ ЭТОЙ СУЩНОСТИ
  if (!ent._weaponCache) ent._weaponCache = {};
  const cacheKey = 'weapon_' + typeIdx;
  
  // ✅ ЕСЛИ УЖЕ ЕСТЬ СОХРАНЁННЫЙ URL - ИСПОЛЬЗУЕМ ЕГО (МГНОВЕННО)
  if (ent._weaponCache[cacheKey]) {
    ent._weaponUrl = ent._weaponCache[cacheKey];
    ent._weaponImg = loadSpriteImage(ent._weaponUrl);
    // Восстанавливаем кольца для цепа
    if (def.category === 'flail') {
      ent._flailRing1Url = ent._weaponCache[cacheKey + '_ring1'] || null;
      ent._flailRing1Img = ent._flailRing1Url ? loadSpriteImage(ent._flailRing1Url) : null;
      ent._flailRing2Url = ent._weaponCache[cacheKey + '_ring2'] || null;
      ent._flailRing2Img = ent._flailRing2Url ? loadSpriteImage(ent._flailRing2Url) : null;
    }
    return;
  }
  
  if (def.category === 'flail') {
    // ── НАВЕРШИЕ = КОНЧИК (из папки Flail/Tip/) ──
    const tipUrls = SPRITE_LISTS['flail_tip'] || [];
    const headUrl = tipUrls.length > 0 ? tipUrls[Math.floor(Math.random() * tipUrls.length)] : null;
    
    // ── КОЛЬЦА (из папки Flail/Ring/) ──
    const ringUrls = SPRITE_LISTS['flail_ring'] || [];
    let ring1Url = null, ring2Url = null;
    if (ringUrls.length === 1) {
      ring1Url = ringUrls[0];
      ring2Url = ringUrls[0];
    } else if (ringUrls.length >= 2) {
      const shuffled = [...ringUrls].sort(() => Math.random() - 0.5);
      ring1Url = shuffled[0];
      ring2Url = shuffled[1];
    }
    
    // ── ПРИМЕНЯЕМ (кончик = навершие) ──
    ent._weaponUrl = headUrl || ent._weaponUrl;
    ent._weaponImg = ent._weaponUrl ? loadSpriteImage(ent._weaponUrl) : null;
    ent._flailRing1Url = ring1Url || null;
    ent._flailRing1Img = ring1Url ? loadSpriteImage(ring1Url) : null;
    ent._flailRing2Url = ring2Url || ring1Url || null;
    ent._flailRing2Img = ent._flailRing2Url ? loadSpriteImage(ent._flailRing2Url) : null;
    ent._flailTipUrl = null;
    ent._flailTipImg = null;
    
    // ✅ СОХРАНЯЕМ URL ДЛЯ БЫСТРОЙ ПОДГРУЗКИ
    ent._weaponCache[cacheKey] = ent._weaponUrl;
    ent._weaponCache[cacheKey + '_ring1'] = ent._flailRing1Url;
    ent._weaponCache[cacheKey + '_ring2'] = ent._flailRing2Url;
    return;
  }
  
  // ── ОБЫЧНОЕ ОРУЖИЕ ──
  const url = pickRandomSprite(def.category);
  ent._weaponUrl = url || ent._weaponUrl;
  ent._weaponImg = ent._weaponUrl ? loadSpriteImage(ent._weaponUrl) : null;
  
  // ✅ СОХРАНЯЕМ URL ДЛЯ БЫСТРОЙ ПОДГРУЗКИ
  ent._weaponCache[cacheKey] = ent._weaponUrl;
}

// Реальная длина оружия в пикселях в момент, когда оно было в руке entity —
// используется, чтобы брошенное/выбитое оружие летело и лежало ТЕМ ЖЕ размером,
// каким оно было в руке (а не пересчитывалось заново из базового скейла вида оружия).
function currentWeaponPixelLen(ent){
  return weaponLenFor(ent) * effSwordScale(ent) * sv('swlen') * (isBot(ent) ? sv('botswordscale') : 1);
}

// ✅ Для цепа НЕЛЬЗЯ использовать currentWeaponPixelLen при выбивании/броске —
// он берёт ТЕКУЩУЮ (боевую, динамически раскрученную) длину цепи, которая в
// момент удара могла быть у FLAIL_MAX_SCALE (2.2, максимальный раскрут) —
// из-за этого выбитый/брошенный цеп иногда падал на карту огромным. На земле
// цеп всегда должен лежать сложенным, "в покое" (базовый scale вида оружия
// из таблицы, как у остального оружия), независимо от того, насколько он был
// раскручен в момент выбивания.
function droppedWeaponPixelLen(ent){
  const def = WEAPON_TYPES[ent.weaponType] || WEAPON_TYPES[0];
  if(def.key === 'flail'){
    const restScale = (def.scale != null ? def.scale : FLAIL_MIN_SCALE);
    return SWORD_LEN * restScale * effSwordScale(ent) * sv('swlen') * (isBot(ent) ? sv('botswordscale') : 1);
  }
  return currentWeaponPixelLen(ent);
}

// Разоружает entity: оружие падает на карту как подбираемый предмет
function disarmEntity(ent, kickVx, kickVy){
  if(ent.hasWeapon === false) return;
  const c = $.POS.body(ent);
  const defW = WEAPON_TYPES[ent.weaponType] || WEAPON_TYPES[0];
  
  // ✅ Увеличиваем силу выбивания
  const baseSpeed = 6 + Math.random() * 4; // 6-10 пикселей/кадр
  const angle = Math.atan2(kickVy || 0, kickVx || 0) + (Math.random() - 0.5) * 1.2;
  
  // Если kickVx/kickVy не переданы — летит в случайном направлении
  const finalVx = kickVx !== undefined ? kickVx : Math.cos(angle) * baseSpeed;
  const finalVy = kickVy !== undefined ? kickVy : Math.sin(angle) * baseSpeed - 2; // чуть вверх
  
  // ✅ Добавляем +90° к углу меча (как в throwWeapon)
  const dropAngle = ent.angle + Math.PI/2;
  
  DROPPED_WEAPONS.push({  
    x: c.x, y: c.y,
    vx: finalVx,
    vy: finalVy,
	rot: dropAngle,
    angVel: randSpin(defW, 0.8), // ← с вращением
    isThrow: false, // ← выбитое
    weaponType: ent.weaponType,
    url: ent._weaponUrl,
    img: ent._weaponImg,
    ring1Img: ent._flailRing1Img,
    ring2Img: ent._flailRing2Img,
    len: droppedWeaponPixelLen(ent),
    owner: ent,
    ownerImmuneUntil: GameTime + 0.4,
    _noPickupUntil: GameTime + 0.4,
    ownerPickupBlockUntil: GameTime + 1.4,
    rot: dropAngle,
    angVel: randSpin(defW, 0.8), // чуть быстрее вращение
  });
  ent.hasWeapon = false;
  ent._weaponImg = null;
  ent._weaponUrl = null;
}


function throwWeapon(ent){
  if(ent.hasWeapon === false) return;
  const c = $.POS.body(ent);
  const def = WEAPON_TYPES[ent.weaponType] || WEAPON_TYPES[0];
  const spd = (def.throwSpeed || 10)/2;
  
  let aimAngle;
  if(ent === P){
    const rc = $.POS.root();
    aimAngle = Math.atan2(mY - rc.y, mX - rc.x);
  } else if(ent._manualControl){
    // A local player throws where their weapon is aimed, not at P like an AI.
    aimAngle = ent.angle;
  } else {
    const pC = $.POS.body(P);
    const bC = $.POS.body(ent);
    aimAngle = Math.atan2(pC.y - bC.y, pC.x - bC.x);
  }
  
  const rotAngle = aimAngle + Math.PI/2;
  
  DROPPED_WEAPONS.push({
    x: c.x, y: c.y,
    vx: Math.cos(aimAngle) * spd,
    vy: Math.sin(aimAngle) * spd,
    weaponType: ent.weaponType,
    url: ent._weaponUrl,
    img: ent._weaponImg,

    ring1Img: ent._flailRing1Img,
    ring2Img: ent._flailRing2Img,
    len: droppedWeaponPixelLen(ent),
    owner: ent,
    ownerImmuneUntil: GameTime + 0.4,
    _noPickupUntil: GameTime + 0.4,
    rot: rotAngle,
    angVel: randSpin(def, 1),
  });
  
  ent.hasWeapon = false;
  ent._weaponImg = null;
  ent._weaponUrl = null;
  $.FX.hit({x:c.x, y:c.y-40, t:'🗡 БРОШЕН!', life:45, big:true, col:'#ffaa66'});
  $.S.play('throwSound');
}





// Ручной подбор (клавиша E/у) — берёт ближайшее оружие в радиусе, ЗАМЕНЯЯ текущее,
// если оно уже есть (старое падает на землю на месте подбирающего)
function tryManualPickup(ent){
  if(!ent || ent.hp <= 0) return;
  const c = $.POS.body(ent);
  const PICKUP_R = 100;
  let nearest = null, nearestD = Infinity, nearestIdx = -1;
  for(let i = 0; i < DROPPED_WEAPONS.length; i++){
    const w = DROPPED_WEAPONS[i];
    if(w.owner === ent && GameTime < (w.ownerPickupBlockUntil||0)) continue; // своё выбитое оружие пока не подбираем
    const d = Math.hypot(w.x - c.x, w.y - c.y);
    if(d < PICKUP_R && d < nearestD){ nearestD = d; nearest = w; nearestIdx = i; }
  }
  if(!nearest) return;
  if(ent.hasWeapon !== false) disarmEntity(ent); // текущее оружие роняем на замену
  setWeapon(ent, nearest.weaponType);
  if(nearest.url){ ent._weaponUrl = nearest.url; ent._weaponImg = nearest.img || loadSpriteImage(nearest.url); }
  DROPPED_WEAPONS.splice(nearestIdx, 1);
  if(ent._aiState) ent._aiState._weaponSeekTimer = undefined;
  $.FX.hit({x:c.x, y:c.y-40, t:'🗡 ПОДОБРАНО', life:45, big:false, col:'#88ffaa'});
  $.S.play('pickupSound');
}

// Случайная угловая скорость вращения, взятая из параметров вида оружия
// (spinMin/spinMax — из WeaponTalbe.txt или встроенных значений по умолчанию).
// mul — множитель силы (например, слабее для простого выбивания, чем для полноценного броска).
function randSpin(def, mul){
  const lo = (def && def.spinMin != null) ? def.spinMin : 0.24;
  const hi = (def && def.spinMax != null) ? def.spinMax : 0.48;
  const mag = (lo + Math.random() * (hi - lo)) * (mul != null ? mul : 1);
  return (Math.random() < 0.5 ? -1 : 1) * mag;
}

// Отражает скорость летящего оружия относительно нормали (nx,ny) — упругий отскок
function bounceWeapon(w, nx, ny, restitution){
  const vdotn = w.vx*nx + w.vy*ny;
  w.vx = (w.vx - 2*vdotn*nx) * restitution;
  w.vy = (w.vy - 2*vdotn*ny) * restitution;
  
  const wDef = WEAPON_TYPES[w.weaponType] || WEAPON_TYPES[0];
  
  console.log('💥 bounceWeapon вызван!', 'оружие:', wDef.key, 'isThrow:', w.isThrow);
  
  // 🔥 ДЛЯ КОПЬЯ — ВРАЩЕНИЕ
  if (wDef.key === 'spear' && !w.isThrow) {
    w.angVel = 0.1; // принудительно
    console.log('🔴 angVel установлен в 8.0');
  } else {
    w.angVel = randSpin(wDef, 1);
  }
}

// Обновление физики брошенного/лежащего оружия + подбор безоружными
function updateDroppedWeapons(dt){
  const step = $.M.step(dt);
  const PICKUP_R = 45;
  const BOUND_L = 40, BOUND_R = W - 80, BOUND_T = 40, BOUND_B = H - 40;

  for(let i = DROPPED_WEAPONS.length - 1; i >= 0; i--){
    const w = DROPPED_WEAPONS[i];
    if(w.rot === undefined) w.rot = Math.atan2(w.vy, w.vx);
    if(w.angVel === undefined) w.angVel = 0;
    w.x += w.vx*step; w.y += w.vy*step;

    // ── Отскок от границ арены ────────────────────────────────────────────
    const preSpd = Math.hypot(w.vx, w.vy);
    if(preSpd > 0.4){
      let bounced = false;
      if(w.x < BOUND_L){ w.x = BOUND_L; w.vx = Math.abs(w.vx) * 0.6; bounced = true; }
      else if(w.x > BOUND_R){ w.x = BOUND_R; w.vx = -Math.abs(w.vx) * 0.6; bounced = true; }
      if(w.y < BOUND_T){ w.y = BOUND_T; w.vy = Math.abs(w.vy) * 0.6; bounced = true; }
      else if(w.y > BOUND_B){ w.y = BOUND_B; w.vy = -Math.abs(w.vy) * 0.6; bounced = true; }
if(bounced){
  const wDefWall = WEAPON_TYPES[w.weaponType] || WEAPON_TYPES[0];
  
  bounceWeapon(w, 0, 1, 0.6); // или как у тебя вызвается
  
  // 🔥 ДЕБАГ ПОСЛЕ BOUNCE
  console.log('🔴 ПОСЛЕ ОТСКОКА ОТ СТЕНЫ: angVel =', w.angVel, 'isThrow =', w.isThrow);
  
  $.FX.hit({x:w.x, y:w.y-8, t:'✦', life:18, big:false, col:'#ccccff'});
  $.S.play('clash');
}
    }

    // ── Отскок от чужого клинка или щита ────────────────────────────────
    const flySpdPre = Math.hypot(w.vx, w.vy);
    let deflected = false;
    if(flySpdPre > 0.5){
      const candidatesDef = [P, ...ALL_BOTS];
      for(const ent of candidatesDef){
        if(!ent || ent.hp <= 0 || ent._awaitingReveal) continue;
        if(ent === w.owner && GameTime < (w.ownerImmuneUntil||0)) continue;
        let hitShield = false;

        // Клинок соперника
        if(ent.hasWeapon !== false){
          const piv = $.POS.pivot(ent);
          const reach = weaponReach(ent) * sv('swlen') * (isBot(ent)?sv('botswordscale'):1);
          const tipX = piv.x + Math.cos(ent.angle)*reach;
          const tipY = piv.y + Math.sin(ent.angle)*reach;
          const segDX = tipX-piv.x, segDY = tipY-piv.y;
          const segL2 = segDX*segDX+segDY*segDY || 1;
          const t = $.M.clamp(((w.x-piv.x)*segDX+(w.y-piv.y)*segDY)/segL2, 0, 1);
          const nearX = piv.x + t*segDX, nearY = piv.y + t*segDY;
          const dd = Math.hypot(w.x-nearX, w.y-nearY);
          if(dd < 14){
            let nx = w.x-nearX, ny = w.y-nearY;
            const nl = Math.hypot(nx,ny) || 1;
            nx/=nl; ny/=nl;
            w.x = nearX + nx*14; w.y = nearY + ny*14;
            bounceWeapon(w, nx, ny, 0.65);
            deflected = true;
          }
        }

        // Щит
        if(!deflected && shieldDef(ent) && !isShieldSuppressed(ent) && ent._shieldSide !== undefined){
          const shc = $.POS.body(ent);
          const shVertOff = Math.sin(ent.angle) * 14;
          const scx = shc.x + ent._shieldSide * 20 * 0.9;
          const scy = shc.y + shVertOff;
          const halfW = (ent._shieldW || 20) / 2, halfH = (ent._shieldH || 30) / 2;
          const dxs = w.x - scx, dys = w.y - scy;
          if(Math.abs(dxs) < halfW+12 && Math.abs(dys) < halfH+12){
            let nx = dxs, ny = dys;
            const nl = Math.hypot(nx,ny) || 1;
            nx/=nl; ny/=nl;
            w.x = scx + nx*(halfW+12); w.y = scy + ny*(halfH+12);
            bounceWeapon(w, nx, ny, 0.65);
            deflected = true;
            hitShield = true;
          }
        }

        if(deflected){
          // 🔥 ВРАЩЕНИЕ ПРИ ОТСКОКЕ ОТ МЕЧА/ЩИТА (уже в bounceWeapon)
          // но добавим на всякий случай
          if (w.weaponType === 'spear' && !w.isThrow) {
            w.angVel = randSpin(WEAPON_TYPES[w.weaponType] || WEAPON_TYPES[0], 2.5);
          }
          
          if(hitShield){
            applyShieldBlockFX(w.x, w.y, null, null, {waveAngle: Math.atan2(w.vy, w.vx)});
          } else {
            const strongHit = flySpdPre > 6;
            $.FX.hit({x:w.x, y:w.y-8, t:'✦', life:18, big:strongHit, col:'#ffdd88'});
            $.S.play(strongHit ? 'clashHard' : 'clash');
            if(typeof triggerHitstop === 'function') triggerHitstop(strongHit?3:2, strongHit?3:1.5);
            addRage(ent, clashRageGain());
          }
          break;
        }
      }
    }

    // Затухание скорости
    const velocityDecay = Math.pow(0.9887, step);
    w.vx *= velocityDecay; w.vy *= velocityDecay;
    if(Math.hypot(w.vx, w.vy) < 0.05){ w.vx = 0; w.vy = 0; }

    // ── Вращение ──
    w.rot += w.angVel * decayingTickStep(dt, 0.985);
    w.angVel *= Math.pow(0.985, step);
// 🔥 ДЕБАГ
if (w.weaponType === 'spear' && Math.abs(w.angVel) > 0.1) {
  console.log('🔄 ВРАЩЕНИЕ: angVel =', w.angVel, 'rot =', w.rot);
}
    if(Math.abs(w.angVel) < 0.004) w.angVel = 0;

    // ── Урон при попадании в кого-либо ──
    const flySpd = Math.hypot(w.vx, w.vy);
    if(!deflected && flySpd > 2.5 && !(GameTime < (w._noDamageUntil||0))){
      const candidates = [P, ...ALL_BOTS];
      for(const ent of candidates){
        if(!ent || ent.hp <= 0 || ent._awaitingReveal) continue;
        if(ent === w.owner && GameTime < (w.ownerImmuneUntil||0)) continue;
        const c = $.POS.body(ent);
        const hitR = 22 * (isBot(ent) ? sv('cscl')*sv('botscale') : sv('cscl'));
        const d = Math.hypot(c.x - w.x, c.y - w.y);
        if(d < hitR){
          const wDefHit = WEAPON_TYPES[w.weaponType] || WEAPON_TYPES[0];
          const dmgBase = wDefHit.dmgBase != null ? wDefHit.dmgBase : 8;
          const dmgPerSpeed = wDefHit.dmgPerSpeed != null ? wDefHit.dmgPerSpeed : 6;
          const maxDmgPct = wDefHit.maxDmgPercent != null ? wDefHit.maxDmgPercent : 0.20;
          let dmg = Math.round(flySpd * dmgPerSpeed + dmgBase);
          
          if (isBot(w.owner) && (wDefHit.key==='spear' || wDefHit.key==='staff')) dmg = Math.round(dmg * 1.5);
          const _defScale = (isBot(ent) ? sv('cscl') * sv('botscale') : sv('cscl')) || 1;
          dmg = Math.round(dmg / _defScale);
          dmg = Math.min(dmg, Math.max(1, Math.round(MAX_HP * maxDmgPct)));
          
          applyDamage(ent, dmg, w.owner, {
            isMagic: false,
            isExplosion: false,
            knockbackMult: 0.6,
            hitstopFrames: 3,
            shakePower: dmg > 15 ? 5 : 3,
            textColor: '#ff8844',
            textSuffix: '🗡',
            bloodCount: 6,
            playSound: false
          });
          
          const nx = d > 0.1 ? (c.x - w.x)/d : 0, ny = d > 0.1 ? (c.y - w.y)/d : -1;
          ent.vx += nx * 6; ent.vy += ny * 6;
          
          $.S.play(isHeavySwingWeaponType(w.weaponType) ? 'damageHammer' : 'damage');
          
          w.x = c.x - nx*hitR; w.y = c.y - ny*hitR;
          bounceWeapon(w, -nx, -ny, 0.6);
          
          w._noDamageUntil = GameTime + 0.5;
          w._noPickupUntil = GameTime + 0.5;
          break;
        }
      }
    }

    if((w._noPickupUntil||0) > GameTime) continue;

    // ── Подбор оружия ──
    const candidates = [P, ...ALL_BOTS];
    let picked = false;
    for(const ent of candidates){
      if(!ent || ent.hp <= 0 || ent.hasWeapon !== false || ent._awaitingReveal) continue;
      if(ent === w.owner && GameTime < (w.ownerPickupBlockUntil||0)) continue;
      const c = $.POS.body(ent);
      if(Math.hypot(c.x - w.x, c.y - w.y) < PICKUP_R){
        setWeapon(ent, w.weaponType);
        if(w.url){ ent._weaponUrl = w.url; ent._weaponImg = w.img || loadSpriteImage(w.url); }
        $.FX.hit({x:c.x, y:c.y-40, t:'🗡 ПОДОБРАНО', life:45, big:false, col:'#88ffaa'});
        $.S.play('pickupSound');
        if(ent._aiState){ ent._aiState._weaponSeekTimer = undefined; }
        DROPPED_WEAPONS.splice(i,1);
        picked = true;
        break;
      }
    }
    if(picked) continue;
  }
}
// Брошенный/выбитый цеп — как и в руке, состоит из навершия + колец, но
// упрощённо: ВСЕГДА ровно 3 звена, и они "провисают" в сторону, откуда
// летит оружие (имитация того, что цепь при броске отстаёт по инерции) —
// каждое следующее звено (ближе к навершию) смещено сильнее предыдущего.
const DROPPED_FLAIL_RING_COUNT = 3;
const DROPPED_FLAIL_LAG_STEP = 4; // px смещения на звено (в локальных координатах)
function drawDroppedFlail(w, rot){
  const headImg  = w.img;
  const ring1Img = w.ring1Img;
  const ring2Img = w.ring2Img || ring1Img;
  const L = w.len || (SWORD_LEN * 0.7);
  const headLen = FLAIL_HEAD_LEN;

  const chainLen = Math.max(0, L - headLen);
  const ringLen = Math.max(FLAIL_RING_LEN, chainLen / DROPPED_FLAIL_RING_COUNT);

  // ✅ Исправлено: lagFactor вычисляется из скорости
  const spd = Math.hypot(w.vx||0, w.vy||0);
  let lagFactor = 0;
  if(spd > 0.3){
    const originAngle = Math.atan2(-(w.vy||0), -(w.vx||0));
    const lagDirLocalX = Math.cos(originAngle - rot);
    // Нормализуем lagFactor от -1 до 1
    lagFactor = $.M.clamp(lagDirLocalX * Math.min(1, spd/5), -1, 1);
  }
  
  // Провисание цепи (как в drawFlailSprite)
  const normalizedLag = $.M.clamp(lagFactor, -1, 1);
  const lagAmount = normalizedLag * 3; // макс 3px смещения

  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(rot);

  const totalH = L + headLen * 0.15;
  let cursor = totalH/2;
  
  // Рисуем кольца
  for(let i = 0; i < DROPPED_FLAIL_RING_COUNT; i++){
    const ringImg = (i % 2 === 0) ? ring1Img : ring2Img;
    const t = (i + 1) / DROPPED_FLAIL_RING_COUNT;
    const ringLag = lagAmount * t * 0.5;
    
    if(ringImg && ringImg.complete && ringImg.naturalWidth > 0){
      const rw = ringLen * spriteAspectFor(ringImg);
      ctx.drawImage(ringImg, -rw/2 + ringLag, cursor, rw, -ringLen);
    }
    cursor -= ringLen;
  }
  
  // Рисуем навершие
  if(headImg && headImg.complete && headImg.naturalWidth > 0){
    const hw = FLAIL_HEAD_LEN * spriteAspectFor(headImg);
    const headLag = lagAmount * 0.8;
    const extraOffset = -ringLen * 0.1;
    ctx.drawImage(headImg, -hw/2 + headLag, cursor + extraOffset, hw, -FLAIL_HEAD_LEN);
  }
  
  ctx.restore();
}

function drawDroppedWeapons(){
  for(const w of DROPPED_WEAPONS){
    const img = w.img || (w.url ? loadSpriteImage(w.url) : null);
    if(!img || !img.complete || img.naturalWidth <= 0) continue;
    const wDef = WEAPON_TYPES[w.weaponType] || WEAPON_TYPES[0];
    const rot = w.rot !== undefined ? w.rot : 0;
    if(wDef.key === 'flail'){
      drawDroppedFlail(w, rot);
      continue;
    }
    const L = w.len || (SWORD_LEN * (wDef.scale != null ? wDef.scale : 1));
    const isCenterGrip = CENTER_GRIP_CATEGORIES.includes(wDef.category);
    const weaponKey = wDef.key; // ← ключ оружия
    
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(rot);
    
    const width = L * spriteAspectFor(img);
    
    // ✅ Для копья — центр смещён к острию
    if(weaponKey === 'spear'){
      const gripOffset = L * 0.4;
      const totalH = L + gripOffset;
      // 🔥 СМЕЩАЕМ ТАК, ЧТОБЫ ВРАЩЕНИЕ БЫЛО ВОКРУГ ЦЕНТРА
      const centerOffset = totalH / 2 - gripOffset;
      ctx.drawImage(img, -width/2, -centerOffset*2, width, totalH);
    }
    else if(isCenterGrip){
      ctx.drawImage(img, -width/2, -L/2, width, L);
    } else {
      const hiltShift = L * SWORD_HILT_OFFSET;
      const totalH = L + hiltShift;
      ctx.drawImage(img, -width/2, -totalH/2, width, totalH);
    }
    
    ctx.restore();
  }
}

// ════════════════ END MODULE: SPRITES (loader part below in loadAudioDB) ════

// ┌─ SOUND_BLOCK: папки для каждого типа звука ─────────────────────────────
// ════════════════════════════════════════════════════════════════════════
// МОДУЛЬ ДАЛЬНЕГО БОЯ: Жезл (магия) и Арбалет (стрелы)
// ────────────────────────────────────────────────────────────────────────
// Самостоятельный блок поверх существующей боевой системы:
//  • Для этих 2 видов оружия ЛКМ полностью заменяет и обычный замах/флик,
//    и бафф ярости — вместо этого ЛКМ стреляет (см. правки в update()).
//  • Новый класс "снаряд" (PROJECTILES) — в отличие от DROPPED_WEAPONS его
//    нельзя подобрать; при попадании/затухании он лопается и пропадает.
//  • ИИ: арбалет держит дистанцию и стреляет издалека (кайтинг), жезл
//    циклически переключается между обычным ближним боем и "режимом
//    дальнего боя"; если противник подходит вплотную — жезл прерывает
//    дальний режим и уходит в обычный ближний бой.
//  • ПРИМЕЧАНИЕ ПО СЕТИ: как и обычные броски оружия (throwWeapon/
//    DROPPED_WEAPONS), которые сейчас тоже НЕ транслируются по NET_SYNC,
//    эта механика пока локальная — полноценно работает в бою с ботами и
//    оффлайн, но снаряды не реплицируются на второй клиент в PvP-дуэли.
// ════════════════════════════════════════════════════════════════════════

function weaponKeyOf(ent){
  const d = weaponDefFor(ent);
  return d ? d.key : null;
}
// Молот/посох/жезл/копьё/цеп — используют отдельные звуки взмаха и удара
// (HammerSwing / Damage/Hummer), а не стандартные звуки меча.
// ✅ Цеп добавлен в список: раньше звучал как меч (whoosh/damage), теперь
// звук кручения/удара цепа — как у молота (более тяжёлый, гулкий).
function isHeavySwingWeapon(ent){
  return $.IS(ent, 'hammer', 'staff', 'wand', 'spear', 'flail', 'halberd');
}
function isHeavySwingWeaponType(weaponTypeIdx){
  const d = WEAPON_TYPES[weaponTypeIdx];
  const k = d ? d.key : null;
  return $.ISK(k, 'hammer', 'staff', 'wand', 'spear', 'flail', 'halberd', 'magicstaff');
}
function isRangedWeapon(ent){
  return $.IS(ent, 'wand', 'crossbow', 'bow', 'magicstaff');
}

// Мировые координаты кончика оружия в руке entity (используется, чтобы
// магический снаряд жезла вылетал из наконечника, а не из центра тела).
function weaponTipPos(ent){
  const piv = $.POS.pivot(ent);
  const reach = weaponReach(ent) * sv('swlen') * (isBot(ent) ? sv('botswordscale') : 1);
  return { x: piv.x + Math.cos(ent.angle) * reach, y: piv.y + Math.sin(ent.angle) * reach };
}

// ──────────────── END LAYER: WEAPONS ────────────────

// ════════════════════════════════════════════════════════════════════════════
