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
      } else {
        const held = Math.max(0, Math.min(CHARGE_MAX, GameTime - (P._shieldDashChargeStart || GameTime)));
        P._shieldDashChargePower = held / CHARGE_MAX;
        P.vx = 0; P.vy = 0;
      }
    }
    if(typeof window._dodgeCooldownMob !== 'undefined' && window._dodgeCooldownMob > 0){
      window._dodgeCooldownMob -= rawDt;
    }
    if(typeof window._dodgeTrailFrames !== 'undefined' && window._dodgeTrailFrames > 0 && typeof P !== 'undefined'){
      window._dodgeTrailFrames--;
      if(typeof DODGE_TRAIL === 'undefined') window.DODGE_TRAIL = [];
      DODGE_TRAIL.push({
        x: P.x + Math.random() * 10 - 5,
        y: P.y + Math.random() * 10 - 5,
        life: 14,
        maxLife: 14,
        r: 7
      });
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
  function netText(key, fallback, vars){
    return window.I18N ? window.I18N.t(key, vars) : fallback;
  }

  let _zoneActive = false;
  let _zoneTimer = 0;
  const ZONE_GRACE = 5;
  const ZONE_DMG_P = 4;
  const ZONE_DMG_D = 2;
  const ZONE_FADE = 8;
  let _pOutTime = 0;
  let _dOutTime = 0;

  function getZoneRadius(){ return H * 0.44; }
  function getZoneCenter(){ return { x: W / 2, y: H / 2 }; }

  window.zoneActive = function(){ return _zoneActive; };

  window.toggleZone = function(){
    _zoneActive = !_zoneActive;
    _zoneTimer = 0;
    const btn = document.getElementById('mob-zone-btn');
    if(btn) btn.classList.toggle('active', _zoneActive);
    if(typeof hitFX !== 'undefined'){
      $.FX.hit({
        x: W / 2,
        y: H / 2 - 60,
        t: _zoneActive ? netText('net.zone.active', 'ZONE ACTIVE') : netText('net.zone.inactive', 'ZONE OFF'),
        life: 60,
        big: true,
        col: _zoneActive ? '#ffaa30' : '#888'
      });
    }
  };

  window.updateZone = function(dt){
    if(!_zoneActive) return;
    _zoneTimer += dt;
    if(_zoneTimer <= ZONE_GRACE) return;

    const c = getZoneCenter();
    const r = getZoneRadius();
    const ZONE_OUT_GRACE = 1.0;

    if(typeof P !== 'undefined'){
      const d = Math.hypot(P.x - c.x, P.y - c.y);
      if(d > r){
        _pOutTime += dt;
        if(_pOutTime > ZONE_OUT_GRACE){
          const zoneDmg = Math.round(ZONE_DMG_P * dt);
          applyDamage(P, zoneDmg, null, {
            isMagic: false,
            isExplosion: false,
            knockbackMult: 0,
            hitstopFrames: 0,
            shakePower: 0,
            textColor: '#ff4444',
            textSuffix: netText('net.zone.damageSuffix', '🔥'),
            bloodCount: 2,
            playSound: true
          });
        }
      } else {
        _pOutTime = 0;
      }
    }

    if(typeof D !== 'undefined' && typeof dummyOn !== 'undefined' && dummyOn && !(typeof NET_SYNC !== 'undefined' && $.NET.active())){
      const d = Math.hypot(D.x - c.x, D.y - c.y);
      if(d > r){
        _dOutTime += dt;
        if(_dOutTime > ZONE_OUT_GRACE){
          const zoneDmg = Math.round(ZONE_DMG_D * dt);
          applyDamage(D, zoneDmg, null, {
            isMagic: false,
            isExplosion: false,
            knockbackMult: 0,
            hitstopFrames: 0,
            shakePower: 0,
            textColor: '#ff4444',
            textSuffix: netText('net.zone.damageSuffix', '🔥'),
            bloodCount: 2,
            playSound: true
          });
        }
      } else {
        _dOutTime = 0;
      }
    }
  };

  window.drawZone = function(){
    if(!_zoneActive) return;
    const c = getZoneCenter();
    const r = getZoneRadius();
    const fadeProgress = Math.min(1, Math.max(0, (_zoneTimer - ZONE_GRACE) / ZONE_FADE));
    const maxAlpha = 0.72;
    const alpha = fadeProgress * maxAlpha;
    if(alpha < 0.01) return;

    ctx.save();
    const grad = ctx.createRadialGradient(c.x, c.y, r * 0.75, c.x, c.y, Math.max(W, H));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, `rgba(0,0,0,${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };

  document.addEventListener('keydown', e => {
    if(e.key === 'o' || e.key === 'O' || e.key === 'щ' || e.key === 'Щ'){
      if(!(typeof gamePaused !== 'undefined' && gamePaused)) window.toggleZone();
    }
  });
})();

(function(){
  window.NET = { get active(){ return $.NET.active(); }, send:m=>$.NET.send(m) };
})();
