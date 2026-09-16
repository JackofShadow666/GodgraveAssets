// === src/network/net-relay.js ===
// WebSocket relay transport for auto-match. It keeps the old NET_CORE/NET_SYNC
// contract alive, so gameplay packets do not need a separate sync path.

var NET_RELAY = (function(){
  function defaultRelayUrl(){
    const host = location.hostname;
    if((location.protocol === 'http:' || location.protocol === 'https:') && host){
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return proto + '//' + host + ':8787';
    }
    return 'ws://127.0.0.1:8787';
  }
  const RELAY_URL = localStorage.getItem('GG_RELAY_URL') || defaultRelayUrl();

  let ws = null;
  let _connected = false;
  let _matched = false;
  let _peerName = 'Relay';
  let _ping = 80;
  let _pingTimer = null;
  let _matchStarted = false;

  const core = window.NET_CORE;
  const original = {
    isOpen: core?.isOpen?.bind(core),
    send: core?.send?.bind(core),
    sendFast: core?.sendFast?.bind(core),
    getPing: core?.getPing?.bind(core),
    getPeerName: core?.getPeerName?.bind(core),
  };

  function active(){ return !!(_connected && _matched && ws && ws.readyState === WebSocket.OPEN); }
  function getPeerName(){ return active() ? _peerName : (original.getPeerName ? original.getPeerName() : _peerName); }
  function getPing(){ return active() ? _ping : (original.getPing ? original.getPing() : _ping); }
  function isOpen(){ return active() || !!(original.isOpen && original.isOpen()); }

  function pack(data, fast){
    return JSON.stringify({ type:'data', fast:!!fast, data });
  }

  function sendRelay(data, fast){
    if(active()){
      try{ ws.send(pack(data, fast)); }catch(_err){}
      return;
    }
    if(fast && original.sendFast) original.sendFast(data);
    else if(original.send) original.send(data);
  }

  function send(msg){ sendRelay(msg, false); }
  function sendFast(msg){ sendRelay(msg, true); }

  function stopPing(){
    if(_pingTimer){ clearInterval(_pingTimer); _pingTimer = null; }
  }

  function startPing(){
    stopPing();
    _pingTimer = setInterval(() => {
      if(!ws || ws.readyState !== WebSocket.OPEN) return;
      try{ ws.send(JSON.stringify({ type:'ping', t:Date.now() })); }catch(_err){}
    }, 2000);
  }

  function applyData(data){
    if(!data) return;
    if(data.t === 's' || data.type === 'state'){ NET_SYNC.onState(data); return; }
    if(data.type === 'ping'){ send({ type:'pong', t:data.t }); return; }
    if(data.type === 'pong'){ _ping = Math.round((Date.now() - data.t) / 2); NET_SYNC.onPingUpdate(_ping); return; }
    if(data.type === 'chat') NET_CHAT.onMessage(data);
    if(data.type === 'startGame'){
      if(data.name) NET_SYNC.setPeerName(data.name);
      if(data.skinUrl && typeof D !== 'undefined'){ D._skinUrl = data.skinUrl; D._skinImg = loadSpriteImage(data.skinUrl); }
      if(data.weaponUrl && typeof D !== 'undefined'){ D._weaponUrl = data.weaponUrl; D._weaponImg = loadSpriteImage(data.weaponUrl); }
      NET_SYNC.startGame(false);
    }
    if(data.type === 'readyGame') NET_SYNC.onReadyGame(data);
    if(data.type === 'hit') NET_SYNC.onHit(data);
    if(data.type === 'flailHit') NET_SYNC.onFlailHit(data);
    if(data.type === 'projectileContact') NET_SYNC.onProjectileContact(data);
    if(data.type === 'flailCancel') NET_SYNC.onFlailCancel(data);
    if(data.type === 'slowmo') NET_SYNC.onSlowmo(data);
    if(data.type === 'pvp_reset') NET_SYNC.onPvpReset(data);
    if(data.type === 'freeze' && typeof DEATH !== 'undefined') DEATH.fadeIn = true;
    if(data.type === 'champion' && typeof window._onChampionMsg === 'function') window._onChampionMsg(data.name);
    if(data.type === 'disconnect') disconnect(false);
  }

  function onMatched(msg){
    _matched = true;
    _peerName = msg.peerName || 'Relay';
    NET_CHAT.log('Relay match: ' + _peerName);
    NET_CHAT.onConnected(_peerName);
    NET_SYNC.onConnected();
    if(!_matchStarted && msg.role === 'host'){
      _matchStarted = true;
      setTimeout(() => {
        if(active()) NET_SYNC.startGame(true);
      }, 300);
    }
  }

  function connectAuto(){
    disconnect(false);
    _connected = false;
    _matched = false;
    _matchStarted = false;
    _peerName = 'Relay';

    NET_CHAT.log('Relay auto-search: ' + RELAY_URL);
    try{
      ws = new WebSocket(RELAY_URL);
    }catch(err){
      NET_CHAT.log('Relay error: ' + err.message);
      return;
    }

    ws.onopen = () => {
      _connected = true;
      startPing();
      ws.send(JSON.stringify({
        type:'findMatch',
        game:'godgrave',
        version: window.GAME_VERSION || 'dev',
        id: PROFILE.id,
        name: PROFILE.name || 'Player',
      }));
      NET_CHAT.log('Relay searching...');
    };

    ws.onmessage = ev => {
      let msg = null;
      try{ msg = JSON.parse(ev.data); }catch(_err){ return; }
      if(msg.type === 'pong' && Number.isFinite(msg.t)){
        _ping = Math.round((Date.now() - msg.t) / 2);
        if(typeof NET_SYNC !== 'undefined') NET_SYNC.onPingUpdate(_ping);
        return;
      }
      if(msg.type === 'waiting'){ NET_CHAT.log('Relay waiting for player...'); return; }
      if(msg.type === 'matched'){ onMatched(msg); return; }
      if(msg.type === 'data'){ applyData(msg.data); return; }
      if(msg.type === 'peerLeft'){ disconnect(false); return; }
      if(msg.type === 'error') NET_CHAT.log('Relay error: ' + msg.message);
    };

    ws.onclose = () => {
      stopPing();
      const wasMatched = _matched;
      _connected = false;
      _matched = false;
      ws = null;
      if(wasMatched){
        NET_CHAT.log('Relay disconnected');
        NET_SYNC.onDisconnected();
        NET_CHAT.onDisconnected();
      } else {
        NET_CHAT.log('Relay unavailable');
      }
    };

    ws.onerror = () => NET_CHAT.log('Relay socket error');
  }

  function disconnect(notify){
    stopPing();
    if(active() && notify !== false) send({ type:'disconnect' });
    if(ws){
      try{ ws.close(); }catch(_err){}
    }
    ws = null;
    _connected = false;
    _matched = false;
  }

  if(core){
    core.isOpen = isOpen;
    core.send = send;
    core.sendFast = sendFast;
    core.getPing = getPing;
    core.getPeerName = getPeerName;
  }

  if(typeof $ !== 'undefined'){
    $.NET = $.NET || {};
    $.NET.send = send;
    $.NET.sendFast = sendFast;
    $.NET.active = () => isOpen();
  }

  const prevShowNetScreen = window.showNetScreen;
  function showRelayLobby(){
    document.querySelectorAll('.net-screen').forEach(s => s.style.display = 'none');
    const screen = document.getElementById('net-screen-lobby');
    if(screen) screen.style.display = '';
    const status = document.getElementById('lobby-status');
    if(status) status.textContent = 'Relay auto-search...';
    const list = document.getElementById('lobby-list');
    if(list) list.innerHTML = '';
  }
  window.showNetScreen = function(id){
    if(id === 'net-screen-lobby'){
      showRelayLobby();
      connectAuto();
      return;
    }
    return prevShowNetScreen ? prevShowNetScreen(id) : undefined;
  };

  const prevStopLobby = window.stopLobby;
  window.stopLobby = function(){
    disconnect(false);
    if(prevStopLobby) prevStopLobby();
  };

  document.getElementById('mob-quickmatch-btn')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const mobOv = document.getElementById('mob-menu-overlay');
    if(mobOv) mobOv.classList.remove('open');
    if(typeof gamePaused !== 'undefined') gamePaused = false;
    openMenu('net-overlay');
    window.showNetScreen('net-screen-lobby');
  }, true);

  return { connectAuto, disconnect, send, sendFast, isOpen, getPing, getPeerName, get url(){ return RELAY_URL; } };
})();



