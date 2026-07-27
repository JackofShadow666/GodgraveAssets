// Local controller slots. Slot 1 is the primary P entity; slots 2-4 use the
// first three entities from ALL_BOTS. A slot owns an entity only while a local
// controller is assigned to it; otherwise that entity remains controlled by AI.
(function(){
  'use strict';

  const STORAGE_KEY = 'godgrave.gamepad1.playerSlot';
  const SLOT_COUNT = 4;
  const DEADZONE_MOVE = 0.18;
  const DEADZONE_AIM = 0.22;
  const AIM_RADIUS = 90;
  // Right-stick weapon response. Increase for faster aim, decrease for slower.
  // 7.5 is exactly 3x the previous 2.5 value.
  const AIM_SMOOTH_SPEED = 14.5;

  const slots = Array.from({length:SLOT_COUNT}, (_, index) => ({
    index,
    source: index === 0 ? 'keyboard-mouse' : null,
    entity: null,
  }));
  const padState = { index:null, previousButtons:[], aimAngle:0 };

  function readStoredSlot(){
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value >= 0 && value < SLOT_COUNT ? value : 0;
  }
  let gamepadSlot = readStoredSlot();

  function ensureSlotEntity(slotIndex){
    if(slotIndex === 0) return typeof P !== 'undefined' ? P : null;
    if(typeof ALL_BOTS === 'undefined') return null;
    const requiredBots = slotIndex;
    const countInput = document.getElementById('sl-botcount');
    if(ALL_BOTS.length < requiredBots && countInput && typeof applyBotCount === 'function'){
      applyBotCount();
    }
    return ALL_BOTS[slotIndex - 1] || null;
  }

  function clearManualEntity(entity){
    if(!entity) return;
    entity._manualControl = false;
    const ai = entity._aiState;
    if(ai){
      ai._fakeKeys.w = ai._fakeKeys.a = ai._fakeKeys.s = ai._fakeKeys.d = false;
      ai._fakeMDown = false;
    }
  }

  function syncSlots(){
    for(const slot of slots){
      const nextEntity = slot.index===0 || slot.index===gamepadSlot
        ? ensureSlotEntity(slot.index)
        : (typeof ALL_BOTS!=='undefined' ? ALL_BOTS[slot.index-1] || null : null);
      if(slot.entity && slot.entity !== nextEntity) clearManualEntity(slot.entity);
      slot.entity = nextEntity;
      slot.source = slot.index === 0 ? 'keyboard-mouse' : null;
    }
    slots[gamepadSlot].source = 'gamepad-0';
    if(gamepadSlot > 0 && slots[gamepadSlot].entity){
      slots[gamepadSlot].entity._manualControl = true;
      slots[gamepadSlot].entity._playerSlot = gamepadSlot;
    }
    for(let i=1;i<slots.length;i++){
      if(i !== gamepadSlot) clearManualEntity(slots[i].entity);
    }
    window.PLAYER_SLOTS = slots;
  }

  function setGamepadSlot(slotIndex){
    const next = Math.max(0, Math.min(SLOT_COUNT - 1, Number(slotIndex) || 0));
    if(gamepadSlot > 0) clearManualEntity(slots[gamepadSlot].entity);
    gamepadSlot = next;
    localStorage.setItem(STORAGE_KEY, String(gamepadSlot));
    if(gamepadSlot > 0 && typeof dummyOn !== 'undefined') dummyOn=true;
    if(gamepadSlot>0){
      const botCount=document.getElementById('sl-botcount');
      if(botCount){
        botCount.value='0';
        botCount.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }
    syncSlots();
    updateSettingsUI();
  }

  function findGamepad(){
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if(padState.index !== null && pads[padState.index]) return pads[padState.index];
    for(const pad of pads){
      if(pad){ padState.index = pad.index; return pad; }
    }
    padState.index = null;
    return null;
  }

  function axis(value, deadzone){
    value = Number(value) || 0;
    if(Math.abs(value) <= deadzone) return 0;
    return Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone);
  }

  function pressed(pad, index){ return !!(pad.buttons[index] && pad.buttons[index].pressed); }
  function justPressed(pad, index){ return pressed(pad,index) && !padState.previousButtons[index]; }

  function cycleWeapon(entity){
    if(!entity || typeof setWeapon !== 'function' || typeof WEAPON_TYPES === 'undefined') return;
    setWeapon(entity, ((entity.weaponType || 0) + 1) % WEAPON_TYPES.length);
  }
  function cycleShield(entity){
    if(!entity || typeof setShield !== 'function' || typeof SHIELD_TYPES === 'undefined') return;
    setShield(entity, ((entity.shield || 0) + 1) % SHIELD_TYPES.length);
  }
  function dodge(entity, moveX, moveY){
    if(!entity || isExhausted(entity) || isUnbalanced(entity) || (entity._dodgeCD || 0) > GameTime) return;
    let dx=moveX, dy=moveY;
    if(Math.hypot(dx,dy) < 0.1){ dx=Math.cos(entity.angle); dy=Math.sin(entity.angle); }
    const len=Math.hypot(dx,dy)||1;
    entity._dvx=dx/len*8; entity._dvy=dy/len*8;
    entity._dodgeCD=GameTime+0.7;
    entity._dodgeActiveUntil=GameTime+0.3;
    if(typeof drainStamina==='function') drainStamina(entity,30);
  }

  function manualFlickStaminaCost(){
    const gamepadCost = sv('gamepadstamflick');
    return Number.isFinite(gamepadCost) ? gamepadCost : sv('stamflick');
  }

  function updateManualCombatStamina(entity, attack, aimAngle, dt){
    const staminaBefore=entity.stamina;
    const state=entity._manualCombatState || (entity._manualCombatState={
      attack:false,lastAngle:null,orbitAngle:0,orbitStart:RealTime,
      flickDirection:0,flickStartAngle:0,flickCount:0,flickWindowStart:RealTime
    });
    if(entity._manualGestureSuppressUntil) state.gestureSuppressUntil=entity._manualGestureSuppressUntil;
    const melee=!isRangedWeapon(entity) && weaponKeyOf(entity)!=='flail';
    const staminaMult=typeof weaponStaminaMult==='function' ? weaponStaminaMult(entity) : 1;

    if(melee && attack){
      if(!state.attack){
        const initial=entity.stamMax*(sv('lmbcost')/100)*weaponLmbStaminaMult(entity);
        if(entity.stamina>=initial){
          drainStamina(entity,initial);
          state.holdDrain=Math.max(0,entity.stamina);
        }
      } else if(state.holdDrain>0){
        drainStamina(entity,state.holdDrain*dt);
      }
    } else state.holdDrain=0;

    if((state.gestureSuppressUntil||0)>RealTime){
      state.lastAngle=aimAngle;
      state.attack=attack;
      return;
    }
    if(state.lastAngle!==null){
      const delta=$.M.angDiff(aimAngle,state.lastAngle);
      const velocity=delta/Math.max(dt,0.001);
      if(!attack && melee){
        if(RealTime-state.orbitStart>sv('orbitwindow')){
          state.orbitAngle=0; state.orbitStart=RealTime;
        }
        const orbitDirection=Math.sign(delta);
        if(state.orbitDirection && orbitDirection && orbitDirection!==state.orbitDirection){
          state.orbitAngle=0; state.orbitStart=RealTime;
        }
        if(orbitDirection) state.orbitDirection=orbitDirection;
        state.orbitAngle+=Math.abs(delta);
        if(Math.abs(state.orbitAngle)>=Math.PI*2*sv('orbitturns')){
          drainStamina(entity,sv('stamorbit')*staminaMult);
          $.FX.hit({x:entity.x,y:entity.y-30,t:(window.I18N ? window.I18N.t('playercontrols.hitOrbit') : 'ORBIT'),life:35,big:false,col:'#ff8840'});
          state.orbitAngle=0; state.orbitStart=RealTime;
        }

        const direction=Math.sign(velocity);
        if(RealTime-state.flickWindowStart>sv('flickwindow')){
          state.flickCount=0; state.flickWindowStart=RealTime;
        }
        if(Math.abs(velocity)>=sv('flickminvel') && direction && state.flickDirection && direction!==state.flickDirection){
          const amplitude=Math.abs($.M.angDiff(aimAngle,state.flickStartAngle));
          if(amplitude>=sv('flickminamp') && amplitude<=sv('flickminamp')*sv('flickmaxmult')) state.flickCount++;
          state.flickStartAngle=aimAngle;
          if(state.flickCount>=sv('flickcount')){
            drainStamina(entity,manualFlickStaminaCost());
            $.FX.hit({x:entity.x,y:entity.y-25,t:(window.I18N ? window.I18N.t('playercontrols.hitFlick') : 'FLICK'),life:30,big:false,col:'#ffaa20'});
            state.flickCount=0; state.flickWindowStart=RealTime;
          }
        }
        if(direction && direction!==state.flickDirection){
          state.flickDirection=direction;
          state.flickStartAngle=aimAngle;
        }
        // Swing threshold is expressed in the same real weapon velocity used by
        // the normal mouse player. Stick jitter must not count as sword motion.
        if(Math.abs(entity.vel)>sv('swthresh') && (state.swingCooldown||0)<=GameTime){
          drainStamina(entity,sv('stamswing')*staminaMult);
          state.swingCooldown=GameTime+0.35;
          $.FX.hit({x:entity.x,y:entity.y-30,t:(window.I18N ? window.I18N.t('playercontrols.hitSwing') : 'SWING'),life:35,big:false,col:'#ffcc44'});
        }
      } else {
        state.orbitAngle=0; state.orbitStart=RealTime;
        state.flickCount=0; state.flickWindowStart=RealTime;
      }
    }
    state.lastAngle=aimAngle;
    state.attack=attack;
    if(staminaBefore>0 && entity.stamina<=0 && !isExhausted(entity) && typeof applyExhaust==='function') applyExhaust(entity);
  }

  function updateManualCombatStaminaV2(entity, attack, aimAngle, dt, gestureVelocity){
    const staminaBefore=entity.stamina;
    const state=entity._manualCombatStateV2 || (entity._manualCombatStateV2={
      attack:false,lastAngle:null,orbitAngle:0,orbitStart:RealTime,
      flickDirection:0,flickStartAngle:0,flickCount:0,flickWindowStart:RealTime,
      holdDrain:0,swingCooldown:-1
    });
    const melee=!isRangedWeapon(entity) && weaponKeyOf(entity)!=='flail';
    const staminaMult=typeof weaponStaminaMult==='function' ? weaponStaminaMult(entity) : 1;
    const lmbStaminaCost=entity.stamMax*(sv('lmbcost')/100)*weaponLmbStaminaMult(entity);
    if(entity._manualGestureSuppressUntil) state.gestureSuppressUntil=entity._manualGestureSuppressUntil;

    if(melee){
      if((entity.rageBuffEnd||0)>GameTime && attack){
        entity.rage=Math.max(0,(entity.rage||0)-30*dt);
        if(entity.rage>0) entity.rageBuffEnd=Math.max(entity.rageBuffEnd,GameTime+0.1);
      }
      if(isExhausted(entity) && attack) attack=false;
      if((entity.rageBuffEnd||0)<=GameTime && (entity.rage||0)<30 && attack && !state.attack && entity.stamina<lmbStaminaCost){
        attack=false;
      }
      if(attack){
        if(!state.attack){
          entity.lmbHoldStart=GameTime;
          $.S.play(isHeavySwingWeapon(entity)?'hammerSwing':'whoosh');
          if((entity.rageBuffEnd||0)<=GameTime){
            if((entity.rage||0)>=30){
              entity.rage=Math.max(0,(entity.rage||0)-30);
              entity.rageBuffEnd=GameTime+1.0;
              entity._rageTextShown=false;
              $.S.play('rage');
              state.holdDrain=Math.max(0,entity.stamina);
            } else if(entity.stamina>=lmbStaminaCost){
              drainStamina(entity,lmbStaminaCost);
              state.holdDrain=Math.max(0,entity.stamina);
            }
          }
        } else if((entity.rageBuffEnd||0)<=GameTime && state.holdDrain>0){
          drainStamina(entity,state.holdDrain*dt);
        }
        if((entity.rageBuffEnd||0)>GameTime && !entity._rageTextShown && (GameTime-(entity.lmbHoldStart||0))>=0.5){
          entity._rageTextShown=true;
          $.FX.hit({x:entity.x,y:entity.y-50,t:(window.I18N ? window.I18N.t('playercontrols.rage') : 'RAGE!'),life:40,big:true,col:'#ff2020'});
        }
      } else {
        state.holdDrain=0;
        entity.lmbHoldStart=-1;
        if((entity.rageBuffEnd||0)<=GameTime) entity._rageTextShown=false;
      }
    }

    if((state.gestureSuppressUntil||0)>RealTime){
      state.lastAngle=aimAngle;
      state.attack=attack;
      return;
    }
    if(state.lastAngle!==null){
      const delta=$.M.angDiff(aimAngle,state.lastAngle);
      const velocity=Number.isFinite(gestureVelocity) ? gestureVelocity : delta/Math.max(dt,0.001);
      if(!attack && melee){
        if(RealTime-state.orbitStart>sv('orbitwindow')){
          state.orbitAngle=0;
          state.orbitStart=RealTime;
        }
        const orbitDirection=Math.sign(delta);
        if(state.orbitDirection && orbitDirection && orbitDirection!==state.orbitDirection){
          state.orbitAngle=0;
          state.orbitStart=RealTime;
        }
        if(orbitDirection) state.orbitDirection=orbitDirection;
        state.orbitAngle+=Math.abs(delta);
        if(Math.abs(state.orbitAngle)>=Math.PI*2*sv('orbitturns')){
          drainStamina(entity,sv('stamorbit')*staminaMult);
          $.FX.hit({x:entity.x,y:entity.y-30,t:(window.I18N ? window.I18N.t('playercontrols.hitOrbit') : 'ORBIT'),life:35,big:false,col:'#ff8840'});
          $.S.play('whoosh');
          state.orbitAngle=0;
          state.orbitStart=RealTime;
        }

        const direction=Math.sign(velocity);
        const flickMinVel=sv('flickminvel')*0.8;
        const flickMinAmp=sv('flickminamp')*0.9;
        if(RealTime-state.flickWindowStart>sv('flickwindow')){
          state.flickCount=0;
          state.flickWindowStart=RealTime;
        }
        if(Math.abs(velocity)>=flickMinVel && direction && state.flickDirection && direction!==state.flickDirection){
          const amplitude=Math.abs($.M.angDiff(aimAngle,state.flickStartAngle));
          if(amplitude>=flickMinAmp && amplitude<=sv('flickminamp')*sv('flickmaxmult')){
            state.flickCount++;
          }
          state.flickStartAngle=aimAngle;
          if(state.flickCount>=sv('flickcount')){
            drainStamina(entity,manualFlickStaminaCost());
            $.FX.hit({x:entity.x,y:entity.y-25,t:(window.I18N ? window.I18N.t('playercontrols.hitFlick') : 'FLICK'),life:30,big:false,col:'#ffaa20'});
            $.S.play(isHeavySwingWeapon(entity)?'hammerSwing':'whoosh');
            state.flickCount=0;
            state.flickWindowStart=RealTime;
          }
        }
        if(direction && direction!==state.flickDirection){
          state.flickDirection=direction;
          state.flickStartAngle=aimAngle;
        }
        if(Math.abs(entity.vel)>sv('swthresh') && (state.swingCooldown||0)<=GameTime){
          drainStamina(entity,sv('stamswing')*staminaMult);
          state.swingCooldown=GameTime+0.35;
          $.FX.hit({x:entity.x,y:entity.y-30,t:(window.I18N ? window.I18N.t('playercontrols.hitSwing') : 'SWING'),life:35,big:false,col:'#ffcc44'});
          $.S.play(isHeavySwingWeapon(entity)?'hammerSwing':((entity.rageBuffEnd||0)>GameTime?'whooshRage':'whoosh'));
        }
      } else {
        state.orbitAngle=0;
        state.orbitStart=RealTime;
        state.flickCount=0;
        state.flickWindowStart=RealTime;
      }
    }
    state.lastAngle=aimAngle;
    state.attack=attack;
    if(staminaBefore>0 && entity.stamina<=0 && !isExhausted(entity) && typeof applyExhaust==='function') applyExhaust(entity);
  }

  function updateManualEntity(entity, pad, dt){
    if(!entity || !entity._aiState) return;
    const ai=entity._aiState;
    const moveX=axis(pad.axes[0],DEADZONE_MOVE);
    const moveY=axis(pad.axes[1],DEADZONE_MOVE);
    const aimX=axis(pad.axes[2],DEADZONE_AIM);
    const aimY=axis(pad.axes[3],DEADZONE_AIM);
    ai._fakeKeys.a=moveX < -0.25; ai._fakeKeys.d=moveX > 0.25;
    ai._fakeKeys.w=moveY < -0.25; ai._fakeKeys.s=moveY > 0.25;
    const aimMagnitude=Math.hypot(aimX,aimY);
    if(aimMagnitude > 0.1){
      const targetAimAngle=Math.atan2(aimY,aimX);
      if(!padState.aimActive){
        entity._manualGestureSuppressUntil=RealTime+0.3;
      }
      padState.aimActive=true;
      const smoothing=Math.min(1,dt*AIM_SMOOTH_SPEED);
      const prevAimAngle=padState.aimAngle;
      padState.aimAngle+=$.M.angDiff(targetAimAngle,padState.aimAngle)*smoothing;
      entity._manualAimVelocity=$.M.angDiff(padState.aimAngle,prevAimAngle)/Math.max(dt,0.001);
    } else padState.aimActive=false;
    entity._manualAimAngle=padState.aimAngle;
    const center=$.POS.body(entity);
    ai._fakeMX=center.x+Math.cos(padState.aimAngle)*AIM_RADIUS;
    ai._fakeMY=center.y+Math.sin(padState.aimAngle)*AIM_RADIUS;
    ai._fakeMDown=pressed(pad,7) && !isExhausted(entity) && entity.stamina>0;
    entity._manualAttackInput=ai._fakeMDown;

    if(typeof updateRangedWeaponFire==='function' && isRangedWeapon(entity)){
      updateRangedWeaponFire(entity, ai._fakeMDown);
      if(typeof updateCrossbowReloadSound==='function') updateCrossbowReloadSound(entity);
    }
    if(justPressed(pad,0)) dodge(entity,moveX,moveY);
    if(justPressed(pad,4) && typeof throwWeapon==='function') throwWeapon(entity);
    if(justPressed(pad,6)) entity._shieldFlipped=!entity._shieldFlipped;
    if(justPressed(pad,14)) cycleWeapon(entity);
    if(justPressed(pad,15)) cycleShield(entity);
    if(justPressed(pad,12)) ai._styleVals=pick(SWORD_STYLES);
    entity._manualControl=true;
    entity._playerSlot=gamepadSlot;
  }

  function update(dt){
    syncSlots();
    const pad=findGamepad();
    if(gamepadSlot > 0){
      const entity=slots[gamepadSlot].entity;
      if(pad) updateManualEntity(entity,pad,dt);
      else if(entity && entity._aiState){
        const keys=entity._aiState._fakeKeys;
        keys.w=keys.a=keys.s=keys.d=false; entity._aiState._fakeMDown=false;
      }
    }
    if(pad) padState.previousButtons=pad.buttons.map(button=>button.pressed);
  }

  function afterEntityUpdate(entity,dt){
    if(!entity || !entity._manualControl) return;
    const gestureAngle=Number.isFinite(entity._manualAimAngle) ? entity._manualAimAngle : entity.angle;
    updateManualCombatStaminaV2(entity,!!entity._manualAttackInput,gestureAngle,dt,entity._manualAimVelocity);
  }

  function shouldBlockSyntheticGameInput(event){
    return gamepadSlot > 0 && !event.isTrusted &&
      !(typeof isAnyMenuOpen === 'function' && isAnyMenuOpen());
  }
  window.addEventListener('keydown', event=>{ if(shouldBlockSyntheticGameInput(event)) event.stopImmediatePropagation(); }, true);
  window.addEventListener('keyup', event=>{ if(shouldBlockSyntheticGameInput(event)) event.stopImmediatePropagation(); }, true);
  window.addEventListener('mousemove', event=>{ if(shouldBlockSyntheticGameInput(event)) event.stopImmediatePropagation(); }, true);
  window.addEventListener('mousedown', event=>{ if(shouldBlockSyntheticGameInput(event)) event.stopImmediatePropagation(); }, true);
  window.addEventListener('mouseup', event=>{ if(shouldBlockSyntheticGameInput(event)) event.stopImmediatePropagation(); }, true);

  function updateSettingsUI(){
    const select=document.getElementById('gamepad-player-slot');
    if(select) select.value=String(gamepadSlot);
    const status=document.getElementById('gamepad-player-status');
    if(status) status.textContent=gamepadSlot===0
      ? (window.I18N ? window.I18N.t('playercontrols.status.slot0') : 'Gamepad mirrors Player 1 controls')
      : (window.I18N ? window.I18N.t('playercontrols.status.slotN',{slot:gamepadSlot+1}) : `Gamepad controls Player ${gamepadSlot+1}; AI for this character is disabled`);
    const botCount=document.getElementById('sl-botcount');
    if(botCount){
      botCount.disabled=false;
      botCount.title=gamepadSlot>0 ? (window.I18N ? window.I18N.t('playercontrols.botCountTitle') : 'Number of AI bots beyond local players') : '';
    }
    for(const id of ['mob-spawn-btn','dtoggle']){
      const button=document.getElementById(id);
      if(!button) continue;
      button.disabled=false;
      button.style.opacity='';
      button.title=gamepadSlot>0 ? (window.I18N ? window.I18N.t('playercontrols.addBotTitle') : 'Add AI bot to local PvP') : '';
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('gamepad-player-slot')?.addEventListener('change',event=>setGamepadSlot(event.target.value));
    if(gamepadSlot > 0 && typeof dummyOn !== 'undefined') dummyOn=true;
    syncSlots(); updateSettingsUI();
  });

  window.LocalPlayerControls={
    slots,setGamepadSlot,getGamepadSlot:()=>gamepadSlot,update,afterEntityUpdate,
    isLocalPvP:()=>gamepadSlot>0,
    isManualEntity:entity=>!!(entity&&entity._manualControl)
  };
})();
