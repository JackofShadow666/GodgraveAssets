(function(){
  const DEFAULT_MIN_SCALE = 0.1;
  const DEFAULT_DURATION = 2;
  const COOLDOWN_MIN = 10;
  const COOLDOWN_MAX = 20;
  const EVENTS = { kill: 0.30, damage: 0.10, throw: 0.20, throwMid: 0.20, shotMid: 0.05 };
  let active = null;
  let cooldownUntil = 0;
  let serial = 0;
  let lastNetId = 0;

  function now(){ return typeof RealTime !== 'undefined' ? RealTime : Date.now() / 1000; }
  function enabled(){ return typeof cb !== 'function' || cb('cinematicslowmo'); }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function slowmoDuration(){
    const v = typeof sv === 'function' ? sv('slowmoduration') : DEFAULT_DURATION;
    return Number.isFinite(v) ? clamp(v, 0.1, 3) : DEFAULT_DURATION;
  }
  function slowmoScale(){
    const v = typeof sv === 'function' ? sv('slowmoscale') : DEFAULT_MIN_SCALE;
    return Number.isFinite(v) ? clamp(v, 0.05, 1) : DEFAULT_MIN_SCALE;
  }

  function start(reason, id, duration, scale){
    if(!enabled()) return false;
    const t = now();
    active = {
      id: id || ++serial,
      reason: reason || 'event',
      start: t,
      duration: Number.isFinite(duration) ? clamp(duration, 0.1, 3) : slowmoDuration(),
      scale: Number.isFinite(scale) ? clamp(scale, 0.05, 1) : slowmoScale()
    };
    cooldownUntil = t + COOLDOWN_MIN + Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN);
    if(typeof triggerHitstop === 'function') triggerHitstop(2, 3);
    return true;
  }

  function canTrigger(){
    return enabled() && now() >= cooldownUntil && (!active || now() >= active.start + active.duration);
  }

  window.tryCinematicSlowmo = function(reason, chance){
    if(!canTrigger()) return false;
    const p = Number.isFinite(chance) ? chance : EVENTS[reason];
    if(!(p > 0) || Math.random() >= p) return false;
    const id = ++serial;
    if(!start(reason, id)) return false;
    if(typeof NET_SYNC !== 'undefined' && NET_SYNC.active && typeof $ !== 'undefined' && $.NET && $.NET.active()){
      $.NET.send({type:'slowmo', id, reason, duration:active.duration, scale:active.scale});
    }
    return true;
  };

  window.forceCinematicSlowmo = function(reason){
    const id = ++serial;
    if(!start(reason || 'manual', id)) return false;
    if(typeof NET_SYNC !== 'undefined' && NET_SYNC.active && typeof $ !== 'undefined' && $.NET && $.NET.active()){
      $.NET.send({type:'slowmo', id, reason:reason || 'manual', duration:active.duration, scale:active.scale});
    }
    return true;
  };

  window.applyCinematicSlowmoNet = function(msg){
    if(!enabled() || !msg || !Number.isSafeInteger(msg.id) || msg.id <= lastNetId) return;
    if(!Number.isFinite(msg.duration) || msg.duration <= 0 || msg.duration > 3) return;
    if(!Number.isFinite(msg.scale) || msg.scale < 0.05 || msg.scale > 1) return;
    lastNetId = msg.id;
    start(msg.reason || 'net', msg.id, msg.duration, msg.scale);
  };

  window.getCinematicSlowmoScale = function(){
    if(!enabled() || !active) return 1;
    const t = (now() - active.start) / active.duration;
    if(t >= 1){ active = null; return 1; }
    if(t <= 0) return 1;
    const minScale = active.scale;
    if(t < 0.13) return 1 + (minScale - 1) * (t / 0.13);
    if(t < 0.50) return minScale;
    return minScale + (1 - minScale) * ((t - 0.50) / 0.50);
  };
})();
// === src/network/net-effects.js ===

(function(){
  let _pcDodgeCooldown = 0;
  const CHARGE_MAX = 3.0;
  const CHARGE_MIN = 0.18;

  function dodgeVector(){
    let dvx=0, dvy=0;
    const kd=keys['d']||keys['D']||keys['РІ']||keys['Р’'];
    const ka=keys['a']||keys['A']||keys['С„']||keys['Р¤'];
    const ks=keys['s']||keys['S']||keys['С‹']||keys['Р«']||keys['С–'];
    const kw=keys['w']||keys['W']||keys['С†']||keys['Р¦'];
    if(kd) dvx=1; else if(ka) dvx=-1;
    if(ks) dvy=1; else if(kw) dvy=-1;
    if(dvx===0&&dvy===0 && typeof P!=='undefined'){
      const pivX=(typeof rootCenter==='function'?$.POS.root().x:P.x)+P.pvX;
      const pivY=(typeof rootCenter==='function'?$.POS.root().y:P.y)+P.pvY;
      dvx=mX-pivX; dvy=mY-pivY;
    }
    return {x:dvx, y:dvy};
  }

  function canChargeShieldDash(){
    return typeof P!=='undefined' && P.shield>0 && !isExhausted(P) &&
      typeof shieldHeld==='function' && shieldHeld(P) && P.stamina>0;
  }

  window.beginDodgePress = function(source){
    if(typeof gamePaused !== 'undefined' && gamePaused) return;
    if(_pcDodgeCooldown > 0) return;
    if(canChargeShieldDash()){
      P._shieldDashCharging = true;
      P._shieldDashChargeStart = GameTime;
      P._shieldDashChargeSource = source || 'dodge';
      P._shieldDashChargeMax = CHARGE_MAX;
      P._shieldDashBashActiveUntil = 0;
      if(!P._shieldDashChargeSound && typeof playControllableSound === 'function'){
        P._shieldDashChargeSound = playControllableSound('shieldPush');
      }
      return;
    }
    _pcDodgeCooldown = 0.8;
    if(typeof window.doDodge === 'function') window.doDodge(true);
  };

  window.endDodgePress = function(source){
    if(typeof P==='undefined') return;
    if(!P._shieldDashCharging || (source && P._shieldDashChargeSource !== source)) return;
    const held = Math.max(0, Math.min(CHARGE_MAX, GameTime - (P._shieldDashChargeStart || GameTime)));
    const charge = held >= CHARGE_MIN ? held / CHARGE_MAX : 0;
    P._shieldDashCharging = false;
    P._shieldDashChargeStart = 0;
    P._shieldDashChargeSource = null;
    if(typeof fadeOutSound === 'function') fadeOutSound(P._shieldDashChargeSound, 0.18);
    P._shieldDashChargeSound = null;
    _pcDodgeCooldown = 0.8;
    const dir = dodgeVector();
    if(typeof window.fireDodge === 'function') window.fireDodge(dir.x, dir.y, true, charge);
  };

  window.addEventListener('keydown', e => {
    if(e.key !== 'Shift') return;
    if(e.repeat) return;
    window.beginDodgePress('Shift');
  });

  window.addEventListener('keyup', e => {
    if(e.key !== 'Shift') return;
    window.endDodgePress('Shift');
  });

  window._dodgeTick = function(rawDt){
    if(_pcDodgeCooldown > 0) _pcDodgeCooldown -= rawDt;
    if(typeof P !== 'undefined' && P._shieldDashCharging){
      if(!canChargeShieldDash()){
        P._shieldDashCharging = false;
        if(typeof fadeOutSound === 'function') fadeOutSound(P._shieldDashChargeSound, 0.18);
        P._shieldDashChargeSound = null;
      } else {
        const held = Math.max(0, Math.min(CHARGE_MAX, GameTime - (P._shieldDashChargeStart || GameTime)));
        P._shieldDashChargePower = held / CHARGE_MAX;
        const rc = typeof rootCenter==='function' ? $.POS.root() : {x:P.x, y:P.y};
        const awayX = rc.x - mX;
        const awayY = rc.y - mY;
        const awayLen = Math.hypot(awayX, awayY) || 1;
        const retreat = (9 + P._shieldDashChargePower * 15) * rawDt;
        P.vx = 0; P.vy = 0;
        P.x = $.M.clamp(P.x + awayX / awayLen * retreat, 40, WORLD_W-80);
        P.y = $.M.clamp(P.y + awayY / awayLen * retreat, 40, WORLD_H-40);
      }
    }
    if(typeof window._dodgeCooldownMob !== 'undefined' && window._dodgeCooldownMob > 0){
      window._dodgeCooldownMob -= rawDt;
    }
    if(typeof window._dodgeTrailFrames !== 'undefined' && window._dodgeTrailFrames > 0 && typeof P !== 'undefined'){
      const trailStep = rawDt * 60;
      window._dodgeTrailFrames -= trailStep;
      window._dodgeTrailEmit = (window._dodgeTrailEmit || 0) + trailStep;
      if(typeof DODGE_TRAIL === 'undefined') window.DODGE_TRAIL = [];
      while(window._dodgeTrailEmit >= 1){
        window._dodgeTrailEmit -= 1;
        DODGE_TRAIL.push({
          x: P.x + Math.random() * 10 - 5,
          y: P.y + Math.random() * 10 - 5,
          life: 14,
          maxLife: 14,
          r: 7
        });
      }
    }
  };
})();

(function(){
  let _hitstopFrames = 0;
  let _shakeMag = 0;

  window.triggerHitstop = function(frames, shakeMag){
    _hitstopFrames = Math.max(_hitstopFrames, frames || 5);
    _shakeMag = Math.max(_shakeMag, shakeMag || 4);
  };

  window._applyScreenShake = function(){
    if(_shakeMag > 0.1){
      const shakeX = (Math.random() - 0.5) * _shakeMag * 2;
      const shakeY = (Math.random() - 0.5) * _shakeMag * 2;
      _shakeMag *= 0.75;
      ctx.save();
      ctx.translate(shakeX, shakeY);
      return true;
    }
    return false;
  };

  window._restoreScreenShake = function(applied){
    if(applied) ctx.restore();
  };

  window._hitstopTick = function(){
    if(_hitstopFrames > 0){
      _hitstopFrames--;
      return true;
    }
    return false;
  };
})();

(function(){
  function netText(key, fallback, vars){
    return window.I18N ? window.I18N.t(key, vars) : fallback;
  }

  let _wP = 0;
  let _wD = 0;
  let _seriesResetTimer = 0;
  const WINS_TO_SERIES = 5;

  function updateWins(){
    const ep = document.getElementById('hud-p-wins');
    const eb = document.getElementById('hud-b-wins');
    if(ep) ep.textContent = netText('net.wins.score', `SCORE ${_wP}/${WINS_TO_SERIES}`, { wins: _wP, total: WINS_TO_SERIES });
    if(eb) eb.textContent = netText('net.wins.score', `SCORE ${_wD}/${WINS_TO_SERIES}`, { wins: _wD, total: WINS_TO_SERIES });
  }

  function getWinnerName(isBot){
    if(!isBot) return (typeof PROFILE !== 'undefined' && PROFILE.name) ? PROFILE.name : netText('net.wins.player', 'Player');
    const botEl = document.getElementById('hud-bot-name');
    return (botEl && botEl.textContent) ? botEl.textContent.trim() : netText('net.wins.bot', 'Bot');
  }

  window.addWin = function(isBot){
    if(isBot) _wD++;
    else _wP++;
    updateWins();

    if(_wP < WINS_TO_SERIES && _wD < WINS_TO_SERIES) return;

    const winnerIsBot = _wD >= WINS_TO_SERIES;
    const winnerName = getWinnerName(winnerIsBot);
    if(typeof hitFX !== 'undefined'){
      $.FX.hit({
        x: typeof W !== 'undefined' ? W / 2 : 400,
        y: typeof H !== 'undefined' ? H / 2 - 60 : 240,
        t: netText('net.wins.seriesWin', `🏆 ${winnerName.toUpperCase()} WON THE SERIES!`, { name: winnerName.toUpperCase() }),
        life: 180,
        big: true,
        col: '#ffd700'
      });
    }
    if(typeof NET_CORE !== 'undefined' && NET_CORE.isOpen()){
      $.NET.send({ type: 'champion', name: winnerName });
    }
    clearTimeout(_seriesResetTimer);
    _seriesResetTimer = setTimeout(() => {
      _wP = 0;
      _wD = 0;
      updateWins();
    }, 3000);
  };

  window.resetWins = function(){
    clearTimeout(_seriesResetTimer);
    _wP = 0;
    _wD = 0;
    updateWins();
  };

  window._onChampionMsg = function(name){
    if(typeof hitFX !== 'undefined'){
      $.FX.hit({
        x: typeof W !== 'undefined' ? W / 2 : 400,
        y: typeof H !== 'undefined' ? H / 2 - 60 : 240,
        t: netText('net.wins.champion', `🏆 ${name.toUpperCase()} WON!`, { name: name.toUpperCase() }),
        life: 300,
        big: true,
        col: '#ffd700'
      });
    }
    clearTimeout(_seriesResetTimer);
    _wP = 0;
    _wD = 0;
    updateWins();
  };

  updateWins();
})();

(function(){
  const _pools = [];
  const POOL_LIFE = 2.5;

  window.spawnBloodPool = function(x, y, dmg){
    const life = 3 + Math.min(7, (dmg || 5) / 5 * 7);
    const pr = (rf(6, 8) + (dmg || 5) * 0.3) * 0.8;
    _pools.push({ x, y, r: pr, life, maxLife: life, alpha: rf(0.7, 0.3) });
  };

  window.updateBloodPools = function(dt){
    for(let i = _pools.length - 1; i >= 0; i--){
      _pools[i].life -= dt;
      if(_pools[i].life <= 0) _pools.splice(i, 1);
    }
  };

  window.drawBloodPools = function(){
    if(!_pools.length) return;
    ctx.save();
    for(const p of _pools){
      const a = (p.life / (p.maxLife || POOL_LIFE)) * p.alpha;
      ctx.globalAlpha = a * 0.6;
      ctx.fillStyle = '#6a0a0a';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.6, p.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };
})();


(function(){
  window.NET = { get active(){ return $.NET.active(); }, send:m=>$.NET.send(m) };
})();
