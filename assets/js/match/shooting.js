"use strict";
/* =====================================================
   슈팅 · 골키퍼 선방 시스템

   [데이터 구조]
   · Striker : {x, y, finishing}  finishing = 골결정력 1~20 (FM 표기)
   · GK      : {x, y, reflexes}   reflexes  = 반사신경   1~20
   · Goal    : {x, y, width}      x,y = 골문 중앙 좌표, width = 골문 세로 폭
   · Ball    : {x, y, vx, vy}     정규화 좌표(0~1)와 속도. 애니메이션은 매 프레임 위치를 계산해 vx,vy를 갱신한다.

   [흐름] calculateShotResult(판정 + 목표 좌표 확정) → executeShootingAnimation(프레임별 좌표 계산)
===================================================== */
const SHOT_RESULT={GOAL:"GOAL", SAVED:"SAVED", MISSED:"MISSED", BLOCKED:"BLOCKED"};
/* 씬 종류 → 이미 확정된 슈팅 결과. 매치 시뮬레이션이 정한 결과를 2D 연출이 그대로 재현하기 위한 대응표 */
const SHOT_FORCED={
  shot_goal:SHOT_RESULT.GOAL, pen_goal:SHOT_RESULT.GOAL, shot_owngoal:SHOT_RESULT.GOAL,
  shot_save:SHOT_RESULT.SAVED, pen_miss:SHOT_RESULT.SAVED,
  shot_miss:SHOT_RESULT.MISSED
};
/* 선수 id로 능력치를 FM식 1~20으로 읽어온다 (필드 선수는 attr, 골키퍼는 gk 하위 항목) */
function playerAttr20(pid, key){
  if(pid==null) return 10;
  const p=(typeof findAnyPlayer==="function") ? findAnyPlayer(pid) : null;
  if(!p) return 10;
  if(key==="gkshot") return attr20((p.gk && p.gk.shot) || p.ovr); // 골키퍼 반사신경
  return attr20((p.attr && p.attr[key]) || p.ovr);
}
/* 슈팅 결과를 판정하고, 그 결과에 맞는 목표 좌표까지 한 번에 확정한다.

   판정은 두 선수의 능력치에 비례한 난수를 뽑아 맞붙이는 방식이다 —
     shotRoll = (0.45 + 0.55×골결정력/20) × 찬스의 질 × 난수,  saveRoll = (0.45 + 0.55×반사신경/20) × 난수
   유효슛 여부를 먼저 가리고(골결정력이 높을수록 골대 안으로 갈 확률↑), 유효슛이면 위 두 굴림을 비교해
   shotRoll이 이기면 GOAL, 지면 SAVED가 된다.
   능력치는 굴림의 "전체 크기"가 아니라 0.45를 기준으로 한 "우위"에만 곱해진다 — 그래야 20 대 1처럼
   극단적인 대결에서도 두 굴림의 범위가 겹쳐서, 최고의 공격수도 가끔 막히고 약한 키퍼도 가끔 선방한다.

   opts.forcedResult에 "GOAL"|"SAVED"|"MISSED"를 주면 판정을 건너뛰고 그 결과의 좌표만 계산한다 —
   이 게임의 매치 시뮬레이션(procMinute)은 전술·체력·팀 전력까지 반영해 이미 결과를 정해두므로,
   2D 연출은 그 결과를 받아 좌표만 뽑아 쓴다. 반대로 forcedResult 없이 부르면 이 함수 단독으로도
   슈팅 판정기로 동작한다. */
function calculateShotResult(striker, gk, goal, opts){
  opts=opts||{};
  const fin=clamp(striker&&striker.finishing||10, 1, 20);
  const ref=clamp(gk&&gk.reflexes||10, 1, 20);
  const quality=opts.quality!==undefined?opts.quality:1;   // 찬스의 질(1=보통, >1이면 결정적 기회)
  const dir=opts.dir||1;                                    // 공격 진행 방향(+1=오른쪽 골문)
  const half=(goal.width||GOAL_W)/2;
  let result=opts.forcedResult;
  if(!result){
    const onTarget = Math.random() < clamp(0.34+fin*0.021, 0.30, 0.78); // 골결정력↑ → 유효슛 확률↑
    if(!onTarget) result=SHOT_RESULT.MISSED;
    else{
      const shotRoll=(0.45+0.55*(fin/20))*quality*(0.55+Math.random()*0.85);
      const saveRoll=(0.45+0.55*(ref/20))*(0.55+Math.random()*0.85);
      result = shotRoll>saveRoll ? SHOT_RESULT.GOAL : SHOT_RESULT.SAVED;
    }
  }
  const side = Math.random()<0.5 ? -1 : 1;                 // 골문 좌/우(위/아래) 어느 쪽을 노렸는가
  let target, savePoint=null, deflect=null;
  if(result===SHOT_RESULT.MISSED){
    // 골포스트 바깥 — 살짝 빗나간 것부터 크게 뜬 것까지
    target={x:goal.x+dir*0.03, y:clamp01(goal.y+side*(half+0.03+Math.random()*0.10))};
  } else {
    // 골문 안쪽(그물). 골결정력이 높을수록 구석을 더 정확히 노린다.
    const corner=0.45+ (fin/20)*0.45;                       // 0.45~0.90 (골문 반폭 대비)
    target={x:goal.x, y:clamp01(goal.y+side*half*corner)};
    if(result===SHOT_RESULT.SAVED){
      // 골키퍼가 닿는 지점 — 골라인 바로 앞에서 쳐낸다
      savePoint={x:lerp(goal.x, (striker?striker.x:goal.x), 0.14), y:target.y};
      // 쳐낸 공은 골대 밖 코너킥 방향(공을 쳐낸 쪽 코너 플래그)으로 굴절된다
      deflect={x:goal.x, y: side<0 ? 0.03 : 0.97};
    }
  }
  return {result, target, savePoint, deflect, side, finishing:fin, reflexes:ref};
}
/* 슈팅 한 장면의 프레임별 좌표를 계산한다. 진행률 t(0~1)를 받아 그 순간의 공·슈터·골키퍼 위치를 돌려준다.

   0.00~0.18  백스윙 — 슈터가 발을 뒤로 뺐다가
   0.18       임팩트 — 공이 출발
   이후 결과별로:
     GOAL   : 공이 골망까지 포물선으로 날아가고, 골키퍼는 반대쪽으로 몸을 날리지만 닿지 않는다
     SAVED  : 공이 세이브 지점까지 날아가는 동안 골키퍼가 먼저 도달해 쳐내고, 그 순간부터 공은
              코너킥 방향으로 굴절돼(방향이 꺾여) 튀어나간다
     MISSED : 공이 골포스트 옆으로 높이 뜬 채 그대로 빠져나간다 */
/* 슛은 "슛!" 자막이 뜨는 shot_action 씬에서 실제로 때려지고, 결과 씬(골/선방/빗나감)이 공중에 떠 있는
   공을 그 지점부터 이어받는다. 이 인계 지점은 슛 지점→골문 중앙 사이의 고정 비율이라, 두 씬이 각각
   따로 계산해도 정확히 같은 좌표가 나와 궤적이 끊기지 않는다. */
const SHOT_HANDOFF=0.35;
function shotHandoffXY(stage, atkSide){ return lerpXY(stage, {x:GOAL_X[atkSide], y:0.5}, SHOT_HANDOFF); }
/* opts.from      — 공이 출발하는 지점(이어받기면 공중의 인계 지점)
   opts.noWindup  — 이미 shot_action에서 때렸으므로 백스윙 없이 곧바로 비행부터 시작 */
function executeShootingAnimation(plan, t, stage, gkBase, opts){
  opts=opts||{};
  const R=SHOT_RESULT;
  const cont=!!opts.noWindup;
  const from=opts.from||stage;
  const w=cont?0:0.18;                        // 백스윙 구간
  const out={ball:{x:from.x,y:from.y}, lift:0, striker:{x:stage.x,y:stage.y}, gk:null, phase:"windup", impact:false};
  if(!cont && t<w){
    // 백스윙 — 발을 뒤로 뺐다가 차는 동작
    out.striker=lerpXY(stage, {x:clamp01(stage.x-(plan.dir||1)*0.03), y:stage.y}, Math.sin(seg(t,0,w)*Math.PI));
    out.phase="windup";
    return out;
  }
  out.impact=true;
  // 공이 뜬 높이는 "슛 지점→목표까지 전체 거리 중 얼마나 왔는가"로 계산한다 — 이어받기여도 인계 지점의
  // 높이에서 자연스럽게 이어져 포물선이 끊기지 않는다.
  const arc=(fl)=> cont ? SHOT_HANDOFF+(1-SHOT_HANDOFF)*fl : fl;
  if(plan.result===R.GOAL){
    out.phase="flight";
    const end=cont?0.55:0.80;
    const fly=easeOutQ(seg(t,w,end));
    out.ball=lerpXY(from, plan.target, fly);
    out.lift=Math.sin(arc(fly)*Math.PI)*0.8;
    if(gkBase){ // 반대 방향으로 몸을 날리지만 이미 늦었다 — 반사신경이 좋을수록 더 멀리 뻗는다
      const reach=0.10+(plan.reflexes/20)*0.06;
      const dive={x:gkBase.x, y:clamp01(gkBase.y + (plan.target.y>0.5?-reach:reach))};
      out.gk=lerpXY(gkBase, dive, easeOutQ(seg(t, w, end*0.92)));
    }
    if(seg(t,w,end)>=1) out.phase="scored";
  } else if(plan.result===R.SAVED){
    const sp=plan.savePoint||plan.target;
    const contact=cont?0.42:0.60;              // 공과 골키퍼가 만나는 시점
    if(t<contact){
      out.phase="flight";
      const fly=easeOutQ(seg(t,w,contact));
      out.ball=lerpXY(from, sp, fly);
      out.lift=Math.sin(arc(fly)*Math.PI)*0.6;
    } else {
      // ── 굴절: 골키퍼에 맞은 지점부터는 물리 시뮬레이션 궤적을 그대로 따라간다
      //    (반사 → 마찰 감속 → 정지까지 이어지므로 연출이 중간에 끊기지 않는다)
      out.phase="deflected";
      const d=seg(t,contact,1);
      const smp = opts.rebound ? sampleTrajectory(opts.rebound, d) : null;
      if(smp){ out.ball={x:smp.x, y:smp.y}; out.lift=smp.lift; }
      else { out.ball=lerpXY(sp, plan.deflect||sp, easeOutQ(d)); out.lift=bounceLift(d, 2, 0.45); }
    }
    if(gkBase){ // 공보다 먼저 세이브 지점에 도달해야 "막았다"로 보인다
      const arrive=contact*(0.98-(plan.reflexes/20)*0.24); // 반사신경↑ → 더 빨리 붙는다
      out.gk=lerpXY(gkBase, sp, easeOutQ(seg(t, 0, arrive)));
    }
  } else { // MISSED
    out.phase="wide";
    const end=cont?0.75:1;
    const fly=easeOutQ(seg(t,w,end));
    out.ball=lerpXY(from, plan.target, fly);
    out.lift=Math.sin(arc(fly)*Math.PI)*1.0;   // 크게 뜬 슛
    if(gkBase){
      const track={x:gkBase.x, y:clamp01(lerp(gkBase.y, plan.target.y, 0.5))};
      out.gk=lerpXY(gkBase, track, easeOutQ(seg(t, w, end*0.8)));
    }
  }
  return out;
}
function sideOfPlayer(form, pid){
  if(form.h.some(d=>d.id===pid)) return "h";
  if(form.a.some(d=>d.id===pid)) return "a";
  return null;
}
/* 빌드업(패스 연결)에 참여할 동료를 공격 방향 기준 앞쪽에서 고른다 */
function pickSupport(form, side, excludeIds, n, atkSide){
  const arr=(side==="h"?form.h:form.a).filter(d=>d.pos!=="GK" && excludeIds.indexOf(d.id)<0);
  arr.sort((a,b)=> atkSide==="h" ? b.x-a.x : a.x-b.x);
  return arr.slice(0,n).map(d=>d.id);
}
/* 무작위 목표 지점·등장인물처럼 "씬마다 딱 한 번만 정해져야 하는 값"을 최초 재생 시점에 계산해 박제한다.
   매 프레임 다시 뽑으면 공 방향이나 항의하러 오는 선수가 프레임마다 바뀌어 보이기 때문이다. */
/* 씬의 진행률(0~1) 위에 자막이 바뀌는 지점(비트)을 깔아 둔다.
   type:"__EVENT__" 은 매치 시뮬레이션이 만들어 둔 이벤트 문장(e.txt)을 그대로 띄우라는 뜻이고,
   그 외에는 COMM_DB에서 상황에 맞는 문장을 골라 띄운다.
   → 빌드업 씬은 "패스 → 패스 → 돌파 → 슛!"이 화면 동작과 같은 타이밍에 순서대로 흘러간다. */
function buildCommentaryBeats(e, sc, form){
  if(!sc) return [{at:0, type:"__EVENT__"}];
  const teamName = form ? (sc.atkSide==="a"?form.aShort:form.hShort) : "";
  const oppName  = form ? (sc.atkSide==="a"?form.hShort:form.aShort) : "";
  const nameOf=(pid)=>{ const d=(pid!=null&&form)?findFormationXY(form,pid):null; return d?d.name:null; };
  const base={team:teamName, opponentTeam:oppName};
  if(sc.kind==="shot_action"){
    const sup=e._sup||[];
    const shooter=nameOf(sc.shooterId);
    const gkName=nameOf(sc.gkId);
    const beats=[];
    if(sup.length>=2){
      beats.push({at:0.00, type:"PASS",    data:{...base, player:nameOf(sup[0])||shooter}});
      beats.push({at:0.27, type:"PASS",    data:{...base, player:nameOf(sup[1])||shooter}});
    }
    beats.push({at:0.53, type:"DRIBBLE",   data:{...base, player:shooter, opponentPlayer:gkName||"수비수"}});
    beats.push({at:0.82, type:"__EVENT__"}); // 임팩트 순간에 "{선수}의 슛!"
    return beats;
  }
  // 결과 씬 — 공이 결판나는 순간에 결과 자막을 띄운다
  const at=SCENE_CAPTION_AT[sc.kind];
  return [{at: at!==undefined?at:0, type:"__EVENT__"}];
}
function prepScene(e){
  if(e._prepped) return; e._prepped=true;
  const sc=e.scene; if(!sc) return;
  const form=e.form;
  if(sc.kind==="shot_goal"||sc.kind==="pen_goal"||sc.kind==="shot_owngoal"||sc.kind==="shot_save"||sc.kind==="pen_miss"){
    e._goalY=0.40+Math.random()*0.20;
  } else if(sc.kind==="shot_miss"){
    e._goalY=Math.random()<0.5?0.06:0.94;
  } else if(sc.kind==="shot_corner"){
    e._goalY=Math.random()<0.5?0.02:0.98;
  }
  e._celebY=Math.random()<0.5?0.10:0.90; // 득점 후 달려갈 코너 방향
  // 슈팅 계열이면 판정 결과에 맞는 좌표(골망/세이브 지점/굴절 지점)를 여기서 한 번만 확정한다
  const forced = SHOT_FORCED[sc.kind];
  if(forced && form){
    const dir=sc.atkSide==="h"?1:-1;
    const isPen = sc.kind==="pen_goal"||sc.kind==="pen_miss";
    // 자책골이어도 슛 지점은 "공을 찬 선수" 기준으로 잡아야 한다 — 직전 shot_action이 그 선수 기준으로
    // 인계 지점을 계산했으므로, 굴절시킨 수비수 기준으로 잡으면 공이 순간이동한 것처럼 보인다.
    const stageOwnerId = sc.shooterId!=null ? sc.shooterId : sc.ogScorerId;
    const shooterXY = findFormationXY(form, stageOwnerId);
    const stage = isPen ? {x:sc.atkSide==="h"?0.88:0.12, y:0.5} : shotStageXY(sc.atkSide, shooterXY);
    const gkXY = findFormationXY(form, sc.gkId);
    e._shot = calculateShotResult(
      {x:stage.x, y:stage.y, finishing: playerAttr20(stageOwnerId, "fin")},
      gkXY ? {x:gkXY.x, y:gkXY.y, reflexes: playerAttr20(sc.gkId, "gkshot")} : null,
      {x:GOAL_X[sc.atkSide], y:0.5, width:GOAL_W},
      {forcedResult:forced, dir}
    );
    e._shot.dir=dir;
    e._stage=stage;
    // 접촉 이후(쳐냄) 궤적을 물리로 미리 굴려 둔다 — 렌더러는 이 궤적을 샘플링만 한다
    if(forced===SHOT_RESULT.SAVED && e._shot.savePoint){
      const inc={x:(e._shot.savePoint.x-stage.x), y:(e._shot.savePoint.y-stage.y)};
      const L=HYP(inc.x*PITCH_AR, inc.y)||1;
      const sp=BALL_BASE_SPEED*(0.42+0.58*(playerAttr20(stageOwnerId,"fin")/20));
      e._reb=simulateDeflection(e._shot.savePoint, {vx:inc.x/L*sp, vy:inc.y/L*sp}, "PARRY",
              {goalX:GOAL_X[sc.atkSide], cornerY:(e._shot.deflect?e._shot.deflect.y:0.03)});
    }
  }
  // 맞고 튕겨나가는 각도·세기 — 씬마다 한 번만 뽑아야 리바운드 방향이 프레임마다 안 바뀐다
  e._rebAng=(Math.random()-0.5)*1.5;                  // 되반사에서 좌우로 틀리는 각도(라디안)
  e._rebDist=0.16+Math.random()*0.14;                 // 튕겨나가는 거리(등방 좌표 기준)
  if(!form){ e._beats=buildCommentaryBeats(e, sc, null); return; }
  if(sc.kind==="shot_action"){ // 빌드업에 관여할 두 명
    e._sup=pickSupport(form, sc.atkSide, [sc.shooterId], 2, sc.atkSide);
  }
  if(sc.kind==="shot_block" && form){
    // 수비수 몸에 맞고 튕겨나가는 궤적 — 반사각·감속·바운스를 물리로 계산해 둔다
    const shooterXY=findFormationXY(form, sc.shooterId);
    const stage=shotStageXY(sc.atkSide, shooterXY);
    const target=goalMouthXY(sc.atkSide, e._goalY!==undefined?e._goalY:0.5);
    const bp=lerpXY(stage, target, SHOT_HANDOFF+0.17);
    const inc={x:bp.x-stage.x, y:bp.y-stage.y};
    const L=HYP(inc.x*PITCH_AR, inc.y)||1;
    const sp=BALL_BASE_SPEED*(0.42+0.58*(playerAttr20(sc.shooterId,"fin")/20));
    const blockerXY=findFormationXY(form, sc.blockerId);
    e._reb=simulateDeflection(bp, {vx:inc.x/L*sp, vy:inc.y/L*sp}, "BLOCK",
            {obj:{x:bp.x, y:bp.y, radius:DEF_RADIUS}, spread:e._rebAng||0}); // 접촉 지점 = 렌더러의 blockPoint
  }
  if(sc.kind==="card_yellow"||sc.kind==="card_red"||sc.kind==="foul"||sc.kind==="injury"){
    const side=sideOfPlayer(form, sc.playerId);
    const me=findFormationXY(form, sc.playerId);
    if(side && me){
      const mates=(side==="h"?form.h:form.a).filter(d=>d.id!==sc.playerId && d.pos!=="GK");
      mates.sort((a,b)=> distXY(a,me)-distXY(b,me));
      if(sc.kind==="injury") e._helper = mates.length?mates[0].id:null; // 부상 선수에게 다가올 동료
      else e._protest = mates.slice(0,2).map(d=>d.id);                 // 심판에게 몰려가 항의할 동료
    }
  }
  // 자막 비트는 _sup(빌드업 참여 선수) 등 위에서 정한 등장인물을 참조하므로 반드시 마지막에 만든다
  e._beats=buildCommentaryBeats(e, sc, form);
}
/* 이벤트 하나(e)를 진행률 t(0~1)에 맞춰 어떻게 그릴지 계산한다.
   반환: {overrides:{id:{x,y}}, fade:{id:0~1}, ball:{x,y}|null, lift:0~1(공이 뜬 높이),
          ring:{id,color,alpha}|null, badge:string|null, refTarget:{x,y}|null, card:{color,at,raise}|null} */
function computeSceneFrame(e, t){
  const sc=e.scene, form=e.form;
  const overrides={}, fade={};
  let ball=null, lift=0, ring=null, badge=null, refTarget=null, card=null;
  if(!sc || !form) return {overrides, fade, ball, lift, ring, badge, refTarget, card};
  const xyOf=(pid)=> pid==null?null:findFormationXY(form, pid);
  const shooterXY=xyOf(sc.shooterId), gkXY=xyOf(sc.gkId), blockerXY=xyOf(sc.blockerId), ogXY=xyOf(sc.ogScorerId), playerXY=xyOf(sc.playerId);
  const dir = sc.atkSide==="h" ? 1 : -1; // 공격 진행 방향(+1=오른쪽 골문)
  const stageOf=()=> shooterXY ? shotStageXY(sc.atkSide, shooterXY) : {x:sc.atkSide==="h"?0.72:0.28, y:0.5};
  // 슛 직전 백스윙(발을 뒤로 뺐다가 차는 동작) — 모든 슈팅 계열이 공유한다
  switch(sc.kind){
    case "kickoff": case "ht": case "ft": {
      ball={x:0.5,y:0.5}; refTarget={x:0.5,y:0.38};
      break;
    }
    /* ── 빌드업 → 드리블 → 백스윙 → 임팩트 ──
       "{선수}의 슛!" 자막이 뜨는 씬이 곧 이 씬이므로, 여기서 실제로 공을 때려야 자막과 화면이 맞는다.
       때린 공은 인계 지점까지 날아가고, 결과(골/선방/빗나감) 씬이 그 지점부터 이어받는다. */
    case "shot_action": {
      const stage=stageOf();
      const sup=e._sup||[];
      const p1XY=xyOf(sup[0]), p2XY=xyOf(sup[1]);
      const recv = shooterXY ? lerpXY(shooterXY, stage, 0.45) : stage; // 패스를 받는 지점
      const WIND=0.70, HIT=0.82;                                       // 백스윙 시작 / 임팩트 시점
      const handoff=shotHandoffXY(stage, sc.atkSide);
      // 드리블 구간의 "공이 발보다 살짝 앞" 오프셋 — 구간 경계에서 뚝 붙었다 떨어지지 않도록
      // 시작할 때 서서히 넣고 임팩트 직전에 서서히 뺀다. 임팩트도 이 위치에서 그대로 출발한다.
      const dribP=(tt)=>clamp01(seg(tt,0.51,WIND));
      const footBall=(tt)=>{
        const pd=dribP(tt);
        const c=dribbleXY(recv, stage, pd);
        const off=dir*0.018*Math.min(1, pd*6)*(1-clamp01(seg(tt,WIND*0.94,WIND)));
        return {x:clamp01(c.x+off), y:c.y};
      };
      if(t>=HIT){
        // 임팩트 — 드리블이 끝난 그 지점에서 공이 발을 떠나 골문 쪽으로 날아간다
        const from=footBall(WIND);
        const fl=easeOutQ(seg(t,HIT,1));
        ball=lerpXY(from, handoff, fl);
        lift=Math.sin(SHOT_HANDOFF*fl*Math.PI)*0.8;
      } else if(p1XY && p2XY){
        if(t<0.18){ ball=lerpXY(p1XY, p2XY, easeOutQ(seg(t,0,0.18))); lift=Math.sin(seg(t,0,0.18)*Math.PI)*0.35; }
        else if(t<0.25){ ball={x:p2XY.x, y:p2XY.y}; }                          // 트래핑
        else if(t<0.44){ ball=lerpXY(p2XY, recv, easeOutQ(seg(t,0.25,0.44))); lift=Math.sin(seg(t,0.25,0.44)*Math.PI)*0.35; }
        else if(t<0.51){ ball={x:recv.x, y:recv.y}; }                          // 트래핑
        else { ball=footBall(t); }   // 공은 발보다 살짝 앞
      } else {
        if(t<0.42) ball=lerpXY(shooterXY||stage, recv, easeOutQ(seg(t,0,0.42)));
        else ball=footBall(t);
      }
      if(p1XY && p2XY){
        overrides[sup[0]]=lerpXY(p1XY, {x:clamp01(p1XY.x+dir*0.08), y:p1XY.y}, seg(t,0.08,0.60)); // 패스 후 침투
        overrides[sup[1]]=lerpXY(p2XY, {x:clamp01(p2XY.x+dir*0.10), y:p2XY.y}, seg(t,0.30,0.80));
      }
      if(shooterXY){
        overrides[sc.shooterId] =
            t<0.51 ? lerpXY(shooterXY, recv, easeInOutQ(seg(t,0.12,0.48)))                                   // 받으러 나온다
          : t<WIND ? dribbleXY(recv, stage, seg(t,0.51,WIND))                                                // 몰고 전진
          : t<HIT  ? lerpXY(stage, {x:clamp01(stage.x-dir*0.03), y:stage.y}, Math.sin(seg(t,WIND,HIT)*Math.PI)) // 백스윙
                   : lerpXY(stage, {x:clamp01(stage.x+dir*0.025), y:stage.y}, easeOutQ(seg(t,HIT,1)));       // 팔로스루
      }
      if(gkXY && ball) overrides[sc.gkId]=lerpXY(gkXY, {x:lerp(gkXY.x, GOAL_X[sc.atkSide], 0.10), y:lerp(gkXY.y, ball.y, 0.35)}, easeInOutQ(t)); // 각 좁히기
      refTarget = ball ? refPostXY(ball, dir) : null;
      break;
    }
    case "pen_action": {
      const spot={x: sc.atkSide==="h"?0.88:0.12, y:0.5};
      if(shooterXY) overrides[sc.shooterId]=lerpXY(shooterXY, {x:clamp01(spot.x-dir*0.05), y:0.5}, easeInOutQ(seg(t,0.25,1)));
      ball={x:spot.x, y:spot.y};
      if(gkXY) overrides[sc.gkId]={x:clamp01(GOAL_X[sc.atkSide]-dir*0.012), y:0.5};
      refTarget={x:clamp01(spot.x-dir*0.06), y:0.62};
      badge = t<0.40 ? "🅿️ 페널티킥 선언" : null;
      break;
    }
    /* ── 슈팅 결과 ── 좌표 계산은 executeShootingAnimation이 전담하고, 여기서는 그 결과를 씬에 얹기만 한다 */
    case "shot_goal": case "pen_goal": case "shot_owngoal": {
      const isOG = sc.kind==="shot_owngoal";
      // 자책골에서도 슛 모션은 실제로 찬 선수가 한다 — 굴절시킨 수비수는 제자리에서 공에 맞을 뿐이다
      const striker = sc.shooterId!=null ? sc.shooterId : sc.ogScorerId;
      const strikerXY = shooterXY || ogXY;
      const stage = e._stage || stageOf();
      const isPenG = sc.kind==="pen_goal";
      const shot = executeShootingAnimation(e._shot||{result:SHOT_RESULT.GOAL, target:goalMouthXY(sc.atkSide,0.5), dir}, t, stage, gkXY,
                     isPenG?null:{noWindup:true, from:shotHandoffXY(stage, sc.atkSide)}); // 이미 shot_action에서 때렸다
      ball=shot.ball; lift=shot.lift;
      if(gkXY && shot.gk) overrides[sc.gkId]=shot.gk;
      if(strikerXY){
        // 임팩트까지는 슈팅 모션, 골이 들어간 뒤(0.62~)에는 코너 쪽으로 달려가는 세리머니
        overrides[striker] = t<0.62 ? shot.striker
          : lerpXY(stage, {x:clamp01(stage.x+dir*0.08), y:isOG?stage.y:(e._celebY!==undefined?e._celebY:stage.y)}, easeInOutQ(seg(t,0.62,1)));
      }
      if(t>0.62) badge = isOG ? "😱 자책골" : "⚽ GOAL!";
      refTarget = t<0.62 ? refPostXY(ball, dir) : {x:0.5,y:0.5};
      break;
    }
    case "shot_save": case "pen_miss": {
      // 골키퍼가 쳐내고, 그 지점부터 공이 코너킥 방향으로 굴절된다 (executeShootingAnimation의 SAVED 분기)
      const stage = e._stage || stageOf();
      const isPenS = sc.kind==="pen_miss";
      const shot = executeShootingAnimation(e._shot||{result:SHOT_RESULT.SAVED, target:goalMouthXY(sc.atkSide,0.5), savePoint:stage, deflect:stage, dir}, t, stage, gkXY,
                     isPenS?{rebound:e._reb}:{noWindup:true, from:shotHandoffXY(stage, sc.atkSide), rebound:e._reb});
      ball=shot.ball; lift=shot.lift;
      if(shooterXY) overrides[sc.shooterId]=shot.striker;
      if(gkXY && shot.gk) overrides[sc.gkId]=shot.gk;
      if(shot.phase==="deflected") badge="🧤 선방!";
      refTarget = refPostXY(ball, dir);
      break;
    }
    case "shot_block": {
      const stage=stageOf();
      const target=goalMouthXY(sc.atkSide, e._goalY!==undefined?e._goalY:0.5);
      // 차단 지점은 반드시 인계 지점(SHOT_HANDOFF)보다 앞이어야 한다 — 그렇지 않으면 이어받은 공이
      // 뒤로 되돌아가는 것처럼 보인다.
      const blockPoint=lerpXY(stage, target, SHOT_HANDOFF+0.17);
      const hoB=shotHandoffXY(stage, sc.atkSide); // 이미 때린 공을 공중에서 이어받는다
      if(shooterXY) overrides[sc.shooterId]={x:stage.x,y:stage.y};
      if(blockerXY) overrides[sc.blockerId]=lerpXY(blockerXY, blockPoint, easeOutQ(seg(t,0,0.34))); // 몸을 던져 막으러 온다
      const flyB=easeOutQ(seg(t,0,0.38));
      const reb=seg(t,0.38,1); // 수비수 몸(blockPoint)에 맞고 튕겨나간다
      const rbSmp = (t>=0.38 && e._reb) ? sampleTrajectory(e._reb, reb) : null;
      ball = t<0.38 ? lerpXY(hoB, blockPoint, flyB)
           : rbSmp ? {x:rbSmp.x, y:rbSmp.y}
                   : ricochetXY(hoB, blockPoint, e._rebAng||0, (e._rebDist||0.2)*0.85, reb);
      // 인계 지점의 높이에서 그대로 이어지도록 shot_action과 같은 진폭(0.8)의 포물선을 쓴다
      lift = t<0.38 ? Math.sin((SHOT_HANDOFF+(1-SHOT_HANDOFF)*flyB*0.35)*Math.PI)*0.8
           : rbSmp ? rbSmp.lift : bounceLift(reb, 2, 0.5);
      if(t>0.38) badge="🛡️ 블로킹";
      refTarget = refPostXY(ball, dir);
      break;
    }
    case "shot_miss": {
      const stage = e._stage || stageOf();
      const shot = executeShootingAnimation(e._shot||{result:SHOT_RESULT.MISSED, target:{x:sc.atkSide==="h"?1.03:-0.03, y:0.06}, dir}, t, stage, gkXY,
                     {noWindup:true, from:shotHandoffXY(stage, sc.atkSide)});
      ball=shot.ball; lift=shot.lift;
      if(shooterXY) overrides[sc.shooterId]=shot.striker;
      if(gkXY && shot.gk) overrides[sc.gkId]=shot.gk;
      if(t>0.70) badge="😵 빗나감";
      refTarget=refPostXY(ball, dir); // 고정 중간지점을 쓰면 공이 그 위를 지나가 심판과 겹친다 — 공 기준 이격 위치로 계산
      break;
    }
    case "shot_corner": {
      const stage=stageOf();
      const cornerY=e._goalY!==undefined?e._goalY:0.02;
      const target={x: sc.atkSide==="h"?0.99:0.01, y:cornerY};
      const hoC=shotHandoffXY(stage, sc.atkSide); // 이미 때린 공을 공중에서 이어받는다
      if(shooterXY) overrides[sc.shooterId]={x:stage.x,y:stage.y};
      if(gkXY) overrides[sc.gkId]=lerpXY(gkXY, {x:gkXY.x, y:clamp01(gkXY.y+(cornerY<0.5?-0.10:0.10))}, easeOutQ(seg(t,0,0.55)));
      const flyC=easeOutQ(seg(t,0,0.72));
      ball = lerpXY(hoC, target, flyC);
      lift = Math.sin((SHOT_HANDOFF+(1-SHOT_HANDOFF)*flyC)*Math.PI)*0.7;
      if(t>0.72) badge="🚩 코너킥";
      refTarget=refPostXY(ball, dir);
      break;
    }
    case "var_check": { ball={x:0.5,y:0.5}; refTarget={x:0.5,y:0.20}; badge="🖥️ VAR 확인 중"; break; }
    case "var_overturn": { ball={x:0.5,y:0.5}; refTarget={x:0.5,y:0.20}; badge="🚫 판정 번복"; break; }
    /* ── 파울·카드: 심판이 달려오고, 당사자와 동료들이 몰려가 항의한다 ── */
    case "foul": case "card_yellow": case "card_red": {
      if(!playerXY) break;
      const spot=playerXY;
      const refSpot={x:clamp01(spot.x+0.045), y:clamp01(spot.y+0.05)}; // 심판이 서는 자리
      refTarget=refSpot;
      const near=lerpXY(spot, lerpXY(spot, refSpot, 0.55), easeOutQ(seg(t,0.15,0.45))); // 심판 쪽으로 한 발
      const ag = t>0.40 ? agitate(sc.playerId, t, 0.012) : {x:0,y:0};                   // 흥분해 항의
      overrides[sc.playerId]={x:clamp01(near.x+ag.x), y:clamp01(near.y+ag.y)};
      for(const pid of (e._protest||[])){
        const mXY=xyOf(pid); if(!mXY) continue;
        const dest={x:clamp01(refSpot.x-0.05), y:clamp01(refSpot.y+(mXY.y>refSpot.y?0.055:-0.055))};
        const mv=lerpXY(mXY, dest, easeInOutQ(seg(t,0.20,0.60)));
        const mag = t>0.50 ? agitate(pid, t, 0.010) : {x:0,y:0};
        overrides[pid]={x:clamp01(mv.x+mag.x), y:clamp01(mv.y+mag.y)};
      }
      ball={x:spot.x, y:spot.y}; // 공은 파울 지점에 멈춰 있다
      if(sc.kind==="foul"){
        ring={id:sc.playerId, color:"#d29922", alpha:0.35+0.65*Math.abs(Math.sin(t*Math.PI*4))};
        /* 🔵 카드 없는 반칙 — 주심이 휘슬을 든다. 카드 장면과 같은 문법으로 보이게 한다(요청). */
        const blown=seg(t,0.30,0.50);
        if(blown>0) card={color:"#eaf2fb", at:refSpot, raise:easeOutBack(blown), whistle:true};
        if(t>0.30) badge="🔵 파울";
      } else {
        const shown=seg(t,0.55,0.72); // 심판이 카드를 꺼내 높이 든다
        if(shown>0) card={color: sc.kind==="card_red"?"#f85149":"#e3b341", at:refSpot, raise:easeOutBack(shown)};
        ring={id:sc.playerId, color: sc.kind==="card_red"?"#f85149":"#e3b341", alpha:0.35+0.65*Math.abs(Math.sin(t*Math.PI*4))};
        if(t>0.55) badge = sc.kind==="card_red" ? "🟥 퇴장" : "🟨 경고";
      }
      if(sc.kind==="card_red" && t>0.78){ // 퇴장 선수는 터치라인 밖으로 걸어나간다
        const out={x:spot.x, y: spot.y<0.5 ? -0.04 : 1.04};
        overrides[sc.playerId]=lerpXY(near, out, easeInQ(seg(t,0.78,1)));
        fade[sc.playerId]=1-seg(t,0.86,1)*0.75;
      }
      break;
    }
    case "injury": { // 선수가 쓰러져 떨고, 동료와 심판이 다가온다
      if(!playerXY) break;
      const ag=agitate(sc.playerId, t, 0.006);
      overrides[sc.playerId]={x:clamp01(playerXY.x+ag.x), y:clamp01(playerXY.y+ag.y)};
      const hXY=xyOf(e._helper);
      if(hXY) overrides[e._helper]=lerpXY(hXY, {x:clamp01(playerXY.x-0.035), y:playerXY.y}, easeInOutQ(seg(t,0.20,0.75)));
      refTarget={x:clamp01(playerXY.x+0.05), y:clamp01(playerXY.y+0.05)};
      ring={id:sc.playerId, color:"#f85149", alpha:0.35+0.65*Math.abs(Math.sin(t*Math.PI*3))};
      ball={x:clamp01(playerXY.x+0.06), y:playerXY.y};
      badge="🚑 부상";
      break;
    }
    case "sub": { // 나가는 선수는 터치라인으로, 들어오는 선수는 그 자리로 뛰어들어온다
      const outXY=xyOf(sc.outId), inXY=xyOf(sc.inId);
      const slot=inXY||outXY;
      if(outXY){
        overrides[sc.outId]=lerpXY(outXY, {x:outXY.x, y: outXY.y<0.5?-0.04:1.04}, easeInOutQ(seg(t,0,0.55)));
        fade[sc.outId]=1-seg(t,0.35,0.60);
      }
      if(slot){
        overrides[sc.inId]=lerpXY({x:slot.x, y: slot.y<0.5?-0.04:1.04}, slot, easeOutQ(seg(t,0.45,1)));
        fade[sc.inId]=seg(t,0.45,0.70);
      }
      refTarget={x:0.5,y:0.5};
      badge="🔁 교체";
      break;
    }
  }
  return {overrides, fade, ball, lift, ring, badge, refTarget, card};
}
/* =====================================================
   슈팅 · 공 물리 굴절 시스템

   상태 관리와 분리된 순수 모듈이다. 판정(decideShotResult)과 물리 적분(executeShootingPhysics)이
   나뉘어 있고, 둘 다 외부 전역 상태를 읽지 않고 인자로 받은 객체만 다룬다.

   [데이터 구조]  좌표는 정규화(0~1). 피치 가로 1.0 ≈ 105m
     Striker  {x, y, finishing(1~20), shotPower(1~20)}
     GK       {x, y, reflexes(1~20), positioning(1~20), radius}
     Defender {x, y, blocking(1~20), radius}
     Ball     {x, y, vx, vy, radius, speed}      vx,vy = 초당 이동량
     Goal     {x(골라인), yTop, yBottom}

   [흐름]  decideShotResult() 로 결과를 먼저 확정 → launchShot() 으로 초기 속도 벡터 부여
           → executeShootingPhysics() 를 매 스텝 호출하며 충돌·굴절·마찰을 적분
===================================================== */
const SHOT_PHASE={ FLIGHT:"FLIGHT", DEFLECTED:"DEFLECTED", PARRIED:"PARRIED",
                   NETTED:"NETTED", WIDE:"WIDE", STOPPED:"STOPPED" };
const BALL_BASE_SPEED=0.62;   // 슛파워 20일 때의 기준 속도(정규화 단위/초)
const BALL_FRICTION=0.982;    // 1/60초당 감속률 — 굴절 후 서서히 멈춘다
const NET_DAMP=0.10;          // 그물 저항 (기획 조건: vx, vy *= 0.1)
const BALL_STOP=0.012;        // 이 속도 아래로 떨어지면 멈춘 것으로 본다
const GK_RADIUS=0.020, DEF_RADIUS=0.017, BALL_RADIUS=0.008;

/* 슛 경로(슈터 → 골문) 위에 있는 수비수인지 — 경로에서 수직으로 얼마나 벗어나 있는지로 판단 */
function inShotLane(d, striker, goal, laneWidth){
  const gx=(goal.x-striker.x)*PITCH_AR, gy=((goal.yTop+goal.yBottom)/2)-striker.y;
  const gl=HYP(gx,gy)||1;
  const px=(d.x-striker.x)*PITCH_AR, py=d.y-striker.y;
  const along=(px*gx+py*gy)/gl;                 // 경로 방향 성분
  if(along<=0 || along>gl) return false;        // 슈터 뒤 또는 골문 너머
  const perp=Math.abs(px*(gy/gl)-py*(gx/gl));   // 경로에서 벗어난 거리
  return perp <= (laneWidth||0.045);
}
/* 능력치 대결용 굴림 — 능력치는 굴림 전체가 아니라 0.4 기준의 "우위"에만 곱해진다.
   그래야 20 대 1 같은 극단적 대결에서도 이변이 아주 가끔은 나온다. */
function statRoll(stat, scale){
  return (0.40+0.60*(clamp(stat,1,20)/20))*(0.55+Math.random()*0.85)*(scale||1);
}
/* 슛 결과를 먼저 판정하고, 결과에 맞는 목표 좌표까지 확정한다.
   opts.forcedResult 를 주면 판정을 건너뛰고 좌표만 계산한다(매치 시뮬레이션이 이미 정한 결과 재현용). */
function decideShotResult(striker, gk, defenders, goal, opts){
  opts=opts||{};
  const fin=clamp(striker.finishing||10,1,20);
  const dir=opts.dir || (goal.x>striker.x ? 1 : -1);
  const mid=(goal.yTop+goal.yBottom)/2, half=(goal.yBottom-goal.yTop)/2;
  const lane=(defenders||[]).filter(d=>inShotLane(d, striker, goal));
  let blocker=null;
  if(lane.length) blocker=lane.reduce((a,b)=> (b.blocking||10)>(a.blocking||10)?b:a);

  let result=opts.forcedResult;
  if(!result){
    // 1) 수비 블락 — 길목에 선 수비수의 블로킹 vs 슈터의 결정력
    if(blocker && statRoll(blocker.blocking||10) > statRoll(fin)) result=SHOT_RESULT.BLOCKED;
    // 2) 골대 오프 — 결정력이 낮을수록 유효슛 확률이 떨어진다
    else if(Math.random() >= clamp(0.34+fin*0.021, 0.30, 0.78)) result=SHOT_RESULT.MISSED;
    else {
      // 3) 선방 vs 득점 — 골키퍼의 (반사신경+위치선정) 평균 vs 슈터의 결정력
      const gkStat=gk ? (((gk.reflexes||10)+(gk.positioning||10))/2) : 8;
      result = statRoll(fin, opts.quality||1) > statRoll(gkStat) ? SHOT_RESULT.GOAL : SHOT_RESULT.SAVED;
    }
  }
  if(result===SHOT_RESULT.BLOCKED && !blocker) result=SHOT_RESULT.MISSED; // 막을 사람이 없으면 블락 불가
  const side=Math.random()<0.5?-1:1;                     // 골문 위/아래 어느 구석을 노렸는가
  const aim=0.45+(fin/20)*0.45;                          // 결정력이 높을수록 구석을 정확히
  let targetX, targetY;
  if(result===SHOT_RESULT.MISSED){
    targetX=goal.x+dir*0.04; targetY=clamp01(mid+side*(half+0.035+Math.random()*0.09));
  } else {
    targetX=goal.x; targetY=clamp01(mid+side*half*aim);
  }
  return {
    result, blocker, side, dir, targetX, targetY,
    spread:(Math.random()-0.5)*1.3,                      // 굴절 시 좌우로 틀리는 각도(라디안)
    cornerY: side<0 ? 0.035 : 0.965,                     // 선방 시 쳐내는 코너 방향
    finishing:fin, shotPower:clamp(striker.shotPower||10,1,20)
  };
}
/* 슛파워에 비례하는 초기 속도 벡터를 공에 실어 준다 */
function launchShot(ball, plan, striker){
  const power=0.42+0.58*(plan.shotPower/20);             // 파워 1~20 → 0.45~1.0
  const speed=BALL_BASE_SPEED*power;
  const dx=(plan.targetX-ball.x)*PITCH_AR, dy=plan.targetY-ball.y;
  const L=HYP(dx,dy)||1;
  ball.vx=(dx/L)*speed/PITCH_AR;
  ball.vy=(dy/L)*speed;
  ball.speed=speed;
  ball.radius=ball.radius||BALL_RADIUS;
  ball.phase=SHOT_PHASE.FLIGHT;
  ball.travelled=0;
  return ball;
}
function isoLen(dx,dy){ return HYP(dx*PITCH_AR, dy); }
/* 한 스텝(dt초)만큼 공을 적분한다. 충돌하면 공이 사라지는 게 아니라 굴절되어 계속 굴러간다.
   world = {gk, defenders, goal, dir}. 반환값은 갱신된 ball(phase 포함). */
function executeShootingPhysics(ball, plan, world, dt){
  const goal=world.goal, dir=plan.dir||1;
  const prevX=ball.x, prevY=ball.y;
  ball.x=ball.x+ball.vx*dt;
  ball.y=ball.y+ball.vy*dt;
  ball.travelled=(ball.travelled||0)+isoLen(ball.x-prevX, ball.y-prevY);

  if(ball.phase===SHOT_PHASE.FLIGHT){
    // ── 수비수 몸에 맞고 굴절 (BLOCKED)
    if(plan.result===SHOT_RESULT.BLOCKED && plan.blocker){
      const d=plan.blocker;
      if(isoLen(ball.x-d.x, ball.y-d.y) <= (d.radius||DEF_RADIUS)+(ball.radius||BALL_RADIUS)){
        deflectOff(ball, d, plan.spread, 0.45);
        ball.phase=SHOT_PHASE.DEFLECTED;
        return ball;
      }
    }
    // ── 골키퍼가 쳐냄 (SAVED) — 골대 바깥 코너 방향으로 궤적을 꺾는다
    if(plan.result===SHOT_RESULT.SAVED && world.gk){
      const g=world.gk;
      if(isoLen(ball.x-g.x, ball.y-g.y) <= (g.radius||GK_RADIUS)+(ball.radius||BALL_RADIUS)){
        const tx=goal.x, ty=plan.cornerY;
        const dx=(tx-ball.x)*PITCH_AR, dy=ty-ball.y;
        const L=HYP(dx,dy)||1;
        const sp=HYP(ball.vx*PITCH_AR, ball.vy)*0.62;   // 쳐내면서 힘이 죽지만 골문 밖까지는 밀어낸다
        ball.vx=(dx/L)*sp/PITCH_AR; ball.vy=(dy/L)*sp;
        ball.phase=SHOT_PHASE.PARRIED;
        return ball;
      }
    }
    // ── 골라인 통과 (GOAL) — 그물 안쪽 깊숙이 들어간 뒤 그물 저항으로 멈춘다
    if(plan.result===SHOT_RESULT.GOAL && (dir>0 ? ball.x>=goal.x : ball.x<=goal.x)){
      const depth=Math.abs(ball.x-goal.x);
      if(depth>=0.018){ ball.vx*=NET_DAMP; ball.vy*=NET_DAMP; ball.phase=SHOT_PHASE.NETTED; }
      return ball;
    }
    // ── 골대 옆으로 빗나가 라인 밖으로
    if(plan.result===SHOT_RESULT.MISSED && (dir>0 ? ball.x>=goal.x : ball.x<=goal.x)){
      ball.phase=SHOT_PHASE.WIDE;
    }
    if(ball.x<0||ball.x>1||ball.y<0||ball.y>1){
      ball.x=clamp01(ball.x); ball.y=clamp01(ball.y);
      ball.vx=0; ball.vy=0; ball.phase=SHOT_PHASE.STOPPED;
    }
    return ball;
    return ball;
  }
  // ── 굴절 이후: 마찰로 서서히 감속하다 멈춘다 (연출이 끊기지 않고 계속 굴러간다)
  const f=Math.pow(BALL_FRICTION, dt*60);
  ball.vx*=f; ball.vy*=f;
  if(ball.phase===SHOT_PHASE.NETTED){ ball.vx*=0.94; ball.vy*=0.94; } // 그물 안에서는 더 빨리 죽는다
  // 피치 밖으로 나가면 아웃 — 좌표를 라인에 붙이고 멈춘다
  if(ball.x<0||ball.x>1||ball.y<0||ball.y>1){
    ball.x=clamp01(ball.x); ball.y=clamp01(ball.y);
    ball.vx=0; ball.vy=0; ball.phase=SHOT_PHASE.STOPPED;
  }
  if(isoLen(ball.vx, ball.vy) < BALL_STOP){ ball.vx=0; ball.vy=0; ball.phase=SHOT_PHASE.STOPPED; }
  return ball;
}
/* 물체에 맞고 튕겨나가는 반사 — 충돌 법선(물체 중심 → 공)에 대해 속도를 반사시키고,
   spread 만큼 각도를 틀어 준 뒤 감속한다. 등방 좌표에서 계산해 화면상 각도가 자연스럽다. */
function deflectOff(ball, obj, spread, keep, noPush){
  let nx=(ball.x-obj.x)*PITCH_AR, ny=ball.y-obj.y;
  let nl=HYP(nx,ny);
  if(nl<1e-6){ nx=-ball.vx*PITCH_AR; ny=-ball.vy; nl=HYP(nx,ny)||1; }
  const ux=nx/nl, uy=ny/nl;
  const vix=ball.vx*PITCH_AR, viy=ball.vy;
  const dot=vix*ux+viy*uy;
  const rx=vix-2*dot*ux, ry=viy-2*dot*uy;        // 반사 벡터
  const ang=Math.atan2(ry,rx)+(spread||0);
  const sp=HYP(rx,ry)*(keep||0.45);
  ball.vx=Math.cos(ang)*sp/PITCH_AR;
  ball.vy=Math.sin(ang)*sp;
  // 물체 표면 밖으로 살짝 밀어내 같은 프레임에 다시 충돌 판정되지 않게 한다.
  // (미리 궤적을 굴려 두는 경우에는 시작 좌표가 튀어 보이므로 noPush로 끈다)
  if(!noPush){
    const push=((obj.radius||DEF_RADIUS)+(ball.radius||BALL_RADIUS))*1.02;
    ball.x=clamp01(obj.x+ux*push/PITCH_AR);
    ball.y=clamp01(obj.y+uy*push);
  }
}
/* 슛 한 번을 끝까지 시뮬레이션해 프레임별 궤적을 만들어 둔다.
   렌더러는 이 배열을 진행률로 샘플링만 하므로, 매 프레임 계산이 순수·결정적으로 유지된다. */
function simulateShotTrajectory(plan, start, world, opts){
  opts=opts||{};
  const dt=opts.dt||1/60, maxSteps=opts.maxSteps||300;
  // 판정이 SAVED/BLOCKED라는 것은 곧 "그 선수가 슛 경로에 도달했다"는 뜻이다. 정지한 채로 두면
  // 구석을 노린 슛이 옆으로 지나가 접촉이 성립하지 않으므로, 경로 위 차단 지점으로 옮겨 놓는다.
  const w=Object.assign({}, world);
  const target={x:plan.targetX, y:plan.targetY};
  if(plan.result===SHOT_RESULT.SAVED && world.gk){
    const sp=lerpXY(start, target, 0.86);
    w.gk=Object.assign({}, world.gk, {x:sp.x, y:sp.y});
  }
  if(plan.result===SHOT_RESULT.BLOCKED && plan.blocker){
    // 수비수의 원래 위치에서 경로 쪽으로 붙여 준다(몸을 던져 막으러 온 상태)
    const along=clamp01(Math.abs(plan.blocker.x-start.x)/Math.max(1e-6, Math.abs(target.x-start.x)));
    const bp=lerpXY(start, target, along);
    plan=Object.assign({}, plan, {blocker:Object.assign({}, plan.blocker, {x:bp.x, y:bp.y})});
  }
  world=w;
  const ball={x:start.x, y:start.y, vx:0, vy:0, radius:BALL_RADIUS};
  launchShot(ball, plan, null);
  plan._flightLen=isoLen(target.x-start.x, target.y-start.y);
  const path=[{x:ball.x, y:ball.y, phase:ball.phase, lift:0}];
  let contactStep=-1, settleStep=-1;
  for(let i=0;i<maxSteps;i++){
    const before=ball.phase;
    executeShootingPhysics(ball, plan, world, dt);
    if(before===SHOT_PHASE.FLIGHT && ball.phase!==SHOT_PHASE.FLIGHT && contactStep<0) contactStep=i+1;
    // 비행 중에는 포물선으로 떠 있고, 굴절 후에는 낮게 튀다 잦아든다
    let lift=0;
    if(ball.phase===SHOT_PHASE.FLIGHT){
      const p=clamp01(ball.travelled/Math.max(0.05, plan._flightLen||0.35));
      lift=Math.sin(p*Math.PI)*0.75;
    } else if(contactStep>=0){
      const k=clamp01((i+1-contactStep)/40);
      lift=bounceLift(k, 2, 0.40);
    }
    path.push({x:ball.x, y:ball.y, phase:ball.phase, lift});
    if(ball.phase===SHOT_PHASE.STOPPED){ settleStep=i+1; break; }
  }
  return {path, contactStep:contactStep<0?path.length-1:contactStep, settleStep:settleStep<0?path.length-1:settleStep, dt,
          saverAt: w.gk?{x:w.gk.x, y:w.gk.y}:null, blockerAt: plan.blocker?{x:plan.blocker.x, y:plan.blocker.y}:null};
}
/* 접촉 이후(쳐냄·몸에 맞음)의 궤적만 물리로 굴린다 — 접촉 전 비행은 이미 정해진 결과에 맞춰
   결정적으로 그려지므로, 여기서는 "맞고 나서 계속 굴러가는" 부분만 시뮬레이션한다.
   mode: "PARRY"(골키퍼가 코너로 쳐냄) | "BLOCK"(수비수 몸에 맞고 반사) */
function simulateDeflection(contact, incoming, mode, opts){
  opts=opts||{};
  const dt=opts.dt||1/60, maxSteps=opts.maxSteps||240;
  const ball={x:contact.x, y:contact.y, vx:incoming.vx, vy:incoming.vy, radius:BALL_RADIUS};
  if(mode==="PARRY"){
    const tx=opts.goalX!==undefined?opts.goalX:contact.x, ty=opts.cornerY!==undefined?opts.cornerY:0.03;
    const dx=(tx-ball.x)*PITCH_AR, dy=ty-ball.y;
    const L=HYP(dx,dy)||1;
    const sp=HYP(ball.vx*PITCH_AR, ball.vy)*0.62;
    ball.vx=(dx/L)*sp/PITCH_AR; ball.vy=(dy/L)*sp;
    ball.phase=SHOT_PHASE.PARRIED;
  } else {
    deflectOff(ball, opts.obj||{x:contact.x, y:contact.y, radius:DEF_RADIUS}, opts.spread||0, 0.45, true);
    ball.phase=SHOT_PHASE.DEFLECTED;
  }
  const path=[{x:ball.x, y:ball.y, phase:ball.phase, lift:bounceLift(0,2,0.40)}];
  for(let i=0;i<maxSteps;i++){
    const f=Math.pow(BALL_FRICTION, dt*60);
    ball.vx*=f; ball.vy*=f;
    ball.x=clamp01(ball.x+ball.vx*dt);
    ball.y=clamp01(ball.y+ball.vy*dt);
    if(isoLen(ball.vx, ball.vy) < BALL_STOP){ ball.vx=0; ball.vy=0; ball.phase=SHOT_PHASE.STOPPED; }
    path.push({x:ball.x, y:ball.y, phase:ball.phase, lift:bounceLift(clamp01((i+1)/45), 2, 0.40)});
    if(ball.phase===SHOT_PHASE.STOPPED) break;
  }
  return {path, dt};
}
/* 궤적 배열을 진행률(0~1)로 샘플링 — 렌더러는 이 함수만 쓰면 되므로 매 프레임 계산이 순수하게 유지된다 */
function sampleTrajectory(traj, p){
  const path=traj.path;
  if(!path || !path.length) return null;
  const i=clamp(Math.round(clamp01(p)*(path.length-1)), 0, path.length-1);
  return path[i];
}

/* ── 캔버스 그리기 ── */
function cvK(cv){ return cv.width/640; }   // 캔버스 해상도 배율 — 모든 픽셀 상수는 640 기준
/* 🥅 골대 뒤 여백 — ⚠ 사용자 요청 원문 — 「매치엔진 경기장 그래픽에서 골대 뒤에 공간을 좀
   넉넉하게 넓혀서, 공이 골문 위로 뜨면 골대 뒤 공간으로 공이 나가게끔 해서 확실히 빗나갔다는 걸
   쉽게 볼 수 있게 하자」.
   ─ 예전에는 상하좌우 여백이 똑같이 18px 이었다. 골망 깊이만으로 그 여백이 거의 다 차서,
     빗나간 슛(골라인 뒤 4~7m)이 화면 밖으로 나가 그냥 사라졌다. 좌우 여백을 크게 벌려
     골대 뒤 「경기장 밖」을 실제로 그린다 — 공이 거기까지 굴러 나가는 게 눈에 보인다. */
/* ⚠ 요청 원문 — 「지금 매치엔진에서 골라인 밖으로 선수가 나가질 못하던데, 선수도 자유롭게
   라인밖으로 나가게 해줘. 스로인 던지는 라인 있잖아. 거기도 양쪽으로 공간 넉넉하게 해서
   선수가 스로인 할 수 있게 해줘.」
   ─ 위아래 여백 14 → 30. 터치라인 밖에 선 선수(반지름 ≈8px)가 잘리지 않는다. */
const PITCH_PAD_X=50, PITCH_PAD_Y=30;      // 640 기준 px (cvK 로 배율)
function pitchToCanvasXY(cv, nx, ny){
  const k=cvK(cv), px=PITCH_PAD_X*k, py=PITCH_PAD_Y*k;
  const w=cv.width-2*px, h=cv.height-2*py;
  return {x:px+nx*w, y:py+ny*h};
}
/* ⚠ 요청 — 「매치엔진 경기장을 좀 더 고급스럽게」.
   예전 그림은 단색 잔디 + 흰 선이 전부였고, 코너 아크·페널티 스팟·페널티 아크(D)가 아예 없었다.
   ─ 실제 구장에서 눈에 들어오는 순서대로 쌓는다:
     ① 스탠드(관중석) → ② 잔디 그라데이션 → ③ 잔디 깎은 줄무늬 → ④ 골문 앞 닳은 자국
     → ⑤ 규격에 맞는 흰 선 전부 → ⑥ 골망 → ⑦ 조명 하이라이트 · 비네팅
   좌표는 예전 값을 그대로 쓴다 — 경기 로직(골 판정·박스 판정)이 이 숫자를 공유한다. */
/* ⚡ 구장 바닥은 매 프레임 다시 그릴 필요가 없다 — 크기별로 한 번 그려 두고 그대로 찍는다.
   (새 그림은 그라데이션을 열네 개 만든다. 60fps 로 매번 만들면 특히 모바일에서 아깝다) */
let _PITCH_CACHE=null;
function drawPitchBase(ctx, cv){
  try{
    const key=cv.width+"x"+cv.height;
    if(!_PITCH_CACHE || _PITCH_CACHE.key!==key){
      const oc=document.createElement("canvas");
      oc.width=cv.width; oc.height=cv.height;
      _pitchPaint(oc.getContext("2d"), oc);
      _PITCH_CACHE={key, cv:oc};
    }
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.drawImage(_PITCH_CACHE.cv, 0, 0);
    return;
  }catch(e){}
  _pitchPaint(ctx, cv);
}
function _pitchPaint(ctx, cv){
  const kpb=cvK(cv);
  const W=cv.width, H=cv.height;
  const px=PITCH_PAD_X*kpb, py=PITCH_PAD_Y*kpb;   // 좌우는 넉넉하게, 위아래는 종전대로
  const pw=W-2*px, ph=H-2*py;
  ctx.clearRect(0,0,W,H);

  /* ── ① 스탠드 — 잔디 밖은 관중석이다. 어둡게 깔고 좌석 결을 얹는다 */
  {
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#0a1b13"); bg.addColorStop(0.5,"#0d2418"); bg.addColorStop(1,"#081610");
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    ctx.save(); ctx.globalAlpha=0.5;
    const seat=Math.max(2, 2.6*kpb);
    ctx.fillStyle="rgba(255,255,255,.035)";
    for(let y=0;y<H;y+=seat*2){ ctx.fillRect(0,y,W,seat); }        // 좌석 단
    ctx.restore();
  }

  /* ── ② 잔디 — 위에서 아래로 빛이 떨어지는 결 */
  {
    const g=ctx.createLinearGradient(0,py,0,py+ph);
    g.addColorStop(0,"#1c5231"); g.addColorStop(0.42,"#17462a"); g.addColorStop(1,"#123a22");
    ctx.fillStyle=g; ctx.fillRect(px,py,pw,ph);
  }
  /* ── ③ 잔디 깎은 줄무늬 — 세로 12 줄, 밝고 어두운 결이 번갈아 */
  {
    const NB=12, bw=pw/NB;
    for(let i=0;i<NB;i++){
      ctx.fillStyle = (i%2===0) ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.045)";
      ctx.fillRect(px+i*bw, py, bw, ph);
    }
    /* 잔디결 위로 흐르는 옅은 빛 — 조명 반사 */
    const sh=ctx.createLinearGradient(px,py,px+pw,py+ph);
    sh.addColorStop(0,"rgba(255,255,255,.05)"); sh.addColorStop(0.45,"rgba(255,255,255,0)");
    sh.addColorStop(1,"rgba(255,255,255,.035)");
    ctx.fillStyle=sh; ctx.fillRect(px,py,pw,ph);
  }
  /* ── ④ 골문 앞·센터서클 닳은 자국 — 실제 구장의 흙 자국 */
  {
    ctx.save();
    const wear=(cx,cy,rx,ry,al)=>{
      const rg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
      rg.addColorStop(0,`rgba(120,96,58,${al})`); rg.addColorStop(1,"rgba(120,96,58,0)");
      ctx.save(); ctx.translate(cx,cy); ctx.scale(1, ry/Math.max(rx,ry)); ctx.translate(-cx,-cy);
      ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,Math.max(rx,ry),0,Math.PI*2); ctx.fill(); ctx.restore();
    };
    wear(px+pw*0.045, H/2, pw*0.055, ph*0.15, 0.085);
    wear(W-px-pw*0.045, H/2, pw*0.055, ph*0.15, 0.085);
    wear(W/2, H/2, pw*0.05, ph*0.11, 0.05);
    ctx.restore();
  }

  /* 🪧 골대 뒤 광고판 — 「여기가 끝」이라는 경계선 */
  {
    const adW=Math.max(3, 4*kpb);
    const ad=(x)=>{
      const g2=ctx.createLinearGradient(x,0,x+adW,0);
      g2.addColorStop(0,"rgba(255,255,255,.16)"); g2.addColorStop(1,"rgba(255,255,255,.05)");
      ctx.fillStyle=g2; ctx.fillRect(x, py+ph*0.10, adW, ph*0.80);
    };
    ad(px-px*0.86); ad(W-px+px*0.86-adW);
  }

  /* ── ⑤ 흰 선 — 규격대로 전부 */
  const boxW=pw*0.16, boxH=ph*0.5, boxY=py+(ph-boxH)/2;
  const gaW=pw*0.06, gaH=ph*0.24, gaY=py+(ph-gaH)/2;
  const goalH=ph*0.14, goalY=py+(ph-goalH)/2;
  const goalD=pw*GOAL_NET_DEPTH;                     // 골 깊이 = 물리 골망 깊이와 일치
  ctx.save();
  ctx.strokeStyle="rgba(255,255,255,.82)"; ctx.lineWidth=2*kpb;
  ctx.shadowColor="rgba(255,255,255,.30)"; ctx.shadowBlur=3*kpb;   // 선이 살짝 빛난다
  ctx.strokeRect(px,py,pw,ph);
  ctx.beginPath(); ctx.moveTo(W/2,py); ctx.lineTo(W/2,H-py); ctx.stroke();
  ctx.beginPath(); ctx.arc(W/2,H/2,ph*0.16,0,Math.PI*2); ctx.stroke();
  ctx.strokeRect(px,boxY,boxW,boxH); ctx.strokeRect(W-px-boxW,boxY,boxW,boxH);
  ctx.strokeRect(px,gaY,gaW,gaH); ctx.strokeRect(W-px-gaW,gaY,gaW,gaH);
  /* 페널티 아크(D) — 박스 밖으로 나온 반원만 그린다 */
  {
    const spotX=px+pw*0.105, arcR=ph*0.16;
    const a=Math.acos(clamp((px+boxW-spotX)/arcR, -1, 1));
    ctx.beginPath(); ctx.arc(spotX, H/2, arcR, -a, a); ctx.stroke();
    const spotX2=W-spotX;
    ctx.beginPath(); ctx.arc(spotX2, H/2, arcR, Math.PI-a, Math.PI+a); ctx.stroke();
  }
  /* 코너 아크 — 네 귀퉁이 */
  {
    const cr=Math.max(4, 7*kpb);
    ctx.beginPath(); ctx.arc(px,py,cr,0,Math.PI/2); ctx.stroke();
    ctx.beginPath(); ctx.arc(px,H-py,cr,-Math.PI/2,0); ctx.stroke();
    ctx.beginPath(); ctx.arc(W-px,py,cr,Math.PI/2,Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(W-px,H-py,cr,Math.PI,Math.PI*1.5); ctx.stroke();
  }
  ctx.restore();
  /* 스팟 — 센터·페널티 */
  {
    ctx.fillStyle="rgba(255,255,255,.92)";
    const dot=(x,y,r)=>{ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); };
    dot(W/2,H/2, 2.6*kpb);
    dot(px+pw*0.105, H/2, 2.4*kpb);
    dot(W-px-pw*0.105, H/2, 2.4*kpb);
  }

  /* ── ⑥ 골망 — 안쪽으로 갈수록 촘촘하고 어둡다 */
  ctx.save();
  const mesh=Math.max(3, 3.2*kpb);
  for(const gx0 of [px-goalD, W-px]){
    const inner = (gx0<W/2);                                    // 왼쪽 골대는 바깥이 왼쪽
    const gg=ctx.createLinearGradient(gx0,0,gx0+goalD,0);
    gg.addColorStop(0, inner?"rgba(0,0,0,.30)":"rgba(0,0,0,.06)");
    gg.addColorStop(1, inner?"rgba(0,0,0,.06)":"rgba(0,0,0,.30)");
    ctx.fillStyle=gg; ctx.fillRect(gx0, goalY, goalD, goalH);
    ctx.strokeStyle="rgba(255,255,255,.26)"; ctx.lineWidth=1;
    ctx.beginPath();
    for(let x=gx0+mesh; x<gx0+goalD; x+=mesh){ ctx.moveTo(x, goalY); ctx.lineTo(x, goalY+goalH); }
    for(let y=goalY+mesh; y<goalY+goalH; y+=mesh){ ctx.moveTo(gx0, y); ctx.lineTo(gx0+goalD, y); }
    ctx.stroke();
  }
  /* 골포스트 — 골망보다 진하게. 공이 포스트 바깥으로 지나갔는지가 분명해진다 */
  ctx.strokeStyle="rgba(255,255,255,.95)"; ctx.lineWidth=2.8*kpb;
  ctx.shadowColor="rgba(0,0,0,.5)"; ctx.shadowBlur=3*kpb;
  ctx.beginPath();
  ctx.moveTo(px, goalY); ctx.lineTo(px, goalY+goalH);
  ctx.moveTo(W-px, goalY); ctx.lineTo(W-px, goalY+goalH);
  ctx.stroke();
  ctx.restore();

  /* ── ⑦ 조명 — 네 모서리 조명탑이 만드는 밝은 웅덩이 + 가장자리 비네팅 */
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  for(const [lx,ly] of [[px+pw*0.18,py+ph*0.10],[W-px-pw*0.18,py+ph*0.10],
                        [px+pw*0.18,H-py-ph*0.10],[W-px-pw*0.18,H-py-ph*0.10]]){
    const lg=ctx.createRadialGradient(lx,ly,0,lx,ly,pw*0.34);
    lg.addColorStop(0,"rgba(215,240,255,.075)"); lg.addColorStop(1,"rgba(215,240,255,0)");
    ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(lx,ly,pw*0.34,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  {
    const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.30, W/2,H/2,Math.max(W,H)*0.72);
    vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.34)");
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  }
}
/* 🦘 ⚠ 요청 — 「선수가 점프할 때도 선수 바둑알이 약간 커지는 효과를 넣어 줘. 그림자도 생기고」.
   공(drawBallZ)과 같은 원리다 — 탑뷰에서 「떴다」를 알 수 있는 건 그림자와의 간격, 그리고 커진 크기뿐.
   다만 사람은 공만큼 높이 뜨지 않으니 폭을 훨씬 좁게 잡는다 (최대 +18% · 4.5px 부양). */
const JUMP_LIFT=4.5;         // 최고점에서 화면상 띄우는 픽셀
const JUMP_GROW=0.18;        // 최고점에서 커지는 비율
const JUMP_DUR=0.62;         // 도약 → 착지 (초)
/* 지금 이 선수가 얼마나 떠 있는가 (0=지면 · 1=최고점) */
function jumpZOf(a, now){
  try{
    if(!a || a._jt0===undefined) return 0;
    const d=(a._jdur||JUMP_DUR);
    const k=(now-a._jt0)/d;
    if(k<=0 || k>=1) return 0;
    return Math.sin(Math.PI*k)*(a._jh||1);
  }catch(e){ return 0; }
}
/* 🤜 ⚠ 요청 — 「헤더 경합이나 태클 상황에서 두 바둑알이 부딪힐 때 미세하게 좌우로 떠는 효과」.
   탑뷰에서 몸싸움은 그림으로 남는 게 없다 — 붙었다가 한쪽이 공을 갖는 결과만 보인다.
   부딪힌 두 선수를 짧게 떨어 「지금 몸이 부딪혔다」를 눈에 보이게 한다.
   ─ 점프(jumpZOf)와 같은 방식: 시각(_jt)과 세기(_jp)만 에이전트에 적어 두고 그리기가 읽는다.
     화면 상태라 세이브에는 남지 않는다. */
const PITCH_AR_INV=1/1.55;   // 좌우 진폭 보정 — 화면에서 가로가 늘어나 있으므로 그만큼 줄인다
const JIT_DUR=0.34;          // 떨림이 이어지는 시간(초)
const JIT_AMP=0.0034;        // 최대 진폭 (피치 폭 기준 ≈0.37m)
const JIT_HZ=26;             // 떨리는 속도
function jitterOf(a, now){
  try{
    if(!a || a._jt===undefined) return null;
    const k=(now-a._jt)/JIT_DUR;
    if(k<=0 || k>=1) return null;
    const decay=(1-k)*(1-k);                       // 처음 크게, 빠르게 잦아든다
    const amp=JIT_AMP*(a._jp||1)*decay;
    const ph=(a.seed||0)*0.7;                      // 선수마다 위상이 달라야 「같이 흔들리는」 느낌이 안 난다
    return {dx:Math.sin((now-a._jt)*JIT_HZ*Math.PI*2 + ph)*amp*PITCH_AR_INV,
            dy:Math.cos((now-a._jt)*JIT_HZ*Math.PI*2*0.83 + ph)*amp*0.72};
  }catch(e){ return null; }
}
/* 💨 ⚠ 요청 — 「선수가 빠르게 달릴 때 뒤에 은은한 잔상이 남도록」.
   공간 압박감의 정체는 「저 선수가 지금 얼마나 빠른가」다. 탑뷰에서 그건 속도로만 보이는데,
   바둑알은 등속으로 움직여도 똑같이 보인다. 지나온 자리에 흐려지는 잔상을 남겨
   「달리는 중」과 「걷는 중」이 한눈에 갈리게 한다.
   ─ 기준: RUN(0.0657) 부터 옅게 보이기 시작해 SPRINT(0.1029) 에서 가장 진하다.
     잔상은 화면 상태일 뿐이라 에이전트에만 남고 세이브에는 들어가지 않는다. */
/* ⚠ SPD 는 이 아래에서 선언된다(const) — 로드 시점에 읽으면 TDZ 오류가 난다.
   실행 시점에 한 번만 읽어 캐시한다. */
let _TRZ=null;
function trailThr(){ if(!_TRZ) _TRZ={min:SPD.RUN*0.92, full:SPD.SPRINT}; return _TRZ; }
const TRAIL_N=7;                   // 남기는 잔상 개수
const TRAIL_GAP=2;                 // 몇 프레임마다 한 점씩 찍는가
let _trailTick=0;
/* 지금 이 선수가 얼마나 빠른가 (0=잔상 없음 · 1=최대) */
function trailK(a){
  try{
    let v=a.spd;
    if(v===undefined || v===null){
      if(a._tpx===undefined) return 0;
      v=HYP((a.x-a._tpx)*PITCH_AR, a.y-a._tpy)/SIM_DT;
    }
    const Z=trailThr();
    return clamp((v-Z.min)/Math.max(1e-6,(Z.full-Z.min)), 0, 1);
  }catch(e){ return 0; }
}
/* 잔상 좌표를 쌓는다 — 그리기 직전에 호출한다 */
function trailPush(a, nx, ny, k){
  if(!a._trail) a._trail=[];
  if(k<=0.02){ if(a._trail.length) a._trail.length=Math.max(0, a._trail.length-1); return; }
  if(_trailTick % TRAIL_GAP) return;
  a._trail.push({x:nx, y:ny, k});
  if(a._trail.length>TRAIL_N) a._trail.shift();
}
/* 잔상을 그린다 — 오래된 점일수록 작고 투명하다 */
function drawTrail(ctx, cv, a, color, r){
  const T=a._trail; if(!T || T.length<2) return;
  const k2=cvK(cv);
  ctx.save();
  for(let i=0;i<T.length;i++){
    const t=T[i];
    const age=(i+1)/T.length;                       // 0=가장 오래됨 · 1=가장 최근
    /* 은은하게 — 진하면 잔상이 아니라 「사람이 늘어난 것」처럼 보인다.
       실측으로 0.30 은 화면에서 거의 안 보였고 0.55 는 인원이 늘어 보였다. 0.42 로 잡는다. */
    const al=0.42*age*age*clamp(t.k,0,1);
    if(al<0.012) continue;
    const {x,y}=pitchToCanvasXY(cv, t.x, t.y);
    ctx.globalAlpha=al;
    ctx.beginPath(); ctx.arc(x, y, r*k2*(0.52+age*0.40), 0, Math.PI*2);
    ctx.fillStyle=color; ctx.fill();
  }
  ctx.restore();
}
function drawDotXY(ctx, cv, nx, ny, color, r, jz){
  const k=cvK(cv), {x,y}=pitchToCanvasXY(cv,nx,ny);
  const J=jz||0;
  if(J>0.02){                                  // 🦘 지면에 남는 그림자 — 뜰수록 작고 흐려진다
    const sh=r*k*(1-J*0.30);
    ctx.beginPath(); ctx.ellipse(x, y+J*1.2*k, sh, sh*0.42, 0, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,"+(0.34-J*0.10).toFixed(2)+")"; ctx.fill();
  }
  const yy=y-J*JUMP_LIFT*k, rr=r*(1+J*JUMP_GROW)*k;
  ctx.beginPath(); ctx.arc(x,yy,rr,0,Math.PI*2);
  ctx.fillStyle=color; ctx.fill();
  ctx.lineWidth=1.3*k; ctx.strokeStyle="rgba(0,0,0,.55)"; ctx.stroke();
}
/* 공은 lift(0~1)만큼 "떠 있는" 것으로 표현한다 — 그림자는 실제 지면 좌표에 그대로 두고 공만 위로 띄워서
   그리면, 둘 사이 간격이 벌어질수록 높이 뜬 공처럼 보인다(지면을 구르는 패스는 lift=0이라 그림자가 겹침). */
function drawBallXY(ctx, cv, nx, ny, lift){
  const k=cvK(cv), {x,y}=pitchToCanvasXY(cv,nx,ny);
  const L=lift||0, h=L*16*k;
  const kh=Math.min(1, Math.pow(Math.max(0, L*1.9), 0.42));   // 하이라이트 재생용 — 같은 눈금
  if(h>0.5){
    const sh=Math.max(1.2, 3.0-h*0.10)*k;
    ctx.beginPath(); ctx.ellipse(x, y, sh, sh*0.55, 0, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,"+Math.max(0.08, 0.38-h*0.015).toFixed(2)+")"; ctx.fill();
  }
  const r=(3.0+kh*3.45)*k, by=y-h;  // 공중 최대 6.45px — 바둑알(11px)보다 항상 작게, FM 비율 (확대폭 +15% 요청)
  if(kh>0.12){
    ctx.beginPath(); ctx.arc(x, by, r+1.1, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,"+(0.10+kh*0.12).toFixed(2)+")"; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, by, r, 0, Math.PI*2);
  ctx.fillStyle="#fff"; ctx.fill(); ctx.lineWidth=1+kh*0.5; ctx.strokeStyle="#333"; ctx.stroke();
  if(kh>0.25){
    ctx.beginPath(); ctx.arc(x-r*0.28, by-r*0.30, r*0.34, 0, Math.PI*2);
    ctx.fillStyle="rgba(255,255,255,.85)"; ctx.fill();
  }
}
/* 높이(z)를 가진 공. 그림자는 바닥에 그대로 남고, 공은 뜬 높이만큼 위로 올라가며 크게 보인다.
   2D 탑뷰에서 "떴다"는 걸 알 수 있는 건 이 그림자와의 간격, 그리고 커진 크기뿐이다. */
function drawBallZ(ctx, cv, nx, ny, z){
  const k=cvK(cv), {x,y}=pitchToCanvasXY(cv, nx, ny);
  const hM=(z||0)*ISO_TO_M;                 // 높이(m)
  const lift=Math.min(24, hM*3.0)*k;        // 화면에서 위로 띄우는 픽셀 (축소 비율에 맞춤)
  /* ⚠ 제보 — 탑뷰라 공이 떴는지 안 떴는지 알 수가 없다.
     확대폭이 높이×0.42라 2m를 떠도 1픽셀 차이여서 사실상 보이지 않았다.
     FM처럼 "가까워질수록 커 보이는" 원근을 확실하게 준다 — 땅볼은 작고, 높이 뜬 공은 두 배 가까이. */
  /* 제곱근 곡선 — 선형(hM/6)으로는 1~3m 공(일반 로빙·크로스 궤적의 대부분)이
     +1.5~4.6px뿐이라 체감이 없었다(제보). 저공에서 확 커지고 고공에서 완만하게:
     1m +3.8px · 2m +5.4px · 3m +6.6px · 6m +9.3px(최대 동일) */
  /* 지수 0.42 — 1m 미만 저공 바운스·짧은 로빙도 같은 비율 감각으로 커진다:
     0.3m +2.9px · 0.5m +3.3px · 1m +4.4px · 3m +7.0px · 6m +9.3px(최대 동일) */
  const kh=Math.min(1, Math.pow(hM/6, 0.42));   // 0(땅) ~ 1(6m 이상)
  if(hM>0.15){                              // 바닥 그림자 — 높이 뜰수록 작고 흐려진다
    const sh=Math.max(1.0, 3.0-hM*0.26)*k;
    ctx.beginPath(); ctx.ellipse(x, y, sh, sh*0.50, 0, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,"+Math.max(0.07, 0.42-hM*0.045).toFixed(2)+")"; ctx.fill();
  }
  /* ⚠ 요청 — 「공 높이 뜰 때 공이 확대되는 거 15% 더 크게」. 뜬 만큼 커지는 몫만 키운다
     (땅볼 크기는 그대로 3.0px — 기준이 흔들리면 높이감이 오히려 흐려진다) */
  const r=(3.0+kh*3.45)*k;                  // 3.0px(땅볼) → 6.45px(높이 뜬 공) — 바둑알보다 항상 작게
  const by=y-lift;
  /* 높이 뜬 공은 아래로 옅은 그늘이 지고 위쪽에 빛이 걸린다 — 부피감을 준다 */
  if(kh>0.12){
    ctx.beginPath(); ctx.arc(x, by, r+1.1, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,"+(0.10+kh*0.12).toFixed(2)+")"; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, by, r, 0, Math.PI*2);
  ctx.fillStyle="#fff"; ctx.fill();
  ctx.lineWidth=1+kh*0.5; ctx.strokeStyle="#333"; ctx.stroke();
  if(kh>0.25){                              // 위쪽 하이라이트 — 공이 떠 있다는 신호
    ctx.beginPath(); ctx.arc(x-r*0.28, by-r*0.30, r*0.34, 0, Math.PI*2);
    ctx.fillStyle="rgba(255,255,255,.85)"; ctx.fill();
  }
}
/* ═══════════════════════════════════════════════════════════════
   🔍 수신 디버그 — 몸 방향·수신 자세·공 로컬 오프셋을 화면에 그린다.
   ⚙️ 설정에서 켜고 끈다. 회전·퍼스트터치 로직을 눈으로 확인할 때 쓴다.
     흰 화살표  = 몸이 향한 방향 (Player Forward)
     노란 화살표 = 수신 자세 목표 (Receiving Orientation)
     하늘 점선  = 공이 날아오는 방향 (Ball Incoming)
     초록 선    = 선수 ↔ 공 (Ball Local Offset)
═══════════════════════════════════════════════════════════════ */
function drawReceiveDebug(ctx, cv, s, IX, IY){
  const b=s.ball;
  /* 🏃 움직임 디버그 — 선수마다 「무엇을 하려는가」를 띄운다 (§44·§45) */
  try{
    if(s.agents) for(const a of s.agents){
      if(a.slot==="GK" || !a.offRole) continue;
      const p=[IX(a.x), IY(a.y)];
      /* 목표 지점 ○ 과 현재 위치 ● 를 잇는다 */
      if(a._spot){
        const q=[IX(a._spot.x), IY(a._spot.y)];
        ctx.save();
        ctx.strokeStyle = a._intentAim==="GOAL"  ? "rgba(255,150,120,.55)"
                        : a._intentAim==="BALL"  ? "rgba(120,200,255,.55)"
                        : a._intentAim==="OPPONENT" ? "rgba(220,160,255,.5)"
                                                : "rgba(160,255,180,.45)";
        ctx.lineWidth=1.2; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(q[0],q[1],3.2,0,7); ctx.stroke();
        ctx.restore();
      }
      ctx.save(); ctx.font="7px monospace";
      ctx.fillStyle = (a.offRole===OFF_ROLE.RUN||a.offRole===OFF_ROLE.THIRD
                    || a.offRole===OFF_ROLE.FARPOST) ? "rgba(255,215,90,.95)"
                    : a.offRole===OFF_ROLE.VACATE ? "rgba(220,160,255,.9)"
                    : "rgba(255,255,255,.72)";
      ctx.fillText("["+a.offRole+"]", p[0]-11, p[1]-9);
      /* 🎛️ 왜 이 의도인가 — 역할 성향과 성향 프로필을 함께 띄운다 (§24) */
      try{
        const B=roleBias(a), P=a._mp;
        ctx.fillStyle="rgba(255,255,255,.42)";
        ctx.fillText("f"+B.fFwd.toFixed(2)+" w"+B.fWide.toFixed(2), p[0]-11, p[1]-17);
        if(P) ctx.fillText("깊이"+P.depth.toFixed(2)+" 폭"+P.width.toFixed(2), p[0]-11, p[1]-24);
        if(a._fwDbg){ ctx.fillStyle="rgba(255,220,130,.80)";
                      ctx.fillText(a._fwDbg, p[0]-11, p[1]-31); }
      }catch(e){}
      ctx.restore();
    }
    /* 🏗️ 빌드업 디버그 — 팀 단위 상황과 볼 소유자의 선택지 (§31) */
  try{
    const BU=s._bu, cr=(b&&b.ownerId!=null)?s.byId(b.ownerId):null;
    if(BU && cr && cr.slot!=="GK"){
      const p=[IX(cr.x), IY(cr.y)];
      ctx.save(); ctx.font="8px monospace";
      ctx.fillStyle="rgba(255,235,140,.95)";
      ctx.fillText(BU.state+"  압박"+BU.press.toFixed(2)+"  좌우차"+BU.swing.toFixed(1),
                   p[0]+12, p[1]-20);
      /* 후보 패스 — 닿고, 길이 열리고, 눌리지 않은 동료로 선을 긋는다 */
      const mates=s.side(cr.side);
      for(const m of mates){
        if(m===cr || m.slot==="GK") continue;
        const d=HYP((m.x-cr.x)*PITCH_AR, m.y-cr.y);
        if(d<0.045 || d>0.32) continue;
        const lane=laneBlocked(cr, m, s.side(s.opp(cr.side)));
        const pr=pressureOn(m, s.side(s.opp(cr.side)), 1);
        const ok=(lane<0.45 && pr<0.75);
        const q=[IX(m.x), IY(m.y)];
        ctx.strokeStyle= ok ? "rgba(140,255,170,.55)" : "rgba(255,120,110,.28)";
        ctx.lineWidth= ok ? 1.5 : 1;
        ctx.setLineDash(ok?[]:[2,3]);
        ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();
        ctx.setLineDash([]);
        if(ok){ ctx.fillStyle="rgba(140,255,170,.85)";
                ctx.fillText((1-lane).toFixed(2), (p[0]+q[0])/2, (p[1]+q[1])/2-2); }
      }
      ctx.restore();
    }
  }catch(e){}
  /* 🧤 GK 디버그 — 상태와 예측 위협 (§51) */
  try{
    if(s.agents) for(const a of s.agents){
      if(a.slot!=="GK") continue;
      const p=[IX(a.x), IY(a.y)];
      ctx.save(); ctx.font="7px monospace";
      const st2=a._gkState||a._gkRole||"";
      if(st2){ ctx.fillStyle="rgba(140,220,255,.9)"; ctx.fillText("["+st2+"]", p[0]-12, p[1]-9); }
      const tb=a._tb;
      if(tb){
        const q=[IX(tb.x), IY(tb.y)];
        ctx.strokeStyle="rgba(140,220,255,.5)"; ctx.lineWidth=1.2; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle="rgba(140,220,255,.85)";
        ctx.fillText("여유"+tb.margin.toFixed(2)+"s", q[0]+6, q[1]);
      }
      ctx.restore();
    }
  }catch(e){}
  /* 🛡️ 수비 디버그 — 역할과 대상 (§65) */
    if(s.agents) for(const a of s.agents){
      if(a.slot==="GK" || !a.defRole) continue;
      if(s.possSide && a.side===s.possSide) continue;      // 수비하는 쪽만
      const p=[IX(a.x), IY(a.y)];
      ctx.save(); ctx.font="7px monospace";
      const col = a.defRole===DEF_ROLE.PRESS  ? "rgba(255,120,110,.95)"
                : a.defRole===DEF_ROLE.JOCKEY ? "rgba(255,190,90,.95)"
                : a.defRole===DEF_ROLE.COVER || a.defRole===DEF_ROLE.COVER_WIDE
                                              ? "rgba(120,200,255,.90)"
                : a.defRole===DEF_ROLE.MARK   ? "rgba(200,160,255,.85)"
                                              : "rgba(255,255,255,.55)";
      ctx.fillStyle=col;
      ctx.fillText("["+a.defRole+"]"+(a._pressS!=null?" "+a._pressS.toFixed(2):""), p[0]-13, p[1]+15);
      /* 🛡️ 포백 보호 — 스크린은 볼과 우리 골문을 잇는 선을 함께 그린다 (§38) */
      if(a.defRole===DEF_ROLE.SCREEN || a.defRole===DEF_ROLE.BLOCK_SHOT){
        const gx=(a.dir>0)?0.02:0.98;
        const g0=[IX(s.ball.x), IY(s.ball.y)], g1=[IX(gx), IY(0.5)];
        ctx.strokeStyle="rgba(255,235,140,.30)"; ctx.lineWidth=1; ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.moveTo(g0[0],g0[1]); ctx.lineTo(g1[0],g1[1]); ctx.stroke();
        ctx.setLineDash([]);
      }
      /* 세 후보의 상황 점수 — 왜 이 역할이 이겼는지 눈으로 본다 (§24·§65) */
      try{
        const S=a._defS, B=roleBias(a);
        if(S){ ctx.fillStyle="rgba(255,255,255,.40)";
          ctx.fillText("길목"+S.lane.toFixed(2)+" 마크"+S.mark.toFixed(2)+" 라인"+S.line.toFixed(2),
                       p[0]-13, p[1]+23); }
        ctx.fillStyle="rgba(255,255,255,.32)";
        ctx.fillText("압박"+B.fPress.toFixed(2)+" 밀착"+B.fMark.toFixed(2), p[0]-13, p[1]+31);
      }catch(e){}
      /* 대상까지 선을 긋는다 — 누구를 잡고 있는지 눈으로 본다 */
      let tgt=null;
      if(a.defRole===DEF_ROLE.MARK && a._mark) tgt=[IX(a._mark.x), IY(a._mark.y)];
      else if(a.defRole===DEF_ROLE.COVER_WIDE && a._coverAt) tgt=[IX(a._coverAt.x), IY(a._coverAt.y)];
      else if(a.defRole===DEF_ROLE.RECOVER && a._recover) tgt=[IX(a._recover.x), IY(a._recover.y)];
      else if(a.defRole===DEF_ROLE.PRESS || a.defRole===DEF_ROLE.JOCKEY)
        tgt=[IX(s.ball.x), IY(s.ball.y)];
      if(tgt){
        ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash([2,3]);
        ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(tgt[0],tgt[1]); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }catch(e){}
  /* 🥅 슈팅 디버그 — 조준점 ○ 과 실제 착탄점 ● 은 다르다 (§53·§54) */
  try{
    const sd=b&&b._shotDbg;
    if(sd && b.state==="SHOT"){
      const P=(x,y)=>[IX(x), IY(y)];
      const aim=P(sd.gx, sd.aimY), hit=P(sd.gx, sd.hitY);
      ctx.save();
      /* 골문 폭과 조준 오차 범위(±1σ) */
      const g0=P(sd.gx, 0.5-GOAL_HALF), g1=P(sd.gx, 0.5+GOAL_HALF);
      ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(g0[0],g0[1]); ctx.lineTo(g1[0],g1[1]); ctx.stroke();
      const s0=P(sd.gx, sd.aimY-sd.sy), s1=P(sd.gx, sd.aimY+sd.sy);
      ctx.strokeStyle="rgba(255,215,90,.40)"; ctx.lineWidth=5;
      ctx.beginPath(); ctx.moveTo(s0[0],s0[1]); ctx.lineTo(s1[0],s1[1]); ctx.stroke();
      ctx.strokeStyle="rgba(255,215,90,.95)"; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.arc(aim[0],aim[1],4.5,0,7); ctx.stroke();          // 조준점 ○
      const onT=Math.abs(sd.hitY-0.5)<GOAL_HALF && sd.hitZ<CROSSBAR_Z;
      ctx.fillStyle=onT?"rgba(120,255,150,.95)":"rgba(255,120,110,.95)";
      ctx.beginPath(); ctx.arc(hit[0],hit[1],3.6,0,7); ctx.fill();            // 착탄점 ●
      ctx.strokeStyle=ctx.fillStyle; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(aim[0],aim[1]); ctx.lineTo(hit[0],hit[1]); ctx.stroke();
      if(sd.gkY!=null){ const gp=P(sd.gkX, sd.gkY);
        ctx.fillStyle="rgba(120,200,255,.95)";
        ctx.beginPath(); ctx.moveTo(gp[0],gp[1]-5); ctx.lineTo(gp[0]-4,gp[1]+3);
        ctx.lineTo(gp[0]+4,gp[1]+3); ctx.closePath(); ctx.fill(); }           // GK ▲
      ctx.font="9px monospace"; ctx.fillStyle="rgba(255,255,255,.92)";
      ctx.fillText(sd.type+"  "+sd.distM.toFixed(0)+"m  "+sd.outcome, hit[0]+10, hit[1]-12);
      ctx.fillStyle="rgba(200,230,255,.85)";
      ctx.fillText("정확도"+sd.q.toFixed(2)+" 파워"+sd.power.toFixed(2)
                  +" 높이"+(sd.hitZ*67).toFixed(1)+"m 압박"+sd.press.toFixed(1), hit[0]+10, hit[1]);
      if(sd.pow){ ctx.fillStyle="rgba(255,200,140,.85)";
        ctx.fillText("근력"+sd.pow.pw.toFixed(2)+" 접촉"+sd.pow.q.toFixed(2)
                    +" 분산"+sd.pow.varK.toFixed(2)+" 체력"+sd.pow.fatK.toFixed(2)
                    +" → "+sd.pow.ms.toFixed(1)+"m/s", hit[0]+10, hit[1]+11); }
      /* 🧤 골키퍼 — 도달 범위와 다이빙 방향, 반응 시간 (§55·§56) */
      const gd=b._gkDbg;
      if(gd && sd.gkY!=null){
        const gp=P(sd.gkX, gd.gkY);
        const px=Math.abs(IY(0.5+gd.reach)-IY(0.5));          // 도달 범위를 화면 픽셀로
        ctx.strokeStyle = (gd.need<=gd.reach) ? "rgba(120,200,255,.55)" : "rgba(255,130,110,.55)";
        ctx.lineWidth=1.4; ctx.setLineDash([2,3]);
        ctx.beginPath(); ctx.arc(gp[0], gp[1], px, 0, 7); ctx.stroke();   // 커버 영역
        ctx.setLineDash([]);
        const dv=(gd.dive==="LEFT")?-1:1;                     // 다이빙 방향 →
        ctx.strokeStyle="rgba(120,200,255,.95)"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(gp[0],gp[1]);
        ctx.lineTo(gp[0], gp[1]+dv*Math.min(px,26)); ctx.stroke();
        ctx.fillStyle="rgba(120,200,255,.90)";
        ctx.fillText("GK "+(gd.rec?"RECOVER":(gd.need<=gd.reach?"SAVE":"BEATEN"))
                    +" 반응"+gd.reactT.toFixed(2)+"s 여유"+gd.tAvail.toFixed(2)+"s",
                    gp[0]+10, gp[1]+12);
        ctx.fillText("도달"+(gd.reach*67).toFixed(1)+"m / 필요"+(gd.need*67).toFixed(1)+"m"
                    +(gd.screen>0.05?" 시야가림"+gd.screen.toFixed(2):""), gp[0]+10, gp[1]+22);
      }
      ctx.restore();
    }
  }catch(e){}
  /* ⚽ 크로스 디버그 — 박스의 다섯 공간, 고른 공간, 실제 낙하 지점 */
  try{
    const cd=b&&b._crossDbg;
    if(cd && b.isCross && b.state==="PASS"){
      const P=(x,y)=>[IX(x), IY(y)];
      ctx.save(); ctx.font="8px monospace";
      for(const z of cd.zones){
        const p=P(z.x,z.y), on=(z.z===cd.zone);
        ctx.strokeStyle=on?"rgba(255,215,90,.95)":"rgba(255,255,255,.28)";
        ctx.lineWidth=on?2:1;
        ctx.beginPath(); ctx.arc(p[0],p[1], on?9:6, 0, 7); ctx.stroke();
        ctx.fillStyle=on?"rgba(255,215,90,.95)":"rgba(255,255,255,.42)";
        ctx.fillText(z.z[0], p[0]-3, p[1]+3);
      }
      const ideal=P(cd.ix,cd.iy), land=P(b.tx,b.ty), from=P(b.sx,b.sy);
      ctx.strokeStyle="rgba(120,200,255,.55)"; ctx.lineWidth=1.2; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(from[0],from[1]); ctx.lineTo(ideal[0],ideal[1]); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle=(cd.err===CROSS_ERR.GOOD)?"rgba(120,255,150,.9)":"rgba(255,130,110,.9)";
      ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(ideal[0],ideal[1]); ctx.lineTo(land[0],land[1]); ctx.stroke();
      ctx.fillStyle="rgba(255,255,255,.92)"; ctx.font="9px monospace";
      ctx.fillText(cd.type+" / "+cd.traj, land[0]+10, land[1]-14);
      ctx.fillText("품질"+cd.q.toFixed(2)+" "+cd.err+" 체공"+cd.T.toFixed(1)+"s", land[0]+10, land[1]-3);
      ctx.fillStyle="rgba(200,230,255,.85)";
      ctx.fillText("공격도착"+(cd.aT!=null?cd.aT.toFixed(2):"-")+"s 수비"+(cd.dT!=null?cd.dT.toFixed(2):"-")
                  +"s GK위험"+cd.gk.toFixed(2), land[0]+10, land[1]+8);
      ctx.restore();
    }
  }catch(e){}
  /* 🌌 공간 패스 디버그 — 수신자 ● → 이상적 목표 ● → 최종 목표 ●
     "공을 선수에게 보냈나, 공간으로 보냈나"를 눈으로 확인하는 장치. */
  try{
    const pl=b&&b._plan;
    if(pl && pl.space && pl.idealX!=null && b.state==="PASS"){
      const rc=pl.toId!=null?s.byId(pl.toId):null;
      const P=(x,y)=>[IX(x), IY(y)];
      const ideal=P(pl.idealX, pl.idealY), fin=P(b.tx, b.ty);
      ctx.save();
      if(rc){ const r0=P(rc.x, rc.y);
        ctx.strokeStyle="rgba(120,200,255,.75)"; ctx.lineWidth=1.4; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(r0[0],r0[1]); ctx.lineTo(ideal[0],ideal[1]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle="rgba(120,200,255,.95)";
        ctx.beginPath(); ctx.arc(r0[0],r0[1],3.4,0,7); ctx.fill();
      }
      ctx.strokeStyle="rgba(255,215,90,.9)"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(ideal[0],ideal[1]); ctx.lineTo(fin[0],fin[1]); ctx.stroke();
      ctx.fillStyle="rgba(255,215,90,.9)";
      ctx.beginPath(); ctx.arc(ideal[0],ideal[1],3.2,0,7); ctx.fill();
      /* 최종 목표 = 공간 — 고리로 그려 "빈 곳"임을 드러낸다 */
      const sp=pl.space, good=sp.sq>0.6&&sp.corridor<0.3;
      ctx.strokeStyle=good?"rgba(120,255,150,.95)":"rgba(255,130,110,.95)"; ctx.lineWidth=2.2;
      ctx.beginPath(); ctx.arc(fin[0],fin[1],6.5,0,7); ctx.stroke();
      ctx.beginPath(); ctx.arc(fin[0],fin[1],2,0,7); ctx.fill();
      ctx.font="9px monospace"; ctx.fillStyle="rgba(255,255,255,.92)";
      ctx.fillText(pl.type+" "+(pl.leadM||0).toFixed(1)+"m", fin[0]+9, fin[1]-6);
      ctx.fillStyle="rgba(200,230,255,.85)";
      ctx.fillText("공간"+sp.sq.toFixed(2)+" 차단"+sp.corridor.toFixed(2)
                  +" 각"+sp.angle.toFixed(2)+" 도달"+sp.reach.toFixed(2), fin[0]+9, fin[1]+5);
      ctx.restore();
    }
  }catch(e){}
  const arrow=(px,py,ang,len,col,dash)=>{
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=1.6;
    if(dash) ctx.setLineDash([3,3]);
    const ex=px+Math.cos(ang)*len, ey=py+Math.sin(ang)*len;
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ex,ey);
    ctx.lineTo(ex-Math.cos(ang-0.4)*5, ey-Math.sin(ang-0.4)*5);
    ctx.lineTo(ex-Math.cos(ang+0.4)*5, ey-Math.sin(ang+0.4)*5);
    ctx.closePath(); ctx.fillStyle=col; ctx.fill(); ctx.restore();
  };
  /* 모든 선수의 몸 방향 */
  for(const a of s.agents){
    if(a.face===undefined) continue;
    const p=pitchToCanvasXY(cv, IX(a), IY(a));
    arrow(p.x, p.y, a.face, 13, "rgba(255,255,255,.55)");
  }
  /* 수신 중인 선수 — 자세 목표와 공 방향 */
  if(b.state==="PASS" && b.toId!=null){
    const r=s.byId(b.toId);
    if(r){
      const p=pitchToCanvasXY(cv, IX(r), IY(r));
      const bp=pitchToCanvasXY(cv, IX(b), IY(b));
      ctx.save(); ctx.strokeStyle="rgba(88,190,255,.75)"; ctx.lineWidth=1.4; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      try{
        const want=receivingOrientation(r, b, s.side(s.opp(r.side)), r.dir);
        arrow(p.x, p.y, want, 22, "rgba(255,214,64,.95)");
      }catch(e){}
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2);
      ctx.strokeStyle="rgba(255,214,64,.55)"; ctx.lineWidth=1.2; ctx.stroke(); ctx.restore();
    }
  }
  /* 🎯 패스 — 노린 지점(●)과 실제 도착점(○), 오차 벡터 */
  if(b.state==="PASS" && b._plan){
    const P=b._plan;
    if(P.aim){
      const ap=pitchToCanvasXY(cv, IX(P.aim), IY(P.aim));
      const dp=pitchToCanvasXY(cv, IX({x:b.tx,y:b.ty}), IY({x:b.tx,y:b.ty}));
      ctx.save();
      ctx.fillStyle="rgba(120,255,150,.95)";            // 노린 지점 — 채운 점
      ctx.beginPath(); ctx.arc(ap.x, ap.y, 3.5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle="rgba(255,90,90,.95)"; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.arc(dp.x, dp.y, 4.5, 0, Math.PI*2); ctx.stroke();   // 실제 도착 — 빈 원
      ctx.setLineDash([2,2]); ctx.strokeStyle="rgba(255,140,140,.7)";
      ctx.beginPath(); ctx.moveTo(ap.x,ap.y); ctx.lineTo(dp.x,dp.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font="10px ui-monospace,monospace"; ctx.fillStyle="rgba(200,255,200,.95)";
      ctx.fillText(P.type+" · "+(P.grade||"-"), ap.x+7, ap.y-6);
      ctx.restore();
    }
  }
  /* 🎯 Receive Target — 받을 지점(원)과 선수→지점 벡터 */
  if(b.state==="PASS" && b.toId!=null){
    const r=s.byId(b.toId);
    if(r && r._rcv){
      const rt=r._rcv;
      const tp=pitchToCanvasXY(cv, IX({x:rt.x,y:rt.y}), IY({x:rt.x,y:rt.y}));
      const pp=pitchToCanvasXY(cv, IX(r), IY(r));
      ctx.save();
      ctx.strokeStyle="rgba(255,120,200,.9)"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(pp.x,pp.y); ctx.lineTo(tp.x,tp.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(tp.x, tp.y, 4+rt.intent*7, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle="rgba(255,120,200,.20)"; ctx.fill();
      ctx.font="10px ui-monospace,monospace"; ctx.fillStyle="rgba(255,160,220,.95)";
      ctx.fillText(rt.state.replace("RECEIVE_",""), tp.x+8, tp.y-6);
      ctx.restore();
    }
  }
  /* 소유 중 — 선수와 공을 잇는 로컬 오프셋 + 다음 터치 지점 */
  if(b.state==="SETTLED" && b.ownerId!=null){
    const c=s.byId(b.ownerId);
    if(c){
      const p=pitchToCanvasXY(cv, IX(c), IY(c)), bp=pitchToCanvasXY(cv, IX(b), IY(b));
      ctx.save(); ctx.strokeStyle="rgba(63,185,80,.85)"; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(bp.x,bp.y); ctx.stroke(); ctx.restore();
      /* 🎯 다음 터치 지점 — 이번 터치로 공이 갈 자리 */
      const D=b._drb;
      if(D){
        const nx=c.x+Math.cos(D.ang)*(D.distM/67)/PITCH_AR, ny=c.y+Math.sin(D.ang)*(D.distM/67);
        const np=pitchToCanvasXY(cv, IX({x:nx,y:ny}), IY({x:nx,y:ny}));
        const knock=(D.state===DRB.KNOCK);
        ctx.save();
        ctx.strokeStyle=knock?"rgba(255,110,60,.95)":"rgba(120,220,255,.85)";
        ctx.lineWidth=knock?2.2:1.3; ctx.setLineDash(knock?[]:[3,3]);
        ctx.beginPath(); ctx.moveTo(bp.x,bp.y); ctx.lineTo(np.x,np.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(np.x, np.y, knock?7:4, 0, Math.PI*2); ctx.stroke();
        ctx.font="10px ui-monospace,monospace";
        ctx.fillStyle=knock?"rgba(255,150,90,.95)":"rgba(150,225,255,.9)";
        ctx.fillText(D.state.replace("_DRIBBLE","").replace("_TOUCH","").replace("_AND_RUN",""), np.x+8, np.y+4);
        ctx.restore();
      }
    }
  }
  /* 🎱 공 속도 벡터 */
  {
    const bp=pitchToCanvasXY(cv, IX(b), IY(b));
    const sp=HYP((b.vx||0)*PITCH_AR, b.vy||0);
    if(sp>1e-4){
      const ang=Math.atan2(b.vy||0,(b.vx||0)*PITCH_AR);
      const len=clamp(sp*90, 6, 46);
      ctx.save(); ctx.strokeStyle="rgba(255,255,120,.9)"; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(bp.x,bp.y);
      ctx.lineTo(bp.x+Math.cos(ang)*len, bp.y+Math.sin(ang)*len); ctx.stroke();
      ctx.restore();
    }
    if((b.z||0)>0.004){   // 공중이면 높이를 숫자로
      ctx.save(); ctx.font="10px ui-monospace,monospace"; ctx.fillStyle="rgba(255,255,160,.95)";
      ctx.fillText(((b.z||0)*67).toFixed(1)+"m", bp.x+9, bp.y-10); ctx.restore();
    }
  }
  /* 상태 텍스트 */
  ctx.save();
  ctx.font="11px ui-monospace,monospace"; ctx.textAlign="left";
  const lines=[];
  if(b.state==="PASS" && b._plan){
    const P=b._plan;
    lines.push("PASS "+P.type+"  "+(P.grade||"-")
      +"  난이도="+(P.diff!=null?P.diff.toFixed(2):"-")+"  실력="+(P.exec!=null?P.exec.toFixed(2):"-"));
    lines.push("  오차 가로="+(P.latM!=null?P.latM.toFixed(2):"-")+"m  세로="+(P.lonR!=null?(P.lonR*100).toFixed(0)+"%":"-"));
  }
  if(b._contact) lines.push("CONTACT "+b._contact.part+" · "+b._contact.kind
    +"  터치="+b._contact.q+"  상대속도="+((b._contact.rel||0)*67).toFixed(1)+"m/s");
  lines.push("PHYS "+(b.phys||"-")+"  바운스="+(b.bounced||0)+"회"
    +"  vz="+((b.vz||0)*67).toFixed(1)+"m/s");
  lines.push("BALL "+(b.ctrl||"-")+"  z="+((b.z||0)*67).toFixed(1)+"m  v="+(HYP((b.vx||0)*PITCH_AR,b.vy||0)*67/SIM_DT).toFixed(1)+"m/s");
  if(b.state==="SETTLED" && b.ownerId!=null && b._loc){
    const c=s.byId(b.ownerId);
    lines.push("OWNER "+(c&&c.p?c.p.name:"?")+"  local fwd="+(b._loc.fwd*67).toFixed(2)+"m lat="+(b._loc.lat*67).toFixed(2)+"m");
    lines.push("hold="+(b.hold||0).toFixed(2)+"s  touch="+(b._ftQ||"-"));
    const D=b._drb;
    if(D) lines.push("DRIB "+D.state+"  터치="+D.distM.toFixed(2)+"m  간격="+D.iv.toFixed(2)+"s"
      +"  앞공간="+D.spaceM.toFixed(1)+"m  상대="+D.oppM.toFixed(1)+"m  압박="+D.press.toFixed(2));
    if(b._knock) lines.push("  ⚡ KNOCK-AND-RUN  차놓은 거리 "+b._knock.dist.toFixed(1)+"m");
  }
  if(b.state==="PASS" && b.toId!=null){
    const r=s.byId(b.toId);
    if(r && r.p){
      const A=r.p.attr||{};
      lines.push("RECV "+r.p.name+"  fir="+attr20(A.fir||60)+" tec="+attr20(A.tec||60)+" cmp="+attr20(A.cmp||60)+" dec="+attr20(A.dec||60));
      if(r._rcv) lines.push("  "+r._rcv.state.replace("RECEIVE_","")+"  intent="+r._rcv.intent.toFixed(2)
        +"  거리="+(r._rcv.dLand*67).toFixed(1)+"m  나 "+r._rcv.myT.toFixed(2)+"s / 상대 "+(r._rcv.oppT>8?"-":r._rcv.oppT.toFixed(2)+"s"));
      try{ lines.push("diff="+ftDifficulty(r,b,s.side(s.opp(r.side))).toFixed(2)+"  skill="+ftSkill(r, ftDifficulty(r,b,s.side(s.opp(r.side)))).toFixed(2)); }catch(e){}
    }
  }
  ctx.fillStyle="rgba(0,0,0,.55)";
  ctx.fillRect(6, 6, 330, 12+lines.length*13);
  ctx.fillStyle="#d6f0ff";
  lines.forEach((L,i)=>ctx.fillText(L, 12, 20+i*13));
  ctx.restore();
}
/* 공이 지나온 자취 — 빠르게 날아가는 슛일수록 잔상이 길게 남아 속도감이 보인다 */
/* 🌧️ 빗줄기·눈송이 — 화면 크기에 맞춰 한 번만 만들고 계속 굴린다 */
let WXFX=null;
function drawWeatherFx(ctx, cv, wx){
  if(!wx) return;
  const rain=(wx.k==="rain"||wx.k==="storm"), snow=(wx.k==="snow");
  if(!rain && !snow) return;
  const W=cv.width, H=cv.height, K=cvK(cv);
  const n = snow ? Math.round(70+wx.wet*40) : Math.round(90+ (wx.k==="storm"?110:40) );
  if(!WXFX || WXFX.n!==n || WXFX.w!==W || WXFX.h!==H || WXFX.k!==wx.k){
    WXFX={n, w:W, h:H, k:wx.k, p:[]};
    for(let i=0;i<n;i++) WXFX.p.push({x:Math.random()*W, y:Math.random()*H,
      v:(snow?0.6:3.4)+Math.random()*(snow?0.8:2.6), s:0.5+Math.random()*0.9, ph:Math.random()*6.28});
  }
  const t=(typeof nowMs==="function"?nowMs():0)/1000;
  const drift=Math.cos(wx.wdir||0)*(snow?1.4:2.4)*(0.4+(wx.wind||0));
  ctx.save();
  if(snow){
    ctx.fillStyle="rgba(255,255,255,0.72)";
    for(const p of WXFX.p){
      p.y+=p.v; p.x+=drift*0.35+Math.sin(t*1.4+p.ph)*0.5;
      if(p.y>H){ p.y=-4; p.x=Math.random()*W; }
      if(p.x<-6) p.x=W+4; else if(p.x>W+6) p.x=-4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s*1.5*K, 0, Math.PI*2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = wx.k==="storm" ? "rgba(190,215,240,0.42)" : "rgba(190,215,240,0.30)";
    ctx.lineWidth=1*K;
    ctx.beginPath();
    for(const p of WXFX.p){
      p.y+=p.v*2.6; p.x+=drift;
      if(p.y>H){ p.y=-10; p.x=Math.random()*W; }
      if(p.x<-10) p.x=W+6; else if(p.x>W+10) p.x=-6;
      const L=(6+p.v*2.2)*K;
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x-drift*1.6, p.y-L);
    }
    ctx.stroke();
    /* 폭우는 화면 전체를 조금 어둡게 덮는다 */
    if(wx.k==="storm"){ ctx.fillStyle="rgba(120,150,180,0.07)"; ctx.fillRect(0,0,W,H); }
  }
  ctx.restore();
}
function drawBallTrail(ctx, cv, trail){
  for(let i=0;i<trail.length;i++){
    const p=trail[i], a=(i+1)/trail.length;
    const {x,y}=pitchToCanvasXY(cv,p.x,p.y);
    ctx.globalAlpha=a*0.30;
    ctx.beginPath(); ctx.arc(x, y-(p.lift||0)*16, 3.2*a, 0, Math.PI*2);
    ctx.fillStyle="#fff"; ctx.fill();
  }
  ctx.globalAlpha=1;
}
/* 주심 — 검은 점으로 그려 양 팀 바둑알과 구분한다 */
function drawRefXY(ctx, cv, nx, ny){
  const {x,y}=pitchToCanvasXY(cv,nx,ny);
  ctx.beginPath(); ctx.arc(x,y,6.5,0,Math.PI*2);
  ctx.fillStyle="#141414"; ctx.fill();
  ctx.lineWidth=1.5; ctx.strokeStyle="rgba(255,255,255,.7)"; ctx.stroke();
}
/* 심판이 꺼내 든 카드 — raise가 커질수록 위로 높이 올라간다 */
function drawCard2D(ctx, cv, card){
  const {x,y}=pitchToCanvasXY(cv, card.at.x, card.at.y);
  const top=y-(13+(card.raise||0)*15), w=9, h=13;
  if(card.whistle){ drawWhistle2D(ctx, x+9, top+6, 1); return; }
  ctx.fillStyle=card.color; ctx.fillRect(x+5, top, w, h);
  ctx.lineWidth=1; ctx.strokeStyle="rgba(0,0,0,.65)"; ctx.strokeRect(x+5, top, w, h);
}
/* 🔵 휘슬 — 「반칙」 표시. 카드가 나오지 않는 반칙은 화면에 아무 표시가 없어
   왜 경기가 끊겼는지 읽히지 않았다(요청). 카드와 같은 자리·같은 크기로 그린다.
   몸통(원) + 물부리(사다리꼴) + 구멍(점) — 작아도 휘슬로 읽힌다. */
function drawWhistle2D(ctx, x, y, k){
  k=k||1;
  ctx.save();
  ctx.lineJoin="round";
  ctx.fillStyle="#eaf2fb"; ctx.strokeStyle="rgba(0,0,0,.7)"; ctx.lineWidth=1*k;
  ctx.beginPath();                                  // 물부리
  ctx.moveTo(x+2.2*k, y-3.4*k); ctx.lineTo(x+9.5*k, y-2.4*k);
  ctx.lineTo(x+9.5*k, y+0.8*k); ctx.lineTo(x+2.2*k, y+1.8*k); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y-0.6*k, 4.3*k, 0, Math.PI*2); ctx.fill(); ctx.stroke();   // 몸통
  ctx.fillStyle="#0d1117";
  ctx.beginPath(); ctx.arc(x-0.4*k, y-0.9*k, 1.35*k, 0, Math.PI*2); ctx.fill();          // 구멍
  ctx.restore();
}
function pitch2DCtx(){
  const cv=document.getElementById("pitch2d");
  if(!cv || !cv.getContext) return null;
  return {cv, ctx:cv.getContext("2d")};
}
function nowMs(){ return (typeof performance!=="undefined"&&performance.now)?performance.now():Date.now(); }
function clamp01(v){ return v<0?0:v>1?1:v; }
/* 하이라이트가 "인플레이 공격 장면"인지 구분한다 — 이 종류일 때만 22명 전체가 움직이고, 카드/파울/부상/
   교체/VAR/킥오프처럼 경기가 멈춘 상황에서는 실제 축구처럼 선수들도 제자리에 서 있는다. */
const INPLAY_KINDS={ shot_action:1, shot_goal:1, shot_save:1, shot_block:1, shot_miss:1, shot_corner:1, shot_owngoal:1,
                     pen_action:1, pen_goal:1, pen_miss:1 };
