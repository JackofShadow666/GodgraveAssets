// ═══════════════════════════════════════════════════════════════════════
// MODULE: GAMEPAD CONTROLS
// ═══════════════════════════════════════════════════════════════════════
//
// ФИЛОСОФИЯ: этот файл — ЧИСТЫЙ МОДИФИКАТОР ВВОДА. Игра о нём ничего не
// знает и знать не должна. Вместо прямого чтения/записи внутренних
// переменных игры (P, keys, mDown, WEAPON_TYPES...) геймпад генерирует
// synthetic DOM-события (keydown/keyup/mousemove/mousedown/mouseup) — те
// же самые, что шлёт настоящая клавиатура/мышь. Игра слушает их так же,
// как обычно, и понятия не имеет, что где-то есть геймпад.
//
// Единственное исключение — несколько ДЕЙСТВИТЕЛЬНО ПУБЛИЧНЫХ функций,
// которые сама игра явно вывесила на `window.*` как публичный API
// (window.doDodge, window.toggleAI, window.toggleMusic,
// window.toggleSwordStyle, window.doResume/doRestart/doOpenSettings) —
// их вызывать напрямую нормально, это не "лазанье во внутренности",
// а официальная точка входа, которую сама игра для этого и открыла.
//
// Если в будущем игра поменяет реализацию любой механики (как менялся,
// например, AI или combat), но сохранит те же клавиши и тот же публичный
// API — этот файл продолжит работать без изменений.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const BASE_PATH = (typeof PROJECT_PATH_AUDIO !== 'undefined')
    ? PROJECT_PATH_AUDIO
    : "https://raw.githubusercontent.com/JackofShadow666/GodgraveAssets/main/";
  const GAMEPAD_TABLE_URL = BASE_PATH + "Source/Talbe/GamepadTable.txt";

  // ── Действия, назначаемые не на "функцию игры", а на КЛАВИШУ, которую
  // сама игра уже слушает нативно (см. её keydown-обработчик). Значение —
  // key, который будет вписан в synthetic KeyboardEvent.
  const HOTKEY_ACTIONS = {
    shieldFlip: 'q',      // P._shieldFlipped = !P._shieldFlipped
    shieldType: 'z',      // смена щита игрока
    swapWeapon: 'c',      // смена оружия игрока
    swordStyle: 'r',      // window.toggleSwordStyle()
    throwWeapon: '1',     // throwWeapon(P)
  };

  // ── Действия, вызываемые через официальный публичный window.* API игры,
  // а не через синтетическую клавишу (для них либо нет отдельной клавиши,
  // либо публичная функция — самый прямой и стабильный путь).
  const PUBLIC_API_ACTIONS = {
    dodge:       () => {
      if (window.beginDodgePress) window.beginDodgePress('GamepadDodge');
      else if (window.doDodge) window.doDodge(true);
    },
    spawnBot:    () => window.toggleAI && window.toggleAI(),
    musicToggle: () => window.toggleMusic && window.toggleMusic(),
  };

  const DEFAULT_CONFIG = {
    deadzoneMove: 0.18,
    deadzoneAim: 0.22,
    aimStickRadius: 60,
    axes: { move: { x: 0, y: 1 }, aim: { x: 2, y: 3 } },
    buttons: {
      attack:      { index: 7,  type: 'trigger', action: 'attack' },
      shield:      { index: 6,  type: 'trigger', action: 'shield' },
      dodge:       { index: 0,  action: 'dodge' },
      spawnBot:    { index: 1,  action: 'spawnBot' },
      musicToggle: { index: 2,  action: 'musicToggle' },
      throwWeapon: { index: 4,  action: 'throwWeapon' },
      pause:       { index: 9,  action: 'pause' },
      dpadUp:      { index: 12, action: 'swordStyle' },
      dpadLeft:    { index: 14, action: 'swapWeapon' },
      dpadRight:   { index: 15, action: 'shieldType' }
    }
  };

  let CFG = DEFAULT_CONFIG;
  let gpIndex = null;
  // ── БЛОКИРОВКА ВВОДА ПОСЛЕ ВЫХОДА ИЗ МЕНЮ ────────────────────────────
  // Прямое решение проблемы "додж срабатывает сам при закрытии меню
  // кнопкой A": вместо того чтобы полагаться только на синхронизацию
  // состояния кнопок между ветками (что теоретически должно работать, но
  // на практике не помогло), после ЛЮБОГО выхода из меню/клавиатуры на
  // короткое время полностью игнорируем ВСЕ кнопки геймпада — движение и
  // прицел продолжают работать, значения кнопок просто не читаются.
  let _inputSuppressedUntil = 0;
  function suppressInputBriefly(ms) { _inputSuppressedUntil = performance.now() + (ms || 500); }
  let rafId = null;
  let prevButtonState = {};
  let audioActivated = false;
  let canvasEl = null;
  let dodgeHeld = false;

  function getCanvas() {
    if (canvasEl && document.body.contains(canvasEl)) return canvasEl;
    canvasEl = document.getElementById('c') || document.querySelector('canvas');
    return canvasEl;
  }

  // ── АКТИВАЦИЯ ЗВУКА ПРИ ПЕРВОМ НАЖАТИИ КНОПКИ ГЕЙМПАДА ──────────────
  // Браузеры блокируют автовоспроизведение звука до первого жеста
  // пользователя. Игра сама разблокирует звук по своим mousedown/keydown
  // слушателям (см. enableAudioSystem) — синтетическое keydown ниже
  // получает это бесплатно, отдельно дёргать enableAudioSystem не нужно.
  function activateAudio() {
    if (audioActivated) return;
    audioActivated = true;
  }

  // ── SYNTHETIC INPUT: события, которые игра и так слушает нативно ───────
  function dispatchKey(type, key, code) {
    const evt = new KeyboardEvent(type, {
      key, code: code || 'Key' + key.toUpperCase(),
      bubbles: true, cancelable: true,
    });
    // Игра слушает keydown на document И на window в разных местах —
    // диспатчим на document, событие всплывает и туда, и туда.
    document.dispatchEvent(evt);
  }

  function tapKey(key) {
    dispatchKey('keydown', key);
    dispatchKey('keyup', key);
  }

  function setHeldKey(key, held, heldState) {
    // heldState — Set с уже "зажатыми" клавишами этого модуля, чтобы не
    // слать keydown повторно каждый кадр (как и настоящая клавиатура не
    // повторяет событие, пока клавиша не отпущена и нажата заново).
    const wasHeld = heldState.has(key);
    if (held && !wasHeld) {
      heldState.add(key);
      dispatchKey('keydown', key);
    } else if (!held && wasHeld) {
      heldState.delete(key);
      dispatchKey('keyup', key);
    }
  }

  const heldMoveKeys = new Set();

  function dispatchMouseMove(clientX, clientY) {
    const canvas = getCanvas();
    if (!canvas) return;
    const evt = new MouseEvent('mousemove', {
      clientX, clientY, bubbles: true, cancelable: true, button: 0,
    });
    canvas.dispatchEvent(evt);
  }

  function dispatchMouseButton(type, clientX, clientY) {
    const canvas = getCanvas();
    if (!canvas) return;
    const evt = new MouseEvent(type, {
      clientX, clientY, bubbles: true, cancelable: true, button: 0,
    });
    canvas.dispatchEvent(evt);
  }

  // ── КУРСОР ДЛЯ ГЕЙМПАДА В МЕНЮ ──────────────────────────────────────
  // Это остаётся отдельным DOM-оверлеем (не влияет на игровой canvas-прицел),
  // потому что меню — это обычный HTML/CSS UI, а не игровая логика, и здесь
  // действительно нет иного способа кроме как рисовать курсор поверх DOM.
  let menuCursor = null;
  let menuCursorX = window.innerWidth / 2;
  let menuCursorY = window.innerHeight / 2;
  let hoveredElement = null;
  let isMenuOpen = false;

  // ═══════════════════════════════════════════════════════════════════
  // ВИРТУАЛЬНАЯ КЛАВИАТУРА — ввод текста в input[type=text] с геймпада.
  // Полностью самодостаточный DOM-оверлей поверх игры; управляется
  // отдельно от menuCursor, пока активна. Не трогает внутренности игры —
  // при подтверждении просто пишет в input.value и шлёт настоящие
  // 'input'/'change' события, как будто текст напечатан с клавиатуры.
  // ═══════════════════════════════════════════════════════════════════
  const KB_LAYOUT_EN = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L','—'],
    ['Z','X','C','V','B','N','M',',','.','?'],
  ];
  const KB_LAYOUT_RU = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З'],
    ['Ф','Ы','В','А','П','Р','О','Л','Д','Ж'],
    ['Я','Ч','С','М','И','Т','Ь','Б','Ю','Э'],
  ];
  // Последняя строка — служебные клавиши, всегда одна и та же независимо от раскладки
  const KB_ROW_SPECIAL = ['ABC/РУС', 'ПРОБЕЛ', '⌫', 'ГОТОВО'];

  let kbOverlay = null;
  let kbTargetInput = null;
  let kbLayout = KB_LAYOUT_RU;
  let kbRow = 0, kbCol = 0; // позиция выбора; kbRow может указывать и на служебный ряд (index layout.length)
  let kbCellEls = []; // плоский список [{el, row, col}] для перерисовки подсветки

  function buildKeyboardDOM() {
    if (kbOverlay) return;
    kbOverlay = document.createElement('div');
    kbOverlay.id = 'gamepad-virtual-keyboard';
    kbOverlay.style.cssText = `
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      z-index: 1000000; display: none;
      background: rgba(4,12,22,0.97); border: 1px solid #1a3050;
      border-radius: 12px; padding: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.6);
      font-family: 'Share Tech Mono', monospace;
    `;
    document.body.appendChild(kbOverlay);
  }

  function renderKeyboard() {
    if (!kbOverlay) return;
    kbOverlay.innerHTML = '';
    kbCellEls = [];

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    kbLayout.forEach((rowArr, r) => {
      const rowEl = document.createElement('div');
      rowEl.style.cssText = 'display:flex;gap:4px;justify-content:center;';
      rowArr.forEach((ch, c) => {
        const cell = document.createElement('div');
        cell.textContent = ch;
        cell.style.cssText = `
          width: 30px; height: 30px; display:flex; align-items:center; justify-content:center;
          background: rgba(20,40,60,0.8); border: 1px solid #1a3050; border-radius: 4px;
          color: #cce; font-size: 13px; user-select:none;
        `;
        rowEl.appendChild(cell);
        kbCellEls.push({ el: cell, row: r, col: c });
      });
      grid.appendChild(rowEl);
    });

    const specialRow = document.createElement('div');
    specialRow.style.cssText = 'display:flex;gap:4px;justify-content:center;margin-top:4px;';
    KB_ROW_SPECIAL.forEach((label, c) => {
      const cell = document.createElement('div');
      cell.textContent = label;
      cell.style.cssText = `
        min-width: 50px; height: 30px; display:flex; align-items:center; justify-content:center;
        background: rgba(20,40,60,0.8); border: 1px solid #1a3050; border-radius: 4px;
        color: #6ab0d0; font-size: 11px; padding: 0 8px; user-select:none;
      `;
      specialRow.appendChild(cell);
      kbCellEls.push({ el: cell, row: kbLayout.length, col: c });
    });
    grid.appendChild(specialRow);

    const preview = document.createElement('div');
    preview.id = 'gamepad-kb-preview';
    preview.style.cssText = 'text-align:center;color:#6ab0d0;font-size:11px;margin-bottom:8px;min-height:14px;';
    // ВАЖНО: insertBefore(newNode, referenceNode) требует, чтобы referenceNode
    // УЖЕ был ребёнком родителя в момент вызова — иначе браузер бросает
    // DOMException "Child to insert before is not a child of this node".
    // Раньше здесь grid ещё не был добавлен в kbOverlay на момент вызова,
    // из-за чего эта строка падала при КАЖДОМ открытии клавиатуры и обрывала
    // весь requestAnimationFrame-колбэк (pollGamepad), из-за чего курсор и
    // клавиатура геймпада переставали обновляться после первой попытки её
    // открыть. Сначала добавляем grid, потом вставляем preview перед ним.
    kbOverlay.appendChild(grid);
    kbOverlay.insertBefore(preview, grid);

    const hint = document.createElement('div');
    hint.style.cssText = 'text-align:center;color:#3a5a70;font-size:9px;margin-top:8px;';
    hint.textContent = 'A — ввести · B — назад · Y — пробел · X — backspace';
    kbOverlay.appendChild(hint);

    highlightKbCell();
    updateKbPreview();
  }

  function updateKbPreview() {
    const preview = document.getElementById('gamepad-kb-preview');
    if (preview && kbTargetInput) {
      preview.textContent = kbTargetInput.value || '';
    }
  }

  function highlightKbCell() {
    kbCellEls.forEach(({ el, row, col }) => {
      const isSelected = row === kbRow && col === kbCol;
      el.style.outline = isSelected ? '2px solid #ffcc44' : 'none';
      el.style.boxShadow = isSelected ? '0 0 12px rgba(255,200,50,0.6)' : 'none';
      el.style.background = isSelected ? 'rgba(80,60,20,0.6)' : 'rgba(20,40,60,0.8)';
    });
  }

  function kbRowLength(row) {
    return row === kbLayout.length ? KB_ROW_SPECIAL.length : kbLayout[row].length;
  }

  function kbMoveCursor(dRow, dCol) {
    const totalRows = kbLayout.length + 1;
    const oldRow = kbRow;
    const oldCol = kbCol; // ВАЖНО: сохраняем ДО любого клэмпа — строка ниже
                           // уже обрезает kbCol под НОВУЮ (возможно короткую)
                           // длину ряда, и если считать ratio от уже
                           // обрезанного значения, пропорция получается неверной.
    kbRow = (kbRow + dRow + totalRows) % totalRows;
    const len = kbRowLength(kbRow);
    if (dCol !== 0) {
      kbCol = Math.max(0, Math.min(len - 1, kbCol + dCol));
    } else {
      // Переход между рядами разной длины — подгоняем колонку пропорционально
      // положению в предыдущем ряду, а не просто клэмпим (иначе курсор всегда
      // "улетает" в последний столбец короткого ряда вместо сохранения
      // относительной позиции).
      const prevLen = kbRowLength(oldRow);
      const ratio = prevLen > 1 ? oldCol / (prevLen - 1) : 0;
      kbCol = Math.round(ratio * (len - 1));
    }
    highlightKbCell();
  }

  function kbConfirmCell() {
    if (!kbTargetInput) return;
    if (kbRow < kbLayout.length) {
      const ch = kbLayout[kbRow][kbCol];
      insertIntoInput(kbTargetInput, ch);
    } else {
      const label = KB_ROW_SPECIAL[kbCol];
      if (label === 'ABC/РУС') {
        kbLayout = kbLayout === KB_LAYOUT_RU ? KB_LAYOUT_EN : KB_LAYOUT_RU;
        renderKeyboard();
        return;
      } else if (label === 'ПРОБЕЛ') {
        insertIntoInput(kbTargetInput, ' ');
      } else if (label === '⌫') {
        backspaceInput(kbTargetInput);
      } else if (label === 'ГОТОВО') {
        closeVirtualKeyboard(true);
        return;
      }
    }
    updateKbPreview();
  }

  function insertIntoInput(input, ch) {
    const max = input.maxLength > 0 ? input.maxLength : Infinity;
    if (input.value.length >= max) return;
    input.value += ch;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function backspaceInput(input) {
    if (!input.value) return;
    input.value = input.value.slice(0, -1);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function openVirtualKeyboard(input) {
    buildKeyboardDOM();
    kbTargetInput = input;
    kbRow = 0; kbCol = 0;
    // Кириллица по умолчанию для имени игрока/чата — но если в поле уже есть
    // латиница, стартуем с английской раскладки, это удобнее для сетевых ID.
    kbLayout = /^[a-zA-Z0-9\s]*$/.test(input.value) && input.value ? KB_LAYOUT_EN : KB_LAYOUT_RU;
    renderKeyboard();
    kbOverlay.style.display = 'block';
    if (menuCursor) menuCursor.style.display = 'none'; // не мешаем клавиатуре визуально
    input.focus();
  }

  function closeVirtualKeyboard(confirmed) {
    if (kbOverlay) kbOverlay.style.display = 'none';
    if (kbTargetInput) {
      if (confirmed) {
        kbTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
        // Если у поля есть свой Enter-обработчик (как у name-input — подтверждение
        // имени), эмулируем настоящий Enter, чтобы не дублировать логику здесь.
        kbTargetInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      }
      kbTargetInput.blur();
    }
    kbTargetInput = null;
    if (menuCursor && isAnyMenuOpen()) menuCursor.style.display = 'block';
    // Прямая блокировка ввода геймпада на 500мс — не даёт кнопке, которой
    // только что закрыли клавиатуру/меню (обычно A или B), тут же
    // "провалиться" в игру как боевое действие (додж и т.п.).
    suppressInputBriefly(500);
  }

  function isVirtualKeyboardOpen() {
    return !!(kbOverlay && kbOverlay.style.display !== 'none' && kbTargetInput);
  }

  function addHoverStyles() {
    const style = document.createElement('style');
    style.id = 'gamepad-hover-styles';
    style.textContent = `
      .gamepad-hover,
      .gamepad-hover.hover,
      .gamepad-hover.active {
        outline: 2px solid #ffcc44 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 20px rgba(255, 200, 50, 0.5) !important;
        transform: scale(1.02);
        transition: all 0.1s ease;
      }
    `;
    document.head.appendChild(style);
  }

  // ── ОБНАРУЖЕНИЕ УЖЕ ПОДКЛЮЧЁННОГО ГЕЙМПАДА ────────────────────────────
  // Раньше геймпад искался только по событию window 'load' — но 'load'
  // срабатывает, когда ВСЯ страница полностью загружена, а профиль/ввод
  // имени (#name-overlay) игра может показать намного раньше. Если
  // геймпад был подключён ДО открытия страницы, 'gamepadconnected' может
  // не сработать вовсе (браузеры шлют его только на физическое
  // подключение/пробуждение, не ретроактивно) — используем и события, и
  // (главное) периодический опрос ниже как гарантированный fallback.
  function detectAlreadyConnectedGamepad() {
    if (gpIndex !== null) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (gp) {
        gpIndex = gp.index;
        hideGamepadHint();
        return;
      }
    }
  }

  // ── КОСТЫЛЬ: ГАРАНТИРОВАННОЕ ОБНАРУЖЕНИЕ ГЕЙМПАДА ЧЕРЕЗ ОПРОС ПО ТАЙМЕРУ ─
  // Событийный подход (слушать pointerdown/keydown/mousemove) на практике
  // недостаточен — то ли браузер не всегда шлёт эти события туда, где мы
  // их слушаем, то ли причина в чём-то ещё специфичном для конкретной
  // среды/версии браузера. Вместо того чтобы дальше гадать — "грубая
  // сила": простой setInterval, который каждые 300мс наощупь опрашивает
  // navigator.getGamepads() — работает гарантированно, независимо от
  // того, через какое именно событие браузер решит "открыть" данные
  // геймпада. Overhead исчезающе мал (300мс — не каждый кадр), интервал
  // сам себя отключает, как только gpIndex найден.
  const _gpDetectInterval = setInterval(() => {
    if (gpIndex !== null) { clearInterval(_gpDetectInterval); return; }
    detectAlreadyConnectedGamepad();
  }, 300);

  // ── ВИДИМАЯ ПОДСКАЗКА, ПОКА ГЕЙМПАД ЕЩЁ НЕ ОБНАРУЖЕН ────────────────
  // Раз обнаружение может занять какое-то время — явно говорим об этом
  // пользователю вместо того, чтобы курсор молча не появлялся. Как только
  // геймпад обнаружен, подсказка скрывается сама.
  let gamepadHintEl = null;
  let _hintUpdateInterval = null;
  function showGamepadHint() {
    if (gamepadHintEl) return;
    gamepadHintEl = document.createElement('div');
    gamepadHintEl.id = 'gamepad-detect-hint';
    gamepadHintEl.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      z-index: 1000001; background: rgba(4,12,22,0.9); border: 1px solid #1a3050;
      border-radius: 8px; padding: 8px 16px; color: #ffcc44;
      font-family: 'Share Tech Mono', monospace; font-size: 12px;
      pointer-events: none; opacity: 0; transition: opacity 0.3s ease;
      max-width: 90vw; text-align: center; white-space: pre-wrap;
    `;
    document.body.appendChild(gamepadHintEl);
    requestAnimationFrame(() => { gamepadHintEl.style.opacity = '1'; });

    // ── ДИАГНОСТИКА ─────────────────────────────────────────────────────
    // Раз баннер не пропадает даже после реального нажатия кнопки на
    // устройстве — значит navigator.getGamepads() по какой-то причине
    // не отдаёт данные вообще, а не просто "ждёт взаимодействия". Вместо
    // того чтобы гадать дальше, выводим на сам баннер, что РЕАЛЬНО
    // возвращает браузер прямо сейчас — это покажет точную причину:
    // Gamepad API недоступен, массив пуст, устройство есть но не A/RT,
    // и т.п.
    function updateDiagnosticText() {
      if (!gamepadHintEl) return;
      if (!navigator.getGamepads) {
        gamepadHintEl.textContent = '🎮 navigator.getGamepads недоступен в этом браузере';
        return;
      }
      const pads = navigator.getGamepads();
      const found = [];
      for (let i = 0; i < pads.length; i++) {
        if (pads[i]) found.push(`#${i}: "${pads[i].id}" (кнопок: ${pads[i].buttons.length})`);
      }
      if (found.length === 0) {
        gamepadHintEl.textContent = '🎮 Нажмите любую кнопку на геймпаде\n(getGamepads() пока возвращает пусто)';
      } else {
        gamepadHintEl.textContent = '🎮 Обнаружено, но не подхвачено:\n' + found.join('\n');
      }
    }
    updateDiagnosticText();
    _hintUpdateInterval = setInterval(updateDiagnosticText, 500);
  }
  function hideGamepadHint() {
    if (!gamepadHintEl) return;
    if (_hintUpdateInterval) { clearInterval(_hintUpdateInterval); _hintUpdateInterval = null; }
    gamepadHintEl.style.opacity = '0';
    const el = gamepadHintEl;
    gamepadHintEl = null;
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
  }
  // Показываем подсказку только если геймпад ещё не найден через 400мс —
  // если он обнаружился почти сразу, подсказка вообще не мелькнёт на экране.
  //setTimeout(() => { if (gpIndex === null) showGamepadHint(); }, 400);

  function createMenuCursor() {
    if (menuCursor) return;

    addHoverStyles();

    menuCursor = document.createElement('div');
    menuCursor.id = 'gamepad-menu-cursor';
    menuCursor.style.cssText = `
      position: fixed;
      pointer-events: none !important;
      z-index: 999999;
      width: 40px;
      height: 40px;
      display: none;
      transform: translate(-50%, -50%);
    `;

    // ── ЧИСТЫЙ CSS ВМЕСТО CANVAS ─────────────────────────────────────────
    // Раньше крестик рисовался через canvas.getContext('2d') — при
    // диагностике выяснилось, что именно canvas-содержимое переставало
    // быть видимым внутри окна настроек (#mob-settings-overlay), хотя
    // простой div с обычным CSS-фоном/outline отображался стабильно
    // ВЕЗДЕ, включая настройки. Вместо того чтобы выяснять точную причину
    // (возможно, canvas теряет контент при каком-то отдельном re-layout
    // самого overlay, или конфликт с чем-то в CSS настроек) — просто
    // избегаем canvas целиком и собираем тот же крестик из обычных
    // CSS-элементов, раз этот подход доказанно надёжен в этой игре.

    // Круг (кольцо) — через border-radius с прозрачной серединой
    const ring = document.createElement('div');
    ring.style.cssText = `
      position: absolute; left: 6px; top: 6px; width: 28px; height: 28px;
      border-radius: 50%; border: 3px solid #ffcc44;
      box-shadow: 0 0 12px rgba(255, 200, 50, 0.7);
    `;
    menuCursor.appendChild(ring);

    // Вертикальная и горизонтальная полоски креста
    const barV = document.createElement('div');
    barV.style.cssText = `
      position: absolute; left: 19px; top: 4px; width: 2px; height: 32px;
      background: #ffcc44;
    `;
    menuCursor.appendChild(barV);

    const barH = document.createElement('div');
    barH.style.cssText = `
      position: absolute; left: 4px; top: 19px; width: 32px; height: 2px;
      background: #ffcc44;
    `;
    menuCursor.appendChild(barH);

    // Центральная точка
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute; left: 17px; top: 17px; width: 6px; height: 6px;
      border-radius: 50%; background: #ffcc44;
      box-shadow: 0 0 6px rgba(255, 200, 50, 0.8);
    `;
    menuCursor.appendChild(dot);

    document.body.appendChild(menuCursor);
  }

  function showMenuCursor(show) {
    if (!menuCursor) {
      if (!_lastShowCursorDiagLog || performance.now() - _lastShowCursorDiagLog > 1000) {
        _lastShowCursorDiagLog = performance.now();
        console.log('[gamepad-diag] showMenuCursor вызван, но menuCursor === null (createMenuCursor ещё не отработала?)');
      }
      return;
    }
    const shouldShow = show && gpIndex !== null;
    menuCursor.style.display = shouldShow ? 'block' : 'none';
    isMenuOpen = show;
    if (!_lastShowCursorDiagLog || performance.now() - _lastShowCursorDiagLog > 1000) {
      _lastShowCursorDiagLog = performance.now();
      console.log('[gamepad-diag] showMenuCursor(', show, ') -> display=', menuCursor.style.display,
        'gpIndex=', gpIndex, 'menuCursor.parentNode:', menuCursor.parentNode ? 'attached' : 'DETACHED');
    }
  }
  let _lastShowCursorDiagLog = 0;

  function updateMenuCursorPosition(x, y) {
    if (!menuCursor) return;
    menuCursorX = Math.max(0, Math.min(window.innerWidth, x));
    menuCursorY = Math.max(0, Math.min(window.innerHeight, y));
    menuCursor.style.left = menuCursorX + 'px';
    menuCursor.style.top = menuCursorY + 'px';

    if (isAnyMenuOpen() && gpIndex !== null) {
      updateHover();
    }
  }

  function updateHover() {
    if (hoveredElement) {
      hoveredElement.classList.remove('hover', 'active', 'gamepad-hover');
      hoveredElement = null;
    }

    const btn = findElementAtPosition(menuCursorX, menuCursorY);

    if (btn) {
      btn.classList.add('hover', 'gamepad-hover');
      hoveredElement = btn;
    }
  }

  // ── ПРОВЕРКА ЛЮБОГО ОТКРЫТОГО МЕНЮ ──────────────────────────────────
  function isAnyMenuOpen() {
    const menus = [
      '.game-overlay.open',
      '#mob-menu-overlay.open',
      '#net-overlay.open',
      '#name-overlay.open'
    ];

    for (const selector of menus) {
      const el = document.querySelector(selector);
      if (el) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none') {
          return true;
        }
      }
    }

    // #mob-settings-overlay переключается через style.display напрямую
    // (не через класс) — проверяем computed style по id, а не хрупким
    // сопоставлением строки атрибута style="..." (которое ломается от
    // малейшей разницы в форматировании: "flex" vs " flex", наличия
    // пробела после двоеточия и т.п.)
    const settOv = document.getElementById('mob-settings-overlay');
    if (settOv && window.getComputedStyle(settOv).display !== 'none') {
      return true;
    }

    const bodyHasMenuOpen = document.body.classList.contains('menu-open');
    if (bodyHasMenuOpen) {
      return true;
    }

    // ── ВРЕМЕННАЯ ДИАГНОСТИКА ────────────────────────────────────────────
    // isAnyMenuOpen() вернула false, хотя ожидался открытый профиль.
    // Логируем raw-состояние DOM, чтобы увидеть, что РЕАЛЬНО происходит
    // (не чаще раза в секунду, чтобы не заспамить консоль).
    if (!_lastMenuOpenDiagLog || performance.now() - _lastMenuOpenDiagLog > 1000) {
      _lastMenuOpenDiagLog = performance.now();
      const nameOv = document.getElementById('name-overlay');
      console.log('[gamepad-diag] isAnyMenuOpen=false. name-overlay:',
        nameOv ? {
          className: nameOv.className,
          hasOpenClass: nameOv.classList.contains('open'),
          computedDisplay: window.getComputedStyle(nameOv).display,
        } : 'ЭЛЕМЕНТ НЕ НАЙДЕН (getElementById вернул null)',
        'body.className:', document.body.className);
    }

    return false;
  }
  let _lastMenuOpenDiagLog = 0;

  // ── ПОИСК ЭЛЕМЕНТОВ ПОД КУРСОРОМ ────────────────────────────────────
  function findElementAtPosition(x, y) {
    const elements = document.elementsFromPoint(x, y);

    const clickableSelectors = [
      'button', '.ov-btn', '.menu-btn', '[role="button"]',
      '[onclick]', 'input[type="range"]', 'input[type="text"]',
      'input[type="number"]', 'a[href]'
    ];

    for (const el of elements) {
      for (const selector of clickableSelectors) {
        if (el.matches && el.matches(selector)) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            return el;
          }
        }
      }
    }

    return null;
  }

  function findNearestButton(x, y) {
    const btn = findElementAtPosition(x, y);
    if (btn) return btn;

    // ВАЖНО: этот запрос должен включать те же селекторы, что и
    // findElementAtPosition — иначе если курсор рядом с текстовым полем,
    // но не точно над ним (обычная ситуация, поле обычно уже курсора),
    // "ближайший элемент" никогда не найдёт сам input, и клавиатура
    // геймпада никогда не откроется, кроме как при попадании пиксель в
    // пиксель.
    const allButtons = document.querySelectorAll(
      'button, .ov-btn, .menu-btn, [role="button"], [onclick], ' +
      'input[type="range"], input[type="text"], input[type="number"], a[href]'
    );
    let nearest = null;
    let nearestDist = Infinity;

    for (const el of allButtons) {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = el;
        }
      } catch(e) {}
    }
    return nearest;
  }

  const SLIDER_STICK_SPEED = 1.6; // доля полного диапазона слайдера в секунду при полном отклонении стика

  // ── Двигает input[type=range] на delta (в долях полного диапазона,
  // -1..1), с округлением к ближайшему шагу (step) и диспатчем 'input',
  // как это делает браузер при реальном перетаскивании мышью. Ни .value=
  // напрямую, ни .click() сами по себе не заставляют слайдер визуально
  // обновиться и сообщить игре об изменении — только полноценное 'input'
  // событие (игра слушает именно его для live-обновления настроек).
  function adjustSlider(slider, delta) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const step = parseFloat(slider.step) || 1;
    const range = max - min;
    if (range <= 0) return;

    let value = parseFloat(slider.value) || min;
    value += delta * range;
    value = Math.round(value / step) * step;
    value = Math.max(min, Math.min(max, value));

    // Избегаем плавающей погрешности в отображаемом значении (0.30000000004)
    const decimals = (String(step).split('.')[1] || '').length;
    value = parseFloat(value.toFixed(decimals));

    if (value === parseFloat(slider.value)) return; // ничего не изменилось — не спамим событие
    slider.value = value;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickMenuButton() {
    const btn = findNearestButton(menuCursorX, menuCursorY);
    if (!btn) return;

    if (btn.tagName === 'INPUT' && btn.type === 'range') {
      // RT/A на слайдере — двигаем на один "видимый" шаг вправо (10% от
      // диапазона), а не пытаемся симулировать клик мышью (клик по
      // input[type=range] в браузере ничего не двигает — отсюда был баг
      // "не получается двигать ползунки с RT"). Основной способ регулировки
      // всё же левый стик при наведении (см. pollGamepad), это лишь на
      // случай короткого точечного нажатия.
      adjustSlider(btn, 0.1);
      return;
    }
    if (btn.tagName === 'INPUT' && (btn.type === 'text' || !btn.type)) {
      openVirtualKeyboard(btn);
      return;
    }

    btn.click();
    if (typeof btn.onclick === 'function') {
      btn.onclick();
    }
    // ВАЖНО: это и был настоящий недостающий путь для бага "додж
    // срабатывает при выходе из меню". Нажатие A на любую кнопку меню
    // (курсором геймпада) идёт именно через clickMenuButton — включая
    // кнопки, которые ЗАКРЫВАЮТ меню (например, "mob-settings-close" в
    // настройках). closeVirtualKeyboard() и pause-action уже ставили
    // блокировку ввода, а этот путь — самый обычный "нажал крестик
    // закрытия курсором" — её не ставил вовсе. Раз btn.click() мог только
    // что закрыть текущее меню, а A всё ещё физически зажата — на
    // следующем кадре именно это провоцировало додж.
    suppressInputBriefly(500);
  }

  // ── СБРОС СОСТОЯНИЯ КНОПОК ──────────────────────────────────────────
  // Отпускаем все синтетически зажатые клавиши мыши/клавиатуры — иначе,
  // например, если геймпад отключили посреди зажатого движения, "w" так
  // и останется висеть нажатым навечно с точки зрения игры.
  function resetButtonStates() {
    for (const key of heldMoveKeys) {
      dispatchKey('keyup', key);
    }
    heldMoveKeys.clear();
    if (attackHeld) {
      dispatchMouseButton('mouseup', lastAimClientX, lastAimClientY);
      attackHeld = false;
    }
    if (shieldHeld) {
      setGamepadShieldHeld(false);
    }
    if (isVirtualKeyboardOpen()) {
      closeVirtualKeyboard(false);
    }

    for (const key in CFG.buttons) {
      prevButtonState[key] = false;
    }
    prevButtonState['_menuRT'] = false;
    prevButtonState['_menuA'] = false;
    prevButtonState['_menuB'] = false;
    prevButtonState['_dpadUp'] = false;
    prevButtonState['_dpadDown'] = false;
    prevButtonState['_dpadLeft'] = false;
    prevButtonState['_dpadRight'] = false;
    prevButtonState['_kbUp'] = false;
    prevButtonState['_kbDown'] = false;
    prevButtonState['_kbLeft'] = false;
    prevButtonState['_kbRight'] = false;
    prevButtonState['_kbA'] = false;
    prevButtonState['_kbB'] = false;
    prevButtonState['_kbX'] = false;
    prevButtonState['_kbY'] = false;
  }

  // ── КЭШ ОРУЖИЯ ──────────────────────────────────────────────────────
  // Чтение P.weaponType/WEAPON_TYPES — это чтение состояния для решения
  // "как далеко тянуть прицел стиком", не запись и не вызов игровой
  // логики. Это провал безопасной границы "игра не знает о геймпаде" —
  // геймпад по-прежнему обязан ЗНАТЬ о игре, чтобы решить, куда целиться,
  // но не наоборот. Оставлено намеренно: без этого нельзя реализовать
  // "маленький радиус прицела для арбалета/жезла" иначе как угадыванием.
  let _cachedWeaponIsArbalest = false;
  let _cachedWeaponIsWand = false;

  function updateWeaponCache() {
    if (typeof P !== 'undefined' && P && typeof WEAPON_TYPES !== 'undefined') {
      const def = WEAPON_TYPES[P.weaponType];
      const key = def ? def.key : '';
      _cachedWeaponIsArbalest = key === 'crossbow';
      _cachedWeaponIsWand = key === 'wand';
    }
  }

  // ── ЗАГРУЗКА GAMEPADTABLE.TXT ──────────────────────────────────────
  async function loadGamepadTable() {
    try {
      const r = await fetch(GAMEPAD_TABLE_URL);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

      const parsed = {
        deadzoneMove: DEFAULT_CONFIG.deadzoneMove,
        deadzoneAim: DEFAULT_CONFIG.deadzoneAim,
        aimStickRadius: DEFAULT_CONFIG.aimStickRadius,
        axes: { move: { x: 0, y: 1 }, aim: { x: 2, y: 3 } },
        buttons: {}
      };

      const KNOWN_ACTIONS = new Set([
        'attack','dodge','swapWeapon','shield','shieldFlip','shieldType','swordStyle',
        'throwWeapon','spawnBot','musicToggle','pause'
      ]);

      for (const line of lines) {
        const p = line.split('|').map(s => s.trim());
        const key = p[0];
        if (key === 'AXIS_MOVE_X') { parsed.axes.move.x = parseInt(p[1], 10); continue; }
        if (key === 'AXIS_MOVE_Y') { parsed.axes.move.y = parseInt(p[1], 10); continue; }
        if (key === 'AXIS_AIM_X')  { parsed.axes.aim.x  = parseInt(p[1], 10); continue; }
        if (key === 'AXIS_AIM_Y')  { parsed.axes.aim.y  = parseInt(p[1], 10); continue; }
        if (key === 'DEADZONE_MOVE') { parsed.deadzoneMove = parseFloat(p[1]); continue; }
        if (key === 'DEADZONE_AIM')  { parsed.deadzoneAim  = parseFloat(p[1]); continue; }
        if (key === 'AIM_STICK_RADIUS') { parsed.aimStickRadius = parseFloat(p[1]); continue; }

        if (KNOWN_ACTIONS.has(key)) {
          const index = parseInt(p[1], 10);
          const type = p[2] || undefined;
          if (!isNaN(index)) {
            parsed.buttons[key] = { index, type, action: key };
          }
        }
      }

      if (!parsed.buttons.shield && parsed.buttons.shieldFlip && parsed.buttons.shieldFlip.index === 6) {
        parsed.buttons.shield = { index: 6, type: parsed.buttons.shieldFlip.type || 'trigger', action: 'shield' };
        delete parsed.buttons.shieldFlip;
      }

      if (Object.keys(parsed.buttons).length) {
        CFG = parsed;
        console.log('✔ GamepadTable.txt загружен');
      }
    } catch (e) {
      CFG = DEFAULT_CONFIG;
      console.warn('⚠ GamepadTable.txt недоступен');
    }
  }

  // ── ДЕЙСТВИЯ ──────────────────────────────────────────────────────────
  // Каждое действие либо: (а) шлёт ту же клавишу, что игрок нажал бы сам,
  // либо (б) вызывает официальный window.* публичный метод игры.
  const ACTIONS = {
    swapWeapon()  { if (!isAnyMenuOpen()) tapKey(HOTKEY_ACTIONS.swapWeapon); },
    shieldFlip()  { if (!isAnyMenuOpen()) tapKey(HOTKEY_ACTIONS.shieldFlip); },
    shieldType()  { if (!isAnyMenuOpen()) tapKey(HOTKEY_ACTIONS.shieldType); },
    swordStyle()  { if (!isAnyMenuOpen()) tapKey(HOTKEY_ACTIONS.swordStyle); },
    throwWeapon() { if (!isAnyMenuOpen()) tapKey(HOTKEY_ACTIONS.throwWeapon); },
    dodge()       { if (!isAnyMenuOpen()) PUBLIC_API_ACTIONS.dodge(); },
    spawnBot()    { if (!isAnyMenuOpen()) PUBLIC_API_ACTIONS.spawnBot(); },
    musicToggle() { if (!isAnyMenuOpen()) PUBLIC_API_ACTIONS.musicToggle(); },
    pause() {
      if (isAnyMenuOpen()) {
        const settingsOv = document.getElementById('mob-settings-overlay');
        if (settingsOv && settingsOv.style.display !== 'none') {
          settingsOv.style.display = 'none';
          showMenuCursor(true);
          return;
        }

        const resumeBtn = document.querySelector('#mob-resume, [onclick*="Resume"], [id*="resume"]');
        if (resumeBtn) {
          resumeBtn.click();
        } else if (typeof window.doResume === 'function') {
          window.doResume();
        }
        showMenuCursor(false);
        resetButtonStates();
        suppressInputBriefly(500);
        return;
      }

      const menuBtn = document.getElementById('mob-menu-btn');
      if (menuBtn) {
        menuBtn.click();
      } else if (typeof window.doOpenMenu === 'function') {
        window.doOpenMenu();
      }

      setTimeout(() => {
        showMenuCursor(true);
        updateMenuCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
      }, 100);
    },
    attack() {}, // обрабатывается отдельно как удержание (mousedown/mouseup), см. pollGamepad
  };

  // ── ПОДКЛЮЧЕНИЕ ГЕЙМПАДА ──────────────────────────────────────────────
  window.addEventListener('gamepadconnected', (e) => {
    console.log('[gamepad] подключен:', e.gamepad.id);
    gpIndex = e.gamepad.index;
    // ВАЖНО: раньше здесь не было hideGamepadHint() — если геймпад
    // обнаруживался именно через это событие (а не через
    // detectAlreadyConnectedGamepad), баннер "нажмите любую кнопку"
    // оставался висеть навсегда, даже когда gpIndex уже был корректно
    // установлен и курсор технически уже работал.
    hideGamepadHint();
  });

  window.addEventListener('gamepaddisconnected', (e) => {
    console.log('[gamepad] отключен:', e.gamepad.id);
    if (gpIndex === e.gamepad.index) {
      gpIndex = null;
      // Цикл pollGamepad НЕ останавливаем — он продолжает работать вхолостую
      // (выход по `if (gpIndex === null) return` в начале), чтобы при
      // повторном подключении геймпада всё снова заработало само, без
      // необходимости в дополнительном событии или перезагрузке страницы.
      resetButtonStates();
      if (menuCursor) menuCursor.style.display = 'none';
    }
  });

  function applyDeadzone(v, dz) {
    return Math.abs(v) < dz ? 0 : v;
  }

  // ── ПОСЛЕДНЯЯ ПОЗИЦИЯ ПРИЦЕЛА (для resetButtonStates/mouseup) ──────────
  let lastAimClientX = window.innerWidth / 2;
  let lastAimClientY = window.innerHeight / 2;
  let attackHeld = false;
  let shieldHeld = false;
  let _lastPollT = performance.now();
  let _menuStickSmoothX = 0, _menuStickSmoothY = 0;

  function setGamepadShieldHeld(held) {
    shieldHeld = held;
    if (typeof P === 'undefined') return;
    if (!held) {
      P._shieldHeld = false;
      return;
    }
    const exhausted = typeof isExhausted === 'function' && isExhausted(P);
    if (!isAnyMenuOpen() && P.shield > 0 && !exhausted && P.stamina > 0) {
      P._shieldHeld = true;
    }
  }

  // ── ОСНОВНОЙ ЦИКЛ ─────────────────────────────────────────────────────
  function pollGamepad() {
    rafId = requestAnimationFrame(pollGamepad);
    if (gpIndex === null) return;

    const nowT = performance.now();
    const dt_menu = Math.min(0.05, (nowT - _lastPollT) / 1000); // сек, capped на случай лагов вкладки
    _lastPollT = nowT;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[gpIndex];
    if (!gp) return;

    const menuOpen = isAnyMenuOpen();
    if (menuOpen && shieldHeld) setGamepadShieldHeld(false);

    // ── РЕЖИМ ВИРТУАЛЬНОЙ КЛАВИАТУРЫ ─────────────────────────────────────
    // Отдельная ветка: пока клавиатура открыта, геймпад полностью
    // переключается на навигацию по её сетке символов, а не по обычному
    // курсору меню — иначе стик одновременно двигал бы и курсор, и буквы.
    if (isVirtualKeyboardOpen()) {
      const dpadUp = gp.buttons[12], dpadDown = gp.buttons[13];
      const dpadLeft = gp.buttons[14], dpadRight = gp.buttons[15];
      const axMoveKb = CFG.axes.move;
      const kbAX = applyDeadzone(gp.axes[axMoveKb.x] ?? 0, CFG.deadzoneMove);
      const kbAY = applyDeadzone(gp.axes[axMoveKb.y] ?? 0, CFG.deadzoneMove);

      const upPressed    = (dpadUp && (dpadUp.pressed || dpadUp.value > 0.5)) || kbAY < -0.5;
      const downPressed  = (dpadDown && (dpadDown.pressed || dpadDown.value > 0.5)) || kbAY > 0.5;
      const leftPressed  = (dpadLeft && (dpadLeft.pressed || dpadLeft.value > 0.5)) || kbAX < -0.5;
      const rightPressed = (dpadRight && (dpadRight.pressed || dpadRight.value > 0.5)) || kbAX > 0.5;

      if (upPressed && !prevButtonState['_kbUp'])       kbMoveCursor(-1, 0);
      if (downPressed && !prevButtonState['_kbDown'])   kbMoveCursor(1, 0);
      if (leftPressed && !prevButtonState['_kbLeft'])   kbMoveCursor(0, -1);
      if (rightPressed && !prevButtonState['_kbRight']) kbMoveCursor(0, 1);
      prevButtonState['_kbUp'] = upPressed;
      prevButtonState['_kbDown'] = downPressed;
      prevButtonState['_kbLeft'] = leftPressed;
      prevButtonState['_kbRight'] = rightPressed;

      const aBtn = gp.buttons[0], bBtn = gp.buttons[1];
      const xBtn = gp.buttons[2], yBtn = gp.buttons[3];
      const aPressed = aBtn && aBtn.pressed, bPressed = bBtn && bBtn.pressed;
      const xPressed = xBtn && xBtn.pressed, yPressed = yBtn && yBtn.pressed;

      if (aPressed && !prevButtonState['_kbA']) { kbConfirmCell(); activateAudio(); }
      if (bPressed && !prevButtonState['_kbB']) { closeVirtualKeyboard(false); }
      if (xPressed && !prevButtonState['_kbX'] && kbTargetInput) { backspaceInput(kbTargetInput); updateKbPreview(); }
      if (yPressed && !prevButtonState['_kbY'] && kbTargetInput) { insertIntoInput(kbTargetInput, ' '); updateKbPreview(); }
      prevButtonState['_kbA'] = aPressed;
      prevButtonState['_kbB'] = bPressed;
      prevButtonState['_kbX'] = xPressed;
      prevButtonState['_kbY'] = yPressed;
      // ВАЖНО (тот же баг, что и в ветке меню ниже): A физически замаплена
      // на dodge в бою. kbConfirmCell() на "ГОТОВО" может закрыть и
      // клавиатуру, и весь профиль ОДНИМ И ТЕМ ЖЕ нажатием A — если
      // следующий кадр застаёт A всё ещё физически зажатой, а боевой блок
      // кнопок не обновлял своё prevButtonState всё время, пока мы были
      // здесь — додж срабатывает как "новое" нажатие сразу при выходе.
      const rtBtnKb = gp.buttons[7];
      const rtPressedKb = rtBtnKb && (rtBtnKb.pressed || rtBtnKb.value > 0.5);
      for (const key in CFG.buttons) {
        if (CFG.buttons[key].index === 0) prevButtonState[key] = aPressed;
        if (CFG.buttons[key].index === 7) prevButtonState[key] = rtPressedKb;
      }

      return;
    }

    if (menuOpen) {
      showMenuCursor(true);

      const axAim = CFG.axes.aim;
      const rawAX = gp.axes[axAim.x] ?? 0;
      const rawAY = gp.axes[axAim.y] ?? 0;
      const rawDist = Math.hypot(rawAX, rawAY);

      // Сглаживание: копим "сырое" желаемое направление стика и плавно
      // подтягиваем к нему сглаженное значение экспоненциальным затуханием,
      // а не применяем rawAX/rawAY напрямую — резкие покачивания стика
      // (особенно на дешёвых геймпадах с дрожащими осями) больше не дают
      // курсору дёргаться. MENU_CURSOR_SPEED снижена почти вдвое от
      // прежней (10+rawDist*8 → 6+rawDist*4) по просьбе — курсором стало
      // проще целиться в мелкие элементы меню.
      const smoothRate = 1 - Math.pow(0.001, dt_menu); // ~14 кадров до 95% схождения при 60fps
      _menuStickSmoothX += (rawAX - _menuStickSmoothX) * smoothRate;
      _menuStickSmoothY += (rawAY - _menuStickSmoothY) * smoothRate;

      if (rawDist > 0.15) {
        const MENU_CURSOR_SPEED = 6 + rawDist * 4;
        updateMenuCursorPosition(
          menuCursorX + _menuStickSmoothX * MENU_CURSOR_SPEED,
          menuCursorY + _menuStickSmoothY * MENU_CURSOR_SPEED
        );
      }

      // ── ЛЕВЫЙ СТИК: если курсор наведён на слайдер (input[type=range]) —
      // двигает его значение, а не курсор (правый стик всегда свободен для
      // курсора, конфликта нет). Влево/вправо по оси X левого стика.
      const axMoveMenu = CFG.axes.move;
      const moveAX = applyDeadzone(gp.axes[axMoveMenu.x] ?? 0, CFG.deadzoneMove);
      const moveAY = applyDeadzone(gp.axes[axMoveMenu.y] ?? 0, CFG.deadzoneMove);
      const settingsEmbed = document.getElementById('mob-settings-embed');
      const settingsOverlay = document.getElementById('mob-settings-overlay');
      if (moveAY !== 0 && settingsEmbed && settingsOverlay && window.getComputedStyle(settingsOverlay).display !== 'none') {
        settingsEmbed.scrollTop += moveAY * dt_menu * 900;
      }
      if (moveAX !== 0 && hoveredElement && hoveredElement.tagName === 'INPUT' && hoveredElement.type === 'range') {
        adjustSlider(hoveredElement, moveAX * dt_menu * SLIDER_STICK_SPEED);
      }

      const dpadUp = gp.buttons[12];
      const dpadDown = gp.buttons[13];
      const dpadLeft = gp.buttons[14];
      const dpadRight = gp.buttons[15];

      if (dpadUp && (dpadUp.pressed || dpadUp.value > 0.5) && !prevButtonState['_dpadUp']) {
        updateMenuCursorPosition(menuCursorX, menuCursorY - 40);
        prevButtonState['_dpadUp'] = true;
      }
      if (!dpadUp || (!dpadUp.pressed && dpadUp.value <= 0.5)) {
        prevButtonState['_dpadUp'] = false;
      }

      if (dpadDown && (dpadDown.pressed || dpadDown.value > 0.5) && !prevButtonState['_dpadDown']) {
        updateMenuCursorPosition(menuCursorX, menuCursorY + 40);
        prevButtonState['_dpadDown'] = true;
      }
      if (!dpadDown || (!dpadDown.pressed && dpadDown.value <= 0.5)) {
        prevButtonState['_dpadDown'] = false;
      }

      if (dpadLeft && (dpadLeft.pressed || dpadLeft.value > 0.5) && !prevButtonState['_dpadLeft']) {
        updateMenuCursorPosition(menuCursorX - 40, menuCursorY);
        prevButtonState['_dpadLeft'] = true;
      }
      if (!dpadLeft || (!dpadLeft.pressed && dpadLeft.value <= 0.5)) {
        prevButtonState['_dpadLeft'] = false;
      }

      if (dpadRight && (dpadRight.pressed || dpadRight.value > 0.5) && !prevButtonState['_dpadRight']) {
        updateMenuCursorPosition(menuCursorX + 40, menuCursorY);
        prevButtonState['_dpadRight'] = true;
      }
      if (!dpadRight || (!dpadRight.pressed && dpadRight.value <= 0.5)) {
        prevButtonState['_dpadRight'] = false;
      }

      const rt = gp.buttons[7];
      const aBtn = gp.buttons[0];
      const rtPressed = rt && (rt.pressed || rt.value > 0.5);
      const aPressed = aBtn && (aBtn.pressed || aBtn.value > 0.5);

      if ((rtPressed && !prevButtonState['_menuRT']) || (aPressed && !prevButtonState['_menuA'])) {
        clickMenuButton();
        activateAudio();
      }
      prevButtonState['_menuRT'] = rtPressed;
      prevButtonState['_menuA'] = aPressed;
      // ВАЖНО: кнопка A (физический индекс 0) в бою замаплена на dodge —
      // но пока мы внутри этой ветки (меню открыто), боевой блок кнопок
      // ниже по файлу вообще не выполняется, а значит его собственное
      // prevButtonState для dodge не обновляется. Если меню закроется
      // ПОСРЕДИ удержания A (например, тем же нажатием, что закрыло
      // клавиатуру через "ГОТОВО"), следующий кадр видит A всё ещё
      // зажатой, но "старое" (не обновлённое) состояние dodge — и
      // засчитывает это как новое нажатие → додж срабатывает сам,
      // хотя пользователь просто вышел из меню. Синхронизируем состояние
      // явно, чтобы кнопки, замапленные на физический индекс 0/7 в CFG,
      // не путали "уже обрабатывали в меню" с "видим кнопку впервые".
      for (const key in CFG.buttons) {
        if (CFG.buttons[key].index === 0) prevButtonState[key] = aPressed;
        if (CFG.buttons[key].index === 7) prevButtonState[key] = rtPressed;
      }

      const bBtn = gp.buttons[1];
      if (bBtn && bBtn.pressed && !prevButtonState['_menuB']) {
        // Синхронизация состояния для B (индекс 1) по той же причине, что
        // и для A/RT выше — иначе выход из меню через B тоже может
        // спровоцировать фантомное срабатывание действия, замапленного
        // на индекс 1 (spawnBot), в первом кадре обычной игры.
        for (const key in CFG.buttons) {
          if (CFG.buttons[key].index === 1) prevButtonState[key] = true;
        }
        const settingsOv = document.getElementById('mob-settings-overlay');
        if (settingsOv && settingsOv.style.display !== 'none') {
          settingsOv.style.display = 'none';
          showMenuCursor(true);
          prevButtonState['_menuB'] = true;
          return;
        }

        const resumeBtn = document.querySelector('#mob-resume, [onclick*="Resume"], [id*="resume"]');
        if (resumeBtn) {
          resumeBtn.click();
        } else if (typeof window.doResume === 'function') {
          window.doResume();
        }
        showMenuCursor(false);
        resetButtonStates();
        suppressInputBriefly(500);
      }
      prevButtonState['_menuB'] = bBtn && bBtn.pressed;

      return;
    } else if (isMenuOpen) {
      showMenuCursor(false);
      resetButtonStates();
    }

    // ── ДВИЖЕНИЕ: synthetic keydown/keyup вместо прямой записи в keys{} ──
    const axMove = CFG.axes.move;
    const mvX = applyDeadzone(gp.axes[axMove.x] ?? 0, CFG.deadzoneMove);
    const mvY = applyDeadzone(gp.axes[axMove.y] ?? 0, CFG.deadzoneMove);
    setHeldKey('w', mvY < -0.35, heldMoveKeys);
    setHeldKey('s', mvY >  0.35, heldMoveKeys);
    setHeldKey('a', mvX < -0.35, heldMoveKeys);
    setHeldKey('d', mvX >  0.35, heldMoveKeys);

    // ── ПРИЦЕЛ: synthetic mousemove вместо прямой записи в mX/mY ─────────
    const axAim = CFG.axes.aim;
    const rawAX = gp.axes[axAim.x] ?? 0;
    const rawAY = gp.axes[axAim.y] ?? 0;
    const rawDist = Math.hypot(rawAX, rawAY);

    updateWeaponCache();

    if (rawDist > CFG.deadzoneAim) {
      const canvas = getCanvas();
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        // Целимся от центра канваса — radiusMultiplier подобран так же,
        // как в прежней версии: у ближнего боя большой радиус (курсор
        // далеко от игрока = более предсказуемый угол замаха), у
        // арбалета/жезла — маленький (точное прицеливание важнее).
        let radiusMultiplier = 40;
        if (_cachedWeaponIsArbalest || _cachedWeaponIsWand) {
          radiusMultiplier = 4;
        }
        // Угол берём НАПРЯМУЮ от стика, без сглаживания — раньше здесь было
        // экспоненциальное сглаживание "от дрожи осей", но по факту оно
        // подтягивало угол только на ~6% за кадр, что давало заметную
        // задержку/инерцию (~0.5 сек до полного поворота) — ощущалось как
        // "прицел крутится медленнее, чем мышкой". В бою мгновенная реакция
        // важнее лёгкого дрожания дешёвых стиков.
        const angle = Math.atan2(rawAY, rawAX);

        const r = CFG.aimStickRadius * radiusMultiplier;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        lastAimClientX = cx + Math.cos(angle) * (r + 40);
        lastAimClientY = cy + Math.sin(angle) * (r + 40);
        dispatchMouseMove(lastAimClientX, lastAimClientY);
      }
    }
    // Если стик в нейтрали — просто не шлём mousemove. Прицел остаётся
    // там, где был (как и с настоящей мышью — она тоже не "сбрасывается",
    // если её отпустили). Никакого "владения" мышью навсегда блокировать
    // не нужно: реальное движение настоящей мыши просто пришлёт СВОЙ
    // mousemove позже и естественно возьмёт управление прицелом на себя,
    // потому что игра слушает mousemove от кого угодно одинаково — именно
    // отсутствие такого "залипающего" флага и чинит старый баг с тем, что
    // прицел геймпада переставал появляться после одного клика мышью.

    // ── КНОПКИ ──────────────────────────────────────────────────────────
    const inputSuppressed = performance.now() < _inputSuppressedUntil;
    for (const key in CFG.buttons) {
      const def = CFG.buttons[key];
      const btn = gp.buttons[def.index];
      if (!btn) continue;
      const pressed = btn.pressed || btn.value > 0.5;
      const wasPressed = !!prevButtonState[key];

      if (def.type === 'trigger' && def.action === 'shield' && !pressed && shieldHeld) {
        setGamepadShieldHeld(false);
      }
      if (def.action === 'dodge' && !pressed && dodgeHeld) {
        dodgeHeld = false;
        if (window.endDodgePress) window.endDodgePress('GamepadDodge');
      }

      if (!inputSuppressed) {
        if (def.type === 'trigger') {
          if (def.action === 'attack') {
            if (pressed && !wasPressed) {
              dispatchMouseButton('mousedown', lastAimClientX, lastAimClientY);
              attackHeld = true;
              activateAudio();
            } else if (!pressed && wasPressed) {
              dispatchMouseButton('mouseup', lastAimClientX, lastAimClientY);
              attackHeld = false;
            }
          } else if (def.action === 'shield') {
            if (pressed !== wasPressed) {
              setGamepadShieldHeld(pressed);
              if (pressed) activateAudio();
            } else if (pressed && shieldHeld) {
              setGamepadShieldHeld(true);
            }
          } else if (pressed && !wasPressed) {
            ACTIONS[def.action] && ACTIONS[def.action]();
            activateAudio();
          }
        } else if (def.action === 'dodge') {
          if (pressed && !wasPressed) {
            dodgeHeld = true;
            ACTIONS[def.action] && ACTIONS[def.action]();
            activateAudio();
          }
        } else if (pressed && !wasPressed) {
          ACTIONS[def.action] && ACTIONS[def.action]();
          activateAudio();
        }
      }
      // prevButtonState обновляем ВСЕГДА, даже во время блокировки — иначе
      // как только блокировка снимется, ещё зажатая с момента выхода из
      // меню кнопка снова будет прочитана как "новое" нажатие и та же
      // проблема повторится, просто с задержкой в 500мс вместо нуля.
      prevButtonState[key] = pressed;
    }
  }

  function startPolling() {
    if (rafId !== null) return;
    pollGamepad();
  }

  function stopPolling() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  // ── НАБЛЮДАТЕЛЬ ЗА МЕНЮ ─────────────────────────────────────────────
  // ВАЖНО: subtree:true обязателен. Некоторые overlay (например,
  // #mob-settings-overlay — настройки/профиль) переключаются через
  // style.display на САМОМ элементе, не трогая document.body вообще
  // (нет class="menu-open"). Без subtree наблюдатель, следящий только за
  // document.body, такие переключения не увидит.
  //
  // ВАЖНО #2: pollGamepad САМ каждый кадр вызывает showMenuCursor(true)
  // пока меню открыто, и showMenuCursor(false), когда закрыто (см. ветки
  // ниже в основном цикле) — это первичный, всегда актуальный источник
  // истины. Раньше этот наблюдатель ТОЖЕ вызывал showMenuCursor(false) —
  // и поскольку subtree:true реагирует на АБСОЛЮТНО любые изменения
  // style/class внутри body (включая наши же: позиция курсора каждый
  // кадр, hover-подсветка на реальных элементах игры типа nameInput),
  // получалась гонка 60 раз в секунду между pollGamepad (показывает) и
  // наблюдателем (иногда синхронно прячет) — курсор либо не появлялся
  // вовсе, либо появлялся и тут же гас. "Помогало" нажатие B только
  // потому, что где-то ещё раз форсированно вызывался showMenuCursor(true)
  // и на мгновение выигрывал эту гонку.
  //
  // Теперь наблюдатель НИКОГДА не прячет курсор — это исключительно
  // обязанность pollGamepad. Единственная оставшаяся задача наблюдателя —
  // подстраховка на случай, если меню открылось/закрылось между кадрами
  // до того, как gpIndex был определён (см. detectAlreadyConnectedGamepad),
  // и то — теперь безопасно с задержкой, без конкуренции за скрытие.
  function setupMenuObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const open = isAnyMenuOpen();
        if (open && gpIndex !== null && !wasMenuOpenLastCheck) {
          showMenuCursor(true);
          updateMenuCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
        }
        wasMenuOpenLastCheck = open;
      }, 50);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      subtree: true,
    });
  }
  let wasMenuOpenLastCheck = false;

  // ── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────
  createMenuCursor();
  setupMenuObserver();

  loadGamepadTable();

  // ── ОБНАРУЖЕНИЕ УЖЕ ПОДКЛЮЧЁННОГО ГЕЙМПАДА ────────────────────────────
  // Основной механизм — setInterval-опрос выше (см. _gpDetectInterval),
  // который работает гарантированно вне зависимости от того, через какое
  // именно событие браузер решит "открыть" доступ к геймпаду. Слушатели
  // ниже — дополнительная подстраховка, чтобы событие подхватывалось
  // мгновенно, если оно всё-таки приходит, не дожидаясь следующего тика
  // интервала (макс. 300мс).
  detectAlreadyConnectedGamepad();

  ['pointerdown', 'keydown', 'mousedown', 'touchstart', 'mousemove'].forEach(evtType => {
    document.addEventListener(evtType, detectAlreadyConnectedGamepad, { once: false, passive: true });
  });

  // ── ЦИКЛ ОПРОСА ЗАПУСКАЕТСЯ СРАЗУ, НЕЗАВИСИМО ОТ ОБНАРУЖЕНИЯ ГЕЙМПАДА ──
  // Раньше requestAnimationFrame-цикл (pollGamepad) стартовал только ПОСЛЕ
  // события 'gamepadconnected' или 'load' — то есть курсор геймпада, ползунки
  // и виртуальная клавиатура не работали до этого момента, пока что-то
  // (например, нажатие B) не провоцировало браузер прислать событие
  // подключения с опозданием. Теперь цикл работает всегда — pollGamepad
  // просто ничего не делает, пока gpIndex не найден.
  startPolling();

  window.addEventListener('load', () => {
    detectAlreadyConnectedGamepad();
    setTimeout(updateWeaponCache, 500);

    console.log('[gamepad] ГОТОВ! Нажми START (кнопка ☰) для меню');
  });

  window.GAMEPAD_CTRL = {
    reloadConfig: loadGamepadTable,
    getConfig: () => CFG,
  };

// Полная блокировка ПКМ на всём документе
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}, false);

// Также блокируем событие mousedown (ПКМ), чтобы предотвратить любые действия
document.addEventListener('mousedown', function(e) {
    if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}, false);

})();
