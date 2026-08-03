// === src/core/i18n.js ===
(function(){
  'use strict';

  const FLAT_STRINGS = {



    
// ─── PANEL / UI ──────────────────────────────────────────────────
'panel.title': '⚙️ УПРАВЛЕНИЕ МЕЧОМ И СМЕЩЕНИЕ ТЕЛА',
'panel.subtitle': 'Настройка в реальном времени. Изменяйте любой ползунок и сразу видите результат.\nВсе настройки сохраняются локально.',

// ─── SECTION TITLES ─────────────────────────────────────────────
'sec.gamepadFlick': '⚡ НАСТРОЙКИ ФЛИКА ГЕЙМПАДА',
'sec.background': '🎨 ФОН',
'sec.movement': '🏃 ДВИЖЕНИЕ',
'sec.swordOffset': '⚔️ СМЕЩЕНИЕ МЕЧА (относительно тела)',
'sec.shield': '🛡 ЩИТ',
'sec.comboPivot': '🌀 ТОЧКА ПОВОРОТА КОМБО (относительно тела)',
'sec.swordScale': '⚔ МАСШТАБ И СМЕЩЕНИЕ МЕЧА',
'sec.character': '👤 ПЕРСОНАЖ И ОРУЖИЕ',
'sec.deadZone': '🎯 МЁРТВАЯ ЗОНА (сглаживание курсора)',
'sec.ai': '🤖 НАСТРОЙКИ ИИ',
'sec.localPlayers': '👥 ЛОКАЛЬНЫЕ СЛОТЫ ИГРОКОВ',
'sec.mobileCam': '📱 МОБИЛЬНОЕ УПРАВЛЕНИЕ И КАМЕРА',
'sec.botSpeed': '🤖 СКОРОСТЬ И МАСШТАБ БОТА',
'sec.combat': '⚔️ НАСТРОЙКИ БОЯ',
'sec.rage': '🔥 ЯРОСТЬ',
'sec.exhaustion': '⚠ ИСТОЩЕНИЕ',
'sec.clash': '⚡ СТОЛКНОВЕНИЕ / ОТРАЖЕНИЕ',
'sec.flickOrbit': '🌀 ОБНАРУЖЕНИЕ РЫВКА / ОРБИТЫ',
'sec.debug': '🐞 ОТЛАДКА',
'sec.controls': '🎮 УПРАВЛЕНИЕ',
'sec.shortcuts': '⌨️ ГОРЯЧИЕ КЛАВИШИ',

// ─── SLIDER LABELS ──────────────────────────────────────────────
'slider.playerGlow': 'Свечение игрока',
'slider.playerRespawnLegacy': 'Возрождение игрока (старый режим)',
'slider.gamepadFlickWindowLegacy': 'Флик геймпада: окно (сек.)',
'slider.gamepadFlickMinVelLegacy': 'Флик геймпада: минимальная скорость',
'slider.gamepadFlickMinAmpLegacy': 'Флик геймпада: минимальная амплитуда',
'slider.gamepadFlickCountLegacy': 'Флик геймпада: количество смен направления',
'slider.gamepadFlickMaxMultLegacy': 'Флик геймпада: максимальная амплитуда',
'slider.gamepadStamFlickLegacy': 'Флик геймпада: расход выносливости',
'slider.bgBright': 'Яркость',
'slider.gridBright': 'Яркость сетки',
'slider.distance': 'Расстояние',
'slider.speed': 'Скорость',
'slider.inertia': 'Инерция',
'slider.offsetX': 'Смещение X',
'slider.offsetY': 'Смещение Y',
'slider.lerpSpeed': 'Скорость интерполяции',
'slider.adaY12': 'Адаптация смещения Y (12 часов)',
'slider.adaY6': 'Адаптация смещения Y (6 часов)',
'slider.adaXBase': 'Базовый X (12 часов)',
'slider.adaXPeak': 'Пик X (6/12 часов)',
'slider.ada12Offset': 'Смещение для 12 часов',
'slider.shieldSideSpeed': 'Скорость смены стороны щита',
'slider.comboOffsetX': 'Смещение X',
'slider.comboOffsetY': 'Смещение Y',
'slider.comboSpeed': 'Скорость',
'slider.scaleNoLMB': 'Масштаб без ЛКМ',
'slider.scaleLMB': 'Масштаб с ЛКМ',
'slider.scaleLerp': 'Скорость интерполяции',
'slider.angleOffset': 'Смещение угла',
'slider.pivotOffsetX': 'Смещение точки поворота X',
'slider.pivotOffsetY': 'Смещение точки поворота Y',
'slider.charScale': 'Масштаб персонажа',
'slider.weaponLength': 'Длина оружия (глобально)',
'slider.flailSpeedMult': 'Множитель скорости цепа',
'slider.flailSag': 'Провисание цепа',
'slider.deadZoneRadius': 'Расстояние (радиус)',
'slider.botAngle': 'Угол бота N°',
'slider.duelRadius': 'Радиус дуэли (пикс.)',
'slider.circleChance': 'Шанс обхода по кругу %',
'slider.probingChance': 'Шанс разведки %',
'slider.probingRetreat': 'Множитель отступления при разведке',
'slider.spinDuration': 'Длительность вращения (сек.)',
'slider.playerRespawn': 'Возрождение игрока (сек.)',
'slider.gamepadFlickWindow': 'Флик геймпада: окно (сек.)',
'slider.gamepadFlickMinVel': 'Флик геймпада: минимальная скорость',
'slider.gamepadFlickMinAmp': 'Флик геймпада: минимальная амплитуда',
'slider.gamepadFlickCount': 'Флик геймпада: количество смен направления',
'slider.gamepadFlickMaxMult': 'Флик геймпада: максимальная амплитуда',
'slider.gamepadStamFlick': 'Флик геймпада: расход выносливости',
'slider.gameSpeed': 'Скорость игры (×)',
'slider.cameraZoom': 'Приближение камеры (клетки)',
'slider.cameraLerp': 'Отставание камеры',
'slider.musicVolume': 'Громкость музыки',
'slider.botCount': 'Количество ботов',
'slider.botSpeed': 'Скорость бота (× от игрока)',
'slider.botDodgeChance': 'Шанс уклонения бота %',
'slider.botDodgeToward': 'Шанс уклонения к цели %',
'slider.botScale': 'Масштаб бота (тело)',
'slider.botSwordScale': 'Масштаб меча бота',
'slider.globalSpeed': 'Глобальная скорость (×)',
'slider.swingThreshold': 'Порог для взмаха',
'slider.blockStaminaCost': 'Расход выносливости на блок',
'slider.swingStaminaCost': 'Расход выносливости на удар',
'slider.knockbackForce': 'Сила отбрасывания',
'slider.disbalanceDuration': 'Длительность дисбаланса (сек.)',
'slider.disbalanceComboWindow': 'Окно комбо после дисбаланса',
'slider.staminaRegen': 'Восстановление выносливости / сек.',
'slider.lmbStaminaPercent': 'Выносливость ЛКМ %',
'slider.lmbDamage': 'Урон ЛКМ (×)',
'slider.rageBlocks': 'Блоков для 100 ярости',
'slider.rageDuration': 'Длительность ярости (сек.)',
'slider.exhaustDuration': 'Длительность (сек.)',
'slider.exhaustSpeedPenalty': 'Штраф к скорости',
'slider.exhaustSwordPenalty': 'Штраф к мечу',
'slider.weaponRestitution': 'Упругость оружия',
'slider.bladeKnockback': 'Отбрасывание клинком',
'slider.bodyKnockback': 'Отбрасывание телом',
'slider.blockSlowDuration': 'Длительность замедления после блока (сек.)',
'slider.blockSlowMultiplier': 'Множитель замедления после блока',
'slider.minDeflectionAngle': 'Минимальный угол отражения',
'slider.maxDeflectionAngle': 'Максимальный угол отражения',
'slider.swordBackMultiplier': 'Множитель возврата меча',
'slider.blockKnockback': 'Отбрасывание при блоке',
'slider.disarmChance': 'Шанс обезоруживания %',
'slider.orbitWindow': 'Орбита: окно (сек.)',
'slider.orbitTurns': 'Орбита: требуется оборотов',
'slider.orbitStaminaCost': 'Орбита: расход выносливости',
'slider.flickWindow': 'Флик: окно (сек.)',
'slider.flickMinSpeed': 'Флик: минимальная скорость (рад/с)',
'slider.flickMinAmplitude': 'Флик: минимальная амплитуда (рад)',
'slider.flickSwingCount': 'Флик: количество смен направления',
'slider.flickMaxAmplitude': 'Флик: максимальная амплитуда (× мин.)',
'slider.flickStaminaCost': 'Флик: расход выносливости',
'slider.debugToggle': 'Переключатель отладки',
    
// ─── CHECKBOX LABELS ─────────────────────────────────────────────
'checkbox.gamepadFlickDetectLegacy': 'Геймпад: отдельное обнаружение флика (устаревший режим)',
'checkbox.adaptY': 'Адаптация Y (смещение на 12 часов)',
'checkbox.adaptD': 'Адаптация Y (смещение на 6 часов)',
'checkbox.adaptX': 'Адаптация X (12/6 часов, базовое значение 5)',
'checkbox.adapt12': 'Адаптация 12 (смещение 11–12–1 часов)',
'checkbox.duelSystem': 'Система дуэльных позиций',
'checkbox.disableSpin': 'Отключить вращение',
'checkbox.alwaysMirror': 'Всегда использовать зеркальный стиль',
'checkbox.coopDefeatAll': 'В кооперативе поражение только после гибели всех игроков',
'checkbox.gamepadFlickDetect': 'Геймпад: отдельное обнаружение флика',
'checkbox.overheadBars': 'Показывать полосы здоровья над врагами',
'checkbox.safeCounter': 'Безопасное окно контратаки (1,5 сек. после блока)',
'checkbox.debugCombo': 'Отладка: этапы комбо после дисбаланса',
'checkbox.orbitDetect': 'Обнаружение орбиты (непрерывное вращение)',
'checkbox.flickDetect': 'Обнаружение флика (быстрая смена направления)',
'checkbox.debugBrowser': 'Отладка: разблокировать ПКМ и клавиши браузера',
'checkbox.debugClash': 'Отладка: выводить данные столкновений (консоль)',
'checkbox.followCamera': 'Камера закреплена на игроке',

// ─── SELECT LABELS ──────────────────────────────────────────────
'select.gamepadSlot': 'Управление геймпадом 1',
'select.gamepadSlot0': 'Игрок 1 (клавиатура + мышь)',
'select.gamepadSlot1': 'Игрок 2',
'select.gamepadSlot2': 'Игрок 3',
'select.gamepadSlot3': 'Игрок 4',
'select.factionMode': 'Фракции и условия победы',
'select.factionFFA': 'Каждый сам за себя',
'select.factionCoop': 'Кооператив против ботов',

// ─── BUTTONS ──────────────────────────────────────────────────────
'btn.export': '📤 Экспортировать настройки в файл',
'btn.toggleAI': '🤖 ИИ: {state}',
'btn.toggleBalls': '⚾ Мячи: {state}',
'btn.toggleBoxes': '📦 Ящики: {state}',
'btn.toggleBlockKB': '🛡 Отбрасывание при блоке: {state}',
'btn.toggleMusic': '🎵 Музыка: {state}',
'btn.resume': '▶ ПРОДОЛЖИТЬ',
'btn.profile': '👤 ПРОФИЛЬ',
'btn.quickMatch': '⚡ БЫСТРЫЙ БОЙ',
'btn.network': '🌐 СЕТЬ',
'btn.controlMode': '🎮 РЕЖИМ УПРАВЛЕНИЯ',
'btn.settings': '⚙️ НАСТРОЙКИ',
'btn.restart': '🔄 ПЕРЕЗАПУСК',
'btn.confirm': '✅ ПОДТВЕРДИТЬ',
'btn.close': '✕ ЗАКРЫТЬ',
'btn.back': '← НАЗАД',
'btn.chat': '💬 ЧАТ',
'btn.exit': '⚡ ВЫЙТИ',
'btn.play': '▶ ИГРАТЬ',
'btn.send': '➤',
'btn.rename': '✏',
'btn.copy': '📋',
'btn.addFriend': '+',
'btn.serverMain': '🌐 Основной',
'btn.serverBackup': '🔄 Резервный',
'btn.friends': '📇 ДРУЗЬЯ / КНИГА ID',

// ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────
'shortcut.wasd': 'WASD — движение',
'shortcut.mouse': 'Мышь — курсор / прицеливание',
'shortcut.lmb': 'ЛКМ — удерживать меч в позиции (атака)',
'shortcut.shift': 'Shift — уклонение (с инерцией)',
'shortcut.t': 'T — включить/выключить ИИ',
'shortcut.y': 'Y — создать бота',
'shortcut.e': 'E — подобрать оружие',
'shortcut.one': '1 — бросить оружие',
'shortcut.r': 'R — переключить стиль меча',
'shortcut.q': 'Q — не используется',
'shortcut.c': 'C — сменить оружие игрока',
'shortcut.v': 'V — сменить оружие бота',
'shortcut.z': 'Z — сменить щит игрока',
'shortcut.x': 'X — сменить щит бота',
'shortcut.g': 'G — вызвать истощение',
'shortcut.h': 'H — добавить ярость',
'shortcut.u': 'U — наложить дисбаланс на игрока',
'shortcut.i': 'I — наложить дисбаланс на бота',
'shortcut.o': 'O — переключить зону арены',
'shortcut.enter': 'Enter — открыть/закрыть меню',
'shortcut.escape': 'Escape — закрыть меню',

// ─── HINT ────────────────────────────────────────────────────────
'hint.text': 'WASD — движение · T — ИИ · Мышь — прицеливание · ЛКМ — атака · Enter — меню',

// ─── NETWORK ─────────────────────────────────────────────────────
'net.title': '🌐 СЕТЬ',
'net.player': 'Игрок:',
'net.signaling': '🔌 СИГНАЛЬНЫЙ СЕРВЕР',
'net.serverInfo': 'Если «Основной» не подключается — попробуйте «Резервный» (может работать медленнее).',
'net.searching': 'Поиск игроков...',
'net.lobbyInfo': 'Все игроки видят один и тот же список. Нажмите на игрока, чтобы подключиться.\n⚠️ Бот начнёт сражаться только после нажатия кнопки «ИГРАТЬ» в чате!',
'net.friendsTitle': '📇 ДРУЗЬЯ / КНИГА ID',
'net.contacts': 'Контакты {count}',
'net.friendName': 'Имя',
'net.friendId': 'ID (из буфера обмена)',
'net.chatPeer': '💬',
'net.chatPlaceholder': 'Введите сообщение...',
'net.friendsCount': '({current}/{max})',

// ─── OVERLAYS ────────────────────────────────────────────────────
'overlay.welcome': 'ДОБРО ПОЖАЛОВАТЬ НА АРЕНУ',
'overlay.enterName': 'Введите своё имя',
'overlay.namePlaceholder': 'ВАШЕ ИМЯ',
'overlay.shieldTitle': '🛡 ЩИТ',
'overlay.shieldNone': '✖ Нет',
'overlay.shieldSmall': '🛡 Малый',
'overlay.shieldLarge': '🛡 Большой',
'overlay.shieldTower': '🛡 Башенный',
'overlay.shieldSpikedSmall': '🔥 Малый',
'overlay.shieldSpikedMedium': '🔥 Средний',
'overlay.shieldSpikedLarge': '🔥 Большой',
'overlay.shieldInfo': 'Без щита',

// ─── MOBILE ──────────────────────────────────────────────────────
'mobile.rotate': 'Пожалуйста, поверните устройство\nв альбомную ориентацию',
'mobile.settingsTitle': '⚙️ НАСТРОЙКИ',
'mobile.settingsClose': '✕ ЗАКРЫТЬ',

// ─── INFOBAR ─────────────────────────────────────────────────────
'infobar.root': '🧭 Корень',
'infobar.bodyOffset': '⚔️ Смещение тела',

// ─── PVP ─────────────────────────────────────────────────────────
'pvp.ping': '-- мс',

// ─── BADGE ──────────────────────────────────────────────────────
'badge.title': 'БОЙ НА МЕЧАХ',

    'buff.exhaust': '⚠ УСТАЛОСТЬ',
    'buff.disbalance': '⚠ ДИСБАЛАНС',
    'buff.rage': 'ЯРОСТЬ!',
    'hud.debuff': 'ОСЛАБЛЕНИЕ',
    'hud.unbalanced': '💫 НЕУСТОЙЧИВ',
    'hud.rageCharge': '🔥 {rage}/50 ярости',
    'hud.botLabel': 'БОТ',
    'hud.player2Label': 'ИГРОК 2',
    'hud.probingApproach': 'СБЛИЖЕНИЕ · ФЕХТОВАНИЕ',
    'hud.probingStrike': 'ПРИЦЕЛИВАНИЕ',
    'hud.probingRetreat': 'ОТСТУПЛЕНИЕ',
    'hud.probingPause': 'ПАУЗА',
    'hud.probingMirrorBlock': 'ЗЕРКАЛЬНЫЙ БЛОК',
    'hud.probingPhase': '⚔ РАЗВЕДКА · {state}',
    'hud.pokeDodge': '➜ УКОЛ + УВОРОТ',
    'hud.lungeBack': '↩ ЗАМАХ ДЛЯ ВЫПАДА',
    'hud.lungeForward': '➜ ВЫПАД',
    'hud.harassApproach': 'СБЛИЖЕНИЕ',
    'hud.harassStrike': 'УДАР',
    'hud.harassOrbit': 'ОРБИТА',
    'hud.harassPhase': '⚔ ИЗМОТ · {phase}',
    'hud.phaseAttack': '⚔ АТАКА',
    'hud.phaseRetreat': '🏃 ОТСТУПЛЕНИЕ',
    'hud.phaseRest': '😮‍💨 ОТДЫХ',
    'hud.duelistStyle': ' 🛡ДУЭ',
    'hud.mirrorStyle': ' 🪞ЗЕР',
    'hud.swordStyle': ' ⚔МЕЧ',
    'hud.botExhausted': '😫 ИСТОЩЕН',
    'common.dodge': 'УВОРОТ',
    'controls.move': 'WASD — движение игрока',
    'controls.mouse': 'Мышь — поворот и прицел',
    'controls.lmb': 'ЛКМ — обычный удар',
    'controls.rmb': 'ПКМ — управление манекеном',
    'controls.wheel': 'Колесо — масштаб камеры',
    'controls.toggle': 'T — вкл/выкл манекен',
    'controls.rename': 'Enter — переименовать',
    'controls.pause': 'P — пауза',
    'controls.zone': 'O — зона арены',
    'gamepad.diagnostic.noApi': '🎮 navigator.getGamepads недоступен в этом браузере',
    'gamepad.diagnostic.pressButton': '🎮 Нажмите любую кнопку на геймпаде\n(getGamepads() всё ещё пуст)',
    'gamepad.diagnostic.detectedNotHeld': '🎮 Обнаружен, но не захвачен:\n{devices}',
    'gamepad.virtualKeyboard.hint': 'A — ввод · B — назад · Y — пробел · X — бэкспейс',
    'gamepad.virtualKeyboard.special.abc': 'АБС/РУС',
    'gamepad.virtualKeyboard.special.space': 'ПРОБЕЛ',
    'gamepad.virtualKeyboard.special.backspace': '⌫',
    'gamepad.virtualKeyboard.special.done': 'ГОТОВО',
    'net.wins.score': 'СЧЁТ {wins}/{total}',
    'net.wins.player': 'Игрок',
    'net.wins.bot': 'Бот',
    'net.wins.seriesWin': '🏆 {name} ВЫИГРАЛ СЕРИЮ!',
    'net.wins.champion': '🏆 {name} ПОБЕДИЛ!',
    'net.zone.active': 'ЗОНА АКТИВНА',
    'net.zone.inactive': 'ЗОНА ВЫКЛ',
    'net.zone.damageSuffix': '🔥',
    'lobby.status.waiting': 'Никого нет. Ожидание...',
    'lobby.status.join': '🔗 Присоединиться',
    'lobby.status.found': '🔗 Найден {name} — подключение...',
    'lobby.status.connecting': '🔗 ПОДКЛЮЧЕНИЕ К {name}...',
    'lobby.status.hubNotResponding': '⚠ Хаб не отвечает (возможно, на другом сервере)',
    'lobby.status.connected': '🟢 В лобби!',
    'lobby.status.disconnected': 'Отключён от лобби',
    'lobby.status.error': '⚠ Ошибка лобби: {error}',
    'lobby.status.serverFirst': '⚠ Сначала подключитесь к серверу',
    'lobby.status.connectingHub': 'Подключение...',
    'lobby.status.host': '🟢 Вы хост. Ожидание игроков...',
    'lobby.status.hostFound': 'Хост найден, подключение...',
    'lobby.player.default': 'Игрок',
    'main.staminaWarning': '⚠ НЕТ СИЛ!',
    'main.rageActivated': '🔥 ЯРОСТЬ!',
    'main.shieldPlayer': 'ЩИТ ИГР: {name}',
    'main.shieldBot': 'ЩИТ БОТ: {name}',
    'main.weaponPlayer': 'ОРУЖИЕ: {name}',
    'main.weaponBot': 'ОРУЖИЕ: {name}',
    'main.rageAdd': '🔥+100 ЯРОСТИ',
    'main.botRage': '🔥 ЯРОСТЬ БОТА',
    'main.aiOn': '▶ ИИ ВКЛ',
    'main.aiPause': '⏸ ИИ ПАУЗА',
    'main.spikedBash': '🗡🛡 БАШ!',
    'main.bash': '🛡 УДАР ЩИТОМ!',
    'main.orbit': '🌀 ОРБИТА',
    'main.flick': '⚡ ФЛИК',
    'main.swing': '⚔ ВЗМАХ',
    'main.hitDamage': '-{damage}HP',
    'main.champion': '🏆 {name} ВЫИГРАЛ СЕРИЮ!',
    'main.zoneActive': 'ЗОНА АКТИВНА',
    'main.zoneInactive': 'ЗОНА ВЫКЛ',
    'main.unknownWeapon': 'НЕИЗВЕСТНО',
    'main.shieldNone': 'нет',
    'main.rageActivatedShort': '🔥 ЯРОСТЬ!',
    'main.botRageShort': '🔥 ЯРОСТЬ БОТА',
    'main.staminaWarningShort': '⚠ НЕТ СИЛ!',
    'combat.weaponDropped': 'ОРУЖИЕ ВЫПАЛО!',
    'combat.victory': 'ПОБЕДА!',       
    'combat.defeat': 'ПОРАЖЕНИЕ!',    
    'combat.poke': 'УКОЛ!',
    'combat.block': 'БЛОК!',
    'combat.style': 'СТИЛЬ: {name}',
    'combat.clash': 'КЛАЦ!',
    'playercontrols.status.slot0': 'Геймпад дублирует управление Игрока 1',
    'playercontrols.status.slotN': 'Геймпад управляет Игроком {slot}; ИИ для этого персонажа отключён',
    'playercontrols.botCountTitle': 'Количество ботов (дополнительно к локальным игрокам)',
    'playercontrols.addBotTitle': 'Добавить бота в локальный PvP',
    'playercontrols.hitOrbit': '🌀 ОРБИТА',
    'playercontrols.hitFlick': '⚡ ФЛИК',
    'playercontrols.hitSwing': '⚔ ВЗМАХ',
    'playercontrols.rage': '🔥 ЯРОСТЬ!',
    'factions.wins.prefix': 'ПОБЕД {wins}',
    'factions.respawn': 'ВОЗРОЖДЕНИЕ',
    'factions.coop.playersWin': '🏆 ПОБЕДА ИГРОКОВ',
    'factions.coop.botsWin': '🤖 ПОБЕДА БОТОВ',
    'factions.ffa.playerWin': '🏆 ПОБЕДА ИГРОКА',
    'factions.ffa.botsWin': '🤖 ПОБЕДА БОТОВ',
    'weapon.sword': 'Меч',
    'weapon.rapier': 'Рапира',
    'weapon.dagger': 'Кинжал',
    'weapon.spear': 'Копьё',
    'weapon.halberd': 'Алебарда',
    'weapon.axe': 'Топор',
    'weapon.longsword': 'Длинный меч',
    'weapon.greatsword': 'Двуручный меч',
    'weapon.hammer': 'Молот',
    'weapon.staff': 'Посох',
    'weapon.magicstaff': 'Магический посох',
    'weapon.flail': 'Цеп',
    'weapon.wand': 'Жезл',
    'weapon.bow': 'Лук',
    'weapon.crossbow': 'Арбалет',
    'weapon.thrown': '🗡 БРОСОК!',
    'weapon.picked': '🗡 ПОДОБРАН',
    'ranged.wandShot': '🗡 ВЫСТРЕЛ',
    'ranged.wandCharge': '🔮 ЗАРЯДКА...',
    'ranged.wandRelease': '💥 ВЗРЫВ!',
    'ranged.wandNoRage': '⚠ НЕТ ЯРОСТИ!',
    'ranged.wandNoStamina': '⚠ НЕТ СИЛ!',
    'ranged.crossbowReload': '🔄 ПЕРЕЗАРЯДКА...',
    'ranged.magicStaffCharge': '🔮 ЗАРЯД!',
    'ranged.magicStaffExplosion': '💥 ВЗРЫВ!',
    'ranged.magicStaffNeedRage': '⚠ НУЖНО >2 СЕК',
    'ranged.botDodge': '💫 УВОРОТ!',
    'ranged.dodgeTrail': '💨 УВОРОТ',
    'ranged.arrowHit': '🏹 ПОПАДАНИЕ',
    'ranged.wandHit': '✨ МАГИЯ',
    'ranged.arrowDamage': 'СТРЕЛА {damage}',
    'ranged.push': 'ТОЛЧОК',
    'ranged.chargeNeedHold': 'Удерживайте >2 сек',
    'ranged.chargePercent': '{percent}%',
    'ranged.abortReason.playerRecovered': 'ИГРОК ВОССТАНОВИЛСЯ',
    'ranged.abortReason.tooFar': 'СЛИШКОМ ДАЛЕКО',
    'ranged.abortReason.tooClose': 'СЛИШКОМ БЛИЗКО',
    'ranged.abortReason.noStamina': 'НЕТ СИЛ',
    'ranged.abort': 'ОСТАНОВКА {reason}',
    'sprites.shield.none': 'Нет щита',
    'sprites.shield.small': 'Малый',
    'sprites.shield.large': 'Большой',
    'sprites.shield.tower': 'Башенный',
    'sprites.shield.spiked_small': 'С шипами (малый)',
    'sprites.shield.spiked_medium': 'С шипами (средний)',
    'sprites.shield.spiked_large': 'С шипами (большой)',
    'sprites.error.fileNotFound': '⚠ Файл не найден: {filename}',
    'ai.rageActivated': '🔥',
    'ai.crown': '👑 КОРОНА!',
    'ai.ignore': '😤 ИГНОР!',
    'ai.flee': '😱 БЕГСТВО!',
    'ai.reconsider': '🤔 ПЕРЕДУМАЛ!',
    'ai.enough': '🤔 ДОВОЛЬНО!',
    'ai.dodge': 'УВОРОТ',
    'ai.lunge': '💨 РЫВОК!',
    'ai.probing': '⚔ РАЗВЕДКА',
    'ai.mirror': '🪞 ЗЕРКАЛО',
    'ai.duelist': '⚔ ДУЭЛЯНТ',
    'ai.swordsman': '⚔ МЕЧНИК',
    'ai.retreat': '🏃 ОТСТУПЛЕНИЕ',
    'ai.attack': '⚔ АТАКА',
    'ai.breather': '😮‍💨 ОТДЫХ',
    'ai.harass': '⚔ ИЗМОТ',
    'ai.orbit': '🌀 ОРБИТА',
    'ai.feint': '💫 ФИНТ',
    'ai.spin': '🌀 КРУГ',
    'ai.pokeDodge': '💨 УВОРОТ',
    'net.shield.none': 'Нет щита',
    'net.shield.small': 'Малый — скорость -6%',
    'net.shield.large': 'Большой — скорость -18%',
    'net.shield.tower': 'Башенный — скорость -30%',
    'net.shield.spiked_small': 'Малый с шипами — скорость -12%, удар 8 урона',
    'net.shield.spiked_medium': 'Средний с шипами — скорость -24%, удар 12 урона',
    'net.shield.spiked_large': 'Большой с шипами — скорость -36%, удар 18 урона',
    'net.profile.unnamed': '(не задано)',
    'net.friends.empty': 'Пусто — добавьте друга',
    'net.lobby.connectFirst': '👆 Сначала выберите сервер (Основной/Резервный)',
    'net.autoConnect': '⏳ автоматическое подключение к серверу...',
    'net.autoConnectFailed': '❌ Ошибка подключения. Попробуйте через меню сети.',
    'net.idCopied': '✅',
    'net.idCopy': '📋',
    'net.friend.name': 'Имя:',
    'net.friend.id': 'ID:',
    'net.addFriend': 'ДОБАВИТЬ',
    'net.editFriend': 'Изменить',
    'net.removeFriend': 'Удалить',
    'net.connectFriend': 'Подключиться',
    'net.server.choose': '👆 выберите сервер выше (Основной/Резервный)',
    'net.server.connecting': '⏳ подключение: {label} ({host})...',
    'net.server.notResponding': '⏱ {label} не отвечает. Попробуйте другой сервер.',
    'net.server.online': '✅ Онлайн ({label}) · ID: {id}',
    'net.server.incoming': '📞 входящий от {name}',
    'net.server.error': '⚠ {error}',
    'net.server.unavailable': '❌ Друг не найден',
    'net.server.unavailableId': '❌ {label} недоступен. Попробуйте другой сервер.',
    'net.server.reconnecting': '↩ сервер: переподключение...',
    'net.server.reconnectFailed': '❌ Переподключение не удалось. Выберите сервер заново.',
    'net.server.notReady': '⚠ сервер не готов',
    'net.connecting.to': '🔗 подключение к {id}...',
    'net.fastChannel': '⚡ быстрый канал открыт',
    'net.connecting.with': '⏳ подключение к {name}...',
    'net.connected.with': '🟢 подключено к {name}',
    'net.disconnected': '🔴 отключено',
    'net.chat.connected': '— Подключено к {name} —',
    'net.chat.disconnected': '— Соединение потеряно —',
    'net.chat.me': 'Я',
    'net.chat.placeholder': 'Сообщение...',
    'net.chat.send': 'Отправить',
    'net.chat.disconnect': 'Отключиться',
    'net.chat.play': 'Играть',
    'mobile.start': '► СТАРТ',
    'mobile.fullscreen': 'Полный экран',
    'mobile.controls.move': 'Движение',
    'mobile.controls.attack': 'Атака',
    'mobile.controls.dodge': 'Уворот',
    'mobile.controls.throw': 'Бросок',
    'mobile.controls.weapon': 'Оружие',
    'mobile.controls.shield': 'Щит',
    'mobile.controls.shieldFlip': 'Перевернуть щит',
    'mobile.controls.style': 'Стиль',
    'mobile.controls.zone': 'Зона',
    'mobile.controls.music': 'Музыка',
    'mobile.controls.menu': 'Меню',
    'mobile.controls.quickMatch': 'Быстрый матч',
    'mobile.controls.profile': 'Профиль',
    'mobile.controls.network': 'Сеть',
    'mobile.controls.resume': 'Продолжить',
    'mobile.controls.restart': 'Перезапуск',
    'mobile.controls.settings': 'Настройки',
    'mobile.controls.controls': 'Управление',
    'mobile.menu.title': 'ПАУЗА',
    'mobile.menu.subtitle': 'Игра приостановлена',
    'mobile.quickmatch.connecting': '⏳ автоматическое подключение к серверу...',
    'mobile.quickmatch.failed': '❌ Ошибка подключения. Попробуйте через меню сети.',
    'mobile.quickmatch.connected': '✅ Подключено! Вход в лобби...',
    'mobile.quickmatch.waiting': '⏳ Ожидание противника...',
    'mobile.quickmatch.found': '🔗 Противник найден! Начало игры...',
    'mobile.quickmatch.cancel': 'Отмена',
    'mobile.toast.weaponChanged': '⚔ Оружие изменено',
    'mobile.toast.shieldChanged': '🛡 Щит изменён',
    'mobile.toast.shieldFlipped': '🔄 Щит перевернут',
    'mobile.toast.styleChanged': '⚔ Стиль изменён',
    'mobile.toast.zoneToggled': '🌐 Зона переключена',
    'mobile.toast.musicToggled': '🎵 Музыка переключена',
    'mobile.toast.weaponThrown': '🗡 Оружие брошено',
    'mobile.toast.dodge': '💨 Уворот!',
    'mobile.toast.respawn': '🔄 Возрождение',
    'mobile.toast.dead': '💀 Вы погибли',
    'mobile.toast.victory': '🏆 Победа!',
    'mobile.toast.defeat': '💀 Поражение',
    'flail.staminaBonus': '⚡ УСКОРЕНИЕ!',
    'mobile.controls.pc': 'УПРАВЛЕНИЕ (ПК)',
    'mobile.controls.pc.move': 'WASD — движение',
    'mobile.controls.pc.mouse': 'Мышь — меч / прицел',
    'mobile.controls.pc.lmb': 'ЛКМ — удержание меча',
    'mobile.controls.pc.shift': 'Shift — УВОРОТ',
    'mobile.controls.pc.t': 'T — спавн бота',
    'mobile.controls.pc.e': 'E — ИИ вкл/выкл',
    'mobile.controls.pc.o': 'O / Щ — зона арены',
    'mobile.controls.pc.enter': 'Enter — меню паузы',
    'mobile.controls.pc.esc': 'Esc — закрыть меню',
    'flail.chainState.follow': 'СЛЕДОВАНИЕ',
    'flail.chainState.spin': 'КРУГ',
    'flail.chainState.retract': 'ВТЯГИВАНИЕ'
  };

  const STRINGS = {
    en: {
      title: 'Godgrave Arena',
      hud: {
        player: 'ИГРОК',
        bot: 'БОТ',
        player2: 'ИГРОК 2',
        localPvp: 'ЛОКАЛЬНЫЙ PVP',
        rageBuff: 'ЯРОСТЬ 2x',
        root: 'Корень',
        bodyOffset: 'Смещение тела',
        pivot: 'поворот: (0,0) | угол: 0°'
      },
      buttons: {
        export: 'ЭКСПОРТ НАСТРОЕК → БУФЕР ОБМЕНА',
        exportCopied: 'СКОПИРОВАНО!',
        dtoggle: {
          on: 'МАНЕКЕН: ВКЛ',
          off: 'МАНЕКЕН: ВЫКЛ',
          pause: 'МАНЕКЕН: ПАУЗА'
        },
        balls: {
          on: 'ОСТАНОВИТЬ МЯЧИ',
          off: 'СОЗДАТЬ МЯЧИ'
        },
        boxes: {
          on: 'БЛОКИ: ВКЛ',
          off: 'БЛОКИ: ВЫКЛ'
        },
        blockKb: {
          on: 'БЛОК ОТБРОСА: ВКЛ',
          off: 'БЛОК ОТБРОСА: ВЫКЛ'
        },
        music: {
          on: 'МУЗЫКА: ВКЛ',
          off: 'МУЗЫКА: ВЫКЛ'
        }
      },
      labels: {
        gamepadPlayerSlot: 'Управление геймпадом 1',
        factionMode: 'Режим фракций и победы',
        coopDefeatAll: 'Поражение в кооперативе только когда все игроки мертвы',
        gamepadFlick: 'Геймпад: отдельное обнаружение флика',
        debugBrowser: 'Отладка: разблокировка ПКМ/клавиш в браузере'
      },
      options: {
        gamepadSlot1: 'Игрок 1 с клавиатурой',
        gamepadSlot2: 'Игрок 2',
        gamepadSlot3: 'Игрок 3',
        gamepadSlot4: 'Игрок 4',
        factionFfa: 'Игрок против игрока',
        factionCoop: 'Игроки против ботов'
      },
      sections: [
        'Визуальные эффекты игрока',
        'Фон арены',
        'Следование модели',
        'Тело и щит',
        'Камера и поза',
        'Меч и рука',
        'Нож и спина',
        'Копьё и древковое',
        'Поведение ИИ и разведка',
        'Локальные игроки',
        'Мобильный режим',
        'Боты и баланс',
        'Энергия меча',
        'Блок и защита',
        'Кровь',
        'Замедления',
        'Боевая экономика',
        'Отладка',
        'Экспорт и переключатели',
        'Управление'
      ],
      rows: {
        playerglow: 'Свечение игрока',
        playerrespawn: 'Возрождение игрока (сек)',
        gamepadflickwindow: 'Флик геймпада: окно (сек)',
        gamepadflickminvel: 'Флик геймпада: мин. скорость',
        gamepadflickminamp: 'Флик геймпада: мин. амплитуда',
        gamepadflickcount: 'Флик геймпада: кол-во смен направления',
        gamepadflickmaxmult: 'Флик геймпада: макс. амплитуда',
        gamepadstamflick: 'Флик геймпада: выносливость',
        bgbright: 'Яркость фона',
        gridbright: 'Яркость сетки',
        dist: 'Расстояние',
        spd: 'Скорость',
        inertia: 'Инерция',
        ex: 'Смещение X',
        ey: 'Смещение Y',
        blk: 'Скорость интерполяции',
        adaY: 'Высота 12 часов',
        adaD: 'Нижняя высота',
        adaXb: 'База X',
        adaXp: 'Пик X',
        ada12: 'Пик 12 часов',
        shieldSideSpd: 'Скорость смены стороны щита',
        aex: 'Смещение атаки X',
        aey: 'Смещение атаки Y',
        as: 'Скорость атаки',
        sc0: 'Масштаб без меча',
        sc1: 'Масштаб с мечом',
        scs: 'Интерполяция масштаба',
        srot: 'Поворот спрайта',
        sox: 'Сдвиг X',
        soy: 'Сдвиг Y',
        cscl: 'Масштаб тела',
        swlen: 'Длина меча',
        flailspeedmult: 'Скорость цепа',
        flailsag: 'Провисание цепа',
        dzone: 'Мёртвая зона',
        aiang: 'Угол ИИ',
        duelrad: 'Радиус дуэли',
        circchance: 'Шанс круга',
        probingchance: 'Шанс разведки',
        probingretreat: 'Отступление при разведке',
        spindur: 'Длительность круга',
        gamespeed: 'Скорость игры',
        camrows: 'Масштаб камеры',
        camlerp: 'Отставание камеры',
        musicvol: 'Громкость музыки',
        botcount: 'Количество ботов',
        botspd: 'Скорость ботов',
        botdodgechance: 'Шанс уворота бота %',
        botdodgetoward: 'Уворот в сторону игрока %',
        botscale: 'Масштаб бота',
        botswordscale: 'Масштаб меча бота',
        globalspd: 'Общая скорость',
        swthresh: 'Порог удара',
        stamblock: 'Выносливость на блок',
        stamswing: 'Выносливость на удар',
        kbforce: 'Сила отбрасывания',
        unbdur: 'Длительность неустойчивости',
        unbcombo: 'Комбо при неустойчивости',
        stamreg: 'Регенерация выносливости',
        lmbcost: 'Стоимость ЛКМ % от вын.',
        lmbdmg: 'Урон ЛКМ %',
        rageper: 'Ярость за удар',
        ragebuf: 'Бонус ярости',
        exhdur2: 'Длительность истощения',
        exhspd2: 'Скорость истощения',
        exhswd2: 'Меч истощения',
        swres: 'Сопротивление меча',
        bladeKB: 'Отбрасывание клинком',
        bodyKB: 'Отбрасывание телом',
        blockSlowDur: 'Длительность замедления при блоке',
        blockSlowMult: 'Множитель замедления при блоке',
        deflectMin: 'Мин. отклонение',
        deflectMax: 'Макс. отклонение',
        swordback: 'Отвод меча назад',
        blockKB: 'Отбрасывание при блоке',
        disarmchance: 'Шанс обезоруживания',
        orbitwindow: 'Окно орбиты',
        orbitturns: 'Оборотов орбиты',
        stamorbit: 'Выносливость на орбиту',
        flickwindow: 'Окно флика',
        flickminvel: 'Мин. скорость флика',
        flickminamp: 'Мин. амплитуда флика',
        flickcount: 'Кол-во смен направления',
        flickmaxmult: 'Макс. амплитуда флика',
        stamflick: 'Выносливость на флик',
        dbg: 'Режим отладки'
      },
      staticText: {
        '#sec-local-players .sec-title': 'ЛОКАЛЬНЫЕ ИГРОКИ',
        '#hint': 'WASD — движение | T — манекен | колесо — масштаб камеры | Enter — переименовать',
        '#adisplay': 'поворот: (0,0) | угол: 0°',
        '#hud-player-name': 'ИГРОК',
        '#hud-b-label': 'БОТ',
        '#btn-export': 'ЭКСПОРТ НАСТРОЕК → БУФЕР ОБМЕНА',
        'label[for="gamepad-player-slot"]': 'Управление геймпадом 1',
        'label[for="local-faction-mode"]': 'Режим фракций и победы',
        'label[for="cb-coopdefeatall"]': 'Поражение в кооперативе только когда все игроки мертвы',
        'label[for="cb-gamepadflickdet"]': 'Геймпад: отдельное обнаружение флика',
        'label[for="cb-debugbrowser"]': 'Отладка: разблокировка ПКМ/клавиш в браузере',
        '#gamepad-player-slot option[value="0"]': 'Игрок 1 с клавиатурой',
        '#gamepad-player-slot option[value="1"]': 'Игрок 2',
        '#gamepad-player-slot option[value="2"]': 'Игрок 3',
        '#gamepad-player-slot option[value="3"]': 'Игрок 4',
        '#local-faction-mode option[value="ffa"]': 'Игрок против игрока',
        '#local-faction-mode option[value="coop"]': 'Игроки против ботов',
        '#profile-overlay h2': 'ПРОФИЛЬ И СМЕЩЕНИЕ ТЕЛА',
        '#profile-overlay p': 'Профиль, сеть и смещение тела находятся здесь.',
        '#name-overlay .ov-title': 'ИМЯ И ЩИТ',
        '#name-overlay .ov-sub': 'Выберите имя и начальный щит',
        '#name-confirm': 'ПОДТВЕРДИТЬ',
        '#net-screen-main .ov-title': 'СЕТЬ',
        '#net-screen-main .ov-sub': 'Профиль и подключение',
        '#net-close-btn': 'НАЗАД',
        '#net-screen-friends .ov-title': 'ДРУЗЬЯ И ID',
        '#net-screen-lobby .ov-title': 'ЛОББИ БЫСТРОГО МАТЧА',
        '#net-screen-chat .ov-title': 'ЧАТ'
      },
      placeholders: {
        '#name-input': 'Игрок',
        '#net-friend-name': 'Имя',
        '#net-friend-id': 'ID друга',
        '#net-chat-input': 'Сообщение...'
      },
      titles: {
        '#mob-bot-shield-btn': 'Щит бота',
        '#mob-bot-weapon-btn': 'Оружие бота',
        '#mob-weapon-btn': 'Сменить оружие',
        '#mob-throw-btn': 'Бросить оружие',
        '#mob-zone-btn': 'Зона арены'
      },
      controls: [
        'WASD — движение игрока',
        'Мышь — поворот и прицел',
        'ЛКМ — обычный удар',
        'ПКМ — управление манекеном',
        'Колесо — масштаб камеры',
        'T — вкл/выкл манекен'
      ],
      runtime: {
        wins: 'ПОБЕД {count}',
        respawn: 'ВОЗРОЖДЕНИЕ',
        playersWin: 'ПОБЕДА ИГРОКОВ',
        botsWin: 'ПОБЕДА БОТОВ',
        playerWin: 'ПОБЕДА ИГРОКА',
        series: 'СЧЁТ {wins}/{target}',
        playerName: 'Игрок',
        botName: 'Бот',
        seriesChampion: 'ПОБЕДИТЕЛЬ СЕРИИ: {name}!',
        champion: 'ПОБЕДИТЕЛЬ: {name}!',
        zoneOn: 'ЗОНА АКТИВНА',
        zoneOff: 'ЗОНА ВЫКЛ',
        lobbyConnect: 'ПОДКЛЮЧЕНИЕ К {name}...',
        spriteMissing: 'Отсутствует файл: {name}',
        shieldPlayer: 'ЩИТ ИГР: {name}',
        shieldDummy: 'ЩИТ БОТ: {name}',
        shieldNone: 'нет',
        fxOrbit: 'ОРБИТА',
        fxFlick: 'ФЛИК',
        fxSwing: 'ВЗМАХ',
        fxRage: 'ЯРОСТЬ!',
        fxThrow: 'БРОСОК!',
        fxPickup: 'ПОДОБРАН',
        fxShieldBash: 'БАШ!',
        fxBash: 'УДАР ЩИТОМ!',
        gamepadUnavailable: 'Gamepad API недоступен в этом браузере',
        gamepadPressAny: 'Нажмите любую кнопку на геймпаде\n(getGamepads() всё ещё пуст)',
        gamepadDetected: 'Обнаружен, но не захвачен:\n{items}'
      }
    }
  };

  const lang = 'en';

  function walk(key){
    return key.split('.').reduce((acc, part) => acc && acc[part], STRINGS[lang]);
  }

  function format(text, vars){
    if(!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  function t(key, vars){
    const value = Object.prototype.hasOwnProperty.call(FLAT_STRINGS, key) ? FLAT_STRINGS[key] : walk(key);
    return format(value == null ? key : value, vars);
  }

  function text(key, fallback, vars){
    const resolved = Object.prototype.hasOwnProperty.call(FLAT_STRINGS, key) || walk(key) != null
      ? t(key, vars)
      : fallback;
    return format(resolved == null ? fallback : resolved, vars);
  }

  function setText(selector, text){
    const el = document.querySelector(selector);
    if(el && text != null) el.textContent = text;
  }

  function setAttr(selector, attr, text){
    const el = document.querySelector(selector);
    if(el && text != null) el.setAttribute(attr, text);
  }

  function setRowLabel(id, text){
    const valueEl = document.getElementById('vl-' + id);
    const labelEl = valueEl?.closest('.row')?.querySelector('.row-head label');
    if(labelEl) labelEl.textContent = text;
  }

  function buttonText(name, state){
    return t('buttons.' + name + '.' + state);
  }

  function runtimeText(name, vars){
    return t('runtime.' + name, vars);
  }

  function applyStaticText(){
    document.title = t('title');
    Object.entries(STRINGS[lang].staticText).forEach(([selector, text]) => setText(selector, text));
    Object.entries(STRINGS[lang].placeholders).forEach(([selector, text]) => setAttr(selector, 'placeholder', text));
    Object.entries(STRINGS[lang].titles).forEach(([selector, text]) => setAttr(selector, 'title', text));
    Object.entries(STRINGS[lang].rows).forEach(([id, text]) => setRowLabel(id, text));
    document.querySelectorAll('#controls .sec-title').forEach((el, idx) => {
      if(STRINGS[lang].sections[idx]) el.textContent = STRINGS[lang].sections[idx];
    });
    document.querySelectorAll('#controls .keys .key').forEach((el, idx) => {
      if(STRINGS[lang].controls[idx]) el.textContent = STRINGS[lang].controls[idx];
    });
    const infoRows = document.querySelectorAll('#infobar .ir');
    if(infoRows[0]){
      const s = infoRows[0].querySelector('span');
      if(s) s.textContent = t('hud.root');
    }
    if(infoRows[1]){
      const s = infoRows[1].querySelector('span');
      if(s) s.textContent = t('hud.bodyOffset');
    }
  }

  function refreshRuntimeText(){
    setText('#dtoggle', buttonText('dtoggle', (typeof dummyOn !== 'undefined' && dummyOn) ? 'on' : 'off'));
    setText('#btn-balls', buttonText('balls', (typeof ballsActive !== 'undefined' && ballsActive) ? 'on' : 'off'));
    setText('#btn-boxes', buttonText('boxes', (typeof boxesOn !== 'undefined' && boxesOn) ? 'on' : 'off'));
    setText('#btn-blockkb', buttonText('blockKb', (typeof blockKnockOn !== 'undefined' && blockKnockOn) ? 'on' : 'off'));
    setText('#musicToggleBtn', buttonText('music', (typeof musicEnabled !== 'undefined' && musicEnabled) ? 'on' : 'off'));
  }

  function apply(){
    applyStaticText();
    refreshRuntimeText();
  }

function applyI18nToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    // Если текст найден — заменяем, иначе оставляем пустым
    if (text) {
      el.textContent = text;
    } else {
      // Если ключа нет — добавляем предупреждение в консоль
      console.warn(`⚠️ i18n: ключ "${key}" не найден`);
    }
  });
}
  document.addEventListener('DOMContentLoaded', function() {
    applyI18nToDOM();
    if (typeof applyStaticText === 'function') {
      applyStaticText();
    }
  });

  window.applyI18nToDOM = applyI18nToDOM;


  document.addEventListener('DOMContentLoaded', apply);
  window.I18N = { lang, strings: STRINGS, flat: FLAT_STRINGS, t, text, format, buttonText, runtimeText, apply, refreshRuntimeText };
})();
