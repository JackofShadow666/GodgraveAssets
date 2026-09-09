# Source Map

First read for most `src/` tasks. Use it to avoid broad project searches.

## Use Rules

- Small obvious change: route by this map, then read only the target file and nearest `AGENTS.md`.
- Pack of related changes: list the affected zones from this map, then read only those files.
- Unclear bug, new mechanic, online/local/mobile divergence, or refactor: start here, then widen with targeted `rg`.
- Do not read `Build.standalone.html` for normal tasks.
- Open `Build.html` only for DOM/CSS/overlay/script-load-order tasks.
- Update this map when files are added, removed, renamed, or ownership/fast routing changes.

## Bootstrap Docs

- `src/MAP.md`: routing map; update when architecture routes change.
- `src/AGENTS.md`: local rules; note that any `net.js` mention means the split `src/network/net-*.js` files.
- `src/RUNTIME.md`: shared globals, loader-order notes, and cross-system ownership.

## Main Flow

- `src/main.js`: main tick, game loop orchestration, keyboard/mouse handlers, camera, render calls, network hooks, optional `perfprof` fixed-tick profiler logs.
- `src/combat/combat.js`: owns `P`, `D`, death/round state, melee damage, round reset.
- `src/arena/arena.js`: arena update/draw, character rendering, visual positioning.
- `src/ui/hud.js`: HUD refresh for solo, local PvP, online PvP, wins/health/stamina display.

## Combat

- `src/combat/weapons.js`: weapon definitions, equip/drop/throw/swap, weapon traits, shield/weapon metadata.
- `src/combat/flail.js`: flail spin/extension, dedicated out/back/out flick detector, forced inertial fold until fully closed, per-revolution hammer swing sound and 15 stamina cost at any extension, rage-gated lunge (1.5x full spin reach), swept head collisions, pulling, fixed-size visual chain simulation and rendering, bot swing direction lock helper and reduced bot-only buildup. `updateFlailCombat` runs after entity movement and before ordinary melee collisions.
- `src/combat/balance.test.cjs`: actual-handler tests for damage/table loading, projectile blocks, wand effects, bow dodge and network contacts; run `node src/combat/balance.test.cjs`. Not a browser runtime script.
- `src/combat/flail.test.cjs`: isolated Node tests for flail mechanics, local slots, network receive handlers and physics cost; run `node src/combat/flail.test.cjs`. Not a browser runtime script.
- `src/combat/ranged.js`: projectiles, wand/crossbow fire, ranged bot behavior; unified projectile block cost (30 on defender), wand impact impulse/disarm, final damage multiplier after caps, arrow charge-time metadata for bot dodge chance.
- `src/combat/factions.js`: local PvP targeting, teams, victory rules, friendly/enemy damage routing.
- `src/combat/debug-balls.js`: isolated debug ball/collision sandbox.

## AI

- `src/ai/ai.js`: bot decisions, duel behavior, movement intent, dodge/attack choices; flail uses the axe swing AI family. `src/arena/arena.js` sends its actual aim to `updateFlailSwing(..., true)`, preserving flick/status fold rules.

## Input

- `src/input/player-controls.js`: local multiplayer slots, synthetic per-player input, local PvP control routing.
- `src/input/gamepad-adapter.js`: gamepad integration adapter over existing controls.
- `src/input/gamepad-controls.js`: full gamepad polling, synthetic DOM input, menu cursor, virtual keyboard.
- `src/input/keyboard-layout.js`: keyboard code aliases for EN/RU layouts.
- `src/ui/mobile.js`: mobile controls, virtual landscape, settings pointer scrollbar, mobile menu/buttons; can call gameplay actions.

## Core

- `src/core/engine.js`: canvas, viewport, world/camera coordinates, base input state, edge-triggered camera tracking, global runtime primitives.
- `src/core/settings.js`: settings definitions/bindings, saved values, `sv(...)` access.
- `src/core/math.js`: geometry, interpolation, angle/vector helpers.
- `src/core/entity.js`: entity helpers/shared structure.
- `src/core/i18n.js`: UI/runtime strings, DOM text application, labels/placeholders/titles.
- `src/core/debug-config.js`: startup debug switches, especially browser input unlock.

## Systems

- `src/systems/fx.js`: particles, hit text, blood, transient visuals.
- `src/systems/buff.js`: status effects and timed modifiers.
- `src/systems/audio.js`: music and sfx.
- `src/systems/sprites.js`: sprite cache, asset loading, drawing helpers.

## Network

- `src/network/net-core.js`: PeerJS setup, reliable/fast channels, chat transport.
- `src/network/net-sync.js`: PvP state sync, reset flow, remote entity updates; flail extension/head/phase snapshots with sequence numbers, reliable hit/cancel handling, owner-side pull, monotonic flail revolution counter for remote audio (no remote stamina debit). Both peers need the updated runtime.
- `src/network/net-ui.js`: profile persistence, overlays, network menu, friend list UI.
- `src/network/net-lobby.js`: quick lobby discovery and auto-connect flow.
- `src/network/net-effects.js`: online dodge/hitstop/wins/blood compatibility hooks.

## Fast Routes

- Melee hit/block/damage/death: `src/combat/combat.js`, then `src/combat/weapons.js`, then `src/main.js`.
- Flail lunge: `src/combat/flail.js`; damage and ordinary-melee exclusion -> `src/combat/combat.js`; LMB -> `src/main.js`, local slots -> `src/input/player-controls.js`; reliable hit/cancel routing -> `src/network/net-core.js` and `net-sync.js`. Ring nodes stay local; hit/block is decided once by the attacker, victim movement by its owner. Pull starts a 1.5-second `DISBALANCE` through `src/systems/buff.js`; LMB requires rage >= 50 and spends 50 once.
- Weapon stats/swap/drop/throw/shield: `src/combat/weapons.js`; flail-only -> `src/combat/flail.js`; ranged -> `src/combat/ranged.js`.
- Bow dodge discount: `spendDodgeStamina` in `src/combat/weapons.js`, called only on successful dodges in `src/ui/mobile.js` and `src/input/player-controls.js`; timestamp persists across weapon swaps and resets per round.
- Damage balance: optional table column 19 `damageMult` defaults to 0.5 for flail and 1 for other weapons; applied in `src/combat/ranged.js` `applyDamage` after minimum/cap calculations. Thrown weapons pass their original type explicitly.
- Projectile block/wand/arrow impact: `src/combat/ranged.js`, plus thrown-weapon block contacts in `src/combat/weapons.js`; reliable `projectileContact` events route through `src/network/net-core.js` and `net-sync.js`, applied once on the defender owner.
- Bot behavior/balance: `src/ai/ai.js`, then weapon/combat file for the affected mechanic. Flail bot hook/direction timing is split between `src/arena/arena.js` and `src/combat/flail.js`.
- HUD/wins/health/stamina labels: `src/ui/hud.js`, then `src/core/i18n.js` for text.
- Settings slider/checkbox/default: `Build.html` data controls, `src/core/i18n.js` label text, `src/core/settings.js` cache/bindings, then the consuming gameplay file.
- Text/translation/button label: `src/core/i18n.js`; open `Build.html` only if DOM ids or load order matter.
- Keyboard input/layout bug: `src/main.js` for handlers, `src/input/keyboard-layout.js` for aliases.
- Gamepad gameplay input: `src/input/gamepad-controls.js`, then `src/input/gamepad-adapter.js` if local slots are involved.
- Local PvP/control slots/factions: `src/input/player-controls.js` and `src/combat/factions.js` together.
- Mobile-only bug: `src/ui/mobile.js`, then the gameplay file it triggers.
- Online-only bug: relevant `src/network/net-*.js`, then the gameplay owner file.
- Arena/camera/character drawing: `src/core/engine.js` for world/camera coordinates, then `src/arena/arena.js`, then `src/main.js`.
- Visual effects/blood/hit text: `src/systems/fx.js`, then `src/network/net-effects.js` if online differs.
- Audio/music/sfx: `src/systems/audio.js`.
- Sprites/assets/missing image: `src/systems/sprites.js`, then `src/core/i18n.js` for missing-file text.
- Startup crash/input locked by overlay: `src/core/debug-config.js`, then `src/main.js` or `Build.html` if load order matters.
- Debug balls/collision sandbox: `src/combat/debug-balls.js` only unless it leaks into main combat.

## Widen Context Triggers

- Same bug differs online: add `src/network/net-sync.js` or `src/network/net-effects.js`.
- Same bug differs in local PvP: add `src/input/player-controls.js` plus `src/combat/factions.js`.
- Same bug differs on mobile: add `src/ui/mobile.js`.
- Same setting looks right in UI but not gameplay: add `src/core/settings.js` plus the consuming file.
- Same text appears wrong or mojibake: add `src/core/i18n.js`; check file encoding before editing.
