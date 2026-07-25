(function(){
  'use strict';

  const KEY = 'godgrave.localFactionMode';
  let mode = localStorage.getItem(KEY) === 'coop' ? 'coop' : 'ffa';
  const wins = [0, 0, 0, 0];
  let botWins = 0;
  let roundEnding = false;

  function factionText(key, fallback, vars){
    return window.I18N ? window.I18N.t(key, vars) : fallback;
  }

  function playerRespawnSeconds(){
    if(typeof sv !== 'function') return 15;
    const value = sv('playerrespawn');
    return Number.isFinite(value) ? Math.max(0, value) : 15;
  }

  function players(){
    if(typeof P === 'undefined') return [];
    const result = [P];
    if(typeof LocalPlayerControls !== 'undefined'){
      for(let i = 1; i < LocalPlayerControls.slots.length; i++){
        const slot = LocalPlayerControls.slots[i];
        if(slot.source && slot.entity && !result.includes(slot.entity)) result.push(slot.entity);
      }
    }
    return result;
  }

  function isPlayer(ent){ return players().includes(ent); }
  function bots(){ return typeof ALL_BOTS === 'undefined' ? [] : ALL_BOTS.filter(ent => !isPlayer(ent)); }
  function alivePlayers(){ return players().filter(ent => ent.hp > 0 && !ent._defeated); }
  function aliveBots(){ return bots().filter(ent => ent.hp > 0 && !ent._defeated); }

  function canDamage(attacker, defender){
    if(!attacker || !defender || attacker === defender) return attacker !== defender;
    if(isPlayer(attacker) && isPlayer(defender)) return mode === 'ffa';
    if(!isPlayer(attacker) && !isPlayer(defender)) return false;
    return true;
  }

  function canFight(a, b){ return canDamage(a, b) || canDamage(b, a); }

  function contact(a, b){
    const aPlayer = isPlayer(a);
    const bPlayer = isPlayer(b);
    if(!aPlayer && bPlayer){ a._lastPlayerTarget = b; a._lastPlayerContactAt = GameTime; }
    if(!bPlayer && aPlayer){ b._lastPlayerTarget = a; b._lastPlayerContactAt = GameTime; }
  }

  function getBotTarget(bot){
    const alive = alivePlayers();
    if(!alive.length) return null;
    const aiBots = bots();
    const botIndex = Math.max(0, aiBots.indexOf(bot));
    const mainCount = Math.min(players().length, aiBots.length);
    if(bot._aiState) bot._aiState._isMain = botIndex < mainCount;

    const recentContact = bot._lastPlayerTarget && alive.includes(bot._lastPlayerTarget) &&
      GameTime - (bot._lastPlayerContactAt || 0) < 4;
    if(recentContact) return bot._lastPlayerTarget;

    if(botIndex < mainCount){
      const assigned = players()[botIndex];
      if(assigned && alive.includes(assigned)) return assigned;
      return alive[botIndex % alive.length];
    }

    if(!bot._randomPlayerTarget || !alive.includes(bot._randomPlayerTarget) || GameTime >= (bot._nextTargetPick || 0)){
      bot._randomPlayerTarget = alive[Math.floor(Math.random() * alive.length)];
      bot._nextTargetPick = GameTime + 2 + Math.random() * 3;
    }
    return bot._randomPlayerTarget;
  }

  function refreshWins(){
    const p = document.getElementById('hud-p-wins');
    const d = document.getElementById('hud-b-wins');
    if(p) p.textContent = wins[0] ? factionText('factions.wins.prefix', `WINS ${wins[0]}`, { wins: wins[0] }) : '';
    if(d) d.textContent = wins[1] ? factionText('factions.wins.prefix', `WINS ${wins[1]}`, { wins: wins[1] }) : '';
  }

  function clearRespawn(ent){
    if(!ent) return;
    if(ent._respawnTimerId){
      clearTimeout(ent._respawnTimerId);
      ent._respawnTimerId = 0;
    }
    ent._respawnPending = false;
    ent._respawnAt = 0;
  }

  function clearAllRespawns(){
    players().forEach(clearRespawn);
  }

  function dropWeaponOnDeath(ent){
    if(typeof disarmEntity === 'function' && ent && ent.hasWeapon !== false) disarmEntity(ent);
  }

  function addDeathFx(ent, isBot){
    if(typeof entityBodyCenter !== 'function' || typeof spawnBlood !== 'function') return;
    const bc = $.POS.body(ent);
    for(let i = 0; i < 8; i++) spawnBlood(bc.x, bc.y, Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4));
    if(typeof DEATH !== 'undefined' && DEATH && Array.isArray(DEATH.deathCross)){
      DEATH.deathCross.push({ x: bc.x, y: bc.y, timer: 2.0, isBot: !!isBot });
    }
    if(typeof playSound === 'function') $.S.play('death');
  }

  function clearEntityState(ent){
    if(!ent) return;
    if(typeof clearEntityChargeState === 'function') clearEntityChargeState(ent);
    ent.hp = 100;
    ent.stamina = ent.stamMax || 100;
    ent.rage = 0;
    ent.rageBuffEnd = -1;
    ent._defeated = false;
    ent.exhausted = 0;
    ent.unbalanced = 0;
    ent.vx = 0;
    ent.vy = 0;
    ent.vel = 0;
    ent._dvx = 0;
    ent._dvy = 0;
    ent._hitCD = -1;
    ent._swingBlockCD = -1;
    ent._blockSlow = -1;
    ent._hadExhaustion = false;
    ent._wasExhausted = false;
    ent._recovering = false;
    ent._recoverProgress = 0;
    ent._manualAttackInput = false;
    ent._manualGestureSuppressUntil = RealTime + 0.25;
    if(ent._aiState){
      ent._aiState._fakeMDown = false;
      ent._aiState._fakeKeys.w = false;
      ent._aiState._fakeKeys.a = false;
      ent._aiState._fakeKeys.s = false;
      ent._aiState._fakeKeys.d = false;
    }
  }

  function playerRespawnPoint(ent){
    const roster = players();
    const slot = Math.max(0, roster.indexOf(ent));
    const total = Math.max(1, roster.length);
    const step = Math.min(0.18, 0.5 / Math.max(1, total));
    const start = 0.5 - (step * (total - 1)) / 2;
    return {
      x: $.M.clamp(W * 0.18 + slot * 24, 60, W - 100),
      y: $.M.clamp(H * (start + slot * step), 60, H - 60)
    };
  }

  function respawnPlayer(ent){
    if(!ent || roundEnding || mode !== 'coop' || !isPlayer(ent) || !ent._defeated) return;
    clearRespawn(ent);
    clearEntityState(ent);
    const point = playerRespawnPoint(ent);
    ent.x = point.x;
    ent.y = point.y;
    if(typeof hitFX !== 'undefined' && Array.isArray(hitFX)){
      $.FX.hit({ x: ent.x, y: ent.y - 40, t: factionText('factions.respawn', 'RESPAWN'), life: 45, big: true, col: '#66ffaa' });
    }
    if(typeof playSound === 'function') $.S.play('pickup');
  }

  function schedulePlayerRespawn(ent){
    if(mode !== 'coop' || !isPlayer(ent) || roundEnding) return;
    const seconds = playerRespawnSeconds();
    if(seconds <= 0) return;
    clearRespawn(ent);
    const delayMs = Math.round(seconds * 1000);
    ent._respawnPending = true;
    ent._respawnAt = Date.now() + delayMs;
    ent._respawnTimerId = setTimeout(() => respawnPlayer(ent), delayMs);
  }

  function resetRound(){
    clearAllRespawns();
    const all = [...players(), ...bots()];
    all.forEach((ent, index) => {
      clearEntityState(ent);
      if(ent.hasWeapon === false && typeof setWeapon === 'function') setWeapon(ent, ent.weaponType || 0);
      const angle = index / Math.max(1, all.length) * Math.PI * 2;
      ent.x = $.M.clamp(W / 2 + Math.cos(angle) * 180, 60, W - 100);
      ent.y = $.M.clamp(H / 2 + Math.sin(angle) * 150, 60, H - 60);
    });
    DEATH.pDead = false;
    DEATH.dDead = false;
    DEATH.fadeIn = false;
    DEATH.fadeAlpha = 0;
    DEATH.text = '';
    roundEnding = false;
  }

  function finishRound(text, winner){
    if(roundEnding) return true;
    roundEnding = true;
    clearAllRespawns();
    if(isPlayer(winner)){
      const slot = winner === P ? 0 : winner._playerSlot;
      if(Number.isInteger(slot)) wins[slot]++;
    } else {
      botWins++;
    }
    refreshWins();
    DEATH.pDead = true;
    DEATH.fadeAlpha = 0;
    DEATH.fadeIn = true;
    DEATH.text = text;
    DEATH.textCol = '#ffdd44';
    setTimeout(resetRound, 2000);
    return true;
  }

  function handleDeath(ent){
    if(!(typeof LocalPlayerControls !== 'undefined' && LocalPlayerControls.isLocalPvP())) return false;
    if(ent._defeated) return true;
    ent._defeated = true;
    ent.hp = 0;
    dropWeaponOnDeath(ent);
    addDeathFx(ent, !isPlayer(ent));
    if(isPlayer(ent)) schedulePlayerRespawn(ent);

    const alivePlayersNow = alivePlayers();
    const aliveBotsNow = aliveBots();
    if(mode === 'coop'){
      if(!aliveBotsNow.length) return finishRound(factionText('factions.coop.playersWin', 'PLAYERS WON'), alivePlayersNow[0] || P);
      if(!alivePlayersNow.length) return finishRound(factionText('factions.coop.botsWin', 'BOTS WON'), aliveBotsNow[0]);
    } else {
      clearRespawn(ent);
      if(!alivePlayersNow.length) return finishRound(factionText('factions.ffa.botsWin', 'BOTS WON'), aliveBotsNow[0]);
      if(alivePlayersNow.length === 1 && !aliveBotsNow.length) return finishRound(factionText('factions.ffa.playerWin', 'PLAYER VICTORY'), alivePlayersNow[0]);
    }
    return true;
  }

  function setMode(value){
    mode = value === 'coop' ? 'coop' : 'ffa';
    localStorage.setItem(KEY, mode);
    const select = document.getElementById('local-faction-mode');
    if(select) select.value = mode;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('local-faction-mode');
    if(select){
      select.value = mode;
      select.addEventListener('change', () => setMode(select.value));
    }
  });

  window.FactionRules = {
    players,
    bots,
    isPlayer,
    canDamage,
    canFight,
    contact,
    getBotTarget,
    handleDeath,
    setMode,
    getMode: () => mode
  };
})();
