// === src/network/net-sync.js ===

var NET_SYNC = (function(){
  var _active=false, _peerName='';
  var _cur={x:0,y:0,angle:0,vx:0,vy:0,hp:100,stamina:100,rage:0,vel:0,bx:0,by:0,pvX:0,pvY:-8};
  var _acceptAnyHp=false; // принимать HP в любую сторону после ресета

  // ── Буфер интерполяции (80ms задержка для плавности) ──
  var _buf=[], _bufDelay=80;

  function bufferPush(s){
    _buf.push({t:Date.now(), s:Object.assign({},s)});
    if(_buf.length>12) _buf.shift();
    // Адаптивная задержка: 1.5x пинг даёт запас для jitter
    const ping=NET_CORE.getPing();
    _bufDelay = Math.max(40, Math.min(150, ping*1.5));
  }

  function angDiffSafe(a,b){
    let d=(a-b)%(Math.PI*2);
    if(d> Math.PI) d-=Math.PI*2;
    if(d<-Math.PI) d+=Math.PI*2;
    return d;
  }

  function bufferTick(){
    if(!_buf.length) return null;
    const renderTime=Date.now()-_bufDelay;
    if(_buf[0].t>renderTime) return _buf[0].s;
    let a=null,b=null;
    for(let i=0;i<_buf.length;i++){
      if(_buf[i].t<=renderTime) a=_buf[i];
      else { b=_buf[i]; break; }
    }
    if(!b) return a.s;
    const frac=Math.min(1,(renderTime-a.t)/(b.t-a.t+1));
    const aA=a.s.angle??0, bA=b.s.angle??0;
    let ad=bA-aA; while(ad>Math.PI) ad-=Math.PI*2; while(ad<-Math.PI) ad+=Math.PI*2;
    return {
      x:     a.s.x+(b.s.x-a.s.x)*frac,
      y:     a.s.y+(b.s.y-a.s.y)*frac,
      angle: aA+ad*frac,
      vx:b.s.vx, vy:b.s.vy, vel:b.s.vel,
      hp:b.s.hp, stamina:b.s.stamina, rage:b.s.rage,
    };
  }

  // ── Квантование координат ──
  var _lastSent={nx:-9,ny:-9,vx:-9,vy:-9,angle:-9,vel:-9,hp:-9,stamina:-9,rage:-9};
  const DELTA_POS=2, DELTA_VEL=1, DELTA_ANG=0.02;

  function qEnc(v,max){ return Math.round(v/max*65535); }
  function qDec(v,max){ return v/65535*max; }
  function qaEnc(a){ return Math.round(((a%(Math.PI*2))+(Math.PI*2))%(Math.PI*2)/(Math.PI*2)*65535); }
  function qaDec(v){ return v/65535*Math.PI*2; }

  function buildDelta(p){
    const nx=qEnc(p.x,W), ny=qEnc(p.y,H);
    const vx=qEnc((p.vx||0)+W,W*2), vy=qEnc((p.vy||0)+H,H*2);
    const angle=qaEnc(p.angle||0);
    const vel=Math.round((p.vel||0)*100);
    const hp=Math.round(p.hp||0), stamina=Math.round(p.stamina||0), rage=Math.round(p.rage||0);
    const pvx=Math.round((p.pvX||0)*10+512), pvy=Math.round((p.pvY||0)*10+512);
    const bbx=Math.round((p.bx||0)*10+512),  bby=Math.round((p.by||0)*10+512);

    const d={t:'s'};
    if(Math.abs(nx-_lastSent.nx)>DELTA_POS||Math.abs(ny-_lastSent.ny)>DELTA_POS){
      d.x=nx; d.y=ny; _lastSent.nx=nx; _lastSent.ny=ny;
    }
    if(Math.abs(vx-_lastSent.vx)>DELTA_VEL||Math.abs(vy-_lastSent.vy)>DELTA_VEL){
      d.u=vx; d.v=vy; _lastSent.vx=vx; _lastSent.vy=vy;
    }
    if(Math.abs(angle-_lastSent.angle)>DELTA_ANG){
      d.a=angle; _lastSent.angle=angle;
    }
    if(vel!==_lastSent.vel){ d.l=vel; _lastSent.vel=vel; }
    if(hp!==_lastSent.hp){ d.h=hp; _lastSent.hp=hp; }
    if(stamina!==_lastSent.stamina){ d.s=stamina; _lastSent.stamina=stamina; }
    if(rage!==_lastSent.rage){ d.r=rage; _lastSent.rage=rage; }
    // Меч и тело — всегда
    d.px=pvx; d.py=pvy; d.bx=bbx; d.by=bby;
    d.a=angle; _lastSent.angle=angle; // угол всегда
    // Баффы/дебаффы — для отображения на HUD противника
    d.sh=p.shield||0;                        // тип щита
    d.shf=p._shieldFlipped?1:0;              // флип щита
    d.ex=Math.round((p.exhausted||0)*10);   // усталость
    d.ub=Math.round((p.unbalanced||0)*10);  // дисбаланс
    d.rb=p.rageBuffEnd>GameTime?Math.round((p.rageBuffEnd-GameTime)*10):0; // ярость
    d.wt=p.weaponType||0;                    // вид оружия (индекс в WEAPON_TYPES)
    d.hw=p.hasWeapon===false?0:1;            // вооружён ли (0 = обезоружен)
    return d;
  }

  // ── Адаптивная частота отправки ──
  var _sendTimer=null, _rateTimer=null;
  function getSendInterval(){ const p=NET_CORE.getPing(); return p<80?33:p<150?50:80; }
  var _curSendInterval=0;
  function startSendTimer(force){
    const wanted=getSendInterval();
    // Не пересоздаём interval, если частота не изменилась — раньше он
    // рестартовался на каждый pong (~раз в 2с) и на каждый rate-adapt тик
    // (раз в 5с), даже когда wanted тот же самый, что давало лишний джиттер
    // отправки без всякой пользы.
    if(!force && _sendTimer && wanted===_curSendInterval) return;
    if(_sendTimer) clearInterval(_sendTimer);
    _curSendInterval=wanted;
    _sendTimer=setInterval(()=>{
      if(!_active||!NET_CORE.isOpen()||typeof P==='undefined') return;
      const d=buildDelta(P);
      if(Object.keys(d).length>1) $.NET.sendFast(d);
    }, wanted);
  }
  function stopSendTimer(){ if(_sendTimer){clearInterval(_sendTimer);_sendTimer=null;_curSendInterval=0;} }
  function startRateAdapt(){
    if(_rateTimer) clearInterval(_rateTimer);
    _rateTimer=setInterval(()=>{ if(_active) startSendTimer(); },5000);
  }
  function stopRateAdapt(){ if(_rateTimer){clearInterval(_rateTimer);_rateTimer=null;} }

  // ── Пинг-дисплей ──
  function updatePingDisplay(ms){
    const el=document.getElementById('pvp-ping'); if(!el) return;
    el.textContent=ms+'ms';
    el.style.color=ms<80?'#4acc80':ms<160?'#ccaa20':'#cc4040';
  }
  function onPingUpdate(ms){ updatePingDisplay(ms); if(_active) startSendTimer(); }

  // ── PVP HUD ──
  function showPVPHud(on){
    const hud=document.getElementById('pvp-hud'); if(!hud) return;
    hud.style.display=on?'flex':'none';
    if(on){
      const el=document.getElementById('pvp-peer-name');
      if(el) el.textContent=_peerName||NET_CORE.getPeerName();
      updatePingDisplay(NET_CORE.getPing());
    }
  }

  // ── Активация манекена ──
  function activateDummy(){
    if(typeof dummyOn!=='undefined'&&!dummyOn&&typeof toggleAI==='function') toggleAI();
    if(typeof AI!=='undefined') AI.enabled=false;
    if(typeof D!=='undefined'){
      D.hp=100; D.stamina=100; D.rage=0;
      _cur={x:D.x,y:D.y,angle:D.angle||0,vx:0,vy:0,hp:100,stamina:100,rage:0,vel:0,bx:D.bx||0,by:D.by||0,pvX:D.pvX||0,pvY:D.pvY||-8};
      _buf=[]; _cur.bx=0; _cur.by=0; _cur.pvX=0; _cur.pvY=-8; _lastSent={nx:-9,ny:-9,vx:-9,vy:-9,angle:-9,vel:-9,hp:-9,stamina:-9,rage:-9};
      _acceptAnyHp=true;
    }
  }

  // ── Включение/выключение PVP ──
  function setNetPVP(on, peerNameOverride, isSender){
    const dtoggle=document.getElementById('dtoggle');
    const mobSpawn=document.getElementById('mob-spawn-btn');
    if(on){
      if(peerNameOverride) _peerName=peerNameOverride;
      activateDummy();
      if(dtoggle)  dtoggle.style.display='none';
      if(mobSpawn) mobSpawn.style.display='none';
      document.querySelectorAll('#hud-bot span').forEach(el=>{
        if(el.textContent.trim()==='БОТ') el.textContent=_peerName||'ИГРОК';
      });
      const bPhase=document.getElementById('hud-b-phase');
      if(bPhase) bPhase.textContent='ПВП';
      if(isSender){
        if(typeof P!=='undefined'){ P.x=W*0.15; P.y=H*0.6; }
        if(typeof D!=='undefined'){ D.x=W*0.82; D.y=H*0.6; _cur.x=D.x; _cur.y=D.y; }
      } else {
        if(typeof P!=='undefined'){ P.x=W*0.82; P.y=H*0.6; }
        if(typeof D!=='undefined'){ D.x=W*0.15; D.y=H*0.6; _cur.x=D.x; _cur.y=D.y; }
      }
      showPVPHud(true);
      document.querySelectorAll('.game-overlay.open').forEach(el=>el.classList.remove('open'));
      const mobOv=document.getElementById('mob-menu-overlay');
      if(mobOv) mobOv.classList.remove('open');
      document.body.classList.remove('menu-open');
      gamePaused=false;
      NET_CHAT.log('🎮 ПВП: '+_peerName);
      startSendTimer(); startRateAdapt();
    } else {
      if(dtoggle)  dtoggle.style.display='';
      if(mobSpawn) mobSpawn.style.display='';
      if(typeof AI!=='undefined') AI.enabled=true;
      showPVPHud(false);
      stopSendTimer(); stopRateAdapt();
    }
    _active=on;
  }

  function onConnected(){}

  // ── Handshake ──
  var _pendingStart=false;
  function startGame(isSender){
    if(isSender){
      _pendingStart=true;
      $.NET.send({type:'startGame', name:PROFILE.name,
        skinUrl:P?._skinUrl||null, weaponUrl:P?._weaponUrl||null,
        shield:P?.shield||0, shieldFlipped:P?._shieldFlipped?1:0});
      NET_CHAT.log('⏳ ждём...');
      setTimeout(()=>{
        if(_pendingStart && NET_CORE.isOpen()){ _pendingStart=false; setNetPVP(true,NET_CORE.getPeerName(),true); }
        else _pendingStart=false;
      },5000);
    } else {
      $.NET.send({type:'readyGame', skinUrl:P?._skinUrl||null, weaponUrl:P?._weaponUrl||null,
        shield:P?.shield||0, shieldFlipped:P?._shieldFlipped?1:0});
      setNetPVP(true,_peerName,false);
    }
  }
  function onReadyGame(msg){
    if(!_pendingStart) return;
    _pendingStart=false;
    if(msg?.skinUrl)   { D._skinUrl=msg.skinUrl;   D._skinImg=loadSpriteImage(msg.skinUrl); }
    if(msg?.weaponUrl) { D._weaponUrl=msg.weaponUrl; D._weaponImg=loadSpriteImage(msg.weaponUrl); }
    if(msg?.shield!=null) setShield(D, msg.shield);
    if(msg?.shieldFlipped!=null) D._shieldFlipped = !!msg.shieldFlipped;
    setNetPVP(true,NET_CORE.getPeerName(),true);
  }

  function disconnect(){
    $.NET.send({type:'disconnect'});
    setNetPVP(false);
    NET_CHAT.onDisconnected();
  }

  // sendReset: победитель отправляет команду с позициями обоих
  // iWon=true: я победил (D умер у меня) => на другой стороне умер P
  function sendReset(iWon){
    if(iWon && typeof addWin==='function') addWin(false); // PVP победа игрока
    _lastSent={nx:-9,ny:-9,vx:-9,vy:-9,angle:-9,vel:-9,hp:-9,stamina:-9,rage:-9};
    _acceptAnyHp=true;
    // Обновляем D локально у победителя немедленно
    if(typeof D!=='undefined'){
      D.hp=100; D.stamina=100; D.rage=0;
      D.exhausted=0; D.unbalanced=0;
      if(D.hasWeapon===false && typeof setWeapon==='function') setWeapon(D, D.weaponType);
      _cur.hp=100; _cur.stamina=100;
      _buf=[];
    }
    $.NET.send({
      type:'pvp_reset',
      iWon,
      myNx: Math.round(P.x/W*1000)/1000,
      myNy: Math.round(P.y/H*1000)/1000,
    });
  }
  // Совместимость
  function forceResync(){ sendReset(true); }

  // Получили ресет от противника
function onPvpReset(msg){
  if(!_active||typeof D==='undefined') return;
  
  // 🗑️ УДАЛЯЕМ ВСЁ БРОШЕННОЕ ОРУЖИЕ ПРИ РЕСЕТЕ В PVP
  if(typeof DROPPED_WEAPONS !== 'undefined') {
    DROPPED_WEAPONS.length = 0;
  }
  if(typeof PROJECTILES !== 'undefined') {
    PROJECTILES.length = 0;
  }
  if(typeof WAND_PARTICLES !== 'undefined') WAND_PARTICLES.length = 0;
  if(typeof WAND_EXPLOSIONS !== 'undefined') WAND_EXPLOSIONS.length = 0;
  if(typeof MAGICSTAFF_CHARGE_FX !== 'undefined') MAGICSTAFF_CHARGE_FX.length = 0;
  if(typeof MAGICSTAFF_LIGHTNING_FX !== 'undefined') MAGICSTAFF_LIGHTNING_FX.length = 0;
  if(typeof MAGICSTAFF_GLOW_FX !== 'undefined') MAGICSTAFF_GLOW_FX.length = 0;
  
  // Сбрасываем D (противника)
  D.hp=100; D.stamina=100; D.rage=0;
  D.exhausted=0; D.unbalanced=0; D.vx=0; D.vy=0;
  D.hitFlash=0; D.rageBuffEnd=-1; D._dvx=0; D._dvy=0;
  D._wasExhausted = false;
  D._recovering = false;
  D._recoverProgress = 0;
  D._swingBlockCD = -1;
  D._exhaustedEndTime = 0;
  // Сбрасываем состояние зарядки у D
  if(D._wandCharging) { D._wandCharging = false; if(D._wandChargeSoundObj) { try{D._wandChargeSoundObj.pause();}catch(e){} D._wandChargeSoundObj = null; } }
  if(D._magicCharging) { D._magicCharging = false; if(D._magicChargeSoundObj) { try{D._magicChargeSoundObj.pause();}catch(e){} D._magicChargeSoundObj = null; } }
  if(D._bowCharging) { D._bowCharging = false; if(D._bowTensionSound) { try{D._bowTensionSound.pause();}catch(e){} D._bowTensionSound = null; } }
  if(D.hasWeapon===false && typeof setWeapon==='function') setWeapon(D, D.weaponType);
  
  // Сбрасываем P (игрока)
  if(P.hasWeapon===false && typeof setWeapon==='function') setWeapon(P, P.weaponType);
  P.hp=100; P.stamina=P.stamMax||100; P.rage=0;
  P.exhausted=0; P.unbalanced=0; P.vx=0; P.vy=0;
  P.hitFlash=0; P.rageBuffEnd=-1; P._dvx=0; P._dvy=0;
  P._wasExhausted = false;
  P._recovering = false;
  P._recoverProgress = 0;
  P._swingBlockCD = -1;
  P._exhaustedEndTime = 0;
  
  // Буфер интерполяции
  _buf=[]; 
  _cur.hp=100; 
  _cur.stamina=100;
  _acceptAnyHp=true; // принять hp:100 от следующего пакета
  
  // Позиции в зависимости от победителя
  if(msg?.iWon){
    // Противник победил → мы проиграли (P справа)
    D.x = W * 0.15;
    D.y = H * 0.6;
    P.x = W * 0.82;
    P.y = H * 0.6;
    _cur.x = D.x;
    _cur.y = D.y;
    if(typeof addWin==='function') addWin(true); // PVP: противник победил
  } else {
    // Противник проиграл → мы победили (P слева)
    D.x = W * 0.82;
    D.y = H * 0.6;
    P.x = W * 0.15;
    P.y = H * 0.6;
    _cur.x = D.x;
    _cur.y = D.y;
  }
  
  // Сбрасываем экран смерти
  DEATH.dDead = false;
  DEATH.pDead = false;
  DEATH.fadeIn = false;
  DEATH.text = '';
  
  NET_CHAT.log('↺ раунд сброшен');
}
  // ── Приём состояния ──
  function onState(msg){
    if(!_active||typeof D==='undefined') return;
    const ping=NET_CORE.getPing()/2000;
    if(msg.t==='s'){
      if(msg.x!=null){
        _cur.x=qDec(msg.x,W); _cur.y=qDec(msg.y,H);
        // Первый пакет — мгновенно ставим D на позицию (нет рывка)
        if(_buf.length===0&&typeof D!=='undefined'){
          D.x=_cur.x; D.y=_cur.y;
        }
      }
      if(msg.u!=null){ _cur.vx=qDec(msg.u,W*2)-W; _cur.vy=qDec(msg.v,H*2)-H; }
      if(msg.a!=null){ _cur.angle=qaDec(msg.a); }
      if(msg.l!=null){ _cur.vel=msg.l/100; }
      if(msg.h!=null){ _cur.hp=msg.h; }
      if(msg.s!=null){ _cur.stamina=msg.s; }
      if(msg.r!=null){ _cur.rage=msg.r; }
      if(msg.px!=null){ _cur.pvX=(msg.px-512)/10; _cur.pvY=(msg.py-512)/10; }
      if(msg.bx!=null){ _cur.bx=(msg.bx-512)/10;  _cur.by=(msg.by-512)/10; }
      // Баффы
      // Щит противника
      if(msg.sh!=null && msg.sh!==D.shield){ setShield(D, msg.sh); }
      if(msg.shf!=null) D._shieldFlipped = !!msg.shf;
      // Усталость/дисбаланс — сохраняем таргет, применяем плавно в tick
      if(msg.ex!=null) _cur._exTarget  = msg.ex/10;
      if(msg.ub!=null) _cur._ubTarget  = msg.ub/10;
      if(msg.rb!=null) D.rageBuffEnd= msg.rb>0 ? GameTime+msg.rb/10 : -1;
      // Вид оружия противника — нужен для верной длины/скорости замаха при
      // рендере D. Спрайт (_weaponUrl/_weaponImg) синхронизируется отдельно
      // при хендшейке и при подборе оружия на карте, поэтому здесь трогаем
      // только индекс, а не пере-рандомизируем спрайт через setWeapon().
      if(msg.wt!=null && msg.wt!==D.weaponType){ D.weaponType=msg.wt; }
      // Обезоруживание противника — иначе D продолжает драться "вооружённым"
      // даже после того, как оппонент выбил у себя оружие (и наоборот).
      if(msg.hw!=null){
        const _hw=!!msg.hw;
        if(!_hw && D.hasWeapon!==false){ D.hasWeapon=false; D._weaponImg=null; }
        else if(_hw && D.hasWeapon===false){ D.hasWeapon=true; }
      }
    }
    // Client-side prediction
    const pred=Object.assign({},_cur,{
      x:_cur.x+(_cur.vx||0)*ping,
      y:_cur.y+(_cur.vy||0)*ping,
      angle:_cur.angle,
    });
    bufferPush(pred);
    // После ресета принимаем HP в любую сторону (флаг _acceptAnyHp)
    if(_acceptAnyHp || _cur.hp<D.hp-0.5)  D.hp=_cur.hp;
    if(_acceptAnyHp || _cur.stamina<D.stamina-0.5) D.stamina=_cur.stamina;
    D.rage=_cur.rage;
    if(_acceptAnyHp && _cur.hp>=99) _acceptAnyHp=false; // сбрасываем после получения 100
    if(typeof AI!=='undefined') AI.enabled=false;
    // debug

  }

  function onHit(msg){
    if(!_active||typeof P==='undefined') return;
    P.hp=Math.max(0,msg.newHp);
    P.hitFlash=(typeof GameTime!=='undefined'?GameTime:0)+0.25;
    $.FX.hit({x:P.x,y:P.y-30,t:'-'+msg.dmg,life:40,big:false,col:'#ff4040'});
    playSound?.('damage');
    if(P.hp<=0&&typeof triggerDeath==='function') triggerDeath(P,false);
  }

  function onDisconnected(){ _pendingStart=false; setNetPVP(false); NET_CHAT.log('👋 ПВП завершён'); }

  // ── Tick — буфер интерполяции → D ──
  function tick(rawDt){
    if(!_active||typeof D==='undefined') return;
    if(typeof AI!=='undefined') AI.enabled=false;

    const target=bufferTick();
    if(!target) return;

    // Позиция — фиксированный lerp без dist-зависимости (убирает перелёт)
    const dist=Math.hypot(target.x-D.x,target.y-D.y);
    if(dist>W*0.4 || _buf.length<3){
      // Телепорт при большом расстоянии или старте
      D.x=target.x; D.y=target.y;
    } else {
      // Фиксированный коэффициент — нет нелинейного ускорения при большой дистанции
      const t=Math.min(1, rawDt*12);
      D.x+=(target.x-D.x)*t;
      D.y+=(target.y-D.y)*t;
    }

    // Усталость/дисбаланс — плавно
    if(_cur._exTarget!=null) D.exhausted  = D.exhausted  *0.8 + _cur._exTarget*0.2;
    if(_cur._ubTarget!=null) D.unbalanced = D.unbalanced *0.8 + _cur._ubTarget*0.2;

    // Velocity
    if(target.vx!=null){
      D.vx=D.vx*0.4+target.vx*0.6;
      D.vy=D.vy*0.4+target.vy*0.6;
    }
    if(target.vel!=null) D.vel=D.vel*0.5+target.vel*0.5;

    // Угол меча — из буфера интерполяции (та же плавность что и позиция)
    if(target.angle!=null){
      let diff=target.angle-D.angle;
      while(diff>Math.PI)  diff-=Math.PI*2;
      while(diff<-Math.PI) diff+=Math.PI*2;
      D.angle+=diff*Math.min(1, rawDt*12);
    }

    // Оффсет тела (bx/by) и пивот меча (pvX/pvY) — lerp с тем же коэффициентом
    // Раньше они прыгали мгновенно → рассинхрон с плавным движением тела
    const st=Math.min(1, rawDt*10); // чуть медленнее позиции — естественнее
    D.bx  += (_cur.bx  - D.bx)  * st;
    D.by  += (_cur.by  - D.by)  * st;
    D.pvX += (_cur.pvX - D.pvX) * st;
    D.pvY += (_cur.pvY - D.pvY) * st;
  }

  return { onConnected,onDisconnected,onState,onHit,onReadyGame,onPingUpdate,startGame,disconnect,tick,
    setPeerName(n){_peerName=n;}, get active(){return _active;}, get peerName(){return _peerName;},
    forceResync, sendReset, onPvpReset };
})();
