// Survival owns its roster, game-clock timers and loot. Shared modules only call hooks.
(function(){
  'use strict';
  const DURATION = 360, GAP = 6, RESULT_DELAY = 2, HEAL = 50, HEAL_LIFE = 15;
  const MAX_HEALS = 32, MAX_DROPS = 48, DROP_LIFE = 15, REVEAL_DELAY = 1;
  const CELL = 55, OBJECT_RADIUS = 24, BODY_RADIUS = 22;
  const PROP_PUSH_MIN = 9, PROP_PUSH_MAX = 15, PROP_DECAY = 0.96;
  const SPIKE_ENTRY_DAMAGE = 20, SPIKE_DPS = 3, SPIKE_REENTRY = 1;
  const PROP_DAMAGE = 30, EXPLOSION_DAMAGE = 30, RED_FUSE = 3, EXPLOSION_RADIUS = CELL * 3.75;
  const ENEMY_WEAPON_KEYS = ['sword','rapier','dagger','spear','halberd','axe','longsword','staff','flail'];
  let active = false, ready = document.readyState !== 'loading';
  let phase = 'inactive', elapsed = 0, phaseLeft = 0, wave = 0, kills = 0, forceBotResumeAt = 0;
  let ordinarySinceBoss = 0, boss = false, result = null;
  let original = null, slotIndex = 0, roster = [], reserved = [], enemies = [];
  let pickups = [], arenaObjects = [], arenaBursts = [], woodParts = [], respawns = new Map(), dropAges = new WeakMap(), lastDeathPoint = null;
  let playerHurtFade = 0;
  const controls = new Map(), hud = {};
  const controlIds = ['sl-botcount','cb-botrandomweapon','dtoggle','mob-spawn-btn','mob-weapon-btn','mob-bot-weapon-btn','mob-bot-shield-btn'];
  const alive = ent => !!ent && ent.hp > 0 && !ent._defeated;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const setting = (id, fallback) => { const n = typeof sv === 'function' ? sv(id) : NaN; return Number.isFinite(n) ? n : fallback; };
  const body = ent => $.POS.body(ent);
  const online = () => typeof NET_SYNC !== 'undefined' && NET_SYNC.active;
  const getSlot = () => typeof LocalPlayerControls !== 'undefined' ? LocalPlayerControls.getGamepadSlot() : 0;
  const text = (key, vars) => window.I18N ? window.I18N.t(key, vars) : key;
  const livePlayers = () => {
    const result=[];
    const add=ent=>{ if(alive(ent)&&!result.includes(ent)) result.push(ent); };
    roster.forEach(add);
    if(Array.isArray(window.PLAYER_SLOTS)) for(const slot of window.PLAYER_SLOTS) if(slot&&slot.source) add(slot.entity);
    return result;
  };
  const liveEnemies = () => enemies.filter(alive);
  const gridSnap = v => Math.floor(v / CELL) * CELL + CELL * 0.5;
  const propSprites = {
    barrel:'../Env/Props/T_Barrel.png',
    redBarrel:'../Env/Props/T_BarrelTNT.png',
    crate:'../Env/Props/T_Box.png',
    spikes:'../Env/Props/T_FloorSpike.png',
    potion:'../Env/Props/T_Potion.png',
    explosion:'../VFX/VFX_Explosion.png',
    woodParts:'../VFX/VFX/_WoodPart.png',
    spawnRune:'../VFX/VFX_SpawnPointRune.png'
  };
  const propImgs = {};
  const WOOD_PART_SCALE=.12;
  const WOOD_PART_FRAMES=[[2,256,115,239],[2,2,124,252],[225,2,107,253],[225,257,68,234],[128,2,95,276],[419,2,65,276],[334,2,83,272],[119,280,85,197]];

  function combatants(){ return [...roster,...enemies].filter(ent=>alive(ent) && !ent._awaitingReveal); }
  function propImage(key){
    if(typeof loadSpriteImage!=='function') return null;
    const url=propSprites[key];
    if(!url) return null;
    if(!propImgs[key]) propImgs[key]=loadSpriteImage(url);
    const img=propImgs[key];
    return img&&img.complete&&img.naturalWidth>0 ? img : null;
  }
  function drawSpriteCentered(img,size){
    ctx.drawImage(img,-size*.5,-size*.5,size,size);
  }
  function spawnWoodParts(x,y,power=1){
    const frames=WOOD_PART_FRAMES.map((_,i)=>i);
    for(let i=frames.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)),t=frames[i];frames[i]=frames[j];frames[j]=t;}
    const count=4+Math.floor(Math.random()*3);
    for(let i=0;i<count;i++){
      const frame=frames[i],a=Math.random()*Math.PI*2,speed=(55+Math.random()*85)*power;
      woodParts.push({x,y,frame,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-(35+Math.random()*65)*power,angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*12,age:0,life:.65+Math.random()*.45});
    }
  }
  function heroHurtFeedback(amount, kind){
    playerHurtFade = Math.max(playerHurtFade, kind==='spikes' ? 0.18 : 0.28);
    if(typeof triggerHitstop==='function') triggerHitstop(kind==='spikes'?2:3, Math.min(7, 2 + amount / 10));
  }
  function hazardDamage(ent, amount, point, kind){
    if(!alive(ent) || phase==='result') return false;
    if(ent===P && kind==='spikes') amount=Math.min(amount,Math.max(0,ent.hp-1));
    if(amount<=0) return false;
    ent.hp=Math.max(0,ent.hp-amount); ent.hitFlash=GameTime+0.3; ent._healthBarUntil=GameTime+3;
    if(ent===P) heroHurtFeedback(amount,kind);
    $.FX.hit({x:body(ent).x,y:body(ent).y-35,t:'-'+Math.round(amount),life:42,big:amount>=20,col:kind==='explosion'?'#ff742e':'#ff4a38'});
    if(typeof spawnBlood==='function'){
      const a=Math.atan2(body(ent).y-point.y,body(ent).x-point.x);
      for(let i=0;i<Math.min(8,Math.ceil(amount/4));i++) spawnBlood(body(ent).x,body(ent).y,Math.cos(a)+(Math.random()-.5)*3,Math.sin(a)+(Math.random()-.5)*3);
    }
    return true;
  }
  function objectExtent(o){ return o.type==='spikes'?CELL*.5:OBJECT_RADIUS; }
  function overlapsObject(x,y,margin=0){ return arenaObjects.some(o=>Math.hypot(x-o.x,y-o.y)<objectExtent(o)+margin); }
  function safePoint(point, margin=42){
    if(!point) return false;
    return !arenaObjects.some(o=>Math.hypot(point.x-o.x,point.y-o.y)<objectExtent(o)+margin+(o.type==='spikes'?0:8));
  }
  function nearestSafePoint(origin){
    if(safePoint(origin)) return origin;
    for(let ring=1;ring<=10;ring++) for(let i=0;i<16;i++){
      const a=i*Math.PI/8,p={x:clamp(origin.x+Math.cos(a)*ring*CELL,60,WORLD_W-100),y:clamp(origin.y+Math.sin(a)*ring*CELL,60,WORLD_H-60)};
      if(safePoint(p)&&combatants().every(ent=>Math.hypot(body(ent).x-p.x,body(ent).y-p.y)>55)) return p;
    }
    return {x:WORLD_W/2,y:WORLD_H/2};
  }
  function makeArenaObject(type,x,y){
    return {type,x,y,vx:0,vy:0,moving:false,fuse:null,pusher:null,armed:false,hitTargets:new WeakSet(),inside:new WeakSet(),lastEntry:new WeakMap(),spikeTime:new WeakMap()};
  }
  function rerollArenaObjects(){
    arenaObjects=[]; arenaBursts=[]; woodParts=[];
    const viewW=Math.max(CELL*8,W/CAM_SCALE),viewH=Math.max(CELL*7,H/CAM_SCALE);
    const cols=Math.max(1,Math.ceil(WORLD_W/viewW)),rows=Math.max(1,Math.ceil(WORLD_H/viewH));
    for(let sy=0;sy<rows;sy++) for(let sx=0;sx<cols;sx++){
      const count=3+Math.floor(Math.random()*3); let reds=0;
      for(let n=0;n<count;n++){
        const roll=Math.random(); let type=roll<.32?'spikes':roll<.62?'crate':roll<.94?'barrel':'redBarrel';
        if(type==='redBarrel'&&(reds>=2||Math.random()>.45)) type=Math.random()<.5?'crate':'barrel';
        if(type==='redBarrel') reds++;
        let placed=false;
        for(let attempt=0;attempt<60;attempt++){
          const x=clamp(gridSnap((sx+.1+Math.random()*.8)*viewW),CELL,WORLD_W-CELL);
          const y=clamp(gridSnap((sy+.12+Math.random()*.76)*viewH),CELL,WORLD_H-CELL);
          const clearance=type==='spikes'?CELL*.75:OBJECT_RADIUS*2.2;
          if(overlapsObject(x,y,clearance)) continue;
          if([...roster,...enemies].some(ent=>ent&&Math.hypot(body(ent).x-x,body(ent).y-y)<CELL*1.7)) continue;
          arenaObjects.push(makeArenaObject(type,x,y)); placed=true; break;
        }
        if(!placed&&type==='redBarrel') reds--;
      }
    }
  }
  function pushObject(o,ent,nx,ny){
    const speed=Math.hypot(ent._dvx||0,ent._dvy||0); if(speed<1.25) return false;
    const ec=body(ent),len=Math.hypot(o.x-ec.x,o.y-ec.y)||1;
    const impulse=clamp(speed*0.85,PROP_PUSH_MIN,PROP_PUSH_MAX);
    nx=Number.isFinite(nx)?nx:(o.x-ec.x)/len;ny=Number.isFinite(ny)?ny:(o.y-ec.y)/len;
    o.vx=nx*impulse;o.vy=ny*impulse;
    o.moving=true;o.pusher=ent;o.armed=o.type!=='redBarrel';o.hitTargets=new WeakSet();o.hitTargets.add(ent);
    o._pushLockUntil=GameTime+0.25;ent._arenaPropPushLockUntil=GameTime+0.25;
    armRedBarrel(o);
    if(typeof spawnDust==='function')for(let i=0;i<5;i++)spawnDust(o.x,o.y,-o.vx*.25+(Math.random()-.5)*2,-o.vy*.25+(Math.random()-.5)*2);
    return true;
  }
  function propThrowAngle(ent){
    if(ent===P){
      const rc=$.POS.root();
      return Math.atan2(mY-rc.y,mX-rc.x);
    }
    return ent._manualControl&&Number.isFinite(ent.angle)?ent.angle:ent.angle||0;
  }
  function tryThrowObject(ent){
    if(!isActive()||!alive(ent)) return false;
    const c=body(ent),ang=propThrowAngle(ent),fx=Math.cos(ang),fy=Math.sin(ang);
    let best=null,bestScore=Infinity;
    for(const o of arenaObjects){
      if(o.type==='spikes'||o.moving) continue;
      const dx=o.x-c.x,dy=o.y-c.y,dist=Math.hypot(dx,dy)||1;
      if(dist>BODY_RADIUS+OBJECT_RADIUS+CELL) continue;
      const dot=(dx/dist)*fx+(dy/dist)*fy;
      if(dot<0.45) continue;
      const side=Math.abs(dx*fy-dy*fx);
      const score=dist+side*0.8;
      if(score<bestScore){best=o;bestScore=score;}
    }
    if(!best) return false;
    const spd=PROP_PUSH_MAX*1.15;
    best.vx=fx*spd;best.vy=fy*spd;best.moving=true;best.pusher=ent;best.armed=best.type!=='redBarrel';best.hitTargets=new WeakSet();best.hitTargets.add(ent);
    best._pushLockUntil=GameTime+0.25;ent._arenaPropPushLockUntil=GameTime+0.25;
    armRedBarrel(best);
    if(typeof tryCinematicSlowmo==='function') tryCinematicSlowmo('throw',0.20);
    if($.S&&$.S.play) $.S.play('throwSound');
    return true;
  }
  function projectileHitObject(projectile,radius=8,power=1){
    if(!isActive()||!projectile) return false;
    for(const o of arenaObjects){
      if(o.type==='spikes') continue;
      const dx=o.x-projectile.x,dy=o.y-projectile.y,dist=Math.hypot(dx,dy)||1;
      if(dist>OBJECT_RADIUS+radius) continue;
      const spd=Math.hypot(projectile.vx||0,projectile.vy||0)||1,nx=(projectile.vx||dx)/spd,ny=(projectile.vy||dy)/spd;
      let hitNx=(projectile.x-o.x)/dist,hitNy=(projectile.y-o.y)/dist;
      if(!Number.isFinite(hitNx)||!Number.isFinite(hitNy)||dist<=1){ hitNx=-nx;hitNy=-ny; }
      projectile._arenaObjectHit={x:o.x,y:o.y,nx:hitNx,ny:hitNy,radius:OBJECT_RADIUS+radius};
      o.vx+=nx*Math.min(PROP_PUSH_MAX,spd*power);o.vy+=ny*Math.min(PROP_PUSH_MAX,spd*power);o.moving=true;
      o.hitTargets=new WeakSet();armRedBarrel(o);
      if(typeof spawnDust==='function')for(let i=0;i<4;i++)spawnDust(o.x,o.y,-nx*2+(Math.random()-.5)*2,-ny*2+(Math.random()-.5)*2);
      if($.S&&$.S.play)$.S.play('clash');
      return true;
    }
    return false;
  }
  function segmentCircleHit(ax,ay,bx,by,cx,cy,r){
    const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy||1,t=clamp(((cx-ax)*dx+(cy-ay)*dy)/len2,0,1);
    const x=ax+dx*t,y=ay+dy*t;
    return Math.hypot(cx-x,cy-y)<=r ? t : null;
  }
  function pushSegmentObject(o,ax,ay,bx,by,power=1){
    const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;
    o.vx+=dx/len*PROP_PUSH_MAX*power;o.vy+=dy/len*PROP_PUSH_MAX*power;o.moving=true;o.hitTargets=new WeakSet();armRedBarrel(o);
  }
  function segmentHitObject(ax,ay,bx,by,radius=6,power=1,apply=true){
    if(!isActive()) return null;
    let best=null;
    for(const o of arenaObjects){
      if(o.type==='spikes') continue;
      const t=segmentCircleHit(ax,ay,bx,by,o.x,o.y,OBJECT_RADIUS+radius);
      if(t==null || (best&&t>=best.t)) continue;
      best={t,object:o};
    }
    if(!best) return null;
    if(apply) pushSegmentObject(best.object,ax,ay,bx,by,power);
    return {t:best.t,object:best.object};
  }
  function armRedBarrel(o){
    if(o.type==='redBarrel' && o.fuse==null){ o.fuse=RED_FUSE; o.armed=true; }
  }
  function explode(o){
    const index=arenaObjects.indexOf(o);if(index<0)return;arenaObjects.splice(index,1);spawnWoodParts(o.x,o.y,1.25);arenaBursts.push({x:o.x,y:o.y,age:0,life:.55});
    for(const ent of combatants())if(Math.hypot(body(ent).x-o.x,body(ent).y-o.y)<=EXPLOSION_RADIUS){
      hazardDamage(ent,EXPLOSION_DAMAGE,o,'explosion');const dx=body(ent).x-o.x,dy=body(ent).y-o.y,l=Math.hypot(dx,dy)||1;ent.vx+=(dx/l)*7;ent.vy+=(dy/l)*7;
    }
    for(let i=arenaObjects.length-1;i>=0;i--){
      const other=arenaObjects[i];if(Math.hypot(other.x-o.x,other.y-o.y)>EXPLOSION_RADIUS)continue;
      if(other.type==='redBarrel'){if(other.fuse==null)other.fuse=RED_FUSE;}else if(other.type!=='spikes'){arenaObjects.splice(i,1);spawnWoodParts(other.x,other.y,1.1);}
    }
    if(typeof spawnBlood==='function')for(let i=0;i<18;i++)spawnBlood(o.x,o.y,Math.cos(i*Math.PI/9)*(3+Math.random()*7),Math.sin(i*Math.PI/9)*(3+Math.random()*7));
    if($.S&&$.S.play)$.S.play('damageHammer');
  }
  function resolveSolid(ent,o){
    const c=body(ent),dx=c.x-o.x,dy=c.y-o.y,dist=Math.hypot(dx,dy)||.001,min=BODY_RADIUS+OBJECT_RADIUS;if(dist>=min)return false;
    const push=min-dist,nx=dx/dist,ny=dy/dist,canPush=!o.moving&&GameTime>=(o._pushLockUntil||0)&&GameTime>=(ent._arenaPropPushLockUntil||0);
    if(canPush&&(ent._dvx||ent._dvy)&&pushObject(o,ent,-nx,-ny)){
      const sep=push+2;o.x-=nx*sep*.65;o.y-=ny*sep*.65;ent.x+=nx*sep*.35;ent.y+=ny*sep*.35;
      return true;
    }
    ent.x+=nx*push;ent.y+=ny*push;
    const inward=ent.vx*nx+ent.vy*ny;if(inward<0){ent.vx-=nx*inward;ent.vy-=ny*inward;}return true;
  }
  function resolveObjectCollision(a,b){
    if(!a||!b||a===b||a.type==='spikes'||b.type==='spikes') return false;
    const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||.001,min=OBJECT_RADIUS*2;
    if(dist>=min) return false;
    const nx=dx/dist,ny=dy/dist,overlap=min-dist;
    a.x=clamp(a.x-nx*overlap*.5,OBJECT_RADIUS,WORLD_W-OBJECT_RADIUS);a.y=clamp(a.y-ny*overlap*.5,OBJECT_RADIUS,WORLD_H-OBJECT_RADIUS);
    b.x=clamp(b.x+nx*overlap*.5,OBJECT_RADIUS,WORLD_W-OBJECT_RADIUS);b.y=clamp(b.y+ny*overlap*.5,OBJECT_RADIUS,WORLD_H-OBJECT_RADIUS);
    const av=(a.vx||0)*nx+(a.vy||0)*ny,bv=(b.vx||0)*nx+(b.vy||0)*ny,closing=av-bv;
    if(closing>0){
      const impulse=closing*.75;
      a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;
      if(Math.hypot(a.vx,a.vy)>.12) a.moving=true;
      if(Math.hypot(b.vx,b.vy)>.12) b.moving=true;
    }
    armRedBarrel(a);armRedBarrel(b);
    return true;
  }
  function updateArenaObjects(dt){
    for(const burst of arenaBursts)burst.age+=dt;arenaBursts=arenaBursts.filter(b=>b.age<b.life);
    for(const part of woodParts){part.age+=dt;part.x+=part.vx*dt;part.y+=part.vy*dt;part.vy+=180*dt;part.angle+=part.spin*dt;const drag=Math.pow(.985,dt*60);part.vx*=drag;part.vy*=drag;}
    woodParts=woodParts.filter(part=>part.age<part.life);
    const ents=combatants();
    for(let i=arenaObjects.length-1;i>=0;i--){
      const o=arenaObjects[i];
      if(o.type==='spikes'){
        for(const ent of ents){
          const c=body(ent),touch=Math.abs(c.x-o.x)<=CELL*.48+BODY_RADIUS*.45&&Math.abs(c.y-o.y)<=CELL*.48+BODY_RADIUS*.45;
          if(touch){
            const slow=Math.pow(.86,dt*60);ent.vx*=slow;ent.vy*=slow;ent.vel*=slow;
            if(!o.inside.has(ent)&&GameTime-(o.lastEntry.get(ent)||-99)>=SPIKE_REENTRY&&hazardDamage(ent,SPIKE_ENTRY_DAMAGE,o,'spikes')&&Math.hypot(ent._dvx||0,ent._dvy||0)>1){ent._dvx*=.5;ent._dvy*=.5;}
            o.inside.add(ent);const spikeTime=(o.spikeTime.get(ent)||0)+dt;
            if(spikeTime>=1){const ticks=Math.floor(spikeTime);if(hazardDamage(ent,SPIKE_DPS*ticks,o,'spikes')&&Math.hypot(ent._dvx||0,ent._dvy||0)>1){ent._dvx*=.5;ent._dvy*=.5;}o.spikeTime.set(ent,spikeTime-ticks);}else o.spikeTime.set(ent,spikeTime);
          }else{if(o.inside.has(ent))o.lastEntry.set(ent,GameTime);o.inside.delete(ent);o.spikeTime.delete(ent);}
        }continue;
      }
      if(o.fuse!=null){o.fuse-=dt;if(o.fuse<=0){explode(o);continue;}}
      if(o.moving){
        const step=dt*60;o.x=clamp(o.x+o.vx*step,OBJECT_RADIUS,WORLD_W-OBJECT_RADIUS);o.y=clamp(o.y+o.vy*step,OBJECT_RADIUS,WORLD_H-OBJECT_RADIUS);
        if(o.x===OBJECT_RADIUS||o.x===WORLD_W-OBJECT_RADIUS||o.y===OBJECT_RADIUS||o.y===WORLD_H-OBJECT_RADIUS) armRedBarrel(o);
        const decay=Math.pow(PROP_DECAY,step);o.vx*=decay;o.vy*=decay;
        for(const ent of ents){
          const c=body(ent),dx=c.x-o.x,dy=c.y-o.y,d=Math.hypot(dx,dy)||1;if(d>BODY_RADIUS+OBJECT_RADIUS)continue;
          if(!o.hitTargets.has(ent)){hazardDamage(ent,PROP_DAMAGE,o,'impact');o.hitTargets.add(ent);armRedBarrel(o);if(o.type!=='redBarrel'&&Math.random()<.5){arenaObjects.splice(i,1);spawnWoodParts(o.x,o.y);o._gone=true;break;}}
          const vl=Math.hypot(o.vx||dx,o.vy||dy)||1,nx=(o.vx||dx)/vl,ny=(o.vy||dy)/vl;ent.x+=nx*Math.max(0,BODY_RADIUS+OBJECT_RADIUS-d);ent.y+=ny*Math.max(0,BODY_RADIUS+OBJECT_RADIUS-d);ent.vx+=o.vx*.35;ent.vy+=o.vy*.35;o.vx*=.72;o.vy*=.72;
        }
        for(const other of arenaObjects)resolveObjectCollision(o,other);
        if(o._gone)continue;if(Math.hypot(o.vx,o.vy)<.12){o.vx=o.vy=0;o.moving=false;o.pusher=null;}
      }
      for(const ent of ents)resolveSolid(ent,o);
    }
  }
  function adjustAI(bot){
    if(!isActive()||!alive(bot)||!bot._aiState)return;
    const k=bot._aiState._fakeKeys,c=body(bot);let dx=(k.d?1:0)-(k.a?1:0),dy=(k.s?1:0)-(k.w?1:0),ax=0,ay=0;
    for(const o of arenaObjects){if(o.type!=='spikes')continue;const ox=c.x-o.x,oy=c.y-o.y,d=Math.hypot(ox,oy)||1;if(d<CELL*1.45&&(d<CELL*.85||(ox*dx+oy*dy)<0)){ax+=ox/d*(CELL*1.5-d);ay+=oy/d*(CELL*1.5-d);}}
    if(ax||ay){dx+=ax*.08;dy+=ay*.08;k.a=dx<-.2;k.d=dx>.2;k.w=dy<-.2;k.s=dy>.2;}
    if(GameTime>=(bot._arenaPropIdeaAt||0)){
      bot._arenaPropIdeaAt=GameTime+1.5+Math.random()*2;const target=bot._aiTargetOverride||P;
      const prop=arenaObjects.find(o=>o.type!=='spikes'&&!o.moving&&Math.hypot(o.x-c.x,o.y-c.y)<85&&Math.hypot(target.x-o.x,target.y-o.y)<360);
      if(prop&&Math.random()<.28){const tx=target.x-prop.x,ty=target.y-prop.y,tl=Math.hypot(tx,ty)||1,bx=prop.x-c.x,by=prop.y-c.y,bl=Math.hypot(bx,by)||1;if((tx/tl)*(bx/bl)+(ty/tl)*(by/bl)>.45){bot._dvx=bx/bl*7.5;bot._dvy=by/bl*7.5;bot._aiState._dodgeLockUntil=GameTime+.25;}}
    }
  }

  function notify(key, point, vars, col = '#78d8ff'){
    if(typeof hitFX !== 'undefined') $.FX.hit({x:point.x,y:point.y-40,t:text(key,vars),life:55,big:true,col});
  }

  function bindRoster(){
    if(typeof LocalPlayerControls === 'undefined') return;
    LocalPlayerControls.slots.forEach((slot, i) => {
      slot.entity = i === 0 ? P : ALL_BOTS[i-1] || null;
      slot.source = i === 0 ? 'keyboard-mouse' : i === slotIndex ? 'gamepad-0' : null;
    });
    window.PLAYER_SLOTS = LocalPlayerControls.slots;
  }

  function cancelEntity(ent){
    if(!ent) return;
    if(ent._respawnTimerId) clearTimeout(ent._respawnTimerId);
    ent._respawnTimerId = 0; ent._respawnPending = false; ent._respawnAt = 0;
    if(typeof clearEntityChargeState === 'function') clearEntityChargeState(ent);
    ent._manualAttackInput = false; ent._shieldHeld = false; ent._shieldDashCharging = false;
    if(ent._aiState){
      ent._aiState._fakeMDown = false;
      for(const key of ['w','a','s','d']) ent._aiState._fakeKeys[key] = false;
    }
  }

  function resetPlayer(ent, point, equip){
    cancelEntity(ent);
    ent._buffs = {}; ent._mods = {};
    Object.assign(ent, {hp:ent.maxHp||100,stamina:ent.stamMax||100,rage:0,rageBuffEnd:-1,
      _defeated:false,exhausted:0,unbalanced:0,vx:0,vy:0,vel:0,bx:0,by:0,
      _dvx:0,_dvy:0,_recovering:false,_wasExhausted:false,_hadExhaustion:false,
      _debuffActive:false,_debuffUntil:-1,_exhaustedEndTime:-1,_unbalancedEndTime:-1,
      _dodgeActiveUntil:-1,_moveLockUntil:-1,_dodgeCD:-1,_swingBlockCD:-1,_blockSlow:-1,
      _lastDodgeAt:null,_awaitingReveal:false,_manualGestureSuppressUntil:RealTime+0.3,
      _shieldStunUntil:-1,_shieldBodyHitCD:-1,_shieldBlockFxUntil:-1,_inAutoBlock:false,
      _abTilt:0,_clashFrame:-1,lmbWasDown:false,_manualCombatState:null,_manualCombatStateV2:null,
      _bodyScaleMult:1,_damageMult:1,_survivalBoss:false,_hitCD:GameTime+1});
    if(point){
      ent.x = point.x; ent.y = point.y;
      delete ent._pendingSpawnX; delete ent._pendingSpawnY;
    }
    if(equip && ent.hasWeapon === false) setWeapon(ent, ent.weaponType || 0);
    if(typeof setShield === 'function') setShield(ent, 0);
  }

  function createEntity(){
    const ent = makeEntity(WORLD_W/2, WORLD_H/2, 0.8, '#4a1a10', {stamRegen:28});
    ent._aiState = freshAIState();
    return ent;
  }

  function setRandomEnemyWeapon(bot){
    if(!bot || typeof setWeapon !== 'function') return;
    if(typeof WEAPON_TYPES === 'undefined'){
      setWeapon(bot, DEFAULT_WEAPON_KEY, {keepDefault:true});
      return;
    }
    const available = ENEMY_WEAPON_KEYS
      .map(key => WEAPON_TYPES.findIndex(w => w && w.key === key))
      .filter(index => index >= 0);
    const picked = available.length ? available[Math.floor(Math.random() * available.length)] : DEFAULT_WEAPON_KEY;
    setWeapon(bot, picked, {keepDefault:true});
  }

  function setRandomEnemyShield(bot){
    if(!bot || typeof setShield !== 'function' || typeof SHIELD_TYPES === 'undefined') return;
    const chance = clamp(0.10 + (wave - 1) * 0.05, 0.10, 0.75);
    if(Math.random() >= chance){ setShield(bot, 0); return; }
    const count = Math.max(1, SHIELD_TYPES.length - 1);
    setShield(bot, 1 + Math.floor(Math.random() * count));
  }

  function buildRoster(){
    slotIndex = getSlot();
    roster = [P]; reserved = [];
    for(let i=0;i<slotIndex;i++){
      const isPartner = i === slotIndex-1;
      const ent = isPartner && original.bots[i] ? original.bots[i] : createEntity();
      ent._manualControl = isPartner;
      if(isPartner){
        ent._playerSlot = slotIndex;
        ent._survivalReserved = false;
        if(!original.bots[i]) setWeapon(ent, DEFAULT_WEAPON_KEY, {keepDefault:true});
        roster.push(ent);
      } else {
        ent._survivalReserved = true; ent.hp = 0; ent._defeated = true;
        ent.hasWeapon = false; ent._aiState.enabled = false;
      }
      reserved.push(ent);
    }
    ALL_BOTS.splice(0, ALL_BOTS.length, ...reserved);
    bindRoster();
  }

  function clearTransient(){
    if(typeof PROJECTILES !== 'undefined') PROJECTILES.length = 0;
    if(typeof DROPPED_WEAPONS !== 'undefined') DROPPED_WEAPONS.length = 0;
    if(typeof DROPPED_SHIELDS !== 'undefined') DROPPED_SHIELDS.length = 0;
    if(typeof BALLS !== 'undefined') BALLS.length = 0;
    if(typeof clearDeathAnimations === 'function') clearDeathAnimations();
    pickups = []; arenaObjects=[]; arenaBursts=[]; woodParts=[]; dropAges = new WeakMap();
    DEATH.deathCross.length = 0;
  }

  function clearOverlay(){
    DEATH.pDead = false; DEATH.dDead = false; DEATH.fadeIn = false;
    DEATH.fadeAlpha = 0; DEATH.text = '';
  }

  function selectMain(){
    // D also drives the right-hand HUD; keep the co-op partner there.
    const aiEnabled = !AI || AI.enabled !== false;
    const main = roster[1] || liveEnemies()[0] || enemies[0] || D;
    if(main){ D = main; AI = main._aiState || AI; }
    const first = liveEnemies()[0];
    for(const bot of enemies){
      const ai = bot._aiState;
      ai._isMain = bot === first; ai.enabled = aiEnabled && alive(bot) && phase !== 'result';
    }
  }
  function forceResumeBotsAfterSpawn(){
    if(!forceBotResumeAt || GameTime<forceBotResumeAt || phase==='result') return;
    forceBotResumeAt=0;
    if(AI) AI.enabled=true;
    for(const bot of enemies) if(bot._aiState) bot._aiState.enabled=alive(bot);
    const b=document.getElementById('dtoggle');
    if(b){
      b.textContent=window.I18N?window.I18N.buttonText('dtoggle','on'):'ON';
      b.classList.toggle('on',true);
    }
  }

  function playerPoint(index){
    const x = WORLD_W/2 - (index ? -45 : 45);
    return {x:clamp(x,60,WORLD_W-100),y:WORLD_H/2 + index*70};
  }

  function newMatch(){
    for(const ent of [...roster,...enemies]) cancelEntity(ent);
    respawns.clear(); enemies = [];
    buildRoster(); clearTransient(); clearOverlay();
    elapsed = 0; phaseLeft = 0; wave = 0; kills = 0; forceBotResumeAt = 0; ordinarySinceBoss = 0;
    boss = false; result = null; lastDeathPoint = null;
    roster.forEach((ent,i) => resetPlayer(ent,playerPoint(i),true));
    dummyOn = true;
    if(typeof snapCameraToTarget === 'function') snapCameraToTarget();
    phase = 'wave';
    spawnWave();
    updateHud();
  }

  function spawnPoint(index, count, big){
    const players = livePlayers();
    const center = players.length ? {
      x:players.reduce((v,p)=>v+p.x,0)/players.length,
      y:players.reduce((v,p)=>v+p.y,0)/players.length
    } : {x:WORLD_W/2,y:WORLD_H/2};
    const scale = setting('cscl',1), margin = 40*scale*(big?2:1);
    const radius = Math.max(220*scale, Math.min(W/CAM_SCALE,H/CAM_SCALE)*0.48);
    let best = null, score = -Infinity;
    // Bounded search: avoid player overlap, world edges and solid boxes.
    for(let attempt=0;attempt<32;attempt++){
      const angle = (index/count + attempt/32)*Math.PI*2;
      const p = {x:clamp(center.x+Math.cos(angle)*radius,margin,WORLD_W-margin-40),
        y:clamp(center.y+Math.sin(angle)*radius,margin,WORLD_H-margin)};
      if(typeof boxesOn !== 'undefined' && boxesOn && typeof BOXES !== 'undefined' &&
         BOXES.some(b=>p.x>b.x-margin && p.x<b.x+b.w+margin && p.y>b.y-margin && p.y<b.y+b.h+margin)) continue;
      const distances = players.map(ent=>Math.hypot(ent.x-p.x,ent.y-p.y));
      for(const ent of enemies) distances.push(Math.hypot(ent._pendingSpawnX-p.x,ent._pendingSpawnY-p.y));
      const nearest = Math.min(...distances);
      if(nearest>score){ best=p; score=nearest; }
      if(nearest>=180*scale) break;
    }
    return best || {x:margin,y:margin};
  }

  function spawnWave(){
    if(!active || phase === 'result') return;
    if(elapsed >= DURATION){ finish('victory'); return; }
    for(const bot of enemies) cancelEntity(bot);
    enemies = [];
    ALL_BOTS.splice(reserved.length);
    wave++;
    boss = ordinarySinceBoss>=3 && Math.random()<0.5;
    if(boss) ordinarySinceBoss=0;
    const range = elapsed<120 ? [1,3] : elapsed<240 ? [4,5] : [5,6];
    const count = boss ? 1 : range[0]+Math.floor(Math.random()*(range[1]-range[0]+1));
    phase='wave'; phaseLeft=0;
    for(let i=0;i<count;i++){
      const point=spawnPoint(i,count,boss), bot=createEntity();
      Object.assign(bot,{_survivalEnemy:true,_survivalBoss:boss,_bodyScaleMult:boss?2:1,
        _damageMult:boss?1+Math.random():1,maxHp:boss?200:100,hp:boss?200:100,
        _isExtra:i>0,_survivalRevealAt:GameTime+REVEAL_DELAY});
      bot._aiState.enabled=true;
      setRandomEnemyWeapon(bot);
      setRandomEnemyShield(bot);
      if(typeof spritesDBReady!=='undefined' && spritesDBReady && typeof assignRandomSkin==='function') assignRandomSkin(bot);
      placeBotPendingReveal(bot,point.x,point.y);
      enemies.push(bot); ALL_BOTS.push(bot);
    }
    bindRoster(); selectMain();
    rerollArenaObjects();
    maybeSpawnRoundHeal();
    forceBotResumeAt=GameTime+1;
    P._cameraCombatUntil=GameTime+8;
    if(boss) notify('survival.boss',body(roster[0]),null,'#ff754b');
  }

  function finish(outcome){
    if(phase==='result') return;
    result=outcome; phase='result'; phaseLeft=RESULT_DELAY;
    for(const ent of [...roster,...enemies]) cancelEntity(ent);
    respawns.clear();
    clearTransient();
    DEATH.pDead=true; DEATH.dDead=false; DEATH.fadeIn=true; DEATH.fadeAlpha=0;
    DEATH.text=text(outcome==='victory'?'survival.victory':'survival.defeat');
    DEATH.textCol=outcome==='victory'?'#ffdd44':'#ff6060';
    for(const ent of enemies) ent._aiState.enabled=false;
    if(typeof addWin==='function') addWin(outcome==='defeat');
    updateHud();
  }

  function spawnHeal(point){
    if(pickups.length>=MAX_HEALS) pickups.shift();
    pickups.push({x:point.x,y:point.y,remaining:HEAL_LIFE});
  }
  function offscreenPoint(){
    const left=CAM_X-CELL,right=CAM_X+W/CAM_SCALE+CELL,top=CAM_Y-CELL,bottom=CAM_Y+H/CAM_SCALE+CELL;
    for(let attempt=0;attempt<80;attempt++){
      const p={x:clamp(gridSnap(70+Math.random()*(WORLD_W-140)),CELL,WORLD_W-CELL),y:clamp(gridSnap(70+Math.random()*(WORLD_H-140)),CELL,WORLD_H-CELL)};
      if(p.x>left&&p.x<right&&p.y>top&&p.y<bottom) continue;
      if(!safePoint(p,30)) continue;
      if(combatants().some(ent=>Math.hypot(body(ent).x-p.x,body(ent).y-p.y)<CELL*1.2)) continue;
      return p;
    }
    const fallbacks=[{x:CELL,y:CELL},{x:WORLD_W-CELL,y:CELL},{x:CELL,y:WORLD_H-CELL},{x:WORLD_W-CELL,y:WORLD_H-CELL},{x:WORLD_W*.5,y:CELL},{x:WORLD_W*.5,y:WORLD_H-CELL}];
    for(const p of fallbacks){
      if(p.x>left&&p.x<right&&p.y>top&&p.y<bottom) continue;
      if(safePoint(p,30)) return p;
    }
    return null;
  }
  function maybeSpawnRoundHeal(){
    if(Math.random()>=0.3) return;
    const point=offscreenPoint();
    if(point) spawnHeal(point);
  }

  function handleDeath(ent){
    if(!isActive()) return false;
    if(!roster.includes(ent) && !enemies.includes(ent)) return true;
    if(phase==='result' || ent._defeated) return true;
    const point=body(ent);
    const player=roster.includes(ent);
    if(typeof startDeathAnimation==='function') startDeathAnimation(ent);
    ent.hp=0; ent._defeated=true;
    const shieldToDrop = !!ent.shield;
    if(ent.hasWeapon!==false) disarmEntity(ent);
    if(shieldToDrop && typeof dropShield === 'function') dropShield(ent);
    else if(!player && ent.shield && typeof setShield === 'function') setShield(ent, 0);
    cancelEntity(ent);
    const delay=Math.max(0,setting('playerrespawn',15));
    DEATH.deathCross.push({x:point.x,y:point.y,timer:player?Math.max(2,delay):2,isBot:!player});
    if(typeof spawnBlood==='function'){
      for(let i=0;i<8;i++) spawnBlood(point.x,point.y,Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4));
    }
    $.S.play('death');
    if(player){
      if(livePlayers().length && delay>0){
        respawns.set(ent,delay); ent._respawnPending=true;
      }
    } else {
      kills++;
      lastDeathPoint={x:point.x,y:point.y};
      if(ent._survivalBoss || Math.random()<(roster.length===1?0.15:0.1)) spawnHeal(lastDeathPoint);
    }
    // Do not splice ALL_BOTS here: projectiles/melee are iterating it.
    return true;
  }

  function updateRespawns(dt){
    for(const [ent,remaining] of respawns){
      const next=remaining-dt;
      if(next>0){ respawns.set(ent,next); continue; }
      respawns.delete(ent);
      const ally=livePlayers()[0];
      if(!ally) continue;
      resetPlayer(ent,nearestSafePoint({x:clamp(ally.x+65,60,WORLD_W-100),y:clamp(ally.y+40,60,WORLD_H-60)}),false);
      notify('factions.respawn',body(ent),null,'#66ffaa');
    }
  }

  function updatePickups(dt){
    const injured=livePlayers().filter(ent=>ent.hp<(ent.maxHp||100));
    const radius=(22+19)*setting('cscl',1);
    for(let i=pickups.length-1;i>=0;i--){
      const item=pickups[i];
      item.remaining-=dt;
      if(item.remaining<=0){ pickups.splice(i,1); continue; }
      let target=null, distance=radius;
      for(const ent of injured){
        if(ent.hp>=(ent.maxHp||100)) continue;
        const p=body(ent), d=Math.hypot(p.x-item.x,p.y-item.y);
        if(d<=distance){ target=ent; distance=d; }
      }
      if(!target) continue;
      const amount=Math.min(HEAL,(target.maxHp||100)-target.hp);
      target.hp+=amount;
      pickups.splice(i,1);
      notify('survival.healed',body(target),{amount},'#55ff88');
      $.S.play('pickupSound');
    }
  }

  function updateDrops(dt){
    if(typeof DROPPED_WEAPONS!=='undefined') for(let i=DROPPED_WEAPONS.length-1;i>=0;i--){
      const item=DROPPED_WEAPONS[i], settled=Math.hypot(item.vx||0,item.vy||0)<0.5;
      const age=settled ? (dropAges.get(item)||0)+dt : 0;
      dropAges.set(item,age);
      if(age>=DROP_LIFE) DROPPED_WEAPONS.splice(i,1);
    }
    if(typeof DROPPED_WEAPONS!=='undefined'){
      let excess=DROPPED_WEAPONS.length-MAX_DROPS;
      for(let i=0;excess>0 && i<DROPPED_WEAPONS.length;){
        const item=DROPPED_WEAPONS[i];
        if(Math.hypot(item.vx||0,item.vy||0)<0.5){ DROPPED_WEAPONS.splice(i,1); excess--; }
        else i++;
      }
    }
    if(typeof DROPPED_SHIELDS!=='undefined') for(let i=DROPPED_SHIELDS.length-1;i>=0;i--){
      const item=DROPPED_SHIELDS[i], settled=Math.hypot(item.vx||0,item.vy||0)<0.5;
      const age=settled ? (dropAges.get(item)||0)+dt : 0;
      dropAges.set(item,age);
      if(age>=DROP_LIFE) DROPPED_SHIELDS.splice(i,1);
    }
  }

  function update(dt){
    if(online()){
      if(active) stop(true);
      return;
    }
    if(!active){
      if(ready && FactionRules.getMode()==='survival') start();
      return;
    }
    if(getSlot()!==slotIndex){ newMatch(); return; }
    if([...controls.keys()].some(el=>!el.disabled)) lockControls(true);
    if(!Number.isFinite(dt) || dt<=0 || (typeof gamePaused!=='undefined' && gamePaused) ||
       (typeof uiMenuPaused!=='undefined' && uiMenuPaused)) return;
    if(phase==='result'){
      phaseLeft-=dt;
      if(phaseLeft<=0) newMatch();
      return;
    }
    playerHurtFade=Math.max(0,playerHurtFade-dt*0.9);
    elapsed=Math.min(DURATION,elapsed+dt);
    forceResumeBotsAfterSpawn();
    // Resolve a simultaneous last kill/player death as defeat, before respawns.
    for(const ent of [...roster,...enemies]) if(ent.hp<=0 && !ent._defeated) handleDeath(ent);
    if(!livePlayers().length){ finish('defeat'); return; }
    updateRespawns(dt); updatePickups(dt); updateDrops(dt); updateArenaObjects(dt);
    for(const bot of liveEnemies()){
      if(bot._awaitingReveal && GameTime>=bot._survivalRevealAt+3){
        // Failed sprite downloads must not make the final enemy immortal off-map.
        if(bot._skinImg && !bot._skinImg.complete) bot._skinImg=null;
        revealBotIfReady(bot);
      }
    }
    if(!liveEnemies().length){
      if(phase==='wave'){
        if(!boss) ordinarySinceBoss++;
        if(Math.random()<(roster.length===1?0.75:0.5)) spawnHeal(lastDeathPoint||body(roster[0]));
        phase='intermission'; phaseLeft=GAP;
      } else phaseLeft-=dt;
      if(elapsed>=DURATION){ finish('victory'); return; }
      if(phaseLeft<=0) spawnWave();
    }
    selectMain(); updateHud();
  }

  function damageMultiplier(defender){
    if(!isActive()) return 1;
    if(phase==='result') return 0;
    if(!roster.includes(defender)) return 1;
    return defender.hp<(defender.maxHp||100)*0.5 ? 1/3 : 0.5;
  }

  function lockControls(value){
    for(const id of controlIds){
      const el=document.getElementById(id);
      if(!el) continue;
      if(value){
        if(!controls.has(el)) controls.set(el,{disabled:el.disabled,title:el.title});
        el.disabled=true; el.title=text('survival.locked');
      } else if(controls.has(el)){
        const previous=controls.get(el);
        el.disabled=previous.disabled; el.title=previous.title;
      }
    }
    if(!value) controls.clear();
    document.body.classList.toggle('survival-active',value);
  }

  function start(){
    if(active || online()) return;
    original={bots:ALL_BOTS.slice(),D,AI,dummyOn};
    active=true;
    for(const ent of [P,...original.bots]) cancelEntity(ent);
    newMatch(); lockControls(true);
  }

  function stop(networkTransition=false){
    if(!active) return;
    const wasResult=phase==='result';
    for(const ent of [...roster,...enemies]){
      if(!networkTransition || (ent!==P && ent!==D)) cancelEntity(ent);
    }
    respawns.clear();
    active=false; phase='inactive'; result=null; pickups=[]; arenaObjects=[]; arenaBursts=[]; woodParts=[];
    lockControls(false);
    if(!networkTransition){
      clearTransient(); clearOverlay();
      ALL_BOTS.splice(0,ALL_BOTS.length,...original.bots);
      D=original.D; AI=original.AI; dummyOn=original.dummyOn;
      for(const ent of roster) resetPlayer(ent,null,false);
      if(typeof applyBotCount==='function') applyBotCount();
      bindRoster();
    } else {
      // NET_SYNC reuses D as its remote player; never remove that entity.
      for(let i=ALL_BOTS.length-1;i>=0;i--){
        const ent=ALL_BOTS[i];
        if(ent!==D && (ent._survivalEnemy || ent._survivalReserved)) ALL_BOTS.splice(i,1);
      }
    if(D){
        Object.assign(D,{_survivalEnemy:false,_survivalReserved:false,_survivalBoss:false,
          _bodyScaleMult:1,_damageMult:1,maxHp:100,_awaitingReveal:false,_manualControl:false});
        delete D._survivalRevealAt;
        if(!ALL_BOTS.includes(D)) ALL_BOTS.push(D);
      }
      for(const ent of roster){
        if(ent._respawnTimerId) clearTimeout(ent._respawnTimerId);
        ent._respawnTimerId=0; ent._respawnPending=false; ent._respawnAt=0;
      }
      if(wasResult) clearOverlay();
    }
    enemies=[]; reserved=[]; roster=[]; original=null;
    updateHud();
  }

  function setActive(value){ if(value){ if(ready) start(); } else stop(); }
  function restart(){
    if(!active) return;
    newMatch();
    if(typeof window.doResume==='function') window.doResume();
    else {
      document.body.classList.remove('menu-open');
      if(typeof window._setUiMenuPaused==='function') window._setUiMenuPaused(false);
      if(typeof gamePaused!=='undefined') gamePaused=false;
    }
  }
  function onRosterChange(){ if(active && getSlot()!==slotIndex) newMatch(); lockControls(active); }
  function isActive(){ return active && !online(); }

  function initHud(){
    if(hud.root) return;
    hud.root=document.getElementById('survival-hud');
    hud.timer=document.getElementById('survival-timer');
    hud.wave=document.getElementById('survival-wave');
    if(!hud.root) return;
    hud.status=document.createElement('div'); hud.status.id='survival-status';
    hud.root.appendChild(hud.status);
    const style=document.createElement('style');
    style.textContent='#survival-hud{max-width:18vw;padding:2px 5px;border:1px solid rgba(53,103,131,.55);background:rgba(6,18,28,.62);border-radius:5px;font-variant-numeric:tabular-nums}#survival-timer{font-size:14px;line-height:1;font-weight:800;letter-spacing:1px}#survival-wave{font-size:7px;line-height:1.05;letter-spacing:.4px;margin-top:1px}#survival-status{font-size:7px;color:#b5d2dc;margin-top:1px;line-height:1.05}#survival-hud[data-phase="result"]{opacity:.6}body.menu-open #survival-hud{visibility:hidden}body.survival-active #mob-weapon-btn,body.survival-active #mob-bot-weapon-btn,body.survival-active #mob-bot-shield-btn{opacity:.3}@media(max-width:700px){#survival-hud{top:54px;max-width:42vw;padding:2px 5px}#survival-timer{font-size:12px}#survival-wave{font-size:7px}#survival-status{font-size:7px}}';
    document.head.appendChild(style);
  }

  function put(el,value){ if(el && el.textContent!==value) el.textContent=value; }
  function updateHud(){
    initHud();
    if(!hud.root) return;
    hud.root.classList.toggle('visible',active);
    if(!active) return;
    hud.root.dataset.phase=phase;
    const remaining=Math.ceil(Math.max(0,DURATION-elapsed));
    put(hud.timer,String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'));
    let title=text('survival.wave',{wave})+' · '+text('survival.enemies',{count:liveEnemies().length});
    if(phase==='result') title=text(result==='victory'?'survival.victory':'survival.defeat');
    else if(elapsed>=DURATION) title=text('survival.cleanup');
    else if(phase==='intermission') title=text('survival.intermission',{seconds:Math.ceil(phaseLeft)});
    else if(boss) title=text('survival.boss')+' · '+text('survival.enemies',{count:liveEnemies().length});
    put(hud.wave,title);
    const info=[text('survival.kills',{count:kills})];
    for(const ent of roster){
      if(respawns.has(ent)) info.push(text('survival.respawnIn',{slot:ent===P?1:slotIndex+1,seconds:Math.ceil(respawns.get(ent))}));
    }
    put(hud.status,info.join(' · '));
  }

  function drawPickups(){
    if(!isActive() || phase==='result' || typeof ctx==='undefined') return;
    ctx.save();
    for(const o of arenaObjects){
      ctx.save();ctx.translate(o.x,o.y);
      if(o.type==='spikes'){
        const img=propImage('spikes');
        if(img) drawSpriteCentered(img,CELL);
        else{
          ctx.fillStyle='#5c6268';ctx.strokeStyle='#2f3439';ctx.lineWidth=2/CAM_SCALE;ctx.fillRect(-CELL*.46,-CELL*.46,CELL*.92,CELL*.92);ctx.strokeRect(-CELL*.46,-CELL*.46,CELL*.92,CELL*.92);
          for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){ctx.beginPath();ctx.moveTo(x*15-5,y*15+7);ctx.lineTo(x*15,y*15-9);ctx.lineTo(x*15+5,y*15+7);ctx.closePath();ctx.fillStyle='#b7c0c7';ctx.strokeStyle='#e1e6ea';ctx.fill();ctx.stroke();}
        }
      }else{
        const red=o.type==='redBarrel',img=propImage(o.type==='crate'?'crate':red?'redBarrel':'barrel'),size=OBJECT_RADIUS*2.15;
        if(img){
          drawSpriteCentered(img,size);
        }else{
          ctx.fillStyle=o.type==='crate'?'#89572f':red?'#a8201d':'#765038';ctx.strokeStyle=red?'#ff9b49':'#d2a56c';ctx.lineWidth=3/CAM_SCALE;
          if(o.type==='crate'){ctx.fillRect(-22,-22,44,44);ctx.strokeRect(-22,-22,44,44);ctx.beginPath();ctx.moveTo(-18,-18);ctx.lineTo(18,18);ctx.moveTo(18,-18);ctx.lineTo(-18,18);ctx.stroke();}
          else{ctx.beginPath();ctx.ellipse(0,0,22,25,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=red?'#5c1210':'#3f2d24';ctx.fillRect(-20,-13,40,5);ctx.fillRect(-20,9,40,5);ctx.strokeStyle=red?'#ffb15f':'#c7955f';ctx.beginPath();ctx.ellipse(-18,0,6,23,0,Math.PI*.5,Math.PI*1.5);ctx.stroke();ctx.beginPath();ctx.ellipse(18,0,6,23,0,-Math.PI*.5,Math.PI*.5);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(-8,-20,5,40);}
        }
        if(red&&o.fuse!=null){const p=clamp(o.fuse/RED_FUSE,0,1),pulse=.45+.55*Math.abs(Math.sin(GameTime*(8+(1-p)*15)));ctx.strokeStyle=`rgba(255,225,90,${pulse})`;ctx.lineWidth=4/CAM_SCALE;ctx.beginPath();ctx.arc(0,0,29,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();}
      }
      ctx.restore();
    }
    const woodImg=propImage('woodParts');
    if(woodImg) for(const part of woodParts){
      const f=WOOD_PART_FRAMES[part.frame],fade=clamp((part.life-part.age)/.25,0,1),w=f[2]*WOOD_PART_SCALE,h=f[3]*WOOD_PART_SCALE;
      ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);ctx.globalAlpha=fade;ctx.drawImage(woodImg,f[0],f[1],f[2],f[3],-w*.5,-h*.5,w,h);ctx.restore();
    }
    ctx.globalAlpha=1;
    for(const b of arenaBursts){
      const p=b.age/b.life,img=propImage('explosion'),size=EXPLOSION_RADIUS*2*Math.min(1,.35+p*1.65);
      ctx.save();ctx.translate(b.x,b.y);ctx.globalAlpha=1-p;
      if(img) drawSpriteCentered(img,size);
      else{ctx.fillStyle='rgba(255,104,31,.28)';ctx.strokeStyle='#ffd15a';ctx.lineWidth=(8*(1-p)+2)/CAM_SCALE;ctx.beginPath();ctx.arc(0,0,EXPLOSION_RADIUS*Math.min(1,p*2.5),0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.restore();
    }
    ctx.globalAlpha=1;
    for(const item of pickups){
      ctx.save(); ctx.translate(item.x,item.y);
      ctx.globalAlpha=item.remaining<3 ? 0.45+0.55*Math.abs(Math.sin(item.remaining*7)) : 1;
      const img=propImage('potion');
      if(img) drawSpriteCentered(img,38);
      else{
        ctx.fillStyle='rgba(26,90,47,.65)'; ctx.strokeStyle='#b4ffcf'; ctx.lineWidth=2/CAM_SCALE;
        ctx.beginPath(); ctx.arc(0,0,19,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0,0,19,-Math.PI/2,-Math.PI/2+Math.PI*2*item.remaining/HEAL_LIFE); ctx.stroke();
        ctx.fillStyle='#62ff99'; ctx.fillRect(-11,-4,22,8); ctx.fillRect(-4,-11,8,22);
      }
      ctx.restore();
    }
    for(const bot of liveEnemies()){
      if(!bot._awaitingReveal) continue;
      const scale=bot._bodyScaleMult||1,img=propImage('spawnRune'),size=78*scale;
      ctx.save();ctx.translate(bot._pendingSpawnX,bot._pendingSpawnY);ctx.globalAlpha=.72+.22*Math.sin(GameTime*7);
      if(img){
        ctx.rotate(GameTime*.7);drawSpriteCentered(img,size);
      }else{
        ctx.strokeStyle=bot._survivalBoss?'#ff7744':'#ffcb66'; ctx.lineWidth=2/CAM_SCALE;
        ctx.beginPath(); ctx.arc(0,0,26*scale,0,Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }
    if(playerHurtFade>0){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=Math.min(.28,playerHurtFade);ctx.fillStyle='#d01818';ctx.fillRect(0,0,W,H);ctx.restore();
    }
    ctx.restore();
  }

  function getState(){
    return {phase,elapsed,wave,remaining:Math.max(0,DURATION-elapsed),boss,enemyCount:liveEnemies().length,
      ordinarySinceBoss,kills,result,pickups:pickups.map(p=>({...p})),arenaObjects:arenaObjects.map(o=>({type:o.type,x:o.x,y:o.y,vx:o.vx,vy:o.vy,fuse:o.fuse,moving:o.moving})),
      respawns:[...respawns].map(([ent,remaining])=>({slot:ent===P?0:slotIndex,remaining})),
      droppedWeapons:typeof DROPPED_WEAPONS!=='undefined'?DROPPED_WEAPONS.length:0,
      droppedShields:typeof DROPPED_SHIELDS!=='undefined'?DROPPED_SHIELDS.length:0};
  }

  // Capture before gameplay handlers, but preserve typing in menus.
  window.addEventListener('keydown',event=>{
    if(!isActive()) return;
    const el=event.target;
    if(el && (el.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName))) return;
    const codes=['KeyC','KeyV','KeyY'];
    const keys=['c','с','v','м','y','н'];
    if(codes.includes(event.code) || keys.includes(String(event.key).toLowerCase())){
      event.preventDefault(); event.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('DOMContentLoaded',()=>{ ready=true; initHud(); });
  window.SurvivalMode={update,drawPickups,handleDeath,setActive,restart,onRoundReset(){ if(active) newMatch(); },
    onRosterChange,isActive,damageMultiplier,getState,adjustAI,isSafeSpawn:safePoint,tryThrowObject,projectileHitObject,segmentHitObject};
})();
