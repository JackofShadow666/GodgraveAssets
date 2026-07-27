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
// ============================================================================

function makeTimer(duration){
return {
t: duration
};
}

function tickTimer(timer, dt){
timer.t -= dt;
return timer.t <= 0;
}

/**

* Получает игровую строку из i18n.
*
* Перевод запрашивается непосредственно перед показом текста,
* поэтому смена языка применяется к следующим сообщениям баффов.
  */
  function buffText(key, params){
  if(
  window.I18N &&
  typeof window.I18N.t === 'function'
  ){
  return window.I18N.t(key, params);
  }

// Если i18n ещё не загружен, показываем ключ вместо строки,
// чтобы игровые тексты не хранились в этом файле.
return key;
}

function getMod(ent, key, fallback){
const m = ent._mods && ent._mods[key];

if(!m){
return fallback;
}

if(GameTime >= m.until){
delete ent._mods[key];
return fallback;
}

return m.value;
}

function hasMod(ent, key){
const m = ent._mods && ent._mods[key];
return !!(m && GameTime < m.until);
}

const Act = {
text: function(label, col){
return {
start: function(ent){
if(label){
const c = $.POS.body(ent);

      const text =
        typeof label === 'function'
          ? label(ent)
          : label;

      spawnFloatingText(ent, text, {
        x: c.x,
        y: c.y - 50,
        col: col || '#ff8844'
      });
    }

    return true;
  }
};

},

modifier: function(key, value, duration){
return {
start: function(ent, ctx){
ent._mods = ent._mods || {};

    ent._mods[key] = {
      value: value,
      until: GameTime + duration
    };

    ctx.timer = makeTimer(duration);

    return false;
  },

  tick: function(ent, ctx, dt){
    return tickTimer(ctx.timer, dt);
  }
};

},

wait: function(duration){
return {
start: function(ent, ctx){
ctx.timer = makeTimer(duration);
return false;
},

  tick: function(ent, ctx, dt){
    return tickTimer(ctx.timer, dt);
  }
};

},

parallelModifiers: function(map, duration){
return {
start: function(ent, ctx){
ent._mods = ent._mods || {};

    const until = GameTime + duration;

    for(const key in map){
      if(Object.prototype.hasOwnProperty.call(map, key)){
        ent._mods[key] = {
          value: map[key],
          until: until
        };
      }
    }

    ctx.timer = makeTimer(duration);

    return false;
  },

  tick: function(ent, ctx, dt){
    return tickTimer(ctx.timer, dt);
  }
};

},

// Runs an arbitrary one-off function, then moves on immediately.
instant: function(fn){
return {
start: function(ent, ctx){
fn(ent, ctx);
return true;
}
};
}
};

// -- Effect definitions ------------------------------------------------------
const DISBALANCE_DURATION = 3;
const DISBALANCE_RECOIL_DURATION = 1;
const DISBALANCE_RECOIL_MULT = 1.8;
const DISBALANCE_RECOIL_MIN_SPEED = 9;
const POST_EXHAUST_STAMINA_PROTECTION = 0.8;

const BUFF_DEFS = {
EXHAUST: {
steps: function(swordSlowMult, moveSlowMult, duration){
return [
Act.text(
function(){
return buffText('buff.exhaust');
},
'#ffaa44'
),

    Act.parallelModifiers(
      {
        swordSlow: swordSlowMult,
        moveSlow: moveSlowMult
      },
      duration
    ),

    Act.instant(function(ent){
      ent._staminaDrainProtectedUntil =
        GameTime + POST_EXHAUST_STAMINA_PROTECTION;
    })
  ];
}

},

DISBALANCE: {
// recoilDur = duration without sword control.
// slowDur = duration of general sword and movement slowdown.
steps: function(recoilDur, slowDur){
const steps = [
Act.text(
function(){
return buffText('buff.disbalance');
},
'#ffaa30'
),

    Act.instant(function(ent){
      // Save the angle from which the sword will recoil.
      ent.unbAngle = ent.angle;

      // Apply a sharp rotational impulse in the opposite direction.
      const threshold =
        typeof sv === 'function'
          ? sv('swthresh')
          : 1;

      const kick = Math.max(
        Math.abs(ent.vel),
        threshold * 2.5
      );

      ent.vel =
        ent.vel >= 0
          ? -kick
          : kick;

      ent._disbalanceAngularVelocity =
        (ent.vel >= 0 ? 1 : -1) *
        Math.max(
          Math.abs(ent.vel) * DISBALANCE_RECOIL_MULT,
          DISBALANCE_RECOIL_MIN_SPEED
        );
    }),

    Act.parallelModifiers(
      {
        weaponRecoil: 1,
        moveSlow: 0.3
      },
      recoilDur !== undefined
        ? recoilDur
        : DISBALANCE_RECOIL_DURATION
    )
  ];

  if(slowDur > 0){
    steps.push(
      Act.parallelModifiers(
        {
          swordSlow: 0.3,
          moveSlow: 0.3
        },
        slowDur
      )
    );
  }

  return steps;
}

}
};

// Public name used by the modular API.
// `Act` is retained as a local legacy alias.
const BuffStep = Act;

BUFF_DEFS.RAGE = {
steps: function(duration){
return [
BuffStep.text(
function(){
return buffText('buff.rage');
},
'#ff4020'
),

  BuffStep.parallelModifiers(
    {
      damageMult: 2,
      moveSlow: 0.8
    },
    duration || 5
  )
];

}
};

function startBuff(ent, buffId){
const args = Array.prototype.slice.call(arguments, 2);

ent._buffs = ent._buffs || {};

// Already running — do not restart in the middle of the sequence.
if(ent._buffs[buffId]){
return;
}

const def = BUFF_DEFS[buffId];

if(!def){
return;
}

ent._buffs[buffId] = {
steps: def.steps.apply(def, args),
idx: 0,
ctx: {},
started: false
};
}

function clearBuff(ent, buffId){
if(ent._buffs){
delete ent._buffs[buffId];
}
}

function isBuffActive(ent, buffId){
return !!(
ent._buffs &&
ent._buffs[buffId]
);
}

function updateBuffs(ent, dt){
if(!ent._buffs){
return;
}

for(const buffId in ent._buffs){
if(
!Object.prototype.hasOwnProperty.call(
ent._buffs,
buffId
)
){
continue;
}

const inst = ent._buffs[buffId];
let advanced = true;

while(
  advanced &&
  inst.idx < inst.steps.length
){
  const step = inst.steps[inst.idx];

  advanced = false;

  if(!inst.started){
    inst.ctx = {};
    inst.started = true;

    if(step.start(ent, inst.ctx) !== false){
      inst.idx++;
      inst.started = false;
      advanced = true;
    }
  } else if(
    step.tick &&
    step.tick(ent, inst.ctx, dt)
  ){
    inst.idx++;
    inst.started = false;
    advanced = true;
  }
}

if(inst.idx >= inst.steps.length){
  delete ent._buffs[buffId];
}

}
}

// Public functions compatible with existing gameplay calls.
function applyExhaust(ent, duration){
const effectDuration =
duration !== undefined
? duration
: (
ent.exhaustDur ||
sv('exhdur2')
);

if(
isExhausted(ent) ||
(ent._exhaustedEndTime || 0) > GameTime
){
return;
}

startBuff(
ent,
'EXHAUST',

ent.exhaustSwd !== undefined
  ? ent.exhaustSwd
  : sv('exhswd2'),

ent.exhaustSpd !== undefined
  ? ent.exhaustSpd
  : sv('exhspd2'),

effectDuration

);

ent._exhaustedEndTime =
GameTime +
effectDuration +
(ent.exhaustRegenDelay || 0);

// After a short delay, regeneration is boosted equally for all entities.
ent._staminaRegenBoostUntil =
ent._exhaustedEndTime + 1.5;
}

function regenStamina(ent, dt, isUsingStamina){
if(isUsingStamina === undefined){
isUsingStamina = false;
}

if(
isUsingStamina ||
isExhausted(ent) ||
(ent._exhaustedEndTime || 0) > GameTime
){
return;
}

const regenMult =
(ent._staminaRegenBoostUntil || 0) > GameTime
? 8
: 1;

const isStanding =
Math.hypot(
ent.vx || 0,
ent.vy || 0
) < 0.1;

const standingRegenMult =
isStanding
? 3
: 1;

ent.stamina = Math.min(
ent.stamMax,
ent.stamina +
dt *
ent.stamRegen *
0.2 *
regenMult *
standingRegenMult
);
}

function applyDisbalance(ent, source){
if(isUnbalanced(ent)){
return false;
}

// unbdur is the full status duration.
// The recoil occupies the opening part of the effect,
// while slowdown continues for the remaining duration.
const duration = Math.max(
0.1,
typeof sv === 'function'
? sv('unbdur')
: DISBALANCE_DURATION
);

const recoilDuration = Math.min(
DISBALANCE_RECOIL_DURATION,
duration
);

startBuff(
ent,
'DISBALANCE',
recoilDuration,
Math.max(
0,
duration - recoilDuration
)
);

if(
source &&
source !== ent &&
source.stamina !== undefined
){
source.stamina = Math.max(
source.stamina,
Math.min(
45,
source.stamMax || 45
)
);
}

return true;
}

function isExhausted(ent){
return isBuffActive(
ent,
'EXHAUST'
);
}

function drainStamina(ent, amount){
if(
!ent ||
amount <= 0 ||
(ent._staminaDrainProtectedUntil || 0) > GameTime
){
return 0;
}

const before = ent.stamina || 0;

ent.stamina = Math.max(
0,
before - amount
);

return before - ent.stamina;
}

function isUnbalanced(ent){
return isBuffActive(
ent,
'DISBALANCE'
);
}

// Shared gate for statuses that temporarily deactivate a weapon.
function isWeaponDisabled(ent){
return !!ent && (
isExhausted(ent) ||
isUnbalanced(ent)
);
}

function applyRage(ent, duration){
startBuff(
ent,
'RAGE',
duration || 5
);
}

function hasRage(ent){
return isBuffActive(
ent,
'RAGE'
);
}
