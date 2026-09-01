"use strict";
/* ═══════════════════════════════════════════════════════════════════════════
   📈 주식 시장 — 감독의 사비를 굴린다
   구단 모기업이 그대로 상장사로 올라온다. 그 위에 리그와 무관한 기업들을 얹어
   업종이 골고루 섞인 시장을 만든다.
     · 우량주 blue  — 느리게, 꾸준히
     · 성장주 grow  — 크게 오르고 크게 빠진다
     · 동전주 penny — 세 자리 주가, 하루에 10%씩 움직인다
     · 잡주  junk   — 도박. 상장폐지가 실제로 일어난다
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_SECTOR={
  elec:{n:"전자",   ic:"💻"}, auto:{n:"자동차", ic:"🚗"}, chem:{n:"화학",   ic:"⚗️"},
  cons:{n:"건설",   ic:"🏗️"}, fin :{n:"금융",   ic:"🏦"}, bio :{n:"바이오", ic:"🧬"},
  game:{n:"게임",   ic:"🎮"}, food:{n:"식음료", ic:"🍜"}, ship:{n:"조선",   ic:"🚢"},
  air :{n:"항공",   ic:"✈️"}, tel :{n:"통신",   ic:"📡"}, ent :{n:"엔터",   ic:"🎬"},
  ret :{n:"유통",   ic:"🛒"}, ener:{n:"에너지", ic:"⚡"}, steel:{n:"철강",  ic:"🔩"},
  logi:{n:"물류",   ic:"📦"}, med :{n:"의료",   ic:"🏥"}, edu :{n:"교육",   ic:"📚"}
};
/* 등급별 성격 — vol=일 변동성 · dr=장기 추세 · dl=상장폐지 연간 위험 */
/* ⚠ 값을 잡을 때 주의할 것 — 매일 곱셈으로 굴리면 변동성이 그 자체로 수익률을 갉아먹는다.
   추세(dr)를 0 으로 두면 장기적으로 전 종목이 우하향한다. 1년 기대 수익률을 먼저 정하고
   거기서 역산했다: 우량 +10% · 성장 +18% · 동전 −5% · 잡주 −25%.
   spread 는 같은 등급 안에서도 종목마다 팔자가 갈리게 하는 폭이다. */
/* ⚠ 제보 — 「1주에 4억 하는 주식이 있다 · 우상향이 너무 심하다(우량주일수록 더) · 돈 벌기가 너무 쉽다」.
   세 가지를 함께 손본다.
   ① 자릿수 — 값이 너무 오르면 실제 시장처럼 액면분할을 한다(stkSplit). 4억짜리 주식은 존재할 수 없다.
   ② 우상향 — 등급별 추세(dr)를 절반 아래로 내리고, 밸류에이션 되돌림(stkValPull)을 매일 건다.
      비싸지면 끌어내리고 싸지면 밀어올린다 — 사놓고 기다리기만 하면 되는 시장이 아니게 된다.
   ③ 리스크 — 변동성을 전 등급 올리고, 개별 악재 쇼크(분식회계·유상증자·감자·오너 리스크)를 넣는다.
      며칠 연속 하한가를 맞고 반토막이 나는 일이 실제로 벌어진다. */
const STK_TIER={
  blue :{n:"우량주", c:"#58a6ff", vol:0.017, dr: 0.00013, sp:0.00018, dl:0.0006},
  grow :{n:"성장주", c:"#7ee2a8", vol:0.038, dr: 0.00022, sp:0.00052, dl:0.008},
  penny:{n:"동전주", c:"#e3b341", vol:0.076, dr: 0.00016, sp:0.00110, dl:0.065},
  junk :{n:"잡주",   c:"#f85149", vol:0.115, dr: 0.00045, sp:0.00230, dl:0.175}
};
const SPLIT_HI=400000;    // 이 값을 넘으면 액면분할 검토 (실제 시장에서도 이쯤에서 쪼갠다)
const VAL_PULL=0.0055;    // 하루치 밸류에이션 되돌림 — 고평가는 눌리고 저평가는 밀린다
const VAL_MAX=0.0022;     // 되돌림이 하루에 줄 수 있는 최대 추세 (±0.22%)
const STK_HIST=90;        // 종가를 며칠치 들고 있을지 (세이브 크기 때문에 넉넉히 자른다)
/* ═══ 💥 시장충격 — 큰 주문은 자기가 값을 밀어 올린다 ══════════════════════
   ⚠ 제보 — 「주식으로 경 단위를 번 사람이 있다」.
     원인의 절반이 여기였다. 수십조짜리 주문을 넣어도 어제 종가 그대로 전량 체결됐다.
     실제 시장에서는 큰 주문이 호가를 위로 다 먹으면서 스스로 값을 올리고,
     팔 때는 반대로 흘러내린다. 그래서 자산이 커질수록 수익률이 떨어진다 —
     이 브레이크가 없으면 복리가 그대로 폭주한다.
   ─ 실제 시장에서 쓰는 제곱근 충격 모형을 그대로 쓴다: 충격 ∝ √(주문금액 / 하루 거래대금) */
const STK_LIQ_K  =0.15;   // 충격 계수 — 하루 거래대금만큼 주문하면 15% 불리하게 체결
const STK_LIQ_MAX=0.45;   // 한 주문이 받을 수 있는 최대 불리
function stkTurnover(s){
  return Math.max((s.vol||0)*s.p, stkCap(s)*0.0004, 1);
}
/* 주문 금액 / 하루 거래대금 에 비례한다 — 소액은 거의 티가 나지 않고, 거래대금을 넘기는
   순간부터 급격히 나빠진다. 「자산이 커질수록 굴리기 어렵다」가 이 한 줄에서 나온다. */
function stkImpact(s, amount){
  if(!s || !(amount>0)) return 0;
  /* 📢 대량보유 공시된 종목은 시장이 내 매매를 «앞질러 간다» — 살 땐 먼저 오르고 팔 땐 먼저 빠진다.
     세금과 달리 돈을 떼는 게 아니라 «굴리기 어려워지는» 방식의 제동이다. */
  const k = (typeof stkDisclosed==="function" && stkDisclosed(s)) ? STK_DISCL_K : 1;
  return clamp(STK_LIQ_K*k*(amount/stkTurnover(s)), 0, STK_LIQ_MAX);
}
/* 체결 단가 — side 는 매수 +1 · 매도 −1 */
function stkFillPx(s, q, side){
  const imp=stkImpact(s, Math.max(0,q)*s.p);
  return {px:Math.max(1, Math.round(s.p*(1+side*imp))), imp};
}
/* 내가 밀어 올린(내린) 값은 시장에 남는다 */
function stkPushMom(s, side, imp){
  if(s && imp>0) s.mom += side*imp*0.35;
}
const STK_FEE=0.0015;     // 매매 수수료
const STK_TAX=0.0023;     // 매도 시 거래세 (실제 국내 증권거래세 수준)

/* 리그와 무관한 상장사들 — 업종이 한쪽으로 쏠리지 않게 손으로 깔아 둔다 */
const STK_EXTRA=[
  ["가온전자","elec","blue"],   ["아이맥스반도체","elec","grow"], ["세림디스플레이","elec","grow"],
  ["누리소프트","game","grow"], ["픽셀게임즈","game","junk"],     ["하이퍼게임","game","penny"],
  ["태웅제약","med","blue"],    ["제넥스바이오","bio","junk"],     ["셀트리메드","bio","grow"],
  ["온누리바이오","bio","penny"],["한백화학","chem","blue"],       ["동방석유화학","chem","grow"],
  ["새한건설","cons","penny"],  ["대륙엔지니어링","cons","grow"],  ["삼정중공업","ship","blue"],
  ["남양조선","ship","penny"],  ["푸른항공","air","grow"],         ["한라항공","air","penny"],
  ["코리아텔레콤","tel","blue"],["웨이브통신","tel","grow"],        ["큐빅엔터","ent","grow"],
  ["스타원엔터","ent","junk"],  ["미래에너지","ener","grow"],       ["태양광솔루션","ener","junk"],
  ["대한물류","logi","blue"],   ["스피드택배","logi","penny"],      ["행복마트","ret","blue"],
  ["온라인쇼핑몰","ret","grow"],["참맛식품","food","blue"],         ["청춘라면","food","penny"],
  ["한울금융지주","fin","blue"],["새길증권","fin","grow"],          ["빛고을교육","edu","penny"],
  ["에듀케어","edu","junk"],    ["철강코리아","steel","blue"],      ["신성특수강","steel","penny"],
  ["코어모터스","auto","blue"], ["이브이테크","auto","grow"],       ["배터리셀","auto","junk"],
  ["메디케어","med","grow"],
  /* 🏙️ 시민구단 운영 주체를 증시에서 빼면서(제보) 비어 버린 자리 — 리그와 무관한 기업으로 채운다.
     업종이 한쪽으로 몰리지 않게 골고루 넣었다. */
  ["한도시개발","cons","grow"],  ["누리건설","cons","blue"],       ["동성토건","cons","penny"],
  ["예성항만개발","logi","grow"],["백두해운","logi","penny"],       ["가온물산","ret","grow"],
  ["성일정공","auto","penny"],   ["한빛정밀","elec","grow"],        ["세종반도체소재","elec","penny"],
  ["나래바이오팜","bio","grow"],  ["청산제약","med","penny"],        ["다온화학","chem","penny"],
  ["미래전력","ener","blue"],     ["그린에너지솔루션","ener","penny"],["케이푸드","food","grow"],
  ["온기식품","food","junk"],     ["새벽택배","logi","junk"],        ["한들캐피탈","fin","penny"],
  ["금강제강","steel","grow"]
];
/* 구단 모기업은 업종을 이름에서 읽어 맞춘다 — 「제철」이면 철강, 「중공업」이면 조선 */
/* 🏙️ 옛 세이브 정리용 — 증시에 올라 있던 시민구단 운영 주체를 「계열 분리한 사기업」으로 남긴다.
   보유 주식과 시세 기록을 지우지 않고 사명만 바꾸는 방식이라, 물려 있던 돈이 사라지지 않는다. */
let STK_SPIN_N=0;   // 진단용 — 이번 불러오기에서 계열 분리된 종목 수
const STK_SPINOFF={
  gangwon:"태백개발",     incheon:"서해항만물류",   anyang:"만안건설",
  gwangju:"무등산업",     daegu:"팔공테크",         suwonfc:"화홍건설",
  seongnam:"판교디벨롭",  bucheon:"복사골산업",     gyeongnam:"남강산업",
  gimpo:"한강신도시개발", ansan:"반월산업",         cheonan:"천호건설",
  hwaseong:"동탄디벨롭",  yongin:"기흥테크노",      gimhae:"낙동산업",
  paju:"임진개발",        asan:"온양산업",          cheongju:"상당테크",
  gimcheon:"직지산업"
};
/* 이 구단의 운영 주체가 증시에 올라올 수 있는가 — 기업구단의 모기업만 상장사다 */
function stkListable(ct){
  if(!ct || !ct.o) return false;
  if(ct.k!=="corp") return false;                       // 시민·기업+시민·군경 제외
  if(/시$|도$|시청|도청|시민주주|도민주주|체육부대|컨소시엄|재단|·/.test(ct.o)) return false;
  return true;
}
/* 🏢 구단 형태가 바뀌었다 — 모기업 상장 여부를 맞춘다.
   기업구단이 되면 새로 상장하고, 시민·군경으로 돌아가면 목록에서 뺀다(보유분은 현금화). */
function stkSyncClubListing(t){
  const S=G.stock; if(!S || !t) return;
  const ct=clubType(t);
  const cur=(S.list||[]).find(s=>s.tid===t.id && !s.dead);
  if(stkListable(ct)){
    if(cur){ if(cur.n!==ct.o) cur.n=ct.o; return; }
    const id=(S.list||[]).reduce((m,x)=>Math.max(m,x.id),0)+1;
    const s=stkMake(id, ct.o, stkGuessSector(ct.o), (Math.random()<0.72?"blue":"grow"), t.id);
    S.list.push(s);
    try{ stkLog("ipo", `🏢 <b>${ct.o}</b> 신규 상장 — ${t.short} 모기업`, s.id); }catch(e){}
  } else if(cur){
    /* 상장 폐지가 아니라 「비상장 전환」 — 보유분은 현재가로 정산해 돌려준다 */
    try{
      const M=me(), h=M.stkInv && M.stkInv[cur.id];
      if(h && h.q>0){ M.cash=Math.round((M.cash + h.q*cur.p/1e8)*1e4)/1e4; delete M.stkInv[cur.id]; }
    }catch(e){}
    S.list=S.list.filter(x=>x.id!==cur.id);
    try{ stkLog("delist", `🏢 <b>${cur.n}</b> 비상장 전환 — ${t.short} 운영 주체 변경`, cur.id); }catch(e){}
  }
}
/* tid 로 상장 종목 찾기 — 시민구단은 아예 없으므로 null 이 정상이다 */
function stkOfTeam(tid){
  const S=stkState(); if(!S) return null;
  return S.list.find(x=>x.tid===tid && !x.dead) || null;
}
function stkGuessSector(nm){
  const s=String(nm||"");
  if(/제철|철강|특수강/.test(s)) return "steel";
  if(/중공업|조선/.test(s))      return "ship";
  if(/모터|자동차|오토/.test(s)) return "auto";
  if(/금융|은행|증권|캐피탈/.test(s)) return "fin";
  if(/에너지|전력|가스|석유/.test(s)) return "ener";
  if(/항만|물류|해운/.test(s))   return "logi";
  if(/개발|건설|도시|주택/.test(s)) return "cons";
  if(/전자|반도체|디스플레이/.test(s)) return "elec";
  if(/통신|텔레콤/.test(s))      return "tel";
  if(/식품|유통|마트/.test(s))   return "food";
  return "cons";
}
function stkState(){
  if(!G.stock) return null;
  return G.stock;
}
/* 종목 하나를 만든다 */
function stkMake(id, name, sector, tier, tid){
  const T=STK_TIER[tier];
  /* 시작 주가 — 등급에 따라 자릿수가 다르다 */
  const price = tier==="penny" ? 120+Math.round(Math.random()*780)
              : tier==="junk"  ? 400+Math.round(Math.random()*2600)
              : tier==="blue"  ? 18000+Math.round(Math.random()*92000)
              :                  6000+Math.round(Math.random()*46000);
  /* 상장주식 수 — 시가총액이 등급별로 그럴듯하게 나오도록 역산한다 */
  const capWant = tier==="blue" ? (8+Math.random()*40)*1e12
                : tier==="grow" ? (0.4+Math.random()*4.6)*1e12
                : tier==="penny"? (150+Math.random()*900)*1e8
                :                 (80+Math.random()*600)*1e8;
  const shares=Math.max(1e6, Math.round(capWant/price/1e5)*1e5);
  return {
    id, n:name, sec:sector, tier, tid:tid||null,
    p:price, o:price, hi:price, lo:price, pc:price,      // 현재가 · 시가 · 고가 · 저가 · 전일종가
    sh:shares,
    vol:0,                                              // 오늘 거래량
    hist:[price],                                       // 종가 기록
    /* 재무 — 실적 발표 때마다 조금씩 움직인다 */
    eps: Math.round(price/(tier==="blue"?9+Math.random()*8:tier==="grow"?18+Math.random()*30:-2+Math.random()*40)),
    bps: Math.round(price*(tier==="blue"?0.9+Math.random()*1.4:tier==="grow"?0.35+Math.random()*0.9:0.2+Math.random()*1.6)),
    div: tier==="blue" ? Math.round((1.2+Math.random()*3.6)*10)/10
       : tier==="grow" ? Math.round((Math.random()*1.4)*10)/10 : 0,
    mom: 0,          // 단기 모멘텀 (뉴스·실적이 밀어 주는 힘, 매일 감쇠)
    /* 종목 고유의 추세 — 같은 등급이라도 잘 크는 회사와 시들어 가는 회사가 갈린다 */
    dr: Math.round((T.dr + (Math.random()*2-1)*(T.sp||0))*1e7)/1e7,
    dead: 0          // 상장폐지되면 1
  };
}
/* 시장을 처음 연다 */
function stkInit(){
  const S={ day:-1, list:[], sec:{}, mood:0, log:[] };
  /* 업종별 사이클 — 업종 전체가 같이 오르내린다 */
  for(const k in STK_SECTOR) S.sec[k]={t:Math.random()*6.28, v:0};
  let id=1;
  /* ① 구단 모기업 — 리그를 아는 사람이 바로 알아보는 종목들.
     ⚠ 상장사는 「기업구단의 모기업」뿐이다. 시민구단의 운영 주체는 시·도와 시민 주주이고
        군경구단은 국군체육부대다 — 주식시장에 있을 수가 없다(제보). */
  try{
    for(const tid in G.teams){
      const t=G.teams[tid];
      if(!t || t.div!==1 && t.div!==2) continue;
      const ct=clubType(t); if(!ct || !ct.o) continue;
      if(!stkListable(ct)) continue;
      if(S.list.some(x=>x.n===ct.o)) continue;
      const tier = (Math.random()<0.72?"blue":"grow");
      S.list.push(stkMake(id++, ct.o, stkGuessSector(ct.o), tier, tid));
    }
  }catch(e){}
  /* ② 리그 밖 기업 */
  for(const [n,sec,tier] of STK_EXTRA) S.list.push(stkMake(id++, n, sec, tier, null));
  G.stock=S;
  return S;
}
/* 정규분포 난수 (박스-뮐러 대신 합산 근사 — 꼬리가 덜 두꺼워 폭주하지 않는다) */
function stkRand(){ return (Math.random()+Math.random()+Math.random()+Math.random()+Math.random()+Math.random()-3)/1.2; }

/* 하루치 시장을 굴린다 — stepDay 에서 부른다 */
function stkTick(){
  const S=stkState(); if(!S) return;
  const d=G.day||0;
  if(S.day===d) return;          // 같은 날 두 번 굴리지 않는다
  S.day=d;
  /* 시장 전체 분위기 — 완만하게 방황한다 */
  S.mood = clamp(S.mood*0.90 + stkRand()*0.0012, -0.011, 0.011);
  /* 업종 사이클 */
  for(const k in S.sec){
    const c=S.sec[k];
    c.t += 0.055 + Math.random()*0.03;
    c.v = Math.sin(c.t)*0.0010 + stkRand()*0.0006;
  }
  for(const s of S.list){
    if(s.dead) continue;
    const T=STK_TIER[s.tier]||STK_TIER.grow;
    /* 상장폐지 — 잡주·동전주가 바닥을 뚫으면 실제로 사라진다 */
    /* 바닥을 뚫으면 관리종목을 거쳐 정리된다 — 잡주에 물리면 실제로 돈이 사라진다 */
    if(T.dl>0 && s.p < (s.tier==="penny"?90:400) && Math.random()<T.dl*0.06){ stkDelist(s); continue; }
    if(T.dl>0 && Math.random()<T.dl/900){ stkDelist(s); continue; }
    const drift = (s.dr!=null?s.dr:T.dr) + S.mood + (S.sec[s.sec]?S.sec[s.sec].v:0) + s.mom + stkValPull(s);
    const shock = stkRand()*T.vol;
    let r = drift + shock;
    r = clamp(r, -0.29, 0.29);                       // 상·하한가
    s.pc = s.p;
    const np = Math.max(1, s.p*(1+r));
    /* 하루 안의 시가·고가·저가 — 종가에서 역으로 흩뿌린다 */
    const amp = Math.abs(r)*0.6 + T.vol*0.5;
    s.o  = Math.max(1, Math.round(s.pc*(1+stkRand()*T.vol*0.35)));
    s.hi = Math.max(s.o, Math.round(Math.max(np, s.pc)*(1+Math.random()*amp*0.5)));
    s.lo = Math.min(s.o, Math.round(Math.min(np, s.pc)*(1-Math.random()*amp*0.5)));
    s.p  = Math.round(np);
    s.lo = Math.max(1, Math.min(s.lo, s.p));
    s.hi = Math.max(s.hi, s.p);
    /* 거래량 — 많이 움직인 날 많이 터진다 */
    s.vol = Math.round(s.sh * (0.0008 + Math.abs(r)*0.06) * (0.5+Math.random()));
    s.mom *= 0.82;                                   // 모멘텀은 하루하루 식는다
    /* ✂️ 자릿수가 커지면 액면을 쪼갠다 — 실제 시장의 관행이자, 4억짜리 주식을 막는 장치 */
    /* 급등주는 며칠 만에 자릿수가 바뀐다 — 한참 지나서 쪼개면 그동안 4백만 원짜리가 돌아다닌다.
       두 배를 넘기면 그날 바로, 아니면 나흘 안에 처리한다. 비율도 값에 맞춰 잡는다. */
    if(s.p>SPLIT_HI && !(s.splitAt && (G.day||0)-s.splitAt<90)
       && (s.p>SPLIT_HI*2 || Math.random()<0.25)){
      S.splitN=(S.splitN||0)+1;
      stkSplit(s, clamp(Math.round(s.p/60000), 2, 20));
    }
    s.hist.push(s.p);
    if(s.hist.length>STK_HIST) s.hist.splice(0, s.hist.length-STK_HIST);
    /* 📈 일봉 — 캔들·이평선·거래량 차트는 종가만으로는 그릴 수 없다 */
    if(!Array.isArray(s.ohlc)) s.ohlc=[];
    s.ohlc.push([s.o, s.hi, s.lo, s.p, s.vol]);
    if(s.ohlc.length>STK_OHLC) s.ohlc.splice(0, s.ohlc.length-STK_OHLC);
  }
  try{ stkOrderTick(); }catch(e){}     // 📋 예약 주문 체결
  try{ fssTick(); }catch(e){}          // 🚨 금감원 — 시세조종 조사
  try{ ownTick(); }catch(e){}          // 🏢 모기업 실적 → 구단 예산 (지원금 삭감·특별 지원)
  try{ rumTick(); }catch(e){}          // 🗞️ 펨코 루머 게시판
  try{ stkMarginTick(); }catch(e){}    // 💳 이자 · 반대매매
  try{ stkShortTick(); }catch(e){}     // 📉 공매도 — 대여 수수료 · 숏스퀴즈 · 강제 청산
  try{ stkDebtTick(); }catch(e){}      // 🩸 사채 이자 · 독촉 · 파산
  try{ stkShockTick(); }catch(e){}     // 💣 개별 악재 — 분식회계·유상증자·감자·오너 리스크
  try{ stkThemeTick(); }catch(e){}     // 🎪 테마주 광풍
  try{ stkIpoTick(); }catch(e){}       // 🆕 신규 상장
  try{ stkFutTick(); }catch(e){}       // 📊 지수 · 선물 만기 · 강제청산
  try{ stkNewsTick(); }catch(e){}
  try{ stkTipTick(); }catch(e){}       // 🕵️ 찌라시 — 새 소문 · 적중/낭설 판정
  try{ stkWatchTick(); }catch(e){}
  /* 📊 분기 실적 — 90일마다 한 번 */
  try{ if(d>0 && d%90===0) stkEarnings(); }catch(e){}
}
/* ═══ ✂️ 액면분할 ══════════════════════════════════════════════════════
   한 주 값이 수십만 원을 넘으면 실제 기업은 액면을 쪼갠다 — 그래야 사람들이 산다.
   가격을 k 로 나누고 주식 수를 k 배로 늘린다. 시가총액·보유 평가액은 그대로다.
   보유 수량·평균단가, 공매도 잔고, 예약 주문, 차트까지 함께 환산해야 어긋나지 않는다. */
function stkSplit(s, k){
  try{
    k=Math.max(2, Math.round(k||5));
    const M=me();
    s.p=Math.max(1, Math.round(s.p/k));
    s.pc=Math.max(1, Math.round(s.pc/k));
    s.o=Math.max(1, Math.round(s.o/k)); s.hi=Math.max(1, Math.round(s.hi/k)); s.lo=Math.max(1, Math.round(s.lo/k));
    s.sh=Math.round(s.sh*k);
    if(s.eps) s.eps=Math.round(s.eps/k);
    if(s.bps) s.bps=Math.round(s.bps/k);
    if(Array.isArray(s.hist)) s.hist=s.hist.map(v=>Math.max(1,Math.round(v/k)));
    if(Array.isArray(s.ohlc)) s.ohlc=s.ohlc.map(c=>[Math.max(1,Math.round(c[0]/k)),Math.max(1,Math.round(c[1]/k)),
                                                    Math.max(1,Math.round(c[2]/k)),Math.max(1,Math.round(c[3]/k)), Math.round((c[4]||0)*k)]);
    /* 내 계좌 */
    const h=M.stkInv && M.stkInv[s.id];
    /* 평균단가도 «원» 단위다 — 나누고 나서 반올림하지 않으면 소수점이 남는다 */
    if(h && h.q>0){ h.q=Math.round(h.q*k); h.avg=Math.max(1, Math.round(h.avg/k)); }
    const sh2=M.short && M.short[s.id];
    if(sh2 && sh2.q>0){ sh2.q=Math.round(sh2.q*k); sh2.avg=Math.max(1, Math.round(sh2.avg/k)); }
    for(const o of stkOrders()) if(o.sid===s.id){ o.px=Math.max(1, Math.round(o.px/k)); o.q=Math.round(o.q*k); }
    s.splitAt=G.day||0;
    stkLog("split", `✂️ <b>${s.n}</b> 액면분할 1:${k} — 주가 ${stkWon(s.p)}원으로 조정 (보유 주식 수는 ${k}배)`, s.id);
    stkPing(s, `✂️ <b>${s.n}</b> 액면분할 1:${k} — 보유 수량이 ${k}배로 늘고 단가는 ${k}분의 1이 됩니다.`, "info");
  }catch(e){}
}
/* ═══ ⚖️ 과열 되돌림 ══════════════════════════════════════════════════
   너무 가파르게 오른 값은 되돌아오고, 너무 깊이 빠진 값은 반등한다.
   추세를 한쪽으로만 흐르게 두면 「사놓고 기다리기」가 무조건 이기는 게임이 된다.
   ⚠ 기준을 실적(PER)으로 잡았더니, 실적 자체가 주가를 따라 조정되면서 서로를 끌어내리는
      하강 나선이 생겼다(실측: 전 종목 1원). 기준은 그 종목 자신의 90일 평균으로 둔다 —
      외부 값에 기대지 않아 안정적이고, 「단기 급등은 되돌린다」는 감각도 그대로다. */
function stkValPull(s){
  try{
    const H=s.hist;
    if(!Array.isArray(H) || H.length<25) return 0;
    const n=Math.min(90, H.length);
    let m=0; for(let i=H.length-n; i<H.length; i++) m+=H[i];
    m/=n;
    if(!(m>0)) return 0;
    const gap=clamp(s.p/m-1, -0.70, 2.00);
    return clamp(-gap*VAL_PULL, -VAL_MAX, VAL_MAX);
  }catch(e){ return 0; }
}
/* ═══ 💣 개별 악재 쇼크 ════════════════════════════════════════════════
   시장이 재미있어지는 건 우상향 때문이 아니라, 하루아침에 반토막이 나는 일이 있기 때문이다.
   드물지만 걸리면 며칠 연속으로 흘러내린다 — 물리면 실제로 크게 잃는다. */
const STK_SHOCK=[
  {k:"acc",  t:"{n}, 분식회계 의혹 — 금융감독원 감리 착수", d:3, e:[-0.24,-0.42], w:1.0, tier:["grow","penny","junk"]},
  {k:"emb",  t:"{n} 최대주주 횡령·배임 혐의 피소", d:3, e:[-0.20,-0.36], w:1.0, tier:["grow","penny","junk"]},
  {k:"cap",  t:"{n}, 대규모 유상증자 결정 — 기존 주주 지분 희석", d:2, e:[-0.14,-0.26], w:1.4, tier:["grow","penny","junk","blue"]},
  {k:"red",  t:"{n} 무상감자 결정 — 자본잠식 해소 목적", d:3, e:[-0.28,-0.46], w:0.7, tier:["penny","junk"]},
  {k:"halt", t:"{n} 거래정지 — 상장폐지 실질심사 대상 결정", d:4, e:[-0.30,-0.55], w:0.5, tier:["penny","junk"]},
  {k:"rec",  t:"{n}, 대규모 리콜 발표 — 충당금 반영 불가피", d:2, e:[-0.12,-0.22], w:1.2, tier:["blue","grow"]},
  {k:"fine", t:"{n}, 공정위 과징금 부과 — 사상 최대 규모", d:2, e:[-0.10,-0.19], w:1.2, tier:["blue","grow"]},
  {k:"ceo",  t:"{n} 대표이사 돌연 사임 — 경영 공백 우려", d:2, e:[-0.09,-0.18], w:1.0, tier:["blue","grow","penny"]}
];
/* 반대쪽도 있어야 도박이 된다 — 걸리면 며칠 만에 두 배가 되는 일도 실제로 일어난다 */
const STK_BOOM=[
  {k:"deal", t:"{n}, 창사 이래 최대 규모 수주 계약 체결", d:3, e:[0.20,0.38], w:1.0, tier:["grow","penny","junk","blue"]},
  {k:"drug", t:"{n} 신약 임상 3상 성공 — 글로벌 기술수출 임박", d:3, e:[0.26,0.48], w:0.9, tier:["grow","penny","junk"]},
  {k:"mna",  t:"{n} 경영권 인수설 — 지분 경쟁 불붙었다", d:2, e:[0.18,0.34], w:1.0, tier:["grow","penny","junk"]},
  {k:"buy",  t:"{n}, 대규모 자사주 매입·소각 결정", d:2, e:[0.10,0.20], w:1.2, tier:["blue","grow"]},
  {k:"free", t:"{n} 무상증자 결정 — 권리락 기대감", d:2, e:[0.12,0.26], w:1.0, tier:["grow","penny"]},
  {k:"turn", t:"{n}, 흑자 전환 성공 — 관리종목 탈피", d:3, e:[0.22,0.42], w:0.8, tier:["penny","junk"]},
  {k:"ord",  t:"{n} 글로벌 완성차와 장기 공급계약 체결", d:2, e:[0.11,0.21], w:1.1, tier:["blue","grow"]}
];
function stkShockTick(){
  const S=stkState(); if(!S) return;
  const live=S.list.filter(s=>!s.dead);
  if(!live.length) return;
  /* 진행 중인 쇼크를 하루씩 흘린다 */
  for(const s of live){
    if(!s.shock) continue;
    s.shock.left--;
    s.mom += s.shock.e;
    if(s.shock.left<=0) s.shock=null;
  }
  /* 새 쇼크 — 시장 전체로 사흘에 한 번쯤. 위아래가 반반이라야 「도박」이지 「하락장」이 아니다 */
  if(Math.random()>0.34) return;
  const LIST = Math.random()<0.5 ? STK_SHOCK : STK_BOOM;
  const pool=[];
  for(const ev of LIST) for(const s of live){
    if(s.shock || ev.tier.indexOf(s.tier)<0) continue;
    pool.push({ev, s, w:ev.w*(s.tier==="junk"?2.4:s.tier==="penny"?1.8:s.tier==="grow"?1.0:0.45)});
  }
  if(!pool.length) return;
  let tot=0; for(const p of pool) tot+=p.w;
  let r=Math.random()*tot, hit=pool[0];
  for(const p of pool){ r-=p.w; if(r<=0){ hit=p; break; } }
  const {ev, s}=hit;
  const total=ev.e[0]+Math.random()*(ev.e[1]-ev.e[0]);
  /* ⚠ mom 은 매일 0.82배로 식으므로, 한 번 넣은 값은 결국 약 5.6배(1/0.18)로 누적된다.
     의도한 총 낙폭이 total 이 되려면 「total×0.18」을 d 일에 나눠 넣어야 한다.
     이 환산을 빠뜨렸다가 한 번의 악재로 20일 연속 하한가가 나왔다(실측: 전 종목 1원). */
  s.shock={k:ev.k, left:ev.d, e:total*0.18/ev.d};
  s.mom += s.shock.e;
  const good=total>0;
  const ic=good?"🚀":"💣";
  const txt=ev.t.replace("{n}", s.n);
  stkLog(good?"boom":"shock", `${ic} <b>${txt}</b>`, s.id);
  stkPing(s, `${ic} <b>${txt}</b> — 며칠간 ${good?"급등":"급락"}이 이어질 수 있습니다.`, good?"good":"warn");
  try{ if(me().stkInv && me().stkInv[s.id] && me().stkInv[s.id].q>0)
        notifyStk(`${ic} <b>${s.n}</b> — ${txt.replace(s.n,"").replace(/^,\s*/,"")}`, good?"good":"warn"); }catch(e){}
}
/* 상장폐지 */
function stkDelist(s){
  /* 관리종목 경고 없이 사라지지 않는다 — 팔 기회는 준다 */
  if(!s.warn && !s._forceDel){ s.warn=1; try{ stkLog("warn", `⚠️ ${s.n} 관리종목 지정 — 상장폐지 심사 대상`, s.id); stkPing(s, `⚠️ <b>${s.n}</b> 관리종목 지정 — 상장폐지 심사에 들어갑니다.`, "warn"); }catch(e){} return; }
  /* 🔒 ⚠ 감사 — 상장폐지가 <b>공매도 잔고를 그대로 두고</b> 주가만 0으로 만들었다.
     체결가 하한이 1원이라 폐지된 종목을 <b>1원에 전량 커버</b>할 수 있었다 —
     실측: 100억으로 공매도 → 폐지 → 커버에 순이익 40.6억. 게다가 「관리종목 지정」이
     미리 뜨니 <b>신호까지 주는 무위험 차익</b>이었다.
     ─ 폐지되는 순간 <b>마지막 거래가로 강제 정산</b>한다. 이익도 손실도 그 값에서 확정된다. */
  const lastP=Math.max(1, s.p||1);
  {
    const H=(typeof stkShorts==="function")?stkShorts():null;
    const sh=H && H[s.id];
    if(sh && sh.q>0){
      const q=sh.q, real=(sh.avg-lastP)*q, cost=q*lastP*(1+STK_FEE);
      stkCash(-cost + q*0);                       // 되사는 값을 치른다
      me().stkReal=Math.round(((me().stkReal||0)+real/1e8)*1e8)/1e8;
      try{ taxOnRealize(s, q, real, "상장폐지 정산"); }catch(e){}
      delete H[s.id];
      try{ stkTxAdd({k:"cover", sid:s.id, n:s.n, q, px:lastP, amt:cost, real}); }catch(e){}
      try{ stkLog("delist", `🔒 <b>${s.n}</b> 상장폐지 — 공매도 ${q.toLocaleString()}주가 마지막 거래가 ${stkWon(lastP)}원으로 강제 정산되었습니다 (실현 ${real>=0?"+":""}${(real/1e8).toFixed(2)}억)`, s.id); }catch(e){}
    }
  }
  s.dead=1; s.p=0;
  const S=stkState(); if(!S) return;
  const M=me();
  const held=(M.stkInv&&M.stkInv[s.id])||null;
  S.log.unshift({d:G.day||0, k:"delist", n:s.n});
  S.log=S.log.slice(0,40);
  if(held && held.q>0){
    const loss=Math.round(held.q*held.avg);
    M.stkInv[s.id]=null; delete M.stkInv[s.id];
    M.stkReal=(M.stkReal||0)-loss/1e8;
    addNews(`💥 <b>${s.n}</b> 상장폐지 — 보유 ${held.q.toLocaleString()}주가 휴지 조각이 되었습니다 (평가손 ${(loss/1e8).toFixed(2)}억)`, "warn", "stock", {cat:"stock", ic:"📈", src:"증권가", tid:null});
    try{ notifyStk(`💥 <b>${s.n}</b>이(가) 상장폐지되었습니다. 투자금 ${(loss/1e8).toFixed(2)}억이 사라졌습니다.`, "warn"); }catch(e){}
    try{ meLog(`💥 ${s.n} 상장폐지 — ${(loss/1e8).toFixed(2)}억 손실`); }catch(e){}
  } else {
    addNews(`📉 <b>${s.n}</b>, 관리종목 지정 끝에 상장폐지되었습니다`, null, "stock", {cat:"stock", ic:"📈", src:"증권가", tid:null});
  }
}
/* ── 조회 헬퍼 ─────────────────────────────────────────────── */
function stkById(id){ const S=stkState(); return S ? S.list.find(x=>x.id===id) : null; }
function stkHeld(){                       // 보유 종목 [{s, q, avg}]
  const M=me(), S=stkState(); if(!S||!M.stkInv) return [];
  const out=[];
  for(const k in M.stkInv){ const h=M.stkInv[k]; if(!h||!h.q) continue;
    const s=stkById(+k); if(!s) continue; out.push({s, q:h.q, avg:h.avg}); }
  return out.sort((a,b)=>(b.q*b.s.p)-(a.q*a.s.p));
}
function stkEval(){ return stkHeld().reduce((n,h)=>n+h.q*h.s.p, 0); }          // 평가액(원)
function stkInvCost(){ return stkHeld().reduce((n,h)=>n+h.q*(h.avg||0), 0); }  // 매입원가(원)
function stkCost(){ return stkHeld().reduce((n,h)=>n+h.q*h.avg, 0); }          // 매입원가(원)
function stkPL(){ const c=stkCost(); return {v:stkEval()-c, pct: c>0 ? (stkEval()-c)/c*100 : 0}; }
function stkCap(s){ return s.p*s.sh; }                                          // 시가총액
function stkPER(s){ return s.eps>0 ? Math.round(s.p/s.eps*100)/100 : null; }
function stkPBR(s){ return s.bps>0 ? Math.round(s.p/s.bps*100)/100 : null; }
function stkChg(s){ return s.pc>0 ? (s.p-s.pc)/s.pc*100 : 0; }                  // 전일 대비 %
function stkMoney(w){                                                            // 원 → 보기 좋은 단위
  const a=Math.abs(w);
  if(a>=1e12) return (w/1e12).toFixed(2)+"조";
  if(a>=1e8)  return (w/1e8).toFixed(2)+"억";
  if(a>=1e4)  return Math.round(w/1e4).toLocaleString()+"만";
  return Math.round(w).toLocaleString();
}
/* 💰 억 단위 값 → 조 단위까지 — ⚠ 제보 원문 — 「'내 자산' 탭의 보유 현금량이 조 단위를
   넘어가게 되더라도 억 단위로 표시되는데, 순자산 항목처럼 조 단위로 표현 가능하게 해주시면
   감사하겠습니다」. 현금(M.cash)은 억 단위로 들고 있어서 stkMoney(원 단위)를 못 쓴다. */
function moneyEok(a){
  a=+a||0;
  if(Math.abs(a)>=10000) return (a/10000).toFixed(2)+"조";
  return a.toFixed(2)+"억";
}
/* 💹 주가·평단가처럼 「원 단위 그대로 읽는 값」의 표기.
   ⚠ 제보 원문 — 「전체 주식 종목의 주가나 시총을 보면 단위가 커질 때에도 단순 숫자로 나열되어
      있어 (예를 들어 시가 총액 7,298,506,428 등) 단위를 가늠하기가 쉽지 않습니다.
      '보유 종목' 박스의 '평단가' 또한 그렇습니다. 주식 주가, 시가총액, '보유 종목' 박스의
      '평단가' 또한 '조' 단위가 있게 된다면 '조' 단위까지, '억' 단위로 셀 수 있다면 '억' 단위를
      반영하는 '단위 체계'를 '내 자산' 탭의 '순자산', '보유 현금'처럼 도입해 주시면 감사하겠습니다」.
   ─ 억을 넘으면 억·조로 접는다. 그 아래는 원 단위 그대로 둔다 —
     45,300원짜리 주가를 「4.53만」으로 바꾸면 오히려 읽기 나빠진다(stkMoney 는 만 단위로 접는다).
   ⚠ 조는 소수 둘째 자리, 억은 값이 클수록 자리를 줄여 자릿수가 들쭉날쭉하지 않게 한다. */
function stkWon(w){
  w=+w||0; const a=Math.abs(w);
  if(a>=1e12) return (w/1e12).toFixed(2)+"조";
  if(a>=1e8)  return (w/1e8).toFixed(a>=1e10?0:2)+"억";
  return Math.round(w).toLocaleString();
}

/* ═══════════════════════════════════════════════════════════════════════════
   📰 공시·뉴스·실적 — 주가가 「그냥 흔들리는 것」이 아니라 이유를 갖게 한다
   · 매일  : 종목 뉴스 0~2건 (호재/악재가 모멘텀을 밀어 준다)
   · 분기  : 실적 발표 — 컨센서스 대비 서프라이즈/쇼크가 그날 주가를 크게 흔든다
   · 연말  : 배당 입금 · 관리종목 지정 · 상장폐지
   · 시즌말: 구단 성적이 모기업 주가로 돌아온다
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_NEWS_GOOD=[
  {t:"{n}, 신규 대형 수주 {x}억 규모 계약 체결", e:[0.012,0.045], s:["cons","ship","steel","elec","logi"]},
  {t:"{n} 신제품 초기 반응 폭발 — 예약 물량 조기 소진", e:[0.010,0.038], s:["elec","auto","game","food","ret"]},
  {t:"{n}, 해외 진출 본격화 — 현지 법인 설립", e:[0.008,0.030], s:null},
  {t:"{n} 임상 3상 성공 — 품목허가 신청 예정", e:[0.040,0.140], s:["bio","med"]},
  {t:"{n}, 자사주 {x}억 매입 결정 — 주주환원 확대", e:[0.010,0.032], s:null},
  {t:"증권가, {n} 목표주가 상향 — \"실적 개선 뚜렷\"", e:[0.008,0.026], s:null},
  {t:"{n} 신작 흥행 — 앱마켓 매출 1위 등극", e:[0.030,0.110], s:["game","ent"]},
  {t:"{n}, 정부 지원 사업 최종 선정", e:[0.012,0.040], s:["ener","bio","med","edu"]},
  {t:"{n} 대주주 지분 확대 — 경영권 강화 신호", e:[0.006,0.022], s:null},
  {t:"{n}, 경쟁사 인수 추진 — 시장 점유율 급등 전망", e:[0.020,0.070], s:null},
  {t:"{n} 신규 노선 취항 — 여객 수요 회복세", e:[0.012,0.040], s:["air","logi"]},
  {t:"{n}, 배당 확대 발표 — 배당성향 상향", e:[0.008,0.028], s:null}
];
const STK_NEWS_BAD=[
  {t:"{n}, 대규모 리콜 결정 — 비용 {x}억 추산", e:[-0.055,-0.014], s:["auto","elec","food"]},
  {t:"{n} 공장 화재 — 생산 차질 불가피", e:[-0.070,-0.020], s:["chem","steel","ship","elec","food"]},
  {t:"{n}, 담합 혐의로 공정위 조사 착수", e:[-0.045,-0.012], s:null},
  {t:"{n} 임상 실패 — 개발 중단 발표", e:[-0.180,-0.060], s:["bio","med"]},
  {t:"{n}, 유상증자 {x}억 결정 — 주주가치 희석 우려", e:[-0.080,-0.025], s:null},
  {t:"증권가, {n} 투자의견 하향 — \"성장 둔화\"", e:[-0.030,-0.008], s:null},
  {t:"{n} 신작 혹평 — 환불 요청 쇄도", e:[-0.100,-0.030], s:["game","ent"]},
  {t:"{n}, 최대주주 지분 대량 매도", e:[-0.060,-0.018], s:null},
  {t:"{n} 노조 전면 파업 돌입 — 조업 중단", e:[-0.050,-0.015], s:["auto","ship","steel","air","logi"]},
  {t:"{n}, 회계 논란 — 감사의견 한정 우려", e:[-0.120,-0.040], s:null},
  {t:"{n} 대표이사 배임 혐의 입건", e:[-0.090,-0.028], s:null},
  {t:"{n}, 주력 거래처 이탈 — 매출 급감 전망", e:[-0.065,-0.020], s:null}
];
/* 시장 전체를 흔드는 매크로 뉴스 — 가끔 나오고, 전 종목에 같이 걸린다 */
/* ⚠ 실측 — 여기 여덟 줄의 합이 -0.014 였다. 이 값은 시장 분위기(S.mood)에 누적되는데,
   mood 는 하루 0.94배로만 식으므로 한 번의 치우침이 약 17배로 증폭된다.
   그 결과 10시즌을 돌리면 우량주까지 96% 하락하는 「영원한 하락장」이 됐다(실측).
   호재와 악재의 합을 0 에 맞춰 둔다 — 방향은 무작위여야 하고, 기울어져 있으면 안 된다. */
const STK_MACRO=[
  {t:"기준금리 인상 — 시장 전반 조정", e:-0.016}, {t:"기준금리 인하 — 유동성 기대감", e:0.017},
  {t:"환율 급등 — 수출주 강세 · 내수주 약세", e:0.010}, {t:"국제 유가 급등 — 원가 부담 확대", e:-0.011},
  {t:"외국인 순매수 전환 — 지수 반등", e:0.016},       {t:"글로벌 증시 급락 — 위험자산 회피", e:-0.022},
  {t:"정부 부양책 발표 — 투자심리 개선", e:0.019},     {t:"경기 지표 부진 — 침체 우려 확산", e:-0.014}
];
function stkLog(k, txt, id){
  const S=stkState(); if(!S) return;
  if(!Array.isArray(S.news)) S.news=[];
  S.news.unshift({d:G.day||0, k, t:txt, id:id||null});
  S.news=S.news.slice(0,60);
}
/* 보유 중인 종목의 소식은 감독에게 직접 알린다 */
function stkPing(s, txt, tone){
  try{
    const M=me();
    if(M.stkInv && M.stkInv[s.id] && M.stkInv[s.id].q>0) notifyStk(txt, tone||"info");
  }catch(e){}
}
/* ── 📰 매일 뉴스 ─────────────────────────────────────────── */
function stkNewsTick(){
  const S=stkState(); if(!S) return;
  const live=S.list.filter(s=>!s.dead);
  if(!live.length) return;
  /* 매크로 — 20일에 한 번꼴 */
  if(Math.random()<0.05){
    const m=pick(STK_MACRO);
    S.mood=clamp(S.mood + m.e*0.28, -0.03, 0.03);
    for(const s of live) s.mom += m.e*(0.5+Math.random()*0.8)*(STK_TIER[s.tier].vol/0.03);
    stkLog("macro", `🌐 ${m.t}`);
  }
  /* 종목 뉴스 — 하루 0~2건 */
  const n=Math.random()<0.45 ? 0 : (Math.random()<0.72 ? 1 : 2);
  for(let i=0;i<n;i++){
    const s=pick(live);
    /* 잘 나가는 회사엔 호재가, 무너지는 회사엔 악재가 더 자주 붙는다 */
    /* ⚠ 두 가지가 겹쳐 있었다.
       ① 오른 종목에 호재가 더 붙었다(mom*8) — 추세가 스스로를 먹여 살려
          「우량주를 사서 들고 있기만 하면 되는」 시장이 됐다. 되먹임을 없앤다.
       ② 악재의 평균 충격(-5.2%)이 호재(+3.3%)보다 55% 컸는데 확률은 반반이었다.
          그대로 두면 시장 전체가 영원히 흘러내린다(실측: 10시즌 뒤 우량주 -93%).
       ─ 「악재는 세게, 대신 덜 자주」로 균형을 맞춘다(호재 61%). 실제 시장의 결이기도 하다. */
    const up=Math.random() < clamp(0.61 + (s.dr||0)*60, 0.50, 0.72);
    const pool=(up?STK_NEWS_GOOD:STK_NEWS_BAD).filter(x=>!x.s || x.s.indexOf(s.sec)>=0);
    if(!pool.length) continue;
    const N=pick(pool);
    const eff=N.e[0] + Math.random()*(N.e[1]-N.e[0]);
    /* 작은 회사일수록 같은 뉴스에 크게 반응한다 */
    const k=clamp(STK_TIER[s.tier].vol/0.025, 0.5, 2.6);
    s.mom += eff*k*0.45;
    /* 계약·매입 규모 — 시가총액의 한 자릿수 % 정도라야 숫자가 현실적이다 */
    const amt=Math.max(3, Math.round((stkCap(s)/1e8)*(0.004+Math.random()*0.038)));
    const txt=N.t.replace("{n}", s.n).replace("{x}", amt.toLocaleString());
    stkLog(up?"good":"bad", txt, s.id);
    if(Math.abs(eff)>=0.05) stkPing(s, `${up?"📈":"📉"} <b>${s.n}</b> — ${txt.replace(s.n,"").replace(/^,\s*/,"")}`, up?"good":"warn");
  }
}
/* ── 📊 분기 실적 ─────────────────────────────────────────── */
function stkEarnings(){
  const S=stkState(); if(!S) return;
  const live=S.list.filter(s=>!s.dead);
  let big=0;
  for(const s of live){
    const T=STK_TIER[s.tier];
    /* 컨센서스 대비 — 우량주는 예상에서 크게 벗어나지 않는다 */
    const sur=stkRand()*(s.tier==="blue"?0.16:s.tier==="grow"?0.30:0.55);
    /* ⚠ 실적 성장을 주가 추세보다 빠르게 잡으면 PER 이 해마다 반토막 난다(실측 5.5까지 내려감).
       분기 성장은 그 회사의 장기 추세와 같은 속도로 둔다. */
    const grow0=(s.dr||T.dr)*90;                     // 분기 실적 자체의 성장분
    /* PER 이 한쪽으로 계속 흘러가지 않게 되돌리는 힘을 준다 —
       실적만 계속 좋아지면 몇 년 뒤 전 종목이 PER 5 인 저평가 시장이 된다(실측 6.2). */
    const perNow=s.eps>0 ? s.p/s.eps : 99;
    const perTgt=s.tier==="blue"?12 : s.tier==="grow"?24 : 30;
    const pull=clamp((perNow/perTgt-1)*0.12, -0.07, 0.12);
    s.eps=Math.round(s.eps*(1+grow0+sur*0.6+pull));
    s.bps=Math.round(s.bps*(1+grow0*0.4+sur*0.15));
    if(s.bps<50) s.bps=50;
    s.mom += clamp(sur*0.30, -0.055, 0.055);
    if(Math.abs(sur)>=0.22){
      big++;
      const good=sur>0;
      const txt=`${s.n} 분기 실적 ${good?"어닝 서프라이즈":"어닝 쇼크"} — 영업이익 컨센서스 ${good?"상회":"하회"} (${good?"+":""}${Math.round(sur*100)}%)`;
      stkLog(good?"earn+":"earn-", txt, s.id);
      stkPing(s, `${good?"🎉":"😨"} <b>${s.n}</b> ${good?"어닝 서프라이즈":"어닝 쇼크"} — 컨센서스 ${good?"상회":"하회"} ${Math.round(Math.abs(sur)*100)}%`, good?"good":"warn");
    }
    /* 적자가 이어지면 배당을 끊는다 */
    if(s.eps<0 && s.div>0){ s.div=0; stkLog("bad", `${s.n}, 적자 전환으로 배당 중단 결정`, s.id); }
    else if(s.eps>0 && s.tier==="blue" && s.div===0){ s.div=Math.round((0.8+Math.random()*2.2)*10)/10; }
  }
  stkLog("season", `📊 ${G.season}년 분기 실적 발표 시즌 — 서프라이즈·쇼크 ${big}건`);
}
/* ── 💰 배당 ──────────────────────────────────────────────── */
function stkDividend(){
  const S=stkState(); if(!S) return;
  const M=me();
  if(!M.stkInv) return;
  let sum=0; const rows=[];
  for(const k in M.stkInv){
    const h=M.stkInv[k]; if(!h||!h.q) continue;
    const s=stkById(+k); if(!s||s.dead||!s.div) continue;
    const cash=h.q*s.p*(s.div/100);                  // 세전 배당
    if(cash<1) continue;
    sum+=cash; rows.push(`${s.n} ${stkMoney(cash)}`);
  }
  if(sum<=0) return;
  /* 🧾 ② 금융소득 종합과세 — 연 2천만원까지는 15.4%, 넘는 몫은 종합과세로 세율이 뛴다 */
  const _tx=taxOnDividend(sum);
  const _net=Math.max(0, sum-_tx);
  if(_tx>0){
    try{ stkLog("tax", `🧾 배당소득세 <b>${stkMoney(_tx)}</b> 원천징수 — 세전 ${stkMoney(sum)} (연 누계가 종합과세 기준을 넘으면 세율이 올라갑니다)`); }catch(e){}
  }
  sum=_net;
  stkCash(sum);
  M.earned=Math.round((M.earned+sum/1e8)*100)/100;
  M.stkDiv=Math.round(((M.stkDiv||0)+sum/1e8)*1e4)/1e4;
  stkLog("div", `💰 결산 배당 지급 — 총 ${stkMoney(sum)} (${rows.length}종목)`);
  try{ meLog(`💰 주식 배당 ${(sum/1e8).toFixed(2)}억 입금 (${rows.slice(0,3).join(" · ")}${rows.length>3?" 외":""})`); }catch(e){}
  try{ notifyStk(`💰 보유 주식 배당 <b>${(sum/1e8).toFixed(2)}억</b>이 입금되었습니다 — ${rows.slice(0,2).join(" · ")}${rows.length>2?` 외 ${rows.length-2}종목`:""}`,"good"); }catch(e){}
}
/* ═══ 🚨 금융감독원 — 시세조종 조사 ═══════════════════════════════════════
   도박 발각(gamCatchRoll)과 같은 문법이다. 큰 주문으로 값을 반복해서 밀어 올리면 열기가 쌓이고,
   걸리면 <b>돈을 뺏기는 게 아니라 사건이 일어난다</b> — 과징금·계좌 동결, 그리고 감독직에도 흠집이 난다.
   K리그 감독이 주가조작 혐의로 조사받는 그림은 그 자체로 이야깃거리다. */
const FSS_BAN_D=30;          // 계좌 동결 일수
function fssTick(){
  try{
    const F=fssState();
    F.heat=Math.max(0, (F.heat||0)*0.90);                  // 열기는 매일 식는다
    if(fssFrozen()) return;
    const h=F.heat||0;
    if(h<18) return;
    const p=clamp((h-18)/420, 0, 0.09);
    if(Math.random()>=p) return;
    /* 걸렸다 */
    F.n=(F.n|0)+1; F.heat=h*0.30;
    const M=me(), t=userTeam();
    const gain=Math.max(0, (M.stkReal||0));                // 누적 실현이익(억)
    const fine=Math.round(clamp(gain*0.25, 5, 4000)*100)/100;   // 부당이득 추정분의 25%
    const pay=Math.min(fine, Math.max(0, M.cash||0));
    stkCash(-pay*1e8);
    F.fine=Math.round(((F.fine||0)+pay)*100)/100;
    F.ban=(G.day||0)+FSS_BAN_D;
    /* 🧑‍💼 무직 — 과징금과 계좌 동결은 «개인 금융» 문제라 그대로 간다.
       다만 소속 구단이 없으니 구단주·팬 신뢰, 언론 관계, 구단 팬 반응은 건너뛴다
       (도박 발각을 무직일 때 소문나지 않게 한 것과 같은 원칙). */
    const jobless=!!(G && G.jobless);
    const nm=(typeof mgrName==="function"&&t&&!jobless)?mgrName(t):"전 감독";
    const tn=(t&&!jobless)?t.short:"";
    try{ stkLog("fss", `🚨 <b>금융감독원 조사</b> — 시세조종 혐의로 과징금 <b>${pay.toFixed(2)}억</b> · 계좌 ${FSS_BAN_D}일 동결`); }catch(e){}
    try{ notifyStk(`🚨 <b>금융감독원이 계좌를 들여다봤습니다.</b><br>과징금 <b>${pay.toFixed(2)}억</b> · ${FSS_BAN_D}일간 매수·공매도·신용거래 정지<br><span class="small">큰 주문으로 값을 반복해서 밀어 올린 기록이 남았습니다.</span>`,"warn"); }catch(e){}
    try{ meLog(`🚨 금감원 과징금 ${pay.toFixed(2)}억 — 시세조종 혐의`); }catch(e){}
    try{ addNews(jobless
        ? `🚨 <b>${nm}, 주가조작 혐의로 금감원 조사</b> — 과징금 ${pay.toFixed(2)}억`
        : `🚨 <b>${tn} ${nm} 감독, 주가조작 혐의로 금감원 조사</b> — 과징금 ${pay.toFixed(2)}억`, "warn", "stock",
      {cat:"stock", ic:"🚨", tone:-1, tid:((t&&!jobless)?t.id:null), src:"금융감독원",
       head:jobless?`${nm}, 시세조종 혐의 과징금 ${pay.toFixed(2)}억`:`${nm} 감독, 시세조종 혐의 과징금 ${pay.toFixed(2)}억`,
       sub:`특정 종목에 대량 주문을 반복해 시세에 영향을 준 정황이 확인됐다. 계좌는 ${FSS_BAN_D}일간 동결된다.`}); }catch(e){}
    if(!jobless){
      /* 감독직에도 흠집이 난다 — 도박 물의와 같은 무게 */
      try{ adjustTrust("owner", -10, "감독 주가조작 물의"); adjustTrust("fans", -6, "감독 주가조작 물의"); }catch(e){}
      try{ if(G.press) G.press.rel=clamp((G.press.rel||50)-10, 0, 100); }catch(e){}
      try{ G.mgrRepMod=(G.mgrRepMod||0)-3; }catch(e){}
      try{ socialFill(["감독이 주식으로 뭘 한 거야...","축구나 잘하시죠 진짜","이건 좀 실망이다"], 3+R(2), -1, {t:tn}); }catch(e){}
      try{ fmkFill([["{t} 감독 주가조작 ㄷㄷ 이거 커지겠는데",-1],
        ["감독이 시세조종이라니 ㅋㅋㅋ 소설이냐",-1],
        ["구단은 알고 있었냐 이거",-1]], 2+R(2), {t:tn}); }catch(e){}
    } else {
      /* 무직이라도 위신은 남는다 — 다음 부임 협상에서 이 기록이 따라온다 */
      try{ G.mgrRepMod=(G.mgrRepMod||0)-3; }catch(e){}
    }
  }catch(e){}
}
/* ── ⚠️ 관리종목 — 상장폐지 전에 반드시 경고가 나간다 ────────── */
function stkWatchTick(){
  const S=stkState(); if(!S) return;
  for(const s of S.list){
    if(s.dead) continue;
    const T=STK_TIER[s.tier]; if(!T.dl) continue;
    const low = s.tier==="penny" ? 140 : 700;
    const bad = s.p<low || (s.eps<0 && s.p < (s.hist[0]||s.p)*0.35);
    if(bad && !s.warn){
      s.warn=1;
      stkLog("warn", `⚠️ ${s.n} 관리종목 지정 — 상장폐지 사유 발생 시 정리매매에 들어갑니다`, s.id);
      stkPing(s, `⚠️ <b>${s.n}</b>이(가) 관리종목으로 지정됐습니다. 상장폐지 위험이 있습니다.`, "warn");
    } else if(!bad && s.warn && s.p>low*1.6){
      s.warn=0;
      stkLog("good", `${s.n}, 관리종목 지정 해제`, s.id);
    }
  }
}
/* ── ⚽ 구단 성적이 모기업 주가로 ─────────────────────────── */
function stkClubEffect(tid, kind, txt){
  const S=stkState(); if(!S) return;
  const s=S.list.find(x=>x.tid===tid && !x.dead); if(!s) return;
  const E={champ:0.085, acl:0.045, eaclWin:0.075, promo:0.060, po:-0.035, releg:-0.090, sack:-0.015}[kind];
  if(E==null) return;
  s.mom += E*0.55;
  const t=G.teams[tid];
  stkLog(E>=0?"good":"bad", txt || `${s.n}, 계열 구단 ${t?t.short:""} 성적에 주가 ${E>=0?"강세":"약세"}`, s.id);
}
/* 시즌이 끝나면 모기업들이 성적표를 받는다 */
function stkSeasonEffect(){
  try{
    const S=stkState(); if(!S) return;
    const k1=[...(G.k1||[])].map(id=>G.teams[id]).filter(Boolean)
      .sort((a,b)=>(b.Pts-a.Pts)||((b.GF-b.GA)-(a.GF-a.GA)));
    if(k1[0]) stkClubEffect(k1[0].id, "champ", `🏆 ${clubType(k1[0]).o}, 계열 구단 ${k1[0].short} 리그 우승 — 브랜드 가치 상승`);
    for(let i=1;i<3;i++) if(k1[i]) stkClubEffect(k1[i].id, "acl");
    const bottom=k1.slice(-2);
    for(const t of bottom) if(t) stkClubEffect(t.id, "releg", `📉 ${clubType(t).o}, 계열 구단 ${t.short} 강등권 추락 — 스폰서 이탈 우려`);
    if(G.eacl && G.eacl.champ && G.teams[G.eacl.champ])
      stkClubEffect(G.eacl.champ, "eaclWin", `🌏 ${clubType(G.teams[G.eacl.champ]).o}, 계열 구단 ${eaclShort()} 우승 — 아시아 시장 노출 확대`);
  }catch(e){}
}

/* ═══════════════════════════════════════════════════════════════════════════
   ⭐ 관심종목 · 📋 예약 주문 · 💳 신용거래 · 📜 거래 내역
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_MG_RATE=0.00022;   // 신용 이자 — 하루 0.022% (연 8%)
const STK_MG_MAX =2.0;       // 순자산의 몇 배까지 빌릴 수 있나
/* 🧱 ⚠ 감사 — <b>발행주식수보다 많이 살 수 있었다</b>(실측 발행량의 5배).
   유동성 충격 상한이 45%라 시가총액의 몇 배를 부어도 최대 45% 비싸게 사면 그만이었고,
   배당은 보유 수량에 그대로 비례해서 <b>배당 8회에 25조</b>가 들어왔다.
   ─ 개인이 한 종목을 얼마나 가질 수 있는지에 상한을 둔다(실제로도 5%면 대량보유 공시 대상이다). */
const STK_OWN_MAX=0.10;      // 한 종목 발행주식수의 10%까지
const STK_MG_CALL=1.40;      // 담보비율이 이 아래로 내려가면 반대매매
const STK_TX_MAX =200;       // 거래 내역 보관 건수

/* ── ⭐ 관심종목 ───────────────────────────────────────────── */
function stkFav(){ const M=me(); if(!Array.isArray(M.fav)) M.fav=[]; return M.fav; }
function stkIsFav(id){ return stkFav().indexOf(id)>=0; }
function stkToggleFav(id, ev){
  try{ if(ev&&ev.stopPropagation) ev.stopPropagation(); }catch(e){}
  const F=stkFav(), i=F.indexOf(id);
  if(i>=0) F.splice(i,1); else F.push(id);
  saveGame(); show("mylife");
}
/* ── 📅 기간 계산 ──────────────────────────────────────────
   달력은 시즌마다 0으로 되감기므로, 「며칠 전인가」는 시즌 차이까지 넣어야 한다. */
function stkDaysAgo(x){
  try{
    const ds=(G.season-((x&&x.s!=null)?x.s:G.season))*365;
    return Math.max(0, ds + ((G.day||0) - ((x&&x.d!=null)?x.d:0)));
  }catch(e){ return 0; }
}
function stkHoldDays(h){
  if(!h || h.since==null) return null;
  return Math.max(0, (G.season-(h.sinceS!=null?h.sinceS:G.season))*365 + ((G.day||0)-h.since));
}
/* 기간별 실현손익 — 그 기간 안에 「팔아서 확정한」 손익의 합 */
const STK_PERIODS=[[90,"3개월"],[180,"6개월"],[365,"1년"],[1825,"5년"],[0,"전체"]];
function stkRealIn(days){
  let sum=0, n=0, win=0;
  for(const x of stkTx()){
    if(x.real==null) continue;
    if(days>0 && stkDaysAgo(x)>days) continue;
    sum+=x.real; n++; if(x.real>0) win++;
  }
  return {sum, n, win};
}
/* ── 📜 거래 내역 ─────────────────────────────────────────── */
function stkTx(){ const M=me(); if(!Array.isArray(M.tx)) M.tx=[]; return M.tx; }
function stkTxAdd(o){
  const T=stkTx();
  T.unshift(Object.assign({d:G.day||0, s:G.season}, o));
  if(T.length>STK_TX_MAX) T.length=STK_TX_MAX;
}
/* ── 💳 신용거래 ───────────────────────────────────────────── */
/* 💰 ⚠ 감사 — 현금이 <b>1만원 단위로 반올림</b>되고 있었다(억 단위 소수점 4자리).
   그래서 한 번에 5,000원 미만인 거래는 <b>비용이 통째로 사라졌다</b> —
   실측: 191원짜리를 20주씩 300번 사도 현금 100억 그대로에 주식 6,000주가 공짜로 생겼다.
   ─ 증권 계좌의 돈은 <b>1원 단위</b>로 다룬다. */
function stkCash(won){
  const M=me();
  M.cash=Math.round((M.cash + won/1e8)*1e8)/1e8;
  return M.cash;
}
/* 📊 증권 계좌의 «순자산» — 공매도 대금은 이미 현금에 들어와 있으므로 되사는 값을 빼야 한다.
   ⚠ 감사 — 예전에는 여기에 stkShortPL(=(평단−현재가)×수량)을 «더했다».
      현금에는 이미 매도 대금이 들어 있는데 부채를 평가손익으로만 반영하니
      <b>공매도 대금이 통째로 이중 계산</b>됐다. 실측: 공매도 한 번에 신용대출 한도 200억 → 285억.
      그 한도로 또 공매도를 하면 레버리지가 끝없이 불어난다. */
function stkEquity(){
  const M=me();
  let v=M.cash*1e8;
  try{ v+=stkEval(); }catch(e){}
  try{ v-=stkShortVal(); }catch(e){}
  return v;
}
/* ═══════════════════════════════════════════════════════════════════════════
   🧾 세금 · 규제 — 「너무 많이 벌었을 때」를 실제로 있는 장치들로 되돌린다.
   ⚠ 예전에는 금융자산 100조가 넘으면 국세청이 현금을 그냥 가져갔다. 그 밑에서는 아무 제동이
      없다가 갑자기 벽을 만나는 구조라, 게임이 손을 뻗어 뺏는 느낌이 났다.
   ─ 네 층으로 나눈다. 작게 굴리면 하나도 안 걸리고, 커질수록 차례로 물린다.
       ① 대주주 양도소득세 — 팔 때 실현이익에 과세 (지분 1% 또는 10억 이상)
       ② 금융소득 종합과세 — 배당이 연 2천만원을 넘으면 세율이 뛴다
       ③ 5% 대량보유 공시 — 공시된 뒤로는 시장이 내 매매를 앞질러 간다
       ④ 금감원 시세조종 조사 — 값을 반복해서 밀어 올리면 사건이 된다
     ⑤(자금출처 세무조사)는 기존 국세청(ntsTick) 자리를 그대로 물려받는다. */
const TAX_MAJOR_R=0.01;      // 지분 1% 이상이면 대주주
const TAX_MAJOR_V=10e8;      // 또는 한 종목 10억 이상
const TAX_CG_B1=3e8,   TAX_CG_R1=0.22;    // 양도차익 3억 이하 22%
const TAX_CG_B2=1000e8, TAX_CG_R2=0.275;  // 3억~1,000억 27.5%
const TAX_CG_R3=0.385;                    // 1,000억 초과 38.5% (최고구간)
const TAX_DIV_BASE=0.154;    // 배당소득세 15.4%
const TAX_DIV_LINE=0.2e8;    // 금융소득 종합과세 기준 — 연 2천만원
const TAX_DIV_TOP=0.495;     // 초과분 종합과세 최고세율 49.5%
const STK_DISCL_R=0.05;      // 5% 이상이면 대량보유 공시 대상
const STK_DISCL_K=1.9;       // 공시된 종목의 시장충격 배수 — 시장이 내 매매를 앞질러 간다
function taxState(){
  if(!G.tax) G.tax={s:G.season, cg:0, div:0, divY:0, paid:0};
  if(G.tax.s!==G.season){ G.tax={s:G.season, cg:0, div:0, divY:0, paid:0}; }   // 해가 바뀌면 초기화
  return G.tax;
}
/* 대주주인가 — 파는 시점의 지분·평가액으로 본다 */
function taxIsMajor(s, q){
  if(!s||!(q>0)) return false;
  return ((s.sh>0) && q/s.sh>=TAX_MAJOR_R) || (q*s.p>=TAX_MAJOR_V);
}
/* 양도소득세 — 실현이익(원)에 매기는 누진세. 소액주주는 0 */
function taxCapGain(s, q, realWon){
  if(!(realWon>0) || !taxIsMajor(s, q)) return 0;
  let t=0, r=realWon;
  const b1=Math.min(r, TAX_CG_B1); t+=b1*TAX_CG_R1; r-=b1;
  if(r>0){ const b2=Math.min(r, TAX_CG_B2-TAX_CG_B1); t+=b2*TAX_CG_R2; r-=b2; }
  if(r>0) t+=r*TAX_CG_R3;
  return Math.round(t);
}
/* 실제로 떼고 기록한다 — 매도·숏커버·반대매매 모든 실현 경로가 이 함수 하나를 부른다 */
function taxOnRealize(s, q, realWon, why){
  const t=taxCapGain(s, q, realWon);
  if(t<=0) return 0;
  stkCash(-t);
  const T=taxState(); T.cg=Math.round(T.cg+t); T.paid=Math.round(T.paid+t);
  try{ stkLog("tax", `🧾 <b>${s.n}</b> 양도소득세 <b>${stkMoney(t)}</b> 원천징수 — 실현이익 ${stkMoney(realWon)} (대주주 과세${why?" · "+why:""})`, s.id); }catch(e){}
  try{ meLog(`🧾 양도소득세 ${(t/1e8).toFixed(2)}억 (${s.n})`); }catch(e){}
  return t;
}
/* 배당소득세 — 연 누계가 종합과세 기준을 넘으면 초과분 세율이 뛴다 */
function taxOnDividend(grossWon){
  const T=taxState();
  const before=T.divY||0, after=before+grossWon;
  const lowPart=Math.max(0, Math.min(after, TAX_DIV_LINE)-Math.min(before, TAX_DIV_LINE));
  const topPart=Math.max(0, after-Math.max(before, TAX_DIV_LINE));
  const t=Math.round(lowPart*TAX_DIV_BASE + topPart*TAX_DIV_TOP);
  T.divY=after; T.div=Math.round((T.div||0)+t); T.paid=Math.round(T.paid+t);
  return t;
}
/* 📢 5% 대량보유 공시 — 넘어서는 순간 한 번 알리고, 그 뒤로는 체결이 계속 불리해진다 */
function stkDisclosed(s){
  if(!s||!(s.sh>0)) return false;
  const q=(((me().stkInv)||{})[s.id]||{q:0}).q||0;
  return q/s.sh>=STK_DISCL_R;
}
function stkDisclCheck(s){
  try{
    const M=me(); if(!M._discl) M._discl={};
    const now=stkDisclosed(s);
    if(now && !M._discl[s.id]){
      M._discl[s.id]=1;
      const q=((M.stkInv||{})[s.id]||{q:0}).q||0;
      const pct=(q/s.sh*100).toFixed(1);
      stkLog("discl", `📢 <b>${s.n}</b> 대량보유 공시 — 지분 <b>${pct}%</b> 보유 사실이 공시되었습니다. 이제 시장이 당신의 매매를 지켜봅니다.`, s.id);
      try{ notifyStk(`📢 <b>${s.n}</b> 지분 ${pct}% — <b>대량보유 공시</b> 대상이 되었습니다.<br><span class="small">공시된 종목은 추종 매매가 붙어 체결가가 계속 불리해집니다.</span>`,"warn"); }catch(e){}
      try{ const _t=userTeam(), _jb=!!(G&&G.jobless);
        const _nm=(!_jb&&_t&&typeof mgrName==="function")?(mgrName(_t)||"감독"):"전 감독";
        addNews(`📢 <b>${_nm}</b>, ${s.n} 지분 ${pct}% 대량보유 공시`, null, "stock", {cat:"stock", ic:"📢", src:"금융감독원", tid:null}); }catch(e){}
    } else if(!now && M._discl[s.id]) delete M._discl[s.id];
  }catch(e){}
}
/* 🚨 금감원 — 큰 주문이 값을 밀어 올릴 때마다 「열기」가 쌓인다 (도박 발각과 같은 문법) */
function fssState(){ if(!G.fss) G.fss={heat:0, n:0, fine:0, ban:0}; return G.fss; }
function fssFrozen(){ const F=fssState(); return (F.ban||0) > (G.day||0) || (F.banS||0) > (G.season||0); }
function fssHeat(s, imp, amountWon){
  try{
    if(!(imp>0.02)) return;
    const F=fssState();
    F.heat=Math.min(100, (F.heat||0) + imp*22 + Math.min(6, amountWon/1e12));
  }catch(e){}
}
function stkLoan(){ const M=me(); return Math.max(0, M.stkLoan||0); }        // 대출 잔액(원)
/* 증권 계좌 안에서의 순자산 — 신용융자 한도 계산에만 쓴다 */
function stkNet(){ return stkEquity()
                        + (typeof stkFutEquity==="function"?stkFutEquity():0)
                        - stkLoan() - (typeof stkDebt==="function"?stkDebt():0); }
/* ⚠ 감독의 「진짜」 순자산 — 부동산·은행 예금·모든 부채까지 합친다.
   제보 검토 중 발견: 파산 판정이 증권 계좌만 보고 있어서, 부동산 120억과 예금 50억을 갖고도
   사채 50억 때문에 파산했다. 갚을 자산이 있으면 파산이 아니다. */
function netWorth(){
  const M=me();
  let v=M.cash*1e8;
  try{ v+=stkEval(); }catch(e){}
  try{ v-=stkShortVal(); }catch(e){}      /* ⚠ 공매도 대금은 이미 현금에 있다 — 되사는 값을 뺀다 */
  try{ v+=stkFutEquity(); }catch(e){}
  try{ v+=propTotal()*1e8; }catch(e){}
  try{ v+=bankDepTotal()*1e8; }catch(e){}
  try{ if(M.homeOwn) v+=homePrice(homeOf())*1e8; }catch(e){}
  try{ v-=stkLoan(); }catch(e){}
  try{ v-=stkDebt(); }catch(e){}
  try{ v-=hmlLoan()*1e8; }catch(e){}
  try{ v-=propLoan()*1e8; }catch(e){}
  try{ v-=bankLoanTotal()*1e8; }catch(e){}
  return Math.round(v);
}
/* 총부채 */
function debtTotal(){
  let v=0;
  /* ⚠ 미납 위약금·징계금이 부채 목록에서 빠져 있었다 — 순자산이 실제보다 많아 보인다 */
  try{ v+=Math.max(0, (me().debt||0))*1e8; }catch(e){}
  try{ v+=stkLoan(); }catch(e){}
  try{ v+=stkDebt(); }catch(e){}
  try{ v+=hmlLoan()*1e8; }catch(e){}
  try{ v+=propLoan()*1e8; }catch(e){}
  try{ v+=bankLoanTotal()*1e8; }catch(e){}
  return Math.round(v);
}
function stkLoanMax(){ return Math.max(0, stkNet()*STK_MG_MAX - stkLoan()); }// 추가로 빌릴 수 있는 금액
function stkRatio(){                                                          // 담보비율
  const L=stkLoan(); if(L<=0) return null;
  return stkEquity()/L;                    /* ⚠ 공매도 부채를 뺀 순자산으로 본다 */
}
function stkBorrow(amtWon){
  const M=me();
  if(fssFrozen()){ flash("🚨 금융감독원 조사로 신용거래가 정지되었습니다.","warn"); return; }
  if(stkBadCredit()){ flash(`파산 이력으로 신용거래가 막혀 있습니다 — ${stkBadCreditLeft()}시즌 남음.`,"warn"); return; }
  const a=Math.max(0, Math.round(amtWon||0));
  if(a<=0){ flash("금액을 입력하세요.","warn"); return; }
  if(a>stkLoanMax()){ flash(`한도를 넘습니다 — 최대 ${stkMoney(stkLoanMax())}까지 가능합니다.`,"warn"); return; }
  M.stkLoan=stkLoan()+a;
  stkCash(a);
  stkTxAdd({k:"borrow", amt:a});
  try{ meLog(`💳 신용융자 ${(a/1e8).toFixed(2)}억 인출 (잔액 ${(M.stkLoan/1e8).toFixed(2)}억)`); }catch(e){}
  saveGame(); show("mylife");
}
function stkRepay(amtWon){
  const M=me();
  const a=Math.min(stkLoan(), Math.max(0, Math.round(amtWon||0)));
  if(a<=0){ flash("상환할 금액이 없습니다.","warn"); return; }
  if(a > M.cash*1e8){ flash(`현금이 부족합니다 (보유 ${moneyEok(M.cash)}).`,"warn"); return; }
  M.stkLoan=stkLoan()-a;
  stkCash(-a);
  stkTxAdd({k:"repay", amt:a});
  try{ meLog(`💳 신용융자 ${(a/1e8).toFixed(2)}억 상환 (잔액 ${(M.stkLoan/1e8).toFixed(2)}억)`); }catch(e){}
  saveGame(); show("mylife");
}
/* 매일 이자가 붙고, 담보비율이 무너지면 반대매매가 나간다 */
function stkMarginTick(){
  const M=me();
  const L=stkLoan(); if(L<=0) return;
  const it=Math.round(L*STK_MG_RATE);
  M.stkLoan=L+it;
  M.stkInt=Math.round(((M.stkInt||0)+it/1e8)*1e4)/1e4;
  const r=stkRatio();
  if(r!=null && r<STK_MG_CALL){
    /* 🔨 반대매매 — 평가액이 큰 종목부터, 담보비율이 회복될 때까지 계속 판다.
       ⚠ 한 번만 훑고 끝내면 자산이 부채보다 적은 상태(깡통)에서 절반만 팔고 멈춘다.
          팔 때마다 대출이 줄어 비율이 다시 계산되므로, 매번 처음부터 다시 본다. */
    let sold=0, names=[], guard=0;
    while(guard++<60){
      const r2=stkRatio();
      if(r2==null || r2>=STK_MG_CALL+0.15) break;
      const held=stkHeld().filter(x=>!x.s.dead && x.q>0);
      if(!held.length) break;
      const h=held[0], s=h.s;
      const need=Math.ceil(((STK_MG_CALL+0.15)*stkLoan() - (me().cash*1e8+stkEval()))/Math.max(1,s.p));
      /* 한 번에 그 종목의 40%씩 — 통째로 던지면 남길 수 있는 종목까지 사라진다 */
      const q=Math.min(h.q, Math.max(1, Math.min(need, Math.ceil(h.q*0.4))));
      const net=q*s.p*(1-STK_FEE-STK_TAX);
      const real=(s.p-h.avg)*q;
      stkCash(net);
      const _hq=(M.stkInv[s.id]||{q:0}).q;
      M.stkReal=Math.round(((M.stkReal||0)+real/1e8)*1e4)/1e4;
      const hh=M.stkInv[s.id]; hh.q-=q; if(hh.q<=0) delete M.stkInv[s.id];
      try{ taxOnRealize(s, _hq, real, "반대매매"); }catch(e){}
      stkTxAdd({k:"call", sid:s.id, n:s.n, q, px:s.p, amt:net, real});
      sold+=net; if(names.indexOf(s.n)<0) names.push(s.n);
      /* 판 돈으로 곧바로 빚을 갚는다 */
      const pay=Math.min(stkLoan(), Math.round(net));
      M.stkLoan=stkLoan()-pay; stkCash(-pay);
    }
    if(sold>0){
      stkLog("call", `🔨 담보비율 부족으로 반대매매 — ${names.slice(0,3).join(", ")}${names.length>3?` 외 ${names.length-3}종목`:""} 강제 매도 (${stkMoney(sold)})`);
      try{ notifyStk(`🔨 <b>반대매매</b>가 실행되었습니다 — 담보비율 ${Math.round(r*100)}%. ${names.slice(0,2).join(", ")} 등 ${stkMoney(sold)}어치가 강제 매도됐습니다.`,"warn"); }catch(e){}
      try{ meLog(`🔨 반대매매 ${(sold/1e8).toFixed(2)}억 — 담보비율 ${Math.round(r*100)}%`); }catch(e){}
    }
  } else if(r!=null && r<STK_MG_CALL+0.25 && !M._mgWarn){
    M._mgWarn=1;
    try{ notifyStk(`⚠️ 담보비율 <b>${Math.round(r*100)}%</b> — ${Math.round(STK_MG_CALL*100)}% 아래로 내려가면 반대매매가 나갑니다. 상환하거나 정리하세요.`,"warn"); }catch(e){}
  } else if(r!=null && r>=STK_MG_CALL+0.4){ M._mgWarn=0; }
}
/* ── 📋 예약 주문 ─────────────────────────────────────────── */
function stkOrders(){ const S=stkState(); if(!S) return []; if(!Array.isArray(S.orders)) S.orders=[]; return S.orders; }
function stkOrderAdd(sid, kind, px, q, days){
  const S=stkState(); if(!S) return false;
  const s=stkById(sid); if(!s||s.dead) return false;
  const O=stkOrders();
  if(O.length>=20){ flash("예약 주문은 20건까지 걸 수 있습니다.","warn"); return false; }
  O.push({id:(S.oid=(S.oid||0)+1), sid, k:kind, px:Math.round(px), q:Math.round(q),
          exp:(G.day||0)+Math.max(1, days||30), d:G.day||0});
  saveGame();
  return true;
}
function stkOrderDel(id){
  const O=stkOrders(); const i=O.findIndex(x=>x.id===id);
  if(i>=0) O.splice(i,1);
  saveGame(); show("mylife");
}
/* 하루가 지나면 그날의 고가·저가 안에서 체결 여부를 본다 */
function stkOrderTick(){
  const S=stkState(); if(!S) return;
  const O=stkOrders(); if(!O.length) return;
  const M=me();
  for(let i=O.length-1;i>=0;i--){
    const o=O[i];
    const s=stkById(o.sid);
    if(!s || s.dead){ O.splice(i,1); continue; }
    if((G.day||0) > o.exp){
      O.splice(i,1);
      stkLog("order", `📋 ${s.n} ${o.k==="buy"?"매수":"매도"} 예약 주문이 기간 만료로 취소되었습니다`, s.id);
      continue;
    }
    /* 매수는 저가가 지정가 아래로 내려오면, 매도는 고가가 지정가 위로 올라가면 체결된다 */
    const hit = o.k==="buy" ? (s.lo<=o.px) : (s.hi>=o.px);
    if(!hit) continue;
    let px=o.k==="buy" ? Math.min(o.px, s.o||o.px) : Math.max(o.px, s.o||o.px);
    /* 💥 예약이라고 충격을 피해 갈 수는 없다 — 같은 호가창이다 */
    { const _side=o.k==="buy"?1:-1;
      const _imp=stkImpact(s, o.q*px);
      px=Math.max(1, Math.round(px*(1+_side*_imp)));
      stkPushMom(s, _side, _imp); }
    if(o.k==="buy"){
      const cost=o.q*px*(1+STK_FEE);
      if(cost > M.cash*1e8){
        O.splice(i,1);
        stkLog("order", `📋 ${s.n} 매수 예약이 <b>현금 부족</b>으로 취소되었습니다 (필요 ${stkMoney(cost)})`, s.id);
        try{ notifyStk(`📋 <b>${s.n}</b> 매수 예약이 현금 부족으로 취소됐습니다.`,"warn"); }catch(e){}
        continue;
      }
      { const own=((M.stkInv&&M.stkInv[s.id])||{q:0}).q||0;
        const cap=Math.floor((s.sh||0)*STK_OWN_MAX);
        if(cap>0 && own+o.q>cap){
          O.splice(i,1);
          stkLog("order", `📋 ${s.n} 매수 예약이 <b>보유 한도</b>로 취소되었습니다 (발행주식수의 ${Math.round(STK_OWN_MAX*100)}%)`, s.id);
          continue; } }
      stkCash(-cost);
      if(!M.stkInv) M.stkInv={};
      const h=M.stkInv[s.id]||{q:0, avg:0};
      h.avg=Math.round((h.avg*h.q + px*o.q)/(h.q+o.q)); h.q+=o.q;
      M.stkInv[s.id]=h;
      M.spent=Math.round((M.spent+cost/1e8)*100)/100;
      stkTxAdd({k:"buy", sid:s.id, n:s.n, q:o.q, px, amt:cost, auto:1});
      stkLog("order", `📋 ${s.n} ${o.q.toLocaleString()}주 <b>예약 매수 체결</b> — ${stkWon(px)}원 (${stkMoney(cost)})`, s.id);
      try{ notifyStk(`📋 <b>${s.n}</b> 예약 매수 체결 — ${o.q.toLocaleString()}주 @${stkWon(px)}원`,"good"); }catch(e){}
    } else {
      const h=(M.stkInv&&M.stkInv[s.id])||null;
      if(!h || h.q<=0){ O.splice(i,1); continue; }
      const q=Math.min(o.q, h.q);
      const net=q*px*(1-STK_FEE-STK_TAX);
      const real=(px-h.avg)*q;
      const _hq3=h.q;
      stkCash(net);
      M.earned=Math.round((M.earned+net/1e8)*100)/100;
      M.stkReal=Math.round(((M.stkReal||0)+real/1e8)*1e4)/1e4;
      h.q-=q; if(h.q<=0) delete M.stkInv[s.id];
      try{ taxOnRealize(s, _hq3, real, "예약 매도"); stkDisclCheck(s); }catch(e){}
      stkTxAdd({k:"sell", sid:s.id, n:s.n, q, px, amt:net, real, auto:1});
      stkLog("order", `📋 ${s.n} ${q.toLocaleString()}주 <b>예약 매도 체결</b> — ${stkWon(px)}원 (실현 ${real>=0?"+":""}${(real/1e8).toFixed(2)}억)`, s.id);
      try{ notifyStk(`📋 <b>${s.n}</b> 예약 매도 체결 — ${q.toLocaleString()}주 @${stkWon(px)}원 · 실현 ${real>=0?"+":""}${(real/1e8).toFixed(2)}억`, real>=0?"good":"warn"); }catch(e){}
    }
    O.splice(i,1);
  }
}
/* ── 📊 성과 분석 ─────────────────────────────────────────── */
function stkStats(){
  const T=stkTx().filter(x=>x.k==="buy"||x.k==="sell"||x.k==="call");
  const sells=T.filter(x=>x.k!=="buy");
  const win=sells.filter(x=>(x.real||0)>0).length;
  const lose=sells.filter(x=>(x.real||0)<0).length;
  const best=sells.slice().sort((a,b)=>(b.real||0)-(a.real||0))[0];
  const worst=sells.slice().sort((a,b)=>(a.real||0)-(b.real||0))[0];
  /* 종목별 누적 실현손익 */
  const by={};
  for(const x of sells){ if(!x.n) continue; by[x.n]=(by[x.n]||0)+(x.real||0); }
  const rank=Object.keys(by).map(n=>({n, v:by[n]})).sort((a,b)=>b.v-a.v);
  /* 업종 분산 */
  const held=stkHeld(), ev=stkEval();
  const sec={};
  for(const h of held){ const k=h.s.sec; sec[k]=(sec[k]||0)+h.q*h.s.p; }
  const secArr=Object.keys(sec).map(k=>({k, v:sec[k], p: ev>0?sec[k]/ev*100:0})).sort((a,b)=>b.v-a.v);
  return {n:T.length, sells:sells.length, win, lose,
          winPct: sells.length ? win/sells.length*100 : 0,
          best, worst, rank, secArr, ev};
}

/* ═══════════════════════════════════════════════════════════════════════════
   📈 차트 — 캔들 · 이동평균 · 거래량
   일봉(o/h/l/c/v)을 따로 쌓는다. 종가만으로는 캔들을 그릴 수 없다.
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_OHLC=120;                     // 일봉 보관 일수
let STK_RANGE=60;                       // 차트에 보여줄 기간
let STK_CANDLE=true;                    // 캔들 / 라인
let STK_MA=true;                        // 이동평균선
function stkSetRange(n){ STK_RANGE=n; show("mylife"); }
function stkToggleCandle(){ STK_CANDLE=!STK_CANDLE; show("mylife"); }
function stkToggleMA(){ STK_MA=!STK_MA; show("mylife"); }
function stkMA(A, n, i){
  if(i<n-1) return null;
  let s=0; for(let k=i-n+1;k<=i;k++) s+=A[k];
  return s/n;
}
/* 본 차트 */
function stkChart2(s){
  const raw=(s.ohlc||[]);
  if(raw.length<3) return stkChart(s);            // 아직 일봉이 안 쌓였으면 종가 라인으로
  const D=raw.slice(-STK_RANGE);
  const closes=D.map(x=>x[3]);
  /* 이동평균은 잘라내기 전 데이터까지 봐야 앞부분이 끊기지 않는다 */
  const all=raw.map(x=>x[3]);
  const off=all.length-D.length;
  const lo=Math.min(...D.map(x=>x[2])), hi=Math.max(...D.map(x=>x[1]));
  const sp=Math.max(1, hi-lo);
  const W=560, H=190, VH=44, pad=6, gap=2;
  const cw=Math.max(1.6, (W-pad*2)/D.length - gap);
  const x=(i)=>pad + i*((W-pad*2)/D.length) + cw/2;
  const y=(v)=>pad + (1-(v-lo)/sp)*(H-pad*2);
  const vmax=Math.max(1, ...D.map(x=>x[4]||0));
  const vy=(v)=>VH - (v/vmax)*(VH-4);
  const UP="#f85149", DN="#58a6ff";
  let bars="", vols="";
  D.forEach((d,i)=>{
    const [o,h,l,c]=d, up=c>=o, col=up?UP:DN;
    const xc=x(i);
    bars+=`<line x1="${xc.toFixed(1)}" y1="${y(h).toFixed(1)}" x2="${xc.toFixed(1)}" y2="${y(l).toFixed(1)}" stroke="${col}" stroke-width="1"/>`;
    const yt=y(Math.max(o,c)), yb=y(Math.min(o,c));
    bars+=`<rect x="${(xc-cw/2).toFixed(1)}" y="${yt.toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(1,yb-yt).toFixed(1)}"
      fill="${up?col:col}" opacity="${up?0.95:0.85}"/>`;
    vols+=`<rect x="${(xc-cw/2).toFixed(1)}" y="${vy(d[4]||0).toFixed(1)}" width="${cw.toFixed(1)}" height="${(VH-vy(d[4]||0)).toFixed(1)}" fill="${col}" opacity=".45"/>`;
  });
  /* 이동평균선 */
  let mas="";
  if(STK_MA){
    for(const [n,col] of [[5,"#e3b341"],[20,"#7ee2a8"],[60,"#a78bfa"]]){
      if(all.length<n) continue;
      let d="", started=false;
      D.forEach((_,i)=>{
        const v=stkMA(all, n, off+i);
        if(v==null) return;
        d+=`${started?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; started=true;
      });
      if(d) mas+=`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.3" opacity=".9"/>`;
    }
  }
  /* 라인 모드 */
  let line="";
  if(!STK_CANDLE){
    bars="";
    const d=closes.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const col=closes[closes.length-1]>=closes[0]?UP:DN;
    line=`<path d="${d} L${x(D.length-1).toFixed(1)},${H-pad} L${x(0).toFixed(1)},${H-pad} Z" fill="${col}" opacity=".12"/>
          <path d="${d}" fill="none" stroke="${col}" stroke-width="1.8"/>`;
  }
  /* 가로 눈금 */
  let grid="";
  for(let i=0;i<=3;i++){
    const v=lo+sp*i/3, yy=y(v);
    grid+=`<line x1="${pad}" y1="${yy.toFixed(1)}" x2="${W-pad}" y2="${yy.toFixed(1)}" stroke="#21262d" stroke-width="1"/>
           <text x="${W-pad-2}" y="${(yy-2).toFixed(1)}" fill="#6b7480" font-size="9" text-anchor="end">${stkWon(v)}</text>`;
  }
  const first=D[0][3], last=D[D.length-1][3];
  const chg=(last-first)/first*100;
  const rb=(n,l)=>`<button class="mini ${STK_RANGE===n?"sel":""}" style="padding:3px 8px;font-size:11px" onclick="stkSetRange(${n})">${l}</button>`;
  return `<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
      ${rb(7,"1주")}${rb(20,"1개월")}${rb(60,"3개월")}${rb(120,"전체")}
      <button class="mini ${STK_CANDLE?"sel":""}" style="padding:3px 8px;font-size:11px" onclick="stkToggleCandle()">${STK_CANDLE?"📊 캔들":"📈 라인"}</button>
      <button class="mini ${STK_MA?"sel":""}" style="padding:3px 8px;font-size:11px" onclick="stkToggleMA()">이평선</button>
      <span class="small" style="margin-left:auto;color:${chg>=0?"#f85149":"#58a6ff"}">${D.length}일 ${chg>=0?"+":""}${chg.toFixed(1)}%</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${grid}${line}${bars}${mas}</svg>
    <svg viewBox="0 0 ${W} ${VH}" style="width:100%;height:${VH}px;display:block;margin-top:-2px">${vols}</svg>
    <div class="small" style="display:flex;gap:10px;color:var(--sub);margin-top:2px;flex-wrap:wrap">
      <span>거래량</span>
      ${STK_MA?'<span style="color:#e3b341">— 5일</span><span style="color:#7ee2a8">— 20일</span><span style="color:#a78bfa">— 60일</span>':""}
      <span style="margin-left:auto">${stkWon(lo)} ~ ${stkWon(hi)}원</span>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   🕵️ 찌라시 — 확인되지 않은 이야기
   공시는 사실이지만 찌라시는 아니다. 맞으면 크게 먹고, 틀리면 그대로 물린다.
   출처에 따라 적중률이 다르고, 적중률이 낮은 이야기일수록 맞았을 때 크게 움직인다.
   ⚠ 찌라시가 도는 순간 주가는 이미 조금 반응한다(선반영). 불발이면 그만큼 되돌린다.
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_SRC={
  report:{n:"증권사 리포트", ic:"🏛️", rel:0.66, pre:0.55, pow:0.9,  w:22},
  desk  :{n:"여의도 지라시", ic:"📄", rel:0.46, pre:0.40, pow:1.25, w:30},
  room  :{n:"종목 카톡방",   ic:"💬", rel:0.30, pre:0.30, pow:1.5,  w:28},
  anon  :{n:"익명 제보",     ic:"🕶️", rel:0.24, pre:0.22, pow:1.9,  w:14},
  inside:{n:"내부자 이야기", ic:"🤫", rel:0.76, pow:2.2,  pre:0.30, w:6}
};
const STK_TIP_UP=[
  "{n}, 대형 수주 계약 임박했다는 이야기가 돈다",
  "{n} 실적이 시장 예상을 크게 웃돌 것이라는 말이 있다",
  "{n}에 기관 자금이 대거 들어온다는 소문",
  "{n}, 신사업 발표를 준비 중이라는 이야기",
  "{n} 대주주가 지분을 늘리고 있다는 말이 나온다",
  "{n}, 해외 대기업과 협력 논의 중이라는 소문",
  "{n}에 세력이 붙었다는 이야기가 돈다",
  "{n} 무상증자 검토설 — 관련주 동반 강세 전망"
];
const STK_TIP_DN=[
  "{n}, 주력 사업에서 대규모 손실이 났다는 이야기",
  "{n} 회계 문제로 감독당국이 들여다보고 있다는 말",
  "{n}, 대주주 지분 매각 준비 중이라는 소문",
  "{n} 핵심 인력이 대거 이탈했다는 이야기가 돈다",
  "{n}, 유상증자를 준비 중이라는 말이 나온다",
  "{n} 주요 거래처가 계약을 끊었다는 소문",
  "{n}, 실적이 예상보다 크게 나쁠 것이라는 이야기",
  "{n}에 물린 세력이 물량을 던진다는 말"
];
function stkTips(){ const S=stkState(); if(!S) return []; if(!Array.isArray(S.tips)) S.tips=[]; return S.tips; }
/* 감독의 평판이 높을수록 「쓸 만한」 이야기가 들어온다 */
function stkTipQuality(){
  let q=0;
  try{ q=clamp(((typeof mgrRep==="function"?mgrRep():50)-50)/120, -0.10, 0.18); }catch(e){}
  return q;
}
function stkTipPick(){
  const keys=Object.keys(STK_SRC);
  let tot=0; for(const k of keys) tot+=STK_SRC[k].w;
  /* 평판이 높으면 신뢰도 높은 출처가 더 자주 걸린다 */
  const bias=stkTipQuality()*4;
  let r=Math.random()*tot;
  for(const k of keys){
    const w=STK_SRC[k].w*(1+ (STK_SRC[k].rel-0.45)*bias );
    r-=w; if(r<=0) return k;
  }
  return "desk";
}
/* 매일 — 찌라시가 새로 돌고, 기한이 된 이야기는 결말이 난다 */
function stkTipTick(){
  const S=stkState(); if(!S) return;
  const T=stkTips();
  const live=S.list.filter(s=>!s.dead);
  if(!live.length) return;
  /* ① 새 찌라시 — 5일에 두 번쯤 */
  if(Math.random()<0.34 && T.filter(x=>!x.res).length<6){
    const s=pick(live);
    const src=stkTipPick(), SRC=STK_SRC[src];
    const up=Math.random()<0.56;
    /* 판정일 — 이야기가 사실인지 드러나기까지 3~12일 */
    const wait=3+Math.floor(Math.random()*10);
    const txt=pick(up?STK_TIP_UP:STK_TIP_DN).replace("{n}", s.n);
    const _rel=Math.round(clamp(SRC.rel+stkTipQuality()*0.5+(Math.random()*0.14-0.07),0.10,0.92)*100);
    /* ⚠ 표시 신뢰도는 「소문을 옮기는 쪽의 자신감」일 뿐이다 — 실제로 맞을 확률과 다르다.
       예전에는 이 값이 그대로 적중 확률이라, 60% 이상만 골라 타면 승률이 보장됐다(실측 100%).
       찌라시가 찌라시인 이유는 믿을 수 없다는 데 있다. */
    const _tp=clamp(_rel/100*0.62 + 0.10 + (Math.random()*0.34-0.17), 0.06, 0.72);
    T.unshift({id:(S.tid=(S.tid||0)+1), sid:s.id, n:s.n, k:up?"up":"down", src,
               d:G.day||0, due:(G.day||0)+wait, res:null,
               rel:_rel, tp:Math.round(_tp*1000)/1000,
               p0:s.p,               // 소문이 돌기 시작한 날의 값 — 낭설이면 여기까지 되돌리는 기준
               txt});
    if(T.length>40) T.length=40;
    /* 🫧 선반영 — 이야기가 도는 것만으로 값이 움직인다 */
    const k=clamp(STK_TIER[s.tier].vol/0.025, 0.6, 2.4);
    s.mom += (up?1:-1)*SRC.pre*0.020*k;
    try{
      const M=me();
      if(M.stkInv && M.stkInv[s.id] && M.stkInv[s.id].q>0)
        notifyStk(`${SRC.ic} <b>${s.n}</b> 관련 이야기가 돕니다 — ${SRC.n} · 신뢰도 ${T[0].rel}%`, up?"info":"warn");
    }catch(e){}
  }
  /* ② 결말 */
  const day=G.day||0;
  for(const t of T){
    if(t.res || day < t.due) continue;
    const s=stkById(t.sid);
    if(!s || s.dead){ t.res="void"; continue; }
    const SRC=STK_SRC[t.src]||STK_SRC.desk;
    const hit=Math.random() < (t.tp!=null ? t.tp : clamp(t.rel/100*0.62+0.10, 0.06, 0.72));
    const k=clamp(STK_TIER[s.tier].vol/0.025, 0.6, 2.4);
    if(hit){
      t.res="hit";
      /* 적중 — 신뢰도가 낮았던 이야기일수록 크게 튄다(아무도 안 믿었으니 선반영이 적다) */
      const eff=(0.028+Math.random()*0.048)*SRC.pow*k;
      s.mom += (t.k==="up"?1:-1)*eff;
      stkLog(t.k==="up"?"tipHit":"tipHitD", `🎯 <b>[적중]</b> ${t.txt} — 사실로 확인됐습니다`, s.id);
      stkPing(s, `🎯 <b>${s.n}</b> 찌라시 적중 — ${t.k==="up"?"호재":"악재"}가 사실로 확인됐습니다`, t.k==="up"?"good":"warn");
    } else {
      t.res="miss";
      /* 불발 — 선반영됐던 만큼 되돌린다. 소문만 믿고 들어갔으면 여기서 물린다. */
      let back=SRC.pre*0.020*k*(1.20+Math.random()*1.10);
      /* ⚠ 제보 — 「호재 찌라시가 낭설로 판명됐는데도 장대양봉이 수일째 계속된다. 그냥
         놔두면 돈 복사가 될 것 같다. 호재 낭설이면 하락폭이, 악재 낭설이면 상승폭이 있어야
         한다」. 되돌림이 「선반영분」만 봐서, 소문 기간에 실제로 크게 오른 종목(대주주가
         100억을 지르면 개미가 따라붙어 실제로 오른다)은 낭설이 나도 오른 값이 그대로 남았다.
         소문 시작일의 값(p0)을 기준으로, 낭설이면 그 뒤 오른(내린) 폭의 절반 이상을 함께
         되돌린다 — 소문에 오른 값은 소문과 함께 빠진다.
         (모멘텀은 하루 0.82로 식으므로 누적 등락 ≈ mom/0.18 — 계수 0.10~0.16이 되돌림 55~90%) */
      if(t.p0>0){
        const run=(s.p-t.p0)/t.p0;                     // 소문 기간의 실제 등락
        if(t.k==="up"   && run>0) back += clamp(run, 0, 0.60)*(0.10+Math.random()*0.06);
        if(t.k==="down" && run<0) back += clamp(-run, 0, 0.60)*(0.10+Math.random()*0.06);
      }
      /* 소문이 꺼지면 소문을 타고 붙던 매수세(모멘텀)도 흩어진다 — 이걸 안 죽이면
         대주주 매수로 쌓인 관성이 되돌림보다 커서 낭설 뒤에도 양봉이 계속됐다(실측). */
      if(t.k==="up"){ if(s.mom>0) s.mom*=0.15; s.mom-=back; }
      else          { if(s.mom<0) s.mom*=0.15; s.mom+=back; }
      stkLog("tipMiss", `💨 <b>[낭설]</b> ${t.txt} — 회사 측은 "사실무근"이라고 밝혔습니다`, s.id);
      stkPing(s, `💨 <b>${s.n}</b> 찌라시는 낭설이었습니다 — 회사 측 부인`, "warn");
    }
  }
  /* 결말 난 지 오래된 건 정리 */
  S.tips=T.filter(x=>!x.res || day-x.due<40);
}
/* 🕵️ 찌라시 카드 */
function stkTipCard(){
  const S=stkState(); if(!S) return "";
  const M=me();
  const T=stkTips();
  const open=T.filter(x=>!x.res);
  const done=T.filter(x=>x.res && x.res!=="void").slice(0,10);
  const hit=T.filter(x=>x.res==="hit").length, miss=T.filter(x=>x.res==="miss").length;
  const row=(t)=>{
    const s=stkById(t.sid);
    const SRC=STK_SRC[t.src]||STK_SRC.desk;
    const own=s && M.stkInv && M.stkInv[s.id] && M.stkInv[s.id].q>0;
    const left=Math.max(0, t.due-(G.day||0));
    const relC = t.rel>=60?"#3fb950" : t.rel>=40?"#e3b341" : "#f85149";
    const res = t.res==="hit" ? `<span style="color:#f85149;font-weight:700">🎯 적중</span>`
              : t.res==="miss"? `<span style="color:#8b949e;font-weight:700">💨 낭설</span>`
              : `<span style="color:var(--gold)">⏳ 확인까지 ${left}일</span>`;
    return `<div class="stkNews${own?" mine":""}" ${s?`onclick="stkOpen(${s.id})"`:""}>
      <span class="stkNewsIc">${SRC.ic}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;line-height:1.5">${t.txt}
          <span class="stkTier" style="color:${t.k==="up"?"#f85149":"#58a6ff"};border-color:${t.k==="up"?"#f8514966":"#58a6ff66"}">${t.k==="up"?"호재":"악재"}</span></div>
        <div class="small" style="color:var(--sub)">${dateLabel(t.d)} · ${SRC.n} ·
          신뢰도 <b style="color:${relC}">${t.rel}%</b> · ${res}${own?' · <b style="color:var(--gold)">보유 중</b>':""}
          ${s?` · 현재 ${stkWon(s.p)}원`:""}</div>
      </div></div>`;
  };
  return `<div class="card"><h3>🕵️ 도는 이야기
      <span class="small">— 확인 중 ${open.length}건${hit+miss?` · 지금까지 적중 ${hit} · 낭설 ${miss}`:""}</span></h3>
    <div class="msg warn" style="margin-bottom:8px">
      <b>확인되지 않은 이야기</b>입니다. 맞으면 크게 먹지만, 낭설로 끝나면 소문에 오른 값이 그대로 빠집니다.
      신뢰도가 낮을수록 맞았을 때 더 크게 움직입니다 — 아무도 안 믿었으니까요.</div>
    ${open.length?open.map(row).join("")
      :`<p class="small" style="padding:8px 2px">지금 도는 이야기가 없습니다. 며칠 지나면 또 돕니다.</p>`}
    ${done.length?`<h4 class="small" style="margin:12px 0 4px;color:var(--sub)">지난 이야기</h4>${done.map(row).join("")}`:""}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   🩸 사채 — 신용 한도가 막힌 뒤에도 돈을 빌려주는 곳
   이자가 연 40% 를 넘고, 못 갚으면 감독 개인의 문제로 끝나지 않는다.
   독촉 → 위신 하락 → 구단주 신뢰 하락 → 기사 → 파산.
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_DEBT_RATE=0.0011;    // 하루 0.11% ≈ 연 49%
const STK_DEBT_MAX =18;        // 감독 연봉의 몇 배까지 — 연봉 5억이면 90억쯤. 판은 커지되 비현실적이진 않게
const STK_DEBT_JOB_K=1.28;     // 🕊️ 무직 이자 가산 — 갚을 기약이 없는 사람에겐 더 붙는다
function stkDebt(){ return Math.max(0, me().stkDebt||0); }
function stkDebtRate(){ return STK_DEBT_RATE * (G.jobless?STK_DEBT_JOB_K:1); }
/* 🕊️ 무직 감독의 「상환 능력」 — 월급이 없다고 사채업자가 손을 놓지는 않는다.
   ⚠ 제보 — 「무직일 때 사채 쓰게 해 줘」. 한도가 bankIncome(무직 0.5억) 기준이라
      연봉 4.6억 재직 중 71억이던 한도가 무직이 되면 8억으로 쪼그라들어, 한 번 빌리면 바로 막혔다.
      사채업자는 「이 사람이 다시 어디든 갈 사람인가」를 본다 — 마지막 연봉과 평판으로 잡는다. */
function stkDebtSal(){
  let sal=8;
  try{ sal=(typeof bankIncome==="function") ? Math.max(1.5, bankIncome()) : (mgrSalary()||8); }catch(e){}
  if(!G.jobless) return sal;
  let last=0;
  try{ const h=(G.mgrCtHist||[]).slice(-1)[0]; if(h && h.wage>0) last=h.wage; }catch(e){}
  if(!last) try{ last=mgrWageBase(); }catch(e){}
  if(!last) last=4;
  let rep=40; try{ rep=mgrRep(); }catch(e){}
  /* 평판 30이면 마지막 연봉의 45%, 평판 90이면 105% 로 본다 */
  return Math.max(sal, Math.round(last*clamp(0.45+(rep-30)/100*0.60, 0.35, 1.05)*100)/100);
}
function stkDebtMax(){
  const sal=stkDebtSal();
  /* 사채업자도 사람은 본다 — 은행에서 이미 밀린 사람에겐 덜 빌려준다(막지는 않는다) */
  let k=1;
  try{ const s=bankScore(); k=clamp(0.35+(s-300)/700*0.9, 0.35, 1.25); }catch(e){}
  return Math.max(0, Math.round((sal*STK_DEBT_MAX*k - stkDebt())*10)/10);
}
function stkDebtBorrow(amtWon){
  const M=me();
  if(stkBadCredit()){ flash(`파산 이력이 남아 있어 사채업자도 손사래를 칩니다 — ${stkBadCreditLeft()}시즌 남음.`,"warn"); return; }
  const a=Math.max(0, Math.round(amtWon||0));
  if(a<=0){ flash("금액을 입력하세요.","warn"); return; }
  if(a/1e8 > stkDebtMax()){ flash(`이 이상은 빌려주지 않습니다 — 최대 ${stkDebtMax().toFixed(1)}억.`,"warn"); return; }
  M.stkDebt=stkDebt()+a;
  stkCash(a);
  if(!M.stkDebtAt) M.stkDebtAt=G.day||0;
  stkTxAdd({k:"loanshark", amt:a});
  stkLog("debt", `🩸 사채 ${(a/1e8).toFixed(2)}억 차입 — 연 ${(stkDebtRate()*365*100).toFixed(0)}%${G.jobless?" (무직 가산)":""} (잔액 ${(M.stkDebt/1e8).toFixed(2)}억)`);
  try{ meLog(`🩸 사채 ${(a/1e8).toFixed(2)}억 차입 (잔액 ${(M.stkDebt/1e8).toFixed(2)}억)`); }catch(e){}
  try{ notifyStk(`🩸 사채 <b>${(a/1e8).toFixed(2)}억</b>을 빌렸습니다. 이자가 매일 붙습니다 — 오래 끌면 안 됩니다.`,"warn"); }catch(e){}
  saveGame(); show("mylife");
}
function stkDebtRepay(amtWon){
  const M=me();
  const a=Math.min(stkDebt(), Math.max(0, Math.round(amtWon||0)));
  if(a<=0){ flash("상환할 금액이 없습니다.","warn"); return; }
  if(a > M.cash*1e8){ flash(`현금이 부족합니다 (보유 ${moneyEok(M.cash)}).`,"warn"); return; }
  M.stkDebt=stkDebt()-a;
  stkCash(-a);
  stkTxAdd({k:"sharkpay", amt:a});
  if(!stkDebt()){
    M.stkDebtAt=null; M._debtWarn=0;
    stkLog("good", `✅ 사채를 모두 갚았습니다`);
    try{ if((M.stkDebtInt||0)>=5) stkSocial("back"); }catch(e){}
    try{ notifyStk(`✅ 사채를 전액 상환했습니다. 한숨 돌렸습니다.`,"good"); }catch(e){}
  }
  saveGame(); show("mylife");
}
/* 매일 — 이자가 붙고, 오래 끌면 사람이 찾아온다 */
/* ═══ 🧾 국세청 초과 금융자산 환수 ══════════════════════════════════════
   ⚠ 요청 원문 — 「주식으로 100조 이상 가지고 있으면 국세청에서 100조만 남기고
      그 이상의 현금은 다 국고로 귀속시키는 이벤트 만들자」.

   ─ 판정은 「금융자산」으로 한다: 현금 + 주식 평가액 + 공매도 평가손익 + 선물 계좌
     − 신용융자 − 사채. 주식을 안 팔고 버티는 우회를 막기 위해서다(선택).
   ─ 회수는 「현금에서만」 한다. 보유 주식은 감독의 포지션이므로 국세청이 팔지 않는다 —
     그래서 현금이 모자라면 있는 만큼만 가져가고, 익절하는 순간 다시 걸린다.
   ─ 하루에 한 번, 회수할 현금이 1억 이상일 때만 통보한다(도배 방지). */
/* ═══ 🏢 구단 사건 — 긴축재정 · 횡령 ══════════════════════════════════════
   ⚠ 요청 원문 — 「인카운터로 기업구단들 경영악화로 인한 긴축재정 이러면서 영입예산
      깎아버리는 이런거 만들자. 시민구단은 구단 직원의 횡령 사건 이런것도 만들고」.
   ─ 정한 것 ────────────────────────────────────────────────────────
     · 통보형이다. 감독이 고를 여지가 없다 — 구단이 결정하고 감독은 통보를 받는다(선택).
     · AI 구단에도 벌어진다(선택). 긴축에 빠진 구단은 이적시장에서 조용해지고,
       그 구단 선수를 싸게 데려올 틈이 생긴다. 리그 판도가 살아 움직인다.
     · 기업구단은 「모기업 실적 악화 → 긴축재정」, 시민구단은 「구단 직원 횡령」.
       군팀(상무)은 어느 쪽도 아니다 — 예산이 국방부 몫이다.
     · 한 구단에 한 시즌 한 번. 시즌 초반(개막 전)에는 걸지 않는다 — 예산을 쓰기도 전에
       깎이면 그 시즌이 통째로 무의미해진다.
   ═════════════════════════════════════════════════════════════════ */
const CE_P_DAY=0.0009;         // 구단 하나가 하루에 사건을 맞을 확률 — 시즌 내내 흩어져 터지게
const CE_MAX_SEASON=4;         // 리그 전체에서 한 시즌에 터지는 사건 수 상한
const CE_CUT_CORP=[0.22,0.45]; // 긴축재정 — 이적 예산 삭감 폭
const CE_CUT_CIVIC=[0.14,0.34];// 횡령 — 빼돌려진 예산 비율
const CE_AUSTER_R=14;          // 긴축 지속 라운드 — 이 동안 AI 는 영입을 자제한다
const CE_CORP_WHY=[
  "모기업 반도체 부문 적자 전환", "모기업 해외 법인 구조조정", "그룹 차원의 비상경영 선언",
  "모기업 신용등급 하향", "주력 계열사 실적 급락", "그룹 지주사 전환 비용 부담",
  "모기업 대규모 리콜 사태", "환율 급등으로 원가 부담 폭증", "그룹 총수 일가 지분 정리",
  "모기업 노사 협상 결렬로 생산 차질"];
const CE_CIVIC_WHY=[
  "구단 사무국 직원의 공금 횡령", "재무 담당자의 법인카드 사적 유용", "용품 납품 계약 리베이트",
  "티켓 판매 대금 일부 유용", "선수단 식대 예산 부풀리기", "구장 대관료 이중 청구",
  "유스 지원금 유용", "마케팅 대행 계약 과다 지급"];
function ceState(){
  if(!G.clubEv || G.clubEv.s!==G.season) G.clubEv={s:G.season, n:0, hit:{}, aust:{}};
  if(!G.clubEv.hit) G.clubEv.hit={};
  if(!G.clubEv.aust) G.clubEv.aust={};
  return G.clubEv;
}
/* 지금 긴축 중인 구단인가 — AI 영입 판단이 이 값을 본다 */
function ceAusterity(tid){
  try{
    const S=ceState(), t=G.teams[tid]; if(!t) return false;
    const until=S.aust[tid]; if(until==null) return false;
    return (t.div===1?(G.r1||0):(G.r2||0)) < until;
  }catch(e){ return false; }
}
function ceTick(){
  const S=ceState();
  if(S.n>=CE_MAX_SEASON) return;
  if(G.phase!=="league") return;                 // 프리시즌·시즌 종료에는 걸지 않는다
  for(const id in (G.teams||{})){
    if(S.n>=CE_MAX_SEASON) break;
    const t=G.teams[id];
    if(!t || S.hit[id]) continue;
    try{ if(isArmyTeam(t)) continue; }catch(e){}
    const rd=(t.div===1?(G.r1||0):(G.r2||0));
    if(rd<4) continue;                           // 개막 직후는 봐준다
    if(Math.random()>=CE_P_DAY) continue;
    let ct=null; try{ ct=clubType(t); }catch(e){}
    const kind=(ct && ct.k==="corp") ? "corp" : (ct && ct.k==="civic") ? "civic" : null;
    if(!kind) continue;                          // 기업+시민 혼합·군팀은 대상이 아니다
    S.hit[id]=kind; S.n++;
    try{ ceFire(t, kind, ct); }catch(e){}
  }
}
function ceFire(t, kind, ct){
  const S=ceState();
  const rng=(a)=>a[0]+Math.random()*(a[1]-a[0]);
  const cut=rng(kind==="corp"?CE_CUT_CORP:CE_CUT_CIVIC);
  const before=Math.max(0, +t.budget||0);
  /* 💸 요청 「갑작스럽게 예산 깎이면 생길 수 있는 일」 — 손실에 하한을 둔다.
     이미 곳간이 빈 구단은 여기서 마이너스로 내려가고, 그러면 다음 달 급여를 못 낸다.
     (횡령은 이미 집행된 돈까지 빼돌린 것이므로 잔고보다 큰 금액이 사라질 수 있다) */
  let lost=Math.round(before*cut*10)/10;
  try{ lost=Math.max(lost, Math.round(waMonthly(t)*(0.5+Math.random()*1.1)*10)/10); }catch(e){}
  t.budget=Math.round((before-lost)*10)/10;
  /* 긴축은 연봉 상한도 얼린다 — 큰 계약을 새로 못 쓴다 */
  if(kind==="corp"){
    try{ t.wageCap=Math.round(Math.max(totalWage(t), (t.wageCap||0)*0.94)*10)/10; }catch(e){}
    S.aust[t.id]=(t.div===1?(G.r1||0):(G.r2||0))+CE_AUSTER_R;
  }
  const why = pick(kind==="corp"?CE_CORP_WHY:CE_CIVIC_WHY);
  const mine=!!t.isUser;
  const head = kind==="corp"
    ? `${t.short}, 모기업 긴축재정 — 이적 예산 ${Math.round(cut*100)}% 삭감`
    : `${t.short} 사무국 횡령 적발 — 이적 예산 ${lost}억 증발`;
  const sub = kind==="corp"
    ? `${why}. 그룹이 비상경영에 들어가면서 구단 운영비부터 손댔다. 남은 이적 예산은 ${t.budget}억이다.`
    : `${why}이 감사에서 드러났다. 회수까지는 시간이 걸린다 — 당장 쓸 수 있는 돈이 ${t.budget}억으로 줄었다.`;
  try{
    addNews(`${kind==="corp"?"📉":"🚨"} <b>${head}</b>`, "warn", "club",
      {cat:"club", ic:kind==="corp"?"📉":"🚨", tone:-1, tid:t.id, head, sub, src:"K리그 공식"});
  }catch(e){}
  if(!mine) return;
  /* 내 구단 일이면 통보한다 — 감독이 고를 여지는 없다(요청: 통보형) */
  try{
    notify(kind==="corp"
      ? `📉 <b>모기업 긴축재정</b> — ${why}. 이적 예산이 <b>${lost}억</b> 깎여 <b>${t.budget}억</b>이 남았습니다.`
      : `🚨 <b>사무국 횡령 적발</b> — ${why}. 이적 예산 <b>${lost}억</b>이 사라져 <b>${t.budget}억</b>이 남았습니다.`,
      "warn");
  }catch(e){}
  try{ addMood(kind==="corp"
    ? `📉 모기업 긴축재정 소식에 선수단이 술렁입니다. 겨울 보강은 기대하기 어렵습니다.`
    : `🚨 사무국 횡령 소식에 라커룸 분위기가 가라앉았습니다.`); }catch(e){}
  try{ t.morale=clamp((t.morale||70)-(kind==="corp"?3:5), 30, 99); }catch(e){}
  /* 신뢰 — 감독 잘못이 아니다. 팬은 구단에 화를 내지만 감독 자리도 흔들린다. */
  try{
    if(kind==="corp") adjustTrust("owner", -1.5, "모기업 긴축재정");
    else { adjustTrust("fans", -4, "사무국 횡령 사건"); adjustTrust("owner", -1, "사무국 횡령 사건"); }
  }catch(e){}
  try{ socialFill(kind==="corp"?SOC_CE_CORP:SOC_CE_CIVIC, 3, -1, {t:t.short, w:why}); }catch(e){}
  try{ fmkFill(kind==="corp"?FMK_CE_CORP:FMK_CE_CIVIC, 2, {t:t.short, w:why}); }catch(e){}
  /* 🤬💀 요청 — 「시모와 독고가 더 악랄하게 반응해야할텐데」. 이 사건만큼은 확률이 아니라 확정이다 */
  try{ pushTroll({t:t.short, w:why}, kind==="corp"?TROLL_AUSTER:TROLL_EMBEZZLE); }catch(e){}
}
const SOC_CE_CORP=[
 "모기업이 힘들다고 왜 구단부터 줄이냐 {t} 팬은 무슨 죄냐",
 "겨울에 영입 없겠네... 올해는 있는 애들로 버티는 거다",
 "예산 깎였다는데 감독님만 욕먹을 게 뻔하다",
 "{w} 기사 봤다. 이건 구단이 어떻게 할 수 있는 일이 아님",
 "구단 운영비부터 손대는 거 진짜 국룰이냐",
 "이 와중에 감독 경질설 나오면 진짜 화낼 거다"];
const FMK_CE_CORP=[
 ["{t} 모기업 긴축 들어갔다는데 이번 겨울 영입 0명 각 ㅋㅋ", -1],
 ["{w} → 구단 예산 삭감. 순서가 항상 똑같음", -1],
 ["예산 깎이고 성적 안 나오면 감독 자르는 게 이 바닥 공식", -1]];
const SOC_CE_CIVIC=[
 "{t} 사무국 횡령이라니 이게 무슨 일이냐",
 "선수단이 무슨 잘못이냐 진짜 화난다",
 "{w} ... 시민 세금으로 굴러가는 구단에서 이럴 수가 있나",
 "감사 제대로 해라. 이번 한 번이 아닐 것 같은데",
 "돈은 돈대로 없어지고 성적은 성적대로 못 내면 어쩌라는 거냐"];
const FMK_CE_CIVIC=[
 ["{t} 사무국 횡령 적발. {w} 이라는데 액수가 장난 아님", -1],
 ["시민구단 회계 감사 좀 제대로 하자 진짜", -1],
 ["선수 살 돈이 그렇게 새 나갔다는 거 아니냐 ㅋㅋ 웃음도 안 나온다", -1]];
/* ═══ 💸 임금 체불 ════════════════════════════════════════════════════════
   ⚠ 요청 원문 — 「임금체불 이벤트도 넣어줘. 갑작스럽게 예산 깎이면 생길 수 있는 일이잖아.
      배선 잘해주고」.
   ─ 배선 ────────────────────────────────────────────────────────────
     · 원인은 하나다: 「이번 달 급여를 낼 돈이 없다」. 긴축·횡령으로 예산이 날아갔거나,
       감독이 이적시장에서 다 써 버렸거나 — 어느 쪽이든 결과는 같다.
     · 달이 바뀌는 날 판정한다(이달의 선수와 같은 달력 눈금).
     · 밀린 달수에 따라 단계가 오른다:
         1개월 — 라커룸이 술렁인다 (사기)
         2개월 — 핵심 선수가 불만을 품는다 (기존 unhappy 배관 → 이적 요청·태업)
         3개월 — 연맹 제재. 이적시장 등록 금지 (영입 자체가 막힌다)
     · 돈이 들어오면 밀린 몫을 한 번에 지급하고 풀린다. 사과와 함께 사기가 조금 돌아온다.
     · AI 구단에도 벌어진다 — 그 구단 선수는 임대·이적으로 빠져나가기 쉬워진다.
   ═════════════════════════════════════════════════════════════════════ */
const WA_GRACE=-0.5;        // 이 밑으로 내려가면 이번 달 급여를 못 낸다 (억)
const WA_SANCTION=3;        // 이 달수부터 연맹 제재 (이적 등록 금지)
const WA_MAX_M=8;           // 밀린 달 표시 상한
/* ⛔ 연맹 제재 관문 — 체불 3개월부터 선수 등록이 막힌다 (요청: 배선) */
function waGate(what){
  try{
    const t=userTeam(); if(!t) return false;
    if(!waSanctioned(t.id)) return false;
    const a=waOf(t.id)||{m:0,tot:0};
    showConfirm(`<b>⛔ 연맹 제재 — 선수 등록 금지</b>\n\n`+
      `임금이 <b>${a.m|0}개월</b> 밀려 있습니다. 체불액 <b>${a.tot}억</b>을 해소하기 전까지는\n`+
      `${what}을(를) 포함해 어떤 선수도 새로 등록할 수 없습니다.\n\n`+
      `<span class="small">이적 예산이 회복되면 달이 바뀌는 날 밀린 급여가 한 번에 지급되고 제재도 풀립니다.</span>`,
      ()=>{}, {okLabel:"알겠습니다", cancelLabel:""});
    return true;
  }catch(e){ return false; }
}
function waState(){
  if(!G.wageArr || typeof G.wageArr!=="object") G.wageArr={};
  return G.wageArr;
}
function waOf(tid){ const W=waState(); return W[tid]||null; }
function waMonths(tid){ const a=waOf(tid); return a ? (a.m|0) : 0; }
/* 연맹 제재 중인가 — 이적 등록이 막힌다 */
function waSanctioned(tid){ return waMonths(tid)>=WA_SANCTION; }
/* 한 달치 급여 (억) — 연봉 총액의 12분의 1 */
function waMonthly(t){ try{ return Math.round(totalWage(t)/12*100)/100; }catch(e){ return 0; } }
/* 달이 바뀌는 날 한 번 — 낼 수 있으면 내고, 못 내면 밀린다 */
function waTick(){
  const W=waState();
  const k=motmKey();
  if(G.waLast===k) return;
  const first=(G.waLast==null);
  G.waLast=k;
  if(first) return;                      // 첫 호출은 기준점만 잡는다
  for(const id in (G.teams||{})){
    const t=G.teams[id]; if(!t) continue;
    try{ if(isArmyTeam(t)) continue; }catch(e){}   // 🎖️ 상무 급여는 국방부 몫이다
    const due=waMonthly(t);
    if(due<=0) continue;
    const a=W[id];
    /* 밀린 게 있으면 먼저 갚는다 — 갚을 수 있을 때만 */
    if(a){
      const owed=Math.round((a.tot||0)*10)/10;
      if((t.budget||0) - owed - due >= WA_GRACE){
        t.budget=Math.round(((t.budget||0)-owed-due)*10)/10;
        delete W[id];
        try{ waClear(t, a); }catch(e){}
        continue;
      }
      a.m=Math.min(WA_MAX_M, (a.m|0)+1);
      a.tot=Math.round(((a.tot||0)+due)*10)/10;
      try{ waHit(t, a, due); }catch(e){}
      continue;
    }
    /* 아직 안 밀렸다 — 이번 달을 낼 수 있는가 */
    if((t.budget||0) - due >= WA_GRACE){
      t.budget=Math.round(((t.budget||0)-due)*10)/10;
      continue;
    }
    W[id]={m:1, tot:Math.round(due*10)/10, s:G.season, since:(G.day||0)};
    try{ waHit(t, W[id], due); }catch(e){}
  }
}
/* 체불 한 달 — 단계별 파장 */
function waHit(t, a, due){
  const m=a.m|0, mine=!!t.isUser;
  /* 선수단 — 밀릴수록 깊게 내려앉는다 */
  const drop = m>=3 ? 7 : m>=2 ? 5 : 3;
  try{ t.morale=clamp((t.morale||70)-drop, 25, 99); }catch(e){}
  try{ for(const p of (t.players||[])) p.morale=clamp((p.morale||70)-drop, 20, 99); }catch(e){}
  /* 2개월 — 핵심 선수부터 불만을 품는다. 기존 배관(unhappy)이 이적 요청·태업까지 이어 준다 */
  if(m>=2){
    try{
      const core=[...(t.players||[])].filter(p=>p&&!p.army).sort((a2,b2)=>(b2.ovr||0)-(a2.ovr||0)).slice(0, m>=3?4:2);
      for(const p of core){
        if((p.unhappy||0)>=3) continue;
        p.unhappy=Math.min(3,(p.unhappy||0)+1);
        p.uWhy="임금 체불";
        try{ affAdd(p, -6, "임금 체불"); }catch(e){}
      }
    }catch(e){}
  }
  /* 조직력 — 훈련장 공기가 무너진다 */
  if(mine && m>=2){ try{ t.fam=clamp(famOf(t)-4, 0, 100); }catch(e){} }
  const head = m>=WA_SANCTION
    ? `${t.short} 임금 체불 ${m}개월 — 연맹, 이적 등록 금지 제재`
    : `${t.short}, 선수단 임금 ${m}개월 체불`;
  const sub = m>=WA_SANCTION
    ? `연맹이 선수 등록 금지 제재를 내렸다. 체불액 ${a.tot}억을 해소하기 전까지 어떤 선수도 새로 등록할 수 없다.`
    : `이번 달 급여 ${due}억이 지급되지 않았다. 누적 체불액은 ${a.tot}억이다.`;
  try{ addNews(`💸 <b>${head}</b>`, "warn", "club",
    {cat:"club", ic:"💸", tone:-1, tid:t.id, head, sub, src:"K리그 공식"}); }catch(e){}
  if(!mine) return;
  try{ notify(m>=WA_SANCTION
    ? `⛔ <b>임금 체불 ${m}개월 — 연맹 제재</b>. 체불액 <b>${a.tot}억</b>을 갚기 전까지 <b>선수 등록이 금지</b>됩니다.`
    : `💸 <b>임금 ${m}개월 체불</b> — 이번 달 급여 ${due}억을 지급하지 못했습니다. 누적 <b>${a.tot}억</b>. 선수단이 동요하고 있습니다.`,
    "warn"); }catch(e){}
  try{ addMood(m>=2
    ? `💸 월급이 ${m}달째 밀렸습니다. 라커룸에서 대놓고 이야기가 나옵니다.`
    : `💸 이번 달 급여가 밀렸습니다. 선수단이 술렁입니다.`); }catch(e){}
  try{ adjustTrust("fans", -3, "임금 체불"); adjustTrust("owner", -2, "임금 체불"); }catch(e){}
  try{ socialFill(SOC_WA, 3, -1, {t:t.short, m, a:a.tot}); }catch(e){}
  try{ fmkFill(FMK_WA, 2, {t:t.short, m, a:a.tot}); }catch(e){}
  try{ pushTroll({t:t.short, m, a:a.tot}, TROLL_WA); }catch(e){}
}
/* 체불 해소 — 밀린 몫을 한 번에 지급했다 */
function waClear(t, a){
  const mine=!!t.isUser;
  try{ t.morale=clamp((t.morale||70)+Math.min(8,(a.m|0)*3), 25, 99); }catch(e){}
  try{ for(const p of (t.players||[])){
    p.morale=clamp((p.morale||70)+Math.min(8,(a.m|0)*3), 20, 99);
    if(p.uWhy==="임금 체불"){ p.unhappy=0; p.uWhy=""; }   // 받았으면 그 이유는 사라진다
  } }catch(e){}
  const head=`${t.short}, 체불 임금 ${a.tot}억 전액 지급`;
  try{ addNews(`✅ <b>${head}</b>`, "good", "club",
    {cat:"club", ic:"✅", tone:1, tid:t.id, head,
     sub:`${a.m|0}개월간 밀려 있던 급여가 한 번에 지급됐다. 연맹 제재도 함께 풀렸다.`, src:"K리그 공식"}); }catch(e){}
  if(!mine) return;
  try{ notify(`✅ <b>체불 임금 ${a.tot}억을 전액 지급했습니다.</b> 선수단 사기가 돌아오고 제재도 풀렸습니다.`, "good"); }catch(e){}
  try{ addMood(`✅ 밀렸던 급여가 모두 지급됐습니다. 라커룸이 한숨 돌렸습니다.`); }catch(e){}
  try{ adjustTrust("fans", +2, "체불 임금 해소"); }catch(e){}
}
const SOC_WA=[
 "월급이 {m}달째 안 나온다는 게 말이 되냐 {t} 프런트 뭐하냐",
 "선수들이 무슨 죄냐 진짜... 뛰라고 하기 전에 돈부터 줘라",
 "체불 {a}억이란다. 이 정도면 구단 존립 문제 아니냐",
 "이 상황에서 성적 얘기하는 사람은 좀 아니라고 본다",
 "감독님만 불쌍하다 진짜. 이건 감독이 어떻게 할 수 있는 게 아님",
 "선수 나간다고 뭐라 하지 마라 나 같아도 나간다"];
const FMK_WA=[
 ["{t} 임금 체불 {m}개월 ㄷㄷ 이거 실화냐", -1],
 ["체불 {a}억이면 이적시장이고 뭐고 없다 그냥 버티는 거임", -1],
 ["선수들 단체로 이적 요청 들어가는 거 시간문제다", -1]];
const TROLL_WA=[
 "ㅋㅋㅋㅋ 월급도 못 주는 구단이 프로냐 내가 십 년째 하던 말이다",
 "{t} 체불 {m}개월 ㅋㅋ 이게 세금리그 실체다 더 할 말 있냐",
 "선수들 밥값은 나오냐? 진심으로 궁금해서 물어본다",
 "니들이 산 유니폼 값은 어디로 갔을까~ ㅋㅋ 생각해봐라",
 "체불 {a}억 ㅋㅋ 이 돈이면 유럽 2부 백업 한 명 값이다",
 "월급 밀리는 직장 다니면 도망가라고 하면서 팀은 왜 못 버리냐 ㅋㅋ",
 "감독님 월급은 나오나요? 그것도 밀렸으면 진짜 웃긴데",
 "이쯤 되면 응원이 아니라 봉사활동이다 ㅇㅇ",
 "구단 망하면 니들 굿즈는 그냥 쓰레기다 미리 알려준다",
 "{t} 팬들 지금 화낼 데도 없지? ㅋㅋ 나한테 화내라 그건 받아준다"];
/* 🧾 ⑤ 자금출처 세무조사 — 예전의 「100조 넘으면 현금 몰수」를 대체한다.
   ⚠ 그 방식은 그 밑에서는 아무 제동이 없다가 갑자기 벽을 만나는 구조라, 게임이 손을 뻗어
      뺏는 느낌이 났다. 이제 앞의 네 층(양도세·배당세·공시·금감원)이 상시로 물리므로,
      국세청은 <b>「짧은 기간에 자산이 비정상적으로 불어난 경우」</b>만 본다.
   ─ 실제 제도 그대로다: 자금 출처를 소명하지 못하면 <b>추징 + 가산세</b>. */
const NTS_GROW=4.0;             // 이 배수 이상으로 불어나면 조사 대상
const NTS_WIN=120;              // 비교 구간 (일)
const NTS_FLOOR=3000;           // 이 금액(억) 아래는 보지 않는다
const NTS_RATE=0.35;            // 소명하지 못한 증가분에 대한 추징·가산세율
const NTS_MIN=1;                // 이만큼도 안 되면 굳이 손대지 않는다 (억)
function ntsFin(){              // 감독의 금융자산 (억)
  const M=me(); let v=(M.cash||0)*1e8;
  try{ v+=stkEval(); }catch(e){}
  try{ v-=stkShortVal(); }catch(e){}      /* ⚠ 공매도 부채 (netWorth 와 같은 규칙) */
  try{ v+=stkFutEquity(); }catch(e){}
  try{ v-=stkLoan(); }catch(e){}
  try{ v-=stkDebt(); }catch(e){}
  return v/1e8;
}
function ntsState(){ if(!G.nts) G.nts={n:0, tot:0, day:-1, s:0}; return G.nts; }
/* 조 단위로 크게 — 100조가 넘어가면 억 표기는 자릿수가 읽히지 않는다 */
function ntsJo(eok){ return (Math.round((+eok||0)/10000*100)/100).toLocaleString()+"조"; }
function ntsTick(){
  try{
    const M=me(); if(!M) return;
    const N=ntsState();
    if(N.day===(G.day||0)) return;             // 같은 날 두 번 굴리지 않는다
    const fin=ntsFin();
    /* 기준선 — NTS_WIN 일 전의 금융자산을 기억해 둔다 */
    if(N.baseD==null || ((G.day||0)-(N.baseD||0))>=NTS_WIN || (N.baseS!=null && N.baseS!==G.season)){
      N.base=fin; N.baseD=G.day||0; N.baseS=G.season; return;
    }
    if(fin < NTS_FLOOR) return;                          // 아직 볼 규모가 아니다
    const base=Math.max(1, N.base||1);
    if(fin < base*NTS_GROW) return;                      // 정상적인 증가다
    const grew=fin-base;
    const take=Math.round(Math.min(M.cash||0, grew*NTS_RATE)*100)/100;
    if(take<NTS_MIN) return;                             // 가져갈 현금이 없다 — 주식은 건드리지 않는다
    N.day=G.day||0; N.s=G.season;
    stkCash(-take*1e8);
    N.n=(N.n|0)+1; N.tot=Math.round(((N.tot||0)+take)*100)/100;
    N.base=ntsFin(); N.baseD=G.day||0; N.baseS=G.season;  // 조사 뒤 기준선을 다시 잡는다
    const left=Math.round(ntsFin()*100)/100;
    try{ meLog(`－${take.toFixed(2)}억 · 🧾 국세청 자금출처 세무조사 추징`); }catch(e){}
    try{ stkLog("nts", `🧾 국세청 자금출처 조사 — ${NTS_WIN}일 만에 금융자산이 ${ntsJo(base)} → ${ntsJo(fin)} 로 불어난 경위를 소명하지 못해 <b>${ntsJo(take)}</b>가 추징되었습니다`); }catch(e){}
    try{ notifyStk(`🧾 <b>국세청 자금출처 세무조사</b><br>${NTS_WIN}일 만에 금융자산이 <b>${NTS_GROW}배</b> 넘게 불어난 경위를 소명하지 못해 <b>${take.toFixed(2)}억</b>이 추징됐습니다.<br><span class="small">남은 금융자산 ${ntsJo(left)}</span>`,"warn"); }catch(e){}
    try{ const t=userTeam(), jobless=!!(G && G.jobless);
      addNews(`🧾 <b>국세청, ${(t&&!jobless)?t.name+" 감독":"전 감독"} 자금출처 세무조사 — ${ntsJo(take)} 추징</b>
        <span class="small">— ${NTS_WIN}일 만에 금융자산이 ${NTS_GROW}배 넘게 늘어난 경위를 소명하지 못했습니다. 보유 주식은 처분 대상에서 제외됐습니다.</span>`, "warn", "club");
      pushFeed({cat:"club", ic:"🧾", tone:-1, tid:((t&&!jobless)?t.id:null), src:"국세청 공고",
        head:`${(t&&!jobless)?"감독":"전 감독"} 자금출처 조사 — ${ntsJo(take)} 추징`,
        sub:`짧은 기간에 금융자산이 ${ntsJo(base)}에서 ${ntsJo(fin)}로 불어난 경위가 문제가 됐다. 국세청은 소명되지 않은 증가분에 대해 추징과 가산세를 부과했다고 밝혔다. 남은 금융자산은 ${ntsJo(left)}.`});
      /* 🧑‍💼 무직이면 「우리 구단 팬」이 없다 — 팬 반응은 건너뛴다 (도박·금감원과 같은 원칙) */
      if(!jobless){
        const V={t:t?t.short:"우리", n:t?t.name:"우리 팀", m:ntsJo(take), w:ntsJo(fin)};
        socialFill(NTS_SOC, 4+R(3), 0, V);
        fmkFill(NTS_FMK, 4+R(3), V);
        rivalFmk(NTS_FMK_RIV, 2+R(2), V);
      }
    }catch(e){}
    try{ if(typeof PROG!=="undefined" && PROG && typeof prgPush==="function")
      prgPush(`<span class="prgD">${dateLabel(G.day)}</span> 🧾 국세청 자금출처 조사로 <b>${ntsJo(take)}</b>가 추징되었습니다.`, "prgDay"); }catch(e){}
    try{ saveGame(); }catch(e){}
  }catch(e){}
}
/* 팬·커뮤니티 반응 — 파산과는 결이 완전히 다르다. 조롱 반 부러움 반, 음모론 한 줌. */
const NTS_SOC=[
  "감독님 통장에서 {m}이/가 증발했다는데 이게 무슨 소리냐",
  "국세청이 감독 계좌를 털었다고? ㅋㅋㅋㅋ 실화냐",
  "{w} 넘게 모았다는 것부터가 비현실인데",
  "이적 자금으로 좀 쓰시지 그러셨어요...",
  "그 돈이면 리그 전 구단을 사고도 남는다",
  "국고 귀속이라니 무슨 조선시대냐",
  "우리 감독이 축구를 왜 하고 있는지 모르겠다 진심으로",
  "{m} 정도면 우리 구단을 몇 개나 짓냐",
  "솔직히 부럽다는 감정밖에 안 든다",
  "이래도 우리 예산은 안 늘어나는 게 개그",
  "세금 잘 내셨네요 감독님 (진심)",
  "감독님 이제 축구에만 집중하실 수 있겠다",
  "국세청 일 잘하네 ㅋㅋ",
  "근데 저 돈 다 어디서 났대?",
  "이 와중에 주식은 안 뺏겼다는 게 더 웃김"
];
const NTS_FMK=[
  ["{t} 감독 계좌에서 {m}이/가 국고 귀속됐다는데 실화냐",0],
  ["감독이 {w} 넘게 굴렸다는 게 더 놀라움",0],
  ["국세청 vs 축구감독 ㅋㅋㅋㅋㅋ",0],
  ["저 정도면 구단주를 하지 왜 감독을 함",0],
  ["나도 저렇게 뺏겨보고 싶다",1],
  ["주식은 안 건드렸다는 게 포인트",0],
  ["세금 얘기 나오니까 갑자기 조용해지는 사람들",0],
  ["이거 실화면 리그 역사에 남을 사건",0]
];
const NTS_FMK_RIV=[
  ["남의 팀 감독이 {m}을/를 뺏겼다는데 남 일 같지가 않다(부러워서)",0],
  ["우리 감독은 통장에 {w}은/는커녕 카드값 걱정한다",0],
  ["{t} 부럽다 진짜 ㅋㅋ",0]
];
function stkDebtTick(){
  const M=me();
  const D=stkDebt(); if(D<=0) return;
  const it=Math.round(D*stkDebtRate());
  M.stkDebt=D+it;
  M.stkDebtInt=Math.round(((M.stkDebtInt||0)+it/1e8)*1e4)/1e4;
  const days=(G.day||0)-(M.stkDebtAt||0);
  /* ⚠ 갚을 자산이 있으면 파산이 아니다 — 부동산·예금·자가까지 본다.
     대신 「팔아서 갚아야 하는」 상태라는 건 알려 준다. */
  const net=netWorth();
  /* ① 30일마다 독촉 — 갚을 능력이 없으면 점점 험해진다 */
  if(days>0 && days%30===0){
    const lv=Math.min(3, Math.floor(days/30));
    const say=[`"이자만이라도 넣어 주십시오."`,
               `"감독님 댁 앞에서 기다리고 있습니다."`,
               `"구단 사무실로 찾아가는 건 서로 곤란하지 않겠습니까."`][lv-1];
    stkLog("debt", `🩸 사채업자 독촉 (${days}일 경과 · 잔액 ${(M.stkDebt/1e8).toFixed(2)}억) — ${say}`);
    try{ notifyStk(`🩸 사채업자가 연락해 왔습니다 — ${say} <span class="small">(잔액 ${(M.stkDebt/1e8).toFixed(2)}억 · ${days}일)</span>`,"warn"); }catch(e){}
    if(lv>=2){
      try{ adjustTrust("owner", -4, "감독 개인 채무 문제"); }catch(e){}
      if(lv>=3 && Math.random()<0.5){
        try{ adjustTrust("fans", -3, "감독 사채 논란"); }catch(e){}
        addNews(`📰 [단독] ${userTeam()?userTeam().short:""} 감독, 사채 <b>${(M.stkDebt/1e8).toFixed(1)}억</b> 채무설 — 구단 "개인 사안"`, "warn", "stock", {cat:"stock", ic:"📈", src:"증권가"});
        try{ sponScandal("감독 사채 채무 논란", 1); }catch(e){}
        try{ stkSocial("debt"); }catch(e){}
        if(!G.stkAsk || G.stkAsk.k!=="bank") G.stkAsk={k:"debt", s:G.season, d:G.day||0, asked:0};
      }
    }
  }
  /* ② 약속 불이행 — 「자산을 정리하겠다」고 하고 안 갚으면 강제로 처분한다 (파산 전 단계) */
  if(M._dunPromise && (G.day||0)>=M._dunPromise.due){
    const paid=Math.max(0, (M._dunPromise.amt0||M._dunPromise.need*2) - stkDebt());
    M._dunPromise=null;
    if(paid < (stkDebt()*0.35)) stkForceSell("약속 불이행");
    else try{ notifyStk("🩸 사채업자: \"약속은 지키셨습니다. 남은 것도 부탁드립니다.\"","warn"); }catch(e){}
  }
  /* ③ 강제 처분 — 갚을 자산은 있는데 갚지 않고 버티는 상태.
     ⚠ 예전에는 「순자산이 남아 있으면 아무 일도 안 일어나고, 마이너스가 되면 곧장 파산」이었다.
        그 사이가 비어 있어서, 부동산을 잔뜩 들고 이자만 굴리며 버티는 게 최적 전략이 됐다.
        이제 중간 단계를 둔다 — 채권자가 자산을 팔아 빚을 회수한다. 파산보다는 덜 나쁘다. */
  const overdue = G.jobless ? 75 : 100;
  if(net>=0 && stkDebt()>0 && days>=overdue && stkDebt() > netWorth()*0.45){
    stkForceSell("장기 연체");
  }
  /* ④ 파산 — 갚을 길이 아예 없는 상태가 오래가면 전 재산이 넘어간다.
     무직이면 소득이 없어 회복 가능성이 낮다 — 기한이 앞당겨진다. */
  const bkDays = G.jobless ? 90 : 120;
  if(net < 0 && days>=bkDays){
    stkBankrupt();
  } else if(net>=0 && net < stkDebt()*0.8 && days>=60 && !M._sellWarn){
    M._sellWarn=1;
    try{ notifyStk(`⚠️ 사채 잔액이 순자산을 위협합니다 — 부동산이나 주식을 정리해 갚으셔야 합니다. <span class="small">(순자산 ${stkMoney(net)} · 사채 ${stkMoney(stkDebt())})</span>`,"warn"); }catch(e){}
  } else if(net<0 && !M._debtWarn){
    M._debtWarn=1;
    try{ notifyStk(`⚠️ 빚이 자산을 넘어섰습니다. 이대로 ${Math.round(bkDays/30)}달이 지나면 <b>파산</b>합니다 — 주식·부동산을 정리하거나 갚으세요.${G.jobless?" 무직 상태라 기한이 더 짧습니다.":""}`,"warn"); }catch(e){}
  } else if(net>0 && M._debtWarn) M._debtWarn=0;
}
/* 🏷️ 강제 처분 — 채권자가 자산을 팔아 빚을 회수한다. 파산 전 마지막 경고. */
function stkForceSell(why){
  const M=me();
  let got=0;                                  // 회수액(억)
  const sold=[];
  /* ① 주식부터 — 시장에서 즉시 현금화된다 (급매 손실 8%) */
  try{
    const v=stkEval()/1e8;
    if(v>0.2){ M.stkInv={}; M.short={}; M.fut=null;
      try{ (stkState().orders||[]).length=0; }catch(e){}
      const cash=Math.round(v*0.92*100)/100; got+=cash; sold.push(`📉 주식 ${v.toFixed(1)}억 (급매 −8%)`); }
  }catch(e){}
  /* ② 예·적금 해지 */
  try{ const d=bankDepTotal();
    if(d>0.2){ const B=bank(); B.acc=[]; got+=Math.round(d*100)/100; sold.push(`🏦 예·적금 ${d.toFixed(1)}억`); }
  }catch(e){}
  /* ③ 그래도 모자라면 투자 부동산 — 사는 집은 남긴다 (급매 손실 12%) */
  try{
    const need=Math.round(stkDebt()/1e8*100)/100;
    if(got<need && Array.isArray(M.props) && M.props.length){
      const ps=M.props.slice().sort((a,b)=>(b.value||b.price)-(a.value||a.price));
      for(const p of ps){
        if(got>=need) break;
        const v=Math.round((p.value||p.price)*0.88*100)/100;
        got+=v; sold.push(`🏢 ${p.n||"부동산"} ${v.toFixed(1)}억 (급매 −12%)`);
        M.props=M.props.filter(x=>x!==p);
      }
      try{ M.pln=0; }catch(e){}
    }
  }catch(e){}
  const use=Math.min(got, Math.round(stkDebt()/1e8*100)/100);
  M.stkDebt=Math.max(0, stkDebt()-Math.round(use*1e8));
  const back=Math.round((got-use)*100)/100;
  if(back>0) M.cash=Math.round((M.cash+back)*100)/100;    // 남은 돈은 돌려준다
  M._dunAt=G.day||0; M._sellWarn=0;
  if(stkDebt()<=0){ M.stkDebtAt=null; M._dunN=0; }
  try{ stkLog("debt", `🏷️ 강제 처분 (${why}) — ${use.toFixed(2)}억 회수 · 잔액 ${(stkDebt()/1e8).toFixed(2)}억`); }catch(e){}
  try{ meLog(`🏷️ 자산 강제 처분 (${why}) — ${use.toFixed(2)}억이 사채 상환에 쓰였다`); }catch(e){}
  try{ notifyStk(`🏷️ <b>자산이 강제로 처분되었습니다</b> — ${why}. ${use.toFixed(2)}억이 사채 상환에 쓰였습니다.`
    + (stkDebt()>0?` <span class="small">(남은 잔액 ${(stkDebt()/1e8).toFixed(2)}억)</span>`:` <span class="small">사채를 모두 정리했습니다.</span>`), "warn"); }catch(e){}
  try{ if(!G.jobless){ adjustTrust("owner", -6, "감독 자산 강제 처분"); addNews(`📰 ${userTeam()?userTeam().short:""} 감독, 개인 채무로 자산 강제 처분 — 구단 "개인 사안"`, "warn", "club"); } }catch(e){}
  G.dun=null;
  return {got:use, sold, left:stkDebt()};
}
/* ═══ 🩸 사채업자 방문 ═══════════════════════════════════════════════════
   ⚠ 제보 — 「무직일 때 사채를 다 안 갚고 일정을 진행하면 사채업자가 찾아오는 인카운터를 하자」.
   재직 중에는 전화로 독촉하지만(구단 사무실까지 오기엔 부담이다), 무직이면 집으로 온다.
   갚을 소득이 없으니 그들도 급해진다 — 대응에 따라 유예·폭력·강제 처분으로 갈린다. */
const DUN_GAP=24;              // 방문 간격(일)
function stkDunDue(){
  const M=me();
  if(stkDebt()<=0) return false;
  if(!G.jobless) return false;
  const days=(G.day||0)-(M.stkDebtAt||0);
  if(days<18) return false;
  if(M._dunAt!=null && (G.day||0)-M._dunAt < DUN_GAP) return false;
  return true;
}
function stkDunFire(){
  const M=me();
  M._dunAt=G.day||0;
  M._dunN=(M._dunN||0)+1;
  G.dun={n:M._dunN, d:G.day||0, amt:stkDebt()};
  return G.dun;
}
function dunSay(n){
  return n<=1 ? `"감독님. 이자가 벌써 이만큼입니다. 얼굴 뵙고 이야기하고 싶어서 왔습니다."`
       : n===2 ? `"두 번째입니다. 저희도 위에 보고를 해야 합니다."`
       : `"이제는 저희가 말로 할 수 있는 단계가 아닙니다."`;
}
/* 방문 장면 — 선택지 네 개 */
function stkDunView(){
  const M=me(), D=stkDebt()/1e8, n=(G.dun&&G.dun.n)||1;
  const it=Math.round(stkDebt()*stkDebtRate()*30)/1e8;      // 한 달 이자 상당
  const part=Math.max(0.3, Math.round(it*100)/100);
  const net=netWorth()/1e8;
  return `<h2>🩸 사채업자 방문</h2>
  <div class="card stCard" style="border-color:#f8514988">
    <div class="msg warn" style="font-size:16px">${dunSay(n)}</div>
    <p class="small" style="margin-top:9px">현관 앞에 두 사람이 서 있습니다. ${n>=3?"이번엔 웃지 않습니다.":"명함을 내밀지만 이름은 없습니다."}</p>
    <div class="stkSum" style="margin-top:8px">
      <div><span>사채 잔액</span><b style="color:#f85149">${D.toFixed(2)}억</b></div>
      <div><span>한 달 이자</span><b>${part.toFixed(2)}억</b></div>
      <div><span>보유 현금</span><b class="money">${moneyEok(M.cash)}</b></div>
      <div><span>순자산</span><b style="color:${net>=0?"var(--green)":"#f85149"}">${net.toFixed(2)}억</b></div>
    </div>
    <p class="small" style="margin-top:9px;color:var(--sub)">방문 ${n}회차 · 무직이라 월급 압류가 불가능한 상태입니다.</p>
    <div style="display:flex;flex-direction:column;gap:7px;margin-top:12px">
      <button class="mini" style="padding:11px;border-color:var(--green);color:var(--green)" onclick="stkDunPick('pay')">💵 이자만이라도 넣는다 (−${part.toFixed(2)}억)</button>
      <button class="mini" style="padding:11px;border-color:var(--gold);color:var(--gold)" onclick="stkDunPick('talk')">🗣️ 사정을 설명하고 시간을 번다</button>
      <button class="mini" style="padding:11px;border-color:#ff9d5c;color:#ff9d5c" onclick="stkDunPick('sell')">🏷️ 자산을 정리하겠다고 약속한다</button>
      <button class="mini" style="padding:11px;border-color:#f85149;color:#f85149" onclick="stkDunPick('hide')">🚪 문을 열지 않는다</button>
    </div>
  </div>`;
}
function stkDunPick(k){
  const M=me(), n=(G.dun&&G.dun.n)||1;
  const it=Math.max(0.3, Math.round(stkDebt()*stkDebtRate()*30)/1e8);
  const fx=[], soc=[];
  let body="", ok=true;
  if(k==="pay"){
    const a=Math.min(M.cash, it);
    if(a<it*0.95){
      body=`<p>지갑을 열었지만 채울 수가 없었습니다. 한 사람이 짧게 웃고 돌아섭니다.<br>
        <b>"다음엔 준비해 두십시오. 저희도 사정이 있습니다."</b></p>`;
      M._dunAt=(G.day||0)-Math.round(DUN_GAP*0.55);        // 곧 다시 온다
      fx.push("⏳ 다음 방문이 더 빨라졌습니다");
      ok=false;
    } else {
      mePay(-a, "사채 이자 납입");
      M.stkDebt=Math.max(0, stkDebt()-Math.round(a*1e8*0.55));   // 이자 + 원금 일부
      body=`<p>현금을 세어 건넸습니다. 두 사람은 고개를 끄덕이고 돌아섭니다.<br>
        <b>"이렇게만 해 주시면 저희도 조용히 갑니다."</b></p>`;
      fx.push(`💵 ${a.toFixed(2)}억 납입 — 잔액 <b>${(stkDebt()/1e8).toFixed(2)}억</b>`);
      fx.push("⏳ 다음 방문까지 여유가 생겼습니다");
    }
  } else if(k==="talk"){
    let rep0=40; try{ rep0=mgrRep(); }catch(e){}
    const p=clamp(0.30+(rep0-30)/100*0.5-(n-1)*0.12, 0.08, 0.72);
    if(Math.random()<p){
      M._dunAt=(G.day||0)+Math.round(DUN_GAP*0.6);
      body=`<p>한참을 서서 이야기했습니다. 결국 한 사람이 손목시계를 보고 말합니다.<br>
        <b>"한 달만 더 봅니다. 그때는 이 이야기 안 합니다."</b></p>`;
      fx.push("⏳ 한 달 유예를 받았습니다");
    } else {
      body=`<p>말이 끝나기 전에 문틀을 잡는 손이 보였습니다. 밀치고 들어오지는 않았지만,
        나가면서 현관에 있던 화분이 넘어갔습니다.<br><b>"말은 다 들었습니다. 다음에 뵙죠."</b></p>`;
      try{ if(typeof mgrInjure==="function") mgrInjure(1, "사채업자와의 실랑이"); }catch(e){}
      fx.push("😖 실랑이 — 다음 방문이 더 험해집니다");
      ok=false;
    }
  } else if(k==="sell"){
    M._dunPromise={due:(G.day||0)+30, need:Math.round(stkDebt()*0.5), amt0:stkDebt()};
    M._dunAt=(G.day||0)+30-DUN_GAP;
    body=`<p>부동산과 주식을 정리해 절반을 갚겠다고 약속했습니다. 한 사람이 수첩에 날짜를 적습니다.<br>
      <b>"${dateLabel((G.day||0)+30)}. 적었습니다."</b></p>`;
    fx.push(`📝 30일 안에 <b>${(M._dunPromise.need/1e8).toFixed(2)}억</b>을 갚기로 약속`);
    fx.push("⚠ 못 지키면 자산이 강제로 처분됩니다");
  } else {
    const add=Math.round(stkDebt()*0.06);
    M.stkDebt=stkDebt()+add;
    M._dunAt=(G.day||0)-Math.round(DUN_GAP*0.4);
    body=`<p>인터폰을 끄고 숨을 죽였습니다. 한동안 문을 두드리는 소리가 이어졌습니다.<br>
      돌아갔지만, 다음 날 우편함에 종이 한 장이 꽂혀 있었습니다.</p>`;
    fx.push(`🩸 「방문비」가 붙었습니다 — 잔액 <b>${(stkDebt()/1e8).toFixed(2)}억</b> (+${(add/1e8).toFixed(2)})`);
    fx.push("⏳ 곧 다시 옵니다");
    try{ if(Math.random()<0.5){ stkSocial("debt"); soc.push("💬 동네에 이야기가 돌기 시작했습니다."); } }catch(e){}
    ok=false;
  }
  G.dun=null;
  try{ stkLog("debt", `🩸 사채업자 방문 ${n}회차 — ${({pay:"이자 납입",talk:"사정 설명",sell:"자산 정리 약속",hide:"문을 열지 않음"})[k]}`); }catch(e){}
  try{ saveGame(); }catch(e){}
  VIEW="home";
  $("#main").innerHTML=`<h2>🩸 사채업자 방문 ${n}회차</h2>
  <div class="card stCard" style="border-color:${ok?"#d2992288":"#f8514988"}">
    ${body}
    ${fx.length?`<div class="msg ${ok?"info":"warn"}" style="margin-top:10px">${fx.join("<br>")}</div>`:""}
    ${soc.length?`<div class="small" style="margin-top:8px;opacity:.85">${soc.join("<br>")}</div>`:""}
    <button class="bigbtn" style="max-width:260px;margin-top:14px" onclick="show('home')">확인 ▶</button>
  </div>`;
  window.scrollTo(0,0);
}
/* 💬 파산·사채가 알려졌을 때의 반응 — 팬들은 성적보다 이 이야기를 더 오래 한다 */
const STK_SOC={
  debt:["감독이 사채 썼다는 소문 진짜냐;;","경기 준비나 하시지 무슨 주식이야",
        "우리 감독 빚쟁이설 ㅋㅋㅋ 이게 맞나","돈 문제 있는 사람한테 이적 자금 맡겨도 되나",
        "선수들 앞에서 무슨 낯으로 서시려고","사채는 진짜 선 넘었다","감독님 제발 축구만 하세요",
        "구단 이미지 다 깎아먹네","이러다 승부조작 얘기까지 나온다 진짜"],
  bank:["감독 파산했대 ㅋㅋㅋㅋㅋ 실화냐","전 재산 날렸다는데 멘탈 괜찮으신지",
        "주식하다 망한 감독이라니 리그 망신이다","선수단 사기 어떡하냐 이거",
        "돈 관리도 못 하는 사람이 스쿼드 관리를 하겠냐","구단은 뭐 하고 있었나",
        "솔직히 동정은 안 간다 본인이 지른 거잖아","이 와중에 경기는 해야 하고... 하...",
        "감독 바꿔야 되는 거 아니냐 진심으로","파산 감독이라는 별명 평생 따라다니겠네",
        "그래도 사람은 살고 봐야지... 팀은 어쩌나"],
  back:["감독님 빚 다 갚으셨다더라 다행이다","이제 축구에만 집중하시길",
        "돌아오는 데 몇 년 걸렸네 진짜","그래도 버틴 게 어디냐"]
};
const STK_FMK={
  bank:[["{t} 감독 개인 파산했다는데 이거 실화임?",-1],["주식하다 망한 감독 ㄷㄷ",-1],
        ["구단이 감독 관리 안 하냐",-1],["솔직히 이 정도면 경질 사유 아님?",-1],
        ["남 일 같지 않다... 나도 물려있음",0],["감독 파산 vs 우리 팀 순위 뭐가 더 심각함",0],
        ["레버리지 쓰다 훅 갔다던데",-1],["프런트는 알고 있었을까",0]],
  debt:[["{t} 감독 사채설 도는데 진짜냐",-1],["이거 사실이면 구단 이미지 끝인데",-1],
        ["감독이 돈 빌리러 다닌다는 소리까지 나옴",-1],["찌라시겠지... 아니면 큰일인데",0]]
};
function stkSocial(kind){
  try{
    const t=userTeam(); if(!t) return;
    const V={t:t.short, n:t.name};
    if(STK_SOC[kind]) socialFill(STK_SOC[kind], kind==="bank"?4+R(3):2+R(2), kind==="back"?1:-1, V);
    if(STK_FMK[kind]) fmkFill(STK_FMK[kind], kind==="bank"?4:2, V);
    if(kind==="bank") fmkFill([[`{t} 감독 파산이라니 ㅋㅋ 우리는 그래도 저 정도는 아님`,1],
                               [`남의 팀 일이지만 좀 안됐다`,0]], 2, V, "rival");
  }catch(e){}
}
/* ── 💀 파산 뒤에 남는 것들 ─────────────────────────────────
   재산만 날아가고 끝나면 「한 번 크게 지르고 다시 시작」이 최적 전략이 된다.
   실제 파산은 그 뒤 몇 년이 더 무겁다 — 신용이 막히고, 월급이 압류되고, 이름에 낙인이 남는다. */
const STK_BK_YEARS=2;      // 신용불량 기간(시즌)
function stkBadCredit(){    // 아직 신용불량인가
  const M=me();
  if(!M.bankruptAt) return false;
  return (G.season - M.bankruptAt) < STK_BK_YEARS;
}
function stkBadCreditLeft(){
  const M=me();
  if(!M.bankruptAt) return 0;
  return Math.max(0, STK_BK_YEARS-(G.season-M.bankruptAt));
}
/* 위신에 남는 낙인 — 시간이 지나면 옅어진다 */
function stkBankMark(){
  const M=me();
  if(!M.bankruptAt) return 0;
  const yr=G.season-M.bankruptAt;
  const base=14+((M.bankrupt||1)-1)*6;              // 두 번째 파산부터는 더 무겁다
  return -Math.max(0, Math.round((base*Math.max(0, 1-yr/4))*10)/10);
}
/* 💀 파산 — 주식·현금이 전부 넘어가고, 감독으로서의 신용도 무너진다 */
function stkBankrupt(){
  const M=me();
  const t=userTeam();
  const lost=stkEval();
  const propN=(M.props||[]).length;
  /* 보유 주식 전량 청산 + 현금 압류 */
  M.stkInv={}; M.short={}; M.fut=null;
  try{ (stkState().orders||[]).length=0; }catch(e){}
  /* 최소 생활비는 남긴다 — 0원이면 이사도 소송도 아무것도 못 해 게임이 잠긴다 */
  M.cash=0.5; M.stkLoan=0; M.stkDebt=0; M.stkDebtAt=null; M._debtWarn=0;
  if(M.homeOwn){ M.homeOwn=false; M.home="gosi"; }      // 자가도 넘어간다 — 고시원으로
  M.hml=0; M.pln=0;
  /* 🏦 예금은 채권자에게 넘어간다 — 다만 예금자보호 한도(은행당 0.5억)만큼은 남는다.
     완전히 0원이 되면 재기할 방법이 없다. 실제 제도와도 맞다. */
  try{
    const B=bank();
    let saved=0;
    const byBank={};
    for(const A of (B.acc||[])) byBank[A.bk]=(byBank[A.bk]||0)+A.bal;
    for(const bk in byBank) saved += Math.min(bankDef(bk).safe||0, byBank[bk]);
    saved=Math.round(saved*100)/100;
    B.acc=[]; B.loan=[];
    B.score=clamp(Math.min(B.score||700, 480), 300, 1000);
    if(saved>0){
      M.cash=Math.round((M.cash+saved)*100)/100;
      B.hist.unshift({d:G.day||0, t:`🛟 예금자보호 — 은행별 한도만큼 <b>${saved}억</b>을 지켰습니다`});
    }
    B.hist.unshift({d:G.day||0, t:"💀 개인 파산 — 예·적금과 대출이 모두 정리되었습니다"});
  }catch(e){}
  M.bankrupt=(M.bankrupt||0)+1;
  M.bankruptAt=G.season;
  M.wageGarnish=1;                                   // 월급 압류 — 다음 시즌까지
  /* 부동산도 넘어간다 — 사는 집만 남는다 */
  try{ if(Array.isArray(M.props)) M.props.length=0; }catch(e){}
  stkLog("bank", `💀 개인 파산 — 주식·부동산이 전부 처분되고 ${STK_BK_YEARS}시즌간 신용거래가 막힙니다`);
  addNews(`💀 [속보] ${t?t.short:""} 감독, <b>개인 파산</b> — 주식 투자 실패로 재산 전액 처분${propN?` (부동산 ${propN}건 포함)`:""}`, "warn", "stock", {cat:"stock", ic:"📈", src:"증권가"});
  try{ notifyStk(`💀 <b>파산했습니다.</b><br>· 주식·부동산 전액 처분<br>· 예금은 <b>예금자보호 한도</b>만 남습니다<br>· <b>${STK_BK_YEARS}시즌간 신용융자·사채·은행대출 불가</b><br>· 월급 30% 압류<br>· 감독 위신 급락 — 영입 설득력과 재계약에 영향`,"warn"); }catch(e){}
  try{ adjustTrust("owner", -22, "감독 개인 파산"); }catch(e){}
  try{ adjustTrust("fans", -14, "감독 개인 파산"); }catch(e){}
  try{ sponScandal("감독 개인 파산", 3); }catch(e){}
  try{ G.press.rel=clamp((G.press.rel||50)-10, 0, 100); }catch(e){}
  /* 라커룸도 흔들린다 — 돈 문제로 시끄러운 감독을 선수들이 편히 볼 리 없다 */
  try{
    for(const p of (t.players||[])) affSet(p, clamp(aff(p)-6, 0, 100));
    addMood(`💀 감독의 파산 소식이 라커룸에도 들어왔습니다. 선수들이 술렁입니다.`);
  }catch(e){}
  try{ meLog(`💀 개인 파산 — 전 재산 처분 (주식 평가액 ${(lost/1e8).toFixed(2)}억)`); }catch(e){}
  try{ stkSocial("bank"); }catch(e){}
  /* 🎙️ 다음 기자회견에서 반드시 물어본다 */
  G.stkAsk={k:"bank", s:G.season, d:G.day||0, asked:0};
}
/* ═══════════════════════════════════════════════════════════════════════════
   📉 공매도 — 빌려서 먼저 팔고, 싸질 때 되산다
   오르면 손실이 끝없이 불어난다. 급등하면 숏스퀴즈로 강제 청산된다.
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_SH_MARGIN=1.40;   // 필요 증거금 = 매도 대금의 140%
const STK_SH_FEE   =0.00035;// 대여 수수료 일 0.035% (연 12.8% — 빌려서 파는 값은 원래 비싸다)
const STK_SH_CALL  =1.15;   // 증거금 유지 비율 — 이 아래면 강제 청산
function stkShorts(){ const M=me(); if(!M.short) M.short={}; return M.short; }
function stkShortList(){
  const S=stkShorts(), out=[];
  for(const k in S){ const h=S[k]; if(!h||!h.q) continue;
    const s=stkById(+k); if(!s) continue; out.push({s, q:h.q, avg:h.avg}); }
  return out.sort((a,b)=>(b.q*b.s.p)-(a.q*a.s.p));
}
function stkShortVal(){ return stkShortList().reduce((n,h)=>n+h.q*h.s.p, 0); }        // 되사는 데 드는 돈
function stkShortPL(){ return stkShortList().reduce((n,h)=>n+(h.avg-h.s.p)*h.q, 0); } // 평가손익
/* 공매도 계좌의 증거금 여력 */
function stkShortRoom(){
  return stkEquity() - stkShortVal()*STK_SH_MARGIN;   /* ⚠ 매도 대금으로 또 공매도하지 못하게 */
}
function stkShortOpen(){
  if(fssFrozen()){ flash("🚨 금융감독원 조사로 계좌가 동결되어 공매도를 할 수 없습니다.","warn"); return; }
  if(stkBadCredit()){ flash(`파산 이력으로 신용거래(공매도)가 막혀 있습니다 — ${stkBadCreditLeft()}시즌 남음.`,"warn"); return; }
  const s=stkById(STK_SEL); if(!s||s.dead) return;
  const q=parseInt(STK_QTY,10)||0;
  if(q<=0){ flash("수량을 입력하세요.","warn"); return; }
  const M=me();
  const F=stkFillPx(s, q, -1);                  // 💥 던지는 만큼 값이 흘러내린다
  const gross=q*F.px, need=gross*STK_SH_MARGIN;
  if(need > stkShortRoom()){
    flash(`증거금이 부족합니다 — ${stkMoney(need)} 필요 (매도 대금의 ${Math.round(STK_SH_MARGIN*100)}%)`,"warn"); return;
  }
  const net=gross*(1-STK_FEE-STK_TAX);
  stkCash(net);
  const H=stkShorts();
  const h=H[s.id]||{q:0, avg:0};
  h.avg=Math.round((h.avg*h.q + F.px*q)/(h.q+q)); h.q+=q;
  H[s.id]=h;
  stkPushMom(s, -1, F.imp);
  stkTxAdd({k:"short", sid:s.id, n:s.n, q, px:F.px, amt:net});
  try{ meLog(`📉 ${s.n} ${q.toLocaleString()}주 공매도 (@${stkWon(F.px)} · ${stkMoney(net)})`); }catch(e){}
  STK_QTY=""; saveGame(); show("mylife");
}
function stkShortCover(){
  const s=stkById(STK_SEL); if(!s) return;
  /* 🔒 폐지 종목은 폐지 시점에 이미 정산됐다 — 1원 커버로 이익을 만들 수 없다 */
  if(s.dead){ flash("상장폐지 종목은 폐지 시점에 이미 정산되었습니다.","warn"); return; }
  const M=me(), H=stkShorts();
  const h=H[s.id]; if(!h||!h.q){ flash("공매도 잔고가 없습니다.","warn"); return; }
  let q=parseInt(STK_QTY,10)||0;
  if(q<=0||q>h.q){ flash(`공매도 잔고는 ${h.q.toLocaleString()}주입니다.`,"warn"); return; }
  const F=stkFillPx(s, q, +1);                  // 💥 되사는 물량이 값을 밀어 올린다
  const cost=q*F.px*(1+STK_FEE);
  if(cost > M.cash*1e8){ flash(`현금이 부족합니다 — ${stkMoney(cost)} 필요`,"warn"); return; }
  const real=(h.avg-F.px)*q;
  stkCash(-cost);
  M.stkReal=Math.round(((M.stkReal||0)+real/1e8)*1e4)/1e4;
  h.q-=q; if(h.q<=0) delete H[s.id];
  taxOnRealize(s, q, real, "공매도 청산");       // 🧾 공매도 차익도 같은 세금을 낸다
  fssHeat(s, F.imp, cost);
  stkPushMom(s, +1, F.imp);
  stkTxAdd({k:"cover", sid:s.id, n:s.n, q, px:F.px, amt:cost, real});
  try{ meLog(`📈 ${s.n} ${q.toLocaleString()}주 숏커버 (실현 ${real>=0?"+":""}${(real/1e8).toFixed(2)}억)`); }catch(e){}
  STK_QTY=""; saveGame(); show("mylife");
}
/* 매일 — 대여 수수료 · 숏스퀴즈 강제 청산 */
function stkShortTick(){
  const M=me();
  const L=stkShortList(); if(!L.length) return;
  /* 대여 수수료
     ⚠ 감사 — 잔고를 보지 않고 그냥 빼서 <b>현금이 음수로 내려갔다</b>(실측 −49.5억).
        파산 처리도 없이 마이너스 통장이 되는 셈이라, 손실을 무한히 미룰 수 있었다.
     ─ 낼 수 있는 만큼만 내고, 모자라면 그 자리에서 <b>강제 상환</b>으로 현금을 만든다. */
  const fee=Math.round(stkShortVal()*STK_SH_FEE);
  if(fee>0){
    const have=Math.max(0, Math.round(M.cash*1e8));
    const pay=Math.min(fee, have);
    if(pay>0){ stkCash(-pay); M.stkShFee=Math.round(((M.stkShFee||0)+pay/1e8)*1e8)/1e8; }
    let owe=fee-pay, guard0=0;
    while(owe>0 && guard0++<20){
      const L2=stkShortList(); if(!L2.length) break;
      const h2=L2[0], s2=h2.s;
      if(s2.dead) break;
      const need=Math.min(h2.q, Math.max(1, Math.ceil(owe/Math.max(1,s2.p))*3));
      let px=Math.max(1, s2.p), cost=need*px*(1+STK_FEE);
      const canQ=Math.floor((Math.max(0,me().cash*1e8))/Math.max(1, px*(1+STK_FEE)));
      if(canQ<=0) break;                        // 현금이 없으면 여기서 멈춘다 (음수 금지)
      const need2=Math.min(need, canQ);
      cost=need2*px*(1+STK_FEE);
      const real=(h2.avg-px)*need2;
      stkCash(-cost);
      M.stkReal=Math.round(((M.stkReal||0)+real/1e8)*1e8)/1e8;
      try{ taxOnRealize(s2, need2, real, "강제 상환"); }catch(e){}
      const H2=stkShorts(); const hh=H2[s2.id];
      if(hh){ hh.q-=need2; if(hh.q<=0) delete H2[s2.id]; }
      try{ stkTxAdd({k:"cover", sid:s2.id, n:s2.n, q:need2, px, amt:cost, real}); }catch(e){}
      try{ stkLog("call", `🔨 <b>${s2.n}</b> 대여 수수료 미납으로 ${need.toLocaleString()}주 강제 상환`, s2.id); }catch(e){}
      const have2=Math.max(0, Math.round(M.cash*1e8));
      const pay2=Math.min(owe, have2);
      if(pay2>0){ stkCash(-pay2); owe-=pay2; } else break;
    }
    if(M.cash<0) M.cash=0;                     // 마지막 안전망 — 증권 계좌 현금은 음수가 되지 않는다
  }
  /* 🚀 숏스퀴즈 — 공매도가 몰린 종목이 급등하면 되사기가 되사기를 부른다 */
  for(const h of L){
    const s=h.s;
    if(s.dead) continue;
    const up=(s.p-h.avg)/h.avg;
    if(up>0.22 && Math.random()<0.16){
      const k=clamp(STK_TIER[s.tier].vol/0.025, 0.6, 2.4);
      s.mom += (0.030+Math.random()*0.050)*k;
      stkLog("squeeze", `🚀 <b>${s.n}</b> 숏스퀴즈 — 공매도 물량이 몰리며 급등`, s.id);
      try{ notifyStk(`🚀 <b>${s.n}</b>에 숏스퀴즈가 걸렸습니다. 공매도 손실이 커집니다.`,"warn"); }catch(e){}
    }
  }
  /* 증거금 부족 → 강제 청산 */
  let guard=0;
  while(guard++<40){
    const cover=stkShortVal();
    if(cover<=0) break;
    const equity=me().cash*1e8 + stkEval();
    if(equity >= cover*STK_SH_CALL) break;
    const list=stkShortList(); if(!list.length) break;
    const h=list[0], s=h.s;
    /* 💰 ⚠ 감사 — 되사는 값을 현금에서 그냥 뺐다. 현금보다 비싸면 <b>계좌가 음수</b>가 됐다(실측 −49.5억).
       ─ 먼저 보유 주식을 팔아 현금을 만들고, 그래도 모자라면 <b>살 수 있는 만큼만</b> 되산다. */
    let q=Math.max(1, Math.ceil(h.q*0.4));
    let _F=stkFillPx(s, q, +1);
    let cost=q*_F.px*(1+STK_FEE);
    if(cost > me().cash*1e8){
      /* ① 보유 주식을 팔아 현금을 만든다 (평가액이 큰 것부터) */
      let g2=0;
      while(cost > me().cash*1e8 && g2++<20){
        const hv=stkHeld().filter(x=>!x.s.dead && x.q>0);
        if(!hv.length) break;
        const hh=hv[0], s2=hh.s;
        const need2=Math.min(hh.q, Math.max(1, Math.ceil((cost - me().cash*1e8)/Math.max(1,s2.p))));
        const net2=need2*s2.p*(1-STK_FEE-STK_TAX);
        const real2=(s2.p-hh.avg)*need2;
        stkCash(net2);
        const _hq2=(M.stkInv[s2.id]||{q:0}).q;
        M.stkReal=Math.round(((M.stkReal||0)+real2/1e8)*1e8)/1e8;
        const hx=M.stkInv[s2.id]; hx.q-=need2; if(hx.q<=0) delete M.stkInv[s2.id];
        try{ taxOnRealize(s2, _hq2, real2, "증거금 충당 매도"); }catch(e){}
        try{ stkTxAdd({k:"call", sid:s2.id, n:s2.n, q:need2, px:s2.p, amt:net2, real:real2}); }catch(e){}
      }
      /* ② 그래도 모자라면 되살 수 있는 수량으로 줄인다 */
      if(cost > me().cash*1e8){
        const canQ=Math.floor((me().cash*1e8)/Math.max(1, _F.px*(1+STK_FEE)));
        if(canQ<=0) break;                      // 한 주도 못 산다 — 다음 날로 넘긴다
        q=Math.min(q, canQ); _F=stkFillPx(s, q, +1); cost=q*_F.px*(1+STK_FEE);
        if(cost > me().cash*1e8) break;
      }
    }
    const real=(h.avg-_F.px)*q;
    stkPushMom(s, +1, _F.imp);
    stkCash(-cost);
    M.stkReal=Math.round(((M.stkReal||0)+real/1e8)*1e8)/1e8;
    try{ taxOnRealize(s, q, real, "공매도 강제 청산"); }catch(e){}
    const H=stkShorts(); H[s.id].q-=q; if(H[s.id].q<=0) delete H[s.id];
    stkTxAdd({k:"shcall", sid:s.id, n:s.n, q, px:_F.px, amt:cost, real});
    if(guard===1){
      stkLog("call", `🔨 공매도 증거금 부족 — <b>${s.n}</b> 강제 숏커버`, s.id);
      try{ notifyStk(`🔨 <b>공매도 강제 청산</b> — ${s.n} 되사기가 실행됐습니다. 손실이 확정됩니다.`,"warn"); }catch(e){}
    }
  }
  if(me().cash<0) me().cash=0;      // 🔒 증권 계좌 현금은 어떤 경로로도 음수가 되지 않는다
}

/* ═══════════════════════════════════════════════════════════════════════════
   📊 지수 · 선물 — 증거금 10%, 사실상 10배 레버리지
   지수가 1% 움직이면 내 돈은 10% 움직인다. 만기가 있고, 증거금이 모자라면 청산된다.
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_FUT_MULT =250000;   // 1계약 = 지수 × 25만원
const STK_FUT_MARGIN=0.10;    // 증거금률 10%
const STK_FUT_CALL =0.06;     // 유지 증거금 6% — 아래로 내려가면 강제 청산
const STK_FUT_FEE  =0.00003;  // 계약 체결 수수료
/* 지수 — 시가총액 가중. 시작일을 1000 으로 잡는다. */
function stkIndex(){
  const S=stkState(); if(!S) return 1000;
  let cap=0, base=0;
  for(const s of S.list){
    if(s.dead) continue;
    cap += s.p*s.sh;
    base += (s.hist&&s.hist.length?s.hist[0]:s.p)*s.sh;
  }
  if(base<=0) return 1000;
  return Math.round(cap/base*1000*100)/100;
}
function stkIdxHist(){
  const S=stkState(); if(!S) return [];
  if(!Array.isArray(S.idx)) S.idx=[];
  return S.idx;
}
function stkFut(){ const M=me(); if(!M.fut) M.fut=null; return M.fut; }
/* 미실현 손익(원) — 롱은 오르면 이익, 숏은 내리면 이익 */
function stkFutPL(){
  const F=stkFut(); if(!F) return 0;
  const idx=stkIndex();
  return Math.round((idx-F.entry)*F.q*STK_FUT_MULT*(F.side==="long"?1:-1));
}
function stkFutMargin(){ const F=stkFut(); return F ? F.margin : 0; }
function stkFutEquity(){ return stkFutMargin()+stkFutPL(); }             // 선물 계좌 잔고
function stkFutRatio(){
  const F=stkFut(); if(!F) return null;
  const notion=stkIndex()*F.q*STK_FUT_MULT;
  return notion>0 ? stkFutEquity()/notion : null;
}
function stkFutOpen(side){
  const M=me();
  if(stkBadCredit()){ flash(`파산 이력으로 파생상품 거래가 막혀 있습니다 — ${stkBadCreditLeft()}시즌 남음.`,"warn"); return; }
  if(stkFut()){ flash("이미 보유한 선물 포지션이 있습니다. 먼저 청산하세요.","warn"); return; }
  const q=parseInt(STK_FQ,10)||0;
  if(q<=0){ flash("계약 수를 입력하세요.","warn"); return; }
  const idx=stkIndex();
  const notion=idx*q*STK_FUT_MULT;
  const need=Math.round(notion*STK_FUT_MARGIN + notion*STK_FUT_FEE);
  if(need > M.cash*1e8){ flash(`증거금이 부족합니다 — ${stkMoney(need)} 필요 (보유 ${moneyEok(M.cash)})`,"warn"); return; }
  stkCash(-need);
  /* 만기 — 분기(90일) 경계 */
  const d=G.day||0, due=Math.ceil((d+1)/90)*90;
  M.fut={side, q, entry:idx, margin:Math.round(notion*STK_FUT_MARGIN), at:d, due};
  stkTxAdd({k:"fut", n:`지수선물 ${side==="long"?"매수":"매도"}`, q, px:Math.round(idx), amt:need});
  stkLog("fut", `📊 지수선물 ${side==="long"?"매수":"매도"} ${q}계약 — 지수 ${idx.toFixed(2)} · 증거금 ${stkMoney(need)} (만기 D-${due-d})`);
  try{ meLog(`📊 지수선물 ${side==="long"?"롱":"숏"} ${q}계약 @${idx.toFixed(2)}`); }catch(e){}
  STK_FQ=""; saveGame(); show("mylife");
}
function stkFutClose(why){
  const M=me(), F=stkFut(); if(!F) return;
  const idx=stkIndex();
  const pl=stkFutPL();
  const back=Math.max(0, F.margin+pl);
  stkCash(back);
  M.stkReal=Math.round(((M.stkReal||0)+pl/1e8)*1e4)/1e4;
  M.fut=null;
  stkTxAdd({k:"futclose", n:`지수선물 청산${why?" ("+why+")":""}`, q:F.q, px:Math.round(idx), amt:back, real:pl});
  const tag=why==="만기" ? "📅 만기 청산" : why==="강제" ? "🔨 증거금 부족 강제 청산" : "📊 선물 청산";
  stkLog(pl>=0?"good":"bad", `${tag} — ${F.side==="long"?"매수":"매도"} ${F.q}계약 · 지수 ${F.entry.toFixed(2)}→${idx.toFixed(2)} · 손익 <b>${pl>=0?"+":""}${(pl/1e8).toFixed(2)}억</b>`);
  try{ meLog(`📊 지수선물 청산 ${pl>=0?"+":""}${(pl/1e8).toFixed(2)}억`); }catch(e){}
  if(why) try{ notifyStk(`${tag} — 손익 <b>${pl>=0?"+":""}${(pl/1e8).toFixed(2)}억</b>`, pl>=0?"good":"warn"); }catch(e){}
  if(!why){ saveGame(); show("mylife"); }
}
function stkFutTick(){
  const S=stkState(); if(!S) return;
  /* 지수 기록 */
  const I=stkIdxHist();
  I.push(stkIndex());
  if(I.length>120) I.splice(0, I.length-120);
  const F=stkFut(); if(!F) return;
  const d=G.day||0;
  if(d>=F.due){ stkFutClose("만기"); return; }
  const r=stkFutRatio();
  if(r!=null && r<STK_FUT_CALL){ stkFutClose("강제"); return; }
  if(r!=null && r<STK_FUT_CALL+0.025 && !me()._futWarn){
    me()._futWarn=1;
    try{ notifyStk(`⚠️ 선물 증거금이 <b>${(r*100).toFixed(1)}%</b>입니다 — ${(STK_FUT_CALL*100).toFixed(0)}% 아래면 강제 청산됩니다.`,"warn"); }catch(e){}
  } else if(r!=null && r>STK_FUT_CALL+0.05) me()._futWarn=0;
}
/* ═══════════════════════════════════════════════════════════════════════════
   🎪 테마주 광풍 — 갑자기 한 테마가 뜨고, 다 같이 오르고, 다 같이 무너진다
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_THEMES=[
  {n:"AI 반도체",     s:["elec","game"],        w:1.4},
  {n:"2차전지",       s:["auto","chem","ener"], w:1.5},
  {n:"바이오 신약",   s:["bio","med"],          w:1.6},
  {n:"우주항공",      s:["air","elec"],         w:1.3},
  {n:"원자력",        s:["ener","steel","cons"],w:1.2},
  {n:"메타버스",      s:["game","ent","tel"],   w:1.7},
  {n:"친환경 에너지", s:["ener","chem"],        w:1.3},
  {n:"K-콘텐츠",      s:["ent","game"],         w:1.4},
  {n:"로봇",          s:["elec","auto"],        w:1.4},
  {n:"방산",          s:["steel","air","ship"], w:1.2}
];
function stkThemeTick(){
  const S=stkState(); if(!S) return;
  const T=S.theme;
  if(T){
    const age=(G.day||0)-T.d;
    /* 달아오르는 구간 → 식는 구간 → 폭락 */
    const live=S.list.filter(s=>!s.dead && T.s.indexOf(s.sec)>=0);
    if(age<T.up){
      for(const s of live) s.mom += 0.0030*T.w*(0.6+Math.random()*0.9);
    } else if(age<T.up+T.dn){
      for(const s of live) s.mom -= 0.0058*T.w*(0.6+Math.random()*0.9);
      /* ⚠ 꺾이는 순간을 알려 주면 그게 매도 신호가 된다 — 실측 결과 이 공지 하나로
         「발표에 사서 공지에 판다」가 승률 98%짜리 무위험 전략이 됐다.
         실제 시장은 꺾인 걸 한참 뒤에야 기사로 알려 준다. */
      if(age===T.up+Math.ceil(T.dn*0.5)){
        stkLog("theme", `🎪 <b>${T.n}</b> 테마 급락 — 며칠째 차익 실현 물량이 쏟아지고 있습니다`);
        try{ notifyStk(`🎪 <b>${T.n}</b> 테마가 이미 꺾였습니다. 고점 대비 많이 내려왔습니다.`,"warn"); }catch(e){}
      }
    } else {
      stkLog("theme", `🎪 ${T.n} 테마 종료 — 광풍이 지나갔습니다`);
      S.theme=null;
    }
    return;
  }
  /* 새 테마 — 40일에 한 번쯤 */
  if(Math.random()<0.025){
    const t=pick(STK_THEMES);
    /* 남은 상승 기간을 짧고 들쭉날쭉하게 — 언제 꺾일지 알 수 없어야 도박이다 */
    S.theme={n:t.n, s:t.s, w:t.w, d:G.day||0, up:1+Math.floor(Math.random()*8), dn:8+Math.floor(Math.random()*11)};
    /* 🫧 기사가 나올 때는 이미 오른 뒤다 — 뉴스를 보고 들어가면 그만큼 비싸게 산다.
       ⚠ mom 으로 얹으면 다음 날 반영이라 「기사 보고 오늘 종가에 사기」가 그대로 공짜가 된다.
          오늘 종가 자체를 끌어올려야 뉴스와 값이 같은 날에 맞는다. */
    for(const s of S.list){
      if(s.dead || t.s.indexOf(s.sec)<0) continue;
      const j=(0.075+Math.random()*0.105)*t.w;
      s.p=Math.max(1, Math.round(s.p*(1+j)));
      s.hi=Math.max(s.hi||s.p, s.p);
      if(Array.isArray(s.hist) && s.hist.length) s.hist[s.hist.length-1]=s.p;
      if(Array.isArray(s.ohlc) && s.ohlc.length){ const c=s.ohlc[s.ohlc.length-1]; c[3]=s.p; c[1]=Math.max(c[1], s.p); }
    }
    stkLog("theme", `🎪 <b>${t.n}</b> 테마 급부상 — ${t.s.map(k=>(STK_SECTOR[k]||{}).n).join("·")} 업종 일제히 강세`);
    try{ notifyStk(`🎪 <b>${t.n}</b> 테마가 뜨고 있습니다 — ${t.s.map(k=>(STK_SECTOR[k]||{}).n).join("·")} 업종이 들썩입니다.`,"info"); }catch(e){}
  }
}
/* ═══════════════════════════════════════════════════════════════════════════
   🆕 IPO — 신규 상장. 청약하고, 경쟁률에 따라 배정받고, 상장일에 시초가가 정해진다
   ═══════════════════════════════════════════════════════════════════════════ */
const STK_IPO_NAMES=["넥스트","퓨처","하이","그린","블루","스마트","코어","프라임","알파","제니스",
                     "루미","오르비","시그마","델타","노바","비전","엣지","퀀텀","젠","에코"];
const STK_IPO_TAIL=["테크","바이오","소재","에너지","로보틱스","네트웍스","팜","엔터","모빌리티","솔루션"];
function stkIpo(){ const S=stkState(); return S ? S.ipo : null; }
function stkIpoTick(){
  const S=stkState(); if(!S) return;
  const P=S.ipo;
  if(P){
    /* 💸 ⚠ 제보 원문 — 「주식 공모에 엄청 넣어놨는데 365일 기한이고 날짜가 지나면 똑같은게
       다시 365일 리셋입니다ㅜㅜ 처분할 방법 없나요?」.
       원인 — 청약 마감일·상장일을 「G.day + 5 / +9」라는 절대 날짜로 박아 뒀다. G.day 는
         시즌이 바뀔 때마다 0 으로 되돌아가는 값이다. 시즌 막바지에 뜬 공모는 새 시즌이
         열리는 순간 마감일이 350일쯤 앞으로 튀어, 영영 마감도 상장도 되지 않았다.
         증거금은 묶이고, S.ipo 가 비지 않으니 새 공모도 뜨지 않았다(감독 부상 55주 버그와 같은 뿌리).
       ─ 남은 일수를 들고 하루씩 줄인다. 달력이 새로 깔려도 흔들리지 않는다. */
    if(P.closeIn==null || P.listIn==null){
      const d0=G.day||0;
      P.closeIn=Math.max(0, (P.close||0)-d0);
      P.listIn =Math.max(0, (P.list ||0)-d0);
      /* 시즌을 넘겨 얼어붙어 있던 공모는 즉시 진행시켜 묶인 증거금을 풀어 준다 */
      if(P.s!=null && P.s!==G.season){ P.closeIn=0; P.listIn=Math.min(P.listIn, 3); }
      try{ delete P.close; delete P.list; }catch(e){}
    }
    P.closeIn=Math.max(0,(P.closeIn|0)-1);
    P.listIn =Math.max(0,(P.listIn |0)-1);
    /* ⚠ 반드시 마감(배정)이 먼저다 — 상장이 먼저 돌면 배정도 환불도 없이 증거금이 사라진다 */
    if(P.closeIn<=0 && !P.done){                      // 청약 마감 → 배정
      P.done=1;
      P.rate=Math.round(40+Math.random()*Math.random()*1400);   // 경쟁률
      if(P.want>0){
        const got=Math.max(0, Math.floor(P.want/Math.max(1,P.rate/100)));
        P.got=got;
        const M=me();
        const use=got*P.px, back=P.want*P.px-use;
        stkCash(back);   // 못 받은 청약증거금 환불
        stkLog("ipo", `🆕 ${P.n} 공모 청약 마감 — 경쟁률 <b>${P.rate.toLocaleString()}:1</b> · 배정 ${got.toLocaleString()}주 (환불 ${stkMoney(back)})`);
        try{ notifyStk(`🆕 <b>${P.n}</b> 청약 경쟁률 ${P.rate.toLocaleString()}:1 — ${got.toLocaleString()}주 배정, ${stkMoney(back)} 환불`,"info"); }catch(e){}
      } else {
        P.got=0;
        stkLog("ipo", `🆕 ${P.n} 공모 청약 마감 — 경쟁률 ${P.rate.toLocaleString()}:1`);
      }
    }
    if(P.listIn<=0 && P.done){                        // 상장일
      /* 공모가 대비 시초가 — 청약 경쟁률이 높을수록 뜨겁다 */
      /* ⚠ 경쟁률만 보고 청약하면 무조건 남는 장사였다 — 실제 공모주는 반토막도 흔하다 */
      const heat=clamp(P.rate/900, 0.15, 1.6);
      const open=Math.round(P.px*(0.58 + heat*0.40 + (Math.random()*1.15-0.55)));
      const tier=P.tier;
      const s=stkMake((S.list.reduce((m,x)=>Math.max(m,x.id),0)+1), P.n, P.sec, tier, null);
      s.p=Math.max(50, open); s.o=s.p; s.hi=s.p; s.lo=s.p; s.pc=P.px;
      s.hist=[P.px, s.p]; s.ohlc=[[P.px,s.p,P.px,s.p,0]];
      s.sh=P.sh;
      S.list.push(s);
      /* 배정받은 물량을 그대로 보유로 넘긴다 */
      const M=me();
      if(P.got>0){
        if(!M.stkInv) M.stkInv={};
        M.stkInv[s.id]={q:P.got, avg:P.px};
        stkTxAdd({k:"ipo", sid:s.id, n:s.n, q:P.got, px:P.px, amt:P.got*P.px});
      }
      const chg=(s.p-P.px)/P.px*100;
      stkLog(chg>=0?"good":"bad", `🆕 <b>${s.n}</b> 신규 상장 — 공모가 ${stkWon(P.px)}원 · 시초가 ${stkWon(s.p)}원 (${chg>=0?"+":""}${chg.toFixed(0)}%)`, s.id);
      if(P.got>0){
        try{ notifyStk(`🆕 <b>${s.n}</b> 상장 — 시초가 ${stkWon(s.p)}원 (공모가 대비 ${chg>=0?"+":""}${chg.toFixed(0)}%) · 배정 ${P.got.toLocaleString()}주`, chg>=0?"good":"warn"); }catch(e){}
      }
      S.ipo=null;
      return;
    }
    return;
  }
  /* 새 공모 — 50일에 한 번쯤 */
  if(Math.random()<0.02){
    const secs=Object.keys(STK_SECTOR);
    const sec=pick(secs);
    const tier=pick(["grow","grow","penny","junk"]);
    const n=pick(STK_IPO_NAMES)+pick(STK_IPO_TAIL);
    if(S.list.some(x=>x.n===n)) return;
    const px=tier==="penny" ? 500+Math.round(Math.random()*2500)
           : tier==="junk"  ? 1500+Math.round(Math.random()*6000)
           :                  8000+Math.round(Math.random()*32000);
    const sh=Math.round((0.3+Math.random()*3)*1e12/px/1e5)*1e5;
    /* 남은 일수로 들고 다닌다 — 절대 날짜를 쓰면 시즌이 바뀔 때 얼어붙는다 (제보) */
    S.ipo={n, sec, tier, px, sh, d:G.day||0, s:G.season, closeIn:5, listIn:9, want:0, got:0, rate:0, done:0};
    stkLog("ipo", `🆕 <b>${n}</b> 신규 상장 공모 — 공모가 ${stkWon(px)}원 · 청약 5일간`);
    try{ notifyStk(`🆕 <b>${n}</b> 공모 청약이 시작됐습니다 — 공모가 ${stkWon(px)}원 · 5일 안에 신청하세요.`,"info"); }catch(e){}
  }
}
function stkIpoApply(){
  const P=stkIpo(); if(!P || P.done){ flash("청약할 수 있는 공모가 없습니다.","warn"); return; }
  const M=me();
  const q=parseInt(STK_IQ,10)||0;
  if(q<=0){ flash("청약 수량을 입력하세요.","warn"); return; }
  const need=q*P.px;
  if(need > M.cash*1e8){ flash(`청약증거금이 부족합니다 — ${stkMoney(need)} 필요`,"warn"); return; }
  stkCash(-need);
  P.want=(P.want||0)+q;
  stkLog("ipo", `🆕 ${P.n} 공모 청약 — ${q.toLocaleString()}주 신청 (증거금 ${stkMoney(need)})`);
  STK_IQ=""; saveGame(); show("mylife");
}

/* 🆕 ⚠ 제보 — 「처분할 방법 없나요?」. 마감 전이라면 청약을 물릴 수 있어야 한다.
   실제 공모도 청약 기간 중에는 취소·정정이 된다. 증거금은 전액 돌려준다. */
function stkIpoCancel(){
  const P=stkIpo(); if(!P){ flash("진행 중인 공모가 없습니다.","warn"); return; }
  if(P.done){ flash("이미 마감된 공모는 취소할 수 없습니다 — 상장일에 배정 물량이 들어옵니다.","warn"); return; }
  const q=P.want|0;
  if(q<=0){ flash("취소할 청약이 없습니다.","warn"); return; }
  const back=q*P.px;
  showConfirm(`<b>🆕 ${P.n} 공모 청약 취소</b>\n\n신청 <b>${q.toLocaleString()}주</b>를 물립니다.\n증거금 <b>${stkMoney(back)}</b>이 전액 환불됩니다.\n\n<span class="small">청약 마감 전까지는 언제든 다시 신청할 수 있습니다.</span>`,
    ()=>{
      const M=me();
      stkCash(back);
      P.want=0;
      stkLog("ipo", `🆕 ${P.n} 공모 청약 취소 — ${q.toLocaleString()}주 (증거금 ${stkMoney(back)} 환불)`);
      try{ notifyStk(`🆕 <b>${P.n}</b> 청약을 취소했습니다 — 증거금 ${stkMoney(back)} 환불`,"info"); }catch(e){}
      saveGame(); show("mylife");
    }, {okLabel:"청약 취소", danger:true});
}
let STK_FQ="", STK_IQ="";
function stkSetFq(v){ STK_FQ=String(v||"").replace(/[^0-9]/g,""); }
function stkSetIq(v){ STK_IQ=String(v||"").replace(/[^0-9]/g,""); }
/* ── 매매 ──────────────────────────────────────────────────── */
let STK_SEL=null, STK_QTY="", STK_SORT="cap", STK_FILTER="", STK_SECF="";
function stkOpen(id){ STK_SEL=id; STK_QTY=""; show("mylife"); }
function stkClose(){ STK_SEL=null; STK_QTY=""; show("mylife"); }
function stkSetQty(v){
  STK_QTY=String(v||"").replace(/[^0-9]/g,"");
  /* ⚠ 제보 — 수량을 쳐도 옆의 예상 금액이 그대로였다. 값만 기억하고 화면은 다시 그리지 않았기 때문.
     화면을 통째로 다시 그리면 입력칸이 새 요소로 바뀌어 포커스가 빠지므로, 그 한 줄만 갈아 끼운다. */
  try{ const el=document.getElementById("stkQtyEcho");
       const s=stkById(STK_SEL);
       if(el && s) el.innerHTML=stkQtyEchoHtml(s); }catch(e){}
}
/* 수량에 따른 예상 매수·매도 금액 한 줄 */
function stkQtyEchoHtml(s){
  const M=me();
  const q=parseInt(STK_QTY,10)||0;
  const h=(M.stkInv&&M.stkInv[s.id])||null;
  if(q<=0) return `보유 현금 <b class="money">${moneyEok(M.cash)}</b>${h?` · 보유 <b>${h.q.toLocaleString()}주</b>`:""}`;
  const _fb=stkFillPx(s, q, +1), _fs=stkFillPx(s, q, -1);
  const cost=q*_fb.px*(1+STK_FEE);
  const net =q*_fs.px*(1-STK_FEE-STK_TAX);
  const cash=M.cash*1e8;
  const overCash = cost>cash;
  const overHold = !h || q>h.q;
  const real = h ? (s.p-h.avg)*Math.min(q, h.q) : 0;
  return `매수 <b class="money" style="color:${overCash?"#f85149":""}">${stkMoney(cost)}</b>`
    + `${overCash?` <span style="color:#f85149">— 현금 ${stkMoney(cash)}으로 부족</span>`:""}`
    + ` · 매도 <b class="money" style="color:${overHold?"#f85149":""}">${stkMoney(net)}</b>`
    + `${overHold?` <span style="color:#f85149">— 보유 ${h?h.q.toLocaleString()+"주":"없음"}</span>`
                 :` <span style="color:${real>=0?"#f85149":"#58a6ff"}">실현 ${real>=0?"+":""}${stkMoney(real)}</span>`}`
    + ` <span style="opacity:.7">(수수료 ${(STK_FEE*100).toFixed(2)}% · 매도세 ${(STK_TAX*100).toFixed(2)}%)</span>`
    + (_fb.imp>0.005 ? `<br><span style="color:#ff9d5c">💥 시장충격 <b>${(_fb.imp*100).toFixed(1)}%</b> — 이 종목 하루 거래대금(${stkMoney(stkTurnover(s))})에 비해 주문이 큽니다. 매수는 ${stkWon(_fb.px)}원, 매도는 ${stkWon(_fs.px)}원에 체결됩니다.</span>` : "");
}
function stkQtyBtn(kind){
  const s=stkById(STK_SEL); if(!s) return;
  const M=me();
  if(kind==="max"){
    const cash=M.cash*1e8;
    /* ⚠ 제보 — 「최대를 누르고 매수하면 시장 충격으로 체결가가 올라 현금 부족으로 체결이
       안 된다. 최대가 충격을 미리 반영해 수량을 깎고 바로 매수되게 해달라」.
       예전엔 현재가로만 나눠서, 거래대금이 얇은 종목에서 최대 = 체결 불가 수량이 나왔다.
       체결가는 수량이 늘수록 오르기만 하므로, 「수수료·충격 포함 총액이 현금 이하」인
       최대 수량을 이분 탐색으로 찾는다. */
    let lo=0, hi=Math.max(0, Math.floor(cash/(s.p*(1+STK_FEE))));
    while(lo<hi){
      const mid=Math.ceil((lo+hi)/2);
      const F=stkFillPx(s, mid, +1);
      if(mid*F.px*(1+STK_FEE) <= cash) lo=mid; else hi=mid-1;
    }
    STK_QTY=String(lo);
  } else if(kind==="all"){
    const h=M.stkInv&&M.stkInv[s.id]; STK_QTY=String(h?h.q:0);
  } else if(kind==="half"){
    const h=M.stkInv&&M.stkInv[s.id]; STK_QTY=String(h?Math.floor(h.q/2):0);
  } else STK_QTY=String((parseInt(STK_QTY,10)||0)+kind);
  show("mylife");
}
function stkBuy(){
  if(fssFrozen()){ flash("🚨 금융감독원 조사로 계좌가 동결되어 매수할 수 없습니다.","warn"); return; }
  const s=stkById(STK_SEL); if(!s||s.dead) return;
  const q=parseInt(STK_QTY,10)||0;
  if(q<=0){ flash("수량을 입력하세요.","warn"); return; }
  const M=me();
  /* 🧱 보유 상한 — 발행주식수의 STK_OWN_MAX 를 넘겨 살 수 없다 */
  { const own=((M.stkInv&&M.stkInv[s.id])||{q:0}).q||0;
    const cap=Math.floor((s.sh||0)*STK_OWN_MAX);
    if(cap>0 && own+q>cap){
      flash(`한 종목은 발행주식수의 ${Math.round(STK_OWN_MAX*100)}%까지만 보유할 수 있습니다 — 최대 ${Math.max(0,cap-own).toLocaleString()}주 더 가능`,"warn"); return; } }
  const F=stkFillPx(s, q, +1);                  // 💥 큰 주문일수록 비싸게 체결된다
  const cost=q*F.px*(1+STK_FEE);
  if(cost > M.cash*1e8){ flash(`현금이 부족합니다 — ${stkMoney(cost)} 필요 (보유 ${moneyEok(M.cash)})`,"warn"); return; }
  stkCash(-cost);
  if(!M.stkInv) M.stkInv={};
  const h=M.stkInv[s.id]||{q:0, avg:0};
  /* 📅 처음 담은 날 — 나중에 「얼마나 들고 있었나」를 계산하는 기준이 된다 */
  if(!(h.q>0) || h.since==null){ h.since=G.day||0; h.sinceS=G.season; }
  h.avg=Math.round((h.avg*h.q + F.px*q)/(h.q+q));
  h.q+=q;
  M.stkInv[s.id]=h;
  M.spent=Math.round((M.spent+cost/1e8)*100)/100;
  stkPushMom(s, +1, F.imp);                     // 내가 밀어 올린 값은 시장에 남는다
  fssHeat(s, F.imp, cost);                      // 🚨 값을 밀어 올린 만큼 감독당국의 눈에 띈다
  stkDisclCheck(s);                             // 📢 5% 를 넘겼는가
  stkTxAdd({k:"buy", sid:s.id, n:s.n, q, px:F.px, amt:cost});
  if(F.imp>0.01) stkLog("slip", `💥 <b>${s.n}</b> 매수 체결가가 시세보다 <b>${(F.imp*100).toFixed(1)}%</b> 높았습니다 — 물량이 호가를 밀어 올렸습니다`, s.id);
  try{ meLog(`📈 ${s.n} ${q.toLocaleString()}주 매수 (${stkWon(F.px)}원 · ${stkMoney(cost)})`); }catch(e){}
  STK_QTY=""; saveGame(); show("mylife");
}
function stkSell(){
  const s=stkById(STK_SEL); if(!s) return;
  const M=me();
  const h=(M.stkInv&&M.stkInv[s.id])||null;
  const q=parseInt(STK_QTY,10)||0;
  if(!h||h.q<=0){ flash("보유 수량이 없습니다.","warn"); return; }
  if(q<=0||q>h.q){ flash(`보유 수량은 ${h.q.toLocaleString()}주입니다.`,"warn"); return; }
  if(s.dead){ flash("상장폐지된 종목은 매도할 수 없습니다.","warn"); return; }
  const F=stkFillPx(s, q, -1);                  // 💥 큰 물량을 던지면 값이 흘러내린다
  const gross=q*F.px, net=gross*(1-STK_FEE-STK_TAX);
  const real=(F.px-h.avg)*q;
  stkCash(net);
  M.earned=Math.round((M.earned+net/1e8)*100)/100;
  M.stkReal=Math.round(((M.stkReal||0) + real/1e8)*1e4)/1e4;
  const _hq0=h.q;
  h.q-=q;
  if(h.q<=0) delete M.stkInv[s.id]; else M.stkInv[s.id]=h;
  taxOnRealize(s, _hq0, real, "매도");          // 🧾 ① 대주주 양도소득세 (팔기 전 지분으로 판정)
  fssHeat(s, F.imp, gross);
  stkDisclCheck(s);
  stkPushMom(s, -1, F.imp);
  stkTxAdd({k:"sell", sid:s.id, n:s.n, q, px:F.px, amt:net, real,
            bavg:h.avg, hold:stkHoldDays(h), ret:h.avg>0?((F.px-h.avg)/h.avg):null});
  if(F.imp>0.01) stkLog("slip", `💥 <b>${s.n}</b> 매도 체결가가 시세보다 <b>${(F.imp*100).toFixed(1)}%</b> 낮았습니다 — 받아 줄 물량이 없었습니다`, s.id);
  try{ meLog(`📉 ${s.n} ${q.toLocaleString()}주 매도 (${stkMoney(net)} · 실현 ${real>=0?"+":""}${(real/1e8).toFixed(2)}억)`); }catch(e){}
  STK_QTY=""; saveGame(); show("mylife");
}
/* ── 차트 (SVG) ────────────────────────────────────────────── */
function stkChart(s, w, h){
  const H=(s.hist||[]).slice(-60);
  if(H.length<2) return `<div class="small" style="padding:12px;color:var(--sub)">아직 시세 기록이 없습니다.</div>`;
  const lo=Math.min(...H), hi=Math.max(...H), sp=Math.max(1, hi-lo);
  const W=w||520, HH=h||140, pad=6;
  const x=(i)=>pad + i/(H.length-1)*(W-pad*2);
  const y=(v)=>pad + (1-(v-lo)/sp)*(HH-pad*2);
  const up = H[H.length-1]>=H[0];
  const col= up ? "#f85149" : "#58a6ff";     // 한국 증시 관례 — 오르면 빨강, 내리면 파랑
  const line=H.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area=`${line} L${x(H.length-1).toFixed(1)},${HH-pad} L${x(0).toFixed(1)},${HH-pad} Z`;
  /* 기준선 — 60일 전 가격 */
  const y0=y(H[0]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${HH}" style="width:100%;height:${HH}px;display:block">
    <defs><linearGradient id="stkG${s.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".28"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="${pad}" y1="${y0}" x2="${W-pad}" y2="${y0}" stroke="#30363d" stroke-width="1" stroke-dasharray="3 3"/>
    <path d="${area}" fill="url(#stkG${s.id})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="${x(H.length-1).toFixed(1)}" cy="${y(H[H.length-1]).toFixed(1)}" r="3" fill="${col}"/>
  </svg>
  <div class="small" style="display:flex;justify-content:space-between;color:var(--sub);margin-top:2px">
    <span>${H.length}일 전 ${stkWon(lo)}~${stkWon(hi)}원</span>
    <span style="color:${col}">${up?"▲":"▼"} 기간 ${(((H[H.length-1]-H[0])/H[0])*100).toFixed(1)}%</span></div>`;
}
/* 미니 스파크라인 — 목록 줄에 붙인다 */
function stkSpark(s){
  const H=(s.hist||[]).slice(-24);
  if(H.length<2) return "";
  const lo=Math.min(...H), hi=Math.max(...H), sp=Math.max(1,hi-lo);
  const W=54, HH=18;
  const d=H.map((v,i)=>`${i?"L":"M"}${(i/(H.length-1)*W).toFixed(1)},${((1-(v-lo)/sp)*(HH-2)+1).toFixed(1)}`).join(" ");
  const col=H[H.length-1]>=H[0]?"#f85149":"#58a6ff";
  return `<svg viewBox="0 0 ${W} ${HH}" style="width:${W}px;height:${HH}px;flex:0 0 auto"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.4"/></svg>`;
}
/* ── 화면 ──────────────────────────────────────────────────── */
function stkSetSort(k){ STK_SORT=k; show("mylife"); }
function stkSetSec(k){ STK_SECF=(STK_SECF===k?"":k); show("mylife"); }
function stkSearch(v){ STK_FILTER=String(v||""); const el=document.getElementById("stkList"); if(el) el.innerHTML=stkListHtml(); }
function stkSorted(){
  const S=stkState(); if(!S) return [];
  let L=S.list.filter(s=>!s.dead);
  if(STK_SECF) L=L.filter(s=>s.sec===STK_SECF);
  const q=String(STK_FILTER||"").trim();
  if(q) L=L.filter(s=>s.n.indexOf(q)>=0 || (STK_SECTOR[s.sec]&&STK_SECTOR[s.sec].n.indexOf(q)>=0));
  const f={ cap:s=>-stkCap(s), price:s=>-s.p, chg:s=>-stkChg(s), drop:s=>stkChg(s),
            div:s=>-(s.div||0), name:s=>s.n }[STK_SORT]||((s)=>-stkCap(s));
  return L.sort((a,b)=>{ const x=f(a), y=f(b); return (typeof x==="string")?String(x).localeCompare(String(y)):(x-y); });
}
function stkRow(s){
  const M=me();
  const h=(M.stkInv&&M.stkInv[s.id])||null;
  const ch=stkChg(s);
  const col=ch>0?"#f85149":ch<0?"#58a6ff":"var(--sub)";
  const T=STK_TIER[s.tier], SC=STK_SECTOR[s.sec]||{n:"기타",ic:"🏢"};
  return `<div class="stkRow ${STK_SEL===s.id?"on":""}" onclick="stkOpen(${s.id})">
    <div class="stkMain">
      <div class="stkN"><b>${s.n}</b>
        <span class="stkTier" style="color:${T.c};border-color:${T.c}44">${T.n}</span>
        ${s.warn?'<span class="stkTier" style="color:#ff9d5c;border-color:#ff9d5c66">⚠️ 관리종목</span>':""}
        ${s.tid?'<span class="stkTag">⚽ 구단 모기업</span>':""}</div>
      <div class="small" style="color:var(--sub)">${SC.ic} ${SC.n} · 시총 ${stkMoney(stkCap(s))}${s.div?` · 배당 ${s.div}%`:""}
        ${h?` · <b style="color:var(--gold)">보유 ${h.q.toLocaleString()}주</b>`:""}</div>
    </div>
    ${stkSpark(s)}
    <div class="stkP">
      <b style="color:${col}">${stkWon(s.p)}</b>
      <span class="small" style="color:${col}">${ch>=0?"+":""}${ch.toFixed(2)}%</span>
    </div>
    <button class="mini slStar ${stkIsFav(s.id)?"on":""}" onclick="stkToggleFav(${s.id},event)">${stkIsFav(s.id)?"⭐":"☆"}</button>
  </div>`;
}
function stkListHtml(){
  const L=stkSorted();
  if(!L.length) return `<p class="small" style="padding:12px">조건에 맞는 종목이 없습니다.</p>`;
  return L.map(stkRow).join("");
}
/* 선택한 종목의 상세 + 주문 패널 */
function stkPanel(){
  const s=stkById(STK_SEL); if(!s) return "";
  const M=me();
  const h=(M.stkInv&&M.stkInv[s.id])||null;
  const ch=stkChg(s), col=ch>0?"#f85149":ch<0?"#58a6ff":"var(--sub)";
  const SC=STK_SECTOR[s.sec]||{n:"기타",ic:"🏢"}, T=STK_TIER[s.tier];
  const per=stkPER(s), pbr=stkPBR(s);
  const q=parseInt(STK_QTY,10)||0;
  const cost=q*s.p*(1+STK_FEE), net=q*s.p*(1-STK_FEE-STK_TAX);
  const club=s.tid&&G.teams[s.tid];
  return `<div class="card" style="border-color:${T.c}55">
    <h3 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${s.n}
      <span class="stkTier" style="color:${T.c};border-color:${T.c}44">${T.n}</span>
      <span class="small" style="color:var(--sub);font-weight:400">${SC.ic} ${SC.n}${club?` · ⚽ ${club.name} 모기업`:""}</span>
      <button class="mini slStar ${stkIsFav(s.id)?"on":""}" style="margin-left:auto" onclick="stkToggleFav(${s.id},event)"
        >${stkIsFav(s.id)?"⭐":"☆"}</button>
      <button class="mini" onclick="event.stopPropagation();stkClose()">✕ 닫기</button></h3>
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px">
      <span style="font-size:30px;font-weight:800;color:${col}">${stkWon(s.p)}</span>
      <span style="color:${col};font-weight:700">${ch>=0?"▲":"▼"} ${stkWon(Math.abs(s.p-s.pc))} (${ch>=0?"+":""}${ch.toFixed(2)}%)</span>
    </div>
    ${s.warn?`<div class="msg warn" style="margin:6px 0">⚠️ <b>관리종목</b>으로 지정된 상태입니다. 상장폐지되면 투자금 전액을 잃습니다.</div>`:""}
    ${stkChart2(s)}
    <div class="stkGrid">
      <div><span>시가</span><b>${stkWon(s.o)}</b></div>
      <div><span>고가</span><b style="color:#f85149">${stkWon(s.hi)}</b></div>
      <div><span>저가</span><b style="color:#58a6ff">${stkWon(s.lo)}</b></div>
      <div><span>전일종가</span><b>${stkWon(s.pc)}</b></div>
      <div><span>거래량</span><b>${s.vol.toLocaleString()}</b></div>
      <div><span>시가총액</span><b>${stkMoney(stkCap(s))}</b></div>
      <div><span>상장주식수</span><b>${(s.sh/1e4).toLocaleString()}만</b></div>
      <div><span>PER</span><b>${per==null?'<span style="color:var(--red)">적자</span>':per}</b></div>
      <div><span>PBR</span><b>${pbr==null?"-":pbr}</b></div>
      <div><span>EPS</span><b>${stkWon(s.eps)}</b></div>
      <div><span>BPS</span><b>${stkWon(s.bps)}</b></div>
      <div><span>배당수익률</span><b style="color:${s.div?"var(--green)":"var(--sub)"}">${s.div?s.div+"%":"—"}</b></div>
    </div>
    ${h?`<div class="msg info" style="margin:8px 0">
      보유 <b>${h.q.toLocaleString()}주</b> · 평균단가 <b>${stkWon(h.avg)}원</b> · 평가액 <b>${stkMoney(h.q*s.p)}</b>
      · 평가손익 <b style="color:${h.q*(s.p-h.avg)>=0?"#f85149":"#58a6ff"}">${h.q*(s.p-h.avg)>=0?"+":""}${stkMoney(h.q*(s.p-h.avg))}
        (${(((s.p-h.avg)/h.avg)*100).toFixed(2)}%)</b></div>`:""}
    <div class="stkOrder">
      <input type="text" inputmode="numeric" placeholder="수량" value="${STK_QTY}" oninput="stkSetQty(this.value)"
        style="flex:1;min-width:90px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="stkQtyBtn(10)">+10</button>
      <button class="mini" onclick="stkQtyBtn(100)">+100</button>
      <button class="mini" onclick="stkQtyBtn('max')">최대</button>
      ${h?`<button class="mini" onclick="stkQtyBtn('half')">절반</button><button class="mini" onclick="stkQtyBtn('all')">전량</button>`:""}
    </div>
    <div class="small" id="stkQtyEcho" style="margin:6px 0;color:var(--sub);min-height:17px">${stkQtyEchoHtml(s)}</div>
    <div style="display:flex;gap:6px">
      <button class="mini" style="flex:1;padding:10px;background:#3a1414;border-color:#f85149;color:#ff8080;font-weight:700" onclick="stkBuy()">매수</button>
      <button class="mini" style="flex:1;padding:10px;background:#0f2233;border-color:#58a6ff;color:#9ecbff;font-weight:700" onclick="stkSell()">매도</button>
    </div>
    ${(()=>{ const sh=(me().short||{})[s.id];
      return `<div style="display:flex;gap:6px;margin-top:6px">
        <button class="mini" style="flex:1;padding:9px;border-color:#a78bfa;color:#c4b5fd" onclick="stkShortOpen()">📉 공매도</button>
        <button class="mini" style="flex:1;padding:9px;border-color:${sh?"#7ee2a8":"#30363d"};color:${sh?"#7ee2a8":"#6b7480"}" onclick="stkShortCover()">📈 숏커버</button>
      </div>
      ${sh?`<div class="msg warn" style="margin:7px 0 0">📉 공매도 잔고 <b>${sh.q.toLocaleString()}주</b> · 평균 매도가 <b>${stkWon(sh.avg)}원</b>
        · 평가손익 <b style="color:${(sh.avg-s.p)*sh.q>=0?"#f85149":"#58a6ff"}">${(sh.avg-s.p)*sh.q>=0?"+":""}${stkMoney((sh.avg-s.p)*sh.q)}</b>
        <span class="small">(주가가 오르면 손실이 계속 불어납니다)</span></div>`:""}`; })()}
    ${stkOrderBox(s)}
  </div>`;
}
/* 📋 지정가 예약 — 「이 값이 오면 사 달라/팔아 달라」를 걸어 둔다 */
let STK_OPX="", STK_ODAY=30;
function stkSetOpx(v){ STK_OPX=String(v||"").replace(/[^0-9]/g,""); }
function stkPxBtn(pct){
  const s=stkById(STK_SEL); if(!s) return;
  STK_OPX=String(Math.round(s.p*(1+pct/100)));
  show("mylife");
}
function stkOrderPut(kind){
  const s=stkById(STK_SEL); if(!s) return;
  const px=parseInt(STK_OPX,10)||0, q=parseInt(STK_QTY,10)||0;
  if(px<=0){ flash("지정가를 입력하세요.","warn"); return; }
  if(q<=0){ flash("수량을 입력하세요.","warn"); return; }
  if(kind==="sell"){
    const h=(me().stkInv||{})[s.id];
    if(!h||h.q<q){ flash(`보유 수량이 부족합니다 (${h?h.q.toLocaleString():0}주).`,"warn"); return; }
  }
  if(kind==="buy" && px>=s.p) { flash("매수 예약은 현재가보다 낮은 값에 겁니다.","warn"); return; }
  if(kind==="sell" && px<=s.p){ flash("매도 예약은 현재가보다 높은 값에 겁니다.","warn"); return; }
  if(stkOrderAdd(s.id, kind, px, q, STK_ODAY)){
    flash(`📋 ${s.n} ${kind==="buy"?"매수":"매도"} 예약 — ${stkWon(px)}원 ${q.toLocaleString()}주`,"good");
    STK_OPX=""; STK_QTY=""; show("mylife");
  }
}
function stkOrderBox(s){
  const mine=stkOrders().filter(o=>o.sid===s.id);
  const q=parseInt(STK_QTY,10)||0, px=parseInt(STK_OPX,10)||0;
  return `<details class="stkDet" ${mine.length?"open":""}>
    <summary>📋 지정가 예약 주문${mine.length?` <b style="color:var(--gold)">${mine.length}건</b>`:""}</summary>
    <p class="small" style="color:var(--sub);margin:4px 0 6px">
      건 값에 도달하면 날짜가 지나면서 <b>자동으로 체결</b>됩니다. 매수는 지정가 이하로 내려올 때, 매도는 지정가 이상으로 올라갈 때 체결됩니다.</p>
    <div class="stkOrder">
      <input type="text" inputmode="numeric" placeholder="지정가" value="${STK_OPX}" oninput="stkSetOpx(this.value)"
        style="flex:1;min-width:88px;padding:8px 9px;font-size:15px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="stkPxBtn(-5)">-5%</button>
      <button class="mini" onclick="stkPxBtn(-10)">-10%</button>
      <button class="mini" onclick="stkPxBtn(5)">+5%</button>
      <button class="mini" onclick="stkPxBtn(15)">+15%</button>
    </div>
    <div class="small" style="margin:5px 0;color:var(--sub)">
      수량 <b>${q.toLocaleString()}주</b> · 유효기간 <b>${STK_ODAY}일</b>${px&&q?` · 예상 ${stkMoney(px*q)}`:""}
      <span style="opacity:.7">(위 수량 칸을 함께 씁니다)</span></div>
    <div style="display:flex;gap:6px">
      <button class="mini" style="flex:1;padding:8px;border-color:#f85149;color:#ff8080" onclick="stkOrderPut('buy')">📥 매수 예약</button>
      <button class="mini" style="flex:1;padding:8px;border-color:#58a6ff;color:#9ecbff" onclick="stkOrderPut('sell')">📤 매도 예약</button>
    </div>
    ${mine.length?`<div style="margin-top:7px">${mine.map(o=>`
      <div class="stkOrdRow">
        <span style="color:${o.k==="buy"?"#ff8080":"#9ecbff"};font-weight:700">${o.k==="buy"?"매수":"매도"}</span>
        <span><b>${stkWon(o.px)}</b>원 · ${o.q.toLocaleString()}주</span>
        <span class="small" style="color:var(--sub)">D-${Math.max(0,o.exp-(G.day||0))}</span>
        <button class="mini" onclick="stkOrderDel(${o.id})">취소</button>
      </div>`).join("")}</div>`:""}
  </details>`;
}
/* 자산 탭 안의 「📈 주식」 화면 전체 */
let STK_TAB="market";
function stkSetTab(k){ STK_TAB=k; show("mylife"); }
function stkView(){
  const M=me(), S=stkState();
  if(!S) return `<div class="card"><p class="small">시장 정보를 불러오는 중입니다.</p></div>`;
  const ev=stkEval(), pl=stkPL(), held=stkHeld();
  const loan=stkLoan(), ratio=stkRatio();
  const total=M.cash*1e8 + ev - loan;
  const secChips=Object.keys(STK_SECTOR).map(k=>
    `<button class="psChip ${STK_SECF===k?"on":""}" style="padding:5px 9px;font-size:11.5px" onclick="stkSetSec('${k}')">${STK_SECTOR[k].ic} ${STK_SECTOR[k].n}</button>`).join("");
  const sortBtn=(k,l)=>`<button class="mini ${STK_SORT===k?"sel":""}" onclick="stkSetSort('${k}')">${l}</button>`;
  return `<div class="card">
    <h3>💹 자산 요약</h3>
    <div class="stkSum">
      <div><span>순자산</span><b class="money">${stkMoney(total)}</b></div>
      <div><span>현금</span><b>${stkMoney(M.cash*1e8)}</b></div>
      <div><span>주식 평가액</span><b>${stkMoney(ev)}</b></div>
      <div><span>평가손익</span><b style="color:${pl.v>=0?"#f85149":"#58a6ff"}">${pl.v>=0?"+":""}${stkMoney(pl.v)}</b></div>
      <div><span>수익률</span><b style="color:${pl.pct>=0?"#f85149":"#58a6ff"}">${pl.pct>=0?"+":""}${pl.pct.toFixed(2)}%</b></div>
      <div><span>실현손익 누계</span><b style="color:${(M.stkReal||0)>=0?"#f85149":"#58a6ff"}">${(M.stkReal||0)>=0?"+":""}${(M.stkReal||0).toFixed(2)}억</b></div>
      <div><span>배당 수령 누계</span><b style="color:${(M.stkDiv||0)>0?"var(--green)":"var(--sub)"}">${(M.stkDiv||0).toFixed(2)}억</b></div>
      ${stkShortList().length?`<div><span>공매도 평가손익</span><b style="color:${stkShortPL()>=0?"#f85149":"#58a6ff"}">${stkShortPL()>=0?"+":""}${stkMoney(stkShortPL())}</b></div>`:""}
      ${stkDebt()>0?`<div><span>🩸 사채 잔액</span><b style="color:#f85149">${stkMoney(stkDebt())}</b></div>`:""}
      ${(function(){ try{ const T=taxState(); return (T.paid>0)
        ? `<div><span>🧾 올해 낸 세금</span><b style="color:#ff9d5c">${stkMoney(T.paid)} <span class="small">(양도 ${stkMoney(T.cg)} · 배당 ${stkMoney(T.div)})</span></b></div>` : ""; }catch(e){ return ""; } })()}
      ${(G.fss&&G.fss.n)?`<div><span>🚨 금감원 과징금</span><b style="color:#f85149">${(G.fss.fine||0).toFixed(2)}억 <span class="small">(${G.fss.n}회)</span></b></div>`:""}
      ${(G.nts&&G.nts.n)?`<div><span>🧾 세무조사 추징 누계</span><b style="color:#ff9d5c">${ntsJo(G.nts.tot)} <span class="small">(${G.nts.n}회)</span></b></div>`:""}
      ${loan>0?`<div><span>신용융자 잔액</span><b style="color:#ff9d5c">${stkMoney(loan)}</b></div>
      <div><span>담보비율</span><b style="color:${ratio<STK_MG_CALL?"#f85149":ratio<STK_MG_CALL+0.3?"#ff9d5c":"var(--green)"}">${Math.round(ratio*100)}%</b></div>`:""}
    </div>
    ${(function(){ try{
      /* 🚨 금감원 — 지금 얼마나 눈에 띄어 있는가. 걸리기 «전에» 보여 준다 */
      const F=fssState(), h=F.heat||0;
      if(fssFrozen()) return `<div class="msg warn" style="margin-top:8px">🚨 <b>계좌 동결</b> — 금융감독원 조사로 <b>${Math.max(0,(F.ban||0)-(G.day||0))}일</b> 동안
        매수·공매도·신용거래가 정지되었습니다. <span class="small">매도는 할 수 있습니다.</span></div>`;
      if(h>=18) return `<div class="msg warn" style="margin-top:8px">🚨 <b>금융감독원이 지켜보고 있습니다</b> — 시세 영향 지수 <b>${Math.round(h)}</b>.
        <span class="small">큰 주문으로 값을 밀어 올린 기록이 쌓였습니다. 걸리면 과징금과 계좌 동결, 그리고 감독직에도 흠집이 남습니다. 주문을 나눠서 내면 식습니다.</span></div>`;
      return "";
    }catch(e){ return ""; } })()}
    ${(function(){ try{
      /* 📢 대량보유 공시된 종목 — 체결이 계속 불리해진다 */
      const M=me(), D=M._discl||{}; const ns=Object.keys(D).map(id=>{ const s2=stkById(+id); return s2?s2.n:null; }).filter(Boolean);
      if(!ns.length) return "";
      return `<div class="msg" style="margin-top:8px">📢 <b>대량보유 공시</b> — ${ns.slice(0,3).join(" · ")}${ns.length>3?` 외 ${ns.length-3}종목`:""} (지분 ${Math.round(STK_DISCL_R*100)}% 이상).
        <span class="small">시장이 당신의 매매를 앞질러 갑니다 — 살 때는 더 비싸게, 팔 때는 더 싸게 체결됩니다.</span></div>`;
    }catch(e){ return ""; } })()}
    ${(function(){ try{
      const N=ntsState(), f=ntsFin(), base=N.base||0;
      if(f<NTS_FLOOR || !(base>0)) return "";
      const mul=f/Math.max(1,base);
      if(mul < NTS_GROW*0.6) return "";
      return `<div class="msg ${mul>=NTS_GROW?"warn":""}" style="margin-top:8px">🧾 <b>자금출처 세무조사</b> — 최근 ${NTS_WIN}일간 금융자산이
        ${ntsJo(base)} → <b>${ntsJo(f)}</b> (<b>${mul.toFixed(1)}배</b>). <span class="small">${NTS_GROW}배를 넘으면 소명하지 못한 증가분의 ${Math.round(NTS_RATE*100)}%가 추징됩니다.</span></div>`;
    }catch(e){ return ""; } })()}
    ${stkBadCredit()?`<div class="msg warn" style="margin-top:8px">💀 <b>파산 이력</b> — 신용융자·사채·공매도·선물이 <b>${stkBadCreditLeft()}시즌</b> 동안 막혀 있습니다.
      현금으로만 거래할 수 있고, 월급의 30%가 압류되며, 감독 위신이 <b>${stkBankMark()}</b> 깎여 있습니다.</div>`:""}
    ${loan>0&&ratio<STK_MG_CALL+0.25?`<div class="msg warn" style="margin-top:8px">⚠️ 담보비율이 <b>${Math.round(ratio*100)}%</b>입니다.
      <b>${Math.round(STK_MG_CALL*100)}%</b> 아래로 내려가면 보유 주식이 강제 매도(반대매매)됩니다.</div>`:""}
  </div>
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0">
    ${(()=>{ const mineN=((S.news||[]).filter(x=>x.id && M.stkInv && M.stkInv[x.id] && M.stkInv[x.id].q>0)).length
                  + stkTips().filter(x=>!x.res && M.stkInv && M.stkInv[x.sid] && M.stkInv[x.sid].q>0).length;
      return [["market","📊 시장"],["fav","⭐ 관심"],["order","📋 예약"+(stkOrders().length?` (${stkOrders().length})`:"")],
       ["margin","💳 신용·공매도"],["deriv","📊 선물·공모"+(stkIpo()&&!stkIpo().done?" 🔴":"")],["tx","📜 내역·분석"],
       ["news","🕵️ 찌라시·공시"+(mineN?` 🔴${mineN}`:"")]]; })().map(([k,l])=>
      `<button class="mini ${STK_TAB===k?"sel":""}" style="padding:7px 13px" onclick="stkSetTab('${k}')">${l}</button>`).join("")}
  </div>
  ${held.length?`<div class="card"><h3>📦 보유 종목 <span class="small">${held.length}개</span></h3>
    ${held.map(({s,q,avg})=>{ const d=(s.p-avg)/avg*100, c=d>=0?"#f85149":"#58a6ff";
      return `<div class="stkRow" onclick="stkOpen(${s.id})">
        <div class="stkMain"><div class="stkN"><b>${s.n}</b></div>
          <div class="small" style="color:var(--sub)">${q.toLocaleString()}주 · 평단 ${stkWon(avg)} · 평가 ${stkMoney(q*s.p)}</div></div>
        ${stkSpark(s)}
        <div class="stkP"><b style="color:${c}">${d>=0?"+":""}${d.toFixed(1)}%</b>
          <span class="small" style="color:${c}">${d>=0?"+":""}${stkMoney(q*(s.p-avg))}</span></div>
      </div>`;}).join("")}
    </div>`:""}
  ${STK_SEL?stkPanel():""}
  ${STK_TAB!=="market"?stkSubView():`
  ${stkIdxCard()}
  <div class="card">
    <h3>📊 전체 종목 <span class="small">— ${S.list.filter(s=>!s.dead).length}개 상장</span></h3>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
      <input type="text" placeholder="🔍 종목·업종 검색" value="${String(STK_FILTER).replace(/"/g,"&quot;")}" oninput="stkSearch(this.value)"
        style="flex:1;min-width:150px;padding:8px 10px;font-size:14px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg)">
      ${sortBtn("cap","시총")}${sortBtn("chg","상승")}${sortBtn("drop","하락")}${sortBtn("price","주가")}${sortBtn("div","배당")}
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">${secChips}</div>
    <div id="stkList" class="tblScroll" style="max-height:56vh;overflow-y:auto;-webkit-overflow-scrolling:touch">${stkListHtml()}</div>
  </div>`}
`;
}
/* ⭐ 관심 · 📋 예약 · 💳 신용 · 📜 내역 — 서브탭 본문 */
function stkSubView(){
  const M=me(), S=stkState();
  if(STK_TAB==="fav"){
    const F=stkFav().map(id=>stkById(id)).filter(s=>s&&!s.dead);
    return `<div class="card"><h3>⭐ 관심 종목 <span class="small">— ${F.length}개</span></h3>
      ${F.length?F.map(stkRow).join("")
        :`<p class="small" style="padding:10px 2px">아직 담아 둔 종목이 없습니다. 목록이나 종목 상세에서 <b>☆</b>를 누르면 여기 모입니다.</p>`}
    </div>`;
  }
  if(STK_TAB==="order"){
    const O=stkOrders();
    return `<div class="card"><h3>📋 예약 주문 <span class="small">— ${O.length}건 / 최대 20건</span></h3>
      <p class="small" style="color:var(--sub);margin-bottom:8px">종목 상세를 열고 <b>지정가 예약 주문</b>에서 겁니다.
        날짜가 지나면서 그날의 저가·고가 안에 지정가가 들어오면 자동 체결됩니다.</p>
      ${O.length?O.map(o=>{ const s=stkById(o.sid); if(!s) return "";
        const gap=(o.px-s.p)/s.p*100;
        return `<div class="stkRow" onclick="stkOpen(${s.id})">
          <div class="stkMain">
            <div class="stkN"><b>${s.n}</b>
              <span class="stkTier" style="color:${o.k==="buy"?"#ff8080":"#9ecbff"};border-color:${o.k==="buy"?"#f8514966":"#58a6ff66"}">${o.k==="buy"?"매수":"매도"} 예약</span></div>
            <div class="small" style="color:var(--sub)">지정가 <b>${stkWon(o.px)}</b>원 · ${o.q.toLocaleString()}주 · 예상 ${stkMoney(o.px*o.q)}</div>
          </div>
          <div class="stkP"><b class="small">현재 ${stkWon(s.p)}</b>
            <span class="small" style="color:${Math.abs(gap)<3?"var(--gold)":"var(--sub)"}">${gap>=0?"+":""}${gap.toFixed(1)}% · D-${Math.max(0,o.exp-(G.day||0))}</span></div>
          <button class="mini" onclick="event.stopPropagation();stkOrderDel(${o.id})">취소</button>
        </div>`;}).join("")
        :`<p class="small" style="padding:10px 2px">걸어 둔 주문이 없습니다.</p>`}
    </div>`;
  }
  if(STK_TAB==="news") return stkTipCard()+stkNewsCard(true);
  if(STK_TAB==="deriv") return stkFutCard()+stkIpoCard();
  if(STK_TAB==="margin"){
    const loan=stkLoan(), ratio=stkRatio(), maxAdd=stkLoanMax();
    return `<div class="card"><h3>💳 신용융자 <span class="small">— 연 ${(STK_MG_RATE*365*100).toFixed(1)}% · 순자산의 ${STK_MG_MAX}배까지</span></h3>
      <div class="msg ${loan>0&&ratio<STK_MG_CALL+0.25?"warn":"info"}" style="margin-bottom:8px">
        빌린 돈으로 주식을 살 수 있습니다. 이자는 <b>매일</b> 붙고, 담보비율이 <b>${Math.round(STK_MG_CALL*100)}%</b> 아래로 내려가면
        보유 주식이 <b>강제로 매도(반대매매)</b>됩니다. 크게 벌 수도, 한 번에 잃을 수도 있습니다.</div>
      <div class="stkSum" style="margin-bottom:8px">
        <div><span>대출 잔액</span><b style="color:${loan>0?"#ff9d5c":"var(--sub)"}">${stkMoney(loan)}</b></div>
        <div><span>담보비율</span><b style="color:${ratio==null?"var(--sub)":ratio<STK_MG_CALL?"#f85149":ratio<STK_MG_CALL+0.3?"#ff9d5c":"var(--green)"}">${ratio==null?"—":Math.round(ratio*100)+"%"}</b></div>
        <div><span>추가 한도</span><b>${stkMoney(maxAdd)}</b></div>
        <div><span>누적 이자</span><b style="color:#ff9d5c">${(M.stkInt||0).toFixed(2)}억</b></div>
      </div>
      <div class="stkOrder">
        <input type="text" inputmode="numeric" placeholder="금액(억)" value="${STK_MGAMT}" oninput="stkSetMg(this.value)"
          style="flex:1;min-width:100px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
        <button class="mini" onclick="stkMgBtn(1)">+1억</button>
        <button class="mini" onclick="stkMgBtn(10)">+10억</button>
        <button class="mini" onclick="stkMgBtn('max')">최대</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:7px">
        <button class="mini" style="flex:1;padding:10px;border-color:#ff9d5c;color:#ff9d5c" onclick="stkBorrow((parseFloat(STK_MGAMT)||0)*1e8)">💳 융자 받기</button>
        <button class="mini" style="flex:1;padding:10px;border-color:var(--green);color:var(--green)" onclick="stkRepay((parseFloat(STK_MGAMT)||0)*1e8)">💵 상환</button>
      </div>
    </div>
    ${stkShortCard()}
    ${stkDebtCard()}`;
  }
  /* 📜 내역 · 분석 */
  const st=stkStats(), T=stkTx();
  return `<div class="card"><h3>📊 성과 분석</h3>
    <div class="stkSum" style="margin-bottom:8px">
      <div><span>총 거래</span><b>${st.n}건</b></div>
      <div><span>매도 승률</span><b style="color:${st.winPct>=50?"#f85149":"#58a6ff"}">${st.sells?st.winPct.toFixed(0)+"%":"—"}</b></div>
      <div><span>익절 / 손절</span><b><span style="color:#f85149">${st.win}</span> / <span style="color:#58a6ff">${st.lose}</span></b></div>
      <div><span>실현손익 누계</span><b style="color:${(M.stkReal||0)>=0?"#f85149":"#58a6ff"}">${(M.stkReal||0)>=0?"+":""}${(M.stkReal||0).toFixed(2)}억</b></div>
    </div>
    ${st.best?`<p class="small" style="margin:2px 0">🏅 최고 수익 <b>${st.best.n}</b> ${(st.best.real/1e8)>=0?"+":""}${(st.best.real/1e8).toFixed(2)}억
      · 😵 최대 손실 <b>${st.worst.n}</b> ${(st.worst.real/1e8).toFixed(2)}억</p>`:""}
    ${st.rank.length?`<h4 class="small" style="margin:10px 0 4px;color:var(--sub)">종목별 누적 실현손익</h4>
      ${st.rank.slice(0,8).map(r=>{ const w=Math.min(100, Math.abs(r.v)/Math.max(1,Math.abs(st.rank[0].v))*100);
        return `<div class="stkBar"><span class="stkBarN">${r.n}</span>
          <div class="stkBarT"><div style="width:${w}%;background:${r.v>=0?"#f85149":"#58a6ff"}"></div></div>
          <span class="stkBarV" style="color:${r.v>=0?"#f85149":"#58a6ff"}">${r.v>=0?"+":""}${(r.v/1e8).toFixed(2)}억</span></div>`;}).join("")}`:""}
    ${st.secArr.length?`<h4 class="small" style="margin:12px 0 4px;color:var(--sub)">업종 분산 (평가액 기준)</h4>
      ${st.secArr.map(x=>{ const S2=STK_SECTOR[x.k]||{n:x.k,ic:"🏢"};
        return `<div class="stkBar"><span class="stkBarN">${S2.ic} ${S2.n}</span>
          <div class="stkBarT"><div style="width:${x.p}%;background:var(--acc)"></div></div>
          <span class="stkBarV">${x.p.toFixed(0)}%</span></div>`;}).join("")}
      ${st.secArr[0]&&st.secArr[0].p>60?`<p class="small" style="color:#ff9d5c;margin-top:5px">⚠️ ${(STK_SECTOR[st.secArr[0].k]||{}).n} 업종에 ${st.secArr[0].p.toFixed(0)}%가 몰려 있습니다 — 업종 악재 한 방에 크게 흔들립니다.</p>`:""}`:""}
  </div>
  <div class="card"><h3>📊 기간별 실현손익 <span class="small">— 팔아서 확정한 손익만 셉니다</span></h3>
    <div class="tblScroll"><table><tr><th>기간</th><th>매도 건수</th><th>승률</th><th>실현손익</th></tr>
    ${STK_PERIODS.map(([d,lab])=>{
      const r=stkRealIn(d);
      const col=r.sum>0?"#f85149":r.sum<0?"#58a6ff":"var(--sub)";
      return `<tr><td><b>${lab}</b></td>
        <td class="small">${r.n?r.n+"건":"—"}</td>
        <td class="small">${r.n?Math.round(r.win/r.n*100)+"%":"—"}</td>
        <td style="color:${col};font-weight:800">${r.n?(r.sum>=0?"+":"")+(r.sum/1e8).toFixed(2)+"억":"—"}</td></tr>`;
    }).join("")}
    </table></div>
    ${(function(){
      const ev=stkEval(), inv=stkInvCost();
      const un=ev-inv;
      return `<p class="small" style="margin-top:7px">지금 들고 있는 종목의 <b>평가손익</b>은
        <b style="color:${un>=0?"#f85149":"#58a6ff"}">${un>=0?"+":""}${(un/1e8).toFixed(2)}억</b>입니다
        <span style="color:var(--sub)">(평가액 ${stkMoney(ev)} · 매입원가 ${stkMoney(inv)})</span> — 위 표에는 들어가지 않습니다.</p>`;
    })()}
  </div>
  ${(function(){
    const R2=stkTx().filter(x=>x.k==="sell"||x.k==="cover"||x.k==="call"||x.k==="shcall");
    if(!R2.length) return "";
    return `<div class="card"><h3>🔁 매매 이력 <span class="small">— 사서 판 종목의 성적표</span></h3>
      <div class="tblScroll"><table>
        <tr><th>종목</th><th>매수 → 매도</th><th>보유</th><th>수량</th><th>수익률</th><th>실현손익</th></tr>
        ${R2.slice(0,40).map(x=>{
          const ret=(x.ret!=null)?x.ret:(x.bavg>0?((x.px-x.bavg)/x.bavg):null);
          const col=(x.real||0)>=0?"#f85149":"#58a6ff";
          const held=(x.hold!=null)?(x.hold>=365?`${(x.hold/365).toFixed(1)}년`:`${x.hold}일`):"—";
          return `<tr ${x.sid?`class="clickable" onclick="stkOpen(${x.sid})"`:""}>
            <td><b>${x.n||"-"}</b>${x.k!=="sell"?` <span class="small" style="color:var(--sub)">${x.k==="cover"?"숏커버":"강제청산"}</span>`:""}</td>
            <td class="small">${x.bavg?stkWon(x.bavg):"—"} → ${x.px?stkWon(x.px):"—"}원</td>
            <td class="small">${held}</td>
            <td class="small">${x.q?x.q.toLocaleString()+"주":"—"}</td>
            <td style="color:${col};font-weight:800">${ret!=null?((ret>=0?"+":"")+(ret*100).toFixed(1)+"%"):"—"}</td>
            <td style="color:${col};font-weight:800">${x.real!=null?((x.real>=0?"+":"")+(x.real/1e8).toFixed(2)+"억"):"—"}</td></tr>`;
        }).join("")}
      </table></div>
      <p class="small" style="margin-top:6px;color:var(--sub)">최근 ${Math.min(40,R2.length)}건 · 매수 단가는 그때의 평균 매입가입니다.</p>
    </div>`;
  })()}
  <div class="card"><h3>📜 거래 내역 <span class="small">— 최근 ${T.length}건</span></h3>
    ${T.length?T.slice(0,40).map(x=>{
      const K={buy:["📥","매수","#ff8080"], sell:["📤","매도","#9ecbff"], call:["🔨","반대매매","#f85149"],
               borrow:["💳","융자","#ff9d5c"], repay:["💵","상환","#3fb950"],
               short:["📉","공매도","#c4b5fd"], cover:["📈","숏커버","#7ee2a8"], shcall:["🔨","공매도 강제청산","#f85149"],
               loanshark:["🩸","사채","#f85149"], sharkpay:["💵","사채 상환","#3fb950"],
               fut:["📊","선물 진입","#a78bfa"], futclose:["📊","선물 청산","#a78bfa"], ipo:["🆕","공모 배정","#7ee2a8"]}[x.k]||["·","",""];
      return `<div class="stkNews" ${x.sid?`onclick="stkOpen(${x.sid})"`:""}>
        <span class="stkNewsIc">${K[0]}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px">${x.n?`<b>${x.n}</b> `:""}<span style="color:${K[2]}">${K[1]}</span>
            ${x.q?` ${x.q.toLocaleString()}주 @${x.px.toLocaleString()}원`:""} · ${stkMoney(x.amt)}
            ${x.auto?'<span class="stkTag">예약 체결</span>':""}</div>
          <div class="small" style="color:var(--sub)">${dateLabel(x.d)}${x.real!=null?` · 실현 <b style="color:${x.real>=0?"#f85149":"#58a6ff"}">${x.real>=0?"+":""}${(x.real/1e8).toFixed(2)}억</b>`:""}</div>
        </div></div>`;}).join("")
      :`<p class="small" style="padding:10px 2px">거래 기록이 없습니다.</p>`}
  </div>`;
}
/* 📉 공매도 현황 */
function stkShortCard(){
  const L=stkShortList();
  const M=me();
  const room=stkShortRoom();
  return `<div class="card"><h3>📉 공매도 <span class="small">— 증거금 ${Math.round(STK_SH_MARGIN*100)}% · 대여 수수료 일 ${(STK_SH_FEE*100).toFixed(3)}%</span></h3>
    <div class="msg warn" style="margin-bottom:8px">
      주식을 <b>빌려서 먼저 팔고</b> 나중에 되삽니다. 내려가면 벌지만, <b>올라가면 손실에 상한이 없습니다.</b>
      공매도가 몰린 종목이 급등하면 <b>숏스퀴즈</b>가 걸리고, 증거금이 ${Math.round(STK_SH_CALL*100)}% 아래로 내려가면 강제로 되사게 됩니다.
      <span class="small">종목 상세에서 <b>📉 공매도 / 📈 숏커버</b> 버튼으로 거래합니다.</span></div>
    <div class="stkSum" style="margin-bottom:8px">
      <div><span>공매도 잔고</span><b>${L.length}종목 ${stkMoney(stkShortVal())}</b></div>
      <div><span>평가손익</span><b style="color:${stkShortPL()>=0?"#f85149":"#58a6ff"}">${stkShortPL()>=0?"+":""}${stkMoney(stkShortPL())}</b></div>
      <div><span>증거금 여력</span><b style="color:${room<0?"#f85149":"var(--green)"}">${stkMoney(room)}</b></div>
      <div><span>누적 대여료</span><b style="color:#ff9d5c">${(M.stkShFee||0).toFixed(2)}억</b></div>
    </div>
    ${L.length?L.map(({s,q,avg})=>{ const d=(avg-s.p)/avg*100, c=d>=0?"#f85149":"#58a6ff";
      return `<div class="stkRow" onclick="stkOpen(${s.id})">
        <div class="stkMain"><div class="stkN"><b>${s.n}</b>
          <span class="stkTier" style="color:#a78bfa;border-color:#a78bfa66">공매도</span></div>
          <div class="small" style="color:var(--sub)">${q.toLocaleString()}주 · 매도가 ${stkWon(avg)} · 현재 ${stkWon(s.p)}</div></div>
        ${stkSpark(s)}
        <div class="stkP"><b style="color:${c}">${d>=0?"+":""}${d.toFixed(1)}%</b>
          <span class="small" style="color:${c}">${d>=0?"+":""}${stkMoney((avg-s.p)*q)}</span></div>
      </div>`;}).join("")
      :`<p class="small" style="padding:8px 2px">공매도 잔고가 없습니다.</p>`}
  </div>`;
}
/* 🩸 사채 */
function stkDebtCard(){
  const M=me(), D=stkDebt();
  const net=stkNet();
  const days=D>0 ? (G.day||0)-(M.stkDebtAt||0) : 0;
  return `<div class="card" style="border-color:#f8514944"><h3>🩸 사채 <span class="small">— 연 ${(stkDebtRate()*365*100).toFixed(0)}%${G.jobless?" (무직 가산)":""} · ${G.jobless?"상환 능력":"감독 연봉"}의 ${STK_DEBT_MAX}배까지</span></h3>
    ${G.jobless?`<div class="msg warn" style="margin-bottom:8px">🕊️ <b>무직 상태에서도 빌릴 수 있습니다.</b>
      한도는 마지막 연봉과 평판으로 잡고(현재 상환 능력 <b>${stkDebtSal().toFixed(2)}억</b>), 이자는 <b>${Math.round((STK_DEBT_JOB_K-1)*100)}% 더</b> 붙습니다.</div>`:""}
    <div class="msg warn" style="margin-bottom:8px">
      신용 한도가 막혀도 여기서는 빌려줍니다. 대신 <b>이자가 연 ${(stkDebtRate()*365*100).toFixed(0)}%</b>이고, 담보도 심사도 없습니다.<br>
      갚지 못하고 시간이 흐르면 <b>독촉 → 구단주 신뢰 하락 → 기사</b>로 번지고,
      빚이 자산을 크게 넘어선 채 넉 달이 지나면 <b style="color:#f85149">개인 파산</b>합니다 — 주식과 부동산이 전부 넘어갑니다.</div>
    <div class="stkSum" style="margin-bottom:8px">
      <div><span>사채 잔액</span><b style="color:${D>0?"#f85149":"var(--sub)"}">${stkMoney(D)}</b></div>
      <div><span>경과</span><b>${D>0?days+"일":"—"}</b></div>
      <div><span>추가 한도</span><b>${stkDebtMax().toFixed(1)}억</b></div>
      <div><span>누적 이자</span><b style="color:#f85149">${(M.stkDebtInt||0).toFixed(2)}억</b></div>
      <div><span>순자산</span><b style="color:${net>=0?"var(--green)":"#f85149"}">${stkMoney(net)}</b></div>
      ${M.bankrupt?`<div><span>파산 이력</span><b style="color:#f85149">${M.bankrupt}회</b></div>`:""}
    </div>
    ${D>0&&net<0?`<div class="msg warn">⚠️ 빚이 자산을 넘어섰습니다. 이대로 <b>${Math.max(0,120-days)}일</b> 뒤면 파산합니다.</div>`:""}
    <div class="stkOrder">
      <input type="text" inputmode="numeric" placeholder="금액(억)" value="${STK_DBAMT}" oninput="stkSetDb(this.value)"
        style="flex:1;min-width:100px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid #f8514966;border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="stkDbBtn(5)">+5억</button>
      <button class="mini" onclick="stkDbBtn(20)">+20억</button>
      <button class="mini" onclick="stkDbBtn('max')">최대</button>
    </div>
    <div style="display:flex;gap:6px;margin-top:7px">
      <button class="mini" style="flex:1;padding:10px;background:#2a0f0f;border-color:#f85149;color:#ff8080;font-weight:700" onclick="stkDebtBorrow((parseFloat(STK_DBAMT)||0)*1e8)">🩸 사채 빌리기</button>
      <button class="mini" style="flex:1;padding:10px;border-color:var(--green);color:var(--green)" onclick="stkDebtRepay((parseFloat(STK_DBAMT)||0)*1e8)">💵 상환</button>
    </div>
  </div>`;
}
let STK_DBAMT="";
function stkSetDb(v){ STK_DBAMT=String(v||"").replace(/[^0-9.]/g,""); }
function stkDbBtn(k){
  if(k==="max") STK_DBAMT=stkDebtMax().toFixed(1);
  else STK_DBAMT=String(Math.round(((parseFloat(STK_DBAMT)||0)+k)*10)/10);
  show("mylife");
}
/* 📈 지수 · 테마 배너 */
function stkIdxCard(){
  const S=stkState(); if(!S) return "";
  const I=stkIdxHist();
  const idx=stkIndex();
  const prev=I.length>1?I[I.length-2]:idx;
  const ch=prev>0?(idx-prev)/prev*100:0;
  const col=ch>0?"#f85149":ch<0?"#58a6ff":"var(--sub)";
  const H=I.slice(-40);
  let spark="";
  if(H.length>2){
    const lo=Math.min(...H), hi=Math.max(...H), sp=Math.max(0.01,hi-lo);
    const d=H.map((v,i)=>`${i?"L":"M"}${(i/(H.length-1)*180).toFixed(1)},${((1-(v-lo)/sp)*26+2).toFixed(1)}`).join(" ");
    spark=`<svg viewBox="0 0 180 30" style="width:180px;height:30px"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6"/></svg>`;
  }
  const T=S.theme;
  return `<div class="card" style="padding:10px 12px">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div><span class="small" style="color:var(--sub);display:block">개리그 종합지수</span>
        <b style="font-size:22px;color:${col}">${idx.toFixed(2)}</b>
        <span style="color:${col};font-weight:700;margin-left:6px">${ch>=0?"▲":"▼"} ${Math.abs(ch).toFixed(2)}%</span></div>
      ${spark}
      ${T?`<div style="margin-left:auto;text-align:right">
        <span class="small" style="color:var(--sub);display:block">🎪 지금 뜨는 테마</span>
        <b style="color:#e3b341">${T.n}</b>
        <span class="small" style="display:block;color:var(--sub)">${T.s.map(k=>(STK_SECTOR[k]||{}).n).join(" · ")} ·
          ${(G.day||0)-T.d < T.up ? '<span style="color:#f85149">달아오르는 중</span>' : '<span style="color:#58a6ff">식는 중</span>'}</span></div>`:""}
    </div>
  </div>`;
}
/* 📊 지수선물 */
function stkFutCard(){
  const M=me(), F=stkFut(), idx=stkIndex();
  const q=parseInt(STK_FQ,10)||0;
  const need=Math.round(idx*q*STK_FUT_MULT*(STK_FUT_MARGIN+STK_FUT_FEE));
  const r=stkFutRatio(), pl=stkFutPL();
  return `<div class="card" style="border-color:#a78bfa44"><h3>📊 지수선물
      <span class="small">— 증거금 ${Math.round(STK_FUT_MARGIN*100)}% · 1계약 = 지수 × ${(STK_FUT_MULT/1e4).toLocaleString()}만원</span></h3>
    <div class="msg warn" style="margin-bottom:8px">
      지수가 <b>1% 움직이면 내 돈은 10%</b> 움직입니다. 방향만 맞히면 되지만, 반대로 가면 순식간에 증거금이 녹습니다.
      유지 증거금 <b>${(STK_FUT_CALL*100).toFixed(0)}%</b> 아래로 내려가면 <b>강제 청산</b>되고, 분기 만기에는 무조건 정산됩니다.</div>
    <div class="stkSum" style="margin-bottom:8px">
      <div><span>현재 지수</span><b>${idx.toFixed(2)}</b></div>
      ${F?`<div><span>포지션</span><b style="color:${F.side==="long"?"#f85149":"#58a6ff"}">${F.side==="long"?"매수(롱)":"매도(숏)"} ${F.q}계약</b></div>
      <div><span>진입 지수</span><b>${F.entry.toFixed(2)}</b></div>
      <div><span>평가손익</span><b style="color:${pl>=0?"#f85149":"#58a6ff"}">${pl>=0?"+":""}${stkMoney(pl)}</b></div>
      <div><span>증거금률</span><b style="color:${r<STK_FUT_CALL?"#f85149":r<STK_FUT_CALL+0.04?"#ff9d5c":"var(--green)"}">${(r*100).toFixed(1)}%</b></div>
      <div><span>만기</span><b>D-${Math.max(0,F.due-(G.day||0))}</b></div>`
      :`<div><span>포지션</span><b style="color:var(--sub)">없음</b></div>`}
    </div>
    ${F?`<button class="mini" style="width:100%;padding:10px;border-color:var(--gold);color:var(--gold);font-weight:700" onclick="stkFutClose()">📊 지금 청산 (손익 ${pl>=0?"+":""}${(pl/1e8).toFixed(2)}억 확정)</button>`
    :`<div class="stkOrder">
      <input type="text" inputmode="numeric" placeholder="계약 수" value="${STK_FQ}" oninput="stkSetFq(this.value)"
        style="flex:1;min-width:90px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid #a78bfa66;border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="STK_FQ=String((parseInt(STK_FQ,10)||0)+1);show('mylife')">+1</button>
      <button class="mini" onclick="STK_FQ=String((parseInt(STK_FQ,10)||0)+5);show('mylife')">+5</button>
      <button class="mini" onclick="STK_FQ=String(Math.max(0,Math.floor(me().cash*1e8/(stkIndex()*STK_FUT_MULT*(STK_FUT_MARGIN+STK_FUT_FEE)))));show('mylife')">최대</button>
    </div>
    <div class="small" style="margin:6px 0;color:var(--sub)">${q>0?`증거금 <b class="money">${stkMoney(need)}</b> · 계약금액 ${stkMoney(idx*q*STK_FUT_MULT)}
      <span style="opacity:.75">— 지수 1% 변동 시 손익 ${stkMoney(idx*q*STK_FUT_MULT*0.01)}</span>`:`보유 현금 <b class="money">${moneyEok(M.cash)}</b>`}</div>
    <div style="display:flex;gap:6px">
      <button class="mini" style="flex:1;padding:10px;background:#3a1414;border-color:#f85149;color:#ff8080;font-weight:700" onclick="stkFutOpen('long')">📈 매수(롱) — 오른다에 건다</button>
      <button class="mini" style="flex:1;padding:10px;background:#0f2233;border-color:#58a6ff;color:#9ecbff;font-weight:700" onclick="stkFutOpen('short')">📉 매도(숏) — 내린다에 건다</button>
    </div>`}
  </div>`;
}
/* 🆕 공모 청약 */
function stkIpoCard(){
  const P=stkIpo(), M=me();
  if(!P) return `<div class="card"><h3>🆕 공모 청약</h3>
    <p class="small" style="padding:8px 2px">지금 진행 중인 공모가 없습니다. 새 회사가 상장을 준비하면 여기에 뜹니다.</p></div>`;
  const d=G.day||0;
  const q=parseInt(STK_IQ,10)||0;
  const SC=STK_SECTOR[P.sec]||{n:"기타",ic:"🏢"}, T=STK_TIER[P.tier];
  return `<div class="card" style="border-color:#7ee2a844"><h3>🆕 공모 청약 — ${P.n}
      <span class="stkTier" style="color:${T.c};border-color:${T.c}44">${T.n}</span></h3>
    <div class="stkSum" style="margin-bottom:8px">
      <div><span>업종</span><b>${SC.ic} ${SC.n}</b></div>
      <div><span>공모가</span><b>${P.px.toLocaleString()}원</b></div>
      <div><span>청약 마감</span><b>${P.done?"마감":"D-"+Math.max(0,(P.closeIn!=null?P.closeIn:(P.close||0)-d))}</b></div>
      <div><span>상장일</span><b>D-${Math.max(0,(P.listIn!=null?P.listIn:(P.list||0)-d))}</b></div>
      ${P.done?`<div><span>경쟁률</span><b style="color:var(--gold)">${P.rate.toLocaleString()}:1</b></div>
      <div><span>배정</span><b>${P.got.toLocaleString()}주</b></div>`
      :`<div><span>내 청약</span><b>${(P.want||0).toLocaleString()}주</b></div>`}
    </div>
    ${P.done?`<div class="msg info">청약이 마감됐습니다. 상장일에 시초가가 정해집니다 —
      경쟁률이 높을수록 뜨겁게 출발하지만, 공모가를 밑돌기도 합니다.</div>`
    :`<div class="msg info" style="margin-bottom:8px">청약증거금은 <b>전액</b> 먼저 냅니다. 경쟁률만큼 나눠 배정받고 <b>나머지는 환불</b>됩니다.
      상장일 시초가는 공모가의 <b>0.4~2.0배</b> 사이에서 정해집니다 — 따상도, 공모가 붕괴도 있습니다.</div>
    <div class="stkOrder">
      <input type="text" inputmode="numeric" placeholder="청약 수량" value="${STK_IQ}" oninput="stkSetIq(this.value)"
        style="flex:1;min-width:100px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="STK_IQ=String((parseInt(STK_IQ,10)||0)+1000);show('mylife')">+1,000</button>
      <button class="mini" onclick="STK_IQ=String(Math.max(0,Math.floor(me().cash*1e8/stkIpo().px)));show('mylife')">최대</button>
    </div>
    <div class="small" style="margin:6px 0;color:var(--sub)">${q>0?`증거금 <b class="money">${stkMoney(q*P.px)}</b> 필요`:`보유 현금 <b class="money">${moneyEok(M.cash)}</b>`}</div>
    <button class="mini" style="width:100%;padding:10px;border-color:var(--green);color:var(--green);font-weight:700" onclick="stkIpoApply()">🆕 청약 신청</button>
    ${(P.want|0)>0?`<button class="mini" style="width:100%;padding:9px;margin-top:6px;border-color:var(--red);color:var(--red)"
      onclick="stkIpoCancel()">↩️ 청약 취소 — ${(P.want|0).toLocaleString()}주 · ${stkMoney((P.want|0)*P.px)} 환불</button>`:""}`}
  </div>`;
}
let STK_MGAMT="";
function stkSetMg(v){ STK_MGAMT=String(v||"").replace(/[^0-9.]/g,""); }
function stkMgBtn(k){
  if(k==="max") STK_MGAMT=(stkLoanMax()/1e8).toFixed(1);
  else STK_MGAMT=String(Math.round(((parseFloat(STK_MGAMT)||0)+k)*10)/10);
  show("mylife");
}
/* 📰 공시·뉴스 — 내가 가진 종목의 소식은 위로 끌어올리고 색으로 구분한다 */
const STK_NK={
  "tipHit" :{ic:"🎯", c:"#f85149", n:"찌라시 적중"},
  "tipHitD":{ic:"🎯", c:"#58a6ff", n:"찌라시 적중"},
  "tipMiss":{ic:"💨", c:"#8b949e", n:"낭설"},
  "order":{ic:"📋", c:"#e3b341", n:"예약 체결"},
  "call" :{ic:"🔨", c:"#f85149", n:"반대매매"},
  "squeeze":{ic:"🚀", c:"#f85149", n:"숏스퀴즈"},
  "debt" :{ic:"🩸", c:"#f85149", n:"사채"},
  "bank" :{ic:"💀", c:"#f85149", n:"파산"},
  "fut"  :{ic:"📊", c:"#a78bfa", n:"선물"},
  "theme":{ic:"🎪", c:"#e3b341", n:"테마"},
  "ipo"  :{ic:"🆕", c:"#7ee2a8", n:"공모"},
  "good" :{ic:"📈", c:"#f85149", n:"호재"},
  "bad"  :{ic:"📉", c:"#58a6ff", n:"악재"},
  "earn+":{ic:"🎉", c:"#f85149", n:"어닝 서프라이즈"},
  "earn-":{ic:"😨", c:"#58a6ff", n:"어닝 쇼크"},
  "macro":{ic:"🌐", c:"#e3b341", n:"시황"},
  "warn" :{ic:"⚠️", c:"#ff9d5c", n:"관리종목"},
  "delist":{ic:"💥",c:"#f85149", n:"상장폐지"},
  "div"  :{ic:"💰", c:"#3fb950", n:"배당"},
  "season":{ic:"📊",c:"#a9b4c0", n:"실적 시즌"}
};
let STK_NF="all";
function stkSetNF(k){ STK_NF=k; show("mylife"); }
function stkNewsCard(solo){
  const S=stkState(); if(!S) return "";
  const M=me();
  let L=(S.news||[]).slice();
  /* 옛 세이브의 공시 기록도 같은 목록으로 합친다 */
  for(const x of (S.log||[])) if(x&&x.k==="delist") L.push({d:x.d, k:"delist", t:`${x.n} 상장폐지 — 정리매매 종료`});
  L.sort((a,b)=>b.d-a.d);
  const mine=(x)=>x.id && M.stkInv && M.stkInv[x.id] && M.stkInv[x.id].q>0;
  if(STK_NF==="mine") L=L.filter(mine);
  else if(STK_NF==="earn") L=L.filter(x=>x.k==="earn+"||x.k==="earn-"||x.k==="season");
  else if(STK_NF==="risk") L=L.filter(x=>x.k==="warn"||x.k==="delist"||x.k==="bad"||x.k==="earn-"||x.k==="call");
  else if(STK_NF==="tip")  L=L.filter(x=>x.k==="tipHit"||x.k==="tipHitD"||x.k==="tipMiss");
  if(!L.length && STK_NF==="all" && !solo) return "";
  const chip=(k,l)=>`<button class="mini ${STK_NF===k?"sel":""}" onclick="stkSetNF('${k}')">${l}</button>`;
  const heldN=(S.news||[]).filter(mine).length;
  return `<div class="card"><h3>📰 공시 · 뉴스
      <span class="small">— 최근 ${(S.news||[]).length}건${heldN?` · 보유 종목 ${heldN}건`:""}</span></h3>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
      ${chip("all","전체")}${chip("mine","⭐ 내 종목")}${chip("earn","📊 실적")}${chip("tip","🕵️ 찌라시 결말")}${chip("risk","⚠️ 위험")}</div>
    ${L.length?L.slice(0,26).map(x=>{
      const K=STK_NK[x.k]||STK_NK.good;
      const s=x.id?stkById(x.id):null;
      const own=mine(x);
      return `<div class="stkNews${own?" mine":""}" ${s?`onclick="stkOpen(${s.id})"`:""}>
        <span class="stkNewsIc">${K.ic}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;line-height:1.5">${x.t}</div>
          <div class="small" style="color:var(--sub)">${dateLabel(x.d)} · <span style="color:${K.c}">${K.n}</span>${own?' · <b style="color:var(--gold)">보유 중</b>':""}</div>
        </div></div>`;}).join("")
      :`<p class="small" style="padding:10px 2px">해당하는 소식이 없습니다.</p>`}
  </div>`;
}

let meTab="home", meGiftSel="", HML_AMT="", DON_AMT="", DON_ANON=0;
function donSetAmt(v){ DON_AMT=String(v||"").replace(/[^0-9.]/g,""); }
function donToggleAnon(){ DON_ANON=DON_ANON?0:1; show("mylife"); }
function hmlSet(v){ HML_AMT=String(v||"").replace(/[^0-9.]/g,""); }
function meSelGift(k){ meGiftSel=(meGiftSel===k)?"":k; show("mylife"); }
function meSetTab(k){
  /* ⚠ 제보 — 「결과가 나온 상태에서 다른 메뉴 갔다 들어와도 결과 화면이 유지된다」.
     판을 떠나면 결과는 치운다. 진행 중인 블랙잭 핸드(판돈이 이미 걸린 판)는 남긴다. */
  if(meTab==="gam" && k!=="gam") gamLeave();
  meTab=k; show("mylife");
}
function gamLeave(){
  try{
    GAM_LAST=null; GAM_BUSY=null;
    const g=gamOf();
    if(g.bj && g.bj.stage!=="play") g.bj=null;    // 끝난 판은 치운다 (진행 중이면 그대로)
    const r=document.getElementById("gmRain"); if(r) r.remove();
  }catch(e){}
}
/* ⚖️ 미납금 상환 화면 — 주식·부동산으로 불린 돈으로도 갚을 수 있다 */
let DEBT_AMT="";
function debtSetAmt(v){ DEBT_AMT=String(v||"").replace(/[^0-9.]/g,""); }
function mgrDebtCard(){
  const M=me(), due=Math.round((M.debt||0)*100)/100;
  if(due<=0) return `<div class="card"><h3>⚖️ 미납금</h3><p class="small">갚을 미납금이 없습니다.</p></div>`;
  const a=Math.round((parseFloat(DEBT_AMT)||0)*100)/100;
  const canNow=Math.min(due, Math.round(M.cash*100)/100);
  let stk=0, prop=0, dep=0;
  try{ stk=stkEval()/1e8; }catch(e){}
  try{ prop=propTotal(); }catch(e){}
  try{ dep=bankDepTotal(); }catch(e){}
  return `<div class="card" style="border-color:#f8514966">
    <h3>⚖️ 미납금 <span class="small">— 사임 위약금 · 징계금</span></h3>
    <div class="stkSum">
      <div><span>남은 미납금</span><b style="color:#f85149">${due.toFixed(2)}억</b></div>
      <div><span>보유 현금</span><b class="money">${moneyEok(M.cash)}</b></div>
      <div><span>지금 갚을 수 있는 금액</span><b>${canNow.toFixed(2)}억</b></div>
      <div><span>월급 공제</span><b>${G.jobless?"없음 (무직)":"월급의 절반"}</b></div>
    </div>
    ${G.jobless?`<div class="msg warn" style="margin-top:9px">🕊️ <b>무직이라 월급 공제가 없습니다.</b> 직접 갚지 않으면 미납금은 줄지 않습니다.</div>`:""}
    ${(canNow<due)?`<div class="msg" style="margin-top:9px;background:#1f6feb22;border-color:#1f6feb66">
      💡 현금이 모자랍니다. <b>주식 ${stk.toFixed(1)}억 · 부동산 ${prop.toFixed(1)}억 · 예·적금 ${dep.toFixed(1)}억</b>을
      팔거나 해지해 현금으로 만든 뒤 갚을 수 있습니다.</div>`:""}
    <div class="stkOrder" style="margin-top:10px">
      <input type="text" inputmode="decimal" placeholder="상환 금액(억)" value="${DEBT_AMT}" oninput="debtSetAmt(this.value)"
        style="flex:1;min-width:110px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="DEBT_AMT=String(Math.round(((parseFloat(DEBT_AMT)||0)+1)*100)/100);show('mylife')">+1</button>
      <button class="mini" onclick="DEBT_AMT='${canNow.toFixed(2)}';show('mylife')">가능한 전액</button>
    </div>
    <button class="mini" style="width:100%;margin-top:10px;padding:11px;font-size:15px;border-color:var(--green);color:var(--green)"
      onclick="mgrDebtPay('${a>0?a:canNow}')">⚖️ ${a>0?a.toFixed(2)+"억 ":""}갚기</button>
    <p class="small" style="margin-top:9px;color:var(--sub)">미납금은 <b>순자산에서 부채로 잡힙니다.</b> 남아 있는 동안 감독 평판에도 영향을 줍니다.</p>
  </div>`;
}

