// ═══════════════════════════════════════════════════════════════════════
// MODULE: GAMEPAD CONTROLS
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

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
      attack:      { index: 7,  type: 'trigger', action: 'attack' },
      shieldFlip:  { index: 6,  type: 'trigger', action: 'shieldFlip' },
      dodge:       { index: 0,  action: 'dodge' },
      spawnBot:    { index: 1,  action: 'spawnBot' },
      musicToggle: { index: 2,  action: 'musicToggle' },
      throwWeapon: { index: 4,  action: 'throwWeapon' },
      pause:       { index: 9,  action: 'pause' },
      dpadUp:      { index: 12, action: 'swordStyle' },
      dpadDown:    { index: 13, action: 'zoneToggle' },
      dpadLeft:    { index: 14, action: 'swapWeapon' },
      dpadRight:   { index: 15, action: 'shieldType' }
    }
  };

  let CFG = DEFAULT_CONFIG;
  let gpIndex = null;
  let rafId = null;
  let prevButtonState = {};
  window.__gamepadAimActive = false;
  window.__mouseLocked = true;
  let isMenuOpen = false;
  let audioActivated = false;
  let _mouseLockedValue = true;

  // ── АКТИВАЦИЯ ЗВУКА ПРИ ПЕРВОМ НАЖАТИИ КНОПКИ ГЕЙМПАДА ──────────────
  function activateAudio() {
    if (audioActivated) return;
    audioActivated = true;
    if (typeof enableAudioSystem === 'function') {
      enableAudioSystem();
      console.log('[gamepad] звук активирован через геймпад');
    } else {
      const evt = new MouseEvent('mousedown', { bubbles: true });
      document.dispatchEvent(evt);
      console.log('[gamepad] звук активирован (имитация клика)');
    }
  }

  // ── ПРЯМОЕ УПРАВЛЕНИЕ КУРСОРОМ ──────────────────────────────────────
  function setCursorVisible(visible) {
    const canvas = document.getElementById('canvas') || document.querySelector('canvas');
    
    if (visible) {
      document.body.style.cursor = 'default';
      document.documentElement.style.cursor = 'default';
      if (canvas) canvas.style.cursor = 'default';
    } else {
      document.body.style.cursor = 'none';
      document.documentElement.style.cursor = 'none';
      if (canvas) canvas.style.cursor = 'none';
    }
  }

  // ── КУРСОР ДЛЯ ГЕЙМПАДА В МЕНЮ ──────────────────────────────────────
  let menuCursor = null;
  let menuCursorX = window.innerWidth / 2;
  let menuCursorY = window.innerHeight / 2;
  let hoveredElement = null;

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
      background: transparent !important;
    `;
    
    const cursorCanvas = document.createElement('canvas');
    cursorCanvas.width = 40;
    cursorCanvas.height = 40;
    cursorCanvas.style.cssText = 'background: transparent !important; pointer-events: none !important;';
    const ctx = cursorCanvas.getContext('2d');
    
    ctx.clearRect(0, 0, 40, 40);
    
    ctx.shadowColor = 'rgba(255, 200, 50, 0.9)';
    ctx.shadowBlur = 25;
    
    ctx.strokeStyle = '#ffcc44';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(20, 20, 14, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(20, 20, 8, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#ffcc44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 6);
    ctx.lineTo(20, 34);
    ctx.moveTo(6, 20);
    ctx.lineTo(34, 20);
    ctx.stroke();
    
    ctx.fillStyle = '#ffcc44';
    ctx.shadowColor = 'rgba(255, 200, 50, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(20, 20, 3, 0, Math.PI * 2);
    ctx.fill();
    
    menuCursor.appendChild(cursorCanvas);
    document.body.appendChild(menuCursor);
    
    console.log('[gamepad] курсор для меню создан');
  }

  function showMenuCursor(show) {
    if (!menuCursor) return;
    
    const shouldShow = show && window.__mouseLocked && gpIndex !== null;
    menuCursor.style.display = shouldShow ? 'block' : 'none';
    isMenuOpen = show;
    
    if (show && gpIndex !== null) {
      setCursorVisible(true);
    } else {
      setCursorVisible(false);
    }
  }

  function updateMenuCursorPosition(x, y) {
    if (!menuCursor) return;
    menuCursorX = Math.max(0, Math.min(window.innerWidth, x));
    menuCursorY = Math.max(0, Math.min(window.innerHeight, y));
    menuCursor.style.left = menuCursorX + 'px';
    menuCursor.style.top = menuCursorY + 'px';
    
    if (isAnyMenuOpen() && window.__mouseLocked && gpIndex !== null) {
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
      '#mob-settings-overlay[style*="display: flex"]',
      '#mob-settings-overlay[style*="display:flex"]',
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
    
    if (document.body.classList.contains('menu-open')) {
      return true;
    }
    
    return false;
  }

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
    
    const allButtons = document.querySelectorAll('button, .ov-btn, .menu-btn, [role="button"], [onclick], input[type="range"]');
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const el of allButtons) {
      try {
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

  function clickMenuButton() {
    const btn = findNearestButton(menuCursorX, menuCursorY);
    if (btn) {
      btn.click();
      if (typeof btn.onclick === 'function') {
        btn.onclick();
      }
      if (btn.type === 'range') {
        const evt = new Event('input', { bubbles: true });
        btn.dispatchEvent(evt);
      }
      console.log('[gamepad] клик по:', btn.id || btn.className || btn.tagName);
    }
  }

  // ── СБРОС СОСТОЯНИЯ КНОПОК ──────────────────────────────────────────
  function resetButtonStates() {
    if (typeof keys !== 'undefined') {
      keys['w'] = false;
      keys['a'] = false;
      keys['s'] = false;
      keys['d'] = false;
    }
    if (typeof mDown !== 'undefined') {
      mDown = false;
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
  }

  // ── ПЕРЕХВАТ ОТРИСОВКИ КУРСОРА ИГРЫ ──────────────────────────────
  const origDrawCursor = window.drawCursor;
  window.drawCursor = function() {
    if (isAnyMenuOpen()) {
      return;
    }
    if (origDrawCursor) origDrawCursor();
  };

  // ── КЭШ ОРУЖИЯ ──────────────────────────────────────────────────────
  let _cachedWeaponKey = '';
  let _cachedWeaponIsArbalest = false;
  let _cachedWeaponIsWand = false;

  function updateWeaponCache() {
    if (typeof P !== 'undefined' && P && typeof WEAPON_TYPES !== 'undefined') {
      const def = WEAPON_TYPES[P.weaponType];
      _cachedWeaponKey = def ? def.key : '';
      _cachedWeaponIsArbalest = _cachedWeaponKey === 'crossbow';
      _cachedWeaponIsWand = _cachedWeaponKey === 'wand';
    }
  }

  // ── ПЕРЕКРЕСТЬЕ ─────────────────────────────────────────────────────
  function updateCrosshairVisibility() {
    const crosshair = document.getElementById('crosshair');
    if (!crosshair) return;
    
    if (isAnyMenuOpen()) {
      crosshair.style.display = 'none';
      return;
    }
    
    updateWeaponCache();
    const mouseUnlocked = !window.__mouseLocked;
    const gamepadActive = window.__gamepadAimActive;
    
    if (_cachedWeaponIsArbalest) {
      crosshair.style.display = 'block';
      return;
    }
    
    if (_cachedWeaponIsWand) {
      const isCharging = !!(P && P._wandCharging);
      crosshair.style.display = isCharging ? 'block' : 'none';
      return;
    }
    
    crosshair.style.display = (mouseUnlocked && !gamepadActive) ? 'block' : 'none';
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
        'attack','dodge','swapWeapon','shieldFlip','shieldType','swordStyle',
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
        console.log('✔ GamepadTable.txt загружен');
      }
    } catch (e) {
      CFG = DEFAULT_CONFIG;
      console.warn('⚠ GamepadTable.txt недоступен');
    }
  }

  // ── ДЕЙСТВИЯ ──────────────────────────────────────────────────────────
  const ACTIONS = {
    swapWeapon() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof P !== 'undefined' && typeof setWeapon === 'function' && P.hasWeapon !== false) {
        const next = (P.weaponType + 1) % WEAPON_TYPES.length;
        setWeapon(P, next);
        setTimeout(updateWeaponCache, 50);
        setTimeout(updateCrosshairVisibility, 100);
      }
    },
    shieldFlip() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof P !== 'undefined') P._shieldFlipped = !P._shieldFlipped;
    },
    shieldType() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof P !== 'undefined' && typeof setShield === 'function') {
        P.shield = (P.shield + 1) % 4;
        setShield(P, P.shield);
      }
    },
    swordStyle() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof window.toggleSwordStyle === 'function') window.toggleSwordStyle();
    },
    throwWeapon() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof P !== 'undefined' && typeof throwWeapon === 'function') throwWeapon(P);
    },
    dodge() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof doDodge === 'function') doDodge();
    },
    zoneToggle() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof toggleZone === 'function') toggleZone();
    },
    spawnBot() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof toggleAI === 'function') toggleAI();
    },
    musicToggle() {
      if (isAnyMenuOpen()) return;
      activateAudio();
      if (typeof toggleMusic === 'function') toggleMusic();
    },
    pause() {
      activateAudio();
      console.log('[gamepad] PAUSE НАЖАТ!');
      
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
        } else {
          document.body.classList.remove('menu-open');
          document.querySelectorAll('.game-overlay.open, #mob-menu-overlay.open, #net-overlay.open').forEach(el => el.classList.remove('open'));
          if (typeof gamePaused !== 'undefined') gamePaused = false;
        }
        showMenuCursor(false);
        resetButtonStates();
        return;
      }
      
      const menuBtn = document.getElementById('mob-menu-btn');
      if (menuBtn) {
        menuBtn.click();
        setTimeout(() => {
          showMenuCursor(true);
          updateMenuCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
        }, 100);
        return;
      }
      
      if (typeof window.doOpenMenu === 'function') {
        window.doOpenMenu();
      } else if (typeof window.openMenu === 'function') {
        window.openMenu('mob-menu-overlay');
      } else {
        const mobMenu = document.getElementById('mob-menu-overlay');
        if (mobMenu) {
          mobMenu.classList.add('open');
          document.body.classList.add('menu-open');
          if (typeof gamePaused !== 'undefined') gamePaused = true;
          if (typeof AI !== 'undefined') AI.enabled = false;
        }
      }
      
      setTimeout(() => {
        showMenuCursor(true);
        updateMenuCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
      }, 100);
    },
    attack() {}
  };

  // ── ПОДКЛЮЧЕНИЕ ГЕЙМПАДА ──────────────────────────────────────────────
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
      if (menuCursor) menuCursor.style.display = 'none';
    }
  });

  function resetInputState() {
    if (typeof keys !== 'undefined') { keys['w']=keys['a']=keys['s']=keys['d']=false; }
    if (typeof mDown !== 'undefined') mDown = false;
    prevButtonState = {};
  }

  function applyDeadzone(v, dz) {
    return Math.abs(v) < dz ? 0 : v;
  }

  // ── ОСНОВНОЙ ЦИКЛ ─────────────────────────────────────────────────────
  function pollGamepad() {
    rafId = requestAnimationFrame(pollGamepad);
    if (gpIndex === null) return;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads[gpIndex];
    if (!gp) return;

    const menuOpen = isAnyMenuOpen();
    
    if (menuOpen) {
      if (window.__mouseLocked && gpIndex !== null) {
        showMenuCursor(true);
      } else {
        showMenuCursor(false);
      }
      
      if (window.__mouseLocked && gpIndex !== null) {
        const axAim = CFG.axes.aim;
        const rawAX = gp.axes[axAim.x] ?? 0;
        const rawAY = gp.axes[axAim.y] ?? 0;
        const rawDist = Math.hypot(rawAX, rawAY);
        
        if (rawDist > 0.15) {
          const speed = 10 + rawDist * 8;
          updateMenuCursorPosition(menuCursorX + rawAX * speed, menuCursorY + rawAY * speed);
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
        
        const bBtn = gp.buttons[1];
        if (bBtn && bBtn.pressed && !prevButtonState['_menuB']) {
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
          } else {
            document.body.classList.remove('menu-open');
            document.querySelectorAll('.game-overlay.open, #mob-menu-overlay.open, #net-overlay.open').forEach(el => el.classList.remove('open'));
            if (typeof gamePaused !== 'undefined') gamePaused = false;
          }
          showMenuCursor(false);
          resetButtonStates();
        }
        prevButtonState['_menuB'] = bBtn && bBtn.pressed;
      }
      
      return;
    } else {
      showMenuCursor(false);
      if (isMenuOpen) {
        resetButtonStates();
      }
      isMenuOpen = false;
    }

    // ── ДВИЖЕНИЕ ──────────────────────────────────────────────────────
    const axMove = CFG.axes.move;
    const mvX = applyDeadzone(gp.axes[axMove.x] ?? 0, CFG.deadzoneMove);
    const mvY = applyDeadzone(gp.axes[axMove.y] ?? 0, CFG.deadzoneMove);
    if (typeof keys !== 'undefined') {
      keys['w'] = mvY < -0.35;
      keys['s'] = mvY >  0.35;
      keys['a'] = mvX < -0.35;
      keys['d'] = mvX >  0.35;
    }

    // ── ПРИЦЕЛ ────────────────────────────────────────────────────────
    const axAim = CFG.axes.aim;
    const rawAX = gp.axes[axAim.x] ?? 0;
    const rawAY = gp.axes[axAim.y] ?? 0;
    const rawDist = Math.hypot(rawAX, rawAY);

    updateWeaponCache();

    if (rawDist > CFG.deadzoneAim) {
      window.__gamepadAimActive = true;
      if (typeof P !== 'undefined' && typeof rootCenter === 'function') {
        const rc = rootCenter();
        const angle = Math.atan2(rawAY, rawAX);
        
        let radiusMultiplier = 40;
        if (_cachedWeaponIsArbalest || _cachedWeaponIsWand) {
          radiusMultiplier = 4;
        }
        const r = CFG.aimStickRadius * radiusMultiplier;
        
        mX = rc.x + Math.cos(angle) * (r + 40);
        mY = rc.y + Math.sin(angle) * (r + 40);
      }
    } else {
      window.__gamepadAimActive = false;
    }

    updateCrosshairVisibility();

    // ── КНОПКИ ──────────────────────────────────────────────────────────
    for (const key in CFG.buttons) {
      const def = CFG.buttons[key];
      const btn = gp.buttons[def.index];
      if (!btn) continue;
      const pressed = btn.pressed || btn.value > 0.5;
      const wasPressed = !!prevButtonState[key];

      if (def.type === 'trigger') {
        if (def.action === 'attack') {
          mDown = pressed;
          if (_cachedWeaponIsWand) {
            updateCrosshairVisibility();
          }
        } else if (pressed && !wasPressed) {
          ACTIONS[def.action] && ACTIONS[def.action]();
          activateAudio();
        }
      } else if (pressed && !wasPressed) {
        ACTIONS[def.action] && ACTIONS[def.action]();
        activateAudio();
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

  // ── БЛОКИРОВКА МЫШИ ──────────────────────────────────────────────────
  function installMouseGuard() {
    const canvas = document.getElementById('canvas') || document.querySelector('canvas');
    if (!canvas) { setTimeout(installMouseGuard, 200); return; }

    const shouldBlockMove = () => window.__mouseLocked || window.__gamepadAimActive;
    const shouldBlockClick = () => window.__mouseLocked;

    canvas.addEventListener('mousemove', (e) => {
      if (shouldBlockMove()) e.stopImmediatePropagation();
    }, { capture: true });

    canvas.addEventListener('mousedown', (e) => {
      if (shouldBlockClick()) e.stopImmediatePropagation();
    }, { capture: true });

    canvas.addEventListener('mouseup', (e) => {
      if (shouldBlockClick()) e.stopImmediatePropagation();
    }, { capture: true });
  }

  // ── РАЗБЛОКИРОВКА МЫШИ ─────────────────────────────────────────────
  function setupMouseUnlock() {
    const canvas = document.getElementById('canvas') || document.querySelector('canvas');
    if (!canvas) { setTimeout(setupMouseUnlock, 200); return; }

    canvas.addEventListener('click', (e) => {
      if (isAnyMenuOpen()) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      
      if (window.__mouseLocked) {
        e.stopPropagation();
        e.preventDefault();
        window.__mouseLocked = false;
        console.log('[gamepad] мышь разблокирована');
        if (menuCursor) menuCursor.style.display = 'none';
        updateCrosshairVisibility();
      }
    }, true);
  }

  // ── НАБЛЮДАТЕЛЬ ЗА МЕНЮ ─────────────────────────────────────────────
  function setupMenuObserver() {
    const observer = new MutationObserver(() => {
      const open = isAnyMenuOpen();
      if (open && gpIndex !== null) {
        setTimeout(() => {
          if (window.__mouseLocked) {
            showMenuCursor(true);
            updateMenuCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
          }
        }, 100);
      } else {
        showMenuCursor(false);
      }
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  // ── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────
  setCursorVisible(false);
  createMenuCursor();
  setupMenuObserver();

  loadGamepadTable();

  window.addEventListener('load', () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (gp) { gpIndex = gp.index; startPolling(); break; }
    }
    
    setTimeout(updateWeaponCache, 500);
    installMouseGuard();
    setupMouseUnlock();
    setTimeout(updateCrosshairVisibility, 600);
    
    console.log('[gamepad] ГОТОВ! Нажми START (кнопка ☰) для меню');
  });

  window.GAMEPAD_CTRL = { 
    reloadConfig: loadGamepadTable, 
    getConfig: () => CFG,
    updateCrosshair: updateCrosshairVisibility,
    updateWeapon: updateWeaponCache
  };

})();