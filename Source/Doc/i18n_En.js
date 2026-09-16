// === src/core/i18n.js ===
(function(){
  'use strict';

  const FLAT_STRINGS = {
    'hud.debuff': 'DEBUFF',
    'hud.unbalanced': '💫 UNBALANCED',
    'hud.rageCharge': '🔥 {rage}/50 rage',
    'hud.botLabel': 'BOT',
    'hud.player2Label': 'PLAYER 2',
    'hud.probingApproach': 'APPROACH · FENCING',
    'hud.probingStrike': 'AIMING',
    'hud.probingRetreat': 'RETREAT',
    'hud.probingPause': 'PAUSE',
    'hud.probingMirrorBlock': 'MIRROR BLOCK',
    'hud.probingPhase': '⚔ PROBING · {state}',
    'hud.pokeDodge': '➜ POKE DODGE',
    'hud.lungeBack': '↩ LUNGE PREP',
    'hud.lungeForward': '➜ LUNGE',
    'hud.harassApproach': 'APPROACH',
    'hud.harassStrike': 'STRIKE',
    'hud.harassOrbit': 'ORBIT',
    'hud.harassPhase': '⚔ HARASS · {phase}',
    'hud.phaseAttack': '⚔ ATTACK',
    'hud.phaseRetreat': '🏃 RETREAT',
    'hud.phaseRest': '😮‍💨 REST',
    'hud.duelistStyle': ' 🛡DUE',
    'hud.mirrorStyle': ' 🪞MIR',
    'hud.swordStyle': ' ⚔SWD',
    'hud.botExhausted': '😫 EXHAUSTED',
    'common.dodge': 'DODGE',
    'controls.move': 'WASD - move player',
    'controls.mouse': 'Mouse - turn and aim',
    'controls.lmb': 'LMB - basic swing',
    'controls.rmb': 'RMB - control dummy',
    'controls.wheel': 'Wheel - zoom camera',
    'controls.toggle': 'T - toggle dummy',
    'controls.rename': 'Enter - rename',
    'controls.pause': 'P - pause',
    'controls.zone': 'O - arena zone',
    'gamepad.diagnostic.noApi': '🎮 navigator.getGamepads not available in this browser',
    'gamepad.diagnostic.pressButton': '🎮 Press any button on the gamepad\n(getGamepads() still returns empty)',
    'gamepad.diagnostic.detectedNotHeld': '🎮 Detected but not picked up:\n{devices}',
    'gamepad.virtualKeyboard.hint': 'A — enter · B — back · Y — space · X — backspace',
    'gamepad.virtualKeyboard.special.abc': 'ABC/RUS',
    'gamepad.virtualKeyboard.special.space': 'SPACE',
    'gamepad.virtualKeyboard.special.backspace': '⌫',
    'gamepad.virtualKeyboard.special.done': 'DONE',
    'net.wins.score': 'SCORE {wins}/{total}',
    'net.wins.player': 'Player',
    'net.wins.bot': 'Bot',
    'net.wins.seriesWin': '🏆 {name} WON THE SERIES!',
    'net.wins.champion': '🏆 {name} WON!',
    'net.zone.active': 'ZONE ACTIVE',
    'net.zone.inactive': 'ZONE OFF',
    'net.zone.damageSuffix': '🔥',
    'lobby.status.waiting': 'No one yet. Waiting...',
    'lobby.status.join': '🔗 Join',
    'lobby.status.found': '🔗 Found {name} — connecting...',
    'lobby.status.connecting': '🔗 CONNECTING TO {name}...',
    'lobby.status.hubNotResponding': '⚠ Hub not responding (maybe on another server)',
    'lobby.status.connected': '🟢 In lobby!',
    'lobby.status.disconnected': 'Disconnected from lobby',
    'lobby.status.error': '⚠ Lobby error: {error}',
    'lobby.status.serverFirst': '⚠ Connect to server first',
    'lobby.status.connectingHub': 'Connecting...',
    'lobby.status.host': '🟢 You are host. Waiting for players...',
    'lobby.status.hostFound': 'Host found, connecting...',
    'lobby.player.default': 'Player',
    'main.staminaWarning': '⚠ NO STAMINA',
    'main.rageActivated': '🔥 RAGE!',
    'main.shieldPlayer': 'SHIELD P: {name}',
    'main.shieldBot': 'SHIELD D: {name}',
    'main.weaponPlayer': 'WEAPON: {name}',
    'main.weaponBot': 'WEAPON: {name}',
    'main.rageAdd': '🔥+100 RAGE',
    'main.botRage': '🔥 BOT RAGE',
    'main.aiOn': '▶ AI ON',
    'main.aiPause': '⏸ AI PAUSE',
    'main.spikedBash': '🗡🛡 SPIKE BASH!',
    'main.bash': '🛡 BASH!',
    'main.orbit': '🌀 ORBIT',
    'main.flick': '⚡ FLICK',
    'main.swing': '⚔ SWING',
    'main.hitDamage': '-{damage}HP',
    'main.champion': '🏆 {name} WON THE SERIES!',
    'main.zoneActive': 'ZONE ACTIVE',
    'main.zoneInactive': 'ZONE OFF',
    'main.unknownWeapon': 'UNKNOWN',
    'main.shieldNone': 'none',
    'main.rageActivatedShort': '🔥 RAGE!',
    'main.botRageShort': '🔥 BOT RAGE',
    'main.staminaWarningShort': '⚠ NO STAMINA',
    'combat.weaponDropped': 'WEAPON DROPPED!',
    'combat.poke': 'POKE!',
    'combat.block': 'BLOCK!',
    'combat.style': 'STYLE: {name}',
    'combat.clash': 'CLASH!',
    'playercontrols.status.slot0': 'Gamepad mirrors Player 1 controls',
    'playercontrols.status.slotN': 'Gamepad controls Player {slot}; AI for this character is disabled',
    'playercontrols.botCountTitle': 'Number of AI bots beyond local players',
    'playercontrols.addBotTitle': 'Add AI bot to local PvP',
    'playercontrols.hitOrbit': '🌀 ORBIT',
    'playercontrols.hitFlick': '⚡ FLICK',
    'playercontrols.hitSwing': '⚔ SWING',
    'playercontrols.rage': '🔥 RAGE!',
    'factions.wins.prefix': 'WINS {wins}',
    'factions.respawn': 'RESPAWN',
    'factions.coop.playersWin': '🏆 PLAYERS WON',
    'factions.coop.botsWin': '🤖 BOTS WON',
    'factions.ffa.playerWin': '🏆 PLAYER VICTORY',
    'factions.ffa.botsWin': '🤖 BOTS WON',
    'weapon.sword': 'Sword',
    'weapon.rapier': 'Rapier',
    'weapon.dagger': 'Dagger',
    'weapon.spear': 'Spear',
    'weapon.halberd': 'Halberd',
    'weapon.axe': 'Axe',
    'weapon.longsword': 'Longsword',
    'weapon.greatsword': 'Greatsword',
    'weapon.hammer': 'Hammer',
    'weapon.staff': 'Staff',
    'weapon.magicstaff': 'Magic Staff',
    'weapon.flail': 'Flail',
    'weapon.wand': 'Wand',
    'weapon.bow': 'Bow',
    'weapon.crossbow': 'Crossbow',
    'weapon.thrown': '🗡 THROWN!',
    'weapon.picked': '🗡 PICKED UP',
    'ranged.wandShot': '🗡 SHOT',
    'ranged.wandCharge': '🔮 CHARGING...',
    'ranged.wandRelease': '💥 EXPLOSION!',
    'ranged.wandNoRage': '⚠ NO RAGE!',
    'ranged.wandNoStamina': '⚠ NO STAMINA!',
    'ranged.crossbowReload': '🔄 RELOADING...',
    'ranged.magicStaffCharge': '🔮 CHARGE!',
    'ranged.magicStaffExplosion': '💥 EXPLOSION!',
    'ranged.magicStaffNeedRage': '⚠ NEED >2 SEC',
    'ranged.botDodge': '💫 DODGE!',
    'ranged.dodgeTrail': '💨 DODGE',
    'ranged.arrowHit': '🏹 HIT',
    'ranged.wandHit': '✨ MAGIC',
    'ranged.arrowDamage': 'ARROW {damage}',
    'ranged.push': 'PUSH',
    'ranged.chargeNeedHold': 'Hold >2 sec',
    'ranged.chargePercent': '{percent}%',
    'ranged.abortReason.playerRecovered': 'PLAYER RECOVERED',
    'ranged.abortReason.tooFar': 'TOO FAR',
    'ranged.abortReason.tooClose': 'TOO CLOSE',
    'ranged.abortReason.noStamina': 'NO STAMINA',
    'ranged.abort': 'STOP {reason}',
    'sprites.shield.none': 'No shield',
    'sprites.shield.small': 'Small',
    'sprites.shield.large': 'Large',
    'sprites.shield.tower': 'Tower',
    'sprites.shield.spiked_small': 'Spiked (small)',
    'sprites.shield.spiked_medium': 'Spiked (medium)',
    'sprites.shield.spiked_large': 'Spiked (large)',
    'sprites.error.fileNotFound': '⚠ File not found: {filename}',
    'ai.rageActivated': '🔥',
    'ai.crown': '👑 CROWN!',
    'ai.ignore': '😤 IGNORE!',
    'ai.flee': '😱 FLEEING!',
    'ai.reconsider': '🤔 CHANGED MIND!',
    'ai.enough': '🤔 ENOUGH!',
    'ai.dodge': 'DODGE',
    'ai.lunge': '💨 DASH!',
    'ai.probing': '⚔ PROBING',
    'ai.mirror': '🪞 MIRROR',
    'ai.duelist': '⚔ DUELIST',
    'ai.swordsman': '⚔ SWORDSMAN',
    'ai.retreat': '🏃 RETREAT',
    'ai.attack': '⚔ ATTACK',
    'ai.breather': '😮‍💨 REST',
    'ai.harass': '⚔ HARASS',
    'ai.orbit': '🌀 ORBIT',
    'ai.feint': '💫 FEINT',
    'ai.spin': '🌀 SPIN',
    'ai.pokeDodge': '💨 DODGE',
    'net.shield.none': 'No shield',
    'net.shield.small': 'Small — speed -6%',
    'net.shield.large': 'Large — speed -18%',
    'net.shield.tower': 'Tower — speed -30%',
    'net.shield.spiked_small': 'Spiked small — speed -12%, bash 8 dmg',
    'net.shield.spiked_medium': 'Spiked medium — speed -24%, bash 12 dmg',
    'net.shield.spiked_large': 'Spiked large — speed -36%, bash 18 dmg',
    'net.profile.unnamed': '(not set)',
    'net.friends.empty': 'Empty — add a friend',
    'net.lobby.connectFirst': '👆 Select a server (Main/Backup) first',
    'net.autoConnect': '⏳ auto-connecting to server...',
    'net.autoConnectFailed': '❌ Connection failed. Try via network menu.',
    'net.idCopied': '✅',
    'net.idCopy': '📋',
    'net.friend.name': 'Name:',
    'net.friend.id': 'ID:',
    'net.addFriend': 'ADD',
    'net.editFriend': 'Edit',
    'net.removeFriend': 'Remove',
    'net.connectFriend': 'Connect',
    'net.server.choose': '👆 select a server above (Main/Backup)',
    'net.server.connecting': '⏳ connecting: {label} ({host})...',
    'net.server.notResponding': '⏱ {label} not responding. Try another server.',
    'net.server.online': '✅ Online ({label}) · ID: {id}',
    'net.server.incoming': '📞 incoming from {name}',
    'net.server.error': '⚠ {error}',
    'net.server.unavailable': '❌ Friend not found',
    'net.server.unavailableId': '❌ {label} unavailable. Try another server.',
    'net.server.reconnecting': '↩ server: reconnecting...',
    'net.server.reconnectFailed': '❌ Reconnect failed. Select server again.',
    'net.server.notReady': '⚠ server not ready',
    'net.connecting.to': '🔗 connecting to {id}...',
    'net.fastChannel': '⚡ fast channel open',
    'net.connecting.with': '⏳ connecting with {name}...',
    'net.connected.with': '🟢 connected with {name}',
    'net.disconnected': '🔴 disconnected',
    'net.chat.connected': '— Connected with {name} —',
    'net.chat.disconnected': '— Connection lost —',
    'net.chat.me': 'I',
    'net.chat.placeholder': 'Message...',
    'net.chat.send': 'Send',
    'net.chat.disconnect': 'Disconnect',
    'net.chat.play': 'Play',
    'mobile.start': 'в–¶ START',
    'mobile.fullscreen': 'Fullscreen',
    'mobile.controls.move': 'Move',
    'mobile.controls.attack': 'Attack',
    'mobile.controls.dodge': 'Dodge',
    'mobile.controls.throw': 'Throw',
    'mobile.controls.weapon': 'Weapon',
    'mobile.controls.shield': 'Shield',
    'mobile.controls.shieldFlip': 'Flip Shield',
    'mobile.controls.style': 'Style',
    'mobile.controls.zone': 'Zone',
    'mobile.controls.music': 'Music',
    'mobile.controls.menu': 'Menu',
    'mobile.controls.quickMatch': 'Quick Match',
    'mobile.controls.profile': 'Profile',
    'mobile.controls.network': 'Network',
    'mobile.controls.resume': 'Resume',
    'mobile.controls.restart': 'Restart',
    'mobile.controls.settings': 'Settings',
    'mobile.controls.controls': 'Controls',
    'mobile.menu.title': 'PAUSE',
    'mobile.menu.subtitle': 'Game paused',
    'mobile.quickmatch.connecting': '⏳ auto-connecting to server...',
    'mobile.quickmatch.failed': '❌ Connection failed. Try via network menu.',
    'mobile.quickmatch.connected': '✅ Connected! Entering lobby...',
    'mobile.quickmatch.waiting': '⏳ Waiting for opponent...',
    'mobile.quickmatch.found': '🔗 Opponent found! Starting game...',
    'mobile.quickmatch.cancel': 'Cancel',
    'mobile.toast.weaponChanged': '⚔ Weapon changed',
    'mobile.toast.shieldChanged': '🛡 Shield changed',
    'mobile.toast.shieldFlipped': '🔄 Shield flipped',
    'mobile.toast.styleChanged': '⚔ Style changed',
    'mobile.toast.zoneToggled': '🌐 Zone toggled',
    'mobile.toast.musicToggled': '🎵 Music toggled',
    'mobile.toast.weaponThrown': '🗡 Weapon thrown',
    'mobile.toast.dodge': '💨 Dodge!',
    'mobile.toast.respawn': '🔄 Respawn',
    'mobile.toast.dead': '💀 You died',
    'mobile.toast.victory': '🏆 Victory!',
    'mobile.toast.defeat': '💀 Defeat',
    'flail.staminaBonus': '⚡ BOOST!',
    'mobile.controls.pc': 'CONTROLS (PC)',
    'mobile.controls.pc.move': 'WASD вЂ” move',
    'mobile.controls.pc.mouse': 'Mouse вЂ” sword / aim',
    'mobile.controls.pc.lmb': 'LMB вЂ” hold sword',
    'mobile.controls.pc.shift': 'Shift вЂ” DODGE',
    'mobile.controls.pc.t': 'T вЂ” spawn bot',
    'mobile.controls.pc.e': 'E вЂ” AI on/off',
    'mobile.controls.pc.o': 'O / Р© вЂ” arena zone',
    'mobile.controls.pc.enter': 'Enter вЂ” pause menu',
    'mobile.controls.pc.esc': 'Esc вЂ” close menu',
    'flail.chainState.follow': 'FOLLOW',
    'flail.chainState.spin': 'SPIN',
    'flail.chainState.retract': 'RETRACT'
  };

  const STRINGS = {
    en: {
      title: 'Godgrave Arena',
      hud: {
        player: 'PLAYER',
        bot: 'BOT',
        player2: 'PLAYER 2',
        localPvp: 'LOCAL PVP',
        rageBuff: 'RAGE 2x',
        root: 'Root',
        bodyOffset: 'Body offset',
        pivot: 'pivot: (0,0) | angle: 0deg'
      },
      buttons: {
        export: 'EXPORT SETTINGS -> CLIPBOARD',
        exportCopied: 'COPIED!',
        dtoggle: {
          on: 'DUMMY: ON',
          off: 'DUMMY: OFF',
          pause: 'DUMMY: PAUSE'
        },
        balls: {
          on: 'STOP BALLS',
          off: 'SPAWN BALLS'
        },
        boxes: {
          on: 'BOXES: ON',
          off: 'BOXES: OFF'
        },
        blockKb: {
          on: 'BLOCK KNOCKBACK: ON',
          off: 'BLOCK KNOCKBACK: OFF'
        },
        music: {
          on: 'MUSIC: ON',
          off: 'MUSIC: OFF'
        }
      },
      labels: {
        gamepadPlayerSlot: 'Gamepad 1 controls',
        factionMode: 'Factions and victory',
        coopDefeatAll: 'Co-op defeat only when all players are dead',
        gamepadFlick: 'Gamepad: separate flick detection',
        debugBrowser: 'Debug: unlock browser RMB/keys'
      },
      options: {
        gamepadSlot1: 'Player 1 with keyboard',
        gamepadSlot2: 'Player 2',
        gamepadSlot3: 'Player 3',
        gamepadSlot4: 'Player 4',
        factionFfa: 'Player vs player',
        factionCoop: 'Players vs bots'
      },
      sections: [
        'Player visuals',
        'Arena background',
        'Model follow',
        'Body and shield',
        'Camera and pose',
        'Sword and hand',
        'Knife and back',
        'Spear and polearms',
        'AI behavior and probing',
        'Local players',
        'Mobile mode',
        'Bots and balance',
        'Sword energy',
        'Block and defense',
        'Blood',
        'Slowdowns',
        'Combat economy',
        'Debug',
        'Export and toggles',
        'Controls'
      ],
      rows: {
        playerglow: 'Player glow',
        playerrespawn: 'Player respawn (sec)',
        gamepadflickwindow: 'Gamepad flick: window (sec)',
        gamepadflickminvel: 'Gamepad flick: min speed',
        gamepadflickminamp: 'Gamepad flick: min amplitude',
        gamepadflickcount: 'Gamepad flick: swing count',
        gamepadflickmaxmult: 'Gamepad flick: max amplitude',
        gamepadstamflick: 'Gamepad flick: stamina',
        bgbright: 'Background brightness',
        gridbright: 'Grid brightness',
        dist: 'Distance',
        spd: 'Speed',
        inertia: 'Inertia',
        ex: 'Offset X',
        ey: 'Offset Y',
        blk: 'Lerp speed',
        adaY: '12 oclock height',
        adaD: 'Lower height',
        adaXb: 'Base X',
        adaXp: 'Peak X',
        ada12: '12 oclock peak',
        shieldSideSpd: 'Shield side speed',
        aex: 'Attack offset X',
        aey: 'Attack offset Y',
        as: 'Attack speed',
        sc0: 'Scale without sword',
        sc1: 'Scale with sword',
        scs: 'Scale lerp',
        srot: 'Sprite rotation',
        sox: 'Shift X',
        soy: 'Shift Y',
        cscl: 'Body scale',
        swlen: 'Sword length',
        flailspeedmult: 'Flail speed',
        flailsag: 'Flail sag',
        dzone: 'Dead zone',
        aiang: 'AI angle',
        duelrad: 'Duel radius',
        circchance: 'Circle chance',
        probingchance: 'Probing chance',
        probingretreat: 'Probing retreat',
        spindur: 'Spin duration',
        gamespeed: 'Game speed',
        camrows: 'Camera scale',
        musicvol: 'Music volume',
        botcount: 'Bot count',
        botspd: 'Bot speed',
        botdodgechance: 'Bot dodge chance %',
        botdodgetoward: 'Dodge toward player %',
        botscale: 'Bot scale',
        botswordscale: 'Bot sword scale',
        globalspd: 'Global speed',
        swthresh: 'Swing threshold',
        stamblock: 'Block stamina',
        stamswing: 'Swing stamina',
        kbforce: 'Knockback force',
        unbdur: 'Unbalance duration',
        unbcombo: 'Unbalance combo',
        stamreg: 'Stamina regen',
        lmbcost: 'LMB stamina cost %',
        lmbdmg: 'LMB damage %',
        rageper: 'Rage per hit',
        ragebuf: 'Rage buff',
        exhdur2: 'Exhaust duration',
        exhspd2: 'Exhaust speed',
        exhswd2: 'Exhaust sword',
        swres: 'Sword resistance',
        bladeKB: 'Blade knockback',
        bodyKB: 'Body knockback',
        blockSlowDur: 'Block slow duration',
        blockSlowMult: 'Block slow multiplier',
        deflectMin: 'Deflect min',
        deflectMax: 'Deflect max',
        swordback: 'Sword pullback',
        blockKB: 'Block knockback',
        disarmchance: 'Disarm chance',
        orbitwindow: 'Orbit window',
        orbitturns: 'Orbit turns',
        stamorbit: 'Orbit stamina',
        flickwindow: 'Flick window',
        flickminvel: 'Flick min speed',
        flickminamp: 'Flick min amplitude',
        flickcount: 'Flick count',
        flickmaxmult: 'Flick max amplitude',
        stamflick: 'Flick stamina',
        dbg: 'Debug mode'
      },
      staticText: {
        '#sec-local-players .sec-title': 'LOCAL PLAYERS',
        '#hint': 'WASD - move | T - dummy | wheel - camera zoom | Enter - rename',
        '#adisplay': 'pivot: (0,0) | angle: 0deg',
        '#hud-player-name': 'PLAYER',
        '#hud-b-label': 'BOT',
        '#btn-export': 'EXPORT SETTINGS -> CLIPBOARD',
        'label[for="gamepad-player-slot"]': 'Gamepad 1 controls',
        'label[for="local-faction-mode"]': 'Factions and victory',
        'label[for="cb-coopdefeatall"]': 'Co-op defeat only when all players are dead',
        'label[for="cb-gamepadflickdet"]': 'Gamepad: separate flick detection',
        'label[for="cb-debugbrowser"]': 'Debug: unlock browser RMB/keys',
        '#gamepad-player-slot option[value="0"]': 'Player 1 with keyboard',
        '#gamepad-player-slot option[value="1"]': 'Player 2',
        '#gamepad-player-slot option[value="2"]': 'Player 3',
        '#gamepad-player-slot option[value="3"]': 'Player 4',
        '#local-faction-mode option[value="ffa"]': 'Player vs player',
        '#local-faction-mode option[value="coop"]': 'Players vs bots',
        '#profile-overlay h2': 'PROFILE AND BODY OFFSET',
        '#profile-overlay p': 'Profile, network and body offset live here.',
        '#name-overlay .ov-title': 'NAME AND SHIELD',
        '#name-overlay .ov-sub': 'Choose a name and starting shield',
        '#name-confirm': 'CONFIRM',
        '#net-screen-main .ov-title': 'NETWORK',
        '#net-screen-main .ov-sub': 'Profile and connection',
        '#net-close-btn': 'BACK',
        '#net-screen-friends .ov-title': 'FRIENDS AND ID',
        '#net-screen-lobby .ov-title': 'QUICK MATCH LOBBY',
        '#net-screen-chat .ov-title': 'CHAT'
      },
      placeholders: {
        '#name-input': 'Player',
        '#net-friend-name': 'Name',
        '#net-friend-id': 'Friend ID',
        '#net-chat-input': 'Message...'
      },
      titles: {
        '#mob-bot-shield-btn': 'Bot shield',
        '#mob-bot-weapon-btn': 'Bot weapon',
        '#mob-weapon-btn': 'Change weapon',
        '#mob-throw-btn': 'Throw weapon',
        '#mob-zone-btn': 'Arena zone'
      },
      controls: [
        'WASD - move player',
        'Mouse - turn and aim',
        'LMB - basic swing',
        'RMB - control dummy',
        'Wheel - zoom camera',
        'T - toggle dummy'
      ],
      runtime: {
        wins: 'WINS {count}',
        respawn: 'RESPAWN',
        playersWin: 'PLAYERS WIN',
        botsWin: 'BOTS WIN',
        playerWin: 'PLAYER WINS',
        series: 'SCORE {wins}/{target}',
        playerName: 'Player',
        botName: 'Bot',
        seriesChampion: 'SERIES WINNER: {name}!',
        champion: 'WINNER: {name}!',
        zoneOn: 'ZONE ACTIVE',
        zoneOff: 'ZONE OFF',
        lobbyConnect: 'CONNECTING TO {name}...',
        spriteMissing: 'Missing file: {name}',
        shieldPlayer: 'SHIELD P: {name}',
        shieldDummy: 'SHIELD D: {name}',
        shieldNone: 'none',
        fxOrbit: 'ORBIT',
        fxFlick: 'FLICK',
        fxSwing: 'SWING',
        fxRage: 'RAGE!',
        fxThrow: 'THROWN!',
        fxPickup: 'PICKED UP',
        fxShieldBash: 'SPIKE-BASH!',
        fxBash: 'BASH!',
        gamepadUnavailable: 'Gamepad API unavailable in this browser',
        gamepadPressAny: 'Press any gamepad button\\n(getGamepads() is still empty)',
        gamepadDetected: 'Detected but not captured:\\n{items}'
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

  document.addEventListener('DOMContentLoaded', apply);
  window.I18N = { lang, strings: STRINGS, flat: FLAT_STRINGS, t, text, format, buttonText, runtimeText, apply, refreshRuntimeText };
})();
