"use strict";
/* ---------- "경기" 탭: 경기 관련 진행 상황(기자회견/라커룸/첫인사/라이브) 재진입 ----------
   기자회견·라커룸 토크·첫인사 도중에도 다른 탭으로 자유롭게 이동할 수 있게 되었으므로,
   "경기" 탭을 다시 누르면 하던 화면을 그대로 재현해준다. 실제 라이브 경기 중(liveM)에는
   애초에 다른 탭 클릭 자체가 막혀 있어 이 함수까지 올 일이 없지만 방어적으로 처리한다. */
function enterMatchTab(){
  VIEW="match";
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  if(liveM){ $("#main").innerHTML=liveLayout(liveM, liveTag); syncLive(); return; }
  if(IV){ renderInterview(); return; }
  if(inGreeting){ renderSquadGreeting(); return; }
  if(busCtx){ renderBusBlock(); return; }
  if(PERSU){ renderPersuade(); return; }
  if(BYE){ renderFarewell(); return; }
  if(fanTownhallCtx){ renderFanTownhall(); return; }
  if(awayLockerCtx){ renderAwayLocker(); return; }
  if(inLockerTalk && lockerScreenState){
    const s=lockerScreenState;
    if(s.kind==="options") lockerTalkUI(s.title, s.resHtml, s.opts, s.onclickFn);
    else showLockerReactions(s.title, s.toneScore, lockerReactCont, s.moraleBefore, s.moraleAfter, s.M, s.reactionsData, s.stage);
    return;
  }
  if(inPreTactics && pendingLiveM){
    preTacAway=false;
    /* 다른 탭에 다녀오면 show() 가 버튼 문구를 「경기 시작」으로 되돌려 놓는다 — 여기서 복구 */
    { const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.classList.remove("navLocked"); _a.textContent="✅ 선발 확정 ▶"; } }
    renderPreMatchTactics(); return; }
  if(inLineupPreview && pendingLiveM){ preTacAway=false; showLineupPreview(pendingLiveM, pendingLiveTag); return; }
  $("#main").innerHTML=matchTabIdleView();
  if(!G.seen) G.seen={};
  G.seen.match=notifCount("match");
  renderNavDots();
}
function matchTabIdleView(){
  if(COACH_IV) return coachTalkView();      // 🎙️ 감독에 대한 발언 — 이 메뉴가 인터뷰를 맡는다
  const t=userTeam();
  const r = t.div===1?G.r1:G.r2;
  const fix = t.div===1?G.k1Fix:G.k2Fix;
  let oppInfo="";
  if(G.phase==="pre"){
    const f=nextFriendly();
    const openOff=(G.cal&&G.cal.openOff)||0;
    oppInfo = f
      ? `<div class="msg info">🌱 <b>프리시즌</b> — 다음 연습경기: <b>${G.teams[f.oppId]?G.teams[f.oppId].name:""}</b> (${f.home?"홈":"원정"}) · ${dateLabel(f.d)}</div>`
      : `<div class="msg info">🌱 <b>프리시즌</b> — 연습경기 일정을 모두 마쳤습니다. 개막까지 ${Math.max(0,openOff-(G.day||0))}일</div>`;
  } else if(G.phase==="league" && r<fix.length){
    for(const [hid,aid] of fix[r]){
      if(hid===t.id||aid===t.id){
        const opp=G.teams[hid===t.id?aid:hid];
        oppInfo=`<div class="msg info">다음 상대: <b>${opp.name}</b> (${hid===t.id?"홈":"원정"}) — ${divName(t.div)} ${r+1}라운드</div>`;
        break;
      }
    }
  }
  return `<h2>🏟️ 경기/인터뷰</h2>
  <div class="card">
    <p>지금은 진행 중인 경기 관련 상황이 없습니다.</p>
    ${oppInfo}
    <p class="small">사이드바의 <b>"${G.phase==="seasonEnd"?"다음 시즌 시작 ▶▶":G.phase==="po"?"승강 PO 진행 ▶":"다음 경기 ▶"}"</b> 버튼을 누르면 라인업 확인 → 기자회견 → 라커룸 → 문자중계 → 라커룸 → 기자회견 순서로 진행됩니다.
    진행 도중 다른 탭을 확인하고 싶으면 자유롭게 이동했다가, 다시 이 "경기" 탭을 누르면 하던 화면 그대로 이어집니다.</p>
  </div>`;
}
/* ---------- 이벤트 바인딩 ---------- */
document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>{
  document.body.classList.remove("matchFS");   // 안전망 — 경기 밖 화면으로 이동하면 풀스크린 해제
  /* 🔍 경기 중이라도 「둘러보기」를 켠 상태면 다른 탭을 볼 수 있다 (보기 전용) */
  if(liveM && !LIVE_PEEK) return;
  if(b.dataset.v==="__exit"){ if(liveM) return; exitToTitle(); return; }
  if(b.dataset.v==="match"){ if(liveM && LIVE_PEEK){ peekEnd(); return; } enterMatchTab(); return; }
  show(b.dataset.v);
});
/* ═══════════════════════════════════════════════════════════════
   FM식 날짜 진행
   "다음 경기" 버튼은 경기와 경기 사이를 한 번에 건너뛰었다. 그러면 그 사이에 일어난 일 —
   타 구단의 영입, 방출, 우리 선수에게 들어온 제안 — 이 전부 결과만 남고 과정이 사라진다.
   이제는 하루씩 흘려보내면서 그날의 소식을 띄우고, 감독이 봐야 할 일이 생기면 멈춘다.
═══════════════════════════════════════════════════════════════ */
const PROG_MS=190;              // 하루가 지나가는 속도
const PROG_MAX_LINES=90;
let PROG=null;                  // {timer, lines, stop}
function progBusy(){ return !!(liveM||IV||inGreeting||inLockerTalk||inLineupPreview||inPreTactics||fanTownhallCtx||awayLockerCtx); }
/* 🗓️ 달력-라운드 불일치 복구
   ⚠ 제보 — 「아직도 날짜가 멈춘 체 경기만 계속 시작됩니다. 경기종료후 시즌이 종료되었다고는
     나오지만 계속을 누르면 또 그대로 경기 시작입니다」 (세이브: 강원 2028, day=393=cal.last, r1=10).
     구버전 빌드에서 달력이 라운드보다 먼저 끝까지 흘러 버린 세이브가 그대로 넘어온 것이다.
     stepDay 는 「날짜가 달력 끝 → 시즌 종료」를 띄우고, advance() 는 「라운드가 남았다 → 경기 시작」 —
     둘이 딴소리를 하며 날짜가 393에 얼어붙은 채 경기만 반복됐다.
   ─ 라운드가 남았는데 달력이 먼저 끝났으면, 남은 라운드를 오늘 이후로 사흘 간격으로 다시 깔고
     달력 끝을 그만큼 늘린다. 시즌이 늦게 끝나는 값을 치르지만, 남은 경기를 통째로 날리는 것보다 낫다.
     (다음 시즌은 startNewSeason 이 달력을 새로 깔므로 영향이 없다) */
function calRoundRepair(){
  try{
    if(G.phase!=="league" || !G.cal || !Array.isArray(G.cal.roundDay)) return false;
    const need1=(G.k1Fix||[]).length, need2=(G.k2Fix||[]).length;
    const left1=(G.r1||0)<need1, left2=(G.r2||0)<need2;
    if(!left1 && !left2) return false;                 // 라운드가 다 끝났으면 정상 종료 수순
    const rd=G.cal.roundDay;
    const rNow=Math.min(left1?(G.r1||0):Infinity, left2?(G.r2||0):Infinity);
    const maxNeed=Math.max(left1?need1:0, left2?need2:0);
    const nd=rd[rNow];
    /* 정상 세이브는 건드리지 않는다 — 다음 라운드 날짜를 아직 지나지 않았거나,
       지났더라도 달력에 여유가 있으면 atMatchDay 의 >= 판정이 알아서 따라잡는다 */
    const broken = (nd===undefined) || ((G.day||0)>nd && (G.day||0)>=(G.cal.last||0));
    if(!broken) return false;
    let d=(G.day||0)+3;
    for(let i=rNow;i<maxNeed;i++){ rd[i]=d; d+=3; }
    G.cal.last=Math.max(G.cal.last||0, d+4);
    const leftN=maxNeed-rNow;
    addNews(`📢 <b>일정 복구</b> — 달력이 남은 <b>${leftN}개 라운드</b>를 남겨둔 채 먼저 끝나 있었습니다. 남은 경기를 ${dateLabel(rd[rNow])}부터 사흘 간격으로 다시 편성했습니다.`, "info");
    return true;
  }catch(e){ return false; }
}
function atMatchDay(){
  if(G.jobless) return false;          // 🕊️ 무직 — 내가 치를 경기는 없다 (연습경기 포함)
  /* ⚠ 제보 — 「경기 종료 후 다음을 누르면 날짜는 그대로인데 경기가 바로 또 진행된다. 체력이 계속 갈린다」.
     일정이 뒤로 밀렸거나(라운드일이 이미 지난 날짜), 대회 경기일과 리그 경기일이 겹치면
     같은 하루에 두 경기가 연달아 붙었다. 어떤 리그도 하루에 두 경기를 시키지 않는다.
     ─ 오늘 이미 한 경기를 치렀으면 오늘은 더 이상 경기일이 아니다. 진행하면 날짜가 넘어간다. */
  if(G.lastMD!=null){
    if((G.day||0) < G.lastMD) G.lastMD=null;            // 시즌이 바뀌어 달력이 되감겼다
    else if((G.day||0) <= G.lastMD) return false;
  }
  /* 🌍 CWC 경기일 — 1월 대회는 프리시즌 한복판에 있다.
     ⚠ 프리시즌 분기가 연습경기만 보고 곧장 돌아가서, 세계 대회 당일에도 「평일」로 판정됐다.
       진행 버튼이 「진행 ▶」으로 뜨고, 감독 부상 시 수석코치 대행 판정도 걸리지 않았다. */
  try{ if(cwcUserDue()) return true; }catch(e){}
  if(G.phase==="pre") return !!friendlyOn(G.day);
  /* 🌏 EACL 경기일 — 리그 경기일과 별개로 하루를 멈춘다.
     판정을 eaclUserDue 그대로 쓰는 이유: 여기서만 멈추고 advance 가 안 잡으면 무한 루프가 된다. */
  try{ if(eaclUserDue()) return true; }catch(e){}
  // ">=" 인 이유: 어떤 경로로든 경기일을 지나쳐 버리면 영영 멈추지 않는 무한 루프가 된다.
  /* 무직 가드는 함수 맨 위에 있다 — 프리시즌 연습경기까지 함께 막아야 하기 때문이다.
     (팀을 떠나도 userTeamId 는 달력 축으로 남아서, 옛 팀 경기일이 내 경기일로 잡혔던 문제) */
  /* ⚠ 내 부의 일정이 모두 끝났으면 더는 「경기일」이 아니다 — 여기서 멈추면 날짜가 영영 안 넘어간다 */
  if(userSeasonOver()) return false;
  return G.phase==="league" && !!G.cal && userRoundNow()<G.cal.roundDay.length && G.day>=matchDayOf(userRoundNow());
}
/* 오늘 하루에 무슨 일이 있었나 — 로딩창에 흘릴 줄들을 만든다.
   {txt, stop:true} 인 줄이 나오면 진행을 멈추고 감독에게 확인시킨다. */
function dailyEvents(d){
  const out=[];
  const before=G.news.length, offersBefore=(G.offers||[]).length;
  // 시장은 매일 조금씩 움직인다 (종전에는 라운드가 끝날 때 한 번에 몰아서 처리했다)
  if(Math.random()<0.22) genOffers();
  /* ⚠ 제보 — 진행 도중 온 영입 제안이 경기일로 건너뛰며 증발. 감독이 봐야 할 일이면 멈춘다. */
  if(!G.jobless && (G.offers||[]).length>offersBefore){
    const o=(G.offers||[])[(G.offers||[]).length-1];
    const p=userTeam().players.find(x=>x.id===o.pid), b=G.teams[o.tid];
    out.push({txt:`📨 <b>${b?b.short:"타 구단"}</b>이/가 <b>${p?p.name:"우리 선수"}</b> 영입을 제안했습니다 — 답을 기다립니다`, offerStop:true});
  }
  for(let i=G.news.length-before-1;i>=0;i--){
    const nw=G.news[i]; if(nw && nw.cat!=="mood") out.push({txt:nw.txt});
  }
  const added=(G.offers||[]).length-offersBefore;
  if(added>0){
    const o=G.offers[G.offers.length-1];
    const p=userTeam().players.find(x=>x.id===o.pid);
    out.push({txt:`📨 <b>${G.teams[o.tid].short}</b>, ${p?p.name:"우리 선수"} 영입 문의 (제시 ${o.fee}억) — <b>타 구단 제의</b> 탭에서 확인하세요.`,
              alert:true});
  }
  return out;
}
/* 며칠에 한 번, 감독이 놓치기 쉬운 것을 짚어 준다 — FM의 "인박스"에 해당하는 역할 */
function prgContractWatch(){
  const t=userTeam(); if(!t) return;
  if((G.day||0)%7!==0) return;                       // 주 1회
  /* 같은 경고를 매주 반복하면 잔소리가 된다 — 인원이 바뀌었을 때만 다시 알린다 */
  const exp=expiringSoon().filter(p=>(p.ct||1)<=1);
  if(exp.length && t._expSeen!==exp.length){
    t._expSeen=exp.length;
    const best=exp.slice().sort((a,b)=>b.ovr-a.ovr)[0];
    prgPush(`📄 <b>계약 만료 임박 ${exp.length}명</b> — ${best.name}${exp.length>1?" 외":""} · 지금 잡지 않으면 FA로 떠납니다`, "prgAlert");
  }
  const sent=loanedOut(t);
  if(sent.length && Math.random()<0.5){
    const x=pick(sent);
    const played=(x.p.apps||0)-(x.p.loan.apps0||0);
    const r=(t.div===1?G.r1:G.r2)-(x.p.loan.s===G.season?0:0);
    const cold = played<=1 && (G.r1||G.r2)>=6;
    prgPush(cold
      ? `🔁 <b>${x.p.name}</b> — ${x.c.short}에서도 출전이 없습니다 (${played}경기). 조기 소환을 생각해 볼 때입니다`
      : `🔁 <b>${x.p.name}</b> 임대 소식 — ${x.c.short}에서 ${played}경기${x.p.apps?` · 평점 ${(x.p.seasonRating||0).toFixed(2)}`:""}${played>=10&&(x.p.seasonRating||0)>=7.30?" — 완전히 자리를 잡았습니다":""}`,
      cold?"prgAlert":"prgNews");
  }
  /* 🔁 빌려온 선수 — 우리 팀에서 얼마나 쓰고 있는지, 언제 돌려보내야 하는지 */
  const came=(typeof loanedInFrom==="function") ? loanedInFrom(t) : [];
  if(came.length && Math.random()<0.4){
    const p=pick(came);
    const L=p.loan, own=G.teams[L.own];
    const played=(p.apps||0)-(L.apps0||0);
    const rd=(t.div===1?G.r1:G.r2);
    if(L.half && L.backR!=null && L.backR-rd<=3 && L.backR-rd>=0){
      prgPush(`🔁 <b>${p.name}</b> 임대 종료까지 <b>${L.backR-rd}라운드</b> — ${L.buy?"완전 영입 옵션을 쓸지 정해야 합니다":`${own?own.short:"원소속"}으로 돌아갑니다`}`, "prgAlert");
    } else if(played>=8 && (p.seasonRating||0)>=7.30 && L.buy){
      prgPush(`🔁 <b>${p.name}</b> — 임대생인데 ${played}경기 평점 ${(p.seasonRating||0).toFixed(2)}. 완전 영입 옵션을 걸어 둔 게 다행입니다`, "prgNews");
    } else if(played<=1 && rd>=6){
      prgPush(`🔁 <b>${p.name}</b> — 빌려왔는데 ${played}경기밖에 못 뛰었습니다. ${own?own.short:"원소속 구단"}이 지켜보고 있습니다`, "prgAlert");
    } else {
      prgPush(`🔁 <b>${p.name}</b> <span class="small">(${own?own.short:"임대"})</span> — 우리 팀에서 ${played}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}`, "prgNews");
    }
  }
  /* 🔁 이적시장 마감이 다가오는데 임대 자리가 남아 있으면 한 번 짚어 준다 */
  try{
    const wi=windowInfo();
    if(wi.open && wi.left!=null && wi.left<=10 && came.length<LOAN_IN_MAX && Math.random()<0.35){
      const thin=["GK","DF","MF","FW"].filter(ps=>t.players.filter(p=>p.pos===ps&&avail(p)).length<=(ps==="GK"?2:5));
      if(thin.length) prgPush(`🔁 이적시장 마감 <b>D-${wi.left}</b> — 임대 영입 자리가 <b>${LOAN_IN_MAX-came.length}명</b> 남아 있습니다 (${thin.map(x=>POS_KO[x]||x).join("·")} 뎁스가 얇습니다)`, "prgAlert");
    }
  }catch(e){}
  const tut=t.players.filter(p=>p.tutor);
  if(tut.length && Math.random()<0.35){
    const p=pick(tut); const m=t.players.find(q=>q.id===p.tutor.id);
    if(m) prgPush(`🎓 <b>${m.name}</b>이/가 ${p.name}을/를 따로 남겨 훈련시키고 있습니다`, "prgNews");
  }
  const low=t.players.filter(p=>p.morale<45 && !p.loan);
  if(low.length && Math.random()<0.4)
    prgPush(`😞 <b>${pick(low).name}</b> 선수의 표정이 어둡습니다 — 면담이 필요해 보입니다`, "prgAlert");
  // 리그 판도 — 우리 순위가 바뀌면 알려 준다
  if(G.phase==="league" && Math.random()<0.3){
    const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.isUser)+1;
    if(pos>0 && t._lastPos && t._lastPos!==pos)
      prgPush(`📊 리그 순위 <b>${t._lastPos}위 → ${pos}위</b>`, pos<t._lastPos?"prgNews":"prgAlert");
    t._lastPos=pos;
  }
}
function openProgressBox(){
  PROG={timer:null, lines:[], stop:null, left:null, n:0};
  const box=$("#gcModal"); box.className="";
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox prgBox">
    <div class="prgHead"><span id="prgDate">—</span><span id="prgNext" class="small"></span></div>
    <div class="prgBar"><div id="prgFill"></div></div>
    <div class="prgDays" id="prgDays"></div>
    <div class="prgFeed" id="prgFeed"></div>
    <div class="gcBtns"><button class="gcCancel" id="prgStop">멈춤</button>
      <button class="gcCancel" id="prgSkip" style="display:none">일정 진행 ▶</button>
      <button class="gcOk" id="prgGo" style="display:none">진행 ▶</button></div>
  </div></div>`;
  $("#prgStop").onclick=()=>{
    /* 🩸 사채업자 방문에서 「멈춤」은 곧 「문을 열지 않는다」다 — 그 결과를 남긴다 */
    const s0=PROG&&PROG.stop;
    haltProgress(); closeProgress(); refreshAfterProgress();
    if(s0 && s0.kind==="dun" && G.dun){ try{ stkDunPick("hide"); }catch(e){} }
  };
  $("#prgGo").onclick=()=>{ const s=PROG&&PROG.stop; closeProgress(); refreshAfterProgress(); resolveStop(s); };
  /* ⏩ 일정 진행 — 제안·소식을 무시하고 그대로 달린다. 알림 점은 남으니 나중에 확인하면 된다.
     경기일·기자회견·판결처럼 반드시 처리해야 하는 멈춤에는 뜨지 않는다. */
  $("#prgSkip").onclick=()=>{
    if(!PROG) return;
    PROG.stop=null;
    const go2=$("#prgGo"), sk2=$("#prgSkip");
    if(go2) go2.style.display="none";
    if(sk2) sk2.style.display="none";
    const st2=$("#prgStop"); if(st2) st2.textContent="멈춤";
    const _ad2=(G.opt&&G.opt.advDays)|0;
    PROG.left=_ad2>0?_ad2:null; PROG.n=0;
    try{ prgDaysBar(); }catch(e){}
    /* 줄 서 있던 멈춤부터 — 건너뛴 건 이 멈춤이 아니라 방금 그 멈춤이다 */
    if(drainStopQ()) return;
    prgPush(`⏩ 확인은 뒤로 미루고 ${_ad2>0?`<b>${_ad2}일</b>만 더`:"일정을 계속"} 진행합니다…`, "prgDay");
    PROG.timer=setInterval(stepDay, PROG_MS);
  };
}
/* 로딩창을 닫거나 멈출 때, 그 사이에 생긴 일(부상·제의·루머)이 곧바로 메뉴 알림에 뜨게 한다.
   예전에는 다른 탭을 눌러 화면을 갱신해야 빨간 점이 붙었다. */
function refreshAfterProgress(){
  try{
    const t=userTeam();
    if(t) updateTopBar(t, t.div===1?G.r1:G.r2, t.div===1?G.k1Fix:G.k2Fix);
  }catch(e){}
  try{ renderNavDots(); }catch(e){}
  try{ if(typeof updSideInfo==="function") updSideInfo(); }catch(e){}
  try{ if(VIEW && VIEW!=="match" && !liveM) show(VIEW); }catch(e){}
}
function closeProgress(){
  haltProgress();
  saveGame();
  const box=$("#gcModal"); if(box){ box.className="hidden"; box.innerHTML=""; }
  PROG=null;
}
function haltProgress(){ if(PROG&&PROG.timer){ clearInterval(PROG.timer); PROG.timer=null; } }
function prgPush(html, cls){
  if(!PROG) return;
  // ⚠ 여기 들어오는 문구는 F_ 를 거치지 않는 게 많아서 "최주호이/가" 처럼 마커가 그대로 찍혔다.
  if(typeof fixJosa==="function") html=fixJosa(String(html));
  PROG.lines.push(`<div class="prgLine ${cls||""}">${html}</div>`);
  if(PROG.lines.length>PROG_MAX_LINES) PROG.lines.shift();
  const f=$("#prgFeed");
  if(f){ f.innerHTML=PROG.lines.join(""); f.scrollTop=99999; }
}
/* ═══ 📅 「원하는 만큼만 보내기」 ═══════════════════════════════════════
   ⚠ 제보 — 「일정 보내기가 자동으로 쭉 가는 게 아니라, 내가 날짜를 정해서 보내고 싶다」.
     종전에는 경기일·제의처럼 멈출 일이 생길 때까지 달렸다. 이제 일수를 고르면 그만큼만
     흐르고 멈춘다. 고른 값은 기억해 두므로 다음에 진행을 눌러도 같은 폭으로 간다. */
const PRG_DAY_OPTS=[[1,"+1일"],[3,"+3일"],[7,"+7일"],[14,"+14일"],[0,"계속 ▶"]];
function prgDaysBar(){
  const el=$("#prgDays"); if(!el) return;
  const cur=(G.opt&&G.opt.advDays)|0;
  const run=PROG && PROG.timer;
  const badge = (PROG && PROG.left!=null)
    ? `<span class="prgDL">${PROG.left}일 남음</span>`
    : (run?`<span class="prgDL">멈출 때까지</span>`:"");
  el.innerHTML=`<span class="prgDL">보낼 기간</span>`
    + PRG_DAY_OPTS.map(([n,lab])=>`<button class="mini ${cur===n?"sel":""}" onclick="prgRun(${n})">${lab}</button>`).join("")
    + badge;
}
/* 고른 일수만큼 (다시) 달린다 — 멈춰 있던 상태에서 눌러도 이어서 간다 */
function prgRun(n){
  if(!PROG) return;
  n=Math.max(0, n|0);
  G.opt=G.opt||{}; G.opt.advDays=n;
  /* 반드시 처리해야 하는 멈춤(경기일·기자회견·판결 등)에서는 더 보낼 수 없다 */
  const s=PROG.stop;
  if(s && ["match","end","presser","suitApology","suitVerdict","joboffer","dun"].indexOf(s.kind)>=0){
    prgDaysBar();
    try{ flash("먼저 처리해야 할 일이 있습니다 — 아래 버튼으로 진행하세요.","warn"); }catch(e){}
    return;
  }
  PROG.stop=null; PROG.left = n>0 ? n : null; PROG.n=0;
  const go=$("#prgGo"), sk=$("#prgSkip"), st=$("#prgStop");
  if(go) go.style.display="none";
  if(sk) sk.style.display="none";
  if(st) st.textContent="멈춤";
  /* 줄 서 있던 멈춤부터 처리한다 — 같은 날 겹쳐서 미뤄 둔 회견·판결이 먼저다 */
  if(drainStopQ()){ try{ prgDaysBar(); }catch(e){} return; }
  prgPush(n>0?`⏩ <b>${n}일</b>만 더 보냅니다…`:"⏩ 멈출 일이 생길 때까지 보냅니다…", "prgDay");
  haltProgress();
  prgDaysBar();
  PROG.timer=setInterval(stepDay, PROG_MS);
}
function prgHeader(){
  const dt=dateOfDay(G.day);
  const el=$("#prgDate"); if(el) el.textContent=`${dt.getFullYear()}년 ${dt.getMonth()+1}월 ${dt.getDate()}일 (${DOW_KR[dt.getDay()]})`;
  if(G.phase==="pre"){
    const f=nextFriendly(), openOff=(G.cal&&G.cal.openOff)||0;
    const n1=$("#prgNext");
    if(n1) n1.textContent = f ? (f.d>G.day?`다음 연습경기까지 ${f.d-G.day}일`:"연습경기 당일")
                              : `개막까지 ${Math.max(0,openOff-G.day)}일`;
    const fl=$("#prgFill"); if(fl) fl.style.width=Math.round(clamp((G.day||0)/Math.max(1,openOff),0,1)*100)+"%";
    return;
  }
  const nm=nextUserMatch();
  const nd=nm?nm.d:matchDayOf(userRoundNow()), left=Math.max(0, nd-G.day);
  const n2=$("#prgNext"); if(n2) n2.textContent = G.jobless
    ? `🕊️ 무직 ${(G.mgrFree&&G.mgrFree.weeks)||0}주차 — 다음 라운드까지 ${left}일`
    : (left>0 ? `다음 경기${nm?`(${nm.tag})`:""}까지 ${left}일` : `경기 당일${nm?` — ${nm.tag}`:""}`);
  const span=Math.max(1, nd - lastUserMatchDay());
  const fill=$("#prgFill"); if(fill) fill.style.width=Math.round(clamp(1-left/span,0,1)*100)+"%";
}
/* 하루 전진 */
function stepDay(){
  if(!G.cal){ haltProgress(); closeProgress(); return; }
  /* 🌏 ⚠ 제보 — 「4강·결승을 수석코치가 지휘했다」. 리그 일정이 끝나면 달력이 여기서 멈춰
     대회 경기일에 닿지 못했다. 내가 치를 대회 경기가 남아 있으면 그날까지는 계속 흘려보낸다. */
  let _aclLeft=false, _aclDay=-1;
  try{ if(eaclUserLeft()){ _aclLeft=true; _aclDay=eaclUserLastDay(); } }catch(e){}
  /* 승강 PO 가 아직 남아 있으면 그쪽이 먼저다 — 대회 대기는 PO 를 다 치른 뒤에 건다 */
  const _aclHold = _aclLeft && _aclDay>=0 && (G.day||0)<_aclDay
                   && !(G.phase==="po" && ((G.poQueue||[]).length>0));
  if(!_aclHold){
    if(G.phase!=="pre" && (userRoundNow()>=G.cal.roundDay.length || G.day>=G.cal.last)){
      /* 🗓️ 라운드가 남았는데 달력이 먼저 끝난 세이브 — 종료를 선언하지 말고 달력을 고쳐 계속 간다 (제보) */
      if(calRoundRepair()){ prgPush("📢 남은 라운드에 맞춰 일정을 다시 깔았습니다 — 진행을 계속합니다.", "prgAlert"); }
      else { stopProgress({kind:"end"}); return; }
    }
    /* 내 일정이 끝났는데 다른 부도 다 끝났다면 더 흘려보낼 이유가 없다 */
    if(G.phase==="league" && (G.jobless || userSeasonOver())
       && G.r1>=(G.k1Fix||[]).length && G.r2>=(G.k2Fix||[]).length){ stopProgress({kind:"end"}); return; }
  }
  /* 🌍 ⚠ 검증에서 걸림 — 조별 경기일(1/3)에 입영 통지 멈춤이 겹치면 stepDay 가 대회 블록 전에
     돌아간다. 거기서 진행 모달의 「+N일 / 계속 ▶」(prgRun)를 누르면 — prgRun 의 필수처리 목록에
     army·injback·loan·offers 가 없어서 — 날짜가 경기일을 그대로 지나친다. 그 라운드 8경기가
     영영 안 치러지고 fix.every(done) 이 거짓 → cwcSeedKO 불발 → 대회가 조별에서 우승자 없이
     영구 정지했다(실측 재현). EACL 도 날짜 단위 판정이라 같은 구멍이다.
     ─ 오늘 치를 경기가 남아 있으면 어떤 경로로 재개해도 날짜를 넘기지 않는다.
       startProgress 의 「atMatchDay() → runAdvanceNow()」 가드와 같은 원리. 경기를 치르고 나면
       cwcUserDue/eaclUserDue 가 비고 리그는 lastMD 가 잡아 주므로 무한 멈춤은 없다. */
  if(atMatchDay()){ stopProgress({kind:"match"}); return; }
  G.day++;
  if(PROG){ PROG.n=(PROG.n||0)+1; if(PROG.left!=null) PROG.left--; }
  prgHeader(); try{ prgDaysBar(); }catch(e){}
  tickSeasonTickets();          // 시즌권은 1월 2일부터 개막 전날까지 하루씩 팔린다
  try{ tickArmyCall(); }catch(e){}  // 🎖️ 입영 통지 — 입소일이 되면 부대로 간다
  try{ tickArmy(); }catch(e){}  // 상무 전역 — 전역일이 되면 원소속으로 돌아간다
  try{ tickMoney(); }catch(e){} // 감독 월급·집세·임대수익 (매달 1일)
  try{ if(!G.stock) stkInit(); stkTick(); }catch(e){}   // 📈 증시 — 하루에 한 번 시세가 움직인다
  try{ ntsTick(); }catch(e){}        // 🧾 국세청 초과 금융자산 환수 (요청) — 시세가 움직인 뒤에 본다
  try{ ceTick(); }catch(e){}         // 🏢 구단 사건 — 긴축재정·횡령 (요청)
  try{ waTick(); }catch(e){}
  try{ tutorSweep(); }catch(e){}   // 🎓 멘토가 팀을 떠났으면 관계를 끊는다 (제보)         // 💸 임금 체불 — 달이 바뀌는 날 급여를 낸다 (요청)
  try{ motmTick(); }catch(e){}       // 🏅 이달의 선수·감독 — 달이 바뀌는 날 하루에 한 번 (요청)
  try{ realtyTick(); }catch(e){}     // 🏘️ 부동산 시세
  try{ bankBaseTick(); }catch(e){}   // 🏦 기준금리
  try{ bankSpecTick(); }catch(e){}   // ⭐ 특판
  try{ hmlTick(); }catch(e){}        // 🏦 주택담보대출 이자 · 경매
  try{ propLoanTick(); }catch(e){}   // 🏦 부동산 담보대출 이자
  try{ homeEventTick(); }catch(e){}  // 🏚️ 집에서 벌어지는 일
  try{ armyAutoFloor(); }catch(e){}  // 상무 정원이 위험하게 비면 연맹이 채운다
  try{ facDailyTick(); }catch(e){}   // 🏛️ 구단 박물관·투어 — 경기가 없는 날도 번다
  try{ tickOverseasAI(); }catch(e){} // 해외 시장 — 타 구단도 뛰어든다 (이적시장 기간만)
  try{ tickDomesticAI(); }catch(e){} // 🏃 국내 시장 — AI 도 약한 자리를 메우러 움직인다 (요청)
  try{ gamDayTick(); }catch(e){}     // 🎰 도박 — 소문(열기)은 하루마다 식는다
  try{ scoutTick(); }catch(e){}     // 🔎 스카우트 — 파견 기간이 차면 보고가 한 건씩 올라온다
  try{ acMonthTick(); }catch(e){}   // 🎩 코치진 월 급여 — 매달 1일, 이적 예산에서
  try{ acNegoRivalTick(); }catch(e){} // 🏃 협상 중인 스태프를 타 구단이 채 간다 (우수 이상)
  try{ tickOtherDivRounds(); }catch(e){}  // 🗓️ 내 일정이 먼저 끝났으면 남은 부는 날짜에 맞춰 진행된다
  try{ mgrCtTick(); }catch(e){}     // 📜 감독 계약 — 마지막 시즌 중반에 구단이 재계약을 판단한다
  try{ tickSuit(); }catch(e){}      // 진행 중인 소송 — 사과·폭발·판결일
  try{ tickCoachTalk(); }catch(e){} // 타구단 감독들의 뜬금 언급 — 칭찬·관찰·비난
  try{ tickMgrInj(); }catch(e){}    // 🤕 감독 부상 회복 — 전치 기간이 끝나면 복귀
  try{ tickInjuryDays(); }catch(e){} // 🚑 선수 부상 — 날짜로 회복한다 (경기 유무와 무관)
  try{ foreignCondTick(); }catch(e){} // 🌏 해외 클럽(EACL·CWC)도 매일 회복한다 (제보 — 국내와 동일 적용)
  /* 더비 전날이면 팬들이 미리 들썩인다 */
  try{
    const ut0=userTeam();
    if(ut0 && G.phase==="league" && !G.derbyBuzz){
      const f=findUserFixture&&findUserFixture();
      const oid=f ? (f.hid===ut0.id?f.aid:f.hid) : null;
      const db=oid?derbyOf(ut0.id,oid):null;
      const md=matchDayOf(userRoundNow());
      if(db && md-(G.day||0)===1){
        G.derbyBuzz=(G.season*100)+userRoundNow();
        const dv={t:ut0.short, o:G.teams[oid].short, d:db.n};
        socialFill(SOC.derbyPre, 3+R(3), 1, dv);
        fmkFill(FMK.derbyPre, 2+R(3), dv);
        addNews(`🔥 내일은 <b>${db.n}</b> — ${ut0.short} vs ${G.teams[oid].short}. 도시가 들썩입니다.`, null, "club");
      }
      if(md-(G.day||0)>1) G.derbyBuzz=null;
      /* 🔁 임대생 친정팀전 — 라인업을 짜기 전에 미리 알려 준다.
         경기 당일에 알면 이미 늦다(선발에서 자동으로 빠져 당황하게 된다). */
      if(oid && md-(G.day||0)<=2 && md-(G.day||0)>=0){
        const key=(G.season*1000)+userRoundNow();
        if(G.loanWarnR!==key){
          const blocked=(ut0.players||[]).filter(p=>p.loan && p.loan.own===oid);
          if(blocked.length){
            G.loanWarnR=key;
            const nm=blocked.map(p=>p.name).join(", ");
            prgPush(`🔁 <b>${nm}</b> — 이번 ${G.teams[oid].short}전은 <b>원소속 구단</b>이라 출전할 수 없습니다 (임대 규정)`, "prgAlert");
            addNews(`🔁 임대 규정 — ${nm} 선수는 원소속 ${G.teams[oid].short}과의 경기에 출전할 수 없습니다.`, "warn", "club");
          }
        }
      }
    }
  }catch(e){}
  // 시의회에 올려 둔 추경안 — 심의일이 되면 결과가 나온다
  try{ const rq=tickBudgetRequest(); if(rq) prgPush(`🏛️ <b>${REQ_KIND[rq.kind].n}</b> 추경안 ${rq.ok?"가결":"부결"} (${rq.amt}억)`, rq.ok?"prgNews":"prgAlert"); }catch(e){}
  try{ const ab=tickAiBudget(); if(ab) prgPush(`${ab.kind==="corp"?"🏢":"🏛️"} <b>${ab.team.short}</b>, ${ab.amt}억 예산 증액`, "prgNews"); }catch(e){}
  /* 진행 화면은 "며칠이 흘렀다"만 보여 주면 심심하다. 그동안 리그에서 실제로 벌어진 일을
     그때그때 흘려보낸다 — 재계약, 임대 문의, 계약 만료 경고, 남의 집 소식. */
  try{ const rn=tickAiRenew(); if(rn) prgPush(`📝 <b>${rn.t.short}</b>, ${rn.p.name} 재계약 (${rn.y}년)`, "prgNews"); }catch(e){}
  /* 🎖️ 전역 — 내 선수가 군에서 돌아왔다. 진행을 멈추고 알린다(제보) */
  /* 💪 긴 부상 복귀 — 2주 이상 빠져 있던 선수가 돌아왔다. 스쿼드를 다시 볼 때다. */
  try{
    if(G.injBack && G.injBack.n){
      const Q=G.injBack; G.injBack=null;
      const txt=Q.list.slice(0,5).map(x=>`<b>${x.nm}</b>(${POS_KO[x.pos]||x.pos} · ${x.w}주)`).join(" · ");
      /* ⚠ 제보 원문 — 「부상자 복귀 팝업 뒤에 스쿼드 탭으로 가는데, 보통 포메이션을 확인하고
         선수를 갈아 끼우려면 전술 탭으로 가는 게 일반적이다. 전술 탭으로 갈지 물어봐 달라」. */
      prgPush(`💪 <b>부상 복귀 ${Q.n}명</b> — ${txt}${Q.n>5?` 외 ${Q.n-5}명`:""}`
        +`<span class="small"> · <b>전술</b> 탭에서 선발·교체 명단에 다시 넣을지 확인하세요</span>`, "prgStop");
      saveGame(); stopProgress({kind:"injback"}); return;
    }
  }catch(e){}
  /* 🎖️ 입영 통지 — 내 선수에게 통지가 왔다. 라인업 계획이 바뀌므로 진행을 멈추고 알린다. */
  try{
    if(G.armyCallPing && G.armyCallPing.n){
      const Q=G.armyCallPing; G.armyCallPing=null;
      prgPush(`🎖️ <b>입영 통지 ${Q.n}명</b> — ${Q.names.join(", ")} · <b>${Q.ds}</b> 김천 상무 FC 입소 예정`
        +`<span class="small"> (그때까지는 우리 팀에서 뜁니다 · 이적·임대 불가)</span>`, "prgStop");
      saveGame(); stopProgress({kind:"army"}); return;
    }
  }catch(e){}
  try{
    if(G.armyBack && G.armyBack.n){
      const A=G.armyBack; G.armyBack=null;
      prgPush(A.enlist
        ? `🎖️ <b>${A.n}명이 오늘 입소했습니다</b> — ${A.names.join(", ")} · ${ARMY_MONTHS}개월 뒤 복귀합니다`
        : A.gone
        ? `🎖️ <b>${A.gone}명이 전역했습니다</b> — ${A.names.join(", ")} · <b>🎖️ 입대 지원</b> 탭에서 빈자리를 채우세요`
        : `🎖️ <b>${A.n}명이 전역해 복귀했습니다</b> — ${A.names.join(", ")}`, "prgStop");
      saveGame(); stopProgress({kind:"army"}); return;
    }
  }catch(e){}
  /* 📊 파이널 라운드 스플릿 — 리그가 두 동강 나는 순간이라 반드시 멈춰서 알린다 (제보) */
  try{
    if(G.splitPop && !G.jobless){
      const S=G.splitPop; G.splitPop=null;
      const ut0=userTeam();
      const inA=ut0 && S.A.indexOf(ut0.id)>=0;
      const nmL=(ids)=>ids.map(id=>G.teams[id]?G.teams[id].short:"?").join(" · ");
      prgPush(`<span class="prgD">${dateLabel(G.day)}</span> 📊 <b>정규 라운드 종료 — 파이널 라운드 스플릿이 확정됐습니다.</b>`, "prgStop");
      prgPush(`🅰️ <b>파이널 A</b> — ${nmL(S.A)}`, "prgNews");
      prgPush(`🅱️ <b>파이널 B</b> — ${nmL(S.B)}`, "prgAlert");
      if(ut0) prgPush(`${inA?"🅰️":"🅱️"} <b>${ut0.short}</b>은/는 <b>${inA?"파이널 A":"파이널 B"}</b>입니다 — 남은 <b>${S.r}경기</b>는 같은 그룹끼리만 치릅니다.`, inA?"prgNews":"prgAlert");
      prgPush(`파이널 A 6팀이 승점과 무관하게 1~6위, 파이널 B 6팀이 7~12위로 갈립니다.`, "prgDay");
      saveGame(); stopProgress({kind:"split"}); return;
    }
  }catch(e){}
  /* 🔁 임대 통보 — 경기 직후(completeRound)에 쌓인 것을 여기서 감독에게 보여 주고 멈춘다 */
  try{
    if(Array.isArray(G.loanNotes) && G.loanNotes.length){
      for(const n of G.loanNotes) prgPush(n.h, n.c);
      G.loanNotes=[]; saveGame(); stopProgress({kind:"loan", tab:"status"}); return;
    }
  }catch(e){}
  /* 🇸🇦 사우디 클럽의 영입 제안 — 감독이 반드시 봐야 할 일이라 진행을 멈춘다 */
  try{
    const _sa0=G.saOffer;
    tickSaudi();
    if(G.saOffer && G.saOffer!==_sa0){
      const _p=(userTeam().players||[]).find(x=>x.id===G.saOffer.pid);
      prgPush(`🇸🇦 <b>${G.saOffer.club}</b>, <b>${_p?_p.name:"우리 선수"}</b> 영입 제안 — 이적료 <b>${G.saOffer.fee}억</b> · 연봉 ${G.saOffer.wage}억`, "prgStop");
      saveGame(); stopProgress({kind:"offers"}); return;
    }
  }catch(e){}
  /* 알림은 여기서 찍지 않는다 — 만료·선수 이동 정리(바로 아래)를 거친 뒤,
     실제로 남아 있는 건만 아래 임대 알림 큐에서 한 번에 알린다 (제보) */
  try{ tickLoanAsk(); }catch(e){}
  try{ tickLoanOffer(); }catch(e){}
  try{ if(Array.isArray(G.loanOffers)) G.loanOffers=G.loanOffers.filter(o=>{ o.exp--; return o.exp>0 && G.teams[o.tid] && G.teams[o.tid].players.some(x=>x.id===o.pid); }); }catch(e){}
  try{ prgContractWatch(); }catch(e){}
  if(G.phase==="pre"){
    /* 🛌 프리시즌 경기일에도 하루치 회복은 흐른다.
       ⚠ 「경기 당일 회복 0」은 리그 경기일만 고쳐 놓았다. 프리시즌은 이 블록에서 멈추고
         곧장 돌아가기 때문에 아래의 matchDayRecoverAll() 에 닿지 못했다 —
         연습경기든 세계 대회든, 경기가 있는 날은 회복이 통째로 증발했다.
         (실측: 평일 +2.04 · 프리시즌 경기일 +0.00)
       여기서 먼저 준다. 하루에 한 번만 적용되는 함수라 뒤에서 또 불려도 문제없다. */
    if(isMatchDay(G.day)){ try{ matchDayRecoverAll(); }catch(e){} }
    /* ⚠ 제보 — 프리시즌 부상이 개막 전까지 한 주도 회복되지 않았다. 부상 잔여는 주 단위이므로
       프리시즌에는 7일마다 한 주씩 흘려보낸다. (정규 시즌은 라운드가 곧 한 주다) */
    if((G.day||0)>0 && (G.day||0)%7===0){ try{ tickBanInj({inj:true}); }catch(e){} }
    checkPreseasonEnd();
    /* 🌍 CWC — 오늘 열리는 다른 경기부터 치르고, 내 경기가 있으면 멈춘다 */
    try{ cwcTick(false); }catch(e){}
    {
      let cw=null; try{ cw=G.jobless?null:cwcUserDue(); }catch(e){ cw=null; }
      if(cw){
        const me=G.userTeamId, m=cw.m;
        prgPush(`🌍 <b>${cw.tag}</b> — ${cwcNm(m.h===me?m.a:m.h)}전 (${(G.cwc&&G.cwc.host)||""} 개최)`, "prgStop");
        saveGame(); stopProgress({kind:"match"}); return;
      }
    }
    /* ⚠ 제보 — 「무직인데 로딩창에 연습경기 알림이 뜬다」. 내가 짤 라인업도, 앉을 벤치도 없다. */
    const fr=G.jobless ? null : friendlyOn(G.day);
    if(fr){
      const opp=G.teams[fr.oppId];
      prgPush(`🤝 <b>연습경기</b> — ${opp?opp.name:"상대"} (${fr.home?"홈":"원정"})`, "prgStop");
      saveGame(); stopProgress({kind:"match"}); return;
    }
  }
  /* 🛌 경기일에도 하루치 회복은 흐른다 — 아래 블록(훈련·휴식 처리)을 타지 않기 때문에
     여기서 따로 돌려 준다. 하루에 한 번만 적용된다. (제보) */
  if(isMatchDay(G.day)){ try{ matchDayRecoverAll(); }catch(e){} }
  if(!isMatchDay(G.day)){
    const pl=dayPlan(G.day);
    /* ⚠ 제보 — 「무직인데 일정 진행에 선수 불만이 뜬다」.
       팀을 떠나도 옛 팀에 내 훈련 계획을 적용하고 있었다(applyDayToTeam(userTeam(), ...)).
       그 안에서 사기·불만·훈련 부상이 「내 선수 일」로 처리돼 로딩창에 새어 나왔다.
       무직이면 옛 팀도 다른 AI 구단과 똑같이 굴러가야 한다 — 아래 루프가 이미 그 일을 한다. */
    const _fc = (pl.t==="train") ? focusOf(pl) : null;
    const lab = G.jobless ? "무직 — 리그를 지켜봅니다"
              : (pl.t==="rest" ? "휴식"
                : `훈련 · ${TRAIN_INT[pl.i||0].n}${_fc&&_fc.k!=="bal"?` · ${_fc.ic} ${_fc.n}${_fc.k==="pos"?` (${(POS_LINES.find(L=>L.k===(pl.ln||"ALL"))||{n:"전원"}).n})`:""}`:""}`);
    prgPush(`<span class="prgD">${dateLabel(G.day)}</span> <span class="prgT">${lab}</span>`, "prgDay");
    const hurt = G.jobless ? null : applyDayToTeam(userTeam(), pl);
    for(const id in G.teams){
      const t=G.teams[id]; if(t.isUser) continue;
      const ah=applyDayToTeam(t, aiDayPlan(t,G.day));
      // 남의 집 부상도 리그 뉴스다 — 다만 웬만큼 중요한 선수만 기사가 된다
      if(ah && ah.ovr>=teamOVR(t)+2 && Math.random()<0.5){
        const _at=(function(){ try{ const T=injTypeOf(ah); return T?T.n:"부상"; }catch(e){ return "부상"; } })();
        pushFeed({cat:"injury", ic:"🚑", tone:0, tid:t.id,
          head:`${t.name} ${ah.name}, 훈련 중 ${_at}… ${ah.inj}주 결장`,
          sub:`${t.short}은/는 ${POS_KO[ah.pos]||ah.pos} 자리에 공백이 생겼다.`});
      }
    }
    // 한 달에 한 번 능력치 사진 — 추세 화살표(▲▼)와 성장 그래프의 원본
    if(devSnapDue()){ for(const id in G.teams) devSnapshot(G.teams[id]); }
    if(hurt){
      /* 부상은 알려만 주고 멈추지 않는다 — 스쿼드 탭에 빨간 점이 붙으니 나중에 확인하면 된다.
         ⚠ 기사(뉴스)는 mkInjury → injNews 가 이미 유형·원인까지 담아 냈다. 여기서는
            날짜 진행 기록 한 줄만 남긴다 — 두 번 쓰면 뉴스가 겹친다 (요청 「배선도 정확하게」). */
      const _t=(function(){ try{ const T=injTypeOf(hurt); return T?`${T.ic} ${T.n}`:"부상"; }catch(e){ return "부상"; } })();
      prgPush(`🚑 <b>${hurt.name}</b> 선수가 훈련 중 쓰러졌습니다 — ${_t} (약 ${hurt.inj}주 결장)`, "prgAlert");
    }
    /* 📨 하루치 소식 — 이적 문의·이적 뉴스를 먼저 흘려보낸다.
       ⚠ 제보 원문 — 「현재 기자회견 방식에선 기자회견하는 날 동안은 타구단 제의가 안 와
          많은 선수를 영입하면 타구단 제의를 아예 못 받고 이적시장이 끝나 판매를 못 하는
          경우가 생깁니다」.
       ─ 원인이 순서였다. 영입 발표 기자회견이 잡힌 날은 duePresser() 에서 곧바로 return 해
         버려서 그날의 dailyEvents() 가 아예 돌지 않았다. 타구단 제의를 굴리는 곳(genOffers,
         하루 22%)이 바로 거기라서, 영입을 많이 할수록 회견 날이 늘고 그만큼 제의 굴림이
         통째로 사라졌다. 이적시장이 끝날 때까지 제의를 한 건도 못 받는 일이 실제로 났다.
       ─ 순서를 뒤집는다. 하루의 소식은 먼저 다 굴리고, 기자회견은 그다음에 잡는다.
         둘 다 멈출 일이면 stopProgress 가 뒤엣것을 stopQ 에 줄 세우므로 하나도 잃지 않는다. */
    let _offStop=false;
    for(const e of dailyEvents(G.day)){
      prgPush(e.txt, (e.offerStop&&!G.jobless)?"prgStop":e.alert?"prgAlert":"prgNews");
      /* ⚠ 무직 — 구단 일로 진행을 멈출 이유가 없다 (제보) */
      if(e.offerStop && !G.jobless) _offStop=true;
    }
    // 오늘 예정된 영입 발표 기자회견이 있으면 여기서 멈춘다
    const pres=duePresser();
    if(pres && !G.jobless){
      prgPush(`🎙️ <b>${pres.name}</b> 영입 발표 기자회견이 예정돼 있습니다.`, "prgStop");
      saveGame(); stopProgress({kind:"presser", info:pres});
      if(_offStop) stopProgress({kind:"offers"});   // 회견이 끝나면 이어서 뜬다 (stopQ)
      return;
    }
    if(_offStop){ saveGame(); stopProgress({kind:"offers"}); return; }
    /* 📬 감독직 제의 — 무직에게 이보다 급한 소식은 없다 */
    if(G._jobOfferPing){
      const jo=G._jobOfferPing; G._jobOfferPing=null;
      const n=((G.mgrFree&&G.mgrFree.off)||[]).length;
      /* ⚠ fixJosa 는 바로 앞 「글자」를 본다 — 태그(</b>)가 끼면 판정이 깨진다.
         이름만으로 조사를 뽑아 붙인다 (알려진 우회). */
      const _js=fixJosa(jo.name+"이/가").slice(jo.name.length);
      prgPush(`📬 <b>${jo.name}</b>${_js} 감독직을 제의했습니다 — ${divName(jo.div)} · 답변 기한 2주${n>1?` (대기 중인 제의 ${n}건)`:""}`, "prgStop");
      saveGame(); stopProgress({kind:"joboffer"}); return;
    }
    /* 🩸 사채업자 방문 — 무직이면 집으로 찾아온다 */
    if(stkDunDue()){
      const D=stkDunFire();
      prgPush(`🩸 <b>사채업자들이 찾아왔습니다.</b> 현관 앞에 두 사람이 서 있습니다 — 잔액 ${(D.amt/1e8).toFixed(2)}억 (${D.n}회차)`, "prgStop");
      saveGame(); stopProgress({kind:"dun"}); return;
    }
    /* 🔁 임대 제안·요청 — 이적 제의와 똑같이 일정을 멈추고 알려 준다.
       띄우기 직전에 살아 있는 건만 남긴다 — 화면과 임대 센터가 어긋나지 않게 (제보) */
    if(Array.isArray(G._loanPing) && G._loanPing.length){
      const L=G._loanPing.filter(loanPingAlive);
      G._loanPing=[];
      if(!G.jobless && L.length){
        for(const x of L) prgPush(x.txt+" — 임대 센터에서 기다립니다", "prgStop");
        if(L.length>1) prgPush(`🔁 확인해야 할 임대 건이 <b>${L.length}건</b>입니다.`, "prgAlert");
        saveGame(); stopProgress({kind:"loan", tab:"offer"}); return;
      }
    }
    if(Math.random()<(transferOpen()?0.30:0.10)){
      const rr=genRumor();
      if(rr){ rumorPush(rr); applyRumorFallout(); rumorToFeed(rr);
        prgPush(`${rr.ric} <b>${rr.rep}</b> — ${rr.txt}`, "prgNews"); }
    }
  }
  if(atMatchDay()){ stopProgress({kind:"match"}); return; }
  /* 📅 고른 일수를 다 보냈다 — 여기서 멈춘다 (제보) */
  if(PROG && PROG.left!=null && PROG.left<=0){ stopProgress({kind:"days"}); return; }
}
/* ⚠ 제보 — 「소송 걸었는데 판결이 나왔다는데 (팝업이) 계속 안 떠요. 보니까 선수영입
   기자회견도 씹힘」. 하루에 멈출 일이 두 개 겹치면(판결+기자회견 · 판결+경기일 ·
   판결+「N일 끝」…) 나중 stopProgress 가 앞의 멈춤을 그대로 덮어썼다. tickSuit 는 멈춤을
   걸고도 stepDay 를 끝까지 흘려보내므로 이 충돌이 일상적으로 났다. 판결은 다음 날 다시
   뜨니 그나마 티가 덜 났지만, 기자회견은 duePresser() 가 큐에서 이미 꺼낸 뒤라 덮어써지는
   순간 영영 사라졌다.
   ─ 이미 멈춤이 걸려 있으면 덮어쓰지 않고 G.stopQ 에 줄을 세운다(세이브에도 남는다).
     다음에 진행을 누르면 줄 선 것부터 차례로 멈춰서 하나도 흘리지 않는다.
     경기일·「N일 끝」·시즌 끝은 날짜가 다시 오면 저절로 다시 걸리므로 줄 세우지 않는다. */
const STOPQ_MSG={presser:"🎙️ 미뤄 둔 <b>영입 발표 기자회견</b>이 있습니다.",
  suitVerdict:"⚖️ <b>소송 판결</b>이 나와 있습니다.",
  suitApology:"📩 <b>사과문</b>이 올라와 있습니다 — 수용 여부를 정해야 합니다.",
  joboffer:"📬 <b>감독직 제의</b>가 기다리고 있습니다.",
  dun:"🩸 <b>사채업자</b>들이 기다리고 있습니다.",
  loan:"🔁 <b>임대 건</b>이 기다리고 있습니다.",
  offers:"📨 <b>이적 제의</b>가 기다리고 있습니다.",
  army:"🎖️ <b>입영 통지</b> 확인이 남아 있습니다.",
  injback:"💪 <b>부상 복귀</b> 확인이 남아 있습니다.",
  split:"📊 <b>스플릿 확정</b> 확인이 남아 있습니다."};
function drainStopQ(){
  if(!(G.stopQ && G.stopQ.length && PROG)) return false;
  const s=G.stopQ.shift();
  prgPush(STOPQ_MSG[s.kind]||"확인할 일이 남아 있습니다.", "prgStop");
  saveGame(); stopProgress(s);
  return true;
}
function stopProgress(s){
  haltProgress();
  try{ renderNavDots(); }catch(e){}   // 멈춘 그 순간 바로 알림 점을 갱신한다
  if(!PROG) return;
  if(PROG.stop && PROG.stop!==s){
    if(["match","days","end"].indexOf(s.kind)>=0) return;   // 날짜가 다시 오면 저절로 걸린다
    const same=(a,b)=>a.kind===b.kind && ((a.info&&a.info.pid)===(b.info&&b.info.pid));
    G.stopQ=G.stopQ||[];
    if(!same(PROG.stop,s) && !G.stopQ.some(x=>same(x,s))) G.stopQ.push(s);
    return;
  }
  PROG.stop=s;
  const go=$("#prgGo"), st=$("#prgStop");
  if(s.kind==="match" && G.jobless){
    /* 🕊️ 무직 — 내가 치를 경기가 없다. 어떤 경로로 여기까지 와도 경기 문구는 띄우지 않는다. */
    prgPush(`<span class="prgD">${dateLabel(G.day)}</span> 리그 경기가 치러졌습니다. 나는 지켜보는 쪽입니다.`, "prgDay");
    if(go){ go.textContent="🕊️ 계속 보내기 ▶"; go.style.display=""; }
    if(st) st.textContent="닫기";
    return;
  }
  if(s.kind==="match"){
    /* 🌍 오늘이 CWC 경기일이면 그쪽이 먼저다 — advance() 도 CWC 를 먼저 잡는다.
       ⚠ 이게 없으면 findUserFixture() 가 엉뚱한 리그 대진을 물어 와
         세계 대회 당일에 「⚽ 홈 · ○○전 — 경기일입니다」라고 안내했다. */
    let _cq=null; try{ _cq=cwcUserDue(); }catch(e){ _cq=null; }
    if(_cq){
      const me=G.userTeamId, m=_cq.m, opp=cwcTeam(m.h===me?m.a:m.h);
      prgPush(`<span class="prgD">${dateLabel(G.day)}</span> 🌍 <b>${_cq.tag}</b> — ${opp?opp.name:"상대"}전입니다. <span class="small">${(G.cwc&&G.cwc.host)||""} · 중립지</span>`, "prgMatch");
      if(go){ go.textContent="🌍 "+cwcShort()+" 경기 시작 ▶"; go.style.display=""; }
      if(st) st.textContent="닫기";
      return;
    }
    /* 🌏 오늘 EACL 경기가 걸려 있으면 그쪽을 먼저 안내한다 — advance()도 EACL을 먼저 잡는다 */
    let _eq=null; try{ _eq=eaclUserDue(); }catch(e){ _eq=null; }
    if(_eq){
      const me=G.userTeamId, tg=(_eq.kind==="md"?_eq.m:_eq.t), home=(tg.h===me);
      const opp=eaclTeam(home?tg.a:tg.h);
      prgPush(`<span class="prgD">${dateLabel(G.day)}</span> 🌏 <b>${_eq.tag}</b> — ${home?"홈":"원정"} · ${opp.name}전입니다.`, "prgMatch");
      if(go){ go.textContent="🌏 "+eaclShort()+" 경기 시작 ▶"; go.style.display=""; }
      if(st) st.textContent="닫기";
      return;
    }
    const uf=findUserFixture();
    if(uf){
      const opp=G.teams[uf.hid===G.userTeamId?uf.aid:uf.hid];
      prgPush(`<span class="prgD">${dateLabel(G.day)}</span> ⚽ <b>${uf.hid===G.userTeamId?"홈":"원정"} · ${opp.name}</b>전 — 경기일입니다.`, "prgMatch");
      if(go){ go.textContent="경기 시작 ▶"; go.style.display=""; }
    } else {
      prgPush(`<span class="prgD">${dateLabel(G.day)}</span> 이번 라운드는 휴식입니다.`, "prgMatch");
      if(go){ go.textContent="라운드 진행 ▶"; go.style.display=""; }
    }
  } else if(s.kind==="days"){
    const nm=nextUserMatch(), lf=nm?nm.left:0;
    prgPush(`<span class="prgD">${dateLabel(G.day)}</span> 📅 <b>${PROG.n||0}일</b>을 보냈습니다.`
      + (nm&&lf>0?` 다음 <b>${nm.tag}</b> 경기까지 <b>${lf}일</b> 남았습니다.`:""), "prgMatch");
    if(go){ go.textContent="여기서 마칩니다 ▶"; go.style.display=""; }
    if(st) st.textContent="닫기";
    try{ prgDaysBar(); }catch(e){}
    return;
  } else if(s.kind==="end"){
    prgPush("시즌 일정이 모두 끝났습니다.", "prgMatch");
    if(go){ go.textContent="계속 ▶"; go.style.display=""; }
  } else if(s.kind==="presser"){
    if(go){ go.textContent="🎙️ 기자회견장으로 ▶"; go.style.display=""; }
  } else if(s.kind==="suitApology"){
    if(go){ go.textContent="📩 사과문 확인 ▶"; go.style.display=""; }
  } else if(s.kind==="suitVerdict"){
    if(go){ go.textContent="⚖️ 판결문 확인 ▶"; go.style.display=""; }
  } else if(s.kind==="joboffer"){
    if(go){ go.textContent="📬 제의 확인하기 ▶"; go.style.display=""; }
    if(st) st.textContent="나중에 본다";
  } else if(s.kind==="dun"){
    if(go){ go.textContent="🩸 만나러 나간다 ▶"; go.style.display=""; }
    if(st) st.textContent="문을 열지 않는다";
  } else if(s.kind==="split"){
    if(go){ go.textContent="📊 순위표 확인 ▶"; go.style.display=""; }
    if(st) st.textContent="닫기";
  } else if(s.kind==="injback"){
    if(go){ go.textContent="💪 전술판 열기 ▶"; go.style.display=""; }   // 제보 — 스쿼드가 아니라 전술 탭
    const sk=$("#prgSkip"); if(sk) sk.style.display="";
  } else if(s.kind==="army"){
    if(go){ go.textContent="🎖️ 스쿼드 확인 ▶"; go.style.display=""; }
  } else if(s.kind==="loan"){
    if(go){ go.textContent="🔁 임대 센터 확인 ▶"; go.style.display=""; }
    const sk=$("#prgSkip"); if(sk) sk.style.display="";
  } else {
    if(go){ go.textContent="확인하러 가기 ▶"; go.style.display=""; }
    const sk=$("#prgSkip"); if(sk) sk.style.display="";   // 무시하고 달릴 수 있는 멈춤
  }
  /* ⚠ 위에서 정해 둔 취소 문구(「나중에 본다」·「문을 열지 않는다」)를 덮어쓰지 않는다 */
  if(st && !["joboffer","dun"].includes(s.kind)) st.textContent="닫기";
}
/* 멈춤 사유에 따라 다음 행동 */
function resolveStop(s){
  if(!s) { show("home"); return; }
  if(s.kind==="days"){ show("home"); window.scrollTo(0,0); return; }
  if(s.kind==="match"){ runAdvanceNow(); return; }
  if(s.kind==="end"){ runAdvanceNow(); return; }
  if(s.kind==="presser"){
    const _info=(s&&s.info)||G.signPend;                /* 팝업 상태가 유실됐어도 붙잡아 둔 회견으로 연다 (제보) */
    if(_info && openSignPresser(_info)) return;
    try{ flash("🎙️ 영입 발표 기자회견을 열 수 없습니다 — 대상 선수가 스쿼드에 없습니다.","warn"); }catch(e){}
    show("home"); return; }
  if(s.kind==="offers"){ show("offers"); return; }
  if(s.kind==="joboffer"){ show("home"); window.scrollTo(0,0); return; }   // 무직 홈 = 제의 카드가 있는 화면
  if(s.kind==="dun"){ VIEW="home"; $("#main").innerHTML=stkDunView(); window.scrollTo(0,0); return; }
  if(s.kind==="split"){ try{ TBLTAB="league"; }catch(e){} show("table"); window.scrollTo(0,0); return; }
  if(s.kind==="injback"){ show("tactics"); window.scrollTo(0,0); return; }   // 제보 — 포메이션을 보고 갈아 끼우는 자리
  if(s.kind==="army"){ show("squad"); return; }
  if(s.kind==="loan"){ try{ lcTab=s.tab||"offer"; }catch(e){} show("loancenter"); return; }
  if(s.kind==="suitApology"){ show("media"); suitApologyPopup(); return; }
  if(s.kind==="suitVerdict"){ show("media"); sueVerdict(); return; }
  show(s.go||"home"); window.scrollTo(0,0);
}
/* 실제 라운드/경기 실행 — 종전 advance() 흐름 그대로 */
function runAdvanceNow(){
  /* ⚽ 요청 — 선발 열한 명이 채워지지 않으면 경기를 시작하지 않는다 (FM 방식) */
  if(xiGateStop(false)) return;
  const r=advance();
  if(r.type==="live"){
    /* 🎮 ⚠ 요청 원문 — 「스태프 회의에서 지금 프리시즌 운영을 수석코치에게 맡긴다가 있잖아.
       이걸 이제 연습경기 뿐만아니라 모든 리그, 대회 경기 다 포함되게 하자. 프리시즌 운영
       이거 이름도 경기 운영으로 바꾸고. 이제 모든 경기를 수석코치에게 맡길수있어서
       빠른 스킵이 가능하게 된거야」.
       ─ 대행 경로(runDelegatedMatch)는 이미 리그·승강PO·EACL·CWC 마무리를 전부 처리한다.
         감독 부상 때만 쓰던 그 길을 「감독이 스스로 맡긴 경우」에도 열어 준다. */
    let _inj=false; try{ _inj=mgrInjured(); }catch(e){}
    if(_inj){ runDelegatedMatch(r.M, r.tag, "inj"); return; }   // 🚑 다쳤으면 선택의 여지가 없다
    if(staffOpt().delegatePre){
      if(r.M.opts && r.M.opts.friendly){ runDelegatedFriendly(r.M); return; }  // 연습경기는 프리시즌 전용 보고서
      runDelegatedMatch(r.M, r.tag, "del"); return;
    }
    showPreMatchTactics(r.M, r.tag); return;
  }
  if(r.type==="pomatch") lastMatch=r;
  else if(r.type==="round"||r.type==="seasonEnd"||r.type==="newseason") lastMatch=null;
  show("home"); window.scrollTo(0,0);
}
/* 🚑 감독 부상 — 수석코치가 대신 치른 정규 경기. 감독은 결과만 보고받는다. */
/* ⚡ ⚠ 제보 원문 — 「어느 순간부터 수코 위임하면 렉 개걸려요」.
   원인은 이 함수가 90분치 시뮬을 <b>한 번에 동기로</b> 돌린다는 것이다. 직접 관전할 때는 같은
   계산이 실시간에 흩어져 티가 안 나지만, 위임은 그 전부가 한 호출에 몰려 그동안 브라우저가
   통째로 멈춘다(실측: 한 경기 43초 · 틱당 2.12ms).
   ─ 두 갈래로 고쳤다.
     ① 계산 자체를 줄였다 — TAC()·앵커 좌표 캐시 + 역할 재배정 주기화(틱당 2.12 → 1.46ms).
     ② 그래도 한 번에 돌리면 멈춘다. <b>조각내어 돌린다</b> — 한 조각(≈1200틱)마다 화면에
        제어권을 돌려주고 진행률을 보여 준다. 화면이 살아 있으니 「렉」으로 느껴지지 않는다. */
/* ⚠ 1차 시도는 「틱 수」로 잘랐다(1200틱) — 한 조각이 1.7초라 화면이 그만큼씩 얼어붙었다(실측).
   조각의 기준은 틱이 아니라 <b>시간</b>이어야 한다. 한 프레임 예산(12ms)만 돌고 넘긴다. */
const DELEG_MS=20;             // 한 조각의 시간 예산 (ms) — 12ms 는 화면은 매끄러웠지만 총 대기가 길었다
/* 조각내어 90분을 돌린다 — 한 조각(DELEG_MS)마다 화면에 제어권을 돌려주고 게이지를 올린다.
   다 끝나면 done(M) 을 부른다. 위임 경기와 위임 연습경기가 같은 길을 쓴다. */
function delegChunkRun(M, tag, why, done){
  /* ⚡ rec:false — 결과만 보고받는 경기라 하이라이트·자막을 녹화하지 않는다 (제보: 위임 렉) */
  const sim=new MatchSim(M, {live:true, rec:false});
  try{ delegBoxOpen(M, tag, why); }catch(e){}
  try{ delegProgress(0, tag, why, 0); }catch(e){}
  const _fin=()=>{ try{ delegProgress(1, tag, why, sim.clock); }catch(e){} done(M); };
  const step=()=>{
    try{
      const _now=()=>((typeof performance!=="undefined"&&performance.now)?performance.now():Date.now());
      const _t0=_now();
      let n=0;
      while((sim.clock<sim.endSec || sim.varPending || sim.pkHold())){
        sim.tick();
        if(sim.emitEvents) sim.stoppageCheck();
        if(sim.clock>=SIM_SECONDS && sim.tryExtraTime()) continue;
        if((++n & 31)===0 && _now()-_t0 >= DELEG_MS) break;   // 32틱마다 시계를 본다
      }
      if(sim.clock<sim.endSec || sim.varPending || sim.pkHold()){
        try{ delegProgress(clamp(sim.clock/Math.max(1,sim.endSec),0,0.99), tag, why, sim.clock); }catch(e){}
        setTimeout(step, 0);            // 화면에 제어권을 돌려준다
        return;
      }
      try{ if(sim.clock>=sim.endSec-1) sim.runShootoutIfNeeded(); sim.finishMatch(); }catch(e){}
      while(!M.done) stepMinute(M);
      _fin();
    }catch(e){
      try{ console.warn("위임 경기 진행 실패:", e); }catch(_){}
      try{ while(!M.done) stepMinute(M); }catch(_){}
      _fin();
    }
  };
  setTimeout(step, 0);
}
function runDelegatedMatch(M, tag, why){
  const _inj=(why!=="del");                     // 🚑 부상 대행인가, 🎮 감독이 맡긴 경기인가 (요청)
  /* 🎩 이 경기는 수석코치가 벤치를 굴린다 — 교체·전술 조정이 코치 능력치대로 나온다 (요청) */
  M.acRun=true;
  try{ snapshotTactic(); }catch(e){}            // 코치가 성향을 손대면 경기 뒤 되돌린다
  const _acLv=acBenchLv();
  delegChunkRun(M, tag, why, (M2)=>delegFinish(M2, tag, why, _inj, _acLv));
}
/* 진행률 — 로딩 상자가 열려 있으면 그 안에, 아니면 배너로 */
/* 🎩 위임 경기 전용 로딩창.
   ⚠ 제보 — 「로딩창에 진행 게이지가 안 보인다」. 원인: 진행 상자의 「진행 ▶」 버튼이
      resolveStop() 을 부르기 <b>전에</b> closeProgress() 를 부른다. 그래서 경기가 시작될 때는
      #prgFeed 가 이미 사라진 뒤였고, 게이지는 갈 곳이 없어 배너로 떨어졌다.
      → 진행 상자가 살아 있으면 거기에, 없으면 이 창을 직접 띄운다. */
function delegBoxOpen(M, tag, why){
  if(document.getElementById("prgFeed")) return;            // 진행 상자 안에 그린다
  const box=document.getElementById("gcModal"); if(!box) return;
  const nm=(typeof acName==="function")?acName():"수석코치";
  let _j="이";
  try{ if(typeof fixJosa==="function") _j=fixJosa(nm+"이/가").slice(nm.length); }catch(e){}
  let fx="";
  try{ fx=`${M.home.short} <span class="small">vs</span> ${M.away.short}`; }catch(e){}
  box.className="";
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox" id="delegBox" style="width:min(400px,92vw)">
    <div style="font-weight:800;font-size:15px;margin-bottom:2px">${why==="inj"?"🩺 수석코치 대행":"🤝 "+((typeof acTitle==="function")?acTitle():"수석코치")+" 위임"}</div>
    <div class="small" style="color:var(--sub);margin-bottom:10px">${fx}${tag?` · ${tag}`:""}</div>
    <div class="dlgWrap">
      <div class="dlgTop"><span id="dlgHead">🎩 <b>${nm}</b>${_j} 경기를 치르는 중입니다…</span><span class="dlgPct" id="dlgPct">0%</span></div>
      <div class="dlgBar"><div class="dlgFill" id="dlgFill"></div></div>
      <div class="dlgMin"><span id="dlgClk"></span><span>결과만 보고받습니다</span></div>
    </div>
  </div></div>`;
}
function delegBoxClose(){
  const b=document.getElementById("delegBox");
  if(!b) return;                                            // 진행 상자 안에 그렸다면 건드리지 않는다
  const box=document.getElementById("gcModal");
  if(box){ box.className="hidden"; box.innerHTML=""; }
}
/* 🎩 위임 경기 진행 표시 — 숫자만이 아니라 <b>게이지</b>로 보여 준다 (요청).
   조각내어 돌리는 동안 화면이 멈춰 보이지 않게, 막대가 차오르고 경기 시계도 같이 흐른다.
   clk = 지금 경기 시계(초). 없으면 진행률만 쓴다. */
function delegProgress(p, tag, why, clk){
  const pct=Math.round(clamp(p,0,1)*100);
  const nm=(typeof acName==="function")?acName():"수석코치";
  /* ⚠ 「이광현가」 — 조사가 안 붙었다. fixJosa 는 마커 <b>바로 앞 글자</b>를 보는데
     `<b>이름</b>이/가` 는 앞 글자가 「>」였다(실측). 이름에 먼저 붙여 조사를 정한 뒤 태그를 씌운다. */
  let _j="이";
  try{ if(typeof fixJosa==="function") _j=fixJosa(nm+"이/가").slice(nm.length); }catch(e){}
  const head=`🎩 <b>${nm}</b>${_j} ${tag||"경기"}를 치르는 중입니다…`;
  /* 경기 시계 — 전·후반 표기까지 붙여 「지금 몇 분인지」가 보이게 */
  let clock="";
  if(clk!=null && isFinite(clk)){
    const _half=(typeof SIM_SECONDS!=="undefined"?SIM_SECONDS:5400)/2;
    const mm=Math.floor(clk/60)+1;
    /* 추가시간은 축구 표기대로 45+N · 90+N */
    clock = clk<_half
      ? (mm>45 ? `전반 45+${mm-45}분` : `전반 ${mm}분`)
      : (mm>90 ? `후반 90+${mm-90}분` : `후반 ${mm}분`);
  }
  /* 게이지가 그려질 자리 — ① 진행 상자가 열려 있으면 그 피드 안, ② 아니면 전용 로딩창.
     ⚠ #prgFeed 는 prgPush 와 같은 컨테이너다(처음에 id 를 틀려 아무 데도 안 찍혔다). */
  let bar=document.getElementById("dlgFill");
  if(!bar){
    const el=document.getElementById("prgFeed");
    if(el){
      const row=document.createElement("div");
      row.id="delegRow"; row.className="prgLine";
      row.innerHTML=`<div class="dlgWrap">
        <div class="dlgTop"><span id="dlgHead"></span><span class="dlgPct" id="dlgPct">0%</span></div>
        <div class="dlgBar"><div class="dlgFill" id="dlgFill"></div></div>
        <div class="dlgMin"><span id="dlgClk"></span><span>결과만 보고받습니다</span></div>
      </div>`;
      el.appendChild(row);
      try{ el.scrollTop=99999; }catch(e){}
      bar=document.getElementById("dlgFill");
    }
  }
  if(bar){
    const h=document.getElementById("dlgHead"); if(h && !h.innerHTML) h.innerHTML=head;
    /* 20ms 마다 불리므로 눈에 보이는 값이 바뀔 때만 DOM 을 건드린다 */
    if(bar._pct!==pct){
      bar._pct=pct; bar.style.width=pct+"%";
      const q=document.getElementById("dlgPct"); if(q) q.textContent=pct+"%";
    }
    const c=document.getElementById("dlgClk");
    if(c && c.textContent!==clock) c.textContent=clock;
    return;
  }
  /* 어느 창도 없을 때 — 경기 화면 자막이나 배너로 */
  const txt=`${head} <b>${pct}%</b>${clock?` <span class="small">(${clock})</span>`:""}`;
  const cap=document.getElementById("pitchCaption");
  if(cap){ cap.innerHTML=txt; return; }
  try{ flash(txt, "info"); }catch(e){}
}
function delegFinish(M, tag, why, _inj, _acLv){
  try{ delegBoxClose(); }catch(e){}      // 🎩 전용 로딩창을 닫고 보고 화면으로 넘어간다
  const t=userTeam();
  const isHome=M.home.isUser;
  const mine=isHome?M.hg:M.ag, his=isHome?M.ag:M.hg;
  const opp=isHome?M.away:M.home;
  /* ⚠ 제보 — 대행 경기 뒤 일정이 넘어가지 않고 같은 상대와 계속 붙는다.
     결과만 반영(applyMatchResult)하고 라운드 마무리(completeRound)를 하지 않아
     라운드 번호가 그대로 남았다. 감독이 직접 치른 경기와 똑같은 마무리를 거친다. */
  try{
    if(G.pendingFriendly){
      const f=G.pendingFriendly; G.pendingFriendly=null;
      f.done=true; f.hg=M.hg; f.ag=M.ag;
      preFriendlyPlayed();
      applyMatchResult(M);
      checkPreseasonEnd();
    } else if(G.pendingPO){
      const {m,hid,aid}=G.pendingPO; G.pendingPO=null;
      applyMatchResult(M);
      poResolve(m, hid, aid, M.hg, M.ag, M.pk?(M.pk.win==="h"?1:-1):0);
      poRestDays();   // ⚔️ 대행 경기 뒤에도 똑같이 쉰다 (제보)
    } else if(G.pendingCWC){
      /* 🌍 CWC 대행 — 리그 라운드를 넘기면 안 된다 */
      const P=G.pendingCWC; G.pendingCWC=null;
      applyMatchResult(M);
      try{ cwcStatCollect(M); }catch(e){}
      try{ cwcResolveUser(P, M.hg, M.ag, M.pk?(M.pk.win==="h"?1:-1):0); }catch(e){}
      try{ matchNewsCwc(M, P.tag); }catch(e){}
    } else if(G.pendingEACL){
      /* 🌏 EACL 대행 — 리그 라운드를 넘기면 안 된다(completeRound 금지) */
      const P=G.pendingEACL; G.pendingEACL=null;
      applyMatchResult(M);
      const P2 = P.kind==="md"
        ? {kind:"md", d:P.d, m:(G.eacl&&G.eacl.fix.find(x=>x.d===P.d && x.h===P.hid && x.a===P.aid))}
        : {kind:P.kind, t:(P.kind==="f" ? (G.eacl&&G.eacl.ko.f) : (G.eacl&&(G.eacl.ko[P.kind]||[]).find(x=>x.h===P.hid && x.a===P.aid)))};
      if((P2.m||P2.t)) eaclResolveUser(P2, M.hg, M.ag, M.pk?(M.pk.win==="h"?1:-1):0);
      try{ eaclGate(M); }catch(e){}
      /* 🟨 대행 경기도 징계 장부는 똑같이 정리한다 */
      try{ const _ut=userTeam(); eaclBanPop(_ut); eaclBanTick(_ut); }catch(e){}
    } else {
      completeRound(M);          // 정규 라운드 — 여기서 일정이 다음 라운드로 넘어간다
    }
  }catch(e){ try{ console.warn("대행 경기 결과 반영 실패:", e); }catch(_){} }
  try{ socialOnResult(M); }catch(e){}
  try{ restoreTactic(); }catch(e){}      // 경기 중 만진 전술 원복
  try{ pruneUserLineup(); }catch(e){}    // 다치거나 퇴장당한 선수 정리
  /* 직접 지휘하지 않은 만큼 얻는 게 적다 — 조직력이 덜 붙는다 */
  try{ addFam(t, -FAM_MATCH*0.35); }catch(e){}
  const w=(typeof mgrInjLeft==="function")?mgrInjLeft():0;
  addNews(_inj
    ? `🩺 ${t.short} ${mine}-${his} ${opp.short} — 부상 중인 감독 대신 ${acTitle()}가 지휘했습니다 (복귀까지 약 ${w}주)`
    : `🤝 ${t.short} ${mine}-${his} ${opp.short} — 감독이 맡긴 경기, ${acTitle()}가 지휘했습니다`,
          mine>his?"good":mine<his?"warn":null, "club");
  try{ staffLog(`${acTitle()}가 ${opp.short}전을 ${_inj?"대신":"감독을 대신해"} 지휘했습니다. (${mine}-${his})`); }catch(e){}
  lastMatch={type:"match", res:{hg:M.hg,ag:M.ag,events:M.events,sc:M.sc||[],st:M.st,pmap:M.pmap||null, momo:M.momo||null}, h:M.home, a:M.away, att:M.att||0, mom:M.mom||null};
  /* 🎩 ⚠ 위임 경기는 킥오프에 snapshotTactic() 을 찍어 두고(주석: 「코치가 성향을 손대면
     경기 뒤 되돌린다」) <b>정작 되돌리지 않고 있었다</b> — restoreTactic() 호출이 직접 관전
     경로에만 있었다. 그래서 수석코치가 경기 중에 만진 성향, 교체로 인계된 역할,
     경기 중 굳어진 자리 배치가 <b>영구히</b> 전술에 남았다.
     감독 눈에는 「가만히 뒀는데 롤·임무가 바뀌어 있다」로 보인다. 직접 지휘와 똑같이 되돌린다. */
  try{ restoreTactic(); }catch(e){}
  try{ pruneUserLineup(); }catch(e){}
  saveGame();
  const outcome=matchOutcome(M, isHome);
  const cls=outcome==="win"?"good":outcome==="loss"?"warn":"info";
  const scorers=(isHome?M.h:M.a).list.filter(x=>x.goals>0);
  const line=pick(_inj
    ? (outcome==="win"
      ? [`"감독님, 이겼습니다. 병실에서 편히 보셨길 바랍니다."`, `"선수들이 감독님 몫까지 뛰었습니다."`]
      : outcome==="draw"
      ? [`"승점 1을 지켰습니다. 감독님 오실 때까지 버티겠습니다."`, `"아쉽지만 무너지지는 않았습니다."`]
      : [`"죄송합니다. 제가 더 준비했어야 했습니다."`, `"선수들 탓이 아닙니다. 제 책임입니다."`])
    /* 🎮 감독이 맡긴 경기 — 병상 위문이 아니라 「업무 보고」의 결이다 (요청) */
    : (outcome==="win"
      ? [`"맡겨 주신 대로 처리했습니다. 이겼습니다."`, `"준비한 판이 그대로 먹혔습니다."`, `"큰 이변 없이 가져왔습니다."`]
      : outcome==="draw"
      ? [`"승점 1은 챙겼습니다. 아쉬운 장면이 몇 번 있었습니다."`, `"무너지지는 않았습니다. 보고서로 정리해 두겠습니다."`]
      : [`"죄송합니다. 제 선택이 어긋났습니다."`, `"이 경기는 감독님이 직접 보셨어야 했을지도 모르겠습니다."`]));
  $("#main").innerHTML=`<h2>${_inj?"🩺 수석코치 대행":"🤝 "+acTitle()+" 위임"} — ${opp.short}전 보고</h2>
  <div class="card">
    <div class="msg ${cls}" style="border-width:2px;font-size:17px">
      <b>${t.short} ${mine} : ${his} ${opp.short}</b> <span class="small">(${isHome?"홈":"원정"})</span></div>
    <p style="margin:10px 0"><b>💬 수석코치:</b> ${line}</p>
    ${scorers.length?`<p class="small">⚽ 득점: ${scorers.map(x=>`${x.p.name}${x.goals>1?` ${x.goals}골`:""}`).join(", ")}</p>`:""}
    ${acBenchReport(M, _acLv)}
    ${_inj
      ? `<div class="msg info" style="margin-top:8px">🚑 감독은 아직 회복 중입니다 — <b>약 ${w}주</b> 남았습니다.
          <span class="small">그동안 경기는 ${acTitle()}가 지휘하며, 라커룸 토크와 기자회견에도 감독은 나서지 않습니다.</span></div>`
      : `<div class="msg info" style="margin-top:8px">🎮 <b>경기 운영</b>을 ${acName()}에게 맡겨 둔 상태입니다 — 결과만 보고받습니다.
          <span class="small">직접 지휘하려면 📋 스태프 회의 → 🎮 경기 운영에서 「직접 지휘한다」로 되돌리세요.</span></div>`}
    <button class="mini" style="display:block;width:100%;padding:11px;margin-top:8px"
      onclick="$('#advBtn').disabled=false;show('home');window.scrollTo(0,0)">확인 ▶</button>
  </div>`;
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  window.scrollTo(0,0);
}
/* 🎩 수석코치가 벤치에서 실제로 무엇을 했는가 — 능력치가 결과에 닿는 지점을 눈에 보이게 (요청) */
function acBenchReport(M, lv){
  try{
    const c=acOf();
    if(!c) return `<div class="msg warn" style="margin-top:8px">🎩 <b>수석코치가 공석입니다</b> —
      벤치를 맡을 사람이 없어 <b>교체를 한 명도 하지 못했습니다</b>.
      <span class="small">💸 이적시장 → 🎩 스태프에서 수석코치를 먼저 데려오세요.</span></div>`;
    const sd=M.h.team.isUser?M.h:M.a;
    const subs=(sd.subs|0);
    const [gn,gc]=acGrade(acOvr(c));
    const L=Math.round(lv*10)/10;
    const tw=M._acTweak;
    const lines=[];
    lines.push(`🔁 교체 <b>${subs}회</b>${subs===0?` <span style="opacity:.7">— 이 코치의 판단으로는 손댈 자리가 없었습니다</span>`:""}`);
    if(tw) lines.push(`🎚️ ${tw.minTxt!=null?tw.minTxt:tw.min}분 성향을 <b>한 칸 ${tw.up?"올렸습니다":"내렸습니다"}</b> <span style="opacity:.7">(유연성 ${c.flex|0})</span>`);
    return `<div class="msg info" style="margin-top:8px">
      🎩 <b>${c.n}</b> <span style="color:${gc}">${gn}</span>
      <span class="small">— 경기판단 ${c.judg|0} · 선수관리 ${c.man|0} · 전술 ${c.tac|0} · 유연성 ${c.flex|0} → 벤치 판단력 <b>${L}</b>/20</span><br>
      <span class="small">${lines.join(" · ")}</span><br>
      <span class="small" style="opacity:.7">첫 교체 가능 시점 ${acFirstWin(lv)}분 · 최선의 선택을 고를 확률 ${Math.round(acRightP(lv)*100)}%</span></div>`;
  }catch(e){ return ""; }
}
/* 위임한 연습경기 — 결과만 보고받는다 */
function runDelegatedFriendly(M){
  M.acRun=true;                                 // 🎩 연습경기도 수석코치가 벤치를 굴린다 (요청)
  try{ snapshotTactic(); }catch(e){}
  const _acLv=acBenchLv();
  /* ⚡ 연습경기도 한 번에 돌리면 화면이 그동안 멈춘다 — 리그 경기와 같은 조각 실행기를 쓴다 */
  delegChunkRun(M, "연습경기", "del", (M2)=>delegFriendlyFinish(M2, _acLv));
}
function delegFriendlyFinish(M, _acLv){
  try{ delegBoxClose(); }catch(e){}
  const f=G.pendingFriendly; G.pendingFriendly=null;
  if(f){ f.done=true; f.hg=M.hg; f.ag=M.ag; preFriendlyPlayed(); }
  applyMatchResult(M);
  try{ restoreTactic(); }catch(e){}    // 🎩 위임 연습경기도 경기 중 조정을 되돌린다 (위 delegFinish 주석)
  socialOnResult(M);
  const t=userTeam();
  const isHome=M.home.isUser;
  const mine=isHome?M.hg:M.ag, his=isHome?M.ag:M.hg;
  const opp=isHome?M.away:M.home;
  // 직접 지휘하지 않은 만큼 얻는 것이 적다 — 조직력이 덜 붙고 라커룸 효과도 없다
  addFam(t, -FAM_MATCH*0.45);
  try{ restoreTactic(); }catch(e){}      // 🎩 코치가 만진 성향 원복 (요청)
  addNews(`🤝 연습경기(위임): ${t.short} ${mine}-${his} ${opp.short}`);
  staffLog(`수석코치가 ${opp.short}전 연습경기를 지휘했습니다. (${mine}-${his})`);
  checkPreseasonEnd();
  lastMatch={type:"match", res:{hg:M.hg,ag:M.ag,events:M.events,sc:M.sc||[],st:M.st,pmap:M.pmap||null, momo:M.momo||null}, h:M.home, a:M.away, friendly:true, att:M.att||0};
  saveGame();
  const outcome = mine>his?"win":mine===his?"draw":"loss";
  const cls = outcome==="win"?"good":outcome==="loss"?"warn":"info";
  const scorers=(isHome?M.h:M.a).list.filter(x=>x.goals>0);
  const best=[...(isHome?M.h:M.a).list].sort((a,b)=>(b.rating||0)-(a.rating||0))[0];
  const line=pick(outcome==="win"
    ? [`"의도한 대로 흘러갔습니다. 준비한 패턴이 몇 번 나왔어요."`,`"이겼다는 것보다 다친 선수가 없다는 게 다행입니다."`,`"신입 선수들이 잘 녹아들고 있습니다."`]
    : outcome==="draw"
    ? [`"결과는 무승부지만 체력은 확실히 올라왔습니다."`,`"아직 손발이 덜 맞습니다. 시간이 필요합니다."`,`"여러 조합을 시험해 봤습니다. 참고하실 만한 게 있을 겁니다."`]
    : [`"졌습니다. 다만 후반에 실험한 조합이 문제였습니다."`,`"결과는 신경 쓰지 마십시오. 몸 만드는 단계입니다."`,`"수비 조직에서 문제가 보였습니다. 보고서로 정리해 두겠습니다."`]);
  VIEW="match";
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  $("#main").innerHTML=`<h2>🤝 연습경기 결과 보고</h2>
  <div class="card stCard">
    <div class="msg ${cls}" style="font-size:16px;font-weight:800">
      ${M.home.short} ${M.hg} : ${M.ag} ${M.away.short} <span class="small">(연습경기 · 순위표 미반영)</span></div>
    <div class="stSay">📋 수석코치: ${line}</div>
    <p class="small" style="margin-top:8px">
      득점: ${scorers.length?scorers.map(x=>`${x.p.name}${x.goals>1?" "+x.goals:""}`).join(", "):"없음"}<br>
      최고 평점: ${best?`<b>${best.p.name}</b> ${(best.rating||0).toFixed(2)}`:"-"}<br>
      팀 사기 ${mor(t.morale)} · 전술 적응도 ${Math.round(famOf(t))}</p>
    ${acBenchReport(M, _acLv)}
    <p class="small">직접 지휘하지 않아 조직력 상승분과 라커룸 효과는 얻지 못했습니다.</p>
  </div>
  <div class="card"><button class="mini" style="width:100%;padding:11px" onclick="show('home')">확인 ▶</button></div>`;
  $("#advBtn").disabled=false;
  window.scrollTo(0,0);
}
function startProgress(){
  /* ⚔️ 제보 — 온라인 대전 진행 중에는 날짜를 진행할 수 없다 */
  try{ if(typeof pvpBusy==="function" && pvpBusy()){ flash("⚔️ 온라인 대전 진행 중에는 진행할 수 없습니다.","warn"); return; } }catch(e){}
  /* 기자회견이 끝나 있으면 — 진행 버튼이 그 회견을 마무리한다 (progBusy가 IV를 포함하므로 먼저 본다)
     · 부임 회견 → 선수단 만나러 가기   · 경기 전 회견 → ⚽ 킥오프   · 그 밖 → 오피스로 */
  if(typeof IV!=="undefined" && IV && IV.idx>=IV.qs.length){
    endInterview();
    try{ applyNavLock(); }catch(e){}
    return;
  }
  /* 라커룸 반응 화면 — 진행 = 계속 */
  if(typeof lockerReactReady!=="undefined" && lockerReactReady){ continueLockerReact(); return; }
  /* 상대 라커룸 반응 화면 — 진행 = 계속 */
  if(typeof awayReactReady!=="undefined" && awayReactReady){
    awayDone();
    try{ applyNavLock(); }catch(e){}
    return;
  }
  /* 시즌 목표 발표 후 — 진행 = 라커룸을 나선다 */
  if(typeof greetReady!=="undefined" && greetReady){
    greetDone();
    try{ applyNavLock(); }catch(e){}
    return;
  }
  /* ⚠ 제보 — 준비 화면을 떠나 다른 탭에 있는 동안 누른 진행 버튼은 「확정」이 아니라
     「준비 화면으로 복귀」다. 명단을 안 보여 주고 넘어가는 일이 없게 한다. */
  if(typeof preTacAway!=="undefined" && preTacAway
     && ((typeof inPreTactics!=="undefined" && inPreTactics) || (typeof inLineupPreview!=="undefined" && inLineupPreview))){
    preTacAway=false; enterMatchTab(); return;
  }
  /* 선발 전술 화면 — 진행 = 선발 확정 (사용자 요청) */
  if(typeof inPreTactics!=="undefined" && inPreTactics){ confirmPreMatchTactics(); return; }
  /* 라인업 프리뷰 — 진행 = 라커룸/기자회견으로 */
  if(typeof inLineupPreview!=="undefined" && inLineupPreview){ proceedToPreInterview(); return; }
  if(progBusy()){
    /* ⚠ 제보 — 「진행이 안 됨」. 조용히 무시하면 게임이 멈춘 것처럼 보인다.
       무엇이 잡고 있는지, 어디서 마무리하면 되는지 알려 준다 — 그 흐름들은 경기 탭에 보존된다. */
    try{
      const why = liveM ? "경기가 진행 중입니다 — 경기 탭에서 마무리해 주세요"
        : (typeof IV!=="undefined" && IV) ? "기자회견이 진행 중입니다 — 경기 탭에서 마저 답해 주세요"
        : ((typeof inLockerTalk!=="undefined"&&inLockerTalk)||(typeof inGreeting!=="undefined"&&inGreeting)) ? "라커룸 대화가 진행 중입니다 — 경기 탭에서 마무리해 주세요"
        : "진행 중인 화면을 먼저 마무리해 주세요 — 경기 탭을 확인해 보세요";
      flash("⏳ "+why,"warn");
    }catch(e){}
    return;
  }
  if(G.phase==="sacked"){ showSackScreen(); return; }
  /* 주장단이 비어 있으면 진행 화면을 열지 않고 바로 스태프 회의로 데려간다.
     여기서 막지 않으면 진행 → 경고 → 다시 메뉴 찾기까지 클릭이 세 번이 된다. */
  if(goalNeeded()){
    flash("🎯 새 시즌 목표부터 밝히시죠. 아래에서 올 시즌 목표를 골라 주십시오.","warn");
    show("staff"); window.scrollTo(0,0);
    return;
  }
  if(capNeeded()){
    flash("🎖️ 새 시즌 주장단부터 정하시죠. 아래에서 주장·부주장을 지정해 주십시오.","warn");
    show("staff"); window.scrollTo(0,0);
    return;
  }
  /* ⚠ 제보 — 「시즌이 끝나고 승강PO 진행을 눌러도 일정이 진행되지 않는다」.
     승강 PO 가 다 끝났는데 대회(EACL) 4강·결승이 남아 있으면, advance() 는 시즌을 닫지 않고
     {type:"round"} 만 돌려준다(그게 맞다 — 대회를 남겨 두고 시즌을 닫으면 안 되니까).
     그런데 여기서 「PO 단계는 달력 밖」이라며 곧바로 advance() 로 보내 버려서,
     버튼을 눌러도 날짜가 하루도 흐르지 않고 같은 화면만 다시 그려졌다.
     ─ 그때는 달력을 돌려야 한다. 진행 상자를 열어 대회 경기일까지 날짜를 흘려보낸다. */
  let _aclWait=false;
  try{
    _aclWait = G.phase==="po" && !((G.poQueue||[]).length) && !!G.cal && eaclUserLeft();
  }catch(e){ _aclWait=false; }
  // 승강 PO·시즌 종료는 달력 밖의 일정이므로 종전처럼 곧바로 진행한다
  if(((G.phase!=="league" && G.phase!=="pre") || !G.cal) && !_aclWait){ runAdvanceNow(); return; }
  /* 줄 서 있던 멈춤부터 — 경기일이어도 같은 날 겹쳐 미뤄진 회견·판결 확인이 먼저다 */
  if(G.stopQ && G.stopQ.length){
    openProgressBox();
    PROG.left=null;
    prgHeader(); try{ prgDaysBar(); }catch(e){}
    if(drainStopQ()) return;
  }
  if(atMatchDay()){ runAdvanceNow(); return; }
  openProgressBox();
  /* 📅 마지막에 고른 「며칠씩 보내기」를 그대로 쓴다 — 0 이면 종전처럼 멈출 일이 생길 때까지 달린다 */
  const _ad=(G.opt&&G.opt.advDays)|0;
  PROG.left = _ad>0 ? _ad : null;
  prgHeader(); prgDaysBar();
  prgPush(`<span class="prgD">${dateLabel(G.day)}</span> ${_ad>0?`<b>${_ad}일</b>만 보냅니다…`:"일정을 진행합니다…"}`, "prgDay");
  PROG.timer=setInterval(stepDay, PROG_MS);
}
$("#advBtn").onclick=startProgress;
/* ═══ 📱 하단 고정 진행 버튼 자리 잡기 ═══════════════════════════════════
   ⚠ 제보 — 「모바일에서 아래로 스크롤하면 경기 시작 버튼이 화면 중앙에 떠 있고,
      다시 올리면 아래로 내려간다」.
   모바일 브라우저는 주소창이 접혔다 펴지는 동안 「레이아웃 뷰포트」와
   「실제로 보이는 화면(visual viewport)」의 높이가 어긋난다. position:fixed 는 앞의 것을
   기준으로 놓이므로, 주소창이 펼쳐진 순간에는 버튼이 화면 한복판에 떠 있는 것처럼 보인다.
   ─ visualViewport 를 직접 읽어 그 차이만큼 끌어내린다. 지원하지 않는 환경에서는 아무 일도 없다. */
(function(){
  const vv = (typeof window!=="undefined") ? window.visualViewport : null;
  if(!vv) return;
  let raf=0;
  const fit=()=>{
    raf=0;
    const el=document.getElementById("advBtn");
    if(!el) return;
    let fixed=false;
    try{ fixed=getComputedStyle(el).position==="fixed"; }catch(e){}
    if(!fixed){ el.style.transform=""; return; }          // 가로 모드 등 — 사이드바 안에 있을 때
    const gap = window.innerHeight - (vv.height + vv.offsetTop);
    el.style.transform = gap>1 ? `translateY(${-Math.round(gap)}px)` : "";
  };
  const q=()=>{ if(!raf) raf=requestAnimationFrame(fit); };
  try{
    vv.addEventListener("resize", q);
    vv.addEventListener("scroll", q);
    window.addEventListener("scroll", q, {passive:true});
    window.addEventListener("orientationchange", ()=>setTimeout(q, 150));
  }catch(e){}
  q();
  setTimeout(q, 300);
})();


/* ═══════════════════════════════════════════════════════════════
   모바일 · 터치 지원
   PC의 조작 두 가지가 휴대폰에는 아예 없다 — 우클릭과 hover.
     · 우클릭(선수 상세 팝업)  → 길게 누르기(롱프레스)로 대체
     · hover(달력의 휴/훈련 버튼) → 셀을 탭하면 선택 모달
   드래그&드롭도 터치에선 동작하지 않지만, 선수 교체는 이미 "클릭 → 클릭" 경로가
   함께 구현돼 있어 별도 처리가 필요 없다.
═══════════════════════════════════════════════════════════════ */
const IS_TOUCH = (typeof window!=="undefined") &&
  (("ontouchstart" in window) || (navigator.maxTouchPoints||0)>0);
const LONGPRESS_MS=480, LONGPRESS_SLOP=12;
(function bindLongPress(){
  if(typeof document==="undefined"||!document.addEventListener) return;
  let timer=null, sx=0, sy=0, fired=false, target=null;
  const clear=()=>{ if(timer){ clearTimeout(timer); timer=null; } target=null; };
  document.addEventListener("touchstart",(e)=>{
    if(!e.touches||e.touches.length!==1) return clear();
    // oncontextmenu 가 걸린 가장 가까운 조상을 찾는다 (선수 칩·표의 이름 칸 등)
    let el=e.target;
    while(el && el!==document.body && !(el.getAttribute && el.getAttribute("oncontextmenu"))) el=el.parentElement;
    if(!el || el===document.body) return;
    target=el; fired=false;
    sx=e.touches[0].clientX; sy=e.touches[0].clientY;
    timer=setTimeout(()=>{
      fired=true; timer=null;
      if(navigator.vibrate) try{ navigator.vibrate(15); }catch(_){}
      // 안드로이드는 롱프레스 뒤에 contextmenu 도 함께 쏜다. 전역 핸들러가 방금 연 팝업을
      // 곧바로 닫아버리므로, 잠깐 동안은 그 이벤트를 무시하도록 표시를 남긴다.
      window.__lpAt=Date.now();
      // 실제 우클릭 핸들러를 그대로 호출한다 — 좌표는 손가락이 있던 자리
      const fn=target.getAttribute("oncontextmenu");
      if(fn){
        const ev={clientX:sx, clientY:sy, preventDefault(){}, stopPropagation(){}};
        try{ (new Function("event", fn)).call(target, ev); }catch(err){ console&&console.warn&&console.warn(err); }
      }
    }, LONGPRESS_MS);
  }, {passive:true});
  document.addEventListener("touchmove",(e)=>{
    if(!timer||!e.touches||!e.touches[0]) return;
    if(Math.abs(e.touches[0].clientX-sx)>LONGPRESS_SLOP || Math.abs(e.touches[0].clientY-sy)>LONGPRESS_SLOP) clear();
  }, {passive:true});
  document.addEventListener("touchend",(e)=>{
    // 롱프레스가 발동했으면 뒤따르는 click(=좌클릭 메뉴)은 무시한다
    if(fired && e.cancelable) e.preventDefault();
    fired=false; clear();
  }, {passive:false});
  document.addEventListener("touchcancel", clear, {passive:true});
})();
/* 달력 셀 탭 → 휴식/훈련 선택 (hover 버튼이 없는 기기용) */
function pickDayPlan(i){
  if(isMatchDay(i)) return;
  if(i < (G.day||0)) return;                       // 지나간 날은 못 바꾼다
  const cur=dayPlan(i);
  const curLab = cur.t==="rest" ? "휴식" : `훈련 · ${TRAIN_INT[cur.i||0].n}`;
  const opts=[["휴식 (체력 회복)","rest",0],["훈련 · 가볍게","train",0],
              ["훈련 · 보통","train",1],["훈련 · 강하게","train",2]];
  const labels=opts.map(o=>o[0]);
  const overridden=!!(G.train.days&&G.train.days[i]);
  if(overridden) labels.push("↺ 주간 루틴으로 되돌리기");
  showChoice(`<b>${dateLabel(i)}</b> — 현재 <b>${curLab}</b>${cur.auto?` <span class="small">(${cur.auto})</span>`:""}`,
    labels,
    (k)=>{ if(k>=opts.length) clearDayPlan(i); else setDayPlan(i, opts[k][1], opts[k][2]); });
}

