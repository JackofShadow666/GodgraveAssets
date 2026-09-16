// Local WebSocket relay for Godgrave auto-match.
// Run: node src/network/relay-server.cjs

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const WAITING = [];
const CLIENTS = new Set();
const ROOMS = new Map();

function acceptKey(key){
  return crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

function send(client, msg){
  if(client.socket.destroyed) return;
  const payload = Buffer.from(JSON.stringify(msg));
  let header;
  if(payload.length < 126){
    header = Buffer.from([0x81, payload.length]);
  } else if(payload.length < 65536){
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  client.socket.write(Buffer.concat([header, payload]));
}

function parseFrames(client, chunk){
  client.buffer = Buffer.concat([client.buffer, chunk]);
  const messages = [];
  while(client.buffer.length >= 2){
    const first = client.buffer[0];
    const second = client.buffer[1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let len = second & 0x7f;
    let offset = 2;
    if(len === 126){
      if(client.buffer.length < offset + 2) break;
      len = client.buffer.readUInt16BE(offset);
      offset += 2;
    } else if(len === 127){
      if(client.buffer.length < offset + 8) break;
      const big = client.buffer.readBigUInt64BE(offset);
      if(big > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('frame too large');
      len = Number(big);
      offset += 8;
    }
    let mask;
    if(masked){
      if(client.buffer.length < offset + 4) break;
      mask = client.buffer.subarray(offset, offset + 4);
      offset += 4;
    }
    if(client.buffer.length < offset + len) break;
    const payload = Buffer.from(client.buffer.subarray(offset, offset + len));
    client.buffer = client.buffer.subarray(offset + len);
    if(opcode === 0x8){
      client.socket.end();
      continue;
    }
    if(opcode !== 0x1) continue;
    if(masked){
      for(let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    }
    messages.push(payload.toString('utf8'));
  }
  return messages;
}

function cleanup(client){
  CLIENTS.delete(client);
  const waitIndex = WAITING.indexOf(client);
  if(waitIndex >= 0) WAITING.splice(waitIndex, 1);
  if(client.roomId){
    const room = ROOMS.get(client.roomId);
    if(room){
      const peer = room.a === client ? room.b : room.a;
      ROOMS.delete(client.roomId);
      if(peer && !peer.socket.destroyed){
        peer.roomId = null;
        peer.peer = null;
        send(peer, { type:'peerLeft' });
      }
    }
  }
}

function match(client){
  while(WAITING.length && WAITING[0].socket.destroyed) WAITING.shift();
  const peer = WAITING.shift();
  if(!peer){
    WAITING.push(client);
    send(client, { type:'waiting' });
    return;
  }
  const roomId = crypto.randomBytes(5).toString('hex');
  client.roomId = roomId;
  peer.roomId = roomId;
  client.peer = peer;
  peer.peer = client;
  ROOMS.set(roomId, { a:peer, b:client });
  send(peer, { type:'matched', roomId, role:'host', peerName:client.name || 'Player' });
  send(client, { type:'matched', roomId, role:'guest', peerName:peer.name || 'Player' });
}

function handle(client, msg){
  if(msg.type === 'ping'){
    send(client, { type:'pong', t:msg.t });
    return;
  }
  if(msg.type === 'findMatch'){
    client.id = String(msg.id || '');
    client.name = String(msg.name || 'Player').slice(0, 32);
    client.game = String(msg.game || 'godgrave');
    client.version = String(msg.version || 'dev');
    match(client);
    return;
  }
  if(msg.type === 'data'){
    if(client.peer && !client.peer.socket.destroyed) send(client.peer, msg);
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type':'text/plain; charset=utf-8' });
  res.end('Godgrave relay is running\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if(!key){
    socket.destroy();
    return;
  }
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    '',
    '',
  ].join('\r\n'));

  const client = { socket, buffer:Buffer.alloc(0), roomId:null, peer:null, name:'Player' };
  CLIENTS.add(client);
  socket.on('data', chunk => {
    let frames;
    try{ frames = parseFrames(client, chunk); }
    catch(_err){ socket.destroy(); return; }
    for(const text of frames){
      try{ handle(client, JSON.parse(text)); }
      catch(_err){ send(client, { type:'error', message:'bad message' }); }
    }
  });
  socket.on('close', () => cleanup(client));
  socket.on('error', () => cleanup(client));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Godgrave relay listening on ws://127.0.0.1:${PORT}`);
});
