// Run: node src/combat/balance.test.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(__dirname+'/'+p,'utf8');
const weapons=read('weapons.js'),ranged=read('ranged.js');
function fn(source,name){
 const marker='function '+name+'(',at=source.indexOf(marker);
 assert(at>=0,name);const start=source.slice(at-6,at)==='async '?at-6:at;
 for(let end=source.indexOf('}',at);end>=0;end=source.indexOf('}',end+1)){
  const text=source.slice(start,end+1);try{new vm.Script('('+text+')');return text;}catch{}
 }
 throw Error(name);
}
function actor(x,key='sword'){return {x,y:100,key,hp:100,stamina:100,stamMax:100,angle:0,vel:0,vx:0,vy:0,hasWeapon:true,weaponType:0,_aiState:{enabled:false},rage:0};}
function world(){
 const p=actor(100),d=actor(200),sent=[],sounds=[];
 const c={console,Date,Math:Object.create(Math),P:p,D:d,ALL_BOTS:[d],PROJECTILES:[],DROPPED_WEAPONS:[],DODGE_TRAIL:[],window:{_dodgeCooldownMob:0},
  GameTime:0,MAX_HP:100,WORLD_W:2000,WORLD_H:1000,CROSSBOW_PROJ_SPEED:25,CROSSBOW_MAX_DMG_PCT:1,WAND_MAX_DMG_PCT:1,PROJECTILE_DODGE_CHANCE:0,
  weaponKeyOf:e=>e?.key,weaponReach:()=>85,weaponCollisionType:()=> 'full',isBot:()=>false,
  isExhausted:e=>!!e.exhausted,isUnbalanced:e=>!!e.unbalanced,applyExhaust:e=>e.exhausted=true,
  drainStamina:(e,n)=>e.stamina=Math.max(0,e.stamina-n),shieldHeld:e=>!!e.shield,shieldDef:()=>null,
  sv:k=>k==='bodyKB'?10:1,randSpin:()=>0,droppedWeaponPixelLen:()=>85,
  NET_SYNC:{active:false},NET_CORE:{getPing:()=>0},flailRemote:()=>false,
  applyShieldBlockFX:()=>{},spawnWandExplosion:()=>{},spawnArrowShatter:()=>{},spawnLightningHit:()=>{},fadeOutSound:()=>{},clearBowTensionFX:()=>{},clearMagicStaffFX:()=>{},clashRageGain:()=>1,addRage:()=>{},
  FactionRules:{canDamage:(a,b)=>a!==b,contact:()=>{},getBotTarget:()=>p},
  rf:()=>10,randRange:()=>3,getMod:(_e,_k,v)=>v,wandChargeTimeFor:()=>.5,updateRangedWeaponFire:()=>{},
  $:{M:{step:dt=>dt*120,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),decay:v=>v,lerpDT:(v,t)=>t},POS:{body:e=>({x:e.x,y:e.y}),pivot:e=>({x:e.x,y:e.y})},FX:{hit:()=>{}},S:{play:s=>sounds.push(s)},NET:{send:m=>sent.push(m)}},
 };
 vm.createContext(c);
 const begin=weapons.indexOf('const WEAPON_TYPES = [');vm.runInContext(weapons.slice(begin,weapons.indexOf('];',begin)+2),c);
 for(const name of ['weaponDamageMultiplier','spendDodgeStamina','cancelRangedCharge','disarmEntity'])vm.runInContext(fn(weapons,name),c);
 for(const name of ['applyDamage','canResolveProjectileContact','applyProjectileContactEffects','applyProjectileEffectToEntity','projectileDodgeChanceFor','updateProjectiles','updateWandBotAI'])vm.runInContext(fn(ranged,name),c);
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
await test('loaded legacy weapon table retains flail half-damage default',async()=>{
 const c=world();c.WEAPON_TABLE_URL='table';c.fetchWithTimeout=async()=>({ok:true,text:async()=> 'flail|Flail|flail|8|1|8|6|0.2|0.24|0.24|1.2|1.5|2|0.1|tip|disarm|0.5|1'});
 vm.runInContext(fn(weapons,'loadWeaponTable'),c);await c.loadWeaponTable();assert.equal(c.weaponDamageMultiplier('flail'),.5);
});
await test('every projectile kind charges blocker, never shooter',()=>{
 for(const kind of ['arrow','wand','bolt','orb']){
  const c=world();c.Math.random=()=>.9;c.PROJECTILES.push({kind,owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
  c.updateProjectiles(0);assert.equal(c.D.stamina,70);assert.equal(c.P.stamina,100);assert.equal(c.PROJECTILES.length,0);
  c.updateProjectiles(0);assert.equal(c.D.stamina,70);
 }
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
await test('wand body hit has one directional impulse, not extra body knockback',()=>{
 const c=world();c.D.hasWeapon=false;c.PROJECTILES.push({kind:'wand',owner:c.P,ownerImmuneUntil:10,x:c.D.x,y:100,vx:7,vy:0,rot:0,dmg:20,bornAt:0});
 c.updateProjectiles(0);assert.equal(c.D.vx,7);assert.equal(c.D.vy,0);assert.equal(c.D.x,200);assert.equal(c.D.hp,80);
});
await test('long-drawn arrows halve both bot dodge chances',()=>{
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
await test('bot wand melee wait halves; ranged duration is unchanged',()=>{
 const c=world();c.D.key='wand';c.D.x=400;c.updateWandBotAI(.01,c.D);assert.equal(c.D._wandModeUntil,5);
 c.GameTime=5;c.updateWandBotAI(.01,c.D);assert.equal(c.D._wandMode,'ranged');assert.equal(c.D._wandModeUntil,8);
 c.GameTime=8;c.updateWandBotAI(.01,c.D);assert.equal(c.D._wandMode,'melee');assert.equal(c.D._wandModeUntil,13);
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
await test('bot flail is routed to the axe swing family',()=>{
 const c=world(),ai=read('../ai/ai.js');vm.runInContext(ai.match(/const SWING_ONLY_WEAPON_KEYS = .*;/)[0]+'\n'+fn(ai,'aiIsSwingOnlyWeapon'),c);
 for(const key of ['axe','flail'])assert(c.aiIsSwingOnlyWeapon({key}));assert(!c.aiIsSwingOnlyWeapon({key:'sword'}));
});
console.log(count+' balance tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
