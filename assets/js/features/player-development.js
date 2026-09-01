"use strict";
/* ---------- 선수 면담 ---------- */
let CURP=null, TALKMSG=null, PVTAB="profile", PVBACK="squad";
let RENEW=null, LOANUI=null;   // 재계약 협상 / 임대 협상 화면 상태
function showPlayer(pid, mode){
  if(VIEW!=="player") PVBACK=VIEW;
  CURP=pid; TALKMSG=null; TR_PAGE=1; PVTAB=(mode==="talk")?"talk":"profile";
  show("player");
}
function teamOfPlayer(p){ for(const id in G.teams){ if(G.teams[id].players.includes(p)) return G.teams[id]; } return null; }
// 막대 색도 숫자 색과 같은 눈금을 쓴다 — 같은 능력치가 화면마다 다른 색이면 읽는 사람만 헷갈린다
function attrColor(v){ return fmColor(attr20(v)); }
function attrRow(label,val){
  // val은 내부 원본 스케일(20~99) 그대로 받되, 화면에는 FM식 1~20 숫자로 환산해 보여준다 — 막대 길이는
  // 환산된 1~20 값을 다시 0~100%로 펼쳐서 계산하므로 기존과 시각적으로 거의 동일한 채움 정도를 유지한다.
  const disp=attr20(val);
  const pct=Math.round(disp/20*100);
  return `<div class="attrRow"><span class="an">${label}</span><div class="ab"><div class="af" style="width:${pct}%;background:${attrColor(val)}"></div></div><span class="av">${disp}</span></div>`;
}
/* FM 표기 색상 — 1~20 구간별.
   예전에는 14 이상이 전부 연두, 17 이상이 전부 초록이라 능력치 대부분이 초록으로 보였다.
   리그 평균이 14~15 근처에 몰려 있으니 "평균은 무채색"이어야 한 장에서 강약이 읽힌다.
   그래서 눈금을 여덟 칸으로 쪼개고 기준을 위로 올렸다.
     20      금색   — 리그에 몇 안 되는 값
     18~19   진초록 — 확실한 강점
     16~17   연두   — 강점
     14~15   회백색 — 평균 (여기가 가장 두껍다)
     12~13   회색   — 평균 이하
     9~11    주황   — 약점
     6~8     진주황 — 뚜렷한 약점
     1~5     빨강   — 치명적 */
function fmColor(v20){
  if(v20>=20) return "#e3b341";
  if(v20>=18) return "#2ea043";
  if(v20>=16) return "#56d364";
  if(v20>=14) return "#c9d1d9";
  if(v20>=12) return "#8b949e";
  if(v20>=9)  return "#d29922";
  if(v20>=6)  return "#f0883e";
  return "#f85149";
}
/* 추세 화살표 — 지난 사진(한 달 전) 대비 오르는 중인지 내려가는 중인지 */
function trendMark(p, key){
  const tr=p&&p.trend&&p.trend[key];
  if(tr>0) return `<span class="fmUpT" title="상승 중">▲</span>`;
  if(tr<0) return `<span class="fmDnT" title="하락 중">▼</span>`;
  return `<span class="fmFlatT"></span>`;
}
function fmRow(key, raw, p){
  const v=attr20(raw);
  const clickable = p && p.hist && p.hist.length>=2;
  return `<div class="fmA${clickable?" fmClick":""}"${clickable?` onclick="openAttrChart(${p.id},'${key}')"`:""}>`+
    `<span class="n">${ATTR_LABEL_FM[key]||key}</span>`+
    `<span class="v" style="color:${fmColor(v)}">${trendMark(p,key)}${v}</span></div>`;
}
function fmCol(title, keys, src, fb, p){
  return `<div class="fmCol"><h4>${title}</h4>${keys.map(k=>fmRow(k, (src&&src[k])||fb, p)).join("")}</div>`;
}
/* ── 능력치 성장 그래프 — 한 달 간격으로 찍어 둔 사진을 이어 그린다 */
function openAttrChart(pid, key){
  const p=findAnyPlayer(pid); if(!p) return;
  const h=(p.hist||[]).filter(x=>x.v && x.v[key]!=null);
  const box=$("#gcModal"); box.className="";
  if(h.length<2){
    box.innerHTML=`<div class="gcOverlay"><div class="gcBox"><div class="gcBody">
      <b>${p.name} — ${ATTR_LABEL_FM[key]||key}</b><br><br>
      <span class="small">아직 기록이 충분하지 않습니다. 한 달에 한 번 능력치를 기록하므로,
      두 달 정도 지나야 그래프가 그려집니다.</span></div>
      <div class="gcBtns"><button class="gcOk">닫기</button></div></div></div>`;
    // 모달을 닫으면 지금 보고 있는 화면을 다시 그린다. 이게 없으면 예산 증액 요청 뒤에
  // "2/3회" 같은 숫자가 그대로 남아 있다가, 다른 탭에 다녀와야 갱신됐다.
  box.querySelector(".gcOk").onclick=()=>{ box.className="hidden"; box.innerHTML="";
    if(typeof VIEW!=="undefined" && VIEW && !liveM){ try{ show(VIEW); }catch(e){} } };
    return;
  }
  const vals=h.map(x=>x.v[key]/10);
  const lo=Math.max(0, Math.floor(Math.min(...vals)-1)), hi=Math.min(20, Math.ceil(Math.max(...vals)+1));
  const span=Math.max(1, hi-lo);
  const W=430, H=170, PL=34, PR=12, PT=14, PB=26;
  const px=i=>PL+(W-PL-PR)*(h.length===1?0.5:i/(h.length-1));
  const py=v=>PT+(H-PT-PB)*(1-(v-lo)/span);
  const pts=vals.map((v,i)=>`${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const first=vals[0], last=vals[vals.length-1], diff=Math.round((last-first)*10)/10;
  const col = diff>0.05?"#3fb950" : diff<-0.05?"#f85149" : "#8b949e";
  const grid=[lo, lo+span/2, hi].map(v=>`
    <line x1="${PL}" y1="${py(v)}" x2="${W-PR}" y2="${py(v)}" stroke="#21262d" stroke-width="1"/>
    <text x="${PL-6}" y="${py(v)+3.5}" fill="#8b949e" font-size="10" text-anchor="end">${Math.round(v*10)/10}</text>`).join("");
  const lbl=(x)=>x.s+"." + (G.cal&&dateLabel? String(dateLabel(x.d)).split("(")[0] : x.d);
  const xlab=[0, h.length-1].map(i=>`<text x="${px(i)}" y="${H-8}" fill="#8b949e" font-size="10" text-anchor="${i===0?"start":"end"}">${lbl(h[i])}</text>`).join("");
  const dots=vals.map((v,i)=>`<circle cx="${px(i)}" cy="${py(v)}" r="${i===vals.length-1?3.4:2.2}" fill="${col}"/>`).join("");
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox" style="max-width:480px">
    <div class="gcBody">
      <b>${p.name}</b> <span class="small">${G.season-p.by}세 · ${p.pos}</span><br>
      <b style="font-size:15px">${ATTR_LABEL_FM[key]||key}</b>
      <span style="color:${col};font-weight:800">${diff>0?"▲ +":diff<0?"▼ ":"● "}${diff===0?"변화 없음":Math.abs(diff)}</span>
      <span class="small">(기록 ${h.length}회 · 최근 ${Math.round(last*10)/10})</span>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin-top:8px;background:#0d1117;border-radius:6px">
        ${grid}${xlab}
        <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round"/>
        ${dots}
      </svg>
      <div class="small" style="margin-top:6px">한 달에 한 번 측정합니다. 어린 선수를 많이 뛰게 하고 훈련 강도를 높이면 곡선이 가팔라집니다.</div>
    </div>
    <div class="gcBtns"><button class="gcOk">닫기</button></div></div></div>`;
  const close=()=>{ box.className="hidden"; box.innerHTML=""; };
  box.querySelector(".gcOk").onclick=close;
  box.querySelector(".gcOverlay").onclick=(e)=>{ if(e.target.classList.contains("gcOverlay")) close(); };
}
function fmAttrTable(p){
  const a=p.attr||{}, fb=p.ovr;
  const left = p.pos==="GK"
    ? fmCol("골키퍼 능력", GK_ORDER, p.gkA, fb, p)
    : fmCol("기술적 능력", TECH_ORDER, a, fb, p);
  const gkGrade = p.pos==="GK" ? clamp(Math.round(attr20(p.ovr)/4),1,5) : null;
  return `<div class="fmWrap">
    <div class="fmAttrs">
      ${left}
      ${fmCol("정신적 능력", MENT_ORDER, a, fb, p)}
      ${fmCol("신체", PHYS_ORDER, a, fb, p)}
    </div>
    <div class="fmSide">
      <div class="r"><span class="k">등번호</span><span>${p.no?"<b>"+p.no+"</b>번":"-"}</span></div>
      <div class="r"><span class="k">생년월일</span><span>${birthText(p)}</span></div>
      <div class="r"><span class="k">성격</span><span>${PERS_N[p.pers||0]}</span></div>
      <div class="r"><span class="k">언론 설명</span><span>${mediaDesc(p)}</span></div>
      ${gkGrade?`<div class="r"><span class="k">골키퍼 등급</span><span>${gkGrade}</span></div>`:""}
      <div class="r"><span class="k">신장</span><span>${p.h||178} cm</span></div>
      <div class="r"><span class="k">체중</span><span>${p.w||74} kg</span></div>
      <div class="r" style="display:block"><span class="k">선수 특성</span>${traitListHtml(p)}</div>
    </div>
  </div>`;
}
/* 생년월일 — 실명 등록 선수는 월·일까지(p.bd = "MM/DD"), 자동 생성 선수는 출생 연도만 안다 */
function birthText(p){
  /* ⚠ 제보 — 프로필 위쪽 나이는 시즌을 따라가는데 여기만 2026 고정이었다 */
  const age=((G&&G.season)||CUR_YEAR)-p.by;
  if(p.bd){ const [m,d]=String(p.bd).split("/"); return `${p.by}년 ${+m}월 ${+d}일 (${age}세)`; }
  return `${p.by}년생 (${age}세)`;
}
/* 언론이 이 선수를 부르는 방식 — 능력치 프로필에서 뽑는다 */
function mediaDesc(p){
  const a=p.attr||{};
  if(p.pos==="GK") return "수문장";
  if(a.fin>=82&&p.pos==="FW") return "스트라이커";
  if(a.dri>=82&&a.pac>=80) return "윙어";
  if(a.vis>=82&&a.pas>=82) return "플레이메이커";
  if(a.tck>=82&&a.mar>=80) return "수비수";
  if(a.wor>=82&&a.sta>=82) return "박스 투 박스";
  return {GK:"수문장",DF:"수비수",MF:"미드필더",FW:"공격수"}[p.pos]||"선수";
}
/* ═══════════════════════════════════════════════════════════════
   특성 훈련 — 경험치와 포인트
   선수는 뛰면서 배운다. 경기에 나가고, 잘하고, 감독과 이야기를 나누며 쌓인 것이
   특성 경험치(0~100)가 되고, 100이 차면 특성 포인트 1점이 된다.
   그 포인트로 새 선호 플레이를 익히거나, 몸에 밴 나쁜 버릇을 지운다.
   ⚠ 포인트는 선수 개인의 것이다 — 감독의 자원이 아니라 그 선수가 쌓은 시간이다.
═══════════════════════════════════════════════════════════════ */
const TRAIT_MAX=5;              // 한 선수가 가질 수 있는 특성 수
const TXP_FULL=100;             // 이만큼 쌓이면 포인트 1점
const TR_PER=5;                 // 습득 목록 한 쪽에 다섯 개
let TR_PAGE=1;
function trGo(n, pid){ TR_PAGE=Math.max(1,n|0); show("player"); }
function traitPts(p){ return (p&&p.tpt)||0; }
function traitXp(p){ return clamp(Math.round(((p&&p.txp)||0)*10)/10, 0, TXP_FULL); }
/* 경험치를 넣고, 100을 넘으면 포인트로 바꾼다 */
function addTraitXp(p, amt, why){
  if(!p || !(amt>0)) return 0;
  p.txp=((p.txp||0)+amt);
  let got=0;
  while(p.txp>=TXP_FULL){ p.txp-=TXP_FULL; p.tpt=(p.tpt||0)+1; got++; }
  if(got){
    const t=teamOfPlayer(p);
    if(t&&t.isUser){
      addMood(`✨ <b>${p.name}</b> 선수가 <b>특성 포인트 ${got}점</b>을 얻었습니다. (보유 ${p.tpt}점 — 선수 프로필에서 사용)`);
    }
  }
  return got;
}
/* 한 경기에서 얻는 경험치.
   ① 뛴 시간이 기본이다 — 안 뛰면 안 는다
   ② 잘하면(평점) 더, 공격 포인트는 확실한 가산
   ③ 감독과의 관계(호감도)와 사기가 배우려는 자세를 만든다
   ④ 어릴수록 빨리 배우고, 승부욕·활동량·판단력이 높으면 흡수가 빠르다
   ⑤ 큰 경기(더비)에서의 활약은 오래 남는다 */
function traitXpForMatch(p, mins, rating, goals, assists, opts){
  if(!p || mins<=0) return 0;
  const a=p.attr||{}, age=G.season-p.by;
  let x = (mins/90)*5.0;                                  // 풀타임 한 경기 ≈ 5
  if(rating>=8.40) x+=2.2; else if(rating>=7.35) x+=1.2; else if(rating<6.30) x-=0.5;
  x += (goals||0)*1.6 + (assists||0)*1.0;
  const aff0=(typeof aff==="function")?aff(p):50;
  x *= clamp(0.86 + (aff0-50)/100*0.60, 0.84, 1.32);      // 감독과의 관계 — 스킨십이 배움의 속도를 바꾼다
  x *= clamp(0.85 + ((p.morale||70)-60)/100*0.5, 0.8, 1.2);
  x *= age<=21 ? 1.45 : age<=24 ? 1.22 : age<=28 ? 1.0 : age<=31 ? 0.82 : 0.62;
  x *= clamp(0.86 + (attr20(a.det||60)-10)*0.016 + (attr20(a.wor||60)-10)*0.010, 0.8, 1.25);
  if(opts && opts.derby) x*=1.25;
  if(p.mentorOf || p.mentor) x*=1.10;                     // 멘토링 관계는 배움을 돕는다
  return Math.max(0, Math.round(x*100)/100);
}
/* 지금 이 선수가 익힐 수 있는 특성 — 능력치 조건을 만족하고, 이미 있거나 상충하지 않는 것 */
/* ── 포지션별로 배울 수 있는 것이 다르다 ──────────────────────────
   센터백에게 오버헤드킥을 가르치는 건 훈련이 아니라 장난이다.
   ① 분류별 기본 허용 포지션 ② 특정 자리 전용 ③ 측면 자원 전용 세 겹으로 거른다.
   능력치 조건(req)은 보지 않는다 — 그건 "지금 잘하느냐"이지 "배울 수 있느냐"가 아니다. */
const TRAIT_CAT_POS={
  "온 더 볼":        ["DF","MF","FW"],
  "공격시 위치 선정": ["DF","MF","FW"],
  "패스":            ["GK","DF","MF","FW"],
  "골 결정력":       ["MF","FW"],
  "규율":            ["GK","DF","MF","FW"],
  "수비":            ["DF","MF"],
  "개인기":          ["DF","MF","FW"],
  "골키핑":          ["GK"]
};
/* 자리 전용 — 이 포지션에서만 배울 수 있다 */
const TRAIT_POS_ONLY={
  gkFeet:["GK"],
  /* 「득점보다 패스」는 슛을 고르는 자리에서만 의미가 있다 — 골키퍼·수비수에게는 붙지 않는다 */
  looksForPass:["MF","FW"],
  /* 🛡️ 중원 규율 — 미드필더 전용 두 개, 「위치 고수」는 수비수도 가질 수 있다 */
  marksMid:["MF"], backFill:["MF"], holdsPos:["MF"],
  staysBack:["DF"], marksTight:["DF","MF"], bringsOut:["DF"],
  boxPlayer:["FW"], backToGoal:["FW"], breaksOffside:["FW"], movesChannels:["FW"],
  arrivesLate:["MF"], comesDeep:["MF","FW"], dictatesTempo:["DF","MF"],
  overhead:["FW"], firstTime:["MF","FW"], lobKeeper:["MF","FW"], roundKeeper:["MF","FW"]
};
/* 측면 자원 전용 — 대표 포지션이 측면이어야 한다 */
const TRAIT_WIDE_ONLY=["runsLeft","runsRight","crossEarly","hugsLine","cutsInside"];
const TR_WIDE=["LW","RW","LM","RM","LB","RB","LWB","RWB","LAM","RAM"];
const TR_LEFT=["LW","LM","LB","LWB","LAM"], TR_RIGHT=["RW","RM","RB","RWB","RAM"];
function traitMeetsReq(p, T){
  try{ return !!T.req(p.attr||{}, p); }catch(e){ return false; }
}
/* 이 선수가 이 특성을 배울 수 있는 자리인가 */
function traitPosOK(p, T){
  const pos=p.pos, pref=prefSlotOf(p);
  const only=TRAIT_POS_ONLY[T.k];
  if(only) return only.includes(pos);
  if(TRAIT_WIDE_ONLY.includes(T.k)){
    if(!TR_WIDE.includes(pref)) return false;
    if(T.k==="runsLeft")  return TR_LEFT.includes(pref);
    if(T.k==="runsRight") return TR_RIGHT.includes(pref);
    return true;
  }
  const cat=TRAIT_CAT_POS[T.c];
  return !cat || cat.includes(pos);
}
function learnableTraits(p){
  const have=(p.traits||[]);
  const conflict=(k)=>TRAIT_CONFLICT.some(([x,y])=>(x===k&&have.includes(y))||(y===k&&have.includes(x)));
  return TRAITS.filter(t=>{
    if(have.includes(t.k)) return false;
    if(conflict(t.k)) return false;
    if(!traitGrpOK(p, t.k)) return false;      // 🧩 자리 분류 — 어울리지 않는 자리는 배울 수 없다
    return traitPosOK(p, t);
  });
}
function buyTrait(pid, key){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p) return;
  const T=TRAIT_BY_KEY[key]; if(!T) return;
  if(traitPts(p)<1){ notify("특성 포인트가 부족합니다.","warn"); return; }
  if(!p.traits) p.traits=[];
  if(p.traits.length>=TRAIT_MAX){ notify(`특성은 최대 ${TRAIT_MAX}개까지입니다. 먼저 하나를 지우세요.`,"warn"); return; }
  if(!learnableTraits(p).some(x=>x.k===key)){ notify("지금은 익힐 수 없는 특성입니다.","warn"); return; }
  const fit=traitMeetsReq(p, T);
  showConfirm(`<b>✨ ${p.name} — ${T.n}</b>\n\n<span class="small">${T.e} · ${traitFxText(T)}</span>\n\n특성 포인트 <b>1점</b>을 써서 이 선호 플레이를 몸에 익힙니다. 적용은 즉시입니다.\n\n· 보유 포인트 ${traitPts(p)}점 → ${traitPts(p)-1}점\n· 특성 ${p.traits.length}/${TRAIT_MAX}개 → ${p.traits.length+1}/${TRAIT_MAX}개${fit?"":`\n\n<span style="color:var(--gold)">⚠ 이 선수의 능력치는 이 플레이에 어울리지 않습니다. 습관은 붙지만 효과는 크지 않을 수 있습니다.</span>`}`,
    ()=>{
      p.tpt=traitPts(p)-1; p.traits.push(key);
      p.morale=clamp((p.morale||70)+3,25,99);
      notify(`✨ <b>${p.name}</b>이(가) <b>${T.n}</b> 특성을 익혔습니다.`,"good");
      addMood(`✨ ${p.name} 선수가 새 선호 플레이를 익혔습니다 — <b>${T.n}</b>`);
      saveGame(); show("player");
    }, {okLabel:"익힌다", cancelLabel:"취소"});
}
function dropTrait(pid, key){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p) return;
  const T=TRAIT_BY_KEY[key]; if(!T) return;
  if(traitPts(p)<1){ notify("특성 포인트가 부족합니다. 지우는 데도 1점이 듭니다.","warn"); return; }
  showConfirm(`<b>🧹 ${p.name} — ${T.n} 지우기</b>\n\n몸에 밴 습관을 바꾸는 일입니다. 특성 포인트 <b>1점</b>이 듭니다.\n\n· 보유 포인트 ${traitPts(p)}점 → ${traitPts(p)-1}점`,
    ()=>{
      p.tpt=traitPts(p)-1;
      p.traits=(p.traits||[]).filter(k=>k!==key);
      notify(`🧹 <b>${p.name}</b>의 <b>${T.n}</b> 특성을 지웠습니다.`,"info");
      saveGame(); show("player");
    }, {okLabel:"지운다", cancelLabel:"취소", danger:true});
}
/* 프로필의 특성 카드 — 경험치 막대, 포인트, 보유/습득 목록 */
/* 🧩 특성의 「자리」 뱃지 — 이 선수 자리의 대표 특성이면 금색으로 강조한다 */
function traitGrpTag(p, k){
  const g=traitGroups(k);
  const home=g[0];
  const mine=(p && home===p.pos);
  const lb=(g.length>=4) ? "공통" : g.map(x=>TRAIT_GRP_KO[x]||x).join("·");
  return `<span class="trGrp${mine?" on":""}" title="${lb} 특성${mine?" — 이 선수의 자리에 딱 맞습니다":""}">${TRAIT_GRP_KO[home]||home}</span>`;
}
function traitTrainCard(p){
  const mine = teamOfPlayer(p)===userTeam();
  const xp=traitXp(p), pt=traitPts(p);
  const have=(p.traits||[]).filter(k=>TRAIT_BY_KEY[k]);
  /* 목록 순서 — 이 선수 자리의 대표 특성부터, 그 다음 어울리는 특성, 그리고 갈래별로 */
  const learn=(mine?learnableTraits(p):[]).slice().sort((x,y)=>{
    const hx=(traitHomeGrp(x.k)===p.pos)?0:1, hy=(traitHomeGrp(y.k)===p.pos)?0:1;
    if(hx!==hy) return hx-hy;
    if(x.c!==y.c) return x.c<y.c?-1:1;
    return (y.w||0)-(x.w||0);
  });
  const byCat={}; for(const t of learn){ (byCat[t.c]=byCat[t.c]||[]).push(t); }
  const bar=`<div class="txpBar"><div class="txpFill" style="width:${xp}%"></div><span>${xp.toFixed(0)} / ${TXP_FULL}</span></div>`;
  const haveHtml = have.length ? have.map(k=>{ const T=TRAIT_BY_KEY[k];
      return `<div class="trRow"><span class="trN" title="${T.e}">${T.n}</span>${traitGrpTag(p,k)}<span class="trC">${T.c}</span>
        ${mine?`<button class="mini trDel" onclick="dropTrait(${p.id},'${k}')" ${pt<1?"disabled":""} title="특성 포인트 1점으로 지웁니다">🧹</button>`:""}</div>`;
    }).join("") : `<p class="small" style="margin:4px 0">아직 몸에 밴 선호 플레이가 없습니다.</p>`;
  /* 한 번에 다섯 개씩 — 쉰 줄을 한꺼번에 뿌리면 아무것도 눈에 안 들어온다 */
  const per=TR_PER, last=Math.max(1, Math.ceil(learn.length/per));
  const pg=clamp(TR_PAGE||1, 1, last); TR_PAGE=pg;
  const page=learn.slice((pg-1)*per, pg*per);
  const pager = last<=1 ? "" : `<div class="trPager">
    <button class="trPg" ${pg===1?"disabled":""} onclick="trGo(${pg-1},${p.id})">‹</button>
    ${Array.from({length:last},(_,i)=>i+1).filter(n=>Math.abs(n-pg)<=2||n===1||n===last)
      .map((n,i,arr)=>(i>0&&n-arr[i-1]>1?`<span class="trPgGap">…</span>`:"")+
        `<button class="trPg ${n===pg?"on":""}" onclick="trGo(${n},${p.id})">${n}</button>`).join("")}
    <button class="trPg" ${pg===last?"disabled":""} onclick="trGo(${pg+1},${p.id})">›</button>
    <span class="trPgInfo">${learn.length}개 중 ${(pg-1)*per+1}~${Math.min(pg*per,learn.length)}</span></div>`;
  const learnHtml = !mine ? "" : (learn.length
    ? page.map(T=>`<div class="trRow ${traitMeetsReq(p,T)?"":"trOff"}">
          <span class="trTxt"><span class="trN" title="${T.e}${traitMeetsReq(p,T)?"":" — 능력치가 어울리지 않습니다"}">${traitMeetsReq(p,T)?"":"⚠ "}${T.n}
            ${traitGrpTag(p,T.k)}<span class="trCatIn">${T.c}</span></span>
          <span class="trC">${(Object.keys(T.fx||{})[0])?traitFxText(T):"—"}</span></span>
          <button class="mini trBuy" onclick="buyTrait(${p.id},'${T.k}')" ${(pt<1||have.length>=TRAIT_MAX)?"disabled":""}>1P 습득</button></div>`).join("")+pager
    : `<p class="small" style="margin:4px 0">이 포지션에서 익힐 수 있는 특성을 모두 배웠습니다.</p>`);
  return `<div class="card">
    <h3>✨ 선호 플레이 <span class="small">— 특성 ${have.length}/${TRAIT_MAX}개 · 보유 포인트 <b style="color:var(--gold)">${pt}P</b></span></h3>
    ${bar}
    <p class="small" style="margin:6px 0 2px;color:var(--sub)">경기에 나가고, 잘하고, 감독과 이야기를 나눌수록 쌓입니다. 100이 되면 1포인트.</p>
    <div class="trHead">보유 특성</div>${haveHtml}
    ${mine?`<div class="trHead">익힐 수 있는 특성 <span class="small">(${learn.length}) — ${TRAIT_GRP_KO[p.pos]||p.pos} 자리 대표 특성이 위로 옵니다</span></div>${learnHtml}`:""}
  </div>`;
}
function traitFxText(T){
  const M={cutIn:"안으로 접기", knockPast:"차놓고 제치기", dribble:"돌파 빈도", wide:"측면 치우침",
    hold:"볼 키핑", earlyCross:"얼리 크로스", crossFirst:"크로스 우선", cross:"크로스 빈도",
    lateRun:"늦은 침투", deep:"내려와 받기", forward:"전진",
    hugLine:"터치라인", breakLine:"뒷공간 침투", channels:"채널 침투", boxPlayer:"박스 안", oneTwo:"2대1",
    switchPlay:"사이드 전환", shoot:"슈팅 선택", killer:"스루패스", longPass:"롱패스", shortPass:"짧은 패스",
    longThrow:"롱스로인", overhead:"오버헤드", fkPower:"강한 프리킥", lob:"로빙 슛", round:"키퍼 제치기",
    place:"정확한 슛", longShot:"중거리 슛", power:"강한 슛", firstTimeShot:"원터치 슛", longFK:"먼 거리 프리킥",
    cardRisk:"카드 위험", slide:"슬라이딩", curl:"감아차기", escape:"압박 탈출",
    /* ⚠ 제보 — 「현재 위치를 고수 · 중원에서 단단히 마크 밑에 영어가 보인다」.
       (M[k]||k) 라서 표에 없는 키는 영어 그대로 찍혔다. 아래 둘이 빠져 있었다. */
    roam:"자리 이탈", press:"압박 가담",
    carryOut:"드리블 전개", repeatBeat:"반복 돌파", toFeet:"발밑 요구", gkSweeper:"스위퍼 키퍼",
    gkOut:"골문 이탈 성향", gkFist:"펀칭 성향", gkLong:"골킥 거리", gkPen:"페널티 선방", gkCmd:"수비 지휘",
    stayPos:"자리 고수", backFill:"뒷선 보강", tightMark:"밀착 마크"};
  /* 새 효과를 넣고 이 표에 적는 걸 잊으면 다시 영어가 보인다 — 못 찾은 키는 아예 감춘다 */
  const ks=Object.keys(T.fx||{}).filter(k=>M[k]);
  if(!ks.length) return "—";
  return ks.map(k=>M[k]+((T.fx[k]<0)?" ↓":"")).join(" · ");
}
/* 선호 플레이 목록 — 분류별로 묶어 보여준다 */
function traitListHtml(p){
  const ks=(p.traits||[]).filter(k=>TRAIT_BY_KEY[k]);
  if(!ks.length) return `<div style="margin-top:4px;color:var(--sub)">없음</div>`;
  const byCat={};
  for(const k of ks){ const t=TRAIT_BY_KEY[k]; (byCat[t.c]=byCat[t.c]||[]).push(t); }
  return Object.keys(byCat).map(c=>
    `<div style="margin-top:5px"><div style="color:var(--sub);font-size:11px">${c}</div>`+
    byCat[c].map(t=>`<div style="font-size:11.5px;line-height:1.35" title="${t.e}">· ${t.n}</div>`).join("")+
    `</div>`).join("");
}
/* ── 포지션 능숙도 (FM의 포지션 그림) ─────────────────────────────
   피치 위 각 자리에 원을 그리고, 능숙할수록 진한 초록으로 채운다.
   한 번도 해본 적 없는 자리(0)는 빈 원으로 두고 이름도 적지 않는다. */
const FAM_PITCH=[
  ["LW","ST","RW"],
  ["AML","AMC","AMR"],
  ["ML","MC","MR"],
  ["WBL","DM","WBR"],
  ["DL","DC","DR"],
  [null,"SW",null],
  [null,"GK",null]
];
/* ⚠ 예전에는 프로필 점만 따로 세 색(초록/노랑/빨강)을 썼다. 전술창의 능숙도 표기와 색이
   달라 같은 값인데 다른 색으로 보였고, 60 이상은 전부 같은 초록이라 90과 62를 구분할 수 없었다.
   이제 FAM_LV 한 곳만 보고 칠한다. */
function famColor(v){
  if(v<=0) return null;                  // 해본 적 없는 자리 — 표시하지 않음
  return famLevel(v).c;
}
/* ── 자리별 역할 적합도 보기 ─────────────────────────────────────
   프로필의 능숙도 판에서 자리를 누르면, 그 자리에서 맡을 수 있는 역할이 전부 뜬다.
   별점은 K리그 전체 선수와 비교한 값이고, 그 자리 능숙도까지 반영한 뒤의 값이다 —
   "적성은 5★인데 해 본 적이 없어 3★"인 경우를 감추지 않는다. */
const FAM_MAIN_SLOT={GK:"GK", SW:"SW", DC:"CB", DL:"LB", DR:"RB", WBL:"LWB", WBR:"RWB",
  DM:"DM", MC:"CM", ML:"LM", MR:"RM", AMC:"CAM", AML:"LAM", AMR:"RAM", LW:"LW", RW:"RW", ST:"ST"};
function showSlotRoles(pid, famKey){
  const p=findAnyPlayer(pid); if(!p) return;
  const slot=FAM_MAIN_SLOT[famKey]||"CM";
  const fam=clamp(Math.round((p.posFam&&p.posFam[famKey])||0),0,100);
  const L=famLevel(fam), mul=famStarMul(fam);
  const isGK=(famKey==="GK");
  if(isGK!==(p.pos==="GK")){
    showConfirm(`<b>${FAM_LABEL[famKey]}</b>\n\n${p.pos==="GK"?"골키퍼는 필드 자리를 소화할 수 없습니다.":"필드 플레이어는 골문에 설 수 없습니다."}`,
      ()=>{}, {okLabel:"닫기", cancelLabel:""});
    return;
  }
  const rows=rolesForSlot(slot).map(R=>{
    const raw=Math.round(roleFit(p, R.k)*2)/2;
    const v=clamp(Math.round(raw*mul*2)/2, 0.5, 5);
    return {R, raw, v};
  }).sort((a,b)=>b.v-a.v || b.raw-a.raw);
  const line=(x)=>{
    const cut = x.raw>x.v ? `<span class="small" style="color:var(--sub)"> (적성 ${x.raw}★)</span>` : "";
    return `<div class="srRow">
      <span class="srN">${x.R.n}</span>
      <span class="srStar">${roleStars(x.v)}<b class="small" style="color:var(--sub);margin-left:4px">${x.v}</b>${cut}</span>
      <span class="srD">${(x.R.duty||[]).map(d=>DUTY_N[d]||d).join(" · ")}</span>
    </div>`;
  };
  const best=rows[0];
  showConfirm(
    `<b style="font-size:15.5px">${FAM_LABEL[famKey]} — ${p.name}</b>\n`+
    `<span class="small">능숙도 <b style="color:${L.c}">${fam} · ${L.n}</b>`+
    `${mul<1?` <span style="color:var(--sub)">(별점이 ${Math.round((1-mul)*100)}% 깎입니다)</span>`:""}`+
    `${best?` · 이 자리 최적 역할 <b style="color:var(--gold)">${best.R.n}</b>`:""}</span>\n\n`+
    `<div class="srBox">${rows.map(line).join("")}</div>`+
    `<span class="small" style="color:var(--sub)">별점은 K리그 전체(1부+2부) 선수와 비교한 값입니다. 오른쪽은 그 역할에서 고를 수 있는 임무입니다.</span>`,
    ()=>{}, {okLabel:"닫기", cancelLabel:""});
}
function posFamHtml(p){
  if(!p.posFam) p.posFam=initPosFam(p); else migratePosFam(p);
  const cell=k=>{
    if(!k) return `<div class="fpCell fpEmpty"></div>`;
    const v=clamp(Math.round(p.posFam[k]||0),0,100);
    const c=famColor(v);
    if(!c) return `<div class="fpCell fpHit" title="${FAM_LABEL[k]} — 해 본 적 없는 자리 · 눌러서 역할별 별점 보기" onclick="showSlotRoles(${p.id},'${k}')"><div class="fpDot off"></div><div class="fpLb" style="opacity:.35">${k}</div></div>`;
    const L=famLevel(v);
    return `<div class="fpCell fpHit" title="${FAM_LABEL[k]} — ${L.n} (${v}/100) · 눌러서 역할별 별점 보기" onclick="showSlotRoles(${p.id},'${k}')">
        <div class="fpDot" style="background:${c};box-shadow:0 0 7px ${c}88"><span>${v}</span></div>
        <div class="fpLb">${k}</div></div>`;
  };
  return `<div class="fpWrap">
      <div class="fpBox">${FAM_PITCH.map(r=>`<div class="fpRow">${r.map(cell).join("")}</div>`).join("")}</div>
    </div>
    <div class="small" style="margin-top:6px;color:var(--sub)">
      ${FAM_LV.map(l=>`<span style="color:${l.c}">●</span> ${l.n}`).join(" · ")} ·
      <span style="opacity:.45">●</span> 해본 적 없음<br>
      <b style="color:var(--acc)">자리를 누르면</b> 그 자리에서 맡을 수 있는 역할과 별점이 뜹니다.<br>
      그 자리에서 경기를 뛸수록 올라갑니다. 어릴수록·팀워크와 판단력이 좋을수록 빨리 익히고,
      오래 뛰지 않은 자리는 아주 천천히 잊습니다.</div>`;
}
function profileCard(p){
  const owned=userTeam().players.some(x=>x.id===p.id);
  const tm=teamOfPlayer(p);
  const we=wageExpect(p.ovr,p.frn,(teamOfPlayer(p)||{}).div);
  const attrsHtml = `<h3 style="margin-top:14px">⚙️ 세부 능력치 <span class="small">(FM식 1~20 스케일 · 합계 ${dispOvr(p)})</span></h3>${fmAttrTable(p)}
    <h3 style="margin-top:14px">🧭 포지션 능숙도</h3>${posFamHtml(p)}
    ${traitTrainCard(p)}`;
  return `<div class="card">
    <h3>프로필</h3>
    <span class="sqNo">${p.no||"-"}</span> <span class="pos-${p.pos}"><b>${p.pos}</b></span> · ${G.season-p.by}세 · 능력 ${abilityStars(p)} / 잠재 ${potentialStars(p)} ${pTags(p)}<br>
    선호 포지션: <b>${p.prefPos||p.pos}</b> <span class="small">(전술판에서 이 포지션에 배치하면 <span style="color:#3fb950">●</span>, 같은 라인 내 다른 자리는 <span style="color:#d29922">●</span>, 아예 다른 라인은 <span style="color:#f85149">●</span> 로 표시됩니다)</span><br>
    ${tm?`소속: <b>${tm.name}</b> <span class="small">(${divName(tm.div)}${tm.isUser?" · 우리 팀":""})</span><br>`:`<span class="small">FA · 무소속</span><br>`}
    ${(function(){
      /* 🔁 임대 신분 — 지금 뛰는 팀과 계약을 맺은 팀이 다르다. 어느 쪽인지 분명히 적어 준다. */
      const L=p.loan; if(!L) return "";
      const own=G.teams[L.own], to=G.teams[L.to];
      const mine=userTeam();
      const back=L.half ? "시즌 중 복귀" : `${L.until} 시즌 복귀 예정`;   // until 시즌이 시작될 때 돌아온다
      if(mine && L.own===mine.id){
        return `<span style="color:#d2a8ff">🔁 <b>임대 중</b> — ${to?to.name:"타 구단"}에서 뛰고 있습니다</span>`
             + ` <span class="small" style="opacity:.75">· 원소속 <b>${own?own.short:"우리 팀"}</b> · ${back}${L.buy?" · 완전이적 옵션 있음":""}</span><br>`;
      }
      return `<span style="color:#d2a8ff">🔁 <b>임대 선수</b></span>`
           + ` <span class="small" style="opacity:.75">· 원소속 <b>${own?own.name:"타 구단"}</b>${own?` (${divName(own.div)})`:""} · ${back}${L.buy?" · 완전이적 옵션 있음":""}</span><br>`;
    })()}
    성격: <b>${PERS_N[p.pers||0]}</b> · 에이전트: ${AGENT_T[p.id%3].n}<br>
    사기: ${moodIcon(p)} <b>${mor(p.morale)}</b> · 컨디션 ${mor(p.cond)}%<br>
    ${owned?`감독 호감도: ${affBar(p)}<br>`:""}
    시즌: ${p.apps}경기 ${p.goals}골 ${p.assists}도움 ${p.apps?`· 평점 ${p.seasonRating.toFixed(2)}`:""}<br>
    ${p.armyDone?`<span style="color:#8b949e">🎖️ <b>군 복무 완료</b> <span class="small" style="opacity:.75">— 국군체육부대에서 전역했습니다</span></span><br>`:""}
    ${(p.momN&&p.momS===G.season)?`<span style="color:var(--gold)">🏅 이번 시즌 MOM <b>${p.momN}회</b>${(p.momCareer||0)>p.momN?` <span class="small" style="opacity:.7">(통산 ${p.momCareer}회)</span>`:""}</span><br>`:""}
    ${(p.eacl&&p.eacl.s===G.season&&p.eacl.apps>0)
      ? `<span style="color:#79c0ff">🌏 ${eaclShort()}: ${p.eacl.apps}경기 ${p.eacl.goals}골 ${p.eacl.assists}도움${p.eacl.rn?` · 평점 ${(p.eacl.rate/p.eacl.rn).toFixed(2)}`:""}</span><br>` : ""}
    연봉: ${p.wage}억 <span class="small">(적정 ${we}억)</span> · 계약 ${p.ct||1}년 남음 · 시장가치 ${marketValue(p)}억<br>
    ${careerTable(p, tm)}
    ${owned&&p.unhappy>0?`<div class="msg warn" style="margin-top:8px">💢 불만 단계 ${p.unhappy}/3 — 사유: <b>${p.uWhy}</b>${p.unhappy>=3?" (공개 이적 요청 상태!)":""}</div>`:""}
    ${owned&&p.promise?(()=>{ const _hold = p.inj>0?`부상(${p.inj}주)` : p.ban>0?`출장정지(${p.ban}경기)` : p.banE>0?`출전정지(${p.banE}경기)` : null;
      return `<div class="msg info" style="margin-top:8px">🤝 출전 약속 이행 중 — ${p.promise.rounds}R 내 ${p.promise.need-(p.apps-p.promise.apps0)}경기 더 출전 필요${
        _hold?` <b style="color:var(--gold)">· ⏸ ${_hold}으로 카운트 보류 중</b>`:""}${
        p.promise.skip?` <span class="small">(지금까지 ${p.promise.skip}R 보류)</span>`:""}</div>`; })():""}
    ${owned&&p.sulk>0?`<div class="msg warn" style="margin-top:8px;border-color:var(--red)">🤬 <b>태업 중</b> (${p.sulk}R 남음) — 경기 출전 불가. 평소 화법은 통하지 않습니다. 이적을 설득해 보세요.</div>`:""}
    ${attrsHtml}
  </div>`;
}
/* 📚 최근 5시즌 커리어 — 어느 팀에서 몇 경기를 뛰고 무엇을 남겼는가.
   숫자만 보면 선수가 도구 같지만, 내력이 붙으면 사람이 된다. */
function careerTable(p, tm){
  const rec=Array.isArray(p.rec)?p.rec.slice():[];
  const curLegs=(function(){ try{ return seasonLegs(p); }catch(e){ return null; } })();
  const cur={s:G.season, sh:(tm&&tm.short)||"", d:(tm&&tm.div)||0,
             ap:p.apps||0, g:p.goals||0, a:p.assists||0,
             r:(p.apps? Math.round((p.seasonRating||0)*100)/100 : 0), now:1,
             legs: curLegs ? curLegs.map(x=>({sh:x.sh, ap:x.ap, g:x.g, a:x.a, r:x.r})) : null};
  const rows=rec.concat(cur.ap>0||rec.length?[cur]:[]).slice(-6).reverse();
  if(!rows.length) return "";
  const tot=rows.reduce((s,x)=>({ap:s.ap+x.ap, g:s.g+x.g, a:s.a+x.a}), {ap:0,g:0,a:0});
  const rate=(x)=>x.r? x.r.toFixed(2) : "-";
  /* 🏅 수상 이력 — 이달의 선수·시즌 개인상 (요청 — 배선) */
  const accLine=(function(){
    try{
      const A=p.acc||{}; const bits=[];
      const add=(k,n,ic)=>{ if(A[k]) bits.push(`${ic} ${n}${A[k]>1?` ${A[k]}회`:""}`); };
      add("mvp","MVP","🥇"); add("top","득점왕","⚽"); add("ast","도움왕","🅰️");
      add("xi","베스트 11","⭐"); add("young","영플레이어","🌱"); add("gk","GK상","🧤");
      add("motm","이달의 선수","🏅");
      if(!bits.length) return "";
      return `<div class="small" style="margin-top:6px;padding:5px 8px;background:#0d1117;border:1px solid #21262d;border-radius:7px">
        🏆 <b>수상</b> — ${bits.join(" · ")}</div>`;
    }catch(e){ return ""; }
  })();
  return accLine + `<details style="margin-top:8px"><summary class="small" style="cursor:pointer">
      📚 최근 커리어 — ${rows.length}시즌 ${tot.ap}경기 ${tot.g}골 ${tot.a}도움${(p.career||0)?` <span style="opacity:.6">· 통산 ${p.career}경기</span>`:""}</summary>
    <div class="tblScroll" style="margin-top:6px"><table>
      <tr><th>시즌</th><th style="text-align:left">소속</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>
      ${rows.map(x=>{
        const L=Array.isArray(x.legs)&&x.legs.length>=2 ? x.legs : null;
        /* 📚 한 시즌에 여러 팀을 거쳤다면 소속 칸에 경로를 적고, 그 아래 구간별 성적을 나눠 보여 준다.
           그러지 않으면 「현 소속에서만 낸 기록」으로 오해하게 된다 (제보). */
        const head=`<tr style="${x.now?"background:rgba(80,160,255,.10);font-weight:700":""}">
        <td>${x.s}${x.now?' <span class="small" style="opacity:.6">진행 중</span>':""}</td>
        <td style="text-align:left">${L?L.map(y=>y.sh||"무소속").join(' <span style="opacity:.5">→</span> ')
                                       :(x.sh||'<span class="small" style="opacity:.6">무소속</span>')}${(!L&&x.d)?`<span class="small" style="opacity:.55"> ${x.d}부</span>`:""}</td>
        <td>${x.ap}</td><td><b>${x.g}</b></td><td>${x.a}</td>
        <td style="color:${x.r>=7.2?"var(--green)":x.r>=6.7?"var(--gold)":x.r?"var(--sub)":"transparent"}">${rate(x)}</td></tr>`;
        if(!L) return head;
        /* 한 경기도 뛰지 않은 구간은 줄을 만들지 않는다 — 경로(소속 칸)에는 그대로 남는다 */
        return head + L.filter(y=>y.ap>0).map(y=>`<tr class="small" style="opacity:.85">
          <td></td><td style="text-align:left;padding-left:14px;color:var(--sub)">└ ${y.sh||"무소속"}</td>
          <td style="color:var(--sub)">${y.ap}</td><td style="color:var(--sub)">${y.g}</td>
          <td style="color:var(--sub)">${y.a}</td>
          <td style="color:var(--sub)">${y.r?y.r.toFixed(2):"-"}</td></tr>`).join("");
      }).join("")}
    </table></div>
    <p class="small" style="opacity:.6;margin-top:4px">시즌이 끝날 때마다 그해 기록이 여기에 쌓입니다 (최근 ${CAREER_KEEP}시즌).
      한 시즌에 여러 팀을 거쳤다면 <b>전 소속 → 옮긴 팀</b> 순서로 적고, 아래에 구간별 성적을 나눠 보여 줍니다.</p>
  </details>`;
}
/* ═══════════════════════════════════════════════════════════════
   👋 뺨을 후려친다 — 이 게임에서 감독이 할 수 있는 가장 위험한 행동
   명분이 있으면 라커룸이 침묵으로 인정하고, 없으면 커리어가 끝날 수도 있다.
   ⚠ 명분은 '누가 봐도 잘못한 게 있는가'다. 태업·이적 거부·심각한 부진·징계·불만 누적.
═══════════════════════════════════════════════════════════════ */
function slapCase(p){
  const t=userTeam(), reasons=[];
  let g=0;
  if(p.sulk>0){ g+=42; reasons.push(["태업 중 — 훈련을 거부하고 있다", 42]); }
  if(p.noMove && (p.unhappy||0)>0){ g+=18; reasons.push(["이적을 막아 놓고 팀에 도움도 안 된다", 18]); }
  if((p.unhappy||0)>=3){ g+=22; reasons.push(["공개 이적 요구 (불만 3/3)", 22]); }
  else if((p.unhappy||0)===2){ g+=10; reasons.push(["불만 2/3", 10]); }
  if((p.apps||0)>=5 && (p.seasonRating||0)>0 && p.seasonRating<6.30){ g+=26; reasons.push([`심각한 부진 (평점 ${(p.seasonRating||0).toFixed(2)})`, 26]); }
  else if((p.apps||0)>=5 && (p.seasonRating||0)>0 && p.seasonRating<6.50){ g+=12; reasons.push([`부진 (평점 ${(p.seasonRating||0).toFixed(2)})`, 12]); }
  if((p.ban||0)>0){ g+=16; reasons.push([`출장 정지 ${p.ban}경기 — 팀에 피해를 줬다`, 16]); }
  if((p.cond||90)<62 && (p.apps||0)>=3){ g+=8; reasons.push(["몸 관리 실패 (컨디션 "+Math.round(p.cond)+"%)", 8]); }
  if(t.form && t.form.slice(-4).filter(f=>f==="L").length>=3 && (p.apps||0)>=3){ g+=10; reasons.push(["팀은 4경기 중 3패 — 주전으로서 책임", 10]); }
  /* 반대로 명분을 깎는 것들 */
  if((p.apps||0)>=5 && (p.seasonRating||0)>=7.35){ g-=30; reasons.push([`오히려 잘하고 있다 (평점 ${p.seasonRating.toFixed(2)})`, -30]); }
  if(G.season-p.by<=20){ g-=18; reasons.push([`${G.season-p.by}세 — 아직 어린 선수다`, -18]); }
  if(p.inj>0){ g-=20; reasons.push(["부상으로 재활 중인 선수다", -20]); }
  if(aff(p)>=70){ g-=10; reasons.push(["감독을 믿고 따르던 선수다", -10]); }
  return {g:clamp(g, -60, 100), reasons};
}
/* 명분과 선수 성향이 함께 결정한다 — 받아들이느냐, 터지느냐 */
function slapOutcome(p){
  const c=slapCase(p), A=p.attr||{}, pers=p.pers||0;
  let ok = 0.10 + c.g*0.0075;
  ok += (attr20(A.det||60)-10)*0.020;          // 승부욕 있는 선수는 "내 탓"으로 받는다
  ok += (aff(p)-50)*0.004;
  ok += (pers===0?0.10 : pers===1?-0.04 : pers===2?0.02 : -0.16);   // 다혈질은 그 자리에서 받아친다
  if(G.season-p.by>=31) ok-=0.08;              // 고참에게 손을 대는 건 다른 문제다
  try{ ok += clamp((mgrPrestige()-20)/400, -0.03, 0.08); }catch(e){}
  return {ok:clamp(ok, 0.02, 0.82), g:c.g, reasons:c.reasons};
}
function openSlap(pid){
  if(wildOff()) return;
  const t=userTeam(), p=t.players.find(x=>x.id===pid); if(!p) return;
  const o=slapOutcome(p);
  const lv = o.g>=45?["명분 충분","var(--green)"] : o.g>=20?["어느 정도 명분 있음","var(--gold)"]
           : o.g>=0?["명분 약함","var(--red)"] : ["명분 없음 — 폭행일 뿐입니다","var(--red)"];
  showConfirm(
    `<b style="font-size:16px">👋 ${p.name} 선수의 뺨을 후려치시겠습니까?</b>\n\n`+
    `<div class="msg warn" style="margin:6px 0">🗣️ 감독: "너가 뭘 잘못했는지 알지?"</div>`+
    `· 명분: <b style="color:${lv[1]}">${lv[0]}</b> <span class="small">(${o.g>=0?"+":""}${o.g})</span>\n`+
    (o.reasons.length?o.reasons.map(r=>`  ${r[1]>0?"✔":"✖"} ${r[0]}`).join("\n")+"\n":"  ✖ 내세울 근거가 하나도 없습니다\n")+
    `· 받아들일 가능성: <b style="color:${o.ok>=0.5?"var(--green)":o.ok>=0.3?"var(--gold)":"var(--red)"}">${Math.round(o.ok*100)}%</b>\n\n`+
    `<span style="color:#ff9d95">⚠ 이것은 폭행입니다. 어긋나면 구단주·팬 신뢰가 무너지고, 연맹 제재금과 선수 합의금을 함께 물어야 합니다.\n감독 커리어가 여기서 끝날 수도 있습니다.</span>`,
    ()=>doSlap(pid), {okLabel:"👋 후려친다", cancelLabel:"🚪 손을 내린다", danger:true});
}
function doSlap(pid){
  const t=userTeam(), p=t.players.find(x=>x.id===pid); if(!p) return;
  const o=slapOutcome(p);
  const r=t.div===1?G.r1:G.r2;
  p.talkR=r;
  const pers=p.pers||0;
  const v={t:t.short, p:p.name};
  const win=Math.random()<o.ok;
  if(win){
    /* 통했다 — 라커룸이 조용해지고, 선수는 오히려 눈빛이 달라진다 */
    const was=p.sulk>0;
    p.sulk=0; p.unhappy=Math.max(0,(p.unhappy||0)-1); p.uWhy=p.unhappy?p.uWhy:"";
    affAdd(p, 8, "감독의 손찌검 — 받아들였다");
    p.morale=Math.round(clamp((p.morale||70)+10,25,99)*100)/100;
    p.cond=Math.round(clamp((p.cond||90)+4,55,100));
    t.morale=Math.round(clamp((t.morale||70)+2,40,99)*100)/100;
    const fine=mgrFine(1.0+R(11)/10, "선수 체벌 — 구단 자체 징계금");
    adjustTrust("owner", -3, "선수 체벌 (내부 종결)");
    G.press.rel=clamp(G.press.rel-4, 0, 100);
    const say=pick([
      `"...압니다. 죄송합니다. 다시는 이런 소리 안 듣겠습니다."`,
      `"맞을 짓 했습니다. 다음 경기에서 갚겠습니다."`,
      `"…고개를 들지 못하겠습니다. 제가 잘못했습니다."`,
      `"감독님이 저를 포기하지 않으셨다는 뜻으로 받겠습니다."`]);
    addMood(was?`👋 ${p.name}이(가) 훈련장에 돌아왔습니다. 아무도 그 이야기를 꺼내지 않습니다.`
                :`👋 라커룸이 조용합니다. ${p.name}은(는) 말없이 먼저 나가 몸을 풀었습니다.`);
    addNews(`👋 ${t.name} 감독, ${p.name}과 비공개 면담 — 구단은 "내부적으로 정리됐다"며 자체 징계금 ${fine}억을 부과했습니다.`, "warn", "club");
    socialFill(SOC.slapOk, 3+R(3), 0, v);
    fmkFill(FMK.slapOk, 2+R(2), v);
    if(mgrSeasons()===0 && (t.div===1?G.r1:G.r2)<=10){
      socialFill(SOC.slapNewMgrOk, 2+R(2), 0, v);
      adjustTrust("fans", -2, "부임 초기 군기잡기");
    }
    TALKMSG={txt:`${p.name}: ${say}`, d:10};
  } else {
    /* 터졌다 — 이건 폭행이고, 세상이 다 안다 */
    p.sulk=Math.max(p.sulk||0, 5+R(4));
    p.unhappy=3; p.uWhy="감독의 폭행"; p.noMove=false;
    p._slapR=(t.div===1?G.r1:G.r2);                 // 언제 맞았는가 — 사과 수용률이 시간에 따라 풀린다
    affAdd(p, -55, "감독의 폭행");
    /* 👀 목격자 — 라커룸의 2~3명이 "동료가 맞는 걸 봤다"는 이유로 불만을 갖는다.
       온화한 선수(pers 2)가 가장 크게 동요한다. 폭력은 맞은 사람만의 문제가 아니다. */
    {
      const wit=t.players.filter(q=>q!==p && !q.unhappy && q.inj<=0)
        .sort((a,b)=>((b.pers===2)?1:0)-((a.pers===2)?1:0) || Math.random()-0.5)
        .slice(0, 2+R(2));
      for(const q of wit){ q.unhappy=1; q.uWhy="동료 폭행 목격"; affAdd(q, -6, "동료 폭행 목격"); }
      if(wit.length) addMood(`👀 ${wit.map(q=>q.name).join(", ")} — 동료가 맞는 장면을 본 뒤 감독을 피하고 있습니다. (사유: 동료 폭행 목격)`);
    }
    p.morale=25;
    t.morale=Math.round(clamp((t.morale||70)-9,40,99)*100)/100;
    for(const q of t.players){ if(q.id!==p.id) affAdd(q, -12, `${p.name} 폭행 사건`); }
    const fine=mgrFine(6+R(60)/10, "선수 폭행 — 연맹 중징계");
    const settle=mgrFine(4+R(50)/10, `${p.name} 합의금`);
    adjustTrust("owner", -35, "선수 폭행 파문");
    adjustTrust("fans", -30, "선수 폭행 파문");
    G.press.rel=clamp(G.press.rel-35, 0, 100);
    const say=pick([
      `"...지금 저를 때린 겁니까? 변호사 부르겠습니다."`,
      `"손대지 마십시오. 이건 끝까지 갑니다."`,
      `"제가 뭘 잘못했는데요? 말씀해 보십시오. 못 하시잖아요."`,
      `"…다들 보셨죠? 여기 계신 분들 전부 증인입니다."`]);
    addMood(`🚨 라커룸이 뒤집혔습니다. ${p.name}이(가) 짐을 챙겨 나갔고, 주장이 감독을 막아섰습니다.`);
    addNews(`🚨 [속보] <b>${t.name} 감독, 선수 폭행</b> — ${p.name} 선수가 라커룸에서 뺨을 맞았다는 증언이 나왔습니다. 연맹 제재금 ${fine}억, 합의금 ${settle}억.`, "warn", "club",
      {cat:"manager", ic:"🚨", tone:-1, tid:t.id, src:pick(MEDIA),
       head:`${t.short} 감독 선수 폭행 파문… "증인만 스무 명"`,
       sub:`${p.name} 선수 측은 법적 대응을 검토 중이며, 연맹은 상벌위원회 소집을 예고했다.`});
    socialFill(SOC.slapBad, 6+R(4), -1, v);
    fmkFill(FMK.slapBad, 4+R(3), v);
    rivalFill(RIV.slapBad, 4+R(3), -1, v);
    rivalFmk(FRIV.slapBad, 3+R(3), v);
    /* 부임한 지 얼마 안 된 감독이라면 — 충격이 배가 된다 */
    const rookie = mgrSeasons()===0 && (t.div===1?G.r1:G.r2)<=10;
    if(rookie){
      adjustTrust("owner", -8, "부임 초기 폭행 — 선임 책임론");
      adjustTrust("fans", -6, "부임 초기 폭행");
      socialFill(SOC.slapNewMgr, 4+R(3), -1, v);
      fmkFill(FMK.slapNewMgr, 3+R(2), v);
      addNews(`🗞️ "선임 검증은 했나" — ${t.name} 구단주를 향한 책임론까지 번지고 있습니다. 부임 ${(t.div===1?G.r1:G.r2)}라운드 만의 폭행 사태.`, "warn", "club");
    }
    TALKMSG={txt:`${p.name}: ${say}`, d:-45};
  }
  saveGame(); show("player");
}
function talkCard(p){
  const t=userTeam();
  const r=t.div===1?G.r1:G.r2;
  const talked=p.talkR===r;
  const goodForm=p.apps>=3&&p.seasonRating>=7.20, badForm=p.apps>=3&&p.seasonRating<6.55;
  return `<div class="card">
    <h3>대화 ${talked?'<span class="small">(이번 라운드 면담 완료)</span>':""}</h3>
    <button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" ${talked?"disabled":""} onclick="talkTo(${p.id},'praise')">👏 최근 활약 칭찬 ${p.sulk>0?'<span class="small">(태업 중 — 역효과 주의)</span>':goodForm?"":'<span class="small">(근거 부족 시 역효과)</span>'}</button>
    <button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" ${talked?"disabled":""} onclick="talkTo(${p.id},'scold')">😤 분발 촉구 ${p.sulk>0?'<span class="small">(태업 중 — 역효과 주의)</span>':badForm?"":'<span class="small">(폼 좋을 땐 부당한 질책)</span>'}</button>
    <button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" ${talked?"disabled":""} onclick="talkTo(${p.id},'chat')">☕ 가벼운 대화 ${p.sulk>0?'<span class="small">(태업 중 — 역효과 주의)</span>':""}</button>
    ${p.sulk>0?`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px;border-color:var(--gold)" ${talked?"disabled":""} onclick="talkTo(${p.id},'persuade')">🗣️ 이적 설득하기 <span class="small">(나이·연봉·성격 고려)</span></button>`:""}
    ${p.inj>0&&!(p.sulk>0)?`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px;border-color:var(--gold)" ${talked?"disabled":""} onclick="talkTo(${p.id},'comfort')">🩹 부상 위로 <span class="small">(${p.inj}주 결장 중 — 재활 의욕에 영향)</span></button>`:""}
    ${!(p.sulk>0)&&badForm?`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" ${talked?"disabled":""} onclick="talkTo(${p.id},'scoldSoft')">🫱 조용히 따로 불러 이야기 <span class="small">(자극은 약하지만 안전)</span></button>`:""}
    ${!(p.sulk>0)&&badForm?`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px;border-color:var(--red)" ${talked?"disabled":""} onclick="talkTo(${p.id},'scoldPublic')">📣 팀 전체 앞에서 공개 질책 <span class="small">(효과도 위험도 크다)</span></button>`:""}
    ${wildOff()?"":`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px;border-color:var(--red);color:#ff9d95" ${talked?"disabled":""} onclick="openSlap(${p.id})">👋 뺨을 후려친다 <span class="small">${(()=>{ const c=slapCase(p); return c.g>=45?"(명분 충분)":c.g>=20?"(명분 있음)":c.g>=0?"⚠ (명분 약함 — 폭행으로 남습니다)":"⚠ (명분 없음 — 커리어가 끝날 수 있습니다)"; })()}</span></button>`}
    ${tutorBlock(p)}
    ${p.sulk>0&&String(p.uWhy||"").includes("폭행")?`<h3>불만 해결</h3>
      <button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px;border-color:var(--gold)" onclick="talkTo(${p.id},'apologize')">🙇 폭행을 진심으로 사과한다 <span class="small">(태업 중에도 사과만은 들어줍니다 — 태업 기간도 줄어듭니다)</span></button>`:""}
    ${p.unhappy>0&&!(p.sulk>0)?`<h3>불만 해결</h3>
      ${p.uWhy.includes("폭행")?`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px;border-color:var(--gold)" onclick="talkTo(${p.id},'apologize')">🙇 폭행을 진심으로 사과한다 <span class="small">(성격·시간·관계에 따라 받아들일 수도, 아닐 수도)</span></button>`:""}
      ${p.uWhy.includes("출전")?`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px${p.promiseBroken?";opacity:.55":""}" onclick="talkTo(${p.id},'promise')">🤝 출전 시간 약속 <span class="small">${p.promiseBroken?"(한 번 어겼습니다 — 더는 믿지 않습니다)":"(6R 내 3경기 — 못 지키면 이적 요청/태업으로 번집니다)"}</span></button>`:""}
      ${p.uWhy.includes("연봉")?`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" onclick="talkTo(${p.id},'raise')">💰 연봉 25% 인상 <span class="small">(${p.wage}억 → ${Math.round(p.wage*1.25*10)/10}억)</span></button>`:""}
      <button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" onclick="talkTo(${p.id},'allow')">🚪 이적 허용 (리스트 등록)</button>`:""}
    <p class="small" style="margin-top:6px">성격에 따라 반응이 다릅니다. 다혈질은 질책에 폭발할 수도, 자극받을 수도 있습니다. 면담은 라운드당 1회.</p>
  </div>`;
}
/* ── 튜터(멘토) 배정 ────────────────────────────────────────────────
   FM의 Tutoring 을 이 게임 크기에 맞게 줄였다. 스물두 살 이하 어린 선수에게
   서른 넘은 베테랑을 붙이면 성장이 빨라지고 사기가 오른다. 대신 베테랑도 시간을 쓴다.
   리더십·팀워크가 높은 베테랑일수록 효과가 크다. */
const TUTOR_GAIN=0.30;      // 리더십+팀워크 20/20 짜리 튜터가 주는 최대 성장 배수 가산
const TUTOR_MAX_AGE=22;     // 배울 나이
const TUTOR_MIN_AGE=29;     // 가르칠 나이
/* ⚠ 제보 — 「리더십·팀워크가 비슷한 선수인데 목록에 안 뜬다」.
   추천 네 명만 보여 주고 나머지는 아예 감췄다. 누구를 붙일지는 감독이 정할 일이다.
   ─ 자격을 갖춘 베테랑은 전부 보여 주고, 추천 순으로 줄만 세운다. */
function tutorCands(p, all){
  const t=userTeam(); const age=q=>G.season-q.by;
  const L=t.players.filter(q=>q.id!==p.id && age(q)>=TUTOR_MIN_AGE && !q.sulk && q.ovr>=p.ovr-2)
    .sort((a,b)=>((b.attr?attr20(b.attr.ldr)+attr20(b.attr.tea):0)-(a.attr?attr20(a.attr.ldr)+attr20(a.attr.tea):0)));
  return all ? L : L.slice(0,4);
}
/* 🎓 ⚠ 제보 원문 — 「튜터로 붙어 있던 선수가 이적 시, 튜터를 받고 있는 선수의 프로필에
   누구에게 튜터를 받고 있는지 나오지 않고 단순히 튜터를 받고 있다는 사실만 나오고
   +15% 의 성장 속도 상향 표시가 되어 있는데, … 튜터 효과를 지워주시고 새로 튜터링을 할 수
   있는 선수를 선택하게 (처음 튜터링을 시킬 때처럼) 바꿔주시면 감사하겠습니다」.
   원인: 멘토가 떠난 관계를 「성장 계산이 돌 때」와 「능숙도가 오를 때」에만 끊고 있었다.
      프로필은 그 전에 열리므로 p.tutor 가 남아 있고, 멘토를 못 찾아 이름 자리는 「베테랑」,
      성장 배수는 기본값 15%로 그려졌다 — 실제로는 아무 효과도 없는 상태다.
   ─ 관계를 한자리에서 훑어 끊는다. 프로필을 열 때·하루가 지날 때·세이브를 열 때 모두 부른다. */
function tutorSweep(t){
  try{
    const T=t||userTeam(); if(!T || !Array.isArray(T.players)) return 0;
    let n=0;
    for(const p of T.players){
      if(!p || !p.tutor) continue;
      const mt=T.players.find(x=>x && x.id===p.tutor.id);
      if(!mt){ p.tutor=null; n++; }                 // 멘토가 팀을 떠났다 — 관계는 끝난다
    }
    return n;
  }catch(e){ return 0; }
}
function tutorBlock(p){
  const age=G.season-p.by;
  if(p.sulk>0) return "";
  try{ tutorSweep(); }catch(e){}
  if(p.tutor){
    const mt=userTeam().players.find(x=>x.id===p.tutor.id);
    const left=tutorLocked(p);
    return `<div class="msg good" style="margin-top:8px">🎓 <b>${mt?mt.name:"베테랑"}</b> 선수가 멘토로 붙어 있습니다.
      <span class="small">성장 속도 +${Math.round((mt&&mt.attr?clamp(TUTOR_GAIN*(attr20(mt.attr.ldr)+attr20(mt.attr.tea))/20,0.05,0.35):0.15)*100)}%</span>
      <button class="mini" style="margin-left:8px" ${left>0?"disabled":""} onclick="clearTutor(${p.id})">
        ${left>0?`변경까지 ${left}일`:"멘토 바꾸기"}</button></div>`;
  }
  if(age>TUTOR_MAX_AGE) return "";
  const all=tutorCands(p, true);
  if(!all.length) return `<p class="small" style="margin-top:8px">🎓 멘토로 붙일 만한 베테랑(${TUTOR_MIN_AGE}세 이상)이 없습니다.</p>`;
  const cs=TUTOR_ALL ? all : all.slice(0,4);
  const row=(q,i)=>{
    const c=tutorChance(q,p);
    const eff=Math.round(clamp(TUTOR_GAIN*(attr20(q.attr.ldr)+attr20(q.attr.tea))/20, 0.05, 0.35)*100);
    const cc=c>=0.7?["높음","var(--green)"]:c>=0.45?["보통","var(--gold)"]:["낮음","var(--red)"];
    return `<button class="mini tutorRow" onclick="askTutor(${p.id},${q.id})">
      <span class="tutorN">${i<3&&!TUTOR_ALL?"⭐":"🎓"} <b>${q.name}</b>
        <span class="small">${G.season-q.by}세 · <span class="pos-${q.pos}">${q.pos}</span>${q.pos===p.pos?' <span class="stkTag">같은 자리</span>':""}</span></span>
      <span class="tutorV small">리더십 <b>${attr20(q.attr.ldr)}</b> · 팀워크 <b>${attr20(q.attr.tea)}</b>
        · 성장 <b style="color:var(--gold)">+${eff}%</b><br>
        수락 가능성 <b style="color:${cc[1]}">${cc[0]}</b> <span style="opacity:.7">(${Math.round(c*100)}%)</span></span>
    </button>`;
  };
  return `<h3 style="margin-top:12px">🎓 멘토 지정 <span class="small">(${TUTOR_MAX_AGE}세 이하 전용) — 후보 ${all.length}명</span></h3>
    <p class="small" style="color:var(--sub);margin-bottom:6px">
      ${TUTOR_MIN_AGE}세 이상이고 태업 중이 아니며, 이 선수보다 크게 뒤처지지 않는 선수는 <b>모두</b> 부탁할 수 있습니다.
      ⭐는 리더십·팀워크가 높아 코치진이 먼저 추천하는 선수입니다.</p>
    ${cs.map(row).join("")}
    ${all.length>4?`<button class="mini" style="width:100%;margin-bottom:8px" onclick="tutorToggleAll()">
      ${TUTOR_ALL?`▲ 추천 4명만 보기`:`▼ 나머지 ${all.length-4}명 모두 보기`}</button>`:""}
    <p class="small">멘토가 붙으면 능력치 성장이 빨라지고, 그 자리 <b>포지션 능숙도도 1.5배</b>로 붙습니다.<br>한 번 붙이면 약 한 달(${TUTOR_COOL}일) 뒤부터 바꿀 수 있습니다.</p>`;
}
let TUTOR_ALL=false;
function tutorToggleAll(){ TUTOR_ALL=!TUTOR_ALL; show(VIEW); }
/* ── 멘토 요청 대화 ──────────────────────────────────────────────
   FM처럼 감독이 베테랑에게 직접 부탁하고, 베테랑이 받아들이거나 거절한다.
   거절 사유는 성격·호감도·사기·자리 경쟁에서 나온다 — 자기 자리를 노리는 어린 선수를
   가르쳐 달라고 하면 프로답게 받아들이는 사람도, 대놓고 싫어하는 사람도 있다. */
const TUTOR_COOL=30;        // 한 번 붙이면 30일(약 한 달) 뒤부터 바꿀 수 있다
function tutorChance(m, p){
  const A=m.attr||{};
  let c = 0.30
    + (attr20(A.ldr||60)-10)*0.040        // 리더십 — 가르치는 걸 자기 일로 안다
    + (attr20(A.tea||60)-10)*0.030        // 팀워크
    + (aff(m)-50)*0.008                   // 감독을 얼마나 믿는가
    + ((m.morale||70)-70)*0.005;
  c += [0.10, -0.08, 0.12, -0.05][m.pers||0];         // 프로/야심/온화/다혈질
  if(m.pos===p.pos) c-=0.14;                          // 자기 자리를 노리는 후배다
  if(m.unhappy>0) c-=0.18;
  if((G.season-m.by)-(G.season-p.by) < 8) c-=0.10;    // 나이 차가 적으면 "선배" 느낌이 덜하다
  return clamp(c, 0.08, 0.94);
}
function askTutor(pid, mid){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid), m=t.players.find(x=>x.id===mid);
  if(!p||!m) return;
  const ch=tutorChance(m,p);
  showConfirm(`<b>🎓 멘토 요청</b>\n\n감독: "${m.name} 선수, ${p.name} 좀 맡아 주시겠습니까?\n훈련 끝나고 30분씩만이라도 봐 주십시오."\n\n${m.name} (${G.season-m.by}세 · 리더십 ${attr20(m.attr.ldr)} · 팀워크 ${attr20(m.attr.tea)})\n예상 수락 가능성: ${ch>=0.7?"높음":ch>=0.45?"보통":"낮음"}\n\n요청하시겠습니까?`,
    ()=>doAskTutor(pid, mid, ch));
}
function doAskTutor(pid, mid, ch){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid), m=t.players.find(x=>x.id===mid);
  if(!p||!m) return;
  const sameP = m.pos===p.pos, gap=(G.season-m.by)-(G.season-p.by);
  if(Math.random()<ch){
    p.tutor={id:mid, s:G.season, d:(G.day||0)};
    p.morale=clamp(p.morale+4,20,99); affAdd(p, 3, "멘토 배정");
    m.morale=clamp(m.morale+2,20,99); affAdd(m, 3, "후배 지도 수락");
    const say=pick([
      `"제가 겪은 실수는 안 겪게 하겠습니다. 맡겨 주십시오."`,
      `"어릴 때 저도 이런 선배가 있었으면 좋았을 텐데요. 하겠습니다."`,
      `"훈련 끝나고 30분씩 따로 남기겠습니다. 대신 저도 봐주십시오. (웃음)"`,
      sameP ? `"제 자리를 노리는 놈이라 더 제대로 가르쳐야죠. 그래야 저도 안 밀립니다."`
            : `"이런 부탁 받는 게 오랜만입니다. 영광입니다."`,
      m.pers===2 ? `"...제가 잘할 수 있을지 모르겠지만, 해 보겠습니다."` : `"좋습니다. 저 믿고 맡기시죠."`]);
    TALKMSG={txt:`🎓 <b>${m.name}</b>: ${say} <i>(${p.name} 선수의 멘토로 지정됨)</i>`, d:0};
  } else {
    affAdd(m, -2, "멘토 요청 거절");
    const say=pick([
      sameP ? `"솔직히 말씀드리면, 제 자리 노리는 선수를 제 손으로 키우고 싶진 않습니다."`
            : `"죄송합니다. 제 몸 챙기기도 벅찬 시즌입니다."`,
      m.pers===1 ? `"저는 제 경기에 집중하고 싶습니다. 다른 분께 부탁하시죠."` 
                 : `"제가 그럴 만한 사람인지 모르겠습니다. 다음에 다시 말씀해 주십시오."`,
      m.unhappy>0 ? `"지금 제 상황부터 정리해 주시고 그런 말씀 하시죠."` 
                  : `"...조금만 생각할 시간을 주십시오."`,
      gap<8 ? `"제가 그렇게 나이 많은 선수는 아닙니다만. (웃음) 다른 형한테 부탁하시죠."`
            : `"미안합니다. 지금은 아닌 것 같습니다."`]);
    TALKMSG={txt:`🎓 <b>${m.name}</b>: ${say} <i>(거절)</i>`, d:0};
  }
  saveGame(); show("player");
}
function tutorLocked(p){
  if(!p.tutor) return 0;
  const left=TUTOR_COOL-((G.day||0)-(p.tutor.d||0));
  return left>0 ? left : 0;
}
function clearTutor(pid){
  const p=userTeam().players.find(x=>x.id===pid); if(!p) return;
  const left=tutorLocked(p);
  if(left>0){ TALKMSG={txt:`🎓 멘토를 바꾸려면 ${left}일 더 기다려야 합니다. 붙인 지 얼마 안 됐습니다.`, d:0}; show("player"); return; }
  const m=userTeam().players.find(x=>x.id===p.tutor.id);
  p.tutor=null;
  TALKMSG={txt:`🎓 ${m?m.name+" 선수와의 ":""}멘토 관계를 정리했습니다.`, d:0};
  saveGame(); show("player");
}
/* ═══════════════════════════════════════════════════════════════
   ⚖️ 선수 비교 — FM의 Compare 화면
   두 선수의 신상·계약·능력치를 좌우로 나란히 놓는다. 능력치는 1~20 막대가 서로 마주 보고,
   높은 쪽이 진하게 칠해져 어느 쪽이 우위인지 한눈에 보인다.
═══════════════════════════════════════════════════════════════ */
let CMP_ID=null;              // 비교 대상 선수 id
function cmpSet(v){ CMP_ID=v?parseInt(v,10):null; show("player"); }
let CMP_Q="";
/* 검색 결과만 갈아 끼운다 — 입력창을 살려 둬야 모바일 키보드가 안 닫힌다 (선수 검색과 같은 방식) */
function cmpRefresh(v){
  CMP_Q=String(v||"");
  const el=document.getElementById("cmpList");
  if(el) el.innerHTML=cmpResults(CMP_Q);
}
function cmpResults(qRaw){
  const me2=findAnyPlayer(CURP);
  const q=psNorm(qRaw);
  if(!q) return `<p class="small" style="margin:4px 0">이름을 입력하면 리그 전체(K1·K2)와 FA, 해외 시장에서 찾습니다.${me2?` 같은 포지션(${me2.pos})끼리 비교하면 차이가 잘 보입니다.`:""}</p>`;
  const pool=[];
  for(const id in G.teams){ const ot=G.teams[id];
    for(const p2 of ot.players){ if(p2.id!==CURP) pool.push({p:p2, ot, fa:false}); } }
  for(const p2 of (G.freeAgents||[])) if(p2.id!==CURP) pool.push({p:p2, ot:null, fa:true});
  { let osArr2=[]; try{ osArr2=overseasList(); }catch(e){ osArr2=G.overseas||[]; }
    for(const p2 of osArr2) if(p2.id!==CURP) pool.push({p:p2, ot:{short:p2.osClub||"해외", name:p2.osClub||"해외"}, fa:false}); }
  const hits=pool.map(e=>({...e, sc:psScore(e, q)})).filter(e=>e.sc>0)
                 .sort((a,b)=>b.sc-a.sc || sortLv(b.p)-sortLv(a.p)).slice(0,8);
  if(!hits.length) return `<p class="small" style="margin:4px 0">"${qRaw}" — 조건에 맞는 선수가 없습니다.</p>`;
  return hits.map(e=>`<button class="mini" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;margin-bottom:4px;padding:8px 10px" onclick="cmpSet(${e.p.id})">
    <b class="${e.p.frn?"frnN":""}">${psMark(e.p.name, q)}</b>
    <span class="small pos-${e.p.pos}">${e.p.pos}</span>
    <span class="small">${e.ot?e.ot.short:"🆓 FA"}</span>
    <span class="small" style="margin-left:auto">${abilityStars(e.p)}</span>
  </button>`).join("");
}
function cmpRow(label, va, vb, html){
  return `<div class="cmpRow"><span class="cmpVa">${va}</span><span class="cmpK">${label}</span><span class="cmpVb">${vb}</span></div>`;
}
function cmpAttrRow(key, A, B, fbA, fbB){
  const ra=(A&&typeof A[key]==="number")?A[key]:null;
  const rb=(B&&typeof B[key]==="number")?B[key]:null;
  if(ra==null && rb==null) return "";
  const va=ra!=null?attr20(ra):null, vb=rb!=null?attr20(rb):null;
  const wA=va!=null?va*5:0, wB=vb!=null?vb*5:0;
  const aWin=va!=null&&(vb==null||va>vb), bWin=vb!=null&&(va==null||vb>va);
  return `<div class="cmpAttr">
    <span class="cmpN ${aWin?"win":""}">${va!=null?va:"—"}</span>
    <div class="cmpBarL"><div class="cmpFill ${aWin?"win":""}" style="width:${wA}%"></div></div>
    <span class="cmpLbl" title="${key}">${ATTR_LABEL_FM[key]||key}</span>
    <div class="cmpBarR"><div class="cmpFill ${bWin?"win":""}" style="width:${wB}%"></div></div>
    <span class="cmpN ${bWin?"win":""}">${vb!=null?vb:"—"}</span>
  </div>`;
}
function cmpBlock(title, keys, A, B, pA, pB){
  const rows=keys.map(k=>cmpAttrRow(k, A, B)).join("");
  if(!rows.trim()) return "";
  return `<div class="cmpSec">${title}</div>${rows}`;
}
function compareCard(p){
  const all=[];
  for(const id in G.teams) for(const q of G.teams[id].players) if(q.id!==p.id) all.push({q, t:G.teams[id]});
  for(const q of (G.freeAgents||[])) if(q.id!==p.id) all.push({q, t:null});
  for(const q of (G.overseas||[])) if(q.id!==p.id) all.push({q, t:{short:q.osClub||"해외"}});
  all.sort((a,b)=>sortLv(b.q)-sortLv(a.q));
  const b0=CMP_ID!=null?findAnyPlayer(CMP_ID):null;
  const sel=`<div class="card" style="margin-bottom:10px"><h3>⚖️ 비교 대상 검색</h3>
    ${b0?`<div class="msg good" style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
      선택됨: <b>${b0.name}</b> <span class="small">(${b0.pos} ${dispOvr(b0)})</span>
      <button class="mini" style="margin-left:auto" onclick="cmpSet('')">✕ 다른 선수 찾기</button></div>`
    :`<input id="cmpQ" type="text" placeholder="이름·초성(ㅈㅁㄱ)·팀명으로 검색" style="width:100%;max-width:320px;padding:9px 11px;font-size:14px"
        oninput="cmpRefresh(this.value)" autocomplete="off">
      <div id="cmpList" style="margin-top:8px">${cmpResults("")}</div>`}
  </div>`;
  const b=CMP_ID!=null?findAnyPlayer(CMP_ID):null;
  if(!b) return sel+`<div class="card"><p class="small">위에서 비교할 선수를 고르면 전 항목이 나란히 표시됩니다.</p></div>`;
  const tA=teamOfPlayer(p), tB=teamOfPlayer(b);
  const starOf=(q)=>{ const gr=starGrade(62+(playerLevel(q)-starRefLevel())*STAR_GAIN); return (gr.silver?"은":"")+"★"+gr.v; };
  const head=`<div class="card cmpHead">
    <div class="cmpRow" style="border-bottom:2px solid var(--line);padding-bottom:8px;margin-bottom:6px">
      <span class="cmpVa" style="font-size:16px;font-weight:800;color:var(--txt)">${p.name}${p.frn?" 🌐":""}</span>
      <span class="cmpK" style="color:var(--gold);font-weight:800">VS</span>
      <span class="cmpVb" style="font-size:16px;font-weight:800;color:var(--txt)">${b.name}${b.frn?" 🌐":""}</span>
    </div>
    ${cmpRow("구단", tA?tA.short:(p.osClub||"FA"), tB?tB.short:(b.osClub||"FA"))}
    ${cmpRow("포지션", `${p.pos} (${p.prefPos||"-"})`, `${b.pos} (${b.prefPos||"-"})`)}
    ${cmpRow("능력 (별)", starOf(p), starOf(b))}
    ${cmpRow("종합 / 잠재", `${dispOvr(p)} / ${dispPot(p)}`, `${dispOvr(b)} / ${dispPot(b)}`)}
    ${cmpRow("출생", birthText(p), birthText(b))}
    ${cmpRow("신장 / 체중", `${p.h||178}cm / ${p.w||74}kg`, `${b.h||178}cm / ${b.w||74}kg`)}
    ${cmpRow("성격", PERS_N[p.pers||0], PERS_N[b.pers||0])}
    ${cmpRow("시장가치", `<b class="money">${marketValue(p)}억</b>`, `<b class="money">${marketValue(b)}억</b>`)}
    ${cmpRow("연봉", `${p.wage||"?"}억`, `${b.wage||"?"}억`)}
    ${cmpRow("잔여 계약", `${p.ct||1}년`, `${b.ct||1}년`)}
    ${cmpRow("올 시즌", `${p.apps||0}경기 ${p.goals||0}골 ${p.assists||0}도움`, `${b.apps||0}경기 ${b.goals||0}골 ${b.assists||0}도움`)}
    ${cmpRow("평점", (p.apps?(p.seasonRating||0).toFixed(2):"-"), (b.apps?(b.seasonRating||0).toFixed(2):"-"))}
    ${cmpRow("특성", (p.traits||[]).length?`${(p.traits||[]).map(k2=>(TRAIT_BY_KEY[k2]||{}).n||k2).join("<br>")}`:"—",
                     (b.traits||[]).length?`${(b.traits||[]).map(k2=>(TRAIT_BY_KEY[k2]||{}).n||k2).join("<br>")}`:"—")}
  </div>`;
  const gk=(p.pos==="GK"||b.pos==="GK");
  const attrs=`<div class="card">
    ${gk?cmpBlock("골키퍼 능력", GK_ORDER, p.gkA||{}, b.gkA||{}):""}
    ${cmpBlock(gk?"필드 능력 (기술)":"기술적 능력", TECH_ORDER, p.attr||{}, b.attr||{})}
    ${cmpBlock("정신적 능력", MENT_ORDER, p.attr||{}, b.attr||{})}
    ${cmpBlock("신체", PHYS_ORDER, p.attr||{}, b.attr||{})}
  </div>`;
  return sel+head+attrs;
}
function playerView(){
  const p=findAnyPlayer(CURP);
  if(!p) return squad();
  const owned=userTeam().players.some(x=>x.id===p.id);
  if(PVTAB==="talk"&&!owned) PVTAB="profile";
  if(PVTAB!=="profile"&&PVTAB!=="talk"&&PVTAB!=="compare") PVTAB="profile";
  const tabBtn=(k,l)=>`<button class="mini ${PVTAB===k?'sel':''}" onclick="PVTAB='${k}';show('player')">${l}</button>`;
  return `<h2>👤 ${p.name} <span class="small" style="font-family:monospace;color:var(--sub);font-weight:400" title="고유번호 — 개명·이적해도 바뀌지 않습니다">#${p.uid||"-"}</span> <button class="mini" onclick="show('${PVBACK}')">← 돌아가기</button></h2>
  ${TALKMSG?`<div class="msg ${TALKMSG.d>0?"good":TALKMSG.d<0?"warn":"info"}">${TALKMSG.txt} ${TALKMSG.d?`<i class="small">(사기 ${TALKMSG.d>0?"+":""}${TALKMSG.d})</i>`:""}</div>`:""}
  <div style="margin-bottom:10px">${tabBtn('profile','👤 프로필')} ${tabBtn('compare','⚖️ 비교')} ${owned?tabBtn('talk','💬 대화'):''}</div>
  ${PVTAB==="talk"&&owned?talkCard(p):PVTAB==="compare"?compareCard(p):profileCard(p)}`;
}
function talkTo(pid, kind){
  /* 감독이 직접 말을 거는 것도 배움의 일부다 — 관계가 좋을수록 더 남는다 */
  try{ const _p=userTeam().players.find(x=>x.id===pid);
       if(_p) addTraitXp(_p, 1.6*clamp(0.6+(aff(_p)-40)/100, 0.5, 1.6)); }catch(e){}
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p) return;
  const r=t.div===1?G.r1:G.r2;
  if(kind!=="promise"&&kind!=="raise"&&kind!=="allow"){
    if(p.talkR===r){ TALKMSG={txt:`${p.name}: ${pick([`"감독님, 오늘은 이미 이야기했잖아요..."`,`"또요? 저 훈련 들어가야 합니다..."`,`"하실 말씀이 남으셨으면... 내일 하시죠."`])}`, d:0}; show("player"); return; }
    p.talkR=r;
  }
  const pers=p.pers||0, age=G.season-p.by;
  const vet=age>=33, kid=age<=20, star=p.ovr>=75, lowM=p.morale<50;
  let d=0, txt="";
  if(p.sulk>0 && (kind==="praise"||kind==="scold"||kind==="chat")){
    // 태업 중엔 평소 화법이 통하지 않는다 — 항상 불쾌한 반응
    d=[-4,-3,-6,-8][pers];
    txt=pick([
      [`"지금 그게 저한테 할 말입니까? 웃기지 마십시오."`,`"...대화하고 싶은 기분 아닙니다. 나가주시죠."`,`"팔겠다고 해놓고 이제 와서요? 됐습니다."`],
      [`"제 거취부터 정리하시죠. 그 전엔 아무 말도 듣기 싫습니다."`,`"이럴 시간에 제 이적이나 알아봐 주십시오."`,`"흥. 지금 그런 얘기가 나옵니까?"`],
      [`"...(대답 없이 고개만 돌렸다)"`,`"죄송하지만... 지금은 아무 말도 하고 싶지 않습니다."`,`"그냥... 좀 내버려 두셨으면 좋겠습니다."`],
      [`"장난하십니까?! 나가세요!! 지금 그런 거 들을 기분 아닙니다!"`,`"팔아치우겠다면서 이제 와서 무슨 낯짝으로!!" (언성을 높였다)`,`"됐고요. 저 그냥 훈련장 안 나갈 겁니다."`]][pers]);
    p.morale=clamp(p.morale+d,20,99);
    TALKMSG={txt:`${p.name}: ${txt}`, d};
    saveGame(); show("player"); return;
  }
  if(kind==="persuade"){
    if(!(p.sulk>0)){ show("player"); return; }
    const we=wageExpect(p.ovr,p.frn,(teamOfPlayer(p)||{}).div);
    let chance=0.35;
    chance += [0.15,0.05,0.2,-0.15][pers];               // 성격
    chance += vet?0.15:kid?-0.1:0;                        // 나이 — 노장은 현실적, 어린 선수는 완고
    chance += p.wage>we*1.15?0.15:p.wage<we*0.9?-0.1:0;   // 연봉 — 과분한 대우면 수긍, 저평가 느끼면 반발
    chance += p.sulk>=3?-0.1:p.sulk<=1?0.1:0;             // 태업 경과 — 갓 폭발했을수록 어렵고, 잦아들수록 쉬움
    chance = clamp(chance,0.1,0.85);
    if(Math.random()<chance){
      p.sulk=0; p.morale=clamp(55+(vet?3:0),30,80); p.unhappy=Math.max(p.unhappy,1); p.uWhy="이적 대기";
      txt=pick([
        `"...알겠습니다. 감정적으로 굴었던 건 인정하죠. 대신 이번 시장에서 확실히 보내주십시오."`,
        vet?`"이 나이에 이런 소란은 저도 부끄럽습니다. 좋은 곳으로 보내주시면 됩니다."`:`"조건만 맞으면 조용히 가겠습니다. 훈련은 다시 나가죠."`,
        pers===2?`"감독님이 이렇게까지 말씀하시니... 알겠습니다. 죄송했습니다."`:`"좋습니다. 대신 다음엔 먼저 말씀해 주십시오."`]);
      TALKMSG={txt:`${p.name}: ${txt} <i>(태업 종료 — 이적 대기 상태로 전환)</i>`, d:0};
    } else {
      p.sulk=clamp(p.sulk+1,0,8); p.morale=clamp(p.morale-4,20,99);
      txt=pick([
        `"됐습니다. 말로는 안 넘어갑니다."`,
        pers===3?`"지금 저를 설득한다고요?! 어림도 없습니다!!"`:`"...아직은 마음이 안 풀립니다. 좀 더 시간을 주십시오."`,
        `"진심이 안 느껴지는데요. 다시 오세요."`]);
      TALKMSG={txt:`${p.name}: ${txt} <i>(설득 실패 — 태업 연장)</i>`, d:-4};
    }
    p.talkR=r;
    saveGame(); show("player"); return;
  }
  if(kind==="comfort"){
    /* 부상 위로 — 다친 선수는 라커룸에서 제일 빨리 잊힌다. 찾아가 주는 것만으로 값이 있다.
       성격에 따라 받아들이는 방식이 다르고, 오래 쉰 선수일수록 더 크게 반응한다. */
    const long=(p.inj||0)>=4;
    d=[4,3,6,4][pers]+(long?2:0);
    txt=pick([
      [`"괜찮습니다. 재활 일정대로 착실히 밟겠습니다."`,`"신경 써 주셔서 감사합니다. 돌아오면 자리는 제가 되찾겠습니다."`],
      [`"빨리 돌아오겠습니다. 제 자리 비워 두십시오."`,`"이 정도로 무너질 몸 아닙니다. 곧 뵙겠습니다."`],
      [`"...감독님이 와 주실 줄 몰랐습니다. 감사합니다."` ,`"솔직히 요즘 좀 외로웠는데... 힘이 납니다."`],
      [`"아 진짜 답답해 죽겠습니다! 근데 오셔서 좀 풀리네요."`,`"돌아가면 두 배로 뛰겠습니다. 두고 보십시오!"`]][pers]);
    if(long && pers===2) txt=`"...(잠시 말을 잇지 못하다가) 감사합니다. 정말로요."`;
    affAdd(p, 4, "부상 중 위로");
    p.morale=clamp(p.morale+d,20,99);
    TALKMSG={txt:`${p.name}: ${txt}`, d};
    saveGame(); show("player"); return;
  }
  if(kind==="scoldSoft"){
    /* 조용히 따로 불러 이야기 — 자극은 약하지만 성격을 타지 않는다. 온화한 선수에게 특히 잘 듣는다. */
    d=[2,1,3,1][pers];
    txt=pick([
      [`"따로 불러 주셔서 감사합니다. 뭘 고쳐야 하는지 알겠습니다."`,`"공개적으로 안 하신 거, 그것부터 감사합니다."`],
      [`"알겠습니다. 다음 경기에서 답하겠습니다."`,`"제 실력은 제가 압니다. 곧 올라옵니다."`],
      [`"...네. 사실 저도 요즘 제가 답답했습니다."`,`"감독님이 그렇게 말씀해 주시니 마음이 좀 놓입니다."`],
      [`"조용히 말씀해 주시니 오히려 더 찔리네요. 하겠습니다."`,`"알겠습니다. 소리 안 지르셔도 압니다."`]][pers]);
    p.morale=clamp(p.morale+d,20,99); affAdd(p, 2, "개별 면담");
    TALKMSG={txt:`${p.name}: ${txt}`, d};
    saveGame(); show("player"); return;
  }
  if(kind==="scoldPublic"){
    /* 팀 전체 앞에서 공개 질책 — 통하면 본인도 팀도 각성하고, 어긋나면 둘 다 무너진다.
       승부욕·대담성이 높은 선수는 자극으로 받아들이고, 온화한 선수는 무너진다. */
    const A=p.attr||{};
    let ok = 0.30 + (attr20(A.det||60)-10)*0.035 + (attr20(A.bra||60)-10)*0.025
           + (aff(p)-50)*0.006 + (pers===1?0.12:pers===3?0.05:pers===2?-0.22:0.05);
    ok=clamp(ok, 0.08, 0.88);
    const t2=userTeam();
    if(Math.random()<ok){
      d=[4,5,2,6][pers];
      t2.morale=clamp(t2.morale+2,40,99);
      txt=pick([`"...맞는 말씀입니다. 다들 앞에서 들으니 더 확실하네요. 하겠습니다."`,
        `"창피합니다. 근데 그게 필요했던 것 같습니다."`,
        `"좋습니다. 여기 있는 사람들 전부 앞에서 약속하죠. 다음 경기 보십시오."`]);
      TALKMSG={txt:`${p.name}: ${txt} <i>(라커룸 전체가 긴장했습니다 — 팀 사기 +2)</i>`, d};
    } else {
      d=[-6,-5,-9,-7][pers];
      t2.morale=clamp(t2.morale-3,40,99);
      affAdd(p, -8, "공개 질책");
      txt=pick([`"...굳이 다 있는 데서 그러셔야 했습니까."`,
        `"(고개를 숙인 채 아무 말도 하지 않았다)"`,
        pers===3?`"그만하십시오!! 여기서 이럴 일입니까?!"`:`"동료들 보는 앞에서... 이건 좀 아니지 않습니까."`]);
      TALKMSG={txt:`${p.name}: ${txt} <i>(라커룸 공기가 얼어붙었습니다 — 팀 사기 -3)</i>`, d};
    }
    p.morale=clamp(p.morale+d,20,99);
    saveGame(); show("player"); return;
  }
  if(kind==="praise"){
    if(p.apps>=3&&p.seasonRating>=7.20){
      d=[5,3,6,4][pers]+(lowM?2:0);
      txt=pick([
        [`"감사합니다. 팀이 이기는 게 우선이지만, 인정받으니 힘이 납니다."`,`"준비한 만큼 나온 것뿐입니다. 다음 경기에선 더 보여드리죠."`,`"과찬이십니다. 아직 보완할 게 많아요."`],
        [`"당연한 평가죠. 재계약 테이블에서 기억해주십시오. (웃음)"`,`"이 정도로 만족 안 합니다. 저는 더 큰 무대를 봅니다."`,`"올해 MVP까지 가겠습니다. 지켜봐 주세요."`],
        [`"헤헤... 다 감독님 덕분입니다!"`,`"믿고 써주셔서 감사합니다. 정말로요."`,`"이 말씀, 라커룸 가서 자랑해도 되죠? (웃음)"`],
        [`"불타오르네요!! 오늘 훈련 두 배로 뜁니다!"`,`"좋습니다!! 다음 경기 해트트릭 갑니다!"`,`"크— 이 맛에 축구하는 거죠!"`]][pers]);
      if(vet&&Math.random()<0.5) txt=pick([`"이 나이에 칭찬을 들으니... 은퇴 계획을 미뤄야겠는데요. (웃음)"`,`"노장 취급 안 하고 봐주시니 감사할 따름입니다."`]);
      if(kid&&Math.random()<0.5) txt=pick([`"가, 감사합니다! 더 열심히 하겠습니다!!"`,`"프로에서 이런 말을 듣다니... 오늘 부모님께 전화드려야겠어요."`]);
      if(star&&pers===1&&Math.random()<0.4){ txt=`"압니다. 그래서 말인데... 구단의 야망도 제 야망만큼 크길 바랍니다."`; }
    } else {
      d=-2;
      txt=pick([`"...제가 요즘 칭찬받을 만한가요? 놀리시는 겁니까."`,`"영혼 없는 칭찬은 사양하겠습니다."`,`"차라리 제가 뭘 고쳐야 하는지 말씀해 주십시오."`])+` <i>(근거 없는 칭찬은 역효과)</i>`;
    }
  } else if(kind==="scold"){
    if(p.apps>=3&&p.seasonRating<6.55){
      d=[3,2,-3,(Math.random()<0.5?4:-5)][pers];
      txt=pick([
        [`"맞는 말씀입니다. 프로라면 결과로 말해야죠."`,`"변명하지 않겠습니다. 오늘부터 훈련량을 늘리겠습니다."`],
        [`"...알겠습니다. 다음 경기 보시죠. 후회하실 겁니다."`,`"자존심이 상하네요. 좋습니다, 증명하죠."`],
        [`"죄송합니다... (눈에 띄게 풀이 죽었다)"`,`"열심히는 하고 있는데... 정말 죄송합니다..."`],
        d>0?[`"뭐라고요?! ...아니, 좋습니다. 실력으로 답하겠습니다!"`,`"욱— ...참겠습니다. 경기장에서 보여드리죠!"`]
           :[`"저한테만 왜 그러십니까!" (강하게 반발했다)`,`"애초에 절 그 위치에 세운 건 감독님이잖습니까!" (책임을 돌렸다)`]][pers]);
      if(vet&&d<0) txt=`"20년 가까이 뛴 프로에게 그런 말씀은... 솔직히 서운합니다."`;
      if(kid&&pers===2){ d-=1; txt=`"죄송합니다, 죄송합니다..." (어린 선수가 크게 위축됐다)`; }
    } else {
      d=-3;
      txt=pick([`"제 평점은 확인하고 말씀하시는 겁니까? 부당합니다."`,`"팀에서 제일 잘하고 있는 사람에게 하실 말씀은 아닌 것 같군요."`,`"...알겠습니다. (문을 세게 닫고 나갔다)"`])+` <i>(폼이 좋은 선수에게는 역효과)</i>`;
    }
  } else if(kind==="chat"){
    d=1+R(2);
    if(p.unhappy>0){ d=0; txt=pick([`"...솔직히 요즘 마음이 편하지 않습니다. ${p.uWhy} 문제, 아시잖아요."`,`"잡담할 기분은 아닙니다. 제 상황부터 해결해 주시죠."`]); }
    else if(p.inj>0){ txt=pick([`"재활 열심히 하고 있습니다. ${p.inj}주면 돌아옵니다."`,`"이런 부상쯤이야. 더 강해져서 돌아오겠습니다."`]); }
    else {
      txt=pick([
        [`"팀 분위기 좋습니다. 걱정 마십시오."`,`"상대 분석 영상을 보던 참이었습니다. 준비는 끝났습니다."`],
        [`"제 역할이 더 커질 수 있다면 뭐든 하겠습니다."`,`"국가대표... 솔직히 욕심납니다. 여기서 잘하면 되겠죠?"`],
        [`"감독님과 이야기하면 마음이 편해집니다."`,`"구내식당 밥이 요즘 맛있어졌습니다. 사소하지만 중요하죠. (웃음)"`],
        [`"몸이 근질거려요. 빨리 경기 뛰고 싶습니다!"`,`"어제 제 하이라이트 영상 봤는데... 꽤 죽이던데요?"`]][pers]);
      if(kid&&Math.random()<0.4) txt=`"선배님들이 정말 잘 챙겨주십니다! 매일 배우고 있어요."`;
      if(vet&&Math.random()<0.4) txt=`"어린 친구들이 잘 따라와 줘서 고맙죠. 요즘은 지도자 욕심도 생깁니다."`;
    }
  } else if(kind==="promise"){
    if(p.promiseBroken){
      TALKMSG={txt:`${p.name}: ${pick([`"또 약속입니까? 한 번 어긴 약속을 두 번 믿을 만큼 어리지 않습니다."`,`"말은 됐습니다. 이번엔 경기로 보여 주시든가, 보내 주시든가요."`])}`, d:-2};
      affAdd(p, -3, "빈말이 된 약속");
      saveGame(); show("player"); return;
    }
    p.promise={apps0:p.apps, need:3, rounds:6}; p.unhappy=0; d=6;
    txt=pick([`"정말입니까? 좋습니다, 감독님을 믿겠습니다."`,pers===1?`"약속하신 겁니다. 어기시면... 다음 대화는 제 에이전트와 하시게 될 겁니다."`:`"기회만 주시면 됩니다. 후회 안 하실 겁니다."`])+` <i>(6라운드 내 3경기 출전 약속)</i>`;
  } else if(kind==="apologize"){
    /* 🙇 폭행 사과 — 돈이나 약속으로 덮을 수 없는 불만이다. 사과만이 입구고, 그마저 쉽지 않다.
       시간이 지날수록(폭행 직후엔 냉담), 관계가 남아 있을수록, 온화한 성격일수록 받아들인다. */
    const since=r-(p._slapR!=null?p._slapR:r);                    // 폭행 후 지난 라운드
    let ok=0.22 + (aff(p)-40)*0.008 + Math.min(0.20, since*0.04);
    if(pers===2) ok+=0.18;            // 온화 — 용서가 빠르다
    if(pers===3) ok-=0.15;            // 다혈질 — 쉽게 안 잊는다
    if(pers===1) ok-=0.06;            // 야심가 — 계산부터 한다
    if(p.sulk>0) ok-=0.10;            // 태업 중이면 대화 자체가 차갑다
    ok=clamp(ok, 0.05, 0.85);
    if(Math.random()<ok){
      p.unhappy=Math.max(0, p.unhappy-2);
      if(p.unhappy===0) p.uWhy="";
      p.sulk=Math.max(0, (p.sulk||0)-2);
      affAdd(p, 10, "감독의 진심 어린 사과");
      d=6;
      txt=pick([
        `"...사과, 받겠습니다. 다만 두 번은 없습니다, 감독님."`,
        pers===2?`"사람이 실수할 수도 있죠. ...잊어보겠습니다."`:`"시간이 좀 걸렸지만... 그 말씀이 듣고 싶었습니다."`,
        `"라커룸 앞에서도 한번 말씀해 주십시오. 저만 맞은 게 아니라 다들 봤으니까요."`]);
      /* 목격자들도 사과 소식에 절반쯤 누그러진다 */
      let calmed=0;
      for(const q of t.players){
        if(q!==p && q.uWhy==="동료 폭행 목격" && Math.random()<0.6){
          q.unhappy=Math.max(0,(q.unhappy||0)-1); if(q.unhappy===0) q.uWhy="";
          affAdd(q, 4, "감독의 공개 사과"); calmed++;
        }
      }
      if(calmed) addMood(`🙇 감독의 사과가 라커룸에 전해졌습니다 — 지켜보던 동료 ${calmed}명의 마음이 조금 풀렸습니다.`);
    } else {
      affAdd(p, -4, "받아들여지지 않은 사과");
      d=-2;
      txt=pick([
        `"...사과로 될 일이었으면 애초에 손을 올리지 마셨어야죠."`,
        pers===3?`"늦었습니다. 전 그날을 잊지 않습니다."`:`"...조금 더 시간이 필요합니다. 지금은 아닙니다."`,
        `"말은 감사합니다. 근데 볼 때마다 그날이 떠오릅니다."`]);
    }
  } else if(kind==="raise"){
    p.wage=Math.round(p.wage*1.25*10)/10; p.unhappy=0; p.uWhy=""; d=7;
    txt=pick([`"구단이 저를 인정해주는군요. 연봉 ${p.wage}억, 바로 사인하겠습니다."`,pers===1?`"진작 이러셨어야죠. 좋습니다, ${p.wage}억."`:`"감사합니다. 이 대우, 그라운드에서 갚겠습니다."`]);
  } else if(kind==="allow"){
    listForSale(pid, true); p.unhappy=Math.max(0,p.unhappy-1); d=2;
    allowOut(p, "감독 면담 — 이적 허용");
    txt=pick([`"보내주시는 거군요... 떠나는 날까지 프로답게 뛰겠습니다."`,`"서로에게 최선인 결정이라 생각합니다. 감사합니다."`,pers===3?`"진작 이렇게 될 일이었죠. 시원섭섭하네요."`:`"어디에 가든, 이 팀은 잊지 않겠습니다."`]);
  }
  p.morale=clamp(p.morale+d,30,99);
  TALKMSG={txt:`${p.name}: ${txt}`, d};
  saveGame(); show("player");
}
