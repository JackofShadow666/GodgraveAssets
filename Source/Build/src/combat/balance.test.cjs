// Run: node src/combat/balance.test.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(__dirname+'/'+p,'utf8');
const weapons=read('weapons.js'),ranged=read('ranged.js'),combat=read('combat.js'),buff=read('../systems/buff.js');
function fn(source,name){
 const marker='function '+name+'(',at=source.indexOf(marker);
 assert(at>=0,name);const start=source.slice(at-6,at)==='async '?at-6:at;
 for(let end=source.indexOf('}',at);end>=0;end=source.indexOf('}',end+1)){
  const text=source.slice(start,end+1);try{new vm.Script('('+text+')');return text;}catch{}
 }
 throw Error(name);
}
function actor(x,key='sword'){return {x,y:100,key,hp:100,stamina:100,stamMax:100,stamRegen:28,angle:0,vel:0,vx:0,vy:0,hasWeapon:true,weaponType:0,_aiState:{enabled:false},rage:0};}
function world(){
 const p=actor(100),d=actor(200),sent=[],sounds=[];
 const c={console,Date,Math:Object.create(Math),P:p,D:d,ALL_BOTS:[d],PROJECTILES:[],WAND_PARTICLES:[],DROPPED_WEAPONS:[],DODGE_TRAIL:[],window:{_dodgeCooldownMob:0,IS_MOBILE:false},
  GameTime:0,rawDt:.1,mX:200,mY:100,MAX_HP:100,WORLD_W:2000,WORLD_H:1000,CELL_PX:55,SWORD_LEN:85,CROSSBOW_PROJ_SPEED:25,CROSSBOW_MAX_DMG_PCT:1,WAND_MAX_DMG_PCT:1,WAND_BASE_DMG:20,WAND_SHOT_CD:1,PROJECTILE_DODGE_CHANCE:0,
  weaponKeyOf:e=>e?.key,weaponDefFor:e=>({key:e?.key,dmgBase:10}),weaponReach:()=>85,weaponStaminaMult:()=>1,weaponCollisionType:()=> 'full',isBot:()=>false,
  isExhausted:e=>!!e.exhausted,isUnbalanced:e=>!!e.unbalanced,applyExhaust:e=>e.exhausted=true,
  drainStamina:(e,n)=>e.stamina=Math.max(0,e.stamina-n),shieldHeld:e=>!!e.shield,shieldDef:()=>null,
  sv:k=>k==='bodyKB'?10:k==='deflectMin'?5:k==='bladeKB'?8:k==='blockSlowDur'?0.2:1,randSpin:()=>0,droppedWeaponPixelLen:()=>85,
  NET_SYNC:{active:false},NET_CORE:{getPing:()=>0},flailRemote:()=>false,
  applyShieldBlockFX:()=>{},applyBlockBodyTilt:()=>{},getDynamicDeflectMax:()=>45,spawnWandExplosion:()=>{},spawnArrowShatter:()=>{},spawnLightningHit:()=>{},spawnMagicStaffGlow:()=>{},spawnMagicStaffParticles:()=>{},fadeOutSound:()=>{},playControllableSound:()=>({}),clearBowTensionFX:()=>{},clearMagicStaffFX:()=>{},clashRageGain:()=>1,addRage:()=>{},applyDebuff:(e,t,d)=>{e.debuff=t;e.debuffDuration=d;},applyInterruptingKnockback:(e,x,y,p)=>{e.vx=(e.vx||0)+x*p;e.vy=(e.vy||0)+y*p;},
  FactionRules:{canDamage:(a,b)=>a!==b,contact:()=>{},getBotTarget:()=>p},
  rf:()=>10,randRange:()=>3,getMod:(_e,_k,v)=>v,wandChargeTimeFor:()=>.5,updateRangedWeaponFire:()=>{},
  spawnProjectile:(e,k,a,d)=>c.PROJECTILES.push({owner:e,kind:k,angle:a,dmg:d}),
  setWandChargeSound:()=>{},setWandBarrierLoop:()=>{},updateWandFlickChoice:()=>{},
  $:{M:{step:dt=>dt*120,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),decay:v=>v,lerpDT:(v,t)=>t,angDiff:(a,b)=>{let d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;}},POS:{body:e=>({x:e.x,y:e.y}),pivot:e=>({x:e.x,y:e.y}),root:()=>({x:p.x,y:p.y}),tip:e=>({x:e.x+85,y:e.y})},FX:{hit:()=>{}},S:{play:s=>sounds.push(s)},NET:{send:m=>sent.push(m)}},
 };
 vm.createContext(c);
 const begin=weapons.indexOf('const WEAPON_TYPES = [');vm.runInContext(weapons.slice(begin,weapons.indexOf('];',begin)+2),c);
 for(const name of ['weaponDamageMultiplier','spendDodgeStamina','cancelRangedCharge','disarmEntity'])vm.runInContext(fn(weapons,name),c);
 vm.runInContext(fn(combat,'applyProjectileBladeClash'),c);
 vm.runInContext(fn(buff,'regenStamina'),c);
 for(const name of ['wandVisualTip','updateWandChargeParticles','updateWandParticles','wandProjectileFrame','applyDamage','wandBarrierHeld','wandBarrierGeometry','wandBarrierContains','wandBarrierSegmentIntersects','performWandElectricAttack','updateRangedWeaponFire','canResolveProjectileContact','thrownWeaponDisbalanceDuration','applyProjectileContactEffects','applyProjectileEffectToEntity','projectileDodgeChanceFor','updateProjectiles','setWandBotAim','updateWandBotAI'])vm.runInContext(fn(ranged,name),c);
 vm.runInContext('let projectileContactSerial=1;',c);c.sent=sent;c.sounds=sounds;return c;
}
let count=0;async function test(name,f){await f();count++;console.log('PASS '+name);}
(async()=>{
await test('flail damage halves after minimum and maximum damage',()=>{
 for(const damage of [20,42,200]){const c=world();c.P.key='flail';c.applyDamage(c.D,damage,c.P,{knockbackMult:0,playSound:false});assert.equal(100-c.D.hp,Math.round(Math.min(damage,70)*.5));}
});
await test('projectile damage is not halved by a later weapon swap',()=>{
 const c=world();c.P.key='flail';c.applyDamage(c.D,40,c.P,{isProjectile:true,playSound:false});assert.equal(c.D.hp,60);
});
await test('thrown flail keeps its damage balance after owner weapon swap',()=>{
 const c=world();c.applyDamage(c.D,40,c.P,{weaponDamageKey:'flail',playSound:false});assert.equal(c.D.hp,80);
});
await test('magic and thrown projectiles charge blocker, reflect, and do not charge shooter',()=>{
 for(const kind of ['wand','bolt','orb']){
  const c=world();c.Math.random=()=>.9;c.PROJECTILES.push({kind,owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
  c.updateProjectiles(0);assert.equal(c.D.stamina,70);assert.equal(c.P.stamina,100);assert.equal(c.PROJECTILES.length,1);assert.equal(c.PROJECTILES[0].vx,-7);
  assert.notEqual(c.D.angle,0);assert.equal(c.D._moveLockUntil,.35);assert.equal(c.D._blockSlow,.2);assert.equal(c.D._swingBlockCD,.25);
  c.updateProjectiles(0);assert.equal(c.D.stamina,70);
 }
});
await test('arrow projectiles charge blocker and shatter instead of reflecting',()=>{
 const c=world();c.Math.random=()=>.9;c.PROJECTILES.push({kind:'arrow',owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
 c.updateProjectiles(0);assert.equal(c.D.stamina,70);assert.equal(c.P.stamina,100);assert.equal(c.PROJECTILES.length,0);
 assert.notEqual(c.D.angle,0);assert.equal(c.D._moveLockUntil,.35);assert.equal(c.D._blockSlow,.2);assert.equal(c.D._swingBlockCD,.25);
});
await test('wand uses radius 12 against blades and radius 30 against bodies',()=>{
 const blade=world();blade.PROJECTILES.push({kind:'wand',owner:blade.P,ownerImmuneUntil:10,x:250,y:113,vx:0,vy:0,rot:0,dmg:20,bornAt:0});
 blade.updateProjectiles(0);assert.equal(blade.D.stamina,100);assert.equal(blade.D.hp,100);assert.equal(blade.PROJECTILES.length,1);
 const body=world();body.D.hasWeapon=false;body.PROJECTILES.push({kind:'wand',owner:body.P,ownerImmuneUntil:10,x:229,y:100,vx:0,vy:0,rot:0,dmg:20,bornAt:0});
 body.updateProjectiles(0);assert.equal(body.D.hp,80);assert.equal(body.PROJECTILES.length,0);
});
await test('reflected projectile slows, shrinks, expires, and may hit its original owner',()=>{
 const c=world();c.Math.random=()=>.9;c.PROJECTILES.push({kind:'wand',owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
 c.updateProjectiles(0);const w=c.PROJECTILES[0];assert(c.canResolveProjectileContact(w,c.P));
 c.GameTime=.15;c.updateProjectiles(.15);assert(Math.hypot(w.vx,w.vy)<7);assert.equal(w._reflectedScale,.5);
 c.GameTime=.3;c.updateProjectiles(.15);assert.equal(c.PROJECTILES.length,0);
});
await test('thirty percent reflection branch turns projectile sideways',()=>{
 const c=world();c.Math.random=()=>.2;c.PROJECTILES.push({kind:'wand',owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
 c.updateProjectiles(0);assert.equal(c.PROJECTILES[0].vx,0);assert.equal(Math.abs(c.PROJECTILES[0].vy),7);
});
await test('shield block also charges exactly thirty',()=>{
 const c=world();c.D.hasWeapon=false;c.D.shield=true;c.D._shieldSide=-1;c.PROJECTILES.push({kind:'arrow',owner:c.P,ownerImmuneUntil:10,x:182,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
 c.updateProjectiles(0);assert.equal(c.D.stamina,70);assert.equal(c.D.hp,100);
});
await test('wand impulse is seven and 30 percent disarm works even on block',()=>{
 for(const blocked of [false,true]){
  const c=world();c.Math.random=()=>.29;c.applyProjectileContactEffects({kind:'wand',owner:c.P,vx:3,vy:4},c.D,blocked,0);
  assert(Math.abs(Math.hypot(c.D.vx,c.D.vy)-7)<1e-9);assert.equal(c.D.hasWeapon,false);
  const drop=c.DROPPED_WEAPONS[0];assert(Math.abs(Math.hypot(drop.vx,drop.vy)-(6+.29*4)*.5)<1e-9);
  assert.equal(c.D.stamina,blocked?70:100);
 }
});
await test('roll at thirty percent fails; an unarmed victim still gets pushed',()=>{
 const c=world();c.Math.random=()=>.3;c.applyProjectileContactEffects({kind:'wand',owner:c.P,vx:7,vy:0},c.D,false,0);
 assert(c.D.hasWeapon);assert.equal(c.D.vx,7);
 c.D.hasWeapon=false;c.applyProjectileContactEffects({kind:'wand',owner:c.P,vx:7,vy:0},c.D,false,0);assert.equal(c.D.vx,14);assert.equal(c.DROPPED_WEAPONS.length,0);
});
await test('arrow impulse is seven on hit and block',()=>{
 for(const blocked of [false,true]){
  const c=world();c.applyProjectileContactEffects({kind:'arrow',owner:c.P,vx:3,vy:4},c.D,blocked,0);
  assert(Math.abs(Math.hypot(c.D.vx,c.D.vy)-7)<1e-9);
  assert.equal(c.D.stamina,blocked?70:100);
 }
});
await test('wand body hit has one directional impulse, not extra body knockback',()=>{
 const c=world();c.D.hasWeapon=false;c.PROJECTILES.push({kind:'wand',owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
 c.updateProjectiles(0);assert.equal(c.D.vx,7);assert.equal(c.D.vy,0);assert.equal(c.D.x,200);assert.equal(c.D.hp,80);
});
await test('arrow body hit has one directional impulse, not extra body knockback',()=>{
 const c=world();c.D.hasWeapon=false;c.PROJECTILES.push({kind:'arrow',owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
 c.updateProjectiles(0);assert.equal(c.D.vx,7);assert.equal(c.D.vy,0);assert.equal(c.D.x,200);assert.equal(c.D.hp,80);
});
await test('thrown weapon always pushes and uses short disbalance before five cells',()=>{
  const c=world();c.applyDisbalance=(e,_source,duration)=>e.disbalanceDuration=duration;
  c.applyProjectileContactEffects({owner:c.P,vx:4,vy:0,throwTravel:274},c.D,false,0);
  assert.equal(c.D.vx,3.6);assert.equal(c.D.disbalanceDuration,.3);
});
await test('thrown weapon uses full disbalance from five travelled cells',()=>{
  const c=world();c.applyDisbalance=(e,_source,duration)=>e.disbalanceDuration=duration;
  c.applyProjectileContactEffects({owner:c.P,vx:4,vy:0,throwTravel:275},c.D,false,0);
  assert.equal(c.D.vx,3.6);assert.equal(c.D.disbalanceDuration,1.3);
});await test('long-drawn arrows halve both bot dodge chances',()=>{
 const c=world();
 assert.equal(c.projectileDodgeChanceFor({kind:'arrow',chargeTime:2},.25),.25);
 assert.equal(c.projectileDodgeChanceFor({kind:'arrow',chargeTime:2.001},.25),.125);
 assert.equal(c.projectileDodgeChanceFor({kind:'wand',chargeTime:5},.25),.25);
});
await test('disarm cancels ranged charge without firing later',()=>{
 const c=world();c.D.key='bow';c.D._bowCharging=true;c.D._bowChargeStart=0;c.D._bowTensionSound={};
 c.disarmEntity(c.D,1,0);assert.equal(c.D._bowCharging,false);assert.equal(c.D._bowTensionSound,null);assert.equal(c.D.hasWeapon,false);
 c.GameTime=3;c.updateRangedWeaponFire(c.D,false,0);assert.equal(c.PROJECTILES.length,0);
});
await test('bow discount boundary and weapon swaps',()=>{
 const c=world();c.P.key='bow';assert.equal(c.spendDodgeStamina(c.P,30),15);
 c.GameTime=2;assert.equal(c.spendDodgeStamina(c.P,30),30);
 c.GameTime=4.001;assert.equal(c.spendDodgeStamina(c.P,30),15);
 c.GameTime=5;c.P.key='sword';assert.equal(c.spendDodgeStamina(c.P,30),30);
 c.GameTime=6;c.P.key='bow';assert.equal(c.spendDodgeStamina(c.P,30),30);
});
await test('failed local dodge leaves timestamp and stamina untouched',()=>{
 const c=world();vm.runInContext(fn(read('../input/player-controls.js'),'dodge'),c);c.P.key='bow';c.P._dodgeCD=1;
 c.dodge(c.P,1,0,0);assert.equal(c.P.stamina,100);assert.equal(c.P._lastDodgeAt,undefined);
 c.GameTime=1;c.dodge(c.P,1,0,0);assert.equal(c.P.stamina,85);assert.equal(c.P._lastDodgeAt,1);
});
await test('main dodge uses bow discount and ignores failed attempts',()=>{
 const c=world(),mobile=read('../ui/mobile.js').replace('window.fireDodge=function(','function fireDodge(');
 vm.runInContext(fn(mobile,'fireDodge'),c);c.P.key='bow';c.fireDodge(1,0,false,0);
 assert.equal(c.P.stamina,85);assert.equal(c.P._lastDodgeAt,0);
 c.GameTime=.1;c.fireDodge(1,0,false,0);assert.equal(c.P.stamina,85);assert.equal(c.P._lastDodgeAt,0);
 c.GameTime=3;c.P.unbalanced=true;c.fireDodge(1,0,true,0);assert.equal(c.P._lastDodgeAt,0);
 c.P.unbalanced=false;c.fireDodge(0,0,true,0);assert.equal(c.P._lastDodgeAt,0);
});
await test('wand bot can choose shield on melee threat and keeps a long shield cooldown',()=>{
 const c=world();c.D.key='wand';c.D.x=180;c.D._wandBotAI={action:null,start:0,nextShieldAt:0,nextShotAt:99,nextLightningAt:99};c.P.vel=20;c.mDown=true;c.updateWandBotAI(.01,c.D);
 assert.equal(c.D._wandBotAI.action,'shield');assert(c.D._wandBotAI.nextShieldAt>0);assert(c.D._wandBarrierActive===false);
});
await test('wand quick release spends 50 rage, deals x1.5 base damage, recoils and stuns for three seconds',()=>{
 const c=world();c.P.key='wand';c.P.rage=50;c.updateRangedWeaponFire(c.P,true,0);c.GameTime=.1;c.updateRangedWeaponFire(c.P,false,0);
 assert.equal(c.P.stamina,100);assert.equal(c.P.rage,0);assert.equal(c.D.hp,85);assert.equal(c.D.debuff,'stun');assert.equal(c.D.debuffDuration,3);
 assert.equal(c.D.vx,3.5);assert.equal(c.P.vx,-1.75);
});
await test('wand quick release recoils even without a target',()=>{
 const c=world();c.P.key='wand';c.P.rage=50;c.D.x=395;c.updateRangedWeaponFire(c.P,true,0);c.GameTime=.1;c.updateRangedWeaponFire(c.P,false,0);
 assert.equal(c.D.hp,100);assert.equal(c.P.vx,-1.75);assert.equal(c.P.rage,0);
});
await test('wand quick release hits three and a half cells forward without touching the wand tip',()=>{
 const c=world();c.P.key='wand';c.P.rage=50;c.D.x=370;c.updateRangedWeaponFire(c.P,true,0);c.GameTime=.1;c.updateRangedWeaponFire(c.P,false,0);
 assert.equal(c.D.hp,85);assert.equal(c.D.debuff,'stun');assert.equal(c.P.vx,-1.75);
});
await test('wand quick release stun applies even during target hit cooldown',()=>{
 const c=world();c.P.key='wand';c.P.rage=50;c.D._hitCD=1;c.updateRangedWeaponFire(c.P,true,0);c.GameTime=.1;c.updateRangedWeaponFire(c.P,false,0);
 assert.equal(c.D.hp,100);assert.equal(c.D.debuff,'stun');assert.equal(c.D.debuffDuration,3);
});
await test('wand barrier blocks a blade segment crossing its circle',()=>{
 const c=world();c.P.key='wand';c.P._wandBarrierActive=true;
 assert.equal(c.wandBarrierGeometry(c.P).radius,82.5);
 assert(c.wandBarrierSegmentIntersects(c.P,40,100,160,100,0));
});
await test('wand projectile texture frame reads two by two magicball sheet',()=>{
 const c=world();c.GameTime=0;const f0=c.wandProjectileFrame({naturalWidth:512,naturalHeight:512},0);assert.equal(f0.x,0);assert.equal(f0.y,0);assert.equal(f0.w,256);assert.equal(f0.h,256);
 c.GameTime=.07;const f1=c.wandProjectileFrame({naturalWidth:512,naturalHeight:512},0);assert.equal(f1.x,256);
});
await test('wand no-flick hold starts barrier at .2 seconds and drains stamina',()=>{
 const c=world();c.P.key='wand';c.updateRangedWeaponFire(c.P,true,0);c.GameTime=.21;c.updateRangedWeaponFire(c.P,true,0);
 assert(c.wandBarrierHeld(c.P));assert(Math.abs(c.P.stamina-98.8)<1e-9);assert.equal(c.P._wandChargeFXActive,false);
});
await test('wand charge particles appear only after flick-selected charge and then vanish on cancel',()=>{
 const c=world();c.P.key='wand';c.updateRangedWeaponFire(c.P,true,0);c.updateWandChargeParticles(.1,c.P);c.updateWandParticles(.1);
 assert.equal(vm.runInContext('WAND_PARTICLES.length',c),0);
 c.P._wandGesture.flickSeen=true;c.GameTime=.21;c.updateRangedWeaponFire(c.P,true,1);
 c.updateWandChargeParticles(.1,c.P);assert(vm.runInContext('WAND_PARTICLES.length',c)>0);
 c.P._wandGesture.cancelled=true;c.P._wandChargeFXActive=false;c.updateWandParticles(.1);
 assert.equal(c.P._wandChargeFXActive,false);assert.equal(vm.runInContext('WAND_PARTICLES.length',c),0);
});
await test('wand barrier suppresses stamina regeneration',()=>{
 const c=world();c.P.key='wand';c.P.stamina=50;c.P._wandBarrierActive=true;c.regenStamina(c.P,1,false);assert.equal(c.P.stamina,50);
 c.P._wandBarrierActive=false;c.regenStamina(c.P,1,false);assert(c.P.stamina>50);
});
await test('wand fires after flick-selected charge reaches charge time',()=>{
 const c=world();c.P.key='wand';c.updateRangedWeaponFire(c.P,true,0);c.P._wandGesture.flickSeen=true;
 c.GameTime=.21;c.updateRangedWeaponFire(c.P,true,1);
 c.GameTime=.51;c.updateRangedWeaponFire(c.P,true,1);
 c.updateRangedWeaponFire(c.P,false,1);assert.equal(c.PROJECTILES.length,1);assert.equal(c.PROJECTILES[0].kind,'wand');
});
await test('wand cannot fire after an active barrier is dispersed',()=>{
 const c=world();c.P.key='wand';c.updateRangedWeaponFire(c.P,true,0);c.GameTime=.21;c.updateRangedWeaponFire(c.P,true,0);
 c.P._wandBarrierActive=false;c.updateRangedWeaponFire(c.P,true,.1);
 for(let i=1;i<=6;i++){c.GameTime=.21+i*.1;c.updateRangedWeaponFire(c.P,true,i);}
 c.GameTime=1;c.updateRangedWeaponFire(c.P,false,0);assert.equal(c.PROJECTILES.length,0);assert(c.P._wandGesture.cancelled);
});
await test('remote contact applies once on owner and never drains the shooter',()=>{
 const sender=world();sender.NET_SYNC.active=true;sender.Math.random=()=>.1;
 sender.applyProjectileContactEffects({kind:'wand',owner:sender.P,vx:7,vy:0},sender.D,true,0);
 assert.equal(sender.D.stamina,100);assert.equal(sender.P.stamina,100);assert(sender.D.hasWeapon);
 const receiver=world();receiver.playSound=()=>{};
 const net=read('../network/net-sync.js').replace('return { onConnected,','return { _activate(){_active=true;}, onConnected,');
 vm.runInContext(net,receiver);receiver.NET_SYNC._activate();
 const msg=sender.sent[0];receiver.NET_SYNC.onProjectileContact(msg);receiver.NET_SYNC.onProjectileContact(msg);
 assert.equal(receiver.P.stamina,70);assert.equal(receiver.P.vx,7);assert.equal(receiver.P.hasWeapon,false);assert.equal(receiver.DROPPED_WEAPONS.length,1);
});
await test('bot flail and wand are routed to the axe swing family',()=>{
 const c=world(),ai=read('../ai/ai.js');vm.runInContext(ai.match(/const SWING_ONLY_WEAPON_KEYS = .*;/)[0]+'\n'+fn(ai,'aiIsSwingOnlyWeapon'),c);
 for(const key of ['axe','flail','wand'])assert(c.aiIsSwingOnlyWeapon({key}));assert(!c.aiIsSwingOnlyWeapon({key:'sword'}));
});
console.log(count+' balance tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
