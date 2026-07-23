// === src/ui/hud.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: HUD — обновление полосок ХП/стамины/статусов
// Module file: hud.js
// ════════════════════════════════════════════════════════════════════════════

// Кэш HUD элементов
// HUD lazy refs — инициализируем при первом вызове
let hudPHP=null,hudPSt=null,hudPStat=null,hudBot=null,hudBHP=null,hudBSt=null,hudBPh=null,hudBStat=null;
function getHUD(){
  if(!hudPHP){
    hudPHP  = document.getElementById('hud-p-hp');
    hudPSt  = document.getElementById('hud-p-stam');
    hudPStat= document.getElementById('hud-p-status');
    hudBot  = document.getElementById('hud-bot');
    hudBHP  = document.getElementById('hud-b-hp');
    hudBSt  = document.getElementById('hud-b-stam');
    hudBPh  = document.getElementById('hud-b-phase');
    hudBStat= document.getElementById('hud-b-status');
  }
}
// HUD vars declared above in lazy block

function updateHUD(){
  getHUD();
  if(!hudPHP) return;
  // Игрок
  hudPHP.style.width  = P.hp + '%';
  hudPHP.style.background = P.hp>50?'#2acc50':P.hp>25?'#ccaa20':'#cc2020';
  hudPSt.style.width  = Math.max(0, Math.min(100, P.stamina)) + '%';
  hudPSt.style.background = '#ccaa20';
    let pStat = '';
  const debuffText = getDebuffText(P);
  if (debuffText) {
    pStat = debuffText;
} else if(isUnbalanced(P)) {
  pStat = '💫 ДИСБАЛАНС';
} else if((P._hitCD||0)>GameTime) {
    pStat = '🛡 ' + Math.max(0,P._hitCD-GameTime).toFixed(1)+'s';
  } else if(weaponKeyOf(P) === 'magicstaff' && (P.rage||0) < 50 && !P._magicCharging){
    pStat = '🔥 ' + Math.round(P.rage||0) + '/50 ярости';
  }
  
  hudPStat.textContent = pStat;
  // Rage бар игрока
  const pRageEl = document.getElementById('hud-p-rage');
  if(pRageEl){
    const prevRage = pRageEl._lastRage || 0;
    const curRage = Math.max(0, Math.min(100, P.rage||0));
    if(prevRage < 50 && curRage >= 50){
      // Накопили ярость — синее кольцо у ног с fade+expand
      const rc9 = rootCenter();
      FX_EFFECTS.push({type:'ragering', x:rc9.x+P.pvX, y:rc9.y+P.pvY,
        t:0, duration:35, angle:0, followEntity:P});
    }
    pRageEl._lastRage = curRage;
    pRageEl.style.width = curRage + '%';
    pRageEl.style.background = curRage >= 50 ? '#2060cc' : '#5a5a5a';
  }
  // Buff display
  const pBuffEl = document.getElementById('hud-p-buff');
  if(pBuffEl) pBuffEl.textContent = P.rageBuffEnd>GameTime ? '⚔ ЯРОСТЬ 2x' : '';

  // Бот: показываем только когда dummyOn
  if(!dummyOn){ hudBot.style.opacity='0'; return; }
  // Показываем бота всегда пока он активен (можно добавить условие "в таргете")
  hudBot.style.opacity='1';
  hudBHP.style.width  = Math.max(0,Math.min(100,D.hp)) + '%';
  hudBHP.style.background = D.hp>50?'#cc4040':D.hp>25?'#cc7020':'#882020';
  hudBSt.style.width  = Math.max(0, Math.min(100, D.stamina)) + '%';
  hudBSt.style.background = '#ccaa20';
  const bRageEl = document.getElementById('hud-b-rage');
  if(bRageEl){
    bRageEl.style.width = Math.max(0, Math.min(100, D.rage||0)) + '%';
    bRageEl.style.background = (D.rage||0) >= 50 ? '#2060cc' : '#5a5a5a';
  }
  if(typeof NET_SYNC!=='undefined'&&NET_SYNC.active){
    // В PVP — показываем имя и пинг вместо AI-фазы
    const pingMs=typeof NET_CORE!=='undefined'?NET_CORE.getPing():0;
    hudBPh.textContent = (NET_SYNC.peerName||'') + ' · ' + pingMs+'ms';
    hudBPh.style.color = pingMs<80?'#4acc80':pingMs<150?'#ccaa30':'#cc5050';
  } else {
    const phase = AI.phase;
    const tacticStr = AI.tactic==='COMBAT_HARASS'?' [ИЗМ]':'';
    const phaseTxt = phase==='attack'?'⚔ АТАКА'+tacticStr:phase==='retreat'?'🏃 ОТСТУП':'😮‍💨 ПЕРЕДЫШКА';
    const phaseCol = phase==='attack'?'#cc5030':phase==='retreat'?'#3090cc':'#aaaa30';
    const tLeft = AI._phaseEnd>0?' '+Math.max(0,AI._phaseEnd-GameTime).toFixed(1)+'s':'';
    const styleStr = AI.swordStyle==='SWORD_STYLE_DUELIST'?' 🛡DUE':AI.swordStyle==='SWORD_STYLE_MIRROR'?' 🪞MIR':' ⚔SWD';
    hudBPh.textContent = phaseTxt + tLeft + styleStr;
    hudBPh.style.color = phaseCol;
  }
  let bStat = '';
if(isUnbalanced(D)) bStat = '💫 ДИСБАЛАНС';
else if(isExhausted(D)) bStat = '😫 УСТАЛОСТЬ';
  hudBStat.textContent = bStat;
}

// ──────────────── END LAYER: HUD ────────────────

// ════════════════════════════════════════════════════════════════════════════
