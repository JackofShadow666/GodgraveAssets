// === src/ui/hud.js ===
(function(){
  'use strict';

  function t(key, fallback, vars){
    return window.I18N ? window.I18N.t(key, vars) : fallback;
  }

  function clampPercent(value, max){
    const limit = Number(max) > 0 ? Number(max) : 100;
    const safeValue = Number(value) || 0;
    return Math.max(0, Math.min(100, (safeValue / limit) * 100));
  }

  function setBarWidth(selector, value, max){
    const el = document.querySelector(selector);
    if(el) el.style.width = clampPercent(value, max).toFixed(1) + '%';
  }

  function setRageBar(el, value){
    if(!el) return;
    const rage = Number(value) || 0;
    el.style.width = clampPercent(rage, 100).toFixed(1) + '%';
    el.style.background = rage >= 50 ? '#2f8cff' : '#777f88';
  }

  function setTextIfPresent(selector, text){
    const el = document.querySelector(selector);
    if(el) el.textContent = text || '';
  }

  function entityStatusText(entity){
    if(!entity) return '';
    if(typeof isUnbalanced === 'function' && isUnbalanced(entity)){
      return t('hud.unbalanced', 'UNBALANCED');
    }
    if(typeof isExhausted === 'function' && isExhausted(entity)){
      return t('hud.botExhausted', 'EXHAUSTED');
    }
    if(entity._debuffActive){
      return t('hud.debuff', 'DEBUFF');
    }
    return '';
  }

  function botPhaseText(bot){
    if(!bot) return '';
    const ai = bot._aiState || {};
    const style = ai.style || ai.profile || '';
    const phase = ai.phase || ai.state || '';
    if(style === 'probing'){
      const probingMap = {
        approach: 'hud.probingApproach',
        strike: 'hud.probingStrike',
        retreat: 'hud.probingRetreat',
        pause: 'hud.probingPause',
        mirrorBlock: 'hud.probingMirrorBlock'
      };
      return t('hud.probingPhase', 'PROBING', {
        state: t(probingMap[phase] || 'hud.probingPause', 'PAUSE')
      });
    }
    if(style === 'harass'){
      const harassMap = {
        approach: 'hud.harassApproach',
        strike: 'hud.harassStrike',
        orbit: 'hud.harassOrbit'
      };
      return t('hud.harassPhase', 'HARASS', {
        phase: t(harassMap[phase] || 'hud.harassApproach', 'APPROACH')
      });
    }
    const genericMap = {
      attack: 'hud.phaseAttack',
      retreat: 'hud.phaseRetreat',
      rest: 'hud.phaseRest'
    };
    return genericMap[phase] ? t(genericMap[phase], '') : '';
  }

  function updateMainHudEntity(prefix, entity, options){
    if(!entity) return;
    const maxHp = entity.maxHp || 100;
    const maxStam = entity.stamMax || 100;
    setBarWidth('#' + prefix + '-hp', entity.hp, maxHp);
    setBarWidth('#' + prefix + '-stam', entity.stamina, maxStam);
    setRageBar(document.querySelector('#' + prefix + '-rage'), entity.rage);
    if(options && options.statusSelector){
      setTextIfPresent(options.statusSelector, entityStatusText(entity));
    }
    if(options && options.buffSelector){
      const rageActive = (entity.rageBuffEnd || 0) > (typeof GameTime !== 'undefined' ? GameTime : 0);
      setTextIfPresent(options.buffSelector, rageActive ? t('hud.rageBuff', 'RAGE 2x') : '');
    }
  }

  function updateLocalSlotHud(slotEl, entity){
    if(!slotEl) return;
    slotEl.style.display = entity ? 'block' : 'none';
    if(!entity) return;
    const hpBar = slotEl.querySelector('[data-hp]');
    const stamBar = slotEl.querySelector('[data-stam]');
    const rageBar = slotEl.querySelector('[data-rage]');
    if(hpBar) hpBar.style.width = clampPercent(entity.hp, entity.maxHp || 100).toFixed(1) + '%';
    if(stamBar) stamBar.style.width = clampPercent(entity.stamina, entity.stamMax || 100).toFixed(1) + '%';
    setRageBar(rageBar, entity.rage);
  }

  function updateHUD(){
    if(typeof P !== 'undefined'){
      updateMainHudEntity('hud-p', P, {
        statusSelector: '#hud-p-status',
        buffSelector: '#hud-p-buff'
      });
    }

    const botHud = document.getElementById('hud-bot');
    const hasDummy = typeof dummyOn !== 'undefined' && dummyOn && typeof D !== 'undefined' && !!D;
    if(botHud){
      botHud.style.opacity = hasDummy ? '1' : '0';
    }
    if(hasDummy){
      updateMainHudEntity('hud-b', D, {
        statusSelector: '#hud-b-status'
      });
      const manualSlot = D._manualControl && Number.isInteger(D._playerSlot) ? D._playerSlot : -1;
      setTextIfPresent('#hud-b-label', manualSlot >= 0 ? `PLAYER ${manualSlot + 1}` : t('hud.botLabel', 'BOT'));
      setTextIfPresent('#hud-b-phase', manualSlot >= 0 ? '' : botPhaseText(D));
    }

    const localPvp = typeof LocalPlayerControls !== 'undefined' && LocalPlayerControls.isLocalPvP();
    const slots = localPvp && Array.isArray(window.PLAYER_SLOTS) ? window.PLAYER_SLOTS : [];
    updateLocalSlotHud(document.getElementById('hud-player-3'), slots[2] && slots[2].source ? slots[2].entity : null);
    updateLocalSlotHud(document.getElementById('hud-player-4'), slots[3] && slots[3].source ? slots[3].entity : null);
  }

  window.updateHUD = updateHUD;
})();
