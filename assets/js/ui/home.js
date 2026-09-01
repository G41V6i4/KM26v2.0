"use strict";
/* ---------- 홈 ---------- */
/* ═══ 📜 감독 경력 화면 (요청) ══════════════════════════════════════════ */
let ofcTab="now";
function ofcSetTab(k){ ofcTab=k; show("home"); }
function cvHow(k){ return k==="sack"?["🪑","경질","#f85149"] : k==="quit"?["🚪","자진 사임","#ff9d5c"]
                 : k==="expire"?["📜","계약 만료","var(--sub)"] : k==="leave"?["📜","퇴임","var(--sub)"]
                 : ["🟢","재임 중","var(--green)"]; }
function cvPct(W,D,L){ const n=W+D+L; return n? Math.round(W/n*100) : 0; }
function cvPosCol(r){
  if(!r.pos) return "var(--sub)";
  if(r.pos===1) return "var(--gold)";
  if(r.pos<=3) return "var(--green)";
  if(r.N && r.pos>r.N-2) return "#f85149";
  return "#e6edf3";
}
function careerView(){
  const C=mgrCv();
  try{ cvSeed(); }catch(e){}
  const t=userTeam();
  const rows=C.rows.slice().sort((a,b)=>b.s-a.s || (b.part?0:1)-(a.part?0:1));
  /* 지금 시즌은 아직 장부에 없다 — 살아 있는 순위표에서 임시로 한 줄 만들어 맨 위에 얹는다 */
  let live=null;
  if(t && !G.jobless){
    let pos=0,N=0;
    try{ const tb=tableOf(t.div); N=tb.length; pos=tb.findIndex(x=>x.id===t.id)+1; }catch(e){}
    live={s:G.season, tid:t.id, sh:t.short, nm:t.name, div:t.div, pos, N,
          W:t.W|0, D:t.Dw|0, L:t.L|0, GF:t.GF|0, GA:t.GA|0, Pts:t.Pts|0,
          po:cvCompOf(G.season,"po"), eacl:cvCompOf(G.season,"eacl"), cwc:cvCompOf(G.season,"cwc"),
          top:cvTopScorer(t), note:"진행 중", now:1};
  }
  const all=(live?[live]:[]).concat(rows.filter(r=>!(live&&r.s===G.season&&r.tid===live.tid)));

  /* ── 통산 요약 ── */
  let W=0,D=0,L=0,GF=0,GA=0; const clubs=new Set(); let seasons=new Set();
  for(const r of all){ if(r.seed||!r.tid) { if(r.s!=null) seasons.add(r.s); continue; }
    W+=r.W|0; D+=r.D|0; L+=r.L|0; GF+=r.GF|0; GA+=r.GA|0; clubs.add(r.tid); seasons.add(r.s); }
  for(const sp of C.spells) clubs.add(sp.tid);
  const N=W+D+L;
  const tro=(G.trophies||[]).slice().sort((a,b)=>b.s-a.s);
  const troN=(k)=>(G.trophies||[]).filter(x=>x.kind===k).length;

  const sum=`<div class="card">
    <h3>📜 통산 기록 <span class="small">— ${seasons.size}시즌 · ${clubs.size}개 구단</span></h3>
    <div class="stkSum">
      <div><span>지휘 경기</span><b class="money">${N}경기</b></div>
      <div><span>전적</span><b>${W}승 ${D}무 ${L}패</b></div>
      <div><span>승률</span><b style="color:${cvPct(W,D,L)>=50?"var(--green)":"var(--sub)"}">${cvPct(W,D,L)}%</b></div>
      <div><span>득실</span><b>${GF} : ${GA} <span class="small">(${GF-GA>=0?"+":""}${GF-GA})</span></b></div>
      <div><span>감독 위신</span><b style="color:var(--gold)">${(function(){ try{ return mgrPrestige(); }catch(e){ return "-"; } })()}</b></div>
      <div><span>리그 우승</span><b style="color:${troN("champ")?"var(--gold)":"var(--sub)"}">${troN("champ")}회</b></div>
      ${(function(){ try{ const n=motmMgrCount();
        return `<div><span>🎖️ 이달의 감독</span><b style="color:${n?"var(--gold)":"var(--sub)"}">${n}회</b></div>`;
      }catch(e){ return ""; } })()}
    </div>
    ${N===0?`<p class="small" style="margin-top:8px;opacity:.7">아직 시즌을 마친 기록이 없습니다 — 첫 시즌을 끝내면 여기에 쌓입니다.</p>`:""}
  </div>`;

  /* ── 트로피 진열장 ── */
  const troCard=tro.length?`<div class="card">
    <h3>🏆 트로피 진열장 <span class="small">— ${tro.length}개</span></h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${tro.map(x=>{ const rk=TROPHY_RANK[x.kind]||0;
        /* 빨강은 강등에만 — 8강·승강PO 까지 빨갛게 칠하면 성과가 사고처럼 보인다 */
        const col=x.kind==="releg"?"#f85149" : rk>=100?"var(--gold)" : rk>=60?"#58a6ff"
                : rk>=40?"#7ee2a8" : "var(--sub)";
        const ic=rk>=100?"🏆":rk>=60?"🥈":rk>=40?"🎖️":x.kind==="releg"?"⬇️":x.kind==="promo"?"⬆️":"🎫";
        return `<span class="tag" style="border:1px solid ${col};color:${col};padding:4px 9px;border-radius:8px;font-size:12px">
          ${ic} ${x.label||""}${x.team?` <span style="opacity:.6">· ${x.team}</span>`:""}</span>`; }).join("")}
    </div></div>`:"";

  /* ── 팀 경력 ── */
  const spells=C.spells.slice().reverse();
  const spCard=`<div class="card">
    <h3>🏟️ 팀 경력 <span class="small">— 구단별 재임 기간</span></h3>
    ${spells.length? spells.map(sp=>{
      const [ic,nm2,col]=cvHow(sp.done?sp.how:null);
      const per=sp.done?`${sp.s0} ~ ${sp.s1}`:`${sp.s0} ~ 현재`;
      /* 재임 중인 구단의 전적은 시즌 줄 + 지금 시즌을 합쳐서 낸다 */
      let w=sp.W|0,d=sp.D|0,l=sp.L|0;
      if(!sp.done){ w=0;d=0;l=0;
        for(const r of all) if(r.tid===sp.tid && r.s>=sp.s0){ w+=r.W|0; d+=r.D|0; l+=r.L|0; } }
      const n2=w+d+l;
      return `<div class="meRow">
        <span class="meIc">${ic}</span>
        <span class="meN"><b>${sp.nm||sp.sh}</b> <span class="small" style="color:${col}">${nm2}</span><br>
          <span class="small">${per}${sp.est?' <span style="opacity:.6">(추정)</span>':""}${n2?` · ${n2}경기 ${w}승 ${d}무 ${l}패 (승률 ${cvPct(w,d,l)}%)`:" · 기록 없음"}</span></span>
        <span class="meV">${(function(){ const ts=(G.trophies||[]).filter(x=>x.team===sp.nm && (TROPHY_RANK[x.kind]||0)>=90).length;
          return ts?`🏆 ${ts}`:""; })()}</span></div>`;
    }).join("") : `<p class="small" style="opacity:.7">재임 기록이 없습니다.</p>`}
  </div>`;

  /* ── 시즌별 표 ── */
  const cell=(v)=>v||`<span style="opacity:.35">–</span>`;
  const seasonCard=`<div class="card">
    <h3>📅 시즌별 성적 <span class="small">— ${all.length}시즌</span></h3>
    <div class="tblScroll" style="overflow-x:auto"><table style="min-width:640px">
      <tr><th>시즌</th><th>구단</th><th>리그</th><th>순위</th><th>경기</th><th>승무패</th><th>득실</th><th>승점</th>
          <th>승강 PO</th><th>${(function(){ try{ return eaclShort(); }catch(e){ return "EACL"; } })()}</th>
          <th>${(function(){ try{ return cwcShort(); }catch(e){ return "CWC"; } })()}</th><th>최다 득점</th><th>비고</th></tr>
      ${all.length? all.map(r=>{
        if(r.seed||!r.tid) return `<tr style="opacity:.72">
          <td><b>${r.s}</b></td><td>${r.nm||r.sh||"–"}</td><td colspan="6" class="small" style="opacity:.7">기록 없음 <span style="opacity:.6">(장부 이전 시즌)</span></td>
          <td>${cell(r.po)}</td><td>${cell(r.eacl)}</td><td>${cell(r.cwc)}</td><td>–</td><td class="small">${r.note||""}</td></tr>`;
        const n2=(r.W|0)+(r.D|0)+(r.L|0);
        return `<tr${r.now?' style="background:#161b22"':""}>
          <td><b>${r.s}</b>${r.now?' <span class="small" style="color:var(--green)">●</span>':""}</td>
          <td>${r.sh||"–"}</td>
          <td class="small">${r.div?divName(r.div):"–"}</td>
          <td><b style="color:${cvPosCol(r)}">${r.pos?r.pos+"위":"–"}</b>${r.N?`<span class="small" style="opacity:.55">/${r.N}</span>`:""}</td>
          <td>${n2}</td>
          <td class="small">${r.W|0}·${r.D|0}·${r.L|0}</td>
          <td class="small">${r.GF|0}:${r.GA|0}</td>
          <td><b>${r.Pts|0}</b></td>
          <td class="small">${cell(r.po)}</td><td class="small">${cell(r.eacl)}</td><td class="small">${cell(r.cwc)}</td>
          <td class="small">${r.top?`${r.top.n} <b>${r.top.g}</b>`:`<span style="opacity:.35">–</span>`}</td>
          <td class="small" style="color:${(r.note||"").indexOf("우승")>=0?"var(--gold)":(r.note||"").indexOf("강등")>=0?"#f85149":"var(--sub)"}">${r.note||""}</td></tr>`;
      }).join("") : `<tr><td colspan="13" class="small" style="opacity:.7">아직 기록이 없습니다.</td></tr>`}
    </table></div>
    <p class="small" style="margin-top:6px;opacity:.65">한 시즌에 두 줄이 있으면 그 해 도중에 팀을 옮긴 것입니다.</p>
  </div>`;

  /* ── 대회 성적 요약 ── */
  const compRow=(ic,nm2,keys)=>{
    const list=(G.trophies||[]).filter(x=>keys.indexOf(x.kind)>=0).sort((a,b)=>b.s-a.s);
    if(!list.length) return `<div class="meRow"><span class="meIc">${ic}</span>
      <span class="meN"><b>${nm2}</b><br><span class="small" style="opacity:.6">기록 없음</span></span><span class="meV">–</span></div>`;
    const best=list.slice().sort((a,b)=>(TROPHY_RANK[b.kind]||0)-(TROPHY_RANK[a.kind]||0))[0];
    const cnt={}; for(const x of list) cnt[CV_STAGE[x.kind]||x.kind]=(cnt[CV_STAGE[x.kind]||x.kind]||0)+1;
    return `<div class="meRow"><span class="meIc">${ic}</span>
      <span class="meN"><b>${nm2}</b> <span class="small" style="color:var(--gold)">최고 ${CV_STAGE[best.kind]||""}</span><br>
        <span class="small">${Object.keys(cnt).map(k=>`${k} ${cnt[k]}회`).join(" · ")} <span style="opacity:.6">— ${list.map(x=>x.s).join(", ")}</span></span></span>
      <span class="meV">${list.length}회</span></div>`;
  };
  const compCard=`<div class="card">
    <h3>🌏 대회 성적</h3>
    ${compRow("🏆", divName(1), ["champ"])}
    ${compRow("🥇", divName(2), ["champ2"])}
    ${compRow("🎫", "승강 플레이오프", ["po"])}
    ${compRow("🌏", (function(){ try{ return eaclShort(); }catch(e){ return "EACL"; } })(), ["eacl","eaclRunner","eaclSF","eaclQF"])}
    ${compRow("🌍", (function(){ try{ return cwcShort(); }catch(e){ return "CWC"; } })(), ["cwc","cwcRunner","cwcSF","cwcQF"])}
    ${compRow("⬆️", "승격", ["promo"])}
    ${compRow("⬇️", "강등", ["releg"])}
  </div>`;

  return sum + troCard + spCard + seasonCard + compCard;
}
function home(){
  const t=userTeam();
  const tbl=tableOf(t.div); const pos=tbl.findIndex(x=>x.isUser)+1;
  let mh="";
  /* ⚠ 대회 경기(EACL·CWC)는 홈 리포트에 아예 뜨지 않았다 — 리그·PO 만 보고 있었다.
     아시아 결승을 치르고 돌아왔는데 홈 화면에는 지난 리그 경기가 걸려 있는 셈이었다. */
  if(lastMatch&&(lastMatch.type==="match"||lastMatch.type==="pomatch"||lastMatch.type==="eacl"||lastMatch.type==="cwc")){
    const {res,h,a,tag}=lastMatch;
    // "warn" 이 빠져 있어서 경고(옐로)·부상이 리포트에 하나도 안 나왔다.
    //   2D 엔진은 옐로를 "warn", 옛 엔진은 "card" 로 흘린다 — 둘 다 받아야 한다.
    const imp=res.events.filter(e=>["goal","red","card","warn","sub","bad","big","info"].includes(e.type));
    const st=res.st||{};
    const cardLine=(hy,ay,hr,ar)=>{
      const cell=(y,r)=>`${y?`🟨 ${y}`:""}${y&&r?" ":""}${r?`🟥 ${r}`:""}`||"–";
      return `<div class="small" style="display:flex;justify-content:space-between;padding:4px 2px;border-bottom:1px solid #21262d">
        <span>${cell(hy,hr)}</span><span style="color:var(--sub)">경고 · 퇴장</span><span>${cell(ay,ar)}</span></div>`;
    };
    const att0=lastMatch.att||0;
    mh=`<div class="card"><h3>${tag||"지난 경기"} 리포트</h3>
    <div class="vsRow"><span>${h.name}</span><span>${a.name}</span></div>
    <div class="scoreBig">${res.hg} : ${res.ag}</div>
    ${scLineHtml((res.sc&&res.sc.length)?res.sc:scFromEvents(res.events), h, a)}
    ${lastMatch.mom?momCard(lastMatch.mom):""}
    ${att0?`<div class="small" style="text-align:center;margin:-4px 0 6px;color:#c9d4e0">🏟️ ${stadOf(h).n} · 관중 <b style="color:#fff">${att0.toLocaleString()}</b>명${isSellout(h,att0)?' <span class="tag star">매진</span>':""}</div>`:""}
    ${cardLine(st.hY||0, st.aY||0, st.hR||0, st.aR||0)}
    <div id="matchLog">${imp.map(e=>`<div class="evt-${e.type}"><b>${e.min}'</b> ${e.t?`[${e.t}] `:""}${e.txt}</div>`).join("")||'<div class="info">주요 장면 없이 종료되었습니다.'}</div></div>
    <div class="row" style="align-items:flex-start">
      ${(function(){ try{ return passMapCard(res, h, a); }catch(e){ return ""; } })()}
      ${(function(){ try{ return momentumCard(res, h, a); }catch(e){ return ""; } })()}
      ${(function(){ try{ return acReportCard(res, h, a); }catch(e){ return ""; } })()}
    </div>`;
  }
  const next=nextOpponent();
  /* 📜 ⚠ 요청 원문 — 「감독 오피스 메뉴에서 감독의 경력을 볼 수 있는 탭을 만들자.
     팀 경력, 리그 성적, 대회 성적 시즌별로 다 나오는거지」.
     오피스는 지금까지 탭이 없는 단일 화면이었다 — 기존 화면을 「현황」으로 두고 탭을 연다. */
  const ofcBtn=(k,l)=>`<button class="mini ${ofcTab===k?"sel":""}" style="padding:8px 16px;font-size:14px" onclick="ofcSetTab('${k}')">${l}</button>`;
  const ofcTabs=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px">${ofcBtn("now","🏠 현황")}${ofcBtn("cv","📜 경력")}</div>`;
  if(ofcTab==="cv") return `<h2>🏠 감독 오피스</h2>${ofcTabs}${(function(){ try{ return careerView(); }catch(e){ return `<div class="card"><p class="small">경력을 불러오지 못했습니다: ${e.message}</p></div>`; } })()}`;
  return `<h2>🏠 감독 오피스</h2>
  ${ofcTabs}
  ${h2aTip()}
  ${G.phase==="seasonEnd"?seasonEndPanel():""}
  ${mgrCtCard()}
  ${situationCard()}
  <div class="row">
    <div class="card"><h3>구단 현황</h3>
      순위: <b>${pos}위</b> / ${tbl.length}팀 (${divName(t.div)})<br>
      ${t.W}승 ${t.Dw}무 ${t.L}패 · 득실 ${t.GF-t.GA>0?"+":""}${t.GF-t.GA}<br>
      스쿼드 전력(베스트XI): ${teamStars(t,"우리 팀")}<br>
      최근 5경기: ${t.form.slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")||"-"}<br>
      ${(function(){
        const yl=clamp(t.youthLv||1,1,FAC_MAX), tl=trainLv(t);
        const Y=YOUTH_LABEL[yl], L=TRAIN_LABEL[tl];
        /* 🎖️ 제보 — 「김천 상무는 유스 콜업이 없는 팀」. 콜업을 막았으면 표기도 별을 띄우면 안 된다. */
        const yTxt = isArmyTeam(t)
          ? `🌱 유스 <b style="color:var(--sub)">아카데미 없음</b> <span style="opacity:.7">— 선수는 입대로만 옵니다</span>`
          : `🌱 유스 ${facStars(yl)} ${Y.n}`;
        return `<span class="small" style="opacity:.85">${yTxt}`
          + ` &nbsp;·&nbsp; 🏋️ 훈련시설 ${facStars(tl)} ${L.n}</span>`;
      })()}</div>
    <div class="card"><h3>다음 경기</h3>${next}</div>
  </div>
  ${mh}
  ${newsCard()}
  ${moodCard()}
  ${pressCard()}
  ${trustCard()}`;
}
/* 뉴스 — 이적·영입·FA 등 구단 바깥 소식. 라커룸 분위기는 아래 '팀 분위기'로 뺐다. */
