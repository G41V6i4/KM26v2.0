"use strict";
/* ---------- 재정 ---------- */
/* ═══════════════════════════════════════════════════════════════
   🏟️ 구장 건설 — 이 게임의 장기 목표
   K리그 구단의 오랜 숙원은 트랙 없는 축구 전용구장, 그리고 그 너머의 돔이다.
   돈만 있다고 되는 일이 아니다. 이사회는 여섯 가지를 본다 —
     리그 · 구단주 신뢰 · 팬 신뢰 · 좌석 점유율 · 성적 · 감독 재임 기간 (+ 돔은 우승 경력)
   하나라도 미달이면 안건은 부결되고, 그 시즌에는 다시 올릴 수 없다.
   통과해도 끝이 아니다. 총사업비를 모아야 착공하고, 착공 뒤에도 공기가 남는다.
   그동안 구단 수입의 일부가 계속 공사비로 빠져 이적 예산이 얇아진다 — 그게 이 목표의 값이다.
═══════════════════════════════════════════════════════════════ */
const STAD_PLANS=[
  {k:"ded", n:"축구 전용구장", ic:"🏟️", cost:1450, yrs:3,
   d:"육상 트랙을 걷어내고 관중석을 그라운드 코앞까지 당긴다. 함성이 갇히는 구장.",
   capAdd:[9000,15000], capMul:1.08, avgMul:1.34, hype:0.14, fansMul:1.22, pres:6,
   need:{div:1, own:66, fans:70, fill:0.58, pos:8, seasons:2, cash:150}},
  {k:"dome", n:"돔 구장", ic:"🏛️", cost:4200, yrs:4,
   d:"비가 와도 눈이 와도 경기가 열린다. 아시아에서도 손에 꼽는 사건이 된다.",
   capAdd:[18000,26000], capMul:1.32, avgMul:1.72, hype:0.26, fansMul:1.5, pres:14,
   need:{div:1, own:82, fans:84, fill:0.76, pos:3, seasons:4, cash:500, trophy:1}}
];
function stadPlan(k){ return STAD_PLANS.find(x=>x.k===k)||STAD_PLANS[0]; }
/* 돔은 전용구장과 같은 사건이 아니다 — 돔 전용 반응이 있으면 그쪽을 쓴다 */
function stadPool(bag, name, k){
  if(k==="dome"){ const dn="dome"+name.charAt(0).toUpperCase()+name.slice(1); if(bag[dn]) return bag[dn]; }
  return bag[name];
}
/* 🏟️ ⚠ 제보 원문 — 「포항에서 짤린 후 다른 팀으로 갔는데 이전에 짓던 포항월드컵경기장이
   건립 중이라고 뜨는 문제가 있습니다」.
   원인 — 구장 사업(G.stad)에 「어느 구단의 사업인가」가 없었다. 감독을 따라다니는 값처럼
     굴러서, 팀을 옮기면 남의 구단 공사가 새 구단 화면에 그대로 떴다.
     그대로 완공되면 새 구단 구장이 옛 구단 이름으로 바뀌는 사고까지 났을 것이다.
   ─ 착공할 때 구단 id 를 새기고, 지금 맡은 구단의 사업일 때만 보이고 굴러가게 한다.
     옛 구단으로 돌아가면 그 사업이 그대로 다시 나타난다. */
function stadProj(){
  const S=G.stad; if(!S) return null;
  try{
    if(G.jobless) return null;
    if(S.tid && S.tid!==G.userTeamId) return null;   // 남의 구단 사업이다
  }catch(e){}
  return S;
}
function mgrSeasons(){ return (G.history||[]).length; }          // 완주한 시즌 수
function trophyCount(){ return (G.trophies||[]).filter(x=>x.kind==="champ").length; }
/* 좌석 점유율 — 올 시즌 홈 경기 평균 관중 ÷ 수용 인원 */
function stadFill(t){
  const sd=stadOf(t), fin=finLedger(t);
  const att = (fin.att&&fin.att.length>=3)
    ? fin.att.reduce((a,b)=>a+b,0)/fin.att.length
    : sd.avg*hypeOf(t)*ATT_NORM;
  return clamp(att/Math.max(1,sd.cap), 0, 1);
}
function leaguePos(t){ const tb=tableOf(t.div); const i=tb.findIndex(x=>x.id===t.id); return i<0?99:i+1; }
/* 이사회 심사표 — 무엇이 모자란지 숫자로 보여 준다 */
function stadCheck(plan){
  const t=userTeam(); if(!t) return [];
  const N=plan.need, tr=G.trust||{owner:70,fans:70};
  const fill=stadFill(t), pos=leaguePos(t);
  const row=(n,ok,cur,req)=>({n,ok,cur,req});
  const list=[
    row("소속 리그", t.div<=N.div, divName(t.div), "K리그1"),
    row("구단주 신뢰", tr.owner>=N.own, Math.round(tr.owner), `${N.own} 이상`),
    row("서포터 신뢰", tr.fans>=N.fans, Math.round(tr.fans), `${N.fans} 이상`),
    row("좌석 점유율", fill>=N.fill, `${Math.round(fill*100)}%`, `${Math.round(N.fill*100)}% 이상`),
    row("리그 순위", pos<=N.pos, pos===99?"-":`${pos}위`, `${N.pos}위 이내`),
    row("감독 재임", mgrSeasons()>=N.seasons, `${mgrSeasons()}시즌`, `${N.seasons}시즌 이상`),
    row("착수 자금", t.budget>=N.cash, `${t.budget}억`, `${N.cash}억 이상`)
  ];
  if(N.trophy) list.push(row("리그 우승 경력", trophyCount()>=N.trophy, `${trophyCount()}회`, `${N.trophy}회 이상`));
  return list;
}
function stadOpenProposal(k){
  const t=userTeam(); const plan=stadPlan(k);
  if(stadProj()){ flash("이미 진행 중인 구장 사업이 있습니다.","warn"); show("finance"); return; }
  if(G.stadNo===G.season){
    showConfirm(`<b>🏟️ 이사회</b>\n\n"올 시즌에는 이미 이 안건을 다뤘습니다. 다음 시즌에 다시 올리시죠."`,
      ()=>{}, {okLabel:"알겠습니다", cancelLabel:""});
    return;
  }
  const rows=stadCheck(plan), bad=rows.filter(r=>!r.ok);
  showConfirm(
    `<b style="font-size:16px">${plan.ic} ${plan.n} 건립 안건</b>\n\n${plan.d}\n\n`+
    `· 총사업비 <b class="money">${plan.cost}억</b> · 공기 <b>${plan.yrs}시즌</b>\n`+
    `· 완공 시 수용 인원 +${plan.capAdd[0].toLocaleString()}~${plan.capAdd[1].toLocaleString()}석\n\n`+
    `<b>이사회 심사 기준</b>\n`+
    rows.map(r=>`${r.ok?"✅":"❌"} ${r.n} — <b>${r.cur}</b> <span class="small">(${r.req})</span>`).join("\n")+
    `\n\n${bad.length
      ? `<span style="color:var(--red)">${bad.length}개 항목이 미달입니다. 지금 올리면 부결되고 올 시즌에는 재상정할 수 없습니다.</span>`
      : `<span style="color:var(--green)">모든 요건을 채웠습니다. 그래도 표결은 표결입니다.</span>`}`,
    ()=>stadPropose(k), {okLabel:"🏟️ 안건을 올린다", cancelLabel:"물러난다", danger:bad.length>0});
}
function stadPropose(k){
  const t=userTeam(); const plan=stadPlan(k);
  const rows=stadCheck(plan), bad=rows.filter(r=>!r.ok);
  G.stadNo=G.season;                                    // 가결이든 부결이든 올 시즌 상정은 끝
  if(bad.length){
    adjustTrust("owner", -3-bad.length, `${plan.n} 안건 부결`);
    addNews(`🏟️ ${t.name} 이사회, 감독이 올린 <b>${plan.n} 건립안</b> 부결 — ${bad.map(r=>r.n).join("·")} 미달`, "warn", "club");
    socialFill(stadPool(SOC,"stadNo",k), 3+R(2), -1, {t:t.short, w:plan.n, m:plan.cost});
    showConfirm(`<b style="color:var(--red);font-size:16px">🏟️ 부결</b>\n\n`+
      `이사회는 안건을 받아들이지 않았습니다.\n\n`+
      bad.map(r=>`❌ <b>${r.n}</b> — 현재 ${r.cur} / 필요 ${r.req}`).join("\n")+
      `\n\n<span class="small">"숫자로 설득해 오십시오." — 다음 시즌에 다시 올릴 수 있습니다.</span>`,
      ()=>show("finance"), {okLabel:"확인", cancelLabel:""});
    return;
  }
  /* 요건을 다 채워도 표결은 남는다 — 신뢰가 높을수록 안전하다 */
  const tr=G.trust||{owner:70,fans:70};
  const ch=clamp(0.42 + (tr.owner-plan.need.own)*0.012 + (tr.fans-plan.need.fans)*0.008 + trophyCount()*0.05, 0.35, 0.95);
  if(Math.random()>ch){
    adjustTrust("owner", -2, `${plan.n} 안건 보류`);
    addNews(`🏟️ ${t.name} 이사회, ${plan.n} 건립안 <b>보류</b> — "시기상조라는 의견이 많았다"`, "warn", "club");
    showConfirm(`<b style="color:var(--gold);font-size:16px">🏟️ 보류</b>\n\n`+
      `요건은 충족했지만 표결에서 뒤집혔습니다. <span class="small">(가결 전망 ${Math.round(ch*100)}%)</span>\n\n`+
      `"조금 더 확실한 근거를 가져오십시오." — 다음 시즌에 다시 올릴 수 있습니다.`,
      ()=>show("finance"), {okLabel:"확인", cancelLabel:""});
    return;
  }
  /* 🏟️ 제보 — 이 사업이 어느 구단 것인지 새겨 둔다. 감독이 팀을 옮겨도 따라오지 않는다 */
  G.stad={k, tid:t.id, phase:"raise", cost:plan.cost, paid:0, from:G.season, start:null, name:null, delay:0, log:[]};
  stadLog(`이사회 가결 — 총사업비 ${plan.cost}억`);
  adjustTrust("owner", 4, `${plan.n} 안건 가결`); adjustTrust("fans", 9, `${plan.n} 건립 추진`);
  addNews(`🏟️ <b>${t.name}, ${plan.n} 건립 추진 확정</b> — 총사업비 ${plan.cost}억 규모. 모금이 시작됩니다.`, "good", "club");
  socialFill(stadPool(SOC,"stadOk",k), 5+R(3), 1, {t:t.short, w:plan.n, m:plan.cost});
  fmkFill(stadPool(FMK,"stadOk",k), 3+R(3), {t:t.short, w:plan.n, m:plan.cost});
  rivalFill(RIV.stad, 2+R(2), 0, {t:t.short, w:plan.n});
  showConfirm(`<b style="color:var(--green);font-size:17px">🏟️ 가결되었습니다.</b>\n\n`+
    `${plan.n} 건립이 구단의 공식 사업이 됐습니다.\n\n`+
    `· 총사업비 <b>${plan.cost}억</b>\n· 착공 조건: 사업비의 <b>35%</b> 확보\n· 착공 후 공기 <b>${plan.yrs}시즌</b>\n\n`+
    `<span class="small">이제부터 구단 수입의 일부가 자동으로 공사비로 적립됩니다. 이적 예산이 그만큼 얇아집니다.\n재정 탭에서 예산을 직접 넣거나, 감독 사비를 보탤 수도 있습니다.</span>`,
    ()=>{ saveGame(); show("finance"); }, {okLabel:"시작한다", cancelLabel:""});
}
function stadLog(txt){ const S=stadProj(); if(!S) return; S.log=S.log||[]; S.log.unshift({s:G.season, d:G.day||0, t:txt}); S.log=S.log.slice(0,24); }
function stadAdd(amt, why){
  const S=stadProj(); if(!S) return 0;
  amt=Math.round(Math.max(0,Math.min(amt, S.cost-S.paid))*10)/10;
  if(amt<=0) return 0;
  S.paid=Math.round((S.paid+amt)*10)/10;
  stadLog(`＋${amt}억 · ${why}`);
  return amt;
}
/* 이적 예산 → 공사비 직접 전용 */
function stadFundOpen(){
  const S=stadProj(), t=userTeam(); if(!S) return;
  const left=Math.round((S.cost-S.paid)*10)/10;
  showConfirm(`<b>🏗️ 이적 예산을 공사비로 돌립니다</b>\n\n`+
    `· 이적 예산 <b class="money">${t.budget}억</b>\n· 남은 사업비 <b>${left}억</b>\n\n`+
    `얼마를 넣으시겠습니까? <span class="small">(억 단위)</span>\n`+
    `<input id="stadAmt" type="number" min="1" step="10" value="${Math.min(Math.floor(t.budget), left)||1}" style="width:130px;font-size:17px;font-weight:800;text-align:center;background:var(--bg3);color:var(--txt);border:1px solid var(--gold);border-radius:8px;padding:9px">\n\n`+
    `<span class="small">⚠ 이적 예산이 줄어듭니다. 구장은 3년 뒤에 서지만 강등은 올 시즌에 옵니다.</span>`,
    (v)=>{
      let a=parseFloat(String((v&&v.stadAmt)||"0"));
      if(!isFinite(a)||a<=0){ flash("금액을 입력하세요.","warn"); show("finance"); return; }
      a=Math.min(a, t.budget, left);
      const got=stadAdd(a, "구단 이적 예산 전용");
      t.budget=Math.round((t.budget-got)*10)/10;
      flash(`🏗️ ${got}억을 공사비로 넣었습니다. (누적 ${S.paid}/${S.cost}억)`,"good");
      stadTryStart(); saveGame(); show("finance");
    }, {okLabel:"넣는다", cancelLabel:"취소"});
}
/* 감독 사비 기부 — 팬이 기억한다 */
function stadDonateOpen(){
  const S=stadProj(); if(!S) return;
  const M=me(), left=Math.round((S.cost-S.paid)*10)/10;
  showConfirm(`<b>💝 감독 사비 기부</b>\n\n`+
    `· 보유 현금 <b class="money">${moneyEok(M.cash)}</b>\n· 남은 사업비 <b>${left}억</b>\n\n`+
    `얼마를 내시겠습니까?\n`+
    `<input id="donAmt" type="number" min="0.1" step="1" value="1" style="width:130px;font-size:17px;font-weight:800;text-align:center;background:var(--bg3);color:var(--txt);border:1px solid var(--gold);border-radius:8px;padding:9px">\n\n`+
    `<span class="small">감독이 자기 돈을 낸 구장은 팬이 오래 기억합니다. 서포터 신뢰가 크게 오릅니다.</span>`,
    (v)=>{
      let a=parseFloat(String((v&&v.donAmt)||"0"));
      if(!isFinite(a)||a<=0){ flash("금액을 입력하세요.","warn"); show("finance"); return; }
      a=Math.round(Math.min(a, M.cash, left)*100)/100;
      if(a<=0){ flash("보유 현금이 부족합니다.","warn"); show("finance"); return; }
      mePay(-a, "구장 건립 기부");
      stadAdd(a, "감독 사비 기부");
      const t=userTeam();
      adjustTrust("fans", clamp(a*0.6, 1, 14), "감독 사비 기부");
      addNews(`💝 ${t.name} 감독, 구장 건립에 사비 <b>${a}억</b> 기부`, "good", "club");
      socialFill(SOC.stadDonate, 3+R(3), 1, {t:t.short, m:a});
      stadTryStart(); saveGame(); show("finance");
    }, {okLabel:"기부한다", cancelLabel:"취소"});
}
/* 35% 이상 모이면 착공 — 이때 구장 이름을 감독이 직접 짓는다 */
function stadTryStart(){
  const S=stadProj(); if(!S || S.phase!=="raise") return;
  if(S.paid < S.cost*0.35) return;
  const plan=stadPlan(S.k), t=userTeam();
  showConfirm(`<b style="font-size:17px">${plan.ic} 착공 조건을 채웠습니다.</b>\n\n`+
    `사업비 ${S.paid}/${S.cost}억 확보 — 첫 삽을 뜰 수 있습니다.\n\n`+
    `<b>구장의 이름을 지어 주십시오.</b>\n`+
    `<input id="stadName" type="text" maxlength="20" placeholder="예: ${t.short} 사커돔" style="width:230px;font-size:16px;font-weight:800;text-align:center;background:var(--bg3);color:var(--txt);border:1px solid var(--gold);border-radius:8px;padding:9px">\n\n`+
    `<span class="small">이 이름은 완공 후 모든 경기·기사·중계에 그대로 쓰입니다. 나중에 바꿀 수 없습니다.</span>`,
    (v)=>{
      let nm=String((v&&v.stadName)||"").trim().slice(0,20);
      if(!nm) nm=`${t.short} 축구전용구장`;
      S.name=nm; S.phase="build"; S.start=G.season;
      stadLog(`착공 — 구장명 "${nm}"`);
      addNews(`🏗️ <b>${t.name}, ${nm} 착공</b> — ${plan.yrs}시즌 뒤 완공 예정 (사업비 ${S.paid}/${S.cost}억)`, "good", "club");
      socialFill(SOC.stadStart, 4+R(3), 1, {t:t.short, w:nm});
      fmkFill(FMK.stadOk, 2+R(2), {t:t.short, w:nm, m:S.cost});
      adjustTrust("fans", 7, "구장 착공");
      saveGame(); show("finance");
    }, {okLabel:"착공한다", cancelLabel:"조금 더 모은다"});
}
/* 매 라운드 수입에서 자동 적립 — 이적 예산이 얇아지는 대가 */
const STAD_SKIM=0.30;
function stadSkim(t, toBudget){
  const S=stadProj(); if(!S || S.phase==="done" || !t.isUser) return 0;
  const cut=Math.round(toBudget*STAD_SKIM*100)/100;
  if(cut<=0) return 0;
  return stadAdd(cut, "구단 수입 적립") ? cut : 0;
}
/* ═══════════════════════════════════════════════════════════════════════════
   💝 구단 기부 — 감독이 자기 돈을 구단에 넣는다
   전용구장 신축(G.stad)은 이사회 승인이 필요한 큰 사업이고, 그 문턱에 닿지 못하는
   구단이 대부분이다. 그래서 승인이 필요 없는 길을 하나 더 둔다 — 관중석 증설.
     · 신축 사업이 진행 중이면 기부금은 그 공사비로 먼저 들어간다
     · 아니면 「좌석 증축 기금」에 쌓이고, 한 단위(800석)치가 모이면 그 겨울에 공사한다
     · 완공되면 수용 인원·기준 관중·기준 관중 상한이 함께 올라간다
   반대급부는 신뢰다. 공개하면 팬과 언론이 알고, 익명이면 구단주만 안다 —
   다만 익명도 언젠가는 알려진다. 그때 팬 신뢰가 가장 크게 오른다.
   ⚠ 무직일 때는 낼 곳이 없다. 화면 자체가 잠긴다.
   ═══════════════════════════════════════════════════════════════════════════ */
const DON_SEAT=0.021;     // 좌석 1석 증설 비용(억) — 약 210만원/석
const DON_STEP=800;       // 증축 한 단위
/* 🏟️ ⚠ 제보 원문 — 「증설로 늘릴 수 있는 좌석 한도(12,000석)를 풀어주셔서 더 증축할 수 있게
   만들어 주시면 감사하겠습니다!! … 구장 최대 좌석 크기를 100,000석으로 늘려주시고 리모델링,
   편의 시설 개설 및 증축 등도 선택할 수 있게 만들어 주셔서 관객 점유율을 더 높일 수 있는
   시스템을 구현해주시면 감사하겠습니다!!」.
   ─ 예전의 「기부 누적 12,000석」 한도를 없애고, 한도를 구장 수용 인원 자체(100,000석)로 바꾼다.
     대신 클수록 비싸진다 — 5만 석부터는 상층 스탠드 공사라 단가가 한 번 더 뛴다. */
const STAD_CAP_MAX=100000;   // 구장 최대 수용 인원 — 세계 최대급 축구 전용 구장 규모
const DON_WINTER_MAX=12000;  // 한 겨울에 완공할 수 있는 최대 석수 — 그 이상은 이듬해로 이어진다
function donOf(t){
  t=t||userTeam(); if(!t) return null;
  if(!t.don) t.don={fund:0, seats:0, pend:0, total:0, sY:G.season, sAmt:0, anon:0, sOwn:0, sFans:0};
  const d=t.don;
  if(typeof d.fund!=="number") d.fund=0;
  if(typeof d.sOwn!=="number") d.sOwn=0;
  if(typeof d.sFans!=="number") d.sFans=0;
  if(d.sY!==G.season){ d.sY=G.season; d.sAmt=0; d.sOwn=0; d.sFans=0; }
  return d;
}
/* 다음 한 단위(800석)를 놓는 데 드는 돈 — 구장이 클수록 비싸진다.
   (예전에는 「기부로 놓은 누적 석수」 기준이라 12,000석 한도 안에서만 말이 됐다.
    이제 기준은 구장 자체의 크기다: 12,000석 구장 16.8억 → 5만 석부터 상층 공사 ×1.6 → 10만 석 86억) */
function donSeatCost(t){
  t=t||userTeam(); const d=donOf(t); if(!d) return 9999;
  const sd=stadOf(t);
  const cap=(sd.cap||12000)+(d.pend||0);
  let mult = 1 + Math.max(0, cap-12000)/88000*2.2;
  if(cap>=50000) mult *= 1.6;                     // 상층 스탠드 — 골조부터 다시 올린다
  return Math.round(DON_STEP*DON_SEAT*mult*10)/10;
}
/* 지금 구장이 더 커질 수 있는가 */
function stadRoom(t){ const sd=stadOf(t), d=donOf(t); return Math.max(0, STAD_CAP_MAX-((sd.cap||12000)+((d&&d.pend)||0))); }
function donBlockWhy(){
  if(G.jobless || !userTeam()) return "지금은 맡고 있는 구단이 없습니다 — 부임한 뒤에 기부할 수 있습니다.";
  if(!G.introDone) return "부임 절차를 먼저 마쳐 주세요.";
  return null;
}
function donRef(){ try{ return Math.max(1.5, mgrSalary()); }catch(e){ return 3; } }
/* 기부 한 건이 주는 신뢰 — 연봉 대비 규모로 보고, 같은 시즌에 여러 번 내면 효과가 준다.
   ⚠ 여기가 세면 「돈으로 신뢰를 사는」 게임이 된다. 주식·부동산으로 수천억을 만든 감독이
      기부만으로 구단주·팬 신뢰를 100까지 올려 버리면 성적이 아무 의미가 없다.
      그래서 ① 한 건당 폭을 좁게 두고 ② 시즌 총량에 뚜껑을 씌운다. 기부는 보탬이지 대체가 아니다. */
const DON_CAP_OWN=9, DON_CAP_FANS=12;      // 한 시즌에 기부로 얻을 수 있는 신뢰 총량
function donGain(a, prev, d){
  const ref=donRef(), r=a/ref, damp=1/(1+(prev/ref)*1.15);
  let own =clamp(r*3.4*damp, 0.2, 5.0);
  let fans=clamp(r*4.2*damp, 0.3, 7.0);
  if(d){       // 시즌 총량이 남은 만큼만
    own =Math.min(own,  Math.max(0, DON_CAP_OWN -(d.sOwn ||0)));
    fans=Math.min(fans, Math.max(0, DON_CAP_FANS-(d.sFans||0)));
  }
  return {
    own:   Math.round(own*10)/10,
    fans:  Math.round(fans*10)/10,
    hype:  Math.round(clamp(r*0.035*damp, 0.004, 0.055)*1000)/1000,
    press: Math.round(clamp(r*2.4*damp, 0, 4))
  };
}
/* 기금이 한 단위를 넘겼으면 착공을 걸어 둔다 (완공은 시즌 전환) */
function donTryBuild(t){
  const d=donOf(t); if(!d) return 0;
  let n=0;
  while(d.fund >= donSeatCost(t) && stadRoom(t) >= DON_STEP && n<24){
    d.fund=Math.round((d.fund-donSeatCost(t))*10)/10;
    d.pend=(d.pend||0)+DON_STEP; n++;
  }
  if(n){
    try{ addNews(`🏗️ <b>${t.name}</b>, <b>${(n*DON_STEP).toLocaleString()}석</b> 규모 구장 개선 공사에 들어갑니다 — 다음 시즌 개막에 맞춰 개방됩니다.`, "good", "club"); }catch(e){}
    try{ adjustTrust("fans", clamp(n*1.5, 1, 6), "관중석 증설 착공"); }catch(e){}
  }
  return n;
}
/* 실제 집행 */
function donCommit(a, anon){
  const t=userTeam(), M=me(), d=donOf(t);
  if(!t || !d) return;
  a=Math.round(Math.min(a, M.cash)*100)/100;
  if(!(a>0)){ flash("보유 현금이 부족합니다.","warn"); return; }
  const prev=d.sAmt||0;
  mePay(-a, anon ? "구단 기부 (익명)" : "구단 기부");
  d.total=Math.round(((d.total||0)+a)*100)/100;
  d.sAmt =Math.round((prev+a)*100)/100;
  /* 신축 사업이 있으면 공사비가 먼저, 남으면 좌석 기금으로 */
  let into=0;
  const S=stadProj();
  if(S && S.phase!=="done"){ try{ into=stadAdd(a, anon?"감독 익명 기부":"감독 사비 기부")||0; }catch(e){ into=0; } }
  const rest=Math.round((a-into)*100)/100;
  if(rest>0) d.fund=Math.round((d.fund+rest)*10)/10;
  const g=donGain(a, prev, d);
  if(anon){
    d.anon=Math.round(((d.anon||0)+a)*100)/100;
    const ow=Math.round(g.own*1.15*10)/10;
    adjustTrust("owner", ow, "감독 익명 기부");            // 장부를 보는 사람은 안다
    d.sOwn=Math.round(((d.sOwn||0)+ow)*10)/10;
    meLog(`🤫 익명 기부 ${a.toFixed(2)}억 — ${t.short}`);
    flash(`🤫 이름을 남기지 않고 ${a.toFixed(2)}억을 냈습니다.`,"good");
  } else {
    adjustTrust("owner", g.own, "감독 사비 기부");
    adjustTrust("fans",  g.fans, "감독 사비 기부");
    d.sOwn =Math.round(((d.sOwn ||0)+g.own )*10)/10;
    d.sFans=Math.round(((d.sFans||0)+g.fans)*10)/10;
    try{ bumpHype(t, g.hype, "감독의 사비 기부"); }catch(e){}
    try{ if(G.press) G.press.rel=clamp((G.press.rel||50)+g.press, 0, 100); }catch(e){}
    try{ addNews(`💝 <b>${t.name} 감독, 구단에 사비 ${a.toFixed(2)}억 기부</b> — ${(S&&S.phase!=="done")?"구장 사업 공사비":"구장 개선 기금"}에 쓰입니다.`, "good", "club"); }catch(e){}
    try{ socialFill(SOC.donateClub, 3+R(3), 1, {t:t.short, m:a.toFixed(2)}); }catch(e){}
    try{ fmkFill(FMK.donateClub, 2+R(2), {t:t.short, m:a.toFixed(2)}); }catch(e){}
    G.donAsk={amt:a, anon:0, s:G.season, d:G.day||0, asked:0};
    flash(`💝 ${a.toFixed(2)}억을 기부했습니다. 팬들이 알아봅니다.`,"good");
  }
  donTryBuild(t);
  try{ if(S && S.phase==="raise") stadTryStart(); }catch(e){}
  DON_AMT="";
  try{ saveGame(); }catch(e){}
  show("mylife");
}
/* ═══════════════════════════════════════════════════════════════════════════
   🏪 구장 편의시설 — 이적 예산으로 수익 시설을 짓는다
   ⚠ 제보 원문 — 「리모델링, 편의 시설 개설 및 증축 등도 선택할 수 있게 만들어 주셔서 관객
      점유율을 더 높일 수 있는 시스템을 구현해주시면 감사하겠습니다」 + 개발 노트 — 「편의시설도
      현실적이게 다양하게 추가할 수 있게 하자. 이게 구단 수익으로 이어지게끔, 푸드트럭,
      구장내 편의점, 굿즈샵 등등」.
   ─ 시설마다 1~3레벨. 홈경기마다 「관중 수 × 시설별 객단가(관리비 뺀 순수익)」가 구단 예산으로
     들어오고, 재정 장부에 「🏪 시설 수입」으로 잡힌다. 박물관은 경기가 없는 날도 번다.
     패밀리존·리모델링은 돈보다 관중 점유율을 올리는 시설이다. AI 구단은 짓지 않는다. */
const STAD_FACS=[
  {k:"truck",  ic:"🚚", n:"푸드트럭 존",        cost:[10,8,10],  per:[0.000015,0.000025,0.000035],
   d:"경기일마다 구장 앞 광장에 푸드트럭이 줄지어 선다. 관중 1인당 매출은 작지만 개설비가 싸다."},
  {k:"store",  ic:"🏪", n:"구장 내 편의점",     cost:[25,15,20], per:[0.000025,0.000042,0.000058],
   d:"콩코스에 편의점을 들인다. 하프타임마다 계산대에 줄이 늘어선다."},
  {k:"shop",   ic:"👕", n:"굿즈샵 (메가스토어)", cost:[45,30,40], per:[0.000035,0.000060,0.000085],
   d:"유니폼·머플러·굿즈 상설 매장. 팀이 잘 나갈수록(흥행) 매출이 함께 뛴다."},
  {k:"pub",    ic:"🍺", n:"스카이 펍",          cost:[40,25,35], per:[0.00025,0.00025,0.00025], cap:1500,
   d:"경기장을 내려다보는 프리미엄 좌석·펍. 자리가 한정돼 있어 레벨을 올려야 손님을 더 받는다."},
  {k:"family", ic:"👨‍👩‍👧", n:"패밀리존 · 키즈존",  cost:[18,12,15], per:[0.000008,0.000013,0.000018],
   d:"매출은 작지만 가족 단위 관중이 늘어 <b>기준 관중 자체</b>가 올라간다."},
  {k:"museum", ic:"🏛️", n:"구단 박물관 · 투어",  cost:[35,25,30], per:[0,0,0], daily:0.009,
   d:"경기가 없는 날에도 관람·스타디움 투어 수입이 매일 들어온다. 구단 위상이 높을수록 잘 팔린다."}
];
const FAC_BY_K={}; for(const f of STAD_FACS) FAC_BY_K[f.k]=f;
function facOf(t){ t=t||userTeam(); if(!t) return null; if(!t.fac || typeof t.fac!=="object") t.fac={}; return t.fac; }
function facLv(t,k){ const F=facOf(t); return clamp((F&&F[k])||0, 0, 3); }
/* 홈경기 한 판의 시설 순수익 */
function facMatchIncome(t, att){
  const F=facOf(t); if(!F || !att) return 0;
  let inc=0;
  for(const f of STAD_FACS){
    const lv=clamp(F[f.k]||0, 0, 3); if(!lv) continue;
    if(f.k==="pub"){ inc += Math.min(att, (f.cap||1500)*lv) * f.per[lv-1]; continue; }
    if(f.daily) continue;                        // 박물관은 매일 정산
    let v = att * f.per[lv-1];
    if(f.k==="shop"){ try{ v *= clamp(hypeOf(t), 0.80, 1.35); }catch(e){} }   // 굿즈는 흥행을 탄다
    inc += v;
  }
  return Math.round(inc*100)/100;
}
/* 박물관 — 매일 정산 (유저 팀만) */
function facDailyTick(){
  const t=userTeam(); if(!t || G.jobless) return;
  const lv=facLv(t,"museum"); if(!lv) return;
  const sd=stadOf(t);
  const inc=Math.round(FAC_BY_K.museum.daily * lv * clamp((sd.avg||3000)/9000, 0.4, 1.8) * 100)/100;
  if(!(inc>0)) return;
  t.budget=Math.round((t.budget+inc)*100)/100;
  const fin=finLedger(t); fin.fac=Math.round(((fin.fac||0)+inc)*100)/100;
}
/* 개설·증축 */
function facBuy(k){
  const t=userTeam(); if(!t || G.jobless) return;
  const f=FAC_BY_K[k]; if(!f) return;
  const F=facOf(t);
  const lv=clamp(F[k]||0, 0, 3);
  if(lv>=3){ flash("이미 최고 레벨입니다.","warn"); return; }
  const cost=f.cost[lv];
  if(t.budget<cost){ flash(`이적 예산이 부족합니다 (${cost}억 필요).`,"warn"); return; }
  showConfirm(`<b>${f.ic} ${f.n} ${lv?`레벨 ${lv} → ${lv+1} 증축`:"개설"}</b>\n\n비용 <b>${cost}억</b> (이적 예산 ${t.budget}억)\n\n${f.d.replace(/<[^>]+>/g,"")}`, ()=>{
    t.budget=Math.round((t.budget-cost)*10)/10;
    F[k]=lv+1;
    addNews(`${f.ic} <b>${t.name}</b>, ${f.n} ${lv?`레벨 ${lv+1} 증축`:"개설"} — ${cost}억 투자. 홈경기 수익이 늘어납니다.`, "good", "club");
    try{ adjustTrust("fans", lv?1:2, `${f.n} ${lv?"증축":"개설"}`); }catch(e){}
    flash(`${f.ic} ${f.n} ${lv?`레벨 ${lv+1}`:"개설"} 완료!`,"good");
    saveGame(); show("finance");
  }, {okLabel:"투자한다", cancelLabel:"그만둔다"});
}
/* 🛠️ 리모델링 — 노후 좌석·시야 개선. 돈이 아니라 점유율로 돌아온다 */
const REMOD_COST=[40,70,110];
function remodBuy(){
  const t=userTeam(); if(!t || G.jobless) return;
  const F=facOf(t);
  const lv=clamp(F.remod||0, 0, 3);
  if(lv>=3){ flash("더 손볼 곳이 없습니다 — 리그 최고 수준의 관람 환경입니다.","warn"); return; }
  const cost=REMOD_COST[lv];
  if(t.budget<cost){ flash(`이적 예산이 부족합니다 (${cost}억 필요).`,"warn"); return; }
  showConfirm(`<b>🛠️ 구장 리모델링 ${lv+1}차</b>\n\n비용 <b>${cost}억</b> (이적 예산 ${t.budget}억)\n\n노후 좌석 교체·시야 개선·콩코스 확장. 같은 성적에도 자리가 더 차고, 스폰서도 알아봅니다.`, ()=>{
    t.budget=Math.round((t.budget-cost)*10)/10;
    F.remod=lv+1;
    addNews(`🛠️ <b>${t.name}</b>, 구장 리모델링 ${lv+1}차 완료 — ${cost}억 투자. 관람 환경이 눈에 띄게 좋아졌습니다.`, "good", "club");
    try{ adjustTrust("fans", 2+lv, `구장 리모델링 ${lv+1}차`); }catch(e){}
    flash(`🛠️ 리모델링 ${lv+1}차 완료!`,"good");
    saveGame(); show("finance");
  }, {okLabel:"공사한다", cancelLabel:"그만둔다"});
}
/* 재정 탭 카드 */
function facCard(t){
  if(!t) return "";
  const F=facOf(t), sd=stadOf(t);
  const fin=finLedger(t);
  const dots=(lv)=>`<span style="letter-spacing:1px">${'<b style="color:var(--green)">◆</b>'.repeat(lv)}${'<span style="opacity:.35">◇</span>'.repeat(3-lv)}</span>`;
  const est=(f,lv)=>{
    if(!lv) return 0;
    if(f.k==="museum") return Math.round(f.daily*lv*clamp((sd.avg||3000)/9000,0.4,1.8)*100)/100;
    if(f.k==="pub") return Math.round(Math.min(sd.avg||3000,(f.cap||1500)*lv)*f.per[lv-1]*100)/100;
    return Math.round((sd.avg||3000)*f.per[lv-1]*100)/100;
  };
  const rows=STAD_FACS.map(f=>{
    const lv=clamp(F[f.k]||0,0,3);
    const e=est(f,lv);
    return `<tr><td style="text-align:left"><b>${f.ic} ${f.n}</b><div class="small" style="opacity:.7">${f.d}</div></td>
      <td>${dots(lv)}</td>
      <td class="small" style="white-space:nowrap">${lv?`<b class="money">${e}억</b>/${f.k==="museum"?"일":"홈경기"}`:"<span style='opacity:.5'>—</span>"}</td>
      <td>${lv>=3?`<span class="tag" style="color:var(--green)">MAX</span>`
        :`<button class="mini" ${t.budget>=f.cost[lv]?"":"disabled"} onclick="facBuy('${f.k}')">${lv?"증축":"개설"} ${f.cost[lv]}억</button>`}</td></tr>`;
  }).join("");
  const rl=clamp(F.remod||0,0,3);
  return `<div class="card"><h3>🏪 구장 편의시설 <span class="small">— 관중이 곧 매출입니다 · 올 시즌 시설 수입 <b class="money">${(fin.fac||0).toFixed(1)}억</b></span></h3>
    <div class="tblScroll"><table><tr><th style="text-align:left">시설</th><th>레벨</th><th>예상 수입</th><th></th></tr>${rows}</table></div>
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line)">
      <b>🛠️ 구장 리모델링</b> ${dots(rl)}
      ${rl>=3?`<span class="tag" style="color:var(--green)">MAX</span>`
        :`<button class="mini" ${t.budget>=REMOD_COST[rl]?"":"disabled"} onclick="remodBuy()">${rl+1}차 공사 ${REMOD_COST[rl]}억</button>`}
      <div class="small" style="opacity:.7;margin-top:3px">노후 좌석·시야·콩코스 개선 — 같은 성적에도 관중 점유율이 오르고(차수당 +2.5%), 관중 천장과 스폰서 매력도가 함께 올라갑니다.</div>
    </div>
    <p class="small" style="margin-top:6px;opacity:.75">개설·증축 비용은 이적 예산 <b class="money">${t.budget}억</b>에서 나갑니다. 수입은 관리비를 뺀 순수익으로 홈경기마다(박물관은 매일) 이적 예산에 들어옵니다.</p>
  </div>`;
}
/* 🏗️ 구단 예산 투자 — ⚠ 제보: 「이적 예산을 감독 기부처럼 좌석 증축·리모델링에 쓸 수
   있으면 쌓인 예산 소모처로 좋겠다」. 감독 사비 기부와 같은 파이프라인(신축 공사비 우선,
   남으면 좌석 기금)을 타되, 구단 돈이므로 신뢰 보상은 없다 — 보상은 시설 그 자체다. */
function clubBuildCommit(a){
  const t=userTeam(); if(!t || G.jobless) return;
  a=Math.round(Math.min(+a||0, t.budget)*10)/10;
  if(!(a>0)){ flash("이적 예산이 부족합니다.","warn"); return; }
  const d=donOf(t); if(!d) return;
  t.budget=Math.round((t.budget-a)*10)/10;
  d.club=Math.round(((d.club||0)+a)*10)/10;
  let into=0;
  const S=stadProj();
  if(S && S.phase!=="done"){ try{ into=stadAdd(a, "구단 예산 투자")||0; }catch(e){ into=0; } }
  const rest=Math.round((a-into)*10)/10;
  if(rest>0) d.fund=Math.round((d.fund+rest)*10)/10;
  addNews(`🏗️ <b>${t.name}</b>, 이적 예산 <b>${a}억</b>을 ${(S&&S.phase!=="done")?"구장 사업 공사비":"구장 개선 기금"}에 투자했습니다.`, null, "club");
  const built=donTryBuild(t);
  try{ if(S && S.phase==="raise") stadTryStart(); }catch(e){}
  flash(`🏗️ ${a}억을 구장에 투자했습니다.${built?` — ${(built*DON_STEP).toLocaleString()}석 증설 착공!`:""}`,"good");
  try{ saveGame(); }catch(e){}
  show("finance");
}
function clubBuildCard(t){
  const d=donOf(t); if(!d) return "";
  const S=stadProj(), sd=stadOf(t);
  const maxed=stadRoom(t)<DON_STEP;
  const next=donSeatCost(t);
  const need=Math.max(0, Math.round((next-(d.fund||0))*10)/10);
  const btn=(a,lab)=>`<button class="mini" ${t.budget>=a&&a>0?"":"disabled"} onclick="clubBuildCommit(${a})">${lab||a+"억"}</button>`;
  return `<div class="card"><h3>🏗️ 구장 투자 <span class="small">— 이적 예산으로 좌석 증설·리모델링</span></h3>
    <p class="small">${(S&&S.phase!=="done")
      ? `진행 중인 <b>구장 신축 사업</b>의 공사비로 먼저 들어갑니다.`
      : maxed
        ? `구장이 최대 규모(${STAD_CAP_MAX.toLocaleString()}석)에 도달했습니다 — 세계 최대급 축구 전용 구장입니다.`
        : `한 단위 <b>${DON_STEP}석</b>을 놓는 데 <b class="money">${next}억</b> — 기금이 차면 그 겨울에 착공, 다음 시즌 개막에 개방됩니다.`}<br>
      기금 <b class="money">${(d.fund||0).toFixed(1)}억</b>${d.pend?` · 공사 중 <b>${d.pend.toLocaleString()}석</b>`:""}${d.seats?` · 지금까지 증설 <b>${d.seats.toLocaleString()}석</b>`:""} · 현 수용 <b>${sd.cap.toLocaleString()}석</b></p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      ${btn(10)} ${btn(30)} ${btn(100)}
      ${(!maxed && need>0)?btn(need, `다음 ${DON_STEP}석까지 (${need}억)`):""}
    </div>
    <p class="small" style="margin-top:6px;opacity:.75">이적 예산 <b class="money">${t.budget}억</b> 중에서 나갑니다. 감독 사비 기부(내 생활 탭)와 같은 기금을 씁니다${d.club?` · 구단 투자 누적 ${d.club}억`:""}.</p>
  </div>`;
}
/* 확인 팝업 — 개인 재정이 위험해지면 경고를 함께 띄운다 */
function donOpen(){
  const why=donBlockWhy(); if(why){ flash(why,"warn"); return; }
  const t=userTeam(), M=me();
  let a=Math.round((parseFloat(DON_AMT)||0)*100)/100;
  if(!(a>0)){ flash("기부할 금액을 입력하세요.","warn"); return; }
  if(a<0.1){ flash("최소 0.1억부터 기부할 수 있습니다.","warn"); return; }
  if(a>M.cash){ flash(`보유 현금이 부족합니다 (${moneyEok(M.cash)}).`,"warn"); return; }
  const left=Math.round((M.cash-a)*100)/100;
  const keep=Math.round(Math.max(1, donRef()/12*2)*100)/100;    // 두 달 치 생활비
  let sadae=0; try{ sadae=(typeof stkDebt==="function")?stkDebt()/1e8:0; }catch(e){}
  const warn=[];
  if(left<keep) warn.push(`남는 현금이 <b>${left.toFixed(2)}억</b>뿐입니다 — 집세·관리비·대출 원리금은 그대로 나갑니다 (두 달 치 ${keep.toFixed(2)}억 권장)`);
  if(sadae>0)   warn.push(`사채 <b>${sadae.toFixed(1)}억</b>이 남아 있습니다. 넉 달 안에 정리하지 못하면 <b>파산</b>합니다`);
  if(a>=donRef()*2) warn.push(`연봉 <b>${donRef().toFixed(1)}억</b>의 ${(a/donRef()).toFixed(1)}배입니다. 되돌릴 수 없습니다`);
  const S=stadProj();
  const dest = (S && S.phase!=="done") ? `${stadPlan(S.k).n} 공사비` : "구장 개선 기금";
  const d=donOf(t), cost=donSeatCost(t);
  const after=(S&&S.phase!=="done") ? "" : `\n· 기금 <b>${d.fund.toFixed(1)}억 → ${(d.fund+a).toFixed(1)}억</b> <span class="small">(다음 ${DON_STEP.toLocaleString()}석까지 ${cost}억)</span>`;
  showConfirm(`<b style="font-size:17px">💝 ${t.name}에 ${a.toFixed(2)}억을 기부합니다</b>\n\n`+
    `· 보유 현금 <b class="money">${moneyEok(M.cash)}</b> → <b>${left.toFixed(2)}억</b>\n`+
    `· 쓰이는 곳 <b>${dest}</b>${after}\n`+
    `· 공개 여부 <b>${DON_ANON?"🤫 익명":"📣 공개"}</b>\n\n`+
    (DON_ANON
      ? `<span class="small">이름을 남기지 않습니다. 구단주는 장부를 보고 알지만 팬과 언론은 모릅니다 — 언젠가 알려지면 그때 팬들이 가장 크게 움직입니다.</span>`
      : `<span class="small">구단주 신뢰와 서포터 신뢰가 함께 오르고, 다음 기자회견에서 질문이 나옵니다.</span>`)+
    (warn.length?`\n\n<span style="color:#ff9d5c">⚠ ${warn.join("<br>⚠ ")}</span>`:""),
    ()=>{ donCommit(a, DON_ANON); },
    {okLabel:"기부한다", cancelLabel:"취소"});
}
/* 시즌 전환 — 겨울 공사를 끝내고, 익명 기부가 알려질 수도 있다 */
function donSeasonTick(){
  for(const id in G.teams){
    const t=G.teams[id], d=t&&t.don;
    if(!d || !(d.pend>0)) continue;
    const sd=stadOf(t);
    /* 🏗️ 대공사는 한 겨울에 다 못 끝낸다 — 1만 2천 석까지만 완공하고 나머지는 이듬해로 (제보 — 대형 증축 2시즌) */
    const done=Math.min(d.pend, DON_WINTER_MAX);
    sd.cap = Math.min(STAD_CAP_MAX, Math.round((sd.cap||10000) + done));
    if(sd._base0==null) sd._base0=sd.avg;
    /* ⚠ K리그 구장은 대부분 좌석이 남는다 — 좌석 수만 늘리면 아무 실익이 없다.
       그래서 이 사업은 「구장 개선」으로 다룬다. 시야·편의시설·원정석이 함께 좋아지고,
       그만큼 이 구장이 담을 수 있는 관중의 천장(_base0 → attCeilOf)이 올라간다. */
    sd._base0 = Math.round(sd._base0 + done*0.40);
    sd.avg    = Math.round(sd.avg*1.02 + done*0.06);
    d.seats=(d.seats||0)+done;
    d.pend -= done;
    if(t.isUser){
      try{ addNews(`🎉 <b>${sd.n}</b> 구장 개선 공사 완료 — 좌석 <b>${done.toLocaleString()}석</b> 증설, 수용 인원 <b>${sd.cap.toLocaleString()}명</b>. 시야와 편의시설도 손봤습니다.${d.pend>0?` <b>남은 ${d.pend.toLocaleString()}석</b>은 공사가 이어져 다음 겨울에 개방됩니다.`:""}`, "good", "club"); }catch(e){}
      try{ socialFill(SOC.donateSeat, 3+R(3), 1, {t:t.short, m:done.toLocaleString()}); }catch(e){}
      try{ adjustTrust("fans", clamp(done/400, 1, 7), "관중석 증설 완공"); }catch(e){}
    }
  }
  /* 🤫 익명이 밝혀지는 순간 — 금액이 클수록 빨리 알려진다 */
  const ut=userTeam(), ud=ut&&ut.don;
  if(ut && ud && ud.anon>0){
    const p=clamp((ud.anon/donRef())*0.22, 0.06, 0.55);
    if(Math.random()<p){
      const a=Math.round(ud.anon*100)/100; ud.anon=0;
      try{ addNews(`💝 <b>익명 후원자는 감독이었습니다</b> — ${ut.name} 감독이 그동안 사비 <b>${a.toFixed(1)}억</b>을 이름 없이 내놓은 사실이 확인됐습니다.`, "good", "club"); }catch(e){}
      try{ adjustTrust("fans", clamp((a/donRef())*7, 2.5, 11), "익명 기부가 알려짐"); }catch(e){}
      try{ if(G.press) G.press.rel=clamp((G.press.rel||50)+6, 0, 100); }catch(e){}
      try{ bumpHype(ut, clamp((a/donRef())*0.06, 0.01, 0.09), "감독의 익명 기부가 알려졌습니다"); }catch(e){}
      try{ socialFill(SOC.donateAnon, 3+R(3), 1, {t:ut.short, m:a.toFixed(1)}); }catch(e){}
      try{ fmkFill(FMK.donateClub, 2+R(2), {t:ut.short, m:a.toFixed(1)}); }catch(e){}
      G.donAsk={amt:a, anon:1, s:G.season, d:G.day||0, asked:0};
    }
  }
}
/* 시즌이 끝날 때 — 지자체·모기업 지원금이 들어오고, 공정을 확인한다 */
function stadSeasonEnd(){
  const S=stadProj(), t=userTeam(); if(!S || !t || S.phase==="done") return;
  const plan=stadPlan(S.k), ct=clubType(t)||{k:"corp",o:"모기업"};
  const pos=leaguePos(t);
  let grant=(ct.k==="civic" ? plan.cost*0.05 : plan.cost*0.07);
  if(pos<=3) grant*=1.5; else if(pos>=11) grant*=0.6;
  grant=Math.round(grant*10)/10;
  const got=stadAdd(grant, `${ct.o} 건립 지원금`);
  if(got) addNews(`🏗️ ${ct.o}, ${t.name} 구장 건립 지원금 <b>${got}억</b> 집행 (누적 ${S.paid}/${S.cost}억)`, "good", "club");
  if(S.phase==="build"){
    const need=S.start+plan.yrs+(S.delay||0);
    if(G.season+1>=need){
      if(S.paid>=S.cost-0.5){ stadFinish(); return; }
      S.delay=(S.delay||0)+1;
      stadLog("사업비 미달 — 공기 1시즌 연장");
      adjustTrust("owner", -6, "구장 공사 지연"); adjustTrust("fans", -5, "구장 공사 지연");
      addNews(`🏗️ ${t.name} ${S.name} 공사 <b>1시즌 지연</b> — 사업비 ${S.paid}/${S.cost}억. 자금이 부족합니다.`, "warn", "club");
      socialFill(SOC.stadDelay, 3+R(3), -1, {t:t.short, w:S.name});
      fmkFill(FMK.stadDelay, 2+R(3), {t:t.short, w:S.name});
      rivalFill(RIV.stadDelay, 2+R(2), 0, {t:t.short, w:S.name});
    }
  }
  saveGame();
}
/* 새 구장에서 치르는 첫 홈경기 — 결과보다 그날 왔다는 사실이 남는다 */
function stadOpeningGame(M){
  const S=stadProj(), t=userTeam();
  if(!S || S.phase!=="done" || S.opened) return;
  if(!M || !M.home || !M.home.isUser || (M.opts&&M.opts.friendly)) return;
  S.opened=1;
  const sd=stadOf(t);
  addNews(`🎉 <b>${S.name} 개장전</b> — ${t.name} ${M.hg}-${M.ag} ${M.away.short}. 새 집에서의 첫 경기가 끝났습니다. (관중 ${(M.att||sd.cap).toLocaleString()}명)`, "good", "club",
    {cat:"club", ic:"🎉", tone:1, tid:t.id, src:"K리그 공식",
     head:`${S.name} 개장전 — ${t.short} ${M.hg}-${M.ag} ${M.away.short}`,
     sub:`매진된 관중석이 새 구장의 첫 함성을 채웠다.`});
  socialFill(SOC.stadOpen1, 4+R(3), 1, {t:t.short, w:S.name});
  adjustTrust("fans", 4, `${S.name} 개장전`);
  bumpHype(t, 0.05, `${S.name} 개장전`);
}
function stadFinish(){
  const S=stadProj(), t=userTeam(); if(!S||!t) return;
  const plan=stadPlan(S.k);
  const sd=stadOf(t);
  /* 새 구장은 기존보다 작아지지 않는다 — 작은 구단은 규모 자체가 뛰고, 큰 구단은 폭이 좁다 */
  const add=plan.capAdd[0]+R(plan.capAdd[1]-plan.capAdd[0]+1);
  const cap=Math.max(Math.round(sd.cap*(plan.capMul||1.08)), sd.cap+Math.round(add*0.55), add);
  /* ⚠ 예전에는 t.stad 를 통째로 새 객체로 갈아 끼우면서 _base0(기준 관중의 밑값)를 흘렸다.
     그러면 attBase0 가 옛 자료표(STADIUM)의 값으로 되돌아가, 4만 석짜리 새 구장을 짓고도
     관중 하한·상한이 옛 구장 기준에 묶였다 — 신축의 실익이 반쯤 사라졌다. */
  const _newAvg=Math.round(sd.avg*plan.avgMul);
  t.stad={n:S.name, cap:Math.round(cap/100)*100, avg:_newAvg, _base0:_newAvg};
  /* 🔒 감독이 직접 지은 새 구장 이름 — 옛 잠금(에디터로 고쳐 둔 구장명)이 이걸 되돌리지 않게 갱신 */
  try{ edLockRenew(t.id, "stadName", S.name); }catch(e){}
  t.fans=Math.round(clamp((t.fans||10)*plan.fansMul, 4, 140)*10)/10;
  bumpHype(t, plan.hype, `${S.name} 개장`);
  adjustTrust("owner", 16, `${S.name} 완공`); adjustTrust("fans", 22, `${S.name} 완공`);
  S.phase="done"; S.doneS=G.season;
  stadLog(`완공 — 수용 ${t.stad.cap.toLocaleString()}석`);
  addNews(`🏟️ <b>${t.name}의 새 집, ${S.name} 완공!</b> 수용 ${t.stad.cap.toLocaleString()}석 — ${plan.n}이 K리그에 문을 엽니다.`, "good", "club",
    {cat:"club", ic:plan.ic, tone:1, tid:t.id, head:`${S.name} 개장`, src:"K리그 공식",
     sub:`총사업비 ${S.cost}억. ${t.name}은 이제 ${plan.n}을 가진 구단이 됐다.`});
  socialFill(stadPool(SOC,"stadDone",S.k), 6+R(4), 1, {t:t.short, w:S.name});
  fmkFill(stadPool(FMK,"stadDone",S.k), 4+R(4), {t:t.short, w:S.name});
  rivalFill(RIV.stadDone, 3+R(3), 0, {t:t.short, w:S.name});
  rivalFmk(FRIV.stadDone, 2+R(3), {t:t.short, w:S.name});
  saveGame();
}
/* 재정 화면 카드 */
function stadCard(){
  const t=userTeam(); if(!t) return "";
  const S=stadProj(), sd=stadOf(t);   // 🏟️ 제보 — 남의 구단 사업은 여기 뜨지 않는다
  const head=`<h3>🏟️ 홈 구장 <span class="small">— ${sd.n} · 수용 ${sd.cap.toLocaleString()}석 · 좌석 점유율 ${Math.round(stadFill(t)*100)}%</span></h3>`;
  if(!S){
    return `<div class="card">${head}
      <p class="small" style="margin-bottom:8px">전용구장은 구단의 숙원 사업입니다. 이사회는 성적·신뢰·관중을 모두 봅니다.
        ${G.stadNo===G.season?'<b style="color:var(--gold)">올 시즌에는 이미 안건을 다뤘습니다.</b>':""}</p>
      ${STAD_PLANS.map(pl=>{ const rows=stadCheck(pl), bad=rows.filter(r=>!r.ok).length;
        return `<div class="meRow">
          <span class="meIc">${pl.ic}</span>
          <span class="meN"><b>${pl.n}</b><span class="small"> ${pl.d}</span><br>
            <span class="small">요건 <b style="color:${bad?"var(--red)":"var(--green)"}">${rows.length-bad}/${rows.length}</b> 충족 · ${rows.filter(r=>!r.ok).map(r=>r.n).join(", ")||"모두 충족"}</span></span>
          <span class="meV">${pl.cost}억<br><span class="small">공기 ${pl.yrs}시즌</span></span>
          <button class="mini" onclick="stadOpenProposal('${pl.k}')">📋 안건 상정</button></div>`;}).join("")}
    </div>`;
  }
  const plan=stadPlan(S.k), pct=Math.round(S.paid/S.cost*100);
  if(S.phase==="done"){
    return `<div class="card" style="border-color:var(--green)">${head}
      <div class="msg good" style="border-width:2px">🏟️ <b>${S.name}</b> — ${G.season-(S.doneS||G.season)===0?"올 시즌":`${S.doneS}년`} 개장. 총사업비 ${S.cost}억.</div>
      <p class="small">수용 ${sd.cap.toLocaleString()}석 · 기준 관중 ${sd.avg.toLocaleString()}명. 이 구장은 감독이 남긴 것입니다.</p></div>`;
  }
  const left=Math.round((S.cost-S.paid)*10)/10;
  const due=S.phase==="build" ? (S.start+plan.yrs+(S.delay||0)) : null;
  return `<div class="card" style="border-color:var(--gold)">${head}
    <div class="msg ${S.phase==="build"?"good":"info"}" style="border-width:2px">
      ${plan.ic} <b>${S.phase==="build"?`${S.name} 공사 중`:`${plan.n} 모금 중`}</b>
      ${S.phase==="build"?` — ${due}시즌 완공 예정${S.delay?` <span style="color:var(--red)">(${S.delay}시즌 지연)</span>`:""}`:` — 사업비의 35%(${Math.round(S.cost*0.35)}억)를 모으면 착공합니다`}
    </div>
    <div class="txpBar"><div class="txpFill" style="width:${Math.min(100,pct)}%"></div><span>${S.paid} / ${S.cost}억 (${pct}%)</span></div>
    <p class="small" style="margin:8px 0">남은 사업비 <b>${left}억</b> · 매 경기 수입의 <b>${Math.round(STAD_SKIM*100)}%</b>가 자동 적립되고 있습니다 <span class="small">(그만큼 이적 예산이 줄어듭니다)</span></p>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="mini" onclick="stadFundOpen()">🏗️ 이적 예산 전용</button>
      <button class="mini" onclick="stadDonateOpen()">💝 감독 사비 기부</button>
      ${S.phase==="raise"&&S.paid>=S.cost*0.35?`<button class="mini" style="border-color:var(--gold);color:var(--gold)" onclick="stadTryStart()">⛏️ 착공하기</button>`:""}
    </div>
    ${S.log&&S.log.length?`<div style="margin-top:10px;max-height:150px;overflow-y:auto">
      ${S.log.map(x=>`<div style="padding:3px 0;border-bottom:1px solid #21262d;font-size:12.5px"><span class="small" style="color:var(--sub)">${x.s}</span> ${x.t}</div>`).join("")}</div>`:""}
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════
   표 정렬 — 이적 관련 화면 공통
   머리글을 누르면 그 열로 정렬하고, 같은 열을 다시 누르면 방향이 뒤집힌다.
   상태는 화면별로 따로 기억한다(판매 탭에서 정렬한 게 재계약 탭에 옮지 않게).
═══════════════════════════════════════════════════════════════ */
let SORTS={};
function sortState(tbl, defK){
  if(!SORTS[tbl]) SORTS[tbl]={k:defK||"", dir:-1};
  return SORTS[tbl];
}
function setSort(tbl, key, view){
  const st=sortState(tbl, key);
  if(st.k===key) st.dir=-st.dir; else { st.k=key; st.dir=-1; }
  if(view==="_ps") psRefresh(); else show(view||VIEW);
}
function sortTh(tbl, key, label, defK){
  const st=sortState(tbl, defK), on=st.k===key;
  return `<th class="sortTh${on?" on":""}" onclick="setSort('${tbl}','${key}','${SORT_VIEW[tbl]||""}')">${label}${on?(st.dir<0?" ▼":" ▲"):' <span class="sortHint">⇅</span>'}</th>`;
}
/* ⚠ 제보 — 임대 보내기 탭에서 정렬을 누르면 재계약 화면으로 튕겼다.
   임대를 임대 센터로 옮기면서 이 표를 안 고쳤다. 정렬은 그 화면에 그대로 머물러야 한다. */
const SORT_VIEW={sell:"contract", renew:"contract", loan:"loancenter", offers:"offers", army:"transfer"};
/* ⚠ "능력" 열은 별(abilityStars)로 표시되는데 정렬은 내부 ovr 로 했다.
   별은 playerLevel(포지션 가중 평균) 기준이라 둘이 어긋나 별 순서가 뒤섞여 보였다.
   정렬도 별과 같은 눈금을 쓴다. */
function sortLv(p){ try{ return playerLevel(p); }catch(e){ return (p&&p.ovr)||0; } }
/* 카드형 목록(검색·FA·해외)은 머리글이 없으니 드롭다운으로 고른다 */
const SORT_OPTS={
  ps:[["ovr","능력치 높은 순"],["ovrA","능력치 낮은 순"],["age","나이 많은 순"],["ageA","나이 적은 순"],
      ["mv","시장가치 높은 순"],["mvA","시장가치 낮은 순"],["name","이름 순"]],
  fa:[["ovr","능력치 높은 순"],["ovrA","능력치 낮은 순"],["age","나이 많은 순"],["ageA","나이 적은 순"],
      ["wage","요구 연봉 높은 순"],["wageA","요구 연봉 낮은 순"],["name","이름 순"]],
  sc:[["ovr","능력치 높은 순"],["ovrA","능력치 낮은 순"],["mv","이적료 높은 순"],["mvA","이적료 낮은 순"],
      ["wage","요구 연봉 높은 순"],["age","나이 많은 순"],["ageA","나이 적은 순"],["name","이름 순"]],
  os:[["ovr","능력치 높은 순"],["ovrA","능력치 낮은 순"],["mv","이적료 높은 순"],["mvA","이적료 낮은 순"],
      ["wage","요구 연봉 높은 순"],["wageA","요구 연봉 낮은 순"],["age","나이 적은 순"],["name","이름 순"]]
};
function cardSort(tbl){ if(!SORTS[tbl]) SORTS[tbl]={k:"ovr", dir:-1}; return SORTS[tbl]; }
function setCardSort(tbl, v){
  cardSort(tbl).k=v;
  if(tbl==="ps"){ tfFilter.page=1; psRefresh(); } else { if(tbl==="fa") faPage=1; else if(tbl==="os") osPage=1; show("transfer"); }
}
function cardSortBox(tbl){
  const cur=cardSort(tbl).k;
  return `<select class="sortSel" onchange="setCardSort('${tbl}',this.value)">
    ${(SORT_OPTS[tbl]||[]).map(o=>`<option value="${o[0]}" ${cur===o[0]?"selected":""}>↕ ${o[1]}</option>`).join("")}</select>`;
}
/* 카드형 정렬 적용 — 키 뒤에 A가 붙으면 오름차순 */
function cardApply(tbl, list, get){
  const k=cardSort(tbl).k;
  const asc=k.slice(-1)==="A";
  const base=asc?k.slice(0,-1):k;
  const g=get[base]; if(!g) return list;
  return list.slice().sort((a,b)=>{
    const va=g(a), vb=g(b);
    /* 이름은 언제나 ㄱ→ㅎ 순이 자연스럽다 */
    if(typeof va==="string" || typeof vb==="string")
      return String(va||"").localeCompare(String(vb||""), "ko");
    return asc ? ((va||0)-(vb||0)) : ((vb||0)-(va||0));
  });
}
function applySort(tbl, arr, getters, defK){
  const st=sortState(tbl, defK), g=getters[st.k];
  if(!g) return arr;
  return arr.slice().sort((a,b)=>{
    const va=g(a), vb=g(b);
    if(typeof va==="string" || typeof vb==="string")
      return st.dir * String(vb||"").localeCompare(String(va||""), "ko");
    return st.dir * ((va||0)-(vb||0));
  });
}
/* 🤝 스폰서 카드 — 지금 우리 유니폼에 누가 붙어 있는가, 그리고 왜 그 값인가 */
function sponCard(){
  const t=userTeam(); if(!t) return "";
  const sp=sponOf(t), a=sponAppeal(t), tot=sponTotal(t);
  const tierName=(k)=>k===1?"전국구":k===2?"중견":"지역";
  const rows=sponSlots().map(k=>{
    const S=SPON_SLOT[k], s=sp[k];
    if(!s) return `<tr><td>${S.ic} ${S.n}</td><td colspan=3 class="small" style="opacity:.6">계약 없음 — ${S.d}</td></tr>`;
    const bar=Math.round(clamp(s.left/Math.max(1,s.yrs),0,1)*100);
    return `<tr><td style="white-space:nowrap">${S.ic} ${S.n}</td>
      <td style="text-align:left"><b>${s.n}</b> <span class="small" style="opacity:.6">${tierName(s.tier)}</span></td>
      <td class="money"><b>${s.amt}억</b><span class="small" style="opacity:.6">/년</span></td>
      <td class="small">잔여 <b>${s.left}년</b>
        <div style="height:4px;background:#21262d;border-radius:2px;margin-top:3px">
          <div style="height:100%;width:${bar}%;background:${s.left<=1?"var(--red)":s.left<=2?"var(--gold)":"var(--green)"};border-radius:2px"></div></div></td></tr>`;
  }).join("");
  const grade = a>=75?["최상위","var(--green)"] : a>=55?["상위","#58a6ff"] : a>=38?["중위","var(--gold)"] : ["하위","var(--sub)"];
  const heat=G.sponHeat||0;
  /* 매력도 분해 — 무엇이 값을 만들고 무엇이 깎아먹는지 그대로 펼친다 */
  const D=sponAppealDetail(t);
  const detail=`<details style="margin-top:8px"><summary class="small" style="cursor:pointer">📊 매력도 ${D.v} — 항목별 내역 보기</summary>
    <div class="tblScroll" style="margin-top:6px"><table>
    ${D.items.map(x=>{
      const neg=x.v<0, w=Math.round(clamp(Math.abs(x.v)/Math.max(1,Math.abs(x.max)||8),0,1)*100);
      return `<tr><td style="white-space:nowrap;width:92px">${x.n}</td>
        <td style="width:56px;text-align:right"><b style="color:${neg?"var(--red)":x.v>=0.05?"var(--green)":"var(--sub)"}">${neg?"":"+"}${x.v}</b></td>
        <td style="width:90px"><div style="height:5px;background:#21262d;border-radius:3px">
          <div style="height:100%;width:${w}%;background:${neg?"var(--red)":"var(--green)"};border-radius:3px"></div></div></td>
        <td class="small" style="text-align:left;opacity:.7">${x.tip||""}</td></tr>`;
    }).join("")}
    </table></div>
    <p class="small" style="opacity:.65;margin-top:4px">기본 14점에서 시작해 항목을 더합니다. 초록은 값을 올리는 요소, 빨강은 깎는 요소입니다.</p>
  </details>`;
  return `<div class="card"><h3>🤝 스폰서십 <span class="small">— 연 <b class="money">${tot}억</b> · 매력도 <b style="color:${grade[1]}">${a}</b> (${grade[0]}) · 파트너 ${sponPartners(t).length}곳</span></h3>
    <div class="tblScroll"><table>
      <tr><th style="text-align:left">자리</th><th style="text-align:left">스폰서</th><th>금액</th><th>계약</th></tr>
      ${rows}</table></div>
    ${(function(){
      const ps=sponPartners(t), pt=sponPartnerTotal(t), tg=sponPartnerTarget(t);
      if(!ps.length) return `<p class="small" style="margin-top:6px;opacity:.7">공식 파트너 없음 — 매력도가 오르면 파트너가 붙습니다 (현재 유치 가능 ${tg}곳)</p>`;
      const byKind={};
      for(const x of ps){ (byKind[x.kind]=byKind[x.kind]||[]).push(x); }
      const rows=SPON_PARTNER_KIND.filter(k=>byKind[k.k]).map(k=>
        `<tr><td style="white-space:nowrap">${k.ic} ${k.n}</td>
         <td style="text-align:left">${byKind[k.k].map(x=>`${x.n} <span class="small" style="opacity:.6">${x.amt}억·${x.left}년</span>`).join("<br>")}</td></tr>`).join("");
      return `<details style="margin-top:8px"><summary class="small" style="cursor:pointer">
        🤝 공식 파트너 <b>${ps.length}곳</b> — 연 <b class="money">${pt}억</b> <span style="opacity:.6">(유치 여력 ${tg}곳)</span></summary>
        <div class="tblScroll" style="margin-top:6px"><table>${rows}</table></div>
        <p class="small" style="opacity:.65;margin-top:4px">파트너는 개수 제한이 없습니다. 매력도가 오를수록 더 많은 기업이 붙고, 사건이 나면 작은 파트너부터 빠집니다.</p>
      </details>`;
    })()}
    ${detail}
    ${heat>=3?`<div class="msg warn" style="margin-top:6px">⚠️ 최근 사건으로 스폰서들이 예민합니다 (이미지 리스크 ${heat}/6) — 계약 축소나 이탈이 일어날 수 있습니다.</div>`
      :`<p class="small" style="opacity:.65">계약은 만료되면 그때의 매력도로 새로 맺어집니다. 성적·관중·아시아 무대 성적이 곧 협상력입니다.</p>`}
  </div>`;
}
function finance(){
  const t=userTeam();
  const wage=Math.round(totalWage(t)*10)/10;
  const pct=wagePct(t), room=wageRoom(t);
  const barCol = pct>=100?"var(--red)" : pct>=90?"var(--gold)" : "var(--green)";
  const avg=t.players.length?Math.round(wage/t.players.length*100)/100:0;
  return `<h2>🏦 재정</h2>
  ${(function(){ try{
    /* 🏢 모기업 상태 — 기업구단이면 예산의 뿌리가 여기다. 삭감이 «갑자기» 오지 않게 미리 보여 준다 */
    if(clubForSale(t)){
      const _r=saleState()[t.id];
      return `<div class="msg warn">🏳️ <b>구단 매각 절차 진행 중</b> — 모기업 <b>${_r.from}</b>이(가) 부도났습니다.<br>
        <span class="small">인수 결론은 <b>${dateLabel(_r.due)}</b>에 나옵니다. 기업이 인수하면 새 모기업이 생기고,
        아무도 나서지 않으면 <b>${cityOf(t)}</b>가 떠안아 <b>시민구단</b>이 됩니다.
        그때까지 예산 증액 요청은 막힙니다.</span></div>`;
    }
    const ct=clubType(t); if(ct.k!=="corp") return "";
    const st=ownStock(t), h=ownHealth(t), L=ownLabel(t), k=ownBudK(t);
    if(!st) return `<div class="msg warn">🏢 <b>${ct.o}</b> — 상장폐지된 상태입니다.
      구단 운영자금 조달 경로가 끊겨 <b>지원금이 대폭 삭감</b>됩니다.</div>`;
    const H=(st.hist||[]).slice(-90);
    const avg=H.length?Math.round(H.reduce((a2,b2)=>a2+b2,0)/H.length):st.p;
    return `<div class="msg ${h<OWN_H_LO?"warn":h>OWN_H_HI?"good":"info"}">
      🏢 <b>${ct.o}</b> — 모기업 상태 <b style="color:${L.c}">${L.t}</b>
      <span class="small">(주가 ${stkWon(st.p)}원 · 90일 평균 ${stkWon(avg)}원 · <b>${Math.round(h*100)}%</b>)</span><br>
      <span class="small">기업구단의 예산은 모기업 지원금에서 나옵니다 — 지금 이사회의 지갑은
      평시의 <b>${Math.round(k*100)}%</b>입니다. ${h<OWN_H_LO
        ? "실적이 더 나빠지면 <b>지원금이 삭감</b>되고 예산 증액 요청도 어려워집니다."
        : h>OWN_H_HI ? "이 흐름이 이어지면 <b>특별 지원금</b>이 들어올 수 있습니다."
        : "증액 요청과 이사회 판단에 그대로 반영됩니다."}</span></div>`;
  }catch(e){ return ""; } })()}
  ${stadCard()}
  ${sponCard()}
  <div class="msg info">K리그는 <b>이적료 시장이 작고 연봉 규모가 큽니다.</b>
    이적 예산은 선수를 사고팔 때 쓰는 현금이고, 연봉은 별도의 상한선 안에서 관리합니다.</div>
  <div class="row">
  <div class="card"><h3>💸 이적 예산</h3><div style="font-size:26px" class="money">${t.budget}억 원</div>
    <p class="small" style="margin-top:6px">이적료·에이전트 비용·위약금을 여기서 지불합니다.
      선수를 팔면 이 주머니로 들어옵니다.</p>
    ${reqButton(t)}</div>
  <div class="card"><h3>🧾 연봉 총액</h3><div style="font-size:26px">${wage}억 <span class="small">/ 상한 ${t.wageCap||0}억</span></div>
    <div class="attrRow" style="margin-top:6px"><div class="ab"><div class="af" style="width:${Math.min(100,pct)}%;background:${barCol}"></div></div><span class="av">${pct}%</span></div>
    <p class="small" style="margin-top:4px">여유 <b style="color:${room<0?"var(--red)":"#fff"};font-weight:800">${room}억</b>
      · 1인 평균 <b style="color:#fff;font-weight:800">${avg}억</b>
      ${room<0?`<br><span style="color:var(--red)">⚠ 상한을 넘겼습니다 — 구단주가 주시하고 있습니다.</span>`:""}</p></div>
  <div class="card"><h3>⚖️ 예산 배분</h3>
    <p class="small">지금 굴릴 수 있는 재원 <b style="color:#fff;font-weight:800">${budPool(t)}억</b>을 이적료와 연봉 중 어디에 쓸지 정합니다. <span style="opacity:.8">선수를 팔거나 입장 수입이 들어오면 이 값도 함께 늘어납니다.</span></p>
    <input type="range" min="${BUD_MIN*100}" max="${BUD_MAX*100}" step="5" value="${Math.round(budSplit(t)*100)}"
      oninput="document.getElementById('budLbl').textContent=this.value+'%'" onchange="setBudgetSplit(this.value)"
      style="width:100%;margin:8px 0">
    <div class="small" style="display:flex;justify-content:space-between">
      <span>← 연봉 중시</span><span id="budLbl" style="color:#fff;font-weight:800">${Math.round(budSplit(t)*100)}%</span><span>이적료 중시 →</span></div>
    <p class="small" style="margin-top:6px">이적 예산 <b class="money">${t.budget}억</b> · 연봉 상한 <b style="color:#fff;font-weight:800">${t.wageCap}억</b>
      (여유 ${wageRoom(t)}억)<br>
      이적 예산을 1억 줄이면 연봉 상한이 약 ${BUD_CONV}억 늘어납니다.</p></div>
  ${stadiumCard(t)}</div>
  ${clubBuildCard(t)}
  ${facCard(t)}
  ${gateCard(t)}
  <div class="card"><h3>연봉 <span class="small">— 선수단 전체 ${t.players.length}명 · 총 ${Math.round(t.players.reduce((s,p)=>s+(p.wage||0),0)*10)/10}억</span></h3>
  ${/* ⚠ 제보 — 「연봉 상위를 연봉으로 바꾸고 팀 전체 연봉을 띄워 달라 — 누가 고평가·저평가인지
       단번에 보이게. 길면 스크롤바도」. 상위 12명만 잘라 보여주던 것을 전원으로. */""}
  <div class="tblScroll" style="max-height:56vh;overflow-y:auto;-webkit-overflow-scrolling:touch"><table><tr><th>이름</th><th>포지션</th><th>능력</th><th>연봉</th><th>적정</th><th>시장가치</th></tr>
  ${[...t.players].sort((a,b)=>b.wage-a.wage).map(p=>{
    const we=wageExpect(p.ovr,p.frn,t.div);
    const over=p.wage>we*1.25, under=p.wage<we*0.7;
    return `<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</td>
      <td class="pos-${p.pos}">${prefSlotOf(p)}</td><td>${abilityStars(p)}</td>
      <td style="color:${over?"var(--red)":under?"var(--green)":"inherit"};font-weight:700">${p.wage}억</td>
      <td class="small">${we}억</td><td class="small">${marketValue(p)}억</td></tr>`; }).join("")}</table></div>
    <p class="small" style="margin-top:6px"><span style="color:var(--red)">붉은색</span> = 적정가보다 많이 받는 선수 ·
      <span style="color:var(--green)">초록색</span> = 저평가 (연봉 불만이 나올 수 있습니다)</p></div>`;
}
/* ═══════════════════════════════════════════════════════════════
   예산 증액 요청 (FM의 이사회 요구)
   기업구단은 모기업 이사회가 그 자리에서 결론을 낸다. 시민구단은 다르다 —
   구단이 아니라 시청·도청이 돈줄이고, 그 돈은 시의회 추가경정예산을 통과해야 나온다.
   심의에 며칠이 걸리고, 통과하면 "내 세금으로 축구선수 사냐"는 시선이 따라붙는다.
     kind: budget 이적 예산 · wage 연봉 상한 · youth 유스·훈련 시설
     arg : 감독이 내세우는 논거 — 상황에 맞아야 통과 확률이 오른다
═══════════════════════════════════════════════════════════════ */
const REQ_COOL=28;              // 승인된 뒤 같은 종류를 다시 요청하기까지 필요한 날
const REQ_COOL_NO=30;           // 거절당하면 최소 30일은 다시 못 올린다
const REQ_MAX_SEASON=3;         // 한 시즌에 올릴 수 있는 안건 수
const REQ_KIND={
  budget:{n:"이적 예산 증액", ic:"💰", d:"선수를 사고팔 현금을 늘립니다."},
  youth: {n:"유스·훈련 시설 투자", ic:"🌱", d:"당장 쓸 돈은 아니지만, 매 시즌 올라오는 유망주의 질이 달라집니다."},
  scout: {n:"스카우팅 망 투자", ic:"🔎", d:"해외 스카우트를 늘립니다. 이적시장마다 올라오는 발굴 자원의 수와 정확도가 달라집니다."},
  train: {n:"훈련시설 증축", ic:"🏋️", d:"선수단 전체의 성장 속도가 빨라지고 훈련 부상이 줄며, 유스에서 특급이 나올 확률이 오릅니다."}
};
/* 감독이 고를 수 있는 논거.
   ev(c) 는 "이 논거가 지금 얼마나 먹히는가"를 -1~+1 강도와 근거 목록으로 돌려준다.
   예전에는 참/거짓 하나로만 판정해서, 부상 3명이나 8명이나 똑같이 취급됐다. */
const REQ_ARG=[
 /* ── 프리시즌 전용 ── 아직 한 경기도 치르지 않았으니 성적으로는 말할 수 없다 */
 {k:"preGoal", n:"🎯 공언한 목표에 맞는 스쿼드가 아니다", kinds:["budget"], w:1.0, only:"pre",
  say:"구단이 내건 목표는 {goal}입니다. 그런데 지금 스쿼드로는 그 근처에도 못 갑니다. 목표를 낮추시든지, 아니면 그 목표에 맞는 선수를 붙여 주십시오.",
  ev:(c)=>{ const w=[]; let s=-0.10;
    if(c.goalTier==="insane"){ s+=0.75; w.push(`전력 ${c.expRank}위권인데 목표는 ${c.goalReq}위`); }
    else if(c.goalTier==="bold"){ s+=0.50; w.push(`전력 대비 높은 목표 (${c.goalReq}위)`); }
    else if(c.goalTier==="safe"||c.goalTier==="low"){ s-=0.45; w.push("스스로 낮게 잡은 목표 — 명분이 없다"); }
    if(c.expRank-c.goalReq>=4){ s+=0.25; w.push(`전력과 목표의 간극 ${c.expRank-c.goalReq}계단`); }
    if(!c.winOpen){ s-=0.40; w.push("이적시장이 닫혀 있다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"preWinter", n:"❄️ 겨울 시장에서 뒤처지고 있다", kinds:["budget"], w:0.95, only:"pre",
  say:"개막이 코앞인데 우리만 조용합니다. 경쟁 구단들은 이미 보강을 끝냈습니다. 지금 움직이지 않으면 개막하고 나서는 늦습니다.",
  ev:(c)=>{ const w=[]; let s=-0.20;
    if(c.openIn<=21 && c.openIn>0){ s+=0.35; w.push(`개막까지 ${c.openIn}일`); }
    if(c.mktMoves>=3){ s+=0.45; w.push(`겨울 시장에서 경쟁팀 영입 ${c.mktMoves}건`); }
    else if(c.mktMoves>=1){ s+=0.25; w.push(`경쟁팀 영입 ${c.mktMoves}건 포착`); }
    if(c.richerN>=4){ s+=0.35; w.push(`${c.richerN}팀이 우리보다 예산 우위`); }
    if(c.preRec && c.preRec.l>c.preRec.w){ s+=0.25; w.push(`연습경기 ${c.preRec.w}승 ${c.preRec.d}무 ${c.preRec.l}패`); }
    if(!c.winOpen){ s-=0.55; w.push("이적시장이 닫혀 있다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"form", n:"🔥 상승세를 굳히자", kinds:["budget"], w:1.0, only:"season",
  say:"지금 우리 팀은 기대 이상의 시즌을 보내고 있습니다. 다만 이 스쿼드로 후반기 체력과 부상 변수를 버티기는 어렵습니다. 지금 조금만 지원해 주시면 {goal}을/를 확실하게 만들고, 그만큼의 상금과 중계 수익으로 돌려드리겠습니다.",
  ev:(c)=>{ const w=[]; let s=0;
    if(c.goalGap>=3){ s+=0.55; w.push(`목표(${c.goalReq}위)보다 ${c.goalGap}계단 위`); }
    else if(c.goalGap>=1){ s+=0.30; w.push(`목표 순위를 앞서는 중 (${c.pos}위)`); }
    else if(c.goalGap<=-3){ s-=0.45; w.push(`목표(${c.goalReq}위)에 ${-c.goalGap}계단 미달`); }
    if(c.recent>=2.2){ s+=0.40; w.push(`최근 5경기 승점 ${(c.recent*5).toFixed(0)}점`); }
    else if(c.recent<=0.8){ s-=0.40; w.push("최근 5경기 부진"); }
    if(c.posPct<=0.25){ s+=0.25; w.push(c.div1?"우승 경쟁권":"승격 경쟁권"); }
    if(c.roundsLeft<=4){ s-=0.30; w.push(`잔여 ${c.roundsLeft}경기 — 지금 보강해도 늦다`); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"crisis", n:"🚑 스쿼드가 무너지고 있다", kinds:["budget"], w:0.95, only:"any",
  say:"부상자가 겹치면서 뛸 수 있는 선수가 모자랍니다. 이대로 가면 남은 일정을 버티지 못합니다. 최소한의 보강이라도 해야 합니다.",
  ev:(c)=>{ const w=[]; let s=-0.35;
    if(c.inj>=6){ s+=1.0; w.push(`부상자 ${c.inj}명`); }
    else if(c.inj>=4){ s+=0.70; w.push(`부상자 ${c.inj}명`); }
    else if(c.inj>=2){ s+=0.35; w.push(`부상자 ${c.inj}명`); }
    if(c.banned>=1){ s+=0.15; w.push(`출장정지 ${c.banned}명`); }
    if(c.depthGap<=-2){ s+=0.50; w.push(`${c.depthPos} 자리에 ${c.depthMin}명뿐 (${-c.depthGap}명 부족)`); }
    else if(c.depthGap<=0){ s+=0.25; w.push(`${c.depthPos} 자리가 빠듯하다 (${c.depthMin}명)`); }
    if(c.squad<=22){ s+=0.30; w.push(`선수단 ${c.squad}명 (얇음)`); }
    else if(c.squad>=30){ s-=0.30; w.push(`선수단 ${c.squad}명 — 인원은 충분하다는 반박`); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"rival", n:"📈 경쟁 팀은 이미 움직였다", kinds:["budget"], w:0.9, only:"season",
  say:"경쟁 구단들은 이미 지갑을 열었습니다. 우리만 가만히 있으면 격차는 돈이 아니라 순위로 돌아옵니다. 지금이 마지막 타이밍입니다.",
  ev:(c)=>{ const w=[]; let s=-0.25;
    if(c.richerN>=5){ s+=0.75; w.push(`같은 리그 ${c.richerN}팀이 우리보다 예산이 많다`); }
    else if(c.richerN>=3){ s+=0.50; w.push(`${c.richerN}팀이 우리보다 예산 우위`); }
    if(c.budRank>=c.N-2){ s+=0.35; w.push(`예산 ${c.budRank}위/${c.N}`); }
    if(c.mktMoves>=2){ s+=0.35; w.push(`이번 시장에서 경쟁팀 영입 ${c.mktMoves}건`); }
    if(!c.winOpen){ s-=0.55; w.push("이적시장이 닫혀 있다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"keep", n:"🤝 핵심 선수를 지켜야 한다", kinds:["budget"], w:1.05, only:"any",
  say:"우리 핵심 선수의 계약이 얼마 남지 않았고, 다른 구단이 이미 움직이고 있습니다. 자유계약으로 놓치면 이적료 한 푼 못 받고, 대체자를 구하는 데 몇 배가 듭니다. 지금 붙잡아 두는 쪽이 훨씬 싼 선택입니다.",
  ev:(c)=>{ const w=[]; let s=-0.40;
    if(c.keyExpiring>=2){ s+=0.55; w.push(`계약 만료 임박한 주전 ${c.keyExpiring}명`); }
    else if(c.keyExpiring===1){ s+=0.35; w.push(`${c.keyName} 계약 만료 임박`); }
    if(c.offersKey>=2){ s+=0.55; w.push(`타 구단 제의 ${c.offersKey}건 (최고 ${c.offerTop}억)`); }
    else if(c.offersKey===1){ s+=0.40; w.push(`${c.offerFrom}이/가 ${c.offerName} 영입 제의`); }
    if(c.rumorKey>=2){ s+=0.30; w.push(`우리 선수 이적설 ${c.rumorKey}건`); }
    if(c.unhappyKey>=1){ s+=0.25; w.push(`주전 ${c.unhappyKey}명이 불만을 드러냄`); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"scoutCheap", n:"🔎 싸게 사서 비싸게 파는 구단이 되자", kinds:["scout"], w:1.0, only:"any",
  say:"이적료로는 저 팀들을 못 이깁니다. 그런데 아무도 모르는 선수를 먼저 찾아내면 이야기가 달라집니다. 스카우트를 늘려 주십시오. 3억에 데려와 30억에 파는 구단이 되겠습니다.",
  ev:(c)=>{ const w=[]; let s=0.25;
    if(c.scoutLv<=1){ s+=0.35; w.push("스카우팅 망이 사실상 없다"); }
    else if(c.scoutLv>=4){ s-=0.40; w.push(`이미 스카우팅 ${c.scoutLv}등급 — 더 올릴 명분이 약하다`); }
    if(c.budRank>=c.N-3){ s+=0.35; w.push("돈으로는 경쟁이 안 되는 예산 사정"); }
    if(c.richerN>=4){ s+=0.20; w.push(`${c.richerN}팀이 우리보다 예산 우위`); }
    if(c.frnN<=2){ s+=0.25; w.push(`외국인 자원 ${c.frnN}명 — 지금도 부족하다`); }
    if(c.ct.k==="army"){ s-=0.90; w.push("군경팀은 외국인을 쓸 수 없다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"scoutMiss", n:"🕵️ 남들이 데려간 선수를 우리는 못 봤다", kinds:["scout"], w:0.9, only:"any",
  say:"지난 시장에서 경쟁 구단들이 데려간 외국인들, 우리 보고서에는 이름조차 없었습니다. 못 산 게 아니라 못 본 겁니다. 눈이 없으면 돈이 있어도 씁니다.",
  ev:(c)=>{ const w=[]; let s=-0.10;
    if(c.mktMoves>=3){ s+=0.55; w.push(`이번 시장에서 경쟁팀 영입 ${c.mktMoves}건`); }
    else if(c.mktMoves>=1){ s+=0.30; w.push(`경쟁팀 영입 ${c.mktMoves}건 포착`); }
    if(c.scoutLv<=2){ s+=0.35; w.push(`스카우팅 ${c.scoutLv}등급 — 보고서가 부정확하다`); }
    if(c.posPct>0.6){ s+=0.20; w.push("성적이 받쳐 주지 않는다"); }
    if(c.ct.k==="army"){ s-=0.90; w.push("군경팀은 외국인을 쓸 수 없다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"stadDrain", n:"🏗️ 구장 사업이 이적 예산을 빨아들이고 있다", kinds:["budget"], w:1.0, only:"any",
  if:(c)=>{ const S=stadProj(); return !!(S && S.phase && S.phase!=="done"); },
  say:"구장 사업은 구단의 숙원이고 저도 동의했습니다. 하지만 매 경기 수입의 30%가 공사장으로 갑니다. 그 사이 스쿼드가 늙어 가면 새 구장에서 뛸 팀이 없습니다. 운영 예산을 보전해 주십시오.",
  ev:(c)=>{ const w=[]; let s=0;
    if(stadProj()){ const _S=stadProj(); const pct=Math.round(_S.paid/_S.cost*100);
      s+=0.45; w.push(`구장 사업 진행 중 (${pct}%)`);
      if(c.budget<15){ s+=0.25; w.push(`이적 예산 ${c.budget}억 — 바닥이 보인다`); }
      if(c.pos<=4){ s+=0.15; w.push("성적도 잡고 있다는 명분"); } }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"trainElite", n:"🏆 정상급 팀에는 정상급 시설이 필요하다", kinds:["train"], w:1.0, only:"any",
  say:"지금 이 팀은 리그 정상을 다투고 있습니다. 그런데 시설은 중위권입니다. 우승을 바라보는 구단이라면, 선수들이 그에 맞는 환경에서 준비하게 해 주십시오.",
  ev:(c)=>{ const w=[]; let s=0.10;
    if(c.pos<=2){ s+=0.40; w.push(`리그 ${c.pos}위 — 우승 경쟁 중`); }
    else if(c.pos<=4){ s+=0.22; w.push(`리그 ${c.pos}위`); }
    else { s-=0.25; w.push("정상급이라 부르기 어려운 순위"); }
    if((G.trophies||[]).some(x=>x.kind==="champ"||x.kind==="champ2")){ s+=0.18; w.push("우승 경력 구단"); }
    if(c.u23>=5){ s+=0.15; w.push(`키울 유망주 ${c.u23}명`); }
    if(c.trainLv<=4){ s+=0.12; w.push("시설이 순위에 한참 못 미친다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"trainOld", n:"🏋️ 훈련장이 팀의 발목을 잡고 있다", kinds:["train"], w:1.0, only:"any",
  say:"지금 훈련장으로는 선수를 키울 수 없습니다. 남들이 시설에서 얻는 1%를 우리는 매일 잃고 있습니다. 증축해 주시면 이적료 없이 전력이 오릅니다.",
  ev:(c)=>{ const w=[]; let s=0.28;
    if(c.trainLv<=2){ s+=0.35; w.push("훈련시설이 최하 등급"); }
    else if(c.trainLv>=8){ s-=0.40; w.push(`이미 훈련시설 ${c.trainLv}등급`); }
    if(c.injN>=4){ s+=0.30; w.push(`부상자 ${c.injN}명 — 시설 문제라는 명분`); }
    if(c.u23>=6){ s+=0.20; w.push(`23세 이하 ${c.u23}명 — 키울 재료가 있다`); }
    if(c.avgAge>=28.5){ s-=0.15; w.push("노장 위주 스쿼드 — 투자 명분이 약하다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"future", n:"🌱 자체 생산으로 자생하자", kinds:["youth"], w:1.0, only:"any",
  say:"외부 영입에만 기대서는 이 구단이 자생할 수 없습니다. 유스와 훈련 시설에 투자하면 몇 년 뒤에는 우리가 키운 선수를 팔아 이적료를 벌게 됩니다. 가장 남는 장사입니다.",
  ev:(c)=>{ const w=[]; let s=0.30;
    if(c.youthLv<=2){ s+=0.30; w.push("유스 시설이 아직 최하 등급"); }
    else if(c.youthLv>=8){ s-=0.35; w.push(`이미 유스 ${c.youthLv}단계 — 더 올릴 명분이 약하다`); }
    if(c.avgAge>=28.5){ s+=0.35; w.push(`스쿼드 평균 ${c.avgAge}세 — 세대교체가 급하다`); }
    if(c.u23>=6){ s+=0.20; w.push(`23세 이하 ${c.u23}명 — 키울 재료가 있다`); }
    if(c.budRank>=c.N-3){ s+=0.25; w.push("돈으로 경쟁할 수 없는 구단 사정"); }
    if(c.ct.k==="army"){ s-=0.60; w.push("군경팀은 유스를 둘 수 없다"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"fans", n:"🎫 팬이 늘고 있다", kinds:["budget","youth"], w:0.85, only:"any",
  say:"관중이 늘고 있습니다. 시즌권도 팔렸습니다. 팬들이 기대하는 만큼 구단도 응답해야 다음 시즌에 더 큰 수익으로 돌아옵니다.",
  ev:(c)=>{ const w=[]; let s=-0.30;
    if(c.pre){ // 프리시즌엔 관중 기록이 없다 — 시즌권 판매로 말한다
      if(c.stRatio>=0.55){ s+=0.60; w.push(`시즌권 ${c.seasonTix.toLocaleString()}장 (평균 관중의 ${Math.round(c.stRatio*100)}%)`); }
      else if(c.stRatio>=0.38){ s+=0.30; w.push(`시즌권 ${c.seasonTix.toLocaleString()}장 판매`); }
      else if(c.seasonTix>0){ s-=0.35; w.push(`시즌권 ${c.seasonTix.toLocaleString()}장 — 기대에 못 미친다`); }
      else w.push("시즌권 판매가 아직 시작 단계");
    }
    else if(c.attRatio>=1.20){ s+=0.60; w.push(`평균 관중 ${c.avgAtt.toLocaleString()}명 — 기준 대비 ${Math.round((c.attRatio-1)*100)}%↑`); }
    else if(c.attRatio>=1.05){ s+=0.35; w.push(`관중 증가세 (평균 ${c.avgAtt.toLocaleString()}명)`); }
    else if(c.attRatio>0 && c.attRatio<=0.85){ s-=0.35; w.push("관중이 오히려 줄었다"); }
    if(c.gateRev>=budPool(c.t)*0.25){ s+=0.35; w.push(`입장 수입 ${Math.round(c.gateRev*10)/10}억 확보`); }
    if(c.fanTrust>=72){ s+=0.25; w.push(`팬 신뢰 ${Math.round(c.fanTrust)}`); }
    else if(c.fanTrust<=45){ s-=0.30; w.push(`팬 신뢰 ${Math.round(c.fanTrust)} — 설득력이 없다`); }
    if(c.hype>=1.12){ s+=0.20; w.push("흥행 지표 상승"); }
    return {s:clamp(s,-1,1), why:w}; }},
 {k:"ultimatum", n:"🚪 이대로면 저는 못 합니다 (최후통첩)", kinds:["budget","youth"], danger:1, w:0.6, only:"season",
  say:"이 예산으로는 제가 할 수 있는 게 없습니다. 지원해 주시지 않으면 저는 이 자리를 지킬 이유가 없습니다.",
  ev:(c)=>{ const w=[]; let s=-0.20;
    if(c.ownTrust>=80){ s+=0.55; w.push(`구단주 신뢰 ${Math.round(c.ownTrust)} — 버틸 힘이 있다`); }
    else if(c.ownTrust<=50){ s-=0.55; w.push(`구단주 신뢰 ${Math.round(c.ownTrust)} — 역효과가 클 것`); }
    if(c.goalGap>=2){ s+=0.35; w.push("성적으로 뒷받침되는 발언"); }
    if(c.tenure<10){ s-=0.40; w.push(`부임 ${c.tenure}라운드째 — 아직 발언권이 없다`); }
    return {s:clamp(s,-1,1), why:w}; }}
];
/* 지금 우리 구단의 사정 — 판정에 쓰이는 지표 묶음 */
function reqCtx(){
  const t=userTeam(); if(!t) return null;
  const tbl=tableOf(t.div), pos=Math.max(1, tbl.findIndex(x=>x.id===t.id)+1), N=tbl.length||12;
  const f=(t.form||[]).slice(-5);
  const recent=f.length ? f.reduce((s,x)=>s+(x==="W"?3:x==="D"?1:0),0)/f.length : 1.2;
  const inj=t.players.filter(p=>p.inj>0).length;
  const banned=t.players.filter(p=>p.ban>0).length;
  /* 핵심 선수 = 스쿼드 상위 8명.
     ⚠ 예전에는 teamOVR(선발 11인 평균)+2 를 기준선으로 삼았는데, 그 값이 스쿼드 최고 선수보다
        높은 경우가 많아 "핵심 선수"가 한 명도 잡히지 않았다(광주: 기준 75.5, 최고 75). */
  const keys=[...t.players].sort((a,b)=>b.ovr-a.ovr).slice(0, Math.min(8, t.players.length));
  const keyIds=new Set(keys.map(p=>p.id));
  const keyExpList=keys.filter(p=>(p.ct||9)<=1);
  /* 포지션 깊이 — 필요 인원 대비 가장 모자란 자리 */
  const POSN2={GK:"골키퍼", DF:"수비", MF:"미드필드", FW:"공격"};
  const NEED={GK:2, DF:6, MF:6, FW:4};
  let worst=99, depthMin=99, depthPos="";
  for(const ps of ["GK","DF","MF","FW"]){
    const n=t.players.filter(p=>p.pos===ps && avail(p)).length;
    const gap=n-NEED[ps];
    if(gap<worst){ worst=gap; depthMin=n; depthPos=POSN2[ps]; }
  }
  /* 타 구단이 우리 선수를 노리는가 — 실제 들어온 제의와 시장에 도는 이적설 */
  const offers=(G.offers||[]).map(o=>({o, p:t.players.find(x=>x.id===o.pid)})).filter(x=>x.p);
  const keyOffers=offers.filter(x=>keyIds.has(x.p.id));
  const topOffer=keyOffers.length?keyOffers.reduce((a,b)=>a.o.fee>b.o.fee?a:b):null;
  let rumorKey=0;
  try{ rumorKey=rumorList().filter(r=>r.fromId===t.id).length; }catch(e){}
  /* 리그 안에서 우리 예산 위치 */
  const same=Object.values(G.teams).filter(x=>x.div===t.div);
  const richerN=same.filter(x=>x.id!==t.id && x.budget>t.budget*1.25).length;
  const budRank=same.slice().sort((a,b)=>b.budget-a.budget).findIndex(x=>x.id===t.id)+1;
  /* 이번 이적시장에서 경쟁팀이 실제로 움직였는가 */
  let mktMoves=0;
  try{ mktMoves=feedList().filter(x=>x.cat==="transfer" && x.s===G.season && (G.day-x.d)<=30).length; }catch(e){}
  const wi=(()=>{ try{ return windowInfo(); }catch(e){ return {open:false}; } })();
  const fix=t.div===1?G.k1Fix:G.k2Fix, rNow=t.div===1?G.r1:G.r2;
  const ages=t.players.map(p=>G.season-p.by);
  const fin=finLedger(t);
  return {t, ct:clubType(t), div1:t.div===1, pos, N, posPct:pos/N, recent,
          inj, banned, squad:t.players.length,
          keyExpiring:keyExpList.length, keyName:keyExpList.length?keyExpList[0].name:"",
          unhappyKey:keys.filter(p=>p.unhappy>0||p.sulk>0).length,
          depthMin, depthPos, depthGap:worst,
          offersKey:keyOffers.length,
          offerTop:topOffer?topOffer.o.fee:0,
          offerName:topOffer?topOffer.p.name:"",
          offerFrom:topOffer&&G.teams[topOffer.o.tid]?G.teams[topOffer.o.tid].short:"",
          rumorKey, richerN, budRank, mktMoves,
          winOpen:!!wi.open, winName:wi.name||"", roundsLeft:Math.max(0,fix.length-rNow), tenure:rNow,
          youthLv:t.youthLv||1, trainLv:trainLv(t), injN:t.players.filter(q=>q.inj>0).length, scoutLv:scoutLv(t), frnN:t.players.filter(q=>q.frn).length, avgAge:Math.round(ages.reduce((a,b)=>a+b,0)/Math.max(1,ages.length)*10)/10,
          u23:t.players.filter(p=>G.season-p.by<=23).length,
          avgAtt:avgAtt(t), attRatio:avgAtt(t)?avgAtt(t)/Math.max(1,stadOf(t).avg):0,
          gateRev:fin.gate+fin.st,
          hype:hypeOf(t), fanTrust:G.trust?G.trust.fans:70, ownTrust:G.trust?G.trust.owner:70,
          goalReq:(G.goal&&G.goal.req)||Math.ceil(N/2),
          goalGap:((G.goal&&G.goal.req)||Math.ceil(N/2)) - pos,
          goal:(G.goal&&G.goal.n)||"목표 달성", room:wageRoom(t), budget:t.budget,
          approved:(reqState().okCount||0),
          /* ── 프리시즌 지표 — 아직 순위도 폼도 없는 시기에 쓸 근거들 */
          pre:G.phase==="pre",
          openIn:Math.max(0, ((G.cal&&G.cal.openOff)||0)-(G.day||0)),
          expRank:(()=>{ try{ return expectRank(t); }catch(e){ return Math.ceil(N/2); } })(),
          goalTier:(G.goal&&G.goal.tier)||"fair",
          seasonTix:t.seasonTix||0,
          stRatio:(t.seasonTix||0)/Math.max(1, stadOf(t).avg),
          preRec:(()=>{ const a={w:0,d:0,l:0};
            for(const f of (G.friendlies||[])){ if(!f.done) continue;
              const mine=f.home?f.hg:f.ag, his=f.home?f.ag:f.hg;
              if(mine>his) a.w++; else if(mine===his) a.d++; else a.l++; }
            return a; })()};
}
/* 요청 규모 — 구단 체급에 비례한다 */
function reqAmount(kind, c){
  /* 🔟 유스·훈련시설은 10단계가 되며 한 단계가 예전의 반 걸음이다 — 요청 금액도 절반 */
  const base = kind==="youth" ? Math.max(2, Math.round(budPool(c.t)*0.05))
             : kind==="train" ? Math.max(2, Math.round(budPool(c.t)*0.10))
                              : Math.max(3, Math.round(budPool(c.t)*0.20));
  return Math.round(base*10)/10;
}
/* 승인 확률 — 성적·구단주 신뢰·재정 여력·논거의 실제 근거가 모두 들어간다.
   각 요소가 얼마나 기여했는지 breakdown 으로 돌려주어 화면에 그대로 보여 준다. */
function reqChance(kind, arg, c, detail){
  const B=[];                                        // [설명, 기여도]
  const add=(n,v)=>{ if(Math.abs(v)>=0.005) B.push([n, v]); return v; };
  let p = c.pre ? 0.24 : 0.30;         // 프리시즌엔 구단도 아직 지갑을 다 열지 않았다
  /* 시설 투자는 갈수록 비싸진다 — 1→2등급은 쉽게 내주지만 4→5등급은 큰돈이다 */
  if(kind!=="budget"){
    const lvNow={youth:c.t.youthLv||1, train:trainLv(c.t), scout:scoutLv(c.t)}[kind]||1;
    const lvPen=(kind==="scout") ? lvNow : lvEff(lvNow);   // 🔟 10단계는 효과 축으로 환산해 벌점
    p += add(`현재 ${lvNow}등급 (높을수록 비싸다)`, -(lvPen-1)*0.05);
    if(kind==="train" && (function(){ const S=stadProj(); return !!(S && S.phase && S.phase!=="done"); })())
      p += add("구장 공사와 동시 진행 부담", -0.10);
  }
  p += add("구단주 신뢰", (c.ownTrust-55)/100*0.55);
  /* 🏢 모기업 사정 — 기업구단이면 이사회의 지갑이 모기업 실적을 그대로 따라간다 */
  try{ if(c.ct && c.ct.k==="corp"){
    const _h=ownHealth(c.t);
    if(Math.abs(_h-1)>0.04) p += add(`모기업 ${ownLabel(c.t).t} (${Math.round(_h*100)}%)`, clamp((_h-1)*0.60, -0.24, 0.20));
  } }catch(e){}
  if(c.pre){
    // 성적이 없는 시기 — 대신 연습경기 내용과 목표의 무게를 본다
    const pr=c.preRec||{w:0,d:0,l:0}, pn=pr.w+pr.d+pr.l;
    if(pn>=2) p += add("연습경기 성적", clamp((pr.w-pr.l)/pn, -1, 1)*0.12);
    if(c.goalTier==="insane"||c.goalTier==="bold") p += add("높게 잡은 목표", 0.10);
    if(c.openIn>35) p += add("개막이 아직 멀다", -0.12);
  } else {
    p += add("리그 순위", (0.5-c.posPct)*0.50);
    p += add("최근 5경기", clamp((c.recent-1.2)/1.8, -0.16, 0.20));
  }
  const e = arg.ev(c);
  p += add("논거의 설득력", e.s*0.30);
  // ── 상황 보정
  if(kind==="budget" && !c.winOpen) p += add("이적시장 마감", -0.16);
  if(kind==="budget" && !c.pre && c.roundsLeft<=3) p += add("시즌 막바지", -0.14);
  if(kind==="youth") p += add("장기 투자", 0.06);
  if(c.ct.k==="corp") p += add("모기업 결단", 0.07);
  if(c.ct.k==="army") p += add("군 예산 경직성", -0.16);
  if(c.ct.k==="civic"||c.ct.k==="mixed") p += add("의회 심의 부담", -0.04);
  if(!c.pre && c.tenure<8) p += add("부임 초기", -0.09);
  if(c.pre && (G.day||0)<28) p += add("부임 직후", -0.14);
  if(c.t.budget > budPool(c.t)*0.65) p += add("이미 남은 예산", -0.12);
  if(wageRoom(c.t) < 0) p += add("연봉 상한 초과", -0.10);
  if(c.approved>0) p += add("올 시즌 이미 승인받음", -0.11*c.approved);
  if(c.fanTrust<=40 && (c.ct.k==="civic"||c.ct.k==="mixed")) p += add("싸늘한 시민 여론", -0.09);
  if(arg.k==="ultimatum") p += add("최후통첩 리스크", -0.10);
  p *= arg.w;
  const out=clamp(p, 0.03, 0.90);
  if(detail){ detail.parts=B.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])); detail.ev=e; }
  return out;
}
/* ── 요청 진행 상태 ── */
function reqState(){
  if(!G.req) G.req={cool:{}, pend:null, used:0, s:G.season};
  if(!G.req.cool) G.req.cool={};
  if(G.req.s!==G.season){ G.req.s=G.season; G.req.used=0; G.req.okCount=0; G.req.cool={}; }   // 시즌이 바뀌면 초기화
  if(G.req.used==null) G.req.used=0;
  return G.req;
}
/* 같은 종류를 다시 올릴 수 있을 때까지 남은 날. 거절당했으면 더 오래 기다려야 한다. */
function reqCoolLeft(kind){
  const r=reqState(), c=r.cool[kind];
  if(c==null) return 0;
  const day = typeof c==="object" ? c.d : c;
  const need = (typeof c==="object" && c.no) ? REQ_COOL_NO : REQ_COOL;
  return Math.max(0, need-((G.day||0)-day));
}
function reqUsedLeft(){ return Math.max(0, REQ_MAX_SEASON-reqState().used); }
/* 논거가 지금 시기에 성립하는가 — 한 경기도 안 치른 프리시즌에 "상승세를 굳히자"는 말이 안 된다 */
function argInSeason(a, c){
  if(a.if && !a.if(c)) return false;      // 조건부 논거 — 상황이 아니면 목록에 안 뜬다
  if(a.only==="pre") return !!c.pre;
  if(a.only==="season") return !c.pre;
  return true;
}
/* 예산 증액을 요구할 수 있는 시점인가.
   1월 1일에 부임하자마자 증액을 요구하는 건 현실에서도 게임에서도 말이 안 된다 —
   구단은 이미 그 해 예산을 확정해 둔 상태다. */
const REQ_MIN_DAY=21;           // 1월 22일부터 (부임 3주 뒤)
function reqOpenState(){
  const day=G.day||0;
  if(G.phase==="sacked") return {ok:false, why:"지휘할 팀이 없습니다."};
  if(G.phase==="seasonEnd") return {ok:false, why:"시즌이 끝났습니다. 다음 시즌 예산은 새로 편성됩니다."};
  /* 🏳️ 매각 절차 중 — 결재할 주인이 없다 */
  try{ if(clubForSale(userTeam())){
    const _r=saleState()[userTeam().id];
    return {ok:false, why:`구단이 <b>매각 절차</b> 중입니다 — 예산을 결재할 주인이 없습니다. 인수 결론은 <b>${dateLabel(_r.due)}</b>에 나옵니다.`};
  } }catch(e){}
  if(day<REQ_MIN_DAY) return {ok:false,
    why:`구단은 이미 올해 예산을 확정해 둔 상태입니다. <b>${dateLabel(REQ_MIN_DAY)}</b>부터 증액을 요구할 수 있습니다. (D-${REQ_MIN_DAY-day})`};
  return {ok:true};
}
function reqPending(){ const r=reqState(); return r.pend; }
/* 시의회 심의는 시간이 걸린다 — 매일 stepDay에서 확인 */
function tickBudgetRequest(){
  const r=reqState(); const p=r.pend;
  if(!p) return null;
  if((G.day||0) < p.due) return null;
  r.pend=null;
  return resolveBudgetRequest(p);
}
function openBudgetRequest(){
  const c=reqCtx(); if(!c) return;
  if(reqPending()){ boardModal("심의 진행 중", `<p>이미 올린 안건이 처리를 기다리고 있습니다. <b>${dateLabel(reqPending().due)}</b>에 결과가 나옵니다.</p>`); return; }
  const gate=reqOpenState();
  if(!gate.ok){ boardModal("아직은 때가 아닙니다",
    `<p>${gate.why}</p><p class="small">"감독님, 부임하시자마자 예산 이야기부터 하시면 곤란합니다.
       선수단부터 파악하시고, 필요한 게 뭔지 정리해서 오십시오."</p>`); return; }
  if(reqUsedLeft()<=0){ boardModal("올해는 여기까지", `<p>한 시즌에 올릴 수 있는 안건은 <b>${REQ_MAX_SEASON}건</b>입니다. 올해 몫을 모두 썼습니다.</p>
    <p class="small">"감독님, 이미 세 번이나 올렸습니다. 더는 명분이 서지 않습니다. 다음 시즌에 다시 이야기하시죠."</p>`); return; }
  reqUI={kind:null, arg:null};
  renderBudgetRequest();
}
let reqUI=null;
function reqPick(k,v){ if(!reqUI) return; reqUI[k]= reqUI[k]===v ? null : v; renderBudgetRequest(); }
function reqClose(){ reqUI=null; const box=$("#gcModal"); if(box){ box.className="hidden"; box.innerHTML=""; } }
function renderBudgetRequest(){
  const c=reqCtx(); if(!c||!reqUI) return;
  const box=$("#gcModal"); if(!box) return;
  const ct=c.ct;
  const civic = ct.k!=="corp";
  const body = civic
    ? `<b style="color:${ct.c}">${ct.ic} ${ct.n}</b> — 예산은 <b>${ct.o}</b>에서 나옵니다.
       구단이 결정할 수 있는 게 아니라, <b>시·도의회 추가경정예산</b> 심의를 통과해야 집행됩니다.`
    : `<b style="color:${ct.c}">${ct.ic} ${ct.n}</b> — <b>${ct.o}</b> 이사회에 안건을 올립니다. 그 자리에서 결론이 납니다.`;
  const armyLock=(k)=>isArmyTeam(c.t) && (k==="youth"||k==="scout");
  const kindBtn=(k)=>{
    const K=REQ_KIND[k], cool=reqCoolLeft(k);
    if(armyLock(k)) return `<button class="mini reqOpt" disabled>
      <b>${K.ic} ${K.n}</b> <span class="reqAmt">군 규정상 불가</span>
      <div class="small">🎖️ 국군체육부대에는 ${k==="youth"?"유스 아카데미":"해외 스카우트"}를 둘 수 없습니다.</div></button>`;
    /* 예산은 금액을, 시설류는 "지금 등급 → 다음 등급"을 보여 준다 — 무엇이 어떻게 변하는지 명확하게 */
    const lvOf={youth:c.t.youthLv||1, train:trainLv(c.t), scout:scoutLv(c.t)}[k];
    const lvMax = k==="scout" ? 5 : FAC_MAX;   // 🔟 유스·훈련시설은 10단계
    const maxed = lvOf!=null && lvOf>=lvMax;
    let tail;
    if(k==="budget") tail=`<span class="reqAmt">+${reqAmount(k,c)}억</span>`;
    else if(k==="scout") tail=`<span class="reqAmt">${maxed?"최고 등급":`${"◆".repeat(lvOf)}${"◇".repeat(5-lvOf)} → ${lvOf+1}등급`}</span>`;
    else tail=`<span class="reqAmt">${maxed?"최고 등급":`${facStars(lvOf)} → ${lvOf+1}등급`}</span>`;
    return `<button class="mini reqOpt ${reqUI.kind===k?"sel":""}" ${(cool||maxed)?"disabled":""} onclick="reqPick('kind','${k}')">
      <b>${K.ic} ${K.n}</b> ${tail}
      <div class="small">${cool?`⏳ ${cool}일 뒤 다시 요청할 수 있습니다`:maxed?"더 올릴 곳이 없습니다 — 리그 최고 수준입니다":K.d}</div></button>`;
  };
  const args=reqUI.kind ? REQ_ARG.filter(a=>a.kinds.indexOf(reqUI.kind)>=0 && argInSeason(a, c)) : [];
  const argBtn=(a)=>{
    const e=a.ev(c);
    const lv = e.s>=0.45?["강력한 근거","ok"] : e.s>=0.12?["근거 있음","ok"] : e.s>=-0.15?["근거 부족","mid"] : ["역효과 우려","no"];
    return `<button class="mini reqOpt ${reqUI.arg===a.k?"sel":""}${a.danger?" danger":""}" onclick="reqPick('arg','${a.k}')">
      <b>${a.n}</b> <span class="reqFit ${lv[1]}">${lv[0]}</span>
      <div class="small reqSay">"${F_(a.say,{goal:c.goal})}"</div>
      ${e.why.length?`<div class="reqWhy">${e.why.map(x=>`<span>${x}</span>`).join("")}</div>`
                    :`<div class="reqWhy"><span class="dim">내세울 근거가 없습니다</span></div>`}</button>`;
  };
  const arg = reqUI.arg ? REQ_ARG.find(a=>a.k===reqUI.arg) : null;
  const ready = reqUI.kind && arg;
  const det = {};
  const ch = ready ? reqChance(reqUI.kind, arg, c, det) : 0;
  const chN = ch>=0.65?"긍정적" : ch>=0.42?"반반" : ch>=0.22?"회의적" : "부정적";
  const chC = ch>=0.65?"var(--green)" : ch>=0.42?"var(--gold)" : "var(--red)";
  box.className="";
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox reqBox">
    <div class="gcBody">
      <h3 style="margin-top:0">${civic?"🏛️":"🏢"} ${civic?ct.o+"에 제안":"구단 프런트에 제안"}</h3>
      <p class="small">${body}</p>
      <div class="reqStat">
        <span>순위 <b>${c.pos}위</b>/${c.N}</span><span>구단주 신뢰 <b>${Math.round(c.ownTrust)}</b></span>
        <span>최근 5경기 <b>${(c.t.form||[]).slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")||"-"}</b></span>
        <span>이적 예산 <b class="money">${c.budget}억</b></span>
        <span>올 시즌 요청 <b style="color:${reqUsedLeft()<=1?"var(--red)":"#f0f6fc"}">${reqState().used}/${REQ_MAX_SEASON}회</b></span>
      </div>
      <h4>1. 무엇을 요청합니까?</h4>
      <div class="reqList">${Object.keys(REQ_KIND).map(kindBtn).join("")}</div>
      ${reqUI.kind?`<h4>2. 어떤 논리로 설득합니까?</h4><div class="reqList">${args.map(argBtn).join("")}</div>`:""}
      ${ready?`<div class="msg ${ch>=0.5?"good":ch>=0.3?"info":"warn"}" style="margin-top:10px">
        예상 반응: <b style="color:${chC}">${chN}</b>
        <div class="reqBreak">${(det.parts||[]).slice(0,6).map(([n,v])=>
          `<span class="${v>0?"up":"dn"}">${n} ${v>0?"▲":"▼"}</span>`).join("")}</div>
        ${arg.danger?`<br><span style="color:var(--red)">⚠️ 최후통첩은 구단주 신뢰를 크게 깎습니다. 거절당하면 자리가 위태로워집니다.</span>`:""}
        ${civic?`<br><span class="small">추경안이 상정되면 결과가 나오기까지 며칠 걸립니다.</span>`:""}</div>`:""}
    </div>
    <div class="gcBtns">
      <button class="gcOk" ${ready?"":"disabled"} onclick="submitBudgetRequest()">📨 안건 올리기</button>
      <button class="mini" onclick="reqClose()">취소</button>
    </div>
  </div></div>`;
}
function submitBudgetRequest(){
  const c=reqCtx(); if(!c||!reqUI||!reqUI.kind||!reqUI.arg) return;
  const kind=reqUI.kind, arg=REQ_ARG.find(a=>a.k===reqUI.arg);
  const amt=reqAmount(kind,c), ch=reqChance(kind,arg,c);
  const r=reqState();
  const ok=Math.random()<ch;
  r.cool[kind]={d:G.day||0, no:!ok};        // 거절이면 더 긴 쿨다운
  r.used=(r.used||0)+1;                      // 시즌 한도 소진
  const pend={kind, arg:arg.k, amt, ok, due:(G.day||0)};
  reqClose();
  if(c.ct.k==="corp"){ resolveBudgetRequest(pend); return; }   // 이사회는 그 자리에서 답한다
  // 시민구단 — 추경안 상정. 며칠 뒤 의회에서 결론이 난다.
  pend.due=(G.day||0)+2+R(4);
  r.pend=pend;
  addNews(`🏛️ ${c.t.name}, ${c.ct.o}에 <b>${REQ_KIND[kind].n}</b> 추가경정예산안 상정 (${amt}억) — 심의 결과는 ${dateLabel(pend.due)} 발표`,
    null, "club", {cat:"club", ic:"🏛️", tid:c.t.id,
      head:`${c.t.name}, ${amt}억 규모 추경안 상정`,
      sub:`${c.ct.o} 의회가 ${dateLabel(pend.due)} 심의에 들어간다. 통과 여부에 따라 겨울 계획이 갈린다.`});
  boardModal("🏛️ 추경안 상정",
    `<p>구단은 <b>${c.ct.o}</b>에 <b>${REQ_KIND[kind].n}</b>(${amt}억) 추가경정예산안을 올렸습니다.</p>
     <p class="small">"감독님 말씀은 잘 전달하겠습니다. 다만 이건 구단이 결정할 수 있는 문제가 아닙니다.
        의회 심의를 거쳐야 하고, 시민 여론도 봐야 합니다."</p>
     <p><b>${dateLabel(pend.due)}</b>에 결과가 나옵니다.</p>`);
}
/* ═══════════════════════════════════════════════════════════════
   타 구단의 예산 증액
   감독만 돈을 요구하는 게 아니다. 옆 동네 구단도 모기업을 조르고, 시의회에 추경안을 올린다.
   그 결과가 실제로 그 구단 예산에 반영되니 이적시장의 판도가 바뀌고, 우리 팬은 배가 아프다.
═══════════════════════════════════════════════════════════════ */
const AI_BUD_CHANCE=0.055;      // 하루에 리그 전체에서 이 정도 확률로 한 건
function aiBudgetChance(t){
  const ct=clubType(t);
  const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1, N=tbl.length||12;
  let w=1;
  if(ct.k==="corp") w*=1.55*ownBudK(t);            // 🏢 모기업이 있으면 자주 움직인다 — 다만 그 «사정»을 탄다
  else if(ct.k==="army") w*=0.25;                  // 군경팀은 예산을 못 늘린다
  if(pos>0){
    if(pos<=3) w*=1.45;                            // 우승·승격 경쟁이면 지른다
    else if(pos>=N-1) w*=1.30;                     // 강등 위기면 급해서 지른다
    else w*=0.75;
  }
  const played=(t.W||0)+(t.Dw||0)+(t.L||0);
  if(played<3) w*=0.8;
  if(transferOpen()) w*=1.9;                        // 시장이 열려 있을 때 몰린다
  else w*=0.35;
  return w;
}
/* 하루에 한 번 굴린다 — 성사되면 그 구단 예산이 실제로 늘어난다 */
function tickAiBudget(){
  const ut=userTeam(); if(!ut || G.phase==="sacked") return null;
  if((G.day||0) < 14) return null;                  // 시즌 초입엔 아직 조용하다
  if(!G.aiBud) G.aiBud={s:G.season, last:{}, n:0};
  if(G.aiBud.s!==G.season){ G.aiBud={s:G.season, last:{}, n:0}; }
  if(Math.random() > AI_BUD_CHANCE) return null;
  const pool=Object.values(G.teams).filter(t=>!t.isUser && !isArmyTeam(t) &&
    ((G.day||0)-(G.aiBud.last[t.id]||-999)) >= 45);  // 같은 구단이 연달아 받지는 않는다
  if(!pool.length) return null;
  // 가중 추첨
  const ws=pool.map(t=>aiBudgetChance(t));
  const tot=ws.reduce((a,b)=>a+b,0); if(tot<=0) return null;
  let r=Math.random()*tot, pick=pool[0];
  for(let i=0;i<pool.length;i++){ r-=ws[i]; if(r<=0){ pick=pool[i]; break; } }
  const ct=clubType(pick);
  if(ct.k==="army") return null;
  /* 🏢 모기업이 어려우면 증액 폭도 줄어든다 */
  const amt=Math.round(Math.max(2, budPool(pick)*(0.10+Math.random()*0.14)*ownBudK(pick))*10)/10;
  pick.budget=Math.round((pick.budget+amt)*10)/10;
  pick._pool=budPool(pick)+amt;
  G.aiBud.last[pick.id]=G.day||0; G.aiBud.n++;
  announceAiBudget(pick, ct, amt);
  return {team:pick, amt, kind:ct.k};
}
/* 기사와 여론 — 우리 팬은 배가 아프고, 남의 팬은 부러워하거나 세금 이야기를 꺼낸다 */
function announceAiBudget(t, ct, amt){
  const ut=userTeam();
  const civic = ct.k!=="corp";
  const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1;
  const sameDiv = ut && ut.div===t.div;
  const derby = ut && isRival(ut.id, t.id);
  const V={t:t.short, tn:t.name, o:ct.o, m:amt};
  const head = civic
    ? `${ct.o}, ${t.name}에 ${amt}억 추경 편성`
    : `${t.name}, ${ct.o}으로/로부터 ${amt}억 추가 지원 확보`;
  pushFeed({cat:"transfer", ic:civic?"🏛️":"🏢", tone:sameDiv?-1:0, tid:t.id, head:fixJosa(head),
    sub:`${divName(t.div)} ${pos>0?pos+"위 ":""}${t.short}이/가 겨울 보강 실탄을 확보했다.`
        + (civic?" 지역 사회 일각에서는 세금 사용을 두고 논란이 예상된다.":"")
        + (sameDiv?` 같은 리그 경쟁 구단으로서는 반갑지 않은 소식이다.`:""),
    src:pick(MEDIA)});
  // 우리 팬 — 같은 리그면 더 예민하고, 라이벌이면 폭발한다
  if(sameDiv){
    const pool = derby ? SOC.aiBudDerby : civic ? SOC.aiBudTax : SOC.aiBudCorp;
    socialFill(pool, 2+R(2), -1, V);
    if(Math.random()<0.6) fmkFill(civic?FMK.aiBudTax:FMK.aiBudCorp, 1+R(2), V);
  }
  // 남의 팬들 — 그 구단 팬은 신났고, 제3자는 시큰둥하거나 세금을 꺼낸다
  rivalFill(civic?RIV.aiBudTax:RIV.aiBudCorp, 1+R(2), 0, V);
  if(Math.random()<0.45) rivalFmk(civic?FRIV.aiBudTax:FRIV.aiBudCorp, 1+R(2), V);
}
/* 재정 탭의 요청 버튼 — 구단 형태에 따라 문구가 다르다 */
function reqButton(t){
  const ct=clubType(t), civic=ct.k!=="corp";
  const p=reqPending();
  if(p) return `<div class="msg info" style="margin:10px 0 0;padding:8px 10px">
    🏛️ <b>${REQ_KIND[p.kind].n} 추경안 심의 중</b> (${p.amt}억)
    <div class="small">${ct.o} 의회 결과 발표 — ${dateLabel(p.due)} (D-${Math.max(0,p.due-(G.day||0))})</div></div>`;
  const left=reqUsedLeft();
  const allCool=Object.keys(REQ_KIND).every(k=>reqCoolLeft(k)>0);
  const gate=reqOpenState();
  const off=left<=0||allCool||!gate.ok;
  const wait=Math.min(...Object.keys(REQ_KIND).map(k=>reqCoolLeft(k)).filter(x=>x>0).concat([99]));
  return `<button class="mini reqBtn" ${off?"disabled":""} onclick="openBudgetRequest()">
      ${civic?"🏛️":"🏢"} <b>${civic?`${ct.o}에 제안`:"구단 프런트에 제안"}</b>
      <span class="small" style="opacity:.75;display:block;margin-top:2px">예산 증액 · 유스 · 훈련시설 · 스카우팅</span>
      <span class="reqAmt" style="color:${left<=1?"var(--red)":"var(--gold)"}">${reqState().used}/${REQ_MAX_SEASON}회</span></button>
    <p class="small" style="margin:5px 0 0">${
      !gate.ok ? gate.why
      : left<=0 ? `올 시즌 요청 한도(${REQ_MAX_SEASON}회)를 모두 썼습니다. 다음 시즌에 다시 올릴 수 있습니다.`
      : allCool ? `최근에 올린 안건이 있습니다. ${wait}일 뒤에 다시 요청할 수 있습니다.`
      : civic ? "시·도의회 추가경정예산 심의를 거칩니다. 며칠 걸리고, 통과해도 여론이 따라붙습니다."
              : `${ct.o} 이사회에 안건을 올립니다. 그 자리에서 답이 나옵니다.`}</p>`;
}
/* 이사회·의회의 답변 문구 */
const REQ_SAY={
 corpOk:[
  "감독님 의견에 전적으로 동의합니다. 최근 팀의 상승세를 보면 지금이 투자할 때가 맞습니다.",
  "이사회도 같은 판단을 했습니다. 요청하신 규모로 집행하겠습니다. 결과로 보여 주십시오.",
  "모기업 승인까지 받았습니다. 이 돈이 순위로 돌아오길 기대하겠습니다."],
 corpNo:[
  "감독님의 야망은 높이 삽니다. 다만 지금 구단의 현금 흐름으로는 무리입니다. 주어진 예산 안에서 최선을 내주십시오.",
  "본사 기조가 긴축입니다. 올해는 어렵습니다. 다음 분기에 다시 이야기하시죠.",
  "숫자가 설득이 안 됩니다. 성적으로 먼저 보여 주시면 그때 다시 검토하겠습니다."],
 civicOk:[
  "추경안이 본회의를 통과했습니다. 다만 시민 세금이라는 점, 감독님도 알고 계시리라 믿습니다.",
  "표결 끝에 가결됐습니다. 반대 의견도 만만치 않았습니다. 성적으로 답해 주셔야 합니다.",
  "의회가 '지역 스포츠 진흥'이라는 명분을 받아들였습니다. 집행은 다음 주부터 가능합니다."],
 civicNo:[
  "추경안이 부결됐습니다. '민생 예산이 먼저'라는 반대 논리를 넘지 못했습니다.",
  "상임위에서 계류됐습니다. 올해 안에 다시 올리기는 어려울 것 같습니다.",
  "표결까지 갔지만 부결입니다. 시민 여론이 좋지 않았다는 게 결정적이었습니다."],
 armyOk:[
  "국방부 협의가 끝났습니다. 예외적으로 편성해 드립니다.",
  "부대 운영 계획 안에서 조정이 가능했습니다. 이번 한 번뿐입니다."],
 armyNo:[
  "군 예산은 감독 요청으로 움직이지 않습니다. 정해진 편성 안에서 운영하십시오.",
  "규정상 불가합니다. 이 부분은 논의 대상이 아닙니다."]
};
/* 요청 결과 확정 — 예산 반영, 신뢰도, 뉴스, 여론 */
function resolveBudgetRequest(p){
  const t=userTeam(); if(!t) return null;
  const ct=clubType(t), K=REQ_KIND[p.kind], arg=REQ_ARG.find(a=>a.k===p.arg)||REQ_ARG[0];
  const civic = ct.k!=="corp", army = ct.k==="army";
  const V={t:t.short, o:ct.o, m:p.amt, k:K.n};
  const say = pick(army ? (p.ok?REQ_SAY.armyOk:REQ_SAY.armyNo)
                        : civic ? (p.ok?REQ_SAY.civicOk:REQ_SAY.civicNo)
                                : (p.ok?REQ_SAY.corpOk:REQ_SAY.corpNo));
  let fx=[];
  if(p.ok){
    const st=reqState(); st.okCount=(st.okCount||0)+1;    // 올 시즌 몇 번 받아냈나 — 다음 요청이 그만큼 어려워진다
    if(p.kind==="budget"){ t.budget=Math.round((t.budget+p.amt)*10)/10; t._pool=(budPool(t)+p.amt); fx.push(`이적 예산 +${p.amt}억`); }
    else if(p.kind==="scout" && !isArmyTeam(t)){
      t.scoutLv=clamp(scoutLv(t)+1, 1, SCOUT_MAX);
      if(G.scout) G.scout.key="";                    // 등급이 올랐으니 다음 창부터 보고서가 달라진다
      fx.push(`스카우팅 등급 ${t.scoutLv}단계 (동시 파견 ${t.scoutLv}곳)`);
    }
    else if(p.kind==="train"){ t.trainLv=clamp(trainLv(t)+1,1,FAC_MAX); fx.push(`훈련시설 ${t.trainLv}등급`); }
    else if(!isArmyTeam(t)){ t.youthLv=clamp((t.youthLv||1)+1,1,FAC_MAX); fx.push(`유스 등급 ${t.youthLv}단계`); }
    adjustTrust("owner", civic?-2:1, `${K.n} 승인 (${p.amt}억)`);
  } else {
    adjustTrust("owner", arg.danger?-14:-3, `${K.n} 요청 거절${arg.danger?" (최후통첩)":""}`);
    if(arg.danger) fx.push("구단주 신뢰 급락");
  }
  /* 여론 — 시민구단의 추경은 세금 이야기가 따라붙는다 */
  /* ⚠ 여기서 예외가 나면 아래 결과 팝업까지 못 간다 — 여론은 곁가지다. 감싸 둔다. (제보) */
  try{
    if(p.ok){
      if(civic && !army){
        adjustTrust("fans", -3, "시민 세금 추경 논란");
        socialFill(SOC.taxOk, 3+R(2), 0, V); fmkFill(FMK.taxOk, 2+R(2), V);
        rivalFill(RIV.taxOk, 2+R(2), 0, V); rivalFmk(FRIV.taxOk, 1+R(2), V);
      } else {
        socialFill(SOC.budgetOk, 2+R(2), 1, V); fmkFill(FMK.budgetOk, 1+R(2), V);
        if(Math.random()<0.5) rivalFill(RIV.budgetOk, 1+R(2), 1, V);
      }
    } else {
      socialFill(civic?SOC.taxNo:SOC.budgetNo, 2+R(2), -1, V);
      if(Math.random()<0.6) fmkFill(FMK.budgetNo, 1+R(2), V);
    }
  }catch(e){ try{ console.warn("예산 요청 여론 반영 실패:", e); }catch(_){} }
  /* 기사 */
  const head = p.ok
    ? (civic&&!army ? `${ct.o}, ${t.name} ${K.n} ${p.amt}억 추경 가결`
                    : `${t.name}, ${ct.o} 승인으로 ${K.n} ${p.amt}억 확보`)
    : (civic&&!army ? `${ct.o} 의회, ${t.name} ${p.amt}억 추경안 부결`
                    : `${t.name} ${K.n} 요청 무산… ${ct.o} "지금은 어렵다"`);
  try{ addNews(`${p.ok?"✅":"❌"} ${head}`, null, "club",
    {cat:"club", ic:p.ok?(civic?"🏛️":"🏢"):"❌", tid:t.id, head,
     sub:`"${say}"${p.ok&&civic&&!army?" · 시민 사회 일각에서는 세금 사용을 두고 반발이 나오고 있다.":""}`});
  }catch(e){ try{ console.warn("예산 요청 기사 발행 실패:", e); }catch(_){} }
  /* 결과 화면 */
  boardModal(`${p.ok?"✅":"❌"} ${civic&&!army?"추경 심의 결과":"이사회 답변"}`,
    `<div class="msg ${p.ok?"good":"warn"}"><b>${K.ic} ${K.n}</b> — ${p.amt}억 · <b>${p.ok?"승인":"거절"}</b></div>
     <p class="reqSay" style="font-size:14px">"${say}"</p>
     ${fx.length?`<p class="small" style="color:#dbe3ea">${fx.join(" · ")}</p>`:""}
     ${p.ok&&civic&&!army?`<p class="small" style="color:#ff9d95">⚠️ 시민 세금이 투입된 만큼, 성적이 나오지 않으면 여론이 등을 돌립니다. (팬 신뢰 -3)</p>`:""}
     ${!p.ok?`<p class="small" style="color:#a9b4c0">같은 안건은 <b>${REQ_COOL_NO}일</b> 뒤에 다시 올릴 수 있습니다. (올 시즌 ${reqState().used}/${REQ_MAX_SEASON}회 사용)</p>`:""}
     ${!p.ok&&arg.danger?`<p class="small" style="color:#ff9d95">⚠️ 최후통첩이 받아들여지지 않았습니다. 구단주 신뢰가 크게 떨어졌습니다.</p>`:""}`,
    p.ok?"":"danger");
  saveGame();
  return p;
}
/* ── 홈구장 · 흥행 카드 ─────────────────────────── */
function stadiumCard(t){
  const sd=stadOf(t), fin=finLedger(t);
  const avg=avgAtt(t), hy=hypeOf(t);
  const fill=avg?Math.round(avg/sd.cap*100):0;
  const hyN = hy>=1.22?"뜨겁다" : hy>=1.06?"좋다" : hy>=0.94?"평범" : hy>=0.82?"식었다" : "차갑다";
  const hyC = hy>=1.06?"var(--green)" : hy>=0.94?"var(--gold)" : "var(--red)";
  const ct=clubType(t);
  // 시즌권 창구가 열려 있으면 판매 현황을 실시간으로 보여 준다
  const w=stWindow(), selling=!t.stClosed && stIsOpen();
  const stLine = selling
    ? `<div class="msg info" style="margin:8px 0 0;padding:7px 9px">🎫 <b>시즌권 판매 중</b> — ${(t.seasonTix||0).toLocaleString()}장
        <span class="small">(목표 ${(t.stTarget||0).toLocaleString()}장 · ${dateLabel(w.close)} 마감, D-${Math.max(0,w.close-(G.day||0))})</span>
        <div class="attrRow" style="margin-top:4px"><div class="ab"><div class="af" style="width:${Math.round((t.seasonTix||0)/Math.max(1,t.stTarget||1)*100)}%;background:var(--gold)"></div></div></div></div>`
    : "";
  return `<div class="card"><h3>🏟️ ${sd.n}</h3>
    <div style="font-size:22px;font-weight:800">${avg?avg.toLocaleString():"–"}<span class="small" style="font-weight:400"> 명 / 경기</span></div>
    <div class="attrRow" style="margin-top:6px"><div class="ab"><div class="af" style="width:${Math.min(100,fill)}%;background:var(--acc)"></div></div><span class="av">${fill}%</span></div>
    <p class="small" style="margin-top:4px">수용 <b style="color:#fff">${sd.cap.toLocaleString()}</b>석 · 시즌권 <b style="color:#fff">${(t.seasonTix||0).toLocaleString()}</b>장
      · 흥행 <b style="color:${hyC}">${hyN}</b><br>
      <span style="color:${ct.c};font-weight:700">${ct.ic} ${ct.n}</span> · ${ct.o}
      ${fin.best?`<br>최다 관중 <b style="color:#fff">${fin.best.toLocaleString()}</b>명 (${fin.bestOpp}전)`:""}</p>
    ${stLine}</div>`;
}
function gateCard(t){
  const fin=finLedger(t);
  /* ⚠ 제보 — 「상금, ACL 칸을 K리그1(또는 K리그2)·EACL·CWC 상금으로 명칭 변경해 달라」.
     겸사겸사 — 누적 합계에 대회 상금(aclMoney·cwcMoney)이 빠져 있던 것도 함께 넣는다. */
  /* 🌏 제보 — 커리어 누적(t.aclMoney)이 아니라 이번 시즌 몫(fin.acl)을 더한다.
     예전에는 여러 시즌 상금을 합친 값이 「이번 시즌 수입」에 찍혔다(1676억 사건). */
  const _acl=(fin.acl!=null)?fin.acl:0, _cwc=(fin.cwc!=null)?fin.cwc:0;
  const total=Math.round((fin.st+fin.gate+fin.tv+fin.prize+(fin.spon||0)+(fin.fac||0)+_acl+_cwc)*10)/10;   // 🏪 시설 수입 포함
  const row=(ic,n,v,d)=>`<tr><td>${ic} ${n}</td><td style="text-align:right;font-weight:800;color:#fff">${Math.round(v*10)/10}억</td><td class="small">${d}</td></tr>`;
  /* 💸 요청(배선) — 체불 중이면 재정 화면 맨 위에서 먼저 알린다 */
  const _wa=(function(){ try{ const a=waOf(t.id); if(!a) return "";
    return `<div class="msg warn" style="margin-bottom:8px">💸 <b>임금 체불 ${a.m|0}개월</b> — 누적 <b>${a.tot}억</b>.
      ${waSanctioned(t.id)?'<b style="color:var(--red)">연맹 제재로 선수 등록이 금지된 상태입니다.</b> ':""}
      이적 예산이 체불액 + 이번 달 급여(약 ${waMonthly(t)}억)를 넘기면 달이 바뀌는 날 한 번에 지급되고 풀립니다.</div>`;
    }catch(e){ return ""; } })();
  return `${_wa}<div class="card"><h3>💰 ${G.season} 시즌 수입 <span class="small">— 누적 <b style="color:var(--green)">${total}억</b></span></h3>
    <table style="width:100%">
      ${row("🤝","스폰서", fin.spon||0, `${sponSlots().filter(k=>sponOf(t)[k]).length}개 계약 · 매력도 ${sponAppeal(t)}`)}
      ${row("🎫","시즌권", fin.st, `${(t.seasonTix||0).toLocaleString()}장 · 개막 전 일괄 수령`)}
      ${row("🎟️","입장·부대 수입", fin.gate, `홈 ${fin.att.length}경기 · 당일권 + MD·식음료`)}
      ${(fin.fac||0)>0?row("🏪","시설 수입", fin.fac, "푸드트럭·편의점·굿즈샵·펍·박물관 순수익"):""}
      ${row("📺","중계권·분배금", fin.tv, `라운드당 ${TV_ROUND[fin.div||t.div]||0.25}억`)}
      ${row("🏆",divName(fin.div||t.div)+" 상금", fin.prize, "시즌 종료 시 순위별 지급")}
      ${_acl>0?row("🌏",(typeof eaclShort==="function"?eaclShort():"EACL")+" 상금", _acl, `승리·라운드 진출·우승 수당 (시즌 상한 ${EACL_CAP_SEASON}억)${(t.aclMoney||0)>_acl?` · 커리어 누적 ${t.aclMoney}억`:""}`):""}
      ${_cwc>0?row("🌍",(typeof cwcShort==="function"?cwcShort():"CWC")+" 상금", _cwc, `참가·승리·라운드 진출 수당${(t.cwcMoney||0)>_cwc?` · 커리어 누적 ${t.cwcMoney}억`:""}`):""}
    </table>
    ${(()=>{ const h=hypeOf(t), sd=stadOf(t);
      const lv = h>=1.20?["매우 뜨겁다","var(--green)"] : h>=1.07?["달아오르는 중","#7ee787"]
               : h>=0.95?["평범","var(--gold)"] : h>=0.85?["식어가는 중","#e8813a"] : ["차갑다","var(--red)"];
      const pct=Math.round((h-1)*100);
      return `<div class="msg info" style="margin:8px 0">📊 <b>흥행 지수</b> <b style="color:${lv[1]}">${lv[0]}</b>
        <span class="small">(${pct>=0?"+":""}${pct}% · 기준 관중 ${sd.avg.toLocaleString()}명 → 약 ${Math.round(sd.avg*h*ATT_NORM/100)*100}명)</span><br>
        <span class="small">이기면 오르고 크게 지면 떨어집니다. 좋은 선수를 데려와도 오르고, 핵심 선수를 팔면 내려갑니다.
        ${t.isUser&&G.trust?`팬 신뢰도(${Math.round(G.trust.fans)})도 당일권 판매에 함께 반영됩니다.`:""}</span></div>`;})()}
    <p class="small" style="margin-top:6px">관중 1명당 티켓 약 <b style="color:#fff">${Math.round(TICKET_UNIT*1e8).toLocaleString()}원</b>,
      부대 수입 약 <b style="color:#fff">${Math.round(MD_UNIT*1e8).toLocaleString()}원</b>.
      성적이 좋아지면 관중이 늘고, 관중이 늘면 예산이 늘어납니다.<br>
      수입의 대부분은 연봉·운영비로 나가고, <b style="color:var(--gold)">${Math.round(BUD_SHARE*100)}%</b>인
      <b class="money">${Math.round((fin.toBudget||0)*10)/10}억</b>만 이적 예산으로 들어왔습니다.</p>
    ${fin.log.length?`<h4 style="margin:12px 0 4px">최근 홈경기</h4>
    <div class="tblScroll"><table><tr><th>날짜</th><th>상대</th><th>결과</th><th style="text-align:right">관중</th><th style="text-align:right">수입</th></tr>
    ${fin.log.slice(0,10).map(x=>`<tr><td class="small">${dateLabel(x.d)}</td><td>${x.opp}</td><td>${x.res}</td>
      <td style="text-align:right;font-weight:700">${x.att.toLocaleString()}${x.sell?' <span class="tag star">매진</span>':""}</td>
      <td style="text-align:right" class="money">${x.gate}억</td></tr>`).join("")}</table></div>`:""}
  </div>`;
}
