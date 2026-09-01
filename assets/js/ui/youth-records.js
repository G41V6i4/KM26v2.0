"use strict";
/* ---------- 유스 ---------- */
function youth(){
  const t=userTeam();
  /* 🌱 유망주 명단 — 「지금 어디에 있는가」를 함께 본다 (제보).
     ⚠ 임대로 내보낸 우리 유망주는 상대 구단 명단에 들어가 있어서 이 목록에 아예 없었다.
        정작 「잘 크고 있나」를 확인해야 하는 선수들이 빠져 있던 셈이다.
        임대해 온 남의 유망주는 반대로 우리 명단에 섞여 있어 우리 자원처럼 보였다. */
  const YMAX=23;
  const rows=[];
  for(const p of t.players){
    if(G.season-p.by>YMAX) continue;
    if(p.loan && p.loan.own!==t.id) rows.push({p, kind:"in",  club:G.teams[p.loan.own]||null});   // 빌려온 선수
    else                            rows.push({p, kind:"own", club:null});                        // 우리 선수
  }
  try{
    for(const {p, c} of loanedOut(t)){
      if(G.season-p.by>YMAX) continue;
      rows.push({p, kind:"out", club:c});                                                          // 내보낸 선수
    }
  }catch(e){}
  /* 🎖️ ⚠ 「유스 탭 23세 이하 명단에 김천 상무로 간 인원이 빠져 있다」.
     입대 선수는 t.players 에도, loanedOut() 에도 없어서 통째로 사라져 있었다.
     한창 클 나이에 군에 가 있는 자원이야말로 유망주 계획의 핵심이다. */
  try{
    for(const x of (armySentOut(t)||[])){
      const p=x && x.p; if(!p) continue;            // armySentOut 은 {p, c} 꾸러미를 돌려준다
      if(G.season-p.by>YMAX) continue;
      if(rows.some(y=>y.p.id===p.id)) continue;
      rows.push({p, kind:"army", club:x.c||G.teams.gimcheon||null});
    }
  }catch(e){}
  const young=rows.sort((a,b)=>(b.p.pot||0)-(a.p.pot||0)).map(x=>x.p);
  const META={}; for(const x of rows) META[x.p.id]=x;
  const nOut=rows.filter(x=>x.kind==="out").length, nIn=rows.filter(x=>x.kind==="in").length;
  const nArmy=rows.filter(x=>x.kind==="army").length;
  const grade=(v)=>"◆".repeat(v)+"◇".repeat(5-v);
  if(isArmyTeam(t)){
    return `<h2>🌱 유스 & 유망주</h2>
    <div class="msg info">🎖️ <b>국군체육부대에는 유스 아카데미가 없습니다.</b><br>
      이 팀의 선수는 전원 원소속 구단에서 파견된 현역 군인입니다. 새 얼굴은 <b>💸 이적시장 → 🎖️ 입대 지원</b>에서만 옵니다.</div>
    <div class="card"><h3>23세 이하 복무 선수</h3><div class="tblScroll"><table><tr><th>이름</th><th>포지션</th><th>나이</th><th>현재</th><th>전역</th></tr>
    ${t.players.filter(p=>G.season-p.by<=23).map(p=>`<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</td>
      <td class="fmPos pos-${p.pos}">${prefSlotOf(p)}</td><td>${G.season-p.by}세</td><td>${abilityStars(p)}</td>
      <td class="small">${p.army&&p.army.out?`D-${Math.max(0,armyDaysLeft(p))}`:"-"}</td></tr>`).join("")}</table></div></div>`;
  }
  return `<h2>🌱 유스 & 유망주</h2>
  <div class="row">
    ${(function(){
      const yl=clamp(t.youthLv||1,1,FAC_MAX), Y=YOUTH_LABEL[yl];
      const e=lvEff(yl);   // 🔟 효과 축 (예전 1~5)
      const n=`${1+[0,0,1,2,2,3][Math.round(e)]}~${3+[0,0,1,2,2,3][Math.round(e)]}명`;
      return `<div class="card"><h3>🌱 유스 아카데미</h3>
        <div style="font-size:22px">${facStars(yl,22)} <span class="small" style="color:${Y.c}">${yl}등급 · ${Y.n}</span></div>
        <p class="small" style="margin-top:6px">${Y.d}</p>
        <p class="small" style="opacity:.7"><b>발굴</b> — 매 시즌 <b>${n}</b> 콜업 · 잠재력 천장 ${Math.round(70+(e-1)*1.8)} · 특급 확률 ${Math.round((0.008+(e-1)*0.016)*1000)/10}%<br>🏦 재정 → 예산 증액 요청에서 올립니다. <span style="opacity:.8">6단계부터 빨간별 — 10단계가 최고입니다.</span></p></div>`;
    })()}
    ${(function(){
      const tl=trainLv(t), L=TRAIN_LABEL[tl];
      const te=lvEff(tl);   // 🔟 효과 축 (예전 1~5)
      return `<div class="card"><h3>🏋️ 훈련시설</h3>
        <div style="font-size:22px">${facStars(tl,22)} <span class="small" style="color:${L.c}">${tl}등급 · ${L.n}</span></div>
        <p class="small" style="margin-top:6px">${L.d}</p>
        <p class="small" style="opacity:.7"><b>육성</b> — 성장 속도 ×${Math.round((0.88+(te-1)*0.07)*100)/100} · 훈련 부상 ×${Math.round((1.12-(te-1)*0.05)*100)/100} · 특급 확률 +${Math.round((te-1)*0.9*10)/10}%p</p></div>`;
    })()}
  </div>
  <div class="msg info">시즌이 끝날 때마다 유스 아카데미에서 2~3명이 콜업됩니다. 외국 국적 유소년도 만 18세까지 국내 유스에서 합계 5년(또는 연속 3년) 이상 성장하면 <b>🌱 홈그로운</b>으로 인정되어 국내 선수로 등록됩니다 — 외국인 쿼터를 차지하지 않으며 이름이 초록색으로 표시됩니다. 23세 이하 선수는 매 시즌 잠재력까지 성장합니다. 잘 키운 유망주는 이적 자금과 팀의 미래가 됩니다.</div>
  <div class="card">
    <h3>🌱 ${YMAX}세 이하 유망주 <span class="small">${rows.length}명 — 우리 팀 ${rows.length-nOut-nIn-nArmy}명${nOut?` · 🔁 임대 중 ${nOut}명`:""}${nIn?` · 📥 임대 영입 ${nIn}명`:""}${nArmy?` · 🎖️ 병역 중 ${nArmy}명`:""}</span></h3>
    ${(nOut||nIn||nArmy)?`<p class="small" style="margin:2px 0 8px;color:var(--sub)">
      ${nOut?`<b style="color:#f0883e">🔁 임대 중</b>인 선수는 다른 구단에서 뛰고 있습니다 — 출전 시간이 그대로 성장으로 돌아옵니다. `:""}
      ${nArmy?`<b style="color:#c9a227">🎖️ 병역 중</b>인 선수도 김천에서 계속 뜁니다 — 전역하면 그대로 돌아옵니다. `:""}
      ${nIn?`<b style="color:#79c0ff">📥 임대 영입</b>은 <b>우리 소유가 아닙니다</b> — 임대가 끝나면 원소속으로 돌아가고, 판매·트레이드도 할 수 없습니다.`:""}</p>`:""}
    <!-- 🧭 ⚠ 제보 원문 — 「'유스' 탭의 포지션이 대략적으로 GK, DF, MF, FW 등으로 되어 있는데
         GK - RB - CB - LB - DM - RM - CM - LM - RW - CAM - LW - ST 식으로 '전술' 탭에서처럼
         세분화 해서 포지션을 분류 해주시면 감사하겠습니다」.
         원인 — 유스 표만 큰 분류(p.pos)를 그대로 찍고 있었다. 선수 데이터에는 이미 세부 자리
           (p.prefPos)가 들어 있고 전술·스쿼드 화면은 prefSlotOf() 로 그걸 쓴다. 같은 눈금으로 맞춘다. -->
    <div class="tblScroll"><table><tr><th>이름</th><th>소속</th><th>포지션</th><th>나이</th><th>현재</th><th>잠재력</th><th>성장 전망</th></tr>
  ${young.map(p=>{
    const m=META[p.id]||{kind:"own"};
    const cls = m.kind==="out" ? "yOut" : m.kind==="in" ? "yIn" : m.kind==="army" ? "yArmy" : "";
    let where;
    if(m.kind==="out"){
      const played=(p.apps||0)-((p.loan&&p.loan.apps0)||0);
      const bi=(function(){ try{ return loanBackInfo(p)||{}; }catch(e){ return {}; } })();
      where=`<span class="yTag out">🔁 임대 중</span> <b>${m.club?m.club.short:"-"}</b>
        <div class="small" style="opacity:.8">${played}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}${bi.txt?` · ${bi.txt}`:""}</div>`;
    } else if(m.kind==="army"){
      const dl=(function(){ try{ return armyDaysLeft(p); }catch(e){ return null; } })();
      where=`<span class="yTag out" style="background:#c9a22722;color:#c9a227">🎖️ 병역 중</span> <b>김천 상무 FC</b>
        <div class="small" style="opacity:.8">${p.apps?`${p.apps}경기`:"출전 없음"}${dl!=null?` · 전역 D-${Math.max(0,dl)}`:""}</div>`;
    } else if(m.kind==="in"){
      const bi=(function(){ try{ return loanBackInfo(p)||{}; }catch(e){ return {}; } })();
      where=`<span class="yTag in">📥 임대 영입</span> <b>${m.club?m.club.short:"-"}</b> 소유
        <div class="small" style="opacity:.8">${bi.txt||""}</div>`;
    } else {
      where=`<span class="yTag own">우리 팀</span>`;
    }
    return `<tr class="${cls}"><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}${pTags(p)}</td>
   <td class="small">${where}</td><td class="fmPos pos-${p.pos}">${prefSlotOf(p)}</td><td>${G.season-p.by}세</td>
   <td>${abilityStars(p)}</td><td>${potentialStars(p)}</td>
   <td>${(function(){ const g=growthGap(p);
     return g.bars
       ? `<span title="현재 ${g.now} → 잠재 ${g.cap} (남은 폭 ${g.gap})">${"▮".repeat(g.bars)} <span class="small" style="opacity:.7">+${g.gap}</span></span>`
       : `<span title="현재 ${g.now} = 잠재 ${g.cap} — 더 오를 곳이 없습니다" style="color:var(--gold)">완성</span>`;
   })()}</td></tr>`;}).join("")}
    </table></div></div>`;
}
/* ---------- 기록실 ---------- */
function stats(){
  const all=Object.values(G.teams).flatMap(t=>t.players.map(p=>({p,t})));
  const scorers=[...all].sort((a,b)=>b.p.goals-a.p.goals).slice(0,10);
  const assists=[...all].sort((a,b)=>b.p.assists-a.p.assists).slice(0,10);
  const rated=[...all].filter(x=>x.p.apps>=8).sort((a,b)=>b.p.seasonRating-a.p.seasonRating).slice(0,10);
  const mk=(list,fn,h)=>`<div class="card"><h3>${h}</h3><div class="tblScroll"><table>${list.map((x,i)=>`<tr><td>${i+1}</td><td class="clickable" onclick="openPlayerMenu(event,${x.p.id})">${x.p.name}</td><td>${x.t.short}</td><td><b>${fn(x.p)}</b></td></tr>`).join("")}</table></div></div>`;
  /* 프리시즌(연습경기) 장부 — 공식 기록과 섞이지 않게 따로 보여 준다 */
  const fAll=all.filter(x=>(x.p.fApps||0)>0);
  const fScore=[...fAll].filter(x=>x.p.fGoals>0).sort((a,b)=>b.p.fGoals-a.p.fGoals).slice(0,5);
  const fAst=[...fAll].filter(x=>x.p.fAssists>0).sort((a,b)=>b.p.fAssists-a.p.fAssists).slice(0,5);
  const fRate=[...fAll].filter(x=>(x.p.fApps||0)>=2).sort((a,b)=>(b.p.fRating||0)-(a.p.fRating||0)).slice(0,5);
  const preBlock = fAll.length ? `
  <div class="card" style="margin-top:10px"><h3>🏝️ 프리시즌 (연습경기)</h3>
    <p class="small" style="margin:2px 0 8px">연습경기 기록은 본 시즌 공식 기록(위)에 포함되지 않습니다.</p>
    <div class="row">
      ${fScore.length?mk(fScore,p=>p.fGoals+"골","득점"):""}
      ${fAst.length?mk(fAst,p=>p.fAssists+"도움","도움"):""}
      ${fRate.length?mk(fRate,p=>(p.fRating||0).toFixed(2)+` <span class="small">(${p.fApps}경기)</span>`,"평점 (2경기+)"):""}
    </div></div>`:"";
  return `<h2>📊 기록실 (${G.season} 시즌)</h2>
  <div class="row">${mk(scorers,p=>p.goals+"골","득점 순위")}${mk(assists,p=>p.assists+"도움","도움 순위")}${mk(rated,p=>p.seasonRating.toFixed(2),"평점 순위 (8경기+)")}</div>
  ${preBlock}
  ${G.history.length?`<div class="card"><h3>역대 시즌</h3><div class="tblScroll"><table><tr><th>시즌</th><th>K1 우승</th><th>K2 우승</th><th>득점왕</th><th>MVP</th><th>내 성적</th></tr>
  ${G.history.map(h=>`<tr><td>${h.season}</td><td>${h.champ}</td><td>${h.champ2}</td><td>${h.topScorer}</td><td>${h.mvp}</td><td>${divName(h.userDiv)} ${h.userPos}위</td></tr>`).join("")}</table></div></div>`:""}`;
}
