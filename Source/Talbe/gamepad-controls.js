// ═══════════════════════════════════════════════════════════════════════
// MODULE: GAMEPAD CONTROLS
// Подключает геймпад (Xbox/PS/Standard Gamepad API) поверх существующего
// управления. Работает параллельно с клавиатурой/тачем — просто выставляет
// те же переменные/вызывает те же функции, что уже использует игра:
//   keys['w'|'a'|'s'|'d'], mX, mY, mDown, toggleSwordStyle(), P._shieldFlipped,
//   setWeapon(P,next), throwWeapon(P), doDodge(), toggleZone(), toggleMusic(),
//   doOpenMenu()/doResume(), toggleAI() (спавн бота)
//
// Раскладка грузится с сервера из GamepadTable.txt — лежит в том же месте,
// что и WeaponTalbe.txt (PROJECT_PATH_AUDIO + "Source/Talbe/"), в том же
// стиле "|"-разделённого текста. Если файл недоступен — используется
// встроенный дефолт ниже, игра не ломается.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Тот же базовый путь, что использует loadWeaponTable() в игре.
  // Если PROJECT_PATH_AUDIO ещё не объявлена на момент запуска скрипта —
  // подставляем тот же URL вручную как фолбэк.
  const BASE_PATH = (typeof PROJECT_PATH_AUDIO !== 'undefined')
    ? PROJECT_PATH_AUDIO
    : "https://raw.githubusercontent.com/JackofShadow666/GodgraveAssets/main/";
  const GAMEPAD_TABLE_URL = BASE_PATH + "Source/Talbe/GamepadTable.txt";

  const DEFAULT_CONFIG = {
    deadzoneMove: 0.18,
    deadzoneAim: 0.22,
    aimStickRadius: 60,
    axes: { move: { x: 0, y: 1 }, aim: { x: 2, y: 3 } },
    buttons: {
      attack:      { index: 7, type: 'trigger', action: 'attack' },
      dodge:       { index: 6, type: 'trigger', action: 'dodge' },
      swapWeapon:  { index: 0, action: 'swapWeapon' },
      shieldFlip:  { index: 1, action: 'shieldFlip' },
      swordStyle:  { index: 2, action: 'swordStyle' },
      throwWeapon: { index: 3, action: 'throwWeapon' },
      zoneToggle:  { index: 4, action: 'zoneToggle' },
      spawnBot:    { index: 5, action: 'spawnBot' },
      musicToggle: { index: 8, action: 'musicToggle' },
      pause:       { index: 9, action: 'pause' }
    }
  };

  let CFG = DEFAULT_CONFIG;
  let gpIndex = null;
  let rafId = null;
  let prevButtonState = {};

  // ── Загрузка и парсинг GamepadTable.txt (формат как WeaponTalbe.txt) ────
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
        'attack','dodge','swapWeapon','shieldFlip','swordStyle',
        'throwWeapon','zoneToggle','spawnBot','musicToggle','pause'
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

      if (Object.keys(parsed.buttons).length) {
        CFG = parsed;
        console.log('✔ GamepadTable.txt загружен, кнопок настроено:', Object.keys(parsed.buttons).length);
      } else {
        console.warn('⚠ GamepadTable.txt пуст или не распознан — используется встроенная раскладка геймпада');
      }
    } catch (e) {
      CFG = DEFAULT_CONFIG;
      console.warn('⚠ GamepadTable.txt недоступен, используется встроенная раскладка геймпада:', e.message);
    }
  }

  // ── Действия (дергают существующие функции игры) ────────────────────────
  const ACTIONS = {
    swapWeapon() {
      if (typeof P !== 'undefined' && typeof setWeapon === 'function' && P.hasWeapon !== false) {
        const next = (P.weaponType + 1) % WEAPON_TYPES.length;
        setWeapon(P, next);
      }
    },
    shieldFlip() {
      if (typeof P !== 'undefined') P._shieldFlipped = !P._shieldFlipped;
    },
    swordStyle() {
      if (typeof window.toggleSwordStyle === 'function') window.toggleSwordStyle();
    },
    throwWeapon() {
      if (typeof P !== 'undefined' && typeof throwWeapon === 'function') throwWeapon(P);
    },
    dodge() {
      if (typeof doDodge === 'function') doDodge();
    },
    zoneToggle() {
      if (typeof toggleZone === 'function') toggleZone();
    },
    spawnBot() {
      if (typeof toggleAI === 'function') toggleAI();
    },
    musicToggle() {
      if (typeof toggleMusic === 'function') toggleMusic();
    },
    pause() {
      const menuOpen = document.body.classList.contains('menu-open');
      if (menuOpen) {
        if (typeof window.doResume === 'function') window.doResume();
      } else {
        if (typeof window.doOpenMenu === 'function') window.doOpenMenu();
      }
    },
    attack() {
      // обрабатывается как held-state в pollGamepad(), не одиночное нажатие
    }
  };

  // ── Подключение/отключение геймпада ──────────────────────────────────────
  window.addEventListener('gamepadconnected', (e) => {
    console.log('[gamepad] подключен:', e.gamepad.id);
    gpIndex = e.gamepad.index;
    startPolling();
  });

  window.addEventListener('gamepaddisconnected', (e) => {
    console.log('[gamepad] отключен:', e.gamepad.id);
    if (gpIndex === e.gamepad.index) {
      gpIndex = null;
      stopPolling();
      resetInputState();
    }
  });

  function resetInputState() {
    if (typeof keys !== 'undefined') { keys['w']=keys['a']=keys['s']=keys['d']=false; }
    if (typeof window.mDown !== 'undefined') mDown = false;
    prevButtonState = {};
  }

  function applyDeadzone(v, dz) {
    return Math.abs(v) < dz ? 0 : v;
  }

  // ── Основной цикл опроса ─────────────────────────────────────────────────
  function pollGamepad() {
    rafId = requestAnimationFrame(pollGamepad);
    if (gpIndex === null) return;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[gpIndex];
    if (!gp) return;

    // ── Движение (левый стик → keys w/a/s/d) ──────────────────────────────
    const axMove = CFG.axes.move;
    const mvX = applyDeadzone(gp.axes[axMove.x] ?? 0, CFG.deadzoneMove);
    const mvY = applyDeadzone(gp.axes[axMove.y] ?? 0, CFG.deadzoneMove);
    if (typeof keys !== 'undefined') {
      keys['w'] = mvY < -0.35;
      keys['s'] = mvY >  0.35;
      keys['a'] = mvX < -0.35;
      keys['d'] = mvX >  0.35;
    }

    // ── Прицел (правый стик → mX/mY вокруг игрока) ────────────────────────
    const axAim = CFG.axes.aim;
    const amX = applyDeadzone(gp.axes[axAim.x] ?? 0, CFG.deadzoneAim);
    const amY = applyDeadzone(gp.axes[axAim.y] ?? 0, CFG.deadzoneAim);
    if (amX !== 0 || amY !== 0) {
      if (typeof P !== 'undefined' && typeof rootCenter === 'function') {
        const rc = rootCenter();
        const dist = Math.min(Math.hypot(amX, amY), 1);
        const angle = Math.atan2(amY, amX);
        const r = CFG.aimStickRadius * dist * 4;
        window.mX = rc.x + Math.cos(angle) * (r + 40);
        window.mY = rc.y + Math.sin(angle) * (r + 40);
      }
    }

    // ── Кнопки ─────────────────────────────────────────────────────────
    for (const key in CFG.buttons) {
      const def = CFG.buttons[key];
      const btn = gp.buttons[def.index];
      if (!btn) continue;
      const pressed = btn.pressed || btn.value > 0.5;
      const wasPressed = !!prevButtonState[key];

      if (def.type === 'trigger') {
        if (def.action === 'attack') {
          if (typeof window.mDown !== 'undefined') mDown = pressed;
        } else if (pressed && !wasPressed) {
          ACTIONS[def.action] && ACTIONS[def.action]();
        }
      } else if (pressed && !wasPressed) {
        ACTIONS[def.action] && ACTIONS[def.action]();
      }
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

  // ── Инициализация ────────────────────────────────────────────────────
  loadGamepadTable();

  window.addEventListener('load', () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (gp) { gpIndex = gp.index; startPolling(); break; }
    }
  });

  window.GAMEPAD_CTRL = { reloadConfig: loadGamepadTable, getConfig: () => CFG };

})();
