// === src/core/entity.js ===
// Shared runtime model for the local player, AI opponents, and network ghosts.
// Gameplay-specific fields are still layered by `makeEntity` below, keeping the
// original save/network shape intact while removing separate P/D base objects.
class Entity {
  constructor(x, y, options = {}) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = 0; this.vel = 0;
    this.hp = 100; this.maxHp = 100;
    this.stamina = 100; this.maxStamina = 100;
    this.rage = 0;
    this.bx = 0; this.by = 0; this.tbx = 0; this.tby = 0;
    this.pvX = 0; this.pvY = -8; this.tpX = 0; this.tpY = -8;
    this.weaponType = 0; this.hasWeapon = true;
    this.shield = 0; this._shieldFlipped = false; this._shieldSide = 1; this._shieldAlpha = 1;
    this._buffs = {}; this._mods = {};
    this.isPlayer = !!options.isPlayer; this.isBot = !!options.isBot; this._aiState = null;
    this._wandCharging = false; this._magicCharging = false; this._bowCharging = false;
    this._wandChargeStart = 0; this._magicChargeStart = 0; this._bowChargeStart = 0;
    this._skinUrl = null; this._skinImg = null; this._weaponUrl = null; this._weaponImg = null;
    this._shieldUrl = null; this._shieldImg = null; this._weaponCache = {};
    this._flailState = 'FOLLOW'; this._flailExt = 0; this._flailSpinSpeed = 0;
    this._flailDirection = 1; this._flailFreeAngle = 0; this._flailWasAtMax = false;
    this._flailStamCD = 0; this._flailLagVel = 0; this._flailPrevAngle = 0; this._flailIsLerping = false;
    this._dvx = 0; this._dvy = 0; this._dodgeActiveUntil = -1; this._moveLockUntil = -1;
    this.hitFlash = 0; this.atkPts = 0; this.isAttacker = false; this._hitCD = -1;
  }
  getMod(key, fallback = 1) { return getMod(this, key, fallback); }
  hasBuff(buffId) { return isBuffActive(this, buffId); }
  isExhausted() { return this.hasBuff('EXHAUST'); }
  isUnbalanced() { return this.hasBuff('DISBALANCE'); }
  updateBuffs(dt) { updateBuffs(this, dt); }
  startBuff(buffId, ...args) { startBuff(this, buffId, ...args); }
  applyDamage(damage, attacker, options = {}) {
    const finalDamage = Math.min(damage, Math.max(1, Math.round(this.maxHp * 0.7)));
    this.hp = Math.max(0, this.hp - finalDamage);
    this.hitFlash = GameTime + 0.3;
    if (options.spawnBlood !== false && typeof spawnBloodPool === 'function') spawnBloodPool(this.x, this.y, finalDamage);
    return finalDamage;
  }
}

