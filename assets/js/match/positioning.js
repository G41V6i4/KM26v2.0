"use strict";
/* =====================================================
   선수 포지셔닝 AI — 상태(State) 기반 돌파/추격 시스템

   스크립트가 지정한 주역(슈터·골키퍼·블로커·공)은 정해진 경로를 그대로 따르고, 그 외 20명 남짓은
   이 AI가 매 프레임 상태를 판단해 벡터로 움직인다. 결과(골/선방/빗나감)는 이미 매치 시뮬레이션이
   정해 두었으므로 AI는 결과를 바꾸지 않고 "그 장면이 실제 축구처럼 보이게" 하는 역할만 한다.

   [상태]
     DRIBBLING      공을 몰고 상대 골대로 전진(지그재그 + 드리블 속도 페널티)
     ATTACK_SUPPORT 패스를 받을 전방 공간으로 침투(드리블러와 간격 유지)
     ATTACK_HOLD    후방에서 균형을 잡으며 완만히 전진
     DEFEND_CHASE   드리블러의 현재 좌표를 실시간 타깃으로 최대 속도 추격
     DEFEND_BLOCK   드리블러와 골대 사잇길의 차단 지점을 선점
     DEFEND_MARK    침투하는 지원 공격수를 맨마킹
     DEFEND_LINE    자기 골대 쪽으로 라인을 내리며 볼사이드로 수렴
     GOALKEEPER     골라인 앞에서 공 방향으로 각을 좁힘
===================================================== */
const PLAYER_STATE={
  DRIBBLING:"DRIBBLING", ATTACK_SUPPORT:"ATTACK_SUPPORT", ATTACK_HOLD:"ATTACK_HOLD",
  DEFEND_CHASE:"DEFEND_CHASE", DEFEND_BLOCK:"DEFEND_BLOCK", DEFEND_MARK:"DEFEND_MARK",
  DEFEND_LINE:"DEFEND_LINE", GOALKEEPER:"GOALKEEPER"
};
/* 속도는 "초당 정규화 좌표" 단위 — 피치 가로 1.0 ≈ 105m 이므로 0.078 ≈ 8.2m/s(전력질주) */
/* 경기장을 70m 폭으로 넓히며 ×(67/70) 스케일 — 실제 m/s 는 그대로, 피치 대비로는 4.3% 느려져
   그만큼 공간이 산다. (스프린트 0.0747×70 ≈ 5.2m/s + 능력 배율) */
/* 🏃 속도 사다리 개편 (요청 「3으로 하자」 — 사다리 자체를 벌린다).
   ⚠ 예전: SPRINT 0.0747(5.2m/s) · RUN 0.0613(4.3) · DRIBBLE 0.0479(3.4) · JOG 0.0383(2.7).
      실측(1경기, 필드 플레이어): 속도 중앙값 3.54m/s, p90 5.23, 5m/s 초과 시간 21%, 선수당 이동 16.9km.
      「늘 빠르게 조깅하고 진짜 스프린트는 못 하는」 사다리였다 — 윙어(5.2)를 풀백(5.2)이 뒤에서 못 따라잡고,
      총 이동량은 실제(10~11km)의 1.6배. 이동 예산의 출처: 세트피스 배치 이동 2.44km(죽은 공인데 SPRINT),
      PRESS 2.36, ATT BALANCE 1.93(자리 지키는 역할이 평균 2.9m/s), DEF LINE 1.61.
   ─ JOG 2.0 · DRIBBLE 3.6 · RUN 4.6 · SPRINT 7.2 m/s. CARRY 는 예전 SPRINT 값 — 「사람이 발로 공을 옮기는
     속도 한도」 5곳(드리블 끌어오기·최종 상한·세트피스 놓기·죽은 공 굴림)이 SPRINT 에 묶여 있어 그대로 두면
     드리블이 7m/s 가 되므로 분리했다. GK 는 그대로. */
const SPD={ SPRINT:0.1029, RUN:0.0657, DRIBBLE:0.0514, JOG:0.0286, GK:0.0287, CARRY:0.0747 };
/* ── 주력·가속도를 화면에서 느끼게 하는 두 배수 ──────────────────────
   예전에는 최고 속도 배수가 0.89~1.11밖에 안 돼서, 주력 5인 노장과 주력 18인 윙어가
   사실상 같은 속도로 뛰었다. 축구에서 스피드는 그렇게 작은 차이가 아니다.
   리그 평균(≈0.60)이 정확히 1.00이 되도록 맞추고, 위아래로 ±20% 남짓 벌린다.
   · paceMul  — 길게 달릴 때의 최고 속도. 뒷공간 경쟁·역습 상황을 지배한다.
   · accMul   — 첫 몇 걸음. 세컨볼 다툼, 압박 도달, 돌파 직후 이탈이 여기서 갈린다.
   둘을 나눈 이유는 "느리지만 순간적인" 선수와 "굼뜨지만 최고속이 높은" 선수가
   서로 다른 장면에서 강해야 하기 때문이다. */
const SPD_A=0.533, SPD_B=0.780, SPD_LO=0.76, SPD_HI=1.22;
const ACC_A=0.300, ACC_B=1.170, ACC_LO=0.62, ACC_HI=1.52;
/* ═══════════════════════════════════════════════════════════════
   🔋 체력이 경기력을 깎는다 (제보)
   ⚠ 여러 판단 로직이 d.stam / shooter.stam 을 읽고 있었는데, 정작 그 값을
      아무도 채우지 않아 90분 내내 1(팔팔함)로 계산됐다. 즉 체력은 숫자만
      떨어질 뿐 경기력에 아무 영향이 없었고, 그래서 교체를 쓸 이유도 없었다.
   ─ 체력 76 이상은 영향 없음 · 그 아래로 급격히 · 40 에서 바닥.
     실측상 60분 평균 체력이 72 이므로, 후반 중반부터 눈에 띄게 무거워진다. */
const STAM_FULL=0.76, STAM_DEAD=0.40;
function stamOf(a){ return (a && a.stam!=null) ? a.stam : 1; }
/* 0(탈진) ~ 1(팔팔). 제곱을 씌워 「멀쩡하다가 훅 가는」 곡선을 만든다. */
function stamRate(a){
  const s=stamOf(a);
  if(s>=STAM_FULL) return 1;
  const r=clamp((s-STAM_DEAD)/(STAM_FULL-STAM_DEAD), 0, 1);
  return r*r*0.55 + r*0.45;
}
/* 항목별 감쇠 폭 — lo 는 완전히 지쳤을 때의 배수 */
function stamK(a, lo){ return lo + (1-lo)*stamRate(a); }
function paceMul(a){
  const v=(a && a.topSpeed!=null) ? a.topSpeed : ((a && a.paceSkill) || 0.6);
  /* 다리가 무거우면 최고 속도가 먼저 떨어진다 — 뒷공간 경쟁에서 바로 드러난다 */
  return clamp((SPD_A+v*SPD_B)*stamK(a,0.86), SPD_LO*0.86, SPD_HI);
}
/* 🌨️ 미끄러운 잔디 — 첫 발이 안 붙는다 (눈·언 땅에서 가장 크다) */
function wxAccK(){ return 1 - clamp(WX_NOW.slip||0,0,1)*0.14 - Math.max(0, -(WX_NOW.heat||0))*0.05; }
function accMul(a){
  const v=(a && a.accelSkill!=null) ? a.accelSkill : ((a && a.paceSkill) || 0.6);
  /* 첫 몇 걸음이 안 나가는 게 지친 선수의 가장 뚜렷한 증상이다 */
  return clamp((ACC_A+v*ACC_B)*stamK(a,0.80)*wxAccK(), ACC_LO*0.75, ACC_HI);
}
const ACCEL_TAU=0.18;      // 목표 속도에 붙는 시간상수(초) — 작을수록 민첩하게 방향을 바꾼다
const SEPARATION=0.030;    // 이 거리보다 가까우면 서로 밀어내 바둑알이 겹치지 않게 한다
const TACKLE_DIST=0.025;   // 캔버스 기준 약 15px — 수비수가 이 안으로 들어오면 태클 시도 트리거
/* 한 명의 선수 바둑알. 좌표(x,y)와 속도(vx,vy)를 갖고, 목표 지점을 향해 가속하며 움직인다. */
class PlayerAgent{
  constructor(d){
    this.id=d.id; this.name=d.name; this.pos=d.pos; this.side=d.side;
    this.x=d.x; this.y=d.y; this.vx=0; this.vy=0;
    this.home={x:d.x, y:d.y};
    this.state=PLAYER_STATE.ATTACK_HOLD;
    this.seed=(d.id*37)%100;
  }
  setHome(x,y){ this.home.x=x; this.home.y=y; }
  snapHome(){ this.x=this.home.x; this.y=this.home.y; this.vx=0; this.vy=0; }
  /* 목표 지점으로 향하는 "원하는 속도"를 만들고, 현재 속도를 거기에 서서히 붙인다(가속도).
     dt 기반이라 프레임률이 달라도 같은 속도로 움직인다. */
  steer(tx, ty, dt, maxSpeed, arrive){
    const dx=(tx-this.x)*PITCH_AR, dy=ty-this.y;      // 화면 비율 보정(등방 좌표)
    const d=HYP(dx,dy);
    let wantX=0, wantY=0;
    if(d>1e-6){
      // 고정 지점으로 갈 때는 가까워지면 감속해 오버슈트를 막지만(arrive=true),
      // 드리블러처럼 계속 도망가는 표적을 쫓을 때 감속하면 영영 따라잡지 못하므로 전속력을 유지한다.
      const speed = (arrive===false) ? maxSpeed : maxSpeed*Math.min(1, d/0.05);
      wantX=(dx/d)*speed/PITCH_AR; wantY=(dy/d)*speed;
    }
    const k=1-Math.exp(-dt/ACCEL_TAU);
    this.vx+=(wantX-this.vx)*k;
    this.vy+=(wantY-this.vy)*k;
  }
  push(px, py){ this.vx+=px; this.vy+=py; }              // 분리(겹침 방지) 등 외부 힘
  integrate(dt){
    this.x=clamp01(this.x+this.vx*dt);
    this.y=clamp01(this.y+this.vy*dt);
  }
  /* 스크립트가 좌표를 직접 지정한 프레임 — AI 위치를 거기에 동기화하고 속도를 죽여,
     지정이 풀린 뒤에 엉뚱한 방향으로 튀어나가지 않게 한다. */
  forceTo(x,y){ this.x=x; this.y=y; this.vx=0; this.vy=0; }
  distTo(o){ return HYP((o.x-this.x)*PITCH_AR, o.y-this.y); }
}
/* 등방 좌표 기준 거리 (화면에서 보이는 실제 거리) */
function isoDist(a,b){ return HYP((a.x-b.x)*PITCH_AR, a.y-b.y); }
/* 매 프레임 호출 — 모든 선수의 상태를 판단하고 목표 지점으로 이동시킨다.
   agents: PlayerAgent 배열, ctx: {ball, atkSide, carrierId, overrides, onTackle} */
function updatePlayerPositions(agents, ctx, dt){
  const ball=ctx.ball || {x:0.5,y:0.5};
  const atk=ctx.atkSide==="a" ? "a" : "h";
  const def=atk==="h" ? "a" : "h";
  const dir=atk==="h" ? 1 : -1;
  const goal={x:GOAL_X[atk], y:0.5};      // 공격팀이 노리는 골문
  const ownGoal={x:GOAL_X[def], y:0.5};   // 수비팀이 지켜야 할 골문(= 공격 방향 끝)
  const now=ctx.now||0;

  const atkers=agents.filter(a=>a.side===atk && a.pos!=="GK");
  const defs  =agents.filter(a=>a.side===def && a.pos!=="GK");

  // ── 볼 캐리어(드리블러) 결정: 공에 가장 가까운 공격 측 선수, 단 충분히 가까울 때만
  let carrier=null;
  if(ctx.carrierId!=null) carrier=agents.find(a=>a.id===ctx.carrierId) || null;
  if(!carrier){
    let best=null, bd=1e9;
    for(const a of atkers){ const d=a.distTo(ball); if(d<bd){ bd=d; best=a; } }
    if(best && bd<0.07) carrier=best;
  }

  // ── 공격 측 상태 배정: 캐리어=DRIBBLING, 앞선 2명=ATTACK_SUPPORT, 나머지=ATTACK_HOLD
  const others=atkers.filter(a=>a!==carrier);
  others.sort((p,q)=> dir>0 ? q.home.x-p.home.x : p.home.x-q.home.x);
  const supports=others.slice(0,2);
  for(const a of atkers){
    a.state = a===carrier ? PLAYER_STATE.DRIBBLING
            : supports.includes(a) ? PLAYER_STATE.ATTACK_SUPPORT
            : PLAYER_STATE.ATTACK_HOLD;
    if(a.state!==PLAYER_STATE.DRIBBLING) a._anchorY=undefined; // 드리블이 끝나면 기준선 해제
  }

  // ── 수비 측 상태 배정
  const target = carrier || {x:ball.x, y:ball.y};
  // 추격: 볼(또는 드리블러)에 가장 가까운 수비수
  const byDist=[...defs].sort((p,q)=> isoDist(p,target)-isoDist(q,target));
  const chaser=byDist[0]||null;
  // 차단: 공과 골문 사이에 있는 수비수 중 골문에 가장 가까운 쪽이 길목을 막는다
  const blockCand=byDist.slice(1).filter(a=> dir>0 ? a.home.x>target.x : a.home.x<target.x);
  const blocker=(blockCand[0]||byDist[1])||null;
  // 마킹: 남은 수비수 중 침투하는 지원 공격수와 가장 가까운 사람이 붙는다
  const rest=defs.filter(a=>a!==chaser && a!==blocker);
  const markers=[];
  for(const s of supports){
    let best=null, bd=1e9;
    for(const a of rest){ if(markers.includes(a)) continue; const d=isoDist(a,s); if(d<bd){ bd=d; best=a; } }
    if(best){ best._mark=s; markers.push(best); }
  }
  for(const a of defs){
    a.state = a===chaser ? PLAYER_STATE.DEFEND_CHASE
            : a===blocker ? PLAYER_STATE.DEFEND_BLOCK
            : markers.includes(a) ? PLAYER_STATE.DEFEND_MARK
            : PLAYER_STATE.DEFEND_LINE;
  }
  for(const a of agents) if(a.pos==="GK") a.state=PLAYER_STATE.GOALKEEPER;

  // ── 상태별 목표 지점 계산 후 이동
  for(const a of agents){
    let tx=a.home.x, ty=a.home.y, spd=SPD.JOG, arrive=true;
    switch(a.state){
      case PLAYER_STATE.DRIBBLING: {
        // 골대 방향으로 전진하되 위아래로 와리가리(지그재그) — 드리블이라 속도 페널티.
        // 좌우 목표는 "드리블을 시작한 y"를 기준선으로 삼는다. 현재 y에 진폭을 더하면 선수가 목표를
        // 쫓아 움직이는 만큼 기준선도 같이 밀려나 흔들림이 상쇄돼 거의 직선으로 가버린다.
        if(a._anchorY===undefined) a._anchorY=a.y;
        // 주기(9.0rad/s ≈ 0.7초)는 실제 드리블 구간(약 0.9초)보다 짧아야 한 장면 안에서 흔드는 게 보인다.
        // 좌우 이동폭 자체는 드리블 속도에 의해 물리적으로 제한되므로(1초에 겨우 몇 m) 과장되지 않는다.
        const zig=Math.sin(now*9.0 + a.seed)*0.085;
        tx=a.x + dir*0.07;   // 전방 리드를 진폭과 비슷하게 잡아야 방향 벡터에 좌우 성분이 실린다
        ty=clamp01(a._anchorY + zig);
        spd=SPD.DRIBBLE;
        break;
      }
      case PLAYER_STATE.ATTACK_SUPPORT: {
        // 드리블러보다 조금 앞선 공간으로 침투하되, 너무 겹치지 않게 좌우로 벌린다
        const wide = a.home.y<0.5 ? -0.11 : 0.11;
        tx=clamp01((carrier?carrier.x:ball.x) + dir*0.13);
        ty=clamp01(0.5 + wide + (a.home.y-0.5)*0.35);
        spd=SPD.RUN;
        break;
      }
      case PLAYER_STATE.ATTACK_HOLD: {
        tx=clamp01(a.home.x + dir*0.07);
        ty=clamp01(a.home.y + (ball.y-a.home.y)*0.16);
        spd=SPD.JOG;
        break;
      }
      case PLAYER_STATE.DEFEND_CHASE: {
        // 드리블러의 현재 좌표를 실시간 타깃으로 최대 속도 추격
        tx=target.x; ty=target.y; spd=SPD.SPRINT; arrive=false;
        break;
      }
      case PLAYER_STATE.DEFEND_BLOCK: {
        // 드리블러 → 골문 직선 위에서 앞을 가로막는 지점을 선점
        const gx=(goal.x-target.x)*PITCH_AR, gy=goal.y-target.y;
        const gl=HYP(gx,gy)||1;
        const lead=0.13;
        tx=clamp01(target.x + (gx/gl)*lead/PITCH_AR);
        ty=clamp01(target.y + (gy/gl)*lead);
        spd=SPD.SPRINT; arrive=false;
        break;
      }
      case PLAYER_STATE.DEFEND_MARK: {
        const m=a._mark;
        if(m){ // 마크 대상과 자기 골문 사이에 선다
          tx=clamp01(m.x + (ownGoal.x-m.x)*0.16);
          ty=clamp01(m.y + (ownGoal.y-m.y)*0.10);
        }
        spd=SPD.RUN;
        break;
      }
      case PLAYER_STATE.DEFEND_LINE: {
        tx=clamp01(a.home.x + dir*0.06);                  // 자기 골문 쪽으로 라인을 내린다
        ty=clamp01(a.home.y + (ball.y-a.home.y)*0.20);    // 볼사이드로 수렴
        spd=SPD.JOG;
        break;
      }
      case PLAYER_STATE.GOALKEEPER: {
        const g = a.side===atk ? ownGoal : goal;          // 자기 팀이 지키는 골문
        tx=clamp01(lerp(a.home.x, g.x, 0.12));
        ty=clamp01(lerp(0.5, ball.y, 0.45));
        spd=SPD.GK;
        break;
      }
    }
    a.steer(tx, ty, dt, spd, arrive);
  }

  // ── 분리(겹침 방지): 너무 붙은 두 선수는 서로 밀어낸다.
  //    단 "드리블러 ↔ 그를 막으러 온 수비수"는 예외 — 실제 축구에서 수비수는 어깨를 맞대고 붙는다.
  //    (여기서 밀어내면 분리 거리가 태클 거리보다 커서 영영 태클 시도가 성립하지 않는다)
  const isDuel=(a,b)=>
    (a.state===PLAYER_STATE.DRIBBLING && (b.state===PLAYER_STATE.DEFEND_CHASE||b.state===PLAYER_STATE.DEFEND_BLOCK)) ||
    (b.state===PLAYER_STATE.DRIBBLING && (a.state===PLAYER_STATE.DEFEND_CHASE||a.state===PLAYER_STATE.DEFEND_BLOCK));
  for(let i=0;i<agents.length;i++){
    for(let j=i+1;j<agents.length;j++){
      const a=agents[i], b=agents[j];
      if(isDuel(a,b)) continue;
      const dx=(b.x-a.x)*PITCH_AR, dy=b.y-a.y;
      const d=HYP(dx,dy);
      if(d>1e-6 && d<SEPARATION){
        const f=(SEPARATION-d)/SEPARATION*0.045;
        const ux=dx/d, uy=dy/d;
        a.push(-ux*f/PITCH_AR, -uy*f);
        b.push( ux*f/PITCH_AR,  uy*f);
      }
    }
  }
  for(const a of agents) a.integrate(dt);

  // ── 태클 시도 트리거: 수비수가 드리블러에게 TACKLE_DIST 이내로 접근하면 이벤트 발생
  if(carrier && ctx.onTackle){
    for(const a of defs){
      if(a.state!==PLAYER_STATE.DEFEND_CHASE && a.state!==PLAYER_STATE.DEFEND_BLOCK) continue;
      if(isoDist(a, carrier)<=TACKLE_DIST) ctx.onTackle(a, carrier);
    }
  }
  return carrier;
}
/* 에이전트 집합을 관리하고 매 프레임 갱신을 돌리는 컨트롤러 */
class PitchAI{
  constructor(){ this.agents=new Map(); this.lastNow=null; this.idle=true; this.tackle=null; }
  /* 현재 라인업으로 에이전트를 맞춘다(교체·퇴장 반영). 기본 자리(home)는 항상 최신 포메이션을 따른다. */
  sync(form){
    const seen=new Set();
    for(const d of [...form.h, ...form.a]){
      seen.add(d.id);
      let a=this.agents.get(d.id);
      if(!a){ a=new PlayerAgent(d); this.agents.set(d.id, a); }
      a.setHome(d.x, d.y); a.pos=d.pos; a.side=d.side; a.name=d.name;
    }
    for(const id of [...this.agents.keys()]) if(!seen.has(id)) this.agents.delete(id);
  }
  reset(){ for(const a of this.agents.values()) a.snapHome(); this.lastNow=null; this.tackle=null; }
  list(){ return [...this.agents.values()]; }
  posOf(id){ const a=this.agents.get(id); return a ? {x:a.x, y:a.y} : null; }
  stateOf(id){ const a=this.agents.get(id); return a ? a.state : null; }
  update(now, ctx){
    const dt = (this.lastNow==null) ? 1/60 : Math.min(0.05, Math.max(0, (now-this.lastNow)/1000));
    this.lastNow=now;
    // 스크립트가 좌표를 지정한 선수는 그 값을 정답으로 삼고 AI 상태를 동기화한다
    const ov=ctx.overrides||{};
    for(const a of this.agents.values()){
      const o=ov[a.id];
      if(o) a.forceTo(o.x, o.y);
    }
    const self=this;
    updatePlayerPositions(this.list(), Object.assign({}, ctx, {
      now: now/1000,
      onTackle(tackler, carrier){ self.tackle={id:tackler.id, at:now, target:carrier.id}; }
    }), dt);
    // 스크립트 지정 선수는 AI가 움직인 뒤에도 다시 지정 좌표로 되돌린다(주역의 경로는 불변)
    for(const a of this.agents.values()){
      const o=ov[a.id];
      if(o) a.forceTo(o.x, o.y);
    }
  }
}
const PITCH_AI=new PitchAI();
