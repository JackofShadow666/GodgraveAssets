// === src/core/settings.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// LAYER: SETTINGS — панель настроек (sv/cb/bindSlider), слайдеры
// Module file: settings.js
// ════════════════════════════════════════════════════════════════════════════

// ── ПОЛЗУНКИ ────────────────────────────────────────────────────────────────
// Кэш значений слайдеров/чекбоксов: sv()/cb() вызываются очень часто (в AI и
// боевой логике — многократно за кадр на каждого бота), поэтому вместо
// getElementById+parseFloat при каждом вызове читаем закэшированное значение,
// а кэш обновляем один раз через делегированные события input/change.
const _slCache = Object.create(null);
const _cbCache = Object.create(null);
function sv(id){
  let v = _slCache[id];
  if(v === undefined){
    const el = document.getElementById('sl-'+id);
    v = _slCache[id] = el ? parseFloat(el.value) : NaN;
  }
  return v;
}
function cb(id){
  let v = _cbCache[id];
  if(v === undefined){
    const el = document.getElementById('cb-'+id);
    v = _cbCache[id] = el ? el.checked : false;
  }
  return v;
}

// ════════════════════════════════════════════════════════════════════════════
// 🔥 СТИЛЬ ДЛЯ ДАЛЬНОБОЙНОГО ОРУЖИЯ
// ════════════════════════════════════════════════════════════════════════════
function getRangedStyle(){
  return {
    dist: 26,
    ex: 0,
    ey: -8,
    eyOffset: -15,   // ← ДОПОЛНИТЕЛЬНОЕ СМЕЩЕНИЕ ВВЕРХ
    blk: 0.17,
    adaY: false,
    adaD: false,
    adaXb: 0,
    adaXp: 0,
    ada12: false
  };
}
// ════════════════════════════════════════════════════════════════════════════

// ── ЭКСПОРТ НАСТРОЕК ────────────────────────────────────────────────────────
document.getElementById('dtoggle').addEventListener('click', () => toggleAI());

document.addEventListener('input', e=>{
  const id = e.target && e.target.id;
  if(id && id.startsWith('sl-')) _slCache[id.slice(3)] = parseFloat(e.target.value);
});
document.addEventListener('change', e=>{
  const id = e.target && e.target.id;
  if(id && id.startsWith('cb-')) _cbCache[id.slice(3)] = e.target.checked;
});
// ════════════════════════ END ЯДРО ДВИЖКА (ENGINE CORE) ══════════════════════

// ════════════════════════════════════════════════════════════════════════════
// MODULE: SETTINGS  (биндинги слайдеров/чекбоксов панели настроек к DOM)
// Future: extract to settings.js — зависит только от ЯДРА (sv/cb/_slCache)
// ════════════════════════════════════════════════════════════════════════════
function bindSlider(id, fmt){
  const el = document.getElementById('sl-'+id);
  const vl = document.getElementById('vl-'+id);
  if (!el || !vl) return;
  const update = ()=>{ vl.textContent = fmt ? fmt(+el.value) : '['+el.value+']'; };
  el.addEventListener('input', update);
  update();
}
bindSlider('playerglow');
bindSlider('bgbright');
bindSlider('gridbright');
document.getElementById('sl-bgbright').addEventListener('input', () => { arenaDirty = true; });
document.getElementById('sl-gridbright').addEventListener('input', () => { arenaDirty = true; });
bindSlider('dist');
bindSlider('spd');
bindSlider('inertia');
bindSlider('globalspd');
bindSlider('ex');
bindSlider('ey');
bindSlider('blk');
bindSlider('adaY');
bindSlider('adaD');
document.getElementById('cb-adaY').addEventListener('change', function(){
  document.getElementById('row-adaY').style.display = this.checked ? 'flex' : 'none';
});
document.getElementById('cb-adaD').addEventListener('change', function(){
  document.getElementById('row-adaD').style.display = this.checked ? 'flex' : 'none';
});
bindSlider('adaXb');
bindSlider('adaXp');
bindSlider('ada12');
document.getElementById('cb-adaX').addEventListener('change', function(){
  document.getElementById('row-adaX').style.display = this.checked ? 'flex' : 'none';
  document.getElementById('row-adaX2').style.display = this.checked ? 'flex' : 'none';
});
document.getElementById('cb-ada12').addEventListener('change', function(){
  document.getElementById('row-ada12').style.display = this.checked ? 'flex' : 'none';
});
bindSlider('cscl');
bindSlider('swlen');
bindSlider('flailspeedmult');
bindSlider('flailsag');
bindSlider('dzone');
document.getElementById('sl-camrows')?.addEventListener('input', () => { applyCamScale(); arenaDirty = true; });
document.getElementById('cb-followcam')?.addEventListener('change', () => { snapCameraToTarget(); arenaDirty = true; });
document.getElementById('sl-botcount')?.addEventListener('input', function(){
  document.getElementById('vl-botcount').textContent = this.value;
  const count=Math.max(0,Number(this.value)||0);
  if(count>0) window._localBotSpawnPreset=count;
  if(typeof applyBotCount==='function') applyBotCount();
});
document.getElementById('cb-botrandomweapon')?.addEventListener('change', function(){
  if(!this.checked || typeof ALL_BOTS === 'undefined' || typeof maybeSetRandomBotWeapon !== 'function') return;
  for(const bot of ALL_BOTS) maybeSetRandomBotWeapon(bot, true);
});

document.getElementById('sl-musicvol')?.addEventListener('input', function(){
  const v=parseFloat(this.value);
  document.getElementById('vl-musicvol').textContent=v.toFixed(2);
  if(typeof currentMusicObj!=='undefined'&&currentMusicObj) currentMusicObj.volume=v;
  window._musicVol=v;
});
// bindSlider('airad'/'aispd'/'aicd'/'aipvd'/'aipvp') удалены — автоблок-с-радиусом вырезан
// aikb removed - use bodyKB
bindSlider('aiang');
bindSlider('duelrad');
bindSlider('circchance');
bindSlider('probingchance');
bindSlider('probingretreat');
bindSlider('spindur');

// ── ЭКСПОРТ НАСТРОЕК ────────────────────────────────────────────────────────
document.getElementById('dtoggle').addEventListener('click', () => toggleAI());
document.getElementById('btn-blockkb').addEventListener('click', () => {
  blockKnockOn = !blockKnockOn;
  const b = document.getElementById('btn-blockkb');
  b.textContent = window.I18N ? window.I18N.buttonText('blockKb', blockKnockOn ? 'on' : 'off') : (blockKnockOn ? 'ON' : 'OFF');
  b.style.borderColor = blockKnockOn ? '#aa6020' : '#6a4010';
  b.style.color = blockKnockOn ? '#ffaa40' : '#cc8020';
});
document.getElementById('btn-boxes').addEventListener('click', () => {
  boxesOn = !boxesOn;
  const b = document.getElementById('btn-boxes');
  b.textContent = window.I18N ? window.I18N.buttonText('boxes', boxesOn ? 'on' : 'off') : (boxesOn ? 'ON' : 'OFF');
  b.style.borderColor = boxesOn ? '#7a3aaa' : '#3a1a5a';
});

document.getElementById('btn-export').addEventListener('click', () => {
  const sliders = document.querySelectorAll('input[type=range]');
  const checks  = document.querySelectorAll('input[type=checkbox]');
  const out = {};
  sliders.forEach(s => { out[s.id.replace('sl-','')] = parseFloat(s.value); });
  checks.forEach(c  => { out[c.id.replace('cb-','')] = c.checked; });
  const text = JSON.stringify(out, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-export');
    const orig = btn.textContent;
    btn.textContent = window.I18N ? window.I18N.t('buttons.exportCopied') : 'COPIED';
    btn.style.color = '#80ff80';
    setTimeout(() => { btn.textContent = orig; btn.style.color = '#3acc70'; }, 1500);
  });
});

// ── ШАРИКИ ──────────────────────────────────────────────────────────────────
// (модуль ДЕБАГ: СПАВН ШАРИКОВ перенесён отдельным блоком — см.
// MODULE: DEBUG BALLS ниже, после MODULE: SETTINGS, чтобы не разрывать
// settings посторонним кодом посередине)
bindSlider('aex');
bindSlider('aey');
bindSlider('as');
bindSlider('sc0');
bindSlider('sc1');
bindSlider('scs');
bindSlider('srot');
bindSlider('sox');
bindSlider('soy');
// arad/abrad/abspd/abN/abOff/abex/abey/aboxo/aboyo removed
bindSlider('dbg', v => v>0.5 ? '[ВКЛ]' : '[ВЫКЛ]');
bindSlider('swthresh');
bindSlider('stamblock');
bindSlider('stamswing');
bindSlider('kbforce');
bindSlider('unbdur');
bindSlider('unbcombo');
bindSlider('stamreg');
bindSlider('gamespeed');
bindSlider('camrows');
bindSlider('camedge');
bindSlider('camdelay');
bindSlider('camlerp');
bindSlider('botspd');
bindSlider('botdodgechance');
bindSlider('botdodgetoward');
bindSlider('botscale');
bindSlider('botswordscale');
bindSlider('playerrespawn');
bindSlider('lmbcost');
bindSlider('lmbdmg');
bindSlider('rageper');
bindSlider('ragebuf');
bindSlider('exhdur2');
bindSlider('exhspd2');
bindSlider('exhswd2');
bindSlider('bladeKB');
bindSlider('shieldSideSpd');
bindSlider('bodyKB');
bindSlider('blockSlowDur');
bindSlider('blockSlowMult');
bindSlider('deflectMin');
bindSlider('deflectMax');
bindSlider('swordback');
bindSlider('blockKB');
bindSlider('swres');
bindSlider('flickwindow');
bindSlider('flickminvel');
bindSlider('flickminamp');
bindSlider('flickcount');
bindSlider('flickmaxmult');
bindSlider('stamflick');
bindSlider('gamepadflickwindow');
bindSlider('gamepadflickminvel');
bindSlider('gamepadflickminamp');
bindSlider('gamepadflickcount');
bindSlider('gamepadflickmaxmult');
bindSlider('gamepadstamflick');
bindSlider('orbitwindow');
bindSlider('orbitturns');
bindSlider('bbwindow');
bindSlider('disarmchance');
bindSlider('stamorbit');

// ──────────────── END LAYER: SETTINGS ────────────────

// ════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  [
    'sl-playerrespawn-legacy',
    'cb-gamepadflickdet-legacy',
    'sl-gamepadflickwindow-legacy',
    'sl-gamepadflickminvel-legacy',
    'sl-gamepadflickminamp-legacy',
    'sl-gamepadflickcount-legacy',
    'sl-gamepadflickmaxmult-legacy',
    'sl-gamepadstamflick-legacy'
  ].forEach(id => {
    document.getElementById(id)?.closest('.row')?.style.setProperty('display', 'none');
  });
});
