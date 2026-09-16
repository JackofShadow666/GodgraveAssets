// Flexible tapesword: 9 resting links, 10 while swinging, 14 while LMB is held and rotating.
const TAPESWORD_BASE_LINKS=9;
const TAPESWORD_SWING_LINKS=10;
const TAPESWORD_LMB_LINKS=14;
const TAPESWORD_HIT_COOLDOWN=0.3;
const TAPESWORD_SEGMENT_DRAW_SCALE=1.2;
const TAPESWORD_SEGMENT_SCALE_STEP=0.05;       // normal middle-segment growth
const TAPESWORD_SEGMENT_SCALE_STEP_FIRST=0.02; // first 5 segments
const TAPESWORD_SEGMENT_SCALE_STEP_LAST=0.03;  // last 3 segments
const TAPESWORD_LAST_SEGMENT_DRAW_SCALE=1.36;
const TAPESWORD_SEGMENT_OVERLAP=0.58;
const TAPESWORD_UNFOLDED_STEP_MULT=1.5;
const TAPESWORD_COLLISION_W=3;
const TAPESWORD_COLLISION_LEN_MULT=0.45;
const TAPESWORD_MAX_HOLD=1.0;
const TAPESWORD_INERTIA_FOLD_DELAY=0.6; // 0.6 sec inertia + folding after actual stop
const TAPESWORD_FOLD_DURATION=TAPESWORD_INERTIA_FOLD_DELAY; // fold happens DURING inertia
const TAPESWORD_BLOCK_DEFLECT_DURATION=0.28; // keep curling away after leaving the block
const TAPESWORD_BLOCK_DEFLECT_MULT=1.35;     // extra whip response from a block
const TAPESWORD_BLOCK_DEFLECT_MIN=0.9;       // minimum visible reverse curvature
const TAPESWORD_BLOCK_BEND_SCALE=1/3;       // 3x less tape curl after a block

function resetTapeswordCombat(ent){
  if(!ent) return;
  ent._tapeswordLinks=TAPESWORD_BASE_LINKS;
  ent._tapeswordHeld=false;
  ent._tapeswordPress=false;
  ent._tapeswordGrowthBlocked=false;
  ent._tapeswordNodes=null;
  ent._tapeswordHitAt=new Map();
  ent._tapeswordBotHoldUntil=0;
  ent._tapeswordHoldStarted=0;
  ent._tapeswordForceRelease=false;
  ent._tapeswordHadMotion=false;
  ent._tapeswordInertiaUntil=0;
  ent._tapeswordBendVel=0;
  ent._tapeswordFoldStart=0;
  ent._tapeswordFoldFrom=TAPESWORD_BASE_LINKS;
  ent._tapeswordFoldLocked=false;
  ent._tapeswordFoldAngle=0;
  ent._tapeswordInertiaBendStart=0;
  ent._tapeswordInertiaBendEnd=0;

  // Block reflection state.
  ent._tapeswordBlockTouching=false;
  ent._tapeswordBlockBendSign=0;
  ent._tapeswordBlockBendMag=0;
  ent._tapeswordBlockDeflectStart=0;
  ent._tapeswordBlockDeflectUntil=0;
  ent._tapeswordLastVisualBend=0;

  // A block can request the same forced fold used after motion stops.
  ent._tapeswordForceFoldNow=false;
  ent._tapeswordForceFoldReason=null;

  // Once a block reverses the tape, keep that direction until contact is LOST.
  ent._tapeswordBlockReverseLocked=false;
  ent._tapeswordBlockReverseVel=0;

  // Units that blocked this tape are immune to its BODY collision
  // until the current forced fold is fully finished.
  ent._tapeswordBodyIgnore=new Set();

  // Per-enemy damage immunity after that enemy blocks the tape.
  // Map<entity, gameTimeUntil>
  ent._tapeswordNoDamageUntil=new Map();

  // Clash still has normal recoil, but tape curvature is reduced briefly.
  ent._tapeswordBlockBendScaleUntil=0;
}

function tapeswordStart(ent){
  if(ent._tapeswordGrowthBlocked) ent._tapeswordGrowthBlocked=false;
  if(ent.rage>=30){
    ent.rage=Math.max(0,ent.rage-30);
    ent.rageBuffEnd=GameTime+1;
    ent._rageTextShown=false;
    if((typeof isBot!=='function'||!isBot(ent))&&$.S&&typeof $.S.play==='function') $.S.play('rage');
    ent._tapeswordFree=true;
    return true;
  }
  const staminaCost=(typeof isBot==='function'&&isBot(ent))?10:20;
  if(ent.stamina<staminaCost) return false;
  drainStamina(ent,staminaCost);
  ent._tapeswordFree=false;
  return true;
}

function tapeswordInput(ent,down,dt){
  if(!ent || weaponKeyOf(ent)!=='tapesword') return;

  // IMPORTANT: remember the PHYSICAL LMB state BEFORE any gameplay lock
  // changes `down`. Otherwise fold-lock would fake a mouse release.
  const rawDown=!!down;

  // Force-release is cleared only by a REAL physical LMB release.
  if(!rawDown) ent._tapeswordForceRelease=false;

  // Forced fold owns the weapon until it is completely closed.
  if(ent._tapeswordFoldLocked) down=false;

  // If auto-fold happened while LMB is still physically held,
  // keep ignoring it until the player actually releases the button.
  if(ent._tapeswordForceRelease) down=false;

  ent.lmbHoldStart=-1;
  ent._lmbHoldDrainRate=0;
  ent._lmbRefundPressAt=-1;
  ent._lmbRefundCost=0;
  ent._lmbRefundReleased=false;
  ent._lmbRefundClashed=false;
  ent._lmbRefundUsed=false;
  if(isExhausted(ent) || ent.hasWeapon===false) down=false;
  const pressed=!!down&&!ent._tapeswordPress;
  if(pressed && !tapeswordStart(ent)) down=false;
  if(pressed && down) ent._tapeswordHoldStarted=GameTime;
  const holdStarted=Number.isFinite(ent._tapeswordHoldStarted)?ent._tapeswordHoldStarted:GameTime;
  const botHoldActive=typeof isBot==='function'&&isBot(ent)&&((ent._aiState&&ent._aiState._fakeMDown)||GameTime<(ent._tapeswordBotHoldUntil||0));
  if(down && !botHoldActive && (GameTime-holdStarted)>=TAPESWORD_MAX_HOLD){
    down=false;
    ent._tapeswordForceRelease=rawDown;
  }
  ent._tapeswordPress=!!down;
  ent._tapeswordHeld=!!down;
  ent.lmbWasDown=!!down;
}

function tapeswordBotDown(ent,dt){
  const ai=ent._aiState||{};
  let requested=ent._manualControl?!!ent._manualAttackInput:!!ai._fakeMDown;
  if(requested && !ent._tapeswordAIWasDown && GameTime>=(ent._tapeswordBotHoldUntil||0))
    ent._tapeswordBotHoldUntil=GameTime+TAPESWORD_MAX_HOLD;
  ent._tapeswordAIWasDown=requested;
  return requested || GameTime<(ent._tapeswordBotHoldUntil||0);
}

function tapeswordDesiredLinks(ent){
  if(ent._tapeswordHeld && Math.abs(ent.vel||0)>=sv('swthresh')*0.25) return TAPESWORD_LMB_LINKS;
  return Math.abs(ent.vel||0)>=sv('swthresh')?TAPESWORD_SWING_LINKS:TAPESWORD_BASE_LINKS;
}

function tapeswordUpdateLength(ent,dt){
  let target=tapeswordDesiredLinks(ent);
  let current=Number.isFinite(ent._tapeswordLinks)
    ? ent._tapeswordLinks
    : TAPESWORD_BASE_LINKS;

  const locked=!!ent._tapeswordFoldLocked;
  const liveVel=ent.vel||0;
  const stopped=locked || Math.abs(liveVel)<sv('swthresh')*0.25;

  // Fully folded sword must never carry stale block/fold state.
  if(!locked && current<=TAPESWORD_BASE_LINKS+0.05){
    ent._tapeswordHadMotion=false;
    ent._tapeswordInertiaUntil=0;
    ent._tapeswordFoldStart=0;
    ent._tapeswordFoldFrom=TAPESWORD_BASE_LINKS;

    // A block received while folded must NOT prevent the next extension.
    ent._tapeswordGrowthBlocked=false;
    ent._tapeswordForceFoldNow=false;
    ent._tapeswordForceFoldReason=null;
  }

  // Remember the last REAL swing velocity.
  if(!locked && !stopped){
    ent._tapeswordHadMotion=true;
    ent._tapeswordBendVel=liveVel;
    ent._tapeswordInertiaUntil=0;
    ent._tapeswordFoldStart=0;
    ent._tapeswordFoldFrom=current;
  }

  const extended=current>TAPESWORD_BASE_LINKS+0.05;

  // Start the combined inertia + folding phase either:
  // 1) when real motion stops, or
  // 2) immediately after a blocking contact.
  const forceFoldNow=!!ent._tapeswordForceFoldNow;
  const shouldBeginForcedFold=
    !locked &&
    extended &&
    (
      forceFoldNow ||
      (stopped && ent._tapeswordHadMotion)
    );

  if(shouldBeginForcedFold){
    ent._tapeswordFoldLocked=true;
    ent._tapeswordFoldStart=GameTime;
    ent._tapeswordFoldFrom=current;
    ent._tapeswordInertiaUntil=
      GameTime+TAPESWORD_INERTIA_FOLD_DELAY;

    // Consume the block/stop request exactly once.
    ent._tapeswordForceFoldNow=false;

    // Current lagging curvature.
    const inertiaStartBend=Number.isFinite(ent._tapeswordLastVisualBend)
      ? ent._tapeswordLastVisualBend
      : $.M.clamp(
          -(ent._tapeswordBendVel||0)*0.135,
          -1.125,
          1.125
        );

    ent._tapeswordInertiaBendStart=inertiaStartBend;

    // A BLOCK uses the stored reversed SWING direction.
    // This does not depend on defender position or current contact geometry.
    if(forceFoldNow && Math.abs(ent._tapeswordBlockReverseVel||0)>0.001){
      const reverseVel=ent._tapeswordBlockReverseVel||0;
      const reverseBendSign=-Math.sign(reverseVel);

      const mag=Math.max(
        Math.abs(reverseVel*0.135)*40.50,
        Math.abs(inertiaStartBend)*8,
        TAPESWORD_BLOCK_DEFLECT_MIN*6
      );

      ent._tapeswordInertiaBendEnd=$.M.clamp(
        reverseBendSign*mag,
        -49.50,
        49.50
      );
    } else {
      // Normal stop: continue the whip past straight in the opposite direction.
      ent._tapeswordInertiaBendEnd=$.M.clamp(
        -inertiaStartBend*40.50,
        -49.50,
        49.50
      );
    }

    // LMB must stay ignored until a REAL physical release.
    ent._tapeswordHeld=false;
    ent._tapeswordPress=false;
    ent.lmbWasDown=false;
    ent.lmbHoldStart=-1;
    ent._lmbHoldDrainRate=0;
    ent._tapeswordForceRelease=true;

    if(ent._aiState) ent._aiState._fakeMDown=false;
    if(ent._manualControl) ent._manualAttackInput=false;
  }

  if(ent._tapeswordFoldLocked){
    /*
      IMPORTANT:
      Do NOT overwrite ent.angle here.

      main.js is allowed to keep smoothly returning the hand/handle
      toward the cursor while the flexible blade is retracting.
      Previously _tapeswordFoldAngle froze the handle, so it snapped
      back only after the lock ended.
    */

    // Do not let live angular velocity reopen the tape or add fold damage.
    ent.vel=0;

    const foldStart=Number.isFinite(ent._tapeswordFoldStart)
      ? ent._tapeswordFoldStart
      : GameTime;

    const phaseT=$.M.clamp(
      (GameTime-foldStart)/TAPESWORD_INERTIA_FOLD_DELAY,
      0,
      1
    );

    const foldFrom=Number.isFinite(ent._tapeswordFoldFrom)
      ? ent._tapeswordFoldFrom
      : current;

    // Shrink WHILE inertia is happening.
    // There is no separate straightening/folding phase afterwards.
    current=
      foldFrom+
      (TAPESWORD_BASE_LINKS-foldFrom)*phaseT;

    ent._tapeswordLinks=$.M.clamp(
      current,
      TAPESWORD_BASE_LINKS,
      TAPESWORD_LMB_LINKS
    );

    if(phaseT>=1){
      ent._tapeswordLinks=TAPESWORD_BASE_LINKS;
      ent._tapeswordHadMotion=false;
      ent._tapeswordInertiaUntil=0;
      ent._tapeswordFoldStart=0;
      ent._tapeswordFoldFrom=TAPESWORD_BASE_LINKS;
      ent._tapeswordBendVel=0;
      ent._tapeswordInertiaBendStart=0;
      ent._tapeswordInertiaBendEnd=0;
      ent._tapeswordFoldLocked=false;
      ent._tapeswordForceFoldNow=false;
      ent._tapeswordForceFoldReason=null;

      // The blocked unit becomes hittable again only after the tape
      // has completely finished retracting.
      if(ent._tapeswordBodyIgnore instanceof Set){
        ent._tapeswordBodyIgnore.clear();
      }

      // IMPORTANT:
      // Do NOT clear _tapeswordBlockReverseLocked here.
      // The blade may still physically overlap the same blocker.
      // The latch is released only after contact is genuinely lost.

      ent.vel=0;
    }

    return;
  }

  if(ent._tapeswordGrowthBlocked && target>current){
    target=current;
  }

  const rate=target>current
    ? (ent._tapeswordHeld?10:15)
    : 10;

  current+=(target>current?1:-1)*
    Math.min(Math.abs(target-current),rate*dt);

  ent._tapeswordLinks=$.M.clamp(
    current,
    TAPESWORD_BASE_LINKS,
    TAPESWORD_LMB_LINKS
  );
}

function tapeswordLocalNodes(ent,baseLen){
  const links=$.M.clamp(
    Number.isFinite(ent._tapeswordLinks)?ent._tapeswordLinks:TAPESWORD_BASE_LINKS,
    TAPESWORD_BASE_LINKS,
    TAPESWORD_LMB_LINKS
  );

  // Keep a constant topology to eliminate 14->13->12... geometry popping.
  const count=TAPESWORD_LMB_LINKS;

  const segmentLen=(baseLen/TAPESWORD_BASE_LINKS)*TAPESWORD_SEGMENT_DRAW_SCALE;
  const flex=$.M.clamp(
    (links-TAPESWORD_BASE_LINKS)/(TAPESWORD_LMB_LINKS-TAPESWORD_BASE_LINKS),
    0,
    1
  );
  const step=segmentLen*TAPESWORD_SEGMENT_OVERLAP*
    (1+flex*(TAPESWORD_UNFOLDED_STEP_MULT-1));

  const inertiaActive=!!ent._tapeswordFoldLocked;

  let bendBase=0;

  if(inertiaActive){
    // Same 0.6 sec progress controls BOTH whip inertia and blade shrinking.
    const foldStart=Number.isFinite(ent._tapeswordFoldStart)
      ? ent._tapeswordFoldStart
      : GameTime;

    const inertiaT=$.M.clamp(
      (GameTime-foldStart)/TAPESWORD_INERTIA_FOLD_DELAY,
      0,
      1
    );

    const b0=Number.isFinite(ent._tapeswordInertiaBendStart)
      ? ent._tapeswordInertiaBendStart
      : 0;

    const b1=Number.isFinite(ent._tapeswordInertiaBendEnd)
      ? ent._tapeswordInertiaBendEnd
      : b0;

    // Continuous whip motion:
    // old curve -> straight -> much stronger opposite curve.
    // No pause and no separate straightening stage.
    bendBase=b0+(b1-b0)*inertiaT;

  } else {
    // Normal live movement.
    // The clash may change ent.vel normally, but for a short time after
    // a block the visible tape curvature uses only 1/3 of that response.
    const blockBendScale=
      GameTime<(ent._tapeswordBlockBendScaleUntil||0)
        ? TAPESWORD_BLOCK_BEND_SCALE
        : 1;

    bendBase=$.M.clamp(
      -(ent.vel||0)*0.135*blockBendScale,
      -1.125,
      1.125
    );
  }

  // If the tape touched a blocking surface, force curvature AWAY from it.
  // While contact persists the reflection is full-strength; after separation
  // it fades for a short time so the tape behaves like a rebounding whip.
  const blockStillTouching=!!ent._tapeswordBlockTouching;
  // Blocking no longer modifies curvature at all.
  const blockDeflectActive=false;

  if(blockDeflectActive && (ent._tapeswordBlockBendSign||0)!==0){
    let w=1;

    if(!blockStillTouching){
      const start=ent._tapeswordBlockDeflectStart||0;
      const end=ent._tapeswordBlockDeflectUntil||0;
      const dur=Math.max(0.001,end-start);
      w=$.M.clamp((end-GameTime)/dur,0,1);
      // Soft decay after losing contact.
      w=w*w*(3-2*w);
    }

    const mag=Math.max(
      Math.abs(bendBase),
      ent._tapeswordBlockBendMag||0,
      TAPESWORD_BLOCK_DEFLECT_MIN
    );

    const reflected=(ent._tapeswordBlockBendSign||1)*mag;
    bendBase=bendBase+(reflected-bendBase)*w;
  }

  // Remember the real visual curvature. If the player stops immediately after
  // a block, the inertia phase starts from this reflected shape instead of
  // snapping back to the pre-block direction.
  ent._tapeswordLastVisualBend=bendBase;

  const bend=bendBase*flex;

  const nodes=[{x:0,y:0}];
  let angle=-Math.PI/2;

  // Whip profile:
  // curvature starts strongly at the handle and continues through the blade.
  // The previous i/count profile did the opposite and bent mostly the tip.
  for(let i=1;i<=count;i++){
    const active=$.M.clamp(links-(i-1),0,1);

    const t=(i-1)/Math.max(1,count-1); // 0 at handle -> 1 at tip

    // Strong near the handle, still substantial at the tip.
    // Average curvature stays close to the old profile, but its distribution
    // is reversed so the whole blade curls like a whip.
    const rootWeight=1.15-0.55*t;

    // Small organic variation without weakening the root.
    const ripple=0.94+0.06*Math.sin(GameTime*7+i);

    angle+=bend*rootWeight*ripple;

    const prev=nodes[nodes.length-1];
    const len=step*active;

    nodes.push({
      x:prev.x+Math.cos(angle)*len,
      y:prev.y+Math.sin(angle)*len
    });
  }

  ent._tapeswordNodes=nodes;
  return nodes;
}

function tapeswordWorldNodes(ent){
  const scale=effSwordScale(ent)*sv('swlen')*(isBot(ent)?sv('botswordscale'):1);
  const local=tapeswordLocalNodes(ent,weaponLenFor(ent));
  const pivot=$.POS.pivot(ent),a=ent.angle+Math.PI/2,c=Math.cos(a),s=Math.sin(a);
  return local.map(p=>({x:pivot.x+(p.x*c-p.y*s)*scale,y:pivot.y+(p.x*s+p.y*c)*scale}));
}

function tapeswordSegmentDrawScale(i,count,links){
  // Cumulative growth:
  // - first 5 segments: +0.02 per next segment
  // - middle segments:  +0.05 per next segment
  // - last 3 segments:  +0.03 per next segment
  //
  // Segment 1 starts at TAPESWORD_SEGMENT_DRAW_SCALE.
  let scale=TAPESWORD_SEGMENT_DRAW_SCALE;

  for(let seg=2;seg<=i;seg++){
    let step=TAPESWORD_SEGMENT_SCALE_STEP;

    if(seg<=5){
      step=TAPESWORD_SEGMENT_SCALE_STEP_FIRST;
    } else if(seg>count-3){
      step=TAPESWORD_SEGMENT_SCALE_STEP_LAST;
    }

    scale+=step;
  }

  return scale;
}

function tapeswordSegmentVisualLine(a,b,ent,i,count,baseLen,worldScale){
  const links=$.M.clamp(
    Number.isFinite(ent._tapeswordLinks)?ent._tapeswordLinks:TAPESWORD_BASE_LINKS,
    TAPESWORD_BASE_LINKS,
    TAPESWORD_LMB_LINKS
  );
  const active=$.M.clamp(links-(i-1),0,1);
  const drawScale=tapeswordSegmentDrawScale(i,count,links);
  const h=(baseLen/TAPESWORD_BASE_LINKS)*drawScale*active*(worldScale||1);
  return tapeswordSegmentLineFromHeight(a,b,h);
}

function tapeswordSegmentLineFromHeight(a,b,h){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
  const ux=dx/d,uy=dy/d,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
  return {a:{x:cx-ux*h/2,y:cy-uy*h/2},b:{x:cx+ux*h/2,y:cy+uy*h/2},h};
}

function tapeswordSegmentCollisionLine(a,b,ent,i,count,baseLen,worldScale){
  const visual=tapeswordSegmentVisualLine(a,b,ent,i,count,baseLen,worldScale);
  return tapeswordSegmentLineFromHeight(a,b,visual.h*TAPESWORD_COLLISION_LEN_MULT);
}

function tapeswordDamage(attacker){
  const def=weaponDefFor(attacker),speed=Math.abs(attacker.vel||0);
  let dmg=Math.round(def.dmgBase+speed*def.dmgPerSpeed);
  dmg=Math.min(dmg,Math.max(1,Math.round(100*def.maxDmgPercent)));
  return applyCutSwingPenalty(attacker,Math.max(1,dmg));
}

function tapeswordSegmentHitsBody(a,b,ent,extraWidth=0){
  const c=$.POS.body(ent),dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy||1;
  const t=$.M.clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/l2,0,1);
  return Math.hypot(c.x-(a.x+dx*t),c.y-(a.y+dy*t))<(14*sv('cscl')*(ent._bodyScaleMult||1)+extraWidth);
}

function tapeswordBlockContact(attacker,defender,nodes,segments){
  if(!defender || defender.hp<=0) return null;
  const tapeW=TAPESWORD_COLLISION_W*sv('cscl');
  const segs=segments||[];
  if(typeof wandBarrierSegmentIntersects==='function' && typeof wandBarrierHeld==='function' && wandBarrierHeld(defender)){
    const g=wandBarrierGeometry(defender);
    for(const seg of segs){
      const sx=seg.b.x-seg.a.x, sy=seg.b.y-seg.a.y, len2=sx*sx+sy*sy;
      const t=len2>0 ? $.M.clamp(((g.x-seg.a.x)*sx+(g.y-seg.a.y)*sy)/len2,0,1) : 0;
      const px=seg.a.x+sx*t, py=seg.a.y+sy*t;
      const d=Math.hypot(px-g.x,py-g.y);
      if(d<=g.radius) return {type:'wandBarrier',res:{d,px,py,qx:g.x,qy:g.y},width:tapeW};
    }
  }
  if(defender.hasWeapon===false || isWeaponDisabled(defender)) return null;
  const p=$.POS.pivot(defender),span=weaponColliderSpan(defender),scale=sv('swlen')*(isBot(defender)?sv('botswordscale'):1);
  const dx=Math.cos(defender.angle),dy=Math.sin(defender.angle);
  const a={x:p.x-dx*span.back*scale,y:p.y-dy*span.back*scale};
  const b={x:p.x+dx*span.front*scale,y:p.y+dy*span.front*scale};
  for(const seg of segs){
    const res=segSegDist(seg.a.x,seg.a.y,seg.b.x,seg.b.y,a.x,a.y,b.x,b.y);
    if(res.d<tapeW) return {type:'weapon',res,width:tapeW};
  }
  if(typeof shieldHeld==='function'&&shieldHeld(defender)){
    const sh=shieldCenter(defender,$.POS.body(attacker).x);
    if(sh){
      const radius=Math.max(defender._shieldW||24,defender._shieldH||36)*0.45;

      for(const seg of segs){
        const sx=seg.b.x-seg.a.x;
        const sy=seg.b.y-seg.a.y;
        const len2=sx*sx+sy*sy;
        const t=len2>0
          ? $.M.clamp(((sh.x-seg.a.x)*sx+(sh.y-seg.a.y)*sy)/len2,0,1)
          : 0;

        const px=seg.a.x+sx*t;
        const py=seg.a.y+sy*t;
        const cx=sh.x;
        const cy=sh.y;
        const centerDist=Math.hypot(px-cx,py-cy);

        if(centerDist<=radius+tapeW){
          // q is the closest point on the shield circle toward the tape.
          const inv=centerDist>0 ? 1/centerDist : 0;
          const ux=(px-cx)*inv;
          const uy=(py-cy)*inv;
          const qx=cx+ux*radius;
          const qy=cy+uy*radius;
          const d=Math.max(0,centerDist-radius);

          return {
            type:'shield',
            res:{d,px,py,qx,qy},
            width:tapeW
          };
        }
      }
    }
  }
  return null;
}

function tapeswordReflectFromBlock(ent,contact){
  if(!ent || ent._tapeswordBlockReverseLocked) return;

  // Use the ACTUAL swing direction.
  // If the weapon was rotating +, the rebound must rotate - and vice versa.
  let swingVel=0;

  if(Math.abs(ent.vel||0)>0.001){
    swingVel=ent.vel||0;
  } else if(Math.abs(ent._tapeswordBendVel||0)>0.001){
    swingVel=ent._tapeswordBendVel||0;
  } else if(Math.abs(ent._tapeswordLastVisualBend||0)>0.001){
    // Normal visual bend is approximately -vel*0.135.
    swingVel=-(ent._tapeswordLastVisualBend||0)/0.135;
  }

  if(Math.abs(swingVel)<0.001){
    // Extremely rare fallback; preserve deterministic one-time reversal.
    swingVel=1;
  }

  // The new inertial motion is STRICTLY the opposite of the incoming swing.
  const reverseVel=-swingVel;
  ent._tapeswordBlockReverseVel=reverseVel;

  // Visual bend created by a velocity uses bend = -vel*k.
  // Therefore rebound bend sign is the sign opposite to reverseVel.
  ent._tapeswordBlockBendSign=-Math.sign(reverseVel);

  const incomingBendMag=Math.max(
    Math.abs((swingVel||0)*0.135),
    Math.abs(ent._tapeswordLastVisualBend||0),
    TAPESWORD_BLOCK_DEFLECT_MIN
  );

  ent._tapeswordBlockBendMag=Math.max(
    TAPESWORD_BLOCK_DEFLECT_MIN,
    incomingBendMag*TAPESWORD_BLOCK_DEFLECT_MULT
  );

  // From this point onward the forced-fold owns the motion.
  // Store the REVERSED angular velocity as its inertial direction.
  ent._tapeswordBendVel=reverseVel;

  ent._tapeswordBlockDeflectStart=GameTime;
  ent._tapeswordBlockDeflectUntil=
    GameTime+TAPESWORD_BLOCK_DEFLECT_DURATION;

  // Do not permit another block to choose/reverse direction while contact persists.
  ent._tapeswordBlockReverseLocked=true;
}

function applyTapeswordWeaponContact(attacker,defender,contact,dt){
  if(!contact || !contact.res) return;
  if(contact.type!=='weapon' && contact.type!=='wandBarrier' && contact.type!=='shield') return;
  const res=contact.res,sep=(contact.width||BLADE_W)-res.d;
  if(sep<=0) return;
  let nx=res.px!==undefined ? (res.px-res.qx)/(res.d||1) : Math.cos(attacker.angle+Math.PI/2);
  let ny=res.py!==undefined ? (res.py-res.qy)/(res.d||1) : Math.sin(attacker.angle+Math.PI/2);
  if(!Number.isFinite(nx)||!Number.isFinite(ny)||Math.hypot(nx,ny)<0.001){ nx=Math.cos(attacker.angle+Math.PI/2); ny=Math.sin(attacker.angle+Math.PI/2); }
  const step=typeof $.M.step==='function'?Math.min(1,$.M.step(dt)):Math.min(1,dt*60);
  const push=Math.min(sep,10)*step;
  attacker.x += nx*push*0.35; attacker.y += ny*push*0.35;
  defender.x -= nx*push*0.65; defender.y -= ny*push*0.65;
  const swres=sv('swres');
  const dotA=(attacker.vx||0)*nx+(attacker.vy||0)*ny;
  if(dotA>0){ attacker.vx-=dotA*nx*swres; attacker.vy-=dotA*ny*swres; }
  const dotD=(defender.vx||0)*nx+(defender.vy||0)*ny;
  if(dotD<0){ defender.vx-=dotD*nx*swres; defender.vy-=dotD*ny*swres; }
}

function tapeswordNeutralBlockFeedback(attacker,defender,contact){
  // FULL CLASH PRESENTATION, ZERO CLASH PHYSICS.
  //
  // We intentionally do NOT call swordHit() or doClash(), because they alter
  // weapon velocity/angle, recoil, knockback, slow and therefore tapesword curl.

  const strongSwing=
    Math.abs(attacker.vel||0)>sv('swthresh')*2.5 ||
    Math.abs(defender.vel||0)>sv('swthresh')*2.5;

  const res=contact && contact.res ? contact.res : null;

  // Contact point. For tapesword contacts res.p is the tape-side point.
  let hitX,hitY;
  if(res && Number.isFinite(res.px) && Number.isFinite(res.py)){
    hitX=res.px;
    hitY=res.py;
  } else if(res && Number.isFinite(res.mx) && Number.isFinite(res.my)){
    hitX=res.mx;
    hitY=res.my;
  } else {
    const p=$.POS.pivot(defender);
    hitX=p.x;
    hitY=p.y;
  }

  // ── SAME VISUAL FX AS NORMAL doClash() ──────────────────────────

  // White clash bolt / spark.
  $.FX.hit({
    type:'bolt',
    x:hitX,
    y:hitY-4,
    life:12,
    maxLife:12,
    count:1,
    col:'#ffffff',
    size:20
  });

  // Special blue droplet label used by special disbalance blocks.
  const signalClashLabel=
    defender &&
    defender._specialDisbalanceBlockLabelFrame===GameTime;

  if(signalClashLabel){
    $.FX.hit({
      type:'blockDrop',
      ent:defender,
      life:30,
      maxLife:30,
      t:'💧',
      col:'#88ccff'
    });
  }

  // Restore the normal "КЛАЦ!" / localized CLASH! text.
  $.FX.hit({
    x:hitX,
    y:hitY+14,
    t:(window.I18N ? window.I18N.t('combat.clash') : 'CLASH!'),
    life:35,
    big:false,
    col:'#ccccaa'
  });

  // Strong clash visual extras, just like normal doClash().
  if(strongSwing && Math.random()<0.04 && typeof spawnFX==='function'){
    spawnFX('flash',hitX,hitY);
  }
  if(strongSwing && typeof spawnFX==='function'){
    spawnFX('cross',hitX,hitY);
  }

  // ── SOUND ───────────────────────────────────────────────────────
  if(typeof $.S!=='undefined' && $.S && typeof $.S.play==='function'){
    if(strongSwing){
      $.S.play('clashHard');
    } else {
      const specialBlockSound=
        defender &&
        (
          defender._specialDisbalanceBlockFrame===GameTime ||
          defender._criticalDisbalanceBlockFrame===GameTime
        );

      $.S.play(
        typeof blockClashSoundFor==='function'
          ? blockClashSoundFor(defender)
          : 'clash',
        specialBlockSound ? 0.75 : undefined
      );
    }
  }

  // Hitstop is visual timing only; it does not change tapesword direction.
  if(typeof triggerHitstop==='function'){
    triggerHitstop(strongSwing?3:2,strongSwing?3:1.5);
  }

  // Mark it as a real clash for HUD / combat presentation.
  attacker._clashFrame=GameTime;
  defender._clashFrame=GameTime;

  // Camera combat timer, same general presentation as normal combat contact.
  if(attacker===P || defender===P){
    P._cameraCombatUntil=GameTime+8;
  }

  // Health bars stay visible after contact.
  attacker._healthBarUntil=GameTime+3;
  defender._healthBarUntil=GameTime+3;

  // Keep normal clash rage reward.
  if(typeof addRage==='function'){
    const rageGain=100/sv('rageper')*0.5;
    addRage(attacker,rageGain);
    addRage(defender,rageGain);
  }

  // Notify combat/faction systems without applying weapon recoil.
  if(typeof FactionRules!=='undefined' && typeof FactionRules.contact==='function'){
    FactionRules.contact(attacker,defender);
  }

  const otherBot=
    attacker===P ? defender :
    (defender===P ? attacker : null);

  if(
    otherBot &&
    typeof isBot==='function' &&
    isBot(otherBot) &&
    typeof switchSmartBot==='function'
  ){
    switchSmartBot(otherBot);
  }

  if(typeof aiNotifyContact==='function'){
    aiNotifyContact();
  }

  // DELIBERATELY OMITTED:
  // - swordHit()
  // - doClash()
  // - angle/vel modification
  // - _dvx/_dvy knockback
  // - _moveLockUntil
  // - _blockSlow
  // - _swingBlockCD
}


function tapeswordClashFeedback(attacker,defender,contact){
  const strongSwing=Math.abs(attacker.vel||0)>sv('swthresh')*2.5 || Math.abs(defender.vel||0)>sv('swthresh')*2.5;
  const lmbRefundClash=(typeof markLmbRefundClash==='function') ? (markLmbRefundClash(attacker,defender)||markLmbRefundClash(defender,attacker)) : false;
  if(typeof applyDaggerPassiveSlow==='function'){
    applyDaggerPassiveSlow(attacker,defender);
    applyDaggerPassiveSlow(defender,attacker);
  }
  swordHit(attacker,defender);
  if(contact && contact.res && (contact.type==='weapon' || contact.type==='wandBarrier') && typeof doClash==='function') doClash(attacker,defender,contact.res,strongSwing,lmbRefundClash);
  if(typeof $.S!=='undefined' && $.S && typeof $.S.play==='function'){
    if(strongSwing) $.S.play('clashHard');
    else {
      const blockSoundDefender=attacker.isAttacker ? defender : attacker;
      const specialBlockSound=blockSoundDefender && ((blockSoundDefender._specialDisbalanceBlockFrame===GameTime)||(blockSoundDefender._criticalDisbalanceBlockFrame===GameTime));
      $.S.play(typeof blockClashSoundFor==='function'?blockClashSoundFor(blockSoundDefender):'block',specialBlockSound?0.75:undefined);
    }
  }
  if(typeof triggerHitstop==='function') triggerHitstop(strongSwing?3:2,strongSwing?3:1.5);
  attacker._clashFrame=GameTime;
  defender._clashFrame=GameTime;
  if(typeof addRage==='function'){
    const rageGain=100/sv('rageper')*0.5;
    addRage(attacker,rageGain);
    addRage(defender,rageGain);
  }
  const otherBot=attacker===P?defender:(defender===P?attacker:null);
  if(otherBot && typeof isBot==='function' && isBot(otherBot) && typeof switchSmartBot==='function') switchSmartBot(otherBot);
  if(typeof aiNotifyContact==='function') aiNotifyContact();
}

function tapeswordWorldSegments(ent,nodes){
  const baseLen=weaponLenFor(ent);
  const worldScale=effSwordScale(ent)*sv('swlen')*(isBot(ent)?sv('botswordscale'):1);
  const count=nodes.length-1;
  const links=Number.isFinite(ent._tapeswordLinks)?ent._tapeswordLinks:TAPESWORD_BASE_LINKS;
  const segments=[];

  for(let i=1;i<nodes.length;i++){
    const active=$.M.clamp(links-(i-1),0,1);
    if(active<=0.001) continue;
    segments.push(
      tapeswordSegmentCollisionLine(nodes[i-1],nodes[i],ent,i,count,baseLen,worldScale)
    );
  }
  return segments;
}

function tapeswordUpdateEntity(ent,dt,entities){
  if(!ent || weaponKeyOf(ent)!=='tapesword' || ent.hasWeapon===false){ if(ent&&ent._tapeswordNodes) resetTapeswordCombat(ent); return; }
  const remoteD=typeof NET_SYNC!=='undefined'&&NET_SYNC.active&&ent===D;
  if(isBot(ent) && !remoteD){
    const down=tapeswordBotDown(ent,dt);
    tapeswordInput(ent,down,dt);
  }
  tapeswordUpdateLength(ent,dt);
  const nodes=tapeswordWorldNodes(ent);
  const segments=tapeswordWorldSegments(ent,nodes);
  if(remoteD) return;
  const tip=nodes[nodes.length-1];
  if(tip && (tip.x<0||tip.y<0||tip.x>WORLD_W||tip.y>WORLD_H)) ent._tapeswordGrowthBlocked=true;

  let blockTouchingThisFrame=false;
  let firstBlockContact=null;

  for(const other of entities){
    if(!other||other===ent||other.hp<=0) continue;
    if(typeof FactionRules!=='undefined'&&!FactionRules.canFight(ent,other)) continue;
    const blockContact=tapeswordBlockContact(ent,other,nodes,segments);
    if(blockContact){
      blockTouchingThisFrame=true;
      if(!firstBlockContact) firstBlockContact=blockContact;

      // This specific defender cannot take tapesword damage for 0.5 sec
      // after successfully blocking it.
      if(!(ent._tapeswordNoDamageUntil instanceof Map)){
        ent._tapeswordNoDamageUntil=new Map();
      }
      ent._tapeswordNoDamageUntil.set(other,GameTime+0.5);

      // BLOCK IS NOW VISUAL/DEFENSIVE ONLY:
      // it must NOT influence tape movement, angle, angular velocity,
      // inertia, folding, growth, or curl direction.
      //
      // The defender that blocked the tape is still protected from
      // a body-hit while this blocking contact exists.
      if(!(ent._tapeswordBodyIgnore instanceof Set)){
        ent._tapeswordBodyIgnore=new Set();
      }
      ent._tapeswordBodyIgnore.add(other);

      // Intentionally DO NOT call:
      //   tapeswordReflectFromBlock(...)
      //   applyTapeswordWeaponContact(...)
      // and DO NOT set:
      //   _tapeswordForceFoldNow
      //   _tapeswordGrowthBlocked
      //   _tapeswordForceRelease
      //
      // So the tape continues exactly along its normal player-driven motion.

      if(GameTime>=(ent._tapeswordBlockCD||0)){
        ent._tapeswordBlockCD=GameTime+0.2;

        // Restore the original clash response:
        // recoil / deflection / knockback / normal clash FX.
        // Damage immunity for this defender is handled separately above
        // by _tapeswordNoDamageUntil and remains active for 0.5 sec.
        tapeswordClashFeedback(ent,other,blockContact);

        // Keep the real clash recoil, but make the tape itself curl
        // only one third as strongly from that recoil.
        ent._tapeswordBlockBendScaleUntil=GameTime+0.35;
      }
    }
    let bodyHit=false;

    // Collision with the body may still be detected normally,
    // but damage is suppressed for 0.5 sec after THIS enemy blocked.
    if(!blockContact){
      for(const seg of segments){
        bodyHit=tapeswordSegmentHitsBody(seg.a,seg.b,other);
        if(bodyHit) break;
      }
    }

    const noDamageUntil=
      ent._tapeswordNoDamageUntil instanceof Map
        ? (ent._tapeswordNoDamageUntil.get(other)||0)
        : 0;

    const damageBlockedByRecentParry=GameTime<noDamageUntil;

    const last=ent._tapeswordHitAt.get(other)||-999;
    if(
      bodyHit &&
      !damageBlockedByRecentParry &&
      GameTime-last>=TAPESWORD_HIT_COOLDOWN
    ){
      ent._tapeswordHitAt.set(other,GameTime);
      const dmg=tapeswordDamage(ent);
      applyDamage(other,dmg,ent,{playSound:true});
      if(typeof NET_SYNC!=='undefined'&&$.NET.active()&&ent===P&&other===D){
        $.NET.send({type:'hit',dmg,newHp:other.hp});
      }
    }
  }
  // Keep the one-time reversal protected while the SAME physical contact exists.
  ent._tapeswordBlockTouching=blockTouchingThisFrame;

  // Only after the tape has completely left the blocker AND forced-fold is over
  // may a future block perform a new reversal.
  if(!blockTouchingThisFrame){
    // No stale block state survives after physical contact ends.
    ent._tapeswordBlockReverseLocked=false;
    ent._tapeswordBlockReverseVel=0;
    ent._tapeswordBlockBendSign=0;
    ent._tapeswordBlockBendMag=0;
    ent._tapeswordBlockDeflectStart=0;
    ent._tapeswordBlockDeflectUntil=0;

    if(ent._tapeswordBodyIgnore instanceof Set){
      ent._tapeswordBodyIgnore.clear();
    }
  }

  // Remove expired per-enemy block immunity entries.
  if(ent._tapeswordNoDamageUntil instanceof Map){
    for(const [unit,until] of ent._tapeswordNoDamageUntil){
      if(GameTime>=until){
        ent._tapeswordNoDamageUntil.delete(unit);
      }
    }
  }

  if(typeof SurvivalMode!=='undefined'&&SurvivalMode.segmentHitObject){
    for(const seg of segments) SurvivalMode.segmentHitObject(seg.a.x,seg.a.y,seg.b.x,seg.b.y,3,0.35,true);
  }
}

function updateTapeswordCombat(dt){
  const entities=[];
  for(const ent of [P,D,...((typeof ALL_BOTS!=='undefined'&&ALL_BOTS)||[])]){
    if(ent && !entities.includes(ent)) entities.push(ent);
  }
  for(const ent of entities) if(ent&&ent.hp>0) tapeswordUpdateEntity(ent,dt,entities);
  if(typeof NET_SYNC!=='undefined'&&NET_SYNC.active&&D&&weaponKeyOf(D)==='tapesword') tapeswordWorldNodes(D);
}

function drawTapeswordSprite(c,ent,baseLen,glowColor,glowBlur){
  if(!ent._tapeswordRingImg){
    const base=(typeof PROJECT_PATH_AUDIO!=='undefined')?PROJECT_PATH_AUDIO:'';
    ent._tapeswordRingUrl=base+'Source/Weapon/Tapesword/T_TapeswordRing.png';
    ent._tapeswordRingImg=loadSpriteImage(ent._tapeswordRingUrl);
  }
  const nodes=ent._tapeswordNodes||tapeswordLocalNodes(ent,baseLen);
  const hand=ent._weaponImg,ring=ent._tapeswordRingImg;
  if(glowColor){c.shadowColor=glowColor;c.shadowBlur=glowBlur||0;}
  if(hand&&hand.complete&&hand.naturalWidth){
    const h=baseLen*0.34,w=h*spriteAspectFor(hand);
    c.drawImage(hand,-w/2,-h*0.12,w,h);
  }
  for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i];
    const seg=tapeswordSegmentVisualLine(a,b,ent,i,nodes.length-1,baseLen,1);
    const h=seg.h;
    if(h<=0.01) continue;
    c.save();c.translate((a.x+b.x)/2,(a.y+b.y)/2);c.rotate(Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2);
    if(ring&&ring.complete&&ring.naturalWidth){const w=h*spriteAspectFor(ring);c.drawImage(ring,-w/2,-h/2,w,h);}
    else{c.strokeStyle='#d8d8e0';c.lineWidth=4;c.beginPath();c.moveTo(0,-h/2);c.lineTo(0,h/2);c.stroke();}
    c.restore();
  }
  c.shadowBlur=0;
}
