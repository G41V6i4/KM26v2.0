"use strict";
/* ── 경기 중 전술 변경은 그 경기 한정 ────────────────────────
   FM처럼 킥오프 직전 상태를 찍어 두고, 종료 휘슬과 함께 원래대로 되돌린다.
   90분 동안 급하게 만진 총공세 세팅이 다음 주 훈련까지 그대로 남으면 곤란하다.
   조직력(fam)도 함께 되돌린다 — 되돌릴 전술이라면 깎을 이유도 없다. */
let preMatchTactic=null;
function snapshotTactic(){
  const t=userTeam(); if(!t) return;
  preMatchTactic={
    tactic: JSON.parse(JSON.stringify(t.tactic||{})),
    xi: G.userXI ? G.userXI.slice() : null,
    /* 🧩 조직력뿐 아니라 「이탈 장부」까지 찍어 둔다 — 이게 없으면 경기 중 조정분이
       다음 경기의 기준선으로 새어 나가 조직력이 조금씩 영구히 깎였다 (제보) */
    fam: famOf(t), sig: t._sig, sigBase: t._sigBase, devPen: t._devPen
  };
}
function restoreTactic(){
  if(!preMatchTactic) return;
  const t=userTeam(); if(!t){ preMatchTactic=null; return; }
  const before=tacticSig(t);
  t.tactic=JSON.parse(JSON.stringify(preMatchTactic.tactic));
  G.userXI = preMatchTactic.xi ? preMatchTactic.xi.slice() : null;
  t.fam=preMatchTactic.fam; t._sig=preMatchTactic.sig;
  if(preMatchTactic.sigBase!==undefined) t._sigBase=preMatchTactic.sigBase;
  if(preMatchTactic.devPen!==undefined)  t._devPen =preMatchTactic.devPen;
  const changed = before!==tacticSig(t);
  preMatchTactic=null;
  if(changed) try{ flash("📋 경기 중 조정했던 전술을 경기 전 설정으로 되돌렸습니다.","info"); }catch(e){}   /* 뉴스 탭 제외 (제보 — 전술 전환류는 뉴스에 남기지 않는다) */
  return changed;
}
/* ── 전술 저장 바 ─────────────────────────────────────────────
   전술은 손대는 즉시 팀에 반영된다(경기 엔진이 곧바로 그 값을 읽는다). 다만 감독 입장에서는
   "내가 뭘 건드렸고, 확정한 건지"가 보여야 한다. 그래서 탭에 들어온 시점의 상태를 기준선으로
   잡아 두고, 달라지면 저장 버튼을 켜서 확정(=세이브)하거나 되돌릴 수 있게 한다. */
let tacBase=null;
function tacSnapshot(t){
  return JSON.stringify({tac:t.tactic, xi:G.userXI||null, role:t.tactic.role||null});
}
function tacBaseline(){
  const t=userTeam(); if(!t) return;
  tacBase=tacSnapshot(t);
}
function tacDirty(){
  const t=userTeam(); if(!t||!tacBase) return false;   // 기준선이 아직 없으면(첫 렌더 중) 깨끗한 것으로 본다
  return tacBase!==tacSnapshot(t);
}
function tacSaveBar(t){
  const dirty=tacDirty();
  return `<div class="tacSave ${dirty?"on":""}">
    <span class="tacSaveMsg">${dirty?"⚠️ 수정한 전술이 아직 저장되지 않았습니다":"✅ 저장됨"}</span>
    <button class="mini tacSaveBtn" ${dirty?"":"disabled"} onclick="saveTactics()">💾 저장</button>
    <button class="mini" ${dirty?"":"disabled"} onclick="revertTactics()">↺ 되돌리기</button>
  </div>`;
}
function saveTactics(){
  if(!tacDirty()) return;
  /* ⚠ 제보 — 「전술 2·3번에 전술을 넣고 저장 버튼을 누른 뒤 다른 화면에 나가면 저장이 안 돼 있다」.
     원인 — 저장 버튼이 세이브만 하고 「지금 쓰는 전술 슬롯(presets[cur])」은 건드리지 않았다.
     활성 전술은 t.tactic 자체라 화면에는 멀쩡히 보이지만, 슬롯 안에는 수정 전 스냅샷이 남는다.
     그 슬롯을 다시 불러오는 순간(전술 전환·경기 전 되돌리기·새 시즌) 옛 전술이 되살아났다.
     ─ 「저장」은 지금 판을 그 슬롯에 확정하는 일이다. 슬롯을 함께 갱신한다. */
  const t=userTeam();
  try{ if(t) storeCurPreset(t); }catch(e){}
  saveGame(); tacBaseline();
  flash(`💾 전술 ${((t&&t.tactic&&t.tactic.presetCur)||0)+1}번에 저장했습니다.`,"good");
  refreshTactics();
}
function revertTactics(){
  if(!tacBase) return;
  const t=userTeam(); const b=JSON.parse(tacBase);
  t.tactic=JSON.parse(JSON.stringify(b.tac));
  G.userXI = b.xi ? b.xi.slice() : null;
  t._sig=tacticSig(t);
  selSwap=null;
  flash("↺ 마지막 저장 상태로 되돌렸습니다.","info");
  try{ storeCurPreset(t); }catch(e){}   // 슬롯도 같은 상태로 맞춘다 — 둘이 어긋나면 또 되살아난다
  saveGame(); tacBaseline(); refreshTactics();
}
let lockerReactCont=null;
function showLockerReactions(title, toneScore, cont, moraleBefore, moraleAfter, M, reactionsData, stage){
  lockerReactCont=cont;
  inLockerTalk=true;
  // reactionsData가 이미 있으면(=="경기" 탭으로 나갔다가 돌아온 재진입) 그대로 재사용한다 — 새로 계산하면
  // 선수별 사기 변화가 매번 다시 적용되어 중복으로 오르내리는 문제가 생긴다.
  const data = reactionsData || computeSquadReactions(M, toneScore, stage);
  lockerScreenState={kind:'reactions', title, toneScore, moraleBefore, moraleAfter, M, reactionsData:data, stage};
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  $("#advBtn").disabled=true;
  const hasDelta = moraleBefore!==undefined && moraleAfter!==undefined;
  /* ⚠ 사기는 소수점으로 굴러가서 그대로 빼면 +1.1000000000000014 같은 값이 찍힌다(제보).
     화면에는 소수 첫째 자리까지만, 정수면 정수로 보여 준다. */
  const delta = hasDelta ? moraleAfter-moraleBefore : 0;
  const deltaTxt = hasDelta ? `<div class="msg ${delta>0?'good':delta<0?'warn':'info'}" style="margin-bottom:10px">
    📊 팀 전체 사기 <b>${mor1(moraleBefore)}</b> → <b>${mor1(moraleAfter)}</b> (<b>${delta>0?'+':''}${mor1(delta)}</b>)</div>` : "";
  /* 계속은 좌측 메뉴 하단 진행 버튼이 맡는다 (사용자 요청) */
  { const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.classList.remove("navLocked"); _a.textContent="계속 ▶"; } }
  lockerReactReady=true;
  $("#main").innerHTML=`<div class="reactTop">
    <h2 style="margin:0">🚪 라커룸 — ${title}</h2>
    <span class="msg info" style="margin:0;padding:8px 12px">👈 왼쪽 <b>계속</b> 버튼으로 진행</span>
  </div>
  ${deltaTxt}
  <div class="card">
    <h3>선수단 반응</h3>
    ${renderReactionsHtml(data)}
  </div>`;
}
let lockerReactReady=false;
function continueLockerReact(){
  lockerReactReady=false;
  { const _a=$("#advBtn"); if(_a) _a.textContent="진행 ▶"; }
  const fn=lockerReactCont; lockerReactCont=null;
  if(fn) fn();
}
function showPreMatchTalk(M, tag){
  pendingLiveM=M; pendingLiveTag=tag;
  lockerTalkUI("라커룸 — 킥오프 전",
    `<div class="card"><p>선수들이 라커룸에 모여 마지막 지시를 기다리고 있습니다. 킥오프 전, 선수단에게 한마디 남기세요.</p></div>`,
    LOCKER_PRE, "preTalkSay");
}
function preTalkSay(i){
  const M=pendingLiveM, tag=pendingLiveTag;
  const o=resolveLockerOpt(LOCKER_PRE[i]||LOCKER_PRE[0]);
  const moraleBefore=userTeam().morale;
  applyLockerEffect(o);
  const moraleAfter=userTeam().morale;
  showLockerReactions("킥오프 전", o[0], ()=>{
    inLockerTalk=false; pendingLiveM=null; pendingLiveTag=null;
    if(!M) return;
    startLive(M, tag);
  }, moraleBefore, moraleAfter, M, undefined, 'pre');
}
/* 하프타임 시점의 스코어를 기준으로 어떤 멘트 풀을 보여줄지 결정 */
function htOutcomeOpts(M){
  const t=userTeam(); const isHome=M.home.id===t.id;
  const myG=isHome?M.hg:M.ag, oppG=isHome?M.ag:M.hg;
  const outcome=myG>oppG?"win":myG===oppG?"draw":"loss";
  return {outcome, opts: outcome==="win"?LOCKER_HT_WIN:outcome==="draw"?LOCKER_HT_DRAW:LOCKER_HT_LOSS};
}
function showHalftimeTalk(M){
  if(!M || M._htTalked) return;   // 경로가 여럿이라(하이라이트 지연 포함) 중복 호출을 여기서 막는다
  M._htTalked=true;
  const {outcome, opts}=htOutcomeOpts(M);
  const cls=outcome==="win"?"good":outcome==="loss"?"warn":"info";
  const resTxt=`⏱️ 전반전 종료 — ${M.home.short} ${M.hg} : ${M.ag} ${M.away.short}`;
  lockerTalkUI("라커룸 — 하프타임",
    `<div class="msg ${cls}">${resTxt}</div><div class="card"><p>전반전을 마친 선수단이 라커룸에 모였습니다. 후반전을 앞두고 한마디 남기세요.</p></div>`,
    opts, "htTalkSay");
}
function htTalkSay(i){
  const M=liveM;
  if(!M){ inLockerTalk=false; return; }
  const {opts}=htOutcomeOpts(M);
  const o=resolveLockerOpt(opts[i]||opts[0]);
  const moraleBefore=userTeam().morale;
  applyLockerEffect(o);
  const moraleAfter=userTeam().morale;
  showLockerReactions("하프타임", o[0], ()=>{
    inLockerTalk=false;
    // 라커룸에서 나와 다시 피치로 — 일시정지 상태 그대로, 후반전 시작 버튼과 전술 옵션을 보여준다
    $("#main").innerHTML=liveLayout(M, liveTag);
    redrawLiveLog();
    syncLive(); // liveLayout이 새로 그려지며 스코어/시간/통계가 "0"으로 초기화된 템플릿 값으로 굳어 있던 버그 수정 — 실제 값으로 즉시 갱신한다
    updLiveCtrl("ht");
  }, moraleBefore, moraleAfter, M, undefined, 'ht');
}
/* 🥅 승부차기까지 간 경기의 결과 — 90분 스코어가 무승부여도 승패는 갈렸다.
   ⚠ 제보 — 「승부차기로 이겼는데 경기가 끝나면 '이길 수 있었는데 아쉽다'로 평가된다」.
     순위표 기록(승/무/패)은 규정대로 무승부지만, 라커룸·기자회견·팬 반응은 실제 결과를 따라야 한다. */
function matchOutcome(M, isHome){
  if(!M) return "draw";
  const my=isHome?M.hg:M.ag, op=isHome?M.ag:M.hg;
  if(my!==op) return my>op?"win":"loss";
  if(M.pk && M.pk.win) return ((M.pk.win==="h")===!!isHome) ? "win" : "loss";
  return "draw";
}
/* 스코어 표기에 승부차기 결과를 덧붙인다 */
function pkScoreTag(M){
  try{ if(!M || !M.pk || !M.pk.win) return "";
    return ` <span class="small">· 승부차기 ${M.pk.h}-${M.pk.a}</span>`; }catch(e){ return ""; }
}
function showPostMatchTalk(M){
  pendingPostM=M;
  const t=userTeam(); const isHome=M.home.id===t.id;
  const myG=isHome?M.hg:M.ag, oppG=isHome?M.ag:M.hg;
  const outcome=matchOutcome(M, isHome);
  const opts=outcome==="win"?LOCKER_POST_WIN:outcome==="draw"?LOCKER_POST_DRAW:LOCKER_POST_LOSS;
  const cls=outcome==="win"?"good":outcome==="loss"?"warn":"info";
  const _sc=`${M.home.short} ${M.hg} - ${M.ag} ${M.away.short}${pkScoreTag(M)}`;
  const resTxt=outcome==="win"?`🎉 승리! (${_sc})`
    :outcome==="draw"?`무승부 (${_sc})`
    :`😞 패배... (${_sc})`;
  lockerTalkUI("라커룸 — 경기 종료 후",
    `<div class="msg ${cls}">${resTxt}</div><div class="card"><p>경기를 마친 선수단이 라커룸에 모였습니다. 결과에 대해 한마디 남기세요.</p></div>`,
    opts, "postTalkSay");
}
function postTalkSay(i){
  const M=pendingPostM;
  if(!M){ inLockerTalk=false; return; }
  const t=userTeam(); const isHome=M.home.id===t.id;
  const outcome=matchOutcome(M, isHome);
  const opts=outcome==="win"?LOCKER_POST_WIN:outcome==="draw"?LOCKER_POST_DRAW:LOCKER_POST_LOSS;
  const o=resolveLockerOpt(opts[i]||opts[0]);
  const moraleBefore=userTeam().morale;
  applyLockerEffect(o);
  const moraleAfter=userTeam().morale;
  showLockerReactions("경기 종료 후", o[0], ()=>{
    inLockerTalk=false; pendingPostM=null;
    /* 우리 라커룸을 정리했으면, 복도 건너편에 갈 것인지 물어본다.
       ⚠ 여기서 예외가 나면 진행 버튼과 경기 탭이 통째로 잠긴다 — 무슨 일이 있어도 빠져나간다. */
    try{ offerAwayLocker(M, ()=>{ try{ afterPostTalk(M); }catch(e){ postTalkBail(e); } }); }
    catch(e){ postTalkBail(e); }
  }, moraleBefore, moraleAfter, M, undefined, 'post');
}
var _brawlJustNow=false;   // 이번 경기 직후 난투가 벌어졌는가 (기자회견 건너뛰기용)
/* 경기 후 라커룸(+원정 라커룸)이 모두 끝난 뒤의 마무리 */
/* 🛟 경기 후 흐름이 넘어졌을 때 — 잠긴 상태를 풀고 오피스로 돌려보낸다 */
function postTalkBail(e){
  try{ console.warn("경기 후 진행 실패:", e); }catch(_){}
  inLockerTalk=false; awayLockerCtx=null; pendingPostM=null;
  try{ IV=null; }catch(_){}
  try{ const a=$("#advBtn"); if(a){ a.disabled=false; a.classList.remove("navLocked"); a.textContent="진행 ▶"; } }catch(_){}
  try{ flash("경기 후 진행 중 문제가 있어 오피스로 돌아왔습니다. 진행은 정상적으로 이어집니다.","warn"); }catch(_){}
  try{ saveGame(); }catch(_){}
  try{ show("home"); window.scrollTo(0,0); }catch(_){}
}
function afterPostTalk(M){
  if(M && M.opts && M.opts.friendly){   // 연습경기 — 기자회견 없이 마무리
    $("#advBtn").disabled=false; show("home"); window.scrollTo(0,0); return;
  }
  /* 🚑 난투극으로 병원에 실려 갔다면 회견장에 설 수 없다 — 수석코치가 대신 선다.
     (라커룸 토크 → 원정 라커룸 → 기자회견 순서라, 방금 다친 경우가 바로 여기서 걸린다) */
  if(_brawlJustNow || (typeof mgrInjured==="function" && mgrInjured())){
    const w=(typeof mgrInjLeft==="function")?mgrInjLeft():0;
    _brawlJustNow=false;
    try{ addNews(`🎩 경기 후 기자회견에 ${acTitle()}가 대신 참석했습니다 — 감독은 병원으로 이송됐습니다.`,"warn","club"); }catch(e){}
    showConfirm(`🚑 <b>기자회견에 설 수 없습니다.</b>\n\n감독은 그대로 병원으로 이송됐습니다.\n${acTitle()}가 대신 회견장에 섰습니다.\n\n<span class="small">회복까지 남은 기간: <b>약 ${w}주</b> — 그동안 ${acName()}가 팀을 지휘합니다.</span>`,
      ()=>{ $("#advBtn").disabled=false; show("home"); window.scrollTo(0,0); },
      {okLabel:"확인", cancelLabel:""});
    return;
  }
  startInterview("post", M, ()=>{ $("#advBtn").disabled=false; show("home"); window.scrollTo(0,0); });
}

/* ═══════════════════════════════════════════════════════════════
   상대팀 라커룸 방문
   경기가 끝나고 복도 건너편 문을 두드릴 것인가. 존중을 표하면 상대 선수들이
   감독을 기억하고(나중에 영입할 때 호감도로 돌아온다), 깽판을 치면 리그 전체가
   그 장면을 안주 삼아 씹는다. FM에는 없는, 감독이 직접 선을 넘을 수 있는 자리.
     · om  상대 팀 사기      · oa  상대 선수들의 우리 감독 호감도
     · my  우리 팀 사기      · mya 우리 선수들의 호감도(성격에 따라 다르게 받아들임)
     · fan 팬 신뢰 · own 구단주 신뢰 · rel 기자단 관계
     · tone 상대 선수 반응 계열 · soc SNS/커뮤니티 반응 풀
═══════════════════════════════════════════════════════════════ */
let awayLockerCtx=null;
/* ── 스카웃 제안 — 지금이 어느 이적시장이냐에 따라 말이 달라진다 ──────────────
   겨울은 시간이 넉넉해 "천천히 준비하겠다", 여름은 급해서 "지금 당장", 시장이 닫혀 있으면
   "다음 창까지 기다리겠다"가 된다. 같은 대사를 사시사철 쓰면 몰입이 깨진다. */
const SCOUT_SAY={
 winter:[`💰 "겨울에 정식으로 제안 드리겠습니다. 저희는 이미 준비를 시작했습니다."`,
   `💰 "이번 겨울, 시간은 충분합니다. 천천히 생각해 보시죠."`,
   `💰 "겨울 이적시장 첫날에 연락드리겠습니다. 그때까지 마음 정해 두십시오."`,
   `💰 "프리시즌부터 저희와 함께 몸을 만드시면 어떻겠습니까?"`,
   `💰 "겨울에 모셔 가겠습니다. 농담 아닙니다."`],
 summer:[`💰 "여름 창이 닫히기 전에 답을 주십시오. 시간이 많지 않습니다."`,
   `💰 "이번 여름, 지금 당장 움직일 수 있습니다. 구단끼리는 저희가 정리하죠."`,
   `💰 "시즌 중이라 말씀드리기 조심스럽지만 — 여름에 모셔 가겠습니다."`,
   `💰 "남은 반 시즌, 저희 유니폼으로 뛰실 생각 없습니까?"`,
   `💰 "여름 마감일까지입니다. 마음이 있으시면 신호만 주십시오."`],
 closed:[`💰 "지금은 창이 닫혀 있습니다. 다음 이적시장에 정식으로 찾아뵙겠습니다."`,
   `💰 "오늘은 인사만 드립니다. 다음 창에서 다시 이야기하시죠."`,
   `💰 "당장은 아무것도 못 합니다. 다만 저희가 지켜보고 있다는 건 알아 두십시오."`,
   `💰 "시장이 열리면 제일 먼저 연락드릴 사람이 선수님입니다."`]
};
function scoutSayPool(){
  const w=(typeof windowInfo==="function") ? windowInfo() : {open:false};
  if(w.open && w.name==="겨울") return SCOUT_SAY.winter;
  if(w.open && w.name==="여름") return SCOUT_SAY.summer;
  return SCOUT_SAY.closed;
}
/* 선택지 버튼과 결과 화면이 같은 문장을 쓰도록 한 곳에서 만든다 */
function awayOptText(o, fixed){
  if(o && o.dyn==="scout") return fixed || F_(scoutSayPool(), timeVars());
  return F_(o.t, timeVars());
}
/* 물병이 날아간 라커룸 — 맞은 선수 말고 나머지가 보이는 반응 */
/* 시계를 풀고 셔츠를 열어젖힌 채 눈만 마주치는 순간 — 겁먹거나, 받아치거나 */
/* 🪑 "이게 팀이야? 이게 팀이야?" — 남의 라커룸에서 의자를 걷어차며 */
const CHAIR_RL={
 furious:["🤬 {p}, 걷어차인 의자를 다시 세우더니 그대로 감독 앞에 놓았습니다. \"앉아서 말씀하시죠.\"",
          "🤬 {p}: \"우리 팀이든 아니든, 여기는 우리 라커룸입니다. 나가세요.\"",
          "🤬 {p}, 자기 락커 문을 쾅 닫으며 소리쳤습니다. \"그래서 뭐 어쩌라고!\"",
          "🤬 {p}, 주장이 팔을 붙잡지 않았으면 무슨 일이 났을 표정입니다.",
          "🤬 {p}, 감독이 찬 의자를 집어 들었습니다. 코치 셋이 동시에 달려왔습니다."],
 annoyed:["😤 {p}, 굴러간 의자를 말없이 제자리에 갖다 놓았습니다.",
          "😤 {p}: \"…남의 집 가구는 왜 부수십니까.\"",
          "😤 {p}, 수건을 머리에 뒤집어쓰고 아무 반응도 하지 않습니다.",
          "😤 {p}, 이를 악물고 신발끈만 계속 고쳐 묶습니다."],
 mocking:["😂 {p}, 박수를 칩니다. \"연기 좋으시네요. 우리 감독님한테도 좀 알려 주세요.\"",
          "😂 {p}: \"이게 팀이냐고요? 오늘 이긴 팀한테 물어보시죠.\"",
          "😂 {p}, 휴대폰을 들어 굴러다니는 의자를 찍었습니다.",
          "😂 {p}, 옆 선수에게 소곤댑니다. \"저 의자 우리 거 아니지?\""],
 fired:  ["🔥 {p}, 의자를 세워 놓고 그 위에 조용히 앉았습니다. 눈은 계속 감독을 봤습니다.",
          "🔥 {p}, 아무 말 없이 다음 경기 일정표를 손끝으로 짚었습니다.",
          "🔥 {p}, 라커룸을 나가는 감독의 뒷모습을 끝까지 쳐다봤습니다."],
 indifferent:["🙄 {p}, 이어폰을 꽂으며 발치의 의자를 툭 밀어냈습니다.",
          "🙄 {p}, 하품을 하고는 스타킹을 마저 벗었습니다."],
 awkward:["😐 {p}, 놀라서 뒤로 물러섰습니다. 뭘 해야 할지 모르는 얼굴입니다.",
          "😐 {p}, 신인이라 그런지 선배들 눈치만 봅니다.",
          "😐 {p}, 넘어진 의자와 감독을 번갈아 봤습니다."]};
const STARE_RL={
 scared:["😰 {p}, 시선을 피하고 라커 문만 쳐다봅니다. 손에 든 물병이 미세하게 흔들립니다.",
         "😰 {p}, 대꾸를 못 하고 그대로 굳었습니다. 옆 선수가 어깨를 툭 칩니다.",
         "😰 {p}, \"…죄송합니다\"라고 작게 말하고는 고개를 숙였습니다.",
         "😰 {p}, 유니폼을 벗다 말고 그대로 멈췄습니다. 라커룸이 조용해졌습니다.",
         "😰 {p}, 감독의 손목을 힐끗 보더니 눈을 내리깔았습니다.",
         "😰 {p}, 뒤로 반걸음 물러섰습니다. 그 반걸음을 모두가 봤습니다."],
 furious:["🤬 {p}, 자기도 시계를 풀어 바닥에 던졌습니다. \"해보시죠. 여기서.\"",
          "🤬 {p}, 감독 앞으로 성큼 걸어 나옵니다. 주장이 허리를 붙잡았습니다.",
          "🤬 {p}: \"이게 프로 감독이 할 짓입니까? 카메라 없다고 이러시는 거죠?\"",
          "🤬 {p}, 셔츠 단추를 하나 더 풀며 마주 노려봤습니다. 스태프가 몸으로 막았습니다."],
 mocking:["😂 {p}, 픽 웃으며 휴대폰을 들었습니다. \"이거 찍어도 되죠?\"",
          "😂 {p}: \"시계 좋은 거 차셨네요. 그거 자랑하러 오신 겁니까?\"",
          "😂 {p}, 옆 선수에게 들리게 말합니다. \"어디서 많이 본 장면인데.\"",
          "😂 {p}, 박수를 세 번 치고는 샤워실로 들어갔습니다."],
 fired:  ["🔥 {p}, 눈을 피하지 않았습니다. 30초쯤 서로 아무 말도 없었습니다.",
          "🔥 {p}, 조용히 감독의 이름을 한 번 불렀습니다. 그게 전부였습니다.",
          "🔥 {p}, 다음 경기 일정표를 손끝으로 짚고 자리에 앉았습니다."],
 annoyed:["😤 {p}, 혀를 차며 등을 돌렸습니다.",
          "😤 {p}: \"…볼 일 다 보셨으면 나가 주시죠.\"",
          "😤 {p}, 수건을 어깨에 걸치고 감독을 지나쳐 갔습니다."],
 indifferent:["🙄 {p}, 이어폰을 꽂으며 눈도 마주치지 않습니다.",
          "🙄 {p}, 하품을 하고는 스타킹을 마저 벗었습니다."],
 awkward:["😐 {p}, 신인이라 그런지 어쩔 줄 몰라 선배들 눈치만 봅니다.",
          "😐 {p}, 뭘 해야 할지 몰라 그냥 서 있었습니다."]};
const BOTTLE_RL={
 furious:["🤬 {p}, 감독을 향해 그대로 달려들었습니다! 동료 서넛이 허리를 붙잡아 겨우 막았습니다.",
          "🤬 {p}: \"지금 사람한테 물건을 던진 겁니까?! 경찰 부르세요!\"",
          "🤬 {p}, 락커를 주먹으로 내리쳤습니다. 문이 찌그러졌습니다.",
          "🤬 {p}, 휴대폰을 꺼내 감독 얼굴을 정면으로 찍기 시작했습니다.",
          "🤬 {p}, 목소리가 갈라질 정도로 소리쳤습니다. \"당장 나가!\""],
 annoyed:["😤 {p}, 맞은 동료에게 달려가 상태부터 확인합니다.",
          "😤 {p}, 감독을 노려보며 문 앞을 막아섰습니다.",
          "😤 {p}: \"…이건 진짜 선을 넘으셨습니다.\"",
          "😤 {p}, 코치를 향해 \"연맹에 바로 신고하세요\"라고 외칩니다."],
 mocking:["😂 {p}, 헛웃음을 터뜨립니다. \"이걸로 커리어 끝내시는 겁니까?\"",
          "😂 {p}, 바닥에 구르는 물병을 주워 감독 발치에 툭 놓습니다. \"흘리셨네요.\"",
          "😂 {p}: \"컨트롤이 그 정도니까 오늘 그 경기가 나왔죠.\"",
          "😂 {p}, 박수를 세 번 천천히 칩니다. \"명장면 나왔습니다.\"",
          "😂 {p}, 옆 선수에게 들리게 말합니다. \"이거 내일 뉴스 1면이다.\""],
 fired:  ["🔥 {p}, 아무 말 없이 감독의 얼굴을 오래 응시했습니다.",
          "🔥 {p}, 조용히 물병을 주워 자기 가방에 넣습니다. \"증거는 챙겨 두겠습니다.\"",
          "🔥 {p}, 다음 맞대결 날짜를 소리 내어 읽었습니다."],
 // 물병이 날아간 라커룸에서 "이어폰을 꽂는" 사람은 없다 — 계열별 대사를 전부 이 상황에 맞게 채운다
 indifferent:["😑 {p}, 소란에 등을 돌린 채 묵묵히 짐만 챙깁니다.",
          "😑 {p}, 한 번 쳐다보고는 다시 테이핑을 풉니다. 상대할 가치가 없다는 태도입니다."],
 awkward:["😳 {p}, 뭘 봤는지 이해가 안 된다는 얼굴로 굳어 있습니다.",
          "😳 {p}, 어린 선수라 그런지 뒷걸음질로 물러섰습니다.",
          "😳 {p}, 입을 벌린 채 감독과 물병을 번갈아 봅니다."],
 respectful:["😐 {p}, 감정을 누르고 동료들을 먼저 진정시킵니다. \"다들 그만.\""],
 touched:["😐 {p}, 맞은 동료를 부축하며 감독 쪽은 쳐다보지도 않습니다."],
 flattered:["😳 {p}, 하필 자기 옆으로 물병이 지나가 깜짝 놀랐습니다."]};
const AWAY_OPTS={
 win:[
  {k:"salaryQ", tone:"taunt", t:`💸 (상대 감독을 향해) "감독님, 연봉 얼마나 받으십니까? 얼마나 받길래 이런 축구를 하시는 겁니까?"`, danger:1,
   om:8, oa:-24, my:1, mya:-1, fan:-3, own:-8, rel:-8, soc:"taunt", brawl:0.28,
   d:"라커룸이 얼어붙었습니다. 이긴 팀 감독의 입에서 나온 말이라 더 아프게 박혔습니다. 상대 감독이 천천히 일어섰습니다."},
  {k:"respect", tone:"respect", t:`🤝 "좋은 경기였습니다. 오늘은 저희가 운이 좋았을 뿐입니다."`,
   om:2, oa:7, my:0, mya:1, fan:1, own:1, rel:3, soc:"respect",
   d:"상대 라커룸이 잠시 조용해지더니, 주장이 먼저 자리에서 일어나 손을 내밀었습니다."},
  {k:"humble", tone:"respect", t:`🙇 "솔직히 90분 내내 힘들었습니다. 다음엔 저희가 당할 차례겠죠."`,
   om:3, oa:8, my:0, mya:1, fan:1, own:1, rel:3, soc:"respect",
   d:"승자의 입에서 나온 말치고는 너무 낮은 자세라, 상대 벤치가 오히려 머쓱해합니다."},
  {k:"praise", tone:"praise", t:`👏 (상대 팀에서 가장 잘한 선수를 콕 집어 칭찬합니다.)`,
   om:2, oa:9, my:0, mya:0, fan:1, own:0, rel:2, soc:"respect", star:1,
   d:"지목된 선수가 당황한 표정으로 고개를 숙입니다. 주변에서 등을 두드려 줍니다."},
  {k:"gg", tone:"respect", t:`⚽ "오늘 경기, 팬들은 재밌었을 겁니다. 수고하셨습니다."`,
   om:1, oa:5, my:0, mya:0, fan:1, own:0, rel:2, soc:"respect",
   d:"담백한 인사에 상대 라커룸의 공기가 조금 풀립니다."},
  {k:"easy", tone:"taunt", t:`😏 "생각보다 쉽던데요? 다음에도 이 전술 쓰실 겁니까?"`,
   om:5, oa:-14, my:2, mya:-1, fan:0, own:-2, rel:-2, soc:"taunt",
   d:"라커룸 한쪽에서 의자가 쓰러지는 소리가 났습니다. 코칭스태프가 급히 막아섭니다."},
  {k:"scoreboard", tone:"taunt", t:`📋 "전광판 한 번 보고 가세요. 그게 오늘의 결론입니다."`,
   om:6, oa:-16, my:2, mya:-1, fan:0, own:-3, rel:-3, soc:"taunt",
   d:"상대 선수들이 일제히 감독을 노려봅니다. 몇몇은 이미 자리에서 일어났습니다."},
  {k:"tactic", tone:"insult", t:`🗣️ "전술이 정말 수준 이하더군요. 그렇게 해서는 저희를 이길 수 없습니다."`,
   om:8, oa:-22, my:2, mya:-2, fan:-2, own:-6, rel:-6, soc:"insult",
   d:"상대 감독의 얼굴이 새빨개졌습니다. 양쪽 스태프가 몸으로 사이를 막아섭니다."},
  {k:"mgr", tone:"insult", t:`🎤 "감독님, 벤치에서 주무신 겁니까?"`,
   om:7, oa:-18, my:1, mya:-2, fan:-1, own:-5, rel:-4, soc:"insult",
   d:"상대 감독이 물병을 집어던지며 \"나가!\"라고 소리쳤습니다."},
  {k:"nil", tone:"insult", t:`🤡 "골 축하드리러 왔는데… 아, 오늘 하나도 못 넣으셨죠? 다음엔 골대라도 한 번 맞혀 보세요."`,
   om:9, oa:-24, my:3, mya:-2, fan:-2, own:-5, rel:-5, soc:"nil", if:(c)=>c.oppG===0,
   d:"라커룸이 3초쯤 완전히 조용해졌습니다. 그러더니 공격수 하나가 의자를 걷어차며 일어섰고, 주장과 코치가 동시에 달려들어 그를 붙잡았습니다.",
   rl:{
     furious:["🤬 {p}, 의자를 걷어차고 일어섰습니다. \"한 번만 더 말해 보세요!\"",
              "🤬 {p}: \"골 못 넣은 건 저희 문제고, 남의 라커룸 와서 이러는 건 당신 인성 문제죠.\"",
              "🤬 {p}, 유니폼을 벗어 바닥에 내던졌습니다. 동료들이 어깨를 붙잡습니다.",
              "🤬 {p}, 말없이 감독 앞으로 걸어옵니다. 스태프가 급히 사이를 막았습니다."],
     annoyed:["😤 {p}, 이를 악뭅니다. \"…적어 두겠습니다. 다음 경기에.\"",
              "😤 {p}, 락커 문을 쾅 닫고 등을 돌렸습니다.",
              "😤 {p}: \"이런 말 듣자고 90분 뛴 게 아닙니다.\"",
              "😤 {p}, 수건으로 얼굴을 덮은 채 아무 말도 하지 않습니다."],
     mocking:["😂 {p}, 어이없다는 듯 웃습니다. \"골대 맞히는 법은 그쪽이 더 잘 아시겠죠.\"",
              "😂 {p}: \"다음에 오실 땐 승점도 챙겨 오세요.\"",
              "😂 {p}, 옆 선수에게 \"저 감독 진짜 웃긴다\"라고 들리게 말합니다."],
     fired:  ["🔥 {p}, 조용히 감독의 얼굴을 오래 쳐다봤습니다. \"기억하겠습니다.\"",
              "🔥 {p}, 벽에 걸린 다음 경기 일정표를 손가락으로 짚었습니다.",
              "🔥 {p}, 아무 대꾸도 없이 짐을 챙깁니다. 눈빛만 달라졌습니다."],
     indifferent:["🙄 {p}, 이어폰을 꽂으며 들은 척도 하지 않습니다.",
              "🙄 {p}, 하품을 하며 스타킹을 벗습니다."],
     awkward:["😐 {p}, 뭐라 대꾸해야 할지 몰라 바닥만 봅니다.",
              "😐 {p}, 신인이라 그런지 어쩔 줄 몰라 하며 선배들 눈치만 봅니다."]}},
  {k:"scout", tone:"mind", dyn:"scout", t:`💰 원하는 선수를 골라 영입 의사를 흘린다`,
   om:-3, oa:4, my:0, mya:0, fan:0, own:-1, rel:1, soc:"scout", pick:"scout",
   d:"상대 감독이 헛웃음을 지으며 \"지금 뭐 하시는 겁니까\"라고 되묻습니다.", },
  {k:"jersey", tone:"jersey", t:`👕 원하는 선수에게 우리 구단 유니폼을 강제로 입힌다`, danger:1,
   om:9, oa:-24, my:1, mya:-2, fan:-4, own:-14, rel:-8, soc:"jersey", pick:"jersey",
   d:"감독이 가방에서 우리 팀 유니폼을 꺼내 상대 선수의 머리에 뒤집어씌웠습니다. 라커룸이 뒤집혔습니다."},
  {k:"bottle", tone:"bottle", t:`🍾 특정 선수를 골라 물병을 집어던진다`, danger:1, pick:"bottle",
   om:12, oa:-40, my:-3, mya:-4, fan:-10, own:-22, rel:-16, soc:"bottle",
   d:"물병이 라커룸을 가로질러 날아갔습니다. 둔탁한 소리와 함께 모두가 얼어붙었고, 다음 순간 스무 명이 한꺼번에 일어섰습니다.",
   rl:BOTTLE_RL},
  {k:"chair", tone:"chair", t:`🪑 "이게 팀이야? 이게 팀이야?" (의자를 발로 차며)`, danger:1,
   om:11, oa:-30, my:1, mya:-1, fan:-5, own:-11, rel:-10, soc:"chair",
   d:"감독이 라커룸 한가운데 있던 의자를 그대로 걷어찼습니다. 의자가 벽에 부딪혀 요란한 소리를 냈고, 감독은 같은 말을 두 번 반복했습니다. \"이게 팀이야? 이게 팀이야?\"",
   rl:CHAIR_RL},
  {k:"stare", tone:"stare", t:`⌚ 한 선수 앞에서 시계를 풀고 셔츠를 열어젖힌 채 노려본다`, danger:1, pick:"stare",
   om:9, oa:-26, my:0, mya:-2, fan:-6, own:-12, rel:-9, soc:"stare",
   d:"감독이 말없이 손목시계를 풀어 주머니에 넣었습니다. 와이셔츠 단추 두 개를 천천히 풀고, 한 선수 앞에 섰습니다. 아무도 입을 열지 않았습니다.",
   rl:STARE_RL},
  {k:"silent", tone:"silent", t:`🚪 문만 열었다가 아무 말 없이 닫는다`,
   om:1, oa:-3, my:0, mya:0, fan:0, own:0, rel:0, soc:"silent",
   d:"상대 선수들이 어리둥절한 표정으로 문 쪽을 바라봅니다."}],
 draw:[
  {k:"salaryQ", tone:"taunt", t:`💸 (상대 감독을 향해) "감독님, 연봉 얼마나 받으십니까? 얼마나 받길래 그따구로 축구하는 겁니까?"`, danger:1,
   om:9, oa:-26, my:1, mya:-1, fan:-3, own:-9, rel:-8, soc:"taunt", brawl:0.34,
   d:"라커룸이 얼어붙었습니다. 상대 감독이 천천히 일어섰고, 코칭스태프 몇이 그 앞을 막아섰습니다."},
  {k:"respect", tone:"respect", t:`🤝 "잘 싸웠습니다. 서로 아쉬운 경기였네요."`,
   om:2, oa:6, my:0, mya:1, fan:1, own:1, rel:2, soc:"respect",
   d:"상대 주장이 고개를 끄덕이며 짧게 악수를 나눴습니다."},
  {k:"praise", tone:"praise", t:`👏 (오늘 인상적이었던 상대 선수를 찾아가 칭찬합니다.)`,
   om:2, oa:8, my:0, mya:0, fan:1, own:0, rel:2, soc:"respect", star:1,
   d:"지목된 선수가 쑥스러운 듯 웃습니다. 라커룸 분위기가 잠시 밝아집니다."},
  {k:"next", tone:"taunt", t:`😤 "오늘은 여기까지죠. 다음엔 저희가 확실히 가져갑니다."`,
   om:4, oa:-6, my:2, mya:1, fan:1, own:0, rel:1, soc:"taunt",
   d:"상대 선수들이 코웃음을 칩니다. \"기대하겠습니다\"라는 대답이 돌아왔습니다."},
  {k:"bed", tone:"insult", t:`🧊 "이런 축구 하실 거면 무승부가 최선이겠네요. 시간은 잘 끄시더군요."`,
   om:7, oa:-18, my:1, mya:-2, fan:-1, own:-4, rel:-4, soc:"insult",
   d:"상대 골키퍼가 장갑을 벽에 집어던졌습니다. 라커룸이 험악해집니다."},
  {k:"ref", tone:"taunt", t:`🗣️ "솔직히 저희가 이긴 경기 아닙니까? 심판한테 감사하세요."`,
   om:6, oa:-15, my:1, mya:-1, fan:0, own:-3, rel:-3, soc:"taunt",
   d:"\"그 말 그대로 돌려드리죠\"라는 반박이 즉시 날아왔습니다."},
  {k:"home", tone:"taunt", t:`😏 "홈에서 이 정도면… 팬들 표정은 보고 나오셨습니까?"`,
   om:6, oa:-17, my:1, mya:-2, fan:0, own:-4, rel:-3, soc:"taunt", if:(c)=>!c.isHome,
   d:"홈 라커룸이 얼어붙었습니다. 누군가 문을 발로 찼습니다."},
  {k:"scout", tone:"mind", dyn:"scout", t:`💰 원하는 선수를 골라 영입 의사를 흘린다`,
   om:-2, oa:5, my:0, mya:0, fan:0, own:-1, rel:1, soc:"scout", pick:"scout",
   d:"상대 코치가 황급히 그 선수를 감독에게서 떼어놓습니다."},
  {k:"jersey", tone:"jersey", t:`👕 원하는 선수에게 우리 구단 유니폼을 강제로 입힌다`, danger:1,
   om:9, oa:-24, my:1, mya:-2, fan:-4, own:-14, rel:-8, soc:"jersey", pick:"jersey",
   d:"감독이 가방에서 우리 팀 유니폼을 꺼내 상대 선수에게 억지로 입혔습니다. 라커룸이 아수라장이 됐습니다."},
  {k:"bottle", tone:"bottle", t:`🍾 특정 선수를 골라 물병을 집어던진다`, danger:1, pick:"bottle",
   om:12, oa:-40, my:-3, mya:-4, fan:-10, own:-22, rel:-16, soc:"bottle",
   d:"물병이 라커 문에 맞고 요란하게 튕겼습니다. 양 팀 스태프가 순식간에 뒤엉켰습니다.",
   rl:BOTTLE_RL},
  {k:"chair", tone:"chair", t:`🪑 "이게 팀이야? 이게 팀이야?" (의자를 발로 차며)`, danger:1,
   om:11, oa:-30, my:1, mya:-1, fan:-5, own:-11, rel:-10, soc:"chair",
   d:"감독이 라커룸 한가운데 있던 의자를 그대로 걷어찼습니다. 의자가 벽에 부딪혀 요란한 소리를 냈고, 감독은 같은 말을 두 번 반복했습니다. \"이게 팀이야? 이게 팀이야?\"",
   rl:CHAIR_RL},
  {k:"stare", tone:"stare", t:`⌚ 한 선수 앞에서 시계를 풀고 셔츠를 열어젖힌 채 노려본다`, danger:1, pick:"stare",
   om:9, oa:-26, my:0, mya:-2, fan:-6, own:-12, rel:-9, soc:"stare",
   d:"감독이 말없이 손목시계를 풀어 주머니에 넣었습니다. 와이셔츠 단추 두 개를 천천히 풀고, 한 선수 앞에 섰습니다. 아무도 입을 열지 않았습니다.",
   rl:STARE_RL},
  {k:"silent", tone:"silent", t:`🚪 인사만 하고 조용히 나온다`,
   om:0, oa:0, my:0, mya:0, fan:0, own:0, rel:0, soc:"silent",
   d:"짧은 목례만 남기고 문을 닫았습니다."}],
 loss:[
  {k:"salaryQ", tone:"taunt", t:`💸 (상대 감독을 향해) "감독님, 연봉 얼마나 받으십니까? 얼마나 받길래 그따구로 축구하는 겁니까?"`, danger:1,
   om:10, oa:-30, my:1, mya:-1, fan:-3, own:-11, rel:-8, soc:"taunt", brawl:0.42,
   d:"진 팀 감독이 남의 라커룸에서 던진 말입니다. 상대 감독의 얼굴이 굳었고, 선수 몇이 자리에서 일어섰습니다."},
  {k:"respect", tone:"respect", t:`🤝 "완패 인정합니다. 오늘 축하드립니다."`,
   om:2, oa:10, my:0, mya:1, fan:2, own:2, rel:4, soc:"respect",
   d:"상대 라커룸에서 박수가 터져 나왔습니다. 패장의 인사에 예의를 갖추는 분위기입니다."},
  {k:"learn", tone:"respect", t:`🙇 "오늘 많이 배웠습니다. 다음엔 준비해서 오겠습니다."`,
   om:1, oa:9, my:0, mya:1, fan:2, own:2, rel:3, soc:"respect",
   d:"상대 감독이 \"좋은 감독이시네요\"라며 어깨를 두드렸습니다."},
  {k:"praise", tone:"praise", t:`👏 (오늘 우리를 무너뜨린 선수를 찾아가 인정합니다.)`,
   om:1, oa:11, my:0, mya:0, fan:1, own:1, rel:3, soc:"respect", star:1,
   d:"지목된 선수가 놀란 표정으로 벌떡 일어나 고개를 숙였습니다."},
  {k:"revenge", tone:"taunt", t:`😤 "오늘은 졌습니다. 다음엔 반드시 이깁니다. 기억해 두세요."`,
   om:3, oa:-2, my:3, mya:2, fan:1, own:0, rel:1, soc:"taunt",
   d:"상대 선수들이 웃으며 \"기다리겠습니다\"라고 받아쳤습니다. 나쁘지 않은 온도입니다."},
  {k:"luck", tone:"insult", t:`😡 "운으로 이긴 겁니다. 실력이라고 착각하지 마세요."`,
   om:8, oa:-20, my:1, mya:-2, fan:-3, own:-6, rel:-5, soc:"insult",
   d:"라커룸이 순식간에 야유로 가득 찼습니다. \"전광판이나 보고 가시죠!\""},
  {k:"time", tone:"insult", t:`🤬 "그렇게 시간 끄는 축구, 부끄럽지 않으십니까?"`,
   om:7, oa:-19, my:1, mya:-2, fan:-2, own:-5, rel:-5, soc:"insult",
   d:"상대 주장이 감독 앞까지 걸어 나왔습니다. 스태프가 급히 사이를 막습니다."},
  {k:"money", tone:"insult", t:`🧊 "돈 쓴 값은 하시네요. 저흰 그런 거 없어서요."`,
   om:5, oa:-12, my:0, mya:-1, fan:-1, own:-3, rel:-2, soc:"taunt",
   d:"비아냥에 상대 라커룸이 싸늘해졌습니다. 몇몇은 아예 시선을 피합니다."},
  {k:"scout", tone:"mind", dyn:"scout", t:`💰 원하는 선수를 골라 영입 의사를 흘린다`,
   om:-2, oa:6, my:0, mya:0, fan:0, own:-1, rel:1, soc:"scout", pick:"scout",
   d:"웃음이 터졌습니다. \"연락처 드릴까요?\"라는 농담까지 나왔습니다."},
  {k:"jersey", tone:"jersey", t:`👕 원하는 선수에게 우리 구단 유니폼을 강제로 입힌다`, danger:1,
   om:10, oa:-26, my:1, mya:-2, fan:-5, own:-15, rel:-9, soc:"jersey", pick:"jersey",
   d:"진 팀 감독이 남의 라커룸에서 유니폼을 꺼내 들었습니다. 아무도 예상 못 한 장면이었습니다."},
  {k:"bottle", tone:"bottle", t:`🍾 특정 선수를 골라 물병을 집어던진다`, danger:1, pick:"bottle",
   om:14, oa:-45, my:-4, mya:-5, fan:-12, own:-25, rel:-18, soc:"bottle",
   d:"진 팀 감독이 남의 라커룸에서 물병을 던졌습니다. 몸싸움 직전까지 간 상황을 양 팀 스태프가 겨우 뜯어말렸습니다.",
   rl:BOTTLE_RL},
  {k:"chair", tone:"chair", t:`🪑 "이게 팀이야? 이게 팀이야?" (의자를 발로 차며)`, danger:1,
   om:11, oa:-30, my:1, mya:-1, fan:-5, own:-11, rel:-10, soc:"chair",
   d:"감독이 라커룸 한가운데 있던 의자를 그대로 걷어찼습니다. 의자가 벽에 부딪혀 요란한 소리를 냈고, 감독은 같은 말을 두 번 반복했습니다. \"이게 팀이야? 이게 팀이야?\"",
   rl:CHAIR_RL},
  {k:"stare", tone:"stare", t:`⌚ 한 선수 앞에서 시계를 풀고 셔츠를 열어젖힌 채 노려본다`, danger:1, pick:"stare",
   om:9, oa:-26, my:0, mya:-2, fan:-6, own:-12, rel:-9, soc:"stare",
   d:"감독이 말없이 손목시계를 풀어 주머니에 넣었습니다. 와이셔츠 단추 두 개를 천천히 풀고, 한 선수 앞에 섰습니다. 아무도 입을 열지 않았습니다.",
   rl:STARE_RL},
  {k:"silent", tone:"silent", t:`🚪 아무 말 없이 한 번 훑어보고 돌아선다`,
   om:2, oa:-5, my:0, mya:0, fan:0, own:0, rel:-1, soc:"silent",
   d:"말 한마디 없는 시선에 상대 라커룸이 오히려 조용해졌습니다."}]
};
/* 상대 선수의 반응 대사 */
/* 🎭 상대 라커룸 반응 — 리뉴얼.
   예전엔 카테고리당 3~4줄뿐이라 세 명만 반응해도 같은 말이 겹쳤다.
   ─ 카테고리당 10줄 안팎으로 늘리고, 「오늘 무슨 일이 있었는지」를 인용하는 줄을 섞는다.
     {p}=선수 · {sc}=오늘 스코어 이야기 · {tn}=우리 팀 · {on}=상대 팀 */
const AWAY_REACT={
 touched:  ["😭 {p}, 예상 못 한 인사에 잠시 말을 잇지 못합니다.",
   "😭 {p}: \"…감사합니다. 진심으로요.\"",
   "😭 {p}, 눈을 마주치며 깊게 고개를 숙입니다.",
   "😭 {p}, 젖은 유니폼을 든 채 한참을 서 있었습니다.",
   "😭 {p}: \"이런 말 들으려고 축구 하는 겁니다.\"",
   "😭 {p}, 옆 동료의 어깨를 툭 치고는 조용히 웃었습니다.",
   "😭 {p}, 목이 메어 말을 삼켰습니다.",
   "😭 {p}: \"저희 감독님한테도 이런 말 좀 해주세요.\"",
   "😭 {p}, 악수한 손을 한동안 놓지 못했습니다."],
 respectful:["🤝 {p}, 자리에서 일어나 악수를 청합니다.",
   "🤝 {p}: \"좋은 경기였습니다, 감독님.\"",
   "🤝 {p}, 고개를 끄덕이며 예의를 갖춥니다.",
   "🤝 {p}, 조용히 박수를 보냅니다.",
   "🤝 {p}: \"{tn} 준비 많이 하셨더군요. 배웠습니다.\"",
   "🤝 {p}, 스파이크를 내려놓고 자세를 고쳐 앉았습니다.",
   "🤝 {p}: \"다음엔 저희 홈에서 뵙겠습니다.\"",
   "🤝 {p}, 유니폼 교환을 먼저 제안했습니다.",
   "🤝 {p}, 라커룸 문까지 따라 나와 배웅했습니다.",
   "🤝 {p}: \"이런 건 흔치 않은 일이라 기억하겠습니다.\""],
 flattered:["😳 {p}, 자기 이름이 불리자 화들짝 놀랍니다.",
   "😳 {p}: \"저… 저요?\" 하며 주변을 둘러봅니다.",
   "😳 {p}, 귀까지 빨개진 채 고개를 숙입니다.",
   "😳 {p}, 동료들이 휘파람을 불자 더 어쩔 줄 몰라 합니다.",
   "😳 {p}: \"제 이름을 아신다는 게 더 놀랍습니다.\"",
   "😳 {p}, 웃음을 참지 못하고 수건으로 얼굴을 덮었습니다.",
   "😳 {p}, 옆 선수가 등을 떠밀자 그제야 일어섰습니다.",
   "😳 {p}: \"집에 가서 아버지한테 말해야겠는데요.\""],
 awkward:  ["😐 {p}, 뭐라 대꾸해야 할지 몰라 시선을 피합니다.",
   "😐 {p}, 어색하게 유니폼만 만지작거립니다.",
   "😐 {p}, 옆 선수와 눈빛을 주고받습니다.",
   "😐 {p}, 짐 정리를 하는 척하며 상황이 지나가길 기다립니다.",
   "😐 {p}, 헛기침을 하고는 고개를 반쯤 끄덕였습니다.",
   "😐 {p}: \"아… 네.\" 그게 전부였습니다.",
   "😐 {p}, 감독이 나갈 때까지 고개를 들지 않았습니다.",
   "😐 {p}, 물병 라벨만 계속 뜯고 있었습니다."],
 indifferent:["🙄 {p}, 신경 쓰지 않는 듯 이어폰을 꽂습니다.",
   "🙄 {p}, 별 반응 없이 짐을 챙깁니다.",
   "🙄 {p}, 흘깃 보고는 다시 고개를 돌립니다.",
   "🙄 {p}, 휴대폰 화면에서 눈을 떼지 않았습니다.",
   "🙄 {p}, 스트레칭을 이어갔습니다. 들리긴 했을 겁니다.",
   "🙄 {p}, 테이프를 뜯으며 \"네\" 한마디만 했습니다.",
   "🙄 {p}, 샤워실 쪽으로 그냥 들어가 버립니다.",
   "🙄 {p}, 표정 하나 바뀌지 않았습니다."],
 annoyed:  ["😤 {p}, 혀를 차며 고개를 저었습니다.",
   "😤 {p}: \"…지금 뭐 하시는 겁니까.\"",
   "😤 {p}, 수건을 바닥에 내던집니다.",
   "😤 {p}, 팔짱을 낀 채 노골적으로 노려봅니다.",
   "😤 {p}: \"여기 저희 라커룸인데요.\"",
   "😤 {p}, 라커 문을 쾅 닫고 등을 돌립니다.",
   "😤 {p}: \"할 말 있으면 경기장에서 하시죠.\"",
   "😤 {p}, 코치 쪽을 보며 «이 사람 좀 데려가라»는 눈짓을 합니다.",
   "😤 {p}, 신발끈을 묶다 말고 손을 멈췄습니다.",
   "😤 {p}: \"오늘 이긴 건 축하드립니다. 이제 나가주시죠.\""],
 furious:  ["🤬 {p}, 벌떡 일어나 감독 쪽으로 달려들려 합니다!",
   "🤬 {p}: \"당신 지금 제정신입니까?!\"",
   "🤬 {p}, 라커 문을 주먹으로 내리쳤습니다.",
   "🤬 {p}, 동료들이 붙잡지 않았다면 큰일 날 뻔했습니다.",
   "🤬 {p}: \"나이 먹었다고 다 어른입니까?!\"",
   "🤬 {p}, 의자를 걷어차며 소리를 질렀습니다.",
   "🤬 {p}, 주장이 앞을 막아서자 그 어깨 너머로 계속 소리쳤습니다.",
   "🤬 {p}: \"이거 다 찍히고 있는 거 압니까?!\"",
   "🤬 {p}, 얼굴이 새빨개진 채 숨을 몰아쉽니다.",
   "🤬 {p}, 코칭스태프 셋이 달라붙어 겨우 앉혔습니다."],
 mocking:  ["😂 {p}, 대놓고 코웃음을 칩니다.",
   "😂 {p}: \"지고 나서 하실 말씀은 아닌 것 같은데요.\"",
   "😂 {p}, 옆 선수와 눈짓하며 낄낄댑니다.",
   "😂 {p}, 전광판 쪽을 손가락으로 가리킵니다.",
   "😂 {p}: \"감독님, 스코어 다시 확인해 보시죠.\"",
   "😂 {p}, 박수를 세 번 치고는 등을 돌립니다.",
   "😂 {p}: \"저희 라커룸 구경 오신 김에 사진도 찍으시죠.\"",
   "😂 {p}, 휴대폰을 들어 대놓고 촬영을 시작했습니다.",
   "😂 {p}: \"이런 건 다음 경기 전에 하시는 게 낫습니다.\"",
   "😂 {p}, 동료들에게 «들었냐»는 손짓을 합니다."],
 fired:    ["🔥 {p}, 이를 악뭅니다. \"다음엔 두고 봅시다.\"",
   "🔥 {p}, 눈빛이 완전히 달라졌습니다.",
   "🔥 {p}, 조용히 감독의 얼굴을 머릿속에 새깁니다.",
   "🔥 {p}: \"오늘 이 말, 안 잊겠습니다.\"",
   "🔥 {p}, 아무 말 없이 감독을 끝까지 쳐다봤습니다.",
   "🔥 {p}, 라커에 붙은 다음 경기 일정을 손가락으로 짚었습니다.",
   "🔥 {p}: \"{on}에서 다시 뵙죠.\"",
   "🔥 {p}, 그날 이후 훈련장에 제일 먼저 나온다고 합니다."]
};
const AWAY_TONE_TABLE={
  respect: {good:["touched","respectful","respectful","awkward"], bad:["awkward","indifferent"]},
  praise:  {good:["flattered","respectful","touched"],            bad:["awkward","indifferent"]},
  mind:    {good:["flattered","awkward"],                          bad:["annoyed","indifferent"]},
  silent:  {good:["awkward","indifferent"],                        bad:["annoyed","indifferent"]},
  taunt:   {good:["annoyed","mocking","fired"],                    bad:["furious","annoyed","fired"]},
  insult:  {good:["furious","annoyed","fired"],                    bad:["furious","furious","mocking"]},
  jersey:  {good:["annoyed","mocking","awkward"],                  bad:["furious","furious","annoyed"]},
  bottle:  {good:["annoyed","fired","mocking"],                    bad:["furious","furious","annoyed","fired"]}
};
/* 상대 선수 한 명의 반응 — 성격(pers)과 오늘 결과에 따라 온도가 달라진다 */
function awayReact(p, o, ctx){
  const tbl=AWAY_TONE_TABLE[o.tone]||AWAY_TONE_TABLE.silent;
  const pers=p.pers||0;                  // 0프로 1야심 2온화 3다혈질
  const oppLost = ctx.outcome==="win";   // ctx.outcome 은 우리 기준 — 우리가 이겼으면 상대는 진 것이다
  const oppWon  = ctx.outcome==="loss";
  const harsh = o.tone==="taunt"||o.tone==="insult"||o.tone==="bottle"||o.tone==="jersey"||o.tone==="stare"||o.tone==="chair";
  let cat;
  if(harsh){
    // 진 팀 라커룸에 들어가 긁으면 폭발한다. 이긴 팀은 화내기보다 비웃는다.
    if(oppWon)      cat = Math.random()<0.60 ? "mocking" : pick(["annoyed","indifferent","fired"]);
    else if(pers===2) cat = pick(tbl.good);          // 온화한 선수는 삼킨다
    else            cat = pick(tbl.bad);
    // 물병이 날아가면 대부분 폭발하지만, 동료를 챙기거나 증거부터 확보하는 선수도 있다
    if(o.tone==="bottle") cat = Math.random()<0.50 ? "furious" : cat;
    if(o.tone==="chair")  cat = Math.random()<0.45 ? "mocking" : (Math.random()<0.5 ? "furious" : cat);
  } else {
    // 정중한 말은 대체로 좋게 남는다. 다만 방금 진 다혈질 선수에게는 잘 들리지 않는다.
    cat = pick(tbl.good);
    if(oppLost && pers===3 && Math.random()<0.45) cat = pick(tbl.bad);
    if(oppWon && Math.random()<0.15) cat = pick(tbl.bad);   // 이긴 쪽은 승리에 취해 흘려듣기도 한다
    if(o.tone==="praise" && Math.random()<0.15) cat="awkward";
  }
  // 선택지가 전용 대사 풀(rl)을 갖고 있으면 그쪽을 우선 쓴다 — 상황에 딱 맞는 반응이 나온다
  const pool=(o.rl && o.rl[cat]) ? o.rl[cat] : AWAY_REACT[cat];
  /* {tn}=우리 팀 · {on}=상대 팀 — 반응이 오늘 상대를 인용할 수 있게 */
  let line=pick(pool).replace(/\{p\}/g, p.name);
  try{ const _ut=userTeam();
    line=line.replace(/\{tn\}/g, _ut?_ut.short:"상대팀")
             .replace(/\{on\}/g, (ctx&&ctx.opp)?ctx.opp.short:"저희 홈"); }catch(e){}
  // 감독 개인 호감도 — 성격에 따라 같은 말도 다르게 남는다
  const k = cat==="touched"?1.4 : cat==="respectful"?1.0 : cat==="flattered"?1.2
          : cat==="furious"?1.5 : cat==="mocking"?0.8 : cat==="annoyed"?1.1 : 0.5;
  const d=Math.round((o.oa||0)*k*0.34);
  affAdd(p, d, "상대 라커룸 방문");
  return {p, cat, line, delta:d, kind:"away"};
}
/* 상대 라커룸을 방문할지 물어본다 */
/* ═══════════════════════════════════════════════════════════════
   🧑‍⚖️ 심판 대기실
   경기가 끝나고 복도 끝에는 심판 대기실이 있다. 주심·대기심·VAR심이 짐을 챙기는 중이다.
   여기서 하는 말은 상대 라커룸과 성격이 다르다 — 사람의 호감도가 아니라 '판정'이 걸린다.
     · 관계(rel)는 시즌 내내 누적된다. 좋으면 애매한 장면에서 우리 쪽으로, 나쁘면 반대로.
     · 선을 넘으면 연맹 제재금이 감독 사비에서 나가고, 그 장면은 반드시 새어 나간다.
     · 팬 반응은 판정이 실제로 나빴는지에 따라 갈린다. 억울했으면 팬들은 오히려 통쾌해한다.
═══════════════════════════════════════════════════════════════ */
/* ⚠ 실존 심판과 겹치지 않도록 성씨를 전부 바꿔 둔 가상의 심판진 (에디터에서 바꿀 수 있다) */
const REF_FAM_DEF=["표종혁","마형진","하대용","노동식","방동준","진상협","도재훈","육현재","편진철","봉용준","남민석","예지음"];
function refNames(){
  /* 🎭 선수·감독과 같은 규칙으로 첫 글자를 바꾼다 — 실존 심판과 겹치지 않게 */
  if(!Array.isArray(G.refNames) || G.refNames.length!==REF_FAM_DEF.length)
    G.refNames=REF_FAM_DEF.map(x=>fictName(x,0));
  return G.refNames;
}
const REF_TRAIT=[
  {k:"strict", n:"원칙주의", d:"규정집을 외우고 다닌다. 항의를 가장 싫어한다.", tol:-0.16},
  {k:"calm",   n:"소통형",   d:"경기 중에도 선수들과 말을 섞는다.",             tol:+0.14},
  {k:"proud",  n:"자존심",   d:"자기 판정을 의심받는 걸 못 견딘다.",           tol:-0.10},
  {k:"vet",    n:"베테랑",   d:"산전수전 다 겪었다. 웬만한 일에는 눈도 깜짝 안 한다.", tol:+0.20},
  {k:"rookie", n:"신인",     d:"아직 휘슬을 부는 손이 떨린다.",                tol:-0.04}
];
function trainLv(t){ t=t||userTeam(); return clamp((t&&t.trainLv)||1, 1, FAC_MAX); }
function refState(){
  if(!G.refs) G.refs={rel:0, n:0, log:[]};
  if(typeof G.refs.rel!=="number") G.refs.rel=0;
  if(!Array.isArray(G.refs.log)) G.refs.log=[];
  return G.refs;
}
/* 감독-심판진 관계가 판정에 남기는 흔적 — 아주 작게, 그러나 시즌 내내 */
function refBias(){ return clamp(refState().rel/100, -1, 1); }
function refLog(txt){
  const S=refState();
  S.log.unshift({s:G.season, d:G.day||0, t:txt});
  S.log=S.log.slice(0,20);
}
/* 이 경기의 심판진 — 경기마다 결정적으로 뽑는다 */
function refCrewOf(M){
  if(M && M._refs) return M._refs;
  const seed=((G.season||2026)*997 + (G.day||0)*31 + ((M&&M.home&&M.home.id)||"x").length*7)|0;
  const NAMES=refNames();
  const pickAt=(arr,off)=>arr[Math.abs(seed+off*131)%arr.length];
  const crew={
    main:{n:pickAt(NAMES,0), t:REF_TRAIT[Math.abs(seed)%REF_TRAIT.length]},
    ar:  {n:pickAt(NAMES,3)},
    var_:{n:pickAt(NAMES,7)}
  };
  if(crew.ar.n===crew.main.n) crew.ar.n=pickAt(NAMES,4);
  if(crew.var_.n===crew.main.n||crew.var_.n===crew.ar.n) crew.var_.n=pickAt(NAMES,9);
  if(M) M._refs=crew;
  return crew;
}
/* 오늘 판정이 우리에게 어땠나 — 카드·PK 차이로 본다. 양수면 우리가 손해를 봤다는 뜻 */
function refGrievance(M, isHome){
  if(!M||!M.st) return 0;
  const st=M.st, me=isHome?"h":"a", op=isHome?"a":"h";
  let g=0;
  g += (st[me+"Y"]||0)-(st[op+"Y"]||0);
  g += ((st[me+"R"]||0)-(st[op+"R"]||0))*3;
  return g;
}
const REF_OPTS=[
 {k:"thanks", g:"good", t:`🤝 "오늘 어려운 경기였는데 잘 봐주셨습니다. 고생하셨습니다."`,
  rel:8, rl:3, fan:0, own:1, soc:"good",
  d:`주심이 잠깐 놀란 표정을 짓더니 웃으며 손을 내밀었습니다. "이런 인사는 오랜만입니다."`},
 {k:"coffee", g:"good", t:`☕ 대기실에 커피를 돌리고 조용히 나온다`,
  rel:6, rl:2, fan:0, own:0, soc:"good",
  d:`종이컵 다섯 개가 테이블에 놓였습니다. 대기심이 "이러시면 안 되는데요" 하면서도 받아 들었습니다.`},
 {k:"ask", g:"good", t:`📋 "한 장면만 여쭤보겠습니다. 후반 그 상황, 어떻게 보셨습니까?"`,
  rel:4, rl:2, fan:0, own:0, soc:"good",
  d:`주심이 태블릿을 꺼내 각도를 짚어 줬습니다. 납득이 되든 안 되든, 대화는 정중했습니다.`},
 {k:"cold", g:"bad", t:`🧊 "수고하셨습니다." (딱 그 한마디만 남기고 돌아선다)`,
  rel:-3, rl:0, fan:1, own:0, soc:"cold",
  d:`온도가 뚝 떨어졌습니다. 아무도 대꾸하지 않았습니다.`},
 {k:"eyes", g:"bad", t:`😠 "눈 좀 뜨고 다니시죠?"`, danger:1,
  rel:-22, rl:-8, fan:4, own:-6, soc:"eyes",
  d:`대기실이 얼어붙었습니다. 대기심이 자리에서 일어섰고, 주심은 아무 말 없이 감독을 오래 쳐다봤습니다.`},
 {k:"protest", g:"bad", t:`🗣️ "오늘 판정, 연맹에 정식으로 제소하겠습니다."`, danger:1,
  rel:-14, rl:-4, fan:5, own:-2, soc:"protest",
  d:`주심이 고개를 끄덕였습니다. "그렇게 하십시오. 저희도 보고서를 씁니다."`},
 {k:"video", g:"bad", t:`📱 "그 장면 영상 있습니다. 여기서 같이 보시죠."`, danger:1,
  rel:-11, rl:-2, fan:6, own:-3, soc:"video",
  d:`감독이 휴대폰을 테이블 한가운데 올려놨습니다. VAR심이 화면을 보다가 시선을 피했습니다.`},
 {k:"chair", g:"wild", t:`🪑 "이게 판정이야? 이게 판정이야?" (의자를 발로 차며)`, danger:1,
  rel:-34, rl:-14, fan:6, own:-16, soc:"chair",
  d:`주심 옆에 있던 의자가 벽까지 날아갔습니다. 감독은 같은 말을 두 번 반복했습니다. "이게 판정이야? 이게 판정이야?"`},
 {k:"stare", g:"wild", t:`⌚ 시계를 풀고 셔츠를 열어젖힌 채 심판진을 노려본다`, danger:1,
  rel:-30, rl:-12, fan:5, own:-15, soc:"stare",
  d:`감독이 손목시계를 풀어 테이블에 올려놨습니다. 셔츠 단추 두 개를 풀고, 세 사람을 차례로 봤습니다. 한마디도 하지 않았습니다.`},
 {k:"chant", g:"wild", t:`👏 "눈을 떠라 심판! (짝짝짝) 눈을 떠라 심판! (짝짝짝)"`, danger:1,
  rel:-32, rl:-13, fan:9, own:-15, soc:"chant",
  d:`감독이 박수를 세 번 치고 구호를 외쳤습니다. 원정 응원석에서 90분 내내 들리던 그 구호였습니다.\n한 번으로 끝내지 않고, 두 번째 소절까지 또박또박 끝냈습니다. 대기실이 얼어붙었습니다.`},
 {k:"slap", g:"wild", t:`✋ 주심에게 성큼성큼 다가가 뺨을 후려친다`, danger:1,
  rel:-70, rl:-25, fan:-18, own:-42, soc:"slap",
  d:`짝 — 하는 소리가 대기실을 갈랐습니다.\n주심이 뺨을 감싼 채 비틀거렸고, 대기심이 벌떡 일어나 소리쳤습니다. "지금 뭐 하시는 겁니까!"\nVAR심은 이미 휴대폰을 귀에 대고 있었습니다. 경찰을 부르는 전화였습니다.`},
 {k:"leave", g:"good", t:`🚪 문만 열어 얼굴을 비치고 조용히 닫는다`,
  rel:0, rl:0, fan:0, own:0, soc:"silent",
  d:`심판진이 어리둥절한 얼굴로 문 쪽을 봤습니다.`}
];
function refOptList(){ return REF_OPTS; }
/* 심판의 반응 — 주심 성향, 오늘 판정에 대한 명분, 감독 위신이 함께 작용한다 */
function refOutcome(o, c){
  const crew=c.crew, tr=crew.main.t;
  if(o.g==="good"){
    let ok=0.72 + (tr.tol||0) + clamp(refBias()*0.20, -0.2, 0.2);
    try{ ok += clamp((mgrPrestige()-20)/400, -0.03, 0.08); }catch(e){}
    return {ok:Math.random()<clamp(ok,0.35,0.95)};
  }
  /* 항의가 '먹히는가' — 오늘 실제로 손해를 봤을수록 심판도 할 말이 없다 */
  let land = 0.24 + refGrievance(c.M, c.isHome)*0.11 + (tr.tol||0);
  if(c.outcome==="loss") land -= 0.06;         // 진 감독의 항의는 가볍게 들린다
  if(o.g==="wild")       land -= 0.18;         // 기행은 명분이 있어도 통하지 않는다
  land += clamp(refBias()*0.15, -0.15, 0.15);
  return {ok:Math.random()<clamp(land, 0.05, 0.72)};
}
function refSay(i){
  const c=awayCtxInfo(); if(!c) return;
  const o=refOptList()[i]; if(!o) return;
  /* 폭행만은 두 번 묻는다 — 항의도 기행도 아닌, 감독 경력이 끝나는 길이기 때문이다 */
  if(o.k==="slap"){
    const rn=(c.crew&&c.crew.main&&c.crew.main.n)||"주심";
    showConfirm(`✋ <b>이것은 항의가 아니라 폭행입니다.</b>\n\n의자를 차고 구호를 외치는 것과는 차원이 다릅니다. 형사 사건입니다.\n연맹 중징계와 거액의 제재금·합의금, 구단주와 팬 여론의 붕괴 —\n<b>감독 경력이 오늘 밤 여기서 끝날 수 있습니다.</b>\n\n<span class="small">판정이 아무리 억울해도, 돌아올 수 없는 강입니다.</span>`,
      ()=>{ showConfirm(`정말로 ${rn} 주심의 뺨을 때리시겠습니까?\n\n<span class="small">이 결정은 되돌릴 수 없습니다.</span>`,
        ()=>applyRefRoom(o), {okLabel:"후려친다", cancelLabel:"손을 내린다", danger:true}); },
      {okLabel:"계속한다", cancelLabel:"참는다", danger:true});
    return;
  }
  if(o.danger){
    const warn = o.k==="chant"
      ? `👏 정말 심판진 앞에서 <b>"눈을 떠라 심판"</b>을 외치시겠습니까?\n\n항의가 아니라 조롱입니다. 원정석에서 팬들이 부르던 구호를\n감독이 대기실까지 들고 들어가는 겁니다.\n\n<span class="small">팬들은 열광하겠지만, 연맹 제재금과 심판진의 기억은 오래 남습니다.</span>`
      : `${o.t}\n\n심판 대기실에서 벌이는 일입니다. 연맹 제재금이 감독 사비에서 나가고,\n앞으로의 판정에도 영향이 남습니다.\n\n<span class="small">팬들은 오히려 통쾌해할 수도 있습니다 — 오늘 판정이 실제로 억울했다면.</span>`;
    showConfirm(warn, ()=>applyRefRoom(o), {okLabel:"그렇게 한다", cancelLabel:"참는다", danger:true});
    return;
  }
  applyRefRoom(o);
}
function applyRefRoom(o){
  const c=awayCtxInfo(); if(!c) return;
  const t=userTeam(), S=refState(), crew=c.crew;
  const res=refOutcome(o, c);
  const griev=refGrievance(c.M, c.isHome);
  let rel=o.rel||0, rl=o.rl||0, fan=o.fan||0, own=o.own||0, fine=0;
  let line="";
  if(o.g==="good"){
    if(res.ok){ line=`${crew.main.n} 주심: "감독님 같은 분만 계시면 저희도 일할 맛 납니다."`; }
    else { rel=Math.round(rel*0.3); line=`${crew.main.n} 주심: "…네, 수고하셨습니다." 형식적인 대답이 돌아왔습니다.`; }
  } else if(o.k==="slap"){
    /* ✋ 폭행 — 확률도 명분도 없다. 오늘 판정이 어땠든 결과는 하나뿐이다. */
    rel = clamp(-100 - S.rel, -200, 0);            // 누적 관계가 어디에 있었든 -100으로 꽂힌다
    fine = mgrFine(12+R(60)/10, "심판 폭행 (상벌위 중징계)");
    fine = Math.round((fine + mgrFine(5+R(40)/10, "심판 폭행 형사 합의금"))*100)/100;
    line=`${crew.main.n} 주심이 뺨을 감싼 채 한참 감독을 바라보다, 아주 조용히 말했습니다. "…끝까지 가겠습니다, 감독님."`;
    refLog(`✋ 주심 폭행 — 관계 회복 불가 (-100)`);
    addNews(`🚨 [단독] ${t.name} 감독, 심판 대기실에서 ${crew.main.n} 주심 폭행… 경찰 출동`, "warn", "club",
      {cat:"manager", ic:"🚨", tone:-1, tid:t.id, brk:1,
       head:`[단독] ${t.short} 감독, ${crew.main.n} 주심 폭행… 경찰 출동`, src:pick(MEDIA),
       sub:`연맹은 긴급 상벌위원회 소집을 예고했고, 구단은 "드릴 말씀이 없다"는 입장만 냈다. 축구계 안팎에서 사실상 지도자 생명이 끝났다는 말이 나온다.`});
    addNews(`🏢 ${t.name} 구단주, 긴급 이사회 소집 — "감독 거취 포함 모든 가능성 검토"`, "warn", "club");
    /* 타 구단 팬들도 이건 웃지 못한다 */
    rivalFill(RIV.refSlap, 4+R(3), -1, {t:t.short, r:crew.main.n});
    rivalFmk(FRIV.refSlap, 3+R(2), {t:t.short, r:crew.main.n});
  } else if(o.k==="chant"){
    /* 구호는 항의가 아니라 조롱이다. 심판은 반박할 말조차 없다. */
    fine=mgrFine(1.8+R(19)/10, "심판 조롱 행위 (품위 손상)");
    if(res.ok){
      rel=Math.round(rel*0.75); rl=Math.round(rl*0.75);
      line=`${crew.main.n} 주심이 헛웃음을 지었습니다. "…저도 오늘 경기 다시 돌려보겠습니다."`;
    } else {
      rel=Math.round(rel*1.25); rl=Math.round(rl*1.3); own=Math.round(own*1.2);
      line=`${crew.main.n} 주심이 수첩을 꺼내 들었습니다. "감독님 성함, 다시 한번 말씀해 주시겠습니까."`;
    }
  } else {
    if(res.ok){
      /* 심판도 오늘 자기 경기가 깔끔하지 않았다는 걸 안다 */
      rel=Math.round(rel*0.55); rl=Math.round(rl*0.6);
      line=`${crew.main.n} 주심이 한참 말이 없다가 짧게 답했습니다. "…보고서에 남기겠습니다."`;
    } else {
      rel=Math.round(rel*1.25); rl=Math.round(rl*1.3); own=Math.round(own*1.2);
      line=`${crew.main.n} 주심의 표정이 굳었습니다. "감독님, 여기까지 하시죠. 지금 하신 말씀 그대로 올라갑니다."`;
    }
    if(o.g==="wild")   fine=mgrFine(1.5+R(21)/10, "심판 대기실 소란 (품위 손상)");
    else if(o.k==="eyes") fine=mgrFine(0.8+R(11)/10, "심판 모욕 발언 제재금");
  }
  /* 팬은 판정이 실제로 억울했는지를 본다 — 억울했으면 항의를 반긴다 */
  if(o.g!=="good"){
    const backing = clamp(griev*0.45, -1.2, 1.6);
    fan = Math.round((fan + backing*3)*10)/10;
    if(o.g==="wild") fan -= 3;                       // 기행은 그래도 부끄럽다
  }
  S.rel=clamp(Math.round((S.rel+rel)*10)/10, -100, 100);
  S.n=(S.n||0)+1;
  refLog(`${o.t.replace(/^[^ ]+ /,"").slice(0,22)} — 관계 ${rel>=0?"+":""}${rel} (누적 ${S.rel})`);
  if(fan) adjustTrust("fans", fan, "심판 대기실 방문");
  if(own) adjustTrust("owner", own, "심판 대기실 방문");
  if(rl)  G.press.rel=clamp(G.press.rel+rl, 0, 100);
  /* 기사·여론 */
  const V={t:t.short, o:c.opp.short, r:crew.main.n, m:fine};
  const head=REF_HEADLINE[o.k] || `${t.short} 감독, 경기 후 심판 대기실 방문`;
  if(o.g!=="good"){
    if(o.k!=="slap") /* 폭행은 위에서 이미 [단독] 속보로 나갔다 — 밋밋한 기사로 덮지 않는다 */
    addNews(`🧑‍⚖️ ${fixJosa(F_(head, V))}${fine?` — 제재금 ${fine}억`:""}`, o.g==="good"?null:"warn", "club",
      {cat:"manager", ic:o.k==="chant"?"👏":"🧑‍⚖️", tone:-1, tid:t.id, head:fixJosa(F_(head,V)), src:pick(MEDIA),
       sub:`${crew.main.n} 주심을 비롯한 심판진이 대기실에 있던 상황이었다.`});
    if(SOC["ref_"+o.soc]) socialFill(SOC["ref_"+o.soc], 3+R(3), fan>=0?0:-1, V);
    if(FMK["ref_"+o.soc]) fmkFill(FMK["ref_"+o.soc], 2+R(3), V);
    if(o.g==="wild") rivalOnManager(false);
  } else {
    if(res.ok && SOC.ref_good) socialFill(SOC.ref_good, 2+R(2), 1, V);
  }
  awayLockerCtx.refDone=1;          // ⚠ 한 경기에 한 번뿐 — 나왔다가 또 들어갈 수는 없다
  awayLockerCtx.phase="refResult";
  awayLockerCtx.refResult={o, res, line, rel, fan, own, rl, fine, griev, crew};
  saveGame();
  renderAwayLocker();
}
const REF_HEADLINE={
  eyes:`[속보] {t} 감독, 심판 대기실 찾아가 "눈 좀 뜨고 다니시죠" 막말`,
  protest:`{t} 감독, 경기 후 심판 대기실 방문… "연맹에 제소하겠다"`,
  video:`{t} 감독, 심판 대기실에서 휴대폰 들이밀며 판정 항의`,
  chair:`[속보] {t} 감독, 심판 대기실에서 의자 걷어차며 "이게 판정이야?" 고성`,
  stare:`[속보] {t} 감독, 심판 대기실에서 시계 풀고 심판진 위협`,
  chant:`[속보] {t} 감독, 심판 대기실에서 "눈을 떠라 심판" 구호 제창… 연맹 회부 검토`,
  cold:`{t} 감독, 심판 대기실에 얼굴만 비치고 떠나`
};
function refEnter(){
  if(wildOff()){ awaySkip(); return; }
  if(!awayLockerCtx) return;
  if(awayLockerCtx.refDone){ flash("심판 대기실에는 이미 다녀왔습니다.","warn"); renderAwayLocker(); return; }
  awayLockerCtx.crew=refCrewOf(awayLockerCtx.M);
  awayLockerCtx.phase="ref";
  renderAwayLocker();
}
function offerAwayLocker(M, cont){
  const t=userTeam();
  if(!M || !t){ cont(); return; }
  if(wildOff()){ cont(); return; }              // 🎭 돌발 행동 안 함 — 복도는 조용히 지나간다
  const opp = M.home.isUser ? M.away : M.home;
  if(!opp || opp.isUser){ cont(); return; }
  /* ⚠ 제보 — 「EACL만 끝나면 다음으로 안 넘어간다. 라커룸 코멘트 뒤 진행을 누르면 먹통」.
     원인은 여기였다. 대회 상대(고베·상하이 …)는 G.teams 에 없는 「대회 전용 클럽」인데,
     상대 라커룸 화면이 G.teams[oppId] 를 그대로 읽어 undefined 를 만졌다.
     그 직전에 inLockerTalk=true 와 진행 버튼 비활성이 이미 걸린 뒤라, 예외가 나면
     progBusy() 가 영원히 true 로 남아 진행·경기 탭이 통째로 잠겼다(새로고침하면 풀림).
     ─ 복도 건너편 라커룸은 K리그 구단을 상대할 때의 이야기다. 대회 경기에서는 건너뛴다. */
  if(!G.teams[opp.id]){ cont(); return; }
  try{ if(M.opts && M.opts.eacl){ cont(); return; } }catch(e){ cont(); return; }
  const isHome=M.home.isUser;
  const myG=isHome?M.hg:M.ag, oppG=isHome?M.ag:M.hg;
  const outcome = matchOutcome(M, isHome);
  awayLockerCtx={M, oppId:opp.id, outcome, myG, oppG, isHome, phase:"offer", cont};
  renderAwayLocker();
}
function awayCtxInfo(){
  const c=awayLockerCtx; if(!c) return null;
  let opp=G.teams[c.oppId];
  if(!opp){ try{ opp=eaclTeam(c.oppId); }catch(e){ opp=null; } }
  if(!opp) return null;                       // 상대를 못 찾으면 이 화면은 성립하지 않는다
  return Object.assign({}, c, {opp, crew:c.crew||refCrewOf(c.M)});
}
/* 조건(if)을 통과한 선택지만 남긴다 */
function awayOptList(){
  const c=awayCtxInfo(); if(!c) return [];
  return (AWAY_OPTS[c.outcome]||[]).filter(o=>!o.if || o.if(c));
}
function renderAwayLocker(){
  const c=awayCtxInfo();
  /* 그릴 수 없으면 잠그지 말고 그냥 넘어간다 — 여기서 멈추면 게임이 통째로 잠긴다 */
  if(!c){ const k=awayLockerCtx; awayLockerCtx=null; inLockerTalk=false;
    try{ const a=$("#advBtn"); if(a) a.disabled=false; }catch(e){}
    try{ if(k && typeof k.cont==="function") k.cont(); }catch(e){}
    return; }
  inLockerTalk=true;
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  $("#advBtn").disabled=true;
  const opp=c.opp;
  const head=`<div class="msg ${c.outcome==="win"?"good":c.outcome==="loss"?"warn":"info"}">
    ${c.M.home.short} ${c.M.hg} : ${c.M.ag} ${c.M.away.short} — ${c.outcome==="win"?"승리":c.outcome==="draw"?"무승부":"패배"}</div>`;
  // 우리가 원정이면 건너편은 홈팀 라커룸, 우리가 홈이면 원정팀 라커룸이다
  const doorName = c.isHome ? "원정팀" : "홈팀";
  if(c.phase==="offer"){
    $("#main").innerHTML=`<h2>🚪 복도 건너편</h2>
    ${head}
    <div class="card">
      <p>우리 라커룸을 정리하고 나오니, 복도 건너편에 <b>${doorName} 라커룸</b> 문이 보입니다.
      <b style="color:${opp.col==="#000000"?"#e6edf3":opp.col}">${opp.name}</b> 선수단이 그 안에 있습니다.
      찾아가 한마디 남길 수도, 그냥 버스로 향할 수도 있습니다.</p>
      <p class="small">여기서 한 말은 상대 선수들의 <b>감독 호감도</b>에 오래 남습니다 — 나중에 그 선수를 영입할 때 돌아옵니다.
      선을 넘으면 상대 라커룸에 불을 지피고, 그 장면은 곧바로 온라인에 퍼집니다.</p>
      <button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:11px" onclick="awayEnter()">🚪 <b>${opp.short} 라커룸으로 찾아간다</b></button>
      <button class="mini" style="display:block;width:100%;text-align:left;padding:11px" onclick="awaySkip()">🚌 그냥 버스로 향한다</button>
    </div>`;
    return;
  }
  if(c.phase==="ref"){
    const crew=c.crew, S=refState(), griev=refGrievance(c.M, c.isHome);
    const opts=refOptList();
    const gLabel = griev>=3 ? `<span style="color:var(--red)">오늘 판정, 명백히 손해를 봤습니다 (+${griev})</span>`
                 : griev>=1 ? `<span style="color:var(--gold)">아쉬운 장면이 있었습니다 (+${griev})</span>`
                 : griev<=-2 ? `<span style="color:var(--green)">오히려 덕을 본 경기였습니다 (${griev})</span>`
                 : `특별히 문제 될 장면은 없었습니다`;
    const relC = S.rel>=20?"var(--green)" : S.rel<=-20?"var(--red)" : "var(--gold)";
    $("#main").innerHTML=`<h2>🧑‍⚖️ 심판 대기실</h2>
    ${head}
    <div class="card">
      <p>문을 여니 세 사람이 짐을 챙기고 있습니다.</p>
      <div class="msg info" style="margin:8px 0">
        🧑‍⚖️ 주심 <b>${crew.main.n}</b> <span class="tag" title="${crew.main.t.d}">${crew.main.t.n}</span><br>
        <span class="small">🚩 대기심 ${crew.ar.n} · 📺 VAR ${crew.var_.n}</span>
      </div>
      <p class="small">· 오늘 판정 체감: ${gLabel}<br>
        · 심판진과의 관계: <b style="color:${relC}">${S.rel>0?"+":""}${S.rel}</b>
        <span class="small">(애매한 장면에서 조금씩 작용합니다)</span></p>
      ${opts.map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px${o.danger?";border-color:var(--red);color:#ff9d95":""}" onclick="refSay(${i})">${o.t}${o.danger?' <span class="tag inj">위험</span>':""}</button>`).join("")}
      <button class="mini" style="display:block;width:100%;text-align:left;padding:9px;margin-top:4px" onclick="awayLockerCtx.phase='offer';renderAwayLocker()">↩ 그냥 나온다</button>
    </div>`;
    return;
  }
  if(c.phase==="refResult"){
    const r=c.refResult||{}, o=r.o||{};
    const fx=[];
    if(r.rel) fx.push(`심판진 관계 ${r.rel>0?"+":""}${r.rel} <span class="small">(누적 ${refState().rel})</span>`);
    if(r.fan) fx.push(`팬 신뢰 ${r.fan>0?"+":""}${r.fan}`);
    if(r.own) fx.push(`구단주 신뢰 ${r.own>0?"+":""}${r.own}`);
    if(r.rl)  fx.push(`언론 관계 ${r.rl>0?"+":""}${r.rl}`);
    if(r.fine) fx.push(`제재금 -${r.fine}억 <span class="small">(보유 ${me().cash.toFixed(2)}억)</span>`);
    $("#main").innerHTML=`<h2>🧑‍⚖️ 심판 대기실</h2>
    ${head}
    <div class="card">
      <div class="msg ${o.g==="good"?"good":"warn"}" style="border-width:2px;white-space:pre-line">${o.d||""}</div>
      <p style="margin:10px 0"><b>💬 ${r.line||""}</b></p>
      ${fx.length?`<div class="msg info"><b>결과</b><br>${fx.join(" · ")}</div>`:""}
      ${o.k==="chant"?`<div class="msg warn" style="border-width:2px">👏 <b>구호가 대기실 밖 복도까지 새어 나갔습니다.</b> 오늘 밤 이 장면이 온라인을 덮을 겁니다.</div>`:""}
      ${o.k==="slap"?`<div class="msg warn" style="border-width:2px">🚨 <b>경찰이 출동해 진술을 받아 갔습니다.</b> 연맹은 긴급 상벌위를 예고했고, 구단주는 이사회를 소집했습니다.\n심판진과의 관계는 회복 불가능한 수준(-100)이 됐습니다. 앞으로 모든 애매한 판정이 상대 쪽으로 기웁니다.</div>`:""}
      <button class="mini" style="display:block;width:100%;padding:11px;margin-top:8px" onclick="awayLockerCtx.phase='offer';renderAwayLocker()">↩ 복도로 나온다</button>
    </div>`;
    return;
  }
  if(c.phase==="options"){
    const opts=awayOptList();
    $("#main").innerHTML=`<h2>🚪 ${opp.name} 라커룸</h2>
    ${head}
    <div class="card"><p>문을 열자 ${opp.short} 선수들이 일제히 고개를 듭니다.${(()=>{
        const oc=COACHES[opp.id];
        return oc ? ` 안쪽 벤치에는 <b>${oc.n} 감독</b>이 팔짱을 낀 채 앉아 있습니다.` : "";
      })()} 무슨 말을 남기시겠습니까?</p>
      ${opts.map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px${o.danger?";border-color:var(--red);color:#ff9d95":""}" onclick="awaySay(${i})">${awayOptText(o)}</button>`).join("")}
      <!-- 아무 말도 남기지 않고 물러날 수 있다. 문만 열었다 닫은 것이므로 다시 들어올 수 있다. -->
      <button class="mini" style="display:block;width:100%;text-align:left;padding:9px;margin-top:4px" onclick="awayLockerCtx.phase='offer';renderAwayLocker()">↩ 그냥 나온다</button>
    </div>`;
    return;
  }
  if(c.phase==="pick"){
    const o=c.pickOpt||{};
    const roster=awayRoster();
    const row=(x)=>{
      const p=x.p, mins=x.mins;
      return `<button class="mini awayPickRow" onclick="awayPick(${p.id})">
        <span class="apNo">${p.no||"-"}</span>
        <b class="pos-${p.pos}">${nmF(p)}</b>
        <span class="apMeta">${p.pos} · ${G.season-p.by}세 · ${abilityStars(p)}</span>
        <span class="apStat">${x.played?`평점 <b>${(x.rating||0).toFixed(2)}</b>${x.goals?` · ⚽${x.goals}`:""}${x.assists?` · 🅰️${x.assists}`:""} · ${mins}분`:"결장"}</span>
      </button>`;
    };
    const played=roster.filter(x=>x.played), bench=roster.filter(x=>!x.played);
    $("#main").innerHTML=`<h2>🚪 ${opp.name} 라커룸 — 대상 선택</h2>
    ${head}
    <div class="card">
      <p>${o.pick==="jersey"
         ? `가방에서 <b>${t2().short}</b> 유니폼을 꺼냈습니다. 누구에게 입히시겠습니까?`
         : o.pick==="stare"
         ? `시계를 풀 참입니다. <b style="color:#ff9d95">누구 앞에 서시겠습니까?</b>`
         : o.pick==="bottle"
         ? `손에 물병이 들려 있습니다. <b style="color:#ff9d95">누구에게 던지시겠습니까?</b>`
         : `누구에게 말을 거시겠습니까?`}</p>
      ${o.pick==="jersey"?`<p class="small" style="color:#ff9d95">⚠️ 남의 라커룸에서 벌이는 일입니다. 상대 구단은 물론 우리 구단주도 가만있지 않을 겁니다.</p>`:""}
      ${o.pick==="bottle"?`<p class="small" style="color:#ff9d95">⚠️ 사람에게 물건을 던지는 행위입니다. 맞은 선수가 다칠 수도 있고, 연맹 제소로 이어집니다. 되돌릴 수 없습니다.</p>`:""}
      ${o.pick==="stare"?`<p class="small" style="color:#ff9d95">⚠️ 겁을 먹으면 상대 라커룸 전체가 가라앉습니다. 받아치면 정반대가 됩니다. 어린 선수일수록, 용기와 침착함이 낮을수록 흔들립니다.</p>`:""}
      <h4 style="margin:10px 0 4px">⚽ 출전 선수 <span class="small">(${played.length}명)</span></h4>
      <div class="awayPickList">${played.map(row).join("")}</div>
      ${bench.length?`<h4 style="margin:12px 0 4px">🪑 벤치 <span class="small">(${bench.length}명)</span></h4>
      <div class="awayPickList">${bench.map(row).join("")}</div>`:""}
      <button class="mini" style="display:block;width:100%;margin-top:10px;padding:9px" onclick="awayEnter()">↩ 다른 말을 한다</button>
    </div>`;
    return;
  }
  if(c.phase==="reactions"){
    const d=c.result;
    awayReactReady=true;                     // 좌측 진행 버튼이 「계속」을 맡는다
    try{ applyNavLock(); }catch(e){}
    $("#main").innerHTML=`<div class="reactTop">
      <h2 style="margin:0">🚪 ${opp.name} 라커룸</h2>
      <span class="small" style="color:var(--sub)">👈 왼쪽 <b>계속 ▶</b> 버튼으로 진행</span>
    </div>
    <div class="msg ${d.cls}" style="font-size:14px">${d.said}</div>
    <div class="card"><p>${d.desc}</p>
      <div class="small" style="margin-top:6px;color:#c9d4e0">${d.fx}</div></div>
    ${d.target?`<div class="card awayTargetCard">
      <h3>🎯 ${d.target.p.name} <span class="small">(${d.target.p.pos} · ${G.season-d.target.p.by}세 · ${opp.short})</span></h3>
      <div class="awayTargetLine">${d.target.line}</div>
      <div class="small" style="margin-top:6px">감독 호감도 ${d.target.delta>0?`<b style="color:var(--green)">▲${d.target.delta}</b>`:d.target.delta<0?`<b style="color:var(--red)">▼${Math.abs(d.target.delta)}</b>`:"±0"}
        <span style="color:var(--sub)"> · 현재 ${affLabel(aff(d.target.p))}</span></div>
    </div>`:""}
    <div class="card"><h3>${opp.short} 선수단 반응 <span class="small">(${d.rows.length}명)</span></h3>
      <div class="reactGrid">${d.rows.map(renderPlayerReactionRow).join("")}</div></div>`;
    return;
  }
}
function t2(){ return userTeam(); }
/* 상대 라커룸 안에 있는 사람들 — 출전 선수(평점·기록 포함) + 벤치 */
function awayRoster(){
  const c=awayCtxInfo(); if(!c) return [];
  const sd = c.M.home.isUser ? c.M.a : c.M.h;
  const out=[];
  const seen={};
  if(sd){
    for(const x of sd.list){
      if(!x.p || seen[x.p.id]) continue; seen[x.p.id]=1;
      const mins=(x.off===null?c.M.min:x.off)-x.on;
      out.push({p:x.p, played:true, mins:Math.max(0,mins), goals:x.goals||0, assists:x.assists||0,
                rating:x.p.seasonRating||6.0, x});
    }
    for(const p of (sd.bench||[])){ if(!p||seen[p.id]) continue; seen[p.id]=1; out.push({p, played:false, mins:0, goals:0, assists:0, rating:0}); }
  }
  if(!out.length) for(const p of c.opp.players.slice(0,18)) out.push({p, played:false, mins:0, goals:0, assists:0, rating:0});
  out.sort((a,b)=> (b.played?1:0)-(a.played?1:0) || b.goals-a.goals || b.rating-a.rating || b.p.ovr-a.p.ovr);
  return out;
}
/* 오늘 상대 팀 최고 평점 선수 — 경기 내 기여도(골·도움·출전시간)로 뽑는다 */
function awayManOfMatch(){
  const list=awayRoster().filter(x=>x.played);
  if(!list.length) return null;
  const score=(x)=> (x.goals*3.2)+(x.assists*1.8)+(x.mins/90)*1.0+(x.p.ovr/100)*1.2+(x.rating-6)*0.8;
  return [...list].sort((a,b)=>score(b)-score(a))[0];
}
/* ── 지목당한 선수 개인 반응 ────────────────────────────────
   같은 칭찬도 누가 하느냐에 따라 다르게 들린다. 우리 구단이 상대보다 크면 "관심"으로 읽히고,
   한참 작으면 "그쪽이 뭐라고"가 된다. 여기에 선수의 성격·나이·오늘 결과가 겹친다. */
function clubWeight(t){
  // 구단 체급 — 리그, 팬 규모, 연봉 총액을 한 숫자로 압축
  return (t.div===1?18:0) + (t.fans||20)*0.45 + Math.min(40, totalWage(t)*0.22);
}
const AWAY_TGT={
 /* ⌚ 지목당한 선수 본인의 반응 — 겁을 먹은 쪽(아래로 갈수록)과 맞받은 쪽(위) */
 stare:{
  honored:["😐 {p}, 무슨 상황인지 이해를 못 한 표정으로 감독을 봅니다.",
           "😐 {p}, 어색하게 웃습니다. \"…뭐 하시는 겁니까?\""],
  pleased:["🙃 {p}, 피식 웃고는 신발끈을 마저 묶습니다.",
           "🙃 {p}: \"시계 좋은 거 차셨네요.\""],
  polite: ["🙂 {p}, 눈만 한 번 마주치고 조용히 자리에 앉았습니다.",
           "🙂 {p}, 아무 말 없이 수건을 집어 들었습니다."],
  flat:   ["😶 {p}, 감독을 지나쳐 샤워실로 걸어갔습니다.",
           "😶 {p}, 표정 하나 바뀌지 않았습니다."],
  suspicious:["😠 {p}, 턱을 들고 마주 봅니다. \"지금 저한테 뭐 하시는 겁니까.\"",
           "😠 {p}, 주먹을 쥐었다 폈습니다. 옆에서 주장이 팔을 잡습니다.",
           "😠 {p}: \"카메라 없는 데서만 이러시는군요.\""],
  offended:["😰 {p}, 눈을 먼저 피했습니다. 손끝이 떨리는 게 보였습니다.",
           "😰 {p}, 아무 말도 못 하고 그대로 굳었습니다.",
           "😰 {p}, 고개를 숙인 채 라커 안쪽으로 물러섰습니다.",
           "😰 {p}, 유니폼을 벗다 말고 멈췄습니다. 동료들이 대신 감독을 노려봅니다."]},
 praise:{
  honored:["😭 {p}, 눈이 커지더니 벌떡 일어나 고개를 숙입니다. \"…감사합니다, 정말로.\"",
           "😭 {p}: \"저 팀 감독님한테 이런 말을 들을 줄은 몰랐습니다.\"",
           "😭 {p}, 동료들이 등을 두드리자 쑥스럽게 웃습니다."],
  pleased:["😊 {p}, 씩 웃으며 손을 내밉니다. \"좋게 봐주셔서 감사합니다.\"",
           "😊 {p}: \"다음엔 더 잘하겠습니다.\" 자신감이 붙은 표정입니다.",
           "😊 {p}, 기분 좋은 듯 유니폼을 툭툭 텁니다."],
  polite: ["🙂 {p}, 짧게 목례합니다. \"감사합니다.\"",
           "🙂 {p}, 예의는 갖췄지만 표정 변화는 크지 않습니다.",
           "🙂 {p}: \"팀이 이긴 게 더 중요하죠.\""],
  flat:   ["😐 {p}, 별 감흥 없이 고개만 까딱합니다.",
           "😐 {p}, 짐을 챙기며 \"아, 네\" 하고 지나갑니다.",
           "😐 {p}, 이미 다음 경기 생각을 하는 얼굴입니다."],
  suspicious:["🤨 {p}, 눈을 가늘게 뜹니다. \"…그 말씀, 무슨 뜻으로 하시는 겁니까?\"",
           "🤨 {p}, 옆의 코치를 힐끗 봅니다. 탬퍼링을 의심하는 표정입니다.",
           "🤨 {p}: \"칭찬은 감사한데, 여기서 하실 말씀은 아닌 것 같은데요.\""],
  offended:["😒 {p}, 코웃음을 칩니다. \"지금 놀리시는 겁니까?\"",
           "😒 {p}, 대꾸도 없이 등을 돌립니다.",
           "😒 {p}: \"됐습니다. 그런 말 듣자고 뛰는 거 아닙니다.\""]},
 scout:{
  honored:["🤩 {p}, 얼굴이 환해집니다. \"…진심이시면, 언제든 연락 주십시오.\"",
           "🤩 {p}, 주변 눈치를 보면서도 입꼬리를 감추지 못합니다.",
           "🤩 {p}: \"솔직히 그 팀 축구, 계속 보고 있었습니다.\""],
  pleased:["😏 {p}, 웃으며 받아칩니다. \"조건만 맞으면 못 갈 것도 없죠.\"",
           "😏 {p}, 농담처럼 넘기지만 눈빛은 진지합니다.",
           "😏 {p}: \"에이전트 번호 드릴까요?\""],
  polite: ["🙂 {p}, 정중하게 웃습니다. \"영광이지만 여긴 제 팀입니다.\"",
           "🙂 {p}: \"좋게 봐주셔서 감사합니다. 그건 구단끼리 하실 얘기죠.\""],
  flat:   ["😐 {p}, 짧게 웃고는 다시 신발끈을 묶습니다.",
           "😐 {p}, 대꾸 없이 어깨만 으쓱합니다."],
  suspicious:["🤨 {p}, 주위를 둘러봅니다. \"…이거 녹음되고 있는 거 아니죠?\"",
           "🤨 {p}: \"이런 얘기 여기서 하시면 저희 감독님이 가만 안 계실 텐데요.\""],
  offended:["😠 {p}, 정색합니다. \"제 앞에서 그런 말씀 하지 마십시오.\"",
           "😠 {p}, 유니폼을 움켜쥡니다. \"저 여기서 은퇴할 겁니다.\"",
           "😠 {p}: \"방금 그 말, 저희 구단에 그대로 전하겠습니다.\""]},
 jersey:{
  honored:["😆 {p}, 어이없어하다가 결국 웃음을 터뜨립니다. \"…이거 사이즈는 맞네요?\"",
           "😆 {p}, 유니폼을 들어 보이며 동료들에게 장난을 칩니다. 라커룸에 웃음이 번집니다."],
  pleased:["😅 {p}, 황당해하면서도 유니폼을 접어 가방에 넣습니다. \"기념으로 갖고 있겠습니다.\"",
           "😅 {p}, 웃으며 고개를 젓습니다. \"감독님 진짜 대단하시네요.\""],
  polite: ["😳 {p}, 뭐라 말도 못 하고 유니폼을 조심스럽게 벗어 건넵니다.",
           "😳 {p}, 당황한 채 코칭스태프 쪽만 바라봅니다."],
  flat:   ["😑 {p}, 말없이 유니폼을 벗어 바닥에 내려놓습니다.",
           "😑 {p}, 표정 하나 안 바꾸고 옷을 갈아입습니다."],
  suspicious:["🤨 {p}, 유니폼을 밀쳐냅니다. \"이거 나중에 문제 되는 거 아닙니까?\"",
           "🤨 {p}, 곧바로 휴대폰을 꺼내 상황을 촬영하기 시작합니다."],
  offended:["🤬 {p}, 유니폼을 바닥에 내동댕이치고 감독의 멱살을 잡으려 합니다!",
           "🤬 {p}: \"지금 사람 뭐로 보는 겁니까!\" 라커룸이 뒤집혔습니다.",
           "🤬 {p}, 유니폼을 찢어버렸습니다. 스태프가 달려들어 뜯어말립니다."]},
 bottle:{
  polite: ["😳 {p}, 물병을 맞고도 한동안 아무 반응을 못 합니다. 그냥 얼어붙었습니다.",
           "😳 {p}, 이마를 문지르며 \"…왜 그러세요\"라고 겨우 한마디 합니다.",
           "😳 {p}, 믿기지 않는다는 표정으로 감독과 바닥의 물병을 번갈아 봅니다."],
  flat:   ["😑 {p}, 맞은 자리를 손으로 툭 털고는 말없이 짐을 챙깁니다.",
           "😑 {p}, 물병을 발로 밀어내고 등을 돌렸습니다. 대꾸할 가치도 없다는 태도입니다.",
           "😑 {p}, 표정 하나 바꾸지 않고 감독을 지나쳐 샤워실로 들어갑니다."],
  suspicious:["🤨 {p}, 곧바로 휴대폰을 꺼내 맞은 부위와 감독을 번갈아 촬영합니다.",
           "🤨 {p}, 코치를 부릅니다. \"이거 기록해 두세요. 증인도 스무 명입니다.\"",
           "🤨 {p}, 바닥의 물병을 조심스럽게 집어 비닐봉지에 담았습니다."],
  offended:["🤬 {p}, 맞은 자리를 감싸 쥐고 그대로 감독에게 달려들었습니다!",
           "🤬 {p}: \"미쳤습니까?! 사람한테 이걸 던져요?!\" 라커룸이 완전히 뒤집혔습니다.",
           "🤬 {p}, 동료 넷이 붙잡지 않았다면 정말 큰일이 났을 겁니다.",
           "🤬 {p}, 눈이 벌겋게 달아오른 채 \"법적으로 갑니다\"라고 내뱉었습니다."],
  honored:["😔 {p}, 어이가 없어 웃어버렸습니다. \"…이걸 제가 맞네요.\"",
           "😔 {p}, 물병을 주워 감독에게 정중히 돌려줍니다. \"목마르셨나 봐요.\""],
  pleased:["😐 {p}, 한숨을 크게 쉬고는 고개를 젓습니다. \"됐습니다. 그만하시죠.\"",
           "😐 {p}, 화를 참으며 동료들을 먼저 진정시킵니다."]}
};
function awayTargetReact(p, kind, ctx){
  const t=userTeam(), opp=ctx.opp;
  const my=clubWeight(t), th=clubWeight(opp);
  // 체급 차이는 -1~+1로 눌러 둔다. 이게 없으면 하위 구단 선수는 100% 감격, 상위 구단 선수는 100% 불쾌로 굳어 버린다.
  const gap=clamp((my-th)/Math.max(30,(my+th)/2), -1, 1);
  const pers=p.pers||0;                     // 0프로 1야심 2온화 3다혈질
  const age=G.season-p.by;
  const a=aff(p);
  // 점수가 높을수록 좋게 받아들인다
  let s = gap*2.4;
  s += pers===1 ? 1.6 : pers===2 ? 0.8 : pers===3 ? -1.4 : 0;   // 야심가는 큰 팀 관심을 반긴다
  s += age<=22 ? 1.2 : age>=32 ? -0.6 : 0;                       // 어린 선수일수록 크게 받아들인다
  s += (a-AFF_DEF)/16;                                            // 원래 감독을 어떻게 보고 있었나
  s += ctx.outcome==="loss" ? -0.8 : ctx.outcome==="win" ? 0.4 : 0;  // 진 팀 감독의 말은 가볍게 들린다
  s += (Math.random()*3.2-1.6);
  if(kind==="praise") s += 1.1;            // 순수한 칭찬은 체급이 달라도 기본적으로는 기분 좋은 말이다
  if(kind==="scout"){
    s -= 0.6;                              // 남의 라커룸에서 대놓고 하는 영업은 원래 무례하다
    if(p.ct>=3) s -= 1.0;                  // 계약 기간이 길게 남았으면 더 불쾌해한다
    if(p.unhappy>0) s += 2.4;              // 지금 불만이 있는 선수라면 귀가 솔깃하다
    if(p.morale<50) s += 1.0;              // 사기가 바닥이면 다른 데를 기웃거린다
  }
  if(kind==="jersey"){
    s = s*0.45 - 2.2;                      // 무슨 사정이 있어도 이건 무례한 짓이다
    if(pers===2) s -= 0.8;                 // 온화한 선수는 이런 상황을 특히 못 견딘다
    if(pers===1) s += 0.9;                 // 야심가는 "관심"으로 읽어 웃어넘기기도 한다
    if(p.unhappy>0) s += 1.8;
  }
  if(kind==="stare"){
    /* 눈이 마주친 순간의 판정을 그대로 쓴다 — 겁을 먹었으면 오그라들고, 아니면 맞받는다 */
    const od=(ctx && ctx.stareRes) ? ctx.stareRes : awayStareOutcome(p, ctx);
    s = od.scared ? -3.2 : (Math.random()<0.6 ? -1.8 : 0.6);
  }
  if(kind==="bottle"){
    // 물병을 맞고 좋아할 사람은 없다. 갈리는 건 "폭발하느냐 / 삼키느냐 / 증거를 챙기느냐"뿐이다.
    s = s*0.20 - 2.3;
    if(pers===3) s -= 1.6;                 // 다혈질 — 바로 달려든다
    if(pers===0) s += 1.0;                 // 프로페셔널 — 감정보다 절차를 먼저 생각한다
    if(pers===2) s += 0.4;                 // 온화 — 얼어붙거나 참는다
    if((p.attr&&attr20(p.attr.agg)>=15)) s -= 0.8;   // 공격성이 높은 선수일수록 크게 터진다
  }
  const cat = s>=3.0?"honored" : s>=1.4?"pleased" : s>=0.2?"polite" : s>=-1.0?"flat"
            : s>=-2.4?"suspicious" : "offended";
  const line=pick(AWAY_TGT[kind][cat]||AWAY_TGT[kind].polite).replace("{p}", p.name);
  // 반응 계열별 호감도 변화 — 유니폼 사건은 웃어넘긴 경우에만 아주 조금 플러스가 난다
  const TBL={
    praise:{honored:15, pleased:11, polite:6, flat:2, suspicious:-6, offended:-13},
    scout: {honored:14, pleased:9,  polite:4, flat:1, suspicious:-8, offended:-18},
    jersey:{honored:6,  pleased:2,  polite:-12, flat:-18, suspicious:-26, offended:-38},
    bottle:{honored:-14, pleased:-20, polite:-30, flat:-36, suspicious:-44, offended:-60},
    stare: {honored:-8,  pleased:-10, polite:-16, flat:-20, suspicious:-28, offended:-34}
  };
  const d=(TBL[kind]||TBL.praise)[cat]||0;
  const why = kind==="praise"?"상대 감독의 칭찬" : kind==="scout"?"상대 감독의 영입 제안"
            : kind==="jersey"?"유니폼 강제 착용" : kind==="stare"?"상대 감독의 위협" : "물병에 맞음";
  affAdd(p, d, why);
  // 물병에 맞으면 다칠 수도 있다 — 감독이 상대 선수를 결장시키는 최악의 방법
  let hurt=0;
  /* 🚑 배선 — 경기 밖 사고도 유형을 갖는다 (요청) */
  if(kind==="bottle" && Math.random()<0.15){ hurt=1;
    try{ mkInjury(p, {cause:"off", fit:p.cond||90, age:G.season-(p.by||2000)}); }
    catch(e){ try{ setInjury(p, Math.max(injWeeksLeft(p), 1)); }catch(e2){ p.inj=Math.max(p.inj||0, 1); } } }
  return {p, cat, line, delta:d, kind, hurt};
}
function awaySkip(){
  const c=awayLockerCtx; if(!c) return;
  awayLockerCtx=null; inLockerTalk=false;
  const cont=c.cont; if(cont) cont();
}
function awayEnter(){
  if(wildOff()){ awaySkip(); return; }
  if(!awayLockerCtx) return;
  awayLockerCtx.phase="options";
  renderAwayLocker();
}
function awaySay(i){
  const c=awayCtxInfo(); if(!c) return;
  const o=awayOptList()[i]; if(!o) return;
  // 대상을 골라야 하는 선택지는 선수 목록부터 띄운다 (확인창은 대상을 고른 뒤에)
  if(o.pick){ awayLockerCtx.pickOpt=o; awayLockerCtx.phase="pick"; renderAwayLocker(); return; }
  if(o.danger){
    /* ⚠ 확인 문구가 물병으로 고정돼 있었다. 선택지마다 다른 말이 나가야 한다. */
    const box = o.k==="chair"
      ? [`🪑 정말 ${c.opp.short} 라커룸에서 의자를 걷어차시겠습니까?\n\n`+
         `남의 집에서 벌이는 일입니다. 기물 파손으로 제재금이 나오고,\n`+
         `상대가 우습게 보면 오히려 사기를 올려 주는 꼴이 됩니다.\n\n`+
         `<span class="small">통하면 상대 라커룸이 무너지고, 안 통하면 전원이 각성합니다.</span>`, "걷어찬다"]
      : [`🍾 정말 상대 선수에게 물병을 던지시겠습니까?!\n\n리그 차원의 징계는 물론 팬·구단주 신뢰도가 폭락하고,\n그 장면은 오늘 밤 내내 온라인에서 재생됩니다.`, "투척"];
    showConfirm(box[0], ()=>applyAwayLocker(o), {okLabel:box[1], cancelLabel:"그만둔다", danger:true});
    return;
  }
  applyAwayLocker(o);
}
/* 선수 목록에서 대상을 골랐다 */
function awayPick(pid){
  const c=awayCtxInfo(); if(!c||!c.pickOpt) return;
  const o=c.pickOpt;
  const p=(awayRoster().find(x=>x.p.id===pid)||{}).p;
  if(!p) return;
  if(o.k==="jersey"){
    showConfirm(`👕 정말 ${p.name} 선수에게 ${userTeam().short} 유니폼을 강제로 입히시겠습니까?!\n\n상대 구단의 공식 항의는 물론, 우리 구단주 신뢰도가 크게 떨어집니다.\n그 장면은 오늘 밤 내내 온라인에서 돌아다닐 겁니다.`,
      ()=>applyAwayLocker(o, p), {okLabel:"입힌다", danger:true});
    return;
  }
  if(o.k==="stare"){
    const od=awayStareOutcome(p, c);
    showConfirm(`⌚ <b>${p.name}</b> 앞에서 시계를 풀고 셔츠를 열어젖히시겠습니까?\n\n`+
      `말은 한마디도 하지 않습니다. 눈만 마주칩니다.\n\n`+
      `· 이 선수가 겁을 먹을 가능성: <b style="color:${od.chance>=0.55?"var(--green)":od.chance>=0.35?"var(--gold)":"var(--red)"}">${Math.round(od.chance*100)}%</b>\n`+
      `· 겁을 먹으면 <b>${c.opp.short} 라커룸 전체가 가라앉습니다</b>\n`+
      `· 받아치면 <b style="color:var(--red)">역효과</b> — 상대 사기가 오히려 치솟습니다\n\n`+
      `<span class="small">어느 쪽이든 팬·구단주 신뢰와 언론 관계는 깎입니다. 카메라가 없어도 이 장면은 반드시 새어 나갑니다.</span>`,
      ()=>applyAwayLocker(o, p), {okLabel:"⌚ 시계를 푼다", cancelLabel:"그만둔다", danger:true});
    return;
  }
  if(o.k==="bottle"){
    showConfirm(`🍾 정말 ${p.name} 선수에게 물병을 던지시겠습니까?!\n\n사람에게 물건을 던지는 행위입니다. 상대 구단은 연맹에 제소할 것이고,\n팬·구단주 신뢰도가 폭락하며 감독 커리어 자체가 흔들릴 수 있습니다.\n맞은 선수가 다칠 수도 있습니다.`,
      ()=>applyAwayLocker(o, p), {okLabel:"투척", danger:true});
    return;
  }
  applyAwayLocker(o, p);
}
/* 도발이 통했는가, 오히려 불을 붙였는가.
   예전에는 적대적 선택지가 예외 없이 상대 사기를 올렸다(om 이 전부 양수). 그래서
   "도발해서 흔든다"는 선택 자체가 존재하지 않았고, 결과가 뻔해 고를 이유가 없었다.
   이제 주사위를 굴린다 — 리더십·팀워크·승부욕이 높고 사기가 살아 있는 팀은 뭉치고,
   대패한 뒤 흔들리는 팀은 진짜로 무너진다. 감독 호감도는 어느 쪽이든 떨어진다. */
/* ⌚ 시계 풀고 노려보기 — 팀 평균이 아니라 '눈이 마주친 그 선수' 하나로 갈린다.
   겁을 먹으면 라커룸 전체가 가라앉고, 받아치면 스무 명이 한꺼번에 등을 켠다. */
function awayStareOutcome(p, c){
  if(!p) return {scared:false, chance:0};
  const a=p.attr||{}, age=G.season-(p.by||2000);
  const A=k=>a[k]!=null?attr20(a[k]):10;
  /* ⚠ 기준점을 10으로 잡았더니 웬만한 프로는 전부 하한(5%)에 붙어, 열아홉 살 말고는
     아무에게도 안 통하는 선택지가 됐다. 1군 평균에 가까운 12를 중심으로 다시 잡는다. */
  let scare = 0.52
    - (A("bra")-12)*0.035          // 용감한 선수는 눈을 안 피한다
    - (A("cmp")-12)*0.028          // 침착함
    - (A("ldr")-12)*0.024          // 라커룸에서 목소리를 내는 사람
    - (A("det")-12)*0.016
    - (A("agg")-12)*0.014;         // 거친 선수는 오히려 달려든다
  scare += age<=20 ? 0.20 : age<=22 ? 0.12 : age<=25 ? 0.03 : age>=31 ? -0.14 : 0;
  scare += (70-(p.morale||70))*0.005;                 // 이미 무너져 있으면 더 흔들린다
  scare += (p.pers===2 ? 0.10 : p.pers===3 ? -0.14 : p.pers===1 ? -0.06 : 0);
  if(c){
    if(c.myG-c.oppG>=3) scare+=0.12;                  // 대패한 라커룸
    if(c.oppG>c.myG)    scare-=0.16;                  // 이긴 팀에게는 안 먹힌다
    if((c.opp&&c.opp.morale||70)>=80) scare-=0.08;
  }
  try{ scare += clamp((mgrPrestige()-20)/300, -0.03, 0.08); }catch(e){}   // 위신 있는 감독의 눈빛은 다르다
  scare=clamp(scare, 0.08, 0.88);
  return {scared:Math.random()<scare, chance:scare};
}
function awayTauntOutcome(o, c){
  if(!o || !/^(taunt|insult|bottle|jersey|chair)$/.test(o.tone||"")) return null;
  const opp=c.opp;
  const sd = c.M.home.isUser ? c.M.a : c.M.h;
  const roster=((sd?sd.list.map(x=>x.p):null) || opp.players || []).filter(Boolean);
  const avg=k=>roster.length ? roster.reduce((s,p)=>s+(p.attr?attr20(p.attr[k]):10),0)/roster.length : 10;
  let unite = 0.18
    + (avg("ldr")-10)*0.030      // 라커룸에 목소리 내는 사람이 있으면 뭉친다
    + (avg("tea")-10)*0.026
    + (avg("det")-10)*0.018
    + ((opp.morale||70)-70)*0.006;
  if(c.oppG>c.myG)          unite+=0.10;   // 이긴 팀은 여유 있게 받아친다
  if((c.myG-c.oppG)>=3)     unite-=0.20;   // 대패한 뒤에는 반박할 힘이 없다
  if(o.tone==="bottle")     unite+=0.32;   // 물병은 그냥 전원 각성이다
  else if(o.tone==="jersey")unite+=0.18;
  /* 의자를 걷어차는 건 자기 팀에 하는 짓이다. 남의 라커룸에서 하면 대개 우습게 본다. */
  else if(o.tone==="chair"){ unite+=0.12; if(c.oppG>c.myG) unite+=0.14; }
  unite=clamp(unite, 0.08, 0.94);
  return {unite:Math.random()<unite, p:unite};
}
/* 🤕 감독 부상 — 난투극에 휘말리면 전치 O주. 그동안 수석코치가 팀을 맡는다. */
/* 🚑 ⚠ 요청 — 「예능모드 난투극과 현재 부상 로직, 팀닥터 로직과 잘 배선되는지 확인해줘」.
   확인해 보니 감독 부상은 선수 부상 체계와 완전히 따로 놀고 있었다 — 진단명도 없고,
   구단 의무팀이 감독은 보지 않았다. 사람이 다친 건 같은데 팀 닥터가 손을 못 대는 건 이상하다.
   ─ 감독에게도 진단명을 붙이고, 회복 기간을 팀 닥터의 의료·재활 능력이 당기게 한다.
     팀 닥터가 없으면 오히려 길어진다(선수 부상과 같은 규칙). */
const MGR_INJ_T=[
  {n:"코뼈 골절",   ic:"🤕"}, {n:"안와 골절",     ic:"🤕"}, {n:"손목 인대 손상", ic:"🖐️"},
  {n:"갈비뼈 골절", ic:"🩻"}, {n:"어깨 탈구",     ic:"💪"}, {n:"무릎 타박상",   ic:"🦵"},
  {n:"열상·봉합",   ic:"🩹"}, {n:"뇌진탕 의심",   ic:"🧠"}, {n:"허리 염좌",     ic:"🧎"}
];
/* 의무팀이 감독 회복을 얼마나 당기는가 — 선수 부상(injTreat)과 같은 눈금을 쓴다 */
function mgrInjDocK(){
  try{
    if(!docOf()) return 1.22;                       // 팀 닥터 공석 — 회복이 늦다
    const q=((docMed()|0)+(docReh()|0))/2;
    return clamp(1.16 - (q-10)*0.030, 0.66, 1.16);  // 10 기준 · 20이면 약 0.86배
  }catch(e){ return 1; }
}
function mgrInjure(weeks, why){
  /* 🚑 요청(배선) — 구단 의무팀이 감독도 본다 */
  const _k=mgrInjDocK();
  const w=clamp(Math.round((weeks||1)*_k), 1, 12);   // 전치는 최대 12주 — 그 이상은 감독직 자체가 위태롭다
  const _T=pick(MGR_INJ_T);
  /* ⚠ 제보 — 「감독 부상 회복기간이 55주로 잡히고 병실에만 있게 된다」.
     예전에는 회복일을 「오늘(G.day) + 주수×7」이라는 절대 날짜로 박아 뒀다.
     G.day 는 시즌이 바뀔 때마다 0 으로 되돌아가는 값이다. 그래서 시즌 막바지(day 300 부근)에
     다치면, 새 시즌이 열리는 순간 남은 기간이 (300+21)/7 ≈ 46주로 튀어 올랐다.
     ─ 남은 일수를 들고 하루씩 줄인다. 달력이 새로 깔려도 흔들리지 않는다. */
  G.mgrInj={left:w*7, weeks:w, why:why||"", s:G.season, t:_T.n, ic:_T.ic};
  const t=userTeam();
  const _doc=(function(){ try{ const c=docOf();
    return c ? `<span class="small">${c.n} 팀 닥터가 직접 봤습니다.</span>`
             : `<span class="small" style="color:var(--red)">팀 닥터가 공석이라 외부 병원에 맡겼습니다 — 회복이 더딥니다.</span>`;
    }catch(e){ return ""; } })();
  addNews(`🚑 [속보] ${t?t.short:""} 감독, ${why||"충돌"}로 ${_T.ic} <b>${_T.n}</b> — <b>전치 ${w}주</b>. 회복까지 ${acTitle()}가 팀을 지휘합니다`,"warn","club");
  notify(`🚑 ${_T.ic} <b>${_T.n}</b> — <b>전치 ${w}주</b> 진단입니다. 회복할 때까지 <b>${acTitle()}가 대신 팀을 지휘</b>합니다.<br>${_doc}`,"warn");
  addMood(`🚑 감독이 병원에 실려 갔습니다 — ${_T.n}. 라커룸이 뒤숭숭합니다. (전치 ${w}주)`);
  /* 🚑 ⚠ 예전에는 여기서 delegatePre 를 켜고 복귀할 때 껐다. 이제 그 값은 「감독이 정한
     경기 운영 방침」이라 부상이 마음대로 만지면 안 된다 — 부상 중 대행은 mgrInjured() 가
     따로 판정한다(runAdvanceNow). 감독의 설정은 그대로 둔다. (요청) */
  adjustTrust("owner",-8,"감독 부상 — 난투극");
}
/* 남은 회복 기간(주). 옛 세이브(until 방식)도 안전하게 읽는다 — 다만 전치 기간을 넘지 않게 자른다. */
function mgrInjLeft(){
  const I=G.mgrInj; if(!I) return 0;
  let d = (I.left!=null) ? I.left : Math.max(0, (I.until||0)-(G.day||0));
  d = Math.min(d, (I.weeks||1)*7);          // 달력이 바뀌며 부풀어 오른 값 방어
  return d>0 ? Math.ceil(d/7) : 0;
}
function mgrInjured(){ return mgrInjLeft()>0; }
function tickMgrInj(days){
  const I=G.mgrInj; if(!I) return;
  /* 옛 형식(until) 승격 — 부풀어 있을 수 있으므로 전치 기간으로 자른다 */
  if(I.left==null) I.left=Math.min(Math.max(0,(I.until||0)-(G.day||0)), (I.weeks||1)*7);
  I.left=Math.max(0, I.left-Math.max(1, days||1));
  if(I.left<=0){
    const w=G.mgrInj.weeks, _tn=G.mgrInj.t||""; G.mgrInj=null;
    /* 🚑 복귀해도 감독이 정한 「경기 운영」 설정은 건드리지 않는다 (요청) */
    const t=userTeam();
    addNews(`💪 ${t?t.short:""} 감독, ${_tn?_tn+" 회복 — ":""}${w}주 만에 복귀. 다시 벤치에 앉습니다`,"good","club");
    notify(`💪 회복했습니다. 오늘부터 다시 직접 팀을 지휘합니다.`,"good");
    addMood(`💪 감독이 돌아왔습니다. 라커룸에 다시 긴장감이 돕니다.`);
  }
}
/* 라커룸 난투극 — 도발이 선을 넘으면 벌어진다 */
/* 🥊 이 도발이 몸싸움으로 번질 확률 — 말의 수위(tone)가 기준이다.
   선택지에 brawl 을 직접 적어 두면 그 값이 우선한다. */
const BRAWL_BY_TONE={
  bottle:0.62,   // 물병 투척 — 사실상 폭력
  jersey:0.48,   // 유니폼 강제 착용 — 모욕의 정점
  stare:0.44,    // 시계 풀고 위협
  chair:0.40,    // 기물 파손
  insult:0.24,   // 인신·조롱
  taunt:0.18,    // 도발
  mind:0.06,     // 심리전
  praise:0, respect:0, silent:0
};
function brawlChance(o, c){
  let p = (o.brawl!=null) ? o.brawl : (BRAWL_BY_TONE[o.tone]||0);
  if(!p) return 0;
  /* 결과에 따라 공기가 다르다 — 진 팀이 남의 라커룸에서 떠들면 더 험해진다 */
  if(c && c.outcome==="loss") p*=1.25;
  else if(c && c.outcome==="win") p*=0.85;
  /* 감독이 이미 다쳐 있으면 코칭스태프가 먼저 말린다 */
  try{ if(mgrInjured()) p*=0.4; }catch(e){}
  return clamp(p, 0, 0.80);
}
function awayBrawl(o, c){
  _brawlJustNow=true;
  const t=userTeam(), opp=c.opp;
  const oc=COACHES[opp.id];
  const cn=oc?oc.n:"상대 감독";
  const weeks=2+R(7);                       // 전치 2~8주
  const fine=mgrFine(2.0+R(31)/10, "상대 라커룸 난투극");
  adjustTrust("fans",-6,"상대 라커룸 난투극");
  G.press.rel=clamp(G.press.rel-12,0,100);
  try{ coachRelAdd(opp.id,-30); }catch(e){}
  addNews(`🚨 [속보] ${t.short} 라커룸 난입 후 몸싸움 — ${cn} 감독과 뒤엉켜 양쪽 코칭스태프가 뜯어말려`,"warn","club");
  const V={t:t.short, o:opp.short, c:cn};
  fmkFill([[`감독 둘이 라커룸에서 붙었다는데 실화냐 ㅋㅋㅋㅋ`,1],
           [`이건 진짜 선 넘었다... 리그 망신`,-1],
           [`영상 있냐? 제발 영상`,0],
           [`전치 ${weeks}주라는데 이게 축구냐 격투기냐`,-1]],3,V);
  fmkFill([[`남의 라커룸 들어와서 깽판 ㅋㅋ 정신 나갔네`,-1],
           [`{c} 감독님 괜찮으신가요...`,-1],
           [`협회에 제소해야 한다 이건`,-1]],2,V,"rival");
  mgrInjure(weeks, "상대 라커룸에서의 몸싸움");
  /* 🚑 ⚠ 요청(배선 점검) — 「양쪽 코칭스태프가 뒤엉켰다」면서 정작 다치는 건 감독뿐이었다.
     난투에 휩쓸린 선수도 선수 부상 체계(mkInjury)를 그대로 탄다 — 원인은 「경기 밖 사고(off)」.
     그래야 유형·진통제·수술·집중 재활·재발까지 기존 배관이 전부 이어진다. */
  const hurtP=[];
  const _pick=(club)=>{ try{
      const av=(club.players||[]).filter(q=>q && avail(q) && !q.army);
      return av.length ? pick(av) : null;
    }catch(e){ return null; } };
  try{
    if(Math.random()<0.35){ const q=_pick(t);
      if(q){ mkInjury(q, {cause:"off", fit:q.cond||90, age:G.season-(q.by||2000)});
             hurtP.push({p:q, mine:1}); } }
  }catch(e){}
  try{
    if(Math.random()<0.25){ const q=_pick(opp);
      if(q){ mkInjury(q, {cause:"off", fit:q.cond||90, age:G.season-(q.by||2000)});
             hurtP.push({p:q, mine:0}); } }
  }catch(e){}
  for(const h of hurtP){
    const nm=h.p.name, wk=injWeeksLeft(h.p);
    let tn=""; try{ const T=injTypeOf(h.p); if(T) tn=`${T.ic} ${T.n} · `; }catch(e){}
    try{ addNews(`🚑 난투에 휩쓸린 <b>${nm}</b>(${h.mine?t.short:opp.short}) — ${tn}전치 <b>${wk}주</b>`, "warn", "club"); }catch(e){}
    if(h.mine) try{ notify(`🚑 난투 도중 <b>${nm}</b> 선수가 다쳤습니다 — ${tn}전치 <b>${wk}주</b>.`, "warn"); }catch(e){}
  }
  try{ sponScandal("상대 라커룸 난투극", 2); }catch(e){}
  return {weeks, fine, cn, hurt:hurtP.map(h=>({n:h.p.name, mine:h.mine, w:injWeeksLeft(h.p)}))};
}
function applyAwayLocker(o0, target){
  const c=awayCtxInfo(); if(!c) return;
  const t=userTeam(), opp=c.opp;
  // AWAY_OPTS 는 공용 상수다. 결과에 따라 값을 조정하므로 반드시 사본을 만들어 쓴다.
  const o=Object.assign({}, o0);
  /* ⌚ 노려보기는 전용 판정을 쓴다 — 겁을 먹으면 상대 사기가 꺾이고, 아니면 역효과다 */
  let stare=null;
  if(o.k==="stare"){
    stare=awayStareOutcome(target, c);
    if(stare.scared){
      o.om=-(8+R(5));                    // 라커룸 전체가 가라앉는다
      o.oa=-18;
      o.my=1; o.mya=0;
      o.d=`감독이 시계를 풀어 주머니에 넣고, 셔츠 단추를 두 개 풀었습니다. 그리고 ${target?target.name:"한 선수"} 앞에 서서 아무 말 없이 내려다봤습니다.\n${target?target.name:"그 선수"}이(가) 먼저 눈을 피했습니다. 라커룸의 공기가 그대로 주저앉았습니다.`;
    } else {
      o.om=12+R(5);                      // 역효과 — 전원 각성
      o.oa=-34;
      o.my=-2; o.mya=-2; o.fan=-9; o.own=-16; o.rel=-12;
      o.d=`감독이 시계를 풀고 셔츠를 열어젖혔습니다. 그런데 ${target?target.name:"상대 선수"}은(는) 눈을 피하지 않았습니다.\n오히려 라커룸 전체가 일어섰습니다. 스무 명이 같은 곳을 봤습니다.`;
    }
  }
  const roll=o.k==="stare" ? null : awayTauntOutcome(o, c);
  if(roll){
    const base=Math.abs(o.om||0);
    if(roll.unite){
      o.om = base;                                   // 뭉친다 — 사기가 오른다
      o.oa = Math.round((o.oa||0)*1.25);             // 그만큼 감독을 더 싫어한다
    } else {
      o.om = -Math.round(base*0.75);                 // 통했다 — 사기가 꺾인다
      o.oa = Math.round((o.oa||0)*0.85);
    }
  }
  /* 상대 팀 — 사기 */
  opp.morale=Math.round(clamp((opp.morale||70)+(o.om||0),40,99)*100)/100;
  /* 상대 선수 개별 반응 + 호감도 */
  const sd = c.M.home.isUser ? c.M.a : c.M.h;
  const played = sd ? sd.list.map(x=>x.p) : [];
  const benched = sd ? (sd.bench||[]) : [];
  const roster = [...played, ...benched].filter(p=>p);
  /* 지목 대상 — 칭찬은 오늘 최고 평점 선수가 자동으로, 영업·유니폼은 감독이 직접 고른 선수 */
  let tgt=target||null, tgtKind=o.pick||null;
  if(o.tone==="praise" && !tgt){ const mom=awayManOfMatch(); if(mom){ tgt=mom.p; tgtKind="praise"; } }
  if(o.tone==="praise") tgtKind="praise";
  const tgtRow = (tgt&&tgtKind) ? awayTargetReact(tgt, tgtKind, Object.assign({}, c, {stareRes:stare})) : null;
  // 지목당한 선수는 위쪽 전용 카드에서 따로 보여 주므로 아래 목록에서는 뺀다
  const rows = (roster.length?roster:opp.players.slice(0,16))
    .filter(p=>!tgtRow || p.id!==tgtRow.p.id)
    .map(p=>awayReact(p, o, c));
  let starTxt = tgtRow ? ` — 대상: <b>${nmF(tgtRow.p)}</b> (${opp.short}${tgtKind==="praise"?" · 오늘 최고 평점":""})` : "";
  /* 우리 팀 */
  t.morale=Math.round(clamp(t.morale+(o.my||0),40,99)*100)/100;
  for(const p of t.players){
    // 다혈질은 감독이 세게 나가면 좋아하고, 온화한 선수는 부끄러워한다
    const pers=p.pers||0;
    let v=o.mya||0;
    if(v<0 && pers===3) v=Math.abs(v)*0.6;        // 다혈질 — 오히려 통쾌해한다
    if(v<0 && pers===2) v*=1.5;                   // 온화 — 더 불편해한다
    if(v>0 && pers===0) v*=1.3;                   // 프로페셔널 — 품격을 높이 산다
    affAdd(p, v, "상대 라커룸 방문");
  }
  /* 신뢰도·언론 */
  if(o.fan) adjustTrust("fans", o.fan, `상대 라커룸 방문 (${opp.short}전)`);
  if(o.own) adjustTrust("owner", o.own, `상대 라커룸 방문 (${opp.short}전)`);
  if(o.rel) G.press.rel=clamp(G.press.rel+o.rel,0,100);
  /* 물병 투척·유니폼 강제 착용 — 별도 징계 */
  let fine=0;
  /* 남의 라커룸에서 벌인 일은 연맹 상벌위까지 간다 — 구단 예산이 아니라 감독 지갑에서 나간다 */
  if(o.k==="bottle"){ fine=mgrFine(3+R(21)/10, "상벌위 제재금 (상대 라커룸 물병 투척)"); }
  if(o.k==="jersey"){ fine=mgrFine(1.5+R(11)/10, "상벌위 제재금 (상대 선수 모욕)"); }
  if(o.k==="stare"){ fine=mgrFine(1.0+R(11)/10, "품위 손상 제재금 (상대 라커룸 위협)"); }
  if(o.k==="chair"){ fine=mgrFine(1.2+R(14)/10, "품위 손상 제재금 (상대 라커룸 기물 파손)"); }
  /* 여론 */
  const V={t:t.short, o:opp.short, p:tgtRow?tgtRow.p.name:""};
  if(o.soc && SOC["away_"+o.soc]) socialFill(SOC["away_"+o.soc], 4+R(3), 0, V);
  if(o.soc && FMK["away_"+o.soc]) fmkFill(FMK["away_"+o.soc], 3+R(3), V);
  // 남의 라커룸에서 벌인 일이니 남의 팬들이 가만있을 리 없다
  if(o.tone==="respect"||o.tone==="praise") rivalOnManager(true);
  else if(o.tone==="insult"||o.tone==="bottle"||o.tone==="jersey"||o.tone==="taunt"||o.tone==="stare"||o.tone==="chair") rivalOnManager(false);
  /* 기사 */
  const headline = AWAY_HEADLINE[o.k] || AWAY_HEADLINE[o.tone] || `${t.name} 감독, 경기 후 ${opp.short} 라커룸 방문`;
  addNews(`🚪 ${fixJosa(F_(headline, V))}${fine?` — 연맹 상벌위, 감독에게 제재금 ${fine}억 부과`:""}`, null, "club",
    {cat:"manager", ic:o.tone==="bottle"?"🚨":o.tone==="jersey"?"👕":o.tone==="insult"?"🔥":"🚪",
     tid:t.id, head:fixJosa(F_(headline, V)), sub:o.d, src:pick(MEDIA)});
  // 상대 구단의 공식 반응 — 선을 넘은 경우에만 나온다
  if(o.k==="chair"){
    pushFeed({cat:"manager", ic:"🪑", tone:-1, tid:opp.id, src:"K리그 공식",
      head:`${opp.name}, ${t.short} 감독 라커룸 난동에 공식 항의… "기물 파손까지 있었다"`,
      sub:`${opp.short} 구단은 "타 구단 감독이 우리 라커룸에서 고성을 지르고 집기를 파손했다"며 연맹에 진상 조사를 요구했다.`});
  }
  if(o.k==="stare"){
    pushFeed({cat:"manager", ic:"⌚", tone:-1, tid:opp.id, src:"K리그 공식",
      head:`${opp.name}, ${t.short} 감독 라커룸 위협 행위에 공식 유감 표명`,
      sub:`${opp.short} 구단은 "경기가 끝난 라커룸에서 특정 선수를 겨냥한 위협 행위가 있었다"며 연맹에 사안을 보고했다고 밝혔다.`});
  }
  if(o.k==="jersey"||o.k==="bottle"){
    const who = tgtRow ? tgtRow.p.name : "상대 선수";
    const prot = o.k==="jersey"
      ? `${opp.name}, 공식 항의문 발표… "선수 존엄을 훼손한 명백한 도발"`
      : `${opp.name}, 연맹에 ${t.short} 감독 제소… "${who} 선수를 향한 명백한 폭력"`;
    pushFeed({cat:"manager", ic:"📄", tone:-1, tid:opp.id, head:fixJosa(prot), src:"K리그 공식",
      sub:`${opp.short} 구단은 "재발 방지와 공식 사과를 요구한다"는 입장을 냈다. 연맹 상벌위원회 회부 가능성이 거론된다.`});
  }
  // 물병에 맞은 선수가 다쳤다면 그 자체로 기사가 된다
  if(tgtRow && tgtRow.hurt){
    pushFeed({cat:"injury", ic:"🚑", tone:-1, tid:opp.id,
      head:`${opp.short} ${tgtRow.p.name}, 라커룸 물병 사고로 1주 결장`,
      sub:`구단은 "경기가 아닌 곳에서 선수가 다쳤다"며 강하게 반발했다. 여론이 더 나빠질 전망이다.`,
      src:"K리그 공식"});
    adjustTrust("fans", -4, "물병 투척으로 상대 선수 부상");
    adjustTrust("owner", -6, "물병 투척으로 상대 선수 부상");
  }
  /* 결과 요약 */
  const fx=[];
  if(o.om) fx.push(`${opp.short} 팀 사기 ${o.om>0?"+":""}${o.om}`);
  if(o.oa) fx.push(`${opp.short} 선수단 호감도 ${o.oa>0?"+":""}${o.oa}`);
  if(o.my) fx.push(`우리 팀 사기 ${o.my>0?"+":""}${o.my}`);
  if(o.fan) fx.push(`팬 신뢰 ${o.fan>0?"+":""}${o.fan}`);
  if(o.own) fx.push(`구단주 신뢰 ${o.own>0?"+":""}${o.own}`);
  if(o.rel) fx.push(`언론 관계 ${o.rel>0?"+":""}${o.rel}`);
  if(fine) fx.push(`감독 제재금 -${fine}억 <span class="small">(보유 현금 ${me().cash.toFixed(2)}억)</span>`);
  if(tgtRow) fx.push(`${tgtRow.p.name} 호감도 ${tgtRow.delta>0?"+":""}${tgtRow.delta}`);
  const rollTxt = !roll ? "" : (roll.unite
    ? `<br><b style="color:var(--red)">🔥 역효과 — ${opp.short} 라커룸이 오히려 하나로 뭉쳤습니다.</b>
       <span class="small">주장이 먼저 일어나 동료들을 불러 모았습니다. "다음에 그대로 갚아 준다."</span>`
    : `<br><b style="color:var(--green)">🥶 통했습니다 — ${opp.short} 선수단이 눈에 띄게 위축됐습니다.</b>
       <span class="small">아무도 대꾸하지 못했습니다. 라커룸이 무겁게 가라앉았습니다.</span>`);
  /* 🥊 난투극 — 도발이 선을 넘으면 몸싸움으로 번진다 (brawl 확률).
     역효과로 상대가 뭉친 경우에 특히 위험하다. */
  let brawlTxt="";
  const _bp=brawlChance(o, c)*(roll&&roll.unite?1.35:0.85);   // 상대가 뭉쳤으면 더 위험하다
  if(_bp>0 && Math.random() < _bp){
    try{
      const br=awayBrawl(o, c);
      fx.push(`<b style="color:var(--red)">감독 부상 — 전치 ${br.weeks}주</b>`);
      if(br.fine) fx.push(`난투 제재금 -${br.fine}억`);
      for(const h of (br.hurt||[])) fx.push(`<b style="color:var(--red)">🚑 ${h.n} 부상 — 전치 ${h.w}주</b>`);
      brawlTxt=`<br><b style="color:var(--red)">🥊 난투극이 벌어졌습니다.</b>
        <span class="small">${br.cn} 감독이 자리를 박차고 일어섰고, 양쪽 코칭스태프가 뒤엉켰습니다.
        감독은 그 안에서 넘어지며 크게 다쳤습니다 — <b>전치 ${br.weeks}주</b>.
        회복할 때까지 ${acTitle()}가 팀을 지휘합니다.${(br.hurt&&br.hurt.length)
          ? ` 뒤엉킨 사이에 ${br.hurt.map(h=>`<b>${h.n}</b>(전치 ${h.w}주)`).join(" · ")} 선수도 다쳤습니다.`
          : ""}</span>`;
    }catch(e){}
  }
  awayLockerCtx.phase="reactions";
  awayLockerCtx.result={
    said:awayOptText(o)+starTxt, desc:(o.d||"")+rollTxt+brawlTxt, fx:fx.join(" · ")||"특별한 여파는 없었습니다.",
    cls:o.tone==="bottle"||o.tone==="jersey"?"warn":o.tone==="insult"?"warn":o.tone==="taunt"?"info":"good",
    rows, target:tgtRow
  };
  saveGame();
  renderAwayLocker();
}
function awayDone(){
  const c=awayLockerCtx; if(!c) return;
  awayReactReady=false;
  awayLockerCtx=null; inLockerTalk=false;
  const cont=c.cont; if(cont) cont();
}
const AWAY_HEADLINE={
  respect:`{t} 감독, 경기 후 {o} 라커룸 찾아 예를 갖췄다`,
  praise:`{t} 감독, {o} 라커룸까지 찾아가 {p} 콕 집어 칭찬`,
  mind:`{t} 감독, {o} 라커룸에서 {p}에게 대놓고 "우리 팀 오실 생각 없나"`,
  silent:`{t} 감독, {o} 라커룸에 잠시 얼굴만 비쳤다`,
  taunt:`{t} 감독, {o} 라커룸에서 도발성 발언… 현장 술렁`,
  insult:`[속보] {t} 감독, {o} 라커룸에서 막말 파문`,
  jersey:`[속보] {t} 감독, {o} 라커룸에서 {p}에게 자기 팀 유니폼 강제 착용시켜`,
  nil:`[속보] {t} 감독, 무득점 {o} 라커룸 찾아가 "골대라도 맞혀 보시죠" 조롱`,
  bottle:`[속보] {t} 감독, {o} 라커룸에서 {p}에게 물병 투척!`,
  stare:`[속보] {t} 감독, {o} 라커룸에서 {p} 앞에 서서 시계 풀고 위협… "그 장면이 다 찍혔다"`,
  chair:`[속보] {t} 감독, {o} 라커룸에서 의자 걷어차며 "이게 팀이야?" 고성… {o} 구단 격앙`
};
