"use strict";
/* =====================================================
   UI
===================================================== */
const $=(s)=>document.querySelector(s);
/* ✂️ ⚠ 제보 원문 — 「'오피스' 탭에서 구단주, 팬 신뢰도 항목에 목표 초과 달성시에
   현재 2위 (목표 5위) (+1.740000000000002) 처럼 숫자가 나오는데 개리그 매니저 내에서
   나오는 모든 숫자를 소수점 세번째 숫자부터 모두 절삭한다는 패치가 필요 할 것 같습니다」.
   원인 — 부동소수점 덧셈이 남기는 먼지(0.1+0.2=0.30000000000000004)다. 값을 만드는 곳마다
     반올림을 걸어도 새로 쓰는 코드에서 또 새어 나온다. 그래서 「화면에 그리는 마지막 관문」
     한 곳에서 끊는다 — 소수 셋째 자리부터는 화면에 내보내지 않는다.
   ⚠ 소수 두 자리까지인 숫자는 손대지 않는다 — 「1.50억」 같은 서식이 「1.5억」으로 무너지면
     그게 새 버그다. 셋째 자리가 있는 숫자만 두 자리로 정리한다.
     (110.29999999999997 은 110.29 보다 110.3 이 맞으므로 자르지 않고 두 자리로 맞춘다)
   ⚠ 태그 안쪽(속성 · onclick 인자 · style 수치)도 건드리지 않는다. 눈에 보이는 글자만. */
const _DEC_RX=/\d+\.\d{3,}/g;
function _dec2(m){ const n=parseFloat(m); return isFinite(n) ? String(Math.round(n*100)/100) : m; }
function decCut(v){
  if(typeof v!=="string" || v.indexOf(".")<0) return v;
  try{
    return v.replace(/<[^>]*>|[^<]+/g, seg =>
      seg.charAt(0)==="<" ? seg : seg.replace(_DEC_RX, _dec2));
  }catch(e){ return v; }
}
(function(){
  try{
    const DH=Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    if(DH && DH.set) Object.defineProperty(Element.prototype, "innerHTML", {
      configurable:true, enumerable:DH.enumerable, get:DH.get,
      set:function(v){ DH.set.call(this, decCut(v)); }
    });
    const DT=Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
    if(DT && DT.set) Object.defineProperty(Node.prototype, "textContent", {
      configurable:true, enumerable:DT.enumerable, get:DT.get,
      set:function(v){
        DT.set.call(this, (typeof v==="string" && v.indexOf(".")>=0)
          ? v.replace(_DEC_RX, _dec2) : v);
      }
    });
  }catch(e){}
})();
/* ── 인게임 확인 모달 (native confirm() 대체) ──
   showConfirm(bodyText, onOk, opts) : opts={okLabel, cancelLabel, danger, onCancel}
   showChoice(titleText, [{label, cls}], onPick) : 버튼형 선택지 (취소 버튼 없이 각 선택지가 곧 액션) */
function showConfirm(bodyText, onOk, opts){
  opts=opts||{};
  const okLabel=opts.okLabel||"확인";
  /* ⚠ cancelLabel:"" 로 "취소 버튼 없는 안내 팝업"을 만들려 해도 ||"취소" 때문에 항상 되살아났다.
     빈 문자열을 명시했으면 그 뜻을 존중한다. */
  const cancelLabel = (opts.cancelLabel!==undefined) ? opts.cancelLabel : "취소";
  const box=$("#gcModal");
  box.className="";
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox">
    <div class="gcBody">${bodyText}</div>
    <div class="gcBtns">
      <button class="gcCancel"${cancelLabel?"":' style="display:none"'}>${cancelLabel||"닫기"}</button>
      <button class="gcOk${opts.danger?' danger':''}">${okLabel}</button>
    </div>
  </div></div>`;
  const close=()=>{ box.className="hidden"; box.innerHTML=""; };
  /* ⚠ close() 가 innerHTML 을 비운 뒤에 onOk() 가 돌기 때문에, 콜백 안에서
     document.getElementById("...")로 팝업 안 입력칸을 읽으면 이미 사라진 뒤였다.
     (선물 수량을 7로 넣어도 항상 1개만 사지던 원인) 닫기 전에 값을 걷어서 넘긴다. */
  const grab=()=>{ const o={}; try{ box.querySelectorAll("input,select,textarea").forEach(el=>{ if(el.id) o[el.id]=el.value; }); }catch(e){} return o; };
  box.querySelector(".gcOk").onclick=()=>{ const vals=grab(); close(); if(onOk) onOk(vals); };
  box.querySelector(".gcCancel").onclick=()=>{ close(); if(opts.onCancel) opts.onCancel(); };
  box.querySelector(".gcOverlay").onclick=(e)=>{ if(e.target.classList.contains("gcOverlay")){ close(); if(opts.onCancel) opts.onCancel(); } };
}
function showChoice(titleText, opts_, onPick, onCancel){
  const box=$("#gcModal");
  box.className="";
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox">
    <div class="gcBody">${titleText}</div>
    ${opts_.map((o,i)=>`<button class="gcOptBtn" data-i="${i}">${o}</button>`).join("")}
    <div class="gcBtns"><button class="gcCancel">취소</button></div>
  </div></div>`;
  const close=()=>{ box.className="hidden"; box.innerHTML=""; };
  box.querySelectorAll(".gcOptBtn").forEach(b=>{ b.onclick=()=>{ const i=parseInt(b.dataset.i,10); close(); if(onPick) onPick(i); }; });
  box.querySelector(".gcCancel").onclick=()=>{ close(); if(onCancel) onCancel(); };
  box.querySelector(".gcOverlay").onclick=(e)=>{ if(e.target.classList.contains("gcOverlay")){ close(); if(onCancel) onCancel(); } };
}
/* ---------- 설정: 인게임 폰트 크기 (저장게임과 무관하게 기기별로 유지되는 별도 localStorage 값) ---------- */
/* ═══════════════════════════════════════════════════════════════
   전체화면 — 브라우저 주소창과 탭 막대를 없앤다.
   ⚠ 브라우저는 "사용자가 직접 누른 동작" 안에서만 전체화면을 허용한다. 그래서 페이지가 뜨자마자
     자동으로 켤 수는 없고, 한 번 켜 두면 다음부터는 '첫 클릭/터치'에 자동으로 들어가게 해 둔다.
   ⚠ 아이폰 사파리는 Fullscreen API 자체가 없다. 그쪽은 '홈 화면에 추가'가 유일한 방법이라
     버튼 대신 안내를 띄운다(설정 탭).
═══════════════════════════════════════════════════════════════ */
const FS_KEY="klm2026_fs";
function fsRoot(){ return document.documentElement; }
function fsNow(){
  return document.fullscreenElement || document.webkitFullscreenElement ||
         document.mozFullScreenElement || document.msFullscreenElement || null;
}
function fsSupported(){
  const d=fsRoot(); if(!d) return false;
  return !!(d.requestFullscreen||d.webkitRequestFullscreen||d.mozRequestFullScreen||d.msRequestFullscreen);
}
/* ═══ 📲 홈 화면에 추가 ═════════════════════════════════════════════
   브라우저 탭으로 굴리는 것과 홈 화면 웹앱으로 굴리는 것은 저장·화면 모두 다르다.
   ─ 아이폰: 홈 화면 웹앱은 사파리와 분리된 저장소를 쓰고, 「7일 미방문 삭제」 규칙에서도 빠진다.
   ─ 안드로이드: 저장소는 크롬과 공유하지만(용량은 큰 저장소로 이미 해결) 전체화면으로 바로 열린다.
   설치는 브라우저 메뉴에서만 가능하다 — 사이트가 대신 눌러 줄 수 없으므로 「어디를 누르면 되는지」를 알려 준다. */
const H2A_KEY="klm2026_h2a";
function uaKind(){
  let ua=""; try{ ua=String((navigator&&navigator.userAgent)||""); }catch(e){}
  if(/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator&&navigator.maxTouchPoints>1))) return "ios";
  if(/Android/i.test(ua)) return "android";
  if(/Mobile|Tablet/i.test(ua)) return "mobile";
  return "desktop";
}
function h2aDone(){ try{ return localStorage.getItem(H2A_KEY)==="1"; }catch(e){ return false; } }
function h2aHide(){ try{ localStorage.setItem(H2A_KEY,"1"); }catch(e){}
  try{ notify("📲 안내를 접었습니다. <span class=\"small\">⚙️ 설정에서 언제든 다시 볼 수 있습니다.</span>","info"); }catch(e){}
  if(VIEW==="home") show("home"); else if(VIEW==="settings") show("settings"); }
/* 이 기기에서 안내가 의미 있는가 — 모바일인데 아직 홈 화면 앱으로 실행하지 않은 경우 */
function h2aWorth(){
  const k=uaKind();
  if(k==="desktop") return false;
  return !fsStandalone();
}
/* 플랫폼별 설치 방법 */
function h2aSteps(){
  const k=uaKind();
  if(k==="ios") return {
    ic:"", n:"아이폰 · 아이패드 (사파리)",
    steps:["화면 <b>아래쪽 가운데의 공유 버튼</b>(<b>⬆</b> 상자에서 화살표가 올라가는 모양)을 누릅니다",
           "목록을 조금 내려 <b>「홈 화면에 추가」</b>를 누릅니다",
           "오른쪽 위 <b>「추가」</b>를 누르면 끝입니다"],
    why:["세이브가 <b>사파리와 분리된 저장소</b>에 들어갑니다 — 브라우저 기록을 지워도 남습니다",
         "사파리의 <b>「7일 안 열면 저장 데이터 삭제」 규칙에서 빠집니다</b>",
         "주소창 없이 전체화면으로 열립니다"]};
  if(k==="android") return {
    ic:"", n:"안드로이드 (크롬 · 삼성인터넷)",
    steps:["오른쪽 위 <b>⋮ (점 세 개)</b>를 누릅니다",
           "<b>「홈 화면에 추가」</b> 또는 <b>「앱 설치」</b>를 누릅니다",
           "이름을 확인하고 <b>「추가」</b>를 누르면 끝입니다"],
    why:["주소창·탭 없이 <b>전체화면</b>으로 바로 열립니다",
         "탭을 잃어버려 진행 상황을 놓치는 일이 줄어듭니다",
         "세이브 용량은 <b>큰 저장소(IndexedDB)</b>가 이미 맡고 있어 그대로 안전합니다"]};
  return {
    ic:"", n:"모바일 브라우저",
    steps:["브라우저 <b>메뉴</b>를 엽니다",
           "<b>「홈 화면에 추가」</b> 또는 <b>「바로가기 만들기」</b>를 누릅니다"],
    why:["전체화면으로 열리고, 탭을 잃어버릴 위험이 줄어듭니다"]};
}
/* 📲 설정용 카드 — 상태에 따라 문구가 바뀐다 */
function h2aCard(){
  if(fsStandalone()) return `<div class="card" style="border-color:var(--green)">
    <h3 style="color:var(--green)">📲 홈 화면 앱으로 실행 중</h3>
    <p class="small" style="color:var(--sub)">이 상태가 가장 안전합니다 — 전체화면으로 열리고,
      ${uaKind()==="ios"?"사파리와 분리된 저장소를 쓰며 <b>7일 미방문 삭제 규칙에서도 빠집니다</b>.":"주소창 없이 바로 실행됩니다."}
      그래도 시즌이 끝날 때마다 <b>💾 세이브파일 저장</b>을 한 번씩 눌러 두시면 확실합니다.</p></div>`;
  const S=h2aSteps();
  const k=uaKind();
  return `<div class="card" style="border-color:var(--gold)">
    <h3 style="color:var(--gold)">📲 홈 화면에 추가하기 <span class="small">— ${S.n}</span></h3>
    <p class="small" style="margin-bottom:8px">${k==="desktop"
      ? "휴대폰·태블릿에서 이 페이지를 열고 아래 순서대로 하면, 앱처럼 실행됩니다."
      : "브라우저 탭 대신 <b>앱처럼</b> 실행됩니다. 30초면 됩니다."}</p>
    <ol class="h2aList">${S.steps.map(s=>`<li>${s}</li>`).join("")}</ol>
    <div class="small" style="margin-top:8px;color:var(--sub);line-height:1.7">
      <b style="color:var(--txt)">이렇게 하면 —</b><br>${S.why.map(s=>"· "+s).join("<br>")}</div>
    <p class="small" style="margin-top:8px;opacity:.75">⚠️ 설치는 브라우저 메뉴에서만 할 수 있어서, 게임이 대신 눌러 드릴 수는 없습니다.</p>
  </div>`;
}
/* 📲 오피스 상단 한 줄 안내 — 한 번 접으면 다시 뜨지 않는다 */
function h2aTip(){
  if(!h2aWorth() || h2aDone()) return "";
  const k=uaKind();
  const one = k==="ios"
    ? "공유 <b>⬆</b> → <b>홈 화면에 추가</b>"
    : "브라우저 <b>⋮</b> → <b>홈 화면에 추가</b>";
  return `<div class="card" style="border-color:var(--gold);padding:10px 12px">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span style="font-size:18px">📲</span>
      <div style="flex:1;min-width:180px">
        <b style="color:var(--gold)">앱처럼 쓰시면 세이브가 더 안전합니다</b>
        <div class="small" style="color:var(--sub);margin-top:2px">${one}
          ${k==="ios"?"— 사파리의 7일 삭제 규칙에서 빠지고 저장소도 분리됩니다":"— 전체화면으로 바로 열립니다"}</div>
      </div>
      <button class="mini" onclick="show('settings')">자세히</button>
      <button class="mini" onclick="h2aHide()">✕ 안 볼게요</button>
    </div></div>`;
}
/* 이미 앱처럼 실행 중(홈 화면에서 띄움)이면 주소창이 애초에 없다 */
function fsStandalone(){
  try{
    if(window.navigator && window.navigator.standalone===true) return true;
    return !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  }catch(e){ return false; }
}
function fsWant(){ try{ return localStorage.getItem(FS_KEY)==="1"; }catch(e){ return false; } }
function fsSetWant(v){ try{ localStorage.setItem(FS_KEY, v?"1":"0"); }catch(e){} }
function fsEnter(){
  const d=fsRoot();
  const fn=d.requestFullscreen||d.webkitRequestFullscreen||d.mozRequestFullScreen||d.msRequestFullscreen;
  if(!fn) return false;
  try{ const r=fn.call(d, {navigationUI:"hide"}); if(r&&r.catch) r.catch(()=>{}); }catch(e){ try{ fn.call(d); }catch(e2){ return false; } }
  return true;
}
function fsExit(){
  const fn=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen;
  if(!fn) return;
  try{ const r=fn.call(document); if(r&&r.catch) r.catch(()=>{}); }catch(e){}
}
function toggleFS(){
  if(fsNow()){ fsSetWant(false); fsExit(); }
  else{
    if(!fsSupported()){
      notify("이 브라우저는 전체화면을 지원하지 않습니다. 아이폰이라면 공유 → '홈 화면에 추가'로 실행해 보세요.","warn");
      return;
    }
    fsSetWant(true); fsEnter();
  }
  setTimeout(fsSync, 120);
}
/* 버튼 아이콘·표시 여부를 현재 상태에 맞춘다 */
function fsSync(){
  const b=document.getElementById("fsBtn"); if(!b) return;
  const hide = fsStandalone() || !fsSupported();
  b.classList.toggle("hidden", hide);
  if(hide) return;
  const on=!!fsNow();
  b.textContent = on ? "⛗" : "⛶";
  b.title = on ? "전체화면 끄기 (Esc)" : "전체화면 (주소창·탭 숨기기)";
  b.style.opacity = on ? ".28" : ".5";
}
/* 켜 두었던 사람은 다음 실행 때 첫 터치·클릭 한 번으로 자동 복귀 */
let fsArmed=false;
function fsArm(){
  if(fsArmed) return; fsArmed=true;
  const go=()=>{
    document.removeEventListener("pointerdown", go, true);
    document.removeEventListener("keydown", go, true);
    if(fsWant() && !fsNow() && fsSupported() && !fsStandalone()) fsEnter();
    if(orientWant() && orientSupported()) setTimeout(orientLock, 300);
    setTimeout(fsSync, 150);
  };
  document.addEventListener("pointerdown", go, true);
  document.addEventListener("keydown", go, true);
}
function fsInit(){
  if(typeof document==="undefined" || !document.addEventListener) return;
  for(const ev of ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"])
    document.addEventListener(ev, fsSync);
  fsSync();
  if(fsWant() || orientWant()) fsArm();
}
/* ═══════════════════════════════════════════════════════════════
   경기 중 화면 유지 · 이탈 대응
   ⚠ 브라우저는 탭이 뒤로 가면 타이머를 늦추거나 아예 멈춘다. 특히 아이폰 사파리는 곧바로
     정지시킨다. 그래서 "백그라운드에서 경기가 계속 진행되게" 만드는 것은 웹에서는 불가능하다.
     화면 밖 재생(PiP)도 <video> 전용이라 이 게임처럼 DOM/캔버스로 그리는 화면에는 쓸 수 없다.
     대신 할 수 있는 두 가지를 한다.
       ① 경기 중에는 화면이 꺼지지 않게 잡아 둔다 (Wake Lock) — 손을 안 대도 계속 진행된다.
       ② 그래도 탭을 벗어나면 깔끔히 멈춰 두었다가 돌아왔을 때 이어서 재개한다.
          (멈추지 않으면 돌아오는 순간 밀린 분(minute)이 한꺼번에 터져 경기가 순간이동한다)
═══════════════════════════════════════════════════════════════ */
const WAKE_KEY="klm2026_wake";
let WAKE=null, liveHidRunning=false, liveHidAt=0;
function wakeWant(){ try{ return localStorage.getItem(WAKE_KEY)!=="0"; }catch(e){ return true; } }   // 기본 켜짐
function wakeSupported(){ try{ return !!(navigator && navigator.wakeLock && navigator.wakeLock.request); }catch(e){ return false; } }
function wakeAcquire(){
  if(!wakeWant() || !wakeSupported() || WAKE) return;
  try{
    const pr=navigator.wakeLock.request("screen");
    if(pr && pr.then) pr.then(w=>{ WAKE=w; try{ w.addEventListener("release", ()=>{ WAKE=null; }); }catch(e){} }).catch(()=>{});
  }catch(e){}
}
function wakeRelease(){ try{ if(WAKE && WAKE.release) WAKE.release(); }catch(e){} WAKE=null; }
function toggleWake(){
  const on=!wakeWant();
  try{ localStorage.setItem(WAKE_KEY, on?"1":"0"); }catch(e){}
  if(on){ if(liveM && !liveM.done) wakeAcquire(); notify("경기 중 화면이 꺼지지 않도록 유지합니다.","good"); }
  else { wakeRelease(); notify("화면 유지를 껐습니다. 기기 설정에 따라 경기 중 화면이 꺼질 수 있습니다.","info"); }
  if(VIEW==="settings") show("settings");
}
/* ═══ 🔒 저장소 영구 보존 (Storage Persistence) ═════════════════════
   브라우저는 디스크가 빠듯해지면 「오래 안 쓴 사이트」의 저장소를 스스로 정리한다.
   영구 보존을 받아 두면 그 자동 정리 대상에서 빠진다 — 세이브가 조용히 사라지는 사고를 막는다.
   ⚠ 이건 「자동 정리」만 막는다. 사용자가 직접 「쿠키 및 기타 사이트 데이터」를 지우면
      그때는 어떤 방법으로도 남지 않는다. 아이폰·맥 사파리의 7일 미방문 삭제도 막지 못한다.
      그래서 💾 세이브파일 내보내기가 여전히 유일한 확실한 백업이다.
   ─ 크롬·엣지: 사이트 이용 정도(북마크·방문 빈도·홈 화면 추가)를 보고 조용히 승인/거절한다.
     파이어폭스: 사용자에게 한 번 물어본다.  사파리: API 자체가 없거나 항상 true 를 돌려준다. */
const PERSIST_ASK_KEY="klm2026_persistAsk";
let PERSIST_ST=null;      // null=아직 모름 · true=영구 보존 · false=아님 · "na"=지원 안 함
let PERSIST_USE=null;     // {used, quota} — 쓰고 있는 용량
function persistSupported(){
  try{ return !!(navigator && navigator.storage && navigator.storage.persist && navigator.storage.persisted); }
  catch(e){ return false; }
}
function persistRefresh(then){
  if(!persistSupported()){ PERSIST_ST="na"; if(then) then(); return; }
  try{
    navigator.storage.persisted().then(v=>{ PERSIST_ST=!!v; if(then) then(); })
      .catch(()=>{ PERSIST_ST=null; if(then) then(); });
  }catch(e){ PERSIST_ST=null; if(then) then(); }
  try{
    if(navigator.storage.estimate) navigator.storage.estimate().then(e=>{
      PERSIST_USE={used:e.usage||0, quota:e.quota||0};
      if(VIEW==="settings") { try{ show("settings"); }catch(_){} }
    }).catch(()=>{});
  }catch(e){}
}
/* 영구 보존을 요청한다. fromUI 면 결과를 알려 준다(자동 요청은 조용히). */
function persistAsk(fromUI){
  if(!persistSupported()){
    if(fromUI) try{ flash("이 브라우저는 영구 보존 요청을 지원하지 않습니다. 💾 세이브파일 저장으로 백업해 주세요.","warn"); }catch(e){}
    PERSIST_ST="na"; if(fromUI && VIEW==="settings") show("settings");
    return;
  }
  try{ localStorage.setItem(PERSIST_ASK_KEY,"1"); }catch(e){}
  try{
    navigator.storage.persist().then(ok=>{
      PERSIST_ST=!!ok;
      if(fromUI){
        try{ notify(ok
          ? "🔒 <b>영구 보존이 켜졌습니다.</b> <span class=\"small\">브라우저가 공간을 정리할 때 이 게임의 세이브는 건드리지 않습니다.</span>"
          : "🔓 브라우저가 영구 보존을 승인하지 않았습니다. <span class=\"small\">이 사이트를 북마크하거나 홈 화면에 추가하고 자주 방문하면 승인될 수 있습니다. 그동안은 💾 세이브파일 저장으로 백업해 주세요.</span>",
          ok?"good":"warn"); }catch(e){}
      }
      persistRefresh(()=>{ if(VIEW==="settings"){ try{ show("settings"); }catch(_){} } });
    }).catch(()=>{
      PERSIST_ST=null;
      if(fromUI) try{ notify("영구 보존 요청이 실패했습니다.","warn"); }catch(e){}
    });
  }catch(e){}
}
/* 게임을 실제로 시작한 뒤 한 번만 조용히 요청한다 — 브라우저마다 「이용 정도」를 보므로
   아무것도 안 한 첫 화면에서 물어보면 거절될 확률이 높다. */
function persistAutoOnce(){
  if(!persistSupported()) return;
  let done=false;
  try{ done = localStorage.getItem(PERSIST_ASK_KEY)==="1"; }catch(e){}
  if(done) return;
  if(!G || !G.teams || !G.userTeamId) return;      // 팀을 고르고 실제로 진행하는 중일 때
  persistAsk(false);
}
/* ═══ 🚪 창을 닫을 때 ═══════════════════════════════════════════════
   ① 닫히는 순간 한 번 더 저장한다 — localStorage 는 동기라 이 시점에도 확실히 써진다.
   ② 원하면 브라우저 확인창을 띄운다(실수로 닫는 것 방지).
   ⚠ 브라우저 정책상 문구는 우리가 정할 수 없다 — 「저장하시겠습니까?」로는 띄울 수 없고,
      크롬·사파리가 「이 사이트에서 나가시겠습니까?」류의 자기 문구를 보여 준다.
      또 페이지를 한 번도 클릭하지 않았으면 이 확인창 자체가 무시된다. */
const EXIT_ASK_KEY="klm2026_exitask";
function exitAskOn(){
  try{ const v=localStorage.getItem(EXIT_ASK_KEY); return v===null ? true : v==="1"; }
  catch(e){ return true; }
}
function setExitAsk(on){
  try{ localStorage.setItem(EXIT_ASK_KEY, on?"1":"0"); }catch(e){}
  try{ notify(on
    ? "🚪 창을 닫거나 새로 고칠 때 브라우저가 한 번 물어봅니다."
    : "🚪 확인창을 껐습니다. <span class=\"small\">닫을 때 자동 저장은 그대로 동작합니다.</span>", on?"good":"info"); }catch(e){}
  if(VIEW==="settings") show("settings");
}
let EXIT_SAVED_AT=0;
function exitSaveNow(){
  try{
    if(!G || !G.teams) return;
    if(Date.now()-EXIT_SAVED_AT < 400) return;     // 이벤트가 겹쳐 들어와도 한 번만
    EXIT_SAVED_AT=Date.now();
    try{ saveFlush(); }catch(e){}                  // 💤 미뤄 둔 저장이 있으면 그것부터
    saveGameNow();                                 // 나갈 때만은 무조건 즉시 쓴다
  }catch(e){}
}
function exitGuardInit(){
  if(typeof window==="undefined" || !window.addEventListener) return;
  /* 탭이 숨겨질 때·닫힐 때 — 모바일 사파리는 beforeunload 를 안 주므로 이쪽이 본선이다 */
  try{ window.addEventListener("pagehide", exitSaveNow); }catch(e){}
  try{ document.addEventListener("visibilitychange", ()=>{ if(document.hidden) exitSaveNow(); }); }catch(e){}
  try{ window.addEventListener("beforeunload", (e)=>{
    exitSaveNow();
    if(!exitAskOn()) return;
    if(!G || !G.teams || !G.userTeamId) return;     // 아직 팀도 고르지 않았다 — 붙잡을 이유가 없다
    e.preventDefault();
    e.returnValue="";                              // 규격 — 문구는 브라우저가 정한다
    return "";
  }); }catch(e){}
}
function liveVisibilityInit(){
  if(typeof document==="undefined" || !document.addEventListener) return;
  document.addEventListener("visibilitychange", ()=>{
    const live = liveM && !liveM.done;
    if(document.hidden){
      wakeRelease();                                  // 숨겨지면 브라우저가 어차피 풀어 버린다
      if(live){ liveHidRunning = !livePaused; liveHidAt=Date.now(); if(!livePaused) pauseLive(); }
    } else {
      if(live){
        wakeAcquire();
        if(liveHidRunning){
          liveHidRunning=false;
          const sec=Math.max(1, Math.round((Date.now()-liveHidAt)/1000));
          /* 복귀 알림은 띄우지 않는다 — 자동 일시정지 동작은 그대로 (사용자 요청) */
          resumeLive();
        }
      }
    }
  });
}
/* ── 가로 모드 고정 ───────────────────────────────────────────
   화면 방향 잠금(Screen Orientation API)은 "전체화면일 때만" 허용된다 — 그래서 켜면
   전체화면부터 들어간 뒤 가로로 잠근다. 안드로이드 크롬·삼성인터넷에서 동작한다.
   ⚠ 아이폰 사파리는 이 API 자체가 없다. 그쪽은 기기 회전 잠금을 풀고 눕히는 수밖에 없어서
     버튼 대신 안내를 띄운다. 대신 가로로 눕히면 CSS가 알아서 압축 레이아웃으로 바뀐다. */
const ORIENT_KEY="klm2026_land";
function orientSupported(){
  try{ return !!(screen && screen.orientation && typeof screen.orientation.lock==="function"); }
  catch(e){ return false; }
}
function orientWant(){ try{ return localStorage.getItem(ORIENT_KEY)==="1"; }catch(e){ return false; } }
function orientSetWant(v){ try{ localStorage.setItem(ORIENT_KEY, v?"1":"0"); }catch(e){} }
function orientNow(){
  try{ return !!(screen && screen.orientation && /landscape/.test(screen.orientation.type||"")); }
  catch(e){ return false; }
}
function orientLock(){
  if(!orientSupported()) return false;
  const go=()=>{ try{ const r=screen.orientation.lock("landscape"); if(r&&r.catch) r.catch(()=>{}); }catch(e){} };
  if(!fsNow() && fsSupported()){ fsEnter(); setTimeout(go, 260); }   // 전체화면이 먼저다
  else go();
  return true;
}
function orientUnlock(){
  try{ if(screen&&screen.orientation&&screen.orientation.unlock) screen.orientation.unlock(); }catch(e){}
}
function toggleLandscape(){
  if(!orientSupported()){
    notify("이 브라우저는 화면 방향 고정을 지원하지 않습니다. 아이폰이라면 제어 센터에서 <b>화면 회전 잠금</b>을 끄고 기기를 눕혀 주세요 — 레이아웃은 자동으로 가로용으로 바뀝니다.","warn");
    return;
  }
  if(orientWant()){ orientSetWant(false); orientUnlock(); notify("가로 모드 고정을 해제했습니다.","info"); }
  else { orientSetWant(true); orientLock(); notify("가로 모드로 고정합니다. (전체화면과 함께 동작합니다)","good"); }
  if(VIEW==="settings") setTimeout(()=>show("settings"), 350);
}
const FONT_SCALE_KEY="klm2026_fontScale";
const FONT_SCALE_OPTS=[90,100,110,125,150];
function getFontScale(){
  try{ const v=parseInt(localStorage.getItem(FONT_SCALE_KEY)||"100",10); return FONT_SCALE_OPTS.includes(v)?v:100; }catch(e){ return 100; }
}
function applyFontScale(){
  const v=getFontScale();
  if(typeof document!=="undefined" && document.body) document.body.style.zoom=(v/100);
  if(typeof window!=="undefined") window.__zoom=v/100;   // 팝업 좌표 보정이 참조한다
}
function setFontScale(v){
  try{ localStorage.setItem(FONT_SCALE_KEY, String(v)); }catch(e){}
  applyFontScale();
  if(VIEW==="settings") show("settings");
}
