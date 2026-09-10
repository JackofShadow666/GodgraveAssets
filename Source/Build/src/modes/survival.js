(function(){
  'use strict';

  const MATCH_SECONDS = 360;
  const INTERMISSION_SECONDS = 6;
  const PICKUP_LIFETIME = 15;
  const HEAL_AMOUNT = 50;
  let active = false;
  let elapsed = 0;
  let wave = 0;
  let intermission = -1;
  let ordinarySinceBoss = 0;
  let ending = false;
  let pickups = [];
  let lastDeathPoint = null;
  let savedBotCount = null;

  function t(key, fallback, vars){ return window.I18N ? window.I18N.t(key, vars) : fallback; }
  function players(){ return typeof FactionRules !== 'undefined' ? FactionRules.players() : [P]; }
  function aiBots(){ return typeof FactionRules !== 'undefined' ? FactionRules.bots() : []; }
  function alivePlayers(){ return players().filter(ent => ent && ent.hp > 0 && !ent._defeated); }
  function aliveBots(){ return aiBots().filter(ent => ent && ent.hp > 0 && !ent._defeated); }

  function setHud(){
    const hud = document.getElementById('survival-hud');
    if(hud) hud.classList.toggle('visible', active);
  }

  function updateHud(){
    const timer = document.getElementById('survival-timer');
    const label = document.getElementById('survival-wave');
    if(timer){
      const remain = Math.max(0, Math.ceil(MATCH_SECONDS - elapsed));
      timer.textContent = String(Math.floor(remain / 60)).padStart(2,'0') + ':' + String(remain % 60).padStart(2,'0');
    }
    if(!label) return;
    if(elapsed >= MATCH_SECONDS && aliveBots().length){
      label.textContent = t('survival.cleanup', 'CLEAR THE LAST WAVE');
    } else if(intermission >= 0){
      label.textContent = t('survival.intermission', 'NEXT WAVE IN {seconds}', { seconds: Math.max(0, Math.ceil(intermission)) });
    } else {
      label.textContent = t('survival.wave', 'WAVE {wave}', { wave });
    }
  }

  function resetPlayers(){
    for(const ent of players()){
      ent.hp = ent.maxHp || 100;
      ent.stamina = ent.stamMax || ent.maxStamina || 100;
      ent._defeated = false;
      ent.vx = 0;
      ent.vy = 0;
    }
  }

  function removeOldAiBots(){
    const roster = players();
    for(let i = ALL_BOTS.length - 1; i >= 0; i--){
      if(!roster.includes(ALL_BOTS[i])) ALL_BOTS.splice(i, 1);
    }
  }

  function desiredWaveCount(){
    if(elapsed < 120) return 1 + Math.floor(Math.random() * 3);
    if(elapsed < 240) return 4 + Math.floor(Math.random() * 2);
    return 5 + Math.floor(Math.random() * 2);
  }

  function setBotSlider(count){
    const input = document.getElementById('sl-botcount');
    if(!input) return;
    input.value = String(count);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function configureBot(bot, boss){
    bot._defeated = false;
    bot._bodyScaleMult = boss ? 2 : 1;
    bot._damageMult = boss ? 1 + Math.random() : 1;
    bot.maxHp = boss ? 200 : 100;
    bot.hp = bot.maxHp;
    bot.stamina = bot.stamMax || 100;
    bot._survivalBoss = boss;
    if(typeof maybeSetRandomBotWeapon === 'function') maybeSetRandomBotWeapon(bot, true);
    if(bot._aiState) bot._aiState.enabled = true;
  }

  function spawnWave(){
    if(!active || ending || elapsed >= MATCH_SECONDS) return finishVictory();
    wave++;
    const boss = ordinarySinceBoss >= 3 && Math.random() < 0.5;
    const count = boss ? 1 : desiredWaveCount();
    if(boss) ordinarySinceBoss = 0;
    removeOldAiBots();
    setBotSlider(count);
    dummyOn = true;
    applyBotCount();
    const spawned = aiBots();
    spawned.forEach(bot => configureBot(bot, boss));
    const main = spawned[0];
    if(main){
      D = main;
      AI = main._aiState;
      main._aiState._isMain = true;
      main._aiState._mode = 'attack';
      main._aiState._phase = 'attack';
    }
    intermission = -1;
    if(boss && typeof hitFX !== 'undefined'){
      $.FX.hit({x:WORLD_W/2,y:WORLD_H/2-70,t:t('survival.boss','BOSS'),life:70,big:true,col:'#ff5030'});
    }
  }

  function spawnHeal(x, y){ pickups.push({ x, y, expiresAt: GameTime + PICKUP_LIFETIME }); }

  function finishVictory(){
    if(ending) return true;
    ending = true;
    return FactionRules.finishRound(t('survival.victory','SURVIVED'), alivePlayers()[0] || P);
  }

  function finishDefeat(bot){
    if(ending) return true;
    ending = true;
    return FactionRules.finishRound(t('survival.defeat','SQUAD DEFEATED'), bot || D);
  }

  function waveCleared(wasBoss){
    if(!wasBoss) ordinarySinceBoss++;
    const solo = players().length === 1;
    if(Math.random() < (solo ? 0.75 : 0.5)){
      const p = lastDeathPoint || {x:WORLD_W/2,y:WORLD_H/2};
      spawnHeal(p.x, p.y);
    }
    removeOldAiBots();
    if(elapsed >= MATCH_SECONDS) return finishVictory();
    intermission = INTERMISSION_SECONDS;
  }

  function handleDeath(ent, isPlayer, alivePlayersNow, aliveBotsNow){
    if(!active) return false;
    const bc = $.POS.body(ent);
    lastDeathPoint = {x:bc.x,y:bc.y};
    if(isPlayer){
      if(!alivePlayersNow.length) return finishDefeat(aliveBotsNow[0]);
      return true;
    }
    const solo = players().length === 1;
    if(Math.random() < (solo ? 0.15 : 0.1)) spawnHeal(bc.x, bc.y);
    if(!aliveBotsNow.length) waveCleared(!!ent._survivalBoss);
    return true;
  }

  function updatePickups(){
    for(let i = pickups.length - 1; i >= 0; i--){
      const item = pickups[i];
      if(GameTime >= item.expiresAt){
        pickups.splice(i,1);
        continue;
      }
      const target = alivePlayers().find(ent => {
        const c = $.POS.body(ent);
        return Math.hypot(c.x-item.x,c.y-item.y) <= 34 * (sv('cscl') || 1);
      });
      if(!target || target.hp >= (target.maxHp || 100)) continue;
      target.hp = Math.min(target.maxHp || 100, target.hp + HEAL_AMOUNT);
      pickups.splice(i,1);
      $.FX.hit({x:item.x,y:item.y-25,t:t('survival.heal','+50 HP'),life:40,big:true,col:'#55ff88'});
      if(typeof playSound === 'function') $.S.play('pickup');
    }
  }

  function update(dt){
    if(!active || ending) return;
    elapsed = Math.min(MATCH_SECONDS, elapsed + dt);
    updatePickups();
    if(intermission >= 0){
      intermission -= dt;
      if(intermission <= 0){
        if(elapsed >= MATCH_SECONDS) finishVictory();
        else spawnWave();
      }
    }
    updateHud();
  }

  function drawPickups(){
    if(!active || !pickups.length || typeof ctx === 'undefined') return;
    ctx.save();
    for(const item of pickups){
      const pulse = 1 + Math.sin(GameTime * 6) * 0.08;
      ctx.save();
      ctx.translate(item.x,item.y);
      ctx.scale(pulse,pulse);
      ctx.fillStyle='#39ff78';
      ctx.strokeStyle='#d8ffe8';
      ctx.lineWidth=2/CAM_SCALE;
      ctx.fillRect(-13,-5,26,10);
      ctx.fillRect(-5,-13,10,26);
      ctx.strokeRect(-13,-5,26,10);
      ctx.strokeRect(-5,-13,10,26);
      ctx.restore();
    }
    ctx.restore();
  }

  function start(){
    if(active) return;
    active = true;
    const input = document.getElementById('sl-botcount');
    savedBotCount = input ? input.value : null;
    elapsed = 0;
    wave = 0;
    intermission = -1;
    ordinarySinceBoss = 0;
    ending = false;
    pickups = [];
    lastDeathPoint = null;
    resetPlayers();
    setHud();
    spawnWave();
    updateHud();
  }

  function stop(){
    if(!active) return;
    active = false;
    ending = false;
    pickups = [];
    intermission = -1;
    setHud();
    if(savedBotCount !== null) setBotSlider(savedBotCount);
  }

  function setActive(value){ if(value) start(); else stop(); }

  function onRoundReset(){
    if(!active) return;
    active = false;
    start();
  }

  document.addEventListener('DOMContentLoaded', () => {
    setHud();
    if(typeof FactionRules !== 'undefined' && FactionRules.getMode() === 'survival') start();
  });

  window.SurvivalMode = {
    update,
    drawPickups,
    handleDeath,
    setActive,
    onRoundReset,
    isActive: () => active
  };
})();
