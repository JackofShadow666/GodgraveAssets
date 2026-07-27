# Source Map

Use this file as the first read for most tasks.

## How to use this map

- For a small obvious change, route by this map instead of running a broad project search.
- If the target file is clear, read only that file and the nearest `AGENTS.md`.
- Create this map before doing `src/` work if it is missing.
- Update this map when files are added, removed, renamed, responsibilities move between modules, or a fast route becomes misleading.
- Use broad search when the task is unclear, cross-cutting, risky, or explicitly asks for refactoring/debugging.

## Main flow

- `src/main.js`: main update loop, orchestration, keyboard/mouse flow, render tick
- `src/combat/combat.js`: creates `P` and `D`, handles melee combat, death, round reset
- `src/arena/arena.js`: arena updates and character rendering
- `src/ui/hud.js`: HUD refresh for solo, local PvP, and online PvP

## Combat

- `src/combat/weapons.js`: weapon definitions, equip, drop, throw, traits
- `src/combat/flail.js`: flail-only behavior
- `src/combat/debug-balls.js`: isolated collision sandbox for debug balls
- `src/combat/ranged.js`: projectiles, wand/crossbow fire, ranged bot behavior
- `src/combat/factions.js`: local PvP targeting and damage routing

## AI and input

- `src/ai/ai.js`: bot logic and duel behavior
- `src/input/player-controls.js`: local multiplayer slots and synthetic player input
- `src/input/gamepad-adapter.js`: gamepad integration layer over existing controls
- `src/ui/mobile.js`: mobile controls, mobile menu flow, orientation-specific behavior

## Shared systems

- `src/core/engine.js`: canvas, viewport, base input state, global runtime primitives
- `src/core/math.js`: geometry/interpolation helpers
- `src/core/entity.js`: entity helpers/shared structure
- `src/core/settings.js`: settings bindings and `sv(...)` access
- `src/systems/fx.js`: particles, hit text, blood, transient visuals
- `src/systems/buff.js`: status effects and timed modifiers
- `src/systems/audio.js`: music and sfx
- `src/systems/sprites.js`: sprite cache and drawing helpers

## Network

- `src/network/net-ui.js`: profile persistence, overlays, menu flow, friend list UI
- `src/network/net-core.js`: PeerJS setup, reliable/fast channels, chat transport
- `src/network/net-sync.js`: PvP state sync, reset flow, remote entity updates
- `src/network/net-lobby.js`: quick lobby discovery and auto-connect flow
- `src/network/net-effects.js`: dodge, hitstop, wins, blood pools, zone, compatibility hooks

## Fast routing

- Gameplay bug: start with `combat/` or `ai/`, then check `src/main.js`
- HUD bug: start with `src/ui/hud.js`, then check mode-specific integration
- Mobile bug: start with `src/ui/mobile.js`, then touched gameplay code
- Local PvP bug: inspect `src/input/player-controls.js` and `src/combat/factions.js` together
- Online PvP bug: inspect the specific `src/network/net-*.js` file plus the gameplay file
