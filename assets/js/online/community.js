"use strict";
/* ═══ 🗣️ 커뮤니티 — 온라인 공용 게시판 ═════════════════════════════════════
   ⚠ 요청 원문 — 「좌측 메뉴에 커뮤니티 메뉴를 만들고, 거기에 자신의 스쿼드를
      유저들과 자랑할 수 있는 공간을 만들자. 온라인 공안인거지. 글도 쓸 수 있고, 이미지처럼 말이야.」
   ─ 구조: Firebase RTDB 의 /pvp/board 갈래를 쓴다. 파일 저장소가 없으므로 「이미지 업로드」는
     불가능하다. 대신 ① 내 선발 11명·포메이션·팀 색을 그대로 담은 「스쿼드 카드」를 붙일 수 있고
     (데이터라 2~3KB밖에 안 되고, 받는 쪽에서 전술판 그림으로 다시 그려진다),
     ② 외부 이미지 주소(https)를 붙여넣을 수도 있다.
   ─ 갈래를 넷으로 나눈 이유: 목록(i)은 가볍게, 본문(p)은 열 때만, 댓글(c)·추천/신고(v,r)는 따로.
     목록만 받아 오면 글 120개라도 20KB 남짓이다. */
const CM_TAGS=[
  {k:"squad", n:"스쿼드 자랑", c:"#e3b341"},
  {k:"tip",   n:"공략",        c:"#4dd0b1"},
  {k:"ask",   n:"질문",        c:"#58a6ff"},
  {k:"chat",  n:"잡담",        c:"#d2a8ff"},
  {k:"lfg",   n:"대전 모집",    c:"#f85149"},
  {k:"fun",   n:"유머",        c:"#ff9d5c"}
];
const CM_TTL=30*24*60*60*1000;   // 한 달이 지난 글은 접속한 사람이 지운다
const CM_SHOW=120;               // 목록에 남기는 글 수
const CM_POST_GAP=60*1000;       // 도배 방지 — 글
const CM_CMT_GAP=10*1000;        // 도배 방지 — 댓글
const CM_HIDE_RP=3;              // 신고가 이만큼 쌓이면 가린다
const CM_REFRESH=45000;          // 커뮤니티 화면에 있는 동안 자동 새로고침
let CMB={mode:"list", tag:"all", sort:"new", id:null, rows:null, ok:null, why:"",
          post:null, cmts:null, at:0, tried:0, busy:0, draft:null, cAt:0, pAt:0,
          live:null, tier:null, prof:null, sr:null, vt:null};
let CM_BG=null;
let CM_TIMER=null;

function cmOn(){ return !!PVP_FB; }
function cmEsc(s, n){ try{ return pvpClean(s, n||40); }catch(e){ return ""; } }
function cmMe(){ try{ return pvpId(); }catch(e){ return ""; } }
function cmAdmin(){ try{ return localStorage.getItem("klm2026_cmAdmin")==="1"; }catch(e){ return false; } }
function cmTag(k){ for(const t of CM_TAGS) if(t.k===k) return t; return null; }
function cmTagChips(str){
  return String(str||"").split(",").filter(Boolean).map(k=>{ const t=cmTag(k); if(!t) return "";
    return `<span class="cmTag" style="border-color:${t.c}55;color:${t.c}">${t.n}</span>`; }).join("");
}
/* 「2시간 전에 포스팅됨」 — 목록에서 시간을 읽기 쉽게 */
function cmWhen(t){
  const d=Date.now()-(+t||0);
  if(d<60000) return "방금";
  if(d<3600000) return Math.floor(d/60000)+"분 전";
  if(d<86400000) return Math.floor(d/3600000)+"시간 전";
  return Math.floor(d/86400000)+"일 전";
}
/* 로컬 표식 — 서버를 다녀오지 않아도 이미 누른 글은 다시 못 누르게 */
function cmMark(kind, id, set){
  const key="klm2026_cm"+kind;
  let o={}; try{ o=JSON.parse(localStorage.getItem(key)||"{}")||{}; }catch(e){ o={}; }
  if(set===undefined) return !!o[id];
  o[id]=1;
  /* 표식이 무한히 쌓이지 않게 — 400개를 넘으면 오래된 쪽부터 버린다 */
  try{ const ks=Object.keys(o); if(ks.length>400) for(const k of ks.slice(0, ks.length-400)) delete o[k]; }catch(e){}
  try{ localStorage.setItem(key, JSON.stringify(o)); }catch(e){}
  return true;
}

/* ── 🧳 스쿼드 카드 — 지금 내 선발 열한 명을 그대로 담는다 ──────────────────
   pvpPack 과 같은 좌표(SLOT_XY)를 쓰므로, 받는 쪽은 로비 포메이션 그림(pvpFormPitch)으로
   한 줄이면 다시 그려진다. 능력치 전부가 아니라 「보여 줄 것」만 담아 가볍게 유지한다. */
function cmSquadPack(){
  try{
    if(G.jobless) return null;
    const t=userTeam(); if(!t) return null;
    let xi=[]; try{ xi=bestXI(t)||[]; }catch(e){ xi=[]; }
    xi=(xi||[]).filter(Boolean).slice(0,11);
    if(xi.length<11) return null;
    let sl={}; try{ sl=computeRenderSlots(t, xi)||{}; }catch(e){}
    const pl=xi.map(p=>({
      n:cmEsc(p.name,12), no:p.no||0, pos:p.pos||"MF",
      sl:(sl[p.id]&&SLOT_XY[sl[p.id]])?sl[p.id]:null,
      pref:(function(){ try{ const s=prefSlotOf(p); return SLOT_XY[s]?s:null; }catch(e){ return null; } })(),
      ovr:clamp(Math.round(p.ovr||60),40,99), by:p.by||2000,
      /* 📏 요청 — 오버롤은 프로필과 같은 자(90~200)로. 받는 쪽이 다시 계산할 수 없으니
         보내는 쪽에서 정확한 값을 실어 준다 (내부값 환산은 포지션 가중치가 빠져 어긋난다) */
      d:(function(){ try{ return dispOvr(p); }catch(e){ return 0; } })()
    }));
    let av=0; try{ av=teamOvr20(t)||0; }catch(e){}
    /* ⭐ 요청 — 「게시글에 나오는 선수 능력은 별개수로 표시하자」.
       팀 전력 별점은 선수 별점과 눈금이 다르다(teamStarVal). 그 눈금이 읽는 값을 함께 담는다. */
    let to=0; try{ to=teamOVR(t)||0; }catch(e){}
    let val=0; try{ val=Math.round((t.players||[]).reduce((s,p)=>s+(marketValue(p)||0),0)*10)/10; }catch(e){ val=0; }
    let rk=0; try{ const T=tableOf(t.div)||[]; rk=T.findIndex(x=>x.id===t.id)+1; }catch(e){ rk=0; }
    return {tn:cmEsc(t.name,16), sh:cmEsc(t.short,8),
      col:/^#[0-9a-fA-F]{3,8}$/.test(t.col||"")?t.col:"#2a6ee8",
      sn:G.season|0, dv:t.div|0, rk:rk|0, av:Math.round(av*10)/10, to:Math.round(to*10)/10, vl:val,
      /* ⚠ 제보 원문 — 「커뮤니티 오류 발견했어요. 제 글 보시면 4-2-1-3인데 4-3-1-2로
         표시되어 있네요」. 원인 — 여기만 t.tactic.formation(드롭다운에서 고른 키)을 그대로
         실었다. 감독이 선수를 끌어다 실제 배치를 바꾸면 전술창·라인업·PvP 는 전부
         formationLabel(실제 슬롯에서 센 이름)을 보여주는데 커뮤니티만 옛 키를 보여줬다.
         재현: 4-3-1-2 선택 후 드래그로 4-2-1-3 배치 → 전술창 "4-2-1-3" · 글 "4-3-1-2".
         ─ 화면과 같은 근거(formationLabel)를 쓴다. 실패하면 예전처럼 저장 키로 떨어진다. */
      tac:{formation:cmEsc((function(){ try{ return formationLabel(t, xi) || (t.tactic&&t.tactic.formation) || "4-3-3"; }
                                        catch(e){ return (t.tactic&&t.tactic.formation)||"4-3-3"; } })(), 8)}, pl};
  }catch(e){ return null; }
}
/* 스쿼드 카드 렌더 — 전술판 그림 + 요약 줄 + 선발 명단 */
function cmSquadHtml(sq, full){
  try{
    if(!sq || !Array.isArray(sq.pl) || !sq.pl.length) return "";
    const col=/^#[0-9a-fA-F]{3,8}$/.test(sq.col||"")?sq.col:"#2a6ee8";
    const pitch=pvpFormPitch({pl:sq.pl, tac:sq.tac||{}}, col, cmEsc(sq.sh,8)||"팀");
    /* ⭐ 팀 전력도 별로 — 예전 글(to 가 없는 글)은 예전처럼 숫자로 보여 준다 */
    const tstar=(sq.to>0)?`<span class="cmStarWrap">${(function(){ try{ const v=teamStarVal(sq.to);
      return renderStars(v, `팀 전력 ${sq.to} · ${v}★`); }catch(e){ return ""; } })()}</span>`:"";
    const head=`<div class="cmSqHead" style="border-left:4px solid ${col}">
      <b>${cmEsc(sq.tn,16)}</b>
      <span class="small" style="opacity:.75">${sq.sn?sq.sn+" 시즌 · ":""}${sq.dv?("K리그"+sq.dv):""}${sq.rk?(" "+sq.rk+"위"):""}</span>
      <span class="small" style="margin-left:auto;opacity:.85">${tstar?`팀 전력 ${tstar}`:`평균 <b style="color:var(--gold)">${(sq.av||0).toFixed(1)}</b>`}
      ${sq.vl?` · 스쿼드 가치 <b class="money">${(+sq.vl).toFixed(1)}억</b>`:""}</span></div>`;
    /* ⭐ ⚠ 요청 원문 — 「게시글에 나오는 선수 능력은 별개수로 표시하자」.
       숫자(72·75…)는 게임 안에서도 별로 보여 주는 값이다. 정확한 수치는 별에 마우스를 올리면 나온다. */
    const list=full ? `<table class="cmSqTbl"><tr><th>#</th><th>선수</th><th>자리</th><th>능력</th><th>나이</th></tr>
      ${sq.pl.map(q=>`<tr><td class="small" style="opacity:.6">${q.no||""}</td>
        <td><b>${cmEsc(q.n,12)}</b></td>
        <td class="small">${cmEsc(q.sl||q.pref||q.pos||"",4)}</td>
        <td class="cmStarTd">${(function(){ try{ return q.d>0 ? renderStars(ovrStarVal(q.ovr||0), `종합 ${q.d}`) : ovrStars(q.ovr||0); }catch(e){ return q.ovr||0; } })()}</td>
        <td class="small">${q.by?(sq.sn-q.by):""}</td></tr>`).join("")}</table>` : "";
    return `<div class="cmSq">${head}<div class="cmSqBody${full?"":" cmSqOne"}">${pitch}${list}</div></div>`;
  }catch(e){ return ""; }
}

/* ── 📜 경력 카드 — 감독 커리어를 통째로 담는다 ────────────────────────────
   ⚠ 요청 원문 — 「감독 경력의 대회성적도 게시글에 올릴 수 있게 하자. 그럼 자랑 제대로 할 수 있잖아」
   경력 화면(careerView)이 읽는 장부(G.mgrCv · G.trophies)를 그대로 요약해 싣는다.
   시즌 줄은 최근 12개, 트로피는 24개, 재임 구간은 8개까지 — 2KB 안쪽으로 유지한다. */
function cmCareerPack(){
  try{
    try{ cvSeed(); }catch(e){}
    const C=mgrCv(), t=userTeam();
    const rows=C.rows.slice().sort((a,b)=>b.s-a.s || (b.part?0:1)-(a.part?0:1));
    /* 지금 시즌은 아직 장부에 없다 — 살아 있는 순위표에서 한 줄 만들어 맨 위에 얹는다 */
    let live=null;
    if(t && !G.jobless){
      let pos=0, N=0;
      try{ const tb=tableOf(t.div); N=tb.length; pos=tb.findIndex(x=>x.id===t.id)+1; }catch(e){}
      live={s:G.season, tid:t.id, sh:t.short, div:t.div, pos, N, W:t.W|0, D:t.Dw|0, L:t.L|0,
        po:cvCompOf(G.season,"po"), eacl:cvCompOf(G.season,"eacl"), cwc:cvCompOf(G.season,"cwc"),
        note:"진행 중", now:1};
    }
    const all=(live?[live]:[]).concat(rows.filter(r=>!(live&&r.s===G.season&&r.tid===live.tid)));
    let W=0,D=0,L=0,GF=0,GA=0; const clubs=new Set(), ss=new Set();
    for(const r of all){
      if(r.seed||!r.tid){ if(r.s!=null) ss.add(r.s); continue; }
      W+=r.W|0; D+=r.D|0; L+=r.L|0; GF+=r.GF|0; GA+=r.GA|0; clubs.add(r.tid); ss.add(r.s);
    }
    for(const x of C.spells) clubs.add(x.tid);
    const troAll=(G.trophies||[]).slice().sort((a,b)=>b.s-a.s);
    /* ⚠ 진행 중인 시즌 한 줄은 「경력」이 아니다 — 마친 시즌도 트로피도 없으면 붙일 게 없다 */
    const doneN=all.filter(r=>!r.now).length;
    if(!doneN && !troAll.length) return null;
    const tro=troAll.slice(0,24).map(x=>({k:String(x.kind||"").slice(0,12),
      l:cmEsc(x.label,22), t:cmEsc(x.team,12), s:x.s|0}));
    const sp=C.spells.slice().reverse().slice(0,8).map(x=>({sh:cmEsc(x.sh,8), s0:x.s0|0,
      s1:x.done?(x.s1|0):0, W:x.W|0, D:x.D|0, L:x.L|0,
      how:x.done?String(x.how||"leave").replace(/[^a-z]/g,"").slice(0,8):"", n:x.seasons|0}));
    const rr=all.slice(0,12).map(r=>({s:r.s|0, sh:cmEsc(r.sh,8), dv:r.div|0, p:r.pos|0, N:r.N|0,
      W:r.W|0, D:r.D|0, L:r.L|0, po:cmEsc(r.po,6), ea:cmEsc(r.eacl,6), cw:cmEsc(r.cwc,6),
      nt:cmEsc(r.note,20), now:r.now?1:0, sd:r.seed?1:0}));
    /* 🏅 「위신」은 사는 집·부동산에서 오는 개인 자산 지표라 −1 같은 값이 나온다.
       자랑 카드에 어울리는 건 축구쪽 이력인 감독 평판(mgrRep, 5~90)이다. */
    let pr=0; try{ pr=mgrRep()|0; }catch(e){}
    let mo=0; try{ mo=motmMgrCount()|0; }catch(e){}
    return {mn:cmEsc((G.me&&G.me.name)||(function(){ try{ return pvpNick(); }catch(e){ return ""; } })()||"감독",10),
      pr, mo, sN:ss.size, cN:clubs.size, W, D, L, GF, GA, s:G.season|0, tro, sp, rows:rr};
  }catch(e){ return null; }
}
/* 트로피 한 칸의 색·아이콘 — 경력 화면과 같은 규칙 (빨강은 강등에만) */
function cmTroStyle(kind){
  const rk=TROPHY_RANK[kind]||0;
  const col = kind==="releg" ? "#f85149" : rk>=100 ? "var(--gold)" : rk>=60 ? "#58a6ff"
            : rk>=40 ? "#7ee2a8" : "var(--sub)";
  const ic  = rk>=100 ? "🏆" : rk>=60 ? "🥈" : rk>=40 ? "🎖️"
            : kind==="releg" ? "⬇️" : kind==="promo" ? "⬆️" : "🎫";
  return [ic, col, rk];
}
function cmCvWin(cv){ try{ return (cv.tro||[]).filter(x=>x.k==="champ").length; }catch(e){ return 0; } }
function cmCareerHtml(cv, full){
  try{
    if(!cv) return "";
    const N=(cv.W|0)+(cv.D|0)+(cv.L|0);
    const pct=N?Math.round(cv.W/N*100):0;
    const gd=(cv.GF|0)-(cv.GA|0);
    const win=cmCvWin(cv);
    const cell=(l,v,c)=>`<div class="cmCvCell"><span>${l}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
    const sum=`<div class="cmCvSum">
      ${cell("지휘 경기", N+"경기")}
      ${cell("전적", `${cv.W|0}승 ${cv.D|0}무 ${cv.L|0}패`)}
      ${cell("승률", pct+"%", pct>=50?"var(--green)":"var(--sub)")}
      ${cell("득실", `${cv.GF|0} : ${cv.GA|0} <span class="small">(${gd>=0?"+":""}${gd})</span>`)}
      ${cell("감독 평판", cv.pr?`${cv.pr}<span class="small" style="opacity:.45"> / 90</span>`:"-", "var(--gold)")}
      ${cell("리그 우승", win+"회", win?"var(--gold)":"var(--sub)")}
      ${cv.mo?cell("🎖️ 이달의 감독", cv.mo+"회","var(--gold)"):""}
    </div>`;
    const tro=(cv.tro||[]).length?`<div class="cmCvTro">
      ${(cv.tro||[]).map(x=>{ const [ic,col]=cmTroStyle(x.k);
        return `<span class="cmCvChip" style="border-color:${col};color:${col}">${ic} ${x.l||""}${x.t?`<span style="opacity:.55"> · ${x.t}</span>`:""}</span>`;
      }).join("")}</div>`:`<p class="small" style="opacity:.5;padding:0 13px 11px">아직 진열장이 비어 있습니다.</p>`;
    let body="";
    if(full){
      const rows=(cv.rows||[]).map(r=>{
        const comp=[r.po?`승강PO ${r.po}`:"", r.ea?`EACL ${r.ea}`:"", r.cw?`CWC ${r.cw}`:""].filter(Boolean).join(" · ");
        const pos=r.p?`${r.p}위${r.N?`<span class="small" style="opacity:.45"> / ${r.N}</span>`:""}`
                     :`<span class="small" style="opacity:.4">기록 없음</span>`;
        const pc = !r.p ? "var(--sub)" : r.p===1 ? "var(--gold)" : r.p<=3 ? "var(--green)"
                 : (r.N && r.p>r.N-2) ? "#f85149" : "var(--txt)";
        return `<tr${r.now?' style="background:rgba(227,179,65,.08)"':""}>
          <td class="small">${r.s}</td>
          <td><b>${r.sh||""}</b>${r.dv?`<span class="small" style="opacity:.45"> ${r.dv===1?"K1":"K2"}</span>`:""}</td>
          <td style="color:${pc};font-weight:700">${pos}</td>
          <td class="small">${(r.W|0)+(r.D|0)+(r.L|0)?`${r.W|0}-${r.D|0}-${r.L|0}`:"-"}</td>
          <td class="small" style="opacity:.85">${comp||"-"}</td>
          <td class="small" style="opacity:.7">${r.nt||""}</td></tr>`;
      }).join("");
      const spells=(cv.sp||[]).map(x=>{
        const [ic,nm,col]=cvHow(x.how||null);
        const yr = x.s1 ? (x.s0===x.s1?`${x.s0}`:`${x.s0}–${x.s1}`) : `${x.s0}–`;
        const n=(x.W|0)+(x.D|0)+(x.L|0);
        return `<div class="cmCvSp"><b>${x.sh||""}</b>
          <span class="small" style="opacity:.6">${yr}${x.n?` · ${x.n}시즌`:""}</span>
          ${n?`<span class="small">${x.W|0}승 ${x.D|0}무 ${x.L|0}패</span>`:""}
          <span class="small" style="margin-left:auto;color:${col}">${ic} ${nm}</span></div>`;
      }).join("");
      body=`${(cv.rows||[]).length?`<div class="cmCvSec"><h4>시즌별 성적 <span class="small">최근 ${(cv.rows||[]).length}시즌</span></h4>
        <div style="overflow-x:auto"><table class="cmCvTbl"><tr><th>시즌</th><th>구단</th><th>순위</th><th>전적</th><th>대회</th><th></th></tr>${rows}</table></div></div>`:""}
        ${spells?`<div class="cmCvSec"><h4>팀 경력</h4>${spells}</div>`:""}`;
    }
    return `<div class="cmCv">
      <div class="cmCvHead"><b>📜 ${cv.mn||"감독"}</b>
        <span class="small" style="opacity:.75">${cv.sN||0}시즌 · ${cv.cN||0}개 구단</span>
        ${win?`<span class="small" style="margin-left:auto;color:var(--gold)">🏆 리그 우승 ${win}회</span>`:""}</div>
      ${sum}${tro}${body}</div>`;
  }catch(e){ return ""; }
}

/* ── 📡 서버 ──────────────────────────────────────────────────────────── */
/* 🌐 ⚠ 요청 원문 — 「인터넷 미연결시에는 커뮤니티에 들어가면 어떻게 되지? 이거에 대한 로직도 있니?」
   ─ 예전에는 끊긴 것과 「보안 규칙에 board 갈래가 없는 것」을 구분하지 못해,
     비행기 모드에서도 「규칙을 확인해 주세요」라는 엉뚱한 안내가 나왔다.
     이제 못 읽으면 서버까지 닿는지 한 번 더 확인해서 이유(why)를 정확히 남긴다.
     끊긴 걸 이미 알고 있으면 아예 두드리지 않는다 — 9초씩 기다릴 이유가 없다. */
async function cmLoad(force){
  if(!cmOn()) return;
  if(CMB.busy) return;
  if(!force && CMB.rows && Date.now()-CMB.at<8000) return;
  CMB.busy=1; CMB.tried=Date.now();
  try{
    if(PVP_NET===null){ try{ await pvpNetCheck(true); }catch(e){} }
    if(PVP_NET===false){ CMB.ok=false; CMB.why="net"; return; }
    /* 🌐 요청 — 「글에서 바로 대전 신청 · 닉네임 옆 티어 배지」.
       게시판·접속 목록·티어 장부를 한 번에 받는다. 셋 다 이미 있는 갈래라 새 규칙이 필요 없다. */
    const [r, lv, tr]=await Promise.all([fbGetX("board/i"), fbGet("live"), fbGet("tier")]);
    try{ cmLiveApply(lv); }catch(e){}
    try{ cmTierApply(tr); }catch(e){}
    CMB.at=Date.now(); CMB.ok=!!r.ok;
    if(!r.ok){
      let net=true; try{ net=await pvpNetCheck(true); }catch(e){}
      CMB.why = net ? "rule" : "net";     // 서버까지는 닿는데 못 읽었다면 규칙 문제다
      return;
    }
    CMB.why="";
    const rows=[];
    const now=Date.now(), old=[];
    for(const k in (r.val||{})){
      const e=r.val[k]; if(!e || typeof e!=="object") continue;
      if(now-(+e.t||0)>CM_TTL){ old.push(k); continue; }
      rows.push({k, n:cmEsc(e.n,8)||"감독", id:String(e.id||""), ti:cmEsc(e.ti,40)||"(제목 없음)",
        tg:String(e.tg||"").replace(/[^a-z,]/g,"").slice(0,40), t:+e.t||0, ex:cmEsc(e.ex,110),
        sq:e.sq?1:0, im:e.im?1:0, sh:cmEsc(e.sh,8), col:/^#[0-9a-fA-F]{3,8}$/.test(e.col||"")?e.col:"",
        av:+e.av||0, to:+e.to||0, fm:cmEsc(e.fm,8), cv:e.cv?1:0, mn:cmEsc(e.mn,10), cs:Math.max(0,+e.cs||0), ct:Math.max(0,+e.ct||0),
        po:e.po?1:0, pn:Math.max(0,+e.pn||0), sn:Math.max(0,+e.sn||0), ss:Math.max(0,+e.ss||0),
        pk:e.pk?1:0, mt:e.mt?1:0,
        cn:Math.max(0,+e.cn||0), vn:Math.max(0,+e.vn||0), rn:Math.max(0,+e.rn||0)});
    }
    rows.sort((a,b)=>b.t-a.t);
    CMB.rows=rows.slice(0, CM_SHOW);
    /* 오래된 글은 접속한 사람이 조금씩 치운다 — 서버에 청소 담당이 없다 */
    try{ for(const k of old.slice(0,6)){ fbDel("board/i/"+k); fbDel("board/p/"+k); fbDel("board/c/"+k); fbDel("board/v/"+k); fbDel("board/r/"+k); fbDel("board/sr/"+k); fbDel("board/vt/"+k); } }catch(e){}
  } finally {
    CMB.busy=0;
    if(VIEW==="comm") show("comm");
  }
}
/* 🟢 지금 ⚔️ 메뉴에 있는 감독들 — 게시판에서도 접속 여부를 알아야 대전을 걸 수 있다 */
function cmLiveApply(tree){
  const m={}, now=Date.now();
  for(const id in (tree||{})){
    const e=tree[id]; if(!e || typeof e!=="object") continue;
    if(now-(+e.t||0)>PVP_LIVE_TTL) continue;
    m[id]={id, n:cmEsc(e.n,8), m:!!e.m, q:!!e.q, v:(e.ver|0)};
  }
  CMB.live=m;
}
/* 🏅 시즌 티어 장부 — 닉네임 열쇠로 찾는다 (게시판에는 닉네임이 실려 있다) */
function cmTierApply(tree){
  const m={}, sn=(function(){ try{ return pvpSeasonNum(); }catch(e){ return null; } })();
  for(const k in (tree||{})){
    const e=tree[k]; if(!e || typeof e!=="object") continue;
    if(sn!=null && (e.s|0)!==sn) continue;
    m[k]={lp:Math.max(0,+e.p||0), w:e.w|0, d:e.d|0, l:e.l|0, st:e.st|0};
  }
  CMB.tier=m;
}
function cmTierOfNick(n){
  try{ const k=pvpNickKeyOf(n); return (CMB.tier&&CMB.tier[k])||null; }catch(e){ return null; }
}
/* 닉네임 한 덩어리 — 티어 배지 · 접속 점 · 눌러서 프로필 */
function cmWhoHtml(n, id, me, noLink){
  const t=cmTierOfNick(n);
  const on=!!(CMB.live && id && CMB.live[id] && id!==cmMe());
  const badge=t ? `<span class="cmTierB">${(function(){ try{ return pvpTierLbl(pvpTierOf(t.lp), 11); }catch(e){ return ""; } })()}</span>` : "";
  const dot=on ? `<span class="cmOn" title="지금 온라인 대전 화면에 있습니다">●</span>` : "";
  const nm=`<b style="color:${me?"var(--gold)":"var(--acc2,#58a6ff)"}">${n}</b>`;
  return noLink ? `${nm}${badge}${dot}`
    : `<span class="cmWhoL" onclick="event.stopPropagation();cmProfile('${String(n).replace(/'/g,"")}')">${nm}</span>${badge}${dot}`;
}
/* ⚔️ 글에서 바로 대전 신청 — 이미 있는 1:1 초대 경로를 그대로 쓴다 (요청) */
function cmDuel(id, nick){
  try{
    if(!cmGate()) return;
    if(!id || id===cmMe()){ flash("내 글입니다.","warn"); return; }
    const L=(CMB.live||{})[id];
    if(!L){ gameAlert(`${cmEsc(nick,8)||"그"} 감독은 지금 접속해 있지 않습니다.\n\n⚔️ 온라인 대전 화면에 있는 감독에게만 신청할 수 있습니다.`); return; }
    if(L.m || L.q){ gameAlert(`${cmEsc(nick,8)||"그"} 감독은 지금 ${L.m?"경기 중":"상대를 찾는 중"}입니다.\n\n잠시 뒤에 다시 시도해 주세요.`); return; }
    if(L.v && L.v!==PVP_VER){ gameAlert(`🔢 게임 버전이 다릅니다.\n\n${cmEsc(nick,8)||"상대"} 감독: v${L.v}\n나: v${PVP_VER}`); return; }
    if(typeof PVP!=="undefined" && PVP){ flash("이미 매칭이 진행 중입니다 — 먼저 취소해 주세요.","warn"); return; }
    /* 신청을 보내면 대전 화면으로 옮겨 간다 — 수락 여부가 거기서 나온다 */
    try{ show("pvp"); }catch(e){}
    pvpChallenge(id, nick);
  }catch(e){}
}
/* 🔔 내 글에 달린 새 댓글 — 좌측 메뉴 빨간 점 (요청) */
function cmSeenMap(){
  let o={}; try{ o=JSON.parse(localStorage.getItem("klm2026_cmSeen")||"{}")||{}; }catch(e){ o={}; }
  return o;
}
function cmSeenPut(o){
  try{ const ks=Object.keys(o); if(ks.length>300) for(const k of ks.slice(0, ks.length-300)) delete o[k];
       localStorage.setItem("klm2026_cmSeen", JSON.stringify(o)); }catch(e){}
}
function cmNewCmt(){
  try{
    if(!CMB.rows) return 0;
    const me=cmMe(), seen=cmSeenMap();
    let n=0;
    for(const r of CMB.rows) if(r.id===me) n+=Math.max(0, (r.cn|0)-(seen[r.k]|0));
    return n;
  }catch(e){ return 0; }
}
function cmSeenMark(id){
  try{
    const r=(CMB.rows||[]).find(x=>x.k===id); if(!r) return;
    const o=cmSeenMap(); o[id]=r.cn|0; cmSeenPut(o);
  }catch(e){}
}
/* 내 글이 하나라도 있으면 뒤에서 천천히 새로고침한다 — 댓글 알림이 세션 내내 살아 있게 */
function cmBgTick(){
  try{
    if(!cmOn() || PVP_NET===false) return;
    if(VIEW==="comm") return;                       // 그 화면에는 자기 타이머가 있다
    if(!CMB.rows) return;
    if(!CMB.rows.some(r=>r.id===cmMe())) return;    // 내 글이 없으면 알릴 것도 없다
    cmLoad(true);
  }catch(e){}
}
/* 🔄 끊겼을 때의 「다시 연결해 보기」 — 연결이 돌아오면 그대로 목록까지 받아 온다 */
async function cmRetry(){
  try{ flash("🌐 연결을 확인하는 중…","info"); if(VIEW==="comm") show("comm"); }catch(e){}
  let ok=false; try{ ok=await pvpNetCheck(true); }catch(e){ ok=false; }
  if(ok){ CMB.why=""; await cmLoad(true); try{ flash("🌐 연결됐습니다.","good"); }catch(e){} }
  else { CMB.ok=false; CMB.why="net";
    try{ flash("아직 연결되지 않았습니다.","warn"); }catch(e){}
    if(VIEW==="comm") show("comm"); }
}
async function cmOpenPost(id){
  CMB.mode="read"; CMB.id=id; CMB.post=null; CMB.cmts=null;
  show("comm");
  /* 🌐 끊겨 있으면 두드리지 않는다 — 예전엔 「불러오는 중…」이 영영 남았다 (요청) */
  CMB.sr=0; CMB.vt=null;
  if(PVP_NET===false){ CMB.post={_off:1}; CMB.cmts=[]; if(VIEW==="comm") show("comm"); return; }
  const [p, c, sr, vt]=await Promise.all([fbGet("board/p/"+id), fbGet("board/c/"+id),
                                          fbGet("board/sr/"+id), fbGet("board/vt/"+id)]);
  if(CMB.id!==id) return;
  /* ⭐ 내가 준 별 · 🗳️ 내가 던진 표 */
  try{ CMB.sr=clamp(Math.round(+((sr||{})[cmMe()])||0),0,5); }catch(e){ CMB.sr=0; }
  try{
    const P0=(p&&p.pl)||null;
    if(P0 && Array.isArray(P0.o)){
      const cnt=P0.o.map(()=>0); let tot=0, my=-1;
      for(const k in (vt||{})){ const v=Math.round(+vt[k]); if(v>=0 && v<cnt.length){ cnt[v]++; tot++; if(k===cmMe()) my=v; } }
      CMB.vt={my, cnt, tot};
    }
  }catch(e){}
  if(!p && !c){ try{ pvpNetCheck(true); }catch(e){}
    CMB.post={_off:1}; CMB.cmts=[]; if(VIEW==="comm") show("comm"); return; }
  CMB.post = p && typeof p==="object" ? p : {m:"", sq:null, im:""};
  const cm=[];
  for(const k in (c||{})){ const e=c[k]; if(!e||typeof e!=="object") continue;
    cm.push({k, n:cmEsc(e.n,8)||"감독", id:String(e.id||""), m:cmEsc(e.m,200), t:+e.t||0}); }
  cm.sort((a,b)=>a.t-b.t);
  CMB.cmts=cm;
  try{ cmSeenMark(id); }catch(e){}   // 🔔 여기까지 읽었으면 빨간 점을 끈다
  if(VIEW==="comm") show("comm");
}

/* ── ✍️ 글쓰기 ────────────────────────────────────────────────────────── */
function cmDraft(){ if(!CMB.draft) CMB.draft={ti:"", m:"", tg:["chat"], sq:0, cv:0, im:""};
  if(CMB.draft.cv===undefined) CMB.draft.cv=0; return CMB.draft; }
function cmGrab(){
  const D=cmDraft();
  try{ const a=document.getElementById("cmTi"); if(a) D.ti=a.value; }catch(e){}
  try{ const a=document.getElementById("cmBody"); if(a) D.m=a.value; }catch(e){}
  try{ const a=document.getElementById("cmImg"); if(a) D.im=a.value; }catch(e){}
  return D;
}
function cmTagPick(k){
  const D=cmGrab(); const i=D.tg.indexOf(k);
  if(i>=0) D.tg.splice(i,1); else { if(D.tg.length>=2) D.tg.shift(); D.tg.push(k); }
  show("comm");
}
function cmSqToggle(){ const D=cmGrab(); D.sq=D.sq?0:1; show("comm"); }
/* 📜 경력 첨부 토글 (요청 — 대회 성적으로 제대로 자랑하기) */
function cmCvToggle(){ const D=cmGrab(); D.cv=D.cv?0:1; show("comm"); }
function cmGo(mode){
  if(mode==="write"){
    if(!cmGate()) return;
    CMB.mode="write"; cmDraft();
  } else { CMB.mode="list"; CMB.id=null; CMB.post=null; CMB.cmts=null; }
  show("comm");
}
function cmGate(){
  try{ if(!pvpNetGate()) return false; }catch(e){}
  if(!pvpNickClaimed()){
    gameAlert("🗣️ 글을 쓰려면 먼저 <b>닉네임</b>을 정해야 합니다.\n\n⚔️ 온라인 대전 메뉴의 「내 닉네임」 칸에서 이름을 저장해 주세요.\n\n<span class=\"small\">닉네임 장부가 이름 도용을 막아 줍니다.</span>");
    return false;
  }
  return true;
}
async function cmSubmit(){
  if(!cmGate()) return;
  const D=cmGrab();
  const ti=cmEsc(D.ti,40).trim();
  const m=String(D.m||"").replace(/[<>&"'`]/g,"").replace(/\r/g,"").slice(0,600).trim();
  if(!ti){ flash("제목을 적어 주세요.","warn"); return; }
  if(!m && !D.sq && !D.cv && !D.po && !D.mt && !D.pk){ flash("내용을 적거나 무엇이든 첨부해 주세요.","warn"); return; }
  const now=Date.now();
  if(now-(CMB.pAt||0)<CM_POST_GAP){
    flash(`잠깐만요 — ${Math.ceil((CM_POST_GAP-(now-CMB.pAt))/1000)}초 뒤에 올릴 수 있습니다.`,"warn"); return; }
  let im=String(D.im||"").trim().slice(0,200);
  if(im && !/^https:\/\/[\w.\-]+\/[\w.\-\/%?=&:+~#]*$/i.test(im)){ flash("이미지 주소는 https:// 로 시작하는 주소만 붙일 수 있습니다.","warn"); return; }
  const sq = D.sq ? cmSquadPack() : null;
  if(D.sq && !sq){ flash("스쿼드를 담지 못했습니다 — 선발 열한 명을 먼저 채워 주세요.","warn"); return; }
  const cv = D.cv ? cmCareerPack() : null;
  if(D.cv && !cv){ flash("경력을 담지 못했습니다 — 아직 남은 기록이 없습니다.","warn"); return; }
  const pl = D.po ? cmPollPack() : null;
  if(D.po && !pl){ flash("투표 선택지를 두 개 이상 적어 주세요.","warn"); return; }
  const mt = D.mt ? cmMatchPack() : null;
  if(D.mt && !mt){ flash("붙일 경기 결과가 없습니다 — 경기를 한 판 치른 뒤에 가능합니다.","warn"); return; }
  const pk = D.pk ? cmPlayerPack(D.pid) : null;
  if(D.pk && !pk){ flash("선수를 담지 못했습니다 — 선수를 다시 골라 주세요.","warn"); return; }
  CMB.pAt=now;
  const tg=(D.tg||[]).filter(k=>cmTag(k)).slice(0,2).join(",")||"chat";
  const id=await fbPush("board/p", {m, sq, cv, pl, mt, pk, im:im||null, t:now, id:cmMe()});
  if(!id){ CMB.pAt=0; flash("글을 올리지 못했습니다 — 연결을 확인해 주세요.","warn"); return; }
  const meta={n:String(pvpNick()).slice(0,8), id:cmMe(), ti, tg, t:now,
    ex:m.replace(/\n+/g," ").slice(0,110), sq:sq?1:0, cv:cv?1:0, im:im?1:0,
    sh:sq?sq.sh:"", col:sq?sq.col:"", av:sq?sq.av:0, to:sq?(sq.to||0):0, fm:sq?((sq.tac&&sq.tac.formation)||""):"",
    mn:cv?cv.mn:"", cs:cv?(cv.sN|0):0, ct:cv?cmCvWin(cv):0,
    po:pl?1:0, pn:0, sn:0, ss:0, mt:mt?1:0, pk:pk?1:0,
    cn:0, vn:0, rn:0};
  const ok=await fbSet("board/i/"+id, meta);
  if(!ok){ try{ fbDel("board/p/"+id); }catch(e){} CMB.pAt=0;
    flash("글 목록에 올리지 못했습니다 — 보안 규칙을 확인해 주세요.","warn"); return; }
  CMB.draft=null;
  flash("🗣️ 글을 올렸습니다.","good");
  await cmLoad(true);
  cmOpenPost(id);
}
async function cmDel(id){
  try{ if(!pvpNetGate()) return; }catch(e){}   // 🌐 끊긴 채로 지우면 화면만 지워지고 서버엔 남는다
  const row=(CMB.rows||[]).find(r=>r.k===id);
  if(!row) return;
  if(row.id!==cmMe() && !cmAdmin()){ flash("내가 쓴 글만 지울 수 있습니다.","warn"); return; }
  showConfirm("🗑️ <b>이 글을 지울까요?</b>\n\n댓글도 함께 사라집니다. 되돌릴 수 없습니다.", async()=>{
    await fbDel("board/i/"+id); await fbDel("board/p/"+id);
    await fbDel("board/c/"+id); await fbDel("board/v/"+id); await fbDel("board/r/"+id);
    await fbDel("board/sr/"+id); await fbDel("board/vt/"+id);
    CMB.mode="list"; CMB.id=null; CMB.post=null; CMB.cmts=null;
    flash("글을 지웠습니다.","info");
    cmLoad(true);
  }, {okLabel:"지웁니다", cancelLabel:"그만"});
}
async function cmVote(id){
  if(!cmGate()) return;
  const row=(CMB.rows||[]).find(r=>r.k===id); if(!row) return;
  if(row.id===cmMe()){ flash("내 글에는 추천할 수 없습니다.","warn"); return; }
  if(cmMark("Vote", id)){ flash("이미 추천한 글입니다.","warn"); return; }
  cmMark("Vote", id, 1);
  row.vn=(row.vn||0)+1;
  show("comm");
  await fbSet("board/v/"+id+"/"+cmMe(), 1);
  const c=await fbGet("board/v/"+id);
  await fbPatch("board/i/"+id, {vn:Math.max(1, Object.keys(c||{}).length)});
  cmLoad(true);
}
async function cmReport(id){
  if(!cmGate()) return;
  if(cmMark("Rep", id)){ flash("이미 신고한 글입니다.","warn"); return; }
  showConfirm("🚨 <b>이 글을 신고할까요?</b>\n\n신고가 "+CM_HIDE_RP+"건 쌓이면 목록에서 가려집니다.\n장난 신고는 자제해 주세요.", async()=>{
    cmMark("Rep", id, 1);
    await fbSet("board/r/"+id+"/"+cmMe(), 1);
    const c=await fbGet("board/r/"+id);
    await fbPatch("board/i/"+id, {rn:Math.max(1, Object.keys(c||{}).length)});
    flash("신고했습니다.","info");
    cmLoad(true);
  }, {okLabel:"신고합니다", cancelLabel:"그만"});
}
async function cmCmtSend(){
  if(!cmGate()) return;
  const id=CMB.id; if(!id) return;
  const inp=document.getElementById("cmCmtIn"); if(!inp) return;
  const m=String(inp.value||"").replace(/[<>&"'`]/g,"").replace(/\s+/g," ").trim().slice(0,200);
  if(!m) return;
  const now=Date.now();
  if(now-(CMB.cAt||0)<CM_CMT_GAP){ flash("잠깐만요 — 조금 뒤에 다시 보내 주세요.","warn"); return; }
  CMB.cAt=now; inp.value="";
  const cid=await fbPush("board/c/"+id, {n:String(pvpNick()).slice(0,8), id:cmMe(), m, t:now});
  if(!cid){ CMB.cAt=0; flash("댓글을 올리지 못했습니다.","warn"); return; }
  (CMB.cmts=CMB.cmts||[]).push({k:cid, n:String(pvpNick()).slice(0,8), id:cmMe(), m, t:now});
  const row=(CMB.rows||[]).find(r=>r.k===id); if(row) row.cn=(row.cn||0)+1;
  show("comm");
  const c=await fbGet("board/c/"+id);
  await fbPatch("board/i/"+id, {cn:Math.max(1, Object.keys(c||{}).length)});
}
async function cmCmtDel(cid){
  const id=CMB.id; if(!id) return;
  const c=(CMB.cmts||[]).find(x=>x.k===cid); if(!c) return;
  if(c.id!==cmMe() && !cmAdmin()){ flash("내가 쓴 댓글만 지울 수 있습니다.","warn"); return; }
  await fbDel("board/c/"+id+"/"+cid);
  CMB.cmts=(CMB.cmts||[]).filter(x=>x.k!==cid);
  const row=(CMB.rows||[]).find(r=>r.k===id); if(row) row.cn=Math.max(0,(row.cn||0)-1);
  show("comm");
  await fbPatch("board/i/"+id, {cn:(CMB.cmts||[]).length});
}
function cmSetTag(k){ CMB.tag=k; show("comm"); }
function cmSetSort(k){ CMB.sort=k; show("comm"); }
function cmRefresh(){ cmLoad(true); flash("🔄 새로고침","info"); }
/* 커뮤니티 화면에 있는 동안만 자동으로 다시 받아 온다 */
function cmTick(v){
  if(v==="comm"){
    if(!CM_TIMER) CM_TIMER=setInterval(()=>{ try{
      if(VIEW!=="comm" || CMB.mode!=="list") return;
      /* 🌐 끊겨 있는 동안엔 게시판을 두드려 봐야 소용없다 — 연결이 돌아왔는지만 본다.
         돌아오면 pvpNetCheck 가 화면을 다시 그리고 목록까지 받아 온다 (요청) */
      if(PVP_NET===false){ pvpNetCheck(); return; }
      cmLoad(true);
    }catch(e){} }, CM_REFRESH);
    /* ⚠ cmLoad 는 끝나면서 화면을 다시 그리고, 그 렌더가 여기를 다시 부른다.
       방금 시도했으면 넘어간다 — 안 그러면 실패했을 때 둘이 서로를 끝없이 부른다. */
    if(!CMB.rows && Date.now()-(CMB.tried||0)>5000) cmLoad(true);
  } else if(CM_TIMER){ clearInterval(CM_TIMER); CM_TIMER=null; }
}

/* ── ⭐ 스쿼드 별점 평가 (요청) ────────────────────────────────────────────
   🔥 추천이 「글이 좋다」라면, 이건 「스쿼드가 세다」다. 자랑 게시판에는 이쪽이 맞다.
   감독 한 명이 한 표씩(board/sr/<글>/<감독>=1~5), 합계·표수는 목록 칸에 얹는다. */
function cmSrAvg(r){ return (r && r.sn>0) ? Math.round((r.ss/r.sn)*10)/10 : 0; }
function cmSrStars(r){
  const v=cmSrAvg(r); if(!v) return "";
  try{ return renderStars(Math.round(v*2)/2, `스쿼드 평가 ${v.toFixed(1)}★ · ${r.sn}명`); }catch(e){ return ""; }
}
async function cmRate(id, v){
  if(!cmGate()) return;
  const row=(CMB.rows||[]).find(x=>x.k===id); if(!row) return;
  if(!row.sq){ flash("스쿼드가 붙어 있지 않은 글입니다.","warn"); return; }
  if(row.id===cmMe()){ flash("내 스쿼드에는 별을 줄 수 없습니다.","warn"); return; }
  v=clamp(Math.round(+v||0),1,5);
  const had=CMB.sr;                                   // 이미 준 별 (이 글 기준)
  await fbSet("board/sr/"+id+"/"+cmMe(), v);
  const all=await fbGet("board/sr/"+id);
  let n=0, sum=0;
  for(const k in (all||{})){ const x=clamp(Math.round(+all[k]||0),1,5); if(x){ n++; sum+=x; } }
  await fbPatch("board/i/"+id, {sn:n, ss:sum});
  row.sn=n; row.ss=sum; CMB.sr=v;
  flash(had ? `⭐ 평가를 ${v}★로 바꿨습니다.` : `⭐ ${v}★를 줬습니다.`, "good");
  if(VIEW==="comm") show("comm");
}
function cmRateBar(id, r){
  if(!r || !r.sq) return "";
  const mine=(r.id===cmMe());
  const my=CMB.sr|0;
  const btns=[1,2,3,4,5].map(v=>`<button class="cmStarBtn${my>=v?" on":""}" title="${v}★"
    ${mine?'disabled':`onclick="cmRate('${id}',${v})"`}>★</button>`).join("");
  return `<div class="cmRate">
    <span class="small" style="opacity:.75">이 스쿼드 어때요?</span>
    <span class="cmStarSet">${btns}</span>
    ${my?`<span class="small" style="color:var(--gold)">내 평가 ${my}★</span>`:""}
    <span class="small" style="margin-left:auto">${r.sn?`평균 <b style="color:var(--gold)">${cmSrAvg(r).toFixed(1)}★</b> <span style="opacity:.55">· ${r.sn}명</span>`:`<span style="opacity:.5">${mine?"아직 평가가 없습니다":"첫 평가를 남겨 보세요"}</span>`}</span>
  </div>`;
}

/* ── 🗳️ 투표 첨부 (요청) ──────────────────────────────────────────────────
   선택지 2~4개. 표는 board/vt/<글>/<감독> = 선택지 번호. 감독 한 명이 한 표,
   바꿀 수는 있다. 집계는 글을 열 때 그 갈래를 통째로 받아 센다(작다). */
const CM_POLL_MAX=4;
function cmPollDraft(){ const D=cmDraft(); if(!Array.isArray(D.pq)) D.pq=["",""]; return D; }
function cmPollGrab(){
  const D=cmPollDraft();
  try{ const q=document.getElementById("cmPollQ"); if(q) D.pt=q.value; }catch(e){}
  for(let i=0;i<CM_POLL_MAX;i++){
    try{ const el=document.getElementById("cmPollO"+i); if(el) D.pq[i]=el.value; }catch(e){}
  }
  return D;
}
function cmPollToggle(){ const D=cmGrab(); cmPollGrab(); D.po=D.po?0:1; show("comm"); }
function cmPollAdd(){ const D=cmPollGrab(); if(D.pq.length<CM_POLL_MAX) D.pq.push(""); show("comm"); }
function cmPollDel(i){ const D=cmPollGrab(); if(D.pq.length>2) D.pq.splice(i,1); show("comm"); }
function cmPollPack(){
  try{
    const D=cmPollGrab(); if(!D.po) return null;
    const t=cmEsc(D.pt,60).trim();
    const o=(D.pq||[]).map(x=>cmEsc(x,24).trim()).filter(Boolean).slice(0,CM_POLL_MAX);
    if(o.length<2) return null;
    return {t:t||"어느 쪽인가요?", o};
  }catch(e){ return null; }
}
async function cmVoteP(id, i){
  if(!cmGate()) return;
  const P=CMB.post; if(!P || !P.pl) return;
  i=Math.round(+i||0);
  if(i<0 || i>=(P.pl.o||[]).length) return;
  await fbSet("board/vt/"+id+"/"+cmMe(), i);
  const all=await fbGet("board/vt/"+id);
  const cnt=(P.pl.o||[]).map(()=>0); let tot=0;
  for(const k in (all||{})){ const v=Math.round(+all[k]); if(v>=0 && v<cnt.length){ cnt[v]++; tot++; } }
  CMB.vt={my:i, cnt, tot};
  const row=(CMB.rows||[]).find(x=>x.k===id); if(row) row.pn=tot;
  await fbPatch("board/i/"+id, {pn:tot});
  flash("🗳️ 투표했습니다.","good");
  if(VIEW==="comm") show("comm");
}
function cmPollHtml(id, P){
  try{
    const Q=P&&P.pl; if(!Q || !Array.isArray(Q.o) || Q.o.length<2) return "";
    const V=CMB.vt||{my:-1, cnt:Q.o.map(()=>0), tot:0};
    const done=V.my>=0;
    const rows=Q.o.map((o,i)=>{
      const n=(V.cnt&&V.cnt[i])|0;
      const pct=V.tot?Math.round(n/V.tot*100):0;
      return `<button class="cmPollOpt${V.my===i?" on":""}" onclick="cmVoteP('${id}',${i})">
        <span class="cmPollFill" style="width:${done?pct:0}%"></span>
        <span class="cmPollTx">${V.my===i?"✓ ":""}${o}</span>
        ${done?`<span class="cmPollN">${pct}% <span style="opacity:.55">${n}표</span></span>`:""}
      </button>`;
    }).join("");
    return `<div class="cmPoll">
      <div class="cmPollQ">🗳️ ${cmEsc(Q.t,60)}</div>
      ${rows}
      <div class="small" style="opacity:.55;margin-top:7px">${V.tot?`${V.tot}명 참여`:"아직 아무도 투표하지 않았습니다"}${done?" · 눌러서 바꿀 수 있습니다":""}</div>
    </div>`;
  }catch(e){ return ""; }
}

/* ── ⚽ 경기 결과 카드 · 🌱 선수 카드 (요청: 첨부 추가) ─────────────────────
   방금 치른 경기 한 판, 또는 내 선수 한 명을 글에 붙인다.
   둘 다 데이터라 가볍고, 능력은 게임과 같은 눈금(ovrStars)으로 그린다. */
function cmMatchPack(){
  try{
    const L=(typeof lastMatch!=="undefined") ? lastMatch : null;
    if(!L || !L.h || !L.a || !L.res) return null;
    const col=(t)=>/^#[0-9a-fA-F]{3,8}$/.test((t&&t.col)||"")?t.col:"#2a6ee8";
    const sc=(L.res.sc||[]).slice(0,14).map(x=>({n:cmEsc(x.n,12), s:(x.side==="h")?"h":"a",
      m:cmEsc(x.min,7), og:x.og?1:0, pn:x.pen?1:0}));
    const mm=L.mom ? {n:cmEsc(L.mom.name,12), t:cmEsc(L.mom.team,8),
      r:Math.round((L.mom.rating||0)*100)/100, g:L.mom.goals|0, a:L.mom.assists|0} : null;
    return {hn:cmEsc(L.h.short||L.h.name,8), an:cmEsc(L.a.short||L.a.name,8),
      hc:col(L.h), ac:col(L.a), hg:clamp(L.res.hg|0,0,99), ag:clamp(L.res.ag|0,0,99),
      tag:cmEsc(L.tag|| (L.friendly?"연습경기":""), 14), att:Math.max(0,L.att|0),
      s:G.season|0, sc, mm};
  }catch(e){ return null; }
}
function cmMatchHtml(m){
  try{
    if(!m) return "";
    const winH=m.hg>m.ag, winA=m.ag>m.hg;
    const side=(k,n,c,g,win)=>`<div class="cmMtSide">
      <span class="cmMtDot" style="background:${c}"></span>
      <b style="${win?"":"opacity:.72"}">${n}</b></div>`;
    /* 홈은 왼쪽 줄, 원정은 오른쪽 줄 — 한 덩어리로 흘리면 순서가 섞여 보인다 */
    const one=(x)=>`<div class="cmMtSc"><b>${x.n}</b>${x.og?' <span class="small" style="color:#f85149">자책</span>':""}${x.pn?' <span class="small" style="opacity:.6">P</span>':""} <span class="small" style="opacity:.5">${x.m}'</span></div>`;
    const hS=(m.sc||[]).filter(x=>x.s==="h").map(one).join("");
    const aS=(m.sc||[]).filter(x=>x.s!=="h").map(one).join("");
    const rows=(hS||aS)?`<div class="cmMtCol">${hS}</div><div class="cmMtCol a">${aS}</div>`:"";
    return `<div class="cmMt">
      <div class="cmMtHead">⚽ 경기 결과${m.tag?` <span class="small" style="opacity:.7">· ${m.tag}</span>`:""}${m.att?`<span class="small" style="margin-left:auto;opacity:.6">관중 ${m.att.toLocaleString()}명</span>`:""}</div>
      <div class="cmMtBody">
        ${side("h", m.hn, m.hc, m.hg, winH)}
        <div class="cmMtScore"><b style="${winH?"color:var(--gold)":""}">${m.hg}</b>
          <span>:</span><b style="${winA?"color:var(--gold)":""}">${m.ag}</b></div>
        ${side("a", m.an, m.ac, m.ag, winA)}
      </div>
      ${rows?`<div class="cmMtScs">${rows}</div>`:""}
      ${m.mm?`<div class="cmMtMom">🎖️ <b>${m.mm.n}</b> <span class="small" style="opacity:.7">${m.mm.t} · 평점 <b style="color:var(--gold)">${m.mm.r.toFixed(2)}</b>${m.mm.g?` · ${m.mm.g}골`:""}${m.mm.a?` · ${m.mm.a}도움`:""}</span></div>`:""}
    </div>`;
  }catch(e){ return ""; }
}
/* 🌱 선수 카드 — 유망주 자랑용. 내 선수 중 한 명을 골라 붙인다. */
function cmPlayerPack(pid){
  try{
    if(G.jobless) return null;
    const t=userTeam(); if(!t) return null;
    const p=(t.players||[]).find(x=>x && String(x.id)===String(pid)) || null;
    if(!p) return null;
    let slot=""; try{ slot=prefSlotOf(p)||p.pos||""; }catch(e){ slot=p.pos||""; }
    return {n:cmEsc(p.name,12), no:p.no|0, pos:cmEsc(p.pos,4), sl:cmEsc(slot,4),
      ovr:clamp(Math.round(p.ovr||60),40,99), pot:clamp(Math.round(p.pot||p.ovr||60),40,99),
      d:(function(){ try{ return dispOvr(p); }catch(e){ return 0; } })(),
      dp:(function(){ try{ return dispPot(p); }catch(e){ return 0; } })(),
      age:Math.max(15,(G.season|0)-(p.by||2000)),
      h:p.h|0, w:p.w|0, frn:p.frn?1:0, hg:p.hg?1:0,
      /* ⚠ p.traits 는 열쇠(gkCommands…)라 그대로 실으면 영문이 보인다 — 이름표로 바꿔 담는다 */
      tr:(p.traits||[]).slice(0,4).map(x=>{ const T=TRAIT_BY_KEY[x]; return cmEsc((T&&T.n)||x, 22); }).filter(Boolean),
      g:p.goals|0, a:p.assists|0, mn:p.mn|0, rt:Math.round((p.rateS||p.rating||0)*100)/100,
      tn:cmEsc(t.short,8), col:/^#[0-9a-fA-F]{3,8}$/.test(t.col||"")?t.col:"#2a6ee8", s:G.season|0};
  }catch(e){ return null; }
}
function cmPlayerHtml(q){
  try{
    if(!q) return "";
    const st=(o,d)=>{ try{ return (d>0?renderStars(ovrStarVal(o), `${d}`):ovrStars(o))
      + (d>0?` <b style="color:var(--gold);font-size:13px;margin-left:5px">${d}</b>`:""); }catch(e){ return o; } };
    return `<div class="cmPc" style="--c:${q.col}">
      <div class="cmPcHead">
        <span class="cmPcNo">${q.no||"-"}</span>
        <div class="cmPcName"><b>${q.n}</b>
          <span class="small" style="opacity:.7">${q.tn} · ${q.sl||q.pos} · 만 ${q.age}세</span></div>
        <div class="cmPcTags">${q.frn?'<span class="tag frn">외국인</span>':""}${q.hg?'<span class="hgN small">홈그로운</span>':""}</div>
      </div>
      <div class="cmPcRow"><span>현재 능력</span><span>${st(q.ovr, q.d)}</span></div>
      <div class="cmPcRow"><span>잠재력</span><span>${st(q.pot, q.dp)}${q.pot>q.ovr?`<span class="small" style="color:var(--green);margin-left:6px">▲ 성장 여지</span>`:""}</span></div>
      ${(q.mn||q.g||q.a)?`<div class="cmPcRow"><span>${q.s} 시즌</span><span class="small">${q.mn||0}분 · ${q.g||0}골 ${q.a||0}도움${q.rt?` · 평점 <b style="color:var(--gold)">${q.rt.toFixed(2)}</b>`:""}</span></div>`:""}
      ${(q.tr||[]).length?`<div class="cmPcTr">${q.tr.map(x=>`<span class="cmTag" style="border-color:#8b949e55;color:#c9d1d9">${x}</span>`).join("")}</div>`:""}
    </div>`;
  }catch(e){ return ""; }
}
/* 선수 고르기 — 글쓰기 화면의 드롭다운 */
function cmPickList(){
  try{
    if(G.jobless) return [];
    const t=userTeam(); if(!t) return [];
    return (t.players||[]).slice().sort((a,b)=>{
      let x=0,y=0; try{ x=posSortIdx(a); y=posSortIdx(b); }catch(e){}
      return x-y || (b.ovr||0)-(a.ovr||0);
    });
  }catch(e){ return []; }
}
function cmPickSet(v){ const D=cmGrab(); D.pid=String(v||""); D.pk=D.pid?1:0; show("comm"); }
function cmPkToggle(){
  const D=cmGrab();
  if(D.pk){ D.pk=0; }
  else { D.pk=1; if(!D.pid){ const L=cmPickList(); if(L.length) D.pid=String(L[0].id); } }
  show("comm");
}
function cmMtToggle(){ const D=cmGrab(); D.mt=D.mt?0:1; show("comm"); }

/* ── 👤 감독 프로필 — 닉네임을 누르면 열린다 (요청) ────────────────────────
   그 감독의 글·티어·전적·접속 상태를 한 자리에 모은다. 게시판·랭킹·대전이 한 사람으로 묶인다. */
function cmProfile(n){
  CMB.prof=String(n||"").slice(0,8);
  CMB.mode="prof";
  show("comm");
}
function cmProfView(){
  const n=CMB.prof||"";
  const me=cmMe();
  const rows=(CMB.rows||[]).filter(r=>r.n===n).sort((a,b)=>b.t-a.t);
  const id=(rows.find(r=>r.id)||{}).id||"";
  const T=cmTierOfNick(n);
  const L=(CMB.live||{})[id]||null;
  const isMe=(id && id===me);
  const gN=rows.reduce((s,r)=>s+(r.vn|0),0);
  const cN=rows.reduce((s,r)=>s+(r.cn|0),0);
  const sqRows=rows.filter(r=>r.sq && r.sn>0);
  const sqAvg=sqRows.length ? Math.round(sqRows.reduce((s,r)=>s+cmSrAvg(r),0)/sqRows.length*10)/10 : 0;
  const tierLine = T
    ? `${(function(){ try{ return pvpTierLbl(pvpTierOf(T.lp), 15); }catch(e){ return ""; } })()}
       <span class="small" style="opacity:.75">· ${T.lp} LP · ${T.w}승 ${T.d}무 ${T.l}패</span>`
    : `<span class="small" style="opacity:.55">이번 시즌 대전 기록이 없습니다</span>`;
  const cell=(l,v,c)=>`<div class="cmCvCell"><span>${l}</span><b${c?` style="color:${c}"`:""}>${v}</b></div>`;
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button class="mini" onclick="cmGo('list')">← 목록</button>
      ${(!isMe && id)?`<button class="mini" style="margin-left:auto;${L&&!L.m&&!L.q?"border-color:var(--acc);color:var(--acc)":"opacity:.5"}"
        onclick="cmDuel('${id}','${n}')">⚔️ 대전 신청</button>`:""}
    </div>
    <div class="cmPfHead">
      <div class="cmPfAv">${(n||"?").slice(0,2)}</div>
      <div>
        <div style="font-size:19px;font-weight:800">${n||"감독"}
          ${L?`<span class="cmOn" title="지금 온라인 대전 화면에 있습니다">●</span>`:""}</div>
        <div style="margin-top:3px">${tierLine}</div>
      </div>
    </div>
    <div class="cmCvSum" style="margin-top:12px;border-top:1px solid var(--line)">
      ${cell("올린 글", rows.length+"개")}
      ${cell("받은 추천", gN+"개", gN?"var(--gold)":"")}
      ${cell("달린 댓글", cN+"개")}
      ${cell("스쿼드 평가", sqAvg?`${sqAvg.toFixed(1)}★`:"-", sqAvg?"var(--gold)":"")}
      ${L?cell("지금", L.m?"경기 중":L.q?"상대 찾는 중":"접속 중","#3fb950"):cell("지금","오프라인")}
    </div>
    <h3 style="margin:18px 0 0">📄 ${n} 감독의 글</h3>
    ${rows.length?`<div class="cmGrid">${rows.map(r=>cmCardHtml(r, me)).join("")}</div>`
      :`<p class="small" style="margin-top:12px;opacity:.6">받아 둔 목록에는 이 감독의 글이 없습니다.</p>`}
  </div>`;
}

/* ── 🖼️ 화면 ─────────────────────────────────────────────────────────── */
/* 목록 카드 한 장 — 목록과 감독 프로필이 같은 그림을 쓴다 */
function cmCardHtml(r, me){
  const hid = r.rn>=CM_HIDE_RP && r.id!==me && !cmAdmin();
  const mine = r.id===me;
  if(hid) return `<div class="cmCard cmHid" onclick="cmOpenPost('${r.k}')">
    <div class="cmWho"><b>${r.n}</b> <span class="small">${cmWhen(r.t)}에 포스팅됨</span></div>
    <div class="cmTi">🚨 신고가 쌓여 가려진 글입니다</div>
    <div class="small" style="opacity:.6;margin-top:6px">눌러서 내용을 확인할 수 있습니다.</div></div>`;
  const badge = r.sq
    ? `<div class="cmSqMini" style="--c:${r.col||"#2a6ee8"}">
         <div class="cmSqMiniTop">${r.sh||"팀"}</div>
         <div class="cmSqMiniMid">${r.fm||""}</div>
         <div class="cmSqMiniBot">${(r.to>0)?(function(){ try{ return renderStars(teamStarVal(r.to), `팀 전력 ${r.to}`); }catch(e){ return "평균 "+(r.av||0).toFixed(1); } })():`평균 <b>${(r.av||0).toFixed(1)}</b>`}</div></div>`
    : r.cv
    ? `<div class="cmCvMini">
         <div class="cmCvMiniIc">📜</div>
         <div class="cmSqMiniTop">${r.mn||"감독"}</div>
         <div class="cmSqMiniBot">${r.cs||0}시즌${r.ct?` · <b style="color:var(--gold)">🏆 ${r.ct}</b>`:""}</div></div>`
    : `<div class="cmEx">${(r.ex||"").replace(/\n/g,"<br>")||"<span style='opacity:.45'>(내용 없음)</span>"}</div>`;
  const chips=[cmTagChips(r.tg)];
  if(r.sq&&r.cv) chips.push(`<span class="cmTag" style="border-color:#e3b34155;color:var(--gold)">📜 경력</span>`);
  if(r.po) chips.push(`<span class="cmTag" style="border-color:#58a6ff55;color:#58a6ff">🗳️ 투표${r.pn?` ${r.pn}`:""}</span>`);
  if(r.mt) chips.push(`<span class="cmTag" style="border-color:#7ee2a855;color:#7ee2a8">⚽ 경기</span>`);
  if(r.pk) chips.push(`<span class="cmTag" style="border-color:#d2a8ff55;color:#d2a8ff">🌱 선수</span>`);
  if(r.im) chips.push(`<span class="cmTag" style="border-color:#8b949e55;color:#8b949e">🖼️ 이미지</span>`);
  return `<div class="cmCard" onclick="cmOpenPost('${r.k}')">
    <div class="cmWho">${cmWhoHtml(r.n, r.id, mine)}
      <span class="small">${cmWhen(r.t)}에 포스팅됨</span></div>
    <div class="cmTi">${r.ti}</div>
    ${badge}
    <div class="cmTags">${chips.join("")}</div>
    <div class="cmFoot"><span>💬 ${r.cn||0}</span>${r.vn?`<span style="color:var(--gold)">🔥 ${r.vn}</span>`:""}${r.sn?`<span title="스쿼드 평가 ${cmSrAvg(r).toFixed(1)}★ · ${r.sn}명" style="color:var(--gold)">⭐ ${cmSrAvg(r).toFixed(1)}</span>`:""}</div></div>`;
}
function cmView(){
  if(!cmOn()) return `<div class="card"><h3>🗣️ 커뮤니티</h3>
    <p class="small">이 빌드에는 온라인 주소가 들어 있지 않아 커뮤니티를 쓸 수 없습니다.</p></div>`;
  if(CMB.mode==="write") return cmWriteView();
  if(CMB.mode==="read") return cmReadView();
  if(CMB.mode==="prof") return cmProfView();
  return cmListView();
}
function cmListView(){
  const me=cmMe();
  const chips=[{k:"all",n:"모두",c:"var(--sub)"}].concat(CM_TAGS).map(t=>
    `<button class="mini ${CMB.tag===t.k?"sel":""}" style="padding:5px 13px;font-size:12.5px${CMB.tag===t.k?"":`;border-color:${t.c}44;color:${t.c}`}"
      onclick="cmSetTag('${t.k}')">${t.n}</button>`).join("");
  const sorts=[["new","최신순"],["vote","추천순"],["cmt","댓글순"]].map(([k,n])=>
    `<button class="mini ${CMB.sort===k?"sel":""}" style="padding:5px 11px;font-size:12px" onclick="cmSetSort('${k}')">${n}</button>`).join("");
  let rows=(CMB.rows||[]).slice();
  if(CMB.tag!=="all") rows=rows.filter(r=>r.tg.split(",").indexOf(CMB.tag)>=0);
  if(CMB.sort==="vote") rows.sort((a,b)=>(b.vn-a.vn)||(b.t-a.t));
  else if(CMB.sort==="cmt") rows.sort((a,b)=>(b.cn-a.cn)||(b.t-a.t));
  const cards=rows.map(r=>cmCardHtml(r, me)).join("");
  const cached=!!(CMB.rows && CMB.rows.length);
  const warn = (CMB.ok!==false) ? ""
    : (CMB.why==="net"
      ? `<div class="msg warn" style="margin:8px 0 0">🌐 <b>인터넷에 연결되어 있지 않습니다.</b>
         <span class="small">커뮤니티는 감독들이 같은 서버를 함께 쓰기 때문에, 글을 읽고 쓰려면 연결이 있어야 합니다.
         ${cached?"아래 목록은 <b>마지막으로 받아 둔 것</b>이라 최신이 아닐 수 있고, 글을 열어도 본문은 나오지 않습니다.":"연결되면 목록을 바로 받아 옵니다."}
         게임 진행·세이브는 연결과 아무 상관 없이 그대로 됩니다.</span>
         <div style="margin-top:6px"><button class="mini" onclick="cmRetry()">🔄 다시 연결해 보기</button></div></div>`
      : `<div class="msg warn" style="margin:8px 0 0">⚠ <b>커뮤니티 게시판을 읽지 못했습니다.</b>
         <span class="small">서버까지는 닿았는데 <b>board</b> 갈래를 읽을 수 없습니다 — Firebase 보안 규칙에 그 갈래가 아직 없을 가능성이 큽니다 (설정 가이드 2번을 다시 올려 주세요).</span>
         <div style="margin-top:6px"><button class="mini" onclick="cmRefresh()">🔄 다시 확인</button></div></div>`);
  const nick=(function(){ try{ return pvpNickClaimed()?String(pvpNick()):""; }catch(e){ return ""; } })();
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <h3 style="margin:0">🗣️ 커뮤니티</h3>
      <span class="small" style="opacity:.7">감독들의 공용 게시판 — 스쿼드를 자랑하고, 묻고, 떠듭니다</span>
      <span style="margin-left:auto;display:flex;gap:6px">
        <button class="mini" onclick="${CMB.ok===false&&CMB.why==="net"?"cmRetry()":"cmRefresh()"}">🔄</button>
        <button class="mini sel" style="padding:6px 15px" onclick="cmGo('write')">✍️ 새 게시물</button></span>
    </div>
    <div class="cmBar">${chips}<span style="margin-left:auto;display:flex;gap:5px">${sorts}</span></div>
    ${warn}
    ${nick?"":`<div class="msg" style="margin:8px 0 0"><span class="small">글과 댓글을 쓰려면 ⚔️ 온라인 대전 메뉴에서 <b>닉네임</b>을 먼저 정해 주세요. 읽는 것은 지금도 됩니다.</span></div>`}
    ${CMB.rows===null
      ? (CMB.ok===false
          ? `<p class="small" style="margin-top:14px;opacity:.6">${CMB.why==="net"?"연결되면 목록을 불러옵니다.":"목록을 불러오지 못했습니다."}</p>`
          : `<p class="small" style="margin-top:14px;opacity:.6">게시판을 불러오는 중…</p>`)
      : rows.length?`<div class="cmGrid">${cards}</div>`
      : `<p class="small" style="margin-top:14px;opacity:.6">아직 글이 없습니다 — 첫 글을 올려 보세요.</p>`}
    <p class="small" style="margin-top:10px;opacity:.55">한 달이 지난 글은 자동으로 사라집니다 · 신고 ${CM_HIDE_RP}건이면 목록에서 가려집니다 · 로그인이 없는 구조라 서로 예의를 지켜 주세요.</p>
  </div>`;
}
function cmReadView(){
  const id=CMB.id, me=cmMe();
  const r=(CMB.rows||[]).find(x=>x.k===id);
  if(!r) return `<div class="card"><h3>🗣️ 커뮤니티</h3><p class="small">글을 찾지 못했습니다.</p>
    <button class="mini" onclick="cmGo('list')">← 목록으로</button></div>`;
  const P=CMB.post;
  const mine=(r.id===me)||cmAdmin();
  const body = P===null ? `<p class="small" style="opacity:.6">불러오는 중…</p>`
    : P._off ? `<div class="msg warn">🌐 <b>연결이 끊겨 본문을 불러오지 못했습니다.</b>
        <span class="small">목록에 남아 있는 요약만 보이는 상태입니다.</span>
        <div style="margin-top:6px"><button class="mini" onclick="cmRetry()">🔄 다시 연결해 보기</button>
        <button class="mini" onclick="cmOpenPost('${id}')">다시 시도</button></div></div>`
    : `${String(P.m||"").replace(/[<>&"'\`]/g,"").split("\n").map(x=>x||"&nbsp;").join("<br>")}`;
  const img = (P && P.im && /^https:\/\//i.test(P.im))
    ? `<div style="margin-top:10px"><img src="${cmEsc(P.im,200)}" style="max-width:100%;border-radius:8px;border:1px solid var(--line)" onerror="this.style.display='none'"></div>` : "";
  const sq = (P && P.sq) ? cmSquadHtml(P.sq, true) : "";
  const cvc = (P && P.cv) ? cmCareerHtml(P.cv, true) : "";
  const poll = (P && P.pl) ? cmPollHtml(id, P) : "";
  const mtc = (P && P.mt) ? cmMatchHtml(P.mt) : "";
  const pkc = (P && P.pk) ? cmPlayerHtml(P.pk) : "";
  const rate = cmRateBar(id, r);
  /* ⚔️ 요청 — 글에서 바로 대전 신청. 접속 중인 감독에게만 보인다 */
  const LV=(CMB.live||{})[r.id]||null;
  const duel = (!mine && r.id && r.id!==me && LV)
    ? `<button class="mini" style="border-color:var(--acc);color:var(--acc)" onclick="cmDuel('${r.id}','${r.n}')">⚔️ 대전 신청</button>` : "";
  const cmts = CMB.cmts===null ? `<p class="small" style="opacity:.6">댓글을 불러오는 중…</p>`
    : (CMB.cmts.length ? CMB.cmts.map(c=>`<div class="cmCm">
        <b style="color:${c.id===me?"var(--gold)":"var(--acc2,#58a6ff)"}">${c.n}</b>
        <span class="small" style="opacity:.45">${cmWhen(c.t)}</span>
        <span style="margin-left:6px">${c.m}</span>
        ${(c.id===me||cmAdmin())?`<button class="mini" style="padding:1px 7px;font-size:11px;margin-left:6px" onclick="cmCmtDel('${c.k}')">삭제</button>`:""}
      </div>`).join("") : `<p class="small" style="opacity:.55">첫 댓글을 남겨 보세요.</p>`);
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button class="mini" onclick="cmGo('list')">← 목록</button>
      <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
        ${duel}
        <button class="mini" onclick="cmVote('${id}')">🔥 추천 ${r.vn||0}</button>
        ${mine?`<button class="mini" style="color:#f85149" onclick="cmDel('${id}')">🗑️ 삭제</button>`
              :`<button class="mini" onclick="cmReport('${id}')">🚨 신고</button>`}
      </span>
    </div>
    <h3 style="margin:10px 0 2px">${r.ti}</h3>
    <div class="small" style="opacity:.85;margin-bottom:8px">
      ${cmWhoHtml(r.n, r.id, r.id===me)} <span style="opacity:.7">· ${cmWhen(r.t)}에 포스팅됨</span> ${cmTagChips(r.tg)}</div>
    ${r.rn>=CM_HIDE_RP?`<div class="msg warn"><span class="small">🚨 신고가 ${r.rn}건 쌓인 글입니다 — 읽을 때 주의해 주세요.</span></div>`:""}
    <div class="cmBody">${body}</div>
    ${poll}
    ${img}
    ${mtc}
    ${pkc}
    ${sq}
    ${rate}
    ${cvc}
  </div>
  <div class="card"><h3>💬 댓글 ${(CMB.cmts||[]).length||r.cn||0}</h3>
    <div class="cmCmBox">${cmts}</div>
    ${PVP_NET===false
      ? `<p class="small" style="margin-top:8px;opacity:.65">🌐 연결이 끊겨 있어 댓글을 남길 수 없습니다.
         <button class="mini" style="margin-left:6px" onclick="cmRetry()">🔄 다시 연결해 보기</button></p>`
      : `<div style="display:flex;gap:6px;margin-top:8px">
      <input id="cmCmtIn" maxlength="200" placeholder="댓글 남기기…" style="flex:1"
        onkeydown="if(event.key==='Enter'){event.preventDefault();cmCmtSend();}">
      <button class="mini sel" onclick="cmCmtSend()">등록</button></div>`}
  </div>`;
}
/* ✍️ ⚠ 요청 원문 — 「글쓰기 화면 스타일 좀 예쁘게 꾸며줘라.. 너무 투박해..」
   예전 판은 기본 <input>/<textarea> 를 그대로 썼다 — 게임 어디에도 그 스타일이 없어서
   브라우저 기본 흰 상자가 튀어나왔다. 칸마다 라벨·글자수·도움말을 붙인 「필드」로 다시 짠다. */
function cmLen(id, nid, max){
  try{
    const el=document.getElementById(id), n=document.getElementById(nid); if(!el||!n) return;
    const v=(el.value||"").length;
    n.textContent=v+" / "+max;
    n.classList.toggle("hot", v>=max*0.9);
    /* 다시 그릴 때 사라지지 않게 초안에 바로 담는다 (태그를 눌러도 글이 남는다) */
    try{ const D=cmDraft(); if(id==="cmTi") D.ti=el.value; else if(id==="cmBody") D.m=el.value; else if(id==="cmImg") D.im=el.value; }catch(e){}
  }catch(e){}
}
function cmWriteView(){
  const D=cmDraft();
  const tags=CM_TAGS.map(t=>{ const on=D.tg.indexOf(t.k)>=0;
    return `<button class="cmPill${on?" on":""}" style="border-color:${t.c};color:${t.c}${on?`;background:${t.c}`:""}"
      onclick="cmTagPick('${t.k}')"><span class="tick">✓</span>${t.n}</button>`; }).join("");
  const sq=cmSquadPack();
  const cv=cmCareerPack();
  const mt=cmMatchPack();
  const pkList=cmPickList();
  const pk=(D.pk&&D.pid)?cmPlayerPack(D.pid):null;
  const nick=(function(){ try{ return pvpNickClaimed()?String(pvpNick()):""; }catch(e){ return ""; } })();
  const att = sq
    ? `<div class="cmAttach${D.sq?" on":""}" onclick="cmSqToggle()">
         <div class="cmSw"><i></i></div>
         <div class="cmAttT"><b>🧳 내 스쿼드</b>
           <span>${D.sq?"선발 11명이 포메이션 그림과 명단으로 함께 올라갑니다":"켜면 지금 선발 11명이 글에 함께 실립니다"}</span></div>
         <div class="cmAttB" style="--c:${sq.col}"><b>${sq.sh}</b>
           <span class="small">${(sq.tac&&sq.tac.formation)||""} · 전력 ${(function(){ try{ return renderStars(teamStarVal(sq.to||0)); }catch(e){ return sq.av.toFixed(1); } })()}</span></div>
       </div>`
    : `<div class="cmAttach off">
         <div class="cmSw"><i></i></div>
         <div class="cmAttT"><b>🧳 내 스쿼드</b>
           <span>${G.jobless?"무직 상태에서는 붙일 수 없습니다":"선발 열한 명을 먼저 채우면 붙일 수 있습니다"}</span></div>
       </div>`;
  /* ⚽ 방금 치른 경기 한 판 (요청 — 첨부 추가) */
  const attMt = mt
    ? `<div class="cmAttach${D.mt?" on":""}" onclick="cmMtToggle()">
         <div class="cmSw"><i></i></div>
         <div class="cmAttT"><b>⚽ 최근 경기 결과</b>
           <span>${D.mt?"스코어·득점자·MOM 이 함께 올라갑니다":"켜면 마지막 경기 한 판이 글에 실립니다"}</span></div>
         <div class="cmAttB" style="--c:${mt.hc}"><b>${mt.hn} ${mt.hg} : ${mt.ag} ${mt.an}</b>
           <span class="small">${mt.tag||"리그"}</span></div>
       </div>`
    : `<div class="cmAttach off">
         <div class="cmSw"><i></i></div>
         <div class="cmAttT"><b>⚽ 최근 경기 결과</b>
           <span>아직 치른 경기가 없습니다 — 한 판 뛰고 나면 붙일 수 있습니다</span></div>
       </div>`;
  /* 🌱 선수 한 명 (요청 — 유망주 자랑) */
  const attPk = pkList.length
    ? `<div class="cmAttach${D.pk?" on":""}">
         <div class="cmSw" onclick="cmPkToggle()"><i></i></div>
         <div class="cmAttT" onclick="cmPkToggle()"><b>🌱 선수 한 명</b>
           <span>${D.pk?"현재 능력·잠재력이 별로 함께 올라갑니다":"켜면 우리 선수 하나를 골라 붙일 수 있습니다"}</span></div>
         ${D.pk?`<select class="cmSel" onchange="cmPickSet(this.value)" onclick="event.stopPropagation()">
            ${pkList.map(q=>`<option value="${q.id}"${String(q.id)===String(D.pid)?" selected":""}>${cmEsc(q.name,12)} · ${cmEsc((function(){ try{ return prefSlotOf(q); }catch(e){ return q.pos; } })(),4)} · ${(G.season|0)-(q.by||2000)}세</option>`).join("")}
          </select>`:""}
       </div>`
    : `<div class="cmAttach off">
         <div class="cmSw"><i></i></div>
         <div class="cmAttT"><b>🌱 선수 한 명</b><span>붙일 선수가 없습니다</span></div>
       </div>`;
  /* 📜 요청 — 「감독 경력의 대회성적도 게시글에 올릴 수 있게 하자」 */
  const attCv = cv
    ? `<div class="cmAttach${D.cv?" on":""}" onclick="cmCvToggle()">
         <div class="cmSw"><i></i></div>
         <div class="cmAttT"><b>📜 내 감독 경력</b>
           <span>${D.cv?"통산 전적·트로피 진열장·시즌별 대회 성적이 함께 올라갑니다":"켜면 통산 기록과 대회 성적이 글에 함께 실립니다"}</span></div>
         <div class="cmAttB" style="--c:var(--gold)"><b>${cv.sN||0}시즌</b>
           <span class="small">${(cv.tro||[]).length?`🏆 ${(cv.tro||[]).length}개`:"진열장 비어 있음"} · 평판 <b style="color:var(--gold)">${cv.pr||"-"}</b></span></div>
       </div>`
    : `<div class="cmAttach off">
         <div class="cmSw"><i></i></div>
         <div class="cmAttT"><b>📜 내 감독 경력</b>
           <span>아직 남은 기록이 없습니다 — 한 시즌을 마치거나 트로피를 하나 들면 붙일 수 있습니다</span></div>
       </div>`;
  return `<div class="card cmWrite">
    <div class="cmHead">
      <button class="mini" onclick="cmGo('list')">←</button>
      <div class="cmHeadT"><b>✍️ 새 게시물</b><span>다른 감독들이 보게 될 글입니다</span></div>
      ${nick?`<span class="cmWho2">🗣️ <b>${cmEsc(nick,8)}</b></span>`
            :`<span class="cmWho2 no">⚠ 닉네임 없음</span>`}
    </div>

    <div class="cmFld">
      <div class="cmLbl"><span>제목</span><span class="cmCnt" id="cmTiN">${(D.ti||"").length} / 40</span></div>
      <input class="cmIn cmInBig" id="cmTi" maxlength="40" value="${cmEsc(D.ti,40)}"
        placeholder="한 줄로 요약해 주세요" oninput="cmLen('cmTi','cmTiN',40)">
    </div>

    <div class="cmFld">
      <div class="cmLbl"><span>내용</span><span class="cmCnt" id="cmBodyN">${(D.m||"").length} / 600</span></div>
      <textarea class="cmTa" id="cmBody" maxlength="600" rows="8"
        placeholder="하고 싶은 이야기를 적어 주세요.&#10;스쿼드를 자랑하거나, 전술을 묻거나, 대전 상대를 구해도 좋습니다."
        oninput="cmLen('cmBody','cmBodyN',600)">${String(D.m||"").replace(/[<>&"'\`]/g,"")}</textarea>
    </div>

    <div class="cmFld">
      <div class="cmLbl"><span>태그</span><span class="hint">최대 2개 · 목록에서 이 태그로 걸러 보입니다</span></div>
      <div class="cmPills">${tags}</div>
    </div>

    <div class="cmFld">
      <div class="cmLbl"><span>첨부</span><span class="hint">이미지가 아니라 데이터로 실립니다 · 둘 다 붙일 수 있습니다</span></div>
      <div class="cmAttGrp">${att}${attCv}${attMt}${attPk}</div>
      ${(D.sq&&sq)?cmSquadHtml(sq,false):""}
      ${(D.cv&&cv)?cmCareerHtml(cv,false):""}
      ${(D.mt&&mt)?cmMatchHtml(mt):""}
      ${(D.pk&&pk)?cmPlayerHtml(pk):""}
    </div>

    <div class="cmFld">
      <div class="cmLbl"><span>투표</span><span class="hint">선택지 2~${CM_POLL_MAX}개 · 감독당 한 표</span></div>
      <div class="cmAttach${D.po?" on":""}" onclick="if(!event.target.closest('.cmPollEd'))cmPollToggle()">
        <div class="cmSw"><i></i></div>
        <div class="cmAttT"><b>🗳️ 투표 붙이기</b>
          <span>${D.po?"읽는 사람들이 한 표씩 던질 수 있습니다":"켜면 선택지를 만들 수 있습니다"}</span></div>
      </div>
      ${D.po?`<div class="cmPollEd" onclick="event.stopPropagation()">
        <input class="cmIn" id="cmPollQ" maxlength="60" value="${cmEsc(D.pt,60)}"
          placeholder="무엇을 물어볼까요? (예: 이 선수 팔까요 말까요)">
        ${(D.pq||[]).map((o,i)=>`<div class="cmPollRow">
          <span class="cmPollIx">${i+1}</span>
          <input class="cmIn" id="cmPollO${i}" maxlength="24" value="${cmEsc(o,24)}" placeholder="선택지 ${i+1}">
          ${(D.pq.length>2)?`<button class="mini" onclick="cmPollDel(${i})">✕</button>`:""}
        </div>`).join("")}
        ${(D.pq||[]).length<CM_POLL_MAX?`<button class="mini" style="margin-top:6px" onclick="cmPollAdd()">＋ 선택지 추가</button>`:""}
      </div>`:""}
    </div>

    ${""}
    <div class="cmFld">
      <div class="cmLbl"><span>이미지 주소</span><span class="hint">선택 · https 주소만</span>
        <span class="cmCnt" id="cmImgN">${(D.im||"").length} / 200</span></div>
      <input class="cmIn" id="cmImg" maxlength="200" value="${cmEsc(D.im,200)}"
        placeholder="https://… 이미지 주소를 붙여넣으세요" oninput="cmLen('cmImg','cmImgN',200)">
    </div>

    <div class="cmActs">
      <button class="cmSend" onclick="cmSubmit()">🗣️ 올리기</button>
      <button class="cmGhost" onclick="cmGo('list')">취소</button>
      <span class="cmRule">올린 글은 고칠 수 없습니다 — 지우고 다시 쓸 수는 있습니다<br>
        한 달이 지나면 자동으로 사라집니다</span>
    </div>
  </div>`;
}
/* ⏳ 대기 배너 — ⚠ 제보 원문 — 「빠른 대전을 눌렀을때 온라인 대전 메뉴 화면에서 상단에 큐가
   돌아가게 하고, 취소도 할 수 있게 해줄래? 지금은 빠른 대전 누르면 따로 화면이 전환되어서
   채팅창도 못보잖아. 마찬가지로 공개방을 만들었을때도 현재 인원이 누구 있는지랑, 채팅창을
   볼 수 있게 하면 좋을거같고」.
   ─ 예전에는 queue/room/connecting 단계에서 메뉴를 통째로 갈아치운 별도 화면을 그렸다.
     이제 메뉴는 그대로 두고 맨 위에 「돌아가는」 배너만 얹는다 — 접속 인원·공개 방 목록·
     라운지 채팅이 대기 중에도 전부 살아 있다. */
function pvpWaitBanner(){
  if(!PVP) return "";
  const st=PVP.stage;
  const title = st==="queue" ? "🔍 상대 찾는 중"
             : st==="connecting" ? "🔗 상대와 연결 중"
             : PVP.duel ? `⚔️ ${PVP.duel} 감독에게 대전 신청 중`
             : (PVP.pub ? "🌐 공개 방 — 상대를 기다리는 중" : "🔒 비공개 방 — 친구를 기다리는 중");
  return `<div class="card pvpWait">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span class="pvpSpin" aria-hidden="true"></span>
      <div style="flex:1;min-width:180px">
        <b style="font-size:15.5px">${title}</b>
        <div class="small" style="opacity:.8;margin-top:2px">${PVP.msg||"..."}</div>
        ${PVP.role==="host"&&PVP.room&&st==="room"&&!PVP.duel?`<div style="margin-top:4px">방 코드 <b style="font-size:20px;letter-spacing:3px;color:var(--gold)">${PVP.room}</b>
          <button class="mini" style="padding:3px 9px;font-size:11.5px" onclick="try{navigator.clipboard.writeText('${PVP.room}');flash('📋 방 코드를 복사했습니다','info');}catch(e){}">복사</button></div>`:""}
      </div>
      <button class="mini" style="border-color:var(--red);color:#ff9d95;padding:9px 16px" onclick="pvpLeave()">🚫 취소</button>
    </div>
    <p class="small" style="margin:7px 0 0;opacity:.65">기다리는 동안 아래에서 접속 인원·공개 방·라운지 채팅을 그대로 쓸 수 있습니다.</p>
  </div>`;
}
function pvpView(){
  try{ if(!(PVP && PVP.stage==="match" && PVP.role==="guest")) document.body.classList.remove("matchFS"); }catch(e){}
  const logHtml=(function(){
    const L=G.pvpLog||[];
    const w=L.filter(x=>x.my>x.op).length, d=L.filter(x=>x.my===x.op).length, l=L.filter(x=>x.my<x.op).length;
    return `<div class="card"><h3>📜 대전 전적 <span class="small">— ${L.length}전 ${w}승 ${d}무 ${l}패</span></h3>
      ${L.length?`<div class="tblScroll" style="max-height:34vh;overflow-y:auto"><table>
        <tr><th>상대</th><th>닉네임</th><th>결과</th><th>홈/원정</th><th>시즌</th></tr>
        ${L.slice(0,40).map(x=>`<tr><td>${x.opp}</td><td class="small">${x.oppMgr||"-"}</td>
          <td><b style="color:${x.my>x.op?"var(--green)":x.my<x.op?"var(--red)":"var(--gold)"}">${x.my} : ${x.op}</b>${x.ff?`<span class="small" style="opacity:.7"> 몰수</span>`:""}</td>
          <td class="small">${x.host?"홈":"원정"}</td><td class="small">${x.s}</td></tr>`).join("")}
      </table></div>`:`<p class="small">아직 온라인 대전 기록이 없습니다.</p>`}</div>`;
  })();
  /* ⏱️ PVP_BUSY — 서버 응답을 기다리는 「진입 절차 진행 중」도 대기로 친다.
     예전에는 이 구간에 버튼이 살아 있어 연타로 절차가 겹쳤다 (제보: 먹통) */
  const WAITING = !!(PVP && (PVP.stage==="queue"||PVP.stage==="room"||PVP.stage==="connecting")) || !!PVP_BUSY;
  if(!PVP || WAITING){
    /* 서버 미설정 빌드: 시작 버튼 대신 안내만 (전적은 그대로 보인다) */
    if(!pvpOn()) return `<h2>⚔️ 온라인 대전</h2><div class="msg warn">이 빌드에는 온라인 서버가 설정되어 있지 않습니다.</div>${logHtml}`;
    if(PVP_NET===null){ try{ setTimeout(()=>{ try{ pvpNetCheck(); }catch(e){} }, 30); }catch(e){} }
    return `<h2>⚔️ 온라인 대전 <span class="small">— 실시간 P2P 친선전 (베타)</span>
      <span class="tierMini" style="color:var(--gold);border-color:#e3b34155;vertical-align:middle;margin-left:6px" title="내 게임 버전 — 같은 버전끼리만 매칭됩니다&#10;빌드 ${GAME_BUILD}">v${PVP_VER}</span>
      <span class="small" style="opacity:.45;font-weight:400;margin-left:5px;vertical-align:middle">빌드 ${GAME_BUILD}</span></h2>
    ${WAITING?pvpWaitBanner():""}
    <div class="msg info">내 스쿼드로 다른 감독과 실시간으로 붙습니다. <b>순수 친선</b> — 컨디션·부상·성장에 영향이 없고 전적만 남습니다.<br>
      <span class="small">경기 중 <b>📋 전술</b> 버튼을 누르면 <b>리그와 똑같은 전술 화면</b>이 열립니다 — 교체·포메이션·역할·세부 지시를 그대로 다룹니다.
      여는 동안 경기가 멈추고 상대 화면은 가려지며, <b>경기당 3회</b>까지 쓸 수 있습니다.<br>
      하프타임은 <b>양쪽이 준비를 누르면</b> 시작하고, 한쪽이 다른 탭으로 가면 경기가 <b>자동으로 일시정지</b>됩니다.
      경기 중 이탈은 <b style="color:#ff9d5c">0 : 3 몰수패</b>입니다. 경기 중에도 상대와 채팅할 수 있습니다.</span></div>
    ${PVP_NET===false?`<div class="msg warn" style="border-width:2px">🌐 <b>인터넷에 연결되어 있지 않습니다.</b><br>
      <span class="small">연결이 돌아오면 자동으로 풀립니다. 그때까지 매칭·채팅은 잠깁니다 — 지난 전적은 아래에서 그대로 보실 수 있습니다.</span>
      <div style="margin-top:7px"><button class="mini" onclick="pvpNetCheck()">🔄 다시 확인</button></div></div>`:""}
    <div class="card"><h3>🎫 내 닉네임 <span class="small">— 매칭·스코어보드·채팅에 표시</span></h3>
      <div style="display:flex;gap:6px;align-items:center">
        <input id="pvpNickIn" type="text" maxlength="8" value="${pvpNick()}" placeholder="닉네임 (8자)"
          style="width:170px;padding:9px;font-size:15px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg)">
        <button class="mini" style="padding:9px 14px" onclick="pvpSetNick(document.getElementById('pvpNickIn').value)">저장</button>
        ${pvpNickClaimed()?`<span class="small" style="color:var(--green);font-weight:700">✅ 등록됨</span>`
          :`<span class="small" style="color:#ff9d5c;font-weight:700">미등록 — 저장하면 등록됩니다</span>`}
      </div>
      <p class="small" style="margin-top:6px;opacity:.7">비우면 감독 이름을 씁니다. 이 브라우저에 저장돼 어느 세이브로 접속해도 같은 이름입니다.<br>
        <b>같은 닉네임은 한 사람만</b> 쓸 수 있습니다 — 30일 동안 접속이 없으면 그 이름은 다시 풀립니다.</p>
    </div>
    <div class="card"><h3>🟢 지금 접속 중 <span class="small">— ⚔️ 메뉴를 보고 있는 감독들</span>
      <button class="mini" style="float:right;padding:3px 9px;font-size:11px" onclick="pvpDiag()" title="매칭이 안 될 때 어디가 막혔는지 확인합니다">🔧 연결 점검</button></h3>
      <div id="pvpLive">${pvpLiveHtml()}</div>
    </div>
    <div class="card"><h3>💬 라운지 채팅 <span class="small">— 여기 있는 모두가 함께 봅니다 · 아래 모서리를 끌어 크기를 바꿀 수 있습니다</span></h3>
      <div id="pvpTalk" class="chatBox" data-cbdef="230">${pvpTalkHtml()}</div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:7px">
        <input id="pvpTalkIn" type="text" maxlength="90" placeholder="${PVP_NET===false?"연결이 끊겨 있습니다":pvpNickClaimed()?"메시지 (90자)":"닉네임을 먼저 저장해 주세요"}"
          ${(PVP_NET===false||!pvpNickClaimed())?"disabled":""} onkeydown="pvpTalkKey(event)"
          style="flex:1;min-width:120px;padding:9px;font-size:14px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg)${(PVP_NET===false||!pvpNickClaimed())?";opacity:.5":""}">
        <button class="mini" style="padding:9px 16px" ${(PVP_NET===false||!pvpNickClaimed())?"disabled":""} onclick="pvpTalkSend()">보내기</button>
      </div>
      <p class="small" style="margin-top:6px;opacity:.7">${pvpNickClaimed()?"최근 40줄만 남고, 3시간이 지난 줄은 사라집니다. 서로 예의를 지켜 주세요.":"🎫 위에서 <b>닉네임을 저장</b>하면 채팅을 쓸 수 있습니다 — 누가 한 말인지 알 수 있어야 하니까요."}</p>
    </div>
    ${""/* 💬 라운지 채팅 — 개발 노트: 「라운지 채팅 위치를 지금 접속중 아래에」 */}
    <div class="card"><h3>대전 시작${PVP_NET===false?` <span class="small" style="color:#ff9d5c">— 연결이 끊겨 잠겨 있습니다</span>`:""}</h3>
      ${(function(){ const D=(PVP_NET===false||WAITING)?" disabled":""; return `
      <div class="pvpStart">
        <button class="pvpBtn" style="--pbC:var(--gold)"${D} onclick="pvpQuick()">
          <span class="pvpBtnH"><span class="pvpBtnIc">⚔️</span><span class="pvpBtnT">빠른 대전</span></span>
          <span class="pvpBtnS">대기 중인 상대와 바로 붙습니다 — 전력 제한 없음</span>
        </button>
        <button class="pvpBtn" style="--pbC:var(--acc)"${D} onclick="pvpMakeRoom(1)">
          <span class="pvpBtnH"><span class="pvpBtnIc">🌐</span><span class="pvpBtnT">공개 방 만들기</span></span>
          <span class="pvpBtnS">아래 목록에 올라가 누구나 입장합니다</span>
        </button>
        <button class="pvpBtn" style="--pbC:var(--green)"${D} onclick="pvpMakeRoom(0)">
          <span class="pvpBtnH"><span class="pvpBtnIc">🔒</span><span class="pvpBtnT">비공개 방</span></span>
          <span class="pvpBtnS">6자리 코드로 친구만 초대합니다</span>
        </button>
      </div>
      <div class="pvpCode">
        <input id="pvpCodeIn" type="text" maxlength="6"${D} placeholder="방 코드">
        <button class="mini"${D} onclick="pvpJoinRoom(document.getElementById('pvpCodeIn').value)">🔑 코드로 입장</button>
        <span class="small pvpCodeHint" style="opacity:.6">친구에게 받은 6자리 코드</span>
      </div>`; })()}
      <p class="small" style="margin-top:8px;opacity:.75">⚠ 일부 통신망(LTE 테더링 등)에서는 P2P 연결이 안 될 수 있습니다. 상대 스쿼드는 경기 전에 미리 보고 수락/거절할 수 있습니다.</p>
    </div>
    <div class="card"><h3>🌐 공개 방 목록 <button class="mini" style="margin-left:8px;padding:4px 12px" onclick="pvpRoomsRefresh(1)">🔄 새로고침</button></h3>
      <div id="pvpRooms"><p class="small" style="opacity:.6">불러오는 중…</p></div>
      ${(function(){ try{ setTimeout(()=>{ try{ pvpRoomsRefresh(); }catch(e){} }, 50); }catch(e){} return ""; })()}
    </div>
    <div class="card"><h3>🏅 시즌 티어 <span class="small">— 시즌 ${pvpTierSeasonNo()} · 4주마다 새 시즌</span></h3>
      <div id="pvpTier">${pvpTierHtml()}</div>
      ${(function(){ try{ setTimeout(()=>{ try{ pvpRankRefresh(); }catch(e){} }, 80); }catch(e){} return ""; })()}
    </div>
    <div class="card"><h3>🏆 주간 랭킹 <span class="small">— 이번 주 포인트 순 · 승 3 무 1 패 0</span></h3>
      <div id="pvpRank">${pvpRankHtml()}</div>
      ${(function(){ try{ setTimeout(()=>{ try{ pvpRankRefresh(); }catch(e){} }, 80); }catch(e){} return ""; })()}
    </div>
    <div class="card"><h3>🌐 실시간 전적 <span class="small">— 방금 끝난 다른 감독들의 경기</span></h3>
      <button class="mini" style="float:right;margin-top:-26px;padding:4px 12px" onclick="pvpResFoldToggle()">${pvpResFolded()?"▼ 펴기":"▲ 접기"}</button>
      ${pvpResFolded()
        ? `<p class="small" style="opacity:.55;margin:4px 0 0">접혀 있습니다 — 「▼ 펴기」를 누르면 최근 경기들이 보입니다.</p>`
        : `<div id="pvpRes" class="chatBox" data-cbdef="220">${pvpResHtml()}</div>
      <p class="small" style="margin-top:7px;opacity:.65">경기가 끝나는 즉시 올라옵니다 · 최근 사흘·${PVP_RES_SHOW}경기까지 보관 · 아래 모서리를 끌어 크기를 바꿀 수 있습니다.</p>`}
    </div>
    ${logHtml}`;
  }
  /* (queue·room·connecting 은 위의 메뉴+대기 배너가 담당한다 — 제보) */
  if(PVP.stage==="lobby"){
    const pk=PVP.oppPack, ck=PVP.oppCheck||{ok:true,notes:[]};
    return `<h2>⚔️ 온라인 대전 — 매치 로비</h2>
    ${pk?`<div class="card"><h3>상대: <span style="color:var(--gold)">${pk.mgr}</span>의 ${pk.name} <span class="small">— 전력 ${(pk.stars||3).toFixed(1)}★</span>${(PVP.reCount|0)?` <span class="small" style="color:var(--gold)">· 🔁 ${(PVP.reCount|0)+1}번째 판</span>`:""}</h3>
      <p style="margin:2px 0 6px">${pvpH2HLine(pk.mgr)}${pvpTierTag(pk.mgr)}${pvpSeriesLine()}</p>
      ${ck.notes.length?`<div class="msg warn">⚠ ${ck.notes.join(" · ")}</div>`:""}
      ${pvpWxLine()}
      ${(function(){
        /* ⚠ 제보 — 선수 표 대신 「내 선발 vs 상대 선발」 포메이션 그림. 전술 수정 후 돌아오면
           pvpLobbySquadSync 가 재렌더해 실시간으로 갱신된다. */
        const my=PVP.myPack || (function(){ try{ return pvpPack(); }catch(e){ return null; } })();
        const myCol=(function(){ try{ return userTeam().col||"#2a6ee8"; }catch(e){ return "#2a6ee8"; } })();
        return `<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px">
          ${pvpFormPitch(my, myCol, "🎽 내 선발")}
          ${pvpFormPitch(pk, pk.col, "⚔️ 상대 선발")}
        </div>`;
      })()}
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="bigbtn" style="max-width:220px;${PVP.meReady?"opacity:.5":""}" onclick="pvpReady()">${PVP.meReady?"⏳ 상대 수락 대기…":"✅ 수락하고 킥오프"}</button>
        <button class="mini" style="padding:9px 14px" onclick="show('tactics')" title="리그에서 쓰는 그 전술 화면입니다. 수정하고 ⚔️ 메뉴로 돌아오면 자동으로 상대에게 전송됩니다">🎽 스쿼드·전술 수정</button>
        <button class="mini" onclick="pvpLeave()">🚫 거절하고 나가기</button>
      </div>
      <p class="small" style="margin-top:6px;opacity:.7">🎽 상대 스쿼드를 보고 선발·전술을 바꿀 수 있습니다 — 수정하고 돌아오면 상대에게 자동 전송되고, 양쪽 수락이 초기화됩니다.</p>
      ${(function(){ try{ setTimeout(()=>{ try{ pvpLobbySquadSync(); }catch(e){} }, 50); }catch(e){} return ""; })()}
      ${PVP.oppReady?`<p class="small" style="color:var(--green)">상대는 수락했습니다.</p>`:""}
    </div>
    <div class="card"><h3>💬 채팅 <span class="small">— 상대와 P2P 직통입니다 · 아래 모서리를 끌어 크기를 바꿀 수 있습니다</span></h3>${pvpChatBox(0)}</div>`:`<div class="card"><p>스쿼드 교환 중…</p><button class="mini" onclick="pvpLeave()">취소</button></div>`}`;
  }
  if(PVP.stage==="match" && PVP.role==="guest"){
    const W=PVP.watch||{}, i=W.info||{};
    const sN=W.snap||{};
    const hc=i.hc||"#2ea8ff", ac=i.ac||"#f85149";
    try{ document.body.classList.add("matchFS"); }catch(e){}
    return `<div class="lvGrid">
    <div class="lvCenter card">
      <div class="lvHead">
        <span class="t" style="background:${hc};color:${inkOn(hc)}">${i.hs||"홈"}</span>
        <span id="pvpScoreN">${W.hg||0} : ${W.ag||0}</span>
        <span class="t" style="background:${ac};color:${inkOn(ac)}">${i.as||"원정"}</span>
        <span id="pvpMin">${matchClockTxt(W.clock||0, (W.add&&W.add.a1)|0, (W.add&&W.add.a2)|0, (W.add&&W.add.a3)|0, !!sN.et)}'${sN.et?" 연장":(sN.half2?" 후반":" 전반")}</span>
        <span id="pvpMatchBtns" style="display:flex;gap:5px;align-items:center">${PVP.ended
          ? `<button class="mini sel" onclick="pvpGuestResult()">📋 결과 확인 ▶</button>`
          : `<button class="mini sel" onclick="pvpTacOpen()" title="경기를 멈추고 교체·세부 전술을 수정합니다 — 경기당 ${PVP_TAC_USES}회">📋 전술 (${PVP.tacMe!=null?PVP.tacMe:PVP_TAC_USES})</button>
          <button class="mini" onclick="pvpLeave()" title="경기 중 이탈은 0:3 몰수패입니다">🚪 기권</button>`}</span>
        <span id="pvpMode" class="pitchMode" style="margin-left:auto${sN.hl?";color:#f85149":""}">${sN.hl?"● HIGHLIGHT":"○ 경기 진행 중"}</span>
      </div>
      <div class="pitchWrap">
        <canvas id="pvpCv" class="dim" width="960" height="630" style="width:100%;height:auto;display:block"></canvas>
        <div id="pvpGoalOv" class="goalPanel hidden"></div>
      </div>
      <div id="pvpCap" class="pitchCaption">${(W.cap&&W.cap.x)||"📡 중계 연결됨 — 해설이 곧 시작됩니다"}</div>
      <div class="small" style="text-align:left; margin-top:6px; color:var(--sub)">2D 매치엔진 2.0 by 청백적시메오네 — ⚔️ 원격 관전 (원정)</div>
    </div>
    <div class="lvSide">
      <div class="card ${(W.off&&W.off.length)?"":"hidden"}" id="pvpOffCard" style="border-color:#e5484d">
        <h3 style="color:#e5484d">🟥 퇴장</h3><div id="pvpOff">${pvpOffHtml()}</div></div>
      <div class="card"><h3>📊 경기 통계</h3><div id="pvpStats">${pvpStatsHtml()}</div></div>
      <div class="card"><h3>📋 전술</h3>
        <button class="bigbtn" style="max-width:none;padding:11px" onclick="pvpTacOpen()">📋 전술창 열기
          <span class="small" style="color:inherit;opacity:.85">— 교체 · 세부 전술 (남은 ${PVP.tacMe!=null?PVP.tacMe:PVP_TAC_USES}회)</span></button>
        <p class="small" style="opacity:.7;margin-top:6px">전술창을 여는 동안 경기가 멈추고 상대 화면은 가려집니다.</p>
        ${pvpChatBox(1)}</div>
      <div class="card"><h3>📻 중계</h3><div id="pvpEvs" style="max-height:26vh;overflow-y:auto">${pvpEvHtml()}</div></div>
    </div>
  </div>`;
  }
  if(PVP.stage==="done"){
    const r=PVP.result||{hg:0,ag:0};
    const iH=PVP.role==="host";
    const my=iH?r.hg:r.ag, op=iH?r.ag:r.hg;
    return `<h2>⚔️ 경기 종료</h2>
    <div class="card"><h3 style="font-size:22px">${my} : ${op} <span class="small">— ${PVP.forfeit?(PVP.forfeit==="me"?"몰수패 ⚠️":"몰수승 🎉"):(my>op?"승리! 🎉":my<op?"패배":"무승부")}</span>${pvpSeriesLine()}</h3>
      ${PVP.forfeit?`<p class="small" style="color:${PVP.forfeit==="me"?"var(--red)":"var(--green)"}">${PVP.forfeit==="me"?"경기 중 이탈 — 0 : 3 몰수패로 기록됐습니다.":"상대가 경기를 떠나 3 : 0 몰수승으로 기록됐습니다."}</p>`:""}
      ${(function(){ const nk=(PVP.oppPack&&PVP.oppPack.mgr)||""; return nk?`<p style="margin:4px 0 2px">${pvpH2HLine(nk)}</p>`:""; })()}
      <p class="small">순수 친선전 — 선수단에는 아무 영향이 없습니다. 전적에 기록됐습니다.</p>
      ${(function(){
        /* 🔁 재대결 — 연결이 살아 있을 때만. 몰수(상대 이탈)로 끝난 판은 붙잡을 상대가 없다 */
        const live=!!(PVP.chR && PVP.chR.readyState==="open") && !PVP.forfeit;
        if(!live) return `<p class="small" style="opacity:.7">상대와의 연결이 끝났습니다 — 재대결은 로비에서 다시 신청해 주세요.</p>`;
        if(PVP.meRe && PVP.oppRe) return `<p class="small" style="color:var(--green)">🔁 재대결 준비 중…</p>`;
        if(PVP.meRe) return `<div class="msg info" style="margin:6px 0">🔁 <b>재대결을 신청했습니다</b> — 상대의 응답을 기다리는 중… <span class="small">(90초)</span></div>`;
        if(PVP.oppRe) return `<div class="msg good" style="margin:6px 0">🔁 <b>상대가 재대결을 신청했습니다!</b> 아래 버튼을 누르면 바로 다시 시작합니다.</div>`;
        return "";
      })()}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${(PVP.chR && PVP.chR.readyState==="open" && !PVP.forfeit && !PVP.meRe)
          ? `<button class="mini sel" style="padding:8px 16px;border-color:var(--gold);color:var(--gold)" onclick="pvpRematch()">⚔️ 한 판 더${PVP.oppRe?" (상대 대기 중)":""}</button>` : ""}
        <button class="mini" onclick="pvpReset();show('pvp')">로비로</button>
      </div></div>
    ${(function(){ try{ return pvpRepCards(); }catch(e){ return ""; } })()}
    ${logHtml}`;
  }
  return `<h2>⚔️ 온라인 대전</h2><div class="card"><p>경기 진행 중…</p></div>`;
}

