// Run: node src/modes/survival.test.cjs (isolated VM test, no browser/assets/network).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(__dirname + '/survival.js', 'utf8');

function freshAIState(){
  return {enabled:true,phase:'attack',_fakeMDown:false,_fakeKeys:{w:false,a:false,s:false,d:false}};
}

function entity(x = 500, y = 500){
  return {x,y,bx:0,by:0,hp:100,maxHp:100,stamina:100,stamMax:100,hasWeapon:true,
    weaponType:0,_aiState:freshAIState(),_bodyScaleMult:1,_damageMult:1};
}

function world({slot = 0, respawn = 2} = {}){
  const elements = new Map();
  function el(id){
    if(!elements.has(id)) elements.set(id,{id,disabled:false,title:'',textContent:'',dataset:{},
      classList:{toggle(){}},appendChild(){}});
    return elements.get(id);
  }
  const p = entity(400, 400), originalBot = entity(600, 400);
  const ctx = {console,Math:Object.create(Math),window:{addEventListener(){},doResume(){}},
    document:{readyState:'complete',body:{classList:{toggle(){},remove(){}}},head:{appendChild(){}},
      addEventListener(){},createElement:()=>el('made-'+elements.size),getElementById:id=>el(id)},
    P:p,D:originalBot,AI:originalBot._aiState,ALL_BOTS:[originalBot],PLAYER_SLOTS:[],WORLD_W:2000,WORLD_H:1400,W:1000,H:700,CAM_SCALE:1,mX:900,mY:400,
    GameTime:0,RealTime:0,DEATH:{deathCross:[],pDead:false,dDead:false,fadeIn:false,fadeAlpha:0,text:'',textCol:''},
    PROJECTILES:[],DROPPED_WEAPONS:[],DROPPED_SHIELDS:[],BALLS:[],BOXES:[],boxesOn:false,dummyOn:false,DEFAULT_WEAPON_KEY:0,
    WEAPON_TYPES:[{key:'sword'},{key:'greatsword'},{key:'bow'},{key:'crossbow'},{key:'wand'},{key:'magicstaff'},
      {key:'rapier'},{key:'dagger'},{key:'spear'},{key:'halberd'},{key:'axe'},{key:'longsword'},{key:'hammer'},{key:'staff'},{key:'flail'}],
    SHIELD_TYPES:[null,{name:'small'},{name:'large'},{name:'tower'}],
    NET_SYNC:{active:false},
    settings:{playerrespawn:respawn,cscl:1},sv:k=>ctx.settings[k] ?? 1,isBot:e=>e!==p,makeEntity:(x,y)=>entity(x,y),freshAIState,
    setWeapon:(ent,key)=>{ent.hasWeapon=true; ent.weaponType=key;},setShield:(ent,type)=>{ent.shield=type; ent._shieldImg=type?{}:null; ent._shieldUrl=type?'shield':null;},
    maybeSetRandomBotWeapon:ent=>{ent.hasWeapon=true; ent.weaponType=7;},
    assignRandomSkin(){},placeBotPendingReveal:(ent,x,y)=>{ent.x=x; ent.y=y; ent._pendingSpawnX=x; ent._pendingSpawnY=y; ent._awaitingReveal=true;},
    revealBotIfReady:ent=>{if(ctx.GameTime >= ent._survivalRevealAt){ent._awaitingReveal=false; return true;} return false;},
    clearEntityChargeState:ent=>{ent._chargeCleared=true;},disarmEntity:ent=>{ent.hasWeapon=false; ctx.DROPPED_WEAPONS.push({x:ent.x,y:ent.y,vx:0,vy:0});},
    dropShield:ent=>{if(!ent.shield)return false; ctx.DROPPED_SHIELDS.push({x:ent.x,y:ent.y,vx:0,vy:0,shieldType:ent.shield}); ent.shield=0; return true;},
    spawnBlood(){},snapCameraToTarget(){},applyBotCount(){ctx.applyBotCountCalls++;},addWin:loss=>ctx.wins.push(loss),hitFX:[],
    I18N:{t:(key,vars)=>key+(vars?JSON.stringify(vars):'')},FactionRules:{getMode:()=>ctx.mode},
    LocalPlayerControls:{getGamepadSlot:()=>slot,slots:Array.from({length:5},()=>({entity:null,source:null}))},
    $:{POS:{body:e=>({x:e.x+(e.bx||0),y:e.y+(e.by||0)}),root:()=>({x:ctx.P.x,y:ctx.P.y})},FX:{hit:v=>ctx.hitFX.push(v)},S:{play:n=>ctx.sounds.push(n)}},
    sounds:[],wins:[],mode:'survival',applyBotCountCalls:0};
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  ctx.SurvivalMode = ctx.window.SurvivalMode;
  ctx.tick = dt => { ctx.GameTime += dt; ctx.RealTime += dt; ctx.SurvivalMode.update(dt); };
  ctx.killAllEnemies = () => {
    for(const bot of ctx.ALL_BOTS.filter(e=>e._survivalEnemy)) ctx.SurvivalMode.handleDeath(bot);
    ctx.SurvivalMode.update(0.016);
  };
  return ctx;
}

let passed = 0;
function test(name, fn){ fn(); passed++; console.log('PASS '+name); }

test('starts local survival with timer, locked controls and stable roster slot', () => {
  const c = world({slot:3}); c.SurvivalMode.update(0.016);
  const s = c.SurvivalMode.getState();
  assert.equal(c.SurvivalMode.isActive(), true); assert.equal(s.phase, 'wave'); assert.equal(s.remaining, 360);
  assert.equal(c.P.shield || 0, 0);
  assert.equal(c.window.PLAYER_SLOTS[0].entity, c.P); assert.equal(c.window.PLAYER_SLOTS[3].source, 'gamepad-0');
  assert.equal(c.ALL_BOTS.length >= 4, true); assert.equal(c.ALL_BOTS[0]._survivalReserved, true);
  assert.equal(c.document.getElementById('sl-botcount').disabled, true);
});

test('ordinary waves pause for six game seconds and can drop wave heal', () => {
  const c = world(); c.Math.random = () => 0; c.SurvivalMode.update(0.016); c.killAllEnemies();
  let s = c.SurvivalMode.getState(); assert.equal(s.phase, 'intermission'); assert.equal(Math.ceil(s.pickups[0].remaining), 15);
  c.tick(5.9); assert.equal(c.SurvivalMode.getState().phase, 'intermission'); c.tick(0.2);
  s = c.SurvivalMode.getState(); assert.equal(s.phase, 'wave'); assert.equal(s.wave, 2);
});

test('boss is gated until three ordinary clears and gets double size/hp with random damage', () => {
  const c = world(); const rolls = [0,0,0,0,0,0,0,0,0,0.49,0.75]; c.Math.random = () => rolls.length ? rolls.shift() : 0;
  c.SurvivalMode.update(0.016);
  for(let i=0;i<3;i++){ assert.equal(c.SurvivalMode.getState().boss, false); c.killAllEnemies(); c.tick(6.1); }
  const boss = c.ALL_BOTS.find(e=>e._survivalBoss); assert(boss); assert.equal(boss.maxHp, 200); assert.equal(boss.hp, 200);
  assert.equal(boss._bodyScaleMult, 2); assert(boss._damageMult >= 1 && boss._damageMult <= 2);
});

test('survival enemy random weapons exclude huge and ranged weapons without changing AI phase', () => {
  const c = world();
  const rolls = [0.12,0.18,0.28,0.38,0.48,0.58,0.68,0.78,0.88,0.98];
  c.Math.random = () => rolls.length ? rolls.shift() : 0.98;
  c.SurvivalMode.update(0.016);
  const forbidden = new Set(['greatsword','bow','crossbow','wand','magicstaff','hammer']);
  for(const bot of c.ALL_BOTS.filter(e=>e._survivalEnemy)){
    assert.equal(forbidden.has(c.WEAPON_TYPES[bot.weaponType].key), false);
    assert.equal(bot._aiState.phase, 'attack');
  }
});

test('survival enemies can spawn shields, drop them and settled loot expires after fifteen seconds', () => {
  const c = world(); c.Math.random = () => 0;
  c.SurvivalMode.update(0.016);
  const enemy = c.ALL_BOTS.find(e=>e._survivalEnemy);
  assert(enemy); assert.equal(enemy.shield > 0, true);
  c.SurvivalMode.handleDeath(enemy); c.SurvivalMode.update(0.016);
  let s = c.SurvivalMode.getState();
  assert.equal(s.droppedWeapons, 1); assert.equal(s.droppedShields, 1);
  c.tick(14.9); s = c.SurvivalMode.getState();
  assert.equal(s.droppedWeapons, 1); assert.equal(s.droppedShields, 1);
  c.tick(0.2); s = c.SurvivalMode.getState();
  assert.equal(s.droppedWeapons, 0); assert.equal(s.droppedShields, 0);
});

test('heals choose injured nearby player, cap at max hp and expire', () => {
  const c = world({slot:1}); c.Math.random = () => 0; c.SurvivalMode.update(0.016);
  const player2 = c.ALL_BOTS[0]; c.P.hp = 70; player2.hp = 20; player2.x = c.P.x + 20; player2.y = c.P.y;
  for(const bot of c.ALL_BOTS.filter(e=>e._survivalEnemy)){ bot.x = player2.x; bot.y = player2.y; }
  c.killAllEnemies(); c.tick(0.05); assert.equal(player2.hp, 100); assert.equal(c.P.hp, 70);
  c.P.hp = 100; player2.hp = 100;
  for(const bot of c.ALL_BOTS.filter(e=>e._survivalEnemy)){ bot.x = c.P.x + 300; bot.y = c.P.y; }
  c.killAllEnemies(); c.tick(15.1); assert.equal(c.SurvivalMode.getState().pickups.length, 0);
});

test('coop death waits for ally respawn, solo death defeats, then restarts after result delay', () => {
  const coop = world({slot:1, respawn:1}); coop.SurvivalMode.update(0.016); coop.SurvivalMode.handleDeath(coop.P);
  assert.equal(coop.SurvivalMode.getState().respawns[0].slot, 0); coop.tick(1.1); assert.equal(coop.P.hp, 100); assert.equal(coop.P._defeated, false);
  const solo = world({respawn:1}); solo.SurvivalMode.update(0.016); solo.SurvivalMode.handleDeath(solo.P); solo.SurvivalMode.update(0.016);
  assert.equal(solo.SurvivalMode.getState().result, 'defeat'); solo.tick(2.1); assert.equal(solo.SurvivalMode.getState().phase, 'wave'); assert.equal(solo.SurvivalMode.getState().elapsed, 0);
});

test('damage assist scales only players and blocks result damage', () => {
  const c = world(); c.SurvivalMode.update(0.016); assert.equal(c.SurvivalMode.damageMultiplier(c.P), 0.5);
  c.P.hp = 49; assert.equal(c.SurvivalMode.damageMultiplier(c.P), 1/3);
  const enemy = c.ALL_BOTS.find(e=>e._survivalEnemy); assert.equal(c.SurvivalMode.damageMultiplier(enemy), 1);
  c.SurvivalMode.handleDeath(c.P); c.SurvivalMode.update(0.016); assert.equal(c.SurvivalMode.damageMultiplier(c.P), 0);
});

test('arena objects stay within the per-screen cap and never cover initial spawns', () => {
  const c = world(); c.SurvivalMode.update(0.016);
  const objects = c.SurvivalMode.getState().arenaObjects;
  assert.equal(objects.length > 0, true);
  const sectors = new Map();
  for(const o of objects){
    const key=Math.floor(o.x/1000)+':'+Math.floor(o.y/700);
    sectors.set(key,(sectors.get(key)||0)+1);
    assert.equal(o.x % 55, 0);
    assert.equal(o.y % 55, 0);
    assert.equal(Math.hypot(o.x-(c.P.x+5),o.y-(c.P.y-8)) >= 55, true);
  }
  for(const count of sectors.values()) assert.equal(count <= 7, true);
});

test('spikes deal 20 on entry, 3 per second and require exit plus reentry delay', () => {
  const c = world();
  for(let attempt=0;attempt<20;attempt++){
    c.SurvivalMode.update(0.016);
    if(c.SurvivalMode.getState().arenaObjects.some(o=>o.type==='spikes')) break;
    c.SurvivalMode.onRoundReset();
  }
  const spike=c.SurvivalMode.getState().arenaObjects.find(o=>o.type==='spikes'); assert(spike);
  c.P.x=spike.x-5;c.P.y=spike.y+8;c.P.hp=100;c.tick(0.01);assert.equal(c.P.hp,80);
  c.tick(1);assert.equal(c.P.hp,77);
  c.P.x+=200;c.tick(0.5);c.P.x=spike.x-5;c.tick(0.01);assert.equal(c.P.hp,77);
  c.P.x+=200;c.tick(0.01);c.tick(1.1);c.P.x=spike.x-5;c.tick(0.01);assert.equal(c.P.hp,57);
});

test('only a dodge launches a solid prop and a red barrel receives a three-second fuse', () => {
  const c = world();c.SurvivalMode.update(0.016);
  let prop=c.SurvivalMode.getState().arenaObjects.find(o=>o.type!=='spikes');assert(prop);
  c.P.x=prop.x-30;c.P.y=prop.y+8;c.P._dvx=0;c.P._dvy=0;c.tick(0.01);
  let same=c.SurvivalMode.getState().arenaObjects.find(o=>o.x===prop.x&&o.y===prop.y);assert(same);assert.equal(same.moving,false);
  c.P.x=prop.x-30;c.P.y=prop.y+8;c.P.hp=100;c.P._dvx=8;c.tick(0.01);
  assert.equal(c.P.hp, 100);
  same=c.SurvivalMode.getState().arenaObjects.find(o=>o.type===prop.type&&o.moving);assert(same);assert.equal(same.moving,true);
  const firstMove={x:same.x,y:same.y};c.tick(0.01);
  same=c.SurvivalMode.getState().arenaObjects.find(o=>o.type===prop.type&&o.moving);assert(same);assert(Math.hypot(same.x-firstMove.x,same.y-firstMove.y)>0.1);
  for(let attempt=0;attempt<80&&!c.SurvivalMode.getState().arenaObjects.some(o=>o.type==='redBarrel');attempt++)c.SurvivalMode.onRoundReset();
  const red=c.SurvivalMode.getState().arenaObjects.find(o=>o.type==='redBarrel');assert(red);
  c.tick(0.3);
  c.P.x=red.x-30;c.P.y=red.y+8;c.P._dvx=8;c.P._dvy=0;c.tick(0.01);
  let active=c.SurvivalMode.getState().arenaObjects.find(o=>o.type==='redBarrel'&&o.moving);assert(active);assert(active.fuse>2.5&&active.fuse<=3);
  const enemy=c.ALL_BOTS.find(e=>e._survivalEnemy);enemy._awaitingReveal=false;enemy.x=active.x+40;enemy.y=active.y;
  c.tick(0.1);
  active=c.SurvivalMode.getState().arenaObjects.find(o=>o.type==='redBarrel'&&o.fuse!=null);assert(active);assert(active.fuse>2.8&&active.fuse<=3);
});

test('arena preserves bot pause and throws a front prop instead of weapon', () => {
  const c = world();c.SurvivalMode.update(0.016);
  c.AI.enabled=false;c.tick(0.016);
  assert.equal(c.ALL_BOTS.filter(e=>e._survivalEnemy).every(e=>e._aiState.enabled===false), true);
  c.AI.enabled=true;c.tick(0.016);
  assert.equal(c.ALL_BOTS.filter(e=>e._survivalEnemy).every(e=>e._aiState.enabled===true), true);
  const prop=c.SurvivalMode.getState().arenaObjects.find(o=>o.type!=='spikes');assert(prop);
  c.P.x=prop.x-50;c.P.y=prop.y;c.mX=c.P.x+200;c.mY=c.P.y;
  assert.equal(c.SurvivalMode.tryThrowObject(c.P), true);
  assert.equal(c.P.hasWeapon, true);
  const thrown=c.SurvivalMode.getState().arenaObjects.find(o=>o.type===prop.type&&o.moving);assert(thrown);
  assert.equal(thrown.x, prop.x);
  assert.equal(thrown.y, prop.y);
});

test('flying arena props collide with other props instead of passing through', () => {
  const c = world();let pair=null;
  for(let attempt=0;attempt<120&&!pair;attempt++){
    c.SurvivalMode.update(0.016);
    const props=c.SurvivalMode.getState().arenaObjects.filter(o=>o.type!=='spikes');
    for(const a of props)for(const b of props){
      if(a===b) continue;
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
      if(dist>70&&dist<260&&Math.abs(dy)<20&&dx>0) pair={a,b};
    }
    if(!pair) c.SurvivalMode.onRoundReset();
  }
  assert(pair);
  c.P.x=pair.a.x-50;c.P.y=pair.a.y;c.mX=pair.b.x;c.mY=pair.b.y;
  assert.equal(c.SurvivalMode.tryThrowObject(c.P), true);
  for(let i=0;i<45;i++) c.tick(0.016);
  const hit=c.SurvivalMode.getState().arenaObjects.find(o=>o.x===pair.b.x&&o.y===pair.b.y);
  assert(!hit || hit.moving || Math.hypot(hit.vx||0,hit.vy||0)>0.1);
});

test('exiting survival restores original roster and unlocks controls', () => {
  const c = world({slot:2}); const originalBot = c.ALL_BOTS[0]; c.SurvivalMode.update(0.016); c.mode = 'ffa'; c.SurvivalMode.setActive(false);
  assert.deepEqual(c.ALL_BOTS, [originalBot]); assert.equal(c.document.getElementById('sl-botcount').disabled, false); assert.equal(c.applyBotCountCalls, 1);
});

console.log(`survival tests passed: ${passed}`);
