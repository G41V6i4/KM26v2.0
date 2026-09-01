"use strict";
/* ═══ 🆕 자동 업데이트 ═════════════════════════════════════════════════
   ⚠ 요청 원문 — 「자동으로 버전 업 되게는 할 수 없나? 이게 깃허브 페이지로 적용되는 건데」.
   깃허브 페이지는 index.html 을 브라우저·CDN 캐시에 얹어 준다. 새 판을 올려도 이미 열어 둔
   사람은 옛 판을 계속 붙들고 있고, 그 상태로는 온라인 대전 버전이 어긋나 매칭도 안 된다.
   ─ 새 파일을 통째로 내려받아 비교하지 않는다(4MB). 같은 주소에 HEAD 만 던져
     ETag / Last-Modified / Content-Length 를 본다 — 배포하면 이 값이 바뀐다.
   ─ 캐시를 확실히 비켜 가려고 매번 다른 질의문자열을 붙인다 (깃허브 페이지는 질의문자열을
     무시하고 같은 파일을 주지만, 캐시는 다른 주소로 본다).
   ─ 경기 중에는 절대 새로고침하지 않는다. 메뉴에 있고 대전 중이 아닐 때만 자동 적용한다. */
const GAME_BUILD="20260913-5031";             // 🆕 이 파일의 빌드 표식 (파일 맨 앞 <!--B:…--> 와 같은 값)
const UPD_EVERY=10*60*1000;        // 확인 주기
const UPD_SNOOZE=30*60*1000;       // 「나중에」를 누르면 이만큼 조용히 있는다
let UPD={tag:null, seen:null, at:0, snooze:0, timer:null, busy:false};
function updUrl(){ try{ return location.href.split("#")[0].split("?")[0]; }catch(e){ return location.href; } }
/* 서버에 올라가 있는 파일의 빌드 표식 — 앞 1KB 만 잘라 읽는다 (4MB 를 내려받지 않는다).
   ⚠ 이게 핵심이다. 헤더(ETag)만 보면 「내 브라우저가 캐시에서 옛 파일을 꺼내 쓰는 중」인
      경우를 못 잡는다 — 지금 돌아가는 코드의 GAME_BUILD 와 직접 견주어야 확실하다. */
/* ⚠ 제보 — 「최근 패치 이후 매칭·모바일에서 연결이 끊긴다」.
   원인 후보 하나가 여기였다. 부분 내려받기(Range)를 서버·중계기가 무시하고 200 을 주면
   `await r.text()` 가 4.5MB 짜리 게임 파일을 통째로 받는다. 모바일에서는 그 한 번이
   회선을 몇 초씩 잡아먹어 대전 신호·스트림이 함께 무너진다.
   ─ 206(부분 응답)이 아니면 몸통을 읽지 않고 곧바로 버린다. 6초 시한도 건다. */
async function updServerBuild(){
  let ac=null, to=null;
  try{
    if(!/^https?:/i.test(location.protocol)) return null;      // 파일로 연 경우 — 확인할 서버가 없다
    try{ ac=new AbortController(); to=setTimeout(()=>{ try{ ac.abort(); }catch(e){} }, 6000); }catch(e){ ac=null; }
    const r=await fetch(updUrl()+"?_u="+Date.now(),
      Object.assign({cache:"no-store", headers:{Range:"bytes=0-1023"}}, ac?{signal:ac.signal}:{}));
    if(r.status!==206){ try{ if(r.body&&r.body.cancel) r.body.cancel(); }catch(e){} return null; }
    const txt=(await r.text()).slice(0,4096);
    const m=txt.match(/<!--B:([\w.\-]+)-->/);
    return m ? m[1] : null;
  }catch(e){ return null; }
  finally{ try{ if(to) clearTimeout(to); }catch(e){} }
}
async function updStamp(){
  try{
    if(!/^https?:/i.test(location.protocol)) return null;
    const r=await fetch(updUrl()+"?_u="+Date.now(), {method:"HEAD", cache:"no-store"});
    if(!r.ok) return null;
    const h=r.headers;
    return (h.get("etag")||"") + "|" + (h.get("last-modified")||"") + "|" + (h.get("content-length")||"");
  }catch(e){ return null; }
}
/* 지금 새로고침해도 되는 상태인가 — 경기·대전 중에는 안 된다 */
function updSafe(){
  try{
    if(typeof liveM!=="undefined" && liveM && !liveM.done) return false;
    if(typeof PVP!=="undefined" && PVP) return false;
    if(typeof inLiveTactics!=="undefined" && inLiveTactics) return false;
    return true;
  }catch(e){ return false; }
}
async function updApply(){
  if(UPD.busy) return; UPD.busy=true;
  try{ saveGame(); }catch(e){}
  try{ await fetch(updUrl(), {cache:"reload"}); }catch(e){}        // 브라우저 캐시를 새 파일로 갈아끼운다
  try{ if(window.caches){ const ks=await caches.keys(); for(const k of ks) await caches.delete(k); } }catch(e){}
  try{ location.reload(); }catch(e){ location.href=updUrl()+"?_u="+Date.now(); }
}
function updLater(){
  UPD.snooze=Date.now()+UPD_SNOOZE;
  const el=document.getElementById("updBar"); if(el&&el.parentNode) el.parentNode.removeChild(el);
}
function updBanner(){
  let el=document.getElementById("updBar");
  if(!el){
    el=document.createElement("div"); el.id="updBar";
    el.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:11px 14px;"
      +"background:linear-gradient(180deg,#1a2432,#121a24);border-top:2px solid var(--gold);"
      +"box-shadow:0 -6px 22px rgba(0,0,0,.45);display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center";
    document.body.appendChild(el);
  }
  const auto=updSafe();
  el.innerHTML=`<span style="font-weight:800;color:var(--gold)">🆕 새 버전이 나왔습니다</span>
    <span class="small" style="opacity:.85">새로고침하면 최신 판으로 이어집니다 — 진행 상황은 자동 저장됩니다.
      ${auto?`<b id="updCnt">10</b>초 뒤 자동으로 적용됩니다.`:"경기가 끝나면 적용해 주세요."}</span>
    <button class="mini sel" style="border-color:var(--gold);color:var(--gold)" onclick="updApply()">지금 적용</button>
    <button class="mini" onclick="updLater()">나중에</button>`;
  if(auto){
    let n=10;
    if(UPD.cnt) clearInterval(UPD.cnt);
    UPD.cnt=setInterval(()=>{
      if(!document.getElementById("updBar") || !updSafe()){ clearInterval(UPD.cnt); UPD.cnt=null; return; }
      n--; const c=document.getElementById("updCnt"); if(c) c.textContent=String(n);
      if(n<=0){ clearInterval(UPD.cnt); UPD.cnt=null; updApply(); }
    }, 1000);
  }
}
async function updCheck(force){
  const now=Date.now();
  /* ⚔️ 경기·대전이 굴러가는 중에는 확인 자체를 미룬다 — 회선을 나눠 쓰면 신호가 밀린다 (제보) */
  if(!updSafe()) return;
  if(!force && now-UPD.at<30000) return;
  UPD.at=now;
  /* ① 서버 파일의 빌드 표식과 지금 돌아가는 코드를 직접 견준다 (가장 확실) */
  const sb=await updServerBuild();
  if(sb){
    if(sb===GAME_BUILD) { UPD.tag=null; return; }
    if(UPD.seen===sb && Date.now()<UPD.snooze) return;
    UPD.seen=sb;
    try{ updBanner(); }catch(e){}
    return;
  }
  /* ② 표식을 못 읽으면(부분 내려받기 차단 등) 응답 헤더가 바뀌는지로 대신 본다 */
  const tag=await updStamp();
  if(!tag) return;
  if(!UPD.tag){ UPD.tag=tag; return; }          // 첫 확인 — 기준값만 잡는다
  if(tag===UPD.tag) return;                     // 그대로다
  if(UPD.seen===tag && Date.now()<UPD.snooze) return;
  UPD.seen=tag;
  try{ updBanner(); }catch(e){}
}
function updInit(){
  try{
    updCheck(true);
    if(UPD.timer) clearInterval(UPD.timer);
    UPD.timer=setInterval(()=>{ try{ updCheck(); }catch(e){} }, UPD_EVERY);
    /* 탭으로 돌아왔을 때도 한 번 — 자리를 비운 사이에 새 판이 올라갔을 수 있다 */
    document.addEventListener("visibilitychange", ()=>{
      if(!document.hidden && Date.now()-UPD.at>5*60*1000) { try{ updCheck(); }catch(e){} }
    });
  }catch(e){}
}
applyFontScale();
try{ pvpMenuSync(); }catch(e){}
/* 🗣️ 커뮤니티도 같은 서버를 쓴다 — 주소가 없으면 메뉴 자체가 숨는다 (요청) */
try{ if(cmOn()){ const b=document.querySelector('[data-v="comm"]'); if(b) b.style.display=""; } }catch(e){}
/* 🔔 시작하고 조금 뒤에 게시판을 한 번 받아 둔다 — 내 글의 새 댓글을 곧바로 알리기 위해서다.
   그 뒤로는 내 글이 있을 때만 6분마다 조용히 다시 받는다 (요청 — 댓글 알림). */
try{ if(cmOn()){
  setTimeout(()=>{ try{ if(PVP_NET!==false) cmLoad(true); }catch(e){} }, 5200);
  CM_BG=setInterval(()=>{ try{ cmBgTick(); }catch(e){} }, 6*60*1000);
} }catch(e){}
try{ fsInit(); }catch(e){}   // 전체화면 버튼 상태 동기화 + 자동 복귀 무장
try{ liveVisibilityInit(); }catch(e){}  // 경기 중 탭 이탈 대응
try{ exitGuardInit(); }catch(e){}       // 🚪 창 닫기 — 자동 저장 + (선택) 확인창
try{ persistRefresh(); }catch(e){}      // 🔒 저장소 영구 보존 상태 조회
/* 💽 큰 저장소(IndexedDB) 확인 — 기본 저장소가 비었거나 더 최신 세이브가 있으면 되살린다.
   부팅 흐름을 막지 않도록 잠깐 뒤에 비동기로 확인한다. */
try{ setTimeout(()=>{ try{ idbSyncCheck(); }catch(e){} }, 900); }catch(e){}
try{ navInit(); }catch(e){}             // 🖱️ 트랙패드 뒤로가기 제스처 (맥북 두 손가락 스와이프)
try{ updInit(); }catch(e){}             // 🆕 새 판이 올라오면 알려 주고, 안전할 때 자동 적용 (요청)
/* 저장이 아예 막힌 환경(시크릿 모드 등)이면 처음부터 알려 준다 — 몇 시즌 진행한 뒤에
   알게 되는 것이 최악이다. */
try{
  if(!storageOK()) setTimeout(()=>{ try{
    notify("⚠️ <b>이 브라우저에서는 게임이 저장되지 않습니다.</b><br><span class=\"small\">사생활 보호(시크릿) 모드이거나 사이트 데이터가 차단돼 있습니다. 일반 창으로 열거나, ⚙️ 설정에서 <b>세이브파일 저장</b>을 눌러 파일로 보관해 주세요.</span>","warn");
  }catch(e){} }, 1200);
}catch(e){}
renderTeamPick();
