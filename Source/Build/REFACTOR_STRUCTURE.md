# Godgrave Build — module map

`Build.html` remains the executable entry point. It now loads classic scripts in
their original dependency order; this deliberately preserves the game’s shared
runtime state (`P`, `D`, canvas, time, FX pools, and networking globals) while
making each subsystem independently editable. Every extracted file begins with
`// === path ===`, so the original monolith can be reassembled in loader order.

```
src/
├── core/
│   ├── engine.js       canvas, input, time and global constants
│   ├── entity.js       common Entity base class for player and bots
│   ├── math.js         geometry and interpolation helpers
│   └── settings.js     DOM-backed settings helpers and bindings
├── systems/
│   ├── audio.js        SFX/music loading and playback
│   ├── buff.js         BuffStep, modifiers and status-effect helpers
│   ├── fx.js           particles, blood, lightning and impact effects
│   └── sprites.js      sprite caches and asset loading
├── combat/
│   ├── weapons.js      weapon definitions, pickup, throw and drops
│   ├── flail.js        flail simulation
│   ├── ranged.js       wand, bow, crossbow and projectiles
│   └── combat.js       collision, damage, shield, blade bind and Entity factory
├── ai/ai.js            bot controllers and duel logic
├── arena/arena.js      arena and character rendering
├── ui/hud.js           HUD updates
├── ui/mobile.js        touch controls and mobile UI
├── network/net.js      PeerJS session, chat, lobby and synchronization
└── main.js             update tick, loop and bootstrap
```

The `Entity` factory now produces `Entity` instances for both `P` and `D`.
`systems/buff.js` centralizes timed modifiers and provides `EXHAUST`,
`DISBALANCE`, `BLADEBIND`, and `RAGE` definitions plus `apply*` helpers.

## Portable build workflow

After changing any `src/` file, regenerate the phone-ready version with:

```powershell
python tools/build.py
```

This writes `Build.standalone.html`, which has no local `src/` dependencies.
To restore a modular source tree from that standalone file, use:

```powershell
python tools/split.py
```
