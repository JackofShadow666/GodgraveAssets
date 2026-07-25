# Runtime Notes

The project relies on shared globals and loader order rather than module imports.

## Core shared state

- `P`: main player entity
- `D`: current enemy/bot entity
- `GameTime`: shared game clock
- `keys`, `mDown`, `mX`, `mY`: current input state
- `W`, `H`, `canvas`, `ctx`: viewport and render context

## Common gameplay state

- `DEATH`: round-end, fade, victory/defeat state
- `hitFX`: floating text and impact text
- `DODGE_TRAIL`: dodge afterimage data
- `BALLS`: debug projectile sandbox in combat

## Cross-system globals

- `NET_CORE`, `NET_CHAT`, `NET_SYNC`: online state and sync
- `LocalPlayerControls`, `PLAYER_SLOTS`: local multiplayer state
- `FactionRules`: local PvP targeting and team logic

## Important ownership

- `src/combat/combat.js` owns `P`, `D`, `DEATH`, round restart, and melee damage flow
- `src/main.js` owns the main tick and calls into AI, combat, HUD, render, and network hooks
- `src/network/net.js` patches several runtime behaviors late through `window.*`
- `src/ui/mobile.js` can trigger gameplay actions, not only UI

## When to widen context

- If a fix behaves differently online, open `src/network/net.js`
- If a fix behaves differently in local PvP, open `src/input/player-controls.js` and `src/combat/factions.js`
- If a fix behaves differently on mobile, open `src/ui/mobile.js`
