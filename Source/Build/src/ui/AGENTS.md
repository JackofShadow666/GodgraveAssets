# Правила для `src/ui`

- Для HUD проблем начинай с `hud.js`.
- Для мобильных проблем начинай с `mobile.js`.
- Если UI-симптом вызван gameplay state, после `ui/` открывай только владельца состояния, а не весь проект.
- Для online HUD различий дополнительно смотри `src/network/net.js`.
- Для local PvP HUD различий дополнительно смотри `src/input/player-controls.js`.
