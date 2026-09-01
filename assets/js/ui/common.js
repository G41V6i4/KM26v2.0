"use strict";
/* ═══ ↩ 돌아갈 화면 기억 ══════════════════════════════════════════════
   ⚠ 제보 — 「재계약 탭에서 재계약에 성공하든 실패하든 스쿼드 탭으로 튄다.
      임대·이적시장 탭도 마찬가지다. 그 탭에서 한 일이면 그 탭에 남아야 한다.」
   협상 화면(재계약·임대)은 어디서든 열 수 있다. 열기 직전의 화면을 기억해 두고
   끝나면 정확히 그리로 돌려보낸다 — 탭 상태(ctTab·lcTab·tfTab)는 전역이라 그대로 유지된다. */
const RET_SUB=["renew","loan","loanin","nego"];         // 「돌아갈 곳」이 될 수 없는 협상 화면들
const RET_NAME={contract:"← 계약 · 재계약", squad:"← 스쿼드", transfer:"← 이적시장",
  loancenter:"← 임대 센터", tactics:"← 전술", youth:"← 유스", finance:"← 재정", home:"← 홈"};
let RET_VIEW=null;
function retMark(){ try{ if(VIEW && RET_SUB.indexOf(VIEW)<0) RET_VIEW=VIEW; }catch(e){} }
function retView(fb){ return (RET_VIEW && RET_SUB.indexOf(RET_VIEW)<0) ? RET_VIEW : (fb||"squad"); }
function retBack(fb){ const v=retView(fb); RET_VIEW=null; try{ show(v); }catch(e){} }
function retBtn(fb, extra){
  const v=retView(fb);
  return `<button class="mini" onclick="${extra||""}retBack('${v}')">${RET_NAME[v]||"← 돌아가기"}</button>`;
}
/* ⚠ 제보 원문 — 「모바일에서는 결과 확인버튼 누르면 후반전 시작! 이런 알림창이 뜨거든?」
   원인 — flash() 는 배너를 「다음에 화면을 그릴 때」 띄운다. 그런데 경기 화면은 show() 를
      거치지 않고 자체 루프로 그려지므로, 경기 중에 부른 배너(하프타임 「후반전 시작!」 등)가
      갈 곳을 잃고 앉아 있다가 경기가 끝나고 화면을 옮기는 순간에야 튀어나왔다.
   ─ 배너에 시각을 새겨 두고, 너무 묵은 것은 조용히 버린다. */
const FLASH_TTL=15000;
function flash(txt, cls){ FLASH={txt, cls:cls||"info", at:Date.now()}; }
function flashHtml(){
  const F=FLASH; FLASH=null;
  if(!F) return "";
  if(F.at && (Date.now()-F.at)>FLASH_TTL) return "";   // 묵은 배너 — 지금 띄우면 엉뚱하다
  return `<div class="msg ${F.cls}" style="border-width:2px;font-size:14px">${F.txt}</div>`;
}
/* 브라우저 alert() 대신 인게임 패널 — 모든 안내가 게임 화면 안에서 뜬다 */
function gameAlert(msg){
  try{ showConfirm(`⚠️ ${String(msg).replace(/\n/g,"<br>")}`, ()=>{}, {okLabel:"확인", cancelLabel:""}); }
  catch(e){ flash(String(msg),"warn"); }
}
function notify(txt, cls){ addNews(txt); flash(txt, cls); } // 뉴스 + 즉시 배너
function ovrCls(o){ return o>=76?"s":o>=72?"a":o>=67?"b":"c"; }
/* FM식 별점 등급 (58=0.5★ ~ 88+=5★, 0.5 단위) — 전술판에서 숫자 OVR 대신 사용 */
/* 점수(내부 20~99 스케일) → 별. 기준선(주전 평균)에 해당하는 62점이 3.25★가 되도록 맞춘다. */
function starValFromScore(score){
  return clamp(Math.round((STAR_MID + (score-62)/STAR_SPAN)*2)/2, 0.5, 5);
}
function ovrStarVal(o){ return starValFromScore(o); }
/* ── 팀 전력 별점 ──────────────────────────────────────────────
   선수 눈금(starValFromScore)을 팀 평균에 그대로 쓰면 안 된다. 11명을 평균 내면 값이 가운데로
   몰려서 리그 전체가 3~4.5★ 안에 뭉개진다 — 최하위와 우승 후보가 별 한 개 차이로 보인다.
   그래서 팀은 팀끼리 비교하는 별도 눈금을 쓴다. K리그 팀 평균은 대략 61~77 사이에 깔린다. */
const TEAM_STAR_LO=60, TEAM_STAR_HI=77.5;
function teamStarVal(t){
  const o=(typeof t==="number")?t:teamOVR(t);
  return clamp(Math.round((0.5+(o-TEAM_STAR_LO)/(TEAM_STAR_HI-TEAM_STAR_LO)*4.5)*2)/2, 0.5, 5);
}
/* 드롭다운(<option>)처럼 HTML 을 넣을 수 없는 자리를 위한 글자 별 — ★★★½ */
function starText(v){
  const val=clamp(v||0, 0, 5);
  const full=Math.floor(val), half=(val-full)>=0.5;
  const s="★".repeat(full)+(half?"½":"");
  return s || "½";
}
function teamStarText(t){ return starText(teamStarVal(t)); }
function teamStars(t, label){
  const o=(typeof t==="number")?t:teamOVR(t);
  const v=teamStarVal(o);
  return renderStars(v, `${label||"팀 전력"} ${v}★${o?` (선발 평균 종합 ${dispOvrRaw(o)})`:""}`);
}
/* ── FM의 두 눈금 (금색 / 은색) ────────────────────────────────────
   FM의 별점에는 눈금이 두 개 있다.
     · 금색 — 1군 눈금. 우리 팀 주전이 3~3.5개를 받도록 맞춰져 있고 0.5~5개까지 있다.
     · 은색 — 1군 눈금 "아래"를 다시 확대해서 재는 보조 눈금. 은색 5개 = 금색 0.5개다.
   그래서 은색은 아무리 많이 채워져도 금색 반 개를 넘지 못한다. 은색 5개짜리와
   금색 1개짜리가 붙으면 금색 쪽이 두 배 낫다는 뜻이다.
   은색이 붙는 건 나이 어린 유스나 한참 아래 리그 선수처럼, 1군 눈금으로는
   눈금 밑에 깔려서 아예 잴 수 없는 선수들이다. 벤치 3~4순위 정도로는 은색이 되지 않는다. */
const SILVER_TOP=0.5;    // 은색 5개가 뜻하는 금색 별 수
const SILVER_DEPTH=2.5;  // 은색 눈금이 훑는 폭 (금색 별 단위) — 이보다 더 아래는 은색 0.5개로 바닥
function starRawFromScore(score){ return STAR_MID + (score-62)/STAR_SPAN; }  // 반올림 전 연속값
/* 점수 → {은색 여부, 표시할 별 수, 금색 환산값}. 표시·정렬·비교는 전부 이걸 거친다.
   forceSilver를 주면 눈금을 강제로 고른다 — 어느 눈금을 쓸지는 "선수의 기량"이 정하고,
   포지션 적성이나 능숙도는 그 눈금 안에서 별 수만 깎게 하기 위해서다. */
function starGrade(score, forceSilver){
  const raw=starRawFromScore(score);
  const silver = (forceSilver===undefined) ? (raw<SILVER_TOP) : !!forceSilver;
  if(!silver) return {silver:false, v:clamp(Math.round(raw*2)/2, 0.5, 5), gold:clamp(raw, 0.5, 5)};
  // 1군 눈금 밑 — 은색 눈금으로 갈아탄다. raw가 SILVER_TOP이면 은색 5개, 더 내려갈수록 줄어든다.
  const s=5*(1-(SILVER_TOP-raw)/SILVER_DEPTH);
  return {silver:true, v:clamp(Math.round(s*2)/2, 0.5, 5), gold:clamp(raw, 0, SILVER_TOP)};
}
/* 어느 눈금을 쓸지는 오직 기량으로 정한다.
   1군 수준인 선수가 낯선 자리에 섰다고 은색이 되면 안 된다 — 그건 금색 반 개짜리 배치일 뿐이다. */
function abilityIsSilver(p){
  if(!p) return false;
  return starRawFromScore(62 + (playerLevel(p)-starRefLevel())*STAR_GAIN) < SILVER_TOP;
}
/* 금색·은색을 한 줄로 비교할 수 있는 값 — 정렬이나 "누가 더 낫나" 판단에 쓴다 */
function starRank(gr){ return gr.silver ? gr.v/5*SILVER_TOP : gr.v; }
function starGradeText(gr){ return gr.v+(gr.silver?"★(은색 = 금색 "+(Math.round(starRank(gr)*100)/100)+"개 수준)":"★"); }
/* v 는 숫자(항상 금색) 또는 starGrade() 결과를 받는다. */
function renderStars(v, title, p, forceGold){
  const gr = (v && typeof v==="object") ? v : {silver:false, v:clamp(v,0,5)};
  // 포지션이 낯설어서 별이 깎인 경우는 선수 자체가 나쁜 게 아니므로 은색으로 내리지 않는다.
  const silver = gr.silver && !forceGold;
  const shown = gr.v;
  const pct=Math.round((shown/5)*100);
  const tip = title || ((silver?"1군 눈금 미달 (은색) · ":"")+shown+"★");
  return `<span class="stars${silver?" silver":""}" style="--pct:${pct}%" title="${tip}">★★★★★</span>`;
}
function ovrStars(o){
  const v=ovrStarVal(o);
  return renderStars(v, `종합 ${dispOvrRaw(o)} · ${v}★`);
}
/* 선수단·벤치·이적 목록에서 쓰는 "우리 팀 주전 대비" 별.
   절대 능력치가 아니라 지금 우리 주전과 견줘 어느 정도인지를 보여준다. */
/* 잠재력 별 — 잠재치가 다 발현됐을 때 지금 우리 주전과 견줘 어느 정도인가.
   유망주가 은색으로 시작해 금색으로 자라는 FM의 그림을 재현한다. */
function potentialStars(p){
  if(!p) return "";
  const a=p.attr||{};
  let cur=playerLevel(p);
  // 능력치 평균이 ovr 과 어긋날 수 있으므로, 잠재-현재 격차를 같은 비율로 얹는다
  const gap=(p.pot||p.ovr)-(p.ovr||0);
  const lv=(cur+gap)-starRefLevel();
  const gr=starGrade(62+lv*STAR_GAIN);
  return renderStars(gr, `잠재 ${dispPot(p)} — K리그 전체 대비 ${starGradeText(gr)}${gr.silver?" · 다 자라도 아직 1군 눈금 아래":""}`, p);
}
function abilityStars(p){
  if(!p) return "";
  const lv=playerLevel(p)-starRefLevel();
  const gr=starGrade(62+lv*STAR_GAIN);
  const tip=`K리그 전체 대비 ${starGradeText(gr)}${gr.silver?" · 1군 눈금 아래 (유스·하부 리그 수준)":""} · 종합 ${dispOvr(p)} / 잠재 ${dispPot(p)}`;
  return renderStars(gr, tip, p);
}
function ovrTag(o){ return `<span class="ovr ${ovrCls(o)}">${o}</span>`; }
/* ---------- 선수 이름 팝업 (프로필/대화) ---------- */
function findAnyPlayer(pid){
  for(const id in G.teams){ const f=G.teams[id].players.find(p=>p.id===pid); if(f) return f; }
  /* 🌏 EACL 클럽 선수 — G.teams 밖에 있어서 따로 훑어야 프로필이 열린다 */
  for(const k in (G.eaclClubs||{})){
    const c=G.eaclClubs[k]; const f=c && c.t && (c.t.players||[]).find(p=>p.id===pid); if(f) return f;
  }
  return (G.freeAgents||[]).find(p=>p.id===pid) || (G.overseas||[]).find(p=>p.id===pid) || ((G.scout&&G.scout.list)||[]).find(p=>p.id===pid);
}
let PMENU=null;
function nameTag(p){ return `<span class="clickable" onclick="openPlayerMenu(event,${p.id})">${p.name}</span>`; }
function openPlayerMenu(e, pid){
  if(e){ e.stopPropagation&&e.stopPropagation(); e.preventDefault&&e.preventDefault(); }
  const p=findAnyPlayer(pid); if(!p) return;
  PMENU={pid, x:(e&&e.clientX)||40, y:(e&&e.clientY)||40};
  renderPlayerMenu();
}

/* ═══ 👤 빠른 프로필 — 전술판에서 화면을 떠나지 않고 보는 선수 카드 ═════
   ⚠ 제보 — 「전술창에서 선수 프로필을 누르면 화면이 통째로 바뀌고,
      돌아오려면 맨 위까지 스크롤해서 뒤로가기를 눌러야 한다」.
   전술을 짜다 말고 화면을 잃어버리지 않도록, 그 자리에서 뜨는 팝업으로 보여 준다.
   능력치는 FM 표기(1~20) 그대로, 색은 게임 안 다른 화면과 같은 눈금을 쓴다. */
const QP_VIEWS=["tactics","match","squad","simwatch"];   // 이 화면들에선 화면을 떠나지 않는다
/* 경기 중 전술 수정 화면은 VIEW 로 구분되지 않는다 — 그 화면에서도 절대 화면을 떠나면 안 된다 */
function qpHere(){ try{ return (typeof inLiveTactics!=="undefined" && inLiveTactics) || QP_VIEWS.indexOf(VIEW)>=0; }catch(e){ return false; } }
const QP_TECH=["tec","fin","dri","mar","thr","lon","cor","crs","tck","pas","fir","pen","fre","hea"];
const QP_MENT=["bra","ldr","det","vis","ant","otb","pos","agg","cnt","fla","cmp","tea","dec","wor"];
const QP_PHYS=["acc","bal","str","agi","jum","pac","sta","nat"];
const QP_GK  =["aer","cmd","com","ecc","han","kic","one","ref","tro","pun"];
function qpRows(p, keys){
  const a=p.attr||{}, g=p.gkA||{};
  let h="";
  for(const k of keys){
    const raw = (typeof g[k]==="number") ? g[k] : a[k];
    if(typeof raw!=="number") continue;
    const v=attr20(raw);
    h+=`<div class="qpAt"><span>${ATTR_LABEL_FM[k]||k}</span><b style="color:${fmColor(v)}">${v}</b></div>`;
  }
  return h;
}
/* 능숙도 — 화면이 좁으니 판 대신 한 줄짜리 칩으로 (0인 자리는 흐리게) */
function qpFam(p){
  if(!p.posFam) p.posFam=initPosFam(p); else migratePosFam(p);
  return FAM_POS.map(k=>{
    const v=clamp(Math.round(p.posFam[k]||0),0,100);
    const c=famColor(v);
    const on=v>0;
    return `<div class="qpFam${on?"":" off"}" title="${FAM_LABEL[k]}${on?` — ${famLevel(v).n} (${v}/100)`:" — 해 본 적 없는 자리"} · 눌러서 역할별 별점 보기"
      onclick="closeQuickProfile();showSlotRoles(${p.id},'${k}')">
      <div class="qpFamL">${FAM_LABEL[k]}</div>
      <div class="qpFamV" style="color:${on?c:"var(--sub)"}">${v}</div></div>`;
  }).join("");
}
function closeQuickProfile(){ const b=$("#gcModal"); if(b){ b.className="hidden"; b.innerHTML=""; } }
function showQuickProfile(pid){
  const p=findAnyPlayer(pid); if(!p){ return; }
  const box=$("#gcModal"); if(!box){ showPlayer(pid,"profile"); return; }
  const t=teamOfPlayer(p), ut=userTeam();
  const age=G.season-(p.by||G.season-25);
  const isGk=p.pos==="GK";
  /* 지금 판 위에서 어느 자리에 서 있는가 — 전술창에서 가장 궁금한 정보다 */
  let slotLine="";
  try{
    const sl=(ut && ut.tactic && ut.tactic.slot) ? ut.tactic.slot[p.id] : null;
    if(sl && ut.players.some(x=>x.id===p.id)){
      const fam=getPosFam(p, sl);
      const L=famLevel(fam);
      slotLine=` · 지금 <b style="color:var(--acc)">${sl} 자리</b> <span style="color:${famColor(fam)||"var(--sub)"}">(능숙도 ${fam}${fam>0?` · ${L.n}`:""})</span>`;
    }
  }catch(e){}
  const traits=(p.traits||[]).map(k=>TRAIT_BY_KEY[k]).filter(Boolean);
  box.className="";
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox qpBox">
    <div class="qpHead">
      <div style="flex:1;min-width:0">
        <div class="qpName">${p.name}${p.frn?' <span class="tag" style="background:#1f6feb33;color:#79c0ff">외국인</span>':""}${pTags(p)}</div>
        <div class="small" style="margin-top:3px;color:var(--sub)">
          <span class="pos-${p.pos}">${p.pos}</span> · 선호 <b>${prefSlotOf(p)}</b> · ${age}세 · ${p.h||"-"}cm ${p.w||"-"}kg${p.no?` · 등번호 ${p.no}`:""}${slotLine}
          ${t&&t!==ut?` · <b>${t.short}</b>`:""}</div>
      </div>
      <div style="text-align:right;white-space:nowrap">
        <div>${abilityStars(p)}</div>
        <button class="mini" style="margin-top:6px" onclick="closeQuickProfile()">닫기 ✕</button>
      </div>
    </div>
    ${traits.length?`<div class="qpTr">${traits.map(x=>`<span class="tag" style="background:#1f6feb26;color:#79c0ff" title="${x.d||""}">${x.n}</span>`).join(" ")}</div>`:""}
    <div class="qpCols">
      <div><div class="qpH">${isGk?"골키핑":"기술"}</div>${qpRows(p, isGk?QP_GK:QP_TECH)}</div>
      <div><div class="qpH">정신</div>${qpRows(p, QP_MENT)}</div>
      <div><div class="qpH">신체</div>${qpRows(p, QP_PHYS)}</div>
    </div>
    <div class="qpH" style="margin-top:12px">포지션 능숙도</div>
    <div class="qpFamWrap">${qpFam(p)}</div>
    <div class="small" style="margin-top:10px;color:var(--sub);line-height:1.5">
      능숙도는 <b>그 자리에서 제 기량이 나오는 정도</b>입니다. 낮은 자리에 세우면 판단·위치선정처럼
      자리 이해가 필요한 쪽이 크게 깎입니다. 그래도 세울 수는 있습니다.</div>
    <div class="gcBtns" style="margin-top:12px">
      <button class="gcCancel" onclick="closeQuickProfile()">닫기</button>
      ${(liveM && !liveM.done)
        ? `<span class="small" style="align-self:center;opacity:.7">경기 중에는 여기까지만 볼 수 있습니다</span>`
        : `<button class="gcOk" onclick="closeQuickProfile();showPlayer(${p.id},'profile')">👤 전체 프로필</button>`}
    </div>
  </div></div>`;
  try{ box.querySelector(".gcOverlay").onclick=(e)=>{ if(e.target.classList.contains("gcOverlay")) closeQuickProfile(); }; }catch(e){}
}
function closePlayerMenu(){
  PMENU=null;
  const el=document.getElementById("pMenu");
  if(el){ el.classList.add("hidden"); el.innerHTML=""; }
}
function renderPlayerMenu(){
  const el=document.getElementById("pMenu"); if(!el||!PMENU) return;
  const p=findAnyPlayer(PMENU.pid); if(!p){ closePlayerMenu(); return; }
  const owned=userTeam().players.some(x=>x.id===p.id);
  const listed=owned&&G.transferBids.some(b=>b.pid===p.id);
  el.classList.remove("hidden");
  // 폰트 확대(body zoom)가 걸려 있으면, 이 팝업도 그 zoom이 적용된 조상(#body) 안에 있어서
  // left/top에 넣는 값이 렌더링될 때 zoom만큼 한 번 더 곱해진다. clientX/Y는 실제 화면 픽셀
  // 기준이므로, zoom으로 나눈 "확대 전" 좌표를 넣어야 최종적으로 클릭한 지점에 정확히 뜬다.
  const zoom=getFontScale()/100;
  const vw=((typeof window!=="undefined"&&window.innerWidth)||1200)/zoom, vh=((typeof window!=="undefined"&&window.innerHeight)||800)/zoom;
  const px=PMENU.x/zoom, py=PMENU.y/zoom;
  /* ⚠ 제보 — 「전술창에서 선수 눌러보면 박스가 게임화면 크기 때문에 밑이 짤려서 나온다」.
     메뉴 높이를 210px로 어림잡아 눌렀는데, 내 선수 메뉴(프로필~방출 7줄)는 실제 300px를
     넘는다. 화면 아래쪽 선수를 누르면 어림값만큼만 올라가 '임대 보내기' 아래가 잘렸다.
     ─ 역할 메뉴(renderRoleMenu)와 같은 방식: 먼저 그리고, 실제 크기를 잰 뒤 자리를 잡는다.
       최종 위치는 innerHTML 다음의 보정 코드가 정한다. */
  el.style.left="0px"; el.style.top="0px";
  el.innerHTML=`<div class="pmHead">${nmF(p)}${pTags(p)}</div>
    <button onclick="closePlayerMenu();${qpHere()?`showQuickProfile(${p.id})`:`showPlayer(${p.id},'profile')`}">👤 프로필</button>
    ${qpHere()?"":`<button onclick="closePlayerMenu();showQuickProfile(${p.id})">🔎 간략 보기</button>`}
    ${owned?"":`<button onclick="closePlayerMenu();slToggle(${p.id})">${slHas(p.id)?"⭐ 관심 목록에서 빼기":"☆ 관심 목록에 담기"}</button>`}
    ${owned?`<button onclick="closePlayerMenu();showPlayer(${p.id},'talk')">💬 대화</button>`:""}
    ${owned?(listed?`<button onclick="closePlayerMenu();unlist(${p.id})">📤 명단 철회</button>`
                    :`<button onclick="closePlayerMenu();listForSale(${p.id});show(VIEW)">📤 이적명단 등록</button>`):""}
    ${owned&&!p.loan?`<button onclick="closePlayerMenu();openRenew(${p.id})" title="연봉·기간·출전 약속을 놓고 협상합니다">📝 재계약 협상</button>`:""}
    ${owned&&!p.loan?`<button onclick="closePlayerMenu();openLoanOut(${p.id})" title="다른 구단에 임대를 보냅니다">🔁 임대 보내기</button>`:""}
    ${owned?`<button onclick="closePlayerMenu();releasePlayer(${p.id})" title="계약 해지 (위약금: 잔여 연봉의 70%)">✂️ 방출</button>`:""}`;
  const rr=el.getBoundingClientRect?el.getBoundingClientRect():null;
  const mw=((rr&&rr.width)||170)/zoom, mh=((rr&&rr.height)||210)/zoom;
  el.style.left=Math.max(4,Math.min(px,vw-mw-6))+"px";
  el.style.top =Math.max(4,Math.min(py,vh-mh-6))+"px";
}
if(typeof document!=="undefined"&&document.addEventListener){
  document.addEventListener("click", (e)=>{
    if(!PMENU) return;
    const el=document.getElementById("pMenu");
    if(el && e.target && el.contains && el.contains(e.target)) return;
    closePlayerMenu();
  });
}
/* ---------- 선수 정보 우클릭 팝업 (브라우저 기본 우클릭 메뉴는 전역 차단하고, 대신 선수 이름 위에서
   우클릭하면 오버롤·별점·선호 포지션이 담긴 인게임 팝업이 뜨도록 한다) ---------- */
let PINFO=null;
/* ── 전술판 역할 메뉴 ── */
let RMENU=null;
function roleTagText(t,p,slot){
  const rd=getRole(t,p,slot); const R=ROLE_BY_KEY[rd.r];
  if(!R) return "";
  return `${R.k}<span class="rd">${DUTY_N[rd.d]||rd.d}</span>`;
}
function openRoleMenu(e, pid, slot){
  if(e){ e.preventDefault&&e.preventDefault(); e.stopPropagation&&e.stopPropagation(); }
  const t=userTeam(), p=t&&t.players.find(x=>x.id===pid);
  const cur=p?getRole(t,p,slot):{r:null,d:null};
  // 고르는 동안에는 실제 전술을 건드리지 않는다 — 적용을 눌러야 반영된다(FM과 같다)
  RMENU={pid, slot, x:(e&&e.clientX)||40, y:(e&&e.clientY)||40, pick:{r:cur.r, d:cur.d}, base:{r:cur.r, d:cur.d}};
  renderRoleMenu();
  return false;
}
function closeRoleMenu(){
  RMENU=null;
  const el=document.getElementById("roleMenu");
  if(el){ el.classList.add("hidden"); el.innerHTML=""; }
}
/* 왼쪽 목록에서 역할을 고른다 — 아직 반영하지 않고 패널 안에서만 바뀐다 */
function rmPickRole(rk){
  if(!RMENU) return;
  const R=ROLE_BY_KEY[rk]; if(!R) return;
  const d=R.duty.includes(RMENU.pick.d) ? RMENU.pick.d : R.duty[Math.min(1,R.duty.length-1)];
  RMENU.pick={r:rk, d};
  renderRoleMenu();
}
/* 임무(수비·지원·공격)도 고르기만 한다 */
function rmPickDuty(dk){
  if(!RMENU) return;
  const R=ROLE_BY_KEY[RMENU.pick.r]; if(!R) return;
  RMENU.pick={r:RMENU.pick.r, d:R.duty.includes(dk)?dk:R.duty[0]};
  renderRoleMenu();
}
/* 적용 — 여기서 처음으로 실제 전술에 반영된다 */
function rmApply(){
  if(!RMENU) return;
  const pid=RMENU.pid, r=RMENU.pick.r, d=RMENU.pick.d;
  setRole(pid, r, d);
}
function setRole(pid, rk, dk){
  const t=userTeam();
  if(!t.tactic.role) t.tactic.role={};
  const R=ROLE_BY_KEY[rk]; if(!R) return;
  const d = R.duty.includes(dk) ? dk : R.duty[0];
  t.tactic.role[pid]={r:rk, d};
  rememberRole(t, pid, rk, d);        // 🧠 벤치에 갔다 와도, 다른 자리를 거쳤다 와도 그대로
  saveGame(); closeRoleMenu();
  if(typeof refreshTactics==="function") refreshTactics(); else show("tactics");
}
function renderRoleMenu(){
  const el=document.getElementById("roleMenu"); if(!el) return;
  if(!RMENU){ el.classList.add("hidden"); el.innerHTML=""; return; }
  const t=userTeam();
  const p=t.players.find(x=>x.id===RMENU.pid);
  if(!p){ closeRoleMenu(); return; }
  const slot=RMENU.slot;
  const saved=getRole(t,p,slot);
  if(!RMENU.pick) RMENU.pick={r:saved.r, d:saved.d};
  if(!RMENU.base) RMENU.base={r:saved.r, d:saved.d};
  const cur=RMENU.pick;            // 화면은 "지금 고른 것"을 보여 준다
  const list=rolesSortedFor(p, slot);   // 🎓 익숙한 역할이 위로 (제보)
  const rows=list.map(R=>{
    const fit=roleFit(p,R.k);
    const on=R.k===cur.r;
    const duties=R.duty.map(d=>
      `<button class="rdBtn ${on&&cur.d===d?'sel':''}" onclick="event.stopPropagation();setRole(${p.id},'${R.k}','${d}')">${DUTY_N[d]||d}</button>`).join("");
    return `<div class="rItem ${on?'on':''}">
      <div class="rHead"><b>${R.n}</b> <span class="small">${R.e}</span></div>
      <div class="rFit">${roleStars(fit)} <span class="small">${fit.toFixed(1)}</span></div>
      <div class="rDuty">${duties}</div></div>`;
  }).join("");
  const curR=ROLE_BY_KEY[cur.r];
  const fam=getPosFam(p, slot);
  const famCol = fam>=90?"#3fb950" : fam>=60?"#56d364" : fam>=30?"#d29922" : "#f85149";
  const famTxt = fam>=90?"자연스러움" : fam>=60?"능숙함" : fam>=30?"어색함" : "해본 적 없음";
  // 왼쪽 = 역할 목록, 오른쪽 = 임무 선택 + 설명 + 지시 사항
  /* 🎓 역할마다 「얼마나 해봤는가」를 함께 보여 준다 — 별(적합도)은 능력치, 막대는 경험이다 */
  const roleList=list.map(R=>{
    const fit=roleFit(p,R.k), on=R.k===cur.r;
    const rv=getRoleFam(p,R.k), rl=roleFamLevel(rv);
    return `<div class="rpItem ${on?'on':''}" onclick="rmPickRole('${R.k}')" title="${R.n} — 적합도 ${fit.toFixed(1)}★ · 역할 능숙도 ${rv} (${rl.n})">
      <span class="rpStars">${roleStars(fit)}</span>
      <span class="rpName">${R.n}</span>
      <span class="rfBar"><i style="width:${rv}%;background:${rl.c}"></i></span>
      <span class="rfTag" style="color:${rl.c}">${rl.n}</span></div>`;
  }).join("");
  const duties=(curR?curR.duty:["S"]).map(d=>
    `<button class="rpDuty ${cur.d===d?'sel':''}" onclick="event.stopPropagation();rmPickDuty('${d}')">
      <span class="rpStars">${roleStars(roleFit(p,cur.r))}</span> ${DUTY_N[d]||d}</button>`).join("");
  const dirty = RMENU.base.r!==cur.r || RMENU.base.d!==cur.d;
  const fx=curR&&curR.fx?curR.fx(cur.d):{};
  const hints=[];
  if(fx.fwd>0.5) hints.push("적극적으로 전진하라");
  if(fx.hold) hints.push("공을 지켜라");
  if(fx.killer) hints.push("과감하게 찔러라");
  if(fx.wide>0.5) hints.push("측면을 넓게 써라");
  if(fx.boxPlayer) hints.push("박스 안에 머물러라");
  if(fx.lateRun) hints.push("뒤늦게 침투하라");
  if(fx.sweep>0.4) hints.push("적극적으로 나와라");
  if(fx.aerialTarget) hints.push("공중볼을 노려라");
  if(!hints.length) hints.push("포지션을 지켜라");
  el.innerHTML=`<div class="rpHead">
      <span class="rpTag">포지션</span><b>${SLOT_LABEL[slot]||slot}</b>
      <span class="rpFam">${SLOT_LABEL[slot]||slot} 친숙도:
        <span class="fmDot" style="background:${famCol}"></span> <b style="color:${famCol}">${famTxt}</b></span>
      <button class="mini" onclick="closeRoleMenu()">✕</button></div>
    <div class="rpSay">${p.name} 선수는 이 자리에서 아래 역할을 맡습니다.</div>
    <div class="rpBody">
      <div class="rpLeft">${roleList}</div>
      <div class="rpRight">
        <div class="rpDuties">${duties}</div>
        <div class="rpDesc"><b>${curR?curR.n:"-"}</b> <span class="small">${curR?curR.e:""}</span>
          <div class="small" style="margin-top:4px">적합도 ${roleFit(p,cur.r).toFixed(1)} / 5 — 능력치가 이 역할에 얼마나 맞는지입니다.</div>
          ${(()=>{ const rv=getRoleFam(p,cur.r), rl=roleFamLevel(rv);
            const lose=Math.round((1-roleFamMul(rv))*100);
            return `<div class="small" style="margin-top:3px">역할 능숙도 <b class="rfTag" style="color:${rl.c}">${rv} · ${rl.n}</b>
              <span class="rfBar" style="display:inline-block;vertical-align:middle;margin:0 0 1px 5px"><i style="width:${rv}%;background:${rl.c}"></i></span>
              ${lose>2?` — 아직 손에 익지 않아 <b style="color:${rl.c}">약 ${lose}%</b>를 못 냅니다. 이 역할로 뛸수록 오릅니다.`
                      :" — 몸에 배어 있습니다. 능력치를 그대로 씁니다."}</div>`; })()}</div>
        <div class="rpHint"><span class="small">지시 사항</span><div>${hints.map(h=>`<span class="rpH">${h}</span>`).join("")}</div></div>
        <div class="rpFoot">
          ${dirty?`<span class="rpChg">${ROLE_BY_KEY[RMENU.base.r]?ROLE_BY_KEY[RMENU.base.r].n:"-"} · ${DUTY_N[RMENU.base.d]||""}
             → <b>${curR?curR.n:"-"} · ${DUTY_N[cur.d]||cur.d}</b></span>`:`<span class="small">역할이나 임무를 골라 보세요.</span>`}
          <span class="rpBtns">
            <button class="mini" onclick="closeRoleMenu()">취소</button>
            <button class="mini rpApply ${dirty?"on":""}" ${dirty?"":"disabled"} onclick="rmApply()">✔ 적용</button>
          </span>
        </div>
      </div>
    </div>`;
  el.classList.remove("hidden");
  /* 위치 보정 — 설정의 "폰트 크기"는 document.body.style.zoom 으로 구현돼 있다.
     그래서 이 메뉴가 놓이는 좌표계는 zoom 배율만큼 늘어나 있는데, clientX/Y 는 실제 화면
     픽셀이다. 예전 코드는 window.__zoom 이라는 존재하지 않는 값을 봐서 배율이 늘 1이었고,
     결과적으로 폰트를 키울수록 메뉴가 클릭 지점에서 점점 멀리 떨어져 나타났다.
     getBoundingClientRect() 역시 확대된 실제 픽셀을 돌려주므로 함께 나눠 줘야 한다. */
  el.style.left="0px"; el.style.top="0px";
  const z=(typeof getFontScale==="function" ? getFontScale()/100 : 1) || 1;
  const rr=el.getBoundingClientRect();
  const rw=rr.width/z, rh=rr.height/z;
  let x=RMENU.x/z, y=RMENU.y/z;
  const vw=window.innerWidth/z, vh=window.innerHeight/z;
  if(x+rw>vw-8) x=Math.max(8, vw-rw-8);
  if(y+rh>vh-8) y=Math.max(8, vh-rh-8);
  el.style.left=x+"px"; el.style.top=y+"px";
}
function showPlayerInfoPopup(e, pid){
  if(e){ e.preventDefault&&e.preventDefault(); e.stopPropagation&&e.stopPropagation(); }
  const p=findAnyPlayer(pid); if(!p) return false;
  PINFO={pid, x:(e&&e.clientX)||40, y:(e&&e.clientY)||40};
  renderPlayerInfoPopup();
  return false;
}
function closePlayerInfoPopup(){
  closeRoleMenu();
  PINFO=null;
  const el=document.getElementById("pInfo");
  if(el){ el.classList.add("hidden"); el.innerHTML=""; }
}
function renderPlayerInfoPopup(){
  const el=document.getElementById("pInfo"); if(!el||!PINFO) return;
  const p=findAnyPlayer(PINFO.pid); if(!p){ closePlayerInfoPopup(); return; }
  el.classList.remove("hidden");
  // renderPlayerMenu와 동일한 이유로 zoom 보정이 필요하다 (자세한 설명은 그쪽 주석 참고).
  const zoom=getFontScale()/100;
  const vw=((typeof window!=="undefined"&&window.innerWidth)||1200)/zoom, vh=((typeof window!=="undefined"&&window.innerHeight)||800)/zoom;
  const px=PINFO.x/zoom, py=PINFO.y/zoom;
  // 포지션별 별점 목록은 길어질 수 있으니 팝업이 화면 밖으로 나가지 않게 여유를 더 준다
  const rows=positionStarRows(p);
  // 선수 메뉴와 같은 제보(밑 짤림) — 어림값(120+22×줄수) 대신 그린 뒤 실제 높이로 자리를 잡는다
  el.style.left="0px"; el.style.top="0px";
  const rowHtml=rows.map(r=>
    `<div class="pInfoRow${r.pref?" pref":""}">
       <span class="piDot" style="background:${famColor(r.fam)||"#30363d"}"></span>
       <span class="piPos">${r.slot}</span>
       <span class="piStar">${renderStars(r.gr, `${SLOT_LABEL[r.slot]||r.slot} ${starGradeText(r.gr)} · 능숙도 ${r.fam} ${r.L.n}`, p)}</span>
       <span class="piFam" style="color:${r.L.c}">${r.fam}</span>
     </div>`).join("");
  el.innerHTML=`<div class="pmHead">${p.no?`<span style="color:var(--sub)">#${p.no}</span> `:""}${nmF(p)}${pTags(p)}</div>
    <div class="pInfoBody">
      포지션: <b class="pos-${p.pos}">${p.pos}</b>${p.prefPos&&p.prefPos!==p.pos?` <span class="small">(선호: ${p.prefPos})</span>`:''}<br>
      <span class="small">${birthText(p)} · ${p.h||178}cm / ${p.w||74}kg${p.natl?` · 🌐 ${p.natl}`:""}</span>${p.realName?`<br><span class="small" style="opacity:.75">본명 ${p.realName}</span>`:""}<br>
      오버롤: <b>${dispOvr(p)}</b> · ${abilityStars(p)}
      <span class="small" style="display:block;opacity:.6;font-family:monospace">🆔 ${p.uid||"-"}</span>
      <div class="pInfoSep">포지션별 별점 <span class="small">(능숙도 반영)</span></div>
      ${rows.length?`<div class="pInfoList">${rowHtml}</div>`:'<div class="small">소화 가능한 자리가 없습니다.</div>'}
      ${G.jobless?"":`<button class="mini" style="display:block;width:100%;margin-top:8px;border-color:var(--gold);color:var(--gold);font-weight:800"
        onclick="closePlayerInfoPopup();showQuickProfile(${p.id})">🔎 상세 프로필 보기 <span class="small">— 능력치 · 능숙도</span></button>`}
    </div>`;
  const rr=el.getBoundingClientRect?el.getBoundingClientRect():null;
  const mw=((rr&&rr.width)||260)/zoom, mh=((rr&&rr.height)||Math.min(120+rows.length*22,420))/zoom;
  el.style.left=Math.max(4,Math.min(px,vw-mw-6))+"px";
  el.style.top =Math.max(4,Math.min(py,vh-mh-6))+"px";
}
if(typeof document!=="undefined"&&document.addEventListener){
  // 브라우저 기본 우클릭 메뉴는 전역 차단. 선수 칩 위에서는 개별 oncontextmenu가
  // 먼저 실행되며 stopPropagation() 하므로 여기까지 도달하지 않는다 — 그 외 지점에서
  // 우클릭하면 열려 있던 정보 팝업만 정리한다.
  document.addEventListener("contextmenu", (e)=>{
    e.preventDefault();
    if(Date.now()-(window.__lpAt||0) < 900) return;   // 방금 롱프레스로 연 팝업은 건드리지 않는다
    closePlayerInfoPopup();
  });
  document.addEventListener("click", (e)=>{
    if(!PINFO) return;
    const el=document.getElementById("pInfo");
    if(el && e.target && el.contains && el.contains(e.target)) return;
    closePlayerInfoPopup();
  });
}
function pTags(p){
  let s="";
  /* 🚑 어디를 다쳤는지까지 말한다 (요청) */
  if(p.inj>0) s+=` <span class="tag inj" title="${(function(){ try{ const C=INJ_CAUSE[p.injC];
      return (C?C.tell+" ":"")+(injTypeOf(p)?injTypeOf(p).n:"부상"); }catch(e){ return "부상"; } })()}">${
      (function(){ try{ const T=injTypeOf(p); return T?`${T.ic} ${T.n} ${p.inj}주`:`부상 ${p.inj}주`; }catch(e){ return `부상 ${p.inj}주`; } })()}</span>`;
  /* 💊 진통제로 뛰는 중 — 명단에 들어가지만 정상 몸이 아니다 (요청) */
  try{ if(painOn(p)) s+=` <span class="tag" style="color:#ff9d5c;border:1px solid #a63" title="진통제 처방 — 다음 한 경기만 · 재발 위험 ${Math.round(painBreakP(p)*100)}% · 컨디션 상한 72">💊 진통제</span>`; }catch(e){}
  /* ⚠ 제보 — 「출장정지(몇 경기)가 아니라 그냥 정지라고만 떠서 언제 풀리는지 알 수 없다」
     🟥 ⚠ 제보 — 「대회가 다르면 정지가 걸리지 않는데도 계속 정지로 표기된다」.
        다음 경기에 실제로 걸리는 정지만 붉게 세우고, 다른 대회의 정지는 「그 대회에서만」이라고
        회색으로 따로 적는다 — 감독이 언제 못 쓰는지는 알아야 하니 지우지는 않는다. */
  s+=(function(){
    try{
      if(p._banL!=null || p._banLC!=null){    // 대회 경기 진행 중 — 지금 ban 자리가 그 대회 장부
        return p.ban>0 ? ` <span class="tag inj">출전정지 ${p.ban}경기</span>` : "";
      }
      const C=(typeof BAN_CTX!=="undefined")?BAN_CTX:"league";
      const LB={league:"리그", eacl:(typeof eaclShort==="function"?eaclShort():"EACL"),
                cwc:(typeof cwcShort==="function"?cwcShort():"CWC"), friendly:"연습경기"};
      const list=[{k:"league",n:p.ban|0},{k:"eacl",n:p.banE|0},{k:"cwc",n:p.banC|0}].filter(x=>x.n>0);
      if(!list.length) return "";
      let out="";
      const hit=list.find(x=>x.k===C);
      if(hit) out+=` <span class="tag inj" title="${p.banNew&&hit.k==="league"?"이번 경기부터 적용됩니다":"남은 출전정지 경기 수"}">${LB[hit.k]} 출전정지 ${hit.n}경기${(p.banNew&&hit.k==="league")?" (다음 경기부터)":""}</span>`;
      const rest=list.filter(x=>x!==hit);
      if(rest.length) out+=` <span class="tag" style="background:#2a3038;color:#a9b4c0" title="다음 경기(${LB[C]||"리그"})에는 출전할 수 있습니다 — 해당 대회에서만 정지입니다">${rest.map(x=>`${LB[x.k]} ${x.n}경기 정지`).join(" · ")}</span>`;
      return out;
    }catch(e){ return p.ban>0?` <span class="tag inj">출전정지 ${p.ban}경기</span>`:""; }
  })();
  if(p.army && p.army.out){ const d=armyDaysLeft(p);
    if(d!=null && d>0) s+=` <span class="tag" style="background:#3a4a2a;color:#a8e04a" title="${p.army.out} 전역 · 원소속 ${p.army.own&&G.teams[p.army.own]?G.teams[p.army.own].short:"무소속"}">🎖️ 전역 D-${d}</span>`; }
  if(p.sulk>0) s+=' <span class="tag inj">태업</span>';
  if(p.noMove) s+=' <span class="tag u22">잔류 선언</span>';
  if(p.emg) s+=' <span class="tag" style="background:#8b3a1a33;color:#ff9d5c" title="스쿼드가 모자라 유스에서 급히 올린 선수">🚨 긴급 등록</span>';
  if(p.ovr>=77) s+=' <span class="tag star">★</span>';
  return s;
}
function divName(d){ return compShort(d===1?"k1":"k2"); }
/* 좌측 상단 구단 뱃지의 소속 줄 — 리그에 더해 이번 시즌 나가는 대회를 함께 적는다.
   (「개리그1 · EACL 2026 시즌」처럼) */
function badgeCompLine(t){
  const parts=[divName(t.div)];
  try{
    if(eaclOn() && !G.jobless && G.eacl.teams.indexOf(t.id)>=0){
      const st=(G.eacl.stage==="end" && G.eacl.champ===t.id) ? " 🏆"
             : (G.eacl.stage==="qf"||G.eacl.stage==="sf"||G.eacl.stage==="f") ? " "+eaclStageLabel() : "";
      parts.push(eaclShort()+st);   // 연도는 줄 끝의 「{시즌}」과 겹치므로 대회명에서는 뺀다
    }
  }catch(e){}
  return parts.join(" · ")+` · ${G.season} 시즌`;
}
function divFullName(d){ return compName(d===1?"k1":"k2"); }
