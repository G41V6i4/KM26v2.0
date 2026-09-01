"use strict";
/* =====================================================
   라이브 매치 UI — FM식 "하이라이트 중계" 상태 머신

   [데이터 구조]
   · 선수 p      : {id, name, pos, prefPos, ovr, 세부능력치…, sta(체력), morale, ban, inj}
   · 팀   t      : {id, name, short, col, div, players[], tactic{form,slot,press,pass,def…}, budget, W/Dw/L/Pts…}
   · 출전기록 x  : {p, off(교체/퇴장된 분|null), red, y(경고수), …}  ← sd.list의 한 항목
   · 팀 사이드 sd: {team, list[](출전기록), bench[], subs(교체 횟수), red}
   · 경기   M    : {home, away, h:sd, a:sd, min, half, hg, ag, st(통계), events[], done, htBreak, needsSubPause…}
   · 이벤트 e    : {min, txt, t(종류), noTime, scene:{kind, atkSide, shooterId…}|null, form(그 순간 22명 좌표 스냅샷)}

   [상태 머신]
   TEXT_MODE      — 하이라이트가 없는 시간. 시계·스코어만 빠르게(TEXT_TICK_MS/분) 흐르고 2D 캔버스는
                    흐리게 대기한다. 매 분 stepMinute()이 난수로 찬스 발생 여부를 계산한다.
   HIGHLIGHT_MODE — 찬스(슛/골/카드/부상/교체 등 scene을 가진 이벤트)가 나오면 진입. 경기 시계를 멈추고
                    2D 캔버스를 밝히며 바둑알들이 전술 패턴(패스→패스→드리블→슛 등)대로 움직인다.
                    큐에 남은 하이라이트를 모두 재생하면 다시 TEXT_MODE로 돌아가고 시계가 재개된다.

   [흐름] setInterval(liveTick) → stepMinute(난수·찬스 계산) → syncLive(이벤트를 revealQueue에 적재)
          → pumpReveal(자막만 있는 이벤트는 즉시 흘리고, scene 이벤트를 만나면 HIGHLIGHT_MODE 진입)
          → playSceneEvent(current2DScene 선언) → render2DTick(매 프레임 그리기) → 완료 시 TEXT_MODE 복귀
===================================================== */
const MATCH_MODE={TEXT:"TEXT_MODE", HIGHLIGHT:"HIGHLIGHT_MODE"};
let matchMode=MATCH_MODE.TEXT;
const TEXT_TICK_MS=110; // 텍스트 모드에서 경기 1분이 흐르는 실제 시간(ms) — 하이라이트가 없을 땐 빠르게 지나간다
let liveM=null, liveTimer=null, liveSpeed=TEXT_TICK_MS, livePaused=false, liveShown=0, livePanelKey="", liveTag=null;
/* 🔍 둘러보기 — 경기를 세워 두고 다른 탭을 「보기만」 한다.
   ⚠ 「상대 팀이 몇 위였는지 확인하러 순위표를 들락날락하고 싶다. 단, 보는 것 외에는
     아무것도 못 하게 해 달라 — 안 그러면 무슨 버그가 날지 모른다」. 정확한 우려다.
     경기 중에 선수를 팔거나 훈련을 바꾸면 진행 중인 경기 데이터와 어긋난다.
   ─ 화면은 그대로 그리되 조작만 통째로 막는다. CSS(pointer-events)와
     클릭 가로채기(캡처 단계) 두 겹으로 잠근다. */
let LIVE_PEEK=false, _peekGuardOn=false;
/* 둘러봐도 안전한 화면만 연다.
   ⚠ 전술판은 들어가고 나올 때 기준선을 다시 잡고(tacBase) 프리셋을 저장한다 —
     경기 중 라이브 전술과 섞이면 그때 만진 게 어느 쪽인지 알 수 없게 된다.
     경기 중 전술·교체는 원래대로 「⏸ → 전술 탭」 경로를 쓴다. */
const PEEK_VIEWS=["table","stats","media","fixtures","finance","mylife","youth","squad","home","osquad","loancenter"];
function peekAllowed(v){ return PEEK_VIEWS.indexOf(v)>=0; }
function peekLive(){
  if(!liveM) return;
  if(liveM.opts && liveM.opts.pvp){ try{ flash("⚔️ 온라인 대전 중에는 둘러보기를 쓸 수 없습니다.","warn"); }catch(e){} return; }
  livePaused=true; LIVE_PEEK=true;
  try{ updLiveCtrl(); }catch(e){}
  show("table");
  try{ flash("🔍 <b>둘러보기</b> — 경기가 멈춰 있습니다. 화면은 볼 수 있지만 조작은 되지 않습니다.","info"); }catch(e){}
}
function peekEnd(){
  LIVE_PEEK=false;
  try{ const el=document.getElementById("peekBar");
       if(el){ try{ el.remove(); }catch(_){}
               try{ el.style.display="none"; el.innerHTML=""; }catch(_){} } }catch(e){}
  try{ const m=document.getElementById("main");
       if(m){ try{ m.classList.remove("peekOnly"); }catch(_){}
              try{ m.className=String(m.className||"").replace(/\bpeekOnly\b/g,"").trim(); }catch(_){} } }catch(e){}
  try{ enterMatchTab(); }catch(e){}
  /* 🔆 ⚠ 제보 원문 — 「매치엔진에서 둘러보기 하고 와서 다시 경기 재개하면 블라인드 화면
     (약간 어두운 화면)에서 경기가 재개된다. 재개되면 밝은 화면으로 와야겠지?」
     원인 — 경기 화면 마크업의 캔버스는 `class="dim"` 으로 태어난다(장면 사이 대기 상태가 기본).
       enterMatchTab 이 화면을 다시 그리면 그 dim 이 새로 붙는데, 밝기를 맞추는 건
       applyMatchModeUI 이고 그건 setMatchMode 로만 불린다. setMatchMode 는 「모드가 같으면
       바로 반환」이라 둘러보기 전후로 모드가 그대로면 영영 호출되지 않는다 —
       그래서 하이라이트가 재생되는 동안에도 화면이 어두운 채로 굳었다.
     ─ 화면을 다시 그렸으면 밝기도 지금 모드에 맞춰 다시 칠한다. */
  try{ applyMatchModeUI(); }catch(e){}
  /* ⚠ 제보 — 「둘러보기 후 경기 화면에 돌아오면 경기 시작(재개) 버튼이 없어서, 전술을
     열었다 취소해야 경기가 다시 진행된다」. enterMatchTab 은 화면 골격만 다시 그리고
     컨트롤 바(lvCtrl 의 ▶/⏸/둘러보기)는 채우지 않는다 — 여기서 채워 준다. */
  try{ if(liveM) updLiveCtrl(liveM.done ? "ft" : undefined); }catch(e){}
}
/* 둘러보기 중에는 화면 안의 어떤 클릭도 목적지에 닿지 못한다 (캡처 단계에서 끊는다) */
function peekGuardInit(){
  try{
    const m=document.getElementById("main"); if(!m || _peekGuardOn) return;
    _peekGuardOn=true;
    m.addEventListener("click", (e)=>{ if(LIVE_PEEK){ e.stopPropagation(); e.preventDefault(); } }, true);
    m.addEventListener("change", (e)=>{ if(LIVE_PEEK){ e.stopPropagation(); e.preventDefault(); } }, true);
    m.addEventListener("keydown", (e)=>{ if(LIVE_PEEK){ e.stopPropagation(); } }, true);
  }catch(e){}
}
/* 화면 아래 고정 띠 — #main 밖에 두어야 「돌아가기」가 잠기지 않는다 */
function peekBarRender(){
  if(typeof document==="undefined") return;
  let el=document.getElementById("peekBar");
  if(!LIVE_PEEK || !liveM){
    if(el){ try{ el.remove(); }catch(_){} try{ el.style.display="none"; el.innerHTML=""; }catch(_){} }
    return;
  }
  if(!el){ el=document.createElement("div"); el.id="peekBar"; document.body.appendChild(el); }
  let sc="";
  try{ sc=`${liveM.home.short} <b>${liveM.hg} : ${liveM.ag}</b> ${liveM.away.short} · ${liveM.minTxt!=null?liveM.minTxt:dispMin(liveM)}'`; }catch(e){}
  el.innerHTML=`<span>⏸ <b>경기 일시정지</b> — 둘러보기 모드 · 조작은 잠겨 있습니다</span>`
    +`<span style="opacity:.85">${sc}</span>`
    +`<button class="pkBtn" onclick="peekEnd()">⚽ 경기로 돌아가기</button>`;
}
/* 연속 2D 매치엔진으로 치르는 중인 경기. null 이면 기존 분 단위 엔진으로 진행 중이라는 뜻이다. */
let liveSim=null, liveSimHalf=false;
/* 지금 재생 중인 하이라이트 — {frames, i, acc, kind, side}. null 이면 경기를 빨리 감는 중이다. */
let liveHL=null, lastHLTick=null;
/* 🎞️ 장면과 장면 사이에 화면에 붙잡아 둘 프레임 — ⚠ 제보 원문 — 「매치엔진에서 공이 가다가
   스킵되는 거같은 느낌이 드는거 수정해줄래?」.
   ─ 원인: 하이라이트가 끝나면 경기는 뒤에서 빨리 감기로 굴러가는데, 그동안 화면은 그 「지금
     이 순간의 그라운드」를 어둡게 덮어서 그대로 그리고 있었다. 빨리 감기는 한 프레임에 수십
     틱을 굴리므로 공이 프레임마다 순간이동한다 — 실측: 화면 프레임의 30%가 5m 이상, 13%가
     15m 이상 튀고 최대 59m. 부드러운 장면 → 공이 튀는 구간 → 다시 장면, 이게 「스킵」이다.
   ─ 장면 사이에는 마지막으로 「본」 프레임을 그대로 붙잡아 둔다. 공이 튀지 않고, 아직 보여
     주지 않은 장면을 미리 흘리지도 않는다. */
/* 🎞️ 하이라이트 사이 빨리 감기 중인가 — ⚠ 제보 원문 「하이라이트 장면 뒤에는 블라인드
   처리되면서 선수들이 막 움직이면서 스킵되잖아? 예전에는 선수들이 다같이 막 움직이면서
   빠르게 지나갔는데, 지금은 몇몇 선수들만 움직이네? … 약간 어색하달까?」 */
let liveFF=false;
let tacApplyTimer=null;                 // "전술 반영 중" 표시 타이머
const TAC_APPLY_MS=1600;                // 지시가 전달되는 데 걸리는 시간(ms)
/* 하이라이트 공개 큐 — 한 분(tick) 안에 여러 사건이 동시에 쏟아져도 한 장면씩 순서대로 재생한다. */
let revealQueue=[], revealTimer=null;
const revealDelay=650;
let current2DScene=null; // {event, start, dur, done} — 지금 재생 중인 하이라이트 씬(없으면 null)
/* 모드 전환 — 캔버스 밝기와 상단 표시등만 바꾸고, 실제 진행 제어는 liveTick/pumpReveal이 matchMode를 보고 한다 */
function applyMatchModeUI(){
  const cv=document.getElementById("pitch2d");
  if(cv && cv.classList) cv.classList.toggle("dim", matchMode===MATCH_MODE.TEXT);
  const badge=document.getElementById("pitchMode");
  if(badge){
    const on=matchMode===MATCH_MODE.HIGHLIGHT;
    badge.textContent = on ? "● HIGHLIGHT" : "○ 경기 진행 중";
    badge.className = "pitchMode"+(on?" on":"");
  }
}
function setMatchMode(mode){
  if(matchMode===mode) return;
  matchMode=mode;
  applyMatchModeUI();
}
