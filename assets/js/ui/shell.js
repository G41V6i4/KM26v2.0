"use strict";
/* ---------- 공통 렌더 ---------- */
function show(v){
  /* 🔍 경기 중 — 둘러보기 모드일 때만 화면을 옮길 수 있다 */
  if(liveM && !LIVE_PEEK) return;
  if(liveM && LIVE_PEEK && v==="match"){ peekEnd(); return; }
  if(liveM && LIVE_PEEK && !peekAllowed(v)){
    try{ flash("🔍 둘러보기 중에는 <b>순위표·기록·일정</b> 같은 조회 화면만 열 수 있습니다.<br><span class=\"small\">전술·교체는 경기 화면의 ⏸ 에서 하세요.</span>","warn"); }catch(e){}
    return;
  }
  /* ⚔️ 제보 — 온라인 대전 진행 중(매칭~경기)에는 다른 메뉴로 못 나간다 (게스트 포함).
     단, 매치 로비에서는 전술 탭만 허용 — 맞설 스쿼드를 꾸밀 수 있게 (제보). */
  try{ if(typeof pvpBusy==="function"){
    if(pvpBusy() && v!=="pvp" && !(PVP && PVP.stage==="lobby" && v==="tactics")){
      try{ flash("⚔️ 온라인 대전 진행 중 — 취소하거나 경기를 마쳐야 이동할 수 있습니다.","warn"); }catch(e){}
      return;
    }
    pvpNavSync();
  } }catch(e){}
  /* ⚔️ 무직 — 메뉴를 감추는 것만으로는 부족하다. 알림·단축키 같은 다른 경로로도 못 들어오게 막는다 */
  try{ pvpMenuSync(); }catch(e){}
  if(v==="pvp" && G && G.jobless){
    try{ flash("⚔️ 소속 구단이 없어 <b>온라인 대전</b>을 이용할 수 없습니다.","warn"); }catch(e){}
    return;
  }
  /* 안전망 — 인트로 도중에는 어떤 경로로 불려도 화면을 옮기지 않는다.
     버튼은 이미 잠겨 있지만, 알림 클릭 같은 다른 경로로 show() 가 불릴 수 있다. */
  if(introLocked() && v!=="home"){
    notify("먼저 부임 절차를 마쳐 주세요 — 기자회견 · 선수단 인사 · 시즌 목표 순서입니다.","warn");
    return;
  }
  if(v!=="simwatch" && typeof stopSimWatch==="function") stopSimWatch(); // 관전 화면을 벗어나면 시뮬 정지 // 실제 경기 진행 중에는 화면 이동 불가(라이브 중계는 "경기" 탭에 고정)
  // 기자회견/첫인사/라커룸 토크는 이제 "경기" 탭에서 진행 상태가 보존되므로, 다른 탭으로 자유롭게 이동할 수 있다.
  if(v!==VIEW) selSwap=null; // 다른 화면으로 이동할 때만 선택 해제
  /* ⚠ 제보 — 「경기 준비할 때 다른 탭 갔다오면 선발확정 버튼을 안 눌렀는데도 명단확인 화면이
     안 나오고 자동으로 넘어갑니다. 아챔 결승 때 그래서 체력관리 못하고 져버림」.
     준비 화면(inPreTactics)을 떠나도 그 표식이 남아, 돌아와서 누른 진행 버튼이
     곧바로 「선발 확정」으로 처리됐다. 떠난 사실을 기억해 뒀다가, 진행 버튼은 먼저
     준비 화면부터 다시 보여 준다. */
  try{ if((inPreTactics||inLineupPreview) && v!=="match") preTacAway=true; }catch(e){}
  const VIEWPREV=VIEW;
  /* 🎰 자산 화면을 떠나면 도박 결과 화면도 치운다 (제보 — 다시 들어와도 결과가 남아 있었다) */
  try{ if(VIEWPREV==="mylife" && v!=="mylife" && meTab==="gam" && typeof gamLeave==="function") gamLeave(); }catch(e){}
  VIEW=v;
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v===v));
  {
    /* 🕊️ 무직 — 「일정 및 훈련」도 내가 짤 게 없다(제보). 구경거리(순위표·기록실·뉴스·자산)만 남긴다. */
    const lockedNav=["squad","tactics","transfer","nego","offers","finance","youth","staff","contract","loancenter","renew","loan","match","player","fixtures"];
    document.querySelectorAll(".navbtn").forEach(b=>{
      const off=!!G.jobless && lockedNav.includes(b.dataset.v);
      b.style.opacity=off?"0.35":"";
      b.style.pointerEvents=off?"none":"";
      b.title=off?"무직 상태 — 팀 관리 기능이 잠겨 있습니다":"";
    });
  }
  const t=userTeam();
  const r = t.div===1?G.r1:G.r2;
  const fix = t.div===1?G.k1Fix:G.k2Fix;
  $("#dateBox").innerHTML=G.jobless
    ? `<b class="dbDate">${calDateText()}</b><br><b>${G.season} 시즌</b> · 라운드 <b>${Math.min(r+1,fix.length)}</b> / ${fix.length}<br>
    🕊️ <b>무직</b> — 야인 생활 ${(G.mgrFree&&G.mgrFree.weeks)||0}주차<br>
    ${((G.mgrFree&&G.mgrFree.off)||[]).length?`📬 감독직 제의 <b>${G.mgrFree.off.length}건</b><br>`:""}사비 <b class="money">${me().cash.toFixed(1)}억</b> · 평판 <b>${(typeof mgrRep==="function")?mgrRep():"-"}</b>`
    : `<b class="dbDate">${calDateText()}</b><br><b>${G.season} 시즌</b> · 라운드 <b>${Math.min(r+1,fix.length)}</b> / ${fix.length}<br>
    ${G.phase==="po"?(eaclPhaseTag(false)||"⚔️ 승강 PO 진행 중"):G.phase==="seasonEnd"?"🏁 시즌 종료":G.phase==="pre"?((function(){try{return cwcMine()&&cwcUserLeft()?`🌍 ${cwcShort()} 참가 중`:"🌱 프리시즌";}catch(e){return "🌱 프리시즌";}})()):""}${G.phase==="pre"?" · ":""}${transferOpen()?`🟢 ${windowInfo().name} 이적시장`:"🔴 이적시장 닫힘"}<br>
    ${(G.nego||G.snego||G.acNego)?`🤝 협상 진행 중<br>`:""}${(G.offers||[]).length?`📨 타 구단 제의 <b>${G.offers.length}건</b><br>`:""}이적 예산 <b class="money">${t.budget}억</b><br>연봉 ${Math.round(totalWage(t))}/${t.wageCap||0}억`;
  updateTopBar(t, r, fix);
  const badge=$("#clubBadge");
  if(G.jobless){
    badge.style.background="#30363d";
    badge.innerHTML=`🕊️ 무직 감독<small>전 ${(G.sack&&G.sack.team)||t.name} · ${G.season} 시즌</small>`;
  } else {
    badge.style.background=t.col;
    badge.innerHTML=`${t.name}<small>${badgeCompLine(t)}</small>`;
  }
  /* ⚠ 프리시즌 → 리그 전환(checkPreseasonEnd)은 '진행'을 눌러 하루가 흐를 때만 일어난다.
     화면이 먼저 그려지면 phase 가 아직 "pre" 로 남아 개막 라운드인데도 프리시즌 취급을 받는다.
     여기서 한 번 더 확인한다 — 이미 넘어갔으면 아무 일도 하지 않는 함수다. */
  try{ if(G.phase==="pre" && typeof checkPreseasonEnd==="function") checkPreseasonEnd(); }catch(e){}
  /* 연습경기든 정규 라운드든 버튼은 "경기 시작 ▶" 하나로 통일한다 — 어떤 경기인지는
     경기 화면의 태그(프리시즌 친선경기)와 로딩창이 이미 알려 준다. */
  $("#advBtn").textContent = G.jobless ? (G.phase==="seasonEnd" ? "다음 시즌 시작 ▶▶" : "🕊️ 시간 보내기 ▶")
    : goalNeeded() ? "🎯 시즌 목표 설정 필요" : capNeeded() ? "🎖️ 주장단 선임 필요"
    : (typeof mgrInjured==="function" && mgrInjured() && atMatchDay()) ? `🩺 ${acName()} 대행 경기 ▶` :

    /* ⚠ 제보 — 「시즌 끝나고 아챔 남은 경기를 치를 때 버튼이 '승강 PO 진행'으로 뜬다」.
       phase 만 보고 이름을 붙였는데, 그 단계에서도 대회 경기가 남아 있을 수 있다. 대회를 먼저 본다. */
    G.phase==="seasonEnd" ? "다음 시즌 시작 ▶▶"
    : (function(){
        try{ if(cwcUserDue()) return "🌍 "+cwcShort()+" 경기 시작 ▶"; }catch(e){}
        try{ if(eaclUserDue()) return "🌏 "+eaclShort()+" 경기 시작 ▶"; }catch(e){}
        if(G.phase==="po"){
          /* ⚠ 제보 원문 — 「EACL 결승이 끝난 후 경기 진행 버튼이 '승강 PO 시작' 이었는데,
             EACL 결승이 끝나면 그 해 모든 일정이 끝나는 것이므로 '진행' 문구로 바꿔 달라」.
             → 대진이 다 끝났으면(큐가 비었으면) 승강 PO 이름을 쓰지 않는다. */
          try{ if(!((G.poQueue||[]).length) && eaclUserLeft()) return "🌏 "+eaclShort()+" 일정 진행 ▶"; }catch(e){}
          /* ⚔️ ⚠ 제보 원문 — 「K리그2 에서는 승강 PO 이 진행 중임에도, 진행 버튼이 '승강 PO' 이
             아니고 '진행' 으로 나옵니다. K리그1 처럼 K리그2 에서도 승강 PO 가 진행 될 때에는
             경기 진행 버튼을 '진행' 이 아니고 '승강 PO' 로 명칭을 변경 해주시면 감사하겠습니다」.
             원인 — poUserIn() 으로 「내가 남은 대진에 끼어 있을 때」만 이름을 붙였다.
               K리그2 팀은 준PO 에서 지거나 애초에 PO 권 밖이면 남은 대진에서 사라져
               곧바로 「진행」으로 떨어졌다. 화면 위 날짜칸은 「⚔️ 승강 PO 진행 중」이라고
               말하는데 버튼만 딴소리를 한 셈이다.
             수정 — 승강 PO 는 리그 전체의 일정이다. 대진이 남아 있는 동안은 그 이름으로 부르고,
               바로 다음 경기가 우리 경기일 때만 「경기 시작」으로 바꿔 준다. */
          try{
            const _q=G.poQueue||[];
            if(_q.length){
              let _mine=false;
              try{ const _m0=_q[0];
                _mine = !G.jobless && (resolvePOid(_m0.h)===G.userTeamId || resolvePOid(_m0.a)===G.userTeamId);
              }catch(e){}
              return _mine ? "⚔️ 승강 PO 경기 시작 ▶" : "⚔️ 승강 PO 진행 ▶";
            }
          }catch(e){}
          return "진행 ▶";
        }
        return atMatchDay() ? "경기 시작 ▶" : "진행 ▶";
      })();
  // 안전망 — 기자회견·라커룸 같은 진행 화면이 하나도 열려 있지 않다면 버튼은 눌려야 한다.
  // 어느 흐름에서든 잠금 해제를 빠뜨리면 게임이 통째로 멈춘 것처럼 보이므로 여기서 되돌린다.
  if(typeof progBusy==="function" && !progBusy()) $("#advBtn").disabled=false;
  const V={home,squad,tactics,table:tableView,fixtures,transfer,nego:negoView,offers:offersView,finance,mylife:mylifeView,youth,stats,player:playerView,match:matchTabIdleView,settings:settingsView, editor:editorView, engineEd:engineEditorView, playerGen:playerGenView, simwatch:simWatchView, staff:staffView, media:mediaView, renew:renewView, loan:loanView, contract:contractView, osquad:otherSquadView, loanin:loanInView, loancenter:loanCenterView, pvp:pvpView, comm:cmView};
  const fx=flashHtml();
  if(typeof closeRoleMenu==="function") closeRoleMenu();   // 화면을 옮기면 열려 있던 역할 패널을 닫는다
  const freshTactics = (v==="tactics" && VIEWPREV!=="tactics");
  if(freshTactics) tacBase=null;          // 렌더 도중 초기화되는 값(벤치 등록 등)까지 반영한 뒤에 기준선을 잡는다
  /* 🧷 전술 화면을 떠나는 순간, 지금 판을 쓰는 전술 슬롯에 그대로 남긴다.
     저장 버튼을 깜빡하고 나가도 슬롯과 활성 전술이 어긋나지 않는다(제보). */
  if(VIEWPREV==="tactics" && v!=="tactics" && !G.jobless){
    try{ const _ut=userTeam(); if(_ut && _ut.tactic) storeCurPreset(_ut); }catch(e){}
  }
  /* 무직 — 팀 관리 화면은 잠긴다. 구경(순위표·기록실·뉴스·관전·개인 삶)은 자유다. */
  if(G.jobless){
    const lockedV=["squad","tactics","transfer","nego","offers","finance","youth","staff","contract","loancenter","renew","loan","match","player","fixtures"];
    if(lockedV.includes(v)){ v="home"; VIEW="home"; document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="home")); }
  }
  $("#main").innerHTML=fx+((G.jobless && v==="home")?joblessView():V[v]());
  try{
    peekGuardInit();
    const m=document.getElementById("main");
    if(m) m.classList.toggle("peekOnly", !!(liveM && LIVE_PEEK));
    peekBarRender();
  }catch(e){}
  if(freshTactics){ tacBaseline(); $("#main").innerHTML=fx+((G.jobless && v==="home")?joblessView():V[v]()); }
  if(!G.seen) G.seen={};
  G.seen[v]=notifCount(v); // 이 탭을 확인했으니 알림 해제
  renderNavDots();
  try{ banCtxSync(); }catch(e){}         // 🟥 제보 — 다음 경기 대회 기준으로 출전정지를 다시 잡는다
  try{ document.body.classList.toggle("pvpMenu", v==="pvp"); }catch(e){}   // ⚔️ 제보 — 모바일 진행 버튼 숨김
  try{ chatBoxSync(); }catch(e){}        // 💬 제보 — 채팅창 스크롤바·높이 복원
  /* 💬 요청 — 화면을 다시 그린 직후엔 늘 최신 줄이 보이게 (글꼴·높이가 잡힌 뒤 한 번 더) */
  try{ chatBoxesBottom(); setTimeout(()=>{ try{ chatBoxesBottom(); }catch(e){} }, 60); }catch(e){}
  try{ pvpPresenceSync(v); }catch(e){}   // 🌐 제보 — ⚔️ 메뉴에 있는 동안만 접속 인원에 잡힌다
  try{ cmTick(v); }catch(e){}            // 🗣️ 커뮤니티 — 그 화면에 있는 동안만 목록을 다시 받아 온다
  navPush(v);              // 🖱️ 트랙패드 뒤로가기 제스처를 위해 방문 기록을 남긴다
  try{ boardFlush(); }catch(e){}   // 🪑 미뤄 둔 구단주 경고·통첩 — 한가해졌으면 지금 띄운다 (제보)
  saveGame();
}
/* ═══════════════════════════════════════════════════════════════
   🖱️ 뒤로 가기 — 맥북 트랙패드 두 손가락 스와이프 / 마우스 4·5번 버튼 / Alt+←
   (제보 — "맥북에서 트랙패드 옆으로 넘겨서 뒤로가기 못할까요?")
   브라우저 히스토리에 화면 이름을 쌓아 두면 OS·브라우저의 기본 제스처가 그대로 동작한다.
   별도 스와이프 감지를 붙이면 표를 가로로 넘기는 동작과 충돌하므로 쓰지 않는다.
═══════════════════════════════════════════════════════════════ */
let NAV_LOCK=false;        // popstate 로 되돌아가는 중에는 다시 push 하지 않는다
function navPush(v){
  if(NAV_LOCK) return;
  try{
    if(typeof history==="undefined" || !history.pushState) return;
    const cur=(history.state && history.state.klmV) || null;
    if(cur===v) return;                       // 같은 화면 재렌더는 기록하지 않는다
    history.pushState({klmV:v}, "", location.hash||"");
  }catch(e){}
}
function navInit(){
  try{
    if(typeof history==="undefined" || !history.replaceState) return;
    history.replaceState({klmV:VIEW||"home"}, "", location.hash||"");
    window.addEventListener("popstate", (e)=>{
      /* 열려 있는 팝업이 있으면 화면을 옮기는 대신 팝업만 닫는다 — 실제 앱과 같은 감각 */
      try{
        const gc=document.getElementById("gcModal");
        if(gc && !gc.classList.contains("hidden") && gc.innerHTML.trim()){
          gc.className="hidden"; gc.innerHTML="";
          navPush(VIEW); return;              // 지금 화면을 다시 쌓아 뒤로가기 한 칸을 되돌린다
        }
        const pi=document.getElementById("pInfo");
        if(pi && !pi.classList.contains("hidden") && pi.innerHTML.trim()){
          try{ closePlayerInfoPopup(); }catch(e2){}
          navPush(VIEW); return;
        }
      }catch(e2){}
      /* 경기 중·인트로 중에는 화면을 옮기지 않는다 */
      if(liveM || (typeof introLocked==="function" && introLocked())){ navPush(VIEW); return; }
      const v=(e.state && e.state.klmV) || "home";
      if(v===VIEW) return;
      NAV_LOCK=true;
      try{ show(v); }catch(e3){}
      NAV_LOCK=false;
    });
    /* 가로 스와이프가 페이지 자체를 밀어내지 않도록 — 뒤로가기 제스처만 남긴다 */
    try{ document.body.style.overscrollBehaviorX="none"; }catch(e4){}
  }catch(e){}
}
/* ---------- 탭별 새 소식 알림 (빨간 점) ---------- */
/* 탭별 "지금 감독이 확인해야 할 일"의 개수.
   0보다 크면 사이드바 메뉴 옆에 빨간 점이 붙는다. 진행 중에 흘려보낸 알림도 여기서 다시 잡힌다. */
function notifCount(tab){
  const ut=userTeam(); if(!ut) return 0;
  /* 무직 — 팀 관련 탭은 잠겨 있으므로 빨간불도 켜지 않는다 (끌 방법이 없어 계속 남는 제보) */
  if(G.jobless && ["squad","tactics","transfer","nego","offers","finance","youth","staff","contract","loancenter","renew","loan","match","player"].includes(tab)) return 0;
  switch(tab){
    case "offers": return (G.offers||[]).length;
    case "squad": {
      let c=0;
      for(const p of ut.players){
        if(p.sulk>0) c++;                     // 태업
        if(p.noMove) c++;                     // 잔류 선언
        if(p.unhappy>=3) c++;                 // 공개 이적 요청
        if(p.inj>0 && !p._injSeen){ c++; }    // 새 부상 — 스쿼드를 열어 보면 해제된다
        if(p.ban>0) c++;                      // 출장정지
      }
      return c;
    }
    case "media": return feedUnread();
    case "staff": return staffAgenda().length;
    case "nego": return (G.nego?1:0)+(G.snego?1:0)+(G.acNego?1:0);   // 임대 제안은 🔁 임대 센터로 옮겼다
    case "finance": return (ut.budget<0?1:0) + (wageRoom(ut)<0?1:0);                     // 적자·연봉 상한 초과
    case "transfer": return (G.transferBids||[]).filter(b=>b.offer).length;               // 들어온 입찰
    case "contract": return expiringSoon().filter(p=>(p.ct||1)<=1).length;                 // 올해 안에 잡아야 할 계약
    case "loancenter": { let n=0; try{ n=loanAsksPrune().length; }catch(e){ n=(G.loanAsks||[]).length; }
      let f=0; try{ f=loanOffersPrune().length; }catch(e){ f=(G.loanOffers||[]).length; }
      return n+f; }                                              // 들어온 임대 제안 (유령 정리 후 — 제보)
    case "tactics": {
      const xi=bestXI(ut);
      let c=0;
      if(xi.filter(frnQ).length > frnLimOf(ut)) c++;                                   // 외국인 초과
      if(xi.some(p=>p.inj>0||p.ban>0||p.sulk>0)) c++;                                     // 못 뛰는 선수가 선발에
      if(typeof tacDirty==="function" && tacDirty()) c++;                                  // 저장 안 한 전술 변경
      return c;
    }
    case "youth": return (G.youthNew||0);
    case "table": return 0;
    case "fixtures": {
      // 다음 경기 전날인데 주전 체력이 바닥이면 훈련 계획을 손봐야 한다
      if(G.phase!=="league" || !G.cal) return 0;
      const nd=matchDayOf(userRoundNow());
      if(nd-(G.day||0)>2) return 0;
      return bestXI(ut).filter(p=>p.cond<68).length ? 1 : 0;
    }
    case "match": return atMatchDay()?1:0;
    /* 🗣️ 커뮤니티 — 내 글에 달린 아직 안 읽은 댓글 (요청) */
    case "comm": { try{ return cmNewCmt(); }catch(e){ return 0; } }
    default: return 0;
  }
}
/* 빨간 점 — 처리할 일이 남아 있으면 계속 켜 둔다.
   예전엔 "탭을 한 번 열면" 꺼졌는데, 열어만 보고 처리하지 않은 일까지 사라져 놓치기 쉬웠다.
   지금은 실제로 처리해서 개수가 0이 될 때까지 남는다. */
function renderNavDots(){
  if(!G.seen) G.seen={};
  document.querySelectorAll(".navbtn").forEach(b=>{
    const tab=b.dataset.v;
    let cnt=0;
    try{ cnt=notifCount(tab); }catch(e){ cnt=0; }
    b.classList.toggle("hasNotif", cnt>0);
    if(cnt>0) b.setAttribute("data-cnt", cnt); else b.removeAttribute("data-cnt");
  });
}
