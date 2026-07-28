// === src/systems/audio.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: AUDIO — звуки и музыка (SFX/BGM, загрузка, пул аудио)
// Module file: audio.js
// ============================================================================

// ============================================================================
// MODULE: AUDIO v5  (SFX + Music, folder-based loading from BuildMusicList.txt)
// Audio system is already isolated in this module; no global API is needed.
// ============================================================================

const PROJECT_PATH_AUDIO = "https://raw.githubusercontent.com/JackofShadow666/GodgraveAssets/main/";
const BUILD_LIST_URL_AUDIO = PROJECT_PATH_AUDIO + "Source/BuildList.txt";
// -- fetch() с таймаутом -----------------------------------------------------
// Обычный fetch() может висеть неограниченно долго, если сервер (или CDN)
// не отвечает — раньше loadWeaponTable()/loadAudioDB() могли зависнуть в
// состоянии "загрузка" навсегда. Теперь любой сорванный по таймауту запрос
// уходит в catch, как и обычная сетевая ошибка.
async function fetchWithTimeout(url, ms=10000){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(), ms);
  try{
    return await fetch(url, {signal:ctrl.signal});
  } finally {
    clearTimeout(t);
  }
}

// Игра читает BuildMusicList.txt и выбирает все файлы из этих папок
const SFX_FOLDERS = {
  music:          'Source/Music/',
  nullsnd:        'Source/Sound/Empty/',
  clash:          'Source/Sound/Sword/SwordClink/',
  clashHard:      'Source/Sound/Sword/SwordHit/',
  clashHard_rare: 'Source/Sound/Sword/SwordHit/',   // фильтр: Rare
  whoosh:         'Source/Sound/Sword/SwordSwing/',  // фильтр: без Agressive
  whooshRage:     'Source/Sound/Sword/SwordSwing/',  // фильтр: Agressive
  damage:         'Source/Sound/Damage/Sword/',
  rage:           'Source/Sound/Rage/',
  bladeblind:     'Source/Sound/Shield/',
  shieldblock:    'Source/Sound/Shield/',
  shieldPush:     'Source/Sound/ShieldPush/',
  uiHover:        'Source/Sound/Ui/',   // фильтр: Hover
  uiTap:          'Source/Sound/Ui/',   // фильтр: без Hover/Note/Death/Win/Pickup
  uiNote:         'Source/Sound/Ui/',   // фильтр: Note
  death:          'Source/Sound/Ui/',   // фильтр: Death — SFX_UI_Death_01/02.mp3
  victory:        'Source/Sound/Ui/',   // фильтр: Win — SFX_UI_Win_01.mp3
  pickupSound:    'Source/Sound/Ui/',   // фильтр: Pickup — SFX_UI_Pickup_01.mp3
  // -- Тяжёлое оружие: молот/посох/жезл/копьё --
  hammerSwing:    'Source/Sound/HammerSwing/',        // взмах
  damageHammer:   'Source/Sound/Damage/Hummer/',       // удар/попадание
  // -- Бросок оружия --
  throwSound:     'Source/Sound/Throw/',
  // -- Додж --
  dodgeSound:     'Source/Sound/Dodge/',
  // -- Жезл (магия) --
  magicEnergy:    'Source/Sound/Magic/',  // фильтр: Energy — зарядка перед выстрелом
  magicHit:       'Source/Sound/Magic/',  // фильтр: Hit — попадание снаряда
  magicPush:      'Source/Sound/Magic/',  // фильтр: Push — сам выстрел/отдача
  magicExplode: 'Source/Sound/Magic/',
  
  // -- Арбалет (стрела) --
  arrowHit:       'Source/Sound/Arrow/',  // фильтр: Hit — попадание стрелы
  arrowPush:      'Source/Sound/Arrow/',  // фильтр: Push — выстрел из арбалета
  crossbowReload: 'Source/Sound/Arrow/',  // фильтр: Reload — перезарядка арбалета
  
  // ?? ЗВУКИ ДЛЯ ЛУКА
  bowPush:        'Source/Sound/Bow/BowPush/',      // выстрел — SFX_BowPush.mp3
  bowReload:      'Source/Sound/Bow/BowReload/',      // перезарядился — SFX_Reload.mp3
  bowTension:     'Source/Sound/Bow/BowTension/',      // натяжение — SFX_BowTension.mp3
};

// Runtime: заполняется из BuildMusicList.txt
let SFX_DB = {};          // { clash: ["fullUrl1",...], ... }
let MUSIC_LIST_FULL = []; // ["fullUrl1", ...]

let audioEnabledFlag = false;
let musicEnabled = true;
let currentMusicObj = null;
let audioDBReady = false;

// ====================================================================
// ?? КЛЮЧ ДЛЯ localStorage
// ====================================================================
const ASSETS_CACHE_KEY = 'godgrave_assets_list_v1';
const ASSETS_VERSION = '1.1';

async function loadAudioDB() {
  // ====================================================================
  // ?? ПРОВЕРКА: ЕСТЬ ЛИ ДАННЫЕ В localStorage?
  // ====================================================================
  const cached = localStorage.getItem(ASSETS_CACHE_KEY);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data.version === ASSETS_VERSION) {
        console.log('? Загружаем ассеты из localStorage');
        
        // Восстанавливаем SPRITE_LISTS
        for (const [cat, urls] of Object.entries(data.spriteLists)) {
          SPRITE_LISTS[cat] = urls;
        }
        
        // Восстанавливаем SFX_DB
        for (const [type, urls] of Object.entries(data.sfxDb)) {
          SFX_DB[type] = urls;
        }
        
        // Восстанавливаем MUSIC_LIST_FULL
        MUSIC_LIST_FULL = data.musicList || [];
        
        spritesDBReady = true;
        audioDBReady = true;
        
        // Назначаем скины
        assignRandomSkin(P);
        for (const _b of ALL_BOTS) assignRandomSkin(_b);
        pickArenaBackground();
        
        // Запускаем музыку если нужно
        if (audioEnabledFlag && musicEnabled && MUSIC_LIST_FULL.length) {
          playRandomMusicTrack();
        }
        
        console.log('? Ассеты восстановлены из localStorage');
        return;
      }
    } catch(e) {
      console.warn('? Кэш повреждён, загружаем заново');
    }
  }
  
  // ====================================================================
  // ?? ПЕРВАЯ ЗАГРУЗКА — СКАЧИВАЕМ С СЕРВЕРА
  // ====================================================================
  console.log('?? Загружаем BuildMusicList.txt с сервера...');
  
  let text = '';
  try {
    const r = await fetchWithTimeout(BUILD_LIST_URL_AUDIO);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    text = await r.text();
  } catch(e) {
    console.warn('? BuildMusicList.txt недоступен, звук отключён:', e.message);
    audioDBReady = true;
    return;
  }

  // Парсим строки > полные URL
  const rawLines = text.split('\n')
    .map(l => l.trim().replace(/\\/g, '/'))
    .filter(l => l && !l.startsWith(';') && !l.startsWith('===')
              && !l.includes('Создано:') && !l.includes('Папка:'));

  const toUrl = l => PROJECT_PATH_AUDIO + (l.startsWith('Source/') ? l : 'Source/' + l);

  const lines = rawLines.filter(l => /\.(mp3|wav|ogg)$/i.test(l));
  const allUrls = lines.map(toUrl);

  // -- Спрайты (PNG) --------------------------------------------------------
  const pngLines = rawLines.filter(l => /\.png$/i.test(l));
  const pngUrls = pngLines.map(toUrl);
  
  const spriteLists = {};
  for (const [cat, folder] of Object.entries(SPRITE_FOLDERS)) {
    const prefix = PROJECT_PATH_AUDIO + folder;
    const matches = pngUrls.filter(u => u.startsWith(prefix));
    SPRITE_LISTS[cat] = matches;
    spriteLists[cat] = matches;
    if(matches.length === 0) console.warn(`? Нет спрайтов для "${cat}" в папке: ${folder}`);
  }
  spritesDBReady = true;
  console.log(`?? Спрайты: ${Object.entries(SPRITE_LISTS).map(([k,v])=>k+'?'+v.length).join(', ')}`);

  // Предзагрузка спрайтов
  for (const [cat, urls] of Object.entries(SPRITE_LISTS)) {
    for (const url of urls) loadSpriteImage(url);
  }

  // Назначаем скины
  assignRandomSkin(P);
  for(const _b of ALL_BOTS) assignRandomSkin(_b);
  pickArenaBackground();

  // -- Звуки ----------------------------------------------------------------
  const sfxDb = {};
  for (const [type, folder] of Object.entries(SFX_FOLDERS)) {
    const prefix = PROJECT_PATH_AUDIO + folder;
    let matches = allUrls.filter(u => u.startsWith(prefix));

    // Уточняющие фильтры
    if (type === 'clashHard')      matches = matches.filter(u => !u.toLowerCase().includes('rare'));
    if (type === 'clashHard_rare') matches = matches.filter(u => u.toLowerCase().includes('rare'));
    if (type === 'whoosh')         matches = matches.filter(u => !u.toLowerCase().includes('agressive'));
    if (type === 'whooshRage')     matches = matches.filter(u => u.toLowerCase().includes('agressive'));
    if (type === 'uiHover')        matches = matches.filter(u => u.toLowerCase().includes('hover'));
    if (type === 'uiNote')         matches = matches.filter(u => u.toLowerCase().includes('note'));
    if (type === 'uiTap')          matches = matches.filter(u => !u.toLowerCase().includes('hover') && !u.toLowerCase().includes('note') && !u.toLowerCase().includes('death') && !u.toLowerCase().includes('win') && !u.toLowerCase().includes('pickup'));
    if (type === 'death')          matches = matches.filter(u => u.toLowerCase().includes('death'));
    if (type === 'victory')        matches = matches.filter(u => u.toLowerCase().includes('win'));
    if (type === 'pickupSound')    matches = matches.filter(u => u.toLowerCase().includes('pickup'));
    if (type === 'magicEnergy')    matches = matches.filter(u => u.toLowerCase().includes('energy'));
    if (type === 'magicHit')       matches = matches.filter(u => u.toLowerCase().includes('hit'));
    if (type === 'magicPush')      matches = matches.filter(u => u.toLowerCase().includes('push'));
    if (type === 'arrowHit')       matches = matches.filter(u => u.toLowerCase().includes('hit'));
    if (type === 'arrowPush')      matches = matches.filter(u => u.toLowerCase().includes('push') && !u.toLowerCase().includes('reload'));
    if (type === 'magicExplode')   matches = matches.filter(u => u.toLowerCase().includes('explode'));
	
    if (type === 'crossbowReload') matches = matches.filter(u => u.toLowerCase().includes('reload'));

    if (type === 'music') {
      MUSIC_LIST_FULL = matches;
    } else {
      if (matches.length > 0) {
        SFX_DB[type] = matches;
        sfxDb[type] = matches;
      }
    }
  }

  console.log(`?? Треков: ${MUSIC_LIST_FULL.length}`);
  console.log(`?? SFX: ${Object.entries(SFX_DB).map(([k,v])=>k+'?'+v.length).join(', ')}`);

  // Проверяем папки
  for (const [type, folder] of Object.entries(SFX_FOLDERS)) {
    if (type === 'music' || type === 'nullsnd') continue;
    if (!SFX_DB[type] || SFX_DB[type].length === 0) {
      console.warn(`? Нет звуков для "${type}" в папке: ${folder}`);
    }
  }
  audioDBReady = true;

  // ====================================================================
  // ?? СОХРАНЯЕМ В localStorage ДЛЯ СЛЕДУЮЩЕЙ ЗАГРУЗКИ
  // ====================================================================
  try {
    const cacheData = {
      version: ASSETS_VERSION,
      spriteLists: spriteLists,
      sfxDb: sfxDb,
      musicList: MUSIC_LIST_FULL,
    };
    localStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify(cacheData));
    console.log('?? Ассеты сохранены в localStorage');
  } catch(e) {
    console.warn('? Не удалось сохранить кэш:', e);
  }

  // Запустить музыку если уже кликнули
  if (audioEnabledFlag && musicEnabled && MUSIC_LIST_FULL.length) {
    playRandomMusicTrack();
  }
}


// -- СБРОС КЭША --
function clearAssetsCache() {
  localStorage.removeItem(ASSETS_CACHE_KEY);
  console.log('?? Кэш ассетов очищен');
  location.reload();
}
// Можно вызвать из консоли: clearAssetsCache()

window._musicVol=window._musicVol||0.5;
function playRandomMusicTrack() {
  if (!audioEnabledFlag || !musicEnabled || MUSIC_LIST_FULL.length === 0) return;
  if (currentMusicObj) { currentMusicObj.pause(); currentMusicObj = null; }
  const idx = Math.floor(Math.random() * MUSIC_LIST_FULL.length);
  currentMusicObj = new Audio(MUSIC_LIST_FULL[idx]);
  currentMusicObj.volume = window._musicVol!==undefined ? window._musicVol : 0.2;
  currentMusicObj.addEventListener('ended', () => {
    if (musicEnabled && audioEnabledFlag) playRandomMusicTrack();
  }, { once: true });
  currentMusicObj.play().catch(() => {});
}

function stopMusic() {
  if (currentMusicObj) { currentMusicObj.pause(); currentMusicObj = null; }
}

function toggleMusic() {
  if (!audioEnabledFlag) { enableAudioSystem(); musicEnabled = true; }
  else {
    musicEnabled = !musicEnabled;
    musicEnabled ? playRandomMusicTrack() : stopMusic();
  }
  const btn = document.getElementById('musicToggleBtn');
  if (btn) {
    btn.textContent = window.I18N ? window.I18N.buttonText('music', musicEnabled ? 'on' : 'off') : (musicEnabled ? 'ON' : 'OFF');
    btn.style.color = musicEnabled ? '#4acc70' : '#cc4040';
  }
}

function enableAudioSystem() {
  if (audioEnabledFlag) return;
  audioEnabledFlag = true;
  document.removeEventListener('mousedown', enableAudioSystem);
  document.removeEventListener('keydown',   enableAudioSystem);
  // Музыка запустится сразу если DB готова, иначе loadAudioDB() запустит её сама
  if (audioDBReady && musicEnabled && MUSIC_LIST_FULL.length) playRandomMusicTrack();
}

// -- SOUND_BLOCK: воспроизведение -----------------------------------------
// -- Audio Pool: пул из 4 объектов на URL для быстрого воспроизведения ----
const AUDIO_POOL = {}; // url > [Audio, Audio, Audio, Audio]
const POOL_SIZE = 4;

function getPoolAudio(url){
  if(!AUDIO_POOL[url]){
    AUDIO_POOL[url] = Array.from({length: POOL_SIZE}, () => {
      const a = new Audio(url); a.preload = 'auto'; a.load(); return a;
    });
  }
  // Ищем свободный (не играет или закончил)
  const pool = AUDIO_POOL[url];
  for(const a of pool){
    if(a.paused || a.ended){ return a; }
  }
  // Все заняты — берём самый старый (перезапускаем)
  return pool[0];
}

// -- Звуки UI: hover и tap на кнопках ----------------------------------------
$.S = $.S || {
  play(type){ return window['playSound'](type); },
  swing(){ return window['playSound']('whoosh'); },
  hammer(){ return window['playSound']('hammerSwing'); },
  damage(){ return window['playSound']('damage'); },
  damageHammer(){ return window['playSound']('damageHammer'); },
  clash(){ return window['playSound']('clash'); },
  clashHard(){ return window['playSound']('clashHard'); },
  rage(){ return window['playSound']('rage'); },
  block(){ return window['playSound']('shieldblock'); },
  shieldPush(){ return window['playSound']('shieldPush'); },
  dodge(){ return window['playSound']('dodgeSound'); },
  death(){ return window['playSound']('death'); },
  victory(){ return window['playSound']('victory'); },
  pickup(){ return window['playSound']('pickup'); },
  throw(){ return window['playSound']('throw'); },
  magic(){ return window['playSound']('magicPush'); },
  magicHit(){ return window['playSound']('magicHit'); },
  arrow(){ return window['playSound']('arrowPush'); },
  arrowHit(){ return window['playSound']('arrowHit'); },
  exhaust(){ return window['playSound']('exhaust'); }
};

document.addEventListener('mouseover', e=>{
  if(window.IS_MOBILE) return;
  if(e.target.closest('button, .menu-btn, .ov-btn')) $.S.play('uiHover');
});
document.addEventListener('click', e=>{
  if(e.target.closest('button, .menu-btn, .ov-btn')) $.S.play('uiTap');
});

function playSound(sfxType) {
  if (!audioEnabledFlag) return;
  let arr = SFX_DB[sfxType];
  if (sfxType === 'clashHard' && Math.random() < 0.05 && SFX_DB['clashHard_rare']?.length)
    arr = SFX_DB['clashHard_rare'];
  if (!arr || arr.length === 0) {
    if (audioDBReady) console.warn('?? Нет звука для типа:', sfxType);
    return;
  }
  const idx = Math.floor(Math.random() * arr.length);
  const url = arr[idx];
  const audio = getPoolAudio(url);
  audio.currentTime = 0;
  audio.volume = 0.5;
  audio.play().catch(() => {
    // Если pool объект не готов — fallback new Audio
    const fb = new Audio(url); fb.volume = 0.5; fb.play().catch(()=>{});
  });
}

// -- Управляемый звук (для длительных эффектов вроде зарядки жезла) ---------
// В отличие от $.S.play() (fire-and-forget), возвращает ссылку на Audio,
// чтобы вызывающий код мог остановить именно этот конкретный звук позже —
// например, плавно притушить его, если игрок отменил накопление заряда.
function playControllableSound(sfxType) {
  if (!audioEnabledFlag) return null;
  const arr = SFX_DB[sfxType];
  if (!arr || arr.length === 0) {
    if (audioDBReady) console.warn('?? Нет звука для типа:', sfxType);
    return null;
  }
  const idx = Math.floor(Math.random() * arr.length);
  const url = arr[idx];
  const audio = getPoolAudio(url);
  audio.currentTime = 0;
  audio.volume = 0.5;
  audio._fadeOutRAF = null; // на случай если этот pool-объект уже кому-то фейдился раньше
  audio.play().catch(() => {});
  return audio;
}

// -- Плавное затухание звука за заданное время (сек), затем пауза -----------
// Используется, например, когда игрок отпускает жезл раньше времени накопления —
// звук зарядки не обрывается резко, а гаснет за 0.3 сек.
function fadeOutSound(audio, duration = 0.3){
  if(!audio) return;
  if(audio._fadeOutRAF) cancelAnimationFrame(audio._fadeOutRAF); // не запускать второй фейд поверх первого
  const startVol = audio.volume;
  const startT = performance.now();
  function step(now){
    const t = $.M.clamp((now - startT) / (duration*1000), 0, 1);
    audio.volume = startVol * (1 - t);
    if(t < 1 && !audio.paused){
      audio._fadeOutRAF = requestAnimationFrame(step);
    } else {
      audio.pause();
      audio.volume = 0.5; // возвращаем громкость по умолчанию для следующего использования из пула
      audio._fadeOutRAF = null;
    }
  }
  audio._fadeOutRAF = requestAnimationFrame(step);
}

document.addEventListener('mousedown', enableAudioSystem);
document.addEventListener('keydown',   enableAudioSystem);
// ================ END MODULE: AUDIO ========================================

const _musicBtn = document.getElementById('musicToggleBtn');
if(_musicBtn) _musicBtn.addEventListener('click', toggleMusic);

// ---------------- END LAYER: AUDIO ----------------

// ============================================================================
