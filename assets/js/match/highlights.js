"use strict";
/* ── FM식 하이라이트 중계 ──────────────────────────────────────
   경기는 뒤에서 빠르게 굴러간다. 결정적 장면이 나오면 그 앞 빌드업부터 되감아
   실시간으로 보여주고, 끝나면 다시 빨리 감는다. 그래서 "녹화 버퍼"가 필요하다. */
const HL_BUF_MAX=260;       // 링버퍼 길이 (0.2초 × 260 ≈ 52초 분량)
const HL_MAX_STEP=2;        // 🎾 한 번의 화면 갱신에 재생헤드가 밀 수 있는 최대 칸 수 (제보: 공이 스킵된다)
const CARD_FX_SEC=4.2;      // 🟥 카드를 들어 올린 뒤 화면에 남는 시간(초)
const HL_CAP_MAX=90;        // 해설 자막 링버퍼 길이
const HL_LEAD=11.0;         // 리드인 기본값 (종류별 값이 없을 때의 폴백)
/* FM식 가변 길이 — 시시한 장면은 짧게 치고 빠지고, 골·선방은 빌드업부터 길게 본다.
   여기에 더해 evlog에서 「공격팀이 공을 얻은 순간」을 찾아 그 지점으로 시작점을 당긴다 —
   역습 골은 탈취 장면부터 짧고 굵게, 긴 빌드업 골은 후방 전개부터 길게 나온다. */
const HL_LEAD_BY={miss:20.0, save:20.0, red:20.0, pen:20.0, goal:22.0, wood:20.0,
                  chance:10.0, block:10.0, far:12.0, run:10.0, counter:14.0};   // 🎬 아래층 장면은 짧은 빌드업 · 역습은 탈취 순간부터
const HL_LEAD_MIN=20.0;     // 위층 장면의 최소 빌드업 (⚠ 예전 주석 「최소 10초」는 값과 어긋난 오기였다)
const HL_LEAD_MIN_BY={chance:9.0, block:9.0, far:11.0, run:9.0, counter:12.0};   // 🎬 아래층은 최소치도 짧게
/* 꼬리는 시간으로 자르지 않는다 — "결말이 날 때까지" 이어 간다.
   슛이 날아가고, 키퍼가 쳐내고, 리바운드가 정리되고, 골라인을 넘어가는 것까지가 한 장면이다. */
const HL_TAIL_MIN=2.5;      // 트리거 뒤 최소한 이만큼은 본다
const HL_TAIL_MAX=16.0;     // 아무리 길어도 여기서 끊는다 (혼전이 계속될 때 대비)
const HL_SETTLE=2.2;        // 공이 이만큼 잠잠하면 장면이 끝난 것으로 본다
const HL_CELEB=9.0;         // 골 — 세리머니를 이만큼 보고 끊는다 (해설 리액션이 다 나올 시간)
const HL_REPLAY_PRE=6.0;    // 리플레이: 골 순간 몇 초 전부터 다시 볼 것인가
const HL_REPLAY_POST=2.5;   // 리플레이: 골 뒤로 몇 초 더
const HL_REPLAY_RATE=0.62;  // 리플레이 재생 속도 (1.0=실시간 — 느리게 보여준다)
const EVLOG_MAX=600;        // 내러티브 이벤트 로그 링버퍼 크기
const HL_RATE=1.0;          // 재생 속도 (1.0=실시간). 배속 슬라이더가 여기에 곱해진다
/* 장면의 중요도 — 같은 구간에 여러 사건이 겹치면 더 큰 쪽으로 승격된다 */
/* ═══ 🎬 하이라이트 등급 ═══════════════════════════════════════
   ⚠ 제보 원문 — 「경기 중 게임화면 중요한 공격상황의 빈도를, 정말 중요한 찬스 혹은
   약간은 덜 중요하지만 위협적인 공격찬스 등으로 비중을 선택하는 게 어떨까 싶습니다.
   게임이 워낙 후루룩 지나가서 전술수정하려다 보면, 이미 교체타이밍이 늦는 경우가 있어서.」

   예전 사다리는 다섯 칸(빗나간 슛·선방·퇴장·PK·골)뿐이었고, 가중치는 「한 장면 안에서
   더 중요한 것으로 승격」할 때만 쓰였다 — 감독이 빈도를 고를 문턱이 아예 없었다.
   ─ 사다리를 여섯 칸으로 넓히고, 아래쪽에 「위협적이지만 결정적이지는 않은」 층을 만든다.
   ─ 그 위에 문턱(hlMinW)을 얹어 감독이 셋 중에서 고른다. */
const HL_W={
  chance:1,   // 슛까지 못 간 빅찬스 — 박스 침투가 걷어차이거나 끊긴 장면
  block :1,   // 박스 안 결정적 블록
  far   :1,   // 18m 밖에서 아쉽게 빗나간 중거리
  run   :1,   // 🎬 6번 — 한 소유 안에서 둘 이상 제친 드리블 돌파 (상대 진영)
  counter:1,  // 🎬 6번 — 우리 진영에서 뺏어 9초 안에 파이널서드 도달한 역습 전개
  press :1,   // 🎯 하이 프레스 성공 — 상대 골문 1/3 에서 압박으로 되찾은 공
  miss  :2,   // 박스 안에서 빗나간 결정적 기회
  save  :3,   // 골키퍼 선방
  wood  :3,   // 골대 강타
  red   :4,   // 퇴장
  pen   :5,   // 페널티킥
  goal  :6    // 골
};
const HL_LABEL={chance:"위협적인 공격", block:"결정적 블록", far:"아쉬운 중거리",
                run:"드리블 돌파", counter:"역습 전개", press:"전방 압박",
                miss:"결정적 기회", save:"선방", wood:"골대 강타",
                red:"퇴장", pen:"페널티킥", goal:"골"};
/* 감독이 고르는 빈도 — 0 적게 · 1 보통(기본) · 2 자주.
   ⚠ 「보통」이 예전과 정확히 같은 집합이 되도록 문턱을 2 로 잡았다(miss·save·red·pen·goal).
      새로 생긴 층(위협적인 공격·블록·중거리)은 「자주」에서만 올라온다. */
const HL_LV=[
  {n:"결정적인 장면만",   ic:"💎", w:4, d:"골 · 페널티킥 · 퇴장만 보여 줍니다. 경기가 가장 빨리 흘러갑니다."},
  {n:"상세 하이라이트",   ic:"⚽", w:2, d:"위에 더해 선방 · 골대 강타 · 박스 안 결정적 기회까지."},
  {n:"확장 하이라이트",   ic:"🔥", w:1, d:"위에 더해 위협적인 공격 · 결정적 블록 · 아쉬운 중거리까지. 멈추는 순간이 많아 교체·전술을 손볼 틈이 넉넉합니다."}
];
/* ⚔️ ⚠ 요청 — 「온라인 대전에서는 무조건 상세 하이라이트로만. 게스트와 호스트 모두.」
   대전은 양쪽이 같은 화면을 봐야 하는데, 잡는 장면을 호스트가 혼자 정하면
   호스트의 설정이 곧 게스트의 경험이 된다(게스트는 호스트 스냅샷을 그대로 본다).
   ─ 대전 중에는 설정과 무관하게 「확장 하이라이트」로 고정하고, 패널도 잠근다.
       위협적인 공격까지 잡아 자주 멈추므로 양쪽 다 교체·전술을 손볼 틈이 넉넉하다. */
/* 🎬 가뭄 안전망 (하이라이트 점검 3번 — 원 제보 「게임이 후루룩 지나가서 전술 수정하려다 보면 교체 타이밍이
   늦는다」의 나머지 절반). 장면은 사건이 나야 멈추므로, 사건 없는 경기일수록 개입 기회가 없었다
   (실측: 상세 레벨 최장 무장면 9~13분, 결정적만 20~83분). 이 게임분 동안 장면이 없으면 흐름 요약
   한 줄과 함께 전술창을 한 번 열어 준다. PvP 는 상대가 기다리므로 제외. */
const FLOW_PAUSE_MIN=15;
const HL_PVP_LV=2;                              // 확장 하이라이트
function hlPvpLock(){
  try{
    if(liveM && liveM.opts && liveM.opts.pvp) return true;
    if(typeof PVP!=="undefined" && PVP && PVP.stage==="match") return true;
  }catch(e){}
  return false;
}
function hlLvIdx(){
  try{
    if(hlPvpLock()) return HL_PVP_LV;
    return clamp((G.opt&&G.opt.hlLv!=null)?(G.opt.hlLv|0):1, 0, 2);
  }catch(e){ return 1; }
}
function hlMinW(){ return HL_LV[hlLvIdx()].w; }
function hlLvName(){ return HL_LV[hlLvIdx()].n; }
function setHlLv(i){
  if(hlPvpLock()){
    try{ flash("⚔️ 온라인 대전은 <b>확장 하이라이트</b>로 고정입니다 — 양쪽이 같은 장면을 봅니다.","warn"); }catch(e){}
    return;
  }
  G.opt=G.opt||{}; G.opt.hlLv=clamp(i|0,0,2);
  try{ saveGame(); }catch(e){}
  try{ const el=document.getElementById("lvSpdPanel"); if(el) el.innerHTML=lvSpdPanelHtml(); }catch(e){}
  try{ flash(`🎬 하이라이트 <b>${hlLvName()}</b> — ${HL_LV[hlLvIdx()].d}`, "info"); }catch(e){}
}
const LIVE_SIM_TICK_MS=33;  // 연속 엔진 진행 호출 간격 — 짧게 자주 굴려 화면을 막지 않는다
const THROW_MAX=0.30;   // 기본 사거리 (장거리 스로인 능력치로 늘어난다)        // 스로인 최대 사거리(등방) — 손으로 던지므로 짧다
/* 경기 상태 머신 — 지금 경기가 흐르는 중인지, 멈춰 있는지, 무엇으로 재개되는지 */
const MATCH_STATE={PLAYING:"PLAYING", FOUL_SCENE:"FOUL_SCENE", FREE_KICK:"FREE_KICK",
                   CORNER_KICK:"CORNER_KICK", GOAL_KICK:"GOAL_KICK", THROW_IN:"THROW_IN",
                   PENALTY:"PENALTY", CELEBRATION:"CELEBRATION"};
const SP_STATE={goalKick:MATCH_STATE.GOAL_KICK, corner:MATCH_STATE.CORNER_KICK,
                throwIn:MATCH_STATE.THROW_IN, freeKick:MATCH_STATE.FREE_KICK,
                penalty:MATCH_STATE.PENALTY};
const MATCH_STATE_KO={PLAYING:"인플레이", FOUL_SCENE:"파울", FREE_KICK:"프리킥",
                      CORNER_KICK:"코너킥", GOAL_KICK:"골킥", THROW_IN:"스로인",
                      PENALTY:"페널티킥", CELEBRATION:"득점"};
const CARD={NONE:"NONE", VERBAL:"VERBAL", YELLOW:"YELLOW", RED:"RED"};
const FOUL_SCENE_T=3.4;       // 심판이 다가가 판정을 내리기까지
const SIM_REF_SPEED=0.052;    // 주심 이동 속도
const SIM_REF_TRAIL=0.085;    // 주심이 볼에서 유지하는 거리
/* 세트피스 이격 거리 — 상대는 공에서 이만큼 떨어져 있어야 한다 (경기 규칙) */
const SETPIECE_KEEPOUT={corner:9.15, freeKick:9.15, goalKick:9.15, throwIn:2.0, penalty:9.15};
const SETPIECE_BACK=0.055;   // 킥 전에 공 뒤로 물러나는 거리
/* 🤾 스로인 — 라인 밖 거리(공·선수가 서는 자리)와 던지기 전 반 발 물러나는 폭 (요청) */
const THROW_OUT_Y=0.012;     // ≈0.8m 라인 밖
const THROW_STEP =0.014;     // ≈1.0m 더 물러났다가 앞으로 나오며 던진다
const THROW_HAND_Z=2.15/ISO_TO_M;   // 🤾 머리 위에서 놓는 높이 (≈2.15m)
/* ══════════════════════════════════════════════════════════════════
   ⚽ CROSS SYSTEM — 크로스는 "선수에게 보내는 공"이 아니라
      "공격수가 유리하게 만날 수 있는 공간에 보내는 공"이다.
      CROSS TARGET = ATTACKING SPACE
   ══════════════════════════════════════════════════════════════════ */
/* 크로서가 어디서 올리는가 — 위치가 크로스의 성격을 절반쯤 정한다 */
const CROSS_POS={ NEAR_CORNER:"NEAR_CORNER", BYLINE:"BYLINE", DEEP_WIDE:"DEEP_WIDE",
                  MID_WIDE:"MID_WIDE", HALF_SPACE:"HALF_SPACE", ATT_THIRD:"ATT_THIRD" };
/* 페널티박스를 공간으로 쪼갠다 */
const CZONE={ NEAR:"NEAR", CENTRAL:"CENTRAL", FAR:"FAR", CUTBACK:"CUTBACK", EDGE:"EDGE" };
/* 공의 궤적 프로필 */
const CROSS_TRAJ={ LOFTED:"LOFTED", DRIVEN:"DRIVEN", LOW:"LOW", CHIPPED:"CHIPPED" };
const CROSS_TYPE={ EARLY:"EARLY", BYLINE:"BYLINE", CUTBACK:"CUTBACK",
                   DEEP:"DEEP", LOW:"LOW", NEAR_POST:"NEAR_POST", FAR_POST:"FAR_POST",
                   CENTRAL:"CENTRAL", DRIVEN:"DRIVEN", LOFTED:"LOFTED", CHIPPED:"CHIPPED" };
/* 크로스 오차의 종류 — 아무렇게나 빗나가지 않는다 */
const CROSS_ERR={ GOOD:"정확", SHORT:"짧음", LONG:"긺", NEAR:"너무 앞", FAR:"너무 뒤",
                  CENTRAL:"너무 중앙", WIDE:"너무 바깥", OVERHIT:"강함", UNDERHIT:"약함" };
function crosserZone(carrier, dir){
  const adv=advOf(carrier, dir), lat=Math.abs(carrier.y-0.5);
  if(adv>0.925 && lat>0.30) return CROSS_POS.NEAR_CORNER;
  if(adv>0.875) return CROSS_POS.BYLINE;
  if(adv>0.740) return lat>0.25 ? CROSS_POS.DEEP_WIDE : CROSS_POS.HALF_SPACE;
  if(adv>0.600) return lat>0.25 ? CROSS_POS.MID_WIDE  : CROSS_POS.ATT_THIRD;
  return CROSS_POS.ATT_THIRD;
}
/* 박스 안 다섯 공간의 좌표 — 크로서가 있는 쪽을 기준으로 니어/파가 갈린다 */
function crossZonePoints(carrier, dir){
  const side = carrier.y<0.5 ? -1 : 1;                 // 크로서가 붙어 있는 터치라인 쪽
  const X=(adv)=> dir>0 ? adv : 1-adv;
  return [
    {z:CZONE.NEAR,    x:X(0.930), y:clamp01(0.5+side*0.052), gv:0.86},
    {z:CZONE.CENTRAL, x:X(0.903), y:0.5,                     gv:1.00},
    {z:CZONE.FAR,     x:X(0.912), y:clamp01(0.5-side*0.060), gv:0.90},
    {z:CZONE.CUTBACK, x:X(0.846), y:clamp01(0.5+side*0.020), gv:0.94},
    {z:CZONE.EDGE,    x:X(0.778), y:0.5,                     gv:0.34}
  ];
}
/* 궤적별 체공 시간 — 낮은 공은 빠르고, 띄운 공은 오래 떠 있다 */
function crossFlightT(dist, traj){
  const dm=dist*ISO_TO_M;
  if(traj===CROSS_TRAJ.LOW)     return clamp(0.30+dm*0.030, 0.40, 1.10);
  if(traj===CROSS_TRAJ.DRIVEN)  return clamp(1.26+dm*0.030, 1.42, 2.25);
  if(traj===CROSS_TRAJ.CHIPPED) return clamp(1.62+dm*0.037, 1.85, 2.80);
  return clamp(1.70+dm*0.034, 1.92, 2.88);             // LOFTED
}
/* 그 공간에 어울리는 궤적을 고른다 */
function crossTrajFor(zone, pos, carrier, press){
  if(zone===CZONE.CUTBACK || zone===CZONE.EDGE) return CROSS_TRAJ.LOW;
  const sk=carrier.crossSkill||0.6;
  if(pos===CROSS_POS.MID_WIDE || pos===CROSS_POS.ATT_THIRD)
    return sk>0.62 ? CROSS_TRAJ.LOFTED : CROSS_TRAJ.CHIPPED;   // 얼리 크로스는 띄운다
  if(press>0.78) return CROSS_TRAJ.LOFTED;                     // 강하게 압박받으면 일단 띄운다
  if(zone===CZONE.NEAR) return CROSS_TRAJ.DRIVEN;              // 니어는 빠르게 감아 넣는다
  return (Math.random() < 0.18+sk*0.42) ? CROSS_TRAJ.DRIVEN : CROSS_TRAJ.LOFTED;
}
function crossTypeName(pos, zone, traj){
  if(zone===CZONE.CUTBACK) return CROSS_TYPE.CUTBACK;
  if(zone===CZONE.EDGE)    return CROSS_TYPE.LOW;
  if(pos===CROSS_POS.MID_WIDE || pos===CROSS_POS.ATT_THIRD) return CROSS_TYPE.EARLY;
  if(pos===CROSS_POS.DEEP_WIDE && traj!==CROSS_TRAJ.DRIVEN)  return CROSS_TYPE.DEEP;
  if(pos===CROSS_POS.BYLINE || pos===CROSS_POS.NEAR_CORNER)
    return zone===CZONE.NEAR ? CROSS_TYPE.NEAR_POST
         : zone===CZONE.FAR  ? CROSS_TYPE.FAR_POST : CROSS_TYPE.BYLINE;
  if(traj===CROSS_TRAJ.DRIVEN)  return CROSS_TYPE.DRIVEN;
  if(traj===CROSS_TRAJ.CHIPPED) return CROSS_TYPE.CHIPPED;
  return zone===CZONE.NEAR ? CROSS_TYPE.NEAR_POST
       : zone===CZONE.FAR  ? CROSS_TYPE.FAR_POST : CROSS_TYPE.CENTRAL;
}
/* 🎯 공간 점수 — 공이 도착할 그 순간의 그림을 그려서 매긴다.
   지금 누가 서 있는지가 아니라, 공이 닿을 때 누가 거기 있을지를 본다. */
function scoreCrossZone(carrier, pt, mates, opps, gk, dir, traj, taken){
  const dist=HYP((pt.x-carrier.x)*PITCH_AR, pt.y-carrier.y);
  const T=crossFlightT(dist, traj);
  const aerial=(traj!==CROSS_TRAJ.LOW);
  /* ⚠ ×0.60 은 순간 속도를 못 믿어서 눌러 두었던 임시값이다. 평활값으로 바꾸면서 0.85 로 푼다. */
  const fut=(p)=>({ x:clamp01(p.x+vSx(p)/SIM_DT*T*0.85),
                    y:clamp01(p.y+vSy(p)/SIM_DT*T*0.85) });
  /* ① 공격수 — 그 공간에 닿을 수 있는가, 닿으면 뭘 할 수 있는가 */
  let A=null;
  for(const m of mates){
    if(m===carrier || m.slot==="GK") continue;
    if(taken && taken.has(m.id)) continue;              // 이미 다른 공간을 맡은 선수
    const f=fut(m);
    const d=HYP((pt.x-f.x)*PITCH_AR, pt.y-f.y);
    if(d>0.32) continue;                                // 이 공간은 저 선수의 사정권이 아니다
    const at=travelTime(m, d);
    const reach=clamp(1-(at-T)/0.70, 0, 1);
    const qual = aerial ? (m.headSkill||0.6)*0.58 + (m.aerialPos||0.5)*0.32
                        : (m.boxQuick||0.5)*0.48 + (m.finSkill||0.5)*0.34;
    const q = reach*1.15 + qual*0.60 + (m.decSkill||0.5)*0.10;
    if(!A || q>A.q) A={m, q, at, reach, d};
  }
  /* ② 수비수 — 그 공간을 지키러 올 수 있는가 */
  let D=null, dens=0;
  for(const o of opps){
    if(o===gk || o.slot==="GK") continue;
    const f=fut(o);
    const d=HYP((pt.x-f.x)*PITCH_AR, pt.y-f.y);
    if(d<0.085) dens++;
    if(d>0.34) continue;
    const at=travelTime(o, d);
    const q = clamp(1-(at-T)/0.70, 0, 1)*(aerial ? 0.45+(o.headSkill||0.6)*0.55 : 0.88)
            + (o.posSkill||0.5)*0.12;
    if(!D || q>D.q) D={o, q, at};
  }
  /* ③ 골키퍼 구역 — 키퍼가 지배하는 공간에 올리면 그대로 잡힌다 */
  const gkD = gk ? HYP((gk.x-pt.x)*PITCH_AR, gk.y-pt.y) : 9;
  const gkRisk = gk ? clamp(1-gkD/0.165, 0, 1)*(0.30+(gk.cmdSkill||0.5)*0.80)*(aerial?1:0.40) : 0;
  /* ④ 길목 차단 — 공간 패스와 같은 계산을 재사용한다. 뜬 공은 덜 걸린다. */
  const corr = corridorRisk(carrier, pt, opps)*(aerial?0.50:1.0);
  const sep = D ? clamp((A? (D.at-A.at) : -0.5)/0.55, -1, 1) : 1;   // 공격수가 먼저 닿는가
  const score = (A ? A.q*1.00 : -0.70)
              - (D ? D.q*0.60 : 0)
              + sep*0.34
              - dens*0.09
              - gkRisk*0.75
              - corr*0.50
              + pt.gv*0.55;
  return {z:pt.z, x:pt.x, y:pt.y, traj, dist, T, aerial, score,
          A, D, gkRisk, corr, dens, sep};
}
/* 공격 방향 기준으로 얼마나 전진했는가 (0=자기 골문, 1=상대 골문) */
function advOf(p, dir){ return dir>0 ? p.x : 1-p.x; }
function inBox(p, dir){ return advOf(p,dir)>BOX_X && p.y>BOX_Y0 && p.y<BOX_Y1; }
/* 크로스 기회 평가 — 현대축구는 포지션에 관계없이 측면에서 기회가 되면 올린다.
     EARLY   : 아직 멀리 있을 때 수비가 정렬되기 전에 일찍 올린다 (공중)
     BYLINE  : 터치라인 끝까지 파고들어 올린다 (공중, 더 위협적)
     CUTBACK : 골라인 근처에서 뒤로 낮게 빼주는 땅볼 — 가장 확률 높은 현대적 패턴
   올릴 곳이 없거나(박스에 동료 없음) 측면이 아니면 null. */
function evaluateCross(carrier, mates, opps, ctx){
  const dir=ctx.dir;
  const cx=advOf(carrier, dir);
  const cf=clamp(FX(carrier,"cross"), 0, 1.2) + clamp(FX(carrier,"crossFirst"),0,1)*0.12;
  const fq=((ctx.crossFq!=null?ctx.crossFq:1)-1);        // -1(안 올림) ~ +1(매우 적극)
  const wide=Math.abs(carrier.y-0.5) > 0.21-cf*0.055-fq*0.035;
  if(!wide || cx < 0.56-cf*0.075-fq*0.05) return null;
  const pos=crosserZone(carrier, dir);
  const gk=opps.find(o=>o.slot==="GK")||null;
  const selfPress=pressureOn(carrier, opps, ctx.press);
  const rawPress=pressureOn(carrier, opps, 1);      // 궤적 판단은 전술 배율 없이 본다
  /* ① 다섯 공간을 각각 매긴다 — 어느 공간이 가장 위협적인가 */
  const pts=crossZonePoints(carrier, dir);
  const cands=[];
  for(const pt of pts){
    const traj=crossTrajFor(pt.z, pos, carrier, rawPress);
    const c=scoreCrossZone(carrier, pt, mates, opps, gk, dir, traj, null);
    /* 문전 존 가점 — 수비가 몰렸다고 늘 컷백·엣지로 새면 「크로스가 다 낮게 깔린다」(제보).
       위험을 감수하고 박스 안으로 올리는 게 크로스의 본령이다. */
    if(pt.z===CZONE.NEAR||pt.z===CZONE.CENTRAL||pt.z===CZONE.FAR) c.score += 0.30;
    /* 위치에 따라 어울리는 공간의 값이 오른다 */
    if(pos===CROSS_POS.BYLINE || pos===CROSS_POS.NEAR_CORNER){
      if(pt.z===CZONE.CUTBACK) c.score += 0.30;         // 골라인까지 파고들면 컷백이 산다
      if(pt.z===CZONE.NEAR)    c.score += 0.12;
    } else if(pos===CROSS_POS.MID_WIDE || pos===CROSS_POS.ATT_THIRD){
      if(pt.z===CZONE.FAR)     c.score += 0.20;         // 얼리 크로스는 파포스트로
      if(pt.z===CZONE.CUTBACK) c.score -= 0.55;         // 멀리서 컷백은 성립하지 않는다
    } else if(pos===CROSS_POS.DEEP_WIDE){
      if(pt.z===CZONE.FAR)     c.score += 0.10;
      if(pt.z===CZONE.CUTBACK) c.score -= 0.25;
    }
    if(FX(carrier,"earlyCross")>0.3 && (pos===CROSS_POS.MID_WIDE||pos===CROSS_POS.DEEP_WIDE)) c.score+=0.22;
    cands.push(c);
  }
  /* ② 고른다 — 판단력이 좋을수록 최선의 공간을 알아본다 (§31) */
  const dec=carrier.decSkill!=null?carrier.decSkill:0.55;
  let best=null;
  for(const c of cands){
    const s=c.score + (Math.random()-0.5)*(0.10+(1-dec)*0.80);
    if(!best || s>best._s){ best=c; best._s=s; }
  }
  if(!best) return null;
  /* ③ 아무도 그 공간을 공격하지 않으면 억지로 올리지 않는다 (§27 · TEST 10) */
  if(!best.A || best.A.reach<0.30) return null;
  const type=crossTypeName(pos, best.z, best.traj);
  const skill=ctx.crossSkill||0.6;
  /* ④ 크로스를 올릴 값어치가 있는가 — 일반 패스와 같은 척도에서 겨룬다 */
  /* ⚠ 공간 점수를 그대로 얹으면 크로스가 패스를 압도한다(실측: 팀당 42회 — 실제의 2.5배).
     좋은 공간을 찾았을 때만 값이 오르도록 눌러서 얹는다. */
  let score = -1.45 + clamp(best.score-0.55, 0, 2.2)*0.42 + skill*0.50
            - Math.max(0, best.dist-0.30)*1.4 - selfPress*0.62 + cf*0.34;
  /* 🚩 오프사이드 위치의 동료에게 올리지 않는다 — 일반 패스에는 이 눈이 있었는데(§오프사이드
     인지) 크로스에는 없었다. 크로서도 부심 깃발을 본다. 다만 완전히 막지는 않는다 —
     실축에서도 크로스가 오프사이드로 걸리는 장면은 나온다. */
  try{ if(best.A && best.A.m && isOffsidePos(best.A.m, carrier, opps, dir)) score -= 1.20; }catch(e){}
  if(best.z===CZONE.CUTBACK) score += 0.16;
  if(type===CROSS_TYPE.EARLY) score -= 0.42 - (FX(carrier,"earlyCross")>0.3?0.14:0);
  return { type, pos, zone:best.z, traj:best.traj, aerial:best.aerial,
           tx:best.x, ty:best.y, dist:best.dist, flightT:best.T, score,
           to:best.A.m, primary:best.A.m, cand:cands, pick:best,
           boxMates:mates.filter(m=>m!==carrier && inBox(m,dir)).length };
}
/* 패스를 "어떻게" 줄지 정한다 — 얼마나 세게, 발밑인지 공간인지.
     · 받는 선수가 압박받으면 강하게 찔러 넣는다 (약하게 주면 뺏긴다)
     · 침투 중인 동료에게는 발밑이 아니라 앞 공간으로 (뛰어 들어가며 받도록)
     · 멀수록 세게 차야 도달한다
   패스 능력치가 좋을수록 세기 조절이 정교하고 공간 패스를 더 자주 시도한다. */
