// === src/systems/buff.js ===
// Central status-effect state machine. It is loaded after FX and before gameplay.
// MODULE: BUFF SYSTEM
//
// HOW IT WORKS:
// A buff is a short script of STEPS run one after another on an entity:
// "show floating text" -> "apply a modifier for N sec" -> "wait N sec" ->
// "apply another modifier for N sec" -> done. Text steps finish instantly;
// modifier/wait steps block the next step until their own Timer expires.
// A modifier step never touches movement/sword code directly — it just
// writes ent._mods[key] = {value, until}. Everywhere that used to ask
// "is this entity exhausted?" now asks getMod(ent,'moveSlow',1) /
// getMod(ent,'swordSlow',1), which auto-expires and falls back to the
// neutral value (1 = no effect) once the timer runs out. So tuning or
// re-ordering a status effect only means editing its entry in BUFF_DEFS —
// nothing else in the file needs to know the buff exists.
// startBuff(ent,'EXHAUST',...) starts/restarts a buff; updateBuffs(ent,dt)
// must run once per entity per tick to advance it.
// ════════════════════════════════════════════════════════════════════════════

function makeTimer(duration){ return { t: duration }; }
function tickTimer(timer, dt){ timer.t -= dt; return timer.t <= 0; }

function getMod(ent, key, fallback){
  const m = ent._mods && ent._mods[key];
  if(!m) return fallback;
  if(GameTime >= m.until){ delete ent._mods[key]; return fallback; }
  return m.value;
}
function hasMod(ent, key){
  const m = ent._mods && ent._mods[key];
  return !!(m && GameTime < m.until);
}

const Act = {
  text(label, col){
    return { start(ent){
      if(label){
        const c = entityBodyCenter(ent);
        const t = typeof label === 'function' ? label(ent) : label;
        spawnFloatingText(ent, t, { x:c.x, y:c.y-50, col:col||'#ff8844' });
      }
      return true; // instant
    }};
  },
  modifier(key, value, duration){
    return {
      start(ent, ctx){
        ent._mods = ent._mods || {};
        ent._mods[key] = { value, until: GameTime + duration };
        ctx.timer = makeTimer(duration);
        return false;
      },
      tick(ent, ctx, dt){ return tickTimer(ctx.timer, dt); }
    };
  },
  wait(duration){
    return {
      start(ent, ctx){ ctx.timer = makeTimer(duration); return false; },
      tick(ent, ctx, dt){ return tickTimer(ctx.timer, dt); }
    };
  },
  parallelModifiers(map, duration){
    return {
      start(ent, ctx){
        ent._mods = ent._mods || {};
        const until = GameTime + duration;
        for(const k in map) ent._mods[k] = { value: map[k], until };
        ctx.timer = makeTimer(duration);
        return false;
      },
      tick(ent, ctx, dt){ return tickTimer(ctx.timer, dt); }
    };
  },
  // Runs an arbitrary one-off function, then moves on immediately
  instant(fn){
    return { start(ent, ctx){ fn(ent, ctx); return true; } };
  },
};

// ── Определения эффектов ─────────────────────────────────────────────────
const DISBALANCE_DURATION = 3;
const DISBALANCE_RECOIL_DURATION = 1;

const BUFF_DEFS = {
  EXHAUST: {
    steps: (swordSlowMult, moveSlowMult, duration) => [
      Act.text('😫 УСТАЛОСТЬ', '#ffaa44'),
      Act.parallelModifiers({ swordSlow: swordSlowMult, moveSlow: moveSlowMult }, duration),
    ],
  },
  DISBALANCE: {
    // recoilDur = 1 сек без управления мечом (он продолжает вращение),
    // slowDur   = 2 сек общего замедления меча и движения.
    steps: (recoilDur, slowDur) => [
      Act.text('💫 ДИСБАЛАНС', '#ffaa30'),
      Act.instant(ent => {
        // угол, от которого меч будет "отбит" — фиксируем в момент триггера
        ent.unbAngle = ent.angle;
        // толчок — резкий импульс вращения в противоположную сторону
        const kick = Math.max(Math.abs(ent.vel), (typeof sv === 'function' ? sv('swthresh') : 1) * 2.5);
        ent.vel = ent.vel >= 0 ? -kick : kick;
        ent._disbalanceAngularVelocity = (ent.vel >= 0 ? 1 : -1) * Math.max(Math.abs(ent.vel), 5);
      }),
      // Сначала 1 сек инерции, затем общий эффект замедления.
      Act.parallelModifiers({ weaponRecoil: 1, moveSlow: 0.3 }, recoilDur ?? DISBALANCE_RECOIL_DURATION),
      ...(slowDur > 0
        ? [Act.parallelModifiers({ swordSlow: 0.3, moveSlow: 0.3 }, slowDur)]
        : []),
    ],
  },
};

// Public name used by the modular API; `Act` is retained as a local legacy alias.
const BuffStep = Act;

BUFF_DEFS.BLADEBIND = {
  steps: duration => [
    // Blade Bind remains a mechanical status only; the shared disbalance
    // indicator is the single combat label shown to the player.
    BuffStep.instant(() => {}),
    BuffStep.parallelModifiers({ swordSlow: 0.03, moveSlow: 0.1 }, Math.max(2, duration || 2)),
  ],
};
BUFF_DEFS.RAGE = {
  steps: duration => [
    BuffStep.text('RAGE!', '#ff4020'),
    BuffStep.parallelModifiers({ damageMult: 2, moveSlow: 0.8 }, duration || 5),
  ],
};

function startBuff(ent, buffId, ...args){
  ent._buffs = ent._buffs || {};
  if(ent._buffs[buffId]) return; // already running — do NOT restart mid-sequence
  const def = BUFF_DEFS[buffId];
  if(!def) return;
  ent._buffs[buffId] = { steps: def.steps(...args), idx: 0, ctx: {}, started: false };
}
function clearBuff(ent, buffId){ if(ent._buffs) delete ent._buffs[buffId]; }
function isBuffActive(ent, buffId){ return !!(ent._buffs && ent._buffs[buffId]); }

function updateBuffs(ent, dt){
  if(!ent._buffs) return;
  for(const buffId in ent._buffs){
    const inst = ent._buffs[buffId];
    let advanced = true;
    while(advanced && inst.idx < inst.steps.length){
      const step = inst.steps[inst.idx];
      advanced = false;
      if(!inst.started){
        inst.ctx = {}; inst.started = true;
        if(step.start(ent, inst.ctx) !== false){ inst.idx++; inst.started = false; advanced = true; }
      } else if(step.tick && step.tick(ent, inst.ctx, dt)){
        inst.idx++; inst.started = false; advanced = true;
      }
    }
    if(inst.idx >= inst.steps.length) delete ent._buffs[buffId];
  }
}

// Публичные функции, совместимые с игровыми вызовами.
function applyExhaust(ent, duration){
  const effectDuration = duration !== undefined ? duration : (ent.exhaustDur || sv('exhdur2'));
  if(isExhausted(ent) || (ent._exhaustedEndTime || 0) > GameTime) return;
  startBuff(ent, 'EXHAUST',
    ent.exhaustSwd !== undefined ? ent.exhaustSwd : sv('exhswd2'),
    ent.exhaustSpd !== undefined ? ent.exhaustSpd : sv('exhspd2'),
    effectDuration);
  ent._exhaustedEndTime = GameTime + effectDuration + (ent.exhaustRegenDelay || 0);
  // После короткой задержки восстановление ускорено для всех сущностей одинаково.
  ent._staminaRegenBoostUntil = ent._exhaustedEndTime + 1.5;
}
function regenStamina(ent, dt, isUsingStamina = false){
  if(isUsingStamina || isExhausted(ent) || (ent._exhaustedEndTime || 0) > GameTime) return;
  const regenMult = (ent._staminaRegenBoostUntil || 0) > GameTime ? 8 : 1;
  const isStanding = Math.hypot(ent.vx || 0, ent.vy || 0) < 0.1;
  const standingRegenMult = isStanding ? 3 : 1;
  ent.stamina = Math.min(ent.stamMax, ent.stamina + dt * ent.stamRegen * 0.2 * regenMult * standingRegenMult);
}
function applyDisbalance(ent){
  // unbdur is the full status duration. The opening recoil occupies part of it;
  // the regular slowdown continues for the remainder.
  const duration = Math.max(0.1, typeof sv === 'function' ? sv('unbdur') : DISBALANCE_DURATION);
  const recoilDuration = Math.min(DISBALANCE_RECOIL_DURATION, duration);
  startBuff(ent, 'DISBALANCE', recoilDuration, Math.max(0, duration - recoilDuration));
}
function isExhausted(ent){ return isBuffActive(ent,'EXHAUST'); }
function isUnbalanced(ent){ return isBuffActive(ent,'DISBALANCE'); }
// One shared gate for every status that temporarily deactivates a weapon.
function isWeaponDisabled(ent){ return !!ent && (isExhausted(ent) || isUnbalanced(ent)); }
function applyBladeBind(ent, duration = 2){ startBuff(ent, 'BLADEBIND', Math.max(2, duration || 2)); }
function applyRage(ent, duration){ startBuff(ent, 'RAGE', duration || 5); }
function hasRage(ent){ return isBuffActive(ent, 'RAGE'); }
