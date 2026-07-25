# Правила для `src/network`

- Сначала выбери нужный split-файл:
- `net-ui.js` для storage, profile, overlay, friend list и network menu.
- `net-core.js` для PeerJS, connect/disconnect, reliable/fast channel и chat transport.
- `net-sync.js` для PvP state sync, reset flow и remote entity updates.
- `net-lobby.js` для quick lobby и auto-connect.
- `net-effects.js` для dodge hooks, hitstop, wins, blood pools, zone и compatibility globals.
- Для online PvP desync сначала ищи точки входа `NET_SYNC` и вызовы из gameplay.
- Для lobby/server/connect проблем держи контекст в зоне `net-core.js` и `net-lobby.js`.
- Для chat/profile/menu проблем не тащи в контекст combat-логику без необходимости.
- Помни, что `net-effects.js` и частично `net-ui.js` поздно грузятся и патчат поведение через `window.*`; ищи не только прямую логику, но и обёртки.
