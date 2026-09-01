"use strict";
/* ---------- 스쿼드 ---------- */
function moodIcon(p){
  if(p.sulk>0) return "🤬";
  if(p.unhappy>=3) return "🚨"; if(p.unhappy>0) return "😠";
  return p.morale>=82?"😄":p.morale>=68?"🙂":p.morale>=52?"😐":"😞";
}
/* ═══════════════════════════════════════════════════════════════
   🚫 마우스를 얹고 가만히 두면 뜨는 브라우저 기본 툴팁을 전부 끈다(요청).
   title 속성은 CSS 로 막을 수 없고, 화면 곳곳에서 문자열로 만들어지므로
   렌더 지점마다 지우는 건 현실적이지 않다. 툴팁은 마우스가 얹힌 뒤 잠시 있다가
   뜨므로, 얹히는 순간(mouseover) 속성을 걷어내면 애초에 뜨지 않는다.
   조상 요소까지 훑는 이유 — title 이 부모(td·tr)에 걸려 있어도 툴팁은 뜬다. */
(function killTitleTips(){
  const strip=(e)=>{
    let n=e.target;
    for(let i=0; i<8 && n && n.nodeType===1; i++, n=n.parentElement){
      if(n.hasAttribute && n.hasAttribute("title")) n.removeAttribute("title");
    }
  };
  document.addEventListener("mouseover", strip, true);
  document.addEventListener("touchstart", strip, true);   // 길게 눌러도 뜨지 않게
})();
/* 스쿼드 정렬 — 열 제목을 누르면 그 기준으로 줄을 세운다. 같은 열을 다시 누르면 오름/내림이 뒤집힌다. */
let squadSort={k:"pos", dir:1};
function setSquadSort(k){
  if(squadSort.k===k) squadSort.dir*=-1;
  else squadSort={k, dir:1};
  show("squad");
}
const SQUAD_KEY={
  no:  p=>p.no||999,
  pos: p=>posSortIdx(p),                          // 🧭 제보 — 전술 탭과 같은 세부 자리 차례
  name:p=>p.name,
  mor: p=>p.morale||0,
  aff: p=>aff(p),
  age: p=>G.season-p.by,
  /* ⚠ 별점 열은 dispOvr(포지션 가중 CA)로 정렬하면 안 된다. dispOvr 은 수비수의 태클·마크에
     큰 가중을 주는 식이라, 화면에 찍히는 별(playerLevel = 능력치 단순 평균 기준)과 순서가 다르다.
     실제로 dispOvr 순서로는 175→4.5★, 172→5★, 169→3★ 처럼 뒤죽박죽이었다.
     별을 만드는 값(starRank)을 그대로 정렬키로 쓴다 — 보이는 것과 정렬이 일치해야 한다. */
  ovr: p=>{ const gr=starGrade(62+(playerLevel(p)-starRefLevel())*STAR_GAIN);
            return starRank(gr)*1000 + playerLevel(p); },
  cond:p=>p.cond||0,
  apps:p=>(p.goals||0)*3+(p.assists||0)*2+(p.apps||0)*0.1,
  rate:p=>p.apps?p.seasonRating:-1,
  wage:p=>p.wage||0,
  ct:  p=>p.ct||1,
  val: p=>marketValue(p)
};
function squadSorted(list){
  const f=SQUAD_KEY[squadSort.k]||SQUAD_KEY.pos;
  const d=squadSort.dir;
  // 기본값(포지션·이름·등번호)은 작은 값이 위로, 나머지 수치는 큰 값이 위로 오는 게 자연스럽다
  const asc = (squadSort.k==="pos"||squadSort.k==="name"||squadSort.k==="no");
  return [...list].sort((a,b)=>{
    const x=f(a), y=f(b);
    let r = (typeof x==="string") ? String(x).localeCompare(String(y)) : (x-y);
    if(!asc) r=-r;
    return r*d || (playerLevel(b)-playerLevel(a));
  });
}
function squadTh(k, label, title){
  const on=squadSort.k===k;
  return `<th class="clickable" title="${title||label} 기준 정렬" onclick="setSquadSort('${k}')"
    style="${on?"color:var(--gold)":""}">${label}${on?(squadSort.dir>0?" ▾":" ▴"):""}</th>`;
}
/* FM식 포지션 필터 — 그룹(GK/DF/MF/FW) 또는 세부 자리(LB·CB·DM·ST …)로 거른다.
   세부 자리는 "그 자리를 소화할 수 있는가"(능숙도 55+)로 본다 — 주 포지션만 보면
   LB 요원을 찾을 때 능숙한 백업 멀티 자원이 안 보인다. */
let SQ_POSF="all";
function sqSetPosF(v){ SQ_POSF=v||"all"; show("squad"); }
const SQ_SLOT_LIST=["GK","LB","CB","RB","LWB","RWB","DM","CM","LM","RM","CAM","LW","RW","ST"];
function sqPosFilter(list){
  const f=SQ_POSF;
  if(!f || f==="all") return list;
  if(f==="GK"||f==="DF"||f==="MF"||f==="FW") return list.filter(p=>p.pos===f);
  // 세부 자리 — 소화 가능(55+)한 선수를 그 자리 능숙도 순으로
  return list.filter(p=>getPosFam(p,f)>=55)
             .sort((a,b)=>getPosFam(b,f)-getPosFam(a,f) || playerLevel(b)-playerLevel(a));
}
function sqPosFBar(){
  const chip=(v,l)=>`<button class="mini ${SQ_POSF===v?"sel":""}" style="padding:3px 10px;font-size:11.5px" onclick="sqSetPosF('${v}')">${l}</button>`;
  return `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
    ${chip("all","전체")}${chip("GK","GK")}${chip("DF","DF")}${chip("MF","MF")}${chip("FW","FW")}
    <select onchange="sqSetPosF(this.value)" style="font-size:11.5px;padding:3px 6px">
      <option value="">— 세부 포지션 —</option>
      ${SQ_SLOT_LIST.map(s=>`<option value="${s}" ${SQ_POSF===s?"selected":""}>${s} · ${SLOT_LABEL[s]||s}</option>`).join("")}
    </select>
    ${SQ_SLOT_LIST.includes(SQ_POSF)?`<span class="small">— <b>${SQ_POSF}</b>를 소화할 수 있는 선수(능숙도 55+), 그 자리 능숙도 순</span>`:""}
  </div>`;
}
/* 🔢 등번호 전체 재배정 — ⚠ 제보: 「등번호가 뒤죽박죽일 때 일괄로 지우고 다시 매기게 해달라」.
   임대·군복무로 나가 있는 선수의 번호는 비워 두고(돌아올 자리), 영구결번도 지킨다. */
function renumberSquad(){
  const t=userTeam(); if(!t) return;
  showConfirm(`<b>🔢 등번호 전체 재배정</b>\n\n선수단 전원의 등번호를 비우고, 능력치 순으로 포지션 관행 번호\n(GK 1번 · 주전 2~11번…)를 새로 배정합니다.\n임대·군복무 중인 선수의 번호와 영구결번은 그대로 둡니다.`,
    ()=>{
      /* 나가 있는 선수 번호는 자리 표시용 더미로 지켜 둔다 — 돌아왔을 때 겹치지 않게 */
      let outs=[];
      try{ outs=loanedOut(t).concat(armySentOut(t)).map(x=>x&&x.p).filter(p=>p&&p.no)
             .map(p=>({no:p.no, ovr:0, pos:"MF", _numStub:1})); }catch(e){ outs=[]; }
      for(const p of t.players) p.no=0;
      for(const s of outs) t.players.push(s);
      try{ assignNumbers(t); }catch(e){}
      t.players=t.players.filter(x=>!x._numStub);
      flash("🔢 등번호를 능력치 순으로 다시 배정했습니다. 개별 수정은 번호 칸을 누르세요.","good");
      saveGame(); show("squad");
    },
    {okLabel:"재배정", cancelLabel:"취소"});
}
function squad(){
  // 스쿼드를 열면 새 부상 알림은 확인된 것으로 본다(부상 자체는 계속 표시된다)
  for(const p of userTeam().players){ if(p.inj>0) p._injSeen=true; else if(p._injSeen) delete p._injSeen; }
  const t=userTeam();
  const hit=sqPosFilter(attrQActive().length ? t.players.filter(attrQPass) : t.players);
  const slotF=SQ_SLOT_LIST.includes(SQ_POSF)?SQ_POSF:null;
  const rows=(slotF?hit:squadSorted(hit))
   .map(p=>`<tr><td class="small numCell clickable" title="등번호 지정" onclick="openNumberPicker(${p.id})">${p.no||"-"}</td><td class="pos-${p.pos}" title="${p.pos}"><b>${prefSlotOf(p)}${slotF?` <span class="small" style="color:${famLevel(getPosFam(p,slotF)).c}">${SQ_POSF} ${getPosFam(p,slotF)}</span>`:""}</b></td>
   <td class="clickable" onclick="openPlayerMenu(event,${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})">${nmF(p)}${pTags(p)}</td>
   <td>${moodIcon(p)} ${mor(p.morale)}</td>
   <td title="감독 개인 호감도 ${Math.round(aff(p))}/100">${affLabel(aff(p)).ic} <span style="color:${affLabel(aff(p)).c};font-weight:700">${Math.round(aff(p))}</span></td>
   <td title="${birthText(p)} · ${p.h||178}cm/${p.w||74}kg">${G.season-p.by}세</td><td>${abilityStars(p)}</td><td>${mor(p.cond)}%</td>
   <td>${p.apps}경기 ${p.goals}골 ${p.assists}도움</td><td>${p.apps?p.seasonRating.toFixed(2):"-"}</td>
   <td class="small">${p.wage}억</td>
   <td class="small"><b style="color:${(p.ct||1)<=1?"var(--red)":(p.ct||1)<=2?"var(--gold)":"var(--sub)"}">${p.ct||1}년</b>${p.loan?' <span class="tag" style="background:#8957e522;color:#d2a8ff">임대</span>':""}</td>
   <td class="small">${marketValue(p)}억</td></tr>`).join("");
  return `<h2>👥 스쿼드 (${t.players.length}명 · 외국인 ${t.players.filter(p=>p.frn).length}명)</h2>
  <div class="msg info">선수 이름 클릭 = <b>개인 면담 · 이적명단 등록 · 방출</b> 메뉴 · 😠 불만 방치 시 이적 요청, 🤬 태업
    <button class="mini" style="margin-left:8px" onclick="renumberSquad()" title="전원 번호를 비우고 능력치 순으로 다시 배정합니다">🔢 등번호 재배정</button></div>
  ${sqPosFBar()}
  ${attrQBox()}
  ${SQ_POSF!=="all"?`<div class="psCount">필터 <b>${SQ_POSF}</b> — <b>${hit.length}명</b> / 전체 ${t.players.length}명</div>`:""}
  ${attrQActive().length?`<div class="psCount">조건에 맞는 선수 <b>${hit.length}명</b> / 전체 ${t.players.length}명</div>`:""}
  <div class="card"><div class="tblScroll"><table><tr>
    ${squadTh("no","#","등번호")}${squadTh("pos","포지션")}${squadTh("name","이름")}
    ${squadTh("mor","사기")}${squadTh("aff","호감도")}${squadTh("age","나이")}
    ${squadTh("ovr","능력","별점")}${squadTh("cond","컨디션")}${squadTh("apps","시즌 기록","공격 포인트")}
    ${squadTh("rate","평점")}${squadTh("wage","연봉")}${squadTh("ct","계약","잔여 계약 기간")}${squadTh("val","가치","시장 가치")}
  </tr>${rows}</table></div></div>`;
}
