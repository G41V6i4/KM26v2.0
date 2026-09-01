"use strict";
/* ── 수비 시 역할 ──
   전원이 "앵커 + 볼 쪽으로 조금"이라는 같은 공식을 쓰면 3미드가 통째로 붙어 다닌다.
   실제 축구는 한 명이 압박 나가면, 한 명은 패스 길목을 끊고, 한 명은 사람을 잡는다.
   라인을 맞출 때도 있지만 늘 그런 건 아니다 — 그 편차를 만든다. */
const DEF_ROLE={ PRESS:"PRESS", JOCKEY:"JOCKEY", LANE:"LANE", MARK:"MARK", LINE:"LINE",
                 COVER:"COVER", RECOVER:"RECOVER", COVER_WIDE:"COVER_WIDE",
                 DROP:"DROP",         // 동료가 비운 자리를 메우러 내려앉는다
                 /* ⚠ 예전에는 아래 BACKFILL 도 DROP 이었다. 축구로는 완전히 다른 움직임인데
                    (「빈 자리 메우기」 vs 「역습 대비로 뒷선에 숫자 채우기」) 이름이 같아서
                    ① 통계에서 구분이 안 되고 ② 둘 중 하나만 조정할 수가 없었다.
                    좌표 가중치만 0.70 / 0.92 로 갈리는 상태였다. */
                 BACKFILL:"BACKFILL", // 역습 대비 — 뒷선 줄에 들어가 숫자를 맞춘다
                 /* 🛡️ 포백 보호 — 미드필더가 뒷선 앞의 위험 공간을 지킨다 */
                 SCREEN:"SCREEN",       // 볼과 우리 골문 사이, 포백 앞을 가로막는다
                 BLOCK_SHOT:"BLOCK_SHOT", // 슛 각을 몸으로 지운다
                 SECOND:"SECOND" };     // 뜬 공의 낙하 지점을 선점한다
/* ══════════════════════════════════════════════════════════════════
   🛡️ 압박 판단 — "가장 가까운 선수가 공으로 달려간다"를 없앤다.
   나가는 게 이득인지 아닌지를 각자 계산하고, 아니면 지연시킨다(Jockey).
   ══════════════════════════════════════════════════════════════════ */
const JOCKEY_D=0.026;          // 저지 간격 (약 1.7m) — 이 거리를 두고 따라붙는다
/* 🎯 압박의 목적·각 (외부 평가·요청 — 「누구를 압박할까」는 되는데 「어느 방향에서, 어떤 패스를 막고, 어디로 몰까」가 없다).
   실측 기준선(seed 2): 압박 에피소드 4010 · 3초 안 탈취 5.6% · 제쳐짐 25% · 패스로 빠져나감 19% · 3초 초과 47%.
   접근 각 cos ≈ 0(무작위), 시작 시 골사이드 45%, 캐리어→중앙 옵션 선 위 26%, 동시 압박 2명+ 61%·4~5명 17%.
   ─ 압박자마다 목적 하나를 고르고(전술·역할 성향·상황), 목적이 「지워야 할 패스길」(그림자 대상)을 정하며, PRESS 목적지는
     캐리어→그림자를 잇는 선 위 1.7m 지점이 된다(커버 섀도). WIN 은 직선, DELAY 는 저지 간격.
   ─ 두 번째 압박자는 같은 볼로 달려가지 않고 「남은 가장 위험한 패스길」을 LANE 으로 맡는다(_shadowDuty). 셋 이상은 트랩·트리거일 때만.
   ─ 첫 터치 트리거: 수신 품질 HEAVY/BAD/FAIL 이면 1초 동안 _ftBad — 압박 가점 + 전력 접근. */
const PRESS_PURPOSE={WIN:"WIN", FORCE_WIDE:"FORCE_WIDE", FORCE_BACK:"FORCE_BACK", BLOCK_MID:"BLOCK_MID", DELAY:"DELAY", TRAP:"TRAP", CLOSE:"CLOSE"};
/* 🚫 슛 순간 클로즈다운 (수비 평가 6.5/10 의 1순위 — 「슛 순간 대응」).
   실측(빌드 1500, 슛 순간 3시드): 가장 가까운 수비수가 슈터의 <b>등 뒤</b>(cos<-0.5) 62~64% · 골사이드(cos>0.5) 6~7%.
   슛 통로(BLOCK_W 폭·11m) 안에 수비수 0명인 슛 79~86% · 블록 4/49 (실제 축구 25~30%).
   BLOCK_SHOT 역할 자체는 사거리 안에서 13.6% 나오고 있었다(예전 「0%」 평가는 틀렸다) — 문제는 두 가지:
   ① PRESS 의 목적지가 볼에서 0.55m(JOCKEY_D×0.30) 떨어진 점이라 「어디서 오든 볼로 직진」한다. 사거리에서는
      커버 섀도(FORCE_WIDE 등)가 캐리어→그림자 선에 세워 오히려 슛 선에서 비켜 선다. 제쳐진 뒤에도 뒤에서 볼을 쫓는다.
   ② BLOCK_SHOT·SECOND 의 이동 속도가 라인 조정 속도(JOG~RUN×0.7, 2~3.2m/s)에 묶여 슛 선까지 걸어갔다.
   ─ 사거리(SHOT_CLOSE_M) 안·각이 살아 있으면 압박 목적은 CLOSE 하나다(그림자 없음). 목적지: 골사이드가 아니면
     (cos<CLOSE_COS) 먼저 볼→우리 골문 중앙 선 위, 볼에서 min(내 거리×0.9, CLOSE_ARC) 앞 지점으로 달려 선을 잡고,
     골사이드가 되면 볼로 붙는다. 회랑 클램프·바깥 밀기는 적용하지 않는다. 두 번째 압박자도 그림자 임무로 빼지 않는다.
   ─ BLOCK_SHOT 는 SPRINT×0.92, SECOND 는 RUN. */
const SHOT_CLOSE_M=24;         // 이 사거리(m) 안이면 슛이 1순위 위협
const SHOT_CLOSE_ANG=0.22;     // 슛 각(rad)이 이보다 작으면(측면 깊숙이) 슛보다 크로스·패스가 위협
const CLOSE_COS=0.45;          // 볼→골문 선과 이루는 cos 가 이보다 작으면 「골사이드가 아니다」
const CLOSE_ARC=0.060;         // 선을 잡으러 가는 앞 지점의 최대 거리 (약 4.2m)
const CLOSE_NEAR=0.035;        // ⚠ 1차 시도(빌드 1600 작업 중): 이 안이면 각을 따지지 않고 볼로 갔다 — 추적 결과 등 뒤 1.8m 에서
                               //   몸 간격(BODY_R×2=1.8m)에 막혀 2초 동안 제자리에서 미끄러지며 돌았다. 지금은 안 쓴다.
const CLOSE_MIN_E=0.030;       // 선 위 앞 지점의 최소 거리(약 2.1m) — 몸 간격을 넘겨야 돌아갈 수 있다
const CLOSE_SWING=0.025;       // 돌아갈 때 옆으로 벌리는 폭(약 1.75m) — 등 뒤일수록 크고 골사이드에 가까울수록 0
const PEP_ENGAGE=0.075;        // 🎯 압박 에피소드 개시/유지 거리(약 5.2m)
const PP_FTBAD_BONUS=0.35;     // 첫 터치가 나쁜 캐리어에게 나갈 가점
const PP_FTBAD_T=1.0;          // 첫 터치 트리거 지속(초)
function pressPurposeFor(a, carrier, opps, T, trapZone, dir){
  const own=v=>dir>0?v:1-v;
  const wide=(a.slot==="LM"||a.slot==="RM"||a.slot==="LW"||a.slot==="RW"||a.slot==="LAM"||a.slot==="RAM");
  const PP=PRESS_PURPOSE; let p;
  /* 🚫 사거리 안 — 슛 선이 먼저다 (CLOSE 주석) */
  { const _g=shotGeom(carrier); if(_g.distM<SHOT_CLOSE_M && _g.angle>SHOT_CLOSE_ANG) return {p:PP.CLOSE, shadow:null}; }
  if(trapZone) p=PP.TRAP;
  else if(FX(a,"aggPress")>0.3) p=PP.WIN;                 // 압박형 포워드 — 뺏으러 간다
  else if(FX(a,"press")<-0.3) p=PP.DELAY;                 // 포처 — 달려들지 않고 지연
  else if(wide) p=PP.FORCE_WIDE;                          // 측면 공격수 — 안쪽을 지우고 측면으로 몬다
  else if(FX(a,"drop")>0.3) p=PP.BLOCK_MID;               // 딥라잉 — 중앙 패스길
  else if((T.press||1)>=1.5) p=PP.WIN;
  else if((T.line||1)>=1.35) p=PP.FORCE_BACK;
  else if((T.press||1)<=0.5) p=PP.DELAY;
  else p = own(carrier.x)>0.55 ? PP.BLOCK_MID : PP.FORCE_WIDE;   // 상대 진영이면 중앙 차단, 우리 진영이면 측면으로
  /* 그림자 대상 — 목적이 정한 「지워야 할 패스길」의 받는 사람 */
  let shadow=null, bd=1e9;
  const fwdOf=o=>(o.x-carrier.x)*(-dir);                  // 상대의 전진 성분 (양수 = 앞으로 가는 패스)
  const inSide=(0.5-carrier.y)>=0 ? 1 : -1;               // 캐리어 기준 「안쪽」(중앙) 방향
  for(const o of opps){
    if(o===carrier || o.slot==="GK") continue;
    const d=HYP((o.x-carrier.x)*PITCH_AR, o.y-carrier.y); if(d<0.03 || d>0.32) continue;
    const f=fwdOf(o);
    let ok=false, sc=d;
    if(p===PP.BLOCK_MID){ ok = Math.abs(o.y-0.5)<0.20 && f>-0.02; }
    else if(p===PP.FORCE_BACK){ ok = f>0.04; sc = -f; }                       // 가장 앞선 전진 옵션
    else if(p===PP.FORCE_WIDE || p===PP.TRAP){ ok = (o.y-carrier.y)*inSide>0.03 && f>-0.06; }
    if(ok && sc<bd){ bd=sc; shadow=o; }
  }
  return {p, shadow};
}
/* ═══ 🪤 오프사이드 트랩 ══════════════════════════════════════════════
   ⚠ 요청 — 「오프사이드 트랩. 포백이 신호에 맞춰 동시에 전진. 성공하면 오프사이드,
      한 명만 늦으면 단독 찬스. 조직력 수치에 눈에 보이는 값어치가 생김」.
   지금까지 breaksOffside 는 <b>특성 이름</b>으로만 있었고, 수비 라인은 그냥 라인을 유지할 뿐
   능동적으로 걸어 올라가지 않았다.
   ── 설계 ────────────────────────────────────────────────────
     · 성공·실패를 <b>주사위로 정하지 않는다</b>. 라인을 실제로 밀어 올리고, 판정은 기존
       오프사이드 로직이 「그 순간의 좌표」로 알아서 내린다. 그래서 한 명이 늦으면
       그 선수가 최종 수비수가 되어 상대가 온사이드가 된다 — 저절로 단독 찬스가 된다.
     · 선수별 반응 지연 = 위치선정·판단력·팀워크 + <b>팀 조직력(fam)</b>.
       조직력이 낮은 팀은 라인이 톱니처럼 어긋나 트랩이 오히려 독이 된다.
     · 라인을 높게 쓰는 팀만 자주 건다 (전술 슬라이더 line). */
const TRAP_STEP=0.055;         // 한 번에 밀어 올리는 깊이 (약 3.7m)
const TRAP_HOLD=0.85;          // 라인을 올린 채 버티는 시간 (초)
const TRAP_COOL=11.0;          // 다시 걸기까지 최소 간격 (초)
const TRAP_LAG=0.42;           // 가장 굼뜬 수비수가 늦는 최대 시간 (초)
const TRAP_NEAR=0.085;         // 라인 앞 이 안(약 5.7m)에 잡을 상대가 있어야 건다
const TRAP_RISE=0.30;          // 밀어 올리는 데 걸리는 시간 (초)
const TRAP_FALL=1.60;          // 다시 내려오는 데 걸리는 시간 (초) — 순간이동이 아니라 복귀 곡선
function pressScore(d, carrier, ctx){
  const A=(d.p&&d.p.attr)||{};
  const at=(k,fb)=>clamp(attr20(A[k]!=null?A[k]:(fb||60))/20, 0.15, 1);
  const dist=HYP((carrier.x-d.x)*PITCH_AR, carrier.y-d.y);
  /* ① 닿을 수 있는가 — 멀면 나가 봐야 소용없다 */
  /* ⚠ 🚫 이 항을 «도착 가능성»(ETA 를 상황 수명 b.hold 와 견주고 2.0초 넘으면 급락)으로
     바꿔 봤다. 진단 자체는 맞다고 보지만 <b>증상은 나아지지 않았다</b>:
       안정화 장치를 약하게(평활 0.75·문턱 0.10·명단 0.3초) — 크게 물러남 112 → 127 · 측면 15.4%
       안정화 장치를 그대로                                  — 112 → 121 · 측면 12.6%
     못 닿는 사람을 빼도 그 자리를 「닿긴 하는데 더 나쁜」 사람이 받고 그가 다시 돌아선다.
     ⚠⚠ 여섯 번의 시도(명단 연속·점수 평활·정원 래치·제자리 정지·ETA 감점·ETA 재정의)에서
        <b>크게 물러남은 한 번도 111 아래로 내려간 적이 없다.</b> 어떤 개입을 해도 나빠지기만 한다.
        이 정도로 완강하면 이 지표의 대부분은 «정상적인 수비»일 가능성이 높다 —
        압박자 선정을 더 만지기 전에 <b>지표가 무엇을 세고 있는지부터</b> 다시 봐야 한다. */
  let s = clamp(1-dist/0.20, 0, 1)*1.10;
  /* ② 상대가 지금 취약한가 — 등을 보이거나 공이 발에서 멀면 나갈 때다 (§10·§53) */
  const bd=ctx.ballD;                                   // 공이 상대 발에서 떨어진 거리
  s += clamp(bd/0.030, 0, 1)*0.42;
  if(ctx.carrierBack) s += 0.30;                        // 우리 골문에 등을 지고 있다
  /* ③ 뒤를 받쳐 줄 동료가 있는가 — 없으면 나가면 안 된다 (§11·§15).
     단 우리 골라인 근처까지 파고든 캐리어는 위험 그 자체 — 커버를 따질 때가 아니다
     (제보: 바이라인에 선 윙어를 아무도 압박하지 않던 현상). */
  const _deep=clamp((0.20-(d.dir>0?carrier.x:1-carrier.x))/0.20, 0, 1);
  s += (ctx.hasCover ? 0.26 : -0.46*(1-_deep));
  s += _deep*0.60;
  /* ④ 수적 상황 — 열세면 무리하지 않는다 (§51) */
  s += clamp(ctx.numAdv, -2, 2)*0.16;
  /* ⑤ 상대가 나보다 빠르고 앞에 공간이 넓으면 달려들지 않는다 (§11·§52) */
  const pace=at("pac",60)*0.5+at("acc",60)*0.5;
  s -= clamp(((carrier.paceSkill||0.6)-pace)*1.20, 0, 0.55)*(ctx.spaceBehind>0.18?1:0.45);
  /* ⑥ 성향과 몸 상태 — 활동량·적극성·판단, 그리고 남은 체력 (§54·§56) */
  s += (at("wor",60)-0.55)*0.30 + (at("agg",55)-0.55)*0.22 + (at("dec",60)-0.55)*0.18;
  s *= clamp(0.55 + (d.stam!=null?d.stam:1)*0.55, 0.45, 1.1);
  const _b=roleBias(d);
  s += _b.fPress*0.34 + (ctx.pressTac-1)*0.22;
  /* 🔗 압박 인계 — 방금 공을 받은 상대가 내가 잡고 있던 사람이면, 나가는 건 내 몫이다.
     첫 압박자가 벗겨져도 다음 사람이 자연히 이어받는다(PressChain).
     밀착 마크 성향이 높을수록 자기 사람을 끝까지 책임진다. (§9·§16) */
  if(d._mark && carrier && d._mark.id===carrier.id) s += 0.42 + clamp(_b.fMark,0,1.5)*0.38;
  if(ctx.ftBad) s += PP_FTBAD_BONUS;                     // 🎯 첫 터치가 길었다 — 지금이다
  return s;
}
/* 올라가 있던 풀백이 남긴 뒷공간을 찾는다. 소유권을 잃은 직후(역습) 이 공간이 가장 위험하고,
   현대축구에서는 그 뒤에 있던 선수가 즉시 그 자리를 메운다. */
/* 🛡️ ⚠ 제보(풀백 평가) — 「양쪽 풀백이 동시에 올라가 있어도 한쪽만 처리된다」.
   예전에는 가장 많이 전진한 한 명(worst)만 돌려줬다 — 나머지는 아무 처리도 못 받고
   일반 2차 판단으로 흘러 LINE 이 됐다. 올라간 측면 수비는 전부 복귀 대상이다. */
/* 🔁 측면 미드필더 ↔ 풀백 관계 · 복귀 의무 (외부 제안·요청).
   「W 와 WM 의 가장 큰 차이는 공격 위치가 아니라 수비 전환 시 복귀 의무」. 코드 확인: pickDef 의 MID_SLOTS 는
   LCM·CM·RCM 뿐이라 LM/RM 이 LW/RW 와 똑같은 최전방 가중(0,1,2)을 받았고, RECOVER 는 풀백·윙백만, 측면 구멍
   (holeFit flank) 후보에 같은 쪽 측면 미드필더가 없었다. 작성자의 「수비형 윙」 주석도 「평범한 윙과 같았다」.
   ─ 의무 0~1: LM/RM 1.0 · LAM/RAM 0.5 · LW/RW 0. 특성으로 가감(전진 성향이 음수인 수비형 윙 +, 컷인 −).
     의무 ≥ 0.5 면 ① 볼을 잃으면 전력 복귀(RECOVER) ② 같은 쪽 풀백이 비운 측면을 1순위로 메움(COVER_WIDE)
     ③ 수비 역할 가중을 미드필더로 ④ 마크 후보는 자기 측면 상대. 윙어(0)는 조깅 복귀 + 역습 출구로 남는다.
     포메이션마다 저절로 갈린다: 4-4-2 의 LM/RM 은 내려와 4-4 를 완성하고, 4-3-3 의 LW/RW 는 높이 남는다. */
function wmDuty(a){
  const sl=a.slot;
  let d = (sl==="LM"||sl==="RM") ? 1.0 : (sl==="LAM"||sl==="RAM") ? 0.5 : (sl==="LW"||sl==="RW") ? 0 : -1;
  if(d<0) return 0;
  /* 🎭 수비형 윙(DW/수비, fwd −0.75) 이 0.6 계수로는 의무 0.45 — 문턱(0.5)을 못 넘어 LM 처럼 복귀하지 않았다 */
  d += clamp(-FX(a,"fwd"), 0, 1)*1.1 - clamp(FX(a,"cutIn"), 0, 1)*0.2;
  return clamp(d, 0, 1);
}
const WM_DUTY_MIN=0.5;       // 이 이상이면 복귀 의무가 있는 측면 미드필더로 본다
const WM_BEHIND=0.03;        // 수비 국면에 측면 미드필더는 볼 기준점보다 이만큼(약 3m) 골 쪽 (2b 단계)
function exposedFlanks(mine, dir){
  const out=[];
  for(const a of mine){
    if(a.slot!=="LB" && a.slot!=="RB" && a.slot!=="LWB" && a.slot!=="RWB") continue;
    const defAnchor=tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
    const ahead=(a.x-defAnchor.x)*dir;
    if(ahead>0.09) out.push({by:a, anchor:defAnchor, ahead});
  }
  out.sort((p,q)=>q.ahead-p.ahead);
  return out;
}
function exposedFlank(mine, dir){
  let worst=null;
  for(const a of mine){
    /* ⚠ 윙백(LWB·RWB)이 빠져 있었다 — 3백에서는 이 함수가 통째로 죽어
       RECOVER 도 COVER_WIDE 도 한 번도 나오지 않았다(실측 3-5-2 에서 둘 다 0%).
       올라갔다 돌아오는 건 오히려 윙백이 더 잦다. */
    if(a.slot!=="LB" && a.slot!=="RB" && a.slot!=="LWB" && a.slot!=="RWB") continue;
    const defAnchor=tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
    const ahead=(a.x-defAnchor.x)*dir;              // 자기 수비 위치보다 얼마나 전진해 있나
    if(ahead>0.09 && (!worst || ahead>worst.ahead)) worst={by:a, anchor:defAnchor, ahead};
  }
  return worst;
}
/* 🛡️ ⚠ 제보 원문 — 「수비 전환에서 풀백의 복잡성이 충분히 유지되지 않는다.
     RB 가 공격에 올라갔는데 상대가 공을 탈취했다. RB 는 그냥 '내 앵커로 RECOVER' 하면 안 된다.
       ① 상대 LW 가 이미 넓게 있음 → RB 는 LW 를 따라가야 함
       ② 상대 LW 가 안으로 들어옴 → RB 는 안쪽으로 좁혀야 함
       ③ CB 가 측면으로 나감 → RB 는 CB 의 빈 자리 커버
       ④ DM 이 RB 의 자리를 커버 → RB 는 더 공격적으로 복귀
       ⑤ 반대쪽 전환 → RB 는 즉시 자기 측면으로 스프린트
     이런 상호 의존적인 의사결정이 중요하다」.
   원인: RECOVER 의 복귀 목표가 tacticalAnchorXY 한 점 — 포메이션 표에 박힌 정적 좌표였다.
      상대 윙어가 어디 있는지, 우리 센터백이 끌려 나갔는지, 내 자리를 누가 이미 메웠는지
      한 가지도 보지 않았다. 게다가 RECOVER 는 1차 판단에서 확정돼 markBest 후보에서
      통째로 빠지므로, 상대 윙어가 바로 옆에 서 있어도 잡지 않고 빈 점을 향해 달렸다.
      규율 반경 0.60(최대)에 속도 SPRINT — 「틀린 자리로 가장 빠르게」 갔다.
   ─ 역할 체계(RECOVER)는 그대로 두고 <b>목표 좌표만</b> 판단으로 만든다.
     ⑤ 는 예전 동작이 그대로 기본값으로 남는다. */
function recoverSpot(a, mine, opps, ball, dir, anch){
  const ownGoalX = dir>0 ? 0.015 : 0.985;
  const own = v => dir>0 ? v : 1-v;                    // 0 = 우리 골문
  const side = anch.y<0.5 ? -1 : 1;                    // 내가 맡은 측면
  const half = (v) => (v-0.5)*side;                    // 내 쪽이면 양수

  /* 내 측면에서 가장 위협적인 상대 — 우리 골문에 가깝고 내 자리에 가까운 쪽 */
  let wide=null, ws=-1e9;
  for(const o of opps){
    if(o.slot==="GK") continue;
    if(half(o.y) < -0.05) continue;                    // 반대쪽 사람은 내 일이 아니다
    if(own(o.x) > 0.66) continue;                      // 아직 자기 진영 깊이 — 급하지 않다
    const sc = (0.66-own(o.x))*1.60 - Math.abs(o.y-anch.y)*0.85;
    if(sc>ws){ ws=sc; wide=o; }
  }

  /* ③ 같은 쪽 센터백이 측면으로 끌려 나갔는가 */
  let cbOut=null;
  for(const m of mine){
    if(m===a || m.slot==="GK") continue;
    if(m.slot==="LB"||m.slot==="RB"||m.slot==="LWB"||m.slot==="RWB") continue;
    if((SLOT_BAND[m.slot]||"MF")!=="DF" && (SLOT_BAND[m.slot]||"MF")!=="SW") continue;
    const ma=tacticalAnchorXY(m.team, m.slot, "DEF", m.isHome);
    if(half(ma.y) < -0.02) continue;                   // 내 쪽 센터백만
    if((m.y-ma.y)*side > 0.055){ cbOut={m, ma}; break; }
  }

  /* ① 상대가 폭을 잡고 있다 — 따라간다. 그와 우리 골문을 잇는 선 위, 골 쪽 3.5m */
  if(wide && Math.abs(wide.y-0.5) > 0.235){
    const dx=(ownGoalX-wide.x)*PITCH_AR, dy=0.5-wide.y, dl=HYP(dx,dy)||1e-6;
    const step=0.052;
    return {x:clamp01(wide.x + (dx/dl)*step/PITCH_AR),
            y:clamp01(wide.y + (dy/dl)*step)};
  }
  /* ② 상대가 안으로 들어왔다 — 나도 안쪽으로 좁힌다 (하프스페이스를 닫는다) */
  if(wide){
    return {x:clamp01(anch.x), y:clamp01(anch.y + (wide.y-anch.y)*0.60)};
  }
  /* ③ 센터백이 나간 자리를 메운다 — 앵커와 그 센터백 자리의 사이로 */
  if(cbOut){
    return {x:clamp01(anch.x*0.55 + cbOut.ma.x*0.45),
            y:clamp01(anch.y*0.55 + cbOut.ma.y*0.45)};
  }
  /* ④ 내 자리를 이미 동료가 메웠다 — 끝까지 안 내려간다. 다음 전환을 위해 반 칸 앞에서 선다 */
  if(a._recCovered){
    return {x:clamp01(anch.x + dir*0.060), y:clamp01(anch.y + (0.5-anch.y)*0.18)};
  }
  /* ⑤ 반대쪽 전환 — 자기 측면으로 전력 복귀하되, 볼이 먼 쪽이면 안쪽으로 조금 좁힌다 */
  const far = half(ball.y) < -0.10;
  return {x:clamp01(anch.x), y:clamp01(anch.y + (far ? (0.5-anch.y)*0.26 : 0))};
}
/* 볼 소유자가 노릴 만한 "가장 위협적인 전진 패스 대상" — 길목 차단(LANE)의 기준이 된다 */
function topThreat(carrier, opps, dir){
  let best=null, bs=-1e9;
  for(const o of opps){
    if(o.slot==="GK" || o===carrier) continue;
    const fwd=(o.x-carrier.x)*dir;              // 상대 공격 방향 기준 전진도
    const d=HYP((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
    if(d<0.04 || d>0.6) continue;
    const sc=fwd*2.2 - d*0.8;
    if(sc>bs){ bs=sc; best=o; }
  }
  return best;
}
/* ── 🎯 마킹 — 「누구를 잡는가」를 재는 단 하나의 자 ─────────────────────────
   ⚠ 수비 AI 해부에서 확인 — 짝 표와 점수식이 두 벌로 굴러가고 있었다.
     ① pickDef 안의 markS  — 사정권 0.30(침투 0.42) · 침투 1초 예측 있음 · 짝 가점 0.42/0.36/0.45
                             위협식 = 골문거리 0.62 + 가까움 0.78
     ② MARK 확정 루프      — 사정권 0.112×1.45(짝 ×2.1) · 예측 없음 · 짝 가점 일괄 0.50
                             위협식 = (골문 0.52 + 받을거리 0.26 + 속도 0.22)×0.78 + 가까움×(0.70+성향)
     ①이 「MARK 를 고르게 만든 상대」를 ②는 사정권 밖이라 못 잡는다 → 그 자리에서 LINE 으로 강등.
     고른 근거와 실제 배정이 서로 다른 자를 쓰고 있었다. 그래서 「마크를 골랐는데 아무도 안 잡는」
     장면이 나온다.
   ─ 표도 점수도 하나로 합친다. 이제 markBest() 한 번만 돌고, 그 결과가 「MARK 를 고를 근거」이자
     「실제로 잡을 사람」이다. 둘이 어긋날 방법 자체가 없어진다. */
const MARK_FB={LB:1,RB:1,LWB:1,RWB:1};
const MARK_WIDE={LW:1,RW:1,LM:1,RM:1};
const MARK_CB={LCB:1,RCB:1,CB:1};
const MARK_ST={ST:1,LS:1,RS:1};
/* 사정권 — 「내 구역 안의 한 명」이 마킹이다. 넓게 두면 11m 밖의 상대를 배정받고
   끝까지 못 따라잡는다(실측 평균 10.4m). 옛 확정 루프의 유효 반경(0.112×1.45)을 그대로 잇는다. */
const MARK_REACH=0.162;        // 기본 (약 11m)
const MARK_RUN_K=1.40;         // 전력 침투 중인 상대는 넓게 본다
const MARK_PAIR_K=1.45;        // 내 짝이면 그만큼 더 멀어도 따라간다
function markFlank(p){ return (p.home?p.home.y:p.y)<0.5; }
/* 짝 — 실제 축구의 기본 매칭. 풀백↔윙, 윙↔올라온 풀백, 센터백↔스트라이커 */
function markPair(a, o){
  const same = markFlank(a)===markFlank(o);
  if(same && MARK_FB[a.slot] && MARK_WIDE[o.slot]) return 0.44;
  if(same && MARK_WIDE[a.slot] && MARK_FB[o.slot] && (o.dir>0?o.x:1-o.x)>0.42) return 0.38;
  if(MARK_CB[a.slot] && MARK_ST[o.slot]
     && (same || Math.abs((o.home?o.home.y:o.y)-0.5)<0.10)) return 0.46;
  return 0;
}
/* 내 구역에서 가장 잡아야 할 한 명과 그 점수 */
function markBest(a, threats, taken, ownGoalX, carrier, t, rMark, pressOn){
  let best=null, bs=-1e9;
  for(const o of threats){
    if(taken && taken.has(o.id)) continue;
    /* 🏃 전력 침투 러너는 「지금 위치」가 아니라 「1초 뒤 위치」로 본다.
       현재 위치로만 보면 침투 시작 순간엔 위협이 아니어서 아무도 안 따라간다. */
    const run=((o.burstUntil||0)>t || (o._chase && o._chase.until>t))
              && ((ownGoalX>o.x?1:-1)*vSx(o))>0;                                     // 침투 방향 — 평활값
    const ox=run ? o.x+(o.vx||0)*5 : o.x;
    const oy=run ? clamp01(o.y+(o.vy||0)*5) : o.y;
    const pair=markPair(a, o);
    const rr=MARK_REACH*(run?MARK_RUN_K:1)*(pair?MARK_PAIR_K:1);
    const d=HYP((ox-a.x)*PITCH_AR, oy-a.y);
    if(d>rr) continue;
    const goalN=clamp(1-Math.abs(ox-ownGoalX)/0.55, 0, 1);            // 우리 골문에 가까울수록 위험
    const dc=carrier ? HYP((ox-carrier.x)*PITCH_AR, oy-carrier.y) : 0.30;
    const recvN=clamp(1-Math.abs(dc-0.18)/0.30, 0, 1);                // 지금 받을 만한 거리인가
    const thr = goalN*0.56 + recvN*0.22 + (o.paceSkill||0.6)*0.22;
    const reach = clamp(1-d/rr, 0, 1);
    /* ⚠ 밀착 성향은 「위협」이 아니라 「가까움」에 곱한다 — 위협에 곱하면 성향이 높을수록
       먼 위험 인물을 고르느라 간격이 오히려 벌어진다(실측 8.5m → 16.5m). */
    let sc = thr*0.78 + reach*(0.70 + rMark*0.90) + pair;
    /* 🎯 압박 출구 잠금 1차 — 기각(기록). recvN×0.60 가점: 압박 중 미드필더 MARK 점유율은
       4.5→10.5%로 올랐지만 출구 최근접 수비수 거리 분포가 그대로(p50 4.5m·5m 밖 44%) —
       마크 대상이 출구가 아닌 다른 상대(goalN 높은 쪽)였다. 간접 가점으론 대상이 안 바뀐다.
       2차(결정적 배정)는 assignDefRoles 끝의 출구 잠금 패스 참조. pressOn 파라미터는 남겨 둔다. */
    if(run) sc += 0.30;                                               // 침투는 지금 잡아야 한다
    /* 🧱 수비 B — 잡고 있던 사람을 계속 잡는다. 역할(MARK)에는 히스테리시스가 있는데 대상에는 없어서
       구역 안 두 명 사이를 오갔다(실측 CB 대상 교체 분당 7.3회). 명확히 더 위험한 상대가 나타나야 바꾼다. */
    if(a._lastMark && a._lastMark.id===o.id) sc += MARK_STICK;
    if(sc>bs){ bs=sc; best=o; }
  }
  return {o:best, s:best?bs:0};
}
/* ── 🚧 길목 — 「어느 통로를 막을 것인가」를 재는 자 ──────────────────────────
   ⚠ 예전 laneS 는 통로를 <b>하나만</b> 봤다(topThreat 이 고른 최고 위협 한 명).
      내가 다른 통로 위에 서 있어도 값이 0 이라, 실측 laneS 가 0.03~0.05 에 붙어
      LANE 은 사실상 「CM 하드코딩」으로만 존재했다(점유율 3.0%).
      게다가 수직거리 허용이 0.075(약 5m)로 좁아, 한 발만 벗어나도 후보에서 빠졌다.
   ─ 전진 패스가 될 만한 상대를 전부 훑어 「내가 끊을 수 있고 · 끊을 값이 있는」 통로를 고른다.
     끊을 값은 ① 선에 얼마나 가까운가 ② 통로의 어느 지점인가(받는 쪽일수록 값지다)
     ③ 그 상대가 우리 골문에 얼마나 가까운가 로 매긴다. */
const LANE_W=0.11;            // 통로 폭 — 이 안(약 7m)이면 몸으로 끊을 수 있다
const LANE_MAX=0.62;          // 이보다 먼 상대에게 가는 패스는 잘 오지 않는다
function laneBest(a, carrier, threats, dir, wMul){
  if(!carrier) return {o:null, s:0};
  /* 🎯 압박 결과 진단 ② (제보 후속) — BEATEN 중앙 패스의 통로 개방도 중앙값 0.03, 55%가 완전 개방.
     통로가 뚫리는 건 요격이 관대해서가 아니라 <b>빈 통로로 아무도 이동하지 않아서</b>다.
     ⚠ 두 시도 모두 기각(기록) — ① 압박 중 미드필더 탐지 폭 1.8배: BEATEN-pass 95→87·개방 55→63%(노이즈 안)
        ② 추가로 LANE 후보 +0.30 가점: 106·70% — 오히려 표본 악화. 먼 통로의 cut 값이 작아 LANE 이
        어차피 MARK/LINE 에 밀리고, 정말 뚫리는 통로는 「라인 사이」라 그 근처에 수비수 자체가 없다.
        역할 선택이 아니라 수비 블록의 라인 간격 문제 — 다음 밸런스 사이클에서 블록 간격으로 접근할 것.
     wMul 파라미터는 남겨 둔다(후속 실험용, 기본 1). */
  const _lw=LANE_W*(wMul||1);
  const ownGoalX = dir>0 ? 0.015 : 0.985;
  let best=null, bs=0;
  for(const o of threats){
    if(!o || o===carrier || o.slot==="GK") continue;
    /* 전진 패스만 — 뒤로 빼주는 공은 길목을 지킬 이유가 없다 */
    if((o.x-carrier.x)*(-dir) <= 0.01) continue;
    const ax=(o.x-carrier.x)*PITCH_AR, ay=o.y-carrier.y;
    const L2=ax*ax+ay*ay;
    if(L2<1e-6 || Math.sqrt(L2)>LANE_MAX) continue;
    const px=(a.x-carrier.x)*PITCH_AR, py=a.y-carrier.y;
    const u=clamp((px*ax+py*ay)/L2, 0, 1);
    const perp=HYP(px-ax*u, py-ay*u);
    if(perp>_lw) continue;
    const cut =clamp(1-perp/_lw, 0, 1);                        // 선에 얼마나 붙어 있나
    const spot=clamp(0.25+u*0.95, 0, 1);                       // 받는 쪽에 가까울수록 값지다
    const thr =clamp(1-Math.abs(o.x-ownGoalX)/0.62, 0, 1);     // 그 상대가 얼마나 위험한가
    const sc  = cut*(0.45+spot*0.55)*(0.55+thr*0.60);          // 최대 1.15
    if(sc>bs){ bs=sc; best=o; }
  }
  return {o:best, s:bs};
}
/* 압박 나간 선수를 제외한 나머지에게 역할을 배분한다 */
function assignDefRoles(mine, opps, carrier, pressers, t, dir, ball, jockey){
  ball = ball || (carrier ? {x:carrier.x, y:carrier.y} : {x:0.5, y:0.5});
  /* 🧷 마킹 방식 (세부 전술) — 지역이면 자기 구역, 대인이면 상대를 따라간다 */
  const _zoneMk = zoneMarkOn(TAC(mine[0] && mine[0].team));
  const ownGoalX = dir>0 ? 0.015 : 0.985;       // 우리가 지켜야 할 골문
  const gaps = exposedFlanks(mine, dir);        // 올라가 있던 측면 수비들 (전원)
  const gap = gaps[0] || null;                  // 그중 가장 많이 나가 있던 한 명 — 구멍 등록용
  const oppDir = -dir;                           // 상대의 공격 방향
  // 위협 순위: 우리 골문에 가까운 상대 공격수부터
  const threats=opps.filter(o=>o.slot!=="GK" && o!==carrier)
    .sort((p,q)=> Math.abs(p.x-ownGoalX)-Math.abs(q.x-ownGoalX));
  const taken=new Set();
  /* 볼 소유자가 노릴 만한 가장 위협적인 전진 패스 대상 — 길목(LANE) 판단의 기준 */
  const topT = carrier ? topThreat(carrier, opps, -dir) : null;
  /* 🚨 즉시 위험 (§18의 1순위) — 볼이 우리 최종 3분의 1에 들어왔고 박스 안에 상대가 있다.
     이 값이 크면 각자의 역할보다 「골문 앞을 채우는 것」이 먼저다. */
  let dngr=0;
  if(carrier){
    const own = dir>0 ? carrier.x : 1-carrier.x;
    if(own < 0.42){
      let nb=0;
      for(const o of opps){ if(o.slot!=="GK" && inBox(o, -dir)) nb++; }
      dngr = clamp((0.42-own)/0.42, 0, 1) * clamp(0.30+nb*0.26, 0, 1.25);
    }
  }
  /* ⚠ 예전에는 여기서 a._dngr 을 선수마다 심어 두고 이동 루프가 「위험하면 골문 쪽으로
     당기기」에 썼다. 그 기능은 실측에서 두 번 다 순손해라 껐는데(박스 인원 1.9→2.6명인데
     골이 11→17), <b>계산과 대입은 그대로 돌고 결과만 버려지고 있었다.</b> 대입을 걷어낸다.
     dngr 자체는 아래 backFill 판단이 쓰므로 계산은 남는다. */
  /* ⚠ 2단계 판단을 위해 defRole 을 비우는데, 그러면 히스테리시스가 「직전 역할」을 잃는다.
     비우기 전에 따로 기억해 둔다(실측: 이게 없어 수비 전환 빈도가 전혀 줄지 않았다). */
  for(const a of mine){ a._coverBehind=null; a._fillPrev=a._fillAt; a._fillAt=null; a._prevDef=a.defRole; a._recCovered=false; a._cbShift=0; }   // 🌀 _fillPrev — DROP 유지 판정용 · ↔️ _cbShift — 3백 연쇄
  /* 📋 보드 — 「누가 어디를 비웠는가」. 한 사람의 결정이 다음 사람의 판단 재료가 된다.
     RB가 압박을 나갔다 → 그 자리가 빈다 → RCB가 메우러 간다 → RCB 자리가 빈다 →
     DM이 내려앉는다 → 그만큼 반대쪽 LB가 안으로 좁힌다. 이 연쇄가 여기서 만들어진다. */
  const board={vacated:[], filled:new Set()};
  const _anch=(a)=>tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
  const _leave=(a)=>{ const an=_anch(a);
    /* ⚠ 「실제로 그 자리를 떠났을 때」만 빈 자리다.
       볼 근처라는 이유로 표시하면, 선수가 제자리에 있는데도 빈 자리로 잡혀
       수비수들이 서로의 자리를 향해 끌려다닌다(실측: DROP 이 17%까지 치솟았다). */
    /* ⚠ 앵커는 정지된 포메이션 좌표인데 수비 블록은 볼을 따라 통째로 이동한다.
       그래서 문턱이 낮으면 「블록이 움직인 것」까지 빈 자리로 잡혀 DROP이 폭주한다(실측 18%).
       확실히 자기 자리를 버리고 나간 경우(약 8m 이상)만 센다. */
    if(HYP((an.x-a.x)*PITCH_AR, an.y-a.y)>0.120) board.vacated.push({by:a.id, x:an.x, y:an.y});
  };
  for(const a of mine){
    if(a.slot==="GK"){ a.defRole=null; continue; }
    if(pressers.includes(a)){ a.defRole=DEF_ROLE.PRESS; a._mark=null; _leave(a); continue; }
    /* 🛡️ ⚠ 저지(JOCKEY)는 여태 이 함수가 몰랐다.
       _jockey 는 「나갈 값어치가 있는 사람이 아무도 없을 때」 뽑히므로 pressers 에 없다.
       그래서 이 선수는 2차 판단까지 내려와 MARK 를 받고 taken 에 상대를 등록해 놓고는,
       이동 루프에서 JOCKEY 로 덮어써졌다 — 그가 잡기로 한 상대를 아무도 안 잡는 구멍이 생겼다.
       ─ 여기서 확정한다. 2차 판단에 내려가지 않으니 남의 담당을 물고 놓지 않는다. */
    if(jockey && a===jockey){ a.defRole=DEF_ROLE.JOCKEY; a._mark=null; _leave(a); continue; }
    // 올라가 있던 측면 수비 본인은 전력으로 복귀한다 — 어디로 복귀할지는 아래에서 상황이 정한다
    {
      const _g = gaps.find(g=>g.by===a);
      if(_g){ a.defRole=DEF_ROLE.RECOVER; a._recAnchor=_g.anchor; a._recover=_g.anchor; a._mark=null; continue; }
      /* 🔁 측면 미드필더 복귀 의무 — 자기 DEF 앵커보다 8m 이상 앞에 있으면 풀백과 같이 전력 복귀 (wmDuty 주석) */
      if(wmDuty(a)>=WM_DUTY_MIN){
        const _da=_anch(a);
        /* 🌀 복귀 중인 자리도 빈 자리다 — 계측(빌드 1700 작업 중): 빈 자리 장부는 _leave 를 부르는 역할(압박·마크)일 때만
           채워져서, 나가 있던 선수가 RECOVER 로 바뀌는 순간 장부에서 지워졌다. 20m 밖에서 돌아오는 중인데 자리는
           「채워진 것」이 되어 DROP 메움이 중앙값 1.0초 만에 풀렸다. 복귀가 끝날 때까지 장부에 남긴다. */
        if((a.x-_da.x)*dir>0.09){ a.defRole=DEF_ROLE.RECOVER; a._recAnchor=_da; a._recover=_da; a._mark=null; a._wmBack=true; _leave(a); continue; }
      }
      a._wmBack=false;
    }
    a.defRole=null;      // 아직 미정 — 구멍 배정과 2차 판단으로 넘긴다
  }
  /* ══════════════════════════════════════════════════════════════
     🔒 역할 최소 유지 — 수비 역할 히스테리시스
     ⚠⚠ 제보 — 「수비수가 다가왔다가 뒤로 갔다가 다시 다가온다」.
        실측(측면 깊은 곳, 볼 15m 안): 역할 전환이 <b>선수당 분당 31회</b>. 2초에 한 번씩
        자기 일이 바뀐다. 게다가 전환쌍이 완벽하게 대칭이다 —
          PRESS↔MARK 227/221 · PRESS↔SCREEN 141/140 · PRESS↔LINE 112/110 · PRESS↔DROP 120/115
        판단이라면 한쪽으로 치우쳐야 한다. 대칭이라는 건 <b>동전을 던지고 있다</b>는 뜻이다.
     원인 — 역할마다 점수를 매기는 자가 <b>따로 논다</b>:
          · 압박 여부는 pressScore (압박 전용 척도, PRESS_STICK 0.32)
          · 나머지는 pickDef (LANE·MARK·LINE·SCREEN…, 잡음 ±0.175)
        두 척도 사이에는 「바꾸는 값어치」라는 개념이 아예 없다. 두 후보가 비슷하면
        0.4초마다 승자가 뒤집히고, PRESS 일 때 목표는 「볼」·나머지는 「대형 안 자리」라
        선수가 10m 를 앞뒤로 오간다. 화면에 보이는 게 그것이다.
     ⚠ 먼저 시도했다가 실패한 것들(전부 실측): 압박 전념 가산 · 압박자 명단 0.4초 고정 ·
        역할 잡음 선수별 고정 → 31 → 31 → 29.5. 전부 「누구를 뽑는가」만 건드렸기 때문이다.
     ─ 해법은 척도를 통일하는 게 아니라 <b>바꾸는 데 시간 문턱을 두는 것</b>이다.
       한 번 정한 역할은 ROLE_DWELL 동안 유지한다. 다만 상황이 <b>진짜로</b> 바뀌면 즉시 푼다:
         · 압박 대상(캐리어)이 바뀌었다   · 담당(마크 대상)을 잃었거나 남이 가져갔다
         · 볼이 멀어졌다(PRESS)          · 이번 틱에 이미 다른 역할이 확정됐다(압박·복귀 등)
       구멍 배정(COVER·DROP)은 장부(board)와 얽혀 있어 여기서 건드리지 않는다.
     ══════════════════════════════════════════════════════════════ */
  {
    const _cidNow = carrier ? carrier.id : 0;
    for(const a of mine){
      if(a.slot==="GK" || a.defRole) continue;      // 이번 틱에 이미 확정된 사람은 그대로
      const pv=a._prevDef;
      if(!pv) continue;
      if(!(pv===DEF_ROLE.PRESS || pv===DEF_ROLE.MARK || pv===DEF_ROLE.LANE ||
           pv===DEF_ROLE.LINE  || pv===DEF_ROLE.SCREEN || pv===DEF_ROLE.BLOCK_SHOT)) continue;
      if(a._dRoleAt==null || (t-a._dRoleAt)>=ROLE_DWELL) continue;
      if(a._dRoleCid!==_cidNow) continue;           // 상대 소유자가 바뀌었다 — 새 상황이다
      if(pv===DEF_ROLE.PRESS){
        /* 볼에서 멀어졌으면 압박이 아니다 — 붙잡아 두면 「따라다니기만」이 된다 */
        if(HYP((ball.x-a.x)*PITCH_AR, ball.y-a.y) > 0.075) continue;
      } else if(pv===DEF_ROLE.MARK){
        if(!a._mark || taken.has(a._mark.id)) continue;
        if(HYP((a._mark.x-a.x)*PITCH_AR, a._mark.y-a.y) > 0.22) continue;
        taken.add(a._mark.id);
      } else if(pv===DEF_ROLE.LANE){
        if(!a._laneTo) continue;
      }
      a.defRole=pv; a._dwellHeld=true;
    }
  }
  /* 🕳️ 빈 자리 장부 — 「누가 어디를 비웠고, 누가 메우는가」를 한 곳에서 정한다.
     ⚠ 예전에는 세 갈래가 서로를 모른 채 각자 굴러갔다:
        · COVER_WIDE — 올라간 측면 수비의 뒷공간   (플래그 covered)
        · COVER      — 압박 나간 동료의 대각선 뒤   (플래그 coverTaken)
        · DROP       — 동료가 떠난 앵커             (board.filled)
        셋 다 「배열에서 먼저 온 사람이 가져간다」였고 거리도 자리 적성도 보지 않았다.
        그래서 좌측 풀백이 올라간 자리를 좌측 센터백이 아니라 중앙 미드필더가 메웠다
        (실측: 4-3-3 에서 CM 의 COVER_WIDE 점유율 54.8%). 그만큼 CM 은 길목·스크린에서 빠졌다.
     ─ 구멍을 먼저 모으고, 구멍마다 가장 알맞은 한 명을 고른다.
       사람이 구멍을 고르는 게 아니라 구멍이 사람을 고른다 —
       그래야 「누가 먼저 판단하느냐」가 결과를 바꾸지 않는다. */
  const holes=[];
  /* ⚠ SLOT_SIDE 에는 윙백(LWB·RWB)이 없어 side 가 0 이 되고, holeFit 의 「같은 쪽 센터백 1순위」가
     3백에서 통째로 죽었다. 앵커 y 로 쪽을 정하면 슬롯 표에 없는 자리도 옳게 갈린다. */
  if(gap) holes.push({kind:"flank", x:gap.anchor.x, y:gap.anchor.y, by:gap.by,
                      side:(SLOT_SIDE[gap.by.slot] || (gap.anchor.y<0.5?-1:1))});
  if(pressers.length){ const pr=pressers[0]; holes.push({kind:"press", x:pr.x, y:pr.y, pr}); }
  const HOLE_MAX_D=0.42;                       // 이보다 먼 구멍은 내 일이 아니다 (약 28m)
  const holeFit=(h, a)=>{
    const band=SLOT_BAND[a.slot]||"MF";
    const isCB=(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB");
    let f;
    if(_zoneMk && isCB){
      /* ↔️ 3백 슬라이드 (제보 — 「쓰리백 한정으로는 이런 움직임이 나오긴 해야 해. 그게 실제 축구 포지셔닝이거든」).
         3백·5백(CB 슬롯 사용)의 좌우 CB 는 예외 — 같은 쪽 윙백이 올라간 측면 구멍을 1순위로 슬라이드해 메운다.
         가운데 CB 와 반대쪽 CB 가 남아 존을 지키고, COVER_WIDE 역할은 존마크 대상(LINE·COVER)에서 빠지므로
         존마크 규칙과 충돌하지 않는다. 4백에서는 CB 슬롯이 없어 예전 그대로(메우지 않음). */
      const _has3=mine.some(m=>m.slot==="CB");
      if(!(_has3 && h.kind==="flank" && (a.slot==="LCB"||a.slot==="RCB") && (SLOT_SIDE[a.slot]||0)===h.side)) return -1;
      const d3=HYP((h.x-a.x)*PITCH_AR, h.y-a.y);
      if(d3>HOLE_MAX_D) return -1;
      const _stick3=(a._prevDef===DEF_ROLE.COVER_WIDE) ? HOLE_STICK : 0;
      return 1.25 - d3*1.65 + _stick3;
    }
    if(h.kind==="flank"){
      const mySide=SLOT_SIDE[a.slot]||0;
      /* 🔁 같은 쪽 측면 미드필더가 1순위로 풀백 자리를 메운다 (COVER_FULLBACK) */
      if(wmDuty(a)>=WM_DUTY_MIN){
        const _ws=(a.home && Math.abs(a.home.y-0.5)>0.06) ? (a.home.y<0.5?-1:1) : 0;
        if(_ws===h.side && _ws!==0){
          const d=HYP((h.x-a.x)*PITCH_AR, h.y-a.y);
          if(d>HOLE_MAX_D) return -1;
          return 1.35 - d*1.65;
        }
        return -1;
      }
      /* 같은 쪽 센터백이 1순위 — 실제로 그 자리를 물려받는 사람이다 */
      if(isCB) f=(mySide===h.side && mySide!==0) ? 1.30 : 0.55;
      else if(band==="DM") f=0.60;
      else if(band==="MF") f=0.40;
      else return -1;
    } else {
      if(isCB) f=1.10;                          // 압박 뒤를 받치는 건 센터백의 자리
      else if(band==="DM") f=0.70;
      else return -1;
      if((h.pr.x-a.x)*dir <= -0.01) return -1;  // 압박자가 나보다 앞에 있어야 받쳐 준다
    }
    const d=HYP((h.x-a.x)*PITCH_AR, h.y-a.y);
    if(d>HOLE_MAX_D) return -1;
    /* 🧱 안정화 A-1 — 지금 그 구멍을 맡고 있는 사람이 계속 맡는다 (COVER 36% 가 매 틱 흔들렸다) */
    const _stick=((h.kind==="flank") ? a._prevDef===DEF_ROLE.COVER_WIDE : a._prevDef===DEF_ROLE.COVER) ? HOLE_STICK : 0;
    return f - d*1.65 + _stick;                 // 자리 적성 − 거리 + 유지
  };
  for(const h of holes){
    let best=null, bs=0;
    for(const a of mine){
      if(a.slot==="GK" || a.defRole) continue;
      const f=holeFit(h, a);
      if(f>bs){ bs=f; best=a; }
    }
    if(!best) continue;                         // 알맞은 사람이 없으면 비워 둔다 — 억지로 끌어오지 않는다
    if(h.kind==="flank"){ best.defRole=DEF_ROLE.COVER_WIDE; best._coverAt={x:h.x, y:h.y};
      /* ↔️ 3백 연쇄 (참고 자료 — 「좌우 센터백이 측면으로 이동하면 중앙 센터백이 비운 중앙·골문 정면을 커버,
         반대편도 공 쪽으로 좁혀 블록을 형성」). 좌우 CB 가 슬라이드하면 남은 CB 들의 라인 목표를
         구멍 쪽으로 한 칸(약 3.5m) 당긴다. DM 내려앉기는 _leave 가 남긴 빈 앵커를 DROP 연쇄가 이미 받는다. */
      if(best.slot==="LCB"||best.slot==="RCB"){
        const _hs=(h.y<0.5)?-1:1;
        for(const c of mine) if(c!==best && (c.slot==="CB"||c.slot==="LCB"||c.slot==="RCB")) c._cbShift=_hs;
      }
      /* ④ 내 자리를 누가 메웠다 — 복귀하는 측면 수비가 이걸 읽고 덜 내려간다 */
      if(h.by) h.by._recCovered=true; }
    else { best.defRole=DEF_ROLE.COVER; best._coverBehind={x:h.x, y:h.y}; }
    best._mark=null; _leave(best);
  }
  /* 🛡️ 복귀 목표 — 구멍 배정이 끝난 뒤에 정한다 (④ 가 그 결과를 읽어야 한다) */
  for(const a of mine){
    if(a.defRole===DEF_ROLE.RECOVER)
      a._recover=recoverSpot(a, mine, opps, ball, dir, a._recAnchor||_anch(a));
  }
  /* ══════════════════════════════════════════════════════════════
     2차 판단 — 볼과 직접 얽힌 역할이 모두 정해진 뒤에 돈다.
     ⚠ 한 루프에서 다 처리하면, 자리를 비우는 선수보다 메울 선수가 먼저 판단해
        보드가 비어 있어 연쇄가 끊긴다(실측: DROP 이 한 번도 안 나왔다).
     ══════════════════════════════════════════════════════════════ */
  for(const a of mine){
    if(a.slot==="GK" || a.defRole) continue;
    /* 🔗 동료가 비운 자리 메우기 — 아직 아무도 안 맡았고, 내가 가장 가까우면 내려앉는다.
       ⚠ 볼이 우리 사거리 안일 때 미드필더는 예외 — 빈 앵커보다 슛 각·포백 앞이 급하다
          (장면 검증: 박스 앞 사거리에서 DM 이 DROP 에 붙들려 BLOCK_SHOT 이 안 나왔다). */
    const _mfBand=SLOT_BAND[a.slot];
    const _hot = carrier && ((dir>0?carrier.x:1-carrier.x) < 0.32);
    /* 🧱 안정화 A-3 — CB 는 구역에 위협이 있으면 빈 앵커 「점」을 메우러 가지 않는다 (원칙: 공간을 없앤다).
       실측 CB DROP 10% — 그 시간 동안 스트라이커를 아무도 안 잡았다. */
    let _cbHold=false;
    if(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB"){
      if(_zoneMk) _cbHold=true;             // 🧱 수비 B — CB 는 DROP 하지 않는다
      else for(const o of threats){
        if(Math.abs(o.x-ownGoalX)*PITCH_AR*ISO_TO_M<CB_ZONE_X && Math.abs(o.y-a.y)<CB_ZONE_Y){ _cbHold=true; break; }
      }
    }
    if(!((_mfBand==="DM"||_mfBand==="MF") && _hot) && !_cbHold){
      let pick=null, bd=1e9;
      const _fbSide=(_zoneMk && (a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB") && a.home) ? (a.home.y<0.5?-1:1) : 0;
      /* 🌀 DROP 유지 — 포메이션 계측(빌드 1700 작업 중)에서 측면 미드필더의 역할 전환이 분당 32~34회,
         그중 DROP 관련이 절반이었고 DROP 의 중앙값 지속 시간이 <b>1.0초</b>였다. 빈 자리 장부(vacated)는
         「앵커에서 8m 이상」 문턱에 걸린 선수 목록이라 매 틱 흔들리는데, DROP 은 pickDef 밖에서 배정되어
         히스테리시스를 전혀 안 탔다. 같은 자리(6m 안)가 아직 비어 있으면 계속 그 자리를 메운다. */
      const _dPrev=(a._prevDef===DEF_ROLE.DROP && a._fillPrev) ? a._fillPrev : null;   // ⚠ 1차: a._fillAt 을 봤는데 루프 첫머리에서 이미 null — 효과 0
      for(const v of board.vacated){
        if(board.filled.has(v.by) || v.by===a.id) continue;
        if(_dPrev && HYP((v.x-_dPrev.x)*PITCH_AR, v.y-_dPrev.y)<0.06){ pick=v; break; }
        /* 🧱 B-2 — 풀백은 중앙(마크 나간 CB 의 앵커 등)을 메우러 가지 않는다 (실측 FB DROP 17%) */
        if(_fbSide && (v.y-0.5)*_fbSide < FB_SIDE_MIN) continue;
        /* 🧱 B-2 — 앞쪽(측면 미드필더의 앵커)을 메우러 올라가지도 않는다 — 그건 「내려앉기」가 아니다 */
        if(_fbSide && (v.x-a.x)*dir > 0.02) continue;
        const d=HYP((v.x-a.x)*PITCH_AR, v.y-a.y);
        /* 나보다 그 자리에 가까운 동료가 아직 남아 있으면 양보한다 */
        let better=false;
        for(const o of mine){
          if(o===a || o.slot==="GK" || o.defRole) continue;   // 아직 역할이 없는 동료만
          if(HYP((v.x-o.x)*PITCH_AR, v.y-o.y) < d-0.005){ better=true; break; }
        }
        if(better) continue;
        if(d<0.32 && d<bd){ bd=d; pick=v; }   // 약 21m 안이면 메우러 간다
      }
      if(pick){
        a.defRole=DEF_ROLE.DROP; a._mark=null;
        if(a._prevDef!==DEF_ROLE.DROP) a._defRoleAt=t;   // 🌀 전환 시각 기록 — 히스테리시스와 장단 맞춤
        a._fillAt={x:pick.x, y:pick.y};
        board.filled.add(pick.by);
        _leave(a);                       // 내가 옮겨 가면 내 자리도 빈다 — 연쇄는 계속된다
        continue;
      }
    }
    /* 🛡️ 역습 시 뒷선 숫자 맞추기 (제보) — 「상대 역습 때 센터백처럼 수비진에 합류하라」.
       우리 최후방 인원이 상대 공격 인원보다 모자라면, 이 성향의 미드필더가 그 줄에 들어간다.
       숫자가 맞아 있으면 평소 역할대로 둔다 — 필요할 때만 내려가는 게 요령이다. */
    if(FX(a,"backFill")>0 && !a.defRole){
      const myLine=oppLineX(mine, dir);                     // 우리 최후방 x
      let defN=0, atkN=0;
      for(const m of mine){
        if(m.slot==="GK" || m===a) continue;
        if(dir>0 ? m.x<myLine+0.075 : m.x>myLine-0.075) defN++;
      }
      for(const o of opps){
        if(o.slot==="GK") continue;
        const oAdv = dir>0 ? o.x : 1-o.x;
        if(oAdv < 0.52) atkN++;                              // 우리 진영 절반 안으로 들어온 상대
      }
      const bOwn = dir>0 ? (ball.x) : (1-ball.x);            // 볼이 우리 골문에서 얼마나 떨어져 있나
      const need = (atkN > defN) || (dngr>0.45);             // 수적으로 밀리거나 이미 위험하다
      if(need && bOwn<0.62){
        /* 어느 쪽이 비었나 — 뒷선 중앙에서 볼 쪽으로 반 칸 붙여 선다 */
        const an=_anch(a);
        const fx2 = dir>0 ? Math.min(an.x, myLine+0.035) : Math.max(an.x, myLine-0.035);
        const fy2 = clamp01(0.5 + (ball.y-0.5)*0.42 + (an.y-0.5)*0.30);
        a.defRole=DEF_ROLE.BACKFILL; a._mark=null;
        a._fillAt={x:clamp01(fx2), y:fy2};
        continue;
      }
    }
    let r;
    /* 수비 행동에 개인 역할을 반영한다.
       예전에는 순수하게 슬롯과 시간(ph)으로만 갈려서, 수비형 윙이든 인사이드 포워드든
       마크 지정 비율이 28~31%로 똑같았다 — 역할이 협력수비에 관여할 방법이 없었다.
       이제 밀착 마크 성향은 사람을 잡고, 압박 성향은 길목으로 나가고,
       뒤에 서는 역할(fwd 음수)은 라인을 지키는 쪽으로 기운다. */
    const _B = roleBias(a);
    const rMark = clamp(_B.fMark, 0, 1.5);
    const rPress= clamp(_B.fPress, 0, 1.5);
    const rDeep = Math.max(0, -_B.fFwd);
    /* 🎯 마크 후보를 여기서 딱 한 번 잰다 — 이 결과가 「MARK 를 고를 근거」이자
       「실제로 잡을 사람」이다. 두 번 재던 시절의 어긋남(고르고 나서 못 잡아 LINE 강등)이 사라진다. */
    /* 🧱 수비 B — CB 는 「내 구역 점유자」만 마크 후보로 본다. 예전엔 11m 안 아무나(윙어·미드필더) 잡았다. */
    const _isCB0=(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB");
    const _isFB0=(a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB");
    const _thr = (_zoneMk && _isCB0)
      ? threats.filter(o=>Math.abs(o.x-ownGoalX)*PITCH_AR*ISO_TO_M<CB_ZONE_X && Math.abs(o.y-a.y)<CB_ZONE_Y)
      : (_zoneMk && (_isFB0 || wmDuty(a)>=WM_DUTY_MIN) && a.home && Math.abs(a.home.y-0.5)>0.06)
      /* 🧱 B-2 — 풀백(과 🔁 측면 미드필더)은 자기 측면의 상대만 잡는다 (안으로 들어온 윙어까지는 따라간다) */
      ? threats.filter(o=>(o.y-0.5)*(a.home.y<0.5?-1:1) > -FB_SIDE_MIN)
      : threats;
    const _mk = markBest(a, _thr, taken, ownGoalX, carrier, t, rMark,
      (pressers&&pressers.length&&(SLOT_BAND[a.slot]==="DM"||SLOT_BAND[a.slot]==="MF"))?1:0);   // 🎯 압박 중 출구 잠금
    const _ln = laneBest(a, carrier, threats, dir);   // 🚧 막을 통로도 여기서 한 번만 정한다
    /* 🛡️ 역할은 시계가 아니라 「지금 무엇이 필요한가」가 정한다.
       ⚠ 예전에는 (seed*0.618 + t/5) % 1 로 뽑았다. 성향은 확률만 바꿀 뿐이라,
          같은 상황에서도 6초마다 역할이 돌아가고 위협은 아무 영향을 못 줬다.
       성향(rPress/rMark/rDeep)은 그대로 「선호」로 남기고 상황 점수를 더한다. */
    const pickDef=(wLane, wMark, wLine)=>{
      /* ① 길목 — 위에서 이미 잰 값을 그대로 쓴다 (laneBest) */
      const laneS=_ln.s;
      /* ② 마크 — 위에서 이미 잰 값을 그대로 쓴다 (markBest) */
      const markS0=_mk.s;
      /* 🛡️ 「상대를 단단히 마크」 성향 — 사람을 잡는 「선택 자체」를 더 자주 고른다(제보).
         누구를 잡는가(markBest)와는 다른 층이다 — 지역만 지키는 미드필더와
         사람을 물고 늘어지는 미드필더가 여기서 갈린다. */
      const markS = markS0 * (1 + clamp(FX(a,"tightMark"), 0, 1.2)*0.55);
      const _band0=SLOT_BAND[a.slot]||"MF";
      /* ③ 라인 — 지금 뒷선을 지키는 인원이 모자란가 */
      let lineN=0;
      for(const m of mine) if(m.defRole===DEF_ROLE.LINE) lineN++;
      const lineS = clamp((3-lineN)/3, 0, 1)*0.95;
      const dec=(a.decSkill!=null?a.decSkill:0.55);
      /* ⚠⚠ 제보(「수비수가 다가왔다 물러났다를 반복한다」)의 <b>진짜 뿌리</b>가 이 한 줄이었다.
         이 잡음은 역할을 고를 때마다(0.4초) 새로 굴렀다. 진폭이 ±0.175 라 후보 점수 차가
         0.35 안이면 <b>승자가 매번 바뀐다</b>. PRESS 일 때 목표는 「볼」, MARK·SCREEN·LINE 일 때는
         「대형 안 자리」이므로, 역할이 뒤집힐 때마다 선수가 앞뒤로 오간다.
         실측(측면 깊은 곳): 역할 전환 <b>선수당 분당 31회</b> — 2초에 한 번.
         게다가 전환쌍이 완벽히 대칭이었다(PRESS↔MARK 227/221 · PRESS↔SCREEN 141/140) —
         판단이 아니라 동전 던지기다.
         ⚠ 앞서 압박자 전념(PRESS_COMMIT)과 명단 고정(0.4초 주기)을 먼저 넣었지만
            31 → 31 로 꿈쩍도 안 했다. 손잡이는 명단이 아니라 <b>이 잡음</b>이었다.
         ─ 「판단력이 낮으면 잘못 고른다」는 맞지만 「2초마다 마음이 바뀐다」는 아니다.
           선수·역할·시간대(약 3초)로 <b>고정된</b> 값을 쓴다. 잘못 고른 선수는 그 선택을
           한동안 유지한다 — 그게 판단력이 낮다는 뜻이다. */
      const _nEp=Math.floor(t/3);
      const noise=(k)=>{
        let h=((a.id|0)*2654435761 + (k|0)*40503 + _nEp*97) >>> 0;
        h ^= h>>>13; h=Math.imul(h, 1274126177)>>>0; h ^= h>>>16;
        return ((h/4294967296)-0.5)*(0.12+(1-dec)*0.58);
      };
      const C=[];
      /* ══════════════════════════════════════════════════════════
         🛡️ 포백 보호 — 미드필더만 후보로 갖는다.
         「나는 DM이니까 여기」가 아니라 「지금 가장 위험한 공간은 어디인가」로 고른다. */
      const _band=SLOT_BAND[a.slot]||"MF";
      if(_band==="DM" || _band==="MF"){
        const own=(v)=> dir>0 ? v : 1-v;
        const bOwn=own(ball.x);                       // 0=우리 골문, 1=상대 골문
        const bCen=1-clamp(Math.abs(ball.y-0.5)/0.34, 0, 1);   // 볼이 중앙일수록 1
        /* ① 스크린 — 볼이 우리 진영 중앙으로 다가올수록 값이 오른다.
           동료가 이미 그 자리를 맡고 있으면 양보한다(둘이 겹치지 않게 §17). */
        let screenTaken=0;
        for(const m of mine) if(m!==a && m.defRole===DEF_ROLE.SCREEN) screenTaken++;
        /* 「사이 공간」에 상대가 있는가 — Zone 14 (§4) */
        let pocket=0;
        for(const o of threats){
          const oOwn=own(o.x);
          if(oOwn>0.16 && oOwn<0.40 && Math.abs(o.y-0.5)<0.24) pocket++;
        }
        /* ⚠ 평가 순서가 MF→DM 이라, CM 이 먼저 스크린을 집으면 DM 이 「이미 있음」 감점을
           받아 LINE 으로 밀렸다(장면 검증: CM=SCREEN·DM=LINE 역할 반전).
           스크린은 DM 의 본진이다 — DM 밴드가 그라운드에 있으면 CM 은 이 후보를 접는다. */
        const hasDM = mine.some(m=>m!==a && m.slot!=="GK" && SLOT_BAND[m.slot]==="DM");
        if(_band==="DM" || !hasDM){
          const screenS = clamp(1-bOwn/0.62, 0, 1)*0.85 + bCen*0.55 + clamp(pocket*0.34,0,0.85)
                        - screenTaken*(_band==="DM" ? 0.40 : 0.95)
                        + (_band==="DM" ? 0.85 : 0.10);
          C.push({r:DEF_ROLE.SCREEN, s:screenS+noise(1)});
        }
      }
      /* ⚽ 세컨볼 — 뜬 공이 날아가는 중이면 낙하 지점을 선점한다 (§27).
         ⚠ 이 후보도 BLOCK_SHOT 과 똑같은 병을 앓고 있었다 — DM·MF 밴드 안에 갇혀 있었고
            (그것도 「DM 이 없을 때만」이라는 조건까지 붙어), 점수가 MARK·LINE 에 밀려
            실측 점유율 <b>0.0%</b> 였다. 한 번도 나오지 않는 역할이었다.
            그 결과 롱볼이 뜨면 수비수가 낙하점으로 가지 않고, 우연히 근처에 있던 사람만 다퉜다.
            코드에 증상 처치의 흔적도 남아 있다 — 골킥 제보(「공격수가 가로채 단독 찬스」)를
            고칠 때 <b>수비수를 오게 만드는 대신 경합 반경을 1.9배로 넓혔다</b>.
         ─ ① 모든 필드 플레이어가 후보로 갖는다 (센터백이야말로 롱볼 낙하점의 주인이다)
            ② 「읽는 눈」(예측력·집중력)이 점수를 키운다 — 뜬 공의 낙하점을 읽는 것도 능력이다
            ③ 온 팀이 낙하점으로 몰리면 마킹이 무너진다 — 이미 맡은 사람 수만큼 깎는다 */
      {
        const bb=ball;
        /* ⚽ 세컨볼 손질 (수비 평가 4순위 — SECOND 0.1%). 실측(빌드 1600, seed 1): 공중볼 562회 중
           <b>클리어 295회가 LOOSE 상태</b>라 「PASS 만」 조건에 걸러져 후보조차 없었다. 실제 낙하 순간
           반경 3.9m 안에 수비수 없음 57%(박스 도착 49%), 경합 성립 13%. 낙하점이 우리 진영 깊숙이면 가점. */
        if(bb && bb.aerial && (bb.state==="PASS"||bb.state==="LOOSE")){
          const LP=ballLand(bb, t);                 // 🎯 의도한 목표가 아니라 실제 낙하점
          const d2=HYP((LP.x-a.x)*PITCH_AR, LP.y-a.y);
          if(d2<SEC_R){
            let secTaken=0;
            for(const m of mine) if(m!==a && m.defRole===DEF_ROLE.SECOND) secTaken++;
            const _an=lbAnt(a);                       // 0.15 ~ 1.0 (평균 약 0.66)
            const near2=clamp(1-d2/SEC_R, 0, 1);
            /* ⚠ 여기서 점수를 더 올려 봤자 소용없다는 걸 실측으로 확인했다.
               점유율을 0.03 → 0.26 명(9배)까지 끌어올려도 <b>공중 경합 성립률은 22.6% → 21.4%</b>
               로 꿈쩍하지 않았다. 원인은 역할 선택이 아니라 <b>목표 좌표</b>다 —
               이 후보도, defTargetXY 의 SECOND 도 b.tx/b.ty 를 낙하점으로 쓰는데
               그건 <b>의도한 목표</b>일 뿐 공이 실제로 떨어지는 자리가 아니다.
               공은 stepBallPhysics 로 진짜 물리를 따라 날아가 다른 데 떨어진다.
               실측: 도착 순간 경합 반경(3.9m) 안에 <b>아무도 없는 경우가 477 중 240(50%)</b>.
               정작 의도한 리시버 곁에는 수비수가 중앙값 6.2m 에 붙어 있다 —
               즉 마킹이 빈 게 아니라 <b>공이 아무도 없는 곳에 떨어진다</b>.
               제대로 고치려면 z 를 적분해 실제 낙하점을 구하는 함수가 먼저 있어야 한다. */
            const _deepLP=(dir>0?LP.x:1-LP.x)<0.33 ? 0.55 : 0;   // ⚽ 우리 파이널서드 낙하 — 다투러 나가는 게 라인보다 급하다
            C.push({r:DEF_ROLE.SECOND,
                    s:near2*(1.55+_an*1.05) + 0.30 + _deepLP - secTaken*0.95 + noise(2)});
          }
        }
      }
      /* 🚫 슛 각 차단 — 밴드 제한을 푼다.
         ⚠ 이 후보는 DM·MF 밴드 안에 갇혀 있었다. 박스 앞에서 몸으로 슛 각을 지우는 건
            원래 센터백의 일인데 후보 자격조차 없었다(문서 공백 06).
            게다가 점수가 MARK·LINE 에 늘 밀려 실측 점유율이 0.0% — 한 번도 나오지 않았다.
         ─ ① 모든 필드 플레이어가 후보로 갖고
            ② 급함(urgent)을 제곱으로 키운다. 25m 밖에서는 조용하고 박스 앞에서만 솟는다
               (20m 0.24 · 15m 0.79 · 10m 1.74 · 8m 2.14).
               ⚠ 계수를 2.6 으로 뒀을 때는 실측 점유율이 0.1% 였다 — 센터백의 LINE 가중(2.60×성향)이
                  2.6 을 넘어서 슛이 코앞이어도 라인이 이겼다. 그 벽을 넘도록 4.6 으로 올렸다.
            ③ 다만 온 팀이 슛 선으로 몰리면 마킹이 무너진다 — 이미 맡은 사람 수만큼 깎는다. */
      if(carrier){
        const g2=shotGeom(carrier);
        if(g2 && g2.distM<26){
          const gx2=dir>0?0.02:0.98;
          const ax=(gx2-carrier.x)*PITCH_AR, ay=0.5-carrier.y, al=HYP(ax,ay)||1e-6;
          const px=(a.x-carrier.x)*PITCH_AR, py=a.y-carrier.y;
          const u=clamp((px*ax+py*ay)/(al*al), 0, 1);
          const perp=HYP(px-ax*u, py-ay*u);
          /* ⚠ 「이미 선 위에 있는가」로 매기면 선 위로 「가야 하는」 선수가 후보가 못 된다.
             닿을 수 있는 거리면 후보가 되고, 가까울수록·사거리가 짧을수록 급해진다. */
          const reachL=clamp(1-perp/0.16, 0, 1);
          const nearL=clamp(1-HYP(px,py)/0.26, 0, 1);      // 약 17m — 달려가 막을 수 있는 거리
          const urgent=clamp(1-g2.distM/26, 0, 1);
          let blkTaken=0;
          for(const m of mine) if(m!==a && m.defRole===DEF_ROLE.BLOCK_SHOT) blkTaken++;
          const bandB = (_band0==="DF"||_band0==="SW") ? 0.30 : (_band0==="DM") ? 0.15 : 0.20;
          C.push({r:DEF_ROLE.BLOCK_SHOT,
                  s:reachL*0.90 + nearL*0.75 + urgent*urgent*4.60 + bandB
                    - blkTaken*0.70 + noise(3)});
        }
      }
      if(wLane>0) C.push({r:DEF_ROLE.LANE, s:wLane*(0.30+rPress*0.70)+laneS*2.40+noise(4)});
      /* ⚠ MARK 후보에는 markS 와 무관한 상수항(wMark×성향)이 붙어 있었다. 그래서
         「내 구역에 아무도 없는데」도 MARK 가 이기고, 바로 아래 배정 단계에서 대상을 못 찾아
         LINE 으로 강등됐다(실측: 풀백 기준 30.8%). 역할이 한 틱 동안 헛돌고,
         그 헛된 전환이 멈칫(_hesitateUntil)까지 물고 들어간다.
         ─ 잡을 사람이 있을 때만 후보로 내놓는다. 강등 경로는 이제 안전망으로만 남는다. */
      if(wMark>0 && _mk.o) C.push({r:DEF_ROLE.MARK, s:wMark*(0.30+rMark*0.95)+markS*1.15+noise(5)});
      if(wLine>0) C.push({r:DEF_ROLE.LINE, s:wLine*(0.30+rDeep*0.60)+lineS*1.15+noise(6)});
      a._defS={lane:laneS, mark:markS, line:lineS};      // 디버그·검증용
      if(!C.length) return DEF_ROLE.LINE;
      const prev=a._prevDef;
      let best=C[0], curS=null;
      for(const c of C){ if(c.s>best.s) best=c; if(c.r===prev) curS=c.s; }
      /* 공격과 같은 전환 규칙 — 최소 유지 시간 + 충분한 우위 (§17) */
      /* 🧱 안정화 A-1 — 히스테리시스를 후보 전부에 건다. 예전엔 LANE·MARK·LINE 셋만이라
         SCREEN·SECOND·BLOCK_SHOT 은 매 틱 뒤집혔다. 직전 역할이 아직 후보에 있으면 같은 규칙을 탄다. */
      if(!intentSwitch(a, prev, best.r, best.s, curS, t, "_defRoleAt") && C.some(c=>c.r===prev))
        return prev;
      if(prev!==best.r) a._defRoleAt=t;
      return best.r;
    };
    /* 센터백도 상황을 본다 — 다만 라인 유지가 압도적 선호다.
       코앞에 위험한 상대가 붙으면 스토퍼처럼 나가서 잡을 수 있어야 한다(§24·§25).
       ⚠ 예전에는 LINE 으로 하드코딩되어 있어, 눈앞에 스트라이커가 서 있어도 역할이 고정이었다. */
    /* 🎚️ 자리마다 「선호」만 다르고, 무엇을 할지는 상황이 정한다.
       ⚠ 예전에는 풀백(→MARK)과 피벗(→LANE) 둘만 하드코딩이라 점수 경합 자체를 건너뛰었다.
          풀백은 잡을 사람이 없어도 MARK 를 받았다가 강등됐고(위 ①), 피벗은 박스 앞에서
          슛 각이 열려도 LANE 만 했다 — SCREEN·BLOCK_SHOT 후보를 영영 받지 못했다.
          같은 중앙 미드필더인데 CM 만 다르게 굴러가는 것도 앞뒤가 안 맞았다(LCM·RCM 은 경합했다).
       ⚠ 윙백(LWB·RWB)은 WIDE_SLOTS 에 없어서 최전방과 같은 가지(0,1,2)로 떨어져 있었다 —
          3백에서 윙백이 수비 판단을 제대로 못 받던 자리다. 풀백과 같은 선호로 묶는다. */
    const _fb = (a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB");
    if(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB") r = pickDef(0.15, 0.85, 2.60);
    else if(_fb)
      /* 측면 수비 — 같은 쪽 상대를 잡는 게 본진(markBest 의 짝 가점이 여기서 산다).
         잡을 사람이 없으면 라인을 지키고, 패스 길 위에 서 있으면 길목을 끊는다. */
      r = pickDef(0.45, 2.30, 1.15);
    else if(SLOT_BAND[a.slot]==="DM")
      /* 수비형 미드필더 — 라인이 아니라 「포백 앞」이 본진이다.
         ⚠ 예전에는 else 가지(라인 가중 2.0)로 떨어져, 스크린 후보가 있어도
            늘 LINE 이 이겨 포백 라인에 흡수됐다(장면 검증에서 확인). */
      r = pickDef(1.05, 0.55, 0.65);
    /* 🚧 피벗 — 길목이 본진이되 고정은 아니다.
       ⚠ 한 번 풀었다가 되돌린 자리다. 그때는 laneS 가 통로를 하나만, 그것도 수직거리 5m
          안에서만 재서 평소 값이 0 에 붙어 있었고, 경합에 넘기면 LANE 이 통째로 사라졌다
          (실측 6.4% → 0.8%). laneBest 로 그 뿌리를 고친 뒤 다시 넘긴다.
       ⚠ 푸는 게 맞는 이유 — 고정판에서 CM 은 100% LANE 으로 셌지만, 실제로 「자기 통로」를
          가진 건 41.1% 뿐이었다(4경기 12,802 표본). 나머지 59% 는 통로 없이 붙은 이름표였고,
          그 선수는 자기와 상관없는 최고 위협 통로를 향해 걸어가고 있었다.
          포백 앞을 지키는 일은 SCREEN 이 이미 맡는다 — 그쪽이 정확한 이름이다. */
    else if(a.slot==="CM")      r = pickDef(2.30, 0.80, 0.90);
    else if(MID_SLOTS[a.slot])  r = pickDef(1, 1, 1);
    else if(wmDuty(a)>=WM_DUTY_MIN) r = pickDef(0.8, 1.2, 0.9);   // 🔁 측면 미드필더 — 길목·마크가 본진, 라인은 덜
    else                        r = pickDef(0, 1, 2);   // 최전방·측면은 원래 마크 1 : 라인 2 비율이었다
    /* 🎯 그림자 임무 — 두 번째 압박자였던 선수는 남은 가장 위험한 패스길을 끊는다 */
    if(a._shadowDuty!=null && carrier){
      const _ln2=laneBest(a, carrier, threats.filter(o=>o.id!==a._shadowDuty), dir);
      if(_ln2.o){ r=DEF_ROLE.LANE; _ln.o=_ln2.o; _ln.s=_ln2.s; }
    }
    a.defRole=r;
    a._laneTo = (r===DEF_ROLE.LANE) ? _ln.o : null;
    if(r===DEF_ROLE.MARK){
      /* 🎯 누구를 잡는가 — 위에서 이미 markBest() 로 정해 뒀다.
         예전에는 여기서 짝 표와 점수식을 다시 만들어 「고를 때」와 다른 자로 재느라,
         MARK 를 골라 놓고 사정권 밖이라 아무도 못 잡는 일이 생겼다(→ LINE 강등).
         이제 고른 근거와 잡는 사람이 같은 계산의 결과라 어긋날 방법이 없다. */
      if(_mk.o && _mk.s>0.45){ taken.add(_mk.o.id); a._mark=_mk.o; a._markTight=rMark;
        _leave(a);   /* 🕳️ 사람을 따라가면 내 자리도 빈다 — 장부에 올려야 뒤에 오는 동료가 본다 */ }
      else { a._mark=null; a.defRole=DEF_ROLE.LINE; }   // 사정권에 아무도 없다 — 라인을 지킨다
    } else a._mark=null;
  }
  /* 🎯 압박 출구 잠금 2차 (제보 후속 — BEATEN 중앙 패스의 뿌리). 실측 정리:
       · 라인 간격 가설 기각 — DF-MID 간격 5.6~6.8m·포켓 자유 수신자 0.27명으로 이미 컴팩트
       · 진짜 구멍 — BEATEN 수신의 68~70%가 최근접 수비수 5m 밖. 대부분 전방 압박선을 통과한
         공을 받는 중원 출구(제보의 CB→DM 그 장면)
       · 1차(markBest recvN 가점) 기각 — MARK 점유율만 오르고 대상이 출구가 아니었다
     결정적 배정(두 번째 압박자 shadowDuty 와 같은 패턴): 압박 중이면 가장 자유로운 중앙 출구
     한 명을 고르고, 가장 가까운 자유 미드필더가 사람으로 잡는다. 측면 출구는 안 잠근다 —
     밖으로 모는 건 압박의 성공이다. */
  if(pressers && pressers.length && carrier){
    const _own=v=>dir>0?v:1-v;
    let _ex=null, _exS=0;
    for(const o of opps){
      if(o===carrier || o.slot==="GK") continue;
      if(Math.abs(o.y-0.5)>0.26) continue;
      const _fwd=_own(o.x)-_own(carrier.x);
      if(_fwd>-0.04 || _fwd<-0.22) continue;              // 캐리어의 4~24m 전진 패스 대상만
      let _nd=9;
      for(const p of mine){ if(p.slot==="GK") continue;
        const dd=HYP((p.x-o.x)*PITCH_AR, p.y-o.y); if(dd<_nd) _nd=dd; }
      if(_nd<0.058) continue;                             // 이미 4m 안에 사람이 있다
      const _sc=Math.min(_nd,0.15) + clamp(1-Math.abs(-_fwd-0.13)/0.13, 0, 1)*0.04;
      if(_sc>_exS){ _exS=_sc; _ex=o; }
    }
    if(_ex){
      let _m=null, _md=9;
      for(const p of mine){
        const bd=SLOT_BAND[p.slot];
        if(bd!=="DM" && bd!=="MF") continue;
        if(pressers.includes(p) || p===jockey) continue;
        if(p.defRole===DEF_ROLE.RECOVER || p.defRole===DEF_ROLE.COVER_WIDE) continue;
        if(p.defRole===DEF_ROLE.MARK && p._mark && p._mark.id!==_ex.id) continue;   // 이미 다른 사람을 잡는 중
        const dd=HYP((p.x-_ex.x)*PITCH_AR, p.y-_ex.y);
        if(dd<_md){ _md=dd; _m=p; }
      }
      if(_m && _md<0.16){
        _m.defRole=DEF_ROLE.MARK; _m._mark=_ex; _m._markTight=Math.max(_m._markTight||0, 0.6);
        _m._laneTo=null; taken.add(_ex.id); _leave(_m);
      }
    }
  }
  // ── 판단력(Decisions) — 역할이 바뀌는 순간 멈칫한다.
  // 판단력이 낮을수록 오래 굳어 있고, 그동안은 직전 역할의 목표를 붙들고 있다(역동작).
  for(const a of mine){
    if(a.slot==="GK") continue;
    if(a.defRole===DEF_ROLE.PRESS) a._pressStay=t;      // 🔒 「방금까지 압박하던 사람」 표식
    if(a._dRoleAt==null || a._lastRole!==a.defRole){     // 🔒 역할이 바뀐 시각 — 최소 유지 판정 기준
      a._dRoleAt=t; a._dRoleCid=(carrier?carrier.id:0);
    }
    if(a._lastRole !== a.defRole){
      if(a._lastRole !== undefined){
        const dec=a.decSkill||0.6;
        a._hesitateUntil = t + HESITATE_MAX*(1.15-dec)*(0.5+Math.random()*0.8);
        a._frozenRole = a._lastRole;
        a._frozenMark = a._lastMark;
      }
      a._lastRole = a.defRole;
    }
    a._lastMark = a._mark;
  }
  // ── 수비 라인 동기화 — 라인을 지키는 센터백들의 깊이를 서로 맞춘다(일자 라인).
  // 마크를 나간 선수는 제외한다. 침투를 따라간 선수 때문에 라인이 끌려가면 안 된다.
  const liners=mine.filter(a=>a.defRole===DEF_ROLE.LINE &&
                              (a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB"));
  if(liners.length>=2){
    const own = v => dir>0 ? v : 1-v;
    let sum=0; for(const a of liners) sum+=own(a.x);
    const avg=sum/liners.length;
    for(const a of liners) a._lineOwnX=avg;      // defTargetXY 가 이 깊이로 당겨준다
  } else for(const a of mine) a._lineOwnX=null;

  /* 🧱 뒷선 깊이 — 센터백들이 <b>실제로</b> 서 있는 깊이의 평균.
     풀백이 이 선보다 처지지 않게 하는 바닥값이다 (FB_BEHIND_MAX 주석). */
  {
    const own = v => dir>0 ? v : 1-v;
    const cbs=mine.filter(a=>a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB"||a.slot==="SW");
    let cl=null;
    if(cbs.length>=2){ let s2=0; for(const a of cbs) s2+=own(a.x); cl=s2/cbs.length; }
    for(const a of mine) a._cbLineOwn=cl;
  }

  // ── 센터백 존 마킹 ─────────────────────────────────────────────
  //   센터백은 여태 LINE 역할로 고정돼 있어서 "아무도 잡지 않는" 상태였다.
  //   LINE 목표는 자기 전술 앵커를 볼 쪽으로 조금 당긴 값이라 상대 공격수의 위치를 아예 보지 않는다.
  //   그래서 센터백 둘 사이에 선 스트라이커가 그냥 free 로 공을 받았다.
  //   ─ 사람을 따라 피치를 가로지르는 대인마크가 아니라, 실제 존 수비처럼
  //     "내 구역에 들어온 공격수를 잡는다". 라인 깊이(x)는 그대로 두므로 오프사이드 라인도 유지된다.
  for(const a of mine){ a._zmPrev=a._zoneMark; a._zoneMark=null; }
  // LINE 뿐 아니라 COVER 로 내려앉은 센터백도 담당을 잡는다.
  // (LINE 은 전체의 34%뿐이라, LINE 에만 걸면 대부분의 시간 동안 아무도 안 잡는다)
  /* ⚠ 주석으로만 약속하고 코드는 LINE 만 걸렀던 버그 — LINE 은 전체의 34%뿐이라
     센터백이 대부분의 시간 동안 스트라이커를 방치했다("마킹 위치를 잘못 잡는다"는 그 제보). */
  const cbs=mine.filter(a=>(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB") &&
                            (a.defRole===DEF_ROLE.LINE || a.defRole===DEF_ROLE.COVER));
  if(cbs.length){
    /* ⚠ 단위 버그 — CB_ZONE_X(34) 는 미터인데 등방 좌표(최대 1.57)와 비교하고 있었다. 조건이 항상 참이라
       「우리 진영 깊숙이 들어온 상대만」이 죽어 있었고, 가까운 위협이 13m 밖이면 다음 순번인 상대 미드필더를
       담당으로 잡았다(추적: RCB~LCM·LM). ×ISO_TO_M 으로 미터로 맞춘다. */
    const inZone=opps.filter(o=>o.slot!=="GK" &&
      Math.abs(o.x-ownGoalX)*PITCH_AR*ISO_TO_M < CB_ZONE_X);   // 우리 진영 깊숙이 들어온 상대만
    inZone.sort((p,q)=>Math.abs(p.x-ownGoalX)-Math.abs(q.x-ownGoalX));  // 골문에 가까운 위협부터
    const used=new Set(), usedO=new Set();
    for(const c of mine) if((c.slot==="CB"||c.slot==="LCB"||c.slot==="RCB") && c._mark) usedO.add(c._mark.id);
    /* 🧱 안정화 A-2 — 존마크 유지. 직전 담당이 아직 구역 안(폭 ×CB_ZONE_KEEP_Y, 거리 ×CB_ZONE_KEEP_D)이면
       바꾸지 않는다. 매 틱 「골문 가까운 순 → |Δy| 최소 CB」 재배정이라 붙으러 가는 도중에 대상이 바뀌어
       영원히 6m 밖이었다(실측 대상 교체 분당 11.9회, 거리 중앙값 6.5m). */
    for(const c of cbs){
      const p=c._zmPrev; if(!p || !inZone.includes(p)) continue;
      if(Math.abs(c.y-p.y)>=CB_ZONE_Y*CB_ZONE_KEEP_Y) continue;
      if(HYP((p.x-c.x)*PITCH_AR, p.y-c.y)*ISO_TO_M>CB_ZONE_NEAR*CB_ZONE_KEEP_D) continue;
      c._zoneMark=p; used.add(c.id); usedO.add(p.id);
    }
    for(const o of inZone){
      if(usedO.has(o.id)) continue;
      let best=null, bd=1e9;
      for(const c of cbs){
        if(used.has(c.id)) continue;
        const d=Math.abs(c.y-o.y);                        // 좌우 구역 기준으로 담당을 가른다
        if(d<bd){ bd=d; best=c; }
      }
      if(!best || bd>=CB_ZONE_Y) continue;
      // 너무 멀면 붙으러 가지 않는다 — 라인을 버리고 뛰쳐나가면 뒷공간이 열린다
      const near=HYP((o.x-best.x)*PITCH_AR, o.y-best.y)*ISO_TO_M;
      if(near>CB_ZONE_NEAR) continue;
      best._zoneMark=o; used.add(best.id);
    }
  }
}
/* 수비 역할별 목표 지점 */
/* ⚠ 🚫 «물러나지 않는다»(볼에서 멀어지는 목표를 받으면 제자리에 선다)를 넣었다가 걷어냈다 —
   물러남 112 → 124 로 <b>되레 나빠지고</b> 밸런스가 무너졌다(골 2.27 → 1.20 · 선방% 64 → 85).
   제자리에 선 선수가 대형의 빈 자리를 만들고, 그 자리를 메우러 온 다른 수비수가 다시 물러난다.
   ─ 이 계열(래치·평활·정지)은 전부 같은 결말이다. 남은 떨림은 계수가 아니라
     압박 점수를 «누가 갈 수 있는가»로 다시 짜야 풀린다. */
function defTargetXY(a, anchor, ball, carrier, threat, dir){
  const ownGoalX = dir>0 ? 0.015 : 0.985;
  /* 판단이 굳어 있는 동안에는 바뀌기 전 역할의 목표를 붙들고 있다 — 역동작이 그대로 보인다.
     ⚠ 압박·저지는 예외다. 공을 잡으러 나가는 건 「망설이다 늦는」 종류의 결정이 아니고,
        여기에 멈칫을 걸면 압박자가 옛 역할의 자리에 붙들려 압박 자체가 사라진다
        (실측: 파울 21.9 → 7.4, 상대 슛 15.1 → 30.3). */
  /* ⚽ SECOND 도 예외 — 단계 추적(빌드 1600 작업 중): 역할이 SECOND 로 바뀐 뒤에도 0.4~1초 동안 옛 역할(LINE)의
     목표를 붙들었고(멈칫), 풀린 뒤에도 스무딩(τ≈1.1초)이 12→8→5m 로 기어갔다. 비행 2초짜리 크로스에는 치명적. */
  /* 🔒 붙어 있던 사람은 계속 붙는다 — 역할표가 뒤집혀도 <b>물러나지 않는다</b>.
     ⚠⚠ 제보 — 「수비수가 다가왔다가 뒤로 갔다가 다시 다가온다」.
        실측(측면 깊은 곳): 수비 역할이 <b>선수당 분당 30회</b> 바뀌고, 전환쌍이 완벽히 대칭이다
        (PRESS↔MARK 227/221 · PRESS↔SCREEN 141/140). 판단이 아니라 떨림이다.
        PRESS 일 때 목표는 「볼」, MARK·SCREEN·LINE 일 때는 「대형 안 자리」라
        한 번 뒤집힐 때마다 선수가 10m 를 앞뒤로 오간다 — 화면에 보이는 게 그것이다.
        ⚠ 떨림 자체를 잡으려고 세 가지를 먼저 시도했지만 전부 헛수고였다(31 → 31 → 29.5):
           ① 압박자 전념 가산(PRESS_COMMIT) ② 압박자 명단 0.4초 고정 ③ 역할 잡음 고정.
           손잡이는 「누구를 뽑는가」가 아니라 <b>「뽑히지 않은 순간 어디로 가는가」</b>였다.
     ─ 볼에서 6m 안에 있고 방금까지 압박하던 사람은, 역할표가 뭐라 하든 2초 동안 계속 압박한다.
       떨림은 남아도 <b>그림은 흔들리지 않는다</b>. */
  const _dBall = HYP((ball.x-a.x)*PITCH_AR, ball.y-a.y);
  /* ⚠ 2.0초·6m 로 잡았더니 <b>수비가 과해졌다</b> — 슛 27.2→20.3 · 크로스 35.1→28.1 ·
     태클 34.5→39.9. 붙어 있던 사람이 계속 붙으면 사실상 상시 협력수비가 된다.
     「물러나는 그림」만 지우면 되므로 창을 절반으로 줄인다(1.0초·4.5m). */
  const _stayPress = a.defRole!==DEF_ROLE.PRESS && a._pressStay!=null
                     && (a._now-a._pressStay)<0.6 && _dBall<0.053;
  /* ⚠ 1.0초·4.5m 도 아직 셌다 — 크로스 35.1 → 27.8(실축 38) · 파울 25.1 → 28.3.
     붙어 있던 사람이 오래 붙으면 측면 공격 자체가 사라진다. 창을 0.6초·3.5m 까지 줄인다:
     「닿을 거리까지 갔다가 곧바로 물러나는」 그 한 장면만 지우는 최소폭이다. */
  const _live = (a.defRole===DEF_ROLE.PRESS || a.defRole===DEF_ROLE.JOCKEY || a.defRole===DEF_ROLE.SECOND || _stayPress);
  const _froz = !_live && a._hesitateUntil && a._hesitateUntil>a._now;
  const role = _stayPress ? DEF_ROLE.PRESS : (_froz ? a._frozenRole : a.defRole);
  const mark = _froz ? a._frozenMark : a._mark;
  switch(role){
    /* 🛡️ 압박·저지 — 공으로 곧장 달려들지 않는다 (§14·§62).
       ① 우리 골문과 볼을 잇는 선 위로 들어가 슛·전진 경로를 먼저 막고
       ② 바깥쪽(터치라인)으로 몰아붙인다. ③ 저지면 간격을 두고 따라간다.
       ⚠ 이 두 역할만 좌표를 이 함수 밖(이동 루프)에서 따로 만들고 있었다.
          defTargetXY 에는 case 자체가 없어 default(LINE)로 떨어졌고, 실제 자리는 다른 곳에서 났다.
          역할 체계가 좌표를 책임지지 않는 유일한 예외였다 — 여기로 들인다. */
    case DEF_ROLE.PRESS:
    case DEF_ROLE.JOCKEY: {
      const own = (dir>0) ? 0.02 : 0.98;                 // 우리 골문 쪽
      let gx=(own-ball.x)*PITCH_AR, gy=0.5-ball.y;
      const gl=HYP(gx,gy)||1e-6;
      const jk=(role===DEF_ROLE.JOCKEY) || (a._pressPurpose===PRESS_PURPOSE.DELAY);
      /* 📏 <b>압박 강도가 «간격»을 정한다.</b>
         ⚠⚠ 제보: 「압박 강도에 따라 상대와 얼마나 거리를 두는지 봐 달라, 지금은 너무 붙는다」.
            실측(같은 시드, 압박 슬라이더 0~4 로 한 경기씩):
              압박자–캐리어 거리  자제 <b>2.45m</b> · 보통 3.28m · 극한 <b>4.84m</b>
              동시 압박 인원      자제 0.90 · 보통 1.11 · 극한 1.61
            <b>거리가 거꾸로다.</b> 목표 간격은 JOCKEY_D×0.30 = <b>0.55m 상수</b>라 설정과 무관하고,
            슬라이더는 「몇 명이 나가는가」만 바꾼다. 압박을 올리면 <b>더 먼 선수까지</b> 압박자로
            뽑혀서 평균 거리가 되레 늘어난 것이다 — 간격이 조절된 게 아니다.
            그래서 「압박 자제」를 골라도 나간 사람은 공 앞 반 미터까지 파고든다.
         ─ 슬라이더가 실제로 «간격»을 정하게 한다.
             압박 자제 ≈ 2.3m (지연·각만 막는다) · 보통 ≈ 1.5m · 극한 압박 ≈ 0.6m (밀착)
           저지(JOCKEY·DELAY)도 같은 방향으로 움직이되 폭은 절반이다 — 원래 간격을 두는 역할이라. */
      const _pTac=clamp(TAC(a.team).press!=null?TAC(a.team).press:1, 0, 2);
      const _gapK=PRESS_GAP_LO + (PRESS_GAP_HI-PRESS_GAP_LO)*(1-_pTac/2);
      const stand=jk ? JOCKEY_D*(1+(_gapK-1)*0.45) : JOCKEY_D*0.30*_gapK;
      /* 🧭 압박도 「골문 중앙」만 보고 있었다 — 캐리어가 <b>지금 몰고 가는 방향</b>을 섞는다.
         실측: 압박자가 캐리어의 진행 방향 길목에 있던 비율 하프스페이스에서 <b>25.5%</b>.
         드리블 방향을 무시하면 옆이나 뒤에서 따라붙게 되고, 그게 「막지 못하고 따라만 다니는」 그림이다. */
      if(carrier && role===DEF_ROLE.PRESS){
        const _cvx=(carrier.vx||0)*PITCH_AR, _cvy=(carrier.vy||0), _cvl=HYP(_cvx,_cvy);
        if(_cvl>MARK_V_MIN){
          const _w=PRESS_V_W*clamp(_cvl/(SPD.RUN*SIM_DT), 0, 1);
          const _nx=(gx/gl)*(1-_w)+(_cvx/_cvl)*_w, _ny=(gy/gl)*(1-_w)+(_cvy/_cvl)*_w;
          const _nl=HYP(_nx,_ny)||1e-6;
          gx=_nx*gl/_nl*1; gy=_ny*gl/_nl*1;   // 길이는 유지하고 방향만 돌린다
        }
      }
      /* 🎯 커버 섀도 — 그림자 대상이 있으면 캐리어→그림자 선 위에 선다 (pressPurposeFor 주석) */
      /* 🚫 클로즈다운 — 골사이드가 아니면 먼저 슛 선을 잡고, 잡았으면 볼로 붙는다 (CLOSE 주석) */
      if(role===DEF_ROLE.PRESS && a._pressPurpose===PRESS_PURPOSE.CLOSE){
        const ux=gx/gl, uy=gy/gl;
        const px=(a.x-ball.x)*PITCH_AR, py=a.y-ball.y, pl=HYP(px,py)||1e-6;
        const cs=(px*ux+py*uy)/pl;
        if(cs<CLOSE_COS){
          /* 2차 — 몸을 돌아가는 호(弧): 선 위 앞 지점(최소 2.1m) + 내가 있는 쪽으로 옆 성분. 등 뒤(cos=-1)면 최대 */
          const e=clamp(pl*0.9, CLOSE_MIN_E, CLOSE_ARC);
          const cr=px*uy-py*ux, sd=(cr<0)?1:-1;
          const w=CLOSE_SWING*clamp((CLOSE_COS-cs)/(CLOSE_COS+1), 0, 1);
          const nx=-uy*sd*w, ny=ux*sd*w;
          return {x:clamp01(ball.x + (ux*e+nx)/PITCH_AR), y:clamp01(ball.y + uy*e+ny)};
        }
        return {x:clamp01(ball.x + ux*stand/PITCH_AR), y:clamp01(ball.y + uy*stand)};
      }
      /* 🛤️ 회랑 가장자리 — PRESS 인데 캐리어가 회랑의 1.25배 밖이면 홈→캐리어 선 위 회랑 끝에서 저지 간격으로 선다.
         🚨 ⚠ 여기가 「멀찍이 서서 구경하는」 그림을 만드는 자리였다. 압박자로 뽑혀 놓고도
            회랑 끝(홈에서 8~11m)에 멈춰 서서, 캐리어와 5~9m 를 벌린 채 가만히 있었다.
            볼이 우리 진영 깊이 들어왔으면 지킬 대형이 없다 — 끝까지 나간다. */
      if(role===DEF_ROLE.PRESS && !(a._pressRelax>0.5) && a._pressHome && a._pressCorr && a._pressHomeD>a._pressCorr*1.15){
        const hx=(ball.x-a._pressHome.x)*PITCH_AR, hy=ball.y-a._pressHome.y, hl=HYP(hx,hy)||1e-6;
        const e=a._pressCorr*1.15;
        const _tx=clamp01(a._pressHome.x + (hx/hl)*e/PITCH_AR), _ty=clamp01(a._pressHome.y + (hy/hl)*e);
        /* 🚫 <b>물러나게 만들지 않는다</b> — 이미 그 지점보다 볼에 가까이 있으면 그대로 둔다.
           ⚠ 제보 — 「수비수가 다가왔다가 뒤로 갔다가 다시 다가온다」. 완화 래치가 잠깐 꺼지는
              순간 이 분기가 되살아나 <b>붙어 있던 수비수를 회랑 끝으로 도로 끌어냈다.</b>
              래치를 히스테리시스로 바꿔도(0.58 → 0.28회/초) 한 번만 꺼져도 눈에는 그 「후진」이 보인다.
              회랑은 「멀리까지 쫓아가지 마라」는 장치이지 「붙었다가 물러나라」는 장치가 아니다.
              앞으로 나가는 방향으로만 쓴다 — 그러면 플래그가 흔들려도 그림은 흔들리지 않는다. */
        const _dMe =HYP((ball.x-a.x)*PITCH_AR, ball.y-a.y);
        const _dTgt=HYP((ball.x-_tx)*PITCH_AR, ball.y-_ty);
        if(_dMe > _dTgt) return {x:_tx, y:_ty};      // 아직 회랑 끝보다 멀다 — 거기까지만 나간다
        /* 이미 더 가깝다 — 물러나지 않고 아래의 일반 압박 자리로 이어 간다 */
      }
      /* 🪽 <b>윙어 지역 — 골문 «중앙» 이 아니라 캐리어의 «전진 통로» 앞을 막는다.</b>
         ⚠⚠ 제보: 「수비수가 상대가 돌파할 수 있는 공간을 마킹하려고 안 한다, 특히 윙어 지역」.
            실측(3경기, 터치라인 쪽 + 상대 진영 3분의 1, 캐리어 기준 가장 가까운 수비수):
              거리 중앙값 <b>2.3m</b> — 붙어는 있다.
              안쪽(컷인) 통로 각도 <b>78.8°</b> · 바깥(바이라인) 통로 각도 <b>138.7°</b>
              <b>두 통로 모두 안 막고 있는 시간 70.3%</b> (안쪽 차단 24.3% · 바깥 차단 12.2%)
            78.8° 는 「옆에 나란히」, 138.7° 는 「뒤에」 라는 뜻이다. 몸이 통로에 안 들어가 있다.
            원인은 기준 벡터다 — 압박 자리는 캐리어→<b>골문 중앙</b> 선 위인데, 윙어 자리에서
            골문 중앙은 «안쪽 뒤편» 대각선이다. 그 자리는 골사이드로는 맞지만
            윙어가 실제로 갈 두 곳(안쪽 컷인·바이라인)은 <b>둘 다 열어 둔다.</b>
         ─ 윙어 지역에서는 기준을 바꾼다: <b>캐리어가 전진하는 방향의 앞</b>에 서고,
           반 발 안쪽으로 치우쳐 컷인을 막고 바깥(터치라인)을 보여준다 — 실제 수비의 기본이다.
           간격도 조금 벌린다(WING_STAND): 코앞에 붙으면 통로를 «막는» 게 아니라 몸만 대는 것이다. */
      if(role===DEF_ROLE.PRESS && carrier){
        const _wSd=(ball.y<0.5?-1:1);
        const _wOwn=(dir>0?ball.x:1-ball.x);
        if(Math.abs(ball.y-0.5)>WING_Y && _wOwn<WING_X){
          const _fx=(own-ball.x)>0 ? 1 : -1;              // 캐리어가 전진하는 x 방향(우리 골문 쪽)
          let _wx=_fx*1.0, _wy=-_wSd*WING_IN;             // 앞 + 반 발 안쪽
          const _wl=HYP(_wx,_wy)||1e-6; _wx/=_wl; _wy/=_wl;
          /* 통로를 «막으려면» 몸이 통로 안에 들어가야 한다 — 코앞 간격(약 1m)으로는 옆에 서는 것과 같다.
             최소 절대 간격을 준다(WING_MIN). */
          const _ws=Math.max(stand*WING_STAND, WING_MIN*clamp(_gapK/2.65, 0.72, 1.45));
          return {x:clamp01(ball.x + _wx*_ws/PITCH_AR), y:clamp01(ball.y + _wy*_ws)};
        }
      }
      /* 🔄 제쳐졌다 — 사거리 밖에서도 볼 뒤 꼬리 추격 대신 볼→우리 골문 선의 앞 지점으로 돌아 들어간다 (CLOSE 호와 같은 기하) */
      if(role===DEF_ROLE.PRESS){
        const px2=(a.x-ball.x)*PITCH_AR, py2=a.y-ball.y, pl2=HYP(px2,py2)||1e-6;
        const ux2=gx/gl, uy2=gy/gl;
        const cs2=(px2*ux2+py2*uy2)/pl2;
        if(cs2<-0.20){
          const e=clamp(pl2*0.9, CLOSE_MIN_E, 0.075);
          const cr=px2*uy2-py2*ux2, sd=(cr<0)?1:-1;
          const w=CLOSE_SWING*clamp((-cs2)/1.2, 0, 1);
          return {x:clamp01(ball.x + (ux2*e - uy2*sd*w)/PITCH_AR), y:clamp01(ball.y + uy2*e + ux2*sd*w)};
        }
      }
      const sh=(role===DEF_ROLE.PRESS) ? a._pressShadow : null;
      if(sh && a._pressPurpose!==PRESS_PURPOSE.WIN){
        const sx=(sh.x-ball.x)*PITCH_AR, sy=sh.y-ball.y, sl=HYP(sx,sy)||1e-6;
        return {x:clamp01(ball.x + (sx/sl)*stand/PITCH_AR), y:clamp01(ball.y + (sy/sl)*stand)};
      }
      const outw=(ball.y<0.5?-1:1)*stand*0.55;           // 중앙보다 측면으로 밀어낸다
      return {x:clamp01(ball.x + (gx/gl)*stand/PITCH_AR),
              y:clamp01(ball.y + (gy/gl)*stand + outw)};
    }
    case DEF_ROLE.MARK: {   // 마크 대상과 우리 골문 사이(골사이드)에 선다
      const m=mark; if(!m) break;
      const own = v => dir>0 ? v : 1-v;
      const deep=blockDepth(ball, dir);
      /* 🎯 얼마나 붙어 서는가 — 밀착 마크 성향과 마킹 능력이 간격을 정한다.
         바짝 붙으면 공을 못 받게 하지만 등지고 돌아서면 뚫린다.
         떨어져 서면 안전하지만 앞에서 받아 돌아설 시간을 준다. (§8) */
      const tight = clamp(0.24 + (a._markTight||0)*0.55 + (a.markSkill||0.6)*0.40, 0.15, 1.20);
      /* 밸런스 사이클(요청) — 골 21 → 30 의 정체는 「4m 안에 수비수 없는 슛」 17 → 29. 마크 거리 중앙값 4.7m 는
         박스에서 자유 슛이다. 볼이 우리 골문 근처(deep)일수록 간격을 줄인다: deep=1 이면 절반. */
      const stand0 = (0.058 - tight*0.042) * (1 - deep*0.5);   // 3.9m(느슨) ~ 0.6m(밀착) · 깊을수록 밀착
      /* 🚧 측면 마크 — 크로스 각을 막는다.
         ⚠ 제보 — 「공격수가 박스 측면에 가만히 서 있는데 수비수들이 거리를 두고 구경한다.
            현실 축구라면 거리를 좁히고 크로스 각을 막을 텐데」.
            마커는 담당보다 <b>안쪽</b>으로 당겨 서고 있었다(y 보정 0.08~0.20 = 최대 5.5m).
            중앙을 비우지 말라는 뜻이지만 측면에서 그러면 담당과 터치라인 사이가 통째로 열린다.
            크로스는 정확히 그 열린 각으로 올라간다 — 담당 옆에 서 있는데도 못 막는 이유였다.
         ─ 담당이 측면(중앙선에서 11m 밖)이고 우리 진영 깊이 있으면
           ① 안쪽 보정을 끄고 반 발 <b>바깥</b>에 붙어 서서 안으로 몰고
           ② 간격을 절반으로 좁힌다. */
      const _wideM = Math.abs(m.y-0.5) > 0.165 && own(m.x) < 0.42;
      /* ⚠ 간격까지 절반으로 좁혔더니 <b>과했다</b> — 골 2.97 → 1.93 · 선방률 66.9 → 77.5.
         크로스 각을 지우는 건 <b>서는 위치(바깥)</b>가 하는 일이지 간격이 아니다. 간격은 그대로 둔다. */
      const stand = _wideM ? stand0*0.82 : stand0;
      /* 🧭 <b>어디를 막는가</b> — 제보: 「상대가 이동할 방향의 길목을 막아야 하는데 엉뚱한 자리에 선다」.
         ⚠⚠ 코드가 정확히 그랬다. 골사이드를 <b>x축 한 방향으로만</b> 잡고 있었다(own(m.x) − stand).
            골문은 «점»이라 방향이 대각선인데, 담당 앞을 세로로만 막으면 하프스페이스처럼
            골문이 비스듬히 있는 자리에서는 <b>대각선이 통째로 열린다.</b>
            실측(하프스페이스, 3경기): 담당의 <b>진행 방향</b> 기준 각도 오차 중앙값 <b>106.7°</b> —
            90°를 넘는다는 건 상대가 가려는 쪽의 <b>반대편</b>에 서 있었다는 뜻이다.
            실제로 길을 막고 있던 비율은 <b>16.5%</b>. 골문 기준으로도 96.4°로 틀렸다
            (하프스페이스 밖에서는 81.8° — 대각선일수록 나빠진다는 게 원인의 증거다).
         ─ 두 가지를 벡터로 합쳐 그 «위험 방향» 위에 선다.
           ① 담당 → 우리 골문 (대각선 포함)   ② 담당이 <b>지금 달리는 방향</b>
           멈춰 있으면 ①만 쓴다. 달리고 있으면 그쪽 길목을 먼저 막는다 — 그게 「따라다니기」와
           「길을 끊기」의 차이다. */
      const _gvx=((dir>0?0.02:0.98)-m.x)*PITCH_AR, _gvy=0.5-m.y, _gvl=HYP(_gvx,_gvy)||1e-6;
      let _ux=_gvx/_gvl, _uy=_gvy/_gvl;
      const _mvx=(m.vx||0)*PITCH_AR, _mvy=(m.vy||0), _mvl=HYP(_mvx,_mvy);
      if(_mvl>MARK_V_MIN){
        const _w=MARK_V_W*clamp(_mvl/(SPD.RUN*SIM_DT), 0, 1);
        _ux=_ux*(1-_w)+(_mvx/_mvl)*_w; _uy=_uy*(1-_w)+(_mvy/_mvl)*_w;
        const _ul=HYP(_ux,_uy)||1e-6; _ux/=_ul; _uy/=_ul;
      }
      /* stand 는 예전에 «x-iso» 단위로 쓰였다 — 등방 거리로 옮기면서 크기를 그대로 보존한다
         (골문이 정면일 때 예전과 완전히 같은 자리가 된다). */
      const _sI=(stand+deep*0.010)*PITCH_AR;
      /* 🔮 <b>담당이 있을 자리로 간다</b> — 추격자는 구조적으로 항상 뒤처진다.
         목표가 「담당 + 오프셋」이면 담당이 움직이는 한 목표도 같이 움직여서, 아무리 빨라도
         간격이 안 줄어든다. 실측: 마커는 자기 목표에서 중앙값 3.4m 뒤 — 담당까지 거리(4.0m)와
         거의 같다. 즉 <b>영원히 반 박자 늦은 자리</b>에 서 있다.
         ─ 실제 수비수는 지금 위치가 아니라 <b>갈 곳</b>을 보고 먼저 가 있는다. 담당의 속도로
           MARK_LEAD 초 앞을 내다본 지점 기준으로 자리를 잡는다. */
      const _lx=m.x + (m.vx||0)*(MARK_LEAD/SIM_DT), _ly=m.y + (m.vy||0)*(MARK_LEAD/SIM_DT);
      let _mx2=_lx + (_ux*_sI)/PITCH_AR, _my2=_ly + _uy*_sI;
      /* 🚧 측면은 반 발 «바깥»으로 — 안으로 몰아 크로스 각을 지운다 (위 주석) */
      if(_wideM) _my2 = _my2 + (m.y<0.5?-1:1)*0.013;
      else       _my2 = _my2 + (0.5-m.y)*(0.05+deep*0.08);
      const _own2=dir>0?_mx2:1-_mx2;
      if(_own2<0.022) _mx2 = dir>0?0.022:0.978;
      return {x:clamp01(_mx2), y:clamp01(_my2)};
    }
    case DEF_ROLE.LANE: {   // 볼 소유자와 그가 노리는 상대 사이를 끊는다
      const th = a._laneTo || threat;
      if(!carrier || !th) break;
      /* ⚠ 예전에는 통로의 <b>중점</b>으로 갔다. 중점은 대개 상대 진영 한복판이라
         수비수는 그 자리에 영영 못 가고, 「길목을 막는」 그림이 아니라 「볼을 따라가는」 그림이 됐다.
         ─ 선 위에서 내가 가장 가까운 지점에 선다. 그게 통로를 몸으로 가로막는 자리다. */
      const ax=(th.x-carrier.x)*PITCH_AR, ay=th.y-carrier.y;
      const L2=ax*ax+ay*ay;
      const px=(a.x-carrier.x)*PITCH_AR, py=a.y-carrier.y;
      const u=L2>1e-9 ? clamp((px*ax+py*ay)/L2, 0.15, 0.92) : 0.5;
      const lx=carrier.x + (ax*u)/PITCH_AR, ly=carrier.y + ay*u;
      // 볼이 우리 박스 근처면 길목만 끊는 게 아니라 골문 앞으로 내려앉는다(로우블록).
      /* 골문 쪽으로 당기는 정도 — 길목 차단자는 선 위에 있어야 뜻이 있다.
         옛 값(0.10+deep×0.30)은 기준점이 「통로의 중점」(상대 진영 쪽)이던 시절의 것이라
         지금 기준점(내 투영점)에 그대로 쓰면 선에서 뒤로 물러나 버린다.
         실측에서도 그쪽이 유효슛 비율은 떨어지고 파울만 늘었다(46% → 38.5%, 20.0 → 25.3). */
      const deep=blockDepth(ball, dir);
      const pull=0.06+deep*0.26;
      return {x:clamp01(lx+(ownGoalX-lx)*pull), y:clamp01(ly+(0.5-ly)*deep*0.40)};
    }
    case DEF_ROLE.SCREEN: {
      /* 🛡️ 스크린 — 볼과 우리 골문을 잇는 선 위, 「포백보다 앞」에 선다.
         포백 라인까지 내려가는 게 아니라, 포백이 직접 상대하기 전에 길을 끊는 자리다.
         ⚠ 이게 없으면 미드필더는 볼로 달려가거나(LANE) 라인에 붙거나(LINE) 둘뿐이라,
            포백과 미드필더 사이의 「사이 공간」이 늘 비어 있었다. */
      const own = v => dir>0 ? v : 1-v;
      const deep=blockDepth(ball, dir);
      /* 우리 뒷선보다 이만큼 앞 — 볼이 가까울수록 붙어 선다 (약 12m → 6m) */
      const ahead = 0.115 - deep*0.055;
      const lineOwn = (a._lineOwnX!=null) ? a._lineOwnX : own(anchor.x);
      const sx = clamp(lineOwn + ahead, 0.05, 0.62);
      /* 좌우는 볼과 골문을 잇는 선 위 — 중앙을 비우지 않는다 */
      const sy = 0.5 + (ball.y-0.5)*(0.32+deep*0.26);
      return {x:clamp01(dir>0?sx:1-sx), y:clamp01(sy)};
    }
    case DEF_ROLE.BLOCK_SHOT: {
      /* 🚫 슛 각 차단 — 볼과 골문 중앙을 잇는 선 위, 볼 쪽으로 바짝 (§11·§12) */
      if(!carrier) break;
      const gx = dir>0 ? 0.02 : 0.98;
      const dx=(gx-carrier.x)*PITCH_AR, dy=0.5-carrier.y;
      const dl=HYP(dx,dy)||1e-6;
      const step=0.055;                                  // 볼에서 약 3.7m 앞
      return {x:clamp01(carrier.x + (dx/dl)*step/PITCH_AR),
              y:clamp01(carrier.y + (dy/dl)*step)};
    }
    case DEF_ROLE.SECOND: {
      /* ⚽ 세컨볼 — 뜬 공의 <b>실제</b> 낙하 지점을 선점한다 (§27).
         ⚠ 여기도 b.tx/b.ty(의도한 목표)를 보고 있었다 — 후보를 고르는 쪽과 서 있는 쪽이
            둘 다 틀린 좌표를 보면 아무리 사람을 보내도 경합이 안 열린다. */
      const LP=ballLand(ball, a._now);
      return {x:LP.x, y:LP.y};
    }
    case DEF_ROLE.DROP: {   // 동료가 비운 자리로 내려앉는다 — 자기 자리와 그 자리의 사이
      const f=a._fillAt||anchor;
      return {x:clamp01(anchor.x*0.30+f.x*0.70), y:clamp01(anchor.y*0.30+f.y*0.70)};
    }
    case DEF_ROLE.BACKFILL: {
      /* 🛡️ 역습 대비로 뒷선에 합류하는 경우는 「그 줄에 들어가 서는 것」이 목적이다 —
         중간에서 어정쩡하게 멈추면 숫자가 맞지 않는다. 목표 지점까지 확실히 내려간다. */
      const f=a._fillAt||anchor;
      return {x:clamp01(anchor.x*0.08+f.x*0.92), y:clamp01(anchor.y*0.08+f.y*0.92)};
    }
    case DEF_ROLE.RECOVER:  // 자기 수비 위치로 전력 복귀
      return {x:a._recover?a._recover.x:anchor.x, y:a._recover?a._recover.y:anchor.y};
    case DEF_ROLE.COVER_WIDE: { // 풀백이 비운 측면을 메운다 (자기 자리와 그 공간의 중간)
      const c=a._coverAt||anchor;
      return {x:clamp01(anchor.x*0.35+c.x*0.65), y:clamp01(anchor.y*0.35+c.y*0.65)};
    }
    case DEF_ROLE.COVER: {
      // 동료가 압박하러 나갔으면 그 "대각선 뒤"를 지킨다 — 뚫렸을 때 받아줄 자리다.
      if(a._coverBehind){
        const pb=a._coverBehind;
        const ang=Math.atan2(0.5-pb.y, (ownGoalX-pb.x)*PITCH_AR);   // 압박 지점 → 우리 골문 방향
        const back=0.075;                                            // 그만큼 뒤로 (약 5m)
        return {x:clamp01(pb.x+Math.cos(ang)*back/PITCH_AR),
                y:clamp01(pb.y+Math.sin(ang)*back)};
      }
      {
        let cx=goalSideX(anchor, ball, dir, 0.22, 0.090+blockDepth(ball,dir)*0.030);
        let cy=clamp01(anchor.y+(ball.y-anchor.y)*compactY(ball,dir,0.25));
        if(a._cbShift) cy=clamp01(cy + a._cbShift*CB_SLIDE_Y);   // ↔️ 3백 연쇄
        if(a._zoneMark){ const m=a._zoneMark;
          cy=clamp01(cy+(m.y-cy)*CB_MARK_Y);
          const own=v=>dir>0?v:1-v, gX=dir>0?0.015:0.985;
          const want=Math.max(own(gX)+0.020, own(m.x)-CB_MARK_GOALSIDE);
          const cur=own(cx);
          const mx=cur*(1-CB_MARK_X)+Math.min(cur,want)*CB_MARK_X;
          cx=clamp01(dir>0?mx:1-mx);
        }
        return {x:cx, y:cy};
      }
    }
    case DEF_ROLE.LINE:
    default: {
      const dpL=blockDepth(ball,dir);
      let tx=goalSideX(anchor, ball, dir, 0.14, 0.058+dpL*0.028);
      // 센터백끼리 깊이를 맞춰 일자 라인을 만든다
      if(a._lineOwnX!=null){
        const own = v => dir>0 ? v : 1-v;
        // 조직력이 낮으면 라인이 따로 논다 — 센터백끼리 깊이를 맞추는 정도를 그만큼 깎는다
        const sync = clamp(LINE_SYNC*(1+(a.teamFamK||0)*0.22), 0.20, 0.80);
        const merged = own(tx)*(1-sync) + a._lineOwnX*sync;
        tx = clamp01(dir>0 ? merged : 1-merged);
      }
      let ty=clamp01(anchor.y+(ball.y-anchor.y)*compactY(ball,dir,0.30));
      if(a._cbShift) ty=clamp01(ty + a._cbShift*CB_SLIDE_Y);   // ↔️ 3백 연쇄 — 슬라이드 쪽으로 한 칸
      // 내 구역에 들어온 공격수를 잡는다 — 라인 깊이는 그대로 두고 좌우로만 붙는다.
      // 이게 없으면 센터백 둘은 각자 전술 자리에 서 있고, 그 사이가 통째로 비어 있다.
      if(a._zoneMark){
        const m=a._zoneMark;
        ty = clamp01(ty + (m.y-ty)*CB_MARK_Y);
        // 등 뒤로 빠지지 않게 골사이드로 조금 더 — 다만 라인이 무너지지 않을 만큼만
        const own = v => dir>0 ? v : 1-v;
        const goalX = dir>0 ? 0.015 : 0.985;
        const want = Math.max(own(goalX)+0.020, own(m.x)-CB_MARK_GOALSIDE);
        const cur=own(tx);
        const mx = cur*(1-CB_MARK_X) + Math.min(cur, want)*CB_MARK_X;
        tx = clamp01(dir>0 ? mx : 1-mx);
      }
      return {x:tx, y:ty};
    }
  }
  return {x:goalSideX(anchor, ball, dir, 0.14, 0.058), y:clamp01(anchor.y+(ball.y-anchor.y)*compactY(ball,dir,0.30))};
}
/* ══ 🧱 수비 셰이프 매니저 ═══════════════════════════════════════════════
   제보 원문 — "현재 매치엔진의 기존 수비 기능을 유지하면서, 포메이션을 기준으로 한
   Defensive Shape Manager를 구축하라. 4-4-2라면 2-4-4의 3개 수비 라인을 기본
   Anchor로 만들고, 공의 위치와 압박 상황에 따라 블록 전체가 이동하되 선수 간
   공간 관계와 라인 구조를 유지하도록 하라. PRESS/COVER/MARK/LANE/RECOVER는 이
   Defensive Shape를 깨뜨리는 독립적인 이동 명령이 아니라 Shape를 일시적으로
   변형시키는 역할로 동작해야 한다."

   원인 — 엔진에 「라인」이라는 실체가 없었다. tacticalAnchorXY 는 선수를 한 명씩
   따로 계산하고, 라인 동기화 장치는 _lineOwnX 하나뿐인데 그것도 「LINE 역할인
   센터백이 2명 이상」일 때만 켜진다. 실측하면 켜져 있는 시간이 전체의 2.0% 다.
   (수비 AI 해부에서 CB 를 역할 경합에 넘긴 대가다 — 여기서 갚는다)
   블록 이동도 blockShift=(b.x-0.5)*0.38 하나, 즉 깊이 축만 있었다. 좌우로는
   compactY 가 선수마다 다른 계수로 당겨서, 평행이동이 아니라 전단(shear)이 났다.

   실측 (4경기 61,369 수비 틱, x 1단위 = 110m):
     · 백라인 깊이 편차   중앙값 11.7m · p90 28.3m   ← 이건 라인이 아니다
     · DF–MF 라인 간격    중앙값 12.2m · p10 2.4m · p90 20.9m
     · 블록 좌우 이동 기울기 0.083     ← 볼이 터치라인에 가도 2m만 따라간다

   수정 — 라인을 실체로 만든다:
     ① 포메이션 앵커의 깊이로 군집을 잘라 라인을 뽑는다. 슬롯 이름을 안 보므로
        백4·백3·백5가 좌표만으로 자동으로 나온다
     ② 라인마다 깊이를 하나로 정하고(goalSideX 를 선수마다가 아니라 라인마다 한 번),
        라인 사이 간격의 최소·최대를 강제한다 — 깊이 들어올수록 세로로 압축된다
     ③ 블록을 좌우로도 통째로 옮긴다 — 지금까지 없던 축이다
     ④ 이탈자가 생기면 남은 멤버가 라인 폭을 다시 나눠 선다
     ⑤ 역할은 셰이프를 「깊이 방향으로만」 끌어당기는 결속(shapeBond)을 받는다.
        좌우는 대부분 역할에 맡긴다 — 마크하는 CB 는 옆으로 따라가되 라인 깊이
        밖으로는 못 나간다. 그게 「Shape를 일시적으로 변형시킨다」의 정확한 뜻이다.
   기존 기능은 하나도 걷어내지 않는다. 역할 체계 아래에 층을 하나 까는 것이다.
   ═══════════════════════════════════════════════════════════════════════ */
/* 🧱 ⚠ 제보 원문 — 「오른쪽 팀의 13번과 23번 풀백 위치를 봐, 너무 쳐져 있거든?」
   (인게임 화면 — 두 풀백이 센터백보다 6~7m 뒤, 자기 골라인 가까이 처져 있었다)
   원인: 백4의 「라인」이 센터백에게만 있었다. _lineOwnX 동기화 대상이 (CB·LCB·RCB) 뿐이고,
      셰이프 결속도 MARK 0.38 · DROP 0.75 로 느슨해서 풀백은 마크·내려앉기를 하는 동안
      라인 뒤로 흘러내렸다. 실측: 풀백이 센터백보다 <b>뒤에 있던 시간이 47.7%</b>, p05 −9.7m.
   ─ 백4는 선이다. 풀백은 센터백 라인보다 이만큼까지만 뒤로 갈 수 있다. */
/* ⚠ 「여전히 쳐져 있다」 — 처음에는 「라인보다 1.3m 뒤까지 허용」이었다. 평균은 +2.4m 로
   맞았지만 보내주신 화면의 위치는 <b>센터백보다 5m 앞</b>이었다. 백4의 풀백은 라인과
   나란한 게 아니라 반 발 앞에 선다 — 바닥을 라인보다 <b>앞</b>에 놓는다. */
const FB_BEHIND_MAX=-0.010;  // 음수 = 센터백 라인보다 약 1.0m <b>앞</b>이 바닥
/* 🏃 풀백·윙백 전진 — 「어디까지」를 정하는 층 (외부 평가·요청).
   제안은 여섯 입력(공·나·상대 윙어·상대 풀백·CB/DM 커버·내 역할)으로 HOLD/SUPPORT/OVERLAP/UNDERLAP/
   ADVANCE/RECOVER 를 고르는 「FB/WB Target Position Manager」였다. 상태 여섯은 이미 엔진에 있다
   (OVERLAP·UNDERLAP = 공격 의도, RECOVER = 수비 역할, HOLD = BALANCE, SUPPORT = WIDE/SHOW/OUTLET).
   좌표를 내는 층을 하나 더 두면 같은 선수에게 좌표를 주는 층이 둘이 된다 — 수비에서 본 경합·덮어쓰기
   문제를 공격에 하나 더 심는 셈이다(59284행 「소유 국면 셰이프 — 되돌렸다」 기록 참고).
   ─ 그래서 매니저 대신 <b>위험 함수 하나(fbRisk) + 천장 하나(10d)</b>로 넣는다. 빠져 있던 입력은
     ③ 상대 윙어 ④ 상대 풀백 ⑤ 커버 세 개뿐이고, 그게 곧 트리의 「뒤 공간 위험」 노드다.
   실측(seed 2, 우리 소유 중 풀백 두 명): 상대 3분의 1 공격 시 전진 68m(p90 79m), 자기 측면 상대 윙어보다
   앞에 서 있던 시간 80~88%(중앙값 10m 앞), 양쪽 풀백 동시 전진(0.55+) 45% — fbHighId 감점 0.30 으로는 못 막았다. */
const FB_RISK_PEN=0.55;      // 위험 1 일 때 확장 의도(OVERLAP·UNDERLAP·RUN…) 감점 — 윙백은 절반
const FB_ADV_BASE=0.68;      // 풀백 절대 천장(자기 골문에서 약 75m). 성향(fFwd)으로 ±0.08, 멘탈리티 ±0.03
const FB_ADV_WB=0.78;        // 윙백 절대 천장 — 그게 윙백이다
const FB_ADV_MARGIN=0.02;    // 위험할 때: 상대 윙어보다 이만큼(약 2m)까지만 앞
const FB_ADV_OTHER=0.50;     // 반대쪽 풀백이 이미 높이 올라가 있으면 나는 하프라인까지만 (동시 전진 억제)
const LAP_HOLD=3.5;          // 오버랩·언더랩 시작 후 이 시간(초)은 의도를 유지한다 — 달리기는 끝까지
const WING_COMBO_IN=0.55;    // 풀백이 뒤에 붙어 있으면 윙어의 INSIDE 가점 (오버랩 중이면 ×1, SUPPORT 면 ×0.7)
const WING_COMBO_WIDE=0.30;  // 같은 상황에서 WIDE 감점 — 둘이 같은 레인에 서지 않는다
const WING_WAIT_K=1.45;      // 볼 가진 윙어가 오버랩 중인 풀백을 기다리는 소유 시간 배수
function fbRisk(a, mine, opps, dir){
  const own=v=>dir>0?v:1-v;
  const side=(a.home && a.home.y<0.5) ? -1 : 1;
  const myAdv=own(a.x);
  /* ③ 내 측면 상대 윙어 — 내 측면에서 우리 골문에 가장 가까운 상대 */
  let wing=null, wAdv=1;
  for(const o of opps){
    if(o.slot==="GK") continue;
    if((o.y-0.5)*side < -0.05) continue;
    const oa=own(o.x); if(oa<wAdv){ wAdv=oa; wing=o; }
  }
  let r=0;
  if(wing){
    r += clamp((myAdv-wAdv+0.06)/0.20, 0, 1)*0.70;          // 윙어가 나보다 뒤·나란히 남아 있다
    /* ④ 상대 풀백이 바로 앞 공간을 막고 있다 — 위험보다는 「올라가 봐야 무익」 */
    for(const o of opps){
      if(o===wing || o.slot==="GK") continue;
      if((o.y-0.5)*side < 0.10) continue;
      const oa=own(o.x); if(oa>myAdv && oa<myAdv+0.12){ r+=0.15; break; }
    }
  }
  /* ⑤ 커버 — 「상대 윙어」의 골사이드(나란히 포함)에 우리 CB/DM 이 있는가.
     ⚠ 처음엔 「내 뒤 1~24m」로 쟀다. 그러면 10c 가 CB 를 0.46 에 세우는 순간 그보다 앞선 풀백은
        영영 커버가 없어 상대 윙어 선에 묶였다(디버그: cov=false · tx=현재 위치). 커버는 나를 덮는 게
        아니라 상대 윙어를 맡는 것이다 — CB 가 윙어와 나란하면 그게 커버다. */
  let cover=false;
  if(wing){
    for(const m of mine){
      if(m===a || m.slot==="GK") continue;
      const band=SLOT_BAND[m.slot]||"MF";
      if(band!=="DF" && band!=="SW" && band!=="DM") continue;
      if((m.y-0.5)*side < -0.02) continue;
      if(own(m.x)<=wAdv+0.03 && Math.abs(m.y-wing.y)<0.30){ cover=true; break; }
    }
  } else cover=true;
  if(cover) r*=0.45;
  /* 🔁 우리 측면 미드필더/윙어와의 관계 — 「WM 이 이미 높다 → HOLD」, 「WM 이 수비 중(볼 뒤) → 여유」 */
  {
    let wm=null;
    for(const m of mine){
      if(m===a || m.slot==="GK" || !m.home) continue;
      const sl=m.slot; if(!(sl==="LM"||sl==="RM"||sl==="LW"||sl==="RW"||sl==="LAM"||sl==="RAM")) continue;
      if((m.home.y<0.5?-1:1)!==side) continue;
      wm=m; break;
    }
    if(wm){
      const wAdv2=own(wm.x);
      if(wAdv2>myAdv+0.25 && !cover) r=Math.max(r, 0.75);           // 이미 높이 가 있다 — 둘 다 올라가면 뒷문이 빈다
      const ballAdv=own(a._fbBall!=null?a._fbBall:0.5);
      if(wAdv2 < ballAdv-0.05) r*=0.6;                             // 볼 뒤에서 수비 중 — 내가 올라갈 여유
    }
  }
  a._fbRisk=clamp(r,0,1); a._fbWingAdv=wing?wAdv:null; a._fbCover=cover;
  return a._fbRisk;
}
/* 🧱 잔여 수비(rest defense) — 「우리 팀 공격 시 CB 가 정확히 어디까지 전진해야 하는가」(외부 평가·요청).
   실측(seed 2, 우리 소유 중 CB 두 명 평균, 자기 골문에서 m): 볼이 상대 3분의 1일 때 CB 66m(p90 84m),
   볼과 간격 24m, 상대 최전방 공격수가 CB 보다 우리 골문에 가까이 서 있던 시간 <b>59%</b>(중앙값 9m 앞).
   원인: ATT 앵커 = 기본 위치 + lineShift + phaseShift(0.06~0.10) + blockShift((b.x−0.5)×0.38) + dirBias(0.11).
      볼이 0.85 면 CB 앵커가 0.65~0.75 로 밀려 상대 진영 깊이 들어갔고, 상대 최전방·역습 위험을 읽는 항이 없었다.
      역습이 시작되는 순간 스트라이커가 이미 골사이드에 있는 구조.
   ─ 규칙 두 개로 천장을 만든다. ① 절대 천장: 하프라인 안팎(REST_CB_MAX, 멘탈리티·라인 지시로 ±)
      ② 상대 최전방 공격수보다 REST_CB_MARGIN 만큼 골 쪽 — 상대가 나보다 빠르면 더 물러선다.
      볼을 가진 CB·추격 중인 CB 는 예외(올라가서 차는 건 그의 선택이다). */
/* 🧱 잔여 수비 2차 (요청 — 「우리 팀 공격 시 센터백이 너무 쳐진다. 현대 축구는 그렇지 않다」).
   실측(빌드 1800, seed 2, 볼이 상대 3분의 1): CB 중앙값 45m — 상대 최전방보다 11m 골 쪽(p10 22m),
   볼과 40m. 단계 추적: 앵커 57m·역할 61m 로 잡아 놓고 4셰이프(SH_NOW 0.55 — 실제 라인 평균에 55% 결속)가
   46m 로 되당겼다. 깊이 서 있으니 라인 평균이 낮고, 라인 평균이 낮으니 목표도 낮은 자기 강화 고리.
   ─ 천장을 하프라인 위(0.52)로 올리고, 볼이 상대 진영 깊숙이(0.60+) 자리잡으면 「상대 최전방 몇 m 골 쪽」까지
     밀어 올리는 <b>바닥</b>을 만든다(셰이프 되당김보다 뒤인 10c 라 고리를 끊는다). 한계는 늘 min(천장, 최전방−여유). */
const REST_CB_MAX=0.52;      // 자기 골문에서 약 57m (하프라인 7m 앞) — 멘탈리티·라인 ±0.03 씩 (2차: 0.46 → 0.52)
const REST_CB_MARGIN=-0.005; /* 3차: +0.015 → −0.005. 계측으로 확인한 자기 강화 고리 — 상대 카운터 요원은 우리 라인에
                                맞춰 서고 우리 라인은 「그보다 1.7m 뒤」라 서로를 끌어내렸다. 현대 잔여 수비처럼 최전방과
                                같은 높이(반걸음 앞)까지 조인다. 역습 패스 순간 그가 우리 라인 뒤면 오프사이드다.
                                상대가 나보다 빠르면 예전처럼 최대 3.3m 물러선다(아래 pace 항). */
const REST_CB_FLOOR_SLACK=0.015; // 바닥 = min(천장, 최전방−여유) − 이 값 (약 1.6m 의 자율 · 3차: 2.7 → 1.6m)
/* ↔️ 3백 벌림 (제보 — 「3백은 풀백/윙어가 전진해 있을 때 LCB·RCB 가 자연스럽게 와이드하게 선다」).
   실측(우리 소유·같은 쪽 윙백/측면이 전진했을 때 좌우 CB 의 |y−0.5|): 3-5-2 16.1m(빌드업 OUTLET 이 벌려 줌) ·
   3-4-3 은 11.3m — 앵커(±12.6m)에 그대로 묶여 있었다. 같은 쪽 측면 요원이 전진해 폭을 잡고 있으면
   좌우 CB 는 하프스페이스 폭(약 16.5m)까지 벌린다. CB 슬롯이 쓰인 포메이션(3백·5백)만. */
/* ↔️ 3백 벌림 2차 (참고 자료 — 「현대 와이드 센터백은 터치라인 근처까지 벌려 상대 1선을 늘리고,
   윙백이 터치라인을 잡으면 하프스페이스로 오버/언더랩 드라이브까지 한다」+ 「더 와이드하게 서도 좋을 것 같다」).
   ① 빌드업(OUTLET): 3백 좌우 CB 는 박스 옆이 아니라 측면 깊숙이(+약 6m) ② 자리잡은 소유(WIDE3): 바닥을
   16.5 → 18.2m 로 올리고 역할의 wide 성향이 그 위(최대 +5m)를 얹는다 ③ 전진 성향 있는 좌우 CB(와이드
   센터백/공격 등)는 오버랩·언더랩 의도의 후보가 된다 — 잔여 라인 띠·규율은 그 동안 면제. */
const WIDE3_MIN=0.26;        // 벌림 바닥 |y−0.5| (약 18.2m · 2차: 0.235 → 0.26) — 역할 wide 가 위를 얹는다
const CB3_OUTLET_Y=0.09;     // 빌드업 시 3백 좌우 CB 가 더 벌리는 폭 (약 6.3m)
const CB_SLIDE_Y=0.050;      // ↔️ 3백 연쇄 — 좌우 CB 슬라이드 시 남은 CB 라인이 그쪽으로 당겨지는 폭 (약 3.5m)
const WIDE3_K=0.75;          // 한 번에 당기는 비율 — 앵커와의 절충
const REST_CB_FLOOR_BALL=0.60;   // 볼이 이보다 전진해 자리잡았을 때만 바닥이 켜진다
const SH_SPLIT=0.052;      // 앵커 깊이가 이만큼(약 5.7m) 벌어지면 다른 라인이다
const SH_GAP_MIN=0.100;    // 라인 사이 최소 간격 (약 11m)
const SH_GAP_MAX=0.180;    /* 최대 — 23m→19.8m (참고자료: 줄간 종적 간격은 10~15m 가 정석,
                              20m 를 넘으면 상대 공미·ST 가 내려와 편하게 받는 포켓이 생긴다) */
const SH_SHIFT_Y=0.22;     // 블록 좌우 이동 — 볼이 터치라인이면 약 7.7m 따라간다 (🚶 4라운드 0.30 → 0.22)
const SH_Y_K=0.55;         // 좌우 결속은 깊이 결속의 55%만 — 좌우는 역할에 더 맡긴다
const SH_NOW=0.55;         // 라인 깊이 = 지금 라인의 실제 평균 55% + 앵커 기준 목표 45%
const SH_STAY=0.30;        // 결속이 이 밑이면 「라인을 떠난 사람」으로 세고 폭을 재분배한다
/* 역할별 결속 — 0 이면 셰이프를 완전히 벗어나고, 1 이면 라인에 용접된다.
   압박·마크처럼 눈앞의 대상을 쫓는 역할일수록 낮고, 자리를 지키는 역할일수록 높다. */
const SH_BOND={};
SH_BOND[DEF_ROLE.PRESS]=0.00;      SH_BOND[DEF_ROLE.JOCKEY]=0.00;
SH_BOND[DEF_ROLE.BLOCK_SHOT]=0.05; SH_BOND[DEF_ROLE.SECOND]=0.10;
SH_BOND[DEF_ROLE.MARK]=0.22;       SH_BOND[DEF_ROLE.LANE]=0.50;   /* 밸런스 사이클: MARK 0.38 → 0.22 — 라인 되당김이 마커를 담당에서 4~6m 떼어 놓았다 */
SH_BOND[DEF_ROLE.COVER]=0.62;      SH_BOND[DEF_ROLE.COVER_WIDE]=0.60;
SH_BOND[DEF_ROLE.SCREEN]=0.60;
/* ⚠ 복귀(RECOVER)와 메우기(DROP)는 「셰이프를 벗어나는」 역할이 아니라
   「셰이프로 돌아가는」 역할이다. 처음에 0.35·0.65 로 낮게 잡았는데, 실측에서
   백라인 깊이 편차를 가장 크게 벌리는 두 역할이 바로 이 둘이었다(중앙값 +6.6m·+2.1m).
   돌아가는 사람의 목적지는 옛 전술 앵커가 아니라 <b>지금 라인</b>이어야 한다. */
SH_BOND[DEF_ROLE.RECOVER]=0.85;    SH_BOND[DEF_ROLE.DROP]=0.75;
SH_BOND[DEF_ROLE.BACKFILL]=0.88;   // 줄에 들어가는 게 목적이라 라인 결속이 더 세다
SH_BOND[DEF_ROLE.LINE]=0.95;

/* 앵커 깊이로 라인을 자른다. 4줄 이상 나오면 가장 붙어 있는 두 줄을 합쳐 3줄로 —
   「수비 블록의 3개 라인」이라는 요청 그대로다. (4-2-3-1 의 2와 3이 여기서 합쳐진다) */
function shapeLines(rows){
  const out=[]; let cur=[rows[0]];
  for(let i=1;i<rows.length;i++){
    if(rows[i].ax-rows[i-1].ax > SH_SPLIT){ out.push(cur); cur=[]; }
    cur.push(rows[i]);
  }
  out.push(cur);
  while(out.length>3){
    let bi=0, bd=Infinity;
    for(let i=0;i+1<out.length;i++){
      const d=out[i+1][0].ax - out[i][out[i].length-1].ax;
      if(d<bd){ bd=d; bi=i; }
    }
    out[bi]=out[bi].concat(out[bi+1]); out.splice(bi+1,1);
  }
  return out;
}
/* 한 틱, 한 팀의 현재 수비 셰이프를 만든다. assignDefRoles 뒤에 부른다 —
   역할을 알아야 누가 라인을 떠났는지 셀 수 있다. */
/* 🧱 수비 블록 압축도 (외부 조언 「Defensive Block Manager」 참고) — 0(하이프레스)~1(딥블록).
   ⚠ 조언에는 스코어·시간 자동 트리거(「1-0 82분엔 저절로 내려앉기」)도 있었지만 뺐다(요청) —
     내려앉을지는 감독이 정한다. 압축은 오직 감독 전술(라인·멘탈리티·텐백)에서만 나온다.
     AI 감독은 기존 플랜/하프타임 로직에서 전술 자체를 바꾸는 것으로 같은 효과를 낸다. */
function blockComp(T){
  /* 🧱 텐백 토글 폐지(요청 — 「수비 간격 5단계를 세부전술에 추가해서 라인 내리고 간격 좁게 하고
     성향도 수비적일수록 10백 효과가 나오게. 그게 맞지」). 매우 낮은 라인(+0.175) + 매우 수비적(+0.06)
     + 매우 좁게(+0.30) = 0.91 ≥ 0.88 → 텐백 티어. 기본값 조합은 예전과 동일한 0.375. */
  const g=(T.defGap!=null?T.defGap:1);
  let C=0.55 - (T.line!=null?T.line:1)*0.175 + (1-(T.mentality!=null?T.mentality:1))*0.06 + (1-g)*0.30;
  if(T.raw && +T.raw.bus>0) C=Math.max(C, 0.92);   // 레거시 세이브 안전망(마이그레이션이 지우지만 혹시)
  return clamp(C, 0.05, 0.95);
}
function buildDefShape(mine, dir, ball, blockShift, T){
  const own=v=>dir>0?v:1-v;
  const deep=blockDepth(ball, dir);
  /* 🎚️ 전술 배선 — 배선 감사에서 <b>셰이프 매니저가 전술을 직접 하나도 안 읽는다</b>는 걸
     확인했다. 앵커를 통해 width·line·mentality 가 간접적으로 흘러들 뿐이었다. 둘을 건다:
     ① 폭(width) → 블록의 좌우 이동량. 좁게 서는 팀은 커버하는 폭이 애초에 좁으므로
        <b>볼 쪽으로 더 많이 따라간다</b>(대신 반대편 전환을 내준다). 넓게 서면 덜 따라간다.
        지금까지 SH_SHIFT_Y 는 고정이라 「좁게」와 「넓게」가 같은 양만 움직였다.
     ② 압박(press) → 라인 사이 간격. 압박하는 팀은 압박자를 받치려 블록을 세로로 죈다.
        내려서는 팀은 그만큼 벌어진다. 라인의 <b>깊이</b> 자체는 이미 앵커(line 지시)가 정한다. */
  const _w = (T && T.width!=null) ? T.width : 1;
  const _p = (T && T.press!=null) ? T.press : 1;
  const wK = clamp(1.30 - _w*0.30, 0.75, 1.30);   // 매우 좁게 ×1.30 · 보통 ×1.00 · 매우 넓게 ×0.75
  const gK = clamp(1.16 - _p*0.16, 0.84, 1.16);   // 압박 자제 ×1.16 · 극한 압박 ×0.84
  /* 🚌 텐백 — 공이 우리 진영에 들어오면 라인 깊이·간격·폭을 강제로 죈다 (앵커 절 주석 참고) */
  const _bC = blockComp(T||{});
  const _bOwn0 = dir>0?ball.x:1-ball.x;
  /* 제보 — 「라인 내리고 좁혀도 박스에 우르르 모이질 않는다. 라인을 내리면 확 눈에 띄게 내려야」.
     0.88 문턱은 세 슬라이더 전부 극단이어야 닿았다(라인0+간격0+성향 보통 = 0.85 로 미달).
     라인·간격 둘만 극단이어도 완전 텐백이 되도록 내린다 */
  const busK = _bC>=0.80 && _bOwn0<0.60;
  const _midC = !busK && _bC>=0.50 && _bOwn0<0.60;   // 🧱 낮은 라인·수비 멘탈 — 텐백까진 아니어도 단계적으로 죈다
  const rows=[];
  for(const a of mine){
    a._shX=null; a._shY=null; a._shBond=0;
    if(a.slot==="GK") continue;
    const an=tacticalAnchorRef(a.team, a.slot, "DEF", a.isHome);   // ⚡ 읽기만 한다
    rows.push({a, ax:own(clamp01(an.x+blockShift)), ay:an.y});
  }
  if(rows.length<4) return;                  // 퇴장이 겹쳐 라인을 만들 수 없다
  rows.sort((p,q)=>p.ax-q.ax);
  const lines=shapeLines(rows);
  // ── 블록 좌우 이동 — 라인 전원에 똑같이 걸어야 전단이 아니라 평행이동이 된다
  const dy=(ball.y-0.5)*SH_SHIFT_Y*wK*(0.55+deep*0.45);
  // ── 라인마다 깊이 하나. goalSideX 와 같은 식이되 선수가 아니라 라인에 건다
  const depth=[];
  const bOwn=own(ball.x), margin=0.058+deep*0.028;
  for(const L of lines){
    let s=0; for(const r of L) s+=r.ax;
    const anch=s/L.length;
    let x=anch+(bOwn-anch)*0.14;
    if(bOwn < anch+0.12) x=Math.min(x, Math.max(0.030, bOwn-margin));
    /* ⚠ 앵커만으로 깊이를 잡으면 라인 전체가 통째로 뒤로 밀린다.
       실측에서 백4 네 명이 전원 계산된 깊이보다 3~5m 앞에 있었다 —
       즉 「라인을 펴는」 게 아니라 「라인을 뒤로 미는」 힘이 됐다.
       지금 라인이 실제로 서 있는 평균을 섞어 그 편향을 없앤다.
       이러면 이 층이 하는 일이 순수하게 「펴기」가 된다. (_lineOwnX 가 하던 일의 확장판) */
    /* ⚠ 트랩 중인 선수는 이 평균에서 뺀다 — 안 빼면 되먹임 고리가 생긴다.
       트랩이 라인을 3.7m 밀어 올리면 「현재 라인 평균」이 따라 올라가고,
       그 값이 다시 라인 목표가 되어 <b>1.3초짜리 트랩이 라인을 계속 높게 붙든다</b>.
       실측에서 이 고리 하나로 경기당 슛 23.4 → 17.9, 골 3.56 → 2.13 이 났다. */
    let n=0, cur=0;
    for(const r of L){ if(r.a._trapOn) continue;
      const bd=SH_BOND[r.a.defRole]; if((bd===undefined?0.50:bd)<SH_STAY) continue; cur+=own(r.a.x); n++; }
    if(n>=2) x = (cur/n)*SH_NOW + x*(1-SH_NOW);
    depth.push(clamp(x, 0.022, 0.97));
  }
  // ── 라인 간격 유지 — 뒤에서 앞으로 훑으며 최소·최대를 강제한다(깊을수록 압축)
  /* ⚠ 클램프만으로는 아무 일도 안 일어난다 — 앵커가 만든 간격이 대개 [11m, 23m] 안이라
     범위를 넓히거나 좁혀도 걸리지 않는다(실측: 블록 세로 길이 26.9 / 25.7 / 26.9 로 무변화).
     간격을 <b>실제로 늘이고 줄인다</b> — 뒷선을 기준점으로 잡고 앞선들을 당기거나 민다. */
  for(let i=1;i<depth.length;i++) depth[i]=depth[0]+(depth[i]-depth[0])*gK;
  const gMin=SH_GAP_MIN*gK*(1-deep*0.30), gMax=SH_GAP_MAX*gK*(1-deep*0.25);
  for(let i=1;i<depth.length;i++){
    const g=depth[i]-depth[i-1];
    if(g<gMin) depth[i]=depth[i-1]+gMin;
    else if(g>gMax) depth[i]=depth[i-1]+gMax;
  }
  /* 🚌 텐백 — 뒷줄은 박스 언저리(약 12.5m), 줄 사이 7.9~10m (참고자료 반영 — 아틀레티코·번리류
     극단 팀이 8~10m. 1차 5.5~8.3m 는 정석보다도 좁아 블록 전장이 20~24m 로 오그라들었고,
     정석 전장은 25~30m 다) */
  if(busK){
    depth[0]=Math.min(depth[0], 0.115);
    for(let i=1;i<depth.length;i++){
      const g=depth[i]-depth[i-1];
      if(g>0.091) depth[i]=depth[i-1]+0.091;
      else if(g<0.072) depth[i]=depth[i-1]+0.072;
    }
  } else if(_midC){
    /* 🧱 중간 압축(LOW_BLOCK 단계) — 뒷줄·간격 상한이 압축도에 비례해 내려온다.
       ⚠ 1차(뒷줄 0.36-C*0.26 · 간격 0.075+(1-C)*0.16)는 C 0.61 에서 간격 상한 15m —
          「블록」이라기엔 헐거워 화면에서 표가 안 났다(제보). 뒷줄 18m·간격 11m 로 죈다 */
    depth[0]=Math.min(depth[0], 0.32-_bC*0.25);
    const _gc=0.062+(1-_bC)*0.10;
    for(let i=1;i<depth.length;i++){
      const g=depth[i]-depth[i-1];
      if(g>_gc) depth[i]=depth[i-1]+_gc;
    }
  }
  for(let i=0;i<lines.length;i++){
    const sorted=[...lines[i]].sort((p,q)=>p.ay-q.ay);
    const lo=sorted[0].ay, hi=sorted[sorted.length-1].ay;
    const bondOf=r=>{ const v=SH_BOND[r.a.defRole]; return v===undefined?0.50:v; };
    const stay=sorted.filter(r=>bondOf(r)>=SH_STAY);
    // 한 명이라도 라인을 떠났으면 남은 사람들이 폭을 다시 나눈다
    const share=(stay.length>=2 && stay.length<sorted.length);
    for(const r of sorted){
      const a=r.a;
      let y=r.ay;
      if(share){
        const k=stay.indexOf(r);
        if(k>=0) y=lo+(hi-lo)*(k/(stay.length-1));
      }
      a._shX=depth[i];
      /* 🔀 파사이드 수렴 (외부 조언 6번 — 「상대가 측면에 있으면 반대쪽 선수들이 중앙으로 좁힌다」).
         dy 평행이동은 전단 방지를 위해 전원 동일했는데, 실축의 먼 쪽 풀백·미드필더는 거기에 더해
         중앙으로 접는다. 공이 측면일 때 공 반대쪽 선수만, 공의 측면도·압축도에 비례해 접는다. */
      let _y2=y+dy;
      {
        const _bw=ball.y-0.5;
        if(Math.abs(_bw)>0.11 && (_y2-0.5)*Math.sign(_bw)<-0.04){
          /* 뒷줄은 절반만 접는다 — 먼쪽 포스트 크로스 커버까지 버리면 안 된다 */
          const _fold=clamp((Math.abs(_bw)-0.11)/0.24, 0, 1)*(0.16+_bC*0.20)*(i===0?0.5:1);
          _y2=_y2+(0.5-_y2)*_fold;
        }
      }
      /* 🚌 폭 — 0.82 로도 두 줄이 35~40m 로 펼쳐져 「박스 앞 밀집」으로 안 보였다(제보).
         참고자료(같은 라인 선수 간 횡적 5~8m — 한 명이 뚫려도 옆이 커버하는 거리) 반영:
         텐백 0.62(백4 인접 약 8m) · 중간 압축은 압축도 비례 */
      const _yk = busK ? 0.62 : (_midC ? 1-(_bC-0.50)*0.55 : 1);
      a._shY=clamp01(0.5+(_y2-0.5)*_yk);
      a._shBond=bondOf(r)*clamp(0.86+(a.teamFamK||0)*0.24, 0.60, 1.15);
      /* 🚌 톱·2선까지 줄에 묶는다 — 볼 계열 임무(압박·슛 차단·세컨드·마크)는 예외.
         🧱 중간 압축에도 하한을 건다 — 결속이 낮은 전방이 안 따라 내려와 화면에 표가 안 났다(제보) */
      const _bF = busK ? 0.72 : (_midC ? 0.42+(_bC-0.50)*0.72 : 0);
      if(_bF && a._shBond<_bF && r.a.defRole!==DEF_ROLE.PRESS && r.a.defRole!==DEF_ROLE.JOCKEY &&
         r.a.defRole!==DEF_ROLE.BLOCK_SHOT && r.a.defRole!==DEF_ROLE.SECOND && r.a.defRole!==DEF_ROLE.MARK)
        a._shBond=_bF;
    }
  }
}
/* 볼이 우리 골문에 얼마나 가까운가 — 0(중원) ~ 1(박스 앞). 수축 정도를 정한다. */
function blockDepth(ball, dir){
  const own = dir>0 ? ball.x : 1-ball.x;
  return clamp01((0.34-own)/0.34);
}
/* 볼이 우리 진영 깊숙이 들어올수록 수비진은 좌우로도 볼 쪽으로 좁혀 선다.
   평소 넓게 벌려 있던 백라인이 박스 앞에서는 골문 폭으로 모이는 것과 같다. */
function compactY(ball, dir, base){
  const own = dir>0 ? ball.x : 1-ball.x;
  const deep = clamp01((0.30-own)/0.30);        // 0(중원) ~ 1(골문 앞)
  return base + (COMPACT_MAX-base)*deep;
}
/* 수비 라인의 깊이.
   평소에는 전술 라인(anchor)을 유지하며 볼 쪽으로 조금 당겨지지만, 볼이 우리 진영 깊숙이 들어오면
   "볼보다 골문 쪽"으로 내려선다. 이게 없으면 공격수가 골문 앞까지 아무 저항 없이 몰고 들어간다.
   own() 은 자기 골문을 0으로 놓고 본 좌표라, 값이 작을수록 우리 골문에 가깝다. */
function goalSideX(anchor, ball, dir, pull, margin){
  const own = v => dir>0 ? v : 1-v;
  const ballOwn=own(ball.x), anchorOwn=own(anchor.x);
  let x = anchorOwn + (ballOwn-anchorOwn)*pull;
  if(ballOwn < anchorOwn + 0.12){                       // 볼이 라인 근처까지 넘어왔다
    x = Math.min(x, Math.max(0.030, ballOwn - margin)); // 볼과 골문 사이로 내려선다
  }
  return clamp01(dir>0 ? x : 1-x);
}
/* 90분 연속 시뮬레이터 */
