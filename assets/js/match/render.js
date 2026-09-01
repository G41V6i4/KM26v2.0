"use strict";
function render2DTick(now){
  const c=pitch2DCtx(); if(!c || !liveM) return;
  const {cv,ctx}=c;
  // 연속 2D 매치엔진 — 각본 재생이 아니라 실제로 굴러간 경기를 그린다.
  if(liveSim){
    /* ⚠ 제보 — 「공이 패스나 슈팅으로 이동되다가 확 빨라져서 스킵되는 것처럼 보인다」.
       한 원인이 여기였다. 화면이 한 번 버벅여 dt 가 크게 잡히면(예 0.25초) 재생이 그만큼
       한꺼번에 밀려, 한 장의 화면에서 공이 시뮬 2~3프레임(최대 13m)을 건너뛰었다.
       ─ 한 프레임이 밀 수 있는 시간을 1/24초로 묶는다. 버벅이면 「건너뛰는」 대신
         재생이 아주 살짝 느려질 뿐이다 (장면 길이는 몇 초짜리라 티가 나지 않는다). */
    const dt=(lastHLTick==null)?1/60:Math.min(1/24,(now-lastHLTick)/1000);
    lastHLTick=now;
    /* ⚠ 제보 — 「코너킥 준비 중에 일시정지를 눌렀더니 상대가 세리머니를 하고 있다. 재생하니 진짜 골」.
       하이라이트는 이미 굴러간 장면을 되감아 보여 주는 것이라, 시뮬(liveSim)은 그 장면의 끝
       ─ 즉 골이 들어간 뒤 ─ 에 서 있다. 그런데 일시정지하면 이 분기가 else 로 빠져
       drawSimWatch(liveSim)이 「미래의 그라운드」를 그대로 그려 버렸다. 결과를 미리 알려 준 셈이다.
       멈췄으면 멈춘 그 프레임을 그대로 붙잡고 있어야 한다. */
    if(liveHL){
      if(!livePaused) advanceHighlight(dt);      // 멈춰 있는 동안엔 재생헤드를 밀지 않는다
      if(liveHL) drawHighlightFrame(cv, liveHL); // 화면은 「지금 보고 있던 그 장면」에 그대로 정지
      else drawSimWatch(cv, liveSim);
      syncGoalPanel(liveSim);
    } else {
      /* 🎞️ 하이라이트 사이 — 경기는 뒤에서 빨리 감기는 중.
         ⚠ 제보 원문 「하이라이트 장면 뒤에는 블라인드 처리되면서 선수들이 막 움직이면서
            스킵되잖아? 예전에는 선수들이 다같이 막 움직이면서 빠르게 지나갔는데, 지금은
            몇몇 선수들만 움직이네? … 약간 어색하달까?」
         원인: 「공이 스킵된다」를 잡으려고 마지막 프레임 한 장을 붙잡아 그렸는데,
         그 프레임에 기록돼 있던 선수만 고정되고 그 뒤에 교체로 들어온 선수는 실시간
         좌표 그대로 뛰었다 — 22명 중 몇 명만 움직이는 화면이 됐다.
         ─ 다시 「지금 굴러가는 그라운드」를 통째로 그린다(전원이 함께 빨리 감긴다).
           원래 문제였던 공만 따로 손본다 — drawSimWatch 의 liveFF 분기 참고. */
      liveFF=true;
      try{ drawSimWatch(cv, liveSim); } finally { liveFF=false; }
      /* 아직 보여 주지 않은 골을 미리 알리지 않는다 — 빨리 감기 구간에서는 득점 패널을 띄우지 않는다 */
      if(goalPanelShownFor!==null){ goalPanelShownFor=null; hideGoalPanel(); }
      const ctx=cv.getContext&&cv.getContext("2d");
      if(ctx && !livePaused){ ctx.fillStyle="rgba(6,10,14,0.55)"; ctx.fillRect(0,0,cv.width,cv.height); }
    }
    return;
  }
  const form=computeFormationPositions(liveM);
  let overrides={}, fade={}, ball=null, lift=0, ring=null, badge=null, card=null, sc=null;
  if(current2DScene){
    const cs=current2DScene;
    const t=Math.min(1,(now-cs.start)/cs.dur);
    const frame=computeSceneFrame(cs.event, t);
    overrides=frame.overrides||{}; fade=frame.fade||{}; ball=frame.ball; lift=frame.lift||0;
    ring=frame.ring; badge=frame.badge; card=frame.card;
    sc=cs.event.scene;
    // 애니메이션 단계에 맞춰 자막을 바꾼다 (패스 → 돌파 → 슛! → 결과)
    fireCommentaryBeats(cs, t);
    // 심판 이동 — 목표 지점으로 부드럽게 접근하되(REF_EASE), 초당 이동 거리를 REF_SPEED로 제한해
    // 사람이 뛰는 속도를 넘지 않게 한다. dt 기반이라 화면 주사율이 달라도 속도가 똑같이 유지된다.
    const dt = (lastRefTick==null) ? 1/60 : Math.min(0.1, Math.max(0,(now-lastRefTick)/1000));
    lastRefTick=now;
    const refT=frame.refTarget || (ball?refPostXY(ball, sc&&sc.atkSide==="a"?-1:1):REF_IDLE);
    const eased=lerpXY(refPos, refT, 1-Math.pow(1-REF_EASE, dt*60));
    const stepLen=distXY(eased, refPos), maxStep=REF_SPEED*dt;
    refPos = (stepLen>maxStep && stepLen>1e-9) ? lerpXY(refPos, eased, maxStep/stepLen) : eased;
    // 인플레이 중에는 공에 달라붙지 않도록 최소 거리를 강제한다(파울·부상 등 정지 상황에서는 가까이 간다)
    if(ball && sc && INPLAY_KINDS[sc.kind]){
      const d=distXY(refPos, ball);
      if(d<REF_MIN && d>1e-6){
        const k=REF_MIN/d;
        refPos={x:clamp01(ball.x+(refPos.x-ball.x)*k), y:clamp01(ball.y+(refPos.y-ball.y)*k)};
      }
    }
    if(ball){ ballTrail.push({x:ball.x, y:ball.y, lift}); if(ballTrail.length>10) ballTrail.shift(); }
    // 상태 기반 포지셔닝 AI — 인플레이 장면에서만 20명이 스스로 움직인다(정지 상황에서는 제자리)
    PITCH_AI.sync(form);
    if(sc && INPLAY_KINDS[sc.kind]){
      if(PITCH_AI.idle){ PITCH_AI.reset(); PITCH_AI.idle=false; }
      PITCH_AI.update(now, {ball, atkSide:sc.atkSide, overrides});
    } else if(!PITCH_AI.idle){ PITCH_AI.reset(); PITCH_AI.idle=true; }
    idleDrawKey=null; // 씬을 그린 뒤에는 화면이 포메이션 정지 상태가 아니므로 정지 화면 캐시를 무효화한다
    if(t>=1){
      current2DScene=null;
      // 슛(shot_action) 다음에는 곧바로 결과 장면이 이어져야 한다 — 여기서 텀을 주면 때린 공이
      // 공중에 멈춘 것처럼 보이므로 간격을 0으로 둔다.
      const gap = (sc && sc.kind==="shot_action") ? 0 : 100;
      if(cs.done){ const done=cs.done; setTimeout(done, gap); }
    }
  } else {
    // 정지 화면 — 라인업이 그대로면(교체·퇴장 없음) 굳이 같은 그림을 60fps로 다시 그리지 않는다
    refPos={x:REF_IDLE.x, y:REF_IDLE.y}; ballTrail=[]; lastRefTick=null;
    if(!PITCH_AI.idle){ PITCH_AI.reset(); PITCH_AI.idle=true; }
    const key=[...form.h,...form.a].map(d=>d.id+":"+d.x.toFixed(3)+","+d.y.toFixed(3)).join("|");
    if(key===idleDrawKey) return;
    idleDrawKey=key;
  }
  drawPitchBase(ctx, cv);
  // 스크립트 지정 좌표가 최우선, 그 외에는 AI가 계산한 위치(정지 상황이면 포메이션 자리)
  const aiOn = !!(sc && INPLAY_KINDS[sc.kind]);
  const posOf=(d)=> overrides[d.id] || (aiOn && PITCH_AI.posOf(d.id)) || {x:d.x, y:d.y};
  /* 🧤 골키퍼 킷 — 라이브 화면과 같은 규칙으로 고른다 (노란 킷과 겹치지 않게) */
  const _hc=liveM.home.col||"#2ea8ff", _ac=awayDiscCol(_hc, liveM.away.col||"#f85149");
  const _gk=gkKitsFor(_hc, _ac, liveM.home.id, liveM.away.id);
  const drawSide=(arr,color,gkCol)=>{
    for(const d of arr){
      const alpha=fade[d.id]!==undefined?fade[d.id]:1;
      if(alpha<=0.02) continue;
      const xy=posOf(d);
      ctx.globalAlpha=alpha;
      drawDotXY(ctx,cv,xy.x,xy.y, d.pos==="GK"?gkCol:color, d.pos==="GK"?6.2:5.6);   /* FM 비율 */
      ctx.globalAlpha=1;
    }
  };
  drawSide(form.h, _hc, _gk.h);
  drawSide(form.a, _ac, _gk.a);
  drawRefXY(ctx, cv, refPos.x, refPos.y);
  // 태클 시도 — 추격/차단 수비수가 드리블러에게 붙은 순간 잠깐 표시된다
  if(aiOn && PITCH_AI.tackle && now-PITCH_AI.tackle.at < 420){
    const tp=PITCH_AI.posOf(PITCH_AI.tackle.id);
    if(tp){
      const {x,y}=pitchToCanvasXY(cv, tp.x, tp.y);
      const k=1-(now-PITCH_AI.tackle.at)/420;
      ctx.globalAlpha=0.25+0.55*k;
      const kk=cvK(cv);
      ctx.beginPath(); ctx.arc(x, y, (8+8*(1-k))*kk, 0, Math.PI*2);
      ctx.strokeStyle="#ffd24f"; ctx.lineWidth=2.5*kk; ctx.stroke();
      ctx.globalAlpha=1;
    }
  }
  if(ring){
    const d=[...form.h,...form.a].find(x=>x.id===ring.id);
    const xy = overrides[ring.id] || (d?posOf(d):null);
    if(xy){
      const {x,y}=pitchToCanvasXY(cv,xy.x,xy.y);
      ctx.globalAlpha=ring.alpha!==undefined?ring.alpha:1;
      ctx.beginPath(); ctx.arc(x,y,9.5*cvK(cv),0,Math.PI*2);
      ctx.strokeStyle=ring.color; ctx.lineWidth=2.5*cvK(cv); ctx.stroke();
      ctx.globalAlpha=1;
    }
  }
  if(ballTrail.length>1) drawBallTrail(ctx, cv, ballTrail);
  const ballXY = ball || {x:0.5, y:0.5}; // 씬이 없을 때 공은 센터서클에 정지
  drawBallXY(ctx, cv, ballXY.x, ballXY.y, lift);
  if(card) drawCard2D(ctx, cv, card);
  if(badge){
    const {x,y}=pitchToCanvasXY(cv,0.5,0.06);
    ctx.fillStyle="#fff"; ctx.font="bold "+Math.round(13*cvK(cv))+"px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(badge, x, y);
  }
}
/* 라이브 매치 화면이 떠 있는 동안 계속 도는 렌더 루프 — 하이라이트 씬을 부드럽게 재생하기 위한 것이고,
   씬이 없는 동안에는 render2DTick이 정지 화면을 다시 그리지 않고 바로 빠져나온다. #pitch2d가 화면에
   없는 동안(예: 전술 수정 화면 진입 중)에도 안전하게 아무것도 안 하고 넘어간다. */
let live2DLoopId=null;
function start2DLoop(){
  if(live2DLoopId) return;
  const tick=(t)=>{ render2DTick(t!==undefined?t:nowMs()); live2DLoopId=requestAnimationFrame(tick); };
  live2DLoopId=requestAnimationFrame(tick);
}
function stop2DLoop(){
  if(live2DLoopId){ cancelAnimationFrame(live2DLoopId); live2DLoopId=null; }
}
