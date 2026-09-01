"use strict";
/* ---------- 순위표 ---------- */
function tableView(){
  /* 🌏 다음 시즌 EACL 진출권 — 한국 배정은 3장이다.
     EACL 우승 클럽이 K리그 팀이면 리그 성적과 무관하게 자동 진출하고, 그만큼 리그 3위가 밀린다.
     순위표는 「지금 이 순위가 유지되면 누가 나가는가」를 그대로 보여 준다. */
  const eaclSlots=(tbl)=>{
    const out={ids:[], champId:null, pushed:null};
    try{
      const ch=(G.eacl && G.eacl.champ && G.teams[G.eacl.champ]) ? G.eacl.champ : null;
      const lg=tbl.slice(0,3).map(t=>t.id);
      if(ch && lg.indexOf(ch)<0){
        out.champId=ch;
        out.ids=[ch, lg[0], lg[1]].filter(Boolean);
        out.pushed=lg[2]||null;                       // 챔피언에게 밀려난 리그 3위
      } else {
        if(ch) out.champId=ch;
        out.ids=lg;
      }
    }catch(e){}
    return out;
  };
  const mk=(div)=>{
    const tbl=tableOf(div);
    const ES = div===1 ? eaclSlots(tbl) : {ids:[], champId:null, pushed:null};
    /* 🅰️🅱️ 스플릿이 갈린 뒤에는 두 그룹을 박스로 나눠 그린다 — 2026 시즌 한정 */
    const SPL=(div===1 && G.splitDone && splitOn() && Array.isArray(G.finalA) && G.finalA.length
               && G.finalA.length<tbl.length) ? G.finalA.length : 0;
    const splLeft=(()=>{ try{ return Math.max(0, (G.k1Fix||[]).length-(G.r1||0)); }catch(e){ return 0; } })();
    return `<div class="card"><h3>${divName(div)} ${SPL?`<span style="color:var(--gold)">— 파이널 라운드${splLeft?` (${splLeft}R 남음)`:""}</span>`:""}</h3>
    ${SPL?`<div class="msg info" style="margin-bottom:8px">📊 <b>스플릿 이후에는 그룹이 순위를 가릅니다.</b>
      파이널 A 6팀이 승점과 무관하게 <b>1~6위</b>, 파이널 B 6팀이 <b>7~12위</b>입니다.
      남은 경기는 <b>같은 그룹끼리만</b> 치릅니다.</div>`:""}
    <div class="tblScroll"><table><tr><th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th><th>폼</th></tr>
    ${tbl.map((t,i)=>{
      /* ⚠ 승강 규정이 시즌마다 다르다 — 2026(확대 시즌)은 김천 확정 강등 + 최하위만 조건부 승강PO,
         2027부터는 팀 수(14팀)에 맞춰 최하위 자동 강등 + 그 위 두 자리가 승강PO. 하드코딩 금지. */
      let cls="";
      const last=tbl.length-1;
      if(div===1){
        const inEacl = ES.ids.indexOf(t.id)>=0;
        if(isExpansionSeason()){
          cls = i===0?"rank-champ":inEacl?"rank-acl":"";
          if(t.id==="gimcheon") cls="rank-rel";                    // 2026 승강 규정 — 성적 무관 강등
          else if(i===last) cls="rank-po";                         // 최하위 — PO 준우승팀과 승강PO
        } else {
          cls = i===0?"rank-champ":inEacl?"rank-acl":(i===last-2||i===last-1)?"rank-po":i===last?"rank-rel":"";
        }
      }
      else {
        cls = isExpansionSeason()
          ? (i<=1?"rank-champ":(i>=2&&i<=5)?"rank-po":"")          // 2026 — 1·2위 자동 승격, 3~6위 PO
          : (i===0?"rank-champ":(i>=1&&i<=4)?"rank-po":"");
      }
      /* 구역 딱지 — 색만으로 구분하지 않는다(제보: 노랑과 주황이 안 갈렸다) */
      const RK={ "rank-champ":[div===1?"우승":"승격","champ"], "rank-acl":[eaclShort(),"acl"],
                 "rank-po":["PO","po"], "rank-rel":["강등","rel"] }[cls];
      const rkTag = RK ? `<span class="rkTag ${RK[1]}">${RK[0]}</span>` : "";
      const splHead = !SPL ? ""
        : i===0   ? `<tr class="splHead splA"><td colspan="9">🅰️ 파이널 A <span class="small">우승 · ${eaclShort()} 진출 경쟁 (1~6위)</span></td></tr>`
        : i===SPL ? `<tr class="splHead splB"><td colspan="9">🅱️ 파이널 B <span class="small">잔류 · 강등 싸움 (7~12위)</span></td></tr>` : "";
      const splCls = !SPL ? "" : (i<SPL?" inA":" inB") + (i===tbl.length-1?" splLast":"");
      return splHead + `<tr class="${cls}${splCls}" style="${t.isUser?'font-weight:700':''}">
      <td style="white-space:nowrap">${i+1}${rkTag}</td><td class="clickable" title="스쿼드 보기" onclick="openTeamSquad('${t.id}')" style="text-decoration:underline dotted; text-underline-offset:3px">${t.name}${(function(){
        if(div!==1) return "";
        const b=[];
        try{ if(eaclOn() && G.eacl.teams.indexOf(t.id)>=0) b.push(`<span class="tag" style="background:#1f6feb22;color:#79c0ff" title="올 시즌 ${eaclName()} 참가 중">🌏</span>`); }catch(e){}
        if(ES.champId===t.id) b.push(`<span class="tag" style="background:#d2992222;color:var(--gold)" title="${eaclShort()} 우승 — 다음 시즌 자동 진출">🏆</span>`);
        if(ES.pushed===t.id) b.push(`<span class="tag" style="background:#f8514922;color:#ff9d95" title="${eaclShort()} 챔피언 자동 진출로 진출권이 밀렸습니다">↘</span>`);
        return b.length?" "+b.join(""):"";
      })()}</td><td>${t.W+t.Dw+t.L}</td><td>${t.W}</td><td>${t.Dw}</td><td>${t.L}</td>
      <td>${t.GF-t.GA>0?"+":""}${t.GF-t.GA}</td><td><b>${t.Pts}</b></td>
      <td>${t.form.slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")}</td></tr>`;}).join("")}
    </table></div>
    ${(function(){
      const L=(c,t2)=>`<span><i style="background:${c}"></i>${t2}</span>`;
      const bits=[];
      if(div===1){
        bits.push(L("#e3b341","우승"));
        bits.push(L("#2f81f7",`${eaclShort()}${isExpansionSeason()?" "+(G.season+1):""} 진출 (1~3위)`));
        if(isExpansionSeason()){
          bits.push(L("#a371f7","최하위 승강PO"));
          bits.push(L("#f85149","김천 국군 FC 강등 확정"));
        } else {
          bits.push(L("#a371f7",`승강PO (${tableOf(1).length-2}·${tableOf(1).length-1}위)`));
          bits.push(L("#f85149",`다이렉트 강등 (${tableOf(1).length}위)`));
        }
      } else {
        bits.push(L("#e3b341", isExpansionSeason()?"자동 승격 (1·2위)":"자동 승격 (1위)"));
        bits.push(L("#a371f7", isExpansionSeason()?"승격 PO (3~6위)":"승격 PO (2~5위)"));
      }
      return `<div class="rkLegend">${bits.join("")}</div>`
        + (div===1 && isExpansionSeason()
            ? `<p class="small" style="margin-top:4px;opacity:.75">이번 시즌은 K리그1 14팀 확대로 승격이 강등보다 많습니다.</p>` : "");
    })()}
    ${div===1 ? (function(){
      const bits=[];
      try{ if(eaclOn()) bits.push(`🌏 = 올 시즌 ${eaclName()} 참가 중`); }catch(e){}
      if(ES.champId) bits.push(`🏆 <b>${G.teams[ES.champId].short}</b> — ${eaclShort()} 우승으로 다음 시즌 자동 진출`);
      if(ES.pushed) bits.push(`↘ <b>${G.teams[ES.pushed].short}</b> — 챔피언 자동 진출에 밀려 진출권 상실`);
      return bits.length?`<p class="small" style="opacity:.7;margin-top:2px">${bits.join(" · ")}</p>`:"";
    })() : ""}</div>`;
  };
  /* 🗂️ 탭 — 리그 순위 · 득점 순위 · 관중 순위 */
  /* 🌏 EACL 탭 — 대회에 나가는 시즌에만 나타난다 */
  let eaclOK=false;
  try{ eaclOK = eaclOn() && !G.jobless && G.eacl.teams.indexOf(G.userTeamId)>=0; }catch(e){ eaclOK=false; }
  if(!eaclOK && TBLTAB==="eacl") TBLTAB="league";
  /* 🌍 CWC 탭 — 우리가 나가지 않는 시즌에도 볼 수 있다 (대회는 AI끼리 굴러간다) */
  let cwcOK=false; try{ cwcOK = cwcOn(); }catch(e){ cwcOK=false; }
  if(!cwcOK && TBLTAB==="cwc") TBLTAB="league";
  const tabs=`<div style="margin:0 0 10px; display:flex; gap:6px; flex-wrap:wrap">
    ${/* 🔍 제보 — 둘러보기 중에도 탭은 넘길 수 있어야 한다 (.peekOK) */""}
    <button class="mini peekOK ${TBLTAB==='league'?'sel':''}" onclick="setTblTab('league')">🏆 리그 순위</button>
    ${eaclOK?`<button class="mini peekOK ${TBLTAB==='eacl'?'sel':''}" onclick="setTblTab('eacl')">🌏 ${eaclShort()}</button>`:""}
    ${cwcOK?`<button class="mini peekOK ${TBLTAB==='cwc'?'sel':''}" onclick="setTblTab('cwc')">🌍 ${cwcShort()}</button>`:""}
    <button class="mini peekOK ${TBLTAB==='scorer'?'sel':''}" onclick="setTblTab('scorer')">⚽ 득점 순위</button>
    <button class="mini peekOK ${TBLTAB==='assist'?'sel':''}" onclick="setTblTab('assist')">🅰️ 도움 순위</button>
    <button class="mini peekOK ${TBLTAB==='att'?'sel':''}" onclick="setTblTab('att')">👥 관중 순위</button>
    <button class="mini peekOK ${TBLTAB==='award'?'sel':''}" onclick="setTblTab('award')">🏅 수상</button>
  </div>`;
  if(TBLTAB==="eacl")   return `<h2>🏆 순위표</h2>${tabs}${eaclCard()}${eaclRankCard("goal",12)}${eaclRankCard("assist",12)}`;
  if(TBLTAB==="cwc")    return `<h2>🏆 순위표</h2>${tabs}${cwcCard()}${cwcRankCard("goal",12)}${cwcRankCard("assist",12)}`;
  if(TBLTAB==="scorer") return `<h2>🏆 순위표</h2>${tabs}${scorerCard(1)}${scorerCard(2)}`;
  if(TBLTAB==="assist") return `<h2>🏆 순위표</h2>${tabs}${assistCard(1)}${assistCard(2)}`;
  if(TBLTAB==="att")    return `<h2>🏆 순위표</h2>${tabs}${attRankCard()}`;
  if(TBLTAB==="award")  return `<h2>🏆 순위표</h2>${tabs}${awardView()}`;
  return `<h2>🏆 순위표</h2>${tabs}${mk(1)}${mk(2)}
  ${G.poResults.length?`<div class="card"><h3>⚔️ 승강 플레이오프 결과</h3>${G.poResults.map(r=>`<div>${r.tag}: ${G.teams[r.hid].short} ${r.hg} - ${r.ag} ${G.teams[r.aid].short}</div>`).join("")}</div>`:""}`;
}
let TBLTAB="league";
function setTblTab(t){ TBLTAB=t; show("table"); }
/* 🏅 수상 — 이달의 선수·감독 + 지난 시즌 개인상 (요청) */
function awardView(){
  const M=motmState(), ut=(G.jobless?null:userTeam());   // 🐛 무직이면 옛 팀을 「우리 팀」으로 칠하지 않는다
  const mine=(tid)=>!!(ut && tid===ut.id);
  const divTag=(d)=>`<span class="small" style="opacity:.65">${divName(d)}</span>`;
  const monthCard=(div)=>{
    const pl=M.pl.filter(x=>x.div===div && x.s===G.season);
    const mg=M.mg.filter(x=>x.div===div && x.s===G.season);
    const months=[...new Set(pl.map(x=>x.m).concat(mg.map(x=>x.m)))].sort((a,b)=>b-a);
    if(!months.length) return `<div class="card"><h3>🏅 ${divName(div)} 이달의 상</h3>
      <p class="small" style="opacity:.7">아직 시상된 달이 없습니다 — 한 달에 <b>${MOTM_MIN_MATCH}경기</b> 이상 치러야 그달 수상자가 나옵니다.</p></div>`;
    return `<div class="card"><h3>🏅 ${divName(div)} 이달의 상 <span class="small">— ${G.season} 시즌</span></h3>
      <div class="tblScroll" style="overflow-x:auto"><table style="min-width:520px">
        <tr><th>월</th><th>🏅 이달의 선수</th><th>기록</th><th>🎖️ 이달의 감독</th><th>성적</th></tr>
        ${months.map(m=>{
          const P=pl.find(x=>x.m===m), G2=mg.find(x=>x.m===m);
          return `<tr>
            <td><b>${m}월</b></td>
            <td${P&&mine(P.tid)?' style="color:var(--gold)"':""}>${P?`<b>${P.n}</b> <span class="small">(${P.t}${P.pos?" · "+P.pos:""})</span>`:"–"}</td>
            <td class="small">${P?`${P.ap}경기 ${P.g}골 ${P.a}도움 · 평점 <b>${(+P.r).toFixed(2)}</b>`:"–"}</td>
            <td${G2&&G2.me?' style="color:var(--gold)"':""}>${G2?`<b>${G2.t}</b> <span class="small">${G2.n}</span>${G2.me?' <span class="small">★</span>':""}`:"–"}</td>
            <td class="small">${G2?`${G2.W}승 ${G2.D}무 ${G2.L}패 · 득실 ${G2.GF-G2.GA>=0?"+":""}${G2.GF-G2.GA}`:"–"}</td></tr>`;
        }).join("")}
      </table></div></div>`;
  };
  /* 내 수상 요약 */
  const myMg=M.mg.filter(x=>x.me);
  const myPl=M.pl.filter(x=>mine(x.tid));
  const sum=`<div class="card">
    <h3>🏆 내 수상 <span class="small">— 통산</span></h3>
    <div class="stkSum">
      <div><span>🎖️ 이달의 감독</span><b class="money">${motmMgrCount()}회</b></div>
      <div><span>🏅 우리 팀 이달의 선수</span><b>${motmPlCount()}회</b></div>
      <div><span>🏆 트로피</span><b>${(G.trophies||[]).length}개</b></div>
    </div>
    ${myMg.length?`<p class="small" style="margin-top:6px">${myMg.slice(0,8).map(x=>`<b>${x.s}년 ${x.m}월</b> <span style="opacity:.7">(${x.t} · ${x.W}승 ${x.D}무 ${x.L}패)</span>`).join(" · ")}${myMg.length>8?" 외":""}</p>`:""}
  </div>`;
  /* 지난 시즌 개인상 */
  const H=(G.history||[]).slice().reverse().slice(0,6);
  const past=H.length?`<div class="card"><h3>🎖️ 지난 시즌 개인상</h3>
    <div class="tblScroll" style="overflow-x:auto"><table style="min-width:520px">
      <tr><th>시즌</th><th>MVP</th><th>득점왕</th><th>도움왕</th><th>영플레이어</th></tr>
      ${H.map(h=>`<tr><td><b>${h.s||h.season||"-"}</b></td><td class="small">${h.mvp||"-"}</td>
        <td class="small">${h.topScorer||"-"}</td><td class="small">${h.assist||"-"}</td>
        <td class="small">${h.young||"-"}</td></tr>`).join("")}
    </table></div></div>`:"";
  return sum + monthCard(1) + monthCard(2) + past;
}
/* ⚽ 득점 순위 — 리그 경기만 집계 (프리시즌 골은 p.fGoals 로 분리 보관되어 여기 안 들어온다) */
function scorerCard(div){
  const ids=seasonDivIds(div);      // 그 시즌을 치른 구성 — 승강 반영 전
  const all=[];
  for(const id of ids){
    const t=G.teams[id]; if(!t) continue;
    for(const p of t.players) if((p.goals||0)>0 || (p.assists||0)>0) all.push({p,t});
  }
  all.sort((x,y)=> (y.p.goals-x.p.goals) || (y.p.assists-x.p.assists) || (x.p.apps-y.p.apps));
  const top=all.slice(0,15);
  if(!top.length) return `<div class="card"><h3>⚽ ${divName(div)} 득점 순위</h3>
    <p class="small">아직 이번 시즌 리그 득점 기록이 없습니다. (프리시즌 기록은 집계에서 제외됩니다)</p></div>`;
  return `<div class="card"><h3>⚽ ${divName(div)} 득점 순위</h3>
  <div class="tblScroll"><table>
    <tr><th>#</th><th>선수</th><th>포지션</th><th>팀</th><th>출장</th><th>골</th><th>도움</th></tr>
    ${/* ⚠ 제보 — 「득점왕·도움왕에 포지션도 기재하고, 선수를 누르면 프로필로 들어가게」 */""}
    ${top.map((r,i)=>`<tr style="${r.t.isUser?'background:#1f6feb22;font-weight:700':''}">
      <td>${i+1}</td><td class="clickable" onclick="showPlayerInfoPopup(event,${r.p.id})" oncontextmenu="showPlayerInfoPopup(event,${r.p.id})">${r.p.name}</td>
      <td class="pos-${r.p.pos}">${prefSlotOf(r.p)}</td>
      ${seasonClubCell(r.p, r.t, "g")}
      <td>${r.p.apps||0}</td><td><b>${r.p.goals||0}</b></td><td>${r.p.assists||0}</td></tr>`).join("")}
  </table></div>
  <p class="small" style="margin-top:6px">골 → 도움 → 적은 출장 순 정렬 · 프리시즌 제외 · 시즌 중 팀을 옮겼으면 <b>거쳐간 팀을 모두</b> 적습니다(임대 포함)</p></div>`;
}
/* 🅰️ 도움 순위 — 득점 순위와 같은 집계, 도움 기준 정렬 */
function assistCard(div){
  const ids=seasonDivIds(div);      // 그 시즌을 치른 구성 — 승강 반영 전
  const all=[];
  for(const id of ids){
    const t=G.teams[id]; if(!t) continue;
    for(const p of t.players) if((p.assists||0)>0 || (p.goals||0)>0) all.push({p,t});
  }
  all.sort((x,y)=> (y.p.assists-x.p.assists) || (y.p.goals-x.p.goals) || (x.p.apps-y.p.apps));
  const top=all.filter(r=>(r.p.assists||0)>0).slice(0,15);
  if(!top.length) return `<div class="card"><h3>🅰️ ${divName(div)} 도움 순위</h3>
    <p class="small">아직 이번 시즌 리그 도움 기록이 없습니다. (프리시즌 기록은 집계에서 제외됩니다)</p></div>`;
  return `<div class="card"><h3>🅰️ ${divName(div)} 도움 순위</h3>
  <div class="tblScroll"><table>
    <tr><th>#</th><th>선수</th><th>포지션</th><th>팀</th><th>출장</th><th>도움</th><th>골</th></tr>
    ${top.map((r,i)=>`<tr style="${r.t.isUser?'background:#1f6feb22;font-weight:700':''}">
      <td>${i+1}</td><td class="clickable" onclick="showPlayerInfoPopup(event,${r.p.id})" oncontextmenu="showPlayerInfoPopup(event,${r.p.id})">${r.p.name}</td>
      <td class="pos-${r.p.pos}">${prefSlotOf(r.p)}</td>
      ${seasonClubCell(r.p, r.t, "a")}
      <td>${r.p.apps||0}</td><td><b>${r.p.assists||0}</b></td><td>${r.p.goals||0}</td></tr>`).join("")}
  </table></div>
  <p class="small" style="margin-top:6px">도움 → 골 → 적은 출장 순 정렬 · 프리시즌 제외 · 시즌 중 팀을 옮겼으면 <b>거쳐간 팀을 모두</b> 적습니다(임대 포함)</p></div>`;
}
/* ── 👥 타구단 스쿼드 — 순위표에서 팀명을 누르면 열린다. 정렬 가능, 별점 눈금은 내 스쿼드와 동일. ── */
let OSQ={tid:null, k:"ovr", dir:1};
function openTeamSquad(tid){
  const t=G.teams[tid] || (String(tid).indexOf("eacl_")===0 ? eaclTeam(tid) : null);
  if(!t) return;
  if(t.isUser && !G.jobless){ show("squad"); return; }   // 내 팀은 원래 스쿼드 화면으로
  /* ⚠ 제보 — 「구단 이름 눌러도 해당 구단 정보로 넘어갈 수 있게 해달라. 임대 제안 온
     선수가 어떤지 보려면 일일이 순위표 가서 보는 중이다」. 제안·협상 화면의 구단 이름이
     이제 여기로 들어온다. 돌아갈 곳을 순위표로 못박아 두면 임대 센터에서 온 사람이
     순위표에 떨어지므로, 부른 화면을 기억했다가 그리로 되돌린다. */
  OSQ.tid=tid;
  OSQ.back=(typeof VIEW==="string" && VIEW && VIEW!=="osquad") ? VIEW : (t.eacl?"fixtures":"table");
  show("osquad");
}
function osqSort(k){
  if(OSQ.k===k) OSQ.dir=-OSQ.dir; else OSQ={tid:OSQ.tid, k, dir:1};
  show("osquad");
}
function osqTh(k, label, title){
  const on=OSQ.k===k;
  return `<th class="clickable" title="${title||label} 기준 정렬" onclick="osqSort('${k}')"
    style="${on?"color:var(--gold)":""}">${label}${on?(OSQ.dir>0?" ▾":" ▴"):""}</th>`;
}
function otherSquadView(){
  const t=G.teams[OSQ.tid] || (String(OSQ.tid).indexOf("eacl_")===0 ? eaclTeam(OSQ.tid) : null);
  if(!t) return `<h2>👥 스쿼드</h2><div class="msg warn">팀을 찾을 수 없습니다.</div>`;
  const isE=!!t.eacl;
  /* 🎖️ 국군체육부대 — 전원이 남의 팀 선수다. 원소속을 한 칸으로 보여 준다 (제보) */
  const isA=(typeof isArmyTeam==="function") && isArmyTeam(t);
  const tbl=isE?[]:tableOf(t.div);
  const pos=isE ? (eaclOn()?eaclTableSorted().indexOf(OSQ.tid)+1:0) : tbl.findIndex(x=>x.id===t.id)+1;
  /* 정렬 — 내 스쿼드와 같은 키(SQUAD_KEY)를 쓴다. 별점(ovr)은 starRank 기반이라
     화면에 보이는 별 개수 순서와 정확히 일치한다. */
  const f=SQUAD_KEY[OSQ.k]||SQUAD_KEY.ovr;
  const asc=(OSQ.k==="pos"||OSQ.k==="name"||OSQ.k==="no");
  const list=[...t.players].sort((a,b)=>{
    const x=f(a), y=f(b);
    let r=(typeof x==="string")?String(x).localeCompare(String(y)):(x-y);
    if(!asc) r=-r;
    return r*OSQ.dir || (playerLevel(b)-playerLevel(a));
  });
  const rows=list.map(p=>`<tr>
    <td class="small">${p.no||"-"}</td><td class="pos-${p.pos}"><b>${p.pos}</b></td>
    <td class="clickable" onclick="showPlayerInfoPopup(event,${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})">${nmF(p)}${pTags(p)}</td>
    ${isA?(function(){
      const ow=p.army&&p.army.own&&G.teams[p.army.own];
      const mine=ow&&ow.isUser;
      return `<td class="small">${ow?`<b style="color:${mine?"var(--green)":"var(--sub)"}">${ow.short}</b>`:'<span style="opacity:.6">—</span>'}</td>`;
    })():""}
    <td title="${birthText(p)} · ${p.h||178}cm/${p.w||74}kg">${G.season-p.by}세</td>
    <td>${abilityStars(p)}</td><td>${mor(p.cond)}%</td>
    <td>${p.apps}경기 ${p.goals}골 ${p.assists}도움</td><td>${p.apps?p.seasonRating.toFixed(2):"-"}</td>
    ${isE
      ? `<td class="small">${p.natCode==="용병"?'<span class="tag" style="background:#8957e522;color:#d2a8ff">용병</span>':(p.natCode||t.nat||"-")}</td>
         <td class="small">${p.wage}억</td><td class="small">${marketValue(p)}억</td>`
      : `<td class="small">${p.wage}억</td>
         <td class="small"><b style="color:${(p.ct||1)<=1?"var(--red)":(p.ct||1)<=2?"var(--gold)":"var(--sub)"}">${p.ct||1}년</b>${p.loan?' <span class="tag" style="background:#8957e522;color:#d2a8ff">임대</span>':""}</td>
         <td class="small">${marketValue(p)}억</td>`}</tr>`).join("");
  const _co=COACHES[t.id];
  /* 🌏 EACL 클럽 — 리그 소속이 아니라 국적·대회 순위·등록 정보를 대신 보여준다 */
  if(isE){
    const eid=String(OSQ.tid).replace(/^eacl_/,"");
    const c=t.coach||eaclCoach(eid)||{};
    const sd=t.stad||{n:"-",cap:0}, ow=t.own||{n:"-"};
    const frnN=t.players.filter(p=>p.natCode==="용병").length;
    return `<h2>${eaclFlag(t.nat, true)}${t.name} <span class="small">#${t.uid} — ${t.nat} · ${eaclName()}${pos?` ${pos}위`:""} · ${t.players.length}명 (용병 ${frnN})</span></h2>
    <div class="msg info">
      👔 감독 <b>${c.n||"-"}</b> <span class="small">#${c.uid||"-"} · 종합 ${c.ovr||"-"}/20 (전술 ${c.tac||"-"} · 공격 ${c.att||"-"} · 수비 ${c.def||"-"} · 육성 ${c.dev||"-"})</span><br>
      🏟️ <b>${sd.n}</b> <span class="small">#${sd.uid||"-"} · ${(sd.cap||0).toLocaleString()}석</span> &nbsp;·&nbsp; 🏢 <b>${ow.n}</b> <span class="small">#${ow.uid||"-"}</span>
      <button class="mini" style="margin-left:8px" onclick="show(OSQ.back||'fixtures')">← 돌아가기</button></div>
    <div class="card"><div class="tblScroll"><table><tr>
      ${osqTh("no","#","등번호")}${osqTh("pos","포지션")}${osqTh("name","이름")}
      ${osqTh("age","나이")}${osqTh("ovr","능력","별점")}${osqTh("cond","컨디션")}
      ${osqTh("apps","시즌 기록","공격 포인트")}${osqTh("rate","평점")}
      <th>국적</th>${osqTh("wage","연봉")}${osqTh("val","가치","시장 가치")}
    </tr>${rows}</table></div></div>`;
  }
  return `<h2>👥 ${t.name} <span class="small">— ${divName(t.div)} ${pos}위 · ${t.players.length}명 · 외국인 ${t.players.filter(p=>frnQ(p)).length}명${_co?` · <span class="clickable" style="text-decoration:underline dotted;text-underline-offset:3px" onclick="showCoachPopup(event,'${t.id}')">🧑‍💼 ${_co.n} 감독 (종합 ${_co.ovr}/20)</span>`:""}</span></h2>
  <div class="msg info">선수 이름을 누르면 상세 정보가 뜹니다. 계약 1년 남은 선수는 영입 노려볼 만합니다.
    <button class="mini" style="margin-left:8px" onclick="show(OSQ.back||'table')">← 돌아가기</button></div>
  <div class="card"><div class="tblScroll"><table><tr>
    ${osqTh("no","#","등번호")}${osqTh("pos","포지션")}${osqTh("name","이름")}
    ${isA?'<th title="이 선수를 보낸 구단">원소속</th>':""}
    ${osqTh("age","나이")}${osqTh("ovr","능력","별점")}${osqTh("cond","컨디션")}
    ${osqTh("apps","시즌 기록","공격 포인트")}${osqTh("rate","평점")}
    ${osqTh("wage","연봉")}${osqTh("ct","계약","잔여 계약")}${osqTh("val","가치","시장 가치")}
  </tr>${rows}</table></div>
  ${isA?`<p class="small" style="opacity:.75;margin-top:6px">🎖️ 국군체육부대는 <b>복무 중인 선수만</b> 뜁니다 — 전원이 원소속 구단이 따로 있고, 전역하면 그 팀으로 돌아갑니다.
    <b style="color:var(--green)">초록색</b>이 우리 구단에서 보낸 선수입니다. 복무 기간에는 원소속과의 계약 기간이 흐르지 않습니다.</p>`:""}
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════
   👥 관중 순위 — 홈 평균 관중 · 원정 동원력
   (제보 — "원정팬 수 & 평관 순위 & 원정 평관 순위 부탁드립니다")
   K리그에서 관중은 성적만큼이나 자주 회자되는 지표다. 순위표 아래에 붙인다.
═══════════════════════════════════════════════════════════════ */
let attTab=1;
function setAttTab(d){ attTab=d; show("table"); }
/* 이번 시즌 관중 집계 — {홈 경기 관중 합·경기 수, 원정 동원 합·경기 수} */
function attStats(div){
  const S={};
  const ids=seasonDivIds(div);      // 그 시즌을 치른 구성 — 승강 반영 전
  for(const id of ids) S[id]={h:0,hn:0,a:0,an:0,best:0,bestOpp:"",sell:0};
  for(const r of (G.results||[])){
    if(r.s!==G.season || r.div!==div || r.forfeit) continue;
    const att=r.att||0; if(att<=0) continue;
    const aatt=r.aatt||0;
    if(S[r.hid]){ S[r.hid].h+=att; S[r.hid].hn++;
      if(att>S[r.hid].best){ S[r.hid].best=att; S[r.hid].bestOpp=(G.teams[r.aid]||{}).short||""; }
      try{ if(isSellout(G.teams[r.hid], att)) S[r.hid].sell++; }catch(e){}
    }
    if(S[r.aid] && aatt>0){ S[r.aid].a+=aatt; S[r.aid].an++; }
  }
  return S;
}
function attRankCard(){
  const div=(attTab===2?2:1);
  const S=attStats(div);
  const rows=Object.keys(S).map(id=>{
    const t=G.teams[id]; if(!t) return null;
    const x=S[id];
    const sd=stadOf(t);
    return {t, x, sd,
      avgH: x.hn?Math.round(x.h/x.hn):0,
      avgA: x.an?Math.round(x.a/x.an):0,
      pct : x.hn?Math.round((x.h/x.hn)/Math.max(1,sd.cap)*100):0};
  }).filter(Boolean);
  const anyData=rows.some(r=>r.x.hn>0);
  const tb=(d,l)=>`<button class="mini peekOK ${attTab===d?'sel':''}" style="padding:5px 14px" onclick="setAttTab(${d})">${l}</button>`;
  if(!anyData) return `<div class="card"><h3>👥 관중 순위</h3>
    <div style="margin-bottom:8px">${tb(1,"K리그1")} ${tb(2,"K리그2")}</div>
    <p class="small">아직 이번 시즌 경기가 없습니다. 라운드가 진행되면 홈 평균 관중과 원정 동원력이 집계됩니다.</p></div>`;
  const byH=[...rows].sort((a,b)=>b.avgH-a.avgH);
  const byA=[...rows].sort((a,b)=>b.avgA-a.avgA);
  const aRank={}; byA.forEach((r,i)=>aRank[r.t.id]=i+1);
  const totA=byA.reduce((s,r)=>s+r.avgA,0);
  const mk=(r,i)=>{
    const me=r.t.isUser;
    return `<tr style="${me?'background:#1f6feb22;font-weight:700':''}">
      <td>${i+1}</td>
      <td class="clickable peekOK" onclick="openTeamSquad('${r.t.id}')" style="text-decoration:underline dotted;text-underline-offset:3px">${r.t.name}</td>
      <td class="small">${r.sd.n}<br><span style="opacity:.7">${r.sd.cap.toLocaleString()}석</span></td>
      <td><b>${r.avgH.toLocaleString()}</b><br><span class="small" style="color:${r.pct>=85?"var(--green)":r.pct>=60?"var(--gold)":"var(--sub)"}">좌석 ${r.pct}%</span></td>
      <td>${r.x.best?`${r.x.best.toLocaleString()}<br><span class="small" style="opacity:.7">${r.x.bestOpp}전</span>`:"-"}</td>
      <td>${r.x.sell?`<b style="color:var(--gold)">${r.x.sell}회</b>`:'<span class="small">-</span>'}</td>
      <td><b>${r.avgA?r.avgA.toLocaleString():"-"}</b>${r.avgA?`<br><span class="small" style="opacity:.7">원정 ${aRank[r.t.id]}위</span>`:""}</td>
    </tr>`;
  };
  const top=byA[0];
  return `<div class="card"><h3>👥 관중 순위 <span class="small">— ${G.season} 시즌 누적</span></h3>
  <div style="margin-bottom:8px">${tb(1,"K리그1")} ${tb(2,"K리그2")}</div>
  <div class="msg info" style="margin-bottom:8px">🏟️ <b>홈 평균</b>은 우리 경기장에 온 전체 관중, <b>원정 동원</b>은 우리 팀이 원정을 갔을 때 따라간 원정 팬 평균입니다.
    ${top&&top.avgA?`이번 시즌 원정 동원 1위는 <b>${top.t.name}</b>(경기당 ${top.avgA.toLocaleString()}명).`:""}</div>
  <div class="tblScroll" style="max-height:60vh;overflow-y:auto"><table>
    <tr><th>#</th><th>구단</th><th>홈 구장</th><th>홈 평균</th><th>최다 관중</th><th>매진</th><th>원정 동원</th></tr>
    ${byH.map(mk).join("")}
  </table></div>
  <p class="small" style="margin-top:6px">🚌 원정 동원은 상대 경기장의 원정석 규모(최대 15%)를 넘지 않습니다. 더비·같은 도시 경기·인기 구단일수록 많이 따라갑니다.
    구단명을 누르면 스쿼드를 볼 수 있습니다.</p></div>`;
}
