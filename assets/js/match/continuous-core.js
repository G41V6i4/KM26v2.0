"use strict";
/* =====================================================
   90분 연속 매치 시뮬레이션 — 1단계: 볼 · 패스 코어

   기존 확률 엔진(procMinute)과 병행해서 돌아가는 독립 모듈이다. 아직 경기 결과에는 관여하지 않고,
   "공이 어디 있고 누가 갖고 있으며 어디로 연결되는가"를 초 단위로 시뮬레이션한다.
   여기서 나온 통계(패스 수·정확도·점유율·전진/백패스 비율 등)가 실제 축구 범위에 들어오는지
   먼저 검증한 뒤, 다음 단계에서 이 위치 상태로부터 하이라이트 이벤트를 생성한다.

   [핵심 구조]
     tacticalAnchorXY() — 전술(width/line/mentality)이 반영된 선수별 기본 자리
     pressureOn()       — 특정 지점이 상대에게 얼마나 압박받고 있는가 (0~1+)
     laneBlocked()      — 패스 경로에 상대가 걸쳐 있는가 (0~1)
     evaluatePassOptions() — 동료 전원을 점수화해 최선의 패스를 고른다
     MatchSim           — 위를 묶어 90분을 dt 간격으로 굴리는 루프
===================================================== */
const SIM_DT=0.2;          // 시뮬레이션 한 스텝(초)
/* 🎚️ 속도 평활 ─────────────────────────────────────────────────────────
   a.vx/vy 는 <b>직전 한 틱(0.2초)의 변위</b>다. 그 값으로 「이 선수가 어디로 가는가」를
   물으면 안 된다 — 축구 선수는 제자리에서도 잔발질을 하고, 엔진에서도 매 틱
   위치선정 오차·역할 전환·겹침 밀어내기·오프사이드 클램프로 목표가 흔들린다.
   그 한 틱을 1초로 외삽하면 <b>가만히 선 선수가 5m 옆으로 달려가는 중</b>으로 읽힌다.
   ⚠ 이 문제는 이미 코드에 흔적이 있었다 — 크로스 낙하 예측이 미래 위치를 ×0.60 으로
      눌러 쓰고, 침투 방향 단위벡터는 «안 움직이면 골 방향»이라는 대체값을 달고 있다.
      둘 다 「속도값을 못 믿겠다」는 임시 조치다.
   ─ 지수이동평균으로 「요즘 향하고 있는 방향」을 따로 들고 있는다(시간상수 약 1.3초).
   ⚠ 어디에 쓰고 어디에 안 쓰는지가 핵심이다:
        방향을 묻는 자리  → 평활값 (_vxS/_vyS) — 스루패스 도착점·리드 패스·크로스 예측 등
        지금 속력을 묻는 자리 → 순간값 (vx/vy) 그대로 — 퍼스트터치 난이도·슛 밸런스·몸싸움.
      평활값은 방향에 강하고 <b>급출발에 1초쯤 늦다</b>. 급출발은 burstUntil 이 이미 맡는다. */
const V_SMOOTH=0.15;       // 클수록 순간값에 가깝다 — 0.15 면 시간상수 약 1.3초
const vSx=(p)=>((p&&p._vxS)||0);
const vSy=(p)=>((p&&p._vyS)||0);
const SIM_SECONDS=5400;    // 정규 시간 90분 — 데드볼·세리머니까지 포함한 실제 경기 시간
/* 전광판 시계 = 시뮬 시간 × 1. 90분 경기는 90분치 플레이다.
   제보 원문 — "이거 단순해. 우리가 지금 90분 경기가 아니라 45분 경기를 하고 있잖아?
              그거 다시 90분으로 맞추면 슈팅수들 2배로 뛸걸?"
   ⚠ 예전에 2배 축약을 넣은 이유는 「1:1 시절 슈팅이 팀당 25+ 로 과다해서」였다.
      그 뒤 수비 AI 전수 감사(셰이프 매니저·압박 트리거 셋)로 상대 슛이 30% 줄었고,
      축약까지 겹쳐 경기당 총 슛이 10.6 개까지 내려왔다 — 실축 K리그1 의 24 개 대비 44% 다.
      축약은 이제 그 목적을 잃었다. 90분을 90분으로 되돌린다.
   ⚠ 되돌리면 슛·골뿐 아니라 파울·코너·패스 등 <b>누적 카운트가 전부</b> 늘어난다.
      파울은 축약판에서 이미 실축 수준(21)이었으므로 여기서 다시 맞춰야 한다.
   ⚠ 라이브 관전 시간도 2배가 된다 — 90분 경기를 실제로 90분치 시뮬로 본다.
   ⚠ report() 의 패스 표시 ×2 는 축약을 메우려던 보정이라 함께 걷어낸다. */
const MATCH_CLOCK_SCALE=1;
/* 판단 간격 = 공을 쥐고 있는 시간의 배율. 태클·파울의 틱당 확률도 이 값으로 나눠 보정하므로
   올려도 경기당 반칙 수는 유지된다.
   ⚠ 3.20 으로 올린 이유 — 시계 배율을 1:1 로 되돌리면서 라이브 재생이 2배속이 됐다.
      그대로 두면 화면에서 소유 시간이 절반으로 짧아 보여 「점유하고 있다」는 체감이 사라진다. */
/* ⚠ 소유 시간과 패스 수는 정면으로 맞바뀐다 — 실측(같은 대진 2경기):
      TEMPO 2.20 → 팀당 패스 273회 · 슛 21회 · 골 4.0
      TEMPO 3.20 → 팀당 패스 212회 · 슛 17회 · 골 4.5   ← 현재(소유 체감 우선)
      TEMPO 4.50 → 팀당 패스 138회 · 슛 12회 · 골 1.5
   즉 「오래 쥐면서 패스도 많이」는 이 손잡이로는 불가능하다.
   패스를 늘리려면 소유를 잃지 않아야 한다 — 받을 자리를 만드는 쪽이 답이다. */
/* ⚠ 패스 770회/경기(실축 850) — 소유 시간이 조금 길다. 주석의 실측표에 따르면
   TEMPO 2.20 → 팀당 273패스 · 3.20 → 212패스 로 매우 민감하고, 낮출수록 슛도 는다.
   슛이 지금 실축(23)에 딱 맞아 있으므로 크게 건드리지 않고 3.05 만 시도한다. */
const TEMPO=3.05;
const PASS_SPEED=0.42;     // 패스 기본 속도(정규화 단위/초)
const CTRL_RADIUS=0.030;   // 이 반경 안에 들어오면 볼을 잡는다
/* ═══════════════════════════════════════════════════════════════
   🧩 볼 모델 — FM식 "축구 상황을 만들어내는 간소화된 물리"
   FIFA처럼 공 하나를 완전한 물리엔진으로 돌리지 않는다. 축구에서 의미 있는
   장면(경합·흘린 공·세컨볼·치달)을 만들어내는 데 필요한 만큼만 시뮬레이션한다.

                          BALL
                            │
                 ┌──────────┴──────────┐
                 ↓                     ↓
             공중 운동               지상 운동
          중력·낙하·바운스        속도·마찰·구름
              (stepBallPhysics)   (stepBallPhysics)
                 └──────────┬──────────┘
                            ↓
                        선수 접촉            ← giveTo() 진입 = "제어 범위에 들어옴"
                            ↓
                     resolveFirstTouch()     ← 난이도 × 실력
                 ┌──────────┴──────────┐
                 ↓                     ↓
             좋은 터치               나쁜 터치
                 ↓                     ↓
             CONTROLLED            DEFLECTION
                 ↓                     ↓
              DRIBBLE              LOOSE BALL  → 상대 경합

   ⚠ 가장 중요한 원칙:
     "공이 선수의 제어 범위에 들어왔다"(접촉)와
     "선수가 공을 완전히 통제했다"(소유)는 서로 다른 사건이다.
     giveTo() 는 접촉일 뿐이고, 소유가 될지 흘린 공이 될지는 퍼스트 터치가 정한다.
     그래서 이 엔진에는 "공이 도착했으니 소유권을 준다"는 코드가 존재하지 않는다.

   이 하나의 구조 위에 공간패스 → 움직이며 받기 → 퍼스트터치 → 방향 전환 →
   드리블 → 치달이 전부 같은 경로로 연결된다.
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   ⚽ 퍼스트 터치 — "공에 닿았다"와 "공을 소유했다"를 분리한다
   그동안은 공이 선수 반경에 들어오는 순간 발밑으로 순간이동하고 속도가 0이 됐다.
   이제는 닿는 순간 터치 판정을 하고, 그 결과에 따라
     · 공이 몸에서 얼마나 떨어지는가(거리)
     · 어느 쪽으로 튀는가(방향)
     · 얼마나 속도가 죽는가(잔여 속도)
     · 다음 행동까지 얼마나 걸리는가(컨트롤 시간)
   가 달라진다. 나쁜 터치는 공이 튀어 상대에게 먼저 닿을 수 있다.
   ⚠ 모든 값은 여기서 튜닝한다 — 엔진 곳곳에 흩어 두지 않는다.
═══════════════════════════════════════════════════════════════ */
const FT={
  // 터치 품질 구간 — [최소 이탈(iso), 최대 이탈, 잔여 속도 비율, 컨트롤 시간(초)]
  PERFECT:{d:[0.004,0.010], keep:0.06, ct:0.18},
  GOOD:   {d:[0.008,0.016], keep:0.12, ct:0.26},
  NORMAL: {d:[0.013,0.024], keep:0.20, ct:0.38},
  HEAVY:  {d:[0.023,0.045], keep:0.34, ct:0.58},
  BAD:    {d:[0.040,0.070], keep:0.48, ct:0.82},
  FAIL:   {d:[0.060,0.105], keep:0.62, ct:1.05},
  SPEED_HARD: 0.22,     // 이 속도(iso/s ≈ 15m/s)를 넘으면 확실히 어려워진다
                        // ⚠ 예전 0.55(37m/s)는 실제 패스보다 훨씬 빨라, 속도가 난이도에 전혀 반영되지 않았다
  HEIGHT_HARD: 0.020,   // 이 높이(iso ≈ 1.3m)를 넘으면 공중볼 컨트롤
  PRESS_R: 0.075,       // 이 거리 안의 상대가 압박으로 잡힌다
  LOOSE_AT: 0.028       // 이 거리(약 1.9m) 이상 튀면 공은 소유가 아니라 흐른 공이 된다
};
/* ═══════════════════════════════════════════════════════════════
   💥 볼–선수 접촉 (Ball-Player Contact)
   "제어 범위에 들어왔다"는 것은 충돌 이벤트일 뿐이다. 여기서 어느 부위에,
   어떤 상대 속도로, 어떤 각도로 맞았는지를 풀어 결과를 정한다.
     CLEAN_CONTROL · SOFT_TOUCH · FORWARD_TOUCH · SIDE_TOUCH
     HEAVY_TOUCH · DEFLECTION · BOUNCE · MISS_CONTROL
   ⚠ 부위별 반사 특성(감속·상승·산포)은 CONTACT_PROFILE 에서 튜닝한다.
═══════════════════════════════════════════════════════════════ */
const BODY_PART={ FOOT:"FOOT", LOWER_LEG:"LOWER_LEG", THIGH:"THIGH", CHEST:"CHEST", HEAD:"HEAD", BODY:"BODY" };
/* 부위별 반사 특성
     damp   : 상대 속도가 얼마나 죽는가 (낮을수록 잘 죽인다)
     lift   : 접촉 후 위로 뜨는 정도
     spread : 방향 산포(라디안) — 클수록 어디로 튈지 모른다
     ctrl   : 통제 난이도 보정 (+면 어렵다) */
const CONTACT_PROFILE={
  FOOT:      {damp:0.16, lift:0.00, spread:0.20, ctrl:0.00},
  LOWER_LEG: {damp:0.34, lift:0.05, spread:0.48, ctrl:0.16},
  THIGH:     {damp:0.28, lift:0.08, spread:0.36, ctrl:0.12},
  CHEST:     {damp:0.22, lift:0.03, spread:0.30, ctrl:0.10},
  HEAD:      {damp:0.55, lift:0.42, spread:0.34, ctrl:0.22},
  BODY:      {damp:0.42, lift:0.10, spread:0.62, ctrl:0.26}
};
/* 공이 선수 어느 높이·어느 방향에서 들어오는가 → 접촉 부위 */
function contactBodyPart(a, b){
  const hM=(b.z||0)*ISO_TO_M;                       // 공 높이(m)
  const tall=1 + ((a.body&&a.body.tall)||0)*0.10;   // 큰 선수는 같은 높이도 낮게 느낀다
  const h=hM/tall;
  if(h>1.45) return BODY_PART.HEAD;
  if(h>1.05) return BODY_PART.CHEST;
  if(h>0.62) return BODY_PART.THIGH;
  if(h>0.38) return BODY_PART.LOWER_LEG;
  /* 낮은 공 — 몸 옆·뒤에서 들어오면 발이 아니라 몸에 맞는다 */
  if(a.face!==undefined && (Math.abs(b.vx||0)+Math.abs(b.vy||0))>1e-6){
    const inc=Math.atan2(-(b.vy||0), -(b.vx||0)*PITCH_AR);   // 공이 날아오는 쪽
    let df=inc-a.face; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
    if(Math.abs(df)>2.70) return BODY_PART.BODY;             // 거의 정반대(등 뒤)에서 들어올 때만
  }
  return BODY_PART.FOOT;
}
/* 💥 접촉 해석 — 이 함수 하나가 "공이 어떻게 될지"를 정한다.
   퍼스트 터치(의도된 컨트롤)와 반사(의도치 않은 굴절)를 함께 다룬다. */
function resolveBallPlayerContact(a, b, opps){
  const part=contactBodyPart(a, b);
  const P=CONTACT_PROFILE[part]||CONTACT_PROFILE.FOOT;
  /* ── 상대 속도 — 선수가 공과 같은 방향으로 달리면 충돌이 부드럽다 ── */
  const bvx=(b.vx||0)*PITCH_AR, bvy=(b.vy||0);
  const pvx=(a.vx||0)*PITCH_AR/SIM_DT, pvy=(a.vy||0)/SIM_DT;   // 선수 속도(iso/s 환산)
  const rvx=bvx-pvx, rvy=bvy-pvy;
  const rel=HYP(rvx, rvy);
  /* ── 입사각 — 정면/측면/등 뒤 ── */
  let incRel=0;
  if(rel>1e-6 && a.face!==undefined){
    const inc=Math.atan2(-rvy, -rvx);
    let df=inc-a.face; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
    incRel=Math.abs(df);                       // 0=정면, π=등 뒤
  }
  /* ── 퍼스트 터치 판정 (기존 시스템 재사용, 상대 속도·부위 보정을 얹는다) ── */
  const ft=resolveFirstTouch(a, b, opps);
  const extra = P.ctrl + clamp(rel/FT.SPEED_HARD,0,1)*0.18 + clamp(incRel/Math.PI,0,1)*0.16;
  /* 부위·상대속도가 어려울수록 등급을 끌어내린다 */
  const ORDER=["PERFECT","GOOD","NORMAL","HEAVY","BAD","FAIL"];
  let qi=ORDER.indexOf(ft.q);
  qi += Math.round(clamp(extra,0,1.2)*2.4 - Math.random()*0.7);
  qi=clamp(qi, 0, ORDER.length-1);
  const q=ORDER[qi];
  /* ── 결과 분류 ── */
  let kind;
  if(part===BODY_PART.HEAD)                    kind = (qi<=1)?"SOFT_TOUCH":"BOUNCE";
  else if(part===BODY_PART.BODY && qi>=3)      kind = "DEFLECTION";
  else if(qi===0)                              kind = "CLEAN_CONTROL";
  else if(qi===1)                              kind = (incRel<0.9)?"FORWARD_TOUCH":"SOFT_TOUCH";
  else if(qi===2)                              kind = (incRel>1.4)?"SIDE_TOUCH":"FORWARD_TOUCH";
  else if(qi===3)                              kind = "HEAVY_TOUCH";
  else if(qi===4)                              kind = "DEFLECTION";
  else                                          kind = "MISS_CONTROL";
  /* ── 접촉 후 속도 — 반사 + 부위 감쇠 + 선수 속도 되더하기 ── */
  const controlled = (kind==="CLEAN_CONTROL"||kind==="SOFT_TOUCH"||kind==="FORWARD_TOUCH"||kind==="SIDE_TOUCH");
  let ang, spd, vz=0;
  if(controlled){
    /* 의도한 방향으로 놓는다 — 터치 방향은 퍼스트터치가 정한 값 */
    ang=ft.ang; spd=rel*P.damp*(0.55+ (kind==="SIDE_TOUCH"?0.25:0));
  } else {
    /* 굴절 — 상대 속도를 몸에 반사시킨다. 완전 탄성이 아니라 축구공답게 죽인다. */
    const back = a.face!==undefined ? a.face : Math.atan2(rvy, rvx);
    const inAng=Math.atan2(rvy, rvx);
    /* 접촉면 법선을 "선수가 바라보는 방향"으로 두고 반사 */
    let refl = 2*back - inAng + Math.PI;
    refl += (Math.random()-0.5)*P.spread*(1+(qi-2)*0.25);
    ang=refl; spd=rel*(0.34+P.damp);
  }
  spd += HYP(pvx,pvy)*0.28;               // 선수가 달리던 기세가 얹힌다
  if(P.lift>0) vz = rel*P.lift*(controlled?0.35:1);
  return {part, kind, q, controlled, ang, spd, vz, rel, incRel, ft, diff:ft.diff, skill:ft.skill};
}
/* 터치 난이도(0=아주 쉬움 ~ 1.4=아주 어려움) */
function ftDifficulty(a, b, opps){
  const sp=HYP((b.vx||0)*PITCH_AR, b.vy||0);
  let d = clamp(sp/FT.SPEED_HARD, 0, 1)*0.42;               // 공 속도
  d += clamp((b.z||0)/FT.HEIGHT_HARD, 0, 1)*0.21;           // 공 높이
  /* 몸 방향 — 정면으로 오는 공은 쉽고, 뒤에서 오는 공은 어렵다 */
  if(sp>1e-5){
    const bx=-(b.vx||0)*PITCH_AR/sp, by=-(b.vy||0)/sp;      // 공이 날아오는 방향(선수 기준)
    const fx=Math.cos(a.face||0), fy=Math.sin(a.face||0);
    d += (1-clamp((bx*fx+by*fy)*0.5+0.5, 0, 1))*0.18;
  }
  /* 선수 자신의 움직임 — 전력질주 중이거나 뒤로 뛰며 받으면 어렵다 */
  const ps=HYP((a.vx||0)*PITCH_AR, a.vy||0);
  d += clamp(ps/0.28, 0, 1)*0.13;
  /* 압박 — 가까울수록 필요한 정밀도가 올라간다 */
  let nd=9, mk=0.6;
  for(const o of (opps||[])){ if(o.slot==="GK") continue;
    const dd=HYP((o.x-a.x)*PITCH_AR, o.y-a.y);
    if(dd<nd){ nd=dd; mk=(o.markSkill||0.6)*0.5+(o.tackleSkill||0.6)*0.5; } }
  if(nd<FT.PRESS_R) d += (1-nd/FT.PRESS_R)*(0.20+mk*0.16);
  /* 🌀 회전 — 감겨 들어오는 공은 발에 얹기 어렵다.
     사이드스핀은 튀는 방향을 어긋나게 하고, 백스핀은 발밑에서 솟는다. */
  if(b.spin) d += (Math.abs(b.spin.side)*0.09 + Math.max(0, b.spin.back)*0.06);
  /* 🤾 스로인 — 느리고 회전 없는, 궤적이 뻔한 공이다. 발로 찬 공중볼과 같은 난이도를
     매기니 자기 진영 스로인이 툭하면 흘렀다(제보 — "받는 수비가 못 받고 흘려서 상대
     공격수가 인터셉트"). 프로가 6~9m 스로인을 못 받는 그림은 게임으로도 이상하다. */
  if(b._fromThrow) d*=0.50;
  return clamp(d, 0, 1.4);
}
/* 터치 실력 — 쉬운 공은 퍼스트터치, 어려운 공일수록 기술·침착성이 함께 들어간다 */
function ftSkill(a, diff){
  const A=(a.p&&a.p.attr)||{};
  /* 하한 — 프로 선수는 능력치가 낮아도 기본기는 있다. 격차는 어려운 공에서 벌어져야지,
     쉬운 공을 못 받는 데서 벌어지면 프로 경기로 보이지 않는다. */
  const v=(k,fb)=>clamp((attr20(A[k]!=null?A[k]:60))/20, 0.38, 1);
  const fir=v("fir"), tec=v("tec"), cmp=v("cmp");
  const w=clamp(diff/1.2, 0, 1);
  return clamp(fir*(0.72-w*0.22) + tec*(0.16+w*0.14) + cmp*(0.12+w*0.08), 0.42, 1);
}
/* 터치 결과 — 품질 등급과 물리값을 함께 돌려준다 */
function resolveFirstTouch(a, b, opps){
  const diff=ftDifficulty(a, b, opps);
  const skill=ftSkill(a, diff);
  /* 점수가 높을수록 좋은 터치. 같은 선수라도 매번 같지는 않다. */
  /* ⚠ 실측 결과 접촉의 94%가 곧바로 소유로 이어졌다 — 접촉과 통제를 나눈 의미가 옅어진다.
     어려운 공(빠른 공·공중볼·압박)에서는 실제로 자주 흘린다. 난이도 비중을 키운다. */
  /* 쉬운 공은 누구나 받는다 — 격차는 "어려운 공"에서 벌어져야 한다.
     (실측 — 하급 선수가 느린 정면 패스도 11%만 통제해 프로 경기로 보이지 않았다) */
  /* 기준선을 올려 「쉬운 공은 누구나 받는다」를 확실히 한다.
     기울기(skill 계수)는 그대로라 잘하는 선수의 우위는 유지된다. */
  /* 🌧️ 젖은 공은 발에 안 붙는다 — 비 오는 날 터치가 길어지는 그 장면 (요청) */
  const score = skill*1.28 - diff*1.02 + 0.26 - (WX_NOW.wet||0)*0.13 + (Math.random()-0.5)*0.44;
  const q = score>0.62 ? "PERFECT" : score>0.44 ? "GOOD" : score>0.24 ? "NORMAL"
          : score>0.06 ? "HEAVY" : score>-0.14 ? "BAD" : "FAIL";
  const P=FT[q];
  const dist = P.d[0] + Math.random()*(P.d[1]-P.d[0]);
  /* 방향 — 좋은 터치는 진행 방향 앞으로, 나쁜 터치는 어디로 튈지 모른다.
     압박이 있으면 좋은 선수는 상대 반대쪽으로 뺀다. */
  let ang;
  const good = (q==="PERFECT"||q==="GOOD"||q==="NORMAL");
  if(good){
    ang = a.face||0;
    let nd=9, no=null;
    for(const o of (opps||[])){ if(o.slot==="GK") continue;
      const dd=HYP((o.x-a.x)*PITCH_AR, o.y-a.y);
      if(dd<nd){ nd=dd; no=o; } }
    if(no && nd<FT.PRESS_R) ang = Math.atan2(a.y-no.y, (a.x-no.x)*PITCH_AR);   // 상대 반대쪽으로
    ang += (Math.random()-0.5)*(q==="PERFECT"?0.35:q==="GOOD"?0.6:1.0);
  } else {
    ang = Math.random()*Math.PI*2;                                             // 튀는 방향은 운
  }
  const sp=HYP((b.vx||0)*PITCH_AR, b.vy||0);
  return {q, dist, ang, keep:P.keep, ct:P.ct, diff, skill, resid:sp*P.keep};
}

const TACKLE_RANGE=0.028;  // 서서 하는 태클 사거리
const SLIDE_RANGE=0.050;   // 슬라이딩 태클 사거리 (더 멀리 닿지만 실패하면 벗겨진다)
const SLIDE_COMMIT=1.3;    // 슬라이딩 후 다시 일어나기까지 걸리는 시간(초)
const AERIAL_MIN=0.34;     // 이 거리 이상 패스는 공중으로 뜬다
/* 1분당 기본 체력 소모. 시뮬에서 실제로 측정한 분당 이동량(중앙값 약 1.30 정규화 단위 ≒ 90m,
   90분 8.1km)을 기준으로 잡았다. 평범한 주전이 풀타임을 뛰면 100 → 65 안팎으로 떨어진다. */
/* 🔋 ⚠ 제보 — 「체력이 아직도 쫙쫙 닳는다」.
   90분 분당 소모를 뜯어 보면(중립 전술 기준): 기본 0.28 + 흔들림 평균 0.07 = 0.35/분
   → 90분에 31.5 소모, 종료 시 약 68. 여기에 압박·템포(condFactor)와 이동량 배수가 곱해져
   높은 압박 + 빠른 템포면 0.52/분까지 올라 종료 시 45~55 였다.
   ⚠ 게다가 최근에 흐른 공 경주(looseRace)·길목 읽기(startLaneCut)·수비 가담 인원이
      들어오면서 <b>실제로 더 뛰게</b> 됐다 — 같은 계수로는 예전보다 더 깎인다.
   ─ 기본 소모와 흔들림을 함께 내리고(0.28→0.235 · 0.14→0.10), 전술 배수의 폭도 좁힌다.
     중립 0.35 → 0.285/분(종료 약 74) · 최대 압박·템포 0.52 → 0.40/분(종료 약 57). */
const STAM_PER_MIN=0.235;
const GK_STAM_K=0.45;      // 🧤 골키퍼의 체력 소모 — 필드 플레이어의 45%
const STAM_REF_RUN=1.30;   // "평균적인 1분 이동량" 기준값
const SP_ARRIVE=0.006;     // 세트피스 배치 자리 도착 판정 반경(약 0.4m) — 이 안에 들면 발을 멈춘다
const AERIAL_RANGE=0.055;  // 공중볼 경합 반경
const SEC_R=0.30;          // 세컨볼 — 낙하 지점에서 이 안(약 21m)이면 선점하러 간다
/* ══════════════════════════════════════════════════════════════════════════
   🧭 이동 파이프라인 계약 ─ 한 선수의 목표 좌표(tx,ty)는 아래 순서로 정해진다.
   ⚠ 이 표가 이 파일에서 가장 중요한 주석일 수 있다. 순서가 곧 우선순위이고,
      <b>뒤에 오는 단계가 앞 단계를 조용히 지운다.</b> 오늘까지 이 표가 없어서
      새 층을 하나 깔 때마다 밑을 지나가던 기능이 소리 없이 꺼졌다 — 실제로 세 번 났다:
        · 셰이프 결속을 트랩 <b>뒤</b>에 두었더니 트랩 3.7m 중 0.19m 만 남았다
        · 트랩으로 밀린 위치가 셰이프의 「현재 라인 평균」에 되먹여져 트랩이 안 풀렸다
        · PRESS 분기에 phase 가드가 없어 공격 국면 선수가 공으로 달려갔다
      셋 다 에러도 안 나고 역할 통계도 멀쩡했다. 순서 문제는 <b>조용히</b> 난다.

   순서와 권한 ─────────────────────────────────────────────────────────────
    1 앵커        tacticalAnchorXY + blockShift + dirBias      기준점을 놓는다
    2 역할 목표   defTargetXY / findOpenSpot                    「무엇을 하려는가」
    3 (비어 있음)  ← 「위험 당김」이 있던 자리. 실측 손해로 걷어냈다(2026-09-07)
    4 셰이프 결속 _shX/_shY × shapeBond   ← DEF 전용             깊이만 세게, 좌우는 55%
    5 오프사이드 트랩 trapPush            ← DEF 전용             <b>4 보다 뒤여야 한다</b>

    6 위치 오차   posErr                  ← 대기 역할만          능력치 오차
    7 온사이드    oppLineX 클램프         ← ATT 전용             규칙상 여기가 마지막이어야 함
    8 흐른 공     _lbGo                                          <b>전부 덮어쓴다</b>(의도됨)
    9 포지션 규율 leash / DISCIPLINE      ← 되당김                _chase·압박자는 면제
   10 동료 간격   SPACING_PUSH                                   미세 조정
  10b 뒷선 바닥   FB_BEHIND_MAX           ← DEF · 풀백/윙백만     <b>9 보다 뒤여야 한다</b>
  10c 잔여수비 천장 REST_CB_MAX/MARGIN     ← ATT · 센터백만       <b>9 보다 뒤여야 한다</b> (규율이 앵커로 되당기면 앵커가 이미 너무 앞이다)
  10d 풀백 전진 천장 FB_ADV_x · fbRisk     ← ATT · 풀백/윙백만    10c 와 같은 자리 · OVERLAP/UNDERLAP 중이면 윙어 조건 해제
  10e 측면 미드필더 볼 뒤 WM_BEHIND       ← DEF · wmDuty≥0.5      압박/저지 제외 · 4셰이프·9규율보다 뒤여야 남는다
   11 스무딩      instant 아니면 지연 추종                        떨림 제거

   규칙 ────────────────────────────────────────────────────────────────────
    · 새 단계를 넣을 때는 <b>이 표에 줄을 추가하고</b> 앞뒤 단계와의 관계를 적는다.
    · 「전부 덮어쓰는」 단계(8)는 늘리지 않는다. 지금 하나로 충분하다.
    · 되당기는 단계(9)는 앞 단계가 의도한 이탈을 지울 수 있다 — 면제 목록을 함께 본다.
    · 어떤 단계가 앞 단계를 지우는지 의심되면 MV_LOG 를 켜서 단계별 이동량을 본다.
   ══════════════════════════════════════════════════════════════════════════ */
let MV_LOG=null;
let FOUL_LOG=null;         // 파울 출처 계측 (defprobe 에서만 켠다)                 // {단계:[합계m, 표본]} — 계측할 때만 켠다
function mvMark(a, stage, tx, ty){
  if(!MV_LOG) return;
  const px=(a._mvLx!==undefined)?a._mvLx:tx, py=(a._mvLy!==undefined)?a._mvLy:ty;
  const d=HYP((tx-px)*PITCH_AR, ty-py)*ISO_TO_M;
  const e=MV_LOG[stage]||(MV_LOG[stage]=[0,0]);
  e[0]+=d; e[1]++;
  a._mvLx=tx; a._mvLy=ty;
}
const THROW_PRESS_R=0.18;  // 🤾 스로인 압박 — 리시버에서 이 안(약 12.6m)이면 붙으러 간다
const PRESS_GO=0.42;       // 이 점수를 넘어야 실제로 압박을 나간다 (아니면 저지)
/* 🛤️ 압박 회랑 (외부 제안 「Press Corridor + Home Anchor」 · 요청).
   실측(seed 2): 압박자의 DEF 앵커 이탈 중앙값 16m·p90 29m (다른 역할 7~12m). 팀 전체 이탈 평균은 압박 중·비압박 중
   모두 11.7m 로 같았다 — 나머지가 따라 무너지진 않지만 압박자 본인은 회랑 없이 어디까지나 쫓아갔다.
   ─ 밴드별 회랑 반경: 압박 지점(캐리어)이 내 홈 앵커에서 이보다 멀면 pressScore 감점 → 문턱을 못 넘으면 저지(JOCKEY).
     저지는 「압박하지 않는 선수」가 아니라 「대형을 지키며 제한하는 선수」다. 압박 슬라이더가 회랑을 ±25% 늘린다.
     PRESS 중에도 회랑의 1.25배를 넘으면 목적지를 회랑 가장자리에 묶는다 — 거기서부터는 저지 간격으로 선다. */
const PRESS_CORR={FW:0.26, AM:0.22, MF:0.20, DM:0.17, WB:0.15, DF:0.13, SW:0.12};   // 등방 단위 (×70 ≈ m) · 1차 0.33/0.28/0.24 는 p90 29 → 27m 뿐이라 조임
const PRESS_CORR_PEN=1.1;  // 회랑 밖 1배 초과당 감점
/* 🐺 볼 위닝 미드필더 (제보 — 미드필더 역할 감사): press 0.85(기본 DM 의 2.4배)인데 수비 관여율
   14.8 vs 15.0% 로 차이가 없었다. pressScore 의 fPress×0.34 는 회랑 감점에 눌렸다 — 회랑 자체가
   press 성향으로 늘고 줄어야 한다 (BWM +25% · 앵커 -7%) */
function pressCorridor(a, T){ const c=PRESS_CORR[SLOT_BAND[a.slot]||"MF"]||0.24; return c*(1+((T&&T.press||1)-1)*0.25)*(1+clamp(FX(a,"press"),-0.5,1)*0.30); }
const BOX_X=0.83, BOX_Y0=0.21, BOX_Y1=0.79;

/* ⚡ 카운터프레스 (공백 01) ──────────────────────────────────────────────
   제보 원문(감사 항목) — "카운터프레스가 없다. 「방금 공을 뺏겼다」는 상태 자체가
   엔진에 존재하지 않는다. gegen 은 전술 프리셋 이름일 뿐이다."
   원인 — possSide 가 뒤집히는 순간을 아무도 기억하지 않았다. 다음 틱이 되면
   그냥 '수비 국면'이 되고, 선수들은 앵커로 물러난다. 뺏긴 직후 3초와
   10분 뒤 3초가 엔진에게는 완전히 같은 상황이었다.
   수정 — 소유가 넘어간 순간에 짧은 창을 연다. 그 창 안에서는
   ① 압박 정원이 늘고 ② 나갈 값어치의 문턱이 내려간다.
   창은 시간이 갈수록 옅어져(_cpw) 자연스럽게 정상 수비로 돌아간다.
   조건 — 우리 진영 깊은 곳(CP_ZONE 아래)에서 뺏긴 건 카운터프레스가 아니라
   그냥 수비다. 세트피스·슛·키퍼 캐치 뒤에도 열지 않는다. */
/* ⚠ 시계 1:1 복귀에 맞춰 다시 잡았다. 축약(×2) 시절에는 2.2초로 두면 전광판에서 4.4초로
   보여 「5초 룰」에 맞았는데, 1:1 이 되면서 그대로 두면 실제로 2.2초짜리 창이 된다.
   게겐프레싱의 5초 룰에 맞춰 3.2 ~ 5.0 초로 올린다. */
const CP_WIN=3.2;          // 창의 기본 길이(초)
const CP_WIN_ADD=1.8;      // 압박 성향이 최대면 5.0초 — 실축의 「5초 룰」
const CP_ZONE=0.42;        // 뺏긴 지점이 우리 골문 기준 이 앞이어야 한다
const CP_GO=0.34;          // 창 안에서 PRESS_GO 를 이 비율만큼 낮춘다
/* 강도 — 압박 지시가 주축이고 라인이 곱해진다. 라인을 내려놓고 카운터프레스만
   하겠다는 건 성립하지 않는다(뒤가 비어 되치기를 맞는다). */
function cpInt(T){ return clamp((T.press-0.55)/1.35,0,1)*(0.55+clamp(T.line/2,0,1)*0.45); }

/* ⏮️ 백패스 트리거 (공백 02) ────────────────────────────────────────────
   제보 원문(감사 항목) — "압박 트리거가 없다. 백패스·터치 미스·터치라인에 몰림·
   등지고 받음은 실제 축구의 「지금 나가라」 신호다. carrierBack 과 ballD 가 개인
   점수로 일부 대신하지만, 여러 명이 동시에 스위치를 켜는 팀 단위 발동이 없다."
   원인 — 엔진은 백패스를 <b>공격하는 쪽에서만</b> 알고 있었다(PASS_TYPE.BACK 은
   패스 선택과 볼 속도 보정에만 쓰인다). 수비하는 쪽은 그 정보를 아예 받지 못했다.
   개인 점수만으로는 「셋이 동시에」가 안 나온다 — 가장 가까운 한 명만 문턱을 넘는다.
   수정 — 카운터프레스와 같은 구조로 짧은 창을 연다. 감지는 공짜다(패스를 놓는
   그 순간 방향을 이미 안다). 키퍼에게 간 백패스는 창이 한 명 더 열린다 —
   실축에서 가장 명확한 압박 신호이고, 키퍼는 발이 제일 약하다.
   ⚠ 창 길이가 카운터프레스보다 긴 이유 — 패스가 날아가는 동안에는 caller 가 없어
   압박자 선발 자체가 돌지 않는다. 도착한 <b>뒤</b>가 진짜 창이다. */
const BP_WIN=3.0;          // 패스를 놓은 시점부터 (초) — 비행 시간이 여기서 빠진다
const BP_WIN_ADD=1.6;      // 최대 4.6초 — 도착 뒤 실제로 압박에 쓰이는 건 그중 2~3초다
const BP_ZONE=0.55;        // 받는 자리가 패스한 팀의 자기 진영 쪽일 것 — 아니면 못 쫓아간다
const BP_GO=0.30;          // 창 안에서 PRESS_GO 를 이 비율만큼 낮춘다

/* 🪂 뜬 공 트리거 (공백 02) ─────────────────────────────────────────────
   제보 원문(감사 항목) — 「뜬 공·컨트롤 불안정」이 압박 신호로 안 쓰인다.
   원인 — 세컨볼 역할(DEF_ROLE.SECOND)이 있긴 한데 실측 0.0% 다. DM·MF 밴드 안에
   갇혀 있고 후보 점수도 낮아 다른 역할에 늘 진다. 개인 점수로는 「지금 저기다」가 안 된다.
   수정 — 롱볼이 떠 있는 동안 창을 예약해 두고, <b>공이 떨어진 순간부터</b> 연다.
   비행 시간(plan.T)을 알고 있으므로 정확히 그 시점에 맞출 수 있다.
   낙하 지점 근처에 우리 선수가 하나도 없으면 열지 않는다 — 열어 봐야 쓸 사람이 없다. */
const AB_WIN=2.6;          // 공이 떨어진 뒤부터 (초) — 세컨볼 다툼은 짧다
const AB_WIN_ADD=1.4;
const AB_REACH=0.30;       // 낙하 지점에서 이 안에 우리 선수가 있어야 창을 연다 (약 21m)
const AB_GO=0.26;

/* 세 트리거를 한 곳에서 합친다 — 겹쳤을 때 무슨 일이 나는지 이 함수 하나에 다 있다.
   따로 세 벌을 두면 「전원이 달려 나가는」 상태를 아무도 못 막는다. */
function pressTrig(S, key, t){
  let add=0, cut=0, on=null;
  const use=(o, addN, goK, nm)=>{
    if(!o || o.side!==key || t>=o.until) return;
    const w=clamp01((o.until-t)/(o.w0||1));
    add+=addN(o); cut+=goK*o.i*w; if(!on) on=nm;
  };
  use(S._cp, o=>1+(o.i>0.80?1:0), CP_GO, "cp");   // 카운터프레스
  use(S._bp, o=>1+(o.gk?1:0),     BP_GO, "bp");   // 백패스 (키퍼면 한 명 더)
  use(S._ab, o=>1,                AB_GO, "ab");   // 뜬 공
  return {add:Math.min(2, add),                                    // 정원 증가는 2명까지
          go:Math.max(PRESS_GO*0.45, PRESS_GO*(1-cut)),            // 문턱 바닥은 45%
          on};
}

/* 🪤 몰렸는가 — 터치라인은 열한 번째 수비수다. 다만 「측면에 있다」와 「몰렸다」는 다르다.
   제보 원문(감사 항목) — "측면 트랩(trapZone)이 유일한 협력 압박인데 조건이 위치 하나뿐이다."
   빠져나갈 곳이 몇 개나 남았는지를 직접 센다. 통로 판정은 이미 있는 laneBlocked 을 쓴다. */
function pinScore(carrier, mates, blockers){
  const wall=clamp01((Math.abs(carrier.y-0.5)-0.18)/0.26);   // 터치라인까지 남은 폭
  if(wall<=0) return 0;
  let out=0;
  for(const m of mates){
    if(m===carrier || m.slot==="GK") continue;
    const d=HYP((m.x-carrier.x)*PITCH_AR, m.y-carrier.y);
    if(d<0.03 || d>0.34) continue;                            // 너무 붙었거나 너무 멀다
    if(laneBlocked(carrier, m, blockers) > 0.55) continue;    // 통로가 막혔다
    if(++out>=3) break;                                       // 세 개면 안 몰린 거다
  }
  const few=clamp01((2.2-out)/2.2);                           // 0개=1.0 · 2개 남짓=0
  return wall*(0.35+few*0.65);
}

/* ── 슈팅 ─────────────────────────────────────────────────────────────────
   슛은 "때렸다/안 때렸다"가 아니라 다섯 단계를 순서대로 통과한다.
     블록 → 굴절 → 유효슈팅 판정 → 골키퍼(선방/캐치/쳐냄) → 골
   각 단계는 앞 단계에서 살아남은 슛만 받는다. 그래서 몸을 던진 수비수 앞에서는
   애초에 유효슈팅이 나올 수 없고, 굴절된 슛은 키퍼가 손을 못 쓰게 된다.        */
/* 슛의 종류 — 상황이 종류를 정하고, 종류가 공의 물리(속도·높이·회전)를 정한다.
     HEADER  머리로 아래로 찍는다        VOLLEY  뜬 공을 땅에 닿기 전 다이렉트로
     FINESSE 측면에서 구석으로 감아찬다   CHIP    전진한 키퍼 키를 넘긴다
     POWER   박스 밖에서 낮고 빠르게      PLACED  박스 안에서 코스를 노린다        */
const SHOT_TYPE={HEADER:"HEADER", VOLLEY:"VOLLEY", HALF_VOLLEY:"HALF_VOLLEY", FINESSE:"FINESSE",
                 CHIP:"CHIP", POWER:"POWER", PLACED:"PLACED"};
const CURVE_MAX=0.055;           // 감아차기의 최대 휨(경로 중간에서 옆으로 벌어지는 거리)

/* 상황을 보고 어떤 슛을 때릴지 정한다.
   opt.clear 는 "앞을 막은 수비수가 없다"(키퍼와 사실상 1대1)는 뜻이다. */
/* ══════════════════════════════════════════════════════════════════
   🎯 SHOT CONTEXT — 슛의 품질은 능력치 합계가 아니라 「그 순간의 자세와 공」이 정한다.
   퍼스트터치·몸 방향·볼 물리는 이미 엔진에 있다. 슈팅은 그 값을 읽어 쓴다.
   ══════════════════════════════════════════════════════════════════ */
const FTQ_VAL={PERFECT:1.00, GOOD:0.82, NORMAL:0.62, HEAVY:0.38, BAD:0.20, FAIL:0.06};
function shotContext(shooter, b, g, opps, now){
  /* ① 몸 방향 — 골대를 보고 있는가, 등지고 있는가 (§4·§29) */
  const want=Math.atan2(g.gy!=null?g.gy-shooter.y:0, (g.gx-shooter.x)*PITCH_AR);
  let da=(shooter.face===undefined) ? 0 : (want-shooter.face);
  while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2;
  const bodyOff=Math.abs(da);                                  // 0=정면, π=완전히 등짐
  const body=clamp(1-bodyOff/(Math.PI*0.72), 0, 1);
  /* ② 공이 발에 붙어 있는가 — 퍼스트터치가 만든 실제 거리 (§5) */
  const ballD=HYP(((b.x||0)-shooter.x)*PITCH_AR, (b.y||0)-shooter.y);
  const foot=clamp(1-(ballD-DRIB_LEAD*0.6)/(DRIB_LEAD*2.2), 0, 1);
  /* ③ 방금 한 터치의 품질 — 시간이 지나면 영향이 옅어진다 */
  let ft=0.62, fresh=0;
  const src=(shooter._ftAt!=null) ? shooter : ((b._ftAt!=null)?b:null);
  if(src){
    /* ⚠ 터치 뒤 공을 잡고 있는 시간(hold)이 1.3~2.5초라, 고정 창을 쓰면 슛 시점엔 이미 닫힌다.
       창의 길이를 「그 터치를 수습하는 데 걸리는 시간(ct)」에 비례시킨다.
       좋은 터치는 금방 자세가 잡히고, 크게 튄 터치는 슛할 때까지 여파가 남는다. */
    fresh=clamp(1-(now-src._ftAt)/(1.3+(src._ftCt||0.3)*2.4), 0, 1);
    ft=FTQ_VAL[src._ftQ]!==undefined ? FTQ_VAL[src._ftQ] : 0.62;
  }
  const touch=ft*fresh + 0.62*(1-fresh);
  /* ④ 공의 상태 — 높이와 속도. 뜬 공·빠른 공은 제대로 맞히기 어렵다 (§14) */
  const bz=b.z||0, bsp=HYP((b.vx||0)*PITCH_AR, b.vy||0);
  const ballOK=clamp(1-bz/(CROSSBAR_Z*0.85), 0.25, 1) * clamp(1-bsp/0.34, 0.30, 1);
  /* ⑤ 균형 — 골대 쪽으로 달리는 중인가, 반대로 틀고 있는가 (§30·§31) */
  const vsp=HYP((shooter.vx||0)*PITCH_AR, shooter.vy||0);
  let bal=1;
  if(vsp>1e-5){
    const mv=Math.atan2(shooter.vy||0, (shooter.vx||0)*PITCH_AR);
    let dm=mv-want; while(dm>Math.PI) dm-=Math.PI*2; while(dm<-Math.PI) dm+=Math.PI*2;
    bal=clamp(1-Math.abs(dm)/(Math.PI*0.85)*clamp(vsp/(SPD.SPRINT*SIM_DT),0,1), 0.25, 1);
  }
  /* ⑥ 압박 — 가장 가까운 수비수가 얼마나 붙었는가 (§7) */
  let nd=9, appr=0;
  for(const o of (opps||[])){ if(o.slot==="GK") continue;
    const d=HYP((o.x-shooter.x)*PITCH_AR, o.y-shooter.y);
    if(d<nd){ nd=d; appr=(o.tackleSkill||0.6); } }
  const press=clamp(1-nd/0.075, 0, 1)*(0.6+appr*0.7);
  /* 종합 — 0=최악의 자세, 1=완벽한 준비 */
  const quality=clamp(body*0.26 + foot*0.20 + touch*0.20 + ballOK*0.16 + bal*0.12
                    - press*0.24 + 0.10, 0, 1);
  return {body, bodyOff, foot, ballD, touch, ballOK, bal, press, nd, bz, bsp, quality};
}
/* ═══════════════════════════════════════════════════════════════
   ⚡ 원터치 슈팅 판단 — "지금 이 공을 잡지 않고 그대로 때리는 게 최선인가?"
   새 슈팅 시스템을 만들지 않는다. 수신(giveTo) 직전에 이 함수가 「예」를 돌려주면
   퍼스트터치를 건너뛰고 기존 resolveShot 을 그대로 부른다.
   판단 순서(스펙): 공이 오는 방향 → 몸 방향 → 골문 방향 → 슈팅 공간 → 압박 → 판단
   ═══════════════════════════════════════════════════════════════ */
const OT_MAX_M=30;            // 이 밖에서는 원터치를 아예 보지 않는다
function oneTouchEval(a, b, opps, gk){
  if(!a || a.slot==="GK" || !b) return null;
  const g=shotGeom(a);
  if(g.distM>OT_MAX_M || (g.gx-a.x)*a.dir<=0.01) return null;
  const A=(a.p&&a.p.attr)||{};
  const at=(k,dv)=>clamp(attr20(A[k]!=null?A[k]:dv)/20, 0.1, 1);
  const fin=at("fin",60), cmp=at("cmp",60), dec=at("dec",60), tec=at("tec",60), lon=at("lon",60), fir=at("fir",60);

  /* ① 공이 오는 방향 — 골문 쪽으로 흘러 들어오는 공일수록 발만 대면 된다 */
  const bs=HYP((b.vx||0)*PITCH_AR, b.vy||0);            // 공 속도(iso/틱)
  const bAng=(bs>1e-6)?Math.atan2(b.vy||0,(b.vx||0)*PITCH_AR):null;
  const toGoal=Math.atan2(0.5-a.y,(g.gx-a.x)*PITCH_AR);
  let inLine=0.5;
  if(bAng!==null){
    let d1=bAng-toGoal; while(d1>Math.PI)d1-=Math.PI*2; while(d1<-Math.PI)d1+=Math.PI*2;
    /* 공이 골문 쪽으로 오면(각 차 작음) 방향을 바꿀 필요가 없다 = 원터치가 쉽다.
       옆에서 가로지르는 컷백·낮은 크로스도 좋은 각(90도 부근)에서 오히려 때리기 좋다. */
    const ad=Math.abs(d1);
    inLine = ad<0.6 ? 1.0 : ad<1.3 ? 0.86 : ad<2.0 ? 0.70 : 0.42;
  }
  /* ② 몸 방향 — 골문을 정면으로 보고 있는가 */
  let faceK=0.5;
  if(a.face!==undefined){
    let d2=a.face-toGoal; while(d2>Math.PI)d2-=Math.PI*2; while(d2<-Math.PI)d2+=Math.PI*2;
    const ad2=Math.abs(d2);
    faceK = ad2<0.5 ? 1.0 : ad2<1.0 ? 0.80 : ad2<1.6 ? 0.50 : 0.18;   // 등지고 있으면 원터치 불가에 가깝다
  }
  /* ③ 슈팅 공간 — 앞을 막고 선 사람 */
  const blk=shotLaneBlockers(a, opps, g);
  const lane = blk.near>=2 ? 0.15 : blk.near===1 ? 0.45 : blk.far>=2 ? 0.72 : 1.0;
  /* ④ 압박 — 붙어 있으면 잡을 시간이 없다 = 오히려 원터치가 답이다 */
  let near=9;
  for(const o of opps){ if(o.slot==="GK") continue;
    const d=HYP((o.x-a.x)*PITCH_AR, o.y-a.y); if(d<near) near=d; }
  const nearM=near*ISO_TO_M;
  const pressed = nearM<4.5 ? 1.0 : nearM<8 ? 0.6 : 0.25;
  /* ⑤ 거리·각도 — 기존 슈팅 척도 그대로 */
  const inBox=g.distM<=17;
  const distK = g.distM<8 ? 1.0 : g.distM<13 ? 0.92 : g.distM<18 ? 0.72 : g.distM<24 ? 0.40 : 0.22;
  const angK = clamp(g.angle/0.42, 0.15, 1);
  /* ⑥ 공의 높이·속도 — 발리·하프발리는 기술이 받쳐 줘야 하고, 굴러오는 빠른 공은 쉽다 */
  const z=b.z||0;
  const aerial = z>=VOLLEY_Z;
  const techK = aerial ? (0.30+tec*0.55+fin*0.25) : (0.55+fir*0.30+tec*0.20);
  const speedK = bs<0.02 ? 0.45 : bs<0.06 ? 0.85 : bs<0.14 ? 1.0 : 0.82;   // 너무 느리면 잡는 게 낫고, 너무 빠르면 어렵다

  /* 종합 — "원터치가 합리적인가" */
  let s = 0.42*inLine + 0.30*faceK + 0.55*distK*angK + 0.30*lane
        + 0.24*pressed + 0.22*techK*speedK;
  s *= (0.62 + fin*0.28 + cmp*0.20 + dec*0.20);          // 결정력·침착성·판단력
  if(!inBox){
    s *= (0.42 + lon*0.62);                               // 박스 밖은 중거리 능력이 좌우한다
    /* 🎚️ ⚠ 제보 원문 — 「'세부 전술'의 중거리슛 빈도를 '거의 안 참'으로 설정 해놨는데도
       경기 하이라이트를 보면 꽤 많은 장면이 중거리슛을 차고 있다」.
       원인: 박스 밖 슛에는 길이 둘이다 — 공을 잡고 때리는 길(evaluateShot)과
          잡지 않고 그대로 때리는 길(여기, 원터치). 앞의 길에는 감독 지시가 걸려 있었는데
          이 길에는 아예 없었다. 그래서 「거의 안 참」으로 두어도 컷백·흐른 공·낮은 크로스가
          오면 30m 밖까지 그냥 때렸다 — 하이라이트에 남는 건 대부분 이쪽이다.
       ─ 같은 눈금(0 자제 · 1 보통 · 2 적극)을 여기에도 건다. */
    let _ls=1; try{ _ls=clamp(TAC(a.team).longShot, 0, 2); }catch(e){ _ls=1; }
    /* ⚠ 재계측(제보 재확인) — 자제 쪽을 더 누른다. 가운데(1.00)·적극(1.58)은 그대로. */
    s *= _ls<1 ? (0.30 + _ls*0.70) : (1.00 + (_ls-1)*0.58);   // 0 → 0.30배 · 1 → 1.00배 · 2 → 1.58배
  }
  /* 상황 가산 — 스펙이 지목한 장면들 */
  if(b.isCross && b.crossType===CROSS_TYPE.CUTBACK) s += 0.30;   // 컷백 — 원터치의 교과서
  else if(b.isCross && z<VOLLEY_Z*0.8) s += 0.22;                // 낮은 크로스
  s += FX(a,"shoot")*0.45;                                // 🎯 슈팅 선택 성향 — 「패스 선호」는 원터치도 덜 때린다
  if(b._through && inBox) s += 0.12;                      // 박스 안으로 찔러 준 직선 패스
  if(b.state==="LOOSE") s += 0.10;                        // 흐른 공 — 잡을 여유가 없다
  if(aerial) s -= 0.10;                                   // 공중볼은 기본적으로 어렵다

  /* 문턱 — 박스 안은 낮게, 밖은 높게. 골문에서 멀수록 "합리적"이기 어렵다.
     📏 20260913-1800 호출 스택 계측(n=4) — 슛이 어디서 나오는지 전수로 셌다:
         원터치(여기)        <b>17.0/경기 · 53%</b>
         크로스 받아 때리기     11.25
         잡고 판단해서 슛(evaluateShot)  3.0   ← 사실상 죽은 길이다
         세트피스              1.0
       즉 SHOT_BIAS 도 1대1 하한선도 슛 총량의 손잡이가 아니었다. <b>원터치가 수도꼭지다.</b>
       (앞선 두 시도: SHOT_BIAS -0.71 → 슛 -2.3 · 하한선 조이기 → 슛 -1.15. 둘 다 헛다리)
     ─ 실축 총 슛 23 에 맞추려면 원터치를 절반 가까이 줄여야 한다. */
  /* 📏 20260913-2000 — 거리대별 슛(실축 추정치와 비교):
        근거리(<11m)  7.0  ≈ 6   ✓
        중거리(11~20m) <b>17.2</b>  vs 9   ← 초과분이 전부 여기다
        장거리(>20m)  5.3  vs 8   (오히려 모자란다)
     ─ 문턱을 계단(박스 안/밖)이 아니라 <b>거리 함수</b>로 바꾼다. 6m 탭인은 그대로 두고
       11~17m 의 「받자마자 그냥 때리기」만 강하게 누른다. */
  /* ⚠ 돌파·태클 시도를 줄이면 캐리어가 공을 덜 잃어 공격이 길어지고 슛이 되레 는다
     (2400→2600 실측: 슛 24.9→27.9). 그 되돌아온 몫을 여기서 다시 깎는다. */
  /* ⚖️ 압박자 명단을 연속으로 바꾸면서(전환 비용) 수비가 조금 강해졌다 — 슛 22.2 → 20.2.
     수비 안정화는 언제나 공격으로 되갚아야 한다. 원터치 문턱을 조금 내려 되돌린다. */
  /* ⚠ 되갚기를 박스 <b>밖</b>까지 열었더니 60경기에서 장거리슛 5.6 → 7.5, 슛 26.0(실축 23),
     코너 11.8(실축 10)까지 따라 올라갔다. 박스 밖은 원래대로 두고 박스 안만 남긴다. */
  const need = inBox ? (1.26 + clamp((g.distM-6)/11, 0, 1)*0.85) : 1.90;   /* ⚖️ 마킹 정확도 개선으로 슛 22.4→19.1 — 되갚는다 */   /* 슛 27.1(실축 23) — 중거리를 조금 더 */
  const ok = s>=need;
  return {ok, score:s, need, g, blk, inBox, aerial, speedK, inLine, faceK};
}
function chooseShotType(shooter, g, ball, gk, opt){
  const o = opt||{};
  const fin = shooter.finSkill||0.6;
  const z = ball ? (ball.z||0) : 0;
  const inFlight = ball && (ball.state==="PASS" || ball.state==="LOOSE");
  if(inFlight && z>=HEAD_Z0 && z<=HEAD_Z1) return SHOT_TYPE.HEADER;   // 머리 높이로 온 공
  if(inFlight && z>=VOLLEY_Z)             return SHOT_TYPE.VOLLEY;   // 아직 떠 있는 공
  /* 하프 발리 — 막 튀어 오르거나 떨어지는 공을 어정쩡한 높이에서 때린다.
     완벽한 발리 자세가 안 나온 상황이 실제로는 훨씬 흔하다. */
  if(z>0.004 && z<VOLLEY_Z && Math.abs(ball.vz||0)>0.02) return SHOT_TYPE.HALF_VOLLEY;
  // 키퍼와 단둘이 남았다 — 넘겨 차거나(로빙), 구석으로 감아 찬다.
  // 이런 상황에서 매번 똑같이 정직하게 때리면 마무리가 단조로워진다.
  const TT=shooter.tr||{};
  if(o.clear && g.distM<20){
    const r=Math.random();
    /* 🧤 ⚠ 요청 — 「공격수는 키퍼가 나온 걸 보고 칩샷·밀어넣기·제치기를 고른다」.
       예전에는 이 갈림길이 순수 난수였다 — 키퍼가 골라인에 붙어 있든 6m를 뛰쳐나왔든
       똑같은 확률로 로빙을 찼다. 이제 <b>키퍼가 지금 어디 서 있는지</b>를 읽는다.
         · gkOut  — 키퍼가 골라인에서 나온 거리(m)
         · gap    — 나와 키퍼 사이 거리(m). 넘길 공간이 있어야 로빙이 성립한다
       읽는 능력은 시야·판단력·침착성이다. 눈이 나쁜 공격수는 키퍼가 나와 있어도 그냥 때린다. */
    if(gk){
      const gkOut=Math.abs(gk.x-g.gx)*PITCH_AR*ISO_TO_M;
      const gap=HYP((gk.x-shooter.x)*PITCH_AR, gk.y-shooter.y)*ISO_TO_M;
      const A=(k)=>(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr[k])/20)||0.6;
      const read=clamp(A("vis")*0.42 + A("dec")*0.32 + A("cmp")*0.26, 0.15, 1.0);   // 상황을 읽는 눈
      /* 🥄 로빙 — 키퍼가 많이 나왔고 넘길 공간이 남았을 때. 「너무 일찍 나온 키퍼」의 대가다 */
      if(gkOut>4.0 && gap>3.0 && g.distM>5){
        const pChip = clamp((gkOut-4.0)/7.0, 0, 1) * (0.28 + read*0.44 + (TT.lob?0.30:0));
        if(r < pChip) return SHOT_TYPE.CHIP;
      }
      /* 🌀 제치기 — 키퍼가 코앞까지 덮쳐 왔다. 슛할 각이 없으니 옆으로 빼서 지나간다.
         볼 다루는 기술·민첩성·침착성이 받쳐 줘야 시도한다 (실패하면 키퍼에게 먹힌다). */
      if(gap<5.5 && gkOut>3.0){
        const dr=clamp(A("dri")*0.44 + A("agi")*0.28 + A("cmp")*0.28, 0.15, 1.0);
        if(r < 0.14 + dr*0.42 + (TT.round?0.26:0)){ shooter._roundGK=1; return SHOT_TYPE.PLACED; }
      }
      /* 키퍼가 골라인에 붙어 버티고 있다 — 넘길 공간이 없다. 구석을 노린다 */
      if(gkOut<2.2 && r < 0.30+fin*0.30) return SHOT_TYPE.FINESSE;
    }
    // 특성: 로빙 슛 선호 / 키퍼 제치기 / 휘어차기
    if(g.distM>5 && r < 0.22+fin*0.16+(TT.lob?0.34:0)) return SHOT_TYPE.CHIP;    // 키퍼 키를 넘긴다 (5m 안에서는 넘길 공간이 없다)
    if(TT.round && r < 0.60)                          return SHOT_TYPE.PLACED;    // 제치고 밀어 넣는다
    // 감아차기는 특성뿐 아니라 역할(인사이드 포워드·인버티드 윙어)도 부여한다.
    // TT.curl 만 읽던 시절에는 역할이 준 curl 값이 통째로 버려졌다 — FX로 둘을 합쳐 읽는다.
    if(r < 0.48+fin*0.18+Math.min(0.34, FX(shooter,"curl")*0.26)+Math.min(0.28, FX(shooter,"place")*0.28) && fin>0.45) return SHOT_TYPE.FINESSE;  // 반대편 구석으로 감아 찬다
  }
  // 키퍼가 골라인에서 많이 나와 있으면 넘겨 찬다
  if(gk){
    const off = Math.abs(gk.x-g.gx)*PITCH_AR;
    if(off>GK_OFFLINE && g.distM>9 && g.distM<26 && Math.random()<0.30+fin*0.35)
      return SHOT_TYPE.CHIP;
  }
  // 측면에서의 감아차기 — 박스 밖에서도 각을 세워 감아 올린다
  const wide=Math.abs(shooter.y-0.5)>0.10;
  if(wide && g.distM<30 && Math.random()<0.24+fin*0.45) return SHOT_TYPE.FINESSE;
  // 박스 밖 정면 — 감아 차거나, 힘으로 때린다
  if(g.distM>17 && Math.random()<0.16+fin*0.30) return SHOT_TYPE.FINESSE;
  if(FX(shooter,"power")>0 && Math.random()<0.40) return SHOT_TYPE.POWER;   // 특성: 강하게 때리기 선호
  if(g.distM>19) return SHOT_TYPE.POWER;
  return SHOT_TYPE.PLACED;
}
const GOAL_HALF=0.0523;     // 골문 반폭 7.32m / 70m — 경기장을 넓혀도 골문은 실측 유지
const SHOT_MAX_M=31;        // 이 거리 밖에서는 슛을 시도하지 않는다
/* ── 중거리 슛 성향 (전술 지시: 0 적게 / 1 보통 / 2 많이) ──────
   박스 밖에서 때릴지 한 번 더 만들지를 가르는 값이다. 이게 없으면 거리 감점에 눌려
   박스 밖 슛이 전체의 10%밖에 안 나온다(실제 축구는 35~45%). */
const LS_PREF=[-0.62, 0.34, 1.05];    // 성향별 기본 가산점 (0=자제 · 1=보통 · 2=적극)
const LS_SKILL=[0.25, 0.70, 1.15];    // 중거리 능력치가 얹어 주는 몫
/* ⚠ 전술이 3단계에서 5단계 슬라이더로 바뀌면서 이 값이 0.5·1.5 같은 소수로 들어온다.
   배열을 그대로 인덱싱하면 undefined → 점수가 NaN → 비교가 전부 false 가 되어
   그 선수는 영영 슛을 때리지 않는다. 세 지점 사이를 이어서 읽는다. */
function lsLerp(arr, v){
  const x=clamp(v==null?1:v, 0, 2), i=Math.floor(x), f=x-i;
  return i>=2 ? arr[2] : arr[i]+(arr[i+1]-arr[i])*f;
}
const LS_NAME=["자제","보통","적극"];
const SHOT_GAIN=2.70;       // 슛 기대값 → 패스와 겨루는 점수로 바꾸는 배율.
                            // 이 값이 작으면 q(상황의 좋고 나쁨)가 BIAS 에 묻혀버려,
                            // 결국 "보너스 조건에 딱 맞는 상황"에서만 슛이 나오는 이분법이 된다.
const SHOT_BLKPEN=0.08;     // 앞을 막은 수비수를 슈터가 얼마나 꺼리는가
const BLOCK_P=0.95;
/* ⏱️ 코너도 시계 1:1 복귀로 2배가 되므로 절반으로 내린다.
   ⚠ 다만 이 두 값은 코너의 <b>주된 경로가 아니다</b>. 실측에서 0.52 → 0.26 으로 내려도
      경기당 코너가 15 회로 그대로였다. 코너의 대부분은 확률이 아니라
      「걷어낸 공이 자기 골라인을 넘는다」는 물리 결과(advanceLoose → cornerKick)에서 나온다.
      즉 코너를 실축 수준(90분 9~10회)까지 낮추려면 이 손잡이가 아니라
      걷어내기 방향·세기를 손봐야 한다. 지금은 90분 환산 약 12.6 회 — 실축보다 30% 많다. */
const BLOCK_CORNER_P=0.52;   // 골문 앞에서 막힌 슛이 골라인을 넘어갈 확률 (0.26 → 0.42(코너 8.7) → 0.52. 실축 10)
const CROSS_CORNER_P=0.26;   // 바이라인 근처에서 막힌 크로스가 골라인을 넘어갈 확률
/* 📏 유효슛 7.07/경기 · 유효슛% 30.6 (실축 8 · 35%). 슛 총량(22.3)은 맞는데
   골문 안으로 가는 비율이 낮다 — 기준선을 올린다. 0.07 → 0.115 */
const ACC_BASE=0.150;       // 유효슈팅 기준선 (0.07 → 0.115(유효슛 7.58) → 0.150. 실축 8)
/* ⏭ 남은 것: 유효슛 6.95·유효슛% 32.7 (실축 8·35). 0.178 로 올리고 SAVE_BASE 도 함께 올리는 안까지
   갔다가 60경기 검증을 못 끝내 되돌렸다 — 검증 없이 넣지 않는다. */
/* 🧤 골키퍼 세이브 물리 — 확률이 아니라 시간과 거리로 막는다 */
/* 🧤 가만히 서서 손이 닿는 범위 — 키와 점프 도달력이 정한다.
   Reflexes 를 선방 확률에 곱하는 대신, 이렇게 「몸이 실제로 닿는 거리」로 만든다. */
function gkReachBase(gk){
  const A=(gk&&gk.p&&gk.p.attr)||{};
  const v=(k,fb)=>clamp((attr20(A[k]!=null?A[k]:(fb||60)))/20, 0.15, 1);
  const ht=clamp((((gk&&gk.p&&gk.p.ht)||186)-170)/28, 0, 1);      // 키 170~198cm
  return 0.0090 + ht*0.0055 + v("jum",62)*0.0045 + v("agi",60)*0.0028;
}
/* 서 있는 자리의 정확도 — Positioning 이 낮으면 각을 조금씩 잘못 잡는다.
   매번 흔들리는 랜덤이 아니라 그 키퍼가 가진 버릇(seed)으로 둔다. */
function gkPosError(gk, ball){
  if(!gk) return 0;
  const A=(gk.p&&gk.p.attr)||{};
  const pos=clamp(attr20(A.pos!=null?A.pos:60)/20, 0.15, 1);
  const off=clamp(Math.abs(ball.y-0.5)/0.35, 0, 1);               // 각이 열릴수록 어렵다
  /* 🧤 특성 「수비 라인을 소리로 지휘」 — 뒷선을 정리하면서 자기 각도 함께 잡는다 */
  let k=1; try{ k=clamp(1-FX(gk,"gkCmd")*0.35, 0.55, 1); }catch(e){}
  return Math.sin((gk.seed||0)*3.1) * (1-pos) * 0.020 * (0.45+off*0.85) * k;
}
const GK_REACT_BASE=0.34;          // 기본 반응 지연(초) — 능력치가 깎는다
/* 몸을 뻗는 속도 — 실제 키퍼는 0.5초에 2~3m를 간다(약 5m/s).
   ⚠ 0.26(=17m/s)으로 두면 도달 범위가 20m로 나와 모든 유효슛을 막는다. */
/* 몸을 뻗는 속도 — 실제 키퍼는 0.5초에 2~3m(약 5m/s). 0.075 iso/s ≈ 5m/s 로 맞춘 값.
   ⚠ 이 값을 키워도 전체 골은 잘 안 움직인다 — 실측상 슛 11개 중 기하 판정(need<=reach)에
      도달하는 건 3개뿐이고, 나머지는 블록·골문 밖으로 그 전에 끝나기 때문이다.
      득점을 조절하려면 슛 정확도(sigY/sigZ)나 슛 빈도 쪽을 봐야 한다. */
/* ⚠ 실측 — 도달이 3.9m 로 골문 반폭(3.66m)을 넘어 유효슛 전체를 덮고 있었다.
      그래서 슛 품질·정확도를 아무리 만져도 결정률이 안 움직였다(선방 전원 여유 0.53).
      평균 도달을 2.5m 안팎으로 잡아 구석 슛(2.5~3.6m)은 뚫리게 한다. */
const GK_DIVE_V=0.0297;    // ×(67/70)
const GK_REACH_BASE=0.020;         // 가만히 서서 닿는 범위 (약 1.3m)
const GK_HAND_Z=0.012;             // 손이 편하게 닿는 높이 (약 0.8m)
const GK_RECOVER=0.85;             // 다이빙 후 일어나는 데 걸리는 시간
const GK_HOLD_MAX=3.2;             // 🧤 키퍼가 공을 안고 버틸 수 있는 최대 시간(초) — 넘으면 그냥 찬다
/* 선방 기준선. ⚠ 제보 — 「1대1이 너무 안 들어간다」.
   실측(2경기): 유효슈팅 17회 중 선방 15 · 골 2 = 선방률 88%. 실제 축구는 70% 안팎이다.
   이 값은 키퍼의 「도달 범위 배수」로 쓰이므로, 내리면 구석으로 간 슛에 손이 덜 닿는다. */
/* 🧤 선방률 보정 (제보 「골이 너무 많이 터진다」의 <b>직접 원인</b>).
   ⚠ 진단 — 슛(26 vs 실축 23)도 유효슛 비율(26% vs 35%)도 실축보다 얌전한데,
      <b>유효슛이 들어가는 비율만</b> 크게 높았다. 선방률 39~56% (실제 축구 69~71%).
   ⚠ 계측 계단 (n=14 · 같은 시드 · 다른 값은 전부 고정):
        SAVE_BASE 0.76 → 선방률 39.3% · 골 4.64
        SAVE_BASE 1.00 → 선방률 59.8% · 골 3.64
        SAVE_BASE 1.15 → 선방률 59.7% · 골 3.43   ← 더 올려도 안 움직인다(포화)
        1.00 + 근거리 도달 감쇠 완화 → 선방률 <b>65.4%</b> · 골 <b>2.57</b> · 슛 24.4
      즉 손잡이가 <b>둘</b>이다. save 계수만으로는 60% 언저리에서 포화하고,
      나머지는 아래 근거리(14m 안) 도달 감쇠가 쥐고 있었다. 둘을 같이 풀어야 실축에 닿는다.
   ⚠ 0.97 상한에 걸려 있던 것도 함께 열었다(아래 clamp). */
/* 📏 20260913-1900 짝지은 계측(같은 시드 30쌍) — 원터치 문턱을 올린 뒤:
      슛 35.6→29.0 · 유효슛 <b>8.63(실축 8 — 이미 맞다)</b> · 골 3.2→<b>4.2</b> · 선방률 66.8→<b>50.8</b>
   즉 남은 문제는 슛의 개수가 아니라 <b>유효슛의 전환율</b>이다.
     지금  8.63 유효슛 → 4.2 골 = 전환 48.7%
     실축  8.0  유효슛 → 2.45 골 = 전환 30.6% (선방률 70%)
   ⚠ 쓰레기 중거리슛이 사실 「쉬운 선방」으로 선방률을 떠받치고 있었다 — 그걸 걷어내니
      선방률이 16pp 무너졌다. 골키퍼 자체를 올려야 한다. */
/* ⚠ 태클·돌파를 실축 수준으로 내리자 선방률이 71 → 60.6 으로 도로 무너졌다.
   수비 경합이 줄면 공격수가 더 좋은 자리에서 때린다(근거리슛 5.9→7.5) — 대가를 키퍼가 치른다.
   1.22 → 66.8% · 1.30 → 60.6%(경합 감소 후) → 1.45 로 다시 올린다. */
/* ⚠ 되풀이되는 저울 — 공격을 살리는 변화(경합 감소·박스 침투)는 매번 선방률을 끌어내린다.
   더 좋은 자리에서 때리니 당연하다. 그때마다 키퍼를 같이 올려야 한다.
   1.45→66.5% · 1.55→66.7% · 1.64→66.8% · (박스 침투 후) 59.4% → 1.92 */
/* 📏 세 번 재 보니 1.80→64.7% · 1.86→75.2% · 1.92→74.1% 로 <b>단조롭지 않다</b> —
   n=30 에서 선방률의 짝 차이 SE 가 5pp 안팎이라 이 구간은 노이즈에 묻힌다.
   같은 세 빌드의 골은 2.43 · 1.87 · 2.03 (평균 2.1, 실축 2.45) 이므로 조금 내린다. */
/* n=60 확인: 1.74 → 선방률 72.2%(실축 70) · 골 2.18(실축 2.45). 조금 내린다. */
/* 📏 n=60 — 상한을 열기 전 유효값은 1.25 로 고정돼 있었다(위 clamp 주석).
   그 상태의 실측이 선방률 62.7% · 골 2.95(실축 70% · 2.45)다.
   상한을 연 뒤 1.45 는 도달 배율 1.7375 → 1.9275 (+11%) 에 해당한다. */
/* ⚠ 수비 히스테리시스 작업(4700~4900)으로 수비가 전반적으로 강해졌다 —
   선방률 77.8% · 골 1.93(실축 70% · 2.45). 상한을 연 뒤로는 이 계수가 실제로 들으므로 내린다. */
const SAVE_BASE=1.24;   /* ⚖️ 윙어 압박 개선으로 슛 질이 떨어져 선방% 78.6(실축 70) — 되갚는다 */   /* ⚖️ 발 데드존·목표 평활로 수비가 세졌다(차단 +11.7·태클 +4.8·선방% +13.6) — 되갚는다 */   // 선방% 64.4(실축 70) — 다음 작업 후보
const SHOT_DIV=46;          // 거리 감쇠 분모 — 작을수록 먼 거리 슛이 줄어든다
/* 🎯 「키퍼와 1대1」 하한선이 성립하는 최소 골문 각(rad) — evaluateShot 주석 참고.
   0.30 ≈ 17°: 정면 24m 에서 보이는 골문 각. 측면 12m·전방 12m 지점(0.31)은 통과,
   측면 20m·전방 9m(0.14) 같은 윙 자리는 탈락. */
const SHOT_1V1_ANGLE=0.30;
/* 낮출수록 슛이 줄어든다 (실제 K리그 팀당 11~13회에 맞춘 값)
   ⚠ 한때 -4.25 까지 내렸다가 되돌렸다. 그 판단은 「147분짜리 경기」를 재던 잘못된 계측
      (MATCH_CLOCK_SCALE=2 를 놓쳐 22000틱을 돌림) 위에서 내린 것이었다.
      정규 90분으로 다시 재니 -2.58 이 팀당 15.9슛 · 경기당 3.0골로 실제에 가장 가깝다. */
/* ⚠ 시계 배율을 2→1 로 내리면서 경기당 시뮬 시간이 2배가 됐다.
      같은 성향이면 슛도 2배로 나온다(실측 팀당 36회) — 그만큼 문턱을 올린다. */
/* 📏 회귀 하네스 n=20 기준선(20260913-1600): 슛 36.4 · 골 3.45 · 유효슛% 27.8
   실축 K리그: 슛 23 · 골 2.45 · 유효슛% 35 → 슛을 37% 줄여야 한다.
   ADJ 0.16→0 과 함께 문턱을 0.55 더 올려 기울기를 잰다. */
const SHOT_BIAS=-3.95;
const BLOCK_W=GOAL_HALF*0.55+0.022;   // 수비수가 몸으로 가릴 수 있는 폭
const SHOT_SPEED=0.275;     // 슛한 공의 비행 속도 (패스보다 빠르다) — 0.239에서 +15% (체감 상향 요청)
const SHOT_MIN_TICKS=5;     // 아무리 가까워도 이만큼은 날아간다 — 순간이동하지 않게
/* ⏱️ ⚠ 제보 — 「호스트 화면의 추가시간과 게스트 화면의 추가시간이 다르게 나온다」.
   원인: 호스트는 전광판 글자를 clockLabel() 로 만든다 — 전반 추가시간(a1)을 빼고 「90+3」처럼 찍는다.
      게스트는 그 계산을 아예 안 하고 받은 초를 60으로 나눠 「95'」로 찍고 있었다.
      추가시간이 붙는 순간부터 두 화면의 숫자가 벌어진다(전반 추가시간만큼 + 표기 방식 차이).
   ─ 글자를 만드는 자리를 하나로 모으고, 호스트가 추가시간을 정하는 순간 게스트에게 그 값을 보낸다.
      두 화면이 같은 함수, 같은 값으로 같은 글자를 만든다. */
function matchClockTxt(c, a1, a2, a3, etOn){
  c=+c||0; a1=+a1||0; a2=+a2||0; a3=+a3||0;
  const H=SIM_SECONDS/2;
  const up=(s)=>Math.max(1, Math.ceil(s/60));
  if(c<=H) return String(Math.floor(c/60));
  if(c<H+a1) return "45+"+up(c-H);
  const c2=c-a1;                                  // 후반 — 전반 추가시간을 뺀 실제 시계
  if(c2<=SIM_SECONDS) return String(Math.floor(c2/60));
  if(!etOn) return "90+"+up(c2-SIM_SECONDS);
  if(c2<SIM_SECONDS+a2) return "90+"+up(c2-SIM_SECONDS);
  const c3=c2-a2;                                 // 연장
  if(c3<=SIM_SECONDS+ET_SECONDS/2) return String(Math.floor(c3/60));
  if(c3<SIM_SECONDS+ET_SECONDS/2+a3) return "105+"+up(c3-(SIM_SECONDS+ET_SECONDS/2));
  const c4=c3-a3;
  if(c4<=SIM_SECONDS+ET_SECONDS) return String(Math.floor(c4/60));
  return "120+"+up(c4-(SIM_SECONDS+ET_SECONDS));
}
/* 📺 VAR — 연속 엔진의 온필드 리뷰. 골이 들어간 뒤 낮은 확률로 판독에 들어간다. */
const VAR_CHECK_P=0.085;        // 골당 판독 확률 (K리그 실측: 경기당 0.2~0.3회 수준)
const VAR_DECIDE_SECS=6.5;      // 판독에 걸리는 시간
const VAR_CONFIRM_P=0.62;       // 판독 후 골 인정 비율
const CELEBRATE_OFF_SECS=8;   // 취소된 골 — 환호가 짧게 끊긴다
const CELEBRATE_SECS=16;    // 골 세리머니 — 득점자에게 몰려갔다가 하프라인으로 돌아온다
const ISO_TO_M=70;         // 등방 좌표 1단위 = 70m (세로폭). 가로는 ×PITCH_AR = 110m
/* ── 공의 물리 ──────────────────────────────────────────────────────────────
   공은 위치만 있는 점이 아니라 속도(vx,vy)와 높이(z,vz)를 가진 물체다.
   · 잔디 위를 구를 때는 매 틱 마찰을 곱해 부드럽게 감속하고, 거의 멈추면 속도를 0으로 끊는다.
   · 떠 있을 때는 중력이 vz를 끌어내리고 공기 저항이 수평 속도를 조금씩 깎는다.
   · 땅에 닿으면 반발계수만큼 튀어오르고, 튈 때마다 수평 속도도 잃는다.
   속도 단위는 "iso/초"(1 iso ≈ 67m), 높이 z 도 같은 iso 단위다.                    */
const GRAVITY = 9.81/ISO_TO_M;      // 중력 가속도 (iso/s²)
/* ═══ 🌦️ 날씨 · 피치 상태 ═══════════════════════════════════════════
   ⚠ 요청 — 「비 → 공 마찰 감소, 바운스 낮아짐, 퍼스트터치 실수↑, 키퍼 핸들링 실수,
      슬라이딩 태클 거리↑ / 눈·젖은 잔디 → 미끄러짐, 가속 저하 / 폭염 → 체력 소모 가속 /
      캔버스에 빗줄기 연출 + 중계 자막」.
   ── 설계 ────────────────────────────────────────────────────
     날씨를 종류로 나누지 않고 <b>세 개의 축</b>으로 환원한다. 엔진은 종류를 모르고 축만 읽는다 —
     그래서 나중에 날씨를 추가해도 엔진을 다시 뜯을 필요가 없다.
       wet  (0~1) 젖음   — 공이 더 구르고, 덜 튀고, 발에 안 붙고, 키퍼 손에서 빠진다
       slip (0~1) 미끄러움 — 방향 전환이 무뎌지고, 급격히 꺾으면 넘어진다
       heat (-1~1) 더위  — 체력 소모 가속 (음수는 추위 — 소모는 덜하지만 몸이 굳는다)
     ⚠ stepBallPhysics 같은 전역 함수는 시뮬 인스턴스를 모른다 — 매 틱 WX_NOW 에 실어 준다. */
const WX_KIND={
  clear:{n:"맑음",   ic:"☀️", wet:0.00, slip:0.00, heat:0.15, wind:0.10},
  cloud:{n:"흐림",   ic:"☁️", wet:0.06, slip:0.03, heat:0.00, wind:0.20},
  rain: {n:"비",     ic:"🌧️", wet:0.62, slip:0.32, heat:-0.10, wind:0.35},
  storm:{n:"폭우",   ic:"⛈️", wet:1.00, slip:0.58, heat:-0.15, wind:0.75},
  snow: {n:"눈",     ic:"🌨️", wet:0.50, slip:0.88, heat:-0.30, wind:0.45},
  hot:  {n:"폭염",   ic:"🔥", wet:0.00, slip:0.00, heat:1.00, wind:0.05},
  cold: {n:"한파",   ic:"❄️", wet:0.08, slip:0.30, heat:-0.35, wind:0.40},
  windy:{n:"강풍",   ic:"🌬️", wet:0.10, slip:0.05, heat:0.00, wind:1.00}
};
let WX_NOW={k:"clear", wet:0, slip:0, heat:0, wind:0, wdir:0};
/* 그날의 날씨 — 달(月)이 판을 깔고 그 위에서 주사위를 굴린다 (K리그는 2~12월) */
/* ⚠ 요청 — 「일정 달력·상단 날짜·좌측 메뉴에도 날씨가 보이게」.
   달력은 <b>앞으로의 날짜</b>를 묻는다. 그러려면 날씨가 「경기 시작할 때 굴리는 주사위」가 아니라
   <b>날짜의 성질</b>이어야 한다 — 시즌+날짜로 씨앗을 만들어, 같은 날은 언제 물어도 같은 날씨다. */
function wxRandOf(day){
  let s=((G.season|0)*7919 ^ (((day|0)+1)*104729)) >>> 0;
  return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s;
    t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61);
    return ((t^(t>>>14))>>>0)/4294967296; };
}
function pickWeather(day, rnd){
  try{
    let mo=6;
    try{ mo=dateOfDay(day==null?(G.day||0):day).getMonth()+1; }catch(e){}
    const R=(rnd||Math.random)();
    if(mo<=2 || mo>=12){                      // 한겨울 — 승강PO·대륙대회
      if(R<0.16) return "snow"; if(R<0.42) return "cold"; if(R<0.58) return "cloud";
      if(R<0.68) return "rain"; if(R<0.76) return "windy"; return "clear";
    }
    if(mo===3 || mo===11){                    // 이른 봄·늦가을
      if(R<0.06) return "snow"; if(R<0.26) return "cold"; if(R<0.44) return "cloud";
      if(R<0.58) return "rain"; if(R<0.68) return "windy"; return "clear";
    }
    if(mo>=6 && mo<=8){                       // 한여름 — 장마와 폭염
      if(R<0.20) return "storm"; if(R<0.44) return "rain"; if(R<0.66) return "hot";
      if(R<0.78) return "cloud"; return "clear";
    }
    if(R<0.05) return "storm"; if(R<0.22) return "rain"; if(R<0.30) return "windy";
    if(R<0.48) return "cloud"; return "clear";
  }catch(e){ return "clear"; }
}
/* 경기 하나의 날씨 상태를 만든다 — 같은 종류라도 세기가 조금씩 다르다 */
function makeWeather(kind, rnd){
  const K=WX_KIND[kind]||WX_KIND.clear;
  const R=rnd||Math.random;
  const j=0.78+R()*0.44;                                 // 세기 편차
  return {k:kind, n:K.n, ic:K.ic,
          wet:clamp(K.wet*j,0,1), slip:clamp(K.slip*j,0,1),
          heat:clamp(K.heat*j,-1,1), wind:clamp(K.wind*j,0,1),
          wdir:R()*Math.PI*2};
}
/* 그 날짜의 날씨 — 달력·상단 표시·경기가 모두 이 함수 하나를 본다 */
function dayWeather(day){
  try{
    const d=(day==null)?(G.day||0):day;
    const r=wxRandOf(d);
    return makeWeather(pickWeather(d, r), r);
  }catch(e){ return makeWeather("clear"); }
}
function wxLabel(w){ return w ? `${w.ic} ${w.n}` : "☀️ 맑음"; }
function wxIcon(day){ try{ return dayWeather(day).ic; }catch(e){ return ""; } }
const GRASS_FRICTION = 0.931;       // 잔디 마찰 (틱당) — 초당 -30% 감속(0.931^5≈0.70). 공은 시원하게 구른다
/* ⚠ 패스 「발사 속도」는 옛 마찰(0.885) 기준을 유지한다 — 마찰을 완화하며 이 공식이 (1-마찰)에
   비례하는 바람에 패스가 40% 느려졌고, 키퍼 짧은 패스부터 줄줄이 잘렸다(제보). 발은 그대로 차고,
   공이 조금 더 구르는 것만 새 물리가 맡는다. */
const PASS_LAUNCH_F = 0.885;
const AIR_DRAG = 0.994;             // 떠 있을 때의 공기 저항 (틱당)
const BOUNCE = 0.53;                // 반발계수 — 튀어오를 때 남는 수직 속도 (+15%)
const BOUNCE_GRIP = 0.70;           // 바운스 순간 잔디에 먹히는 수평 속도 (높을수록 튄 뒤에도 쭉 나간다)
/* 🎾 ⚠ 제보 원문 — 「골키퍼 선방이나 공중볼로 공을 따내면 아주 먼 거리로 터치라인 아웃된다」.
   원인: BOUNCE_GRIP 이 낙하 각도와 무관한 상수였다. 높이 떴다 가파르게 떨어지는 공
      (걷어내기·골킥·빗맞은 헤더)도 낮게 깔린 패스와 똑같이 수평 속도의 70% 를 지킨 채 튀어,
      첫 바운드 뒤에 20~50m 를 더 굴러 그대로 라인을 넘었다 (실측: 걷어내기 33.8% 가 스로인,
      착지 목표에서 중앙 21m·최대 103m 를 더 갔다).
   ─ 가파르게 떨어지는 공일수록 운동에너지가 지면으로 들어가 수평 속도를 크게 잃는다.
     낮게 깔려 오는 공은 그대로 미끄러진다. 이 값이 그 기울기다. */
const BOUNCE_STEEP = 0.85;          // 수직으로 떨어질수록 수평 속도를 더 잃는다 (0=예전처럼 각도 무시)
const BALL_STOPV = 0.0012;          // 이 아래 속도는 0으로 끊는다 (낮출수록 끝까지 굴러간다)
const BALL_MINBOUNCE = 0.032;       // 이보다 약한 낙하는 튀지 않고 그대로 구른다
/* 공중으로 걷어낸 공은 착지 뒤에도 튀며 굴러간다.
   launchLoose 에 넘기는 거리는 "최종적으로 멈추는 곳"이므로, 첫 비행은 그 일부만 담당한다. */
const AERIAL_ROLLOUT = 2.9;
/* 부심이 깃발을 늦게 드는 비율 — 이 경우 플레이가 흘러가고, 골이 들어가면 그때 취소된다 */
const OFFSIDE_LATE_P = 0.30;
const OFFSIDE_LATE_WIN = 12;   // 깃발이 유효한 시간(초) — 이 안에 골이 나면 취소
const CTRL_Z = 1.0/ISO_TO_M;        // 이보다 높이 뜬 공은 발로 잡을 수 없다
const POSSESS_R = 0.023;            // 이 반경 안 + 낮은 높이면 공을 소유한다 (약 1.5m)
const GOAL_POST = 0.0022;           // 골포스트 반경 + 공 반경 (약 0.15m)
const CROSSBAR_Z = 2.44/ISO_TO_M;   // 크로스바 높이
const KICK_REACH_M = 2.2;           // 발이 닿는 거리 — 이보다 멀면 아직 찰 수 없다 (제보: 원거리 마법 패스)
const VOLLEY_Z = 0.35/ISO_TO_M;     // 이 높이 이상으로 떠 있는 공은 발리로 때린다
const HEAD_Z0 = 1.5/ISO_TO_M, HEAD_Z1 = 2.6/ISO_TO_M;   // 머리 높이
const GK_OFFLINE = 4.0/ISO_TO_M;    // 키퍼가 이만큼 나와 있으면 로빙슛이 보인다
const GK_SWEEP_X=0.30;      // 공이 우리 골문에서 이 안쪽(약 20m)에 떨어질 때만 스위핑을 고려
const GK_SWEEP_EDGE=0.045;  // 상대보다 이만큼 멀어도 감행한다 (돌진 빈도로 배수)
const GK_CLAIM_P=0.085;      // 박스로 떨어지는 크로스에 나가는 기본 확률
/* ⚠ 제보 — 「키퍼가 골대 앞에 너무 나와 있어 하프라인 롱슛에 실점한다」.
   빌드업 참여는 실제 축구에도 있지만 빈도가 과했다. 기본 전진과 최대 전진을 함께 줄인다. */
const GK_SUPPORT_X=0.145;   // 빌드업 시 올라오는 기본 위치 (골라인에서 약 10m · 0.20 → 0.145)
const GK_SWEEP_MIN=0.48;    // 이 값을 넘는 스위퍼 성향부터 박스 밖으로 나간다
const GK_SWEEP_PUSH=0.20;   // 최상급 스위퍼가 추가로 전진하는 거리 (0.30 → 0.20)
const GK_TURN_DIST=0.10;    // 목표가 이보다 멀면 몸을 돌려 달린다(스위핑), 가까우면 볼을 보며 스텝
const POST_BOUNCE = 0.62;           // 골대를 맞고 튕겨 나가는 정도
const GOAL_NET_DEPTH = 0.020;       // 골망 깊이 (≈2.2m) — 공은 이 안에서만 머문다
/* 🥅 골대 뒤 아웃 공간 — ⚠ 제보 원문 「매치엔진 경기장 그래픽에서 골대 뒤에 공간을 좀 넉넉하게 넓혀서,
   공이 골문 위로 뜨면 골대 뒤 공간으로 공이 나가게끔 해서 확실히 빗나갔다는 걸 쉽게 볼 수 있게 하자」.
   원인: 슛 비행이 b.x 를 clamp01 로 묶어, 빗나간 슛도 골라인(1.0)에서 딱 멈춰 「들어간 건지 아닌지」
   구분이 안 됐다. 골라인 뒤 이 값까지는 공이 나갈 수 있게 푼다.
   ⚠ 상한은 렌더 여백 PITCH_PAD_X 안이어야 한다 — 50/(640-100)=0.0926 보다 작게 둔다. */
const BEHIND_GOAL_MAX = 0.085;
function clampGoalOut(x){ return x<-BEHIND_GOAL_MAX ? -BEHIND_GOAL_MAX : (x>1+BEHIND_GOAL_MAX ? 1+BEHIND_GOAL_MAX : x); }
/* 🥅 골라인 아웃 — 공을 「골문 밖」이 한눈에 보이는 자리에 놓는다.
   ⚠ 제보 원문 「슈팅이 옆그물 맞아서 라인 아웃 되었을때도 보면 공이 거의 골문안에 들어가있거든?
      이것도 확실하게 눈에 띄게 분리해야지」.
   원인: 아웃된 공을 골라인 뒤 0.008~0.012(화면 4~6px)에 뒀다 — 골망 깊이(0.020 ≈ 11px)보다
   얕아, 그물에 꽂힌 「골」과 화면상 같은 자리였다. 좌우도 포스트 바깥 0.012(≈5px)뿐이라
   공 반지름·포스트 두께에 묻혀 골문 안에 있는 것처럼 보였다.
   ─ 앞뒤는 골망 뒤(0.046 ≈ 25px), 좌우는 포스트에서 확실히 떼어 놓는다(0.034 ≈ 15px).
   ⚠ GOAL_OUT_X 는 반드시 BEHIND_GOAL_MAX 안이어야 한다 — 넘으면 캔버스 밖으로 나간다. */
const GOAL_OUT_X = 0.046;
const GOAL_OUT_Y = GOAL_HALF + 0.034;
/* 🥅 ⚠ 제보 원문 — 「가끔 공이 골라인 아웃될 때 순간이동하던데, 이거 제대로 잡아줄래?」
   실측(6경기) — 골라인 아웃 623회가 <b>전부</b> 순간이동이었다. 중앙값 4.6m · 최대 7.4m.
     (터치라인은 중앙값 0.6m 로 멀쩡하다 — 골라인만의 문제였다)
   원인 두 겹.
     ① placeGoalOut 이 공을 「골망 뒤 4.7m · 포스트 밖 5.8m」 자리로 한 프레임에 옮겼다.
        그 자리 자체는 필요하다 — 라인 위에 두면 골문에 박힌 것처럼 보인다는 옛 제보 때문이다.
        문제는 자리가 아니라 <b>옮기는 방식</b>이었다.
     ② 세트피스 DEAD 단계도 매 틱 공을 sp.out 에 그대로 대입해, 남은 거리를 또 순간이동했다.
   ─ 목표 좌표는 그대로 두되, 공은 <b>굴러가서</b> 그 자리에 선다. 라인을 넘은 공은 이미
     죽은 공이라 이 0.3~0.6초는 경기 판정에 아무 영향이 없다 (키커 회수 절차는 sp.out 기준 그대로). */
const DEAD_ROLL_MUL=0.75;     // 죽은 공이 굴러가 멈추는 속도 (스프린트 대비)
function goalOutXY(b, gx, y){
  const x=(gx>0.5 ? 1+GOAL_OUT_X : -GOAL_OUT_X);
  const _y=(y==null? b.y : y);
  /* 어느 포스트 밖으로 흐를지는 「가던 방향」이 정한다 — 위치 부호로만 정하면
     한가운데(0.500)를 넘은 공이 매번 같은 쪽으로 튀어 부자연스럽다 */
  let s=(_y>=0.5?1:-1);
  if(typeof b.vy==="number" && Math.abs(b.vy)>0.02) s=(b.vy>=0?1:-1);
  const yy=(Math.abs(_y-0.5) < GOAL_OUT_Y) ? (0.5 + s*GOAL_OUT_Y) : clamp01(_y);
  return {x, y:yy};
}
function placeGoalOut(b, gx, y){
  const d=goalOutXY(b, gx, y);
  /* 물리 한 틱이 최대 11m라, 아웃을 발견했을 땐 공이 라인 한참 뒤에 가 있다.
     그 자리에서 굴리기 시작하면 「뒤에서 앞으로 되돌아오는」 그림이 된다 —
     이번 틱의 시작점과 이어 「라인을 실제로 넘은 지점」을 되짚어 거기서 출발시킨다. */
  const line=(gx>0.5)?1:0;
  if(typeof b._px==="number" && ((b._px-line)*(b.x-line))<0){
    const tt=(line-b._px)/((b.x-b._px)||1e-6);
    if(tt>=0 && tt<=1) b.y = b._py + (b.y-b._py)*tt;
  }
  const lim=0.006;                       // 라인 바로 뒤에서 출발한다
  b.x=(gx>0.5) ? Math.min(b.x, 1+lim) : Math.max(b.x, -lim);
  b.y=Math.max(-0.02, Math.min(1.02, b.y));
  b.vx=0; b.vy=0; b.vz=0; b.z=0; b.aerial=false;
  return d;                      // 최종 정지 지점 — 세트피스 절차(out)가 이 값을 쓴다
}
const NET_DRAG = 0.28;              // 그물에 걸린 공 — 급격히 감속하며 흔들린다
const WALL_BOUNCE = 0.45;           // 광고판·펜스에 맞고 되튀는 정도

/* 한 틱만큼 공을 굴린다. 위치·높이·속도를 모두 갱신한다. */
/* ══════════════════════════════════════════════════════════════════
   ⚽ KICK RESOLUTION — 모든 발질이 지나가는 단 하나의 관문
   패스·공간패스·슛·크로스·걷어내기가 각자 공을 초기화하면 규칙이 어긋난다.
   여기서 전부 「초기 속도 + 스핀」으로 환원한 뒤 BALL PHYSICS 로 넘긴다.
   ══════════════════════════════════════════════════════════════════ */
const KICK={ PASS:"PASS", SPACE:"SPACE", CROSS:"CROSS", SHOT:"SHOT",
             CLEAR:"CLEAR", GOALKICK:"GOALKICK", THROW:"THROW" };
/* 스핀 = {side, back}
   side : +면 오른쪽으로 휜다 / −면 왼쪽   (감아 차기, 인·아웃스윙 크로스)
   back : +면 백스핀(뜨고 떠서 바운스에서 멈칫) / −면 톱스핀(가라앉고 튀며 가속) */
const MAGNUS_A    = 0.075;   // 마그누스 횡가속 계수 (속도에 비례)
const ROLL_CURVE  = 0.55;    // 굴러갈 때 휘는 정도
const SPIN_DECAY  = 0.985;   // 매 틱 스핀 감쇠
const BOUNCE_TOP  = 0.20;    // 톱스핀 바운스 가속
const BOUNCE_BACK = 0.26;    // 백스핀 바운스 제동
function kickSpin(from, type, o){
  o=o||{};
  const tec=(from&&(from.crossSkill||from.passSkill))||0.55;   // 기술이 좋아야 회전을 건다
  const R=()=>(Math.random()-0.5)*2;
  let side=0, back=0;
  switch(type){
    case KICK.CROSS:
      /* 크로스는 거의 항상 회전이 걸린다. 오른발이 왼쪽에서 올리면 인스윙(골문 쪽으로 감김) */
      /* 눈에 확 보이는 커브(제보) — 스핀을 크게. 사전 빗겨차기 보정이 같은 값을 쓰므로
         휘는 폭이 커져도 낙하점은 목표에 붙는다. 실측 활 모양 폭 ≈ 4~5m */
      side = (o.fromY!=null ? (o.fromY<0.5?1:-1) : (R()>0?1:-1)) * (0.58+tec*0.58);
      back = o.floated ? 0.26 : -0.12;                 // 띄우면 백스핀, 낮게 감으면 톱스핀
      return {side, back, k:4.3};   // k — 크로스 전용 마그누스 배율 (활폭 ≈4.5~6m — 더 휘어도 좋다는 요청)
      break;
    case KICK.SHOT: {
      /* ⚠ 제보 — 「터치라인 부근에서 찬 슛이 반원을 그리며 골대에 꽂히는 UFO 골이 잦다」.
         예전 값은 기술 좋은 선수 기준 ±0.83 까지 걸렸고, 슛에는 조준 보정도 없어서
         마그누스가 궤적을 통째로 휘어 버렸다. 실제로도 각 없는 자리에서 감아 넣는 골은
         한 시즌에 몇 번 나오는 장면이다.
         ─ ① 폭 자체를 줄이고 ② 각이 없을수록·멀수록 더 줄이고 ③ 상한을 씌운다.
           대신 아래에서 조준 보정을 붙여, 남은 회전은 「목표에 도착하는」 감아차기가 된다. */
      const wideK=clamp(o.wideK||0, 0, 1);                       // 0=중앙 · 1=터치라인
      const farK =clamp((((o.distM||18)-14)/22), 0, 1);
      let amp=(0.13+tec*0.42)*(o.placed?1:0.42);
      amp *= 1 - wideK*0.86;                                     // 각이 없으면 감아도 안 감긴다
      amp *= 1 - farK*0.28;
      side = R()*amp;
      back = o.placed ? 0.10 : -(0.30+ (o.power||1)*0.22);       // 강슛은 톱스핀으로 떨어진다
      /* k — 슛 전용 마그누스 배율. 조준 보정이 붙으면 눈에 보이는 활 폭이 절반으로 줄어드므로,
         중앙에서의 감아차기는 예전과 같은 그림이 되도록 여기서 되돌려 준다. */
      return {side:clamp(side,-0.5,0.5), back:clamp(back,-1,1), k:2.0};
    }
    case KICK.CLEAR: case KICK.GOALKICK:
      back = 0.30 + Math.random()*0.22;                // 퍼내는 공은 백스핀이 걸린다
      side = R()*0.16; break;
    case KICK.SPACE:
      /* 🍌 스루패스도 감아 찬다 — 수비 라인의 발 끝을 피해 돌아 들어가는 공.
         감을 이유(길목의 수비수)가 있으면 크게, 없으면 기술이 만든 자연스러운 흔들림만. */
      back = o.lofted ? 0.35 : -0.25;                  // 땅으로 찔러주면 톱스핀으로 굴러 나간다
      side = o.curve ? o.curve*(0.42+tec*0.62) + R()*tec*0.14 : R()*tec*0.30;
      return {side:clamp(side,-1,1), back:clamp(back,-1,1), k:2.7};
    case KICK.PASS:
      /* 예전 패스 스핀은 유효 강도가 크로스의 1/30 수준이라 사실상 직선이었다(제보).
         이제 패스도 눈에 보이게 휜다 — 20m 지상 패스 기준 활 폭 약 1.2~1.8m. */
      back = o.lofted ? 0.28 : -0.08;
      side = o.curve ? o.curve*(0.36+tec*0.54) + R()*tec*0.13 : R()*tec*0.26;
      return {side:clamp(side,-1,1), back:clamp(back,-1,1), k:2.3};
    default: break;                                    // 스로인은 회전이 사실상 없다
  }
  return {side:clamp(side,-1,1), back:clamp(back,-1,1)};
}
/* 🎯 발사 속도 역산 — 「목표 지점에 flightT 초 뒤 닿으려면 얼마로 차야 하는가」.
   ⚠ 이걸 푸는 이유: 예전에는 공이 목표까지 lerp 로 미끄러져 갔다. 그러면 볼 물리·바운스·
      퍼스트터치는 물리 기반인데 정작 날아오는 공만 스크립트라, 도착 속도가 가짜였다.
      여기서 초기 속도만 정확히 주면 그 뒤는 전부 stepBallPhysics 가 굴린다. */
function solveLaunch(b, T, aerial, z0){
  const dx=(b.tx-b.x)*PITCH_AR, dy=b.ty-b.y;
  const D=HYP(dx,dy);
  const N=Math.max(1, Math.round(T/SIM_DT));
  /* 매 틱 감쇠가 곱해지므로 이동 거리는 등비수열의 합이다 — 역으로 풀면 초기 속도가 나온다 */
  const m = aerial ? AIR_DRAG : GRASS_FRICTION;
  const sum = (1-Math.pow(m,N))/(1-m);
  const v0 = D/Math.max(1e-6, SIM_DT*sum);
  if(D>1e-6){ b.vx=(dx/D)*v0; b.vy=(dy/D)*v0; } else { b.vx=0; b.vy=0; }
  /* 수직 — T초 뒤 정확히 땅에 닿는 초기 상승 속도 (최고점 = loftPeak(T))
     🤾 z0 를 주면 그 높이에서 출발한다 (스로인 — 머리 위에서 놓는다).
        z(T)=z0+vz·T−g·T²/2=0  →  vz = g·T/2 − z0/T */
  const _z0 = (aerial && z0>0) ? z0 : (aerial ? 0.0006 : 0);
  b.z  = _z0;
  b.vz = aerial ? Math.max(GRAVITY*T*0.18, GRAVITY*T/2 - _z0/T) : 0;
}
/* 모든 킥의 공통 초기화 — 여기를 거치지 않은 공은 없다 */
function resolveKick(b, from, type, o){
  o=o||{};
  b.sx=b.x; b.sy=b.y; b.inNet=false; b.bounced=0;
  b.flight=0;
  b.kickType=type;
  b._fromThrow = (type===KICK.THROW) ? 1 : 0;   // 손으로 던진 공 — 퍼스트터치 난이도가 다르다 (제보)
  b.spin = o.spin!==undefined ? o.spin : kickSpin(from, type, o);
  b._kickBy = from ? from.id : null;
  /* 여기서 공을 「던진다」 — 이후의 모든 움직임은 볼 물리가 맡는다 */
  solveLaunch(b, b.flightT||0.6, !!b.aerial, o.z0);
  /* 🍌 감아 차기 — 직선으로 조준해 놓고 마그누스로 휘면 목표를 벗어나기만 한다.
     실제 크로스처럼 「빗겨 차서 감아 들어오게」: 마그누스가 비행 동안 돌릴 각의 절반만큼
     초기 속도를 반대로 돌려 두면, 눈에 보이는 바나나 궤적으로 목표에 도착한다. */
  if((type===KICK.CROSS||type===KICK.PASS||type===KICK.SPACE||type===KICK.SHOT) && b.spin && b.spin.side && b.flightT){
    /* 뜬 공은 마그누스가, 구르는 공은 ROLL_CURVE 가 각을 돌린다 — 보정 공식이 다르다.
       이 보정이 없으면 스핀을 키운 만큼 패스가 그냥 목표를 벗어난다. */
    const rate = b.aerial ? MAGNUS_A*(b.spin.k||1) : ROLL_CURVE;
    const th=-0.5*b.spin.side*rate*b.flightT;
    const c0=Math.cos(th), s0=Math.sin(th);
    const nvx=b.vx*c0-b.vy*s0, nvy=b.vx*s0+b.vy*c0;
    b.vx=nvx; b.vy=nvy;
  }
  return b;
}
/* 스핀을 시간에 따라 잃는다 (공기 저항) */
function decaySpin(b){
  if(!b.spin) return;
  b.spin.side*=SPIN_DECAY; b.spin.back*=SPIN_DECAY;
  if(Math.abs(b.spin.side)<0.004) b.spin.side=0;
  if(Math.abs(b.spin.back)<0.004) b.spin.back=0;
}
/* 🎯 공이 <b>실제로</b> 떨어질 자리 ─────────────────────────────────────────
   ⚠ 지금까지 낙하점을 읽는 쪽들은 전부 b.tx/b.ty 를 봤다. 그건 <b>차는 사람이 의도한 목표</b>일 뿐
      공이 실제로 떨어지는 자리가 아니다. 예전에는 목표까지 lerp 로 미끄러뜨렸으니 둘이 같았는데,
      비행을 진짜 물리(stepBallPhysics)로 바꾸면서 <b>낙하점을 읽는 쪽들이 같이 안 고쳐졌다.</b>
   실측(2경기 · 공중볼 도착 477회) — 도착 순간 경합 반경(3.9m) 안에
      아무도 없는 경우가 <b>240회(50.3%)</b>, 2명 이상은 84회뿐.
      정작 의도한 리시버 곁에는 수비수가 중앙값 6.2m 에 붙어 있었다.
      즉 마킹이 빈 게 아니라 <b>공이 아무도 없는 곳에 떨어지고 있었다</b>.
      세컨볼 역할 점유율을 9배로 올려도 경합 성립률이 22.6% → 21.4% 로 꿈쩍하지 않은 이유다 —
      사람을 더 보내도 <b>틀린 좌표로</b> 보내고 있었다.
   ─ 지금 상태에서 z 가 0 이 될 때까지 앞으로 적분한다. stepBallPhysics 와 같은 항을 쓴다
     (중력 · 공기저항 · 마그누스 · 바람). 틱당 한 번만 계산하고 공에 캐시한다. */
const LAND_MAX_T=4.0;              // 이보다 오래 떠 있는 공은 없다 (초)
function ballLand(b, now){
  if(!b) return {x:0.5, y:0.5, t:0};
  if((b.z||0)<=0 && (b.vz||0)<=0) return {x:b.x, y:b.y, t:0};
  if(b._landT===now && b._land) return b._land;            // 틱당 1회
  let x=b.x, y=b.y, z=b.z||0, vx=b.vx||0, vy=b.vy||0, vz=b.vz||0, t=0;
  const sside=(b.spin&&b.spin.side)||0, sk=(b.spin&&b.spin.k)||1;
  const wOn=(WX_NOW.wind||0)>0.08, ww=(WX_NOW.wind||0)*0.020;
  const wcx=Math.cos(WX_NOW.wdir||0)*ww, wcy=Math.sin(WX_NOW.wdir||0)*ww;
  const N=Math.ceil(LAND_MAX_T/SIM_DT);
  for(let i=0;i<N;i++){
    if(wOn && z>0.004){ vx+=wcx*SIM_DT; vy+=wcy*SIM_DT; }
    x += vx*SIM_DT/PITCH_AR; y += vy*SIM_DT;
    const z0=z, vz0=vz;
    z += vz*SIM_DT; vz -= GRAVITY*SIM_DT;
    vx *= AIR_DRAG; vy *= AIR_DRAG;
    if(sside){
      const vh=HYP(vx,vy);
      if(vh>1e-6){ const acc=sside*MAGNUS_A*sk*vh, ox=vx, oy=vy;
        vx += (-oy/vh)*acc*SIM_DT; vy += (ox/vh)*acc*SIM_DT; }
    }
    t += SIM_DT;
    if(z<=0){
      /* 틱 안에서 닿았다 — 그 순간으로 되짚는다(한 틱에 최대 11m 를 간다) */
      const tHit = vz0<0 ? clamp(-z0/vz0, 0, SIM_DT) : 0;
      const back = SIM_DT - tHit;
      x -= vx*back/PITCH_AR; y -= vy*back; t -= back;
      break;
    }
  }
  const r={x:clamp01(x), y:clamp01(y), t};
  b._landT=now; b._land=r;
  return r;
}
function stepBallPhysics(b){
  const _px=b.x, _py=b.y, _pz=b.z||0;
  /* 🌬️ 바람 — 떠 있는 공만 민다. 롱볼·크로스·코너가 바람을 타고 흐른다 (요청) */
  if((WX_NOW.wind||0)>0.08 && (b.z||0)>0.004){
    const w=WX_NOW.wind*0.020;
    b.vx += Math.cos(WX_NOW.wdir||0)*w*SIM_DT;
    b.vy += Math.sin(WX_NOW.wdir||0)*w*SIM_DT;
  }
  /* 🥅 이번 틱을 어디서 시작했는가 — 라인을 넘었을 때 「실제로 넘은 지점」을 되짚는 데 쓴다.
     한 틱에 최대 11m를 가므로, 넘은 걸 발견했을 땐 이미 라인 한참 뒤일 수 있다 (제보) */
  b._px=_px; b._py=_py;
  b.x += b.vx*SIM_DT/PITCH_AR;
  b.y += b.vy*SIM_DT;
  if(b.z>0 || b.vz>0){                       // 공중
    const z0=b.z, vz0=b.vz;                  // 이번 틱 시작 시점
    b.z += b.vz*SIM_DT;
    b.vz -= GRAVITY*SIM_DT;
    b.vx *= AIR_DRAG; b.vy *= AIR_DRAG;
    /* 🌀 마그누스 — 회전이 만든 실제 횡력. 위치를 밀어 주는 눈속임이 아니라 가속도다. */
    if(b.spin && b.spin.side){
      const vh=HYP(b.vx, b.vy);
      if(vh>1e-6){
        const acc=b.spin.side*MAGNUS_A*(b.spin.k||1)*vh;
        const _ox=b.vx, _oy=b.vy;                 // ⚠ 갱신된 vx 를 vy 계산에 다시 쓰면 각이 틀어진다
        b.vx += (-_oy/vh)*acc*SIM_DT;
        b.vy += ( _ox/vh)*acc*SIM_DT;
      }
    }
    if(b.z<=0){                              // 이번 틱 도중에 땅에 닿았다
      // 틱이 굵어서 틱 끝의 속도를 그대로 뒤집으면 중력분이 얹혀 오히려 더 세게 튄다.
      // 땅에 "언제" 닿았는지를 풀어서, 그 순간의 하강 속도로 반사해야 바운스가 제대로 잦아든다.
      const tHit = vz0<0 ? clamp(-z0/vz0, 0, SIM_DT) : 0;
      const vHit = vz0 - GRAVITY*tHit;       // 닿는 순간의 하강 속도(음수)
      const rest = SIM_DT - tHit;            // 닿은 뒤 남은 시간
      if(Math.abs(vHit) > BALL_MINBOUNCE){
        const sp=b.spin;
        /* 🌀 스핀이 바운스를 바꾼다 — 백스핀은 튀면서 멈칫하고(혹은 되돌아오고),
           톱스핀은 튀면서 앞으로 튀어나간다. 골키퍼 앞에 떨어지는 공이 달라지는 이유. */
        /* 🌧️ 젖은 잔디는 바운스를 먹는다 — 튀지 않고 미끄러진다 */
        const up = Math.abs(vHit)*BOUNCE*(1-(WX_NOW.wet||0)*0.30)*(sp ? (1 + Math.max(0,sp.back)*0.22) : 1);
        b.vz = up - GRAVITY*rest;
        b.z  = Math.max(0, up*rest - 0.5*GRAVITY*rest*rest);
        let grip=BOUNCE_GRIP;
        /* 🎾 낙하 각도 — 가파르게 떨어진 공은 수평 속도를 크게 잃는다 (BOUNCE_STEEP 주석) */
        {
          const _vh=HYP(b.vx, b.vy);
          const _steep=clamp(Math.abs(vHit)/(Math.abs(vHit)+_vh+1e-9), 0, 1);
          grip *= (1 - _steep*BOUNCE_STEEP);
        }
        if(sp){ grip *= (1 - Math.max(0,sp.back)*BOUNCE_BACK + Math.max(0,-sp.back)*BOUNCE_TOP);
                sp.back*=0.45; sp.side*=0.72; }        // 땅에 닿으면 회전을 크게 잃는다
        b.vx *= grip; b.vy *= grip;
        b.bounced=(b.bounced||0)+1;
        /* 🥾 골킥 낙하 — 하늘 높이 떴다 떨어진 공은 첫 바운드에서 힘을 크게 잃는다.
           이게 없으면 바운드+구름이 30m를 더 가 「골킥 골」이 나온다(제보 2회, 한 경기 2골). */
        if(b.bounced<=1){
          if(b.kickType===KICK.GOALKICK){ b.vx*=0.50; b.vy*=0.50; }
          /* 🥅 걷어낸 공도 첫 바운드에서 힘을 크게 잃는다 — 옆으로 굴러 나가는 몫을 줄인다 (제보) */
          else if(b.kickType===KICK.CLEAR){ b.vx*=0.58; b.vy*=0.58; }
          else if(b.kickType!==KICK.SHOT && b.kickType!==KICK.CROSS){
            /* 38m+ 롱볼도 첫 바운드에 힘을 잃는다 — 바운드+구름이 골문까지 살아가는 「하프라인 골」 차단 */
            const _fm=HYP((b.x-(b.sx!=null?b.sx:b.x))*PITCH_AR, b.y-(b.sy!=null?b.sy:b.y))*ISO_TO_M;
            if(_fm>38){ b.vx*=0.62; b.vy*=0.62; }
          }
        }
      } else { b.z=0; b.vz=0; }
    }
  } else {                                   // 잔디 위를 구른다
    b.z=0; b.vz=0;
    /* 🌧️ 젖은 잔디 — 공이 안 먹히고 쭉 나간다 (마찰이 1에 가까워질수록 덜 감속) */
    const f = b.inNet ? NET_DRAG : (GRASS_FRICTION + (1-GRASS_FRICTION)*(WX_NOW.wet||0)*0.42);
    b.vx *= f; b.vy *= f;
    /* 🌀 사이드스핀 — 굴러가는 공이 서서히 휜다 */
    if(b.spin && b.spin.side && (b.vx||b.vy)){
      const a=Math.atan2(b.vy, b.vx*PITCH_AR) + b.spin.side*ROLL_CURVE*SIM_DT;
      const v=HYP(b.vx*PITCH_AR, b.vy);
      b.vx=Math.cos(a)*v/PITCH_AR; b.vy=Math.sin(a)*v;
    }
  }
  decaySpin(b);
  /* 🥅 골대 프레임 충돌 — 크로스·클리어·루즈볼 등 물리 궤적은 골대를 뚫지 못한다.
     (슛은 SHOT 상태의 연출 경로가 자체 woodwork 판정을 갖는다 — 이중 처리 금지) */
  if(!b.inNet && b.state!=="SHOT"){
    for(const gx of [0,1]){
      if((_px-gx)*(b.x-gx)>=0) continue;                 // 이번 틱에 골라인 평면 통과 없음
      const f=(gx-_px)/((b.x-_px)||1e-9);
      const yAt=_py+(b.y-_py)*f, zAt=_pz+((b.z||0)-_pz)*f;
      const off=Math.abs(yAt-0.5);
      const hitPost = Math.abs(off-GOAL_HALF)<GOAL_POST && zAt<CROSSBAR_Z+GOAL_POST;
      const hitBar  = off<GOAL_HALF+GOAL_POST && Math.abs(zAt-CROSSBAR_Z)<GOAL_POST*1.6;
      if(hitPost || hitBar){
        b.x = gx - Math.sign(b.x-_px)*0.0018;            // 프레임 앞(또는 뒤)에서 되튄다
        b.y = yAt; b.z=Math.max(0, zAt);
        if(hitBar){ b.vz=-Math.abs(b.vz||0.02)*POST_BOUNCE; b.vx*=-POST_BOUNCE*0.6; }
        else { b.vx*=-POST_BOUNCE; b.vy=(yAt<0.5?-1:1)*Math.abs(b.vy||0.03)*POST_BOUNCE; }
        b.bounced=(b.bounced||0)+1;
        break;
      }
    }
  }
  /* 🥅 골망 가둠 — 그물 안에 들어간 공은 뒷그물·옆그물·프레임을 뚫지 못한다 (제보: 골문 관통) */
  if(b.inNet){
    const half=GOAL_HALF-0.0015;
    if(b.x>1+GOAL_NET_DEPTH){ b.x=1+GOAL_NET_DEPTH; b.vx=-Math.abs(b.vx)*0.20; }
    else if(b.x<-GOAL_NET_DEPTH){ b.x=-GOAL_NET_DEPTH; b.vx=Math.abs(b.vx)*0.20; }
    if((b.x>1||b.x<0) && Math.abs(b.y-0.5)>half){ b.y=0.5+Math.sign(b.y-0.5)*half; b.vy*=-0.20; }
    if(b.z>CROSSBAR_Z*0.96 && (b.x>1||b.x<0)){ b.z=CROSSBAR_Z*0.96; b.vz=-Math.abs(b.vz)*0.2; }
  }
  if(HYP(b.vx, b.vy) < BALL_STOPV && b.z<=0){ b.vx=0; b.vy=0; }
}
/* 마찰로 감속하는 이동 곡선. 진행률 p(0~1)를 "이미 간 거리 비율"로 바꾼다.
   처음에 훅 나갔다가 점점 느려지는 실제 공의 모양이다. (등속 lerp 는 공이 밀려가는 느낌이 안 난다) */
const FRIC_EASE=0.45;
function frictionEase(p){ return (1-Math.pow(FRIC_EASE,p))/(1-FRIC_EASE); }
/* 체공 시간 T 동안 중력만 받는 공의 최고 높이 */
function loftPeak(T){ return GRAVITY*T*T/8; }
/* 공을 출발시킨다.
     loft>0 이면 그 시간(초)만큼 체공하는 포물선 — vz 는 왕복 시간에서 역산한다.
     loft=0 이면 지면을 구르는 공 — speed 를 그대로 초기 속도로 쓴다. */
function launchBallTo(b, tx, ty, speed, loft){
  const dx=(tx-b.x)*PITCH_AR, dy=ty-b.y;
  const D=HYP(dx,dy)||1e-6;
  b.inNet=false; b.bounced=0;
  if(loft>0){
    const T=Math.max(0.35, loft);
    b.vz = GRAVITY*T/2;                      // 올라갔다 T초 뒤 땅에 닿는다
    const v = D/T;                           // 그 사이 목표까지 간다
    b.vx = dx/D*v; b.vy = dy/D*v; b.z = 0.0008;
  } else {
    b.vx = dx/D*speed; b.vy = dy/D*speed; b.z = 0; b.vz = 0;
  }
}
/* 튕겨 나온 공 — 순간이동시키지 않고 속도를 준 뒤 마찰로 굴러 멈추게 한다.
   블록·선방·펀칭 모두 이 경로를 쓰므로, 공이 어디서 어떻게 튀는지가 눈에 보인다. */
const LOOSE_FRICTION=0.935;   // 구르며 잃는 속도
const LOOSE_STOP=0.0016;      // 이 속도 아래면 멈춘 것으로 본다
const LOOSE_PICKUP=0.024;     // 굴러가는 공을 이 거리 안에서 잡는다
/* ═══ 🤼 50:50 그라운드 경합 ═════════════════════════════════════════
   ⚠ 요청 — 「공중볼 경합은 있는데 땅볼 경합이 없다. 흐른 공에 두 명이 동시에 달려들면
      지금은 그냥 가까운 쪽이 먹는다. 힘·대담성·몸무게로 겨루고, 밀리면 파울 or 공이
      튀어 나가는 게 자연스럽다」.
   ── 설계 ────────────────────────────────────────────────────
     · 공중볼(aerialDuel)과 같은 자리에 땅볼 판을 하나 더 놓는다.
     · 세 가지 결말 — ① 이긴 쪽이 잡는다 ② 아무도 못 잡고 공이 튄다 ③ 파울
       50:50 이 늘 깨끗하게 끝나면 그게 오히려 이상하다. 실제로는 셋이 다 나온다.
     · 겨루는 축 — 몸싸움(힘·균형·체중) · 대담성 · 예측(먼저 닿기) · 퍼스트터치(수습)
       + 「누가 더 가까웠나」. 거리는 유리하지만 절대적이지는 않다. */
const GDUEL_R=0.036;          // 이 안(약 2.4m)에 양 팀이 함께 있으면 경합이다
const GDUEL_LOOSE=0.20;       // 아무도 못 잡고 공이 튀어 나갈 확률
const GDUEL_FOUL=0.13;        // 밀리는 쪽이 반칙으로 끊을 확률 (공격성으로 커진다)
const LOOSE_MAXT=6.0;         // 아무도 못 잡으면 이 시간 뒤 가장 가까운 선수에게
const LOOSE_GRACE=0.7;        // 튄 직후 — 공이 빠르고 몸이 흐트러져 아무도 잡지 못한다
const LOOSE_LEAD=0.85;        // 🏃 흐른 공 경주 — 이 초만큼 앞을 보고 달린다 (도착 예상 지점)
/* 🥾 걷어내기 착지점 상한 (공격 방향 전진도) — clearBall 주석 참고.
   0.80 = 상대 골라인에서 22m. 착지 속도 15~19m/s 인 공이 첫 바운드(×0.58)와 마찰로 죽기까지
   약 10m 를 더 가므로(실측 sp1 16.7 → sp5 1.3m/s), 이보다 앞에 떨어뜨리면 골라인을 넘는다. */
const CLEAR_LAND_MAX=0.80;
const LOOSE_AIR=1.6;          // 떠서 날아간 공이 땅에 떨어지기까지
const LOOSE_CATCH_V=0.011;    // 이 아래면 그냥 발밑에 선다 — 편하게 잡히는 공
/* 🦵 ⚠ 제보 원문 — 「공이 너무 길게, 너무 빠르게 이동한다. 아무도 못 잡고 그대로 라인 밖으로 나간다」.
   원인: LOOSE_CATCH_V 가 「잡을 수 있는 최대 속도」로 쓰이고 있었다. 0.011 은 약 3.9m/s —
      패스·걷어내기·튄 공은 흔히 15~25m/s 이므로, 사실상 <b>빠른 공은 전원이 투명인간처럼
      지나 보냈다.</b> 그래서 걷어낸 공·골킥이 아무에게도 안 걸리고 30~50m 를 굴러 라인을 넘었다
      (실측: 경기당 스로인 125회 — 실제 K리그는 40회 안팎).
      게다가 판정을 「이번 틱의 공 위치」로만 했는데, 빠른 공은 한 틱에 4~5m 를 가서
      선수 옆을 스치고 지나가도 표본에 잡히지 않았다.
   ─ 속도는 <b>차단 문턱</b>이 아니라 <b>난이도</b>다. 빠를수록 통제하기 어렵고,
     통제에 실패해도 발·정강이에 맞아 공이 죽는다. 실제 축구에서 굴러오는 공은 그렇게 멈춘다. */
const LOOSE_BLOCK_V=0.075;    // 이보다 빠르면 발을 뻗어도 못 건드린다 (약 26m/s)
/* 골키퍼의 선방 종류 */
const SAVE_TYPE={CATCH:"CATCH", PARRY:"PARRY", PUNCH:"PUNCH", TIP:"TIP"};
const DIVE_HOLD=1.1;          // 몸을 날린 뒤 일어나기까지
/* 순간 전력질주 — 평소 달리기보다 잠깐 더 빠르게 치고 나간다.
   공간으로 찔러준 패스를 쫓아갈 때, 침투할 때, 뒤에서 따라붙을 때 쓴다.
   한 번 쓰면 잠시 쓸 수 없다(체력). 빠른 선수일수록 오래·자주 쓴다. */
const BURST_MUL=1.15;        // 전력질주 배수 (🏃 사다리 개편: 1.36 → 1.15 — 스프린트 자체가 7.2 라 버스트는 8.3~10)
const BURST_DUR=2.2;         // 지속 시간(초, 능력치로 가감)
const BURST_COOL=6.5;        // 다시 쓸 수 있을 때까지
const CHASE_MAXT=4.0;
const SWEEP_EDGE=0.35;       // 스위퍼가 뒷공간 경합에서 먼저 반응하는 정도
const REACT_MIN=0.20;        // 수비 반응 지연 최소(초) — 판단력이 좋은 선수
const REACT_MAX=0.50;        // 수비 반응 지연 최대(초) — 판단력이 나쁜 선수        // 공간 패스를 쫓아가는 최대 시간
/* 몸싸움 — 선수는 점이 아니라 몸을 가진 물체다. 겹치면 서로 밀어내고,
   힘이 센 쪽이 덜 밀린다. 볼을 지키는 선수는 몸으로 버티므로 더 안 밀린다. */
const BOOKED_CAUTION=0.18;   // 경고 1장 받은 뒤의 파울 성향 배수
/* ═══════════════════════════════════════════════════════════════
   🎛️ 매치엔진 튠 — 에디터에서 조정하는 전역 배수
   1.0 = 기본. 세이브에 저장되고 에디터 데이터 파일에도 실린다.
═══════════════════════════════════════════════════════════════ */
const ME_TUNE_DEF={ shot:1, save:1, foul:1, card:1, inj:1, pen:1, trait:1 };
const ME_TUNE_INFO=[
  ["shot","슛 빈도","선수들이 얼마나 자주 때리는가. 올리면 슈팅과 골이 함께 늘어납니다."],
  ["save","선방률","골키퍼의 손. 올리면 실점이 줄어 저득점 리그가 됩니다."],
  ["foul","파울 빈도","경합에서 휘슬이 얼마나 자주 울리는가."],
  ["card","카드 엄격도","같은 반칙에 경고·퇴장이 나올 확률."],
  ["inj","경기 중 부상","자연 부상 발생 빈도."],
  ["pen","PK 선방률","페널티킥에서 키퍼가 막을 확률."],
  ["trait","특성 효과 계수","선호 플레이(특성)가 경기 판단에 얼마나 세게 묻어나는가. 0.25면 거의 무시, 4.0이면 특성이 경기를 지배합니다."]];
function meTuneFmt(v){ return (Math.round(v*100)%10===0) ? v.toFixed(1) : v.toFixed(2); }
function meTune(k){
  if(!G || !G.meTune) return 1;
  const v=G.meTune[k];
  return (typeof v==="number" && isFinite(v)) ? clamp(v, 0.25, 4) : 1;
}
function meTuneSet(k, v){
  if(!G.meTune) G.meTune=Object.assign({}, ME_TUNE_DEF);
  const n=parseFloat(v);
  G.meTune[k]=isFinite(n) ? clamp(Math.round(n*100)/100, 0.25, 4) : 1;
}
/* ⏱️ 아래 세 값은 시계 1:1 복귀(MATCH_CLOCK_SCALE 2→1)에 맞춰 절반으로 내렸다.
   축약판에서 파울 21회는 실축(약 22회)에 정확히 맞아 있던 값이라, 플레이 시간이
   2배가 되면 그대로 2배로 어긋난다. 사건당 확률을 절반으로 내려 경기당 총량을 지킨다.
   ⚠ 태클 시도 확률도 같이 내린다 — 태클 수(실축 30~40회)도 같은 이유로 2배가 되기 때문이다.
      부상은 「태클당 확률」이라 태클이 제자리로 오면 자동으로 맞는다(INJ_TACKLE_P 는 그대로). */
/* ⚠ 두 번 내렸다. ① 시계 1:1 복귀로 0.42 → 0.21 (플레이 시간이 2배가 되었으므로).
   ② 낙하점 경주(startAerialRace)로 <b>경합 자체가 2배</b>가 되면서 0.21 → 0.11.
      실측: 경합 성립 87 → 176 회 / 2경기, 그대로 두니 파울이 24 → 47 로 뛰었다.
      경합이 늘어난 건 의도한 결과이므로, 경합당 확률을 그만큼 내려 경기당 총량을 지킨다. */
/* ③ 세 번째로 내린다 — 파울 출처를 실제로 세 보니 <b>공중볼이 55.8%</b>였다.
      (3경기 계측: 공중볼 8.0 · 땅볼 경합 3.7 · 잡아채기 2.7 · 태클 파울은 거의 0)
      실축에서 공중 경합 파울은 전체의 15~20% 지 절반이 아니다.
      낙하점 경주로 경합 자체가 2배가 됐는데 확률을 덜 내린 탓이다. */
/* ⚠ 공중볼 경합이 경기당 250회나 잡히므로 이 확률 하나가 파울 총량을 지배한다
   (0.075 × 250 ≈ 19회 = 파울 30회의 3분의 2). 실축 파울 24회에 맞춰 내린다. */
const AERIAL_FOUL_P=0.036;   // 공중볼 경합에서 파울이 날 확률 (수비 히스테리시스 뒤 경합·파울이 늘어 파울 30.7(실축 24) — 다시 내린다)
const SHIRT_FOUL_P=0.0055;   // 제쳐진 수비수가 잡아챌 틱당 확률 (0.0110 → 절반)
const TACKLE_WON_FOUL=0.40;  // 「공은 따냈는데 파울」 배율 — evW.won 에 곱한다
const TAKEON_RANGE=0.042;    // 이 거리(약 2.8m) 안에서 앞을 막고 있으면 돌파 대상
/* 📏 20260913-2100 계측 — 돌파 101.7/경기(양 팀 합) = 팀당 <b>50.9</b>.
   실축(Opta) 팀당 take-on 은 18~20 회다. 2.6배 과다 — 시도율과 쿨다운을 함께 조인다. */
const TAKEON_TRY=0.0040;      // 0.040 → 0.015(102) → 0.009(72) → 0.0055(58) → 0.0040. 실축 ~40
const TAKEON_COOL=2.6;       // 같은 선수의 연속 돌파 쿨다운(초) — 1.1 은 한 장면에서 같은 선수가 너무 여러 번 붙었다
const TAKEON_POW=3.2;        // 능력치 차이를 증폭하는 지수 — 클수록 슈퍼스타가 더 압도적
const TAKEON_STAGGER=1.5;
const TAKEON_FAIL_LOSS=0.72;  // 돌파 실패 시 볼을 잃을 확률
const TAKEON_GREED=0.80;      // 실력 우위를 돌파 시도로 바꾸는 계수  // 돌파 실패 시 볼을 잃을 확률    // 제쳐진 수비수가 역동작에 걸려 있는 시간(초)
const ROLE_FWD_X=0.135;     // (참고) 예전에 앵커를 앞으로 밀던 거리
const ROLE_WIDE_Y=0.115;    // (참고) 예전에 앵커를 좌우로 옮기던 거리
const ROLE_ADV_W=1.20;      // 전진 성향이 「앞쪽 자리」에 주는 가점 (보조)
const ROLE_WID_W=1.60;      // 폭 성향이 「벌어진 자리」에 주는 가점 (보조)
/* ── 안으로 파고드는 드리블 (cut inside) ──────────────────────────────
   여태 볼 잡은 선수는 역할과 상관없이 전부 자기 앞으로만 몰고 갔다(ty=a.y 고정).
   그래서 인사이드 포워드를 세워도 드리블은 터치라인과 나란히 흘렀고,
   "오른쪽에서 안으로 접어 왼발 각을 만드는" 장면이 아예 나오지 않았다.
   cutIn 성향이 있는 선수는 전진 벡터에 안쪽 성분을 섞는다. 다만
   ① 어느 정도 전진했을 때만 ② 아직 측면에 있을 때만 ③ 안쪽 레인이 비어 있을 때만 접는다.
   중앙에 다 들어오면 offset 이 0에 수렴하므로 저절로 직진으로 돌아온다. */
const CUTIN_FROM=0.44;      // 이만큼 전진해야 접기 시작한다 (하프라인 조금 못 미쳐)
const CUTIN_FULL=0.86;      // 여기서 최대치 — 박스 모서리 부근
const CUTIN_MIN_OFF=0.085;  // 중앙에서 이 정도(약 5.8m)는 벗어나 있어야 접을 의미가 있다
const CUTIN_ANGLE=0.80;     // 전진 대비 안쪽 성분의 비 (약 39도까지)
const CUTIN_LOOK=0.11;      // 안쪽 레인을 살피는 전방 거리 (약 11m)
const CUTIN_LANE=0.13;      // 이 폭 안에 상대가 있으면 레인이 막힌 것으로 본다
const ROLE_PM_BONUS=0.42;
const ROLE_SPOT_W=9.0;      // 역할 전진 성향이 빈 공간 선택에 주는 가중치   // 플레이메이커에게 붙는 패스 우선순위 가점
const BODY_R=0.0128;         // 몸 반경 (지름 약 1.7m — 어깨 폭 + 여유)
// ── 팀 모양(shape) 튜닝 ──────────────────────────────────────────
// DISCIPLINE_SOFT : 앵커에서 이 거리(약 7m)를 넘으면 자기 자리로 되당기기 시작
// DISCIPLINE_MAX  : 되당기는 최대 비율
// DEF_DISC        : 수비 시 규율 완화 배수 (낮을수록 볼 쪽으로 모여 블록이 촘촘해진다)
// COMPACT_MAX     : 볼이 우리 박스 앞까지 왔을 때의 좌우 압축 상한
const DISCIPLINE_SOFT=0.105;  // 앵커에서 이 거리(약 7m)를 넘으면 자기 자리로 되당기기 시작
const DISCIPLINE_MAX=0.78;    // 되당기는 최대 비율
const DEF_DISC=0.80;          // 수비 시 규율 완화 배수 (낮을수록 블록이 촘촘해진다)
const COMPACT_MAX=0.76;       // 볼이 우리 박스 앞까지 왔을 때의 좌우 압축 상한
/* 🧹 패스 길목 차단 반경 배수. 스윕(선분) 판정으로 바꾸면서 0.62 → 0.53 으로 내렸다 —
   같은 반경으로 선분을 보면 차단이 117 → 143 회/경기로 늘어 패스 성공률이 실축(78~82%)
   아래로 떨어졌다. 총량은 예전 수준에 두고, 바뀌는 건 <b>어디서 끊기느냐</b>다. */
/* ⚠ 실패의 구성을 바꾼다 — 오차를 키운 만큼 인터셉트를 줄여야 총 성공률이 유지된다.
   차단 154/경기(패스의 18.6%)는 실축의 6~8배다. */
const ITC_MUL=0.27;   /* 0.53 → 0.38(차단 154→122) → 0.31. 실축 패스 성공률 80% */
const ITC_BLIND_M=3.2;        // 🧹 발끝 사각 — 찬 공이 이만큼 나가기 전에는 길목 차단이 성립하지 않는다 (2.2 →)
/* 🧹 ⚠ 폐기된 손잡이 기록 — 한때 길목 차단을 「확률 하나」로 눌렀다(ITC_REACT).
   선분 판정만 넣었을 때 차단 총량은 그대로인데(114→119) 골이 2.3 → 4.8 로 두 배가 됐고
   (상대 박스 근처 차단이 1.7 → 4.8 회/경기), 그걸 확률로 되눌렀던 것이다.
   ─ 지금은 확률이 아니라 <b>시간</b>으로 가른다(ITC_CLEAN·ITC_TOUCH·defenderTime 주석).
     확률은 「왜 끊겼는지」를 설명하지 못하고 능력치가 결과에 닿지도 않는다. */
/* 🧠 길목 읽기 — 패스가 나가는 순간 「저기로 가면 끊는다」를 알아채는 기본 확률.
   ⚠ 제보 원문 — 「수비수가 읽고 나가는 동작이 없다. 근데 이건 수비수뿐만 아니라 미드필더,
      공격수도 있어야 하는 움직임이다」.
      맞다 — 압박 나간 스트라이커가 백패스를 읽고 튀어나가는 것, 미드필더가 횡패스 길목으로
      한 발 먼저 움직이는 것이 실제 축구의 인터셉트다. 그래서 포지션을 가리지 않는다.
   ⚠ 대가도 같이 진다 — 읽고 나간 선수는 자기 자리를 <b>비운다</b>. 잘못 읽으면 그 공간이
      그대로 열린다. 그래서 「닿을 수 있을 때만」 나가고, 한 패스에 한 명만 나간다. */
/* ⚠ LANE_READ_P·LANE_READ_MARGIN 도 같은 이유로 걷어냈다 — 「읽고 나갈까」를 확률로 굴리지
   않는다. 궤적 위에서 ballTime vs defenderTime 이 가장 여유 있는 지점을 찾고,
   그 여유(slack)가 INTERCEPT / DEFLECT / PASS 를 정한다. */
/* ═══ 🧠 인터셉트 — 확률이 아니라 「시간」으로 판정한다 ═══════════════════════════════════
   요청 원문 — 「인터셉트 로직을 확률 하나로 더 세게 만드는 건 추천하지 않아. 대신
     PASS → trajectory → interception point 탐색 → 후보 수비수 → 각 수비수의 도달 시간
     → ballTime vs defenderTime → INTERCEPT / DEFLECT / PASS 로 만드는 게 맞아.
     defenderTime = distance ÷ effective speed + reaction delay + turn penalty + decision penalty」
   ─ 그 말이 맞다. 확률은 「왜 끊겼는지」를 설명하지 못하고, 능력치가 결과에 닿지도 않는다.
     아래 세 함수가 그 모델이다. 쓰이는 능력치:
       pos 수비시 위치 선정 · ant 예측력 · cnt 집중력 · dec 판단력 · acc 가속도 · pac 주력 · agi 민첩성 */
/* ⚠ 두 문턱 사이의 폭이 곧 <b>굴절의 양</b>이다. 0.16 / -0.12 로 열었더니 굴절이 경기당
   69회 — 그만큼 흐른 공이 생겼고, 그 혼전이 전부 기회로 바뀌어 선방률이 65% → 57% 로
   무너졌다. 깨끗한 차단은 수비수가 안전한 자리에서 공을 갖는 것이고, 굴절은 아무도
   못 가진 공을 만드는 것 — 둘의 값이 완전히 다르다. 창을 좁혀 굴절을 예외로 둔다. */
const ITC_CLEAN=0.06;      // 공보다 이만큼(초) 먼저 닿으면 발을 대고 <b>깔끔하게</b> 끊는다
const ITC_TOUCH=0.00;      // 이만큼까지 늦어도 발끝은 닿는다 — 굴절(DEFLECT) (-0.04 → 굴절 68회 억제)
/* ⚡ 능력치에서 나오는 상수는 경기 중 바뀌지 않는다 — 선수마다 한 번만 계산해 붙여 둔다.
   (passCutP 가 후보 하나당 여러 번 부르므로 여기서 attr20 을 매번 돌리면 그대로 렉이 된다) */
function itcConst(o){
  let c=o&&o._itcC;
  if(c) return c;
  const A=(o&&o.p&&o.p.attr)||{};
  const g=(k,fb)=>clamp(attr20(A[k]!=null?A[k]:(fb||60))/20, 0.15, 1);
  c={
    react: clamp(REACT_MAX - (g("ant",60)*0.62 + g("cnt",60)*0.38)*(REACT_MAX-REACT_MIN)*1.05,
                 REACT_MIN*0.85, REACT_MAX),
    lunge: SPD.SPRINT*(0.62+g("agi",60)*0.55+g("bal",60)*0.18),
    vTop:  SPD.SPRINT*paceMul(o),
    accK:  0.86+g("acc",60)*0.28,
    turnK: TURN_PEN_MAX*(1.25-g("agi",60)*0.55),
    decT:  DEC_PEN_MAX*(1.15-(g("dec",60)*0.58 + g("pos",60)*0.42))
  };
  try{ Object.defineProperty(o, "_itcC", {value:c, enumerable:false, writable:true, configurable:true}); }
  catch(e){ o._itcC=c; }
  return c;
}
/* 반응 지연 — 공이 발을 떠난 뒤 「지금 나가야 한다」를 알아채기까지. 예측·집중이 줄인다 */
function itcReact(o){ return itcConst(o).react; }
/* 발을 뻗어 옆으로 덮는 속도 — 전력질주와 다르다. 민첩성·균형이 정한다 */
function itcLunge(o){ return itcConst(o).lunge; }
/* 그 지점까지 실제로 걸리는 시간 (요청한 네 항의 합) */
function defenderTime(o, px, py, passer){
  const C=itcConst(o);
  const dx=(px-o.x)*PITCH_AR, dy=py-o.y, d=HYP(dx,dy);
  /* ① 거리 ÷ 실효 속도 — 짧은 거리는 최고 속도에 닿기 전에 끝난다(가속도가 여기서 갈린다) */
  const vEff=C.vTop*clamp(0.48 + (d/0.075)*0.52, 0.48, 1)*C.accK;
  /* ③ 방향 전환 — 지금 달리던 쪽과 반대로 가야 하면 그만큼 더 걸린다. 민첩성이 줄인다 */
  let turn=0;
  { const vx=(o.vx||0)*PITCH_AR, vy=(o.vy||0), sp=HYP(vx,vy);
    if(sp>1e-6 && d>1e-6) turn=(1-(vx*dx+vy*dy)/(sp*d))*0.5*C.turnK;
  }
  /* ④ 판단 — 좋은 패서는 길목을 숨기므로 그만큼 판단이 늦는다 */
  const dec=C.decT*(passer ? clamp(0.80+(passer.passSkill||0.6)*0.42, 0.80, 1.30) : 1);
  /* ② 반응 지연 + ③ + ④ + ① */
  return C.react + turn + dec + d/Math.max(1e-6, vEff);
}
const TURN_PEN_MAX=0.34;   // 완전히 반대 방향으로 몸을 돌리는 데 드는 최대 시간(초)
const DEC_PEN_MAX=0.26;    // 판단에 드는 최대 시간(초)
/* ═══ 🎯 Pass Decision Model ① — 패스 성공 확률 ════════════════════════════════════
   ⚠ 요청 원문 — 「지금 엔진은 이 요소들을 상당 부분 각각 따로 가지고 있지만, 앞으로는
      이것들을 하나의 Pass Decision Model 로 묶는 게 중요해」.
   ⚠ 가장 큰 불일치부터 없앤다 — <b>판단과 실행이 서로 다른 모델을 보고 있었다.</b>
      실행(advancePass·startLaneCut)은 defenderTime 으로 「누가 언제 그 지점에 닿는가」를
      재는데, 정작 패스를 <b>고를 때</b>는 laneBlocked 라는 스칼라 대용치를 봤다.
      그래서 엔진이 「끊길 걸 알면서 차는」 상태였다. 같은 모델을 판단에도 쓴다.
   ─ 돌려주는 값은 <b>차단당할 확률</b>(0~1)이다. 실행 쪽 문턱(ITC_TOUCH ~ ITC_CLEAN)과
     같은 자리에 중심을 둔 로지스틱이라, 예측과 결과가 같은 자를 쓴다.
   ⚠ 비용 — 경로에서 11m 밖 상대는 후보에서 빼고(대개 2~3명), 각 후보마다 3점만 훑는다. */
function passCutP(carrier, to, opps, dist, passSkill){
  const sx=carrier.x, sy=carrier.y, tx=to.x, ty=to.y;
  const L=(dist>0?dist:HYP((tx-sx)*PITCH_AR, ty-sy));
  if(L<0.04 || !opps || !opps.length) return 0;
  const T=Math.max(0.10, L/(PASS_SPEED*clamp(0.75+(passSkill||0.6)*0.45, 0.60, 1.30)));
  const tMin=Math.min(0.80, (ITC_BLIND_M/ISO_TO_M)/L);
  const dx=(tx-sx)*PITCH_AR, dy=ty-sy, L2=dx*dx+dy*dy;
  let best=-9;
  for(const o of opps){
    if(o.slot==="GK") continue;
    const ax=(o.x-sx)*PITCH_AR, ay=o.y-sy;
    let t=L2>1e-12 ? (ax*dx+ay*dy)/L2 : 0;
    t=clamp(t, tMin, 0.92);
    const gap=HYP(ax-dx*t, ay-dy*t);
    if(gap>0.14) continue;                       // 경로에서 10m 밖 — 후보가 아니다
    const C=itcConst(o);
    /* ⚠ 실행 쪽과 자를 맞춘다. 이미 길목 안(차단 반경)에 서 있는 상대에게는
       「거기까지 뛰어가는 시간」을 물리면 안 된다 — 공이 그에게로 온다.
       그때는 advancePass 와 똑같이 <b>반응 시간 vs 발 뻗기</b>로만 잰다.
       (이 구분이 없어서 1차 캘리브레이션이 「예측 5% · 실제 17.8%」로 크게 빗나갔다) */
    const ir=CTRL_RADIUS*ITC_MUL*(0.72+((o.posSkill||0.6)*0.5+(o.decSkill||0.6)*0.5)*0.56)
            *(1.30-(carrier.passSkill||0.6)*0.42);
    let slack;
    if(gap<=ir) slack = (T*t - C.react) - gap/C.lunge;
    else        slack = T*t - defenderTime(o, sx+(tx-sx)*t, sy+(ty-sy)*t, carrier);
    if(slack>best) best=slack;
  }
  if(best<=-9) return 0;                          // 경로에 아무도 없다
  return clamp(1/(1+Math.exp(-(best-0.01)/0.085)), 0, 0.97);
}
/* 차단 확률이 패스 점수를 깎는 무게. 예전의 laneBlocked*1.2 를 대신한다 —
   이건 대용치가 아니라 <b>진짜 확률</b>이므로 더 무겁게 본다. */
/* ⚠ 폐기 — 1단계에서 `- pCut*PASS_CUT_W` 로 쓰던 무게. EV 형태
   ((1−P잃음)×Value − P잃음×Risk)로 재조립하면서 이 역할이 통째로 흡수됐다. 남겨 두면
   「어딘가에서 쓰이겠지」 하고 다시 만지게 되므로 값이 아니라 기록으로 둔다.
   const PASS_CUT_W=2.40; */
const PASS_REFINE_N=5;     // 진짜 확률 모델로 다시 재는 상위 후보 수 (2단 랭킹)
/* ═══ 🎯 Pass Decision Model ⓪ — 위치 가치 (실측) ═══════════════════════════════════
   ⚠ 2단계(EV 재구성)가 실패한 원인이 여기 있었다 — <b>Value 에 단위가 없었다.</b>
      「전진 1」과 「대가 1」이 같은 자가 아닌 채로 확률과 곱하니 저울이 안 맞았고,
      계수를 손으로 맞추는 일이 되어 EV 로 묶기 전보다 오히려 나빠졌다
      (백패스 296 → 450회 · 슛 25.7 → 10.5 · 골 2.9 → 0.75).
   ─ 그래서 먼저 <b>단위</b>를 만든다. 이 표는 실측이다(8경기):
      「그 구역을 거친 소유가 골로 끝난 비율」. 행=진행도 6구간(0 우리 골문 ~ 5 상대 골문),
      열=레인 5구간. 표본이 얇은 칸의 노이즈를 피하려고, 매끈한 슛 확률(3.2% → 30.4%)을
      모양으로 삼고 전체 전환율(≈0.115)로 눈금을 맞췄다.
   ⚠ 이 값의 단위는 <b>골 확률</b>이다. 그래서 Value 도 Risk 도 같은 자를 쓴다:
        Value = V(받는 자리) − V(지금 자리)      … 성공하면 오르는 골 기대값
        Risk  = V(받는 자리를 상대 기준으로)      … 잃으면 상대가 얻는 골 기대값 */
const ZONE_V=[
  [0.0037,0.0036,0.0059,0.0026,0.0045],
  [0.0039,0.0039,0.0059,0.0037,0.0039],
  [0.0040,0.0048,0.0052,0.0039,0.0048],
  [0.0069,0.0062,0.0056,0.0061,0.0063],
  [0.0140,0.0132,0.0105,0.0108,0.0120],
  [0.0350,0.0305,0.0411,0.0322,0.0328]
];
function zoneValue(x, y, dir){
  const adv = dir>0 ? x : 1-x;
  const a = clamp(Math.floor(adv*6), 0, 5);
  const l = y<0.20?0 : y<0.40?1 : y<0.60?2 : y<0.80?3 : 4;
  return ZONE_V[a][l];
}
/* 골 확률(0~0.041)을 기존 점수 눈금으로 옮기는 배율. 좋은 전진 패스 한 번이
   대략 1.3 안팎이 되도록 잡았다 — 다른 가점들(원투 0.70, 오프사이드 −1.85)과 같은 자리. */
const EV_K=180;
const EV_NOISE=1.10;       // 🧠 판단력에 따른 EV 추정 오차의 폭 (판단력 최상 ≈0.4 · 최하 ≈1.3)
/* ═══ ⚠ 2단계(EV 재구성) 시도 기록 — 되돌렸다 ═══════════════════════════════════════
   score = P × Value − (1−P) × Risk 로 묶어 보았다. Value(전진·압박 탈출·공간·위치)와
   Risk(그 자리에서 잃는 대가)를 갈라 놓고, 성공 확률로 저울질하는 형태다.
   ⚠ 결과 — <b>팀이 후방 순환에 갇혔다.</b> EV 는 구조적으로 안전한 선택에 유리하다:
      성공 확률 0.95 짜리 백패스는 Value 를 거의 그대로 받고 대가도 거의 안 문다.
        1차(prog×1.0)  : 백패스 296 → 450회 · 슛 25.7 → 10.5 · 골 2.9 → 0.75
        2차(눌림 손실을 확률로 이관 + prog×1.45) : 백패스 345 · 슛 19.8 · 골 1.75
        3차(prog×2.10 + 전진 가치 ×1.4)          : 백패스 219 · 슛 17.8 · 골 1.0
                                                   그런데 패스 성공률 69.5% 로 붕괴
      전진 가중을 올리면 이번엔 막힌 길로 밀어 넣어 성공률이 무너진다 — 두 축을 동시에
      맞춰야 하는 보정 문제이고, n=4 로는 그 지점을 못 찾는다.
   ─ 남은 진단: EV 자체가 틀린 게 아니라 <b>Value 의 단위가 없다</b>는 게 문제다.
      「전진 1」과 「대가 1」이 같은 자가 아니라서 둘을 곱셈으로 묶으면 저울이 안 맞는다.
      다시 한다면 Value 를 <b>골 기대값(xG 증분)</b> 같은 실제 단위로 먼저 정의하고,
      그 단위로 Risk 도 재야 한다(상대에게 넘어갔을 때의 실점 기대값).
      그러면 계수를 손으로 맞출 필요가 없어진다 — 그게 이 재구성의 원래 취지였다.
   ⚠ 그 전까지는 1단계(passCutP)만 얹은 지금 형태를 유지한다. */
/* 👁️ 흐른 공을 읽는 눈 — 예측력(어디로 갈지) + 집중력(늦지 않고 반응하는지).
   0.15(최하) ~ 1.0(최상), 리그 평균 약 0.66. */
function lbAnt(p){
  const A=(p&&p.p&&p.p.attr)||{};
  return clamp((attr20(A.ant!=null?A.ant:60)*0.68 + attr20(A.cnt!=null?A.cnt:60)*0.32)/20, 0.15, 1);
}
/* ⚠ 이 값은 「시계가 2배로 흐르던 시절」 90분 기록을 채우려고 올려 둔 보정이었다.
   시계를 1:1 로 되돌린 뒤에도 남아 있어 이중 계산이 되고 있었다 → 0 으로 내린다. */
const SHOT_BIAS_ADJ=0.00;    // 슛 남발 억제 (1대1 하한선은 그대로 유지된다)
const CROSS_ADJ=0.22;         // 크로스 남발 억제 (0.30→0.42 로 조였는데, 수비가 측면에 붙기 시작하면서 크로스가 28.7회(실축 38)로 떨어져 되돌린다)   // 포지션 규율 (테스트에서 조정 가능)
const SPACING_R=0.055;       // 같은 팀끼리 유지하려는 간격 (약 3.7m) — 서로 겹쳐 뛰지 않게
const SPACING_PUSH=0.006;    // 그 간격을 지키려 목표를 옆으로 미는 힘
const PUSH_MAX=0.011;        // 한 틱에 밀려나는 최대 거리 (약 0.75m)
const SHIELD_BONUS=1.45;     // 볼을 지키는 선수가 버티는 힘
const JOSTLE_ITER=2;         // 분리 반복 횟수 — 세 명 이상 뭉쳤을 때를 풀어준다
/* 수비 AI — 능력치가 움직임의 질을 가른다.
     Positioning 낮으면 대기 상태에서 자리를 잘못 잡고,
     Decisions  낮으면 상태를 바꿀 때 멈칫하며(역동작),
     Pace       는 최고 속도와 가속에 그대로 비례한다.                       */
const ACCEL_BASE=0.080;      /* 🏃 사다리 개편: 0.172(12m/s², 0.5초면 최고속) → 0.080(5.6m/s², 7.2m/s 까지 1.3초)
   최고 속도까지 붙는 가속 (iso/s²) — 가속도(acc)로 가감. ×(67/70)
   예전 값(0.62)은 최고 속도까지 0.12초, 즉 한 틱(0.2초)도 안 걸렸다. 그래서 가속도 능력치가
   움직임에 아무런 영향을 주지 못했다 — 모든 선수가 출발과 동시에 최고 속도였다.
   0.18이면 평균 선수가 최고 속도에 붙기까지 약 0.4초가 걸린다. 짧은 거리 경합에서
   "먼저 튀어나가는 선수"가 실제로 먼저 닿는다. */
const DECEL_MUL=1.8;         // 감속은 가속보다 빠르다
/* 골키퍼의 공중볼 처리 범위 — 자기 골문에서 이만큼 안쪽으로 떨어지는 뜬 공에만 나온다.
   0.20 은 약 21m 로 페널티 박스(16.5m)보다 조금 넓다. */
const GK_CATCH_X=0.20;
const GK_CATCH_R=0.085;      // 손이 닿는 기본 반경 (약 5.8m) — 공중 장악력으로 ±30%
const GK_CATCH_P=0.62;       // 나올지 말지의 기본 적극성
const POS_ERR_MAX=0.055;     // 위치 선정이 최악일 때 벌어지는 오차 (약 3.7m)
const POS_ERR_DRIFT=0.9;     // 오차가 새로 바뀌는 주기(초)
const POS_ERR_LERP=0.10;     // 🧭 적용 오차가 새 목표 오차를 따라가는 비율(틱당) — 튀지 않고 흐른다
const HESITATE_MAX=1.0;      // 판단력이 최악일 때 멈칫하는 시간(초)
/* 🔒 수비 역할 최소 유지 시간(초) — 이 안에는 상황이 진짜로 바뀌지 않는 한 역할을 바꾸지 않는다.
   0.4초(역할 재배정 주기)의 두 배 — 「한 번은 그냥 넘긴다」는 뜻이다. */
const ROLE_DWELL=2.0;
const LINE_SYNC=0.55;        // 센터백끼리 깊이를 맞추는 정도 (1이면 완전히 일자)
/* 센터백 존 마킹 — 라인을 지키면서 자기 구역에 들어온 공격수를 잡는다 */
/* 부상 — 틱마다 뽑는 기본 확률. 자연 발생 0.2 + 태클 0.25 ≈ 경기당 0.45명(양 팀 합계).
   실제로도 경기당 강제 교체는 한 경기 걸러 한 번꼴이다. 더 올리면 스쿼드가 남아나지 않는다. */
/* ⚠ 두 번 조정했다.
   ① 처음 값(0.000022)으로는 경기당 0.00건 — 부상이 아예 없어 스쿼드 뎁스가 무의미했다.
   ② 0.0011 로 올렸더니 이번엔 「한 경기에 7명이 실려 나간다」는 제보가 왔다(실측 재현).
      경기 중 체력(fit)은 그 선수의 컨디션에서 출발한다. 컨디션 70 으로 경기에 나서면
      시작부터 위험 구간이고, 90분 뒤에는 47까지 떨어져 게이트를 통과할 때마다 절반이 다쳤다.
   ─ 게이트를 조이고, 한 번의 판정이 가질 수 있는 위험에 상한을 둔다. */
const INJ_TICK_P=0.00055;
const INJ_RISK_CAP=0.34;    // 한 번의 판정에서 넘을 수 없는 부상 확률
const INJ_MAX_TEAM=2;       // 한 경기에 한 팀에서 자연 부상으로 빠지는 최대 인원
const INJ_TACKLE_P=0.010;   // 거친 태클을 당했을 때 다칠 확률
const INJ_DOWN_SECS=6.0;    // 쓰러져 있다가 실려 나가기까지
const CB_ZONE_X=34;          // 우리 골문에서 이 거리(m) 안으로 들어온 상대만 담당한다
const CB_ZONE_Y=0.19;        // 좌우로 이만큼(약 15m) 안쪽이면 내 구역
const CB_MARK_Y=0.75;        // 담당 공격수 쪽으로 붙는 정도 (1이면 완전히 따라간다) — 0.34는 스트라이커가 반쯤 열려 있었다 · 밸런스 사이클 0.52 → 0.75
const CB_MARK_X=0.32;        // 골사이드로 파고드는 정도 — 등 뒤로 슝 지나가는 장면을 줄인다
const CB_MARK_GOALSIDE=0.026;// 담당보다 이만큼(약 2.7m) 골문 쪽에 선다
const CB_MARK_LEASH=1.35;     // 담당을 잡으러 갈 때 규율 반경을 이만큼 늘린다
const CB_ZONE_NEAR=13;       // 담당까지 이 거리(m) 안이어야 실제로 잡으러 간다 — 11m는 한 발 늦었다
/* 🧱 수비 안정화 A (수비 로직 평가 · 제보 「마킹 로직이 마음에 안 든다」 · 원칙 「CB 는 공을 쫓는 선수가
   아니라 상대 공격수가 들어올 공간을 없애는 선수」).
   실측(seed 2, 수비 국면 틱): CB 역할 전환 분당 42회, 멈칫 18%, 골사이드 48%, 존마크 대상 교체 분당 11.9회,
   수비 3분의 1 패스 수신 순간 마크율 27%. 원인은 markBest 가 아니라 그 위층 — PRESS·COVER·DROP 이
   매 틱 기억 없이 재결정되고, 존마크 대상도 매 틱 재배정돼 좋은 계산이 매 틱 지워졌다. */
const PRESS_STICK=0.32;      // 지금 압박 중인 선수는 이만큼 점수 우위를 갖는다 — 명확히 뒤지기 전엔 유지
/* 🔒 압박 전념 — 나가기로 정한 뒤 이 시간 동안은 역할이 흔들리지 않는다 (실측: 역할 전환 분당 31회) */
const PRESS_COMMIT=1.4, PRESS_COMMIT_W=1.20;
/* 🔀 압박자 «명단» 전환 비용 (슈미트 트리거).
   ⚠⚠ 떨림의 마지막 뿌리 — <b>두 척도가 서로를 모른다</b>.
      · 역할 선택(pickDef)에는 이미 히스테리시스가 있다 — intentSwitch 가 최소 유지 시간(SW_DWELL)과
        전환 마진(SW_MARGIN)을 요구한다. 그래서 LANE↔MARK 같은 <b>대형 역할끼리의</b> 전환은 얌전하다.
      · 그런데 PRESS 는 pickDef 가 정하지 않는다. 그 위의 압박자 선정 블록이 별도 척도(pressScore)로
        top-N 을 뽑고, assignDefRoles 는 그 명단을 <b>그대로 받아 적는다</b>. 즉 PRESS↔나머지 경계에는
        intentSwitch 가 아예 걸리지 않는다.
      실측 전환쌍이 정확히 그 경계에서만 대칭이었던 이유다:
        PRESS↔MARK 227/221 · PRESS↔SCREEN 141/140 · PRESS↔LINE 112/110 · PRESS↔DROP 120/115
      (대형 역할끼리의 쌍은 이 목록에 없다 — intentSwitch 가 막고 있다.)
   ─ 명단 문턱을 <b>사람마다 다르게</b> 준다. 나가 있던 사람은 더 내려가야 물러나고(PR_EXIT),
     안 나가 있던 사람은 더 올라와야 나간다(PR_ENTER). 점수가 문턱 위에서 진동해도 명단은 안 바뀐다. */
const PR_ENTER=0.22, PR_EXIT=0.30;
/* 🔀 압박 점수 저역통과 — 틱 잡음은 죽이고 추세만 남긴다. 전환 29.4 → 26.3.
   ⚠ 🚫 0.22(더 세게)는 전환을 23.2 까지 내렸지만 <b>측면 깊은 곳 물러남이 10.8% → 14.1%</b> 로
      나빠졌다. 너무 매끄럽게 하면 멀리 있는 사람의 점수가 천천히 떠올라 압박자로 뽑히고,
      달려오다 다시 천천히 가라앉아 되돌아간다 — 정원 래치 때와 <b>정확히 같은 실패</b>다.
   ─ 이 계열의 교훈: 안정화를 세게 걸수록 <b>먼 사람이 개입</b>하고, 그게 화면의 왕복이 된다. */
const PRESS_SMOOTH=0.35;
const ROLE_STICK=0.35;       // 압박자 자리를 빼앗으려면 그 자리 사람보다 이만큼 나아야 한다
const HOLE_STICK=0.30;       // 지금 COVER/COVER_WIDE 인 선수는 같은 구멍을 계속 맡는다
const CB_ZONE_KEEP_Y=1.25;   // 존마크 유지 — 구역 폭의 이 배수 안이면 대상을 바꾸지 않는다
const CB_ZONE_KEEP_D=1.35;   // 존마크 유지 — CB_ZONE_NEAR 의 이 배수 안이면 대상을 바꾸지 않는다
const CB_PRESS_NEAR=0.085;   // CB 가 압박을 나가는 건 캐리어가 이 안(약 6m)으로 들어왔을 때뿐 — 스토퍼의 한 발
/* 🧱 수비 B — CB 구역 책임 (원칙: 「CB 는 공을 쫓는 선수가 아니라 상대 공격수가 들어올 공간을 없애는 선수」).
   A 단계(유지 보너스·게이트)로는 핵심 지표가 안 움직였다(압박 23%·마크 거리 6.2m·수신 순간 5.8m).
   추적: 볼이 우리 진영 중간일 때 두 CB 가 COVER ↔ COVER_WIDE(점을 향한 역할)를 매 틱 맞바꿨고,
   공이 날아가는 동안(carrier 없음)은 「볼에 가장 가까운 사람」이 압박자라 패스마다 CB 가 PRESS 가 됐다.
   ─ CB 는 역할 경합에서 뺀다. 기본 상태 = LINE + 존마크(구역 점유자 추적). 예외는 셋:
       PRESS(캐리어가 CB_PRESS_NEAR 안) · BLOCK_SHOT(슛 임박) · SECOND(뜬 공이 내 구역에 떨어짐).
     COVER·COVER_WIDE·DROP 은 CB 에게 주지 않는다 — 측면 빈 자리는 셰이프 매니저의 폭 재분배가 이미 맡는다.
     MARK 는 「내 구역 점유자」에게만 — 밀착이 필요할 때 LINE 에서 MARK 로 올라가는 자세 변화다. */
/* 🧷 마킹 방식 (세부 전술) — 예전에는 상수 하나로 못 박혀 있었다("false 면 예전 경합으로
   되돌아간다 — 비교 실험용"). 두 모드가 이미 구현돼 있는데 감독이 못 골랐다.
     지역 방어 : CB·풀백이 자기 구역을 지킨다. 형태가 안 깨지는 대신 좋은 선수를 자유롭게 둔다.
     대인 방어 : 상대를 따라간다. 플레이메이커를 지우지만 끌려다니며 공간을 내준다.
   marking 0~2 (기본 1). 1.05 미만이면 지역, 그 위면 대인 쪽으로 간다. */
function zoneMarkOn(T){ return !T || T.marking==null || T.marking < 1.05; }
const MARK_STICK=0.22;       // 잡고 있던 대상 유지 가점 (markBest)
/* 🧱 수비 B-2 — 풀백·윙백의 측면 구역 책임. CB 를 압박에서 빼자 그 몫이 풀백에게 갔다
   (실측 FB PRESS 11 → 19%, 마크 48 → 41%, 골사이드 45 → 33%). 같은 원칙을 측면에 적용한다:
   풀백의 구역은 자기 측면이다. 중앙·반대쪽 캐리어는 미드필더의 일이고, 비워진 중앙 앵커(마크 나간 CB 의
   자리)를 메우러 가는 건 자기 윙어를 버리는 일이다. */
const FB_SIDE_MIN=0.05;      // 내 측면 판정 — 중앙선에서 이만큼(약 3.5m) 넘어오면 내 쪽
const FB_PRESS_NEAR=0.085;   // 내 측면이 아닌 캐리어는 이 안(약 6m)일 때만 압박
const TARGET_SMOOTH=0.16;    // 목표 위치를 따라가는 속도 — 낮을수록 부드럽고 덜 떤다
const TARGET_JUMP=0.30;      // 목표가 이만큼(약 20m) 넘게 튀면 스무딩을 포기하고 즉시 따라간다
/* 🧭 블록 기준점(bRef) — 「자리 역할의 목표를 볼이 아니라 구역에 고정」(요청).
   실측(빌드 0500, 스무딩 뒤 목표 좌표의 이동 속도): BALANCE 4.5m/s · LINE 4.1 · WIDE 4.3 · DEEP 5.6 —
   자리를 지키는 역할의 목표가 선수(2.2~2.7m/s)보다 빨리 움직였다. 원인: blockShift·compactY·goalSideX·
   셰이프가 전부 <b>지금 볼 좌표</b>의 1차 함수라, 패스가 15m/s 로 날아가면 목표가 5~6m/s 로 따라 흘렀다.
   저역통과(TARGET_SMOOTH)는 램프 입력에 지연만 줄 뿐 속도는 못 줄인다. 그래서 선수당 17km.
   ─ 팀마다 볼을 관성 있게 따라가는 기준점을 둔다. 공이 <b>정착</b>(SETTLED)했을 때만 따라가고, 날아가는
     동안은 멈춘다(블록은 결과를 보고 움직인다). 시간상수 ≈1.6초, 2m 안은 무시. 자리 역할(LINE·COVER·
     SCREEN·DROP·BACKFILL·COVER_WIDE / BALANCE·WIDE·HALF·DEEP·HOLD·OUTLET)만 이 점을 본다 —
     PRESS·MARK·LANE·BLOCK_SHOT·SECOND·달리기 의도는 진짜 볼을 본다. 세트피스면 즉시 맞춘다. */
const BREF_K=0.08;           // 틱당 추종 비율 — 공격 국면 (SIM_DT/τ, τ≈2.5초) — 4라운드 0.125 → 0.08
const PHASE_BLEND_K=0.10;    // 국면 혼합값 추종 (틱당) — τ≈2초
const BLOCK_SHIFT_K=0.20;    // 블록 깊이 이동 = (기준점 x − 0.5) × 이 값 — 4라운드 0.38 → 0.26 → 0.20(13.3km 에서 2차)
const BREF_K_DEF=0.17;       // 수비 국면 (τ≈1.2초) — 패스를 읽고 움직인다 (4라운드 2차 0.22 → 0.17)
/* 🦶 발 데드존 — 자리 역할은 목표가 이 안이면 서 있는다(들어가는 문턱/나오는 문턱) */
const DEF_DEAD_IN=1.1, DEF_DEAD_OUT=2.8;
const DEF_CHASE_ROLES={PRESS:1, JOCKEY:1, SECOND:1, RECOVER:1, BLOCK_SHOT:1};
/* 🎯 목표 저역통과 — 자리 역할 τ≈0.45초 · 볼 추격 역할 τ≈0.15초 · 이 거리(m) 밖이면 평활 안 함 */
const TGT_SM_K=0.35, TGT_SM_CHASE=0.72, TGT_SM_FAR=14;
/* 🧭 위험 방향 혼합 — 상대가 달리고 있으면 그 방향의 길목을 우선한다 */
const MARK_V_MIN=0.0035, MARK_V_W=0.70, PRESS_V_W=0.40;
const MARK_JOG_GAP=1.6;      // 🚶 마크 자리를 이 안까지 잡았으면 걷는다 — 아니면 뛴다
const MARK_LEAD=0.80;        // 🔮 담당의 이 시간 뒤 위치를 기준으로 자리를 잡는다
const MARK_SPD_K=1.06;       // 🏃 마커는 담당 속도의 이 배수까지 낸다 (자리를 잡아야 하니 조금 더)      // 🚶 마크 자리를 이 안까지 잡았으면 걷는다 — 아니면 뛴다
/* 🪽 윙어 압박 — 이 바깥·이 깊이면 「전진 통로 앞」을 막는다 · 안쪽 치우침 · 간격 배수 */
/* 📏 압박 강도 → 간격 배수 (압박 자제 = HI · 극한 압박 = LO) */
const PRESS_GAP_HI=7.4, PRESS_GAP_LO=1.0;
const WING_Y=0.26, WING_X=0.44, WING_IN=0.72, WING_STAND=1.35, WING_MIN=0.040;
const PRESS_LEAD=0.45;       // 🔮 캐리어의 이 시간 뒤 위치를 기준으로 압박 자리를 잡는다
const PRESS_BODY_D=0.036;    // ⚽ 공이 발에서 이 안(약 2.5m)이면 «사람»을 기준으로 압박한다
const BREF_DEAD=0.045;       // 이 안(약 3m)의 볼 이동은 블록을 움직이지 않는다 — 4라운드 2 → 3m
const POS_SMOOTH=0.06;       // 자리 역할의 목표 스무딩 (기본 TARGET_SMOOTH 0.16) — 3라운드 0.08 → 0.06
const POS_HOLD=0.085;        // 자리 역할은 목표에서 이 거리(약 6m) 안이면 버틴다 — 4라운드 4.5 → 6m
const POS_SETTLE=0.043;      // 자리 역할의 도착 판정(약 3m) — 기본 TARGET_DEAD 0.7m 까지 붙지 않아도 선다
const DZ_OWN=0.36;           // 🚨 위험 구역 — 수비 국면에 볼이 우리 골문에서 이 전진도 안이면 (약 40m)
const POS_HOLD_DZ=0.036;     // 🚨 위험 구역의 자리 역할 버팀 반경 (약 2.5m)
                             /* 실측(4라운드 3차): 거리 13.3km 중 2~5m/s 구간이 6.1km, 2m/s 미만은 1.7km 뿐 —
                                선수가 「서 있는」 시간이 없었다(실제는 시간의 60%가 걷기). 버팀 반경이 곧 서 있는 시간이다. */
const POS_SPOT_DEAD=0.085;   // 자리 역할의 빈자리 재선택 불감대 (약 6m)
const DEF_POS_ROLES={LINE:1, COVER:1, SCREEN:1, DROP:1, BACKFILL:1, COVER_WIDE:1};
const OFF_POS_ROLES={BALANCE:1, WIDE:1, HALF:1, DEEP:1, HOLD:1, OUTLET:1};
const TARGET_DEAD=0.011;     // 이보다 가까우면 미세 조정을 하지 않는다 (약 0.7m)
/* ── 도착 감속 ──────────────────────────────────────────────
   예전에는 목표에 닿는 순간 a.spd 를 0 으로 내리쳤다. 0.2초 틱이라 조깅 중이던 선수가
   한 틱 만에 3m/s → 0 이 되고, 다음 틱에 앵커가 조금 움직이면 다시 0 에서 가속한다.
   그래서 "가다 서다 가다 서다"가 선수당 분당 30번 가까이 나왔다.
   이제는 남은 거리에 비례해 목표 속도를 낮추고(=감속해서 도착), 멈출 때도 서서히 죽인다. */
const ARRIVE_R=0.045;        // 이 거리(약 3m)부터 속도를 줄이기 시작한다
const ARRIVE_MIN=0.18;       // 다 와서도 이만큼은 남겨 둔다 (완전히 얼어붙지 않게)
/* 자리를 잡은 뒤에는 목표가 조금 흔들려도 따라가지 않는다.
   앵커는 공을 따라 매 틱 조금씩 움직이므로, 이게 없으면 제자리에서 몸만 빙글빙글 돈다. */
const TARGET_HOLD=0.036;     // 자리 잡은 뒤 이 거리(약 2.5m) 안에서는 버틴다 (🚶 4라운드 1.7 → 2.5m)

const TURN_RATE=6.0;         // 몸이 돌아가는 속도(rad/s) — 순간적으로 방향을 꺾을 수는 없다
/* ═══════════════════════════════════════════════════════════════
   🧭 Player Local Space — 공을 "선수 기준 상대 좌표"로 관리한다
   월드 좌표만 쓰면 선수가 돌 때 공을 따로 계산해 옮겨야 하고, 그러다 보면
   공이 순간이동하거나 몸 뒤로 넘어가는 그림이 나온다.
   공의 위치를 (선수 정면 기준 앞뒤 fwd, 좌우 lat)로 들고 다니면
   몸이 돌 때 공은 자동으로 같은 호를 그린다.
     월드 = 선수 위치 + 회전(선수 방향) × 로컬 오프셋
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   🎯 Receive Target — "선수가 공을 어디에서 받을 것인가"
   그동안은 수신자가 전술 자리만 지키고 있었고, 공이 알아서 그 자리로 갔다.
   이제는 공의 예상 경로 위에서 받을 지점을 고르고, 거기로 얼마나 적극적으로
   움직일지(Movement Intent)를 정한다. 짧은 패스는 기다리고, 스루패스는 달린다.
═══════════════════════════════════════════════════════════════ */
const RCV={ NONE:"RECEIVE_NONE", WAIT:"RECEIVE_WAIT", ADJUST:"RECEIVE_ADJUST",
            TO_BALL:"RECEIVE_MOVE_TO_BALL", BACKPEDAL:"RECEIVE_BACKPEDAL",
            LATERAL:"RECEIVE_LATERAL", RUN_ONTO:"RECEIVE_RUN_ONTO_BALL", CONTEST:"RECEIVE_CONTEST" };
/* 공이 t초 뒤에 어디에 있을까 — 비행 중인 패스는 목표 지점으로 수렴한다 */
function predictBall(b, t){
  if(b.state!=="PASS") return {x:b.x, y:b.y};
  const total=b.flightT||0.6, now=b.flight||0;
  const p=clamp01((now+t)/Math.max(1e-6,total));
  const e=(typeof frictionEase==="function")?frictionEase(p):p;
  return {x: b.sx+(b.tx-b.sx)*e, y: b.sy+(b.ty-b.sy)*e};
}
/* 선수가 d(iso) 만큼 가는 데 걸리는 시간 — 가속도와 현재 속도를 고려한다 */
function travelTime(a, d){
  const vmax=SPD.SPRINT*paceMul(a);
  const acc=ACCEL_BASE*accMul(a);
  const v0=clamp((a.spd||0), 0, vmax);
  /* 가속 구간 + 등속 구간 */
  const tAcc=Math.max(0,(vmax-v0)/Math.max(1e-6,acc));
  const dAcc=v0*tAcc + 0.5*acc*tAcc*tAcc;
  if(d<=dAcc){ return (Math.sqrt(Math.max(0,v0*v0+2*acc*d))-v0)/Math.max(1e-6,acc); }
  return tAcc + (d-dAcc)/Math.max(1e-6,vmax);
}
/* 🎯 받을 지점과 이동 의지 계산 */
function calcReceiveTarget(a, b, opps, mates){
  if(b.state!=="PASS") return null;
  const left=Math.max(0, (b.flightT||0.6)-(b.flight||0));
  const land=predictBall(b, left);                        // 공이 최종적으로 닿을 지점
  const dLand=HYP((land.x-a.x)*PITCH_AR, land.y-a.y);
  const A=(a.p&&a.p.attr)||{};
  const g=(k)=>clamp(attr20(A[k]!=null?A[k]:60)/20, 0.15, 1);
  const dec=g("dec"), vis=g("vis"), fir=g("fir");
  /* 압박 — 뒤에서 붙는 상대가 있으면 공을 먼저 잡으러 간다 */
  let nd=9, no=null;
  for(const o of (opps||[])){ if(o.slot==="GK") continue;
    const d=HYP((o.x-a.x)*PITCH_AR, o.y-a.y);
    if(d<nd){ nd=d; no=o; } }
  const press=clamp(1-nd/0.10, 0, 1);
  /* 상대가 먼저 닿는가 — 낙하 지점까지의 도착 시간 비교 */
  let oppT=9;
  for(const o of (opps||[])){ if(o.slot==="GK") continue;
    const od=HYP((o.x-land.x)*PITCH_AR, o.y-land.y);
    const tt=travelTime(o, od); if(tt<oppT) oppT=tt; }
  const myT=travelTime(a, dLand);
  const race=clamp((oppT-myT)/0.8, -1, 1);                // +면 내가 여유, -면 상대가 먼저
  /* 이동 의지 (0~1) */
  let intent=0;
  intent += clamp(dLand/0.09, 0, 1)*0.42;                 // 멀수록 가야 한다
  intent += press*0.30;                                    // 압박받으면 먼저 잡으러
  intent += clamp(-race, 0, 1)*0.34;                       // 상대가 먼저 닿을 것 같으면
  intent += (b._through?0.45:0);                           // 스루패스는 달려 들어간다
  intent += (fir-0.55)*0.14;                               // 퍼스트터치가 좋으면 앞에서 받는다
  intent -= (dec-0.55)*0.10*(dLand<0.05?1:-1);             // 판단력: 가까우면 덜 움직이고 멀면 더 간다
  intent = clamp(intent, 0, 1);
  /* 상태 판정 */
  const fwdAxis = a.dir>0 ? 1 : -1;
  const relX=(land.x-a.x)*fwdAxis, relY=land.y-a.y;
  let st;
  if(b._through && intent>0.35) st=RCV.RUN_ONTO;
  else if(oppT<myT && nd<0.12) st=RCV.CONTEST;
  else if(intent<0.16) st=RCV.WAIT;
  else if(dLand<0.030) st=RCV.ADJUST;
  else if(relX < -0.012) st=RCV.BACKPEDAL;
  else if(Math.abs(relY)>Math.abs(relX)*1.6) st=RCV.LATERAL;
  else st=RCV.TO_BALL;
  /* 받을 지점 — 기본은 낙하 지점. 압박이 있으면 공 쪽으로 당겨 먼저 만나고,
     스루패스는 공보다 조금 앞(진행 방향)에서 만난다. */
  let tx=land.x, ty=land.y;
  if(st===RCV.RUN_ONTO){
    const bd=HYP((b.tx-b.sx)*PITCH_AR, b.ty-b.sy)||1e-6;
    tx=land.x+((b.tx-b.sx)/bd)*0.018; ty=land.y+((b.ty-b.sy)/bd)*0.018;
  } else if(st===RCV.CONTEST || press>0.5){
    /* 상대보다 먼저 — 공의 현재 위치 쪽으로 당겨서 만난다 */
    const meet=predictBall(b, Math.max(0, left*0.55));
    tx=lerp(land.x, meet.x, 0.6+press*0.3); ty=lerp(land.y, meet.y, 0.6+press*0.3);
  }
  return {x:clamp01(tx), y:clamp01(ty), intent, state:st, myT, oppT, dLand, land};
}
/* ⚽ 볼 컨트롤 상태 — "공에 닿았다"와 "공을 소유했다" 사이의 단계를 이름으로 갖는다.
   b.state(FREE/PASS/SETTLED/LOOSE/SHOT)는 공 자체의 물리 상태이고,
   이쪽은 "받는 선수 관점"의 상태다. 디버그 표시와 판정 분기에 쓴다. */
const BC={ FREE:"BALL_FREE", APPROACH:"BALL_APPROACHING", ORIENT:"RECEIVE_BODY_ORIENTATION",
           CONTACT:"RECEIVE_CONTACT", TOUCH:"FIRST_TOUCH", CONTROLLED:"BALL_CONTROLLED", DRIBBLE:"DRIBBLE" };
function ballToLocal(b, a){
  const rx=(b.x-a.x)*PITCH_AR, ry=b.y-a.y;
  const f=a.face||0, ca=Math.cos(-f), sa=Math.sin(-f);
  return {fwd: rx*ca-ry*sa, lat: rx*sa+ry*ca};
}
function localToWorld(loc, a){
  const f=a.face||0, ca=Math.cos(f), sa=Math.sin(f);
  const rx=loc.fwd*ca-loc.lat*sa, ry=loc.fwd*sa+loc.lat*ca;
  return {x: clamp01(a.x+rx/PITCH_AR), y: clamp01(a.y+ry)};
}
/* 🧠 드리블 판단 — 이번 터치를 어떻게 할 것인가.
   상황(공간·압박·속도)과 능력치를 보고 상태·터치 거리·방향·간격을 정한다. */
function decideDribble(a, b, opps, t){
  const A=(a.p&&a.p.attr)||{};
  const g=(k)=>clamp(attr20(A[k]!=null?A[k]:60)/20, 0.15, 1);
  const drib=(a.dribSkill||0.6), tec=g("tec"), dec=g("dec"), bal=g("bal"), agi=(a.agility||0.6);
  const pace=(a.paceSkill||0.6), acc=(a.accelSkill||0.6);
  const spN=clamp(HYP((a.vx||0)*PITCH_AR,(a.vy||0))/(SPD.SPRINT*SIM_DT), 0, 1.2);
  const f=(a.face===undefined)?0:a.face;
  /* 가까운 상대 · 진행 방향 앞의 공간 */
  let nd=9, no=null, front=9;
  for(const o of (opps||[])){
    if(o.slot==="GK") continue;
    const dx=(o.x-a.x)*PITCH_AR, dy=o.y-a.y, d=HYP(dx,dy);
    if(d<nd){ nd=d; no=o; }
    /* 진행 방향 ±35° 안에 있는 상대까지의 거리 = 앞 공간 */
    if(d>1e-6){
      const ang=Math.atan2(dy,dx); let df=ang-f;
      while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
      if(Math.abs(df)<0.61 && d<front) front=d;
    }
  }
  /* 골라인까지의 거리도 공간의 한계 */
  const toLine=(a.dir>0 ? (1-a.x) : a.x)*PITCH_AR;
  const spaceM=Math.min(front, toLine)*67;
  const oppM=nd*67;
  const press=clamp(1-nd/PRESS_R, 0, 1);
  /* ── 상태 결정 ── */
  let st=DRB.NORMAL;
  const canKnock = spaceM>=KNOCK.SPACE_M && oppM>=KNOCK.OPP_M && spN>=KNOCK.MIN_SPD
                && (t-(a._knockAt||-99))>KNOCK.COOL;
  if(press>0.60) st=DRB.PROTECT;          // 1.4m 안까지 붙었다 — 몸으로 가린다
  else if(press>0.34) st=DRB.SHORT;       // 3.5m 안 — 짧게 끊어 친다
  /* 🎯 슛을 원하는 선수는 공을 차놓지 않는다 — 짧게 잡아 발밑에 붙인다 (골라인 치달 제보) */
  else if(a._wantShot && t-a._wantShot<1.6) st=DRB.SHORT;
  else if(canKnock){
    /* 치달 판단 — 판단력·주력·가속이 좋을수록 자주, 그리고 상대와의 경합을 이겨야 한다 */
    const p=clamp(0.03 + (dec-0.55)*0.22 + (pace-0.55)*0.26 + (acc-0.55)*0.20
                  + clamp((spaceM-KNOCK.SPACE_M)/18,0,1)*0.16, 0, 0.34);
    if(Math.random()<p) st=DRB.KNOCK;
    else st=(spN>0.72)?DRB.FAST:DRB.NORMAL;
  }
  else if(spaceM<7) st=DRB.SHORT;
  else if(spN>0.72) st=DRB.FAST;
  /* ── 터치 거리(m) ── */
  let distM;
  if(st===DRB.KNOCK){
    const q=clamp((drib*0.4+tec*0.3+pace*0.3), 0.15, 1);
    distM=KNOCK.DIST_M[0]+(KNOCK.DIST_M[1]-KNOCK.DIST_M[0])*q;
    distM=Math.min(distM, Math.max(2.5, spaceM*0.55));      // 공간보다 멀리 차진 않는다
  } else if(st===DRB.PROTECT) distM=0.35+spN*0.20;
  else if(st===DRB.SHORT)     distM=0.42+spN*0.42;
  else if(st===DRB.FAST)      distM=0.85+spN*0.95;
  else                        distM=0.55+spN*0.70;
  distM *= (1.30-drib*0.45);                                 // 드리블이 좋으면 더 가까이
  /* 골라인·수비 코앞에서는 남은 공간의 60%보다 길게 차지 않는다 — 골문 안까지 몰고 가는 그림 방지 */
  distM = Math.min(distM, Math.max(0.4, spaceM*0.6));
  /* ── 터치 방향 ── */
  let ang=f;
  if(st===DRB.PROTECT && no){
    /* 상대 반대쪽으로 빼서 몸으로 가린다 */
    const away=Math.atan2(a.y-no.y, (a.x-no.x)*PITCH_AR);
    let df=away-f; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
    ang=f+clamp(df,-1.1,1.1)*0.75;
    st=DRB.PROTECT;
  } else if(press>0.34 && no){
    /* 압박 중 — 상대 쪽으로는 밀지 않는다 */
    const away=Math.atan2(a.y-no.y, (a.x-no.x)*PITCH_AR);
    let df=away-f; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
    ang=f+clamp(df,-0.9,0.9)*0.35*press;
  }
  /* 기술이 낮으면 터치 방향이 흔들린다 */
  ang += (Math.random()-0.5)*(1-tec)*(st===DRB.KNOCK?0.30:0.16);
  /* ── 터치 간격 ── */
  let iv=DRIB_TOUCH*(0.75+Math.random()*0.5);
  if(st===DRB.SHORT||st===DRB.PROTECT) iv*=0.55-agi*0.12;
  else if(st===DRB.FAST) iv*=1.15;
  else if(st===DRB.KNOCK) iv*=1.9;
  /* ── 치달 품질 — 나쁘면 공이 더 멀리, 더 옆으로 간다 ── */
  if(st===DRB.KNOCK){
    const q=clamp(drib*0.35+tec*0.35+bal*0.30, 0.15, 1);
    distM *= (1.35-q*0.45);
    ang += (Math.random()-0.5)*(1-q)*0.34;
  }
  return {state:st, distM, ang, iv, spaceM, oppM, press, spN};
}
/* ⚽ Receiving Orientation — 패스를 받는 선수가 몸을 어디로 여는가.
   공만 마주 보면 받고 나서 다시 돌아야 한다. 실제 선수는 공이 오는 동안 이미
   "다음에 갈 방향"으로 몸을 열어 두고, 그 자세로 받아 그대로 나간다.
     · 들어오는 공 방향 — 일단 마주 봐야 받을 수 있다
     · 가고 싶은 방향   — 빈 공간·상대 골문 쪽
     · 압박 반대 방향   — 수비수가 붙으면 등지고 공을 보호한다
   판단력·시야가 좋을수록 "다음 방향"의 비중이 커진다(미리 열어 둔다). */
function receivingOrientation(a, b, opps, dir){
  const faceBall=Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR);
  const A=(a.p&&a.p.attr)||{};
  const g=(k)=>clamp(attr20(A[k]!=null?A[k]:60)/20, 0.15, 1);
  const smart=(g("dec")*0.55+g("vis")*0.45);
  /* 가고 싶은 방향 — 기본은 상대 골문 쪽, 압박이 있으면 그 반대쪽으로 연다 */
  let want = dir>0 ? 0 : Math.PI;
  let nd=9, no=null;
  for(const o of (opps||[])){ if(o.slot==="GK") continue;
    const d=HYP((o.x-a.x)*PITCH_AR, o.y-a.y);
    if(d<nd){ nd=d; no=o; } }
  let shield=0;
  if(no && nd<0.085){
    shield=clamp(1-nd/0.085, 0, 1);
    want=Math.atan2(a.y-no.y, (a.x-no.x)*PITCH_AR);   // 수비수 반대쪽
  }
  /* 남은 비행 시간이 길수록 "다음 방향"을 미리 잡고, 도착이 임박하면 공을 확실히 마주 본다 */
  const left=Math.max(0, (b.flightT||0.6)-(b.flight||0));
  const early=clamp(left/0.55, 0, 1);
  const w=clamp((0.20+smart*0.42+shield*0.25)*early, 0, 0.72);
  let df=want-faceBall;
  while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
  let f=faceBall+df*w;
  if(f>Math.PI) f-=Math.PI*2; else if(f<-Math.PI) f+=Math.PI*2;
  return f;
}
/* 몸을 목표 방향으로 "회전 속도만큼만" 돌린다. 어디서든 face 를 직접 대입하지 말고 이걸 쓴다 —
   직접 대입하면 한 틱에 180° 뒤집혀 화면에서 휙휙 도는 것처럼 보인다. */
function turnToward(a, want, mul){
  if(a.face===undefined){ a.face=want; return 0; }
  let df=want-a.face;
  while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
  const mt=TURN_RATE*SIM_DT*(mul||1)*(0.60+(a.agility||0.6)*0.80);
  a.face += clamp(df, -mt, mt);
  if(a.face>Math.PI) a.face-=Math.PI*2; else if(a.face<-Math.PI) a.face+=Math.PI*2;
  return Math.abs(df);
}
/* ═══════════════════════════════════════════════════════════════
   ⚽ 드리블 — "공을 소유하고 이동한다"가 아니라 "터치의 연속"
   매 터치마다 상황을 다시 보고 어떤 드리블을 할지 정한다.
     좁은 공간·압박  → 짧은 터치 (공을 발밑에)
     넓은 공간·고속  → 긴 터치 (공을 앞에 두고 달린다)
     아주 넓은 공간  → 치달(Knock-and-Run) — 공을 멀리 차 놓고 따라간다
     상대가 붙음     → 공 보호 (반대쪽으로 빼서 몸으로 가린다)
   모든 값은 여기서 튜닝한다.
═══════════════════════════════════════════════════════════════ */
const DRB={
  SHORT:"SHORT_TOUCH", NORMAL:"NORMAL_DRIBBLE", FAST:"FAST_DRIBBLE",
  KNOCK:"KNOCK_AND_RUN", PROTECT:"PROTECT_DRIBBLE", ESCAPE:"ESCAPE_DRIBBLE",
  RECOVERY:"RECOVERY_DRIBBLE", TURN:"TURN_DRIBBLE"
};
const KNOCK={
  SPACE_M: 18,        // 앞에 이 정도(m) 공간이 있어야 치달을 생각한다
  OPP_M: 5.5,         // 가까운 상대가 이보다 멀어야 한다
  MIN_SPD: 0.55,      // 이 속도(최고 속도 대비) 이상으로 달리고 있어야 한다
  DIST_M: [3.0, 5.9], // 차 놓는 거리 (m) — 능력에 따라 (7.5→6.6→5.9, 제보 반영)
  COOL: 5.0           // 연속으로 치달하지 않도록 쉬는 시간(초)
};
/* 🏃‍♂️ 뒷걸음질(백페달) — ⚠ 요청 원문 「선수들이 공을 바라보면서 뒷걸음질 치는 무빙을
   구현해보자. 이게 사실 수비에 필요한 움직임이잖아?」 맞는 말이다. 수비는 공을 시야에서
   놓치는 순간 무너진다 — 실제 수비수는 물러설 때 몸을 돌리지 않고 뒤로 밀려난다.
   지금까지는 골키퍼만 이렇게 움직였고(GK_TURN_DIST 아래 로직), 필드 플레이어는 물러설 때
   등을 보이며 달렸다. 같은 원리를 수비 진영 전체로 넓힌다.
   ⚠ 무조건은 아니다 — 먼 거리를 되돌아가야 하면 실제로도 몸을 돌려 전력질주한다. */
/* 🧍 몸 방향 요동 (제보 원문 — 「선수들이 서있을때 방향이 앞보다가 뒤보다가 하던데」, 「상대진영에 있을때
   센터백들이 상대진영을 바라보고있어야하는데 서있을때 뒤돌아서고 왔다갔다 한다」).
   실측(빌드 1900, seed 1): 저속(<1.2m/s) 상태의 몸 회전량 평균 29°/s, CB 는 42°/s — 서 있는데 몸이 계속 돈다.
   원인 셋: ① 몸 방향이 「이동 방향(want)」을 따르는데, 정지 판정(TARGET_DEAD)이 0.7m 라 스무딩된 목표가
      선수 앞뒤 1~2m 를 오가면 want 가 180° 씩 뒤집혔다. ② 뒤로 반걸음 물러설 때 공을 마주 본 채 백스텝하는
      규칙(백페달)이 수비 쪽에만 있어, 공격 시 센터백은 반걸음 물러설 때마다 몸을 통째로 돌렸다.
      ③ 완전히 서 있는 선수(버팀·정지)는 face 갱신이 전혀 없어 마지막 이동 방향(뒤돌아선 채)으로 굳었다.
   ─ 백페달을 양 국면으로 확장하고, 서 있는 선수는 천천히 공 쪽으로 몸을 연다. */
const BACKPEDAL_SEE=0.47;    // 공이 이 안(약 32m)에 있을 때만 — 그보다 멀면 볼 필요가 없다
const BACKPEDAL_MAX=0.105;   // 물러설 거리가 이보다 멀면(약 7m) 몸을 돌려 달린다
/* ⚠ 14m 였을 때의 문제 — 저지(JOCKEY) 수비수는 목표가 볼에 묶여 있어, 드리블러가 전력질주로
   밀고 들어오면 계속 「뒤로 걷는」 상태에 갇힌다. 백페달은 정면 달리기보다 느리니 그대로 벗겨진다.
   실제 수비도 뒷걸음질은 한두 걸음이고, 벌어지면 몸을 돌려 따라간다. 발동 거리를 절반으로 줄여
   「자리를 잡고 버티는 구간」에서만 뒷걸음질하게 한다 — 벌어지는 순간 자동으로 달리기로 넘어간다. */
const BACKPEDAL_ANG=0.35;    // 진행 방향이 공에서 이만큼(π 기준) 벗어나야 백페달로 본다
const BACKPEDAL_PEN=0.42;    // 옆·뒤로 갈 때 속도 손실 계수 (사이드스텝 0.79배 · 백페달 0.68배)
const PRESS_R=0.052;         // 이 거리 안(약 3.5m)의 상대를 압박으로 본다
const GK_KEEP_M=2.6;         // 🧤 공을 통제 중인 키퍼에게서 상대가 떨어져 있어야 하는 거리(m)
const DRIB_TOUCH=0.8;        // 드리블 터치 간격(초) — 이때마다 공을 앞으로 툭 차 놓는다
const DRIB_LEAD=0.026;       // 툭 찬 공이 앞서 나가는 거리 (약 1.7m)
/* 🛑 「뒤에 있는 공을 염력으로 끌어당기며 드리블한다」 — 제보가 계속 들어온 장면.
   원인은 두 갈래였다.
   ① 로컬 오프셋 추종 — 공의 월드 좌표를 매 틱 「선수 기준 상대 위치」에서 다시 계산했다.
      선수가 달리면 그 프레임이 통째로 따라가므로, 등 뒤에 있는 공도 같이 끌려갔다.
   ② 따라가기 감쇠(_follow)의 하한이 0.10이었다. 완전히 뒤에 있는 공도 선수 속도의 10%로,
      살짝 뒤에 있으면 80~90%로 함께 움직였다. 발이 닿지 않는 공이 계속 붙어 다닌 이유다.
   ─ 이제 공이 시선 뒤로 넘어가는 순간 「정리(settle)」에 들어간다.
     선수는 그 자리에 서고, 몸을 공 쪽으로 돌리고, 공은 시선 앞 한 발 지점으로만 온다.
     공이 화살표 앞에 설 때까지 추종·터치·치달은 전부 멈춘다. 끌고 갈 방법 자체를 없앤다. */
/* ⚠ 제보 — 「드리블하는 선수에게 수비수가 붙으면 둘이 자석처럼 드드드 떨면서 같이 딸려간다」.
   염력 드리블을 막으면서 넣은 「정리(settle)」가 원인이었다. 실측해 보니
     · 드리블 프레임의 40%가 정리 상태였고(사실상 절반은 멈춰 서 있었다)
     · on/off 가 346회 튀었다 — 공 쪽으로 돌면 정리 해제, 골대 쪽으로 돌면 다시 정리…
   그 자리에서 완전히 멈추니(spd=0) 붙어 있던 수비수와 겹치고, 겹친 몸을 떼어내는
   separateBodies 가 매 틱 서로를 밀어내면서 둘이 함께 떠는 그림이 됐다.
   ─ 「멈춰 선다」를 버린다. 실제 선수처럼 속도를 줄이고 공 쪽으로 걸어가며 정리한다.
     조건도 「조금이라도 뒤」에서 「확실히 등 뒤」로 좁히고, 최소 지속·재진입 대기를 둔다. */
const SETTLE_IN    = -0.50*DRIB_LEAD;   // 확실히 등 뒤(약 0.9m)로 넘어갔을 때만
/* 🦶 공이 몸과 함께 가는 기준은 「앞이냐 뒤냐」가 아니라 「발이 닿느냐」다.
   ⚠ 앞뒤로만 갈랐더니 두 가지가 번갈아 망가졌다 —
     · 뒤면 무조건 따라오게 두면 몇 미터 뒤의 공을 끌고 달린다(염력, 최초 제보)
     · 뒤면 무조건 안 따라오게 두면 공이 늘 뒤처져 「시선 뒤」 프레임이 26%까지 튄다
   실제로는 서 있는 발 옆·반보 뒤의 공은 몸과 함께 가고, 발이 닿지 않는 공은 남는다.
   거리로 가른다 — 그게 물리적으로도 맞고, 두 문제를 동시에 없앤다. */
const FOLLOW_REACH = 1.35/ISO_TO_M;   // 이 안의 공은 몸과 함께 간다 (약 1.35m)
const FOLLOW_GONE  = 2.60/ISO_TO_M;   // 이보다 멀면 전혀 따라오지 않는다
const CARRY_REACH  = 1.60/ISO_TO_M;   // 몸 회전을 따라 도는 것도 발이 닿는 범위까지만
const SETTLE_OUT   =  0.45*DRIB_LEAD;   // 넉넉히 앞서야 해제 — 히스테리시스를 넓게
const SETTLE_REACH =  DRIB_LEAD*4.2;    // 이보다 멀면 정리가 아니라 「놓친 공」 — 쫓아간다
const SETTLE_MIN   =  0.6;              // 한번 들어가면 최소 이만큼은 유지 (초) — 깜빡임 방지
const SETTLE_MAX   =  1.6;              // 안전장치 — 이 이상 끌지 않는다(초)
const SETTLE_COOL  =  2.0;              // 정리를 마치면 이 시간 동안은 다시 들어가지 않는다(초)
const SETTLE_PULL  =  2.6;              // 공을 끌어오는 최대 속도 (m/s) — 발을 뻗는 속도
const BALL_ROLL_FRICTION=0.91;   // 드리블 터치로 민 공도 조금 더 굴러간다
const CROSS_BLOCK_R=0.055;  // 이 거리 안의 수비수는 크로스를 발로 막을 수 있다
const CROSS_BLOCK_P=0.72;   // 코앞에 붙었을 때의 차단 확률

/* 슈터에서 본 골문 — 거리와 "골문이 열려 보이는 각도"를 함께 구한다.
   각도는 정면 가까이일수록 넓고, 골라인 옆으로 밀려날수록 0에 수렴한다. */
function shotGeom(a){
  const gx = a.dir>0 ? 1 : 0;
  const dx = (gx-a.x)*PITCH_AR, dy = 0.5-a.y;
  const dist = HYP(dx, dy);
  // 각도는 "골문까지의 거리"로만 결정된다. dx 의 부호(공격 방향)를 그대로 넣으면
  // 왼쪽으로 공격하는 팀에서 atan2 가 ±π 를 넘나들며 각이 5.7rad 같은 값으로 망가진다.
  const fwd = Math.max(1e-6, Math.abs(dx));
  const a1 = Math.atan2((0.5-GOAL_HALF)-a.y, fwd);
  const a2 = Math.atan2((0.5+GOAL_HALF)-a.y, fwd);
  return {dist, distM:dist*ISO_TO_M, gx, angle:Math.abs(a2-a1)};
}

/* 슛 경로를 막고 선 상대 — 슈터와 골문을 잇는 통로 안에 있는 선수만 센다.
   경로상의 진행률(t)로 그 지점의 통로 중심을 구하고, 거기서 얼마나 벗어났는지를 본다. */
function shotLaneBlockers(a, opps, g, widenK){
  /* 🧱 밀집 사이클(제보 후속) — widenK: 통로 폭 1~2.1배 사이의 「옆 몸」을 프린지(fr)로 함께 담는다.
     결정 층은 기존 폭 그대로(널 전달) — 실행(resolveShot)만 넓혀, 몸이 늦게 걸어오는 현실을 재현.
     계측: 텐백 상대 통로 안 몸 있는 슛 결정률 0~10%(모델 정상), 통로 빈 슛이 경기당 10~14개·최대 50% — 여기가 구멍. */
  const list=[]; let near=0, far=0;
  const span=(g.gx-a.x)*a.dir;
  if(span<=1e-6) return {near, far, list};
  /* ⚠ 슛각 점검(요청) — 통로 이탈량을 「수비수 x 에서의 y 차이」로 쟀다. 정면 슛이면 그게 수직
     거리지만, 비스듬한 슛은 통로가 기울어 실제 수직 거리 = Δy·cosθ 다. 측면 20m·전방 9m
     (θ≈66°)에서는 0.41배 — 통로 안에 서 있는 수비수를 2.5배 넓은 잣대로 걸러 「통로가 비었다」고
     봤다. 이 값이 evaluateShot 의 통로 보너스(+0.45)·1대1 하한선(nb)·resolveShot 의 블록 확률에
     전부 들어가므로 측면 슛은 판단에서 과대평가되고 실행에서 덜 막혔다(빌드 1630 윙 자리 슛 폭발의
     두 번째 원인). 통로 벡터에 투영해 등방 좌표의 진짜 수직 거리를 쓴다 — 정면 슛은 결과가 같다.
     off 의 단위는 그대로(등방 y 단위 = BLOCK_W 의 단위)라 bl.off/BLOCK_W 소비자들은 손대지 않는다. */
  const _lx=(g.gx-a.x)*PITCH_AR, _ly=0.5-a.y, _L=HYP(_lx,_ly)||1e-6;
  const _ux=_lx/_L, _uy=_ly/_L;
  for(const o of opps){
    if(o.slot==="GK") continue;
    const along=(o.x-a.x)*a.dir;
    if(along<=-0.012 || along>=span) continue;         // 슈터 뒤 또는 골라인 너머 (바로 앞에 붙은 수비수는 포함)
    const _px=(o.x-a.x)*PITCH_AR, _py=o.y-a.y;
    const off=Math.abs(_px*_uy-_py*_ux);               // 통로에서의 수직 거리 (등방)
    const _lim=BLOCK_W*(widenK||1);
    if(off>_lim) continue;
    const d=HYP((o.x-a.x)*PITCH_AR, o.y-a.y);
    const _fr=(off>BLOCK_W)?1:0;
    list.push({o, d, off, fr:_fr});
    if(!_fr){ if(d<0.09) near++; else far++; }
  }
  list.sort((x,y)=>x.d-y.d);
  return {near, far, list};
}

/* 슛을 때릴 만한 상황인지 — 패스·크로스와 같은 점수 척도로 돌려준다.
   각이 열려 있고, 가깝고, 앞을 막은 사람이 없고, 마무리가 좋을수록 점수가 높다. */
/* ⚡ 「그대로 때릴까, 한 번 잡을까」 ────────────────────────────────────────
   제보 원문 — "아마 원터치 슈팅 로직때문에 그럴거야. 이것도 선수가 판단해서
   슈팅때리게하자."
   ⚠ 크로스·공중볼이 박스에 도착하면 <b>고정 확률로 즉시 슛</b>이었다
      (0.68~0.90 + 헤딩*0.20~0.26 → 사실상 80~100%). 판단이 한 톨도 없었다.
      그 결과가 실측으로 나왔다 — 캐리어가 <b>박스 안에 있는 시간이 전체의 0.6%</b>,
      골에어리어(6.5m) 안은 <b>0회</b>. 박스 안 슛이 전부 첫 터치 슛이라
      「잡았다가 넣기」·「한 명 제치고 마무리」가 구조적으로 안 나왔다.
   ─ 축구에서 그대로 때리는 이유는 셋이다:
       ① 상대가 붙어 있어 <b>잡을 시간이 없다</b>
       ② 공이 높이 떠 있어 <b>애초에 잡을 수 없다</b>
       ③ 각이 좋고 가까워 <b>때리는 게 최선이다</b>
     셋 다 아니면 한 번 잡는 게 맞고, 그 판단을 하는 게 판단력·침착성이다.
   ⚠ 크로스는 그대로 크로스로 남는다 — 뜬 공은 ②에 걸려 여전히 헤더로 간다.
      바뀌는 건 <b>낮은 크로스·컷백·땅으로 흐른 공</b>이다. 그게 정확히
      「박스 안에서 잡고 마무리」가 나와야 할 상황이다. */
function firstTouchShoot(a, g, ball, opps, base){
  let nd=9;
  for(const o of opps){ if(o.slot==="GK") continue;
    const d=HYP((o.x-a.x)*PITCH_AR, o.y-a.y); if(d<nd) nd=d; }
  const press = clamp(1 - nd/0.075, 0, 1);                       // 5m 안이면 1 에 수렴
  const awk   = clamp((ball.z||0)/0.016, 0, 1);                  // 높이 뜬 공은 못 잡는다
  const chance= clamp(g.angle/0.50, 0, 1) * clamp(1-(g.distM-6)/14, 0, 1);
  const dec   = clamp(a.decSkill!=null?a.decSkill:0.6, 0.15, 1.2);
  const cmp   = clamp(attr20(((a.p&&a.p.attr&&a.p.attr.cmp)!=null?a.p.attr.cmp:60))/20, 0.15, 1);
  /* 잡을 여유 — 압박도 없고, 공도 쉽고, 기회도 애매할 때만 커진다.
     그 위에 판단력·침착성이 곱해진다. 상한 0.55. */
  const hold = clamp((1-press)*(1-awk)*(0.60-chance*0.50)*(0.55+dec*0.45+cmp*0.35), 0, 0.55);
  return Math.random() < base*(1-hold);
}
function evaluateShot(a, opps, ctx){
  if(a.slot==="GK") return null;
  const g=shotGeom(a);
  if(g.distM>SHOT_MAX_M || (g.gx-a.x)*a.dir<=0.01) return null;
  const blk=shotLaneBlockers(a, opps, g);
  // 몸에 붙은 상대까지의 실제 거리. pressureOn 은 6.7m 밖까지 압박으로 세기 때문에
  // "눈에는 여유로운데 코드는 압박 심함"으로 판단하는 어긋남이 생긴다.
  let nearOpp=9;
  for(const o of opps){
    if(o.slot==="GK") continue;
    const d=HYP((o.x-a.x)*PITCH_AR, o.y-a.y);
    if(d<nearOpp) nearOpp=d;
  }
  const skill = g.distM>20 ? (a.lngSkill||0.6) : (a.finSkill||0.6);   // 판단(때릴까 말까)용
  // 천재성이 높으면 먼 거리에서도 과감하게 때린다 (FM: Flair → 중거리·과감한 시도 성향)
  const flairBonus = g.distM>20 ? ((a.flair||0.6)-0.6)*0.55 : 0;
  let q = clamp(g.angle/0.55, 0, 1.4) * (0.50+skill*0.80);
  q *= 1 - clamp(g.distM/SHOT_DIV, 0, 0.85);
  // 통로 수비수 — "몇 명이냐"가 아니라 "얼마나 가깝냐"로 깎는다.
  // 명수로 세면 5m 앞의 한 명 때문에 아예 안 쏘는 이분법이 된다.
  const nb = blk.list.length ? blk.list[0].d : 9;      // 가장 가까운 통로 수비수까지
  /* 👁️ 예측력 — 제보 원문: 「상대 수비수의 태클 타이밍이나 골키퍼의 각도 좁히기를
     예측해, <b>반 박자 빠른 슈팅 타이밍</b>을 잡는 데 기여한다」.
     ⚠ 슛 판단에 예측력이 한 번도 안 들어갔다. 통로 수비수 감점이 <b>지금 거리</b>로만
        매겨지는데, 예측이 좋은 선수는 그가 <b>닿기 전에</b> 놓는다. 감점을 그만큼 줄인다.
        평균(0.6)에서 계수 ≈0.95 라 전체는 거의 그대로, 눈 좋은 선수만 반 박자 빠르다. */
  const _antA=clamp(attr20(((a.p&&a.p.attr&&a.p.attr.ant)!=null?a.p.attr.ant:60))/20, 0.15, 1);
  q -= clamp(1 - nb/0.105, 0, 1)*0.42*(1.28-_antA*0.55);   // 코앞이면 크게, 7m 밖이면 0
  q -= Math.max(0, blk.list.length-1)*0.10;            // 겹겹이 서 있으면 추가 감점
  /* 🧊 침착성 — 압박을 받을 때만 갈린다. 제보 원문의 FM 모델:
     「골키퍼와 1대1 이거나 수비수의 압박이 강할 때, 패닉에 빠지지 않고 냉정하게
      타이밍을 잴 수 있는 확률을 높여 준다」.
     ⚠ 여태 cmp 는 finSkill(0.34)·lngSkill(0.20) 안에 섞여 <b>상시</b> 작동했다.
        그러면 아무도 없는 데서 여유롭게 차는 슛에도 침착성이 붙는다 —
        침착성은 그런 능력이 아니다. <b>압박에 곱한다.</b> 평균(0.6)에서 계수 ≈1 이라
        전체 균형은 그대로 두고, 강심장과 유리멘탈만 갈린다. */
  const _cmpA=clamp(attr20(((a.p&&a.p.attr&&a.p.attr.cmp)!=null?a.p.attr.cmp:60))/20, 0.15, 1);
  q -= clamp(ctx.selfPress||0, 0, 2)*0.11*(1.35-_cmpA*0.62);
  const TR=a.tr||{};
  // 특성: 중거리 슛 선호/자제, 득점보다 패스 선호
  const trShot = FX(a,"shoot")*1.0 + (g.distM>20 ? FX(a,"longShot")*0.75 : 0) + FX(a,"firstTimeShot")*0.22;
  let score = q*SHOT_GAIN + SHOT_BIAS + SHOT_BIAS_ADJ + flairBonus + trShot + ((ctx.mentality||1)-1)*0.06;
  /* 🧠 판단력 — 「지금 슛이 최선인가」. 제보 원문:
     「판단력이 낮으면 무리한 각도에서 난사하거나, 타이밍을 놓쳐 수비에게 차단당한다」.
     ⚠ 여태 슛 <b>타이밍 판단</b>에 판단력(dec)이 한 번도 안 들어갔다.
        결정력·중거리·천재성·특성·전술·기하는 다 보는데 정작 「이게 좋은 선택인가」를
        재는 능력치가 없었다. 그래서 판단력 5짜리와 18짜리가 같은 자리에서 같이 쐈다.
     ─ 좋은 각·가까운 거리에서는 누구나 쏜다. 갈리는 건 <b>나쁜 상황</b>이다.
       그래서 기회의 나쁨(_bad)에 곱한다 — 좋은 찬스는 아무도 접지 않는다. */
  {
    const _dec=clamp(a.decSkill!=null?a.decSkill:0.6, 0.15, 1.2);
    const _bad=clamp(1 - q/0.55, 0, 1);        // 기회가 나쁠수록 1 에 가깝다
    score -= (_dec-0.60)*_bad*0.85;
  }
  /* 👁️ 키퍼가 나오는 중이면 각이 닫히기 전에 놓는다 — 예측력이 그 반 박자를 만든다 */
  {
    const _gk=opps.find(o=>o.slot==="GK");
    if(_gk && g.distM<26){
      const _out=Math.abs(_gk.x-g.gx)*PITCH_AR*ISO_TO_M;      // 골라인에서 나온 거리(m)
      if(_out>3.5) score += clamp((_out-3.5)/8, 0, 1)*(_antA-0.50)*0.55;
    }
  }
  score += Math.log(meTune("shot"))*0.55;   // 🎛️ 에디터 튠 — 1.0이면 0
  // ── 중거리 슛 — 감독의 지시가 "때릴까 한 번 더 만들까"를 가른다.
  //    거리 감점(q에 이미 반영)에 눌려 박스 밖 슛이 거의 안 나오던 것을 여기서 되살린다.
  if(g.distM>16.5){
    const ls=clamp(ctx.longShot===undefined?1:ctx.longShot, 0, 2);
    /* ⚠ 제보 — 「하프라인 근처 장거리 골이 너무 많다」.
       예전엔 far 를 1.4에서 잘라 감쇠 폭이 0.42밖에 안 됐다. 40m 슛도 25m 슛과
       거의 같은 값을 받아, 감독이 「중거리 적극」이면 아무 데서나 때렸다.
       거리가 멀수록 그 지시의 값이 빠르게 사라지도록 한다. */
    const far=clamp((g.distM-16.5)/12, 0, 2.6);          // 16.5m→0 · 28.5m→1 · 47m→2.6
    /* 28.5m 까지는 예전 그대로 둔다 — 감독이 「중거리 적극」이면 박스 앞에서는 여전히 때린다.
       그 밖으로 나갈수록 지시의 값이 빠르게 사라진다. */
    const lsDecay = far<=1 ? (1-far*0.30) : Math.max(0.05, 0.70-(far-1)*0.44);
    const skDecay = far<=1 ? 1            : Math.max(0.15, 1-(far-1)*0.55);
    score += lsLerp(LS_PREF,ls)*lsDecay + ((a.lngSkill||0.6)-0.6)*lsLerp(LS_SKILL,ls)*skDecay;
    // "자제" 쪽으로 밀수록 통로가 열려 있어도 굳이 때리지 않는다 (⚠ 재계측 — 0.25→0.36)
    if(ls<0.5) score -= 0.36*(1-ls*2);
  }
  /* 🎯 28m 밖 — 프로 선수는 여기서 그냥 때리지 않는다. 때린다면 이유가 있다:
     골키퍼가 골문을 비우고 나와 있을 때다. 그 명분이 없으면 거리만큼 값을 깎는다. */
  if(g.distM>28){
    let gkOff=0;
    try{ const _gk=opps && opps.find(o=>o.slot==="GK");
         if(_gk) gkOff=Math.abs(_gk.x-g.gx)*PITCH_AR; }catch(e){}
    const excuse=clamp((gkOff-8)/10, 0, 1);              // 8m 나와 있으면 0 → 18m면 1
    score -= (g.distM-28)*0.075*(1-excuse*0.85);
  }
  // 앞이 완전히 비었고 골문이 가까우면 키퍼와의 1대1이다. 이때 옆으로 빼주는 축구 선수는 없다.
  // 다른 계수를 어떻게 조정하든 이 상황만은 흔들리지 않도록, 더하는 보너스가 아니라 점수의 하한선으로 둔다.
  // "경로가 비었다"만으로는 부족하다 — 몸에 붙은 수비수까지 없어야 진짜 키퍼와의 1대1이다.
  // 앞이 비었고 몸에 붙은 상대도 없다 — 눈으로 보면 명백한 찬스다. 반드시 때린다.
  // 몸을 던져 막을 만큼 붙은 수비수가 없다(blk.near===0)면, 통로 멀리 서 있는 수비수는
  // 사람 눈에도 "막혔다"고 보이지 않는다. 이걸 통로 완전 비움으로만 좁게 보면 찬스를 흘린다.
  // 통로에 사람이 "있냐 없냐"가 아니라 "발을 뻗어 막을 만큼 붙었냐"로 본다.
  // 4m 앞의 수비수 하나 때문에 아예 안 쏘는 건 축구가 아니다.
  /* ⚠ 제보 「슛이 과하긴 하군」(빌드 1630, 리드 패스 추격을 살린 뒤 슛 31 → 58/경기).
     실측(seed=2): 늘어난 슛 대부분이 골문 각 0.30rad(17°) 미만 — 10회 → 27회, 그중 17회는
     0.20rad(11°) 미만. 결과는 빗나감 18·유효 8·골 1. 쏜 자리는 측면 20m·전방 9m 같은 윙 자리.
     원인: 이 하한선 조건에 <b>각이 없었다</b>. 「앞이 비었고 몸에 붙은 상대가 없다」만 보고
        24m 안이면 무조건 0.70+ 를 줬다 — 골문이 8° 로 보이는 터치라인 옆에서도 「키퍼와 1대1」.
        리드 패스가 윙어를 그 자리로 자유롭게 보내기 시작하자 그대로 터졌다.
     ─ 골문이 보여야 1대1 이다. SHOT_1V1_ANGLE 미만이면 하한선을 주지 않는다(아래 통로 보너스만). */
  /* 📏 20260913-1700 계측 — SHOT_BIAS 를 0.71 올렸는데 슛이 2.3 밖에 안 줄었다(36.4→34.1).
     이유가 여기 있다: 일반 경로의 슛 점수는 q·SHOT_GAIN + SHOT_BIAS ≈ <b>-0.9</b> 라
     사실상 아무도 그 길로는 쏘지 않는다. 슛은 거의 전부 이 하한선에서 나온다 —
     즉 <b>이 블록이 슛 수도꼭지다.</b> SHOT_BIAS 를 만지는 건 장거리 슛만 건드린다.
     거리별 실측(n=6): 0-11m 9.3 · 11-18m <b>17.0</b> · 18-24m 5.3 · 24-31m 2.7
     11~18m 가 절반이다. 실축은 이 구간이 7 안팎 — 「박스 앞에 자유롭게 도착해서 그냥 때린다」.
     ─ 몸 공간·통로 문턱을 올리고, 하한선이 거리를 따라 훨씬 가파르게 떨어지게 한다. */
  if(nb>0.068 && g.distM<24 && nearOpp>0.055 && g.angle>=SHOT_1V1_ANGLE){
    let _floor = 0.30 + clamp((24-g.distM)/24,0,1)*1.15;
    /* 🎯 「득점보다는 패스」 — 예전에는 이 하한선이 특성을 통째로 덮어써서, 패스를 선호하는
       선수도 박스 안이면 무조건 때렸다(특성이 화면에만 있고 움직임에는 닿지 않았다).
       골문 앞 확실한 기회(7m 안)는 그대로 때리되, 박스 밖 어정쩡한 각에서는 동료를 먼저 본다. */
    const _lfp=Math.max(0, -FX(a,"shoot"));
    if(_lfp>0) _floor -= _lfp*clamp((g.distM-7)/12, 0, 1)*1.30;
    score = Math.max(score, _floor);
  }
  // 슛 통로가 통째로 비어 있다는 건 그 자체로 큰 기회다.
  // 이걸 작게 보면 "앞이 비었는데도 옆으로 빼주는" 장면이 계속 나온다.
  else if(blk.list.length===0)               score += 0.45;
  else if(blk.near===0)                      score += 0.30;   // 몸으로 막을 만큼 붙은 수비수가 없다
  /* 🎯 컷백을 받아 놓은 공 — 실축에서 이 자리는 <b>때리는 자리</b>다.
     ⚠ 위의 「키퍼와 1대1」 하한선은 몸에 붙은 상대가 없어야(nearOpp>3.7m) 성립한다.
        그런데 컷백은 <b>정의상</b> 수비가 등을 보이며 따라 들어오는 상황이라 늘 누군가 가깝다.
        그래서 그 하한선이 한 번도 걸리지 않았고, 받은 선수는 매번 옆으로 빼 줬다
        (실측: 컷백을 받은 5.33회 중 3.67회가 슛 없이 끝났다).
        컷백이 무서운 이유는 공간이 아니라 <b>수비가 반대쪽을 보고 있다</b>는 것이다 —
        몸 거리 대신 <b>슛 통로</b>만 본다.
     ⚠ 이 블록은 반드시 위 if/else 사슬 <b>뒤</b>에 있어야 한다. 사이에 끼우면 아래 두
        `else if` 가 이 조건에 붙어 버려, 1대1 하한선 위에 통로 보너스가 겹쳐 얹힌다. */
  if(ctx.cutback && g.distM<22 && g.angle>=0.18){
    score = Math.max(score, 0.95 + clamp((22-g.distM)/22, 0, 1)*0.55
                                 - clamp(1-nb/0.075, 0, 1)*0.45);
  }
  return {g, q, score, clear:blk.list.length===0, near:blk.near, nearOpp};
}
   // 페널티 박스 (공격 방향 기준)
/* 세트피스 세리머니 — 공을 가져다 놓고, 뒤로 물러났다가, 달려와서 찬다.
   각 단계의 지속 시간(초). 골킥이 가장 길고 스로인이 가장 짧다. */
const SETPIECE_PHASES={
  //  dead: 공이 죽어 있는 시간(회수·주심 신호) · place: 공을 놓는다 · backoff: 물러난다 · approach: 달려와 찬다
  goalKick: {dead:3.4, place:1.3, backoff:1.5, approach:0.7},
  freeKick: {dead:3.2, place:1.0, backoff:1.2, approach:0.6},   // 상대가 9.15m 물러날 시간
  /* ⚡ 코너킥 — 실제로는 센터백이 60m를 달려 올라올 때까지 기다린다(30초 넘게 걸리기도 한다).
     5.5초로는 수비수가 박스에 도착조차 못 해, 코너 타깃의 46%가 수비수인데 헤더 슛은 0회였다. */
  corner:   {dead:8.5, place:1.2, backoff:1.3, approach:0.6},
  throwIn:  {dead:1.2, place:0.9, backoff:0.6, approach:0.2},
  // 페널티킥 — 판정 시비, 키커 지정, 박스 비우기까지 시간이 오래 걸린다.
  // 물러나는 거리도 길고(런업), 그만큼 천천히 달려와 찬다.
  penalty:  {dead:5.0, place:2.2, backoff:2.0, approach:1.1}
};
/* ── 페널티킥 ──────────────────────────────────────────────────
   피치는 105m × 67m를 [0,1]²로 정규화한 것이다(x 1칸 = 105.4m, y 1칸 = 67m).
   그래서 실제 규격을 그대로 좌표로 옮길 수 있다. */
const PEN_MARK_M=11.0;                       // 골라인에서 페널티 마크까지
const PITCH_LEN_M=ISO_TO_M*PITCH_AR;         // ≈105.4m
const PEN_SPOT_ADV=1-PEN_MARK_M/PITCH_LEN_M; // 공격 진행도 기준 페널티 마크 x ≈ 0.896
const SP_KEEPOUT_M=9.15;                     // 규칙상 이격 거리
/* 키커·골키퍼를 제외한 20명이 물러나 서는 자리(공격 방향 기준).
   전부 박스 밖(adv<0.83)이면서 페널티 마크에서 9.15m 넘게 떨어진 지점이다.
   실제 경기처럼 양 팀이 아크 주변에 섞여 선다. */
const PEN_WAIT=[
  [0.800,0.30],[0.800,0.70],[0.788,0.38],[0.788,0.62],[0.775,0.46],
  [0.775,0.54],[0.805,0.22],[0.805,0.78],[0.758,0.34],[0.758,0.66],
  [0.745,0.50],[0.732,0.42],[0.732,0.58],[0.720,0.26],[0.720,0.74],
  [0.700,0.50],[0.688,0.38],[0.688,0.62],[0.665,0.46],[0.665,0.54]
];
/* 실제 페널티 성공률은 75% 안팎이다. 키커의 페널티 능력치가 성공률을 크게 가르고
   (약체 64% ↔ 특급 86%), 키퍼 실력도 몇 %를 움직인다. */
/* 박스 안 파울 억제 — 실제 경기의 페널티는 4경기에 한 번꼴(경기당 0.25회)이다.
   수비수가 자기 박스 안에서 발을 뻗지 않기 때문이다. 이 값이 그 조심성이다. */
const PEN_BOX_CAUTION=0.085;
const PEN_ACC_BASE=0.78, PEN_ACC_SKILL=0.20;   // 유효슈팅 확률 0.78~0.98
const PEN_SAVE_BASE=0.20, PEN_SAVE_GK=0.18, PEN_SAVE_KICKER=0.23;
/* ── 프리킥 수비벽 ──────────────────────────────────────────── */
const WALL_MAX_M=30;        // 이 거리 안쪽이면 벽을 세운다
const WALL_GAP_M=1.05;      // 벽 선수 어깨 간격 (몸이 닿을 듯 붙어 선다)
const WALL_SHIFT_M=1.15;    // 니어포스트 쪽으로 밀어 세우는 정도
const FK_DIRECT_M=32;       // 이 거리 안쪽이면 직접 슈팅을 노려볼 만하다
const SP_WALL_HOLD=0.6;     // 킥 후 벽이 버티는 시간(초) — 공이 발을 떠난 뒤에 무너진다
const CORNER_SHORT_P=0.12;  // 코너를 짧게 빼서 다시 만드는 비율 (나머지는 박스로 띄워 올린다)
