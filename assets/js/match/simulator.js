"use strict";
/* ── 세부 능력치 → 매치엔진 스킬 ──────────────────────────────────
   FM 설명대로, 각 능력치가 혼자 작동하지 않고 서로를 보정한다.
   여기가 유일한 변환 지점이라 엔진 나머지는 손대지 않아도 된다. */
function W(a, spec, fb){        // 가중 평균 (spec: {key:weight})
  let s=0, w=0;
  for(const k in spec){ const v=(a&&typeof a[k]==="number")?a[k]:fb; s+=v*spec[k]; w+=spec[k]; }
  return w? s/w : fb;
}
/* 능숙도가 낮으면 그 자리에서 제 기량이 안 나온다 — FM처럼 "능력치가 깎이는" 게 아니라
   판단·위치선정처럼 자리 이해가 필요한 쪽이 크게, 순수 신체 능력은 거의 안 깎인다. */
function applyFamiliarity(sk, fam, p, slot){
  const f=clamp(fam/100, 0, 1);
  const g=Math.pow(f, 1/FAM_CURVE);        // 능숙도가 낮은 구간에서 훨씬 빠르게 나빠진다
  const band=(p&&slot)?bandGapPenalty(p, slot):1;
  const heavy=(1 - (1-g)*FAM_PEN_HEAVY)*band;   // 자리 이해가 필요한 것
  const light=(1 - (1-g)*FAM_PEN_LIGHT)*(0.55+band*0.45);  // 몸으로 하는 것 — 덜하지만 영향은 받는다
  for(const k of ["posSkill","decSkill","offTiming","markSkill","passSkill","crossSkill","teamwork"]) if(sk[k]!==undefined) sk[k]*=heavy;
  for(const k of ["finSkill","lngSkill","dribSkill","firstTouch","headSkill","tackleSkill"]) if(sk[k]!==undefined) sk[k]*=light;
  // 어색한 자리에 선 선수는 있어야 할 곳에 없다 — 활동량·대담성도 흔들린다
  if(sk.workRate!==undefined) sk.workRate*=(0.7+heavy*0.3);
  if(sk.bravery!==undefined)  sk.bravery *=(0.75+band*0.25);
  sk.familiarity=f; sk.bandK=band;
  return sk;
}
/* 팀 전술 적응도(조직력)를 경기용 능력치에 얹는다.
   개인의 포지션 능숙도(applyFamiliarity)와는 다른 층이다 — 저쪽은 "이 선수가 이 자리를 아는가",
   이쪽은 "열한 명이 서로의 움직임을 아는가"다. 그래서 패스·판단·위치선정처럼
   동료를 전제로 하는 것만 건드리고, 개인기·슈팅·몸싸움은 손대지 않는다. */
const TFAM_PASS=0.10, TFAM_DEC=0.12, TFAM_POS=0.10, TFAM_TEAM=0.15;
function applyTeamFam(sk, k){
  sk.teamFamK=k||0;
  if(!k) return sk;
  if(sk.passSkill!=null)  sk.passSkill  = clamp(sk.passSkill *(1+k*TFAM_PASS), 0.15, 1);
  if(sk.decSkill!=null)   sk.decSkill   = clamp(sk.decSkill  *(1+k*TFAM_DEC),  0.15, 1);
  if(sk.posSkill!=null)   sk.posSkill   = clamp(sk.posSkill  *(1+k*TFAM_POS),  0.15, 1);
  if(sk.teamwork!=null)   sk.teamwork   = clamp(sk.teamwork  *(1+k*TFAM_TEAM), 0.15, 1);
  if(sk.offTiming!=null)  sk.offTiming  = clamp(sk.offTiming *(1+k*TFAM_DEC),  0.15, 1);
  return sk;
}
/* ── 체격 보정 ────────────────────────────────────────────────
   FM 원칙 그대로: 능력치가 먼저고 체격은 그 위에 얹는 보정이다(±12% 안쪽).
   키 194cm 센터백은 같은 헤딩 능력치라도 공중볼을 더 잘 따내고,
   체중 88kg 스트라이커는 등지고 버티는 힘이 세지만 방향 전환이 굼뜨다. */
const BODY_REF_H=178, BODY_REF_W=74;
function bodyFx(p){
  const h=(p&&p.h)||BODY_REF_H, w=(p&&p.w)||BODY_REF_W;
  const tall=clamp((h-BODY_REF_H)/20, -1.3, 1.3);
  const bmi=w/Math.pow(h/100,2);                       // 대개 21~26
  const mass=clamp((bmi-22.6)/2.4, -1.3, 1.3);         // 마른 체형 ~ 다부진 체형
  const bulk=clamp(tall*0.40+mass*0.80, -1.3, 1.3);    // 순수 덩치
  return {
    tall, mass, bulk,
    head: 1 + tall*0.11 + mass*0.03,                   // 공중볼 — 8할이 키
    str:  1 + mass*0.12 + tall*0.04,                   // 몸싸움 — 8할이 체중
    agi:  1 - bulk*0.085,                              // 덩치가 클수록 방향 전환이 느리다
    pace: 1 - Math.max(0,mass)*0.05 + Math.max(0,-mass)*0.02
  };
}
/* ── 포지션 능숙도 페널티 ────────────────────────────────────
   예전에는 능숙도 0이어도 판단·위치선정이 30%만 깎였다. 그래서 골키퍼를 최전방에 세우고
   전원을 엉뚱한 자리에 놓아도 경기가 비슷하게 흘러갔다. FM에서는 그러면 경기가 무너진다.
   지금은 (1) 능숙도 자체의 페널티를 크게 키우고,
        (2) 원래 라인(수비/미드/공격/골키퍼)과 다른 자리에 세우면 별도 페널티를 한 겹 더 얹는다. */
const FAM_PEN_HEAVY=0.58;   // 능숙도 0 일 때 판단·위치선정이 58% 깎인다
const FAM_PEN_LIGHT=0.26;
const FAM_CURVE=1.45;       // 낮은 구간일수록 급격히 나빠진다 (50이면 절반이 아니라 그 이상 손해)
/* 🎓 역할 능숙도 — 포지션 능숙도의 절반 무게로 같은 곳을 건드린다.
   「자리는 아는데 이 역할은 처음」인 선수는 몸으로 하는 건 그대로지만,
   언제 올라가고 언제 남을지를 몰라 판단·위치선정·연계가 흔들린다. */
const RFAM_PEN_HEAVY=0.29, RFAM_PEN_LIGHT=0.13, RFAM_CURVE=1.45;
function applyRoleFam(sk, p, slot, t){
  try{
    if(!p || p.pos==="GK" || !slot) return sk;
    const rd=getRole(t, p, slot); if(!rd || !rd.r) return sk;
    const v=getRoleFam(p, rd.r);
    const g=Math.pow(clamp(v/100,0,1), 1/RFAM_CURVE);
    const heavy=1-(1-g)*RFAM_PEN_HEAVY;
    const light=1-(1-g)*RFAM_PEN_LIGHT;
    for(const k of ["posSkill","decSkill","offTiming","markSkill","passSkill","teamwork"]) if(sk[k]!==undefined) sk[k]*=heavy;
    for(const k of ["crossSkill","finSkill","dribSkill","firstTouch","tackleSkill"]) if(sk[k]!==undefined) sk[k]*=light;
    sk.roleFam=v/100; sk.roleKey=rd.r;
  }catch(e){}
  return sk;
}
/* 라인 자체가 다를 때의 추가 페널티 — 수비수를 최전방에, 골키퍼를 필드에 세우는 경우 */
const BAND_ORDER={GK:0, SW:1, DF:1, WB:1.6, DM:2.2, MF:2.6, AM:3.2, FW:4};
const OUTBAND_PEN=0.13;     // 라인 한 칸 어긋날 때마다
const GK_MISUSE=0.42;       // 골키퍼를 필드에 / 필드 선수를 골문에 세웠을 때
function bandGapPenalty(p, slot){
  // SLOT_BAND 에는 GK 밴드가 없다(필드 슬롯만 담긴다). 골키퍼는 따로 판정한다.
  const isGkSlot = slot==="GK";
  const isGkPlayer = p.pos==="GK";
  if(isGkSlot !== isGkPlayer) return 1-GK_MISUSE;       // 키퍼를 필드에 / 필드 선수를 골문에
  if(isGkSlot) return 1;
  const nb=BAND_ORDER[SLOT_BAND[prefSlotOf(p)]];
  const sb=BAND_ORDER[SLOT_BAND[slot]];
  if(nb===undefined || sb===undefined) return 1;
  return 1 - Math.min(0.55, Math.abs(nb-sb)*OUTBAND_PEN);
}
function matchSkills(p){
  const a=p.attr||{}, fb=p.ovr||65, g=p.gkA||null;
  const B=bodyFx(p);
  // 하한 0.25는 너무 후했다 — 어떤 선수든 최소 4분의 1은 하고 봤다는 뜻이라
  // 실력 차이가 화면에서 지워졌다. 진짜 못하는 선수는 진짜 못해야 한다.
  // 여기에 완만한 감마(1.16)를 얹어 중상위 구간의 차이를 조금 더 벌린다 —
  // 좋은 선수를 데려왔을 때 그 값어치가 화면에서 느껴져야 한다.
  const S=(x)=>clamp(Math.pow(clamp(x,0,100)/100, 1.16), 0.11, 1);
  return {
    body:B,
    // 패스 — 시야가 기회를 발견하고, 개인기가 실행 퀄리티를 결정한다
    passSkill:  S(W(a,{pas:0.55, vis:0.25, tec:0.20}, fb)),
    // 태클 — 파울 없이 끊는 능력. 예측력·적극성이 타이밍을 만든다
    tackleSkill:S(W(a,{tck:0.60, ant:0.20, agg:0.10, str:0.10}, fb)),
    // 드리블 — 순수 드리블에 주력·가속도·민첩성·균형이 실린다
    dribSkill:  S(W(a,{dri:0.45, tec:0.15, agi:0.15, bal:0.13, acc:0.07, pac:0.05}, fb)*B.agi),
    // 민첩성 — 좁은 공간에서 몸을 트는 능력. 덩치가 크면 깎인다.
    agility:    S(W(a,{agi:0.52, bal:0.28, acc:0.20}, fb)*B.agi),
    // 헤더 — 점프력과 신장, 몸싸움(덜 중요). 실제 신장이 여기에 직접 실린다.
    /* 🎯 헤더 — FM 기준: 점프 거리(1순위) · 헤딩 정확도 · 키 · 몸싸움.
       골 결정력(fin)은 관여하지 않는다. 공중볼 경합을 이기는 힘 그 자체다. */
    headSkill:  S(W(a,{jum:0.38, hea:0.34, str:0.16, bra:0.06, bal:0.06}, fb)*B.head),
    /* 헤더 마무리 정확도 — 머리에 맞춘 공을 골문 안으로 보내는 능력 */
    headAim:    S(W(a,{hea:0.62, tec:0.14, cmp:0.12, bal:0.12}, fb)),
    /* 크로스가 올 때 빈 공간을 선점하는 능력 (공격 위치선정·예측력) */
    aerialPos:  S(W(a,{otb:0.50, ant:0.34, bal:0.16}, fb)),
    // 침투 타이밍 — 오프더볼과 예측력
    offTiming:  S(W(a,{otb:0.55, ant:0.30, dec:0.15}, fb)),
    // 크로스 — 크로스 능력치에 개인기·시야
    crossSkill: S(W(a,{crs:0.62, tec:0.20, vis:0.18}, fb)),
    // 골 결정력 — 침착성과 판단력이 꾸준함을 만든다
    /* 🎯 근거리 마무리 — FM 기준: 결정력(구석으로 밀어 넣는 기술) + 침착성(압박에도 흔들리지 않음).
       판단력은 "때릴까 말까"를 가르는 결정 로직에 따로 들어가므로 여기서는 뺀다.
       천재성은 키퍼 타이밍을 뺏는 보조 요소로 소량. */
    finSkill:   S(W(a,{fin:0.52, cmp:0.34, fla:0.14}, fb)),
    /* 골문 앞 순간 반응 — 수비수보다 먼저 닿고(순발력), 몸을 틀어 각을 만든다(민첩성) */
    boxQuick:   S(W(a,{acc:0.45, agi:0.40, bal:0.15}, fb)*B.agi),
    // 중거리 — 대체로 독립적이되 천재성이 시도를 늘린다
    /* 🎯 중거리 — FM 기준: 중거리 슛(가장 직접적) · 기술 · 침착성.
       골 결정력(fin)은 박스 안 마무리용이라 여기에 넣지 않는다. */
    lngSkill:   S(W(a,{lon:0.56, tec:0.24, cmp:0.20}, fb)),
    /* 슛 파워 — 키퍼가 반응하기 어렵게 만드는 부가 요소 */
    shotPower:  S(W(a,{str:0.45, lon:0.35, tec:0.20}, fb)),
    // 골키퍼 — 반사신경·일대일·핸들링
    gkSkill:    g ? S(W(g,{ref:0.42, one:0.28, han:0.20, cmd:0.10}, fb)) : S(fb*0.6),
    /* 🧤 ⚠ 요청 — 「키퍼 1대1. 각을 좁히며 나오기/버티기 판단(oneOnOne), 공격수는 그걸 보고
       칩샷·밀어넣기·제치기 선택, 키퍼가 너무 일찍 나오면 칩샷에 당함」.
       「일대일 방어(one)」 능력치는 지금까지 프로필에만 있고 엔진은 gkSkill 합계로만 읽었다 —
       1대1 전용 축으로 따로 뽑는다. 침착성·용기가 붙는다(뛰쳐나가는 판단은 배짱이다). */
    oneSkill:   g ? S(W(g,{one:0.62, cmp:0.16, cnt:0.12, bra:0.10}, fb)) : S(fb*0.6),
    // 주력 — 최고 속도(가속도와 함께). 옛 호출부가 쓰는 종합 스피드 지표.
    paceSkill:  S(W(a,{pac:0.55, acc:0.35, sta:0.10}, fb)*B.pace),
    // 최고 속도 — 30m를 달릴 때. 주력이 지배하고, 체중이 무거우면 깎인다.
    topSpeed:   S(W(a,{pac:0.76, acc:0.14, sta:0.10}, fb)*B.pace),
    // 가속도 — 첫 5m. 세컨볼·압박 도달·돌파 직후 이탈이 전부 여기서 갈린다.
    accelSkill: S(W(a,{acc:0.72, agi:0.16, bal:0.12}, fb)*B.agi),
    // 몸싸움 — 힘과 균형. 실제 체중이 여기에 직접 실린다.
    strength:   S(W(a,{str:0.62, bal:0.23, agg:0.15}, fb)*B.str),
    // 위치 선정(수비) — 위치선정·예측력·집중력
    posSkill:   S(W(a,{pos:0.50, ant:0.28, cnt:0.22}, fb)),
    // 판단력 — 낮으면 멈칫한다
    decSkill:   S(W(a,{dec:0.55, cnt:0.25, cmp:0.20}, fb)),
    // ── 새로 추가되는 축들 ─────────────────────────
    // 퍼스트 터치 — 낮으면 압박에서 볼을 흘린다
    firstTouch: S(W(a,{fir:0.65, tec:0.20, cmp:0.15}, fb)),
    // 대인마크 — 몸싸움·위치선정·예측력이 효율을 정한다
    markSkill:  S(W(a,{mar:0.50, pos:0.20, ant:0.18, str:0.12}, fb)),
    // 천재성 — 위험한 플레이(돌파·중거리·과감한 패스) 성향
    flair:      S(W(a,{fla:0.75, tec:0.25}, fb)),
    // 활동량 — 있어야 할 곳에 있는 능력. 수비 복귀·압박 참여 빈도
    workRate:   S(W(a,{wor:0.60, sta:0.25, tea:0.15}, fb)),
    // 대담성 — 50:50 경합에 몸을 던지는 빈도
    bravery:    S(W(a,{bra:0.70, det:0.30}, fb)),
    // 팀워크 — 전술을 따를지, 제멋대로 할지
    teamwork:   S(W(a,{tea:0.75, wor:0.25}, fb)),
    // 리더십 — 경기 중 동료를 다잡는 힘. 팀에서 가장 높은 한 명이 전체를 끌어올린다.
    leadership: S(W(a,{ldr:0.70, det:0.18, cmp:0.12}, fb)),
    // 타고난 체력 — 같은 90분을 뛰어도 덜 지친다
    natFit:     S(W(a,{nat:0.65, sta:0.35}, fb)),
    // 세트피스
    setPiece:   S(W(a,{cor:0.5, fre:0.5}, fb)),
    penSkill:   S(W(a,{pen:0.70, cmp:0.30}, fb)),
    // 직접 프리킥 — 감아 넘기는 기술이 8할이고, 나머지는 발재간과 침착함
    fkSkill:    S(W(a,{fre:0.72, tec:0.16, cmp:0.12}, fb)),
    throwLong:  S(W(a,{thr:1}, fb)),
    // 골키퍼 성향 (기행·돌진·펀칭 빈도)
    gkRush:     g ? S(W(g,{tro:0.6, cmd:0.4}, fb)) : 0.5,
    gkPunch:    g ? S(W(g,{pun:0.7, han:0.3}, fb)) : 0.5,
    gkKick:     g ? S(W(g,{kic:0.7}, fb)) : 0.5,
    // 공중볼 처리 — 박스로 떨어지는 크로스를 직접 나와서 잡거나 쳐낸다
    gkAerial:   g ? S(W(g,{aer:0.66, cmd:0.22, han:0.12}, fb)) : 0.5,
    // 수비 조율 — 뒤에서 라인을 세우고 자리를 잡아 준다. 수비수의 위치 오차를 줄인다.
    gkOrganize: g ? S(W(g,{com:0.66, cmd:0.34}, fb)) : 0.5,
    // 스위퍼 성향 — 기행(박스 밖으로 나가는 성향) + 돌진 빈도 + 박스 장악력 + 발 기술.
    // 노이어형 키퍼는 이 값이 높아 빌드업 때 아예 박스 밖에 서 있는다.
    sweepAbility: g ? S(W(g,{ecc:0.32, tro:0.28, cmd:0.22, kic:0.18}, fb)*
                        (0.75+((p.attr&&p.attr.pas)||60)/100*0.35)) : 0.4,
    // 선호 플레이 — 능력치를 더 주는 게 아니라 "선택"을 바꾼다
    tr: traitFx(p.traits)
  };
}
/* 순간 전력질주를 건다 — 쿨타임이 남아 있으면 그냥 뛴다 */
class MatchSim{
  constructor(M, opts){
    this.M=M; this.opts=opts||{};
    // 실제 경기로 쓸 때만 M에 기록하고 해설을 낸다. 관전용 시뮬에서는 끈다(세이브를 건드리면 안 되므로).
    this.emitEvents=!!this.opts.live;
    this.lastAssist=null;
    try{ simPick=null; }catch(e){}   // 이전 경기에서 클릭해 둔 선수 선택(금색 링)이 새 경기로 넘어오지 않게
    this.halfDone=false;
    /* ⚠ 후반에 골문을 바꿔 선 상태인지. 이 값이 없어서 교체만 하면 전반 진영으로 되돌아갔다. */
    this.ends=0;
    /* 하이라이트 녹화 — 실제 경기에서만 켠다.
       ⚡ 「보여 주지 않는 경기」는 녹화도 하지 않는다(제보 — 위임 경기 렉).
          링버퍼는 틱마다 선수 22명분 객체를 새로 만들고 260칸을 밀어낸다(실측 전체의 7%).
          수석코치 위임 결과 화면에는 하이라이트도 자막도 나오지 않으므로 통째로 끈다.
          rec 를 따로 주지 않으면 예전처럼 live 를 따른다. */
    this.recording = (this.opts.rec!==undefined) ? !!this.opts.rec : !!this.opts.live;
    this.buf=[]; this.hl=null; this.caps=[];
    this.evlog=[];   // 📓 내러티브용 구조화 이벤트 로그 — 문장이 아니라 데이터를 녹음한다
    this.pendingOff=null;   // 늦게 올라갈 수 있는 오프사이드 깃발
    this.t=0;
    /* 🕸️ 패스맵 — 「누가 누구에게 몇 번 줬는가」와 「그동안 어디에 서 있었는가」.
       실제 패스맵이 그렇듯, 노드 위치는 평균 위치이고 선 굵기는 연결 횟수다. */
    this.pmap={h:{link:{}, pos:{}, ppos:{}, meta:{}, xi:[]}, a:{link:{}, pos:{}, ppos:{}, meta:{}, xi:[]}};
    /* 🕸️ 패스맵은 「선발 11명」의 그림이다 — 교체 투입 선수까지 얹으면 13~14명이 되어
       대형이 뭉개지고, 실제 패스맵과도 달라진다(제보). 킥오프 명단을 여기서 못 박아 둔다. */
    try{ for(const k of ["h","a"]) this.pmap[k].xi=(M[k].list||[]).map(x=>x.p&&x.p.id).filter(v=>v!=null); }catch(e){}
    this._pmTick=0;
    this.agents=[]; this._sideC=null;
    this.buildSquads();
    /* 🧠 AI 벤치 — 경기 시작 시점의 전술을 스냅샷해 두고, 상황에 따라 실시간 조정한다.
       경기가 끝나면 원래 값으로 복원한다 (시즌 전술 성향은 그대로). */
    this._tacBase={}; this._aiTacSig={}; this._aiTacAt=0;
    try{
      for(const k2 of ["h","a"]){
        const tm=this.rec(k2).team;
        if(tm && !tm.isUser && tm.tactic){
          const c={formation: tm.tactic.formation};
          for(const kk of TAC_KEYS) c[kk]=tm.tactic[kk];
          this._tacBase[k2]=c;
        }
      }
    }catch(e){}
    /* 🧑‍⚖️ 오늘의 심판 — 주심 성향이 카드 판정에, 감독-심판 관계가 유저 팀 판정에 작용한다 */
    try{
      this.refCrew=refCrewOf(M);
      const RK={strict:1.28, calm:0.84, proud:1.08, vet:0.92, rookie:1.14};
      this.refStrict=RK[(this.refCrew.main.t||{}).k]||1;
    }catch(e){ this.refCrew=null; this.refStrict=1; }
    this.stats={
      h:this.blankStat(), a:this.blankStat(),
      thirds:{def:0, mid:0, att:0}, ticks:0
    };
    this.ball={x:0.5, y:0.5, z:0, vx:0, vy:0, vz:0, inNet:false, bounced:0,
               ownerId:null, state:"SETTLED", fromId:null, toId:null,
               tx:0.5, ty:0.5, flight:0, flightLen:0, hold:0};
    this.score={h:0, a:0};
    this.matchState=MATCH_STATE.PLAYING;
    this.ref={x:0.5, y:0.40};          // 주심 — 볼을 따라다니되 거리를 둔다
    this.sentOff=[];                   // 퇴장 기록
    this.firstKickSide="h"; this._endsSwapped=false;
    this.kickoff("h");
  }
  blankStat(){ return {pass:0, passOk:0, fwd:0, lat:0, back:0, intercept:0, lost:0, poss:0, passLen:0, longPass:0,
                       tackle:0, tackleWon:0, slide:0, slideWon:0, foul:0, aerial:0, aerialWon:0, offside:0,
                       throwIn:0, corner:0, goalKick:0, freeKick:0,
                       pen:0, penGoal:0, penSaved:0, penMiss:0, goalDisallowed:0, injury:0, fkDirect:0, fkGoal:0, wallBlock:0,
                       cross:0, crossOk:0, crossEarly:0, crossByline:0, crossCutback:0,
                       toSpace:0, powerSum:0, crossFloat:0, crossDriven:0,
                       shot:0, shotOn:0, shotOff:0, shotBlocked:0, shotSaved:0, shotCaught:0, shotParried:0,
                       shotHeader:0, shotVolley:0, shotFinesse:0, shotChip:0, shotPower:0, shotPlaced:0,
                       shotClose:0, shotNormal:0, shotLong:0,
                       goal:0, goalDeflected:0, block:0, save:0, deflect:0, crossBlocked:0,
                       shotPunched:0, shotTipped:0, superSave:0, woodwork:0,
                       takeOn:0, takeOnWon:0, clearance:0, shortPass:0, longPassT:0, yellow:0, red:0, verbal:0, jostle:0,
                       z1:0, z2:0, z3:0}; }   // 소유 중 볼이 있던 구역 — z3=상대 진영(수석코치 분석용)
  /* ── 기록 브리지 ────────────────────────────────────────────────
     MatchSim은 원래 "구경거리"였다. 실제 경기로 쓰려면 시즌 시스템이 읽는 M 객체
     (M.hg/ag, M.st, M.events, 선수별 골·도움·카드)에 결과를 그대로 적어 넣어야 한다.
     그래야 applyMatchResult·평점·득점왕·뉴스·라커룸이 전부 손대지 않고 돌아간다. */
  rec(side){ return side==="h" ? this.M.h : this.M.a; }
  /* 에이전트 → M.list 항목. 골·카드는 이 항목에 쌓인다. */
  entryOf(agent){
    if(!agent) return null;
    const sd=this.rec(agent.side);
    return sd.list.find(x=>x.p===agent.p) || null;
  }
  /* 경기 시계를 M에 맞춘다 — 해설 줄의 시간 배지가 여기서 나온다 */
  syncClock(){
    const m=Math.floor(this.clock/60);
    this.M.min=clamp(m, 0, 999);
    this.M.half = this.clock < this.htSec ? 1 : 2;
    this.M.minTxt=this.clockLabel();
    /* ⏱️ 제보 — 추가시간을 분 단위 표(matchMinLabel)에도 내려 준다.
       예전에는 분 단위 엔진에서만 채워져, 연속 엔진의 다른 화면들이 「90+3」을 못 찍었다. */
    if(this._a1!=null) this.M.a1=Math.max(1, Math.round(this._a1/60));
    if(this._a2!=null) this.M.a2=Math.max(1, Math.round(this._a2/60));
    if(this._a3!=null) this.M.a3=Math.max(1, Math.round(this._a3/60));
  }
  /* ⏱️ 전광판에 찍히는 글자 — 추가시간은 45+1 · 90+3 · 105+1 · 120+2 로 보인다.
     ⚠ 제보 — 「추가시간이 46 으로 표시된다」. 흐른 초를 그대로 분으로 바꿔 찍고 있었다.
        실제 중계는 45분에서 시계를 멈춰 두고 그 위에 추가분을 얹어 보여 준다. */
  clockLabel(at){
    return matchClockTxt((at==null ? this.clock : at), this._a1||0, this._a2||0, this._a3||0, !!(this.M&&this.M.etOn));
  }
  _clockLabelOld(at){
    const c=(at==null ? this.clock : at);
    const a1=this._a1||0, a2=this._a2||0, a3=this._a3||0;
    const H=SIM_SECONDS/2;
    const up=(s)=>Math.max(1, Math.ceil(s/60));
    if(c<=H) return String(Math.floor(c/60));
    /* ⚠ 제보 — 「후반 시작 직후에 45+n분 이게 잠깐 떴다가 바뀐다」.
       후반은 clock==htSec(45분+전반 추가시간)에서 대기하는데, 경계 판정이 <= 라서
       그 순간의 전광판이 「45+n」으로 찍혔다. 경계를 후반으로 넘긴다(하프타임 판정과 같은 쪽). */
    if(c<H+a1) return "45+"+up(c-H);
    const c2=c-a1;                                  // 후반 — 전반 추가시간을 뺀 실제 시계
    if(c2<=SIM_SECONDS) return String(Math.floor(c2/60));
    if(!this.M.etOn) return "90+"+up(c2-SIM_SECONDS);
    if(c2<SIM_SECONDS+a2) return "90+"+up(c2-SIM_SECONDS);   // 연장 시작 대기 순간은 「90」쪽으로
    const c3=c2-a2;                                 // 연장
    if(c3<=SIM_SECONDS+ET_SECONDS/2) return String(Math.floor(c3/60));
    if(c3<SIM_SECONDS+ET_SECONDS/2+a3) return "105+"+up(c3-(SIM_SECONDS+ET_SECONDS/2));
    const c4=c3-a3;
    if(c4<=SIM_SECONDS+ET_SECONDS) return String(Math.floor(c4/60));
    return "120+"+up(c4-(SIM_SECONDS+ET_SECONDS));
  }
  /* 해설 한 줄 — 기존 COMM 템플릿을 그대로 쓴다.
     각 줄에 "시뮬 시각"을 박아 둔다 — 하이라이트를 되감아 재생할 때
     화면보다 해설이 앞서 나가 결과를 미리 알려 버리지 않게 하기 위해서다. */
  say(side, txt, type, scene){
    if(!this.M || !this.emitEvents) return;
    this.syncClock();
    this.syncStats();                      // 이 줄이 나가는 시점의 통계를 확정해 둔다
    ev(this.M, side?this.rec(side):null, txt, type||"txt", false, scene||null);
    const e=this.M.events[this.M.events.length-1];
    if(e){
      e.simT=this.t;          // 통계 스냅샷은 ev() 가 이미 붙여 두었다
      /* ⏱️ ⚠ 제보 원문 — 「가끔 실제 경기 시간과 경기 화면 해설 문구의 시간이 맞지 않는다.
         동일하게 흘러갈 수 있도록 교정해 달라」.
         원인 — 전광판은 초 단위 시계(clockLabel)로 「90+3」을 찍는데, 해설 줄의 시간 배지는
            분 단위 표(matchMinLabel)를 따로 쓰고 있었다. 그 표가 보는 추가시간(M.a1/M.a2)은
            분 단위 엔진에서만 채워지는 값이라, 연속 2D 엔진에서는 비어 있기 일쑤였다 —
            그래서 전광판이 「90+3」일 때 해설 줄은 「93」으로 찍혔다.
         ─ 해설 줄도 전광판과 똑같은 시계를 쓴다. 한 곳에서 나온 글자라 어긋날 수가 없다. */
      try{ e.min=this.clockLabel(); }catch(_){}
    }
  }
  /* ── 하이라이트 녹화 ──────────────────────────────────────────
     FM처럼 "빌드업부터 결말까지" 되감아 보여주려면, 결정적 장면이 터진 뒤에
     그 앞 장면을 알고 있어야 한다. 그래서 매 틱 좌표를 링버퍼에 남겨 둔다. */
  /* ── 실시간 해설 자막 녹음 ────────────────────────────────────
     화면 하단 패널에 흐를 문장이다. 문자중계 로그(M.events)와는 완전히 별개로,
     하이라이트로 잘려 나갈 구간만 쓰이고 시즌 기록에는 남지 않는다.
     프레임과 같은 링버퍼 방식이라 "되감아 보여주기"가 그대로 성립한다. */
  cap(side, pool, vars, rt, meta){
    if(!this.recording || !pool) return;
    /* 🎙️ 해설 감사(제보) — 같은 틀의 한 줄이 30초 안에 또 나온 비율 16.5%. 걷어내기 한 줄이 경기당 137번,
       공중볼 68번 — 일어난 모든 일을 중계하니 로봇처럼 들렸다. 루틴 풀(패스 연결·걷어내기·인터셉트·공중볼)에
       풀별 쿨다운을 건다 — 골·선방·카드 등 큰 장면 풀은 대상이 아니다. */
    try{
      const _cd = pool===COMM.lvClear?25 : pool===COMM.lvClearAtt?25 : pool===COMM.lvPass?9
                : pool===COMM.lvPassLong?14 : pool===COMM.lvItc?14 : pool===COMM.lvAerial?18 : 0;   // ⚠ 1차(6~14초)로는 총량이 거의 안 줄었다
      if(_cd){
        this._capCool=this._capCool||new Map();
        const _lt=this._capCool.get(pool);
        if(_lt!=null && this.t-_lt<_cd) return;
        this._capCool.set(pool, this.t);
      }
    }catch(e){}
    /* 🎙️ 같은 틀 연속 방지 — 틀 인덱스를 여기서 직접 뽑고, 직전에 쓴 틀과 같으면 옆 칸으로 옮긴다.
       (1차 시도: 완성문에서 틀 앞 6글자를 역매칭해 재추첨 — 근사 매칭이 자주 빗나가 효과 불명, 폐기) */
    let _txt;
    if(Array.isArray(pool) && pool.length>1){
      this._capLast=this._capLast||new Map();
      let _i=Math.floor(Math.random()*pool.length);
      if(_i===this._capLast.get(pool)) _i=(_i+1)%pool.length;
      this._capLast.set(pool,_i);
      _txt=F_(pool[_i], vars||{});
    } else {
      _txt=F_(pool, vars||{});
    }
    this.caps.push(Object.assign({t:this.t, side, txt:_txt, rt:rt?1:0}, meta||{}));
    if(this.caps.length>HL_CAP_MAX) this.caps.shift();
  }
  /* ── 📓 내러티브 이벤트 로그 ────────────────────────────────
     하이라이트가 잘릴 때 이 로그로 장면 전체를 재구성해 해설을 다시 쓴다.
     원칙(§35): 여기 기록된 것만 사실이다 — 엔진이 실제로 내린 결정과 결과만 담는다. */
  evl(ty, a, d){
    if(!this.recording) return;
    const e={t:this.t, ty, s:a?a.side:null, id:a?a.id:0,
             nm:(a&&a.p)?a.p.name:null, x:this.ball.x, y:this.ball.y};
    if(d) Object.assign(e, d);
    this.evlog.push(e);
    if(this.evlog.length>EVLOG_MAX) this.evlog.shift();
  }
  nm(a){ return a && a.p ? a.p.name : "선수"; }
  /* 🤜 몸이 부딪혔다 — 관련된 선수들을 짧게 떨게 한다 (요청) */
  jitter(list, pow){
    try{ for(const a of (Array.isArray(list)?list:[list])){
      if(!a) continue; a._jt=this.t; a._jp=pow||1;
    } }catch(e){}
  }
  /* ═══ 👻 그라운드를 떠난 선수 보관 ═════════════════════════════════
     ⚠ 제보 — 「PK 상황에서 아무도 없는데 투명 선수가 차고, GOAL 팝업에 이름이 안 떴다」.
        퇴장·교체 아웃·부상 이탈로 agents 에서 빠진 선수는 하이라이트를 되감을 때
        byId() 로 찾을 수 없어 화면에 그려지지 않았고(=투명), 득점자 이름 조회도 실패했다.
        하이라이트 버퍼는 그 선수가 있던 프레임을 그대로 갖고 있으므로, 그리기·이름 조회용
        사본만 남겨 두면 장면이 온전해진다. 경기 로직에는 절대 참여하지 않는다. */
  retireAgents(pred, why){
    const gone=this.agents.filter(pred);
    if(gone.length){
      if(!Array.isArray(this.gone)) this.gone=[];
      for(const a of gone){ a._leftAt=this.t; a._leftWhy=why||""; this.gone.push(a); }
      if(this.gone.length>16) this.gone.splice(0, this.gone.length-16);
    }
    this.agents=this.agents.filter(a=>!pred(a));
    this._sideBust();
    return gone;
  }
  /* ═══ 🅿️ 「투명 선수가 페널티킥을 찬다」 ═══════════════════════════════
     ⚠ 제보 원문 — 「교체 카드를 다 써서 부상 선수가 퇴장 당했는데 선수 교체 없이 그 부상 선수를
        빼고 진행을 할 때 페널티킥이 났는데 투명 선수가 차는 버그가 있습니다. 아마 그 부상 선수가
        피치 위에 없어서 이런 버그가 생긴 것 같습니다 (마침 그 부상 선수가 스트라이커라서
        페널티킥 키커 목록에 있었습니다)」
     원인 — 그라운드를 떠난 선수(부상 이탈·퇴장·교체 아웃)는 agents 에서 빠지지만, 어떤 경로로든
        agents 에 유령이 남으면(하이라이트 되감기용 유령 복원이 그리기 도중 예외로 걷히지 못한
        경우 등) 「전담 키커 목록 → 그라운드 위 선수」 검사를 그대로 통과한다. 그 선수는 실제
        엔트리상으로는 이미 나간 사람이라 화면에 그려지지 않아 「투명 선수가 차는」 장면이 된다.
     ─ agents 목록만 믿지 않고 「엔트리가 정말 그라운드 위인가(off===null·레드카드 아님)」를
        마지막에 한 번 더 확인한다. 아래 onField() 가 그 창구다. */
  onField(a){
    try{
      if(!a || this.agents.indexOf(a)<0) return false;
      const x=this.entryOf(a);
      return !!(x && x.off===null && !x.red);
    }catch(e){ return false; }
  }
  /* 🧹 유령 청소 — 엔트리상 나간 선수가 agents 에 남아 있으면 그 자리에서 걷어낸다.
     syncGuard 는 인원 수만 비교하므로 「한 명 유령 + 한 명 누락」이 겹치면 못 잡는다. */
  reapGhosts(){
    try{
      if(!this.M) return;
      const stale=this.agents.filter(a=>{ const x=this.entryOf(a); return !x || x.off!==null || x.red; });
      if(!stale.length) return;
      const ids=new Set(stale.map(a=>a.id));
      this.retireAgents(a=>ids.has(a.id), "ghost");
      const b=this.ball;
      if(b){
        if(b.ownerId!=null && ids.has(b.ownerId)) b.ownerId=null;
        if(b.toId!=null && ids.has(b.toId)) b.toId=null;
      }
    }catch(e){}
  }
  /* 이름·기록 조회용 — 그라운드를 떠난 선수까지 찾는다 (경기 판단에는 쓰지 않는다) */
  byIdAny(id){
    const a=this.agents.find(x=>x.id===id);
    if(a) return a;
    return Array.isArray(this.gone) ? this.gone.find(x=>x.id===id) : null;
  }
  /* 오프사이드로 취소된 골.
     공은 이미 그물에 들어갔고 선수들은 환호하고 있다 — 그 뒤에 깃발이 올라간다.
     점수·득점 기록은 애초에 올리지 않는다(되돌리는 것보다 안전하다). */
  disallowGoal(side, sh){
    const b=this.ball, off=this.pendingOff;
    this.pendingOff=null;
    const st=this.stats[side];
    st.goalDisallowed=(st.goalDisallowed||0)+1;
    st.offside++;
    const sc=this.byId(sh.shooterId), nm=this.nm(sc);
    b.inNet=true; b.vx*=0.55; b.vy*=0.55; b.vz*=0.35;
    { const dirIn=b.x>0.5?1:-1; if(Math.abs(b.vx)<0.085) b.vx=dirIn*0.085; } b.ownerId=null;
    { const dirIn=b.x>0.5?1:-1; if(Math.abs(b.vx)<0.085) b.vx=dirIn*0.085; }
    // 짧은 환호 뒤 취소 — 세리머니 객체에 표시를 달아 재개 방식을 바꾼다
    b.celebrate={t:0, side, oKey:this.opp(side), scorerId:sh.shooterId, clk:this.clock,
                 disallowed:true, offSpot:{x:off.x, y:off.y, by:off.by}};
    this.lastEvent={kind:"GOAL_OFF", side, t:this.t};
    this.markHighlight("goal", side, HL_W.goal);
    if(this.emitEvents){
      this.syncClock();
      this.say(side, F_(COMM.goalOffText,{p:nm}), "big", {kind:"sim_goaloff", side});
      // 자막 — 환호했다가 깃발이 올라가는 순서 그대로
      this.cap(side, COMM.lvGoalLive, {p:nm});
      const t0=this.t;
      const push=(dt, arr, vars)=>{ this.caps.push({t:t0+dt, side, txt:F_(arr, vars||{})});
        if(this.caps.length>HL_CAP_MAX) this.caps.shift(); };
      push(1.4, COMM.lvOffFlag, {});
      push(3.0, COMM.lvOffCancel, {p:nm});
      push(5.0, COMM.lvOffAfter, {});
    }
  }
  /* 골 해설 — 어떤 골이었는지에 따라 첫 마디가 달라지고, 세리머니 동안 리액션이 이어진다.
     "그냥 골입니다"만 반복되면 어떤 골이었는지 화면을 봐도 기억에 남지 않는다. */
  goalCommentary(side, sh){
    if(!this.recording) return;
    const sc=this.byId(sh.shooterId), nm=this.nm(sc);
    // 첫 마디 — 슛의 종류·거리·상황으로 고른다
    let pool;
    if(sh.isPen)                      pool=COMM.gPen;
    else if(sh.isFK)                  pool=COMM.gFK;
    else if(sh.type===SHOT_TYPE.HEADER) pool=COMM.gHeader;
    else if(sh.type===SHOT_TYPE.VOLLEY || sh.type===SHOT_TYPE.HALF_VOLLEY) pool=COMM.gVolley;
    else if(sh.type===SHOT_TYPE.CHIP)   pool=COMM.gChip;
    else if(sh.distM>=23)             pool=COMM.gLong;
    else if(sh.solo)                  pool=COMM.gSolo;
    else if(sh.distM<7)               pool=COMM.gTap;
    else if(sh.type===SHOT_TYPE.FINESSE) pool=COMM.gFinesse;
    else if(sh.type===SHOT_TYPE.POWER)   pool=COMM.gPower;
    else                              pool=COMM.lvGoalLive;
    this.cap(side, pool, {p:nm});
    // 세리머니 리액션 — 시간차를 두고 이어 붙인다. 재생헤드가 지나갈 때마다 한 줄씩 뜬다.
    const t0=this.t;
    const push=(dt, arr, vars)=>{
      this.caps.push({t:t0+dt, side, txt:F_(arr, vars||{})});
      if(this.caps.length>HL_CAP_MAX) this.caps.shift();
    };
    push(1.6, COMM.celA, {p:nm});
    // 막기 어려운 골이었으면 골키퍼를 언급한다
    if(sh.type===SHOT_TYPE.FINESSE || sh.type===SHOT_TYPE.POWER || sh.distM>=23 || sh.type===SHOT_TYPE.CHIP)
      push(3.4, COMM.celKeeper, {});
    else push(3.4, COMM.celA, {p:nm});
    const M=this.M;
    if(M) push(5.2, COMM.celScore, {t:this.rec(side).team.short, h:M.hg, a:M.ag});
    /* ⚠ 예전에는 스코어와 무관하게 "승부를 원점으로 돌립니다!"가 섞여 나왔다.
       3-1로 달아나는 골에도 그 대사가 나오니 중계가 엉뚱해졌다. 지금 스코어를 보고 고른다. */
    if(M){
      const my = side==="h" ? M.hg : M.ag, op = side==="h" ? M.ag : M.hg;
      const d=my-op;
      const pool = d===0 ? COMM.celEqual
                 : d===1 && op>0 ? COMM.celLead      // 역전골(직전까지 뒤졌거나 동점)
                 : d>=3 ? COMM.celRout
                 : d>0 ? COMM.celExtra
                 : COMM.celChase;                     // 지고 있는데 따라붙는 골
      push(7.0, pool, {t:this.rec(side).team.short, h:M.hg, a:M.ag});
    }
  }
  recordFrame(){
    if(!this.recording) return;
    const a=new Array(this.agents.length);
    for(let i=0;i<this.agents.length;i++){
      const g=this.agents[i];
      a[i]={id:g.id, x:g.x, y:g.y, face:g.face};
      const _jz=jumpZOf(g, this.t); if(_jz>0.02) a[i].j=+_jz.toFixed(3);   // 🦘 점프 높이 (재생용)
    }
    const b=this.ball, rf=this.ref;
    // 세리머니 상태를 프레임에 새긴다 — 하이라이트를 되감아 볼 때 "공이 언제 들어갔는지"를
    // 그 프레임만 보고 알 수 있어야 득점자 패널이 미리 뜨지 않는다.
    const cel=b.celebrate;
    const cg = cel ? {s:cel.side, id:cel.scorerId, t:+cel.t.toFixed(2), clk:cel.clk,
                      dis:!!cel.disallowed, own:!!cel.own, vc:!!cel.varCheck} : null;
    // ⚠ 심판도 함께 기록해야 한다. 예전에는 빠져 있어서, 하이라이트가 재생되는 동안
    //    화면의 심판만 실시간 위치(=멈춰 있는 값)에 그대로 남아 "심판이 안 움직인다"로 보였다.
    /* 🟥 카드 연출 — 주심이 카드를 들어 올린 순간을 프레임에 새긴다.
       하이라이트를 되감아 볼 때 「누가 무슨 카드를 받았는지」가 화면에 그려져야 한다(제보). */
    let cd=null;
    const cfx=this._cardFx;
    if(cfx && this.t-cfx.t < CARD_FX_SEC){
      cd={id:cfx.id, k:cfx.k, s:cfx.side, nm:cfx.nm, ps:cfx.ps, tm:cfx.tm,
          t:+(this.t-cfx.t).toFixed(2), min:cfx.min};
    }
    this.buf.push({t:this.t, clock:this.clock, bx:b.x, by:b.y, bz:b.z, st:this.matchState, a,
                   bs:b.state,                                        // 🎯 이 순간 공이 슛인가 — 재생 때 슛 궤적을 그린다

                   oi:b.ownerId||0,                                   // 이 순간의 볼 소유자 — 재생 때 흰 링이 이걸 따른다
                   rx:rf?rf.x:0.5, ry:rf?rf.y:0.4, cg, cd});
    if(this.buf.length>HL_BUF_MAX) this.buf.shift();
  }
  /* 결정적 장면 표시 — 이 순간을 중심으로 앞뒤를 잘라 하이라이트로 만든다 */
  markHighlight(kind, side, weight){
    if(!this.recording) return;
    /* 🎬 감독이 고른 빈도보다 낮은 등급은 아예 잡지 않는다 (요청) */
    try{ if((weight||1) < hlMinW()) return; }catch(e){}
    // 이미 같은 장면을 잡아 뒀다면 더 중요한 쪽으로 갱신한다 (슛 → 골로 승격)
    if(this.hl && (weight||1) <= this.hl.weight) return;
    this.hl={kind, side, weight:weight||1, t:this.t, at:this.buf.length-1};
  }
  /* 진행 중인 통계를 M.st 에 반영 — 경기 화면의 슈팅·점유율 표가 이걸 읽는다 */
  syncStats(){
    const st=this.M.st, H=this.stats.h, A=this.stats.a;
    st.hS=H.shot; st.aS=A.shot;
    // 유효슈팅 — resolveShot 이 골·선방을 가르기 전에 이미 shotOn 을 올리므로 골이 포함돼 있다.
    // 여기서 골을 다시 더하면 이중 계산이 된다.
    st.hT=H.shotOn; st.aT=A.shotOn;
    st.hF=H.foul; st.aF=A.foul;
    st.hC=H.corner; st.aC=A.corner;
    st.hY=H.yellow; st.aY=A.yellow;
    st.hR=H.red;   st.aR=A.red;
    // 점유율 — 연속 엔진은 매 틱 "누가 공을 갖고 있나"를 세고 있다.
    // 이걸 넘겨주지 않으면 화면은 M.rates(분 단위 엔진용 추정치)로 되돌아가 늘 50:50이 된다.
    st.hP=H.poss; st.aP=A.poss;
  }
  /* 득점 기록 — 점수판, 득점자, 도움, 해설 한 줄까지 한 번에 처리한다.
     도움은 "같은 팀의 마지막 패스"다. 다만 시간이 너무 지났거나(혼전 뒤 개인 돌파),
     본인이 스스로 몰고 들어간 경우에는 도움을 주지 않는다 — 실제 기록 규칙과 같다. */
  /* 실점 직후 흥분한 다혈질 선수의 항의 카드 — 분 단위 엔진(maybeDissentCard)의 2D 판.
     경고가 이미 있는 다혈질은 특히 위험하다. 퇴장까지 가면 팀이 열 명으로 남은 경기를 뛴다. */
  maybeDissentSim(concededSide){
    if(!this.emitEvents) return;
    const cands=this.side(concededSide).filter(a=>a.slot!=="GK" && a.p && a.p.pers===3);
    if(!cands.length) return;
    const f=cands[Math.floor(Math.random()*cands.length)];
    const already=(f.yellows||0)>=1;
    const chance=(already?0.09:0.045)*this.refCardK(concededSide);
    if(Math.random()>=chance) return;
    const st=this.stats[f.side], nm=f.p?f.p.name:"선수";
    const rv=refVars(this.M);
    if(already || Math.random()<0.25){
      /* 퇴장 — 누적이거나 도를 넘었다 */
      const second=already;
      if(f.p) banApply(this.M, f.p, second);
      st.red++;
      this.markHighlight("red", f.side, HL_W.red);
      let _tm3=""; try{ _tm3=this.rec(f.side).team.short||""; }catch(e){}
      this._cardFx={id:f.id, k:"R", side:f.side, nm:nm, ps:(f.slot||""), tm:_tm3,
                    t:this.t, min:Math.floor(this.clock/60)};
      this.sentOff.push({id:f.id, side:f.side, t:this.t, min:Math.floor(this.clock/60),
                         lbl:(()=>{ try{ return this.clockLabel(); }catch(e){ return null; } })(),
                         name:nm, pos:(f.p&&f.p.pos)||"", slot:f.slot||"", team:_tm3, second:!!second});
      this.retireAgents(a=>a.id===f.id, "red");
      const fx=this.entryOf(f);
      if(fx){ fx.red=true; fx.off=Math.floor(this.clock/60); }
      const sd = f.side==="h" ? this.M.h : this.M.a;
      if(sd){ sd.red=(sd.red||0)+1; }
      this.syncClock();
      this.say(f.side, F_(second?COMM.dissentSecond:COMM.dissentRed, Object.assign({p:nm}, rv)), "big", {kind:"card_red", side:f.side, playerId:f.id});
      /* 퇴장으로 7명 미만 — 몰수 판정은 기존 레드카드 경로와 같은 검사를 태운다 */
      if(this.side(f.side).length<7){
        const isH=f.side==="h";
        const oppLead = isH ? (this.M.ag-this.M.hg) : (this.M.hg-this.M.ag);
        if(oppLead<3){ if(isH){ this.M.hg=0; this.M.ag=3; } else { this.M.hg=3; this.M.ag=0; } }
        this.M.forfeit={side:f.side, team:sd?sd.team.short:""};
        this.syncStats(); this.M.half=2; this.M.done=true;
        this.say(null, `🚫 몰수패! 인원 미달 — 경기 중단. 최종 ${this.M.home.short} ${this.M.hg} : ${this.M.ag} ${this.M.away.short}`, "big", {kind:"ft"});
      }
    } else {
      f.yellows=(f.yellows||0)+1;
      st.yellow++;
      const fx=this.entryOf(f); if(fx) fx.y=(fx.y||0)+1;
      this.syncClock();
      this.say(f.side, F_(COMM.dissentYellow, Object.assign({p:nm}, rv)), "warn", {kind:"card_yellow", side:f.side, playerId:f.id});
    }
    this.syncStats();
  }
  recordGoal(side, sh){
    // ⚠ 관전용 시뮬(emitEvents=false)은 실제 선수 기록을 건드리면 안 된다.
    //    관전 화면도 진짜 팀 객체로 경기를 만들기 때문에, 이 가드가 없으면 구경만 해도 득점왕이 바뀐다.
    if(!this.M || !this.emitEvents) return;
    this.syncClock();
    if(side==="h") this.M.hg++; else this.M.ag++;
    const scorer=this.byId(sh.shooterId);
    const sx=this.entryOf(scorer);
    /* 🥅 자책골 — 득점은 상대 팀에 오르지만 개인 득점 기록에는 넣지 않는다(분 단위 엔진과 같은 규칙).
       넣은 선수에게는 자책골만 남긴다. */
    if(sh.og){ if(scorer && scorer.p) scorer.p.ownGoals=(scorer.p.ownGoals||0)+1; }
    else if(sx){ sx.goals++; if(sx.p) sx.p.goals=(sx.p.goals||0)+1; }
    /* 득점자 명단 — 결과창·리포트·해트트릭 기사에 쓴다 */
    if(!Array.isArray(this.M.sc)) this.M.sc=[];
    /* 🕐 제보 — 전광판(clockLabel)과 같은 글자로 남긴다. 예전엔 내부 카운터를 그대로 찍어
       추가시간 골이 명단에서만 46' · 93' 로 보였다. */
    const _scMin=(()=>{ try{ const v=String(this.clockLabel()); return (v==="0"||v==="")?"1":v; }
                        catch(e){ return this.M.min||Math.ceil(this.clock/60)||0; } })();
    this.M.sc.push({n:scorer&&scorer.p?scorer.p.name:"?", side, min:_scMin, og:sh.og?1:0});
    if(sh.og) this.lastAssist=null;          // 자책골에는 도움이 없다
    // 도움 — 마지막 패스가 같은 팀이고 8초 이내여야 인정
    let ax=null;
    const la=this.lastAssist;
    /* K리그 개정 규정 — 시간·터치 제한 없음. 마지막 패스가 유효(굴절 없음·소유 연속)하기만 하면
       득점자가 수비 몇 명을 제치고 얼마나 몰고 갔든 도움으로 인정한다.
       유효성은 lastAssist 의 생존 여부가 담보한다: 상대 터치·골대·리바운드가 끼면 이미 지워져 있다. */
    if(la && la.side===side && la.id!==sh.shooterId){
      const ap=this.byId(la.id);
      ax=this.entryOf(ap);
      if(ax){ ax.assists++; if(ax.p) ax.p.assists=(ax.p.assists||0)+1; }
    }
    /* ⚽/🅰️ 이름표 — 시작 시점은 공이 그물에 닿는 순간(celebrate 생성부)이 정한다. 여기서는 도움만 채운다 */
    if(this.goalTag && this.goalTag.sid===sh.shooterId) this.goalTag.aid=(ax&&la)?la.id:null;
    else this.goalTag={sid:sh.shooterId, aid:(ax&&la)?la.id:null, until:this.t+6};
    this.lastAssist=null;
    this.syncStats();
    if(this.emitEvents){
      const nm=scorer&&scorer.p?scorer.p.name:"선수";
      const txt = ax ? F_(COMM.goalA,{p:nm, a:ax.p.name}) : F_(COMM.goal,{p:nm});
      /* 💥 ⚠ 요청 — 「강력한 중거리 슛이 터졌을 때 화면을 미세하게 흔든다」.
         세기는 거리와 슛 종류가 정한다: 가까운 골은 잔잔하게, 먼 거리의 강슛은 크게.
         화면(=하이라이트)이 그 장면에 도달할 때 흔들리도록 이벤트에 실어 보낸다. */
      const _shk = clamp(0.34 + Math.max(0, (sh.distM||0)-14)/26
                    + ((sh.type===SHOT_TYPE.POWER)?0.30:0)
                    + ((sh.type===SHOT_TYPE.VOLLEY)?0.18:0), 0.30, 1.35);
      this.say(side, txt, "goal", {kind:"sim_goal", side, scorerId:sh.shooterId, shake:_shk});
      try{ this.maybeDissentSim(this.opp(side)); }catch(e){}
    }
  }
  /* 경기 중 전술 변경을 시뮬에 반영한다.
     에이전트는 만들어질 때 슬롯·역할·앵커·능력치를 한 번 계산해 들고 있다. 그래서 감독이
     포메이션이나 역할을 바꿔도, 교체 카드를 써도, 그대로 두면 그라운드에서는 아무 일도 일어나지 않는다.
     ─ 위치는 건드리지 않는다. 지시가 바뀌면 선수가 순간이동하는 게 아니라 새 자리로 움직여 가는 것이 맞다. */
  resyncSquads(){
    this._sideBust();
    const alive=new Set();
    for(const [key, sd] of [["h",this.M.h],["a",this.M.a]]){
      const xi=onPitch(sd).map(x=>x.p);
      const slotOf=computeRenderSlots(sd.team, xi);
      /* ⚠ 원인 — t.tactic.slot 은 감독이 직접 끌어다 놓을 때만 채워진다. 시뮬 에이전트의
         실제 슬롯(computeRenderSlots)은 어디에도 남지 않는다.
         경기 뒤 능숙도 적립(gainPosFam·gainRoleFam)이 「실제로 뛴 자리」를 알아야 하므로
         경기 시점 점유를 팀에 실어 준다. */
      /* 🎓 교체로 빠진 선수도 정산 때 「그 경기에서 뛴 자리」가 남아야 한다 — 덮지 않고 병합 */
      sd.team._slotOcc=Object.assign({}, sd.team._slotOcc||{}, slotOf);
      for(const x of onPitch(sd)){
        const slot = x.p.pos==="GK" ? "GK" : (slotOf[x.p.id]||"CM");
        /* ⚠ 여기서 isHome 을 홈/원정 키로만 다시 계산해서, 후반에 교체를 하면
           switchEnds() 로 뒤집어 둔 공격 방향이 통째로 전반 상태로 돌아갔다.
           (제보: "교체하면 후반 공격 진영이 전반이랑 같아진다")
           지금 진영 교대 상태(this.ends)를 반영해서 계산한다. */
        const isHome = (key==="h") !== !!this.ends;
        const anchor=tacticalAnchorXY(sd.team, slot, "DEF", isHome);
        alive.add(x.p.id);
        let a=this.agents.find(q=>q.id===x.p.id);
        if(!a){
          // 교체 투입 — 자기 포지션 자리에서 들어온다
          a={id:x.p.id, p:x.p, team:sd.team, side:key, slot, isHome, dir:isHome?1:-1,
             x:anchor.x, y:anchor.y, seed:(x.p.id*37)%100, spd:0, face:isHome?0:Math.PI};
          this.agents.push(a); this._sideBust();
        }
        a.p=x.p; a.team=sd.team; a.side=key; a.slot=slot; a.isHome=isHome; a.dir=isHome?1:-1;
        a.role=roleFx(sd.team, x.p, slot);
        a.home={x:anchor.x, y:anchor.y};
        // 능력치도 다시 계산한다 — 자리가 바뀌면 포지션 능숙도 보정이 달라진다
        Object.assign(a, applyTeamFam(applyRoleFam(applyFamiliarity(matchSkills(x.p), getPosFam(x.p, slot), x.p, slot), x.p, slot, sd.team), famK(sd.team)));
        // 세트피스 배치·추격 상태는 지시가 바뀌었으니 풀어 준다
        a._spSpot=null; a._inWall=false; a._spHold=0; a._spot=null; a._smx=undefined; a._smy=undefined;
      }
    }
    // 교체 아웃·퇴장으로 그라운드를 떠난 선수는 뺀다 (하이라이트용 사본은 남긴다)
    this.retireAgents(a=>!alive.has(a.id), "sub");
    const b=this.ball;
    if(b.ownerId!=null && !alive.has(b.ownerId)) b.ownerId=null;   // 공 가진 선수가 나갔다면 놓고 간다
    if(b.toId!=null && !alive.has(b.toId)) b.toId=null;
  }
  /* ── 상대 감독의 경기 중 전술 변화 ─────────────────────────────
     AI 팀은 시즌 시작에 전술을 한 번 정하고 그대로 90분을 보냈다. 지고 있어도 그대로,
     이기고 있어도 그대로. 실제 감독은 시계와 점수를 보고 움직인다.
     ─ 여기서 바꾸는 건 성향·라인·압박 같은 "지시"뿐이다. 이 값들은 매 틱 팀 객체에서 다시 읽으므로
       따로 재동기화할 필요 없이 즉시 그라운드에 반영된다. */
  aiTacticCheck(){
    if(!this.emitEvents) return;                 // 실제 경기에서만
    const min=Math.floor(this.clock/60);
    if(min===this._aiMin) return; this._aiMin=min;
    /* 감독마다 성미가 다르다 — 움직이는 시간대·인내심을 경기마다 새로 뽑는다 (고정 시간대 금지) */
    if(!this._aiProf) this._aiProf={};
    for(const key of ["h","a"]){
      const sd=this.rec(key), t=sd.team;
      if(!t || t.isUser) continue;               // 유저 팀은 감독이 직접 지시한다
      if(t.pvpRemote) continue;                  // ⚔️ 상대 유저가 원격으로 직접 지시한다
      const c=(typeof coachOf==="function")?coachOf(t):null;   // 이 팀 감독 — 프로필·극단 전술 판단에 쓴다
      const tq=c?(c.tac-15)/5:0;
      let pf=this._aiProf[key];
      if(!pf){
        /* 감독 능력이 벤치의 반응 속도를 정한다 — 유연성 높은 감독(윤정환 18, 이정효 19)은
           일찍, 자주 움직이고, 경기판단 좋은 감독은 상대 전술을 잘 읽는다 */
        const fx=c?(c.flex-15)/5:0, jd=c?(c.judg-15)/5:0;
        pf=this._aiProf[key]={
          tLose1: 46+Math.floor(Math.random()*18) - Math.round(fx*8),   // 뒤질 때 공격 전환 시점
          tLose2: 68+Math.floor(Math.random()*14) - Math.round(fx*5),   // 총공세
          tLead1: 60+Math.floor(Math.random()*15) - Math.round(fx*5),   // 리드 실리 전환
          tLead2: 73+Math.floor(Math.random()*11) - Math.round(fx*4),   // 걸어잠금
          cd:      Math.max(5, 8+Math.floor(Math.random()*8) - Math.round(fx*4)),  // 재조정 간격
          adapt:   clamp(0.30 + jd*0.42 + Math.random()*0.30, 0.12, 0.95)          // 읽는 감각
        };
        /* 도발당한 감독은 이 경기만큼은 눈에 불을 켠다 — 더 일찍, 더 날카롭게 */
        if(G.mgrTaunt && G.mgrTaunt.opp===t.id){
          pf.adapt=Math.min(0.95, pf.adapt+0.18);
          pf.tLose1=Math.max(35, pf.tLose1-6); pf.cd=Math.max(5, pf.cd-2);
        }
      }
      const gd=(key==="h" ? this.M.hg-this.M.ag : this.M.ag-this.M.hg);
      /* 실점 직후에는 성급한 감독이 쿨다운을 무시하고 바로 움직이기도 한다 */
      const sig=this.M.hg+":"+this.M.ag;
      let urgent=false;
      if(this._aiScore!==undefined && this._aiScore[key]!==sig && gd<0 && Math.random()<pf.adapt) urgent=true;
      (this._aiScore=this._aiScore||{})[key]=sig;
      if(!urgent && min<Math.min(pf.tLose1, pf.tLead1)) continue;
      if(!urgent && this._aiAt && min-(this._aiAt[key]||-99) < pf.cd) continue;
      const T=t.tactic; let want=null, msg=null, newForm=null;
      /* 포메이션도 상황에 맞춰 갈아탄다 — 데이터 기반이라 어떤 폼이든 엔진이 즉시 소화한다 */
      const FORM_ATK={"4-2-3-1":"4-2-2-2","4-1-4-1":"4-3-3","4-4-1-1":"4-4-2","4-3-1-2":"4-3-3",
                      "5-3-2":"3-5-2","5-2-1-2":"3-5-2","3-4-2-1":"3-4-3","4-4-2":"4-2-2-2","4-3-3":"3-4-3"};
      const FORM_DEF={"4-3-3":"4-1-4-1","3-4-3":"5-3-2","3-5-2":"5-3-2","4-2-2-2":"4-2-3-1",
                      "4-4-2":"4-4-1-1","4-2-3-1":"4-1-4-1","4-3-1-2":"5-2-1-2","3-4-2-1":"5-3-2"};
      /* 상대 벤치가 지금 꺼내 든 전술 — 유저가 경기 중에 바꾼 것까지 그대로 읽는다 */
      let oT=null; try{ oT=TAC(this.rec(this.opp(key)).team); }catch(e){}
      if(gd<=-1 && min>=pf.tLose2){              // 지고 있고 시간이 없다 — 총공세
        want={mentality:4, line:4, press:4, tempo:4, counter:0};
        newForm=FORM_ATK[T.formation]||null;
        msg=`총공세로 나서겠다는 뜻이겠죠. 라인을 완전히 끌어올립니다!`;
        /* 🔥 마지막 승부수 — 80분 넘어 두 골 이상 뒤지면 수비를 둘만 남기고 전부 앞으로.
           공격 성향 감독일수록, 전술 능력이 좋을수록 과감하게 꺼낸다. */
        if(min>=80 && gd<=-2 && Math.random() < 0.10 + Math.max(0,(c?c.att-c.def:0))*0.05 + Math.max(0,tq)*0.06){
          newForm="2-3-5";
          msg=`아, 2-3-5입니다! 센터백 둘만 남기고 전부 앞으로 올립니다 — 완전히 던졌습니다!`;
        }
      } else if(gd<=-1 && (min>=pf.tLose1 || urgent)){   // 지고 있다 — 공격적으로
        want={mentality:3, line:Math.min(4,(T.line||2)+1), press:Math.min(4,(T.press||2)+1)};
        if(Math.random()<0.45) newForm=FORM_ATK[T.formation]||null;
        msg=urgent ? `실점하자마자 벤치가 바로 반응합니다. 무게를 앞으로 싣는군요.`
                   : `좀 더 공격적으로 나서는 것 같군요. 압박의 강도도 올라갑니다.`;
      } else if(gd>=2 && min>=pf.tLead2){        // 넉넉히 이기고 있다 — 잠근다
        want={mentality:0, line:0, press:1, counter:4};
        newForm=FORM_DEF[T.formation]||null;
        msg=`완전히 내려서는 것 같군요. 승부를 굳히려는 모습입니다.`;
      } else if(gd===1 && min>=84){              // 🔒 한 골 차 종반 — 버스를 세운다
        want={mentality:0, line:0, press:0, counter:3, tempo:0};
        if(Math.random() < 0.14 + Math.max(0,(c?c.def-c.att:0))*0.06){
          newForm="7-2-1";
          msg=`7-2-1! 아예 버스를 세웁니다 — 한 골을 지키겠다는 뜻입니다.`;
        } else { newForm=FORM_DEF[T.formation]||null; msg=`남은 시간, 완전히 내려앉습니다.`; }
      } else if(gd>=1 && min>=pf.tLead1){        // 한 골 차 리드 — 실리로
        want={mentality:1, line:Math.max(0,(T.line||2)-1), counter:3};
        if(Math.random()<0.40) newForm=FORM_DEF[T.formation]||null;
        msg=`좀 더 내려서는 것 같군요. 역습을 노리겠다는 계산입니다.`;
      }
      /* ── 맞춤 대응 — 점수와 무관하게, 상대 전술을 읽고 받아친다 ──
         감각(adapt)이 좋은 감독일수록 잘 알아챈다. 한 번에 하나만 — 해설도 사람도 그래야 따라간다. */
      if(!want && oT && min>=30 && Math.random()<pf.adapt*0.55){
        const cands=[];
        /* ⚠ 전술창 배선 감사 — oT 는 TAC 변환값(0~2)인데 원시 눈금(≥3)과 비교해
           멘탈리티·라인·폭·압박 읽기 4종이 한 번도 발동하지 못했고, width<=1 은 보통 폭에도
           참이라 「상대가 좁게 서 있죠」가 오발동했다. HI/LO(1.5/0.5)로 잰다. counter 는 0~4 그대로. */
        if(HI(oT.mentality) && gd>=0)
          cands.push({w:{counter:3, line:Math.max(0,(T.line|0)-1)},
                      m:`상대가 무게를 앞으로 싣자, 한 발 물러나 역습을 노리는 모양새군요.`});
        if(HI(oT.line))
          cands.push({w:{counter:Math.min(4,(T.counter|0)+1), longShot:Math.min(4,(T.longShot|0)+1), pass:Math.min(4,(T.pass|0)+1)},
                      m:`상대 라인이 높습니다. 뒷공간을 노리는 다이렉트한 공격으로 맞서는군요.`});
        if(HI(oT.width))
          cands.push({w:{width:Math.max(0,(T.width|0)-1), press:Math.min(4,(T.press|0)+1)},
                      m:`상대가 넓게 벌리자 간격을 좁혀 중앙을 두껍게 가져갑니다.`});
        else if(LO(oT.width))
          cands.push({w:{width:Math.min(4,(T.width|0)+1), crossFq:Math.min(4,(T.crossFq|0)+1)},
                      m:`상대가 좁게 서 있죠. 측면을 넓게 쓰라는 주문이 나온 것 같습니다.`});
        if(HI(oT.press))
          cands.push({w:{tempo:Math.min(4,(T.tempo|0)+1), pass:Math.min(4,(T.pass|0)+1)},
                      m:`상대의 강한 압박을 빠른 템포와 다이렉트 패스로 벗겨내려 합니다.`});
        if(oT.counter>=3 && gd>0)
          cands.push({w:{line:Math.min(2,(T.line|0))},
                      m:`상대의 역습이 날카롭다는 걸 압니다. 라인을 무리하게 올리지 않는군요.`});
        if(cands.length){
          const c=cands[Math.floor(Math.random()*cands.length)];
          want=c.w; msg=c.m;
        }
      }
      if(!want) continue;
      // 이미 그 상태면 굳이 바꾸지 않는다 (같은 해설이 반복되는 것도 막는다)
      let changed=false;
      for(const k in want) if(T[k]!==want[k]){ T[k]=want[k]; changed=true; }
      if(newForm && newForm!==T.formation){ T.formation=newForm; changed=true; this.resyncSquads(); }
      else newForm=null;
      if(!changed) continue;
      if(!this._aiAt) this._aiAt={};
      this._aiAt[key]=min;
      noteTacticChange(sd.team, 0.35);
      const _cnm=(typeof COACHES!=="undefined"&&COACHES[t.id])?COACHES[t.id].n+" 감독":t.short;
      this.say(key, `🎽 ${_cnm}이 움직입니다.${newForm?` 포메이션 ${newForm} 전환.`:""}`, "info");
      /* ⚠ 제보 — 「상대 감독이 전술을 바꿀 때마다 해설이 경기를 세우고 읽어 줘서 중간중간 끊긴다」.
         예전엔 queueTacAnnounce 로 경기 시계를 2초씩 멈추고 캡션에 큼직하게 띄웠다.
         상대 벤치의 움직임은 「중계가 멈출 일」이 아니라 「수석코치가 귀띔할 일」이다.
         경기는 그대로 흐르고, 우측 수석코치 조언 패널에서 확인한다 — 모든 대회 공통. */
      try{ noteOppTactic(this.M, {side:key, coach:_cnm, team:t.short, min, form:newForm, msg}); }catch(e){}
    }
  }
  /* ── 부상 ──────────────────────────────────────────────────────
     연속 엔진에는 부상이 아예 없었다(옛 분 단위 엔진에만 있었다). 90분 내내 아무도 다치지 않으면
     교체 카드도, 스쿼드 뎁스도 의미가 없어진다.
     ─ 거친 태클을 당했을 때와, 지쳐 있을 때 자연 발생하는 두 경로로 나눈다. */
  hurt(a, hard, cause){
    if(!this.emitEvents || !a) return;          // 관전용 시뮬은 실제 선수 기록을 건드리지 않는다
    if(a.slot==="GK") return;                   // 키퍼 부상은 교체 로직이 복잡해 다루지 않는다
    const x=this.entryOf(a);
    if(!x || x.off!=null) return;
    if(this._hurtIds && this._hurtIds.has(a.id)) return;   // 한 선수가 두 번 다치지 않게
    (this._hurtIds=this._hurtIds||new Set()).add(a.id);
    // 곧바로 사라지게 하면 이상하다. 쓰러져 있다가 들것에 실려 나가는 몇 초를 둔다.
    // 그 사이에 반칙 장면·세트피스가 끝나므로 다른 로직과 충돌하지도 않는다.
    const nm=a.p?a.p.name:"선수";
    // 기존 "넘어져 있음" 타이머를 그대로 쓴다 — 실려 나갈 때까지 그 자리에 누워 있는다.
    a._injured=true; a._down=this.t+INJ_DOWN_SECS+0.5;
    this.say(a.side, `🚑 ${nm} 선수가 쓰러졌습니다. 트레이너가 들어옵니다.`, "warn");
    this.cap(a.side, COMM.lvInjury, {p:nm});
    this._pendingHurt=this._pendingHurt||[];
    /* 🚑 원인을 함께 싣는다 — processHurt 가 그대로 mkInjury 로 넘긴다 (요청) */
    this._pendingHurt.push({id:a.id, hard:!!hard, cause:cause||(hard?"slide":"tackle"), at:this.t+INJ_DOWN_SECS});
  }
  /* 쓰러진 선수를 실제로 내보낸다 — 경기가 흘러가는 상태일 때만. */
  processHurt(){
    const q=this._pendingHurt;
    if(!q || !q.length) return;
    const b=this.ball;
    if(b.celebrate || b.foulScene || b.setPiece) return;   // 멈춰 있는 장면 중에는 손대지 않는다
    for(let i=q.length-1;i>=0;i--){
      if(this.t < q[i].at) continue;
      const it=q.splice(i,1)[0];
      const a=this.byId(it.id); if(!a) continue;
      const x=this.entryOf(a); if(!x) continue;
      this.syncClock();
      /* ⚠ 제보 — 「부상으로 한 명 빠지면 중앙에 있던 선수 카드가 왼쪽으로 간다」.
         computeRenderSlots 는 저장된 자리가 없는 선수를 「남은 인원 수에 맞는 기본 배치」로
         다시 앉힌다. 미드 3명이 2명이 되면 [중앙,우] → [좌,우] 패턴으로 바뀌어,
         중앙에 서 있던 선수가 왼쪽 칸으로 밀린다.
         ─ 그라운드에서 빼기 전(아직 11명일 때) 지금 자리를 전부 굳혀 둔다. */
      try{ freezeLiveSlots(x._sd || (a.side==="h"?this.M.h:this.M.a)); }catch(e){}
      x.off=this.M.min;
      x.injGap=true;                   // 부상으로 비운 자리 — 채우기 전까지 교체 후보로 남긴다
      x.gapT=this.t;                   // 🚑 발생 시각 — 퇴장과 같은 재생헤드 필터를 태우기 위해 (제보)
      /* 🚑 배선 — 유형·원인은 hurt() 가 정해서 실어 보낸다 (요청) */
      let wks=1+R(4)+(it.hard?R(3):0);
      if(a.p){
        try{
          const _fit=(x&&x.fit!=null)?x.fit:90;
          const _r=mkInjury(a.p, {cause: it.cause||(it.hard?"slide":"overuse"), hard:!!it.hard,
                                  fit:_fit, age:G.season-(a.p.by||2000)});
          wks=_r.weeks;
        }catch(e){ try{ setInjury(a.p, Math.max(injWeeksLeft(a.p), wks)); }catch(e2){ a.p.inj=Math.max(a.p.inj||0, wks); } }
      }
      if(b.ownerId===a.id){                                // 공을 들고 쓰러졌다면 공은 흘러나간다
        b.ownerId=null;
        this.launchLoose(b.x, b.y, Math.random()*Math.PI*2, 4+Math.random()*6, this.opp(a.side), false);
      }
      this.retireAgents(z=>z.id===a.id, "inj");
      const nm=a.p?a.p.name:"선수";
      /* 🚑 해설도 무엇을 어떻게 다쳤는지 말한다 (요청) */
      const _tell=(function(){ try{ const T=injTypeOf(a.p), C=INJ_CAUSE[a.p&&a.p.injC];
        return T?`${C?C.tell+" ":""}${T.ic} ${T.n}`:"부상"; }catch(e){ return "부상"; } })();
      this.say(a.side, `🚑 ${nm} 선수, ${_tell} — 더 이상 뛸 수 없습니다. (약 ${wks}주 결장 예상)`, "warn");
      this.stats[a.side].injury=(this.stats[a.side].injury||0)+1;
      // 내 팀이면 경기를 멈추고 전술판으로 — 교체할지 10명으로 버틸지 감독이 정한다
      if(this.rec(a.side).team.isUser){
        const left=this.agents.filter(z=>z.side===a.side).length;
        this.M.needsSubPause=true; this.M.pauseEntryId=a.p?a.p.id:null;
        this.M.pauseReason=`🚑 <b>${nm}</b> — ${_tell}로 나갔습니다 (${left}명 남음). 교체를 진행하세요.`;
      }
    }
  }
  /* 매 틱 아주 낮은 확률로 자연 부상 — 지쳐 있을수록, 나이가 많을수록 위험하다 */
  injuryCheck(){
    if(!this.emitEvents) return;
    if(this.ball.celebrate || this.ball.foulScene) return;
    if(Math.random() > INJ_TICK_P*meTune("inj")) return;
    const pool=this.agents.filter(a=>a.slot!=="GK" && !a._injured);
    if(!pool.length) return;
    /* ⚠ 예전에는 「경기 전 컨디션(p.cond)」만 봤다. 그 값은 90분 내내 변하지 않으므로
       「후반에 다리가 풀려 다친다」는 그림이 아예 나오지 않았다(실측 경기당 부상 0.00건).
       ─ 지금 남은 체력(fit)을 주 위험으로 삼고, 컨디션은 출발선을 정하는 데만 쓴다. */
    const a=pool[Math.floor(Math.random()*pool.length)];
    const x=this.entryOf(a);
    const fit=(x && x.fit!=null) ? x.fit : 90;
    const cond=(a.p&&a.p.cond!=null)?a.p.cond:90;
    const age=(a.p&&a.p.by)? (G.season-a.p.by) : 26;
    /* ⚠ 예전 식 (1.25-fit/100) 은 체력이 90이어도 0.35 가 나와, 전반 8분에도 선수가 쓰러졌다.
       ─ 체력 78 이상이면 사실상 0, 그 아래로 제곱 곡선으로 붙는다. 부상은 후반에 몰려야 한다. */
    let risk=Math.pow(clamp((78-fit)/78, 0, 1), 1.5) * (0.75+clamp((age-24)/16,0,1)*0.7);
    /* 체력 72 밑으로 내려가면 위험이 가파르게 오른다 — 여기서부터가 교체를 고민할 구간이다 */
    if(fit<72) risk *= 1+Math.pow((72-fit)/20, 1.7);
    risk *= clamp(1.30-(cond/100)*0.38, 0.86, 1.30);          // 출발 컨디션이 나쁘면 더 위험
    try{ risk *= 1+(TAC(a.team).tackle-1)*0.15; }catch(e){}   // 거칠게 시키면 본인도 다친다
    /* 🩺 감독이 고른 처치가 여기서 값을 치른다 (요청)
       💊 진통제 — 통증을 눌렀을 뿐 몸은 그대로다 · ⚡ 집중 재활 — 덜 여문 채로 나왔다
       🏥 수술 — 뿌리를 뽑았다 */
    try{ risk *= injTreatRiskMul(a.p); }catch(e){}
    risk=Math.min(risk, INJ_RISK_CAP);
    /* 한 팀에서 자연 부상으로 실려 나가는 인원에 상한을 둔다 — 한 경기에 선발 절반이
       들것에 실리는 일은 없다. 태클로 인한 부상(hurt hard)은 이 상한을 따르지 않는다. */
    try{
      const sd=this.rec(a.side);
      const done=(sd.list||[]).filter(x=>x.injGap).length;
      if(done>=INJ_MAX_TEAM) return;
    }catch(e){}
    /* 🚑 원인을 갈라 준다 (요청) — 다리가 풀렸으면 누적 피로, 공을 몰고 뛰던 중이면 스프린트,
       공중볼 다툼 중이면 충돌, 그 밖에는 혼자 넘어지는 비접촉 부상. */
    if(Math.random()<risk){
      let cause="overuse";
      try{
        const near=this.ball && HYP((this.ball.x-a.x)*PITCH_AR, this.ball.y-a.y)<0.10;
        const air=this.ball && (this.ball.z||0)>1.2;
        if(near && air) cause="clash";
        else if(near && (this.ball.ownerId===a.id)) cause="sprint";
        else if(fit>=68) cause=(Math.random()<0.45?"sprint":"solo");
        else cause=(Math.random()<0.68?"overuse":"solo");
      }catch(e){}
      this.hurt(a, false, cause);
    }
  }
  buildSquads(){
    this._sideBust();
    for(const [key, sd] of [["h",this.M.h],["a",this.M.a]]){
      /* 킥오프 시점의 자리를 먼저 굳힌다 — 경기 중 누가 빠져도 남은 선수가 옆으로 밀리지 않는다 */
      try{ freezeLiveSlots(sd); }catch(e){}
      const xi=onPitch(sd).map(x=>x.p);
      const slotOf=computeRenderSlots(sd.team, xi);
      /* ⚠ 원인 — t.tactic.slot 은 감독이 직접 끌어다 놓을 때만 채워진다. 시뮬 에이전트의
         실제 슬롯(computeRenderSlots)은 어디에도 남지 않는다.
         경기 뒤 능숙도 적립(gainPosFam·gainRoleFam)이 「실제로 뛴 자리」를 알아야 하므로
         경기 시점 점유를 팀에 실어 준다. */
      sd.team._slotOcc=slotOf;
      for(const x of onPitch(sd)){
        const slot = x.p.pos==="GK" ? "GK" : (slotOf[x.p.id]||"CM");
        const isHome = key==="h";
        const anchor=tacticalAnchorXY(sd.team, slot, "DEF", isHome);
        const _rfx=roleFx(sd.team, x.p, slot);
        this.agents.push({
          id:x.p.id, p:x.p, team:sd.team, side:key, slot, isHome, role:_rfx,
          dir: isHome?1:-1,
          x:anchor.x, y:anchor.y,
          home:{x:anchor.x, y:anchor.y},   // 역할 판단의 기준이 되는 타고난 자리
          seed:(x.p.id*37)%100,
          ...applyTeamFam(applyRoleFam(applyFamiliarity(matchSkills(x.p), getPosFam(x.p, slot), x.p, slot), x.p, slot, sd.team), famK(sd.team)),
          _sd:sd,
          spd: 0,                                                              // 현재 속도(가속으로 붙는다)
          face: isHome?0:Math.PI                                               // 바라보는 방향(rad, iso 기준)
        });
      }
    }
    /* 리더십 — 그라운드에 선 선수 중 가장 리더십이 높은 한 명이 팀을 다잡는다.
       FM에서도 주장은 팀 전체의 집중력·침착성에 영향을 준다. 여기서는 판단력·팀워크·대담성을
       조금 끌어올리는 식으로 반영한다(최대 +6%). 리더가 교체돼 나가면 그만큼 빠진다. */
    for(const key of ["h","a"]){
      const mine=this.agents.filter(a=>a.side===key);
      if(!mine.length) continue;
      /* 감독이 지정한 주장이 그라운드에 있으면 그 선수가 팀을 다잡는다.
         없으면 예전처럼 리더십이 가장 높은 선수가 대신한다. */
      const sdT=mine[0]&&mine[0].team;
      const capId=sdT&&sdT.cap&&sdT.cap.s===G.season ? sdT.cap.c : null;
      const top=(capId && mine.find(a=>a.id===capId)) ||
        mine.reduce((b,a)=>((a.leadership||0)>(b.leadership||0)?a:b), mine[0]);
      const boost=1 + clamp(((top.leadership||0.5)-0.55)*0.16, -0.02, 0.06);
      for(const a of mine){
        if(a.decSkill!=null)  a.decSkill =clamp(a.decSkill*boost, 0.05, 1);
        if(a.teamwork!=null)  a.teamwork =clamp(a.teamwork*boost, 0.05, 1);
        if(a.bravery!=null)   a.bravery  =clamp(a.bravery*boost, 0.05, 1);
        if(a.posSkill!=null)  a.posSkill =clamp(a.posSkill*(1+(boost-1)*0.6), 0.05, 1);
      }
      this._captain=this._captain||{}; this._captain[key]=top.p?top.p.name:"";   // stats 는 아직 만들어지기 전이다
    }
  }
    /* ── 골키퍼의 움직임 ────────────────────────────────────────────
     FM처럼 상황에 따라 역할이 바뀐다.
       DIVE   : 우리 골문으로 날아오는 슛 — 코스로 몸을 날린다
       SWEEP  : 수비 뒷공간으로 흐른 공 — 박스 밖까지 나가 먼저 걷어낸다
       CLAIM  : 박스로 떨어지는 크로스 — 나와서 잡거나 쳐낸다
       SUPPORT: 우리 팀이 상대 진영에서 공을 돌린다 — 박스 앞까지 올라와 빌드업에 선다
       ANGLE  : 기본 — 골대와 공을 잇는 선 위에서 각을 좁힌다
     "나갈지 말지"는 박스 장악력·돌진 빈도·기행이 정하고,
     "나가서 해내는지"는 공중 장악력·일대일 방어가 정한다 (FM 설명 그대로). */
  /* ══════════════════════════════════════════════════════════════
     🧤 스루패스 사전 예측 — 패스가 나가기 「전」에 위험을 읽는다 (§3~10).
     캐리어의 몸 방향이 열린 침투자마다 「공 도착 / 공격수 도착 / GK 도착」
     세 시간을 재고, GK 가 먼저 닿을 수 있는 위협만 점수를 준다.
     ══════════════════════════════════════════════════════════════ */
  gkThroughThreat(gk){
    const b=this.ball, key=gk.side;
    if(this.t-(gk._tbAt||-9)<0.4) return gk._tb||null;    // 0.4초 캐시
    gk._tbAt=this.t; gk._tb=null;
    if(this.possSide===key) return null;                   // 우리 소유면 위협 없음
    const carrier=(b.ownerId!=null)?this.byId(b.ownerId):null;
    if(!carrier || carrier.slot==="GK") return null;
    const opps=this.side(this.opp(key));                   // 상대(공격) 팀
    const mine=this.side(key);
    const own=(x)=> gk.dir>0 ? x : 1-x;
    if(own(carrier.x)>0.62) return null;                   // 아직 멀다
    const cA=(carrier.p&&carrier.p.attr)||{};
    const cAt=(k,fb)=>clamp(attr20(cA[k]!=null?cA[k]:(fb||60))/20, 0.15, 1);
    const passQ=cAt("pas",60)*0.5+cAt("vis",60)*0.3+cAt("tec",60)*0.2;
    const myLine=oppLineX(mine.filter(m=>m.slot!=="GK"), -gk.dir);
    let best=null;
    const A2=(gk.p&&gk.p.attr)||{};
    const gAnt=clamp(attr20(A2.ant!=null?A2.ant:60)/20, 0.15, 1);
    const gDec=clamp(attr20(A2.dec!=null?A2.dec:60)/20, 0.15, 1);
    for(const st of opps){
      if(st===carrier || st.slot==="GK") continue;
      const bd=SLOT_BAND[st.slot];
      if(bd!=="FW" && bd!=="AM") continue;
      const fx2=clamp01(st.x+(st.vx||0)/SIM_DT*1.2), fy2=clamp01(st.y+(st.vy||0)/SIM_DT*1.2);
      const spotOwn=own(fx2);
      if(spotOwn>0.34) continue;                           // 우리 진영 깊숙한 공간만
      if(Math.abs(fy2-0.5)>0.30) continue;
      let faceK=0.55;
      if(carrier.face!==undefined){
        const want=Math.atan2(fy2-carrier.y, (fx2-carrier.x)*PITCH_AR);
        let df=want-carrier.face; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
        faceK=clamp(1-Math.abs(df)/(Math.PI*0.55), 0, 1);
        faceK=faceK+(1-faceK)*passQ*0.45;                  // 기술 좋으면 몸과 다른 방향도 준다 (§6)
      }
      if(faceK<0.25) continue;
      const passD=HYP((fx2-carrier.x)*PITCH_AR, fy2-carrier.y);
      const tBall=clamp(passD/0.28, 0.3, 2.6);             // 패스 속도 근사
      const stD=HYP((fx2-st.x)*PITCH_AR, fy2-st.y);
      const tAtk=travelTime(st, stD);
      const gkD=HYP((fx2-gk.x)*PITCH_AR, fy2-gk.y);
      const tGk=travelTime(gk, gkD)*1.08;
      /* §10 InterceptionMargin — 공격수는 받은 뒤 「터치로 정리하는 시간」이 더 든다 (§11) */
      const stA=(st.p&&st.p.attr)||{};
      const stFt=clamp(attr20(stA.fir!=null?stA.fir:60)/20, 0.15, 1);
      const grace=0.30+(1-stFt)*0.45;
      const margin=Math.min(tBall, tAtk+grace)-tGk;
      const behind=clamp((own(myLine)-spotOwn)/0.20, 0, 1);
      /* 마진 감점에 바닥 — 선행 이동(§38)은 요격 확신이 아니라 「준비」다.
         못 이기는 공이라도 위협이 크면 1~3m 는 나와 서 있어야 한다.
         실제 요격 여부는 패스가 뜬 뒤 스위핑(2)이 다시 잰다. */
      let score=faceK*0.8 + behind*0.6 + clamp(margin/0.6, -0.35, 1)*0.9
              + clamp((st.paceSkill||0.6)-0.55, 0, 0.5)*0.5
              + gAnt*0.25 - spotOwn*0.8;
      score += (Math.random()-0.5)*(0.30*(1-gDec));        // 판단력 낮으면 흔들린다 (§15·§26)
      if(!best || score>best.score)
        best={score, x:fx2, y:fy2, margin, tBall, tAtk, tGk, runner:st.id};
    }
    if(best && best.score>0.35) gk._tb=best;
    return gk._tb;
  }
  gkTarget(a, b, key, anchor){
    const ownGx = a.dir>0 ? 0.015 : 0.985;
    const own = x => a.dir>0 ? x : 1-x;                 // 우리 골문 기준 전진도
    const dx0=(b.x-ownGx)*PITCH_AR, dy0=b.y-0.5, d0=HYP(dx0,dy0)||1e-6;

    // 1) 슛이 날아온다 — 무조건 골문
    if(b.state==="SHOT" && b.shot && b.shot.oKey===key)
      return {role:"DIVE", x:anchor.x, y:clamp01(b.shot.saveY!=null?b.shot.saveY:b.shot.aimY), spd:SPD.SPRINT*1.25};   // 🏃 1.7 → 1.25 (절대 속도 8.9 m/s 유지)

    /* 1.5) 🔮 스루패스 예측 — 아직 패스가 나가지 않았지만 위험이 읽히면 선행 이동 (§38).
       실제 패스가 뜨면 아래 2) 스위핑이 이어받는다. */
    {
      const tb=this.gkThroughThreat(a);
      if(tb && b.state!=="SHOT"){
        const T=TAC(a.team);
        const lineK=0.8+((T.line||1)/2)*0.4;               // 라인 높을수록 적극 (§59)
        const eag=clamp(tb.score*lineK*(0.7+FX(a,"sweep")*0.5), 0, 1.6);
        if(eag>0.95){
          const kx=a.x+(tb.x-a.x)*0.45, ky=a.y+(tb.y-a.y)*0.45;
          if(a._gkState!=="ANTICIPATE") this.evl("GK_RUSH", a, {stg:"ANTICIPATE"});
          a._gkState="ANTICIPATE";
          return {role:"ANTICIPATE", x:clamp01(kx), y:clamp01(ky), spd:SPD.RUN};
        }
        if(eag>0.55){
          const step=0.015+eag*0.020;
          if(a._gkState!=="STEP_OUT") this.evl("GK_RUSH", a, {stg:"STEP_OUT"});
          a._gkState="STEP_OUT";
          return {role:"STEP_OUT",
            x:clamp01((a.dir>0?0.015:0.985) + a.dir*step),
            y:clamp01(0.5+(tb.y-0.5)*0.35), spd:SPD.GK*1.3};
        }
      }
      a._gkState=null;
    }
    // 역할(골키퍼 / 스위퍼 키퍼)이 "얼마나 나가는가"를 직접 조정한다.
    // 능력치(gkRush·sweepAbility)가 소질이라면, 역할은 감독의 지시다.
    const rSweep=FX(a,"sweep");
    /* 🧱 ⚠ 외부 조언 14번(「블록이 깊으면 GK 스위핑 자제」) — 구현했다가 기각(기록).
       rush ×0.71·eag ×0.75 로 죽였더니 텐백 실점 10 → 15/3경기. 딥블록도 채널 런은 새고,
       그 1대1을 지우던 게 스위퍼였다. 축구 격언이 엔진 실측에 진 사례라 수치와 함께 남긴다. */
    const rush=clamp((a.gkRush||0.5) + rSweep*0.55, 0.05, 1.25);
    const cmdSkill=clamp((a.gkSkill||0.6) + rSweep*0.20, 0.1, 1.2);
    const boxEdge = a.dir>0 ? 1-BOX_X : BOX_X;          // 우리 페널티 박스 경계의 x
    const ballOwn = own(b.x);                            // 공이 우리 골문에서 얼마나 떨어져 있나(0=골라인)

    /* 2-0) 🏃 치달로 차 놓은 공 — 소유 표시는 남아 있지만 공은 주인에게서 3~7m 앞에 홀로 온다.
       「소유 중인 공」이라는 이유로 모든 선제 분기가 잠들어 키퍼가 보고만 있었다(제보).
       주인이 충분히 멀고 내가 먼저 닿으면 나가서 잡거나 걷어낸다. */
    if(b.state==="SETTLED" && b.ownerId && b._knock){
      const ow=this.byId(b.ownerId);
      if(ow && ow.side!==key){
        const od=HYP((b.x-ow.x)*PITCH_AR, b.y-ow.y);
        if(od>0.030 && own(b.x)<GK_SWEEP_X*1.15){
          const myD=HYP((b.x-a.x)*PITCH_AR, b.y-a.y);
          if(myD/(SPD.SPRINT*1.2) < od/(SPD.SPRINT*0.95)){
            a._sweeping=this.t+0.9;
            return {role:"SWEEP", x:clamp01(b.x+(b.vx||0)*4), y:clamp01(b.y+(b.vy||0)*4), spd:SPD.SPRINT*1.25};
          }
        }
      }
    }
    // 2) 스위핑 — 뒷공간으로 흐르거나 찔러 들어온 공. 내가 먼저 닿을 수 있으면 나간다.
    if((b.state==="PASS"||b.state==="LOOSE") && b.z<CTRL_Z*1.6){
      const tx0 = b.state==="PASS" ? b.tx : b.x, ty0 = b.state==="PASS" ? b.ty : b.y;
      const landOwn = own(tx0);
      // 낙하 지점이 우리 진영 깊숙한 곳이고, 상대가 그리로 달려들 때만
      if(landOwn < GK_SWEEP_X && Math.abs(ty0-0.5) < 0.30){
        const myD = HYP((tx0-a.x)*PITCH_AR, ty0-a.y);
        let oppD=9, mateD=9;
        for(const o of this.side(this.opp(key))){
          if(o.slot==="GK") continue;
          const dd=HYP((o.x-tx0)*PITCH_AR, o.y-ty0);
          if(dd<oppD) oppD=dd;
        }
        // 우리 수비수가 더 가까우면 키퍼가 나갈 이유가 없다 — 진짜 뒷공간일 때만 나간다
        for(const m2 of this.side(key)){
          if(m2.slot==="GK") continue;
          const dd=HYP((m2.x-tx0)*PITCH_AR, m2.y-ty0);
          if(dd<mateD) mateD=dd;
        }
        const dare = GK_SWEEP_EDGE*(0.55+rush*0.90);
        if(myD < mateD && myD < oppD + dare){
          // 볼이 도착할 때까지 계속 달린다 (1.2초 창은 짧아서 도중에 포기했다)
          const remain = b.state==="PASS" ? Math.max(0.4, (b.flightT||1)-(b.flight||0)) : 1.4;
          a._sweeping = this.t + remain + 0.6;
          return {role:"SWEEP", x:clamp01(tx0), y:clamp01(ty0), spd:SPD.SPRINT*1.25};
        }
      }
    }
    /* 0) 🥅 골문으로 굴러가는 공 — 다른 어떤 판단보다 먼저 줍는다.
       흘린 공·빗나간 패스가 포스트 사이로 굴러 들어오는데 키퍼가 자리만 지키면
       그대로 실점이다(굴러 들어간 골을 정식 판정으로 바꾸며 드러난 수동성). */
    if((b.state==="LOOSE" || (b.state==="PASS" && !b.isCross)) && b.z<CROSSBAR_Z*0.9){
      const gx = a.dir>0 ? 0 : 1;                       // 우리 골라인
      const vx=b.vx||0, vy=b.vy||0;
      const toward = a.dir>0 ? vx<-0.005 : vx>0.005;    // 우리 골문 쪽으로 굴러온다
      if(toward){
        const tHit=Math.abs((gx-b.x)/(vx||1e-6));       // 골라인 도달까지(초)
        const yHit=b.y+vy*tHit;
        if(tHit<4.0 && Math.abs(yHit-0.5)<GOAL_HALF*1.35){
          /* 굴러오는 선 위, 닿을 수 있는 가장 이른 지점으로.
             ⚠ 스위핑 지속 분기보다 아래 두면 SWEEP 이 공 꽁무니(현재 위치)를 쫓다
                라인 경주에서 진다(실측: 3m 옆에 두고도 실점). 예측 지점이 핵심이다 */
          /* 공의 경로 위에서 「내가 공보다 먼저 닿는」 가장 이른 지점을 고른다.
             못 찾으면 골라인 위 통과 지점(골라인 세이브 자세)으로 간다. */
          const mySpd=SPD.SPRINT*1.2;
          let pick=null;
          for(let tt=0.2; tt<=tHit; tt+=Math.max(0.15, tHit/6)){
            const px2=b.x+vx*tt, py2=b.y+vy*tt;
            const need2=HYP((px2-a.x)*PITCH_AR, py2-a.y)/mySpd;
            if(need2 <= tt){ pick={x:px2, y:py2}; break; }
          }
          if(!pick) pick={x:clamp01(gx + (a.dir>0?0.004:-0.004)), y:clamp01(yHit)};
          return {role:"SCOOP", x:clamp01(pick.x), y:clamp01(pick.y), spd:mySpd};
        }
      }
    }
    // 방금 스위핑을 시작했으면 잠깐은 계속 달린다(왔다갔다 하지 않게)
    if(a._sweeping && a._sweeping>this.t && (b.state==="PASS"||b.state==="LOOSE")){
      /* 🎯 실제 낙하점으로 — b.tx 는 「차는 사람이 의도한 목표」다 */
      const LP=(b.state==="PASS"&&b.aerial) ? ballLand(b, this.t) : {x:b.x, y:b.y};
      return {role:"SWEEP", x:clamp01(LP.x), y:clamp01(LP.y), spd:SPD.SPRINT*1.15};
    }

    // 3) 크로스 처리 — 박스 안으로 떨어지는 뜬 공은 나와서 잡는다
    if(b.state==="PASS" && b.aerial && b.isCross){
      const LP=ballLand(b, this.t);                       // 🎯 실제 낙하점
      const landOwn=own(LP.x);
      if(landOwn < (1-BOX_X)*1.05 && Math.abs(LP.y-0.5) < 0.26){
        // 박스 장악력이 높을수록 적극적으로 나온다
        if(Math.random() < GK_CLAIM_P*(0.35+cmdSkill*1.10)){
          return {role:"CLAIM", x:LP.x, y:LP.y, spd:SPD.SPRINT};
        }
      }
    }

    /* 🏗️ 후방 빌드업 지원 — 우리가 자기 진영에서 공을 돌리는 동안 키퍼는 골라인에
       붙어 있지 않고 박스 안에서 앞으로 나와 패스 옵션이 되어 준다 (§5).
       단 압박이 강하면 위험하므로 물러난다. */
    if(this.possSide===key && ballOwn<=0.50){
      const opp2=this.side(this.opp(key));
      let np=0;
      for(const o of opp2){ if(o.slot==="GK") continue;
        if(HYP((o.x-a.x)*PITCH_AR, o.y-a.y)<0.20) np++; }
      const safe=clamp(1-np*0.45, 0, 1);                   // 근처에 상대가 오면 0에 수렴
      const cmd2=clamp((a.gkSkill||0.6)+rSweep*0.20, 0.1, 1.2);
      const step=(0.030+cmd2*0.055)*safe;                  // 최대 약 6m 전진
      const upX2 = a.dir>0 ? step : 1-step;
      return {role:"BUILD", x:clamp01(upX2),
              y:clamp01(0.5+(b.y-0.5)*0.42), spd:safe>0.5?SPD.JOG:SPD.RUN};
    }
    // 4) 빌드업 참여 — 우리 팀이 상대 진영에서 공을 돌리면 박스 앞까지 올라온다
    if(this.possSide===key && ballOwn > (0.50 - rSweep*0.16)){
      // 스위퍼 성향이 높을수록 멀리 나온다. 평범한 키퍼는 박스 안(약 13m),
      // 노이어형은 박스를 넘어 하프라인 쪽 30m 부근까지 올라와 빌드업의 한 축이 된다.
      const sw = clamp((a.sweepAbility||0.4) + rSweep*0.40, 0.05, 1.3);
      const base = GK_SUPPORT_X*(0.38+rush*0.40);
      const extra = Math.max(0, sw-GK_SWEEP_MIN)/(1-GK_SWEEP_MIN) * GK_SWEEP_PUSH;
      // 볼이 상대 진영 깊을수록 더 올라온다
      const depth = clamp01((ballOwn-0.50)/0.40);
      /* 공이 상대 진영 깊숙이 있을 때만 많이 올라온다. 상한도 낮춘다(0.40 → 0.28) */
      const push = clamp(base + extra*depth*depth, 0.05, 0.28);
      const upX = a.dir>0 ? push : 1-push;
      return {role: push>(1-BOX_X) ? "SWEEPER" : "SUPPORT",
              x:clamp01(upX), y:clamp01(0.5+(b.y-0.5)*0.30), spd:SPD.RUN};
    }

    // 5) 기본 — 각 좁히기 (+1대1 단계·지연 §19~22·45)
    const near=1-clamp(d0/0.42, 0, 1);
    let step=0.010+0.085*near*near*(0.75+rush*0.50);
    {
      const carrier=(b.ownerId!=null)?this.byId(b.ownerId):null;
      if(carrier && carrier.side!==key && b.state==="SETTLED"){
        let cover=false;
        for(const m of this.side(key)){
          if(m.slot==="GK") continue;
          if(own(m.x)<own(carrier.x) && Math.abs(m.y-carrier.y)<0.14){ cover=true; break; }
        }
        const dM=d0*ISO_TO_M;
        if(!cover && dM<20){
          const one=clamp((a.gkSkill||0.6)+FX(a,"sweep")*0.2, 0.2, 1.2);
          const ballTight=HYP((b.x-carrier.x)*PITCH_AR, b.y-carrier.y)<DRIB_LEAD*1.3;
          let chase=false;
          for(const m of this.side(key)){
            if(m.slot==="GK") continue;
            if(HYP((m.x-carrier.x)*PITCH_AR, m.y-carrier.y)<0.12){ chase=true; break; }
          }
          let k1=1;
          if(dM>12)      k1=1.35;                         // 각 좁히기 강화
          else if(dM>8)  k1=1.7;                          // 적극 전진
          else           k1=0.55;                         // 코앞 — 멈춰 서서 지연(§45)
          if(ballTight && (carrier.paceSkill||0.6)>0.62) k1*=0.62;   // RushRisk (§21)
          if(chase) k1*=0.72;                             // CB 복귀 중 — 시간을 번다 (§44)
          /* 🧤 나갈까 버틸까 — 1대1 방어가 좋은 키퍼는 「끝까지 서서 크게 보이다가」 마지막에 덮친다.
             나쁜 키퍼는 성급하게 튀어나온다. 그 성급함이 곧 칩샷의 먹잇감이 된다 (요청). */
          const one1=clamp(a.oneSkill||0.6, 0.1, 1.2);
          if(dM>10) k1 *= (0.72 + one1*0.46);             // 멀면 잘하는 키퍼가 더 적극적으로 각을 좁히고
          else      k1 *= (1.36 - one1*0.52);             // 가까우면 잘하는 키퍼일수록 덜 뛰쳐나간다
          /* 공격수가 아직 공을 몸에서 떼어 놓지 못했으면 급할 이유가 없다 */
          if(!ballTight && dM<11) k1 *= (1.10 - one1*0.30);
          step*=k1*(0.7+one*0.5);
          a._gkState = dM<8 ? "DELAY" : "CLOSE_1V1";
          a._gkCommit = dM;                               // 지금 얼마나 나와 있나 — 공격수가 이걸 본다
        }
      }
    }
    return {role:"ANGLE",
      x:clamp01(ownGx + (dx0/d0)*step/PITCH_AR),
      y:clamp01(0.5 + (dy0/d0)*step*0.85),
      spd: near>0.35 ? SPD.RUN : SPD.GK};
  }
  /* 돌파 — 진행 경로를 막고 선 수비수를 제친다.
     성공하면 수비수는 역동작으로 잠깐 주저앉고(_beaten), 드리블러는 그 틈에 치고 나간다.
     이 대결은 비율(ratio)로 판정해서 능력치 차이가 증폭되게 한다 — 슈퍼스타가 슈퍼스타답게. */
  /* 🎯 압박 결과 판정 (제보 — 「"압박 성공/실패"를 좀 더 명확하게 정의하면 좋다. ST가 CB에게 달려갔다.
       CB가 패스했다. 이걸 무조건 PRESS SUCCESS 라고 하면 안 된다. CB→RB 밖으로 몰았다면 압박 성공일 수 있다.
       반면 CB→DM 으로 중앙을 뚫었다면 압박 실패다. WIN/FORCE_WIDE/FORCE_BACK/FORCE_LONG/NEUTRAL/BEATEN
       정도로 분류하면 하이라이트 시스템에도 엄청 좋다」).
     지금까지 엔진에는 압박 「의도」(PRESS_PURPOSE)만 있고 「결과」 판정이 한 줄도 없었다 — 내러티브 로그에
     PRESS 이벤트 자체가 없어서 하이라이트 재구성 때 「압박이 만든 장면」이라는 인과가 통째로 사라졌다.
     ── 에피소드: 압박자가 캐리어 5.2m(PEP_ENGAGE) 안에 들어오면 시작. 종결과 분류 —
       · WIN        릴리스 전 턴오버(태클·흘린 공 회수), 또는 릴리스 후 1.5초 안 회수(승격)
       · FORCE_LONG 걷어내기, 또는 33m+ 급한 전방 롱볼
       · FORCE_BACK 후방 패스
       · FORCE_WIDE 더 측면으로, 전진 없이
       · BEATEN     중앙 전진 패스(압박선 통과)·돌파(takeOn 승리)·6m+ 운반 전진·사거리 안 슛 허용
       · NEUTRAL    여유 있는 정상 전개, 압박이 풀린 뒤의 릴리스
     결과는 evl("PRESS_RES")와 팀 카운터(_prStat)에 남는다. 상대 진영 깊숙한 곳의 WIN 은 하이라이트(press). */
  _pEpTick(key, carrier, pressers){
    this._pEp=this._pEp||{h:null,a:null};
    let near=null, nd=1e9;
    for(const p of pressers){ const d=HYP((p.x-carrier.x)*PITCH_AR, p.y-carrier.y); if(d<nd){ nd=d; near=p; } }
    const ep=this._pEp[key];
    if(ep){
      if(ep.carId!==carrier.id){ this._pEp[key]=null; }   // 캐리어 교체 — 릴리스 훅·giveTo 훅이 이미 처리한 뒤다
      else{
        if(near && nd<PEP_ENGAGE){ ep.lastEng=this.t; ep.prId=near.id; ep.pur=near._pressPurpose||ep.pur;
          ep.shId=(near._pressShadow&&near._pressShadow.id)||ep.shId||0; }
        const cOwn=carrier.dir>0?carrier.x:1-carrier.x;
        if(cOwn-ep.c0>0.070){ this._pEpClose(key,"BEATEN","carry"); return; }   // 압박을 이고 7.7m+ 운반 (1차 6m 은 경기당 220회 — 과다)
        if(this.t-ep.lastEng>1.0){ this._pEpClose(key,"NEUTRAL","escape"); return; }
      }
    }
    if(!this._pEp[key] && near && nd<PEP_ENGAGE && !this.ball.setPiece){
      this._pEp[key]={carId:carrier.id, carNm:this.nm(carrier), t0:this.t, lastEng:this.t,
                      prId:near.id, pur:near._pressPurpose||null,
                      c0:carrier.dir>0?carrier.x:1-carrier.x, cOppThird:(carrier.dir>0?carrier.x:1-carrier.x)<0.33};
    }
  }
  _pEpClose(key, res, how, d){
    const ep=this._pEp&&this._pEp[key]; if(!ep) return;
    this._pEp[key]=null;
    this._prStat=this._prStat||{h:{},a:{}};
    this._prStat[key][res]=(this._prStat[key][res]||0)+1;
    this._prLast=this._prLast||{};
    this._prLast[key]={res, t:this.t, key};
    const pr=this.agents.find(x=>x.id===ep.prId);
    this.evl("PRESS_RES", pr||null, Object.assign({res, pur:ep.pur, how, car:ep.carNm, dur:+(this.t-ep.t0).toFixed(1)}, d||{}));
    /* 🎬 하이 프레스 성공 — 상대 진영 깊숙한 곳(상대 골문 1/3)에서의 WIN 은 그 자체로 볼거리다 */
    if(res==="WIN" && ep.cOppThird){
      this.markHighlight("press", key, HL_W.press);
      if(Math.random()<0.6) this.cap(key, ["🔥 전방 압박이 통합니다! 높은 위치에서 공을 되찾았습니다",
        "상대 진영에서 공을 빼앗습니다 — 곧바로 기회가 됩니다!"], {}, true);
    }
  }
  _pEpRelease(carrier, kind, to){
    const key=this.opp(carrier.side);
    const ep=this._pEp&&this._pEp[key];
    if(!ep || ep.carId!==carrier.id) return;
    let res="NEUTRAL", ext=null;
    if(this.t-ep.lastEng>0.6){ this._pEpClose(key,"NEUTRAL","late"); return; }   // 릴리스 순간엔 이미 풀려 있었다
    if(kind==="clear") res="FORCE_LONG";
    else if(kind==="shot") res=(to&&to.distM<SHOT_CLOSE_M)?"BEATEN":"NEUTRAL";
    else if(to){
      const own=v=>carrier.dir>0?v:1-v;
      const fwd=own(to.x)-own(carrier.x);
      const widen=Math.abs(to.y-0.5)-Math.abs(carrier.y-0.5);
      const dist=HYP((to.x-carrier.x)*PITCH_AR, to.y-carrier.y);
      ext={to:to.slot};
      /* 진단 — 이 패스의 통로가 얼마나 막혀 있었나, 커버 섀도가 지우던 바로 그 사람인가 */
      try{ ext.lane=+laneBlocked(carrier, to, this.side(key)).toFixed(2);
           ext.sh=(ep.shId && to.id===ep.shId)?1:0; }catch(e){}
      if(dist>0.30 && fwd>0.10) res="FORCE_LONG";                       // 급한 전방 롱볼(33m+)
      else if(fwd<-0.03) res="FORCE_BACK";
      else if(fwd>0.035 && Math.abs(to.y-0.5)<0.22) res="BEATEN";       // 중앙 전진 — 압박선을 통과당했다
      else if(widen>0.04 && fwd<0.08) res="FORCE_WIDE";   // 1차 fwd<0.035 로는 3.2% — 약간 전진하며 벌리는 패스가 전부 NEUTRAL 로 샜다
    }
    this._pEpClose(key, res, kind, ext);
  }
  tryTakeOn(a, opps){
    if((a._takeOnAt||0) > this.t) return false;          // 연속 시도 쿨다운
    const fx=Math.cos(a.face||0), fy=Math.sin(a.face||0);
    let target=null, bd=TAKEON_RANGE;
    for(const o of opps){
      if(o.slot==="GK") continue;
      if(o._beaten && o._beaten>this.t) continue;        // 이미 제친 수비수
      const dx=(o.x-a.x)*PITCH_AR, dy=o.y-a.y, d=HYP(dx,dy);
      if(d>bd || d<1e-6) continue;
      // 진행 방향 ±40도 안(내적)에 서 있어야 "막고 있는" 것이다
      if((dx*fx+dy*fy)/d < 0.76) continue;
      bd=d; target=o;
    }
    if(!target) return false;
    a._takeOnAt = this.t + TAKEON_COOL;
    const T3=a.tr||{};
    // 특성 "공을 차놓고 상대를 제치는 것을 선호" — 볼 다루는 기술 대신 속도로 승부한다
    const AK=(x,k)=>(x&&x[k]!=null)?x[k]:0.6;
    const atk = T3.knockPast
      // 공을 차놓고 달린다 — 발이 전부다. 기술은 거들 뿐.
      ? AK(a,"dribSkill")*0.18 + AK(a,"topSpeed")*0.54 + AK(a,"accelSkill")*0.28
      // 정면 돌파 — 기술이 절반, 나머지는 첫 두 걸음(가속)과 빠져나가는 속도(최고속)
      : AK(a,"dribSkill")*0.52 + AK(a,"accelSkill")*0.30 + AK(a,"topSpeed")*0.18;
    // 수비도 마찬가지다. 발이 느린 센터백은 태클이 아무리 좋아도 윙어를 못 따라간다.
    /* 📏 계측 — 돌파 성공률 68.5%(실축 50%). 능력치 배분은 그대로 두고 수비 쪽 저울만 올린다.
       pWin=r/(1+r), r=(atk/def)^3.2 이므로 def×1.26 이면 0.685 → 0.50 이 된다. */
    const def = (AK(target,"tackleSkill")*0.46 + AK(target,"accelSkill")*0.22
              + AK(target,"topSpeed")*0.18 + AK(target,"posSkill")*0.14) * 1.26;
    // 비율 대결 — 1.5배 잘하면 이길 확률이 크게 벌어진다
    const r=Math.pow(atk/Math.max(0.05,def), TAKEON_POW);
    const pWin = clamp(r/(1+r), 0.06, 0.94);
    this.stats[a.side].takeOn=(this.stats[a.side].takeOn||0)+1;
    if(Math.random() < pWin){
      this.stats[a.side].takeOnWon=(this.stats[a.side].takeOnWon||0)+1;
      // 제쳐진 뒤 다시 붙기까지 — 가속도가 좋은 수비수는 금방 따라붙는다
      target._beaten = this.t + TAKEON_STAGGER*clamp(1.30-(target.accelSkill||0.6)*0.85, 0.45, 1.30);
      /* 🎯 압박 결과 — 에피소드 중 누구든 제쳤으면 압박은 뚫린 것이다 */
      try{ const _k2=this.opp(a.side), _e2=this._pEp&&this._pEp[_k2];
           if(_e2&&_e2.carId===a.id) this._pEpClose(_k2,"BEATEN","takeon"); }catch(e){}
      /* 🎬 드리블 돌파 하이라이트 — 6초 안에 둘째 수비수를 제치면(상대 진영) 볼거리다 */
      a._toStreak = (this.t-(a._toLastWin||-99)<6.0) ? (a._toStreak||1)+1 : 1;
      a._toLastWin=this.t;
      if(a._toStreak>=2 && (a.dir>0?a.x:1-a.x)>0.55) this.markHighlight("run", a.side, HL_W.run);
      this.cap(a.side, COMM.lvTakeOnWin, {p:this.nm(a)});
      // 특성 "상대를 여러 차례 속이는 것을 선호" — 쿨다운을 짧게 해 연속 돌파가 나온다
      if((a.tr||{}).repeatBeat) a._takeOnAt = this.t + TAKEON_COOL*0.35;
      this.tryBurst(a);                                   // 제치고 나가는 순간의 스퍼트
      return true;
    }
    // 실패 — 실제 축구에서 돌파 실패는 대개 볼을 뺏기는 것으로 끝난다.
    // 이 대가가 없으면 실력이 낮은 팀이 무한정 제치기를 시도하며 볼을 끌고 있게 된다.
    this.stats[a.side].lost++;
    this.cap(a.side, COMM.lvTakeOnLose, {p:this.nm(a)});
    if(Math.random() < TAKEON_FAIL_LOSS){
      /* ⚠ 태클 성공률이 80%(실축 60%)로 찍히던 두 번째 출처가 여기였다.
         돌파를 막아낸 건 태클이 맞지만, <b>서로 엉켜 공이 흘러나간</b> 경우까지
         「따냈다」로 세고 있었다. 실축 집계에서 그건 성공한 태클이 아니다.
         (경기 흐름은 그대로 — 바뀌는 건 집계뿐이다) */
      this.stats[target.side].tackle++;
      if(Math.random()<0.35){ this.looseBall(a, 0.22); }  // 서로 엉켜 흘러나간다
      else { this.stats[target.side].tackleWon++; this.giveTo(target); }   // 수비수가 그대로 뺏는다
      return true;
    }
    return false;
  }
  tryBurst(a){
    if(!a || a.slot==="GK") return false;
    if((a.burstReady||0) > this.t) return false;
    // 스퍼트를 얼마나 오래 유지하느냐는 최고 속도·지구력이, 얼마나 자주 걸 수 있느냐는 가속도가 정한다
    const top=a.topSpeed!=null?a.topSpeed:(a.paceSkill||0.6);
    const acc=a.accelSkill!=null?a.accelSkill:(a.paceSkill||0.6);
    a.burstUntil = this.t + BURST_DUR*(0.62+top*0.80);
    a.burstReady = this.t + BURST_COOL*clamp(1.42-acc*0.72, 0.70, 1.42);
    return true;
  }
  /* ⚡ side(key) — 「한 팀의 선수 11명」. 한 틱에 평균 19번 불린다(실측).
     매번 filter 로 11칸짜리 배열을 새로 만들면 한 경기(3만 틱)에 58만 개가 쌓여
     GC 가 전체 시간의 5% 를 먹었다. 결과는 아무도 제자리에서 뒤집지 않으므로
     (정렬·splice 하는 곳은 전부 [...arr] 로 복사한 뒤에 한다 — 확인함)
     명단이 바뀔 때까지 같은 배열을 돌려준다.
     명단 변화(교체·퇴장·재동기화)는 _sideBust() 로 명시적으로 깬다.
     길이까지 같이 보는 이유 — 하이라이트 되감기가 유령을 잠깐 밀어 넣는 경로처럼
     _sideBust() 를 거치지 않는 곳이 있어도 스스로 눈치채게 하려고. */
  _sideBust(){ this._sideC=null; }
  side(key){
    const c=this._sideC;
    if(c && c.n===this.agents.length){
      const hit=c[key];
      return hit || (c[key]=this.agents.filter(a=>a.side===key));
    }
    const nc={n:this.agents.length, h:null, a:null};
    this._sideC=nc;
    return (nc[key]=this.agents.filter(a=>a.side===key));
  }
  opp(key){ return key==="h"?"a":"h"; }
  byId(id){ return this.agents.find(a=>a.id===id); }
  /* 킥오프 — 양 팀이 자기 진영 안에 대형을 갖추고, 공은 하프라인 센터스팟에 놓인다.
     득점 후에는 실점한 팀이 소유권을 갖고 여기서 다시 시작한다. */
  /* ── 하프타임 진영 교대 ────────────────────────────────────
     축구는 후반에 양 팀이 골문을 바꿔 선다. 지금까지는 90분 내내 같은 쪽을 공격해서,
     화면상 홈팀이 전후반 내내 왼쪽에서 오른쪽으로만 공격했다.
     좌우를 통째로 뒤집는다 — 공격 방향(dir), 앵커 기준면(isHome), 그리고 지금 위치·속도까지. */
  switchEnds(){
    this.ends=this.ends?0:1;          // 지금 어느 쪽을 공격하는 중인지 기억해 둔다
    const mirror=(v)=>1-v;
    for(const a of this.agents){
      a.isHome=!a.isHome;
      a.dir=-a.dir;
      a.x=mirror(a.x);
      if(a.home) a.home.x=mirror(a.home.x);
      a.face=Math.PI-(a.face||0);
      if(a.face>Math.PI) a.face-=Math.PI*2; else if(a.face<-Math.PI) a.face+=Math.PI*2;
      a.vx=-(a.vx||0);
      // 캐시된 목표들도 같이 뒤집지 않으면 한 틱 동안 반대편으로 달려간다
      if(a._smx!==undefined) a._smx=mirror(a._smx);
      if(a._spot) a._spot.x=mirror(a._spot.x);
      if(a._tx!==undefined) a._tx=mirror(a._tx);
      a._spSpot=null; a._inWall=false; a._settled=false;
      a._lineOwnX=null; a._zoneMark=null; a._coverBehind=null;
    }
    const b=this.ball;
    b.x=mirror(b.x); b.vx=-(b.vx||0); b.ex=-(b.ex||0);
    if(b._rx!==undefined) b._rx=mirror(b._rx);
    if(this.ref) this.ref.x=mirror(this.ref.x);
    // 녹화 버퍼는 좌표계가 달라졌으므로 버린다 (하프타임을 가로지르는 하이라이트는 만들지 않는다)
    this.buf.length=0; this.hl=null; this.caps.length=0; this.evlog.length=0;
  }
  kickoff(key){
    const b=this.ball;
    for(const a of this.agents){
      const an=tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
      // 킥오프 순간에는 어느 팀도 하프라인을 넘을 수 없다
      a.x = a.dir>0 ? Math.min(an.x, 0.485) : Math.max(an.x, 0.515);
      a.y = an.y; if(!a._injured) a._down=0; a._spot=null; a.vx=0; a.vy=0; a._smx=undefined; a._smy=undefined;
      a.face = a.dir>0 ? 0 : Math.PI;
    }
    /* ⚠ 제보 — 필드 플레이어가 한 명도 없으면 reduce 초기값이 undefined 라 여기서 예외가 났다.
       그 예외가 startLive 한복판에서 터지면 liveM 이 남아 화면이 통째로 잠긴다. 키퍼라도 세운다. */
    const all=this.side(key);
    const mates=all.filter(a=>a.slot!=="GK");
    const pool=mates.length?mates:all;
    if(!pool.length){ this.possSide=key; b.ownerId=null; b.state="SETTLED";
      b.x=0.5; b.y=0.5; b.z=0; b.vx=0; b.vy=0; b.vz=0; b.hold=1.6*TEMPO;
      b.setPiece=null; b.shot=null; b.celebrate=null; b.foulScene=null;
      b.isPenalty=false; b.spPlan=null; b.fkDirect=false; b.fkIndirect=false; b.isThrow=false;
      this.pendingOff=null; return; }
    const mid=pool.reduce((best,a)=> Math.abs(a.y-0.5)<Math.abs(best.y-0.5)?a:best, pool[0]);
    mid.x = 0.5 - mid.dir*0.010; mid.y = 0.5;      // 센터스팟 앞에 선다
    this.possSide=key;
    b.ownerId=mid.id; b.state="SETTLED";
    b.x=0.5; b.y=0.5; b.hold=1.6*TEMPO;
    b.setPiece=null; b.shot=null; b.celebrate=null; b.foulScene=null;
    /* ⚠ 남은 세트피스 플래그를 반드시 지운다 — isPenalty 가 살아 있으면
       센터스팟에서 공을 잡은 선수가 「페널티킥」을 차 버린다(제보의 원인). */
    b.isPenalty=false; b.spPlan=null; b.fkDirect=false; b.fkIndirect=false; b.isThrow=false;
    this.pendingOff=null;   // 킥오프로 상황이 끊겼다 — 깃발도 무효
    for(const q of this.agents) q._spSpot=null;
    b.z=0; b.vx=0; b.vy=0; b.vz=0; b.inNet=false;
    b.aerial=false; b.isThrow=false; b.isCross=false; b.offsideAt=null;
    b._rollOwner=null; b.ex=0; b.ey=0;
  }
  /* ⚡ 소유가 넘어간 순간을 잡아 카운터프레스 창을 연다 (공백 01).
     이 함수가 엔진에서 유일하게 「방금 뺏겼다」를 아는 곳이다.
     possSide 는 틱 도중에 뒤집히므로, 다음 틱 머리에서 직전 값과 견줘 알아챈다(0.2초 지연). */
  cpWatch(){
    const b=this.ball, now=this.possSide, prev=this._cpPrev;
    this._cpPrev=now;
    if(this._cp && this.t>=this._cp.until) this._cp=null;
    if(this._bp && this.t>=this._bp.until) this._bp=null;
    if(this._ab && this.t>=this._ab.until) this._ab=null;
    if(!prev || !now || prev===now) return;
    if(b.setPiece || b.celebrate || b.foulScene || b.state==="SHOT") return;
    // 키퍼가 잡은 건 「뺏긴」 게 아니라 끊긴 것이다 — 달려들 곳이 없다
    const nw=(b.ownerId!=null)?this.byIdAny(b.ownerId):null;
    if(nw && nw.slot==="GK") return;
    const mine=this.side(prev);
    if(!mine.length) return;
    const dir=mine[0].dir;
    const own=(dir>0)?b.x:1-b.x;
    if(own<CP_ZONE) return;                       // 우리 진영 깊은 곳 — 그냥 수비다
    const I=cpInt(TAC(mine[0].team));
    if(I<=0.05) return;                           // 압박을 안 하는 팀은 창을 열지 않는다
    const w0=CP_WIN+CP_WIN_ADD*I;
    this._cp={side:prev, i:I, w0, until:this.t+w0, x:b.x, y:b.y};
  }
  /* ⏮️ 백패스를 놓는 순간 — 상대 팀에게 압박 창을 열어 준다 (공백 02).
     startPass 에서 부른다. 여기가 엔진에서 「방금 뒤로 돌렸다」를 아는 유일한 곳이다. */
  bpWatch(carrier, opt, pl){
    if(!carrier || !opt || !opt.to) return;
    if(this.ball.setPiece) return;
    const dir=carrier.dir;
    /* PASS_TYPE.BACK 만 믿지 않는다 — 그 분류는 LONG 뒤에 오므로 긴 백패스는
       LONG 으로 찍힌다. 방향을 직접 본다. 키퍼에게 간 패스는 방향과 무관하게 신호다. */
    const bwd=((opt.to.x-carrier.x)*dir) < -0.02;
    if(!bwd && opt.to.slot!=="GK") return;
    const own=(dir>0)?opt.to.x:1-opt.to.x;
    if(own>BP_ZONE) return;                      // 상대 진영에서의 백패스 — 쫓아갈 사람이 없다
    const key=this.opp(carrier.side);
    const foe=this.side(key);
    if(!foe.length) return;
    const I=cpInt(TAC(foe[0].team));
    if(I<=0.05) return;
    const w0=BP_WIN+BP_WIN_ADD*I;
    this._bp={side:key, i:I, w0, until:this.t+w0, gk:(opt.to.slot==="GK")?1:0};
  }
  /* 🪂 롱볼이 떠 있는 동안 창을 예약한다 — 공이 떨어지는 그 순간부터 열린다 (공백 02).
     비행 시간(plan.T)을 알고 있으므로 정확히 맞출 수 있다. startPass 에서 부른다. */
  abWatch(carrier, opt, pl){
    if(!carrier || !opt || !opt.to || !pl) return;
    if(this.ball.setPiece) return;
    if(!pl.lofted) return;                       // 떠 있는 공만 — 굴러가는 패스는 컨트롤이 흔들리지 않는다
    const key=this.opp(carrier.side);
    const foe=this.side(key);
    if(!foe.length) return;
    const tx=(pl.tx!=null)?pl.tx:opt.to.x, ty=(pl.ty!=null)?pl.ty:opt.to.y;
    /* 낙하 지점 근처에 우리 선수가 없으면 열지 않는다 — 열어 봐야 쓸 사람이 없다 */
    let near=0;
    for(const m of foe){ if(m.slot==="GK") continue;
      if(HYP((m.x-tx)*PITCH_AR, m.y-ty)<AB_REACH){ near=1; break; } }
    if(!near) return;
    const I=cpInt(TAC(foe[0].team));
    if(I<=0.05) return;
    const w0=AB_WIN+AB_WIN_ADD*I;
    const fly=clamp(pl.T||0.8, 0.2, 2.8);        // 비행 시간만큼 뒤로 민다
    this._ab={side:key, i:I, w0, until:this.t+fly+w0};
  }
  /* 선수 이동 — 전술 앵커를 기준으로 볼 쪽으로 당겨지고, 포메이션 규율(앵커 반경) 안에서만 움직인다 */
  moveAgents(){
    const b=this.ball;
    const carrier=b.ownerId!=null?this.byId(b.ownerId):null;
    /* 🧤 공을 잡은 키퍼는 그 자리에서 처리한다 — 공을 안은 채 옆으로 걸어 다니지 않는다(제보).
       위치 판단(gkPlan)이 어디로 가라고 하든, 소유 중에는 발을 떼지 않는다. */
    if(carrier && carrier.slot==="GK" && !b.setPiece){
      carrier._gkFreeze={x:carrier.x, y:carrier.y};
    } else if(carrier && carrier._gkFreeze) carrier._gkFreeze=null;
    /* 🧤 공을 통제 중인 키퍼 주위로는 상대가 들어가지 않는다 — 규칙상 방해할 수 없다.
       붙어 서서 기다리다 놓는 순간 낚아채는 그림이 나오지 않게, 최소 거리를 둔다. */
    this._gkGuard = (carrier && carrier.slot==="GK" && inBox(carrier, -carrier.dir)) ? carrier : null;
    for(const key of ["h","a"]){
      SQ_GEN++;                       // ⚡ 앞선 팀이 이미 움직였다 — 좌표가 바뀌었다
      const mine=this.side(key);
      const phase = key===this.possSide ? "ATT" : "DEF";
      /* 🚶 국면 전환 완충 — 이동 예산의 남은 큰 몫. ATT 앵커와 DEF 앵커는 깊이가 0.10~0.15(11~16m) 다르고
         소유가 바뀌는 순간(경기당 150회 안팎) 열한 명의 앵커가 한 틱에 뒤집혔다 — 선수당 1km 이상이 여기서 나왔다.
         팀마다 국면 혼합값(0=DEF, 1=ATT)을 τ≈2초로 따라가게 하고 앵커는 두 국면의 보간으로 만든다.
         역할·압박·마킹 판단은 그대로 즉시 바뀐다 — 발만 관성을 갖는다. */
      this._phK=this._phK||{};
      if(this._phK[key]===undefined || b.setPiece) this._phK[key]=(phase==="ATT"?1:0);
      else this._phK[key]+=((phase==="ATT"?1:0)-this._phK[key])*PHASE_BLEND_K;
      const phK=this._phK[key];
      const T=TAC(mine[0].team);
      // 수비 시 볼에 가장 가까운 두 명이 압박을 나간다
      let pressers=[];
      const _zoneMk = zoneMarkOn(T);          // 🧷 마킹 방식 (세부 전술)
      // 공이 죽어 있는 동안에는 아무도 공을 향해 달려들지 않는다.
      // (이게 없으면 코너킥·프리킥에서 상대 선수가 공 바로 앞까지 붙어버린다)
      if(phase==="DEF" && !b.setPiece){
        /* 🔔 압박 스위치 — 카운터프레스·백패스·뜬 공을 한 곳에서 합쳐 읽는다.
           정원 증가와 문턱 인하가 이 한 줄에서 나오므로, 셋이 겹쳐도 결과가 예측 가능하다. */
        const _tg=pressTrig(this, key, this.t);
        // 활동량 — 있어야 할 곳에 가는 능력. 낮으면 가까이 있어도 압박을 나가지 않는다.
        const pressCost=a2=>HYP((a2.x-b.x)*PITCH_AR,a2.y-b.y)
              *(1.35-(a2.workRate||0.6)*0.50)*(1-roleBias(a2).fPress*0.35);
        /* 압박 인원 — 압박 강도뿐 아니라 "수비 라인"에도 반응한다.
           라인을 올린다는 건 상대를 자기 진영에 가둬 높은 위치에서 뺏겠다는 뜻이다.
           이 연결이 없으면 라인 지시는 뒷공간만 내주는 순수 손해였다. */
        const oppHalf = (mine[0].dir>0 ? b.x : 1-b.x) > 0.50;
        // 라인만 올려놓고 압박을 안 하면 높은 위치에서 뺏히지 않는다 — 둘이 같이 가야 한다
        /* ⚡ 뺏긴 직후에는 한 명 더 조인다. 압박 성향이 최대에 가까우면 두 명 더 —
           이게 게겐프레싱 프리셋이 실제로 다르게 보이는 지점이다. */
        const extra = (T.press>=1.5?1:0) + ((T.line>=1.35 && T.press>=0.9 && oppHalf) ? 1 : 0) + _tg.add;
        const cand=[...mine].filter(a=>a.slot!=="GK" && !(a._beaten && a._beaten>this.t));
        if(carrier){
          /* 🛡️ 상황을 먼저 읽는다 — 수적 상황, 뒤 공간, 상대의 지금 상태 */
          const myDir=mine[0].dir;
          const dz=(p)=>HYP((p.x-b.x)*PITCH_AR, p.y-b.y)<0.24;
          const nD=cand.filter(dz).length, nA=this.side(this.opp(key)).filter(o=>o.slot!=="GK"&&dz(o)).length;
          const ballD=HYP((b.x-carrier.x)*PITCH_AR, b.y-carrier.y);
          let cb=0;
          if(carrier.face!==undefined){
            const toOwn=Math.atan2(0.5-carrier.y, ((myDir>0?0:1)-carrier.x)*PITCH_AR);
            let df=toOwn-carrier.face; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
            cb = Math.abs(df) > Math.PI*0.60 ? 1 : 0;      // 우리 골문에 등을 지고 있다
          }
          const line=oppLineX(cand, -myDir);
          const spaceBehind=Math.abs(line-((myDir>0)?0.08:0.92));
          const ctx0={ballD, carrierBack:cb, numAdv:nD-nA, spaceBehind, pressTac:T.press, ftBad:(carrier._ftBad>this.t),
                      hasCover:false};
          /* 🪤 수비 트랩 — 중앙을 막아(스크린) 측면으로 유도했고, 볼이 우리 진영 측면까지
         왔으면 그쪽 풀백·윙·CM 이 함께 조인다. 압박 인원이 하나 늘고, 볼 쪽 선수의
         압박 값이 오른다. 중앙 차단 → 측면 유도 → 협력 압박 → 탈취의 마지막 조각. */
      const bOwn2 = myDir>0 ? b.x : 1-b.x;
      /* 🪤 측면 트랩 — 예전에는 「볼이 우리 진영 측면에 있다」는 위치 조건 하나뿐이었다.
         터치라인에 서 있어도 열린 패스 길이 셋이면 그건 몰린 게 아니다.
         이제 pinScore 가 남은 탈출구를 직접 세고, 그 값이 정원과 가담 가점을 정한다.
         높은 압박 팀은 상대 진영에서도 트랩을 건다(하이 트랩) — 예전에는 우리 진영뿐이었다. */
      /* ⚡ pinScore 는 동료 10명 × 차단자 10명을 훑는다(틱당 최대 100회 거리 계산, 실측 전체의 2.8%).
         그런데 결과는 트랩 구역 조건이 맞을 때만 쓰인다 — 조건을 먼저 보고 필요할 때만 센다.
         (동작은 완전히 같다 — pinScore 는 아무것도 바꾸지 않는 순수 계산이다) */
      const _highTrap = (T.press>=1.40 && T.line>=1.30 && bOwn2>0.55);
      const _trapArea = (bOwn2<0.45 || _highTrap);
      const _pin = (carrier && _trapArea) ? pinScore(carrier, this.side(this.opp(key)), cand) : 0;
      const trapZone = _trapArea && _pin>0.30;
      const trapSide = b.y<0.5 ? -1 : 1;
      /* 🚶 방치 래치 — 캐리어가 아무도 안 붙은 채로 오래 서 있는가.
         ⚠ 🚫 제보 — 「수비수가 다가왔다가 뒤로 갔다가 다시 다가왔다가를 반복한다」.
            원인이 여기였다. 1차 판은 <b>거리 하나로</b> 완화를 켜고 껐다:
              ① 6m 안에 아무도 없다 → 0.6초 뒤 완화 ON → 회랑이 풀려 수비수가 볼로 간다
              ② 6m 안에 들어오는 순간 타이머가 초기화 → 완화 OFF → 회랑 감점이 되살아나
                 그를 회랑 끝으로 <b>도로 밀어낸다</b> → 물러난다
              ③ 다시 6m 밖이 된다 → ①로 …
            실측: 박스 근처 측면에서 완화 플래그가 <b>초당 0.58회</b> 껐다 켜졌다 했다.
            같은 문턱 하나로 켜고 끄면 반드시 이렇게 떤다.
         ─ 켜는 문턱과 끄는 문턱을 <b>따로</b> 두고(6m / 4m), 끌 때는 <b>실제로 붙어 있는
           시간</b>을 요구한다. 한 번 걸리면 붙을 때까지 유지된다 — 그게 「달려든다」의 의미다. */
      let _relax=0;
      if(carrier){
        let _nd=9;
        for(const q of cand){ const d=HYP((q.x-carrier.x)*PITCH_AR, q.y-carrier.y); if(d<_nd) _nd=d; }
        if(_nd>0.060){                                  // 4m 밖 — 아직 안 붙었다
          carrier._engSince=null;
          if(_nd>0.090 && carrier._freeSince==null) carrier._freeSince=this.t;   // 6m 밖에서만 타이머 시작
        } else {                                        // 4m 안 — 붙었다
          if(carrier._engSince==null) carrier._engSince=this.t;
          carrier._freeSince=null;
        }
        if(carrier._freeSince!=null && this.t-carrier._freeSince>0.6) carrier._relaxOn=true;
        if(carrier._engSince!=null && this.t-carrier._engSince>1.0) carrier._relaxOn=false;
        _relax=carrier._relaxOn?1:0;
      }
      const scored=cand.map(a=>{
            /* 내 뒤를 받쳐 줄 동료가 있는가 — 나보다 골문 쪽에 있는 사람 */
            const cover=cand.some(o=>o!==a && (o.x-a.x)*myDir<-0.012 &&
                                     Math.abs(o.y-a.y)<0.20);
            /* ⚡ 예전엔 후보마다 컨텍스트 객체를 두 개씩 새로 만들어 넘겼다 —
               pressScore 는 ctx 를 읽기만 하므로(확인함) 한 칸만 고쳐 쓴다. */
            ctx0.hasCover=cover;
            let s0=pressScore(a, carrier, ctx0);
            /* 🛤️ 압박 회랑 — 홈 앵커(블록 이동 반영)에서 캐리어까지가 회랑보다 멀면 감점 (PRESS_CORR 주석) */
            {
              const _bs=((this._bRef&&this._bRef[key])?this._bRef[key].x:b.x)-0.5;   // blockShift 는 아래에서 정의된다 — 직전 틱 기준점으로
              const _hr=tacticalAnchorRef(a.team, a.slot, "DEF", a.isHome);
              const _ha={x:clamp01(_hr.x+_bs*BLOCK_SHIFT_K), y:_hr.y};   // 고쳐 쓸 값이므로 사본
              const _hd=HYP((carrier.x-_ha.x)*PITCH_AR, carrier.y-_ha.y);
              const _cr=pressCorridor(a, T);
              a._pressHomeD=_hd; a._pressCorr=_cr; a._pressHome=_ha;
              /* 🚌 텐백 — 앵커가 깊어지면 박스 앞 20m 캐리어도 회랑 밖이 되어 아무도 슈터에게
                 나가지 못했다 (실측: 텐백 실점 7/6/4 vs 일반 최수비 3/1/5, 자유 슛 급증).
                 블록이 이미 깊게 서 있으니 한 명이 나가도 구조가 안 깨진다 — 볼이 우리 진영
                 42% 안이면 회랑 감점을 1/4 로 줄인다 */
              const _ownC=(mine[0].dir>0?carrier.x:1-carrier.x);
              const _busP=blockComp(T)>=0.75 && (_ownC<0.42);
              /* 🚨 ⚠ 제보 — 「공격수가 하프스페이스·박스 측면에 <b>가만히 서 있는데</b> 수비수들이
                 거리를 두고 구경만 한다. 현실 축구라면 거리를 좁히고 크로스 각을 막을 텐데」.
                 실측(박스 깊이·측면): 가장 가까운 수비수 <b>15.9m</b> · 8m 안 <b>0.07명</b> ·
                 97% 의 시간 동안 아무도 6m 안에 없었다. 그 자리 수비수의 97% 가 압박 회랑 밖이다.
                 ⚠ 🚫 그래서 「볼이 우리 진영 깊이 들어오면 회랑을 푼다」로 갔다가 되돌렸다 —
                    방치는 줄었지만 <b>공격이 통째로 죽었다</b>(슛 24.2 → 19.4 · 크로스 35.8 → 26.9).
                    회랑은 측면 공격이 전개될 공간을 만들어 주는 장치이기도 했다.
                 ─ 제보의 핵심은 위치가 아니라 <b>「가만히」</b> 다. 대형을 지키는 것과
                   <b>아무도 안 붙은 채로 몇 초가 지나는 것</b>은 다른 얘기다.
                   6m 안에 아무도 없는 상태가 이어진 <b>시간</b>으로만 회랑을 푼다 —
                   전개 중인 측면 공격은 건드리지 않고, 서서 구경하는 그림만 없앤다. */
              const _dgr=_relax;
              if(_hd>_cr) s0 -= ((_hd-_cr)/_cr)*PRESS_CORR_PEN*(_busP?0.25:1)*(1-_dgr*0.80);
              a._pressRelax=_dgr;
              /* 🏃 회랑을 풀면 <b>엉뚱한 사람이 나간다</b> — 실측으로 확인했다.
                 회랑 완화 후 박스 측면의 압박자 슬롯 분포: CAM 194 · LDM 76 vs <b>LB 5 · RB 6</b>.
                 20m 밖 공격형 미드필더가 압박자로 뽑혀 달려오다 크로스가 올라가고 끝났다.
                 ⚠ 🚫 그래서 「가까우면 가산 · 멀면 감점」을 넣었더니 압박자는 풀백으로 바뀌었지만
                    (RB 199) <b>수비가 과해져 공격이 죽었다</b> — 슛 24.2 → 16.9 · 크로스 35.8 → 22.7.
                    가까운 사람이 없으면 전원이 문턱 아래로 떨어져 아무도 안 나가는 부작용도 있었다.
                 ─ 거리 항과 「무조건 한 명」 강제는 걷어낸다. 남기는 것은 회랑 완화 하나다 —
                   그것만으로 측면 방치가 47% → 25% 로 줄고 공격 지표는 그대로였다. */
            }
            /* 🧱 안정화 A-1 — 압박자 유지. 매 틱 top-N 재계산이라 점수가 조금만 흔들려도 압박자가
               바뀌고, 바뀔 때마다 멈칫(_hesitateUntil)이 걸렸다(실측 CB PRESS 26%·전환 42회/분). */
            /* 🔄 제쳐진 압박자 (수비 평가 3순위 — 재정렬). 실측(빌드 1800, seed 2, 사거리 밖): 압박자가 캐리어의
               골사이드를 잃은 에피소드 526회/경기, 그동안 다른 동료가 나선 경우 37%뿐, 3초 넘는 꼬리 추격 14%.
               제쳐진 압박자는 유지 가점(PRESS_STICK)을 잃고 소폭 감점 — 더 잘 선 동료가 이어받는다. */
            if(a.defRole===DEF_ROLE.PRESS){
              const _beh=(myDir>0 ? a.x-carrier.x : carrier.x-a.x) > 0.015;   // 캐리어가 나보다 골 쪽
              s0 += _beh ? -0.10 : PRESS_STICK;
            }
            /* 🔒 압박 전념 — 한 번 「나간다」고 정했으면 최소 PRESS_COMMIT 초는 유지한다.
               ⚠⚠ 제보 — 「수비수가 다가왔다가 뒤로 갔다가 다시 다가온다」의 <b>진짜 원인</b>이 여기였다.
                  측면 깊은 곳 캐리어 주변 수비수의 역할 전환을 재 보니 <b>선수당 분당 31회</b> —
                  2초에 한 번씩 자기 일이 바뀐다. 게다가 전환쌍이 완벽하게 대칭이다:
                    PRESS↔MARK 208/187 · SCREEN↔PRESS 157/141 · DROP↔PRESS 135/128 · LINE↔PRESS 112/110
                  판단이 아니라 <b>떨림</b>이다. PRESS 일 때 목표는 「볼」, 다른 역할일 때는 「대형 안 자리」라
                  역할이 뒤집힐 때마다 선수가 앞뒤로 오간다 — 화면에 보이는 그 움직임이 이것이다.
                  PRESS_STICK(0.32)은 있었지만 이 경계에서는 그 정도로 안 잡힌다.
               ─ 같은 캐리어를 상대로 압박을 시작한 뒤 1.4초 동안은 큰 우위를 준다. */
            if(a._pressSince!=null && carrier && a._pressCid===carrier.id
               && (this.t-a._pressSince) < PRESS_COMMIT) s0 += PRESS_COMMIT_W;
            /* 🧱 안정화 A-3 — CB 압박 게이트. 내 구역(CB_ZONE_Y)에 캐리어가 아닌 상대가 들어와 있으면
               그 공간이 내 일이다 — 캐리어가 코앞(CB_PRESS_NEAR)이 아닌 한 나가지 않는다.
               pressScore 의 _deep 가점이 박스 근처에서 CB 를 매번 내보내고, 그 빈 앵커를 다른 CB 가
               DROP 으로 메우러 가 스트라이커가 free 로 남던 구조(추적 603초: LCB PRESS·RCB DROP). */
            if(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB"){
              const _gX0=myDir>0?0.015:0.985;
              const _dc=HYP((carrier.x-a.x)*PITCH_AR, carrier.y-a.y);
              /* 🎭 스토퍼(CD/St press +0.35)는 한 발이 길고, 커버(Cv press 0)는 그대로 (CB 역할 점검) */
              if(_dc>CB_PRESS_NEAR*(1+clamp(FX(a,"press"),0,0.6))){
                if(_zoneMk) s0-=1.5;                 // 🧱 수비 B — 코앞이 아니면 나가지 않는다
                else for(const o of this.side(this.opp(key))){
                  if(o.slot==="GK"||o===carrier) continue;
                  if(Math.abs(o.x-_gX0)*PITCH_AR*ISO_TO_M<CB_ZONE_X && Math.abs(o.y-a.y)<CB_ZONE_Y){ s0-=1.5; break; }
                }
              }
            }
            if(_zoneMk && ((a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB") || wmDuty(a)>=WM_DUTY_MIN) && a.home && Math.abs(a.home.y-0.5)>0.06){
              /* 🧱 B-2 — 풀백(과 🔁 측면 미드필더)은 자기 측면의 캐리어만 압박한다. 중앙·반대쪽은 중앙 미드필더의 일.
                 실측(1230): LM/RM 의 수비 역할이 PRESS 37~51% — 반대쪽 캐리어까지 쫓아가 4-4 블록의 먼 쪽이 비었다. */
              const _fs=(a.home.y<0.5?-1:1);
              const _dc2=HYP((carrier.x-a.x)*PITCH_AR, carrier.y-a.y);
              if((carrier.y-0.5)*_fs < FB_SIDE_MIN && _dc2>FB_PRESS_NEAR) s0-=1.5;
            }
            if(trapZone){
              const mySide=(a.home && Math.abs(a.home.y-0.5)>0.06) ? (a.home.y<0.5?-1:1) : 0;
              // 몰린 정도에 비례해 가담한다 — 「측면에 있다」가 아니라 「빠져나갈 곳이 없다」가 기준이다
              if(mySide===trapSide) s0 += 0.35+0.45*_pin;
            }
            /* ⚠ 🚫 «도착 가능성»(자기 속도로 캐리어까지 가는 시간이 상황 수명을 넘으면 감점)도
               실패했다. 강하게(1.1초·0.55) — 물러남 112 → 111 인데 압박 에피소드가 25% 사라졌다.
               약하게(1.7초·0.28) — 물러남 130 으로 <b>더 나빠졌다.</b> 둘 다 측면 비율은 13.4%.
               못 닿을 사람을 빼면 그 자리를 «닿긴 하지만 더 나쁜» 사람이 받고, 그가 다시 돌아선다.
               ─ 이 문제에서 시도한 다섯 가지가 전부 같은 결말이다(명단 연속·점수 평활·정원 래치·
                 제자리 정지·도착시간). 압박자 «선정»을 어떻게 손봐도 왕복은 안 없어진다.
                 남은 가설은 선정이 아니라 <b>이동 자체</b>(목표가 바뀌는 순간의 감속·관성)인데,
                 이건 검증 없이 손댈 곳이 아니라 여기서 멈춘다. */
            /* 🔀 점수 «값»을 평활한다 — 결정 규칙이 아니라 그 재료가 흔들리고 있었다.
               pressScore 는 매 틱 거리·각도·회랑 같은 연속값으로 백지에서 계산되는데,
               상위 3~4명의 점수가 소수점 차이 안에 몰려 있다. 그래서 문턱을 걸든(슈미트)
               명단을 이어 붙이든 <b>동전 던지기의 위치만 옮길 뿐</b>이었다(28.8 → 28.3).
               같은 캐리어를 상대하는 동안은 점수를 저역통과로 흘린다 — 진짜 추세는 살아남고
               틱 단위 잡음은 죽는다. 캐리어가 바뀌면 즉시 새로 시작한다. */
            const _pcid=carrier?carrier.id:0;
            if(a._psCid===_pcid && a._psV!=null) s0 = a._psV + (s0-a._psV)*PRESS_SMOOTH;
            a._psCid=_pcid; a._psV=s0;
            return {a, s:s0};
          }).sort((p,q)=>q.s-p.s);
          // 트랩에서는 한 명 더, 완전히 몰렸으면 두 명 더. 다만 전체 정원은 5명이 상한이다 —
          // 그 이상은 압박이 아니라 대형 붕괴다.
          const trapAdd = trapZone ? (_pin>0.70 ? 2 : 1) : 0;
          /* ⚠ 🚫 여기서 「크로스 위험 구간에서는 문턱을 낮추고 정원을 늘린다」를 시도했다가 걷어냈다 —
             압박자 지명을 건드리는 순간 공격이 통째로 죽었다(슛 24 → 17 · 크로스 36 → 23).
             측면 방치는 회랑 완화만으로 충분히 잡힌다. 지명 규칙은 그대로 둔다. */
          /* 🔀 전환 비용 ③ — <b>정원</b>은 손대지 않는다 (실측 결론).
             원인 분해에서 가장 큰 조각은 정원이었다(명단 변화 363회 중 축소 144 · 확대 112).
             `extra` 는 트리거 창(_tg.add)과 「볼이 상대 진영인가」로, `trapAdd` 는 몰린 정도로
             매 틱 다시 계산되는데, 창은 열렸다 닫히고 볼은 하프라인을 넘나든다.
             그래서 정원에도 래치를 걸어 봤다 — 양쪽 방향 모두.
             ⚠ 🚫 「늘리는 건 즉시 · 줄이는 건 0.9초 뒤」 — 역할 전환 28.3 → 26.0 으로 줄었지만
                <b>화면에 보이는 증상은 되레 나빠졌다</b>(4m+ 크게 물러남 103 → 144).
                정원을 오래 열어 두면 멀리 있던 사람까지 압박자로 뽑혀 달려 나왔다가
                정원이 닫힐 때 한꺼번에 되돌아간다.
             ⚠ 🚫 「늘리는 건 0.6초 이어질 때만 · 줄이는 건 즉시」 — 전환 26.5, 크게 물러남은
                8경기 기준 219 vs 231 로 <b>차이가 없고</b>, 정작 제보의 무대인
                <b>측면 깊은 곳의 물러남 비율은 10.2% → 12.0% 로 나빠졌다.</b>
             ─ <b>전환 «횟수»와 눈에 보이는 «왕복»은 같은 것이 아니다.</b> 숫자를 6% 깎자고
               제보 장면을 18% 나쁘게 만들 수는 없다. 정원은 상황이 시키는 대로 둔다.
               떨림은 명단의 연속성(위)과 이동 계층에서 잡는다. */
          const cap=Math.min(5, 1+extra+trapAdd);
          pressers=[];
          /* ⚡ 창 안에서는 나갈 값어치의 문턱이 내려간다 — 평소라면 물러났을 사람도 나간다 */
          const goNeed = _tg.go;
          /* 🔀 압박자 명단 — <b>매번 새로 뽑지 않는다. 지난 명단에서 출발해 필요한 만큼만 고친다.</b>
             ⚠⚠ 떨림의 진짜 뿌리. 원인을 분해해 보니(2경기·측면 깊은 곳, 명단 변화 363회):
                 정원 축소 <b>144</b> · 순위 뒤바뀜 <b>107</b> · 정원 확대 <b>112</b> ·
                 「나갈 값어치 미달」 <b>0</b>
               문턱은 한 번도 원인이 아니었다. 매 주기 top-N 을 <b>백지에서</b> 다시 뽑기 때문에
               점수가 소수점 단위로 흔들리기만 해도 명단이 갈렸다.
               그래서 문턱에 슈미트 트리거(PR_ENTER/PR_EXIT)를 걸어도 28.8 → 28.8, 아무 변화가 없었다.
             ─ 세 가지 규칙으로 바꾼다.
               ① <b>빠지는 건 값어치를 잃었을 때만</b> (goNeed − PR_EXIT 아래로)
               ② <b>새로 들어오는 건 자리가 남았을 때만</b> (goNeed + PR_ENTER 위로)
               ③ <b>자리를 빼앗으려면 확실히 더 나아야 한다</b> (최하위보다 ROLE_STICK 이상)
             pickDef 의 intentSwitch 가 대형 역할끼리 하던 일을, PRESS 경계에서도 하게 만드는 것이다.
             (설계 의도: PRESS 와 나머지 역할이 <b>같은 전환 비용 규칙</b>을 공유한다.) */
          {
            const _prk="pr"+key, _cid3=carrier?carrier.id:0;
            this._prHold=this._prHold||{};
            const _ph=this._prHold[_prk];
            const _sc=new Map(); for(const it of scored) _sc.set(it.a, it.s);
            const _ok=(q)=>_sc.has(q) && mine.indexOf(q)>=0 && !(q._down&&q._down>this.t);
            /* 명단 갱신 주기는 역할 배정(0.4초)보다 조금 길게 — 그 사이에는 손대지 않는다 */
            if(_ph && _ph.cid===_cid3 && (this.t-_ph.t)<0.5 && _ph.list.some(_ok)){
              pressers=_ph.list.filter(_ok);
            } else {
              const prev=(_ph && _ph.cid===_cid3) ? _ph.list.filter(_ok) : [];
              pressers=prev.filter(q=>_sc.get(q) >= goNeed-PR_EXIT);          // ① 값어치를 잃은 사람만 뺀다
              for(const it of scored){
                if(pressers.indexOf(it.a)>=0) continue;
                if(pressers.length<cap){                                       // ② 자리가 남았다
                  if(it.s >= goNeed+PR_ENTER) pressers.push(it.a);
                  continue;
                }
                let wi=-1, wv=Infinity;                                        // ③ 자리를 빼앗는다
                for(let k=0;k<pressers.length;k++){ const v=_sc.get(pressers[k]); if(v<wv){ wv=v; wi=k; } }
                if(wi>=0 && it.s >= wv+ROLE_STICK && it.s >= goNeed+PR_ENTER) pressers[wi]=it.a;
                else break;                                                    // 정렬돼 있으니 아래는 볼 것도 없다
              }
              pressers.sort((x,y)=>_sc.get(y)-_sc.get(x));
              if(pressers.length>cap) pressers.length=cap;                     // 정원이 줄었다 — 낮은 순으로 뺀다
              /* 🥇 «누가 볼로 가는가» 도 전환 비용을 갖는다. 아래 가르기에서 1순위는 볼, 2순위는
                 패스길을 맡으므로, 둘이 자리를 맞바꾸면 <b>두 사람이 동시에</b> 목표를 바꾼다.
                 확실히 나은 사람이 나타나기 전까지는 붙어 있던 사람이 계속 볼을 맡는다. */
              if(_ph && _ph.cid===_cid3 && _ph.list.length){
                const _inc=_ph.list[0], _k=pressers.indexOf(_inc);
                if(_k>0 && _sc.get(_inc) >= _sc.get(pressers[0])-ROLE_STICK){
                  pressers.splice(_k,1); pressers.unshift(_inc);
                }
              }
              this._prHold[_prk]={t:this.t, cid:_cid3, list:pressers.slice()};
            }
            for(const q of pressers) q._pressS=_sc.get(q);
          }
          /* (명단 고정·유지 규칙은 위 «압박자 명단» 블록으로 합쳤다 — 두 곳에서 명단을 만지면
              한쪽의 히스테리시스를 다른 쪽이 지운다.) */
          /* 🎯 목적·그림자 — 압박자마다 (pressPurposeFor 주석) */
          for(const a2 of mine){ a2._shadowDuty=null; }
          const _oppsP=this.side(this.opp(key));
          for(const pr of pressers){ const pp=pressPurposeFor(pr, carrier, _oppsP, T, trapZone, myDir); pr._pressPurpose=pp.p; pr._pressShadow=pp.shadow; }
          /* 🎯 역할 분담 — 트랩·트리거가 아니면 두 번째 압박자는 볼이 아니라 남은 패스길을 맡는다 */
          /* ⚠ 🚫 1차 시도: 사거리(CLOSE)에서는 둘 다 볼로 보냈다 — 3시드 골 14 → 20, 슛 119 → 137. 두 번째 압박자가
             패스길(컷백)을 비워 박스 안 패스가 자유로워졌다. 사거리에서도 두 번째는 패스길을 맡는다. */
          /* 🔀 전환 비용 ② — 이 «가르기»가 매 틱 뒤집히고 있었다.
             `trapZone` 과 `_tg.on`(카운터프레스·백패스·뜬공 창)은 <b>매 틱 새로 계산</b>되고,
             창은 열렸다 닫혔다 한다. 명단(_prHold)은 0.5초 붙들어 놨는데 <b>가르기는 안 붙들려 있어서</b>
             같은 두 번째 압박자가 「볼로 간다 ↔ 패스길을 맡는다」를 매 틱 오간다 —
             그때마다 목표가 「볼」↔「대형 안 자리」로 튀는, 화면에서 보이는 바로 그 왕복이다.
             실측(원인 분해, 2경기·측면 깊은 곳): 압박자 명단 변화 363회 중
               정원 축소 144 · 순위 뒤바뀜 107 · 정원 확대 112 — 「문턱 미달」은 <b>0회</b>였다.
               즉 떨림의 원인은 「나갈 값어치」가 아니라 <b>정원과 가르기가 흔들리는 것</b>이었다.
             ─ 가르기 결정도 명단과 같은 주기로 붙든다. 캐리어가 바뀌면 즉시 다시 정한다. */
          let _splitSecond=(!trapZone && !_tg.on);
          {
            const _sk="sp"+key, _scid=carrier?carrier.id:0;
            this._prSplit=this._prSplit||{};
            const _sp=this._prSplit[_sk];
            if(_sp && _sp.cid===_scid && (this.t-_sp.t)<0.5) _splitSecond=_sp.v;
            else this._prSplit[_sk]={t:this.t, cid:_scid, v:_splitSecond};
          }
          if(pressers.length>=2 && _splitSecond){
            const second=pressers.splice(1,1)[0];
            second._shadowDuty=(pressers[0]._pressShadow&&pressers[0]._pressShadow.id)||0;   // 첫 압박자의 그림자는 제외
            second._pressPurpose=null; second._pressShadow=null;
          }
          /* 🔒 전념 시각 — <b>패스길 담당(두 번째)을 덜어낸 뒤</b>에 기록한다 (위 PRESS_COMMIT 주석).
             ⚠ 덜어내기 <b>전</b>에 기록했더니 오히려 나빠졌다: 매 틱 splice 로 빠지는 두 번째 압박자도
                전념 가산을 들고 있어서, 다음 틱에 그가 1순위가 되고 원래 1순위가 밀려나는
                <b>자리 바꾸기</b>가 매 틱 일어났다. 볼에 붙는 사람만 전념한다. */
          {
            const _cid=carrier?carrier.id:0;
            for(const q of mine){
              if(pressers.indexOf(q)>=0){
                if(q._pressSince==null || q._pressCid!==_cid){ q._pressSince=this.t; q._pressCid=_cid; }
              } else { q._pressSince=null; q._pressCid=0; }
            }
          }
          this._pEpTick(key, carrier, pressers);        // 🎯 압박 결과 판정 — 에피소드 추적
          if(carrier._ftBad>this.t && pressers.length && this.emitEvents && !carrier._ftSaid){
            carrier._ftSaid=true;
            if(Math.random()<0.5) this.cap(key, ["😬 {q}의 첫 터치가 길어집니다 — {p}가 곧바로 달려듭니다"], {p:this.nm(pressers[0]), q:this.nm(carrier)}, true);
          }
          /* 아무도 안 나가면 가장 점수 높은 한 명이 「저지」한다 — 달려들지 않고 지연시킨다 */
          this._jockey=null;
          if(!pressers.length && scored.length){
            this._jockey=scored[0].a; scored[0].a._pressS=scored[0].s;
          }
          this._defCtx={nD, nA, ballD, back:cb, spaceBehind, top:(scored[0]?scored[0].s:0)};
          try{ this.trapCheck(key, mine, carrier, T); }catch(e){}   // 🪤 오프사이드 트랩 (요청)
        } else {
          /* 🧱 수비 B — 흐르는 공·날아가는 공에는 CB 가 달려가지 않는다 (공간을 지킨다) */
          const _isFBx=a=>(a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB");
          const _cand2 = _zoneMk ? cand.filter(a=>!(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB")
              /* 🧱 B-2 — 풀백은 자기 측면으로 오는 공만 */
              && !(_isFBx(a) && a.home && ((b.y-0.5)*(a.home.y<0.5?-1:1) < -FB_SIDE_MIN))) : cand;
          pressers=(_cand2.length?_cand2:cand).sort((p,q)=>pressCost(p)-pressCost(q)).slice(0, 1+extra);
        }
      }
      // 팀 블록은 볼 위치를 따라 통째로 오르내린다 — 실제 축구의 라인 유지.
      // 이게 없으면 선수들이 각자 포메이션 자리에 묶여 있어서, 자기 진영 깊은 곳의 볼 소유자에게는
      // 40m짜리 롱볼 말고는 전진 옵션이 아예 존재하지 않게 된다.
      if(phase==="ATT"){
        /* ⚡ 역할 재배정은 0.4초에 한 번 (제보 — 위임 경기 렉).
           역할은 에이전트에 남아 있으므로 건너뛴 틱은 「직전 역할을 유지」한다 —
           원래 있던 역할 흔들림 방지(히스테리시스)와 같은 방향이다.
           다만 소유자가 바뀌거나 국면이 뒤집힌 순간에는 즉시 다시 정한다. */
        const _rk="o"+key;
        this._roleAt=this._roleAt||{};
        const _cid=carrier?carrier.id:0;
        const _prev=this._roleAt[_rk];
        const _force=!_prev || _prev.c!==_cid || (this.t-_prev.t)>=0.4;
        if(_force){
          this._roleAt[_rk]={t:this.t, c:_cid};
          assignOffRoles(mine, this.t, b, mine[0].dir, T.mentality,
                       this.side(this.opp(key)), carrier, T.press);   // 소유 팀은 역할을 나눠 움직인다
        }
        /* 🏗️ 빌드업 상황 — 틱당 1회. Phase 1 에서는 계측·디버그 용도로만 쓴다. */
        this._bu = buildUpContext(mine, this.side(this.opp(key)), b, mine[0].dir, carrier);
        /* ⏱️ 압박 반응형 소유 시간 (제보: 수비수·키퍼가 볼 잡다 뺏기는 게 너무 잦음)
           소유 타이머가 4~8초인데 압박은 2초면 도착한다 — 도착 0.45초 전에는 반드시 판단한다.
           판단 시 기존 로직이 압박 상황이면 탈출패스·클리어를 고르므로, 실축처럼
           「압박 오면 빨리 처리」가 된다. 뺏기는 건 이제 진짜 늦었을 때뿐이다. */
        if(carrier && b.state==="SETTLED" && b.hold>0.55 && !b.setPiece && !b.foulScene && !b.celebrate){
          /* 후방 한정 + 진짜 돌진만 — 전장 적용은 일상 마킹까지 감지해 패스가
             255→422/팀으로 폭주했다(3경기 A/B 실측). 제보의 핵심은 「후방에서 잡다 뺏김」이다. */
          const ownAdv=carrier.dir>0?carrier.x:1-carrier.x;
          let tArr=9;
          if(ownAdv<0.42){
            for(const o of this.side(this.opp(key))){
              if(o.slot==="GK") continue;
              const dx0=(carrier.x-o.x)*PITCH_AR, dy0=carrier.y-o.y;
              const d0=HYP(dx0, dy0);
              if(d0>0.088) continue;                                   // 6m 밖은 압박이 아니다
              const vc=((o.vx||0)*PITCH_AR*dx0+(o.vy||0)*dy0)/Math.max(1e-6,d0);
              if(vc < SPD.RUN*SIM_DT*0.45) continue;                   // 조깅 견제가 아니라 돌진이어야
              const t0=d0/(SPD.SPRINT*0.92);
              if(t0<tArr) tArr=t0;
            }
          }
          if(tArr<0.95 && tArr<b.hold+0.40){
            const gkQ = carrier.slot==="GK" ? 0.45 : 0;              // 키퍼는 더 일찍 처리한다
            b.hold=Math.max(0.15, tArr-0.40-gkQ);
          }
        }
        /* 🎯 명백한 슛 기회 즉시 판단 (제보: 완벽한 찬스에도 골에어리어까지 진입 — 마지막 원인)
           11m에서 공을 잡으면 소유 타이머가 0.9~1.7초 남아, 그동안 판단 없이 걸어 들어갔다.
           앞 통로가 비고 각이 열렸고 공이 발밑이면 타이머를 기다리지 않는다 — 축구 선수는
           이 상황에서 「생각할 시간」이 필요한 게 아니라 이미 답을 안다. */
        if(carrier && carrier.slot!=="GK" && b.state==="SETTLED" && b.hold>0.06
           && !b.setPiece && !b.foulScene && !b.celebrate){
          const g0=shotGeom(carrier);
          if(g0.distM<12.5 && g0.distM>4 && g0.angle>0.34){
            const bd0=HYP((b.x-carrier.x)*PITCH_AR, b.y-carrier.y);
            if(bd0<=DRIB_LEAD*1.45){
              const sp2=(g0.gx-carrier.x)*carrier.dir; let ah=0;
              for(const o of this.side(this.opp(key))){
                if(o.slot==="GK") continue;
                const al=(o.x-carrier.x)*carrier.dir;
                if(al<=0.006 || al>=sp2) continue;
                const t2=al/Math.max(1e-6,sp2);
                if(Math.abs(o.y-(carrier.y+(0.5-carrier.y)*t2))<BLOCK_W*1.2){ ah=1; break; }
              }
              if(!ah) b.hold=0.05;   // 지금 판단하라 — act()의 강제 슛 티어가 받는다
            }
          }
          /* 🎯 컷백을 받은 선수 — 잡자마자 때린다.
             ⚠ 컷백 하한선을 evaluateShot 에 넣었는데도 슛이 안 늘었던 진짜 이유가 여기였다:
                공을 잡으면 컨트롤 시간(hold)이 TEMPO 배율까지 곱해 <b>6~10초</b>가 된다.
                그 사이 수비가 다 돌아와 다음 판단에서는 이미 슛 자리가 아니다.
                실축에서 컷백을 받은 선수는 한 박자 안에 때린다 — 그 한 박자를 여기서 준다. */
          if(carrier._cbFrom!=null && b.hold>0.40){
            const gc=shotGeom(carrier);
            if(gc.distM<22 && gc.angle>0.18) b.hold=0.35;
          }
        }
        /* 🚀 압박 순환 타이머 — 우리 진영에서 눌린 채(압박·재순환·탈출) 돌린 시간.
           상대 압박 라인이 올라와 등 뒤가 넓어진다 — 길어질수록 「한 번에 길게」가 값을 얻는다 */
        if(this._pcAt!==this.t){
          this._pcAt=this.t;
          if(this._pcSide!==key){ this._pcSide=key; this._pcT=0; }
          const own2=mine[0].dir>0 ? b.x : 1-b.x;
          const st2=this._bu.state;
          if(own2<0.45 && (st2===BU_STATE.PRESSURE||st2===BU_STATE.RECYCLE||st2===BU_STATE.ESCAPE))
            this._pcT=(this._pcT||0)+SIM_DT;
          else if(own2>=0.52) this._pcT=0;
        }
      }
      const oLine = phase==="ATT" ? oppLineX(this.side(this.opp(key)), mine[0].dir) : 0;
      /* 🧭 블록 기준점 — bRef 주석 참고 */
      this._bRef=this._bRef||{};
      const _dz = (phase==="DEF") && ((mine[0].dir>0 ? b.x : 1-b.x) < DZ_OWN);   // 🚨 위험 구역 (아래 주석)
      /* 🚌 저블록 조기 복귀 (제보 — 「라인 내리고 좁혀도 박스에 우르르 안 모인다」의 나머지 절반).
         장면 판독: 정착 국면은 박스 3~4명이 나오는데 전환 순간은 30m 안 4명 — 복귀 전력질주가
         위험 구역(자기 36%)에서야 걸려, 상대 진입(3~5초)보다 재편성(7~10초)이 늦었다.
         압축 0.62 이상 팀은 공이 하프라인 부근(52%)만 넘어와도 전원 전력 복귀한다 */
      /* 🔀 공수전환 속도(요청) — 빠르게(1.5+)면 압축과 무관하게 조기 전력 복귀. 매우 빠르게(2)는 더 일찍(0.58) */
      const _trsK=(T.transSpd!=null?T.transSpd:1);
      const _busDz = (phase==="DEF") && (blockComp(T)>=0.62 || _trsK>=1.5)
                     && ((mine[0].dir>0 ? b.x : 1-b.x) < (_trsK>=1.9?0.58:0.52));
      let bR=this._bRef[key];
      {
        const _bsp=HYP((b.vx||0)*PITCH_AR, b.vy||0)*ISO_TO_M;
        const _settled = b.state==="SETTLED" || (b.state==="LOOSE" && _bsp<4);
        /* ⚠ 1라운드(τ1.6초, 수비도 비행 중 정지): 3시드 골 19 → 27. 블록이 패스를 읽지 않고 도착을 기다리니
           도착 순간 공간이 열렸다. 실제 수비는 패스가 <b>나가는 순간</b> 움직인다 — 수비 국면은 비행 중에도
           따라가고(BREF_K_DEF, τ≈0.9초), 공격 국면만 정착 후 따라간다(빌드업 대형은 결과를 보고 움직여도 된다). */
        const _follow = (phase==="DEF") ? (b.state!=="SHOT") : _settled;
        /* 🚨 위험 구역 — 수비 국면에 볼이 우리 골문 36% 안이면 블록은 관성 없이 즉시 따라간다.
           밸런스 사이클(요청): 이동 거리 4라운드 뒤 골 21 → 30(3시드). 슛 수는 같은데(43 → 45) 4m 안에 수비수가
           없는 슛이 17 → 29, 블록 11 → 6 — 느려진 블록·넓어진 버팀 반경이 박스 근처에서 그대로 적용된 탓.
           위험 구역에서는 기준점 즉시 추종·버팀 반경 축소·압박 전력질주·스무딩 완화로 되돌린다. */
        const _k = (phase==="DEF") ? (_dz ? 0.5 : BREF_K_DEF) : BREF_K;
        if(!bR || b.setPiece){ bR=this._bRef[key]={x:b.x, y:b.y}; }
        else if(_follow){
          /* ⚠ 🚫 <b>기준볼 데드존 가설 — 틀렸다.</b>
             「3m 안이면 정지, 넘으면 따라감」이라는 온·오프 구조가 연속 입력을 <b>계단</b>으로 바꿔
             열한 명의 목표를 동시에 1~2m 씩 옮기고, 그게 요요의 뿌리라고 봤다.
             넘은 <b>초과분만</b> 따라가는 연속형(소프트 데드존)으로 바꿔 실측:
               요요 <b>2.5 → 2.7</b> (측면 2.5 → 3.1) — 목표 「2.0 이하」에 한참 못 미치고 되레 나빠졌다.
             이유는 반대였다. 이 데드존은 계단을 «만드는» 장치가 아니라 블록의 움직임을 <b>억제하는</b>
             장치다. 연속으로 바꾸면 볼의 모든 흔들림이 그대로 블록에 전달돼 목표가 더 자주 움직인다.
             ─ 기준볼은 요요의 «원인»이 아니다. 원인 분해에서 41% 로 1위였던 것은
               「목표를 움직인 것이 무엇인가」이지 「떨게 만든 것이 무엇인가」가 아니었다.
               둘을 같은 것으로 읽은 게 이 가설의 오류다. */
          const dx=b.x-bR.x, dy=b.y-bR.y;
          if(HYP(dx*PITCH_AR, dy)>BREF_DEAD){ bR.x+=dx*_k; bR.y+=dy*_k; }
        }
      }
      /* 🚶 이동 거리 4라운드 (요청 「12km 아래로 만든 다음 밸런스」) — 블록 이동 폭 0.38 → 0.26 */
      const blockShift=(bR.x-0.5)*BLOCK_SHIFT_K;
      const dirBias = phase==="ATT" ? mine[0].dir*0.11 : 0;   // 소유 시 블록을 볼보다 앞으로 세운다
      let defThreat=null;
      if(phase==="DEF"){
        const _atk=this.side(this.opp(key));                 // 공을 가진 쪽
        /* ⚡ 수비 역할도 0.4초 주기 — 압박 대상(carrier)이 바뀌면 즉시 다시 정한다 (제보: 렉) */
        {
          const _rk2="d"+key;
          this._roleAt=this._roleAt||{};
          const _cid2=carrier?carrier.id:0;
          const _pv2=this._roleAt[_rk2];
          if(!_pv2 || _pv2.c!==_cid2 || (this.t-_pv2.t)>=0.4){
            this._roleAt[_rk2]={t:this.t, c:_cid2};
            assignDefRoles(mine, _atk, carrier, pressers, this.t, mine[0].dir, b, this._jockey);
          }
        }
        /* 🛡️ ⚠ 수비 AI 해부에서 확인한 결함 — 「길목 차단(LANE)이 아군을 표적으로 삼고 있었다」.
           topThreat(carrier, opps, dir) 는 넘겨받은 배열에서 「볼 소유자가 노릴 만한 가장
           위협적인 전진 패스 대상」을 고른다. 그런데 여기서는 상대(_atk)가 아니라
           수비하는 우리 팀(mine)을 넘기고 있었다. 걸러 내는 조건은 o!==carrier 뿐인데
           carrier 는 상대 소속이라 이 비교에 걸리지 않는다 —
           그래서 defThreat 은 <b>항상 우리 편 필드 플레이어</b>였다.
           결과: assignDefRoles 안에서 LANE 을 「고르는 근거」(laneS)는 올바른 상대 기준으로
              계산하는데, defTargetXY 의 LANE 이 「실제로 서는 자리」는 (볼 + 아군)/2 로 잡혔다.
              길목이 패스 길과 아무 상관 없는 좌표에 섰다. CM 은 LANE 이 하드코딩이라
              중원 한 명이 90분 내내 그 자리를 썼다. */
        defThreat = carrier ? topThreat(carrier, _atk, -mine[0].dir) : null;
        /* 🧱 현재 수비 셰이프 — 역할이 정해진 뒤에 만든다.
           누가 라인을 떠났는지 알아야 남은 사람이 폭을 다시 나눌 수 있다. */
        buildDefShape(mine, mine[0].dir, bR, blockShift, T);   // 🧭 셰이프는 기준점을 본다
      }
      for(const a of mine){
        if(a._down && a._down>this.t) continue;   // 슬라이딩 후 넘어져 있는 동안은 움직이지 못한다
        if(b.setPiece && a.id===b.setPiece.kickerId) continue;   // 키커는 세리머니 로직이 움직인다
        // 세트피스 동안에는 배치된 자리를 지킨다 (코너킥 박스 경합, 골킥 전개 대형 등).
        // 벽은 킥 직후 짧게(_spHold) 더 버틴 뒤에야 흩어진다 — 실제로도 공이 발을 떠난 뒤 무너진다.
        if((a._spHold||0)<=this.t){ a._spHold=0; if(!b.setPiece && a._inWall){ a._spSpot=null; a._inWall=false; a._smx=undefined; a._smy=undefined; } }
        if(!b.setPiece && a._spFix){ a._spFix=null; a._spFixFor=null; }
        if((b.setPiece || (a._spHold||0)>this.t) && a._spSpot){
          const ox2=a.x, oy2=a.y;
          let sx2=a._spSpot.x, sy2=a._spSpot.y;
          // 배치 자리로 가는 도중 공 옆을 스치지 않게 밀어낸다 — 단, 배정된 자리가 이미 규정 거리
          // 밖이라면 그냥 그리로 걸어가면 된다.
          //   ⚠ 여기서 무조건 반경 방향으로 밀어내면, 원 안쪽에 서 있던 선수는 매 틱 목표가
          //      "공 반대편 9.15m 지점"으로 덮어써져 자기 자리로 영영 못 간다(벽 한 명이 17m 밖에서 멈춤).
          if(b.setPiece && key!==this.possSide && a.slot!=="GK"){
            const ko2=(SETPIECE_KEEPOUT[b.setPiece.kind]||9.15)/ISO_TO_M;
            const spotOk=HYP((sx2-b.x)*PITCH_AR, sy2-b.y) >= ko2*0.985;
            if(!spotOk){
              // ⚠ 예전엔 "선수의 현재 위치"를 기준으로 밀어냈다. 그러면 목표가 매 틱 따라 움직이고,
              //    규정 거리 밖으로 나가는 순간 목표가 다시 원래(원 안쪽) 자리로 튀어 되돌아온다 —
              //    선수가 제자리에서 앞뒤로 왔다 갔다 하며 춤추는 것처럼 보이던 원인이다.
              //    배정된 자리 자체를 공 반대 방향으로 한 번만 밀어내 고정 목표로 삼는다.
              if(!a._spFix || a._spFixFor!==b.setPiece.kind){
                let fx=(sx2-b.x)*PITCH_AR, fy=sy2-b.y, fd=HYP(fx,fy);
                if(fd<1e-6){ fx=-a.dir; fy=(Math.random()-0.5)*0.4; fd=HYP(fx,fy)||1; }
                a._spFix={x:clamp01(b.x+(fx/fd)*ko2*1.03/PITCH_AR), y:clamp01(b.y+(fy/fd)*ko2*1.03)};
                a._spFixFor=b.setPiece.kind;
              }
              sx2=a._spFix.x; sy2=a._spFix.y;
            } else { a._spFix=null; a._spFixFor=null; }
          }
          const mx2=(sx2-a.x)*PITCH_AR, my2=sy2-a.y, ml2=HYP(mx2,my2);
          if(ml2>SP_ARRIVE){
            /* 🏃 사다리 개편 — 배치 이동은 RUN. 예전엔 SPRINT 라 죽은 공 동안 선수당 2.4km 를 뛰었다(전체의 14%) */
            /* 🚶 이동 거리 3라운드 — 죽은 공이 경기의 18.5%, 그동안 평균 2.5m/s 로 걸어 선수당 2.5km.
               자리까지 12m 안이면 걷고(JOG), 멀면 RUN. 도착 시간은 세트피스 준비 시간(3~7초)이 넉넉하다. */
            /* 4라운드 3차: 죽은 공이 경기의 14~18%(19분) — 실제 선수는 그동안 1m/s 로 걷는다. 20m 안 1.3m/s, 밖 2.8m/s. */
            const _spSpd = (ml2*ISO_TO_M>20) ? SPD.RUN*0.6 : SPD.JOG*0.65;
            const step2=Math.min(ml2-SP_ARRIVE*0.5, _spSpd*SIM_DT);
            a.x=clampPx(a.x+(mx2/ml2)*step2/PITCH_AR);
            a.y=clampPy(a.y+(my2/ml2)*step2);
            /* ⚠ 제보 — 몸 방향이 한 틱에 홱 뒤집혀 휙휙 도는 것처럼 보였다.
               세트피스 이동에서도 회전은 회전 속도의 제약을 받는다. */
            turnToward(a, Math.atan2(my2,mx2), 1.0);
            a.vx=a.x-ox2; a.vy=a.y-oy2;
          } else {
            // 자리에 도착했다 — 발을 멈추고 공을 바라본다. (미세 이동을 계속하면 방향이 매 틱 뒤집혀 떨린다)
            a.vx=0; a.vy=0;
            /* 🧤 진범(GK 판단 추적) — 골킥 키커가 킥 방향으로 몸을 돌리는(_kickFace) 동안 이 줄이 매 틱
               「공을 바라보라」로 되돌려, 킥 각(1.05rad)에 영영 못 들어가고 판단만 반복했다(회전 505회/패스 31회).
               킥 회전이 예약돼 있으면 양보한다. */
            if(!(a._kickFace && a._kickFace.until>this.t && b.ownerId===a.id))
              turnToward(a, Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR), 1.0);
          }
          continue;
        }
        // 공간으로 찔러준 공을 쫓는 중 — 포메이션을 잊고 낙하 지점으로 전력질주한다
        if(a._chase){
          /* 🏃‍♀️ 만료 연장 — 4초가 지나도 공이 아직 자유롭고 12m 안이면 추격을 이어 간다.
             다 와서 손을 떼는 「포기」 장면의 한 갈래 (추격 유지 주석) */
          if(this.t>a._chase.until && (b.state==="PASS"||b.state==="LOOSE") && !b.setPiece &&
             HYP((b.x-a.x)*PITCH_AR, b.y-a.y)<0.17) a._chase.until=this.t+1.2;
          if(b.setPiece || b.foulScene || (b.state!=="PASS" && b.state!=="LOOSE") || this.t>a._chase.until){ a._chase=null; }
          // 반응 지연 중 — 아직 공이 간 걸 못 봤다. 이 프레임은 평소 수비 움직임을 그대로 한다.
          else if(a._chase.startAt && this.t < a._chase.startAt){ /* 아래 일반 로직으로 흘려보낸다 */ }
          else {
            if(a._burstAt && this.t>=a._burstAt){ this.tryBurst(a); a._burstAt=0; }
            const ch=a._chase;
            const ox0=a.x, oy0=a.y;
            const mx0=(ch.x-a.x)*PITCH_AR, my0=ch.y-a.y, ml0=HYP(mx0,my0);
            if(ml0>1e-6){
              const want=Math.atan2(my0,mx0);
              if(a.face===undefined) a.face=want;
              let df=want-a.face;
              while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
              const maxTurn=TURN_RATE*SIM_DT*(0.60+(a.agility||0.6)*0.80);
              a.face+=clamp(df,-maxTurn,maxTurn);
              const pen=1-Math.min(0.78, Math.abs(df)/Math.PI*1.25);
              let sp0=SPD.SPRINT*paceMul(a);
              if((a.burstUntil||0)>this.t) sp0*=BURST_MUL*(0.86+(a.accelSkill||0.6)*0.28);
              // 정지 상태에서 즉시 최고 속도가 되지 않는다 — 가속도를 걸어 서서히 붙인다.
              // 이 램프가 없으면 침투가 "순간이동"처럼 보이고 수비 지연 효과도 사라진다.
              const wantSpd=sp0*pen;
              const acc0=ACCEL_BASE*accMul(a);
              const lim0=(wantSpd>(a.spd||0)) ? acc0*SIM_DT : acc0*DECEL_MUL*SIM_DT;
              a.spd=(a.spd||0)+clamp(wantSpd-(a.spd||0), -lim0, lim0);
              const step=Math.min(ml0, a.spd*SIM_DT);
              a.x=clampPx(a.x+Math.cos(a.face)*step/PITCH_AR);
              a.y=clampPy(a.y+Math.sin(a.face)*step);
            }
            a.vx=a.x-ox0; a.vy=a.y-oy0;
            continue;
          }
        }
        /* ⚡ 예전엔 즉시실행 함수 안에서 앵커 두 개를 「복사본」으로 받아 세 번째 객체를 만들었다 —
           선수마다 매 틱 객체 3개(경기당 200만 개). 참조판으로 읽고 결과만 한 개 만든다. */
        const _pA=tacticalAnchorRef(a.team, a.slot, "ATT", a.isHome);
        const _pD=tacticalAnchorRef(a.team, a.slot, "DEF", a.isHome);
        const anchor={x:_pD.x+(_pA.x-_pD.x)*phK, y:_pD.y+(_pA.y-_pD.y)*phK};   // 🚶 국면 전환 완충
        anchor.x=clamp01(anchor.x + blockShift*(a.slot==="GK"?0.25:1) + (a.slot==="GK"?0:dirBias));
        /* 🎼 「소유 국면 셰이프」 — 만들었다가 <b>되돌렸다</b>(기록).
           수비에는 라인이 실체로 있는데(buildDefShape) 공격에는 없다는 게 출발점이었다.
           그건 코드 사실로는 맞다. 그런데 <b>문제 진술이 틀렸다.</b>
           수비 셰이프와 같은 방식으로 라인을 뽑고, 되당김을 새로 만들지 않기 위해
           파이프라인 1단계(이 앵커)를 셰이프로 바꿔 봤다. 결과는 거의 완전한 무효였다 —
             뒷선 깊이 편차 22.2 → 23.1m · 라인 간격 17.8 → 18.6m · 좌우 전단 4.5 → 4.9m
           왜 안 되는가 — roleAnchorXY 를 열어 보면 답이 있다. 공격 역할 15 종 가운데
           <b>anchor 를 쓰는 건 BALANCE·DEEP·VACATE·기본값 뿐</b>이다.
           RUN·CHANNEL·THIRD 는 <b>상대 오프사이드 라인(lineX)</b> 기준,
           HALF·WIDE·OVERLAP·UNDERLAP·INSIDE·FARPOST 는 <b>볼</b> 기준으로 자리를 잡는다.
           즉 소유 국면의 기준틀은 이미 「우리 포메이션」이 아니라 「볼과 상대 라인」이다 —
           그리고 그게 축구적으로 옳다. 자기 대형이 아니라 상대를 보고 서는 게 맞으니까.
           앵커를 아무리 정교하게 만들어도 대부분의 역할이 그걸 안 본다.
           ⚠ 다시 시도한다면 앵커가 아니라 lineX·볼 기준 좌표들 사이의 <b>관계</b>를
              다뤄야 한다(예: 같은 라인의 두 선수가 같은 레인을 쓰지 않게).
              대형을 뒤에서 밀어 주는 방식으로는 잡히지 않는다. */
        /* 🧩 팀 보정 연쇄 (§11) — 「RB가 올라가면 RCB가 벌리고 RCM이 받친다」.
           풀백이 올라가 있는 동안 같은 쪽 CB·CM의 앵커를 변조한다 — 개별 선수가 아니라
           팀 셰이프 엔진이 현재 형태(Current Shape)를 만든다. Base ≠ Current. */
        if(this._vacAt!==this.t){
          this._vacAt=this.t; this._vac={};
          for(const k2 of ["h","a"]){
            for(const p2 of this.side(k2)){
              const sl=p2.slot;
              if(sl!=="LB"&&sl!=="RB"&&sl!=="LWB"&&sl!=="RWB") continue;
              if((p2.dir>0?p2.x:1-p2.x)>0.55){
                this._vac[k2]={y:(p2.home?p2.home.y:p2.y), id:p2.id}; break;
              }
            }
            /* 🧩 DM 드롭 감지 — 소유 중 DM계 선수가 CB 라인 높이까지 내려와 있으면
               3백 빌드업 변형이다. CB들이 좌우로 벌려 폭을 만든다 (포메이션 불문 동일 원리). */
            if(this.possSide===k2){
              let cbMin=9;
              for(const p2 of this.side(k2)){
                if(p2.slot!=="LCB"&&p2.slot!=="RCB"&&p2.slot!=="CB") continue;
                const ad=p2.dir>0?p2.x:1-p2.x; if(ad<cbMin) cbMin=ad;
              }
              if(cbMin<9) for(const p2 of this.side(k2)){
                if(p2.slot!=="DM"&&p2.slot!=="LDM"&&p2.slot!=="RDM") continue;
                if((p2.dir>0?p2.x:1-p2.x) < cbMin+0.035){
                  this._vac[k2]=this._vac[k2]||{};
                  this._vac[k2].dmDrop=1; break;
                }
              }
            }
          }
        }
        {
          const vac=this._vac[key];
          /* DM이 CB 사이로 내려왔다 — 센터백은 좌우로 벌려 3백 폭을 만든다 */
          if(vac && vac.dmDrop && (a.slot==="LCB"||a.slot==="RCB"))
            anchor.y=clamp01(0.5+(anchor.y-0.5)*1.45);
          if(vac && vac.id && vac.id!==a.id){
            const hy=(a.home?a.home.y:a.y);
            const sameSide=((vac.y<0.5)===(hy<0.5)) || Math.abs(hy-0.5)<0.08;
            if(sameSide){
              if(a.slot==="LCB"||a.slot==="RCB"||a.slot==="CB")
                anchor.y=clamp01(anchor.y+(vac.y-anchor.y)*0.30);        // CB — 빈 레인 쪽으로 벌린다
              else if(a.slot==="LCM"||a.slot==="RCM"||a.slot==="CM"||a.slot==="LDM"||a.slot==="RDM"||a.slot==="DM"){
                anchor.y=clamp01(anchor.y+(vac.y-anchor.y)*0.22);        // CM — 하프스페이스를 받친다
                anchor.x=clamp01(anchor.x - a.dir*0.015);                //      반 발 내려서
              }
            }
          }
        }
        /* 🎛️ 역할 = 「얼마나 나가고 싶은가」. 나가도 되는 상황인지는 따로 본다.
           예전에는 fwd 1.0 이 상황과 무관하게 무조건 9m 앞으로 자리를 옮겼다.
           이제 같은 크기를 쓰되 게이트를 물린다 — 소유가 없거나, 볼이 뒤에 있거나,
           가려는 자리에 이미 동료가 서 있으면 나가는 폭이 줄어든다. (§4·§10·§12)
           ⚠ findOpenSpot 의 후보 가점만으로는 대체가 안 된다. 그 함수는 기준점 주변
              0.09 반경에서만 고르기 때문에 선수를 옮길 수 없다(실측: 격차 0.149→0.111). */
        if(a.slot!=="GK" && a.role){
          const _B=roleBias(a);
          let rf=_B.fFwd; const rw=_B.fWide;
          /* 🔄 박스 투 박스(twoWay) — 공격 성향이 수비 자리까지 끌어올리면 왕복이 아니다.
             수비 국면에서는 CM 수비 임무 수준(-0.25)으로 내려앉는다 */
          if(phase!=="ATT" && FX(a,"twoWay")>0.5) rf=-0.25;
          if(rf||rw){
            const own=(a.dir>0 ? b.x : 1-b.x);            // 볼이 얼마나 앞에 있나
            let gate=clamp(0.42+own*0.86, 0.42, 1.10);    // 볼이 앞이면 마음껏, 뒤면 자제
            if(phase!=="ATT") gate*=0.66;                 // 소유가 없으면 더 자제
            if(rf){
              /* 가려는 자리에 이미 동료가 있으면 덜 나간다 — 공간을 겹쳐 쓰지 않는다 */
              const wx=clamp01(anchor.x + a.dir*rf*ROLE_FWD_X);
              let near=0;
              for(const m of mine){
                if(m===a || m.slot==="GK") continue;
                if(HYP((m.x-wx)*PITCH_AR, m.y-anchor.y)<0.075) near++;
              }
              const g2=gate*clamp(1-near*0.20, 0.45, 1);
              anchor.x=clamp01(anchor.x + a.dir*rf*ROLE_FWD_X*(phase==="ATT"?1:0.45)*g2);
            }
            if(rw){
              const side = anchor.y<0.5 ? -1 : 1;         // 원래 서 있던 쪽 기준
              /* 폭은 소유 여부보다 「그 측면을 동료가 이미 잡고 있는가」에 반응한다 (§5·§12).
                 팀 폭 유지는 수비 중에도 필요하므로 소유 게이트를 걸지 않는다. */
              let wg=1;
              for(const m of mine){
                if(m===a || m.slot==="GK") continue;
                if((m.y-0.5)*side>0 && Math.abs(m.y-0.5)>0.28 &&
                   Math.abs(m.x-anchor.x)<0.12){ wg*=0.74; }
              }
              /* 🧩 인버티드(wide<0)는 소유 중 하프스페이스까지 접는다 — 실측 3m 로는 「인버티드」 그림이 안 나왔다 */
              const _rwk = (rw<0 && phase==="ATT") ? ROLE_WIDE_Y*1.9 : ROLE_WIDE_Y;
              /* 🎭 메짤라(halfSpace) — 상대적 이동(+rw×0.115)은 계측상 폭 +1.1~1.3m 뿐이라
                 하프스페이스라는 그림이 안 나왔다. 소유 중엔 밴드(중앙에서 약 13m)로 직접 앵커링 */
              if(phase==="ATT" && FX(a,"halfSpace")>0.5){
                const hsY=0.5+side*0.19;
                anchor.y=clamp01(anchor.y+(hsY-anchor.y)*0.75*clamp(wg,0.50,1));
              } else
              anchor.y=clamp01(anchor.y + side*rw*_rwk*clamp(wg,0.50,1));
              if(rw<0 && phase==="ATT" && Math.abs(anchor.y-0.5)<0.08) anchor.y=0.5+side*0.08;
            }
          }
        }
        let tx=anchor.x, ty=anchor.y, spd=SPD.JOG;
        a._mvLx=undefined; a._mvLy=undefined; mvMark(a,"1앵커",tx,ty);   // 🧭 계약 표 참고
        if(a.slot==="GK"){
          const g=this.gkTarget(a, b, key, anchor);
          tx=g.x; ty=g.y; spd=g.spd; a._gkRole=g.role;
          a._gkTx=g.x; a._gkTy=g.y;    // 아래의 포메이션 규율에 눌리지 않도록 따로 보관해 둔다
        } else if(carrier && a.id===carrier.id){
          const bd=HYP((b.x-a.x)*PITCH_AR, b.y-a.y);
          if(bd>DRIB_LEAD*2.2){ tx=b.x; ty=b.y; spd=SPD.RUN; }      // 아직 공을 못 잡았다 — 공을 향해 간다
          else {
            // 볼 가진 선수는 전진. 안으로 파고드는 역할·특성이면 여기에 안쪽 성분을 섞는다.
            let lead=0.05, latY=0;
            const cut=Math.min(1.4, FX(a,"cutIn"));
            if(cut>0){
              const adv = a.dir>0 ? a.x : 1-a.x;      // 0=우리 골문, 1=상대 골문
              const off = a.y-0.5;                     // 중앙에서 벗어난 정도
              if(adv>CUTIN_FROM && Math.abs(off)>CUTIN_MIN_OFF){
                const inward = off>0 ? -1 : 1;         // 중앙으로 향하는 방향
                const k = clamp((adv-CUTIN_FROM)/(CUTIN_FULL-CUTIN_FROM), 0, 1);
                // 안쪽 레인 확인 — 앞을 가로막고 선 상대가 있으면 무리해서 접지 않는다
                let blocked=0;
                for(const o of this.side(this.opp(key))){
                  if(o.slot==="GK") continue;
                  const ahead=(o.x-a.x)*a.dir;
                  if(ahead<-0.015 || ahead>CUTIN_LOOK) continue;
                  if((o.y-a.y)*inward>0 && Math.abs(o.y-a.y)<CUTIN_LANE) blocked++;
                }
                const free=clamp(1-blocked*0.42, 0.15, 1);
                const pull=CUTIN_ANGLE*cut*k*free;             // 접는 각도의 탄젠트
                lead *= 1-Math.min(0.35, pull*0.30);           // 옆으로 트는 만큼 전진은 준다
                // 남은 오프셋보다 더 안으로 들어가지 않게 잘라, 반대편으로 넘어가는 일이 없게 한다.
                // 전진을 줄인 뒤의 lead 로 계산해야 각도가 의도(최대 39도)보다 서지 않는다.
                latY = inward*Math.min(pull*lead*PITCH_AR, Math.abs(off)*0.85);
              }
            }
            tx=clamp01(a.x+a.dir*lead); ty=clamp01(a.y+latY); spd=SPD.DRIBBLE;
            /* 🛑 공을 「갈 방향 앞」에 놓고 출발한다 (제보 — 공이 뒤에 끌려다닌다).
               가려는 방향 기준으로 공이 뒤에 있으면 그대로 달려 봐야 공은 따라오지 않는다
               (아래 _follow 가 막는다). 그래서 몸만 앞서고 공은 뒤에 남아 「끌고 가는」 그림이 됐다.
               실제 선수는 이때 속도를 죽이고 발끝으로 공을 앞에 놓은 뒤 다시 뛴다.
               ─ 공이 앞에 설 때까지 걸음을 줄이고, rollBall 이 그동안 공을 발 앞으로 모은다. */
            {
              const _mx=(tx-a.x)*PITCH_AR, _my=ty-a.y;          // 가려는 방향
              const _ml=HYP(_mx,_my);
              const _bx=(b.x-a.x)*PITCH_AR, _by=b.y-a.y;        // 공까지의 벡터
              const _bl=HYP(_bx,_by);
              if(_ml>1e-6 && _bl>1e-6){
                const _ahead=(_bx*_mx+_by*_my)/_ml;             // 진행 방향으로 공이 앞선 거리(음수=뒤)
                if(_ahead < 0){ a._setBall=this.t; }
                else if(a._setBall && this.t-a._setBall>0.6) a._setBall=null;
              }
            }
            /* 🛑 공이 등 뒤로 넘어갔을 때 — 「멈춰 선다」가 아니라 「속도를 줄이고 공 쪽으로 간다」.
               ⚠ 제자리에 못 박아 두면(spd=0) 붙어 있던 수비수와 몸이 겹치고,
                  겹침을 푸는 처리가 매 틱 서로를 밀어내 둘이 함께 떠는 그림이 됐다(제보).
               실제 선수도 이때 멈추지 않는다 — 걸음을 늦추고 공 쪽으로 몸을 돌려 발에 붙인다. */
            if(a._settle){ tx=b.x; ty=b.y; spd=Math.min(spd, SPD.JOG*0.55); }
            else if(a._setBall && this.t-a._setBall<0.45) spd=Math.min(spd, SPD.JOG*0.62);
            // 앞을 막은 수비수가 있으면 제치기를 시도한다 — 성공하면 그대로 뚫고 나간다
            // 특성(자주/드물게 드리블, 개인기 시도)이 드리블 빈도 자체를 바꾼다
            const dt = clamp(1 + FX(a,"dribble"), 0.25, 2.0);
            if(this.recording && Math.random()<0.014) this.cap(a.side, COMM.lvDrib, {p:this.nm(a)}, true);
            if(Math.random() < TAKEON_TRY*dt/TEMPO) this.tryTakeOn(a, this.side(this.opp(key)));
            if((a.burstUntil||0)>this.t) spd=SPD.RUN;              // 제친 직후에는 속도가 붙는다
          }
        } else if(phase==="DEF" && (a.defRole===DEF_ROLE.PRESS || a.defRole===DEF_ROLE.JOCKEY)){
          /* ⚠ phase 가드가 필수다. defRole 은 수비 국면에서만 새로 정해지므로,
             공격 국면에는 지난 틱의 값이 그대로 남아 있다. 가드가 없으면 공격 중인 선수가
             낡은 PRESS 표식을 물고 공으로 달려간다 — 공격이 통째로 무너진다
             (실측: 역할 분포는 그대로인데 골이 2.13 → 1.13 으로 떨어졌다). */
          /* 자리는 defTargetXY 가 준다 — 여기서는 「얼마나 급히 가는가」만 정한다.
             저지는 따라붙기만, 압박은 붙잡으러 간다.
             코앞에서는 속도를 줄여야 몸이 지나쳐 벗겨지지 않는다. */
          a._now=this.t;                 // ⚠ 이걸 빠뜨리면 아래 「멈칫」이 옛 시각과 비교되어 영영 굳는다
          const dt0=defTargetXY(a, anchor, b, carrier, defThreat, a.dir);
          tx=dt0.x; ty=dt0.y;
          mvMark(a,"2역할",tx,ty);
          const jk=(a.defRole===DEF_ROLE.JOCKEY);
          const gap=HYP((tx-a.x)*PITCH_AR, ty-a.y);
          /* 🚶 이동 거리 3라운드 — 압박은 이동 예산 1위(2.8km, 평균 5.2m/s). 실제 압박은 5~6m/s 로 접근하고
             마지막 몇 m 만 전력이다. 8m 밖이면 SPRINT, 안이면 RUN×1.12(5.1m/s). */
          spd = jk ? (gap>0.045 ? SPD.RUN : SPD.JOG)
                   : ((gap>0.30 || _dz || _busDz || (carrier && carrier._ftBad>this.t)) ? SPD.SPRINT : SPD.RUN);     // … 🚨 위험 구역·🎯 첫 터치·🚌 저블록 조기 복귀는 전력
        } else if(phase==="ATT"){
          // 볼 쪽으로 몰려가지 않고 받을 공간을 찾아간다 (매 틱 재계산하면 무거우므로 1초에 한 번만)
          if(a.offRole===OFF_ROLE.RUN) a._runPhase=this.t*1.6;   // 라인 근처에서 앞뒤로 흔드는 리듬
          if(!a._spot || this.t-a._spotAt>1.6 || a._spotRole!==a.offRole){
            const _ns=findOpenSpot(a, anchor, carrier, this.side(this.opp(key)), mine, a.dir, OFF_POS_ROLES[a.offRole] ? bR : b, oLine);   // 🧭
            /* 🧭 자리 역할의 자리 재선택 불감대 — 1.6초마다 다른 빈자리를 고르면 그 계단 입력이 스무딩을 거쳐
               3~4m/s 램프가 된다(실측 BALANCE 목표 이동 3.9m/s). 새 자리가 이전 자리에서 POS_SPOT_DEAD 안이면
               이전 자리를 그대로 쓴다. 역할이 바뀌면 즉시 새 자리. */
            if(a._spot && a._spotRole===a.offRole && OFF_POS_ROLES[a.offRole] &&
               HYP((_ns.x-a._spot.x)*PITCH_AR, _ns.y-a._spot.y) < POS_SPOT_DEAD){ /* 유지 */ }
            else a._spot=_ns;
            a._spotAt=this.t; a._spotRole=a.offRole;
          }
          tx=a._spot.x; ty=a._spot.y;
          mvMark(a,"2역할",tx,ty);
          // 침투와 오버래핑은 전력질주 — 오버래핑은 거리가 멀어서 뛰지 않으면 소유가 끝나기 전에 못 간다
          /* 🏃 사다리 개편 — 기본이 RUN 이라 자리 지키는 역할(BALANCE·DEEP·HOLD·OUTLET)도 평균 2.9m/s 로 움직였다.
             달리기 역할만 SPRINT, 자리를 옮기는 역할은 RUN, 자리를 지키는 역할은 JOG. 목표가 멀면 아래 문턱이 올린다. */
          {
            const _r=a.offRole;
            spd = (_r===OFF_ROLE.RUN || _r===OFF_ROLE.OVERLAP || _r===OFF_ROLE.UNDERLAP || _r===OFF_ROLE.INSIDE || _r===OFF_ROLE.THIRD) ? SPD.SPRINT
                : (_r===OFF_ROLE.BALANCE || _r===OFF_ROLE.DEEP || _r===OFF_ROLE.HOLD || (_r===OFF_ROLE.OUTLET && !a._lavo && !a._lavoWide)
                   || _r===OFF_ROLE.WIDE || _r===OFF_ROLE.HALF) ? SPD.JOG      /* 2라운드: WIDE·HALF 도 자리 역할 · 🅛 라볼피아나 세 명은 RUN */
                : SPD.RUN;
            /* 🔀 공수전환 속도 — 「빠르게」 이상이면 탈취 후 5초 동안 자리 역할도 뛰어서 새 형태로 간다.
               체력은 그만큼 더 마른다(기존 스태미나 모델이 자동으로 청구) — 그게 이 슬라이더의 대가다. */
            if(spd===SPD.JOG && (T.transSpd!=null?T.transSpd:1)>=1.5){
              const _ps=this._possStart;
              if(_ps && _ps.side===key && this.t-_ps.t<5) spd=SPD.RUN;
            }
          }
          /* 🏃 목표가 멀면 걷지 않는다 — 실측에서 WIDE 선수가 자기 목표에서
             <b>평균 17.3m</b> 떨어져 있었다. 폭을 잡으러 가는 길이 15m 남았는데
             조깅으로 가면 영영 도착하지 못하고, 그동안 목표는 볼을 따라 또 움직인다.
             (수비 셰이프 복원 속도와 같은 잣대다) */
          {
            const _gap=HYP((tx-a.x)*PITCH_AR, ty-a.y)*ISO_TO_M;
            /* 🏃 1라운드(22/10m): 이동 16.9 → 17.5km 로 오히려 늘었다 — 목표가 볼을 따라 계속 움직여 BALANCE 도
               10m 문턱을 늘 넘었다(평균 2.8m/s 그대로). 2라운드: 26/14m. */
            /* 🚶 4라운드 — 자리 역할(BALANCE·WIDE·HALF·DEEP·HOLD·OUTLET)은 아무리 멀어도 뛰지 않는다(RUN 까지).
               실측: BALANCE 0.41km·WIDE 0.36km 가 5m/s 초과 구간에서 나왔다 — 자리로 「전력질주」할 이유는 없다. */
            if(_gap>36 && !OFF_POS_ROLES[a.offRole]) spd=Math.max(spd, SPD.SPRINT*0.92);   // 🚶 26 → 30 → 36
            else if(_gap>18) spd=Math.max(spd, SPD.RUN*1.08);      // 🚶 14 → 18
          }
          // 라인 뒤로 파고드는 순간에는 잠깐 더 치고 나간다
          if(a.offRole===OFF_ROLE.RUN && (a.burstReady||0)<=this.t && Math.random()<0.04/TEMPO) this.tryBurst(a);
        } else {
          // 수비 — 역할별로 다르게 움직인다(길목 차단 / 대인마크 / 라인 유지 / 커버)
          a._now=this.t;
          /* ⚽ <b>사람을 막는다, 발밑 공을 쫓지 않는다.</b>
             ⚠⚠ 제보(「다가왔다 물러났다」)의 가장 큰 단일 원인. 압박 목표는 «볼 + 골 쪽으로 2m» 인데,
                여기 들어오던 `b` 는 <b>드리블러 발밑에서 앞뒤로 튀는 공</b>이다. 캐리어가 제자리에
                서 있어도 공은 매 틱 1~3m 씩 왔다 갔다 하고, 압박자는 그 목표를 성실히 따라
                <b>앞뒤로 걸어 다녔다.</b> 역할도 압박 목적도 그림자도 바뀌지 않는데 목표만 움직이는
                실측 사례의 정체가 이것이다(캐리어 정지 구간의 1.5m+ 왕복 중 압박 29% · 회랑 20%).
             ─ 통제된 공이면 <b>캐리어의 몸</b>을 기준으로 선다. 발에서 공이 크게 떨어졌을 때
               (PRESS_BODY_D 밖 — 나쁜 첫 터치·헛발질)만 공을 직접 노린다. 그게 실제 수비다. */
          let _dref = DEF_POS_ROLES[a.defRole] ? bR : b;
          if(!DEF_POS_ROLES[a.defRole] && carrier
             && HYP((b.x-carrier.x)*PITCH_AR, b.y-carrier.y) < PRESS_BODY_D){
            /* 🔮 압박도 «갈 곳»을 본다 — 지금 자리로 가면 도착했을 때 캐리어는 이미 지나가 있다 */
            _dref={x:clamp01(carrier.x+(carrier.vx||0)*(PRESS_LEAD/SIM_DT)),
                   y:clamp01(carrier.y+(carrier.vy||0)*(PRESS_LEAD/SIM_DT))};
          }
          const dt=defTargetXY(a, anchor, _dref, carrier, defThreat, a.dir);   // 🧭 자리 역할은 기준점
          /* 🚫 「위험하면 역할보다 골문 앞이 먼저」 — 예전에 있던 3단계(계약 표 참고)를
             <b>걷어냈다</b>. 실측에서 두 번 다 순손해였다: 박스 안 수비 인원은 1.9 → 2.6명으로
             늘었는데 골이 11 → 17 로 뛰었고, 마킹 중인 선수를 뺀 뒤에도 14 였다.
             라인을 통째로 골문 쪽으로 내리면 상대가 더 깊은 곳에서 온사이드로 남아
             오히려 <b>가까운 거리의 슛</b>이 늘어난다.
             그 뒤 `const dg = 0 && ...` 로 꺼 둔 채 계산만 매 틱 돌고 있었다.
             박스 인원 문제는 「당기기」가 아니라 다른 방식으로 풀어야 한다. */
          tx=dt.x; ty=dt.y;
          /* 🔁 2b 측면 미드필더 「볼 뒤」 의무 — 4-4-2 의 LM/RM 은 수비 국면에 볼보다 골 쪽에 서서 4-4 블록을 완성한다.
             실측(빌드 1230 1차): 수비 국면 LM/RM 평균 위치 53m·볼 뒤 28%·PRESS 46% — 윙어(63m·25%)와 다를 게 없었다.
             압박·저지·복귀 중이 아니면 목표 x 를 볼 기준점보다 WM_BEHIND(약 3m) 골 쪽으로 당긴다. 윙어(의무 0)는 안 당긴다. */
          /* (2b 는 10e 로 옮겼다 — 여기서 당겨도 4셰이프·9규율이 MF 라인 깊이로 도로 밀어 올렸다: 볼 뒤 28 → 33% 뿐) */
          mvMark(a,"2역할",tx,ty);
          /* 🧱 셰이프 결속 — 역할이 만든 자리를 라인 쪽으로 당긴다.
             핵심은 「깊이 방향으로만 세게」라는 점이다. 좌우는 SH_Y_K(38%)만 걸어
             역할에 맡긴다 — 마크하는 센터백은 옆으로 따라가되 라인 깊이 밖으로는
             못 나간다. 역할이 셰이프를 깨는 게 아니라 일시적으로 변형시키는 것이다.
             PRESS·JOCKEY 는 결속 0 이라 이 블록을 그냥 지나간다(애초에 다른 분기다). */
          /* 🅛 라볼피아나 예외 — 디버그(빌드 2100 작업 중): 피벗의 역할 목표는 [10m, 중앙]으로 옳게 찍히는데
             4셰이프가 defRole(공격 중엔 지난 수비 국면 값, 기본 결속 0.50)로 MF 라인 깊이(44m)에 도로 묶었다.
             구조를 만드는 세 명은 셰이프 결속을 지나간다. */
          if(a._shX!=null && a._shBond>0 && !(phase==="ATT" && (a._lavo||a._lavoWide))){
            const _o=v=>a.dir>0?v:1-v;
            const _m=_o(tx)*(1-a._shBond)+a._shX*a._shBond;
            tx=clamp01(a.dir>0?_m:1-_m);
            const _ky=a._shBond*SH_Y_K;
            ty=clamp01(ty*(1-_ky)+a._shY*_ky);
          }
          mvMark(a,"4셰이프",tx,ty);
          /* 🪤 오프사이드 트랩 — 라인을 통째로 밀어 올린다 (요청).
             성공·실패를 따로 굴리지 않는다. 좌표를 실제로 옮기고, 판정은 기존 오프사이드
             로직이 그 순간의 좌표로 내린다 — 늦은 한 명이 그대로 최종 수비수가 된다.
             ⚠ 적용 지점을 셰이프 결속 <b>뒤</b>로 옮겼다. 앞에 두었더니 LINE 결속(0.95)이
                밀어 올린 3.7m 를 되당겨 <b>0.19m 만 남았다</b> — 셰이프 매니저가 트랩을
                조용히 꺼 버리고 있었다. 트랩은 「셰이프를 깨는」 게 아니라
                <b>라인 전체가 함께 하는 의도된 변형</b>이므로 결속 위에 얹는 게 맞다. */
          try{
            const _tp=this.trapPush(a);
            if(_tp>0){
              tx = clamp01(tx + a.dir*TRAP_STEP*_tp);
              // 올라갈 때는 전력질주, 내려올 때는 뛰어서 — 순간이동이 아니라 움직임이어야 한다
              spd = (a._trapDown ? SPD.RUN : SPD.SPRINT);
              a._trapOn=1;
            } else a._trapOn=0;
          }catch(e){}
          mvMark(a,"5트랩",tx,ty);
          // 위치 선정(Positioning) — 낮을수록 대기 상태에서 자리를 잘못 잡는다.
          // 압박·마크처럼 대상이 눈앞에 있는 역할에는 오차를 주지 않는다(그건 못 봐서가 아니니까).
          const idleRole = (a.defRole===DEF_ROLE.LINE || a.defRole===DEF_ROLE.COVER || a.defRole===DEF_ROLE.LANE);
          if(idleRole){
            if(a._posErrAt===undefined || this.t-a._posErrAt>POS_ERR_DRIFT){
              a._posErrAt=this.t;
              /* 수비 조율(com) — 골키퍼는 뒤에서 전부 보고 있다. 조율이 좋은 키퍼는
                 "한 발 나가", "왼쪽 비었어"를 계속 외쳐 수비의 자리 잡기 오차를 줄인다.
                 이게 없던 시절 com 은 화면에만 있고 경기에는 아무 영향이 없는 능력치였다. */
              const myGk=mine.find(x=>x.slot==="GK");
              const org=myGk ? clamp(myGk.gkOrganize||0.5, 0, 1.2) : 0.5;
              const e=POS_ERR_MAX*(1.05-(a.posSkill||0.6))*(1.22-org*0.44);
              /* 🧭 목표 요동 — 0.9초마다 오차를 새로 뽑아 <b>즉시</b> 적용하니 자리 역할의 목표가 최대 7m 씩 튀었다
                 (실측 6위치오차 단계 p90 11.6~15 m/s). 오차는 「목표」만 새로 뽑고, 적용값은 천천히 따라간다. */
              a._posGx=(Math.random()-0.5)*2*e;
              a._posGy=(Math.random()-0.5)*2*e;
            }
            a._posEx=(a._posEx||0)+((a._posGx||0)-(a._posEx||0))*POS_ERR_LERP;
            a._posEy=(a._posEy||0)+((a._posGy||0)-(a._posEy||0))*POS_ERR_LERP;
            tx=clamp01(tx+(a._posEx||0)); ty=clamp01(ty+(a._posEy||0));
          }
          /* 🦶 <b>발 데드존</b> — 제보(「다가왔다 물러났다」)의 실제 원인.
             원인을 끝까지 분해한 결과(캐리어가 <b>가만히 있는</b> 순간만 골라 접근↔후퇴 방향 전환을 셈):
               같은 역할인데 목표만 움직임 <b>81%</b> · 회랑완화 11% · 멈칫 5% · <b>역할 전환 3%</b>
             역할 떨림은 원인이 아니었다. 다시 그 81% 를 분해하면:
               블록 기준볼(bR)이 움직임 <b>41%</b> · 이미 목표에 있고 몸싸움 25% · 앵커가 움직임 <b>18%</b> ·
               위협 대상 교체 8% · 목표가 튐 9%   — <b>평균 목표 점프 1.75m</b>
             즉 수비수는 자기 역할을 바꾸지 않았다. 블록 기준점과 앵커가 계속 표류하니
             <b>목표가 1~2m 씩 앞뒤로 흔들렸고, 선수는 그걸 성실하게 따라다녔다.</b>
             ⚠ 그래서 압박자 «선정»을 여섯 번 고쳐도 아무 변화가 없었던 것이다(3% 짜리 문제였다).
           ─ 실제 수비수는 2m 목표 보정을 위해 앞뒤로 걷지 않는다. 서 있는다.
             자리 역할(블록을 이루는 역할)에 한해, 목표가 코앞이면 발을 떼지 않는다.
             한번 서면 목표가 확실히 멀어질 때까지 계속 선다(슈미트) — 경계에서 다시 떨리지 않게.
             ⚠ 자리를 잡는 <b>모든 보정이 끝난 뒤</b>에 건다. 처음에 defTargetXY 직후에 넣었더니
                아래 4셰이프 혼합(_shBond)과 위치 오차(_posEx)가 다시 목표를 흔들어 효과가 0 이었다.
             ⚠ 볼을 쫓는 역할(압박·저지·세컨볼·복귀·슛막기)은 제외한다 — 그들은 서 있으면 안 된다. */
          {
            /* 압박·저지는 데드존이 작다 — 붙어야 하는 역할이라 크게 주면 압박이 헐거워진다.
               그래도 <b>0 이면 안 된다</b>: 캐리어가 멈춰 있을 때의 왕복 중 압박 역할이 29% 로 1위였다. */
            /* ⚠ 🚫 데드존을 1.8/4.2m 로 키우고 압박 역할까지 포함해 봤다 — 2.2 → 2.5 로 <b>나빠졌다</b>.
               데드존이 크면 「멈춰 있다 한꺼번에 튀어나가는」 스톱-고 자체가 새 왕복이 된다.
               작게, 그리고 볼을 쫓는 역할은 제외 — 그 조합이 가장 좋았다. */
            const _gm=HYP((tx-a.x)*PITCH_AR, ty-a.y)*ISO_TO_M;
            if(DEF_CHASE_ROLES[a.defRole]) a._footHold=false;
            else if(a._footHold){ if(_gm>DEF_DEAD_OUT) a._footHold=false; }
            else if(_gm<DEF_DEAD_IN) a._footHold=true;
            if(a._footHold){ tx=a.x; ty=a.y; }
          }
          /* 🎯 <b>목표 저역통과</b> — 떨림의 마지막 조각이자 가장 큰 조각.
             수비 목표 좌표는 연속값 위에 <b>딱딱한 임계값</b>이 여러 겹 얹혀 있다:
               클로즈다운 호 전환(cs &lt; CLOSE_COS) · 제쳐짐 판정(cs2 &lt; −0.20) ·
               회랑 끝 판정(_pressHomeD &gt; _pressCorr×1.15) · 블록 기준볼(bR) 데드존 ·
               위협 대상 교체 · 4셰이프 혼합 · 위치 오차 난수
             각각은 한 틱 만에 목표를 <b>1~3m 옮긴다</b>. 임계값 근처에서 값이 미세하게 오르내리면
             목표가 앞뒤로 튀고, 선수는 그걸 성실히 따라가 «다가왔다 물러났다»가 된다.
             실측: 캐리어가 멈춰 있을 때의 1.5m+ 왕복 중 <b>역할 전환은 5.5%뿐</b>이고
             나머지는 전부 「같은 역할인데 목표가 움직임」이었다. 그래서 압박자 선정을 여섯 번
             고쳐도 아무 변화가 없었다 — 손잡이가 처음부터 여기 있었다.
           ─ 임계값을 하나씩 없애는 대신 <b>결과를 매끄럽게</b> 한다. 목표가 튀어도 발은 튀지 않는다.
             ⚠ 멀리 떨어져 있으면(진짜 이동 중) 평활하지 않는다 — 복귀가 굼떠진다.
             ⚠ 볼을 쫓는 역할은 약하게만 건다 — 반응이 늦으면 압박이 죽는다. */
          {
            const _far=HYP((tx-a.x)*PITCH_AR, ty-a.y)*ISO_TO_M > TGT_SM_FAR;
            if(_far || a._tSmX==null){ a._tSmX=tx; a._tSmY=ty; }
            else {
              const _k2=DEF_CHASE_ROLES[a.defRole] ? TGT_SM_CHASE : TGT_SM_K;
              a._tSmX += (tx-a._tSmX)*_k2;  a._tSmY += (ty-a._tSmY)*_k2;
              tx=a._tSmX; ty=a._tSmY;
            }
          }
          // 볼이 우리 진영으로 넘어오면 수비진은 걷지 않는다. 공격수는 전력질주로 들어오는데
          // 수비가 조깅으로 내려가면 라인은 영원히 볼보다 뒤에 놓인다.
          const deepBall = clamp01((0.34-(a.dir>0?b.x:1-b.x))/0.34);
          spd = (a.defRole===DEF_ROLE.RECOVER) ? SPD.SPRINT*0.85      // 🚶 4라운드 복귀 ×0.85
              : (a.defRole===DEF_ROLE.DROP || a.defRole===DEF_ROLE.BACKFILL) ? SPD.RUN*0.85
              /* 🏃 박스 마킹 밀착 (수비 평가 1·2순위 — 슛 순간 대응·박스 마크 간격).
                 실측(빌드 1500, seed 2 슛 27회): 슈터에게 마커가 있었던 21회 중 <b>마커가 골사이드였던 건 3회</b>, 마커 거리 중앙값 4.5m,
                 12m 뒤에서 따라오는 CB 도 있었다. 첫 터치 슛 17회 — 크로스·패스가 날아오는 2초 동안 공격수는 7.2m/s 로 파고드는데
                 마커는 4라운드 규칙(5m 안 조깅 2.6m/s · 밖 RUN 4.6m/s)으로 따라가 등 뒤를 내줬다.
                 ─ 담당이 뛰면(RUN×0.85 이상) 같이 뛰고, 위험 구역에서 공이 날아오는 동안도 뛴다. 그 외엔 4라운드 규칙 그대로. */
              : (a._mkTrack=(a.defRole===DEF_ROLE.MARK && !!a._mark && (a.dir>0?a._mark.x:1-a._mark.x)<0.42   // 우리 진영 깊숙한 담당만 (이동 거리: 전 구역이면 +1km · 0.5 → 0.42 로 -0.2km)
                             && (HYP((a._mark.vx||0)*PITCH_AR, a._mark.vy||0)/SIM_DT > SPD.RUN*0.85 || (_dz && b.state==="PASS")))) ? SPD.SPRINT*0.95
              /* 🚶 4라운드 — 마크는 담당과 가까우면(5m 안) 조깅으로 따라간다. 멀면 RUN. */
              /* 🚶 ⚠⚠ 여기가 「엉뚱한 자리에서 마크한다」의 <b>진짜 원인</b>이었다.
                 조깅 판정 기준이 <b>담당까지의 거리</b>였다 — 담당 5m 안이면 무조건 걸었다.
                 그런데 마크 자리는 담당 <b>옆</b>이 아니라 담당과 골문 <b>사이</b>다. 담당에 가깝다고
                 자리를 잡은 게 아닌데, 가깝다는 이유로 걸어서 영영 자리에 못 갔다.
                 실측(하프스페이스, 2경기): 마커의 <b>목표까지 거리 중앙값 4.6m</b> — 담당까지 거리(4.2m)보다
                 <b>멀다.</b> 목표의 골방향 오차는 44°인데 <b>실제 위치는 97°</b> — 자리는 옳게 계산해 놓고
                 그 자리에 서 있질 않았다. 화면에서 「길목을 안 막고 옆에 서 있는」 그림이 이것이다.
                 (이 규칙은 이동거리 12km 맞추기에서 들어왔다 — 절약할 곳을 잘못 골랐다.)
               ─ 기준을 <b>목표까지의 거리</b>로 바꾼다. 자리를 잡았으면 걷고, 아니면 뛴다. */
              : (a.defRole===DEF_ROLE.MARK && a._mark
                 && HYP((tx-a.x)*PITCH_AR, ty-a.y)*ISO_TO_M < MARK_JOG_GAP) ? SPD.JOG*1.3
              /* 🏃 <b>담당의 속도에 맞춘다</b> — 마커의 상한이 RUN(4.6m/s)인데 공격수는 SPRINT(7.2m/s) 다.
                 구조적으로 골사이드를 <b>지킬 수가 없다.</b> 실측(하프스페이스): 마커는 자기 목표에서
                 중앙값 3.4m 뒤에 있고, 그래서 목표의 골방향 오차 62°가 실제로는 <b>99.6°</b>가 된다 —
                 자리는 옳게 계산해 놓고 그 자리에 영영 도착하지 못한다.
                 ─ 자리를 못 잡았으면 담당이 뛰는 만큼은 뛴다. 자리를 잡았으면 위의 조깅 규칙이 받는다. */
              : (a.defRole===DEF_ROLE.MARK && a._mark) ?
                  Math.min(SPD.SPRINT*0.98,
                    Math.max(SPD.RUN, HYP((a._mark.vx||0)*PITCH_AR, (a._mark.vy||0))/SIM_DT*MARK_SPD_K))
              : (a.defRole===DEF_ROLE.LANE || a.defRole===DEF_ROLE.COVER_WIDE) ? SPD.RUN
              : (a.defRole===DEF_ROLE.BLOCK_SHOT) ? SPD.SPRINT*0.92       // 🚫 슛 선은 걸어가지 않는다 (CLOSE 주석 ②)
              : (a.defRole===DEF_ROLE.SECOND) ? (((a.dir>0?b.x:1-b.x)<0.35) ? SPD.SPRINT*0.95 : SPD.RUN)   // ⚽ 우리 진영 낙하점은 전력 (0.4 → 0.35 거리 절약)
              : lerp(SPD.JOG, SPD.RUN*0.7, deepBall);    // 🏃 사다리 개편: 라인 조정은 RUN 까지 (예전 SPRINT) · 3라운드 ×0.85 · 4라운드 ×0.7
          /* 🧱 셰이프 복원 속도 — 자기 라인에서 멀리 떨어져 있으면 걷지 않는다.
             목표만 라인으로 돌려놓고 속도를 조깅으로 두면 영영 못 돌아온다
             (실측: 목표와 실제 위치의 지연이 p90 23.6m 였다).
             「선수 간 공간 관계를 유지한다」는 자리를 실제로 회복해야 성립한다. */
          if(a._shX!=null && a._shBond>=SH_STAY){
            const _o2=v=>a.dir>0?v:1-v;
            const _off=Math.abs(_o2(a.x)-a._shX)*ISO_TO_M*PITCH_AR;   // 미터
            if(_off>20) spd=Math.max(spd, SPD.SPRINT*0.92);
            else if(_off>12) spd=Math.max(spd, SPD.RUN);
          }
        }
        // 오프사이드 라인 맞추기 — 공격 시에는 매 스텝 라인을 확인하며 위치를 조정한다.
        // (1.6초마다만 갱신하면 그사이 수비 라인이 올라갔을 때 그대로 걸려버린다)
        if(phase==="ATT" && a.slot!=="GK" && (!carrier || a.id!==carrier.id)){
          const tm=a.offTiming||0.6;
          // 프라이잉 — 라인 위에서 재다가 타이밍이 나쁘면 패스보다 먼저 튀어나간다.
          // 오프사이드는 이 순간에서 나온다. 클램프만 걸어두면 영원히 0회가 된다.
          if(a._breakAt===undefined || this.t>a._breakAt){
            a._breakAt=this.t + 2.0 + Math.random()*4.0;
            const bl = 1 + FX(a,"breakLine")*2.2;     // 역할·특성: 라인 뒤로 파고든다
            a._breakUntil = (Math.random() < EARLY_RUN_P*bl*(1.25-tm))
                            ? this.t + 0.6 + Math.random()*0.9 : 0;
          }
          const slack = (a._breakUntil>this.t) ? EARLY_RUN_LEAD*(1.25-tm) : (1-tm)*0.012;
          const limit = a.dir>0 ? oLine+slack : oLine-slack;
          tx = a.dir>0 ? Math.min(tx, limit) : Math.max(tx, limit);
        }
        // 포메이션 규율 — 앵커에서 일정 반경 밖으로는 못 나간다(압박 전술이 강하면 반경 확대)
        const leash=(pressers.includes(a)?0.34
                    : phase==="DEF" ? (a.defRole===DEF_ROLE.RECOVER?0.60 : a.defRole===DEF_ROLE.COVER_WIDE?0.34
                                     : a.defRole===DEF_ROLE.MARK?0.30 : a.defRole===DEF_ROLE.LANE?0.26 : 0.18)
                    /* 소유 국면 반경은 attLeash 하나로 모았다 — 조율 층(reachSpot)이
                       같은 자를 써야 「의도」와 「실제」가 어긋나지 않는다. */
                    : attLeash(a.offRole, T.press)-((T.press-1)*0.05))+(T.press-1)*0.05;
        // 포메이션 규율은 "앞·옆으로 벗어나는 것"을 막는 것이지, 자기 골문 쪽으로 내려서는 것까지
        // 막아서는 안 된다. 후퇴 방향으로는 반경을 크게 풀어준다.
        const retreat = phase==="DEF" && (a.dir>0 ? tx<anchor.x : tx>anchor.x);
        // 볼이 우리 박스 앞까지 왔으면 포메이션 규율을 더 크게 풀어 전원이 내려앉게 한다
        const deepPull = phase==="DEF" ? blockDepth(b, a.dir) : 0;
        const lim = retreat ? leash*(2.0+deepPull*0.9) : leash;
        const ddx=(tx-anchor.x)*PITCH_AR, ddy=ty-anchor.y;
        const dl=HYP(ddx,ddy);
        /* 🅛 라볼피아나 예외 2 — 단계 추적: 진범은 9규율이 아니라 여기(앵커 반경 클램프)였다. 피벗의 역할 목표
           [10m,중앙]이 앵커(61~73m)에서 반경 밖이라 44~56m 로 잘려 CB 사이로 내려가지 못했다. */
        if(dl>lim && !(phase==="ATT" && (a._lavo||a._lavoWide))){ tx=anchor.x+(ddx/dl)*lim/PITCH_AR; ty=anchor.y+(ddy/dl)*lim; }
        if((a.burstUntil||0)>this.t) spd*=BURST_MUL*(0.86+(a.accelSkill||0.6)*0.28);   // 순간 전력질주 — 가속도가 좋을수록 폭발적이다
        spd *= paceMul(a);   // 주력(Pace) — 느린 선수와 빠른 선수의 최고 속도가 확실히 다르다
        // 세트피스 이격 — 킥하는 팀이 아니면 규정 거리 안으로 들어갈 수 없다.
        // 방해는 하되, 실제 축구처럼 떨어져서 한다.
        if(b.setPiece && key!==this.possSide && a.slot!=="GK"){
          const ko=(SETPIECE_KEEPOUT[b.setPiece.kind]||9.15)/ISO_TO_M;
          // 목표가 원 안이면 원 밖으로 밀어낸다
          let dx=(tx-b.x)*PITCH_AR, dy=ty-b.y, d=HYP(dx,dy);
          if(d<ko){
            if(d<1e-6){ dx=-a.dir; dy=0; d=1; }
            tx=clamp01(b.x+(dx/d)*ko/PITCH_AR); ty=clamp01(b.y+(dy/d)*ko);
          }
          // 이미 원 안에 서 있으면 밖으로 물러난다 — 어슬렁대지 말고 뛰어서 (규정 위반 상태다)
          let cx2=(a.x-b.x)*PITCH_AR, cy2=a.y-b.y, cd=HYP(cx2,cy2);
          if(cd<ko){
            if(cd<1e-6){ cx2=-a.dir; cy2=0; cd=1; }
            tx=clamp01(b.x+(cx2/cd)*ko*1.05/PITCH_AR); ty=clamp01(b.y+(cy2/cd)*ko*1.05);
            spd=Math.max(spd, SPD.RUN*(cd<ko*0.5?1.25:1.0));
          }
        }
        /* 🚩 온사이드 유지 (제보: ST가 수비라인보다 앞에 박혀 멍때림) —
           의도 스팟은 라인을 지키지만 1.6초 캐시라, 수비 라인이 빠르게 올라오면 그 사이
           공격수가 라인 뒤에 남는다. 매 틱 「지금 라인」으로 목표를 당긴다.
           스루패스 추격(_chase)은 이 경로를 안 타므로 침투는 그대로 산다.
           공보다 뒤에 있으면 온사이드(규칙 그대로) — 공 위치까지는 허용한다. */
        if(key===this.possSide && a.slot!=="GK" && !b.setPiece && b.state!=="SHOT"){
          const r0=a.offRole;
          if(r0===OFF_ROLE.RUN||r0===OFF_ROLE.CHANNEL||r0===OFF_ROLE.INSIDE||
             r0===OFF_ROLE.FARPOST||r0===OFF_ROLE.THIRD||r0===OFF_ROLE.HALF){
            if(this._olAt!==this.t){ this._olAt=this.t; this._ol={}; }
            if(this._ol[key]===undefined)
              this._ol[key]=oppLineX(this.side(this.opp(key)), a.dir);
            const lx=this._ol[key];
            const mg=0.008+(1-(a.offTiming||0.6))*0.015;
            const cap = a.dir>0 ? Math.max(lx-mg, b.x) : Math.min(lx+mg, b.x);
            if(a.dir>0){ if(tx>cap) tx=cap; } else { if(tx<cap) tx=cap; }
            /* 이미 라인 뒤에 갇혀 있다면 어슬렁대지 않고 뛰어서 온사이드로 돌아온다 */
            const overNow = a.dir>0 ? (a.x-cap) : (cap-a.x);
            if(overNow>0.014) spd=Math.max(spd, SPD.RUN*1.05);
          }
        }
        mvMark(a,"7온사이드",tx,ty);
        /* ⚽ 흐른 공 즉시 반응 (제보 — "루즈볼·튕긴 롱패스가 뒷라인으로 가면 멈칫대다 뒤늦게 붙는다")
           예전엔 「내 뒤로 흐른 공」만, 그것도 26m 안에서만 회수했다. 그래서 옆이나 앞으로 튄 공,
           조금 먼 공은 아무도 임자가 없어 각자 수비 위치로 어슬렁대다 뒤늦게 반응했다.
           ─ 이제 방향을 가리지 않고 「양 팀 최근접 한 명씩」이 곧바로 낙하 예측점으로 달린다.
           ─ 목표는 스무딩(instant)을 건너뛴다 — 이게 멈칫거림의 진짜 원인이었다. */
        a._lbGo=false;
        if(b.state==="LOOSE" && a.slot!=="GK" && !b.setPiece && !b.celebrate){
          if(this._lbAt!==this.t){ this._lbAt=this.t; this._lbNear={}; }
          /* 👁️ 예측력 — 「공이 어디로 올지」는 능력이다.
             ⚠ 이 블록은 <b>전원에게 완벽한 예측</b>을 주고 있었다. 낙하 예측점을 참값으로 계산해
                가장 가까운 한 명을 뽑고, 그 사람은 정확히 그 지점으로 달렸다.
                예측력(ant) 20 인 선수와 5 인 선수가 같은 지점을 같은 정확도로 봤다.
                흐른 공은 경기당 수십 번 나오고 그때마다 소유권이 갈리는데,
                거기서 예측력·집중력이 아무 일도 안 하고 있었다.
             ─ 두 곳에 건다: ① 누가 반응하는가(읽는 눈이 나쁘면 늦게 알아챈 셈으로 친다)
                             ② 얼마나 앞을 보고 뛰는가(나쁘면 공이 <b>있는 자리</b>로 달린다) */
          if(this._lbNear[key]===undefined){
            /* 🏃‍♀️ 추격 유지 (제보 — 「수비수가 공을 쫓다가 중간에 머뭇거리거나 멈춘다. 루즈볼·스루패스에서」).
               실측: 루즈볼 스펠의 30~33%에서 지정 추격자가 도중에 교체됐고, 6~12%는 추격자가 공에서 2.5m+
               떨어진 채 감속·정지했다. 지정을 매 틱 「최근접」으로 다시 뽑아 두 명 사이를 오갔던 것 —
               깃발을 잃은 쪽은 역할 위치로 되돌아가며 눈에는 「포기」로 보인다.
               ① 직전 지정자는 유지 보너스(×0.78) — 명확히 더 가까운 동료가 나타나야 넘긴다.
               ② 스루볼을 쫓던 선수(_chase)는 공이 흘러도(PASS→LOOSE) 그 추격을 이어받는다(×0.80). */
            this._lbPrev=this._lbPrev||{};
            let bn=null, bd2=9, bant=0.6;
            for(const p2 of this.side(key)){
              if(p2.slot==="GK" || (p2._down||0)>this.t) continue;
              /* 공이 굴러가는 앞쪽을 보고 판단한다 — 지금 위치가 아니라 「닿을 수 있는 지점」 기준 */
              const px=clamp01(b.x+(b.vx||0)*0.6/PITCH_AR), py=clamp01(b.y+(b.vy||0)*0.6);
              const d2=HYP((p2.x-px)*PITCH_AR, p2.y-py);
              const _an=lbAnt(p2);
              /* 읽는 눈이 나쁘면 그만큼 「멀리 있는 셈」으로 친다 — 늦게 알아채니까.
                 0.15 → ×1.24 · 평균 → ×1.05 · 1.0 → ×0.90 */
              let eff=d2*(1.30-_an*0.40);
              if(this._lbPrev[key]===p2.id) eff*=0.78;
              if(p2._chase) eff*=0.80;
              if(eff<bd2){ bd2=eff; bn=p2.id; bant=_an; }
            }
            this._lbNear[key]={id:bn, d:bd2, ant:bant};
            this._lbPrev[key]=bn;
          }
          const nb=this._lbNear[key];
          if(nb && nb.id===a.id && nb.d<0.42){
            const lead=clamp(nb.d*1.8, 0.35, 0.9);      // 멀수록 더 앞을 보고 뛴다
            /* ⚠ 시도했다 되돌림(기록): 「상대가 다투러 오면 리드를 줄여 공 자체로 파고들기」 — 5m 게이트는 거의 안 걸렸고
               11m 게이트는 리드를 줄인 만큼 굴러가는 공 꽁무니를 쫓게 되어(요격 지점 선점 포기) 오히려 나빠졌다.
               요격 지점에 먼저 서서 기다리는 건 정상 플레이가 맞다 — 남겨진 「멈칫」의 주범은 지정 교체 요동이었고 그건 위에서 고쳤다. */
            /* 예측력이 낮으면 앞을 덜 본다 — 공이 「있는 자리」로 달려가 한 발 늦는다.
               0.15 → 리드의 54% · 평균 → 96% · 1.0 → 107% */
            const lk=0.45+(nb.ant!=null?nb.ant:0.6)*0.62;
            tx=clamp01(b.x+(b.vx||0)*lead*lk/PITCH_AR);
            ty=clamp01(b.y+(b.vy||0)*lead*lk);
            spd=Math.max(spd, SPD.SPRINT*1.05);
            a._lbGo=true;                                // 목표 스무딩을 건너뛴다
          }
        }
        mvMark(a,"6위치오차",tx,ty);   // 대기 역할이 아니면 0 — 평균이 정직하려면 분기 밖이어야 한다
        mvMark(a,"8흐른공",tx,ty);
        // 목표 위치 부드럽게 하기 —
        // 수비 목표는 볼 좌표에 직결돼 있어서, 공이 조금만 흔들려도 목표가 매 틱 위아래로 뒤집힌다.
        // 그대로 쫓으면 수비진 전체가 부들부들 떨며 복귀한다. 목표 자체를 천천히 따라가게 한다.
        // 다만 압박·추격·볼 소유자는 즉각 반응해야 하므로 필터를 걸지 않는다.
        const txPreShape=tx;
        // 포지션 규율 — 자기 자리에서 멀어질수록 목표를 앵커 쪽으로 되당긴다.
        // 이게 없으면 전원이 볼 근처로 흘러가 한 덩어리로 몰려다닌다.
        /* 🔁 오버랩·언더랩 중인 풀백·윙백은 규율 면제 — 실측(빌드 0230): OVERLAP 점유 16% 인데 윙어보다 앞인
           시간 1%. 오버랩 목표는 앵커에서 35~45m 인데 breakShape 완화 반경이 23.5m 라 78% 되당겨져
           최종 목표가 현재 위치 6m 앞에 그쳤다(윙어보다 24m 뒤). 뒷문은 10d 천장·fbRisk·반대쪽 하프라인
           규칙이 지키므로 여기서 또 당길 이유가 없다. */
        const _lapFree = (a.offRole===OFF_ROLE.OVERLAP||a.offRole===OFF_ROLE.UNDERLAP||(a.offRole===OFF_ROLE.BALANCE && a._fbSupport)) &&
                         (a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB"
                          || ((a.slot==="LCB"||a.slot==="RCB") && a._cb3));   // ↔️ 3백 2차 ③ — 드라이브 중인 CB 도
        /* 🏃 박스 마킹 밀착 — 진짜 원인은 여기였다 (단계별 목표 추적, 빌드 1600 작업 중):
           2역할 = 담당의 골사이드 8m 지점 → 9규율 = 22m(내 자리) — 담당이 파고드는데 규율이 앵커로 60~78% 되당겨
           마커가 제자리에 섰다. 바로 아래 주석은 「담당을 잡으러 가는 센터백은 규율을 느슨하게」라고 하지만 코드는
           _zoneMark(라인 CB 의 구역 담당)만 봤고, 정작 MARK 역할(_mark)은 예외가 없었다.
           ⚠ 1차: 속도 SPRINT(마커 거리 4.5 → 8.1m, 악화) · 2차: 스무딩·버팀 면제(7.7m) — 둘 다 원인이 아니었다(기록).
           ─ 담당이 우리 진영에 있는 MARK 는 규율 면제. 어디까지 따라가는가는 마크 후보 선정(거리·측면)이 이미 정한다. */
        const _own9=v=>a.dir>0?v:1-v;
        const _mkFree = (phase==="ATT" && (a._lavo || a._lavoWide))   // 🅛 라볼피아나 — 구조를 만드는 세 명은 앵커로 되당기지 않는다
          || phase==="DEF" && ((a.defRole===DEF_ROLE.MARK && !!a._mark && _own9(a._mark.x)<0.5)
          /* ⚽ SECOND 도 같은 병 — 낙하점(10~20m 밖)이 규율에 앵커로 되당겨져, 역할은 SECOND 인데 몸은 못 갔다
             (실측: 후보 확대로 박스 공중볼의 SECOND 점유 35 → 67% 가 됐는데 도착 순간 수비 거리는 3.8 → 3.9m 그대로). */
          || (a.defRole===DEF_ROLE.SECOND && _own9(ballLand(b, this.t).x)<0.4));
        if(!a._chase && !(carrier && a.id===carrier.id) && !pressers.includes(a) && !_lapFree && !_mkFree){
          const ax=(tx-anchor.x)*PITCH_AR, ay=ty-anchor.y;
          const ad=HYP(ax,ay);
          // 담당을 잡으러 가는 센터백은 규율을 느슨하게 — 안 그러면 "배정은 됐는데 안 붙는다".
          // (자리를 지키라고 앵커로 되당기면, 정작 잡아야 할 공격수는 그대로 free 가 된다)
          /* 침투·오버래핑·컷인은 "자리를 지키지 않는 것"이 목적인 움직임이다.
             여기서 앵커로 되당기면 역할만 배정되고 몸은 제자리에 남는다.
             (실측: 컷인 목표는 중앙 0.12 였는데 최종 목표가 0.41 로 되끌려 나갔다) */
          /* ⚠ WIDE·CHANNEL·THIRD·FARPOST·UNDERLAP 을 넣어 봤다가 <b>되돌렸다</b>(기록).
             「폭이 규율에 되당겨져 사라진다」는 가설이었는데 실측이 아니라고 했다 —
             좌우 폭 실제값이 47.6 → 47.4m 로 그대로였고, 골은 오히려 떨어졌다.
             진짜 원인은 되당김이 아니라 <b>애초에 바깥에 서려는 사람이 없다</b>는 것이었다:
               · 바깥 레인(|y−0.5|>0.30)에 서려는 의도 2.09명 → 실제 1.80명 (손실 0.3명뿐)
               · WIDE 역할 인원 <b>0.9명/팀</b> — 한 팀에 한 명도 안 된다
               · 그리고 그 한 명조차 자기 목표에서 <b>평균 17.3m</b> 떨어져 있다(도달 실패)
             즉 규율을 풀 게 아니라 ① 폭을 잡는 사람이 더 있어야 하고
                ② 그 사람이 목표에 도달할 수 있어야 한다. 목록을 넓히는 건 답이 아니었다. */
          const breakShape = a.offRole===OFF_ROLE.INSIDE || a.offRole===OFF_ROLE.OVERLAP
                          || a.offRole===OFF_ROLE.RUN;
          /* 🛡️ 「현재 위치를 고수」 — 이 선수는 애초에 자리를 뜨지 않는다.
             허용 반경을 좁히고 되당김을 강하게 걸어, 공이 어디로 가든 자기 구역에 남는다(제보). */
          const _stay=clamp(FX(a,"stayPos"), 0, 1.2);
          const soft = (a._zoneMark ? DISCIPLINE_SOFT*CB_MARK_LEASH
                     : breakShape ? DISCIPLINE_SOFT*3.2
                     : DISCIPLINE_SOFT) * (1 - _stay*0.42);
          if(ad>soft){
            // 팀워크가 낮으면 전술 자리를 덜 지키고 제멋대로 움직인다
            // 역할이 자유로울수록(레지스타·트레콰르티스타 등) 자리를 덜 지킨다
            const rm=clamp(1-((a.role&&a.role.roam)||0)*0.55, 0.25, 1.4);
            const tw=(0.60+(a.teamwork||0.6)*0.66)*rm*(1+_stay*0.55);
            const k=clamp((ad-soft)/0.16, 0, DISCIPLINE_MAX*tw*(phase==="DEF"?DEF_DISC:1));         // 최대 78% 되당김
            tx=tx-ax*k/PITCH_AR; ty=ty-ay*k;
          }
        }
        mvMark(a,"9규율",tx,ty);
        // 동료 간 간격 — 너무 붙어 있으면 목표를 서로 반대쪽으로 조금 민다.
        // 몸싸움(separateBodies)은 이미 겹친 뒤에 떼어놓는 것이고, 이건 애초에 겹치지 않게 하는 쪽이다.
        if(!a._chase && !(carrier && a.id===carrier.id)){
          let sx=0, sy=0;
          for(const q of mine){
            if(q===a || q.slot==="GK") continue;
            const dx2=(a.x-q.x)*PITCH_AR, dy2=a.y-q.y;
            const d2=HYP(dx2,dy2);
            if(d2>1e-6 && d2<SPACING_R){
              const w=(1-d2/SPACING_R);
              sx+=dx2/d2*w; sy+=dy2/d2*w;
            }
          }
          const sl=HYP(sx,sy);
          if(sl>1e-6){
            tx=clamp01(tx + sx/sl*SPACING_PUSH*Math.min(2,sl)/PITCH_AR);
            ty=clamp01(ty + sy/sl*SPACING_PUSH*Math.min(2,sl));
          }
        }
        /* 🧱 뒷선 바닥 — 풀백·윙백은 센터백 라인보다 뒤로 못 간다 (FB_BEHIND_MAX 주석).
           ⚠ 처음에는 이걸 트랩 바로 뒤(5b)에 두었다. 아무 효과가 없었다 —
              9단계 포지션 규율이 풀백을 <b>자기 앵커 쪽으로 되당기는데</b>, 그 앵커가
              센터백들의 실제 위치보다 평균 5.8m 뒤였다. 규율이 바닥을 그대로 지웠다.
              (실측: 5b 에 두었을 때 「센터백보다 뒤」 47.7% → 51.7% — 소수점만 움직였다)
              되당김 <b>뒤에</b> 걸어야 하는 제약이다.
           예외: 이미 라인 뒤로 넘어간 상대를 잡고 있으면 따라간다 — 그건 라인이 아니라 추격이다. */
        if(phase==="DEF" && a._cbLineOwn!=null &&
           (a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB")){
          const _o=v=>a.dir>0?v:1-v;
          let _floor=a._cbLineOwn-FB_BEHIND_MAX;
          if(a._mark && _o(a._mark.x) < a._cbLineOwn)
            _floor=Math.min(_floor, _o(a._mark.x)-0.020);
          /* 🧱 B-2 — 담당이 라인 위에 서 있을 때(오프사이드 라인에 맞춰 선 윙어) 바닥이 라인 1.1m 앞이라
             풀백이 담당의 골사이드에 설 수 없었다(실측 FB 골사이드 34%). 담당이 4.9m 안이면 담당보다
             1.3m 골 쪽까지는 허용한다 — 라인보다 최대 2.4m 뒤. 제보(「풀백이 처진다」)의 5~7m 와는 다른 크기다. */
          if(a._mark && HYP((a._mark.x-a.x)*PITCH_AR, a._mark.y-a.y)<0.070)
            _floor=Math.min(_floor, _o(a._mark.x)-0.012);
          if(_o(tx)<_floor){ const _f=clamp01(_floor); tx=clamp01(a.dir>0?_f:1-_f); }
          /* 🏃 라인 뒤에 있으면 걸어서 올라가지 않는다 — 목표만 올려 두고 조깅으로 두면
             영영 라인에 못 붙는다(제보: "여전히 풀백이 쳐져 있는데?").
             처져 있는 거리만큼 속도를 올린다. */
          const _lag=(_floor-_o(a.x))*ISO_TO_M*PITCH_AR;      // 미터, 양수면 라인 뒤
          if(_lag>2)      spd=Math.max(spd, SPD.RUN);
          if(_lag>6)      spd=Math.max(spd, SPD.SPRINT*0.94);
        }
        /* 🧱 10c 잔여 수비 — 우리 소유 중 센터백의 깊이 띠(천장+바닥). REST_CB_MAX 주석.
           ⚠ 2차 시도까지의 실패 기록: 바닥을 볼 상태(SETTLED/PASS)로 켜고 껐더니 목표가 흔들렸고,
              BALANCE 의 무거운 스무딩(POS_SMOOTH τ≈2.5초)이 그 평균(≈48m)에 눌러앉혔다(중앙값 45→48→42m).
           ─ 3차: 팀마다 <b>관성 잔여 라인</b>(_restLn)을 둔다. 목표선 = min(천장, 상대 최전방−여유)를 τ≈1.7초로
              따라가고, 볼이 상대 진영(0.55+)이면 이 선 −2.7m 가 바닥이 된다. 라인 자체가 매끄러우므로
              바닥에 밀려 올라가는 센터백은 스무딩을 건너뛴다(_restPush → instant). */
        if(phase==="ATT" && (a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB") &&
           !(carrier && a.id===carrier.id) && !a._chase && !b.setPiece &&
           !(a.offRole===OFF_ROLE.OVERLAP||a.offRole===OFF_ROLE.UNDERLAP)){   // ↔️ 3백 2차 ③ — 드라이브 동안 띠 면제
          const _o=v=>a.dir>0?v:1-v;
          this._restLn=this._restLn||{};
          if(this._restLnAt!==this.t+key){
            this._restLnAt=this.t+key;
            let _cap=REST_CB_MAX + clamp(T.mentality-1,-1,1)*0.03 + clamp(T.line-1,-1,1)*0.03;
            let _st=1, _stPace=0.6;
            for(const o of this.side(this.opp(key))){
              if(o.slot==="GK") continue;
              if(Math.abs(o.y-0.5)>0.28) continue;   // 3차: 측면에 남은 역습 요원은 같은 쪽 풀백의 일(10d) — 중앙 라인을 끌어내리지 않는다
              const oa=_o(o.x);
              if(oa<_st){ _st=oa; _stPace=(o.paceSkill||0.6); }
            }
            const _mg=REST_CB_MARGIN + clamp((_stPace-0.6)*0.10, 0, 0.03);
            const _want=Math.max(0.12, Math.min(_cap, _st-_mg));
            const _rl=this._restLn[key];
            this._restLn[key] = (_rl==null) ? _want : _rl + (_want-_rl)*0.18;   // τ≈1.1초 (3차: 0.12 → 0.18)
          }
          /* 🎭 CB 역할 점검 (제보 — 「센터백 역할들이 현 시스템에서 잘 작동하는지 봐줘」).
             A/B 실측: 와이드 센터백은 벌림이 실제로 늘지만(15.8 → 18.6m ✓), 리베로(fwd 0.34)는 잔여 라인
             천장이 모든 CB 를 같은 선에 눕혀 전진 성향이 통째로 죽었다(중앙 CB 58.3 vs 리베로 54.2 — 차이 없음).
             전진 성향(fwd)만큼 자기 천장을 넓힌다 — 리베로/스토퍼가 라인보다 한두 걸음 위에서 논다. */
          const RL=this._restLn[key] + clamp(FX(a,"fwd"), 0, 1)*0.09;
          a._restPush=false;
          /* ↔️ 3백 벌림 (WIDE3_MIN 주석) — 같은 쪽 측면 요원이 전진해 있으면 좌우 CB 가 벌린다 */
          if(a.slot!=="CB" && a.home && this.side(key).some(m=>m.slot==="CB")){
            const _sd3=(a.home.y<0.5)?-1:1;
            let _wUp=false;
            for(const m of this.side(key)){
              if(m===a||m.slot==="GK"||!m.home) continue;
              if(((m.home.y<0.5)?-1:1)!==_sd3) continue;
              if(!(m.slot==="LWB"||m.slot==="RWB"||m.slot==="LM"||m.slot==="RM"||m.slot==="LW"||m.slot==="RW"||m.slot==="LB"||m.slot==="RB")) continue;
              if((a.dir>0?m.x:1-m.x)>0.55){ _wUp=true; break; }
            }
            if(_wUp){
              const _w3=WIDE3_MIN + clamp(FX(a,"wide"), 0, 1)*0.07;   // ↔️ 2차 — 와이드 센터백은 더
              const _off=Math.abs(ty-0.5);
              if(_off<_w3) ty=clamp01(0.5+_sd3*(_off+(_w3-_off)*WIDE3_K));
            }
          }
          /* ⚠ 3차 1보: instant 를 바닥 클램프에만 걸었더니 대부분의 틱은 천장 클램프(역할 목표 61m → RL)라
             스무딩(τ2.5초)이 여전히 45m 에 눌러앉았다. 띠가 목표를 만졌으면(위든 아래든) 그대로 따라간다 — RL 이 이미 관성이다. */
          if(_o(tx)>RL+0.008){ const _c=clamp01(RL+0.008); tx=clamp01(a.dir>0?_c:1-_c); a._restPush=true; }
          if(_o(b.x)>0.55 && b.state!=="LOOSE"){
            const _flr=RL-REST_CB_FLOOR_SLACK;
            if(_o(tx)<_flr){ const _f=clamp01(_flr); tx=clamp01(a.dir>0?_f:1-_f); a._restPush=true; }
            if(_flr-_o(a.x)>0.027) spd=Math.max(spd, SPD.RUN);
          }
        }
        /* 🔁 10e 측면 미드필더 「볼 뒤」 — DEF · 의무 ≥ 0.5 · 압박/저지 제외. 셰이프·규율 뒤에 걸어야 남는다 (2b 주석) */
        if(phase==="DEF" && wmDuty(a)>=WM_DUTY_MIN && a.defRole!==DEF_ROLE.PRESS && a.defRole!==DEF_ROLE.JOCKEY && !b.setPiece){
          const _oB=v=>a.dir>0?v:1-v;
          const _cap=_oB(bR.x)-WM_BEHIND;
          if(_oB(tx)>_cap){ const _c=clamp01(Math.max(0.06,_cap)); tx=clamp01(a.dir>0?_c:1-_c);
            const _lagW=(_oB(a.x)-_cap)*ISO_TO_M*PITCH_AR; if(_lagW>6) spd=Math.max(spd, SPD.RUN); }
        }
        /* 🏃 10d 풀백 전진 천장 — 임무·성향별 상한, 위험하면 상대 윙어 + 여유, 반대쪽이 올라가 있으면 하프라인 (fbRisk 주석) */
        if(phase==="ATT" && (a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB") &&
           !(carrier && a.id===carrier.id) && !a._chase && !b.setPiece){
          const _o=v=>a.dir>0?v:1-v;
          const _wb=(a.slot==="LWB"||a.slot==="RWB");
          let _cap=(_wb?FB_ADV_WB:FB_ADV_BASE) + clamp(roleBias(a).fFwd,-0.5,0.5)*0.16 + clamp(T.mentality-1,-1,1)*0.03;
          const _lap=(a.offRole===OFF_ROLE.OVERLAP||a.offRole===OFF_ROLE.UNDERLAP);
          if(_lap) _cap=Math.max(_cap, 0.92);         // 🔁 오버랩·언더랩은 바이라인까지 — 절대 상한은 반대쪽 풀백이 진다
          /* ⚠ 처음엔 「위험 > 0.5 일 때만」 윙어 조건을 걸었다 — 위험은 윙어보다 9m 앞에 가서야 0.5 를 넘고,
             그때 2m 로 되당기니 앞뒤로 오갔다(실측: 윙어보다 앞 80 → 68%, 중앙값 +4m). 조건을 단순하게:
             커버가 없으면 윙어보다 FB_ADV_MARGIN 이상 앞으로 가지 않는다. 커버가 있으면 절대 천장만. */
          if(!_lap && a._fbWingAdv!=null && !a._fbCover) _cap=Math.min(_cap, a._fbWingAdv+FB_ADV_MARGIN);
          /* 양쪽 동시 전진 억제 — 반대쪽 풀백이 나보다 앞에서 이미 하프라인 위면 나는 하프라인까지 */
          if(!_lap) for(const m of mine){                               // 달리는 쪽이 아니라 남는 쪽이 진다
            if(m===a || !(m.slot==="LB"||m.slot==="RB"||m.slot==="LWB"||m.slot==="RWB")) continue;
            if((m.y-0.5)*(a.y-0.5) > 0) continue;                       // 같은 쪽(5백)은 무관
            if(_o(m.x)>0.55 && _o(m.x)>_o(a.x)+0.01) _cap=Math.min(_cap, FB_ADV_OTHER);
          }
          _cap=Math.max(0.12, _cap);
          if(_o(tx)>_cap){ const _c=clamp01(_cap); tx=clamp01(a.dir>0?_c:1-_c); }
        }
        mvMark(a,"10간격",tx,ty);
        // 라인 재확인 — 위의 규율/간격 보정이 목표를 앞으로 밀어 다시 오프사이드로 만들 수 있다.
        // 오프사이드 클램프는 반드시 마지막에 한 번 더 걸어야 한다.
        // 규율·간격 보정이 목표를 앞으로 밀어 위의 오프사이드 클램프를 무효화하지 않도록,
        // 공격 시에는 보정 전 위치보다 더 전진하지 못하게 막는다.
        /* 🧱 3차 — 잔여 라인에 밀려 올라간 센터백은 이 「전진 금지」 재확인의 예외다. 단계 추적으로 잡은 진범:
           띠가 34→53m 로 올려 놓은 목표를 이 줄이 txPreShape(규율 전 값 26m)로 도로 눌렀다. 이 재확인의 목적은
           오프사이드 클램프 보존인데, 하프라인 부근 센터백은 상대 라인에서 40m 밖이라 해당 없음. */
        if(phase==="ATT" && txPreShape!==undefined && !a._restPush)
          tx = a.dir>0 ? Math.min(tx, txPreShape) : Math.max(tx, txPreShape);
        // 골키퍼는 포메이션 규율·간격·오프사이드 클램프의 대상이 아니다.
        // (이게 없으면 앵커=골문에 묶여 스위퍼 키퍼가 박스 밖으로 나갈 수 없다)
        if(a.slot==="GK" && a._gkTx!==undefined){ tx=a._gkTx; ty=a._gkTy; }
        const instant = !!a._chase || !!b.setPiece || pressers.includes(a) || (carrier && a.id===carrier.id)
                      || a.slot==="GK" || !!a._lbGo    // 흐른 공을 쫓는 선수는 목표를 곧바로 따라간다
                      || _lapFree                      // 🔁 오버랩 중인 풀백도 — 스무딩이 달리기를 잘라먹지 않게
                      /* 🏃 박스 마킹 밀착 ⚠ 속도만 SPRINT 로 올린 1차 시도는 마커 거리 중앙값이 4.5 → 8.1m 로 오히려 나빠졌다.
                         원인은 속도가 아니라 <b>목표 스무딩(τ≈1.2초)과 버팀 반경(2.5m)</b> — 담당이 7m/s 로 뛰면 스무딩된
                         목표가 8m 뒤에 처진다. 뛰는 담당을 쫓는 마커는 즉시 반응·버팀 없음. */
                      || (phase==="DEF" && !!a._mkTrack)
                      || (phase==="DEF" && a.defRole===DEF_ROLE.SECOND)    // ⚽ 낙하점 선점도 — 스무딩이 비행 시간을 다 먹는다
                      || (phase==="ATT" && a._restPush);                   // 🧱 잔여 라인으로 밀려 올라가는 센터백 — 라인이 이미 관성이라 안전
        // 목표가 완전히 다른 곳으로 바뀌었으면(역할 전환 등) 질질 끌지 말고 바로 붙는다.
        // 그 외에는 저역통과로 따라가 앵커의 미세한 흔들림이 몸의 떨림으로 번지지 않게 한다.
        const jumped = a._smx!==undefined &&
          HYP((tx-a._smx)*PITCH_AR, ty-a._smy) > TARGET_JUMP;
        const _posRole = (phase==="DEF") ? !!DEF_POS_ROLES[a.defRole] : !!OFF_POS_ROLES[a.offRole];
        const _sm = _posRole ? (_dz ? TARGET_SMOOTH : POS_SMOOTH) : TARGET_SMOOTH;   // 🧭 자리 역할은 더 무겁게 · 🚨 위험 구역은 기본
        if(a._smx===undefined || instant || jumped){ a._smx=tx; a._smy=ty; }
        else { a._smx += (tx-a._smx)*_sm; a._smy += (ty-a._smy)*_sm; }
        a._posRole=_posRole;
        tx=a._smx; ty=a._smy;
        mvMark(a,"11스무딩",tx,ty);
        // 이동 — 선수는 자기가 "바라보는 방향"으로만 나아간다. 목표가 옆이나 뒤면 먼저 몸을 돌려야 하고,
        // 돌아가는 동안에는 속도가 떨어진다. 그래서 방향 전환이 즉각적이지 않고 곡선을 그린다.
        const ox=a.x, oy=a.y;
        const mx=(tx-a.x)*PITCH_AR, my=ty-a.y, ml=HYP(mx,my);
        /* ⚽ 패스를 받는 선수는 공이 오는 쪽으로 몸을 연다 — 이동 방향과 별개로 시선을 고정한다.
           (제보 — 이게 없어서 절반 이상이 등지고 받는 판정이었다)
           예외: 등 뒤 공간으로 찔러 주는 스루패스는 흐름대로 뛰면서 받는다. */
        let _recvFace=null;
        if(b.state==="PASS" && b.toId===a.id && a.slot!=="GK" && !b.isThrow){
          const fb=receivingOrientation(a, b, this.side(this.opp(a.side)), a.dir);
          const runDir = ml>1e-6 ? Math.atan2(my, mx) : fb;
          let dfb=fb-runDir;
          while(dfb>Math.PI) dfb-=Math.PI*2; while(dfb<-Math.PI) dfb+=Math.PI*2;
          /* 뒤에서 오는 공을 향해 앞으로 전력질주 중이면 스루패스 — 돌지 않는다 */
          const through = Math.abs(dfb)>Math.PI*0.70 && (a.spd||0)>0.16 && !!b._through;
          if(!through) _recvFace=fb;
        }
        if(a.slot==="GK"){
          // 골키퍼는 시선과 발이 따로 논다. 볼을 계속 마주 본 채로 옆·뒤로 스텝을 밟는다.
          // 단, 멀리 스위핑을 나갈 때는 실제로도 몸을 돌려 전력질주한다.
          const faceBall = Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR);
          const runDir   = ml>1e-6 ? Math.atan2(my, mx) : faceBall;
          // 볼 쪽으로 달릴 때는 금방 몸을 돌리지만, 볼을 등지고 물러설 때는
          // 어지간히 멀지 않으면 계속 볼을 보며 백페달한다. 이게 "등지고 서 있는" 장면을 없앤다.
          let dfb=runDir-faceBall;
          while(dfb>Math.PI) dfb-=Math.PI*2; while(dfb<-Math.PI) dfb+=Math.PI*2;
          const towardBall = Math.abs(dfb) < Math.PI/2;
          const far = ml > GK_TURN_DIST*(towardBall ? 1 : 2.4);
          turnToward(a, far ? runDir : faceBall, 1.2);   // 키퍼도 한 틱에 홱 돌지 않는다
          if(ml>TARGET_DEAD){
            // 옆·뒤로 움직일 때는 정면으로 달릴 때보다 느리다 (사이드스텝/백페달)
            const sidePen = far ? 1 : (1 - Math.min(0.42, Math.abs(dfb)/Math.PI*0.55));
            const wantSpd=spd*sidePen*clamp(ml/ARRIVE_R, ARRIVE_MIN, 1);
            const acc=ACCEL_BASE*accMul(a);
            const lim=(wantSpd>(a.spd||0)) ? acc*SIM_DT : acc*DECEL_MUL*SIM_DT;
            a.spd=(a.spd||0)+clamp(wantSpd-(a.spd||0), -lim, lim);
            const step=Math.min(ml, a.spd*SIM_DT);
            a.x=clampPx(a.x+Math.cos(runDir)*step/PITCH_AR);
            a.y=clampPy(a.y+Math.sin(runDir)*step);
          } else a.spd=Math.max(0, (a.spd||0)-ACCEL_BASE*DECEL_MUL*SIM_DT);
          a.vx=a.x-ox; a.vy=a.y-oy;
          continue;
        }
        /* 🎯 패스 수신 — 전술 자리 대신 "공을 받을 지점"으로 이동 의지만큼 끌어온다.
           의지가 낮으면(짧은 패스·압박 없음) 거의 제자리에서 기다린다. */
        if(b.state==="PASS" && b.toId===a.id && a.slot!=="GK" && !a._chase){
          try{
            const rt=calcReceiveTarget(a, b, this.side(this.opp(a.side)), mine);
            if(rt){
              a._rcv=rt;
              /* 전술 방향을 완전히 버리지 않는다 — 현재 목표와 받을 지점을 의지만큼 섞는다 */
              const w=clamp(rt.intent, 0, 1);
              tx=lerp(tx, rt.x, w); ty=lerp(ty, rt.y, w);
            }
          }catch(e){}
        } else if(a._rcv && !(b.state==="PASS" && b.toId===a.id)) a._rcv=null;
        a._tx=tx; a._ty=ty;
        // 이미 자리를 잡았다면 목표가 조금 움직여도 버틴다 (제자리 회전 방지)
        /* ⚠ 버팀 반경을 6m 로 넓히자 <b>볼 소유자</b>까지 버텼다 — 드리블 목표(2~5m 앞)가 반경 안이라 발을 멈추고,
           매 판단마다 「운반」을 고르고 또 멈추는 무한 고리(실측 seed 1: 10~50분 동안 패스 0, 한 선수가 40분 소유).
           볼 소유자·추격·압박·즉시 반응(instant)은 버팀 대상이 아니다. */
        const _holdR = (instant || (b.state==="PASS" && b.toId===a.id)) ? 0
                     : (a._posRole ? (_dz ? POS_HOLD_DZ : POS_HOLD) : (_dz ? TARGET_HOLD*0.7 : TARGET_HOLD));   // 수신자도 버티지 않는다 · 🚨 위험 구역은 좁게
        if(a._settled && !(carrier && a.id===carrier.id) && ml<=_holdR){   // 🧭 자리 역할은 넓게 버틴다
          a.spd=Math.max(0, (a.spd||0)-ACCEL_BASE*DECEL_MUL*SIM_DT);
          /* 🧍 ③ 버티는 동안에도 몸은 공 쪽으로 연다 — 예전엔 face 가 마지막 이동 방향(가끔 뒤돌아선 채)으로 굳었다 */
          if(!b.setPiece){
            const _bd3=HYP((b.x-a.x)*PITCH_AR, b.y-a.y);
            if(_bd3<=BACKPEDAL_SEE) turnToward(a, Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR), 0.7);
          }
          a.vx=a.x-ox; a.vy=a.y-oy;
          continue;
        }
        a._settled = (ml<=(a._posRole ? POS_SETTLE : TARGET_DEAD));   // 🚶 자리 역할은 3m 안이면 「도착」 — 그 뒤 POS_HOLD 안에서 버틴다
        // 도착 — 속도를 0으로 내리치지 않고 감속으로 죽인다 (급정거처럼 보이지 않게)
        if(ml<=TARGET_DEAD){
          const dec=ACCEL_BASE*DECEL_MUL*SIM_DT;
          a.spd=Math.max(0, (a.spd||0)-dec);
          if(_recvFace!==null){       // 제자리에서 기다리는 선수 — 몸을 열어 공을 마주 본다
            if(a.face===undefined) a.face=_recvFace;
            let df=_recvFace-a.face;
            while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
            const mt=TURN_RATE*SIM_DT*(1.15+(a.agility||0.6)*0.98);
            a.face += clamp(df, -mt, mt);
            if(a.face>Math.PI) a.face-=Math.PI*2; else if(a.face<-Math.PI) a.face+=Math.PI*2;
          }
          else if(!b.setPiece && !(carrier && a.id===carrier.id)){   // 🧍 ③ 서 있는 선수 — 천천히 공을 마주 본다
            const _bd2=HYP((b.x-a.x)*PITCH_AR, b.y-a.y);
            if(_bd2<=BACKPEDAL_SEE) turnToward(a, Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR), 0.7);
          }
        }
        if(ml>TARGET_DEAD){          // 코앞이면 굳이 움직이지 않는다 (제자리 떨림 방지)
          const want=Math.atan2(my, mx);
          if(a.face===undefined) a.face=want;
          /* 🏃‍♂️ 백페달 판정 — 수비하는 쪽이 공을 마주 본 채 뒤·옆으로 물러서는가 (요청).
             ① 우리가 수비 중이고 ② 공이 시야권 안이며 ③ 물러설 거리가 짧고
             ④ 가려는 방향이 공에서 충분히 벗어나 있으면, 몸은 공을 향하고 발만 목표로 간다. */
          let _bpAng=0;
          if(_recvFace===null && !b.setPiece && !a._chase && !(carrier && a.id===carrier.id)){   // 🧍 ② 공격 국면에도 — 반걸음 물러설 때 몸을 통째로 돌리지 않는다
            const _bd=HYP((b.x-a.x)*PITCH_AR, b.y-a.y);
            if(_bd<=BACKPEDAL_SEE && ml<=BACKPEDAL_MAX){
              const _fb=Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR);
              let _d2=want-_fb;
              while(_d2>Math.PI) _d2-=Math.PI*2; while(_d2<-Math.PI) _d2+=Math.PI*2;
              if(Math.abs(_d2)>Math.PI*BACKPEDAL_ANG){ _bpAng=Math.abs(_d2); a._bpFace=_fb; }
            }
          }
          let df;
          /* 🧤 킥 회전 예약(_kickFace)이 있으면 이동 방향 회전은 양보한다 — 판단 추적으로 잡은 「우물쭈물」의 뿌리:
             rollBall 이 킥 방향으로 돌려 놓은 몸을 이 블록이 매 틱 이동 방향으로 되돌려, 패스 각(1.05rad)에
             영영 못 들어가고 6초 규정 강제 걷어내기(경기당 63회)로 끝났다. */
          /* ⚠ 1차 수리 사고 — _kickFace 는 rollBall(볼 소유자 전용)에서만 지워진다. 패스하고 나면 깃발이 영영 남아
             모든 필드 플레이어의 이동 회전이 얼어붙었다(실측: 이동거리 20km, 패스 성공 절반, 태클 급감).
             여기서 유효성(소유·시한)을 직접 확인하고 낡은 깃발은 지운다. */
          if(a._kickFace && (a._kickFace.until<this.t || b.ownerId!==a.id)) a._kickFace=null;
          if(a._kickFace){
            df=0; a._bp=0;
          } else if(_bpAng){
            /* 몸은 공 쪽으로만 돈다 — 목표 방향으로는 돌지 않는다(그래서 뒤로 걷는 그림이 된다) */
            df=turnToward(a, a._bpFace, 1.15);
            a._bp=1;
          } else {
            a._bp=0;
            df=want-a.face;
            while(df>Math.PI) df-=Math.PI*2;
            while(df<-Math.PI) df+=Math.PI*2;
            // 방향 전환은 주력이 아니라 민첩성이 가른다. 발이 빠른 선수가 반드시
            // 몸을 잘 돌리는 것은 아니다 — 볼 잡은 선수 쪽과 같은 기준으로 맞춘다.
            const maxTurn=TURN_RATE*SIM_DT*(0.60+(a.agility||0.6)*0.80);
            a.face += clamp(df, -maxTurn, maxTurn);
            if(a.face>Math.PI) a.face-=Math.PI*2; else if(a.face<-Math.PI) a.face+=Math.PI*2;
          }
          if(_recvFace!==null){        // 수신 중 — 시선은 공에 둔다 (몸은 목표 지점으로 계속 움직인다)
            let dr=_recvFace-a.face;
            while(dr>Math.PI) dr-=Math.PI*2; while(dr<-Math.PI) dr+=Math.PI*2;
            const mt2=TURN_RATE*SIM_DT*(0.98+(a.agility||0.6)*0.89);
            a.face += clamp(dr, -mt2, mt2);
            if(a.face>Math.PI) a.face-=Math.PI*2; else if(a.face<-Math.PI) a.face+=Math.PI*2;
            /* ⚠ 제보 — 회전하면서 그대로 달려 나가니 부자연스럽다.
               몸을 트는 동안에는 발이 멈춘다. 많이 돌수록 크게 선다. */
            a._turning=Math.abs(dr);
          }
          // 몸이 덜 돌아간 만큼 속도가 준다 — 뒤로 꺾을수록 크게 느려진다
          /* 🏃‍♂️ 백페달은 「덜 돌아서」 느린 게 아니라 「뒤로 걸어서」 느리다.
             사이드스텝은 정면의 약 80%, 완전한 백페달은 약 55%다 (실제 스프린트 대비). */
          let turnPen = _bpAng ? (1 - Math.min(0.32, _bpAng/Math.PI*BACKPEDAL_PEN))
                               : (1 - Math.min(0.78, Math.abs(df)/Math.PI*1.25));
          /* 🌨️ 미끄러운 잔디 — 속도를 붙인 채 크게 꺾으면 발이 밀린다 (요청).
             균형(bal)·민첩이 좋은 선수는 버틴다. 넘어지면 잠깐 못 일어난다. */
          if((WX_NOW.slip||0)>0.18 && !_bpAng && Math.abs(df)>Math.PI*0.42
             && (a.spd||0)>SPD.RUN*0.75 && !(a._down&&a._down>this.t)){
            const bal=(a.p&&a.p.attr&&attr20(a.p.attr.bal)/20)||0.6;
            const pSlip=WX_NOW.slip*0.011*(1.35-bal*0.70)*(Math.abs(df)/Math.PI);
            if(Math.random()<pSlip){
              a._down=this.t+0.55+Math.random()*0.45; a.spd=0;
              if(this.emitEvents && Math.random()<0.22)
                this.cap(a.side, ["🌨️ {p}, 젖은 잔디에 미끄러집니다","🌨️ {p}이/가 중심을 잃고 넘어집니다"], {p:this.nm(a)});
            }
          }
          /* 공을 받으려고 몸을 트는 중에는 거의 멈춘다 — 돌면서 달리지 않는다 */
          if(a._turning!==undefined && a._turning>0.25)
            turnPen *= 1 - Math.min(0.82, (a._turning-0.25)/Math.PI*1.5);
          a._turning=undefined;
          // 가속 — 정지 상태에서 최고 속도까지 시간이 걸리고, 멈출 때는 더 빨리 선다.
          // 이게 없으면 모든 선수가 매 틱 최고 속도로 튀어나가 움직임이 기계적으로 보인다.
          // 목표에 가까워질수록 목표 속도 자체를 낮춘다 — 오버슈트도, 급정거도 없어진다.
          // 공·상대를 쫓는 동작(SPRINT 이상)은 실제로도 끝까지 밀어붙이므로 덜 깎는다.
          const chasing = spd>=SPD.RUN;
          const arriveK = chasing ? 1 : clamp(ml/ARRIVE_R, ARRIVE_MIN, 1);
          const wantSpd=spd*turnPen*arriveK;
          // 외야 선수의 주 이동 경로. 여기만 옛 paceSkill 식(0.75~1.25)이 남아 있어서
          // 가속도 능력치의 폭이 절반밖에 반영되지 않았다 — accMul(0.62~1.52)로 통일한다.
          const acc=ACCEL_BASE*accMul(a);
          const lim=(wantSpd>(a.spd||0)) ? acc*SIM_DT : acc*DECEL_MUL*SIM_DT;
          a.spd = (a.spd||0) + clamp(wantSpd-(a.spd||0), -lim, lim);
          const step=Math.min(ml, a.spd*SIM_DT);
          /* 백페달 중에는 시선(face)과 발이 따로 논다 — 발은 목표(want) 쪽으로 간다 */
          const _mv=_bpAng ? want : a.face;
          a.x=clampPx(a.x+Math.cos(_mv)*step/PITCH_AR);
          a.y=clampPy(a.y+Math.sin(_mv)*step);
        }
        a.vx=a.x-ox; a.vy=a.y-oy;
      }
    }
    /* 공을 잡은 키퍼는 제자리 — 위에서 찍어 둔 좌표로 되돌린다 */
    if(carrier && carrier.slot==="GK" && carrier._gkFreeze){
      carrier.x=carrier._gkFreeze.x; carrier.y=carrier._gkFreeze.y; carrier.spd=0;
    }
    /* 🧤 공을 통제 중인 키퍼에게 붙어 선 상대를 규정 거리 밖으로 물러나게 한다.
       ⚠ 제보 — 놓고 차려는 순간 옆에 서 있던 공격수가 그대로 낚아채 골이 됐다.
         실제 규칙상 이 상황에서 상대는 방해할 수 없다. 애초에 그 자리에 서 있지 못하게 한다. */
    try{
      const gk=this._gkGuard;
      if(gk){
        const R=GK_KEEP_M/ISO_TO_M;
        for(const o of this.side(this.opp(gk.side))){
          if(o.slot==="GK") continue;
          let dx=(o.x-gk.x)*PITCH_AR, dy=o.y-gk.y;
          let d=HYP(dx,dy);
          if(d>=R) continue;
          if(d<1e-5){ dx=(o.dir||1)*1; dy=0.2; d=HYP(dx,dy); }
          const push=(R-d)/d;
          o.x=clampPx(o.x+dx*push/PITCH_AR); o.y=clampPy(o.y+dy*push);
          o.vx=0; o.vy=0; o.spd=Math.min(o.spd||0, SPD.JOG*0.5);
        }
      }
    }catch(e){}
    this.separateBodies();     // 모두 움직인 뒤 겹친 몸을 떼어놓는다
  }
  /* 드리블 중인 공 — 발에 붙어 있지 않다.
     선수는 몇 걸음마다 공을 앞으로 툭 차 놓고, 공은 마찰로 느려지며 굴러가고, 선수가 따라붙는다.
     그래서 공은 늘 선수보다 진행 방향 쪽으로 조금 앞서 있고, 멈춰 서면 발밑으로 돌아온다. */
  rollBall(carrier){
    const b=this.ball;
    /* 🧤 키퍼는 공을 잡으면 그 자리에서 처리한다 — 옆으로 몰고 다니지 않는다(제보).
       발밑에 붙여 두기만 하고, 드리블 터치·치달 판정은 아예 거치지 않는다. */
    if(carrier.slot==="GK"){
      /* 🧤 진범 (제보 「키퍼 실수로 골 먹힌다」 판단 추적) — 이 조기 return 이 아래의 킥 방향 회전(_kickFace)을
         건너뛰어, 키퍼는 60° 밖의 동료 쪽으로 몸을 <b>영영 못 돌렸다</b>. 매 판단이 「몸 돌리는 중」(505회/경기)으로
         끝나고 6초 규정 강제 걷어내기(63회, 상실 66%)로 이어진 것. 키퍼도 킥 회전은 한다. */
      if(carrier._kickFace){
        if(this.t>carrier._kickFace.until || b.ownerId!==carrier.id) carrier._kickFace=null;
        else if(carrier.face!==undefined){
          let _df9=carrier._kickFace.ang-carrier.face;
          while(_df9>Math.PI) _df9-=Math.PI*2; while(_df9<-Math.PI) _df9+=Math.PI*2;
          const _mt9=TURN_RATE*SIM_DT*(1.0+(carrier.agility||0.6)*0.9);
          carrier.face+=clamp(_df9,-_mt9,_mt9);
          if(carrier.face>Math.PI) carrier.face-=Math.PI*2; else if(carrier.face<-Math.PI) carrier.face+=Math.PI*2;
          if(Math.abs(_df9)<0.15) carrier._kickFace=null;
        }
      }
      /* 공은 몸 앞(시선 방향 60cm)에 둔다 — 뒤나 옆에 붙어 다니지 않게 */
      let tx=carrier.x, ty=carrier.y;
      if(carrier.face!==undefined){
        const ah=0.60/ISO_TO_M;
        tx=carrier.x+Math.cos(carrier.face)*ah/PITCH_AR;
        ty=carrier.y+Math.sin(carrier.face)*ah;
      }
      const _gx=(tx-b.x)*PITCH_AR, _gy=ty-b.y;
      const _gd=HYP(_gx,_gy);
      if(_gd>1e-6){
        const step=Math.min(_gd, SPD.RUN*SIM_DT);
        b.x=clamp01(b.x+(_gx/_gd)*step/PITCH_AR); b.y=clamp01(b.y+(_gy/_gd)*step);
      }
      b.ex=0; b.ey=0; b._knock=null;
      if(carrier.face!==undefined) b._loc=ballToLocal(b, carrier);
      return;
    }
    /* 🛑 정리(settle) — 공이 시선 뒤로 넘어갔다. 확실하게 멈춰 서서 화살표 앞에 놓는다.
       여기 걸리면 아래의 로컬 오프셋 추종·드리블 터치·따라가기를 전부 건너뛴다. */
    if(carrier.face!==undefined && b.ownerId===carrier.id){
      const _lc=ballToLocal(b, carrier);
      const _rd=HYP(_lc.fwd, _lc.lat);
      /* 중간에 공이 발을 떠났다가(패스·경합·슛) 돌아온 경우 — 그때 걸어 둔 정리는 이미 옛일이다.
         이 함수는 공이 발밑에 있을 때만 불리므로, 한동안 안 불렸으면 세션을 닫는다.
         (실측 — 31초 묵은 정리 상태가 그대로 되살아나 선수를 붙들고 있었다) */
      if(carrier._settleT!=null && this.t-carrier._settleT>0.45){ carrier._settle=null; carrier._settleOff=0; }
      carrier._settleT=this.t;
      if(_rd>=SETTLE_REACH){ carrier._settle=null; }        // 발이 닿지 않는다 — 정리가 아니라 재추격
      else if(!carrier._settle){
        /* 방금 정리를 마쳤으면 잠시 쉰다 — 안 그러면 「돌면 해제, 다시 돌면 진입」이 반복된다 */
        if(_lc.fwd<SETTLE_IN && !(carrier._settleOff>this.t)) carrier._settle=this.t;
      } else {
        const held=this.t-carrier._settle;
        if(held>=SETTLE_MIN && (_lc.fwd>SETTLE_OUT || held>SETTLE_MAX)){
          carrier._settle=null; carrier._settleOff=this.t+SETTLE_COOL;
        }
      }
      if(carrier._settle){
        carrier._setBall=this.t;                            // 이동 로직에 「그 자리에 서라」
        /* 몸을 공 쪽으로 돌린다 — 다 돌면 공은 정의상 화살표 앞에 있다 */
        turnToward(carrier, Math.atan2(b.y-carrier.y, (b.x-carrier.x)*PITCH_AR), 1.45);
        /* 공은 시선 앞 한 발(0.8m)로만 온다. 사람이 발을 뻗는 속도를 넘지 않는다 */
        const _ah=0.80/ISO_TO_M;
        const _tx=carrier.x+Math.cos(carrier.face)*_ah/PITCH_AR;
        const _ty=carrier.y+Math.sin(carrier.face)*_ah;
        const _gx=(_tx-b.x)*PITCH_AR, _gy=_ty-b.y, _gd=HYP(_gx,_gy);
        if(_gd>1e-6){
          const _st=Math.min(_gd, (SETTLE_PULL*SIM_DT)/ISO_TO_M);
          b.x=clamp01(b.x+(_gx/_gd)*_st/PITCH_AR); b.y=clamp01(b.y+(_gy/_gd)*_st);
        }
        b.ex=0; b.ey=0; b._knock=null; b._touchAt=this.t;
        b._loc=ballToLocal(b, carrier);
        return;
      }
    } else carrier._settle=null;
    /* 🧱 이 함수(드리블 처리)에서 공이 한 틱에 옮겨질 수 있는 최대 거리를 재기 위한 기준점.
       몸 회전 추종·발밑 정리·통제 범위 당김이 겹치면 한 틱에 2~5m를 건너뛰어
       「선수도 없는데 거울에 반사된 듯 튕기는」 움직임으로 보였다(제보·실측). */
    const _bx0=b.x, _by0=b.y;
    /* 👀 킥 방향으로 몸 돌리기 — lookThenPass가 예약한 회전 */
    if(carrier._kickFace){
      if(this.t>carrier._kickFace.until || b.ownerId!==carrier.id) carrier._kickFace=null;
      else if(carrier.face!==undefined){
        let df=carrier._kickFace.ang-carrier.face;
        while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
        const mt=TURN_RATE*SIM_DT*(1.0+(carrier.agility||0.6)*0.9);
        carrier.face+=clamp(df,-mt,mt);
        if(carrier.face>Math.PI) carrier.face-=Math.PI*2; else if(carrier.face<-Math.PI) carrier.face+=Math.PI*2;
        if(Math.abs(df)<0.15) carrier._kickFace=null;   // 다 돌았다 — 다음 판단에서 찬다
      }
    }
    if(b._rollOwner!==carrier.id){          // 방금 공을 받았다
      b._rollOwner=carrier.id; b._touchAt=this.t-DRIB_TOUCH;
      carrier._settle=null;                 // 새로 잡은 공 — 정리 상태는 다시 판정한다
      b.ex=0; b.ey=0;                       // 위치는 건드리지 않는다 — 아래에서 천천히 끌어온다
      b._loc=(carrier.face!==undefined) ? ballToLocal(b, carrier) : null;   // 받은 순간의 상대 위치
    }
    /* 🧭 로컬 오프셋 유지 — 몸이 돌면 공은 자동으로 같은 호를 그린다.
       공의 월드 위치를 직접 옮기지 않고, "선수 기준 어디에 있는가"를 들고 다닌다. */
    if(carrier.face!==undefined){
      const nowLoc=ballToLocal(b, carrier);
      const rd=HYP(nowLoc.fwd, nowLoc.lat);
      /* ⚠ 뒤에 있는 공은 이 프레임을 타지 않는다 — 여기가 염력의 본체였다 */
      if(b._loc && rd<CARRY_REACH){
        /* 발에 붙어 있는 공만 몸을 따라 돈다. 멀리 굴러간 공은 관성으로 남는다 —
           그래서 로컬 오프셋을 그대로 쓰지 않고 현재 실제 위치와 섞는다. */
        const grip=clamp(1-rd/(DRIB_LEAD*2.6), 0.25, 1);
        const keep={fwd: lerp(nowLoc.fwd, b._loc.fwd, grip),
                    lat: lerp(nowLoc.lat, b._loc.lat, grip)};
        /* 🎯 공은 서서히 발 앞(시선 화살표)으로 모인다 — 옆·뒤에서 받은 공도 몸을 돌리면
           앞으로 따라온다. 완벽히 붙진 않는다 — 틱당 6%씩, 자연스러운 정리 속도다. */
        /* 👀 시선 전환 중(패스 전 몸 돌리기)에는 공을 더 빠르게 시선 앞으로 데려온다 —
           발끝으로 공을 굴리며 도는 그림. 평상시엔 틱당 6%, 회전 중엔 22%. */
        /* ⚠ 제보 — 「드리블할 때 공이 선수에게 질질 끌려간다. 공이 앞에 있어야 하는데」.
           예전에는 받은 순간의 상대 위치를 거의 그대로 들고 다니면서(옆 정리 틱당 6%),
           목표 전진 거리도 0.6m로 고정이라 옆·뒤에서 받은 공이 계속 몸에 붙어 다녔다.
           ─ 지금 속도에 맞는 「발 앞 리드 거리」를 목표로 잡고, 옆으로 벌어진 공은 빠르게 정리한다. */
        const gather = carrier._kickFace ? 0.69 : 0.79;
        keep.lat*=gather;
        {
          const _spD=clamp(HYP((carrier.vx||0)*PITCH_AR, carrier.vy||0)/(SPD.SPRINT*SIM_DT), 0, 1.15);
          const _wantFwd=clamp((0.40+_spD*0.95)*(1.28-(carrier.dribSkill||0.6)*0.42)/67,
                               DRIB_LEAD*0.30, DRIB_LEAD*0.90);
          /* 공이 몸 뒤로 넘어가 있으면(음수) 가장 급하다 — 발끝으로 끌어 앞으로 돌려놓는다 */
          /* 차려는데 공이 뒤에 있어 못 차고 기다리는 중이면 더 급하게 발 앞으로 끌어온다 */
          const _wait = carrier._needBall && (this.t-carrier._needBall)<1.2;
          /* 🛑 「멈춰서 공을 앞에 놓는 중」이면 가장 급하게 끌어온다 — 걸음을 줄인 값어치를 한다 */
          const _set  = carrier._setBall && (this.t-carrier._setBall)<1.0;
          const _gain = _set ? 0.70 : (_wait ? 0.62 : (keep.fwd<0 ? 0.48 : (carrier._kickFace?0.35:0.32)));
          if(keep.fwd<_wantFwd) keep.fwd += (_wantFwd-keep.fwd)*_gain;
        }
        const w=localToWorld(keep, carrier);
        /* ⚠ 제보 — "선수도 없는데 공이 거울에 반사되듯 튕겨 다른 방향으로 간다".
           몸이 홱 돌면 로컬 오프셋이 그대로 회전해, 4~5m 떨어져 있던 공이 한 틱에
           그 반경만큼 호를 그리며 날아갔다(실측 한 틱 5.1m 이동 후 역방향).
           ─ 공이 한 틱에 옮겨질 수 있는 거리를 발이 닿는 범위로 제한한다. */
        const _mx=(w.x-b.x)*PITCH_AR, _my=w.y-b.y;
        const _mm=HYP(_mx,_my)*ISO_TO_M;
        const _cap=0.55;                       // 한 틱(0.2초)에 공을 옮길 수 있는 최대치 ≈ 2.7m/s
        if(_mm>_cap){
          const _k=(_cap/ISO_TO_M)/Math.max(1e-6, HYP(_mx,_my));
          b.x=clamp01(b.x+_mx*_k/PITCH_AR); b.y=clamp01(b.y+_my*_k);
          b._loc=ballToLocal(b, carrier);      // 실제로 간 만큼만 로컬에 반영
        } else {
          b.x=w.x; b.y=w.y;
          b._loc=keep;
        }
      } else {
        b._loc={fwd:nowLoc.fwd, lat:nowLoc.lat};
      }
    }
    const vx=carrier.vx||0, vy=carrier.vy||0;
    const sp=HYP(vx*PITCH_AR, vy);
    /* 🎯 지금 속도에서 공을 두어야 할 거리 (스펙 §15) */
    /* ⚠ vx,vy 는 "틱당 변위"이고 SPD.SPRINT 는 "초당 속도"다 — SIM_DT 를 곱해 단위를 맞춘다.
       이걸 빠뜨려서 속도 판정이 늘 0에 가깝게 나왔다. */
    const _spN=clamp(sp/(SPD.SPRINT*SIM_DT), 0, 1.15);
    const _wantM=(0.40 + _spN*0.95) * (1.28-(carrier.dribSkill||0.6)*0.42);
    const wantLead=clamp(_wantM/67, DRIB_LEAD*0.18, DRIB_LEAD*0.90);
    // 공은 기본적으로 선수와 같은 속도로 함께 나아간다(vx,vy). 여기에 툭 찬 "여분의 속도"(ex,ey)가
    // 얹혀 공을 앞으로 밀어내고, 그 여분만 마찰로 줄어든다. 그래서 공은 늘 진행 방향 앞쪽에 있게 된다.
    /* ⚽ 터치 이벤트 — 매 프레임 공을 붙이는 게 아니라, 간격마다 한 번씩 "찬다" */
    if(sp>1e-5 && this.t-b._touchAt >= (b._touchIv||DRIB_TOUCH)){
      const D=decideDribble(carrier, b, this.side(this.opp(carrier.side)), this.t);
      b._drb=D; b._touchAt=this.t; b._touchIv=D.iv;
      if(D.state!==carrier._drbState && (D.state===DRB.KNOCK||D.state===DRB.PROTECT||D.state===DRB.FAST))
        this.evl("DRIBBLE", carrier, {ds:D.state});
      carrier._drbState=D.state;
      const dx=(b.x-carrier.x)*PITCH_AR, dy=b.y-carrier.y;
      const cur=(dx*Math.cos(D.ang)+dy*Math.sin(D.ang));               // 터치 방향으로 이미 앞선 거리
      const targetLead=D.distM/67;
      const push=Math.max(0, targetLead-cur)*(1-BALL_ROLL_FRICTION);
      b.ex=Math.cos(D.ang)*push/PITCH_AR; b.ey=Math.sin(D.ang)*push;
      if(D.state===DRB.KNOCK){
        carrier._knockAt=this.t;
        b._knock={at:this.t, dist:D.distM};
        /* 치달 — 공을 차 놓고 전력질주로 따라간다 */
        try{ this.tryBurst(carrier); }catch(e){}
        if(this.emitEvents && Math.random()<0.30)
          this.cap(carrier.side, ["💨 {p}, 공을 앞으로 툭 차 놓고 내달립니다!"], {p:this.nm(carrier)});
      }
    }
    /* ⚠ 제보 — 「뒤에 있는 공을 염력으로 끌어당기며 돌파한다」.
       공은 무조건 선수의 속도(vx,vy)를 그대로 따라갔다. 그래서 공이 몸 뒤에 있어도
       같은 속도로 붙어 다녀, 발이 닿지 않는 공을 끌고 달리는 그림이 됐다.
       ─ 진행 방향 기준으로 뒤에 있는 공은 선수를 따라오지 않는다.
         선수만 앞서 나가고, 공은 그 자리에 남아 다시 잡으러 가야 한다. */
    let _follow=1;
    {
      const _fdx=(b.x-carrier.x)*PITCH_AR, _fdy=b.y-carrier.y;
      const _mv=HYP(vx*PITCH_AR, vy);
      if(_mv>1e-6){
        const _dot=(_fdx*(vx*PITCH_AR)+_fdy*vy)/_mv;      // 진행 방향으로 앞선 거리(음수=뒤)
        /* 뒤에 있는 공은 「발이 닿는 거리」까지만 몸과 함께 간다 */
        if(_dot<0){
          const _bd=HYP(_fdx,_fdy);
          _follow = _bd<=FOLLOW_REACH ? 1
                  : _bd>=FOLLOW_GONE  ? 0
                  : clamp((FOLLOW_GONE-_bd)/(FOLLOW_GONE-FOLLOW_REACH), 0, 1);
        }
      }
    }
    b.x=clamp01(b.x+vx*_follow+(b.ex||0)); b.y=clamp01(b.y+vy*_follow+(b.ey||0));
    b.ex=(b.ex||0)*BALL_ROLL_FRICTION; b.ey=(b.ey||0)*BALL_ROLL_FRICTION;
    if(carrier.face!==undefined) b._loc=ballToLocal(b, carrier);   // 월드에서 움직인 결과를 로컬에 반영
    /* 느리게 움직이거나 멈춰 서면 공을 발밑으로 당겨 온다 — 속도가 낮을수록 강하게.
       ⚠ 제보 — "선수도 없는데 공이 거울에 반사되듯 튕겨 다른 방향으로 간다".
          예전에는 남은 거리의 최대 24%를 한 틱에 끌어당겼다. 공이 2~4m 앞서 있으면
          한 틱에 1m 가까이 「뒤로」 끌려가 궤적이 그 자리에서 꺾여 보였다(2경기 123회 측정).
       ─ 이제 「발밑에 둬야 할 거리」를 넘은 만큼만, 사람이 발을 뻗는 속도 한도 안에서 당긴다. */
    if(_spN<0.30 && !b._knock){
      /* 목표는 「선수 몸」이 아니라 「시선 앞 한 발」이다 — 공을 몸으로 끌어당기면
         정지 상태에서 공이 발 뒤나 옆에 붙어 있는 그림이 된다(제보). */
      let _tx=carrier.x, _ty=carrier.y;
      if(carrier.face!==undefined){
        const _ahead=(0.75+_spN*1.2)/ISO_TO_M;              // 0.75m ~ 1.1m 앞
        _tx=carrier.x+Math.cos(carrier.face)*_ahead/PITCH_AR;
        _ty=carrier.y+Math.sin(carrier.face)*_ahead;
      }
      const _gx=(_tx-b.x)*PITCH_AR, _gy=_ty-b.y;
      const _gap=HYP(_gx,_gy)*ISO_TO_M;              // 목표 지점까지 떨어진 거리(m)
      if(_gap>0.30){
        const step=Math.min(_gap-0.30, 0.45);               // 한 틱에 최대 45cm — 발로 옮기는 속도
        const k2=(step/ISO_TO_M)/Math.max(1e-6, HYP(_gx,_gy));
        b.x=clamp01(b.x+_gx*k2/PITCH_AR); b.y=clamp01(b.y+_gy*k2);
      }
    }
    // 통제 범위 — 이보다 멀리 굴러가면 선수가 잡아 놓는다
    const dx=(b.x-carrier.x)*PITCH_AR, dy=b.y-carrier.y, d=HYP(dx,dy);
    const D0=b._drb;
    /* 🏃 치달 중 — 공은 저만치 앞에 있는 게 정상이다. 억지로 당기지 않는다.
       대신 상대가 먼저 닿을 것 같으면 공을 놓친다(흘린 공). */
    if(b._knock && (this.t-b._knock.at)<3.2){
      const dm=d*67;
      if(dm>1.2){
        /* 경합 — 나와 상대 중 누가 먼저 공에 닿는가.
           ⚠ 키퍼 제외가 「공이 오는데 보고만 있는 키퍼」의 원인이었다(제보) —
              필드 수비수에게는 뺏기는 공이 키퍼 앞에서만 소유로 남아 있었다. */
        let oppT=9;
        for(const o of this.side(this.opp(carrier.side))){
          const od=HYP((o.x-b.x)*PITCH_AR, o.y-b.y);
          const tt=travelTime(o, od); if(tt<oppT) oppT=tt;
        }
        const myT=travelTime(carrier, d);
        if(oppT < myT-0.15){
          /* 상대가 먼저 닿는다 — 소유권을 놓는다 */
          b.state="LOOSE"; b.ownerId=null; b._rollOwner=null; b._loc=null; b._knock=null;
          b.looseT=0; carrier._drbState=DRB.RECOVERY;
          if(this.emitEvents && Math.random()<0.35)
            this.cap(carrier.side, ["😬 {p}, 너무 세게 차 놓았습니다 — 상대가 먼저 닿습니다"], {p:this.nm(carrier)});
          return;
        }
        return;   // 아직 추격 중 — 당기지 않는다
      }
      b._knock=null;   // 따라잡았다 — 정상 드리블로 복귀
    }
    /* 상한은 "지금 있어야 할 거리"보다 조금 넉넉한 정도 — 이보다 멀면 발로 당겨 온다 */
    const maxLead=Math.max((D0?D0.distM/67:wantLead)*1.25, DRIB_LEAD*0.30);
    if(d>maxLead){
      // 통제 범위 밖 — 한 틱에 옮길 수 있는 만큼만 당겨온다. 한 번에 붙이면 공이 순간이동한다.
      /* ⚠ 제보 — 「멀리 뒤에 있는 볼을 염력으로 끌어당기며 돌파한다」.
         여기가 그 정체다. 방향을 보지 않고 통제 범위 밖이면 스프린트 속도로 끌어왔다.
         공이 등 뒤에 있으면 사람은 끌어올 수 없다 — 멈추거나 몸을 돌려 가지러 가야 한다.
         뒤에 있는 공은 발이 겨우 닿는 정도로만 당기고, 그래도 멀면 소유를 잃는다. */
      let _pullCap=SPD.CARRY*SIM_DT*0.85;         // 🏃 사다리 개편 — 볼 다루는 한도는 예전 값(CARRY)
      {
        const _mvx=(carrier.vx||0)*PITCH_AR, _mvy=(carrier.vy||0);
        const _mvN=HYP(_mvx,_mvy);
        if(_mvN>1e-6 && (dx*_mvx+dy*_mvy)/_mvN < 0) _pullCap*=0.16;   // 진행 방향 뒤 — 끌어올 수 없다
      }
      const pull=Math.min(d-maxLead, _pullCap);
      b.x=clamp01(b.x-(dx/d)*pull/PITCH_AR);
      b.y=clamp01(b.y-(dy/d)*pull);
      b.ex*=0.4; b.ey*=0.4;
      if(carrier.face!==undefined) b._loc=ballToLocal(b, carrier);   // 당긴 뒤 로컬 오프셋 재계산
    }
    /* 🧱 최종 상한 — 위 보정들을 다 합쳐도 한 틱 이동은 사람이 공을 다루는 속도를 넘지 않는다 */
    {
      const _tx=(b.x-_bx0)*PITCH_AR, _ty=b.y-_by0;
      const _tm=HYP(_tx,_ty)*ISO_TO_M;
      const _lim=Math.max(0.55, SPD.CARRY*SIM_DT*ISO_TO_M*0.75);    // 사람이 발로 공을 옮기는 속도 한도 (🏃 CARRY)
      if(_tm>_lim){
        const _k=(_lim/ISO_TO_M)/Math.max(1e-6, HYP(_tx,_ty));
        b.x=clamp01(_bx0+_tx*_k/PITCH_AR); b.y=clamp01(_by0+_ty*_k);
        if(carrier.face!==undefined) b._loc=ballToLocal(b, carrier);
      }
    }
  }
  /* 몸싸움 — 겹쳐 선 두 선수를 떼어놓는다.
     밀리는 양은 상대적인 힘으로 갈린다. 센 선수가 약한 선수를 밀어내고,
     볼을 지키는 선수는 몸을 대고 버티므로 잘 밀리지 않는다.
     세 명 이상 뭉친 경우를 풀기 위해 두 번 반복한다. */
  separateBodies(){
    const A=this.agents, b=this.ball;
    const minD=BODY_R*2;
    // 한 틱에 몸싸움으로 밀려나는 총량을 제한한다.
    // 여러 명 사이에 끼면 밀림이 누적돼 사람이 튕겨 날아가 버린다.
    for(const p of A) p._pushed=0;
    const _N=A.length;
    for(let it=0; it<JOSTLE_ITER; it++){
      for(let i=0;i<_N;i++){
        const p=A[i];
        if(p._down && p._down>this.t) continue;              // 넘어져 있는 선수는 넘어간다
        const _px=p.x, _py=p.y, _pw=p._inWall;
        for(let j=i+1;j<_N;j++){
          const q=A[j];
          let dx=(q.x-_px)*PITCH_AR, dy=q.y-_py;
          /* ⚡ 빗변은 어느 축보다도 크거나 같다 — 한 축만으로 이미 멀면 계산할 것도 없다.
             22명이면 짝이 231개인데 실제로 겹치는 건 한둘이다. 가장 싼 판정을 맨 앞에 둔다
             (전부 continue 라 순서를 바꿔도 결과는 완전히 같다). */
          if(dx>=minD||dx<=-minD||dy>=minD||dy<=-minD) continue;
          if(q._down && q._down>this.t) continue;
          // 수비벽은 어깨를 붙이고 선다 — 평소의 몸 간격(1.7m)을 강제하면 벽이 벌어져 벽 구실을 못 한다
          if(_pw && q._inWall) continue;
          let d=HYP(dx,dy);
          if(d>=minD) continue;
          // 미는 방향(단위벡터). 완전히 포개졌으면 임의 방향으로 떼어낸다.
          let ux, uy;
          if(d<1e-6){
            const ang=((p.id*37+q.id*11)%628)/100;
            ux=Math.cos(ang); uy=Math.sin(ang); d=0;   // 거리는 0 — overlap 이 최대가 된다
          } else { ux=dx/d; uy=dy/d; }
          const overlap=minD-d;
          // 힘 대결 — 센 쪽이 덜 밀린다
          const sp=(p.strength||0.6)*(b.ownerId===p.id?SHIELD_BONUS:1)*(p.slot==="GK"?1.6:1);
          const sq=(q.strength||0.6)*(b.ownerId===q.id?SHIELD_BONUS:1)*(q.slot==="GK"?1.6:1);
          const tot=sp+sq;
          const rp=Math.max(0, PUSH_MAX-(p._pushed||0));      // 이번 틱에 아직 밀릴 수 있는 여유
          const rq=Math.max(0, PUSH_MAX-(q._pushed||0));
          const mp=Math.min(rp, overlap*(sq/tot));            // p 가 밀리는 거리
          const mq=Math.min(rq, overlap*(sp/tot));
          p._pushed=(p._pushed||0)+mp; q._pushed=(q._pushed||0)+mq;
          p.x=clamp01(p.x-ux*mp/PITCH_AR); p.y=clamp01(p.y-uy*mp);
          q.x=clamp01(q.x+ux*mq/PITCH_AR); q.y=clamp01(q.y+uy*mq);
          this.stats[p.side].jostle++; this.stats[q.side].jostle++;
        }
      }
    }
  }
  /* 볼 소유자가 다음 행동을 결정한다 — 패스 / 드리블 유지 / 걷어내기 */
  decide(carrier){
    const key=carrier.side, oKey=this.opp(key);
    const mates=this.side(key), opps=this.side(oKey);
    /* 🦶 발이 닿아야 찬다 (제보 — "공이 멀리 있는데 패스가 나가는 마법 같은 장면").
       드리블로 공을 앞에 두고 뛰는 동안에는 아직 킥할 수 없다. 따라잡은 다음 찬다.
       ─ 세트피스·페널티는 이미 공 앞에 서 있는 상황이라 이 게이트를 지나간다.
       ─ 못 찰 때는 아무 것도 하지 않고 다음 틱을 기다린다. rollBall 이 공을 발밑으로 당겨 온다. */
    {
      const b0=this.ball;
      if(!b0.setPiece && !b0.isPenalty && !b0.spPlan){
        const kd=HYP((b0.x-carrier.x)*PITCH_AR, b0.y-carrier.y)*ISO_TO_M;
        /* ⚠ 제보 — 「뒤나 옆에서 끌듯이 슛·패스를 쏘는, 투수가 투구하는 듯한 움직임」.
           거리만 봤지 「어느 쪽에 있는가」를 보지 않아, 등 뒤 2m의 공도 그대로 찼다.
           사람은 몸 뒤의 공을 찰 수 없다 — 한 발 앞에 놓일 때까지 기다린다(rollBall 이 정리한다). */
        if(kd>0.35 && carrier.face!==undefined && carrier.slot!=="GK"){
          const bx=(b0.x-carrier.x)*PITCH_AR, by=b0.y-carrier.y;
          const bn=HYP(bx,by);
          if(bn>1e-6){
            const cosA=(bx*Math.cos(carrier.face)+by*Math.sin(carrier.face))/bn;
            if(cosA < -0.55){ carrier._needBall=this.t; return; }   // 명백히 등 뒤(123° 밖) — 발 앞으로 정리한 뒤 찬다
          }
        }
        if(kd>KICK_REACH_M){
          /* 오래 못 따라잡으면 공을 놓친 것이다 — 흐른 공으로 돌린다(치달 로직이 따로 처리) */
          if(!b0._knock && kd>KICK_REACH_M*2.6){
            b0.state="LOOSE"; b0.ownerId=null; b0._rollOwner=null; b0._loc=null;
            b0.looseT=0; b0.looseBy=carrier.side;
          }
          return;
        }
      }
    }
    // ── 페널티킥 — 다른 선택지가 없다. 키커는 무조건 골문을 향해 찬다.
    if(this.ball.isPenalty){
      this.ball.isPenalty=false;
      this.resolveShot(carrier, shotGeom(carrier), SHOT_TYPE.PLACED, {penalty:true});
      return;
    }
    // ── 프리킥 처리 — 벽이 서고 키커가 기다렸다가, 미리 정해 둔 대로 실행한다.
    if(this.ball.spPlan){
      const plan=this.ball.spPlan;
      this.ball.spPlan=null; this.ball.fkDirect=false;
      if(plan==="shot"){
        const g=shotGeom(carrier);
        if((g.gx-carrier.x)*carrier.dir>0.01){
          this.stats[key].fkDirect++;
          // 벽을 넘겨 감는 슛이거나(FINESSE), 벽 위로 강하게 때리는 슛(POWER)
          const type=(g.distM<26 && Math.random()<0.35+(carrier.fkSkill||0.5)*0.45)
                     ? SHOT_TYPE.FINESSE : SHOT_TYPE.POWER;
          this.resolveShot(carrier, g, type, {freeKick:true});
          return;
        }
      } else if(plan==="clear"){
        /* 🧤 앞으로 길게 — 골킥과 같은 처리다. 짧은 연결 대신 하프라인 근처로 띄운다. */
        this.launchGoalKick(carrier, mates);
        return;
      } else if(plan==="cross" || plan==="corner"){
        // 박스로 올린다 — 일반 크로스 판단을 쓰되, 세트피스라 "각이 안 나온다"는 조건은 무시한다.
        // 공이 정지해 있고 아무도 붙어 있지 않으므로, 측면이 아니어도 올릴 수 있다.
        // 코너킥은 골라인 위에서 차므로 반드시 띄워 올린다(컷백으로 새지 않게).
        this.ball._spBall=true;      // 세트피스에서 올라온 공 — 공중 경합에서 공격 측이 유리하다
        const cr=this.setPieceDelivery(carrier, plan==="corner");
        if(cr){ this.startCross(carrier, cr); return; }
      }
      // "short" 이거나 위 경로가 불발이면 아래의 일반 판단으로 흘려보낸다 (짧게 연결).
      // 다만 세트피스에서 곧바로 중거리를 때려버리지 않도록 슛 판단은 이번 한 번 건너뛴다.
      if(plan!=="shot") this._skipShotOnce=true;
    }
    const T=TAC(carrier.team);
    const selfPress=pressureOn(carrier, opps, T.press);
    /* 🎚️ 패스 성향(매우 짧게 ↔ 롱볼 위주) — 배선 감사에서 <b>이 슬라이더가 엔진에 아예
       닿지 않는다</b>는 걸 확인했다. T.pass 가 나오는 곳이 전부 UI 와 AI 감독의 전술 변경
       코드였고, 실제 패스 판단은 선수 특성(FX longPass/shortPass)만 읽고 있었다.
       슬라이더를 「매우 짧게」로 놓든 「롱볼 위주」로 놓든 엔진이 똑같이 동작했다.
       여기서부터 실어 보낸다 — findBestPass 와 evaluatePassOptions 가 모두 이 ctx 를 받는다. */
    const pctx={dir:carrier.dir, press:T.press, passSkill:carrier.passSkill, selfPress, defs:opps,
                passTac:T.pass,
                oneTouch:(this.t-(carrier._recvAt||-9))<0.9,   // 🔁 ② 받자마자 내주는 패스 — 죽어 있던 난이도 항(PE.ONE_TOUCH)을 살린다
                mates,
                oneTwo:this.ball._oneTwo, now:this.t, presCirc:this._pcT||0,
                counter:this.counterOn(key)?1:0, counterK:this.counterK(key),   // ⚡ 역습 창 — 패스 선택이 앞을 본다
                bu:this._bu};                                                   // 🔄 팀 단위 빌드업 상황
    const opts=evaluatePassOptions(carrier, mates, opps, pctx);
    pctx.opts=opts;                      // ⚡ 아래 findBestPass 들이 다시 재지 않게 실어 준다
    // 골키퍼 배급 — 짧은 횡패스로 돌리지 않고 전방으로 길게 연결한다
    if(carrier.slot==="GK"){
      /* 🧤 실책 수리 2 — 판단 추적(경기당): GK decide 472회 중 <b>403회가 「몸 돌리는 중」</b>(lookThenPass 회전 예약)으로
         끝났고 실제 패스는 34회. 회전이 끝나면 판단을 처음부터 다시 하는데 점수 노이즈·동료 이동으로 매번 다른
         대상을 골라 계속 몸만 돌렸다 — 6초 규정에 걸려 강제 걷어내기가 경기당 63회(그 걷어내기의 상실률 66%).
         유저가 보는 「키퍼가 우물쭈물하다 상대에게 준다」의 뿌리. ─ 회전을 예약할 때 <b>플랜을 저장</b>하고,
         다음 판단에서 받을 사람이 여전히 자유로우면 다시 고르지 않고 그 플랜을 그대로 찬다. */
      /* 🧤 ⚠ 제보 — 「키퍼가 가끔 공 잡고 패스할 때 가만히 서 있다」.
         회전 예약(lookThenPass)이 걸리면 그 틱은 그냥 return 하는데, 다음 판단에서 대상이
         바뀌면 회전을 <b>다시</b> 예약한다. 몸은 계속 돌기만 하고 공은 안 나간다.
         (위 주석의 「decide 472회 중 403회가 몸 돌리는 중」이 같은 병이다 — 플랜 저장으로
          많이 줄였지만, 플랜이 무효가 되는 경로에서는 여전히 남아 있었다.)
         ─ 안전장치: 잡고 있은 시간이 GK_HOLD_MAX 를 넘으면 <b>회전을 기다리지 않고</b> 찬다.
           실제로도 키퍼는 몸이 덜 돌았으면 덜 돈 채로 처리하지, 계속 서 있지 않는다. */
      if(carrier._gkHoldFrom==null || this.ball._rollOwner!==carrier.id) carrier._gkHoldFrom=this.t;
      const _gkStuck=(this.t-carrier._gkHoldFrom) > GK_HOLD_MAX;
      if(_gkStuck){
        carrier._kickFace=null;                       // 돌기를 포기하고 지금 자세로 찬다
        const _fp=carrier._gkPlan
               || findBestPass(carrier, mates, opps, Object.assign({}, pctx, {pick:()=>opts[0]}));
        carrier._gkPlan=null; carrier._gkHoldFrom=null;
        if(_fp){ this.startPass(carrier, _fp); return; }
        this.launchGoalKick(carrier, mates); return;   // 줄 사람이 없으면 걷어낸다
      }
      if(carrier._gkPlan && this.t<(carrier._gkPlanUntil||0)){
        const _pp2=carrier._gkPlan, _po=_pp2.opt||_pp2;
        let _ok=false;
        if(_po.to && _po.to.slot && this.agents.indexOf(_po.to)>=0 && _po.to.side===carrier.side){
          let _od=99;
          for(const q of opps){ if(q.slot==="GK") continue;
            const _d=HYP((q.x-_po.to.x)*PITCH_AR, q.y-_po.to.y)*ISO_TO_M; if(_d<_od) _od=_d; }
          _ok=_od>3.5;
        }
        if(_ok){
          if(!this.lookThenPass(carrier, _pp2)) return;      // 아직 돌고 있다 — 플랜은 유지된다
          carrier._gkPlan=null;
          this.startPass(carrier, _pp2); return;
        }
        carrier._gkPlan=null;                                // 받을 사람이 잡혔다 — 새로 판단
      }
      /* ⚽ 골킥 — 상대가 라인을 올려 압박 대형을 짜고 기다리는 상황이다. 중간 거리 연결은
         차단당하기 딱 좋다(실제 제보: "키퍼가 상대에게 패스한다"). 아주 안전한 짧은 연결이
         아니면 하프라인을 넘기는 높고 긴 킥으로 처리한다. */
      if(this.ball.fromGoalKick){
        this.ball.fromGoalKick=false;
        const safe=opts.filter(o=>o.dist<0.20 && o.recvPress<0.35 && o.forward>-0.02);
        /* 🧤 상대 최전방이 박스 근처(28m 안)까지 올라와 기다리면 예전처럼 길게가 기본.
           안 올라와 있으면 짧은 전개가 기본(75%) — 긴 골킥은 낙하점 경합 상실률 52~74% 였다. */
        let _oppHi=99;
        for(const q of opps){ if(q.slot==="GK") continue;
          const _d=HYP((q.x-carrier.x)*PITCH_AR, q.y-carrier.y)*ISO_TO_M; if(_d<_oppHi) _oppHi=_d; }
        const _pShort=(_oppHi>28) ? 0.75 : 0.30+(carrier.passSkill||0.6)*0.20;
        if(safe.length && Math.random()<_pShort){
          /* ⚠ 버그 — startPass 에 「옵션」(safe[0])을 그대로 넘겼다. startPass 는 플랜(T·power·tx)을 기대하므로
             flightT=0·power=undefined·tx=undefined 인 PASS 가 만들어져 공이 제자리에 멈춘 채 PASS 상태로 남았다.
             예전엔 수신자가 걸어와 발밑 픽업으로 살아났는데, 자리 역할 버팀(POS_HOLD)이 들어오자 수신자가
             7.8m 밖에서 멈춰 경기가 40분간 얼었다(실측 seed 1). 아래 박스 밖 분기도 같은 병. 플랜으로 만든다. */
          const _gp=findBestPass(carrier, mates, opps, Object.assign({}, pctx, {pick:()=>safe[0]}));
          if(_gp){ if(!this.lookThenPass(carrier, _gp)){ carrier._gkPlan=_gp; carrier._gkPlanUntil=this.t+1.4; return; } this.startPass(carrier, _gp); return; }
        }
        this.launchGoalKick(carrier, mates);
        return;
      }
      // 박스 밖에서 잡은 공은 손을 못 쓴다 — 지체 없이 발로 걷어내거나 가까운 동료에게 붙인다
      const gkOwn = carrier.dir>0 ? carrier.x : 1-carrier.x;
      if(gkOwn > (1-BOX_X)){
        const safe=opts.filter(o=>o.dist<0.22 && o.recvPress<0.6);
        /* 🧤 여유가 있으면(압박 낮음) 주사위 없이 짧게 붙인다 — 비강요 걷어내기 수리 (위 주석) */
        const _gp2 = (safe.length && (selfPress<0.35 || Math.random()<0.45+(carrier.passSkill||0.6)*0.35))
          ? findBestPass(carrier, mates, opps, Object.assign({}, pctx, {pick:()=>safe[0]})) : null;   // ⚠ 옵션→플랜 (위 주석)
        if(_gp2){
          if(!this.lookThenPass(carrier, _gp2)){ carrier._gkPlan=_gp2; carrier._gkPlanUntil=this.t+1.4; return; }
          this.startPass(carrier, _gp2);
        }
        else this.clearBall(carrier);
        return;
      }
      /* 오픈 플레이 배급도 위험한 중간 패스를 거른다 — 받는 사람이 눌려 있으면 그 옵션은 버린다 */
      /* 🧤 키퍼의 배급 — 「전진 옵션 중 최고점」을 고르면 상대 압박에 그대로 끊긴다.
         키퍼에게 좋은 패스는 전진 패스가 아니라 「끊기지 않는 패스」다.
         가까울수록·수신자가 자유로울수록·길이 열려 있을수록 값이 오르고,
         전진은 그 다음이다. 안전한 선택지가 하나도 없을 때만 길게 찬다. */
      const gkSafe=(o)=>{
        /* 거리 — 20m 안쪽이 안전하고, 30m를 넘으면 급격히 나빠진다.
           키퍼의 긴 패스는 받는 선수가 우리 진영에서 처리해야 해서 실수가 곧 실점이다. */
        const near   = clamp(1 - o.dist/0.22, 0, 1);
        const farPen = Math.max(0, o.dist-0.34)*3.2;
        const free   = clamp(1 - (o.recvPress||0)/0.55, 0, 1);
        const open   = clamp(1 - (o.blocked||0)/0.60, 0, 1);
        const prog   = clamp((o.forward||0)/0.30, -0.5, 1);
        /* 🚨 「맞고 튀면 곧바로 1대1」 — 받는 선수 근처에 상대가 있으면 그 옵션은 버린다.
           퍼스트터치가 흔들리는 순간 상대가 그대로 가져가 결정적 장면이 된다. */
        let vuln=0;
        for(const q of opps){
          if(q.slot==="GK") continue;
          const d=HYP((q.x-o.to.x)*PITCH_AR, q.y-o.to.y);
          if(d<0.16) vuln=Math.max(vuln, 1-d/0.16);
        }
        /* 받는 선수가 잘 잡는가 — 퍼스트터치가 나쁜 선수에게 위험한 공을 주지 않는다 */
        const ftq=(o.to.p&&o.to.p.attr&&attr20(o.to.p.attr.fir)/20)||0.6;
        return near*1.55 + free*1.45 + open*1.30 + prog*0.35 + o.score*0.15
             - farPen - vuln*(1.35 + (1-ftq)*1.10);
      };
      /* 🧤 키퍼 실책 수리 (제보 — 「키퍼 실수로 골 먹히는 경우가 많다. 패스 미스, 리턴이 상대에게 간다」).
         실측(경기당): GK 걷어내기 82회 중 5초 안 소유 상실 66% — 그리고 그중 34회는 압박도 없고(압박 0.35 미만)
         22m 안에 자유로운 동료가 있는 <b>비강요 걷어내기</b>였다(26회 상실). 정작 짧은 패스를 고른 경우의
         상실률은 0~7%. 문턱(1.55)이 너무 높아 안전한 연결까지 버리고 걷어찼던 것 — 유저가 보는 「키퍼 패스 미스」의
         정체는 킥 미스가 아니라 <b>불필요한 걷어내기의 50/50 상실</b>이다.
         ─ 문턱을 압박에 비례시킨다: 여유가 있으면(압박 0) 0.85, 눌리면 예전처럼 1.5+ (그때는 걷어내는 게 맞다). */
      const gk=findBestPass(carrier, mates, opps, Object.assign({}, pctx, {
        pick:(list)=>{
          let best=null, bs=-1e9;
          for(const o of list){ const s=gkSafe(o); if(s>bs){ bs=s; best=o; } }
          const _thr=0.85 + clamp(selfPress,0,1)*0.75;
          return (best && bs>_thr) ? best : null;
        }
      }));
      if(gk && (gk.recvPress==null || gk.recvPress<0.85)){
        if(!this.lookThenPass(carrier, gk)){ carrier._gkPlan=gk; carrier._gkPlanUntil=this.t+1.4; return; }
        this.startPass(carrier, gk);
      }
      else this.clearBall(carrier);
      return;
    }
    // 스로인은 손으로 던진다 — 짧고, 포물선으로 뜨고, 발로 찬 공보다 느리다
    if(this.ball.isThrow){
      const near=opts.filter(o=>o.dist<=THROW_MAX*(0.78+(carrier.throwLong||0.5)*0.62)*(1+((carrier.tr||{}).longThrow?0.45:0)));
      /* ⚠ 제보 — 「우리 진영 스로인에서 자꾸 실수. 받는 수비가 못 받고 흘려서 상대 공격수가
         그대로 인터셉트해 골을 넣거나 날려먹음」. 사거리 안 1순위(near[0])를 그대로 던졌는데,
         그 점수에는 "받는 사람 옆에 상대가 붙어 있는가"가 사실상 반영되지 않았다(실측 —
         자기 진영 스로인의 12%가 5초 안에 소유 상실). 실제 스로인의 제1원칙은 「자유로운
         사람에게」다 — 특히 자기 진영에서는 마크당한 동료를 피해서 던진다. */
      const _thrScore=(o)=>{
        let vuln=0;
        for(const q of opps){ if(q.slot==="GK") continue;
          const dd=HYP((q.x-o.to.x)*PITCH_AR, q.y-o.to.y);
          if(dd<0.14) vuln=Math.max(vuln, 1-dd/0.14); }
        const ownK=(carrier.dir>0?carrier.x:1-carrier.x)<0.40 ? 1.7 : 1.0;   // 자기 진영일수록 안전 우선
        return (o.score||0) - vuln*(1.35*ownK);
      };
      const pick = near.length ? near.reduce((x,y)=>_thrScore(y)>_thrScore(x)?y:x, near[0])
                 : (opts.length ? opts.reduce((x,y)=> y.dist<x.dist?y:x, opts[0]) : null);
      if(pick){ this.startThrow(carrier, pick); } else { this.ball.isThrow=false; this.clearBall(carrier); }
      return;
    }
    // 크로스 — 측면에서 박스로 올릴 기회가 있으면 일반 패스와 점수로 겨룬다
    const cross=evaluateCross(carrier, mates, opps, {
      dir:carrier.dir, press:T.press, crossSkill:carrier.crossSkill, crossFq:T.crossFq
    });
    /* 🎚️ 크로스 빈도 — 보통(1.0)이 기준. 낮으면 억제가 세지고, 높으면 크로스가 값을 얻는다 */
    if(cross) cross.score += (T.crossFq-1)*0.30 - CROSS_ADJ;
    /* 🎯 「찬스에서 패스보다 크로스 선호」 — 이 선수가 잡으면 저울이 크로스 쪽으로 기운다 */
    if(cross) cross.score += clamp(FX(carrier,"crossFirst"),0,1)*0.26;
    const best=opts[0];
    /* ═══ ⑤ 슛·크로스도 같은 자를 쓴다 ═══════════════════════════════════════════
       ⚠ 「슛은 패스·크로스와 같은 점수 척도로 겨룬다」고 적혀 있었지만, 사실 그 척도는
          <b>설계된 것이 아니라 우연히 맞춰 놓은 것</b>이었다. 이제 패스는 골 확률 단위
          (ZONE_V × EV_K)로 재므로, 슛·크로스도 「실패하면 그 자리에서 상대에게 넘어간다」는
          같은 대가를 물어야 공정하다.
       ─ 슛이 빗나가면 상대 골킥·역습이 되고, 크로스가 걷히면 상대 진영에서 소유가 넘어간다.
          그 자리의 상대 기준 골 기대값이 곧 대가다. */
    // 슛 — 패스·크로스와 같은 점수 척도로 겨룬다. 각이 열려 있고 앞이 비었으면 때린다.
    let shot=evaluateShot(carrier, opps, {selfPress, mentality:T.mentality, longShot:T.longShot,
      /* ⚠ 창을 2.2초로 잡았다가 <b>한 번도 안 걸렸다</b> — 공을 잡은 뒤의 컨트롤 시간(hold)이
         TEMPO 배율까지 곱해 그보다 길다. 즉 다음 판단이 올 때는 이미 창이 닫혀 있었다.
         시간이 아니라 <b>소유</b>로 잡는다 — 차거나 올리거나 쏘는 순간 지운다(아래 세 곳). */
      cutback:(carrier._cbFrom!=null && this.t-carrier._cbFrom < 8.0)});
    /* ⑤ 슛·크로스도 <b>실패하면 넘어간다</b>는 대가를 문다 — 패스와 같은 자(골 확률 단위).
       빗나간 슛은 골킥, 걷힌 크로스는 상대 소유다. 그 자리의 상대 기준 골 기대값이 대가다.
       골문 앞에서는 이 값이 거의 0 이라 그대로 때리고, 먼 거리에서는 값이 커져 억제된다 —
       중거리 남발이 억제되는 이유가 계수가 아니라 <b>대가</b>가 된다. */
    {
      const _lossHere=zoneValue(carrier.x, carrier.y, -carrier.dir)*EV_K;
      if(shot){
        const _keep=clamp(0.30+(shot.q||0)*0.45, 0.15, 0.75);   // 코너·리바운드로 되찾을 여지
        shot.score -= (1-_keep)*_lossHere*0.35;
      }
      if(cross) cross.score -= 0.58*_lossHere*0.35;
    }
    /* 🎚️ 크로스 빈도가 높으면 측면에서는 슈팅보다 크로스를 먼저 고른다 */
    if(shot && cross && Math.abs(carrier.y-0.5)>0.22 && T.crossFq>1)
      shot.score -= (T.crossFq-1)*0.45;
    /* 이 특성은 슈팅보다도 크로스를 먼저 본다 — 다만 각이 좋은 슛까지 포기하진 않는다 */
    if(shot && cross && Math.abs(carrier.y-0.5)>0.24)
      shot.score -= clamp(FX(carrier,"crossFirst"),0,1)*0.16;
    if(this._skipShotOnce){ this._skipShotOnce=false; shot=null; }   // 세트피스 전개 — 이번엔 때리지 않기로 했다
    /* 🥅 골 에어리어 강제 슛 — 골문 8.5m 안에서 각이 완전히 죽지 않았으면 무조건 때린다.
       점수 비교로 두면 낮은 슛 점수 탓에 골문 안까지 몰고 들어가는 어색한 장면이 나온다(제보). */
    {
      const g0=shot?shot.g:shotGeom(carrier);
      /* 🎯 2티어 강제 슛 (제보: 완벽한 찬스에도 골에어리어까지 몰고 들어감 — 8경기 실측 2.75회/경기)
         ① 골에어리어 언저리(6.5m)는 각만 살아 있으면 무조건
         ② 11.5m 안 + 각 활짝(0.45) + 통로에 수비 0명(shot.clear) = 「완벽한 찬스」도 무조건.
           ⚠ 각 조건 없이 박스 전체로 넓히면 혼전이 전부 즉시 슛이 되어 골 급증(실측 6골/45분) —
           clear 조건이 그 폭주를 막는 열쇠다. */
      /* ⚠ shot.clear 는 등 뒤 추격 수비수(-0.012까지)도 차단자로 세므로 몰고 들어가는 상황에선
         절대 참이 되지 않았다(8경기 비트 동일 실측). 「내 앞」 통로만 직접 본다 — 추격자는 무시. */
      let _ahead=0;
      if(g0 && g0.distM<12.5 && g0.angle>0.34){
        const _sp2=(g0.gx-carrier.x)*carrier.dir;
        for(const o of opps){
          if(o.slot==="GK") continue;
          const al=(o.x-carrier.x)*carrier.dir;
          if(al<=0.006 || al>=_sp2) continue;
          const t2=al/Math.max(1e-6,_sp2);
          if(Math.abs(o.y-(carrier.y+(0.5-carrier.y)*t2))<BLOCK_W*1.2) _ahead++;
        }
      }
      /* 🧊 ② 티어를 <b>확률</b>로 바꾼다 (제보: "2 확률만 바꾸자").
         ⚠ ① 6.5m 강제는 그대로 둔다 — 골에어리어 안에서 각이 살아 있으면 프로는 그냥 찬다.
            거기엔 판단력이 개입할 여지가 없다.
         ② 12.5m 는 다르다. 「완벽한 찬스」라도 실제로는 한 번 더 끌거나, 옆으로 내주거나,
            키퍼가 나오길 기다리는 선택이 있다. 침착성 높은 스트라이커가 하는 게 정확히 그거다.
         ⚠ 원래 제보(「완벽한 찬스에도 골에어리어까지 몰고 들어감 — 8경기 2.75회/경기」)가
            재발하면 안 되므로 <b>평균 선수는 98% 그대로 때린다</b>.
            침착성·판단력이 최상급일 때만 최대 30% 가 「한 번 더」로 빠진다.
            그리고 빠져도 슛을 안 하는 게 아니라 <b>평소 판단으로 흘려보낼</b> 뿐이다 —
            패스·크로스가 더 값질 때만 다른 선택이 된다. */
      /* ⚠ ① 6.5m 강제 티어를 <b>지웠다</b>(제보: "6.5m 하드코딩 지워버려").
         죽은 코드였다 — 실측에서 <b>한 번도 발동하지 않았다</b>.
         그리고 그 이유가 더 큰 사실을 드러냈다:
           · 캐리어 20,443 틱 중 골문 6.5m 안: <b>0 회</b>
           · 공을 발밑에 두고 <b>박스 안(16.5m)에 있는 시간이 전체의 0.6%</b>
           · 캐리어 거리 최소 9.0m · p01 18.3m · p05 24.7m · 중앙값 47.9m
         즉 이 엔진에서 <b>공을 몰고 박스로 들어가는 장면이 사실상 없다.</b>
         박스 안 슛은 전부 「받자마자 때리는」 첫 터치 슛이고, 실축에서 흔한
         「박스 안에서 한 명 제치고 마무리」·「컷백 받아 잡았다가 넣기」·
         「골문 앞 혼전에서 밀어 넣기」가 구조적으로 안 나온다.
         ⚠ 그 상황이 만들어지게 되면 이 강제 티어가 <b>다시 필요해질 수 있다</b> —
            원래 이 코드가 들어온 이유가 「완벽한 찬스에도 골에어리어까지 몰고 들어감」이었다.
            박스 진입이 살아나면 같은 증상이 돌아온다. 그때 다시 넣을 것. */
      let _forceOK=true;
      if(g0){
        const _cmp2=clamp(attr20(((carrier.p&&carrier.p.attr&&carrier.p.attr.cmp)!=null?carrier.p.attr.cmp:60))/20, 0.15, 1);
        const _dec2=clamp(carrier.decSkill!=null?carrier.decSkill:0.6, 0.15, 1.2);
        const _hold=clamp((_cmp2-0.55)*0.45 + (_dec2-0.60)*0.35, 0, 0.30);
        if(Math.random() < _hold) _forceOK=false;
      }
      if(_forceOK && g0 && (g0.distM<12.5 && g0.angle>0.34 && _ahead===0)){
        const _bd0=HYP((this.ball.x-carrier.x)*PITCH_AR, this.ball.y-carrier.y);
        if(_bd0<=DRIB_LEAD*1.45){
          const gk0=opps.find(o=>o.slot==="GK");
          this.resolveShot(carrier, g0, chooseShotType(carrier, g0, this.ball, gk0, shot||{clear:true}));
          return;
        }
        carrier._wantShot=this.t;         // 🎯 슛 의사 — 다음 터치는 공을 잡는 터치가 된다
        this.ball.hold=0.18; return;      // 공부터 붙잡고, 다음 판단에서 때린다
      }
    }
    if(shot && (!best || shot.score>best.score) && (!cross || shot.score>cross.score)){
      /* ⚽ 공이 발에 붙어 있어야 때린다 — 치달(KNOCK) 중엔 공이 3~7m 앞에 있는데,
         여기서 그대로 쏘면 resolveShot 이 공을 슈터에게 「당겨와서」 순간이동으로 보인다(제보).
         멀면 이번 판단은 접고 계속 따라붙는다 — 붙은 다음 판단에서 자연히 때린다. */
      const _bd=HYP((this.ball.x-carrier.x)*PITCH_AR, this.ball.y-carrier.y);
      if(_bd > DRIB_LEAD*1.45){
        carrier._wantShot=this.t;            // 🎯 슛 의사 — 치달을 멈추고 공을 발밑에 붙인다
        this.ball.hold=0.22;                 // 잠깐 뒤 다시 판단 — 그동안 공에 다가간다
        return;
      }
      const gk=opps.find(o=>o.slot==="GK");
      this.resolveShot(carrier, shot.g, chooseShotType(carrier, shot.g, this.ball, gk, shot));
      return;
    }
    if(cross && (!best || cross.score>best.score)){
      /* ⚽ 크로스도 공이 발에 붙어 있어야 올린다 — 측면 치달 중엔 공이 5~8m 앞에 있는데
         그대로 올리면 몸이 닿지도 않은 공이 날아간다(제보 · 실측 중앙값 5.0m·최대 7.7m). */
      const _bd=HYP((this.ball.x-carrier.x)*PITCH_AR, this.ball.y-carrier.y);
      if(_bd > DRIB_LEAD*1.45){ this.ball.hold=0.22; return; }
      /* 👀 크로스각 점검(요청) — 패스에는 lookThenPass(시선과 60° 이상 어긋나면 돌아서서 찬다)가
         있는데 크로스에는 없었다. 터치라인을 향해 전력질주하던 윙어가 90° 방향으로 즉시 올렸다.
         같은 규칙을 목표 지점(tx,ty) 기준으로 건다. 세트피스 크로스(60260행)는 정지된 공이라 제외. */
      if(!this.lookThenPass(carrier, {to:{x:cross.tx, y:cross.ty}})) return;
      this.startCross(carrier, cross); return;
    }
    // 돌파 욕심 — 내 앞의 수비수보다 내가 확실히 낫다면, 패스 대신 제치고 들어간다.
    // 이게 없으면 능력치 20짜리 드리블러도 그냥 무난한 패스만 골라 슈퍼스타처럼 보이지 않는다.
    {
      const fx=Math.cos(carrier.face||0), fy=Math.sin(carrier.face||0);
      let mark=null, md=TAKEON_RANGE*1.7;
      for(const o of opps){
        if(o.slot==="GK") continue;
        if(o._beaten && o._beaten>this.t) continue;
        const dx=(o.x-carrier.x)*PITCH_AR, dy=o.y-carrier.y, d=HYP(dx,dy);
        if(d>md || d<1e-6) continue;
        if((dx*fx+dy*fy)/d < 0.70) continue;
        md=d; mark=o;
      }
      if(mark){
        const atk=(carrier.dribSkill||0.6)*0.65+(carrier.paceSkill||0.6)*0.35;
        const def=(mark.tackleSkill||0.6)*0.55+(mark.paceSkill||0.6)*0.30+(mark.posSkill||0.6)*0.15;
        const edge=atk/Math.max(0.05,def);                  // 1.0 이면 대등, 1.3 이면 확실히 우위
        // 우위가 클수록, 상대 골문에 가까울수록 과감해진다
        const adv=carrier.dir>0 ? carrier.x : 1-carrier.x;
        const T2=carrier.tr||{};
        // 특성: 공을 자주/드물게 드리블, 현란한 개인기, 여러 차례 속이기
        const dribTrait = 1 + FX(carrier,"dribble");
        let appetite=clamp((edge-1.02)*TAKEON_GREED*(0.65+(carrier.flair||0.6)*0.70)*dribTrait, 0, 0.92)*(0.55+adv*0.75);
        // 특성: 공을 차놓고 제치기 — 드리블이 아니라 순수 스피드로 뚫는다
        if(T2.knockPast) appetite *= 0.85 + (carrier.paceSkill||0.6)*0.60;
        if(FX(carrier,"shoot")<-0.2) appetite*=0.6;   // 득점보다 패스 성향
        if(Math.random() < appetite){
          if(this.tryTakeOn(carrier, opps)) return;         // 제쳤으면 그대로 몰고 간다
          this.ball.hold=(0.3+Math.random()*0.4)*TEMPO; return;
        }
      }
    }
    // 좋은 패스가 없고 압박도 약하면 계속 몰고 간다
    // 키퍼와 1대1인데 계속 몰고만 가는 건 축구가 아니다 — 이 상황에서는 드리블로 빠지지 않는다
    const oneOnOne = shot && shot.clear && shot.g.distM<18;
    // 특성: 공을 가지면 멈춤 / 공을 오래 소유 / 템포 조절 — 볼을 더 오래 쥔다
    const holdTr = 1 + FX(carrier,"hold");
    /* 🏃 운반 점수 — 「좋은 패스가 없을 때」만 몰고 가면, 공간이 넓을수록 오히려 덜 전진한다
       (실측 7.7m vs 좁을 때 8.7m). 공간이 넓으면 운반이 웬만한 패스를 이겨야 한다 (§21). */
    let _carryS=0;
    {
      const A4=(carrier.p&&carrier.p.attr)||{};
      const drb4=clamp(attr20(A4.dri!=null?A4.dri:60)/20, 0.15, 1);
      const dec4=clamp(attr20(A4.dec!=null?A4.dec:60)/20, 0.15, 1);
      const pac4=clamp(carrier.paceSkill!=null?carrier.paceSkill:0.6, 0.1, 1.2);
      let ah4=9;
      for(const o of opps){
        if(o.slot==="GK") continue;
        if((o.x-carrier.x)*carrier.dir < 0.01) continue;
        const d=HYP((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
        if(d<ah4) ah4=d;
      }
      const sp4=clamp((ah4-0.10)/0.18, 0, 1);                     // 7m 밖부터
      const adv4=carrier.dir>0?carrier.x:1-carrier.x;
      /* 제보: "adv4-0.62 이게 뭔데 / 응 손대자"
         증상: 최종 3분의 1(자기 골문에서 약 65m)부터는 위치만 보고 운반 점수를 무조건 깎았다.
               앞이 텅 비어 있고 드리블이 뛰어난 선수도 박스 근처에서는 패스로 밀려난다.
               실측 — 캐리어가 박스 안에 있던 시간 0.6~1%, 골문 6.5m 안 진입 0회,
               캐리어-골 최소거리 9.0m / p01 18.3m / p05 24.7m.
         원인: 「최종 3분의 1에서는 패스가 맞다」를 조건 없는 상수 감점으로 넣었다.
               실제 축구에서 그 말이 맞는 건 앞이 막혀 있을 때이고, 앞 공간이 열려 있으면
               몰고 들어가는 게 정답이다.
         수정: 감점 자체는 남기되 「앞 공간 × 드리블 능력·특성」만큼 덜어낸다.
               앞이 막혔으면 감점은 그대로, 앞이 15m 넘게 비어 있고 압박도 없으면 최대 85% 면제.
               ⚠ 처음에는 면제 기준을 7m부터 완만하게 줬는데(면제 평균 0.42) 그러면 최종
               3분의 1에서 운반이 패스를 대체해 버렸다. 축구에서 「최종 3분의 1은 패스」가
               맞는 건 앞이 막혀 있을 때이므로, 면제는 진짜 열린 공간(15m+)에만 준다. */
      const _drbTr4=clamp(FX(carrier,"dribble")+FX(carrier,"cutIn")*0.6, 0, 1);
      const _free4=clamp(clamp((sp4-0.65)/0.35,0,1)*(0.45 + drb4*0.35 + _drbTr4*0.20)*(1-clamp(selfPress,0,1)), 0, 0.85);
      _carryS = sp4*(0.55+drb4*0.60+pac4*0.40+dec4*0.25)
              - selfPress*1.30
              - Math.max(0, adv4-0.62)*1.8*(1-_free4);             // 막혔을 때만 「패스가 맞다」
      _carryS = Math.max(0, _carryS);
    }
    /* ⚠ 운반 점수를 세게 주면 패스를 대체해 버린다(실측: 팀당 패스 237→198회).
       운반은 「패스가 애매할 때의 대안」이지 기본 선택지가 아니다. */
    /* 🔁 2대1 의 벽 — 되돌림 창 동안은 몰고 가지 않는다(실측: 창 안에서 벽이 패스 자체를 안 하고 끝난 에피소드 63%) */
    const _wallNow=!!(this.ball._oneTwo && this.ball._oneTwo.recvId===carrier.id && this.t<this.ball._oneTwo.until);
    if(!oneOnOne && !_wallNow && (!best || (best.score < -0.45 + _carryS*0.40 && selfPress<0.40+_carryS*0.18))){
      /* 🏃 직접 운반 — 앞에 공간이 있고 아무도 안 나오면 패스 대신 몰고 올라간다 (§21).
         상대가 압박하지 않을수록 더 적극적으로 전진한다. */
      let carryK=1;
      {
        const A3=(carrier.p&&carrier.p.attr)||{};
        const drb=clamp(attr20(A3.dri!=null?A3.dri:60)/20, 0.15, 1);
        const pac=clamp(carrier.paceSkill!=null?carrier.paceSkill:0.6, 0.1, 1.2);
        let ahead=9;
        for(const o of opps){
          if(o.slot==="GK") continue;
          if((o.x-carrier.x)*carrier.dir < 0.01) continue;          // 내 앞에 선 사람만
          const d=HYP((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
          if(d<ahead) ahead=d;
        }
        const space=clamp((ahead-0.09)/0.16, 0, 1);                 // 6m 밖부터 값이 오른다
        /* ⚠ 소유 시간을 공간에 따라 늘려 봤지만(최대 2.35배) 경기당 행동 수가 줄어
           팀당 패스가 237→204회로 떨어졌다. 운반은 위의 _carryS 가 「패스와 겨루게」
           하는 것으로 충분하고, 소유 시간까지 건드릴 필요는 없다. */
        carryK = 1 + space*(0.10+drb*0.12+pac*0.08);
      }
      /* 바이라인·박스 근처에서는 오래 쥐고 서 있지 않는다 — 동료 침투를 기다리더라도
         짧게 끊어 자주 재판단한다 (제보: 골라인 앞에서 몇 초씩 멈춰 서 있던 현상) */
      const _advH=(carrier.dir>0?carrier.x:1-carrier.x);
      const _zoneK=_advH>0.72 ? 0.40 : 1;
      /* 🔁 윙어–풀백 콤보 — 측면에서 볼을 가진 윙어는 같은 쪽 풀백이 오버랩 중이면 잠깐 더 쥐고 기다린다
         (풀백에게 시간을 준다). 뒤 18m 안에서 달려오고 있을 때만, ×WING_WAIT_K. */
      let _waitK=1;
      if(Math.abs(carrier.y-0.5)>0.22 && _advH>0.55){
        const _cs=carrier.y<0.5?-1:1;
        for(const m of mates){
          if(!(m.slot==="LB"||m.slot==="RB"||m.slot==="LWB"||m.slot==="RWB") || !m.home) continue;
          if((m.home.y<0.5?-1:1)!==_cs) continue;
          if(m.offRole!==OFF_ROLE.OVERLAP && m.offRole!==OFF_ROLE.UNDERLAP) continue;
          const da=((carrier.dir>0?m.x:1-m.x)-_advH);
          if(da>-0.16 && da<0.02){ _waitK=WING_WAIT_K; break; }
        }
      }
      this.ball.hold=(0.6+Math.random()*0.7)*TEMPO*holdTr*carryK*_zoneK*_waitK*this.tempoK(key)*(this.counterOn(key)?(0.80-this.counterK(key)*0.35):1);
      return;
    }
    // 압박이 극심하고 옵션도 나쁘면 걷어낸다(롱볼)
    // 역할: 안정형 수비수/안정형 풀백/인버티드 풀백은 애매하면 그냥 걷어낸다
    const cf=FX(carrier,"clearFirst");
    /* ⚠ 회귀 하네스 첫 실행에서 잡힌 크래시(2026-09-13): opts 가 비면 best 가 undefined 인데
       여기서만 무방비로 .score 를 읽어 경기가 통째로 터졌다(다른 자리는 전부 !best 를 본다).
       패스 후보가 하나도 없다 = 갇혔다 → 걷어내는 게 맞는 판단이다. */
    const _bScore = best ? best.score : -9;
    const wantClear = !best
                   || (cf>0 && _bScore < -0.25+cf*0.55 && selfPress > 1.1-cf*0.55)
                   || (_bScore<-0.25 && selfPress>1.1);
    if(wantClear){
      /* 걷어내기 전에 「안전한 한 발」을 찾는다 — 침착성·기술이 좋을수록 잘 빼낸다.
         안정형 수비수(clearFirst)는 애초에 그냥 걷어내는 쪽을 선호한다. */
      const A=(carrier.p&&carrier.p.attr)||{};
      const esc = clamp((attr20(A.cmp!=null?A.cmp:60)/20)*0.55
                      + (attr20(A.tec!=null?A.tec:60)/20)*0.30
                      + (attr20(A.fir!=null?A.fir:60)/20)*0.15
                      + clamp(FX(carrier,"escape"),0,1)*0.25   // 특성: 압박을 흘리며 빠져나감
                      - cf*0.30, 0.05, 1);
      const eo = escapeOption(carrier, opts, opps, esc);
      if(eo){ const ep=findBestPass(carrier, mates, opps, Object.assign({}, pctx, {pick:()=>eo}));
              if(ep){ if(!this.lookThenPass(carrier, ep)) return; this.startPass(carrier, ep); return; } }
      /* 🚪 「길 열기」 — 네 번째 시도까지 전부 실패해 닫는다. 기록:
           ① OUTLET 볼 기준 배치      → 구조 붕괴 (골 10→18)
           ② SHOW 의도 (출구≤1)       → 패스 251→206 · 걷어내기 오히려 증가
           ③ SHOW 엄격판 (출구 0)     → 골 2.75→5.0
           ④ 수직 비킴 + 캐리어 버팀   → 걷어내기 +1.1(무효) · 골 2.2→6.8 (버티다 탈취)
         걷어내기 ~49회는 이 엔진의 압박 강도에서 나오는 구조적 숫자로 받아들인다.
         갇힌 공은 걷어내는 게 실점보다 낫다 — 실제 로우블록 축구도 그렇다. */
      this.clearBall(carrier); return;
    }
    const plan=findBestPass(carrier, mates, opps, Object.assign({}, pctx, {pick:()=>best}));
    if(plan){ if(!this.lookThenPass(carrier, plan)) return; this.startPass(carrier, plan); }
    else this.clearBall(carrier);
  }
  /* 👀 노룩 방지 (제보: 우측 보면서 좌측 백패스) — 패스 방향이 시선과 60°+ 어긋나면
     몸을 그쪽으로 돌리는 동안 킥을 미룬다. 천재성(플레어)이 아주 높으면 가끔 진짜 노룩을 찬다.
     반환: true=차도 된다, false=돌고 있다(이번 판단은 보류). */
  lookThenPass(carrier, plan){
    if(carrier.face===undefined) return true;
    const o2=plan.opt||plan;
    if(!o2.to) return true;
    const ang=Math.atan2(o2.to.y-carrier.y, (o2.to.x-carrier.x)*PITCH_AR);
    let df=ang-carrier.face;
    while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
    if(Math.abs(df)<=1.05) return true;
    const A=(carrier.p&&carrier.p.attr)||{};
    const fla=clamp(attr20(A.fla!=null?A.fla:55)/20, 0.15, 1);
    if(fla>0.80 && Math.random()<0.30) return true;   // 진짜 노룩 — 천재의 몫
    carrier._kickFace={ang, until:this.t+0.7};
    this.ball.hold=clamp(Math.abs(df)/(TURN_RATE*(0.85+(carrier.agility||0.6)*0.85)), 0.15, 0.55);
    return false;
  }
  startPass(carrier, plan){
    try{ this._pEpRelease(carrier, "pass", (plan&&(plan.opt||plan).to)||null); }catch(e){}   // 🎯 압박 결과
    const b=this.ball, st=this.stats[carrier.side];
    /* 🔁 2대1 시퀀스 종결 — 벽 역할(수신자)이 어디로든 차는 순간 시퀀스는 끝난다.
       최초 패서에게 되돌아가면 성공으로 기록한다 (§30). */
    if(b._oneTwo){
      const ot0=b._oneTwo;
      const opt0=plan.opt||plan;
      if(ot0.recvId===carrier.id){
        if(opt0.to && opt0.to.id===ot0.initId && this.t<ot0.until){
          st.oneTwo=(st.oneTwo||0)+1;
          this.evl("ONE_TWO", carrier, {to:opt0.to.id, toNm:this.nm(opt0.to)});
        }
        b._oneTwo=null;
      } else if(this.t>=ot0.until) b._oneTwo=null;
    }
    const opt=plan.opt||plan;
    carrier._cbFrom=null;                    // 🎯 컷백 창 종료 — 찼다
    st.pass++; st.passLen+=opt.dist;
    if(opt.dist>0.45) st.longPass++;   // 30m 이상을 롱패스로 본다
    const ratio=opt.dist>1e-6 ? opt.forward/opt.dist : 0;   // 전진 성분의 비율(각도)로 분류
    if(ratio>0.35) st.fwd++; else if(ratio<-0.35) st.back++; else st.lat++;
    const pl=plan;
    st.powerSum+=pl.power;
    if(pl.type===PASS_TYPE.THROUGH) st.toSpace++;
    if(pl.type===PASS_TYPE.LONG) st.longPassT++;
    else if(pl.type===PASS_TYPE.SHORT) st.shortPass++;
    this.lastTouch=carrier.side;
    b.state="PASS"; b.fromId=carrier.id; b.toId=opt.to.id; b.ownerId=null;
    // 도움 후보 — 이 패스를 받은 선수가 곧바로 골을 넣으면 도움으로 기록된다
    this.lastAssist={id:carrier.id, side:carrier.side, t:this.t};
    // 해설 — 스루패스/롱패스/짧은 패스를 구분해 말한다
    if(this.recording){
      const dM=HYP((opt.to.x-carrier.x)*PITCH_AR, opt.to.y-carrier.y)*ISO_TO_M;
      const pool = pl.type===PASS_TYPE.THROUGH ? COMM.lvThrough : (dM>32 ? COMM.lvPassLong : COMM.lvPass);
      this.cap(carrier.side, pool, {p:this.nm(carrier), q:this.nm(opt.to)}, true);
      let lg=0;   // 수비 라인 붕괴 — 센터백 하나가 끌려 나와 라인에 6m+ 구멍이 난 상태
      if(pl.type===PASS_TYPE.THROUGH || pl.type===PASS_TYPE.LEAD){
        let mn=9, mx=-9;
        for(const q of this.side(this.opp(carrier.side))){
          if(q.slot!=="LCB" && q.slot!=="CB" && q.slot!=="RCB") continue;
          const od=q.dir>0?q.x:1-q.x;
          if(od<mn) mn=od; if(od>mx) mx=od;
        }
        if(mx>-9 && mn<9 && mx-mn>0.055) lg=1;
      }
      this.evl("PASS", carrier, {to:opt.to.id, toNm:this.nm(opt.to), pt:pl.type, dM:Math.round(dM),
        press:this._bu?+(this._bu.press||0).toFixed(2):0, bu:this._bu?this._bu.state:null, air:pl.lofted?1:0, lg});
    }
    b.power=pl.power; b.toSpace=(pl.type===PASS_TYPE.THROUGH); b.passType=pl.type;
    this.bpWatch(carrier, opt, pl);          // ⏮️ 뒤로 돌렸다면 상대에게 압박 창이 열린다
    this.abWatch(carrier, opt, pl);          // 🪂 롱볼이면 떨어지는 순간에 맞춰 창을 예약한다
    b.aerial = pl.lofted;              // 띄운 공만 공중볼 — 지상 커트가 안 되고 낙하 지점에서 경합한다
    // 오프사이드는 "패스가 나가는 순간"의 위치로 판정한다. 부심 깃발은 볼이 도착한 뒤 올라간다.
    const defs=this.side(this.opp(carrier.side));   // 키퍼 포함 — 뒤에서 두 번째가 곧 최종 수비수다
    b.offsideAt = isOffsidePos(opt.to, carrier, defs, carrier.dir)
                ? {x:opt.to.x, y:opt.to.y, by:carrier.side} : null;
    // 목표는 findBestPass 가 이미 정했다 — 발밑이거나, 달려가 만날 미래의 공간이거나.
    b.tx=clamp01(pl.tx); b.ty=clamp01(pl.ty);
    b.flight=0; b.flightT=pl.T;
    b.flightLen=HYP((b.tx-b.x)*PITCH_AR, b.ty-b.y);
    resolveKick(b, carrier, (b.passType===PASS_TYPE.THROUGH||b.passType===PASS_TYPE.LEAD)?KICK.SPACE:KICK.PASS, {lofted:!!b.aerial, curve:pl.curve||0});
    b._opt=opt;
    b._passer=carrier;
    b._pCut=(opt && opt.pCut!=null) ? opt.pCut : null;   // 🎯 고를 때 예측한 차단 확률 (캘리브레이션)
    b._plan={type:pl.type, grade:pl.grade, diff:pl.diff, exec:pl.exec,
             latM:pl.latM, lonR:pl.lonR, aim:pl.aim, toId:(pl.to&&pl.to.id),
             space:pl.space, leadM:(pl.lead||0)*67,
             idealX:(pl.to?pl.to.x:null), idealY:(pl.to?pl.to.y:null)};
    b._through = (pl.type===PASS_TYPE.THROUGH || pl.type===PASS_TYPE.LEAD);   // 🎯 스루/리드 — 달려 들어간다 — 수신자는 기다리지 않고 공간으로 달린다
    /* ⚠ 제보 — 「공이 너무 자주 죽는다 — 스로인 경기당 80~100회」. 가장 큰 원인이 여기였다.
       바로 위 주석은 「스루/리드 — 달려 들어간다」인데 코드는 THROUGH 만 startChase 를 걸었다.
       리드 지점은 interceptPointAccel 이 「수신자가 최고 속도로 가속한다」고 가정해 5~13m 앞을
       찍는데, 실제 수신자는 calcReceiveTarget 의 낙하점 목표를 평소 속도로 걸어갔다.
       실측 1경기(seed=1, 패스 440회): SPACE/LEAD 103회 중 동료 수신 14회(14%), 69회는
       「수신자 4.2m 밖」으로 흘림 — 흘린 순간 수신자 평균 9.5m 거리·2.7m/s·_chase 0/69.
       흘린 공은 17m/s 로 평균 17m 를 굴러 라인을 넘었다(스로인 26회 + 골킥 9회 / 경기).
       비교: chase 가 있는 THROUGH 는 11회 중 5회 수신. LEAD 도 같은 경로를 탄다. */
    if(pl.type===PASS_TYPE.THROUGH || pl.type===PASS_TYPE.LEAD) this.startChase(opt.to, b.tx, b.ty);
    /* 🧠 길목 읽기 — 종류를 가리지 않는다. 이미 쫓는 사람은 startLaneCut 안에서 걸러진다 */
    try{ this.startLaneCut(carrier, b.tx, b.ty); }catch(e){}
    /* ═══ 📮 PASS & MOVE — 패스는 다음 움직임의 트리거다 ═══
       패서의 의도 캐시를 지워 다음 틱에 즉시 재결정하게 하고, 패스 방향·압박 맥락을
       한 번의 재결정에만 쓰이는 힌트로 남긴다. 「항상 뛰기」는 금지 — 가점만 주고
       기존 의도 점수 경쟁(지원·정지·후퇴·공간창출 포함)이 최종 선택한다. */
    /* 즉시(0초) 재결정은 공격 템포가 수비 재편성을 앞질러 골이 3.3+/반경기로 뛰었다.
       패스 후 0.4초 뒤 재결정 — 사람이 차고 고개를 드는 딱 그 시간이다. */
    carrier._spotAt=this.t-1.2;
    carrier._pp={fwd:ratio>0.35?1:0, back:ratio<-0.35?1:0,
                 thru:(pl.type===PASS_TYPE.THROUGH||pl.type===PASS_TYPE.LEAD)?1:0,
                 press:this._bu?(this._bu.press||0):0};
    /* 🔁 2대1 (기브 앤 고) — 조건 점수제 (§6): 앞 공간·수신자 여유·거리 밴드·능력·성향.
       성립하면 볼에 시퀀스 마커를 달아 수신자의 패스 평가가 리턴패스를 알아보게 한다. */
    {
      const A5=(carrier.p&&carrier.p.attr)||{};
      const g5=k=>clamp(attr20(A5[k]!=null?A5[k]:60)/20, 0.15, 1);
      let frontOpp=0;
      for(const o of this.side(this.opp(carrier.side))){
        const fx2=(o.x-carrier.x)*PITCH_AR*carrier.dir, fy2=Math.abs(o.y-carrier.y);
        if(fx2>0.005 && fx2<0.18 && fy2<0.10) frontOpp++;
      }
      const dM2=opt.dist*67;
      const recvFree=clamp(1-(opt.recvPress||0)/0.50, 0, 1);
      const adv5=carrier.dir>0?carrier.x:1-carrier.x;
      let ot = 0.14 + (frontOpp===0?0.30:frontOpp===1?0.12:0)
             + recvFree*0.22 + ((dM2>=6&&dM2<=22)?0.12:-0.25)
             + (g5("otb")-0.55)*0.35 + (g5("dec")-0.55)*0.22 + (g5("tea")-0.55)*0.18
             + FX(carrier,"oneTwo")*0.30 + Math.max(0, adv5-0.45)*0.25
             - (ratio<-0.2?0.30:0);
      if(this.counterOn(carrier.side)) ot+=0.10;
      /* §17 — 내가 빠지면 내 레인이 통째로 빈다. 뒤를 받쳐주는 동료가 있어야 침투한다 */
      {
        let cover=0;
        for(const m2 of this.side(carrier.side)){
          if(m2===carrier || m2.slot==="GK") continue;
          if((carrier.x-m2.x)*carrier.dir>0.01 && Math.abs(m2.y-carrier.y)<0.15){ cover=1; break; }
        }
        ot += cover ? 0.05 : -0.16;
      }
      /* 🔁 콤비네이션 점검 (제보 「2대1·3자 연계 되는지 봐줘」) — 실측: 시도 91회/경기 · 완성 3회(3%).
         문턱을 올려 시도를 정선하고, 아래(수신자 hold 단축·되돌림 가점 개편)로 완성률을 올린다. */
      if(ot>0.62 && (carrier.burstReady||0)<=this.t && carrier.slot!=="GK"
         && Math.random()<clamp((ot-0.55)*0.55, 0, 0.30)){   // ⚠ 문턱만 올려선 시도 91회 그대로(ot 가 대개 0.8+) — 확률 자체를 줄인다
        this.tryBurst(carrier);
        carrier._pp.thru=1;                       // 되받을 생각으로 뛴다
        b._oneTwo={initId:carrier.id, recvId:opt.to.id, until:this.t+2.8};
        this.evl("ONE_TWO_REQ", carrier, {to:opt.to.id, toNm:this.nm(opt.to)});
      }
    }
  }
  /* 공간으로 찔러준 공을 향해 달려간다.
     받을 선수는 전력질주로 낙하 지점을 향해 뛰고, 그 지점에 가장 가까운 상대도 함께 달려든다.
     그래서 공간 패스는 "먼저 닿는 쪽이 갖는" 경합이 된다. */
  startChase(recv, tx, ty){
    const until=this.t+CHASE_MAXT;
    if(recv && recv.slot!=="GK"){
      recv._chase={x:tx, y:ty, until};
      this.tryBurst(recv);
    }
    // 가장 먼저 반응하는 상대 한 명 — 낙하 지점 근처에 있어야 쫓아갈 수 있다
    let best=null, bd=1e9;
    for(const o of this.side(this.opp(recv.side))){
      if(o.slot==="GK") continue;
      let d=HYP((o.x-tx)*PITCH_AR, o.y-ty);
      // 스위퍼는 라인 뒤로 넘어온 공을 정리하는 게 본업이라 남들보다 먼저 반응한다
      d *= 1 - clamp(FX(o,"sweepBack"), 0, 1)*SWEEP_EDGE;
      if(d<bd){ bd=d; best=o; }
    }
    if(best && bd<0.20){
      // 반응 지연 — 수비수는 패스가 나가는 순간 바로 몸을 돌리지 못한다.
      // 이 0.2~0.5초가 라인 브레이킹이 성립하는 이유다. 판단력이 좋을수록 짧다.
      // 같은 선수라도 매번 똑같이 반응하지는 않는다 — ±25% 흔들어 준다
      const delay = (REACT_MIN + (REACT_MAX-REACT_MIN)*(1.15-(best.decSkill||0.6)))
                    * (0.75+Math.random()*0.50);
      best._chase={x:tx, y:ty, until, startAt:this.t+delay};
      // 지연이 끝난 뒤에 스퍼트가 붙도록 예약해 둔다
      best._burstAt = this.t + delay;
    }
  }
  /* ═══ 🧠 길목 읽기 — 패스가 나가는 순간 한 명이 「경로 위 한 점」으로 나간다 ═══════════
     ⚠ 제보 — 「수비수가 읽고 나가는 동작이 없다. 지금 차단은 순전히 우연히 몸에 맞았나다.
        그리고 이건 수비수뿐만 아니라 미드필더·공격수도 있어야 하는 움직임이다」.
     startChase 는 <b>도착 지점</b>으로 달리는 경주(공간 패스 전용)다. 이건 다르다 —
     공이 <b>지나가는 길</b> 위의 한 점으로 나가서 가로챈다. 압박 나간 스트라이커가 백패스를
     읽고 튀어나가는 그 장면이다. 그래서 포지션을 가리지 않는다(키퍼만 제외).
     ─ 규칙: ① 닿을 수 있을 때만(공보다 먼저 도착) ② 한 패스에 한 명만
             ③ 읽는 눈(예측·판단·위치선정)이 확률을 정하고, 좋은 패서는 길목을 숨긴다
             ④ 나간 선수는 자기 자리를 비운다 — 잘못 읽으면 그 공간이 열린다(대가). */
  startLaneCut(passer, tx, ty){
    const b=this.ball;
    if(b.aerial) return;                       // 뜬 공은 낙하점 경주(startAerialRace)가 맡는다
    const sx=b.x, sy=b.y;
    const L=HYP((tx-sx)*PITCH_AR, ty-sy);
    if(L<0.06) return;                         // 4m 남짓 짧은 패스는 읽을 것도 없다
    const T=b.flightT || Math.max(0.1, L/(PASS_SPEED*(b.power||1)));
    const tMin=Math.min(0.85, (ITC_BLIND_M/ISO_TO_M)/L);   // 발끝은 제외
    let best=null;
    for(const o of this.side(this.opp(passer.side))){
      if(o.slot==="GK") continue;                          // 키퍼는 스위핑 로직이 따로 있다
      if(o._down && o._down>this.t) continue;
      if(o._chase && o._chase.until>this.t) continue;      // 이미 다른 공을 쫓는 중
      /* 🛡️ 최후방은 나가지 않는다 — 내 뒤(우리 골문 쪽)를 받쳐 줄 동료가 있어야 한다.
         이게 없으면 마지막 수비수가 길목을 읽고 튀어나가 뒤가 통째로 열린다(실측). */
      { let cover=false;
        for(const m2 of this.side(o.side)){
          if(m2===o || m2.slot==="GK") continue;
          if((o.x-m2.x)*o.dir > 0.012){ cover=true; break; }
        }
        if(!cover) continue; }
      /* 🎯 차단 지점 탐색 — 궤적을 훑어 「가장 여유 있게 닿는 한 점」을 찾는다.
         ballTime(그 지점에 공이 오는 시각) vs defenderTime(그가 거기 닿는 시각). */
      let bp=null;
      for(let k=0;k<=8;k++){
        const t=tMin+(0.90-tMin)*(k/8);
        const px=sx+(tx-sx)*t, py=sy+(ty-sy)*t;
        const slack=T*t - defenderTime(o, px, py, passer);
        if(!bp || slack>bp.slack) bp={t, px, py, slack};
      }
      if(bp && (!best || bp.slack>best.slack)) best={o, ...bp};
    }
    /* INTERCEPT / DEFLECT / PASS — 여유가 얼마나 있느냐가 셋을 가른다 */
    if(!best || best.slack < ITC_TOUCH) return;            // PASS — 아무도 못 간다
    const kind = best.slack>=ITC_CLEAN ? "INTERCEPT" : "DEFLECT";
    const o=best.o;
    o._chase={x:best.px, y:best.py, until:this.t+Math.min(CHASE_MAXT, T+0.7),
              startAt:this.t+itcReact(o)};
    o._burstAt=this.t+itcReact(o);
    o._itcKind=kind;                                       // 굴절이면 발끝만 닿는다
    this._laneRead=(this._laneRead||0)+1;
    if(kind==="DEFLECT") this._laneTouch=(this._laneTouch||0)+1;
    this.evl("LANE_READ", o, {k:kind, s:+best.slack.toFixed(2)});
  }
  /* ⚽ 뜬 공 낙하점 경주 — <b>목표 없이 찬 공</b>(걷어내기·골킥)에 양 팀에서 한 명씩 붙인다.
     ⚠ 왜 필요한가 — 크로스·스루패스에는 startChase 로 「받을 사람 + 가장 먼저 반응하는 상대」가
        붙는데, 걷어내기와 골킥에는 그게 <b>아예 없었다</b>. 아무도 겨냥하지 않은 공이라
        받을 사람이 없으니 이 장치를 안 태운 것이다.
        실측(2경기 · 공중볼 도착 435회) — 도착 순간 경합 반경 안에 아무도 없는 경우가 215회(49%).
        그중 대부분이 이 「목표 없는 공」이다. 세컨볼 역할로 메우려 했지만
        <b>거리가 안 됐다</b> — SEC_R 21m 를 체공 1.5~2.5초에 갈 수 없다.
        해법은 「더 세게 부르는 것」이 아니라 <b>공이 발을 떠나는 순간 출발시키는 것</b>이다.
        그러면 체공 시간을 통째로 쓴다.
     ⚠ 낙하점은 ballLand() 로 구한다 — b.tx 는 걷어내기에서 그냥 「대충 옆으로」일 뿐이다.
     ⚠ 반응 지연·읽는 눈은 startChase 와 같은 잣대를 쓴다. 즉시 순간이동하지 않는다. */
  startAerialRace(){
    const b=this.ball;
    if(!b.aerial || b.state!=="PASS") return;
    const LP=ballLand(b, this.t);
    if(LP.t < 0.5) return;                                  // 곧 떨어지는 공은 경주가 성립하지 않는다
    const until=this.t+CHASE_MAXT;
    const _atkSide=(b._passer && b._passer.side) || null;
    for(const k of ["h","a"]){
      let best=null, bd=1e9;
      for(const p of this.side(k)){
        if(p.slot==="GK") continue;
        if(p._down && p._down>this.t) continue;
        if(p._chase && p._chase.until>this.t) continue;     // 이미 다른 공을 쫓는 중
        let d=HYP((p.x-LP.x)*PITCH_AR, p.y-LP.y);
        d *= 1 - clamp(FX(p,"sweepBack"), 0, 1)*SWEEP_EDGE; // 스위퍼는 먼저 반응한다
        /* 👤 「누가 좋은 자리를 선점하는가」 — 예측력만 보던 걸 자리 잡는 능력까지 본다.
           공격 측은 오프 더 볼(수비 견제를 피해 낙하지점을 찾는 능력),
           수비 측은 수비 위치 선정. 같은 거리라도 이게 좋으면 먼저 도착한 셈으로 친다. */
        const _spot = (k===_atkSide) ? (p.aerialPos!=null?p.aerialPos:0.6)
                                     : (p.posSkill!=null?p.posSkill:0.6);
        d *= (1.30 - lbAnt(p)*0.28 - clamp(_spot,0,1.2)*0.16);
        if(d<bd){ bd=d; best=p; }
      }
      /* 체공 시간 안에 닿을 수 있는 거리만 부른다 — 못 갈 사람을 부르면 자리만 비운다 */
      if(best && bd < clamp(LP.t*0.135, 0.10, 0.34)){
        const delay=(REACT_MIN+(REACT_MAX-REACT_MIN)*(1.15-(best.decSkill||0.6)))
                    *(0.75+Math.random()*0.50);
        best._chase={x:LP.x, y:LP.y, until, startAt:this.t+delay};
        best._burstAt=this.t+delay;
      }
    }
  }
  /* 스로인 — 손으로 던지는 공. 포물선으로 뜨고 발로 찬 패스보다 느리며 멀리 가지 않는다.
     던진 공에는 오프사이드가 적용되지 않는다(축구 규칙). */
  startThrow(carrier, opt){
    const b=this.ball, st=this.stats[carrier.side];
    st.pass++; st.passLen+=opt.dist;
    const ratio=opt.dist>1e-6 ? opt.forward/opt.dist : 0;
    if(ratio>0.35) st.fwd++; else if(ratio<-0.35) st.back++; else st.lat++;
    this.lastTouch=carrier.side;
    b.state="PASS"; b.fromId=carrier.id; b.toId=opt.to.id; b.ownerId=null;
    b.aerial=true;                                  // 손으로 던진 공은 뜬다
    b.power=0.42+(carrier.passSkill||0.6)*0.14;     // 발로 찬 공보다 확연히 느리다
    b.isCross=false; b.offsideAt=null;              // 스로인은 오프사이드 없음
    b.tx=clamp01(opt.to.x); b.ty=clamp01(opt.to.y);
    b.flight=0; b.flightLen=opt.dist;
    /* 🤾 ⚠ 요청 원문 — 「스로인된 공이 지금은 프리킥 차듯 패스처럼 되던데, 이것도
       포물선으로 높게 떨어지게 해줘」.
       원인: 체공 시간이 짧아(15m에 1.1초) 포물선 최고점이 1m도 안 됐다 — 화면에서는
       땅으로 깔려 가는 패스와 구분이 안 된다.
       ─ 체공을 늘리고(최고점 = GRAVITY·T²/8), 출발 높이를 머리 위로 올린다. */
    /* 실측 튜닝 — 0.075 배율은 20m 스로인의 최고점이 10m까지 솟았다(포환던지기).
       실제 스로인은 1.3~1.8초 체공에 최고점 4~5m다. */
    b.flightT=clamp(0.60 + opt.dist*ISO_TO_M*0.055, 0.85, 1.90);
    resolveKick(b, carrier, KICK.THROW, {z0:THROW_HAND_Z});
    b._opt=opt; b._passer=carrier;
    b._thrownOut=1;                                 // 🤾 라인 밖에서 출발한 공 (필드에 들어올 때까지 아웃 판정 유예)
    b.isThrow=false;                                // 던졌으니 해제
    st.powerSum+=b.power;
    /* 🤾 스로인 압박 — 던지는 순간 상대 한 명이 리시버에게 붙는다.
       ⚠ 스로인에는 <b>아무 추격 장치도 없었다</b>. 크로스·스루패스에는 startChase 로
          「받을 사람 + 가장 먼저 반응하는 상대」가 붙고, 걷어내기·골킥에는
          startAerialRace 로 양 팀 한 명씩이 낙하점으로 간다. 스로인만 비어 있었다.
          그래서 스로인 받는 선수는 <b>아무도 안 붙은 채로</b> 공을 받았다 —
          실축에서는 던지는 순간 상대가 달라붙는 게 기본이다.
       ⚠ startChase 를 그대로 쓰지 않는 이유 — 그건 받을 사람에게도 _chase 와 스퍼트를 건다.
          스로인 리시버는 이미 그 자리에 서 있으므로 체력만 버린다. 붙는 쪽만 만든다.
       ⚠ 목표는 「받는 선수의 자리」다. 체공이 0.85~1.90초로 짧아 낙하점 경주는 성립하지 않는다
          (갈 수 있는 거리가 스로인 사거리와 비슷하다). 사람에게 붙는 쪽이 맞다. */
    {
      const foe=this.side(this.opp(carrier.side));
      let best=null, bd=1e9;
      for(const o of foe){
        if(o.slot==="GK") continue;
        if(o._down && o._down>this.t) continue;
        if(o._chase && o._chase.until>this.t) continue;
        let d=HYP((o.x-b.tx)*PITCH_AR, o.y-b.ty);
        d *= (1.30 - lbAnt(o)*0.40);          // 읽는 눈이 나쁘면 늦게 알아챈 셈 (다른 추격과 같은 잣대)
        if(d<bd){ bd=d; best=o; }
      }
      if(best && bd<THROW_PRESS_R){
        const delay=(REACT_MIN+(REACT_MAX-REACT_MIN)*(1.15-(best.decSkill||0.6)))
                    *(0.75+Math.random()*0.50);
        /* ⚠ 스퍼트(_burstAt)는 걸지 않는다 — 거리가 12m 안쪽이라 전력질주는 과하다.
           실측: 버스트를 주면 스로인 소유권 상실률이 12.8% → 32.2% 로 뛰었다.
           스로인 압박은 달려들어 뺏는 게 아니라 <b>붙어서 못 돌게 하는</b> 동작이다. */
        best._chase={x:b.tx, y:b.ty, until:this.t+CHASE_MAXT*0.5, startAt:this.t+delay};
      }
    }
  }
  /* 크로스를 올린다. 공중 크로스는 낙하 지점에서 헤딩 경합이 붙고, 컷백은 낮게 깔린 땅볼이라
     경합 없이 이어지지만 커트당할 수 있다. */
  startCross(carrier, cr){
    const b=this.ball, st=this.stats[carrier.side];
    st.pass++; st.passLen+=cr.dist; st.cross++;
    this.evl("CROSS", carrier, {ct:cr.type, traj:cr.traj});
    // 크로스 차단 — 붙어 선 수비수가 발을 뻗어 막는다. 막힌 공은 튀어나가고, 골라인 밖이면 코너킥.
    {
      const opps=this.side(this.opp(carrier.side));
      let near=null, nd=9;
      for(const o of opps){
        if(o.slot==="GK") continue;
        if((o.x-carrier.x)*carrier.dir < -0.010) continue;      // 크로스를 올리는 쪽 앞에 있어야 막는다
        const d=HYP((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
        if(d<nd){ nd=d; near=o; }
      }
      if(near && nd<CROSS_BLOCK_R){
        const pb=CROSS_BLOCK_P*(1-nd/CROSS_BLOCK_R)*(0.55+(near.tackleSkill||0.6)*0.75);
        if(Math.random()<pb){
          st.crossBlocked++; this.stats[near.side].block++;
          this.lastTouch=carrier.side;                          // 마지막 터치는 크로스를 올린 쪽
          b.state="SETTLED"; b.ownerId=null; b.isCross=false; b.aerial=false; b.offsideAt=null;
          // 바이라인 근처에서 막힌 크로스는 그대로 골라인을 넘는 일이 잦다 → 코너킥
          const adv=carrier.dir>0 ? carrier.x : 1-carrier.x;
          if(adv>0.76 && Math.random()<CROSS_CORNER_P){
            this.lastTouch=near.side;
            this.cornerKick(carrier.side, carrier.dir>0?1:0, clamp01(carrier.y));
            return;
          }
          this.looseBall(near, 0.26);   // 나머지는 다시 경기장 안으로 흐른다
          return;
        }
      }
    }
    if(cr.type===CROSS_TYPE.CUTBACK) st.crossCutback++;
    else if(cr.pos===CROSS_POS.BYLINE || cr.pos===CROSS_POS.NEAR_CORNER) st.crossByline++;
    else st.crossEarly++;
    const ratio=cr.dist>1e-6 ? (cr.tx-carrier.x)*carrier.dir/cr.dist : 0;
    if(ratio>0.35) st.fwd++; else if(ratio<-0.35) st.back++; else st.lat++;
    this.lastTouch=carrier.side;
    b.state="PASS"; b.fromId=carrier.id; b.toId=cr.to.id; b.ownerId=null;
    this.lastAssist={id:carrier.id, side:carrier.side, t:this.t};   // 크로스도 도움 후보다
    this.cap(carrier.side,
      cr.type===CROSS_TYPE.CUTBACK ? COMM.lvCutback
      : (cr.traj===CROSS_TRAJ.LOW)
        ? ["🛴 {p}, 낮게 깔아 보냅니다!","🛴 {p}의 낮은 크로스 — 문전을 가로지릅니다"]
      : COMM.lvCross, {p:this.nm(carrier)}, true);
    carrier._cbFrom=null;                    // 🎯 컷백 창 종료 — 다시 올렸다
    b.aerial=cr.aerial;                      // 낮은 크로스·컷백은 땅볼
    b.isCross=true; b.crossType=cr.type; b.crossZone=cr.zone; b.crossTraj=cr.traj;
    // 크로스 정확도 — 능력치가 낮으면 목표에서 벗어나 흘러간다
    // 크로스는 정확히 머리에 맞추기 어렵다. 컷백은 짧고 낮아 상대적으로 정확하다.
    // 오차 ±10m 짜리 크로스는 아무에게도 닿지 않는다. 실제 크로스 성공률(약 25%)에 맞춰
    // 낙하 지점이 타깃 주변 3~5m 안에 들어오도록 좁힌다.
    const cdl=decideCrossDelivery(carrier, cr, {opps:this.side(this.opp(carrier.side))});
    b.power=cdl.power;
    if(cdl.floated) st.crossFloat++; else st.crossDriven++;
    st.powerSum+=cdl.power;
    /* 🎯 크로스 품질 — 능력·시야·판단·몸 방향·압박·거리로 정확도가 갈린다 (§18) */
    /* 🧍 크로스각 점검(요청) — 위 주석의 「몸 방향」이 식에 없었다. 시선과 크로스 방향의 어긋남이
       20° 안이면 0, 90°(lookThenPass 문턱 60° 를 천재 노룩으로 넘긴 경우)면 −0.14.
       세트피스(_spBall)는 자리를 잡고 차므로 제외. */
    let _bodyPen=0;
    if(carrier.face!==undefined && !b._spBall){
      const _ca=Math.atan2(cr.ty-carrier.y, (cr.tx-carrier.x)*PITCH_AR);
      let _df=_ca-carrier.face;
      while(_df>Math.PI) _df-=Math.PI*2; while(_df<-Math.PI) _df+=Math.PI*2;
      _bodyPen=clamp((Math.abs(_df)-0.35)/1.22, 0, 1)*0.14;
    }
    const q = clamp(0.28 + (carrier.crossSkill||0.6)*0.52 + (carrier.decSkill||0.5)*0.12
                  + (carrier.passSkill||0.6)*0.08
                  - pressureOn(carrier, this.side(this.opp(carrier.side)), 1)*0.20
                  - Math.max(0, cr.dist*ISO_TO_M-26)*0.005 - _bodyPen, 0.10, 1);
    b.crossQ=q;
    /* 오차는 「길이(공 진행 방향)」와 「폭(좌우)」을 나눠서 낸다 — 그래야 종류가 생긴다 */
    /* ⚠ 되돌림 — 오차를 키우면(0.030/0.056 → 0.042/0.076) 크로스 성공률이 <b>더 올라갔다</b>
       (36.0% → 40.0%). 공이 더 흩어지면 박스 안 사람 수가 늘어난 지금은 오히려 누군가에게
       닿기 때문이다. 성공률의 손잡이가 아니다 — 집계 기준(crossHit) 쪽이었다. */
    const base = cr.traj===CROSS_TRAJ.LOW ? 0.030 : 0.056;
    const eLen=(Math.random()-0.5)*2*base*(1.25-q)*1.30;
    const eLat=(Math.random()-0.5)*2*base*(1.25-q)*1.55;
    const dx=(cr.tx-carrier.x)*PITCH_AR, dy=cr.ty-carrier.y, dl=HYP(dx,dy)||1e-6;
    const ux=dx/dl, uy=dy/dl;
    b.tx=clamp01(cr.tx + (ux*eLen - uy*eLat)/PITCH_AR);
    b.ty=clamp01(cr.ty + (uy*eLen + ux*eLat));
    /* 어떻게 빗나갔는지 이름을 붙인다 (§19) */
    {
      const em=HYP(eLen,eLat)*ISO_TO_M;
      const goalSide=(carrier.y<0.5?-1:1);
      b.crossErr = em<2.3 ? CROSS_ERR.GOOD
        : Math.abs(eLen)>Math.abs(eLat)
          ? (eLen>0 ? CROSS_ERR.LONG : CROSS_ERR.SHORT)
          : ((eLat*goalSide>0) ? CROSS_ERR.WIDE : CROSS_ERR.CENTRAL);
      st.crossOff=(st.crossOff||0)+(b.crossErr===CROSS_ERR.GOOD?0:1);
    }
    /* 🏃 공간 배정 — 공격수들이 같은 자리에 겹치지 않게 서로 다른 공간을 맡는다 (§14) */
    {
      const mates=this.side(carrier.side).filter(m=>m!==carrier && m.slot!=="GK");
      const opps2=this.side(this.opp(carrier.side));
      const gk2=opps2.find(o=>o.slot==="GK")||null;
      const zpts=crossZonePoints(carrier, carrier.dir);
      const taken=new Set();
      /* 실제 낙하 지점은 첫 번째 공격수가 맡는다 */
      let first=null, fd=9;
      for(const m of mates){ const d=HYP((b.tx-m.x)*PITCH_AR, b.ty-m.y);
        if(d<fd){ fd=d; first=m; } }
      /* 낙하 지점으로는 실제로 달려간다 — 기존 추격 로직을 그대로 쓴다.
         상대 수비수 한 명도 여기서 함께 반응하기 시작한다. */
      if(first && fd<0.34){ this.startChase(first, b.tx, b.ty); taken.add(first.id); }
      /* 나머지는 남은 공간을 하나씩 나눠 맡는다 — 세컨볼까지 노린다 */
      /* ⚠ 전원이 박스로 쏟아지면 경기가 난장판이 된다(실측: 경기당 5.3골).
         이미 전방에 나가 있는 선수 중 최대 두 명만 다른 공간을 맡는다. */
      const rest=zpts.filter(p=>p.z!==cr.zone);
      let runners=0;
      const upfield=mates.filter(m=>advOf(m, carrier.dir)>0.62);
      for(const p of rest){
        if(runners>=2) break;
        const c=scoreCrossZone(carrier, p, upfield, opps2, gk2, carrier.dir, cr.traj, taken);
        /* 판단력이 낮으면 남이 맡은 공간에 같이 몰리는 실수도 한다 */
        if(!c.A || (c.A.reach<0.12 && Math.random()>0.18)) continue;
        c.A.m._chase={x:p.x, y:p.y, until:this.t+cr.flightT*0.85};   // 다른 공간을 맡아 뛴다
        taken.add(c.A.m.id); runners++;
      }
    }
    b._crossDbg={ type:cr.type, pos:cr.pos, zone:cr.zone, traj:cr.traj, q:q,
                  err:b.crossErr, ix:cr.tx, iy:cr.ty,
                  zones:crossZonePoints(carrier, carrier.dir).map(p=>({z:p.z,x:p.x,y:p.y})),
                  aT:(cr.pick&&cr.pick.A?cr.pick.A.at:null),
                  dT:(cr.pick&&cr.pick.D?cr.pick.D.at:null),
                  gk:(cr.pick?cr.pick.gkRisk:0), T:cr.flightT };
    b.flight=0; b.flightLen=cr.dist;
    /* ⚠ 제보 — "크로스가 높게 날아오는 걸 못 봤다".
       체공 1.3~2.3초는 최고점이 2~3m(사람 키)에 그쳐, 탑뷰에서 땅볼과 구분이 안 됐다.
       실제 크로스는 최고점 5~8m로 확실히 머리 위를 넘어간다.
         · 띄워 올리는 크로스(floated) — 더 높고 느리게, 붙는 선수가 자리를 잡을 시간을 준다
         · 감아 올리는 크로스(driven) — 낮고 빠르게, 그래도 수비 머리는 넘는다 */
    b.flightT = crossFlightT(cr.dist, cr.traj);          // 궤적 프로필이 높이·속도를 정한다
    resolveKick(b, carrier, KICK.CROSS,
      {fromY:carrier.y, floated:(cr.traj===CROSS_TRAJ.LOFTED||cr.traj===CROSS_TRAJ.CHIPPED)});
    b._opt=null; b._passer=carrier;
    // 크로스는 이미 박스 안 동료를 겨냥한 것이라 오프사이드 판정을 따로 한다
    const defs=this.side(this.opp(carrier.side));
    b.offsideAt = isOffsidePos(cr.to, carrier, defs, carrier.dir)
                ? {x:cr.to.x, y:cr.to.y, by:carrier.side} : null;
  }
  /* 🎯 크로스가 우리 편에게 닿았다 — 한 곳에서만 센다.
     ⚠ 여태 이 집계가 <b>giveTo 경로에만</b> 있었다. 그런데 크로스의 가장 좋은 결말인
        「그대로 머리로 마무리」·「원터치 슛」은 전부 그 앞에서 return 하므로 한 번도 안 세였다.
        크로스 성공률이 실축(25%)의 3분의 2로 찍힌 이유가 계수가 아니라 <b>계산</b>이었다. */
  crossHit(a){
    const b=this.ball;
    if(!b.isCross || !b._passer) return;
    if(a && a.side===b._passer.side) this.stats[b._passer.side].crossOk++;
    b.isCross=false;
  }
  /* 🏃 크로스 예비 침투
     📏 실측(n=4, 크로스 186회) — 크로스를 <b>올리는 순간</b> 박스 안 우리 선수가 평균 0.55명,
        57%(106/186)는 <b>한 명도 없다</b>. 수비수조차 평균 1.2명이라 박스가 텅 비어 있다.
     원인: 침투 배정이 startCross 안, 즉 <b>공이 이미 발을 떠난 뒤</b>에만 돌았다.
        비행 1.3~2.3초에 «최대 두 명»이 달려 봐야 25m 밖에서 출발하면 못 닿는다.
        그래서 크로스 성공률이 14~18%(실축 25%)에 머물렀다.
     ─ 실축은 윙어가 「올릴 자세」를 잡는 순간 이미 니어·중앙·파포스트로 들어가 있다.
       캐리어가 크로스를 올릴 만한 자리(깊고 넓은 곳)에 들어오면 그때부터 배정한다.
     ⚠ 전원을 쏟아붓지 않는다 — 세 존에 한 명씩, 그것도 이미 앞에 나가 있는 선수만. */
  boxPrep(){
    const b=this.ball;
    if(b.state!=="SETTLED" || b.setPiece) return;
    if(this._bpAt!=null && this.t-this._bpAt<0.5) return;
    const carrier=this.byId(b.ownerId);
    if(!carrier || carrier.slot==="GK") return;
    const dir=carrier.dir;
    if(advOf(carrier, dir)<0.60 || Math.abs(carrier.y-0.5)<0.20) return;
    this._bpAt=this.t;
    /* ⚠ 오프사이드 — 존이 최종 수비수 뒤라면 그 자리로 부르면 안 된다(실측 오프사이드 8.4/경기,
       실축 4). 침투 지점을 라인 앞으로 당겨 놓는다 — 실제 공격수도 라인에 맞춰 선다. */
    let _line;
    try{ _line=offsideLineX(this.side(this.opp(carrier.side)), dir); }catch(e){ _line=null; }
    /* 📏 20260913-3500 계측 — 컷백 5.0회/경기 중 <b>4.33회(87%)가 슛으로 이어지지 않는다.</b>
       원인: 여기서 니어·중앙·파포스트 셋만 채웠다. 컷백이 떨어지는 자리는 페널티 마크 뒤
       (박스 가장자리, adv≈0.846)인데 <b>아무도 배정되지 않았다</b> — 공만 가고 사람이 없었다.
       ─ 실축에서 그 자리는 뒤늦게 들어오는 미드필더의 자리다. 캐리어가 바이라인 부근까지
         파고들었을 때만 네 번째 자리를 연다(멀리서 올리는 크로스에 컷백은 성립하지 않는다). */
    const _deep = advOf(carrier, dir) > 0.875;
    let zpts;
    try{ zpts=crossZonePoints(carrier, dir).filter(p=>
           p.z===CZONE.NEAR||p.z===CZONE.CENTRAL||p.z===CZONE.FAR||(_deep && p.z===CZONE.CUTBACK)); }
    catch(e){ return; }
    const mates=this.side(carrier.side);
    const taken={};
    for(const p of zpts){
      /* 컷백 자리는 성격이 다르다 — 문전으로 달려드는 공격수가 아니라
         「뒤에서 늦게 들어오는 미드필더」다. 부르는 대상도, 부르는 거리도 따로 본다. */
      const _cut = (p.z===CZONE.CUTBACK);
      let best=null, bd=1e9;
      for(const m of mates){
        if(m===carrier || m.slot==="GK" || taken[m.id]) continue;
        const band=SLOT_BAND[m.slot];
        if(_cut){
          if(band!=="MF" && band!=="AM" && band!=="DM") continue;
          if(advOf(m, dir)<0.42) continue;
        } else {
          if(band!=="FW" && band!=="AM" && band!=="MF") continue;
          if(advOf(m, dir)<0.50) continue;            // 아직 뒤에 있는 선수는 부르지 않는다
        }
        const d=HYP((p.x-m.x)*PITCH_AR, p.y-m.y);
        if(d > (_cut?0.42:0.30)) continue;            // 컷백은 28m 까지, 문전은 20m 까지
        if(d<bd){ bd=d; best=m; }
      }
      if(!best) continue;
      taken[best.id]=1;
      let _tx=p.x;
      if(_line!=null) _tx = dir>0 ? Math.min(_tx, _line-0.026) : Math.max(_tx, _line+0.026);   /* 0.006 → 0.016 → 0.026 (오프사이드 6.4/경기, 실축 4) */
      best._chase={x:clamp01(_tx), y:p.y, until:this.t+(_cut?2.2:1.6)};   /* 컷백 주자는 더 멀리서 온다 */
    }
  }
  /* 골키퍼의 공중볼 처리 — 박스로 떨어지는 뜬 공을 직접 나와서 잡거나 쳐낸다.
     여태 골키퍼는 크로스가 머리 위로 지나가도 아무 반응이 없었다. 그래서 공중 장악력(aer)이
     경기에 단 한 번도 쓰이지 않는 능력치였다. 나올지 말지, 잡을지 놓칠지를 여기서 정한다. */
  tryGkClaim(){
    const b=this.ball;
    if(!b.aerial || !b._passer) return false;
    const gk=this.side(this.opp(b._passer.side)).find(o=>o.slot==="GK");
    if(!gk) return false;
    const adv = gk.dir>0 ? b.x : 1-b.x;               // 0 = 자기 골문
    if(adv>GK_CATCH_X) return false;                  // 박스 언저리로 떨어지는 공만
    const aer=clamp(gk.gkAerial||0.5, 0, 1.2);
    const d=HYP((b.x-gk.x)*PITCH_AR, b.y-gk.y);
    if(d > GK_CATCH_R*(0.70+aer*0.60)) return false;  // 손이 닿는 범위
    // 사람이 많을수록 주저한다 — 나갔다가 못 잡으면 빈 골문이 된다
    const crowd=this.agents.filter(o=>o.slot!=="GK" &&
      HYP((o.x-b.x)*PITCH_AR, o.y-b.y)<0.055).length;
    if(Math.random() > clamp(GK_CATCH_P*(0.45+aer*1.10)*(1-crowd*0.10), 0.02, 0.90)) return false;
    stepToward(gk, b.x, b.y, 3.2); gk.spd=0;          // 공을 향해 나왔다 (한 틱 이동 한계 안에서)
    const st=this.stats[gk.side];
    // 잡을지 놓칠지 — 공중 장악력이 8할, 붙어 있는 사람 수가 나머지
    if(Math.random() < clamp(0.32+aer*0.55-crowd*0.05, 0.15, 0.94)){
      /* 🧤 특성 — 「캐치보다 펀칭」은 주먹으로, 「품에 안는다」는 끝까지 잡는다.
         ⚠ 제보 — 「펀칭이 경기장 중간 터치라인까지 날아가는 게 어색하다」.
            예전에는 clearBall(수비수의 다급한 걷어내기)을 그대로 썼다 — 세게 차서 멀리 보내는
            동작이라 하프라인까지 갔다. 주먹으로 치는 공은 그렇게 멀리 가지 않는다.
            ─ 박스 언저리(12~20m)까지만 밀어낸다. 골라인에 바짝 붙은 공은 아예 옆으로 넘겨 코너. */
      if(Math.random() < clamp((gk.gkPunch||0.5)*0.55 + FX(gk,"gkFist")*0.30, 0.02, 0.85)){
        st.shotPunched=(st.shotPunched||0)+1;
        const adv2 = gk.dir>0 ? b.x : 1-b.x;
        if(adv2<0.045 && Math.random()<0.55){          // 골라인 코앞 — 처리하기 어렵다. 옆으로 넘긴다
          st.shotTipped=(st.shotTipped||0)+1;
          const gx2 = gk.dir>0 ? 0 : 1;
          /* 🥅 골라인 코앞에서 옆으로 넘긴 공 — 골망 뒤·포스트 바깥에 놓는다 (placeGoalOut 주석) */
          placeGoalOut(b, gx2, b.y);
          this.cornerKick(this.opp(gk.side), gx2, b.y);
          return true;
        }
        /* 🧤 ⚠ 제보 원문 — 「하이라이트에서 키퍼가 펀칭인지 걷어내기인지 사이드 터치라인으로
           일부러 라인아웃 시키더라. 이게 자주 나온다」.
           원인: 펀칭 방향을 「골문 반대쪽 ±43° 부채꼴」로만 뽑고, 그 끝이 경기장 안인지는
              보지 않았다. 그런데 펀칭이 나오는 공은 대부분 크로스라, 공은 이미 포스트 옆
              (터치라인에서 5~8m)에 있다. 거기서 바깥쪽으로 43° 를 잡으면 12~20m 중
              옆으로만 13m 가 나가 그대로 라인 밖이다. 그래서 자주 보였다.
           ─ 부채꼴로 각을 뽑되 「떨어질 지점」을 먼저 계산하고, 터치라인 안쪽 4m 로 당긴 뒤
             그 지점을 향해 친다. 실제 펀칭도 위험지역 밖으로 넓고 높게 쳐내지,
             일부러 라인 밖으로 버리지 않는다. */
        const sgn2 = (gk.dir>0) ? 1 : -1;              // 골문 반대(앞) 방향
        const sp2  = (Math.random()-0.5)*1.5;          // 앞쪽으로 부채꼴
        const D2   = (12+Math.random()*8)/ISO_TO_M;
        let tx2 = clamp(b.x + sgn2*Math.cos(sp2)*D2/PITCH_AR, 0.03, 0.97);
        let ty2 = clamp(b.y + Math.sin(sp2)*D2, 0.055, 0.945);   // 터치라인에서 4m 안쪽
        const ang2  = Math.atan2(ty2-b.y, (tx2-b.x)*PITCH_AR);
        const runM2 = HYP((tx2-b.x)*PITCH_AR, ty2-b.y)*ISO_TO_M;
        this.evl("CLEAR", gk, {gk:1, punch:1});
        this.cap(gk.side, COMM.lvClear, {p:this.nm(gk)}, true);
        this.launchLoose(b.x, b.y, ang2, Math.max(9, runM2), this.opp(gk.side), true);
      } else {
        st.shotCaught=(st.shotCaught||0)+1;
        this.giveTo(gk, {noTouch:true});               // 캐치 — 손으로 잡는다(퍼스트터치 아님)
      }
      return true;
    }
    this.looseBall(gk, 0.22);                          // 놓쳤다 — 골문 앞 혼전
    return true;
  }
  /* 골킥 롱킥 — 하프라인 너머 공중볼 투쟁 지점으로 높고 길게 찬다.
     상대 발밑으로 배달되는 "패스 미스"가 아니라, 떨어지는 지점에서 헤더 경합이 벌어진다.
     키퍼의 골킥(kic) 능력이 좋을수록 원하는 지점에 더 정확히 떨어진다. */
  /* 🥾 ⚠ 제보 원문 — 「키퍼 골킥 → 상대방 수비진영에 애매하게 떨어지며 공격수가 가로채
     단독 찬스 → 놓치거나 넣음, 이 현상이 정말 많다. 골킥 상황에서 수비수와 공격수가
     공중볼 경합이 나오게끔 하는 게 더 축구 같지 않을까?」
     원인 ① 낙하점을 「우리 편 아무나」 기준으로 잡고 최대 0.14(≈10m) 를 흩뿌렸다.
            아무도 없는 애매한 자리에 떨어지니 먼저 뛰어든 한 명이 그냥 주워 갔다.
     원인 ② 경합 판정(aerialDuel)은 낙하점 반경 3.9m 안에 두 명 이상 있어야 성립한다.
            긴 골킥은 그 반경 안에 한 명만 들어오는 일이 잦아 경합 자체가 안 열렸다.
     ─ 목표를 「곁에 상대가 붙어 있는 제공권 좋은 선수」로 잡고, 흩뿌림을 줄여 그 머리 위로
       떨어뜨린다. 경합 반경도 넓혀 커버하러 온 수비수가 반드시 다툼에 끼게 한다. */
  launchGoalKick(carrier, mates){
    const b=this.ball, st=this.stats[carrier.side];
    const adv=m=> carrier.dir>0 ? m.x : 1-m.x;
    const cands=(mates||this.side(carrier.side)).filter(m=>m.slot!=="GK" && adv(m)>0.42 && adv(m)<0.68);
    const opps=this.side(this.opp(carrier.side)).filter(o=>o.slot!=="GK");
    let tgt=null, best=-1;
    for(const m of cands){
      /* 곁에 상대가 있는가 — 경합이 성립하는 공이어야 「축구」다 */
      let od=9; for(const o of opps) od=Math.min(od, HYP((o.x-m.x)*PITCH_AR, o.y-m.y));
      const contested=clamp(1-od/0.13, 0, 1);
      const v=(m.headSkill||0.5)*0.55 + (m.bravery||0.5)*0.25 + adv(m)*0.45
              + contested*0.50 + Math.random()*0.22;
      if(v>best){ best=v; tgt=m; }
    }
    const acc=clamp(0.085 - (carrier.gkKick||0.5)*0.055, 0.020, 0.085);   // 골킥 능력 → 낙하 오차 (머리 위로 떨어뜨린다)
    /* 낙하점 상한 — 상대 진영 70%선. 0.92까지 열어 두니 바운드가 골문까지 굴러
       「키퍼 득점」이 자주 나왔다(제보). 실제 골킥도 상대 박스까지는 못 보낸다. */
    /* 🧤 특성 — 「골킥을 길게 찬다」는 낙하점이 더 멀리 나간다 */
    const capAdv=0.62 + clamp(FX(carrier,"gkLong")*0.05, 0, 0.06);
    const capX = carrier.dir>0 ? capAdv : 1-capAdv;
    const tx0 = tgt ? tgt.x + carrier.dir*0.02 + (Math.random()-0.5)*acc
                    : carrier.x + carrier.dir*(0.46+Math.random()*0.10);
    const tx = carrier.dir>0 ? clamp(tx0, 0.08, capX) : clamp(tx0, capX, 0.92);
    /* 🥾 제보(같은 건) — 골킥이 그대로 터치라인 밖으로 나가는 장면. 목표를 「받을 선수의 y」로
       잡다 보니 그 선수가 터치라인에 붙어 있으면 낙하점이 라인에서 4~5m 밖에 안 남았고,
       착지 뒤 바운드·구름 몫이 그대로 라인을 넘겼다. 걷어내기처럼 낙하점을 안으로 당긴다. */
    const ty = clamp((tgt ? tgt.y : 0.28+Math.random()*0.44) + (Math.random()-0.5)*acc*1.5, 0.11, 0.89);
    b.state="PASS"; b.fromId=carrier.id; b.toId=null; b.ownerId=null;
    b.aerial=true; b.offsideAt=null; b.power=1.65;
    b.tx=tx; b.ty=ty;
    b.flight=0; b.flightLen=HYP((b.tx-carrier.x)*PITCH_AR, b.ty-carrier.y);
    b.flightT=clamp(1.6 + b.flightLen*ISO_TO_M*0.034, 2.0, 3.4);      // 골킥은 하늘 높이 뜬다 — 더 높게(착지 잔여 속도↓)
    resolveKick(b, carrier, KICK.GOALKICK);
    b._opt=null; b._passer=carrier;
    this.startAerialRace();       // ⚽ 낙하점으로 양 팀 한 명씩 — 골킥이 「주워 가는 공」이 되지 않게
    st.longKick=(st.longKick||0)+1;
    this.cap(carrier.side, ["🥾 {p}, 하프라인을 훌쩍 넘기는 긴 골킥"], {p:this.nm(carrier)});
  }
  /* 🎾 제보 — 「선방·헤더로 따낸 공이 아주 먼 거리로 터치라인 아웃된다」.
     발로 힘껏 차는 걷어내기와 머리에 맞고 나가는 공은 세기가 다르다. powK 로 구분한다. */
  clearBall(carrier, powK){
    try{ this._pEpRelease(carrier, "clear", null); }catch(e){}   // 🎯 압박 결과
    const b=this.ball, st=this.stats[carrier.side];
    const _pk=(powK==null?1:powK);
    st.clearance=(st.clearance||0)+1;   // 클리어런스는 패스가 아니다 — 실제 스탯에서도 별도 항목
    this.evl("CLEAR", carrier, carrier.slot==="GK"?{gk:1}:null);
    b.state="PASS"; b.fromId=carrier.id; b.toId=null; b.ownerId=null;
    this.cap(carrier.side, ((carrier.dir>0?carrier.x:1-carrier.x)>0.55 ? COMM.lvClearAtt : COMM.lvClear), {p:this.nm(carrier)}, true);   // 🎙️ 맥락 분리
    b.aerial=true; b.offsideAt=null; b.power=1.7*_pk;   // 걷어내기는 항상 공중볼이고 세게 찬다
    const deep=(carrier.dir>0 ? carrier.x : 1-carrier.x) < 0.32;   // 자기 골문 앞 혼전
    /* ⚠ 제보 — 「골키퍼가 공을 잡고 뒤를 돌아 자기 골대로 슛을 쏜다」.
       다급한 클리어가 골라인을 넘어 코너가 되는 장면을 구현한 분기인데,
       ① 키퍼까지 이 분기를 타고 ② 목표가 골문 정면이라 자책골 직전 그림이 됐다.
       ─ 키퍼는 절대 자기 골라인 쪽으로 차지 않는다. 잡았으면 앞으로 보낸다.
       ─ 필드 수비수도 빈도를 낮추고, 골문 정면이 아니라 골문 옆(코너 쪽)으로 흘린다. */
    /* ⚠ 코너 과다의 진범이 여기였다(감사).
       ① 26% 는 시계 축약(×2, 45분치 플레이) 시절에 맞춰 둔 값이다. 시계를 1:1 로 되돌리면서
          클리어런스 자체가 2배가 됐으므로 파울·태클과 같은 이유로 절반(0.13)이 맞다.
          BLOCK_CORNER_P·CROSS_CORNER_P 를 절반으로 내려도 코너가 안 움직였던 이유가 이것이다 —
          그 둘은 곁가지였고 코너의 주된 공급원은 이 분기다.
       ② b.tx 에 클램프가 없었다. deep 조건이 이미 자기 진영 32% 안이라
          carrier.x - dir*0.16 이 <b>음수</b>가 된다 — 자기 골문 10% 지점의 수비수는
          −6% 를 겨냥한다. 확률이 아니라 <b>확정 코너</b>였다.
          아래 분기(clamp 0.04~0.96)에는 걸려 있는데 이쪽만 빠져 있었다.
          골라인 언저리로 당겨 「높은 확률의 코너」로 바꾼다 — 흘러 나가지 않고
          수비수가 다시 잡는 경우도 생긴다. */
    const backOK = deep && carrier.slot!=="GK" && Math.random()<0.13;
    if(backOK){
      b.tx = clamp(carrier.x - carrier.dir*0.16, 0.02, 0.98);
      /* 골문 폭(0.5±GOAL_HALF) 바깥으로 — 정면으로 차 넣지 않는다 */
      const away = (carrier.y<0.5 ? -1 : 1);
      b.ty = clamp01(0.5 + away*(GOAL_HALF*1.9 + Math.random()*0.22));
    } else {
      /* 🥅 ⚠ 제보 원문 — 「가끔 키퍼가 골킥을 하는데 사이드로 터치라인 아웃 시킨다」.
         원인: 정확히는 골킥이 아니라 걷어내기(clearBall)다. 압박에 갇힌 키퍼·수비수가
            공을 옆으로 크게 빼는 동작인데, 그 목표 y 를 −0.015~0.205 · 0.80~1.015 로
            잡고 있었다 — 범위의 양 끝이 **애초에 경기장 밖**이다.
            여기에 착지 뒤 바운드·구름까지 더해지니 그대로 라인을 넘는 일이 잦았다.
            (「옆으로 크게 빼라」는 의도는 맞지만, 라인 밖까지 열어 둘 이유는 없다)
         ─ 「옆으로 크게」는 그대로 두고 목표만 경기장 안으로 당긴다. 터치라인에서 4m 안쪽.
            키퍼는 더 안쪽으로 — 손으로 잡았다 걷어내는 공까지 밖으로 버리지는 않는다. */
      /* ⚠ 제보 「공이 너무 자주 죽는다 — 골킥도 많다」의 최대 공급원이 이 한 줄이었다.
         실측 1경기(seed=3): 골킥 113회 중 59회가 「걷어내기 → 착지 → 아무도 없어 굴러 골라인 밖」.
         그 59회의 킥 위치는 평균 전진도 0.74(상대 진영), 차는 사람은 ST 17·CM 9·RW 7… — 수비수가 아니라
         <b>공격수가 최종 3분의 1에서 걷어냈다</b>. 걷어내기 판단(wantClear)은 위치를 안 보고 압박·옵션만
         보기 때문이다. 그런데 목표 x 는 「+0.26 전진 후 0.96 클램프」라 상대 골라인 4m 앞이 되고,
         착지 속도 17m/s 의 공은 0.2~0.8초 뒤 그대로 골라인을 넘었다(착지점 평균 0.97, 주변 선수 12.6m).
         ─ 착지점을 CLEAR_LAND_MAX(0.80) 에 묶는다. 이미 그보다 앞이면 「앞으로」 걷어낼 곳이 없다 —
           뒤(미드필드 쪽)로 12% 빼서 공을 살린다. 실제 공격수도 바이라인에서 갇히면 뒤로 돌린다. */
      {
        const _advC = carrier.dir>0 ? carrier.x : 1-carrier.x;
        let _tAdv = _advC + 0.26*_pk;
        if(_tAdv > CLEAR_LAND_MAX) _tAdv = (_advC >= CLEAR_LAND_MAX-0.06) ? _advC-0.12 : CLEAR_LAND_MAX;
        b.tx=clamp(carrier.dir>0 ? _tAdv : 1-_tAdv, 0.04, 0.96);
      }
      /* ⚠ 목표를 라인 안으로 당기는 것만으로는 부족했다(실측 45%가 여전히 아웃) —
         걷어낸 공은 착지 뒤에도 바운드하며 10~20m 를 더 구른다. 그 몫까지 안으로 들여놓는다. */
      const _isGK = carrier.slot==="GK";
      const _lo = _isGK ? 0.18 : 0.12, _hi = _isGK ? 0.34 : 0.28;
      b.ty = (Math.random()<0.5) ? (_lo+Math.random()*(_hi-_lo))
                                 : (1-_hi+Math.random()*(_hi-_lo));
    }
    b.flight=0; b.flightLen=HYP((b.tx-carrier.x)*PITCH_AR, b.ty-carrier.y);
    b.flightT=clamp(0.75 + b.flightLen*ISO_TO_M*0.032, 1.15, 2.6);  // 다급하게 걷어낸 공은 높이 솟는다
    resolveKick(b, carrier, KICK.CLEAR);
    b._opt=null; b._passer=carrier;
    this.startAerialRace();       // ⚽ 낙하점으로 양 팀 한 명씩
  }
  /* 비행 중인 패스를 진행시키고, 도착·차단을 판정한다 */
  advancePass(){
    const b=this.ball;
    const total=b.flightT || Math.max(0.05, b.flightLen/(PASS_SPEED*(b.power||1)));
    /* 🛟 PASS 감시 — 비행 시간이 정의되지 않았거나(NaN/0) 예정보다 3초 넘게 지났으면 흘린 공으로 돌린다.
       (실측 seed 1: 플랜 없는 PASS 가 제자리에서 40분 — 아래 도착 처리는 p>=1 을 영영 못 만났다) */
    if(!(total>0) || b.flight>total+3.0){
      this.evl("STALL", null, {k:"PASS", total:+(total||0).toFixed(2)});
      b.state="LOOSE"; b.looseT=LOOSE_GRACE; b.looseBy=(b._passer&&b._passer.side)||this.possSide;
      b.ownerId=null; b.toId=null; b._pt=null; b.aerial=(b.z||0)>0.004;
      return;
    }
    b.flight+=SIM_DT;
    const p=clamp01(b.flight/total);
    /* 🧹 스윕 차단용 — 이 틱을 시작한 자리. 아래 「경로 차단」이 점이 아니라 선분을 본다. */
    const _sx=b.x, _sy=b.y, _sz=b.z;
    /* ⚽ 비행 = 볼 물리 그 자체. 패스든 크로스든 흘린 공이든 같은 규칙으로 움직인다.
       ⚠ 예전에는 여기서 lerp 로 목표까지 미끄러뜨렸다. 그래서 도착 순간의 속도가
          "위치 차분"이라는 가짜 값이었고, 퍼스트터치 난이도가 그 가짜 속도를 읽었다. */
    stepBallPhysics(b);
    if(b.z<=0) b.aerial=false;                 // 땅에 닿았으면 더는 공중볼이 아니다
    // 비행 중 라인을 넘으면 그 순간 아웃 — 도착까지 기다리면 공이 피치 밖에 떠 있게 된다
    if(b.x<0 || b.x>1 || b.y<0 || b.y>1){
      /* 🤾 스로인은 터치라인 「밖」에서 던진다(요청) — 공이 필드 안으로 들어오기 전까지
         아웃 판정을 하면, 던지는 순간 바로 다시 스로인이 되는 무한 고리가 된다. */
      if(!b._thrownOut){
        if(this.outOfPlay(b.x, b.y, b._passer.side)){ this.stats[b._passer.side].lost++; return; }
        b.x=clamp01(b.x); b.y=clamp01(b.y);
      }
    } else if(b._thrownOut) b._thrownOut=0;      // 필드 안으로 들어왔다 — 이제부터 정상 판정
    /* ═══ 🧹 경로 차단 — 「점」이 아니라 「이 틱에 지나간 선분」으로 본다 ══════════════════
       ⚠ 제보 원문 — 「공격적인 패스들이 너무 쉽게 1대1 찬스로 이어진다. 지나가는 패스를 끊는
          인터셉트 로직을 구현하고 개선해야 한다」.
       원인 — 예전에는 이 자리에서 <b>그 순간 공의 위치</b>가 수비수 반경 안이냐만 봤다.
          그런데 차단 반경은 약 1.4m 인데 공은 한 틱(0.2초)에 평균 <b>3.3m</b>, 최대 8.1m 를
          건너뛴다(실측 41,731 비행 틱). 궤적이 수비수 몸을 관통해도 샘플 지점이 그 1.4m
          창에 우연히 떨어지지 않으면 <b>그냥 지나갔다</b> — 길목을 막고 서 있어도 끊느냐
          마느냐가 운이었다.
          실측: 같은 반경으로 선분 판정을 하면 차단률이 11.7% → 23.8% 로 <b>두 배</b>가 된다.
          즉 길목에 선 수비수의 절반 이상을 공이 통과하고 있었다.
       ─ 이제 이 틱의 시작점(_sx,_sy)과 끝점(b.x,b.y)을 잇는 선분과 수비수의 최단거리를 본다.
          「길목에 서 있으면 끊는다 / 벗어나 있으면 못 끊는다」가 운이 아니라 결정론이 된다.
       ⚠ 총량이 두 배가 되면 패스 성공률이 실축(80~85%)보다 낮아지므로 반경(ITC_MUL)을
          함께 내려 총량은 지금 수준 근처에 맞춘다 — 바뀌는 건 <b>어디서 끊기느냐</b>다. */
    const oKey=this.opp(b._passer.side);
    /* ⚠ 스윕은 두 가지를 예전 그대로 지켜야 한다 — 안 그러면 차단이 폭주한다(실측 62%/패스).
       ① <b>높이</b> — 예전 게이트(b.z<CTRL_Z)를 그대로 둔다. 이걸 「선분 위 높이」로 풀면
          띄운 공이 <b>발을 떠나는 순간</b>(z=0)에 걸려 롱볼·크로스가 전부 끊긴다.
       ② <b>발끝</b> — 선분이 패서의 발에서 시작하므로, 밀착 마크한 수비수가 모든 패스를
          몸으로 끊어 버린다. 실제로도 「차단당한 패스」는 있지만 그게 기본값일 수는 없다.
          비행 첫 틱은 발끝 ITC_BLIND_M 만큼을 건너뛴 자리에서 선분을 시작한다. */
    if(b.z < CTRL_Z){
      /* ⚠ 롱볼 — 떠 있다가 이 틱에 내려온 공은 선분 전체가 머리 위였다. 예전에는 「도착 지점
         점 판정」으로 이런 공도 끊었다(경기당 11.5회). 시작이 높으면 끝점만 본다(예전 그대로). */
      let _bx=(_sz<CTRL_Z)?_sx:b.x, _by=(_sz<CTRL_Z)?_sy:b.y;
      if(_sz<CTRL_Z && b.flight <= SIM_DT*1.5){
        const _len=HYP((b.x-_sx)*PITCH_AR, b.y-_sy);
        if(_len>1e-6){
          const _k=Math.min(0.92, (ITC_BLIND_M/ISO_TO_M)/_len);
          _bx=_sx+(b.x-_sx)*_k; _by=_sy+(b.y-_sy)*_k;
        }
      }
      const _dx=(b.x-_bx)*PITCH_AR, _dy=b.y-_by;
      const _L2=_dx*_dx+_dy*_dy;
      for(const o of this.side(oKey)){
        if(o._down && o._down>this.t) continue;
        // 예측(anticipation) — 판단력·위치선정이 좋은 수비수는 몸을 던지지 않고도 길목을 끊는다.
        // 패서의 시야가 좋을수록 길목을 피해 찔러 넣는다 — 차단 판정에 패서 실력을 반영
        const ant = (0.72 + ((o.posSkill||0.6)*0.5 + (o.decSkill||0.6)*0.5)*0.56)
                  * (1.30 - (b._passer.passSkill||0.6)*0.42);
        const sweeping = o.slot==="GK" && o._sweeping && o._sweeping>this.t;
        // 스위핑으로 뛰쳐나온 키퍼는 그 순간 필드 플레이어다 — 평소의 코앞 제한을 풀어준다
        const ir = (o.slot==="GK" && !sweeping) ? CTRL_RADIUS*0.26 : CTRL_RADIUS*ITC_MUL*ant;
        // 선분 위에서 수비수에게 가장 가까운 지점 (t=0 이 선분 시작, 1 이 틱 끝)
        const _ax=(o.x-_bx)*PITCH_AR, _ay=o.y-_by;
        let _t = _L2>1e-12 ? (_ax*_dx+_ay*_dy)/_L2 : 0;
        _t = _t<0 ? 0 : (_t>1 ? 1 : _t);
        const _perp=HYP(_ax-_dx*_t, _ay-_dy*_t);
        if(_perp >= ir) continue;
        /* ⏱️ ballTime vs defenderTime — 확률이 아니라 시간으로 가른다 (요청).
           공이 발을 떠난 뒤 흐른 시간(b.flight)에서 반응 지연을 빼면 「움직일 수 있었던 시간」이고,
           옆으로 _perp 만큼 발을 뻗는 데 걸리는 시간과 견준다.
             여유 ≥ ITC_CLEAN  → 깔끔하게 끊는다
             여유 ≥ ITC_TOUCH  → 발끝만 닿는다 = 굴절(DEFLECT) — 아무도 못 가진 공이 된다
             그 아래            → 반 박자 늦었다. 지나간다 */
        const _avail=b.flight - itcReact(o);
        const _need=_perp / Math.max(1e-6, itcLunge(o));
        const _slack=_avail-_need;
        if(_slack < ITC_TOUCH) continue;
        /* 공은 이미 수비수를 지나쳐 있을 수 있다 — 몸에 닿은 자리로 되돌려 놓는다 */
        b.x=clamp01(_bx + (b.x-_bx)*_t); b.y=clamp01(_by + (b.y-_by)*_t);
        if(_slack < ITC_CLEAN || o._itcKind==="DEFLECT"){
          /* 🦶 굴절 — 발끝에 걸렸다. 방향이 꺾이고 힘이 죽은 채 아무에게도 가지 않는다. */
          o._itcKind=null;
          const _ang=Math.atan2(b.vy||0, (b.vx||0))+ (Math.random()-0.5)*1.5;
          const _sp=HYP((b.vx||0)*PITCH_AR, b.vy||0)*(0.28+Math.random()*0.28);
          b.vx=Math.cos(_ang)*_sp/PITCH_AR; b.vy=Math.sin(_ang)*_sp;
          b.state="LOOSE"; b.looseT=LOOSE_GRACE; b.looseBy=oKey;
          b.ownerId=null; b.toId=null; b._pt=null; b.aerial=false;
          this.stats[oKey].deflect=(this.stats[oKey].deflect||0)+1;
          this.stats[b._passer.side].lost++;
          this.cap(o.side, ["🦶 {p}, 발끝에 걸었습니다 — 공이 흐릅니다"], {p:this.nm(o)});
          return;
        }
        o._itcKind=null;
        this.stats[oKey].intercept++; this.stats[b._passer.side].lost++;
        this.cap(o.side, COMM.lvItc, {p:this.nm(o)});
        this.giveTo(o); return;
      }
    }
    // 뜬 공을 선수가 만나는 높이 — 낙하 지점 직전이라 아직 떠 있다.
    // 높이 뜬 크로스는 머리로, 낮게 깔린 공은 발리로 때리게 되는 갈림길이 여기서 난다.
    const zMeet = b.aerial ? loftPeak(total)*4*0.85*0.15 : 0;
    const meetBall = {state:"PASS", z:zMeet};
    if(p>=1){
      if(b.offsideAt){
        const off=b.offsideAt;
        // ── 깃발을 늦게 드는 경우 — 부심이 일단 플레이를 흘려보낸다.
        //    실제 경기에서 흔한 장면이다. 이 상태에서 골이 들어가면 그제서야 깃발이 올라가고 골이 취소된다.
        if(Math.random()<OFFSIDE_LATE_P){
          this.pendingOff={by:off.by, x:off.x, y:off.y, until:this.t+OFFSIDE_LATE_WIN};
          const rcv0=this.byId(b.toId);
          if(rcv0){ this.giveTo(rcv0); return; }
        }
        // 오프사이드 — 반칙 지점에서 수비 팀의 "간접" 프리킥으로 재개 (직접 득점 불가)
        this.stats[off.by].offside++;
        if(this.emitEvents){
          const rcv=this.byId(b.toId);
          this.say(off.by, F_(COMM.offside,{p:rcv&&rcv.p?rcv.p.name:"공격수"}), "txt");
          this.cap(off.by, COMM.lvOffLive, {p:rcv&&rcv.p?rcv.p.name:"공격수"});
        }
        this.freeKick(this.opp(off.by), off, true);
        return;
      }
      if(this.tryGkClaim()) return;   // 골키퍼가 먼저 나와서 잡거나 쳐낸다
      if(b.aerial){
        // 공중볼 — 낙하 지점에서 헤딩 경합. 이긴 쪽이 볼을 따낸다.
        const w=this.aerialDuel();
        if(this.ball.foulScene) return;   // 경합 중 반칙 휘슬 — 공은 죽었다. 리시브 처리를 이어가면 PK 장면이 오염된다
        if(w){
          if(w.side===b._passer.side) this.stats[b._passer.side].passOk++;
          else this.stats[b._passer.side].lost++;
          // 박스 안에서 뜬 공을 따낸 공격수는 잡지 않고 그대로 머리로 마무리한다
          /* 🎯 경합에서 우리 편이 따냈다 = 크로스 성공.
             ⚠ 다만 <b>박스 안</b>에서 따낸 것만 센다. 30m 밖에서 우리 미드필더가 머리로
                따낸 공을 「크로스 성공」이라 부르지는 않는다(실축 집계 기준). */
          if(w.side===b._passer.side && inBox(w, w.dir)) this.crossHit(w); else if(b.isCross) b.isCross=false;
          if(w.side===b._passer.side && w.slot!=="GK"){
            const hg=shotGeom(w);
            if(hg.distM<16 && (hg.gx-w.x)*w.dir>0.01 &&
               firstTouchShoot(w, hg, b, this.side(this.opp(w.side)),
                               ((b._spBall?0.90:0.74)+(w.headSkill||0.6)*0.26)
                               * clamp(1-(hg.distM-6)/16, 0.35, 1))){   /* 📏 11~18m 헤더슛 과다 — 거리 감쇠 */
              const gk2=this.side(this.opp(w.side)).find(o=>o.slot==="GK");
              /* ⚽ 뜬 공을 따냈다면 그건 「머리」다. 발로 편하게 마무리하는 공이 아니다.
                 ⚠ 여태 chooseShotType 이 낙하 시점 높이(z≈0)만 보고 근거리 슛으로 처리해,
                    크로스에서 헤더슛이 한 개도 나오지 않았다. */
              const aerialShot = b.aerial ? SHOT_TYPE.HEADER
                                          : chooseShotType(w, hg, meetBall, gk2);
              /* 헤딩은 자주 빗맞는다 — 능력이 낮을수록 방향이 어긋난다 (§30 · TEST 12) */
              if(aerialShot===SHOT_TYPE.HEADER){
                const clean=clamp(0.18+(w.headSkill||0.6)*0.60+(w.aerialPos||0.5)*0.16, 0.10, 0.92);
                if(Math.random()>=clean){
                  this.cap(w.side, ["😖 {p}의 헤더, 제대로 맞지 않았습니다"], {p:this.nm(w)});
                  this.looseBall(w, 0.30); return;      // 빗맞은 헤더 → 세컨볼
                }
              }
              this.resolveShot(w, hg, aerialShot); return;
            }
          }
          /* 🧠 헤더의 방향과 품질 — <b>이겼다고 공이 곱게 발밑에 떨어지지 않는다.</b>
             ⚠ 여태 슛으로 이어지는 경우에만 품질을 굴렸다(빗맞으면 세컨볼).
                그 밖의 공중 경합은 <b>이긴 사람이 그대로 소유</b>했다 —
                수비수가 코너킥을 따내면 발밑에 붙은 채 빌드업이 시작되는 그림이었다.
             ─ 헤딩 정확도(headAim = 헤딩 0.62 · 개인기 · 침착성 · 균형)와 판단력이
               「동료 쪽으로 정확히 보내는가」를 정하고, 붙어 있는 상대가 그걸 깎는다.
             ─ 실패했을 때의 결말은 <b>자리</b>가 정한다:
                 · 자기 진영이면 걷어내기 — 정확히 못 보내면 일단 멀리 보내는 게 맞다
                 · 그 밖이면 흘린 공 — 세컨볼 다툼이 열린다 */
          {
            let _np=0;
            for(const o of this.side(this.opp(w.side))){
              if(o.slot==="GK") continue;
              if(HYP((o.x-w.x)*PITCH_AR, o.y-w.y)<0.055) _np++;
            }
            const _hq=clamp(0.16 + (w.headAim!=null?w.headAim:0.6)*0.50
                                 + (w.decSkill!=null?w.decSkill:0.6)*0.26
                                 - _np*0.13, 0.10, 0.90);
            if(Math.random() >= _hq){
              const _ownAdv = w.dir>0 ? w.x : 1-w.x;
              if(_ownAdv < 0.42){
                this.cap(w.side, ["🗣️ {p}, 머리로 크게 걷어냅니다"], {p:this.nm(w)}, true);
                /* 🎾 머리에 맞고 나가는 공 — 발로 차는 걷어내기의 7할 세기 (제보: 터치라인 아웃) */
                this.clearBall(w, 0.70);
              } else {
                this.cap(w.side, ["😖 {p}의 헤더, 방향이 어긋납니다"], {p:this.nm(w)}, true);
                this.looseBall(w, 0.28);
              }
              return;
            }
          }
          this.giveTo(w);
          return;
        }
      }
      const rc=b.toId!=null?this.byId(b.toId):null;
      /* 🌌 공간 패스 — 공은 "공간"에 도착했다. 수신자가 그 공간에 닿았는지는 별개다.
         너무 깊은 패스면 선수가 못 따라오고 공은 그대로 흘러간다("패스가 길었다").
         ⚠ 이게 없으면 공간패스도 결국 "선수에게 배달되는 패스"가 된다. */
      const isSpace = b._plan && (b._plan.type===PASS_TYPE.LEAD || b._plan.type===PASS_TYPE.THROUGH);
      /* ⚠ 낮은 크로스·컷백 — 세게 깔린 땅볼이 3.8m 밖 선수에게 「흡수」되어 공이 멀리서
         미끄러져 붙는 찬스가 나왔다(제보). 발이 실제로 닿는 거리(≈2m)여야 받는다.
         못 받으면 공은 물리대로 계속 흐른다 — 그게 컷백이 위험하고도 어려운 이유다. */
      const hardCross = b.isCross && !b.aerial;
      const reachR = isSpace ? CTRL_RADIUS*2.0 : hardCross ? CTRL_RADIUS*1.15 : CTRL_RADIUS*2.7;
      if(rc && isSpace && HYP((rc.x-b.x)*PITCH_AR, rc.y-b.y) >= reachR){
        /* 수신자가 아직 공간에 닿지 못했다 — 공은 계속 굴러가고, 선수는 쫓아간다.
           이때 상대가 더 가까우면 그쪽이 먼저 닿는다(아래 일반 처리로 흘려보낸다). */
        let oppNear=null, od=1e9;
        for(const o of this.side(this.opp(b._passer.side))){
          const d=HYP((o.x-b.x)*PITCH_AR, o.y-b.y);
          if(d<od){ od=d; oppNear=o; }
        }
        const myD=HYP((rc.x-b.x)*PITCH_AR, rc.y-b.y);
        if(!(oppNear && od<myD*0.85 && od<CTRL_RADIUS*2.2)){
          /* 아무도 아직 못 닿았다 — 흘린 공으로 두고 경합시킨다.
             내 선수가 곧 따라잡을 거리면 실패로 세지 않는다(쫓아가서 잡는 공). */
          /* 공간으로 정확히 배달됐고 우리 선수가 가장 가깝다면 = 성공한 패스다.
             (실축 통계도 동료가 잡으면 성공으로 센다) */
          if(myD>CTRL_RADIUS*3.2) this.stats[b._passer.side].lost++;
          else this.stats[b._passer.side].passOk++;
          /* ⚠ 제보 「공이 너무 자주 죽는다」 — LOOSE_GRACE(0.7초)는 「튄 직후 몸이 흐트러진」
             굴절·경합용인데, 그냥 도착해서 흘린 패스에도 looseT=0 으로 걸려 있었다.
             17m/s 공은 0.7초에 12m 를 가므로 경로 위에 서 있던 선수를 투명하게 통과했다.
             실측 1경기: 라인 밖으로 나간 루즈볼 119회 중 경로 2.2m 안에 선수가 있던 42회 가운데
             30회가 grace 하나 때문에 못 건드렸다(높이 11회, 실제 픽업 실패 1회).
             도착·착지로 흘린 공(여기와 아래 61342 분기)은 grace 를 건너뛴다. */
          b.state="LOOSE"; b.looseT=LOOSE_GRACE; b.looseBy=b._passer.side;
          b.ownerId=null; b.toId=null; b._pt=null;
          /* 속도는 그대로 둔다 — 공은 물리대로 계속 굴러간다 */
          if(this.emitEvents && myD>CTRL_RADIUS*3.2 && Math.random()<0.30)
            this.cap(b._passer.side, ["😑 패스가 조금 길었습니다 — {p}가 닿지 못합니다"], {p:this.nm(rc)});
          if(rc) this.startChase(rc, b.x, b.y);      // 그래도 쫓아간다
          return;
        }
      }
      if(rc && HYP((rc.x-b.x)*PITCH_AR, rc.y-b.y) < reachR){
        this.stats[b._passer.side].passOk++;
        this.crossHit(rc);                      // 🎯 겨냥한 선수에게 닿았다
        // 경합 상대가 붙지 않은 크로스라도, 박스 안이라면 잡지 않고 그대로 머리로 마무리한다
        if(b.aerial && rc.side===b._passer.side && rc.slot!=="GK"){
          const hg=shotGeom(rc);
          if(hg.distM<17 && (hg.gx-rc.x)*rc.dir>0.005 &&
             firstTouchShoot(rc, hg, b, this.side(this.opp(rc.side)),
                             (0.68+(rc.headSkill||0.6)*0.20)
                             * clamp(1-(hg.distM-6)/16, 0.35, 1))){   /* 📏 거리 감쇠 */
            const gk2=this.side(this.opp(rc.side)).find(o=>o.slot==="GK");
            this.resolveShot(rc, hg, chooseShotType(rc, hg, meetBall, gk2)); return;
          }
        }
        this.giveTo(rc);
      } else {
        // 겨냥에서 빗나간 크로스라도, 박스 안에 떨어진 뜬 공에 가장 먼저 닿은 공격수는 머리로 돌려놓는다
        if(b.aerial){
          let near=null, nd=1e9;
          for(const a of this.agents){
            if(a.slot==="GK") continue;
            const d=HYP((a.x-b.x)*PITCH_AR, a.y-b.y);
            if(d<nd){ nd=d; near=a; }
          }
          if(near && nd<AERIAL_RANGE && near.side===b._passer.side){
            const hg=shotGeom(near);
            if(hg.distM<17 && (hg.gx-near.x)*near.dir>0.005 && Math.random()<(0.66+(near.headSkill||0.6)*0.22)*clamp(1-(hg.distM-6)/16, 0.35, 1)){
              this.stats[b._passer.side].passOk++;
              this.crossHit(near);              // 🎯 겨냥은 빗나갔어도 우리 편 머리에 닿았다
              const gk2=this.side(this.opp(near.side)).find(o=>o.slot==="GK");
              this.resolveShot(near, hg, chooseShotType(near, hg, meetBall, gk2)); return;
            }
          }
        }
        /* ⚽ 아무도 못 잡은 공 — 궤적 보간에서 실제 물리로 넘긴다.
           ⚠ 예전에는 b.vx 를 그냥 0.55배만 하고 넘겨서, 로빙 패스가 땅에 닿아도
             튀지 않고 그 자리에서 조용히 굴렀다. 도착 순간의 실제 속도를 계산해 넘긴다. */
        this.stats[b._passer.side].lost++;
        /* 착지해서 흘린 공 — grace 없음 (위 61298 분기 주석: 굴절이 아니라 그냥 지나가는 공이다) */
        b.state="LOOSE"; b.looseT=LOOSE_GRACE; b.looseBy=b._passer.side;
        b.ownerId=null; b.toId=null; b._pt=null;
        /* 잔여 속도는 손대지 않는다 — 물리가 이미 실제 값을 들고 있다 */
        b.aerial=b.z>0.004;
        return;
        // eslint-disable-next-line no-unreachable
        let best=null, bd=1e9;
        for(const a of this.agents){
          let d=HYP((a.x-b.x)*PITCH_AR, a.y-b.y);
          if(a.slot==="GK" && !(a._sweeping&&a._sweeping>this.t)) d+=0.22;   // 평소엔 코앞만, 스위핑 중이면 정상 경합
          if(d<bd){ bd=d; best=a; }
        }
        if(best){
          if(best.side===b._passer.side) this.stats[b._passer.side].passOk++;
          else this.stats[b._passer.side].lost++;
          // 정확히 머리에 오지 않은 크로스라도, 박스 안에 떨어진 뜬 공에 먼저 닿은 공격수는 머리로 돌려놓는다
          if(b.aerial && best.side===b._passer.side && best.slot!=="GK"){
            const hg=shotGeom(best);
            if(hg.distM<14 && (hg.gx-best.x)*best.dir>0.01 && Math.random()<0.52+(best.headSkill||0.6)*0.34){
              this.resolveShot(best, hg, SHOT_TYPE.HEADER); return;
            }
          }
          this.giveTo(best);
        }
      }
    }
  }
  /* ⚽ 크로스 낙하 지점 경합 — 누가 먼저 닿는가, 닿아서 뭘 하는가.
     소유권을 주는 이벤트와 「공을 완전히 통제했다」는 이벤트를 분리한다. */
  /* 🎯 전담 키커 — 감독이 정한 순위 중 그라운드에 있는 첫 번째. 없으면 null(엔진 자동). */
  designatedKicker(side, kind){
    try{
      const team=this.rec(side).team;
      const K=team.tactic && team.tactic.kickers;
      if(!K || !Array.isArray(K[kind])) return null;
      for(const pid of K[kind]){
        if(!pid) continue;
        /* ⚠ 제보(투명 키커) — agents 에 남은 유령이 여기를 통과하면 화면에 없는 선수가 찬다.
           엔트리가 정말 그라운드 위인지(onField) 마지막으로 확인한다. */
        const a=this.side(side).find(x=>x.id===pid && x.slot!=="GK" && this.onField(x));
        if(a) return a;
      }
    }catch(e){}
    return null;
  }
  /* ⏱️ 템포 — 전술 슬라이더가 2D의 "공 잡고 있는 시간"을 실제로 줄이고 늘린다.
     (제보 — 역습·템포가 화면에서만 조절되고 엔진에는 반영되지 않았다) */
  /* 🎚️ 템포 — 배선 감사에서 <b>폭이 ±6% 뿐</b>이라는 걸 확인했다(1.12 → 1.00).
     「매우 느리게」와 「매우 빠르게」의 소유 시간 차이가 12% 라 슬라이더를 끝까지 밀어도
     체감이 없었다. 전역 TEMPO=3.20 이 곱해져 더 묻혔다.
     ⚠ 기본값 오류도 같이 고친다 — T.tempo 는 엔진 스케일(0~2)인데 fallback 이 2 였다.
        전술 정보를 못 읽으면 「매우 빠르게」로 취급되고 있었다. 가운데는 1 이다.
     ⚠ 폭은 임의로 벌리지 않았다. 코드에 이미 남아 있던 실측표에 맞췄다:
          TEMPO 2.20 → 팀당 패스 273 · 슛 21
          TEMPO 4.50 → 팀당 패스 138 · 슛 12
        3.20 × 0.70 = 2.24 · 3.20 × 1.30 = 4.16 — 양 끝이 그 실측 구간 안에 정확히 든다. */
  tempoK(side){
    try{ const T=TAC(this.rec(side).team); return clamp(1.30-(T.tempo!=null?T.tempo:1)*0.30, 0.70, 1.30); }
    catch(e){ return 1; }
  }
  /* ⚡ 역습 창 — 소유권을 빼앗은 순간부터 몇 초간, 역습 전술 팀은 앞만 본다 */
  /* 볼 컨트롤 상태 갱신 — 매 틱 한 번 */
  updateBallControlState(){
    const b=this.ball;
    /* 🎱 공 자체의 물리 상태 — 소유와 무관하게 "지금 공이 어떤 상태인가" */
    b.phys = (b.z>0.004) ? ((b.vz||0)>0 ? "IN_FLIGHT" : "FALLING")
           : (HYP(b.vx||0,b.vy||0)>BALL_STOPV*1.5 ? "ROLLING" : "STILL");
    if((b.bounced||0)>0 && b.z<=0.004 && HYP(b.vx||0,b.vy||0)>BALL_STOPV*2) b.phys="ROLLING";
    if(b.setPiece){ b.ctrl=BC.FREE; return; }
    if(b.state==="PASS"){
      const r=b.toId!=null?this.byId(b.toId):null;
      if(!r){ b.ctrl=BC.FREE; return; }
      const left=Math.max(0, (b.flightT||0.6)-(b.flight||0));
      const d=HYP((b.x-r.x)*PITCH_AR, b.y-r.y);
      b.ctrl = (d<CTRL_RADIUS*1.6 || left<0.10) ? BC.CONTACT
             : (left<0.55) ? BC.ORIENT : BC.APPROACH;
      return;
    }
    if(b.state==="LOOSE"){ b.ctrl=BC.FREE; return; }
    if(b.state==="SETTLED" && b.ownerId!=null){
      const c=this.byId(b.ownerId);
      const sp=c?HYP((c.vx||0)*PITCH_AR,(c.vy||0))/(SPD.SPRINT*SIM_DT):0;
      /* 터치 직후 "정리 시간"(ft.ct) 안에는 FIRST_TOUCH, 그 뒤 움직이면 드리블 */
      if(b._ftAt!==undefined && (this.t-b._ftAt) < (b._ftCt||0.3)) b.ctrl=BC.TOUCH;
      else b.ctrl = sp>0.18 ? BC.DRIBBLE : BC.CONTROLLED;
      return;
    }
    b.ctrl=BC.FREE;
  }
  counterOn(side){ return !!(this._cw && this._cw.side===side && this.t<this._cw.until); }
  /* 역습 창의 세기 (0~1) — 열려 있지 않으면 0 */
  counterK(side){ return this.counterOn(side) ? (this._cw.k!=null?this._cw.k:0.75) : 0; }
  /* 패스 한 번을 장부에 적는다 — 같은 팀끼리, 자기 자신 제외 */
  pmLink(from, to){
    try{
      if(!from || !to || from.side!==to.side || from.id===to.id) return;
      const P=this.pmap[from.side]; if(!P) return;
      const k=from.id+">"+to.id;
      P.link[k]=(P.link[k]||0)+1;
      /* 📍 노드 위치는 「패스를 주고받은 순간의 자리」다 — 실제 패스맵이 쓰는 기준이다.
         경기 내내의 평균을 쓰면 모두가 공을 따라다닌 결과로 중앙에 뭉쳐 형태가 사라진다. */
      for(const q of [from,to]){
        if(!P.meta[q.id]) P.meta[q.id]={n:(q.p&&q.p.no)||0, nm:(q.p&&q.p.name)||"", pos:q.p?q.p.pos:"MF", slot:q.slot};
        const o=P.ppos[q.id] || (P.ppos[q.id]={x:0, y:0, n:0});
        const flip=q.dir<0;
        o.x += flip ? (1-q.x) : q.x;
        o.y += flip ? (1-q.y) : q.y;
        o.n++;
      }
    }catch(e){}
  }
  /* 평균 위치 — 1초에 한 번 그라운드 위 좌표를 적립한다 */
  /* 📈 ⚠ 요청 — 「경기 끝나면 리포트에 패스맵 나오잖아. 그 옆에 경기 모멘텀도 나오게」.
     FM 의 그 막대 그래프다. 「그 1분 동안 누가 경기를 쥐고 있었나」를 한 칸으로 만든다.
       · 점유 — 그 분 동안 공을 가진 틱 수
       · 영역 — 공이 상대 진영 3분의 1에 있던 틱 수 (밀어붙였다는 증거)
       · 슛   — 한 방이 점유 10틱보다 무겁다
       · 골   — 그 분의 주인을 통째로 바꾼다
     값은 −1(상대 완전 우세) ~ +1(우리 완전 우세). */
  momTick(){
    try{
      if(!this.recording) return;
      const m=Math.floor(this.clock/60);
      if(!this._mo) this._mo={cur:-1, h:0, a:0, out:[], g:[], hs:0, as:0, hg0:0, ag0:0};
      const O=this._mo;
      if(O.cur!==m){
        if(O.cur>=0) this.momFlush();
        O.cur=m; O.h=0; O.a=0;
        O.hs=this.stats.h.shot|0; O.as=this.stats.a.shot|0;
        O.hg0=this.M.hg|0; O.ag0=this.M.ag|0;
      }
      const b=this.ball;
      if(this.possSide==="h") O.h+=1; else if(this.possSide==="a") O.a+=1;
      let hd=1; try{ const s0=this.side("h")[0]; if(s0) hd=s0.dir; }catch(e){}
      const hx = hd>0 ? b.x : 1-b.x;            // 0=홈 골문 · 1=원정 골문
      if(hx>0.66) O.h+=1.6; else if(hx<0.34) O.a+=1.6;
    }catch(e){}
  }
  momFlush(){
    try{
      const O=this._mo; if(!O || O.cur<0) return;
      const dhs=(this.stats.h.shot|0)-O.hs, das=(this.stats.a.shot|0)-O.as;
      const dhg=(this.M.hg|0)-O.hg0,        dag=(this.M.ag|0)-O.ag0;
      O.h += dhs*10 + dhg*28; O.a += das*10 + dag*28;
      if(dhg>0) for(let i=0;i<dhg;i++) O.g.push({m:O.cur, s:"h"});
      if(dag>0) for(let i=0;i<dag;i++) O.g.push({m:O.cur, s:"a"});
      const t=O.h+O.a;
      O.out.push({m:O.cur, v: t>0 ? +(((O.h-O.a)/t)).toFixed(3) : 0});
    }catch(e){}
  }
  momFinish(){
    try{ this.momFlush(); if(this._mo) this.M.momo={v:this._mo.out.slice(), g:this._mo.g.slice(), ht:Math.floor((this.htSec||2700)/60)}; }catch(e){}
  }
  pmSample(){
    try{
      for(const a of this.agents){
        if(!a || !a.p) continue;
        const P=this.pmap[a.side]; if(!P) continue;
        const o=P.pos[a.id] || (P.pos[a.id]={x:0, y:0, n:0});
        /* 후반에 진영을 바꿔도 「우리가 공격하는 방향」이 위쪽이 되도록 좌표를 뒤집어 둔다 */
        const flip = a.dir<0;
        o.x += flip ? (1-a.x) : a.x;
        o.y += flip ? (1-a.y) : a.y;
        o.n++;
        if(!P.meta[a.id]) P.meta[a.id]={n:(a.p.no)||0, nm:a.p.name||"", pos:a.p.pos||"MF", slot:a.slot};
      }
    }catch(e){}
  }
  /* 경기가 끝나면 M 에 옮겨 담는다 — 리포트가 이걸 그린다 */
  pmFinish(){
    try{
      const out={};
      for(const key of ["h","a"]){
        const P=this.pmap[key];
        const XI=new Set(P.xi||[]);
        const nodes=[];
        /* 표본 수 → 출전 시간. 틱·클럭 환산에 기대지 않고 「가장 오래 뛴 선수 = 풀타임」으로 잡는다 */
        let topN=1; for(const id in P.pos) topN=Math.max(topN, P.pos[id].n||0);
        for(const id in P.pos){
          if(XI.size && !XI.has(+id)) continue;        // 선발 11명만
          const o=P.pos[id]; if(!o.n) continue;
          const m=P.meta[id]||{};
          /* 패스 표본이 충분하면 그 평균을, 아니면 경기 내내의 평균 위치를 쓴다 */
          const pp=P.ppos[id];
          const use=(pp && pp.n>=4) ? pp : o;
          nodes.push({id:+id, x:+(use.x/use.n).toFixed(4), y:+(use.y/use.n).toFixed(4),
                      mn:Math.round(o.n/topN*90), tch:(pp?pp.n:0),
                      no:m.n||0, nm:m.nm||"", pos:m.pos||"MF"});
        }
        /* 양방향을 하나로 합친다 — 패스맵은 「두 사람 사이의 연결」을 본다 */
        const pair={};
        for(const k in P.link){
          const [f,t2]=k.split(">").map(Number);
          if(XI.size && (!XI.has(f)||!XI.has(t2))) continue;   // 교체 선수와의 연결은 빼둔다
          const kk=(f<t2?f+"-"+t2:t2+"-"+f);
          pair[kk]=(pair[kk]||0)+P.link[k];
        }
        const links=Object.keys(pair).map(kk=>{
          const [f,t2]=kk.split("-").map(Number);
          return {a:f, b:t2, n:pair[kk]};
        }).sort((x,y)=>y.n-x.n);
        out[key]={nodes, links};
      }
      this.M.pmap=out;
    }catch(e){}
  }
  giveTo(a, opt){
    const b=this.ball;
    if(a){ a._relaxOn=false; a._freeSince=null; a._engSince=null; }   // 🚶 방치 래치 초기화 (새 소유)
    /* 🎯 컷백을 받았다는 표시 — 아래 판단(decide)에서 「지금은 때리는 자리」로 읽는다.
       📏 20260913-3600 계측(컷백 5.33회/경기): 낙하점 4.7m 안에 동료가 있고 실제로 받는데,
          <b>받은 뒤 3.67회(69%)가 슛을 안 한다.</b> 자리도 배달도 되는데 마지막이 없었다. */
    if(a && b.isCross && b.crossType===CROSS_TYPE.CUTBACK && b._passer && a.side===b._passer.side)
      a._cbFrom=this.t;
    /* 🎯 압박 결과 — 릴리스 없이 소유가 수비 쪽으로 넘어오면 WIN. 릴리스가 이미 분류됐어도
       1.5초 안에 그 공을 회수하면 WIN 으로 승격한다(몰아서 차게 만든 공을 주웠다면 그게 성공이다) */
    try{
      if(a && a.side){
        const ep=this._pEp&&this._pEp[a.side];
        if(ep){ this._pEpClose(a.side, "WIN", "turnover"); }
        else if(this._prLast&&this._prLast[a.side]&&this.t-this._prLast[a.side].t<1.5&&this._prLast[a.side].res!=="WIN"){
          const L=this._prLast[a.side], st2=this._prStat[a.side];
          st2[L.res]--; st2.WIN=(st2.WIN||0)+1; L.res="WIN";
          this.evl("PRESS_RES", a, {res:"WIN", how:"recover"});
        }
      }
    }catch(e){}
    /* 🔥 ⚠ 요청 — 「슛까지 못 간 빅찬스」도 볼거리다.
       박스 안에서 공을 잡고 있던 공격 쪽이 소유를 통째로 내주는 순간 —
       침투가 걷어차이거나, 1대1을 만들었다가 끊기거나, 마지막 패스가 차단되는 장면이다.
       ⚠ 박스 혼전에서 소유가 여러 번 오가므로 6초 쿨다운을 둔다 — 한 장면을 반복해 잡지 않게. */
    try{
      const prev=b._ownSide||null;
      if(prev && a && a.side && a.side!==prev && !b.setPiece && !b.shot){
        const atk=this.side(prev)[0];
        /* 🎬 하이라이트 점검 — 이 트리거가 경기당 65~70회 잡혀(실제 축구의 「슛 없는 빅찬스」는 5~10회)
           확장 레벨이 장면 92~103개·1배속 39~44분짜리 스팸이 됐다. 품질 게이트: 소유를 내준 지점의
           슛 기대값(17m 안 + 각 살아있음)이 있어야 「빅찬스를 놓쳤다」다. 쿨다운 6 → 12초. */
        if(atk && !b.aerial && inBox({x:b.x, y:b.y}, atk.dir) && (this.t-(this._chT||-99))>12.0){   // 공중볼 경합·걷어낸 크로스 회수는 「놓친 빅찬스」가 아니다
          const _g=shotGeom({x:b.x, y:b.y, dir:atk.dir});
          if(_g && _g.distM<13.5 && _g.angle>0.36){   // ⚠ 1차 17m/0.28 은 박스 대부분이 통과(41~43회) — 진짜 「골 냄새」만
            this._chT=this.t;
            this.markHighlight("chance", prev, HL_W.chance);
          }
        }
      }
      /* 🎬 역습 전개 — 우리 진영(0.45 이하)에서 소유를 얻어 9초 안에 파이널서드(0.66)에 도달 */
      if(a && a.side){
        if(b._ownSide!==a.side && !b.setPiece){
          this._possStart={side:a.side, t:this.t, adv:(a.dir>0?b.x:1-b.x), fired:false};
        }
        const ps=this._possStart;
        if(ps && !ps.fired && ps.side===a.side && (a.dir>0?a.x:1-a.x)>0.66 &&
           ps.adv<0.45 && this.t-ps.t<9.0 && !b.setPiece){
          ps.fired=true;
          this.markHighlight("counter", a.side, HL_W.counter);
        }
      }
      if(a && a.side) b._ownSide=a.side;
    }catch(e){}
    try{ if(b._passer && !b.setPiece) this.pmLink(b._passer, a); }catch(e){}
    /* ⚽ 퍼스트 터치 — 닿는 순간의 공 속도·높이·각도와 선수의 능력으로 결과가 갈린다.
       공을 발밑에 붙이지 않는다. 터치한 방향으로 밀려나고, 속도도 완전히 죽지 않는다. */
    /* 💥 접촉 해석 — 어느 부위에, 어떤 상대 속도로 맞았는가 */
    /* ⚡ 원터치 슈팅 — 잡지 않고 그대로 때리는 게 최선인 상황이면 여기서 갈라진다.
       퍼스트터치를 건너뛰고, 들어오던 공의 속도·높이를 그대로 살려 기존 슛 시스템으로 넘긴다. */
    if(!(opt&&opt.noTouch) && !b.setPiece && !b.shot && !b.celebrate && !b.foulScene
       && a.slot!=="GK" && (b.state==="PASS"||b.state==="LOOSE")
       && !(b._otAt!=null && this.t-b._otAt<1.0)){
      /* 🦶 원터치도 발이 닿는 거리에서만 — 멀리 있는 공을 그대로 때리는 마법은 없다 */
      const _otD=HYP((b.x-a.x)*PITCH_AR, b.y-a.y)*ISO_TO_M;
      let ot=null;
      if(_otD<=KICK_REACH_M*1.15){
        try{ ot=oneTouchEval(a, b, this.side(this.opp(a.side)), null); }catch(e){ ot=null; }
      }
      if(ot && ot.ok){
        b._otAt=this.t;
        b.ownerId=a.id; this.possSide=a.side; this.lastTouch=a.side;
        /* 들어오던 공의 속도·높이를 그대로 쓴다 — 정지시키지 않는다 */
        const gkO=this.side(this.opp(a.side)).find(q=>q.slot==="GK")||null;
        const type=chooseShotType(a, ot.g, b, gkO, {oneTouch:true});
        /* 발을 대는 순간의 위치 — 공이 오던 방향으로 아주 조금 앞에서 맞힌다.
           ⚠ 빠른 패스에서는 이 보정만으로 공이 2m 넘게 앞서 나가 「멀리서 때리는」 그림이 됐다.
              접점 이동은 반 걸음(최대 0.5m)까지만. */
        {
          const _sx=(b.vx||0)*0.35, _sy=(b.vy||0)*0.35;
          const _sm=HYP(_sx*PITCH_AR,_sy)*ISO_TO_M;
          const _lim2=0.5;
          const _k3=_sm>_lim2 ? (_lim2/_sm) : 1;
          b.x=clamp01(b.x+_sx*_k3); b.y=clamp01(b.y+_sy*_k3);
        }
        this.evl("ONE_TOUCH", a, {d:Math.round(ot.g.distM), s:Math.round(ot.score*100)/100, t:type});
        if(this.emitEvents){
          const far=!ot.inBox;
          this.cap(a.side, far
            ? ["💥 {p}, 잡지도 않고 그대로 중거리 슛!","💥 {p}의 원터치 중거리포!"]
            : (ot.aerial ? ["⚡ {p}, 다이렉트 발리!","⚡ {p}, 떨어지는 공을 그대로 때립니다!"]
                         : ["⚡ {p}, 원터치 슛!","⚡ {p}, 잡지 않고 곧바로 때립니다!"]), {p:this.nm(a)});
        }
        /* 원터치의 정확도 — 잡고 때리는 것보다 어렵지만, 「좋은 기회일수록」 잘 맞는다.
           문턱을 크게 웃도는 상황(컷백을 정면으로 받는 등)은 오히려 잡는 것보다 낫다. */
        const marg=clamp((ot.score-ot.need)*0.55, 0, 0.30);
        const acc=clamp(0.92+ot.faceK*0.18+ot.inLine*0.12+(ot.speedK-0.8)*0.16+marg, 0.80, 1.32);
        /* ⚠ 통계 버그 — 크로스를 원터치로 때리는 건 <b>크로스의 가장 좋은 결말</b>인데,
           여기서 return 해 버려 아래 crossOk 집계를 건너뛰었다. 그래서 크로스 성공률이
           8% 대(실축 25%)로 찍혔다. 먼저 세고 나간다. */
        if(b.isCross && b._passer){
          if(a.side===b._passer.side) this.stats[b._passer.side].crossOk++;
          b.isCross=false;
        }
        this.resolveShot(a, ot.g, type, {oneTouch:true, accK:acc});
        return;
      }
    }
    let ct=null, ft=null;
    if(!(opt&&opt.noTouch)){
      try{ ct=resolveBallPlayerContact(a, b, this.side(this.opp(a.side))); ft=ct.ft; }catch(e){ ct=null; ft=null; }
    }
    b.inNet=false;
    if(!ct){ b.z=0; b.vz=0; }
    if(b.isCross && b._passer){                  // 크로스가 같은 팀에게 연결됐는가
      if(a.side===b._passer.side) this.stats[b._passer.side].crossOk++;
      b.isCross=false;
    }
    /* 도움 규정 — 상대 선수(키퍼 포함)의 몸에 맞거나 소유가 넘어가면 "마지막 패스"는 무효다 */
    if(this.lastAssist && a.side!==this.lastAssist.side) this.lastAssist=null;
    b._spBall=false;                 // 누군가 잡았다 — 세트피스 상황 종료
    /* 소유권 탈환 감지 — 역습 전술 팀이 자기 진영에서 공을 끊었으면 역습 창이 열린다 */
    if(a.side!==this.possSide){
      try{
        const T=TAC(a.team);
        const own=a.dir>0?a.x:1-a.x;
        /* ⚡ 역습 강도(0~4) — 셀수록 더 넓은 지역에서, 더 오래 역습 창이 열린다.
           0(안 함)이면 아예 열리지 않는다. 4(극단)면 하프라인 근처에서 끊어도 달린다. */
        const k=ctrK(T);
        const zone = 0.42 + k*0.26;                 // 1단계 0.49 → 4단계 0.68
        const dur  = 4.5 + k*4.5;                   // 1단계 5.6초 → 4단계 9초
        this._cw = (k>0 && own<zone) ? {side:a.side, until:this.t+dur, k} : null;
      }catch(e){ this._cw=null; }
    }
    this.lastTouch=a.side;                       // 마지막으로 볼에 손댄 팀
    if(ct && (ct.q==="HEAVY"||ct.q==="BAD"||ct.q==="FAIL")){ a._ftBad=this.t+PP_FTBAD_T; a._ftSaid=false; }   // 🎯 첫 터치 트리거
    if(ct && !ct.controlled){
      /* 🚨 통제 실패 — 공은 몸에 맞고 굴절되어 흘러간다. 소유가 아니다. */
      b.state="LOOSE"; b.ownerId=null; b._rollOwner=null; b._loc=null; b._knock=null;
      b.looseT=0; b.looseBy=a.side;
      b.vx=Math.cos(ct.ang)*ct.spd/PITCH_AR; b.vy=Math.sin(ct.ang)*ct.spd;
      b.vz=ct.vz; b.z=Math.max(b.z, ct.vz>0?0.004:0);
      /* 몸에 맞고 굴절된 공은 새 회전을 얻는다 — 원래 회전은 사라진다 */
      b.spin={ side:(Math.random()-0.5)*0.5, back:(Math.random()-0.5)*0.4 };
      b.aerial=b.z>0.004;
      b._contact={part:ct.part, kind:ct.kind, q:ct.q, rel:ct.rel};
      this.stats[a.side].touch=(this.stats[a.side].touch||0)+1;
      this.stats[a.side]["ct"+ct.kind]=(this.stats[a.side]["ct"+ct.kind]||0)+1;
      if(this.emitEvents && Math.random()<0.20){
        const msg = ct.kind==="BOUNCE" ? ["🙆 {p}, 머리에 맞고 공이 떠오릅니다"]
                  : ct.kind==="DEFLECTION" ? ["😖 {p} 몸에 맞고 공이 엉뚱한 쪽으로 튑니다"]
                  : ["😬 {p}, 터치가 크게 튀어나갑니다"];
        this.cap(a.side, msg, {p:this.nm(a)});
      }
      this.possSide=a.side;
      return;
    }
    if(ct) { b.z=0; b.vz=0; }
    if(ft){
      /* ⚽ 터치는 "위치 이동"이 아니라 "속도 부여"다 (스펙 §13).
         공을 그 자리에서 터치 방향으로 튕겨 보내고, 실제 이동은 몇 틱에 걸쳐 일어난다.
         ⚠ 예전에는 여기서 공을 최대 7m까지 즉시 옮겨서, 나쁜 터치가 순간이동으로 보였다.
         목표 이탈 거리(ft.dist)를 감속(마찰)을 고려한 초기 속도로 환산한다. */
      const TICKS=Math.max(1, Math.round(ft.ct/SIM_DT));      // 정리 시간 동안 굴러간다
      const damp=BALL_ROLL_FRICTION;
      let sum=0, w=1; for(let i=0;i<TICKS;i++){ sum+=w; w*=damp; }
      const v0=ft.dist/Math.max(1e-6, sum);                   // 이 속도로 시작하면 dist 만큼 굴러간다
      b.vx=Math.cos(ft.ang)*v0/PITCH_AR; b.vy=Math.sin(ft.ang)*v0;
      /* 접촉 지점 — 발이 닿은 자리에서 아주 조금만 앞으로 (순간이동 아님) */
      const nudge=Math.min(ft.dist*0.18, SPD.SPRINT*SIM_DT*0.5);
      b.x=clamp01(b.x+Math.cos(ft.ang)*nudge/PITCH_AR);
      b.y=clamp01(b.y+Math.sin(ft.ang)*nudge);
      this.stats[a.side].touch=(this.stats[a.side].touch||0)+1;
      this.stats[a.side]["ft"+ft.q]=(this.stats[a.side]["ft"+ft.q]||0)+1;
      /* 🚨 크게 튄 터치는 소유가 아니다 — 공은 흐르고, 상대가 먼저 닿을 수 있다 */
      if(ft.q==="HEAVY"||ft.q==="BAD"||ft.q==="FAIL"){ a._ftBad=this.t+PP_FTBAD_T; a._ftSaid=false; }   // 🎯 첫 터치 트리거
      if(ft.dist>=FT.LOOSE_AT || ft.q==="FAIL"){
        b.state="LOOSE"; b.ownerId=null; b._rollOwner=null; b._loc=null;
        b._looseFrom=a.id; b._looseAt=this.t;
        this.evl("TOUCH", a, {q:ft.q, loose:1, from:b.fromId||0});
        if(this.emitEvents && Math.random()<0.22) this.cap(a.side, ["😖 {p}, 퍼스트 터치가 길게 튀어나갑니다"], {p:this.nm(a)}, true);
        this.possSide=a.side;
        return;
      }
      b.ownerId=a.id; b.state="SETTLED";
      this.evl("TOUCH", a, {q:ft.q, from:b.fromId||0});
      b.vx*=0.55; b.vy*=0.55;      // 소유한 터치는 발 앞에 살짝 놓는 느낌 — 굴러가는 양을 줄인다
      b._loc=(a.face!==undefined)?ballToLocal(b, a):null;
      /* 컨트롤 시간 — 좋은 터치는 곧바로 다음 행동, 나쁜 터치는 수습에 시간이 걸린다 */
      let base=(1.8+Math.random()*1.6)*TEMPO*this.tempoK(a.side)*(this.counterOn(a.side)?(0.80-this.counterK(a.side)*0.35):1);
      /* 🧲 상대를 끌어내는 순환 — 후방에서 압박이 약하면 공을 오래 쥐지 않고 빠르게 돌린다.
         짧은 패스를 반복해 상대를 나오게 만드는 것 자체가 목적이다 (§9·§20).
         ⚠ 실측: 팀당 패스가 134회(실제의 3분의 1)로 낮았던 주된 이유가 이 소유 시간이다. */
      {
        const bu=this._bu;
        if(bu && (bu.state===BU_STATE.FIRST || bu.state===BU_STATE.RESTART ||
                  bu.state===BU_STATE.PROGRESS) && bu.press<0.55){
          const A2=(a.p&&a.p.attr)||{};
          const cmp2=clamp(attr20(A2.cmp!=null?A2.cmp:60)/20, 0.15, 1);
          /* 🎚️ ⚠ 제보 — 「패스 템포가 수비수에게는 적용 안 된다」. 이 빠른 순환 배수가 템포
             슬라이더와 무관하게 걸려 후방에서 템포 차이가 절반쯤 지워졌다(실측 DF 3.2~4.2s vs
             MF 3.8~4.2s). 보통·빠름은 예전 그대로, 느리게 쪽으로 갈수록 순환 가속이 풀린다. */
          const _ov2=0.46 + (1-cmp2)*0.22;
          const _tk2=this.tempoK(a.side);                        // 0.70(매우 빠름)~1.30(매우 느림)
          const _mix2=clamp((1.30-_tk2)/0.30, 0, 1);             // 1.0 이하(보통~빠름)=1 → 예전과 동일
          base *= 1 - (1-_ov2)*_mix2;        // 템포 보통·빠름이면 예전 배수 그대로, 느리면 가속 해제
        }
      }
      /* ⚠ 압박이 강하면 소유 시간을 줄이는 보정을 넣어 봤지만(1.16-press*0.66),
         걷어내기는 팀당 54→51회로 거의 그대로였고 슛만 13.5→16회로 늘었다.
         갇혀서 걷어내는 게 아니라 「줄 곳이 없어서」 걷어내는 것이므로 되돌렸다. */
      /* ⚔️ 공격 3지역에서는 오래 쥐지 않는다 — 긴 소유(패스 순환용)는 후방의 것.
         박스 앞에서도 4~8초짜리 소유 시간이 그대로 적용돼, 슛 각이 열려 있어도
         판단 없이 걸어 들어가는 「골라인 치달」의 진짜 원인이었다 (실측 hold 2~5초). */
      { const advA=a.dir>0?a.x:1-a.x;
        if(advA>0.86)      base*=0.22;   // 박스 언저리 — 즉시 판단
        else if(advA>0.72) base*=0.45;   // 공격 3지역 — 빠른 판단
        else if(advA>0.60) base*=0.75; }
      b.hold=base*0.72 + ft.ct;
      b._ftQ=ft.q; b._ftAt=this.t; b._ftCt=ft.ct;   // 퍼스트터치 시각·정리 시간 (상태 표시용)
      /* 슛은 「방금 내가 한 터치」를 읽어야 한다. 공에만 남기면 다른 선수의 접촉이 덮어쓴다. */
      a._ftQ=ft.q; a._ftAt=this.t; a._ftCt=ft.ct;
      if(ct){ b._contact={part:ct.part, kind:ct.kind, q:ct.q, rel:ct.rel};
              this.stats[a.side]["ct"+ct.kind]=(this.stats[a.side]["ct"+ct.kind]||0)+1; }
    } else {
      /* ⚠ 여기가 마지막으로 남아 있던 "공을 선수 위치에 그대로 대입"하는 지점이었다.
         손으로 잡는 골키퍼도 공이 순간이동하면 안 된다 — 몸 앞으로 끌어안는 거리를 둔다.
         (공을 잡는 순간의 위치를 그대로 살리고, 발/손 앞 오프셋만 준다) */
      /* 🧤 컨트롤 vs 걷어내기 (§27) — 박스 밖·상대 코앞·공이 너무 빠르면 잡지 않고 걷어낸다 */
      if(a.slot==="GK"){
        const advG=(a.dir>0?b.x:1-b.x);
        let oppN=9;
        for(const o of this.side(this.opp(a.side))){
          if(o.slot==="GK") continue;
          const dd=HYP((o.x-a.x)*PITCH_AR, o.y-a.y);
          if(dd<oppN) oppN=dd;
        }
        const spd0=HYP(b.vx||0, b.vy||0);
        if(advG>(1-BOX_X) || oppN<0.045 || spd0>0.13){
          this.clearBall(a); return;
        }
      }
      b.vx=0; b.vy=0;
      b.ownerId=a.id; b.state="SETTLED";
      this.evl(a.slot==="GK"?"GK_CATCH":"TOUCH", a, {from:b.fromId||0});
      const f=(a.face===undefined) ? Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR) : a.face;
      const hold=(a.slot==="GK") ? 0.010 : 0.014;         // 키퍼는 품에 안으므로 더 가깝다
      b._loc={fwd:hold, lat:0};
      const w0=localToWorld(b._loc, {x:a.x, y:a.y, face:f});
      /* 한 틱에 옮길 수 있는 만큼만 — 남은 거리는 다음 틱에 이어서 붙인다 */
      const gx=w0.x-b.x, gy=w0.y-b.y, gd=HYP(gx*PITCH_AR, gy);
      const step=Math.min(gd, SPD.CARRY*SIM_DT*1.6);   // 🏃 CARRY
      if(gd>1e-6){ b.x=clamp01(b.x+(gx/gd)*step/PITCH_AR*PITCH_AR); b.y=clamp01(b.y+(gy/gd)*step); }
      b.hold=(1.8+Math.random()*1.6)*TEMPO*this.tempoK(a.side)*(this.counterOn(a.side)?(0.80-this.counterK(a.side)*0.35):1);
      a._recvAt=this.t;                                      // 🔁 원터치 판정용 — 받은 시각
      /* 🔁 2대1 의 벽 역할 — 되돌림 창(2.8초)의 대부분을 기본 hold(1.8~3.4초×템포)가 먹어 완성이 3%였다.
         벽은 잡자마자 판단한다. */
      if(b._oneTwo && b._oneTwo.recvId===a.id && this.t<b._oneTwo.until) b.hold*=0.40;
      if(a.slot!=="GK"){ const advA=a.dir>0?a.x:1-a.x;
        if(advA>0.86) b.hold*=0.22; else if(advA>0.72) b.hold*=0.45; else if(advA>0.60) b.hold*=0.75; }
      /* ⚠ 제보 — 「키퍼가 공을 들고 산보하듯 옆으로 몰고 다니다 압박에 뺏긴다」.
         키퍼도 필드 플레이어와 같은 1.8~3.4초를 들고 있었다. 실제 키퍼는 잡는 즉시 처리한다.
         침착성이 좋은 키퍼가 조금 더 여유를 갖되, 그래도 절반 이하로 줄인다. */
      if(a.slot==="GK"){
        const cmpG=(a.p&&a.p.attr&&attr20(a.p.attr.cmp)/20)||0.6;
        b.hold=clamp(b.hold*(0.30+cmpG*0.16), 0.25, 1.15);
      }
    }
    this.possSide=a.side;
  }
  /* 매 틱 경기 규칙을 점검하고 상태를 갱신한다.
     지금이 흐르는 중인지, 반칙 장면인지, 어떤 세트피스로 멈춰 있는지를 한곳에서 정한다. */
  checkMatchRules(){
    const b=this.ball;
    if(b.celebrate)       this.matchState=MATCH_STATE.CELEBRATION;
    else if(b.foulScene)  this.matchState=MATCH_STATE.FOUL_SCENE;
    else if(b.setPiece)   this.matchState=SP_STATE[b.setPiece.kind]||MATCH_STATE.FREE_KICK;
    else                  this.matchState=MATCH_STATE.PLAYING;
    return this.matchState;
  }
  /* 주심 — 볼을 따라다니되 플레이에 끼지 않을 만큼 거리를 둔다.
     반칙 장면에서는 반칙한 선수에게 곧장 다가간다. */
  moveReferee(){
    const b=this.ball, r=this.ref;
    let tx, ty, spd=SIM_REF_SPEED;
    const fs=b.foulScene;
    if(fs){
      const f=this.byId(fs.foulerId);
      if(f){ tx=f.x-0.020; ty=f.y-0.018; spd=SIM_REF_SPEED*1.5; }
      else { tx=fs.spot.x; ty=fs.spot.y; }
    } else {
      /* 실제 주심의 "대각선 시스템" —
         · 볼을 비스듬히 뒤에서 따라가되, 골라인·페널티 박스 안까지 파고들지 않는다
           (골라인 근처는 부심 담당 구역이다)
         · 볼이 측면에 있으면 반대쪽 대각선으로 살짝 비켜서 시야각을 확보한다 */
      tx=b.x-0.035;
      ty=b.y-SIM_REF_TRAIL + (0.5-b.y)*0.30;          // 반대편 대각선 편향 — 플레이를 심판과 부심 사이에 둔다
      /* 종방향 순찰 한계 — 페널티 아크 언저리(양쪽 박스 진입선 밖)까지만 내려간다 */
      const X_MIN=0.145, X_MAX=0.855;                  // 박스 라인(0.835) 바깥 + 여유
      tx=clamp(tx, X_MIN, X_MAX);
      /* 볼이 박스 깊숙이 들어가면 쫓아 들어가지 않고 아크 부근에서 각을 잡는다 */
      if(b.x>X_MAX) ty=lerp(ty, 0.5+(b.y-0.5)*0.45, 0.5);
      if(b.x<X_MIN) ty=lerp(ty, 0.5+(b.y-0.5)*0.45, 0.5);
      ty=clamp(ty, 0.10, 0.90);                        // 터치라인 밖·구석까지 밀리지 않는다
    }
    const mx=(clamp01(tx)-r.x)*PITCH_AR, my=clamp01(ty)-r.y, ml=HYP(mx,my);
    if(ml>1e-6){
      const step=Math.min(ml, spd*SIM_DT);
      r.x=clamp01(r.x+(mx/ml)*step/PITCH_AR);
      r.y=clamp01(r.y+(my/ml)*step);
    }
  }
  /* 반칙이 일어났다 — 경기를 멈추고 심판을 부른다. */
  /* ══════════════════════════════════════════════════════════════
     ⚖️ FOUL EVIDENCE (§3~11) — 접촉 ≠ 파울. 태클 순간의 물리를 증거로 모은다.
       · ballPlay   태클러가 공에 닿을 거리였는가 (공을 먼저 건드린 정상 태클)
       · late       공은 이미 지나갔는데 사람만 맞췄는가
       · behind     뒤에서 들어갔는가
       · speedM     상대 속도 (m/s) — 빠를수록 위험
       · shoulder   어깨 대 어깨 정상 경합인가 (§12)
     점수 0~1: ≥0.70 명백한 파울 · ≤0.28 정상 플레이 · 중간만 심판 성향+소폭 랜덤 (§43·44)
     ══════════════════════════════════════════════════════════════ */
  foulEvidence(o, carrier, slide){
    const b=this.ball;
    const ballD=HYP((b.x-o.x)*PITCH_AR, b.y-o.y);            // 태클러 → 공
    const ballPlay=clamp(1-ballD/(TACKLE_RANGE*(slide?1.7:1.15)), 0, 1);   // §6 공을 노린 태클
    /* §7 늦은 태클 — 공이 태클러에게서 멀어지는 중인데 접촉 */
    const bvx=(b.vx||0), bvy=(b.vy||0);
    const away=((b.x-o.x)*PITCH_AR*bvx + (b.y-o.y)*bvy) > 0.0004;
    const late=(ballD>TACKLE_RANGE*1.1 && away) ? 1 : 0;
    /* §8 뒤에서 */
    const behind=((carrier.x-o.x)*carrier.dir > 0.004) ? 1 : 0;
    /* 상대 속도 (§5·§10) */
    const speedM=HYP(((o.vx||0)-(carrier.vx||0))*PITCH_AR, (o.vy||0)-(carrier.vy||0))/SIM_DT*ISO_TO_M;
    const fast=clamp((speedM-4.5)/6, 0, 1);
    /* §12 어깨 경합 — 나란히 달리며 공이 플레이 거리 안 */
    let shoulder=0;
    if(!slide && ballD<0.05){
      const dot=((o.vx||0)*(carrier.vx||0)+(o.vy||0)*(carrier.vy||0));
      const side=Math.abs((carrier.x-o.x)*carrier.dir)<0.006;
      if(dot>0 && side) shoulder=1;
    }
    let wonScore = 0;                       // 「따냈는데 파울」 — 아래 능력치 블록에서 정한다
    let score = 0.42
              - ballPlay*0.46                 // 공을 노렸으면 대폭 감점
              + late*0.34 + behind*0.16 + fast*0.22
              + (slide?0.10:0) - shoulder*0.30;
    /* 👤 능력치 비교 — 제보 원문의 FM 모델 참고:
         「선수의 태클·반칙 성향(적극성)·판단력이 상대의 균형감각·개인기와 맞물려 연산된다」.
       ⚠ 여기가 통째로 빠져 있었다. 이 함수는 <b>기하와 속도만</b> 봤다 —
          같은 상황에서 적극성 18짜리 파이터와 5짜리 신사가 <b>완전히 같은 판정</b>을 받았다.
          팀 지시(T.tackle)와 특성(aggPress)은 호출부에서 얹히지만 그건 팀·역할이지 개인이 아니다.
       ─ 태클러: 적극성↑ 거칠어지고 · 판단력↑ 타이밍을 알고 · 태클 능력↑ 깨끗하게 딴다
         피해자: 균형감각↑ 버텨서 안 넘어지고 · 개인기↑ 수비수가 늦게 닿는다(파울을 얻어낸다)
       ⚠ 기하를 덮지 않을 만큼만 — 항마다 최대 ±0.13, 합쳐도 ±0.35 안쪽이다.
          「공을 정확히 노린 태클」이 능력치 때문에 파울이 되면 안 된다. */
    {
      const _at=(p,k,fb)=>{ const A2=(p&&p.p&&p.p.attr)||{};
        return clamp(attr20(A2[k]!=null?A2[k]:(fb||60))/20, 0.15, 1); };
      const dAgg=_at(o,"agg",55), dDec=_at(o,"dec",60), dTck=_at(o,"tck",60);
      const cBal=_at(carrier,"bal",60), cTec=_at(carrier,"tec",60);
      score += (dAgg-0.55)*0.30 - (dDec-0.55)*0.22 - (dTck-0.55)*0.20
             - (cBal-0.55)*0.16 + (cTec-0.55)*0.12;
      /* 🦵 ⚠ 재설계 — 「볼은 따냈는데 파울」 경로가 <b>영원히 안 탔다</b>.
         호출부가 이 score 로 evW.score>=0.80 을 요구했는데, 이 자는 「공을 노렸는가
         (ballPlay)」가 지배한다 — 공을 <b>따냈다는 것 자체가</b> ballPlay 를 최대로 만들어
         점수를 끌어내린다. 실측 p99 가 0.66 이라 0.80 은 구조적으로 도달 불가였다.
         ─ 따냈을 때의 파울은 「공을 건드렸는가」가 아니라 <b>사람을 어떻게 함께 갔는가</b>다.
           속도 차(과도한 힘)·슬라이딩·뒤에서·적극성이 올리고, 판단력·태클 능력이 내린다.
           ballPlay 는 아예 넣지 않는다 — 여기서는 이미 참이니까. */
      wonScore = clamp(0.06 + (slide?0.15:0.02) + behind*0.13 + fast*0.30
                       + (dAgg-0.55)*0.26 - (dDec-0.55)*0.18 - (dTck-0.55)*0.26
                       - shoulder*0.10 - (cBal-0.55)*0.10, 0, 1);
    }
    score=clamp(score, 0, 1);
    return {score, won:wonScore, ballD, ballPlay, late, behind, speedM, slide, shoulder};
  }
  /* 심판의 최종 판단 — 명백한 구간은 절대 뒤집지 않는다 (§41·44) */
  refereeFoulCall(ev){
    if(ev.score>=0.70) return true;
    if(ev.score<=0.28) return false;
    const lean=(this.refStrict||1)-1;                       // 성향은 경계 구간에만
    return (ev.score + lean*0.10 + (Math.random()-0.5)*0.14) > 0.49;
  }
  startFoulScene(fouler, victim, slide, danger, ev){
    const b=this.ball;
    /* ⚠ 제보 — "PK를 얻었는데 오프사이드로 넘어간다". 휘슬이 불리면 이전 공격의
       깃발은 늦은 깃발(pendingOff)만이 아니라 도착 대기 중인 판정(offsideAt)까지 전부 무효다. */
    this.pendingOff=null;
    b.offsideAt=null; b.toId=null;

    // 위험도 (§45) — 증거가 있으면 증거로, 없으면(잡아채기 등) 기존 방식으로
    const fromBehind = ev ? !!ev.behind : ((victim.x-fouler.x)*victim.dir > 0.004);
    let sev;
    if(ev){
      sev = 0.10 + ev.score*0.34 + clamp((ev.speedM-6)/8,0,1)*0.30
          + ev.late*0.14 + (ev.behind?0.10:0) + (slide?0.08:0);
    } else {
      sev = (slide?0.42:0.14) + (danger?0.20:0) + (fromBehind?0.18:0)
          + (1-(fouler.tackleSkill||0.6))*0.14;
    }
    /* §55 — PK 는 「접촉 지점」 기준. 피해자와 태클러 사이 지점을 접촉점으로 잡는다.
       §32 — 라인은 박스의 일부 (inBox 경계 오차 허용) */
    const cp={x:victim.x+(fouler.x-victim.x)*0.35, y:victim.y+(fouler.y-victim.y)*0.35, dir:victim.dir};
    const pen = inBox(cp, victim.dir) || inBox(victim, victim.dir);
    /* §47 DOGSO — 골문까지 열린 길을 파울로 끊었는가.
       피해자가 볼 소유·전진 중 + 골문 25m 이내 + 사이에 필드 수비수 0명 */
    let dogso=false;
    {
      const gx=victim.dir>0?1:0;
      const dG=HYP((gx-victim.x)*PITCH_AR, 0.5-victim.y)*ISO_TO_M;
      /* 판정 폭 — 0.13(±9m)으로는 레드가 경기당 0.38로 실제(0.08)의 5배였다.
         「명백한」 기회만: 골문 22m + 복귀 가능 수비(±14m 레인, 살짝 뒤도 포함) 0명. */
      if(dG<22 && (b.ownerId===victim.id || HYP((b.x-victim.x)*PITCH_AR,b.y-victim.y)<0.03)){
        let betw=0;
        for(const q of this.side(fouler.side)){
          if(q.slot==="GK" || q===fouler) continue;
          if((q.x-victim.x)*victim.dir>-0.02 && Math.abs(q.y-victim.y)<0.20) betw++;
        }
        if(betw===0) dogso=true;
      }
    }
    if(dogso) sev=Math.max(sev, 0.72);
    if(pen) sev += 0.22;
    b.foulScene={t:0, foulerId:fouler.id, victimId:victim.id,
                 spot:{x:victim.x, y:victim.y}, sev, card:null, pen, dogso,
                 restartSide:victim.side,
                 /* §54 VAR-ready — 이 판정의 근거 스냅샷 (리뷰 시스템이 읽는다) */
                 evLog: ev?{score:ev.score, ballD:ev.ballD, late:ev.late,
                            behind:ev.behind, spd:ev.speedM, cp:{x:cp.x,y:cp.y}}:null};
    /* §52·§53 판정 로그 — 왜 이 판정이 나왔는지 추적 가능하게 */
    if(!this.foulLog) this.foulLog=[];
    this.foulLog.push({t:+this.t.toFixed(1), fouler:fouler.id, victim:victim.id,
      slide:!!slide, pen, sev:+sev.toFixed(2),
      ev: ev?{score:+ev.score.toFixed(2), ballD:+(ev.ballD*ISO_TO_M).toFixed(1),
              late:ev.late, behind:ev.behind, spd:+ev.speedM.toFixed(1)}:null});
    if(this.foulLog.length>40) this.foulLog.shift();
    b.state="SETTLED"; b.ownerId=null; b.vx=0; b.vy=0; b.vz=0; b.z=0;
    b.x=clamp01(victim.x); b.y=clamp01(victim.y);
    b.hold=99;
  }
  /* 심판이 다가가 판정을 내린다 — 구두 경고 / 옐로 / 레드. */
  /* 이 반칙 팀에게 적용될 심판 계수 — 주심 성향 × (유저 팀이면) 감독-심판 관계 × 에디터 튠 */
  refCardK(side){
    return (this.refStrict||1)*meTune("card");
  }
  handleRefereeDecision(fs){
    const f=this.byId(fs.foulerId);
    if(!f) return CARD.NONE;
    const st=this.stats[f.side];
    const r=Math.random();
    let card;
    /* 성격 — 다혈질은 태클이 거칠어 카드 위험이 크고, 프로페셔널은 선을 안 넘는다.
       ⚠ 분 단위 엔진(hotHead)에는 있었는데 2D 엔진에는 빠져 있었다. */
    const persK = f.p ? (f.p.pers===3?1.35 : f.p.pers===0?0.90 : 1) : 1;
    const rc = (1 + ((f.tr||{}).cardRisk||0)) * this.refCardK(f.side) * persK;   // 특성 × 심판 × 성격
    /* §47 DOGSO — 명백한 득점 기회 저지: 박스 밖이면 퇴장, PK 면 옐로(이중 처벌 완화 규정) */
    if(fs.dogso && !fs.pen)      card=CARD.RED;
    else if(fs.dogso && fs.pen)  card=CARD.YELLOW;
    else if(r < fs.sev*0.005*rc) card=CARD.RED;    // 심각한 반칙 — 다이렉트 퇴장 (0.012 → 0.008 → 퇴장 0.38/경기, 실축 0.2)
    /* 🟨 파울/카드 밸런스(제보 후속) — 실측 옐로 6~9장/경기(파울당 25~33%), 실제 K리그는
       경기당 3~5장(파울당 ~15%). 0.53 → 0.34
       ⚠ 그 뒤 파울 자체가 30.7 → 23.3 으로 줄면서 경고도 2.57 장까지 내려갔다(실축 4).
          파울당 비율을 다시 올린다 — 총량이 아니라 <b>비율</b>이 손잡이다. 0.34 → 0.50 */
    else if(r < fs.sev*0.40*rc) card=CARD.YELLOW;   /* 0.46 에서 경고 5.37(실축 4) — 파울과 함께 내린다 */
    else                     card=CARD.VERBAL;
    if(card===CARD.YELLOW){
      f.yellows=(f.yellows||0)+1;
      if(f.yellows>=2) card=CARD.RED;              // 경고 누적 퇴장
    }
    if(card===CARD.RED && f.slot==="GK") card=CARD.YELLOW;   // 키퍼 퇴장은 다루지 않는다
    /* 🟥🟨 카드 연출 — 주심이 손을 드는 순간을 잡아 둔다 (하이라이트가 이걸 그린다) */
    if(card===CARD.RED || card===CARD.YELLOW){
      let _tm=""; try{ _tm=this.rec(f.side).team.short||""; }catch(e){}
      this._cardFx={id:f.id, k:(card===CARD.RED?"R":"Y"), side:f.side,
                    nm:(f.p?f.p.name:"선수"), ps:(f.slot||prefSlotOf(f.p||{})||f.p&&f.p.pos||""),
                    tm:_tm, t:this.t, min:Math.floor(this.clock/60)};
    }
    if(card===CARD.RED){
      // 징계 — 실제 경기에서만 (관전용 시뮬은 선수 기록을 건드리지 않는다)
      if(this.emitEvents && f.p) banApply(this.M, f.p, (f.yellows||0)>=2);
      st.red++;
      this.markHighlight("red", f.side, HL_W.red);
      let _tm2=""; try{ _tm2=this.rec(f.side).team.short||""; }catch(e){}
      this.sentOff.push({id:f.id, side:f.side, t:this.t, min:Math.floor(this.clock/60),
                         lbl:(()=>{ try{ return this.clockLabel(); }catch(e){ return null; } })(),
                         name:f.p?f.p.name:"", pos:(f.p&&f.p.pos)||"", slot:f.slot||"",
                         team:_tm2, second:((f.yellows||0)>=2)});
      /* 🎬 하이라이트에서 「퇴장당한 그 선수」가 보여야 한다 — 그리기용으로 남겨 둔다.
         ⚠ 예전에는 agents 에서 곧바로 지워서, 퇴장 장면을 되감아도 정작 그 선수가 화면에 없었다. */
      this.retireAgents(a=>a.id===f.id, "red");               // 배열에서 제거 — 퇴장 (그리기용 사본은 남는다)
      /* 🚫 7명 미만 — 몰수패. 시뮬을 그 자리에서 끝낸다 */
      if(this.side(f.side).length<7 && this.emitEvents){
        const sd = f.side==="h" ? this.M.h : this.M.a;
        const isH = f.side==="h";
        const oppLead = isH ? (this.M.ag-this.M.hg) : (this.M.hg-this.M.ag);
        if(oppLead<3){ if(isH){ this.M.hg=0; this.M.ag=3; } else { this.M.hg=3; this.M.ag=0; } }
        this.M.forfeit={side:f.side, team:sd.team.short};
        this.syncStats(); this.M.min=Math.max(this.M.min, Math.floor(this.clock/60)); this.M.half=2; this.M.done=true;
        this.say(null, `🚫 몰수패! ${sd.team.short}의 그라운드 인원이 7명 미만 — 주심이 경기를 중단합니다. 최종 ${this.M.home.short} ${this.M.hg} : ${this.M.ag} ${this.M.away.short}`, "big", {kind:"ft"});
        try{ addNews(`🚫 <b>${sd.team.name}, 몰수패</b> — 퇴장 누적으로 경기 인원(7명)을 채우지 못했습니다. (${this.M.home.short} ${this.M.hg}-${this.M.ag} ${this.M.away.short})`, "warn", "club"); }catch(e){}
        if(sd.team.isUser){ try{ adjustTrust("owner", -10, "몰수패"); adjustTrust("fans", -8, "몰수패"); }catch(e){} }
      }
    } else if(card===CARD.YELLOW) st.yellow++;
    else st.verbal++;
    this.lastEvent={kind:"FOUL", card, side:f.side, t:this.t};
    // ── 기록 브리지: 카드는 선수 개인 기록이자 시즌 징계로 이어진다.
    //    관전용 시뮬에서는 기록하지 않는다 (recordGoal 과 같은 이유).
    if(this.M && this.emitEvents){
      const fx=this.entryOf(f);
      if(fx){
        if(card===CARD.YELLOW) fx.y=(fx.y||0)+1;
        if(card===CARD.RED){ fx.red=true; fx.off=this.M.min; }
      }
      this.syncStats();
      if(this.emitEvents){
        const nm=f.p?f.p.name:"선수";
        if(card===CARD.RED){
          this.say(f.side, F_(COMM.red,Object.assign({p:nm},refVars(this.M))), "big");
          this.cap(f.side, fs.dogso
            ? ["🟥 명백한 득점 기회 저지! {p}, 마지막 수비수의 반칙으로 퇴장입니다"]
            : COMM.lvRedLive, {p:nm});
          // 내 팀 선수가 퇴장당했다 — 경기를 멈추고 전술판으로 넘긴다.
          //   10명으로 어떻게 버틸지는 감독이 결정해야 할 문제다. 그냥 흘려보내면 안 된다.
          if(this.rec(f.side).team.isUser){
            const left=this.agents.filter(a=>a.side===f.side).length;
            this.M.needsSubPause=true; this.M.pauseEntryId=f.p?f.p.id:null;
            this.M.pauseReason=`🟥 <b>${nm}</b> 선수가 퇴장당했습니다 (${left}명 남음). 전술을 다시 짜세요.`;
          }
          if(this.rec(f.side).team.isUser && f.p && f.p.ban>0){
            this.say(f.side, `⛔ ${nm} 선수는 다음 ${f.p.ban}경기 출장정지입니다.`, "warn");
          }
        }
        else if(card===CARD.YELLOW){ this.say(f.side, F_(COMM.yellow,Object.assign({p:nm},refVars(this.M))), "warn"); this.cap(f.side, COMM.lvYellowLive, {p:nm}); }
        else                        this.say(f.side, F_(COMM.foul,Object.assign({p:nm},refVars(this.M))), "txt");
      }
    }
    return card;
  }
  /* 반칙 장면을 진행시킨다. 끝나면 반칙당한 팀의 프리킥으로 재개. */
  advanceFoulScene(){
    const b=this.ball, fs=b.foulScene;
    fs.t+=SIM_DT;
    this.moveReferee();
    if(!fs.card && fs.t>=FOUL_SCENE_T*0.55) fs.card=this.handleRefereeDecision(fs);
    if(fs.t>=FOUL_SCENE_T){
      b.foulScene=null;
      if(fs.pen) this.penaltyKick(fs.restartSide);
      else       this.freeKick(fs.restartSide, fs.spot);
    }
  }
  /* 세트피스 전용 배치 — 상황에 맞게 양 팀을 재배치하고, 킥이 나갈 때까지 그 자리를 지킨다. */
  setupSetPiece(kind, side, spot){
    const mine=this.side(side), opp=this.side(this.opp(side));
    if(!mine.length || !opp.length) return;
    const dir=mine[0].dir;
    const X=v=> dir>0 ? v : 1-v;                 // 공격 방향 기준 좌표를 절대 좌표로
    const near = spot && spot.y<0.5 ? -1 : 1;
    for(const a of this.agents){ a._spSpot=null; a._inWall=false; }
    // 스팟마다 "지금 가장 가까운 선수"를 배정한다. 아무나 배정하면 반대편 선수가 피치를 가로질러야 한다.
    const assign=(list, spots)=>{
      const pool=list.slice();
      for(const sp2 of spots){
        if(!pool.length) break;
        let bi=0, bd=1e9;
        for(let i=0;i<pool.length;i++){
          const d=HYP((pool[i].x-sp2.x)*PITCH_AR, pool[i].y-sp2.y);
          if(d<bd){ bd=d; bi=i; }
        }
        pool[bi]._spSpot={x:clamp01(sp2.x), y:clamp01(sp2.y)};
        pool[bi]._spHeld=pool[bi]._spSpot;      // 검증용 기록 — 킥 후에도 남는다
        pool.splice(bi,1);
      }
    };
    if(kind==="corner"){
      // 공격팀은 박스 안으로 몰려들고, 수비팀은 그 앞을 막아선다
      const kid=this.ball.setPiece?this.ball.setPiece.kickerId:null;
      const atk=[[0.895,0.42],[0.895,0.58],[0.855,0.47],[0.855,0.53],[0.925,0.50],[0.79,0.50]];
      /* 8자리 — 외야 수비수 전원(GK 제외 최대 10명 중 dBig 2명 선배정 + 8)이 자리를 받아야
         남는 선수가 일반 AI로 코너 플래그 근처를 어슬렁거리지 않는다 (제보) */
      const def=[[0.955,0.46],[0.955,0.54],[0.915,0.44],[0.915,0.56],[0.875,0.50],[0.955,0.50],
                 [0.80,0.40],[0.80,0.60]];
      /* ⚠ 제보 확인 — 코너킥 배치를 "공에서 가까운 순"으로만 하니 수비수는 늘 자기 진영에 남아
         박스에 못 들어갔다(실측: 3경기 헤더 13회 중 수비수 0회). 실제 축구에서는 코너 때
         센터백이 올라와 머리로 해결하는 장면이 자주 나온다.
         제공권이 가장 좋은 두 명(대개 센터백)을 먼저 골문 앞에 박아 두고, 나머지를 거리순으로 채운다. */
      const pool=mine.filter(a=>a.slot!=="GK" && a.id!==kid);
      const byAir=(arr)=>[...arr].sort((x,y)=>
        ((y.headSkill||0.6)*2 + ((y.body&&y.body.tall)||0)) -
        ((x.headSkill||0.6)*2 + ((x.body&&x.body.tall)||0)));
      /* ⚡ 코너킥 배치 — 실제 축구 그대로.
           · 센터백은 올라가 박스 안에서 머리로 해결한다 (헤더골의 30~40%가 수비수 몫)
           · 풀백·윙백은 뒤에 남아 역습을 대비한다 — 하프라인과 박스 바깥에 커버 위치를 잡는다
         전술 성향에 따라 남는 인원이 달라진다: 수비적이거나 역습을 켜 둔 팀은 두 명,
         공격적인 팀은 한 명만 남기고 더 올린다. */
      const isFB=(a)=>{ const s=(a.p&&(a.p.prefPos||a.p.pos))||a.slot||"";
                        return s==="LB"||s==="RB"||s==="LWB"||s==="RWB"; };
      const isCB=(a)=>{ const s=(a.p&&(a.p.prefPos||a.p.pos))||a.slot||"";
                        return s==="CB"||s==="DC"||s==="SW"||(a.p&&a.p.pos==="DF"&&!isFB(a)); };
      const TT=TAC(mine[0]&&mine[0].team);
      const cautious = (TT.mentality||2)<=1 || (TT.line||2)<=1 || ctrLv(TT)>=3;
      const stayN = cautious ? 2 : 1;                      // 뒤에 남길 인원
      /* 남길 선수 — 풀백 우선, 없으면 제공권이 가장 나쁜 미드필더 */
      const stayCand=[...pool.filter(isFB), ...byAir(pool.filter(a=>!isFB(a) && !isCB(a))).reverse()];
      const stay=[];
      for(const a of stayCand){ if(stay.length>=stayN) break; if(!stay.includes(a)) stay.push(a); }
      /* 커버 위치 — 하프라인 부근과 박스 바깥 (역습이 시작되는 길목) */
      const cover=[[0.52,0.38],[0.62,0.62]];
      stay.forEach((a,i)=>{ const c=cover[i]||cover[0];
        a._spSpot=a._spHeld={x:clamp01(X(c[0])), y:c[1]}; });
      /* 박스로 올라갈 선수 — 센터백 2명을 먼저 확정하고 나머지 한 자리를 채운다 */
      const up=pool.filter(a=>!stay.includes(a));
      const cbs=byAir(up.filter(isCB)).slice(0, 2);
      const others=byAir(up.filter(a=>!cbs.includes(a))).slice(0, 1);
      const big=[...cbs, ...others].slice(0, 3);
      const prime=[[0.895,0.44],[0.895,0.56],[0.870,0.50]];   // 골문 앞 — 가장 좋은 자리
      big.forEach((a,i)=>{ if(prime[i]) a._spSpot=a._spHeld={x:clamp01(X(prime[i][0])), y:prime[i][1]}; });
      const rest=up.filter(a=>!big.includes(a));
      assign(rest, atk.slice(0, Math.max(0, atk.length-big.length)).map(v=>({x:X(v[0]), y:v[1]})));
      const gk=opp.find(o=>o.slot==="GK"); if(gk) gk._spSpot={x:X(0.975), y:0.50};
      /* 수비도 제공권 좋은 선수가 먼저 붙는다 — 안 그러면 코너가 무조건 골이 된다 */
      const dpool=opp.filter(o=>o.slot!=="GK");
      const dBig=[...dpool].sort((x,y)=>
        ((y.headSkill||0.6)*2 + ((y.body&&y.body.tall)||0)) -
        ((x.headSkill||0.6)*2 + ((x.body&&x.body.tall)||0))).slice(0, 2);
      dBig.forEach((a,i)=>{ const s=[[0.905,0.45],[0.905,0.55]][i];
        if(s) a._spSpot=a._spHeld={x:clamp01(X(s[0])), y:s[1]}; });
      assign(dpool.filter(o=>!dBig.includes(o)), def.slice(0, Math.max(0, def.length-dBig.length)).map(v=>({x:X(v[0]), y:v[1]})));
    } else if(kind==="goalKick"){
      // 차는 팀은 넓게 벌려 받을 자리를 만들고, 상대는 라인을 올려 압박한다
      /* ⚠ 제보 — 「풀백은 센터백과 동일 선상이거나 항상 약간 위쪽에 서는 게 정상인데,
           골킥할 때 보면 풀백이 센터백보다 아래에 위치해 있다」.
         원인 셋이 겹쳐 있었다.
           1. 예전에는 GK 뺀 10명을 통째로 assign() 에 넘겨 "가장 가까운 선수" 순으로만
              채웠다 — 역할을 전혀 안 봤다. 골킥 직전은 상대 공격이 끝난 순간이라 수비진이
              흐트러져 있고, 그 상태의 거리순 배정은 센터백을 중원 스팟(0.42~0.64)으로,
              풀백을 맨 뒤 스팟으로 보내기 일쑤였다.
              (실측 1경기 seed=1: 골킥 95회 중 58회(61%)에서 풀백 스팟이 센터백 라인보다
               뒤, 평균 23.4m. 극단: 풀백 둘 x=0.20, 센터백 라인 x=0.58 → 41.8m)
           2. 스팟 표 자체가 넓은 자리 [0.20,·] 를 중앙 자리 [0.26,·] 보다 0.06×110=6.6m
              더 깊게 팠다 — 제보와 정반대 설계.
           3. FB_BEHIND_MAX 바닥(이동 루프 10b)은 세트피스 분기가 _spSpot 으로 옮기고
              continue 하므로 골킥 동안 구조적으로 도달 불가. phase 게이트 이전 문제다.
         수정: 코너킥처럼 역할(슬롯) 기반으로 나눈다. 센터백은 x=0.24 중앙, 풀백·윙백은
         x=0.25 측면 — 센터백 라인보다 0.01×110=1.1m 앞(FB_BEHIND_MAX=-0.010 과 같은 값).
         나머지는 기존 중원·전방 스팟을 거리순으로 받는다. 그룹에서 자리를 못 받은 잉여
         (5백의 세 번째 풀백 등)는 나머지 풀로 넘긴다. */
      const gkOut=mine.filter(a=>a.slot!=="GK");
      const gkIsCB=a=>a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB"||a.slot==="SW";
      const gkIsFB=a=>a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB";
      const gkCB=gkOut.filter(gkIsCB), gkFB=gkOut.filter(gkIsFB);
      const cbSpots=[[0.24,0.38],[0.24,0.62],[0.24,0.50]].slice(0, gkCB.length);
      const fbSpots=[[0.25,0.16],[0.25,0.84]].slice(0, gkFB.length);
      assign(gkCB, cbSpots.map(v=>({x:X(v[0]), y:v[1]})));
      assign(gkFB, fbSpots.map(v=>({x:X(v[0]), y:v[1]})));
      const gkRest=gkOut.filter(a=>!a._spSpot);          // 미드·공격 + 자리 못 받은 잉여 수비
      assign(gkRest,
        [[0.42,0.28],[0.42,0.72],[0.46,0.50],[0.58,0.34],[0.58,0.66],[0.64,0.50],
         [0.30,0.50],[0.34,0.22],[0.34,0.78],[0.50,0.40]].map(v=>({x:X(v[0]), y:v[1]})));
      assign(opp.filter(o=>o.slot!=="GK"),
        [[0.62,0.30],[0.62,0.70],[0.55,0.44],[0.55,0.56],[0.46,0.22],[0.46,0.78],
         [0.40,0.50],[0.34,0.36],[0.34,0.64],[0.28,0.50]].map(v=>({x:X(v[0]), y:v[1]})));
    } else if(kind==="throwIn"){
      // 던질 팀은 가까이 붙어 받을 각을 만들고, 상대는 그 선수들을 따라붙는다
      const kid2=this.ball.setPiece?this.ball.setPiece.kickerId:null;
      assign(mine.filter(a=>a.slot!=="GK" && a.id!==kid2),
        [[0.03,0.10],[-0.04,0.13],[0.08,0.20],[0.00,0.24]]
          .map(o=>({x:clamp01(spot.x+o[0]*dir), y:clamp01(spot.y - near*o[1])})));
    } else if(kind==="penalty"){
      // 키커와 골키퍼만 남고, 나머지 20명은 전부 박스 밖 + 마크에서 9.15m 뒤로 물러난다.
      // 양 팀이 아크 주변에 섞여 서서 리바운드를 노리는 그림이다.
      const kid3=this.ball.setPiece?this.ball.setPiece.kickerId:null;
      const gk=opp.find(o=>o.slot==="GK");
      if(gk) gk._spSpot=gk._spHeld={x:X(0.995), y:0.5};        // 골라인 위, 골문 한가운데
      // 우리 팀 골키퍼도 하프라인 쪽으로 물러나 지켜본다
      const myGk=mine.find(a=>a.slot==="GK");
      if(myGk) myGk._spSpot=myGk._spHeld={x:X(0.22), y:0.5};
      // 두 팀을 번갈아 배치 — 한 팀이 아크 한쪽을 독차지하지 않도록
      const atkList=mine.filter(a=>a.slot!=="GK" && a.id!==kid3);
      const defList=opp.filter(o=>o.slot!=="GK");
      const mix=[];
      for(let i=0;i<Math.max(atkList.length, defList.length);i++){
        if(atkList[i]) mix.push([atkList[i], PEN_WAIT[i*2]]);
        if(defList[i]) mix.push([defList[i], PEN_WAIT[i*2+1]]);
      }
      for(const [a, w] of mix){ if(!w) continue; a._spSpot=a._spHeld={x:clamp01(X(w[0])), y:clamp01(w[1])}; }
    } else if(kind==="freeKick"){
      this.setupFreeKick(mine, opp, dir, spot, X, assign);
    }
  }
  /* 프리킥 배치 — 슈팅 사거리면 벽을 세우고, 멀면 그냥 전개 대형을 잡는다.
     벽은 "공에서 골문 중앙을 잇는 선" 위 9.15m 지점에 서고, 니어포스트 쪽으로 조금 밀어 세운다.
     그래야 키퍼가 파포스트 쪽만 지키면 되는, 실제 축구의 역할 분담이 나온다. */
  setupFreeKick(mine, opp, dir, spot, X, assign){
    const kid=this.ball.setPiece?this.ball.setPiece.kickerId:null;
    const gx=X(1.0);                                        // 상대 골문 x
    // 공 → 골문 중앙 벡터 (미터)
    const vx=(gx-spot.x)*PITCH_LEN_M, vy=(0.5-spot.y)*ISO_TO_M;
    const distM=HYP(vx, vy);
    const M2X=m=>m/PITCH_LEN_M, M2Y=m=>m/ISO_TO_M;          // 미터 → 정규화 좌표
    const gk=opp.find(o=>o.slot==="GK");
    const atk=mine.filter(a=>a.slot!=="GK" && a.id!==kid);
    let def=opp.filter(o=>o.slot!=="GK");
    if(distM>WALL_MAX_M || distM<1e-6){
      // 사거리 밖 — 벽은 없다. 차는 팀은 넓게 벌리고, 수비는 라인을 유지한다.
      const adv=dir>0?spot.x:1-spot.x;
      assign(atk, [[adv+0.10,0.18],[adv+0.10,0.82],[adv+0.06,0.36],[adv+0.06,0.64],
                   [adv+0.14,0.50],[adv-0.04,0.30],[adv-0.04,0.70],[adv+0.02,0.50],
                   [adv+0.18,0.40],[adv+0.18,0.60]].map(v=>({x:X(clamp(v[0],0.05,0.95)), y:v[1]})));
      assign(def, [[adv+0.16,0.32],[adv+0.16,0.68],[adv+0.20,0.44],[adv+0.20,0.56],
                   [adv+0.12,0.22],[adv+0.12,0.78],[adv+0.26,0.50],[adv+0.30,0.38],
                   [adv+0.30,0.62],[adv+0.24,0.50]].map(v=>({x:X(clamp(v[0],0.05,0.95)), y:v[1]})));
      return;
    }
    // ── 벽 인원: 정면에서 가까울수록 많이 세운다 (실제로도 2~5명)
    const ux=vx/distM, uy=vy/distM;                          // 골문 방향 단위벡터
    const central=1-clamp(Math.abs(spot.y-0.5)/0.34, 0, 1);  // 1=정면, 0=완전 측면
    let n=Math.round(2 + central*2 + clamp((26-distM)/14, 0, 1)*1.2);
    n=clamp(n, 2, 5);
    // 벽은 공에서 9.15m 떨어진 지점 — 규칙 그대로다
    const wcx=spot.x + M2X(ux*SP_KEEPOUT_M), wcy=spot.y + M2Y(uy*SP_KEEPOUT_M);
    // 골문 방향에 수직인 방향. 니어포스트(공에 가까운 골포스트) 쪽으로 벽을 민다.
    const px=-uy, py=ux;
    const nearSide=(spot.y<0.5) ? -1 : 1;                    // 공이 있는 쪽이 니어포스트
    const shift=(py*nearSide>0 ? 1 : -1)*WALL_SHIFT_M;
    const wall=[];
    for(let i=0;i<n;i++){
      const off=(i-(n-1)/2)*WALL_GAP_M + shift;
      wall.push({x:clamp01(wcx + M2X(px*off)), y:clamp01(wcy + M2Y(py*off))});
    }
    // 벽에는 키 크고 용감한 선수를 세운다 (점프력·대담성)
    def.sort((a,b)=> ((b.jump||0.6)+(b.bravery||0.6)) - ((a.jump||0.6)+(a.bravery||0.6)) );
    const wallMen=def.slice(0, n), rest=def.slice(n);
    for(let i=0;i<wallMen.length;i++){ wallMen[i]._spSpot=wallMen[i]._spHeld=wall[i]; wallMen[i]._inWall=true; }
    // 골키퍼는 벽이 가리지 않는 쪽(파포스트)에 선다
    if(gk) gk._spSpot=gk._spHeld={x:X(0.985), y:clamp01(0.5 - nearSide*0.030)};
    // 공격팀: 한 명은 공 옆에 붙어 페이크를 걸고, 나머지는 박스 안으로 들어간다
    const sAdv=dir>0?spot.x:1-spot.x;
    const atkSpots=[[sAdv, spot.y<0.5?spot.y+0.035:spot.y-0.035],
                 [0.885,0.40],[0.885,0.60],[0.905,0.50],[0.860,0.34],[0.860,0.66],
                 [0.845,0.50],[0.79,0.44],[0.79,0.56],[0.74,0.50]];
    assign(atk, atkSpots.map((v,i)=>({x:X(v[0]), y: i===0 ? clamp01(v[1]) : v[1]})));
    /* 🧷 박스 프리킥 맨마킹 (세트피스 수비 계측) — 공격자 첫 접촉 33~75%, 그 순간 최근접 수비수
       중앙값 3.3~6.6m(2m 이상 자유 50~78%). 벽 제외 수비가 고정 라인 스팟에만 서서 아무도
       사람을 안 잡았다. 박스 안 공격 스팟마다 골사이드 마커를 먼저 채우고, 남는 인원이 라인을 만든다. */
    const sAdv0=dir>0?spot.x:1-spot.x;
    const lineAdv=clamp(Math.max(sAdv0 + M2X(SP_KEEPOUT_M*1.15), 0.90), 0.60, 0.945);
    const gx2=X(1.0);
    const markers=atkSpots.slice(1, 1+Math.min(6, Math.max(0, atk.length-1)))
      .filter(v=>v[0]>0.82)
      .map(v=>{ const ax=X(v[0]); return {x:clamp01(ax+(gx2-ax)*0.14), y:clamp01(v[1]+(0.5-v[1])*0.10)}; });
    assign(rest, [...markers,
                  [[lineAdv,0.34],[lineAdv,0.66],[lineAdv-0.02,0.28],[lineAdv-0.02,0.72],
                   [lineAdv,0.50],[lineAdv-0.03,0.50]].map(v=>({x:X(v[0]), y:v[1]}))].flat()
      .slice(0, Math.max(rest.length, 0)));
  }
  /* 볼 가진 선수에게 수비수가 붙으면 태클 경합 */
  /* 태클 — 서서 하는 태클과 슬라이딩을 구분한다.
     슬라이딩은 더 멀리 닿고 성공률도 높지만, 한 번 나가면 성공하든 실패하든 잠시 넘어져 있고
     파울 위험이 훨씬 크다. 그래서 "닿지 않는 거리" 또는 "위험 지역 + 거친 수비" 일 때만 나간다. */
  tryTackle(carrier){
    /* 🧤 ⚠ 제보 — 「키퍼가 공을 잡고 놓고 차려는 사이에 공격수가 기습해 골을 넣는다」.
       실제 규칙상 골키퍼가 공을 통제하고 있으면 상대는 도전할 수 없다(방해하면 간접 프리킥).
       공을 손에 넣은 뒤 놓고 차기까지의 그 몇 초가 그대로 뚫리고 있었다. */
    if(carrier.slot==="GK" && inBox(carrier, -carrier.dir)) return false;   // 자기 박스 = 반대 방향
    const oKey=this.opp(carrier.side);
    const T=TAC(this.side(oKey)[0].team);
    const st=this.stats[oKey];
    // 자기 페널티 박스 안에서는 수비수가 발을 뻗지 않는다 — 잡아 세우고 몰아낼 뿐이다.
    // 여기서 파울을 하면 곧바로 페널티킥이기 때문이다. 이 조심성이 없으면 경기당 PK가 4번씩 나온다.
    const inOwnBox=inBox(carrier, carrier.dir);
    const boxCare=inOwnBox ? PEN_BOX_CAUTION : 1;
    for(const o of this.side(oKey)){
      if(o.slot==="GK") continue;
      if(o._down && o._down>this.t) continue;                 // 아직 못 일어남
      if(o._beaten && o._beaten>this.t) continue;             // 방금 제쳐져 역동작에 걸렸다
      const d=HYP((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
      /* 🌧️ 젖은 잔디에서는 슬라이딩이 더 멀리 미끄러져 닿는다 (요청) */
      if(d>SLIDE_RANGE*(1+(WX_NOW.wet||0)*0.28)) continue;
      // 제쳐지는 순간의 파울 — 태클도 못 들어가고 속도로도 밀리면 잡아채거나 몸으로 막는다.
      // 실제 경기 파울의 절반쯤은 이 "어쩔 수 없어서" 하는 파울이다.
      const behind = (carrier.dir>0 ? o.x<carrier.x : o.x>carrier.x);
      const booked = (o.yellows||0)>0 ? BOOKED_CAUTION : 1;   // 경고 받은 선수는 몸을 사린다
      /* §14 잡아당기기 — 박스 안의 짧은 잡기는 대부분 흘려보낸다(실제 심판도 그렇다).
         ⚠ 이 경로가 PK 의 주범이었다(45분 3~5개). 지속적·명백한 방해만 박스 안에서 잡는다. */
      const holdBoxK = inBox(carrier, carrier.dir) ? 0.18 : 1;
      if(behind && d<TACKLE_RANGE*1.5 && Math.random()<SHIRT_FOUL_P*holdBoxK*meTune("foul")*booked*boxCare*(0.6+T.tackle*0.4)/TEMPO){
        st.foul++; this.stats[carrier.side].freeKick++; if(typeof FOUL_LOG!=="undefined"&&FOUL_LOG)FOUL_LOG["shirt"]=(FOUL_LOG["shirt"]||0)+1;
        this.startFoulScene(o, carrier, false, (o.dir>0?o.x:1-o.x)<0.34);
        return true;
      }
      const inStand = d<=TACKLE_RANGE;
      // 우리 골문에 가까울수록 위험 지역 — 마지막 수단으로 슬라이딩이 나온다
      const danger = (o.dir>0 ? o.x : 1-o.x) < 0.34;
      const bookedS = (o.yellows||0)>0 ? BOOKED_CAUTION : 1;
      // 대인마크 능력치가 좋으면 더 자주 붙어서 끊을 기회를 만든다
      // 특성 "상대 선수를 단단히 마크" — 더 자주 붙어서 끊는다
      /* 거친 압박(aggPress) — 압박형 포워드의 정체성인데 여태 엔진 어디서도 읽지 않았다.
         "더 자주 달려들고, 더 자주 발을 뻗고, 그만큼 파울도 는다"로 배선한다.
         압박은 위치를 잡는 게 아니라 몸을 부딪히는 행위이므로 태클 쪽이 맞는 자리다. */
      const aggr = clamp(FX(o,"aggPress"), 0, 1.5);
      const markEdge = (0.84 + (o.markSkill||0.6)*0.30)*(1 + clamp(FX(o,"tightMark"),-1,1)*0.30)*(1+aggr*0.34);
      const TD=o.tr||{};
      // 특성: 슬라이딩 태클 선호 / 하지 않음
      const slideP = clamp(0.35*(1+FX(o,"slide")+aggr*0.45), 0.05, 0.85);
      // 특성이 있으면 위험 지역이 아니어도 발을 뻗는다 (반대로 "하지 않음"이면 거의 안 한다)
      const slide = !inStand || (T.tackle>=2 && danger && Math.random()<slideP*bookedS)
                             || ((TD.slide||0)>0 && Math.random()<0.30*(TD.slide||0)*bookedS);
      if(!inStand && !slide) continue;
      // 실제 축구는 경기당 태클이 30~40회다. 매 스텝 미세 경합을 전부 시도로 세면 수백 회가 되므로
      // 시도 자체를 드물게 만든다(붙어 있어도 대부분은 그냥 견제만 하는 상태).
      /* ⚠ 시계 1:1 복귀 때 이 값을 절반으로 내렸다(0.006/0.009 → 0.003/0.0045).
         파울·코너에는 그게 맞았지만 <b>태클에는 틀렸다</b> — 파울은 축약판에서 이미
         실축 수준(21회)이라 총량을 지켜야 했지만, 태클은 그때도 <b>16.7회로 실축(30~40)의
         절반</b>이었다. 총량을 지킬 값이 아니라 올려야 할 값이었는데 같이 깎았다.
         되돌린다. 태클이 늘면 파울도 늘지만, 지금 파울은 90분 환산 18.3 회로
         실축(22)보다 낮아 여유가 있다. 그리고 실축에서 파울의 주된 출처는
         공중볼이 아니라 <b>태클</b>이다 — 구성이 제자리를 찾는 쪽이다. */
      /* 🎚️ ⚠ 제보 — 「압박이 좀 너무 적극적인 느낌」. 실측: 압박 0 팀의 태클 20·파울 16이
         압박 4 팀(23·23)과 거의 같았다 — 시도율이 태클 강도만 보고 압박 지시를 안 읽었다.
         압박을 내리면 덜 달려들고(견제 위주), DELAY(지연) 목적자는 발을 아낀다. 보통(1.0)은 그대로. */
      const _prK=(0.72+((T.press!=null?T.press:1))*0.28) * ((o._pressPurpose===PRESS_PURPOSE.DELAY)?0.55:1);
      /* ⚠⚠ 위 문단의 「되돌린다」 판단은 <b>단위를 틀린 것</b>이었다.
         「태클 16.7회 vs 실축 30~40」에서 16.7 은 <b>팀당</b>, 30~40 은 <b>경기 합계</b>였다.
         팀당 16.7 = 경기 33 이므로 그때 이미 실축과 맞았는데, 두 배로 올려 경기 54 회
         (팀당 27) 가 됐다. 실축 Opta 팀당 태클은 15~19 회다. 다시 내린다. */
      if(Math.random() > (slide?0.0030:0.0045)*markEdge/(TEMPO*1.5)*(0.8+T.tackle*0.2)*_prK) continue;   /* 0.0037/0.0056 → 태클 40.1. 실축 32 */
      const atk=o.tackleSkill*(0.75+T.tackle*0.18)*(slide?1.28:1.0);   // 슬라이딩이 성공률은 더 높다
      // 퍼스트 터치가 나쁘면 압박에서 볼이 발에서 튄다 — 태클을 버티는 힘도 떨어진다
      /* ⚠ 되돌림(20260913-2500 실측) — 태클 성공률을 낮추려고 keep 을 1.25→1.89 로 올렸더니
         ① 성공률은 그대로였고(74.3%) ② 캐리어가 안 뺏기니 공격이 길어져 <b>슛 24.9→29.2</b>,
         중거리슛 12.1→15.3, 크로스 37.6→43.5 로 되레 부풀었다.
         계산도 틀렸다 — 이미 keep(≈0.75) > atk(≈0.56) 이라 P=1-keep/(2·atk) 이 성립하지 않고,
         집계되는 tackleWon 에는 이 대결 말고 <b>다른 출처</b>도 섞여 있다(61947).
         태클 성공률은 여기서 만질 수 있는 손잡이가 아니다. 원복한다. */
      const keep=carrier.dribSkill*1.25*(0.72+(carrier.firstTouch||0.6)*0.46);
      /* 🧤 박스 안에서 공을 다루는 키퍼 — 손에 든 공은 뺏을 수 없다 (실제 규칙).
         박스 밖 발밑 공은 여전히 태클 대상이다. */
      if(carrier.slot==="GK"){
        const gAdv=carrier.dir>0?carrier.x:1-carrier.x;
        if(gAdv<BOX_X && Math.abs(carrier.y-0.5)<(BOX_Y1-BOX_Y0)/2+0.01) continue;
      }
      /* 수신 직후 0.8초 — 몸으로 가리는 시간. 첫터치 순간마다 뺏기지 않게 */
      const fresh=(this.ball._ftAt!==undefined && this.t-this.ball._ftAt<0.8) ? 1.18 : 1.0;
      const won = atk*Math.random() > keep*fresh*Math.random();
      this.evl("TACKLE", o, {won:won?1:0, vic:carrier.id, vicNm:this.nm(carrier), slide:slide?1:0});
      /* 🤜 태클 — 발이 들어가는 순간 둘 다 흔들린다. 슬라이딩이 더 거칠다 (요청) */
      try{ this.jitter([o, carrier], slide?1.35:0.95); }catch(e){}
      st.tackle++; if(slide){ st.slide++; o._down=this.t+SLIDE_COMMIT*(won?0.55:1.0); }
      if(won){
        /* §11 공을 뺏음 + 위험 접촉 — 성공했지만 파울일 수 있다 */
        const evW=this.foulEvidence(o, carrier, slide);
        /* 🦵 따냈어도 파울일 수 있다 — 별도의 자(evW.won)로 굴린다 (foulEvidence 주석) */
        if(Math.random() < evW.won*TACKLE_WON_FOUL*meTune("foul")*bookedS*boxCare){
          /* ⚠ 여기 st.tackle++ 이 하나 더 있었다 — 위에서 시도할 때 이미 셌는데
             「뺏었지만 파울」인 경로에서 <b>같은 태클을 두 번</b> 셌다.
             드문 경로라 총량은 크게 안 틀렸지만, 태클 수를 실축과 견주는 자리라
             부풀려진 값으로 판단하면 안 된다. */
          st.foul++; if(typeof FOUL_LOG!=="undefined"&&FOUL_LOG)FOUL_LOG["tackleWon"]=(FOUL_LOG["tackleWon"]||0)+1;
          this.stats[carrier.side].freeKick++;
          this.cap(o.side, COMM.lvFoulLive, {p:this.nm(o)});
          this.startFoulScene(o, carrier, slide, danger, evW);
          return true;
        }
        st.tackleWon++; if(slide) st.slideWon++;
        this.cap(o.side, slide?COMM.lvSlide:COMM.lvTackle, {p:this.nm(o)});
        this.stats[carrier.side].lost++;
        // 슬라이딩은 소유하기보다 걷어내는 경우가 많다
        if(slide && Math.random()<0.40) this.looseBall(carrier);
        else this.giveTo(o);
        return true;
      }
      /* ⚖️ 실패한 태클 — 랜덤이 아니라 「그 순간의 물리」가 파울을 정한다 (§5~11).
         ⚠ 예전: Math.random()<0.52 — 공을 정확히 노렸든 늦게 들어갔든 같은 확률이었다.
         공을 노린 정상 시도는 접촉이 있어도 넘어가고(§4·§6), 공이 지나간 뒤 사람만
         맞춘 태클은 능력·랜덤과 무관하게 잡힌다(§7·§43). 거친 전술·다혈질은 증거에 가산. */
      {
        const ev=this.foulEvidence(o, carrier, slide);
        /* 박스 안에서는 수비수가 몸을 사린다(boxCare) — 옛 경로의 신중함을 증거에 반영.
           ⚠ 빠뜨렸더니 PK 가 45분에 5개 나왔다. 명백 구간(≥0.70)은 여전히 깎이지 않게 상한. */
        const careK=(boxCare<1)?(1-boxCare)*0.30:0;
        ev.score=clamp(ev.score + (T.tackle-1)*0.05 + aggr*0.06 + (bookedS<1?-0.04:0)
                       - Math.min(careK, ev.score>=0.78?0:careK), 0, 1);
        if(this.refereeFoulCall(ev)){
          /* §37~40 어드밴티지 — 파울인데 피해자가 공을 지켰고 앞이 열려 있으면
             즉시 휘슬을 불지 않는다. 2.8초 안에 이점이 사라지면 원래 파울로 되돌아온다.
             단 심각한 파울(≥0.82)은 카드가 우선이라 바로 분다. */
          if(ev.score<0.82 && this.ball.ownerId===carrier.id){
            let ahead=9;
            for(const q of this.side(o.side)){
              if(q.slot==="GK") continue;
              if((q.x-carrier.x)*carrier.dir<0.005) continue;
              const dd=HYP((q.x-carrier.x)*PITCH_AR, q.y-carrier.y);
              if(dd<ahead) ahead=dd;
            }
            const advAdv=(carrier.dir>0?carrier.x:1-carrier.x);
            if(ahead>0.075 && advAdv>0.40 && !this._adv){
              this._adv={until:this.t+2.8, side:carrier.side,
                         foulerId:o.id, victimId:carrier.id, slide, danger,
                         ev, spot:{x:carrier.x, y:carrier.y}};
              this.cap(carrier.side, ["👐 어드밴티지 — 심판이 손을 뻗어 플레이를 잇게 합니다"], {});
              return false;                          // 휘슬 없이 계속
            }
          }
          st.foul++; if(typeof FOUL_LOG!=="undefined"&&FOUL_LOG)FOUL_LOG["tackleLost"]=(FOUL_LOG["tackleLost"]||0)+1;
          this.stats[carrier.side].freeKick++;
          this.cap(o.side, COMM.lvFoulLive, {p:this.nm(o)});
          this.startFoulScene(o, carrier, slide, danger, ev);
          if(Math.random() < INJ_TACKLE_P*(slide?1:0.35)*(0.5+ev.score)) this.hurt(carrier, slide, slide?"slide":"tackle");
          return true;
        }
        /* 정상 플레이 — 접촉은 있었지만 파울이 아니다. 볼이 흐르며 플레이 계속 (§17) */
        if(ev.ballPlay>0.5 && Math.random()<0.30){ this.looseBall(carrier, 0.15); return true; }
      }
    }
    return false;
  }
  /* 세트피스 세리머니를 한 단계씩 진행시킨다.
     PLACE(공을 놓으러 간다) → BACKOFF(뒤로 물러난다) → APPROACH(달려온다) → 킥.
     공은 그동안 스팟에 가만히 놓여 있고, 키커만 움직인다. */
  advanceSetPiece(){
    const b=this.ball, sp=b.setPiece;
    let kicker=this.byId(sp.kickerId);
    /* ⚠ 제보(투명 키커) — byId 로 찾히더라도 엔트리상 이미 나간 선수면 화면에 그려지지 않는다.
       그런 유령은 「없는 것」으로 보고 아래 재지정 로직을 태운다. */
    if(kicker && !this.onField(kicker)) kicker=null;
    /* ⚠ 제보 — 세리머니 도중 키커가 교체·퇴장으로 빠지면 「아무도 없는데 공이 차이는」 장면이 됐다.
       세트피스를 통째로 취소하지 않고, 남아 있는 선수 중에서 키커를 다시 세운다. */
    if(!kicker){
      const side=(b.ownerId!=null && this.byIdAny(b.ownerId)) ? this.byIdAny(b.ownerId).side : this.possSide;
      const mine=this.side(side).filter(a=>a.slot!=="GK" && this.onField(a));
      if(mine.length){
        const kind = sp.kind==="penalty" ? "pk" : sp.kind==="corner" ? "ck" : "fk";
        let nk=null;
        try{ nk=this.designatedKicker(side, kind); }catch(e){}
        if(!nk){
          /* PK 는 페널티 능력, 나머지는 공에 가까운 선수 */
          if(sp.kind==="penalty"){ let bs=-1; for(const a of mine){ const v=(a.penSkill||0.5); if(v>bs){ bs=v; nk=a; } } }
          else { let bd=1e9; for(const a of mine){ const d=HYP((a.x-sp.spot.x)*PITCH_AR, a.y-sp.spot.y); if(d<bd){ bd=d; nk=a; } } }
        }
        if(nk){
          kicker=nk; sp.kickerId=nk.id; b.ownerId=nk.id;
          sp.phase="PLACE"; sp.t=0; sp.from={x:nk.x, y:nk.y};
          if(this.emitEvents) this.say(side, fixJosa(`🔁 키커가 그라운드를 떠나 <b>${this.nm(nk)}</b>이/가 대신 준비합니다.`), "txt");
        }
      }
      if(!kicker){ b.setPiece=null; b.hold=0; b.isPenalty=false; return; }
    }
    const ph=SETPIECE_PHASES[sp.kind]||SETPIECE_PHASES.freeKick;
    sp.t+=SIM_DT;
    // 공 뒤쪽(자기 골문 쪽) 지점 — 여기서 물러났다가 달려온다
    /* 🤾 ⚠ 요청 원문 — 「선수가 지금 스로인 할때 바둑알의 모습을 보면 마치 프리킥차듯
       움직이거든? 스로인을 표현하려면 제자리에서 던지거나, 약간 뒤로 물러갔다가 앞으로
       움직이면서 던지게끔 해야겠지?」
       원인: 스로인도 프리킥과 같은 「공 뒤(골문 쪽)로 물러났다 옆에서 달려든다」를 썼다.
       ─ 스로인은 터치라인에 수직이다. 라인 바깥으로 반 발 물러났다가, 라인을 향해
         똑바로 걸어 나오며 던진다. 좌우로 도는 런업이 사라진다. */
    let backX, backY;
    if(sp.kind==="throwIn"){
      const outS=(sp.spot.y<0.5) ? -1 : 1;            // 밖으로 나가는 방향
      backX=sp.spot.x;                                 // 좌우로 돌지 않는다 — 제자리
      backY=clampPy(sp.spot.y + outS*THROW_STEP);      // 라인 바깥으로 반 발
    } else {
      backX=clamp01(sp.spot.x - kicker.dir*SETPIECE_BACK);
      backY=clamp01(sp.spot.y + (sp.spot.y<0.5?0.02:-0.02));
    }
    const moveTo=(tx,ty,dur)=>{
      const k=clamp01(sp.t/Math.max(0.05,dur));
      let nx=lerp(sp.from.x, tx, k), ny=lerp(sp.from.y, ty, k);
      // 거리와 무관한 보간이라 멀리 있으면 순간이동해 버린다 — 사람이 낼 수 있는 속도로 제한한다
      const dx=(nx-kicker.x)*PITCH_AR, dy=ny-kicker.y, d=HYP(dx,dy);
      const cap=SPD.RUN*SIM_DT;                        // 🏃 세트피스 키커는 뛰어가지 않는다
      if(d>cap){ nx=kicker.x+(dx/d)*cap/PITCH_AR; ny=kicker.y+(dy/d)*cap; }
      if(d>1e-6) kicker.face=Math.atan2(dy,dx);       // 가는 방향을 바라본다
      /* 🏃 라인 밖까지 나갈 수 있다 (요청) — 스로인은 터치라인 「밖」에서 던져야 한다 */
      kicker.x=clampPx(nx); kicker.y=clampPy(ny);
    };
    if(sp.phase==="DEAD"){
      // 공을 회수하러 간다 — 공은 나간 자리에 그대로 있고, 키커가 "공이 있는 곳"으로 걸어간다.
      // 여기서 킥 지점으로 바로 가버리면, 선수가 공을 잡기도 전에 공이 혼자 움직여 버린다.
      moveTo(sp.out.x, sp.out.y, ph.dead);
      /* 🥅 골라인 뒤로 나간 공은 나간 자리 그대로 둔다 (1.020 으로 깎으면 골망 안으로 돌아간다) */
      /* ⚠ 제보(골라인 아웃 순간이동) — 예전에는 여기서 매 틱 sp.out 을 그대로 대입했다.
         공이 아직 라인 근처에 있으면 그 거리를 한 프레임에 건너뛴다. 굴려서 보낸다. */
      {
        const _tx=Math.max(-GOAL_OUT_X, Math.min(1+GOAL_OUT_X, sp.out.x));
        const _ty=Math.max(-0.020, Math.min(1.020, sp.out.y));
        const _dx=(_tx-b.x)*PITCH_AR, _dy=_ty-b.y, _d=HYP(_dx,_dy);
        const _cap=SPD.CARRY*DEAD_ROLL_MUL*SIM_DT;      // 🏃 CARRY — 죽은 공 굴림 속도는 그대로
        if(_d>_cap){ b.x+=(_dx/_d)*_cap/PITCH_AR; b.y+=(_dy/_d)*_cap; }
        else { b.x=_tx; b.y=_ty; }
        b.z=0;
      }
      /* ⚠ 공을 라인 밖(±1.2~1.4m)에 두자 선수 좌표는 [0,1] 클램프라 0.012 안으로
         영영 못 들어가 DEAD가 시간초과까지 늘어졌다(실측: 경기당 패스 -20%, 코너 정체).
         발 뻗으면 닿는 거리로 완화한다. */
      /* ⚠ 선수 좌표는 [0,1] 클램프라 라인 밖 공까지는 영영 못 간다 — 공이 나간 자리의
         「라인 위 최근접점」까지 오면 손을 뻗어 주운 것으로 본다. 골라인 뒤 공간을
         넓힌 뒤(GOAL_OUT_X) 이 판정이 없으면 DEAD 가 시간초과까지 늘어진다. */
      /* ⚠ 선수가 라인 밖으로 나갈 수 있게 된 뒤(clampPx/clampPy) 이 판정을 clamp01 로 두면,
         라인 밖까지 걸어 나온 선수가 「라인 위 기준점」에서는 오히려 멀어져 DEAD 가
         시간초과까지 늘어졌다(실측 422프레임). 선수가 실제로 갈 수 있는 지점으로 잰다. */
      const _rx=clampPx(sp.out.x), _ry=clampPy(sp.out.y);
      const got=HYP((kicker.x-_rx)*PITCH_AR, kicker.y-_ry) < 0.030;
      if((sp.t>=ph.dead && got) || sp.t>ph.dead+8){      // 공에 닿아야 다음 단계로
        sp.phase="PLACE"; sp.t=0; sp.from={x:kicker.x,y:kicker.y};
      }
      return;
    }
    if(sp.phase==="PLACE"){
      // 공을 들고(굴리며) 킥 지점까지 옮긴다 — 이제 공은 키커를 따라간다.
      moveTo(sp.spot.x, sp.spot.y, ph.place);
      b.x=clamp01(kicker.x); b.y=clampPy(kicker.y); b.z=0;   // 🤾 라인 밖에 선 스로어를 따라간다
      const arrived=HYP((kicker.x-sp.spot.x)*PITCH_AR, kicker.y-sp.spot.y)<0.010;
      if((sp.t>=ph.place && arrived) || sp.t>ph.place+8){
        b.x=clamp01(sp.spot.x); b.y=clampPy(sp.spot.y);   // 정확히 스팟에 놓는다 (스로인은 라인 밖)
        sp.phase="BACKOFF"; sp.t=0; sp.from={x:kicker.x,y:kicker.y};
      }
      return;
    }
    if(sp.phase==="BACKOFF"){
      moveTo(backX, backY, ph.backoff);
      // 주심이 벽을 세울 때까지 기다린다 — 벽이 자리를 잡기 전에 차버리면 프리킥이 아니다.
      // (아무리 늦어도 4초 뒤에는 진행한다 — 어떤 이유로든 벽이 못 서도 경기가 멈추지 않게)
      let wallSet=true;
      if(sp.kind==="freeKick"){
        for(const q of this.agents){
          if(!q._inWall || !q._spSpot) continue;
          if(HYP((q.x-q._spSpot.x)*PITCH_AR, q.y-q._spSpot.y) > 0.010){ wallSet=false; break; }
        }
      }
      if(sp.t>=ph.backoff && (wallSet || sp.t>ph.backoff+4)){ sp.phase="APPROACH"; sp.t=0; sp.from={x:kicker.x,y:kicker.y}; }
    } else {
      moveTo(sp.spot.x, sp.spot.y, ph.approach);
      const atBall=HYP((kicker.x-sp.spot.x)*PITCH_AR, kicker.y-sp.spot.y)<0.014;
      if((sp.t>=ph.approach && atBall) || sp.t>ph.approach+6){
        b.setPiece=null; b.hold=0;                         // 공 앞에 도착했다 — 여기서 실제 킥이 나간다
        // 배치 해제 → 다시 PLAYING. 단 벽은 공이 발을 떠나는 순간까지 서 있어야 한다 —
        // 여기서 곧바로 흩어지면 화면에서 "차기 직전에 벽이 사라지는" 장면이 된다.
        for(const q of this.agents){
          if(q._inWall){ q._spHold=this.t+SP_WALL_HOLD; continue; }
          q._spSpot=null; q._inWall=false; q._smx=undefined; q._smy=undefined;
        }
      }
    }
    /* 🤾 스로인은 라인 밖 스팟이다 — clampPy 로 그 자리를 지킨다 (요청) */
    b.x=clamp01(sp.spot.x); b.y=clampPy(sp.spot.y);
    /* 🤾 던지기 직전에는 공이 손에 들려 있다 — 머리 위 높이에 둔다 (예전엔 바닥에 굴렀다) */
    b.z=(sp.kind==="throwIn" && sp.phase==="APPROACH") ? THROW_HAND_Z*0.75 : 0;
  }
  /* 세트피스 시작 — 키커를 지정하고 세리머니를 건다 */
  beginSetPiece(kind, kicker, spot, outAt){
    const b=this.ball;
    this.lastAssist=null;   // 데드볼 — 마지막 패스 연결이 끊겼다 (코너·프리킥 딜리버리가 새로 세팅한다)
    /* ⚠ 제보 — PK 골이 오프사이드로 취소되는 사건. "늦게 올라가는 깃발"(pendingOff)이
       이전 공격에서 남은 채 세트피스를 넘어와, PK 득점 순간 그 깃발이 올라갔다.
       플레이가 죽고 새로 시작되면 이전 상황의 깃발은 무효다. */
    this.pendingOff=null;
    const out = outAt || {x:b.x, y:b.y};      // 공이 나가 멈춘 자리 — 여기서부터 회수한다
    /* ⚠ 라인 밖에 멈춘 공을 clamp01로 라인 위에 되돌려 놓던 범인이 여기였다(제보 2회).
       아웃된 공은 라인 밖 ~1.4m까지 그대로 둔다 — 키커가 밖에 나가 주워 온다. */
    /* ⚠ x 는 골라인 뒤 GOAL_OUT_X 까지 그대로 둔다 — 여기서 1.020 으로 깎아 버리면
       골망 안으로 되돌아가 「아웃인데 골문 안」이 다시 나온다 (제보). y 는 종전대로. */
    const clOutX=(v)=>Math.max(-GOAL_OUT_X, Math.min(1+GOAL_OUT_X, v));
    const clOut=(v)=>Math.max(-0.020, Math.min(1.020, v));
    /* 🤾 스로인 스팟은 터치라인 「밖」이다 — clamp01 로 깎으면 라인 위로 되돌아온다 (요청) */
    b.setPiece={kind, kickerId:kicker.id, spot:{x:clamp01(spot.x),y:clampPy(spot.y)},
                out:{x:clOutX(out.x), y:clOut(out.y)},
                phase:"DEAD", t:0, from:{x:kicker.x, y:kicker.y}};
    b.state="SETTLED"; b.z=0; b.vx=0; b.vy=0; b.vz=0; b.inNet=false; b.aerial=false;
    b.x=clOutX(b.x); b.y=clOut(b.y);
    b.hold=99;                        // 세리머니가 끝날 때까지 킥하지 않는다
  }
  /* 볼이 라인을 넘었는지 판정하고 알맞은 방식으로 재개한다.
       터치라인 → 스로인 (마지막에 건드린 팀의 상대)
       골라인   → 마지막 터치가 공격 팀이면 골킥, 수비 팀이면 코너킥 */
  outOfPlay(x, y, lastSide){
    if(!lastSide) lastSide=this.lastTouch||this.possSide;
    // 기준선 — 공의 중심이 라인을 완전히 넘어야 아웃 (x: 골라인, y: 터치라인)
    const EPS=0.001;
    const overX = x<-EPS ? (-x) : (x>1+EPS ? x-1 : 0);
    const overY = y<-EPS ? (-y) : (y>1+EPS ? y-1 : 0);
    if(overX<=0 && overY<=0) return false;
    // 코너 부근에서 둘 다 넘었으면 더 많이 넘은 쪽 라인으로 판정한다
    if(overY>0 && overY>=overX){
      /* 공을 터치라인 밖 1m 지점에 놓는다 — 11cm만 넘긴 지점에 두면 라인에 걸쳐 보인다(제보) */
      this.ball.x=clamp01(x); this.ball.y = y<0.5 ? -0.014 : 1.014;
      this.ball.vx=0; this.ball.vy=0; this.ball.vz=0; this.ball.z=0;
      this.throwIn(this.opp(lastSide), {x:clamp01(x), y:y<0?0:1});
      return true;
    }
    {
      const dir=this.side(lastSide)[0].dir;          // 마지막 터치 팀의 공격 방향
      const outAt = x<0 ? 0 : 1;
      const theirGoal = dir>0 ? 1 : 0;               // 그 팀이 노리는 골문
      /* ⚽ 골문 사이(포스트 안·바 아래)로 넘었으면 골이다 — 드리블·굴절로 굴러 들어간 공.
         ⚠ 여태 모든 골라인 통과를 골킥/코너로만 처리해, 공을 몰고 골문 안까지 들어가도
            노골이었다(제보). 슛만 골이 되는 세상은 없다. */
      if(outAt===theirGoal && Math.abs(y-0.5)<GOAL_HALF && (this.ball.z||0)<CROSSBAR_Z){
        /* ⚠ 하프라인 골 차단(제보) — 슛이 아닌 30m+ 롱패스·걷어내기가 골문으로 굴러 들어온 경우,
           골문을 지키는 키퍼가 서 있으면 줍는 게 정상이다. 키퍼가 쓰러져 있거나(다이빙 직후)
           멀리 나가 있을 때만 골로 인정 — 의도된 로빙 슛(kickType SHOT)은 이 게이트를 안 탄다. */
        const b2=this.ball;
        const nonShot = !b2.shot && b2.kickType!==KICK.SHOT;
        const farM = HYP(((b2.sx!=null?b2.sx:x)-x)*PITCH_AR, (b2.sy!=null?b2.sy:y)-y)*ISO_TO_M;
        if(nonShot && farM>20 && (this.ball.z||0)<CROSSBAR_Z*0.6){
          /* 낮게 굴러/깔려 오는 공만 — 키퍼 키를 넘기는 로빙은 정당한 골이다 */
          const gk=this.side(this.opp(lastSide)).find(a=>a.slot==="GK");
          if(gk && !(gk._down>this.t)){
            const gd=HYP((gk.x-x)*PITCH_AR, gk.y-y)*ISO_TO_M;
            if(gd<9.0){
              /* 키퍼를 공 자리로 끌어오면 순간이동으로 보인다 — 공을 키퍼 발 앞에 놓는다 */
              b2.x=clamp01(gk.x + (outAt===0?0.010:-0.010)); b2.y=clamp01(gk.y);
              b2.vx=0; b2.vy=0; b2.vz=0; b2.z=0; b2.aerial=false;
              this.giveTo(gk, {noTouch:true}); b2.hold=(2.2+Math.random()*1.6)*TEMPO;
              this.evl("GK_CLAIM", gk, {k:"LONGBALL"});
              if(this.emitEvents && Math.random()<0.4) this.cap(this.opp(lastSide), ["🧤 {p}, 길게 넘어온 공을 여유 있게 처리합니다"], {p:this.nm(gk)});
              return true;
            }
          }
        }
        this.rollInGoal(lastSide); return true;
      }
      /* 🥅 자책골 — 마지막으로 만진 사람이 공을 <b>자기 골문</b> 안으로 넣었다.
         ⚠ 규칙 감사에서 나온 구멍 — 여태 이 경우가 <b>상대 코너킥</b>이 됐다.
            2D 매치엔진에는 자책골이라는 개념 자체가 없었다(분 단위 엔진에는 있다).
            걷어내려던 공이 굴절되어 자기 골문으로 들어가는 장면은 실제로 나오는 일이고,
            그게 코너킥으로 처리되면 감독 눈에는 「분명히 들어갔는데」가 된다. */
      if(outAt!==theirGoal && Math.abs(y-0.5)<GOAL_HALF && (this.ball.z||0)<CROSSBAR_Z){
        /* ⚠ 문을 열자마자 <b>경기당 0.67골</b>이 자책골로 나왔다(실축 0.08). 규칙은 맞지만
           우리 공 물리에서는 「골문 폭 안으로 골라인을 넘는 공」이 실축보다 훨씬 흔하다 —
           키퍼가 쳐낸 공, 느리게 굴러 들어간 공까지 전부 골이 되어 버렸다.
           ─ 실제로 자책골이 되는 장면만 남긴다: <b>속도가 실린 공</b>(걷어내기·굴절)이고,
             <b>키퍼가 손 쓸 자리에 없을 때</b>. 나머지는 예전처럼 코너킥이다. */
        const _b=this.ball;
        const _spd=HYP((_b.vx||0)*PITCH_AR, _b.vy||0)*ISO_TO_M/SIM_DT;      // m/s
        const _gk=this.side(lastSide).find(a=>a.slot==="GK");
        const _gkd=_gk ? HYP((_gk.x-x)*PITCH_AR, _gk.y-y)*ISO_TO_M : 99;
        if(_spd>=12 && _gkd>6){    /* 8m/s·5m 로는 경기당 0.25골 — 실축(0.17)보다 잦고 총 득점을 밀어 올렸다 */
          const _og=(_b.ownerId!=null?this.byId(_b.ownerId):null)
                 || (_b._rollOwner!=null?this.byId(_b._rollOwner):null)
                 || this.side(lastSide)[0];
          this.rollInGoal(this.opp(lastSide), _og); return true;
        }
      }
      /* 🥅 골라인을 넘은 공(골이 아닌 공)은 골망 뒤·포스트 바깥에 놓는다 — placeGoalOut 주석 참고.
         (예전엔 라인 뒤 0.010 · 포스트 밖 0.020 이라 화면상 골문 안에 박힌 것처럼 보였다) */
      const outY = placeGoalOut(this.ball, outAt, y).y;
      if(outAt===theirGoal) this.goalKick(this.opp(lastSide));   // 상대 골라인 밖 → 상대 골킥
      else this.cornerKick(this.opp(lastSide), outAt, outY);     // 자기 골라인 밖 → 상대 코너킥
      return true;
    }
    return false;
  }
  /* 스로인 — 나간 지점에서 상대 팀이 던진다. 짧게 연결되고 오프사이드가 적용되지 않는다. */
  throwIn(side, at){
    const b=this.ball;
    const out={x:b.x, y:b.y};                       // 공이 나가 멈춘 자리
    /* 🤾 ⚠ 요청 — 「스로인 던지는 라인 있잖아. 거기도 양쪽으로 공간 넉넉하게 해서 선수가
       스로인 할 수 있게 해줘」. 실제 스로인은 라인 「밖」에서 던진다 — 라인 위(0.004)에
       세우면 선수 몸이 필드 안에 들어와 있는 그림이 된다. */
    const spot={x:clamp01(at.x), y: at.y<0.5? -THROW_OUT_Y : 1+THROW_OUT_Y};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false;
    let best=null,bd=1e9;
    for(const a of this.side(side)){
      if(a.slot==="GK") continue;
      const d=HYP((a.x-spot.x)*PITCH_AR, a.y-spot.y);
      if(d<bd){ bd=d; best=a; }
    }
    if(!best) best=this.side(side)[0];
    b.ownerId=best.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=true;                       // 다음 배급은 발이 아니라 손이다
    this.beginSetPiece("throwIn", best, spot, out);
    this.setupSetPiece("throwIn", side, spot);
    this.stats[side].throwIn++;
  }
  /* 골킥 — 골키퍼가 골 에어리어에서 길게 찬다 */
  goalKick(side){
    const b=this.ball;
    const mine=this.side(side), dir=mine[0].dir;
    const gk=mine.find(a=>a.slot==="GK")||mine[0];
    /* 🥅 빗나간 슛은 골라인 위에서 멈춰 있다 — 골망 뒤·포스트 바깥으로 옮겨 회수한다.
       골문 폭 안(그물 뒤)에 놓으면 골처럼 보인다 (제보) — placeGoalOut 주석 참고 */
    const _dst=placeGoalOut(b, dir>0 ? 0 : 1, b.y);
    const out={x:_dst.x, y:_dst.y};                 // 공이 굴러가 멈출 자리 — 여기서 회수한다
    const spot={x: dir>0 ? 0.06 : 0.94, y:0.5};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false;
    b.ownerId=gk.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=false; b.fromGoalKick=true; this.beginSetPiece("goalKick", gk, spot, out);
    this.setupSetPiece("goalKick", side, {x:out.x, y:out.y});   // 회수 → 놓고 → 물러났다 → 찬다
    this.stats[side].goalKick++;
  }
  /* 코너킥 — 코너 플래그에서 박스 안으로 올린다(공중볼) */
  cornerKick(side, outAt, y){
    const b=this.ball;
    /* 어떤 경로(아웃·선방 쳐내기·블록·옆그물)로 왔든 공은 골라인을 넘어 나간 것이다 —
       라인 위나 골망 언저리에 멈춰 있으면 「들어간 것」처럼 보인다(제보).
       골망 뒤·포스트 바깥으로 옮겨 회수한다 — placeGoalOut 주석 참고 */
    placeGoalOut(b, outAt, b.y);
    const out={x:b.x, y:b.y};                       // 공이 나가 멈춘 자리 — 여기서 회수한다
    const spot={x: outAt===0 ? 0.01 : 0.99, y: y<0.5 ? 0.02 : 0.98};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false;
    let best=this.designatedKicker(side, "ck");
    if(!best){
      let bd=1e9;
      for(const a of this.side(side)){
        if(a.slot==="GK") continue;
        const d=HYP((a.x-spot.x)*PITCH_AR, a.y-spot.y);
        if(d<bd){ bd=d; best=a; }
      }
    }
    if(!best) best=this.side(side)[0];
    b.ownerId=best.id; this.possSide=side; this.lastTouch=side;
    // 코너는 원칙적으로 박스 안으로 띄워 올린다. 다만 실제 경기의 1할쯤은 짧게 빼서 다시 만든다.
    b.fkIndirect=false;
    b.spPlan = Math.random()<CORNER_SHORT_P ? "short" : "corner";
    if(this.emitEvents) this.say(side, F_(COMM.corner,{t:this.rec(side).team.short}), "txt");
    this.cap(side, COMM.lvCornerLive, {t:this.rec(side).team.short});
    b.isThrow=false; this.beginSetPiece("corner", best, spot, out);
    this.setupSetPiece("corner", side, spot);
    this.stats[side].corner++;
  }
  /* 프리킥으로 재개 — 반칙(오프사이드) 지점에 볼을 놓고 해당 팀이 소유한다.
     실제 축구처럼 잠시 경기가 멈췄다가(hold) 다시 시작된다. */
  freeKick(side, at, indirect){
    const b=this.ball;
    const out={x:b.x, y:b.y};
    const spot={x:clamp01(at.x), y:clamp01(at.y)};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null;
    // 간접 프리킥 — 오프사이드 재개 등, 직접 득점이 인정되지 않는다.
    // (위 초기화 뒤에 세워야 한다 — 앞에 두면 초기화에 지워진다)
    b.fkIndirect=!!indirect;
    let best=null, bd=1e9;
    for(const a of this.side(side)){
      if(a.slot==="GK") continue;
      const d=HYP((a.x-spot.x)*PITCH_AR, a.y-spot.y);
      if(d<bd){ bd=d; best=a; }
    }
    if(!best) best=this.side(side)[0];
    const dir=this.side(side)[0].dir;
    /* 🧤 ⚠ 제보 — 「박스 안에서 공격자 반칙으로 얻은 프리킥을 짧게 연결하다 압박에 걸려 실점한다」.
       실제로는 우리 박스 안 프리킥은 골키퍼가 잡아 놓고 앞으로 길게 찬다.
       가장 가까운 필드 플레이어가 차게 두니 상대 공격수 코앞에서 짧게 빼다가 사고가 났다. */
    const ownAdv = dir>0 ? spot.x : 1-spot.x;          // 0 = 우리 골문
    const inOwnBox = ownAdv <= (1-BOX_X)+0.005 && spot.y>BOX_Y0-0.02 && spot.y<BOX_Y1+0.02;
    if(inOwnBox){
      const gk=this.side(side).find(a=>a.slot==="GK");
      if(gk) best=gk;
    }
    // 슈팅 사거리 안이면 전담 키커(프리킥 능력치)가 나선다 — 근처 아무나 차게 두면 수비수가 감아 넣는다
    const gx=dir>0?1:0;
    const distM=HYP((gx-spot.x)*PITCH_LEN_M, (0.5-spot.y)*ISO_TO_M);
    if(!inOwnBox && distM<FK_DIRECT_M){
      let bk=this.designatedKicker(side, "fk"), bs=-1;
      if(!bk) for(const a of this.side(side)){
        if(a.slot==="GK") continue;
        const s=(a.fkSkill||0.5);
        if(s>bs){ bs=s; bk=a; }
      }
      if(bk) best=bk;
    }
    b.ownerId=best.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=false;
    // ── 무엇을 할지 여기서 정해 둔다. 키커는 공 앞에 서서 이 결정을 들고 기다린다.
    //    직접 슛 / 박스로 올리기 / 짧게 연결 — 실제 팀이 프리킥 앞에서 고르는 세 가지다.
    b.spPlan=this.chooseFreeKickPlan(best, spot, distM, side, b.fkIndirect);
    b.fkDirect=(b.spPlan==="shot");
    this.beginSetPiece("freeKick", best, spot, out);   // 회수 → 놓고 → 물러났다 → 찬다
    this.setupSetPiece("freeKick", side, spot);        // 수비는 벽을 세우고, 공격은 박스로 들어간다
  }
  /* 세트피스에서 박스로 올리는 공 — 일반 크로스(evaluateCross)는 "측면에서, 달리면서"를 전제하지만
     프리킥은 정지된 공이라 중앙에서도 올릴 수 있다. 그래서 타깃 선정만 따로 한다. */
  setPieceDelivery(carrier, forceAerial){
    const dir=carrier.dir, opps=this.side(this.opp(carrier.side));
    const mates=this.side(carrier.side).filter(m=>m!==carrier && m.slot!=="GK");
    // 박스 안(또는 박스 언저리)에서 기다리는 동료
    let box=mates.filter(m=>advOf(m,dir)>BOX_X-0.02 && m.y>BOX_Y0-0.03 && m.y<BOX_Y1+0.03);
    if(!box.length) box=mates.filter(m=>advOf(m,dir)>0.72);
    if(!box.length) return null;
    // 머리가 좋고 덜 마크된 선수를 겨냥한다
    /* ⚡ 세트피스 크로스는 올라온 센터백을 노린다 — 실제 코너킥의 1순위 타깃이다.
       (제보 — PL 기준 헤더골의 30~40%가 수비수인데 우리는 0이었다) */
    const aim=m=>(m.headSkill||0.6)*1.4 + (m.jump||0.6)*0.6 - pressureOn(m,opps,1)*0.9
              + FX(m,"aerialTarget")*1.1
              + ((forceAerial && m.p && m.p.pos==="DF") ? 0.55 : 0);
    const to=box.reduce((b0,m)=> aim(m)>aim(b0)?m:b0, box[0]);
    /* 세트피스도 「공간」으로 올린다 — 다만 정지된 공이라 겨냥한 선수 쪽 공간을 고른다.
       코너킥은 코너 플래그가 골라인 위라 컷백 조건에 걸리지만, 실제로는 언제나 띄워 올린다. */
    const pos=crosserZone(carrier, dir);
    const gk=opps.find(o=>o.slot==="GK")||null;
    const zpts=crossZonePoints(carrier, dir);
    const traj = forceAerial ? CROSS_TRAJ.LOFTED
               : (advOf(carrier,dir)>0.86 ? CROSS_TRAJ.LOW : CROSS_TRAJ.LOFTED);
    let best=null;
    for(const p of zpts){
      if(traj===CROSS_TRAJ.LOFTED && p.z===CZONE.CUTBACK) continue;   // 띄우는 공은 컷백이 아니다
      /* ⚠ 제보 — 코너킥이 자꾸 박스 언저리(EDGE·골문 24m)로 갔다. 존 점수가 문전의
         수비 밀집·키퍼 리스크를 깎다 보니 한산한 바깥이 항상 이겼던 것. 코너는 문전이 목적이다. */
      if(forceAerial && p.z===CZONE.EDGE) continue;
      const c=scoreCrossZone(carrier, p, box, opps, gk, dir, traj, null);
      if(forceAerial && (p.z===CZONE.NEAR||p.z===CZONE.CENTRAL||p.z===CZONE.FAR)) c.score += 0.55;
      /* 겨냥한 선수가 그 공간을 맡을 수 있으면 값을 올린다 */
      if(c.A && c.A.m===to) c.score += 0.45;
      if(!best || c.score>best.score) best=c;
    }
    if(!best) return null;
    const dist=HYP((best.x-carrier.x)*PITCH_AR, best.y-carrier.y);
    return {type:crossTypeName(pos, best.z, traj), pos, zone:best.z, traj,
            aerial:(traj!==CROSS_TRAJ.LOW), tx:best.x, ty:best.y, dist,
            flightT:crossFlightT(dist, traj), score:1,
            to:(best.A?best.A.m:to), primary:(best.A?best.A.m:to), pick:best, boxMates:box.length};
  }
  /* 프리킥을 무엇으로 처리할지 고른다 — "shot"(직접) / "cross"(박스로) / "short"(짧게).
     실제 팀의 판단 그대로다: 각이 서고 사거리면 때리고, 옆이거나 조금 멀면 박스로 올리고,
     너무 멀거나 각이 죽었으면 짧게 연결해 다시 만들어 간다. */
  chooseFreeKickPlan(kicker, spot, distM, side, indirect){
    const dir=kicker.dir;
    const central=Math.pow(1-clamp(Math.abs(spot.y-0.5)/0.34, 0, 1), 1.5);
    const adv=dir>0?spot.x:1-spot.x;
    // 박스 안에서 머리를 댈 수 있는 동료가 몇이나 되는가 — 크로스의 가치를 정한다
    let tall=0;
    for(const m of this.side(side)){
      if(m.slot==="GK" || m.id===kicker.id) continue;
      if((m.headSkill||0.5)>0.55 || (m.jump||0.5)>0.55) tall++;
    }
    // 직접 슛 — 사거리 안 + 각이 서 있어야 한다.
    // 간접 프리킥(오프사이드 재개 등)은 규칙상 직접 득점이 안 되므로 아예 후보에서 뺀다.
    let wShot = (!indirect && distM<FK_DIRECT_M)
      ? Math.max(0, 0.02 + central*0.34 + (kicker.fkSkill||0.5)*0.34 - clamp((distM-20)/18,0,1)*0.42)
      : 0;
    // 크로스 — 골라인에 가깝고(공격 진영), 머리 댈 사람이 있어야 의미가 있다.
    //   너무 가까우면(박스 코앞) 올릴 각이 없고, 너무 멀면 그냥 전개다.
    const crossZone = clamp((adv-0.46)/0.22, 0, 1) * clamp((0.95-adv)/0.12, 0, 1);
    let wCross = crossZone * (0.30 + clamp(tall/8,0,1)*0.45 + (kicker.crossSkill||0.5)*0.35)
               * (0.55 + (1-central)*0.75);            // 옆에서 올릴수록 크로스가 자연스럽다
    // 짧게 — 안전해 보이지만 우리 진영 깊은 곳에서는 가장 위험한 선택이다.
    let wShort = 0.18 + clamp((distM-26)/22, 0, 1)*0.75 + (1-crossZone)*0.35;
    /* 🧤 길게 걷어내기 — 우리 진영 깊은 곳의 프리킥은 짧게 빼지 않고 앞으로 크게 찬다.
       ⚠ 제보 — 박스 안 프리킥을 짧게 연결하다 압박에 걸려 그대로 실점하는 장면이 잦았다.
         실축에서 자기 박스 안 프리킥을 짧게 빼는 건 아주 안전할 때뿐이고, 대부분은 길게 찬다. */
    const own = 1-adv;                                  // 1 = 우리 골문 코앞
    const inOwnBox = own >= BOX_X-0.005 && spot.y>BOX_Y0-0.02 && spot.y<BOX_Y1+0.02;
    let wClear = 0;
    if(own>0.62){
      wClear = clamp((own-0.62)/0.24, 0, 1) * 2.2;      // 우리 진영 깊을수록 급격히 커진다
      wShort *= clamp(1-(own-0.62)/0.22, 0.12, 1);      // 그만큼 짧게 빼는 선택은 줄어든다
    }
    if(inOwnBox){                                        // 박스 안이면 사실상 무조건 길게
      wClear=Math.max(wClear, 6); wShort=Math.min(wShort, 0.35); wShot=0; wCross=0;
    }
    const tot=wShot+wCross+wShort+wClear;
    let r=Math.random()*tot;
    if((r-=wShot)<0)  return "shot";
    if((r-=wCross)<0) return "cross";
    if((r-=wClear)<0) return "clear";
    return "short";
  }
  /* 페널티킥 — 박스 안 반칙. 키커와 골키퍼만 남고 나머지는 전부 박스 밖으로 물러난다. */
  penaltyKick(side){
    const b=this.ball;
    /* ⚠ 제보(투명 키커) — 키커 후보는 「지금 그라운드 위」인 선수뿐이다.
       유령이 하나도 없으면 아래 필터는 원래 목록 그대로다(정상 경기에 영향 없음). */
    this.reapGhosts();
    let mine=this.side(side).filter(a=>this.onField(a));
    if(!mine.length) mine=this.side(side);
    if(!mine.length) return;                       // 그라운드에 아무도 없다 — 킥 자체가 성립하지 않는다
    const dir=mine[0].dir;
    const out={x:b.x, y:b.y};
    const spot={x: dir>0 ? PEN_SPOT_ADV : 1-PEN_SPOT_ADV, y:0.5};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false; b.isCross=false;
    // 전담 키커 — 감독 지정이 먼저, 없으면 페널티 능력치(침착성 포함)가 가장 좋은 필드 플레이어
    let kicker=this.designatedKicker(side, "pk");
    if(!kicker){
      let bs=-1;
      for(const a of mine){
        if(a.slot==="GK") continue;
        const s=(a.penSkill||0.5);
        if(s>bs){ bs=s; kicker=a; }
      }
    }
    if(!kicker) kicker=mine[0];
    b.ownerId=kicker.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=false; b.fkDirect=false;
    b.isPenalty=true;                                  // 세리머니가 끝나면 무조건 슛이다
    this.beginSetPiece("penalty", kicker, spot, out);
    this.setupSetPiece("penalty", side, spot);
    this.stats[side].pen++;
    if(this.emitEvents) this.say(side, F_(COMM.penGiven,{t:this.rec(side).team.short}), "big", {kind:"sim_pen", side});
    this.markHighlight("pen", side, HL_W.pen);
    this.cap(side, COMM.lvPenLive, {});
  }
  /* 슛을 때린다. 블록 → 굴절 → 유효슈팅 → 키퍼 → 골 순으로 판정한다.
     각 단계는 앞 단계를 통과한 슛만 받으므로, 몸을 던진 수비수 앞에서는 유효슈팅 자체가 나오지 않고
     굴절된 슛은 키퍼가 반응할 방향을 잃는다. */
  resolveShot(shooter, g, type, opts){
    if(shooter) shooter._cbFrom=null;        // 🎯 컷백 창 종료 — 때렸다
    try{ this._pEpRelease(shooter, "shot", {distM:g&&g.distM, slot:null}); }catch(e){}   // 🎯 압박 결과
    this.evl("SHOT", shooter, {st:type, dM:Math.round(g.distM),
      pen:(opts&&opts.penalty)?1:0, fk:(opts&&opts.freeKick)?1:0});
    const b=this.ball, side=shooter.side, oKey=this.opp(side);
    const st=this.stats[side], ost=this.stats[oKey];
    const isPen=!!(opts&&opts.penalty), isFK=!!(opts&&opts.freeKick);
    st.shot++;
    this.cap(side,
      type===SHOT_TYPE.HEADER ? COMM.lvHead
      : (type===SHOT_TYPE.VOLLEY||type===SHOT_TYPE.HALF_VOLLEY)
        ? ["🦵 {p}, 떨어지는 공을 그대로 때립니다!","🦵 {p}의 다이렉트 발리!"]
      : (g.distM>22?COMM.lvShotLong:COMM.lvShot), {p:this.nm(shooter)});
    if(type===SHOT_TYPE.HEADER) st.shotHeader++;
    else if(type===SHOT_TYPE.VOLLEY) st.shotVolley++;
    else if(type===SHOT_TYPE.FINESSE) st.shotFinesse++;
    else if(type===SHOT_TYPE.CHIP) st.shotChip++;
    else if(type===SHOT_TYPE.POWER) st.shotPower++;
    else st.shotPlaced++;
    if(g.distM>20) st.shotLong++; else if(g.distM<11) st.shotClose++; else st.shotNormal++;
    this.lastTouch=side;

    const opps=this.side(oKey);
    const gk=opps.find(a=>a.slot==="GK");
    // 페널티킥은 통로에 아무도 없다 — 규칙상 전원 9.15m 뒤에 있으므로 블록 판정 자체를 하지 않는다
    const blk = isPen ? {near:0, far:0, list:[]} : shotLaneBlockers(shooter, opps, g, 2.1);   // 🧱 실행은 옆 몸까지
    /* 몸에 붙은 상대까지의 거리 — 근거리 슛에서 침착성이 얼마나 필요한지를 가른다 */
    let ctxNearOpp=9;
    for(const o of opps){ if(o.slot==="GK") continue;
      const d=HYP((o.x-shooter.x)*PITCH_AR, o.y-shooter.y);
      if(d<ctxNearOpp) ctxNearOpp=d; }
    /* 🎯 어떤 능력치로 때리는가 — FM 기준을 그대로 따른다.
         · 헤더  → 헤딩 정확도(headAim). 골 결정력은 관여하지 않는다.
         · 중거리(18m+) → 중거리 슛·기술·침착성(lngSkill). 역시 골 결정력 무관.
         · 박스 안 마무리 → 골 결정력(finSkill) */
    const isLong = !isPen && !isFK && g.distM>18;
    let skill = isPen ? (shooter.penSkill||0.6)
                : isFK ? (shooter.fkSkill||0.6)
                : type===SHOT_TYPE.HEADER ? (shooter.headAim||shooter.headSkill||0.6)
                : isLong ? (shooter.lngSkill||0.6)
                : (shooter.finSkill||0.6);
    /* 🎾 기술(tec) — 제보 원문: 「까다로운 바운드의 공을 발리슛으로 연결하거나,
       어려운 각도에서 슛의 궤적을 살리는 <b>물리적 보정치</b>」.
       ⚠ tec 은 중거리(lngSkill 0.24)와 감아차기 선택에만 있었고
          <b>박스 안 마무리에는 없었다</b>(finSkill = 결정력·침착성·천재성).
          그래서 뜬 공을 발리로 때리든 땅에 놓인 공을 밀어 넣든 같은 정확도였다.
       ─ <b>까다로운 공일 때만</b> 곱한다. 땅에 얌전히 놓인 공은 기술이 아니라 결정력의 몫이다.
          까다로움 = 공이 떠 있는 정도 + 방금 받아 첫 터치로 때리는가. */
    {
      const _b2=this.ball;
      const _awk = clamp((_b2.z||0)/0.018, 0, 1)*0.70
                 + ((_b2._ftAt!==undefined && this.t-_b2._ftAt<0.5) ? 0.30 : 0);
      if(_awk>0.02 && !isPen && !isFK){
        const _tecA=clamp(attr20(((shooter.p&&shooter.p.attr&&shooter.p.attr.tec)!=null?shooter.p.attr.tec:60))/20, 0.15, 1);
        skill *= 1 + _awk*(_tecA-0.60)*0.60;
      }
    }
    // 종류마다 세기가 다르다 — 발리·중거리는 강하게, 감아차기·로빙은 약하게 대신 정교하게
    const POW={HEADER:0.55, VOLLEY:1.28, HALF_VOLLEY:1.05, FINESSE:0.88, CHIP:0.62, POWER:1.20, PLACED:0.95};
    /* 슛 파워 — 키퍼 반응을 어렵게 만드는 부가 요소 (몸싸움·중거리 슛·기술) */
    /* 🦵 파워 축 = 근력(shotPower: str·lon·tec 합성) — 거리와 무관하게 킥의 힘은 근력이 낸다.
       ⚠ 예전에는 박스 안에서 finSkill(결정력)이 파워를 냈다 — 결정력은 정확도(acc)만 맡는다(§26). */
    const pwK = (shooter.shotPower||0.6);
    const _SCq = (this._shotCtx?this._shotCtx.quality:0.71);
    let power = ((POW[type]||0.95) + pwK*(type===SHOT_TYPE.CHIP?0.22:0.48)
                 + ((opts&&opts.freeKick&&(shooter.tr||{}).fkPower)?0.10:0))
              * (0.90 + (_SCq-0.71)*0.40);
    /* 실행 분산 (§3·§17) — 접촉이 좋을수록 일정하고, 나쁠수록 들쭉날쭉하다 */
    const _pg=()=>(Math.random()+Math.random()+Math.random()-1.5)/0.5;
    const varK = 1 + _pg()*0.05*(1.2-_SCq);
    /* 체력 (§13) — 정상 범위(55%+)에선 영향 없음, 방전 시에만 힘이 빠진다 */
    /* 지친 다리에서 나온 슛은 힘도 방향도 흔들린다 (예전 계수는 체력 55 밑에서만, 그것도 아주 약하게 걸렸다) */
    const fatK = stamK(shooter, 0.80);
    power *= varK*fatK;
    this._shotPow={base:POW[type]||0.95, pw:pwK, q:_SCq, varK, fatK, final:power,
                   ms:SHOT_SPEED*power*ISO_TO_M};

    // ── 결과를 먼저 판정한다. 공은 그 결과 지점을 향해 "날아간 뒤" 상황이 이어진다.
    let outcome=null, ex=g.gx, ey=0.5, actorId=null, deflected=false;
    // 슛의 코스를 먼저 정한다 — 골문 안 어디를 노렸는가. 마무리가 좋을수록 구석을 노린다.
    // 블록·선방 지점도 모두 이 직선 위에서 잡아야 공이 옆이나 뒤로 튀지 않는다.
    /* 🎯 지금 몸과 공이 어떤 상태인가 — 슛의 모든 단계가 이 값을 읽는다 */
    const SC=shotContext(shooter, this.ball, g, opps, this.t);
    this._shotCtx=SC;
    /* 🎯 어디를 노리는가 — 골문을 점 하나로 보지 않는다. 키퍼가 치우친 반대쪽 값이 오른다. (§17·§18) */
    const corner = Math.random() < 0.25+skill*0.45;
    /* ⚠ 예전 코너 조준(0.72~0.98)은 포스트 안쪽 10cm까지 노렸다 — 산탄 σ≈2m를 얹으면
       잘 찬 슛일수록 빗나가는 자살 조준이었다(1대1 전환율 6% 실측의 최대 지분).
       프로는 σ를 감안해 구석 「안쪽 여유」를 노린다: 0.52~0.74 (1.9~2.7m).
       정면(0~0.62)도 하한을 올려 키퍼 정면으로 차는 슛을 줄인다. */
    const aimOff = corner ? 0.52+Math.random()*0.22 : 0.18+Math.random()*0.40;
    let aimSide = (Math.random()<0.5?-1:1);
    if(gk && !isPen){
      const off=(gk.y-0.5)/GOAL_HALF;                       // 키퍼가 치우친 쪽(+1=아래)
      if(Math.abs(off)>0.18) aimSide = (Math.random() < 0.34-skill*0.22) ? Math.sign(off) : -Math.sign(off);
    }
    let aimY = 0.5 + aimSide*GOAL_HALF*aimOff;
    /* 조준 높이 — 헤더는 찍어 내리고, 로빙은 키퍼 키를 넘기고, 중거리는 낮게 깔린다 */
    let aimZ;
    if(type===SHOT_TYPE.HEADER)      aimZ=CROSSBAR_Z*(0.05+Math.random()*0.20);
    else if(type===SHOT_TYPE.CHIP)   aimZ=CROSSBAR_Z*(0.55+Math.random()*0.35);
    else if(type===SHOT_TYPE.POWER)  aimZ=CROSSBAR_Z*Math.random()*0.35;
    else if(type===SHOT_TYPE.VOLLEY) aimZ=CROSSBAR_Z*(0.15+Math.random()*0.55);
    else if(type===SHOT_TYPE.HALF_VOLLEY) aimZ=CROSSBAR_Z*(0.10+Math.random()*0.50);
    else aimZ=(Math.random()<0.30 ? CROSSBAR_Z*(0.40+Math.random()*0.50) : CROSSBAR_Z*Math.random()*0.30);
    const span=(g.gx-shooter.x)||1e-6;
    // 슛 경로 위의 한 점 — 진행률 k(0=발끝, 1=골라인)
    const onLine=(k)=>({x:shooter.x+span*clamp(k,0,1), y:shooter.y+(aimY-shooter.y)*clamp(k,0,1)});

    // 1) 블록 — 앞에 선 수비수가 몸을 던진다. 가까울수록, 통로 중앙일수록 잘 막는다.
    for(const bl of blk.list){
      if(bl.d>0.16) break;
      let pb = BLOCK_P*(1-bl.d/0.16)*(0.60+(bl.o.tackleSkill||0.6)*0.70);
      pb *= 1 - (Math.min(bl.off,BLOCK_W)/BLOCK_W)*0.50;
      if(bl.fr) pb *= 0.28*(1-(bl.off-BLOCK_W)/(BLOCK_W*1.1));   // 🧱 옆 몸 — 낮은 확률로 걸어와 각을 좁힌다
      /* ⚠ 제보 — 「1대1이 너무 안 들어간다」. 실측에서 박스 안 슛의 74%, 중거리의 84%가
         수비 몸에 맞고 끝났다(실제 축구는 25~30%). 슈터의 기술·발재간이 좋으면
         수비 다리 사이나 옆으로 각을 만들어 낸다 — 그 몫을 돌려준다. */
      {
        const _tec=(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr.tec)/20)||0.6;
        const _fla=(shooter.flair||0.6);
        pb *= clamp(0.72 - (_tec-0.60)*0.30 - (_fla-0.60)*0.16, 0.34, 0.92);
      }
      if(Math.random()<pb){
        /* §23~29 핸드볼 — 블록이 「팔 높이 + 반응할 시간이 있었는가」로 갈린다.
           지근거리 강슛은 사람이 피할 수 없으므로 핸드볼이 아니다(§26). */
        {
          const blD=HYP((bl.o.x-shooter.x)*PITCH_AR, bl.o.y-shooter.y);
          const tFly=blD/(SHOT_SPEED*Math.max(0.3,power));            // 슛 → 블로커 도달 시간
          const zHere=aimZ*clamp(blD/Math.max(1e-6,g.dist),0,1);      // 그 지점의 공 높이(근사)
          const armBand = zHere>0.009 && zHere<0.026;                 // 팔 높이 0.6~1.8m
          if(armBand && bl.o.slot!=="GK"){
            /* 의도 점수 — 반응할 시간(§26) + 팔을 벌릴 만한 측면 접촉(§25) */
            let hb = clamp((tFly-0.22)/0.45, 0, 1)*0.62
                   + clamp(bl.off/BLOCK_W, 0, 1)*0.38
                   + (Math.random()-0.5)*0.10;
            if(hb>=0.55){
              const inOwn=inBox(bl.o, -bl.o.dir);
              this.stats[bl.o.side].foul++; if(typeof FOUL_LOG!=="undefined"&&FOUL_LOG)FOUL_LOG["block"]=(FOUL_LOG["block"]||0)+1;
              this.cap(bl.o.side, ["🖐️ 핸드볼! {p}의 팔에 맞았습니다"], {p:this.nm(bl.o)});
              if(!this.foulLog) this.foulLog=[];
              this.foulLog.push({t:+this.t.toFixed(1), fouler:bl.o.id, victim:shooter.id,
                type:"HANDBALL", pen:inOwn, sev:0.45,
                ev:{score:+hb.toFixed(2), tFly:+tFly.toFixed(2), z:+(zHere*ISO_TO_M).toFixed(1)}});
              if(this.foulLog.length>40) this.foulLog.shift();
              if(inOwn){ this.penaltyKick(shooter.side); }
              else { this.freeKick(shooter.side, {x:bl.o.x, y:bl.o.y}); }
              return;
            }
          }
        }
        st.shotBlocked++; ost.block++; this.lastAssist=null;   // 수비 몸에 맞음 — 도움 무효 (규정)
        /* 🛡️ 박스 안에서 몸으로 막은 장면 — 수비 쪽에도 볼거리가 있다 (요청) */
        try{ if((g&&g.distM!=null?g.distM:99)<18) this.markHighlight("block", side, HL_W.block); }catch(e){}
        this.evl("SHOT_OUT", shooter, {k:"BLOCK", by:bl.o.id, byNm:this.nm(bl.o)});
        this.cap(oKey, COMM.lvBlock, {p:this.nm(bl.o)});
        // 골문 가까이에서 막힌 공은 상당수가 그대로 골라인을 넘어간다 → 코너킥
        if(g.distM<20 && Math.random()<BLOCK_CORNER_P){
          this.stats[shooter.side].shotBlockedOut=(this.stats[shooter.side].shotBlockedOut||0)+1;
          this.lastTouch=bl.o.side;
          this.cornerKick(shooter.side, g.gx, clamp01(bl.o.y+(Math.random()-0.5)*0.10));
          return;
        }
        outcome="BLOCK"; actorId=bl.o.id;
        // 막히는 지점도 슛 경로 위다. 수비수가 옆이나 뒤쪽에 서 있어도 공이 그리로 날아가진 않는다.
        const pt=onLine(Math.max(0.10, (bl.o.x-shooter.x)/span));
        ex=pt.x; ey=pt.y;
        break;
      }
    }
    // 2) 굴절 — 막지는 못했지만 발끝·정강이에 스쳐 궤도가 바뀐다
    /* 굴절 — 수비수 발끝에 스친다. 원래 궤도에서 크게 벗어나고,
       이미 반대로 몸을 던진 키퍼는 손을 쓸 수 없다. (§41·§42) */
    if(!outcome && blk.list.length && Math.random()<0.17){ deflected=true; ost.deflect++; }

    // 3) 유효슈팅 판정 — 각이 좁거나 멀수록, 앞이 막혀 급하게 찰수록 빗나간다
    if(!outcome){
      let acc;
      if(isPen){
        // 11m·무압박·정지된 공 — 실제로도 85% 이상이 골문 안으로 간다
        acc = PEN_ACC_BASE + skill*PEN_ACC_SKILL;
      } else {
        acc = ACC_BASE + skill*0.42 + clamp(g.angle/0.60,0,1)*0.22;
        acc -= clamp(g.distM/SHOT_MAX_M,0,1)*0.24;
        /* ⚡ 중거리 한 방 — 실측에서 중거리 슛은 30% 나오는데 중거리 골이 0이었다.
           거리 감점(유효슈팅 −0.24)과 선방 가점(+0.26)이 겹쳐 이중으로 눌렸기 때문이다.
           전체를 후하게 풀면 득점이 폭주하므로(실측 6골/경기), "중거리가 무기인 선수"에게만 돌려준다. */
        if(g.distM>18) acc += ((shooter.lngSkill||0.6)-0.55)*0.60;

        acc -= blk.near*0.05;
        /* 🧱 밀집 압박 — 통로가 비어도 3.5m 안에 몸이 여럿이면 때릴 시간과 각이 줄어든다
           (텐백 계측: 박스 수비 6명+에서도 통로 빈 슛이 그대로 들어갔다) */
        { let _cr=0; for(const o of opps){ if(o.slot==="GK") continue;
            if(HYP((o.x-shooter.x)*PITCH_AR, o.y-shooter.y)<0.050) _cr++; }
          acc -= Math.max(0, _cr-1)*0.035; }
        /* 진짜 단독 1대1 — 블로커 0 + 16m 이내 + 몸 근처 3m에 필드 수비수가 아무도 없다.
           (컷백·혼전 리바운드까지 후하게 쳐주면 득점이 폭주한다 — 실측 5.2골/경기) */
        /* 슛각 점검(요청) — 1대1 하한선과 같은 패턴: 골문이 보여야 단독 찬스다 (SHOT_1V1_ANGLE) */
        const solo = blk.list.filter(b2=>!b2.fr).length===0 && g.distM<16 && g.angle>=SHOT_1V1_ANGLE && type!==SHOT_TYPE.HEADER && type!==SHOT_TYPE.VOLLEY
          && !opps.some(o=>o.slot!=="GK" && HYP((o.x-shooter.x)*PITCH_AR,(o.y-shooter.y))<0.043);
        if(solo) acc += 0.20;
        this._soloShot=solo;
        /* 🌀 키퍼 제치기 (요청) — 슛이 아니라 「지나가기」다. 기술·민첩·침착 vs 키퍼의 일대일 방어.
           이기면 사실상 빈 골대, 지면 키퍼 발에 걸린다. 슛 한 방보다 편차가 큰 선택이다. */
        this._roundRes=0;
        if(shooter._roundGK){
          shooter._roundGK=0;
          const A2=(k)=>(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr[k])/20)||0.6;
          const dr=clamp(A2("dri")*0.44+A2("agi")*0.30+A2("cmp")*0.26, 0.1, 1.1);
          const one2=clamp((gk&&gk.oneSkill)||0.6, 0.1, 1.2);
          this._roundRes = (Math.random() < clamp(0.36+(dr-one2)*0.60, 0.10, 0.86)) ? 1 : -1;
          if(this._roundRes>0){
            acc += 0.32;
            if(this.emitEvents) this.cap(shooter.side, ["🌀 {p}, 키퍼를 제치고 지나갑니다!",
              "🌀 {p}! 골키퍼를 벗겨냈습니다!"], {p:this.nm(shooter)});
          } else {
            acc -= 0.18;
            if(this.emitEvents) this.cap(shooter.side, ["🧤 {p}, 제치려다 키퍼 발에 걸립니다",
              "🧤 {p}의 시도 — 키퍼가 먼저 몸을 던졌습니다"], {p:this.nm(shooter)});
          }
        }
        /* ⚡ 근거리(12m 이내) — FM 기준.
             · 침착성이 낮으면 홈런을 날리거나 키퍼 정면으로 찬다 (압박이 셀수록 더)
             · 순발력·민첩성은 수비수보다 먼저 닿아 몸을 틀 시간을 만든다
           (골 결정력은 skill 로 이미 들어가 있다) */
        if(g.distM<12 && type!==SHOT_TYPE.HEADER){
          const cmp=(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr.cmp)/20)||0.6;
          const pressN=clamp(blk.near*0.5 + clamp(ctxNearOpp<0.05?1:0,0,1), 0, 1.5);
          /* ⚠ 요청 — 「1대1 처리, 특히 침착성 비중 상향」. 0.16/0.14 → 0.22/0.19.
             중심(0.62)은 그대로라 침착성이 낮은 선수는 그대로 손해를 본다 — 「비중」만 커진다. */
          acc += (cmp-0.62)*(0.22 + pressN*0.19);           // 압박이 셀수록 침착성의 비중이 커진다
          acc += ((shooter.boxQuick||0.6)-0.62)*0.09;       // 순발력·민첩성 — 각을 만들 시간
        }
        /* 🎯 헤더 — 머리로 맞히는 건 발보다 어렵지만, 그 대신 대부분 골문 코앞에서 나온다.
           헤딩 정확도(headAim)가 좋은 선수는 그 어려움을 상당 부분 덮는다. */
        const ACCADJ={HEADER:+0.03, VOLLEY:-0.14, HALF_VOLLEY:-0.18, FINESSE:+0.10, CHIP:-0.04, POWER:-0.05, PLACED:+0.06};
        acc += (ACCADJ[type]||0);          // 발리는 맞히기 어렵고, 감아차기·정교한 슛은 코스가 산다
        /* ⚡ 세트피스 헤더 — 올라오는 공을 보고 타이밍을 맞춰 때리는 헤더라 코스가 훨씬 잘 산다.
           (실측 — 헤더 슛의 56%가 골문 밖으로 나가 헤더골이 아예 없었다) */
        if(type===SHOT_TYPE.HEADER){
          acc += 0.14 + ((shooter.headAim||0.6)-0.55)*0.40;
          if(this.ball._spBall) acc += 0.10;
        }
        // 직접 프리킥 — 정지된 공을 준비해서 차므로 코스는 살지만, 벽이 통로를 막고 있다
        if(isFK) acc += 0.12 - Math.max(0, blk.list.length-1)*0.03;
        /* 🎯 자세·퍼스트터치·볼 상태 — 능력치가 아니라 「그 순간」이 정확도를 가른다 (§3·§5·§21).
           기술과 침착성이 좋으면 나쁜 자세를 어느 정도 덮는다(§22·§23). */
        if(!isFK && !isPen){
          const tec=(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr.tec)/20)||0.6;
          const cmp2=(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr.cmp)/20)||0.6;
          const cover=0.30+tec*0.42+cmp2*0.28;             // 어려운 자세를 덮는 힘
          /* ⚠ 중심은 「실제로 슛을 때리는 순간의 평균 품질」에 맞춘다.
             0.52 로 두면 대부분의 슛이 가점을 받아 정확도가 통째로 올라간다(실측 결정률 30%).
             좋은 자세는 본전, 나쁜 자세는 확실히 손해 — 그게 이 항의 역할이다. */
          acc += (SC.quality-0.71)*(0.62-cover*0.26);   // 0.71 = 슛 순간 품질의 실측 평균
          acc -= clamp(SC.bodyOff/Math.PI, 0, 1)*0.18*(1-cover*0.35);   // 몸이 돌아간 만큼
        }
      }
      /* 🥅 1대1 침착 (제보: 1대1 전환율 6%) — 통로가 비고 골문이 가까우면 마무리에 여유가 있다.
         침착성이 좋을수록 크다. (blk는 등 뒤 추격자도 세므로 「완전히 깨끗한」 1대1만 받는 보정)
         ⚠ 요청 원문 — 「공격수의 1대1 처리상황을 능력치비중에서 약간 상향시켜줘도될거같은데,
            특히 침착성. 골을 약간 늘려보자구」.
            침착성 계수 0.12 → 0.19 (능력치가 결과를 가르는 폭을 넓힌다), 결정력 0.22 → 0.26.
            기본값(0.10)은 거의 그대로 둔다 — 못하는 공격수까지 같이 올라가면 「능력치 비중」이
            아니라 그냥 전체 인플레다. */
      if(!isFK && !isPen && g.distM<15 && blk.list.length===0){
        const cmp11=(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr.cmp)/20)||0.6;
        const fin11=(shooter.finSkill||0.6);
        /* 침착성과 골 결정력이 함께 작동한다 — 좋은 스트라이커일수록 이 장면을 놓치지 않는다 */
        acc += 0.11 + cmp11*0.19 + (fin11-0.60)*0.26;
      }
      if(deflected) acc += (Math.random()-0.5)*0.35;      // 굴절되면 어디로 갈지 알 수 없다
      /* 🎯 명중 여부를 동전으로 정하지 않는다 (§19·§20·§57).
         조준점에 오차를 실어 「실제 착탄점」을 만들고, 그 점이 골문 안인지 기하로 본다.
         그래서 같은 정확도라도 아슬아슬하게 빗나가거나 구석에 꽂히는 결과가 자연히 갈린다.
         오차는 균등난수가 아니라 정규분포에 가깝게 — 잘하는 선수도 가끔 빗나간다. */
      /* ⚡ 원터치는 잡고 때리는 것보다 정확도가 떨어진다 — 몸이 덜 열려 있고 시간이 없다 */
      const _otK=(opts&&opts.accK)?clamp(opts.accK,0.60,1.35):1;
      const _A=clamp(acc*_otK, 0.06, isPen?0.97:0.92);
      /* 균등난수 3개를 더하면 정규분포에 가까워진다. 표준편차가 1이 되도록 나눈다
         (⚠ /1.5 로 두면 실제 표준편차가 0.33 이라 오차가 3분의 1로 들어간다) */
      const _gs=()=>(Math.random()+Math.random()+Math.random()-1.5)/0.5;
      /* 폭 — 유효슈팅 비율이 엔진 기존 수준(약 55%)에 맞도록 잡은 값.
         좁게 두면 거의 모든 슛이 골문 안으로 가고(실측 81%), 넓으면 홈런만 나온다. */
      /* 폭 — 유효슈팅 비율을 결정한다. 엔진의 옛 기준(약 55~60%)에 맞춰져 있었는데,
         실제 축구는 35% 안팎이다. 골이 4점대에 머무는 주된 원인이라 넓힌다. */
      /* ⚠ (1.02-_A) 는 정확도가 높을수록 0에 수렴한다 — 그러면 배수를 아무리 키워도
         흩어짐이 사라져 유효슈팅이 50%에 붙는다(실측: 배수 3.15→3.80 에도 변화 없음).
         아무리 잘 찬 슛에도 최소한의 흩어짐은 남는다. */
      /* ST 침투 개편(채널·패서 인지)으로 1대1 급 기회가 늘어 결정률이 42%까지 뛰었다.
         키퍼 도달로는 안 잡힌다(4경기 비트 동일 실측) — 산탄 하한으로 잡는다. */
      /* 📐 산탄은 각도 오차다 — 절대 오차가 거리 무관 3.15m 고정이라, 7m 1대1도 16m 슛과
         같은 폭으로 튀며 전환율이 6%까지 무너졌다(실측 47회 중 3골, 제보 다수).
         거리 비례 계수: 8m에서 절반, 16m 기준 1.0, 장거리는 소폭 가중. */
      let dK=clamp(g.distM/16, 0.45, 1.15);
      /* ⚠ 상한 1.15 때문에 50m 슛이 22m 슛과 같은 폭으로 흩어졌다 — 유효슈팅률이
         35m 21% · 50m 16% 로 거의 평평했다(실측). 사람은 그렇게 못 찬다.
         24m 밖부터는 거리에 따라 산탄이 실제로 커진다. */
      if(!isPen && g.distM>25) dK *= 1 + Math.pow((g.distM-25)/13, 1.30)*0.62;
      /* 하한 0.86→0.55 — 옛 결정률 42% 억제용 하한이 acc 0.92 슈터의 11m 슛에도 σ2.2m를
         강제해 1대1이 무너졌다. 거리 스케일(dK)·키퍼 물리가 있으니 하한은 「최소한의 손맛」만. */
      /* 📐 슛각 점검(요청) — 위 주석대로 산탄은 「각도 오차」인데 골라인 y 축에 그대로 얹었다.
         비스듬한 슛은 같은 각도 오차가 골라인 위에서 1/cosφ 만큼 더 벌어진다(φ = 슛 방향과
         골라인 법선의 각): 측면 12m·전방 12m 는 1.4배, 측면 20m·전방 9m 는 2.5배.
         지금까지 측면 슛이 정면 슛만큼 정확했다. 상한 0.35(≈2.9배)로 극단을 자른다. */
      const _obl = isPen ? 1 : clamp(Math.abs((g.gx-shooter.x)*PITCH_AR)/Math.max(1e-6, g.dist), 0.35, 1);
      const sigY=Math.max(GOAL_HALF*0.55, GOAL_HALF*3.15*(1.02-_A))*dK*(isPen?0.50:1)/_obl;
      const sigZ=Math.max(CROSSBAR_Z*0.45, CROSSBAR_Z*2.05*(1.02-_A))*dK*(isPen?0.50:1);
      this._shotAim={y:aimY, z:aimZ, sy:sigY, sz:sigZ, acc:_A};
      aimY = aimY + _gs()*sigY;
      aimZ = Math.max(0, aimZ + _gs()*sigZ);
      const _inPosts=Math.abs(aimY-0.5) < GOAL_HALF;
      const _underBar=aimZ < CROSSBAR_Z;
      if(!_inPosts || !_underBar){
        st.shotOff++; this.lastAssist=null;   // 빗나간 슛 — 이후 혼전 득점에 도움 없음
        this.evl("SHOT_OUT", shooter, {k:"OFF"});
        if(isPen) st.penMiss++;
        if(this.emitEvents){
          this.say(side, F_(COMM.shotOn,{p:shooter.p.name}), "txt");
          this.say(side, F_(COMM.miss,{}), "txt");
        }
        // 빗나갔어도 가까운 거리에서 때린 결정적 장면이면 보여줄 값어치가 있다
        this.cap(side, COMM.lvMiss, {});
        if(g.distM<18) this.markHighlight("miss", side, HL_W.miss);
        else if(g.distM<30) this.markHighlight("far", side, HL_W.far);   // 아쉬운 중거리 (요청)
        outcome="MISS";      // 착탄점이 이미 골문 밖이다 — 좌표를 억지로 밀어내지 않는다
      }
    }
    // 4) 골키퍼 — 멀수록 반응할 시간이 있고, 각이 열려 있거나 굴절된 슛은 막기 어렵다
    if(!outcome){
      st.shotOn++;
      const gkSkill = gk ? (gk.gkSkill||0.6) : 0.6;
      let save;
      if(isPen){
        // 페널티는 방향 싸움이다 — 거리·각도·비행시간 공식이 통하지 않는다.
        // 키퍼 실력이 올리고 키커의 페널티 능력치가 내린다. 평균적으로 20% 남짓 막힌다.
        save = clamp((PEN_SAVE_BASE + gkSkill*PEN_SAVE_GK - skill*PEN_SAVE_KICKER
                      + (gk?FX(gk,"gkPen")*0.09:0)) * meTune("pen"), 0.02, 0.9);   // 🧤 페널티에 강하다
      } else {
      /* ⚠ 여기에 키퍼 능력치를 곱하지 않는다(능력치 → 선방 확률 이라는 지름길 금지).
         이 값은 「상황이 얼마나 막기 좋은가」만 담는다 — 각도·거리·슛 종류·굴절·시야.
         키퍼의 실력은 아래에서 반응 시간·도달 범위·서 있는 위치라는 물리량으로 들어간다. */
      /* ⚠ 상한이 0.97 이라 SAVE_BASE 를 그 위로 올려도 소용이 없었다 — 실측 계단을 만들려고
         상한을 함께 연다. (SAVE_BASE 주석의 계측표 참고) */
      /* 🚨🚨 ⚠ 규칙 감사 중 발견 — <b>SAVE_BASE 가 1.25 에서 잘려 있었다.</b>
         상한이 1.25 라서 1.25 를 넘는 값은 전부 같은 값이다. 즉 1.62 · 1.72 · 1.85 가
         <b>완전히 같은 경기</b>를 만든다(실측: 60경기 30개 지표가 소수 둘째 자리까지 동일).
         이 구간에서 「올렸더니 선방률이 올랐다/내렸다」고 읽었던 것은 전부 <b>노이즈</b>였다.
         (예전에도 같은 일이 있었다 — 그때는 0.97 상한을 1.25 로 열었는데, 그 뒤 계수가
          다시 상한을 넘어 올라가면서 같은 함정에 다시 빠졌다.)
         ─ 상한을 열고, 계수를 실제로 듣는 구간으로 다시 잡는다. */
      save = clamp(SAVE_BASE * meTune("save"), 0.05, 2.20);
      save -= clamp(g.angle/0.60,0,1)*0.22;
      /* 거리가 멀면 반응할 시간이 생기는 건 맞지만, 그 폭이 너무 컸다(0.26).
         실제로는 잘 맞은 중거리 슛이 코너로 꽂히면 키퍼가 손도 못 댄다. */
      save += clamp(g.distM/SHOT_MAX_M,0,1)*0.16;   // 거리 가점 완화 — 중거리골이 아예 사라지지 않게
      save -= (power-1.0)*0.14;
      if(g.distM>18){
        save -= ((shooter.lngSkill||0.6)-0.58)*0.34;      // 잘 때린 중거리는 손도 못 댄다
        save -= ((shooter.shotPower||0.6)-0.60)*0.18;     // 슛 파워 — 반응할 시간을 안 준다
      }
      /* ⚡ 중거리 한 방 — 능력 좋은 선수가 18m 밖에서 제대로 때리면 선방률이 떨어진다.
         구석을 노렸으면(corner) 더 그렇다. */

      if(deflected) save -= 0.30;
      // 반사신경 — 공이 날아오는 시간보다 반응 시간이 길면 몸이 따라가지 못한다
      const flightT=Math.max(SIM_DT*SHOT_MIN_TICKS, g.dist/(SHOT_SPEED*power));
      const reactT=0.42-gkSkill*0.22;                        // 0.20~0.35초
      save += clamp((flightT-reactT)*0.38, -0.30, 0.09);
      /* 헤더는 코앞에서 각을 바꿔 꽂히는 슛이라 키퍼가 반응할 시간이 거의 없다 */
      const SAVEADJ={HEADER:-0.11, VOLLEY:-0.06, HALF_VOLLEY:+0.06, FINESSE:-0.10, CHIP:-0.02, POWER:0, PLACED:0};
      save += (SAVEADJ[type]||0);
      if(type===SHOT_TYPE.HEADER){
        save -= ((shooter.headAim||0.6)-0.55)*0.42;   // 잘 맞춘 헤더는 못 막는다
        if(g.distM<9) save -= 0.10;                    // 코앞 헤더 — 반응할 시간이 없다
      } else if(g.distM<12){
        /* 근거리 — 침착하게 구석으로 밀어 넣으면 키퍼가 손도 못 댄다.
           천재성은 타이밍을 뺏는다(finSkill 에 이미 소량 반영되어 있으니 여기선 작게). */
        save -= ((shooter.finSkill||0.6)-0.62)*0.34;   // 골 결정력이 좋을수록 키퍼가 손을 못 댄다
        save -= ((shooter.flair||0.6)-0.62)*0.09;
        /* 침착성 — 1대1에서 키퍼를 보고 반대쪽으로 밀어 넣는 능력
           ⚠ 요청 — 「1대1 처리 능력치 비중, 특히 침착성 상향」. 0.16 → 0.24.
              침착한 공격수가 고른 코스는 키퍼가 더 못 막는다 (반대로 낮으면 정면으로 간다). */
        { const _cmp=(shooter.p&&shooter.p.attr&&attr20(shooter.p.attr.cmp)/20)||0.6;
          save -= (_cmp-0.62)*0.24; }
      }
      // 직접 프리킥 — 벽 너머로 넘어오는 공은 시야가 늦게 열려 반응이 반 박자 늦다
      if(isFK) save -= 0.10;
      }
      /* 🥄 로빙슛 — 키퍼가 나와 있을수록 막기 어렵다. 반대로 <b>골라인에 붙어 있는 키퍼에게
         로빙을 차면 그냥 잡힌다</b> — 이게 「너무 일찍 나오면 당한다」의 뒷면이다 (요청).
         예전에는 clamp(...,0,2) 라 아무리 붙어 있어도 감점이 0에서 멈췄다 — 벌이 없었다. */
      if(type===SHOT_TYPE.CHIP && gk){
        const _off=Math.abs(gk.x-g.gx)*PITCH_AR*ISO_TO_M;
        save -= clamp((_off-3.2)/4.5, -1.0, 2.0)*0.22;      // 3.2m 안쪽이면 오히려 선방률이 오른다
      }
      /* 🌀 제치기 결과 — 이겼으면 빈 골대나 다름없고, 졌으면 키퍼가 이미 공 위에 있다 */
      if(this._roundRes>0) save -= 0.44;
      else if(this._roundRes<0) save += 0.40;
      /* 🧤 1대1 방어 — 이 상황만큼은 반사신경이 아니라 「일대일」이 가른다 (요청).
         각을 크게 만들고 마지막까지 버티는 능력. 코앞에서 붙을수록 비중이 커진다. */
      if(gk && !isPen && !isFK && this._soloShot){
        const _one=clamp(gk.oneSkill||gkSkill||0.6, 0.1, 1.2);
        const _gap=HYP((gk.x-shooter.x)*PITCH_AR, gk.y-shooter.y)*ISO_TO_M;
        const _w=clamp(1-(_gap-3)/9, 0.25, 1);              // 3m 코앞 1.0 → 12m 0.25
        save += (_one-0.62)*0.34*_w;
      }
      /* 🧤 키퍼의 실제 위치에서 착탄점까지의 거리 — 정면으로 온 공과 구석으로 꽂힌 공은 다르다.
         이 항이 있어야 "키퍼가 치우친 반대쪽을 노린다"는 조준이 결과로 이어진다. (§38·§39) */
      if(gk && !isPen){
        /* 굴절된 슛은 키퍼가 이미 원래 코스로 몸을 던진 뒤다 — 공간 이점이 사라진다 */
        const reach=(GOAL_HALF*0.78 + gkSkill*GOAL_HALF*0.55)*(deflected?0.42:1);
        const need=HYP(aimY-gk.y, (aimZ-CROSSBAR_Z*0.32)*0.55);
        /* 평균적으로 선방률을 올리지 않도록 중심을 뺀다 — 이 항은 「어디로 왔는가」의
           차이만 만들어야 한다. 빼지 않으면 전체 선방률이 통째로 올라간다(실측 8.9% 결정률). */
        save += clamp((reach-need)/Math.max(1e-6,reach), -0.40, 0.22) - 0.055;
      }
      // 진짜 단독 1대1 — 수비 커버 없이 슈터가 코스를 고른다. 키퍼 혼자서 다 막아낼 수는 없다.
      if(this._soloShot) save -= 0.23;
      /* ══════════════════════════════════════════════════════════
         🧤 SAVE ATTEMPT — 확률로 막지 않는다 (§51).
         ① 슛을 인지하고 ② 반응이 걸리고 ③ 남은 시간만큼 몸을 뻗어
         ④ 그 도달 범위 안에 착탄점이 있으면 손이 닿는다.
         기존에 쌓아 온 save 값(각도·거리·슛 종류·중거리 능력…)은 버리지 않고
         「얼마나 잘 뻗는가」를 조절하는 계수로 옮겨 쓴다.
         ══════════════════════════════════════════════════════════ */
      const gkA=(gk&&gk.p&&gk.p.attr)||{};
      const _a=(k,fb)=>clamp(attr20(gkA[k]!=null?gkA[k]:(fb||60))/20, 0.15, 1);
      const ref=_a("ref",62), ant=_a("ant",60), agi=_a("agi",60), cnc=_a("cnc",60);
      /* ① 인지 — 수비수에 가려지면 늦게 본다 (§5·§37) */
      let screen=0;
      if(gk) for(const bl of blk.list){ if(bl.d<0.14) screen=Math.max(screen, 1-bl.d/0.14); }
      /* ② 반응 지연 — 예측이 좋으면 일찍 읽고, 반사신경이 좋으면 몸이 빨리 나간다 (§11·§12) */
      let reactT = GK_REACT_BASE - ant*0.10 - ref*0.08 - cnc*0.03 + screen*0.14;
      /* ⚡ 원터치 슛 — 「잡고 때리는」 동작이 없어 키퍼가 자세를 잡을 틈이 없다.
         실제로도 다이렉트 슛의 위력은 대부분 여기서 나온다(제보 반영 — 원터치 골결 버프). */
      if(opts && opts.oneTouch) reactT += 0.10 + (1-ant)*0.05;
      /* 굴절 — 이미 원래 코스로 몸을 던진 뒤다. 반응이 처음부터 다시 시작된다 (§38) */
      if(deflected) reactT += 0.16;
      /* 리바운드 — 아직 일어나지 못했다 (§41) */
      if(gk && gk._diveUntil && gk._diveUntil>this.t) reactT += (gk._diveUntil-this.t)*0.85;
      /* ③ 남은 시간 — 공이 오는 데 걸리는 시간에서 반응을 뺀다 */
      const _flightT=Math.max(SIM_DT*SHOT_MIN_TICKS, g.dist/(SHOT_SPEED*Math.max(0.2,power)));
      const tAvail=Math.max(0, _flightT - reactT);
      /* ④ 도달 거리 — 뻗는 속도 × 남은 시간. save 계수가 여기에 곱해진다 */
      const diveV=GK_DIVE_V*(0.62+agi*0.46+ref*0.30);
      /* 상황 계수(save)는 「막기 좋은 상황인가」만 곱한다. 키퍼의 실력은
         gkReachBase(키·점프·민첩)와 diveV(반사·민첩), reactT(예측·반사·집중),
         그리고 gkPosError(서 있는 자리)로 이미 물리량에 들어가 있다. */
      let reach=(gkReachBase(gk) + diveV*tAvail) * clamp(0.55+save*0.95, 0.30, 2.60);   /* 2.0 상한도 함께 연다 — 위 주석 */
      /* 🧤 아주 먼 거리에서 오는 공 — 키퍼는 자리를 잡고 기다릴 시간이 충분하다.
         ⚠ 제보 — 「패스 같은 공에 실점한다. 키퍼가 잡을 수 있어 보이는데 못 잡는다」.
            느리게 떠오는 장거리 슛일수록 사람은 오히려 편하게 처리한다. */
      if(!isPen && g.distM>=24){
        const slowK=clamp(1-(power-0.95)/0.55, 0, 1);      // 느린 공일수록 1 (로빙·툭 밀어 찬 공)
        const farK =clamp((g.distM-24)/12, 0, 1);          // 24m→0 · 36m 이상→1
        reach *= 1 + farK*(0.22 + slowK*0.60);
        /* 다만 골문을 비우고 나와 있으면 이야기가 다르다 — 그 머리 위로 넘어오는 공은 못 막는다.
           하프라인 로빙슛이라는 「진짜 명장면」은 이 조건에서만 남긴다. */
        const offM = gk ? Math.abs(gk.x-g.gx)*PITCH_AR : 0;
        if(offM>6 && aimZ>CROSSBAR_Z*0.45) reach *= clamp(1-(offM-6)/13, 0.30, 1);
      }
      /* 근거리(10m 안) — 반응은 이미 reactT가 깎지만, 몸을 완전히 펼치는 것 자체가 안 된다.
         1대1 선방률 61%(실측)의 주범 — 기본 도달까지 줄인다. */
      /* 🧤 근거리 도달 감쇠 — 선방률의 <b>두 번째 손잡이</b>(SAVE_BASE 주석의 계측표).
         슛의 절반이 11~16.5m 에서 나오는데 이 구간이 가장 세게 눌려 있었다.
         「1대1 전환율 0%」 제보를 고치며 0.52+(d/14)*0.30 까지 내린 것이 반대쪽으로 지나쳤다.
         ⚠ 한 번은 이 완화가 실패한 것처럼 보였는데(선방률 56.4% → 53.1%), 그건 SAVE_BASE 가
            0.76 이던 빌드와 0.88 이던 빌드를 맞대 놓고 잰 <b>대조 실수</b>였다.
            다른 값을 전부 고정하고 다시 재니 59.8% → 65.4% 로 분명히 움직인다. */
      if(!isPen && g.distM<14) reach *= 0.90 + (g.distM/14)*0.10;   /* 7m→0.95 · 11m→0.979 · 14m→1.0 (0.70+0.24 → 0.84+0.15 → 여기) */
      /* 착탄점까지의 실제 거리 — 좌우와 높이를 함께 본다 (§28·§31·§32) */
      /* 서 있는 위치 — Positioning 이 낮으면 각을 조금 잘못 잡고 서 있다 */
      const gy=(gk?gk.y:0.5) + gkPosError(gk, this.ball);
      const dY=Math.abs(aimY-gy), dZ=Math.max(0, aimZ-GK_HAND_Z);
      const need=HYP(dY, dZ*0.62);
      const margin=(reach-need)/Math.max(1e-6, reach);     // 1=여유롭게, 0=손끝, 음수=못 닿음
      this._gkDbg={reactT, tAvail, flightT:_flightT, reach, need, margin, screen,
                   gkY:gy, hitY:aimY, hitZ:aimZ, dive:(aimY<gy?"LEFT":"RIGHT"),
                   rec:(gk&&gk._diveUntil>this.t)?1:0};
      if(isPen ? (Math.random()<clamp(save,0.03,0.9)) : (need<=reach)){
        if(gk){ gk._diveUntil=this.t + GK_RECOVER*(0.62+ (1-agi)*0.55) * clamp(need/Math.max(1e-6,reach),0.25,1); }
        st.shotSaved++; ost.save++; this.lastAssist=null;   // 키퍼 몸에 맞음 — 리바운드 득점에 도움 없음 (규정)
        this.evl("SHOT_OUT", shooter, {k:"SAVE", by:gk?gk.id:0, byNm:gk?this.nm(gk):null});
        if(isPen) st.penSaved++;
        if(this.emitEvents) this.say(side, F_(COMM.save,{p:shooter.p.name, g:gk&&gk.p?gk.p.name:"골키퍼"}), "txt");
        this.markHighlight("save", side, HL_W.save);
        this.cap(oKey, COMM.lvSave, {g:gk&&gk.p?gk.p.name:"골키퍼"});
        // 어떻게 막았는가 —
        //   캐칭: 품에 안는다. 세거나 구석으로 오는 공은 잡을 수 없다.
        //   펀칭: 강하게 오는 공은 주먹으로 멀리 걷어낸다.
        //   쳐내기: 앞으로 밀어낸 공이 박스 안에 흐른다(리바운드).
        //   골대 옆으로: 구석으로 오는 공은 손끝으로 밀어 골라인 밖으로 넘긴다 → 코너킥
        const nearPost = Math.abs(aimY-0.5)/GOAL_HALF;      // 0=정면, 1=골포스트 구석
        /* 얼마나 여유 있게 닿았는가가 캐치/쳐내기를 가른다 — 손끝에 걸린 공은 못 잡는다 (§25·§27) */
        const _mg=isPen?0.5:clamp(margin,0,1);
        /* 📏 문전 리바운드가 경기당 0.33회뿐이다(실축 1~2). 원인은 키퍼가 <b>너무 잘 잡아서</b>다 —
           품에 안는(CATCH) 확률이 후해 쳐내기(PARRY)로 흘러나오는 공 자체가 드물었다.
           실축 키퍼는 강한 슛을 그렇게 자주 잡지 않는다. 기준선을 낮춘다(0.10 → 0.02). */
        let hold = 0.02 + _a("han",62)*0.50 + _mg*0.42 - (power-1.0)*0.30 - nearPost*0.20;
        /* 🧤 특성 — 펀칭 선호는 덜 잡고, 「품에 안는다」는 더 잡는다 */
        if(gk) hold -= FX(gk,"gkFist")*0.28;
        hold -= (WX_NOW.wet||0)*0.24;              // 🌧️ 젖은 공은 품에 안기지 않는다 (요청)
        if(deflected) hold -= 0.20;
        if(type===SHOT_TYPE.POWER) hold += 0.12;
        if(type===SHOT_TYPE.CHIP) hold += 0.10;   // 느리게 떠오는 공은 잡기 쉽다
        /* 🧤 ⚠ 제보 원문 — 「골키퍼가 손으로 펀칭해서 경기장 중간 터치라인까지 튕겨내는 장면이
           어색하다. 처리하기 쉬운 볼이면 잡고, 어려운 볼이면 코너킥이 되게 튕겨냈으면」.
           ─ 「처리하기 쉬운 공」의 기준을 분명히 한다: 힘없이 오고, 정면이고, 여유 있게 닿은 공. */
        if(power<0.88) hold += 0.16;                       // 힘이 실리지 않은 공 — 품에 안는다
        if(nearPost<0.30) hold += 0.10;                    // 정면으로 온 공
        if(_mg>0.55) hold += 0.06;                         // 여유 있게 닿았다 (0.10 →)
        /* 🧤 ⚠ 제보 — 「키퍼가 슛을 하프라인 근처 터치라인까지 뻥 차서 막는 장면이 잦다.
           실축에서는 잡기 어려우면 옆으로 쳐내 코너를 만들고, 잡기 쉬우면 잡아 골킥으로 넘긴다」.
           ─ 잡을 수 있으면 잡고(CATCH), 못 잡을 공은 「옆으로 흘려 코너」(TIP)를 1순위로 둔다.
             주먹으로 멀리 걷어내는 펀칭은 정말 그럴 수밖에 없는 공에만 남긴다. */
        if(gk && Math.random() < clamp(hold, 0.04, 0.90)){ st.shotCaught++; outcome=SAVE_TYPE.CATCH; }
        else if(!isPen && margin<0.18){ st.shotTipped++; outcome=SAVE_TYPE.TIP; }   // 손끝에 겨우 걸렸다
        else if(nearPost>0.55 && Math.random()<0.80){ st.shotTipped++; outcome=SAVE_TYPE.TIP; }
        /* 구석은 아니어도 「잡지 못한 강슛」은 옆으로 밀어 라인 밖으로 — 코너킥이 된다 (제보) */
        else if(power>1.05 && Math.random()<0.58+clamp((power-1.05)*0.60,0,0.28)){ st.shotTipped++; outcome=SAVE_TYPE.TIP; }
        /* 🧤 제보 — 슛을 주먹으로 멀리 걷어내는 그림은 없앴다. 못 잡으면 몸 앞에 흘리거나(리바운드)
           옆으로 밀어 코너를 준다. 펀칭은 크로스를 걷어낼 때만 남는다. */
        else { st.shotParried++; outcome=SAVE_TYPE.PARRY; }
        // 슈퍼세이브 — 막힐 리 없던 슛을 막아냈다
        if((g.distM<14 && g.angle>0.45) || (power>1.32 && nearPost>0.68)) st.superSave++;
        if(gk){ actorId=gk.id; }
      } else {
        /* 못 닿았다 — 그래도 몸은 그쪽으로 날아간다(헛다이빙). 다음 슛까지 못 일어난다. */
        if(gk && !isPen){
          gk._diveUntil=this.t + GK_RECOVER*0.85;
          gk._diveTo={y:clamp01(gy + Math.sign(aimY-gy)*reach*0.9), at:this.t+reactT};
        }
        st.goal++; if(deflected) st.goalDeflected++;
        if(isPen) st.penGoal++; else if(isFK) st.fkGoal++;
        outcome="GOAL";
        ey = 0.5 + (Math.random()-0.5)*2*GOAL_HALF*0.85;   // 골문 안쪽 어딘가
      }
    }

    this._lastOutcome=outcome;   // 계측용 — 이 슛이 어떻게 끝났는가
    // 궤도는 언제나 골문을 향한 직선이다. 키퍼가 막는 슛은 그 직선 위에서 키퍼가 서 있는 지점에
    // 멈출 뿐, 공이 키퍼를 따라 휘지 않는다.
    let saveY=null;
    const isSave = (outcome===SAVE_TYPE.CATCH||outcome===SAVE_TYPE.PARRY||
                    outcome===SAVE_TYPE.PUNCH||outcome===SAVE_TYPE.TIP);
    if(isSave){
      const pt=onLine(gk ? (gk.x-shooter.x)/span : 1);
      ex=pt.x; ey=pt.y; saveY=pt.y;                    // 키퍼는 이 지점으로 몸을 날린다
      if(gk && gk._diveTo) saveY=gk._diveTo.y;         // 실제로 손이 닿은 높이·방향
    } else if(outcome==="MISS"){
      /* ⚠ 제보 — 「골문을 살짝 벗어납니다」인데 공이 골대 안에 들어가 있다.
         앞뒤로는 골라인 뒤로 보냈지만 좌우(ey)는 조준점 그대로였다. 크로스바를 넘긴 슛은
         조준점이 골문 폭 안이라, 높이를 그리지 않는 2D 화면에서는 골망에 꽂힌 것처럼 보였다.
         ─ 빗나간 공은 반드시 골포스트 바깥으로 흘려보낸다. 그래야 결과와 그림이 어긋나지 않는다. */
      const _wide = Math.abs(aimY-0.5) >= GOAL_HALF;        // 좌우로 벗어난 슛
      const _sd = (aimY>=0.5 ? 1 : -1);
      /* 🥅 요청 — 「공이 골문 위로 뜨면 골대 뒤 공간으로 나가게」.
         크로스바를 넘긴 슛은 포스트 바로 바깥을 스치듯 지나 골대 뒤까지 흘러간다.
         좌우로 벗어난 슛은 종전대로 크게 벗어난다. 어느 쪽이든 골망(0.02)보다 훨씬 깊이
         나가므로, 넓힌 골대 뒤 공간에서 「확실히 빗나갔다」가 눈으로 읽힌다. */
      ey = _wide ? clamp01(aimY + _sd*(0.030+Math.random()*0.025))
                 : clamp01(0.5 + _sd*(GOAL_HALF + 0.022 + Math.random()*0.022));
      ex = g.gx + (g.gx===1?1:-1)*(_wide ? 0.050+Math.random()*0.022
                                         : 0.058+Math.random()*0.020);   // 골대 뒤 공간까지
    } else if(outcome!=="BLOCK"){
      /* 골 — 그물 안 1.3m 지점이 종착점. 그물을 뚫고 나가지 않고, 라인 위에서 멈추지도 않는다 */
      ex=g.gx + (g.gx===1?1:-1)*GOAL_NET_DEPTH*0.60; ey=aimY;
    }

    // ── 공을 실제로 날린다. 결과는 도착한 뒤에 적용된다.
    b.state="SHOT"; b.ownerId=null; b.toId=null;
    b.isCross=false; b.offsideAt=null; b.isThrow=false; b.aerial=false; b.setPiece=null;
    /* ⚠ 슛의 출발점 — 공을 슈터 몸 중심으로 끌어오면 발 앞에 있던 공이 순간이동한다.
       실제로는 발 앞에 있는 그 공을 그대로 때린다. 지금 공 위치에서 출발시킨다.
       (다만 몸에서 너무 벗어나 있으면 발이 닿는 거리까지만 당긴다) */
    {
      const gx=(shooter.x-b.x)*PITCH_AR, gy=shooter.y-b.y, gd=HYP(gx,gy);
      const reach=DRIB_LEAD*1.2;
      /* ⚠ 오픈플레이 슛은 결정 단계의 거리 게이트(DRIB_LEAD*1.45)가 막으므로
         여기 당김은 헤더·발리 등 공중 경로의 소폭 보정만 남는다. 크게 당기면 버그다. */
      if(gd>reach){
        /* 제보 — 「임팩트 순간 공이 선수 쪽으로 이동」의 마지막 잔재가 이 당김이었다.
           공은 그 자리에 둔다. 대신 선수가 공 쪽으로 반 발 들어간다(헤더·발리에서 몸을 던지는 그림).
           남는 간격은 그대로 — 슛은 공의 실제 위치에서 출발한다. */
        const step=Math.min(gd-reach, 0.014);
        shooter.x=clamp01(shooter.x-(gx/gd)*step/PITCH_AR);
        shooter.y=clamp01(shooter.y-(gy/gd)*step);
      }
    }
    /* 🥅 빗나간 슛의 착탄점은 골라인 뒤 공간이다 — clamp01 로 묶으면 골라인(1.0)에서 딱 멈춰
       「들어간 건지 아닌지」가 구분되지 않는다 (BEHIND_GOAL_MAX 주석 참고) */
    b.tx=clampGoalOut(ex); b.ty=clamp01(ey);
    b.power=power;
    /* 🍌 감아차기 폭을 정하는 두 값 — 골문 정면에서 얼마나 벗어나 있는가 · 얼마나 먼가 */
    const _wideK = clamp((Math.abs(shooter.y-0.5)-0.15)/0.27, 0, 1);
    resolveKick(b, shooter, KICK.SHOT, {placed:(power<1.02), power:power,
      wideK:_wideK, distM:(g&&g.distM)||18});
    b.flightLen=HYP((b.tx-b.sx)*PITCH_AR, b.ty-b.sy);
    const spd  = SHOT_SPEED*power;
    const T    = Math.max(SIM_DT*SHOT_MIN_TICKS, b.flightLen/spd);
    b.vx=(b.tx-b.sx)*PITCH_AR/T; b.vy=(b.ty-b.sy)/T;
    // 출발 높이 — 헤더는 머리에서, 발리는 뜬 공 그대로, 나머지는 발밑
    b.z = type===SHOT_TYPE.HEADER ? CROSSBAR_Z*0.80
        : type===SHOT_TYPE.VOLLEY ? Math.max(VOLLEY_Z, b.z||0) : 0.0008;
    b.z0=b.z; b.vz=0;
    // 감아차기 — 경로 옆으로 부풀렸다가 코스로 되돌아오는 바나나 궤적.
    // (매 틱 수직 가속도를 누적하는 것과 같은 모양이지만, 도착점이 어긋나지 않는다)
    b.curve = type===SHOT_TYPE.FINESSE
            ? (shooter.y<0.5?1:-1)*CURVE_MAX*(0.55+(shooter.finSkill||0.6)*0.7)
            : (type===SHOT_TYPE.POWER ? (Math.random()-0.5)*CURVE_MAX*0.35 : 0);
    b.inNet=false; b.bounced=0;
    b.aimZ=aimZ; b.flightT=T;
    // distM·isPen·isFK 는 골 해설을 고르는 데 쓴다 (헤더골·발리골·중거리포·PK 골을 구분해서 말한다)
    b._gkDbg = this._gkDbg || null;
    b._shotDbg = this._shotAim ? {
      pow:this._shotPow,
      type, q:this._shotAim.acc, aimY:this._shotAim.y, aimZ:this._shotAim.z,
      sy:this._shotAim.sy, sz:this._shotAim.sz, hitY:aimY, hitZ:aimZ,
      power, gx:g.gx, distM:g.distM, gkY:(gk?gk.y:null), gkX:(gk?gk.x:null),
      press:blk.near, outcome
    } : null;
    b.shot={outcome, side, oKey, actorId, deflected, type, gx:g.gx, fromY:shooter.y, shooterId:shooter.id,
            aimY, saveY, aimZ, distM:g.distM, isPen, isFK, solo:(shooter.burstUntil||0)>this.t};
    this.lastEvent={kind:outcome, type, side, t:this.t};
  }
  /* 슛한 공이 날아가는 동안 — 골문(또는 블로커·키퍼)까지 실제로 이동한다.
     이게 없으면 슛을 때리는 순간 공이 결과 지점으로 순간이동해서, 슛도 그 다음 상황도 보이지 않는다. */
  advanceShot(){
    const b=this.ball, sh=b.shot;
    b.flight+=SIM_DT;
    const px=b.x, py=b.y;
    const total=b.flightT||Math.max(SIM_DT*SHOT_MIN_TICKS, b.flightLen/(SHOT_SPEED*(b.power||1)));
    const p=clamp01(b.flight/total);
    /* 🥅 빗나간 슛은 골라인 뒤 공간까지 나간다 (clamp01 → clampGoalOut) — 위 BEHIND_GOAL_MAX 주석 참고 */
    b.x=clampGoalOut(lerp(b.sx, b.tx, p)); b.y=clamp01(lerp(b.sy, b.ty, p));
    // 높이 — 출발 높이에서 목표 높이(aimZ)까지, 중력에 눌린 포물선
    const z0=b.z0||0, z1=b.aimZ||0;
    b.z=Math.max(0, lerp(z0, z1, p) + loftPeak(total)*1.2*p*(1-p));
    // 감아차기 — 경로에 수직인 방향으로 부풀린다. 중간에서 가장 크게 휘고 코스에서 만난다.
    if(b.curve){
      const dx=(b.tx-b.sx)*PITCH_AR, dy=b.ty-b.sy, dl=HYP(dx,dy)||1e-6;
      const bulge=b.curve*Math.sin(Math.PI*p);
      b.x=clampGoalOut(b.x + (-dy/dl)*bulge/PITCH_AR);
      b.y=clamp01(b.y + ( dx/dl)*bulge);
    }
    b.vx=(b.x-px)*PITCH_AR/SIM_DT; b.vy=(b.y-py)/SIM_DT;
    // 골라인 평면을 넘는 순간 — 골포스트·크로스바에 맞았는지 본다
    if(sh){
      const gx=sh.gx;
      const crossed = gx>0.5 ? (px<gx && b.x>=gx) : (px>gx && b.x<=gx);
      if(crossed){
        const k=Math.abs(gx-px)/Math.max(1e-6, Math.abs(b.x-px));
        const yAt=lerp(b.y-b.vy*SIM_DT, b.y, k);
        const zAt=Math.max(0, b.z - b.vz*SIM_DT*(1-k));
        const off=Math.abs(yAt-0.5);
        const hitPost = Math.abs(off-GOAL_HALF)<GOAL_POST && zAt<CROSSBAR_Z;
        const hitBar  = off<GOAL_HALF+GOAL_POST && Math.abs(zAt-CROSSBAR_Z)<GOAL_POST*1.6;
        if(hitPost || hitBar){
          this.stats[sh.side].woodwork++;
          /* 🥅 ⚠ 통계는 세면서 하이라이트 트리거가 없었다 — 골대 맞고 나온 장면이 안 보였다 */
          try{ this.markHighlight("wood", sh.side, HL_W.wood); }catch(e){}
          this.evl("SHOT_OUT", this.byId(sh.shooterId), {k:"POST"});
          /* 💥 골대를 때리는 소리는 경기장에서 제일 큰 소리다 — 세게 흔든다 (요청) */
          if(this.emitEvents){ try{
            const _wn=this.nm(this.byId(sh.shooterId));
            this.cap(sh.side, COMM.lvPost, {p:_wn}, true, {shake:1.25});
          }catch(e){} }
          this.lastAssist=null;                     // 골대 굴절 — 이후 득점은 도움 없음 (규정)
          this.lastEvent={kind:hitBar?"CROSSBAR":"POST", side:sh.side, t:this.t};
          b.x=clamp01(gx - (gx>0.5?1:-1)*0.004); b.y=clamp01(yAt); b.z=Math.max(0,zAt);
          if(hitBar){ b.vz=-Math.abs(b.vz)*POST_BOUNCE; b.vx*=-POST_BOUNCE*0.6; }
          else { b.vx*=-POST_BOUNCE; b.vy=(yAt<0.5?-1:1)*Math.abs(b.vy||0.05)*POST_BOUNCE; }
          b.shot=null; b.state="LOOSE"; b.looseT=0; b.looseBy=sh.side;
          b.ownerId=null; b.toId=null; b.aerial=b.z>0.004;
          return;                                   // 골대를 맞고 튕겨 나왔다
        }
        if(off<GOAL_HALF && zAt<CROSSBAR_Z && sh.outcome!=="GOAL"){
          /* ⚠ 제보 — 「공이 분명히 골대 안에 들어갔는데 코너킥」.
             코스는 골문 안인데 결과가 골이 아니면(키퍼가 막았다), 예전에는 여기서 아무것도
             하지 않고 공을 그대로 골문 안까지 날려 보낸 뒤 finishShot 이 코너로 처리했다.
             선방은 라인을 넘기 「전에」 일어나야 한다 — 접점에서 공을 세우고 즉시 결과를 낸다. */
          b.x=clamp01(gx - (gx>0.5?1:-1)*0.006);
          b.y=clamp01(yAt); b.z=Math.max(0, zAt);
          b.flight=b.flightT||b.flight;              // 비행 종료로 표시
          this.finishShot();
          return;
        }
      }
    }
    if(p>=1) this.finishShot();
  }
  /* 슛이 도착했다 — 결과에 따라 다음 상황으로 이어진다. */
  finishShot(){
    const b=this.ball, sh=b.shot;
    b.shot=null; b.state="SETTLED";
    if(!sh){ this.kickoff(this.possSide); return; }
    const {outcome, side, oKey, actorId, gx, fromY}=sh;
    /* 🧤 다이빙 커밋 — 세이브 판정 자체는 리치 계산으로 이미 끝났지만, 키퍼 바둑알이
       접점에서 몇 m 떨어진 채 공만 튕겨 나가면 「장풍 세이브」로 보인다(제보).
       공이 도착한 이 순간, 키퍼 몸을 실제 접점까지 날려 공이 바둑알에 닿고 튕기게 한다.
       (리치 검증을 통과한 거리라 몸이 못 갈 곳으로 순간이동하는 게 아니다 — 다이빙의 완성이다) */
    if(outcome===SAVE_TYPE.CATCH||outcome===SAVE_TYPE.TIP||outcome===SAVE_TYPE.PUNCH||outcome===SAVE_TYPE.PARRY){
      const gkD=this.byId(actorId);
      if(gkD){
        const dx=(b.x-gkD.x)*PITCH_AR, dy=b.y-gkD.y, d=HYP(dx,dy);
        if(d>0.006){
          const k=(d-0.005)/d;                       // 바둑알 반지름만큼만 남기고 접점으로
          /* ⚠ 몸을 던지는 것도 물리적 한계가 있다 — 한 틱에 3.5m(전력 다이빙)까지만.
             예전엔 접점이 아무리 멀어도 통째로 옮겨 붙어 순간이동처럼 보였다(제보). */
          stepToward(gkD, gkD.x+dx*k/PITCH_AR, gkD.y+dy*k, 3.5);
          gkD.vx=0; gkD.vy=0;
        }
      }
    }
    switch(outcome){
      case "BLOCK": {                                  // 막힌 공이 수비수 몸을 맞고 튕겨 나온다
        const bl=this.byId(actorId);
        if(!bl){ this.goalKick(oKey); return; }
        // 되돌아오는 방향 — 슛이 온 쪽으로 되튀되 좌우로 크게 흩어진다
        const backAng=Math.atan2(b.sy-b.y, (b.sx-b.x)*PITCH_AR);
        const ang=backAng+(Math.random()-0.5)*2.2;
        /* 🎾 몸에 맞고 — 강슛일수록 멀리 튄다 (§22). 다만 사람 몸은 벽이 아니라 충격을 먹는다.
           제보: 「막힌 공이 아주 먼 거리로 터치라인 아웃된다」 — 되튀는 몫을 줄였다. */
        this.launchLoose(b.x, b.y, ang, (6+Math.random()*9)*(0.60+(b.power||1)*0.30), side, false);
        return;
      }
      case "MISS":  this.lastEvent={kind:"MISS", side, t:this.t};
                    /* 🚩 ⚠ 규칙 감사 — 굴절되어 골라인을 넘은 공은 <b>코너킥</b>이다.
                       마지막으로 몸에 닿은 사람이 수비수이기 때문이다. 여태 굴절 여부와
                       무관하게 전부 골킥으로 처리했다(경기당 빗나간 슛 7.5개 중 일부).
                       블록된 슛에는 이미 코너 처리가 있는데(BLOCK_CORNER_P) 굴절만 빠져 있었다. */
                    if(sh && sh.deflected){ placeGoalOut(b, gx, b.y); this.cornerKick(side, gx, b.y); return; }
                    this.goalKick(oKey); return;       // 골라인을 넘었다 → 상대 골킥
      case SAVE_TYPE.CATCH: {                          // 캐칭 — 품에 안았다. 그대로 소유권이 넘어간다.
        const gk=this.byId(actorId);
        if(gk){ this.giveTo(gk, {noTouch:true}); b.hold=(3.0+Math.random()*2.0)*TEMPO; } else this.goalKick(oKey);
        return;
      }
      case SAVE_TYPE.TIP: {                            // 손끝으로 밀어 골대 옆으로 넘겼다 → 코너킥
        const gk=this.byId(actorId); if(gk) gk._down=this.t+DIVE_HOLD;
        /* ⚠ 제보 — 「공이 골대 안에 들어갔는데 코너킥」.
           손끝에 걸린 공은 「골포스트 바깥」으로 넘어가야 한다. 골문 안쪽 좌표에 둔 채
           코너를 선언하면 화면상 공이 골문으로 들어간 뒤 코너가 되는 것처럼 보인다. */
        /* 🥅 손끝에 걸린 공·옆그물을 맞고 나간 공 — 골망 뒤·포스트 바깥까지 확실히 빼놓는다.
           (예전엔 라인 뒤 0.008 · 포스트 밖 0.012 라 화면상 골문 안이었다 — 제보) */
        placeGoalOut(b, gx, b.y);
        this.cornerKick(side, gx, b.y);
        return;
      }
      case SAVE_TYPE.PUNCH: {                          // 펀칭 — 주먹으로 멀리, 박스 밖으로 걷어낸다
        const gk=this.byId(actorId); if(gk) gk._down=this.t+DIVE_HOLD*0.6;
        const away = gx>0.5 ? Math.PI : 0;              // 골문 반대 방향
        const ang = away + (Math.random()-0.5)*0.9;
        /* 거리·각 축소 (제보: 펀칭이 하프라인 근처까지 날아간다) — 실제 펀칭은 박스 밖 언저리다 */
        this.launchLoose(b.x, b.y, ang, (7.0+Math.random()*3.5)*(0.66+(b.power||1)*0.14), oKey, true);
        return;
      }
      case SAVE_TYPE.PARRY: {           // 쳐내기 — 앞으로 밀어낸 공이 박스 안에 흐른다
        const gk=this.byId(actorId); if(gk) gk._down=this.t+DIVE_HOLD;
        const away = gx>0.5 ? Math.PI : 0;
        const ang = away + (Math.random()<0.5?-1:1)*(0.5+Math.random()*0.9);   // 옆으로 비스듬히
        /* 쳐내기는 몸 앞 3~8m에 흘리는 공이다 — 18m짜리 쳐내기는 없다 (제보)
           🎾 손에 맞은 공은 크게 죽는다 — 슛이 세다고 그만큼 멀리 튀지 않는다 (제보) */
        this.launchLoose(b.x, b.y, ang, (2.6+Math.random()*3.4)*(0.62+(b.power||1)*0.16), oKey, false);
        return;
      }
      default: {                                       // 골 — 공은 그물에 걸려 흔들리다 멈춘다
        // 늦게 올라간 깃발 — 골이 들어간 뒤에야 오프사이드가 선언된다
        if(this.pendingOff && this.pendingOff.by===side && this.t<=this.pendingOff.until){
          this.disallowGoal(side, sh);
          return;
        }
        /* 📺 VAR 온필드 리뷰 — 실제 경기(emitEvents)에서만, 낮은 확률로.
           환호가 터진 직후 주심이 헤드셋에 손을 얹고, 몇 초 뒤 인정/취소가 갈린다.
           ⚠ 제보 — 페널티킥 골이 "빌드업 핸드볼"로 취소되던 문제. PK는 정지 상태에서
             키커와 골키퍼만 관여하는 재개라 빌드업 파울도 오프사이드도 성립하지 않는다.
             분 단위 엔진(scoreGoal)은 이미 !isPen && !isOG 로 빼 두었는데 이쪽만 빠져 있었다. */
        const varSkip = sh.isPen || sh.isOG;
        if(this.emitEvents && !varSkip && Math.random()<VAR_CHECK_P){
          this.lastEvent={kind:"VAR", side, t:this.t};
          this.markHighlight("goal", side, HL_W.goal);
          b.inNet=true; b.vx*=0.55; b.vy*=0.55; b.vz*=0.35;
    { const dirIn=b.x>0.5?1:-1; if(Math.abs(b.vx)<0.085) b.vx=dirIn*0.085; } b.ownerId=null;
    { const dirIn=b.x>0.5?1:-1; if(Math.abs(b.vx)<0.085) b.vx=dirIn*0.085; }
          /* 취소 사유는 지금 이 장면에서 실제로 있었던 일로 정한다 — 나중에 동전 던지기로
             뽑으면 화면으로 본 장면과 중계 문구가 어긋난다.
               · 마지막 패스로 연결된 골 → 오프사이드 (빌드업에서 라인을 넘었을 수 있다)
               · 혼자 몰고 들어갔거나 리바운드·굴절 골 → 빌드업 파울 */
          const varReason = (this.lastAssist && this.lastAssist.side===side && !sh.deflected) ? "off" : "foul";
          b.celebrate={t:0, side, oKey, scorerId:sh.shooterId, clk:this.clock, varCheck:true, varSh:sh, varReason};
          // VAR 검토 중에는 ⚽ 이름표를 달지 않는다 — 인정이 확정된 순간(아래 확정 처리)에 단다
          this.syncClock();
          const nm=this.nm(this.byId(sh.shooterId));
          this.say(side, F_(COMM.varCheck, Object.assign({p:nm}, refVars(this.M))), "info", {kind:"var_check", side});
          this.cap(side, COMM.lvGoalLive, {p:nm});
          const t0=this.t;
          this.caps.push({t:t0+1.6, side, txt:F_(COMM.lvVarWait,{})});
          if(this.caps.length>HL_CAP_MAX) this.caps.shift();
          return;
        }
        this.score[side]++;
        this.lastEvent={kind:"GOAL", type:sh.type, side, t:this.t};
        this.evl("SHOT_OUT", this.byId(sh.shooterId), {k:"GOAL"});
        this.recordGoal(side, sh);
        this.goalCommentary(side, sh);
        this.markHighlight("goal", side, HL_W.goal);
        b.inNet=true;                                  // 그물 저항 → 급격히 감속
        { const dirIn=b.x>0.5?1:-1;                    // 최소 진입 속도 — 라인 위에서 멈춘 골은 골처럼 안 보인다(제보)
          if(Math.abs(b.vx)<0.085) b.vx=dirIn*0.085; }
        b.vx*=0.55; b.vy*=0.55; b.vz*=0.35;
        b.celebrate={t:0, side, oKey, scorerId:sh.shooterId, clk:this.clock};
        { const _sid=(b.celebrate&&b.celebrate.scorerId)||null, _prev=this.goalTag;
          this.goalTag={sid:_sid, aid:(_prev&&_prev.sid===_sid)?_prev.aid:null, until:this.t+6}; }   // 도움(recordGoal이 채움)을 덮어쓰지 않는다
        b.ownerId=null;
        return;
      }
    }
  }
  /* ⚽ 굴러 들어간 골 — 드리블로 몰고 들어갔거나 굴절된 공이 골문 사이로 넘은 경우 */
  rollInGoal(side, ogBy){
    const b=this.ball, oKey=this.opp(side);
    /* 늦은 깃발 — 오프사이드 대기 중이었으면 취소 */
    const scorer= ogBy || (b.ownerId!=null?this.byId(b.ownerId):null)
              || (b._rollOwner!=null?this.byId(b._rollOwner):null);
    const sh={shooterId:scorer?scorer.id:null, type:SHOT_TYPE.PLACED, isPen:false, og:!!ogBy};
    if(this.pendingOff && this.pendingOff.by===side && this.t<=this.pendingOff.until){
      this.disallowGoal(side, sh); return;
    }
    this.stats[side].goal++;
    if(!ogBy){ this.stats[side].shot++; this.stats[side].shotOn++; }   // 자책골은 득점팀의 슛이 아니다
    this.score[side]++;
    this.lastEvent={kind:"GOAL", type:SHOT_TYPE.PLACED, side, t:this.t};
    this.recordGoal(side, sh);
    if(this.emitEvents){
      if(ogBy) this.cap(side, ["😱 아, 이럴 수가… {p}의 공이 그대로 자기 골문으로! 자책골입니다"],
                        {p:this.nm(ogBy)});
      else this.cap(side, ["🥅 {p}, 공을 그대로 몰고 골문 안까지! 침착한 마무리"],
                    {p:scorer?this.nm(scorer):"공격수"});
    }
    this.markHighlight("goal", side, HL_W.goal);
    b.inNet=true; b.vx*=0.55; b.vy*=0.55; b.vz*=0.35;
    { const dirIn=b.x>0.5?1:-1; if(Math.abs(b.vx)<0.085) b.vx=dirIn*0.085; }
    b.celebrate={t:0, side, oKey, scorerId:sh.shooterId, clk:this.clock};
    b.ownerId=null; b.state="LOOSE"; b.shot=null;
  }
  /* 📺 판독 결론 — 정해진 시간이 됐거나, 종료 휘슬을 앞두고 강제로 매듭짓는다.
     ⚠ 제보 — 「극후반에 상대가 넣은 골이 인정도 취소도 없이, 아무 하이라이트도 없이 경기가 끝났다」.
       판독은 세리머니 타이머(cel.t)로 굴러가는데 종료 조건은 경기 시계만 봤다. 그래서 판독 도중
       시계가 다하면 골이 점수에 오르지도 않고(판독 통과 시에만 올린다), 취소 안내도 나오지 않은 채
       통째로 사라졌다. 실제 경기에서 주심은 판독이 끝나기 전에 종료 휘슬을 불지 않는다. */
  decideVar(cel){
    if(!cel || !cel.varCheck || cel.varDone) return false;
    cel.varDone=true;
    const sh=cel.varSh||{shooterId:cel.scorerId};
    const nm=this.nm(this.byId(cel.scorerId));
    if(Math.random()<VAR_CONFIRM_P){
      cel.varCheck=false;                              // 인정 — 남은 세리머니를 이어 간다
      this.score[cel.side]++;
      this.lastEvent={kind:"GOAL", side:cel.side, t:this.t};
      this.recordGoal(cel.side, sh);
      if(this.emitEvents){
        this.syncClock();
        this.say(cel.side, F_(COMM.varConfirm, refVars(this.M)), "goal", {kind:"sim_goal", side:cel.side, scorerId:cel.scorerId});
      }
      this.cap(cel.side, COMM.lvVarOk, {p:nm});
    } else {
      cel.disallowed=true; cel.varCheck=false; cel.t=CELEBRATE_OFF_SECS*0.45;   // 취소 — 짧게 끊는다
      cel.offSpot={x:this.ball.x, y:this.ball.y, by:cel.side};
      const st=this.stats[cel.side];
      st.goalDisallowed=(st.goalDisallowed||0)+1;
      if(this.emitEvents){
        this.syncClock();
        this.say(cel.side, F_(cel.varReason==="off"?COMM.varOverturnOffside:COMM.varOverturnFoul, Object.assign({p:nm}, refVars(this.M))), "bad", {kind:"var_overturn", side:cel.side});
      }
      this.cap(cel.side, COMM.lvVarNo, {p:nm});
    }
    return true;
  }
  /* 지금 판독이 걸려 있는가 — 걸려 있으면 휘슬을 불 수 없다 */
  get varPending(){ const c=this.ball&&this.ball.celebrate; return !!(c && c.varCheck && !c.varDone); }
  /* 어떤 경로로 경기가 끝나든, 끝나기 전에 판독을 매듭짓는다 (안전망) */
  settleVar(){ const c=this.ball&&this.ball.celebrate; if(c && c.varCheck && !c.varDone) this.decideVar(c); return !!c; }
  /* 골 세리머니 — 득점자가 코너 쪽으로 달려나가면 동료들이 우르르 몰려가 껴안고,
     실점한 팀은 고개를 숙인 채 자기 진영으로 걸어 돌아간다. 끝나면 킥오프. */
  advanceCelebration(){
    const b=this.ball, cel=b.celebrate;
    cel.t+=SIM_DT;
    const scorer=this.byId(cel.scorerId);
    /* 📺 판독 중 — 시간이 되면 결과가 나온다 */
    if(cel.varCheck && !cel.varDone && cel.t>=VAR_DECIDE_SECS) this.decideVar(cel);
    const dur = cel.disallowed ? CELEBRATE_OFF_SECS : (cel.varCheck ? VAR_DECIDE_SECS+2 : CELEBRATE_SECS);
    if(!scorer || (cel.t>=dur && !(cel.varCheck&&!cel.varDone))){
      b.celebrate=null;
      if(cel.disallowed){
        // 취소된 골 — 킥오프가 아니라 반칙 지점에서 수비 팀 프리킥(오프사이드는 간접)
        const o=cel.offSpot;
        this.freeKick(this.opp(o.by), {x:o.x, y:o.y}, cel.varReason!=="foul");
      } else this.kickoff(cel.oKey);                    // 실점한 팀이 킥오프
      return;
    }
    /* 판독 중 — 환호 대신 주심 주변으로 모여 서성인다 */
    if(cel.varCheck && !cel.varDone){
      for(const a of this.agents){
        if(a.slot==="GK") continue;
        const ang=(a.seed%360)*Math.PI/180;
        const tx=0.5+Math.cos(ang)*0.07, ty=0.30+Math.sin(ang)*0.06;
        const mx=(tx-a.x)*PITCH_AR, my=ty-a.y, ml=HYP(mx,my);
        if(ml>1e-6){ const st2=Math.min(ml, SPD.JOG*SIM_DT);
          a.x=clamp01(a.x+(mx/ml)*st2/PITCH_AR); a.y=clamp01(a.y+(my/ml)*st2); }
      }
      if(b.inNet){ stepBallPhysics(b); if(HYP(b.vx,b.vy)<BALL_STOPV && b.z<=0) b.inNet=false; }
      return;
    }
    // 득점자는 자기가 넣은 쪽 코너 깃발로 달려나간다
    const cornerX = scorer.dir>0 ? 0.94 : 0.06;
    const cornerY = scorer.y<0.5 ? 0.10 : 0.90;
    const rush = clamp01(cel.t/4.5);                   // 4.5초 동안 몰려갔다가 이후 자리로 복귀
    const back = cel.t>CELEBRATE_SECS-7 ? clamp01((cel.t-(CELEBRATE_SECS-7))/7) : 0;
    for(const a of this.agents){
      if(a.slot==="GK") continue;
      let tx, ty, spd;
      if(a.side===cel.side){
        if(a.id===scorer.id){ tx=cornerX; ty=cornerY; spd=SPD.SPRINT; }
        else {                                          // 동료들이 득점자에게 몰려간다
          const ang=(a.seed%360)*Math.PI/180;
          tx=cornerX+Math.cos(ang)*0.035; ty=cornerY+Math.sin(ang)*0.045; spd=SPD.SPRINT;
        }
      } else {                                          // 실점한 팀은 하프라인 쪽으로 터덜터덜
        tx=0.5-a.dir*0.10; ty=a.home.y; spd=SPD.JOG*0.7;
      }
      if(back>0){                                       // 끝나갈 무렵엔 킥오프 자리로 돌아간다
        const anchor=tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
        tx=lerp(tx, anchor.x, back); ty=lerp(ty, anchor.y, back); spd=SPD.SPRINT;
      } else if(a.side===cel.side && rush<1){
        spd=SPD.SPRINT;
      }
      const mx=(tx-a.x)*PITCH_AR, my=ty-a.y, ml=HYP(mx,my);
      if(ml>1e-6){
        const step=Math.min(ml, spd*SIM_DT);
        a.x=clamp01(a.x+(mx/ml)*step/PITCH_AR);
        a.y=clamp01(a.y+(my/ml)*step);
      }
    }
    // 골망에 걸린 공은 잠시 흔들리다 멈춘다 — 그물 안(골라인 뒤)에 그대로 머문다.
    // ⚠ 예전 clamp01이 득점된 공을 골라인 위로 되돌려 「골인지 아닌지 모호한」 그림을 만들었다(제보)
    if(b.inNet){ stepBallPhysics(b);
      if(HYP(b.vx,b.vy)<BALL_STOPV && b.z<=0) b.inNet=false; }
  }
  /* 공에 속도를 줘서 굴러가게 한다. 방향(rad, iso 기준)과 세기(iso/초)를 받는다.
     aerial 이면 떠서 날아가므로 굴러가는 도중에는 아무도 잡지 못한다(펀칭 등). */
  launchLoose(x, y, ang, runM, byside, aerial){
    const b=this.ball;
    b.state="LOOSE";
    b.x=clamp01(x); b.y=clamp01(y);
    // 굴러갈 거리(m)를 받아 초기 속도를 역산한다. 마찰로 감속하며 대략 그만큼 가서 멈춘다.
    const D=runM/ISO_TO_M;
    if(aerial){                                  // 떠서 날아간다 — 포물선
      // ⚠ runM 은 "최종적으로 멈추는 곳까지의 거리"다.
      //    공중볼은 첫 착지 뒤에도 바운스하며 계속 굴러가기 때문에, 첫 비행 거리를 그대로 runM 으로 잡으면
      //    실제로는 세 배 가까이 날아간다(펀칭 지시 30m → 실측 76m, 최대 96m — 피치를 가로지른다).
      //    그래서 비행 구간은 전체의 일부만 담당하게 나눠 준다.
      const Dfly=D/AERIAL_ROLLOUT;
      const T=clamp(Dfly*2.6, 0.6, 1.8);
      b.vz=GRAVITY*T/2; b.vx=Math.cos(ang)*Dfly/T; b.vy=Math.sin(ang)*Dfly/T; b.z=0.0008;
    } else {                                     // 잔디 위를 구른다 — 마찰로 D 만큼 가서 멈춘다
      const v0=D*(1-PASS_LAUNCH_F)/SIM_DT;
      b.vx=Math.cos(ang)*v0; b.vy=Math.sin(ang)*v0; b.z=0; b.vz=0;
    }
    b.inNet=false; b.bounced=0;
    b.looseT=0; b.looseBy=byside; b.aerial=!!aerial;
    b.ownerId=null; b.toId=null; b.isCross=false; b.offsideAt=null; b.setPiece=null;
    this.lastTouch=byside;
  }
  /* 굴러가는 공 — 마찰로 느려지고, 가까이 온 선수가 잡거나, 멈추면 가장 가까운 선수에게 간다.
     굴러가다 라인을 넘으면 그 자리에서 아웃 판정(코너킥·스로인·골킥)이 난다. */
  /* 🏃 흐른 공 경주 — 공이 <b>구르는 동안</b> 양 팀에서 한 명씩 붙인다.
     ⚠ 제보 원문 — 「수비진이 뒤로 빠지는 공을 가만히 서서 쳐다보고, 상대 공격수가 그 공을
        소유할 때 그제야 뒤늦게 쫓아간다」.
        원인: 흐른 공에 사람을 부르는 코드가 <b>공이 멈춘 뒤에만</b> 돌았다
        (advanceLoose 아래쪽 `sp<LOOSE_STOP` 분기). 구르는 동안에는 아무도 안 불려서
        전원이 평소 대형 목표만 보고 서 있었고, 상대가 주워야 비로소 소유가 바뀌며 반응했다.
        굴절(DEFLECT)이 생기면서 흐른 공 자체가 늘어 더 눈에 띄게 됐다.
     ─ 낙하점 경주(startAerialRace)의 지상판이다. 도착 예상 지점을 0.4초마다 갱신하고,
        이미 쫓는 중이면 <b>목표만</b> 고쳐 준다(반응 지연을 다시 물리면 영영 출발 못 한다). */
  looseRace(){
    const b=this.ball;
    if(b.z>CTRL_Z*1.5) return;                      // 아직 높이 떠 있다 — 낙하점 경주의 몫
    if(this._lrAt!=null && this.t-this._lrAt<0.4) return;
    this._lrAt=this.t;
    const px=clamp01(b.x+(b.vx||0)*LOOSE_LEAD), py=clamp01(b.y+(b.vy||0)*LOOSE_LEAD);
    for(const key of ["h","a"]){
      let best=null, bd=1e9;
      for(const a of this.side(key)){
        if(a._down && a._down>this.t) continue;
        if(a.slot==="GK" && !inBox(a, -a.dir)) continue;      // 키퍼는 자기 박스 안에서만
        let d=HYP((a.x-px)*PITCH_AR, a.y-py);
        d *= (1.30 - lbAnt(a)*0.28) * (1 - clamp(FX(a,"sweepBack"),0,1)*SWEEP_EDGE);
        if(d<bd){ bd=d; best=a; }
      }
      if(!best || bd>0.34) continue;                          // 24m 밖은 불러도 못 간다
      if(best._chase && best._chase.until>this.t){
        best._chase.x=px; best._chase.y=py;                   // 이미 달리는 중 — 목표만 갱신
        best._chase.until=this.t+Math.min(CHASE_MAXT, 2.2);
      } else {
        const delay=(REACT_MIN+(REACT_MAX-REACT_MIN)*(1.15-(best.decSkill||0.6)))*(0.75+Math.random()*0.50);
        best._chase={x:px, y:py, until:this.t+Math.min(CHASE_MAXT,2.2), startAt:this.t+delay};
        best._burstAt=this.t+delay;
      }
    }
  }
  advanceLoose(){
    const b=this.ball;
    b.looseT+=SIM_DT;
    stepBallPhysics(b);
    try{ if(!b.setPiece) this.looseRace(); }catch(e){}
    if(b.x<0 || b.x>1 || b.y<0 || b.y>1){
      if(this.outOfPlay(b.x, b.y, b.looseBy)) return;
      b.x=clamp01(b.x); b.y=clamp01(b.y);
    }
    b.aerial = b.z > 0.004;                                 // 아직 떠 있는가
    const sp=HYP(b.vx, b.vy)*SIM_DT;
    // 머리 위로 뜬 공은 발로 잡을 수 없다
    if(b.z < CTRL_Z && b.looseT>=LOOSE_GRACE && sp<LOOSE_BLOCK_V){
      /* 🦵 이번 틱에 공이 지나간 <b>선분</b>까지의 거리로 잰다 — 빠른 공이 옆을 스치고
         지나가는 것을 놓치지 않는다 (LOOSE_BLOCK_V 주석) */
      const _ax=(b._px!=null?b._px:b.x), _ay=(b._py!=null?b._py:b.y);
      const _sx=(b.x-_ax)*PITCH_AR, _sy=b.y-_ay, _sl=_sx*_sx+_sy*_sy;
      const _segD=(a)=>{
        const px=(a.x-_ax)*PITCH_AR, py=a.y-_ay;
        const u=_sl>1e-12 ? clamp((px*_sx+py*_sy)/_sl, 0, 1) : 0;
        return HYP(px-_sx*u, py-_sy*u);
      };
      let best=null, bd=1e9;
      for(const a of this.agents){
        if(a._down && a._down>this.t) continue;         // 넘어져 있는 선수는 못 잡는다
        if(a._lbMiss && a._lbMiss>this.t) continue;     // 방금 발에 맞고 튄 사람은 곧바로 다시 못 댄다
        let d=_segD(a);
        if(a.slot==="GK") d*=0.75;                      // 박스 안이면 키퍼가 먼저 덮친다
        if(d<bd){ bd=d; best=a; }
      }
      if(best && bd<LOOSE_PICKUP*1.30){
        if(sp<LOOSE_CATCH_V){
          /* 🤼 50:50 — 양 팀이 함께 달려들었으면 가까운 쪽이 그냥 먹지 않는다 (요청) */
          const _cands=this.agents.filter(a=>{
            if(a.slot==="GK") return false;
            if(a._down && a._down>this.t) return false;
            return HYP((a.x-b.x)*PITCH_AR, a.y-b.y) < GDUEL_R;
          });
          const _gd=this.groundDuel(_cands);
          if(_gd) return;
          this.giveTo(best); return;
        }
        /* 🦵 빠른 공 — 통제하거나, 발에 맞고 죽는다. 그냥 지나가지는 않는다. */
        const _fast=clamp((sp-LOOSE_CATCH_V)/(LOOSE_BLOCK_V-LOOSE_CATCH_V), 0, 1);
        const _sk=ftSkill(best, 0.55+_fast*0.55);
        if(Math.random() < clamp(_sk*0.78*(1-_fast*0.82), 0.04, 0.55)){
          this.giveTo(best); return;                    // 발밑에 세웠다
        }
        /* 못 세웠다 — 그래도 몸에 맞아 크게 죽는다. 여기서 세컨볼 다툼이 열린다. */
        b.x=clamp01(best.x + (b.x-best.x)*0.35);
        b.y=clamp01(best.y + (b.y-best.y)*0.35);
        const _ang=Math.atan2(b.vy, b.vx*PITCH_AR) + (Math.random()-0.5)*1.5;
        const _v=HYP(b.vx*PITCH_AR, b.vy)*(0.18+Math.random()*0.20);
        b.vx=Math.cos(_ang)*_v/PITCH_AR; b.vy=Math.sin(_ang)*_v;
        b.vz=Math.abs(b.vz||0)*0.30;
        b.looseBy=best.side; this.lastTouch=best.side;   // 마지막 터치는 이 사람이다
        best._lbMiss=this.t+0.45;
        return;
      }
    }
    if((sp<LOOSE_STOP && b.z<=0) || b.looseT>LOOSE_MAXT){   // 공이 멈췄다
      b.aerial=false; b.z=0; b.vx=0; b.vy=0; b.vz=0;
      let best=null, bd=1e9;
      for(const a of this.agents){
        if(a._down && a._down>this.t) continue;
        const d=HYP((a.x-b.x)*PITCH_AR, a.y-b.y);
        if(d<bd){ bd=d; best=a; }
      }
      if(!best){ this.goalKick(this.opp(b.looseBy)); return; }
      if(bd<LOOSE_PICKUP*1.8){ this.giveTo(best); return; }
      // 아직 멀다 — 순간이동시키지 않고, 가장 가까운 선수가 달려와 줍게 한다
      best._chase={x:b.x, y:b.y, until:this.t+CHASE_MAXT};
      this.tryBurst(best);
      b.looseT=Math.min(b.looseT, LOOSE_MAXT-0.4);
      if(b.looseT>LOOSE_MAXT*2.6) this.giveTo(best);        // 아주 오래 방치되면 정리
    }
  }
  /* 아무도 소유하지 못한 루즈볼 — 근처에서 가장 가까운 선수가 잡는다 */
  looseBall(near, outChance){
    const b=this.ball;
    const deep=(near.dir>0 ? near.x : 1-near.x) < 0.32;   // 자기 골문 가까이
    let nx, ny;
    if(deep && Math.random()<(outChance==null?0.55:outChance)){
      // 급하게 걷어낸 공이 자기 골라인을 넘어간다 → 상대 코너킥
      nx = near.x - near.dir*(0.10+Math.random()*0.18);
      ny = clamp01(near.y+(Math.random()-0.5)*0.34);
    } else {
      nx = near.x+(Math.random()-0.5)*0.14;
      ny = near.y+(Math.random()-0.5)*0.20;
    }
    // 순간이동시키지 않는다 — 그 방향으로 실제로 굴려 보낸다
    const ang=Math.atan2(ny-b.y, (nx-b.x)*PITCH_AR);
    const runM=HYP((nx-b.x)*PITCH_AR, ny-b.y)*ISO_TO_M;
    this.launchLoose(b.x, b.y, ang, Math.max(3, runM), near.side, false);
  }
  /* 공중볼 경합 — 롱패스가 떨어지는 지점에서 양 팀이 헤딩으로 다툰다 */
  /* 🪤 지금 라인을 걸어 올릴 때인가 */
  trapCheck(key, mine, carrier, T){
    const b=this.ball, dir=mine[0].dir;
    const tr=this._trap;
    if(tr && tr.side===key && this.t < tr.until) return;             // 이미 거는 중
    if(tr && tr.side===key && this.t < tr.t0+TRAP_COOL) return;      // 쿨다운
    if(!carrier || carrier.side===key) return;
    if(b.setPiece || b.foulScene || b.celebrate) return;
    if(b.state!=="SETTLED" && b.state!=="LOOSE") return;             // 이미 날아간 공은 늦었다
    /* 🪤 트랩 빈도 (세부 전술) — 예전에는 <b>라인 지시에 종속</b>돼 있어(높은 라인이 아니면
       아예 안 걸었다) 감독이 빈도를 못 골랐다. 이제 직접 정한다.
         0 안 씀 · 1 가끔 · 2 보통 · 3 자주 · 4 매우 자주 (TAC 스케일 0~2)
       라인이 낮으면 여전히 값이 줄어든다 — 내려앉은 팀의 트랩은 축구적으로 의미가 없다. */
    const trapTac=(T && T.trap!=null) ? T.trap : 1;
    if(trapTac<=0.05) return;                                        // 안 씀
    const lineTac=(T && typeof T.line==="number") ? T.line : 1;
    if(lineTac < 0.55 && trapTac < 1.5) return;                      // 낮은 라인 + 소극적이면 안 건다
    /* 빈도가 낮으면 쿨다운이 길어지고, 높으면 짧아진다 */
    if(tr && tr.side===key && this.t < tr.t0 + TRAP_COOL*(1.75-trapTac*0.55)) return;
    const own = v => dir>0 ? v : 1-v;
    /* 볼이 우리 진영 깊숙이 오면 트랩이 아니라 그냥 막아야 한다 */
    const bOwn=own(b.x);
    if(bOwn < 0.30 || bOwn > 0.72) return;
    /* 우리 최종 수비 라인 */
    const backs=mine.filter(a=>a.slot!=="GK" && (a.defRole===DEF_ROLE.LINE || a.defRole===DEF_ROLE.MARK));
    if(backs.length<3) return;
    let lineOwn=9; for(const a of backs) lineOwn=Math.min(lineOwn, own(a.x));
    /* 잡을 상대가 라인 근처에 있어야 하고, 이미 등 뒤로 넘어간 상대가 있으면 늦었다 */
    const opps=this.side(this.opp(key)).filter(o=>o.slot!=="GK");
    let hasRunner=false;
    for(const o of opps){
      const oOwn=own(o.x);
      if(oOwn < lineOwn - 0.004) return;                             // 이미 뒤에 있다 — 걸면 자살
      if(oOwn < lineOwn + TRAP_NEAR) hasRunner=true;
    }
    if(!hasRunner) return;
    /* 볼 소유자가 앞을 보고 있어야 한다 — 등지고 있으면 찌를 수 없다 */
    if(carrier.face!==undefined){
      const fwd=Math.atan2(0, (dir>0?-1:1));
      let df=carrier.face-fwd; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
      if(Math.abs(df) > Math.PI*0.55) return;
    }
    /* 얼마나 자주 거는가 — 라인 지시와 조직력이 정한다 */
    const fam=clamp((backs.reduce((s,a)=>s+(a.teamFamK||0),0)/backs.length+1.5)/2.5, 0, 1);
    const p = clamp(0.05 + (lineTac-1.05)*0.16 + fam*0.06, 0.03, 0.26);
    if(Math.random() >= p) return;
    /* 건다 — 선수마다 반응이 다르다. 이 어긋남이 곧 성공과 실패를 가른다 */
    let worst=0;
    for(const a of backs){
      const q=clamp(((a.posSkill||0.6)*0.42 + (a.teamwork||0.6)*0.30 + (a.decSkill||0.55)*0.28), 0, 1);
      const lag=TRAP_LAG*(1-q)*(1.35-fam*0.70)*(0.7+Math.random()*0.6);
      a._trapAt=this.t+lag; worst=Math.max(worst, lag);
    }
    this._trap={side:key, t0:this.t, until:this.t+TRAP_HOLD+worst};
    if(this.emitEvents) this.cap(key, ["🪤 수비 라인이 한꺼번에 올라섭니다!",
      "🪤 오프사이드 트랩 — 뒷선이 통째로 전진합니다!"], {});
    this.evl("TRAP", backs[0], {n:backs.length});
  }
  /* 지금 이 선수가 트랩으로 걸어 올라가는 중인가 */
  trapPush(a){
    const tr=this._trap;
    if(!tr || tr.side!==a.side) return 0;
    if(a._trapAt===undefined || this.t < a._trapAt) return 0;         // 아직 반응 못 했다
    if(a.defRole!==DEF_ROLE.LINE && a.defRole!==DEF_ROLE.MARK) return 0;
    /* 「빠르게 올라가 잠깐 버티다 내려온다」.
       ⚠ 예전에는 올라가는 구간만 있고 until 에서 뚝 끊겼다(공백 04) —
          복귀 곡선이 없어 라인 목표가 순간이동으로 제자리를 찾았고,
          선수들은 뛰어 올라갔다가 조깅으로 어슬렁 돌아왔다.
          내려오는 것도 트랩의 일부다 — 그 1.6초가 상대의 진짜 기회다. */
    const up=clamp((this.t-a._trapAt)/TRAP_RISE, 0, 1);
    if(this.t < tr.until){ a._trapDown=0; return up; }
    const down=1-clamp((this.t-tr.until)/TRAP_FALL, 0, 1);
    a._trapDown=1;
    return up*down;
  }
  /* 🤼 땅볼 50:50 — 흐른 공에 양 팀이 함께 달려들었는가. 결말을 반환한다.
     null = 경합 아님(평소대로 가장 가까운 선수가 잡는다) */
  groundDuel(near){
    const b=this.ball;
    if(!near || near.length<2) return null;
    const sides={}; for(const a of near) sides[a.side]=1;
    if(Object.keys(sides).length<2) return null;              // 같은 팀끼리면 경합이 아니다
    let bd=1e9; for(const a of near) bd=Math.min(bd, HYP((a.x-b.x)*PITCH_AR, a.y-b.y));
    const sc=(a)=>{
      const d=HYP((a.x-b.x)*PITCH_AR, a.y-b.y);
      const closer=clamp(1-(d-bd)/GDUEL_R, 0.15, 1);          // 먼저 닿는 쪽이 유리하다
      const A=(k)=>(a.p&&a.p.attr&&attr20(a.p.attr[k])/20)||0.6;
      const mass=clamp(((a.body&&a.body.tall)||0)*0.5+0.5, 0.3, 1.1);   // 큰 선수가 몸으로 이긴다
      const v=(a.strength||0.6)*0.34 + (a.bravery||0.6)*0.22
            + (a.posSkill||0.6)*0.18 + (a.ftSkill||a.firSkill||0.6)*0.12
            + A("agg")*0.14;
      return v*(0.62+mass*0.38)*closer*(0.55+Math.random()*0.90);
    };
    let win=null, ws=-1, lose=null, ls=-1;
    for(const a of near){ const s=sc(a); if(s>ws){ ls=ws; lose=win; ws=s; win=a; } else if(s>ls){ ls=s; lose=a; } }
    if(!win) return null;
    if(lose && lose.side===win.side) lose=near.find(a=>a.side!==win.side)||lose;
    /* 🤜 땅볼 경합 — 어깨가 부딪히는 순간 (요청) */
    try{ this.jitter(near, 0.85); }catch(e){}
    try{ for(const a of near){ const st=this.stats[a.side]; st.duel=(st.duel||0)+1; } }catch(e){}
    try{ const st=this.stats[win.side]; st.duelWon=(st.duelWon||0)+1; }catch(e){}
    /* ③ 파울 — 밀리는 쪽이 발을 넣는다. 공격성이 높을수록 자주 (박스 안에서는 훨씬 조심한다) */
    const AG=(a)=>((a&&a.p&&a.p.attr&&attr20(a.p.attr.agg)/20)||0.6);
    /* 자기 진영 박스 근처에서는 함부로 발을 넣지 않는다 — PK 를 내주니까 (공중볼 경합과 같은 잣대) */
    const boxK = (lose && ((lose.dir>0?lose.x:1-lose.x) < 0.16)) ? 0.30 : 1;
    if(lose && Math.random() < GDUEL_FOUL*(0.55+AG(lose)*0.90)*boxK*meTune("foul")){
      this.stats[lose.side].foul++; this.stats[win.side].freeKick++; if(typeof FOUL_LOG!=="undefined"&&FOUL_LOG)FOUL_LOG["gduel"]=(FOUL_LOG["gduel"]||0)+1;
      this.cap(lose.side, ["🤼 {p}, 몸싸움에서 밀리자 발을 넣습니다 — 반칙",
                           "🤼 50:50 경합 — {p}의 반칙입니다"], {p:this.nm(lose)});
      this.startFoulScene(lose, win, false, (lose.dir>0?lose.x:1-lose.x)<0.34);
      return {kind:"foul"};
    }
    /* ② 아무도 못 잡는다 — 두 몸에 맞고 공이 엉뚱한 데로 튄다 */
    if(Math.random() < GDUEL_LOOSE){
      const ang=Math.random()*Math.PI*2;
      this.launchLoose(b.x, b.y, ang, 4+Math.random()*7, win.side, false);
      b.looseT=0;
      if(this.emitEvents && Math.random()<0.35)
        this.cap(win.side, ["🤼 두 선수가 부딪히며 공이 흘러나갑니다","🤼 격렬한 경합 — 공이 엉뚱한 곳으로 튑니다"], {});
      return {kind:"loose"};
    }
    /* ① 이긴 쪽이 잡는다 */
    if(this.emitEvents && Math.random()<0.30)
      this.cap(win.side, ["🤼 {p}, 몸싸움에서 이겨 공을 지켜냅니다","🤼 {p}이/가 어깨싸움에서 앞섭니다"], {p:this.nm(win)});
    this.giveTo(win);
    /* 진 선수는 잠깐 균형을 잃는다 — 곧바로 다시 달려들지 못한다 */
    if(lose) lose._beaten=Math.max(lose._beaten||0, this.t+0.35+Math.random()*0.35);
    return {kind:"win", by:win};
  }
  /* 🌦️ 날씨 해설 — 분이 바뀔 때마다 낮은 확률로 한 줄. 험한 날씨일수록 자주 나온다 (요청) */
  wxTalk(){
    try{
      if(!this.recording || !this.emitEvents) return;
      const w=this.M&&this.M.wx; if(!w) return;
      const m=Math.floor(this.clock/60);
      if(m===this._wxMin) return; this._wxMin=m;
      const pool={rain:COMM.wxRain, storm:COMM.wxStorm, snow:COMM.wxSnow,
                  hot:COMM.wxHot, cold:COMM.wxCold, windy:COMM.wxWind}[w.k];
      if(!pool) return;
      /* 험한 날씨일수록 자주 — 폭우·눈은 4분에 한 번꼴, 흐린 날은 아예 안 나온다 */
      const sev=Math.max(w.wet, w.slip, Math.abs(w.heat), w.wind*0.8);
      if(Math.random() > 0.055*sev*(1+sev)) return;
      const b=this.ball;
      if(b.celebrate || b.foulScene) return;
      this.cap(null, pool, {});
    }catch(e){}
  }
  aerialDuel(){
    const b=this.ball;
    const atkSide = b._passer ? b._passer.side : null;
    const setPieceBall = !!(b._spBall || b.isCross);
    /* 🥾 키퍼가 하늘로 띄운 긴 공(골킥·롱킥) — 체공 시간이 길어 커버 수비수도 낙하점에 닿는다.
       경합 반경을 넓혀 「혼자 주워 단독 찬스」가 아니라 헤딩 다툼이 되게 한다 (제보). */
    const gkBall = !!(b._passer && b._passer.slot==="GK" && b.aerial);
    const _R = AERIAL_RANGE*(gkBall ? 1.9 : 1);
    const near=this.agents.filter(a=>a.slot!=="GK" && a._down!==undefined ? (!a._down || a._down<=this.t) : true)
      // 큰 선수는 조금 더 멀리서도 머리를 갖다 댄다 — 도달 반경에 신장을 반영한다
      .filter(a=>HYP((a.x-b.x)*PITCH_AR, a.y-b.y) < _R*(1+((a.body&&a.body.tall)||0)*0.10));
    if(near.length<2) return null;
    let best=null, bs=-1;
    for(const a of near){
      // 대담성이 낮으면 50:50 공중볼에서 몸을 사린다 — 경합 자체를 덜 한다
      if((a.bravery||0.6) < 0.45 && Math.random() > 0.35+(a.bravery||0.6)) continue;
      /* 경합 승부 — 점프 거리·헤딩(headSkill)이 축이고, 낙하 지점 선점(aerialPos)이 더해진다.
         ⚡ 세트피스·크로스에서는 올라오는 공을 보고 미리 뛰는 공격 측이 유리하다 —
            수비는 마크하며 반응하는 쪽이라 첫 접촉을 내주는 일이 잦다.
            (제보 — PL 기준 수비수 득점이 전체의 10~15%, 헤더골 중 30~40%인데 우리는 0이었다) */
      let sc=(a.headSkill*0.78 + (a.aerialPos||0.6)*0.22)*(0.60+(a.bravery||0.6)*0.20)*(0.6+Math.random()*0.8);
      /* 💪 몸싸움 — 내 점수를 올리는 힘이 아니라 <b>상대의 점프를 깎는</b> 힘이다.
         ⚠ 여태 str 은 headSkill 안에 0.16 가중으로만 들어 있었다(내 점수를 더하는 쪽).
            실제 공중 경합에서 힘은 「뛰어오르기 전에 상대를 밀어 중심을 무너뜨리는」 것이라
            <b>상대적</b>이어야 한다. 나보다 센 상대가 붙으면 내 도달 자체가 깎인다.
         상한 ±28% — 힘만으로 헤더를 이기지는 못한다. 점프 거리와 헤딩이 여전히 축이다. */
      {
        let oppStr=0;
        for(const q of near) if(q.side!==a.side) oppStr=Math.max(oppStr, q.strength||0.6);
        if(oppStr>0) sc *= 1 + clamp(((a.strength||0.6)-oppStr)*0.55, -0.28, 0.28);
      }
      if(atkSide && a.side===atkSide) sc *= setPieceBall ? 1.55 : (gkBall ? 0.90 : 1.12);
      if(sc>bs){ bs=sc; best=a; }
    }
    if(!best) best=near[0];
    /* 🦘 공중 경합 — 붙은 선수들이 실제로 뛴다. 이긴 쪽이 조금 더 높이 뜬다 (요청) */
    for(const a of near){
      a._jt0=this.t + Math.random()*0.06;
      a._jdur=JUMP_DUR*(0.88+Math.random()*0.20);
      a._jh=(a===best?1.0:0.78)*(0.80+((a.jump||0.6)*0.40));
    }
    /* 🤜 공중 경합 — 몸이 부딪히는 순간. 붙은 전원이 흔들린다 (요청) */
    try{ if(near.length>=2) this.jitter(near, 1.0); }catch(e){}
    for(const a of near) this.stats[a.side].aerial++;
    if(best){ this.stats[best.side].aerialWon++; this.cap(best.side, COMM.lvAerial, {p:this.nm(best)}); }
    // 공중볼은 몸이 부딪히는 경합이라 파울이 잦다 — 진 쪽이 밀거나 팔을 쓴다
    /* §19~21 박스 안 공중 경합은 대부분 정상적인 몸싸움이다 — 밀침이 명백할 때만.
       ⚠ 이 랜덤 경로가 크로스·코너마다 PK 를 만들던 주범(45분 3개). */
    const aerBoxK = (best && inBox(best, best.dir)) ? 0.22 : 1;
    if(best && near.length>=2 && Math.random()<AERIAL_FOUL_P*aerBoxK*meTune("foul")){
      // 경고 받은 선수는 공중볼에서도 몸을 사린다 — 경고누적 퇴장이 쏟아지지 않게
      const losers=near.filter(a=>a.side!==best.side && ((a.yellows||0)===0 || Math.random()<BOOKED_CAUTION));
      if(losers.length){
        let fo=losers[Math.floor(Math.random()*losers.length)], vic=best;
        /* §36 박스 안 경합 — 실제 심판은 대부분 「공격자 파울」로 분다(민 쪽이 공격수).
           ⚠ 진 쪽=파울로만 두면 크로스마다 PK 가 나온다(45분 3개의 주범). */
        if(inBox(vic, vic.dir) && Math.random()<0.72){
          const atkNear=near.filter(a=>a.side===best.side);
          if(atkNear.length && fo.side!==best.side){ vic=fo; fo=atkNear[0]; }
        }
        this.stats[fo.side].foul++; this.stats[vic.side].freeKick++; if(typeof FOUL_LOG!=="undefined"&&FOUL_LOG)FOUL_LOG["aerial"]=(FOUL_LOG["aerial"]||0)+1;
        this.cap(fo.side,
          (fo.side===atkSide||fo.side===best.side&&vic.side!==best.side)
            ? ["🙅 공격자 파울 — {p}, 밀면서 자리를 잡았습니다","🙅 {p}의 파울 — 팔로 밀어냈습니다. 수비 프리킥"]
            : ["✋ 공중볼 반칙 — {p}, 상대를 밀었습니다"],
          {p:this.nm(fo)});
        this.startFoulScene(fo, vic, false, (fo.dir>0?fo.x:1-fo.x)<0.34);
        return null;
      }
    }
    return best;
  }
  /* 한 틱 진행 + 녹화.
     ⚠ tickCore 안에는 조기 return 이 여섯 군데 있다(세리머니·반칙·슛 비행·흐른 공·킥오프·세트피스).
        녹화를 그 안쪽 맨 아래에 두면 정작 보여줘야 할 장면 — 날아가는 슛, 키퍼 선방, 골대 맞고
        튀는 공, 골 세리머니 — 이 전부 녹화에서 빠진다. 그래서 바깥에서 감싸 무조건 남긴다. */
  tick(){
    /* 🌦️ 전역 물리 함수(stepBallPhysics·firstTouch 등)는 시뮬 인스턴스를 모른다 —
       이 시뮬의 날씨를 매 틱 실어 준다. AI 경기와 내 경기가 섞여 돌아도 안 어긋난다. */
    WX_NOW = (this.M && this.M.wx) ? this.M.wx : {k:"clear", wet:0, slip:0, heat:0, wind:0, wdir:0};
    SQ_GEN++;
    this.halfTimeCheck();
    this.reapGhosts();                 // ⚠ 제보(투명 키커) — 나간 선수가 경기에 남지 않게 매 틱 확인
    this.injuryCheck(); this.processHurt(); this.tickCore(); this.recordFrame();
    this.wxTalk();                      // 🌦️ 날씨 해설 (요청)
    this.drainStamina();
    this.subCheck();
    this.syncGuard();
    /* 🕸️ 패스맵 표본 — 1초(5틱)에 한 번이면 90분에 5,400점이라 충분하다 */
    if((this._pmTick=(this._pmTick||0)+1) % 5 === 0) this.pmSample();
    this.momTick();                    // 📈 경기 모멘텀 (요청)
  }
  /* 🛟 그라운드 인원과 도트 수가 어긋나면 그 자리에서 맞춘다.
     ⚠ 제보 — 「부상 교체를 했는데 들어온 선수가 엉뚱한 데 있다」.
        교체 동기화(resyncSquads)가 subCheck 안에 있었는데, 그 함수는 `m<45` 에서 곧바로
        돌아 나간다. 즉 전반에 일어난 교체는 후반이 될 때까지 그라운드에 반영되지 않았다.
        부상 교체는 전반에도 얼마든지 일어난다. */
  syncGuard(){
    try{
      const need=onPitch(this.M.h).length+onPitch(this.M.a).length;
      if(this.agents.length!==need) this.resyncSquads();
    }catch(e){}
  }
  /* 상대 벤치도 경기를 본다 — 분이 바뀔 때마다 한 번씩 교체를 검토한다.
     이게 없던 시절 2D 엔진에서는 AI가 90분 내내 한 명도 바꾸지 않았다. */
  subCheck(){
    const m=Math.floor(this.clock/60);
    if(this._subMin===m) return;
    this._subMin=m;
    /* 교체가 있었으면 시각과 상관없이 즉시 반영한다 (전반 부상 교체 포함) */
    const q=(this.M.subQueue||[]).length;
    if(q!==this._subSynced){ this._subSynced=q; this.resyncSquads(); }
    /* 🚑 부상으로 빈 자리는 전반이든 후반이든 즉시 채운다 */
    try{ aiFillGaps(this.M); }catch(e){}
    if((this.M.subQueue||[]).length!==this._subSynced){ this._subSynced=(this.M.subQueue||[]).length; this.resyncSquads(); }
    /* ⏱️ 하프타임 전에는 교체하지 않는다 — 추가시간도 아직 전반이다(제보).
       (부상으로 빈 자리를 메우는 처리는 위에서 이미 끝냈다) */
    if(this.clock < this.htSec) return;
    this.syncClock();
    aiSubs(this.M, m);
    if((this.M.subQueue||[]).length!==this._subSynced){ this._subSynced=(this.M.subQueue||[]).length; this.resyncSquads(); }
  }
  /* ── 체력 소모 ────────────────────────────────────────────────
     예전에는 분 단위 엔진(stepMinute)에서만 체력을 깎았다. 그래서 감독이 직접 보는 경기,
     즉 연속 2D 엔진으로 치르는 경기에서는 후반이 되어도 전원 체력 100 이었다.
     여기서는 "얼마나 뛰었는가"를 실제로 센다 — 많이 뛴 선수가 더 지친다. */
  drainStamina(){
    // 매 틱 이동 거리를 쌓아 둔다 (스프린트한 선수가 더 많이 지치게)
    for(const a of this.agents){
      const d=HYP((a.x-(a._fx!=null?a._fx:a.x))*PITCH_AR, a.y-(a._fy!=null?a._fy:a.y));
      a._work=(a._work||0)+d;
      a._fx=a.x; a._fy=a.y;
    }
    const m=Math.floor(this.clock/60);
    if(this._fitMin===undefined){ this._fitMin=m; return; }
    if(m<=this._fitMin) return;
    const mins=m-this._fitMin; this._fitMin=m;
    for(const [key, sd] of [["h",this.M.h],["a",this.M.a]]){
      const cf=condFactor(sd.team);
      for(const x of onPitch(sd)){
        const a=this.agents.find(q=>q.id===x.p.id);
        /* 평균적인 1분 이동량을 1.0으로 본다 — 그보다 많이 뛰었으면 그만큼 더 지친다.
           ⚠ 제보 원문 — 「압박을 조금이라도 높이면 체력이 확확 깎여서 압박하는 전술을 못 쓸 정도」.
           실측(90분 · 같은 시드): 분당 소모 압박0 0.31 · 압박2 0.53 · 압박4 0.68 →
              종료 평균 체력 71 / 58 / 45, 압박 4 는 <b>전원이 66 미만</b>에 최저 25(바닥)였다.
           원인은 이동량 자체가 아니다 — 총 이동거리는 10.2km 대 9.9km 로 오히려 비슷했다.
              로우블록은 몇 명만 뛰고 나머지가 하한(0.55)에 붙는데, 압박은 <b>전원이 중간값</b>을
              받아 팀 평균 배수가 통째로 올라간다. 구조는 맞지만 폭(0.55~1.45 · 2.6배)이 과했다.
           ─ 폭을 좁히고(0.68~1.28) 완만한 곡선을 씌워 극단을 눌렀다. 압박이 여전히 더 비싸되,
             90분을 버틸 수는 있는 선택이 된다. */
        const _wRaw = a ? (a._work||0)/(STAM_REF_RUN*mins) : 1;
        const work = Math.pow(clamp(_wRaw, 0.68, 1.28), 0.72);
        if(a) a._work=0;
        // 타고난 체력(nat)·지구력(sta)이 좋으면 덜 지친다
        /* 🔋 ⚠ 배선 정정 — <b>두 능력치의 역할이 뒤집혀 있었다.</b>
           이 엔진의 다른 주석조차 「90분을 버티는 힘은 지구력이고, 다음 날 아침의 몸 상태는
           타고난 체력이 가른다」고 써 놓았는데, 정작 <b>경기 중 소모</b>에서 타고난 체력(0.026)이
           지구력(0.014)보다 두 배 무거웠다. 그래서 지구력을 올려도 90분이 안 버텨졌다.
           ─ 경기 중은 지구력이 주역(0.026), 타고난 체력은 보조(0.012)로 뒤집는다.
             회복 쪽(recoverMul)은 이미 타고난 체력만 본다 — 그게 맞는 배선이다.
           하한도 0.72 → 0.66 으로 열어 지구력 특급이 확실히 버티게 한다. */
        let natK = x.p.attr ? clamp(1.24 - (attr20(x.p.attr.sta)-10)*0.026 - (attr20(x.p.attr.nat)-10)*0.012, 0.66, 1.26) : 1;
        /* 💪 지구력은 「많이 뛴 날」에 값어치를 해야 한다 — 압박 전술을 스쿼드로 감당하는 길.
           평균 이상으로 뛴 만큼만 적용되므로, 서 있는 선수에게는 아무 차이가 없다. */
        if(work>1 && x.p.attr){
          const _sta=clamp(attr20(x.p.attr.sta)/20, 0.15, 1);
          natK *= 1 - (work-1)*(_sta-0.55)*0.95;
        }
        /* 🧤 골키퍼는 90분 내내 뛰어다니지 않는다 — 같은 시간을 소화해도 훨씬 덜 지친다.
           이동량(work)에 하한(0.55)이 걸려 있어 실제 활동량 차이가 다 반영되지 못했다. */
        const gkK = (x.p.pos==="GK" || x.slot==="GK") ? GK_STAM_K : 1;
        /* 🔥 폭염 — 소모가 가속된다. 추우면 조금 덜 지치지만 몸이 굳는다(가속 저하로 따로 반영) */
        const wxK = 1 + clamp(WX_NOW.heat||0, -1, 1)*0.26;
        const drop = (STAM_PER_MIN*cf + Math.random()*0.10) * work * natK * ageWearK(x.p) * gkK * wxK * mins;
        x.fit=Math.max(25, x.fit - drop);
      }
    }
    this.syncStamina();
  }
  /* 🔋 그라운드 위 선수의 남은 체력을 에이전트에 실어 나른다 —
     속도·정확도·판단·부상 위험이 전부 이 값을 읽는다. */
  syncStamina(){
    for(const a of this.agents){
      const x=this.entryOf(a);
      a.stam = (x && x.fit!=null) ? clamp(x.fit/100, 0.20, 1) : 1;
    }
  }
  /* 전반이 끝나면 진영을 바꾸고 후반 킥오프. 공이 살아 있는 도중에 자르면 어색하므로
     플레이가 끊긴 순간을 기다리되, 30초 넘게 안 끊기면 그냥 끊는다. */
  halfTimeCheck(){
    if(this._endsSwapped) return;
    /* ⏱️ ⚠ 제보 — 「전반 추가시간이 되면 갑자기 진영이 바뀌고 상대 감독이 교체를 한다」.
       하프타임 판정이 45:00(SIM_SECONDS/2)만 보고 있었다. 추가시간을 도입하면서
       전반 종료는 htSec(45분 + 전반 추가시간)으로 바뀌었는데 여기만 옛 기준으로 남아,
       45분을 넘기는 순간 전반이 아직 진행 중인데도 진영을 바꾸고 후반 킥오프를 했다. */
    if(this.clock < this.htSec) return;
    const b=this.ball;
    const settled = !b.celebrate && !b.foulScene && !b.setPiece && b.state!=="SHOT";
    if(!settled && this.clock < this.htSec + 30) return;
    this._endsSwapped=true;
    this.switchEnds();
    this.kickoff(this.firstKickSide==="h" ? "a" : "h");   // 후반은 반대 팀이 찬다
  }
  tickCore(){
    const b=this.ball;
    /* 🛟 소유 감시 — 같은 선수가 세트피스도 아닌데 30초 넘게 공을 쥐고 있으면 흘린 공으로 돌린다.
       (실측 seed 1·2: 버팀 반경 확대 뒤 「운반 목표가 반경 안」·「수신자 정지」로 40분 소유가 두 번 나왔다.
        근본 원인은 각각 고쳤고 이건 안전망이다 — 발동하면 이벤트 로그 STALL 로 남는다) */
    if(b.state==="SETTLED" && b.ownerId!=null && !b.setPiece && !b.celebrate && !b.foulScene){
      if(b._ownWatchId!==b.ownerId){ b._ownWatchId=b.ownerId; b._ownWatchT=this.t; }
      else if(this.t-b._ownWatchT>30){
        const _o=this.byId(b.ownerId);
        this.evl("STALL", _o||null, {k:"HOLD"});
        b._ownWatchT=this.t;
        b.state="LOOSE"; b.looseT=0; b.looseBy=_o?_o.side:this.possSide; b.ownerId=null; b._rollOwner=null; b._loc=null; b._knock=null;
        b.vx=(Math.random()-0.5)*0.02; b.vy=(Math.random()-0.5)*0.02;
      }
    } else b._ownWatchId=null;
    this.checkMatchRules();                // 지금 경기가 어떤 상태인가
    this.cpWatch();                        // ⚡ 방금 뺏겼는가 — 카운터프레스 창
    if(b.celebrate){                       // 세리머니 중에는 경기가 멈춘다
      this.advanceCelebration();
      this.stats.ticks++; this.t+=SIM_DT;
      return;
    }
    if(b.foulScene){                       // 반칙 장면 — 심판이 다가가 판정할 때까지 멈춘다
      this.advanceFoulScene();
      this.stats.ticks++; this.t+=SIM_DT;
      return;
    }
    /* §39 어드밴티지 창 — 이점이 사라지면(소유 상실) 원래 파울로 되돌아온다 */
    if(this._adv){
      const A=this._adv;
      if(b.celebrate || b.state==="SHOT"){ this._adv=null; }          // 이점 실현 — 플레이 온
      else if(this.t>A.until){ this._adv=null; }                       // 창 종료 — 플레이 온
      else if(this.possSide && this.possSide!==A.side){                // 이점 소멸 — 되돌린다
        const fo=this.byId(A.foulerId), vi=this.byId(A.victimId);
        this._adv=null;
        if(fo && vi){
          this.stats[fo.side].foul++; this.stats[vi.side].freeKick++;
          this.cap(fo.side, ["🔙 어드밴티지 무산 — 원래 반칙 지점으로 돌아갑니다"], {});
          vi.x=clamp01(A.spot.x); vi.y=clamp01(A.spot.y);              // 스팟 기준 재개
          this.startFoulScene(fo, vi, A.slide, A.danger, A.ev);
          this.stats.ticks++; this.t+=SIM_DT; return;
        }
      }
    }
    this.updateBallControlState();
    this.moveReferee();
    this.moveAgents();
    this.boxPrep();          // 🏃 크로스가 날아오기 <b>전에</b> 박스로 들어간다
    /* 🎚️ 속도 평활 갱신 — 이동이 끝난 직후 한 번. 판단(decide)은 이 아래에서 돌므로
       같은 틱의 최신 값을 본다. 선수당 숫자 두 개, 곱셈 두 번이면 된다. */
    for(const _a of this.agents){
      _a._vxS = (_a._vxS===undefined?0:_a._vxS)*(1-V_SMOOTH) + (_a.vx||0)*V_SMOOTH;
      _a._vyS = (_a._vyS===undefined?0:_a._vyS)*(1-V_SMOOTH) + (_a.vy||0)*V_SMOOTH;
    }
    if(b.state==="SHOT"){ this.advanceShot(); this.stats[this.possSide].poss++; this.stats.ticks++; this.t+=SIM_DT; return; }
    if(b.state==="LOOSE"){ this.advanceLoose(); this.stats[this.possSide].poss++; this.stats.ticks++; this.t+=SIM_DT; return; }
    if(b.state==="SETTLED"){
      /* ⚠ 제보의 진짜 원인 — 「PK 때 아무도 없는데 투명 선수가 찬다」.
         예전에는 공 주인이 없으면(키커가 교체·퇴장으로 빠지면) 곧바로 kickoff() 로 리셋했다.
         그러면 세트피스가 통째로 사라지고, 그런데 b.isPenalty 플래그는 남아서
         센터스팟에서 공을 잡은 선수가 그 자리에서 「페널티킥」을 차 버렸다.
         세트피스가 걸려 있으면 먼저 세리머니를 진행시킨다 — 거기서 키커를 다시 세운다. */
      if(b.setPiece){ this.advanceSetPiece(); this.stats[this.possSide].poss++; this.stats.ticks++; this.t+=SIM_DT; return; }
      const carrier=this.byId(b.ownerId);
      if(!carrier){ this.kickoff(this.possSide); return; }
      /* 🚩 몰고 나갔다 — 소유 중이라도 공 중심이 라인을 완전히 넘었으면 아웃이다.
         ⚠ 규칙 감사 — 아웃 판정(outOfPlay)이 <b>패스와 루즈볼에만</b> 걸려 있었다.
            드리블로 라인을 넘어간 공에는 아무 일도 일어나지 않는다. 선수 좌표는 회수·스로인
            동작 때문에 라인 밖 2~3.4m 까지 허용되고, 공은 그대로 따라 나간다.
            실측: 경기당 <b>37틱(7.5초)</b> 동안 공이 라인 밖에 있는데 경기가 계속됐다(최대 0.84m).
            측면에서 캐리어가 라인에 붙어 버티는 그림도 여기서 나온다. */
      /* ⚠ 스로인은 <b>규칙상 라인 밖</b>에서 던진다 — 던지는 선수가 공을 들고 서 있는
         동안(isThrow) 공은 정당하게 라인 밖에 있다. 이걸 빼먹으면 스로인이 스로인을
         부르는 무한 루프가 된다(실측: 경기당 스로인 1,419회). */
      if(!b.foulScene && !b.celebrate && !b.isThrow){
        const _oX=(b.x<0?-b.x:(b.x>1?b.x-1:0))*PITCH_AR*ISO_TO_M;
        const _oY=(b.y<0?-b.y:(b.y>1?b.y-1:0))*ISO_TO_M;
        if(Math.max(_oX,_oY)>0.20 && this.outOfPlay(b.x, b.y, carrier.side)){
          this.stats[this.possSide].poss++; this.stats.ticks++; this.t+=SIM_DT; return;
        }
      }
      this.rollBall(carrier);
      if(!this.tryTackle(carrier)){
        b.hold-=SIM_DT;
        if(b.hold<=0) this.decide(carrier);
        /* 🧤 키퍼 6초 규정 — 실제 규칙이기도 하고, 「공을 잡고 서 있기만 하는」 상태를 끊는 장치다.
           판단이 막혀 아무것도 못 하는 키퍼가 공을 안고 몇십 초를 버티는 일을 막는다. */
        if(carrier.slot==="GK"){
          carrier._gkHold=(carrier._gkHold||0)+SIM_DT;
          if(carrier._gkHold>6 && b.ownerId===carrier.id){
            carrier._gkHold=0;
            try{ this.goalKickLong ? this.goalKickLong(carrier) : this.clearBall(carrier); }catch(e){ try{ this.clearBall(carrier); }catch(_){} }
          }
        } else if(carrier._gkHold) carrier._gkHold=0;
      }
    } else if(b.state==="PASS"){
      this.advancePass();
    }
    // 통계
    this.stats[this.possSide].poss++;
    this.stats.ticks++;
    const zx = this.possSide==="h" ? b.x : 1-b.x;   // 소유팀 기준 공격 방향으로 정규화
    if(zx<1/3) this.stats.thirds.def++; else if(zx<2/3) this.stats.thirds.mid++; else this.stats.thirds.att++;
    /* 팀별로도 남긴다 — 「우리가 공을 잡고 어디까지 올라갔는가」는 합산값으로는 알 수 없다 */
    const _zs=this.stats[this.possSide];
    if(zx<1/3) _zs.z1++; else if(zx<2/3) _zs.z2++; else _zs.z3++;
    this.t+=SIM_DT;
  }
  /* 전광판에 찍히는 경기 시간 — 시뮬레이션 시간과 분리돼 있다 */
  get clock(){ return this.t*MATCH_CLOCK_SCALE; }
  /* ⏱️ 구간 경계 — 추가시간이 붙는 만큼 뒤로 밀린다 */
  get htSec(){ return SIM_SECONDS/2 + (this._a1||0); }                       // 전반 종료
  get ftSec(){ return SIM_SECONDS + (this._a1||0) + (this._a2||0); }         // 후반(정규) 종료
  get et1Sec(){ return this.ftSec + ET_SECONDS/2 + (this._a3||0); }          // 연장 전반 종료
  get endSec(){ return this.M && this.M.etOn ? this.et1Sec + ET_SECONDS/2 + (this._a4||0) : this.ftSec; }
  /* 그 구간에 시간을 잡아먹은 사건 수 */
  _snapNow(){ const M=this.M, st=(M&&M.st)||{};
    return {g:((M&&M.hg)||0)+((M&&M.ag)||0), s:((M&&M.h.subs)||0)+((M&&M.a.subs)||0),
            y:(st.hY||0)+(st.aY||0), r:(st.hR||0)+(st.aR||0)}; }
  _snapDiff(){ const a=this._psnap||{g:0,s:0,y:0,r:0}, b=this._snapNow();
    return {goal:Math.max(0,b.g-a.g), sub:Math.max(0,b.s-a.s),
            yellow:Math.max(0,b.y-a.y), red:Math.max(0,b.r-a.r), inj:0, pen:0}; }
  /* 매 틱 — 구간이 끝나는 순간 4심이 전광판을 든다 */
  stoppageCheck(){
    const c=this.clock, M=this.M; if(!M) return;
    const raise=(key, period, base, label)=>{
      if(this[key]!=null || c < base) return false;
      this[key]=addTimeCalc(this._snapDiff(), period);
      this._psnap=this._snapNow();
      M[({_a1:"a1",_a2:"a2",_a3:"a3",_a4:"a4"})[key]]=Math.round(this[key]/60);
      /* ⏱️ 게스트 화면도 같은 추가시간을 써야 같은 글자가 나온다 (제보) */
      try{
        if(this.emitEvents && M.opts && M.opts.pvp && typeof PVP!=="undefined" && PVP && PVP.role==="host")
          pvpSend({t:"add", a1:Math.round(this._a1||0), a2:Math.round(this._a2||0), a3:Math.round(this._a3||0)});
      }catch(e){}
      try{
        const mm=Math.max(1,Math.round(this[key]/60));
        const pool = period===1?COMM.addH1 : period===2?COMM.addH2 : COMM.addE;
        this.say(null, F_(pool, Object.assign({m:mm}, refVars(M))), "info", {kind:"add"});
      }catch(e){}
      return true;
    };
    /* ⏱️ 연장 전반이 끝나는 순간 — 진영을 바꾼다 */
    if(M.etOn && this._a3!=null && !this._etHt && c>=this.et1Sec){
      this._etHt=1;
      try{ this.say(null, F_(COMM.etHt, refVars(M))+` <span class="small">${M.home.short} ${M.hg} : ${M.ag} ${M.away.short}</span>`, "info", {kind:"et"}); }catch(e){}
      if(Math.random()<0.6) try{ this.say(null, F_(COMM.etTired, refVars(M)), "info", {kind:"et"}); }catch(e){}
    }
    /* ⚡ 연장에서 터진 골 */
    if(M.etOn){
      const g=(M.hg||0)+(M.ag||0);
      if(this._etG==null) this._etG=g;
      else if(g>this._etG){
        this._etG=g;
        let nm="선수"; try{ const sc=(M.sc||[]).slice(-1)[0]; if(sc&&sc.name) nm=sc.name; }catch(e){}
        try{ this.say(null, F_(COMM.etGoal, Object.assign({p:nm}, refVars(M))), "goal", {kind:"et"}); }catch(e){}
      }
    }
    if(raise("_a1", 1, SIM_SECONDS/2, "전반")) return;
    if(this._a1!=null && raise("_a2", 2, SIM_SECONDS+this._a1, "후반")) return;
    if(M.etOn && this._a2!=null && raise("_a3", 3, this.ftSec+ET_SECONDS/2, "연장 전반")) return;
    if(M.etOn && this._a3!=null && raise("_a4", 4, this.et1Sec+ET_SECONDS/2, "연장 후반")) return;
  }
  /* 90분에 동점이면 연장으로 넘긴다. 넘겼으면 true. */
  tryExtraTime(){
    const M=this.M;
    if(!M || !M.ko || M.etOn) return false;
    if(!koLevel(M)) return false;
    if(this.clock < this.ftSec) return false;
    M.etOn=true;
    try{ this.syncClock(); }catch(e){}
    try{ this.say(null, F_(COMM.etIn, refVars(M))+` <span class="small">(${M.hg}:${M.ag})</span>`, "info", {kind:"et"}); }catch(e){}
    return true;
  }
  /* 🥅 연장까지 동점이면 승부차기 */
  runShootoutIfNeeded(){
    const M=this.M;
    this.settleVar();          // 📺 판독 결과가 동점 여부를 가를 수 있다 — 먼저 매듭짓는다
    if(!M || !M.ko || M.pk || !koLevel(M)) return false;
    /* ⚠ 아직 끝나지 않은 경기에서 부르면 안 된다 — run(짧은 초) 로 일부만 굴릴 때 걸린다 */
    if(this.clock < this.endSec-1) return false;
    return this._runShootout();
  }
  _runShootout(){
    const M=this.M;
    try{
      M.pk=runShootout(M);
      for(const line of pkLines(M, M.pk)) this.say(null, line, "info", {kind:"pk"});
    }catch(e){ M.pk=null; return false; }
    return true;
  }
  /* 🅿️ 진행 중인 반칙 장면·PK·날아가는 슛·세리머니 — 끝날 때까지 휘슬(하프타임·종료)을 미룬다.
     ⚠ 제보 — 「경기 종료 직전에 PK 떴는데 그대로 경기가 끝났다. 리포트에도 "선언됩니다"
       이후 그대로 경기 종료」. 하프타임에는 htHold 로 막아 놓고(전반 추가시간에 차는 그림),
       종료 휘슬 판정(라이브 루프·하이라이트 꼬리·위임 run)은 varPending 만 보고 있었다.
       선언된 PK는 반드시 차고 끝난다 — 성공/실축 멘트도 그때 나온다. */
  pkHold(){
    const b=this.ball;
    return !!(b && (b.foulScene || b.isPenalty || (b.setPiece && b.setPiece.kind==="penalty") || b.state==="SHOT" || b.celebrate));
  }
  /* 🅿️ 지금 「선언된 페널티킥」이 남아 있는가 — 선언부터 공이 발을 떠날 때까지.
     ⚠ 제보 원문 — 「후반 극후반·추가시간에 페널티킥이 주어졌는데 보지 않고 그냥 건너뛰어서
        경기가 종료되는 버그. 페널티킥을 차는 동안은 경기가 종료되지 않게 해 달라」.
     종료 판정을 하는 곳이 여럿이라(라이브 루프·하이라이트 꼬리·위임 run·고정 시간 run)
     한 군데라도 이 판정을 빼먹으면 휘슬이 먼저 울린다. 그래서 종료 자체를 막는다. */
  penPending(){
    const b=this.ball;
    return !!(b && (b.isPenalty || (b.setPiece && b.setPiece.kind==="penalty")));
  }
  run(seconds){
    /* ⚠ 연장에 들어가면 종료 시각이 늘어난다 — 시작할 때 잡아 둔 값을 쓰면 연장을 못 뛴다 */
    const fixedEnd=seconds||0;
    let guard=0;
    /* 🅿️ 제보 — 고정 시간 run(seconds) 에서도 선언된 PK 는 반드시 차고 끝난다 */
    while((this.clock<(fixedEnd||this.endSec) || this.varPending || this.pkHold()) && guard++<200000){
      this.tick();
      // 하프타임 — 해설에 한 줄 남긴다 (실제 경기 모드일 때만)
      if(this.emitEvents) this.stoppageCheck();
      if(this.emitEvents && !this.halfDone && this.clock>=this.htSec){
        this.halfDone=true;
        this.syncClock(); this.syncStats();
        this.say(null, `⏸ 전반 종료 — ${this.M.home.short} ${this.M.hg} : ${this.M.ag} ${this.M.away.short} <span class="small">(${addLabel(45,this._a1||60)})</span>`, "info", {kind:"ht"});
      }
      /* ⏱️ 90분에 닿았는데 녹아웃 동점이면 연장으로 이어 간다 */
      if(this.clock>=SIM_SECONDS && !seconds && this.tryExtraTime()) continue;
    }
    if(this.emitEvents){ if(this.clock>=this.endSec-1) this.runShootoutIfNeeded(); this.finishMatch(); }
    return this.report();
  }
  /* AI 전술 복원 — 경기 중 실시간 조정분을 시즌 기본값으로 되돌린다 */
  restoreAITactics(){
    try{
      for(const k2 of ["h","a"]){
        const base=this._tacBase && this._tacBase[k2]; if(!base) continue;
        const tm=this.rec(k2).team; if(!tm || tm.isUser || !tm.tactic) continue;
        for(const kk of TAC_KEYS) if(base[kk]!=null) tm.tactic[kk]=base[kk];
        if(base.formation) tm.tactic.formation=base.formation;
      }
    }catch(e){}
  }
  /* 경기 종료 — M을 시즌 시스템이 읽을 수 있는 완성된 상태로 만든다 */
  finishMatch(force){
    /* 🅿️ 최후 방어선 — 차지 않은 페널티킥이 남아 있으면 휘슬을 불지 않는다 (제보).
       어느 경로로 들어와도 여기서 한 번 더 막는다. 다만 상태가 꼬여 영영 안 끝나는 일은 없도록
       충분히 큰 상한을 둔다(약 6분치 틱). */
    if(!force && this.penPending() && (this._ftWait=(this._ftWait||0)+1) < 900) return;
    this._ftWait=0;
    this.settleVar();          // 📺 결론 없이 끝나는 판독이 없게 한다 (제보)
    this.restoreAITactics();
    const M=this.M;
    this.syncStats();
    this.pmFinish();          // 🕸️ 패스맵 — 평균 위치·연결 횟수를 M 에 옮겨 담는다
    this.momFinish();         // 📈 경기 모멘텀 — 분당 우세도를 M 에 옮겨 담는다 (요청)
    M.min=Math.floor(this.endSec/60);
    M.half=2; M.done=true;
    // 출전 시간 — 교체가 없으면 전원 풀타임으로 기록된다
    for(const sd of [M.h, M.a]) for(const x of sd.list){ if(x.off===null && !x.red) x.off=null; }
    this.say(null, `🏁 경기 종료 — ${M.home.short} ${M.hg} : ${M.ag} ${M.away.short}`, "info", {kind:"ft"});
  }
  /* 실제 축구 통계와 비교할 수 있는 형태로 뽑는다 */
  report(){
    const s=this.stats, tot=s.ticks||1;
    const per=(k)=>{
      const st=s[k];
      const dirTot=st.fwd+st.lat+st.back||1;
      return {
        pass:st.pass,     /* 시계 1:1 — 축약을 메우려던 ×2 보정을 걷어냈다 */
        acc: st.pass? +(st.passOk/st.pass*100).toFixed(1):0,
        fwdPct:+(st.fwd/dirTot*100).toFixed(1), latPct:+(st.lat/dirTot*100).toFixed(1), backPct:+(st.back/dirTot*100).toFixed(1),
        possPct:+(st.poss/tot*100).toFixed(1),
        intercept:st.intercept, lost:st.lost,
        avgLenM:+(st.passLen/Math.max(1,st.pass)*ISO_TO_M).toFixed(1),
        tackle:st.tackle, tackleWon:st.tackleWon, slide:st.slide, slideWon:st.slideWon,
        foul:st.foul, aerial:st.aerial, aerialWon:st.aerialWon, offside:st.offside,
        throwIn:st.throwIn, corner:st.corner, goalKick:st.goalKick, freeKick:st.freeKick,
        cross:st.cross, crossOk:st.crossOk, crossEarly:st.crossEarly, crossByline:st.crossByline, crossCutback:st.crossCutback,
        toSpace:st.toSpace, avgPower:+(st.powerSum/Math.max(1,st.pass)).toFixed(2), crossFloat:st.crossFloat, crossDriven:st.crossDriven,
        longPct:+(st.longPass/Math.max(1,st.pass)*100).toFixed(1),
        shot:st.shot, shotOn:st.shotOn, shotOff:st.shotOff, shotBlocked:st.shotBlocked,
        shotSaved:st.shotSaved, shotCaught:st.shotCaught, shotParried:st.shotParried,
        shotHeader:st.shotHeader, shotVolley:st.shotVolley, shotFinesse:st.shotFinesse,
        shotChip:st.shotChip, shotPower:st.shotPower, shotPlaced:st.shotPlaced,
        shotClose:st.shotClose, shotNormal:st.shotNormal, shotLong:st.shotLong,
        goal:st.goal, goalDeflected:st.goalDeflected, save:st.save, block:st.block, deflect:st.deflect,
        crossBlocked:st.crossBlocked, shotPunched:st.shotPunched, shotTipped:st.shotTipped, superSave:st.superSave,
        woodwork:st.woodwork, shortPass:st.shortPass, longPassT:st.longPassT,
        yellow:st.yellow, red:st.red, verbal:st.verbal, jostle:st.jostle
      };
    };
    const _ig=(k2)=>{ const a2=this.agents.find(x=>x.side===k2 && x._integ!=null);
                      return a2? +a2._integ.toFixed(2) : null; };
    /* 현재 형태 — 팀 세로 폭을 3등분해 인원 분포로 읽는다. 기본 포메이션과 다를수록
       공격 변형(3-2-5류)이 일어나고 있다는 뜻이다 (Base ≠ Current). */
    const _shape=(k2)=>{
      const ps=this.agents.filter(p2=>p2.side===k2 && p2.slot!=="GK");
      if(!ps.length) return null;
      let mn=9, mx=-9;
      for(const p2 of ps){ const ad=p2.dir>0?p2.x:1-p2.x; if(ad<mn)mn=ad; if(ad>mx)mx=ad; }
      const span=Math.max(0.10, mx-mn);
      let d2=0,m2=0,f2=0;
      for(const p2 of ps){ const r2=((p2.dir>0?p2.x:1-p2.x)-mn)/span;
        if(r2<0.34)d2++; else if(r2<0.67)m2++; else f2++; }
      return d2+"-"+m2+"-"+f2;
    };
    return {
      minutes:+(this.clock/60).toFixed(1),
      integrity:{h:_ig("h"), a:_ig("a")},
      shape:{h:_shape("h"), a:_shape("a")},
      score:{h:this.score.h, a:this.score.a},
      state:this.matchState, sentOff:this.sentOff.slice(),
      h:per("h"), a:per("a"),
      totalPass:(s.h.pass+s.a.pass),     /* 시계 1:1 — ×2 보정 제거 */
      thirds:{ def:+(s.thirds.def/tot*100).toFixed(1), mid:+(s.thirds.mid/tot*100).toFixed(1), att:+(s.thirds.att/tot*100).toFixed(1) }
    };
  }
}

/* 매 프레임 호출되는 단 하나의 그리기 함수. 하이라이트 씬이 없으면 22명이 포메이션 자리에 가만히 서 있는
   정지 화면이고(FM처럼 그동안은 시간만 흐른다), 씬이 재생 중이면 그 씬이 지정한 선수·공은 스크립트된
   경로를 따르고, 나머지 선수들은 PitchAI가 상태(돌파/추격/차단/침투)에 따라 벡터로 움직인다. */
let idleDrawKey=null;                 // 씬이 없을 때 같은 정지 화면을 60fps로 계속 다시 그리지 않기 위한 캐시 키
let refPos={x:0.5,y:0.38};            // 주심의 현재 위치 — 목표 지점으로 매 프레임 조금씩 따라가며 "달려가는" 것처럼 보인다
let lastRefTick=null;                 // 직전 프레임 시각(ms) — 심판 이동 속도를 dt 기반으로 계산하기 위한 기준
let ballTrail=[];                     // 공의 최근 자취(잔상)
const REF_IDLE={x:0.5,y:0.38};
