// === src/network/net-lobby.js ===

(function(){
  const SLOT_MS = 30 * 60 * 1000;

  function lobbyText(key, fallback, vars){
    return window.I18N ? window.I18N.t(key, vars) : fallback;
  }

  function getHubId(){
    return 'GG_HUB_' + Math.floor(Date.now() / SLOT_MS);
  }

  let _hubPeer = null;
  let _clientConn = null;
  let _players = {};
  let _timer = null;
  let _isHub = false;
  let _autoPlayTimer = null;
  let _autoConnecting = false;
  let _autoPlay = false;

  function status(txt, col){
    const el = document.getElementById('lobby-status');
    if(el){
      el.textContent = txt;
      el.style.color = col || '#2a7a9a';
    }
  }

  function myPresence(){
    return {
      type: 'lobby',
      id: PROFILE.id,
      name: PROFILE.name || lobbyText('lobby.player.default', 'Player')
    };
  }

  function render(){
    const list = document.getElementById('lobby-list');
    if(!list) return;

    const now = Date.now();
    Object.keys(_players).forEach(id => {
      if(now - _players[id].ts > 20000) delete _players[id];
    });

    const entries = Object.entries(_players).filter(([id]) => id !== PROFILE.id);
    if(!entries.length){
      list.innerHTML = `<div style="color:#1a4a5a;font-size:11px;padding:8px 0;">${escHtml(lobbyText('lobby.status.waiting', 'No one yet. Waiting...'))}</div>`;
      return;
    }

    list.innerHTML = entries.map(([id, player]) => `
      <div class="friend-item" style="justify-content:space-between;margin-bottom:6px;">
        <span class="fname">${escHtml(player.name)}</span>
        <span style="font-size:9px;color:#1a5a3a;">${escHtml(id)}</span>
        <button class="ov-btn accent" style="min-height:40px;flex:0 0 auto;" data-lobby-id="${escHtml(id)}" data-lobby-name="${escHtml(player.name)}">${escHtml(lobbyText('lobby.status.join', 'Join'))}</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-lobby-id]').forEach(btn => {
      btn.addEventListener('click', () => window.lobbyConnect(btn.dataset.lobbyId, btn.dataset.lobbyName));
    });

    if(entries.length > 0 && !$.NET.active() && !NET_CORE.isOpen() && !_autoConnecting){
      _autoConnecting = true;
      const [firstId, firstPlayer] = entries[0];
      status(lobbyText('lobby.status.found', `Found ${firstPlayer.name} - connecting...`, { name: firstPlayer.name }), '#4acc80');
      setTimeout(() => { lobbyConnect(firstId, firstPlayer.name); }, 800);
    }
  }

  window.lobbyConnect = function(id, name){
    stopLobby();
    _autoPlay = true;
    document.querySelectorAll('.game-overlay.open').forEach(el => el.classList.remove('open'));
    document.body.classList.remove('menu-open');
    if(typeof gamePaused !== 'undefined') gamePaused = false;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:monospace;color:#4acc80;font-size:14px;letter-spacing:2px;';
    overlay.textContent = lobbyText('lobby.status.connecting', `CONNECTING TO ${name.toUpperCase()}...`, { name: name.toUpperCase() });
    overlay.id = '_lobby_overlay';
    document.body.appendChild(overlay);

    NET_CORE.connect(id, name);
    _autoPlayTimer = setTimeout(() => {
      const ov = document.getElementById('_lobby_overlay');
      if(ov) ov.remove();
      _autoPlay = false;
      if($.NET.active()) return;
      NET_SYNC.startGame(true);
    }, 1500);
  };

  function attachHubHandlers(){
    _hubPeer.on('connection', conn => {
      conn.on('open', () => { conn.send(myPresence()); });
      conn.on('data', data => {
        try{
          const msg = typeof data === 'string' ? JSON.parse(data) : data;
          if(!msg || msg.type !== 'lobby' || typeof msg.id !== 'string' || typeof msg.name !== 'string') return;
          _players[msg.id] = { name: msg.name.slice(0, 32), ts: Date.now() };
          Object.values(_hubPeer.connections || {}).forEach(arr =>
            arr.forEach(peerConn => { if(peerConn !== conn && peerConn.open) try{ peerConn.send(msg); }catch(_err){} })
          );
          render();
        }catch(_err){}
      });
      conn.on('error', () => {});
    });
  }

  function joinHub(){
    _isHub = false;
    const hubId = getHubId();
    const conn = window._mainPeer.connect(hubId, { label:'lobby', reliable:true, serialization:'json' });
    _clientConn = conn;
    let hubOpened = false;

    const hubTimeout = setTimeout(() => {
      if(hubOpened) return;
      status(lobbyText('lobby.status.hubNotResponding', 'Hub not responding (maybe on another server)'), '#cc5050');
      try{ conn.close(); }catch(_err){}
      _clientConn = null;
    }, 10000);

    conn.on('open', () => {
      hubOpened = true;
      clearTimeout(hubTimeout);
      status(lobbyText('lobby.status.connected', 'In lobby!'), '#4acc80');
      conn.send(myPresence());
      _players[PROFILE.id] = { name: PROFILE.name || lobbyText('lobby.player.default', 'Player'), ts: Date.now() };
      render();
    });

    conn.on('data', data => {
      try{
        const msg = typeof data === 'string' ? JSON.parse(data) : data;
        if(msg && msg.type === 'lobby' && typeof msg.id === 'string' && typeof msg.name === 'string'){
          _players[msg.id] = { name: msg.name.slice(0, 32), ts: Date.now() };
          render();
        }
      }catch(_err){}
    });

    conn.on('close', () => {
      clearTimeout(hubTimeout);
      status(lobbyText('lobby.status.disconnected', 'Disconnected from lobby'), '#cc5050');
    });

    conn.on('error', err => {
      clearTimeout(hubTimeout);
      status(lobbyText('lobby.status.error', `Lobby error: ${err.type}`, { error: err.type }), '#cc5050');
      _clientConn = null;
    });
  }

  window.startLobby = function(){
    stopLobby();
    _players = {};
    _isHub = false;

    if(!window._mainPeer?.open){
      status(lobbyText('lobby.status.serverFirst', 'Connect to server first'), '#cc5050');
      return;
    }
    status(lobbyText('lobby.status.connectingHub', 'Connecting...'), '#ccaa30');

    const hubId = getHubId();
    const server = NET_CORE.getCurrentServer();
    _hubPeer = NET_CORE.makePeer(hubId, server);

    _hubPeer.on('open', () => {
      status(lobbyText('lobby.status.host', 'You are host. Waiting for players...'), '#4acc80');
      _isHub = true;
      _players[PROFILE.id] = { name: PROFILE.name || lobbyText('lobby.player.default', 'Player'), ts: Date.now() };
      render();
      attachHubHandlers();
    });

    _hubPeer.on('error', err => {
      if(err.type === 'unavailable-id'){
        try{ _hubPeer.destroy(); }catch(_destroyErr){}
        _hubPeer = null;
        status(lobbyText('lobby.status.hostFound', 'Host found, connecting...'), '#ccaa30');
        joinHub();
      } else {
        status('⚠ ' + err.type, '#cc5050');
        try{ _hubPeer?.destroy(); }catch(_destroyErr){}
        _hubPeer = null;
      }
    });

    _timer = setInterval(() => {
      render();
      _players[PROFILE.id] = { name: PROFILE.name || lobbyText('lobby.player.default', 'Player'), ts: Date.now() };
      if(_clientConn?.open) _clientConn.send(myPresence());
    }, 4000);
  };

  window.stopLobby = function(){
    _autoConnecting = false;
    if(_timer){
      clearInterval(_timer);
      _timer = null;
    }
    try{ _hubPeer?.destroy(); }catch(_err){}
    try{ _clientConn?.close(); }catch(_err){}
    _hubPeer = null;
    _clientConn = null;
    _players = {};
    _isHub = false;
  };

  const _origShowNetScreen = window.showNetScreen;
  window.showNetScreen = function(id){
    if(id === 'net-screen-lobby') startLobby();
    else if(_timer) stopLobby();
    _origShowNetScreen(id);
  };
})();
