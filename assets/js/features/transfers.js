"use strict";
/* =====================================================
   이적시장
===================================================== */
function marketValue(p){
  if(p && p.mvFix) return p.mvFix;   // 고정 몸값(해외 시장 지정 선수)
  const age=G.season-p.by;
  let v=mvBase(p.ovr);
  if(age<=21) v*=1.55; else if(age<=23) v*=1.40; else if(age<=27) v*=1.0;
  else if(age<=29) v*=0.80; else if(age<=32) v*=0.55; else v*=0.28;
  // 잠재력이 남은 어린 선수는 웃돈이 붙는다
  if(age<=23 && p.pot>p.ovr) v*=1+Math.min(0.45,(p.pot-p.ovr)*0.035);
  if((p.ct||1)<=1) v*=0.70;                 // 계약 1년 남으면 헐값
  /* 올 시즌 활약 — 같은 능력치라도 "지금 잘하는 선수"에게는 웃돈이 붙는다.
     ⚠ 예전에는 이 항목이 없어서, 리그 득점왕과 벤치 자원의 몸값이 능력치만 같으면 똑같았다. */
  if((p.apps||0)>=8){
    const r=p.seasonRating||0;
    if(r>=7.4) v*=1.30; else if(r>=7.0) v*=1.15; else if(r>0 && r<=6.2) v*=0.85;
    const ga=(p.goals||0)+(p.assists||0);
    if(ga>=15) v*=1.25; else if(ga>=8) v*=1.12;
  }
  return Math.max(0.3, Math.round(v*10)/10);
}
/* ═══════════════════════════════════════════════════════════════
   계약 연장 · 임대
   FM에서 이적시장의 절반은 사고파는 게 아니라 "붙잡는 것"과 "내보내 키우는 것"이다.
     · 계약 연장 — 만료가 다가올수록 선수의 몸값이 떨어지고, 그대로 두면 FA로 잃는다.
     · 임대     — 벤치에서 썩히느니 하부 리그에서 90분을 뛰게 한다. 성장 속도가 달라진다.
   두 시스템 모두 "선수가 받아들일 이유가 있는가"를 계산해서 수락/거절을 정한다.
═══════════════════════════════════════════════════════════════ */
const CT_MAX=5;                      // 최대 계약 연수
const CT_WARN=1;                     // 이 이하로 남으면 경고
const LOAN_MIN_AGE=17, LOAN_MAX_AGE=25;   // 임대로 내보내기 좋은 나이대
/* 계약 만료가 가까울수록 재계약 요구가 세진다. 지금 대우가 시세보다 낮으면 더 세진다. */
const RENEW_LOCK_DAYS=365;   // 재계약 후 다시 협상할 수 있을 때까지
function renewLockLeft(p){
  if(!p || p._renewAt==null) return 0;
  /* ⚠ 제보 — "계약 1년 남은 선수인데 재계약이 21개월 뒤라 붙잡을 방법이 없다".
     잠금은 '연봉을 조금씩 올려 계약을 무한히 늘리는 꼼수'를 막으려고 둔 것이지,
     만료가 코앞인 선수를 FA로 잃게 만들려는 게 아니다. 잔여 1년 이하면 잠금은 풀린다.
     (이 상태에서 재계약해 봐야 이득이 없다 — 어차피 시장가는 이미 바닥이다) */
  if((p.ct||1)<=1) return 0;
  /* ⚠ 제보 — 시즌이 바뀌는 순간(G.season++ 직후, G.day 는 아직 지난 시즌 마지막 날)에 잠금을
     찍으면 (G.day - _renewAt) 이 크게 음수가 되어 700일이 넘는 잠금이 나왔다.
     시즌이 넘어갔으면 경과일은 최소 그 시즌 수만큼으로 보고, 잠금은 원래 기간을 넘지 않는다. */
  const seasons=Math.max(0, G.season-(p._renewS||G.season));
  const days=Math.max(0, (G.day||0)-p._renewAt);
  const gone=seasons*365 + (seasons>0 ? Math.max(0,days) : days);
  const left=Math.min(RENEW_LOCK_DAYS, RENEW_LOCK_DAYS-gone);
  return left>0 ? Math.ceil(left) : 0;
}
function markRenewed(p){ p._renewAt=(G.day||0); p._renewS=G.season; p._renewTry=0; }
/* ⏱️ 올 시즌 이 선수가 실제로 얼마나 뛰었는가 — 0(전혀) ~ 1(붙박이).
   팀이 치른 경기 수를 기준으로 본다. 표본이 모자란 시즌 초에는 판단하지 않는다(null). */
function renewPlayRate(p, t){
  try{
    const gp=(t.W||0)+(t.Dw||0)+(t.L||0);
    if(gp<8) return null;                       // 아직 근거가 없다
    return clamp((p.apps||0)/gp, 0, 1);
  }catch(e){ return null; }
}
function renewAsk(p){
  const t=teamOfPlayer(p)||userTeam();
  const age=G.season-p.by;
  const base=wageExpect(p.ovr, p.frn, t?t.div:1);
  let mul=1.05;
  /* ⚠ 제보 — 「1년 내내 부상으로 못 뛴 선수가 재계약에서 연봉 3배를 부른다」.
     감액 조건이 전부 apps>=8 처럼 「충분히 뛴 경우」에만 걸려 있어서, 아예 못 뛴 선수는
     어떤 감액도 받지 않고 시장 평가를 그대로 불렀다.
     ─ 사람은 「내가 올해 무엇을 했는가」를 안다. 출전 비중을 협상의 근거로 삼는다. */
  const _rate=renewPlayRate(p, t);
  if((p.seasonRating||0)>=7.35 && p.apps>=8) mul+=0.18;      // 잘하고 있으면 값을 올린다
  if((p.seasonRating||0)<=6.50 && p.apps>=8) mul-=0.10;
  if(age<=23) mul+=0.10;                                    // 유망주는 미래값을 받는다
  if(age>=33) mul-=0.18;                                    // 노장은 스스로도 안다
  if((p.ct||1)<=1) mul+=0.12;                               // 만료 임박 — 협상력이 선수에게 있다
  if(p.unhappy>0) mul+=0.10;
  mul += [0, 0.12, -0.05, 0.05][p.pers||0];                 // 야심가는 더 부른다
  /* 출전 비중 보정 — 절반 이상 뛰었으면 그대로, 거의 못 뛰었으면 시장 평가의 절반까지 내려간다 */
  if(_rate!=null) mul *= 0.50 + 0.50*clamp(_rate/0.50, 0, 1);
  /* 지금도 재활 중이면 스스로도 목소리를 낮춘다 */
  if((p.inj||0)>0) mul *= clamp(1 - Math.min(p.inj,20)*0.012, 0.78, 1);
  const market=Math.max(0.4, Math.round(base*clamp(mul,0.42,1.9)*10)/10);
  /* ⚠ 예전에는 요구 연봉을 '시장 평가'만으로 계산했다. 그래서 30억을 주고 데려온 선수를
     그 자리에서 재계약하면 5억짜리 계약서가 나왔다 — 연봉을 세탁하는 구멍이었다.
     사람은 시장가가 아니라 자기 통장을 기준으로 협상한다. 현재 연봉에 하한을 건다. */
  const cur=Math.max(0, p.wage||0);
  let floor=1.00;
  if(age>=33) floor=0.80;                                   // 은퇴가 보이면 삭감을 받아들인다
  else if(age>=31) floor=0.88;
  else if(age<=25) floor=1.08;                              // 아직 오를 일만 남았다
  if((p.seasonRating||0)>=7.35 && p.apps>=8) floor+=0.08;
  if((p.seasonRating||0)<=6.45 && p.apps>=10) floor-=0.10;   // 못 하고 있으면 목소리가 작아진다
  if(playShareKnown() && playShare(p)<0.30 && (p.apps||0)>=5) floor-=0.08;   // 못 뛰는 선수도 마찬가지 (갓 온 선수는 표본이 없다 — 할인 없음)
  /* ⏱️ 뛴 시간이 곧 협상력이다 — 한 시즌을 통째로 날린 선수는 인상을 요구할 명분이 없다.
     0.5(절반 출전) 이상이면 손대지 않고, 거의 못 뛰었으면 현재 연봉에서 삭감까지 받아들인다. */
  if(_rate!=null) floor -= 0.30*(1-clamp(_rate/0.50, 0, 1));
  if((p.inj||0)>0) floor -= 0.06;                                            // 아직 재활 중
  if(p.unhappy>0) floor+=0.05;
  if((p.ct||1)<=1) floor+=0.04;
  floor=clamp(floor, 0.62, 1.35);
  const keep=Math.round(cur*floor*10)/10;
  const want=Math.max(0.4, market, keep);
  let years=age>=33 ? 1 : age>=30 ? 2 : age<=23 ? 4 : 3;   // 선수가 원하는 기간
  /* 못 뛴 선수는 장기 계약을 요구할 처지가 아니다 — 짧게 받고 증명하겠다는 쪽으로 */
  if(_rate!=null && _rate<0.25) years=Math.max(1, years-1);
  return {want, years, base, market, keep, cur, rate:_rate};
}
/* ── 제시안을 받아들일 이유들 ─────────────────────────────────────
   확률 하나만 던져 주면 "왜 거절했는지"를 알 수 없다. 판단에 들어간 항목을 그대로 돌려줘서
   화면에 펼쳐 보여준다 — 무엇을 고쳐야 잡을 수 있는지가 보여야 협상이 게임이 된다. */
function renewFactors(p, wage, years, promise){
  const t=teamOfPlayer(p)||userTeam();
  const ask=renewAsk(p), age=G.season-p.by, share=playShare(p);
  const F=[];
  const add=(v,label)=>{ if(Math.abs(v)>=0.005) F.push({v, label}); };
  add((wage/ask.want - 1)*1.25, `연봉 제시 (요구 대비 ${Math.round(wage/ask.want*100)}%)`);
  /* ⚠ 제보 — 「감독과 친하면 크게 깎은 금액도 받아들여진다」.
     요구액의 60%만 불러도 호감도 하나로 뒤집혔다. 사람은 감독이 좋아도 자기 값은 안다 —
     깎는 폭이 커질수록 「친분으로 덮이지 않는」 몫이 따로 붙는다. */
  {
    const cut=clamp(1 - wage/Math.max(0.1,ask.want), 0, 1);
    if(cut>0.10) add(-Math.pow((cut-0.10)/0.55, 1.35)*0.70, `요구액보다 ${Math.round(cut*100)}% 낮은 제시`);
  }
  /* 지금 받는 돈보다 적은 계약서에는 쉽게 사인하지 않는다.
     ⚠ 다만 요구액 자체가 이미 현재 연봉보다 낮은 경우(노장·부진해서 스스로 깎은 경우)에는
        위의 '요구 대비' 항목이 이미 계산에 들어가 있다. 여기서 또 깎으면 요구액을 다 줘도
        거절당한다 — 요구액보다도 낮게 부를 때만 추가로 작동시킨다. */
  if((ask.cur||0) > 0.5){
    const r=wage/ask.cur;
    if(r < 1 && wage < ask.want) add(clamp((r-1), -1, 0)*0.55, `현재 연봉 대비 ${Math.round(r*100)}% (삭감)`);
    else if(r >= 1.15) add(Math.min(0.12, (r-1)*0.30), `현재 연봉 대비 ${Math.round(r*100)}% (인상)`);
  }
  add(-Math.abs(years-ask.years)*0.07, `계약 기간 ${years}년 (희망 ${ask.years}년)`);
  /* ⏱️ 올 시즌 뛴 시간 — 요구액에 이미 반영돼 있지만, 「왜 이 액수인지」가 보여야 협상이 된다 */
  if(ask.rate!=null && ask.rate<0.45){
    const gp=(t.W||0)+(t.Dw||0)+(t.L||0);
    F.push({v:0, label:`올 시즌 출전 ${p.apps||0}/${gp}경기${(p.inj||0)>0?" · 재활 중":""} — 요구액을 스스로 낮췄습니다`});
  }
  if(promise) add(0.14, "출전 시간 약속");
  /* 감독과의 관계 — 협상 테이블에서 제일 크게 작용하는 무형 요소다.
     조건이 같아도 믿는 감독이면 사인하고, 미운 감독이면 시장을 본다. */
  /* 호감도는 「같은 조건이면 남는다」를 만드는 값이지, 연봉을 반값으로 만드는 값이 아니다.
     0.012(최대 ±0.60)는 요구액의 절반을 불러도 상쇄되는 크기였다 — 절반 아래로 낮추고 상한을 건다. */
  add(clamp((aff(p)-50)*0.005, -0.25, 0.25), `감독 호감도 ${Math.round(aff(p))}`);
  add(prestigePull()*0.8, `감독의 위신 ${(typeof mgrPrestige==="function"?mgrPrestige():0)}`);
  add(((p.morale||70)-70)*0.006, `선수 사기 ${Math.round(p.morale||70)}`);
  add(((t.morale||70)-70)*0.003, "라커룸 분위기");
  /* ⚠ 나이 기준이 26세였다. 스물여섯은 한창때지 "어린 선수"가 아니다 — 23세로 내린다. */
  if(playShareKnown()){
    if(share<0.35 && age<=23) add(-0.16, "출전 시간 부족 (성장기인데 못 뛰고 있다)");
    else if(share>=0.9) add(0.09, "주전으로 뛰는 중");
    else if(share<0.35) add(-0.09, "출전 시간 부족");
  }
  if(p.unhappy>0) add(-0.12*p.unhappy, `불만 단계 ${p.unhappy}`);
  if(p.sulk>0) add(-0.40, "태업 중");
  if(age>=33) add(0.10, "나이 (선택지가 좁다)");
  if(age<=21) add(-0.06, "어린 선수 (기회를 찾는다)");
  /* 팀이 어디에 있는가 — 우승 경쟁 중인 팀은 남을 이유가 있고, 강등권은 반대다 */
  const tbl=(typeof tableOf==="function") ? tableOf(t.div||1) : [];
  const pos=tbl.findIndex(x=>x.id===t.id)+1;
  if(pos>0 && tbl.length){
    if(pos<=3) add(0.10, `리그 ${pos}위 — 우승 경쟁 중`);
    else if(pos>=tbl.length-2) add(-0.10, `리그 ${pos}위 — 강등권`);
  }
  const cups=(G.trophies||[]).filter(x=>x.kind==="champ"||x.kind==="champ2").length;
  if(cups) add(Math.min(0.12, cups*0.05), `감독 우승 경력 ${cups}회`);
  if(p.tutor) add(0.06, "멘토와 함께 성장 중");
  /* 재계약에서의 성격 — 야심가는 더 큰 무대를 보고, 온화한 선수는 정든 팀에 남는다 */
  const PERS_RENEW=[0.05, -0.08, 0.10, -0.03];
  add(PERS_RENEW[p.pers||0], `성격: ${["프로 — 조건이 맞으면 사인한다","야심 — 더 큰 무대를 본다","온화 — 정든 팀에 남고 싶어한다","다혈질 — 기분에 좌우된다"][p.pers||0]}`);
  if((p.seasonRating||0)>=7.50 && p.apps>=8) add(-0.06, "최근 폼이 좋다 (몸값을 안다)");
  if(t.div===2) add(-0.05, "2부 소속");
  /* ⚠ "재계약이 너무 쉽다"는 피드백 —
     ① 같은 선수에게 계속 들이밀면 피로가 빨리 쌓인다 (2회째부터가 아니라 바로)
     ② 팀 간판급은 자기 몸값을 안다. 시장이 부를 것을 알기에 쉽게 사인하지 않는다 */
  if((p._renewTry||0)>=1) add(-Math.min(0.24, 0.09*p._renewTry), `재협상 ${p._renewTry+1}회째 — 피로해한다`);
  const lead=p.ovr-(typeof teamOVR==="function"?teamOVR(t):p.ovr);
  if(lead>=2 && age<=30) add(-Math.min(0.18, (lead-1)*0.05), "팀 간판 — 시장의 부름을 안다");
  return {F, base:0.42, ask};
}
function renewChance(p, wage, years, promise){
  const r=renewFactors(p, wage, years, promise);
  return clamp(r.base + r.F.reduce((s,x)=>s+x.v,0), 0.03, 0.96);
}
function openRenew(pid){
  if(armyGate("재계약")) return;
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p) return;
  if(p.loan){ flash("임대 중인 선수와는 재계약할 수 없습니다.","warn"); return; }
  /* 사인한 지 얼마 안 된 선수와 또 협상 테이블에 앉을 수는 없다.
     이게 없으면 연봉을 조금씩 올려 가며 계약을 무한히 늘릴 수 있다. */
  const left=renewLockLeft(p);
  if(left>0){
    flash(`📄 ${p.name} 선수는 최근에 재계약했습니다. ${left}일 뒤에 다시 이야기할 수 있습니다.`,"warn");
    return;
  }
  const a=renewAsk(p);
  retMark();                     // ↩ 여기서 왔다 — 끝나면 이 화면으로 돌려보낸다
  RENEW={pid, wage:a.want, years:clamp(a.years, Math.min(CT_MAX,(p.ct||1)+1), CT_MAX), promise:false};
  show("renew");
}
function renewSet(k, v){
  if(!RENEW) return;
  if(k==="wage") RENEW.wage=Math.max(0.4, Math.round((RENEW.wage+v)*10)/10);
  /* ⚠ 하한이 1년이라, 1년 남은 선수에게 1년을 제시하면 재계약을 해도 잔여 계약이 그대로 1년이었다.
     감독 눈에는 아무 일도 안 일어난 것으로 보이는데, 재계약 쿨다운(1년)까지 걸려 다시 붙잡을 수도 없었다.
     재계약은 "지금보다 더 오래 남기는 것"이므로 하한을 잔여 계약보다 한 해 위로 올린다. */
  if(k==="years"){
    const pp=userTeam().players.find(x=>x.id===RENEW.pid);
    const lo=Math.min(CT_MAX, ((pp&&pp.ct)||1)+1);
    RENEW.years=clamp(RENEW.years+v, lo, CT_MAX);
  }
  if(k==="promise") RENEW.promise=!RENEW.promise;
  show("renew");
}
function renewSubmit(){
  const t=userTeam(); if(!RENEW) return;
  const p=t.players.find(x=>x.id===RENEW.pid); if(!p){ RENEW=null; retBack("squad"); return; }
  const room=wageRoom(t)+(p.wage||0);
  if(RENEW.wage>room){ flash(`연봉 상한을 넘습니다 (여유 ${Math.round(room*10)/10}억).`,"warn"); return; }
  RENEW.wasCt=p.ct||1;
  if(RENEW.years <= (p.ct||1)){
    flash(`계약 기간이 지금 남은 ${p.ct||1}년보다 길어야 합니다. (재계약의 의미가 없습니다)`,"warn");
    show("renew"); return;
  }
  const ch=renewChance(p, RENEW.wage, RENEW.years, RENEW.promise);
  const ask=renewAsk(p);
  if(Math.random()<ch){
    p.wage=RENEW.wage; p.ct=RENEW.years; p.morale=clamp(p.morale+6,20,99);
    if(!String(p.uWhy||"").includes("폭행")){ p.unhappy=0; p.uWhy=""; }   // 폭행의 기억은 돈으로 지워지지 않는다
    affAdd(p, 5, "재계약");
    if(RENEW.promise) p.promise={rounds:8, need:5, apps0:p.apps||0};
    markRenewed(p);
    const wasCt=RENEW.wasCt;
    RENEW={pid:p.id, done:"ok", was:wasCt, say:pick([
      `"오래 있고 싶었습니다. 감사합니다."`,
      `"이 팀에서 커리어를 마치고 싶습니다."`,
      `"조건보다 감독님 말씀이 컸습니다. 사인하겠습니다."`,
      RENEW.promise?`"출전 약속, 꼭 지켜 주십시오. 저도 보답하겠습니다."`:`"좋습니다. 다음 시즌도 함께하죠."`]),
      wage:p.wage, years:p.ct};
    notify(`📝 <b>${p.name}</b> 재계약 완료 — 연봉 ${p.wage}억 · ${p.ct}년`,"good");
    renewSocial(p, "ok");
  } else {
    p._renewTry=(p._renewTry||0)+1;
    const gap=RENEW.wage/ask.want;
    const wasWage=RENEW.wage, wasYears=RENEW.years;
    RENEW={pid:p.id, done:"no", lastWage:wasWage, lastYears:wasYears,
      canPersuade:(p._persuadeR!==(t.div===1?G.r1:G.r2)), say: gap<0.8
      ? pick([`"이 조건은... 솔직히 무시당한 기분입니다."`, `"제 가치를 이 정도로 보시는군요."`])
      : pick([`"조금만 더 생각해 보겠습니다."`, `"에이전트와 상의해 보겠습니다. 다시 연락 주십시오."`]),
      hint:`요구 수준: 연봉 약 ${ask.want}억 · ${ask.years}년`};
    if(gap<0.8){ p.morale=clamp(p.morale-4,20,99); affAdd(p, -3, "무성의한 재계약 제시"); }
    if((p.ct||1)<=1) renewSocial(p, "fail");     // 만료가 코앞인 선수라면 팬들이 안다
  }
  saveGame(); show("renew");
}
/* ── 설득 ────────────────────────────────────────────────────────
   조건만으로 안 될 때 감독이 직접 말로 붙잡는다. FM의 감독 설득에 해당한다.
   통하면 그 자리에서 사인하고, 어긋나면 관계가 상한다 — 그래서 아무 때나 쓸 수 없다.
     · 비전 — 팀의 미래를 이야기한다. 어리고 야심 있는 선수에게 잘 통한다.
     · 인정 — 네가 필요하다고 말한다. 온화한 선수·노장에게 통하고, 안 쓰면서 말하면 역효과.
     · 압박 — 대체할 사람은 많다고 말한다. 통하면 즉효, 어긋나면 치명적. */
const RENEW_TALK={
  vision:{n:"🌅 비전을 이야기한다", d:"\"3년 뒤 이 팀이 어디 있을지 보여드리겠습니다.\""},
  respect:{n:"🤝 필요한 선수라고 말한다", d:"\"당신 없이 이 팀을 짤 수가 없습니다.\""},
  pressure:{n:"😤 대체 가능하다고 압박한다", d:"\"기회는 계속 오지 않습니다.\""}
};
function persuadeChance(p, kind, ctx){
  const age=G.season-p.by, pers=p.pers||0;
  let c=0.30 + (aff(p)-50)*0.009 + ((p.morale||70)-70)*0.004;
  if(kind==="vision"){
    if(age<=23) c+=0.20; if(age>=32) c-=0.14;
    if(pers===1) c+=0.14;
    const t=userTeam(), tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.isUser)+1;
    if(pos>0 && pos<=3) c+=0.12; else if(pos>=tbl.length-2) c-=0.12;
  }
  if(kind==="respect"){
    if(pers===2) c+=0.20; if(pers===0) c+=0.08;
    if(age>=31) c+=0.12;
    c += playShare(p)>=0.8 ? 0.10 : -0.12;      // 안 쓰면서 필요하다고 하면 안 믿는다
  }
  if(kind==="pressure"){
    if(pers===3) c-=0.20; if(pers===1) c+=0.06;
    if(age>=33) c+=0.14;
    if(p.ovr>=75) c-=0.18;                      // 대체 불가한 선수에게는 안 통한다
  }
  if(ctx==="loan"){ if(playShare(p)<0.3) c+=0.15; if(p.ovr>=74) c-=0.15; }
  if(p.unhappy>0) c-=0.10*p.unhappy;
  return clamp(c, 0.05, 0.92);
}
function renewPersuade(kind){
  const t=userTeam(); if(!RENEW) return;
  const p=t.players.find(x=>x.id===RENEW.pid); if(!p) return;
  p._persuadeR=(t.div===1?G.r1:G.r2);
  const ask=renewAsk(p);
  let w=RENEW.lastWage||ask.want, y=RENEW.lastYears||ask.years;
  /* ⚠ 제보 — 「설득해서 재계약했는데 선수가 마음대로 연봉을 6억 → 11억으로 올려서 사인한다」.
     저가 제시 악용을 막으려고 「설득이 통해도 연봉은 기대치 근처로 다시 부른다」를 넣었었는데,
     감독 입장에서는 설득에 성공했으니 그 조건으로 사인될 거라 믿을 수밖에 없다. 약속이 뒤집히는 셈이다.
     ─ 설득이 통하면 「감독이 제시한 그 연봉 그대로」 사인한다.
       대신 악용은 다른 쪽으로 막는다 — 깎은 폭이 클수록 설득 자체가 훨씬 어렵고(성공률 −),
       억지로 눌러 앉힌 계약은 앙금을 남긴다(호감도·사기). 조건은 감독이 부른 그대로다. */
  const lowball=clamp((ask.want-w)/Math.max(ask.want,0.1), 0, 1);
  const ch=clamp(persuadeChance(p, kind, "renew") - Math.pow(lowball,1.2)*0.95, 0.02, 0.92);
  if(Math.random()<ch){
    RENEW._wageFixed=null;                      // 조건은 손대지 않는다
    p.wage=w; p.ct=y; p.morale=clamp(p.morale+7,20,99);
    /* 크게 깎아 눌러 앉혔다면 사인은 해도 마음은 남는다 */
    if(lowball>0.18){
      const sting=Math.round(clamp((lowball-0.18)*46, 2, 22));
      try{ affAdd(p, -sting, "요구액보다 크게 낮은 재계약"); }catch(e){}
      p.morale=clamp(p.morale-Math.round(sting*0.6), 20, 99);
      RENEW._sting=sting;
    } else RENEW._sting=0;
    if(!String(p.uWhy||"").includes("폭행")){ p.unhappy=0; p.uWhy=""; }
    affAdd(p, 7, "감독 설득으로 재계약"); markRenewed(p);
    const fixedNote=RENEW._sting
      ? `

<span class="small" style="color:#ff9d5c">제시하신 <b>연봉 ${w}억</b> 그대로 사인했습니다. 다만 요구액보다 한참 낮은 조건이라 앙금이 남았습니다 — 호감도 ${RENEW._sting} · 사기 ${Math.round(RENEW._sting*0.6)} 하락</span>` : "";
    RENEW={pid:p.id, done:"ok", wage:w, years:y, say:pick(
      kind==="vision"?[`"...그 그림, 저도 보고 싶습니다. 남겠습니다."`,`"3년 뒤가 궁금해지네요. 사인하죠."`]
     :kind==="respect"?[`"그 말씀 하나면 됐습니다. 남겠습니다."`,`"필요하다고 해 주시니... 조건은 됐습니다."`]
     :[`"...알겠습니다. 다시 생각해 보겠습니다. 남죠."`,`"기분은 좀 그렇지만, 맞는 말씀입니다."`])+fixedNote};
    notify(`📝 <b>${p.name}</b> 설득 성공 — 재계약 (연봉 ${w}억 · ${y}년)`,"good");
    renewSocial(p, "ok");
  } else {
    const bad = kind==="pressure" ? 9 : 4;
    affAdd(p, -bad, "설득 실패");
    p.morale=clamp(p.morale-(kind==="pressure"?6:2),20,99);
    if(kind==="pressure" && (p.pers||0)===3) p.unhappy=Math.min(3,(p.unhappy||0)+1);
    /* ⚠ 제보 원문 — 「18세선수 재계약하는데 3년뒤에 팀이어디있을지보여드리겠다 그멘트
       날리니까 선수가 3년뒤에 저는 서른이 넘습니다 이러고 거절하는 버그가 있슴다..ㅋㅋㅋ」
       원인: 거절 대사를 나이와 무관하게 뽑았다. 「3년 뒤 서른」은 스물일곱 이상만 할 수 있는 말이다. */
    const _age=G.season-(p.by||2000);
    const _visionNo = _age>=27
      ? [`"좋은 말씀이지만, 저는 지금 뛰어야 합니다."`,`"3년 뒤에 저는 서른이 넘습니다."`,
         `"그 그림이 완성될 때쯤이면 저는 은퇴를 생각할 나이입니다."`]
      : _age<=22
      ? [`"좋은 말씀이지만, 저는 지금 뛰어야 합니다."`,`"3년을 기다리기엔 제가 너무 어립니다. 지금 배우고 싶습니다."`,
         `"그림은 좋은데... 그 안에 제 자리가 보이질 않습니다."`]
      : [`"좋은 말씀이지만, 저는 지금 뛰어야 합니다."`,`"계획은 알겠습니다. 다만 제 전성기는 지금입니다."`,
         `"그 그림, 저 없이도 그려질 것 같은데요."`];
    RENEW={pid:p.id, done:"no", noRetry:true, say:pick(
      kind==="vision"?_visionNo
     :kind==="respect"?[`"필요하다고 하시면서 왜 저를 안 쓰셨습니까."`,`"말씀은 감사하지만 마음은 정했습니다."`]
     :[`"대체하시죠. 저도 갈 곳은 있습니다."`,`"...지금 그 말씀, 잊지 않겠습니다."`]),
      hint:`설득 실패 — 감독 호감도 ${bad} 하락${kind==="pressure"?" · 관계가 크게 상했습니다":""}`};
    notify(`❌ ${p.name} 설득 실패 — 관계가 나빠졌습니다`,"warn");
  }
  saveGame(); show("renew");
}
/* ── 임대 ────────────────────────────────────────────────────────
   내보내는 임대만이 아니라 받아오는 임대도 있다. 조건은 세 가지다.
     · 기간       — 반 시즌(복귀 가능) / 한 시즌
     · 주급 분담  — 우리가 얼마나 낼 것인가. 많이 낼수록 상대가 쉽게 받는다.
     · 완전이적 옵션 — 임대 종료 후 살 권리. 붙이면 상대가 망설인다. */
function loanValue(p){ return Math.max(0.1, Math.round(marketValue(p)*0.10*10)/10); }
/* 상대 구단이 우리 선수를 임대로 받아 줄 확률 */
function loanOutChance(p, club, share, buyOpt, halfSeason){
  const need=club.players.filter(q=>q.pos===p.pos).length;
  let c=0.30;
  c += (p.ovr - teamOVR(club))*0.045;          // 그 팀 수준보다 나은 선수면 반긴다
  c += share*0.55;                              // 주급을 우리가 낼수록 좋다
  if(need<=2) c+=0.12; else if(need>=6) c-=0.12;
  if(buyOpt) c-=0.10;                           // 옵션이 붙으면 부담스럽다
  if(halfSeason) c-=0.06;
  if(p.inj>0) c-=0.35;
  if((p.morale||70)<45) c-=0.08;
  if((p.ct||1)<=1) c-=0.10;                     // 계약이 곧 끝나는 선수는 키워 줄 이유가 적다
  const G2=G.trust&&G.trust.fans;               // 감독 평판이 좋으면 상대도 협조적이다
  if(typeof G2==="number") c += (G2-60)*0.0015;
  const age=G.season-p.by;
  if(age<=21) c+=0.06;                          // 유망주 임대는 어느 구단이나 반긴다
  return clamp(c, 0.05, 0.95);
}
function loanOut(pid, clubId, share, buyOpt, halfSeason){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); const club=G.teams[clubId];
  if(!p||!club) return;
  if(p.armyCall){ flash(`🎖️ ${p.name} 선수는 입영 통지를 받았습니다 — 입소(D-${armyCallLeft(p)})까지는 임대 보낼 수 없습니다.`,"warn"); return; }
  /* ⚠ 제보 — 「난색·거절 유력 구단도 더블 클릭·광클하면 임대를 보낼 수 있다」.
     제안 버튼을 누를 때마다 수락 주사위를 새로 굴렸다 — 5% 확률도 광클이면 뚫린다.
     거절당하면 그 구단에는 「조건을 올리거나」 7일이 지나야 다시 제안할 수 있다.
     (조건 개선 = 주급 분담 인상, 또는 구단이 부담스러워하던 옵션·반시즌을 뺀 경우) */
  p._lrefs = p._lrefs || {};
  /* ⚠ 제보 원문 — 「해가 지났음에도 '임대갈 구단'에서 제안할 구단들의 선택(작년에는 거절)이
     초기화되지 않는다」. 원인 — 새 시즌마다 G.day 가 0 으로 돌아가는데 거절 기록은 지난해
     day(예: 280)를 들고 있어, 경과일이 음수가 되면서 7일 쿨다운이 영원히 풀리지 않았고
     30일 청소도 영영 발동하지 못했다. 시즌을 함께 기록해 해가 지나면 지우고,
     선수 어빌이 눈에 띄게 성장(+2 이상)했으면 그 구단도 다시 검토한다 (요청 ②). */
  try{ for(const k in p._lrefs){ const e=p._lrefs[k];
    if(!e || e.s!==G.season || (G.day||0)-(e.d||0)>30
       || (e.o!=null && (p.ovr||0)>=e.o+2)) delete p._lrefs[k]; } }catch(e){}
  const _ref=p._lrefs[clubId];
  const _sameOrWorse = _ref && share<=_ref.sh && (buyOpt?1:0)>=_ref.b && (halfSeason?1:0)>=_ref.h;
  if(_ref && (G.day||0)-_ref.d<7 && _sameOrWorse){
    flash(`❌ ${club.short}은/는 이미 이 조건을 거절했습니다 — 조건을 바꾸거나 ${7-((G.day||0)-_ref.d)}일 뒤에 다시 제안하세요.`,"warn");
    return;
  }
  const ch=loanOutChance(p, club, share, buyOpt, halfSeason);
  if(Math.random()>=ch){
    p._lrefs[clubId]={d:G.day||0, s:G.season, o:p.ovr||0, sh:share, b:buyOpt?1:0, h:halfSeason?1:0};
    flash(`❌ ${club.short}이/가 ${p.name} 임대를 거절했습니다.`,"warn");
    addNews(`🔁 ${club.name}, ${p.name} 임대 제안 거절`);
    try{ show("loan"); }catch(e){}   // 표에 「거절함」이 바로 보이게 다시 그린다
    return;
  }
  /* 구단끼리 합의해도 선수가 싫다고 할 수 있다. 주전으로 뛰던 선수, 이 팀에 애착이 큰 선수,
     하부 리그로 내려가는 게 자존심 상하는 선수는 짐을 싸지 않는다. */
  const acc=loanPlayerAccept(p, club);
  if(Math.random()>=acc){
    LOANUI={pid:p.id, refuse:{club:club.id, share, buy:buyOpt, half:halfSeason,
      say:loanRefuseSay(p, club), canPersuade:(p._persuadeR!==(t.div===1?G.r1:G.r2))}};
    loanSocial(p, club, "refuse");
    show("loan"); return;
  }
  doLoanMove(p, club, share, buyOpt, halfSeason);
}
/* 선수 본인이 임대를 받아들일 이유들 — 재계약과 같은 방식으로 항목을 펼쳐 보여준다 */
function loanFactors(p, club){
  const t=userTeam(), age=G.season-p.by, share=playShare(p);
  const F=[]; const add=(v,label)=>{ if(Math.abs(v)>=0.005) F.push({v,label}); };
  if(playShareKnown())
    add((0.45-share)*0.9, share<0.3?"거의 못 뛰고 있다":share>=0.8?"주전으로 뛰는 중":"출전 시간 보통");
  else if((p.apps||0)<=1 && (G.season-p.by)<=23)
    add(0.10, "아직 기회를 못 받았다");     // 프리시즌 — 출전 기록 대신 나이로만 본다
  add((aff(p)-50)*0.010, `감독 호감도 ${Math.round(aff(p))}`);
  /* ⚠ 제보 — 「어느 팀으로 보낼지 고르지도 않았는데 항상 "K리그2로 내려간다 -18"이
     찍혀 있다. K리그1로 보내면 저 항목이 없어야 하는 것 아니냐」. 화면이 임의의 첫 구단을
     기준으로 계산한 게 원인 — 구단이 정해지기 전(club=null)에는 구단 종속 항목을 빼고,
     구단을 고르면 그 팀 기준으로 계산한다. */
  if(club){
    if(club.div>t.div) add(-0.18, `${divName(club.div)}로 내려간다`);
    else if(club.div<t.div) add(0.10, `${divName(club.div)}로 올라간다`);
    add(teamStarVal(club)>=teamStarVal(t)?0.06:-0.05, `임대 구단 전력 ${teamStarVal(club)}★`);
  }
  if(age<=21) add(0.14, "어리다 — 경험이 급하다");
  else if(age>=25) add(-0.12, "이 나이에 임대는 자존심이 상한다");
  if(p.ovr>=74) add(-0.20, "주전급 — 왜 나가야 하냐고 묻는다");
  if((p.morale||70)>=80) add(-0.08, "지금 팀 생활이 만족스럽다");
  else if((p.morale||70)<50) add(0.08, "사기가 바닥이다");
  if(p.unhappy>0) add(0.12, "이미 불만이 있다");
  if(p.tutor) add(-0.07, "멘토와 붙어 훈련 중");
  /* ⚠ 온화한 선수가 -0.05 로 불이익을 받고 있었다. 온화 = 순응적이고 감독 말을 잘 듣는 성격이라
     (칭찬에 가장 크게 반응하고, 공개 질책에 가장 크게 무너진다) 임대는 오히려 잘 받아들여야 한다.
     프로는 팀 결정을 존중하고, 야심가는 뛸 곳을 찾아 나가며, 다혈질만 반발한다. */
  const PERS_LOAN=[0.08, 0.12, 0.09, -0.12];
  add(PERS_LOAN[p.pers||0], `성격: ${["프로 — 팀 결정을 존중한다","야심 — 뛸 곳을 찾는다","온화 — 순순히 받아들인다","다혈질 — 반발한다"][p.pers||0]}`);
  const cups=(G.trophies||[]).filter(x=>x.kind==="champ"||x.kind==="champ2").length;
  if(cups) add(Math.min(0.10, cups*0.04), `감독을 믿는다 (우승 ${cups}회)`);
  return {F, base:0.55};
}
function loanPlayerAccept(p, club){
  const r=loanFactors(p, club);
  return clamp(r.base + r.F.reduce((s,x)=>s+x.v,0), 0.05, 0.95);
}
function loanRefuseSay(p, club){
  const t=userTeam();
  if(p.ovr>=74) return `"제가 왜 ${club.short}에 가야 합니까? 저는 여기서 뛰겠습니다."`;
  if(club.div>t.div) return `"2부로 내려가라는 말씀입니까... 그건 좀 받아들이기 어렵습니다."`;
  if((p.morale||70)>=80) return `"저 여기 정말 좋습니다. 굳이 나가야 하나요?"`;
  if((p.pers||0)===3) return `"싫습니다. 저 안 갑니다."`;
  return pick([`"조금만 더 기회를 주시면 안 됩니까?"`, `"여기서 증명하고 싶습니다."`]);
}
function loanPersuade(kind){
  const t=userTeam(); if(!LOANUI||!LOANUI.refuse) return;
  const p=t.players.find(x=>x.id===LOANUI.pid); const r=LOANUI.refuse;
  const club=G.teams[r.club]; if(!p||!club) return;
  p._persuadeR=(t.div===1?G.r1:G.r2);
  if(Math.random()<persuadeChance(p, kind, "loan")){
    affAdd(p, 3, "임대 설득 수용");
    flash(pick(
      kind==="vision"?[`${p.name}: "거기서 30경기 뛰고 오겠습니다."`,`${p.name}: "알겠습니다. 뛰어야 는다는 말씀, 맞습니다."`]
     :kind==="respect"?[`${p.name}: "돌아왔을 때 자리를 비워 두신다면요."`,`${p.name}: "감독님이 그렇게까지 말씀하시니 가겠습니다."`]
     :[`${p.name}: "...알겠습니다. 짐 싸겠습니다."`]),"good");
    doLoanMove(p, club, r.share, r.buy, r.half);
    LOANUI=null; show("contract"); return;
  }
  const bad = kind==="pressure" ? 8 : 4;
  affAdd(p, -bad, "임대 설득 실패");
  p.morale=clamp(p.morale-(kind==="pressure"?5:2),20,99);
  LOANUI.refuse.done=true;
  LOANUI.refuse.say2=pick(
    kind==="vision"?[`"제 커리어는 제가 정하겠습니다."`]
   :kind==="respect"?[`"필요하다면서 왜 내보내십니까."`]
   :[`"보내고 싶으시면 파십시오. 임대는 안 갑니다."`]);
  notify(`❌ ${p.name} 임대 설득 실패 — 호감도 ${bad} 하락`,"warn");
  saveGame(); show("loan");
}
function doLoanMove(p, club, share, buyOpt, halfSeason){
  const t=userTeam();
  // 실제로 선수를 옮긴다 — 소유권은 우리에게 남는다
  t.players.splice(t.players.indexOf(p),1);
  club.players.push(p);
  p.loan={own:t.id, to:club.id, until:G.season+(halfSeason?0:1), half:!!halfSeason,
          share, buy:!!buyOpt, fee:(buyOpt?loanBuyFair(p):null), s:G.season, apps0:p.apps||0,
          mv0:(()=>{ try{ return marketValue(p)||0; }catch(e){ return 0; } })(),
          backR: halfSeason ? ((club.div===1?G.r1:G.r2)+19) : null};   // 반 시즌 = 약 19라운드 뒤 복귀
  p.morale=clamp(p.morale+(playShare(p)<0.4?6:-4),20,99);
  /* 🛟 원소속 구단이 「누구를 내보냈는지」를 들고 있는다 — 어떤 경로로 명단에서 빠져도 되찾을 수 있다 */
  if(!Array.isArray(t.loanOutLog)) t.loanOutLog=[];
  /* ⚠ 여기에 선수 「객체」를 넣으면 세이브를 거칠 때마다 사본이 하나 더 생긴다.
     복구용 최소 정보(번호·이름·생년)만 남긴다. */
  if(!t.loanOutLog.some(q=>q&&q.id===p.id)) t.loanOutLog.push({id:p.id, name:p.name, by:p.by, _ref:1});
  /* 임대는 새 계약이 아니다 — 원소속과의 계약은 그대로다. 여기서 잠그면 복귀 후에도 재계약이 막힌다. */
  joinClub(club, p, false);
  LOANUI=null;
  notify(`🔁 <b>${p.name}</b> — ${club.name}으로 임대 (${halfSeason?"반 시즌":"시즌 종료까지"} · 주급 분담 ${Math.round(share*100)}%${buyOpt?" · 완전이적 옵션":""})`,"good");
  pushFeed({cat:"transfer", ic:"🔁", tone:0, tid:club.id, src:"K리그 공식",
    head:`${club.name}, ${t.short} ${p.name} 임대 영입`,
    sub:`${G.season-p.by}세 ${POS_KO[p.pos]||p.pos}. ${buyOpt?"임대 종료 후 완전 이적 옵션이 포함됐다.":"출전 시간을 보장받는 조건이다."}`});
  loanSocial(p, club, "out");
  saveGame(); if(typeof show==="function") retBack("loancenter");
}
/* ═══ 🔁 임대 알림 큐 ═══════════════════════════════════════════════════
   ⚠ 제보 — 「진행 팝업에는 임대 제의가 왔다는데 실제로는 없고, 팝업에 없었는데 제의는 와 있다」.
     원인이 둘이었다.
       ① 알림 자리가 하나뿐(_loanStopPing)이라, 같은 날 문의와 제안이 겹치면 뒤엣것이
          앞엣것을 덮어썼다 — 두 건이 왔는데 한 건만 알려 줬다.
       ② 알림을 만든 뒤에 만료·선수 이동으로 그 제의가 사라져도 알림은 그대로 남아,
          「왔다」고 해놓고 임대 센터는 비어 있었다.
   ─ 줄로 쌓고, 화면에 띄우는 순간 「그 제의가 지금도 있는가」를 다시 확인한다. */
function loanPing(k, pid, txt){
  const L=(G._loanPing=Array.isArray(G._loanPing)?G._loanPing:[]);
  L.push({k, pid, txt});
  if(L.length>8) L.shift();
}
/* 그 알림이 가리키는 제의가 지금도 살아 있는가 */
function loanPingAlive(x){
  if(!x) return false;
  if(x.k==="ask")   return (G.loanAsks||[]).some(a=>a && a.pid===x.pid);
  if(x.k==="offer") return (G.loanOffers||[]).some(o=>o && o.pid===x.pid);
  return true;
}
/* 임대 관련 통보 — 뉴스에만 남기지 않는다. 진행 화면을 멈추고 감독 눈앞에 띄운다.
   ⚠ 제보 — 「조기 소환이 진행 팝업에 안 떠서 뉴스를 뒤져 보고서야 알았다」 */
function loanNote(html, cls){
  const plain=String(html).replace(/<[^>]+>/g,"");
  try{ addNews(plain, cls==="prgNews"?"good":"warn", "club"); }catch(e){}
  try{ (G.loanNotes=G.loanNotes||[]).push({h:html, c:cls||"prgAlert"}); }catch(e){}
  try{ flash(plain, cls==="prgNews"?"good":"warn"); }catch(e){}
}
/* 🌱 임대 온 유망주 성장 — 뛴 만큼 큰다. 라운드마다 확인한다.
   원소속 구단은 "기회를 주겠다"는 약속을 보고 보냈다. 출전이 적으면 조기 소환을 검토한다.

   ⚠ 제보 — 「7라운드에 1선발·1교체·5벤치(명단 제외 0)였는데 「기회를 안 줬다」며 골키퍼가
      조기 소환됐다. 진행 팝업에도 안 떠서 뉴스를 직접 뒤져 알았고, 이적시장이 닫혀 있어
      대체 자원도 구하지 못했다」.
   세 가지가 겹쳐 있었다.
   ① 기준이 빡빡하고 급했다 — 6라운드부터 보기 시작해, 라운드마다 45% 확률로 경고가 붙고
      두 번이면 그 자리에서 소환이었다. 최악의 경우 7라운드 만에 선수가 사라진다.
      ─ 8라운드가 지나야 판단하고, 기준선도 라운드 대비 0.34 → 0.25 로 낮춘다.
        경고가 두 번 쌓이면 소환이 아니라 「최후통첩」이다 — 만회할 5라운드를 준다.
   ② 통보가 notify 로만 나가 진행 화면을 멈추지 않았다 — 이제 진행이 멈추고 알린다.
   ③ 이적시장이 닫혀 있으면 소환하지 않는다. 실제로도 임대 해지는 등록 기간에만 가능하고,
      닫힌 창에서 데려가 버리면 감독은 대체 자원을 구할 방법이 없다. 시장이 열릴 때까지 미룬다. */
const LOAN_REVIEW_R = 8;      // 이 라운드가 지나야 출전 심사를 시작한다
const LOAN_MIN_RATE = 0.25;   // 라운드 대비 출전 비율 — 이보다 낮으면 원소속이 문제 삼는다
const LOAN_GRACE_R  = 5;      // 최후통첩 뒤 만회할 라운드
function loanInReview(){
  const t=userTeam(); if(!t || G.jobless) return;
  const opened=(function(){ try{ return transferOpen(); }catch(e){ return true; } })();
  for(const p of loanedInFrom(t)){
    const L=p.loan; if(!L) continue;
    if(L.startR==null){ L.startR=(t.div===1?G.r1:G.r2); continue; }
    const played=(p.apps||0)-(L.apps0||0);
    const r=(t.div===1?G.r1:G.r2)-L.startR;
    if(r<LOAN_REVIEW_R) continue;
    const from=G.teams[L.own];
    const fn=from?from.short:"원소속 구단";
    const rate=played/Math.max(1,r);
    /* ── 최후통첩이 걸려 있는 경우 ─────────────────────────── */
    if(L.dueR!=null){
      /* ⚠ 통첩 뒤에는 「누적 비율」이 아니라 「그 뒤로 얼마나 썼는가」를 본다.
         초반에 안 썼다는 이유로 누적 평균이 눌려 있으면, 감독이 통첩을 받고 매 경기
         내보내도 기한 안에 기준을 못 넘긴다 — 만회할 길이 없는 통첩은 통첩이 아니다. */
      const sinceR=Math.max(1, r-(L.warnR!=null?L.warnR:0));
      const sinceA=played-(L.warnApps||0);
      const recent=sinceA/sinceR;
      if(recent>=LOAN_MIN_RATE){                     // 만회했다 — 없던 일로 한다
        L.dueR=null; L.warned=0; L.held=0; L.warnR=null; L.warnApps=null;
        loanNote(`🤝 <b>${fn}</b>, ${p.name} 출전 상황에 만족했습니다 — 조기 소환 검토를 접었습니다. <span class="small">(통첩 뒤 ${sinceR}R 중 ${sinceA}경기)</span>`, "prgNews");
        continue;
      }
      if(r<L.dueR) continue;                          // 아직 기한이 남았다
      if(!opened){                                    // 🔒 시장이 닫혀 있으면 데려갈 수 없다
        if(!L.held){ L.held=1;
          loanNote(`⏳ <b>${fn}</b>, ${p.name} 조기 소환을 <b>이적시장이 열릴 때까지</b> 보류했습니다. 그 전에 출전을 늘리면 없던 일이 됩니다. <span class="small">(통첩 뒤 ${sinceR}R 중 ${sinceA}경기)</span>`, "prgAlert"); }
        continue;
      }
      loanNote(`⚠️ <b>${fn}</b>, ${p.name} 임대 조기 소환 — "출전 기회를 약속받고 보냈습니다." <span class="small">(통첩 뒤 ${sinceR}R 중 ${sinceA}경기 · 임대 후 통산 ${r}R 중 ${played}경기)</span>`, "prgAlert");
      try{ loanSocial(p, from, "recall"); }catch(e){}
      endLoan(p, t);
      continue;
    }
    /* ── 아직 경고 전 ──────────────────────────────────────── */
    if(rate<LOAN_MIN_RATE && Math.random()<0.5){
      L.warned=(L.warned||0)+1;
      if(L.warned>=2){
        L.dueR=r+LOAN_GRACE_R; L.warnR=r; L.warnApps=played;
        const need=Math.ceil(LOAN_GRACE_R*LOAN_MIN_RATE);
        loanNote(`❗ <b>${fn}</b>: "${p.name}에게 기회를 주지 않으면 데려가겠습니다." — 앞으로 <b>${LOAN_GRACE_R}라운드 안에 ${need}경기 이상</b> 내보내야 합니다. <span class="small">(현재 ${r}R 중 ${played}경기)</span>`, "prgAlert");
      } else {
        loanNote(`📞 <b>${fn}</b>: "${p.name} 출전이 너무 적습니다. 기회를 주시기로 하지 않았습니까?" <span class="small">(${r}R 중 ${played}경기)</span>`, "prgAlert");
      }
    } else if(rate>=0.5 && (G.season-p.by)<=23 && Math.random()<0.30){
      /* 잘 굴리면 임대 기간에 실제로 큰다 — 유스 임대의 존재 이유다 */
      if((p.pot||p.ovr)>p.ovr){ p.ovr=clamp(p.ovr+1,40,96); p.ovrF=p.ovr;
        addMood(`🌱 임대생 ${p.name}이(가) 눈에 띄게 성장했습니다. ${fn} 스카우트가 지켜보고 있습니다.`); }
    }
  }
}
/* 임대 종료 — 복귀 또는 완전이적 옵션 발동. holder = 지금 선수를 데리고 있는 구단(없으면 FA) */
function endLoan(p, holder){
  const L=p.loan; if(!L){ return; }
  const own=G.teams[L.own], club=G.teams[L.to];
  if(!own){ p.loan=null; return; }
  const played=(p.apps||0)-(L.apps0||0);
  /* 💰 완전이적 옵션 — 우리가 빌려온 선수라면 감독이 직접 결정한다 */
  if(L.buy && L.inbound && own && holder && holder.isUser){
    /* 💰 임대 협상 자리에서 못박은 금액이 있으면 그대로 간다 — 뒤늦게 값을 올려 받지 않는다 */
    const fee=loanOptFee(p);
    const played=(p.apps||0)-(L.apps0||0);
    const t=holder;
    showConfirm(`<b>💰 완전이적 옵션</b>\n\n${p.name} — ${own.short}에서 임대로 온 선수입니다.\n임대 기간 ${played}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}\n\n계약에 걸어 둔 완전이적 옵션을 행사하시겠습니까?\n이적료 <b>${fee}억</b> (예산 ${t.budget}억)`,
      ()=>{
        if(t.budget<fee){
          gameAlert(`예산이 부족합니다. (필요 ${fee}억 · 보유 ${t.budget}억) — 선수는 원소속으로 복귀합니다.`);
          /* ⚠ 여기서 p.loan=null 만 하면 선수가 복귀하지 않고 우리 팀에 공짜로 남았다 — 복귀 경로로 보낸다 */
          if(p.loan) p.loan.buy=null;
          endLoan(p, holder); return;
        }
        t.budget=Math.round((t.budget-fee)*10)/10;
        own.budget=Math.round((own.budget+fee)*10)/10;
        p.loan=null; p.ct=Math.max(p.ct||1,2);
        try{ tfLogAdd("in", p, own.short+" (완전이적 옵션 행사)", fee, p.wage, p.ct); }catch(e){}
        addNews(`💰 <b>${t.name}</b>, ${p.name} 완전이적 옵션 행사 — 이적료 ${fee}억에 완전 영입`, "good");
        notify(`💰 <b>${p.name}</b>을/를 완전 영입했습니다! (${fee}억)`,"good");
        try{ loanSocial(p, own, "buy"); }catch(e){}
        saveGame();
      },
      {okLabel:`${fee}억에 영입`, cancelLabel:"임대만 종료", danger:false,
       /* ⚠ 제보 — 「임대 종료」를 눌러도 금액만 바뀐 같은 팝업이 계속 떴다.
          옵션(L.buy)을 지우지 않고 endLoan 을 재귀 호출해 같은 분기로 되돌아왔기 때문.
          옵션을 접었다고 표시한 뒤 복귀 경로를 태운다. */
       onCancel:()=>{ if(p.loan){ p.loan.buy=null; endLoan(p, holder); } }});
    return;
  }
  /* 💰 완전이적 옵션 — 임대 구단이 활약과 지갑을 보고 결정한다 (제보 — 옵션이 있어도 발동 코드가 없었다) */
  if(L.buy && club && holder===club){
    const fee=loanOptFee(p);
    if(played>=6 && (p.seasonRating||0)>=6.95 && club.budget>=fee){
      club.budget=Math.round((club.budget-fee)*10)/10;
      own.budget=Math.round((own.budget+fee)*10)/10;
      p.loan=null; p.ct=Math.max(p.ct||1,2);
      if(own.isUser){
        try{ tfLogAdd("out", p, club.short+" (완전이적 옵션 발동)", fee, null, null); }catch(e){}
        addNews(`💰 <b>${club.name}</b>, ${p.name} 완전이적 옵션 발동 — 이적료 <b>${fee}억</b>이 입금됐습니다.`, "good");
        notify(`💰 <b>${p.name}</b> — ${club.short}이/가 완전이적 옵션을 발동했습니다 (+${fee}억)`,"good");
      }
      return;
    }
  }
  // 🔁 복귀
  if(holder && holder.players.includes(p)) holder.players.splice(holder.players.indexOf(p),1);
  else G.freeAgents=(G.freeAgents||[]).filter(x=>x!==p);
  if(!own.players.includes(p)){ own.players.push(p); joinClub(own, p, false); }   // 복귀 — 재계약 잠금 없음
  try{ if(Array.isArray(own.loanOutLog)) own.loanOutLog=own.loanOutLog.filter(q=>q&&q.id!==p.id); }catch(e){}
  if(own.isUser && club){ try{ loanSocial(p, club, "back"); }catch(e){}
    const _why = (p.loan&&p.loan.half) ? "반 시즌 임대 기간이 끝나" : "임대 기간이 끝나";
    addNews(`🔁 <b>${p.name}</b> 임대 복귀 — ${club.short}에서 ${played}경기 (평점 ${p.apps?(p.seasonRating||0).toFixed(2):"-"})`, played>=15?"good":undefined);
    /* ⚠ 제보 — 「말도 없이 스쿼드에 쓰윽 돌아왔다」. 뉴스 한 줄로는 눈에 띄지 않는다.
       선수단이 바뀌는 일이므로 배너로 확실히 알린다. */
    try{ notify(`🔁 <b>${p.name}</b> 선수가 ${_why} ${club.short}에서 돌아왔습니다 — ${played}경기 출전. 선발 명단을 확인하세요.`, "info"); }catch(e){}
    try{ addMood(`🔁 ${p.name}이(가) 임대에서 돌아왔습니다.`); }catch(e){}
  }
  if(played>=15){
    p.ovr=clamp(p.ovr+1,40,96); p.ovrF=p.ovr;
    /* ⚠ 제보 — 임대 복귀 선수가 「종합 178 / 잠재 174」로 뜬다.
       실전 경험 보너스로 종합만 올리고 잠재는 그대로 둬서 역전이 생겼다.
       한계를 넘어섰다면 그 한계도 함께 올라간 것으로 본다. */
    if((p.pot||0) < p.ovr) p.pot=p.ovr;
  }
  p.loan=null;
}
/* 임대 복귀 — 시즌 전환 때 부른다 */
function loanReturnAll(){
  for(const id in G.teams){ const club=G.teams[id];
    for(const p of [...club.players]){
      /* 🩹 제보 — 예전에는 p.loan.to!==id 면 건너뛰었다. 표식이 어긋난 선수가 영원히
         복귀하지 못한 이유다. 「원소속이 아닌 곳에 임대 표식을 달고 있으면」 복귀 대상이다. */
      if(!p.loan || p.loan.own===id) continue;
      if(G.season < p.loan.until) continue;                 // 아직 기간이 남았다
      endLoan(p, club);
    }
  }
  loanSweep();
}
/* 🧹 임대 정합성 청소 — 라운드마다 + 세이브 로드 때.
   (제보 — "반시즌 임대가 시즌 끝나도 안 돌아오고 출전 수가 -24로 뜬다")
   ① 반 시즌 임대는 복귀 라운드(backR)가 되면 시즌 중에 돌아온다.
   ② 선수가 원소속에 있는데 loan 이 남아 있으면(꼬인 세이브) 표식만 지운다.
   ③ 임대 구단이 방출해 FA에 떠 있으면 원소속으로 되돌린다.
   ④ 기간이 지난 임대(전 시즌 것)는 어디에 있든 정리한다. */
/* 🎖️ 군 복무 중인 선수가 FA 시장에 섞여 있으면 되돌린다.
   (제보 — "정마호 전역 D-day인데 FA로 나와 있어서 데려왔다") */
function armySweep(){
  const gc=Object.values(G.teams).find(x=>isArmyTeam(x));
  /* 🎖️ 상무에 섞여 든 용병 정리 — 외국 국적 선수는 소속될 수 없다 (제보).
     ⚠ 제보 — 「홈그로운 외국인 선수가 김천상무로 입대한다」. 홈그로운은 쿼터만 면제될 뿐
        국적은 외국이라 병역 대상이 아니다. 예전 판에서 이미 입대해 버린 선수는
        여기서 즉시 소집 해제해 원소속 구단으로 돌려보낸다. */
  try{
    if(gc && Array.isArray(gc.players)){
      const bad=gc.players.filter(p=>p && p.army && p.frn);
      for(const p of bad){
        gc.players.splice(gc.players.indexOf(p),1);
        const own=(p.army && p.army.own && G.teams[p.army.own]) || null;
        p.army=null; p.armyDone=0; delete p.armyCall;
        if(own && !own.players.includes(p)){ own.players.push(p); try{ joinClub(own, p, false); }catch(e){} }
        else { p.ct=1; try{ clearClubBaggage(p, 70); }catch(e){} (G.freeAgents=G.freeAgents||[]).push(p); }
      }
      if(bad.length) addNews(`🎖️ 국군체육부대, 병역 대상이 아닌 외국 국적 선수 ${bad.length}명 소집 해제 — 원소속 구단으로 복귀합니다`, "warn", "club");
      const outs=gc.players.filter(p=>p && !p.army && p.frn);
      for(const p of outs){
        gc.players.splice(gc.players.indexOf(p),1);
        p.ct=1; try{ clearClubBaggage(p, 70); }catch(e){}
        (G.freeAgents=G.freeAgents||[]).push(p);
      }
      if(outs.length) addNews(`🎖️ 국군체육부대, 등록 불가 외국 국적 선수 ${outs.length}명 정리 — 자유계약으로 풀립니다`, null, "club");
    }
  }catch(e){}
  const back=[];
  if(!Array.isArray(G.freeAgents)) G.freeAgents=[];
  G.freeAgents=G.freeAgents.filter(p=>{
    if(!p || !p.army) return true;
    back.push(p); return false;
  });
  /* 복무 중(p.army)이면 소속은 언제나 상무다 — 원소속 구단으로 보내면 안 된다.
     전역 처리(tickArmy)가 때가 되면 army 를 지우고 원소속으로 돌려보낸다. */
  for(const p of back){
    const home=gc || (p.army && p.army.own && G.teams[p.army.own]);
    if(home && !home.players.includes(p)){ home.players.push(p); try{ joinClub(home, p, false); }catch(e){} }
  }
  /* 이미 다른 구단이 데려간 경우도 원상 복구한다 — 복무 중에는 상무 외 어느 팀에도 소속될 수 없다 */
  if(gc){
    for(const id in G.teams){ const t=G.teams[id];
      if(isArmyTeam(t)) continue;
      for(const p of [...t.players]){
        if(!p.army) continue;
        t.players.splice(t.players.indexOf(p),1);
        if(!gc.players.includes(p)){ gc.players.push(p); try{ joinClub(gc, p, false); }catch(e){} }
      }
    }
  }
}
function loanSweep(){
  for(const id in G.teams){ const t=G.teams[id];
    for(const p of [...t.players]){
      const L=p.loan; if(!L) continue;
      /* 🛟 옵션가가 비어 있는 옛 임대 — 지금 계약서에 못박아 둔다 (제보) */
      if(L.buy && L.fee==null){ try{ loanOptFee(p); }catch(e){} }
      if(L.own===id){ p.loan=null; continue; }                      // ② 원소속 복귀 상태 — 표식 잔재
      /* 🩹 ⚠ 제보 「임대선수 미복귀가 계속 있습니다」의 뿌리.
         임대 표식의 「간 곳(L.to)」이 지금 실제 소속과 어긋나면 예전에는 이 줄에서 통째로
         건너뛰었다. 복귀 처리(loanSweep · loanReturnAll)가 전부 이 조건을 쓰기 때문에,
         한 번 어긋난 선수는 시즌이 몇 번 지나도 아무도 돌려보내지 않았다.
         ─ 건너뛰지 않고 표식을 지금 앉아 있는 구단으로 고쳐 준다. 그러면 아래 만료 처리가
           그대로 돌아 제때 복귀한다. 입대(병역)로 옮겨 간 경우는 임대가 아니므로 표식을 지운다. */
      if(L.to!==id){
        if((p.army && p.army.own) || isArmyTeam(t)){ p.loan=null; continue; }
        L.to=id;
        if(L.half && L.backR!=null && L.s!==G.season) L.backR=null;   // 지난 시즌 복귀 라운드는 의미가 없다
        try{ const _own=G.teams[L.own];
          if(_own && _own.isUser) addNews(`🛟 <b>${p.name}</b> — 꼬여 있던 임대 기록을 ${t.short} 기준으로 바로잡았습니다.`, "warn", "club");
        }catch(e){}
      }
      const r=(t.div===1?G.r1:G.r2);
      /* 📣 복귀 2라운드 전 예고 — 갑자기 명단이 바뀌지 않게 미리 알린다 */
      if(L.half && L.backR!=null && L.s===G.season && !L.preNoti && r>=L.backR-2 && r<L.backR){
        L.preNoti=1;
        const _own=G.teams[L.own];
        if(_own && _own.isUser){
          try{ notify(`🗓️ <b>${p.name}</b> — ${t.short} 반 시즌 임대가 <b>${L.backR+1}R</b>에 끝납니다. 곧 팀으로 돌아옵니다.`, "info"); }catch(e){}
          try{ addNews(`🗓️ ${p.name} 임대 복귀 예정 — ${t.short}에서의 반 시즌 임대가 ${L.backR+1}R에 종료됩니다`, null, "club"); }catch(e){}
        }
      }
      /* ⚠ 「반 시즌」이 아닌데 복귀 라운드만 남아 있는 꼬인 데이터는 무시한다 —
         한 시즌 임대가 시즌 중에 돌아오는 일은 없어야 한다. */
      if(L.half && L.backR!=null && L.s===G.season && r>=L.backR) endLoan(p, t);   // ① 반 시즌 중간 복귀
      else if(G.season>L.until) endLoan(p, t);                      // ④ 기간 만료
    }
  }
  for(const p of [...(G.freeAgents||[])]){                          // ③ 임대 중 방출된 고아
    if(p.loan) endLoan(p, null);
  }
  /* ⑤ 🛟 미아 복구 — 「임대 보낸 선수가 아예 사라졌다」는 제보.
     어떤 경로로든 명단에서 빠졌는데 어디에도 없는 선수를 원소속으로 되돌린다.
     (임대 기록이 남아 있으면 그 선수는 반드시 어딘가에 있어야 한다) */
  try{
    /* ⚠ 제보 — 「프로필에는 안양 소속이고 임대 표시가 없는데, 임대 센터에는 내보낸 선수로 뜬다」.
       원인은 이 복구 코드였다. loanOutLog 에 선수 「객체」를 넣어 두는데, 세이브를 한 번 거치면
       그 사본과 실제 선수는 서로 다른 객체가 된다. 그 뒤 어떤 이유로든 번호가 어긋나면
       「사라졌다」고 판정해 사본을 원소속에 밀어 넣었다 — 임대 표식이 없는 유령 복제본이다.
       그래서 프로필(번호로 먼저 찾은 유령)과 임대 센터(임대 표식으로 찾은 진짜)가 어긋났다.
       ─ 번호뿐 아니라 「이름+생년」까지 대조한다. 둘 중 하나라도 살아 있으면 복구하지 않는다. */
    const seen=new Set(), seenNm=new Set();
    const mark=(q)=>{ if(!q) return; seen.add(q.id); seenNm.add(`${q.name}|${q.by}`); };
    for(const id in G.teams) for(const q of (G.teams[id].players||[])) mark(q);
    for(const q of (G.freeAgents||[])) mark(q);
    for(const q of (G.overseas||[])) mark(q);
    const lost=[];
    for(const id in G.teams){
      const t=G.teams[id];
      for(const q of (t.loanOutLog||[])){
        if(!q) continue;
        if(seen.has(q.id) || seenNm.has(`${q.name}|${q.by}`)) continue;   // 어딘가에 살아 있다
        lost.push([q, t]);
      }
    }
    if(!lost.length){
      /* 로그가 없으면 임대 표식을 들고 사라진 선수를 찾을 길이 없다 — 다음 임대부터는 남는다 */
    }
    for(const [q, home] of lost){
      q.loan=null; q.ct=Math.max(q.ct||1, 1);
      home.players.push(q); try{ joinClub(home, q, false); }catch(e){}
      if(home.isUser) addNews(`🛟 <b>${q.name}</b> — 임대 기록이 꼬여 명단에서 빠져 있던 선수를 되찾았습니다.`, "warn");
    }
  }catch(e){}
}
/* ═══════════════════════════════════════════════════════════════
   🔁 임대 영입 (LOAN IN) — 타 구단 선수를 빌려온다
   K리그 규정을 기준으로 제약을 둔다.
     · 원소속 구단과의 경기에는 출전할 수 없다 (친정팀 출전 불가)
     · 임대 신분 동안 재계약·판매 불가
     · 시즌당 임대 영입 인원 제한 (LOAN_IN_MAX)
   협상은 두 단계 — ① 구단 동의 ② 선수 본인 동의.
═══════════════════════════════════════════════════════════════ */
const LOAN_IN_MAX=3;                 // 한 시즌에 빌려올 수 있는 인원
function loanInCount(t){ return (t.players||[]).filter(p=>p.loan && p.loan.own!==t.id).length; }
function loanedInFrom(t){ return (t.players||[]).filter(p=>p.loan && p.loan.own!==t.id); }
/* 🚫 임대 자체가 성립하지 않는 선수 — 협상 테이블에 앉기도 전에 걸러진다.
   ⚠ 제보 — "이동경(5★)을 너무 쉽게 빌려왔다". 임대는 원래 '안 뛰는 선수'를 내보내는 제도다.
     구단의 핵심 자원은 이적료를 줘도 안 파는데, 공짜로 빌려주는 건 더더욱 말이 안 된다. */
function loanInBlocked(p, from){
  if(!p||!from) return null;
  const t=userTeam();
  const age=G.season-p.by;
  const core = p.ovr >= teamOVR(from)+0.5;
  const share0=squadRole(p, from);          // 프리시즌엔 베스트 XI 편성으로 판단한다
  if(p.army) return `"${p.name} 선수는 군 복무 중입니다."`;
  if(p.loan) return `"이미 임대 중인 선수입니다."`;
  /* 💸 요청(배선) — 급여를 못 주는 구단은 주급 부담을 덜려고 선수를 내놓는다.
     체불 2개월부터는 주전·핵심이라는 이유가 통하지 않는다. 아래 거절 이유를 통째로 건너뛴다. */
  if(waMonths(from.id)<2){
  /* 주전은 임대로 나가지 않는다 — 이건 협상의 여지가 아니라 전제다 */
  if(share0>=0.55 && !(p.unhappy>0))
    return pick([`"${p.name}은 우리 주전입니다. 임대라니요."`,
                 `"매 경기 뛰는 선수를 왜 빌려드리겠습니까."`,
                 `"${p.name} 빼고 이야기하시죠."`]);
  /* 팀 수준을 넘는 핵심 자원 — 안 내준다. 어린 선수라도 이미 주전으로 쓰고 있으면 마찬가지다
     (유망주 임대는 '못 뛰는 어린 선수'를 대상으로 한다) */
  if(core && (age>=22 || share0>=0.5) && !(p.unhappy>0))
    return pick([`"${p.name}은 우리 팀의 핵심입니다. 이적료를 주셔도 안 됩니다."`,
                 `"임대로 내보낼 급의 선수가 아닙니다."`,
                 `"그 선수 이야기라면 여기서 끝내시죠."`]);
  /* 🔁 ⚠ 제보 — 「능력 좋은 선수는 임대가 어렵게」.
     출전 기록은 방금 데려온 선수에게는 아무 근거가 되지 못한다. 「팀 안에서 몇 번째 자원인가」로 본다.
       · 능력 상위 11명 → 주전급이다. 뛰었든 안 뛰었든 빌려주지 않는다.
       · 이번 시즌 새로 데려와 아직 안 뛴 선수 → 써 보지도 않고 내보내지 않는다(상위 18명까지). */
  const rank=(function(){ try{
      const av=from.players.filter(q=>q && avail(q) && !q.loan);
      return av.filter(q=>(q.ovr||0)>(p.ovr||0)).length;
    }catch(e){ return 99; } })();
  const fresh=(p._joinS===G.season) && !((p.mn||0)>0);
  if(rank<11 && !(p.unhappy>0))
    return pick([`"${p.name}은 우리 스쿼드에서 손꼽히는 자원입니다. 임대는 없습니다."`,
                 `"팀에서 ${rank+1}번째로 좋은 선수를 빌려드릴 리가 없죠."`,
                 `"${p.name}? 쓰려고 데리고 있는 선수입니다."`]);
  if(fresh && rank<18 && !(p.unhappy>0))
    return pick([`"${p.name}은 이번에 막 영입한 선수입니다. 써 보지도 않고 내보내지 않습니다."`,
                 `"방금 데려온 선수를 왜 빌려드립니까. 계획이 있어서 뽑은 겁니다."`,
                 `"영입한 지 얼마나 됐다고요. 그 얘기는 다음 시즌에 하시죠."`]);
  /* 자리가 얇으면 여유 자원이 아니다 */
  const depth=from.players.filter(q=>q.pos===p.pos && avail(q)).length;
  if(depth<=2 && p.ovr>=teamOVR(from)-2)
    return `"그 자리에 ${depth}명뿐입니다. 지금 내보낼 수 없습니다."`;
  /* 우리보다 급이 높은 팀은 리그 경쟁자에게 전력을 빌려주지 않는다 */
  if(from.div===t.div && teamOVR(from)>teamOVR(t)+1.5 && p.ovr>=teamOVR(t)-1 && age>=22)
    return `"같은 리그에서 경쟁하는 팀에 전력을 빌려드릴 이유가 없습니다."`;
  }
  return null;
}
/* 그 선수가 우리에게 임대로 올 만한가 — 상대 구단의 판단 (걸러진 뒤의 미세 조정) */
/* ═══ 💰 완전이적 옵션가 ═══════════════════════════════════════════════
   FM처럼 「빌려올 때 완전영입 이적료를 미리 못박는다」. 임대 종료를 기다릴 필요도 없이
   시즌 중에 그 금액으로 바로 사 올 수 있다. 원소속은 헐값에는 도장을 찍지 않는다. */
function loanBuyFair(p){
  let v=0; try{ v=marketValue(p)||0; }catch(e){ v=0; }
  if(!(v>0)) v=Math.max(0.5, (p.ovr||60)*0.35);
  const age=G.season-(p.by||G.season-25);
  let k=1.05;                                     // 임대 프리미엄 — 남의 선수를 미리 찜하는 값
  if(age<=21) k+=0.22; else if(age<=24) k+=0.10; else if(age>=31) k-=0.14;
  k += clamp((((p.pot||p.ovr)-(p.ovr||0))/40), 0, 0.18);   // 성장 여지가 클수록 비싸다
  return Math.max(0.5, Math.round(v*k*10)/10);
}
function loanBuyStep(f){ return f>=200?10 : f>=80?5 : f>=30?2 : f>=10?1 : 0.5; }
/* 💰 계약서에 박힌 옵션가 — 선수가 아무리 커도 이 값은 움직이지 않는다.
   ⚠ 제보 — 「23억에 옵션을 걸었는데 시즌 뒤 값이 45억이 되자 47억을 내라고 한다」.
     금액이 비어 있는 임대(옵션가를 저장하기 전 세이브, 혹은 금액 없이 걸린 옵션)를 만나면
     「오늘 시세」로 다시 계산해 버렸다. 그럼 옵션이 아니라 그냥 이적이다.
   ─ 계약 당시 시세(mv0)를 기준으로 되살리고, 한 번 정해지면 그 자리에서 계약서에
     못박아(L.fee) 다시는 흔들리지 않게 한다. */
function loanOptFee(p){
  const L=p&&p.loan; if(!L) return null;
  if(L.fee!=null) return Math.round(L.fee*10)/10;
  let base=(L.mv0!=null && L.mv0>0) ? L.mv0 : 0;
  if(!(base>0)){ try{ base=marketValue(p)||0; }catch(e){ base=0; } }
  const fee=Math.max(0.5, Math.round(base*1.05*10)/10);
  L.fee=fee;                       // 못박는다 — 다음에 물어도 같은 값이 나온다
  return fee;
}
/* 부른 값이 적정가 대비 어느 정도인가 — 협상 자리에서 상대 표정으로 보여 준다 */
function loanBuyMood(fee, fair){
  const r=fair>0? fee/fair : 1;
  if(r>=1.25) return ["후하게 부르셨군요 — 이건 검토할 만합니다.", "var(--green)"];
  if(r>=1.00) return ["적정선입니다.", "var(--green)"];
  if(r>=0.85) return ["조금 아쉽지만 못 볼 금액은 아닙니다.", "var(--gold)"];
  if(r>=0.65) return ["헐값입니다. 이 조건이면 옵션은 빼시죠.", "var(--gold)"];
  return ["장난하십니까? 그 값에 내줄 선수가 아닙니다.", "var(--red)"];
}
function loanInChance(p, from, share, buyOpt, halfSeason, buyFee){
  const t=userTeam();
  const age=G.season-p.by;
  let c=0.02;
  c -= Math.max(0, p.ovr - teamOVR(from))*0.10;  // 그 팀 수준을 넘을수록 급격히 어려워진다
  c += share*0.42;                               // 주급을 우리가 낼수록 좋다
  if(age<=20) c+=0.30;                           // 유망주는 키워 달라고 오히려 내보낸다
  else if(age<=23) c+=0.16;
  else if(age>=32) c+=0.10;                      // 노장 잉여 자원도 정리하고 싶다
  const depth=from.players.filter(q=>q.pos===p.pos && avail(q)).length;
  if(depth>=6) c+=0.14; else if(depth<=3) c-=0.20;
  const share0=squadRole(p, from);
  if(share0<0.12) c+=0.22;                       // 아예 못 뛰는 선수
  else if(share0<0.30) c+=0.10;
  else c-=0.18;
  if(buyOpt){
    c-=0.12;
    /* 💰 옵션가를 후하게 부르면 오히려 상대가 반긴다 — 헐값이면 문전박대 */
    const _fair=loanBuyFair(p);
    if(_fair>0 && buyFee!=null) c += clamp((buyFee/_fair-1)*0.55, -0.42, 0.20);
  }
  if(halfSeason) c+=0.04;                        // 반 시즌이면 부담이 적다
  if(p.inj>0) c-=0.30;
  if((p.ct||1)<=1) c-=0.14;                      // 계약이 끝나 가면 임대 보낼 이유가 적다
  if(p.unhappy>0) c+=0.20;                       // 본인이 나가고 싶어 하면 길이 열린다
  if(from.div>t.div) c+=0.12;                    // 하부 리그 → 상부 리그 임대는 반긴다
  else if(from.div<t.div) c-=0.18;
  try{ if(typeof G.trust==="object") c += ((G.trust.fans||60)-60)*0.0018; }catch(e){}
  return clamp(c, 0.02, 0.88);
}
/* 선수 본인이 우리 팀으로 오겠는가 */
function loanInAccept(p, from){
  const t=userTeam();
  const age=G.season-p.by;
  let c=0.52;
  c += (teamOVR(t)-teamOVR(from))*0.05;          // 더 좋은 팀이면 반긴다
  if(t.div<from.div) c+=0.20; else if(t.div>from.div) c-=0.22;
  if(squadRole(p, from)<0.25) c+=0.24;           // 못 뛰던 선수는 기회를 원한다
  const depth=t.players.filter(q=>q.pos===p.pos && avail(q)).length;
  if(depth<=2) c+=0.14; else if(depth>=6) c-=0.16;   // 우리 팀에서 뛸 자리가 있는가
  if(age<=21) c+=0.10;
  if((p.pers||0)===1) c+=0.06;                   // 야심가는 기회를 잡는다
  if((p.pers||0)===3) c-=0.06;
  if((p.morale||70)>=80) c-=0.10;                // 지금 팀이 좋다
  return clamp(c, 0.05, 0.95);
}
function loanInRefuseSay(p, from){
  const t=userTeam();
  if(playShare(p)>0.6) return `"저는 ${from.short}에서 주전입니다. 굳이 옮길 이유가 없습니다."`;
  if(t.div>from.div) return `"2부로 내려가라는 말씀이신가요... 그건 좀."`;
  if((p.morale||70)>=80) return `"지금 팀 분위기가 정말 좋습니다. 죄송합니다."`;
  return pick([`"조금만 더 여기서 버텨 보겠습니다."`, `"가족과 상의할 시간이 필요합니다."`]);
}
/* 실제 임대 영입 처리 */
function doLoanIn(p, from, share, buyOpt, halfSeason, buyFee){
  const t=userTeam();
  if(loanInCount(t)>=LOAN_IN_MAX){ gameAlert(`임대 영입은 시즌당 ${LOAN_IN_MAX}명까지 가능합니다.`); return false; }
  from.players.splice(from.players.indexOf(p),1);
  t.players.push(p);
  const _bf = buyOpt ? Math.round((buyFee!=null?buyFee:loanBuyFair(p))*10)/10 : null;
  p.loan={own:from.id, to:t.id, until:G.season+(halfSeason?0:1), half:!!halfSeason,
          share, buy:!!buyOpt, fee:_bf, s:G.season, apps0:p.apps||0,
          mv0:(()=>{ try{ return marketValue(p)||0; }catch(e){ return 0; } })(),
          backR: halfSeason ? ((t.div===1?G.r1:G.r2)+19) : null, inbound:1};
  clearClubBaggage(p, clamp((p.morale||70)+8, 30, 99));
  joinClub(t, p, false);                        // 임대는 새 계약이 아니다 — 재계약 잠금 없음
  LOANIN=null;
  try{ tfLogAdd("in", p, from.short+` (임대${buyOpt?` · 완전이적 옵션 ${_bf}억`:""})`, 0, Math.round(p.wage*share*10)/10, null); }catch(e){}
  notify(`🔁 <b>${p.name}</b> 임대 영입 완료 — ${from.short}에서 ${halfSeason?"반 시즌":"시즌 종료까지"} (주급 분담 ${Math.round(share*100)}%${buyOpt?` · 완전이적 옵션 <b>${_bf}억</b>`:""})`,"good");
  addNews(`🔁 <b>${t.name}</b>, ${from.short} ${p.name} 임대 영입 <span class="small">(${G.season-p.by}세 ${POS_KO[p.pos]||p.pos})</span>`, "good");
  pushFeed({cat:"transfer", ic:"🔁", tone:1, tid:t.id, src:"K리그 공식",
    head:`${t.name}, ${from.short} ${p.name} 임대 영입`,
    sub:`${G.season-p.by}세 ${POS_KO[p.pos]||p.pos}. ${buyOpt?`완전이적 옵션 ${_bf}억이 계약에 포함됐다 — 시즌 중에도 행사할 수 있다.`:"출전 시간을 보장받는 조건이다."}`});
  try{ loanSocial(p, from, "in"); }catch(e){}
  saveGame(); retBack("loancenter");   // ↩ 📥 임대 영입 탭에서 왔으면 그대로 그 탭에 남는다
  return true;
}
/* ── 타 구단 소식: 재계약과 임대 제안 ───────────────────────────
   우리 팀 안에서만 계약이 돌아가면 리그가 정지된 것처럼 보인다. 옆 동네도 주축을 잡고,
   유망주를 빌려 가려고 우리에게 연락한다. 그 소식에 우리 팬과 타팬이 각각 반응한다. */
const AI_RENEW_P=0.07;      // 하루에 리그 전체에서 재계약 소식이 뜰 확률
const LOAN_ASK_P=0.05;      // 하루에 우리에게 임대 요청이 올 확률
function tickAiRenew(){
  if(!transferOpen() && Math.random()<0.6) return;   // 시장이 닫혀 있으면 뜸하다
  if(Math.random()>AI_RENEW_P) return;
  const ut=userTeam();
  const pool=[];
  for(const id in G.teams){ const t=G.teams[id]; if(t.isUser || isArmyTeam(t)) continue;
    for(const p of t.players){ if((p.ct||1)<=1 && p.ovr>=68 && !p.loan && !p.army) pool.push({p,t}); } }
  if(!pool.length) return;
  const {p,t}=pick(pool);
  const yrs=1+R(3), wage=Math.max(p.wage, wageExpect(p.ovr,p.frn,t.div));
  const _ret={p, t, y:yrs};
  p.ct=yrs; p.wage=Math.round(wage*10)/10;
  const V={p:p.name, t:t.short, o:ut.short};
  pushFeed({cat:"transfer", ic:"📝", tone:0, tid:t.id, src:"K리그 공식",
    head:`${t.name}, ${p.name}과/와 재계약 (${yrs}년)`,
    sub:`${G.season-p.by}세 ${POS_KO[p.pos]||p.pos}. 연봉 ${p.wage}억. ${t.short}는 핵심 자원 이탈을 막았다.`});
  // 우리 팬은 남의 재계약을 부러워하거나 안도한다 — 노렸던 선수면 더 그렇다
  const wanted=(G.rumors||[]).some(r=>r.pid===p.id) || p.ovr>=74;
  socialFill(wanted?SOC.rivalRenewWanted:SOC.rivalRenew, 2+R(2), wanted?-1:0, V);
  if(p.ovr>=74) fmkFill(FMK.rivalRenew, 1+R(2), V);
  return _ret;
}
/* 타 구단이 우리 선수를 임대로 빌려 가겠다고 연락해 온다 */
function tickLoanAsk(){
  if(G.jobless) return;              // 무직 — 맡은 선수가 없으니 임대 문의가 올 곳도 없다
  if(!transferOpen()) return;
  if(Math.random()>LOAN_ASK_P) return;
  const t=userTeam(); if(!t) return;
  if((G.loanAsks||[]).length>=3) return;
  const cands=loanCandidates(t).filter(p=>!(G.loanAsks||[]).some(a=>a.pid===p.id));
  if(!cands.length) return;
  const p=pick(cands);
  /* 🎖️ ⚠ 제보 원문 — 「김천에서 임대 제의가 온다고 하는 유저 분이 있으셨는데 … 김천 상무는
     임대 제의 불가, 임대 보내기 불가로 고쳐주시면」. 상무는 입대로만 선수를 받는다 —
     빌려 달라고 연락할 곳이 아니다. (임대 보내기 목록·유망주 위탁 제안에는 이미 빠져 있었고,
     이 「빌려 가겠다」 문의만 걸러지지 않았다) */
  const clubs=Object.values(G.teams).filter(c=>c.id!==t.id
    && !(typeof isArmyTeam==="function" && isArmyTeam(c))
    && c.players.filter(q=>q.pos===p.pos).length<=4);
  if(!clubs.length) return;
  const c=pick(clubs);
  const share=pick([0, 0.25, 0.5]);            // 상대가 요구하는 "우리 부담"
  const buy=Math.random()<0.35, half=Math.random()<0.3;
  (G.loanAsks=G.loanAsks||[]).push({pid:p.id, tid:c.id, share, buy, half, d:G.day||0, s:G.season});
  loanPing("ask", p.id, `🔁 <b>${c.name}</b>이/가 <b>${p.name}</b> 임대를 요청했습니다`);
  notify(`🔁 <b>${c.name}</b>이/가 <b>${p.name}</b> 임대를 문의해 왔습니다 — 🔁 임대 센터에서 확인하세요`, "info");
  pushFeed({cat:"rumor", ic:"🔁", tone:0, tid:c.id, src:pick(MEDIA),
    head:`${c.name}, ${t.short} ${p.name} 임대 추진`,
    sub:`${c.short}는 ${POS_KO[p.pos]||p.pos} 보강이 급하다. ${buy?"완전 이적 옵션을 요구한 것으로 전해졌다.":"단기 임대 형태가 유력하다."}`});
  return {p, c};
}
/* 🔁 타 구단이 먼저 제안해 온다 — "우리 유망주 좀 키워 주십시오"
   출전 기회가 없는 유망주를 가진 구단이 감독의 평판·유스 등급을 보고 연락한다. */
const LOAN_OFFER_P=0.055;
function tickLoanOffer(){
  if(G.jobless) return;              // 무직 — 맡은 팀이 없으니 임대 제안도 오지 않는다
  if(!transferOpen()) return;
  const t=userTeam(); if(!t || isArmyTeam(t)) return;
  if(Math.random()>LOAN_OFFER_P) return;
  if((G.loanOffers||[]).length>=3) return;
  if(loanInCount(t)>=LOAN_IN_MAX) return;
  const pool=[];
  for(const id in G.teams){ const c=G.teams[id];
    if(c.isUser || isArmyTeam(c)) continue;
    for(const p of c.players){
      if(p.loan || p.army || p.inj>0 || p.emg) continue;
      const age=G.season-p.by;
      if(age>23) continue;                       // 유스 임대 — 어린 선수만
      if(squadRole(p, c)>0.30) continue;         // 원소속에서 이미 뛰고 있으면 안 보낸다
      if((p.pot||p.ovr)<p.ovr+4) continue;       // 키울 재목이어야 한다
      if((G.loanOffers||[]).some(o=>o.pid===p.id)) continue;
      pool.push({p, c});
    }
  }
  if(!pool.length) return;
  /* 유스 시설이 좋고 평판이 좋은 감독에게 더 좋은 재목이 온다 */
  const yl=lvEff(t.youthLv||1), rep=clamp((G.trust&&G.trust.fans)||60, 0, 100);   // 🔟
  pool.sort((a,b)=>(b.p.pot||0)-(a.p.pot||0));
  const cut=Math.max(1, Math.round(pool.length*clamp(0.12+yl*0.06+(rep-50)*0.004, 0.08, 0.9)));
  const {p, c}=pick(pool.slice(0, cut));
  const share=pick([0.25, 0.5, 0.5, 0.75]);      // 상대가 제안하는 "우리 부담"
  const buy=Math.random()<0.30, half=Math.random()<0.35;
  /* 💰 상대가 옵션을 걸어 왔다면 금액까지 못박아서 온다 — 대개 적정가보다 조금 세다 */
  const bfee=buy? Math.round(loanBuyFair(p)*(1.00+Math.random()*0.35)*10)/10 : null;
  (G.loanOffers=G.loanOffers||[]).push({pid:p.id, tid:c.id, share, buy, half, fee:bfee, d:G.day||0, exp:14});
  loanPing("offer", p.id, `🔁 <b>${c.name}</b>이/가 유망주 <b>${p.name}</b>을/를 맡아 달라고 제안했습니다`);
  notify(`🔁 <b>${c.name}</b>이/가 유망주 <b>${p.name}</b>을/를 맡아 달라고 제안해 왔습니다 — 🔁 임대 센터에서 확인하세요`,"info");
  pushFeed({cat:"rumor", ic:"🔁", tone:0, tid:c.id, src:pick(MEDIA),
    head:`${c.name}, ${t.short}에 ${p.name} 임대 제안`,
    sub:`${G.season-p.by}세 ${POS_KO[p.pos]||p.pos}. ${c.short}는 출전 기회를 주지 못한 유망주의 성장을 맡길 팀을 찾고 있다.`});
  return {p, c};
}
/* 🔁 유망주 위탁 제안 정리 — ⚠ 제보(스크린샷) — 「임대 센터에서 받은 제안이 있다고 알람이
   뜨는데 정작 받은 제안이 없는 상황」.
   ─ 원인: 배지는 G.loanOffers 의 「개수」를 그대로 세는데, 카드는 선수·구단이 아직 유효한지
     확인하고 무효면 조용히 건너뛰었다(return ""). 제안한 선수가 그새 이적·임대·입대로
     그 구단 명단에서 사라지면 — 배지 1, 목록 0 인 유령이 남았다. 하루 정리(exp--)는
     날짜가 흘러야만 돌아서 그날 안에는 못 지웠다.
     loanAsks 처럼 「셀 때마다」 정리하는 프루너를 두고, 배지·카드가 같은 목록을 본다. */
function loanOffersPrune(){
  if(!Array.isArray(G.loanOffers)){ G.loanOffers=[]; return G.loanOffers; }
  G.loanOffers=G.loanOffers.filter(o=>{
    if(!o || o.pid==null) return false;
    if(!(o.exp>0)) return false;                              // 기한 만료
    const c=G.teams[o.tid]; if(!c) return false;
    const p=c.players.find(x=>x.id===o.pid);
    if(!p) return false;                                      // 이미 그 구단 선수가 아니다
    if(p.loan || p.army) return false;                        // 그새 딴 데로 갔다
    return true;
  });
  return G.loanOffers;
}
function loanOfferCard(){
  const t=userTeam(); const L=loanOffersPrune();
  if(!L.length) return "";
  return L.map((o,i)=>{
    const c=G.teams[o.tid], p=c&&c.players.find(x=>x.id===o.pid);
    if(!p||!c) return "";
    const age=G.season-p.by;
    const myWage=Math.round(p.wage*o.share*10)/10;
    return `<div class="card" style="border-color:var(--gold)">
      <h3>🔁 <span class="clickable" style="text-decoration:underline dotted;text-underline-offset:3px" title="${c.name} 스쿼드 보기" onclick="openTeamSquad('${c.id}')">${c.name}</span>의 임대 제안 <span class="small">— 답변 기한 D-${Math.max(0,o.exp)}</span></h3>
      <p><b class="clickable" onclick="showPlayerInfoPopup(event,${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})">${nmF(p)}</b> <span class="small pos-${p.pos}">${p.pos}</span> · ${age}세 · ${prefSlotOf(p)} · ${abilityStars(p)}</p>
      <p class="small">잠재력 ${potentialStars(p)} · 원소속 출전 지분 ${Math.round(playShare(p)*100)}% · 연봉 ${p.wage}억</p>
      <p class="small">조건: ${o.half?"반 시즌":"시즌 종료까지"} · 우리 주급 부담 <b>${Math.round(o.share*100)}%</b>(${myWage}억)${o.buy?` · <b style="color:var(--gold)">완전이적 옵션 ${o.fee!=null?o.fee+"억":""}</b>`:""}</p>
    ${o.buy?`<p class="small" style="opacity:.85">💰 옵션가는 계약과 함께 고정됩니다 — 시즌 중에도 임대 센터에서 바로 행사할 수 있습니다. <span style="opacity:.75">(적정가 ${loanBuyFair(p)}억)</span></p>`:""}
      <p class="small" style="opacity:.85">"${pick([`저희 팀에선 기회를 못 주고 있습니다. 잘 좀 키워 주십시오.`,`${t.short} 감독님이라면 믿고 맡기겠습니다.`,`이 나이엔 벤치보다 경기가 필요합니다.`])}"</p>
      <div style="display:flex;gap:8px">
        <button class="mini" style="flex:1;padding:10px;border-color:var(--gold);color:var(--gold);font-weight:800" onclick="acceptLoanOffer(${i})">🤝 받아들인다</button>
        <button class="mini" style="padding:10px" onclick="rejectLoanOffer(${i})">거절</button>
      </div></div>`;
  }).join("");
}
function acceptLoanOffer(i){
  const t=userTeam(); const o=(G.loanOffers||[])[i]; if(!o) return;
  const c=G.teams[o.tid], p=c&&c.players.find(x=>x.id===o.pid);
  G.loanOffers.splice(i,1);
  if(!p||!c){ show("nego"); return; }
  if(loanInCount(t)>=LOAN_IN_MAX){ gameAlert(`임대 영입은 시즌당 ${LOAN_IN_MAX}명까지 가능합니다.`); show("nego"); return; }
  doLoanIn(p, c, o.share, o.buy, o.half, o.buy?o.fee:null);
  show("loancenter");        // ↩ 📨 받은 제안 탭에 그대로 남는다
}
function rejectLoanOffer(i){
  const o=(G.loanOffers||[])[i]; if(!o) return;
  const c=G.teams[o.tid], p=c&&c.players.find(x=>x.id===o.pid);
  G.loanOffers.splice(i,1);
  addNews(`🔁 ${c?c.short:"상대 구단"}의 ${p?p.name:"선수"} 임대 제안을 거절했습니다.`);
  saveGame(); show("loancenter");
}
function acceptLoanAsk(i){
  const t=userTeam(); const a=(G.loanAsks||[])[i]; if(!a) return;
  const p=t.players.find(x=>x.id===a.pid), c=G.teams[a.tid];
  if(!p||!c){ G.loanAsks.splice(i,1); show("nego"); return; }
  G.loanAsks.splice(i,1);
  // 구단은 이미 원하고 있다 — 남은 건 선수 본인의 동의뿐
  if(Math.random()<loanPlayerAccept(p, c)){
    doLoanMove(p, c, a.share, a.buy, a.half);
  } else {
    LOANUI={pid:p.id, refuse:{club:c.id, share:a.share, buy:a.buy, half:a.half,
      say:loanRefuseSay(p, c), canPersuade:(p._persuadeR!==(t.div===1?G.r1:G.r2))}};
    loanSocial(p, c, "refuse");
    show("loan");
  }
}
function rejectLoanAsk(i){
  const a=(G.loanAsks||[])[i]; if(!a) return;
  const c=G.teams[a.tid], p=userTeam().players.find(x=>x.id===a.pid);
  G.loanAsks.splice(i,1);
  if(p) affAdd(p, -2, "임대 제안 거절");
  addNews(`🔁 ${c?c.short:"상대 구단"}의 ${p?p.name:"선수"} 임대 문의를 거절했습니다.`);
  saveGame(); show("nego");
}
/* ⚠ 제보 — 「임대 센터에 지난 시즌부터 들어온 임대 문의(1건)가 뜨는데 내용이 없다」.
   목록 건수는 배열 길이로 세면서, 정작 그리는 쪽은 선수나 구단을 못 찾으면 빈 문자열을 돌려줬다.
   그래서 선수를 팔았거나 시즌이 바뀌어 사라진 문의가 「1건」으로만 남아 영원히 떠 있었다.
   ─ 목록을 그리기 전에 먼저 청소하고, 문의는 시즌을 넘기지 않는다. */
function loanAsksPrune(){
  const t=userTeam();
  if(!Array.isArray(G.loanAsks)) { G.loanAsks=[]; return G.loanAsks; }
  G.loanAsks=G.loanAsks.filter(a=>{
    if(!a || a.pid==null) return false;
    if(a.s!=null && a.s!==G.season) return false;            // 지난 시즌 문의는 만료
    if(!t) return false;
    const p=t.players.find(x=>x.id===a.pid);
    if(!p) return false;                                     // 이미 우리 선수가 아니다
    if(p.loan || p.army || p.emg) return false;              // 이미 임대 중이거나 내보낼 수 없는 선수
    const c=G.teams[a.tid];
    /* 🎖️ 상무발 문의는 애초에 생기지 않지만, 옛 세이브에 남아 있던 것도 여기서 걷어낸다 (제보) */
    if(c && typeof isArmyTeam==="function" && isArmyTeam(c)) return false;
    return !!c;
  });
  return G.loanAsks;
}
function loanAskCard(){
  const t=userTeam(); const list=loanAsksPrune();
  if(!list.length) return "";
  return `<div class="card"><h3>🔁 들어온 임대 문의 (${list.length}건)</h3>
    ${list.map((a,i)=>{ const p=t.players.find(x=>x.id===a.pid), c=G.teams[a.tid];
      if(!p||!c) return "";
      const acc=loanPlayerAccept(p, c);
      const L=acc>=0.65?["수락 유력","var(--green)"]:acc>=0.4?["반반","var(--gold)"]:["거절 유력","var(--red)"];
      return `<div class="msg info" style="margin-bottom:8px">
        <b class="clickable" style="text-decoration:underline dotted;text-underline-offset:3px" title="${c.name} 스쿼드 보기" onclick="openTeamSquad('${c.id}')">${c.name}</b>이/가 <b class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</b> (${G.season-p.by}세 ${POS_KO[p.pos]||p.pos}) 임대를 원합니다.
        <span class="tag" style="background:${a.half?"#33280f":"#12331d"};color:${a.half?"#e3b341":"#7ee2a8"}">${a.half?"반 시즌 (시즌 중 복귀)":"시즌 종료까지"}</span><br>
        <span class="small">우리 주급 분담 ${Math.round(a.share*100)}%
          (${Math.round(p.wage*a.share*10)/10}억) · ${a.buy?"완전이적 옵션 포함":"옵션 없음"}
          · 올 시즌 ${p.apps||0}경기 · 선수 반응 <b style="color:${L[1]}">${L[0]}</b></span><br>
        <button class="mini" style="margin-top:6px" onclick="acceptLoanAsk(${i})">✅ 보내기</button>
        <button class="mini" onclick="rejectLoanAsk(${i})">🚫 거절</button></div>`;}).join("")}
  </div>`;
}
/* ── 이적시장 윈도우: 겨울 6주(1~6R) · 여름 6주(19~24R), 1라운드=1주 ── */
/* 이적시장은 실제 달력 날짜로 연다.
   겨울 — 1월 1일부터 3월 마지막 주(3/31)까지. 프리시즌 내내 열려 있다.
   여름 — 7월 1일부터 6주간. */
function windowInfo(){
  if(G.phase==="seasonEnd") return {open:false, label:"시즌 종료"};
  if(!G.cal) return {open:false, label:"이적시장 준비 중"};
  const day=G.day||0;
  const dayOfDate=(m,dd)=>Math.round((new Date(G.cal.y, m, dd) - new Date(G.cal.y, CAL_START[0], CAL_START[1]))/86400000);
  const wEnd=dayOfDate(WIN_WINTER_END[0], WIN_WINTER_END[1]);
  const sStart=dayOfDate(WIN_SUMMER_START[0], WIN_SUMMER_START[1]);
  const sEnd=sStart+WIN_SUMMER_WEEKS*7-1;
  /* ⚠ 제보 — 「이적시장이 넉넉히 남았는데 마감까지 0주라고 뜬다」.
     화면이 창 길이를 6주로 못박아 두고 「7 − 주차」로 남은 기간을 계산하고 있었다.
     겨울 창은 1월 1일~3월 31일, 즉 13주다. 7주차부터는 남은 기간이 0이나 음수가 됐다.
     창마다 실제 길이(weeks)와 마감일(end)을 함께 돌려준다 — 화면은 이 값만 쓴다. */
  if(day<=wEnd) return {open:true, name:"겨울", week:Math.floor(day/7)+1,
                        weeks:Math.max(1, Math.ceil((wEnd+1)/7)), left:wEnd-day, end:wEnd};
  if(day>=sStart && day<=sEnd) return {open:true, name:"여름", week:Math.floor((day-sStart)/7)+1,
                        weeks:WIN_SUMMER_WEEKS, left:sEnd-day, end:sEnd};
  if(day<sStart){
    const dt=dateOfDay(sStart);
    return {open:false, label:`여름 이적시장은 ${dt.getMonth()+1}월 ${dt.getDate()}일에 열립니다 (D-${sStart-day})`};
  }
  return {open:false, label:"이적시장 종료 (내년 겨울에 열림)"};
}
function transferOpen(){ return windowInfo().open; }
function listForSale(pid, quiet){
  if(armyGate("선수 판매")) return;
  const ut=userTeam(); const p=ut.players.find(x=>x.id===pid); if(!p) return;
  if(p.emg){ flash("🚨 긴급 등록 선수는 임시 소집 신분입니다 — 이적·판매할 수 없습니다.","warn"); return; }
  if(p.loan){ flash("🔁 임대 선수는 우리 소유가 아닙니다 — 판매할 수 없습니다.","warn"); return; }
  if(G.transferBids.some(b=>b.pid===pid)) return;
  G.transferBids.push({pid});
  addNews(`📤 ${p.name} 이적명단 등록 (예상 이적료 약 ${marketValue(p)}억)`);
  if(quiet) return; // 본인이 원해서 (이적 허용 경로)
  // ── 등록 소식을 들은 선수의 반응
  const pers=p.pers||0;
  /* 이적명단 등록은 선수 입장에서 통보다. 예전에는 알림 한 줄로 끝났는데,
     이제는 수석코치가 회의 안건으로 들고 와 감독이 직접 풀 수 있게 한다. */
  const toAgenda=(why, extraTxt)=>{
    p.unhappy=Math.max(p.unhappy||0, 1); p.uWhy=why;
    if(G.staff && G.staff.handled) delete G.staff.handled[p.id];
    addMood(`📤 ${p.name}이(가) 이적명단 등록 소식을 들었습니다. ${extraTxt||""} (스태프 회의에서 면담 가능)`);
  };
  if(p.unhappy>0){
    p.morale=clamp(p.morale+3,30,99);
    notify(`💬 ${p.name}: "잘됐군요. 서로 갈 길을 가는 겁니다." (원하던 이적 — 사기 +3)`,"good");
  } else if(pers===3){ // 다혈질
    if(Math.random()<0.5){
      // 감독을 신뢰하는 선수는 여기까지 오지 않는다 — 화는 나도 훈련장에는 나온다
      if(aff(p)>=62 && Math.random()<0.55){
        p.morale=clamp(p.morale-10,25,99); affAdd(p,-8,"이적 무산");
        notify(`😤 ${p.name}: "...감독님을 믿고 남겠습니다. 대신 기회는 주십시오." (태업까지는 가지 않았습니다)`,"warn");
      } else {
        p.sulk=4; p.morale=35; affAdd(p,-12,"이적명단 등록");
        toAgenda("이적명단 등록", "태업에 들어갔습니다.");
        notify(`🔥 <b>태업 돌입!</b> ${p.name} 폭발: "나를 팔겠다고?! 그럼 뛰나 봐라!" — 훈련 거부 (4라운드 결장, 스태프 회의에서 면담 가능)`,"warn");
      }
    } else {
      p.morale=clamp(p.morale-9,30,99); affAdd(p,-7,"이적명단 등록");
      toAgenda("이적명단 등록");
      notify(`💢 ${p.name}: "면전에서 말도 없이 명단에 올려요? 실망입니다." (사기 -9, 불만 발생)`,"warn");
    }
  } else if(pers===1){ // 야심가 — 오히려 기회로 본다. 다만 눈이 높다.
    p.morale=clamp(p.morale-1,30,99); affAdd(p,-2,"이적명단 등록");
    notify(`😏 ${p.name}: "어차피 저는 더 큰 무대로 갈 몸이었습니다. 강팀 제안만 가져오세요." (약팀 제안은 본인이 거부할 수 있음)`,"info");
  } else if(pers===2){ // 온화
    if(p.morale>=65&&Math.random()<0.35){
      p.noMove=true; p.morale=clamp(p.morale-6,30,99); affAdd(p,-4,"이적명단 등록");
      toAgenda("이적명단 등록", "잔류를 원하고 있습니다.");
      notify(`😢 <b>잔류 선언!</b> ${p.name}: "저... 이 팀에 남고 싶습니다. 아무 데도 안 갑니다." — 제안이 와도 개인 협상을 거절합니다. (스태프 회의에서 면담 가능)`,"warn");
    } else {
      p.morale=clamp(p.morale-8,30,99); affAdd(p,-6,"이적명단 등록");
      toAgenda("이적명단 등록");
      notify(`😢 ${p.name}: "제가... 부족했나 봅니다." (크게 상심 — 사기 -8)`,"warn");
    }
  } else { // 프로페셔널 — 담담하지만 아주 무덤덤하지는 않다
    p.morale=clamp(p.morale-3,30,99); affAdd(p,-3,"이적명단 등록");
    if(Math.random()<0.35) toAgenda("이적명단 등록");
    notify(`💬 ${p.name}: "프로의 세계니까요. 구단의 결정을 존중합니다." (사기 -3)`,"info");
  }
}
function unlist(pid){
  const p=userTeam().players.find(x=>x.id===pid);
  G.transferBids=G.transferBids.filter(b=>b.pid!==pid);
  G.offers=(G.offers||[]).filter(o=>o.pid!==pid);
  if(p){
    clearAllowOut(p);                                   // 명단에서 뺐다 — 보내 주기로 한 약속도 없던 일
    if(p.uWhy==="이적명단 등록"){ p.unhappy=0; p.uWhy=""; affAdd(p,+5,"이적명단 철회"); }
    if(p.noMove){ p.noMove=false; p.morale=clamp(p.morale+5,30,99); notify(`💙 ${p.name}: "남게 해주시는 거군요. 감사합니다, 감독님." (잔류 선언 해제)`,"good"); }
    else if(p.sulk>0){ p.sulk=0; p.morale=55; notify(`😔 ${p.name}, 이적명단 철회 소식에 태업을 풀고 훈련에 복귀했습니다.`,"good"); }
    else if(p.uWhy==="이적명단 등록"){ p.unhappy=0; p.uWhy=""; p.morale=clamp(p.morale+4,30,99); notify(`💬 ${p.name}: "다시 믿어보겠습니다." (명단 철회 — 불만 해소)`,"good"); }
  }
  show(VIEW);
}
/* 매주 유저 선수에게 들어오는 오퍼 */
/* AI 구단도 이적시장 기간 중 계약 만료 임박·노장·저평가 선수를 방출해 FA 시장을 채운다 */
function aiReleaseCheck(){
  if(!Array.isArray(G.freeAgents)) G.freeAgents=[];
  const _glut = G.freeAgents.length>=28;   // FA 시장 과포화 — 넘치는 스쿼드만 정리한다
  for(const id in G.teams){
    const t=G.teams[id];
    if(t.isUser) continue;
    if(isArmyTeam(t)) continue;        // 복무 중인 선수는 방출 대상이 아니다
    if(t.players.length<=20) continue; // 최소 스쿼드 규모 유지
    /* ⚠ 제보 — 「해가 갈수록 리그 수준이 떨어진다」. 실측해 보니 AI 스쿼드가 시즌마다 불어나
       6시즌 만에 37명 → 88명이 됐다. 유스·FA 영입은 계속 들어오는데 방출 검토가 「FA 시장이
       한산할 때만, 낮은 확률로」였기 때문이다. 두꺼운 스쿼드는 어린 저능력 선수로 채워져
       팀 평균과 리그 전체의 눈금을 끌어내린다.
       ─ 정원(K1 32 · K2 29)을 넘어서면 FA 시장 사정과 무관하게 매번 정리한다. */
    const _cap=(t.div===1?32:29)+4;
    const _over=t.players.length>_cap;
    if(!_over && Math.random() > (t.players.length>=34 ? 0.30 : 0.08)) continue;
    const avg=teamOVR(t);
    const over=t.players.length>=34;   // 스쿼드가 너무 두꺼우면 기준을 넓힌다
    const relN=_over ? Math.min(3, t.players.length-_cap) : 1;   // 정원 초과분은 한 번에 여러 명
    if(_glut && !_over) continue;
    const cands=t.players.filter(p=>{
      const age=G.season-p.by, ctExp=(p.ct||1)<=1;
      if(p.army) return false;                    // 복무 중인 선수는 대상이 아니다
      /* 🌱 ⚠ 제보 — 여기가 「포텐 160짜리 신민하가 FA 로 풀린」 경로다. 정원 초과 정리는
         현재 능력만 보고 잘라서, 아직 안 자란 특급 유망주가 제일 먼저 걸렸다. */
      if(aiKeepTalent(p)) return false;
      if(age<=24 && dispPot(p)>=140) return false;
      if(_over && p.ovr<=avg-3) return true;      // 정원 초과 — 평균에 못 미치면 정리 대상
      if(over && p.ovr<=avg-5 && age>=26) return true;
      return age>=34 || (ctExp&&age>=30) || (ctExp&&p.ovr<=avg-9);
    });
    if(!cands.length) continue;
    cands.sort((a,b)=>a.ovr-b.ovr);
    for(let _k=1; _k<relN && cands.length>_k; _k++){
      const ex=cands[_k];
      if(t.players.length<=20) break;
      t.players.splice(t.players.indexOf(ex),1);
      ex.ct=0; ex.wage=Math.max(0.2, Math.round(ex.wage*0.75*10)/10);
      try{ clearClubBaggage(ex, 60); }catch(e){}
      (G.freeAgents=G.freeAgents||[]).push(ex);
    }
    const rel=cands[0]; // 가장 활용도 낮은 방출 후보부터
    t.players.splice(t.players.indexOf(rel),1);
    const sever=Math.round(rel.wage*(rel.ct||1)*0.5*10)/10;
    t.budget=Math.round((t.budget-sever)*10)/10;
    clearClubBaggage(rel, 60); rel.ct=1;
    G.freeAgents.push(rel);
    addNews(`📋 ${t.short}, ${rel.name}(${rel.pos}·${G.season-rel.by}세) 방출 — FA 시장에 나왔습니다.`);
  }
}
/* 타 구단끼리도 서로 선수를 사고판다 — 유저와 무관하게 이적시장이 살아있게.
   현금 이적 외에도 선수-선수 스왑, 스왑+현금(차액 정산) 딜이 섞여서 활발하게 일어난다. */
function aiToAiTransferCheck(){
  const rounds = Math.random()<0.45 ? 2 : 1; // 활발한 이적시장 — 가끔 한 주에 두 건씩 발생
  for(let n=0;n<rounds;n++){
    if(Math.random()>0.55) continue; // 건별 발생 확률
    const clubs=Object.values(G.teams).filter(t=>!t.isUser && !isArmyTeam(t));
    const sellers=clubs.filter(t=>t.players.length>20);
    if(!sellers.length) continue;
    const seller=pick(sellers);
    const avg=teamOVR(seller);
    // 판매 후보: 대체로 주전급 아래 선수 위주 (에이스 급 판매는 드묾)
    const cands=seller.players.filter(p=>p.ovr<avg+5 && (G.season-p.by)<35);
    if(!cands.length) continue;
    const p=pick(cands);
    const mv=marketValue(p);
    /* 🏢 요청 — 긴축재정에 들어간 구단은 이적시장에서 조용해진다. 그 틈이 유저에게 기회가 된다 */
    const buyers=clubs.filter(t2=>t2.id!==seller.id && t2.players.length<32 && !ceAusterity(t2.id));
    if(!buyers.length) continue;
    const buyer=pick(buyers);
    const dealType=Math.random();
    if(dealType<0.5 || buyer.players.length<16){
      // 현금 이적
      const fee=Math.round(mv*(0.75+Math.random()*0.5)*10)/10;
      if(buyer.budget<fee) continue;
      seller.players.splice(seller.players.indexOf(p),1);
      buyer.players.push(p); joinClub(buyer, p);
      seller.budget=Math.round((seller.budget+fee)*10)/10;
      buyer.budget=Math.round((buyer.budget-fee)*10)/10;
      clearClubBaggage(p, 75); p.ct=aiCtYears(p);
      addNews(`🔄 <b>${buyer.short}</b>, <b>${seller.short}</b>의 ${p.name}(${p.pos}) 영입! (이적료 ${fee}억)`, null, "club",
        {cat:"transfer", ic:"💸", tid:buyer.id,
         head:`${buyer.name}, ${seller.short} ${p.name} 영입 완료`,
         sub:`이적료 ${fee}억 · ${G.season-p.by}세 ${POS_KO[p.pos]||p.pos} · 계약 ${p.ct}년`});
    } else {
      // 선수-선수 스왑(가치 차액은 현금으로 정산 — 순수 스왑이 될 수도 있다)
      const swapCand=buyer.players.filter(q=>{
        const qmv=marketValue(q); return qmv>=mv*0.25 && qmv<=mv*1.5 && (G.season-q.by)<35;
      });
      if(!swapCand.length) continue;
      const q=pick(swapCand);
      const qmv=marketValue(q);
      const diff=mv-qmv; // 양수면 seller가 받는 선수(p)가 더 비쌈 → buyer가 차액 현금도 지불
      let fee=Math.round(Math.abs(diff)*(0.6+Math.random()*0.4)*10)/10;
      const payer = diff>0 ? buyer : seller;
      if(fee>0 && payer.budget<fee) fee=0; // 지불 여력이 없으면 현금 없이 순수 스왑으로 진행
      seller.players.splice(seller.players.indexOf(p),1); buyer.players.push(p); joinClub(buyer, p);
      buyer.players.splice(buyer.players.indexOf(q),1); seller.players.push(q); joinClub(seller, q);
      for(const x of [p,q]){ x.unhappy=0; x.uWhy=""; x.promise=null; x.sulk=0; x.noMove=false; x.morale=75; x.ct=aiCtYears(x); }
      if(fee>0){
        if(diff>0){ buyer.budget=Math.round((buyer.budget-fee)*10)/10; seller.budget=Math.round((seller.budget+fee)*10)/10; }
        else { seller.budget=Math.round((seller.budget-fee)*10)/10; buyer.budget=Math.round((buyer.budget+fee)*10)/10; }
      }
      addNews(`🔀 <b>${buyer.short}</b> ↔ <b>${seller.short}</b> 선수 교환: ${p.name}(${p.pos}) ↔ ${q.name}(${q.pos})${fee>0?` (+ 현금 ${fee}억)`:''}`, null, "club",
        {cat:"transfer", ic:"🔀", tid:buyer.id,
         head:`${buyer.short}-${seller.short} 맞교환… ${p.name} ↔ ${q.name}`,
         sub:`${fee>0?`현금 ${fee}억이 오가는 딜. `:"순수 맞교환. "}양 구단 모두 포지션 정리에 나섰다.`});
    }
  }
}
/* 이적 제안에 "선수 포함" 딜(스왑 또는 스왑+현금)을 확률적으로 붙인다 — 상대 구단이 현금 대신(또는 일부만)
   자기 팀 선수를 끼워서 제안해오는 경우를 재현한다. targetMV: 유저 선수의 시장가치, feeRange: 순수 현금일 때 배율 범위 */
function pickSwapCandidate(buyer, targetMV){
  const cands=buyer.players.filter(p=>{
    /* 🔀 임대·군 복무·긴급 등록 선수는 상대도 내줄 수 없다 — 제안에 끼워 오지 않는다 */
    if(p.loan || p.army || p.emg) return false;
    const mv=marketValue(p);
    return mv>=targetMV*0.25 && mv<=targetMV*0.95 && (G.season-p.by)<34 && p.pos!=="GK";
  });
  return cands.length?pick(cands):null;
}
/* 🔀 선수 끼워팔기(스왑) 제의를 아예 받지 않는 설정.
   ⚠ 제보 — 「현금+선수 제의는 볼 것도 없이 거절하는데, 매번 목록에 쌓여 눈에 걸린다」.
     구단이 「현금 외의 제안은 받지 않는다」는 방침을 세워 둔 것으로 본다.
     프런트 선에서 걸러지므로 감독 책상까지 올라오지 않는다 — 대신 몇 건을 돌려보냈는지는 알려 준다. */
function swapBlocked(){ return !!(G.opt && G.opt.noSwap); }
function toggleNoSwap(){
  G.opt=G.opt||{};
  G.opt.noSwap=!G.opt.noSwap;
  if(G.opt.noSwap){
    /* 켜는 순간, 이미 와 있던 스왑 제의도 함께 정리한다 */
    const n=(G.offers||[]).filter(o=>o.swapPid).length;
    G.offers=(G.offers||[]).filter(o=>!o.swapPid);
    G.swapNo=(G.swapNo||0)+n;
    flash(n?`🔀 선수 끼워팔기 제의를 받지 않습니다 — 대기 중이던 ${n}건도 함께 돌려보냈습니다.`
           :"🔀 앞으로 선수 끼워팔기 제의는 받지 않습니다. 현금 제안만 올라옵니다.","good");
  } else flash("🔀 선수 끼워팔기 제의도 다시 받습니다.","info");
  saveGame(); show("offers");
}
function buildDeal(buyer, targetMV, feeRange){
  let swapPid=null, fee=Math.round(targetMV*(feeRange[0]+Math.random()*(feeRange[1]-feeRange[0]))*10)/10;
  /* ⚠ 여기서 스왑 자체를 막으면 「선수+적은 현금」이 「전액 현금」으로 바뀌어 오히려 유리해진다.
     제안은 그대로 오게 두고, 아래 호출부에서 프런트가 반려한다 — 그래야 「거절」이 거절답다. */
  if(Math.random()<0.32){
    const sc=pickSwapCandidate(buyer, targetMV);
    if(sc){
      swapPid=sc.id;
      const scMv=marketValue(sc);
      fee=Math.max(0, Math.round((targetMV-scMv)*(0.7+Math.random()*0.5)*10)/10);
    }
  }
  return {fee, swapPid};
}
function genOffers(){
  if(!G.offers) G.offers=[];
  if(!transferOpen()){ G.offers=[]; return; }
  aiReleaseCheck();
  aiToAiTransferCheck();
  /* 🕊️ 무직 — 내 선수가 없으니 나에게 오는 영입 제안도 없다.
     ⚠ 가드를 함수 맨 위에 두면 AI끼리의 이적·방출까지 멈춰 리그가 얼어붙는다. 여기가 맞는 자리다. */
  if(G.jobless){ G.offers=[]; return; }
  const ut=userTeam();
  /* ⚠ 제보 — "3/31에 온 제안이 진행 누르면 확인도 못 하고 증발". 유저가 제의 탭을 아직
     열어보지 않은 제안(o.seen 없음)은 만료를 최대 3번까지 유예한다 — 볼 기회는 준다. */
  G.offers=G.offers.filter(o=>{
    if(!o.seen && o.exp<=1 && (o.grace||0)<3) o.grace=(o.grace||0)+1;
    else o.exp--;
    return o.exp>0 && ut.players.some(p=>p.id===o.pid);
  });
  for(const b of G.transferBids){
    const p=ut.players.find(x=>x.id===b.pid); if(!p) continue;
    if(b.d0==null) b.d0=G.day||0;                      // 등록일 — 아래 보장 판정의 기준
    /* ⚠ 제보 — 「어빌 187 준척급 스트라이커를 명단에 올렸는데 제의가 한 번도 안 왔다」.
       제의 생성은 확률의 연쇄(하루 22% × 80%)인 데다 경기일·멈춤이 겹친 날은 아예 건너뛰고,
       「끼워팔기 받지 않음」이면 스왑 제의가 소리 없이 반려된다 — 운이 나쁘면 창이 끝나도록
       0건이 될 수 있다. 등록 10일이 지나도록 한 건도 못 받은 선수는 다음 기회에 현금 제의를
       보장한다. 시장에 내놓은 준척급을 아무도 안 쳐다보는 그림은 게임으로도 이상하다. */
    const must = ((G.day||0)-(b.d0||0)>=10) && !(b.got>0);
    // 이적명단 등록 선수는 시장에 알려져 제안이 빨리, 많이 온다
    if(G.offers.filter(o=>o.pid===p.id).length<3 && (must || Math.random()<0.8)){
      const _bs=Object.values(G.teams).filter(t2=>!t2.isUser && !isArmyTeam(t2) && !ceAusterity(t2.id));
      if(!_bs.length) continue;                                        // 🏢 긴축재정 — 살 만한 구단이 없다
      const buyer=pick(_bs);
      let {fee,swapPid}=buildDeal(buyer, marketValue(p), [0.8,1.3]);
      if(swapPid && swapBlocked()){
        if(must){ swapPid=null; fee=Math.round(marketValue(p)*(0.85+Math.random()*0.35)*10)/10; }  // 보장 건 — 현금으로 바꿔 온다
        else { G.swapNo=(G.swapNo||0)+1; continue; }   // 프런트 선에서 반려 — 기사도 나지 않는다
      }
      if(!p.emg){ G.offers.push({pid:p.id, tid:buyer.id, fee, exp:3, swapPid}); b.got=(b.got||0)+1; }
      addNews(fixJosa(`📨 ${buyer.short}이/가 ${p.name} 영입 제안 (${swapPid?`선수 교환 제안${fee>0?` + 현금 ${fee}억`:''}`:`이적료 ${fee}억`}) — 타 구단 제의 탭에서 처리`));
    }
  }
  if(Math.random()<0.14){ // 핵심 선수 노리는 기습 오퍼
    const stars=ut.players.filter(p=>p.ovr>=75&&!G.transferBids.some(b=>b.pid===p.id)&&!G.offers.some(o=>o.pid===p.id));
    if(stars.length){
      const p=pick(stars);
      const rich=Object.values(G.teams).filter(t2=>!t2.isUser && !isArmyTeam(t2) && t2.budget>marketValue(p)*0.5);
      if(rich.length){ const buyer=pick(rich); const {fee,swapPid}=buildDeal(buyer, marketValue(p), [1.0,1.4]);
        if(swapPid && swapBlocked()){ G.swapNo=(G.swapNo||0)+1; }
        else{
        if(!p.emg) G.offers.push({pid:p.id,tid:buyer.id,fee,exp:3,swapPid});
        addNews(fixJosa(`📨 ${buyer.short}이/가 핵심 선수 ${p.name} 영입 협상을 요청했습니다! (${swapPid?`선수 교환 제안${fee>0?` + 현금 ${fee}억`:''}`:`제안 ${fee}억`})`));
        // 선수 귀에 들어간 관심
        if(p.pers===1){ p.morale=clamp(p.morale+2,30,99); addMood(`👂 ${p.name}이(가) ${buyer.short}의 관심 소식을 들었습니다. 야심가의 눈빛이 반짝입니다.`); }
        else if(teamOVR(buyer)>teamOVR(ut)+0.5&&Math.random()<0.5) addMood(`👂 ${p.name}: "제안이 왔다고요? ...일단 축구에 집중하겠습니다."`);
        }
      }
    }
  }
  /* ═══════════════════════════════════════════════════════════
     🆓 AI 구단의 FA 영입
     ⚠ 제보 — 「방출한 좋은 선수가 팀을 못 찾고 계속 FA 로 남아 있다」.
        예전에는 목록에서 완전 무작위로 한 명을 뽑았다. 시장에 80명이 쌓여 있으면
        리그 최상급 자원이 뽑힐 확률도 1/80 이라, 잘하는 선수일수록 오히려 오래 방치됐다.
        게다가 데려가는 구단도 무작위여서, 그 자리가 이미 넘치는 팀이 또 데려가곤 했다.
        (구단을 못 찾으면 return 으로 함수를 통째로 빠져나가 뒤의 제안 생성까지 건너뛰는 버그도 있었다)
     ─ 좋은 선수가 먼저 팔리고, 그 선수를 실제로 필요로 하는 구단이 데려간다.
     ═══════════════════════════════════════════════════════════ */
  if(G.freeAgents && G.freeAgents.length){
    /* 시장에 사람이 쌓여 있을수록 거래도 활발하다.
       ⚠ 실측(3시즌) — OVR 76 짜리가 3시즌째 시장에 남아 있었다(쟈고 28→30세). 시장 인원도
       92→146 으로 계속 불었다. 시도 횟수와 성사율이 둘 다 모자랐다.
       ─ 좋은 자원이 있으면 그만큼 더 자주, 더 확실하게 움직인다 (요청 — 「AI 구단도 필사적으로」). */
    const _hotFA=G.freeAgents.filter(q=>q && !q.army && (q.ovr>=70 || dispPot(q)>=155)).length;
    const tries=1+Math.floor(Math.min(3, G.freeAgents.length/25))+Math.min(4, Math.floor(_hotFA/2));
    for(let n=0; n<tries; n++){
      if(Math.random() >= (_hotFA>0 ? 0.82 : 0.34)) continue;
      if(!G.freeAgents.length) break;
      /* 능력 가중 추첨 — 표본을 여럿 뽑아 그중 가장 나은 선수가 자리를 찾는다.
         나이가 많으면 그만큼 손이 덜 간다. */
      let fa=null, bs=-1e9;
      const sample=Math.min(G.freeAgents.length, 24);   // ⚠ 14 → 24 (좋은 자원이 묻히지 않게)
      for(let i=0;i<sample;i++){
        const c=pick(G.freeAgents); if(!c || c.army) continue;
        const _cAge=G.season-(c.by||2000);
        /* 🌱 잠재력도 값이다 — 어리고 재능 있는 FA 는 지금 능력이 낮아도 서로 데려가려 한다 */
        const _potB=Math.max(0, (dispPot(c)-140))*(_cAge<=24?0.10:_cAge<=27?0.05:0);
        const sc=(c.ovr||60) + _potB + Math.random()*9 - Math.max(0,_cAge-30)*1.4;
        if(sc>bs){ bs=sc; fa=c; }
      }
      if(!fa) continue;
      /* 그 선수를 쓸 만한 구단 — 수준이 맞고, 그 자리가 아직 비어 있고, 쿼터도 남아야 한다 */
      const want=Object.values(G.teams).filter(t2=>{
        if(t2.isUser || isArmyTeam(t2) || (t2.players||[]).length>=32) return false;
        if(ceAusterity(t2.id)) return false;                           // 🏢 긴축재정 — 지갑을 닫았다
        /* 좋은 자원·유망주는 문턱을 넓게 본다 — 상위 팀도 「공짜면 데려간다」 (요청) */
        const _hot2=(fa.ovr>=70 || (dispPot(fa)>=155 && (G.season-(fa.by||2000))<=25));
        if(fa.ovr < teamOVR(t2)-(_hot2?9:4)) return false;              // 수준이 한참 아래면 관심이 없다
        if(frnQ(fa) && t2.players.filter(q=>frnQ(q)).length >= (t2.div===1?6:5)) return false;   // 외국인 쿼터
        /* ⚠ 정원을 9명으로 잡았더니 수비수(구단 평균 12.8명)는 사실상 아무 데도 못 갔다.
           대분류별 실제 보유 인원에 맞춘다. */
        const same=t2.players.filter(q=>q.pos===fa.pos).length;
        const room={GK:4, DF:13, MF:12, FW:10}[fa.pos] || 12;
        return same < room;                                            // 그 자리가 이미 넘치면 안 뽑는다
      });
      if(!want.length) continue;
      /* 잘하는 선수는 강한 팀이 데려가고, 그저 그런 선수는 자리가 빈 팀으로 간다 */
      want.sort((a,b)=>teamOVR(b)-teamOVR(a));
      const club = fa.ovr>=70 ? want[Math.floor(Math.random()*Math.min(5, want.length))] : pick(want);
      G.freeAgents.splice(G.freeAgents.indexOf(fa),1);
      fa.wage=Math.round(Math.max(fa.wage||0, wageExpect(fa.ovr,fa.frn,club.div))*10)/10;
      fa.ct=aiCtYears(fa); clearClubBaggage(fa, 75); fa._faWhy=null;
      club.players.push(fa); joinClub(club, fa);
      /* 리그가 알아볼 만한 선수의 입단은 뉴스가 된다 */
      if(fa.ovr>=70) addNews(`🆓 FA <b>${fa.name}</b>(${fa.pos}), ${club.short} 입단 — 이적료 없음`, null, "club");
      else addNews(`🆓 FA ${fa.name}, ${club.short} 입단 (이적료 없음)`);
    }
  }
  if(Math.random()<0.18){ // 준주전급에도 협상 요청이 온다
    const mids=ut.players.filter(p=>p.ovr>=68&&p.ovr<75&&!G.transferBids.some(b=>b.pid===p.id)&&!G.offers.some(o=>o.pid===p.id));
    if(mids.length){
      const p=pick(mids);
      const _b2=Object.values(G.teams).filter(t2=>!t2.isUser && !isArmyTeam(t2) && !ceAusterity(t2.id));
      if(!_b2.length) return;                                          // 🏢 긴축재정 — 살 만한 구단이 없다
      const buyer=pick(_b2);
      const {fee,swapPid}=buildDeal(buyer, marketValue(p), [0.85,1.25]);
      if(swapPid && swapBlocked()) G.swapNo=(G.swapNo||0)+1;    // 프런트 선에서 반려
      else {
        if(!p.emg) G.offers.push({pid:p.id,tid:buyer.id,fee,exp:3,swapPid});
        addNews(fixJosa(`📨 ${buyer.short}이/가 ${p.name} 영입 의사를 타진해왔습니다. (${swapPid?`선수 교환 제안${fee>0?` + 현금 ${fee}억`:''}`:`제안 ${fee}억`})`));
      }
    }
  }
}
/* ── 📒 영입·방출 기록 — "내가 쟤를 언제 데려왔더라?"를 위한 장부 ── */
function tfLogAdd(kind, p, other, fee, wage, ct, club){
  /* 🚫 제보 — 「유저가 직접 영입하거나 이적, 방출 시킨 선수만」. 창구에서 문지기를 세운다.
       · 무직이면 남길 장부 자체가 없다
       · 구단이 명시됐으면 우리 구단일 때만
       · 「영입」은 그 선수가 실제로 우리 명단에 들어와 있을 때만 (AI 영입이 새어 들어오던 구멍) */
  try{
    if(G.jobless) return;
    const _ut=userTeam(); if(!_ut) return;
    if(club && club.id && club.id!==_ut.id) return;
    if(kind==="in" && p && Array.isArray(_ut.players) && !_ut.players.some(x=>x && x.id===p.id)) return;
  }catch(e){}
  if(!Array.isArray(G.tfLog)) G.tfLog=[];
  if(G.jobless && !G.mgrFree) G.mgrFree={from:null, reason:"", s:G.season, off:[], block:{}, weeks:0};
  if(G.mgrFree && !G.mgrFree.block) G.mgrFree.block={};
  G.tfLog.unshift({k:kind, n:p.name, pos:p.pos, o:other||"", fee:Math.round((fee||0)*10)/10,
                   wage:wage!=null?Math.round(wage*10)/10:null, ct:ct||null, s:G.season, d:G.day||0});
  G.tfLog=G.tfLog.slice(0,200);
}
function tfLogView(){
  const L=G.tfLog||[];
  const mk=(list, title, ic)=>`<div class="card" style="flex:1;min-width:280px"><h3>${ic} ${title} <span class="small">(${list.length})</span></h3>
    ${list.length?`<div class="tblScroll" style="max-height:320px;overflow-y:auto"><table>
      <tr><th>시즌</th><th>선수</th><th>상대</th><th>이적료</th><th>조건</th></tr>
      ${list.map(x=>`<tr><td class="small">${x.s}${G.cal&&x.d!=null?" · "+dateLabel(x.d):""}</td>
        <td><b>${x.n}</b> <span class="small pos-${x.pos}">${x.pos}</span></td>
        <td>${x.o||"-"}</td>
        <td>${x.fee?`<b class="money">${x.fee}억</b>`:'<span class="small">-</span>'}</td>
        <td class="small">${x.wage!=null?`연봉 ${x.wage}억`:""}${x.ct?` · ${x.ct}년`:""}</td></tr>`).join("")}
    </table></div>`:`<p class="small">아직 기록이 없습니다.</p>`}</div>`;
  return `<div class="msg info">이번 커리어에서 영입·방출·판매한 선수들의 장부입니다. 최근이 위로 옵니다.</div>
  <div class="row">${mk(L.filter(x=>x.k==="in"),"영입한 선수","📥")}${mk(L.filter(x=>x.k==="out"),"방출·판매한 선수","📤")}</div>`;
}
function completeSale(pid, tid, fee, swapPid){
  const ut=userTeam(), buyer=G.teams[tid];
  const p=ut.players.find(x=>x.id===pid); if(!p) return false;
  if(p.emg){ notify("🚨 긴급 등록 선수는 임시 소집 신분이라 이적할 수 없습니다.","warn"); return false; }
  // 선수 포함 딜(스왑)인 경우 — 상대 선수가 이미 다른 곳으로 옮겨졌으면 스왑 없이 현금 이적으로 대체 진행
  let swapP = swapPid ? buyer.players.find(x=>x.id===swapPid) : null;
  // 스왑은 나간 자리에 선수가 들어오므로 스쿼드 인원이 줄지 않는다 — 순수 판매(스왑 없음)일 때만 최소 인원을 확인한다
  if(!swapP && ut.players.length<=18){ notify("⚠️ 스쿼드가 18명 이하면 판매할 수 없습니다.","warn"); return false; }
  // ── 선수가 개인 협상을 거부할 수 있다 (설득 화면으로 넘어간다)
  if(!p._persuaded){
    const r=moveRefusal(p, buyer);
    if(r.refuse){
      notify(fixJosa(`🙅 ${p.name}이/가 ${buyer.short}행 개인 협상에 난색을 표합니다. — 설득해 보시겠습니까?`),"warn");
      openPersuade(pid, tid, fee, swapPid, r.why);
      return false;
    }
  }
  delete p._persuaded;
  const wantedOut=p.unhappy>0, wasStar=p.ovr>=75;
  const mv=marketValue(p);
  socialOnSale(p);
  ut.players.splice(ut.players.indexOf(p),1); buyer.players.push(p); joinClub(buyer, p);
  clearClubBaggage(p, 80);          // 🧳 태업·잔류 선언·멘토 관계까지 함께 정리
  ut.budget=Math.round((ut.budget+fee)*10)/10; buyer.budget=Math.round((buyer.budget-fee)*10)/10;
  try{ tfLogAdd("out", p, buyer.short+" (판매)", fee, null, null); }catch(e){}
  if(swapP){
    buyer.players.splice(buyer.players.indexOf(swapP),1); ut.players.push(swapP); joinClub(ut, swapP);
    clearClubBaggage(swapP, 75); swapP.ct=Math.max(swapP.ct||1,1);
    /* ⚠ 제보 — "영입 안 했던 선수가 스쿼드에 있다": 교환 딜로 온 선수가 영입 장부에 안 남아
       나중에 봐도 언제 어떻게 왔는지 알 수 없었다. 스왑 영입도 기록한다. */
    try{ tfLogAdd("in", swapP, buyer.short+" (선수 교환)", 0, swapP.wage, swapP.ct); }catch(e){}
  }
  G.offers=G.offers.filter(x=>x.pid!==pid);
  G.transferBids=G.transferBids.filter(b=>b.pid!==pid);
  if(G.snego&&G.snego.pid===pid) G.snego=null;
  notify(swapP
    ? `🔀 <b>선수 교환 확정!</b> ${p.name} → ${buyer.short} ↔ ${swapP.name}(${swapP.pos}) 영입${fee>0?` (+ 현금 ${fee}억)`:''}`
    : `💰 <b>이적 확정!</b> ${p.name} → ${buyer.short} (이적료 ${fee}억)`,"good");
  if(swapP) addNews(`🔀 ${p.name}이(가) ${buyer.short}로, ${swapP.name}이(가) ${ut.name}(으)로 — 선수 맞교환이 성사됐습니다.`);
  queueFarewell(p, buyer.name);   // 감독실에 들러 마지막 인사를 하고 간다
  if(wantedOut) addMood(`💬 ${p.name}: "새 출발을 허락해주셔서 감사합니다. 이 팀의 팬으로 남겠습니다."`);
  else if(wasStar){ ut.morale=clamp(ut.morale-3,40,99); addMood(`😥 핵심 선수의 갑작스러운 이적에 라커룸이 뒤숭숭합니다. (팀 사기 -3)`); }
  // 잘하는 선수가 나가면 표도 같이 나간다 — 본인이 원해서 떠난 경우엔 충격이 덜하다
  bumpHype(ut, -clamp((playerLevel(p)-starRefLevel())*0.008, 0, 0.09)*(wantedOut?0.5:1), `${p.name} 이적`);
  if(wasStar && !wantedOut){
    G.starGone=3;   // 앞으로 세 라운드 동안 "구단 방향"에 의문을 품는 선수가 나올 수 있다
    adjustTrust("owner",-5,`${p.name} 이적`); adjustTrust("fans",-7,`${p.name} 이적`);
    if(!swapP){ // 스왑 딜은 현금 액수만으로 헐값·고가를 판단할 수 없으므로 순수 현금 이적일 때만 평가한다
      if(fee<mv*0.85) adjustTrust("owner",-4,`${p.name} 헐값 이적`);
      else if(fee>mv*1.3) adjustTrust("owner",4,`${p.name} 고가 이적`);
    }
  }
  saveGame(); return true;
}
/* ⚠ 예전에는 버튼이 G.offers 의 '배열 인덱스'를 들고 있었다. 화면을 그린 뒤 제의 목록이 조금이라도
   바뀌면(만료·성사·라운드 진행·되돌아온 화면) 그 인덱스는 다른 제의를 가리키거나 아예 비어 버리고,
   함수들은 `if(!o) return;` 로 아무 말 없이 끝났다 — 감독 눈에는 "수락 버튼이 안 먹는다"로 보였고,
   협상 버튼도 마찬가지로 G.snego 를 만들지 못한 채 협상 탭으로 넘어가 "진행 중인 협상이 없습니다"가 떴다.
   그래서 인덱스를 버리고 (선수 id, 구단 id) 라는 변하지 않는 키로 찾는다. */
function findOffer(pid, tid){
  const list=G.offers||[];
  if(tid===undefined){                        // 구버전 호출(인덱스 하나만) 호환
    return (typeof pid==="number" && list[pid]) ? list[pid] : null;
  }
  return list.find(o=>String(o.pid)===String(pid) && String(o.tid)===String(tid)) || null;
}
function offerGone(){
  notify("📨 그 제의는 이미 처리되었거나 만료됐습니다. 목록을 새로 불러옵니다.","warn");
  show("offers");
}
function acceptOffer(pid, tid){
  const o=findOffer(pid, tid); if(!o) return offerGone();
  const ut=userTeam();
  if(!o.swapPid && ut.players.length<=18){
    notify("⚠️ 스쿼드가 18명 이하라 선수를 팔 수 없습니다. 먼저 선수를 보강하세요.","warn"); return;
  }
  completeSale(o.pid,o.tid,o.fee,o.swapPid);
  if(PERSU) return;                      // 선수가 난색을 표해 설득 화면으로 넘어갔다
  runPendingBye(()=>show("offers")); }
/* 이적 차단 — 선수 반응 분기 */
function blockOffer(pid, tid){
  const o=findOffer(pid, tid); if(!o) return offerGone();
  const ut=userTeam(); const p=ut.players.find(x=>x.id===o.pid); const buyer=G.teams[o.tid];
  G.offers=G.offers.filter(x=>!(x.pid===o.pid&&x.tid===o.tid));
  if(!p){ show("transfer"); return; }
  const bigger=teamOVR(buyer)>teamOVR(ut)+0.5;
  if(p.unhappy>0){
    p.unhappy=Math.min(3,p.unhappy+1); p.morale=clamp(p.morale-8,30,99); affAdd(p,-6,"이적 거절");
    notify(`💢 <b>차단 반발!</b> ${p.name}: "왜 제 앞길을 막으십니까! 저는 떠나고 싶다고 분명히 말씀드렸습니다." (불만 ${p.unhappy}/3, 사기 -8)`,"warn");
  } else if(bigger&&p.pers===1){
    p.unhappy=Math.max(p.unhappy,1); p.uWhy="이적 희망"; p.morale=clamp(p.morale-6,30,99);
    notify(`😠 <b>차단 후폭풍:</b> 야심가 ${p.name}, ${buyer.short}행 차단에 굳은 표정. "더 큰 무대에 갈 기회였습니다." (불만 발생: 이적 희망)`,"warn");
  } else if(bigger&&Math.random()<0.4){
    p.morale=clamp(p.morale-4,30,99);
    notify(fixJosa(`😕 ${p.name}: "${buyer.short}이/가라... 솔직히 흔들렸던 건 사실입니다." (사기 -4)`),"warn");
  } else if((p.pers===0||p.pers===2)&&Math.random()<0.5){
    p.morale=clamp(p.morale+3,30,99);
    notify(`💙 <b>잔류 의지!</b> ${p.name}: "구단이 저를 붙잡아 줬다는 게 중요하죠. 여기서 증명하겠습니다." (사기 +3)`,"good");
  } else {
    notify(`🚫 ${buyer.short}의 ${p.name} 영입 시도를 차단했습니다. 선수는 담담한 반응입니다.`,"info");
  }
  saveGame(); show("offers");
}
/* 🔙 ⚠ 제보 원문 — 「'타 구단 제의' 에서 협상을 승락하거나, 거절 당하거나 하는 등의 유저의 모든
   행동이 끝난 뒤에 '협상' 탭으로 이동하게 되어 있는데, '타 구단 제의' 탭에서 … 똑같이
   '타 구단 제의' 탭에 머물게 고쳐 주시면 감사하겠습니다」.
   원인 — 판매 협상 화면이 「협상」 탭에만 있어서, 제의 목록에서 🤝 협상을 누르는 순간 탭이
     통째로 넘어갔고 협상이 끝나도 그 자리에 남았다.
   ─ 판매 협상 카드를 「타 구단 제의」 탭에도 그대로 띄우고, 모든 행동은 「지금 보고 있던 탭」에
     그대로 남게 한다. 협상 탭에서 이어가던 감독은 협상 탭에 남는다 — 어느 쪽도 튕기지 않는다. */
function negoStay(){ try{ return (VIEW==="offers") ? "offers" : "nego"; }catch(e){ return "nego"; } }
/* 판매 역협상: 오퍼 금액을 올려받기 */
function startSellNego(pid, tid){
  const o=findOffer(pid, tid); if(!o) return offerGone();
  if(G.snego){ notify("🤝 이미 진행 중인 판매 협상이 있습니다. 그 협상을 먼저 끝내세요.","warn"); show(negoStay()); return; }
  const buyer=G.teams[o.tid]; const p=userTeam().players.find(x=>x.id===o.pid);
  if(!p || !buyer){ G.offers=(G.offers||[]).filter(x=>x!==o); return offerGone(); }
  const max=Math.round(o.fee*(1.15+Math.random()*0.35+Math.min(0.3,Math.max(0,buyer.budget)/500))*10)/10;
  const _sp0 = o.swapPid ? buyer.players.find(x=>x.id===o.swapPid) : null;
  const swapTxt = _sp0 ? ` (+ ${_sp0.name} 포함)` : "";
  /* ⚠ 제보 — 상대가 「A선수 + 현금」을 먼저 내놓았는데, 그 A선수를 그대로 달라고 하면
     거절당했다. 상대가 이미 테이블에 올린 카드의 값을 기억해 둬야 그 뒤 계산이 맞는다. */
  G.snego={pid:o.pid, tid:o.tid, bid:o.fee, max, tries:0, swapPid:o.swapPid,
    swapV: _sp0 ? marketValue(_sp0) : 0,
    log:[{w:"club", t:`${buyer.short}: "우리 제안은 ${o.fee}억${swapTxt}입니다. 원하는 현금 조건을 말씀하시죠."`}]};
  G.offers=(G.offers||[]).filter(x=>x!==o);
  saveGame();                    // 협상 상태를 바로 저장 — 새로고침해도 협상이 사라지지 않는다
  show(negoStay());              // 🔙 제보 — 제의 탭에서 시작했으면 제의 탭에서 그대로 이어간다
}
/* 상대 스쿼드에서 데려오고 싶은 선수를 고른다 — "현금만 말고 저 선수도 주시죠" */
function sellSetWant(v){
  const N=G.snego; if(!N) return;
  const id=parseInt(v,10);
  N.wantPid=(!v||isNaN(id))?null:id;
  show(negoStay());
}
/* 상대가 그 선수를 내줄 수 있는가 — 핵심 자원은 돈으로도 안 준다 */
/* ⚠ 제보 원문 — 「트레이드 협상할때 타구단에서 먼저 a선수+현금을 요청했는데 제가 그선수+현금을
   좀더 요구할경우 구단이 그선수는 핵심이라 어떤경우에도 안된다고 나옵니다」.
   상대가 제 발로 테이블에 올린 카드다 — 그걸 「핵심이라 못 준다」고 무를 수는 없다.
   offeredId(상대가 먼저 얹은 선수)면 이 관문을 그대로 지나간다. */
function sellWantRefuse(buyer, wantP, offeredId){
  if(!wantP) return null;
  if(offeredId!=null && wantP.id===offeredId) return null;
  if((buyer.players||[]).length<=19) return `"저희 스쿼드도 빠듯합니다. 선수를 빼 줄 여유가 없습니다."`;
  const rank=buyer.players.slice().sort((a,b)=>b.ovr-a.ovr).findIndex(x=>x.id===wantP.id);
  if(rank<4 && wantP.ovr>=72) return fixJosa(`"${wantP.name}은/는 저희 팀의 중심입니다. 그 선수는 어떤 조건에서도 안 됩니다."`);
  if(rank<8 && wantP.ovr>=70 && Math.random()<0.45) return fixJosa(`"${wantP.name}은/는 감독이 시즌 계획에 넣어 둔 선수입니다. 다른 이름을 말씀해 주시죠."`);
  return null;
}
function sellDemand(){
  const N=G.snego; if(!N) return;
  const el=document.getElementById("sngOffer");
  const raw=el ? String(el.value||"").trim() : "";
  let val=raw==="" ? NaN : Math.round(parseFloat(raw)*10)/10;
  const buyer=G.teams[N.tid]; const p=userTeam().players.find(x=>x.id===N.pid);
  if(!p){ G.snego=null; notify("🤝 그 선수는 더 이상 우리 소속이 아닙니다. 협상을 종료합니다.","warn"); show(negoStay()); return; }
  /* 트레이드를 요구하면 현금은 0원이어도 성립한다 (선수 대 선수) */
  const wantP = N.wantPid ? buyer.players.find(x=>x.id===N.wantPid) : null;
  if(!isFinite(val)||val<0){ if(wantP) val=0; else { gameAlert("요구액을 입력하세요 (억 단위)"); if(el) el.focus(); return; } }
  if(!wantP && val<=0){ gameAlert("요구액을 입력하세요 (억 단위)"); if(el) el.focus(); return; }
  N.tries++;
  const say=(w,t)=>N.log.push({w,t});
  if(wantP){
    const no=sellWantRefuse(buyer, wantP, N.swapPid);
    say("me",`이적료 ${val}억 + <b>${wantP.name}</b> 트레이드를 요구했다.`);
    if(no){
      say("club",`${buyer.short}: ${no}`);
      N.wantPid=null;
      notify(`🚫 ${buyer.short}이(가) ${wantP.name} 트레이드를 거절했습니다. 다른 선수를 골라 보세요.`,"warn");
      saveGame(); show(negoStay()); return;
    }
  } else say("me",`이적료 ${val}억을 요구했다.`);
  /* 요구 총액 = 현금 + 데려올 선수의 시장가치.
     ⚠ 제보 — 상대가 먼저 얹은 선수(swapPid)는 이미 상대가 내놓기로 한 값이다. 그 값을 빼지 않으면
        「그 선수 그대로 + 현금 조금 더」가 상대 한도를 훌쩍 넘는 무리한 요구로 계산돼 무조건 거절됐다.
        같은 선수를 그대로 달라고 하면 추가분은 0, 다른 선수로 바꾸면 그 차액만 새 요구가 된다. */
  const swapV = (function(){
    if(N.swapV!=null) return N.swapV;
    if(!N.swapPid) return 0;
    const sp=buyer.players.find(x=>x.id===N.swapPid);
    return sp?marketValue(sp):0;
  })();
  const wantV = wantP ? Math.max(0, marketValue(wantP)-swapV) : 0;
  const total = Math.round((val+wantV)*10)/10;
  const okTxt = wantP ? `${val>0?`${val}억 + `:""}${wantP.name}` : `${val}억`;
  const _back=negoStay();
  const done=()=>{ completeSale(N.pid,N.tid,val,wantP?wantP.id:N.swapPid); if(PERSU) return true; G.snego=null; runPendingBye(()=>show(_back)); return true; };
  if(total<=N.bid){ say("club",`${buyer.short}: "그 조건이면 바로 계약서 쓰죠."`); if(!wantP) val=Math.max(val,N.bid); done(); return; }
  if(total<=N.max){
    if(Math.random()<0.4+N.tries*0.2){ say("club",`${buyer.short}: "...좋습니다. ${okTxt} 조건으로 데려가겠습니다."`); done(); return; }
    N.bid=Math.round(((N.bid+total)/2)*10)/10;
    say("club",`${buyer.short}: "그건 과한 조건입니다. ${N.bid}억 상당까지 맞춰 보죠."`);
  } else {
    if(N.tries>=3){
      say("club",`${buyer.short}: "저희 한도를 아득히 넘습니다. 협상은 여기까지죠."`);
      notify(fixJosa(`❌ <b>협상 결렬:</b> ${buyer.short}이/가 ${p.name} 협상 테이블을 떠났습니다. (무리한 요구)`),"warn");
      if(p.unhappy>0||teamOVR(buyer)>teamOVR(userTeam())+0.5){ p.morale=clamp(p.morale-5,30,99); notify(`😞 ${p.name}: "구단이 저를 돈으로만 보는군요..." (무산된 이적에 실망, 사기 -5)`,"warn"); }
      G.snego=null; show(negoStay()); return;
    }
    say("club",`${buyer.short}: "${okTxt}${wantP?" 조건은":"은"} 저희가 감당할 수준을 넘습니다. 현실적으로 갑시다."`);
  }
  saveGame(); show(negoStay());
}
function cancelSellNego(){
  const N=G.snego; if(!N){ show(negoStay()); return; }
  const p=userTeam().players.find(x=>x.id===N.pid);
  const buyer=G.teams[N.tid];
  G.snego=null;
  if(p){
    if(p.unhappy>0){ p.unhappy=Math.min(3,p.unhappy+1); p.morale=clamp(p.morale-6,30,99); notify(`💢 ${p.name}, 판매 협상 일방 중단에 반발합니다. (불만 ${p.unhappy}/3)`,"warn"); }
    else addNews(fixJosa(`🚪 ${buyer.short}와/과의 ${p.name} 협상에서 철수했습니다.`));
  }
  show(negoStay());
}
/* ── 영입 3자 협상: 구단(이적료) → 선수(연봉) → 에이전트(수수료) ── */
const AGENT_T=[
 {n:"선수우선형", desc:"선수 커리어가 우선. 수수료는 합리적", feeK:1.0, wageK:1.12, agK:0.06, agMin:0.035, pat:5},
 {n:"실리추구형", desc:"본인 몫부터 챙기는 타입. 수수료가 비싸다", feeK:1.05, wageK:1.03, agK:0.14, agMin:0.10, pat:4},
 {n:"강성 협상가", desc:"전 항목 강경. 인내심도 짧다", feeK:1.12, wageK:1.20, agK:0.10, agMin:0.075, pat:3}];
const AGENT_NAMES=["김앤리 매니지먼트","골드터치 에이전시","유로스포츠 코리아","베이스캠프 스포츠","프라임 풋볼","리버티 스포츠 그룹"];
/* ── 협상 냉각기 ────────────────────────────────────────────
   테이블을 떠난 다음 날 다시 찾아가는 건 협상이 아니다. 한 번 결렬되면 일주일은 문이 닫힌다. */
const NEGO_COOLDOWN_DAYS=7;
/* ⚠ 제보 — "여름에 결렬됐는데 겨울이 되어도 안 풀리고 67일 뒤라고 뜬다".
   냉각기를 G.day 절대값으로 저장했는데, 새 시즌이 시작되면 buildCalendar 가 G.day 를 0 으로
   되돌린다. 그래서 지난 시즌에 찍은 "until"(예: 200일차)이 새 시즌 0일차 기준으로는
   200일이 남은 것처럼 보였다. 시즌을 함께 저장해 경계를 넘으면 그냥 푼다. */
function negoBlockDaysLeft(pid){
  const B=G.negoBlock&&G.negoBlock[pid];
  if(B==null) return 0;
  if(typeof B==="object"){
    if(B.s!==G.season) return 0;                 // 시즌이 바뀌었다 — 지난 앙금은 털고 간다
    return Math.max(0, (B.d||0)-(G.day||0));
  }
  /* 옛 세이브(숫자만 저장) — 7일을 넘는 값은 시즌 경계를 넘은 잔재로 보고 푼다 */
  const left=B-(G.day||0);
  return (left>NEGO_COOLDOWN_DAYS) ? 0 : Math.max(0, left);
}
function blockNego(pid, why){
  /* 🚪 결렬된 선수는 자동으로 관심 목록에 남는다 — 재협상이 풀리면 여기서 바로 다시 접촉한다 */
  try{ slAdd(pid, "fail", true); }catch(e){}
  if(!G.negoBlock) G.negoBlock={};
  G.negoBlock[pid]={d:(G.day||0)+NEGO_COOLDOWN_DAYS, s:G.season};
  if(why) addNews(`🚪 ${why} — 향후 ${NEGO_COOLDOWN_DAYS}일간 재협상이 불가능합니다.`);
  /* ⚠ 제보 — 「상대팀이 영입 불가를 때린 선수가, 브라우저를 껐다 켜면 영입 허가가 된다」.
     냉각기를 G 에 적어 두기만 하고 저장하지 않아서, 마지막 저장 시점으로 되돌아가면
     기록이 사라졌다. 게다가 거부 판정에는 난수가 들어가므로 다시 굴리면 결과가 바뀐다.
     ─ 거부·결렬이 확정되는 순간 바로 저장한다. */
  try{ saveGame(); }catch(e){}
}
function startNego(pid, fromId){
  if(armyGate("선수 영입")) return;
  if(waGate("선수 영입")) return;             // 💸 임금 체불 제재 (요청)
  if(!transferOpen()){ gameAlert("이적시장이 닫혀 있습니다."); return; }
  const left=negoBlockDaysLeft(pid);
  if(left>0){ gameAlert(`협상이 결렬된 지 얼마 되지 않았습니다.\n\n${left}일 뒤에 다시 접촉할 수 있습니다.`); return; }
  if(G.nego){ gameAlert("이미 진행 중인 협상이 있습니다. 먼저 마무리하거나 중단하세요."); return; }
  const from=G.teams[fromId]; const p=from.players.find(x=>x.id===pid); if(!p) return;
  if(p.army && p.army.out){
    const own=p.army.own&&G.teams[p.army.own];
    showConfirm(`<b>🎖️ ${p.name} — 군 복무 중</b>\n\n현역 군인 신분이라 어떤 구단도 영입할 수 없습니다.\n\n· 전역일: <b>${p.army.out}</b> (D-${Math.max(0,armyDaysLeft(p))})\n· 전역 후 복귀: <b>${own?own.name:"무소속 — 자유계약(FA)"}</b>`,
      ()=>{}, {okLabel:"알겠습니다", cancelLabel:""});
    return;
  }
  if(from.players.length<=20){ gameAlert(`${from.short} 구단: "스쿼드 사정상 어떤 제안도 받지 않겠습니다."`); return; }
  const refuseLine=clubRefusesToSell(from, p);
  if(refuseLine){
    blockNego(pid, `${from.short} 협상 거부`);
    showConfirm(`<b>🚫 ${from.name} 구단이 협상을 거부했습니다</b>\n\n${refuseLine}\n\n` +
      `<span class="small">핵심 선수는 돈만으로 데려올 수 없습니다. 상대 구단의 순위 싸움이 끝나거나, 계약이 얼마 남지 않았을 때 다시 시도해 보세요.</span>`,
      ()=>{}, {okLabel:"알겠습니다", cancelLabel:"닫기"});
    return;
  }
  const mv=marketValue(p);
  const key=p.ovr>=teamOVR(from)+1;
  const at=AGENT_T[p.id%3];
  /* 이적이 너무 쉽다는 피드백 — 요구액과 하한선을 함께 올린다.
     특히 "그 팀에서 중요한 선수"일수록 웃돈이 크게 붙는다(K리그도 핵심 자원은 값을 세게 부른다). */
  const feeAsk=Math.round(mv*(key?1.85:1.35)*at.feeK*10)/10;
  const feeMin=Math.round(mv*(key?1.45:1.05)*10)/10;
  const wBase=wageExpect(p.ovr,p.frn,(teamOfPlayer(p)||{}).div);
  const bigger=teamOVR(userTeam())>=teamOVR(from);
  const wageAsk=Math.round(Math.max(p.wage*1.35, wBase*(bigger?1.22:1.5))*at.wageK*10)/10;
  const wageMin=Math.round(Math.max(p.wage*1.12, wBase*(bigger?1.02:1.24))*10)/10;
  try{ slAdd(pid, "try", true); }catch(e){}     // ⭐ 접촉한 선수는 목록에 남는다
  G.nego={pid, fromId, stage:"fee", tries:0, feeAsk, feeMin, wageAsk, wageMin,
    offerSwapPid:null, agreedSwapPid:null, // 현금 대신(혹은 현금과 함께) 내 선수를 끼워 넣는 "선수 포함 제안" — fee 단계에서만 선택 가능
    agent:{name:pick(AGENT_NAMES), ...at},
    log:[{w:"sys", t:`${from.short}와 ${p.name} 협상 개시. 구단 요구 이적료: ${feeAsk}억 (시장가치 ${mv}억) · 에이전트: ${at.n}`}]};
  show("nego");
}
/* ═══ 🔀 트레이드 자원으로 내줄 수 있는 선수인가 ══════════════════════
   ⚠ 제보 — 「임대해 온 선수를 이적시장에서 트레이드 자원으로 쓸 수 있다」.
      임대 선수는 우리 소유가 아니다 — 판매(listForSale)는 막혀 있었는데
      「선수 포함 제안」의 목록은 우리 명단 전체를 그대로 뿌리고 있었다.
   판매·트레이드·스왑 모든 경로가 이 한 곳을 통과하게 한다. */
function tradeBlockWhy(p){
  if(!p) return "그 선수를 찾을 수 없습니다.";
  const t=userTeam();
  if(!t || !t.players.some(x=>x.id===p.id)) return "우리 소속 선수가 아닙니다.";
  if(p.loan) return (p.loan.own===t.id)
    ? "다른 구단에 임대 보낸 선수입니다 — 먼저 불러들여야 합니다."
    : "임대해 온 선수입니다 — 우리 소유가 아니라 내줄 수 없습니다.";
  if(p.army) return "군 복무 중인 선수입니다 — 전역 전에는 어떤 거래도 할 수 없습니다.";
  if(p.armyCall) return `입영 통지를 받은 선수입니다 — 입소(D-${armyCallLeft(p)})까지는 거래할 수 없습니다.`;
  if(p.emg) return "긴급 등록된 임시 소집 선수입니다.";
  if(p.noMove) return "본인이 잔류를 선언한 선수입니다.";
  return null;
}
function tradeableOwn(p){ return !tradeBlockWhy(p); }
/* fee(구단 협상) 단계에서 현금 대신/현금과 함께 내 선수를 끼워 넣을 대상을 고른다 — FM처럼 "현금+선수" 딜을 만들 수 있게 */
function negoSetSwap(val){
  const N=G.nego; if(!N || N.stage!=="fee") return;
  const id=parseInt(val,10);
  if(!val || isNaN(id)){ N.offerSwapPid=null; return; }
  /* 🔀 임대·군 복무·긴급 등록 선수는 내줄 수 없다 (제보) */
  const p=userTeam().players.find(x=>x.id===id);
  const why=tradeBlockWhy(p);
  if(why){ N.offerSwapPid=null; try{ gameAlert(`🔀 <b>${p?p.name:"그 선수"}</b>은(는) 거래에 넣을 수 없습니다.\n\n${why}`); }catch(e){} show("nego"); return; }
  N.offerSwapPid=id;
}
function negoOffer(){
  const N=G.nego; if(!N) return;
  const el=document.getElementById("ngOffer");
  /* ⚠ 빈칸이면 parseFloat("")=NaN 이고, 그 뒤 계산이 전부 NaN 으로 번져 화면이 죽었다.
     숫자가 아니거나 음수·비정상 값이면 여기서 잘라낸다. */
  const raw=el ? String(el.value||"").trim() : "";
  const val=raw==="" ? NaN : Math.round(parseFloat(raw)*10)/10;
  if(!isFinite(val)||val<0){ gameAlert("금액을 입력하세요 (억 단위)"); if(el) el.focus(); return; }
  const ut=userTeam(), from=N.fromId?G.teams[N.fromId]:null;
  const p=negoPlayerOf(N);
  if(!p){ G.nego=null; show("nego"); return; }
  N.tries++;
  const say=(w,t)=>N.log.push({w,t});
  if(N.stage==="fee"){
    // 선수 포함 제안 — 현금(val)에 내 선수의 시장가치를 더한 "총 제시 가치"로 구단의 요구 이적료와 비교한다
    const swapP = N.offerSwapPid ? ut.players.find(x=>x.id===N.offerSwapPid) : null;
    const swapMv = swapP ? marketValue(swapP) : 0;
    const effVal = Math.round((val+swapMv)*10)/10;
    const offerTxt = swapP ? `현금 ${val}억 + <b>${swapP.name}</b>(${swapP.pos} ${dispOvr(swapP)}, 가치 ${swapMv}억) 포함` : `이적료 ${val}억`;
    say("me",`${offerTxt}을 제안했다.`);
    if(N.offerSwapPid && !tradeableOwn(ut.players.find(x=>x.id===N.offerSwapPid))) N.offerSwapPid=null;   // 🔀 최종 검증
    if(effVal>=N.feeAsk*0.96){ N.agreedFee=val; N.agreedSwapPid=N.offerSwapPid; N.stage="wage"; N.tries=0; say("club",`"좋습니다, 그 조건에 합의하죠." — 이제 선수 측과 개인 협상입니다. 선수 요구 연봉: ${N.wageAsk}억/년`); }
    else if(effVal>=N.feeMin){
      if(Math.random()<0.30+N.tries*0.18){ N.agreedFee=val; N.agreedSwapPid=N.offerSwapPid; N.stage="wage"; N.tries=0; say("club",`"...힘든 결정이지만 그 조건으로 보내드리죠." — 선수 요구 연봉: ${N.wageAsk}억/년`); }
      else { N.feeAsk=Math.round(((N.feeAsk+effVal)/2)*10)/10; say("club",`"부족합니다. ${swapP?"총액 기준 ":""}${N.feeAsk}억 상당이라면 이야기가 됩니다."`); }
    } else {
      if(N.tries>=4){ say("club",`"시간 낭비였군요. 협상은 여기까지입니다."`); notify(`❌ <b>협상 결렬:</b> ${p.name} 영입 실패 — 구단이 테이블을 떠났습니다.`,"warn"); blockNego(N.pid, `${p.name} 협상 결렬`); G.nego=null; show("nego"); return; }
      say("club",`"${swapP?"그 조건이면":val+"억이요? 우리 선수를"} 뭘로 보시는 겁니까." (기대치에 한참 미달)`);
    }
    if(N.stage==="wage") negoOsEggOnWage(N, p);   // 해외 선수 전용 사연
  } else if(N.stage==="wage"){
    /* 구단끼리 합의했다고 끝이 아니다. 선수는 돈만 보지 않는다 — 어느 리그로 가는지,
       가서 뛸 수 있는지, 지금 팀에서 무슨 취급을 받고 있는지를 먼저 본다.
       연봉 협상에 들어가기 전에 그 마음을 한 번 묻는다. 여기서 접히면 돈으로도 못 돌린다. */
    say("me",`연봉 ${val}억을 제시했다.`);
    /* 돈이 전부가 아니다. 제시를 받을 때마다 선수는 "이 팀에 갈 이유가 있는가"를 다시 생각한다.
       마음이 식어 있으면 조건과 무관하게 자리를 뜬다 — 그게 이 판의 난이도다. */
    {
      const mind=N.mind || (N.mind=playerMoveMind(p, N.fromId?G.teams[N.fromId]:null, ut));
      const low=1-mind.v;
      // 첫 제안에서 가장 크게 갈리고, 이후에는 낮은 확률로 남아 있다.
      // 요구액에 한참 못 미치는 제시는 마음이 식은 선수를 더 빨리 돌려세운다.
      const cheap = val < N.wageMin*0.85 ? 0.18 : val < N.wageAsk*0.9 ? 0.06 : 0;
      const pWalk = clamp((N.tries<=1 ? low*0.95 : low*0.22) + cheap, 0, 0.95);
      if(Math.random() < pWalk){
        say("player",`${p.name}: ${mindRefuseSay(mind, p, ut, val, N)}`);
        notify(`❌ <b>${p.name}</b> 영입 무산 — 선수 본인이 이적을 원하지 않습니다`,"warn");
        blockNego(N.pid, `${p.name} 본인 거절`);
        try{ socialFill(SOC.dealOff, 2+R(2), -1, {p:p.name, t:ut.short, o:(N.fromId?G.teams[N.fromId].short:"")}); }catch(e){}
        G.nego=null; show("nego"); return;
      }
    }
    if(val>=N.wageAsk*0.97){ N.agreedWage=val; negoToAgent(N,p,say); }
    else if(val>=N.wageMin){
      if(Math.random()<0.35+N.tries*0.2){ N.agreedWage=val; negoToAgent(N,p,say); }
      else { N.wageAsk=Math.round(((N.wageAsk+val)/2)*10)/10; say("player",`${p.name}: "${N.wageAsk}억이면 사인하겠습니다."`); }
    } else {
      if(N.tries>=4){ say("player",`${p.name}: "저를 원하는 게 맞긴 한가요? 없던 일로 하죠."`); notify(`❌ <b>협상 결렬:</b> ${p.name} 영입 실패 — 연봉 견해차.`,"warn"); blockNego(N.pid, `${p.name} 연봉 협상 결렬`); G.nego=null; show("nego"); return; }
      say("player",`${p.name}: "제 가치를 너무 낮게 보시네요." (요구: ${N.wageAsk}억)`);
    }
  } else if(N.stage==="agent"){
    say("me",`에이전트 수수료 ${val}억을 제안했다.`);
    if(val>=N.agAsk*0.95 || (val>=N.agMin && Math.random()<0.35+N.tries*0.2)){
      N.agreedAg=val; say("agent",`${N.agent.name}: "딜 성사입니다. 서류 준비하죠."`); negoClose(); return;
    } else if(val>=N.agMin){ N.agAsk=Math.round(((N.agAsk+val)/2)*10)/10; say("agent",`${N.agent.name}: "${N.agAsk}억. 여기서 더는 안 내려갑니다."`); }
    else {
      if(N.tries>=N.agent.pat){ say("agent",`${N.agent.name}: "제 고객은 다른 팀으로 갑니다. 연락하지 마세요."`); notify(`❌ <b>협상 결렬:</b> ${p.name} 영입 무산 — 에이전트가 딜을 걷어찼습니다.`,"warn"); blockNego(N.pid, `${p.name} 에이전트 협상 결렬`); G.nego=null; show("nego"); return; }
      say("agent",`${N.agent.name}: "그 금액이면 이 딜은 없습니다." (요구 ${N.agAsk}억)`);
    }
  }
  saveGame(); show("nego");
}
/* ── 선수가 이 이적을 어떻게 보는가 ──────────────────────────────
   구단 협상이 끝난 뒤 딱 한 번 굴린다. 돈(연봉)은 다음 단계에서 따로 다투므로 여기서는 뺀다. */
/* 감독 위신이 선수 마음에 주는 무게 (−0.04 ~ +0.10) */
function prestigePull(){ try{ return clamp((mgrPrestige()-4)/220, -0.04, 0.10); }catch(e){ return 0; } }
function playerMoveMind(p, from, to){
  const age=G.season-p.by;
  const F=[]; const add=(v,l)=>{ if(Math.abs(v)>=0.005) F.push({v,l}); };
  add(prestigePull(), "감독의 위신");   // 좋은 집에 사는 감독의 말은 다르게 들린다
  /* 🌏 아시아 챔피언 프리미엄 — 「대륙대회를 뛰는 팀」은 선수에게 완전히 다른 제안이다 */
  try{
    const pb=eaclPullBonus();
    if(pb>0) add(pb, "아시아 챔피언 구단이다");
    else if(to && eaclOn() && G.eacl.teams.indexOf(to.id)>=0) add(0.07, "EACL에 나가는 팀이다");
  }catch(e){}
  let base=0.62;
  if(from){
    // 리그 이동 방향 — 2부로 내려가는 걸 반기는 선수는 없다
    if(to.div>from.div) add(-0.30, "하부 리그로 내려간다");
    else if(to.div<from.div) add(0.16, "상위 리그로 올라간다");
    // 팀 격 차이
    const gap=teamOVR(to)-teamOVR(from);
    add(clamp(gap*0.035, -0.22, 0.22), gap>=0?"더 좋은 팀으로 간다":"전력이 낮은 팀이다");
    // 순위 — 우승 경쟁 중인 팀을 떠나기는 싫다
    const tb=tableOf(from.div), pos=tb.findIndex(x=>x.id===from.id)+1;
    if(pos>0 && pos<=3) add(-0.14, `지금 팀이 ${pos}위다`);
    else if(pos>=tb.length-2) add(0.10, "지금 팀이 강등권이다");
  }
  // 우리 팀에서 뛸 수 있는가 — 같은 자리 경쟁자가 빽빽하면 안 온다
  const rivals=to.players.filter(q=>q.pos===p.pos && q.ovr>=p.ovr-1).length;
  add(clamp((2-rivals)*0.075, -0.26, 0.15), rivals>=3?`${POS_KO[p.pos]||p.pos} 자리 경쟁이 심하다`:"주전 자리가 보인다");
  // 지금 팀에서의 처지
  if(p.unhappy>0) add(0.10*p.unhappy, "지금 팀에 불만이 있다");
  if(p.sulk>0) add(0.18, "이미 태업 중이다");
  if((p.ct||1)<=1) add(0.12, "계약이 곧 끝난다");
  if(playShareKnown() && playShare(p)<0.3) add(0.12, "출전 시간이 부족했다");
  // 나이·성격
  if(age>=32) add(-0.10, "이 나이에 팀을 옮기기는 부담스럽다");
  else if(age<=22) add(0.08, "어리고 기회를 찾는다");
  add([0.03, 0.12, -0.06, 0.00][p.pers||0], `성격: ${["프로","야심","온화","다혈질"][p.pers||0]}`);
  // 감독·구단의 격
  const cups=(G.trophies||[]).filter(x=>x.kind==="champ"||x.kind==="champ2").length;
  if(cups) add(Math.min(0.14, cups*0.055), `감독 우승 경력 ${cups}회`);
  const fanTrust=(G.trust&&G.trust.fans)||60;
  add((fanTrust-60)*0.0016, "감독 평판");
  if(p.frn){ const lim=to.div===1?5:4;
    const cur=to.players.filter(q=>q.frn).length;
    if(cur>=lim) add(-0.12, "외국인 자리가 이미 찼다"); }
  const v=clamp(base + F.reduce((s,x)=>s+x.v,0), 0.05, 0.95);
  // 거절 사유는 가장 크게 작용한 부정 요인에서 고른다 — 그래야 납득이 된다
  const worst=F.filter(x=>x.v<0).sort((a,b)=>a.v-b.v)[0];
  const NO={
    "하부 리그로 내려간다": `"죄송합니다. 지금 커리어에서 아래로 내려갈 수는 없습니다."`,
    "전력이 낮은 팀이다": `"솔직히 말씀드리면, 지금 팀보다 나아 보이지 않습니다."`,
    "이 나이에 팀을 옮기기는 부담스럽다": `"이 나이에 새 환경은... 여기서 마무리하고 싶습니다."`,
    "외국인 자리가 이미 찼다": `"외국인 자리가 없다고 들었습니다. 못 뛸 걸 알면서 갈 수는 없죠."`
  };
  const no = (worst && NO[worst.l]) || (worst && worst.l.indexOf("경쟁")>=0
      ? `"그 자리에 이미 좋은 선수가 많더군요. 벤치에 앉으러 가는 건 아닙니다."`
      : worst && worst.l.indexOf("위다")>=0
      ? `"지금 팀에서 우승을 노리고 있습니다. 시즌 중에 나갈 수는 없습니다."`
      : pick([`"제안은 감사하지만, 마음이 움직이지 않습니다."`,
              `"조금 더 생각해 봤는데... 이번엔 아닌 것 같습니다."`,
              `"에이전트에게는 미안하지만, 저는 여기 남겠습니다."`]));
  const ok=pick([`"이야기 들었습니다. 조건만 맞으면 가겠습니다."`,
                 `"감독님이 저를 어떻게 쓰실지 궁금하네요. 계속 이야기하시죠."`,
                 `"마음은 반쯤 넘어왔습니다. 나머지는 조건입니다."`]);
  return {v, F, no, ok};
}
/* 거절 한마디 — 지금 상황에서 가장 크게 작용한 이유로 말한다.
   같은 "안 갑니다"라도 왜인지가 보여야 다음 영입을 다르게 준비하게 된다. */
function mindRefuseSay(mind, p, to, val, N){
  const worst=(mind.F||[]).filter(x=>x.v<0).sort((a,b)=>a.v-b.v)[0];
  const l=worst?worst.l:"";
  if(val!=null && N && val < N.wageMin*0.85)
    return pick([`"아뇨. 이 조건이면 이야기할 것도 없습니다."`,
      `"그 금액은... 저를 부르신 이유가 뭔지 모르겠네요."`,
      `"제 에이전트가 이 얘기를 들으면 웃을 겁니다. 여기까지 하시죠."`]);
  if(l.indexOf("하부 리그")>=0)
    return pick([`"아뇨, 저는 이 구단과 계약하는 것에 관심이 없습니다. 아래로 내려갈 생각은 없습니다."`,
      `"${divName(to.div)}에서 뛰려고 여기까지 온 게 아닙니다."`]);
  if(l.indexOf("경쟁")>=0)
    return pick([`"그 자리에 이미 좋은 선수가 셋입니다. 벤치에 앉으러 가진 않겠습니다."`,
      `"저를 어디에 쓰실 건지부터 말씀해 주셔야 하지 않습니까."`,
      `"아뇨, 저는 이 구단과 계약하는 것에 관심이 없습니다. 뛸 자리가 안 보입니다."`]);
  if(l.indexOf("위다")>=0 || l.indexOf("우승")>=0)
    return pick([`"지금 팀에서 우승을 노리고 있습니다. 시즌 중에 나갈 수는 없습니다."`,
      `"트로피를 눈앞에 두고 짐을 싸라는 말씀입니까."`]);
  if(l.indexOf("외국인")>=0)
    return pick([`"외국인 자리가 이미 찼다고 들었습니다. 등록도 안 될 팀에 갈 수는 없죠."`,
      `"쿼터 정리부터 하고 다시 오시죠."`]);
  if(l.indexOf("나이")>=0)
    return pick([`"이 나이에 새 도시, 새 환경은 무리입니다. 여기서 마무리하겠습니다."`,
      `"가족을 또 옮기게 할 수는 없습니다."`]);
  if(l.indexOf("전력이 낮은")>=0)
    return pick([`"솔직히 말씀드리면, 지금 팀보다 나아 보이지 않습니다."`,
      `"제 커리어가 뒤로 가는 선택입니다."`]);
  if(l.indexOf("성격")>=0)
    return pick([`"아뇨, 저는 이 구단과 계약하는 것에 관심이 없습니다."`,
      `"제가 그릴 그림이 여기엔 없습니다."`]);
  if(l.indexOf("평판")>=0)
    return pick([`"감독님에 대한 이야기를 좀 들었습니다. 이번엔 넘기겠습니다."`,
      `"주변에서 말리더군요. 죄송합니다."`]);
  return pick([`"아뇨, 저는 이 구단과 계약하는 것에 관심이 없습니다."`,
    `"제안은 감사하지만 마음이 움직이지 않습니다."`,
    `"조금 더 생각해 봤는데... 이번엔 아닌 것 같습니다."`,
    `"에이전트에게는 미안하지만, 저는 여기 남겠습니다."`]);
}
function negoToAgent(N,p,say){
  N.stage="agent"; N.tries=0;
  const basis = (N.fromId||N.os) ? N.agreedFee : N.agreedWage*2; // FA는 연봉 기준 수수료
  N.agAsk=Math.max(0.3, Math.round(basis*N.agent.agK*10)/10);
  N.agMin=Math.max(0.2, Math.round(basis*N.agent.agMin*10)/10);
  say("player",`${p.name}: "조건 좋네요. 나머지는 제 에이전트와 마무리하시죠."`);
  say("agent",`${N.agent.name} (${N.agent.n}): "마지막 관문입니다. 제 수수료는 ${N.agAsk}억입니다."`);
}
/* 선수가 원하는 계약 기간 — 어리면 길게 눌러앉고 싶고, 서른 넘으면 구단이 짧게 자른다 */
function negoPrefYears(p){ const a=G.season-p.by; return a<=23?4 : a<=27?3 : a<=30?2 : 1; }
function negoSetYears(y){
  const N=G.nego; if(!N || N.stage!=="wage") return;
  const p=negoPlayerOf(N); if(!p) return;
  y=clamp(Math.round(y),1,5);
  if(!N.prefYears) N.prefYears=negoPrefYears(p);
  if(N.wageAsk0==null){ N.wageAsk0=N.wageAsk; N.wageMin0=N.wageMin; }
  /* 희망보다 짧으면 "불안 수당"을 얹어 부르고, 길게 보장해 주면 조금 양보한다 */
  const k=clamp(1 + Math.max(0, N.prefYears-y)*0.07 - Math.max(0, y-N.prefYears)*0.03, 0.85, 1.30);
  N.years=y;
  N.wageAsk=Math.round(N.wageAsk0*k*10)/10;
  N.wageMin=Math.round(N.wageMin0*k*10)/10;
  saveGame(); show("nego");
}
function negoClose(){
  const N=G.nego; const ut=userTeam(), from=N.fromId?G.teams[N.fromId]:null;
  const p=negoPlayerOf(N);
  const total=Math.round((N.agreedFee+N.agreedAg)*10)/10;
  if(ut.budget<total){ notify(`❌ ${p.name} 영입 무산 — 이적 예산 부족 (총액 ${total}억 필요 / 보유 ${ut.budget}억)`,"warn"); blockNego(N.pid, `${p.name} 영입 무산`); G.nego=null; show("nego"); return; }
  if(!N.osEgg && totalWage(ut)+N.agreedWage > (ut.wageCap||1e9)){
    notify(`❌ ${p.name} 영입 무산 — 연봉 총액 상한 초과 (여유 ${wageRoom(ut)}억 / 요구 ${N.agreedWage}억)`,"warn");
    blockNego(N.pid, `${p.name} 영입 무산`); G.nego=null; show("nego"); return;
  }
  ut.budget=Math.round((ut.budget-total)*10)/10;
  if(from){ from.budget=Math.round((from.budget+N.agreedFee)*10)/10; from.players.splice(from.players.indexOf(p),1); }
  else if(N.os){
    G.overseas=(G.overseas||[]).filter(x=>x.id!==p.id);
    (G.osGone=G.osGone||[]).push(p.osKey||p.name);     // 한 번 떠난 선수는 해외 시장에 다시 뜨지 않는다 (원본 키 기준)
    if(G.scout){                              // 스카우트가 찾아온 선수라면 보고서에서 지운다
      const was=(G.scout.list||[]).length;
      G.scout.list=(G.scout.list||[]).filter(x=>x.id!==p.id);
      if(was!==(G.scout.list||[]).length){
        (G.scout.gone=G.scout.gone||[]).push(p.name);
        delete p.scErr; delete p._scShow;      // 우리 선수가 됐으니 이제 정확히 보인다
        /* ⚠ mvFix 는 보고서에 찍힌 이적료를 고정하려고 붙인 값이다. 그대로 두면 이 선수가
           리그를 씹어 먹어도 시장가치가 3억에 머문다 — '싸게 사서 비싸게 판다'가 성립하지 않는다. */
        delete p.mvFix;
      }
    }
  }
  else { G.freeAgents=G.freeAgents.filter(x=>x.id!==p.id); }
  ut.players.push(p); joinClub(ut, p);   // 일단 빈 번호를 주고, 아래에서 감독이 직접 고를 기회를 준다
  p.wage=N.agreedWage; clearClubBaggage(p, 82);
  p.ct=clamp(N.years||negoPrefYears(p),1,5);   // 협상 테이블에서 정한 계약 기간
  affSet(p, 62+R(12));   // 나를 원해서 데려온 감독 — 시작부터 호의적이다
  try{ tfLogAdd("in", p, from?from.short:(N.os?(p.osClub||"해외"):"FA"), N.agreedFee||0, N.agreedWage, p.ct); }catch(e){}
  if(p.ovr>=75){ adjustTrust("owner",5,`${p.name} 영입`); adjustTrust("fans",7,`${p.name} 영입`); }
  bumpHype(ut, hypeFromSigning(ut, p, N.agreedFee||0), `${p.name} 영입`);
  // 선수 포함 딜 마무리 — fee 협상 때 합의된 "내 선수"를 실제로 상대 구단에 함께 넘긴다
  let swapOut=null;
  if(from && N.agreedSwapPid){
    swapOut=ut.players.find(x=>x.id===N.agreedSwapPid);
    /* 🔀 협상 도중에 상황이 바뀌었을 수 있다(임대 복귀·입대 등) — 넘기기 직전에 다시 확인한다 */
    if(swapOut && !tradeableOwn(swapOut)){
      try{ notify(`🔀 <b>${swapOut.name}</b>은/는 이제 거래에 넣을 수 없어 <b>선수 포함 없이</b> 마무리했습니다.`,"warn"); }catch(e){}
      swapOut=null;
    }
    if(swapOut){
      ut.players.splice(ut.players.indexOf(swapOut),1);
      from.players.push(swapOut); joinClub(from, swapOut);
      swapOut.unhappy=0; swapOut.uWhy=""; swapOut.promise=null; swapOut.sulk=0; swapOut.noMove=false; swapOut.morale=75; swapOut.ct=Math.max(swapOut.ct||1,1);
    }
  }
  if(!from){
    notify(N.os
      ? `🌍 <b>초대형 영입!</b> ${p.name}, ${ut.name} 입단! (이적료 ${N.agreedFee}억 · 연봉 ${N.agreedWage}억 · 에이전트비 ${N.agreedAg}억)`
      : `✍️ <b>FA 영입:</b> ${p.name}, ${ut.name} 입단! (이적료 없음 · 연봉 ${N.agreedWage}억 · 에이전트비 ${N.agreedAg}억)`,"good");
    if(N.os) addNews(`🌍 ${p.name}이(가) ${p.osClub||"해외 구단"}을(를) 떠나 ${ut.name}에 입단합니다. K리그가 발칵 뒤집혔습니다.`);
    if(N.osEgg){
      /* 구단주가 이 계약만큼은 연봉 상한 밖에서 처리한다 — 그러지 않으면 다음 주부터
         "상한 초과" 경고가 계속 뜨고 구단주 신뢰가 깎인다. 이건 그런 종류의 계약이 아니다. */
      ut.wageCap=Math.round((totalWage(ut)+N.agreedWage+4)*10)/10;
      adjustTrust("owner", 10, `${p.name} 영입`);
    }
    if(N.eggNews){ addNews(N.eggNews); adjustTrust("fans", 18, `${p.name} 영입`); }
    scheduleSignPresser(p, {fee:N.agreedFee||0, wage:N.agreedWage});
    socialOnSigning(p, N.agreedFee||0);
    if(N.os) try{ socialOnOverseas(p, N); }catch(e){}
    G.nego=null; saveGame(); show("nego"); askNumberForNewSigning(p); return;
  }
  notify(swapOut
    ? `✍️ <b>오피셜:</b> ${p.name}, ${ut.name} 이적! (현금 ${N.agreedFee}억 + <b>${swapOut.name}</b> 포함 + 에이전트비 ${N.agreedAg}억 · 연봉 ${N.agreedWage}억)`
    : `✍️ <b>오피셜:</b> ${p.name}, ${ut.name} 이적! (이적료 ${N.agreedFee}억 + 에이전트비 ${N.agreedAg}억 · 연봉 ${N.agreedWage}억)`,"good");
  if(swapOut) addNews(`🔀 ${p.name}이(가) ${ut.name}로, ${swapOut.name}이(가) ${from.short}(으)로 — 선수 포함 딜이 성사됐습니다.`);
  scheduleSignPresser(p, {fee:N.agreedFee, wage:N.agreedWage, swap:!!swapOut, swapName:swapOut?swapOut.name:""});
  socialOnSigning(p, N.agreedFee);
  G.nego=null; saveGame(); show("nego"); askNumberForNewSigning(p);
}
function cancelNego(){
  const N=G.nego;
  if(N){
    const from=N.fromId?G.teams[N.fromId]:null;
    const p=negoPlayerOf(N);
    addNews(fixJosa(`🚪 ${from?from.short+"와/과의":(N.os?(N.osClub||"해외 구단")+"와/과의":"FA와의")} 협상에서 철수했습니다.`));
    blockNego(N.pid, p?`${p.name} 협상 중단`:"협상 중단");
  }
  G.nego=null; show("nego");
}
/* ── 방출 (계약 해지 → FA) ── */
function releasePlayer(pid){
  if(armyGate("선수 방출")) return;
  const ut=userTeam(); const p=ut.players.find(x=>x.id===pid); if(!p) return;
  if(ut.players.length<=18){ gameAlert("스쿼드가 18명 이하면 방출할 수 없습니다."); return; }
  const cost=Math.round(p.wage*(p.ct||1)*0.7*10)/10;
  if(ut.budget<cost){ gameAlert(`위약금 ${cost}억을 지급할 예산이 부족합니다. (보유 ${ut.budget}억)`); return; }
  showConfirm(`<b>${p.name} 방출 (계약 해지)</b>\n\n· 잔여 계약: ${p.ct||1}년 (연봉 ${p.wage}억)\n· 합의 해지 위약금: 잔여 연봉의 70% = ${cost}억\n· 방출 후 선수는 FA(자유계약) 신분 — 타 구단이 이적료 없이 영입 가능\n\n진행하시겠습니까?`, ()=>{
    ut.budget=Math.round((ut.budget-cost)*10)/10;
    ut.players.splice(ut.players.indexOf(p),1);
    p.sulk=0; p.noMove=false; p.unhappy=0; p.uWhy=""; p.promise=null; p.morale=60; p.ct=1;
    G.freeAgents=G.freeAgents||[]; G.freeAgents.push(p);
    try{ tfLogAdd("out", p, `방출 (위약금 ${cost}억)`, 0, null, null); }catch(e){}
    G.transferBids=G.transferBids.filter(b=>b.pid!==pid);
    G.offers=(G.offers||[]).filter(o=>o.pid!==pid);
    queueFarewell(p, "자유계약(FA)");
    notify(`✂️ <b>계약 해지:</b> ${p.name} 방출 — 위약금 ${cost}억 지급. 선수는 FA(무적) 신분이 되어 자유계약 시장에 나왔습니다.`,"warn");
    addMood([`💬 ${p.name}: "프로의 세계니까요. 그동안 감사했습니다." (담담한 작별)`,
             `😤 ${p.name}: "이 결정, 반드시 후회하게 만들어 드리죠." (설욕 예고)`,
             `😢 ${p.name}: "정든 팀을 떠나려니... 팬 여러분, 감사했습니다." (눈물의 작별)`,
             `🤬 ${p.name}: "날 자른다고?! 두고 봅시다!" (분노의 작별 인터뷰)`][p.pers||0]);
    if(p.ovr>=74){ ut.morale=clamp(ut.morale-2,40,99); addMood(`😟 주력급 선수의 방출에 라커룸이 술렁입니다. (팀 사기 -2)`);
      adjustTrust("owner",-6,`${p.name} 방출`); adjustTrust("fans",-8,`${p.name} 방출`);
    }
    saveGame(); runPendingBye(()=>show("squad"));
  }, {okLabel:"방출 진행", danger:true});
}
/* ── FA 영입 협상 (이적료 없음: 연봉 → 에이전트) ── */
/* ═══════════════════════════════════════════════════════════════
   해외 이적시장 — 감독이 직접 지정한 선수만 올라오는 별도 시장.
   K리그 구단에 소속되지 않은 선수라 리그 데이터에는 없고, G.overseas 에 따로 산다.
   협상은 FA 흐름을 그대로 쓰되(연봉 → 에이전트), 앞에 구단 합의 이적료가 붙는다.
   set/min/fam 은 PLAYER_TWEAK 과 같은 규칙이다.
═══════════════════════════════════════════════════════════════ */
const OS_WAGE_K=2.4;        // 해외 스타의 연봉 눈높이는 K리그 기준을 한참 넘는다
const OVERSEAS_DEF=[
  { name:"호날두", pos:"FW", bd:"1985/02/05", no:7, h:187, w:85, ovr:88, frn:1,
    club:"알 나스르", nat:"포르투갈", fee:150, mv:150, wageAsk:1400,
    note:"통산 900골을 넘긴 살아 있는 전설. 마무리와 제공권은 여전히 세계 최고 수준이지만, 마흔을 넘긴 몸은 예전 같지 않다. 몸값도 연봉도 K리그가 감당할 수 있는 숫자가 아니다.",
    /* 이스터에그 — 2019년 유벤투스 방한 노쇼. 그 상대가 FC 서울이었다.
       FC 서울 감독으로 개인 협상에 들어가면 본인이 먼저 속죄를 꺼내며 연봉을 1400억 → 100억으로 낮춘다. */
    egg:{ team:"seoul", wage:100,
      say:`"FC 서울이요...? 그곳은 제가 2019년에 노쇼를 했던 곳이잖습니까."`,
      say2:`"그날 경기장을 가득 채운 분들께 아직 빚이 있습니다. 돈 이야기는 접어 두시죠. 연봉 100억이면 됩니다. 속죄하고 싶습니다."`,
      news:`🌍 호날두가 FC 서울행을 직접 요청했습니다. "2019년의 빚을 갚고 싶다"는 말과 함께 연봉을 대폭 낮췄습니다.` },
    pref:"ST",
    fam:{ST:100, LW:100, RW:100, AML:82, AMR:82, AMC:70},
    /* 41세 — 신체는 확실히 내린다 */
    set:{pac:55, acc:52, sta:50, agi:58, bal:72, nat:70, wor:62, tck:30, mar:28, tea:55},
    /* 윙어·스트라이커로서의 능력은 전설 그대로 */
    min:{fin:98, hea:96, jum:97, str:88, otb:97, tec:92, dri:88, fla:88, lon:93, pen:97,
         fre:88, crs:80, fir:88, cmp:97, det:99, ant:93, dec:86, cnt:88, bra:90, ldr:90, agg:78} },
  { name:"린가드", pos:"MF", bd:"1992/12/15", no:10, h:177, w:69, ovr:79, frn:1,
    club:"SC 코린치안스", nat:"잉글랜드", fee:30, mv:30, wageAsk:18,
    note:"FC 서울에서 주장 완장을 찼던 2선 자원. 공격형 미드필더가 본업이지만 좌우 윙어와 최전방까지 소화한다.",
    pref:"CAM",
    fam:{AMC:100, AML:90, AMR:88, LW:88, RW:86, ST:82, MC:70, ML:74, MR:72},
    min:{tec:83, dri:81, fla:78, vis:81, pas:80, otb:85, fin:77, cmp:81, dec:79, ant:81,
         fir:81, lon:77, pen:79, cor:75, fre:74, crs:76, wor:81, tea:83, ldr:85, det:81, cnt:78,
         agi:82, bal:80, acc:77, pac:75, sta:77},
    eggs:{
      seoul:{ wage:14, pool:"lgSeoul",
        say:`"서울이라면 고민할 게 없습니다. 그 완장 아직 제 서랍에 있습니다."`,
        say2:`"돈 이야기는 짧게 합시다. 다시 상암에서 뛸 수 있다면 그걸로 됐습니다."`,
        news:`🌍 린가드가 FC 서울 복귀를 택했습니다. "돌아오려고 여기까지 왔다"며 연봉도 스스로 낮췄습니다.` },
      suwon:{ pool:"lgSuwon",
        say:`"수원이요? ...솔직히 서울 팬들 얼굴이 먼저 떠오르네요."`,
        say2:`"그래도 저를 원하는 곳에서 뛰는 게 맞겠죠. 조건만 맞으면 가겠습니다."`,
        news:`🌍 린가드가 수원 삼성 블루윙즈 유니폼을 입습니다. FC 서울 팬들이 발칵 뒤집혔습니다.` } } },
  { name:"이기제", pos:"DF", bd:"1991/07/09", no:23, h:174, w:72, ovr:76, frn:0,
    club:"방콕 유나이티드 FC", nat:"대한민국", fee:3, wageAsk:8, mv:3, tier:"minor",
    note:"수원 삼성 블루윙즈에서 오래 뛰며 주장까지 맡았던 왼쪽 풀백. 지금은 태국 방콕에서 뛰고 있다. 발은 예전 같지 않지만 왼발에서 나오는 크로스와 세트피스는 여전히 리그 최상급이다.",
    pref:"LB",
    fam:{DL:100, WBL:100, ML:84, DC:62, WBR:62, DR:58, MC:50},
    set:{pac:55, acc:53, sta:58, agi:58, jum:49, str:57, bal:64, nat:59, tec:66, dri:60},
    min:{crs:93, cor:93, fre:91, pas:82, vis:79, dec:76, ant:74,
         tea:84, ldr:86, det:82, wor:80, cnt:76, cmp:78, fir:76, lon:76},
    /* 왼발은 그대로지만 수비는 나이만큼 내려앉았다 */
    set:{pos:71, tck:68, mar:67},
    eggs:{
      suwon:{ wage:6, pool:"kjSuwon",
        say:`"수원이요? ...다시 그 유니폼을 입을 수 있습니까?"`,
        say2:`"연봉은 알아서 맞춰 주십시오. 저는 빅버드에서 마지막을 보내고 싶습니다."`,
        news:`🔵 ${fictName("이기제",0)}이/가 수원 블루스타로 돌아옵니다. 조건도 따지지 않았습니다.` },
      seoul:{ pool:"kjSeoul",
        say:`"서울이라... 수원 팬들이 어떻게 볼지 잘 압니다."`,
        say2:`"그래도 저는 아직 뛸 수 있습니다. 감독님이 필요하다면 가겠습니다."`,
        news:`⚫ ${fictName("이기제",0)}이/가 서울 한강 FC 유니폼을 입습니다. 수원 팬들이 들끓고 있습니다.` } } },
  { name:"뮬리치", pos:"FW", bd:"1994/10/03", no:9, h:205, w:102, ovr:74, frn:1,
    club:"FK 노비파자르", nat:"세르비아", fee:6, mv:6, wageAsk:5, tier:"minor",
    eggs:{ suwon:{ pool:"osReturn" } },
    pref:"ST", famOnly:true,
    fam:{ST:100},
    /* 205cm인데 제공권이 약한 이질적인 장신 공격수. 대신 발이 빠르고 먼 거리에서 때린다. */
    set:{jum:50, hea:48, fin:68, tec:58, dri:54, agi:54, bal:66, otb:70, fir:68,
         pac:88, acc:80, str:94, sta:74, lon:93, fre:91, pen:76, cor:46, crs:50,
         cmp:70, ant:68, dec:66, vis:64, fla:62, tea:66, wor:68, det:72, bra:76, agg:68},
    min:{} },
  { name:"오베르단", pos:"MF", bd:"1995/07/30", no:8, h:175, w:69, ovr:78, frn:1,
    club:"파지아노 오카야마", nat:"브라질", fee:15, mv:15, wageAsk:11, tier:"mid",
    fam:{CM:100, DM:92, AMC:80},
    note:"K리그를 평정했던 중원 사령관. 일본 무대로 건너갔지만 여전히 경기를 지배하는 클래스는 그대로다.",
    min:{} },
  { name:"손흥민", pos:"FW", bd:"1992/07/08", no:7, h:183, w:78, ovr:86, frn:0,
    club:"로스앤젤레스 FC", nat:"대한민국", fee:150, mv:150, wageAsk:120, tier:"big",
    pool:"sonKR",                       /* 어느 구단이 데려가든 전국이 뒤집힌다 */
    pref:"LW",
    fam:{LW:100, AML:92, ST:90, RW:86, AMC:84, AMR:80, ML:76, MC:60},
    /* 강점은 못 박고, 약점(퍼스트 터치·헤더·몸싸움)도 함께 못 박는다 */
    set:{fin:92, pac:92, nat:90, agi:90, tec:90, crs:88, otb:94,
         fir:65, hea:40, pas:86, str:70},
    min:{acc:90, lon:88, dri:88, fla:84, cmp:89, det:92, wor:88, sta:86, bal:84,
         ant:87, dec:85, vis:83, fre:80, pen:89, tea:82, cnt:84, bra:82, ldr:86},
    eggs:{ seoul:{ wage:70, waive:true, pool:"sonSeoul",
      say:`"FC 서울이라면... 제가 축구를 배운 곳입니다."`,
      say2:`"돈은 이미 벌 만큼 벌었습니다. 마지막은 유스 시절 뛰던 잔디에서 하고 싶습니다."`,
      news:`🇰🇷 ${fictName("손흥민",0)}이/가 서울 한강 FC 복귀를 택했습니다. "축구를 배운 곳으로 돌아간다"며 조건도 낮췄습니다.` } } },
  { name:"그리즈만", pos:"MF", bd:"1991/03/21", no:7, h:176, w:67, ovr:84, frn:1,
    club:"올랜도 시티 SC", nat:"프랑스", fee:160, mv:160, wageAsk:110, tier:"big",
    pref:"CAM",
    fam:{AMC:100, AMR:92, RW:92, ST:86, AML:82, LW:80, MC:76, MR:74},
    /* 35세 — 다리는 확실히 죽었지만 발끝의 정확도는 그대로다 */
    set:{pac:62, acc:62, sta:64, agi:68, str:60, jum:55, nat:66, bal:70},
    min:{pas:95, vis:95, tec:93, fre:93, cor:93, crs:91, lon:91, fin:89, otb:87,
         cmp:93, dec:91, ant:89, fla:89, dri:87, fir:91, pen:93,
         tea:89, wor:82, det:89, ldr:85, cnt:88} }
];
const OS_BASE_SEASON=2026;   // 해외 시장 명단의 기준 시즌 — 이 해의 실제 나이를 그대로 쓴다
function mkOverseas(d){
  /* ⚠ 같은 뿌리의 문제 — 명단의 생년이 실제 연도로 못박혀 있어서, 시즌이 흐를수록
     시장에 나오는 선수가 통째로 늙었다(2035년이면 전원 30대 후반).
     기준 시즌 대비 흐른 만큼 생년도 함께 밀어 「그 시즌의 그 나이」를 유지한다. */
  const by=parseInt(d.bd.slice(0,4),10) + Math.max(0, (G.season||OS_BASE_SEASON)-OS_BASE_SEASON);
  const p=mkPlayer(d.name, d.pos, by, d.ovr, d.frn?1:0, {no:d.no, h:d.h, w:d.w, bd:d.bd.slice(5)});
  applyTweakObj(p, d);
  p.osClub=d.club; p.osNat=d.nat; p.osFee=d.fee; p.osNote=d.note||"";
  p.osTier=d.tier||"big";
  p.osPool=d.pool||null;      // 구단을 가리지 않고 항상 붙는 전용 반응
  if(d.mv) p.mvFix=d.mv;      // 시장가치를 고정한다 — 나이로 흔들리지 않게
  p.osWage = d.wageAsk || Math.round(wageExpect(p.ovr, 1, 1)*OS_WAGE_K*10)/10;
  p.osEggs = d.eggs || (d.egg ? {[d.egg.team]:d.egg} : null);   // 구단 id → 전용 반응
  p.wage = p.osWage;
  p.uid = uidForReal(d.name, by, d.bd);       // 🆔 해외 시장 실존 선수(원본 이름 기준)
  p.name = fictName(p.name, p.frn);           // 🎭 라이선스 대비 개명 (osKey는 원본 그대로)
  return p;
}
/* 이미 영입했거나 다른 곳으로 간 선수는 다시 만들지 않는다 */
function overseasList(){
  if(!Array.isArray(G.overseas)) G.overseas=[];
  if(!Array.isArray(G.osGone)) G.osGone=[];
  /* ⚠ 개명 → 복제 버그의 뿌리 — 이름으로만 채움 여부를 판단하면, 에디터로 이름을 바꾼 순간
     원본 이름이 "빠졌다"고 보고 같은 선수를 또 만든다. 원본 키(osKey)로 판단한다. */
  for(const q of G.overseas) if(!q.osKey) q.osKey=q.name;   // 옛 세이브 백필
  const have={}; for(const q of G.overseas) have[q.osKey||q.name]=1;
  for(const d of OVERSEAS_DEF)
    if(!have[d.name] && G.osGone.indexOf(d.name)<0){
      try{ const np=mkOverseas(d); np.osKey=d.name; G.overseas.push(np); }catch(e){} }
  return G.overseas;
}
/* ═══════════════════════════════════════════════════════════════
   🇸🇦 사우디 프로리그 — 오일머니가 우리 선수를 부른다
   실제로도 사우디 클럽들은 아시아 전역의 검증된 자원에게 시장가를 훌쩍 넘는 이적료와
   상상 밖의 연봉을 던진다. 감독에게는 「거절할 수 없는 돈」과 「팀의 기둥」 사이의 선택이다.
     · 제안은 능력치가 좋은 선수에게만 온다. 잘 키울수록 자주 온다.
     · 이적료는 시장가의 두세 배, 연봉은 서너 배 — 구단 재정이 통째로 바뀔 액수다.
     · 선수 본인이 먼저 흔들린다. 거절하면 사기가 꺾이고, 이적 요청으로 이어지기도 한다.
     · 팬 여론도 갈린다 — 거액이면 이해하고, 헐값이거나 기둥이면 폭발한다.
   ═══════════════════════════════════════════════════════════════ */
const SAUDI_CLUBS=[
  {n:"알 힐랄",    c:"#1a4fa0", d:"아시아 최다 우승 클럽. 돈도 야심도 아시아 최고다."},
  {n:"알 나스르",  c:"#d4b106", d:"세계적인 스타를 앞세워 리그를 끌고 가는 구단."},
  {n:"알 이티하드",c:"#1f6f3f", d:"제다의 명문. 최근 몇 년 사이 씀씀이가 완전히 달라졌다."},
  {n:"알 아흘리",  c:"#0f8f4f", d:"승격과 함께 대규모 투자를 시작한 구단."},
  {n:"알 카디시야",c:"#c8452b", d:"국부펀드 계열 자본이 새로 들어온 신흥 강호."},
  {n:"알 샤밥",    c:"#c9a227", d:"리야드의 전통 구단. 아시아 무대 복귀를 노린다."},
  {n:"알 에티팍",  c:"#2f7d3a", d:"담맘 연고. 검증된 아시아 자원을 선호한다."},
  {n:"알 타아운",  c:"#7a3fa0", d:"중위권이지만 특정 포지션에는 아낌없이 쓴다."}
];
const SA_MIN_OVR=77;        // 이 아래로는 사우디가 움직이지 않는다
/* ⚠ 제보 — 「중동에서 오는 300억대 오퍼가 유저에게 너무 큰 이적료 어드밴티지가 된다.
     이적료 폭을 100억 미만으로 낮춰 달라」.
   잘 키운 선수(시장가 90억+)에게 2.1~3.6배가 붙으면 190~320억이 들어와, 한 번만 팔아도
   구단 재정이 통째로 뒤집혔다. 배수를 낮추고 상한을 못박는다.
   ─ 돈은 여전히 크다(시장가의 두 배 안팎). 다만 리그를 부숴 버릴 액수는 아니다. */
const SA_FEE_K=[1.7, 2.8];  // 시장가 대비 이적료 배수
const SA_FEE_MAX=150;       /* 이적료 상한(억)
   ⚠ 요청 원문 — 「사우디 구단이 선수에게 오퍼할때 상한선을 150억까지로 늘리자」.
     예전 값 99억은 시장가 36억(=99/2.8)이면 벌써 천장에 닿아, 특급 자원이 아무리 커져도
     제시액이 늘 99억으로 눌려 있었다. 150억이면 배수(1.7~2.8)가 시장가 54억까지 제대로 먹는다. */
const SA_WAGE_K=[3.2, 6.0]; // 현재 연봉 대비 제시 연봉 배수
const SA_EXP=6;             // 답변 기한(일)
/* ═══ 🇸🇦 중동이 움직일 만한 선수인가 ═══════════════════════════════════
   ⚠ 제보 — 「33세 FA로 데려온 스트라이커에게 곧바로 300억대 제안이 왔다. 중동이 거액으로
     눈독 들이는 선수라면 K리그1 MVP·득점왕·도움왕·베스트11 정도의 활약은 있어야 하지 않나」.
     맞는 지적이다. 예전에는 능력치(77 이상) 하나만 봤다 — 실적이 전혀 없어도 제안이 갔다.
   ─ 최근 세 시즌 안에 K리그1 개인상(MVP·득점왕·도움왕·베스트11)을 받았거나,
     지금 시즌 K리그1 득점 또는 도움 1위를 달리고 있어야 한다. */
const SA_ACC_YEARS=3;
const SA_ACC_N={mvp:"K리그1 MVP", top:"K리그1 득점왕", ast:"K리그1 도움왕", xi:"K리그1 베스트 11",
  motm1:"K리그1 이달의 선수"};
function saudiAccText(p){
  const A=p&&p.acc; if(!A) return "";
  const fresh=(y)=>((G.season-(y||0))<=SA_ACC_YEARS);
  if(fresh(A.s)) for(const k of ["mvp","top","ast","xi"]) if(A[k]) return SA_ACC_N[k]+(A[k]>1?` ${A[k]}회`:"");
  /* 🏅 이달의 선수를 두 번 이상 받았으면 그것도 실적이다 (요청 — 배선).
     ⚠ 신선도 도장은 월간상 전용(A.sMotm)이다 — 시즌 개인상의 도장을 건드리면
        오래된 MVP 가 되살아난다. */
  if((A.motm1||0)>=2 && fresh(A.sMotm)) return SA_ACC_N.motm1+` ${A.motm1}회`;
  return "";
}
function saudiEligible(p){
  if(!p) return false;
  if(saudiAccText(p)) return true;
  /* 시상식 전이라도 지금 리그를 지배하고 있으면 대륙이 먼저 움직인다 */
  try{
    const t=teamOfPlayer(p);
    if(!t || t.div!==1 || (p.apps||0)<10) return false;
    let g1=0, a1=0;
    for(const id in G.teams){ const T=G.teams[id]; if(T.div!==1) continue;
      for(const q of T.players){ if((q.goals||0)>g1) g1=q.goals||0; if((q.assists||0)>a1) a1=q.assists||0; } }
    if(g1>=5 && (p.goals||0)>=g1) return true;
    if(a1>=5 && (p.assists||0)>=a1) return true;
  }catch(e){}
  return false;
}
function saudiWhy(p){
  const t=saudiAccText(p);
  if(t) return t;
  try{ const tm=teamOfPlayer(p);
    if(tm && tm.div===1){
      let g1=0,a1=0;
      for(const id in G.teams){ const T=G.teams[id]; if(T.div!==1) continue;
        for(const q of T.players){ if((q.goals||0)>g1) g1=q.goals||0; if((q.assists||0)>a1) a1=q.assists||0; } }
      if(g1>=5 && (p.goals||0)>=g1) return `${G.season} K리그1 득점 1위 (${p.goals}골)`;
      if(a1>=5 && (p.assists||0)>=a1) return `${G.season} K리그1 도움 1위 (${p.assists}도움)`;
    }
  }catch(e){}
  return "";
}
function saudiOffer(){ return G.saOffer || null; }
function saClubOf(o){ return (SAUDI_CLUBS.find(x=>x.n===(o&&o.club)) || SAUDI_CLUBS[0]); }
/* 하루치 — 이적시장이 열려 있을 때만 */
function tickSaudi(){
  try{
    if(G.jobless || !userTeam()) return;
    const day=G.day||0;
    /* 기한이 지난 제안은 조용히 사라진다 — 사우디는 기다려 주지 않는다 */
    if(G.saOffer){
      const ut0=userTeam();
      const still=ut0.players.some(p=>p.id===G.saOffer.pid);
      if(!still){ G.saOffer=null; }
      else if(day>=G.saOffer.due){
        const p=ut0.players.find(x=>x.id===G.saOffer.pid);
        const cn=G.saOffer.club;
        G.saOffer=null;
        addNews(`🇸🇦 ${cn}, ${p.name} 영입 협상 철회 — "다른 자원으로 방향을 틀었다"`, null, "club");
        if(p){ delete p._saWant; p._saCool=day+30+R(30); }
      }
      return;                                    // 한 번에 한 건만 굴린다
    }
    if(typeof transferOpen==="function" && !transferOpen()) return;
    const ut=userTeam();
    /* 한 번 거절했거나 제안이 지나간 선수는 한동안 조용하다 —
       매번 흔들어 대면 거절할 때마다 사기가 깎여 감독이 벌을 받는 구조가 된다 */
    const cands=ut.players.filter(p=>
      p.ovr>=SA_MIN_OVR && !p.emg && !p.loan && !p.army && (p.inj||0)<=0
      && !(G.saGone||[]).includes(p.id) && !(p._saCool>day)
      && saudiEligible(p));      // 🏅 실적이 있어야 대륙이 움직인다 (제보)
    if(!cands.length) return;
    /* 잘하는 선수일수록 자주 온다 — 77에서는 거의 안 오고, 85 이상이면 시즌에 몇 번씩 */
    let best=null, bw=0;
    for(const p of cands){
      const w=Math.pow(p.ovr-(SA_MIN_OVR-1), 1.7) * (1+clamp((28-(G.season-p.by))/10, -0.35, 0.45));
      if(w>bw){ bw=w; best=p; }
    }
    if(!best) return;
    if(Math.random() > clamp(bw*0.00042, 0, 0.05)) return;
    const p=best;
    const club=pick(SAUDI_CLUBS);
    const mv=marketValue(p);
    const fee=Math.min(SA_FEE_MAX, Math.round(mv*(SA_FEE_K[0]+Math.random()*(SA_FEE_K[1]-SA_FEE_K[0]))));
    const wage=Math.round((p.wage||1)*(SA_WAGE_K[0]+Math.random()*(SA_WAGE_K[1]-SA_WAGE_K[0]))*10)/10;
    G.saOffer={pid:p.id, club:club.n, fee, wage, mv, due:day+SA_EXP, at:day, seen:0};
    /* 선수 본인이 먼저 흔들린다 — 야심가일수록, 나이가 있을수록 크게 */
    const age=G.season-(p.by||2000);
    let want=0.34 + (p.pers===1?0.26:0) + clamp((age-27)/12, 0, 0.24) + clamp((wage/Math.max(0.2,p.wage||1)-3)*0.05, 0, 0.16);
    if(p.pers===2) want-=0.12;                    // 조용한 성격은 덜 흔들린다
    if((p.loyal||0)>=70) want-=0.14;
    p._saWant = Math.random() < clamp(want, 0.10, 0.86) ? 1 : 0;
    addNews(`🇸🇦 <b>${club.n}</b>, ${p.name} 영입 제안 — 이적료 <b>${fee}억</b> · 연봉 <b>${wage}억</b> (시장가 ${mv}억)`, "warn", "club",
      {cat:"transfer", ic:"🇸🇦", tone:0, tid:ut.id, src:"사우디 프로리그",
       head:`${club.n}, ${ut.short} ${p.name}에 거액 제시`,
       sub:`${club.d} 이적료 ${fee}억은 ${p.name}의 시장가(${mv}억)를 크게 웃도는 금액이다.`});
    try{ socialFill(SOC.saudiIn, 3+R(3), 0, {t:ut.short, p:p.name, c:club.n, m:fee, w:wage}); }catch(e){}
    try{ fmkFill(FMK.saudiIn, 2+R(3), {t:ut.short, p:p.name, c:club.n, m:fee, w:wage}); }catch(e){}
    if(p._saWant) addMood(`💬 ${p.name}: "감독님... ${club.n}에서 연락이 왔다고 들었습니다. 솔직히 마음이 흔들립니다."`);
    else addMood(`💬 ${p.name}: "${club.n} 얘기는 들었습니다. 저는 여기서 더 하고 싶습니다."`, "good");
    notify(`🇸🇦 <b>${club.n}</b>이(가) ${p.name}에게 이적료 ${fee}억을 제시했습니다 — 📨 타 구단 제의에서 확인하세요.`, "warn");
  }catch(e){}
}
/* 수락 — 선수는 K리그를 떠난다 */
function saudiAccept(){
  const o=G.saOffer; if(!o) return;
  const ut=userTeam(); const p=ut.players.find(x=>x.id===o.pid);
  if(!p){ G.saOffer=null; show("offers"); return; }
  if(ut.players.length<=18){ notify("⚠️ 스쿼드가 18명 이하라 선수를 보낼 수 없습니다.","warn"); return; }
  const club=saClubOf(o), wasStar=p.ovr>=SA_MIN_OVR+2, wanted=!!p._saWant;
  showConfirm(`<b>🇸🇦 ${o.club}행을 수락합니다</b>\n\n${p.name} (${p.pos} ${dispOvr(p)}) — 이적료 <b>${o.fee}억</b>\n선수 연봉은 ${p.wage}억 → ${o.wage}억이 됩니다.\n\n<span class="small">${wanted?"본인도 떠나고 싶어 합니다.":"본인은 잔류를 원하고 있습니다 — 강행하면 라커룸이 흔들립니다."}</span>`,
  ()=>{
    try{ socialOnSale(p); }catch(e){}
    ut.players.splice(ut.players.indexOf(p),1);
    try{ clearClubBaggage(p, 80); }catch(e){}
    ut.budget=Math.round((ut.budget+o.fee)*10)/10;
    try{ const fin=finLedger(ut); fin.sell=Math.round(((fin.sell||0)+o.fee)*100)/100; }catch(e){}
    try{ tfLogAdd("out", p, o.club+" (사우디)", o.fee, null, null); }catch(e){}
    G.offers=(G.offers||[]).filter(x=>x.pid!==p.id);
    G.transferBids=(G.transferBids||[]).filter(b=>b.pid!==p.id);
    (G.saGone=G.saGone||[]).push(p.id);
    if(Array.isArray(G.userXI)) G.userXI=G.userXI.filter(id=>id!==p.id);
    G.saOffer=null;
    const V={t:ut.short, p:p.name, c:o.club, m:o.fee, w:o.wage};
    addNews(`🇸🇦 <b>${p.name}, ${o.club} 이적 확정</b> — 이적료 ${o.fee}억 (시장가 ${o.mv}억). 구단 예산에 반영되었습니다.`, "warn", "club",
      {cat:"transfer", ic:"✍️", tone:0, tid:ut.id, src:"K리그 공식",
       head:`${p.name}, 사우디로 — ${o.fee}억`,
       sub:`${ut.name}은 시장가의 ${(o.fee/Math.max(1,o.mv)).toFixed(1)}배를 받았다. 그라운드에 남은 공백은 감독의 몫이다.`});
    try{ socialFill(wasStar&&!wanted?SOC.saudiOutRage:SOC.saudiOut, 4+R(3), wasStar&&!wanted?-1:0, V);
         fmkFill(FMK.saudiOut, 3+R(3), V); }catch(e){}
    try{ queueFarewell(p, o.club); }catch(e){}
    if(wasStar && !wanted){
      ut.morale=clamp(ut.morale-5, 40, 99);
      G.starGone=3;
      adjustTrust("fans", -9, `${p.name} 사우디 이적`);
      adjustTrust("owner", o.fee>=o.mv*2.5 ? 6 : -2, `${p.name} 이적료 ${o.fee}억`);
      addMood(`😥 기둥이 떠났습니다. 라커룸이 조용합니다. <span class="small">(팀 사기 -5)</span>`);
    } else {
      adjustTrust("owner", 5, `${p.name} 고액 매각 (${o.fee}억)`);
      if(wanted) addMood(`💬 ${p.name}: "보내 주셔서 감사합니다. 이 팀은 제 커리어의 전부였습니다."`, "good");
    }
    try{ bumpHype(ut, -clamp((playerLevel(p)-starRefLevel())*0.008, 0, 0.09)*(wanted?0.5:1), `${p.name} 사우디 이적`); }catch(e){}
    notify(`💰 <b>이적 확정</b> — ${p.name} → ${o.club} (${o.fee}억)`, "good");
    saveGame(); show("offers");
  }, {okLabel:`${o.fee}억에 보낸다`, cancelLabel:"다시 생각한다"});
}
/* 거절 */
function saudiReject(){
  const o=G.saOffer; if(!o) return;
  const ut=userTeam(); const p=ut.players.find(x=>x.id===o.pid);
  G.saOffer=null;
  if(!p){ show("offers"); return; }
  const V={t:ut.short, p:p.name, c:o.club, m:o.fee, w:o.wage};
  addNews(`🚫 ${ut.name}, ${o.club}의 ${p.name} 영입 제안 거절 — "팔 생각이 없다"`, "good", "club");
  try{ socialFill(SOC.saudiKeep, 3+R(3), 1, V); fmkFill(FMK.saudiKeep, 2+R(2), V); }catch(e){}
  if(p._saWant){
    p.morale=clamp((p.morale||70)-14, 25, 99);
    try{ affAdd(p, -12, "사우디행 거절"); }catch(e){}
    p.unhappy=Math.max(p.unhappy||0, 1); p.uWhy="이적 무산";
    addMood(`😠 ${p.name}: "...알겠습니다. 하지만 이런 기회가 또 올지 모르겠습니다." <span class="small">(사기 -14 · 불만)</span>`, "warn");
    adjustTrust("owner", -3, `${o.fee}억 제안 거절`);
  } else {
    p.morale=clamp((p.morale||70)+4, 25, 99);
    try{ affAdd(p, 6, "잔류 결정"); }catch(e){}
    addMood(`💪 ${p.name}: "저를 붙잡아 주셔서 감사합니다. 그라운드에서 갚겠습니다."`, "good");
    adjustTrust("fans", 4, `${p.name} 잔류`);
  }
  delete p._saWant;
  p._saCool=(G.day||0)+45+R(45);        // 거절했으니 당분간은 조용하다
  saveGame(); show("offers");
}
/* 제의 탭에 띄울 카드 */
function saudiCard(){
  const o=G.saOffer; if(!o) return "";
  const ut=userTeam(); const p=ut && ut.players.find(x=>x.id===o.pid);
  if(!p) return "";
  o.seen=1;
  const club=saClubOf(o);
  const left=Math.max(0, o.due-(G.day||0));
  const mult=(o.fee/Math.max(1,o.mv)).toFixed(1);
  return `<div class="card" style="border:2px solid ${club.c}">
    <h3>🇸🇦 ${o.club}의 영입 제안 <span class="small">— 답변 기한 D-${left}</span></h3>
    <p class="small" style="margin:2px 0 8px">${club.d}</p>
    ${(()=>{ const w=saudiWhy(p); return w?`<p class="small" style="margin:0 0 8px;color:var(--gold)">🏅 ${club.n||o.club} 단장: "<b>${w}</b> — 우리가 찾던 선수입니다."</p>`:""; })()}
    <div class="tblScroll"><table>
      <tr><th>선수</th><th>제시 이적료</th><th>시장가</th><th>제시 연봉</th><th>본인 의사</th></tr>
      <tr><td><b>${p.name}</b> <span class="small">${p.pos} ${dispOvr(p)}</span></td>
          <td><b class="money">${o.fee}억</b> <span class="small">(시장가의 ${mult}배)</span></td>
          <td class="small">${o.mv}억</td>
          <td>${p.wage}억 → <b class="money">${o.wage}억</b></td>
          <td>${p._saWant?'<span style="color:#d29922">떠나고 싶어 함</span>':'<span style="color:var(--green)">잔류를 원함</span>'}</td></tr>
    </table></div>
    <p class="small" style="margin-top:6px">오일머니는 기다려 주지 않습니다. 기한이 지나면 제안은 사라집니다.
      ${p._saWant?"거절하면 <b>선수가 크게 실망</b>합니다.":"본인은 남고 싶어 합니다 — 강행하면 라커룸이 흔들립니다."}</p>
    <div style="display:flex;gap:7px;margin-top:8px">
      <button class="mini" style="flex:1;border-color:var(--green);color:var(--green)" onclick="saudiAccept()">💰 ${o.fee}억에 보낸다</button>
      <button class="mini" style="flex:1;border-color:#f85149;color:#f85149" onclick="saudiReject()">🚫 거절한다</button>
    </div></div>`;
}
/* ═══════════════════════════════════════════════════════════════
   해외 이적시장 — 타 구단의 개입
   ⚠ 지금까지 해외 시장은 감독(유저)만 손댈 수 있었다. 시즌 내내 같은 이름이 그대로 걸려 있어서
     "언제든 데려오면 되는 명단"처럼 느껴졌다. 이제 K리그 다른 구단들도 이 시장에 뛰어든다.
   두 단계로 굴린다.
     ① 관심(osLink) — 어느 구단이 접촉했다는 소식이 먼저 뜬다. 마감일이 붙는다.
     ② 마감 — 그때까지 감독이 채가지 못하면 그 구단이 계약을 마무리한다.
   그래서 대형 매물을 보고도 미루면 놓칠 수 있다. 다만 유저가 협상 테이블에 앉아 있는
   동안에는 가로채지 않는다(마감일이 뒤로 밀린다) — 협상 중에 사라지면 게임이 아니라 사고다. */
const OS_AI_P={big:0.010, mid:0.032, minor:0.055};   // 등급별 하루 관심 발생 확률
function osAiAfford(t, p){
  if(!t || t.isUser) return false;
  if(isArmyTeam(t)) return false;              // 군경팀은 외국인을 등록할 수 없다
  const fee=marketValue(p), wage=p.osWage||p.wage||1;
  if((t.budget||0) < fee*1.05) return false;
  if(wageRoom(t) < wage*1.05) return false;
  if((t.players||[]).length >= 32) return false;
  return true;
}
function osAiPick(p){
  const tier=p.osTier||"big";
  const cand=[];
  for(const id in G.teams){
    const t=G.teams[id];
    if(!osAiAfford(t, p)) continue;
    if(tier==="big" && t.div!==1) continue;              // 대형 매물은 1부 상위권만 넘본다
    if(tier==="mid" && t.div!==1 && (t.budget||0)<marketValue(p)*2) continue;
    /* 자기 자리에 이미 좋은 자원이 있으면 덜 움직인다 */
    const same=(t.players||[]).filter(q=>q.pos===p.pos && q.ovr>=p.ovr-2).length;
    let w=(t.budget||1) * (t.div===1?1.6:1) / (1+same*0.8);
    cand.push({t, w});
  }
  if(!cand.length) return null;
  const tot=cand.reduce((s2,c)=>s2+c.w,0);
  let r=Math.random()*tot;
  for(const c of cand){ r-=c.w; if(r<=0) return c.t; }
  return cand[cand.length-1].t;
}
/* 🏃 ⚠ 제보 원문 — 「AI 구단이 이적시장 열릴 때부터 적극적으로 움직이지 않는다. 하이재킹을
   당하거나 먼저 찜 해놓은 선수가 다른 구단으로 이적해서 기회를 잃어본 적이 없다. 이적시장
   이튿날부터 적극적으로 움직이게 해 달라」.
   ─ 해외 시장에는 이미 osLink(관심 → 마감 → 계약) 배관이 있는데 국내 시장에는 없었다.
     같은 구조를 K리그 안에도 놓는다: AI 가 「우리 스쿼드에서 제일 약한 자리」를 보고
     다른 구단의 알맞은 선수에게 관심을 건다. 마감까지 감독이 못 채가면 그 구단이 데려간다.
   ─ 유저가 협상 중인 선수는 마감이 미뤄진다(해외 시장과 같은 원칙) — 협상 중 증발은 사고다. */
const DOM_LINK_MAX=3;              // 리그 전체에서 동시에 진행되는 영입 추진 건수
/* 포지션별 리그 평균 — 팀 평균과 비교하면 눈금이 어긋난다(GK 는 체계적으로 낮게 나와
   ⚠ 실측에서 국내 영입이 전부 골키퍼로 쏠렸다). 같은 포지션끼리 비교한다. 하루 캐시. */
let _DOMPA=null, _DOMPA_D=-1;
function domPosAvg(){
  if(_DOMPA && _DOMPA_D===(G.day||0)) return _DOMPA;
  const sum={GK:0,DF:0,MF:0,FW:0}, cnt={GK:0,DF:0,MF:0,FW:0};
  try{
    for(const id in G.teams){ const t=G.teams[id]; if(!t||isArmyTeam(t)) continue;
      const by={GK:[],DF:[],MF:[],FW:[]};
      for(const q of (t.players||[])){ if(!q||q.loan||q.army) continue; if(by[q.pos]) by[q.pos].push(q.ovr||60); }
      for(const pos in by){ const a2=by[pos].sort((x,y)=>y-x).slice(0, pos==="GK"?1:pos==="DF"?4:3);
        for(const v of a2){ sum[pos]+=v; cnt[pos]++; } } }
  }catch(e){}
  const out={}; for(const k in sum) out[k]= cnt[k]? sum[k]/cnt[k] : 66;
  _DOMPA_D=(G.day||0); return (_DOMPA=out);
}
function domWeakPos(t){
  try{
    /* 「팀 수준 대비 그 자리가 약한가」를 본다 (요청 원문 — 스쿼드 어빌 대비 부족한 포지션).
       다만 포지션마다 OVR 눈금이 체계적으로 다르므로(GK 가 낮게 나온다) 리그의 포지션 편차를
       빼고 비교한다. 안 그러면 모든 구단이 골키퍼만 사러 다닌다(실측). */
    const PA=domPosAvg();
    const all=(PA.GK+PA.DF+PA.MF+PA.FW)/4;
    const base=teamOVR(t);
    const need=[];
    for(const pos of ["GK","DF","MF","FW"]){
      const grp=(t.players||[]).filter(q=>q.pos===pos && !q.loan && !q.army).sort((a,b)=>b.ovr-a.ovr);
      const top=(pos==="GK")?1:(pos==="DF")?4:3;
      const want=base + ((PA[pos]||all)-all);          // 이 팀이라면 이 자리에 있어야 할 수준
      if(grp.length<top+1) { need.push({pos, gap:(pos==="GK"?1.0:2.0)}); continue; }
      const core=grp.slice(0,top).reduce((s2,q)=>s2+q.ovr,0)/top;
      const gap=want-core;
      if(gap>0.5) need.push({pos, gap});
    }
    need.sort((a,b)=>b.gap-a.gap);
    return need[0]||null;
  }catch(e){ return null; }
}
function tickDomesticAI(){
  try{
    if(!G.teams || G.jobless || G.phase==="sacked") return;
    if(typeof transferOpen!=="function" || !transferOpen()) return;
    const w=windowInfo();
    if(!w.open || (w.week===1 && (G.day||0)%7<1)) { /* 첫날은 감독에게 양보한다 (요청) */ }
    const day=G.day||0;
    G.domLink=Array.isArray(G.domLink)?G.domLink:[];
    /* ① 진행 중인 건 — 마감이 되면 계약한다 */
    for(let i=G.domLink.length-1;i>=0;i--){
      const L=G.domLink[i];
      const to=G.teams[L.tid], from=G.teams[L.fid];
      const p=from&&(from.players||[]).find(q=>q.id===L.pid);
      if(!to||!from||!p||p.loan){ G.domLink.splice(i,1); continue; }
      if(G.nego && G.nego.pid===L.pid){ L.due=Math.max(L.due, day+5); continue; }   // 협상 중이면 미룬다
      if(day<L.due) continue;
      const fee=Math.round(Math.min(marketValue(p)*(0.85+Math.random()*0.35), Math.max(0.1,(to.budget||0)))*10)/10;
      if((to.budget||0)<fee || (to.players||[]).length>=32){ G.domLink.splice(i,1); continue; }
      to.budget=Math.round(((to.budget||0)-fee)*10)/10;
      from.budget=Math.round(((from.budget||0)+fee)*10)/10;
      from.players.splice(from.players.indexOf(p),1);
      to.players.push(p);
      try{ clearClubBaggage(p, 72); joinClub(to, p); p.ct=aiCtYears(p);
           p.wage=Math.round(Math.max(p.wage||0, wageExpect(p.ovr,p.frn,to.div))*10)/10; }catch(e){}
      G.domLink.splice(i,1);
      addNews(`💸 <b>${to.name}</b>, ${from.short} ${p.name}(${G.season-(p.by||2000)}세 ${POS_KO[p.pos]||p.pos}) 영입 — 이적료 ${fee}억`, "warn", "club",
        {cat:"transfer", ic:"💸", tone:-1, tid:to.id,
         head:`${to.short}, ${p.name} 영입 완료`, sub:`이적료 ${fee}억. 관심을 두고 있던 구단들은 한발 늦었다.`, src:"K리그 공식"});
      try{ if(slFind && slFind(p.id)) flash(`💸 관심 목록의 <b>${p.name}</b>이(가) ${to.short}으로 갔습니다 — 한발 늦었습니다.`,"warn"); }catch(e){}
    }
    /* ② 새 관심 — 이적시장 이튿날부터 (요청) */
    if(day<1) return;
    if(G.domLink.length>=DOM_LINK_MAX) return;
    if(Math.random()>=0.55) return;
    const clubs=Object.values(G.teams).filter(t=>!t.isUser && !isArmyTeam(t) && !ceAusterity(t.id)
      && (t.players||[]).length<31 && (t.budget||0)>3);
    if(!clubs.length) return;
    const to=pick(clubs);
    const need=domWeakPos(to); if(!need) return;
    const _mine=(to.players||[]).filter(q=>q.pos===need.pos && !q.loan && !q.army).sort((a,b)=>b.ovr-a.ovr);
    /* 주전 라인의 「가장 약한 고리」를 기준으로 삼는다 — 그보다 나으면 전력 보강이다 */
    const _topN=(need.pos==="GK")?1:(need.pos==="DF")?4:3;
    const curBest=_mine.length? (_mine[Math.min(_topN,_mine.length)-1].ovr) : 0;
    /* 그 자리를 실제로 메워 줄 선수 — 다른 AI 구단의 여유 자원 (유저 선수는 제안 경로가 따로 있다) */
    const pool=[];
    for(const id in G.teams){
      const from=G.teams[id];
      if(!from || from===to || from.isUser || isArmyTeam(from)) continue;
      if((from.players||[]).length<=21) continue;
      for(const q of (from.players||[])){
        if(!q || q.loan || q.army) continue;
        if(q.pos!==need.pos) continue;
        if(q.ovr < curBest+0.5) continue;                   // 주전 라인의 약한 고리보다 나아야 산다
        if(aiKeepTalent(q) && Math.random()<0.72) continue;  // 원소속이 웬만해선 안 판다
        if(frnQ(q) && to.players.filter(x=>frnQ(x)).length>=(to.div===1?6:5)) continue;
        if(marketValue(q) > (to.budget||0)) continue;
        pool.push({q, from});
      }
    }
    if(!pool.length) return;
    pool.sort((a,b)=>b.q.ovr-a.q.ovr);
    const tgt=pool[Math.floor(Math.random()*Math.min(5, pool.length))];
    if(G.domLink.some(L=>L.pid===tgt.q.id)) return;
    G.domLink.push({pid:tgt.q.id, tid:to.id, fid:tgt.from.id, due:day+3+R(5)});
    const nm=tgt.q.name;
    addNews(`📰 <b>${to.name}</b>, ${tgt.from.short} ${nm} 영입 추진 — ${POS_KO[need.pos]||need.pos} 보강이 급하다`, null, "club",
      {cat:"transfer", ic:"📰", tone:0, tid:to.id,
       head:`${to.short}, ${nm} 영입 추진`, sub:`${to.short}는 ${POS_KO[need.pos]||need.pos} 자리를 시즌 내내 고민해 왔다. 협상은 마무리 단계로 알려졌다.`, src:pick(MEDIA)});
    try{ if(slFind && slFind(tgt.q.id)) flash(`📰 관심 목록의 <b>${nm}</b>에게 <b>${to.short}</b>이(가) 접근했습니다 — 서두르세요.`,"warn"); }catch(e){}
  }catch(e){}
}
function tickOverseasAI(){
  if(!G.teams || !userTeam() || G.phase==="sacked") return;
  if(typeof transferOpen==="function" && !transferOpen()) return;
  const day=G.day||0;
  for(const p of overseasList().slice()){
    /* 유저가 협상 중인 선수는 건드리지 않는다 — 대신 마감이 미뤄질 뿐이다 */
    if(G.nego && G.nego.pid===p.id){ if(p.osLink) p.osLink.due=Math.max(p.osLink.due, day+5); continue; }
    if(p.osLink){
      const t=G.teams[p.osLink.tid];
      if(!t || !osAiAfford(t, p)){ p.osLink=null; continue; }   // 사정이 바뀌면 접촉이 끊긴다
      if(day>=p.osLink.due) osAiSign(p, t);
      continue;
    }
    if(Math.random() > (OS_AI_P[p.osTier||"big"]||0.01)) continue;
    const t=osAiPick(p); if(!t) continue;
    p.osLink={tid:t.id, due:day+4+R(7)};
    addNews(`🌍 <b>${t.name}</b>, ${p.name}(${p.osClub}) 영입 협상에 돌입 — 이적료 ${marketValue(p)}억 규모`, "warn", "club",
      {cat:"transfer", ic:"🌍", tone:-1, tid:t.id,
       head:`${t.short}, ${p.name} 영입 임박`,
       sub:`${p.osClub}와의 협상이 마무리 단계다. 원하는 구단이 있다면 서둘러야 한다.`, src:"K리그 공식"});
    flash(`🌍 <b>${t.short}</b>이(가) ${p.name} 영입에 나섰습니다 — 데려오려면 서두르세요.`,"warn");
  }
}
function osAiSign(p, t){
  const fee=marketValue(p), wage=p.osWage||p.wage||1;
  const ut=userTeam();
  p.osLink=null;
  t.budget=Math.round((t.budget-fee)*10)/10;
  G.overseas=(G.overseas||[]).filter(x=>x.id!==p.id);
  (G.osGone=G.osGone||[]).push(p.osKey||p.name);
  t.players.push(p); joinClub(t, p);
  p.wage=wage; p.morale=80; p.unhappy=0; p.uWhy=""; p.promise=null; p.ct=1+R(3);
  /* 🚫 ⚠ 제보 원문 — 「제가 영입 하지 않은 선수들인데 '이적 시장' 탭의 '영입, 방출' 기록에서
     뮬리치, 오베르단, 이기제 등의 선수를 영입 했다고 하는 버그가 있습니다. … '영입, 방출'
     항목에서는 유저가 직접 영입하거나 이적, 방출 시킨 선수만 기록에 남게 고쳐주시면」.
     원인이 정확히 이 한 줄이었다 — 여기는 「AI 구단」이 해외 이적시장에서 선수를 데려가는
     자리인데, 유저 장부(tfLogAdd)를 그대로 불렀다. 남의 구단 영입이 내 기록에 섞였다.
     세 선수 모두 해외 이적시장(G.overseas) 명단에 있는 선수다. */
  try{ bumpHype(t, hypeFromSigning(t, p, fee), `${p.name} 영입`); }catch(e){}
  const V={p:p.name, c:t.short, t:t.short, m:fee, o:p.osClub||""};
  addNews(`🌍 <b>${t.name}</b>, ${p.name} 영입 확정 — ${p.osClub} → ${t.short} (이적료 ${fee}억 · 연봉 ${wage}억)`, "warn", "club",
    {cat:"transfer", ic:"✍️", tone:-1, tid:t.id,
     head:`${t.name}, ${p.name} 영입 완료`,
     sub:`${p.osClub}에서 뛰던 ${p.name}이 ${t.name} 유니폼을 입는다. 이적료는 ${fee}억 규모로 알려졌다.`, src:"K리그 공식"});
  /* 구단 전용 이스터에그가 있으면 그 소식이 먼저 나간다 (예: 친정 복귀) */
  const eg=p.osEggs && p.osEggs[t.id];
  if(eg && eg.news) addNews(eg.news, "warn", "club");
  const big=(p.osTier||"big")!=="minor";
  if(eg && eg.pool && SOC[eg.pool])  rivalFill(SOC[eg.pool], 2+R(2), 0, V);
  socialFill(SOC.osRivalSign, big?3+R(3):2+R(2), -1, V);
  fmkFill(FMK.osRivalSign, big?3+R(3):2+R(2), V);
  if(big) rivalFill(RIV.osRivalSign, 2+R(2), 0, V);
  if(ut && big) adjustTrust("fans", -1.5, `${t.short}의 ${p.name} 영입 — 팬들의 비교`);
  saveGame();
}
function startOverseasNego(pid){
  if(armyGate("해외 영입")) return;
  if(waGate("해외 영입")) return;             // 💸 임금 체불 제재 (요청)
  if(!transferOpen()){ notify("이적시장이 닫혀 있습니다. 해외 영입도 윈도우 기간에만 가능합니다.","warn"); return; }
  if(G.nego){ notify("이미 진행 중인 영입 협상이 있습니다.","warn"); show("nego"); return; }
  const left=negoBlockDaysLeft(pid);
  if(left>0){ notify(`협상이 결렬된 지 얼마 되지 않았습니다. ${left}일 뒤에 다시 접촉할 수 있습니다.`,"warn"); return; }
  const p=overseasList().find(x=>x.id===pid) || scoutedList().find(x=>x.id===pid); if(!p) return;
  if(p.osLink) p.osLink.due=Math.max(p.osLink.due, (G.day||0)+5);   // 협상 중에 채가지 않는다
  const ut=userTeam(); const mv=marketValue(p);
  if(ut.budget < mv*0.8){ notify(`❌ 몸값이 ${mv}억입니다. 최소한 그 정도는 마련해야 협상 테이블에 앉을 수 있습니다. (보유 ${ut.budget}억)`,"warn"); return; }
  const at=AGENT_T[p.id%3];
  /* 해외 구단은 K리그 구단보다 아쉬울 게 없다 — 요구액이 국내보다 세게 붙는다 */
  const feeAsk=Math.round(mv*1.42*at.feeK*10)/10;
  const feeMin=Math.round(mv*1.08*10)/10;
  const eg = (p.osEggs && p.osEggs[ut.id]) || null;
  const wageAsk = Math.round((p.osWage||wageExpect(p.ovr,1,1)*OS_WAGE_K)*10)/10;
  const wageMin = Math.round((p.osWage||0)*0.9*10)/10;
  G.nego={pid, fromId:null, os:true, osClub:p.osClub||"해외 구단",
    osEgg:!!(eg&&eg.waive), eggPool:(eg&&eg.pool)||null, eggNews:(eg&&eg.news)||null,
    eggSay:(eg&&eg.say)||null, eggSay2:(eg&&eg.say2)||null, eggWage:(eg&&eg.wage)||0,
    stage:"fee", tries:0, feeAsk, feeMin, wageAsk, wageMin,
    offerSwapPid:null, agreedSwapPid:null,
    agent:{name:pick(AGENT_NAMES), ...at},
    log:[{w:"sys", t:`🌍 ${p.osClub}와(과) ${p.name} 협상 개시. 구단 요구 이적료 <b>${feeAsk}억</b> (몸값 ${mv}억) · 에이전트 ${at.n}`},
         {w:"club", t:`${p.osClub}: "한국에서 연락이 올 줄은 몰랐군요. 숫자부터 봅시다."`}]};
  saveGame(); show("nego");
}
/* 이적료 합의 순간 — 사연 있는 구단이면 선수가 여기서 먼저 입을 연다 */
function negoOsEggOnWage(N, p){
  if(!N || N._eggDone || !N.eggSay) return;
  N._eggDone=true;
  if(N.eggSay)  N.log.push({w:"player", t:`${p.name}: ${N.eggSay}`});
  if(N.eggSay2) N.log.push({w:"player", t:`${p.name}: ${N.eggSay2}`});
  if(N.eggWage){
    N.log.push({w:"sys", t:`💛 요구 연봉이 <b>${N.wageAsk}억 → ${N.eggWage}억</b>으로 내려갔습니다.${N.osEgg?" 구단주가 특별 예산을 검토하겠다고 합니다.":""}`});
    N.wageAsk=N.eggWage; N.wageMin=Math.round(N.eggWage*0.96*10)/10;
  }
}
/* 협상 대상 선수 찾기 — 구단 소속 / FA / 해외 세 곳을 모두 본다 */
function negoPlayerOf(N){
  if(!N) return null;
  const from=N.fromId?G.teams[N.fromId]:null;
  if(from) return from.players.find(x=>x.id===N.pid);
  return (G.freeAgents||[]).find(x=>x.id===N.pid) || (G.overseas||[]).find(x=>x.id===N.pid) || ((G.scout&&G.scout.list)||[]).find(x=>x.id===N.pid) || null;
}
/* FA 요구 연봉의 기준액 — 화면 표시와 실제 협상이 같은 식을 쓴다.
   ⚠ 제보 — 「FA 로 좋은 선수를 연봉까지 싸게 손쉽게 수급할 수 있다」.
   예전 요구액은 적정가의 1.15배였다. 이적으로 데려올 때(현연봉×1.35 또는 적정가×1.22~1.5)
   보다 오히려 싸서, 이적료가 없다는 이점 위에 연봉 할인까지 얹혀 있었다.
   ─ 이적료가 없는 만큼 연봉으로 값을 치르게 한다. */
function faWageAsk(p){
  const wB=wageExpect(p.ovr,p.frn,(teamOfPlayer(p)||{}).div);
  const a=G.season-(p.by||2000);
  let k=1.45;
  if(a<=27 && p.ovr>=70) k+=0.30;      // 젊고 잘하는 자원은 부르는 게 값이다
  if(a<=23 && p.ovr>=68) k+=0.15;      // 앞으로 더 클 선수는 더욱
  if(p._faWhy==="wage")   k+=0.28;     // 고연봉 탓에 풀린 선수는 그 연봉을 그대로 원한다
  return Math.max((p.wage||0)*1.20, wB*k);
}
function startFANego(pid){
  if(armyGate("FA 영입")) return;
  if(!transferOpen()){ gameAlert("이적시장이 닫혀 있습니다. (FA 계약도 윈도우 기간에만 가능)"); return; }
  if(G.nego){ gameAlert("이미 진행 중인 영입 협상이 있습니다."); return; }
  const p=(G.freeAgents||[]).find(x=>x.id===pid); if(!p) return;
  if(p.army){ gameAlert(`🎖️ ${p.name} 선수는 군 복무 중입니다 — 전역 전에는 어떤 구단과도 계약할 수 없습니다.`); try{ armySweep(); }catch(e){} show("transfer"); return; }
  const at=AGENT_T[p.id%3];
  const wBase=wageExpect(p.ovr,p.frn,(teamOfPlayer(p)||{}).div);
  const wageAsk=Math.round(faWageAsk(p)*at.wageK*10)/10;
  const wageMin=Math.round(Math.max(p.wage*1.02, wBase*1.10)*10)/10;
  try{ slAdd(pid, "try", true); }catch(e){}     // ⭐ 접촉한 선수는 목록에 남는다
  G.nego={pid, fromId:null, stage:"wage", tries:0, agreedFee:0, wageAsk, wageMin,
    agent:{name:pick(AGENT_NAMES), ...at},
    log:[{w:"sys", t:`FA ${p.name} 영입 협상 개시 — 무적 신분, 이적료 없음. 선수 요구 연봉: ${wageAsk}억 · 에이전트: ${at.n}`}]};
  show("nego");
}
