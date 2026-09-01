"use strict";
/* ═══════════════════════════════════════════════════════════════
   감독의 사생활 — 연봉, 집, 부동산, 쇼핑
   FM은 감독 연봉을 숫자로만 보여 주고 끝난다. 몇 억을 받든 쓸 데가 없으니 의미가 없다.
   여기서는 실제로 쓴다. 좋은 집에 살면 위신이 붙어 선수 설득과 재계약이 쉬워지고,
   부동산은 매달 임대수익과 시세 차익을 낳고, 선물은 선수의 마음과 몸을 움직인다.
   ⚠ 구단 예산(t.budget)과는 완전히 분리된 지갑이다. 섞이면 이적시장이 무너진다.
═══════════════════════════════════════════════════════════════ */
/* beta  — 부동산 시장에 얼마나 민감한가 (상급지일수록 크게 오르내린다)
   party — 사람을 부를 수 있는 거실 등급 (0이면 집들이 불가) */
const HOMES=[
  {k:"gosi",  n:"고시원",           ic:"🚪", buy:0,    rent:0.02, pres:-2, beta:0,   party:0, d:"두 평 반. 창문은 있다."},
  {k:"onerm", n:"원룸 오피스텔",     ic:"🏠", buy:1.8,  rent:0.05, pres:0,  beta:0.6, party:0, d:"구단 사무실에서 걸어서 15분."},
  {k:"oktap", n:"옥탑방",           ic:"🌙", buy:1.2,  rent:0.035,pres:-1, beta:0.4, party:1, d:"여름엔 덥고 겨울엔 춥지만, 옥상에서 고기는 구울 수 있다."},
  {k:"apt",   n:"20평 아파트",       ic:"🏢", buy:6.5,  rent:0.09, pres:3,  beta:0.9, party:1, d:"가족이 놀러 와도 부끄럽지 않다."},
  {k:"apt2",  n:"34평 신축 아파트",  ic:"🏙️", buy:13,   rent:0.13, pres:5,  beta:1.1, party:2, d:"거실이 넓다. 커뮤니티 시설도 쓸 만하다."},
  {k:"villa", n:"고급 빌라",         ic:"🏘️", buy:18,   rent:0.16, pres:7,  beta:1.0, party:2, d:"선수단을 불러 밥을 먹일 수 있는 거실."},
  {k:"town",  n:"타운하우스",        ic:"🏡", buy:29,   rent:0.21, pres:9,  beta:1.2, party:3, d:"층이 나뉘어 있어 손님이 와도 서로 편하다."},
  {k:"house", n:"단독주택",          ic:"🏠", buy:42,   rent:0.28, pres:12, beta:1.3, party:3, d:"마당과 차고. 기자들이 대문 앞에 선다."},
  {k:"river", n:"한강뷰 아파트",     ic:"🌉", buy:66,   rent:0.40, pres:16, beta:1.5, party:4, d:"창을 열면 강이 흐른다. 이 동네 시세는 뉴스에 나온다."},
  {k:"penth", n:"한강뷰 펜트하우스", ic:"🌆", buy:95,   rent:0.55, pres:20, beta:1.7, party:5, d:"이 정도면 선수가 먼저 찾아온다."}
];
/* PROPS 정의는 아래 부동산 투자 블록으로 옮겼다 */
/* 선물 — 무엇을 주느냐에 따라 오르는 게 다르다 */
const GIFTS=[
  {k:"coffee", n:"커피 기프티콘",     ic:"☕", price:0.01, aff:2,  mor:1,  cond:0, xp:0.5, d:"작지만 챙긴다는 신호."},
  {k:"shoes",  n:"신형 축구화",       ic:"👟", price:0.06, aff:4,  mor:3,  cond:2, xp:2.5, d:"발에 맞는 물건은 티가 난다."},
  {k:"head",   n:"노이즈캔슬링 헤드폰",ic:"🎧", price:0.09, aff:5,  mor:4,  cond:1, xp:1.5, d:"원정 버스가 편해진다."},
  {k:"beef",   n:"한우 세트",         ic:"🥩", price:0.15, aff:7,  mor:5,  cond:4, xp:1.0, d:"부모님께 보내면 더 효과가 좋다."},
  {k:"game",   n:"최신 게임기",       ic:"🎮", price:0.22, aff:8,  mor:8,  cond:-1,xp:0.5, d:"어린 선수에게 특히 잘 먹힌다."},
  {k:"pt",     n:"개인 트레이너 3개월",ic:"🏋️", price:0.45, aff:5,  mor:2,  cond:9, xp:6.0, d:"몸이 달라진다. 비싸다."},
  {k:"nut",    n:"전담 영양사 계약",   ic:"🥗", price:0.60, aff:6,  mor:3,  cond:12,xp:4.0, d:"체중과 회복이 함께 잡힌다."},
  {k:"watch",  n:"명품 시계",         ic:"⌚", price:1.20, aff:14, mor:9,  cond:0, xp:2.0, d:"라커룸에서 소문이 난다."},
  {k:"car",    n:"수입 스포츠카",     ic:"🚗", price:4.50, aff:22, mor:14, cond:0, xp:3.0, d:"이건 선물이 아니라 사건이다."},
  {k:"trip",   n:"가족 해외여행 상품권",ic:"✈️", price:0.80, aff:12, mor:11, cond:6, xp:3.5, d:"가족을 챙기면 선수가 남는다."}
];
const GIFT_COOL=21;               // 같은 선수에게 다시 선물하기까지 (일)
function me(){
  if(!G.me){
    G.me={cash:0, home:"gosi", homeOwn:false, props:[], inv:{}, lastPay:"", log:[], spent:0, earned:0, debt:0,
          /* 자산 시스템 — 지연 초기화도 하지만, 처음부터 모양을 갖춰 두면 세이브가 예측 가능해진다 */
          stkInv:{}, short:{}, fut:null, fav:[], tx:[],
          stkLoan:0, stkDebt:0, hml:0, pln:0, partyAt:null,
          bank:{main:"kb", acc:[], loan:[], score:700, sid:0, hist:[], since:{}, spec:null, bonus:{}}};
    /* 부임 계약금 — 통장이 0원이면 소송도 이사도 아무것도 못 한다 */
    try{ if(userTeam()){ G.me.cash=Math.round(mgrSalary()*0.5*100)/100;
      G.me.log.unshift({d:G.day||0, t:`＋${G.me.cash.toFixed(2)}억 · 부임 계약금`}); G.me.earned=G.me.cash; } }catch(e){}
  }
  if(typeof G.me.debt!=="number") G.me.debt=0;
  if(!G.me.inv) G.me.inv={};
  if(!Array.isArray(G.me.props)) G.me.props=[];
  if(!Array.isArray(G.me.log)) G.me.log=[];
  return G.me;
}
/* ═══════════════════════════════════════════════════════════════════════════
   🏠 거주 — 집은 사는 곳이자 자산이다
   · 집값이 실제로 오르내린다 (부동산 사이클 · 매물별 변동성)
   · 자가는 시세차익이 나고, 주택담보대출을 낄 수 있다
   · 취득세·중개수수료가 붙는다 — 갈아타기가 공짜가 아니다
   · 거실이 있는 집이면 선수를 부를 수 있다 (집들이 → 라커룸 호감)
   · 눈에 띄는 집은 기자와 팬도 찾아온다
   ═══════════════════════════════════════════════════════════════════════════ */
const HOME_TAX =0.030;   // 취득세 3%
const HOME_FEE =0.005;   // 중개수수료 0.5%
const HOME_SELL=0.006;   // 매도 중개료
const HML_LTV  =0.60;    // 주택담보대출 한도 — 시세의 60%
const HML_RATE =0.00012; // 하루 0.012% ≈ 연 4.4%
/* 부동산 시장 — 주식보다 훨씬 느리고 완만하다. 한번 방향을 잡으면 오래 간다. */
function realty(){
  if(!G.realty) G.realty={idx:1, t:Math.random()*6.28, v:0, mkt:{}, log:[], lastIdx:1};
  if(G.realty.lastIdx==null) G.realty.lastIdx=G.realty.idx||1;
  if(!G.realty.mkt) G.realty.mkt={};
  return G.realty;
}
function homeMkt(k){
  const R=realty();
  if(R.mkt[k]==null) R.mkt[k]=1;
  return R.mkt[k];
}
/* 지금 시세(억) */
function homePrice(h){
  if(!h || !h.buy) return 0;
  return Math.round(h.buy*homeMkt(h.k)*100)/100;
}
function homeRent(h){
  if(!h) return 0;
  return Math.round(h.rent*(0.6+homeMkt(h.k)*0.4)*1000)/1000;
}
/* 매일 — 시장이 아주 조금씩 움직인다 */
function realtyTick(){
  const R=realty();
  R.t += 0.0038 + Math.random()*0.0016;   // 사이클 한 바퀴에 4~5년 — 「지금은 상승장」이 몇 시즌 이어진다
  /* 큰 사이클(수 년) + 잔물결 */
  /* ⚠ 진폭을 작게 잡으면 2년에 1%밖에 안 움직여 「시세」라는 게 없는 것과 같다(실측).
     상승기 3년에 +40%, 하락기에 −25% 남짓 — 실제 한국 부동산의 결에 맞춘다. */
  R.v = Math.sin(R.t)*0.0011 + (Math.random()-0.5)*0.0006;
  R.idx = clamp(R.idx*(1+R.v), 0.55, 2.6);
  for(const h of HOMES){
    if(!h.buy) continue;
    if(R.mkt[h.k]==null) R.mkt[h.k]=1;
    /* 매물마다 결이 다르다 — 서울 상급지는 더 크게 오르내리고, 소형은 완만하다 */
    const beta=h.beta!=null?h.beta:1;
    const own=(Math.random()-0.5)*0.0021*beta;
    R.mkt[h.k]=clamp(R.mkt[h.k]*(1+R.v*beta+own), 0.42, 3.2);
  }
  /* 분기마다 시장 소식 한 줄 */
  if((G.day||0)>0 && (G.day||0)%90===0){
    const up=R.v>=0;
    const txt=up ? pick(["부동산 시장 회복세 — 거래량 증가","금리 인하 기대에 매수세 유입","전세난에 매매 전환 늘어"])
                 : pick(["부동산 시장 관망세 — 거래 절벽","대출 규제 강화로 매수 심리 위축","고금리 부담에 매물 증가"]);
    R.log.unshift({d:G.day||0, t:`🏘️ ${txt} (지수 ${(R.idx*100).toFixed(1)})`});
    R.log=R.log.slice(0,12);
  }
}
/* ── 🏦 주택담보대출 ─────────────────────────────────────── */
function hmlLoan(){ return Math.max(0, me().hml||0); }
function hmlMax(){
  const M=me();
  if(!M.homeOwn) return 0;
  const h=homeOf();
  return Math.max(0, Math.round((homePrice(h)*HML_LTV - hmlLoan())*100)/100);
}
function hmlBorrow(amt){
  const M=me();
  const a=Math.round((parseFloat(amt)||0)*100)/100;
  if(!M.homeOwn){ flash("자가일 때만 담보대출을 받을 수 있습니다.","warn"); return; }
  if(a<=0){ flash("금액을 입력하세요.","warn"); return; }
  if(a>hmlMax()){ flash(`한도를 넘습니다 — 최대 ${hmlMax().toFixed(2)}억 (시세의 ${Math.round(HML_LTV*100)}%).`,"warn"); return; }
  M.hml=Math.round((hmlLoan()+a)*100)/100;
  mePay(a, `주택담보대출 실행 (잔액 ${M.hml.toFixed(2)}억)`);
  saveGame(); show("mylife");
}
function hmlRepay(amt){
  const M=me();
  const a=Math.min(hmlLoan(), Math.round((parseFloat(amt)||0)*100)/100);
  if(a<=0){ flash("상환할 금액이 없습니다.","warn"); return; }
  if(a>M.cash){ flash(`현금이 부족합니다 (보유 ${moneyEok(M.cash)}).`,"warn"); return; }
  M.hml=Math.round((hmlLoan()-a)*100)/100;
  mePay(-a, `주택담보대출 상환 (잔액 ${M.hml.toFixed(2)}억)`);
  if(!M.hml) flash("🏦 주택담보대출을 모두 갚았습니다.","good");
  saveGame(); show("mylife");
}
/* 매일 이자 · 시세가 무너지면 상환 압박 */
function hmlTick(){
  const M=me();
  const L=hmlLoan(); if(L<=0) return;
  const it=Math.round(L*HML_RATE*1e4)/1e4;
  M.hml=Math.round((L+it)*1e4)/1e4;
  M.hmlInt=Math.round(((M.hmlInt||0)+it)*1e4)/1e4;
  if(!M.homeOwn){ return; }
  const val=homePrice(homeOf());
  /* 시세가 대출을 밑돌면 은행이 상환을 요구한다 */
  if(val>0 && M.hml > val*0.92){
    if(!M._hmlWarn){
      M._hmlWarn=1;
      try{ notifyRealty(`🏦 집값이 내려 담보 가치가 대출을 밑돕니다 (시세 ${val.toFixed(1)}억 · 대출 ${M.hml.toFixed(1)}억). 은행이 상환을 요구하고 있습니다.`,"warn"); }catch(e){}
    }
    /* 오래 방치하면 경매로 넘어간다 */
    M._hmlBad=(M._hmlBad||0)+1;
    if(M._hmlBad>=120){
      const back=Math.max(0, Math.round((val*0.82-M.hml)*100)/100);
      M.homeOwn=false; M.home="gosi"; M.hml=0; M._hmlBad=0; M._hmlWarn=0;
      if(back>0) mePay(back, "주택 경매 정산금");
      addNews(`🏦 ${userTeam()?userTeam().short:""} 감독 자택, 담보대출 연체로 경매 처분`, "warn", "club");
      try{ notifyRealty(`🏦 <b>집이 경매로 넘어갔습니다.</b> 고시원으로 거처를 옮겼습니다${back>0?` (정산금 ${back.toFixed(2)}억)`:""}.`,"warn"); }catch(e){}
      try{ meLog(`🏦 자택 경매 처분 — 담보대출 연체`); }catch(e){}
    }
  } else { M._hmlBad=0; M._hmlWarn=0; }
}
/* ── 🎉 집들이 — 거실이 있는 집이면 선수를 부를 수 있다 ───── */
function homeCanParty(){
  const h=homeOf();
  return (h.party||0)>0;
}
/* 🎉 집들이를 열 수 없는 이유 — 없으면 null.
   ⚠ 무직 감독에게는 부를 선수단이 없다. 옛 코드는 그대로 열려 있었다. */
function homePartyBlock(){
  if(G.jobless) return {ic:"🪑", t:"지금은 부를 선수단이 없습니다.",
    d:"감독직에서 물러난 상태입니다. 다시 부임하면 선수들을 집으로 초대할 수 있습니다."};
  const t=userTeam();
  if(!t || !Array.isArray(t.players) || !t.players.length)
    return {ic:"🪑", t:"맡고 있는 구단이 없습니다.", d:"부임한 뒤에 열 수 있습니다."};
  if(!homeCanParty()) return {ic:"🏠", t:"사람을 부를 만한 거실이 없습니다.",
    d:"<b>옥탑방</b> 이상이면 선수단을 초대할 수 있습니다."};
  return null;
}
/* 🎯 직접 초대 — 감독이 지목한 선수 (비어 있으면 호감도 낮은 순 자동) */
let PARTY_PICK=[];
function partyCap(){ const h=homeOf(); return (h.party||0)*4+6; }
function partyPickToggle(pid){
  pid=+pid;
  const i=PARTY_PICK.indexOf(pid);
  if(i>=0) PARTY_PICK.splice(i,1);
  else {
    if(PARTY_PICK.length>=partyCap()){ flash(`거실이 ${partyCap()}명까지입니다. 먼저 한 명을 빼세요.`,"warn"); show("mylife"); return; }
    PARTY_PICK.push(pid);
  }
  show("mylife");
}
function partyPickClear(){ PARTY_PICK=[]; show("mylife"); }
function partyPickAuto(){
  const t=userTeam(); if(!t) return;
  PARTY_PICK=[...t.players].filter(p=>!p.loan||p.loan.to===t.id)
    .sort((a,b)=>aff(a)-aff(b)).slice(0, partyCap()).map(p=>p.id);
  show("mylife");
}
/* 실제로 갈 사람 — 지목한 선수를 먼저, 남은 자리는 호감도 낮은 순으로 */
function partyGuestList(){
  const t=userTeam(); if(!t) return [];
  const cap=partyCap();
  const pool=t.players.filter(p=>p && (!p.loan || p.loan.to===t.id));
  const picked=PARTY_PICK.map(id=>pool.find(p=>p.id===id)).filter(Boolean).slice(0, cap);
  const ids=new Set(picked.map(p=>p.id));
  const rest=pool.filter(p=>!ids.has(p.id)).sort((a,b)=>aff(a)-aff(b));
  const out=picked.slice();
  for(const p of rest){ if(out.length>=cap) break; out.push(p); }
  return out.map(p=>({p, picked:ids.has(p.id)}));
}
const HOME_PARTY_CD=60;       // 집들이 간격(일) — 두 달에 한 번
/* ⚠ 제보 — 「집들이를 계속 열 수 있다」.
   G.day 가 0 인 날(프리시즌 첫날)에 열면 partyAt 이 0 으로 저장되는데,
   `if(!M.partyAt)` 는 0 을 「기록 없음」으로 읽어 쿨다운이 통째로 사라졌다.
   숫자 0 은 엄연한 날짜다 — null/undefined 만 「기록 없음」으로 본다.
   시즌이 바뀌어 G.day 가 되감기면 남은 일수가 음수가 되므로 그것도 함께 정리한다. */
function homePartyLeft(){
  const M=me();
  if(M.partyAt==null) return 0;
  const gone=(G.day||0)-M.partyAt;
  if(gone<0){ M.partyAt=null; return 0; }        // 새 시즌 달력 — 지난 기록은 흘려보낸다
  return Math.max(0, HOME_PARTY_CD-gone);
}
/* 집들이에서 선수가 남기는 말 — 성격 · 원래 호감도 · 집 등급에 따라 달라진다.
   0 프로페셔널 · 1 야심가 · 2 온화함 · 3 다혈질 */
const PARTY_SAY={
  cold:[  // 원래 감독을 안 좋아하던 선수
    ["...솔직히 안 오려고 했습니다. 밥은 맛있었습니다.", 0],
    ["집이 좋네요. 그 얘긴 안 하고 넘어가겠습니다.", 0],
    ["뭐, 이런 자리라도 있어야 말이라도 섞죠.", 0],
    ["감독님 집에서 보니까 좀 다르게 보이긴 하네요.", 2],
    ["다음엔 저도 뭐라도 들고 오겠습니다.", 2]],
  warm:[  // 원래 좋아하던 선수
    ["잘 먹었습니다, 감독님. 다음 경기 제가 책임지겠습니다.", 0],
    ["형이... 아니 감독님이 이런 것도 하시네요 ㅎㅎ", 2],
    ["애들이랑 오랜만에 편하게 웃었습니다.", 2],
    ["이런 자리 자주 만들어 주십시오.", 1],
    ["사모님 음식 솜씨가 좋으시던데요.", 2]],
  pro:[   // 프로페셔널
    ["잘 먹었습니다. 내일 훈련 시간 맞춰 나가겠습니다.", 0],
    ["좋은 자리였습니다. 준비 잘 하겠습니다.", 0]],
  amb:[   // 야심가
    ["감독님, 다음 경기 선발은 생각해 두셨습니까?", 1],
    ["이 집 정도 되려면 저는 몇 년을 더 뛰어야 합니까?", 1],
    ["기회만 주시면 증명하겠습니다.", 1]],
  hot:[   // 다혈질
    ["형님! 오늘 술 한잔 더 하시죠!", 2],
    ["지난번 교체 건은... 오늘은 안 따지겠습니다.", 1],
    ["이런 건 좋습니다. 제가 다음엔 쏘겠습니다.", 2]],
  rich:[  // 집이 아주 좋을 때
    ["와... 여기서 사시는 겁니까? 뷰가 미쳤네요.", 1],
    ["사진 좀 찍어도 됩니까? 애들한테 자랑하게.", 1],
    ["감독님 집 보고 동기부여 확실히 됐습니다.", 2]],
  poor:[  // 집이 소박할 때
    ["감독님 이런 데 사시는 줄 몰랐습니다.", 2],
    ["소박하시네요. 저희 숙소보다 좁은데요 ㅋㅋ", 1],
    ["옥상에서 고기 굽는 거 좋았습니다.", 2]],
  /* 🎯 감독이 이름을 콕 집어 부른 선수 — 그 사실 자체를 안다 */
  picked:[
    ["저를 따로 불러 주신 거… 무슨 뜻인지 알겠습니다.", 2],
    ["명단에 제 이름 있는 거 보고 좀 놀랐습니다. 감사합니다.", 2],
    ["직접 부르셨다고 들었습니다. 잘하겠습니다.", 1],
    ["감독님이 저를 챙기신다는 게 느껴집니다.", 2],
    ["기대에 보답하겠습니다. 이건 약속입니다.", 1]],
  pickedAmb:[  // 야심가 — 초대를 신호로 읽는다
    ["따로 부르신 이유가 있겠죠. 저 쓰실 생각이신 겁니까?", 1],
    ["이런 자리에 부르셨다는 건… 저 믿으신다는 뜻으로 받겠습니다.", 1]],
  pickedHot:[  // 다혈질 — 감동한다
    ["형님… 아니 감독님! 저 부르신 거 잊지 않겠습니다!", 2],
    ["솔직히 좀 울컥했습니다. 다음 경기 몸 던지겠습니다.", 2]],
  pickedCold:[ // 사이가 안 좋았는데 지목당했다
    ["…저를 부르실 줄은 몰랐습니다. 생각을 좀 해보겠습니다.", 2],
    ["할 말이 많았는데, 오늘은 밥만 먹고 가겠습니다.", 0],
    ["이렇게라도 자리를 만들어 주시니… 알겠습니다.", 2]],
  /* 😔 초대받지 못한 주전 — 라커룸에서 새어나오는 말 */
  snub:[
    ["명단에 제 이름은 없었다면서요? …알겠습니다.", -2],
    ["다들 감독님 집 얘기하는데 저만 못 들었습니다.", -2],
    ["뭐, 저는 안 부르셔도 뛰기만 하면 됩니다.", -1],
    ["저는 왜 빠졌는지 정도는 알고 싶습니다.", -2]],
  snubHot:[
    ["저 빼고 부르셨다고요? …기억하겠습니다.", -3],
    ["이런 건 좀 서운합니다. 아니, 많이 서운합니다.", -3]],
  snubPro:[
    ["초대 명단은 감독님 권한입니다. 신경 쓰지 않습니다.", 0],
    ["저는 훈련장에서 보여드리면 됩니다.", 0]]
};
function partySay(p, h, gain, picked){
  const pool=[];
  const a=aff(p);
  /* 🎯 직접 지목한 선수 — 열에 일곱은 「따로 불러 주셨다」는 이야기를 한다.
     나머지 셋은 평소 하던 말이 섞여야 자연스럽다. */
  if(picked){
    const sp=[];
    sp.push(...(a<45?PARTY_SAY.pickedCold:PARTY_SAY.picked));
    if(p.pers===1) sp.push(...PARTY_SAY.pickedAmb, ...PARTY_SAY.pickedAmb);
    if(p.pers===3) sp.push(...PARTY_SAY.pickedHot, ...PARTY_SAY.pickedHot);
    if(sp.length && Math.random()<0.70) return pick(sp);
    pool.push(...sp);
  }
  pool.push(...(a<45?PARTY_SAY.cold:PARTY_SAY.warm));
  if(p.pers===0) pool.push(...PARTY_SAY.pro);
  else if(p.pers===1) pool.push(...PARTY_SAY.amb);
  else if(p.pers===3) pool.push(...PARTY_SAY.hot);
  if(h.party>=4) pool.push(...PARTY_SAY.rich, ...PARTY_SAY.rich);
  else if(h.party<=1) pool.push(...PARTY_SAY.poor);
  return pick(pool);
}
/* 😔 초대받지 못한 주전이 남기는 말 */
function partySnubSay(p){
  const pool=[];
  if((p.pers||0)===0) pool.push(...PARTY_SAY.snubPro, ...PARTY_SAY.snubPro);
  else if((p.pers||0)===3) pool.push(...PARTY_SAY.snubHot, ...PARTY_SAY.snubHot, ...PARTY_SAY.snub);
  else pool.push(...PARTY_SAY.snub);
  return pick(pool);
}
function homeParty(){
  const M=me(), t=userTeam(), h=homeOf();
  const blk=homePartyBlock();
  if(blk){ flash(blk.t,"warn"); return; }
  if(!t) return;
  const left=homePartyLeft();
  if(left>0){ flash(`얼마 전에 불렀습니다 — ${dateLabel((M.partyAt||0)+HOME_PARTY_CD)}부터 다시 열 수 있습니다 (${left}일 남음).`,"warn"); return; }
  const cost=Math.round((0.15+h.party*0.12)*100)/100;
  if(M.cash<cost){ flash(`비용 ${cost}억이 부족합니다.`,"warn"); return; }
  const _g0=partyGuestList();
  const _pk=_g0.filter(x=>x.picked).length;
  showConfirm(`<b>🎉 ${h.ic} ${h.n} 집들이</b>\n\n선수단을 집으로 부릅니다. 음식과 준비에 <b>${cost}억</b>이 듭니다.\n\n· 초대 <b>${_g0.length}명</b>${_pk?` — 직접 지목 <b style="color:var(--gold)">${_pk}명</b> · 자동 ${_g0.length-_pk}명`:" (호감도가 낮은 선수부터 자동)"}\n· 호감도 상승 · 팀 분위기 개선\n· 집이 좋을수록 효과가 큽니다${_pk?`\n\n<span class="small" style="color:var(--gold)">지목한 선수는 「감독이 나를 따로 불렀다」는 걸 압니다 — 효과가 더 큽니다.\n대신 초대받지 못한 주전은 서운해합니다.</span>`:""}\n\n<span class="small">${HOME_PARTY_CD}일에 한 번 열 수 있습니다.</span>`,
    ()=>{
      mePay(-cost, `${h.n} 집들이`);
      M.partyAt=G.day||0;
      const guestSet=partyGuestList();
      const guests=guestSet.map(x=>x.p);
      const pickSet=new Set(guestSet.filter(x=>x.picked).map(x=>x.p.id));
      let up=0;
      const log=[];
      for(const p of guests){
        const isPk=pickSet.has(p.id);
        /* 🎯 이름을 콕 집어 불렀다면 그 마음이 더 크게 남는다 */
        let gain=(3+h.party*1.6+Math.random()*3) * (isPk?1.45:1);
        gain=Math.round(gain*10)/10;
        const a0=aff(p);
        const [say, mood]=partySay(p, h, gain, isPk);
        affSet(p, clamp(a0+gain, 0, 100));
        p.morale=clamp((p.morale||70)+1.5+h.party*0.6+mood*0.6+(isPk?1.2:0), 25, 99);
        log.push({id:p.id, n:p.name, pos:p.pos, pers:p.pers||0, pk:isPk?1:0,
                  a0:Math.round(a0), a1:Math.round(aff(p)), g:gain, say, mood});
        up++;
      }
      /* 😔 초대받지 못한 주전 — 지목 초대를 썼을 때만. 아무 이름도 안 골랐으면 서운할 일도 없다.
         (감독이 「호감도 낮은 순」에 맡긴 경우는 선수들도 그렇게 받아들인다) */
      const snub=[];
      if(pickSet.size>0){
        const went=new Set(guests.map(p=>p.id));
        let xi=[]; try{ xi=(bestXI(t)||[]).map(p=>p.id); }catch(e){}
        const xiSet=new Set(xi);
        for(const p of t.players){
          if(went.has(p.id)) continue;
          if(p.loan && p.loan.to!==t.id) continue;
          if(!xiSet.has(p.id)) continue;                  // 주전만 서운해한다
          const [say, mood]=partySnubSay(p);
          const dn = (p.pers===3? 3.0 : p.pers===0? 0.6 : 1.8) * (0.8+Math.random()*0.5);
          const a0=aff(p);
          affSet(p, clamp(a0-dn, 0, 100));
          p.morale=clamp((p.morale||70)-(p.pers===0?0.3:1.2), 25, 99);
          snub.push({id:p.id, n:p.name, pos:p.pos, pers:p.pers||0,
                     a0:Math.round(a0), a1:Math.round(aff(p)), g:-Math.round(dn*10)/10, say, mood});
        }
      }
      /* 누가 왔고 뭐라고 했는지 남긴다 — 다음 집들이 전까지 화면에 보인다 */
      M.partyLog={d:G.day||0, home:h.k, hn:h.n, ic:h.ic, cost, guests:log, snub, pick:pickSet.size};
      PARTY_PICK=[];
      addMood(fixJosa(`🎉 감독이 ${h.n}으로/로 선수단을 초대했습니다. 오랜만에 다들 편하게 웃었습니다. (${up}명 참석${pickSet.size?` · 지목 ${pickSet.size}명`:""})`));
      if(snub.length) addMood(fixJosa(`😔 초대 명단에서 빠진 ${snub.map(x=>x.n).slice(0,3).join(", ")}${snub.length>3?` 외 ${snub.length-3}명`:""}이/가 서운해합니다.`));
      try{ meLog(`🎉 집들이 — ${up}명 초대 (${cost}억)`); }catch(e){}
      try{ notify(`🎉 집들이를 열었습니다 — <b>${up}명</b>이 다녀갔고 호감도가 올랐습니다.`,"good"); }catch(e){}
      try{ socialFill(["감독님이 선수들 집에 불러서 밥 먹였다더라 ㅋㅋ 좋네",
                       "이런 게 팀 분위기지","선수들 SNS에 사진 올라옴 ㅋㅋㅋ",
                       "감독 집 좋더라 ㄷㄷ"], 2, 1, {t:t.short}); }catch(e){}
      saveGame(); show("mylife");
    }, {okLabel:`🎉 ${cost}억 쓰고 연다`, cancelLabel:"다음에"});
}
/* 🎯 초대 명단 고르기 — 선수를 눌러 지목한다. 아무도 안 고르면 호감도 낮은 순으로 자동. */
function partyPickHtml(){
  const t=userTeam(); if(!t) return "";
  const cap=partyCap();
  const list=partyGuestList();
  const going=new Set(list.map(x=>x.p.id));
  const pk=new Set(list.filter(x=>x.picked).map(x=>x.p.id));
  let xi=new Set(); try{ xi=new Set((bestXI(t)||[]).map(p=>p.id)); }catch(e){}
  const pool=[...t.players].filter(p=>!p.loan || p.loan.to===t.id)
    .sort((a,b)=>(pk.has(b.id)?1:0)-(pk.has(a.id)?1:0) || aff(a)-aff(b));
  const chip=(p)=>{
    const on=pk.has(p.id), auto=!on&&going.has(p.id);
    const A=affLabel(aff(p));
    const snub=pk.size>0 && !going.has(p.id) && xi.has(p.id);
    return `<div class="ptPick${on?" on":auto?" auto":""}" onclick="partyPickToggle(${p.id})"
      title="${on?"직접 지목 — 누르면 뺍니다":auto?"자동 초대 — 누르면 확정 지목":"초대 안 함 — 누르면 지목"}">
      <span class="ptMark">${on?"⭐":auto?"·":"＋"}</span>
      <b class="pos-${p.pos}">${p.pos}</b>
      <span class="ptN">${p.name}</span>
      <span class="ptA" style="color:${A.c}">${A.ic}${Math.round(aff(p))}</span>
      ${snub?'<span class="ptSnub">서운</span>':""}
    </div>`;
  };
  return `<div style="margin-top:9px;border-top:1px solid #21262d;padding-top:9px">
    <div class="small" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
      <b style="color:var(--gold)">🎯 초대 명단</b>
      <span style="color:var(--sub)">지목 <b style="color:var(--gold)">${pk.size}</b> · 자동 ${list.length-pk.size} · 정원 ${cap}명</span>
      <button class="mini" style="padding:2px 8px;margin-left:auto" onclick="partyPickAuto()">호감도 낮은 순으로 채우기</button>
      <button class="mini" style="padding:2px 8px" onclick="partyPickClear()">지목 비우기</button>
    </div>
    <div class="ptWrap">${pool.map(chip).join("")}</div>
    <div class="small" style="margin-top:6px;color:var(--sub);line-height:1.55">
      ⭐ 직접 지목 · · 자동 초대 · ＋ 초대 안 함<br>
      <b style="color:var(--gold)">지목한 선수</b>는 감독이 자기를 따로 불렀다는 걸 압니다 — 호감도 상승이 <b>1.45배</b>입니다.
      ${pk.size>0?`<br><b style="color:#f0883e">다만 지목을 쓰면</b>, 초대받지 못한 <b>주전</b>은 서운해합니다(다혈질은 특히).`
                 :`<br>아무도 고르지 않으면 <b>호감도가 낮은 선수부터</b> 자동으로 채우고, 빠진 선수도 서운해하지 않습니다.`}
    </div>
  </div>`;
}
/* 🎉 지난 집들이 — 누가 왔고 뭐라고 했는지 */
function partyLogHtml(){
  const M=me(), L=M.partyLog;
  if(!L || !L.guests || !L.guests.length) return "";
  const t=userTeam();
  const up=L.guests.reduce((s,x)=>s+x.g, 0)/L.guests.length;
  return `<div style="margin-top:12px;border-top:1px solid #21262d;padding-top:10px">
    <div class="small" style="color:var(--sub);margin-bottom:7px">
      ${L.ic||"🎉"} <b style="color:var(--txt)">${L.hn||"집"}</b> 집들이 · ${dateLabel(L.d)} ·
      <b>${L.guests.length}명</b> 참석${L.pick?` <span style="color:var(--gold)">(지목 ${L.pick}명)</span>`:""} · 평균 호감 <b style="color:var(--green)">+${up.toFixed(1)}</b> · 비용 ${L.cost}억</div>
    ${L.guests.map(x=>{
      const p=t&&t.players.find(q=>q.id===x.id);
      const gone=!p;
      const pn=["프로","야심","온화","다혈"][x.pers||0];
      return `<div class="partyRow${gone?" gone":""}" ${p?`onclick="openPlayerMenu(event,${x.id})"`:""}>
        <div class="partyHead">
          <b class="pos-${x.pos}">${x.pos}</b>
          <span class="partyN">${x.n}</span>
          <span class="stkTag">${pn}</span>
          <span class="partyAff">호감 ${x.a0} → <b style="color:var(--green)">${x.a1}</b>
            <span style="color:var(--green)">(+${x.g})</span></span>
        </div>
        <div class="partySay">${x.mood>=2?"😄":x.mood>=1?"🙂":"🙂"} “${x.say}”</div>
      </div>`;}).join("")}
    ${(L.snub&&L.snub.length)?`
      <div class="small" style="margin:10px 0 6px;color:#f0883e"><b>😔 초대받지 못한 주전 ${L.snub.length}명</b>
        <span style="opacity:.8">— 지목 초대의 대가입니다</span></div>
      ${L.snub.map(x=>{
        const p=t&&t.players.find(q=>q.id===x.id);
        const pn=["프로","야심","온화","다혈"][x.pers||0];
        return `<div class="partyRow snub${p?"":" gone"}" ${p?`onclick="openPlayerMenu(event,${x.id})"`:""}>
          <div class="partyHead">
            <b class="pos-${x.pos}">${x.pos}</b>
            <span class="partyN">${x.n}</span>
            <span class="stkTag">${pn}</span>
            <span class="partyAff">호감 ${x.a0} → <b style="color:#f85149">${x.a1}</b>
              <span style="color:#f85149">(${x.g})</span></span>
          </div>
          <div class="partySay">${(x.pers||0)===0?"😐":"😔"} “${x.say}”</div>
        </div>`;}).join("")}`:""}
  </div>`;
}
/* ── 🏚️ 생활 이벤트 — 집마다 겪는 일이 다르다 ─────────────── */
const HOME_EVT={
  small:[["🚿 보일러가 고장 났습니다. 수리비가 나갔습니다.", 0.05],
         ["🔊 윗집 층간소음으로 며칠 잠을 설쳤습니다.", 0],
         ["💧 천장에서 물이 샙니다. 급하게 손봤습니다.", 0.08],
         ["🪳 방역을 불렀습니다.", 0.03]],
  mid:  [["🔧 배관 공사를 했습니다.", 0.12],
         ["🚗 주차 문제로 이웃과 실랑이가 있었습니다.", 0],
         ["🪟 창호를 교체했습니다.", 0.18]],
  big:  [["🌳 정원 관리 업체를 불렀습니다.", 0.15],
         ["🔒 보안 시스템을 교체했습니다.", 0.22],
         ["📸 기자들이 대문 앞에 진을 쳤습니다. 사생활이 없습니다.", 0],
         ["🧹 관리 인력을 새로 고용했습니다.", 0.20]]
};
function homeEventTick(){
  if(Math.random()>=0.012) return;                 // 석 달에 한 번쯤
  const M=me(), h=homeOf();
  const band = h.buy<=2 ? "small" : h.buy<=20 ? "mid" : "big";
  const [txt, cost]=pick(HOME_EVT[band]);
  if(cost>0){
    if(M.cash<cost) return;
    mePay(-cost, txt.replace(/^\S+\s/,""));
  } else {
    try{ meLog(txt); }catch(e){}
  }
  try{ notify(`${txt}${cost>0?` <span class="small">(-${cost}억)</span>`:""}`, "info"); }catch(e){}
  /* 눈에 띄는 집 + 성적 부진 = 팬이 찾아온다 */
  if(band==="big" && Math.random()<0.35){
    try{
      const t=userTeam();
      const bad=t && t.form && t.form.slice(-4).filter(f=>f==="L").length>=3;
      if(bad){
        addNews(`📣 성난 팬들, ${t.short} 감독 자택 앞에서 항의 시위`, "warn", "club");
        try{ notify(`📣 팬들이 집 앞에 몰려왔습니다. 성적이 이 지경이니 할 말이 없습니다.`,"warn"); }catch(e){}
        try{ adjustTrust("fans", -2, "자택 앞 항의"); }catch(e){}
      }
    }catch(e){}
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   🏢 부동산 투자 — 사놓고 기다리는 게임이 아니다
   · 공실이 난다. 명목 수익률과 실제 수익률은 다르다.
   · 지하철이 뚫리고, 옆 건물이 비고, 재건축이 승인된다.
   · 담보를 잡아 레버리지를 낄 수 있고, 보유세와 양도세가 나간다.
   · 돈을 들여 고치면 임대료와 시세가 오른다.
   ═══════════════════════════════════════════════════════════════════════════ */
const PROP_TAX  =0.006;    // 재산세 — 시세의 0.6% (연 1회)
const PROP_TAX2 =0.004;    // 다주택 중과 — 3채째부터 채당 가산
const PROP_GAIN =0.22;     // 양도세 22%
const PROP_GAIN_S=0.44;    // 2년 미만 단기 양도 중과 44%
const PROP_FEE  =0.008;    // 취득세·중개료 합산
const PLN_LTV   =0.55;     // 부동산 담보대출 한도
const PLN_RATE  =0.00016;  // 하루 0.016% ≈ 연 5.8%
/* 매물 — grade 는 시장 민감도, base는 기본 공실 위험 */
const PROPS=[
  {k:"osan",   n:"오산 상가 1층",       ic:"🏪", price:4.5,  yield:0.055, risk:0.10, beta:0.9, vac:0.16, reg:"경기 남부"},
  {k:"bucheon",n:"부천 원룸 건물",       ic:"🏚️", price:7,    yield:0.068, risk:0.13, beta:0.8, vac:0.12, reg:"경기 서부"},
  {k:"incheon",n:"인천 구축 아파트",     ic:"🏢", price:9,    yield:0.042, risk:0.14, beta:1.0, vac:0.07, reg:"인천"},
  {k:"daejeon",n:"대전 근생빌딩",        ic:"🏬", price:12,   yield:0.058, risk:0.15, beta:0.9, vac:0.18, reg:"충청"},
  {k:"suwon",  n:"수원 역세권 오피스텔", ic:"🏬", price:16,   yield:0.048, risk:0.12, beta:1.0, vac:0.10, reg:"경기 남부"},
  {k:"busan",  n:"부산 해운대 아파트",   ic:"🌊", price:21,   yield:0.034, risk:0.18, beta:1.2, vac:0.08, reg:"부산"},
  {k:"jeju",   n:"제주 게스트하우스",    ic:"🏝️", price:24,   yield:0.062, risk:0.22, beta:1.1, vac:0.26, reg:"제주"},
  {k:"gwangju",n:"광주 상가주택",        ic:"🏘️", price:27,   yield:0.052, risk:0.16, beta:0.9, vac:0.15, reg:"호남"},
  {k:"ilsan",  n:"일산 근린상가",        ic:"🏪", price:34,   yield:0.046, risk:0.15, beta:1.0, vac:0.19, reg:"경기 북부"},
  {k:"seoul",  n:"성수동 꼬마빌딩",      ic:"🏛️", price:58,   yield:0.038, risk:0.16, beta:1.4, vac:0.11, reg:"서울"},
  {k:"yeoui",  n:"여의도 오피스",        ic:"🏙️", price:82,   yield:0.041, risk:0.14, beta:1.3, vac:0.13, reg:"서울"},
  {k:"gangnam",n:"강남 재건축 아파트",   ic:"🌇", price:120,  yield:0.026, risk:0.26, beta:1.7, vac:0.05, reg:"서울"},
  {k:"hannam", n:"한남동 단독",          ic:"🏯", price:165,  yield:0.022, risk:0.24, beta:1.6, vac:0.06, reg:"서울"},
  {k:"jamsil", n:"잠실 대형 상가",       ic:"🛍️", price:210,  yield:0.044, risk:0.20, beta:1.5, vac:0.14, reg:"서울"}
];
/* 리모델링 등급별 효과 */
const PROP_UP=[
  null,
  {n:"도배·장판", cost:0.05, val:0.03, rent:0.05},
  {n:"올수리",    cost:0.10, val:0.08, rent:0.12},
  {n:"리모델링",  cost:0.18, val:0.16, rent:0.22}
];
function propDef(k){ return PROPS.find(x=>x.k===k)||PROPS[0]; }
/* 이 매물의 지금 시세 — 개별 시세(value)를 그대로 쓰되 없으면 매입가 */
function propVal(it){ return Math.round((it.value||it.price)*100)/100; }
/* 월 임대료 — 공실이면 0 */
function propRent(it){
  const P=propDef(it.k);
  if(it.vac>0) return 0;
  const up=PROP_UP[it.up||0];
  return Math.round(propVal(it)*P.yield/12*(it.rentK||1)*(1+(up?up.rent:0))*1000)/1000;
}
/* 실질 수익률 — 공실과 보유세까지 반영한 값 */
function propNetYield(it){
  const P=propDef(it.k);
  const up=PROP_UP[it.up||0];
  const gross=P.yield*(it.rentK||1)*(1+(up?up.rent:0));
  return Math.round((gross*(1-P.vac) - PROP_TAX)*1000)/10;   // %
}
function propLoan(){ return Math.max(0, me().pln||0); }
function propTotal(){ return (me().props||[]).reduce((s,x)=>s+propVal(x), 0); }
function propLoanMax(){ return Math.max(0, Math.round((propTotal()*PLN_LTV - propLoan())*100)/100); }
/* ── 🏗️ 개발 호재·악재 ─────────────────────────────────────── */
const PROP_EVT_UP=[
  {t:"{n} 인근에 지하철 신설역이 확정됐습니다", v:[0.10,0.26], r:[0.04,0.12]},
  {t:"{n} 일대가 재개발 구역으로 지정됐습니다", v:[0.14,0.34], r:[0,0.05]},
  {t:"{n} 주변에 대기업 사옥이 들어섭니다",     v:[0.08,0.20], r:[0.06,0.16]},
  {t:"{n} 앞 도로가 확장 개통됐습니다",         v:[0.05,0.12], r:[0.02,0.07]},
  {t:"{n}이 속한 지역이 상권 활성화 구역으로 선정됐습니다", v:[0.06,0.15], r:[0.05,0.14]},
  {t:"{n} 재건축 안전진단을 통과했습니다",      v:[0.16,0.38], r:[0,0.03]}
];
const PROP_EVT_DN=[
  {t:"{n} 인근에 대형 공실 상가가 늘고 있습니다",   v:[-0.14,-0.05], r:[-0.16,-0.06]},
  {t:"{n} 일대에 신축 공급이 쏟아졌습니다",         v:[-0.18,-0.07], r:[-0.14,-0.05]},
  {t:"{n} 건물에 균열이 발견돼 보수가 필요합니다",  v:[-0.10,-0.04], r:[0,0]},
  {t:"{n} 주변 대형 사업장이 문을 닫았습니다",      v:[-0.20,-0.08], r:[-0.20,-0.08]},
  {t:"{n} 지역이 규제지역으로 묶였습니다",          v:[-0.12,-0.05], r:[0,0]},
  {t:"{n} 인근에서 대형 화재가 났습니다",           v:[-0.09,-0.03], r:[-0.08,-0.02]}
];
function propLog(txt, k){
  const R=realty();
  if(!Array.isArray(R.plog)) R.plog=[];
  R.plog.unshift({d:G.day||0, t:txt, k:k||null});
  R.plog=R.plog.slice(0,24);
}
/* 매달 — 시세·공실·임대료·이벤트를 한 번에 굴린다 */
function propMonthTick(){
  const M=me();
  const R=realty();
  if(!Array.isArray(M.props) || !M.props.length){ R.lastIdx=R.idx; return 0; }
  let rent=0;
  for(const it of M.props){
    const P=propDef(it.k);
    if(it.value==null) it.value=it.price;
    if(it.rentK==null) it.rentK=1;
    /* ① 시세 — 시장 지수를 따라가되 매물 고유의 결이 섞인다.
       ⚠ R.v 는 「그날 하루」의 변동률이다. 여기에 30 을 곱하면 그날의 방향이 한 달 내내
          이어진 것으로 계산돼, 사이클 한쪽에서만 정산될 때 3년에 −67% 까지 무너졌다(실측).
          정산 사이에 지수가 실제로 얼마나 움직였는지를 그대로 쓴다. */
    const mkChg=(R.lastIdx>0 ? R.idx/R.lastIdx-1 : 0);
    const mk=1 + mkChg*(P.beta||1) + (Math.random()-0.47)*P.risk/5.5;
    it.value=Math.round(Math.max(it.price*0.28, it.value*mk)*100)/100;
    /* ② 공실 — 나가고, 들어온다 */
    if(it.vac>0){
      it.vac--;
      if(it.vac<=0){
        it.vac=0;
        /* 새 임차인 — 시장이 좋으면 임대료가 오른다 */
        const adj=clamp(1+(R.v*40)+(Math.random()-0.5)*0.10, 0.82, 1.22);
        it.rentK=Math.round(clamp(it.rentK*adj, 0.55, 1.9)*100)/100;
        propLog(`🔑 <b>${P.n}</b> 새 임차인 입주 — 임대료 ${adj>=1?"+":""}${Math.round((adj-1)*100)}% 조정`, it.k);
        try{ notifyRealty(`🔑 <b>${P.n}</b>에 새 임차인이 들어왔습니다 (임대료 ${adj>=1?"+":""}${Math.round((adj-1)*100)}%).`,"good"); }catch(e){}
      }
    } else if(Math.random() < P.vac/14){
      it.vac=1+Math.floor(Math.random()*4);         // 1~4개월 공실
      propLog(`🚪 <b>${P.n}</b> 임차인 퇴거 — ${it.vac}개월 공실 예상`, it.k);
      try{ notifyRealty(`🚪 <b>${P.n}</b> 임차인이 나갔습니다. ${it.vac}개월쯤 비어 있을 전망입니다 — 그동안 임대수익이 없습니다.`,"warn"); }catch(e){}
    }
    rent += propRent(it);
    /* ③ 개발 호재·악재 */
    if(Math.random()<0.035){
      const up=Math.random()<0.5;
      const E=pick(up?PROP_EVT_UP:PROP_EVT_DN);
      const dv=E.v[0]+Math.random()*(E.v[1]-E.v[0]);
      const dr=E.r[0]+Math.random()*(E.r[1]-E.r[0]);
      it.value=Math.round(Math.max(it.price*0.2, it.value*(1+dv))*100)/100;
      if(dr) it.rentK=Math.round(clamp(it.rentK*(1+dr), 0.5, 2.2)*100)/100;
      const txt=E.t.replace("{n}", P.n);
      propLog(`${up?"🏗️":"⚠️"} ${txt} <span class="small">(시세 ${dv>=0?"+":""}${Math.round(dv*100)}%${dr?` · 임대료 ${dr>=0?"+":""}${Math.round(dr*100)}%`:""})</span>`, it.k);
      try{ notifyRealty(`${up?"🏗️":"⚠️"} ${txt} — 시세 <b>${dv>=0?"+":""}${Math.round(dv*100)}%</b>`, up?"good":"warn"); }catch(e){}
    }
  }
  R.lastIdx=R.idx;              // 다음 정산 때 이 지점과 견준다
  return Math.round(rent*1000)/1000;
}
/* 매년 — 재산세 */
function propTaxTick(){
  const M=me();
  const n=(M.props||[]).length;
  if(!n) return;
  let tax=0;
  for(const it of M.props) tax += propVal(it)*PROP_TAX;
  if(n>=3) tax += propTotal()*PROP_TAX2*(n-2)/n;      // 다주택 중과
  tax=Math.round(tax*100)/100;
  if(tax<=0) return;
  mePay(-tax, `재산세 (부동산 ${n}건 · 시세 ${propTotal().toFixed(1)}억${n>=3?" · 다주택 중과":""})`);
  propLog(`🧾 재산세 ${tax}억 납부 — 보유 ${n}건`);
  try{ notifyRealty(`🧾 재산세 <b>${tax}억</b>이 부과됐습니다 (부동산 ${n}건${n>=3?" · 다주택 중과":""}).`,"warn"); }catch(e){}
}
/* 담보대출 이자 */
function propLoanTick(){
  const M=me();
  const L=propLoan(); if(L<=0) return;
  const it=Math.round(L*PLN_RATE*1e4)/1e4;
  M.pln=Math.round((L+it)*1e4)/1e4;
  M.plnInt=Math.round(((M.plnInt||0)+it)*1e4)/1e4;
  /* 담보 가치가 무너지면 매각 압박 */
  if(propTotal()>0 && M.pln > propTotal()*0.9 && !M._plnWarn){
    M._plnWarn=1;
    try{ notifyRealty(`🏦 부동산 담보 가치가 대출을 밑돌고 있습니다 (시세 ${propTotal().toFixed(1)}억 · 대출 ${M.pln.toFixed(1)}억). 일부 정리하셔야 합니다.`,"warn"); }catch(e){}
  } else if(M.pln < propTotal()*0.7) M._plnWarn=0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   🏦 은행 — 적금 · 예금 · 신용대출
   은행마다 금리와 한도가 다르고, 신용점수에 따라 받을 수 있는 조건이 달라진다.
   기준금리는 시장을 따라 움직이고, 우대조건을 채우면 금리가 붙는다.
   ═══════════════════════════════════════════════════════════════════════════ */
/* 은행 — safe 는 예금자보호 한도(억). type: 시중/지방/인터넷/저축/상호 */
/* 🏦 은행 — 전부 이 세계관의 가상 금융기관이다.
   실재하는 상호를 쓰면 금리·심사·부실 같은 묘사가 곧 그 회사에 대한 서술이 된다.
   구단·기업명과 같은 결(한글 고유어 + 업권 표기)로 맞춰 두었다. */
const BANKS=[
  {k:"kb",   n:"한울은행",     ic:"🏛️", t:"시중은행",   dep:+0.00, sav:+0.00, loan:+0.00, ltd:8.0, safe:0.5,
   d:"이 나라에서 가장 큰 은행. 금리는 평범하지만 한도가 넉넉하고 심사가 무난하다."},
  {k:"shin", n:"다온은행",     ic:"🏦", t:"시중은행",   dep:+0.10, sav:+0.15, loan:-0.15, ltd:7.5, safe:0.5,
   d:"주거래 우대가 후하다. 급여이체를 걸어 두면 대출 금리가 내려간다."},
  {k:"nh",   n:"푸른들은행",   ic:"🌾", t:"시중은행", dep:+0.05, sav:+0.25, loan:+0.10, ltd:7.0, safe:0.5,
   d:"농·축산 조합에서 출발한 은행. 적금 상품이 다양하고 창구가 친절하다."},
  {k:"dgb",  n:"새벌지방은행", ic:"🏢", t:"지방은행",   dep:+0.30, sav:+0.40, loan:+0.25, ltd:5.5, safe:0.5,
   d:"지방은행이라 금리를 조금 더 준다. 대신 한도는 시중은행보다 짜다."},
  {k:"kbank",n:"넥스트뱅크",   ic:"📱", t:"인터넷은행", dep:+0.45, sav:+0.60, loan:-0.30, ltd:4.5, safe:0.5,
   d:"창구가 없어 비용이 적다. 금리는 좋지만 한도가 낮고 심사가 깐깐하다."},
  {k:"toss", n:"바로뱅크",     ic:"💠", t:"인터넷은행", dep:+0.55, sav:+0.70, loan:-0.20, ltd:4.0, safe:0.5,
   d:"파킹통장 금리가 가장 높다. 목돈을 잠깐 넣어 두기에 좋다."},
  {k:"sb",   n:"한별저축은행", ic:"💰", t:"저축은행",   dep:+1.40, sav:+1.80, loan:+2.20, ltd:3.0, safe:0.5,
   d:"금리가 확 높다. 대신 대출 금리도 높고, 예금자보호 한도를 넘는 돈은 위험하다."},
  {k:"mg",   n:"한마음금고",   ic:"🏘️", t:"상호금융",   dep:+0.85, sav:+1.10, loan:+0.60, ltd:3.5, safe:0.5,
   d:"조합원 예탁금은 이자소득세가 거의 없다 — 세후 수익률이 실제로 가장 높을 때가 있다."}
];
/* 상품 — kind: dep(예금·목돈) sav(적금·매달) park(파킹) */
const BANK_PROD=[
  {k:"park",  n:"파킹통장",       ic:"🅿️", kind:"park", m:0,  base:2.2, min:0.1,  d:"수시 입출금. 하루만 넣어도 이자가 붙는다."},
  {k:"dep6",  n:"정기예금 6개월", ic:"🔒", kind:"dep",  m:6,  base:3.1, min:1,    d:"목돈을 반년 묶는다."},
  {k:"dep12", n:"정기예금 1년",   ic:"🔒", kind:"dep",  m:12, base:3.5, min:1,    d:"가장 무난한 목돈 굴리기."},
  {k:"dep24", n:"정기예금 2년",   ic:"🔐", kind:"dep",  m:24, base:3.9, min:2,    d:"오래 묶는 대신 금리가 높다."},
  {k:"dep36", n:"정기예금 3년",   ic:"🔐", kind:"dep",  m:36, base:4.3, min:3,    d:"세 시즌을 통째로 묶는다."},
  {k:"sav12", n:"정기적금 1년",   ic:"📅", kind:"sav",  m:12, base:4.0, min:0.05, d:"매달 같은 금액을 넣는다. 만기에 원금+이자를 받는다."},
  {k:"sav24", n:"정기적금 2년",   ic:"📅", kind:"sav",  m:24, base:4.5, min:0.05, d:"두 시즌을 꾸준히 붓는다."},
  {k:"sav36", n:"정기적금 3년",   ic:"🗓️", kind:"sav",  m:36, base:5.0, min:0.05, d:"길게 붓는 만큼 금리가 좋다."},
  {k:"youth", n:"청년우대적금",   ic:"🌱", kind:"sav",  m:24, base:6.2, min:0.05, max:0.3, d:"월 납입 한도가 낮은 대신 금리가 파격적이다."},
  {k:"spec",  n:"특판 예금",      ic:"⭐", kind:"dep",  m:12, base:5.4, min:2, spec:1, d:"기간 한정 특판. 창구에 뜰 때만 가입할 수 있다."}
];
/* 우대금리 조건 — 채우면 금리가 붙는다 */
const BANK_BONUS=[
  {k:"pay",  n:"급여이체",     v:0.35, d:"감독 월급을 이 은행으로 받습니다"},
  {k:"auto", n:"자동이체 3건", v:0.20, d:"공과금·관리비 자동이체"},
  {k:"card", n:"체크카드 실적", v:0.25, d:"월 30만원 이상 사용"},
  {k:"long", n:"주거래 3년",   v:0.30, d:"이 은행과 3년 이상 거래"}
];
const BANK_TAX=0.154;        // 이자소득세 15.4%
const BANK_TAX_MG=0.014;     // 상호금융 조합원 과세특례 1.4%
function bank(){
  const M=me();
  if(!M.bank) M.bank={main:"kb", acc:[], loan:[], score:700, sid:0, hist:[], since:{}, spec:null, bonus:{}};
  const B=M.bank;
  if(!Array.isArray(B.acc)) B.acc=[];
  if(!Array.isArray(B.loan)) B.loan=[];
  if(!B.since) B.since={};
  if(!B.bonus) B.bonus={};
  if(B.score==null) B.score=700;
  return B;
}
function bankDef(k){ return BANKS.find(x=>x.k===k)||BANKS[0]; }
function prodDef(k){ return BANK_PROD.find(x=>x.k===k)||BANK_PROD[0]; }
/* 기준금리 — 증시 분위기를 따라 아주 천천히 움직인다 */
function bankBase(){
  if(G.bankBase==null) G.bankBase=3.25;
  return Math.round(G.bankBase*100)/100;
}
function bankBaseTick(){
  if(G.bankBase==null) G.bankBase=3.25;
  /* 90일마다 금통위 — 시장이 뜨거우면 올리고, 식으면 내린다 */
  if((G.day||0)>0 && (G.day||0)%90===0){
    let mood=0;
    try{ mood=(stkState()&&stkState().mood)||0; }catch(e){}
    let dv=0;
    const r=Math.random();
    if(mood>0.004 && r<0.55) dv=0.25;
    else if(mood<-0.004 && r<0.55) dv=-0.25;
    else if(r<0.18) dv=(Math.random()<0.5?0.25:-0.25);
    if(dv){
      G.bankBase=clamp(Math.round((G.bankBase+dv)*100)/100, 0.5, 8);
      const txt=`🏦 금융통화위원회, 기준금리 ${dv>0?"인상":"인하"} — 연 <b>${G.bankBase}%</b>`;
      addNews(txt, null, "club");
      try{ notifyBank(`${txt} <span class="small">— 예·적금과 대출 금리가 함께 움직입니다.</span>`, "info"); }catch(e){}
    }
  }
}
/* 신용점수 — 300~1000 */
function bankScore(){
  const B=bank(), M=me();
  let s=B.score||700;
  try{ if(typeof stkBadCredit==="function" && stkBadCredit()) s-=180; }catch(e){}
  try{ s += clamp(mgrPrestige()*1.2, -30, 40); }catch(e){}
  try{ s += clamp((M.cash||0)*0.8, 0, 40); }catch(e){}
  /* ⚠ 연체는 매달 내부 점수를 깎는다. 여기서 또 크게 빼면 이중 처벌이 되어
     한 번 밀린 것만으로 741 → 403 까지 떨어졌다(실측). 「지금 연체 중」이라는 표시만 남긴다. */
  const od=(B.loan||[]).filter(x=>x.late>0).length;
  s -= od*22;
  return clamp(Math.round(s), 300, 1000);
}
function bankGrade(){
  const s=bankScore();
  return s>=900?{n:"1등급", c:"#3fb950"} : s>=820?{n:"2등급", c:"#56d364"}
       : s>=740?{n:"3등급", c:"#7ee2a8"} : s>=660?{n:"4등급", c:"#e3b341"}
       : s>=580?{n:"5등급", c:"#d29922"} : s>=500?{n:"6등급", c:"#ff9d5c"}
       : s>=420?{n:"7등급", c:"#f85149"} : {n:"8등급 이하", c:"#f85149"};
}
/* 우대금리 합계 */
function bankBonusRate(bk){
  const B=bank();
  const on=B.bonus[bk]||{};
  let v=0;
  for(const x of BANK_BONUS) if(on[x.k]) v+=x.v;
  /* 주거래 기간은 자동으로 붙는다 */
  const since=B.since[bk];
  if(since!=null && (G.season-since)>=3) v+=0; // long 조건은 토글에서 처리
  return Math.round(v*100)/100;
}
/* 이 은행·상품의 최종 금리(연 %) */
function bankRate(bk, pk){
  const BK=bankDef(bk), P=prodDef(pk);
  const base=bankBase()-3.25;                        // 기준금리 변동분
  let r=P.base + base*0.85;
  r += (P.kind==="sav"? BK.sav : BK.dep);
  r += bankBonusRate(bk);
  if(P.spec) r += 0.6;
  return Math.round(clamp(r, 0.1, 14)*100)/100;
}
/* 대출 금리 — 신용점수가 가장 크게 작용한다 */
function bankLoanRate(bk){
  const BK=bankDef(bk);
  const s=bankScore();
  const spread=clamp((760-s)/100*1.35, -1.2, 7.5);
  let r=bankBase()+1.9+spread+BK.loan;
  const B=bank();
  if((B.bonus[bk]||{}).pay) r-=0.35;               // 급여이체 우대
  return Math.round(clamp(r, 2.2, 19)*100)/100;
}
/* 신용대출 한도 — 연봉 배수 × 은행 성향 × 신용 */
/* 대출 심사에 쓰는 「증빙 가능한 소득」 — 무직이면 재직 증명이 안 된다 */
function bankIncome(){
  try{ if(G.jobless) return 0.5; }catch(e){}
  try{ return mgrSalary()||3; }catch(e){ return 3; }
}
function bankLoanMax(bk){
  try{ if(typeof stkBadCredit==="function" && stkBadCredit()) return 0; }catch(e){}
  const BK=bankDef(bk);
  let sal=bankIncome();
  const s=bankScore();
  const k=clamp((s-450)/350, 0.15, 1.25);
  const cap=Math.round(sal*BK.ltd*k*100)/100;
  const now=(bank().loan||[]).filter(x=>x.bk===bk).reduce((n,x)=>n+x.bal, 0);
  return Math.max(0, Math.round((cap-now)*100)/100);
}
function bankLoanTotal(){ return (bank().loan||[]).reduce((n,x)=>n+x.bal, 0); }
function bankDepTotal(){ return (bank().acc||[]).reduce((n,x)=>n+x.bal, 0); }
/* ── 계좌 개설 · 해지 ─────────────────────────────────────── */
function bankOpen(bk, pk, amt){
  const M=me(), B=bank();
  const BK=bankDef(bk), P=prodDef(pk);
  const a=Math.round((parseFloat(amt)||0)*100)/100;
  if(a<=0){ flash("금액을 입력하세요.","warn"); return; }
  if(a<P.min){ flash(`${P.n}은(는) 최소 ${P.min}억부터 가입할 수 있습니다.`,"warn"); return; }
  if(P.max && a>P.max){ flash(`${P.n}은(는) ${P.kind==="sav"?"월 납입":"가입 금액"} 한도가 ${P.max}억입니다.`,"warn"); return; }
  if(P.spec && (!B.spec || B.spec.bk!==bk || (G.day||0)>B.spec.until)){ flash("지금은 특판이 열려 있지 않습니다.","warn"); return; }
  const first = P.kind==="sav" ? a : a;            // 적금은 첫 회차 납입
  if(first>M.cash){ flash(`${first}억이 부족합니다 (보유 ${moneyEok(M.cash)}).`,"warn"); return; }
  const rate=bankRate(bk, pk);
  mePay(-first, `${BK.n} ${P.n} ${P.kind==="sav"?"1회차 납입":"가입"}`);
  const id=++B.sid;
  B.acc.push({id, bk, pk, rate, m:P.m, mo:P.kind==="sav"?a:0,
              bal:first, prin:first, start:(G.day||0), s:G.season,
              due:P.m? (G.day||0)+P.m*30 : null, paid:P.kind==="sav"?1:0, kind:P.kind});
  if(B.since[bk]==null) B.since[bk]=G.season;
  if(P.spec) B.spec=null;
  B.hist.unshift({d:G.day||0, t:`${BK.ic} ${BK.n} ${P.n} 가입 — ${a}억 · 연 ${rate}%`});
  B.hist=B.hist.slice(0,30);
  flash(`${BK.ic} <b>${P.n}</b> 가입 — 연 <b>${rate}%</b>`,"good");
  BANK_AMT=""; saveGame(); show("mylife");
}
/* 중도해지 — 약정 이자를 거의 못 받는다 */
function bankClose(id){
  const M=me(), B=bank();
  const i=B.acc.findIndex(x=>x.id===id); if(i<0) return;
  const A=B.acc[i], BK=bankDef(A.bk), P=prodDef(A.pk);
  const mature=(A.due==null) || (G.day||0)>=A.due;
  const gross=A.bal;
  /* 만기 전이면 중도해지 이율(약정의 20%)만 인정 — 이미 붙은 이자를 깎는다 */
  const earned=Math.max(0, gross-A.prin);
  const cut=mature?0:Math.round(earned*0.80*100)/100;
  const tax=Math.round(Math.max(0, earned-cut)*(A.bk==="mg"?BANK_TAX_MG:BANK_TAX)*100)/100;
  const net=Math.round((gross-cut-tax)*100)/100;
  showConfirm(`<b>${BK.ic} ${P.n} ${mature?"만기 해지":"중도 해지"}</b>\n\n`+
    `· 원금 ${A.prin.toFixed(2)}억 · 이자 ${earned.toFixed(2)}억\n`+
    (mature?"":`· <span style="color:var(--red)">중도해지 — 약정이자의 80%를 잃습니다 (−${cut}억)</span>\n`)+
    `· 이자소득세 ${tax}억 <span class="small">(${A.bk==="mg"?"조합원 과세특례 1.4%":"15.4%"})</span>\n\n`+
    `실수령 <b class="money">${net}억</b>`,
    ()=>{
      mePay(net, `${BK.n} ${P.n} ${mature?"만기":"중도"} 해지`);
      B.hist.unshift({d:G.day||0, t:`${BK.ic} ${P.n} ${mature?"만기":"중도"} 해지 — ${net}억 수령`});
      B.hist=B.hist.slice(0,30);
      if(mature) B.score=clamp((B.score||700)+8, 300, 1000);
      B.acc.splice(i,1); saveGame(); show("mylife");
    }, {okLabel:`${mature?"만기 해지":"중도 해지"} (${net}억)`, cancelLabel:"그대로 둔다", danger:!mature});
}
/* ── 대출 ─────────────────────────────────────────────────── */
function bankBorrow(bk, amt, months){
  const M=me(), B=bank();
  const BK=bankDef(bk);
  /* 🕊️ 무직 — 재직 증명이 안 되면 한도가 거의 나오지 않는다 */
  try{ if(G.jobless && (parseFloat(amt)||0) > bankLoanMax(bk)){
    flash(`${BK.n}: "지금은 재직 증명이 어려우십니다." — 무직 상태의 한도는 ${bankLoanMax(bk).toFixed(2)}억입니다.`,"warn"); return;
  } }catch(e){}
  /* 💀 파산 이력 — 제1금융권은 회복 기간 동안 아예 심사를 받지 않는다 */
  try{ if(typeof stkBadCredit==="function" && stkBadCredit()){
    flash(`파산 이력으로 신용대출 심사가 거절됩니다 — ${stkBadCreditLeft()}시즌 뒤에 다시 신청할 수 있습니다.`,"warn"); return;
  } }catch(e){}
  const a=Math.round((parseFloat(amt)||0)*100)/100;
  if(a<=0){ flash("금액을 입력하세요.","warn"); return; }
  if(a>bankLoanMax(bk)){ flash(`${BK.n} 한도는 ${bankLoanMax(bk).toFixed(2)}억입니다 (신용 ${bankGrade().n}).`,"warn"); return; }
  const rate=bankLoanRate(bk);
  const m=months||36;
  showConfirm(`<b>${BK.ic} ${BK.n} 신용대출</b>\n\n`+
    `· 금액 <b>${a}억</b> · 기간 ${m}개월\n`+
    `· 금리 <b>연 ${rate}%</b> <span class="small">(신용 ${bankGrade().n} · 기준금리 ${bankBase()}%)</span>\n`+
    `· 매달 원리금 약 <b>${(a/m + a*rate/100/12).toFixed(3)}억</b>\n`+
    `· 총 이자 약 ${(a*rate/100*m/12/2).toFixed(2)}억\n\n`+
    `<span class="small">매달 자동 상환됩니다. 잔고가 모자라면 연체되고 신용점수가 떨어집니다.</span>`,
    ()=>{
      mePay(a, `${BK.n} 신용대출 실행 (연 ${rate}%)`);
      B.loan.push({id:++B.sid, bk, bal:a, prin:a, rate, m, left:m, start:(G.day||0), late:0});
      if(B.since[bk]==null) B.since[bk]=G.season;
      B.hist.unshift({d:G.day||0, t:`${BK.ic} ${BK.n} 신용대출 ${a}억 실행 — 연 ${rate}% · ${m}개월`});
      B.hist=B.hist.slice(0,30);
      BANK_AMT=""; saveGame(); show("mylife");
    }, {okLabel:`💳 ${a}억 대출`, cancelLabel:"취소"});
}
function bankRepay(id){
  const M=me(), B=bank();
  const L=B.loan.find(x=>x.id===id); if(!L) return;
  const BK=bankDef(L.bk);
  /* 중도상환수수료 — 남은 기간에 비례 */
  const fee=Math.round(L.bal*0.012*(L.left/Math.max(1,L.m))*100)/100;
  const need=Math.round((L.bal+fee)*100)/100;
  if(need>M.cash){ flash(`전액 상환에 ${need}억이 필요합니다 (보유 ${moneyEok(M.cash)}).`,"warn"); return; }
  showConfirm(`<b>${BK.ic} ${BK.n} 대출 전액 상환</b>\n\n· 잔액 ${L.bal.toFixed(2)}억\n· 중도상환수수료 ${fee}억\n\n합계 <b class="money">${need}억</b>`,
    ()=>{
      mePay(-need, `${BK.n} 대출 전액 상환`);
      B.score=clamp((B.score||700)+15, 300, 1000);
      B.hist.unshift({d:G.day||0, t:`${BK.ic} ${BK.n} 대출 전액 상환 — 신용점수 +15`});
      B.hist=B.hist.slice(0,30);
      B.loan=B.loan.filter(x=>x.id!==id);
      saveGame(); show("mylife");
    }, {okLabel:`💵 ${need}억 상환`, cancelLabel:"취소"});
}
/* ── 매달 정산 — 이자·납입·상환 ──────────────────────────── */
function bankMonthTick(){
  const M=me(), B=bank();
  /* ① 예·적금 */
  for(let i=B.acc.length-1;i>=0;i--){
    const A=B.acc[i], P=prodDef(A.pk), BK=bankDef(A.bk);
    /* 이자 — 월할 */
    A.bal=Math.round((A.bal*(1+A.rate/100/12))*1e4)/1e4;
    /* 적금 자동이체 */
    if(A.kind==="sav" && A.paid<A.m){
      if(M.cash>=A.mo){
        mePay(-A.mo, `${BK.n} ${P.n} ${A.paid+1}회차 납입`);
        A.bal=Math.round((A.bal+A.mo)*1e4)/1e4;
        A.prin=Math.round((A.prin+A.mo)*100)/100;
        A.paid++;
      } else {
        A.miss=(A.miss||0)+1;
        if(A.miss===1) try{ notifyBank(`⚠️ <b>${BK.n} ${P.n}</b> 자동이체가 실패했습니다 (잔고 부족). 회차를 거르면 만기 금리가 깎입니다.`,"warn"); }catch(e){}
        A.rate=Math.round(Math.max(0.5, A.rate-0.15)*100)/100;
      }
    }
    /* 만기 */
    if(A.due!=null && (G.day||0)>=A.due){
      const earned=Math.max(0, A.bal-A.prin);
      const tax=Math.round(earned*(A.bk==="mg"?BANK_TAX_MG:BANK_TAX)*100)/100;
      const net=Math.round((A.bal-tax)*100)/100;
      mePay(net, `${BK.n} ${P.n} 만기 수령 (원금 ${A.prin.toFixed(2)}억 + 이자 ${earned.toFixed(2)}억)`);
      B.score=clamp((B.score||700)+8, 300, 1000);
      B.hist.unshift({d:G.day||0, t:`${BK.ic} <b>${P.n}</b> 만기 — ${net}억 수령 (이자 ${earned.toFixed(2)}억 · 세금 ${tax}억)`});
      B.hist=B.hist.slice(0,30);
      try{ notifyBank(`🎊 <b>${BK.n} ${P.n}</b> 만기 — <b>${net}억</b>을 받았습니다 (이자 ${earned.toFixed(2)}억).`,"good"); }catch(e){}
      B.acc.splice(i,1);
    }
  }
  /* ② 대출 원리금 자동 상환 */
  for(let i=B.loan.length-1;i>=0;i--){
    const L=B.loan[i], BK=bankDef(L.bk);
    const inter=Math.round(L.bal*L.rate/100/12*1e4)/1e4;
    const prin=Math.round(L.prin/L.m*1e4)/1e4;
    const due=Math.round((inter+prin)*1e4)/1e4;
    if(M.cash>=due){
      mePay(-due, `${BK.n} 대출 상환 (원금 ${prin.toFixed(3)} + 이자 ${inter.toFixed(3)})`);
      L.bal=Math.round(Math.max(0, L.bal-prin)*1e4)/1e4;
      L.left--;
      if(L.late>0){ L.late=0; }
      if(L.bal<=0.005 || L.left<=0){
        B.score=clamp((B.score||700)+20, 300, 1000);
        B.hist.unshift({d:G.day||0, t:`${BK.ic} ${BK.n} 대출 완제 — 신용점수 +20`});
        try{ notifyBank(`✅ <b>${BK.n}</b> 대출을 다 갚았습니다. 신용점수가 올랐습니다.`,"good"); }catch(e){}
        B.loan.splice(i,1);
      }
    } else {
      /* 연체 — 연체이자가 붙고 신용이 깎인다 */
      L.late=(L.late||0)+1;
      L.bal=Math.round((L.bal*(1+(L.rate+6)/100/12))*1e4)/1e4;
      B.score=clamp((B.score||700)-22, 300, 1000);
      B.hist.unshift({d:G.day||0, t:`⚠️ ${BK.ic} ${BK.n} 대출 연체 ${L.late}회 — 신용점수 −22`});
      try{ notifyBank(`⚠️ <b>${BK.n}</b> 대출이 연체됐습니다 (${L.late}회). 연체이자가 붙고 신용점수가 떨어집니다.`,"warn"); }catch(e){}
      if(L.late>=4){
        addNews(`🏦 ${userTeam()?userTeam().short:""} 감독, 금융권 채무 연체로 신용유의자 등록`, "warn", "club");
        B.score=clamp((B.score||700)-60, 300, 1000);
        L.late=0;
      }
    }
  }
  /* 🩹 자연 회복 — 연체 없이 한 달을 넘기면 신용이 조금씩 돌아온다.
     회복 상한은 「지금 상태에서 도달할 수 있는 곳」까지다 — 파산 이력이 남아 있으면 낮게 걸린다. */
  /* 🕊️ 무직 — 소득이 없는 달이 이어지면 신용도 조금씩 내려간다 */
  try{ if(G.jobless) B.score=clamp((B.score||700)-4, 300, 1000); }catch(e){}
  const late=(B.loan||[]).some(x=>x.late>0);
  if(!late && !G.jobless){
    let cap=720;
    try{ if(typeof stkBadCredit==="function" && stkBadCredit()) cap=560; }catch(e){}
    try{ if((M.bankrupt||0)>0) cap=Math.min(cap, 700-((M.bankrupt||0)-1)*40); }catch(e){}
    if((B.score||700)<cap) B.score=clamp((B.score||700)+(B.loan.length?5:3), 300, 1000);
  }
  B.hist=B.hist.slice(0,30);
}
/* 특판 — 가끔 창구에 뜬다 */
function bankSpecTick(){
  const B=bank();
  if(B.spec && (G.day||0)>B.spec.until) B.spec=null;
  if(B.spec) return;
  if(Math.random()<0.014){
    const BK=pick(BANKS);
    B.spec={bk:BK.k, until:(G.day||0)+14};
    try{ notifyBank(`⭐ <b>${BK.n}</b> 특판 예금이 열렸습니다 — 연 ${bankRate(BK.k,"spec")}% · 2주 한정`,"good"); }catch(e){}
    B.hist.unshift({d:G.day||0, t:`⭐ ${BK.ic} ${BK.n} 특판 예금 개시 — 연 ${bankRate(BK.k,"spec")}% (2주)`});
  }
}
/* 우대조건 토글 */
function bankBonusToggle(bk, k){
  const B=bank();
  const on=B.bonus[bk]||(B.bonus[bk]={});
  if(k==="pay"){                                   // 급여이체는 한 은행만
    for(const b in B.bonus) if(B.bonus[b]) delete B.bonus[b].pay;
    on.pay=1; B.main=bk;
  } else on[k]=on[k]?0:1;
  saveGame(); show("mylife");
}
/* ── 🏦 은행 화면 ─────────────────────────────────────────── */
let BANK_SEL="kb", BANK_PROD_SEL="dep12", BANK_AMT="", BANK_TAB="save", BANK_MON=36;
function bankSetBank(k){ BANK_SEL=k; show("mylife"); }
function bankSetProd(k){ BANK_PROD_SEL=k; show("mylife"); }
/* ⚠ 제보 — 「적금 한도가 0.몇억인데 월 납입액 소수점 설정이 적용 안 된다」.
   일부 모바일 키패드(inputmode=decimal)는 마침표 대신 쉼표만 있다 — 쉼표를 소수점으로 받는다. */
function bankSetAmt(v){ BANK_AMT=String(v||"").replace(/,/g,".").replace(/[^0-9.]/g,""); }
function bankSetTab(k){ BANK_TAB=k; show("mylife"); }
function bankSetMon(m){ BANK_MON=m; show("mylife"); }
function bankView(){
  const M=me(), B=bank();
  const gr=bankGrade(), score=bankScore();
  const dep=bankDepTotal(), loan=bankLoanTotal();
  const BK=bankDef(BANK_SEL), P=prodDef(BANK_PROD_SEL);
  const rate=bankRate(BANK_SEL, BANK_PROD_SEL);
  const lrate=bankLoanRate(BANK_SEL);
  const lmax=bankLoanMax(BANK_SEL);
  const amt=parseFloat(BANK_AMT)||0;
  const specOn=B.spec && B.spec.bk===BANK_SEL && (G.day||0)<=B.spec.until;
  /* 만기 예상 수령액 */
  let est=0;
  if(amt>0 && P.m){
    if(P.kind==="sav"){ const n=P.m; est=amt*n + amt*n*(n+1)/2*(rate/100/12); }
    else est=amt*Math.pow(1+rate/100/12, P.m);
    const tax=(est-(P.kind==="sav"?amt*P.m:amt))*(BANK_SEL==="mg"?BANK_TAX_MG:BANK_TAX);
    est=Math.round((est-tax)*100)/100;
  }
  const tab=(k,l)=>`<button class="mini ${BANK_TAB===k?"sel":""}" style="padding:7px 14px" onclick="bankSetTab('${k}')">${l}</button>`;
  return `<div class="card">
    <h3>🏦 은행 <span class="small">— 기준금리 <b>연 ${bankBase()}%</b></span></h3>
    <div class="stkSum">
      <div><span>신용점수</span><b style="color:${gr.c}">${score}</b>
        <span class="small" style="display:block;color:${gr.c}">${gr.n}</span></div>
      <div><span>예·적금 잔액</span><b class="money">${dep.toFixed(2)}억</b></div>
      <div><span>대출 잔액</span><b style="color:${loan>0?"#ff9d5c":"var(--sub)"}">${loan.toFixed(2)}억</b></div>
      <div><span>계좌</span><b>${B.acc.length}개 · 대출 ${B.loan.length}건</b></div>
      <div><span>주거래</span><b>${bankDef(B.main||"kb").ic} ${bankDef(B.main||"kb").n}</b></div>
    </div>
    ${G.jobless?`<div class="msg warn" style="margin-top:8px">🕊️ <b>무직 상태</b>입니다 — 재직 증명이 되지 않아 신용대출 한도가 거의 나오지 않고,
      소득이 없는 달마다 신용점수가 조금씩 내려갑니다. 예·적금 가입과 해지는 그대로 됩니다.</div>`:""}
    ${B.loan.some(x=>x.late>0)?`<div class="msg warn" style="margin-top:8px">⚠️ 연체 중인 대출이 있습니다 — 신용점수가 계속 깎이고 연체이자가 붙습니다.</div>`:""}
    ${B.spec?`<div class="msg good" style="margin-top:8px">⭐ <b>${bankDef(B.spec.bk).n}</b> 특판 예금 진행 중 —
      연 <b>${bankRate(B.spec.bk,"spec")}%</b> · ${Math.max(0,B.spec.until-(G.day||0))}일 남음</div>`:""}
  </div>
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0">
    ${tab("save","💰 예금·적금")}${tab("loan","💳 신용대출")}${tab("my","📂 내 계좌"+(B.acc.length+B.loan.length?` (${B.acc.length+B.loan.length})`:""))}${tab("hist","📜 거래 기록")}
  </div>
  ${BANK_TAB==="my"?bankMyHtml()
   :BANK_TAB==="hist"?`<div class="card"><h3>📜 거래 기록</h3>
      ${B.hist.length?B.hist.slice(0,24).map(x=>`<div class="small" style="padding:5px 0;border-bottom:1px solid #21262d">
        <span style="color:var(--sub)">${dateLabel(x.d)}</span> ${x.t}</div>`).join("")
        :`<p class="small" style="padding:8px 2px">거래 기록이 없습니다.</p>`}</div>`
   :`<div class="card"><h3>🏛️ 은행 선택</h3>
    <div class="bankGrid">
      ${BANKS.map(b=>`<div class="bankCard ${BANK_SEL===b.k?"on":""}" onclick="bankSetBank('${b.k}')">
        <div class="bankH"><span class="bankIc">${b.ic}</span><b>${b.n}</b>
          <span class="stkTag">${b.t}</span>${B.main===b.k?'<span class="stkTag" style="background:#12331d;color:#7ee2a8">주거래</span>':""}</div>
        <div class="small" style="color:var(--sub);line-height:1.5">${b.d}</div>
        <div class="bankR">
          <span>예금 ${b.dep>=0?"+":""}${b.dep.toFixed(2)}%</span>
          <span>적금 ${b.sav>=0?"+":""}${b.sav.toFixed(2)}%</span>
          <span>대출 ${b.loan>=0?"+":""}${b.loan.toFixed(2)}%</span>
          <span>한도 연봉×${b.ltd}</span>
          <span title="파산해도 이 금액까지는 지켜집니다">🛟 보호 ${b.safe}억</span>
        </div>
      </div>`).join("")}
    </div>
    <h4 class="small" style="margin:12px 0 5px;color:var(--sub)">${BK.ic} ${BK.n} 우대조건 — 채울수록 금리가 올라갑니다</h4>
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      ${BANK_BONUS.map(x=>{ const on=(B.bonus[BANK_SEL]||{})[x.k];
        return `<button class="psChip ${on?"on":""}" style="padding:6px 10px;font-size:11.5px" onclick="bankBonusToggle('${BANK_SEL}','${x.k}')"
          >${on?"☑":"☐"} ${x.n} +${x.v}%<span class="small" style="opacity:.7"> · ${x.d}</span></button>`;}).join("")}
    </div>
  </div>
  ${BANK_TAB==="save"?`<div class="card"><h3>💰 예금 · 적금 <span class="small">— ${BK.ic} ${BK.n}</span></h3>
    <div class="bankProds">
      ${BANK_PROD.map(x=>{ const r=bankRate(BANK_SEL, x.k); const lock=x.spec&&!specOn;
        return `<div class="bankProd ${BANK_PROD_SEL===x.k?"on":""} ${lock?"lock":""}" ${lock?"":`onclick="bankSetProd('${x.k}')"`}>
          <div><span class="bankIc">${x.ic}</span><b>${x.n}</b>${lock?' <span class="stkTag">특판 대기</span>':""}</div>
          <div class="bankRate">연 <b>${r}%</b></div>
          <div class="small" style="color:var(--sub)">${x.m?x.m+"개월":"수시입출"} · 최소 ${x.min}억${x.max?` · 한도 ${x.max}억`:""}</div>
        </div>`;}).join("")}
    </div>
    <div class="msg info" style="margin:9px 0">${P.ic} <b>${P.n}</b> — ${P.d}<br>
      <span class="small">기본 ${P.base}% + 기준금리 반영 + ${BK.n} ${P.kind==="sav"?"적금":"예금"} ${(P.kind==="sav"?BK.sav:BK.dep)>=0?"+":""}${(P.kind==="sav"?BK.sav:BK.dep).toFixed(2)}%
      + 우대 ${bankBonusRate(BANK_SEL).toFixed(2)}%${P.spec?" + 특판 0.6%":""} = <b style="color:var(--gold)">연 ${rate}%</b></span></div>
    <div class="stkOrder">
      <input type="text" inputmode="decimal" placeholder="${P.kind==="sav"?"월 납입액(억)":"가입 금액(억)"}" value="${BANK_AMT}" oninput="bankSetAmt(this.value)"
        style="flex:1;min-width:110px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="BANK_AMT=String(Math.round(((parseFloat(BANK_AMT)||0)+0.05)*100)/100);show('mylife')">+0.05</button>
      <button class="mini" onclick="BANK_AMT=String(Math.round(((parseFloat(BANK_AMT)||0)+1)*100)/100);show('mylife')">+1</button>
      <button class="mini" onclick="BANK_AMT=String(Math.round(((parseFloat(BANK_AMT)||0)+10)*100)/100);show('mylife')">+10</button>
      ${P.max?`<button class="mini" onclick="BANK_AMT='${P.max}';show('mylife')">한도 ${P.max}억</button>`:""}
      <button class="mini" onclick="BANK_AMT=me().cash.toFixed(2);show('mylife')">전액</button>
    </div>
    ${amt>0&&P.m?`<div class="small" style="margin:7px 0;color:var(--sub)">
      ${P.kind==="sav"?`매달 <b>${amt}억</b>씩 ${P.m}회 납입 — 총 납입 <b>${(amt*P.m).toFixed(2)}억</b>`
                      :`<b>${amt}억</b>을 ${P.m}개월 예치`}
      → 만기 세후 수령 <b class="money">${est}억</b>
      <span style="color:var(--green)">(+${(est-(P.kind==="sav"?amt*P.m:amt)).toFixed(2)}억)</span></div>`:""}
    <button class="mini" style="width:100%;padding:10px;border-color:var(--green);color:var(--green);font-weight:700"
      onclick="bankOpen('${BANK_SEL}','${BANK_PROD_SEL}',BANK_AMT)">${P.ic} ${P.n} 가입</button>
  </div>`
  :`<div class="card"><h3>💳 신용대출 <span class="small">— ${BK.ic} ${BK.n}</span></h3>
    <div class="msg ${score<600?"warn":"info"}" style="margin-bottom:8px">
      신용점수 <b style="color:${gr.c}">${score} (${gr.n})</b>에 따라 금리와 한도가 정해집니다.
      성실히 갚으면 점수가 오르고, 연체하면 크게 떨어집니다. 파산 이력이 있으면 −180점입니다.</div>
    <div class="stkSum" style="margin-bottom:8px">
      <div><span>대출 금리</span><b style="color:${lrate<=5?"var(--green)":lrate<=8?"var(--gold)":"#f85149"}">연 ${lrate}%</b></div>
      <div><span>한도</span><b>${lmax.toFixed(2)}억</b>
        <span class="small" style="display:block;color:var(--sub)">연봉×${BK.ltd} 기준</span></div>
      <div><span>기존 대출</span><b>${B.loan.filter(x=>x.bk===BANK_SEL).reduce((n,x)=>n+x.bal,0).toFixed(2)}억</b></div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px">
      ${[12,24,36,60].map(m=>`<button class="mini ${BANK_MON===m?"sel":""}" onclick="bankSetMon(${m})">${m}개월</button>`).join("")}
    </div>
    <div class="stkOrder">
      <input type="text" inputmode="decimal" placeholder="대출 금액(억)" value="${BANK_AMT}" oninput="bankSetAmt(this.value)"
        style="flex:1;min-width:110px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="BANK_AMT=bankLoanMax('${BANK_SEL}').toFixed(2);show('mylife')">최대</button>
    </div>
    ${amt>0?`<div class="small" style="margin:7px 0;color:var(--sub)">
      매달 원리금 약 <b>${(amt/BANK_MON + amt*lrate/100/12).toFixed(3)}억</b> · 총 이자 약 <b style="color:#ff9d5c">${(amt*lrate/100*BANK_MON/12/2).toFixed(2)}억</b>
      <span style="opacity:.75">— 매달 자동으로 빠져나갑니다</span></div>`:""}
    <button class="mini" style="width:100%;padding:10px;border-color:#ff9d5c;color:#ff9d5c;font-weight:700"
      onclick="bankBorrow('${BANK_SEL}',BANK_AMT,${BANK_MON})">💳 대출 신청</button>
  </div>`}`}`;
}
function bankMyHtml(){
  const B=bank();
  if(!B.acc.length && !B.loan.length)
    return `<div class="card"><h3>📂 내 계좌</h3><p class="small" style="padding:8px 2px">가입한 상품이 없습니다.</p></div>`;
  return `${B.acc.length?`<div class="card"><h3>💰 예·적금 <span class="small">${B.acc.length}건 · 합계 ${bankDepTotal().toFixed(2)}억</span></h3>
    ${B.acc.map(A=>{ const BK=bankDef(A.bk), P=prodDef(A.pk);
      const left=A.due!=null?Math.max(0,Math.ceil((A.due-(G.day||0))/30)):null;
      const earn=Math.max(0,A.bal-A.prin);
      return `<div class="propRow">
        <div class="propHead"><span class="bankIc">${P.ic}</span>
          <span class="propN"><b>${P.n}</b><span class="stkTag">${BK.ic} ${BK.n}</span>
            ${A.kind==="sav"?`<span class="stkTier" style="color:#7ee2a8;border-color:#7ee2a866">${A.paid}/${A.m}회 납입</span>`:""}
            ${A.miss?`<span class="stkTier" style="color:#f85149;border-color:#f8514966">이체 실패 ${A.miss}회</span>`:""}</span>
          <span class="propV"><b>${A.bal.toFixed(2)}억</b>
            <span class="small" style="color:var(--green)">이자 +${earn.toFixed(3)}억</span></span></div>
        <div class="small" style="color:var(--sub);margin:3px 0 5px">
          연 <b style="color:var(--gold)">${A.rate}%</b> · 원금 ${A.prin.toFixed(2)}억
          ${left!=null?` · 만기까지 <b>${left}개월</b>`:" · 수시입출"}
          ${A.kind==="sav"?` · 월 ${A.mo}억 자동이체`:""}</div>
        <div style="display:flex;gap:5px">
          <button class="mini" style="margin-left:auto;${left===0?"border-color:var(--green);color:var(--green)":""}" onclick="bankClose(${A.id})">
            ${left===0?"만기 해지":"중도 해지"}</button></div>
      </div>`;}).join("")}
  </div>`:""}
  ${B.loan.length?`<div class="card"><h3>💳 대출 <span class="small">${B.loan.length}건 · 잔액 ${bankLoanTotal().toFixed(2)}억</span></h3>
    ${B.loan.map(L=>{ const BK=bankDef(L.bk);
      return `<div class="propRow" style="${L.late?"border-color:#f8514966":""}">
        <div class="propHead"><span class="bankIc">${BK.ic}</span>
          <span class="propN"><b>${BK.n} 신용대출</b>
            ${L.late?`<span class="stkTier" style="color:#f85149;border-color:#f8514966">⚠️ 연체 ${L.late}회</span>`:""}</span>
          <span class="propV"><b style="color:#ff9d5c">${L.bal.toFixed(2)}억</b>
            <span class="small" style="color:var(--sub)">연 ${L.rate}%</span></span></div>
        <div class="small" style="color:var(--sub);margin:3px 0 5px">
          최초 ${L.prin}억 · ${L.m}개월 중 <b>${L.m-L.left}회</b> 상환 · 남은 ${L.left}회 ·
          월 상환 약 ${(L.prin/L.m + L.bal*L.rate/100/12).toFixed(3)}억</div>
        <div style="display:flex;gap:5px">
          <button class="mini" style="margin-left:auto;border-color:var(--green);color:var(--green)" onclick="bankRepay(${L.id})">전액 상환</button></div>
      </div>`;}).join("")}
  </div>`:""}`;
}

function homeOf(){ return HOMES.find(h=>h.k===me().home)||HOMES[0]; }
/* 감독 연봉 — 구단 규모와 리그가 정한다 (억/년) */
/* ═══════════════════════════════════════════════════════════════════════════
   📜 감독 계약 — 부임에도 끝이 있다
   지금까지 감독에게는 계약이 없었다. 부임한 라운드만 기록하고, 구단주 신뢰가 바닥나면
   경질되는 게 전부였다. 연봉도 계약이 아니라 구단 규모에서 매번 계산했다.
   ─ 이제 부임할 때 기간과 연봉을 맺는다.
     · 마지막 시즌 중반, 구단이 재계약을 판단한다 — 성적·신뢰·평판을 본다
     · 제안이 오면 연봉·기간·이적 예산 약속을 흥정한다 (3회)
     · 제안이 안 오면 시즌이 끝나는 날 계약 만료로 팀을 떠난다
     · 언제든 자진 사임할 수 있다 — 남은 계약만큼 위약금을 문다
   ═══════════════════════════════════════════════════════════════════════════ */
/* 구단 규모가 매기는 「시장가」 연봉 — 계약을 맺을 때의 기준선 */
function mgrWageBase(t){
  t=t||userTeam(); if(!t) return 2;
  const base=(t.div===1?3.2:1.4)+(t.fans||10)*0.045+(t.budget||0)*0.004;
  const tr=G.trust?(G.trust.owner-70)/100*0.8:0;
  return Math.round(clamp(base+tr, 1.0, 22)*10)/10;
}
function mgrCt(){
  if(G.jobless || !userTeam()) return null;
  if(!G.mgrCt || G.mgrCt.tid!==G.userTeamId){
    /* 구세이브·새 게임 — 지금 맡고 있는 구단과의 계약을 지금 시즌부터 소급해 맺어 둔다 */
    const t=userTeam();
    G.mgrCt={tid:t.id, from:G.season, years:3, wage:mgrWageBase(t),
             bud:0, signedAt:G.day||0, renewS:0, talk:null, hist:[]};
  }
  if(typeof G.mgrCt.years!=="number") G.mgrCt.years=3;
  if(typeof G.mgrCt.wage!=="number")  G.mgrCt.wage=mgrWageBase();
  return G.mgrCt;
}
function mgrCtLastSeason(){ const c=mgrCt(); return c ? c.from+c.years-1 : G.season; }
function mgrCtLeft(){ const c=mgrCt(); return c ? Math.max(0, mgrCtLastSeason()-G.season) : 0; }   // 올 시즌 뒤 남는 햇수
function mgrCtFinal(){ return !!mgrCt() && G.season>=mgrCtLastSeason(); }                          // 계약 마지막 시즌인가
function mgrSalary(){
  const c=mgrCt();
  if(c && c.wage>0) return c.wage;
  return mgrWageBase();
}
/* 구단이 감독을 어떻게 보고 있는가 — 재계약 판단의 점수 (0~100) */
function mgrStanding(){
  const t=userTeam(); if(!t) return 50;
  let v=50;
  try{ v += ((G.trust.owner||60)-60)*0.85; }catch(e){}
  try{ v += ((G.trust.fans ||60)-60)*0.30; }catch(e){}
  try{
    const tb=tableOf(t.div), pos=tb.findIndex(x=>x.isUser)+1, N=tb.length||12;
    if(pos>0) v += (1-(pos-1)/Math.max(1,N-1))*26 - 10;      // 1위 +16 · 최하위 −10
    if(G.goal && G.goal.req){ const miss=pos-G.goal.req; v -= clamp(miss*2.2, -12, 16); }
  }catch(e){}
  try{ v += clamp((mgrRep()-40)*0.22, -8, 12); }catch(e){}
  try{ if(G.eacl && G.eacl.champ===t.id) v+=10; }catch(e){}
  try{ v -= clamp((G.board&&G.board.warned||0)*4, 0, 12); }catch(e){}
  return clamp(Math.round(v), 0, 100);
}
/* 구단이 내밀 재계약 조건 — 서 있는 위치가 곧 협상력이다 */
function mgrRenewOffer(){
  const t=userTeam(); const c=mgrCt(); if(!t||!c) return null;
  const s=mgrStanding();
  const mkt=mgrWageBase(t);
  const years = s>=78 ? 3+ (Math.random()<0.35?1:0) : s>=62 ? 3 : s>=48 ? 2 : 1;
  const wage  = Math.round(clamp(mkt*(0.90+ (s-50)/100*0.55), mkt*0.75, mkt*1.55)*10)/10;
  const bud   = s>=70 ? Math.round((t.budget||0)*(0.10+Math.random()*0.12)*10)/10 : 0;
  return {years, wage, bud, s, tries:0, max:{years:years+2, wage:Math.round(wage*1.45*10)/10, bud:Math.round((bud+ (t.budget||0)*0.12)*10)/10}};
}
/* 🕰️ 하루가 지날 때 — 마지막 시즌 중반에 구단이 재계약을 판단한다 */
function mgrCtTick(){
  if(G.jobless || !userTeam()) return;
  if(G.phase!=="league") return;
  const c=mgrCt(); if(!c) return;
  if(!mgrCtFinal()) return;                        // 계약 마지막 시즌이 아니다
  if(c.renewS===G.season) return;                  // 올 시즌은 이미 판단했다
  const t=userTeam();
  const fixN=((t.div===1?G.k1Fix:G.k2Fix)||[]).length||33;
  const rd=t.div===1?G.r1:G.r2;
  if(rd < Math.round(fixN*0.55)) return;           // 시즌 중반부터 이야기가 나온다
  c.renewS=G.season;
  const s=mgrStanding();
  if(s>=46){
    c.talk=mgrRenewOffer();
    c.noRenew=0;
    try{ notify(`📜 <b>${t.name} 구단이 재계약을 제안했습니다.</b> 이번 시즌으로 계약이 끝납니다 — 🏠 오피스에서 확인하세요.`,"good"); }catch(e){}
    try{ addNews(`📜 <b>${t.name}, 감독과 재계약 협상 착수</b> — ${c.talk.years}년 · 연봉 ${c.talk.wage}억 제시`, "good", "club"); }catch(e){}
  } else {
    c.noRenew=1; c.talk=null;
    try{ notify(`📜 <b>재계약 제안이 오지 않았습니다.</b> 이번 시즌이 끝나면 계약이 만료됩니다.`,"warn"); }catch(e){}
    try{ addNews(`📜 <b>${t.name}, 감독 계약 연장 여부 「검토 중」</b> — 시즌 뒤 결별 가능성`, "warn", "club"); }catch(e){}
    try{ socialFill(SOC.sacked, 2+R(2), -1, {t:t.short}); }catch(e){}
  }
}
/* 📜 재계약 협상 — 3회까지 흥정한다 */
let CTASK={years:0, wage:0, bud:0};
function ctSet(k,v){ CTASK[k]=Math.max(0, parseFloat(String(v).replace(/[^0-9.]/g,""))||0); show("home"); }
function ctAccept(){
  const c=mgrCt(); if(!c||!c.talk) return;
  const t=userTeam(), o=c.talk;
  mgrSignContract(o.years, o.wage, o.bud);
  c.talk=null; c.noRenew=0;
  try{ addNews(`✍️ <b>${t.name}, 감독과 재계약</b> — ${o.years}년 · 연봉 ${o.wage}억${o.bud?` · 이적 예산 ${o.bud}억 추가 약속`:""}`, "good", "club"); }catch(e){}
  try{ adjustTrust("owner", 3, "재계약 체결"); adjustTrust("fans", 2, "감독 재계약"); }catch(e){}
  /* ⚠ 제보 — 재계약에 신임 부임 반응(hiredNew)이 나오던 것. 전용 풀로 교체. */
  try{ socialFill(SOC.mgrRenew, 3+R(2), 1, {t:t.short}); fmkFill(FMK.mgrRenew, 2+R(2), {t:t.short}); }catch(e){}
  try{ notify(`✍️ 재계약을 체결했습니다 — ${G.season+1}시즌부터 ${o.years}년 · 연봉 ${o.wage}억`,"good"); }catch(e){}
  saveGame(); show("home");
}
function ctCounter(){
  const c=mgrCt(); if(!c||!c.talk) return;
  const o=c.talk, t=userTeam();
  const wy=clamp(Math.round(CTASK.years||o.years),1,5);
  const ww=Math.round((CTASK.wage||o.wage)*10)/10;
  const wb=Math.round((CTASK.bud||0)*10)/10;
  o.tries=(o.tries||0)+1;
  /* 구단이 감당할 수 있는 선을 넘었는가 — 서 있는 위치가 곧 협상력이다 */
  const over=(ww-o.max.wage)/Math.max(0.5,o.max.wage)
            +(wy-o.max.years)*0.10
            +(wb-o.max.bud)/Math.max(1,o.max.bud||1)*0.35;
  if(over<=0 || Math.random() < clamp(0.55-over*1.4, 0.05, 0.9)){
    o.years=wy; o.wage=ww; o.bud=wb;
    ctAccept();
    return;
  }
  if(o.tries>=3){
    c.talk=null; c.noRenew=1;
    try{ adjustTrust("owner", -4, "재계약 협상 결렬"); }catch(e){}
    try{ notify("📜 <b>재계약 협상이 결렬됐습니다.</b> 이번 시즌이 끝나면 계약이 만료됩니다.","warn"); }catch(e){}
    try{ addNews(`📜 <b>${t.name}, 감독과 재계약 협상 결렬</b> — 시즌 뒤 결별`, "warn", "club"); }catch(e){}
    saveGame(); show("home"); return;
  }
  /* 중간에서 만난다 */
  /* 중간에서 만나되, 구단이 감당할 수 있는 선(max)을 절대 넘지 않는다 —
     터무니없는 요구를 먼저 던져 기준선을 끌어올리는 걸 막는다 */
  o.years=clamp(Math.min(o.max.years, Math.round((o.years+wy)/2)),1,5);
  o.wage =Math.round(Math.min(o.max.wage, (o.wage+ww)/2)*10)/10;
  o.bud  =Math.round(Math.min(o.max.bud, (o.bud+wb)/2)*10)/10;
  try{ notify(`📜 구단: "그 조건은 어렵습니다. ${o.years}년 · 연봉 ${o.wage}억${o.bud?` · 예산 ${o.bud}억`:""} 까지는 맞춰 보죠." (${o.tries}/3)`,"warn"); }catch(e){}
  show("home");
}
function ctReject(){
  const c=mgrCt(); if(!c||!c.talk) return;
  showConfirm(`<b>📜 재계약 제안을 거절합니다</b>\n\n이번 시즌이 끝나면 계약이 만료되어 팀을 떠납니다.\n<span class="small">구단주 신뢰가 떨어지고, 시즌 중에는 다시 제안이 오지 않습니다.</span>`,
    ()=>{ c.talk=null; c.noRenew=1;
      try{ adjustTrust("owner", -6, "재계약 거절"); }catch(e){}
      try{ addNews(`📜 <b>감독, 재계약 제안 거절</b> — 시즌 뒤 팀을 떠난다`, "warn", "club"); }catch(e){}
      saveGame(); show("home"); },
    {okLabel:"거절한다", cancelLabel:"다시 생각한다"});
}
/* 계약 체결 — 부임·재계약이 함께 쓴다 */
function mgrSignContract(years, wage, bud){
  const t=userTeam(); if(!t) return;
  const from = (G.mgrCt && G.mgrCt.tid===t.id) ? G.season+1 : G.season;   // 재계약은 다음 시즌부터
  G.mgrCt={tid:t.id, from, years:clamp(Math.round(years),1,5), wage:Math.round(wage*10)/10,
           bud:Math.round((bud||0)*10)/10, signedAt:G.day||0, renewS:0, talk:null, noRenew:0,
           hist:(G.mgrCt&&G.mgrCt.hist)||[]};
  if(bud>0){ t.budget=Math.round((t.budget+bud)*10)/10;
    try{ addNews(`💰 재계약 조건으로 이적 예산 <b>${bud}억</b>이 배정되었습니다.`, "good", "club"); }catch(e){} }
}
/* 🚪 자진 사임 — 남은 계약만큼 위약금을 문다 */
/* 위약금 — 남은 계약에 비례하되 상한이 있다.
   ⚠ 제보 — 「부임하자마자 자진 사임하는데 안 되네?」
      3년 계약 직후에 나가려니 연봉의 1.65배가 잡혔고, 부임 계약금(연봉의 절반)뿐인 현금으로는
      낼 수가 없어서 「사임 불가」가 됐다. 현실에서 감독이 돈이 없어 사임을 못 하지는 않는다.
      ─ ① 상한을 씌우고(연봉 2년치) ② 모자라면 미납으로 남기고 나갈 수 있게 한다. */
const QUIT_CAP_Y=2.0;              // 위약금 상한 — 연봉 몇 년치까지
function mgrQuitFee(){
  const c=mgrCt(); if(!c) return 0;
  const leftY=mgrCtLeft() + (mgrCtFinal()?0.4:1);        // 올 시즌 잔여분 + 남은 햇수
  const inSeason=(G.phase==="league");
  let fee=c.wage*leftY*0.55;
  if(inSeason) fee*=1.5;                                  // 시즌 중 이탈은 더 비싸다
  fee=Math.min(fee, c.wage*QUIT_CAP_Y);                   // 상한
  return Math.max(0.3, Math.round(fee*100)/100);
}
/* 🚪 사임의 맥락 — 며칠 만인가, 몇 경기나 치렀는가, 몇 년을 함께했는가
   ⚠ 제보(스크린샷) — 「3년 재계약에 2년 다 하고 3년차인데 "부임 0일 만입니다"가 뜬다」.
   원인 — G.day 도, 라운드(G.r1/r2)도 시즌마다 0으로 돌아가는데 signedAt·hiredAtR 은
   지난 시즌 값이라 경과가 음수→0으로 뭉개졌다. 재임 연차는 커리어 장부의 현재
   구간(s0, 시즌 단위)으로 잰다 — 그건 리셋되지 않는다. */
function mgrQuitCtx(){
  const t=userTeam();
  const c=(G.mgrCt && G.mgrCt.tid===(t&&t.id)) ? G.mgrCt : null;
  let joinS=G.season;
  try{ const C=mgrCv(), cur=C.spells[C.spells.length-1];
    if(cur && !cur.done && cur.tid===(t&&t.id)) joinS=cur.s0||G.season; }catch(e){}
  const years=Math.max(0, G.season-joinS);
  const days=Math.max(0, (G.day||0)-((years>0)?0:((c&&c.signedAt)||0))) + years*365;
  const rd=t ? Math.max(0,(t.div===1?G.r1:G.r2)-(years>0?0:(G.hiredAtR||0))) : 0;
  const played=Math.max(0, (t?(t.W||0)+(t.Dw||0)+(t.L||0):0));
  const inSeason=(G.phase==="league");
  let kind="end";
  if(years===0 && (rd<=3 || days<=24)) kind="instant";   // 부임 첫해 초반에만 「부임하자마자」다
  else if(inSeason) kind="mid";
  /* 🕊️ 요청 — 「구단에 오래 근무하다가 자진사임하면 좋게좋게 헤어져야겠지?」 — 3년차부터 예우 */
  const tenured = years>=2;
  const nm=t?t.name:"구단";
  const head = kind==="instant"
      ? `🚪 <b>${nm} 감독, 부임 ${days}일 만에 자진 사임</b> — 공식 경기 ${rd}경기를 치르고 지휘봉을 내려놓았습니다.`
    : kind==="mid"
      ? (tenured
        ? `🚪 <b>${nm} 감독, ${years+1}년차에 지휘봉을 내려놓다</b> — 구단은 "오랜 헌신에 감사한다"며 예우를 갖췄습니다.`
        : `🚪 <b>${nm} 감독, 시즌 중 자진 사임</b> — 남은 일정은 대행 체제로 치릅니다.`)
      : (tenured
        ? `🕊️ <b>${nm} 감독, ${years+1}년의 동행을 마치다</b> — 구단과 합의된 원만한 이별입니다.`
        : `🚪 <b>${nm} 감독, 자진 사임</b> — 시즌을 마치고 팀을 떠납니다.`);
  return {kind, days, rounds:rd, played, head, years, tenured};
}
function mgrQuitOpen(){
  if(G.jobless || !userTeam()){ flash("맡고 있는 구단이 없습니다.","warn"); return; }
  const t=userTeam(), M=me();
  const _qc=mgrQuitCtx();
  let fee=mgrQuitFee();
  const inSeason=(G.phase==="league");
  let repHit=Math.round((inSeason?9:4) + clamp(mgrCtLeft()*2, 0, 6));
  if(_qc.kind==="instant") repHit=Math.round(repHit*1.8)+4;   // 부임하자마자 던지는 건 이력서에 오래 남는다
  /* 🕊️ 장기 재임 예우 (요청) — 3년차 이상은 구단도 팬도 이별을 다르게 받아들인다.
     시즌 밖 이별이면 구단이 위약금 절반을 면제해 주고, 평판 타격도 크게 준다. */
  if(_qc.tenured){
    repHit=Math.max(inSeason?3:1, Math.round(repHit*0.4));
    if(!inSeason){ fee=Math.max(0.3, Math.round(fee*0.5*100)/100); }
  }
  showConfirm(`<b style="font-size:17px">🚪 ${t.name} 감독직에서 물러납니다</b>\n\n`+
    `· 남은 계약 <b>${mgrCtLeft()}년</b>${mgrCtFinal()?" (올 시즌이 마지막)":""}\n`+
    `· 위약금 <b class="money">${fee}억</b> — 개인 현금에서 나갑니다 (보유 ${moneyEok(M.cash)})\n`+
    (M.cash<fee?`  <span style="color:#ff9d5c">모자란 <b>${Math.round((fee-M.cash)*100)/100}억</b>은 <b>미납</b>으로 남아 다음 구단 월급에서 공제됩니다</span>\n`:"")+
    `· 평판 <b>−${repHit}</b> · 다음 구단 제의가 줄어듭니다\n`+
    (inSeason?`\n<span style="color:#ff9d5c">⚠ <b>시즌 중 이탈</b>입니다 — 위약금 1.5배, 평판 타격도 더 큽니다.</span>\n`:"")+
    (_qc.kind==="instant"?`\n<span style="color:#f85149">⚠ <b>부임 ${_qc.days}일 만입니다.</b> 이 정도면 기사보다 조롱이 먼저 옵니다 — 평판이 더 깎이고, 한동안 좋은 제의가 오지 않습니다.</span>\n`:"")+
    (_qc.tenured?`\n<span style="color:#3fb950">🕊️ <b>${_qc.years+1}년차 장기 재임</b>입니다 — 구단도 팬도 이별을 예우로 받아들입니다. 평판 타격이 크게 줄고${!inSeason?", 구단이 위약금 절반을 면제했습니다":""}.</span>\n`:"")+
    `\n<span class="small">사임하면 무직이 되고, 다른 구단의 제의를 기다리게 됩니다. 되돌릴 수 없습니다.</span>`,
    ()=>{
      /* 현금이 모자라도 나갈 수는 있다 — 모자란 만큼은 미납으로 남아 다음 월급에서 공제된다 */
      const own=Math.round(Math.min(Math.max(M.cash,0), fee)*100)/100;
      const rest=Math.round((fee-own)*100)/100;
      if(own>0) mePay(-own, `${t.short} 감독직 사임 위약금`);
      if(rest>0){
        M.debt=Math.round(((M.debt||0)+rest)*100)/100;
        meLog(`－${rest.toFixed(2)}억 · 사임 위약금 미납 (다음 월급에서 공제)`);
      }
      try{ adjustTrust("owner", _qc.tenured?-8:-20, _qc.tenured?"감독 자진 사임 (장기 재임 예우)":"감독 자진 사임"); }catch(e){}
      /* 🚪 얼마나 있다 나가느냐에 따라 이야기가 완전히 달라진다 */
      const _q=_qc;
      try{ addNews(_q.head, _q.tenured?"good":"warn"); }catch(e){}
      try{
        const V={t:t.short, n:_q.days, r:_q.rounds, y:_q.years+1};
        if(_q.tenured){
          /* 🕊️ 오래 함께한 감독의 이별 — 팬들이 박수로 보낸다 (요청) */
          socialFill([
            "{y}년을 이끌었으면 박수 치고 보내주는 게 맞다",
            "{t}의 한 시대가 끝났다. 고마웠습니다 감독님",
            "서운하지만 이만큼 했으면 본인 선택 존중해야지",
            "구단이 위약금까지 배려했다던데, 이게 어른의 이별이지",
            "후임이 누구든 {y}년의 유산 위에서 시작한다"], 3+R(2), 1, V);
          fmkFill([
            ["{t} 감독 {y}년 만에 자진 사임 — 이건 욕 못 한다",1],
            ["장기 집권 감독 마무리치고 깔끔하네. 다음 행선지 궁금하다",0],
            ["{y}년이면 K리그에서 장수 감독 맞지. 수고하셨습니다",1]], 2+R(2), V);
          rivalFill([
            "{t} 감독 나간다니까 괜히 아쉽네. 라이벌전 맛이 있었는데",
            "{y}년 채우고 나가는 감독, 요즘 리그에 흔치 않다"], 1+R(1), 1, V);
        } else if(_q.kind==="instant"){
          socialFill(SOC.quitInstant, 4+R(3), -1, V);
          fmkFill(FMK.quitInstant, 3+R(3), V);
          rivalFill(RIV_QUIT_INSTANT, 2+R(2), -1, V);
        } else if(_q.kind==="mid"){
          socialFill(SOC.quitMid, 3+R(3), -1, V);
          fmkFill(FMK.quitMid, 2+R(3), V);
          rivalFill(RIV_QUIT_MID, 1+R(2), 0, V);
        } else {
          socialFill(SOC.quitEnd, 3+R(2), 1, V);
          fmkFill(FMK.quitEnd, 2+R(2), V);
        }
      }catch(e){}
      /* 🎙️ 떠나는 날의 회견 — 무직이 되면 기자회견 화면이 없으므로 기사와 반응으로 남긴다 */
      try{
        const line=_qc.tenured
          ? pick([
            `"이 구단에서 보낸 ${_qc.years+1}년이 제 감독 인생의 전부였습니다. 감사했습니다."`,
            `"박수 칠 때 떠나라는 말을 오래 생각했습니다. 지금이 그때입니다."`,
            `"선수단과 팬 여러분께 진 빚은, 어디에 있든 잊지 않겠습니다."`])
          : pick([
            `"제가 더 드릴 게 없다고 판단했습니다."`,
            `"결과에 대한 책임은 감독이 지는 겁니다."`,
            `"팬 여러분께는 죄송하다는 말씀밖에 못 드리겠습니다."`,
            `"다음 감독이 더 좋은 환경에서 시작하길 바랍니다."`]);
        addNews(`🎙️ <b>${t.name} 감독 고별 회견</b> — ${line}`, _qc.tenured?"good":"warn", "club");
        if(G.press) G.press.rel=clamp((G.press.rel||50)-(_qc.tenured?1:(inSeason?8:3)), 0, 100);
      }catch(e){}
      try{ meLog(`🚪 ${t.short} 감독직 자진 사임 — 위약금 ${fee}억. 무직이 됐다.`); }catch(e){}
      mgrLeaveClub("quit", inSeason?"시즌 중 자진 사임":"자진 사임", repHit);
    }, {okLabel:"사임한다", cancelLabel:"계속 맡는다", danger:true});
}
/* 시즌이 끝나는 순간 — 재계약이 안 됐으면 계약 만료로 떠난다 */
function mgrCtSeasonEnd(){
  if(G.jobless || !userTeam()) return false;
  const c=mgrCt(); if(!c) return false;
  if(G.season < mgrCtLastSeason()) return false;       // 아직 계약이 남았다
  if(c.talk){                                          // 답을 안 한 채 시즌이 끝났다 — 무응답은 거절이다
    c.talk=null; c.noRenew=1;
  }
  const t=userTeam();
  try{ addNews(`📜 <b>${t.name}, 감독과 계약 만료</b> — ${c.from}~${G.season} 시즌 동행이 끝났습니다.`, "warn"); }catch(e){}
  try{ meLog(fixJosa(`📜 ${t.short}과/와의 계약 만료 — 무직. 월급이 끊겼다.`)); }catch(e){}
  try{ notify(`📜 <b>계약이 만료되었습니다.</b> ${t.name}과의 동행이 여기서 끝납니다.`,"warn"); }catch(e){}
  mgrLeaveClub("expire", "계약 만료", 0);
  return true;
}
/* 📜 감독 계약 카드 — 오피스 맨 위 */
function mgrCtCard(){
  if(G.jobless || !userTeam()) return "";
  const c=mgrCt(); if(!c) return "";
  const t=userTeam();
  const last=mgrCtLastSeason(), left=mgrCtLeft(), fin=mgrCtFinal();
  const s=mgrStanding();
  const sc = s>=70?["#3fb950","탄탄합니다"] : s>=50?["#e3b341","무난합니다"] : s>=34?["#ff9d5c","불안합니다"] : ["#f85149","위태롭습니다"];
  const head=`<h3>📜 감독 계약 <span class="small">— ${t.short} · ${c.from}~${last} (${c.years}년) · 연봉 <b class="money">${c.wage}억</b></span></h3>`;
  /* 재계약 협상 중 */
  if(c.talk){
    const o=c.talk;
    const yy=CTASK.years||o.years, ww=CTASK.wage||o.wage, bb=CTASK.bud||o.bud;
    return `<div class="card" style="border-color:var(--gold)">${head}
      <div class="msg" style="background:#d2992222;border-color:#d2992266">
        ✍️ <b>${t.name} 구단이 재계약을 제안했습니다.</b>
        <span class="small">계약이 이번 시즌으로 끝납니다 — 흥정은 <b>3회</b>까지, 무리하면 결렬됩니다. (${o.tries||0}/3)</span></div>
      <div class="stkSum" style="margin-top:8px">
        <div><span>기간</span><b>${o.years}년</b></div>
        <div><span>연봉</span><b class="money">${o.wage}억</b></div>
        <div><span>이적 예산</span><b>${o.bud?o.bud+"억":"—"}</b></div>
        <div><span>구단이 보는 나</span><b style="color:${sc[0]}">${s}점 · ${sc[1]}</b></div>
      </div>
      <div class="stkOrder" style="margin-top:10px">
        <input type="text" inputmode="numeric" placeholder="기간(년)" value="${yy}" oninput="ctSet('years',this.value)"
          style="flex:1;min-width:70px;padding:8px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
        <input type="text" inputmode="decimal" placeholder="연봉(억)" value="${ww}" oninput="ctSet('wage',this.value)"
          style="flex:1;min-width:80px;padding:8px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
        <input type="text" inputmode="decimal" placeholder="이적 예산(억)" value="${bb}" oninput="ctSet('bud',this.value)"
          style="flex:1;min-width:90px;padding:8px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      </div>
      <div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap">
        <button class="mini" style="flex:1;padding:10px;border-color:var(--green);color:var(--green);font-weight:800" onclick="ctAccept()">✍️ 제시안 그대로 수락</button>
        <button class="mini" style="flex:1;padding:10px;border-color:var(--gold);color:var(--gold)" onclick="ctCounter()">🤝 이 조건으로 역제안</button>
        <button class="mini" style="padding:10px" onclick="ctReject()">거절</button>
      </div>
      <p class="small" style="margin-top:8px;color:var(--sub)">성적과 구단주 신뢰가 곧 협상력입니다. 상위권을 달리고 있으면 구단도 물러섭니다.</p>
    </div>`;
  }
  /* 마지막 시즌인데 제안이 없다 */
  if(fin && c.noRenew){
    return `<div class="card" style="border-color:#f8514966">${head}
      <div class="msg warn">⌛ <b>이번 시즌으로 계약이 끝납니다.</b> 구단은 연장 의사를 밝히지 않았습니다.
        <span class="small">남은 경기에서 뒤집으면 이야기가 다시 나올 수도 있습니다 — 다만 이번 시즌 안에 다시 제안이 오지는 않습니다.</span></div>
      <p class="small" style="margin-top:7px">구단이 보는 나 <b style="color:${sc[0]}">${s}점 · ${sc[1]}</b>
        · 시즌이 끝나면 무직이 되어 다른 구단의 제의를 기다립니다.</p>
      <button class="mini" style="margin-top:8px;border-color:#f85149;color:#f85149" onclick="mgrQuitOpen()">🚪 지금 사임하기</button>
    </div>`;
  }
  /* 평상시 */
  return `<div class="card">${head}
    <div class="stkSum">
      <div><span>남은 계약</span><b>${fin?"올 시즌이 마지막":left+"년"}</b></div>
      <div><span>연봉</span><b class="money">${c.wage}억</b></div>
      <div><span>구단이 보는 나</span><b style="color:${sc[0]}">${s}점 · ${sc[1]}</b></div>
      <div><span>사임 위약금</span><b>${mgrQuitFee()}억</b></div>
    </div>
    <p class="small" style="margin-top:7px;color:var(--sub)">${fin
      ? "계약 마지막 시즌입니다. 시즌 중반이 지나면 구단이 재계약 여부를 판단합니다."
      : `${last} 시즌까지 계약되어 있습니다. 마지막 해 중반에 재계약 이야기가 나옵니다.`}</p>
    <button class="mini" style="margin-top:6px;border-color:#f85149;color:#f85149" onclick="mgrQuitOpen()">🚪 자진 사임</button>
  </div>`;
}
/* 감독 위신 — 집·자산·성적이 만든다. 선수 설득과 재계약에 쓰인다. */
function mgrPrestige(){
  const M=me();
  let v=homeOf().pres;
  v += Math.min(15, M.props.length*3);
  /* 몇 채냐보다 무엇을 갖고 있느냐가 더 크다 — 부르즈 칼리파 한 채가 상가 다섯 채보다 무겁다 */
  const val=M.props.reduce((s2,x)=>s2+(x.value||x.price),0);
  v += clamp(val*0.022, 0, 28);
  v += clamp(M.cash*0.05, 0, 10);
  /* 🏠 자가라면 지금 시세가 위신에 얹힌다 — 산 값이 아니라 지금 값이다 */
  try{ if(M.homeOwn){ const hh=homeOf(); if(hh.buy) v += clamp((homePrice(hh)-hh.buy)*0.06, -5, 8); } }catch(e){}
  try{ v += stkBankMark(); }catch(e){}      // 💀 파산 낙인 — 몇 해에 걸쳐 옅어진다
  /* 🎖️ 이달의 감독 — 한 번에 위신 +1.2, 최대 +12 (요청 — 상이 실제로 닿게) */
  try{ v += clamp(motmMgrCount()*1.2, 0, 12); }catch(e){}
  return Math.round(v*10)/10;
}
function meLog(txt){ const M=me(); M.log.unshift({d:G.day||0, t:txt}); M.log=M.log.slice(0,20); }
function mePay(amt, why){ const M=me(); M.cash=Math.round((M.cash+amt)*100)/100;
  if(amt<0) M.spent=Math.round((M.spent-amt)*100)/100; else M.earned=Math.round((M.earned+amt)*100)/100;
  if(why) meLog(`${amt>=0?"＋":"－"}${Math.abs(amt).toFixed(2)}억 · ${why}`); }
/* 매달 1일 — 월급이 들어오고 집세와 관리비가 나가고 임대수익이 붙는다 */
/* ══ 감독 개인 제재금 ══
   물병 투척·상벌위·구단 자체 징계는 구단 살림이 아니라 감독 개인이 문다.
   사비가 모자라면 구단이 대납하고, 그만큼 월급에서 되가져간다(미납 징계금).
   반환값: 실제 부과액 */
function mgrFine(amt, why){
  const M=me(), t=userTeam();
  amt=Math.round(Math.max(0,amt)*100)/100;
  if(!amt) return 0;
  G.mgrFineTot=Math.round(((G.mgrFineTot||0)+amt)*100)/100;   // ⚖️ 커리어 누적 징계 이력 — 감독 평판에 오래 남는다
  /* 🎭 사건 장부 — 예능 모드의 「그 사건」들이 여기 다 모인다. 나중에 게시판이 후일담을 판다.
     징계금이 나가는 지점이 곧 사건이 벌어진 지점이라, 이 한 곳만 물리면 전부 잡힌다. */
  try{
    if(/물병|폭행|난투|체벌|파손|소란|모욕|조롱|물의|난입|위협/.test(String(why||""))){
      const kk = /기자/.test(why)?"press" : /팬|간담회/.test(why)?"fans"
               : /라커룸|난투|난입/.test(why)?"locker" : /심판/.test(why)?"ref"
               : /체벌|선수 폭행|합의금/.test(why)?"player" : /물의|도박/.test(why)?"gamble" : "etc";
      (G.wildLog=G.wildLog||[]).unshift({k:kk, w:String(why), a:amt, d:G.day||0,
        s:G.season, tid:(t?t.id:null), tn:(t?t.short:"")});
      G.wildLog=G.wildLog.slice(0,24);
    }
  }catch(e){}
  /* 🤝 스폰서는 성적보다 이미지에 먼저 반응한다 — 징계가 클수록 압박도 세다 */
  try{ if(amt>=0.8) sponScandal(why||"감독 징계", amt>=5?2:1); }catch(e){}
  const own=Math.round(Math.min(Math.max(M.cash,0), amt)*100)/100;
  if(own>0) mePay(-own, why);
  const rest=Math.round((amt-own)*100)/100;
  if(rest>0){
    M.debt=Math.round((M.debt+rest)*100)/100;
    meLog(`－${rest.toFixed(2)}억 · ${why} (구단 대납 — 월급에서 공제)`);
    if(t){ t.budget=Math.round(Math.max(0,t.budget-rest)*10)/10; adjustTrust("owner", -3, `징계금 ${rest}억 구단 대납`); }
  }
  return amt;
}
/* ⚖️ 미납 위약금·징계금 직접 상환
   ⚠ 제보 — 「미납 위약금을 주식이나 부동산으로 불린 자산으로 갚을 수 있니?」
      지금까지는 월급에서만 자동 공제됐다. 그래서 무직이면 월급이 없어 영영 줄지 않았고,
      주식·부동산으로 수백억을 만들어도 갚을 방법이 없었다.
      ─ 이제 아무 때나 직접 갚는다. 주식·부동산은 팔아서 현금으로 만든 뒤 갚으면 된다. */
function mgrDebtPay(amt){
  const M=me();
  const due=Math.round((M.debt||0)*100)/100;
  if(due<=0){ flash("갚을 미납금이 없습니다.","warn"); return; }
  let a=Math.round((parseFloat(amt)||0)*100)/100;
  if(!(a>0)) a=due;
  a=Math.min(a, due, Math.round(M.cash*100)/100);
  if(a<=0){ flash(`보유 현금이 없습니다. 주식·부동산·예금을 정리한 뒤 갚을 수 있습니다. (미납 ${due.toFixed(2)}억)`,"warn"); return; }
  mePay(-a, `미납금 상환 (잔액 ${(due-a).toFixed(2)}억)`);
  M.debt=Math.round((due-a)*100)/100;
  if(M.debt<=0.004){ M.debt=0; flash("⚖️ 미납금을 모두 갚았습니다.","good"); }
  else flash(`⚖️ ${a.toFixed(2)}억을 갚았습니다 — 남은 미납금 ${M.debt.toFixed(2)}억.`,"good");
  saveGame(); show("mylife");
}
function mgrDebtPayAll(){ mgrDebtPay(0); }
function tickMoney(){
  if(!G.cal || !userTeam()) return;
  const d=dateOfDay(G.day||0);
  const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  const M=me();
  if(M.lastPay===key) return;
  if(!M.lastPay){ M.lastPay=key; return; }        // 첫 실행은 기준점만 잡는다
  M.lastPay=key;
  const pay=Math.round(mgrSalary()/12*100)/100;
  /* ⚠ 실제로 통장에 들어온 돈을 따로 센다 — 무직인데 「받지도 않은 월급」에 세금을 내고 있었다. */
  let gotPay=0;
  if(G.jobless) meLog("🕊️ 무직 — 이번 달 월급 없음 (집세·관리비는 그대로 나간다)");
  else {
    /* 💀 파산 압류 — 채권자에게 넘어가는 몫 */
    let cut=0;
    try{ if(M.wageGarnish && stkBadCredit()) cut=Math.round(pay*0.30*100)/100; }catch(e){}
    if(cut>0){ gotPay=Math.round((pay-cut)*100)/100; mePay(gotPay, `감독 월급 (파산 압류 -${cut.toFixed(2)}억)`); }
    else { if(M.wageGarnish) M.wageGarnish=0; gotPay=pay; mePay(pay, "감독 월급"); }
  }
  /* ⚠ 월급에서 떼는 돈이다 — 무직인데도 통장에서 빠져나가고 있었다(실제로 받은 월급 gotPay 기준).
     무직 기간에는 줄지 않고, 「⚖️ 미납금」 화면에서 직접 갚아야 한다. */
  if(M.debt>0 && gotPay>0){
    const cut=Math.round(Math.min(M.debt, gotPay*0.5)*100)/100;
    if(cut>0){ mePay(-cut, `미납금 상환 (잔액 ${(M.debt-cut).toFixed(2)}억)`); M.debt=Math.round((M.debt-cut)*100)/100; }
  }
  const h=homeOf();
  /* 월세도 시세를 따라 움직인다 — 시장이 오르면 재계약 때 오른다 */
  const rentNow=(typeof homeRent==="function") ? homeRent(h) : h.rent;
  const cost=M.homeOwn ? Math.round(h.rent*0.35*100)/100 : Math.round(rentNow*100)/100;
  if(cost>0) mePay(-cost, `${h.n} ${M.homeOwn?"관리비":"월세"}`);
  /* 🏢 부동산 — 시세·공실·임대료·개발 이벤트를 한 번에 굴리고 임대료를 받는다 */
  let rent=0;
  try{ rent=propMonthTick(); }catch(e){}
  if(rent>0) mePay(Math.round(rent*100)/100, `임대수익 (${M.props.filter(x=>!x.vac).length}/${M.props.length}건 임대 중)`);
  else if((M.props||[]).length) meLog(`🚪 이번 달 임대수익 없음 — 보유 ${M.props.length}건이 모두 공실`);
  /* 🧾 재산세 — 매년 1월 */
  try{ if(d.getMonth()===0) propTaxTick(); }catch(e){}
  /* 🏦 은행 — 이자·적금 자동이체·대출 원리금 */
  try{ bankMonthTick(); }catch(e){}
  const tax=Math.round((gotPay+rent)*0.14*100)/100;
  if(tax>0) mePay(-tax, "소득세");
  if(M.cash<0) addMood(`💸 통장이 비었습니다. (${moneyEok(M.cash)}) — 집을 줄이거나 부동산을 파세요.`);
}
/* 감독이 큰 걸 샀을 때 — 팬들은 감독의 통장을 본다.
   성적이 좋으면 "그럴 만하다", 나쁘면 "저럴 시간에 전술이나". */
function socialOnWealth(what, price, kind){
  if(price<15) return;                       // 원룸 이사까지 기사화되지는 않는다
  const t=userTeam(); if(!t) return;
  const lux = price>=200;
  const fans = G.trust ? G.trust.fans : 70;
  const good = fans>=62;
  const v={t:t.short, w:what, m:price};
  const n = lux ? 4+R(3) : 2+R(2);
  socialFill(lux?SOC.mgrLux:(good?SOC.mgrRichOk:SOC.mgrRichBad), n, good?0:-1, v);
  fmkFill(lux?FMK.mgrLux:(good?FMK.mgrRichOk:FMK.mgrRichBad), n, v);
  rivalFill(RIV.mgrRich, 1+R(2), 0, v);
  if(lux) rivalFmk(FRIV.mgrRich, 1+R(2), v);
  addNews(`${kind==="집"?"🏡":"🏢"} ${t.short} 감독, <b>${what}</b> 매입 — 약 ${price}억. 지역 부동산가가 술렁입니다.`, null, "club");
  if(lux && !good) adjustTrust("fans", -3, `${what} 매입 (성적 부진 중)`);
  saveGame();
}
/* ── 조작 ─────────────────────────────────────────────── */
function meMoveHome(k){
  const M=me(); const h=HOMES.find(x=>x.k===k); if(!h) return;
  /* 지금 자가로 살고 있는 집을 또 사려는 경우만 막는다 —
     월세로 살던 집을 사는 건(전세→매매 전환) 자연스러운 선택지다. */
  if(h.k===M.home && M.homeOwn){ flash("이미 자가로 살고 있는 집입니다.","info"); return; }
  const sameRent=(h.k===M.home && !M.homeOwn);
  /* ⚠ 제보 — 산 집에서 다른 집으로 이사하면 집이 그냥 증발했다. 자가에서 나갈 땐 판다. */
  const oldH=HOMES.find(x=>x.k===M.home);
  const px=homePrice(h);                                   // 지금 시세로 산다
  const buyFee=Math.round(px*(HOME_TAX+HOME_FEE)*100)/100; // 취득세 + 중개수수료
  const oldPx=(oldH&&oldH.buy)?homePrice(oldH):0;
  const ownSale=(M.homeOwn && oldPx>0) ? Math.round(oldPx*(1-HOME_SELL)*100)/100 : 0;
  const gain=(M.homeOwn && oldH && oldH.buy) ? Math.round((oldPx-oldH.buy)*100)/100 : 0;
  const loan=hmlLoan();
  const saleNote=ownSale?`\n\n<span class="small" style="color:var(--gold)">지금 사는 ${oldH.n}(자가)은 <b>${ownSale}억</b>에 매각됩니다
    — 매입가 ${oldH.buy}억 대비 <b>${gain>=0?"+":""}${gain}억</b>${loan>0?` · 담보대출 <b>${loan.toFixed(2)}억</b> 상환`:""}</span>`:"";
  const sellOld=()=>{
    if(!ownSale) return;
    mePay(ownSale, `${oldH.n} 매각 (${gain>=0?"+":""}${gain}억)`);
    if(hmlLoan()>0){ const L=hmlLoan(); mePay(-L, `주택담보대출 상환 (매각)`); M.hml=0; }
    M.homeOwn=false;
  };
  showConfirm(`<b>${h.ic} ${h.n}</b>${sameRent?" — 지금 월세로 사는 집입니다":""}\n\n${h.d}\n\n· 현재 시세 <b>${px}억</b> <span class="small">(기준가 ${h.buy}억 · 시장 ${Math.round(homeMkt(h.k)*100)}%)</span>\n· 월세 <b>${homeRent(h)}억</b>\n· 취득세·중개료 <b>${buyFee}억</b>\n· 위신 ${h.pres>=0?"+":""}${h.pres}${h.party?` · 집들이 가능 (거실 ${h.party}등급)`:""}${saleNote}\n\n어떻게 하시겠습니까? <span class="small">(보유 ${moneyEok(M.cash)})</span>`,
    ()=>{ // 매입
      if(px+buyFee>M.cash+ownSale){ flash(`매입가와 세금을 합쳐 ${(px+buyFee).toFixed(2)}억이 필요합니다.`,"warn"); return; }
      sellOld();
      mePay(-px, `${h.n} 매입 (시세 ${px}억)`);
      if(buyFee>0) mePay(-buyFee, `취득세·중개수수료`);
      M.home=h.k; M.homeOwn=true;
      flash(`🏡 <b>${h.n}</b>을(를) 샀습니다. ${sameRent?"살던 집을 매입했습니다 — ":""}이제 관리비만 냅니다.`,"good");
      try{ socialOnWealth(h.n, px, "집"); }catch(e){}
      saveGame(); show("mylife");
    },
    {okLabel:`💰 ${px}억에 매입`, cancelLabel: sameRent?"그대로 월세로 산다":`🔑 월세로 입주`,
     onCancel:()=>{ sellOld(); M.home=h.k; M.homeOwn=false; flash(`🔑 <b>${h.n}</b>(으)로 이사했습니다. 월세 ${homeRent(h)}억.${ownSale?` (전 집 매각 +${ownSale}억)`:""}`,"info");
       try{ socialOnWealth(h.n, h.buy, "집"); }catch(e){}
       saveGame(); show("mylife"); }});
}
function meBuyProp(k){
  const M=me(); const P=PROPS.find(x=>x.k===k); if(!P) return;
  const fee=Math.round(P.price*PROP_FEE*100)/100;
  if(P.price+fee>M.cash){ flash(`매입가와 세금을 합쳐 ${(P.price+fee).toFixed(2)}억이 필요합니다. (보유 ${moneyEok(M.cash)})`,"warn"); return; }
  const netY=Math.round((P.yield*(1-P.vac)-PROP_TAX)*1000)/10;
  showConfirm(`<b>${P.ic} ${P.n}</b> <span class="small">${P.reg}</span>\n\n`+
    `· 매입가 <b>${P.price}억</b> + 취득세·중개료 ${fee}억\n`+
    `· 명목 수익률 <b>${(P.yield*100).toFixed(1)}%</b> (월 ${(P.price*P.yield/12).toFixed(2)}억)\n`+
    `· <b>실질 수익률 ${netY}%</b> <span class="small">— 공실률 ${Math.round(P.vac*100)}%와 재산세를 뺀 값</span>\n`+
    `· 시세 변동성 ${P.risk>=0.2?"높음":P.risk>=0.14?"보통":"낮음"} · 시장 민감도 ${P.beta>=1.3?"매우 높음":P.beta>=1.0?"보통":"낮음"}\n\n`+
    `<span class="small">임차인은 나가기도 합니다. 공실 동안에는 수입이 0입니다.\n지하철·재개발 같은 호재가 붙기도, 공급 폭탄을 맞기도 합니다.</span>`,
    ()=>{ mePay(-P.price, `${P.n} 매입`);
      if(fee>0) mePay(-fee, `취득세·중개수수료`);
      M.props.push({k:P.k, price:P.price, value:P.price, d:G.day||0, s:G.season, vac:0, rentK:1, up:0});
      flash(`🏢 <b>${P.n}</b>을(를) 매입했습니다.`,"good");
      try{ socialOnWealth(P.n, P.price, "부동산"); }catch(e){}
      saveGame(); show("mylife"); },
    {okLabel:`매입 (${(P.price+fee).toFixed(2)}억)`, cancelLabel:"취소"});
}
/* 🔨 리모델링 — 돈을 들이면 시세와 임대료가 오른다 */
function mePropUp(i){
  const M=me(); const it=M.props[i]; if(!it) return;
  const lv=(it.up||0)+1;
  const U=PROP_UP[lv];
  if(!U){ flash("더 손볼 곳이 없습니다.","warn"); return; }
  const cost=Math.round(propVal(it)*U.cost*100)/100;
  if(cost>M.cash){ flash(`공사비 ${cost}억이 부족합니다.`,"warn"); return; }
  const P=propDef(it.k);
  showConfirm(`<b>🔨 ${P.n} — ${U.n}</b>\n\n· 공사비 <b>${cost}억</b>\n· 시세 <b>+${Math.round(U.val*100)}%</b>\n· 임대료 <b>+${Math.round(U.rent*100)}%</b>\n\n<span class="small">공사 동안 한 달은 세를 놓을 수 없습니다.</span>`,
    ()=>{
      mePay(-cost, `${P.n} ${U.n}`);
      it.up=lv;
      it.value=Math.round(propVal(it)*(1+U.val)*100)/100;
      it.vac=Math.max(it.vac||0, 1);
      propLog(`🔨 <b>${P.n}</b> ${U.n} 완료 — 시세 +${Math.round(U.val*100)}% · 임대료 +${Math.round(U.rent*100)}%`, it.k);
      flash(`🔨 ${P.n} ${U.n}을(를) 마쳤습니다.`,"good");
      saveGame(); show("mylife");
    }, {okLabel:`🔨 ${cost}억 들여 공사`, cancelLabel:"다음에"});
}
/* 🏦 부동산 담보대출 */
let PLN_AMT="";
function plnSet(v){ PLN_AMT=String(v||"").replace(/[^0-9.]/g,""); }
function plnBorrow(amt){
  const M=me();
  const a=Math.round((parseFloat(amt)||0)*100)/100;
  if(a<=0){ flash("금액을 입력하세요.","warn"); return; }
  if(a>propLoanMax()){ flash(`한도를 넘습니다 — 최대 ${propLoanMax().toFixed(2)}억 (시세의 ${Math.round(PLN_LTV*100)}%).`,"warn"); return; }
  M.pln=Math.round((propLoan()+a)*100)/100;
  mePay(a, `부동산 담보대출 실행 (잔액 ${M.pln.toFixed(2)}억)`);
  saveGame(); show("mylife");
}
function plnRepay(amt){
  const M=me();
  const a=Math.min(propLoan(), Math.round((parseFloat(amt)||0)*100)/100);
  if(a<=0){ flash("상환할 금액이 없습니다.","warn"); return; }
  if(a>M.cash){ flash(`현금이 부족합니다 (보유 ${moneyEok(M.cash)}).`,"warn"); return; }
  M.pln=Math.round((propLoan()-a)*100)/100;
  mePay(-a, `부동산 담보대출 상환 (잔액 ${M.pln.toFixed(2)}억)`);
  saveGame(); show("mylife");
}
function meSellProp(i){
  const M=me(); const it=M.props[i]; if(!it) return;
  const P=propDef(it.k);
  const v=propVal(it);
  const diff=Math.round((v-it.price)*100)/100;
  /* 보유 기간 — 2년을 못 채우고 팔면 양도세가 두 배다 */
  const yrs=(G.season||0)-(it.s!=null?it.s:(G.season||0));
  const shortT=yrs<2;
  const rate=shortT?PROP_GAIN_S:PROP_GAIN;
  const tax=diff>0 ? Math.round(diff*rate*100)/100 : 0;
  const fee=Math.round(v*0.03*100)/100;
  const loanCut=propLoan()>0 ? Math.round(Math.min(propLoan(), v*0.5)*100)/100 : 0;
  const net=Math.round((v-fee-tax-loanCut)*100)/100;
  showConfirm(`<b>${P.ic} ${P.n} 매각</b>\n\n`+
    `· 매입가 ${it.price}억 → 현재 시세 <b>${v}억</b>\n`+
    `· 차익 <b style="color:${diff>=0?"var(--green)":"var(--red)"}">${diff>=0?"+":""}${diff}억</b> · 보유 ${yrs}년${shortT?' <span style="color:var(--red)">(2년 미만 — 양도세 중과)</span>':""}\n`+
    `· 중개료 ${fee}억 · 양도세 ${tax}억 <span class="small">(${Math.round(rate*100)}%)</span>${loanCut?`\n· 담보대출 상환 ${loanCut}억`:""}\n`+
    `\n실수령 <b class="money">${net}억</b>`,
    ()=>{
      mePay(v, `${P.n} 매각 (${diff>=0?"+":""}${diff}억)`);
      if(fee>0) mePay(-fee, "매각 중개수수료");
      if(tax>0) mePay(-tax, `양도소득세${shortT?" (2년 미만 중과)":""}`);
      if(loanCut>0){ mePay(-loanCut, "부동산 담보대출 상환 (매각)"); M.pln=Math.round((propLoan()-loanCut)*100)/100; }
      propLog(`💰 <b>${P.n}</b> 매각 — ${v}억 (차익 ${diff>=0?"+":""}${diff}억 · 세후 ${net}억)`, it.k);
      M.props.splice(i,1); saveGame(); show("mylife"); },
    {okLabel:`매각 (실수령 ${net}억)`, cancelLabel:"취소", danger:diff<0});
}
function meBuyGift(k){
  const M=me(); const G2=GIFTS.find(x=>x.k===k); if(!G2) return;
  /* 몇 개 살지 먼저 묻는다 — 스무 명에게 돌리려면 한 번에 사야 한다 */
  const canMax=Math.max(1, Math.floor(M.cash/G2.price));
  showConfirm(`<b>${G2.ic} ${G2.n}</b>\n\n${G2.d}\n\n· 개당 <b class="money">${G2.price}억</b> · 보유 현금 ${moneyEok(M.cash)}\n· 최대 <b>${canMax}개</b>까지 살 수 있습니다\n\n몇 개를 사시겠습니까?\n<input id="buyQty" type="number" min="1" max="${canMax}" value="1" style="width:110px;font-size:17px;font-weight:800;text-align:center;background:var(--bg3);color:var(--txt);border:1px solid var(--gold);border-radius:8px;padding:9px">`,
    (vals)=>{
      let n=parseInt(String((vals&&vals.buyQty)||"1"),10);
      if(!isFinite(n)||n<1) n=1;
      meBuyGiftN(k, Math.min(n, canMax));
    }, {okLabel:"구매", cancelLabel:"취소"});
}
function meBuyGiftN(k, n){
  const M=me(); const G2=GIFTS.find(x=>x.k===k); if(!G2) return;
  if(G2.price>M.cash){ flash(`${G2.price}억이 필요합니다. (보유 ${moneyEok(M.cash)})`,"warn"); show("mylife"); return; }
  const cost=Math.round(G2.price*n*100)/100;
  if(cost>M.cash){ flash(`${cost}억이 필요합니다. (보유 ${moneyEok(M.cash)})`,"warn"); show("mylife"); return; }
  mePay(-cost, `${G2.n} ${n}개 구매`);
  M.inv[k]=(M.inv[k]||0)+n;
  meGiftSel=k;                     // 방금 산 물건을 바로 보낼 수 있게 골라 둔다
  /* ⚠ notify() 는 구단 뉴스에도 남는다. 감독이 헤드폰을 산 게 뉴스가 될 수는 없다. 배너만 띄운다. */
  flash(`🛍️ <b>${G2.n}</b> ${n}개를 샀습니다. 보유 ${M.inv[k]}개 — 선수에게 선물할 수 있습니다.`,"good");
  saveGame(); show("mylife");
}
/* ⚠ (p._giftAt)||-999 는 0일차에 준 선물을 "안 준 것"으로 만들었다 — 0 이 falsy 라서.
   시즌 첫날 선물이 쿨다운을 안 먹던 원인. */
/* ⚠ 제보 원문 — 「선수한테 선물보내는거 21일마다라고 되어있는데, 1년 뒤로 떠요. 220일 이렇게요」.
   원인: _giftAt 은 「그 시즌 달력의 며칠째」다. 새 시즌이 되면 달력이 0일로 돌아가는데
   지난 시즌 막바지(예: 199일)의 도장이 그대로 남아 199+21−0 = 220일로 계산됐다.
   (부상 injUntil 과 같은 종류의 사고다)
   ─ 시즌 전환에서 도장을 새 달력으로 옮기고, 여기서도 안전망을 둔다 —
     남은 날이 쿨다운(21일)보다 크면 있을 수 없는 값이므로 「지난 도장」으로 보고 0으로 친다.
     이미 꼬인 세이브도 불러오는 즉시 정상으로 보인다. */
function giftCoolLeft(p){
  const d=(p&&typeof p._giftAt==="number")?p._giftAt:-999;
  const left=d+GIFT_COOL-(G.day||0);
  if(left>GIFT_COOL) return 0;          // 묵은 도장 — 있을 수 없는 값
  return Math.max(0, left);
}
/* 선물 주기 — 선수 화면과 쇼핑 화면 양쪽에서 부른다 */
function meGiveGift(pid, k){
  if(G.jobless){ gameAlert("맡고 있는 팀이 없습니다 — 선물은 내 선수에게만 보낼 수 있습니다."); return; }
  const M=me(); const t=userTeam(); const p=t.players.find(x=>x.id===pid);
  const G2=GIFTS.find(x=>x.k===k);
  if(!p||!G2) return;
  if((M.inv[k]||0)<1){ flash("가진 물건이 없습니다.","warn"); show("mylife"); return; }
  const lf=giftCoolLeft(p);
  if(lf>0){ flash(`${p.name} 선수에게는 ${lf}일 뒤에 다시 줄 수 있습니다. 자주 주면 고마운 줄 모릅니다.`,"warn"); show("mylife"); return; }
  /* 한 번 더 묻는다 — 목록이 촘촘해서 옆 사람에게 잘못 누르기 쉽다 */
  showConfirm(`<b>${G2.ic} ${G2.n}</b>\n\n<b>${p.name}</b> 선수에게 보내시겠습니까?\n\n<span class="small">호감 +${G2.aff} · 사기 +${G2.mor}${G2.cond?` · 컨디션 +${G2.cond}`:""}${G2.xp?` · 특성 경험치 +${G2.xp}`:""}\n보낸 뒤 ${GIFT_COOL}일간 같은 선수에게 다시 줄 수 없습니다. (남은 ${G2.n} ${M.inv[k]}개)</span>`,
    ()=>meGiveGiftGo(pid, k), {okLabel:"예, 보냅니다", cancelLabel:"아니오"});
}
function meGiveGiftGo(pid, k){
  const M=me(); const t=userTeam(); const p=t.players.find(x=>x.id===pid);
  const G2=GIFTS.find(x=>x.k===k);
  if(!p||!G2) return;
  if((M.inv[k]||0)<1){ flash("가진 물건이 없습니다.","warn"); show("mylife"); return; }
  const left=giftCoolLeft(p);
  if(left>0){ flash(`${p.name} 선수에게는 ${left}일 뒤에 다시 줄 수 있습니다. 자주 주면 고마운 줄 모릅니다.`,"warn"); return; }
  M.inv[k]--; if(M.inv[k]<=0) delete M.inv[k];
  p._giftAt=G.day||0;
  const age=G.season-p.by;
  /* 받는 사람에 따라 다르게 반응한다 */
  let k2=1;
  if(G2.k==="game" && age<=23) k2=1.4;
  if(G2.k==="game" && age>=31) k2=0.5;
  if(G2.k==="trip" && age>=28) k2=1.3;
  if(G2.k==="car"  && p.pers===0) k2=0.7;      // 프로페셔널은 과한 선물을 부담스러워한다
  if((G2.k==="pt"||G2.k==="nut") && p.cond<80) k2=1.35;
  const affUp=Math.round(G2.aff*k2);
  affAdd(p, affUp, `${G2.n} 선물`);
  p.morale=clamp((p.morale||70)+Math.round(G2.mor*k2), 25, 99);
  if(G2.cond) p.cond=clamp((p.cond||90)+Math.round(G2.cond*k2), 40, 100);
  if(G2.xp) addTraitXp(p, Math.round(G2.xp*k2*10)/10);
  const say=pick([`"감독님... 이런 걸 다."`,`"잘 쓰겠습니다. 그라운드에서 갚겠습니다."`,
    `"솔직히 감동했습니다."`,`"이런 거 안 하셔도 되는데요." (표정은 밝다)`]);
  showConfirm(`<b>${G2.ic} ${p.name}에게 ${G2.n}</b>\n\n${p.name}: ${say}\n\n· 호감도 <b style="color:var(--green)">+${affUp}</b>\n· 사기 +${Math.round(G2.mor*k2)}${G2.cond?`\n· 컨디션 +${Math.round(G2.cond*k2)}`:""}${G2.xp?`\n· 특성 경험치 +${Math.round(G2.xp*k2*10)/10}`:""}${k2!==1?`\n\n<span class="small">${k2>1?"이 선수에게 특히 잘 맞는 선물이었습니다.":"이 선수에게는 조금 과했습니다."}</span>`:""}`,
    ()=>{}, {okLabel:"확인", cancelLabel:""});
  meLog(`🎁 ${p.name}에게 ${G2.n}`);
  if(!M.inv[k]) meGiftSel="";      // 마지막 하나를 썼으면 선택을 푼다
  saveGame();
  if(VIEW==="mylife") show("mylife");
}
/* ── 화면 ─────────────────────────────────────────────── */
