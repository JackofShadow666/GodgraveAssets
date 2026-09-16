// ════════════════════════════════════════════════════════════════════════════
// Запасной PeerJS сигнальный сервер
// Деплой на Render.com (render.com) — бесплатно, БЕЗ карты, поддержка WebSocket
// После деплоя получишь URL вида https://твой-проект.onrender.com
//
// ВАЖНО: бесплатный план "засыпает" после 15 минут без трафика,
// пробуждение занимает ~30-60 секунд при следующем подключении.
// Игра в Combo.html уже учитывает это через CONNECT_TIMEOUT.
// ════════════════════════════════════════════════════════════════════════════

const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('PeerJS signaling server is running ✅');
});

const server = app.listen(PORT, () => {
  console.log('Server listening on port ' + PORT);
});

const peerServer = ExpressPeerServer(server, {
  path: '/',
  allow_discovery: false,
});

app.use('/', peerServer);

peerServer.on('connection', (client) => {
  console.log('Peer connected:', client.getId());
});

peerServer.on('disconnect', (client) => {
  console.log('Peer disconnected:', client.getId());
});