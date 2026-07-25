// === src/network/net-core.js ===

var NET_CORE = (function(){
  var peer=null, conn=null, fastConn=null, peerName='?';
  var _ping=50, _pingTimer=null;

  // ── Ping measurement ──
  function startPing(){
    if(_pingTimer) clearInterval(_pingTimer);
    _pingTimer=setInterval(()=>{
      if(conn&&conn.open) try{ conn.send({type:'ping',t:Date.now()}); }catch(e){}
    },2000);
  }
  function stopPing(){
    if(_pingTimer){ clearInterval(_pingTimer); _pingTimer=null; }
    _ping=50;
  }
  function getPing(){ return _ping; }

  // ── Signaling server list (cycled through when unavailable) ──────────────
  // server: null = default public PeerJS server (cloud.peerjs.com)
  // To add your own server (Glitch/Render/Railway) — add its host here
  const SIGNAL_SERVERS = [
    { host:'godgraveassets.onrender.com', port:443, secure:true, path:'/', label:'Main' },
    { host:'0.peerjs.com', port:443, secure:true, path:'/', label:'Backup' },
  ];
  var _serverIdx=-1; // -1 = not yet selected
  var _connecting=false;
  const CONNECT_TIMEOUT_COLD=50000; // for "cold" server startup

  // ── Common ICE config (STUN+TURN) ──────────────────────────────────────────
  // Previously duplicated in 3 places (init/becomeHub/startLobby), and lobby
  // peers lacked TURN entirely — behind symmetric NAT/strict firewall, lobby
  // discovery might fail, while normal "connect by ID" worked.
  // Now all Peer() instances are created through a single helper with identical config.
  const ICE_CONFIG={iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'turn:openrelay.metered.ca:80',  username:'openrelayproject', credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443', username:'openrelayproject', credential:'openrelayproject'},
  ]};
  function makePeer(id, srv){
    return new Peer(id, {
      host:srv.host, port:srv.port, secure:srv.secure, path:srv.path,
      config:ICE_CONFIG,
    });
  }

  // Explicit server selection by user — without automatic cycling
  window.chooseServer=function(idx){
    if(_connecting) return; // connection attempt already in progress
    _serverIdx=idx;
    if(peer){ try{peer.destroy();}catch(e){} peer=null; }
    init();
  };

  function setServerButtonsState(connecting){
    const b0=document.getElementById('net-srv-main');
    const b1=document.getElementById('net-srv-alt');
    [b0,b1].forEach(b=>{ if(b) b.disabled=connecting; });
  }

  function init(){
    if(_serverIdx<0){
      NET_CHAT.log('👆 Select server above (Main/Backup)');
      return;
    }
    const srv = SIGNAL_SERVERS[_serverIdx];
    _connecting=true;
    setServerButtonsState(true);
    NET_CHAT.log('⏳ Connecting to '+srv.label+' ('+srv.host+')...');

    peer=makePeer(PROFILE.id, srv);

    let _opened=false;
    const failTimer=setTimeout(()=>{
      if(_opened) return;
      NET_CHAT.log('⏱ '+srv.label+' not responding. Try another server.');
      try{ peer.destroy(); }catch(e){}
      peer=null; _connecting=false; setServerButtonsState(false);
    }, CONNECT_TIMEOUT_COLD);

    peer.on('open',id=>{
      _opened=true; _connecting=false; clearTimeout(failTimer);
      _reconnectAttempts=0; // reset backoff after successful (re)connection
      setServerButtonsState(false);
      window._mainPeer=peer;
      PROFILE.setId(id);
      const idEl=document.getElementById('net-myid');
      if(idEl) idEl.textContent=id;
      NET_CHAT.log('✅ Online ('+srv.label+') · ID: '+id);
      $.S.play('uiNote');
      // Highlight the active button
      document.getElementById('net-srv-main')?.classList.toggle('accent', _serverIdx===0);
      document.getElementById('net-srv-alt')?.classList.toggle('accent', _serverIdx===1);
    });
    peer.on('connection',c=>{
      if(c.label==='fast'){ setupFastConn(c); return; }
      peerName=c.metadata?.name||c.peer;
      NET_CHAT.log('📞 Incoming from '+peerName);
      setupConn(c);
    });
    peer.on('error',e=>{
      NET_CHAT.log('⚠ '+e.type);
      if(e.type==='unavailable-id'){
        clearTimeout(failTimer);
        PROFILE.setId(PROFILE.id.slice(0,3)+(Math.floor(Math.random()*90000)+10000));
        peer.destroy(); setTimeout(init,400);
      } else if(e.type==='peer-unavailable'){
        NET_CHAT.log('❌ Peer not found');
      } else if(e.type==='network'||e.type==='server-error'){
        if(!_opened){
          clearTimeout(failTimer);
          NET_CHAT.log('❌ '+srv.label+' unavailable. Try another server.');
          try{ peer.destroy(); }catch(err){}
          peer=null; _connecting=false; setServerButtonsState(false);
        } else {
          scheduleReconnect();
        }
      }
    });
    peer.on('disconnected',()=>{
      NET_CHAT.log('↩ Server reconnecting...');
      scheduleReconnect();
    });
  }

  // ── Reconnect backoff for signaling server ──────────────────────────────
  // Previously reconnect() was called at fixed 1-2s intervals with no limit —
  // during prolonged server downtime this would endlessly hammer it with requests.
  // Now the interval grows exponentially (1s→2s→4s...→30s) and there's a
  // attempt cap, after which we ask the user to select a server manually.
  var _reconnectAttempts=0, _reconnectTimer=null;
  const RECONNECT_MAX_ATTEMPTS=8;
  function scheduleReconnect(){
    if(_reconnectTimer) return; // already scheduled
    if(_reconnectAttempts>=RECONNECT_MAX_ATTEMPTS){
      NET_CHAT.log('❌ Reconnect failed. Select a server again.');
      return;
    }
    const delay=Math.min(30000, 1000*Math.pow(2,_reconnectAttempts));
    _reconnectAttempts++;
    _reconnectTimer=setTimeout(()=>{
      _reconnectTimer=null;
      try{ peer?.reconnect(); }catch(e){}
    }, delay);
  }

  function connect(id, name){
    if(!peer?.open){ NET_CHAT.log('⚠ Server not ready'); return; }
    // Close previous connections if still open —
    // otherwise repeated connect() (e.g., lobby auto-connect race)
    // would leave old DataConnection hanging with active handlers.
    if(conn){ try{conn.close();}catch(e){} conn=null; }
    if(fastConn){ try{fastConn.close();}catch(e){} fastConn=null; }
    stopPing();
    NET_CHAT.log('🔗 Connecting to '+id+'...');
    // Reliable channel — chat, events, commands
    const c=peer.connect(id,{
      label:'reliable',
      metadata:{name:PROFILE.name||'Player'},
      reliable:true, serialization:'json',
    });
    peerName=name||id;
    setupConn(c);
    // Fast channel — positions (unreliable, minimal latency)
    const f=peer.connect(id,{
      label:'fast',
      metadata:{name:PROFILE.name||'Player'},
      reliable:false, serialization:'json',
    });
    setupFastConn(f);
  }

  function setupFastConn(c){
    fastConn=c;
    c.on('open', ()=>{ NET_CHAT.log('⚡ Fast channel open'); });
    c.on('data',d=>{
      try{
        const msg=typeof d==='string'?JSON.parse(d):d;
        // Fast channel uses msg.t='s' (delta state)
        if(msg.t==='s') NET_SYNC.onState(msg);
        // Fallback: legacy format
        if(msg.type==='state') NET_SYNC.onState(msg);
      }catch(e){}
    });
    c.on('error',()=>{});
  }

  function setupConn(c){
    conn=c; peerName=c.metadata?.name||c.peer;
    NET_CHAT.log('⏳ Connecting to '+peerName+'...');
    c.on('open',()=>{
      NET_CHAT.log('🟢 Connected to '+peerName);
      NET_CHAT.onConnected(peerName);
      NET_SYNC.onConnected();
      startPing();
    });
    c.on('data',d=>{
      try{
        const msg=typeof d==='string'?JSON.parse(d):d;
        if(msg.type==='ping'){ try{conn.send({type:'pong',t:msg.t});}catch(e){} return; }
        if(msg.type==='pong'){ _ping=Math.round((Date.now()-msg.t)/2); NET_SYNC.onPingUpdate(_ping); return; }
        if(msg.type==='chat')      NET_CHAT.onMessage(msg);
        // state comes through fastConn (msg.t='s'), not handled here
        if(msg.type==='startGame'){
          if(msg.name) NET_SYNC.setPeerName(msg.name);
          // Apply initiator's skin to D
          if(msg.skinUrl)   { if(typeof D!=='undefined'){ D._skinUrl=msg.skinUrl;   D._skinImg=loadSpriteImage(msg.skinUrl); } }
          if(msg.weaponUrl) { if(typeof D!=='undefined'){ D._weaponUrl=msg.weaponUrl; D._weaponImg=loadSpriteImage(msg.weaponUrl); } }
          NET_SYNC.startGame(false);
        }
        if(msg.type==='readyGame') NET_SYNC.onReadyGame(msg);
        if(msg.type==='hit')       NET_SYNC.onHit(msg);
        if(msg.type==='pvp_reset') NET_SYNC.onPvpReset(msg);
        if(msg.type==='freeze'){ if(typeof DEATH!=='undefined'){DEATH.fadeIn=true;} }
        if(msg.type==='champion'){ if(typeof window._onChampionMsg==='function') window._onChampionMsg(msg.name); }
        if(msg.type==='disconnect'){ NET_SYNC.onDisconnected(); NET_CHAT.onDisconnected(); }
      }catch(e){}
    });
    c.on('close',()=>{
      NET_CHAT.log('🔴 Disconnected');
      NET_CHAT.onDisconnected();
      NET_SYNC.onDisconnected();
      stopPing();
      conn=null; fastConn=null;
    });
    c.on('error',e=>NET_CHAT.log('⚠ '+e.type));
  }

  // Reliable send (chat, hits, commands)
  function send(msg){
    if(conn&&conn.open) try{ conn.send(msg); }catch(e){}
  }
  // Fast send positions (unreliable channel, fallback to reliable)
  function sendFast(msg){
    const ch=(fastConn&&fastConn.open)?fastConn:conn;
    if(ch&&ch.open) try{ ch.send(msg); }catch(e){}
  }

  return { init, connect, send, sendFast, getPeerName:()=>peerName, isOpen:()=>conn?.open, getPing,
    getPeer:()=>peer, // for lobby
    makePeer, // for lobby — single point for creating Peer with ICE config
    getCurrentServer:()=>SIGNAL_SERVERS[_serverIdx>=0?_serverIdx:0] };
})();

// ════════════════════════════════════════════════════════════════════════════
// ══ BLOCK 7: CHAT ══════════════════════════════════════════════════════════
// Chat UI, connection log, Play/Disconnect buttons
// ════════════════════════════════════════════════════════════════════════════
var NET_CHAT = (function(){
  var _chatEl=null, _logEl=null;

  function getChat(){ return _chatEl||(_chatEl=document.getElementById('net-chat-msgs')); }
  function getLog() { return _logEl||(_logEl=document.getElementById('net-log')); }

  function log(text){
    const el=getLog(); if(!el) return;
    const t=new Date().toTimeString().slice(0,5);
    const d=document.createElement('div');
    d.textContent=t+' '+text;
    d.style.cssText='font-size:10px;color:#2a6a7a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    while(el.children.length>=3) el.removeChild(el.firstChild);
    el.appendChild(d);
    Array.from(el.children).forEach((x,i,a)=>x.style.opacity=i===a.length-1?'1':'0.4');
  }

  function addMsg(who, text, name){
    const area=getChat(); if(!area) return;
    const d=document.createElement('div');
    d.className='net-msg '+(who==='me'?'me':who==='sys'?'sys':'them');
    if(who==='sys'){
      d.textContent='— '+text+' —';
    } else {
      const sp=document.createElement('span');
      sp.className='net-who';
      sp.textContent=who==='me'?(PROFILE.name||(window.I18N?window.I18N.t('net.chat.me'):'Me')):(name||NET_CORE.getPeerName());
      d.appendChild(sp);
      d.appendChild(document.createTextNode(text));
    }
    area.appendChild(d);
    area.scrollTop=area.scrollHeight;
  }

  function sendChat(){
    const inp=document.getElementById('net-chat-input');
    const text=(inp?.value||'').trim();
    if(!text||!NET_CORE.isOpen()) return;
    $.NET.send({type:'chat', text, name:PROFILE.name||'?'});
    addMsg('me', text);
    if(inp) inp.value='';
  }

  function onConnected(name){
    const peerEl=document.getElementById('net-chat-peer');
    if(peerEl) peerEl.textContent=name;
    addMsg('sys','Connected to '+name);
    // In auto-mode (quick search) — don't open chat
    if(typeof _autoPlay!=='undefined' && _autoPlay) return;
    openMenu('net-overlay');
    showNetScreen('net-screen-chat');
  }

  function onDisconnected(){
    addMsg('sys','Connection lost');
    // Hide chat, show main menu
    const chatPanel=document.getElementById('net-chat-panel');
    if(chatPanel) chatPanel.style.display='none';
    showNetScreen('net-screen-main');
  }

  function onMessage(msg){ addMsg('them', msg.text, msg.name); }

  // Buttons
  document.getElementById('net-chat-send')?.addEventListener('click', sendChat);
  document.getElementById('net-chat-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); sendChat(); }
  });
  document.getElementById('net-chat-disconnect')?.addEventListener('click',()=>{
    $.NET.send({type:'disconnect'});
    onDisconnected();
  });
  document.getElementById('net-chat-play')?.addEventListener('click',()=>{
    // Start game locally and notify peer
    NET_SYNC.startGame(true); // true = we are the initiator (send startGame to peer)
  });

  return { log, addMsg, onConnected, onDisconnected, onMessage };
})();
