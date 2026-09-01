"use strict";
/* ---------- 팀 선택 화면 ---------- */
/* 팬 열정도 — 팬 "수"가 아니라 실제로 경기장에 오는 사람 수로 말한다.
   구장이 작아도 꽉 채우는 팬들이 진짜 열정적인 팬이다. */
function fanZeal(avg){
  return avg>=15000 ? {n:"🔥 광적임",       c:"#ff7b5c"}
       : avg>=9000  ? {n:"매우 열정적임",   c:"#f0883e"}
       : avg>=5500  ? {n:"열정적임",        c:"#e3b341"}
       : avg>=3000  ? {n:"꾸준함",          c:"#3fb950"}
       : avg>=1800  ? {n:"차분함",          c:"#58a6ff"}
                    : {n:"조용함",          c:"#a9b4c0"};
}
let pickSel=null;   // 팀 선택 화면에서 지금 들여다보고 있는 구단
function pickTeam(id){ pickSel=id; renderTeamPick(); }
function pickCancel(){ pickSel=null; renderTeamPick(); }
/* 선택한 구단의 명함 — 홈구장·평균 관중·예산·구단 형태를 보고 결정한다 */
/* ── 팀 선택 화면용 추정 ────────────────────────────────────
   아직 게임(G)이 없어서 실제 구단 객체를 볼 수 없다. 새 게임을 시작할 때
   구단에 매겨지는 값과 똑같은 식으로 미리 계산해 보여 준다. */
/* 구단별 기본 훈련시설 등급.
   기업구단은 모기업이 클럽하우스에 돈을 쓰므로 최소 3등급을 보장한다.
   그 위로는 실제로 인프라 투자에 앞서 온 구단들을 따로 얹는다 — 포항이 독보적이다. */
const TRAIN_LV_BASE={
  pohang:5,                                        // 리그 최고 수준의 클럽하우스·유스 인프라
  jeonbuk:4, ulsan:4, seoul:4, suwon:4, gwangju:4  // 훈련 환경이 좋기로 이름난 구단들
};
/* 구단별 기본 유스 아카데미 등급.
   유스 명문은 훈련시설과 겹치기도 하지만 같지는 않다 —
   시설은 돈으로 짓지만 아카데미는 세월과 지도자로 쌓인다. */
const YOUTH_LV_BASE={
  pohang:5, ulsan:5,                                   // 수십 년 이어온 유스 명문
  jeonbuk:4, seoul:4, suwon:4, incheon:4, gwangju:4,   // 1군 배출이 꾸준한 아카데미
  daejeon:3, busan:3, jeju:3, gangwon:3, seoule:3, jeonnam:3, anyang:3
};
/* 🔧 기본값 재조정 — 개발 노트: 「기업구단과 시민구단의 훈련시설과 유스 아카데미 레벨 기본값이
   높은 편이네? 시민구단은 별 1~3개, 기업구단은 2~4개로 기본값을 정하자. 그게 난이도가 맞지」.
   ─ 10단계 눈금에서 시작 등급을 시민(·컨소시엄) 1~3단계 · 기업 2~4단계 밴드로 눌러 놓는다.
     명문(YOUTH_LV_BASE 표의 5)은 제 밴드의 꼭대기, 그 아래는 밴드 안에서 사상한다.
     10단계까지는 예산 증액 요청으로 감독이 직접 올려 가는 길이다 — 그게 게임의 난이도다. */
function facBandOf(id){
  const k=(typeof CLUB_TYPE!=="undefined") && CLUB_TYPE[id] && CLUB_TYPE[id].k;
  if(k==="army") return {lo:1, hi:1};
  if(k==="corp") return {lo:2, hi:4};
  return {lo:1, hi:3};                       // 시민·도민·컨소시엄
}
function baseYouthLv(id, div){
  const B=facBandOf(id);
  if(B.hi<=1) return 1;                                  // 군경구단은 아카데미가 없다
  let v = (div===1 ? B.lo+1 : B.lo);                     // 1부가 반 걸음 앞선다
  const p=YOUTH_LV_BASE[id];                             // 예전 명성표(1~5) — 밴드 안으로 사상
  if(p) v = B.lo + Math.round((p-1)/4*(B.hi-B.lo));
  return clamp(v, B.lo, B.hi);
}
/* ═══ 🔟 시설 10단계 ═══════════════════════════════════════════════════════
   ⚠ 제보 원문 — 「유스 아카데미와 훈련시설을 10단계로 만들자. 지금 현재는 5단계가 최대치고
      초록별이잖아? 6단계부터는 빨간별이 추가되는거지. (빨간별)(초록별)(초록별)(초록별)(초록별)
      이런식으로 말이야. 지금 현재 5단계 능력을 그대로 10단계로 나눠서 구현해.
      즉 현재 5단계가 10단계와 같은 성능인거지」.
   ─ 설계: 성능 축은 그대로 두고 눈금만 두 배로 쪼갠다.
     · lvEff(l) 이 10단계 눈금을 예전 1~5 성능 축으로 환산한다 — lvEff(10)=5 (예전 5단계 성능).
     · 모든 효과 공식은 lvEff 를 쓴다. 예전 세이브(1~5)는 lv10From5 로 성능 보존 변환.
     · 별 표시: 1~5단계 초록별, 6단계부터 왼쪽부터 빨간별로 바뀐다 — 6단계 = ★(빨)★★★★(초). */
const FAC_MAX=10;
function lvEff(l){ return 1+(clamp(l||1,1,FAC_MAX)-1)*(4/9); }
function lv10From5(l5){ return clamp(Math.round(1+((l5||1)-1)*2.25), 1, FAC_MAX); }
function facStars(l, size){
  l=clamp(Math.round(l||1),1,FAC_MAX);
  const red=Math.max(0,l-5), green=l<=5?l:10-l, empty=Math.max(0,5-red-green);
  return `<b style="${size?`font-size:${size}px;`:""}letter-spacing:1px;white-space:nowrap;font-weight:800">`
    + (red?`<span style="color:#f85149">${"★".repeat(red)}</span>`:"")
    + (green?`<span style="color:var(--green)">${"★".repeat(green)}</span>`:"")
    + (empty?`<span style="color:var(--sub);opacity:.5">${"☆".repeat(empty)}</span>`:"")
    + `</b>`;
}
const YOUTH_LABEL=[null,
  {n:"미미",     c:"var(--red)",   d:"아카데미라 부르기 어려운 수준. 1군에 올릴 재목이 거의 없습니다."},
  {n:"걸음마",   c:"var(--red)",   d:"이제 막 틀을 잡은 아카데미. 아직 배출은 기대하기 어렵습니다."},
  {n:"평범",     c:"var(--sub)",   d:"매년 두어 명이 올라오지만 대부분 자리를 잡지 못합니다."},
  {n:"자리잡음", c:"var(--sub)",   d:"체계가 잡히기 시작했습니다. 쓸 만한 아이가 가끔 나옵니다."},
  {n:"견실",     c:"var(--gold)",  d:"꾸준히 쓸 만한 자원을 배출합니다."},
  {n:"알찬",     c:"var(--gold)",  d:"지역에서 알아주는 아카데미. 배출의 질이 눈에 띄게 오릅니다."},
  {n:"명문",     c:"#58a6ff",      d:"지역 유망주가 먼저 찾아오는 아카데미. 특급이 종종 나옵니다."},
  {n:"전국구",   c:"#58a6ff",      d:"전국의 재목이 모여듭니다. 스카우트들이 상주하는 아카데미입니다."},
  {n:"정상급",   c:"var(--green)", d:"리그 정상급 유스. 해마다 1군감이 올라옵니다."},
  {n:"최고",     c:"var(--green)", d:"리그를 대표하는 유스. 매년 한 명쯤은 리그를 놀라게 합니다."}];
function baseTrainLv(id, div){
  /* 🔧 개발 노트 — 시민 1~3 · 기업 2~4 밴드 (baseYouthLv 와 같은 원칙) */
  const B=facBandOf(id);
  let v = (div===1 ? B.lo+1 : B.lo);
  const p=TRAIN_LV_BASE[id];
  if(p) v = B.lo + Math.round((p-1)/4*(B.hi-B.lo));
  return clamp(v, B.lo, B.hi);
}
const TRAIN_LABEL=[null,
  {n:"열악",     c:"var(--red)",   d:"낡은 훈련장. 성장은 더디고 훈련 중 부상이 잦습니다."},
  {n:"허름",     c:"var(--red)",   d:"손은 봤지만 여전히 부족한 시설. 선수들이 불평합니다."},
  {n:"기본",     c:"var(--sub)",   d:"평범한 시설. 특별할 것도 모자랄 것도 없습니다."},
  {n:"정돈",     c:"var(--sub)",   d:"필요한 것은 갖춘 훈련장. 조금씩 나아지고 있습니다."},
  {n:"양호",     c:"var(--gold)",  d:"관리가 잘 된 클럽하우스. 성장에 도움이 됩니다."},
  {n:"충실",     c:"var(--gold)",  d:"회복실·분석실까지 갖췄습니다. 훈련의 질이 다릅니다."},
  {n:"우수",     c:"#58a6ff",      d:"체계적인 훈련·회복 시설. 유망주가 잘 자랍니다."},
  {n:"첨단",     c:"#58a6ff",      d:"데이터 기반 훈련 시스템. 다른 구단이 견학을 옵니다."},
  {n:"정상급",   c:"var(--green)", d:"리그 정상급 클럽하우스. 선수들이 오고 싶어 하는 환경입니다."},
  {n:"최상",     c:"var(--green)", d:"리그 최고 수준. 특급 유망주가 터질 확률이 가장 높습니다."}];
function pickTrainLv(d, div){ return clamp(baseTrainLv(d.id, div), 1, FAC_MAX); }
/* 매력도 — sponAppealDetail 과 같은 눈금을 쓰되, G 없이 구할 수 있는 항목만 본다 */
function pickAppeal(d, div){
  const s=STADIUM[d.id]||{cap:12000, avg:2500};
  const ovr = d.players ? Math.round(d.players.reduce((a,p)=>a+p[3],0)/d.players.length) : (d.base||65);
  const top = d.players ? Math.max(...d.players.map(p=>p[3])) : (ovr+5);
  const stars = d.players ? d.players.filter(p=>p[3]>=76).length : 0;
  const ct=CLUB_TYPE[d.id] || {k:"civic"};
  const fill=clamp(s.avg/Math.max(1,s.cap), 0, 1);
  let v=14;
  v += clamp(Math.pow(Math.max(0,d.fans||10), 0.78)*1.05, 0, 18);
  v += clamp(s.avg/1500, 0, 10);
  v += clamp((fill-0.32)*15, -6, 7);
  v += (SPON_MARKET[d.id]!=null ? SPON_MARKET[d.id] : 3);
  v += (div===1?9:0);
  v += clamp((ovr-64)*1.1, -6, 10);
  v += clamp((top-72)*1.5 + stars*0.9, 0, 8);
  v += (ct.k==="corp"?6:ct.k==="mixed"?2:ct.k==="army"?-6:0);
  v += clamp((s.cap-12000)/9000, 0, 3.5);
  return clamp(Math.round(v), 8, 100);
}
/* 예상 스폰서 수입 — 실제 계약과 같은 공식으로 뽑는다(난수만 뺀 기대값) */
function pickSponEstimate(d, div){
  const a=pickAppeal(d, div);
  const s=STADIUM[d.id]||{cap:12000, avg:2500};
  const ct=CLUB_TYPE[d.id] || {k:"civic"};
  const main=Math.pow(a/100, 1.9)*58;
  const slot=(k)=>{
    let v=main*SPON_SLOT[k].mul;
    if(k==="naming"){ v*=clamp(s.cap/26000, 0.45, 1.6); if(ct.k!=="corp") v*=0.72; }
    return v;
  };
  const four=sponSlots().reduce((sum,k)=>sum+slot(k), 0);
  let pn=Math.round(Math.pow(a/100, 1.35)*22) + (ct.k==="corp"?2:0);
  pn=clamp(pn, 1, 40);
  const part=pn * main * 0.048;                       // 파트너 평균 계수(종류별 계수 × 금액 변동의 기대값)
  return {appeal:a, four:Math.round(four*10)/10, partners:pn,
          part:Math.round(part*10)/10, total:Math.round((four+part)*10)/10,
          tier:a>=68?"전국구 브랜드":a>=42?"중견 기업":"지역 업체"};
}
function pickPanel(d, div){
  const s=STADIUM[d.id]||{n:`${d.short} 홈구장`, cap:12000, avg:2500};
  const ct=clubType({id:d.id, name:d.name});
  const ovr = d.players ? Math.round(d.players.reduce((a,p)=>a+p[3],0)/d.players.length) : (d.base||65);
  // 실명 로스터가 있으면 합산, 없으면(자동 생성 구단) 주전·로테이션·유망주 구성으로 추정한다
  const wage = d.players
    ? Math.round(d.players.reduce((a,p)=>a+wageExpect(p[3], !!p[4], div),0))
    : Math.round(11*wageExpect(ovr+3,false,div) + 8*wageExpect(ovr-1,false,div) + 7*wageExpect(ovr-6,false,div));
  const wageNote = d.players ? "" : " <span class=\"small\">(추정)</span>";
  const tier = ovr>=74?"우승 후보" : ovr>=71?"상위권" : ovr>=68?"중위권" : ovr>=65?"하위권" : "생존 경쟁";
  const nameCol = (d.col==='#1d1d1b'||d.col==='#101010') ? '#eee' : d.col;
  const row=(k,v)=>`<div class="pkRow"><span class="pkK">${k}</span><span class="pkV">${v}</span></div>`;
  /* 🎨 사용자 요청 — 「팀 선택하면 나오는 팝업창도 고급스럽게」. 구단색 투톤 머리 그림 + 엠블럼 */
  const c2=d.col2||"#8b949e";
  const c3=d.col3||null;
  const tri=c3
    ? `--tcBand:linear-gradient(90deg,${d.col} 0 34%,${c3} 34% 66%,${c2} 66% 100%);`
     +`--tcCrest:linear-gradient(145deg,${d.col} 0 36%,${c3} 36% 64%,${c2} 64% 100%);`
    : "";
  return `<div class="pkPanel" style="--tc:${d.col};--tc2:${c2};--tcGlow:${d.col}40;--tc2Glow:${c2}2a;--tcLine:${d.col}55;${tri}">
    <div class="pkHero">
      <div class="pkCrest" style="color:${(typeof isLightColor==="function"&&isLightColor(d.col))?"#0d1117":"#fff"}">${(d.short||d.name).slice(0,2)}</div>
      <div class="pkHead">
        <div class="pkTier">${divName(div)} · ${tier}</div>
        <div class="pkName" style="color:${nameCol}">${d.name}</div>
        <div class="pkBadge" style="color:${ct.c};border-color:${ct.c}66">${ct.ic} ${ct.n} <span class="small" style="opacity:.75">· ${ct.o}</span></div>
      </div>
    </div>
    <p class="small pkDesc">${ct.d}</p>
    ${row("홈구장", `${s.n}`)}
    ${row("수용 인원", `${s.cap.toLocaleString()}석`)}
    ${row("평균 관중", `${s.avg.toLocaleString()}명 <span class="small">(좌석 점유율 ${Math.round(s.avg/s.cap*100)}%)</span>`)}
    ${row("이적 예산", `<b class="money">${d.budget}억</b>`)}
    ${row("연봉 총액", `약 ${wage}억${wageNote}`)}
    ${row("스쿼드 전력", teamStars(ovr, d.short||d.name))}
    ${row("팬 열정도", `<span style="color:${fanZeal(s.avg).c}">${fanZeal(s.avg).n}</span> <span class="small">· 평균 ${s.avg.toLocaleString()}명</span>`)}
    ${(function(){
      /* 🎖️ 제보 — 국군체육부대에는 아카데미가 없다. 등급을 매길 대상이 아니다. */
      if((typeof CLUB_TYPE!=="undefined") && CLUB_TYPE[d.id] && CLUB_TYPE[d.id].k==="army")
        return row("유스 아카데미", `<span style="color:var(--sub)">없음</span>`
          + `<br><span class="small" style="opacity:.65">국군체육부대에는 유스 아카데미가 없습니다 — 선수는 전원 입대로 들어옵니다.</span>`);
      const lv=clamp(baseYouthLv(d.id, div),1,FAC_MAX), L=YOUTH_LABEL[lv];
      return row("유스 아카데미", `${facStars(lv)} <span style="color:${L.c}">${L.n}</span>`
        + `<br><span class="small" style="opacity:.65">${L.d}</span>`);
    })()}
    ${(function(){
      const lv=pickTrainLv(d, div), L=TRAIN_LABEL[lv];
      return row("훈련시설", `${facStars(lv)} <span style="color:${L.c}">${L.n}</span>`
        + `<br><span class="small" style="opacity:.65">${L.d}</span>`);
    })()}
    ${(function(){
      const S=pickSponEstimate(d, div);
      return row("스폰서", `<b class="money">연 ${S.total}억</b> <span class="small">(예상)</span>`
        + `<br><span class="small" style="opacity:.7">구단 매력도 <b>${S.appeal}</b> · ${S.tier}</span>`
        + `<br><span class="small" style="opacity:.65">4대 계약 ${S.four}억 + 공식 파트너 약 ${S.partners}곳 ${S.part}억</span>`);
    })()}
    <div class="pkAsk">이 구단의 감독으로 부임하시겠습니까?</div>
    <div class="pkBtns">
      <button class="pkYes" onclick="startGame('${d.id}')">✅ 예</button>
      <button class="pkNo" onclick="pickCancel()">❌ 아니오</button>
    </div>
  </div>`;
}
/* ═══ ⚙️ 사전 설정 ═══════════════════════════════════════════════════════
   팀 선택 화면에서도 설정을 만질 수 있게 한다(요청).
   폰트·전체화면·종료 확인창은 원래 브라우저에 저장되므로 게임과 무관하게 바로 먹고,
   게임 안에서만 쓰는 값(돌발 행동·골 리플레이·끼워팔기 제의)은 여기 담아 두었다가
   새 게임을 시작할 때 그대로 옮겨 준다. 이미 진행 중인 게임에도 즉시 반영된다. */
const PREOPT_KEY="klm2026_preopt";
function preOpt(){
  try{ const o=JSON.parse(localStorage.getItem(PREOPT_KEY)||"{}"); return (o && typeof o==="object") ? o : {}; }
  catch(e){ return {}; }
}
function setPreOpt(k, v){
  const o=preOpt(); o[k]=v;
  try{ localStorage.setItem(PREOPT_KEY, JSON.stringify(o)); }catch(e){}
  try{ if(G && G.teams && Object.keys(G.teams).length){ G.opt=G.opt||{}; G.opt[k]=v; saveGame(); } }catch(e){}
  try{ if(pickOpt) renderTeamPick(); }catch(e){}
}
/* 새 게임에 사전 설정을 얹는다 — 이미 정해진 값은 덮지 않는다 */
function applyPreOpt(){
  try{
    const o=preOpt(); if(!G) return;
    G.opt=G.opt||{};
    for(const k in o) if(G.opt[k]===undefined) G.opt[k]=o[k];
  }catch(e){}
}
let pickOpt=false;
function togglePickOpt(){ pickOpt=!pickOpt; renderTeamPick(); }
/* ═══ 🧬 게임 시작 전 선수 만들기 ═════════════════════════════════════════
   선수 생성기는 능력치 환산(별↔OVR)·나이·소속 후보를 리그에서 읽는다.
   그래서 팀 선택 화면에서는 「저장하지 않는 임시 리그」를 하나 세우고 그 위에서 만든다.
   만든 선수는 게임이 아니라 브라우저 보관함(preMade)에 쌓이고,
   실제로 게임을 시작하면 그 목록이 그대로 📜 선수 생성 목록으로 따라 들어간다. */
let PREGEN=false;
const PREMADE_KEY="klm2026_premade";
function preMade(){
  try{ const a=JSON.parse(localStorage.getItem(PREMADE_KEY)||"[]"); return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}
function setPreMade(a){
  try{ localStorage.setItem(PREMADE_KEY, JSON.stringify((a||[]).slice(-100))); }catch(e){}
}
/* 임시 세계에서 목록이 바뀔 때마다 보관함에 옮겨 적는다 */
function syncPreMade(){
  try{ if(PREGEN && G && Array.isArray(G.pgMade)) setPreMade(G.pgMade); }catch(e){}
}
function openPreGen(){
  pickOpt=false;
  PREGEN=true;
  try{ newGame(D1[0].id); }catch(e){ PREGEN=false; renderTeamPick(); return; }
  G.introDone=true;
  G.pgMade=preMade();                       // 지금까지 만들어 둔 선수를 이어서 본다
  try{ pgInit(); }catch(e){}
  PGTAB="make";
  try{ document.body.classList.add("preGen"); }catch(e){}
  $("#teamPick").classList.add("hidden");
  $("#app").classList.remove("hidden");
  try{ const b=$("#clubBadge"); if(b){ b.style.background="#21262d"; b.style.color="#e6edf3";
        b.innerHTML=`🧬 선수 만들기<small>게임 시작 전 · 저장되지 않습니다</small>`; } }catch(e){}
  VIEW="playerGen";
  show("playerGen");
}
function closePreGen(){
  syncPreMade();
  PREGEN=false;
  try{ document.body.classList.remove("preGen"); }catch(e){}
  try{ G=null; }catch(e){}
  $("#app").classList.add("hidden");
  $("#teamPick").classList.remove("hidden");
  renderTeamPick();
}
function pickOptPanel(){
  const o=preOpt();
  const cur=getFontScale();
  const wild = o.noWild===false;                      // 기본 = 안 함
  const rep_ = o.replay!==false;                      // 기본 = 보기
  const noSwap = !!o.noSwap;
  const btn=(on,lab,fn)=>`<button class="mini ${on?"sel":""}" onclick="${fn}">${lab}</button>`;
  return `<div class="pkPanel pkOptP">
    <div class="pkHead" style="border-left:6px solid var(--gold)">
      <div class="pkName" style="color:var(--gold)">⚙️ 설정</div>
      <div class="small">게임을 시작하기 전에 미리 정해 둘 수 있습니다</div>
    </div>
    <div class="pkOptBody">
    <div class="card" style="margin-top:2px">
      <h3>🔠 인게임 폰트 크기</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${FONT_SCALE_OPTS.map(v=>btn(cur===v, v+"%", `setFontScale(${v});renderTeamPick()`)).join("")}
      </div>
      <p class="small" style="margin-top:6px">화면이 작으면 90%, 글씨가 작으면 110~125%가 편합니다.</p>
    </div>
    <div class="card">
      <h3>🖥️ 전체화면</h3>
      <p class="small" style="margin-bottom:8px">주소창·탭 막대를 숨겨 화면을 넓게 씁니다.</p>
      ${btn(false, "전체화면 전환", "toggleFS()")}
    </div>
    <div class="card">
      <h3>🚪 창 닫기 확인창</h3>
      <p class="small" style="margin-bottom:8px">실수로 탭을 닫는 사고를 막습니다. (닫힐 때 자동 저장은 항상 동작합니다)</p>
      <div style="display:flex;gap:6px">
        ${btn(exitAskOn(), "💬 켜짐 (기본)", "setExitAsk(true);renderTeamPick()")}
        ${btn(!exitAskOn(), "○ 끔", "setExitAsk(false);renderTeamPick()")}
      </div>
    </div>
    <div class="card">
      <h3>🎭 돌발 행동</h3>
      <p class="small" style="margin-bottom:8px">기자회견 물병 투척, 상대 라커룸 방문 같은 「선 넘는」 선택지입니다. 기본은 안 함입니다.</p>
      <div style="display:flex;gap:6px">
        ${btn(!wild, "🚫 안 함 (기본)", "setPreOpt('noWild',true)")}
        ${btn(wild, "🎭 허용 (예능 모드)", "setPreOpt('noWild',false)")}
      </div>
    </div>
    <div class="card">
      <h3>🎬 골 장면 리플레이</h3>
      <p class="small" style="margin-bottom:8px">골이 터지면 세리머니 뒤에 그 장면을 다시 보여줍니다.</p>
      <div style="display:flex;gap:6px">
        ${btn(rep_, "🎬 보기 (기본)", "setPreOpt('replay',true)")}
        ${btn(!rep_, "🚫 안 보기", "setPreOpt('replay',false)")}
      </div>
    </div>
    <div class="card">
      <h3>🔀 선수 끼워팔기 제의</h3>
      <p class="small" style="margin-bottom:8px">상대 구단이 자기 선수에 현금을 얹어 제안하는 방식입니다. 받지 않으면 현금 제안만 올라옵니다.</p>
      <div style="display:flex;gap:6px">
        ${btn(!noSwap, "☐ 받는 중 (기본)", "setPreOpt('noSwap',false)")}
        ${btn(noSwap, "☑ 받지 않음", "setPreOpt('noSwap',true)")}
      </div>
    </div>
    <div class="card">
      <h3>🧬 선수 만들기 <span class="small">— 게임 시작 전에</span></h3>
      <p class="small" style="margin-bottom:8px">이름·신체·성격·능력치·특성·능숙도를 정해 나만의 선수를 미리 만들어 둡니다.
        만든 선수는 <b>브라우저에 보관</b>되고, 게임을 시작하면 <b>📜 선수 생성 목록</b>에 그대로 들어옵니다 — 거기서 원하는 구단에 넣으면 됩니다.
        ${preMade().length?`<br><b style="color:var(--gold)">보관 중 ${preMade().length}명</b>`:""}</p>
      <button class="mini" style="border-color:var(--acc);color:var(--acc)" onclick="openPreGen()">🧬 선수 만들기 열기</button>
    </div>
    <p class="small" style="margin:2px 2px 0;color:var(--sub);line-height:1.55">여기서 정한 값은 브라우저에 남아, <b>새로 시작하는 게임에 자동으로 적용</b>됩니다.
      게임 안에서는 좌측 <b>⚙️ 설정</b>에서 언제든 다시 바꿀 수 있습니다.</p>
    </div>
    <div class="pkBtns"><button class="pkYes" onclick="togglePickOpt()">✅ 닫기</button></div>
  </div>`;
}
function renderTeamPick(){
  const el=$("#teamPick");
  const card=(d,div)=>{
    const avg = d.players? Math.round(d.players.reduce((s,p)=>s+p[3],0)/d.players.length) : d.base;
    const ct=clubType({id:d.id, name:d.name});
    /* 🎨 사용자 요청 — 「팀선택 화면을 좀 더 고급스럽게」. 구단색 두 가지를 CSS 변수로 넘겨
       상단 띠·엠블럼·전력 바를 한 벌로 칠한다. 어두운 구단색은 이름만 밝게 바꾼다. */
    const dark = d.col==='#1d1d1b'||d.col==='#101010'||d.col==='#111111';
    const c2=d.col2||"#8b949e";
    const glow=`${d.col}2e`, lineC=`${d.col}55`;
    const initial=(d.short||d.name).slice(0,2);
    const crestInk=(typeof isLightColor==="function"&&isLightColor(d.col))?"#0d1117":"#fff";
    /* 🎨 세 번째 구단색이 있으면 띠와 엠블럼을 삼색으로 (수원 블루스타 = 청·백·적) */
    const c3=d.col3||null;
    const tri=c3
      ? `--tcBand:linear-gradient(90deg,${d.col} 0 34%,${c3} 34% 66%,${c2} 66% 100%);`
       +`--tcCrest:linear-gradient(145deg,${d.col} 0 36%,${c3} 36% 64%,${c2} 64% 100%);`
      : "";
    return `<div class="teamcard ${pickSel===d.id?'sel':''}" onclick="pickTeam('${d.id}')"
      style="--tc:${d.col};--tc2:${c2};--tcGlow:${glow};--tcLine:${lineC};${tri}">
      <div class="crest" style="color:${crestInk}">${initial}</div>
      <div class="nm" style="color:${dark?'#e8eef6':d.col}">${d.name}</div>
      <div class="st">${teamStars(avg, d.short||d.name)}<br>예산 <b style="color:#dbe6f2">${d.budget}억</b> · <span style="color:${ct.c}">${ct.ic} ${ct.n}</span></div>
      <div class="bar"><i style="width:${clamp((avg-52)*3.2,8,100)}%"></i></div></div>`;
  };
  /* 이어하기 + 세이브파일 불러오기.
     불러오기는 저장된 게임이 없어도 항상 띄운다 — 기기를 바꿨거나 브라우저가 저장을 지웠을 때
     감독이 다시 들어올 수 있는 유일한 문이다. */
  let hasSave=false; try{ hasSave=haveSave(); }catch(e){}
  const saved=`<div class="pkResume">
    ${hasSave?`<button class="pkGo pkMain" onclick="resumeGame()">💾 이어하기<span class="pkSub">저장된 게임</span></button>`:""}
    <label class="pkGo pkLoad" title="내보낸 세이브파일(.json)을 불러옵니다">📂 불러오기
      <input type="file" accept="application/json,.json" style="display:none" onchange="importSave(this)"></label>
    <button class="pkGo pkCog" onclick="togglePickOpt()" title="설정 — 폰트·전체화면·게임 옵션" aria-label="설정">⚙</button>
  </div>`;
  const sel = pickSel ? [...D1.map(d=>[d,1]),...D2.map(d=>[d,2])].find(x=>x[0].id===pickSel) : null;
  el.innerHTML=`<div class="pkSeason">SEASON 2026 · K LEAGUE</div>
  <h1>⚽ <span class="pkTitle">개리그 매니저 2026</span></h1>
  <div class="pkFeats">
    <span>2026 실제 로스터</span><span>실시간 매치엔진</span><span>파이널 라운드 스플릿</span>
    <span>승강 플레이오프</span><span>EACL · 클럽 월드컵</span><span>온라인 대전</span>
    <span>기자회견</span><span>유스 아카데미</span><span>외국인 무제한 등록 (동시 출전 K1 5 · K2 4)</span>
  </div>
  ${saved}
  ${pickOpt ? `<div class="pkOverlay" onclick="if(event.target===this)togglePickOpt()">${pickOptPanel()}</div>` : ""}
  ${sel ? `<div class="pkOverlay" onclick="if(event.target===this)pickCancel()">${pickPanel(sel[0], sel[1])}</div>` : ""}
  <div class="pkDivHead k1"><span class="pkDivBadge">${compShort("k1")}</span><span class="pkDivNm">${compName("k1")}</span><span class="pkDivSub">12개 구단</span></div>
  <div class="teamgrid">${D1.map(d=>card(d,1)).join("")}</div>
  <div class="pkDivHead k2"><span class="pkDivBadge">${compShort("k2")}</span><span class="pkDivNm">${compName("k2")}</span><span class="pkDivSub">17팀 체제</span></div>
  <div class="teamgrid">${D2.map(d=>card(d,2)).join("")}</div>
  <p class="small">※ 능력치는 실제 기록·활약을 바탕으로 한 추정치입니다.</p>
  <p class="pkNote">이 게임에 등장하는 모든 인물·구단·사건은 <b>가상</b>이며, 실존 인물 및 단체와 아무런 관련이 없습니다.<br>
    선수·감독·심판의 이름과 능력치는 게임 진행을 위한 창작물이고, 게임 안에서 벌어지는 모든 언행은 실제 인물의 발언이나 성향과 무관합니다.<br>
    본 게임은 비영리 팬 제작물이며 K리그 및 각 구단과 제휴 관계가 없습니다.</p>
  <p class="pkCopy">본 게임의 소스 코드, 그래픽 등 모든 에셋의 저작권은 제작자 <b>‘청백적시메오네’</b>에게 있습니다.<br>
    무단 복제, 수정 및 배포를 금합니다.</p>`;
}
function startGame(id){
  pickSel=null; pickOpt=false;
  newGame(id);
  try{ applyPreOpt(); }catch(e){}
  /* 🧬 시작 전에 만들어 둔 선수를 📜 선수 생성 목록으로 옮긴다 */
  try{ const pm=preMade(); if(pm.length){ G.pgMade=(G.pgMade||[]).concat(pm).slice(-100); } }catch(e){}
  enterGame();
}
function resumeGame(){
  if(loadGame()){ enterGame(); return; }
  /* 💽 기본 저장소에는 없다 — 큰 저장소에서 읽는다(세이브가 5MB 를 넘으면 여기에만 있다) */
  try{ flash("💽 큰 저장소에서 세이브를 읽는 중…","info"); }catch(e){}
  try{
    idbGet(SAVE_KEY).then(raw=>{
      if(!raw || typeof raw!=="string"){ try{ flash("저장된 게임을 찾지 못했습니다.","warn"); }catch(e){} return; }
      let o=null; try{ o=JSON.parse(raw); }catch(e){}
      if(!o || !o.teams){ try{ flash("저장된 게임을 읽지 못했습니다.","warn"); }catch(e){} return; }
      G=o; IDB_SIZE=raw.length; IDB_OK=true;
      try{ migrateLoadedG(); PID=nextPid(); }catch(e){}
      try{ enterGame(); }catch(e){}
    }).catch(()=>{ try{ flash("저장된 게임을 읽지 못했습니다.","warn"); }catch(e){} });
  }catch(e){ try{ flash("저장된 게임을 읽지 못했습니다.","warn"); }catch(_){} }
}
/* ═══════════════════════════════════════════════════════════════
   첫 부임 인트로 잠금
   처음 하는 사람이 부임 기자회견 도중에 다른 탭을 눌러 빠져나가면, 진행 중이던 절차가 화면에서
   사라져 "게임이 멈췄나?" 싶어진다. 그래서 ① 부임 기자회견 → ② 선수단 첫 인사 → ③ 시즌 목표
   세 단계가 끝날 때까지는 좌측 메뉴와 진행 버튼을 잠가 둔다.
   잠금 해제는 greetDone() 한 곳에서만 한다 (G.introDone=true 와 같은 시점).
═══════════════════════════════════════════════════════════════ */
function introLocked(){ return !!(G && G.introDone===false); }
function applyNavLock(){
  if(typeof document==="undefined" || !document.querySelectorAll) return;
  const lock=introLocked();
  document.querySelectorAll(".navbtn").forEach(b=>{ b.disabled=lock; b.classList.toggle("navLocked", lock); });
  const adv=document.getElementById("advBtn");
  if(adv){
    /* 부임 기자회견을 마친 상태 — 진행 버튼이 「선수단 만나러 가기」가 된다 (주장단 선임 게이트와 같은 방식) */
    const ivDone  = (typeof IV!=="undefined") && IV && IV.idx>=IV.qs.length;
    const ivReady = ivDone && IV.stage==="intro";
    const ivKick  = ivDone && IV.stage==="pre";     // 경기 전 회견 — 진행 버튼이 킥오프를 맡는다
    const ivBack  = ivDone && !ivReady && !ivKick;  // 경기 후·영입 발표 회견 → 오피스로
    const grReady = (typeof greetReady!=="undefined") && greetReady;
    const awReady = (typeof awayReactReady!=="undefined") && awayReactReady;
    const gate = ivReady || ivKick || ivBack || grReady || awReady;
    adv.disabled = lock && !gate;
    adv.classList.toggle("navLocked", lock && !gate);
    adv.textContent = ivReady ? "🤝 선수단 만나러 가기 ▶"
                    : ivKick  ? "⚽ 킥오프 ▶"
                    : ivBack  ? "🏠 오피스로 ▶"
                    : grReady ? "🚪 라커룸을 나선다 ▶"
                    : awReady ? "계속 ▶"
                    : (lock ? "부임 절차 진행 중" : "진행 ▶");
  }
  const side=document.getElementById("side");
  if(side) side.classList.toggle("introLock", lock);
}
/* 지금 어느 단계인지 보여 주는 띠 — 세 단계 중 어디쯤인지 늘 보이게 한다 */
const INTRO_STEPS=[["🎙️","부임 기자회견"],["🤝","선수단 첫 인사"],["🎯","시즌 목표"]];
function introBar(cur){
  if(!introLocked()) return "";
  return `<div class="introBar">
    ${INTRO_STEPS.map((x,i)=>`<span class="introStep ${i===cur?"on":i<cur?"done":""}">${i<cur?"✓":x[0]} ${x[1]}</span>`).join('<span class="introArr">›</span>')}
    <div class="introNote">부임 절차를 마치면 모든 메뉴가 열립니다.</div>
  </div>`;
}
/* 🚪 나가기 — 진행 상황을 저장하고 팀 선택 화면으로 돌아간다.
   ⚠ 창을 닫는 게 아니다. 세이브는 그대로 남고, 팀 선택 화면의 「이어하기」로 다시 들어온다. */
function exitToTitle(){
  if(liveM){ flash("경기 중에는 나갈 수 없습니다 — 경기를 마친 뒤에 시도하세요.","warn"); return; }
  const doExit=()=>{
    try{ saveGame(); }catch(e){}
    /* ⚔️ 제보 — 나가면 접속 인원에서도 빠져야 한다. 새 세이브로 다시 들어오면 다시 잡힌다. */
    try{ if(typeof pvpLiveStop==="function") pvpLiveStop(); }catch(e){}
    try{ if(PROG && PROG.stop) PROG.stop(); }catch(e){}
    try{ document.body.classList.remove("matchFS"); }catch(e){}
    try{ const m=$("#gcModal"); if(m){ m.className="hidden"; m.innerHTML=""; } }catch(e){}
    try{ $("#app").classList.add("hidden"); $("#teamPick").classList.remove("hidden"); }catch(e){}
    pickSel=null;
    try{ renderTeamPick(); }catch(e){}
    try{ window.scrollTo(0,0); }catch(e){}
  };
  showConfirm(`<b>🚪 팀 선택 화면으로 나갑니다</b>\n\n`+
    `진행 상황은 <b>지금 저장</b>되고, 세이브는 그대로 남습니다.\n`+
    `팀 선택 화면의 <b>이어하기</b>로 언제든 돌아올 수 있습니다.\n\n`+
    `<span class="small">다른 구단으로 새 게임을 시작하면 지금 세이브는 덮어씌워집니다 — 남겨 두려면 먼저 ⚙️ 설정에서 세이브 파일을 내보내세요.</span>`,
    doExit, {okLabel:"저장하고 나간다", cancelLabel:"계속한다"});
}
function enterGame(){
  $("#teamPick").classList.add("hidden");
  $("#app").classList.remove("hidden");
  const t=userTeam();
  updateTopBar(t, t.div===1?G.r1:G.r2, t.div===1?G.k1Fix:G.k2Fix);
  const badge=$("#clubBadge");
  badge.style.background=t.col; badge.style.color="#fff";
  badge.innerHTML=`${t.name}<small>${badgeCompLine(t)}</small>`;
  if(!G.introDone){
    // 첫 부임: 감독 부임 기자회견 → 선수단 첫 인사 순으로 진행 후 홈 화면
    VIEW="home";
    applyNavLock();                       // 절차가 끝날 때까지 다른 메뉴는 잠근다
    socialOnAppoint();
    startInterview("intro", null, ()=>{ showSquadGreeting(); });
    return;
  }
  show("home");
}
