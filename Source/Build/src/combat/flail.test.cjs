// Run: node src/combat/flail.test.cjs (no browser, assets, network, or build required).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const source=fs.readFileSync(__dirname+'/flail.js','utf8');
const combat=fs.readFileSync(__dirname+'/combat.js','utf8');
const damageSource=combat.slice(combat.indexOf('function applyFlailLungeDamage('));
function entity(x,y,key='flail'){
 return {x,y,key,hp:100,stamina:100,stamMax:100,rage:100,angle:0,vel:4,bx:0,by:0,pvX:0,pvY:0,hasWeapon:true,vx:0,vy:0,_hitCD:-1};
}
function world(){
 const p=entity(300,300),d=entity(500,300,'sword'),settings={swthresh:2,swlen:1,cscl:1,botscale:1,botswordscale:1,lmbdmg:1};
 const sent=[],sounds=[];
 const c={console,Date,Math:Object.create(Math),P:p,D:d,ALL_BOTS:[d],dummyOn:true,GameTime:0,SWORD_LEN:85,
  WORLD_W:2000,WORLD_H:1000,BOXES:[],boxesOn:false,BLADE_W:4,SWORD_HILT_OFFSET:0.2,
  CAM_SCALE:1,CAM_X:0,CAM_Y:0,AI:{},mDown:false,DISBALANCE_RECOIL_DURATION:.3,
  startBuff:(e,id,recoil,slow)=>{e.testBuff={id,duration:recoil+slow};},
  sv:k=>settings[k]??1,isBot:e=>e!==p,weaponKeyOf:e=>e.key,effSwordScale:()=>1,isExhausted:e=>e.stamina<=0 || !!e.exhausted,isUnbalanced:e=>!!e.unbalanced,
  drainStamina:(e,n)=>{e.stamina=Math.max(0,e.stamina-n);},applyExhaust:e=>{e.exhausted=true;},
  weaponLenFor:e=>85*(.4+2.68*(e._flailExt||0)),weaponColliderSpan:()=>({front:85,back:0}),
  weaponCollisionType:e=>e.hasWeapon?'blade':'none',isWeaponDisabled:e=>!e.hasWeapon,
  shieldHeld:e=>!!e.shield,shieldCenter:e=>({x:e.x-20,y:e.y}),
  applyShieldBlockFX:()=>{},shieldDef:()=>null,shieldSameSideAsSword:()=>false,
  weaponCutMult:()=>1,applyCutSwingPenalty:(_,v)=>v,damageSoundForWeapon:()=>'',aiNotifyContact:()=>{},
  blockClashSoundFor:()=>'',FactionRules:{canDamage:(a,b)=>a!==b},NET_SYNC:{active:false},
  applyDamage:(e,dmg)=>{e.hp=Math.max(0,e.hp-dmg);e._hitCD=c.GameTime+.4;},
  $:{M:{clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),angDiff:(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),angLerpDT:(a,b)=>b},
     POS:{pivot:e=>({x:e.x,y:e.y}),body:e=>({x:e.x,y:e.y})},S:{play:name=>sounds.push(name)},FX:{hit:()=>{}},NET:{send:m=>sent.push(m)}},
 };
 vm.createContext(c);vm.runInContext(source+'\n'+damageSource,c);c.sent=sent;c.sounds=sounds;
 c.tick=(n=1)=>{for(let i=0;i<n;i++){c.GameTime+=1/120;c.updateFlailCombat(1/120);}};
 return c;
}
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('inclusive rage threshold, single debit and held input',()=>{
 const c=world();c.P.rage=49.99;c.flailInput(c.P,true,0);assert(!c.P._flailAttack);
 c.flailInput(c.P,false,0);c.P.rage=50;c.flailInput(c.P,true,0);assert.equal(c.P.rage,0);
 const id=c.P._flailAttack.id;c.flailInput(c.P,true,0);assert.equal(c.P._flailAttack.id,id);assert.equal(c.P.rage,0);
});
test('mobile stick lunge requires fifty rage but does not spend it',()=>{
 const c=world();c.P.rage=49.99;assert.equal(c.tryMobileFlailLunge(c.P,0),false);assert(!c.P._flailAttack);
 c.P.rage=50;assert.equal(c.tryMobileFlailLunge(c.P,0),true);assert(c.P._flailAttack);assert.equal(c.P.rage,50);
});
test('unarmed/exhausted cannot launch',()=>{
 const c=world();c.P.hasWeapon=false;c.flailInput(c.P,true,0);assert(!c.P._flailAttack);
 c.flailInput(c.P,false,0);c.P.hasWeapon=true;c.P.stamina=0;c.flailInput(c.P,true,0);assert(!c.P._flailAttack);
});
test('outbound reach and automatic miss return',()=>{
 const c=world();c.D.x=1500;c.flailInput(c.P,true,0);let max=0;
 for(let i=0;i<150;i++){c.tick();if(c.P._flailAttack)max=Math.max(max,c.P._flailAttack.x-c.P.x);}
 assert(Math.abs(max-85*3.08*1.5)<1e-6);assert(!c.P._flailAttack);assert.equal(c.P.rage,50);
});
test('hit does normal damage once and pulls to sword distance',()=>{
 const c=world();c.D.hasWeapon=false;c.flailInput(c.P,true,0);c.tick(130);
 assert.equal(c.D.hp,79);assert.equal(c.D.testBuff.id,'DISBALANCE');assert.equal(c.D.testBuff.duration,1.5);assert(Math.abs(c.D.x-c.P.x-85)<.01);assert(!c.P._flailAttack);
});
test('nearby victim is not pushed away',()=>{
 const c=world();c.D.hasWeapon=false;c.D.x=355;c.flailInput(c.P,true,0);c.tick(130);assert.equal(c.D.x,355);
});
test('first obstacle prevents a victim hit',()=>{
 const c=world();c.D.hasWeapon=false;c.boxesOn=true;c.BOXES.push({x:390,y:270,w:10,h:60});
 c.flailInput(c.P,true,0);c.tick(130);assert.equal(c.D.hp,100);assert.equal(c.D.x,500);
});
test('raised shield blocks damage and pulls halfway with disbalance',()=>{
 const c=world();c.D.shield=1;c.D.hasWeapon=false;c.flailInput(c.P,true,0);c.tick(130);
 assert.equal(c.D.hp,100);assert.equal(c.D.testBuff.id,'DISBALANCE');assert(Math.abs(c.D.x-c.P.x-142.5)<.01);
});
test('weapon block succeeds with roll below 50 percent',()=>{
 const c=world();c.D.angle=Math.PI;c.Math.random=()=>.49;c.flailInput(c.P,true,0);c.tick(130);
 assert.equal(c.D.hp,100);assert.equal(c.D.testBuff.id,'DISBALANCE');assert(Math.abs(c.D.x-c.P.x-142.5)<.01);
});
test('failed weapon block rolls only once, then hits',()=>{
 const c=world();c.D.angle=Math.PI;let rolls=0;c.Math.random=()=>{rolls++;return .5;};
 c.flailInput(c.P,true,0);c.tick(130);assert.equal(rolls,1);assert.equal(c.D.hp,79);
});
test('first victim only',()=>{
 const c=world();c.D.hasWeapon=false;const e=entity(540,300,'sword');e.hasWeapon=false;c.ALL_BOTS.push(e);
 c.flailInput(c.P,true,0);c.tick(130);assert.equal(c.D.hp,79);assert.equal(e.hp,100);
});
test('swept head catches a thin wall at high speed',()=>{
 const c=world();assert.equal(c.flailRectHit(0,0,1000,0,50,-10,1,20,0),.05);
 assert(c.flailCircleHit(0,0,1000,0,500,0,14)<.5);
});
test('pull stops before a newly introduced wall',()=>{
 const c=world();c.D.hasWeapon=false;c.flailInput(c.P,true,0);
 while(!c.D._flailPull)c.tick();
 c.boxesOn=true;c.BOXES.push({x:430,y:270,w:10,h:60});c.tick(130);
 assert(c.D.x>=454-.01);assert(!c.D._flailPull);
});
test('owner cancellation releases victim',()=>{
 const c=world();c.D.hasWeapon=false;c.flailInput(c.P,true,0);while(!c.D._flailPull)c.tick();
 c.resetFlailCombat(c.P);const x=c.D.x;c.tick(40);assert.equal(c.D.x,x);assert(!c.D._flailPull);
});
test('remote attacker never damages locally',()=>{
 const c=world();c.NET_SYNC.active=true;c.D.key='flail';c.flailInput(c.D,true,Math.PI);assert(!c.D._flailAttack);
});
test('online hit is sent once and remote position is not locally pulled',()=>{
 const c=world();c.NET_SYNC.active=true;c.D.hasWeapon=false;c.flailInput(c.P,true,0);c.tick(130);
 assert.equal(c.sent.filter(m=>m.type==='flailHit').length,1);assert.equal(c.D.x,500);
});
test('online shield block sends zero damage and half pull intent',()=>{
 const c=world();c.NET_SYNC.active=true;c.D.shield=1;c.D.hasWeapon=false;c.flailInput(c.P,true,0);c.tick(130);
 const msg=c.sent.find(m=>m.type==='flailHit');assert(msg);assert.equal(msg.dmg,0);assert.equal(msg.pullHalf,true);assert.equal(c.D.hp,100);assert.equal(c.D.x,500);
});
test('fixed node count and finite physics over spin/reversal/teleport',()=>{
 const c=world();
 for(let i=0;i<1200;i++){
  c.P.angle=Math.sin(i/30)*5;c.P.vel=Math.cos(i/30)*7.5;c.P._flailExt=(1+Math.sin(i/60))/2;
  if(i===600)c.P.x+=800;c.tick();assert.equal(c.P._flailNodes.length,17);
  for(const n of c.P._flailNodes)assert([n.x,n.y,n.px,n.py].every(Number.isFinite));
 }
});
test('spin growth retained and angular speed at 70 percent',()=>{
 const c=world();Object.assign(c.P,{_flailState:'SPIN',_flailExt:.5,_flailDirection:1,_flailSpinSpeed:4,_flailFreeAngle:0,_flailPrevAngle:0,_flailPrevCursorAngle:0,_flailAccumAngle:1,_flailAccumDir:1});
 c.updateFlailSwing(c.P,.05,.01);assert(Math.abs(c.P._flailExt-.502)<1e-9);assert(Math.abs(c.P.vel-8.4)<1e-9);
});
test('second local player uses the same lunge and rage cost',()=>{
 const c=world();c.D.key='flail';c.P.hasWeapon=false;c.flailInput(c.D,true,Math.PI);c.tick(130);
 assert.equal(c.D.rage,50);assert.equal(c.P.hp,79);assert(Math.abs(c.D.x-c.P.x-85)<.01);
});
test('death clears the attack and victim pull',()=>{
 const c=world();c.D.hasWeapon=false;c.flailInput(c.P,true,0);while(!c.D._flailPull)c.tick();
 c.P.hp=0;c.tick();assert(!c.P._flailAttack);assert(!c.D._flailPull);
});
test('visible chain reverses its rotational bend at half amplitude',()=>{
 for(const direction of [-1,1]){
  const c=world();c.P._flailExt=1;
  for(let i=0;i<240;i++){
   c.P.angle+=direction*12/120;c.P.vel=direction*12;c.updateFlailChain(c.P,1/120);
   if(i>0)for(let j=1;j<c.P._flailNodes.length-1;j++){
    const n=c.P._flailNodes[j],drawn=c.P._flailDrawNodes[j];
    const side=-(n.x-c.P.x)*Math.sin(c.P.angle)+(n.y-c.P.y)*Math.cos(c.P.angle);
    const visualSide=-(drawn.x-c.P.x)*Math.sin(c.P.angle)+(drawn.y-c.P.y)*Math.cos(c.P.angle);
    assert(visualSide*direction>-1e-7);
    assert(Math.abs(visualSide+side*.5)<1e-7);
   }
  }
 }
 const c=world();c.P._flailExt=1;
 for(let i=0;i<240;i++)c.updateFlailChain(c.P,1/120);
 assert(c.P._flailDrawNodes[8].y>c.P.y);
 assert(Math.abs((c.P._flailDrawNodes[8].y-c.P.y)*2-(c.P._flailNodes[8].y-c.P.y))<1e-7);
});
test('real DISBALANCE buff lasts 1.5 seconds on pull',()=>{
 const c=world();c.window={};c.spawnFloatingText=()=>{};
 vm.runInContext(fs.readFileSync(__dirname+'/../systems/buff.js','utf8'),c);
 c.P._flailAttack={id:1};c.startFlailPull(c.D,c.P,1);
 c.updateBuffs(c.D,0);
 assert(c.isUnbalanced(c.D));assert.equal(c.getMod(c.D,'moveSlow',1),.3);
 for(let i=0;i<149;i++){c.GameTime+=.01;c.updateBuffs(c.D,.01);}
 assert(c.isUnbalanced(c.D));
 for(let i=0;i<3;i++){c.GameTime+=.01;c.updateBuffs(c.D,.01);}
 assert(!c.isUnbalanced(c.D));assert.equal(c.getMod(c.D,'moveSlow',1),1);
});
// Execute the real network receive functions in a separate VM, with activation exposed only in this harness.
function networkWorld(){
 const c=world();c.NET_CORE={getPing:()=>80};c.setShield=(e,s)=>e.shield=s;c.playSound=()=>{};c.triggerDeath=()=>{};
 const net=fs.readFileSync(__dirname+'/../network/net-sync.js','utf8').replace(
 'return { onConnected,onDisconnected,onState,onHit,onFlailHit',
 'return { _testActivate(){_active=true;}, _testPacket:buildDelta, onConnected,onDisconnected,onState,onHit,onFlailHit');
 vm.runInContext(net,c);c.NET_SYNC._testActivate();return c;
}
test('network hit deduplication and owner-side pull',()=>{
 const c=networkWorld();c.D.key='flail';c.P.x=500;c.D.x=300;
 const m={id:100,newHp:80,dmg:20};c.NET_SYNC.onFlailHit(m);assert(c.P._flailPull);assert.equal(c.P.testBuff.id,'DISBALANCE');assert.equal(c.P.testBuff.duration,1.5);
 c.P.hp=70;c.NET_SYNC.onFlailHit(m);assert.equal(c.P.hp,70);
 c.tick(60);assert(Math.abs(c.P.x-c.D.x-85)<.01);
});
test('network state includes reach extension, phase and head but no nodes',()=>{
 const c=networkWorld();c.P._flailExt=.7;c.flailInput(c.P,true,0);
 const packet=c.NET_SYNC._testPacket(c.P);assert.equal(packet.fe,700);assert.equal(packet.fa.p,1);assert(!JSON.stringify(packet).includes('nodes'));
 c.NET_SYNC.onState(packet);assert.equal(c.D._flailExt,.7);assert.equal(c.D._flailAttack.id,c.P._flailAttack.id);
});
test('stale state cannot resurrect a finished lunge',()=>{
 const c=networkWorld();c.D.key='flail';
 c.NET_SYNC.onState({t:'s',fq:2,fa:null});
 c.NET_SYNC.onState({t:'s',fq:1,fa:{id:8,p:1,x:.2,y:.3,a:0}});assert(!c.D._flailAttack);
 c.NET_SYNC.onFlailCancel({id:8});
 c.NET_SYNC.onState({t:'s',fq:3,fa:{id:8,p:2,x:.2,y:.3,a:0}});assert(!c.D._flailAttack);
 c.NET_SYNC.onFlailHit({id:8,newHp:80,dmg:20});assert.equal(c.P.hp,100);
});
test('flail flick detects out/back/out even with a short chain',()=>{
 const c=world();c.P._flailState='FOLLOW';c.P._flailExt=.25;c.P._flailPrevCursorAngle=0;
 for(const aim of [.1,.2,.3,.2,.1,0,.1,.2]){c.GameTime+=.02;c.updateFlailSwing(c.P,aim,.02);}
 assert(c.P._flailFoldLocked);assert.equal(c.P._flailState,'RETRACT');assert(c.P._flailExt>0);
});
test('flick ignores jitter, a single reversal and steady rotation',()=>{
 for(const deltas of [[.1,.1,.1,-.1,-.1,-.1],Array(40).fill(.1),Array.from({length:30},(_,i)=>i%2?.03:-.03)]){
  const c=world();for(const delta of deltas)assert(!c.detectFlailFlick(c.P,delta,.02));
 }
});
test('flick window expires between slow-separated strokes',()=>{
 const c=world();for(const d of [.1,.1,.1,-.1,-.1,-.1])c.detectFlailFlick(c.P,d,.02);
 c.detectFlailFlick(c.P,0,.8);assert(!c.detectFlailFlick(c.P,.2,.02));
});
test('forced fold preserves momentum and blocks aim/LMB until fully folded',()=>{
 const c=world();Object.assign(c.P,{_flailState:'SPIN',_flailExt:.9,vel:8.4,_flailDirection:1,_flailSpinSpeed:4});
 c.beginFlailFold(c.P);const start=c.P.angle;
 c.updateFlailSwing(c.P,Math.PI,.01);assert(Math.abs(c.P.angle-start-.084)<1e-8);assert(c.P._flailExt>.8);
 c.flailInput(c.P,true,0);assert(!c.P._flailAttack);assert.equal(c.P.rage,100);
 for(let i=0;i<150;i++){c.GameTime+=.01;c.updateFlailSwing(c.P,-i*.1,.01);if(!c.P._flailFoldLocked)break;}
 assert.equal(c.P._flailExt,0);assert(!c.P._flailFoldLocked);
});
test('exhaustion and disbalance keep control locked after folding',()=>{
 for(const status of ['exhausted','unbalanced']){
  const c=world();Object.assign(c.P,{_flailState:'SPIN',_flailExt:.6,vel:8.4,[status]:true});
  for(let i=0;i<100;i++)c.updateFlailSwing(c.P,i*.1,.01);
  assert.equal(c.P._flailExt,0);assert(c.P._flailFoldLocked);
  c.P[status]=false;c.updateFlailSwing(c.P,0,.01);assert(!c.P._flailFoldLocked);
 }
});
test('each complete revolution costs fifteen at any extension, including inertia',()=>{
 for(const ext of [0,.25,.5,1])for(const phase of ['FOLLOW','SPIN','RETRACT']){
  const c=world();Object.assign(c.P,{_flailExt:ext,_flailState:phase});c.updateFlailTurns(c.P);
  for(let i=0;i<240;i++){c.P.angle+=Math.PI/60;c.updateFlailTurns(c.P);}
  assert.equal(c.P.stamina,70);assert.equal(c.sounds.filter(s=>s==='hammerSwing').length,2);
 }
});
test('partial reversals and lunge do not count as full revolutions',()=>{
 const c=world();c.updateFlailTurns(c.P);
 for(let i=0;i<100;i++){c.P.angle+=(i%2?-.1:.1);c.updateFlailTurns(c.P);}
 c.P._flailAttack={};for(let i=0;i<100;i++){c.P.angle+=.1;c.updateFlailTurns(c.P);}
 assert.equal(c.P.stamina,100);assert.equal(c.sounds.length,0);
});
test('last fifteen stamina trigger exhaustion and locked fold',()=>{
 const c=world();c.isExhausted=e=>!!e.exhausted;c.P.stamina=15;c.P._flailExt=.8;c.updateFlailTurns(c.P);
 for(let i=0;i<120;i++){c.P.angle+=Math.PI/60;c.updateFlailTurns(c.P);}
 assert.equal(c.P.stamina,0);assert(c.P.exhausted);assert(c.P._flailFoldLocked);
});
test('network turn counter plays sound once without remote stamina debit',()=>{
 const c=networkWorld();c.D.key='flail';c.D.stamina=100;
 c.NET_SYNC.onState({t:'s',fq:1,ft:0,fl:0,fa:null});
 c.NET_SYNC.onState({t:'s',fq:2,ft:1,fl:1,fa:null});
 c.NET_SYNC.onState({t:'s',fq:2,ft:1,fl:1,fa:null});
 c.NET_SYNC.onState({t:'s',fq:1,ft:0,fl:0,fa:null});
 assert.equal(c.sounds.filter(s=>s==='hammerSwing').length,1);assert.equal(c.D.stamina,100);assert(c.D._flailFoldLocked);
});
test('status interrupts a lunge by returning, without teleporting its head',()=>{
 const c=world();c.D.x=1500;c.flailInput(c.P,true,0);c.tick(5);
 const x=c.P._flailAttack.x;c.P.unbalanced=true;c.updateFlailSwing(c.P,0,.01);
 assert.equal(c.P._flailAttack.phase,'back');assert.equal(c.P._flailAttack.x,x);assert(c.P._flailFoldLocked);
});
test('remote status cancellation releases pull but preserves the return animation',()=>{
 const c=networkWorld();c.D.key='flail';c.D._flailAttack={id:10,phase:'out',x:400,y:300};
 c.P._flailPull={owner:c.D,id:10};c.NET_SYNC.onFlailCancel({id:10,retract:true});
 assert(!c.P._flailPull);assert.equal(c.D._flailAttack.phase,'back');
 c.NET_SYNC.onFlailHit({id:10,newHp:80,dmg:20});assert.equal(c.P.hp,100);
});
test('idle time does not consume the upcoming flick window',()=>{
 const c=world();c.detectFlailFlick(c.P,0,.6);
 let detected=false;for(const d of [.1,.1,.1,-.1,-.1,-.1,.1,.1])detected=c.detectFlailFlick(c.P,d,.03)||detected;
 assert(detected);
});
test('disbalance recoil does not reverse existing chain momentum',()=>{
 const c=world();Object.assign(c.P,{_flailState:'SPIN',_flailExt:.8,_flailSpinSpeed:4,_flailDirection:1,vel:-12,unbalanced:true});
 c.updateFlailSwing(c.P,Math.PI,.01);assert(Math.abs(c.P.angle-.084)<1e-9);assert(c.P._flailFoldLocked);
});
test('axe AI aim controls the sweep instead of an independent circular target',()=>{
 const c=world();Object.assign(c.D,{key:'flail',_flailState:'SPIN',_flailExt:.5,_flailSpinSpeed:4,_flailDirection:1,_flailPrevAngle:0,_flailPrevCursorAngle:0});
 c.updateFlailSwing(c.D,.5,.01,true);assert(Math.abs(c.D.angle-.112)<1e-9);assert.equal(c.D._flailState,'AXE_SWING');
 c.updateFlailSwing(c.D,-.5,.01,true);assert(Math.abs(c.D.angle)<1e-9);
 c.updateFlailSwing(c.D,.5,.01,true);assert(c.D._flailFoldLocked);
});
test('flail hook helper performs a single rage-gated lunge',()=>{
 const c=world();c.flailTryHook(c.P,0);assert(c.P._flailAttack);assert.equal(c.P.rage,50);assert.equal(c.P._flailPress,false);
 c.flailTryHook(c.P,0);assert.equal(c.P.rage,50);
});
test('bot flail resume sets a three second direction lock',()=>{
 const c=world();Object.assign(c.D,{key:'flail',_flailState:'RETRACT',_flailExt:.5,_flailSpinSpeed:2,_flailDirection:-1,_flailAccumAngle:1,_flailAccumDir:1,_flailPrevCursorAngle:0});
 c.GameTime=10;c.updateFlailSwing(c.D,.2,.02,false);assert.equal(c.D._flailState,'SPIN');assert.equal(c.D._flailDirection,1);assert.equal(c.D._flailDirectionLockUntil,13);
});
test('bot direct flail buildup is half speed',()=>{
 const c=world();Object.assign(c.D,{key:'flail',_flailState:'FOLLOW',_flailExt:0,_flailPrevCursorAngle:0,_flailAccumAngle:1,_flailAccumDir:1});
 c.updateFlailSwing(c.D,.2,.1,true);assert(Math.abs(c.D._flailExt-.05)<1e-9);
});
const c=world();const chains=Array.from({length:32},(_,i)=>entity(200+i*15,400));
let start=performance.now();
for(let step=0;step<600;step++)for(const e of chains){e.angle+=.05;e._flailExt=1;c.updateFlailChain(e,1/120);}
console.log(`${passed} tests passed. 32-chain physics: ${((performance.now()-start)/600).toFixed(2)} ms/tick (Node, excludes rendering).`);
