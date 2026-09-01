"use strict";
/* ═══════════════════════════════════════════════════════════════════════════
   ⚔️ 온라인 대전 (PvP) — GitHub Pages + Firebase RTDB(REST) + WebRTC P2P
   구조: 호스트 권위 — 한쪽 브라우저가 매치엔진을 돌리고, 게스트는 전술 명령을 보내고
        경기 상태 스냅샷(초당 20회, ~150바이트)을 받아 그린다.
   격리: 양쪽 모두 「패키지에서 복제한 클론 팀」으로 뛴다 — 컨디션·부상·징계·성장·재정이
        본 세이브에 절대 닿지 않는다(순수 친선). 전적(G.pvpLog)만 남는다.
   서버: Firebase 는 매칭·시그널링(연결 성사)까지만 쓰고, 경기는 P2P 로 흐른다.
   ⚠ 이 파일 하나로 오프라인 로컬 플레이도 되어야 한다 — PVP_FB 가 비어 있으면
     메뉴 자체가 숨고, 어떤 코드도 네트워크를 만지지 않는다.
═══════════════════════════════════════════════════════════════════════════ */
/* 🔧 제작자 설정 — Firebase Realtime Database URL.
   예: "https://klm-pvp-default-rtdb.asia-southeast1.firebasedatabase.app"
   비워 두면 ⚔️ 온라인 대전 메뉴가 숨는다. 설정 방법은 「온라인대전_설정가이드.md」 참고. */
const PVP_FB="https://kleagueonline-default-rtdb.asia-southeast1.firebasedatabase.app/";
const PVP_VER=6;                 // 프로토콜 버전 — 다르면 매칭을 거절한다 (v6: 역할 능숙도·전담 키커·주장 · v5: 선발·배치·역할 · v4: 주심 좌표)
/* 🌐 P2P 연결 경로.
   ⚠ 제보 — 「매칭이 안 된다」. 서버(방·신호)는 멀쩡한데 붙지 않는 경우가 있는데,
      원인은 대개 STUN 만으로는 뚫리지 않는 회선이다. 통신사 공유 주소(CGNAT)나
      대칭형 NAT 뒤에서는 서로의 공인 주소를 알아도 직접 연결이 성립하지 않는다.
   ─ 직접 연결이 실패했을 때만 쓰이는 중계(TURN)를 함께 둔다. 평소에는 쓰이지 않고,
      직접 붙을 수 없을 때에만 경기 데이터가 이 중계를 거친다. */
const PVP_STUN=[
  {urls:"stun:stun.l.google.com:19302"},
  {urls:"stun:stun1.l.google.com:19302"},
  {urls:"turn:openrelay.metered.ca:80",  username:"openrelayproject", credential:"openrelayproject"},
  {urls:"turn:openrelay.metered.ca:443", username:"openrelayproject", credential:"openrelayproject"},
  {urls:"turn:openrelay.metered.ca:443?transport=tcp", username:"openrelayproject", credential:"openrelayproject"}
];
/* ⚠ 요청 — 「프레임도 호스트에 최대한 가깝게 높이자」.
   게스트는 이미 requestAnimationFrame 으로 그리고 표본 사이를 보간하지만, 원본 표본이
   30Hz 라 빠른 장면(슛·역습)에서 보간이 실제 궤적을 못 따라가 뭉툭해졌다.
   ─ 50Hz 로 올린다. 한 장이 172바이트라 30Hz 5.2KB/s → 50Hz 8.6KB/s — 데이터 채널에 부담 없다.
   ─ 표본이 촘촘해진 만큼 재생 지연도 줄인다(120→80ms). 그만큼 호스트와의 시차가 짧아진다. */
const PVP_TAC_GRACE=6000;        // 상대 전술창을 닫은 뒤에도 변경을 받아 주는 유예(ms) — 강제 마감 대비
const PVP_SNAP_MS=20;            // 상태 스냅샷 전송 간격 (50Hz — 요청: 호스트에 가깝게)
const PVP_PLAYOUT=80;            // 게스트 재생 지연 기준(ms) — 적응형 재생 시계의 목표 리드
const PVP_QUEUE_TTL=90;          // 대기열 항목 유효 시간(초)
/* ⚔️ 빠른 대전 전력차 제한 — 개발 노트: 「제한 해제해. 어차피 인원이 없거든」.
   ±1.0성 제한은 대기 인원이 두 명뿐이어도 전력차가 크면 서로 영영 못 만나게 했다.
   이제 선착순이다 — 여럿이 대기 중이면 그중 전력이 가장 가까운 상대를 고른다(정렬은 유지). */
const PVP_STAR_GAP=999;          // 사실상 무제한 — 전력차와 무관하게 매칭
let PVP=null;                    // 진행 중인 대전 상태
/* ⏸ 탭 숨김 감지 — 경기 중이면 상대에게 알리고 양쪽 다 멈춘다 (제보: 백그라운드 일시정지) */
try{ if(typeof document!=="undefined" && document.addEventListener)
  document.addEventListener("visibilitychange", ()=>{ try{ if(typeof pvpVisChange==="function") pvpVisChange(!!document.hidden); }catch(e){} });
}catch(e){}
function pvpOn(){ return !!PVP_FB; }
/* 🎫 닉네임 — 브라우저에 저장된다 (세이브와 무관, 매칭·스코어보드·상대 전적에 표시) */
function pvpNick(){
  let n="";
  try{ n=localStorage.getItem("klm2026_pvpNick")||""; }catch(e){}
  n=String(n).replace(/[<>&"'`]/g,"").trim().slice(0,8);
  if(!n){ try{ n=String((G.me&&G.me.name)||"").replace(/[<>&"'`]/g,"").trim().slice(0,8); }catch(e){} }
  return n||"감독";
}
/* ⚠ 제보 — 「닉네임도 중복되면 안되야해」. 저장할 때 서버 장부(nicks)를 확인하고 등록한다. */
async function pvpSetNick(v){
  const n=String(v||"").replace(/[<>&"'`]/g,"").trim().slice(0,8);
  const oldKey=(typeof pvpNickKey==="function")?pvpNickKey():"";
  if(!n){
    try{ localStorage.removeItem("klm2026_pvpNick"); localStorage.removeItem("klm2026_pvpNickKey"); }catch(e){}
    if(oldKey){ try{ fbDel("nicks/"+oldKey); }catch(e){} }
    try{ flash("⚔️ 닉네임을 비웠습니다 — 감독 이름을 씁니다. (채팅은 닉네임이 있어야 합니다)","info"); }catch(e){}
    try{ if(VIEW==="pvp") show("pvp"); }catch(e){}
    return;
  }
  const key=pvpNickKeyOf(n);
  if(!key){ try{ flash("쓸 수 없는 닉네임입니다 — 한글·영문·숫자를 넣어 주세요.","warn"); }catch(e){} return; }
  /* 이름은 이 브라우저에 먼저 담는다(오프라인에서도 매칭 표시에 쓰인다).
     장부 등록은 그다음이고, 등록되기 전까지는 채팅이 잠긴다. */
  let prev=null; try{ prev=localStorage.getItem("klm2026_pvpNick"); }catch(e){}
  const restore=()=>{ try{
    if(prev) localStorage.setItem("klm2026_pvpNick", prev); else localStorage.removeItem("klm2026_pvpNick");
    if(oldKey) localStorage.setItem("klm2026_pvpNickKey", oldKey); else localStorage.removeItem("klm2026_pvpNickKey");
  }catch(e){} };
  try{ localStorage.setItem("klm2026_pvpNick", n); localStorage.removeItem("klm2026_pvpNickKey"); }catch(e){}
  /* 서버가 없거나 연결이 끊겨 있으면 장부를 볼 수 없다 — 연결되면 그때 확인한다 */
  if(!pvpOn() || PVP_NET===false){
    try{ flash("⚔️ 닉네임 저장 — "+n+" · 연결되면 중복 확인을 합니다","info"); }catch(e){}
    try{ if(VIEW==="pvp") show("pvp"); }catch(e){}
    return;
  }
  const cur=await fbGet("nicks/"+key);
  const mine=pvpId();
  if(cur && cur.id && cur.id!==mine && (Date.now()-(cur.t||0))<PVP_NICK_TTL){
    restore();                                   // ⚠ 제보 — 중복이면 쓰던 이름 그대로 되돌린다
    gameAlert("🎫 「"+n+"」은 이미 다른 감독이 쓰고 있는 닉네임입니다.\n\n다른 이름으로 지어 주세요.");
    try{ if(VIEW==="pvp") show("pvp"); }catch(e){}
    return;
  }
  const ok=await fbSet("nicks/"+key, {id:mine, n, t:Date.now()});
  if(!ok){
    /* 장부에 못 올렸다 — 이름은 이 브라우저에 남기되 채팅은 잠긴 상태로 둔다 */
    try{ flash("닉네임을 장부에 올리지 못했습니다 — 연결을 확인해 주세요. (이 브라우저에는 저장됐습니다)","warn"); }catch(e){}
    try{ pvpNetCheck(); }catch(e){}
    try{ if(VIEW==="pvp") show("pvp"); }catch(e){}
    return;
  }
  if(oldKey && oldKey!==key){ try{ fbDel("nicks/"+oldKey); }catch(e){} }
  try{ localStorage.setItem("klm2026_pvpNickKey", key); }catch(e){}
  try{ flash("⚔️ 닉네임 저장 — "+n,"info"); }catch(e){}
  try{ pvpLiveBeat(); }catch(e){}
  try{ if(VIEW==="pvp") show("pvp"); }catch(e){}
}
/* 원격 문자열 소독 — 상대 팩·이벤트는 남의 브라우저가 만든 데이터다. 표시 전에 씻는다. */
function pvpClean(s, n){ return String(s==null?"":s).replace(/<[^>]*>/g,"").replace(/[<>&"'`]/g,"").slice(0, n||20); }
/* ⚔️ 대전 진행 중인가 — 대기열·연결·로비·경기. done 은 끝난 상태라 풀린다. */
function pvpBusy(){ return !!PVP_BUSY || !!(PVP && ["queue","room","connecting","lobby","match"].indexOf(PVP.stage)>=0); }
let PVP_NAVLOCK=false;
/* ⚠ 제보 — 「온라인 매칭을 할 때는 다른 메뉴들은 비활성화」. 상태가 바뀔 때만 건드려서
   부임 절차 잠금(applyNavLock) 등 다른 잠금 체계와 싸우지 않는다. */
/* ⚔️ 온라인 대전 메뉴 노출 — 서버가 있고 <b>소속 구단이 있을 때만</b> 보인다 (요청: 무직이면 블라인드).
   대전은 내 팀 스쿼드를 클론으로 내보내는 모드라, 무직이면 내보낼 팀 자체가 없다. */
function pvpMenuSync(){
  try{
    const b=document.querySelector('[data-v="pvp"]');
    if(!b) return;
    const okp=(typeof pvpOn==="function") && pvpOn() && !(G && G.jobless);
    b.style.display = okp ? "" : "none";
  }catch(e){}
}
function pvpNavSync(){
  try{
    const on=pvpBusy();
    if(on===PVP_NAVLOCK) return;
    PVP_NAVLOCK=on;
    document.querySelectorAll(".navbtn").forEach(b=>{
      if(b.dataset && b.dataset.v==="pvp") return;   // ⚔️ 메뉴는 살려 둔다
      b.classList.toggle("navLocked", on);
      b.disabled=on;
    });
    const a=document.getElementById("advBtn");
    if(a){
      if(on){ if(!a._pvpLock){ a._pvpLock=1; a.disabled=true; a.classList.add("navLocked"); } }
      else if(a._pvpLock){ a._pvpLock=0; a.disabled=false; a.classList.remove("navLocked"); }
    }
  }catch(e){}
}
/* 🎫 대전 신분증 — ⚠ 제보 원문 — 「온라인 대전메뉴에서 닉네임을 저장한뒤에 메뉴에서 나가기 누르고
   새 팀 선택해서 다시 들어오면, 온라인 대전에 한 명 더 추가되서 닉네임이 중복해서 뜨거든?」
   원인 — 이 id 를 세이브(G)에 담아 뒀다. 새 팀으로 시작하면 G 가 새로 만들어지니 id 도 새로
      생기고, 서버에는 「같은 닉네임의 다른 사람」이 한 명 더 앉아 있는 꼴이 됐다.
      닉네임과 마찬가지로 신분증은 세이브가 아니라 브라우저에 매여야 한다. */
function pvpId(){
  let id="";
  try{ id=localStorage.getItem("klm2026_pvpId")||""; }catch(e){}
  let old=""; try{ old=(typeof G!=="undefined" && G && G._pvpId)||""; }catch(e){}
  if(!id){
    id = old || ("p"+Math.random().toString(36).slice(2,10));   // 옛 세이브의 id 를 이어받는다
    try{ localStorage.setItem("klm2026_pvpId", id); }catch(e){}
  } else if(old && old!==id){
    /* 세이브마다 따로 만들어져 서버에 남아 있는 옛 신분증 — 그 자리를 치운다 */
    try{ if(typeof PVP_FB!=="undefined" && PVP_FB) fbDel("live/"+old); }catch(e){}
  }
  try{ if(typeof G!=="undefined" && G) G._pvpId=id; }catch(e){}
  return id;
}

/* ── Firebase RTDB REST — SDK 없이 fetch/EventSource 로만 쓴다 ───────────── */
function fbU(path){ return PVP_FB.replace(/\/+$/,"")+"/pvp/"+path+".json"; }
/* ⏱️ 안전장치 ① — 응답 없는 요청은 반드시 끊는다.
   ⚠ 제보 원문 「온라인 대전에서 매칭이 안될때, 공개방 들어갈때 가끔 먹통이 되는 현상이
      생기던데, 안전장치를 마련해줄래?」
   원인: fetch 에 시간 제한이 없었다. 서버·와이파이가 응답을 멈추면 await 가 영영 끝나지
   않고, 화면은 「방에 입장하는 중…」에서 굳은 채 아무 일도 일어나지 않는다(=먹통).
   ─ 9초 안에 답이 없으면 실패로 처리한다. 실패는 각 호출부가 이미 다루고 있다. */
const FB_TIMEOUT=9000;
function fbFetch(u, init){
  let ac=null, to=null;
  try{ ac=new AbortController(); }catch(e){ ac=null; }
  const opt=Object.assign({}, init||{});
  if(ac){ opt.signal=ac.signal; to=setTimeout(()=>{ try{ ac.abort(); }catch(e){} }, FB_TIMEOUT); }
  const done=()=>{ try{ if(to) clearTimeout(to); }catch(e){} };
  return fetch(u, opt).then(r=>{ done(); return r; }, e=>{ done(); throw e; });
}
async function fbGet(p){ try{ const r=await fbFetch(fbU(p)); return r.ok? await r.json() : null; }catch(e){ return null; } }
/* 🔎 ⚠ 제보 — 「규칙을 올렸는데도 “티어 장부에 접근하지 못했습니다”가 뜬다」.
   원인: fbGet 은 ① 요청 실패 ② 갈래가 비어 있음 을 똑같이 null 로 돌려준다.
      RTDB 는 데이터가 하나도 없는 경로에 대해 정직하게 null 을 준다 —
      그래서 규칙을 올린 직후(아직 아무도 티어를 쌓지 않은 상태)에도 「접근 실패」로 읽혔다.
   ─ 성공 여부와 값을 따로 돌려주는 판을 둔다. */
async function fbGetX(p){
  try{ const r=await fbFetch(fbU(p)); if(!r.ok) return {ok:false, val:null};
       return {ok:true, val:await r.json()}; }
  catch(e){ return {ok:false, val:null}; }
}
async function fbSet(p,v){ try{ const r=await fbFetch(fbU(p),{method:"PUT",body:JSON.stringify(v)}); return r.ok; }catch(e){ return false; } }
async function fbPatch(p,v){ try{ const r=await fbFetch(fbU(p),{method:"PATCH",body:JSON.stringify(v)}); return r.ok; }catch(e){ return false; } }
async function fbPush(p,v){ try{ const r=await fbFetch(fbU(p),{method:"POST",body:JSON.stringify(v)}); if(!r.ok) return null; return (await r.json()).name; }catch(e){ return null; } }
async function fbDel(p){ try{ await fbFetch(fbU(p),{method:"DELETE"}); }catch(e){} }
/* 실시간 수신 — RTDB 의 text/event-stream. put/patch 이벤트로 트리 변화가 흘러온다 */
/* ⚠ 제보 원문 — 「온라인 대전에서 유저 표시가 등록된 이름으로 잘 나오다가 다 「감독」으로 바뀐다」.
   원인: 실시간 수신이 보내는 두 가지 알림 — put(그 자리를 통째로 갈아끼움)과
      patch(그 자리 안의 「바뀐 값만」 갱신) — 을 **똑같이** 처리하고 있었다.
      put 이든 patch 든 `state[칸] = 받은값` 으로 덮어썼다.
      접속 신호를 fbSet(PUT)에서 fbPatch 로 바꾼 뒤로 이게 터졌다 —
      20초마다 오는 심장박동에서 실제로 바뀌는 값은 시각(t) 하나뿐이라,
      서버는 `{"t":1787…}` 만 patch 로 보낸다. 그런데 우리는 그걸 통째로 덮어써서
      그 감독의 칸에 n(닉네임)·ver·m 이 전부 사라졌다.
      → 처음 한 번은 전체(put)를 받아 이름이 제대로 보이고, 20초 뒤 첫 심장박동부터
        모두가 이름 없는 칸이 되어 「감독」(대체 이름)으로 표시된다. 정확히 제보 그대로다.
      ⚠ 같은 이유로 방(rooms)에서도 신호(sdpOffer 등)를 patch 로 보내면 방 정보가 날아갈 수 있었다.
   ─ patch 는 「합치기」로 처리한다. 값이 null 이면 그 칸만 지운다. put 만 통째 교체다. */
function fbStream(p, onChange){
  const url=fbU(p);
  const es=new EventSource(url);
  const state={};                       // 스트림이 재구성해 주는 최신 트리
  const merge=(o, k, data)=>{
    /* patch — 받은 값들만 얹는다. 원래 있던 다른 값은 지키고, null 인 항목만 지운다 */
    if(data===null || typeof data!=="object" || Array.isArray(data)){
      if(data===null) delete o[k]; else o[k]=data;
      return;
    }
    const cur=(o[k] && typeof o[k]==="object" && !Array.isArray(o[k])) ? o[k] : {};
    for(const kk in data){ if(data[kk]===null) delete cur[kk]; else cur[kk]=data[kk]; }
    o[k]=cur;
  };
  const apply=(path, data, isPatch)=>{
    if(path==="/"||path===""){
      if(isPatch && data && typeof data==="object"){
        for(const k in data){ if(data[k]===null) delete state[k]; else state[k]=data[k]; }
      } else {
        for(const k in state) delete state[k];
        if(data&&typeof data==="object") Object.assign(state, data); else if(data!=null) state._=data;
      }
    } else {
      const ks=path.replace(/^\//,"").split("/");
      let o=state; for(let i=0;i<ks.length-1;i++){ o[ks[i]]=o[ks[i]]||{}; o=o[ks[i]]; }
      const k=ks[ks.length-1];
      if(isPatch) merge(o, k, data);
      else if(data==null) delete o[k];
      else o[k]=data;
    }
    try{ onChange(state); }catch(e){}
  };
  const h=(e, isPatch)=>{ try{ const d=JSON.parse(e.data); apply(d.path, d.data, isPatch); }catch(_){}};
  es.addEventListener("put",   (e)=>h(e,false));
  es.addEventListener("patch", (e)=>h(e,true));
  return es;
}

/* ── 스쿼드 패키지 — 내 팀을 대전용으로 직렬화한다 ───────────────────────── */
const PVP_ATTR_KEYS=null;   // 전 능력치 전송 — 엔진이 그대로 쓴다
function pvpPack(){
  const t=userTeam(); if(!t) return null;
  let xi=[]; try{ xi=bestXI(t)||[]; }catch(e){ xi=[]; }
  let bench=[]; try{ bench=matchBench(t)||[]; }catch(e){ bench=[]; }
  /* 🗺️ 선발 배치 자리 — 로비 포메이션 그림용 (제보) */
  let _slots={}; try{ _slots=computeRenderSlots(t, xi)||{}; }catch(e){}
  const list=[...xi, ...bench.filter(p=>!xi.includes(p))].slice(0,20)
    .filter(p=>p && p.pos);
/* ⚔️ ⚠ 제보 원문 — 「지금 현재 온라인 대전에서 처음 확정한 전술이랑 경기중 전술이 다르게
   나온다」.
   원인: 패키지(pvpPack)에는 배치 자리(sl)만 담기고 「누가 선발인지」와 「역할·임무」가
   빠져 있었다. 받는 쪽(pvpBuildTeam)은 그 sl 조차 쓰지 않고 클론을 만든 뒤
   assignAIRoles 로 역할을 새로 깔았고, 클론은 isUser 가 아니라 bestXI 가 손으로 짠
   열한 명 대신 능력치 순으로 선발을 다시 뽑았다.
   ─ 결과: 로비에서 확인·수락한 그림(내 선발 / 상대 선발)과 실제 그라운드가 어긋났다.
   ─ 선발 명단·배치 자리·역할·임무를 함께 실어 보내고, 받는 쪽이 그대로 세운다.
   ⚠ 프로토콜이 바뀌므로 PVP_VER 을 올린다 — 옛 빌드와는 매칭되지 않는다(안내 문구가 나간다). */
  const _xiSet=new Set(xi.map(p=>p.id));
  const _roleOf=(p)=>{ try{ const rd=getRole(t, p, _slots[p.id]||prefSlotOf(p)); 
    return (rd && rd.r) ? {r:rd.r, d:rd.d} : null; }catch(e){ return null; } };
  const pl=list.map(p=>({
    n:String(p.name||"").slice(0,12), pos:p.pos, pref:p.prefPos||p.pos,
    sl:(_slots[p.id]&&SLOT_XY[_slots[p.id]])?_slots[p.id]:null,
    xi:_xiSet.has(p.id)?1:0,          // ⚔️ 감독이 확정한 선발인가 (제보: 로비와 경기가 다르다)
    rl:_roleOf(p),                    // ⚔️ 역할·임무도 그대로 넘긴다
    by:p.by||2000, no:p.no||0, h:p.h||178, w:p.w||74, frn:p.frn?1:0,
    hg:p.hg?1:0,                      // 🌱 홈그로운 — 외국인 쿼터 계산이 어긋나지 않게
    /* ⚠ 상한이 92 였다 — 내부 눈금은 96까지 간다. 최상급 선수가 대전에서만 깎였다 */
    ovr:clamp(Math.round(p.ovr||60),40,96),
    attr:p.attr?Object.fromEntries(Object.entries(p.attr).filter(([k,v])=>typeof v==="number").map(([k,v])=>[k,clamp(Math.round(v),15,99)])):null,
    gkA:p.gkA?Object.fromEntries(Object.entries(p.gkA).filter(([k,v])=>typeof v==="number").map(([k,v])=>[k,clamp(Math.round(v),15,99)])):null,
    fam:(function(){ const f={}; try{ for(const k of FAM_POS){ const v=Math.round((p.posFam&&p.posFam[k])||0); if(v>0) f[k]=clamp(v,0,100); } }catch(e){} return f; })(),
    /* 🎓 역할 능숙도 — 엔진이 실제로 읽는 값이다(roleFamMul: 0.55~1.00 배).
       이게 빠져 있어서, 온라인 대전에서는 모두가 「그 역할을 처음 맡는 선수」로 뛰었다. */
    rf:(function(){ const f={}; try{ for(const k in (p.roleFam||{})){ const v=Math.round(p.roleFam[k]||0);
      if(v>0 && ROLE_BY_KEY[k]) f[k]=clamp(v,0,100); } }catch(e){} return f; })(),
    tr:(p.traits||[]).slice(0,6)
  }));
  const tac={}; try{ for(const k of ["formation","mentality","pass","tempo","press","line","width","counter","crossFq","longShot"]) tac[k]=t.tactic[k]; }catch(e){}
  /* 🎯 전담 키커 — 엔진의 designatedKicker 가 team.tactic.kickers 를 읽는다.
     안 보내면 PK·프리킥·코너를 감독이 지정한 선수가 아니라 엔진이 고른 선수가 찼다. */
  const kk={}; try{ const K=kickersOf(t);
    for(const k of ["pk","fk","ck","so"]) kk[k]=(K[k]||[]).map(id=>{ const q=t.players.find(x=>x.id===id); return q?(q.no||0):0; }).filter(Boolean).slice(0,5);
  }catch(e){}
  /* 🎖️ 주장 — 그라운드의 리더가 팀 전체의 판단력·팀워크를 끌어올린다(최대 +6%).
     안 보내면 감독이 지정한 주장 대신 리더십 최상위 선수가 대신 섰다. */
  let capNo=0; try{ if(t.cap && t.cap.s===G.season && t.cap.c){ const q=t.players.find(x=>x.id===t.cap.c); if(q) capNo=q.no||0; } }catch(e){}
  /* 🧩 팀 전술 적응도(조직력) — 엔진이 famK(t) 로 읽어 패스·판단·위치선정·팀워크에 얹는다.
     안 보내면 클론은 기본값 70 으로 붙는다 — 시즌 내내 손발을 맞춰 95까지 올려 둔 팀이
     대전에서만 처음 만난 팀처럼 뛰었다. */
  let fam=70; try{ fam=clamp(Math.round(famOf(t)), 0, 100); }catch(e){}
  let st=3; try{ st=Math.round(teamStarVal(t)*10)/10; }catch(e){}
  return {ver:PVP_VER, name:String(t.name||"").slice(0,16), short:String(t.short||"").slice(0,8),
          col:t.col||"#2a6ee8", mgr:pvpNick(),   // 🎫 제보 — 닉네임으로 매칭·표시
          stars:st, tac, kk, capNo, fam, pl};
}
/* 패키지 → 클론 팀 (모든 값을 소독한다 — 상대가 보낸 데이터다) */
function pvpBuildTeam(pk, idSuffix){
  const t={id:"pvp_"+(idSuffix||"opp"), name:String(pk.name||"상대 팀").slice(0,16), short:String(pk.short||"상대").slice(0,8),
    col:/^#[0-9a-fA-F]{3,8}$/.test(pk.col||"")?pk.col:"#2a6ee8", col2:"#1c1c1c",
    div:0, budget:0, fans:20, players:[], form:[], morale:75, isUser:false, pvp:true,
    tactic:{formation:"4-3-3", mentality:2, pass:2, tempo:2, press:2, line:2, width:2, counter:2, crossFq:2, longShot:2, benchSel:[]},
    W:0,Dw:0,L:0,GF:0,GA:0,Pts:0, aclMoney:0};
  try{ const FS=["4-3-3","4-4-2","4-2-3-1","3-5-2","3-4-3","5-3-2","4-1-4-1","5-4-1","4-4-1-1","4-3-1-2"];
    const tk=pk.tac||{};
    if(FS.indexOf(tk.formation)>=0 || (typeof FORMATIONS==="object" && FORMATIONS[tk.formation])) t.tactic.formation=tk.formation;
    for(const k of ["mentality","pass","tempo","press","line","width","counter","crossFq","longShot"])
      if(typeof tk[k]==="number") t.tactic[k]=clamp(Math.round(tk[k]),0,4);
  }catch(e){}
  const arr=Array.isArray(pk.pl)?pk.pl.slice(0,20):[];
  const _made=[];                      // ⚔️ 원본 항목 ↔ 만들어진 선수 (제보: 전술이 다르게 나온다)
  for(const q of arr){
    try{
      const pos=["GK","DF","MF","FW"].indexOf(q.pos)>=0?q.pos:"MF";
      const by=clamp(Math.round(q.by||2000), G.season-45, G.season-16);
      const p=mkPlayer(String(q.n||"선수").slice(0,12), pos, by, clamp(Math.round(q.ovr||60),40,96), q.frn?1:0,
                       {no:clamp(Math.round(q.no||0),0,99), h:clamp(Math.round(q.h||178),150,210), w:clamp(Math.round(q.w||74),50,110)});
      if(q.hg) p.hg=1;                                              // 🌱 홈그로운 — 외국인 쿼터 계산
      if(q.attr) for(const k in q.attr){ if(p.attr && typeof p.attr[k]==="number") p.attr[k]=clamp(Math.round(q.attr[k]),15,99); }
      if(q.gkA && p.gkA) for(const k in q.gkA){ if(typeof p.gkA[k]==="number") p.gkA[k]=clamp(Math.round(q.gkA[k]),15,99); }
      try{ syncLegacyAttrs(p.attr); if(p.gkA) syncLegacyGk(p); }catch(e){}
      const pref=(typeof q.pref==="string" && SLOT_FAM[q.pref])?q.pref:null;
      if(pref){ p.prefPos=pref; }
      p.posFam=initPosFam(p);
      if(q.fam) for(const k of FAM_POS){ if(typeof q.fam[k]==="number") p.posFam[k]=clamp(Math.round(q.fam[k]),0,100); }
      /* 🎓 역할 능숙도 — 엔진이 실제로 읽는 값(roleFamMul). 안 옮기면 전원이 「처음 맡는 역할」이 된다 */
      if(q.rf && typeof q.rf==="object"){ p.roleFam=p.roleFam||{};
        for(const k in q.rf){ if(ROLE_BY_KEY[k] && typeof q.rf[k]==="number") p.roleFam[k]=clamp(Math.round(q.rf[k]),0,100); } }
      try{ syncPosBand(p); }catch(e){}
      if(Array.isArray(q.tr)) p.traits=q.tr.filter(x=>TRAIT_BY_KEY && TRAIT_BY_KEY[x]).slice(0,6);
      /* ⚠ mkPlayer 는 「자기가 만든 능력치」로 ovr 을 다시 계산한다 — 그 위에 패키지의 능력치를
         덮어썼으니 요약값만 옛 숫자로 남는다(실측 최대 3 차이). 원본 값으로 못 박는다.
         (화면 종합 dispOvr·별점은 능력치에서 나오므로 이미 같지만, p.ovr 을 직접 보는 곳들이 있다) */
      p.ovr=clamp(Math.round(q.ovr||p.ovr||60),40,96); p.ovrF=p.ovr;
      p.cond=95; p.inj=0; p.ban=0; p.morale=78; p.ct=1; p.wage=0;
      t.players.push(p);
      _made.push([q, p]);
    }catch(e){}
  }
  /* ⚔️ 감독이 확정한 배치·역할·선발을 그대로 옮긴다 (제보: 로비 그림과 경기가 다르다).
     ⚠ 등번호가 아니라 만들어진 선수 객체로 짝을 짓는다 — assignNumbers 가 빈 번호를
        채우는 과정에서 번호가 달라져도 어긋나지 않는다. */
  try{
    t.tactic.slot=t.tactic.slot||{}; t.tactic.role=t.tactic.role||{};
    const xiIds=[];
    for(const [q,p] of _made){
      if(q.sl && SLOT_XY[q.sl]) t.tactic.slot[p.id]=q.sl;
      if(q.rl && q.rl.r && typeof ROLE_BY_KEY!=="undefined" && ROLE_BY_KEY[q.rl.r])
        t.tactic.role[p.id]={r:q.rl.r, d:pvpDuty(q.rl.r, q.rl.d)};
      if(q.xi) xiIds.push(p.id);
    }
    /* 옛 빌드 호환 — xi 표시가 없으면 예전 규칙(앞 11명이 선발)을 그대로 쓴다 */
    if(xiIds.length!==11 && _made.length>=11) for(let i=0;i<11;i++) xiIds[i]=_made[i][1].id;
    if(xiIds.length===11) t.pvpXI=xiIds;
    /* 🎯 전담 키커 — 등번호로 옮겨 담는다 (엔진의 designatedKicker 가 tactic.kickers 를 읽는다) */
    const byNo={}; for(const [,p] of _made) if(p && p.no!=null) byNo[p.no]=p;
    const K={pk:[], fk:[], ck:[], so:[]};
    if(pk.kk && typeof pk.kk==="object") for(const kind of ["pk","fk","ck","so"]){
      const arr=Array.isArray(pk.kk[kind])?pk.kk[kind]:[];
      for(const no of arr.slice(0,5)){ const q=byNo[no]; if(q) K[kind].push(q.id); }
    }
    t.kickers=K; t.tactic.kickers=K;
    /* 🧩 조직력 — 엔진이 famK 로 읽는다 (안 옮기면 기본값 70 으로 떨어진다) */
    if(typeof pk.fam==="number") t.fam=clamp(Math.round(pk.fam), 0, 100);
    /* 🎖️ 주장 — 그라운드의 리더 보정이 감독이 지정한 선수에게 붙게 한다 */
    if(pk.capNo && byNo[pk.capNo]) t.cap={c:byNo[pk.capNo].id, s:G.season, set:true};
  }catch(e){}
  /* ⚠ assignAIRoles(t) 를 그냥 부르면 방금 옮겨 놓은 역할을 덮어쓴다 — 빈 자리만 채우게 한다 */
  try{ assignNumbers(t); assignAIRoles(t, true); }catch(e){}
  return t;
}
/* 소프트 치트 검사 — 팀 전력이 터무니없으면 표시해 준다 (수락/거절은 감독 몫) */
function pvpPackCheck(pk){
  const out={ok:true, notes:[]};
  try{
    const arr=Array.isArray(pk.pl)?pk.pl:[];
    if(arr.length<11){ out.ok=false; out.notes.push("선수가 11명 미만"); return out; }
    const avg=arr.reduce((s,q)=>s+(q.ovr||60),0)/arr.length;
    if(avg>84) out.notes.push("평균 능력치가 리그 최상위를 아득히 넘습니다 ("+Math.round(avg)+")");
    if(arr.some(q=>(q.ovr||0)>92)) out.notes.push("능력치 상한(92)을 넘는 선수 포함");
  }catch(e){}
  return out;
}

/* ── 상태 스냅샷 — 호스트 → 게스트, 바이너리 (초당 20회) ─────────────────── */
function pvpEncodeSnap(sim, M){
  /* 기본 = 라이브 시뮬 상태 */
  /* 🦘 ⚠ 제보 — 「바둑알 점프 효과도 게스트에 나오니?」 안 나왔다. 점프 높이가 스냅샷에
     아예 없어서 게스트의 가짜 선수는 늘 지면에 붙어 있었다(그림자도 안 생겼다).
     ─ 바이트를 늘리지 않고 보낸다: 각도(face)는 16비트를 다 쓸 필요가 없다.
       상위 12비트에 각도(0.088° 눈금 — 눈으로 구분 불가), 하위 4비트에 점프 높이(0~1)를 담는다.
       옛 빌드가 16비트를 통째로 각도로 읽어도 오차가 0.08° 밖에 안 돼 티가 안 난다
       — 그래서 PVP_VER 을 올리지 않아도 서로 붙는다. */
  let list=(sim.agents||[]).map(a=>({side:a.side, no:(a.p&&a.p.no)||0, x:a.x, y:a.y, face:a.face||0,
                                     jz:(function(){ try{ return jumpZOf(a, sim.t); }catch(e){ return 0; } })()}));
  let b=sim.ball||{x:.5,y:.5,z:0};
  /* ⚠ 제보 — 「게스트 스코어가 다르게 표시된다」.
     원인: 여기서 보내는 점수는 시뮬의 현재 값(M.hg)이다. 그런데 호스트 전광판은
        「화면이 그 골에 도달한 시점」의 값(shownHg)을 쓴다 — 시뮬이 먼저 넣고 하이라이트·
        문자중계가 뒤따라오므로 둘은 몇 초에서 몇십 초까지 벌어진다.
        그래서 게스트 쪽 숫자가 호스트보다 먼저 올라가고, 서로 다른 점수가 보였다(스포일러이기도 하다).
     ─ 호스트 전광판이 쓰는 바로 그 값을 보낸다. */
  let hg=M.hg||0, ag=M.ag||0;
  /* ⚠ shownHg 는 「지금 굴러가는 그 경기」의 전광판 값이다 — 다른 M 이면 쓰면 안 된다 */
  try{
    if(typeof liveM!=="undefined" && M===liveM && typeof liveSim!=="undefined" && liveSim
       && typeof shownHg==="number" && typeof shownAg==="number"){ hg=shownHg; ag=shownAg; }
  }catch(e){}
  /* ⚠ 제보(풀 동기화) — 「서로 매치엔진 화면이 다르게 나와」. 호스트가 하이라이트를 재생 중이면
     라이브 좌표 대신 「지금 화면에 재생 중인 그 프레임」을 보낸다 — 게스트도 같은 장면을
     같은 타이밍에 본다. 점수는 장면이 끝날 때까지 직전 값으로 잠근다 — 골 장면이 재생되기
     전에 스코어가 먼저 바뀌면 스포일러다 (호스트 UI와 같은 규칙). */
  try{
    if(PVP && typeof liveHL!=="undefined" && liveHL && liveHL.frames && liveHL.frames[liveHL.i]){
      if(!PVP._inHL){ PVP._inHL=1; PVP._hlHg=(PVP._lastHg!=null?PVP._lastHg:hg); PVP._hlAg=(PVP._lastAg!=null?PVP._lastAg:ag); }
      const f=liveHL.frames[liveHL.i];
      const map={};
      for(const pr of [[M.h,"h"],[M.a,"a"]]){ const sd=pr[0]; for(const e of ((sd&&sd.list)||[])) if(e.p) map[e.p.id]={side:pr[1], no:e.p.no||0}; }
      const fl=[];
      for(const q of (f.a||[])){ const inf=map[q.id]; if(!inf) continue; fl.push({side:inf.side, no:inf.no, x:q.x, y:q.y, face:q.face||0, jz:q.j||0}); }
      if(fl.length){ list=fl; b={x:f.bx, y:f.by, z:f.bz||0}; }
      hg=PVP._hlHg; ag=PVP._hlAg;
      /* 🟨🟥 카드 연출 — 프레임에 새 카드가 새겨진 순간 게스트에 통지 (제보: 카드 동기화) */
      try{
        if(f.cd){
          const ck=String(f.cd.id)+"|"+String(f.cd.min||"");
          if(PVP._cdKey!==ck){
            PVP._cdKey=ck;
            const ci=map[f.cd.id]||null;
            pvpSend({t:"cd", k:(f.cd.k==="R"?"R":"Y"), nm:String(f.cd.nm||"").slice(0,12),
                     ps:String(f.cd.ps||"").slice(0,4), tm:String(f.cd.tm||"").slice(0,18),
                     side:ci?ci.side:"", no:ci?ci.no:0});
          }
        }
      }catch(e){}
    } else if(PVP){ PVP._inHL=0; PVP._lastHg=hg; PVP._lastAg=ag; }
  }catch(e){}
  /* 볼 소유자 — 라이브면 sim.ball.ownerId, 하이라이트 재생 중이면 그 프레임의 oi */
  let ownByte=255;
  try{
    let oid=null;
    if(typeof liveHL!=="undefined" && liveHL && liveHL.frames && liveHL.frames[liveHL.i]) oid=liveHL.frames[liveHL.i].oi||null;
    else oid=(sim.ball&&sim.ball.ownerId)||null;
    if(oid){
      let inf=null;
      for(const pr of [[M.h,"h"],[M.a,"a"]]){ const sd=pr[0]; for(const e of ((sd&&sd.list)||[])) if(e.p&&e.p.id===oid){ inf={side:pr[1], no:e.p.no||0}; break; } if(inf) break; }
      if(!inf){ const g=(sim.agents||[]).find(x=>x.id===oid||(x.p&&x.p.id===oid)); if(g) inf={side:g.side, no:(g.p&&g.p.no)||0}; }
      if(inf) ownByte=(inf.side==="h"?128:0)|clamp(inf.no,0,99);
    }
  }catch(e){}
  /* 상태 플래그 — 전후반·연장·하이라이트 (게스트 전광판·연출 동기화용) */
  let flags=0;
  try{
    if(M.half===2) flags|=1;
    if(typeof liveHL!=="undefined" && liveHL) flags|=2;
    if(M.etOn) flags|=4;
    /* 🎯 ⚠ 제보 — 「게스트는 슈팅 트레일이 표시 안 된다」.
       트레일은 공이 「슛 상태인가」를 보고 꼬리 길이와 모양을 정하는데(drawSimWatch),
       스냅샷에 공 상태가 아예 안 실려 게스트의 가짜 공은 늘 평범한 공이었다.
       ─ 비트 하나로 실어 보낸다. 하이라이트 재생 중이면 그 프레임에 새겨진 bs 를 본다. */
    let _shot=false;
    if(typeof liveHL!=="undefined" && liveHL && liveHL.frames && liveHL.frames[liveHL.i]){
      const _f=liveHL.frames[liveHL.i];
      _shot = (_f.bs!==undefined) ? (_f.bs==="SHOT") : false;
    } else _shot = !!(sim.ball && sim.ball.state==="SHOT");
    if(_shot) flags|=8;
  }catch(e){}
  /* 🎈 ⚠ 제보 — 「공이 뜨는 건 나와?」 나오지 않았다.
     볼 높이는 z*10 을 한 바이트에 담았는데, z 는 등방 좌표(1 = 70m)다.
     3m 짜리 공이 z=0.043 → round(0.43)=0 — 3.5m 아래는 통째로 땅볼로 눌리고
     그 위는 7m 단위 계단이었다. 크로스도 로빙도 게스트 화면에서는 평면이었다.
     ─ flags 의 남는 상위 니블(4비트)에 하위 자릿수를 실어 12비트로 늘린다.
       눈금이 7m → 0.47m 로 촘촘해지고, 옛 빌드는 정수부(=거의 늘 0)만 읽으므로
       지금과 똑같이 동작한다 — 그래서 PVP_VER 을 올리지 않아도 된다. */
  let _z10=0, _zFrac=0;
  try{
    const _zz=clamp(b.z||0, 0, 25.5)*10;
    _z10=Math.min(255, Math.floor(_zz));
    _zFrac=clamp(Math.round((_zz-_z10)*15), 0, 15);
    flags |= (_zFrac<<4);
  }catch(e){}
  const buf=new ArrayBuffer(18+list.length*7);
  const dv=new DataView(buf);
  dv.setUint16(0, Math.min(65535, Math.round(sim.clock||0)));
  dv.setUint8(2, clamp(hg,0,255)); dv.setUint8(3, clamp(ag,0,255));
  dv.setUint8(4, list.length);
  dv.setUint16(5, Math.round(clamp(b.x,0,1)*65535)); dv.setUint16(7, Math.round(clamp(b.y,0,1)*65535));
  dv.setUint8(9, _z10);                 // 볼 높이 정수부 (하위 4비트는 flags 상위 니블에)
  dv.setUint8(10, ownByte);
  dv.setUint8(11, flags);
  dv.setUint16(12, Date.now()&65535);   // 송신 시각 (16비트 순환 — 게스트가 풀어서 잇는다)
  /* 주심 — 라이브면 sim.ref, 하이라이트 재생 중이면 그 프레임의 rx/ry (제보: 화면 완전 동일화) */
  let rfx=65535, rfy=65535;
  try{
    let rp=null;
    if(typeof liveHL!=="undefined" && liveHL && liveHL.frames && liveHL.frames[liveHL.i]){
      const f=liveHL.frames[liveHL.i];
      if(f.rx!=null) rp={x:f.rx, y:f.ry};
    } else if(sim.ref) rp={x:sim.ref.x, y:sim.ref.y};
    if(rp){ rfx=Math.round(clamp(rp.x,0,1)*65534); rfy=Math.round(clamp(rp.y,0,1)*65534); }
  }catch(e){}
  dv.setUint16(14, rfx); dv.setUint16(16, rfy);
  let o=18;
  for(const a of list){
    dv.setUint8(o, (a.side==="h"?128:0) | clamp(a.no,0,99)); o++;
    dv.setUint16(o, Math.round(clamp(a.x,0,1)*65535)); o+=2;
    dv.setUint16(o, Math.round(clamp(a.y,0,1)*65535)); o+=2;
    /* 상위 12비트 = 각도 · 하위 4비트 = 점프 높이(0~15) */
    const _ang=Math.round((((a.face||0)%(Math.PI*2))+Math.PI*2)%(Math.PI*2)/(Math.PI*2)*4095);
    const _jn=clamp(Math.round((a.jz||0)*15), 0, 15);
    dv.setUint16(o, ((_ang&4095)<<4) | _jn); o+=2;
  }
  return buf;
}
function pvpDecodeSnap(buf){
  const dv=new DataView(buf);
  const n=dv.getUint8(4);
  const ob=dv.getUint8(10), fl=dv.getUint8(11);
  const s={clock:dv.getUint16(0), hg:dv.getUint8(2), ag:dv.getUint8(3),
    ball:{x:dv.getUint16(5)/65535, y:dv.getUint16(7)/65535, z:(dv.getUint8(9)+((fl>>4)&15)/15)/10},
    own: ob===255?null:{side:(ob&128)?"h":"a", no:ob&127},
    half2:!!(fl&1), hl:!!(fl&2), et:!!(fl&4), shot:!!(fl&8),
    sTag:dv.getUint16(12),
    ags:[]};
  { const rx=dv.getUint16(14), ry=dv.getUint16(16);
    s.ref=(rx===65535)?null:{x:rx/65534, y:ry/65534}; }
  let o=18;
  for(let i=0;i<n;i++){
    const f=dv.getUint8(o);
    const _w=dv.getUint16(o+5);
    s.ags.push({side:(f&128)?"h":"a", no:f&127,
      x:dv.getUint16(o+1)/65535, y:dv.getUint16(o+3)/65535,
      face:((_w>>4)&4095)/4095*Math.PI*2,
      jz:(_w&15)/15});
    o+=7;
  }
  return s;
}

/* ── 매치메이킹 · 방 · 시그널링 ──────────────────────────────────────────── */
function pvpReset(keepLog){
  try{ if(PVP&&PVP.es) PVP.es.close(); }catch(e){}
  try{ if(PVP&&PVP.esQ) PVP.esQ.close(); }catch(e){}
  try{ if(PVP&&PVP.reIv) clearInterval(PVP.reIv); }catch(e){}   // ⚡ 대기열 재훑기 (제보: 빠른 대전이 늦다)
  try{ if(PVP&&PVP.offIv) clearInterval(PVP.offIv); }catch(e){}  // 📴 상대 이탈 감시 (요청)
  try{ if(PVP&&PVP.invTO) clearTimeout(PVP.invTO); }catch(e){}
  try{ if(PVP&&PVP.pc) PVP.pc.close(); }catch(e){}
  try{ if(PVP&&PVP.snapT) clearInterval(PVP.snapT); }catch(e){}
  try{ if(PVP&&PVP.helloT) clearInterval(PVP.helloT); }catch(e){}
  try{ if(PVP&&PVP.guardIv) clearInterval(PVP.guardIv); }catch(e){}   // ⏱️ 연결 감시견 (제보: 먹통)
  try{ pvpAwayStop(); }catch(e){}      // ⏸ 자리 비움 안내·타이머 (제보: 일반 경기에 따라온다)
  try{ const ov=document.getElementById("pvpAwayOv"); if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); }catch(e){}
  try{ const ov2=document.getElementById("pvpHtOv"); if(ov2&&ov2.parentNode) ov2.parentNode.removeChild(ov2); }catch(e){}
  try{ if(PVP&&PVP.tacIv) clearInterval(PVP.tacIv); }catch(e){}
  try{ if(PVP&&PVP.tacBlIv) clearInterval(PVP.tacBlIv); }catch(e){}
  try{ if(PVP&&PVP.tacTO) clearTimeout(PVP.tacTO); }catch(e){}
  try{ if(PVP&&PVP.tacTO2) clearTimeout(PVP.tacTO2); }catch(e){}
  for(const _id of ["pvpTacOv","pvpTacBl"]){ try{ const o=document.getElementById(_id); if(o&&o.parentNode) o.parentNode.removeChild(o); }catch(e){} }
  try{ if(PVP&&PVP.qEntry) fbDel("queue/"+PVP.qEntry); }catch(e){}
  try{ if(PVP&&PVP.room&&PVP.role==="host"&&PVP.stage!=="match") fbDel("rooms/"+PVP.room); }catch(e){}
  PVP=null;
  try{ pvpNavSync(); }catch(e){}   // ⚔️ 메뉴 잠금 해제 (제보 — 매칭 중 메뉴 비활성화)
}
function pvpCode(){ const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<6;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }
/* ⏱️ 안전장치 ② — 진입 절차 중복 실행 차단 (제보: 공개방 입장 시 먹통).
   pvpQuick·pvpMakeRoom·pvpJoinRoom 은 맨 앞에서 `PVP` 만 봤는데, PVP 는 서버 응답을
   기다리는 동안에도 계속 null 이다. 그 틈에 버튼을 한 번 더 누르면 두 절차가 동시에 돌며
   서로의 PVP 를 덮어써, 살아남은 쪽이 없는 방을 바라보게 된다(=먹통).
   ─ 절차가 끝날 때까지 잠근다. */
/* ⚠ var — pvpBusy() 가 이 줄보다 위(61236)에 있어 let 이면 TDZ 사고가 날 수 있다 */
var PVP_BUSY=0;
function pvpEnterLock(){ if(PVP_BUSY||PVP) return false; PVP_BUSY=1; try{ pvpNavSync(); }catch(e){} return true; }
function pvpEnterFree(){ PVP_BUSY=0; try{ pvpNavSync(); }catch(e){} try{ if(VIEW==="pvp") show("pvp"); }catch(e){} }
/* ⏱️ 안전장치 ③ — 「연결 중」에서 멈추면 스스로 빠져나온다.
   상대가 방에 있는 것까지는 확인됐는데 P2P 가 끝내 안 붙는 경우(포트 차단·상대가 창을 닫음·
   시그널 유실)가 있다. 예전에는 배너만 돌 뿐, 유저가 취소를 누르기 전까지 영영 그대로였다.
   ⚠ 상대를 기다리는 단계(대기열·빈 공개 방)에는 걸지 않는다 — 그건 정상적인 기다림이다. */
const PVP_CONN_TO=35000;
function pvpConnGuard(ms){
  if(!PVP) return;
  try{ if(PVP.guardIv) clearInterval(PVP.guardIv); }catch(e){}
  PVP.connDL=Date.now()+(ms||PVP_CONN_TO);
  PVP.guardIv=setInterval(()=>{
    try{
      if(!PVP || !PVP.guardIv) return;
      const done=(PVP.stage==="match"||PVP.stage==="done"||(PVP.stage==="lobby"&&PVP.oppPack));
      if(done){ clearInterval(PVP.guardIv); PVP.guardIv=null; return; }
      if(Date.now() < PVP.connDL) return;
      clearInterval(PVP.guardIv); PVP.guardIv=null;
      pvpAbort("상대와 연결하지 못했습니다 — 잠시 뒤 다시 시도해 주세요.");
    }catch(e){}
  }, 2000);
}
function pvpSt(msg){ if(PVP) PVP.msg=msg; try{ if(VIEW==="pvp") show("pvp"); }catch(e){} }

/* 방 만들기 (친구 초대) — 나 = 호스트 */
async function pvpMakeRoom(pub){
  if(!pvpOn()) return;
  if(!pvpEnterLock()) return;        // ⏱️ 중복 클릭 차단 (제보: 먹통)
  try{
    if(!pvpNetGate()) return;        // 🌐 제보 — 연결이 끊겨 있으면 방을 열 수 없다
    const code=pvpCode();
    PVP={stage:"room", role:"host", room:code, myId:pvpId(), pub:pub?1:0, msg:"방을 만드는 중…"};
    const t=userTeam()||{};
    let st10=30; try{ st10=Math.round(teamStarVal(t)*10); }catch(e){}
    const ok=await fbSet("rooms/"+code, {h:{id:PVP.myId, n:t.short||"?", nick:pvpNick(), tn:String(t.name||"").slice(0,16), sv:st10, ver:PVP_VER},
                                         pub:pub?1:0, st:"wait", t:Date.now()});
    if(!ok){ pvpReset(); PVP=null; flash("⚔️ 서버에 연결하지 못했습니다.","warn"); show("pvp"); return; }
    pvpSt("방 코드: "+code+(pub?" — 공개 방입니다. 목록에서 상대가 들어올 수 있습니다":" — 상대가 입장하면 자동으로 연결됩니다"));
    pvpWatchRoom();
  }catch(e){
    /* ⏱️ 어떤 이유로든 절차가 터지면 배너를 남기지 않고 메뉴로 돌려보낸다 (제보: 먹통) */
    try{ pvpReset(); }catch(_){} PVP=null;
    try{ flash("⚔️ 방을 만들지 못했습니다 — 다시 시도해 주세요.","warn"); show("pvp"); }catch(_){}
  }finally{ pvpEnterFree(); }
}
/* ═══ 🌐 온라인 대전 라운지 — 연결 상태 · 접속 인원 · 로비 채팅 · 닉네임 장부 ═══════
   ⚠ 제보 원문 — 「온라인 대전에서 인터넷 연결이 안되어있으면 인터넷 연결이 되어있지않습니다
      같은 팝업이 나오고 못들어가게 해야겠지? 그리고 실시간으로 온라인 대전 메뉴에 접속하고
      있는 인원도 표시되게 할 수 있니? 그리고 온라인 대전 메뉴에서도 채팅을 할 수 있게 하면
      좋겠네. (물론 닉네임을 먼저 정해야 채팅할 수 있고, 닉네임도 중복되면 안되야해)」
   Firebase 에 세 갈래가 새로 생긴다 — live(접속 표시) · talk(라운지 채팅) · nicks(닉네임 장부).
   ⚠ 배포 전에 보안 규칙을 새 판으로 바꿔야 한다 (온라인대전_설정가이드.md 2번). */
const PVP_LIVE_MS=20000;              // 접속 표시 갱신 주기
const PVP_LIVE_TTL=70000;             // 이보다 오래된 표시는 나간 것으로 본다
const PVP_LIVE_PURGE=10*60*1000;      // 이보다 오래된 유령 표시는 지운다 (창을 강제로 닫은 잔재)
const PVP_NICK_TTL=30*24*60*60*1000;  // 30일 동안 안 오면 닉네임 점유가 풀린다
const PVP_TALK_SHOW=40;               // 화면에 남기는 줄 수
const PVP_TALK_TTL=3*60*60*1000;      // 이보다 오래된 줄은 지운다
const PVP_TALK_GAP=2500;              // 도배 방지 간격
/* 🌐 ⚠ 제보 원문 — 「온라인 대전 메뉴에서 다른 유저의 실시간 전적도 볼 수 있게 해줄래?
   다른 유저들이 경기 마치면 그 결과도 기록이되어 나오는거지」.
   경기가 끝나면 호스트가 결과를 한 줄 올리고, ⚔️ 메뉴를 보고 있는 모두가 실시간으로 본다. */
const PVP_RES_SHOW=25;                // 화면에 남기는 경기 수
const PVP_RES_TTL=3*24*60*60*1000;    // 사흘이 지난 결과는 지운다
let PVP_NET=null;                     // null=아직 확인 전 · true=연결됨 · false=끊김
let PVP_LIVE=null;                    // {es, esT, iv, list, n}
let PVP_TALK=null;                    // {rows, at}
let PVP_RES=null;                     // {rows}
let PVP_TIER={rows:null, my:null, rank:null};   // 🏅 시즌 티어 (개발 노트)

/* ── 🌐 연결 확인 ─────────────────────────────────────────────────────────
   navigator.onLine 은 「랜선이 꽂혀 있다」만 알려 준다(공유기만 붙어도 true).
   실제로 대전 서버까지 닿는지 한 번 두드려 봐야 한다. */
function pvpNetOnline(){ try{ return navigator.onLine!==false; }catch(e){ return true; } }
async function pvpNetCheck(quiet){
  if(!pvpOn()){ PVP_NET=false; return false; }
  let ok=false;
  if(pvpNetOnline()){
    try{
      let sig=null, to=null;
      if(typeof AbortController!=="undefined"){ const c=new AbortController(); sig=c.signal; to=setTimeout(()=>{ try{ c.abort(); }catch(e){} }, 7000); }
      const r=await fetch(fbU("queue"), sig?{signal:sig}:{});
      if(to) clearTimeout(to);
      ok=!!(r && (r.ok || r.status===401));   // 401 도 「서버까지는 닿았다」는 뜻이다
    }catch(e){ ok=false; }
  }
  const changed=(PVP_NET!==ok);
  PVP_NET=ok;
  /* 🗣️ 커뮤니티도 같은 연결을 쓴다 — 상태가 바뀌면 그 화면도 같이 고쳐 그린다 (요청) */
  if(changed && !quiet){ try{ if(VIEW==="pvp") show("pvp"); else if(VIEW==="comm") show("comm"); }catch(e){} }
  if(ok && changed){ try{ pvpLiveBeat(); }catch(e){}
    try{ if(VIEW==="comm") cmLoad(true); }catch(e){} }
  return ok;
}
/* 매칭·채팅 버튼의 문지기 — 끊겨 있으면 팝업을 띄우고 막는다 */
function pvpNetGate(){
  if(PVP_NET!==false) return true;
  gameAlert("🌐 인터넷에 연결되어 있지 않습니다.\n\n온라인 대전은 인터넷 연결이 있어야 이용할 수 있습니다.\n연결을 확인한 뒤 다시 시도해 주세요.");
  try{ pvpNetCheck(); }catch(e){}
  return false;
}
try{ if(typeof window!=="undefined" && window.addEventListener){
  window.addEventListener("online",  ()=>{ try{ pvpNetCheck(); }catch(e){} });
  window.addEventListener("offline", ()=>{ PVP_NET=false;
    try{ if(CMB && CMB.ok!==false){ CMB.ok=false; CMB.why="net"; } }catch(e){}
    try{ if(VIEW==="pvp") show("pvp"); else if(VIEW==="comm") show("comm"); }catch(e){} });
  window.addEventListener("pagehide", ()=>{ try{ if(PVP_LIVE) fbDel("live/"+pvpId()); }catch(e){} });
} }catch(e){}

/* ── 🟢 접속 인원 ─────────────────────────────────────────────────────────
   ⚔️ 메뉴를 보고 있는 동안만 live/{내 id} 에 심장박동을 남긴다. 화면을 떠나면 지운다. */
function pvpPresenceSync(v){
  /* ⚔️ 개발 노트 — 「유저가 대전중이면 대전중이라고 표시」. 경기·로비 중에도 접속 표시를
     끄지 않고 유지한다 — 심장박동에 m(대전 중) 표식이 실린다. */
  try{
    const busy=(typeof pvpBusy==="function") && pvpBusy();
    if((v==="pvp" || busy) && pvpOn()) pvpLiveStart(); else pvpLiveStop();
  }catch(e){}
}
function pvpLiveStart(){
  if(PVP_LIVE){ pvpLiveBeat(); return; }
  PVP_LIVE={es:null, esT:null, esR:null, iv:null, ivFast:null, ivInv:null, list:null, n:0, _miss:0};
  PVP_TALK=PVP_TALK||{rows:null, at:0};
  PVP_RES=PVP_RES||{rows:null};
  /* ⚠ 제보 — 「'나'가 늦게 뜬다」. 심장박동은 비동기라, 기다리지 않고 목록을 읽으면
     내 칸이 아직 서버에 없다. 박동이 끝난 뒤에 읽는다. */
  /* ⚠ 제보 — 「과거엔 1대1도 빠대도 잘 됐는데 지금은 둘 다 안 된다」.
     내가 상시 연결(스트림)을 주기 조회로 바꾼 것이 원인이었다. 두 가지가 한꺼번에 무너졌다.
       ① 초대장은 접속 표시 칸에 얹히는데, 스트림은 밀리초 만에 그 변화를 알려 준다.
          주기 조회로 바꾸자 20초 심장박동이 초대장을 덮는 경합이 그대로 드러났다.
       ② 스트림은 「바뀐 부분만」 보내지만, 조회는 매번 「트리 전체」를 받는다.
          접속자 칸에는 선발 11명 스냅샷까지 실려 있어 한 사람당 0.5KB가 넘는다 —
          N명이 5초마다 N개를 받으면 내려받기 양이 N² 로 불어난다. 무료 요금제의
          월 내려받기 한도를 며칠 만에 태우고, 한도를 넘기면 데이터베이스가 통째로
          막혀 매칭도 방 입장도 전부 실패한다.
     ─ 원래대로 되돌린다. live·talk·results 세 개는 스트림, 그 위에 얹었던 조회는 전부 뺀다.
       (연결이 끊기던 진짜 원인은 여기에 rank·tier 스트림 두 개를 더 얹은 것이었다 — 그건 이미 뺐다) */
  pvpLiveBeat();
  /* ⚠ 제보 원문 — 「여전히 매칭에서 연결이 끊긴다. 심지어 모바일에서도 끊긴다」.
     원인: 상시 연결(EventSource)을 너무 많이 열고 있었다.
       ⚔️ 메뉴에 서 있기만 해도 live·talk·results 로 3개, 매칭에 들어가면 queue 나 rooms 까지
       4~5개다. 브라우저는 한 서버당 동시 연결에 상한이 있고(HTTP/1.1 기준 6개), Firebase
       무료 요금제는 프로젝트 전체 동시 접속에 상한(100)이 있다.
       → 사람당 5개면 스무 명이 한계다. 그 위로는 새로 여는 연결부터 거부되는데,
         하필 매칭·방 입장이 그 새 연결이라 「연결이 끊겼습니다」로 나타난다.
         (모바일은 상한이 더 빡빡해 먼저 무너진다.)
     ─ 정말로 즉시성이 필요한 것만 상시 연결로 남긴다.
       · talk(채팅) — 한 박자만 늦어도 대화가 안 되므로 스트림 유지
       · live(접속자) — 어차피 20초 심장박동이라 스트림일 이유가 없다 → 주기 조회로
       · results(전적) — 경기가 끝날 때만 바뀐다 → 주기 조회로
       상시 연결이 3개에서 1개로 줄어, 매칭이 쓸 자리가 넉넉해진다. */
  try{ PVP_LIVE.es =fbStream("live",    (tree)=>{ try{ pvpLiveApply(tree); }catch(e){} }); }catch(e){}
  try{ PVP_LIVE.esT=fbStream("talk",    (tree)=>{ try{ pvpTalkApply(tree); }catch(e){} }); }catch(e){}
  try{ PVP_LIVE.esR=fbStream("results", (tree)=>{ try{ pvpResApply(tree); }catch(e){} }); }catch(e){}
  /* 🔄 ⚠ 요청 — 「랭킹들 변경되는 게 있을 때마다 갱신되게 해 줘」.
     ⚠ 제보 — 이걸 rank·tier 전용 스트림 두 개로 붙였더니 온라인 연결이 끊기기 시작했다.
        브라우저는 한 서버에 열어 둘 수 있는 연결 수가 정해져 있는데(HTTP/1.1 기준 6개),
        live·talk·results 로 이미 세 개를 쓰고 있었다. 거기에 둘을 더 얹으니 남는 자리가
        없어져, 정작 매칭·방 입장에 쓰는 일반 요청이 자리를 못 잡고 시한(9초)에 걸렸다.
     ⚠ Firebase 무료 요금제는 동시 접속 수 자체에 상한(100)이 있다. 한 사람이 스트림을
        셋에서 다섯으로 늘리면 수용 인원이 33명에서 20명으로 줄어든다 — 사람이 몰리면
        새로 들어오는 쪽부터 연결이 거부된다.
     ─ 새 연결을 열지 않는다. 랭킹이 바뀌는 순간은 「경기가 끝났을 때」뿐이고, 그건 이미
       results 스트림이 알고 있다. 그 신호에 얹어서 두 표를 다시 그린다. */
  PVP_LIVE.iv=setInterval(()=>{ try{ pvpLiveBeat(); }catch(e){} }, PVP_LIVE_MS);
}
function pvpLiveStop(){
  if(!PVP_LIVE) return;
  try{ if(PVP_LIVE.es)  PVP_LIVE.es.close(); }catch(e){}
  try{ if(PVP_LIVE.esT) PVP_LIVE.esT.close(); }catch(e){}
  try{ if(PVP_LIVE.esR) PVP_LIVE.esR.close(); }catch(e){}
  try{ if(PVP_RANK && PVP_RANK.poke){ clearTimeout(PVP_RANK.poke); PVP_RANK.poke=null; } }catch(e){}
  try{ if(PVP_LIVE.iv)  clearInterval(PVP_LIVE.iv); }catch(e){}
  try{ if(PVP_LIVE.ivFast) clearInterval(PVP_LIVE.ivFast); }catch(e){}
  try{ if(PVP_LIVE.ivInv)  clearInterval(PVP_LIVE.ivInv); }catch(e){}
  PVP_LIVE=null;
  try{ fbDel("live/"+pvpId()); }catch(e){}
}
/* 🔭 접속 목록용 선발 스냅샷 — 접속 표시(live/{id})에 함께 실어 보낸다.
   ⚠ 요청 원문 「접속중인 유저에서 유저 닉네임 클릭하면 지금은 1대1 대전 신청만 가능하잖아.
      여기에 추가로 상대 포메이션 보기 해서 상대 스쿼드 베스트 11 포메이션을 볼 수 있게 해줘」.
   ⚠ 전체 스쿼드 패키지(pvpPack)는 20명 + 전 능력치라 20초마다 올리기엔 너무 크다.
      그림에 필요한 11명의 이름·등번호·배치 자리만 담는다 (≈0.5KB).
   ⚠ 20초마다 bestXI 를 다시 도는 것도 낭비다 — 60초 캐시를 둔다. */
let PVP_FPK=null, PVP_FPK_T=0;
function pvpFormPack(){
  try{
    if(PVP_FPK && Date.now()-PVP_FPK_T < 60000) return PVP_FPK;
    const t=userTeam(); if(!t) return null;
    const xi=(bestXI(t)||[]).slice(0,11); if(!xi.length) return null;
    let sl={}; try{ sl=computeRenderSlots(t, xi)||{}; }catch(e){}
    let sv=30; try{ sv=Math.round(teamStarVal(t)*10); }catch(e){}
    let fm=""; try{ fm=formationLabel(t, xi)||""; }catch(e){}
    PVP_FPK={
      tn:String(t.name||"").slice(0,16), ts:String(t.short||"").slice(0,8),
      c:/^#[0-9a-fA-F]{3,8}$/.test(t.col||"")?t.col:"#2a6ee8",
      fm:String(fm).slice(0,14), sv:sv,
      p:xi.map(p=>({n:String(p.name||"").slice(0,10), no:clamp(Math.round(p.no||0),0,99),
                    s:(sl[p.id]&&SLOT_XY[sl[p.id]])?sl[p.id]:null,
                    po:(["GK","DF","MF","FW"].indexOf(p.pos)>=0?p.pos:"MF"),
                    o:clamp(Math.round(p.ovr||60),40,99)}))
    };
    PVP_FPK_T=Date.now();
    return PVP_FPK;
  }catch(e){ return null; }
}
/* 스쿼드·전술이 바뀌면 캐시를 버린다 — 낡은 포메이션을 보여 주면 안 된다 */
function pvpFormPackDirty(){ PVP_FPK=null; PVP_FPK_T=0; }
async function pvpLiveBeat(){
  if(!pvpOn() || !PVP_LIVE) return;
  const inMatch=(typeof PVP!=="undefined") && PVP && (PVP.stage==="match"||PVP.stage==="lobby") ? 1 : 0;   // ⚔️ 대전 중 표식
  /* 🟡 ⚠ 요청 — 「유저 표시되는 곳에 '매칭중' 표시도 나오게 해 줘. 지금은 대전중만 나온다」.
     대기열·방 대기·연결 중이 전부 「붙을 수 없는 상태」인데 표식이 없어서, 그 감독에게
     1:1 신청을 보내면 조용히 삼켜지고 90초 뒤에야 「응답 없음」으로 끝났다.
     ⚠ 옛 판과 섞여도 안전하게 새 칸(q)에 담는다 — 옛 판은 이 값을 그냥 무시한다. */
  const inQueue=(typeof PVP!=="undefined") && PVP && !inMatch
                && ["queue","room","connecting"].indexOf(PVP.stage)>=0 ? 1 : 0;
  const _f=pvpFormPack();
  /* ⚔️ ⚠ 제보 원문 — 「1대1 대전 신청하면 상대방한테 아무것도 안 뜬다」.
     원인 ① 1:1 신청은 상대의 접속 표시에 초대장을 얹는 방식(live/{id}.inv)인데,
            이 심장박동이 fbSet(=PUT, 칸 전체를 갈아끼움)이라 20초마다 초대장을 지워 버린다.
            예전에는 live 를 상시 연결로 듣고 있어 초대장이 밀리초 만에 도착했기 때문에
            덮이기 전에 처리됐다. 상시 연결을 주기 조회로 바꾸면서 이 경합이 드러났다.
     ─ 심장박동은 fbPatch(=칸 안의 값만 갱신)로 바꾼다. 초대장은 받는 쪽이 직접 지운다. */
  const _rec={n:String(pvpNick()).slice(0,8), t:Date.now(), ver:PVP_VER, m:inMatch, q:inQueue, f:_f||null};
  let ok=await fbPatch("live/"+pvpId(), _rec);
  /* ⚠ 보안 규칙이 부분 갱신을 막는 환경도 있다 — 그럴 땐 통째로 쓰는 옛 방식으로 되살린다.
     (통째로 쓰면 초대장이 지워지므로, 지우기 전에 들고 있다가 도로 얹는다) */
  if(!ok){
    let keep=null; try{ keep=await fbGet("live/"+pvpId()+"/inv"); }catch(e){}
    ok=await fbSet("live/"+pvpId(), keep? Object.assign({}, _rec, {inv:keep}) : _rec);
  }
  if(!ok){
    /* ⚠ 기다리는 사이에 화면을 떠나면 PVP_LIVE 가 사라져 있을 수 있다 */
    if(PVP_LIVE){
      PVP_LIVE._miss=(PVP_LIVE._miss||0)+1;
      if(PVP_LIVE._miss>=2 && PVP_NET!==false){ PVP_NET=false; try{ if(VIEW==="pvp") show("pvp"); }catch(e){} }
    }
    return;
  }
  if(PVP_LIVE) PVP_LIVE._miss=0;
  if(PVP_NET!==true){ PVP_NET=true; try{ if(VIEW==="pvp") show("pvp"); }catch(e){} }
  /* 닉네임 점유도 함께 갱신한다 — 계속 쓰는 사람의 이름은 풀리지 않는다 */
  try{ const k=pvpNickKey(); if(k) fbPatch("nicks/"+k, {t:Date.now()}); }catch(e){}
}
/* 🔌 상시 연결 대신 주기 조회 (제보 — 상시 연결이 많아 매칭이 끊겼다).
   ⚠ 제보 원문 — 「원래는 바로바로 접속 중인 감독에 '나'도 잘 표시됐는데 늦게 뜬다.
      접속 목록도 좀 빠르게 갱신되게 해 달라. 이건 매칭과는 상관없잖아」.
   맞는 말이다 — 부담은 「상시 연결 수」에서 오지 조회 주기에서 오지 않는다.
   접속 목록은 5초마다, 전적은 바뀔 일이 드무니 20초마다 본다.
   1:1 초대장(live/{내id}.inv)도 이 5초 조회에 함께 실려 온다. */
const PVP_POLL_MS=5000;
const PVP_INV_MS=3000;      // ⚔️ 초대장은 내 칸 하나만 보므로 아주 짧게 봐도 부담이 없다
/* ⚔️ ⚠ 제보 — 「1대1 매칭이 여전히 안 된다」. 초대장은 목록 조회에 얹혀 오는데,
   목록이 큰 편이라 주기를 짧게 하기 어렵다. 초대장만 따로, 내 칸 하나만 2초마다 본다.
   (조회 한 번에 수십 바이트다 — 상시 연결이 아니므로 동시 접속 수에 영향이 없다) */
/* ⚔️ 보조 경로 — 이미 받아 온 방 목록에서 「나를 지목한 방」을 찾는다.
   접속 표시(live) 스트림이 초대장을 놓치는 아주 드문 경우를 위한 그물이다.
   ⚠ 이걸 위해 따로 조회하지 않는다 — 방 목록을 새로 고칠 때 그 결과를 그대로 훑는다. */
function pvpInvScanRooms(rooms){
  try{
    if(!pvpOn() || !PVP_LIVE || PVP) return;
    if(typeof liveM!=="undefined" && liveM) return;
    const mine=pvpId(); if(!mine) return;
    const now=Date.now();
    for(const code in (rooms||{})){
      const r=rooms[code];
      if(!r || !r.h || r.g || r.st!=="wait" || r.dec) continue;
      if(String(r.to||"")!==String(mine)) continue;
      if(now-(r.t||0) > 90000) continue;
      pvpInvShow(code, pvpClean(r.h.nick,8)||"감독", (r.h.ver|0));
      return;
    }
  }catch(e){}
}
/* ⚔️ 초대 팝업 — 두 경로(방 지목 · 접속 표시)가 같은 자리로 모인다 */
function pvpInvShow(code, nick, ver){
  try{
    const rm=String(code).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
    if(!rm || !PVP_LIVE) return;
    if(PVP_LIVE.invSeen===rm) return;
    if(PVP) return;
    try{ if(typeof liveM!=="undefined" && liveM) return; }catch(e){}
    PVP_LIVE.invSeen=rm;
    if(ver && ver!==PVP_VER){
      try{ fbPatch("rooms/"+rm, {dec:1, decWhy:"ver"}); }catch(e){}
      try{ flash(`⚔️ ${nick} 감독의 신청 — 게임 버전이 달라(v${ver}) 붙을 수 없습니다.`,"warn"); }catch(e){}
      return;
    }
    try{ fbSet("live/"+pvpId()+"/inv", null); }catch(e){}
    showConfirm(`<b>⚔️ 1:1 대전 신청이 왔습니다!</b>\n\n<b>${nick}</b> 감독이 지금 대전을 원합니다.\n받아들이시겠습니까?`,
      ()=>{ try{ pvpJoinRoom(rm); }catch(e){} },
      {okLabel:"⚔️ 받아들인다", cancelLabel:"거절한다",
       onCancel:()=>{ try{ fbPatch("rooms/"+rm, {dec:1}); }catch(e){} }});
  }catch(e){}
}
/* 🔧 연결 점검 — 무엇이 막혔는지 눈으로 보여 준다.
   ⚠ 제보 — 「빠대도 1대1도 안 된다」. 화면은 「연결하지 못했습니다」 한 줄만 주니
      규칙 문제인지, 요금제 한도인지, 그물 문제인지 구분이 안 된다.
      각 단계의 HTTP 응답 코드를 그대로 보여 준다.
        200/204 정상 · 401 규칙에 막힘 · 402/429 요금제 한도 초과 · 0 그물이 끊김 */
async function pvpDiag(){
  const L=[];
  const step=async (label, path, init)=>{
    const t0=Date.now();
    try{
      const r=await fbFetch(fbU(path), init);
      let body=""; try{ body=(await r.text()||"").slice(0,60); }catch(e){}
      L.push(`${r.ok?"✅":"❌"} ${label} — HTTP ${r.status} · ${Date.now()-t0}ms${r.ok?"":" · "+body}`);
      return r.ok;
    }catch(e){
      L.push(`❌ ${label} — 응답 없음(그물 끊김·시한 초과) · ${Date.now()-t0}ms`);
      return false;
    }
  };
  /* ⚠ 시험용 방 코드도 실제와 똑같이 만든다 — 예전에는 여기서 0·1 이 섞인 코드를 만들어
     보안 규칙(대문자와 2~9만 허용)에 걸렸고, 멀쩡한 서버를 「막혔다」고 잘못 알렸다. */
  const me=pvpId(), code=pvpCode();
  L.push(`빌드 ${GAME_BUILD} · 버전 v${PVP_VER} · 내 id ${me}`);
  await step("접속자 읽기", "live");
  await step("내 접속 표시 쓰기", "live/"+me, {method:"PATCH", body:JSON.stringify({n:String(pvpNick()||"감독").slice(0,8), t:Date.now(), ver:PVP_VER})});
  await step("대기열 읽기", "queue");
  await step("방 만들기(시험)", "rooms/"+code, {method:"PUT", body:JSON.stringify({h:{id:me, n:"?", nick:String(pvpNick()||"감독").slice(0,8), ver:PVP_VER}, pub:0, st:"wait", t:Date.now()})});
  await step("방 읽기(시험)", "rooms/"+code);
  await step("방 지우기(시험)", "rooms/"+code, {method:"DELETE"});
  await step("티어 읽기", "tier");
  /* 실제 매칭이 쓰는 쓰기들 — 대기열 등록·신호 전달까지 그대로 흉내 낸다 */
  const qk="ZZdiag"+Math.floor(Math.random()*100000);
  await step("대기열 등록(시험)", "queue/"+qk, {method:"PUT", body:JSON.stringify({id:me, n:"?", st:30, t:Date.now(), ver:PVP_VER})});
  await step("대기열 지우기(시험)", "queue/"+qk, {method:"DELETE"});
  const code2=pvpCode();
  await step("방 만들기2(시험)", "rooms/"+code2, {method:"PUT", body:JSON.stringify({h:{id:me, n:"?", nick:String(pvpNick()||"감독").slice(0,8), ver:PVP_VER}, pub:0, duel:1, to:me, st:"wait", t:Date.now()})});
  await step("신호 전달(시험)", "rooms/"+code2, {method:"PATCH", body:JSON.stringify({sdpOffer:"{\"type\":\"offer\"}"})});
  await step("방 지우기2(시험)", "rooms/"+code2, {method:"DELETE"});
  /* 🌐 P2P — 서버가 멀쩡해도 여기서 막히면 「방은 만들어졌는데 연결이 안 되는」 상태가 된다.
     공인 주소(srflx)를 하나도 못 얻으면 상대와 직접 붙을 길이 없다. */
  const ice=await new Promise((res)=>{
    let host=0, srflx=0, relay=0, done=false;
    try{
      const pc=new RTCPeerConnection({iceServers:PVP_STUN});
      pc.createDataChannel("t");
      const fin=()=>{ if(done) return; done=true; try{ pc.close(); }catch(e){} res({host,srflx,relay}); };
      pc.onicecandidate=(e)=>{
        if(!e.candidate){ fin(); return; }
        const c=String(e.candidate.candidate||"");
        if(/ typ host/.test(c)) host++;
        else if(/ typ srflx/.test(c)) srflx++;
        else if(/ typ relay/.test(c)) relay++;
      };
      pc.createOffer().then(o=>pc.setLocalDescription(o)).catch(()=>fin());
      setTimeout(fin, 7000);
    }catch(e){ res({host:0,srflx:0,relay:0}); }
  });
  L.push((ice.srflx>0?"✅":"❌")+` 공인 주소 확보(STUN) — 내부 ${ice.host}개 · 공인 ${ice.srflx}개${ice.relay?` · 중계 ${ice.relay}개`:""}`);
  /* 상시 연결이 열리는지 */
  const es=await new Promise((res)=>{
    let done=false, s=null;
    try{
      s=new EventSource(fbU("talk"));
      const fin=(v)=>{ if(done) return; done=true; try{ s.close(); }catch(e){} res(v); };
      s.addEventListener("put", ()=>fin("열림"));
      s.onerror=()=>fin("실패");
      setTimeout(()=>fin("응답 없음"), 6000);
    }catch(e){ res("실패"); }
  });
  L.push((es==="열림"?"✅":"❌")+" 상시 연결(채팅) — "+es);
  const iceBad = L.some(x=>/공인 주소 확보\(STUN\) — .*공인 0개/.test(x));
  const hint = iceBad
    ? "\n\n⚠ 서버는 정상인데 <b>공인 주소를 하나도 못 얻었습니다</b>. 방화벽·회사망·일부 모바일 회선이 STUN(UDP 19302)을 막으면 상대와 직접 연결할 수 없습니다 — 방은 만들어지지만 붙지 않습니다. 다른 망(휴대폰 테더링 등)에서 한 번 시험해 주세요."
    : L.some(x=>/HTTP 40[12]|HTTP 429/.test(x))
    ? "\n\n⚠ 401 은 보안 규칙에 막힌 것이고, 402·429 는 요금제 한도(동시 접속·내려받기)를 넘긴 것입니다. Firebase 콘솔의 사용량 화면을 확인해 주세요."
    : L.some(x=>/응답 없음/.test(x))
    ? "\n\n⚠ 서버가 응답하지 않습니다 — 그물 상태이거나 데이터베이스가 잠시 막혀 있습니다."
    : "\n\n모든 단계가 정상입니다. 매칭이 안 된다면 상대 쪽 상태나 P2P 연결 문제입니다.";
  showConfirm(`<b>🔧 온라인 연결 점검</b>\n\n<span class="small" style="font-family:monospace;line-height:1.9">${L.join("<br>")}</span>${hint}`,
    null, {okLabel:"닫기", cancelLabel:""});
}
function pvpPollSkip(){
  try{ return !!(typeof pvpBusy==="function" && pvpBusy() && (typeof VIEW==="undefined" || VIEW!=="pvp")); }catch(e){ return false; }
}
/* (예비) 스트림을 못 쓰는 환경을 위한 수동 조회 — 평소에는 부르지 않는다 */
async function pvpLivePoll(){
  if(!pvpOn() || !PVP_LIVE || PVP_NET===false) return;
  try{ const t=await fbGet("live"); if(PVP_LIVE) pvpLiveApply(t||{}); }catch(e){}
}
function pvpLiveApply(tree, invOnly){
  if(!PVP_LIVE) return;
  const now=Date.now(), rows=[], mine=pvpId();
  for(const id in (tree||{})){
    const e=tree[id]; if(!e || typeof e!=="object") continue;
    const age=now-(e.t||0);
    if(age>PVP_LIVE_PURGE){ try{ fbDel("live/"+id); }catch(_){} continue; }
    if(age>PVP_LIVE_TTL) continue;
    /* 🔭 상대 포메이션 보기 — 접속 표시에 실려 온 선발 스냅샷을 행에 달아 둔다 (요청) */
    /* 🔢 버전 — ⚠ 요청 「온라인 대전 화면에서 현재 버전이 다른지 바로 알 수 있게. 지금은
       매칭해야 버전이 다른지 알 수 있잖아」. 심장박동에 이미 ver 이 실려 온다. */
    rows.push({id, n:pvpClean(e.n,8)||"감독", me:id===mine, m:!!e.m, q:!!e.q, v:(e.ver|0), t:(e.t||0),
               f:(e.f&&typeof e.f==="object")?e.f:null});
  }
  if(!invOnly){
    rows.sort((a,b)=> a.me? -1 : b.me? 1 : String(a.n).localeCompare(String(b.n),"ko"));
    PVP_LIVE.list=rows; PVP_LIVE.n=rows.length;
    const el=document.getElementById("pvpLive");
    if(el){ const h=pvpLiveHtml(); if(el.innerHTML!==h) el.innerHTML=h; }
  }
  /* ⚔️ 내 접속 표시에 초대장(inv)이 얹혀 있으면 — 1:1 대전 신청이 온 것이다 (개발 노트) */
  try{
    const meE=(tree||{})[mine], inv=meE && meE.inv;
    /* 🟡 내가 이미 매칭·경기 중이면 초대장을 그냥 버리지 않고 곧바로 거절을 알린다.
       예전에는 조용히 무시해서, 신청한 쪽이 90초를 기다린 뒤에야 「응답 없음」을 봤다 (요청). */
    if(inv && inv.room && inv.from && inv.from!==mine
       && (Date.now()-(inv.t||0) < 90000)
       && (PVP || (typeof liveM!=="undefined" && liveM))){
      const _rm=String(inv.room).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
      try{ fbSet("live/"+mine+"/inv", null); }catch(e){}
      try{ fbPatch("rooms/"+_rm, {dec:1, decWhy:"busy"}); }catch(e){}
    }
    if(inv && inv.room && inv.from && inv.from!==mine
       && (Date.now()-(inv.t||0) < 90000)
       && !PVP && (typeof liveM==="undefined" || !liveM)){
      try{ fbSet("live/"+mine+"/inv", null); }catch(e){}   // 초대장은 한 번만 — 바로 지운다
      pvpInvShow(inv.room, pvpClean(inv.n,8)||"감독", 0);
    }
  }catch(e){}
}
/* 🔢 버전 안내 — ⚠ 요청 원문 「온라인 대전 화면에서 현재 버전이 다른지 바로 알 수 있게 해줄래?
   지금은 매칭해야 버전이 다른지 알 수 있잖아」.
   접속 표시(live)에 실려 오는 ver 을 세어, 지금 라운지의 판도를 한 줄로 알려 준다.
   ⚠ 내 버전이 뒤처졌는지 앞섰는지에 따라 해야 할 일이 다르다 — 그것까지 짚어 준다. */
function pvpVerStat(){
  const out={me:PVP_VER, same:0, diff:0, older:0, newer:0, max:PVP_VER, list:{}};
  try{
    const L=(PVP_LIVE&&PVP_LIVE.list)||null; if(!L) return out;
    for(const r of L){
      if(r.me) continue;
      const v=r.v|0; if(!v) continue;
      out.list[v]=(out.list[v]||0)+1;
      if(v===PVP_VER) out.same++;
      else { out.diff++; if(v>PVP_VER) out.newer++; else out.older++; }
      if(v>out.max) out.max=v;
    }
  }catch(e){}
  return out;
}
function pvpVerLine(){
  const S=pvpVerStat();
  const mine=`<span class="tierMini" style="color:var(--gold);border-color:#e3b34155" title="내 게임 버전">v${PVP_VER}</span>`;
  if(!S.diff) return `<p class="small" style="margin:5px 0 0;opacity:.7">🔢 내 버전 ${mine}`
    + (S.same?` · 접속 중인 감독 ${S.same}명 모두 같은 버전입니다 — 누구와도 붙을 수 있습니다.`:` · 아직 다른 감독이 없습니다.`)+`</p>`;
  const chips=Object.keys(S.list).sort((a,b)=>b-a).map(v=>
    `<span class="tierMini" style="color:${(+v===PVP_VER)?"var(--green)":"#ff9d5c"};border-color:${(+v===PVP_VER)?"#3fb95055":"#ff9d5c55"}">v${v}<b>×${S.list[v]}</b></span>`).join(" ");
  return `<div class="msg ${S.newer?"warn":"info"}" style="margin:7px 0 0;padding:8px 10px">
    <b>🔢 버전이 다른 감독이 ${S.diff}명 있습니다</b> — 버전이 다르면 <b>매칭되지 않습니다</b>.<br>
    <span class="small">내 버전 ${mine} · 지금 라운지 ${chips}</span><br>
    <span class="small" style="opacity:.9">${S.newer
      ? `⬆️ <b>더 높은 버전(v${S.max})</b>을 쓰는 감독이 있습니다 — 내 게임이 옛 버전입니다. 새로고침(Ctrl+F5)하거나 최신 파일을 다시 받아 주세요.`
      : `⬇️ 옛 버전(v${Math.min(...Object.keys(S.list).map(Number))})을 쓰는 감독이 있습니다 — 그분들이 파일을 새로 받아야 붙을 수 있습니다.`}</span></div>`;
}
function pvpLiveHtml(){
  if(PVP_NET===false) return `<p class="small" style="opacity:.6">연결이 끊겨 있어 확인할 수 없습니다.</p>`;
  const L=PVP_LIVE;
  if(!L || !L.list) return `<p class="small" style="opacity:.6">불러오는 중…</p>`;
  /* ⚔️ 개발 노트 — 「접속중에 나오는 유저들 닉네임 클릭해서 1대1 대전 신청 박스 나오게」
     🔭 요청 — 「여기에 추가로 상대 포메이션 보기 해서 상대 스쿼드 베스트 11 포메이션을 볼 수
        있게 해줘」. 이제 클릭하면 「신청 / 포메이션 보기」 메뉴가 뜬다.
     ⚠ 대전 중인 감독도 클릭은 되게 바꾼다 — 신청은 못 해도 포메이션은 볼 수 있어야 한다. */
  const _uid=(r)=>String(r.id).replace(/[^\w-]/g,"");
  /* 🔢 버전이 다른 감독은 한눈에 — 붙을 수 없다는 걸 매칭 전에 알려 준다 (요청) */
  const _old=(r)=>!r.me && (r.v|0) && (r.v|0)!==PVP_VER;
  const chips=L.list.slice(0,80).map(r=>
    _old(r)
    ? `<span class="clickable" title="${r.n} 감독은 v${r.v} 을 쓰고 있습니다 — 내 버전(v${PVP_VER})과 달라 매칭되지 않습니다" onclick="pvpUserMenu('${_uid(r)}')"
        style="display:inline-block;padding:3px 9px;margin:2px 3px 0 0;border-radius:999px;font-size:11.5px;font-weight:600;background:#241c14;color:#ffb877;border:1px dashed #6e4a2a;cursor:pointer;opacity:.85">${pvpTierMini(r.n)} ${r.n} <b style="font-size:10px">🔢 v${r.v}</b>${r.m?` <b style="font-size:10px;color:#ff9d95">🔴</b>`:""}</span>`
    :
    r.me
    ? `<span style="display:inline-block;padding:3px 9px;margin:2px 3px 0 0;border-radius:999px;font-size:11.5px;font-weight:800;background:var(--gold);color:#0d1117">${pvpTierMini(r.n)} ${r.n} (나)</span>`
    : r.m
    ? `<span class="clickable" title="${r.n} 감독은 지금 경기 중입니다 — 포메이션은 볼 수 있습니다" onclick="pvpUserMenu('${_uid(r)}')"
        style="display:inline-block;padding:3px 9px;margin:2px 3px 0 0;border-radius:999px;font-size:11.5px;font-weight:600;background:#26161a;color:#ff9d95;border:1px solid #6e2a30;opacity:.9;cursor:pointer">${pvpTierMini(r.n)} ${r.n} <b style="font-size:10px">🔴 대전중</b></span>`
    : r.q
    ? `<span class="clickable" title="${r.n} 감독은 지금 상대를 찾는 중입니다 — 신청을 받을 수 없습니다. 포메이션은 볼 수 있습니다" onclick="pvpUserMenu('${_uid(r)}')"
        style="display:inline-block;padding:3px 9px;margin:2px 3px 0 0;border-radius:999px;font-size:11.5px;font-weight:600;background:#2a2416;color:#ffd479;border:1px solid #6e5f2a;opacity:.95;cursor:pointer">${pvpTierMini(r.n)} ${r.n} <b style="font-size:10px">🟡 매칭중</b></span>`
    : `<span class="clickable" title="클릭하면 ${r.n} 감독에게 1:1 대전 신청 · 포메이션 보기를 고를 수 있습니다" onclick="pvpUserMenu('${_uid(r)}')"
        style="display:inline-block;padding:3px 9px;margin:2px 3px 0 0;border-radius:999px;font-size:11.5px;font-weight:600;background:#1b222b;color:var(--fg);border:1px solid #2a3441;cursor:pointer">${pvpTierMini(r.n)} ⚔️ ${r.n}</span>`).join("");
  return `<div><b style="color:var(--green)">🟢 지금 ${L.n}명 접속 중</b>`
    + (L.n>80?` <span class="small" style="opacity:.7">(80명까지 표시)</span>`:"")
    + `</div><div style="margin-top:5px;line-height:1.9">${chips||`<span class="small" style="opacity:.6">아직 아무도 없습니다.</span>`}</div>`
    + pvpStreakLine()
    + pvpVerLine()
    + (L.n>1?`<p class="small" style="margin:5px 0 0;opacity:.6">닉네임 앞은 <b>이번 시즌 티어</b>, 뒤의 🔥 는 <b>연승</b>입니다. 닉네임을 클릭하면 <b>👤 감독 프로필</b>·<b>1:1 대전 신청</b>·<b>🔭 포메이션 보기</b>를 고를 수 있습니다.</p>`:"");
}
/* ═══ ⚔️ 1:1 대전 신청 — 개발 노트: 「접속중 유저 닉네임 클릭 → 대전 신청 박스 → 대전」 ═══
   비공개 방을 만들어 두고, 상대의 접속 표시(live/{id})에 초대장(inv)을 얹는다.
   상대 화면은 live 스트림으로 초대장을 받아 수락/거절 팝업을 띄운다 —
   수락하면 그 방 코드로 입장(pvpJoinRoom), 거절하면 방에 dec 표식을 남겨 신청자에게 알린다. */
/* 🔭 접속자 메뉴 — ⚠ 요청 원문 「접속중인 유저에서 유저 닉네임 클릭하면 지금은 1대1 대전
   신청만 가능하잖아. 여기에 추가로 상대 포메이션 보기 해서 상대 스쿼드 베스트 11 포메이션을
   볼 수 있게 해줘」. 클릭 한 번에 바로 신청이 가던 자리를 두 갈래 메뉴로 바꾼다. */
function pvpUserMenu(id){
  try{
    const L=PVP_LIVE; if(!L||!L.list) return;
    const r=L.list.find(x=>x.id===id);
    if(!r || r.me) return;
    const F=r.f;
    const sub = F ? `<span class="small" style="opacity:.8">${pvpClean(F.tn||F.ts||"",16)} · <b style="color:var(--gold)">${pvpClean(F.fm||"",14)}</b> · ★${((F.sv||30)/10).toFixed(1)}</span>`
                  : `<span class="small" style="opacity:.6">스쿼드 정보가 아직 도착하지 않았습니다</span>`;
    /* 🆚 상대별 전적 · 🏅 시즌 티어 — 만나는 자리마다 보여 준다 (개발 노트) */
    const h2h = pvpH2HLine(r.n) + pvpTierTag(r.n);
    const verBad=(r.v|0) && (r.v|0)!==PVP_VER;
    const opts=[], acts=[];
    /* 👤 요청 — 「접속 목록에서도 프로필이 열리게」 */
    opts.push("👤 감독 프로필"); acts.push(()=>pvpProfile(r.n));
    if(!r.m && !verBad){ opts.push("⚔️ 1:1 대전 신청"); acts.push(()=>pvpChallenge(r.id, r.n)); }
    opts.push(F ? "🔭 상대 포메이션 보기" : "🔭 포메이션 보기 (정보 없음)");
    acts.push(()=>pvpShowForm(r.id));
    showChoice(`<b style="font-size:15px">${pvpClean(r.n,8)}</b> 감독`
      + (r.m?` <span class="small" style="color:#ff9d95">— 지금 경기 중</span>`:``)
      + (verBad?`\n<span class="small" style="color:#ff9d5c">🔢 <b>버전이 다릅니다</b> — 그쪽 v${r.v} · 나 v${PVP_VER}. 같은 버전이라야 붙을 수 있습니다.</span>`:``)
      + `\n${sub}\n${h2h}`, opts, (i)=>{ try{ acts[i] && acts[i](); }catch(e){} });
  }catch(e){}
}
/* 🔭 상대 선발 11명 그림 — 로비의 pvpFormPitch 와 같은 그리기 방식을 그대로 쓴다.
   ⚠ 상대가 보낸 값이다 — 전부 소독해서 넘긴다. */
function pvpShowForm(id){
  try{
    const L=PVP_LIVE; if(!L||!L.list) return;
    const r=L.list.find(x=>x.id===id); if(!r) return;
    const F=r.f;
    if(!F || !Array.isArray(F.p) || !F.p.length){
      showConfirm(`<b>🔭 ${pvpClean(r.n,8)} 감독의 포메이션</b>\n\n아직 스쿼드 정보가 도착하지 않았습니다.\n<span class="small">상대가 ⚔️ 메뉴에 머무는 동안 20초 안에 올라옵니다 — 잠시 뒤 다시 눌러 보세요.</span>`,
        null, {okLabel:"닫기", cancelLabel:""});
      return;
    }
    const col=/^#[0-9a-fA-F]{3,8}$/.test(F.c||"")?F.c:"#2a6ee8";
    const pk={ tac:{formation:String(F.fm||"").slice(0,14)},
               pl:F.p.slice(0,11).map(q=>({
                 n:pvpClean(q.n,10)||"선수",
                 no:clamp(Math.round(q.no||0),0,99),
                 sl:(typeof q.s==="string" && SLOT_XY[q.s])?q.s:null,
                 pos:(["GK","DF","MF","FW"].indexOf(q.po)>=0?q.po:"MF")
               })) };
    const avg=(function(){ let s=0,c=0; for(const q of F.p){ const v=Math.round(q.o||0); if(v>0){ s+=v; c++; } } return c?Math.round(s/c):0; })();
    showConfirm(`<b style="font-size:15px">🔭 ${pvpClean(r.n,8)} 감독의 선발</b>
      <div class="small" style="margin:3px 0 8px;opacity:.85">${pvpClean(F.tn||F.ts||"",16)} · <b style="color:var(--gold)">${pvpClean(F.fm||"",14)}</b> · ★${((F.sv||30)/10).toFixed(1)}${avg?` · 선발 평균 ${avg}`:""}</div>
      <div style="display:flex;justify-content:center">${pvpFormPitch(pk, col, "베스트 11")}</div>
      <p class="small" style="margin:8px 0 0;opacity:.7">상대가 ⚔️ 메뉴에 접속해 있는 동안 20초마다 갱신됩니다. 실제 경기에서는 상대가 전술을 바꿀 수 있습니다.</p>`,
      null, {okLabel:"닫기", cancelLabel:""});
  }catch(e){}
}
function pvpChallenge(id, nick){
  if(!pvpOn()) return;
  if(!pvpNetGate()) return;
  if(PVP){ try{ flash("이미 매칭이 진행 중입니다 — 먼저 취소해 주세요.","warn"); }catch(e){} return; }
  if(!id || id===pvpId()) return;
  /* 🔢 버전이 다른 상대에게는 신청 자체를 보내지 않는다 (요청: 매칭 전에 알 수 있게) */
  try{
    const _r=((PVP_LIVE&&PVP_LIVE.list)||[]).find(x=>x.id===id);
    if(_r && (_r.v|0) && (_r.v|0)!==PVP_VER){
      gameAlert(`🔢 게임 버전이 다릅니다.\n\n${pvpClean(nick,8)||"상대"} 감독: v${_r.v}\n나: v${PVP_VER}\n\n같은 버전이라야 대전할 수 있습니다.`);
      return;
    }
  }catch(e){}
  /* 📴 ⚠ 요청 — 「상대방이 오프라인이면 메시지와 함께 자동으로 취소되게」.
     신청을 보내기 전에 먼저 본다 — 목록에 없으면 이미 대전 화면을 떠난 것이다. */
  try{
    const _o=((PVP_LIVE&&PVP_LIVE.list)||[]).find(x=>x.id===id);
    if(PVP_LIVE && PVP_LIVE.list && !_o){
      gameAlert(`${pvpClean(nick,8)||"상대"} 감독은 지금 접속해 있지 않습니다.\n\n대전 화면을 떠났거나 연결이 끊겼습니다 — 목록이 새로 고쳐진 뒤 다시 시도해 주세요.`);
      return;
    }
  }catch(e){}
  /* 🟡 상대가 이미 매칭 중·경기 중이면 신청을 보내지 않는다 — 보내 봐야 삼켜진다 (요청) */
  try{
    const _s=((PVP_LIVE&&PVP_LIVE.list)||[]).find(x=>x.id===id);
    if(_s && (_s.m || _s.q)){
      gameAlert(`${pvpClean(nick,8)||"상대"} 감독은 지금 ${_s.m?"경기 중":"상대를 찾는 중"}입니다.\n\n지금은 1:1 신청을 받을 수 없습니다 — 잠시 뒤에 다시 시도해 주세요.`);
      return;
    }
  }catch(e){}
  nick=pvpClean(nick,8)||"상대";
  showConfirm(`<b>⚔️ 1:1 대전 신청</b>\n\n<b>${nick}</b> 감독에게 대전을 신청할까요?\n${pvpH2HLine(nick)}\n<span class="small">상대가 수락하면 바로 매치 로비로 이동합니다 · 90초 안에 응답이 없으면 자동으로 거둡니다.</span>`,
    ()=>{ pvpChallengeGo(id, nick); }, {okLabel:"⚔️ 신청한다", cancelLabel:"그만둔다"});
}
async function pvpChallengeGo(id, nick){
  if(PVP) return;
  const code=pvpCode();
  PVP={stage:"room", role:"host", room:code, myId:pvpId(), pub:0, duel:nick, msg:`⚔️ ${nick} 감독의 수락을 기다리는 중…`};
  const t=userTeam()||{};
  let st10=30; try{ st10=Math.round(teamStarVal(t)*10); }catch(e){}
  /* ⚔️ ⚠ 제보 — 「1대1 신청이 여전히 안 간다」.
     여태 초대는 「상대의 접속 표시 칸(live/{상대id})에 초대장을 얹는」 방식 하나뿐이었다.
     이 경로는 깨질 구멍이 많다 —
       · 상대가 그 순간 화면을 떠나 칸이 지워져 있으면, 새로 만들어지는 칸에 n·t 가 없어
         보안 규칙의 검사에 걸려 쓰기 자체가 거부된다 (조용히 실패)
       · 상대의 심장박동이 칸을 통째로 갈아끼우면 초대장이 지워진다
       · 남의 칸에 쓰는 일이라 규칙이 조금만 달라도 막힌다
     ─ 이제 「방에 받는 사람을 적어 두는」 방식을 주 경로로 쓴다(to). 방은 내가 만든 내 칸이고,
       받는 쪽은 그냥 읽기만 하면 된다 — 남의 칸에 쓰지 않으니 막힐 구멍이 없다.
       옛 판을 쓰는 상대를 위해 예전 경로(live.inv)도 함께 남긴다. */
  const ok=await fbSet("rooms/"+code, {h:{id:PVP.myId, n:t.short||"?", nick:pvpNick(), tn:String(t.name||"").slice(0,16), sv:st10, ver:PVP_VER},
                                       pub:0, duel:1, to:String(id).slice(0,24), toN:String(nick).slice(0,8),
                                       st:"wait", t:Date.now()});
  if(!ok){ PVP=null; try{ flash("⚔️ 서버에 연결하지 못했습니다.","warn"); }catch(e){} show("pvp"); return; }
  const invOk=await fbPatch("live/"+id, {inv:{room:code, from:pvpId(), n:String(pvpNick()||"감독").slice(0,8), t:Date.now()}});
  /* ⚠ 제보 — 「신청해도 상대에게 안 뜬다」. 초대장이 정말 꽂혔는지 되읽어 확인한다.
     실패했으면 90초를 멍하니 기다리게 두지 않고 그 자리에서 알리고, 방 코드를 준다. */
  let landed=false;
  try{ const back=await fbGet("live/"+id+"/inv"); landed=!!(back && back.room===code); }catch(e){}
  if(!invOk || !landed){
    try{ gameAlert(`⚔️ ${nick} 감독에게 신청을 전달하지 못했습니다.\n\n상대가 대전 화면을 떠났거나 통신이 잠깐 끊겼을 수 있습니다.\n\n방은 만들어 두었습니다 — 코드 ${code} 로 들어오라고 알려 주셔도 됩니다.`); }catch(e){}
  }
  PVP.msg=`⚔️ ${nick} 감독의 수락을 기다리는 중… <span class="small">(방 코드 ${code})</span>`;
  pvpSt(`⚔️ ${nick} 감독에게 대전 신청을 보냈습니다 — 수락을 기다립니다 (방 코드 ${code})`);
  pvpWatchRoom();
  /* 📴 기다리는 동안 상대가 나가면 90초를 채우지 않고 그 자리에서 거둔다 (요청).
     접속 표시(live)는 20초마다 갱신되므로, 목록에서 사라졌거나 마지막 신호가 45초 넘게
     묵었으면 나간 것으로 본다. 잠깐의 통신 흔들림에 오작동하지 않게 두 번 연속일 때만 끊는다. */
  if(PVP.offIv) clearInterval(PVP.offIv);
  let _offN=0;
  PVP.offIv=setInterval(()=>{
    try{
      if(!PVP || PVP.stage!=="room" || !PVP.duel || PVP.pc){ clearInterval(PVP.offIv); PVP.offIv=null; return; }
      const L=(PVP_LIVE&&PVP_LIVE.list)||null;
      if(!L) return;                                  // 목록을 아직 못 받았다 — 판단 보류
      const r=L.find(x=>x.id===id);
      const gone = !r || (r.t && Date.now()-r.t>45000);
      if(!gone){ _offN=0; return; }
      if(++_offN<2) return;
      clearInterval(PVP.offIv); PVP.offIv=null;
      try{ fbDel("rooms/"+code); }catch(e){}
      try{ fbPatch("live/"+id, {inv:null}); }catch(e){}
      pvpAbort(`📴 ${nick} 감독이 대전 화면을 떠났습니다 — 신청을 자동으로 거뒀습니다.`);
    }catch(e){}
  }, 5000);
  /* 90초 무응답이면 거둔다 */
  if(PVP.invTO) clearTimeout(PVP.invTO);
  PVP.invTO=setTimeout(()=>{ try{
    if(PVP && PVP.stage==="room" && PVP.duel && !PVP.pc) pvpAbort(`⚔️ ${nick} 감독의 응답이 없습니다 — 신청을 거뒀습니다.`);
  }catch(e){} }, 90000);
}

/* ── 💬 라운지 채팅 ───────────────────────────────────────────────────────
   경기 중 채팅은 상대와 P2P 직통이고, 이쪽은 메뉴에 있는 모두가 함께 보는 자리다.
   닉네임을 장부에 등록해야 말할 수 있다 — 이름 없는 사람이 떠들면 누가 누군지 모른다. */
function pvpTalkApply(tree){
  PVP_TALK=PVP_TALK||{rows:null, at:0};
  const now=Date.now(), rows=[], mine=pvpId();
  for(const k in (tree||{})){
    const e=tree[k]; if(!e || typeof e!=="object") continue;
    const age=now-(e.t||0);
    if(age>PVP_TALK_TTL){ try{ fbDel("talk/"+k); }catch(_){} continue; }
    rows.push({k, n:pvpClean(e.n,8)||"감독", m:pvpClean(e.m,90), t:e.t||0, me:e.id===mine});
  }
  rows.sort((a,b)=>a.t-b.t);
  PVP_TALK.rows=rows.slice(-PVP_TALK_SHOW);
  const el=document.getElementById("pvpTalk");
  if(el){
    const stick=(el.scrollHeight-el.scrollTop-el.clientHeight)<=60 || !PVP_TALK._drew;
    el.innerHTML=pvpTalkHtml(); PVP_TALK._drew=1;
    try{ chatBoxSync(); }catch(e){}
    chatBoxBottom(el, stick);
  }
}
function pvpTalkHtml(){
  if(PVP_NET===false) return `<p class="small" style="opacity:.6">연결이 끊겨 있습니다.</p>`;
  const T=PVP_TALK;
  if(!T || !T.rows) return `<p class="small" style="opacity:.6">불러오는 중…</p>`;
  if(!T.rows.length) return `<p class="small" style="opacity:.6">아직 아무 말도 없습니다 — 먼저 인사해 보세요.</p>`;
  return T.rows.map(r=>{
    const d=new Date(r.t||0);
    const hh=String(d.getHours()).padStart(2,"0"), mm=String(d.getMinutes()).padStart(2,"0");
    return `<div style="padding:2px 0;line-height:1.55"><span class="small" style="opacity:.45;font-family:monospace">${hh}:${mm}</span>
      <b style="color:${r.me?"var(--gold)":"var(--acc2, #58a6ff)"}">${r.n}</b>
      <span style="opacity:.55">·</span> ${r.m}</div>`;
  }).join("");
}
async function pvpTalkSend(){
  if(!pvpNetGate()) return;
  if(!pvpNickClaimed()){
    gameAlert("💬 채팅을 하려면 먼저 닉네임을 정해야 합니다.\n\n위 「내 닉네임」 칸에 이름을 적고 저장해 주세요.");
    return;
  }
  const inp=document.getElementById("pvpTalkIn"); if(!inp) return;
  const m=String(inp.value||"").replace(/[<>&"'`]/g,"").replace(/\s+/g," ").trim().slice(0,90);
  if(!m) return;
  const now=Date.now();
  PVP_TALK=PVP_TALK||{rows:null, at:0};
  if(now-(PVP_TALK.at||0)<PVP_TALK_GAP){ try{ flash("잠깐만요 — 조금 뒤에 다시 보내 주세요.","warn"); }catch(e){} return; }
  PVP_TALK.at=now;
  inp.value="";
  const id=await fbPush("talk", {n:String(pvpNick()).slice(0,8), m, t:now, id:pvpId()});
  if(!id){ try{ flash("메시지를 보내지 못했습니다 — 연결을 확인해 주세요.","warn"); }catch(e){} pvpNetCheck(); }
}
function pvpTalkKey(ev){ try{ if(ev && (ev.key==="Enter"||ev.keyCode===13)) pvpTalkSend(); }catch(e){} }

/* ── 🌐 모두의 전적 ───────────────────────────────────────────────────────
   경기가 끝나면 호스트가 결과 한 줄을 올린다(양쪽이 올리면 같은 경기가 두 번 뜬다).
   몰수도 그대로 남긴다 — 무슨 일이 있었는지가 기록이다. */
function pvpResPost(hg, ag, ff){
  try{
    if(!pvpOn() || !PVP || PVP.role!=="host" || PVP._resSent) return;
    PVP._resSent=1;
    const my=PVP.myPack||{}, op=PVP.oppPack||{};
    fbPush("results", {
      hn:String(my.mgr||pvpNick()||"감독").slice(0,8), an:String(op.mgr||"상대").slice(0,8),
      ht:String(my.short||my.name||"?").slice(0,10), at:String(op.short||op.name||"?").slice(0,10),
      hc:/^#[0-9a-fA-F]{3,8}$/.test(my.col||"")?my.col:"#2a6ee8",
      ac:/^#[0-9a-fA-F]{3,8}$/.test(op.col||"")?op.col:"#f85149",
      hg:clamp(hg|0,0,99), ag:clamp(ag|0,0,99), ff:ff?1:0, t:Date.now(), id:pvpId()});
  }catch(e){}
}
function pvpResApply(tree){
  PVP_RES=PVP_RES||{rows:null};
  const now=Date.now(), rows=[], mine=pvpId();
  for(const k in (tree||{})){
    const e=tree[k]; if(!e || typeof e!=="object") continue;
    if(now-(e.t||0)>PVP_RES_TTL){ try{ fbDel("results/"+k); }catch(_){} continue; }
    rows.push({k, hn:pvpClean(e.hn,8)||"감독", an:pvpClean(e.an,8)||"감독",
      ht:pvpClean(e.ht,10)||"?", at:pvpClean(e.at,10)||"?",
      hc:/^#[0-9a-fA-F]{3,8}$/.test(e.hc||"")?e.hc:"#2a6ee8",
      ac:/^#[0-9a-fA-F]{3,8}$/.test(e.ac||"")?e.ac:"#f85149",
      hg:clamp(e.hg|0,0,99), ag:clamp(e.ag|0,0,99), ff:e.ff?1:0, t:e.t||0, me:e.id===mine});
  }
  rows.sort((a,b)=>b.t-a.t);
  PVP_RES.rows=rows.slice(0, PVP_RES_SHOW);
  /* 🔄 경기가 끝나면 주간 랭킹·시즌 티어도 함께 바뀐다 — 같은 신호로 두 표를 새로 고친다
     (전용 스트림을 따로 열지 않는 이유는 pvpLiveStart 의 주석 참고) */
  try{ if(PVP_RES._n!==rows.length || (rows[0]&&rows[0].k!==PVP_RES._top)){ PVP_RES._n=rows.length; PVP_RES._top=rows[0]?rows[0].k:null; pvpRankPoke(); } }catch(e){}
  const el=document.getElementById("pvpRes");
  if(el) el.innerHTML=pvpResHtml();
}
/* 🌐 실시간 전적 접기 — 개발 노트: 「실시간 전적에 스크롤바도 추가해주고, 접었다 펼수 있게도 해줘」 */
function pvpResFolded(){ try{ return localStorage.getItem("klm2026_resFold")==="1"; }catch(e){ return false; } }
function pvpResFoldToggle(){
  try{ localStorage.setItem("klm2026_resFold", pvpResFolded()?"0":"1"); }catch(e){}
  try{ show("pvp"); }catch(e){}
}
function pvpResHtml(){
  if(PVP_NET===false) return `<p class="small" style="opacity:.6">연결이 끊겨 있어 불러올 수 없습니다.</p>`;
  const R=PVP_RES;
  if(!R || !R.rows) return `<p class="small" style="opacity:.6">불러오는 중…</p>`;
  if(!R.rows.length) return `<p class="small" style="opacity:.6">최근 사흘 안에 끝난 경기가 아직 없습니다 — 첫 경기의 주인공이 되어 보세요.</p>`;
  const ago=(t)=>{ const m=Math.floor((Date.now()-t)/60000);
    return m<1?"방금":m<60?(m+"분 전"):(m<1440?(Math.floor(m/60)+"시간 전"):(Math.floor(m/1440)+"일 전")); };
  /* 👤 요청 — 「전적표 어디서든」 프로필이 열리게. 닉네임을 누르면 감독 카드가 뜬다 */
  const pill=(nick,team,col)=>`<span class="prNick clickable" onclick="pvpProfile('${nick}')" title="${nick} 감독의 프로필 보기" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px">${nick}</span>`
    + `<span class="prTeam" style="background:${col};color:${(typeof inkOn==="function")?inkOn(col):"#fff"}">${team}</span>`;
  return `<div class="prList">${R.rows.map(r=>{
    const win=r.hg>r.ag?"h":(r.ag>r.hg?"a":"");
    return `<div class="prRow${r.me?" prMine":""}">
      <span class="prSide prL${win==="h"?" prWin":""}">${pill(r.hn,r.ht,r.hc)}</span>
      <span class="prScore">${r.hg} <span style="opacity:.45">:</span> ${r.ag}</span>
      <span class="prSide prR${win==="a"?" prWin":""}">${pill(r.an,r.at,r.ac)}</span>
      <span class="prMeta">${r.ff?`<b style="color:#ff9d5c">몰수</b> · `:""}${ago(r.t)}${r.me?` · <b style="color:var(--gold)">내 경기</b>`:""}</span>
    </div>`;
  }).join("")}</div>`;
}
/* ── 🎫 닉네임 장부 ───────────────────────────────────────────────────────
   ⚠ 제보 — 「닉네임도 중복되면 안되야해」. nicks/{키} 에 「누가 쓰고 있는가」를 적어 둔다.
   30일 동안 접속이 없으면 점유가 풀려 다른 사람이 쓸 수 있다(버려진 이름이 영영 잠기지 않게). */
function pvpNickKeyOf(n){
  return String(n||"").toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g,"").slice(0,8);
}
function pvpNickKey(){ try{ return localStorage.getItem("klm2026_pvpNickKey")||""; }catch(e){ return ""; } }
/* 지금 쓰는 닉네임이 「내 이름으로 장부에 등록된」 상태인가 — 채팅 자격 */
function pvpNickClaimed(){
  try{
    const k=pvpNickKey();
    return !!(k && k===pvpNickKeyOf(pvpNick()));
  }catch(e){ return false; }
}
/* ── 🌐 공개 방 목록 — 대기 중(wait·pub)인 방을 닉네임·구단·전력과 함께 보여준다 ── */
const PVP_ROOM_HIDE=20*60*1000;    // 이보다 오래된 방은 목록에서 숨긴다
const PVP_ROOM_PURGE=2*60*60*1000; // 이보다 오래된 유령 방은 지운다 (브라우저 강제 종료 잔재)
let PVP_ROOMS_AT=0;
async function pvpRoomsRefresh(force){
  if(!pvpOn()||PVP) return;
  if(PVP_NET===false){                       // 🌐 제보 — 연결이 끊겨 있으면 목록도 의미가 없다
    const e0=document.getElementById("pvpRooms");
    if(e0) e0.innerHTML=`<p class="small" style="opacity:.6">연결이 끊겨 있어 불러올 수 없습니다.</p>`;
    return;
  }
  const now=Date.now();
  if(!force && now-PVP_ROOMS_AT<5000) return;    // 자동 새로고침 과호출 방지
  PVP_ROOMS_AT=now;
  const el0=document.getElementById("pvpRooms");
  if(el0 && force) el0.innerHTML=`<p class="small" style="opacity:.6">불러오는 중…</p>`;
  const rooms=await fbGet("rooms")||{};
  try{ pvpInvScanRooms(rooms); }catch(e){}   // ⚔️ 나를 지목한 방이 있으면 여기서도 잡는다
  const rows=[];
  for(const code in rooms){
    const r=rooms[code]; if(!r||!r.h) continue;
    const age=now-(r.t||0);
    if(age>PVP_ROOM_PURGE){ fbDel("rooms/"+code); continue; }   // 유령 방 청소
    if(!r.pub || r.st!=="wait" || r.g) continue;                 // 비공개·진행 중 제외
    if(age>PVP_ROOM_HIDE) continue;
    /* 🔢 ⚠ 요청 — 「버전이 다른지 바로 알 수 있게」. 예전에는 버전이 다른 방을 목록에서
       조용히 빼 버려서, 분명 방을 연 사람이 있는데 목록이 비어 보였다.
       ─ 감춰지지 않게 그대로 싣고, 「버전 다름」으로 표시하고 입장만 막는다. */
    rows.push({code, nick:pvpClean(r.h.nick,8)||"감독", tn:pvpClean(r.h.tn||r.h.n,16)||"?", sv:r.h.sv||30, age,
               ver:(r.h.ver||0), bad:((r.h.ver||0)!==PVP_VER)});
  }
  rows.sort((a,b)=>a.age-b.age);
  const el=document.getElementById("pvpRooms"); if(!el) return;
  const badN=rows.filter(r=>r.bad).length;
  el.innerHTML = (rows.length ? rows.slice(0,12).map(r=>{
    const m=Math.floor(r.age/60000);
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1b222b${r.bad?";opacity:.7":""}">
      <b style="color:${r.bad?"#ffb877":"var(--gold)"}">${r.nick}</b><span class="small">${r.tn} · ${(r.sv/10).toFixed(1)}★ · ${m<1?"방금":m+"분 전"}</span>
      ${r.bad
        ? `<span class="tierMini" style="color:#ff9d5c;border-color:#ff9d5c55" title="이 방의 감독은 v${r.ver||"?"} 을 쓰고 있습니다 — 내 버전(v${PVP_VER})과 달라 입장할 수 없습니다">🔢 v${r.ver||"?"}</span>
           <button class="mini" style="margin-left:auto;padding:5px 12px;opacity:.55" disabled title="게임 버전이 달라 입장할 수 없습니다">버전 다름</button>`
        : `<button class="mini" style="margin-left:auto;padding:5px 14px" onclick="pvpJoinRoom('${r.code}')">⚔️ 입장</button>`}</div>`;
  }).join("")
  : `<p class="small" style="opacity:.6">지금 대기 중인 공개 방이 없습니다 — 직접 하나 열어 보세요.</p>`)
  + (badN?`<p class="small" style="margin:6px 0 0;color:#ff9d5c">🔢 ${badN}개 방은 <b>게임 버전이 달라</b> 들어갈 수 없습니다 — 같은 버전끼리만 붙을 수 있습니다.</p>`:"");
}
/* 코드로 입장 — 나 = 게스트 */
async function pvpJoinRoom(code){
  if(!pvpOn()) return;
  if(!pvpEnterLock()) return;        // ⏱️ 중복 클릭 차단 — 공개 방 목록에서 연타하면 절차가 겹쳤다 (제보: 먹통)
  try{
    if(!pvpNetGate()) return;        // 🌐 제보 — 연결이 끊겨 있으면 들어가지 못한다
    code=String(code||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
    if(code.length<6){ flash("방 코드 6자리를 입력하세요.","warn"); return; }
    const room=await fbGet("rooms/"+code);
    /* ⏱️ fbGet 은 시간 초과·오프라인이면 null 을 준다 — 「방이 없다」와 구분해 안내한다 */
    if(!room || !room.h){ flash(PVP_NET===false?"연결이 끊겼습니다 — 잠시 뒤 다시 시도해 주세요.":"그 코드의 방이 없습니다.","warn"); return; }
    if(room.g){ flash("이미 다른 상대가 입장한 방입니다.","warn"); return; }
    if((room.h.ver||0)!==PVP_VER){ flash("상대와 게임 버전이 다릅니다 — 같은 버전으로 맞춰 주세요.","warn"); return; }
    PVP={stage:"room", role:"guest", room:code, myId:pvpId(), msg:"방에 입장하는 중…"};
    const ok=await fbPatch("rooms/"+code, {g:{id:PVP.myId, n:(userTeam()||{}).short||"?", ver:PVP_VER}, st:"paired"});
    /* ⚠ 예전에는 이 결과를 안 봤다 — 입장 기록이 서버에 안 남았는데도 그 방을 계속 지켜보며
       영영 「입장하는 중…」에 머물렀다 (제보: 공개방 들어갈 때 먹통) */
    if(!ok){ pvpReset(); PVP=null; flash("⚔️ 방에 입장하지 못했습니다 — 다시 시도해 주세요.","warn"); show("pvp"); return; }
    pvpWatchRoom();
    pvpConnGuard();         // ⏱️ 상대가 있는 방이다 — 여기서부터는 시간 안에 붙어야 한다
    pvpRtcStart();          // 게스트가 offer 를 만든다
  }catch(e){
    try{ pvpReset(); }catch(_){} PVP=null;
    try{ flash("⚔️ 방에 입장하지 못했습니다 — 다시 시도해 주세요.","warn"); show("pvp"); }catch(_){}
  }finally{ pvpEnterFree(); }
}
/* 빠른 대전 — 대기열 */
async function pvpQuick(){
  if(!pvpOn()) return;
  if(!pvpEnterLock()) return;        // ⏱️ 중복 클릭 차단 (제보: 매칭이 안 될 때 먹통)
  try{ await pvpQuick_(); }
  catch(e){
    try{ pvpReset(); }catch(_){} PVP=null;
    try{ flash("⚔️ 매칭을 시작하지 못했습니다 — 다시 시도해 주세요.","warn"); show("pvp"); }catch(_){}
  }
  finally{ pvpEnterFree(); }
}
async function pvpQuick_(){
  if(!pvpNetGate()) return;          // 🌐 제보 — 연결이 끊겨 있으면 들어가지 못한다
  const me={id:pvpId(), n:(userTeam()||{}).short||"?", st:Math.round((function(){try{return teamStarVal(userTeam())*10}catch(e){return 30}})()), t:Date.now(), ver:PVP_VER};
  PVP={stage:"queue", role:null, myId:me.id, msg:"상대를 찾는 중…"};
  /* ① 기존 대기자 중 전력이 맞는 상대가 있으면 내가 매처(게스트)가 된다 */
  const q=await fbGet("queue")||{};
  let bestK=null, bestD=1e9;
  const now=Date.now();
  for(const k in q){
    const e=q[k]; if(!e || e.id===me.id) continue;
    if((e.ver||0)!==PVP_VER) continue;
    if(now-(e.t||0) > PVP_QUEUE_TTL*1000){ fbDel("queue/"+k); continue; }   // 상한 지난 항목 청소
    if(e.room) continue;                                    // 이미 매칭됨
    const d=Math.abs((e.st||30)-me.st);
    if(d<=PVP_STAR_GAP && d<bestD){ bestD=d; bestK=k; }   // 제한 해제 — 그래도 가장 가까운 상대 우선
  }
  if(bestK){
    const code=pvpCode();
    PVP.role="guest"; PVP.room=code; PVP.stage="room"; PVP.msg="상대를 찾았습니다 — 연결 중…";
    await fbSet("rooms/"+code, {h:{id:q[bestK].id, n:q[bestK].n, ver:PVP_VER}, g:{id:me.id, n:me.n, ver:PVP_VER}, st:"paired", t:Date.now()});
    await fbPatch("queue/"+bestK, {room:code});
    /* ⚠ 여기서 지우면 안 된다 — 상대 스트림이 재접속 중이면 room 표시를 영영 못 본다.
       삭제는 상대(대기자) 본인이 room 을 확인한 뒤에 하고, 유령 항목은 TTL 청소가 걷어간다. */
    pvpWatchRoom();
    pvpConnGuard();      // ⏱️ 상대를 찾았다 — 여기서부터는 시간 안에 붙어야 한다 (제보: 먹통)
    pvpRtcStart();
    return;
  }
  /* ② 없으면 줄을 선다 — 누군가 나를 고르면 내 항목에 room 이 적힌다 (그때 나는 호스트) */
  const key=await fbPush("queue", me);
  if(!key){ pvpReset(); flash("⚔️ 서버에 연결하지 못했습니다.","warn"); show("pvp"); return; }
  PVP.qEntry=key;
  pvpSt("대기열에 등록했습니다 — 다음 감독이 들어오면 바로 붙습니다 (내 전력 "+(me.st/10).toFixed(1)+"성 · 전력 제한 없음)");
  /* ⚡ ⚠ 제보 — 「빠른 대전도 잘 안 잡히는 느낌. 동시에 하면 되는데 뭔가 늦다」.
     원인: 줄을 설 때 딱 한 번만 대기열을 훑는다. 두 사람이 거의 같은 순간에 누르면
        둘 다 「빈 대기열」을 보고 나란히 줄만 서 버린다 — 그 뒤로는 아무도 다시 안 훑으므로
        제3의 감독이 들어올 때까지 둘 다 하염없이 기다린다.
     ─ 줄을 선 뒤에도 4초마다 다시 훑는다. 양쪽이 동시에 서로를 고르면 방이 두 개 생기므로,
       키가 큰 쪽만 짝을 짓는다(딱 한 쪽만 움직인다). */
  PVP.reIv=setInterval(async ()=>{
    try{
      if(!PVP || PVP.stage!=="queue" || !PVP.qEntry) return;
      const q2=await fbGet("queue")||{};
      if(!PVP || PVP.stage!=="queue") return;
      if(q2[PVP.qEntry] && q2[PVP.qEntry].room) return;      // 이미 누가 나를 골랐다
      const now2=Date.now();
      let pick=null, pd=1e9;
      for(const k in q2){
        const e=q2[k];
        if(!e || e.id===me.id || e.room) continue;
        if((e.ver||0)!==PVP_VER) continue;
        if(now2-(e.t||0) > PVP_QUEUE_TTL*1000) continue;
        if(k >= PVP.qEntry) continue;                        // 키가 큰 쪽만 짝을 짓는다
        const d=Math.abs((e.st||30)-me.st);
        if(d<pd){ pd=d; pick=k; }
      }
      if(!pick) return;
      const code2=pvpCode();
      try{ clearInterval(PVP.reIv); PVP.reIv=null; }catch(_){}
      try{ if(PVP.esQ) PVP.esQ.close(); }catch(_){}
      const myKey=PVP.qEntry;
      PVP.role="guest"; PVP.room=code2; PVP.stage="room"; PVP.qEntry=null; PVP.msg="상대를 찾았습니다 — 연결 중…";
      await fbSet("rooms/"+code2, {h:{id:q2[pick].id, n:q2[pick].n, ver:PVP_VER}, g:{id:me.id, n:me.n, ver:PVP_VER}, st:"paired", t:Date.now()});
      await fbPatch("queue/"+pick, {room:code2});
      try{ fbDel("queue/"+myKey); }catch(_){}
      pvpSt("상대를 찾았습니다 — 연결 중…");
      pvpWatchRoom(); pvpConnGuard(); pvpRtcStart();
    }catch(e){}
  }, 4000);
  PVP.esQ=fbStream("queue/"+key, (st)=>{
    if(st && st.room && PVP && PVP.stage==="queue"){
      PVP.role="host"; PVP.room=st.room; PVP.stage="room"; PVP.qEntry=null;
      try{ if(PVP.reIv){ clearInterval(PVP.reIv); PVP.reIv=null; } }catch(e){}
      try{ PVP.esQ.close(); }catch(e){}
      fbDel("queue/"+key);
      pvpSt("상대를 찾았습니다 — 연결 중…");
      pvpWatchRoom();
      pvpConnGuard();    // ⏱️ 짝이 지어졌다 — 여기서부터는 시간 안에 붙어야 한다 (제보: 먹통)
    }
  });
}
/* 방 스트림 — 시그널링(offer/answer/ICE)을 중계한다 */
function pvpWatchRoom(){
  if(!PVP||!PVP.room) return;
  PVP.seenIce={h:{}, g:{}};
  PVP.es=fbStream("rooms/"+PVP.room, async (room)=>{
    if(!PVP) return;
    try{
      /* ⚔️ 1:1 대전 신청 거절 — 상대가 팝업에서 「거절한다」를 눌렀다 (개발 노트) */
      if(room && room.dec && PVP.role==="host" && PVP.duel && !PVP.pc){
        try{ if(PVP.invTO){ clearTimeout(PVP.invTO); PVP.invTO=null; } }catch(e){}
        pvpAbort(room.decWhy==="busy"
          ? `⚔️ ${PVP.duel} 감독은 지금 다른 매칭·경기 중입니다 — 신청을 받을 수 없습니다.`
          : `⚔️ ${PVP.duel} 감독이 대전 신청을 거절했습니다.`);
        return;
      }
      if(PVP.role==="host"){
        if(room.g && !PVP.pc && PVP.stage==="room"){
          pvpSt("상대 입장 — 연결 중…");
          /* ⏱️ 상대가 들어온 뒤로는 무한정 기다리지 않는다 (제보: 공개방 먹통).
             빈 방에서 상대를 기다리는 동안에는 감시를 걸지 않는다 — 그건 정상적인 기다림이다. */
          if(!PVP.guardIv) pvpConnGuard();
        }
        if(room.sdpOffer && !PVP.answered){
          PVP.answered=1;
          await pvpRtcAnswer(room.sdpOffer);
        }
        for(const k in (room.iceG||{})){ if(!PVP.seenIce.g[k]){ PVP.seenIce.g[k]=1; try{ await PVP.pc.addIceCandidate(JSON.parse(room.iceG[k])); }catch(e){} } }
      } else {
        if(room.sdpAnswer && !PVP.answerSet && PVP.pc){
          PVP.answerSet=1;
          try{ await PVP.pc.setRemoteDescription(JSON.parse(room.sdpAnswer)); }catch(e){}
        }
        for(const k in (room.iceH||{})){ if(!PVP.seenIce.h[k]){ PVP.seenIce.h[k]=1; try{ await PVP.pc.addIceCandidate(JSON.parse(room.iceH[k])); }catch(e){} } }
      }
    }catch(e){}
  });
}
/* ── WebRTC ────────────────────────────────────────────────────────────── */
function pvpRtcBase(){
  const pc=new RTCPeerConnection({iceServers:PVP_STUN});
  PVP.pc=pc;
  pc.onicecandidate=(e)=>{ if(e.candidate && PVP && PVP.room) fbPush("rooms/"+PVP.room+"/"+(PVP.role==="host"?"iceH":"iceG"), JSON.stringify(e.candidate)); };
  pc.onconnectionstatechange=()=>{
    if(!PVP) return;
    const s=pc.connectionState;
    if(s==="connected" && PVP.stage!=="match"){ PVP.stage="lobby"; pvpSt("연결됐습니다 — 스쿼드를 교환하는 중…"); pvpHelloSync(); }
    if(s==="failed"||s==="closed"){ pvpDropped(); }
    else if(s==="disconnected"){
      /* ⚠ 몰수 도입으로 순단 오판이 뼈아파졌다 — 8초 안에 살아나면 없던 일로 한다 */
      if(!PVP._dcT) PVP._dcT=setTimeout(()=>{ try{
        if(PVP && PVP.pc && PVP.pc.connectionState!=="connected") pvpDropped();
        if(PVP) PVP._dcT=null;
      }catch(e){} }, 8000);
    }
    else if(s==="connected" && PVP._dcT){ try{ clearTimeout(PVP._dcT); }catch(e){} PVP._dcT=null; }
  };
  return pc;
}
function pvpBindCh(ch, kind){
  ch.binaryType="arraybuffer";
  if(kind==="r"){ PVP.chR=ch; ch.onmessage=(e)=>pvpOnMsg(e.data);
    /* ⚠ 제보(스쿼드 교환 멈춤) — 전송은 채널이 「열린 뒤」에. 이미 열려 있으면 즉시. */
    ch.onopen=()=>{ try{ pvpHelloSync(); }catch(e){} };
    if(ch.readyState==="open"){ try{ pvpHelloSync(); }catch(e){} }
  }
  else { PVP.chU=ch; ch.onmessage=(e)=>pvpOnSnap(e.data); }
}
/* hello 재전송 — 상대 스쿼드가 도착할 때까지 0.9초 간격, 12회 넘으면 포기 안내 */
function pvpHelloSync(){
  if(!PVP || PVP.helloT) return;
  pvpSendHello();
  PVP.helloTries=0;
  PVP.helloT=setInterval(()=>{
    if(!PVP){ return; }
    if(PVP.oppPack || PVP.stage==="match" || PVP.stage==="done"){ clearInterval(PVP.helloT); PVP.helloT=null; return; }
    if(++PVP.helloTries>12){ clearInterval(PVP.helloT); PVP.helloT=null; pvpAbort("스쿼드 교환에 실패했습니다 — 다시 시도해 주세요."); return; }
    pvpSendHello();
  }, 900);
}
async function pvpRtcStart(){       // 게스트: 채널 생성 + offer
  const pc=pvpRtcBase();
  pvpBindCh(pc.createDataChannel("r",{ordered:true}), "r");
  pvpBindCh(pc.createDataChannel("u",{ordered:false, maxRetransmits:0}), "u");
  const of=await pc.createOffer();
  await pc.setLocalDescription(of);
  await fbPatch("rooms/"+PVP.room, {sdpOffer:JSON.stringify(of)});
}
async function pvpRtcAnswer(offerStr){   // 호스트: 응답
  const pc=pvpRtcBase();
  pc.ondatachannel=(e)=>pvpBindCh(e.channel, e.channel.label==="r"?"r":"u");
  try{ await pc.setRemoteDescription(JSON.parse(offerStr)); }catch(e){ return; }
  const an=await pc.createAnswer();
  await pc.setLocalDescription(an);
  await fbPatch("rooms/"+PVP.room, {sdpAnswer:JSON.stringify(an)});
}
/* ── 프로토콜 (신뢰 채널) ─────────────────────────────────────────────── */
function pvpSend(o){ try{ if(PVP&&PVP.chR&&PVP.chR.readyState==="open") PVP.chR.send(JSON.stringify(o)); }catch(e){} }
/* 🌦️ ⚠ 요청 — 「온라인 대전은 날씨를 매칭마다 랜덤으로. 매칭 잡히고 시작 전 포메이션 화면에서
   날씨 정보도 알려 주게」. 리그는 「날짜」가 날씨를 정하지만 대전은 날짜가 없다 —
   <b>호스트가 판마다 새로 굴리고</b> 그 값을 게스트에게 보낸다(양쪽이 같은 하늘을 봐야 한다). */
function pvpRollWx(){
  try{
    if(!PVP || PVP.role!=="host") return null;
    const ks=Object.keys(WX_KIND);
    PVP.wx=makeWeather(ks[Math.floor(Math.random()*ks.length)]);
    return PVP.wx;
  }catch(e){ return null; }
}
function pvpWxLine(){
  try{
    const w=PVP&&PVP.wx; if(!w) return "";
    const tip={rain:"공이 빠르게 흐르고 터치가 길어집니다", storm:"미끄럽고 발이 밀립니다 — 롱볼 싸움",
               snow:"방향 전환이 위험합니다 — 넘어지는 선수가 나옵니다", hot:"체력이 빨리 떨어집니다",
               cold:"첫 발이 잘 안 나갑니다", windy:"롱볼·크로스가 바람을 탑니다",
               clear:"조건이 좋습니다", cloud:"무난한 조건입니다"}[w.k]||"";
    return `<div class="msg info" style="margin:6px 0;padding:8px 10px">
      <b style="font-size:15px">${w.ic} 오늘 그라운드 — ${w.n}</b>
      <span class="small" style="opacity:.85"> · ${tip}</span></div>`;
  }catch(e){ return ""; }
}
function pvpSendHello(){
  PVP.myPack=pvpPack();
  try{ PVP._myPackJ=JSON.stringify(PVP.myPack); }catch(e){}
  if(PVP.role==="host" && !PVP.wx) pvpRollWx();
  pvpSend({t:"hello", ver:PVP_VER, pack:PVP.myPack, wx:(PVP.role==="host"?PVP.wx:undefined)});
}
/* 🎽 로비 스쿼드 동기화 — 전술 탭에서 수정하고 돌아오면 바뀐 스쿼드를 상대에게 재전송한다.
   양쪽 수락은 초기화 — 옛 스쿼드를 보고 한 수락은 무효다. (제보: 로비에서 스쿼드 수정) */
function pvpLobbySquadSync(){
  try{
    if(!PVP || PVP.stage!=="lobby" || !PVP.chR || PVP.chR.readyState!=="open") return;
    let pk=null; try{ pk=pvpPack(); }catch(e){}
    if(!pk) return;
    const j=JSON.stringify(pk);
    if(!PVP._myPackJ){ PVP._myPackJ=j; PVP.myPack=pk; return; }
    if(PVP._myPackJ===j) return;
    PVP._myPackJ=j; PVP.myPack=pk;
    pvpSend({t:"hello", ver:PVP_VER, pack:pk, wx:(PVP.role==="host"?PVP.wx:undefined)});
    if(PVP.meReady||PVP.oppReady){ PVP.meReady=false; PVP.oppReady=false; pvpSend({t:"unready"}); }
    try{ flash("📤 수정한 스쿼드를 상대에게 보냈습니다 — 양쪽 수락이 초기화됐습니다","info"); }catch(e){}
    try{ if(VIEW==="pvp") show("pvp"); }catch(e){}   // 🗺️ 내 포메이션 그림 즉시 갱신 (제보)
  }catch(e){}
}
function pvpOnMsg(raw){
  let m=null; try{ m=JSON.parse(raw); }catch(e){ return; }
  if(!PVP||!m||!m.t) return;
  /* ⚠ 제보(포메이션 미반영)에서 드러난 것 — 한 통을 처리하다 예외가 나면 그 뒤 처리가
     통째로 끊긴다. 통신 자체가 무너지지 않게 감싼다. */
  try{ return pvpOnMsg_(m); }catch(e){ try{ console.warn("pvp msg", m&&m.t, e); }catch(_){} }
}
function pvpOnMsg_(m){
  if(m.t==="hello"){
    if((m.ver||0)!==PVP_VER){ pvpSend({t:"bye", why:"ver"}); pvpAbort("상대와 게임 버전이 다릅니다."); return; }
    const first=!PVP.oppPack;
    /* 🧼 원격 팩 소독 — 화면에 그대로 들어가는 문자열을 수신 시점에 씻는다 */
    try{ if(m.pack){
      m.pack.name=pvpClean(m.pack.name,16)||"상대 팀"; m.pack.short=pvpClean(m.pack.short,8)||"상대";
      m.pack.mgr=pvpClean(m.pack.mgr,8)||"감독";
      if(Array.isArray(m.pack.pl)) for(const q of m.pack.pl){ q.n=pvpClean(q.n,12)||"선수";
        q.sl=(typeof q.sl==="string" && SLOT_XY[q.sl])?q.sl:null; }
    } }catch(e){}
    PVP.oppPack=m.pack; PVP.oppCheck=pvpPackCheck(m.pack||{});
    /* 🌦️ 이 판의 날씨는 호스트가 정한다 — 게스트는 받아서 쓴다 (요청) */
    try{ if(PVP.role==="guest" && m.wx && WX_KIND[m.wx.k]) PVP.wx=m.wx; }catch(e){}
    if(PVP.helloT){ try{ clearInterval(PVP.helloT); }catch(e){} PVP.helloT=null; }
    /* 재전송으로 뒤늦게 온 hello 가 경기 중 화면을 로비로 되돌리지 않게 한다 */
    if(PVP.stage!=="match" && PVP.stage!=="done") PVP.stage="lobby";
    if(first) pvpSendHello();   // 상대가 내 것을 못 받았을 수 있다 — 한 번 되보낸다 (서로 1회로 수렴)
    else if(PVP.stage==="lobby"){
      /* 🎽 스쿼드 갱신 — 옛 스쿼드에 대한 수락은 무효 (제보: 로비 스쿼드 수정) */
      PVP.meReady=false; PVP.oppReady=false;
      try{ flash("📥 상대가 스쿼드를 수정했습니다 — 새 스쿼드를 확인해 주세요","warn"); }catch(e){}
    }
    pvpSt(null);
    return;
  }
  if(m.t==="ready"){ PVP.oppReady=1; pvpMaybeStart(); try{ if(VIEW==="pvp") show("pvp"); }catch(e){} return; }
  if(m.t==="unready"){ PVP.meReady=false; PVP.oppReady=false; try{ if(VIEW==="pvp") show("pvp"); }catch(e){} return; }
  if(m.t==="rep"){ try{ if(m.r) PVP.rep=m.r; if(VIEW==="pvp" && PVP.stage==="done") show("pvp"); }catch(e){} return; }
  if(m.t==="kickoff" && PVP.role==="guest"){
    try{ if(m.wx && WX_KIND[m.wx.k]) PVP.wx=m.wx; }catch(e){}   // 🌦️ (요청)
    pvpGuestMatchStart(m.info||{}); return; }
  if(m.t==="tac" && PVP.role==="host"){ pvpApplyGuestTac(m); return; }
  if(m.t==="ev" && PVP.role==="guest"){ pvpGuestEv(m); return; }
  if(m.t==="end" && PVP.role==="guest"){ pvpGuestEnd(m); return; }
  if(m.t==="st" && PVP.role==="guest"){ try{ if(PVP.watch){ PVP.watch.st=m.st;
    const el=document.getElementById("pvpStats"); if(el) el.innerHTML=pvpStatsHtml(); } }catch(e){} return; }
  if(m.t==="chat"){ pvpChatPush("opp", pvpClean(m.x,120)); return; }
  /* 🔁 재대결 — 상대가 「한 판 더」를 눌렀다 (개발 노트) */
  if(m.t==="rematch"){
    if(!PVP || PVP.stage!=="done") return;
    PVP.oppRe=1;
    try{ if(!PVP.meRe) flash("🔁 상대가 재대결을 신청했습니다.","good"); }catch(e){}
    pvpMaybeRematch();
    try{ if(VIEW==="pvp") show("pvp"); }catch(e){}
    return;
  }
  if(m.t==="gp" && PVP.role==="guest"){ pvpShowGoal(m); return; }
  /* ⏱️ 추가시간 — 호스트가 정한 값을 그대로 받아 같은 전광판 글자를 만든다 (제보) */
  if(m.t==="add"){ try{ if(PVP.watch) PVP.watch.add={a1:m.a1|0, a2:m.a2|0, a3:m.a3|0}; }catch(e){} return; }
  if(m.t==="tacp"){
    if(m.on){
      /* 상대가 수정 시작 — 호스트면 기회 검증·엔진 정지, 화면 블라인드 */
      if(PVP.role==="host"){
        /* ⚔️ 하프타임 수정은 무료 (제보 — 하프타임 교체) */
        if(!PVP._htWait){
          if((PVP.tacOppLeft|0)<=0){ pvpSend({t:"tacst", ok:0, why:"교체·수정 기회를 모두 사용했습니다 ("+PVP_TAC_USES+"회)"}); return; }
          PVP.tacOppLeft--;
        }
        livePaused=true;
        PVP._oppGrace=0;                              // 새 편집 — 지난 유예는 닫는다
        if(PVP.tacEdit==="me"){ PVP.tacOppOn=1; }     // 하프타임 동시 편집 — 내 화면은 그대로 둔다
        else { PVP.tacEdit="opp"; try{ updLiveCtrl(); }catch(e){} pvpTacBlind(true); }
        pvpSend(Object.assign({t:"tacst", ok:1, left:PVP.tacOppLeft}, pvpSideState("a")));
        try{ if(PVP._htWait) flash("📋 상대가 하프타임 교체를 시작했습니다 — 나도 지금 짤 수 있습니다","info"); }catch(e){}
        /* 상대 편집 60초 강제 마감 */
        if(PVP.tacTO2) clearTimeout(PVP.tacTO2);
        PVP.tacTO2=setTimeout(()=>{ try{
          if(!PVP) return;
          if(PVP.tacEdit==="me" && PVP.tacOppOn){ pvpSend({t:"tace"}); PVP.tacOppOn=0; pvpOppEditEnd(); return; }
          if(PVP.tacEdit==="opp"){ pvpSend({t:"tace"}); PVP.tacEdit=null; PVP.tacOppOn=0; pvpOppEditEnd(); pvpTacBlind(false); pvpTacResume(); }
        }catch(e){} }, PVP_TAC_SEC*1000+3000);
      } else {
        if(PVP.tacEdit==="me"){ PVP.tacOppOn=1;
          try{ if(PVP._htWait) flash("📋 상대가 하프타임 교체를 시작했습니다 — 나도 지금 짤 수 있습니다","info"); }catch(e){}
        } else { PVP.tacEdit="opp"; pvpTacBlind(true); }
      }
    } else {
      /* 상대 수정 종료 */
      if(PVP.tacOppOn && PVP.tacEdit!=="opp"){
        /* 동시 편집이었다 — 내 창은 그대로 두고 상대 표식만 내린다.
           내가 이미 닫았다면 여기서 후반전 조건이 채워진다 */
        PVP.tacOppOn=0; pvpOppEditEnd();
        try{ if(PVP.tacTO2){ clearTimeout(PVP.tacTO2); PVP.tacTO2=null; } }catch(e){}
        try{ flash("📋 상대의 하프타임 교체가 끝났습니다","info"); }catch(e){}
        if(PVP._htWait){
          try{ if(PVP.role==="host") updLiveCtrl("ht"); }catch(e){}
          try{ pvpHtOverlaySync(); }catch(e){}
          try{ pvpHtTryStart(); }catch(e){}
        } else if(PVP.role==="host" && !PVP.tacEdit) pvpTacResume();
      }
      else if(PVP.tacEdit==="opp"){ PVP.tacEdit=null; PVP.tacOppOn=0; pvpOppEditEnd(); pvpTacBlind(false);
        try{ if(PVP.tacTO2){ clearTimeout(PVP.tacTO2); PVP.tacTO2=null; } }catch(e){}
        if(PVP._htWait){
          try{ if(PVP.role==="host") updLiveCtrl("ht"); }catch(e){}
          try{ pvpHtTryStart(); }catch(e){}   // ⚔️ 하프타임 교체 종료 — 양쪽 준비면 후반전 (제보)
          try{ flash("📋 상대의 하프타임 교체가 끝났습니다","info"); }catch(e){}
        } else {
          if(PVP.role==="host") pvpTacResume();
          try{ flash("📋 상대의 전술 수정이 끝났습니다 — 경기 재개","info"); }catch(e){}
        } }
    }
    return;
  }
  if(m.t==="tacst"){
    if(PVP.tacEdit!=="me") return;
    if(!m.ok){ PVP.tacEdit=null; PVP.tacMe=Math.min(PVP_TAC_USES,(PVP.tacMe|0)+1); pvpTacWait(false);
      try{ flash("🔁 "+pvpClean(m.why,40),"warn"); }catch(e){} return; }
    PVP.tacState={xi:(m.xi||[]).slice(0,11).map(q=>({no:clamp(q.no|0,0,99), n:pvpClean(q.n,12), ps:pvpClean(q.ps,4), cond:clamp(q.cond|0,0,100)})),
                  bench:(m.bench||[]).slice(0,12).map(q=>({no:clamp(q.no|0,0,99), n:pvpClean(q.n,12), ps:pvpClean(q.ps,4), cond:clamp(q.cond|0,0,100)})),
                  subs:m.subs|0, max:m.max|0||5,
                  tac:(function(){ const o={}, s=m.tac||{}; for(const k of PVP_TAC_KEYS) o[k]=clamp(s[k]|0,0,4); return o; })(),
                  form:pvpClean(m.form,10)};
    if(m.why){ try{ flash("🔁 "+pvpClean(m.why,40),"warn"); }catch(e){} }
    /* ⚔️ 제보 — 리그와 똑같은 「경기 중 전술 수정」 화면을 연다 (그림자 경기를 만들어 그린다) */
    if(!PVP.tacM && !inLiveTactics){
      if(!pvpGuestTacOpen(PVP.tacState)){
        try{ flash("전술창을 열지 못했습니다 — 잠시 후 다시 시도해 주세요.","warn"); }catch(e){}
        pvpTacWait(false); PVP.tacEdit=null; PVP.tacMe=Math.min(PVP_TAC_USES,(PVP.tacMe|0)+1);
        pvpSend({t:"tacp", on:0});
      }
    }
    return;
  }
  /* ⚔️ ⚠ 제보 원문 — 「하프타임에 포메이션을 5-3-2 로 바꿨는데 시작하고 보니 예전 포메이션이더라」.
     원인: 게스트가 보내는 전술 변경(포메이션·자리·역할·교체·지시)을 호스트가 받을 때
        `PVP.tacEdit==="opp"` 인지만 봤다. 그런데 하프타임 동시 편집을 넣으면서,
        호스트도 자기 전술창을 열고 있으면 그 칸이 "me" 가 되고 상대 편집은 별도 표식(tacOppOn)
        으로 옮겨 두게 바꿨다 — 그래서 그 경우 게스트가 보낸 변경이 전부 조용히 버려졌다.
        하프타임에는 양쪽이 동시에 여는 것이 정상이라, 사실상 매번 무시된 셈이다.
     ─ 「상대가 전술창을 열고 있는가」를 한 곳에서 판정한다 (tacEdit==="opp" 이거나 tacOppOn). */
  if((m.t==="tacsl"||m.t==="tacrl") && PVP.role==="host"){
    if(!pvpOppEditing()) return;
    pvpApplySlots(PVP.awayT, m.t==="tacsl"?m.sl:null, m.t==="tacrl"?m.rl:null);
    return;
  }
  if(m.t==="tacf" && PVP.role==="host"){
    if(!pvpOppEditing()) return;                          // 전술창을 연 동안에만 바꿀 수 있다
    pvpApplyForm(PVP.awayT, String(m.f||""));
    pvpSend(Object.assign({t:"tacst", ok:1}, pvpSideState("a")));
    return;
  }
  if(m.t==="sub" && PVP.role==="host"){
    if(!pvpOppEditing()) return;
    const r=pvpApplySub("a", clamp(m.out|0,0,99), clamp(m.in|0,0,99));
    pvpSend(Object.assign({t:"tacst", ok:1, why:r.ok?"":(r.why||"교체 실패")}, pvpSideState("a")));
    return;
  }
  if(m.t==="tace"){
    if(PVP.tacEdit==="me"){
      try{ if(PVP.tacTO){ clearTimeout(PVP.tacTO); PVP.tacTO=null; } }catch(e){}
      try{ flash("⏱ 시간 초과 — 호스트가 경기를 재개했습니다","warn"); }catch(e){}
      /* 열려 있던 전술창은 지금까지 만진 대로 저장하고 닫는다 */
      if(inLiveTactics){ try{ saveLiveTactics(); }catch(e){} }
      else { PVP.tacEdit=null; try{ pvpTacWait(false); }catch(e){} }
    }
    return;
  }
  if(m.t==="cd" && PVP.role==="guest"){ try{ if(PVP.watch){
    PVP.watch.cd={k:m.k==="R"?"R":"Y", nm:pvpClean(m.nm,12), ps:pvpClean(m.ps,4), tm:pvpClean(m.tm,18),
                  side:m.side==="h"?"h":"a", no:clamp(Math.round(m.no||0),0,99), at:Date.now()};
  } }catch(e){} return; }
  if(m.t==="offl" && PVP.role==="guest"){ try{ if(PVP.watch){
    PVP.watch.off=(Array.isArray(m.list)?m.list:[]).slice(0,8).map(x=>({
      s:x.s==="h"?"h":"a", m:clamp(Math.round(x.m||0),0,130), n:pvpClean(x.n,12), p:pvpClean(x.p,4)}));
    const el=document.getElementById("pvpOff"), cd2=document.getElementById("pvpOffCard");
    if(el&&cd2){ if(PVP.watch.off.length){ cd2.classList.remove("hidden"); el.innerHTML=pvpOffHtml(); }
                 else cd2.classList.add("hidden"); }
  } }catch(e){} return; }
  if(m.t==="away"){ PVP.awayOpp=!!m.on; try{ pvpAwaySync(); }catch(e){} return; }
  if(m.t==="ht" && PVP.role==="guest"){ PVP._htWait=true; PVP.htMe=false; PVP.htOpp=false; try{ pvpHtOverlaySync(); }catch(e){} return; }
  if(m.t==="htr"){ PVP.htOpp=true;
    try{ flash("💪 상대 감독이 준비되었습니다!","info"); }catch(e){}
    try{ if(PVP.role==="host" && !PVP.htMe) updLiveCtrl("ht"); }catch(e){}
    try{ pvpHtOverlaySync(); }catch(e){}
    pvpHtTryStart(); return; }
  if(m.t==="ht2" && PVP.role==="guest"){ PVP._htWait=false;
    try{ pvpHtOverlaySync(); }catch(e){}
    try{ flash("⚽ 후반전 시작!","good"); }catch(e){} return; }
  if(m.t==="cap" && PVP.role==="guest"){ try{ if(PVP.watch){ PVP.watch.cap=m;
    const el=document.getElementById("pvpCap");
    if(el){ el.textContent=m.x||"";
      const i=PVP.watch.info||{};
      const col = m.s==="h" ? (i.hc||"#2ea8ff") : m.s==="a" ? (i.ac||"#f85149") : "#1b2129";
      try{ setCssVar(el, "--cbar", col); }catch(e){ el.style.borderLeftColor=col; } } } }catch(e){} return; }
  if(m.t==="bye"){
    /* ⚠ 제보(몰수) — 경기 중 기권 통보면 3:0 몰수승으로 받는다 */
    if(PVP.stage==="match" && pvpForfeitWin("상대가 기권했습니다")) return;
    if(PVP.ended) return;                       // ⚔️ 종료 후 상대 퇴장 — 결과 확인 화면 유지
    pvpAbort("상대가 대전을 종료했습니다."); return;
  }
}
function pvpReady(){
  if(!PVP||PVP.stage!=="lobby"||PVP.meReady) return;
  /* ⚽ 요청 — 명단이 미완성이면 준비 완료를 누를 수 없다 (상대에게 열 명짜리 판이 가지 않게) */
  if(xiGateStop(true)) return;
  PVP.meReady=1; pvpSend({t:"ready"});
  pvpMaybeStart(); show("pvp");
}
function pvpMaybeStart(){
  if(!PVP||!PVP.meReady||!PVP.oppReady||PVP.stage==="match") return;
  if(PVP.role==="host") pvpHostStart();
}
/* ── 경기 (호스트) ────────────────────────────────────────────────────── */
function pvpHostStart(){
  if(!PVP||!PVP.myPack||!PVP.oppPack) return;
  PVP.stage="match";
  const home=pvpBuildTeam(PVP.myPack, "h");     // ⚠ 내 팀도 클론 — 세이브 완전 격리
  const away=pvpBuildTeam(PVP.oppPack, "a");
  home.pvpRemote=true;                          // 호스트도 지시 패널로 조종 — AI 벤치 개입 금지
  away.pvpRemote=true;                          // 게스트가 원격 조종한다
  /* 교체는 양 팀 모두 엔진의 자동 교체(수석코치)가 맡는다 — 완전 대칭 (v1) */
  PVP.homeT=home; PVP.awayT=away;
  /* 🎫 제보 — 스코어보드에 「팀이름(닉네임)」. 클론 팀의 표기 이름에 닉네임을 붙인다
     (해설·전광판이 함께 따라간다 — 중계 방송 느낌). */
  try{ const p=document.getElementById("lvPanel"); if(p&&p.removeAttribute) p.removeAttribute("data-pvppanel"); }catch(e){}
  const hNick=(PVP.myPack&&PVP.myPack.mgr)||pvpNick(), aNick=(PVP.oppPack&&PVP.oppPack.mgr)||"상대";
  home.short=(home.short+"("+hNick+")").slice(0,18); away.short=(away.short+"("+aNick+")").slice(0,18);
  home.name=(home.name+" ("+hNick+")").slice(0,26);  away.name=(away.name+" ("+aNick+")").slice(0,26);
  PVP.tacMe=PVP_TAC_USES; PVP.tacOppLeft=PVP_TAC_USES; PVP.tacEdit=null; PVP.tacOppOn=0;   // 🔁 교체 기회 (제보)
  if(!PVP.wx) pvpRollWx();                      // 🌦️ 혹시 아직 안 굴렸으면 여기서 (요청)
  const M=createMatch(home, away, {noTable:true, pvp:true, neutral:true, wx:PVP.wx});
  pvpSend({t:"kickoff", wx:PVP.wx, info:{hn:home.name, an:away.name, hs:home.short, as:away.short, hc:home.col, ac:away.col, hm:hNick, am:aNick}});
  /* 스냅샷 송신 루프 */
  PVP.snapT=setInterval(()=>{
    try{
      if(!liveSim||!liveM||!liveM.opts||!liveM.opts.pvp){ return; }
      if(PVP.chU&&PVP.chU.readyState==="open") PVP.chU.send(pvpEncodeSnap(liveSim, liveM));
      /* 하이라이트가 끝난 뒤에야 미뤄 둔 이벤트 자막을 내보낸다 — 골 텍스트가 장면보다 먼저 가면 스포일러 */
      const inHL=(typeof liveHL!=="undefined") && !!liveHL;
      if(!inHL && PVP._evQ && PVP._evQ.length){ const q=PVP._evQ; PVP._evQ=[]; for(const m of q) pvpSend(m); }
      /* 경기 통계 — 3초마다 (제보: 게스트에도 호스트와 같은 통계) */
      PVP._stN=(PVP._stN||0)+1;
      if(PVP._stN>=Math.max(1,Math.round(3000/PVP_SNAP_MS))){ PVP._stN=0;
        const st=liveM.st||{};
        pvpSend({t:"st", st:{hS:st.hS||0,aS:st.aS||0,hT:st.hT||0,aT:st.aT||0,hP:st.hP||0,aP:st.aP||0,
                             hC:st.hC||0,aC:st.aC||0,hF:st.hF||0,aF:st.aF||0,hY:st.hY||0,aY:st.aY||0,hR:st.hR||0,aR:st.aR||0}});
      }
    }catch(e){}
  }, PVP_SNAP_MS);
  startLive(M, "⚔️ 온라인 친선전");
}
function pvpApplyGuestTac(m){
  try{
    const t=PVP&&PVP.awayT; if(!t) return;
    const K=["mentality","pass","tempo","press","line","width","counter","crossFq","longShot"];
    if(K.indexOf(m.k)>=0 && typeof m.v==="number") t.tactic[m.k]=clamp(Math.round(m.v),0,4);
  }catch(e){}
}
/* 경기 이벤트를 게스트에 중계한다 — ev() 훅에서 부른다 */
function pvpFwdEv(M){
  try{
    if(!PVP||PVP.role!=="host"||!M.events.length) return;
    const e=M.events[M.events.length-1];
    const msg={t:"ev", min:e.min, tm:e.t||"", txt:String(e.txt||"").slice(0,300), ty:e.type||"txt",
             hg:M.hg, ag:M.ag};
    /* ⚠ 풀 동기화 — 하이라이트 재생 중에 생긴 이벤트(그 장면의 골 등)는 장면이 끝난 뒤 내보낸다 */
    if((typeof liveHL!=="undefined") && liveHL){ (PVP._evQ=PVP._evQ||[]).push(msg); return; }
    pvpSend(msg);
  }catch(e){}
}
/* ── 경기 (게스트 관전 + 원격 지시) ──────────────────────────────────── */
function pvpGuestMatchStart(info){
  PVP.stage="match";
  PVP.tacMe=PVP_TAC_USES; PVP.tacEdit=null; PVP.tacOppOn=0;   // 🔁 교체 기회 (제보)
  PVP.watch={info, evs:[], snap:null, prev:null, at:0, hg:0, ag:0, clock:0};
  show("pvp");
  if(PVP.watchT) cancelAnimationFrame(PVP.watchT);
  const loop=()=>{ if(!PVP||PVP.stage!=="match") return; try{ pvpDrawWatch(); }catch(e){} PVP.watchT=requestAnimationFrame(loop); };
  PVP.watchT=requestAnimationFrame(loop);
}
function pvpOnSnap(buf){
  try{
    if(!PVP||!PVP.watch) return;
    const s=pvpDecodeSnap(buf);
    PVP.watch.prev=PVP.watch.snap; PVP.watch.snap=s; PVP.watch.at=Date.now();
    PVP.watch.hg=s.hg; PVP.watch.ag=s.ag; PVP.watch.clock=s.clock;
    /* 재생 지연 버퍼 — 「송신 시각」 타임라인으로 쌓는다 (도착이 몰려도 표본 간격은 송신 간격 그대로) */
    const W=PVP.watch;
    if(W._smsPrev==null){ W._smsBase=0; W._smsPrev=s.sTag; }
    else{
      const d=s.sTag-W._smsPrev;
      if(d<-32768) W._smsBase+=65536;          // 16비트 순환을 풀어 잇는다
      W._smsPrev=s.sTag;
    }
    s.sms=W._smsBase+s.sTag;
    const wb=(W.buf=W.buf||[]);
    if(wb.length && s.sms<=wb[wb.length-1].at){ /* 순서 뒤집힌 늦은 프레임 — 버린다 */ }
    else{
      wb.push({s, at:s.sms});
      /* ⚠ 개수 기준 상한이라 송신 주기를 30→50Hz 로 올리면 버퍼가 2.0초에서 1.2초로 줄어든다.
         재생 시계가 최대 1초까지 되감으므로 여유가 거의 없어진다 — 같은 시간만큼 담도록 늘린다. */
      if(wb.length>120) wb.splice(0, wb.length-120);
    }
    /* 전광판 — 매 스냅샷마다 DOM 을 만지면 아깝다. 0.25초에 한 번 (호스트 lvHead 와 같은 구성) */
    const now=Date.now();
    if(!PVP.watch._sbAt || now-PVP.watch._sbAt>250){
      PVP.watch._sbAt=now;
      try{
        const sc=document.getElementById("pvpScoreN");
        if(sc){ const t=(s.hg||0)+" : "+(s.ag||0); if(sc.textContent!==t) sc.textContent=t; }
        const mn=document.getElementById("pvpMin");
        if(mn){
          /* ⏱️ 호스트와 똑같은 함수·값으로 만든다 — 「90+3」까지 그대로 (제보) */
          const A=(PVP.watch&&PVP.watch.add)||{};
          const lab=matchClockTxt(s.clock||0, A.a1|0, A.a2|0, A.a3|0, !!s.et);
          const mm=Math.floor((s.clock||0)/60);
          const t=lab+"'"+(s.et?(mm>105?" 연장 후반":" 연장 전반"):(s.half2?" 후반":" 전반"));
          if(mn.textContent!==t) mn.textContent=t; }
        const md=document.getElementById("pvpMode");
        if(md){ const t=s.hl?"● HIGHLIGHT":"○ 경기 진행 중";
          if(md.textContent!==t){ md.textContent=t; md.style.color=s.hl?"#f85149":""; } }
      }catch(e){}
    }
  }catch(e){}
}
function pvpGuestEv(m){
  const W=PVP&&PVP.watch; if(!W) return;
  try{ m.txt=String(m.txt||"").replace(/<[^>]*>/g,"").slice(0,300); }catch(e){}   // 🧼 원격 텍스트 소독
  W.evs.unshift(m); if(W.evs.length>60) W.evs.length=60;
  W.hg=m.hg; W.ag=m.ag;
  try{ const el=document.getElementById("pvpEvs"); if(el) el.innerHTML=pvpEvHtml(); }catch(e){}
  try{ const sc=document.getElementById("pvpScoreN"); if(sc) sc.textContent=(W.hg||0)+" : "+(W.ag||0); }catch(e){}
}
function pvpOffHtml(){
  const W=PVP&&PVP.watch; const list=(W&&W.off)||[]; const i=(W&&W.info)||{};
  return list.map(x=>`<div style="display:flex;gap:7px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)">
    <span style="font-size:15px">🟥</span>
    <b>${x.m}'</b>
    <span class="small">${x.s==="h"?(i.hs||"홈"):(i.as||"원정")}</span>
    ${x.p?`<span class="small" style="opacity:.8">${x.p}</span>`:""}
    <b>${x.n}</b></div>`).join("");
}
function pvpStatsHtml(){
  /* ⚠ 제보 — 「게이지바도 표시 안 되고 그냥 숫자만」. 호스트 통계와 같은 statbar 문법으로. */
  const W=PVP&&PVP.watch; const st=(W&&W.st)||null; const i=(W&&W.info)||{};
  if(!st) return `<p class="small" style="opacity:.6">집계 중…</p>`;
  const _hC=i.hc||"#2ea8ff";
  const _aC=(typeof awayDiscCol==="function")?awayDiscCol(_hC, i.ac||"#f85149"):(i.ac||"#f85149");
  const _hT=(typeof uiInk==="function")?uiInk(_hC):_hC, _aT=(typeof uiInk==="function")?uiInk(_aC):_aC;
  const pTot=(st.hP||0)+(st.aP||0);
  const poss=pTot>40?clamp(Math.round(st.hP/pTot*100),12,88):50;
  const bar=(l,hv,av)=>{const tot=hv+av||1; return `<div class="statbar">`
    +`<span style="width:26px;text-align:right;color:${_hT};font-weight:800">${hv}</span>`
    +`<div class="bg"><div class="fh" style="width:${hv/tot*100}%;background:${_hC}"></div>`
    +`<div class="fa" style="width:${av/tot*100}%;background:${_aC}"></div></div>`
    +`<span style="width:26px;color:${_aT};font-weight:800">${av}</span>`
    +`<span style="width:52px" class="small">${l}</span></div>`;};
  const _lg=`<div class="statLg">`
    +`<span><i style="background:${_hC}"></i><b style="color:${_hT}">${i.hs||"홈"}</b> <span class="small">홈</span></span>`
    +`<span class="small" style="opacity:.6">vs</span>`
    +`<span><i style="background:${_aC}"></i><b style="color:${_aT}">${i.as||"원정"}</b> <span class="small">원정</span></span></div>`;
  return _lg + bar("점유율",poss,100-poss)+bar("슈팅",st.hS||0,st.aS||0)+bar("유효슈팅",st.hT||0,st.aT||0)
    + bar("코너킥",st.hC||0,st.aC||0)+bar("파울",st.hF||0,st.aF||0)+bar("경고",st.hY||0,st.aY||0)+bar("퇴장",st.hR||0,st.aR||0);
}
function pvpScoreTxt(){
  const W=PVP&&PVP.watch; if(!W) return "";
  const i=W.info||{};
  const mm=Math.floor((W.clock||0)/60);
  return (i.hs||"홈")+" "+(W.hg||0)+" : "+(W.ag||0)+" "+(i.as||"원정")+"  ·  "+mm+"'";
}
function pvpEvHtml(){
  const W=PVP&&PVP.watch; if(!W) return "";
  return W.evs.slice(0,26).map(e=>`<div class="small" style="padding:3px 0;border-bottom:1px solid #1b222b">
    <span style="color:var(--sub)">${e.min}'</span> ${e.txt}</div>`).join("");
}
function pvpDrawWatch(){
  /* ⚠ 제보 — 「왼쪽은 형편없는 화면, 오른쪽은 진짜 매치엔진 — 같은 화면을 볼 순 없어?」
     약식 캔버스를 버리고, 스냅샷으로 「가짜 sim」을 만들어 호스트와 동일한 렌더러
     (drawSimWatch: 골망·방향 삼각형·등번호·GK 킷·볼 소유 링)를 그대로 부른다. */
  const cv=document.getElementById("pvpCv"); if(!cv) return;
  const W=PVP.watch;
  const s=W.snap;
  if(!s){ try{ drawPitchBase(cv.getContext("2d"), cv); }catch(e){} return; }
  const i=W.info||{};
  /* GK 판별 — 킥오프 전에 받아 둔 양 팀 스쿼드 팩에서 등번호→포지션 표를 만든다 */
  if(!W.gkNos){
    W.gkNos={h:{}, a:{}};
    try{ for(const q of ((PVP.oppPack&&PVP.oppPack.pl)||[])) if(q.pos==="GK") W.gkNos.h[q.no||0]=1; }catch(e){}
    try{ for(const q of ((PVP.myPack&&PVP.myPack.pl)||[])) if(q.pos==="GK") W.gkNos.a[q.no||0]=1; }catch(e){}
  }
  if(!W.fakeSim){
    W.fakeSim={ M:{home:{col:i.hc||"#2ea8ff", id:"pvp_h", short:i.hs||"홈"},
                   away:{col:i.ac||"#f85149", id:"pvp_a", short:i.as||"원정"}},
                agents:[], ball:{x:.5,y:.5,z:0,ownerId:null},
                /* drawSimWatch 가 곁가지로 읽을 수 있는 필드 — 안전 스텁 */
                clock:0, endSec:5400, matchState:"OPEN_PLAY", sentOff:[], lastEvent:null, t:0,
                report:()=>({h:{possPct:50,acc:0}, a:{possPct:50,acc:0}, totalPass:0, thirds:{def:33,mid:34,att:33}}) };
  }
  const fs=W.fakeSim;
  fs.clock=W.clock||0;
  /* ⚠ 제보(뚝뚝 끊김 → 잠깐 멈췄다 확확) — 적응형 재생 시계.
     고정 「지금-지연」은 스냅샷이 몰려 도착하면(호스트 부하·전송 버스트) 재생 시점이
     버퍼 끝을 추월해 얼었다가, 밀린 표본이 쏟아지면 확 따라잡았다.
     이제 재생 시각(playT)이 프레임마다 스스로 흐른다 — 버퍼가 두꺼우면 1.1배속으로
     살살 따라잡고, 얇으면 0.9배속으로 벌린다. 급정지·순간이동이 속도 미세 변화로 바뀐다. */
  /* ⏩ 컷 전환 — 최신 스냅샷이 빨리 감기(비하이라이트)면 마지막 장면 그림에서 정지한다.
     (첫 장면 전 킥오프 대기 화면은 한 번은 그려 준다) */
  try{
    const newest=W.buf&&W.buf.length?W.buf[W.buf.length-1].s:null;
    if(newest && !newest.hl){
      if(W._ffHeld && W._drawnOnce){
        try{ if(cv.classList&&cv.classList.toggle) cv.classList.toggle("dim", true); }catch(e){}
        return;                                   // 정지 화면 유지 — 혼란한 고속 구간을 그리지 않는다
      }
      W._ffHeld=true;                             // 이번 프레임(정지 컷)만 그리고 다음부터 멈춘다
    } else if(newest && newest.hl){
      if(W._ffHeld){
        /* 새 장면 — 재생 시계를 「이 장면의 첫 프레임」에 앵커링한다.
           (기준 지연으로 되감으면 방금 끝난 컷 구간에 떨어져 어두운 채 머문다) */
        let i=W.buf.length-1;
        while(i>0 && W.buf[i-1].s && W.buf[i-1].s.hl) i--;
        W.playT=W.buf[i].at;
      }
      W._ffHeld=false;
    }
  }catch(e){}
  const buf=W.buf||[];
  const nowR=Date.now();
  const newestAt=buf.length?buf[buf.length-1].at:0;
  const dt=W._raf?clamp(nowR-W._raf,0,120):16; W._raf=nowR;
  if(W.playT==null) W.playT=newestAt-PVP_PLAYOUT;
  const lead=newestAt-W.playT;
  const rate = lead>PVP_PLAYOUT*1.6 ? 1.10 : lead<PVP_PLAYOUT*0.5 ? 0.90 : 1.0;
  W.playT=Math.min(newestAt, Math.max(newestAt-1000, W.playT+dt*rate));
  const T=W.playT;
  let s0=null, s1=null;
  for(let i=buf.length-1;i>=1;i--){
    if(buf[i-1].at<=T && T<=buf[i].at){ s0=buf[i-1]; s1=buf[i]; break; }
  }
  let A0, A1, k;
  if(s0){ A0=s0.s; A1=s1.s; k=clamp((T-s0.at)/Math.max(1, s1.at-s0.at), 0, 1); }
  else { A0=W.prev||s; A1=s; k=1; }              // 버퍼가 아직 얕다 — 최신 장을 그대로
  const lerpA=(a,b)=>a+(b-a)*k;
  const find=(pr,ag)=> pr&&pr.ags.find(x=>x.no===ag.no&&x.side===ag.side);
  const JUMP=0.26;                                // 장면 전환 순간이동 — 호스트와 같은 기준으로 끊는다
  fs.agents.length=0;
  for(const a of A1.ags){
    const q=find(A0,a);
    const key=a.side+String(a.no);
    const jump=q && HYP(a.x-q.x, a.y-q.y)>JUMP;
    /* 방향 삼각형도 보간 — 표본 리듬 그대로 두면 화살표가 틱틱 돈다 (lerpAngle: 각도 순환 처리) */
    const fc=(q&&!jump&&typeof lerpAngle==="function")?lerpAngle(q.face, a.face, k):a.face;
    /* 🦘 점프 — drawSimWatch 는 _hlJ 가 있으면 그걸 먼저 본다(재생용 경로와 같다).
       표본 사이도 보간해야 뛰어오르는 동작이 계단처럼 끊기지 않는다. */
    const jz=(q&&!jump)?lerpA(q.jz||0, a.jz||0):(a.jz||0);
    fs.agents.push({ id:key, side:a.side, slot:(W.gkNos[a.side]&&W.gkNos[a.side][a.no])?"GK":"",
      x:(q&&!jump?lerpA(q.x,a.x):a.x), y:(q&&!jump?lerpA(q.y,a.y):a.y),
      face:fc, _rf:fc, _hlJ:jz, p:{no:a.no} });
  }
  const bJump=HYP(A1.ball.x-A0.ball.x, A1.ball.y-A0.ball.y)>JUMP;
  fs.ball.x=bJump?A1.ball.x:lerpA(A0.ball.x,A1.ball.x);
  fs.ball.y=bJump?A1.ball.y:lerpA(A0.ball.y,A1.ball.y);
  fs.ball.z=bJump?(A1.ball.z||0):lerpA(A0.ball.z||0, A1.ball.z||0);   // 공중볼 궤적도 매끈하게
  /* 주심 — 호스트와 같은 검은 점 (제보: 화면 완전 동일화) */
  if(A1.ref){
    const r0=A0.ref||A1.ref;
    const rJump=HYP(A1.ref.x-r0.x, A1.ref.y-r0.y)>JUMP;
    fs.ref={x:rJump?A1.ref.x:lerpA(r0.x,A1.ref.x), y:rJump?A1.ref.y:lerpA(r0.y,A1.ref.y)};
  } else fs.ref=null;
  fs.ball.ownerId = A1.own ? (A1.own.side+String(A1.own.no)) : null;
  /* 🎯 슛 트레일 — drawSimWatch 는 s._hlShot 이 정의돼 있으면 그걸 먼저 본다.
     게스트의 공에는 엔진 상태(b.state)가 없으므로 스냅샷에서 받은 값을 그대로 얹는다.
     ⚠ 보간 구간에서는 「도착 표본」 기준으로 켠다 — 슛이 시작되는 프레임을 놓치지 않게. */
  fs._hlShot = !!(A1.shot || (A0 && A0.shot));
  try{ drawSimWatch(cv, fs); W._drawnOnce=true; }catch(e){}
  /* 🟨🟥 카드 연출 — 호스트와 같은 drawCardFx (선수 머리 위 카드 + 이름표) */
  try{
    const cd=W.cd;
    if(cd){
      const el=(Date.now()-cd.at)/1000;
      if(el<CARD_FX_SEC){
        const byId={}; for(const g of fs.agents) byId[g.id]=g;
        drawCardFx(cv, fs, {k:cd.k, t:el, id:cd.side+String(cd.no), nm:cd.nm, ps:cd.ps, tm:cd.tm}, byId);
      } else W.cd=null;
    }
  }catch(e){}
  /* 디밍 — 장면 중엔 밝게, 컷(빨리 감기) 정지 화면은 어둡게 (호스트와 같은 .dim) */
  try{ if(cv.classList && cv.classList.toggle) cv.classList.toggle("dim", !!W._ffHeld || !A1.hl); }catch(e){}
}
/* 게스트 전광판 — 호스트 스코어버그와 같은 문법 (팀 필 + 스코어 + 시계 + HIGHLIGHT) */
let pvpGoalT=null;
function pvpShowGoal(m){
  try{
    const el=document.getElementById("pvpGoalOv"); if(!el) return;
    /* ⚔️ 제보 — 호스트가 패널을 걷는 순간 게스트도 함께 걷는다 (같은 호흡) */
    if(m.hide){ if(pvpGoalT){ clearTimeout(pvpGoalT); pvpGoalT=null; } el.classList.add("hidden"); el.innerHTML=""; return; }
    const posTag=(m.slot||m.pos)?`<span class="gpPos pos-${pvpClean(m.pos,3)||"MF"}">${pvpClean(m.slot||m.pos,4)}</span>`:"";
    const nm=pvpClean(m.nm,14)||"득점", min=pvpClean(m.min,8), sub=pvpClean(m.sub,40), tm=pvpClean(m.tm,18);
    el.style.setProperty("--gpCol", /^#[0-9a-fA-F]{3,8}$/.test(m.col||"")?m.col:"#2ea8ff");
    el.innerHTML = m.off
      ? `<div class="gpBox gpOff">
           <div class="gpTag">NO GOAL</div>
           <div class="gpName">${posTag}<span class="gpStrike">${nm}</span></div>
           <div class="gpMeta"><b>${min}'</b> · 🚩 오프사이드로 <b style="color:#ff7b72">득점 취소</b></div>
         </div>`
      : `<div class="gpBox">
           <div class="gpTag">GOAL!</div>
           <div class="gpName">${posTag}${nm}</div>
           <div class="gpMeta"><b>${min}'</b> · ${tm}${sub?` <span class="gpSub">${sub}</span>`:""}</div>
         </div>`;
    el.classList.remove("hidden");
    if(pvpGoalT) clearTimeout(pvpGoalT);
    pvpGoalT=setTimeout(()=>{ try{ el.classList.add("hidden"); }catch(e){} }, m.off?5200:6200);
  }catch(e){}
}
function pvpScoreHtml(){
  const W=PVP&&PVP.watch; if(!W) return "";
  const i=W.info||{}; const s=W.snap||{};
  const mm=Math.floor((W.clock||0)/60);
  const per = s.et ? (mm>105?"연장 후반":"연장 전반") : (s.half2?"후반":"전반");
  const pill=(txt,col)=>`<span style="display:inline-block;padding:3px 10px;border-radius:6px;background:${col};color:${(typeof isLightColor==="function"&&isLightColor(col))?"#0d1117":"#fff"};font-weight:800;font-size:14px">${txt}</span>`;
  return `${pill(i.hs||"홈", i.hc||"#c22")} <b style="font-size:19px;margin:0 6px">${W.hg||0} : ${W.ag||0}</b> ${pill(i.as||"원정", i.ac||"#26c")}
    <span style="color:var(--gold);font-weight:800;margin-left:8px">${mm}' ${per}</span>
    ${s.hl?`<span style="color:#f85149;font-weight:800;margin-left:10px;font-size:12px">● HIGHLIGHT</span>`:""}`;
}
/* ⚔️ 제보 — 상시 「실시간 지시」 슬라이더는 걷어냈다(전술창으로 합침).
   전술 지시는 이제 리그와 같은 전술 화면에서 만지고, 닫을 때 pvpTacRelay 가 한 번에 보낸다. */
/* ── 종료·전적·끊김 ──────────────────────────────────────────────────── */
/* ── 🔁 경기 중 전술 수정 (제보) — 각자 3회, 60초 제한, 반대편은 블라인드 ── */
const PVP_TAC_USES=3, PVP_TAC_SEC=60;
/* 전술창에서 만질 수 있는 지시 — pvpApplyGuestTac 의 허용 목록과 같아야 한다 */
const PVP_TAC_KEYS=["mentality","press","line","tempo","width","counter","pass","crossFq","longShot"];
const PVP_TAC_LAB={mentality:"멘탈리티", press:"압박", line:"수비라인", tempo:"템포",
                   width:"폭", counter:"역습", pass:"패스", crossFq:"크로스", longShot:"중거리"};
function pvpSideState(key){
  try{
    const sd = key==="h" ? liveM.h : liveM.a;
    const xi=onPitch(sd).filter(e=>!e.red).map(e=>({no:(e.p&&e.p.no)||0, n:String((e.p&&e.p.name)||"").slice(0,12),
      ps:String(e.slot||(e.p&&e.p.pos)||"").slice(0,4), cond:Math.round((e.p&&e.p.cond)||0)}));
    const used=new Set(sd.list.map(e=>e.p&&e.p.id));
    const bench=(sd.bench||[]).filter(p=>p&&!xi.some(x=>x.no===p.no)).map(p=>({no:p.no||0, n:String(p.name||"").slice(0,12),
      ps:String(p.prefPos||p.pos||"").slice(0,4), cond:Math.round(p.cond||0)}));
    /* ⚔️ 제보 — 「실시간 지시를 없애고 전술창에서 교체랑 세부전술을 같이」.
       패널에서 슬라이더를 그리려면 지금 값이 있어야 한다 — 상태에 함께 담는다. */
    const T=(sd.team&&sd.team.tactic)||{};
    const tac={}; for(const k of PVP_TAC_KEYS) tac[k]=clamp(T[k]|0,0,4);
    return {xi, bench, subs:sd.subs||0, max:subMax(liveM), tac, form:String(T.formation||"")};
  }catch(e){ return {xi:[], bench:[], subs:0, max:5, tac:{}, form:""}; }
}
function pvpApplySub(key, outNo, inNo){
  try{
    const sd = key==="h" ? liveM.h : liveM.a;
    if((sd.subs||0)>=subMax(liveM)) return {ok:0, why:"교체 한도(5명)를 모두 썼습니다"};
    const outX=onPitch(sd).find(e=>!e.red && e.p && e.p.no===outNo);
    if(!outX) return {ok:0, why:"그 선수는 그라운드에 없습니다"};
    const inP=(sd.bench||[]).find(p=>p && p.no===inNo);
    if(!inP) return {ok:0, why:"그 선수는 벤치에 없습니다"};
    if(inP.pos==="GK" && onPitch(sd).some(x=>x!==outX && x.p.pos==="GK")) return {ok:0, why:"골키퍼가 이미 있습니다 — 키퍼끼리 교체하세요"};
    const done=subIn(liveM, sd, key, outX, inP);
    if(done===null || done===false) return {ok:0, why:"교체할 수 없습니다"};
    return {ok:1};
  }catch(e){ return {ok:0, why:"교체 실패"}; }
}
/* ⚔️ ⚠ 제보 원문 — 「하프타임 때 상대방이 전술 수정하면 나는 못 하잖아. 나도 할 수 있게 해 줘.
   상대가 전술 수정하면 나도 수정을 할 수도 있고 그냥 그대로 갈 수도 있게」.
   원인: 편집 상태를 `tacEdit` 한 칸에 「me / opp」 둘 중 하나로만 담고 있었다. 상대가 열면
      그 칸이 "opp" 로 차서 내 전술 버튼이 막혔다 — 경기 중에는 한 쪽만 만지는 게 맞지만,
      하프타임은 어차피 경기가 멈춰 있는 시간이라 둘이 동시에 짜도 아무 문제가 없다.
   ─ 하프타임에 한해 두 사람이 동시에 연다. 내 편집은 tacEdit, 상대 편집은 tacOppOn 으로
      따로 센다. 후반전은 「양쪽 준비 완료 + 양쪽 다 전술창을 닫음」이라야 시작된다. */
function pvpTacOpen(){
  if(!PVP || PVP.stage!=="match" || PVP.ended) return;
  const htNow = !!PVP._htWait;
  /* 하프타임이면 상대가 만지는 중(opp)이어도 나도 연다 */
  if(PVP.tacEdit === "me") return;
  if(PVP.tacEdit === "opp" && !htNow) return;
  if(PVP.awayMe || PVP.awayOpp){ try{ flash("지금은 수정할 수 없습니다 — 자리 비움 중","warn"); }catch(e){} return; }
  /* ⚔️ ⚠ 제보 원문 — 「온라인 매칭에서 하프타임때 전술 버튼이 안눌러져서 교체를 할 수 없거든?
     하프타임, 즉 후반전 시작할때 교체 할 수 있게 수정해줘」.
     ─ 예전에는 _htWait(하프타임 대기)를 자리 비움과 같은 잠금으로 묶어 버튼을 통째로 막았다.
       실제 축구의 하프타임 교체가 가장 흔한 교체다 — 이제 하프타임에는 전술창이 열리고,
       경기가 이미 멈춰 있는 시간이므로 수정 기회(경기당 3회)도 소모하지 않는다.
       후반전은 양쪽 준비 완료 + 열려 있는 전술창이 없어야 시작된다(pvpHtTryStart). */
  const htFree = !!PVP._htWait;
  if(!htFree){
    if((PVP.tacMe|0)<=0){ try{ flash("🔁 교체·수정 기회를 모두 사용했습니다 (경기당 "+PVP_TAC_USES+"회)","warn"); }catch(e){} return; }
    PVP.tacMe--;
  }
  if(PVP.tacEdit==="opp"){ PVP.tacOppOn=1; }     // 하프타임 동시 편집 — 상대 것은 따로 센다
  PVP.tacEdit="me"; PVP.tacSel={}; PVP.tacT0=Date.now();
  pvpSend({t:"tacp", on:1});
  if(PVP.role==="host"){
    livePaused=true; try{ updLiveCtrl(); }catch(e){}
    PVP.tacState=pvpSideState("h");
    /* ⚔️ 제보 — 리그와 똑같은 「경기 중 전술 수정」 화면을 그대로 연다 */
    PVP_TAC_TEAM=PVP.homeT || (liveM && liveM.h && liveM.h.team) || null;
    try{ openLiveTactics(); }catch(e){ PVP_TAC_TEAM=null; }
  } else {
    PVP.tacState=null;                  // 호스트가 지금 스쿼드 상태를 보내 줄 때까지 기다린다
    pvpTacWait(true);
  }
  /* 60초 제한 — 편집자 쪽 자동 종료 (호스트는 상대 편집도 따로 감시한다) */
  if(PVP.tacTO) clearTimeout(PVP.tacTO);
  PVP.tacTO=setTimeout(()=>{ try{ pvpTacTimeUp(); }catch(e){} }, PVP_TAC_SEC*1000);
}
function pvpTacDone(){
  if(!PVP || PVP.tacEdit!=="me") return;
  PVP.tacEdit=null;
  try{ if(PVP.tacTO){ clearTimeout(PVP.tacTO); PVP.tacTO=null; } }catch(e){}
  try{ pvpTacWait(false); }catch(e){}
  pvpSend({t:"tacp", on:0});
  if(PVP._htWait){
    /* ⚔️ 하프타임 교체가 끝났다 — 준비 버튼을 되살리고, 양쪽이 이미 준비됐다면 후반전을 연다 (제보) */
    try{ if(PVP.role==="host") updLiveCtrl("ht"); }catch(e){}
    try{ pvpHtOverlaySync(); }catch(e){}
    try{ pvpHtTryStart(); }catch(e){}
  } else if(PVP.role==="host") pvpTacResume();
}
/* ⏱ 60초 마감 — 전술 화면을 열어 둔 채로 시간이 다 되면 저장하고 나온다 */
function pvpTacTimeUp(){
  try{
    if(!PVP || PVP.tacEdit!=="me") return;
    try{ flash("⏱ 60초 경과 — 수정을 마감합니다","warn"); }catch(e){}
    if(inLiveTactics){ saveLiveTactics(); return; }
    pvpTacDone();
  }catch(e){}
}
function pvpTacResume(){
  try{
    if(!liveM || !liveM.opts || !liveM.opts.pvp) return;
    if(PVP && (PVP.tacEdit || PVP._htWait || PVP.awayMe || PVP.awayOpp)) return;
    if(livePaused){ try{ if(liveHL) liveHL.lastAdv=nowMs(); lastHLTick=null; }catch(e){}
      livePaused=false; try{ updLiveCtrl(); }catch(e){} }
  }catch(e){}
}
/* ⚔️ 제보 — 옛 전용 오버레이 패널(교체 목록 + 슬라이더)은 걷어냈다.
   경기 중 전술 수정은 리그와 완전히 같은 화면(openLiveTactics)을 쓴다. */
/* 게스트 — 호스트가 스쿼드 상태를 보내 줄 때까지의 짧은 대기 화면 */
function pvpTacWait(on){
  try{
    let ov=document.getElementById("pvpTacOv");
    if(!on){ if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); return; }
    const cv=document.getElementById("pitch2d")||document.getElementById("pvpCv");
    const wrap=cv&&cv.parentNode; if(!wrap) return;
    if(!ov){
      ov=document.createElement("div"); ov.id="pvpTacOv";
      ov.style.cssText="position:absolute;inset:0;background:rgba(5,8,12,.93);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:6;border-radius:8px;text-align:center;padding:14px";
      wrap.appendChild(ov);
    }
    ov.innerHTML=`<div style="font-size:28px">📋</div><div style="font-weight:800">전술창을 여는 중…</div>
      <div class="small" style="opacity:.75">스쿼드 상태를 받아오고 있습니다</div>`;
  }catch(e){}
}
/* ⚔️ 게스트의 그림자 경기 — 리그 전술판은 「경기(M)」가 있어야 그려진다.
   게스트에게는 엔진이 없으므로, 호스트가 알려 준 지금 상태로 똑같은 모양의 경기를 하나 만든다.
   이 경기는 화면을 그리기 위한 것일 뿐 아무것도 굴리지 않는다 — 결과는 등번호로 호스트에 전달된다. */
function pvpGuestTacOpen(st){
  try{
    if(!PVP || !PVP.myPack || !PVP.oppPack) return false;
    const me=pvpBuildTeam(PVP.myPack, "h"), op=pvpBuildTeam(PVP.oppPack, "a");
    if(st.form && FORMATIONS[st.form]) me.tactic.formation=st.form;
    for(const k of PVP_TAC_KEYS) if(st.tac && st.tac[k]!=null) me.tactic[k]=clamp(st.tac[k]|0,0,4);
    const M=createMatch(me, op, {noTable:true, pvp:true, neutral:true, wx:(PVP.wx||undefined)});
    const byNo=(no)=>me.players.find(p=>p.no===no);
    const xi=(st.xi||[]).map(q=>byNo(q.no)).filter(Boolean);
    const bench=(st.bench||[]).map(q=>byNo(q.no)).filter(Boolean);
    if(xi.length<7) return false;                       // 상태가 성치 않다 — 옛 방식으로 물러난다
    M.h.list=xi.map(p=>({p, fit:matchStartFit(p), y:0, red:false, goals:0, assists:0, on:0, off:null}));
    M.h.bench=bench; M.h.subs=st.subs|0; M.h.red=0;
    M.min=(PVP.watch && PVP.watch.clock) ? Math.floor(PVP.watch.clock/60) : 0;
    M.hg=(PVP.watch&&PVP.watch.hg)|0; M.ag=(PVP.watch&&PVP.watch.ag)|0;
    /* 되돌아갈 때 무엇이 바뀌었는지 재기 위한 출발선 */
    PVP.tacBase={subs:M.h.subs, xi:xi.map(p=>p.no), pairs:[]};
    PVP.tacM=M; PVP_TAC_TEAM=me;
    liveM=M; liveSim=null; liveTag="⚔️ 온라인 친선전";
    pvpTacWait(false);
    openLiveTactics();
    return true;
  }catch(e){ try{ console.warn("전술창 준비 실패:", e); }catch(_){} return false; }
}
/* 전술창을 닫는다 — 리그의 저장/취소가 여기로 들어온다 */
function pvpTacClose(save){
  try{
    const guest=(PVP && PVP.role==="guest");
    if(guest && save) pvpTacRelay();
    PVP_TAC_TEAM=null;
    if(guest){
      liveM=null; liveSim=null;
      if(PVP) PVP.tacM=null;
      try{ pvpTacDone(); }catch(e){}
      try{ show("pvp"); }catch(e){}
      try{ pvpHtOverlaySync(); }catch(e){}   // ⚔️ 하프타임이면 준비 오버레이를 다시 씌운다 (제보)
      return;
    }
    /* 호스트 — 바뀐 스쿼드를 굴러가는 엔진에 반영하고 경기 화면으로 돌아간다 */
    if(save && liveSim) try{ liveSim.resyncSquads(); }catch(e){}
    try{ $("#main").innerHTML=liveLayout(liveM, liveTag); }catch(e){}
    livePanelKey="";
    try{ redrawLiveLog(); }catch(e){}
    try{ resumeStashedHL(); }catch(e){}
    try{ syncLive(); }catch(e){}
    try{ pvpTacDone(); }catch(e){}
  }catch(e){}
}
/* 게스트가 바꾼 것을 호스트에 전달한다 — 두 클론은 선수 id 가 다르므로 등번호로 말한다 */
function pvpTacRelay(){
  try{
    const M=PVP&&PVP.tacM; if(!M) return;
    const t=M.h.team, B=PVP.tacBase||{};
    /* ① 교체 — 화면에서 확정한 순서 그대로 (자리 물려받기가 어긋나지 않게) */
    for(const pr of (B.pairs||[])) pvpSend({t:"sub", out:pr.out, in:pr.in});
    /* ② 지시 */
    for(const k of PVP_TAC_KEYS) pvpSend({t:"tac", k, v:clamp(t.tactic[k]|0,0,4)});
    /* ③ 포메이션 */
    if(t.tactic.formation) pvpSend({t:"tacf", f:String(t.tactic.formation)});
    /* ④ 자리 배치·역할 — 등번호로 옮겨 담는다 */
    const sl={}, rl={};
    for(const p of (t.players||[])){
      if(!p || p.no==null) continue;
      const s=t.tactic.slot && t.tactic.slot[p.id];
      if(s) sl[p.no]=String(s).slice(0,4);
      const r=t.tactic.role && t.tactic.role[p.id];
      if(r && r.r) rl[p.no]={r:String(r.r).slice(0,12), d:String(r.d==null?"":r.d).slice(0,3)};
    }
    if(Object.keys(sl).length) pvpSend({t:"tacsl", sl});
    if(Object.keys(rl).length) pvpSend({t:"tacrl", rl});
  }catch(e){}
}
/* 호스트 — 게스트가 보낸 자리 배치·역할을 상대 팀에 옮겨 담는다 */
/* ⚔️ 임무(duty)는 "D"·"S"·"A" 같은 「문자열」이다.
   ⚠ 제보 원문 — 「처음 확정한 전술이랑 경기중 전술이 다르게 나온다」.
      여기가 두 번째 원인이었다 — 전송·수신 양쪽이 임무를 `d|0` 으로 다뤄
      "S"|0 = 0 이 되어, 전술을 한 번 고칠 때마다 모든 임무가 첫 항목으로 되돌아갔다.
   ─ 그 역할이 실제로 가질 수 있는 임무인지 보고, 아니면 그 역할의 기본 임무로 떨어뜨린다. */
function pvpDuty(roleKey, d){
  try{
    const R=(typeof ROLE_BY_KEY!=="undefined") && ROLE_BY_KEY[roleKey];
    const list=(R && Array.isArray(R.duty) && R.duty.length) ? R.duty : ["S"];
    const v=String(d==null?"":d);
    return list.indexOf(v)>=0 ? v : list[0];
  }catch(e){ return "S"; }
}
/* ⚔️ ⚠ 제보 원문 — 「온라인 대전 전술 수정에서 포메이션을 5-3-2 로 바꿔도 반영이 안 된다」.
   원인: 게스트가 보낸 포메이션 변경을 호스트가 `pvpApplyForm(...)` 으로 처리하는데,
      **그 함수가 아예 없었다.** 호출하는 자리만 있고 정의가 없어, 받을 때마다
      ReferenceError 로 그 메시지 처리가 중단됐다 — 포메이션은 물론 그 뒤에 붙는
      확인 응답(tacst)까지 함께 날아갔다. 게스트의 포메이션 변경은 한 번도 반영된 적이 없다.
   ─ 함수를 만든다. 목록에 있는 포메이션만 받아들이고, 적용 뒤 굴러가는 엔진에 즉시 반영한다. */
function pvpApplyForm(t, f){
  try{
    const fn=String(f||"").slice(0,12);
    if(!t || !t.tactic || !FORMATION_SHAPE[fn]) return false;
    if(t.tactic.formation===fn) return true;
    applyFormation(t, fn);
    if(typeof liveM!=="undefined" && liveM) liveM.xiDirty=true;
    if(typeof liveSim!=="undefined" && liveSim) liveSim.resyncSquads();
    return true;
  }catch(e){ return false; }
}
function pvpApplySlots(t, sl, rl){
  try{
    if(!t || !t.tactic) return;
    const byNo={}; for(const p of (t.players||[])) if(p && p.no!=null) byNo[p.no]=p;
    if(sl && typeof sl==="object"){
      t.tactic.slot=t.tactic.slot||{};
      for(const no in sl){ const p=byNo[no]; if(p && SLOT_XY[sl[no]]) t.tactic.slot[p.id]=sl[no]; }
    }
    if(rl && typeof rl==="object"){
      t.tactic.role=t.tactic.role||{};
      for(const no in rl){ const p=byNo[no], r=rl[no];
        if(p && r && typeof ROLE_BY_KEY!=="undefined" && ROLE_BY_KEY[r.r]) t.tactic.role[p.id]={r:r.r, d:pvpDuty(r.r, r.d)}; }
    }
    if(liveM) liveM.xiDirty=true;
    if(typeof liveSim!=="undefined" && liveSim) liveSim.resyncSquads();
  }catch(e){}
}
/* 반대편 블라인드 — 「상대방이 전술을 수정중입니다」 */
/* ⚔️ 상대가 지금 전술창을 열고 있는가 — 경기 중에는 tacEdit="opp",
   하프타임 동시 편집에서는 내 창이 열려 있으므로 tacOppOn 으로 표시된다 (제보) */
function pvpOppEditing(){
  try{
    if(!PVP) return false;
    if(PVP.tacEdit==="opp" || PVP.tacOppOn) return true;
    /* ⚔️ ⚠ 제보 — 「하프타임에 수정했던 포메이션이 적용되지 않은 채 시작되는 경우가 있다」.
       두 번째 원인이 여기였다. 60초 강제 마감(tacTO2)에서 호스트가 `tace` 를 보내면서
       **그 자리에서** 편집 표식을 지웠다. 그런데 게스트는 그 tace 를 받고 나서야
       화면을 저장하고 변경을 보낸다 — 도착했을 땐 이미 문이 닫혀 전부 버려졌다.
       (게스트가 스스로 닫는 정상 흐름은 relay → tacp:0 순서라 문제가 없었다.
        시간을 끌다 강제 마감된 경우에만 조용히 사라졌다 — 하프타임에 흔하다.)
     ─ 문을 닫은 뒤에도 잠깐은 받아 준다. 늦게 도착한 포메이션은 후반 시작 직후에라도
       resyncSquads 로 반영되는 편이, 통째로 사라지는 것보다 낫다. */
    return !!(PVP._oppGrace && Date.now() < PVP._oppGrace);
  }catch(e){ return false; }
}
/* 상대 편집 표식을 내릴 때는 반드시 이걸로 — 유예 창을 함께 연다 */
function pvpOppEditEnd(){
  try{ if(PVP) PVP._oppGrace=Date.now()+PVP_TAC_GRACE; }catch(e){}
}
function pvpTacBlind(on){
  try{
    let ov=document.getElementById("pvpTacBl");
    if(!on){
      if(ov&&ov.parentNode) ov.parentNode.removeChild(ov);
      if(PVP&&PVP.tacBlIv){ clearInterval(PVP.tacBlIv); PVP.tacBlIv=null; }
      if(PVP) PVP.tacBlT0=null;
      return;
    }
    const cv=document.getElementById("pitch2d")||document.getElementById("pvpCv");
    const wrap=cv&&cv.parentNode; if(!wrap) return;
    if(!ov){
      ov=document.createElement("div"); ov.id="pvpTacBl";
      ov.style.cssText="position:absolute;inset:0;background:rgba(5,8,12,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:6;border-radius:8px;text-align:center;padding:14px";
      wrap.appendChild(ov);
    }
    if(!PVP.tacBlT0) PVP.tacBlT0=Date.now();
    const draw=()=>{ try{
      if(!PVP || PVP.tacEdit!=="opp"){ return; }
      let el=document.getElementById("pvpTacBl");
      if(!el){ pvpTacBlind(true); return; }
      const sec=Math.floor((Date.now()-PVP.tacBlT0)/1000);
      el.innerHTML=`<div style="font-size:28px">📋</div>
        <div style="font-weight:800;font-size:16px">상대 감독이 전술을 수정 중입니다…</div>
        <div class="small" style="opacity:.8">수정이 끝나면 경기가 자동으로 재개됩니다 <b>(${sec}초 / 최대 ${PVP_TAC_SEC}초)</b></div>
        <div class="small" style="opacity:.6">💬 채팅은 계속 보낼 수 있습니다</div>`;
    }catch(e){} };
    draw();
    if(PVP.tacBlIv) clearInterval(PVP.tacBlIv);
    PVP.tacBlIv=setInterval(draw, 1000);
  }catch(e){}
}
/* ── ⏸ 자리 비움(백그라운드) 일시정지 ─────────────────────────────────── */
function pvpVisChange(hidden){
  if(!PVP || PVP.stage!=="match" || PVP.ended) return;   // ⚔️ 끝난 경기는 자리 비움을 알리지 않는다
  PVP.awayMe=!!hidden;
  pvpSend({t:"away", on:hidden?1:0});
  pvpAwaySync();
}
function pvpAwaySync(){
  if(!PVP || PVP.stage!=="match" || PVP.ended){ pvpAwayOverlay(false); return; }
  const hold=!!(PVP.awayMe||PVP.awayOpp);
  if(PVP.role==="host" && liveM && liveM.opts && liveM.opts.pvp){
    if(hold && !PVP.awayHold){
      PVP.awayHold=true;
      if(!livePaused){ livePaused=true; try{ updLiveCtrl(); }catch(e){} }
    } else if(!hold && PVP.awayHold){
      PVP.awayHold=false;
      if(livePaused && !PVP._htWait){
        try{ if(liveHL) liveHL.lastAdv=nowMs(); lastHLTick=null; }catch(e){}
        livePaused=false; try{ updLiveCtrl(); }catch(e){}
      }
    }
  }
  pvpAwayOverlay(!!PVP.awayOpp);
}
/* ⚠ 제보 원문 — 「온라인대전하다가 상대 나간후 일반 돌리면 상대 나갔다는 표시가 계속 나와요」.
   원인: 이 오버레이의 1초 타이머(draw)가 「화면이 다시 그려져 사라졌으면 다시 붙인다」로 되어 있는데,
   붙이는 자리를 #pitch2d 로 찾는다 — 그건 리그 경기 화면의 캔버스와 같은 id 다.
   그리고 대전이 끝난 뒤(stage "done")에는 메뉴 잠금이 풀려 다른 화면으로 갈 수 있는데,
   PVP 객체와 이 타이머는 「로비로」를 누르기 전까지 살아 있다.
   ─ 그 상태로 리그 경기를 시작하면, 타이머가 리그 경기 캔버스에 상대 이탈 안내를 다시 붙였다.
   ⚠ 타이머 손잡이를 PVP 안에만 두면 PVP=null 이 된 뒤에는 끌 수조차 없다 — 밖에 따로 둔다. */
let PVP_AWAY_IV=null;
function pvpAwayStop(){
  try{ if(PVP_AWAY_IV){ clearInterval(PVP_AWAY_IV); PVP_AWAY_IV=null; } }catch(e){}
  try{ if(PVP && PVP.awayIv){ clearInterval(PVP.awayIv); PVP.awayIv=null; } }catch(e){}
  try{ if(PVP){ PVP.awayT0=null; PVP.awayOpp=false; } }catch(e){}
  try{ const o=document.getElementById("pvpAwayOv"); if(o&&o.parentNode) o.parentNode.removeChild(o); }catch(e){}
}
/* 지금 「온라인 대전 경기가 실제로 굴러가는 중」인가 — 오버레이를 붙여도 되는 유일한 상태
   ⚠ 게스트(원정)는 엔진을 돌리지 않아 liveM 이 없다 — 대신 관전 통로(PVP.watch)로 판단한다.
      이걸 빼면 게스트 쪽에만 자리 비움 안내가 안 뜬다. */
function pvpAwayLive(){
  try{
    if(!PVP || PVP.stage!=="match" || !PVP.awayOpp) return false;
    if(liveM && liveM.opts && liveM.opts.pvp) return true;
    return !!(PVP.role==="guest" && PVP.watch);
  }catch(e){ return false; }
}
function pvpAwayOverlay(on){
  try{
    let ov=document.getElementById("pvpAwayOv");
    if(!on){ pvpAwayStop(); return; }
    /* 대전 경기 중이 아니면 절대 붙이지 않는다 (제보: 일반 경기에 따라온다) */
    if(!pvpAwayLive()){ pvpAwayStop(); return; }
    const cv=document.getElementById("pitch2d")||document.getElementById("pvpCv");
    const wrap=cv&&cv.parentNode; if(!wrap) return;
    if(!ov){
      ov=document.createElement("div");
      ov.id="pvpAwayOv";
      ov.style.cssText="position:absolute;inset:0;background:rgba(5,8,12,.80);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:5;border-radius:8px;text-align:center;padding:14px";
      wrap.appendChild(ov);
    }
    if(!PVP.awayT0) PVP.awayT0=Date.now();
    const draw=()=>{
      /* ⚠ 대전 경기가 끝났거나 다른 화면으로 넘어갔으면 스스로 멈춘다 (제보) */
      if(!pvpAwayLive()){ pvpAwayStop(); return; }
      let el=document.getElementById("pvpAwayOv");
      if(!el){ pvpAwayOverlay(true); return; }   // 화면 재렌더로 지워졌으면 다시 붙인다
      const sec=Math.floor((Date.now()-PVP.awayT0)/1000);
      el.innerHTML=`<div style="font-size:28px">⏸</div>
        <div style="font-weight:800;font-size:16px">상대 감독이 잠시 자리를 비웠습니다</div>
        <div class="small" style="opacity:.85">경기가 일시정지됐습니다 — 돌아오면 자동으로 재개됩니다 <b>(${sec}초)</b></div>
        <div class="small" style="opacity:.6">💬 채팅은 계속 보낼 수 있습니다</div>
        ${sec>=120?`<button class="mini" style="margin-top:6px;border-color:var(--red)" onclick="pvpForfeitWin('상대가 돌아오지 않습니다')">상대 이탈로 종료 — 3 : 0 몰수승</button>`:""}`;
    };
    draw();
    if(PVP.awayIv) clearInterval(PVP.awayIv);
    if(PVP_AWAY_IV) clearInterval(PVP_AWAY_IV);
    PVP.awayIv=PVP_AWAY_IV=setInterval(draw, 1000);
  }catch(e){}
}
function pvpHalftime(){
  /* ⚠ 제보 — 「후반전 시작을 양쪽 준비 버튼으로. 서로 준비되면 시작」. 12초 자동 재개 폐지. */
  if(PVP){ PVP._htWait=true; PVP.htMe=false; PVP.htOpp=false; }
  livePaused=true; try{ updLiveCtrl("ht"); }catch(e){}
  try{ pvpSend({t:"ht"}); }catch(e){}
  try{ pvpSend({t:"ev", min:"HT", txt:"⏸ 하프타임 — 양쪽 감독이 준비되면 후반전이 시작됩니다", ty:"info", hg:liveM?liveM.hg:0, ag:liveM?liveM.ag:0}); }catch(e){}
}
function pvpHtReady(){
  if(!PVP || !PVP._htWait || PVP.htMe) return;
  PVP.htMe=true;
  pvpSend({t:"htr"});
  try{ flash("✅ 후반전 준비 완료 — 상대 감독을 기다립니다","info"); }catch(e){}
  try{ if(PVP.role==="host") updLiveCtrl("ht"); }catch(e){}
  try{ pvpHtOverlaySync(); }catch(e){}
  pvpHtTryStart();
}
function pvpHtTryStart(){
  if(!PVP || !PVP.htMe || !PVP.htOpp) return;
  if(PVP.tacEdit || PVP.tacOppOn) return;   // ⚔️ 양쪽 다 전술창을 닫아야 후반이 시작된다 (제보)
  PVP._htWait=false;
  if(PVP.role==="host"){
    pvpSend({t:"ht2"});
    try{ flash("⚽ 후반전 시작!","good"); }catch(e){}
    if(liveM && liveM.opts && liveM.opts.pvp && livePaused && !(PVP.awayMe||PVP.awayOpp)) resumeLive();
  }
  try{ pvpHtOverlaySync(); }catch(e){}
}
/* 게스트 하프타임 오버레이 — 준비 버튼 · 「상대가 준비되었습니다」 상태 표시 */
function pvpHtOverlaySync(){
  try{
    const need=!!(PVP && PVP.stage==="match" && PVP.role==="guest" && PVP._htWait);
    let ov=document.getElementById("pvpHtOv");
    if(!need){ if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); return; }
    const cv=document.getElementById("pvpCv"); const wrap=cv&&cv.parentNode; if(!wrap) return;
    if(!ov){
      ov=document.createElement("div"); ov.id="pvpHtOv";
      ov.style.cssText="position:absolute;inset:0;background:rgba(5,8,12,.80);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;z-index:5;border-radius:8px;text-align:center;padding:14px";
      wrap.appendChild(ov);
    }
    ov.innerHTML=`<div style="font-size:26px">⏸</div>
      <div style="font-weight:800;font-size:16px">하프타임</div>
      ${PVP.htOpp?`<div class="small" style="color:var(--green)">💪 상대 감독이 준비되었습니다!</div>`
                 :`<div class="small" style="opacity:.75">상대 감독이 준비 중입니다…</div>`}
      ${PVP.tacOppOn?`<div class="small" style="color:var(--gold)">📋 상대가 교체·전술을 짜는 중입니다 — 나도 지금 짤 수 있습니다</div>`:``}
      ${PVP.htMe?`<div class="small" style="opacity:.85">⏳ 후반전 시작 대기 — 양쪽이 준비되고 전술창이 닫히면 시작됩니다</div>`
                :`<button class="bigbtn" style="max-width:260px" onclick="pvpHtReady()">✅ 후반전 준비 완료</button>`}
      <button class="mini" onclick="pvpTacOpen()" title="하프타임 교체는 수정 기회를 소모하지 않습니다">📋 교체 · 전술 수정 <span class="small" style="opacity:.8">(기회 소모 없음)</span></button>`;
  }catch(e){}
}
/* ── 💬 실시간 채팅 (제보) — 신뢰 채널로 오간다. 로비·경기 어디서든. ── */
function pvpChatHtml(){
  const list=(PVP&&PVP.chat)||[];
  if(!list.length) return `<div class="small" style="opacity:.5">첫 인사를 건네 보세요 🙂</div>`;
  return list.slice(-40).map(c=>`<div class="small" style="padding:2px 0"><b style="color:${c.who==="me"?"var(--green)":"var(--gold)"}">${c.who==="me"?pvpNick():pvpClean((PVP.oppPack&&PVP.oppPack.mgr)||"상대",8)}</b> ${c.x}</div>`).join("");
}
/* 💬 채팅창 높이 기억 — ⚠ 제보(크기 조절). 화면을 다시 그려도 감독이 맞춰 둔 높이를 지킨다.
   .chatBox 를 단 상자면 무엇이든 여기서 한꺼번에 돌본다. */
/* 💬 ⚠ 요청 원문 — 「매칭 후에나 뭔가 행동을 하고 나면 채팅창이 최신순이 아니라 바로
   과거 쪽으로 올라가더라. 수정해 줘」.
   원인: 화면이 다시 그려지면 채팅 상자가 새로 만들어지고, 새 상자의 스크롤은 맨 위(가장 오래된 줄)에서
      시작한다. 새 줄이 올 때만 맨 아래로 내리고 있어서, 다시 그려진 직후에는 과거가 보인 채로 멈춰 있었다.
   ─ 상자를 그릴 때마다 맨 아래로 내린다. 다만 사용자가 위로 올려 옛 대화를 읽는 중이면
     새 줄이 와도 끌어내리지 않는다(60px 여유). */
function chatBoxBottom(el, force){
  try{
    if(typeof el==="string") el=document.getElementById(el);
    if(!el) return;
    if(!force){
      const gap=(el.scrollHeight||0)-(el.scrollTop||0)-(el.clientHeight||0);
      if(gap>60) return;                       // 위로 올려 읽는 중 — 건드리지 않는다
    }
    el.scrollTop=el.scrollHeight;
  }catch(e){}
}
/* 화면에 있는 모든 채팅 상자를 맨 아래로 (그린 직후 한 번) */
function chatBoxesBottom(){
  try{
    const list=document.querySelectorAll ? document.querySelectorAll(".chatBox") : [];
    for(let i=0;i<list.length;i++) chatBoxBottom(list[i], true);
  }catch(e){}
}
function chatBoxSync(){
  try{
    const list=document.querySelectorAll ? document.querySelectorAll(".chatBox") : [];
    for(let i=0;i<list.length;i++){
      const el=list[i]; if(!el || el._cbBound) continue;
      el._cbBound=1;
      const id=el.id || el.getAttribute("data-cbk") || "";
      const def=parseInt(el.getAttribute("data-cbdef"),10)||150;
      let h=0;
      if(id){ try{ h=parseInt(localStorage.getItem("klm2026_cbH_"+id),10)||0; }catch(e){} }
      el.style.height=((h>60&&h<2000)?h:def)+"px";
      chatBoxBottom(el, true);                 // 💬 새로 그린 상자는 최신 줄부터 (요청)
      if(id && typeof ResizeObserver!=="undefined"){
        try{
          const ro=new ResizeObserver(()=>{ try{
            const v=Math.round(el.clientHeight);
            if(v>60 && v<2000) localStorage.setItem("klm2026_cbH_"+id, String(v));
          }catch(e){} });
          ro.observe(el); el._cbRo=ro;
        }catch(e){}
      }
    }
  }catch(e){}
}
function pvpChatBox(compact){
  return `${compact?`<div class="small" style="margin:8px 0 4px;border-top:1px solid #1b222b;padding-top:8px"><b>💬 채팅</b> <span style="opacity:.55">— 모서리를 끌어 크기 조절</span></div>`:""}
    <div id="pvpChatLog" class="chatBox" data-cbdef="${compact?130:190}">${pvpChatHtml()}</div>
    <div style="display:flex;gap:6px;margin-top:6px">
      <input id="pvpChatIn" type="text" maxlength="120" placeholder="메시지 입력 (Enter 전송)"
        style="flex:1;min-width:0;padding:8px;background:var(--bg);border:1px solid var(--acc);border-radius:6px;color:var(--fg);font-size:13px"
        onkeydown="if(event.key==='Enter'&&!event.isComposing){event.preventDefault();pvpChatSend();}">
      <button class="mini" style="padding:8px 14px" onclick="pvpChatSend()">전송</button>
    </div>`;
}
function pvpChatPush(who, x){
  if(!PVP || !x) return;
  (PVP.chat=PVP.chat||[]).push({who, x, at:Date.now()});
  if(PVP.chat.length>60) PVP.chat.splice(0, PVP.chat.length-60);
  try{ const el=document.getElementById("pvpChatLog"); if(el){ el.innerHTML=pvpChatHtml(); el.scrollTop=el.scrollHeight||9e6; } }catch(e){}
}
function pvpChatSend(){
  const inp=document.getElementById("pvpChatIn"); if(!inp||!PVP) return;
  const x=pvpClean(inp.value,120).trim(); if(!x) return;
  const now=Date.now();
  if(PVP._chatAt && now-PVP._chatAt<500) return;   // 도배 방지
  PVP._chatAt=now;
  inp.value="";
  pvpChatPush("me", x);
  pvpSend({t:"chat", x});
}
/* ⚔️ 제보 — 「실시간 지시를 없애고, 전술 버튼 눌러서 전술창에서 교체랑 세부전술 수정」.
   상시 슬라이더를 걷어내고 전술창 하나로 모은다 — 교체도 지시도 같은 자리에서, 같은 대가로. */
function pvpHostPanel(){
  const t=PVP&&PVP.homeT; if(!t) return "";
  return `<button class="bigbtn" style="max-width:none;padding:11px;margin-bottom:8px" onclick="pvpTacOpen()">📋 전술
      <span class="small" style="color:inherit;opacity:.85">— 교체 · 세부 전술 (남은 ${(PVP.tacMe!=null?PVP.tacMe:PVP_TAC_USES)}회)</span></button>
    <p class="small" style="opacity:.7;margin:0 0 8px">전술창을 여는 동안 경기가 멈추고 상대 화면은 가려집니다.</p>
    ${pvpChatBox(1)}`;
}
/* ⚔️ ⚠ 제보 원문 — 「게스트일때 경기 종료후에 결과 확인버튼이 호스트가 결과확인 버튼 눌러야지
   뜨던데... 이건 좀 그렇잖아」.
   원인 — 종료 신호(end)를 pvpFinish 안에서 보냈는데, pvpFinish 는 호스트가 「📋 결과 확인」을
      누른 뒤 finishLive 가 부르는 함수였다. 그래서 게스트는 호스트가 버튼을 누를 때까지
      경기 화면에 묶여 있었다.
   ─ 경기가 끝나 「📋 결과 확인」 버튼이 뜨는 그 순간(updLiveCtrl("ft"))에 곧바로 알린다.
      양쪽 버튼이 같이 뜨고, 누구든 먼저 나가도 상관없다. */
function pvpAnnounceEnd(){
  try{
    if(!PVP || PVP.role!=="host" || PVP._endSent || PVP.forfeited) return;
    if(!liveM || !liveM.opts || !liveM.opts.pvp) return;
    PVP._endSent=1;
    PVP.ended=1;                  // 이 뒤의 이탈은 몰수가 아니다 — 호스트 쪽도 함께 잠근다
    try{ if(PVP.snapT){ clearInterval(PVP.snapT); PVP.snapT=null; } }catch(e){}
    pvpSend({t:"end", hg:liveM.hg||0, ag:liveM.ag||0});
    try{ pvpResPost(liveM.hg||0, liveM.ag||0, 0); }catch(e){}   // 🌐 제보 — 모두의 전적에 남긴다
  }catch(e){}
}
/* 📊 ⚠ 요청 — 「온라인 대전에서도 결과창에 패스맵이랑 경기 모멘텀 그래프가 나왔으면」.
   호스트만 엔진을 굴리므로 게스트에게는 그림 데이터가 아예 없다 — 경기가 끝나는 순간
   한 통으로 보낸다. 좌표는 소수 셋째 자리까지, 연결은 굵은 것 24개까지만 담아 가볍게. */
function pvpRepPack(M){
  try{
    if(!M) return null;
    const trim=(side)=>{
      if(!side) return null;
      return {
        nodes:(side.nodes||[]).slice(0,11).map(n=>({id:n.id, x:+(+n.x).toFixed(3), y:+(+n.y).toFixed(3),
                mn:n.mn|0, tch:n.tch|0, no:n.no|0, nm:String(n.nm||"").slice(0,12), pos:n.pos||"MF"})),
        links:(side.links||[]).slice(0,24).map(l=>({a:l.a, b:l.b, n:l.n|0}))
      };
    };
    const PM=M.pmap ? {h:trim(M.pmap.h), a:trim(M.pmap.a)} : null;
    const MO=M.momo ? {ht:M.momo.ht|45, g:(M.momo.g||[]).slice(0,20),
                       v:(M.momo.v||[]).map(o=>({m:o.m|0, v:+(+o.v).toFixed(2)}))} : null;
    const T=(t)=>t?{name:String(t.name||"").slice(0,26), short:String(t.short||"").slice(0,18),
                    col:/^#[0-9a-fA-F]{3,8}$/.test(t.col||"")?t.col:"#2a6ee8"}:null;
    return {pmap:PM, momo:MO, h:T(M.home), a:T(M.away)};
  }catch(e){ return null; }
}
/* 결과 화면이 쓰는 모양으로 꺼낸다 — 게스트는 홈/원정이 뒤집혀 있지 않다(그림자 경기도 h=나) */
function pvpRepCards(){
  try{
    const R=PVP&&PVP.rep; if(!R) return "";
    const res={pmap:R.pmap||null, momo:R.momo||null};
    const h=Object.assign({}, R.h||{}, {isUser:(PVP.role==="host")});
    const a=Object.assign({}, R.a||{}, {isUser:(PVP.role!=="host")});
    let out="";
    try{ out+=passMapCard(res, h, a)||""; }catch(e){}
    try{ out+=momentumCard(res, h, a)||""; }catch(e){}
    try{ out+=acReportCard(res, h, a)||""; }catch(e){}
    return out ? `<div class="row" style="align-items:flex-start">${out}</div>` : "";
  }catch(e){ return ""; }
}
function pvpFinish(M){
  if(!PVP) return;
  try{ pvpAwayStop(); }catch(e){}     // ⏸ 자리 비움 안내는 경기와 함께 끝난다 (제보)
  try{ if(PVP.snapT){ clearInterval(PVP.snapT); PVP.snapT=null; } }catch(e){}
  if(PVP.forfeited){ return; }   // ⚠ 몰수 확정 — 전적·결과는 이미 적혔다
  const hg=M.hg||0, ag=M.ag||0;
  const iAmHome=PVP.role==="host";
  const my=iAmHome?hg:ag, op=iAmHome?ag:hg;
  pvpLogAdd({opp:(PVP.oppPack&&PVP.oppPack.name)||"상대", oppMgr:(PVP.oppPack&&PVP.oppPack.mgr)||"", my, op, host:iAmHome?1:0});
  pvpSeriesAdd(my, op);                      // 🔁 재대결 연전 스코어
  if(PVP.role==="host" && !PVP._endSent){ PVP._endSent=1; pvpSend({t:"end", hg, ag}); }   // 안전망 — 이미 보냈으면 넘어간다
  PVP.stage="done"; PVP.result={hg,ag};
  /* 📊 패스맵·모멘텀 — 내 화면에 쓰고, 게스트에게도 한 통 보낸다 (요청) */
  try{
    const rp=pvpRepPack(M);
    if(rp){ PVP.rep=rp; pvpSend({t:"rep", r:rp}); }
  }catch(e){}
  try{ saveGame(); }catch(e){}
}
/* ⚔️ 제보 — 「경기 끝나고 나오는 결과 확인 버튼을 호스트만 누를 수 있다. 게스트도 결과 확인
   버튼을 누르고 나갈 수 있게 하자」. 예전에는 종료 신호를 받자마자 화면을 넘겨 버려서,
   게스트는 마지막 장면·통계를 볼 새도 없이 로비로 튕겼다.
   ─ 전적은 이 순간 그대로 기록한다(버튼을 눌러야 남는 것이 아니다). 화면만 붙잡아 둔다. */
function pvpGuestEnd(m){
  if(!PVP) return;
  if(PVP.ended) return;
  const my=m.ag||0, op=m.hg||0;      // 게스트 = 원정
  pvpLogAdd({opp:(PVP.oppPack&&PVP.oppPack.name)||"상대", oppMgr:(PVP.oppPack&&PVP.oppPack.mgr)||"", my, op, host:0});
  pvpSeriesAdd(my, op);                      // 🔁 재대결 연전 스코어
  PVP.ended=1; PVP.result={hg:m.hg,ag:m.ag};
  try{ if(PVP.watchT){ cancelAnimationFrame(PVP.watchT); PVP.watchT=null; } }catch(e){}
  try{ if(inLiveTactics && liveM && liveM.opts && liveM.opts.pvp) cancelLiveTactics(); }catch(e){}
  try{ if(PVP.tacEdit){ PVP.tacEdit=null; pvpTacWait(false); } }catch(e){}
  try{ pvpTacBlind(false); }catch(e){}
  try{ pvpAwayOverlay(false); }catch(e){}
  try{ saveGame(); }catch(e){}
  /* 화면은 그대로 두고 머리말 버튼과 자막만 바꾼다 — 다시 그리면 마지막 장면이 지워진다 */
  let has=false;
  try{
    const bt=document.getElementById("pvpMatchBtns");
    if(bt){ has=true; bt.innerHTML=`<button class="mini sel" onclick="pvpGuestResult()">📋 결과 확인 ▶</button>`; }
    const cap=document.getElementById("pvpCap");
    if(cap) cap.textContent="🏁 경기 종료 — 결과 확인을 눌러 주세요.";
    const cv=document.getElementById("pvpCv");
    if(cv && cv.classList) cv.classList.remove("dim");
    const md=document.getElementById("pvpMode");
    if(md) md.textContent="🏁 종료";
  }catch(e){}
  if(!has) pvpGuestResult();          // 경기 화면이 없으면 붙잡을 것도 없다
}
/* 게스트의 「결과 확인」 — 여기서야 결과 화면으로 넘어간다 */
function pvpGuestResult(){
  if(!PVP) return;
  PVP.ended=0; PVP.stage="done";
  try{ document.body.classList.remove("matchFS"); }catch(e){}
  show("pvp");
}
/* ═══ 🔁 재대결 ════════════════════════════════════════════════════════
   개발 노트 — 「경기 끝나면 양쪽에 '한 판 더'. 방도 P2P 연결도 아직 살아 있으니
   매칭 대기 없이 즉시 다시 시작한다. 인원이 적을수록 한 번 만난 상대와 계속 붙는 게
   자연스러운데, 지금은 그때마다 나가서 큐를 다시 돌아야 한다.」
   ⚠ pvpReset() 을 쓰면 안 된다 — 연결까지 끊어 버린다. 「경기만」 치우고 로비로 되돌린다. */
const PVP_RE_TO=90000;             // 상대 응답을 기다리는 시간
function pvpRematch(){
  if(!PVP || PVP.stage!=="done" || PVP.meRe) return;
  if(!PVP.chR || PVP.chR.readyState!=="open"){ flash("상대와 연결이 끊겼습니다 — 재대결할 수 없습니다.","warn"); return; }
  PVP.meRe=1; pvpSend({t:"rematch"});
  /* 상대가 끝내 답이 없으면 스스로 접는다 */
  try{ if(PVP.reTO) clearTimeout(PVP.reTO); }catch(e){}
  PVP.reTO=setTimeout(()=>{ try{
    if(PVP && PVP.stage==="done" && PVP.meRe && !PVP.oppRe){
      PVP.meRe=0; PVP.reTO=null;
      flash("⚔️ 상대의 응답이 없습니다 — 재대결 신청을 거뒀습니다.","warn");
      if(VIEW==="pvp") show("pvp");
    }
  }catch(e){} }, PVP_RE_TO);
  pvpMaybeRematch(); show("pvp");
}
function pvpMaybeRematch(){
  if(!PVP || PVP.stage!=="done" || !PVP.meRe || !PVP.oppRe) return;
  pvpRematchGo();
}
/* 경기 하나를 치우고 로비로 — 연결·방·전적은 그대로 둔다 */
function pvpRematchGo(){
  if(!PVP) return;
  try{ if(PVP.reTO){ clearTimeout(PVP.reTO); PVP.reTO=null; } }catch(e){}
  /* ① 굴러가던 경기 흔적을 지운다 */
  try{ if(PVP.snapT){ clearInterval(PVP.snapT); PVP.snapT=null; } }catch(e){}
  try{ if(PVP.watchT){ cancelAnimationFrame(PVP.watchT); PVP.watchT=null; } }catch(e){}
  try{ pvpAwayStop(); }catch(e){}
  try{ if(PVP.tacIv){ clearInterval(PVP.tacIv); PVP.tacIv=null; } }catch(e){}
  try{ if(PVP.tacBlIv){ clearInterval(PVP.tacBlIv); PVP.tacBlIv=null; } }catch(e){}
  try{ if(PVP.tacTO){ clearTimeout(PVP.tacTO); PVP.tacTO=null; } }catch(e){}
  try{ if(PVP.tacTO2){ clearTimeout(PVP.tacTO2); PVP.tacTO2=null; } }catch(e){}
  for(const _id of ["pvpAwayOv","pvpHtOv","pvpTacOv","pvpTacBl"]){
    try{ const o=document.getElementById(_id); if(o&&o.parentNode) o.parentNode.removeChild(o); }catch(e){}
  }
  try{ document.body.classList.remove("matchFS"); }catch(e){}
  try{ inLiveTactics=false; liveTacBackup=null; selSwap=null; }catch(e){}
  try{ liveM=null; liveSim=null; liveHL=null; liveFF=false; lastHLTick=null; }catch(e){}
  try{ LIVE_SUB_UNDO=[]; }catch(e){}
  /* ② 지난 경기의 상태값을 전부 초기값으로 */
  /* ⚠ 제보 — 「실시간 전적 스코어가 다르게 나온다」.
     원인: 전적은 한 경기에 한 번만 올리도록 `_resSent` 로 잠근다. 그런데 재대결 초기화에서
        `_endSent` 만 풀고 `_resSent` 를 빠뜨렸다 — 그래서 두 번째 판부터는 결과가 아예 올라가지
        않고, 「모두의 전적」에는 첫 판 점수가 그대로 남아 있었다. 방금 끝낸 판과 다른 점수다. */
  PVP.result=null; PVP.forfeit=null; PVP.forfeited=0; PVP.ended=0; PVP._endSent=0; PVP._resSent=0;
  try{ if(PVP.role==="host"){ PVP.wx=null; pvpRollWx(); } }catch(e){}   // 🌦️ 재대결은 새 하늘 아래 (요청)
  PVP.rep=null;                                                          // 📊 지난 판의 패스맵·모멘텀은 버린다
  PVP.homeT=null; PVP.awayT=null; PVP.tacEdit=null; PVP.tacOppOn=0; PVP.htReady=null; PVP.htOpp=null;
  PVP.meRe=0; PVP.oppRe=0;
  PVP.reCount=(PVP.reCount|0)+1;                 // 몇 번째 판인가 (화면 표기용)
  PVP.meReady=false; PVP.oppReady=false;
  PVP.stage="lobby";
  /* ③ 스쿼드를 다시 교환한다 — 그 사이에 라인업을 바꿨을 수 있다 */
  PVP.oppPack=null;
  try{ pvpHelloSync(); }catch(e){}
  try{ flash("🔁 재대결 — 스쿼드를 다시 확인하고 준비를 눌러 주세요.","good"); }catch(e){}
  try{ saveGame(); }catch(e){}
  show("pvp");
}
/* ═══ 🆚 상대별 전적 (H2H) ══════════════════════════════════════════════
   개발 노트 — 「인원이 적을수록 한 번 만난 상대와 계속 붙는다. 라이벌 구도가 생기려면
   「이 감독 상대로 내가 몇 승 몇 패인가」가 만나는 자리마다 보여야 한다.」
   G.pvpLog 에 이미 상대 닉네임(oppMgr)·스코어가 쌓이고 있으므로 새로 저장할 것은 없다.
   ⚠ 닉네임은 대소문자·기호가 섞일 수 있다 — 장부 키(pvpNickKeyOf)로 맞춘다. */
function pvpH2H(nick){
  const key=pvpNickKeyOf(nick||"");
  const out={n:0, w:0, d:0, l:0, gf:0, ga:0, recent:[], last:null};
  if(!key) return out;
  const L=Array.isArray(G.pvpLog)?G.pvpLog:[];
  for(const x of L){
    if(pvpNickKeyOf(x.oppMgr||"")!==key) continue;
    out.n++; out.gf+=(x.my|0); out.ga+=(x.op|0);
    if(x.my>x.op) out.w++; else if(x.my<x.op) out.l++; else out.d++;
    if(out.recent.length<5) out.recent.push(x.my>x.op?"W":x.my<x.op?"D2L":"D");
    if(!out.last) out.last=x;
  }
  out.recent=out.recent.map(v=>v==="D2L"?"L":v);
  return out;
}
/* 한 줄 요약 — 팝업·로비·결과 화면이 같은 문구를 쓴다 */
/* 🔁 이번 연전(재대결로 이어 붙인 판들)의 누적 스코어 — 로비·결과 화면에 함께 적는다 */
function pvpSeriesLine(){
  try{
    const s=PVP && PVP.series;
    if(!s || (s.w+s.d+s.l)<1) return "";
    return ` <span class="small" style="opacity:.85">· 🔁 이번 연전 <b style="color:var(--gold)">${s.w}승 ${s.d}무 ${s.l}패</b></span>`;
  }catch(e){ return ""; }
}
function pvpSeriesAdd(my, op){
  try{
    if(!PVP) return;
    PVP.series=PVP.series||{w:0,d:0,l:0};
    if(my>op) PVP.series.w++; else if(my<op) PVP.series.l++; else PVP.series.d++;
  }catch(e){}
}
/* 🏅 이번 시즌 티어 조회 — 이미 받아 둔 시즌 순위표에서 찾는다 (추가 통신 없음) */
function pvpTierFind(nick){
  try{
    const key=pvpNickKeyOf(nick||""); if(!key) return null;
    const rows=(PVP_TIER&&PVP_TIER.rows)||null; if(!rows) return null;
    /* 키로 먼저 찾고, 없으면 표시 이름으로 — 장부 키와 표기가 어긋난 옛 기록도 잡는다 */
    return rows.find(x=>x.k===key) || rows.find(x=>pvpNickKeyOf(x.n)===key) || null;
  }catch(e){ return null; }
}
function pvpTierTag(nick){
  const r=pvpTierFind(nick); if(!r) return "";
  if(r.placing) return ` <span class="small" style="color:var(--gold);font-weight:700">🎯 배치 ${r.pl|0}/${TIER_PLACE_N}</span>`;
  const T=pvpTierOf(r.lp);
  return ` <span class="small" style="color:${T.t.c};font-weight:700">${pvpTierLbl(T,13)} · ${r.lp} LP</span>`;
}
/* 🏅 칩·표 안에 들어가는 작은 배지 — 아이콘 + 단계. 자리가 좁으니 이름은 툴팁으로 */
function pvpTierMini(nick, withLp){
  /* 아직 시즌 표를 못 받았으면 아무것도 그리지 않는다 — 전원에게 「–」가 붙으면 오해를 준다 */
  if(!(PVP_TIER && PVP_TIER.rows)) return "";
  const r=pvpTierFind(nick);
  if(!r) return `<span class="tierMini" style="color:#6b7480;border-color:#2a3441" title="이번 시즌 기록 없음">–</span>`;
  if(r.placing){
    const E=pvpPlaceEst(r);
    return `<span class="tierMini" style="color:var(--gold);border-color:#7a5f1e" title="배치고사 ${r.pl|0}/${TIER_PLACE_N}${E?` — 지금 성적이면 ${E.label} 예상`:""}">🎯<b>${r.pl|0}</b>${E?pvpTierSvg(E.t.k,E.div,12):""}</span>`+pvpStreakChip(r);
  }
  const T=pvpTierOf(r.lp);
  const dv=(T.t.k==="master")?"":PVP_DIV[T.div];
  return `<span class="tierMini" style="color:${T.t.c};border-color:${T.t.c}55" title="${T.label} · ${r.lp} LP · ${r.w}승 ${r.d}무 ${r.l}패">`
       + `${pvpTierSvg(T.t.k,T.div,13)}${dv?`<b>${dv}</b>`:""}${withLp?` <span style="opacity:.8">${r.lp}</span>`:""}</span>`
       + pvpStreakChip(r);
}
function pvpH2HLine(nick){
  const h=pvpH2H(nick);
  if(!h.n) return `<span class="small" style="opacity:.65">🆚 처음 만나는 감독입니다</span>`;
  const col=h.w>h.l?"var(--green)":h.w<h.l?"var(--red)":"var(--gold)";
  const form=h.recent.map(v=>`<b style="color:${v==="W"?"var(--green)":v==="L"?"var(--red)":"var(--gold)"}">${v}</b>`).join("");
  return `<span class="small">🆚 상대 전적 <b style="color:${col}">${h.w}승 ${h.d}무 ${h.l}패</b>`
       + ` <span style="opacity:.7">(${h.gf}:${h.ga})</span>`
       + (form?` · 최근 ${form}`:"") + `</span>`;
}
/* ═══ 👤 감독 프로필 카드 · 🔥 연승 도전 ═══════════════════════════════
   ⚠ 요청 원문 — 「1. 감독 프로필 카드 — 닉네임 클릭 → 티어 문장, 시즌 전적, 최근 5경기
      폼(●●○●●), 선호 포메이션, 최다 사용 팀, 연승 기록. 접속 목록·랭킹·전적표 어디서든 열리게.
      2. 연승 도전 (스트릭) — 현재 연승 수를 접속 목록 칩과 프로필에 표시하고, 3/5/10연승마다
      티어 포인트 보너스. 연승 중인 감독한테는 "🔥 5연승 도전자" 태그가 붙어서 도전 욕구를 만듦.
      랭킹에 "최장 연승" 탭 추가」.
   설계 — 새 통신을 한 줄도 늘리지 않는다. 상시 연결은 그대로 3개(live·talk·results)다.
     · 연승·최근 폼·선호 포메이션·최다 사용 팀은 이미 있는 tier/{닉네임키} 칸에 얹는다
       (st=현재 연승 · mx=시즌 최장 연승 · rc=최근 결과 WDL 문자열 · fm=선호 포메이션 · tm=최다 사용 팀).
       Firebase 규칙은 n·p·s·t 만 검사하고 나머지 칸은 막지 않으므로 규칙을 다시 올릴 필요가 없다.
     · 프로필 카드는 이미 받아 둔 tier·rank·results·접속 표시를 한 장으로 모아 그린다. */
const TIER_STREAK_BONUS={3:5, 5:12, 7:20, 10:35};   // 🔥 연승 보너스 LP
function pvpStreakBonus(st){
  st=st|0;
  if(st<3) return 0;
  if(TIER_STREAK_BONUS[st]!=null) return TIER_STREAK_BONUS[st];
  return (st>10 && st%5===0) ? 35 : 0;              // 10연승 뒤로는 5연승마다 다시 +35
}
function pvpStreakNext(st){
  st=st|0;
  for(const k of [3,5,7,10]){ if(st<k) return k; }
  return (Math.floor(st/5)+1)*5;
}
/* 🔥 연승 배지 — 3연승부터 붙는다. 「도전자」 표식이 되어 다른 감독의 도전 욕구를 만든다 */
function pvpStreakChip(r){
  try{
    const st=r&&(r.st|0);
    if(!st || st<3) return "";
    return `<span class="tierMini" style="color:#ff9d5c;border-color:#ff9d5c66;margin-left:2px" title="${st}연승 중 — 꺾으면 이 연승이 끊깁니다">🔥<b>${st}</b></span>`;
  }catch(e){ return ""; }
}
/* ●●○●● — 최근 결과. 승 ● · 무 ◐ · 패 ○ (최신이 왼쪽) */
function pvpFormDots(rc, n){
  const s=String(rc||"").replace(/[^WDL]/g,"").slice(0, n||5);
  if(!s) return `<span class="small" style="opacity:.55">–</span>`;
  return s.split("").map(v=>`<b title="${v==="W"?"승":v==="L"?"패":"무"}" style="font-size:14px;letter-spacing:1px;color:${v==="W"?"var(--green)":v==="L"?"var(--red)":"var(--gold)"}">${v==="W"?"●":v==="D"?"◐":"○"}</b>`).join("");
}
/* 내 경기 기록에서 「최다 사용 팀 · 선호 포메이션」을 뽑는다 — 서버에는 결과값만 한 칸씩 올린다 */
function pvpMyTop(){
  const out={fm:"", tm:""};
  try{
    const L=Array.isArray(G.pvpLog)?G.pvpLog:[];
    const cf={}, ct={};
    for(const x of L){
      if(x&&x.myF) cf[x.myF]=(cf[x.myF]||0)+1;
      if(x&&x.myT) ct[x.myT]=(ct[x.myT]||0)+1;
    }
    const top=(m)=>{ let k="", n=0; for(const j in m){ if(m[j]>n){ n=m[j]; k=j; } } return k; };
    out.fm=String(top(cf)||"").slice(0,14); out.tm=String(top(ct)||"").slice(0,10);
  }catch(e){}
  return out;
}
/* 🔥 라운지 한 줄 — 지금 접속해 있는 연승 도전자들 */
function pvpStreakLine(){
  try{
    const rows=(PVP_TIER&&PVP_TIER.rows)||null; if(!rows) return "";
    const live=((PVP_LIVE&&PVP_LIVE.list)||[]).map(x=>pvpNickKeyOf(x.n));
    const hot=rows.filter(r=>(r.st|0)>=3 && live.indexOf(r.k)>=0).sort((a,b)=>(b.st|0)-(a.st|0)).slice(0,3);
    if(!hot.length) return "";
    return `<p class="small" style="margin:5px 0 0;color:#ff9d5c">🔥 <b>연승 도전자</b> — `
      + hot.map(r=>`<span class="clickable" onclick="pvpProfile('${r.n}')" style="cursor:pointer;text-decoration:underline dotted">${r.n} <b>${r.st}연승</b></span>`).join(" · ")
      + ` <span style="opacity:.7">· 꺾으면 그 연승이 끊깁니다</span></p>`;
  }catch(e){ return ""; }
}
/* 프로필 카드 안의 버튼 — 팝업을 닫고 그 자리로 넘어간다 */
function pvpProfileAct(kind, id, nick){
  try{ const b=document.getElementById("gcModal"); if(b){ b.className="hidden"; b.innerHTML=""; } }catch(e){}
  try{
    if(kind==="chal") pvpChallenge(id, nick);
    else if(kind==="form") pvpShowForm(id);
  }catch(e){}
}
function pvpProfile(nick){
  try{
    const nm=pvpClean(nick,8)||"감독";
    const key=pvpNickKeyOf(nm);
    const me=!!(key && key===pvpNickKey());
    const T=pvpTierFind(nm);
    const RK=((PVP_RANK&&PVP_RANK.rows)||[]);
    const W=RK.find(x=>x.k===key)||null;
    const wRank=W?(RK.indexOf(W)+1):0;
    const LV=((PVP_LIVE&&PVP_LIVE.list)||[]).find(x=>pvpNickKeyOf(x.n)===key)||null;
    /* 내 카드는 서버 값이 아직 안 왔어도 이 기기의 기록으로 메운다 */
    const myTop = me ? pvpMyTop() : null;
    const fm = (T&&T.fm) || (myTop&&myTop.fm) || (LV&&LV.f&&LV.f.fm) || "";
    const tm = (T&&T.tm) || (myTop&&myTop.tm) || (LV&&LV.f&&(LV.f.ts||LV.f.tn)) || "";

    /* ── 머리 — 티어 문장 ── */
    let head;
    if(!T){
      head=`<div style="display:flex;gap:12px;align-items:center">
        <div style="font-size:34px;line-height:1">👤</div>
        <div><div style="font-size:18px;font-weight:800;color:var(--gold)">${nm}${me?' <span class="small">(나)</span>':""}</div>
        <div class="small" style="opacity:.75">이번 시즌 기록이 아직 없습니다</div></div></div>`;
    } else if(T.placing){
      const E=pvpPlaceEst(T);
      head=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="font-size:34px;line-height:1">🎯</div>
        <div style="flex:1;min-width:150px">
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${nm}${me?' <span class="small">(나)</span>':""}</div>
          <div class="small" style="opacity:.9">배치고사 <b>${T.pl|0} / ${TIER_PLACE_N}</b>${E?` · <b style="color:${E.t.c}">${pvpTierLbl(E,13)} 예상</b>`:""}</div>
        </div></div>`;
    } else {
      const t=pvpTierOf(T.lp);
      const sr=((PVP_TIER&&PVP_TIER.rows)||[]).filter(x=>!x.placing).indexOf(T)+1;
      head=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="line-height:1">${pvpTierSvg(t.t.k,t.div,46)}</div>
        <div style="flex:1;min-width:150px">
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${nm}${me?' <span class="small">(나)</span>':""}</div>
          <div class="small" style="color:${t.t.c};font-weight:800">${pvpTierLbl(t,14)} · ${T.lp} LP${sr>0?` · 시즌 ${sr}위`:""}</div>
          ${(T.hi|0)>(T.lp|0)?`<div class="small" style="opacity:.65">최고 ${T.hi} LP</div>`:""}
        </div></div>`;
    }

    /* ── 접속 상태 ── */
    const stat = !LV ? `<span style="opacity:.55">오프라인</span>`
      : LV.me ? `<b style="color:var(--gold)">나</b>`
      : LV.m  ? `<b style="color:#ff9d95">🔴 대전 중</b>`
      : LV.q  ? `<b style="color:#ffd479">🟡 매칭 중</b>`
      : `<b style="color:var(--green)">🟢 접속 중</b>`;

    /* ── 통계 줄 ── */
    const g=T?((T.w|0)+(T.d|0)+(T.l|0)):0;
    const wr=g?Math.round((T.w|0)*100/g):0;
    const cell=(k,v)=>`<div style="flex:1;min-width:88px;background:#161b22;border:1px solid var(--line);border-radius:8px;padding:7px 9px">
        <div class="small" style="opacity:.6">${k}</div><div style="font-weight:700;margin-top:2px">${v}</div></div>`;
    const st=T?(T.st|0):0, mx=T?(T.mx|0):0;
    const grid=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
      ${cell("시즌 전적", g?`${T.w}승 ${T.d}무 ${T.l}패`:"–")}
      ${cell("승률", g?`${wr}%`:"–")}
      ${cell("최근 5경기", pvpFormDots(T?T.rc:"",5))}
      ${cell("현재 연승", st>=1?`<span style="color:#ff9d5c">🔥 ${st}</span>`:"–")}
      ${cell("최장 연승", mx>=1?`<span style="color:#ff9d5c">${mx}연승</span>`:"–")}
      ${cell("주간 랭킹", W?`${W.p}점 <span class="small" style="opacity:.7">(${wRank}위)</span>`:"–")}
      ${cell("선호 포메이션", fm?`<span style="color:var(--gold)">${pvpClean(fm,14)}</span>`:"–")}
      ${cell("최다 사용 팀", tm?pvpClean(tm,12):"–")}
      ${cell("접속 상태", stat)}
    </div>`;

    /* ── 연승 도전 안내 ── */
    const chase = (st>=3)
      ? `<div class="msg warn" style="margin:9px 0 0;padding:8px 10px">🔥 <b>${st}연승 도전자</b> — 다음 보너스는 <b>${pvpStreakNext(st)}연승</b>입니다${me?"":`. 이 감독을 꺾으면 연승이 끊깁니다.`}</div>`
      : "";

    /* ── 나와의 상대 전적 ── */
    const h2h = me ? "" : `<div style="margin-top:9px">${pvpH2HLine(nm)}</div>`;

    /* ── 최근 경기 (모두의 전적에서 이 감독이 낀 판) ── */
    const RS=((PVP_RES&&PVP_RES.rows)||[]).filter(x=>pvpNickKeyOf(x.hn)===key||pvpNickKeyOf(x.an)===key).slice(0,5);
    const recent = RS.length ? `<div style="margin-top:10px"><div class="small" style="opacity:.7;margin-bottom:4px">최근 경기</div>
      ${RS.map(x=>{
        const home=(pvpNickKeyOf(x.hn)===key);
        const my=home?x.hg:x.ag, op=home?x.ag:x.hg;
        const on=home?x.an:x.hn, ot=home?x.at:x.ht;
        const col=my>op?"var(--green)":my<op?"var(--red)":"var(--gold)";
        return `<div class="small" style="display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px solid #1b222b">
          <b style="color:${col};width:20px">${my>op?"승":my<op?"패":"무"}</b>
          <b>${my} : ${op}</b><span style="opacity:.8">vs ${on} <span style="opacity:.6">(${ot})</span></span>
          ${x.ff?`<b style="color:#ff9d5c;margin-left:auto">몰수</b>`:""}</div>`;
      }).join("")}</div>` : "";

    /* ── 버튼 ── */
    let acts="";
    if(LV && !LV.me){
      const canChal = !LV.m && !LV.q && !((LV.v|0) && (LV.v|0)!==PVP_VER) && !PVP;
      acts=`<div style="display:flex;gap:6px;margin-top:11px;flex-wrap:wrap">
        ${canChal?`<button class="mini" style="flex:1;min-width:120px" onclick="pvpProfileAct('chal','${String(LV.id).replace(/[^\w-]/g,"")}','${nm}')">⚔️ 1:1 대전 신청</button>`:""}
        <button class="mini" style="flex:1;min-width:120px" onclick="pvpProfileAct('form','${String(LV.id).replace(/[^\w-]/g,"")}','${nm}')">🔭 포메이션 보기</button>
      </div>`;
    }
    showConfirm(head+grid+chase+h2h+recent+acts, null, {okLabel:"닫기", cancelLabel:""});
  }catch(e){}
}
function pvpLogAdd(r){
  G.pvpLog=Array.isArray(G.pvpLog)?G.pvpLog:[];
  /* 👤 프로필 카드의 「최다 사용 팀 · 선호 포메이션」 밑감 — 경기마다 내 구단·포메이션을 함께 적는다 */
  try{ const _t=userTeam(); if(_t && r) r.myT=String(_t.short||_t.name||"").slice(0,10); }catch(e){}
  try{ const _f=pvpFormPack(); if(_f && _f.fm && r) r.myF=String(_f.fm).slice(0,14); }catch(e){}
  G.pvpLog.unshift(Object.assign({s:G.season, d:G.day||0, at:Date.now()}, r));
  if(G.pvpLog.length>200) G.pvpLog.length=200;
  try{ pvpRankPost(r); }catch(e){}   // 🏆 주간 랭킹 — 내 결과를 장부에 얹는다 (개발 노트)
}
/* ═══ 🏆 유저 주간 랭킹 — 개발 노트: 「유저간 실시간 랭킹. 일주일간의 포인트로 랭킹을 매기는거지」 ═══
   rank/{주차}/{닉네임키} 에 각자 자기 성적을 쌓는다 — 승 3점 · 무 1점 · 패 0점.
   주차는 절대 시각 기준 7일 단위(월요일 개념 없이 굴러가는 주)라 모두에게 같은 잣대다.
   닉네임을 등록한 감독만 랭킹에 오른다 — 이름 없는 성적은 세울 자리가 없다.
   ⚠ 배포 전에 Firebase 규칙에 rank 갈래를 추가해야 한다 (온라인대전_설정가이드.md). */
const PVP_RANK_WEEK=7*24*60*60*1000;
function pvpRankWk(off){ return "w"+(Math.floor(Date.now()/PVP_RANK_WEEK)+(off|0)); }
/* ═══ 🏅 티어 시즌제 ═══════════════════════════════════════════════════
   개발 노트 — 「주간 랭킹은 일주일이면 지워진다. 몇 판 이겼다는 사실이 남질 않으니
   목표가 안 생긴다. 시즌 단위로 쌓이는 티어를 얹자.」
   설계
     · 시즌 = 4주(28일). 절대 시각 기준이라 모두에게 같은 잣대다 (주간 랭킹과 동일한 방식).
     · 순위 백분위가 아니라 「LP 누적」으로 매긴다 — 인원이 적어도 혼자 올라갈 수 있어야 한다.
     · 이기면 오르고 지면 내려가되, 상대 전력이 셀수록 승리가 더 값지고
       약한 상대에게 지면 더 깎인다.
   ⚠ 저장은 기존 rank 갈래를 그대로 쓴다 — rank/{s시즌}/{닉네임키} = {n,p:LP,w,d,l,hi,t}.
      기존 규칙(n 문자열 8자 · p 숫자 · t 숫자)을 그대로 만족하므로
      Firebase 보안 규칙을 다시 배포할 필요가 없다. */
/* ⚠ 제보 원문 — 「티어리스트가 왜이렇게 리셋이 잘되는거야? … 혹시 버전이 바뀌면 티어 랭킹도
   새로 시작하는거니? … 티어랭킹을 따로 서버에서 관리하면 괜찮을까?」
   ── 원인 세 가지 ─────────────────────────────────────────────
   ① 티어를 주간 랭킹과 같은 rank 갈래(rank/s738/…)에 얹어 두었다. 그런데 랭킹을 불러올 때마다
      「아는 칸이 아니면 지운다」는 청소가 돈다. 옛 빌드는 s… 칸을 모른다 —
      그 사람이 ⚔️ 메뉴를 여는 순간 모두의 시즌 티어가 통째로 삭제됐다.
      (버전이 바뀌어서가 아니라, 옛 버전을 쓰는 사람이 한 명만 있어도 날아갔다)
   ② 칸 이름이 절대 시각(28일)으로 갈리므로, 시계가 어긋난 기기는 다른 칸에 쓰고
      「모르는 칸」이 된 남의 칸을 지웠다.
   ③ 4주마다 LP 가 0으로 완전 초기화 — 체감상 「자꾸 리셋된다」.
   ── 수정 ────────────────────────────────────────────────────
   · 티어를 rank 밖의 별도 갈래(tier/{닉네임키})로 옮긴다 — 옛 빌드는 이 갈래를 아예 모르므로
     건드리지 못한다. 칸을 시즌마다 새로 만들지 않고 「한 사람당 한 칸」이라 청소할 것도 없다.
   · 시즌 번호를 칸 이름이 아니라 기록 안(s)에 넣는다. 시즌이 바뀌면 그 사람이 다음 경기를
     치를 때 그 칸에서 조용히 넘어간다.
   · 시즌 전환은 완전 초기화가 아니라 「절반만 남기는」 소프트 리셋(TIER_CARRY).
   · 기록이 없으면 주간 랭킹 성적으로 MMR 을 되살린다(요청: 「MMR 을 주간 랭킹에서 가져오고
     거기에 맞게 티어를 재배치」) — 티어 칸이 날아가도 스스로 복구된다.
   ⚠ 배포 전에 Firebase 규칙에 tier 갈래를 추가해야 한다 (온라인대전_설정가이드.md).
      규칙을 아직 안 올렸으면 쓰기가 실패하는데, 그때는 화면이 그 사실을 알려 준다. */
const TIER_CARRY=0.5;              // 시즌이 바뀔 때 이월되는 LP 비율
const TIER_SEED_PER_PT=7;          // 주간 랭킹 1점 ≈ LP 7 (승 3점 = 21LP ≈ 승 한 판)
/* 🎯 ⚠ 요청 원문 — 「일반 게임들은 배치고사를 보고 거기에 MMR 을 더해서 티어가 배치되잖아.
   우리도 그렇게 하자」.
   배치 5경기 동안에는 티어를 매기지 않고 성적만 모아 둔다. 다섯 판을 마치면
      시작 LP = 기본치 + MMR(주간 랭킹·이월분) + 배치 성적 × 배수
   로 한 번에 자리를 잡는다. 시즌이 바뀌면 배치도 다시 본다 (이월분이 MMR 로 들어간다). */
const TIER_PLACE_N=5;              // 배치 경기 수
const TIER_PLACE_BASE=100;         // 배치 기본치 — 전패해도 브론즈에서 시작
const TIER_PLACE_MUL=2.5;          // 배치 한 판의 무게 (정식 경기의 2.5배)
const PVP_TIER_SEASON=28*24*60*60*1000;
function pvpTierSeasonKey(off){ return "s"+(Math.floor(Date.now()/PVP_TIER_SEASON)+(off|0)); }   // (구버전 자리 — 이전 기록 회수용)
function pvpSeasonNum(){ return Math.floor(Date.now()/PVP_TIER_SEASON); }
/* 사람이 읽는 시즌 번호 — 2026-01-01 을 시즌 1 로 잡는다 (절대 시각 나눗셈이라 모두 같은 값) */
const PVP_TIER_EPOCH=Math.floor(Date.UTC(2026,0,1)/(28*24*60*60*1000));
function pvpTierSeasonNo(){ return Math.floor(Date.now()/PVP_TIER_SEASON)-PVP_TIER_EPOCH+1; }
/* 🎖️ 티어 문장(紋章) — 이모지 대신 직접 그린다.
   ⚠ 요청 — 「티어 아이콘들 좀 멋지게 만들어 줄래?」
   기기마다 제멋대로 그려지는 이모지(🥉⚪🏅)를 버리고, 금속 질감 그라데이션 방패와
   왕관을 SVG 로 그린다. 크기를 지정할 수 있어 큰 카드에서도 뭉개지지 않는다.
   ─ 단계(Ⅲ·Ⅱ·Ⅰ)는 방패 아래 보석 개수로 읽힌다 — 많을수록 위다. */
const TIER_ART={
  bronze:    {a:"#f0c096", b:"#b06a33", c:"#5e3313", g:"#ffe2c4"},
  silver:    {a:"#ffffff", b:"#aeb9c6", c:"#5d6773", g:"#ffffff"},
  gold:      {a:"#fff0b8", b:"#e3b341", c:"#8a610a", g:"#fff8dc"},
  plat:      {a:"#ccfbf2", b:"#3fb9a8", c:"#155e54", g:"#e9fffb"},
  dia:       {a:"#dceeff", b:"#79c0ff", c:"#1f5b96", g:"#f2f9ff"},
  master:    {a:"#f4e3ff", b:"#d2a8ff", c:"#6b3ba8", g:"#fdf5ff"},
  challenger:{a:"#fff1c2", b:"#ffab5c", c:"#a34a14", g:"#fff8e2"}
};
function pvpTierSvg(k, div, size){
  const A=TIER_ART[k]||TIER_ART.bronze, s=+size||14, id="tgr_"+k;
  const crown=(k==="master"||k==="challenger");
  const glow=crown?`filter:drop-shadow(0 0 3px ${A.b}88) drop-shadow(0 1px 2px rgba(0,0,0,.5))`
                  :`filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))`;
  let body;
  if(crown){
    body=`<path d="M3.2 18.6 L1.7 6.9 6.8 10.6 12 2.9 17.2 10.6 22.3 6.9 20.8 18.6 Z"
            fill="url(#${id})" stroke="${A.c}" stroke-width="1.2" stroke-linejoin="round"/>
          <rect x="3.4" y="19.9" width="17.2" height="4.4" rx="1.7"
            fill="url(#${id})" stroke="${A.c}" stroke-width="1.2"/>
          <path d="M12 9.6 l1.3 2.65 2.93.43 -2.12 2.06.5 2.9 -2.61-1.37 -2.61 1.37 .5-2.9 -2.12-2.06 2.93-.43 Z"
            fill="${A.g}" fill-opacity=".95" stroke="${A.c}" stroke-width=".45" stroke-linejoin="round"/>
          <path d="M12 3.6 L15.4 8.6 12 7.4 8.6 8.6 Z" fill="#fff" fill-opacity=".22"/>
          <path d="M7.4 22.05 l1.15 1.4 -1.15 1.4 -1.15 -1.4 Z" fill="${A.g}" fill-opacity=".85"/>
          <path d="M12 22.05 l1.15 1.4 -1.15 1.4 -1.15 -1.4 Z" fill="${A.g}" fill-opacity=".85"/>
          <path d="M16.6 22.05 l1.15 1.4 -1.15 1.4 -1.15 -1.4 Z" fill="${A.g}" fill-opacity=".85"/>`;
  } else {
    const n=Math.max(1, Math.min(3, (div|0)+1));
    let pips="";
    for(let i=0;i<n;i++){
      const x=12+(i-(n-1)/2)*3.7;
      pips+=`<path d="M${x} 18.1 l1.35 1.7 -1.35 1.7 -1.35 -1.7 Z" fill="${A.g}" fill-opacity=".92" stroke="${A.c}" stroke-width=".45"/>`;
    }
    body=`<path d="M12 1.5 L21.7 5.2 V13.9 c0 6.2 -4.2 10.4 -9.7 12.5 C6.5 24.3 2.3 20.1 2.3 13.9 V5.2 Z"
            fill="url(#${id})" stroke="${A.c}" stroke-width="1.25" stroke-linejoin="round"/>
          <path d="M12 4.3 L19.1 7.0 V13.9 c0 4.6 -3.1 7.9 -7.1 9.6 C8 21.8 4.9 18.5 4.9 13.9 V7.0 Z"
            fill="none" stroke="${A.g}" stroke-opacity=".40" stroke-width="1"/>
          <path d="M12 3.3 L19.9 6.3 V9.2 c-2.7 1.95 -5.3 2.8 -7.9 2.8 -2.6 0 -5.2-.85 -7.9-2.8 V6.3 Z"
            fill="#ffffff" fill-opacity=".20"/>
          <path d="M12 6.4 l1.5 3.05 3.37.49 -2.44 2.37.58 3.35 -3.01-1.58 -3.01 1.58 .58-3.35 -2.44-2.37 3.37-.49 Z"
            fill="${A.g}" fill-opacity=".95" stroke="${A.c}" stroke-width=".5" stroke-linejoin="round"/>
          ${pips}`;
  }
  return `<svg class="tierIc" width="${s}" height="${Math.round(s*28/24)}" viewBox="0 0 24 28" style="${glow}" aria-hidden="true">`
       + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1">`
       + `<stop offset="0" stop-color="${A.a}"/><stop offset=".42" stop-color="${A.b}"/><stop offset="1" stop-color="${A.c}"/>`
       + `</linearGradient></defs>${body}</svg>`;
}
/* 문장 + 이름 — 화면에 찍는 정식 표기 */
function pvpTierLbl(T, size){
  if(!T) return "";
  return pvpTierSvg(T.t.k, T.div, size||14)+" "+T.label;
}
const PVP_TIERS=[
  {k:"bronze", n:"브론즈",   ic:"🥉", c:"#c08457", lo:0,    hi:200},
  {k:"silver", n:"실버",     ic:"⚪", c:"#c9d1d9", lo:200,  hi:450},
  {k:"gold",   n:"골드",     ic:"🏅", c:"#e3b341", lo:450,  hi:750},
  {k:"plat",   n:"플래티넘", ic:"💠", c:"#3fb9a8", lo:750,  hi:1100},
  {k:"dia",    n:"다이아",   ic:"💎", c:"#79c0ff", lo:1100, hi:1500},
  {k:"master", n:"마스터",   ic:"👑", c:"#d2a8ff", lo:1500, hi:Infinity}
];
const PVP_DIV=["Ⅲ","Ⅱ","Ⅰ"];
/* LP → 티어·단계·다음 단계까지의 진행도 */
function pvpTierOf(lp){
  lp=Math.max(0, Math.round(+lp||0));
  let T=PVP_TIERS[0];
  for(const t of PVP_TIERS) if(lp>=t.lo) T=t;
  if(T.k==="master"){
    return {t:T, div:0, label:T.n, lp, need:null, prog:1, nextAt:null};
  }
  const span=(T.hi-T.lo)/3;
  const di=clamp(Math.floor((lp-T.lo)/span), 0, 2);
  const segLo=T.lo+span*di, segHi=segLo+span;
  return {t:T, div:di, label:`${T.n} ${PVP_DIV[di]}`, lp,
          need:Math.ceil(segHi-lp), prog:clamp((lp-segLo)/span, 0, 1), nextAt:Math.round(segHi)};
}
/* 한 경기의 LP 변동 — 결과 · 전력차 · 몰수 */
function pvpTierDelta(my, op, myStars, opStars, ff){
  const win=my>op, draw=(my===op);
  if(ff) return win? 18 : -18;                       // 몰수는 경기 내용이 없다 — 고정폭
  const gap=clamp((+opStars||3)-(+myStars||3), -2, 2);   // +면 상대가 강했다
  let d = win? 22 : draw? 6 : -14;
  if(win) d += Math.round(gap*5);                    // 센 상대를 잡으면 더
  else if(!draw) d += Math.round(gap*4);             // 약한 상대에게 지면 더 깎인다 (gap<0)
  return clamp(d, -30, 40);
}
/* 시즌이 바뀌면 지난 시즌 성적을 한 번 알려 준다 (기기에 남긴다 — 닉네임과 같은 단위) */
function pvpTierSeasonCheck(myLp){
  try{
    const cur=pvpTierSeasonKey(0);
    const seen=localStorage.getItem("klm2026_pvpTierSeason")||"";
    const lastLp=+(localStorage.getItem("klm2026_pvpTierLp")||0);
    if(seen && seen!==cur && lastLp>0){
      const T=pvpTierOf(lastLp);
      try{ flash(`🏅 <b>지난 시즌 마감</b> — <b style="color:${T.t.c}">${pvpTierLbl(T,14)}</b> (${Math.round(lastLp)} LP)로 마쳤습니다. 새 시즌이 시작됐습니다!`,"good"); }catch(e){}
      try{ localStorage.setItem("klm2026_pvpTierBest", JSON.stringify({s:seen, lp:Math.round(lastLp), label:T.label, c:T.t.c, k:T.t.k, dv:T.div})); }catch(e){}
    }
    localStorage.setItem("klm2026_pvpTierSeason", cur);
    if(myLp!=null) localStorage.setItem("klm2026_pvpTierLp", String(Math.round(myLp)));
  }catch(e){}
}
function pvpTierLast(){
  try{ const j=localStorage.getItem("klm2026_pvpTierBest"); return j?JSON.parse(j):null; }catch(e){ return null; }
}
function pvpRankPost(r){
  try{
    if(!pvpOn() || !r) return;
    if(!pvpNickClaimed()) return;
    const key=pvpNickKey(); if(!key) return;
    const wk=pvpRankWk(0);
    const pts = r.my>r.op ? 3 : r.my===r.op ? 1 : 0;
    fbGet("rank/"+wk+"/"+key).then(cur=>{
      const c=(cur&&typeof cur==="object")?cur:{};
      return fbSet("rank/"+wk+"/"+key, {
        n:String(pvpNick()||"감독").slice(0,8),
        p:(c.p|0)+pts,
        w:(c.w|0)+(r.my>r.op?1:0), d:(c.d|0)+(r.my===r.op?1:0), l:(c.l|0)+(r.my<r.op?1:0),
        t:Date.now()});
    }).catch(()=>{});
    pvpTierPost(r);                       // 🏅 시즌 티어도 함께 (개발 노트)
  }catch(e){}
}
/* 🏅 시즌 티어 갱신 — 같은 rank 갈래의 「s시즌」 칸에 LP 를 쌓는다 */
/* 🧬 기록 하나를 「지금 시즌 기준」으로 맞춘다 — 시즌이 바뀌었으면 소프트 리셋해서 돌려준다 */
function pvpTierNorm(c){
  const s=pvpSeasonNum();
  const o={ n:"", p:0, w:0, d:0, l:0, hi:0, s, pv:0, t:0, pl:0, pp:0, mm:0, st:0, mx:0, rc:"", fm:"", tm:"" };
  if(!c || typeof c!=="object") return o;
  o.n=String(c.n||"").slice(0,8); o.t=c.t|0; o.pv=c.pv|0;
  /* 👤 선호 포메이션·최다 사용 팀은 시즌이 바뀌어도 그대로 이어진다 (성적이 아니라 취향이다) */
  o.fm=String(c.fm||"").slice(0,14); o.tm=String(c.tm||"").slice(0,10);
  const cs=(typeof c.s==="number")?c.s:null;
  if(cs===s){
    o.p=Math.max(0,c.p|0); o.w=c.w|0; o.d=c.d|0; o.l=c.l|0; o.hi=Math.max(c.hi|0,o.p);
    /* 🎯 배치 — 옛 기록에는 pl 이 없다. 이미 경기를 치른 감독을 다시 배치로 돌려보내지 않는다 */
    o.pl = (c.pl!=null) ? Math.max(0,c.pl|0) : ((c.w|0)+(c.d|0)+(c.l|0) ? TIER_PLACE_N : 0);
    o.pp = c.pp|0; o.mm = c.mm|0;
    /* 🔥 연승 — 이번 시즌 기록만 이어 받는다 (시즌이 바뀌면 0부터) */
    o.st=Math.max(0,c.st|0); o.mx=Math.max(0, c.mx|0, o.st);
    o.rc=String(c.rc||"").replace(/[^WDL]/g,"").slice(0,10);
    return o;
  }
  /* 지난 시즌 기록 — 절반만 안고 새 시즌을 시작한다 (완전 초기화 금지).
     🎯 새 시즌에는 배치를 다시 본다. 이월분은 「지난 시즌 MMR」로 따로 들고 있다가
        배치가 끝날 때 시작 LP 에 얹는다 — 표시 LP 는 배치가 끝나야 정해진다. */
  const carried=Math.max(0, Math.round((c.p|0)*TIER_CARRY));
  o.p=0; o.hi=0; o.pv=Math.max(0,c.p|0); o.w=0; o.d=0; o.l=0;
  o.pl=0; o.pp=0; o.mm=carried;
  return o;
}
/* 🎯 배치가 끝날 때 시작 LP 를 계산한다 — MMR(주간 랭킹·지난 시즌 이월) + 배치 성적 */
function pvpPlaceLp(mmr, pp){
  return Math.max(0, Math.round(TIER_PLACE_BASE + (mmr||0) + (pp||0)*TIER_PLACE_MUL));
}
/* 🔮 요청 — 「배치라고 표시되는 자리 옆에 추정 티어를 넣어 줘」.
   지금까지의 배치 성적을 다섯 판 기준으로 늘려 잡고, MMR 을 얹어 「이대로면 여기」를 보여 준다.
   한 판도 안 치른 감독은 MMR 만으로 잡는다 (주간 랭킹 성적). */
function pvpPlaceEst(r){
  if(!r) return null;
  const pl=Math.max(0, r.pl|0), pp=r.pp|0, mm=r.mm|0;
  const proj = pl>0 ? pp*(TIER_PLACE_N/pl) : 0;
  return pvpTierOf(pvpPlaceLp(mm, proj));
}
/* 🩹 티어 기록이 없을 때 — 주간 랭킹 성적으로 MMR 을 되살린다.
   ⚠ 요청 — 「티어리스트 MMR 을 현재 주간 랭킹에서 가져오고 거기에 맞게 티어를 재배치하자」.
   기록이 통째로 날아가도 라운지가 텅 비지 않고, 그동안의 성적이 티어로 다시 잡힌다. */
function pvpTierSeed(wkRow){
  if(!wkRow) return null;
  const pts=wkRow.p|0;
  const lp=Math.max(0, Math.round(pts*TIER_SEED_PER_PT));
  return { n:wkRow.n||"감독", p:lp, w:wkRow.w|0, d:wkRow.d|0, l:wkRow.l|0, hi:lp, s:pvpSeasonNum(), pv:0, t:Date.now(), seed:1 };
}
/* 📰 ⚠ 요청 — 「뉴스에 온라인 대전 관련 소식 나오는 거 없애자」.
   notify() 는 addNews + flash 다 — 티어·배치·연승 알림이 전부 구단 뉴스에 쌓이고 있었다.
   대전은 구단 서사와 무관하니 화면 배너(flash)로만 알린다. */
function pvpTierPost(r){
  try{
    if(!pvpOn() || !r || !pvpNickClaimed()) return;
    const key=pvpNickKey(); if(!key) return;
    /* 전력차 — 지금 붙은 상대의 스쿼드 성급(패키지에 실려 온 값) */
    let myS=3, opS=3;
    try{ if(PVP && PVP.myPack && PVP.myPack.stars) myS=+PVP.myPack.stars; }catch(e){}
    try{ if(PVP && PVP.oppPack && PVP.oppPack.stars) opS=+PVP.oppPack.stars; }catch(e){}
    const dLp=pvpTierDelta(r.my, r.op, myS, opS, !!r.ff);
    fbGet("tier/"+key).then(cur=>{
      let c=pvpTierNorm(cur);
      /* 기록이 없다 — ① 옛 자리(rank/s…)에 남아 있으면 회수 ② 그것도 없으면 주간 랭킹으로 복원 */
      if(!cur){
        try{
          const seedRow=((PVP_RANK&&PVP_RANK.rows)||[]).find(x=>x.k===key);
          const sd=pvpTierSeed(seedRow);
          if(sd) c=pvpTierNorm(sd);
        }catch(e){}
        /* ③ 그래도 없으면 이 기기에 남겨 둔 마지막 LP 로 (내 것만 — 남의 것은 손대지 않는다) */
        try{ const lo=+(localStorage.getItem("klm2026_pvpTierLp")||0); if(!c.p && lo>0) { c.p=lo; c.hi=lo; } }catch(e){}
      }
      /* 🔥 연승 — ⚠ 요청 「3/5/10연승마다 티어 포인트 보너스」.
         이기면 늘고, 비기거나 지면 그 자리에서 끊긴다. 보너스는 이번 판 LP 에 얹혀
         배치 중이든 정식이든 똑같이 반영된다. */
      const _wn=(r.my>r.op), _dr=(r.my===r.op);
      const stNow=_wn ? (c.st|0)+1 : 0;
      const stBonus=_wn ? pvpStreakBonus(stNow) : 0;
      const stBroke=(!_wn && (c.st|0)>=3) ? (c.st|0) : 0;
      const rcNew=((_wn?"W":_dr?"D":"L")+String(c.rc||"")).slice(0,10);
      const dLpT=dLp+stBonus;
      const _top=pvpMyTop();
      /* 🎯 배치고사 — 다섯 판을 마치기 전에는 티어를 매기지 않고 성적만 모은다 */
      const wasPlacing = c.pl < TIER_PLACE_N;
      let lp, pl=c.pl, pp=c.pp, placedNow=false;
      if(wasPlacing){
        pl=c.pl+1; pp=c.pp+dLpT;
        if(pl>=TIER_PLACE_N){
          /* MMR — ① 이번 시즌에 이미 쌓인 LP ② 지난 시즌 이월분 ③ 주간 랭킹 성적 */
          let mmr=Math.max(c.p|0, c.mm|0);
          if(!mmr){ try{ const sd=pvpTierSeed(((PVP_RANK&&PVP_RANK.rows)||[]).find(x=>x.k===key)); if(sd) mmr=sd.p|0; }catch(e){} }
          lp=pvpPlaceLp(mmr, pp); placedNow=true;
        } else lp=c.p;                     // 배치 중 — 표시 LP 는 아직 없다
      } else lp=Math.max(0, c.p+dLpT);
      const rec={ n:String(pvpNick()||"감독").slice(0,8), p:lp,
        w:c.w+(r.my>r.op?1:0), d:c.d+(r.my===r.op?1:0), l:c.l+(r.my<r.op?1:0),
        hi:Math.max(c.hi, lp), s:pvpSeasonNum(), pv:c.pv, t:Date.now(),
        pl, pp, mm:c.mm,
        /* 🔥👤 연승·최근 폼·선호 포메이션·최다 사용 팀 — 규칙이 검사하지 않는 칸이라 규칙 재배포가 필요 없다 */
        st:stNow, mx:Math.max(c.mx|0, stNow), rc:rcNew,
        fm:String(_top.fm||c.fm||"").slice(0,14), tm:String(_top.tm||c.tm||"").slice(0,10) };
      try{ localStorage.setItem("klm2026_pvpTierLp", String(lp)); }catch(e){}
      try{ localStorage.setItem("klm2026_pvpTierPl", pl+"/"+pp); }catch(e){}
      try{ PVP_TIER.my={lp, w:rec.w, d:rec.d, l:rec.l, hi:rec.hi, dLp, pl, pp}; }catch(e){}
      try{
        if(placedNow){
          const T=pvpTierOf(lp);
          flash(`🎯 <b>배치 완료</b> — <b style="color:${T.t.c}">${pvpTierLbl(T,15)}</b> (${lp} LP)`, "good");
        } else if(pl<TIER_PLACE_N){
          flash(`🎯 <b>배치 ${pl}/${TIER_PLACE_N}</b> — ${TIER_PLACE_N-pl}경기 더 치르면 티어가 정해집니다 <span class="small">(이번 판 ${dLpT>=0?"+":""}${dLpT})</span>`, dLpT>=0?"info":"warn");
        } else {
          const T=pvpTierOf(lp), T0=pvpTierOf(Math.max(0, lp-dLpT));
          if(T.t.k!==T0.t.k || T.div!==T0.div){
            flash(`🏅 <b>${dLpT>=0?"승급":"강등"}</b> — <b style="color:${T.t.c}">${pvpTierLbl(T,15)}</b> (${lp} LP)`, dLpT>=0?"good":"warn");
          } else {
            flash(`🏅 시즌 LP <b>${dLpT>=0?"+":""}${dLpT}</b> → ${lp} LP <span class="small">(${pvpTierLbl(T,13)})</span>`, dLpT>=0?"info":"warn");
          }
        }
      }catch(e){}
      /* 🔥 연승 알림 — 보너스가 붙은 판, 연승이 이어지는 판, 끊긴 판 세 가지 */
      try{
        if(stBonus>0) flash(`🔥 <b>${stNow}연승 달성!</b> 연승 보너스 <b style="color:var(--gold)">+${stBonus} LP</b>`, "good");
        else if(stNow>=3) flash(`🔥 <b>${stNow}연승</b> 진행 중 — ${pvpStreakNext(stNow)}연승에서 보너스 LP`, "info");
        else if(stBroke) flash(`💔 <b>${stBroke}연승이 끊겼습니다.</b>`, "warn");
      }catch(e){}
      return fbSet("tier/"+key, rec).then(ok2=>{
        /* 규칙을 아직 안 올려 쓰기가 막혔다면 화면이 그 사실을 알려 준다 */
        try{ PVP_TIER.wr = (ok2===false) ? false : true; }catch(e){}
        try{ pvpRankPoke(); }catch(e){}      // 🔄 내 티어가 바뀌었으니 표도 새로 그린다
        return ok2;
      });
    }).catch(()=>{});
  }catch(e){}
}
let PVP_RANK={rows:null, at:0, poke:null};
/* 🔄 서버 쪽 랭킹이 바뀌었다는 신호 — 잇따른 변경을 한 번으로 묶어 새로 고친다 (요청) */
function pvpRankPoke(){
  try{
    /* ⚠ 제보 — 대전 중에도 이 갱신이 돌아 서버 요청이 겹쳤다. 표가 화면에 떠 있고
       경기·매칭 중이 아닐 때만 새로 고친다 — 안 보이는 표를 갱신할 이유가 없다. */
    if(typeof pvpBusy==="function" && pvpBusy()) return;
    if(!document.getElementById("pvpRank") && !document.getElementById("pvpTier")) return;
    if(PVP_RANK.poke) return;
    /* 바쁜 라운지에서 초당 몇 번씩 전부 다시 읽지 않게 최소 간격을 둔다 */
    const wait=Math.max(350, 3000-(Date.now()-PVP_RANK.at));
    PVP_RANK.poke=setTimeout(()=>{ PVP_RANK.poke=null; try{ pvpRankRefresh(true); }catch(e){} }, wait);
  }catch(e){}
}
async function pvpRankRefresh(force){
  if(!pvpOn() || PVP_NET===false) return;
  /* ⚔️ 대전이 굴러가는 중에는 랭킹을 긁지 않는다 — 매칭·신호와 회선을 다투지 않게 (제보) */
  try{ if(typeof pvpBusy==="function" && pvpBusy()) return; }catch(e){}
  const now=Date.now();
  if(!force && now-PVP_RANK.at<15000) return;
  PVP_RANK.at=now;
  const all=await fbGet("rank")||{};
  const wk=pvpRankWk(0), prev=pvpRankWk(-1);
  /* 🧹 청소 — ⚠ 제보(티어가 자꾸 리셋된다)의 뿌리가 여기였다.
     예전에는 「내가 아는 칸이 아니면 지운다」였다. 옛 빌드는 시즌 칸(s…)을 모르므로,
     그 사람이 ⚔️ 메뉴를 여는 순간 모두의 시즌 티어가 통째로 삭제됐다.
     (버전이 바뀌어서가 아니라, 옛 버전을 쓰는 사람이 한 명만 있어도 날아갔다.
      시계가 어긋난 기기도 같은 사고를 냈다)
     ─ 이제 「주차 칸(w…) 중, 이번 주도 지난주도 아닌 것」만 지운다.
       모르는 이름의 칸은 무슨 일이 있어도 건드리지 않는다. */
  for(const k in all){
    if(k===wk || k===prev) continue;
    if(!/^w\d+$/.test(k)) continue;                 // w… 가 아니면 남의 것 — 손대지 않는다
    try{ fbDel("rank/"+k); }catch(e){}
  }
  const cur=all[wk]||{}, mineKey=pvpNickKey();
  const rows=[];
  for(const k in cur){
    const e=cur[k]; if(!e || typeof e!=="object") continue;
    rows.push({k, n:pvpClean(e.n,8)||"감독", p:e.p|0, w:e.w|0, d:e.d|0, l:e.l|0, me:k===mineKey});
  }
  rows.sort((a,b)=> b.p-a.p || b.w-a.w || (b.w+b.d+b.l)-(a.w+a.d+a.l));
  PVP_RANK.rows=rows;
  /* 🏅 시즌 티어 — 별도 갈래(tier)에서 읽는다. 없으면 주간 랭킹으로 MMR 을 되살린다 */
  {
    const _t=await fbGetX("tier");
    const tAll=_t.val;
    /* ⚠ 「비어 있음」과 「못 읽음」은 다르다 — 읽기가 성공했으면 값이 null 이어도 정상이다 (제보) */
    PVP_TIER.wr = _t.ok ? true : false;
    const seen={}, trows=[];
    for(const k in (tAll||{})){
      const e=(tAll||{})[k]; if(!e || typeof e!=="object") continue;
      const c=pvpTierNorm(e);
      seen[k]=1;
      if(!c.p && !(c.w+c.d+c.l)) continue;      // 이번 시즌 활동도 이월분도 없으면 뺀다
      trows.push({k, n:pvpClean(c.n||e.n,8)||"감독", lp:c.p, w:c.w, d:c.d, l:c.l, hi:c.hi, me:k===mineKey, pv:c.pv,
                  pl:c.pl, pp:c.pp, mm:Math.max(c.p|0, c.mm|0), placing:(c.pl<TIER_PLACE_N),
                  /* 🔥👤 연승·최근 폼·선호 포메이션·최다 사용 팀 (프로필 카드·연승 탭) */
                  st:c.st|0, mx:c.mx|0, rc:c.rc||"", fm:pvpClean(c.fm,14), tm:pvpClean(c.tm,12)});
    }
    /* 🩹 티어 기록이 없는 감독은 주간 랭킹 성적으로 자리를 잡아 준다
       (⚠ 요청 — 「티어리스트 MMR 을 현재 주간 랭킹에서 가져오고 거기에 맞게 티어를 재배치하자」) */
    for(const r of rows){
      if(seen[r.k]) continue;
      const sd=pvpTierSeed(r); if(!sd || !sd.p) continue;
      trows.push({k:r.k, n:r.n, lp:sd.p, w:sd.w, d:sd.d, l:sd.l, hi:sd.p, me:r.k===mineKey, seed:1,
                  pl:0, pp:0, mm:sd.p, placing:true});
    }
    /* 🛟 내 기록만은 이 기기에 남겨 둔 값으로도 지킨다 — 서버가 비어도 내 티어는 안 사라진다 */
    try{
      const lo=+(localStorage.getItem("klm2026_pvpTierLp")||0);
      if(lo>0 && mineKey){
        const m=trows.find(x=>x.k===mineKey);
        if(!m){
          /* 🎯 이 기기에 남은 배치 진행도도 함께 살린다 (서버가 비어 있을 때) */
          let _pl=TIER_PLACE_N; try{ const s=String(localStorage.getItem("klm2026_pvpTierPl")||""); if(s) _pl=parseInt(s.split("/")[0],10)|0; }catch(e){}
          trows.push({k:mineKey, n:pvpClean(pvpNick(),8)||"감독", lp:lo, w:0,d:0,l:0, hi:lo, me:true, local:1,
                      pl:_pl, placing:(_pl<TIER_PLACE_N)});
        }
        else if(m.lp<lo && !m.seed) m.lp=lo;
      }
    }catch(e){}
    /* 🎯 배치 중인 감독의 MMR 이 비어 있으면 주간 랭킹 성적으로 메운다 — 추정 티어의 밑감 */
    for(const t of trows){
      if(!t.placing || t.mm) continue;
      const w=rows.find(x=>x.k===t.k); const sd=w?pvpTierSeed(w):null;
      if(sd) t.mm=sd.p|0;
    }
    /* 🎯 배치 중인 감독은 순위에 끼지 않는다 — 표 아래에 따로 선다 */
    trows.sort((a,b)=> (a.placing?1:0)-(b.placing?1:0) || b.lp-a.lp || b.w-a.w || (b.w+b.d+b.l)-(a.w+a.d+a.l));
    PVP_TIER.rows=trows;
    const mine=trows.find(x=>x.me)||null;
    PVP_TIER.my = mine ? {lp:mine.lp, w:mine.w, d:mine.d, l:mine.l, hi:mine.hi, pl:mine.pl|0} : (PVP_TIER.my||null);
    PVP_TIER.rank = (mine && !mine.placing) ? (trows.filter(x=>!x.placing).indexOf(mine)+1) : null;
    try{ pvpTierSeasonCheck(mine?mine.lp:null); }catch(e){}
    /* 🔁 옛 자리(rank/s…)에 남아 있던 내 기록을 새 자리로 한 번 옮긴다 */
    try{
      if(mineKey && PVP_TIER.wr && !seen[mineKey] && !localStorage.getItem("klm2026_pvpTierMig")){
        const oldBox=all[pvpTierSeasonKey(0)]||{}, old=oldBox[mineKey];
        if(old && (old.p|0)>0){
          fbSet("tier/"+mineKey, { n:String(pvpNick()||"감독").slice(0,8), p:old.p|0, w:old.w|0, d:old.d|0, l:old.l|0,
            hi:Math.max(old.hi|0, old.p|0), s:pvpSeasonNum(), pv:0, t:Date.now() })
            .then(()=>{ try{ localStorage.setItem("klm2026_pvpTierMig","1"); }catch(e){} });
        } else { localStorage.setItem("klm2026_pvpTierMig","1"); }
      }
    }catch(e){}
    const te=document.getElementById("pvpTier");
    if(te) te.innerHTML=pvpTierHtml();
    /* 🏅 접속 목록 칩에도 티어가 붙는다 — 티어를 막 받아 왔으면 그 목록도 다시 그린다 (요청) */
    try{ const le=document.getElementById("pvpLive"); if(le) le.innerHTML=pvpLiveHtml(); }catch(e){}
  }
  const el=document.getElementById("pvpRank");
  if(el) el.innerHTML=pvpRankHtml();
}
/* 🏅 시즌 티어 카드 — 내 티어 배지 + 진행 막대 + 시즌 순위표 */
function pvpTierHtml(){
  if(PVP_NET===false) return `<p class="small" style="opacity:.6">연결이 끊겨 있어 불러올 수 없습니다.</p>`;
  const R=PVP_TIER;
  const leftMs=(Math.floor(Date.now()/PVP_TIER_SEASON)+1)*PVP_TIER_SEASON - Date.now();
  const leftD=Math.max(0, Math.ceil(leftMs/86400000));
  const last=pvpTierLast();
  const lastLine=last?`<p class="small" style="margin:6px 0 0;opacity:.75">지난 시즌 마감 — <b style="color:${last.c||"var(--gold)"}">${last.k?pvpTierSvg(last.k,last.dv|0,13)+" ":""}${last.label}</b> (${last.lp} LP)</p>`:"";
  if(!pvpNickClaimed())
    return `<p class="small" style="opacity:.75">🎫 <b>닉네임을 저장</b>하면 티어가 매겨집니다 — 이름 없는 성적은 세울 자리가 없습니다.</p>${lastLine}`;
  if(!R.rows) return `<p class="small" style="opacity:.6">불러오는 중…</p>`;
  /* 내 티어 */
  const my=R.my;
  const T=pvpTierOf(my?my.lp:0);
  const games=my?(my.w+my.d+my.l):0;
  const myPl=my?(my.pl|0):0;
  const placing=(myPl<TIER_PLACE_N);
  /* 🎯 배치고사 카드 — 다섯 판을 채우기 전에는 티어 대신 배치 진행도를 보여 준다 */
  const placeCard=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="font-size:34px;line-height:1">🎯</div>
      <div style="flex:1;min-width:170px">
        <div style="font-size:18px;font-weight:800;color:var(--gold)">배치고사 ${myPl} / ${TIER_PLACE_N}</div>
        <div class="small" style="opacity:.85">${TIER_PLACE_N-myPl}경기를 더 치르면 티어가 정해집니다${(function(){
          const r=(R.rows||[]).find(x=>x.me); const E=r?pvpPlaceEst(r):null;
          return E?` · <b style="color:${E.t.c}">${pvpTierLbl(E,13)} 예상</b>`:"";
        })()}</div>
        <div style="display:flex;gap:5px;margin-top:7px">
          ${Array.from({length:TIER_PLACE_N},(_,i)=>`<div style="flex:1;height:9px;border-radius:999px;background:${i<myPl?"var(--gold)":"#161b22"};border:1px solid var(--line)"></div>`).join("")}
        </div>
      </div>
      <div class="small" style="text-align:right;min-width:110px;opacity:.9">
        ${games?`${my.w}승 ${my.d}무 ${my.l}패`:"아직 경기 없음"}
      </div>
    </div>
    <p class="small" style="margin:7px 0 0;opacity:.75">배치가 끝나면 <b>기본 ${TIER_PLACE_BASE} LP + MMR(주간 랭킹·지난 시즌 이월) + 배치 성적×${TIER_PLACE_MUL}</b> 으로 시작 티어가 한 번에 정해집니다.</p>`;
  const bar=`<div style="height:9px;border-radius:999px;background:#161b22;border:1px solid var(--line);overflow:hidden;margin-top:6px">
      <div style="height:100%;width:${Math.round(T.prog*100)}%;background:linear-gradient(90deg,${T.t.c}88,${T.t.c});border-radius:999px"></div></div>`;
  const mine=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="line-height:1">${pvpTierSvg(T.t.k,T.div,46)}</div>
      <div style="flex:1;min-width:150px">
        <div style="font-size:18px;font-weight:800;color:${T.t.c}">${T.t.n}${T.t.k==="master"?"":" "+PVP_DIV[T.div]}</div>
        <div class="small" style="opacity:.85"><b>${my?my.lp:0} LP</b>${T.need!=null?` · 다음 단계까지 ${T.need} LP`:" · 최고 티어"}${R.rank?` · 시즌 ${R.rank}위`:""}</div>
        ${bar}
      </div>
      <div class="small" style="text-align:right;min-width:110px;opacity:.9">
        ${games?`${my.w}승 ${my.d}무 ${my.l}패`:"아직 경기 없음"}${my&&my.hi>my.lp?`<br><span style="opacity:.7">최고 ${my.hi} LP</span>`:""}
      </div>
    </div>`;
  /* 시즌 순위표 */
  const medal=(i)=> i===0?"🥇" : i===1?"🥈" : i===2?"🥉" : `<span style="opacity:.6">${i+1}</span>`;
  /* 🏅 요청 — 「시즌 티어표에서도 유저들 등급 쫘락 볼 수 있게」. 15명에서 자르지 않고
     전원을 담되, 길어지면 표 안에서 스크롤한다. */
  /* 🔥 ⚠ 요청 — 「랭킹에 "최장 연승" 탭 추가」. 같은 표를 두 가지 잣대로 본다 */
  const view=(PVP_TIER.view==="st")?"st":"lp";
  const tabs=`<div style="display:flex;gap:6px;margin-top:10px">
    <button class="mini" style="${view==="lp"?"background:var(--gold);color:#0d1117;font-weight:800":"opacity:.65"}" onclick="pvpTierView('lp')">🏅 티어순</button>
    <button class="mini" style="${view==="st"?"background:#ff9d5c;color:#0d1117;font-weight:800":"opacity:.65"}" onclick="pvpTierView('st')">🔥 최장 연승</button></div>`;
  /* 👤 이름을 누르면 감독 프로필 카드가 열린다 (요청: 어디서든 열리게) */
  const nameCell=(r)=>`<td style="text-align:left"><b class="clickable" onclick="pvpProfile('${r.n}')" title="${r.n} 감독의 프로필 보기"`
    + ` style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px${r.me?";color:var(--gold)":""}">${r.n}</b>${r.me?' <span class="small">(나)</span>':""}</td>`;
  const stRows=R.rows.filter(r=>(r.mx|0)>0||(r.st|0)>0).sort((a,b)=>(b.mx|0)-(a.mx|0)||(b.st|0)-(a.st|0)||b.lp-a.lp);
  const boardSt=stRows.length?`<div class="tblScroll" style="margin-top:8px;max-height:46vh;overflow-y:auto"><table>
    <tr><th style="width:38px">#</th><th style="text-align:left">감독</th><th>최장 연승</th><th>지금</th><th>최근 5</th></tr>
    ${stRows.map((r,i)=>`<tr${r.me?' style="background:rgba(227,179,65,.10)"':""}>
      <td style="font-weight:800">${medal(i)}</td>
      ${nameCell(r)}
      <td><b style="color:#ff9d5c">${r.mx|0}연승</b></td>
      <td class="small">${(r.st|0)>=1?`<b style="color:#ff9d5c">🔥 ${r.st}</b>`:`<span style="opacity:.5">–</span>`}</td>
      <td class="small" style="white-space:nowrap">${pvpFormDots(r.rc,5)}</td></tr>`).join("")}
  </table></div>`:`<p class="small" style="margin-top:8px;opacity:.6">아직 연승 기록이 없습니다 — 내리 두 판을 이기면 여기에 이름이 오릅니다.</p>`;
  const board=R.rows.length?`<div class="tblScroll" style="margin-top:8px;max-height:46vh;overflow-y:auto"><table>
    <tr><th style="width:38px">#</th><th style="text-align:left">감독</th><th>티어</th><th>LP</th><th>전적</th></tr>
    ${R.rows.map((r,i)=>{ const t=pvpTierOf(r.lp);
      /* 👑 챌린저 — 마스터 중 시즌 상위 3명 (자리에 대한 칭호라 인원이 늘면 자연히 어려워진다) */
      const ch=(i<3 && t.t.k==="master" && !r.placing);
      /* 🎯 배치 중인 감독 — 순위·LP 대신 배치 진행도를 적는다 */
      if(r.placing){
        const E=pvpPlaceEst(r);
        return `<tr${r.me?' style="background:rgba(227,179,65,.10)"':""} style="opacity:.8">
      <td style="font-weight:800;opacity:.5">–</td>
      ${nameCell(r)}
      <td class="small" style="white-space:nowrap"><span style="color:var(--gold);font-weight:700">🔮 배치 ${r.pl|0}/${TIER_PLACE_N}</span>
        ${E?`<br><span style="color:${E.t.c};opacity:.85" title="지금 성적이 이어진다면 배치가 끝났을 때 받을 티어입니다">${pvpTierLbl(E,13)} 예상</span>`:""}</td>
      <td class="small" style="opacity:.6">${E?`<span style="opacity:.75">~${pvpPlaceLp(r.mm|0, (r.pl|0)>0?(r.pp|0)*(TIER_PLACE_N/(r.pl|0)):0)}</span>`:"–"}</td>
      <td class="small">${r.w}승 ${r.d}무 ${r.l}패</td></tr>`;}
      return `<tr${r.me?' style="background:rgba(227,179,65,.10)"':""}>
      <td style="font-weight:800">${medal(i)}</td>
      ${nameCell(r)}
      <td class="small" style="color:${t.t.c};font-weight:700;white-space:nowrap">${ch?pvpTierSvg("challenger",0,14)+" 챌린저":pvpTierLbl(t,14)}${pvpStreakChip(r)}${r.seed?`<span class="small" style="opacity:.6" title="티어 기록이 없어 주간 랭킹 성적으로 자리를 잡았습니다 — 다음 경기부터 정식으로 쌓입니다"> ·추정</span>`:""}</td>
      <td><b style="color:var(--green)">${r.lp}</b></td>
      <td class="small">${r.w}승 ${r.d}무 ${r.l}패</td></tr>`;}).join("")}
  </table></div>`:`<p class="small" style="margin-top:8px;opacity:.6">이번 시즌에 아직 경기를 마친 감독이 없습니다 — 1위 자리가 비어 있습니다.</p>`;
  /* ⚠ tier 갈래에 쓰지 못하면(보안 규칙 미배포) 그 사실을 알려 준다 — 조용히 안 쌓이면 최악이다 */
  const wrWarn = (PVP_TIER.wr===false)
    ? `<div class="msg warn" style="margin:8px 0 0">⚠ <b>티어 기록을 서버에 저장하지 못하고 있습니다.</b>
        <span class="small">시즌 티어가 저장되는 <b>tier</b> 칸을 읽고 쓸 수 없다는 뜻입니다. 대개는 <b>Firebase 보안 규칙에 tier 갈래가 아직 없어서</b>이고(설정 가이드 2번을 다시 올려 주세요), 잠깐 통신이 끊겨도 나올 수 있습니다.
        그동안에도 경기는 정상이며 내 LP·배치 진행도는 이 기기에 안전하게 남습니다 — 규칙만 올리면 그대로 이어집니다.</span>
        <div style="margin-top:6px"><button class="mini" onclick="pvpRankRefresh(true)">🔄 다시 확인</button></div></div>` : "";
  return (placing?placeCard:mine) + tabs + (view==="st"?boardSt:board) + lastLine + wrWarn
    + `<p class="small" style="margin-top:6px;opacity:.65">승 +22 · 무 +6 · 패 −14 를 기본으로, <b>상대 스쿼드가 셀수록 승리가 더 값지고</b> 약한 상대에게 지면 더 깎입니다 (몰수는 ±18). LP 는 0 아래로 내려가지 않습니다.<br>
      시즌 ${pvpTierSeasonNo()} — <b>${leftD}일</b> 남았습니다. 시즌이 끝나도 <b>LP 의 절반은 그대로 이월</b>되고, 마감 티어가 기록으로 남습니다.<br>
      <span style="opacity:.9">🔥 <b>연승 보너스</b> — 3연승 <b>+5</b> · 5연승 <b>+12</b> · 7연승 <b>+20</b> · 10연승 <b>+35</b> LP (그 뒤로는 5연승마다 다시 +35). 비기거나 지면 그 자리에서 끊깁니다. 3연승부터 닉네임 옆에 🔥 표식이 붙습니다.</span><br>
      <span style="opacity:.85">🎯 <b>배치고사 ${TIER_PLACE_N}경기</b> — 시즌마다 처음 다섯 판은 티어를 매기지 않고 성적만 모읍니다. 다섯 판을 마치면 <b>기본 ${TIER_PLACE_BASE} LP + MMR + 배치 성적×${TIER_PLACE_MUL}</b> 로 자리를 잡습니다. MMR 은 <b>주간 랭킹 성적</b>(1점 ≈ ${TIER_SEED_PER_PT} LP)과 지난 시즌 이월분에서 가져옵니다.</span></p>`;
}
/* 🔥 시즌 표 보기 전환 — 티어순 · 최장 연승순 (요청: 「최장 연승」 탭) */
function pvpTierView(v){
  try{
    PVP_TIER.view=(v==="st")?"st":"lp";
    const e=document.getElementById("pvpTier"); if(e) e.innerHTML=pvpTierHtml();
  }catch(e){}
}
function pvpRankHtml(){
  if(PVP_NET===false) return `<p class="small" style="opacity:.6">연결이 끊겨 있어 불러올 수 없습니다.</p>`;
  const R=PVP_RANK;
  if(!R.rows) return `<p class="small" style="opacity:.6">불러오는 중…</p>`;
  if(!R.rows.length) return `<p class="small" style="opacity:.6">이번 주에 아직 경기를 마친 감독이 없습니다 — 1위 자리가 비어 있습니다.</p>`;
  const leftMs=(Math.floor(Date.now()/PVP_RANK_WEEK)+1)*PVP_RANK_WEEK - Date.now();
  const leftD=Math.max(0, Math.ceil(leftMs/86400000));
  const medal=(i)=> i===0?"🥇" : i===1?"🥈" : i===2?"🥉" : `<span style="opacity:.6">${i+1}</span>`;
  /* 🏅 요청 — 「주간 랭킹에서도 유저의 시즌 티어를 볼 수 있게」 */
  return `<div class="tblScroll"><table>
    <tr><th style="width:38px">#</th><th style="text-align:left">감독</th><th>티어</th><th>포인트</th><th>전적</th></tr>
    ${R.rows.slice(0,15).map((r,i)=>`<tr${r.me?' style="background:rgba(227,179,65,.10)"':""}>
      <td style="font-weight:800">${medal(i)}</td>
      <td style="text-align:left"><b class="clickable" onclick="pvpProfile('${r.n}')" title="${r.n} 감독의 프로필 보기" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px${r.me?";color:var(--gold)":""}">${r.n}</b>${r.me?' <span class="small">(나)</span>':""}</td>
      <td>${pvpTierMini(r.n)}</td>
      <td><b style="color:var(--green)">${r.p}</b></td>
      <td class="small">${r.w}승 ${r.d}무 ${r.l}패</td></tr>`).join("")}
  </table></div>
  <p class="small" style="margin-top:6px;opacity:.65">승 3점 · 무 1점 · 패 0점 — <b>${leftD}일 뒤</b> 초기화됩니다. 닉네임을 등록한 감독만 오릅니다.</p>`;
}
function pvpDropped(){
  if(!PVP||PVP.stage==="done") return;
  /* ⚔️ 경기가 이미 끝났다면 상대가 먼저 나가도 정상이다 — 결과 확인 화면을 지킨다 */
  if(PVP.ended) return;
  if(PVP.stage==="match"){
    /* ⚠ 제보(몰수) — 무효가 아니라 남은 쪽 3:0 몰수승이다 */
    if(pvpForfeitWin("상대의 접속이 끊겼습니다")) return;
    pvpAbort("연결이 끊겼습니다.");
  } else pvpAbort("연결이 끊겼습니다.");
}
function pvpAbort(msg){
  const inMatch=PVP&&PVP.stage==="match";
  try{ pvpAwayStop(); }catch(e){}     // ⏸ (제보)
  try{ if(PVP&&PVP.watchT) cancelAnimationFrame(PVP.watchT); }catch(e){}
  pvpReset();
  try{ flash("⚔️ "+(msg||"대전이 종료됐습니다."),"warn"); }catch(e){}
  try{
    if(inMatch && liveM && liveM.opts && liveM.opts.pvp){
      liveM.done=true; finishLiveSafe(); return;
    }
  }catch(e){}
  try{ if(VIEW==="pvp") show("pvp"); }catch(e){}
}
/* 몰수승 — 상대가 나갔다 (경기 중 한정). 내 쪽 전적에 3:0 승을 적고 경기를 끝낸다. */
function pvpForfeitWin(why){
  if(!PVP || PVP.stage!=="match" || PVP.forfeited || PVP.ended) return false;   // ⚔️ 종료 뒤 이탈은 몰수가 아니다
  PVP.forfeited=1;
  try{ pvpAwayStop(); }catch(e){}     // ⏸ 자리 비움 안내를 확실히 끈다 (제보: 일반 경기에 따라온다)
  const iH=PVP.role==="host";
  try{ if(PVP.snapT){ clearInterval(PVP.snapT); PVP.snapT=null; } }catch(e){}
  try{ if(PVP.watchT) cancelAnimationFrame(PVP.watchT); }catch(e){}
  pvpLogAdd({opp:(PVP.oppPack&&PVP.oppPack.name)||"상대", oppMgr:(PVP.oppPack&&PVP.oppPack.mgr)||"", my:3, op:0, host:iH?1:0, ff:1});
  try{ if(iH) pvpResPost(3, 0, 1); }catch(e){}          // 🌐 몰수도 기록으로 남긴다
  PVP.stage="done"; PVP.result=iH?{hg:3,ag:0}:{hg:0,ag:3}; PVP.forfeit="opp";
  try{ saveGame(); }catch(e){}
  try{ flash("⚔️ "+(why||"상대가 경기를 떠났습니다")+" — 3:0 몰수승","good"); }catch(e){}
  /* 호스트면 돌아가던 경기 엔진을 세운다 — pvpFinish 가 실제 스코어를 덮어쓰지 않게 forfeited 로 막는다 */
  try{
    if(iH && liveM && liveM.opts && liveM.opts.pvp){ liveM.done=true; finishLiveSafe(); return true; }
  }catch(e){}
  try{ if(VIEW==="pvp") show("pvp"); else show("pvp"); }catch(e){}
  return true;
}
/* 몰수패 — 내가 나간다 (경기 중 한정). 내 전적에 0:3 패를 적고 접속을 정리한다. */
function pvpForfeitLose(){
  if(!PVP || PVP.stage!=="match" || PVP.forfeited || PVP.ended) return false;   // ⚔️ 종료 뒤에는 몰수가 없다
  PVP.forfeited=1;
  const iH=PVP.role==="host";
  pvpSend({t:"bye"});
  try{ if(PVP.snapT){ clearInterval(PVP.snapT); PVP.snapT=null; } }catch(e){}
  try{ if(PVP.watchT) cancelAnimationFrame(PVP.watchT); }catch(e){}
  try{ if(PVP.es) PVP.es.close(); }catch(e){}
  try{ if(PVP.esQ) PVP.esQ.close(); }catch(e){}
  try{ if(PVP.pc) PVP.pc.close(); }catch(e){}
  try{ if(iH) pvpResPost(0, 3, 1); }catch(e){}          // 🌐 몰수도 기록으로 남긴다 (연결을 끊기 전에)
  pvpLogAdd({opp:(PVP.oppPack&&PVP.oppPack.name)||"상대", oppMgr:(PVP.oppPack&&PVP.oppPack.mgr)||"", my:0, op:3, host:iH?1:0, ff:1});
  PVP.stage="done"; PVP.result=iH?{hg:0,ag:3}:{hg:3,ag:0}; PVP.forfeit="me";
  try{ saveGame(); }catch(e){}
  /* 호스트가 기권하면 돌아가던 경기도 접는다 */
  try{
    if(iH && liveM && liveM.opts && liveM.opts.pvp){ liveM.done=true; finishLiveSafe(); return true; }
  }catch(e){}
  try{ show("pvp"); }catch(e){}
  return true;
}
function pvpLeave(){
  /* ⚠ 제보(몰수) — 경기 중 나가기 = 0:3 몰수패. 로비·대기열 취소는 종전대로 벌점 없음. */
  if(PVP && PVP.stage==="match" && PVP.ended){                              // ⚔️ 이미 끝난 경기
    if(PVP.role==="guest"){ pvpGuestResult(); return; }
    try{ finishLiveSafe(); }catch(e){}
    return;
  }
  const go=()=>{ try{ if(pvpForfeitLose()) return; }catch(e){}
                 pvpSend({t:"bye"}); pvpAbort("대전을 종료했습니다."); };
  if(PVP && PVP.stage==="match"){
    /* ⚠ 제보 원문 — 「기권 버튼처리도 인게임 팝업창으로 처리되게 해줄래? 그게 더 좋은거같아」.
       브라우저 기본 confirm 은 전체화면 경기 화면 위에 생뚱맞게 뜨고, 모바일에서는
       주소창까지 끌어내린다. 게임 안의 확인창으로 바꾼다. */
    showConfirm(`<b>🚪 경기 중 기권</b>\n\n지금 나가면 <b style="color:var(--red)">0 : 3 몰수패</b>로 기록됩니다.\n`+
      `상대에게는 <b>3 : 0 몰수승</b>이 남습니다.\n\n<span class="small">잠깐 자리를 비우는 것이라면 탭을 옮겨도 됩니다 — 경기는 자동으로 멈춥니다.</span>`,
      go, {okLabel:"기권한다", cancelLabel:"계속한다", danger:true});
    return;
  }
  go();
}
/* ── 화면 ────────────────────────────────────────────────────────────── */
function pvpStars10(v){ return (Math.round(v)/10).toFixed(1); }
/* 🗺️ 로비 포메이션 그림 — 팩의 선발 11명을 전술판 좌표(SLOT_XY)에 세운다 (제보) */
function pvpFormPitch(pk, col, label){
  try{
    if(!pk || !Array.isArray(pk.pl) || !pk.pl.length) return "";
    if(!/^#[0-9a-fA-F]{3,8}$/.test(col||"")) col="#2a6ee8";
    const xi=pk.pl.slice(0,11);
    const used={};
    const ink=(typeof isLightColor==="function"&&isLightColor(col))?"#0d1117":"#fff";
    const chips=xi.map(q=>{
      let sl=(q.sl&&SLOT_XY[q.sl])?q.sl:((q.pref&&SLOT_XY[q.pref])?q.pref:(q.pos==="GK"?"GK":q.pos==="DF"?"CB":q.pos==="FW"?"ST":"CM"));
      const nth=(used[sl]=(used[sl]||0)+1);
      const b=SLOT_XY[sl]||SLOT_XY.CM;
      let y=b.y + (nth>1 ? ((nth%2)?1:-1)*0.11*Math.ceil((nth-1)/2) : 0);
      y=clamp(y, 0.07, 0.93);
      const left=(y*100).toFixed(1), top=((1-b.x)*84+6).toFixed(1);   // GK 가 아래
      return `<div style="position:absolute;left:${left}%;top:${top}%;transform:translate(-50%,-50%);text-align:center;width:54px;pointer-events:none">
        <div style="width:23px;height:23px;line-height:23px;border-radius:50%;background:${col};color:${ink};font-weight:800;font-size:10.5px;margin:0 auto;border:1.5px solid rgba(0,0,0,.55)">${q.no||""}</div>
        <div style="font-size:9.5px;margin-top:1px;color:#f2f6fa;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.n||""}</div></div>`;
    }).join("");
    return `<div style="flex:1;min-width:215px;max-width:290px">
      <div class="small" style="margin-bottom:4px;text-align:center"><b>${label}</b> <span style="opacity:.75">· ${(pk.tac&&pk.tac.formation)||""}</span></div>
      <div style="position:relative;width:100%;aspect-ratio:3/3.8;background:linear-gradient(#155d31,#123f24);border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <div style="position:absolute;left:4%;right:4%;top:3%;bottom:3%;border:1px solid rgba(255,255,255,.28);border-radius:2px"></div>
        <div style="position:absolute;left:4%;right:4%;top:50%;border-top:1px solid rgba(255,255,255,.28)"></div>
        <div style="position:absolute;left:50%;top:50%;width:26%;aspect-ratio:1;border:1px solid rgba(255,255,255,.28);border-radius:50%;transform:translate(-50%,-50%)"></div>
        <div style="position:absolute;left:29%;right:29%;bottom:3%;height:13%;border:1px solid rgba(255,255,255,.28);border-bottom:none"></div>
        <div style="position:absolute;left:29%;right:29%;top:3%;height:13%;border:1px solid rgba(255,255,255,.28);border-top:none"></div>
        ${chips}
      </div></div>`;
  }catch(e){ return ""; }
}
