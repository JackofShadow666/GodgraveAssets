const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ctx={console,Math,Map,GameTime:0,sv:k=>k==='swthresh'?1:1,
  weaponKeyOf:e=>e.key,isExhausted:()=>false,drainStamina:(e,n)=>{e.stamina=Math.max(0,e.stamina-n);},
  applyExhaust:e=>{e.exhausted=1;},$: {M:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},S:{play(){}}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/tapesword.js','utf8'),ctx);
const call=code=>vm.runInContext(code,ctx);

call('globalThis.e={key:"tapesword",stamina:100,rage:0,rageBuffEnd:-1,vel:0,hasWeapon:true}; resetTapeswordCombat(e)');
call('tapeswordInput(e,true,0)');
assert.equal(ctx.e.stamina,80,'LMB cast costs 20 stamina');
call('tapeswordInput(e,true,1)');
assert.equal(ctx.e.stamina,80,'LMB hold has no stamina drain');
call('tapeswordUpdateLength(e,0.5)');
assert.equal(ctx.e._tapeswordLinks,9,'LMB without rotation does not extend the blade');
call('e.vel=1;tapeswordUpdateLength(e,0.5)');
assert.equal(ctx.e._tapeswordLinks,14,'LMB grows to 14 links in 0.5 seconds while rotating');
call('e.vel=0;tapeswordInput(e,false,0); tapeswordUpdateLength(e,0.2)');
assert.equal(ctx.e._tapeswordLinks,14,'release does not fold before 0.4 seconds');
call('GameTime=e._tapeswordHoldStarted+0.41;tapeswordUpdateLength(e,0.4)');
assert.equal(ctx.e._tapeswordLinks,14,'release keeps inertial length for 0.3 seconds');
call('GameTime=e._tapeswordHoldStarted+0.72;tapeswordUpdateLength(e,0.6)');
assert.equal(ctx.e._tapeswordLinks,9,'release folds after inertia over medium duration');

call('GameTime=0;e._tapeswordLinks=14;e.stamina=100;e.rage=0;e._tapeswordHoldStarted=0;e._tapeswordForceRelease=false;tapeswordInput(e,true,0)');
call('GameTime=e._tapeswordHoldStarted+1.01;tapeswordInput(e,true,0); tapeswordUpdateLength(e,0.2)');
assert.equal(ctx.e._tapeswordHeld,false,'LMB force releases after 1 second');
assert.equal(ctx.e._tapeswordLinks,14,'forced release starts inertia while LMB is held');
call('GameTime=e._tapeswordHoldStarted+1.32;tapeswordUpdateLength(e,0.6)');
assert.equal(ctx.e._tapeswordLinks,9,'forced release finishes fold after inertia');
call('tapeswordInput(e,true,0)');
assert.equal(ctx.e._tapeswordHeld,false,'held LMB cannot recast until released');
call('tapeswordInput(e,false,0); tapeswordInput(e,true,0)');
assert.equal(ctx.e._tapeswordHeld,true,'LMB can recast after release');
assert.equal(ctx.e.lmbHoldStart,-1,'tapesword clears ordinary LMB pose hold state');

call('GameTime=0;e._tapeswordPress=false;e._tapeswordHeld=false;e._tapeswordForceRelease=false;e.stamina=100;e.rage=30;e.rageBuffEnd=-1;tapeswordInput(e,true,0)');
assert.equal(ctx.e.rage,0,'rage cast costs 30 rage');
assert.equal(ctx.e.stamina,100,'rage cast does not cost stamina');
call('tapeswordInput(e,true,2)');
assert.equal(ctx.e.stamina,100,'rage hold does not cost stamina');

call('e._tapeswordLinks=11;e._tapeswordGrowthBlocked=true;e._tapeswordHeld=true;e.vel=1;tapeswordUpdateLength(e,1)');
assert.equal(ctx.e._tapeswordLinks,11,'block freezes further growth');

call('e._tapeswordLinks=14;e._tapeswordHeld=false;e._tapeswordHadMotion=true;e.vel=0;e._tapeswordHoldStarted=GameTime-0.5;tapeswordUpdateLength(e,0.04)');
assert.equal(ctx.e._tapeswordLinks,14,'stopped tapesword keeps length during inertia');
call('GameTime=e._tapeswordInertiaUntil+0.01;tapeswordUpdateLength(e,0.06)');
assert.equal(ctx.e._tapeswordLinks,13.49,'stopped tapesword folds over medium duration');
assert.equal(ctx.e.lmbWasDown,false,'stopped fold forcibly releases LMB state');

call('e._tapeswordLinks=14;e._tapeswordHeld=true;e._tapeswordPress=true;e.lmbWasDown=true;e._tapeswordForceRelease=false;e._tapeswordHadMotion=true;e._tapeswordHoldStarted=GameTime-0.5;e.vel=0;tapeswordUpdateLength(e,0.04)');
assert.equal(ctx.e._tapeswordHeld,true,'stopped rotation keeps held LMB during inertia');
call('GameTime=e._tapeswordInertiaUntil+0.01;tapeswordUpdateLength(e,0.06)');
assert.equal(ctx.e._tapeswordHeld,false,'stopped rotation releases held LMB after inertia');
assert.equal(ctx.e._tapeswordPress,false,'stopped rotation clears LMB press after inertia');
assert.equal(ctx.e._tapeswordForceRelease,true,'stopped rotation blocks held-button recast after inertia');

call(`
globalThis.P={key:'sword',hp:100,hasWeapon:true};
globalThis.D={key:'tapesword',hp:100,hasWeapon:true};
globalThis.ALL_BOTS=[];
globalThis.seen=[];
globalThis.weaponLenFor=()=>100;
globalThis.effSwordScale=()=>1;
globalThis.isBot=()=>false;
globalThis.tapeswordUpdateEntity=(ent,dt,entities)=>seen.push([ent,entities.includes(D)]);
updateTapeswordCombat(0.016);
`);
assert.equal(ctx.seen.length,2,'P and D are both processed for tapesword contacts');
assert.equal(ctx.seen.every(row=>row[1]),true,'D is present in tapesword contact targets');

call(`
globalThis.P={key:'tapesword',hp:100,hasWeapon:true,x:0,y:0,vx:4,vy:0,vel:2,angle:0};
globalThis.D={key:'wand',hp:100,hasWeapon:true,x:100,y:100,vx:0,vy:0,angle:0};
globalThis.$.POS={body:e=>({x:e.x,y:e.y})};
globalThis.weaponDefFor=()=>({dmgBase:10,dmgPerSpeed:0,maxDmgPercent:0.25});
globalThis.applyCutSwingPenalty=(e,d)=>d;
globalThis.isWeaponDisabled=()=>false;
globalThis.weaponColliderSpan=()=>({back:10,front:10});
globalThis.effSwordScale=()=>1;
globalThis.shieldHeld=()=>false;
globalThis.wandBarrierHeld=e=>e && e.key==='wand';
globalThis.wandBarrierGeometry=e=>({x:e.x,y:e.y,angle:0,radius:82.5});
globalThis.wandBarrierSegmentIntersects=(e,x1,y1,x2,y2)=>true;
globalThis.segSegDist=()=>({d:999,px:0,py:0,qx:0,qy:0});
globalThis.doClash=(a,d,res)=>{globalThis.lastClash=res;};
globalThis.swordHit=()=>{};
globalThis.triggerHitstop=()=>{};
globalThis.addRage=()=>{};
const contact=tapeswordBlockContact(P,D,null,[{a:{x:30,y:100},b:{x:170,y:100}}]);
globalThis.contact=contact;
applyTapeswordWeaponContact(P,D,contact,0.016);
tapeswordClashFeedback(P,D,contact);
`);
assert.equal(ctx.contact.type,'wandBarrier','tapesword detects wand barrier contact');
assert(ctx.contact.res && ctx.contact.res.d <= 82.5,'wand barrier contact carries collision response data');
assert.notEqual(ctx.P.x,0,'wand barrier contact pushes tapesword attacker');
assert(ctx.lastClash,'wand barrier contact sends clash feedback');
console.log('tapesword tests: ok');
