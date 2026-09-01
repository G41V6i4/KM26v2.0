"use strict";
/* ---------- 이적시장 ---------- */
let tfFilter={pos:"", div:0, q:"", mine:true, afford:false, sub:"", page:1,
  /* 🧭 자리 능숙도 검색 (제보) — 「수비형 MF 와 수비수를 함께 체크해서 둘 다 되는 선수를,
     100/100 이 아니라 80 정도로도 소화하는 선수까지」 찾을 수 있게 한다. */
  fam:[], famMin:80, famAll:true,
  /* 🎂 나이 조건 (제보) — 「31세 이하」처럼 상한을, 필요하면 하한도 건다 */
  ageMax:0, ageMin:0};
/* 큰 포지션 아래에 붙는 세부 자리 — 대표 포지션(prefSlotOf) 기준으로 거른다 */
const PS_SUB={
  GK:[["GK","골키퍼",["GK"]]],
  DF:[["CB","센터백",["LCB","CB","RCB","SW"]],["LB","왼쪽 풀백",["LB"]],["RB","오른쪽 풀백",["RB"]],["WB","윙백",["LWB","RWB"]]],
  MF:[["DM","수비형 MF",["LDM","DM","RDM"]],["CM","중앙 MF",["LCM","CM","RCM"]],["WM","측면 MF",["LM","RM"]],["AM","공격형 MF",["LAM","CAM","RAM"]]],
  FW:[["ST","스트라이커",["LS","ST","RS"]],["WG","윙어",["LW","RW"]]]
};
/* ═══ 🧭 자리 능숙도 검색 ══════════════════════════════════════════
   FAM_POS(17자리) 를 직접 고르고, 「몇 이상」인지와 「모두/하나라도」를 정한다. */
const FAM_QUICK=[
  ["CB+DM",  ["DC","DM"],       "센터백 + 수미"],
  ["DM+CM",  ["DM","MC"],       "수미 + 중미"],
  ["CB+FB",  ["DC","DL","DR"],  "센터백 + 풀백"],
  ["FB+WG",  ["DL","DR","LW","RW"], "풀백 + 윙어"],
  ["MC+AMC", ["MC","AMC"],      "중미 + 공미"],
  ["WG+ST",  ["LW","RW","ST"],  "윙어 + 스트라이커"],
  ["AMC+ST", ["AMC","ST"],      "공미 + 스트라이커"]
];
const FAM_MIN_STEPS=[50,60,70,80,90,100];
function famVal(p, k){
  if(!p) return 0;
  if(!p.posFam){ try{ p.posFam=initPosFam(p); }catch(e){ return 0; } }
  return clamp(Math.round(p.posFam[k]||0), 0, 100);
}
function famQActive(){ return Array.isArray(tfFilter.fam) ? tfFilter.fam.filter(k=>FAM_POS.indexOf(k)>=0) : []; }
function famQPass(p){
  const ks=famQActive(); if(!ks.length) return true;
  const need=clamp(tfFilter.famMin|0, 0, 100);
  if(tfFilter.famAll) return ks.every(k=>famVal(p,k)>=need);
  return ks.some(k=>famVal(p,k)>=need);
}
/* 조건에 걸린 자리들 중 가장 낮은 값 — 「둘 다 얼마나 되는가」의 실질 지표 (정렬·표시용) */
function famQWorst(p){
  const ks=famQActive(); if(!ks.length) return 0;
  let m=101; for(const k of ks) m=Math.min(m, famVal(p,k));
  return m===101?0:m;
}
function famQToggle(k){
  if(!Array.isArray(tfFilter.fam)) tfFilter.fam=[];
  const i=tfFilter.fam.indexOf(k);
  if(i>=0) tfFilter.fam.splice(i,1); else tfFilter.fam.push(k);
  tfFilter.page=1; psRefresh();
}
function famQPreset(key){
  const hit=FAM_QUICK.find(x=>x[0]===key); if(!hit) return;
  const same = famQActive().length===hit[1].length && hit[1].every(k=>famQActive().indexOf(k)>=0);
  tfFilter.fam = same ? [] : hit[1].slice();
  tfFilter.famAll = true;
  tfFilter.page=1; psRefresh();
}
function famQMin(v){ tfFilter.famMin=clamp(parseInt(v,10)||0, 0, 100); tfFilter.page=1; psRefresh(); }
function famQMode(all){ tfFilter.famAll=!!all; tfFilter.page=1; psRefresh(); }
function famQClear(){ tfFilter.fam=[]; tfFilter.famMin=80; tfFilter.famAll=true; tfFilter.page=1; psRefresh(); }
let FAMQ_OPEN=false;
function famQToggleBox(){ FAMQ_OPEN=!FAMQ_OPEN; psRefresh(); }
function psSubSlots(pos, key){
  const rows=PS_SUB[pos]||[]; const hit=rows.find(r=>r[0]===key);
  return hit ? hit[2] : null;
}
const PS_PER=10;   // 한 페이지에 열 명
let tfTab="search";
/* ---------- 구단 상황판 ---------- */
function situationCard(){
  const t=userTeam();
  const items=[];
  for(const p of t.players){
    if(p.sulk>0) items.push(`🤬 <b class="clickable" onclick="openPlayerMenu(event,${p.id})">${p.name}</b> — <b>태업 중</b> (${p.sulk}R 남음, 선발 불가 · 이적명단 철회 시 즉시 복귀)`);
    if(p.noMove) items.push(`🙅 <b class="clickable" onclick="openPlayerMenu(event,${p.id})">${p.name}</b> — <b>잔류 선언</b>: 어떤 이적 제안도 본인이 거부합니다 (명단 철회로 해제)`);
    if(p.unhappy>=3) items.push(`🚨 <b class="clickable" onclick="openPlayerMenu(event,${p.id})">${p.name}</b> — <b>공개 이적 요청</b> (사유: ${p.uWhy}) — 면담·이적 허용·연봉 인상으로 해결`);
    else if(p.unhappy>0) items.push(`😠 <b class="clickable" onclick="openPlayerMenu(event,${p.id})">${p.name}</b> — 불만 ${p.unhappy}/3 (${p.uWhy})`);
    if(p.promise){ const left=Math.max(0,p.promise.need-(p.apps-p.promise.apps0));
      const hold = p.inj>0?`부상(${p.inj}주)` : p.ban>0?`출장정지(${p.ban}경기)` : p.banE>0?`출전정지(${p.banE}경기)` : null;
      items.push(`🤝 <b class="clickable" onclick="openPlayerMenu(event,${p.id})">${p.name}</b> — 출전 약속: ${p.promise.rounds}R 내 <b>${left}경기</b> 더 출전 필요`
        +(hold?` <b style="color:var(--gold)">· ⏸ ${hold}으로 카운트 보류</b>`:"")); }
  }
  if(G.nego){ const np=G.teams[G.nego.fromId].players.find(x=>x.id===G.nego.pid); if(np) items.push(`💸 영입 협상 진행 중: <b>${np.name}</b> (${G.teams[G.nego.fromId].short}) — ${{fee:"이적료",wage:"연봉",agent:"에이전트"}[G.nego.stage]} 단계`); }
  if(G.snego){ const sp=t.players.find(x=>x.id===G.snego.pid); if(sp) items.push(`💼 판매 협상 진행 중: <b>${sp.name}</b> ← ${G.teams[G.snego.tid].short} (현재 제시 ${G.snego.bid}억)`); }
  if((G.offers||[]).length) items.push(`📨 타 구단 제의 <b>${G.offers.length}건</b> 처리 대기`);
  if(!items.length) return "";
  /* ⚠ 제보 — 선수단 40명을 팬 감독의 상황판이 100줄이 됐다.
     ① 같은 종류는 묶어서 요약(3건 초과 시 접힌 요약줄) ② 전체 접기 토글 ③ 펼쳐도 스크롤 박스. */
  const fold=!!(G.opt && G.opt.sitFold);
  const head=`<h3 class="clickable" onclick="G.opt=G.opt||{};G.opt.sitFold=${fold?"false":"true"};saveGame();show('home')"
    title="눌러서 ${fold?"펼치기":"접기"}">📋 구단 상황판 <span class="small">(${items.length}건)</span>
    <span class="small" style="float:right">${fold?"▸ 펼치기":"▾ 접기"}</span></h3>`;
  if(fold) return `<div class="card" style="border-color:#d29922">${head}</div>`;
  /* 같은 이모지(=같은 종류)끼리 묶어, 4건 이상이면 앞 3건 + "외 N명" 요약으로 줄인다 */
  const groups={};
  for(const it of items){ const k=it.slice(0,2); (groups[k]=groups[k]||[]).push(it); }
  const SIT_SHOW=3;
  const rows=[];
  for(const k in groups){
    const g=groups[k];
    if(g.length<=SIT_SHOW){ rows.push(...g); continue; }
    const open=!!(G.opt && G.opt.sitOpen && G.opt.sitOpen[k]);
    rows.push(...(open?g:g.slice(0,SIT_SHOW)));
    rows.push(`<span class="clickable" style="color:var(--gold)" onclick="G.opt=G.opt||{};G.opt.sitOpen=G.opt.sitOpen||{};G.opt.sitOpen['${k}']=${open?"false":"true"};saveGame();show('home')">${open?`▴ ${k} 접기`:`▾ 같은 상황 ${g.length-SIT_SHOW}건 더 보기`}</span>`);
  }
  return `<div class="card" style="border-color:#d29922">${head}
  <div style="max-height:300px;overflow-y:auto;overscroll-behavior:contain">
  ${rows.map(i=>`<div style="padding:4px 0;border-bottom:1px solid #21262d">${i}</div>`).join("")}</div></div>`;
}
/* ---------- 협상 탭 ---------- */
function negoView(){
  /* ⚠ 예전에는 "진행 중인 협상이 없습니다"를 카드보다 먼저 계산했다. 그런데 negoCard/snegoCard 는
     대상 선수가 사라졌을 때 스스로 G.nego/G.snego 를 지우고 빈 문자열을 돌려준다. 그래서
     "안내문은 숨겨졌는데 카드도 없는" 완전히 빈 협상 화면이 나올 수 있었다.
     카드를 먼저 만들어 보고, 정말 아무것도 없을 때만 안내문을 띄운다. */
  const cards = negoCard() + snegoCard() + (function(){ try{ return acNegoCard(); }catch(e){ return ""; } })();
  let _lnA=0; try{ _lnA=loanAsksPrune().length; }catch(e){ _lnA=(G.loanAsks||[]).length; }
  let _lnO=0; try{ _lnO=loanOffersPrune().length; }catch(e){ _lnO=(G.loanOffers||[]).length; }
  const loanN = _lnA+_lnO;
  const loanLink = loanN
    ? `<div class="msg warn" style="border-width:2px">🔁 <b>임대 제안 ${loanN}건</b>이 도착해 있습니다 —
        <button class="mini" style="margin-left:6px" onclick="lcTab='offer';show('loancenter')">🔁 임대 센터에서 확인</button></div>`
    : "";
  const empty = !cards.trim();
  return `<h2>🤝 협상 테이블</h2>
  ${loanLink}
  ${empty?`<div class="msg info">진행 중인 협상이 없습니다.<br><br>
  · <b>영입 협상</b>: 이적시장 탭 → 🔍 선수 검색 / 🆓 FA 시장에서 "협상 시작"<br>
  · <b>판매 협상</b>: 타 구단 제의 탭에서 🤝 협상<br>
  · <b>스태프 협상</b>: 이적시장 탭 → 🎩 스태프에서 "협상 시작"<br>
  · <b>임대</b>: 🔁 임대 센터에서 한꺼번에 처리합니다<br><br>
  <span class="small">협상은 라운드를 소모하지 않으며, 경기를 치르는 동안에도 유지됩니다.</span></div>`:""}
  ${cards}`;
}
/* ---------- 타 구단 제의 탭 ---------- */
function offersView(){
  const t=userTeam();
  const wi=windowInfo();
  for(const o of (G.offers||[])) o.seen=1;   // 탭을 열었다 — 이제 정상적으로 만료된다
  const offers=(G.offers||[]).map((o,i)=>({o,i,p:t.players.find(p=>p.id===o.pid)})).filter(x=>x.p);
  const listed=G.transferBids.map(b=>t.players.find(p=>p.id===b.pid)).filter(Boolean);
  return `<h2>📨 타 구단 제의</h2>
  ${wi.open?`<div class="msg info">🤝 <b>협상</b>: 이적료 올려받기 · ✅ <b>수락</b>: 즉시 이적 · 🚫 <b>차단</b>: 협상 거부 — 선수 성격·충성심에 따라 반응이 갈립니다. 야심가는 강팀행이 막히면 불만을 갖고, 이적을 원하던 선수는 강하게 반발합니다.</div>`
          :`<div class="msg warn">이적시장이 닫혀 있어 새로운 제의는 들어오지 않습니다.</div>`}
  ${situationCard()}
  ${(function(){
    const on=swapBlocked(), n=G.swapNo||0;
    return `<div class="card" style="padding:10px 12px">
      <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
        <b>🔀 선수 끼워팔기 제의</b>
        <button class="mini ${on?"sel":""}" onclick="toggleNoSwap()">${on?"☑ 받지 않음":"☐ 받는 중"}</button>
        ${on&&n?`<span class="small" style="color:var(--sub)">지금까지 <b>${n}건</b> 돌려보냈습니다</span>`:""}
      </div>
      <p class="small" style="margin:6px 0 0">${on
        ? "현금 제안만 올라옵니다. 상대 선수를 끼워 넣은 제의는 프런트 선에서 반려되어 이 목록에 보이지 않습니다."
        : "상대 구단이 자기 선수에 현금을 얹어 제안할 수 있습니다. 볼 것도 없이 거절하신다면 위 버튼을 끄세요."}</p>
    </div>`;
  })()}
  ${(function(){ try{ return saudiCard(); }catch(e){ return ""; } })()}
  ${/* 🔙 제보 — 협상 탭으로 넘기지 않는다. 여기서 그대로 이어간다 */""}
  ${(function(){ try{ return G.snego ? snegoCard() : ""; }catch(e){ return ""; } })()}
  ${offers.length?`<div class="card"><h3>받은 제의 (${offers.length}건)</h3>
    <div class="tblScroll"><table><tr>${sortTh("offers","name","선수")}${sortTh("offers","club","제안 구단")}${sortTh("offers","fee","제안 내용")}${sortTh("offers","mv","시장가치")}${sortTh("offers","unhappy","선수 상태")}<th>성사 전망</th>${sortTh("offers","exp","만료")}<th></th></tr>
    ${applySort("offers", offers,
      {name:x=>x.p.name, club:x=>(G.teams[x.o.tid]||{}).short||"", fee:x=>x.o.fee||0,
       mv:x=>marketValue(x.p), unhappy:x=>x.p.unhappy||0, exp:x=>x.o.exp||0}, "").map(({o,i,p})=>{
      const bo=teamOVR(G.teams[o.tid]), mo=teamOVR(t);
      /* 실제 개인 협상 판정과 똑같은 값으로 전망을 낸다 — 라벨과 결과가 어긋나지 않는다 */
      let risk;
      {
        const rp=moveRefuseP(p, G.teams[o.tid]);
        if(p.noMove) risk='<span style="color:var(--red)">거부 확실 (잔류 선언)</span>';
        else if(wantsOut(p)) risk=`<span style="color:var(--green)">🚪 본인이 이적 요청</span> <span class="small" style="opacity:.7">거부 ${rp}%</span>`;
        else if(rp<=12) risk=`<span style="color:var(--green)">순조로움${p.unhappy>0?" (본인도 원함)":""}</span>`;
        else if(rp<=28) risk=`<span style="color:var(--green)">대체로 순조</span> <span class="small" style="opacity:.7">거부 ${rp}%</span>`;
        else if(rp<=50) risk=`<span style="color:#d29922">설득 필요</span> <span class="small" style="opacity:.7">거부 ${rp}%</span>`;
        else risk=`<span style="color:var(--red)">거부 유력</span> <span class="small" style="opacity:.7">거부 ${rp}%</span>`;
      }
      const swapP = o.swapPid ? G.teams[o.tid].players.find(x=>x.id===o.swapPid) : null;
      const dealTxt = swapP
        ? `🔀 <span class="clickable" onclick="event.stopPropagation();openPlayerMenu(event,${swapP.id})">${swapP.name}</span> <span class="small">(${swapP.pos} ${dispOvr(swapP)})</span>${o.fee>0?` + <span class="money">${o.fee}억</span>`:` <span class="small">(순수 스왑)</span>`}`
        : `<span class="money">${o.fee}억</span>`;
      return `<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}${pTags(p)}</td>
    <td><span class="clickable" style="text-decoration:underline dotted;text-underline-offset:3px" title="${G.teams[o.tid].name} 스쿼드 보기" onclick="openTeamSquad('${o.tid}')">${G.teams[o.tid].short}</span> ${teamStars(G.teams[o.tid], G.teams[o.tid].short+" 전력")}<span class="small">${bo>mo+0.5?" · 강팀":bo<mo-4?" · 약팀":bo<mo-0.5?" · 한 수 아래":""}</span></td>
    <td>${dealTxt}</td><td>${marketValue(p)}억</td>
    <td>${p.noMove?'<span class="tag u22">잔류 선언</span>':p.unhappy>0?'<span class="tag inj">이적 원함</span>':moodIcon(p)+" "+mor(p.morale)}</td>
    <td class="small">${risk}</td>
    <td class="small">${o.exp}R 후</td>
    <td><button class="mini" onclick="startSellNego(${p.id},'${o.tid}')">🤝 협상</button> <button class="mini" onclick="acceptOffer(${p.id},'${o.tid}')">✅ 수락</button> <button class="mini" onclick="blockOffer(${p.id},'${o.tid}')">🚫 차단</button></td></tr>`;}).join("")}</table></div></div>`
  :`<div class="card"><p class="small">현재 들어온 제의가 없습니다. 선수를 <b>이적명단</b>에 올리면 제의가 훨씬 빨리 들어옵니다. (스쿼드 탭 또는 이적시장 탭)</p></div>`}
  <div class="card"><h3>📤 이적명단 (${listed.length}명)</h3>
    ${listed.length?`<div class="tblScroll"><table><tr><th>선수</th><th>능력</th><th>가치</th><th>상태</th><th></th></tr>
    ${listed.map(p=>`<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}${pTags(p)}</td><td>${abilityStars(p)}</td><td>${marketValue(p)}억</td>
    <td>${p.sulk>0?'<span class="tag inj">태업 중 '+p.sulk+'R</span>':p.noMove?'<span class="tag u22">이적 거부</span>':moodIcon(p)+" "+mor(p.morale)}</td>
    <td><button class="mini" onclick="unlist(${p.id})">명단 철회</button></td></tr>`).join("")}</table></div>`
    :`<p class="small">이적명단이 비어 있습니다.</p>`}
  </div>`;
}
function snegoCard(){
  const N=G.snego; if(!N) return "";
  const buyer=G.teams[N.tid]; const p=userTeam().players.find(x=>x.id===N.pid);
  if(!p){ G.snego=null; return ""; }
  const who={me:"👔 나",club:"🏢"};
  const cls={me:"evt-sub",club:"evt-txt"};
  const swapP = N.swapPid ? buyer.players.find(x=>x.id===N.swapPid) : null;
  const wantP = N.wantPid ? buyer.players.find(x=>x.id===N.wantPid) : null;
  return `<div class="card" style="border-color:var(--green)">
    <h3>💼 판매 협상 — ${p.name} ← ${buyer.name} <span class="small">현재 현금 제시액 <b class="money">${N.bid}억</b>${swapP?` + 선수 <b>${swapP.name}(${swapP.pos} ${dispOvr(swapP)})</b> 포함`:""} (시장가치 ${marketValue(p)}억)</span></h3>
    <div style="background:#0a0f14;border:1px solid var(--line);border-radius:8px;padding:10px;max-height:180px;overflow-y:auto;font-size:13px;line-height:1.7">
      ${N.log.map(l=>`<div class="${cls[l.w]||"evt-txt"}">${who[l.w]||""} ${l.t}</div>`).join("")}
    </div>
    <div style="margin-top:10px">
      요구 이적료: <input type="number" id="sngOffer" step="0.5" min="0" style="width:110px" placeholder="요구액 (억)">
      <button class="mini" onclick="sellDemand()">💬 요구하기</button>
      <button class="mini" onclick="cancelSellNego()">🚪 협상 중단</button>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
      <label class="small">🔀 트레이드 요구 <span class="small">— 현금만 받지 말고 ${buyer.short} 선수를 함께 요구할 수 있습니다</span></label><br>
      <select onchange="sellSetWant(this.value)" style="margin-top:4px;max-width:340px">
        <option value="">— 현금만 받는다 —</option>
        ${[...buyer.players].filter(x=>!x.loan&&!x.army&&!x.emg).sort((a,b)=>b.ovr-a.ovr)
          .map(x=>`<option value="${x.id}" ${N.wantPid===x.id?"selected":""}>${x.name} (${x.pos} ${dispOvr(x)}, 가치 ${marketValue(x)}억)${x.id===N.swapPid?" ★ 상대가 먼저 제안한 선수":""}</option>`).join("")}
      </select>
      ${wantP?(function(){
        /* ⚠ 제보 — 상대가 먼저 얹은 선수를 그대로 요구하면 「추가 요구」가 아니다 */
        const sv=(N.swapV!=null?N.swapV:(swapP?marketValue(swapP):0));
        const add=Math.max(0, Math.round((marketValue(wantP)-sv)*10)/10);
        return wantP.id===N.swapPid
          ? `<div class="small" style="margin-top:5px;color:var(--green)">✅ <b>${wantP.name}</b>은 상대가 <b>먼저 제안한 선수</b>입니다 — 추가 요구로 치지 않습니다.
              (총 요구 = 입력한 현금만)</div>`
          : `<div class="small" style="margin-top:5px;color:var(--gold)">✅ <b>${wantP.name}</b> 요구 중 — 시장가치 <b>${marketValue(wantP)}억</b>${sv>0?`, 상대가 먼저 얹은 <b>${swapP?swapP.name:"선수"}</b>(${sv}억)를 대신 받는 것이므로 차액 <b>${add}억</b>만`:""} 요구 총액에 합산됩니다.
              (현금 0억도 가능 · 총 요구 = 입력한 현금 + ${add}억)</div>`;
      })():""}
    </div>
    <div class="small" style="margin-top:6px">요구 <b>총액</b>(현금 + 추가로 요구한 선수 가치)이 상대 한도 안이면 성사됩니다. 상대의 핵심 자원은 어떤 조건에도 내주지 않지만, <b>상대가 먼저 제안한 선수(★)는 예외</b>입니다. 너무 높게 부르면 3회 만에 떠납니다.</div>
  </div>`;
}
/* 🤝 스태프 협상 카드 — 선수 협상 테이블과 같은 자리, 같은 모양 */
function acNegoCard(){
  const N=G.acNego; if(!N) return "";
  const c=acPool().find(x=>x.id===N.id);
  if(!c){ G.acNego=null; return ""; }
  const t=userTeam();
  const RO=acRole(c), T=acNegoOf(c);
  const room=acNegoRoom();
  const s=acNegoScore(N, c);
  const mood = s>=0 ? ["받아들일 조건","#3fb950"] : s>-12 ? ["거의 다 왔다","#56d364"]
             : s>-24 ? ["아직 모자라다","#d29922"] : ["많이 모자라다","#f85149"];
  const who={me:"👔 나", them:`${RO.ic} ${c.n}`, sys:"📋"};
  const cls={me:"evt-sub", them:"evt-card", sys:"evt-info"};
  const wy=acWantYears(c);
  const over=N.wage>room+0.001;
  const cur=((c.role||"ac")==="ac")?acOf():null;
  const fee=cur?acFireFee(cur.id):0;
  return `<div class="card" style="border-color:var(--gold)">
    <h3>🤝 스태프 협상 — ${c.n} <span class="small">${RO.ic} ${RO.n} · ${c.age}세 · ${T.ic} ${T.n}</span></h3>
    <div class="small" style="margin-bottom:6px">
      요구 연봉 <b>${N.ask}억</b> · 희망 계약 <b>${wy}년</b>${RO.slot?` · 담당 자리를 원합니다`:` · 상시 근무`}
      · 남은 기회 <b>${Math.max(0,5-(N.tries||0))}번</b>
    </div>
    <div style="background:#0a0f14;border:1px solid var(--line);border-radius:8px;padding:10px;max-height:220px;overflow-y:auto;font-size:13px;line-height:1.7">
      ${N.log.map(l=>`<div class="${cls[l.w]||"evt-info"}">${who[l.w]||""} ${l.t}</div>`).join("")}
    </div>
    <div class="ngBudget">
      <span class="small">스태프 연봉 여력</span>
      <b class="money" style="font-size:18px">${room}억</b>
      <span class="small">제시 <b>${N.wage}억</b> → 잔여
        <b style="color:${over?"var(--red)":"var(--green)"}">${Math.round((room-N.wage)*10)/10}억</b>
        ${fee>0?` · 기존 수석코치 위약금 <b>${fee}억</b>`:""}</span>
    </div>
    <div style="margin:8px 0;padding:9px;border:1px solid var(--line);border-radius:8px">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:8px">
        <b class="small">💰 연봉</b>
        <button class="mini" onclick="acNegoSetWage(-0.5)">−0.5</button>
        <button class="mini" onclick="acNegoSetWage(-0.1)">−0.1</button>
        <b style="font-size:17px;color:${over?"var(--red)":"var(--gold)"};min-width:64px;text-align:center">${N.wage}억</b>
        <button class="mini" onclick="acNegoSetWage(0.1)">+0.1</button>
        <button class="mini" onclick="acNegoSetWage(0.5)">+0.5</button>
        <span class="small" style="opacity:.75">요구 대비 ${N.wage>=N.ask?"+":""}${Math.round((N.wage-N.ask)/Math.max(0.4,N.ask)*100)}%</span>
      </div>
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:8px">
        <b class="small">📜 계약</b>
        ${[1,2,3,4].map(y=>`<button class="mini ${N.years===y?"sel":""}" style="padding:3px 11px" onclick="acNegoSetYears(${y})">${y}년${y===wy?" ✓":""}</button>`).join(" ")}
      </div>
      ${RO.slot?`<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
        <b class="small">🗂️ 담당 약속</b>
        <select onchange="acNegoSetSlot(this.value)" style="padding:4px 7px">
          <option value=""${!N.slot?" selected":""}>— 약속하지 않음 —</option>
          ${AC_SLOT.map(x=>`<option value="${x.k}"${N.slot===x.k?" selected":""}>${x.ic} ${x.n}${slotStaff(x.k).length?` (현재 ${slotStaff(x.k).length}명)`:" (비어 있음)"}</option>`).join("")}
        </select>
        <span class="small" style="opacity:.7">자리를 약속하면 연봉을 깎기 쉬워집니다</span>
      </div>`:`<div class="small" style="opacity:.75">🗂️ ${RO.n}는 훈련 칸 배정 없이 상시 근무합니다.</div>`}
    </div>
    <div class="small" style="margin-bottom:7px">상대 반응: <b style="color:${mood[1]}">${mood[0]}</b></div>
    <div class="stBtns">
      <button class="mini" ${over?'disabled title="연봉 여력 초과"':""} onclick="acNegoOffer()">🤝 이 조건으로 제시</button>
      <button class="mini" onclick="acNegoQuit()">🚪 협상을 접는다</button>
    </div>
  </div>`;
}
function negoCard(){
  const N=G.nego; if(!N) return "";
  const ut=userTeam();
  const from=N.fromId?G.teams[N.fromId]:null;
  const p=negoPlayerOf(N);
  if(!p){ G.nego=null; return ""; }
  const stageName={fee:"1단계 · 구단 협상 (이적료)", wage:"2단계 · 선수 협상 (연봉)", agent:"3단계 · 에이전트 협상 (수수료)"}[N.stage];
  const curAsk=N.stage==="fee"?N.feeAsk:N.stage==="wage"?N.wageAsk:N.agAsk;
  const srcName = from ? from.short : (N.os ? ("🌍 "+(N.osClub||p.osClub||"해외 구단")) : "FA·무소속");
  const who={me:"👔 나",club:"🏢 "+(from?from.short:(N.os?(N.osClub||p.osClub||"해외 구단"):"FA")),player:"⚽",agent:"🕴️",sys:"📋"};
  const cls={me:"evt-sub",club:"evt-txt",player:"evt-card",agent:"evt-big",sys:"evt-info"};
  const agreedSwapP = N.agreedSwapPid ? ut.players.find(x=>x.id===N.agreedSwapPid) : null;
  // fee(구단 협상) 단계에서만 — 현금 대신/현금과 함께 내 선수를 끼워 넣는 FM식 "선수 포함 제안" 선택 UI
  const swapPicker = (N.stage==="fee" && from) ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
      <label class="small">🔀 선수 포함 제안 <span class="small">(현금 대신, 혹은 현금과 함께 내 선수를 끼워 넣을 수 있습니다)</span></label><br>
      <select onchange="negoSetSwap(this.value)" style="margin-top:4px;max-width:340px">
        <option value="">— 포함 안 함 (현금만) —</option>
        ${[...ut.players].filter(tradeableOwn).sort((a,b)=>b.ovr-a.ovr).map(x=>`<option value="${x.id}" ${N.offerSwapPid===x.id?"selected":""}>${x.name} (${x.pos} ${dispOvr(x)}, 가치 ${marketValue(x)}억)</option>`).join("")}
      </select>
      ${N.offerSwapPid?`<div class="small" style="margin-top:4px">✅ 선택됨 — 현금 제안액에 이 선수의 시장가치가 합산되어 상대 구단의 요구액과 비교됩니다.</div>`:""}
      ${(()=>{ const no=ut.players.filter(x=>!tradeableOwn(x)).length;
        return no?`<div class="small" style="margin-top:4px;opacity:.75">🔁 임대·군 복무·긴급 등록 선수 <b>${no}명</b>은 우리 소유가 아니라 목록에서 빠집니다.</div>`:""; })()}
    </div>` : "";
  return `<div class="card" style="border-color:var(--gold)">
    <h3>🤝 협상 테이블 — ${p.name} (${srcName}) <span class="small">${stageName}</span></h3>
    <div class="small" style="margin-bottom:6px">
      ${N.agreedFee!==undefined?`✅ 이적료 합의: 현금 ${N.agreedFee}억${agreedSwapP?` + <b>${agreedSwapP.name}</b> 포함`:""}`:""} ${N.agreedWage?` · ✅ 연봉 합의: ${N.agreedWage}억`:""}
      ${N.stage==="agent"?` · 에이전트 <b>${N.agent.name}</b> (${N.agent.n} — ${N.agent.desc})`:""}
    </div>
    <div style="background:#0a0f14;border:1px solid var(--line);border-radius:8px;padding:10px;max-height:220px;overflow-y:auto;font-size:13px;line-height:1.7">
      ${N.log.map(l=>`<div class="${cls[l.w]}">${who[l.w]} ${l.t}</div>`).join("")}
    </div>
    <div class="ngBudget">
      <span class="small">가용 이적 예산</span>
      <b class="money" style="font-size:18px">${ut.budget}억</b>
      <span class="small">이번 협상 예상 지출 <b>${Math.round(((N.agreedFee!==undefined?N.agreedFee:curAsk)+(N.agreedAg||0))*10)/10}억</b>
        → 잔여 <b style="color:${ut.budget-((N.agreedFee!==undefined?N.agreedFee:curAsk)+(N.agreedAg||0))<0?"var(--red)":"var(--green)"}">${Math.round((ut.budget-((N.agreedFee!==undefined?N.agreedFee:curAsk)+(N.agreedAg||0)))*10)/10}억</b></span>
    </div>
    ${N.stage==="wage"?`<div style="margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:8px">
      📜 계약 기간:
      ${[1,2,3,4,5].map(y=>`<button class="mini ${(N.years||N.prefYears||negoPrefYears(p))===y?"sel":""}" style="padding:3px 10px" onclick="negoSetYears(${y})">${y}년</button>`).join(" ")}
      <span class="small" style="margin-left:6px">선수 희망 <b>${N.prefYears||negoPrefYears(p)}년</b> — 희망보다 짧으면 연봉을 더 부르고, 길게 보장하면 조금 양보합니다</span>
    </div>`:""}
    ${(()=>{ if(N.stage!=="wage") return "";
      try{
        const mind=N.mind || (N.mind=playerMoveMind(p, from, ut));
        const L=mind.v>=0.7?["관심 있음","var(--green)","조건만 맞으면 올 겁니다."]
               :mind.v>=0.45?["미지근함","var(--gold)","마음이 반쯤 열려 있습니다. 무리한 제시는 위험합니다."]
               :["관심 없음","var(--red)","이 이적 자체를 내켜 하지 않습니다. 언제든 자리를 뜰 수 있습니다."];
        const top=(mind.F||[]).slice().sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,4);
        return `<div class="msg ${mind.v>=0.7?"good":mind.v>=0.45?"info":"warn"}" style="margin-top:10px">
          ⚽ <b>${p.name} 선수의 관심도: <span style="color:${L[1]}">${L[0]}</span></b>
          <span class="small"> — ${L[2]}</span>
          <div class="small" style="margin-top:4px">${top.map(f=>
            `<span style="margin-right:12px;color:${f.v>0?"var(--green)":"var(--red)"}">${f.v>0?"▲":"▼"} ${f.l}</span>`).join("")}</div>
        </div>`;
      }catch(e){ return ""; } })()}
    <div style="margin-top:10px">
      현재 요구액: <b class="money">${curAsk}억</b>${N.stage==="fee"?' <span class="small">(선수 포함 시 시장가치 합산 평가)</span>':""} ·
      <input type="number" id="ngOffer" step="0.5" min="0" style="width:110px" placeholder="현금 제안액 (억)">
      <button class="mini" onclick="negoOffer()">💬 제안하기</button>
      <button class="mini" onclick="cancelNego()">🚪 협상 중단</button>
    </div>
    ${swapPicker}
    <div class="small" style="margin-top:6px">협상이 진행돼도 날짜는 흐르지 않습니다. 단, 상대의 인내심에는 한계가 있고
      <b>한 번 결렬되면 ${NEGO_COOLDOWN_DAYS}일간 재접촉이 불가능합니다.</b></div>
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════
   📰 이적 루머
   기자마다 신뢰도가 다르다. 특종을 잘 잡는 기자가 쓴 기사는 대체로 사실로 굴러가고,
   조회수만 노리는 매체는 아니면 말고 식이다. 우리 선수 이야기가 돌면 라커룸이 흔들리고,
   기자회견에서 그 루머를 직접 물어본다.
   ═══════════════════════════════════════════════════════════════ */
const RUMOR_MAX=26;
const REPORTERS=[
  {n:"김태석", o:"스포츠조선", rel:82, ic:"📰", tone:"신뢰도 높은 이적 전문"},
  {n:"박준영", o:"풋볼리스트", rel:74, ic:"⚽", tone:"현장 취재형"},
  {n:"이하늘", o:"K리그 인사이드", rel:66, ic:"🎙️", tone:"구단 관계자 인용"},
  {n:"최민수", o:"더 트랜스퍼", rel:48, ic:"💬", tone:"소문 수집형"},
  {n:"정우빈", o:"이적왕TV", rel:30, ic:"📺", tone:"조회수 장사"},
  {n:"익명 계정", o:"@KL_insider", rel:18, ic:"👤", tone:"근본 없는 지라시"}
];
const RUMOR_KIND={
  interest:{n:"영입 관심", ic:"👀"},
  foreign:{n:"외국인 영입설", ic:"🌍"},
  fa:{n:"FA 영입설", ic:"🆓"},
  scout:{n:"스카우트 정보", ic:"🔎"},
  army:{n:"전역 거취설", ic:"🎖️"},
  bid:{n:"공식 제안설", ic:"💰"},
  exit:{n:"이적 요청설", ic:"🚪"},
  abroad:{n:"해외 진출설", ic:"✈️"},
  renew:{n:"재계약 협상설", ic:"📝"},
  swap:{n:"맞교환설", ic:"🔀"},
  sack:{n:"감독 경질설", ic:"🪑"},
  target:{n:"우리 구단 영입 추진설", ic:"🎯"},
  loanOut:{n:"임대 문의설", ic:"🔁"},
  loanIn:{n:"임대 영입설", ic:"🔁"},
  loanBack:{n:"임대생 근황", ic:"📡"},
  loanBuy:{n:"완전 영입설", ic:"💰"}
};
function rumorList(){ if(!G.rumors) G.rumors=[]; return G.rumors; }
function rumorPush(r){
  const L=rumorList();
  r.id=(G.rumorSeq=(G.rumorSeq||0)+1);
  r.d=G.day||0; r.s=G.season;
  L.unshift(r);
  G.rumors=L.slice(0, RUMOR_MAX);
}
/* 신뢰도 라벨 — 기자 신뢰도와 루머 자체의 진위 가능성을 함께 본다 */
function rumorTrust(r){
  const v=r.truth;
  return v>=75 ? {t:"매우 유력", c:"#3fb950"}
       : v>=55 ? {t:"신빙성 있음", c:"#56d364"}
       : v>=35 ? {t:"확인 필요", c:"#d29922"}
       : v>=18 ? {t:"신빙성 낮음", c:"#e08c3a"}
                : {t:"낭설에 가까움", c:"#f85149"};
}
/* 루머 한 건 생성 */
function genRumor(){
  const ut=userTeam(); if(!ut) return null;
  const rep=pick(reporters());
  const others=Object.values(G.teams).filter(t=>t.id!==ut.id && !isArmyTeam(t));
  if(!others.length) return null;
  const roll=Math.random();
  // 기자 신뢰도가 높을수록 사실로 이어질 확률이 높다
  const truth=clamp(Math.round(rep.rel*0.75 + R(35) - 12), 3, 96);
  // 팀·선수 이름 뒤의 조사는 받침에 따라 달라진다 — fixJosa 가 "이/가" 표기를 실제 조사로 바꿔 준다
  const mk=(kind, pid, fromId, toId, txt, extra)=>Object.assign(
    {kind, pid, fromId, toId, txt:fixJosa(txt), truth, rep:rep.n, ro:rep.o, ric:rep.ic}, extra||{});
  /* 🎖️ 김천 플레이 — 상무 선수는 이적·영입 대상이 아니다. 이적설 대신
     전역 후 거취 이야기와 남의 리그 소식만 돈다. */
  if(isArmyTeam(ut)){
    if(roll<0.45){
      const sold=ut.players.filter(p=>p.army);
      if(sold.length){
        const p=pick(sold);
        const back=G.teams[p.army.fromId];
        const to2=pick(others.filter(t=>!back || t.id!==back.id));
        return mk("army", p.id, ut.id, to2?to2.id:null,
          pick([`${p.name}, 전역 후 ${back?back.short+" 복귀 대신 ":""}${to2?to2.short+"행":"해외행"} 검토설`,
                `[단독] ${to2?to2.short:"복수 구단"}, ${p.name} 전역 시점에 맞춰 영입 준비 중`,
                `${p.name} 측 "전역 후 거취는 아직 백지" — 원소속 ${back?back.short:"구단"}은 긴장`]));
      }
    }
    // 나머지는 남의 리그 이야기 (③과 동일)
    const from2=pick(others), to3=pick(others.filter(t=>t.id!==from2.id));
    if(!to3) return null;
    const cand2=from2.players.filter(p=>avail(p));
    if(!cand2.length) return null;
    const p2=pick(cand2);
    return mk("interest", p2.id, from2.id, to3.id,
      pick([`${to3.name}, ${from2.short} ${p2.name} 영입 검토`,
            `${from2.short} ${p2.name}, ${to3.short}행 급물살?`]));
  }
  // ① 우리 선수에게 타 구단이 관심 (가장 흔하다)
  if(roll<0.24){
    const cand=ut.players.filter(p=>avail(p)&&p.ovr>=teamOVR(ut)-3);
    if(!cand.length) return null;
    const p=pick(cand);
    const buyer=pick(others.filter(t=>teamOVR(t)>=teamOVR(ut)-3)) || pick(others);
    const fee=Math.round(marketValue(p)*(0.9+Math.random()*0.7)*10)/10;
    return mk("interest", p.id, ut.id, buyer.id,
      pick([`${buyer.name}, ${ut.short}의 ${p.name} 영입 관심… 이적료 ${fee}억 안팎 거론`,
            `[단독] ${buyer.short}이/가 ${p.name}을/를 최우선 보강 후보로 올렸다`,
            `${buyer.short} 관계자 "${p.name} 지켜보고 있다" — 접촉설 확산`]), {fee});
  }
  // ② 우리 구단이 타 구단 선수를 노린다
  if(roll<0.40){
    const from=pick(others);
    const cand=from.players.filter(p=>avail(p));
    if(!cand.length) return null;
    const p=pick(cand);
    const fee=Math.round(marketValue(p)*(0.9+Math.random()*0.6)*10)/10;
    return mk("target", p.id, from.id, ut.id,
      pick([`${ut.name}, ${from.short}의 ${p.name} 영입 추진… ${fee}억 규모 협상 임박?`,
            `[속보] ${ut.short}이/가 ${p.name} 영입전에 뛰어들었다`,
            `${ut.short} 감독, ${from.short} ${p.name}을/를 직접 점찍었다는 후문`]), {fee});
  }
  // ③ AI 구단끼리
  if(roll<0.74){
    const from=pick(others), to=pick(others.filter(t=>t.id!==from.id));
    if(!to) return null;
    const cand=from.players.filter(p=>avail(p));
    if(!cand.length) return null;
    const p=pick(cand);
    return mk("interest", p.id, from.id, to.id,
      pick([`${to.name}, ${from.short} ${p.name} 영입 검토`,
            `${from.short} ${p.name}, ${to.short}행 급물살?`,
            `${to.short}이/가 ${from.short}의 ${p.name}에게 관심을 보이고 있다`]));
  }
  // ③-2 해외 이적시장 — K리그 구단들도 외국인 시장을 들여다본다
  if(roll<0.80){
    let osR=[]; try{ osR=overseasList(); }catch(e){ osR=G.overseas||[]; }
    if(!osR.length) return null;
    const p=pick(osR);
    const to=Math.random()<0.4 ? ut : pick(others);
    const fee=Math.round((p.fee||marketValue(p))*(0.85+Math.random()*0.5)*10)/10;
    return mk("foreign", p.id, null, to.id,
      pick([`${to.name}, 해외파 ${p.name}(${p.nat||"외국"}) 영입 검토… 이적료 ${fee}억 안팎`,
            `[단독] ${to.short}이/가 ${p.name} 측과 접촉했다 — 에이전트 방한설`,
            `${to.short} 스카우트팀, ${p.name} 최근 경기 직관 포착`]), {fee});
  }
  // ③-3 FA 시장
  if(roll<0.84 && Array.isArray(G.freeAgents) && G.freeAgents.length){
    const p=pick(G.freeAgents);
    const to=Math.random()<0.35 ? ut : pick(others);
    return mk("fa", p.id, null, to.id,
      pick([`${to.name}, FA ${p.name} 영입 저울질 — 무적 신분이라 이적료가 없다`,
            `${p.name}, ${to.short} 입단 테스트설… 본인은 부인`,
            `[단독] ${to.short}이/가 FA ${p.name}에게 계약 조건을 제시했다`]));
  }
  // ③-4 우리 스카우트망이 샌다 — 파견 보고서가 기사가 되어 돌아온다
  if(roll<0.86 && G.scout && Array.isArray(G.scout.list) && G.scout.list.length && Math.random()<0.5){
    const x=pick(G.scout.list); const p=x&&x.p?x.p:x;
    if(p && p.name) return mk("scout", p.id, null, ut.id,
      pick([`[단독] ${ut.short} 스카우트팀, ${p.name} 보고서 작성 — 내부 평가 긍정적`,
            `${ut.short}이/가 해외 파견 스카우트를 통해 ${p.name}을/를 지켜보고 있다`,
            `${ut.short} 영입 리스트에 ${p.name} 이름이 올랐다는 후문`]), {truth:clamp(truth+18,10,96)});
  }
  /* 🔁 임대 루머 — 완전 이적만 돌면 시장이 단조롭다. 임대는 "못 뛰는 선수"를 축으로 도는
     또 하나의 시장이고, 그 이야기가 따로 있어야 임대 센터가 살아 있는 것처럼 느껴진다. */
  if(roll<0.895){
    const kind=Math.random();
    /* (a) 우리 유망주를 데려가고 싶다는 문의설 */
    if(kind<0.30){
      const cand=ut.players.filter(p=>{ const age=G.season-p.by;
        return avail(p) && age<=23 && squadRole(p, ut)<0.35; });
      if(cand.length){
        const p=pick(cand);
        const to=pick(others);
        return mk("loanOut", p.id, ut.id, to.id,
          pick([`${to.name}, ${ut.short} 유망주 ${p.name} 임대 영입 추진`,
                `[단독] ${to.short}이/가 ${p.name} 임대를 문의했다 — "출전 시간 보장" 조건`,
                `${ut.short} ${p.name}, ${to.short}로 반 시즌 임대설… 완전이적 옵션 포함 여부가 관건`,
                `${to.short} 감독 "${p.name} 같은 어린 선수가 필요하다" — 임대 시장 정조준`]));
      }
    }
    /* (b) 우리가 남의 유망주를 빌려오려 한다는 설 */
    if(kind<0.58){
      const from=pick(others);
      const cand=from.players.filter(p=>{ const age=G.season-p.by;
        return avail(p) && !p.loan && age<=24 && squadRole(p, from)<0.35; });
      if(cand.length){
        const p=pick(cand);
        return mk("loanIn", p.id, from.id, ut.id,
          pick([`${ut.name}, ${from.short}의 ${p.name} 임대 영입 검토`,
                `[단독] ${ut.short}이/가 ${from.short}에 ${p.name} 임대를 타진했다`,
                `${from.short}에서 출전 기회를 못 잡은 ${p.name}, ${ut.short}행 임대설`,
                `${ut.short} 프런트, 이적료 없는 보강으로 ${p.name} 임대를 저울질`]));
      }
    }
    /* (c) 내보낸 임대생의 근황 — 잘하고 있다 / 조기 소환설 */
    {
      const sent=(typeof loanedOut==="function") ? loanedOut(ut) : [];
      if(sent.length){
        const {p, c}=pick(sent);
        const played=(p.apps||0)-((p.loan&&p.loan.apps0)||0);
        if(played>=6 && (p.seasonRating||0)>=7.20)
          return mk("loanBack", p.id, c?c.id:null, ut.id,
            pick([`${c?c.short:"임대 구단"}에서 펄펄 나는 ${p.name} — ${ut.short} 복귀 후 주전 경쟁 예고`,
                  `[화제] 임대생 ${p.name}, ${played}경기 평점 ${(p.seasonRating||0).toFixed(2)}… ${c?c.short:"임대팀"}은 완전 영입 희망`,
                  `${c?c.short:"임대 구단"} 감독 "${p.name} 계속 데리고 있고 싶다"`]));
        if(played<=2)
          return mk("loanBack", p.id, c?c.id:null, ut.id,
            pick([`${p.name} 임대 실패 기류 — ${c?c.short:"임대팀"}에서도 벤치, 조기 소환설`,
                  `${ut.short}, ${p.name} 임대 조기 종료 검토… "이럴 거면 데려온다"`]));
      }
      /* (d) 빌려온 선수의 완전 영입설 — 자주 나오면 잔소리가 된다 */
      const came=(typeof loanedInFrom==="function") ? loanedInFrom(ut) : [];
      if(came.length && Math.random()<0.35){
        const p=pick(came);
        const own=G.teams[p.loan.own];
        return mk("loanBuy", p.id, own?own.id:null, ut.id,
          p.loan.buy
            ? pick([`${ut.name}, 임대생 ${p.name} 완전 영입 옵션 행사 검토`,
                    `[단독] ${ut.short}이/가 ${p.name} 완전 영입을 두고 ${own?own.short:"원소속"}과 협의 중`])
            : pick([`${ut.name}, 임대생 ${p.name} 완전 영입 의사… 옵션이 없어 재협상 필요`,
                    `${own?own.short:"원소속 구단"} "${p.name}은 시즌 후 돌려받는다" 선 그어`]));
      }
    }
  }
  // ④ 우리 선수의 이적 요청·해외 진출설
  if(roll<0.90){
    const cand=ut.players.filter(p=>avail(p));
    if(!cand.length) return null;
    const p=pick(cand.sort((a,b)=>b.ovr-a.ovr).slice(0,8));
    if(Math.random()<0.5){
      return mk("abroad", p.id, ut.id, null,
        pick([`${p.name}, 일본·중동 클럽 관심… 해외 진출 타진`,
              `[단독] ${p.name} 측, 유럽 하부 리그 이적 알아보는 중`,
              `${p.name} 에이전트 "본인은 새로운 도전을 원한다"`]));
    }
    return mk("exit", p.id, ut.id, null,
      pick([`${ut.short} ${p.name}, 구단에 이적 요청했다는 이야기가 돈다`,
            `${p.name} 불만설… 라커룸 분위기 심상치 않다`,
            `${p.name} 측근 "출전 시간에 실망했다"`]));
  }
  // ⑤ 재계약·감독 경질설
  if(roll<0.95){
    const cand=ut.players.filter(p=>(p.ct||1)<=1);
    if(cand.length){
      const p=pick(cand);
      return mk("renew", p.id, ut.id, null,
        pick([`${ut.short}, ${p.name}과/와 재계약 협상 착수… 조건 이견`,
              `${p.name} 계약 만료 임박, 구단은 아직 조용하다`,
              `[단독] ${p.name} 재계약 사실상 합의 단계`]));
    }
  }
  const own=(G.trust&&G.trust.owner)||70;
  if(own<45){
    return mk("sack", null, ut.id, null,
      pick([`${ut.short} 구단 내부에서 감독 교체 이야기가 나오고 있다`,
            `[단독] ${ut.short}, 차기 감독 후보 물색 정황`,
            `${ut.short} 수뇌부 "인내심이 바닥났다"… 경질설 확산`]), {truth:clamp(90-own,10,92)});
  }
  const from=pick(others), to=pick(others.filter(t=>t.id!==from.id));
  if(!to) return null;
  const a=pick(from.players), b2=pick(to.players);
  if(!a||!b2) return null;
  return mk("swap", a.id, from.id, to.id,
    `${from.short} ${a.name} ↔ ${to.short} ${b2.name} 맞교환 논의설`);
}
/* 하루에 한두 건씩 시장이 떠든다 */
function brewRumors(){
  if(!transferOpen() && Math.random()<0.65) return;   // 시장이 닫히면 확 줄어든다
  const cnt = transferOpen() ? (Math.random()<0.5?1:2) : 1;
  for(let i=0;i<cnt;i++){
    const r=genRumor();
    if(r){ rumorPush(r); rumorToFeed(r);
      /* 🗞️ 우리 팀으로 «들어오는» 루머면 게시판이 들썩인다 (요청) */
      try{
        const _ut=userTeam();
        if(_ut && r.toId===_ut.id && Math.random()<0.75){
          const _p=(typeof findAnyPlayer==="function" && r.pid!=null) ? findAnyPlayer(r.pid) : null;
          fmkFill(FMK.rumorHype, 1+R(2), {t:_ut.short, p:(_p&&_p.name)||"이름 모를 외국인"});
        }
      }catch(e){}
    }
  }
  applyRumorFallout();
}
/* 루머가 라커룸을 흔든다 */
function applyRumorFallout(){
  const ut=userTeam(); if(!ut) return;
  for(const r of rumorList().slice(0,8)){
    if(r._hit) continue;
    r._hit=true;
    const p=ut.players.find(x=>x.id===r.pid);
    if(!p) continue;
    const w=r.truth/100;
    if(r.kind==="interest" && r.fromId===ut.id){
      // 더 좋은 팀이 부르면 마음이 흔들린다
      const to=G.teams[r.toId];
      const up=to ? clamp((teamOVR(to)-teamOVR(ut))*0.5, -1.5, 2.5) : 0;
      if(p.pers===1){ p.morale=Math.round(clamp(p.morale+3.5*w,25,99)*100)/100; }
      else p.morale=Math.round(clamp(p.morale-2.4*w+up*0.5,25,99)*100)/100;
      affAdd(p, -2.8*w, "이적 루머");
      if(Math.random()<0.16*w*(1+up*0.2) && !p.unhappy && !p.promise){
        p.unhappy=1; p.uWhy="이적 루머";
        addMood(`📰 ${p.name}이(가) ${to?to.short:"타 구단"} 이적설에 마음이 흔들리고 있습니다. (스태프 회의에서 처리)`);
      }
    } else if(r.kind==="loanOut"){
      /* 못 뛰던 선수에게 임대설은 나쁜 소식이 아니다 — 오히려 기대한다.
         다만 본인이 여기서 증명하고 싶어 하던 선수라면 서운해한다. */
      const to=G.teams[r.toId];
      const share=squadRole(p, ut);
      if(share<0.2){
        p.morale=Math.round(clamp(p.morale+2.6*w,25,99)*100)/100;
        if(Math.random()<0.28*w) addMood(`📰 ${p.name}: "${to?to.short:"그 팀"}에서 뛸 수 있다면... 진지하게 생각해 보고 싶습니다."`);
      } else {
        p.morale=Math.round(clamp(p.morale-2.0*w,25,99)*100)/100;
        affAdd(p, -2.2*w, "임대설");
        if(Math.random()<0.14*w && !p.unhappy && !p.promise){
          p.unhappy=1; p.uWhy="임대설에 대한 불만";
          addMood(`📰 ${p.name}이(가) 임대설에 표정이 굳었습니다 — "저는 여기서 뛰고 싶습니다." (스태프 회의에서 처리)`);
        }
      }
    } else if(r.kind==="exit" || r.kind==="abroad"){
      p.morale=Math.round(clamp(p.morale-2.2*w,25,99)*100)/100;
      affAdd(p, -1.8*w, "이적설");
      if(Math.random()<0.18*w && !p.unhappy && !p.promise){
        p.unhappy=1; p.uWhy = r.kind==="abroad" ? "해외 진출 희망" : "이적 요청";
        addMood(`📰 ${p.name} 관련 이적설이 커지고 있습니다. (스태프 회의에서 처리)`);
      }
    } else if(r.kind==="loanBuy"){
      /* 완전 영입설 — 임대생은 남고 싶어 하고, 원소속은 견제한다 */
      p.morale=Math.round(clamp(p.morale+2.2*w,25,99)*100)/100;
      affAdd(p, +2.0*w, "완전 영입설");
      if(Math.random()<0.22*w) addMood(`📰 임대생 ${p.name}: "여기서 계속 뛰고 싶습니다. 결정은 구단끼리 하시겠지만요."`);
    } else if(r.kind==="renew"){
      if(p.wage < wageExpect(p.ovr,p.frn,ut.div)*0.8 && Math.random()<0.22*w && !p.unhappy){
        p.unhappy=1; p.uWhy="연봉";
        addMood(`📰 ${p.name} 재계약 보도 이후 연봉 이야기가 나오고 있습니다.`);
      }
    }
  }
}
/* ── 루머 탭 ─────────────────────────────────────────────── */
function rumorCard(r){
  const tr=rumorTrust(r);
  const ut=userTeam();
  const mine = r.fromId===ut.id || r.toId===ut.id;
  const K=RUMOR_KIND[r.kind]||{n:"루머", ic:"📰"};
  const p = r.pid ? findAnyPlayer(r.pid) : null;
  return `<div class="rumItem${mine?" mine":""}">
    <div class="rumTop">
      <span class="rumKind">${K.ic} ${K.n}</span>
      ${mine?'<span class="rumMine">우리 구단</span>':""}
      <span class="rumDate">${feedDate(r)}</span>
    </div>
    <div class="rumTxt">${r.txt}</div>
    <div class="rumBot">
      <span class="rumRep">${r.ric} ${r.rep} <span class="small">${r.ro}</span></span>
      <span class="rumTrust" style="color:${tr.c}">● ${tr.t}</span>
      ${p&&mine?`<button class="mini" style="padding:2px 8px;font-size:11px" onclick="openPlayerMenu(event,${p.id})">${p.name} 확인</button>`:""}
    </div>
  </div>`;
}
function rumorTab(){
  const L=rumorList();
  const ut=userTeam();
  const mine=L.filter(r=>r.fromId===ut.id||r.toId===ut.id);
  return `<div class="card"><h3>📰 이적 루머 <span class="small">— 기자마다 신뢰도가 다릅니다. 유력 보도는 실제로 움직이고, 지라시는 그냥 지나갑니다.</span></h3>
    <div class="rumRep2">
      ${reporters().map(x=>`<span class="rumRepChip"><b>${x.ic} ${x.n}</b> <span class="small">${x.o} · 신뢰도 ${x.rel}</span></span>`).join("")}
    </div>
    ${mine.length?`<h4 style="margin:10px 0 4px">🔴 우리 구단 관련 (${mine.length})</h4>${mine.map(rumorCard).join("")}`:""}
    <h4 style="margin:12px 0 4px">📋 시장 전체</h4>
    ${L.length?L.map(rumorCard).join(""):'<p class="small">아직 도는 이야기가 없습니다. 이적시장이 열리면 시끄러워집니다.</p>'}
  </div>`;
}
/* 계약 만료가 가까운 우리 선수 — 잔여 1년 이하, 쓸 만한 선수부터 */
function expiringSoon(){
  const t=userTeam(); if(!t) return [];
  return t.players.filter(p=>!p.loan && (p.ct||1)<=CT_WARN)
    .sort((a,b)=>(a.ct||1)-(b.ct||1) || b.ovr-a.ovr);
}
/* 우리 소유인데 남의 팀에서 뛰고 있는 선수 */
/* 🛟 임대 유령 복제 정리 — 이미 꼬여 버린 세이브를 되돌린다.
   ⚠ 제보 — 「프로필에는 안양 소속·임대 아님, 임대 센터에는 부천으로 내보낸 선수」.
      같은 선수가 두 명단에 있고 한쪽만 임대 표식을 들고 있으면, 표식이 있는 쪽이 진짜다
      (그 선수는 지금 그 팀에서 뛰고 있다). 원소속에 앉아 있는 표식 없는 사본을 지운다.
      동명이인을 잘못 지우지 않도록, 「그 임대의 원소속 구단에 있는 사본」만 건드린다. */
function loanGhostFix(){
  if(!G || !G.teams) return 0;
  const byKey={};
  for(const id in G.teams)
    for(const p of (G.teams[id].players||[])){
      const k=`${p.name}|${p.by}`;
      (byKey[k]=byKey[k]||[]).push({p, tid:id});
    }
  let n=0;
  for(const k in byKey){
    const arr=byKey[k];
    if(arr.length<2) continue;
    const real=arr.find(x=>x.p && x.p.loan && x.p.loan.own);
    if(!real) continue;
    for(const x of arr){
      if(x===real || !x.p || x.p.loan) continue;
      if(real.p.loan.own!==x.tid) continue;          // 원소속에 앉아 있는 사본만
      const t=G.teams[x.tid];
      t.players=(t.players||[]).filter(q=>q!==x.p);
      /* 선발·벤치·역할에서도 걷어낸다 */
      try{
        if(Array.isArray(G.userXI)) G.userXI=G.userXI.filter(id2=>id2!==x.p.id);
        const T=t.tactic;
        if(T){ if(Array.isArray(T.benchSel)) T.benchSel=T.benchSel.filter(i=>i!==x.p.id);
               if(Array.isArray(T.benchExcl)) T.benchExcl=T.benchExcl.filter(i=>i!==x.p.id);
               for(const kk of ["role","roleBy","slot","zone"]) if(T[kk]) delete T[kk][x.p.id]; }
      }catch(e){}
      n++;
    }
  }
  return n;
}
/* loanOutLog 를 「번호 기록」 형태로 정리 — 선수 객체가 통째로 들어가 있으면 사본이 계속 늘어난다 */
function loanLogSlim(){
  if(!G || !G.teams) return 0;
  let n=0;
  for(const id in G.teams){
    const t=G.teams[id];
    if(!Array.isArray(t.loanOutLog)) continue;
    t.loanOutLog=t.loanOutLog.filter(Boolean).map(q=>{
      if(q._ref) return q;
      n++;
      return {id:q.id, name:q.name, by:q.by, _ref:1};
    });
  }
  return n;
}
function loanedOut(t){
  /* 🩹 ⚠ 제보 원문 — 「임대선수 미복귀가 계속 있습니다. 조기 복귀 눌러도 임대 중인 선수가
     아닙니다 라는 문구만 출력됩니다」.
     원인 중 하나가 여기였다 — 화면 목록(loanedOut)은 「원소속만」 보고, 조기 복귀 조회
     (loanedOutOf)는 「원소속 + 간 곳(L.to)」을 봤다. 표식의 간 곳이 실제 소속과 어긋난
     선수는 목록에는 뜨는데 조회에서는 사라져, 버튼을 눌러도 아무 일도 일어나지 않았다.
     ─ 두 함수가 같은 기준을 쓰게 하고, ①이미 우리 팀에 있는 표식 잔재와 ②입대(병역)로
       김천에 가 있는 선수는 「임대 내보낸 선수」에서 뺀다(입대는 따로 표시된다). */
  const out=[];
  for(const id in G.teams){
    if(id===t.id) continue;
    for(const p of (G.teams[id].players||[]))
      if(p && p.loan && p.loan.own===t.id && !(p.army && p.army.own===t.id))
        out.push({p, c:G.teams[id]});
  }
  return out.sort((a,b)=>b.p.ovr-a.p.ovr);
}
/* 🎖️ 김천 상무 복무 — 형태는 다르지만 「내보낸 선수」다. 임대 명단에 함께 보여 준다.
   ⚠ 제보 — 「김천에 보낸 선수도 임대한 셈이니 임대 센터 명단에 넣어 달라」. */
function armySentOut(t){
  if(!t) return [];
  const gc=Object.values(G.teams).find(x=>isArmyTeam(x));
  if(!gc) return [];
  return (gc.players||[]).filter(p=>p && p.army && p.army.own===t.id)
    .map(p=>({p, c:gc, army:1}))
    .sort((a,b)=>(b.p.ovr||0)-(a.p.ovr||0));
}
/* 전역까지 남은 기간 — 화면에 쓰는 문구 */
function armyBackTxt(p){
  try{
    const left=armyDaysLeft(p);
    const out=(p.army&&p.army.out)||"";
    if(left==null) return "전역일 미정";
    return `전역 ${out} · <b style="color:var(--gold)">D-${Math.max(0,left)}</b>`;
  }catch(e){ return "복무 중"; }
}
/* 임대를 보낼 만한 선수 — 어리고, 출전이 적고, 주전이 아닌 순서 */
/* 🔁 임대를 「보낼 만한」 선수인가 — 선발에서 밀려 있고, 아직 크는 나이인가.
   ⚠ 제보 — 「유스에서 갓 올라온 선수가 '주전급'으로 뜨고 임대 보내기 버튼이 꺼져 보인다」.
      예전엔 추천 목록을 능력 순으로 자른 뒤 상위 12명만 '추천'으로 칠했다. 그래서 능력치가
      낮은 유스 졸업생은 12명 밖으로 밀려 '주전급'이라는 엉뚱한 딱지가 붙었다.
      이제 컷 없이 선수 한 명 한 명의 사정으로 판정한다. */
function loanWorth(t, p, xiSet){
  if(!p || p.loan) return false;
  const age=G.season-(p.by||G.season-20);
  if(age<LOAN_MIN_AGE || age>LOAN_MAX_AGE) return false;   // 성장기 밖이면 임대의 의미가 옅다
  const xi=xiSet || new Set((bestXI(t)||[]).map(q=>q.id));
  if(xi.has(p.id)) return false;                           // 지금 선발이면 굳이 보낼 이유가 없다
  return true;
}
function loanCandidates(t){
  const xi=new Set((bestXI(t)||[]).map(p=>p.id));
  return t.players.filter(p=>loanWorth(t, p, xi))
    /* 어리고 못 뛰는 선수를 위로 — 유스 졸업생이 능력치 때문에 뒤로 밀리지 않게 나이를 먼저 본다 */
    .sort((a,b)=>(a.apps||0)-(b.apps||0)
              || (G.season-a.by)-(G.season-b.by)
              || b.ovr-a.ovr);
}
/* ═══════════════════════════════════════════════════════════════
   선수 검색 — 이름·초성·팀명·포지션으로 리그 전체(K1+K2+FA+임대)를 훑는다.
   ⚠ 입력할 때마다 show("transfer") 로 화면을 통째로 다시 그리면 입력창이 새 요소로 교체되어
     한 글자 칠 때마다 포커스가 빠지고 모바일 키보드가 닫힌다. 그래서 결과 영역(#psList)만 갈아 끼운다.
═══════════════════════════════════════════════════════════════ */
const PS_CHO="ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
function psCho(str){
  let o="";
  for(const ch of String(str)){ const c=ch.charCodeAt(0);
    o += (c>=0xAC00 && c<=0xD7A3) ? PS_CHO[Math.floor((c-0xAC00)/588)] : ch; }
  return o;
}
function psNorm(s){ return String(s||"").toLowerCase().replace(/\s+/g,""); }
/* 검색 대상 — 타 구단 선수 + FA + 우리 선수(조회용). 임대 중인 선수는 실제 소속 구단으로 잡힌다. */
/* ═══════════════════════════════════════════════════════════════
   ⭐ 관심 선수 목록 (FM 의 숏리스트)
   제보 — 「영입을 시도했다가 불발되면 그 선수를 나중에 다시 찾으려고
   이적시장을 처음부터 뒤져야 한다」. 눈여겨본 선수와 협상했던 선수를
   한곳에 모아 두고, 거기서 바로 다시 접촉할 수 있게 한다.
   · 선수 id 만 저장한다 — 선수는 팀을 옮기고 FA 가 되기도 하므로
     현재 상태(소속·몸값·영입 가능 여부)는 볼 때마다 다시 읽는다.
   ══════════════════════════════════════════════════════════════ */
const SL_WHY={ eye:{ic:"👀", n:"눈여겨봄"}, try:{ic:"🤝", n:"영입 시도"},
               fail:{ic:"🚪", n:"협상 결렬"}, bid:{ic:"💸", n:"입찰 거절"} };
function slList(){ if(!Array.isArray(G.shortlist)) G.shortlist=[]; return G.shortlist; }
function slFind(pid){ return slList().find(x=>x.pid===pid); }
function slHas(pid){
  /* 우리 선수가 된 선수는 목록에 있어도 「담긴 것」으로 보지 않는다 — 역할을 다했다 */
  try{ if(userTeam().players.some(q=>q.id===pid)) return false; }catch(e){}
  return !!slFind(pid);
}
function slAdd(pid, why, silent){
  const L=slList();
  const p=findAnyPlayer(pid); if(!p) return false;
  const cur=slFind(pid);
  if(cur){
    /* 이미 있는 선수라도 사유는 갱신한다 — 「눈여겨봄」이 「협상 결렬」로 바뀌는 게 정보다 */
    const rank={eye:0, try:1, bid:2, fail:3};
    if((rank[why]||0)>=(rank[cur.why]||0)){ cur.why=why||cur.why; cur.at=G.day||0; cur.s=G.season; }
    return false;
  }
  L.push({pid, why:why||"eye", at:G.day||0, s:G.season, note:""});
  if(!silent) flash(`⭐ ${p.name} 선수를 관심 목록에 담았습니다.`, "good");
  return true;
}
function slDel(pid){
  const L=slList(); const i=L.findIndex(x=>x.pid===pid);
  if(i>=0) L.splice(i,1);
}
function slToggle(pid, rerender){
  if(slHas(pid)){ const p=findAnyPlayer(pid); slDel(pid); flash(`☆ ${p?p.name:"선수"}을(를) 관심 목록에서 뺐습니다.`); }
  else slAdd(pid, "eye");
  saveGame();
  if(rerender==="ps"){ if(typeof psRefresh==="function") psRefresh(); }
  else show(VIEW);
}
function slClear(){
  showConfirm("⭐ 관심 목록을 모두 비울까요?", ()=>{ G.shortlist=[]; saveGame(); show("transfer"); },
    {okLabel:"비우기", cancelLabel:"취소"});
}
/* 목록에 남아 있지만 이제 존재하지 않는 선수(은퇴·데이터 소멸)를 걷어낸다 */
function slSweep(){
  const L=slList();
  for(let i=L.length-1;i>=0;i--){
    if(!findAnyPlayer(L[i].pid)) L.splice(i,1);
    else if(userTeam().players.some(q=>q.id===L[i].pid)) L.splice(i,1);   // 우리 선수가 됐으면 역할을 다했다
    else {
      /* 🎖️ 입대해서 상무로 간 선수는 관심 목록에서 뺀다 — 데려올 방법이 없다 */
      let inArmy=false;
      try{ for(const id in G.teams){ const c=G.teams[id];
        if(isArmyTeam(c) && c.players.some(q=>q.id===L[i].pid)){ inArmy=true; break; } } }catch(e){}
      if(inArmy) L.splice(i,1);
    }
  }
  return L;
}
/* 목록 줄에 쓸 별 버튼 */
function slStarBtn(pid, ctx){
  const on=slHas(pid);
  return `<button class="mini slStar ${on?"on":""}" onclick="event.stopPropagation();slToggle(${pid},'${ctx||""}')"
    >${on?"⭐":"☆"}</button>`;
}
function psPool(){
  const out=[];
  for(const id in G.teams){ const ot=G.teams[id];
    /* 🎖️ ⚠ 제보 — 「김천 상무 선수에게 접촉해 영입할 수 있다」.
       상무 선수는 전원 원소속 구단에서 파견된 현역 군인이라 이적료를 주고 데려올 수 없다.
       그런데 검색 결과에는 그대로 떠서, 눌러 보고 협상까지 들어가야 막히는 걸 알 수 있었다.
       ─ 아예 시장에서 보이지 않게 한다. 명단은 상무 구단 스쿼드에서 그대로 볼 수 있다. */
    if(isArmyTeam(ot)) continue;
    for(const q of ot.players) out.push({p:q, ot, fa:false}); }
  for(const q of (G.freeAgents||[])) out.push({p:q, ot:null, fa:true});
  return out;
}
/* 관련도 점수 — 0이면 안 걸린 것. 이름 > 초성 > 팀명 > 포지션 순. */
function psScore(e, q){
  const nm=psNorm(e.p.name), cho=psNorm(psCho(e.p.name));
  const tn=psNorm(e.ot?(e.ot.name+e.ot.short):"자유계약FA");
  if(nm===q) return 1000;
  if(nm.indexOf(q)===0) return 700;
  if(nm.indexOf(q)>0) return 450;
  if(/^[ㄱ-ㅎ]+$/.test(q)){
    if(cho.indexOf(q)===0) return 380;
    if(cho.indexOf(q)>0) return 240;
  }
  if(tn.indexOf(q)>=0) return 160;
  if(psNorm(e.p.pos)===q) return 120;
  return 0;
}
function psFiltered(){
  const t=userTeam(), q=psNorm(tfFilter.q);
  let list=psPool();
  if(tfFilter.pos) list=list.filter(e=>e.p.pos===tfFilter.pos);
  if(tfFilter.pos && tfFilter.sub){
    const want=psSubSlots(tfFilter.pos, tfFilter.sub);
    if(want) list=list.filter(e=>want.indexOf(prefSlotOf(e.p))>=0);
  }
  if(tfFilter.div) list=list.filter(e=>e.ot && e.ot.div===tfFilter.div);
  if(tfFilter.mine) list=list.filter(e=>!e.ot || e.ot.id!==t.id);
  if(tfFilter.afford) list=list.filter(e=>e.fa || marketValue(e.p)<=t.budget);
  if(tfFilter.ageMax) list=list.filter(e=>(G.season-e.p.by)<=tfFilter.ageMax);
  if(tfFilter.ageMin) list=list.filter(e=>(G.season-e.p.by)>=tfFilter.ageMin);
  if(attrQActive().length) list=list.filter(e=>attrQPass(e.p));
  if(famQActive().length) list=list.filter(e=>famQPass(e.p));      // 🧭 자리 능숙도 조건
  if(q){
    list=list.map(e=>({...e, sc:psScore(e,q)})).filter(e=>e.sc>0)
             .sort((a,b)=>b.sc-a.sc || b.p.ovr-a.p.ovr);
  } else {
    list=list.sort((a,b)=>sortLv(b.p)-sortLv(a.p));
  }
  /* 검색어가 없을 때만 감독이 고른 정렬을 적용한다 — 검색 중에는 "얼마나 맞는가"가 먼저다 */
  if(!q) list=cardApply("ps", list,
    {ovr:e=>sortLv(e.p), age:e=>G.season-e.p.by, mv:e=>marketValue(e.p), name:e=>e.p.name});
  /* 🧭 자리 능숙도 조건을 걸었으면 「둘 다 잘하는 순서」로 — 조건에 걸린 자리 중
     가장 낮은 값이 높은 선수가 진짜 멀티 자원이다. (감독이 다른 정렬을 고르면 그쪽을 따른다) */
  if(!q && famQActive().length && tfFilter.famAll && cardSort("ps").k==="ovr")
    list=list.slice().sort((a,b)=>famQWorst(b.p)-famQWorst(a.p) || sortLv(b.p)-sortLv(a.p));
  return list;
}
/* 검색어와 겹치는 부분에 색을 입힌다 — 왜 이 선수가 걸렸는지 바로 보이게 */
function psMark(name, q){
  if(!q) return name;
  const i=psNorm(name).indexOf(q);
  if(i<0) return name;
  return name.slice(0,i)+'<span class="psHit">'+name.slice(i,i+q.length)+'</span>'+name.slice(i+q.length);
}
function psRow(e, wi, t, q){
  const p=e.p, ot=e.ot;
  const mine = ot && ot.id===t.id;
  const age=G.season-p.by;
  const blocked=negoBlockDaysLeft(p.id);
  let act="";
  if(mine) act=`<span class="tag" style="background:#3fb95033;color:#3fb950">우리 선수</span>`;
  else if(!wi.open) act=`<span class="tag inj">시장 닫힘</span>`;
  else if(blocked>0) act=`<span class="tag inj" title="협상이 결렬된 선수입니다">재협상 ${blocked}일 뒤</span>`;
  else if(e.fa) act=`<button class="mini" onclick="startFANego(${p.id})">🤝 FA 협상</button>`;
  /* 상무 선수는 군 복무 중이라 어떤 구단도 데려올 수 없다. 전역해야 원소속으로 돌아간다. */
  else if(p.army && p.army.out){
    const d=armyDaysLeft(p), own=p.army.own&&G.teams[p.army.own];
    act=`<span class="tag inj" title="${p.army.out} 전역 · 전역 후 ${own?own.short:"무소속(FA)"}(으)로 복귀">🎖️ 영입 불가 (전역 D-${d>0?d:0})</span>`;
  }
  else if(p.loan) act=`<span class="tag inj">임대 중</span>`;
  /* 🔁 임대 문의는 이적시장이 아니라 임대 센터에서만 한다 — 진입점을 한 곳으로 모은다 */
  else act=`<button class="mini" onclick="startNego(${p.id},'${ot.id}')">🤝 영입 시도</button>`;
  const val = e.fa ? `요구연봉 약 ${Math.round(faWageAsk(p)*10)/10}억`
                   : `<b class="money">${marketValue(p)}억</b> · 연봉 ${p.wage}억`;
  return `<div class="psRow">
    <div class="psMain">
      <div class="psName clickable" onclick="openPlayerMenu(event,${p.id})"><span class="${p.frn?"frnN":""}">${psMark(p.name,q)}</span>${p.frn?' <span class="small">🌐</span>':""}${pTags(p)}</div>
      <div class="psSub"><span class="pos-${p.pos}">${p.pos}</span> · ${age}세 · ${ot?ot.short+(ot.div===2?" (K2)":""):"🆓 FA"}${p.frn?' · <span class="frnN">외국인</span>':""}</div>
      ${psPosBadge(p)}${psFamBadge(p)}
    </div>
    <div class="psVal">${val}</div>
    <div class="psAct">${mine?"":slStarBtn(p.id,"ps")}${act}</div>
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════
   세부 능력치 조건 검색 — "가속력 15 이상 & 드리블 15 이상 & 몸싸움 15 이상" 같은 조회.
   화면에 보이는 1~20 눈금 그대로 입력받고, 내부 원시값은 attr20()으로 환산해 비교한다.
   스쿼드와 이적시장이 같은 상태(ATTRQ)를 쓴다 — 한쪽에서 조건을 세우고 다른 쪽으로 넘어가도 유지된다.
═══════════════════════════════════════════════════════════════ */
const ATTRQ_OPS=[[">=","이상"],["<=","이하"],[">","초과"],["<","미만"],["==","같음"]];
let ATTRQ=[{k:"",op:">=",v:15},{k:"",op:">=",v:15},{k:"",op:">=",v:15}];
let ATTRQ_OPEN=false;
/* 선택 목록 — 필드 플레이어 능력치 + 골키퍼 능력치를 그룹으로 나눠서 보여준다 */
function attrQGroups(){
  return [["기술",TECH_ATTRS],["정신",MENT_ATTRS],["신체",PHYS_ATTRS],["골키퍼",GKT_ATTRS]];
}
/* 그 선수의 해당 능력치를 1~20 눈금으로. 없는 능력치(필드 선수의 GK 스탯 등)는 null */
function attrQVal(p, k){
  if(!p||!k) return null;
  const g=p.gkA||{}, a=p.attr||{};
  const raw = (typeof g[k]==="number") ? g[k] : (typeof a[k]==="number" ? a[k] : null);
  return raw==null ? null : attr20(raw);
}
function attrQActive(){ return ATTRQ.filter(q=>q && q.k); }
function attrQPass(p){
  for(const q of ATTRQ){
    if(!q || !q.k) continue;
    const v=attrQVal(p, q.k);
    if(v==null) return false;                  // 그 능력치가 없는 선수는 조건에서 빠진다
    const n=Number(q.v);
    if(!isFinite(n)) continue;
    if(q.op===">=" && !(v>=n)) return false;
    if(q.op==="<=" && !(v<=n)) return false;
    if(q.op===">"  && !(v> n)) return false;
    if(q.op==="<"  && !(v< n)) return false;
    if(q.op==="==" && !(v===n)) return false;
  }
  return true;
}
function attrQSet(i, field, val){
  if(!ATTRQ[i]) ATTRQ[i]={k:"",op:">=",v:15};
  if(field==="v"){ const n=parseInt(val,10); ATTRQ[i].v = isFinite(n)?clamp(n,1,20):15; }
  else ATTRQ[i][field]=val;
  attrQApply();
}
function attrQClear(){
  ATTRQ=[{k:"",op:">=",v:15},{k:"",op:">=",v:15},{k:"",op:">=",v:15}];
  attrQApply();
}
function attrQToggle(){ ATTRQ_OPEN=!ATTRQ_OPEN; attrQApply(); }
/* 어느 화면에서 쓰고 있는지에 따라 다시 그린다 */
function attrQApply(full){
  if(typeof VIEW==="undefined") return;
  if(VIEW==="transfer"){
    if(full) show("transfer");
    else { tfFilter.page=1; if(typeof psRefresh==="function") psRefresh(); }
  }
  else if(VIEW==="squad") show("squad");
}
/* 조건 입력 UI — 스쿼드와 이적시장에서 같은 모양으로 쓴다 */
function attrQBox(){
  const on=attrQActive().length;
  const head=`<button class="psChip ${on?"on":""}" onclick="attrQToggle()">⚙️ 세부 능력치 조건${on?` <span class="psSubN">${on}</span>`:""} ${ATTRQ_OPEN?"▲":"▼"}</button>`;
  if(!ATTRQ_OPEN){
    const sum = on ? `<span class="small" style="margin-left:8px;color:var(--gold)">${attrQActive().map(q=>`${ATTR_LABEL_FM[q.k]||q.k} ${q.v} ${(ATTRQ_OPS.find(o=>o[0]===q.op)||[])[1]}`).join(" · ")}</span>` : "";
    return `<div class="aqWrap">${head}${sum}</div>`;
  }
  const opts=(sel)=>attrQGroups().map(([g,ks])=>
    `<optgroup label="${g}">${ks.map(k=>`<option value="${k}" ${sel===k?"selected":""}>${ATTR_LABEL_FM[k]||k}</option>`).join("")}</optgroup>`).join("");
  const rows=ATTRQ.map((q,i)=>`<div class="aqRow">
    <span class="aqN">${i+1}</span>
    <select class="aqSel" onchange="attrQSet(${i},'k',this.value)">
      <option value="">— 능력치 선택 —</option>${opts(q.k)}</select>
    <input class="aqNum" type="number" min="1" max="20" step="1" value="${q.v}" onchange="attrQSet(${i},'v',this.value)">
    <select class="aqOp" onchange="attrQSet(${i},'op',this.value)">
      ${ATTRQ_OPS.map(o=>`<option value="${o[0]}" ${q.op===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select>
  </div>`).join("");
  return `<div class="aqWrap">${head}
    <div class="aqBody">
      <p class="small" style="margin-bottom:5px;font-size:11px;opacity:.8">1~20 눈금 · 세 조건 모두 만족(AND)</p>
      ${rows}
      <button class="psChip sm" onclick="attrQClear()">↺ 지우기</button>
    </div></div>`;
}
/* 🧭 자리 능숙도 조건 상자 — 자리를 여러 개 체크하고 「몇 이상」인지 정한다 */
function famQBox(){
  const ks=famQActive();
  const on=ks.length;
  const need=clamp(tfFilter.famMin|0,0,100);
  const head=`<button class="psChip ${on?"on":""}" onclick="famQToggleBox()">🧭 자리 능숙도${on?` <span class="psSubN">${on}</span>`:""} ${FAMQ_OPEN?"▲":"▼"}</button>`;
  if(!FAMQ_OPEN){
    const sum = on
      ? `<span class="small" style="margin-left:8px;color:var(--gold)">${ks.map(k=>FAM_LABEL[k]||k).join(tfFilter.famAll?" + ":" 또는 ")} ${need} 이상${tfFilter.famAll?" (모두)":""}</span>`
      : `<span class="small" style="margin-left:8px;opacity:.7">여러 자리를 함께 체크해 「둘 다 되는 선수」를 찾습니다</span>`;
    return `<div class="aqWrap">${head}${sum}</div>`;
  }
  /* 지금 걸린 나머지 조건까지 반영한 실제 결과 수 — 눌러 보면 숫자가 맞아야 한다 */
  const keep=tfFilter.fam; tfFilter.fam=[];
  let base=[]; try{ base=psFiltered(); }finally{ tfFilter.fam=keep; }
  const cnt={};
  for(const k of FAM_POS){ let n=0; for(const e of base) if(famVal(e.p,k)>=need) n++; cnt[k]=n; }
  const chip=(k)=>{
    const sel=ks.indexOf(k)>=0;
    return `<button class="psChip sm ${sel?"on":""}" onclick="famQToggle('${k}')"
      title="${FAM_LABEL[k]||k} 능숙도 ${need} 이상">${FAM_LABEL[k]||k}<span class="psSubN">${cnt[k]||0}</span></button>`;
  };
  const band=(ttl, arr)=>`<div class="famRow"><span class="psSubK">${ttl}</span>${arr.map(chip).join("")}</div>`;
  const presetOn=(hit)=> ks.length===hit[1].length && hit[1].every(k=>ks.indexOf(k)>=0);
  return `<div class="aqWrap">${head}
    <div class="aqBody">
      <div class="famRow"><span class="psSubK">빠른 조합</span>
        ${FAM_QUICK.map(h=>`<button class="psChip sm ${presetOn(h)?"on":""}" onclick="famQPreset('${h[0]}')" title="${h[2]}">${h[2]}</button>`).join("")}
      </div>
      ${band("골키퍼",["GK"])}
      ${band("수비",["SW","DC","DL","DR","WBL","WBR"])}
      ${band("중원",["DM","MC","ML","MR","AMC","AML","AMR"])}
      ${band("공격",["LW","RW","ST"])}
      <div class="famRow"><span class="psSubK">기준</span>
        ${FAM_MIN_STEPS.map(v=>`<button class="psChip sm ${need===v?"on":""}" onclick="famQMin(${v})">${v} 이상</button>`).join("")}
      </div>
      <div class="famRow"><span class="psSubK">방식</span>
        <button class="psChip sm ${tfFilter.famAll?"on":""}" onclick="famQMode(true)" title="체크한 자리를 전부 소화하는 선수만">모두 충족</button>
        <button class="psChip sm ${tfFilter.famAll?"":"on"}" onclick="famQMode(false)" title="체크한 자리 중 하나라도 소화하면">하나라도</button>
        <button class="psChip sm" onclick="famQClear()">↺ 지우기</button>
      </div>
      <p class="small" style="margin-top:5px;font-size:11px;opacity:.85;line-height:1.6">
        예) <b>중앙 수비</b> + <b>수비형 미드필더</b> 를 체크하고 기준을 <b>80 이상</b> · <b>모두 충족</b> 으로 두면
        「센터백도 되고 수미도 되는」 선수만 나옵니다. 100/100 이 아니어도 됩니다.<br>
        조건을 걸면 목록이 <b>둘 다 잘하는 순서</b>(둘 중 낮은 값이 높은 순)로 정렬되고, 각 선수의 해당 자리 능숙도가 함께 표시됩니다.</p>
    </div></div>`;
}
/* ── 대표 포지션 배지 ────────────────────────────────────────────
   검색 목록의 별점은 "이 선수가 자기 자리에서 리그 전체와 비교해 어느 정도인가"를 보여준다.
   ⚠ 예전에는 우리 포메이션의 빈 자리를 기준으로 매겼는데, 포지션으로 검색해 놓고 보면
     센터백이 "우리 LAM" 처럼 엉뚱한 자리로 환산돼 오히려 헷갈렸다.
     그래서 우리 사정은 빼고, 선수 본인의 대표 포지션과 그 자리 별점만 적는다. */
/* 🧭 조건에 걸린 자리들의 능숙도 — 왜 이 선수가 나왔는지 한 줄로 */
function psFamBadge(p){
  const ks=famQActive(); if(!ks.length || !p) return "";
  const need=clamp(tfFilter.famMin|0,0,100);
  const cell=(k)=>{ const v=famVal(p,k); const c=famColor(v)||"var(--sub)";
    return `<span class="famHit"><span class="famHitK">${FAM_LABEL[k]||k}</span>
      <b style="color:${c}">${v}</b></span>`; };
  const worst=famQWorst(p);
  return `<div class="psFit" style="border-color:#8b6914">
    <span class="psFitK" style="color:var(--gold)">🧭 ${tfFilter.famAll?"둘 다":"소화"}</span>
    ${ks.map(cell).join("")}
    <span style="opacity:.7">${tfFilter.famAll?`· 최저 ${worst}`:""} (기준 ${need})</span></div>`;
}
function psPosBadge(p){
  if(!p) return "";
  const sl=prefSlotOf(p);
  const gr=prefStarGrade(p);
  const fam=getPosFam(p, sl);
  const tip=`${SLOT_LABEL[sl]||sl} 기준 ${starGradeText(gr)} — K리그 전체(1부+2부) 선수와 비교한 값입니다.`;
  return `<div class="psFit" title="${tip}">
    <span class="psFitK">${SLOT_LABEL[sl]||sl}</span> ${renderStars(gr, tip, p)}
    <span style="opacity:.65">리그 전체 기준${fam<100?` · 능숙도 ${fam}`:""}</span></div>`;
}
const PS_MAX=50;
/* 페이지 번호 줄 — 페이지가 많아도 한 줄에 담기게 현재 페이지 주변만 보여준다 */
function psPager(total, page, fn, per){
  const last=Math.max(1, Math.ceil(total/(per||PS_PER)));
  if(last<=1) return "";
  const go=fn||"psGo";
  const btn=(n,label,on,dis)=>`<button class="psPg ${on?"on":""}" ${dis?"disabled":""} onclick="${go}(${n})">${label||n}</button>`;
  let from=Math.max(1, page-2), to=Math.min(last, from+4);
  from=Math.max(1, to-4);
  const out=[];
  out.push(btn(1,"«",false,page===1));
  out.push(btn(page-1,"‹",false,page===1));
  if(from>1) out.push(`<span class="psPgGap">…</span>`);
  for(let n=from;n<=to;n++) out.push(btn(n,null,n===page));
  if(to<last) out.push(`<span class="psPgGap">…</span>`);
  out.push(btn(page+1,"›",false,page===last));
  out.push(btn(last,"»",false,page===last));
  return `<div class="psPager">${out.join("")}<span class="psPgInfo">${page} / ${last} 쪽</span></div>`;
}
function psResults(){
  const t=userTeam(), wi=windowInfo(), q=psNorm(tfFilter.q);
  const list=psFiltered();
  if(!list.length){
    const what=tfFilter.q?`"${tfFilter.q}" — `:"";
    return `<p class="small" style="padding:14px 4px">🔍 ${what}조건에 맞는 선수가 없습니다. 이름 일부나 초성(예: ㅁㅋ)으로도 찾을 수 있습니다.</p>`;
  }
  const last=Math.max(1, Math.ceil(list.length/PS_PER));
  const page=clamp(tfFilter.page||1, 1, last);
  tfFilter.page=page;
  const from=(page-1)*PS_PER;
  const shown=list.slice(from, from+PS_PER);
  const subN=(tfFilter.pos&&tfFilter.sub) ? ((PS_SUB[tfFilter.pos]||[]).find(r=>r[0]===tfFilter.sub)||[])[1] : "";
  const head=`${q?`"${tfFilter.q}" 검색 결과 `:""}${subN?subN+" ":""}<b>${list.length}명</b>`
    + ` <span style="opacity:.7">· ${from+1}~${Math.min(from+PS_PER, list.length)}번째</span>`
    + (q?` <span class="small" style="opacity:.7">(검색 적합도 순)</span>`:cardSortBox("ps"));
  return `<div class="psCount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${head}</div>`
    + shown.map(e=>psRow(e, wi, t, q)).join("")
    + psPager(list.length, page);
}
/* 결과 영역만 갈아 끼운다 — 입력창은 그대로 두어 포커스와 모바일 키보드를 지킨다.
   세부 포지션 줄은 큰 포지션에 따라 내용이 바뀌므로 함께 다시 그린다. */
function psRefresh(){
  const el=document.getElementById("psList");
  if(el) el.innerHTML=psResults();
  const sub=document.getElementById("psSubRow");
  if(sub) sub.innerHTML=psSubChips();
  /* 조건 칩의 개수·요약도 함께 갱신한다 — 이게 없으면 조건을 바꿔도 "⚙️ 세부 능력치 조건 [2]" 가 그대로였다 */
  const fq=document.getElementById("fqHost");
  if(fq) fq.innerHTML=famQBox();
  const aq=document.getElementById("aqHost");
  if(aq) aq.innerHTML=attrQBox();
  const c=document.getElementById("psClrBtn");
  if(c) c.style.display = tfFilter.q ? "" : "none";
}
function psInput(v){ tfFilter.q=v; tfFilter.page=1; psRefresh(); }
/* 페이지 이동 — 목록 맨 위로 올려 준다. 열 명씩이라 스크롤이 남아 있으면 어디로 갔는지 헷갈린다. */
function psGo(n){
  tfFilter.page=Math.max(1, n|0);
  psRefresh();
  const el=document.getElementById("psList");
  if(el && el.scrollIntoView){
    el.scrollIntoView({block:"start"});
    // 모바일은 상단 탭 바가 붙어 있어 그대로 두면 첫 줄이 그 뒤로 들어간다
    try{ if(window.innerWidth<=760) window.scrollBy(0, -96); }catch(e){}
  }
}
function psSetSub(k){
  tfFilter.sub = (tfFilter.sub===k) ? "" : k;
  tfFilter.page=1;
  psRefresh();
}
/* 큰 포지션 아래에 붙는 세부 자리 줄 */
function psSubChips(){
  const rows=PS_SUB[tfFilter.pos];
  if(!rows || rows.length<2) return "";
  /* 숫자는 "지금 걸린 나머지 조건까지 반영한" 실제 결과 수여야 한다 —
     세부만 빼고 똑같이 걸러서 센다. 그래야 칩에 33이라 써 놓고 눌렀더니 31명이 나오는 일이 없다. */
  const keep=tfFilter.sub; tfFilter.sub="";
  let base; try{ base=psFiltered(); }finally{ tfFilter.sub=keep; }
  const cnt={};
  for(const e of base){
    const sl=prefSlotOf(e.p);
    for(const r of rows) if(r[2].indexOf(sl)>=0) cnt[r[0]]=(cnt[r[0]]||0)+1;
  }
  // 아무도 없는 자리는 아예 띄우지 않는다 — 눌러도 빈 화면만 나오는 버튼은 방해가 된다
  const live=rows.filter(r=>(cnt[r[0]]||0)>0 || tfFilter.sub===r[0]);
  if(live.length<2) return "";
  return `<div class="psSubRow">
    <span class="psSubK">${{GK:"골키퍼",DF:"수비수",MF:"미드필더",FW:"공격수"}[tfFilter.pos]||tfFilter.pos} 세부</span>
    <button class="psChip sm ${tfFilter.sub?"":"on"}" onclick="psSetSub('')">전체<span class="psSubN">${base.length}</span></button>
    ${live.map(r=>`<button class="psChip sm ${tfFilter.sub===r[0]?"on":""}" onclick="psSetSub('${r[0]}')">${r[1]}<span class="psSubN">${cnt[r[0]]||0}</span></button>`).join("")}
  </div>`;
}
function psClear(){
  tfFilter.q=""; tfFilter.page=1;
  const el=document.getElementById("psQ");
  if(el){ el.value=""; el.focus(); }
  psRefresh();
}
function psToggle(k){
  tfFilter[k]=!tfFilter[k]; tfFilter.page=1;
  const b=document.getElementById("psChip_"+k);
  if(b) b.classList.toggle("on", !!tfFilter[k]);
  psRefresh();
}
function psSetPos(v){
  tfFilter.pos = (tfFilter.pos===v) ? "" : v;
  tfFilter.sub=""; tfFilter.page=1;          // 큰 포지션이 바뀌면 세부 선택은 초기화한다
  for(const k of ["","GK","DF","MF","FW"]){
    const b=document.getElementById("psPos_"+(k||"ALL"));
    if(b) b.classList.toggle("on", tfFilter.pos===k);
  }
  psRefresh();
}
function psSetDiv(v){
  tfFilter.div = (tfFilter.div===v) ? 0 : v;
  tfFilter.page=1;
  for(const k of [0,1,2]){
    const b=document.getElementById("psDiv_"+k);
    if(b) b.classList.toggle("on", tfFilter.div===k);
  }
  psRefresh();
}
function psSetAgeMax(v){ tfFilter.ageMax=(tfFilter.ageMax===v)?0:v; if(tfFilter.ageMax && tfFilter.ageMin>tfFilter.ageMax) tfFilter.ageMin=0; tfFilter.page=1; show("transfer"); }
function psSetAgeMin(v){ tfFilter.ageMin=v||0; if(tfFilter.ageMin && tfFilter.ageMax && tfFilter.ageMax<tfFilter.ageMin) tfFilter.ageMax=0; tfFilter.page=1; show("transfer"); }
function psAgeClear(){ tfFilter.ageMax=0; tfFilter.ageMin=0; tfFilter.page=1; show("transfer"); }
function psSearchBox(){
  const posBtn=(v,l)=>`<button id="psPos_${v||"ALL"}" class="psChip ${tfFilter.pos===v?"on":""}" onclick="psSetPos('${v}')">${l}</button>`;
  const divBtn=(v,l)=>`<button id="psDiv_${v}" class="psChip ${tfFilter.div===v?"on":""}" onclick="psSetDiv(${v})">${l}</button>`;
  return `<div class="psWrap">
    <div class="psBar">
      <div class="psField">
        <span class="psIcon">🔍</span>
        <input id="psQ" class="psInput" type="text" inputmode="search" enterkeyhint="search"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          placeholder="선수 이름 · 초성 · 팀 이름으로 검색"
          value="${(tfFilter.q||"").replace(/"/g,"&quot;")}"
          oninput="psInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
        <button id="psClrBtn" class="psClr" style="${tfFilter.q?"":"display:none"}" onclick="psClear()">✕</button>
      </div>
    </div>
    <div class="psChips">
      ${posBtn("","전체")}${posBtn("GK","GK")}${posBtn("DF","DF")}${posBtn("MF","MF")}${posBtn("FW","FW")}
      <span style="width:8px"></span>
      ${divBtn(1,"K리그1")}${divBtn(2,"K리그2")}
      <button id="psChip_mine" class="psChip ${tfFilter.mine?"on":""}" onclick="psToggle('mine')">우리 선수 제외</button>
      <button id="psChip_afford" class="psChip ${tfFilter.afford?"on":""}" onclick="psToggle('afford')">💰 예산 내</button>
    </div>
    <div class="psChips">
      <span class="small" style="opacity:.8;align-self:center;margin-right:2px">🎂 나이</span>
      ${[["",0],["23세 이하",23],["25세 이하",25],["27세 이하",27],["30세 이하",30],["31세 이하",31],["33세 이하",33]]
        .filter(x=>x[1]).map(([l,v])=>`<button class="psChip ${tfFilter.ageMax===v?"on":""}" onclick="psSetAgeMax(${v})">${l}</button>`).join("")}
      <button class="psChip ${tfFilter.ageMin?"on":""}" onclick="psSetAgeMin(${tfFilter.ageMin?0:30})" title="베테랑만 보기">30세 이상</button>
      ${(tfFilter.ageMax||tfFilter.ageMin)?`<button class="psChip" style="border-color:var(--gold);color:var(--gold)" onclick="psAgeClear()">✕ 나이 해제</button>`:""}
    </div>
    <div id="psSubRow">${psSubChips()}</div>
    <div id="fqHost">${famQBox()}</div>
    <div id="aqHost">${attrQBox()}</div>
  </div>`;
}
/* FA·해외 시장 목록 — 검색 탭과 같은 방식으로 열 명씩 끊는다 */
let faPage=1, osPage=1;
function faGo(n){ faPage=Math.max(1,n|0); show("transfer"); window.scrollTo(0,0); }
function osGo(n){ osPage=Math.max(1,n|0); show("transfer"); window.scrollTo(0,0); }
function faTabHtml(){
  const wi=windowInfo();
  try{ armySweep(); }catch(e){}   // 복무 중인 선수가 섞여 있으면 화면을 그리기 전에 걸러 낸다
  const faAsk=p=>Math.round(faWageAsk(p)*10)/10;
  const list=cardApply("fa", (G.freeAgents||[]).slice().sort((a,b)=>sortLv(b)-sortLv(a)),
    {ovr:p=>sortLv(p), age:p=>G.season-p.by, wage:p=>faAsk(p), name:p=>p.name});
  if(!list.length) return `<div class="card"><h3>🆓 자유계약(FA) 시장</h3>
    <p class="small">현재 FA(무적) 선수가 없습니다. 방출된 선수와 구단에서 정리된 선수들이 이곳에 나타납니다.</p></div>`;
  const last=Math.max(1, Math.ceil(list.length/PS_PER));
  const page=faPage=clamp(faPage,1,last);
  const from=(page-1)*PS_PER;
  const rows=list.slice(from, from+PS_PER).map(p=>{
    const ask=Math.round(faWageAsk(p)*10)/10;
    return `<div class="psRow">
      <div class="psMain">
        <div class="psName clickable" onclick="openPlayerMenu(event,${p.id})"><span class="${p.frn?"frnN":""}">${p.name}</span>${p.frn?' <span class="small">🌐</span>':""}${pTags(p)}</div>
        <div class="psSub"><span class="pos-${p.pos}">${p.pos}</span> · ${G.season-p.by}세 · 🆓 무적${p.frn?' · <span class="frnN">외국인</span>':""} · 에이전트 ${AGENT_T[p.id%3].n}</div>
        ${psPosBadge(p)}
      </div>
      <div class="psVal">요구연봉 약 <b>${ask}억</b></div>
      <div class="psAct">${slStarBtn(p.id)}${wi.open?`<button class="mini" onclick="startFANego(${p.id})">🤝 협상</button>`:`<span class="tag inj">시장 닫힘</span>`}</div>
    </div>`;}).join("");
  return `<div class="card"><h3>🆓 자유계약(FA) 시장 <span class="small">이적료 없음 · 연봉 → 에이전트 2단계 협상</span></h3>
    <div class="psCount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b>${list.length}명</b> <span style="opacity:.7">· ${from+1}~${Math.min(from+PS_PER,list.length)}번째</span>${cardSortBox("fa")}</div>
    ${rows}${psPager(list.length, page, "faGo")}</div>`;
}
function osTabHtml(){
  const wi=windowInfo(), t=userTeam();
  const list=cardApply("os", overseasList().slice().sort((a,b)=>sortLv(b)-sortLv(a)),
    {ovr:p=>sortLv(p), age:p=>G.season-p.by, mv:p=>marketValue(p), wage:p=>p.osWage||p.wage||0, name:p=>p.name});
  if(!list.length) return `<div class="card"><h3>🌍 해외 이적시장</h3>
    <p class="small">지금은 한국행을 검토 중인 해외 선수가 없습니다. 시장이 움직이면 이곳에 뜹니다.</p></div>`;
  const last=Math.max(1, Math.ceil(list.length/PS_PER));
  const page=osPage=clamp(osPage,1,last);
  const from=(page-1)*PS_PER;
  const rows=list.slice(from, from+PS_PER).map(p=>{
    const fee=marketValue(p), poor=t.budget<fee*0.8;
    return `<div class="psRow">
      <div class="psMain">
        <div class="psName clickable" onclick="openPlayerMenu(event,${p.id})"><span class="${p.frn?"frnN":""}">${p.name}</span>${p.frn?' <span class="small">🌐</span>':""}${pTags(p)}</div>
        <div class="psSub"><span class="pos-${p.pos}">${p.pos}</span> · ${G.season-p.by}세 · ${p.h}cm ${p.w}kg · <b>${p.osClub||"무소속"}</b></div>
        ${psPosBadge(p)}
      </div>
      <div class="psVal">몸값 <b class="money" style="${poor?"color:var(--red)":""}">${fee}억</b><br>
        <span class="small">요구 연봉 <b style="${(p.osWage||0)>wageRoom(t)?"color:var(--red)":""}">${p.osWage||p.wage}억</b>
        <span style="opacity:.7">(연봉 여유 ${wageRoom(t)}억)</span></span></div>
      <div class="psAct">${!wi.open?`<span class="tag inj">시장 닫힘</span>`
        :poor?`<span class="tag inj">예산 부족</span>`
        :`<button class="mini" onclick="startOverseasNego(${p.id})">🌍 영입 시도</button>`}</div>
    </div>`;}).join("");
  return `<div class="card"><h3>🌍 해외 이적시장 <span class="small">— 한국행을 검토 중인 해외 선수들 · 예산 <b class="money">${t.budget}억</b></span></h3>
    <p class="small" style="margin-bottom:8px">표시된 금액은 <b>몸값</b>입니다. 실제 이적료는 국내 영입과 똑같이 <b>상대 구단과 협상</b>해서 정합니다
      (이적료 → 연봉 → 에이전트 3단계). 연봉 눈높이가 K리그와 전혀 다르니 연봉 상한을 먼저 확인하세요.</p>
    <div class="psCount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b>${list.length}명</b> <span style="opacity:.7">· ${from+1}~${Math.min(from+PS_PER,list.length)}번째</span>${cardSortBox("os")}</div>
    ${rows}${psPager(list.length, page, "osGo")}</div>`;
}
/* ═══════════════════════════════════════════════════════════════
   🎖️ 김천 상무 FC를 직접 맡았을 때 — 이 팀만의 이적시장
   상무는 돈으로 선수를 사고파는 구단이 아니다. 선수는 전원 원소속 구단에서 파견 나온
   현역 군인이고, 18개월이 지나면 예외 없이 돌아간다. 그래서 감독이 할 일은 딱 둘이다.
     ① 전역 일정을 읽는다 — 언제, 몇 명이, 어느 자리에서 빠지는지
     ② 그 자리를 입대 지원자 중에서 채운다 — 돈이 아니라 '선발'로
   영입·방출·임대·재계약은 전부 막힌다. 대신 정원(TO)과 지원자 명단이 그 자리를 대신한다.
   ⚠ 선발은 감독 마음대로가 아니다. 원소속 구단에서 주전으로 뛰는 선수는 잘 오지 않고,
     나이가 찬 선수는 스스로 급하다. 감독의 위신도 조금 작용한다.
═══════════════════════════════════════════════════════════════ */
const ARMY_CAP=38;      // 부대 정원 — 이 인원을 넘겨 받을 수 없다
const ARMY_MIN=20;      // 이 아래로 떨어지면 연맹이 강제로 채워 준다
function armyUserClub(){ const t=userTeam(); return (t && t.id==="gimcheon") ? t : null; }
/* 입영 통지를 보낸 인원은 아직 부대에 없지만 자리는 예약된 상태다 */
function armyCalledCount(){
  let n=0;
  try{ for(const id in G.teams){ const t=G.teams[id];
    if(id==="gimcheon") continue;
    for(const p of t.players) if(p.armyCall) n++; } }catch(e){}
  return n;
}
function armySlots(){ const gc=armyUserClub(); if(!gc) return 0; return clamp(ARMY_CAP-gc.players.length-armyCalledCount(), 0, 8); }
/* 상무 감독에게 막히는 행동들 — 왜 막히는지까지 설명한다 */
function armyGate(what){
  if(!armyUserClub()) return false;
  showConfirm(`<b>🎖️ 김천 상무 FC는 ${what}을(를) 할 수 없습니다</b>\n\n`+
    `이 팀의 선수는 전원 <b>원소속 구단에서 파견된 현역 군인</b>입니다.\n`+
    `이적료를 주고 데려올 수도, 받고 팔 수도, 계약을 새로 쓸 수도 없습니다.\n\n`+
    `선수 수급은 <b>💸 이적시장 → 🎖️ 입대 지원</b> 탭에서 합니다.\n`+
    `<span class="small">전역 일정을 먼저 보고, 빠지는 자리를 지원자 중에서 채우세요.</span>`,
    ()=>{}, {okLabel:"알겠습니다", cancelLabel:""});
  return true;
}
/* 입대 지원 자격 — 20~26세 국내 선수, 병역 미필, 원소속 스쿼드에 여유가 있어야 한다 */
function armyEligible(p, t){
  const age=G.season-p.by;
  /* 🎖️ ⚠ 제보 — 홈그로운도 국적은 외국이다. 병역 대상이 아니므로 p.frn 으로 거른다 */
  return !(age<20 || age>26 || p.loan || p.frn || p.armyDone || p.army || p.armyCall) && (t.players||[]).length>22;
}
function armyCandList(){
  const out=[];
  for(const id in G.teams){
    const t=G.teams[id];
    if(id==="gimcheon" || t.isUser) continue;      // 우리 팀 선수는 이미 우리 팀이다
    for(const p of t.players) if(armyEligible(p,t)) out.push({p,t});
  }
  return out;
}
/* 지원자 명단은 이적시장 창마다 새로 뜬다 — 창이 바뀌면 지원자도 바뀐다 */
function armyPool(){
  const wi=windowInfo();
  const key=`${G.season}-${wi.open?(wi.name||"win"):"off"}`;
  if(!G.armyPool || G.armyPool.k!==key){
    const all=armyCandList();
    for(let i=all.length-1;i>0;i--){ const j=R(i+1); const t=all[i]; all[i]=all[j]; all[j]=t; }
    G.armyPool={k:key, ids:all.slice(0, 24+R(9)).map(c=>c.p.id), tried:{}};
  }
  const map={}; for(const c of armyCandList()) map[c.p.id]=c;
  return {st:G.armyPool, list:G.armyPool.ids.map(id=>map[id]).filter(Boolean)};
}
/* 합격 전망 — 본인의 사정과 원소속 구단의 사정이 함께 걸린다 */
function armyOdds(c){
  const p=c.p, t=c.t, age=G.season-p.by;
  let ch=0.30;
  ch += (age-22)*0.05;                                    // 나이가 찰수록 본인이 급하다 (20세 -0.10 · 26세 +0.20)
  ch -= Math.max(0, p.ovr-62)*0.016;                      // 잘하는 선수는 구단이 놓지 않는다
  ch += (p.apps||0)<=4 ? 0.12 : ((p.apps||0)>=15 ? -0.22 : -0.05);
  ch += ((t.players||[]).length-26)*0.02;                 // 스쿼드가 두꺼우면 보내 준다
  try{ ch += clamp((mgrPrestige()-10)/300, 0, 0.08); }catch(e){}   // 감독 위신도 조금은 통한다
  return clamp(ch, 0.05, 0.88);
}
/* 📨 입영 통지 — 자리는 이때 예약된다. 실제 이동은 입소일에 한다. */
function armySetCall(p, from, gc){
  const at=(G.day||0)+ARMY_CALL_DAYS;
  p.armyCall={own:from.id, at};
  const d=dateOfDay(at);
  const ds=`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  if(from.isUser){
    notify(`🎖️ <b>${p.name}</b> 선수에게 <b>입영 통지</b>가 왔습니다 — <b>${ds}</b> 입소 (D-${ARMY_CALL_DAYS})<br>`
      +`<span class="small">그때까지는 우리 팀에서 뜁니다. 다만 이적·임대는 묶입니다.</span>`,"warn");
    addMood(`🎖️ ${p.name} 선수의 입영 통지가 도착했습니다. 라커룸이 잠시 조용해졌습니다.`);
    try{ const Q=(G.armyCallPing=G.armyCallPing||{n:0,names:[],ds:ds}); Q.n++; Q.names.push(p.name); Q.ds=ds; }catch(e){}
    try{ addNews(`🎖️ <b>${p.name}</b>(${from.short}) 입영 통지 — ${ds} 김천 상무 FC 입소 예정`, "warn", "club"); }catch(e){}
  } else {
    try{ addNews(`🎖️ ${from.short} ${p.name}, ${ds} 김천 상무 FC 입소 예정`, null, "club"); }catch(e){}
  }
  return p;
}
/* ⏰ 입소일 — 예고했던 날이 되면 실제로 부대로 간다 */
/* ⚠ 제보 — 홈그로운 외국인에게 이미 나가 있던 입영 통지도 무효로 돌린다 (옛 세이브 정리) */
function armyCallPurge(){
  try{
    let n=0;
    for(const id in G.teams) for(const p of (G.teams[id].players||[])){
      if(p && p.armyCall && p.frn){ delete p.armyCall; n++; }
    }
    if(n) addNews(`🎖️ 병역 대상이 아닌 외국 국적 선수 ${n}명의 입영 통지가 취소됐습니다`, "warn", "club");
  }catch(e){}
}
function tickArmyCall(){
  const gc=G.teams&&G.teams.gimcheon; if(!gc) return;
  const today=G.day||0;
  for(const id in G.teams){
    const t=G.teams[id]; if(t===gc) continue;
    for(const p of [...t.players]){
      if(!p.armyCall || p.armyCall.at==null || p.armyCall.at>today) continue;
      const own=G.teams[p.armyCall.own] || t;
      delete p.armyCall;
      try{ armyEnlist(p, t, gc); }catch(e){ continue; }
      if(t.isUser){
        notify(`🎖️ <b>${p.name}</b> 선수가 오늘 <b>김천 상무 FC</b>에 입소했습니다. <span class="small">(${ARMY_MONTHS}개월 뒤 복귀)</span>`,"warn");
        try{ armyFarewell(p); }catch(e){}
        try{ const A=(G.armyBack=G.armyBack||{n:0,names:[],gone:0}); A.n++; A.names.push(p.name); A.enlist=1; }catch(e){}
      }
      try{ addNews(`🎖️ ${t.short} <b>${p.name}</b>, 김천 상무 FC 입소 — ${ARMY_MONTHS}개월 뒤 원소속 복귀`, null, "club"); }catch(e){}
    }
  }
}
function armyEnlist(p, from, gc){
  const now=dateOfDay(G.day||0);
  const out=new Date(now); out.setMonth(out.getMonth()+ARMY_MONTHS);
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  from.players.splice(from.players.indexOf(p),1);
  p.army={own:from.id, in:fmt(now), out:fmt(out)};
  p.morale=clamp((p.morale||70)-3,25,99); p.inj=0; p.injUntil=null; delete p.injW0; p.ban=0; p.sulk=0; p.unhappy=0;
  gc.players.push(p); joinClub(gc, p);
  return p;
}
/* 선발 신청 — 한 창에 선수당 한 번 */
function armyApply(pid){
  const gc=armyUserClub(); if(!gc) return;
  const {st, list}=armyPool();
  const c=list.find(x=>x.p.id===pid); if(!c){ flash("그 지원자는 더 이상 명단에 없습니다.","warn"); show("transfer"); return; }
  if(st.tried[pid]){ flash("이번 모집에서는 이미 판정이 끝난 선수입니다.","warn"); show("transfer"); return; }
  if(armySlots()<=0){ flash(`부대 정원(${ARMY_CAP}명)이 찼습니다. 전역자가 나와야 자리가 생깁니다.`,"warn"); show("transfer"); return; }
  const ch=armyOdds(c), p=c.p, from=c.t;
  showConfirm(`<b>🎖️ ${p.name} 선발 신청</b>\n\n`+
    `· 원소속: <b>${from.name}</b>\n· ${G.season-p.by}세 ${POS_KO[p.pos]||p.pos} · 올 시즌 ${p.apps||0}경기\n`+
    `· 합격 전망: <b style="color:${ch>=0.6?"var(--green)":ch>=0.35?"var(--gold)":"var(--red)"}">${Math.round(ch*100)}%</b>\n\n`+
    `<span class="small">신청하면 결과가 즉시 나옵니다. 떨어지면 이번 모집에서는 다시 넣을 수 없습니다.</span>`,
    ()=>{
      st.tried[pid]=1;
      if(Math.random()<ch){
        armySetCall(p, from, gc);
        const _d=dateOfDay((G.day||0)+ARMY_CALL_DAYS);
        addNews(`🎖️ 김천 상무 FC, <b>${p.name}</b>(${from.short}) 선발 — ${_d.getMonth()+1}월 ${_d.getDate()}일 입소 예정`, "good", "club");
        showConfirm(`<b style="color:var(--green);font-size:16px">🎖️ 선발 — 합격</b>\n\n`+
          `${p.name} 선수를 선발했습니다. 입영 통지가 <b>${from.short}</b>에 전달됩니다.\n\n`+
          `· 입소 예정: <b>${_d.getFullYear()}년 ${_d.getMonth()+1}월 ${_d.getDate()}일</b> (D-${ARMY_CALL_DAYS})\n`+
          `· 전역 예정: 입소 후 ${ARMY_MONTHS}개월\n· 남은 정원: <b>${armySlots()}</b>명\n\n`+
          `<span class="small">입소일까지는 원소속 구단에서 뜁니다. 자리는 지금부터 비워 둡니다.</span>`,
          ()=>{ show("transfer"); }, {okLabel:"확인", cancelLabel:""});
      } else {
        showConfirm(`<b style="color:var(--red);font-size:16px">🎖️ 선발 — 불합격</b>\n\n`+
          `${from.name}이(가) ${p.name} 선수의 입대를 이번 시기에는 보류했습니다.\n\n`+
          `<span class="small">"시즌 계획에 포함된 선수입니다." — 다음 모집에서 다시 볼 수 있습니다.</span>`,
          ()=>{ show("transfer"); }, {okLabel:"확인", cancelLabel:""});
      }
      saveGame();
    }, {okLabel:"🎖️ 신청한다", cancelLabel:"취소"});
}
/* 정원이 심각하게 비면 연맹이 채워 준다 — 감독이 손을 놓아도 경기는 해야 한다 */
/* 🎖️ 연맹 강제 배정 — 상무의 정원과 자리가 비면 채운다
   ⚠ 제보 원문 — 「김천 상무는 유스 콜업이 없는 팀이라서 김천 상무의 유스 콜업이 있다면 없애주시면
      감사하겠습니다」.
   ─ 원인이 둘이었다.
     ① aiSquadFill(AI 구단 스쿼드 보충)이 상무에도 돌아, 입대한 적 없는 선수를 무에서 만들어 냈다.
        자리를 유스 자리표(youthPickSlot)로 뽑았으니 사실상 유스 콜업이었다. → 그쪽을 막았다.
     ② 그런데 이 함수는 armyUserClub() — 「내가 상무일 때만」 — 을 보고 있었다. 상무가 AI면 아예
        돌지 않아서, 빈자리를 전부 ①이 대신 메우고 있었다.
   상무의 선수는 오직 입대로만 온다. 모자라면 연맹이 다른 구단 현역을 데려온다 — 새로 만들지 않는다.
   ⚠ 유저 팀 선수는 어느 경우에도 강제 징집하지 않는다 (감독 동의 없는 차출 금지). */
const ARMY_POS_MIN={GK:3, DF:6, MF:6, FW:3};
function armyClub(){ try{ for(const id in G.teams) if(isArmyTeam(G.teams[id])) return G.teams[id]; }catch(e){} return null; }
function armyAutoFloor(){
  const gc=armyClub(); if(!gc || !Array.isArray(gc.players)) return;
  /* 유저가 상무면 스스로 입대 지원을 받으므로 하한만 지킨다.
     AI가 상무면 스스로 모집할 창구가 없으니 실제 등록 규모(24명)까지 연맹이 채운다. */
  const floor = gc.isUser ? ARMY_MIN : 24;
  const posN=(k)=>gc.players.filter(p=>p && p.pos===k).length;
  const wantPos=[];
  for(const k in ARMY_POS_MIN) for(let i=posN(k); i<ARMY_POS_MIN[k]; i++) wantPos.push(k);
  if(!wantPos.length && gc.players.length>=floor) return;
  /* 자격을 갖춘 지원 대상이 1순위. 그래도 못 채우면 연맹이 조건을 넓혀 강제 배정한다. */
  const wide=[];
  try{ for(const id in G.teams){ const t=G.teams[id];
    if(t===gc || t.isUser) continue;
    for(const p of (t.players||[])){
      const age=G.season-p.by;
      if(p.loan || p.frn || p.armyDone || p.army || p.armyCall) continue;
      if(age<20 || age>27) continue;
      if((t.players||[]).length<=20) continue;      // 원소속을 빈껍데기로 만들지는 않는다
      wide.push({p,t});
    } } }catch(e){}
  const strict=wide.filter(c=>{ try{ return armyEligible(c.p, c.t); }catch(e){ return false; } });
  const got=[];
  const take=(pool, want)=>{
    if(gc.players.length>=ARMY_CAP) return false;
    const c=pool.filter(x=>(!want || x.p.pos===want) && x.t.players.indexOf(x.p)>=0)
                .sort((a,b)=>(a.p.apps||0)-(b.p.apps||0))[0];
    if(!c) return false;
    try{ armyEnlist(c.p, c.t, gc); }catch(e){ return false; }
    got.push(`${c.p.name}(${c.p.pos})`);
    return true;
  };
  for(const k of wantPos){ if(!take(strict,k)) take(wide,k); }
  let g=0;
  while(gc.players.length<floor && g++<40){ if(!take(strict,null) && !take(wide,null)) break; }
  if(got.length) addNews(`🎖️ 국군체육부대, 부족 인원 ${got.length}명 긴급 배정 — ${got.join(", ")}`, "warn", "club");
}
let armyPg=1;
function armyGo(n){ armyPg=n; show("transfer"); }
function armyTab(){
  const gc=armyUserClub(); if(!gc) return "";
  const wi=windowInfo(), slots=armySlots();
  const disc=gc.players.filter(p=>p.army&&p.army.out).map(p=>({p, d:armyDaysLeft(p)})).sort((a,b)=>a.d-b.d);
  const soon=disc.filter(x=>x.d<=120);
  const {st, list}=armyPool();
  const per=8, last=Math.max(1, Math.ceil(list.length/per)); const pg=clamp(armyPg,1,last); armyPg=pg;
  const sorted=applySort("army", list,
    {name:c=>c.p.name, club:c=>c.t.short, pos:c=>c.p.pos, age:c=>G.season-c.p.by,
     ovr:c=>sortLv(c.p), apps:c=>c.p.apps||0, odds:c=>armyOdds(c)}, "");
  const page=sorted.slice((pg-1)*per, pg*per);
  const posCnt={}; for(const p of gc.players) posCnt[p.pos]=(posCnt[p.pos]||0)+1;
  const goneCnt={}; for(const x of soon) goneCnt[x.p.pos]=(goneCnt[x.p.pos]||0)+1;
  return `<div class="msg info" style="border-width:2px">🎖️ <b>김천 상무 FC — 이적시장이 아니라 입대·전역입니다.</b><br>
    영입·방출·임대·재계약은 모두 막혀 있습니다. 전역으로 빠지는 자리를 <b>입대 지원자</b> 중에서 채우는 것이 이 팀의 보강입니다.
    <span class="small">복무 기간 ${ARMY_MONTHS}개월 · 부대 정원 ${ARMY_CAP}명 · 이적료와 연봉 협상은 존재하지 않습니다.</span></div>
  <div class="row">
    <div class="card"><h3>👥 부대 인원</h3><div style="font-size:26px">${gc.players.length}<span class="small"> / ${ARMY_CAP}</span></div>
      <p class="small" style="margin-top:6px">남은 정원 <b style="color:${slots?"var(--green)":"var(--red)"}">${slots}명</b>
      ${wi.open?"":' · <span style="color:var(--gold)">모집 시기가 아닙니다</span>'}</p></div>
    <div class="card"><h3>⏳ 4개월 내 전역</h3><div style="font-size:26px;color:var(--gold)">${soon.length}명</div>
      <p class="small" style="margin-top:6px">${["GK","DF","MF","FW"].map(k=>`${k} ${goneCnt[k]||0}/${posCnt[k]||0}`).join(" · ")}</p></div>
    <div class="card"><h3>🎖️ 이번 모집</h3><div style="font-size:26px">${Object.keys(st.tried||{}).length}<span class="small"> 건 판정</span></div>
      <p class="small" style="margin-top:6px">지원자 ${list.length}명 · 한 선수당 한 번만 신청할 수 있습니다.</p></div>
  </div>
  <div class="card"><h3>📅 전역 일정 <span class="small">— 빠지는 자리를 미리 읽어야 합니다</span></h3>
    ${disc.length?`<div class="tblScroll"><table><tr><th>이름</th><th>포지션</th><th>능력</th><th>전역일</th><th>남은 기간</th><th>복귀처</th></tr>
      ${disc.slice(0,14).map(({p,d})=>{ const own=p.army.own&&G.teams[p.army.own];
        return `<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</td>
        <td class="pos-${p.pos}">${p.pos}</td><td>${abilityStars(p)}</td>
        <td class="small">${p.army.out}</td>
        <td><b style="color:${d<=60?"var(--red)":d<=120?"var(--gold)":"var(--sub)"}">D-${Math.max(0,d)}</b></td>
        <td class="small">${own?own.short:"무소속 → FA"}</td></tr>`;}).join("")}
      </table></div>${disc.length>14?`<p class="small">외 ${disc.length-14}명</p>`:""}`:`<p class="small">전역 예정자가 없습니다.</p>`}
  </div>
  <div class="card"><h3>🎖️ 입대 지원자 <span class="small">— 원소속에서 못 뛰는 선수일수록 잘 옵니다</span></h3>
    ${!wi.open?`<div class="msg warn">모집 시기가 아닙니다. 이적시장이 열리면 새 지원자 명단이 뜹니다.</div>`
     :slots<=0?`<div class="msg warn">부대 정원 ${ARMY_CAP}명이 찼습니다. 전역자가 나와야 새로 받을 수 있습니다.</div>`:""}
    ${list.length?`<div class="tblScroll"><table><tr>${sortTh("army","name","이름")}${sortTh("army","club","원소속")}${sortTh("army","pos","포지션")}${sortTh("army","age","나이")}${sortTh("army","ovr","능력")}${sortTh("army","apps","올 시즌")}${sortTh("army","odds","합격 전망")}<th></th></tr>
      ${page.map(c=>{ const ch=armyOdds(c), done=st.tried[c.p.id];
        return `<tr><td class="clickable" onclick="openPlayerMenu(event,${c.p.id})">${nmF(c.p)}</td>
        <td class="small">${c.t.short}${c.t.div===2?" (K2)":""}</td>
        <td class="pos-${c.p.pos}">${c.p.pos}</td><td>${G.season-c.p.by}</td><td>${abilityStars(c.p)}</td>
        <td>${c.p.apps||0}경기</td>
        <td><b style="color:${ch>=0.6?"var(--green)":ch>=0.35?"var(--gold)":"var(--red)"}">${Math.round(ch*100)}%</b></td>
        <td>${done?`<span class="tag inj">판정 완료</span>`
          :(wi.open&&slots>0)?`<button class="mini" onclick="armyApply(${c.p.id})">🎖️ 선발 신청</button>`
          :`<span class="small">—</span>`}</td></tr>`;}).join("")}
      </table></div>
      ${last<=1?"":`<div class="trPager">
        <button class="trPg" ${pg===1?"disabled":""} onclick="armyGo(${pg-1})">‹</button>
        ${Array.from({length:last},(_,i)=>i+1).map(n=>`<button class="trPg ${n===pg?"on":""}" onclick="armyGo(${n})">${n}</button>`).join("")}
        <button class="trPg" ${pg===last?"disabled":""} onclick="armyGo(${pg+1})">›</button>
        <span class="trPgInfo">${list.length}명 중 ${(pg-1)*per+1}~${Math.min(pg*per,list.length)}</span></div>`}`
     :`<p class="small">지금은 지원 자격을 갖춘 선수가 없습니다.</p>`}
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════
   🔎 스카우팅 망 — 직접 발굴하는 외국인 자원
   해외 이적시장(OVERSEAS_DEF)이 "이미 이름이 알려진 선수"라면, 이쪽은 아무도 모르는 선수를
   우리 스카우트가 찾아오는 경로다. 구단 프런트에 투자를 받아 망을 키우고, 지역에 파견을 보낸다.
     · 스카우팅 등급(1~5) — 프런트에 투자를 요청해서 올린다. 등급이 곧 보고서의 질이다.
     · 파견 지역 — 등급만큼 동시에 보낼 수 있다. 지역마다 나오는 유형이 다르다.
     · 보고서 — 이적시장이 열릴 때마다 새로 뜬다. 창이 닫히면 명단은 사라진다.
   ⚠ 발굴한 선수는 이름값이 없다. 이적료는 싸지만 실제 기량은 등급이 낮을수록 들쭉날쭉하다.
═══════════════════════════════════════════════════════════════ */
const SCOUT_MAX=5;
const SCOUT_REGIONS=[
  {k:"br", n:"브라질·남미", ic:"🇧🇷", cost:1.2, feeK:1.15,
   nats:["브라질","아르헨티나","콜롬비아","우루과이","파라과이"],
   d:"기술과 개인기. K리그가 가장 많이 파 온 광산.",
   bias:{tec:7, dri:8, fla:7, agi:5, fir:4}, pos:["FW","FW","MF","DF"],
   names:["카이키","제르손","루안","윌리안","마테우스","페드리뉴","알리송","조엘손","히카르두","비니시우스","다닐로","에메르송"]},
  {k:"jp", n:"일본·동아시아", ic:"🇯🇵", cost:1.4, feeK:1.10,
   nats:["일본","중국","대만"],
   d:"전술 이해와 성실함. 적응 실패가 드물다.",
   bias:{tea:8, wor:7, pas:6, dec:5, cnt:5}, pos:["MF","MF","DF","GK"],
   names:["타나카","코바야시","사토","이토","야마다","와타나베","나카무라","후지타","오카다","모리"]},
  {k:"eu", n:"동유럽·발칸", ic:"🇷🇸", cost:1.5, feeK:1.20,
   nats:["세르비아","크로아티아","몬테네그로","보스니아","폴란드","북마케도니아"],
   d:"신체와 제공권. 큰 키의 공격수와 센터백.",
   bias:{str:8, hea:7, jum:7, fin:5, bra:5}, pos:["FW","DF","DF","MF"],
   names:["요바노비치","페트로비치","밀레티치","코바치","루키치","스탄코비치","마르코비치","노바코비치","이바노프","브라니치"]},
  {k:"af", n:"아프리카", ic:"🌍", cost:1.0, feeK:0.92,
   nats:["나이지리아","가나","세네갈","코트디부아르","카메룬","말리"],
   d:"운동 능력이 압도적. 다듬으면 리그를 부순다.",
   bias:{pac:9, acc:8, str:6, jum:6, bal:4}, pos:["FW","FW","DF","MF"],
   names:["오콘퀘","아사모아","디우프","코네","음벰바","트라오레","아데예미","오세이","은디아예","밤바"]},
  {k:"as", n:"동남아·중앙아", ic:"🌏", cost:0.7, feeK:0.78,
   nats:["태국","베트남","우즈베키스탄","호주","인도네시아"],
   d:"값이 싸다. 아시아쿼터로 자리 부담도 적다.",
   bias:{sta:6, wor:6, tec:4, agi:4}, pos:["MF","DF","MF","GK"],
   names:["차나팁","응우옌","샤로프","라흐마토프","위라판","투안","케인","압두라흐만","수리야","하산"]},
  {k:"we", n:"서유럽 2·3부", ic:"🇪🇺", cost:2.0, feeK:1.38,
   nats:["스페인","포르투갈","프랑스","네덜란드","덴마크","독일"],
   d:"가장 비싸지만 가장 확실하다. 완성형에 가깝다.",
   bias:{tec:7, vis:7, pas:7, dec:6, cmp:5}, pos:["MF","MF","FW","DF"],
   names:["가르시아","실바","뒤랑","반 데이크","옌센","뮐러","페레이라","르페브르","바커","슈미트"]}
];
function scoutRegion(k){ return SCOUT_REGIONS.find(x=>x.k===k)||SCOUT_REGIONS[0]; }
function scoutLv(t){ t=t||userTeam(); return clamp((t&&t.scoutLv)||1, 1, SCOUT_MAX); }
/* ═══════════════════════════════════════════════════════════════════════════
   🔎 스카우팅 — 보내고, 기다리고, 보고를 받는다
   ⚠ 제보 ① 「보고서가 이미 올라와 있는데 다른 지역을 추가로 파견하려고 버튼을 누른 순간
             보고서가 전부 리롤된다. 체크를 해제해도 똑같다.」
      원인은 scoutToggle 이 S.key="" 로 만들고, 그 직후 화면이 부르는 scoutRefresh 가
      「창이 바뀌었다」고 보고 S.list 를 통째로 비운 것. 파견 지역과 보고서 목록이 한 덩어리였다.
      ② 「버튼을 누르면 바로 선수가 나온다. 시간이 걸리게 하고 좋은 선수 확률도 현실적으로.」
   ─ 이제 지역마다 독립된 「파견(trip)」이 있고, 보고서는 지역과 무관한 하나의 목록에 쌓인다.
     · 파견을 걸면 첫 보고까지 수십 일이 걸린다 (등급이 높을수록 짧다)
     · 보고는 한 건씩 올라오고, 헛걸음도 있다
     · 지역을 추가하거나 철수해도 이미 올라온 보고서는 그대로다
     · 유지비는 창 단위가 아니라 매달 나간다 — 오래 깔아 두면 그만큼 든다
   ═══════════════════════════════════════════════════════════════════════════ */
const SCOUT_LEAD=[0, 46, 39, 33, 28, 24];   // 등급별 첫 보고까지 걸리는 날
const SCOUT_GAP =[0, 40, 34, 29, 25, 21];   // 그다음 보고까지의 간격
/* 보고서가 목록에 남아 있는 날수 — 그 지역의 보고 주기(SCOUT_GAP)의 네 배.
   ⚠ 제보 — 「나카무라라는 선수가 몇 년 내내 스카우트 목록에서 사라지지 않는다」.
     ① 유효기간(scUntil)이 「절대 일자」인데 시즌이 바뀌면 달력이 0으로 되감긴다.
        시즌 후반에 올라온 보고서는 유효기간이 그 시즌 길이를 넘어서, 영영 만료되지 않았다.
     ② 같은 이유로 관찰 일수(scAt)도 음수가 되어 「모든 선수에게 NEW 딱지」가 붙었다.
   ─ 시즌 전환 때 두 값을 함께 되감고(rebaseDayFields), 유효기간은 보고 주기의 배수로 잡는다.
     ⭐ 관심 목록에 넣어 둔 선수는 만료되지 않는다 — 이적시장까지 지켜보라는 뜻이니까. */
function scoutKeepDays(lv){ return SCOUT_GAP[clamp(lv||3,1,5)]*4; }   // 보고 넷 번 분 (5등급 21일 → 84일 · 1등급 40일 → 160일)
function scoutState(){
  if(!G.scout) G.scout={send:[], key:"", list:[], gone:[], bill:0, trip:{}, mon:""};
  if(!Array.isArray(G.scout.send)) G.scout.send=[];
  if(!Array.isArray(G.scout.list)) G.scout.list=[];
  if(!Array.isArray(G.scout.gone)) G.scout.gone=[];
  if(!G.scout.trip || typeof G.scout.trip!=="object") G.scout.trip={};
  /* 구세이브 승격 — 파견 중이던 지역에 파견 기록을 만들어 준다 */
  for(const k of G.scout.send) if(!G.scout.trip[k]) G.scout.trip[k]={from:G.day||0, next:(G.day||0)+scoutLead(k), n:0};
  for(const k in G.scout.trip) if(G.scout.send.indexOf(k)<0) delete G.scout.trip[k];
  return G.scout;
}
/* 지역까지의 거리 — 남미·아프리카는 오래 걸리고 일본은 빠르다 */
function scoutFar(k){ return ({jp:0.72, cn:0.78, th:0.85, eu:1.06, af:1.18, br:1.22})[k] || 1; }
function scoutLead(k){
  const lv=scoutLv();
  return Math.max(9, Math.round(SCOUT_LEAD[clamp(lv,1,5)]*scoutFar(k)*(0.85+Math.random()*0.3)));
}
function scoutGapEst(k){ return Math.max(8, Math.round(SCOUT_GAP[clamp(scoutLv(),1,5)]*scoutFar(k))); }
function scoutGap(k){
  const lv=scoutLv();
  return Math.max(8, Math.round(SCOUT_GAP[clamp(lv,1,5)]*scoutFar(k)*(0.8+Math.random()*0.45)));
}
/* 파견 지역 토글 — 등급만큼만 동시에 보낼 수 있다.
   ⚠ 이미 올라온 보고서(S.list)는 어떤 경우에도 건드리지 않는다. */
function scoutToggle(k){
  if(typeof armyUserClub==="function" && armyUserClub()){
    flash("김천 상무 FC는 외국인 선수를 등록할 수 없습니다.","warn"); show("transfer"); return;
  }
  const S=scoutState(), t=userTeam(), lv=scoutLv(t), reg=scoutRegion(k);
  const i=S.send.indexOf(k);
  if(i>=0){
    const tr=S.trip[k], left=tr?Math.max(0, tr.next-(G.day||0)):0;
    showConfirm(`<b>${reg.ic} ${reg.n} 파견을 철수합니다</b>\n\n`+
      (left>0?`다음 보고까지 <b>${left}일</b> 남았습니다 — 진행 중인 관찰은 사라집니다.\n`:``)+
      `<span class="small">이미 올라온 보고서는 그대로 남습니다. 유지비도 다음 달부터 나가지 않습니다.</span>`,
      ()=>{ const j=S.send.indexOf(k); if(j>=0) S.send.splice(j,1); delete S.trip[k];
        flash(`${reg.ic} ${reg.n} 파견을 철수했습니다.`,"warn"); saveGame(); show("transfer"); },
      {okLabel:"철수한다", cancelLabel:"계속 둔다"});
    return;
  }
  if(S.send.length>=lv){ flash(`스카우팅 ${lv}등급으로는 지역 ${lv}곳까지만 동시에 파견할 수 있습니다.`,"warn"); show("transfer"); return; }
  S.send.push(k);
  const lead=scoutLead(k);
  S.trip[k]={from:G.day||0, next:(G.day||0)+lead, n:0};
  flash(`${reg.ic} ${reg.n}에 스카우트를 보냈습니다 — 첫 보고까지 약 ${lead}일.`,"good");
  saveGame(); show("transfer");
}
/* 한 달 유지비 — 지역 자료값(cost)은 「이적시장 창 한 번」 기준이었다.
   이제 상시로 나가므로 월 단위로 환산한다(연간 부담이 예전의 두 배 안쪽이 되게). */
const SCOUT_COST_M=0.22;
function scoutCostM(k){ return Math.round(scoutRegion(k).cost*SCOUT_COST_M*10)/10; }
function scoutBill(){
  const S=scoutState();
  return Math.round(S.send.reduce((a,k)=>a+scoutCostM(k), 0)*10)/10;
}
/* 발굴 선수 한 명 만들기 */
/* 🧭 스카우트 보고서의 자리 — 유스와 같은 문제가 있었다(제보 — 골키퍼·풀백이 안 보인다).
   ① 골키퍼가 일부 지역 목록에만 있어 사실상 안 나왔고
   ② 세부 자리를 정하지 않아 능력치 추론이 센터백·중앙 미드필더로 몰렸다.
   지역 성향(남미는 공격적, 동유럽은 중원 등)은 그대로 두고, 골키퍼 비율과 세부 자리만 보장한다. */
function scoutPickSlot(reg){
  /* 지역 목록에 이미 GK 가 들어 있으면 확률이 겹쳐 골키퍼가 3분의 1까지 나온다(실측 35%).
     GK 는 지역과 무관하게 늘 9%로 고정하고, 나머지는 지역 성향대로 뽑는다. */
  const nonGK=reg.pos.filter(x=>x!=="GK");
  const pos = (Math.random()<0.09 || !nonGK.length) ? "GK" : pick(nonGK);
  const S=YOUTH_SLOTS.find(x=>x.pos===pos) || YOUTH_SLOTS[2];
  return {pos, pref:pick(S.prefs)};
}
function mkScouted(reg, lv){
  const S=scoutState();
  let name=pick(reg.names), n=0;
  while((S.list.some(q=>q.name===name)||S.gone.indexOf(name)>=0) && n++<12) name=pick(reg.names)+" "+pick(["주니오르","2세","F.","N.","C."]);
  const _sl=scoutPickSlot(reg);
  const pos=_sl.pos;
  const by=G.season-(18+R(11));
  /* 등급이 곧 눈이다 — 낮은 등급은 평균도 낮고 편차도 크다 */
  /* ⚠ 「좋은 선수 찾을 확률을 납득할 만큼 현실적으로 낮춰 달라」(제보).
     예전 값(55+lv*3.0, 대박 4.3~11.5%)은 3등급만 돼도 즉시 주전급이 꾸준히 올라왔다.
     실제 스카우팅은 대부분 「쓸 만하지만 확신은 없는」 자원을 물어 온다. */
  const base=51 + lv*2.3 + R(5 + (5-lv)*2);
  const jack = Math.random() < 0.008+lv*0.007;           // 1등급 1.5% → 5등급 4.3%
  const ovr=clamp(Math.round(base + (jack?6+R(6):0)), 48, 84);
  const p=mkPlayer(name, pos, by, ovr, 1, {});
  for(const a in reg.bias){ if(p.attr && p.attr[a]!=null) p.attr[a]=clamp(p.attr[a]+reg.bias[a]-2+R(5), 15, 99); }
  try{ syncLegacyAttrs(p.attr); }catch(e){}
  /* 세부 자리를 못 박고 그 자리에 맞게 능력치를 다듬는다 */
  try{ p.prefPos=_sl.pref; p.posFam=initPosFam(p); applySpecialization(p); }catch(e){}
  try{ p.traits=genTraits(p.pos, p.attr, p); }catch(e){}
  p.pot=clamp(p.pot + (by>=G.season-22 ? 1+R(4) : 0), p.ovr, jack?92:86);
  p.osClub=`${pick(reg.nats)} 리그`;
  p.osNat=pick(reg.nats);
  p.osTier="minor";
  p.scReg=reg.k;
  p.scJack=jack?1:0;
  /* 등급이 낮으면 보고서 자체가 부정확하다 — 화면에는 이 오차만큼 흔들린 값이 보인다.
     ⚠ 다만 계속 지켜보면 정확해진다 — scoutErrNow 가 관찰 일수만큼 오차를 깎는다. */
  p.scErr0=Math.max(0, 7-lv);
  p.scErr=p.scErr0;
  p.scAt=G.day||0;                       // 처음 보고가 올라온 날
  p.scNewTil=(G.day||0)+3;               // 🆕 딱지는 사흘. 절대 일자라 시즌 전환 때 함께 되감긴다
  p.scUntil=(G.day||0)+scoutKeepDays(lv);   // 이 날이 지나면 다른 구단이 데려간다
  const mv=Math.round(marketValue(p)*reg.feeK*10)/10;
  p.mvFix=Math.max(0.5, mv);
  p.osWage=Math.round(wageExpect(p.ovr,1,1)*1.15*10)/10;
  p.wage=p.osWage;
  return p;
}
/* 관찰이 길어질수록 보고가 정확해진다 */
function scoutErrNow(p){
  const e0=(p.scErr0!=null)?p.scErr0:(p.scErr||0);
  if(!e0) return 0;
  const days=Math.max(0, (G.day||0)-(p.scAt||0));
  return Math.max(0, Math.round(e0 - days/26));      // 26일마다 오차 1
}
/* 🕰️ 하루가 흐른다 — 파견 중인 지역에서 때가 되면 보고가 올라온다 */
function scoutTick(){
  const t=userTeam(); if(!t) return;
  const S=scoutState();
  if(t.id==="gimcheon"){ S.send=[]; S.trip={}; return; }      // 군경팀은 해당 없음
  const day=G.day||0;
  /* ① 유지비 — 매달 1일, 파견 중인 지역만큼 이적 예산에서 나간다 */
  try{
    const dt=dateOfDay(day), mk=`${G.season}-${dt.getMonth()+1}`;
    if(dt.getDate()===1 && S.mon!==mk){
      S.mon=mk;
      const bill=scoutBill();
      if(bill>0){
        t.budget=Math.round(Math.max(0, t.budget-bill)*10)/10;
        addNews(`🔎 스카우트 파견 유지비 <b>${bill}억</b> — ${S.send.map(k=>scoutRegion(k).n).join(", ")} (${scoutLv(t)}등급)`, null, "club");
      }
    }
  }catch(e){}
  /* ② 유효기간이 지난 보고서는 다른 구단이 데려간다 (협상 중인 선수는 남긴다) */
  const negoPid=(G.nego&&G.nego.pid)||null;
  const gone=[];
  S.list=S.list.filter(p=>{
    if(p.id===negoPid) return true;
    /* ⭐ 관심 목록에 넣어 둔 선수는 내려가지 않는다 — 이적시장까지 지켜보겠다는 표시다 (제보) */
    try{ if(slHas(p.id)) return true; }catch(e){}
    if((p.scUntil||0)>day) return true;
    gone.push(p); return false;
  });
  for(const p of gone){
    S.gone.push(p.name);
    addNews(`🔎 스카우트 보고서에 올랐던 <b>${p.name}</b>이/가 다른 구단과 계약했습니다 — 목록에서 내려갑니다. <span class="small">(⭐ 관심 목록에 넣어 두면 사라지지 않습니다)</span>`, null, "club");
  }
  if(S.gone.length>80) S.gone=S.gone.slice(-80);
  /* ③ 보고가 도착했는가 */
  const lv=scoutLv(t);
  for(const k of S.send.slice()){
    const tr=S.trip[k]; if(!tr) continue;
    if(day < tr.next) continue;
    const reg=scoutRegion(k);
    tr.n=(tr.n||0)+1;
    tr.next=day+scoutGap(k);
    /* 헛걸음 — 등급이 낮을수록 자주 빈손으로 돌아온다 */
    if(Math.random() < (0.34 - lv*0.045)){
      addNews(`🔎 ${reg.ic} <b>${reg.n}</b> 파견 보고 — 이번 관찰에서는 눈에 띄는 자원을 찾지 못했습니다.`, null, "club");
      continue;
    }
    if(S.list.length>=24){
      addNews(`🔎 ${reg.ic} ${reg.n} — 보고서가 이미 가득 찼습니다(24건). 정리한 뒤에 새 보고가 올라옵니다.`, "warn", "club");
      continue;
    }
    let p=null; try{ p=mkScouted(reg, lv); }catch(e){ p=null; }
    if(!p) continue;
    S.list.push(p);
    const shown=scoutShownOvr(p);
    notify(`🔎 <b>${reg.n} 스카우트 보고</b> — ${p.name} (${POS_KO[p.pos]||p.pos} · ${G.season-p.by}세 · 추정 ${scoutShownDisp(p)})`+
      (p.scJack?` <b style="color:var(--gold)">특급 보고</b>`:``), p.scJack?"good":undefined);
  }
  S.list.sort((a,b)=>b.ovr-a.ovr);
}
/* 예전 이름 — 화면에서 부르던 자리가 여러 곳이라 남겨 둔다(더 이상 목록을 새로 뽑지 않는다) */
function scoutRefresh(){ return scoutState(); }
function scoutedList(){ return scoutState().list; }
/* 보고서 표기 — 등급이 낮으면 실제와 다르게 보인다 */
function scoutShownOvr(p){
  const e=scoutErrNow(p);
  if(!e) return p.ovr;
  /* 흔들림의 방향은 한 번 정해지면 바뀌지 않는다 — 볼 때마다 값이 춤추면 안 된다 */
  if(p._scBias==null) p._scBias=(Math.random()*2-1);
  return clamp(Math.round(p.ovr + p._scBias*e), 45, 92);
}
/* 📏 화면 눈금(90~200)으로 읽는 스카우트 추정치 (요청 — 오버롤 표기 통일).
   참값은 선수 객체에서 정확히 뽑고(dispOvr), 흔들림만 같은 기울기로 옮긴다 —
   내부값을 통째로 환산하면 포지션 가중치가 빠져 실제 프로필 값과 어긋난다. */
function scoutShownDisp(p){
  const e=scoutErrNow(p);
  const base=dispOvr(p);
  if(!e) return base;
  if(p._scBias==null) p._scBias=(Math.random()*2-1);
  return clamp(Math.round(base + p._scBias*e*DISP_K), 90, 200);
}
function scoutTabHtml(){
  const t=userTeam(), wi=windowInfo(), S=scoutState(), lv=scoutLv(t);
  const day=G.day||0;
  const sent=S.send.map(k=>scoutRegion(k));
  const grid=SCOUT_REGIONS.map(r=>{ const on=S.send.indexOf(r.k)>=0;
    const tr=on?S.trip[r.k]:null;
    const left=tr?Math.max(0, tr.next-day):0;
    const span=tr?Math.max(1, tr.next-(tr.n?tr.next-scoutGapEst(r.k):tr.from)):1;
    const prog=tr?clamp(1-left/Math.max(1,span),0,1):0;
    return `<div class="meRow ${on?"on":""}">
      <span class="meIc">${r.ic}</span>
      <span class="meN"><b>${r.n}</b><span class="small"> ${r.d}</span><br>
        <span class="small">주요 국적 ${r.nats.slice(0,3).join("·")} · 이적료 계수 ×${r.feeK} · 이동 ${Math.round(scoutFar(r.k)*100)}%</span>
        ${tr?`<div style="height:6px;background:var(--bg3);border-radius:4px;margin-top:5px;overflow:hidden">
            <div style="height:100%;width:${(prog*100).toFixed(0)}%;background:linear-gradient(90deg,#1f6feb,#58a6ff)"></div></div>
          <span class="small" style="color:var(--sub)">${left>0?`다음 보고까지 <b>${left}일</b>`:`곧 보고가 올라옵니다`} · 지금까지 ${tr.n||0}회 보고</span>`:""}</span>
      <span class="meV">${scoutCostM(r.k)}억<br><span class="small">월 유지비</span></span>
      <button class="mini${on?" sel":""}" onclick="scoutToggle('${r.k}')">${on?"🚚 철수":"파견"}</button></div>`;}).join("");
  const list=cardApply("sc", S.list.slice(),
    {ovr:p=>sortLv(p), age:p=>G.season-p.by, mv:p=>marketValue(p), wage:p=>p.osWage||0, name:p=>p.name});
  const rows=list.map(p=>{
    const fee=marketValue(p), poor=t.budget<fee*0.8, shown=scoutShownDisp(p), err=scoutErrNow(p);
    const watched=Math.max(0, day-(p.scAt||0));
    const leftD=Math.max(0, (p.scUntil||0)-day);
    /* 🆕 정말 새로 올라온 보고서만 — 「이 날짜까지만 새것」을 못박아 둔다.
       예전에는 관찰 일수(day-scAt)로 셌는데, 시즌이 바뀌어 달력이 0으로 되감기면
       그 값이 0이 되어 목록 전체에 NEW 가 붙었다(제보). */
    const isNewSc = day < (p.scNewTil||-1);
    return `<div class="psRow">
      <div class="psMain">
        <div class="psName clickable" onclick="openPlayerMenu(event,${p.id})"><span class="frnN">${p.name}</span>${p.scJack?' <span class="tag" style="background:#d2992233;color:var(--gold)">특급 보고</span>':""}${isNewSc?' <span class="tag" style="background:#1f6feb33;color:#58a6ff">NEW</span>':""}${(()=>{ try{ return slHas(p.id)?' <span class="tag" style="background:#d2992233;color:var(--gold)" title="관심 목록에 있어 목록에서 사라지지 않습니다">⭐ 보관</span>':""; }catch(e){ return ""; } })()}</div>
        <div class="psSub"><span class="pos-${p.pos}">${p.pos}</span> · ${G.season-p.by}세 · ${scoutRegion(p.scReg).ic} ${p.osNat}
          · ${err?`<span title="계속 지켜볼수록 정확해집니다 (26일마다 오차가 줄어듭니다)">추정 ${dispOvrRaw(shown)}±${dispGapRaw(err)}</span>`:`확정 ${dispOvr(p)}`}
          · <span class="small" style="color:var(--sub)" title="관찰 ${watched}일">관찰 ${watched}일${leftD<=21?` · <b style="color:#ff9d5c">타 구단 접촉 임박 ${leftD}일</b>`:""}</span></div>
        ${psPosBadge(p)}
      </div>
      <div class="psVal">이적료 약 <b class="money">${fee}억</b><br><span class="small">요구 연봉 ${p.osWage}억</span></div>
      <div class="psAct">${slStarBtn(p.id)}${!wi.open?`<span class="tag inj">시장 닫힘</span>`
        :poor?`<span class="tag inj">예산 부족</span>`
        :`<button class="mini" onclick="startOverseasNego(${p.id})">✍️ 영입 시도</button>`}</div>
    </div>`;}).join("");
  const nextIn=S.send.map(k=>S.trip[k]).filter(Boolean).map(x=>Math.max(0,x.next-day)).sort((a,b)=>a-b)[0];
  return `<div class="card"><h3>🔎 스카우팅 망 <span class="small">— ${lv}등급 · 동시 파견 ${S.send.length}/${lv}곳 · 월 유지비 ${scoutBill()}억</span></h3>
    <p class="small" style="margin-bottom:8px">스카우트는 <b>보내 놓고 기다리는</b> 일입니다. 파견을 걸면 첫 보고까지 <b>${SCOUT_LEAD[clamp(lv,1,5)]}일 안팎</b>(지역 거리에 따라 달라집니다),
      그다음부터는 <b>${SCOUT_GAP[clamp(lv,1,5)]}일 간격</b>으로 한 건씩 올라오고 빈손으로 돌아오는 날도 있습니다.
      등급이 낮으면 보고서의 능력치 자체가 부정확합니다(±${Math.max(0,7-lv)}) — <b>계속 지켜보면 정확해집니다</b>.
      등급은 <b>🏦 재정 → 예산 증액 요청</b>의 <b>스카우팅 망 투자</b> 안건으로 올립니다.</p>
    ${grid}
    ${S.send.length?(nextIn!=null?`<p class="small" style="margin-top:8px;color:var(--sub)">⏳ 가장 이른 다음 보고까지 <b>${nextIn}일</b> — 날짜를 진행하면 도착합니다.</p>`:"")
      :`<div class="msg warn" style="margin-top:8px">파견 지역을 한 곳도 고르지 않았습니다. 보고서가 올라오지 않습니다.</div>`}
  </div>
  <div class="card"><h3>📋 스카우트 보고서 <span class="small">— 지역을 바꿔도 이미 올라온 보고서는 사라지지 않습니다</span></h3>
    ${!S.list.length?`<p class="small">아직 올라온 보고서가 없습니다. 파견을 걸고 날짜를 진행해 보세요.</p>`
     :`<div class="psCount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b>${S.list.length}명</b>
        <span style="opacity:.7">· ${sent.length?sent.map(r=>r.ic+r.n).join(" · "):"파견 없음"}</span>${cardSortBox("sc")}</div>
       ${wi.open?"":`<div class="msg warn" style="margin:6px 0">이적시장이 닫혀 있어 지금은 영입할 수 없습니다 — 보고서는 그대로 유지됩니다.</div>`}
       ${rows}`}
  </div>`;
}
function transfer(){
  const t=userTeam();
  const wi=windowInfo();
  const tabBtn=(k,l)=>`<button class="mini ${tfTab===k?'sel':''}" style="padding:8px 18px;font-size:14px" onclick="tfTab='${k}';show('transfer')">${l}</button>`;
  let body="";
  if(armyUserClub() && tfTab!=="rumor" && tfTab!=="staff") tfTab="army";     // 상무는 검색·FA·해외 탭이 없다 (스태프는 상무도 뽑는다)
  if(tfTab==="army"){
    body=armyTab();
  } else if(tfTab==="scout"){
    body=scoutTabHtml();
  } else if(tfTab==="search"){
    body=`<div class="card"><h3>🔍 선수 검색 · 영입
      <span class="small">예산 <b class="money">${t.budget}억</b> · 이름 일부나 초성(ㅅㅇㅁ)으로도 찾을 수 있습니다</span></h3>
      ${psSearchBox()}
      <div id="psList">${psResults()}</div>
      <p class="small" style="margin-top:8px;opacity:.85">🔁 임대로 빌려오려면 좌측 <b>🔁 임대 센터</b>에서 진행하세요 — 임대가 성립하는 선수만 모아서 보여 줍니다.
        <button class="mini" style="margin-left:6px" onclick="lcTab='in';show('loancenter')">🔁 임대 센터 열기</button></p></div>`;
  } else if(tfTab==="short"){
    body=shortlistTab();
  } else if(tfTab==="log"){
    body=tfLogView();
  } else if(tfTab==="rumor"){
    body=rumorTab();
  } else if(tfTab==="fa"){
    body=faTabHtml();
  } else if(tfTab==="world"){
    body=osTabHtml();
  } else if(tfTab==="staff"){
    body=acTabHtml();
  }
  const _wTot=wi.weeks||6, _wLeft=Math.max(0, wi.left||0);
  const _wLeftTxt = _wLeft<=0 ? `<b style="color:var(--gold)">오늘이 마지막 날</b>입니다`
                  : _wLeft<=14 ? `마감까지 <b>${_wLeft}일</b>`
                  :              `마감까지 <b>${Math.ceil(_wLeft/7)}주</b> <span style="opacity:.75">(${_wLeft}일)</span>`;
  const _wEndTxt=(()=>{ try{ const d=dateOfDay(wi.end); return `${d.getMonth()+1}월 ${d.getDate()}일 마감`; }catch(e){ return ""; } })();
  return `<h2>💸 이적시장 ${wi.open?`<span class="tag" style="background:#3fb95033;color:#3fb950">${wi.name} 이적시장 ${Math.min(wi.week,_wTot)}/${_wTot}주차</span>`:'<span class="tag inj">닫힘</span>'}</h2>
  ${wi.open?`<div class="msg info">📅 ${wi.name} 이적시장 <b>${Math.min(wi.week,_wTot)}주차 / ${_wTot}주</b> — ${_wLeftTxt}${_wEndTxt?` · ${_wEndTxt}`:""}</div>`
           :`<div class="msg warn">${wi.label||"이적시장은 겨울(1월 1일~3월 31일)과 여름(7월 1일부터 6주간) 두 번 열립니다."}</div>`}
  ${(G.nego||G.snego||G.acNego)?`<div class="msg good">🤝 진행 중인 협상이 있습니다 — 좌측 <b>협상</b> 탭에서 계속하세요.</div>`:""}
  ${(G.offers||[]).length?`<div class="msg good">📨 처리 대기 중인 타 구단 제의 <b>${G.offers.length}건</b> — <b>타 구단 제의</b> 탭에서 확인하세요.</div>`:""}
  <div style="margin-bottom:12px">${armyUserClub()
    ? tabBtn("army","🎖️ 입대 지원")+" "+tabBtn("rumor","📰 루머")+" "+tabBtn("staff","🎩 스태프")
    : tabBtn("search","🔍 선수 검색")+" "+tabBtn("short","⭐ 관심 목록"+(slSweep().length?` (${slSweep().length})`:""))+" "+tabBtn("fa","🆓 FA 시장")+" "+tabBtn("world","🌍 해외 이적시장")+" "+tabBtn("scout","🔎 스카우트"+((scoutState().list||[]).length?` (${scoutState().list.length})`:""))+" "+tabBtn("rumor","📰 루머"+((rumorList().filter(r=>r.fromId===t.id||r.toId===t.id).length)?" 🔴":""))+" "+tabBtn("log","📒 영입·방출 기록")+" "+tabBtn("staff","🎩 스태프"+(acOf()?"":" 🔴"))}</div>
  ${body}`;
}
/* ═══ 🎩 이적시장 · 스태프 탭 ═══════════════════════════════════
   ⚠ 요청 원문 — 「수석코치는 이적시장 기한에도 영향 안받고, 영입할 수 있고.
   이적시장에서 스태프 탭을 만들어서 거기서 검색하고 영입할수 있게하면 되겠네.」
   그래서 이 탭은 windowInfo().open 을 한 번도 보지 않는다. 시장이 닫혀 있어도 그대로 돈다.
   실제로도 스태프 계약은 선수 등록 기간과 무관하다. */
let acFilt={q:"", tr:"", rk:"", sort:"ovr"};
const AC_PER=12;                 // 시장이 커졌으니 한 페이지씩 끊어 보여 준다
let acPg=1;
function acGo(n){ acPg=Math.max(1,n|0); acBack(); try{ window.scrollTo(0,0); }catch(e){} }
function acSetFilt(k,v){
  acFilt[k]=v;
  /* ⚠ 제보 — 「직책 검색하면 0명으로 나온다」.
     성향(수석코치 전용) 칩을 한 번 누른 뒤 다른 직책으로 넘어가면 tr 이 그대로 남는데,
     성향 줄은 수석코치일 때만 그려지니 「왜 0인지 보이지도 않는」 상태가 됐다.
     일반 스태프는 trait 이 아예 없어 무조건 0명이 된다 — 직책을 바꾸면 성향을 푼다. */
  if(k==="rk" && v!=="ac") acFilt.tr="";
  acPg=1;
  acBack();
}
function acFiltClear(){ acFilt.q=""; acFilt.rk=""; acFilt.tr=""; acPg=1; acBack(); }
/* ⌨️ 타이핑마다 화면을 통째로 다시 그리면 입력 포커스가 날아간다 — 선수 검색과 같이
   짧게 묶어 두었다가 목록만 갈아 끼운다. */
let _acQT=null;
function acQInput(v){
  acFilt.q=v;
  try{ const b=document.querySelector("#acQ")&&document.querySelector("#acQ").parentNode.querySelector(".psClr");
       if(b) b.style.display=v?"":"none"; }catch(e){}
  clearTimeout(_acQT);
  _acQT=setTimeout(()=>{
    try{
      const host=document.getElementById("acList");
      if(!host){ acBack(); return; }
      acPg=1;
      const t=userTeam(), L=acFiltered();
      host.innerHTML = acListHtml(L, t);
      const cEl=document.getElementById("acCount"); if(cEl) cEl.textContent=L.length+"명";
    }catch(e){ acBack(); }
  }, 180);
}
/* 🎩 FM 식 스태프 능력치 표 */
(function(){ try{
  const st=document.createElement("style");
  st.textContent=`
  .saWrap{display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px 18px; margin:6px 0 2px;}
  .saGrp{min-width:0;}
  .saGh{font-size:11px; color:var(--sub); letter-spacing:.3px; margin:0 0 3px; padding-bottom:2px; border-bottom:1px solid #21262d;}
  .saRow{display:flex; align-items:center; justify-content:space-between; gap:8px; padding:1.5px 0; font-size:12.5px;}
  .saRow[data-on="1"]{background:linear-gradient(90deg,#12301c22,transparent); border-radius:3px; padding-left:3px;}
  .saN{color:var(--sub); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
  .saV{font-variant-numeric:tabular-nums; font-weight:800;}
  @media (max-width:560px){ .saWrap{grid-template-columns:1fr 1fr; gap:8px 12px;} .saRow{font-size:11.5px;} }`;
  document.head.appendChild(st);
}catch(e){} })();
function acBar(v, est){
  const w=clamp((v-5)/15*100, 4, 100);
  const c = v>=18?"#f0883e" : v>=16?"#3fb950" : v>=14?"#56d364" : v>=12?"#d29922" : "#f85149";
  return `<span class="small" style="display:inline-flex;align-items:center;gap:5px">
    <span style="display:inline-block;width:52px;height:6px;background:#21262d;border-radius:3px;overflow:hidden">
      <span style="display:block;width:${w}%;height:100%;background:${c}"></span></span>
    <b style="color:${c}">${est?"≈":""}${v}</b></span>`;
}
/* 능력치 줄 — ⚠ 「데이터」「경기 판단」「의욕 고취」가 좁은 칸에서 두 줄로 깨졌다.
   칸을 넓히고 이름은 한 줄로 고정한다. */
function acAttrGrid(c){
  return saGrid(c);
}
/* 🎩 FM 식 능력치 표 — 24개를 그룹별로 전부 띄우고, 그 직책이 실제로 보는 항목만
   초록으로 세운다 (요청 — FM 스태프 상황판의 그 표시). */
function saEst(c, k){
  try{
    if(!c) return 10;
    const v=sa(c,k);
    if(c.hired) return v;
    const h=uidHash(String(c.id)+"|sa|"+k);
    const e=acErrMax();
    return clamp(v + ((h%(e*2+1))-e), 1, 20);
  }catch(e){ return 10; }
}
function saGrid(c){
  const core=new Set(acRoleSA(c));
  const est=!c.hired;
  const row=(k)=>{
    const v=saEst(c,k), on=core.has(k);
    const col = on ? (v>=16?"#3fb950":v>=13?"#56d364":v>=10?"#d29922":"#f85149")
                   : (v>=16?"#8b949e":"#6e7681");
    return `<div class="saRow"${on?' data-on="1"':""}>
      <span class="saN"${on?' style="color:#e6edf3"':""}>${SA_LABEL[k]||k}</span>
      <b class="saV" style="color:${col}">${est?"≈":""}${v}</b></div>`;
  };
  return `<div class="saWrap">${SA_GRP.map(g=>`<div class="saGrp">
    <div class="saGh">${g.ic} ${g.n}</div>
    ${g.keys.map(row).join("")}</div>`).join("")}</div>
    <div class="small" style="opacity:.6;margin-top:4px">초록으로 표시된 항목이 <b>${acRole(c).n}</b> 자리에서 실제로 쓰이는 능력입니다.</div>`;
}
/* 시장 카드 — 아직 우리 사람이 아니다. 능력치는 추정치(≈)로만 보인다. */
function acCard(c, t){
  const R=acRole(c);
  const isAc=(c.role||"ac")==="ac";
  const TR=isAc?(AC_TRAIT[c.trait]||AC_TRAIT.bal):null;
  const o=acEstOvr(c), gr=acGrade(o);
  const cur0=((c.role||"ac")==="ac")?acOf():null;
  const room=acRoom(t)+(cur0?cur0.wage:0), afford=c.wage<=Math.max(room,0)+0.001;
  const full = isAc ? false : (roleFull(c.role) || crewCount()>=crewCap(t));
  const cur=isAc?acOf():null;
  return `<div class="stItem" style="margin-bottom:8px">
    <div class="stHead" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
      <span class="tag" style="background:#30363d">${R.ic} ${R.n}</span>
      <b style="font-size:15px">${c.n}</b>
      ${TR?`<span class="small">${TR.ic} ${TR.n}</span>`:""}
      <span class="small">${c.age}세 · ${c.career}</span>
      <span style="margin-left:auto" class="small">종합 <b style="color:${gr[1]}">≈${o}</b>/20 <span style="color:${gr[1]}">${gr[0]}</span>
        · 요구 연봉 <b class="money">${c.wage}억</b></span>
    </div>
    <div class="stSay small" style="opacity:.9">${TR?TR.d:R.d}</div>
    ${acAttrGrid(c)}
    ${(c.role||"ac")!=="ac" ? acRoleEffect(c) : ""}
    <div class="acBtns">
      ${!afford ? `<span class="tag inj">연봉 여력 부족 (여유 ${room}억)</span>`
        : full  ? `<span class="tag inj">${roleFull(c.role)?`${R.n} 정원 ${R.cap}명 참`:`스태프 정원 ${crewCount()}/${crewCap(t)} 참`}</span>`
        : (function(){ const bl=acBlockLeft(c.uid);
            if(bl>0) return `<span class="tag inj">협상 결렬 — ${bl}일 뒤 재접촉</span>`;
            if(G.acNego) return (G.acNego.id===c.id)
              ? `<button class="mini" onclick="show('nego')">🤝 협상 진행 중 — 테이블로</button>`
              : `<span class="tag inj">다른 협상 진행 중</span>`;
            return `<button class="mini" onclick="acNegoStart('${c.id}')">🤝 ${cur?"교체 영입 협상":"영입 협상"} — 요구 연 ${c.wage}억</button>`; })()}
    </div></div>`;
}
function acFiltered(){
  let L=acPool().slice();
  const q=(acFilt.q||"").trim();
  if(acFilt.rk) L=L.filter(c=>c.role===acFilt.rk);
  if(q) L=L.filter(c=>c.n.indexOf(q)>=0 || acRole(c).n.indexOf(q)>=0 || String(c.career||"").indexOf(q)>=0
                      || (c.trait && AC_TRAIT[c.trait] && AC_TRAIT[c.trait].n.indexOf(q)>=0));
  if(acFilt.tr) L=L.filter(c=>c.trait===acFilt.tr);
  if(acFilt.sort==="wage") L.sort((a,b)=>a.wage-b.wage);
  else if(acFilt.sort==="age") L.sort((a,b)=>a.age-b.age);
  else if(acFilt.sort==="role") L.sort((a,b)=>AC_ROLE_ORDER.indexOf(a.role)-AC_ROLE_ORDER.indexOf(b.role) || acEstOvr(b)-acEstOvr(a));
  else L.sort((a,b)=>acEstOvr(b)-acEstOvr(a));
  return L;
}
/* ── 우리 사람 한 줄 ─────────────────────────────────────────── */
function acMineRow(c, t){
  const R=acRole(c), isAc=(c.role||"ac")==="ac";
  const TR=isAc?(AC_TRAIT[c.trait]||AC_TRAIT.bal):null;
  const o=acOvr(c), gr=acGrade(o);
  const open=(G.staff&&G.staff.acOpen)===c.id;
  return `<div class="stItem" style="margin-bottom:6px">
    <div class="stHead" style="display:flex;flex-wrap:wrap;align-items:center;gap:7px">
      <span class="tag" style="background:#30363d">${R.ic} ${R.n}</span>
      <b>${c.n}</b>
      <span class="small">${c.age}세${TR?` · ${TR.ic} ${TR.n}`:""} · 계약 ${Math.max(0,c.ct||0)}년 · 연 <b class="money">${c.wage}억</b></span>
      ${R.slot?`<span class="small" style="margin-left:4px">담당
        <select onchange="acAssign('${c.id}',this.value)" style="padding:2px 5px">
          <option value=""${!c.assign?" selected":""}>— 미배정 —</option>
          ${AC_SLOT.map(s=>`<option value="${s.k}"${c.assign===s.k?" selected":""}>${s.ic} ${s.n}</option>`).join("")}
        </select></span>`:`<span class="small" style="opacity:.7">상시 적용</span>`}
      <span style="margin-left:auto" class="small">종합 <b style="color:${gr[1]}">${o}</b>/20</span>
      <button class="mini ${open?"sel":""}" style="padding:2px 9px" onclick="acToggle('${c.id}')">${open?"▲":"▾"}</button>
    </div>
    ${open?`${acAttrGrid(c)}
      ${isAc?acEffectRow(c):`<div class="small" style="opacity:.85;padding:2px 0">${R.d}</div>${acRoleEffect(c)}`}
      <div class="acBtns" style="margin-top:5px">
        <button class="mini" onclick="acFire('${c.id}')">🚪 계약 해지 (위약금 ${acFireFee(c.id)}억)</button></div>`:""}
  </div>`;
}
function acToggle(id){
  G.staff=G.staff||{};
  G.staff.acOpen = (G.staff.acOpen===id) ? null : id;
  acBack();
}
/* ── 훈련 주제 칸 — ⚠ 선택: 「훈련 주제 칸에 코치를 넣기」 ──────
   일곱 칸을 먼저 보여 주고, 칸마다 코치를 골라 넣는다. 빈 칸이 한눈에 보인다.
   한 사람은 한 칸만 채울 수 있다 — 다른 칸에 넣으면 이전 칸에서 자동으로 빠진다. */
function acSlotBoard(todayK){
  const free=crew().filter(c=>acRole(c).slot);
  if(!free.length) return `<p class="small" style="opacity:.8">훈련 칸에 넣을 코치가 없습니다 —
    <b>💸 이적시장 → 🎩 스태프</b> 탭에서 <b>♟️ 코치</b>나 <b>💪 체력 코치</b>를 영입하세요.</p>`;
  const cell=(s)=>{
    const on=slotStaff(s.k);
    const opts=free.filter(c=>!c.assign || c.assign===s.k);
    const hot=(todayK===s.k);
    return `<div style="padding:7px 9px;background:${hot?"#12281a":"#0d1117"};border:1px solid ${hot?"var(--green)":(on.length?"#30363d":"#21262d")};border-radius:7px">
      <div class="small" style="margin-bottom:4px"><b>${s.ic} ${s.n}</b>${hot?' <span class="tag" style="background:#3fb95033;color:#3fb950;padding:0 5px">오늘</span>':""}</div>
      ${on.map(c=>`<div class="small" style="line-height:1.7">· <b>${c.n}</b>
        <span style="opacity:.7">${acRole(c).ic} 종합 ${acOvr(c)}</span>
        <button class="mini" style="padding:0 6px;margin-left:4px" onclick="acUnassign('${c.id}')">✕</button></div>`).join("")
        || `<div class="small" style="opacity:.55">비어 있음</div>`}
      <select onchange="if(this.value)acAssign(this.value,'${s.k}')" style="margin-top:5px;padding:2px 5px;width:100%;font-size:12px">
        <option value="">＋ 코치 넣기</option>
        ${opts.filter(c=>c.assign!==s.k).map(c=>`<option value="${c.id}">${acRole(c).ic} ${c.n} (종합 ${acOvr(c)})</option>`).join("")}
      </select></div>`;
  };
  const idle=free.filter(c=>!c.assign);
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:7px">
    ${AC_SLOT.map(cell).join("")}</div>
    ${idle.length?`<div class="msg warn" style="margin:8px 0 0">🪑 배정되지 않은 코치 <b>${idle.length}명</b> —
      ${idle.map(c=>c.n).join(", ")}. 칸에 넣어야 훈련에 붙습니다.</div>`:""}`;
}
/* 🗂️ 훈련 배정 카드 — ⚠ 지적 원문 「훈련 배정은 이적시장 스태프 탭에 있을 게 아니라
   일정 및 훈련 메뉴에 있어야 맞지 않을까?」 맞다. 그날의 훈련 주제를 고르는 자리 바로 옆이라야
   「오늘 공격 훈련인데 그 칸이 비어 있다」가 한눈에 보인다. */
/* ═══ 🤖 훈련 자동 배치 ═══════════════════════════════════════
   ⚠ 요청 원문 — 「[스태프탭 열기] 이거 말고 자동배치 이거 넣자.
   훈련 배정을 능력치와 역할대로 자동으로 배정하는거지.」

   두 가지를 같이 본다.
     ① 궁합 — 그 칸이 요구하는 능력치(AC_SLOT.key)와 훈련 능력을 반반 섞는다.
        체력 코치는 💪 체력 훈련이 제 자리다. 일반 코치를 거기 넣으면 체력 지도 능력이 아예 없다.
     ② 쓰임 — 앞으로 2주 동안 실제로 며칠이나 그 주제로 훈련하는가.
        일주일에 한 번도 안 하는 칸에 최고 코치를 넣어 두면 아무 일도 안 일어난다. */
function acSlotUse(){
  const use={};
  for(const s of AC_SLOT) use[s.k]=0;
  try{
    const d0=G.day||0;
    for(let i=0;i<14;i++){
      const pl=dayPlan(d0+i);
      if(pl && pl.t==="train"){ const k=pl.f||"bal"; if(use[k]!=null) use[k]++; }
    }
  }catch(e){}
  return use;
}
/* 이 코치가 이 칸에 얼마나 맞는가 */
function acSlotFit(c, s){
  const key=s.key;
  const v=(typeof c[key]==="number") ? c[key] : null;
  /* 담당 능력치를 훈련 능력보다 무겁게 둔다 — 안 그러면 「훈련 19 만능 코치」가
     모든 칸에서 특화 코치를 밀어내고, 공격 코치를 뽑은 의미가 사라진다. */
  let sc=(c.trn||10)*0.35 + (v!=null ? v*0.65 : ((c.mot||10)*0.30 + (c.trn||10)*0.35));
  /* 💪 체력 코치는 체력 훈련이 제 자리다 — 다른 칸에 넣으면 전문성이 죽는다 */
  if(c.role==="fit") sc += (s.k==="phy") ? 7 : -4;
  else if(s.k==="phy") sc -= 2.5;               // 일반 코치는 체력 지도 능력이 없다
  return sc;
}
function acAutoAssign(){
  acEnsure();
  const free=crew().filter(c=>acRole(c).slot);
  if(!free.length){ try{ flash("훈련 칸에 넣을 코치가 없습니다 — 💸 이적시장 → 🎩 스태프에서 영입하세요.","warn"); }catch(e){} return; }
  const use=acSlotUse();
  /* 모든 (코치 × 칸) 짝을 점수로 매겨 좋은 것부터 채운다 */
  /* ⚠ 일정을 점수에 「더하면」 능력치 차이(2~5점)를 통째로 삼킨다.
     곱으로 걸어 둔다 — 안 하는 훈련의 칸은 0.6배, 매일 하는 칸은 1.0배. */
  const wOf=(k)=>0.6 + 0.04*Math.min(10, use[k]||0);
  const pairs=[];
  for(const c of free) for(const s of AC_SLOT)
    pairs.push({c, s, v: acSlotFit(c,s) * wOf(s.k)});
  pairs.sort((a,b)=>b.v-a.v);
  const usedC=new Set(), usedS=new Set();
  for(const c of free) c.assign=null;
  for(const pr of pairs){
    if(usedC.has(pr.c.id) || usedS.has(pr.s.k)) continue;
    pr.c.assign=pr.s.k; usedC.add(pr.c.id); usedS.add(pr.s.k);
  }
  /* 코치가 칸보다 많으면 남는 사람은 「제일 자주 하는 훈련」에 겹쳐 붙인다 */
  const left=free.filter(c=>!c.assign);
  if(left.length){
    const order=AC_SLOT.slice().sort((a,b)=>(use[b.k]||0)-(use[a.k]||0));
    let i=0;
    for(const c of left){ c.assign=order[i%order.length].k; i++; }
  }
  try{ saveGame(); }catch(e){}
  const sum=free.slice().sort((a,b)=>AC_SLOT.findIndex(x=>x.k===a.assign)-AC_SLOT.findIndex(x=>x.k===b.assign))
    .map(c=>`${c.n}→${AC_SLOT_BY[c.assign]?AC_SLOT_BY[c.assign].n:"-"}`).join(" · ");
  const hot=AC_SLOT.filter(s=>(use[s.k]||0)>0).sort((a,b)=>(use[b.k]||0)-(use[a.k]||0)).slice(0,2);
  try{ flash(`🤖 코치 ${free.length}명을 배치했습니다.<br><span class="small">${sum}`
    + (hot.length?`<br>📅 앞으로 2주 훈련: ${hot.map(s=>`${s.ic} ${s.n} ${use[s.k]}일`).join(" · ")} — 자주 하는 칸을 먼저 채웠습니다.`:"")
    + `</span>`,"good"); }catch(e){}
  try{ staffLog(`훈련 배정을 자동으로 맞췄습니다. (${sum})`); }catch(e){}
  try{ ftTab="train"; }catch(e){}
  acBack();
}
function acSlotCard(){
  try{
    acEnsure();
    const t=userTeam(); if(!t) return "";
    /* 오늘 어떤 주제로 훈련하는지 — 달력·주간 루틴·자동 규칙을 전부 거친 실제 계획을 본다 */
    const pl=(function(){ try{ return dayPlan(G.day||0); }catch(e){ return null; } })();
    const todayK=(pl && pl.t==="train") ? (pl.f||"bal") : null;
    return `<div class="card"><h3>🗂️ 훈련 배정
      <span class="small">— 칸마다 코치를 넣습니다. 그 주제로 훈련하는 날 그 코치가 붙습니다</span></h3>
      ${acSlotBoard(todayK)}
      <div style="margin-top:9px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="mini" onclick="acAutoAssign()">🤖 자동 배치</button>
        <span class="small" style="opacity:.78">능력치와 <b>앞으로 2주 훈련 일정</b>을 함께 보고 칸을 채웁니다 —
          자주 하는 훈련에 좋은 코치가 갑니다.</span>
      </div>
    </div>`;
  }catch(e){ return ""; }
}
/* 목록 본문 — 화면을 통째로 다시 그릴 때도, 검색어만 바뀌어 갈아 끼울 때도 이걸 쓴다.
   시장이 커졌으므로 한 페이지씩 끊는다. */
function acListHtml(L, t){
  t=t||userTeam();
  if(!L.length) return `<div class="msg warn" style="margin:10px 0">
    조건에 맞는 스태프가 없습니다.${acWhyEmpty()}
    <button class="mini" style="margin-left:6px" onclick="acFiltClear()">✕ 조건 해제</button></div>`;
  const last=Math.max(1, Math.ceil(L.length/AC_PER));
  const pg=acPg=clamp(acPg,1,last);
  const from=(pg-1)*AC_PER;
  const body=L.slice(from, from+AC_PER).map(c=>acCard(c,t)).join("");
  const pager=(typeof psPager==="function") ? psPager(L.length, pg, "acGo", AC_PER) : "";
  return body + (pager?`<div style="margin-top:8px">${pager}</div>
    <p class="small" style="opacity:.7;margin-top:4px">${from+1}~${Math.min(from+AC_PER, L.length)}번째 · 전체 ${L.length}명</p>`:"");
}
/* 왜 한 명도 안 나오는가 — 조건을 되짚어 준다. 「0명」만 띄우면 버그로 보인다. */
function acWhyEmpty(){
  const bits=[];
  if(acFilt.rk && AC_ROLE[acFilt.rk]) bits.push(`직책 <b>${AC_ROLE[acFilt.rk].n}</b>`);
  if(acFilt.tr && AC_TRAIT[acFilt.tr]) bits.push(`성향 <b>${AC_TRAIT[acFilt.tr].n}</b><span class="small">(수석코치에게만 있습니다)</span>`);
  if(acFilt.q) bits.push(`검색어 <b>"${String(acFilt.q).replace(/</g,"&lt;")}"</b>`);
  return bits.length ? ` <span class="small" style="opacity:.85">— ${bits.join(" · ")} 조건입니다.</span>` : "";
}
/* 🎩 우리 코치진 카드 — ⚠ 지적 원문 「지금 이적시장의 스태프 탭에 우리 코치진이 있잖아.
   이걸 스태프 회의로 옮기자.」 맞다. 이적시장은 「데려오는 곳」이고,
   지금 데리고 있는 사람들을 살피는 자리는 스태프 회의다. */
function acCrewCard(){
  try{
    acEnsure();
    const t=userTeam(); if(!t) return "";
    const C=crew();
    const cap=crewCap(t), cnt=crewCount();
    const mine=C.slice().sort((a,b)=>AC_ROLE_ORDER.indexOf(a.role)-AC_ROLE_ORDER.indexOf(b.role));
    const tally=AC_ROLE_ORDER.map(k=>{
      const have=crewOf(k).length, R=AC_ROLE[k];
      const ok=have>0;
      return `<span class="small" style="opacity:${ok?1:.55};color:${ok?"var(--txt)":"var(--red)"}">${R.ic} ${R.n} <b>${have}/${R.cap}</b></span>`;
    }).join(' <span style="opacity:.3">·</span> ');
    const idle=C.filter(c=>acRole(c).slot && !c.assign);
    return `<div class="card"><h3>🎩 우리 코치진
        <span class="small">— 스태프 <b>${cnt}/${cap}명</b> (수석코치 제외) · 총 연봉 <b class="money">${acWageBill()}억</b> · 월 ${Math.round(acWageBill()/12*100)/100}억</span></h3>
      <div style="margin-bottom:8px;line-height:2">${tally}</div>
      <p class="small" style="margin:-2px 0 10px;opacity:.8">정원은 <b>훈련시설 등급</b>이 정합니다 (현재 ${trainLv(t)}등급 → ${cap}명).
        시설을 올리면 사단을 더 크게 꾸릴 수 있습니다.</p>
      ${mine.length?mine.map(c=>acMineRow(c,t)).join(""):`<div class="msg warn">코치진이 통째로 비어 있습니다.</div>`}
      ${idle.length?`<div class="msg warn" style="margin:8px 0 0">🗂️ 훈련 칸에 안 들어간 코치 <b>${idle.length}명</b> — ${idle.map(c=>c.n).join(", ")}.
        <button class="mini" style="margin-left:6px" onclick="ftShow('train')">🏋️ 훈련 탭에서 배정하기</button></div>`:""}
    </div>`;
  }catch(e){ return ""; }
}
function acTabHtml(){
  const t=userTeam();
  acEnsure();
  const cnt=crewCount(), cap=crewCap(t);
  const L=acFiltered();
  /* 🔍 ⚠ 요청 — 「스태프 검색창도 선수 검색창처럼 스타일 있게 해줘」.
     밋밋한 <select> 세 개 대신 선수 검색과 같은 부품(psField·psChip)을 그대로 쓴다.
     한 번에 몇 명이 걸리는지도 칩 위에 띄워 준다 — 눌러 보기 전에 알 수 있게. */
  const nFor=(f)=>{
    try{ const s0=JSON.stringify(acFilt); Object.assign(acFilt, f);
      const n=acFiltered().length; Object.assign(acFilt, JSON.parse(s0)); return n; }catch(e){ return 0; }
  };
  const rkChip=(k)=>{
    const on=acFilt.rk===k, R=k?AC_ROLE[k]:null, n=nFor({rk:k});
    return `<button class="psChip ${on?"on":""}" onclick="acSetFilt('rk','${k}')" ${!n&&!on?'style="opacity:.42"':""}>
      ${R?`${R.ic} ${R.n}`:"전체"}<span style="opacity:.6;font-weight:600"> ${n}</span></button>`;
  };
  const trChip=(k)=>{
    const on=acFilt.tr===k, T=k?AC_TRAIT[k]:null, n=nFor({tr:k});
    return `<button class="psChip ${on?"on":""}" onclick="acSetFilt('tr','${k}')" ${!n&&!on?'style="opacity:.42"':""}>
      ${T?`${T.ic} ${T.n}`:"전체"}<span style="opacity:.6;font-weight:600"> ${n}</span></button>`;
  };
  const srChip=(k,n)=>`<button class="psChip ${acFilt.sort===k?"on":""}" onclick="acSetFilt('sort','${k}')">${n}</button>`;
  const acOnly=(acFilt.rk==="ac");
  const anyF=!!(acFilt.q||acFilt.rk||acFilt.tr);
  const searchBox=`<div class="psWrap" style="position:static;padding:0 0 4px;margin:0 0 8px">
    <div class="psBar">
      <div class="psField">
        <span class="psIcon">🔍</span>
        <input id="acQ" class="psInput" type="text" inputmode="search" enterkeyhint="search"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          placeholder="이름 · 직책 · 경력으로 검색"
          value="${(acFilt.q||"").replace(/"/g,"&quot;")}"
          oninput="acQInput(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
        <button class="psClr" style="${acFilt.q?"":"display:none"}" onclick="acSetFilt('q','')">✕</button>
      </div>
      <span class="small" style="white-space:nowrap;opacity:.85">여력 <b class="money">${acRoom(t)}억</b></span>
    </div>
    <div class="psChips">${rkChip("")}${AC_ROLE_ORDER.map(rkChip).join("")}</div>
    ${acOnly?`<div class="psChips">
      <span class="small" style="opacity:.8;align-self:center;margin-right:2px">🎭 성향</span>
      ${trChip("")}${Object.keys(AC_TRAIT).map(trChip).join("")}</div>`:""}
    <div class="psChips">
      <span class="small" style="opacity:.8;align-self:center;margin-right:2px">↕️ 정렬</span>
      ${srChip("ovr","종합순")}${srChip("role","직책순")}${srChip("wage","연봉 낮은 순")}${srChip("age","나이 어린 순")}
      ${anyF?`<button class="psChip" style="border-color:var(--gold);color:var(--gold);margin-left:4px" onclick="acFiltClear()">✕ 조건 해제</button>`:""}
    </div>
  </div>`;
  /* 직책별 현황 한 줄 */
  const tally=AC_ROLE_ORDER.map(k=>{
    const have=crewOf(k).length, R=AC_ROLE[k];
    const ok=have>0;
    return `<span class="small" style="opacity:${ok?1:.55};color:${ok?"var(--txt)":"var(--red)"}">${R.ic} ${R.n} <b>${have}/${R.cap}</b></span>`;
  }).join(' <span style="opacity:.3">·</span> ');
  return `<div class="msg info" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <span>🎩 지금 코치진 <b>${cnt}/${cap}명</b> · 총 연봉 <b class="money">${acWageBill()}억</b> · 남은 여력 <b class="money">${acRoom(t)}억</b>
      ${AC_ROLE_ORDER.filter(k=>!crewOf(k).length).length
        ? `<span style="color:var(--red)">· 빈 자리 ${AC_ROLE_ORDER.filter(k=>!crewOf(k).length).map(k=>AC_ROLE[k].ic+AC_ROLE[k].n).join(" ")}</span>`
        : `<span style="color:var(--green)">· 모든 직책이 채워져 있습니다</span>`}</span>
    <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
      <button class="mini" onclick="show('staff')">📋 스태프 회의에서 관리</button>
      <button class="mini" onclick="ftShow('train')">🗂️ 훈련 배정</button></span>
  </div>
  <div class="card"><h3>🎩 무직 스태프 <span class="small">— 이적시장 기한과 무관하게 언제든 계약할 수 있습니다</span></h3>
    ${searchBox}
    <div class="psCount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <b id="acCount">${L.length}명</b>
      <span style="opacity:.7">/ 시장 전체 ${acPool().length}명 · 능력치는 <b>추정치(≈)</b> — 오차 ±${acErrMax()} · 스카우팅 ${scoutLv(t)}등급</span>
    </div>
    <div id="acList">${acListHtml(L, t)}</div>
  </div>`;
}
/* ── 한 해가 지난다 ────────────────────────────────────────────
   젊은 코치는 배우고, 쉰을 넘기면 하나씩 놓치기 시작한다.
   다만 「경기판단」은 늦게까지 는다 — 눈은 마지막까지 남는 능력이다.
   한 시즌에 한 항목만 움직인다(빠르면 5년 만에 사람이 바뀌어 버린다). */
function acAgeOne(c){
  if(!c) return;
  c.age=(c.age|0)+1;
  const a=c.age;
  const up = a<=44 ? 0.55 : a<=52 ? 0.28 : 0.10;
  const dn = a<=48 ? 0.05 : a<=56 ? 0.18 : 0.34;
  /* 배우는 시기와 무너지는 시기에는 두 항목이 함께 움직인다 — 한 항목만 굴리면
     10년이 지나도 사람이 그대로라 코치를 키우는 재미가 없다. */
  const nk = a<=44 ? 3 : a>=55 ? 2 : 1;
  /* 🎩 이제 FM 능력치가 진짜 데이터다 — 그쪽을 굴리고 옛 키는 acSync 가 다시 잡는다 (요청) */
  if(acNeedSeed(c)) acSeedFromLegacy(c);
  const KS=acRoleSA(c).concat(SA_KEYS.filter(k=>acRoleSA(c).indexOf(k)<0).slice(0,6));
  for(let i=0;i<nk;i++){
    const k=pick(KS), r=Math.random();
    if(typeof c.a[k]!=="number") continue;
    if(r<up)         c.a[k]=clamp(c.a[k]+1, 1, 20);
    else if(r<up+dn) c.a[k]=clamp(c.a[k]-1, 1, 20);
  }
  /* 나이가 들면 눈이 밝아진다 — 판단 계열이 늦게까지 오른다 */
  if(a>=52 && Math.random()<0.20){ c.a.jpa=clamp(c.a.jpa+1,1,20); c.a.tkn=clamp(c.a.tkn+1,1,20); }
  acSync(c);
  c.ovr=acOvr(c); c.wage=acWage(c);
}
/* ═══ 🪑 감독 제의 — 잘 키운 수석코치는 남의 집 감독이 된다 ═══════
   좋은 코치를 오래 데리고 있으면 반드시 치르는 값이다. FM에서도 그렇다.
   그가 떠나면 그 팀의 감독이 「정말로 그 사람」이 된다 — 이름도 능력치도 그대로 옮겨 간다.
   다음 시즌에 그 팀과 붙으면 상대 감독 팝업에서 내가 키운 코치를 만나게 된다. */
function acPoachCheck(t1, t2){
  const c=acOf(); const ut=userTeam();
  if(!c || !ut) return;
  const o=acOvr(c);
  if(o<15) return;                                    // 준수 아래로는 감독 제의가 오지 않는다
  /* 한 번 붙잡았으면 한 시즌은 조용하다 — 매년 연봉을 1.5배씩 올려 줄 수는 없다 */
  if((c.noPoach|0) >= (G.season|0)) return;
  const tbl=(ut.div===1?t1:t2)||[];
  const pos=Math.max(1, tbl.findIndex(x=>x.isUser)+1);
  const yrs=Math.max(0, (G.season|0)-(c.since|| G.season));
  let pr=(o-14)*0.075;                                // 15 → 7.5% · 18 → 30%
  if(ut.div===1) pr+=0.06;                            // 1부에 있으면 더 잘 보인다
  pr+=clamp((6-pos)*0.024, -0.07, 0.12);              // 상위권 코칭스태프가 먼저 팔린다
  if(yrs>=3) pr+=0.05;
  if(c.age>=58) pr*=0.40;                             // 환갑 앞둔 사람에게 감독직을 맡기진 않는다
  if(Math.random() >= clamp(pr, 0, 0.42)) return;
  /* 데려갈 팀 — 하위권부터 본다. 성적이 무너진 집이 사람을 바꾼다. */
  const pool=[].concat(t1||[], t2||[]).filter(x=>x && !x.isUser);
  if(!pool.length) return;
  const rank={}; (t1||[]).forEach((x,i)=>rank[x.id]=i+1); (t2||[]).forEach((x,i)=>rank[x.id]=i+1);
  pool.sort((a,b)=>(rank[b.id]||9)-(rank[a.id]||9));
  const cand=pool.slice(0, Math.max(3, Math.round(pool.length*0.35)));
  const to=pick(cand);
  const toUp = (to.div===1 && ut.div===2);            // 2부에서 1부 감독으로 — 돈으로 못 막는다
  const hold = toUp ? 0.45 : (to.div===ut.div && (rank[to.id]||20) < pos) ? 0.65 : 0.92;
  const newWage=Math.round(c.wage*1.45*10)/10;
  const room=acRoom(ut)+c.wage;                       // 지금 그의 연봉은 이미 잡혀 있다
  const canPay=newWage<=room+0.001;
  const holdTxt = hold>=0.9 ? `<b style="color:#3fb950">잔류 가능성 높음</b>`
                : hold>=0.6 ? `<b style="color:#d29922">반반입니다</b>`
                :             `<b style="color:#f85149">붙잡기 어렵습니다</b> — 그는 감독이 되고 싶어 합니다`;
  const TR=AC_TRAIT[c.trait]||AC_TRAIT.bal;
  addNews(`🪑 <b>${to.name}</b>, 우리 <b>${c.n}</b> 수석코치에게 감독직을 제안했습니다.`, "warn", "club");
  showConfirm(
    `🪑 <b>${to.name}이(가) ${c.n} 수석코치에게 감독직을 제안했습니다.</b>\n\n`
    + `<span class="small">${TR.ic} ${TR.n} · 종합 ${o} · ${c.age}세 · 우리 팀 ${yrs||1}년차\n`
    + `"감독님, 저도 언젠가는 제 팀을 맡고 싶었습니다. 솔직하게 말씀드립니다."</span>\n\n`
    + `붙잡으시겠습니까? 연봉을 <b class="money">${c.wage}억 → ${newWage}억</b>으로 올려야 합니다.\n`
    + (canPay ? `<span class="small">${holdTxt}</span>`
              : `<span class="small" style="color:var(--red)">연봉 여력이 ${Math.round(room*10)/10}억뿐입니다 — 지금은 올려 줄 수 없습니다.</span>`),
    ()=>{
      if(!canPay){ acPoachGo(c, to); return; }
      if(Math.random()<hold){
        c.wage=newWage; c.ct=Math.max(2, c.ct||2); c.noPoach=(G.season|0)+1;
        addNews(`🤝 <b>${c.n}</b> 수석코치 잔류 — ${to.short}의 감독 제안을 고사했습니다. (연봉 ${newWage}억)`, "good", "club");
        notify(`🤝 <b>${c.n}</b> 수석코치가 남기로 했습니다. <span class="small">연봉 ${newWage}억 · ${to.short} 감독직 고사</span>`,"good");
        try{ staffLog(`${c.n} 수석코치를 붙잡았습니다. (${to.short} 감독 제안 고사 · 연봉 ${newWage}억)`); }catch(e){}
      } else {
        notify(`🚪 <b>${c.n}</b> 수석코치가 결국 ${to.short}행을 택했습니다. <span class="small">연봉으로는 막을 수 없었습니다.</span>`,"bad");
        acPoachGo(c, to);
      }
    },
    {okLabel: canPay?`🤝 붙잡는다 (연 ${newWage}억)`:"보낸다", cancelLabel:"👏 보내 준다",
     onCancel:()=>acPoachGo(c, to)});
}
/* 실제로 떠난다 — 그 팀의 감독이 「그 사람」이 된다 */
function acPoachGo(c, to){
  const ut=userTeam();
  try{
    /* 이름과 능력치를 그 구단에 옮긴다. 세이브에서 되살아나도록 에디터와 같은 창구를 쓴다. */
    to.mgr=c.n; to._mgrGen=(to._mgrGen|0)+1;
    G.coachNames=G.coachNames||{}; G.coachNames[to.id]=c.n;
    if(COACHES[to.id]){
      G.coachAttrs=G.coachAttrs||{}; G.coachAttrs[to.id]=G.coachAttrs[to.id]||{};
      for(const k of AC_KEYS){ COACHES[to.id][k]=c[k]; G.coachAttrs[to.id][k]=c[k]; }
      COACHES[to.id].n=c.n; COACHES[to.id].ovr=acOvr(c);
      G.coachAttrs[to.id].ovr=acOvr(c);
    }
    try{ coachRelAdd(to.id, +18); }catch(e){}     // 한솥밥을 먹던 사이다
  }catch(e){}
  try{ const ix=crew().indexOf(c); if(ix>=0) crew().splice(ix,1); }catch(e){}   // 자리가 빈다
  const V={p:c.n, t:ut.short, o:to.short};
  addNews(`🪑 <b>${to.name} 신임 감독에 ${c.n}</b> — ${ut.short} 수석코치를 지내며 쌓은 ${AC_TRAIT[c.trait]?AC_TRAIT[c.trait].n:"경험"}을 인정받았습니다. 우리 수석코치 자리는 공석이 됐습니다.`, "warn", "club");
  try{
    pushFeed({cat:"manager", ic:"🪑", tone:0, tid:to.id, src:"K리그 공식",
      head:`${to.name}, 신임 감독에 ${c.n}`,
      sub:`${ut.name} 수석코치 출신. "좋은 감독 밑에서 배웠습니다"라고 취임 소감을 밝혔다.`});
  }catch(e){}
  try{ staffLog(`${c.n} 수석코치가 ${to.short} 감독으로 떠났습니다. 후임을 뽑아야 합니다.`); }catch(e){}
  try{
    socialFill(SOC.acOut, 4+R(3), 0, V);
    fmkFill(FMK.acOut, 3+R(2), V);
    rivalFill(SOC.acOutRiv, 2+R(2), 1, V);
    adjustTrust("fans", -2, `${c.n} 수석코치 이탈`);
  }catch(e){}
  try{ acPoolFill(); }catch(e){}                   // 시장을 새로 채운다 — 당장 뽑을 사람은 있어야 한다
}
/* 지금 이 코치가 실제로 무엇을 해 주고 있는가 — 숫자를 그대로 보여 준다.
   능력치만 늘어놓으면 "그래서 뭐가 좋아지는데"를 알 수 없다. */
function acEffectRow(c){
  if(!c) return "";
  const dv=clamp(1+(c.dev-AC_BASE)*0.030, 0.86, 1.20);
  const mn=clamp(1.00-(c.man-AC_BASE)*0.085, 0.55, 1.5);
  const ln=clamp(3+Math.round((acOvr(c)-10)/2.0), 3, 7);
  const hidePct=(a)=>Math.round(clamp((15-a)*0.055,0,0.40)*100);
  const wrong=c.judg>=11 ? 0 : Math.round(clamp((11-c.judg)*0.10,0,0.35)*100);
  const P=(v)=>`${v>=1?"+":""}${Math.round((v-1)*100)}%`;
  const K=(v,a)=>`<span style="color:${v?"#f0883e":"#3fb950"}">${v?v+"%":"없음"}</span>`;
  return `<div class="small" style="margin-top:4px;padding:7px 9px;background:#0d1117;border:1px solid #21262d;border-radius:6px;line-height:1.9">
    🌱 <b>선수 성장</b> <b style="color:${dv>=1?"#3fb950":"#f85149"}">${P(dv)}</b>
    · 📋 <b>경기 중 조언</b> 최대 <b>${ln}줄</b>
    · 🤝 <b>불만 발생</b> <b style="color:${mn<=1?"#3fb950":"#f85149"}">${P(mn)}</b><br>
    <span style="opacity:.8">🔎 놓치는 조언 —
      전술 ${K(hidePct(c.tac))} · 공격 ${K(hidePct(c.att))} · 수비 ${K(hidePct(c.def))} · 관리 ${K(hidePct(c.man))} · 대응 ${K(hidePct(c.flex))}</span><br>
    <span style="opacity:.8">🎭 상황을 거꾸로 읽을 확률 ${K(wrong)}
      <span style="opacity:.7">— 경기판단 ${c.judg}${c.judg>=13?" (말끝을 흐리지 않습니다)":c.judg>=11?" (가끔 확신하지 못합니다)":" (오조언이 섞입니다)"}</span></span>
  </div>`;
}
/* 위약금 — 잔여 연봉의 절반. 인자 없이 부르면 수석코치(예전 호출부 호환) */
/* 직책별 효과 요약 — 「그래서 이 사람이 뭘 해 주는가」를 숫자로 보여 준다.
   ⚠ 요청 원문 「팀닥터도 확실한 역할이 있니? 효과가 뭐지?」 — 화면에 안 적혀 있으면 없는 것이다. */
function acRoleEffect(c){
  if(!c) return "";
  const P=(v)=>`${v>=1?"+":""}${Math.round((v-1)*100)}%`;
  const C=(v,good)=>`<b style="color:${(good?v>=1:v<=1)?"#3fb950":"#f85149"}">${P(v)}</b>`;
  const box=(inner)=>`<div class="small" style="margin-top:4px;padding:7px 9px;background:#0d1117;border:1px solid #21262d;border-radius:6px;line-height:1.9">${inner}</div>`;
  const solo=(o)=>clamp(1+(o-13)*0, 1, 1);   // (자리 표시)
  const o=acOvr(c);
  const one=(per,lo,hi)=>clamp(1+(o-AC_BASE)*per, lo, hi);
  switch(c.role){
    case "coach": {
      const k=one(0.026,0.88,1.22);
      const s=c.assign?AC_SLOT_BY[c.assign]:null;
      return box(`♟️ 담당 <b>${s?`${s.ic} ${s.n}`:'<span style="color:var(--gold)">미배정</span>'}</b>
        · 그 주제로 훈련하는 날 <b>필드 플레이어 성장</b> ${C(k,1)} <span style="opacity:.7">(골키퍼 제외)</span>
        ${s?"":'<br><span style="opacity:.75">칸에 넣기 전에는 아무 효과도 없습니다 — 📅 일정 및 훈련</span>'}`);
    }
    case "gk":  return box(`🧤 <b>골키퍼 성장</b> ${C(one(0.030,0.88,1.20),1)}
      <span style="opacity:.7">— 나이와 무관하게 GK 전원에게 상시. 골키퍼는 팀 훈련에서 빠져 <b>이 사람만</b> 봅니다
      (훈련 담당 코치·유소년 코치의 영향을 받지 않습니다).</span>`);
    case "fit": {
      const s=c.assign?AC_SLOT_BY[c.assign]:null;
      return box(`💪 <b>컨디션 회복</b> ${C(one(0.018,0.92,1.15),1)}
        · <b>훈련 부상 위험</b> ${C(one(-0.024,0.72,1.12),0)}
        ${s?`<br>담당 <b>${s.ic} ${s.n}</b> — 그 주제 훈련일 성장 ${C(one(0.026,0.88,1.22),1)}`
           :'<br><span style="opacity:.75">훈련 칸에도 넣을 수 있습니다 (💪 체력 훈련 추천)</span>'}`);
    }
    case "youth": return box(`🌱 <b>21세 이하 성장</b> ${C(one(0.030,0.94,1.22),1)} <span style="opacity:.7">(필드 플레이어)</span>
      · <b>유스 특급 배출 확률</b> ${C(clamp(1+(o-AC_BASE)*0.075,0.85,1.45),1)}
      · 배출 잠재력 <b style="color:${o>=AC_BASE?"#3fb950":"#f85149"}">${(o>=AC_BASE?"+":"")}${(clamp((o-AC_BASE)*0.55,-2.5,4.0)).toFixed(1)}</b>`);
    case "anal": {
      const lv=o;
      const tier = lv>=16?"정밀 — 예상 포메이션 · 최근 폼 · 요주의 선수까지"
                 : lv>=14?"상세 — 예상 포메이션 · 최근 폼"
                 : lv>=11?"기본 — 대응 조언 3수" : "개략 — 대응 조언 2수";
      return box(`📊 <b>상대 정찰</b> ${tier}
        <br>경기 중 <b>전용 지표</b> ${lv>=16?"4개 (상대 유효·돌파·파울·코너)":lv>=13?"2개 (상대 유효·돌파)":"없음"}
        · 경기 총평 ${lv>=16?"+2줄":lv>=12?"+1줄":"보정 없음"}`);
    }
    case "doc": return box(`🚑 <b>전치 기간</b> ${C(one(-0.028,0.70,1.10),0)}
      · <b>부상 확률</b> ${C(one(-0.016,0.82,1.06),0)}
      · <b>재활 회복</b> ${C(one(0.024,0.92,1.22),1)}`);
  }
  return "";
}
function acFireFee(id){
  const c=id?crewById(id):acOf(); if(!c) return 0;
  return Math.round(c.wage*Math.max(1,c.ct||1)*0.5*10)/10;
}
/* ═══════════════════════════════════════════════════════════════
   🤝 스태프 영입 협상
   ⚠ 요청 원문 — 「스태프 영입하는것도 협상하게 해야지.」
   버튼 한 번에 계약되던 걸 선수 영입과 같은 창구(🤝 협상 테이블)로 올린다.
   스태프에게는 에이전트가 없다 — 본인이 직접 앉는다.

   테이블에 올라가는 것 셋: 연봉 · 계약 기간 · 직책 약속(훈련 칸).
   ─ 돈을 깎으려면 다른 걸 내줘야 한다. 그게 협상이다.
═══════════════════════════════════════════════════════════════ */
/* 협상 성격 — 무엇에 민감한가. 사람마다 다르게 굴어야 두 번째 협상도 재미있다. */
const AC_NEGO={
  hard:{n:"깐깐한 협상가", ic:"💼", d:"돈 이야기에 물러서지 않습니다.",   wK:1.30, yK:0.7, pK:0.7},
  amb :{n:"야심가",       ic:"🔥", d:"자리와 권한을 먼저 봅니다.",       wK:0.85, yK:1.2, pK:1.6},
  mild:{n:"온화한 사람",   ic:"🙂", d:"웬만하면 맞춰 주려 합니다.",       wK:0.78, yK:0.9, pK:0.9},
  real:{n:"현실적",       ic:"⚖️", d:"조건 전체를 저울에 올려 봅니다.",   wK:1.05, yK:1.0, pK:1.1}
};
const AC_NEGO_KEYS=Object.keys(AC_NEGO);
function acNegoOf(c){ return AC_NEGO[(c&&c.nego)||"real"] || AC_NEGO.real; }
/* 이 사람이 원하는 계약 기간 — 젊고 유망하면 길게, 노장은 짧게 */
function acWantYears(c){
  const a=c.age|0;
  return a<=40 ? 3 : a<=50 ? 2 : a<=58 ? 2 : 1;
}
/* 지금 제시안이 상대 눈에 몇 점인가 (0 이 요구와 딱 맞는 지점) */
function acNegoScore(N, c){
  const T=acNegoOf(c);
  const ask=N.ask||c.wage||1;
  let s=0;
  /* 💰 연봉 — 깎을수록 아프다. 깐깐한 사람에게는 두 배로 아프다. */
  s += ((N.wage-ask)/Math.max(0.4,ask)) * 100 * T.wK;
  /* 📜 계약 기간 — 원하는 햇수에서 멀어질수록 싫어한다 */
  const wy=acWantYears(c);
  s -= Math.abs((N.years||2)-wy) * 9 * T.yK;
  /* 🗂️ 직책 약속 — 훈련 칸을 맡기겠다는 말은 야심가에게 돈만큼 크다 */
  if(acRole(c).slot){
    if(N.slot) s += (AC_SLOT_BY[N.slot] ? 8 : 0) * T.pK;
    else s -= 4*T.pK;
  } else if(N.slot) s -= 3;                    // 전문직에게 훈련 칸을 약속해 봐야 소용없다
  /* 🏟️ 구단의 처지 — 잘나가는 1부 팀이면 조금 눅게 온다 */
  try{
    const t=userTeam();
    if(t){ s += (t.div===1?5:0) + clamp(((t.fans||20)-20)/8, -4, 6); }
  }catch(e){}
  /* 실랑이가 길어질수록 인내심이 준다 */
  s -= (N.tries||0)*3;
  return Math.round(s*10)/10;
}
/* 우리가 제시한 조건의 연 지출 */
function acNegoRoom(){
  try{ const t=userTeam(); const cur=(G.acNego&&G.acNego.replaceId)?crewById(G.acNego.replaceId):null;
    return Math.round((acRoom(t)+(cur?cur.wage:0))*10)/10; }catch(e){ return 0; }
}
function acNegoLog(w, t){
  const N=G.acNego; if(!N) return;
  N.log.push({w, t});
  if(N.log.length>40) N.log=N.log.slice(-40);
}
/* 냉각기 — ⚠ 선택: 결렬 시 30일. 무리하게 깎다 깨지면 한 달은 못 데려온다. */
const AC_COOL=30;
function acBlockLeft(uid){
  try{ const m=G.acBlock||{}; return Math.max(0, (m[uid]||0)-(G.day||0)); }catch(e){ return 0; }
}
function acBlockSet(uid){ G.acBlock=G.acBlock||{}; G.acBlock[uid]=(G.day||0)+AC_COOL; }
/* ── 협상 개시 ── */
function acNegoStart(id){
  const t=userTeam(); if(!t) return;
  acEnsure();
  if(G.acNego){ gameAlert("이미 진행 중인 스태프 협상이 있습니다. 그 협상을 먼저 끝내세요."); show("nego"); return; }
  const P=acPool();
  const c=P.find(x=>x.id===id);
  if(!c){ gameAlert("이미 다른 구단과 계약했습니다."); show("transfer"); return; }
  const left=acBlockLeft(c.uid);
  if(left>0){ gameAlert(`${c.n} 쪽에서 「지금은 때가 아니다」라고 합니다. (${left}일 뒤 재접촉 가능)`); return; }
  const RO=acRole(c), isAc=(c.role||"ac")==="ac";
  if(!isAc){
    if(roleFull(c.role)){ gameAlert(`${RO.n}는 ${RO.cap}명까지만 둘 수 있습니다. 먼저 한 명을 정리하세요.`); return; }
    if(crewCount()>=crewCap(t)){ gameAlert(`스태프 정원이 찼습니다 (${crewCount()}/${crewCap(t)}명).\n훈련시설 등급을 올리면 정원이 늘어납니다.`); return; }
  }
  if(!c.nego) c.nego=AC_NEGO_KEYS[uidHash(String(c.uid||c.id))%AC_NEGO_KEYS.length];
  const T=acNegoOf(c);
  const ask=c.wage;
  const cur=isAc?acOf():null;
  G.acNego={
    id:c.id, uid:c.uid, ask,
    wage:ask, years:acWantYears(c), slot:null,
    tries:0, replaceId:cur?cur.id:null,
    log:[{w:"sys", t:`${RO.ic} <b>${c.n}</b> ${RO.n} 영입 협상 개시 — ${T.ic} ${T.n}. 요구 연봉 <b>${ask}억</b> · 희망 계약 <b>${acWantYears(c)}년</b>`},
         {w:"them", t:`"${T.d} 조건부터 들어 보겠습니다."`}]
  };
  show("nego");
}
/* ── 조건 조절 ── */
function acNegoSetWage(d){
  const N=G.acNego; if(!N) return;
  N.wage=Math.max(0.3, Math.round((N.wage+d)*10)/10);
  show("nego");
}
function acNegoSetYears(y){ const N=G.acNego; if(!N) return; N.years=clamp(y|0,1,4); show("nego"); }
function acNegoSetSlot(k){ const N=G.acNego; if(!N) return; N.slot=(k&&AC_SLOT_BY[k])?k:null; show("nego"); }
/* ── 제시 ── */
function acNegoOffer(){
  const N=G.acNego; if(!N) return;
  const t=userTeam();
  const c=acPool().find(x=>x.id===N.id);
  if(!c){ acNegoLog("sys","상대가 이미 다른 구단과 계약했습니다."); G.acNego=null; show("nego"); return; }
  const room=acNegoRoom();
  if(N.wage>room+0.001){ gameAlert(`스태프 연봉 여력이 모자랍니다. (여유 ${room}억 · 제시 ${N.wage}억)`); return; }
  const RO=acRole(c), T=acNegoOf(c);
  N.tries=(N.tries||0)+1;
  const sName=N.slot?`${AC_SLOT_BY[N.slot].ic} ${AC_SLOT_BY[N.slot].n}`:"약속 없음";
  acNegoLog("me", `연 <b>${N.wage}억</b> · <b>${N.years}년</b>${RO.slot?` · 담당 <b>${sName}</b>`:""} 로 제안합니다.`);
  const s=acNegoScore(N, c);
  if(s>=0){                                     // 수락
    acNegoLog("them", `"좋습니다. 그 조건이면 하겠습니다."`);
    acNegoDone(c);
    return;
  }
  if(s<-52 || N.tries>=5){                      // 결렬
    acNegoLog("them", s<-52
      ? `"저를 그 정도로 보시는군요. 여기까지 하겠습니다." <span class="small">(자리를 떴습니다)</span>`
      : `"이 정도면 서로 시간 낭비입니다. 없던 일로 하죠."`);
    acBlockSet(c.uid);
    addNews(`🤝 <b>${c.n}</b> ${RO.n} 영입 협상 결렬 — ${AC_COOL}일간 재접촉할 수 없습니다.`, "warn", "club");
    try{ staffLog(`${c.n} ${RO.n}와의 협상이 결렬됐습니다.`); }catch(e){}
    G.acNego=null; show("nego"); return;
  }
  /* 역제안 — 무엇이 모자란지 콕 집어 말한다 */
  const wy=acWantYears(c);
  const gapW=(N.ask-N.wage);
  const wants=[];
  if(gapW>0.05) wants.push(`연봉은 <b>${Math.round((N.wage+gapW*0.55)*10)/10}억</b>은 돼야 합니다`);
  if((N.years||2)!==wy) wants.push(`계약은 <b>${wy}년</b>을 원합니다`);
  if(RO.slot && !N.slot) wants.push(`제 담당을 <b>정해 주셔야</b> 합니다`);
  if(!wants.length) wants.push(`조건이 조금 아쉽습니다`);
  const mood = s>-12 ? `"거의 다 왔습니다만,"` : s>-24 ? `"아직 부족합니다."` : `"솔직히 많이 모자랍니다."`;
  acNegoLog("them", `${mood} ${wants.join(" · ")}. <span class="small">(남은 기회 ${Math.max(0,5-N.tries)}번)</span>`);
  show("nego");
}
/* ── 성사 ── */
function acNegoDone(c){
  const N=G.acNego; if(!N) return;
  const t=userTeam();
  const RO=acRole(c), isAc=(c.role||"ac")==="ac";
  const cur=isAc?acOf():null;
  const fee=cur?acFireFee(cur.id):0;
  if(fee>0 && t.budget<fee){
    acNegoLog("sys", `기존 수석코치 위약금 ${fee}억을 낼 예산이 없습니다. 협상을 마무리할 수 없습니다.`);
    show("nego"); return;
  }
  const P=acPool(); const i=P.findIndex(x=>x.id===c.id);
  if(cur){
    t.budget=Math.round(Math.max(0,t.budget-fee)*10)/10;
    P.push(Object.assign({}, cur, {hired:false, ct:undefined, since:undefined, assign:undefined}));
    const ix=crew().indexOf(cur); if(ix>=0) crew().splice(ix,1);
    addNews(`🎩 <b>${cur.n}</b> 수석코치가 팀을 떠났습니다 — 후임은 <b>${c.n}</b>입니다.${fee>0?` (위약금 ${fee}억)`:""}`, null, "club");
  }
  if(i>=0) P.splice(i,1);
  c.hired=true; c.wage=N.wage; c.ct=N.years; c.since=G.season;
  c.ovr=acOvr(c);
  if(RO.slot) c.assign = N.slot || null;
  crew().push(c);
  const TRn = isAc ? (AC_TRAIT[c.trait]||AC_TRAIT.bal).n : RO.n;
  try{ staffLog(`${c.n} ${RO.n}를 선임했습니다. (연봉 ${c.wage}억 · ${c.ct}년${c.assign?` · ${AC_SLOT_BY[c.assign].n} 담당`:""})`); }catch(e){}
  addNews(`${RO.ic} <b>${t.short}</b>, <b>${c.n}</b>(${c.age}세) ${RO.n} 선임 — 연봉 ${c.wage}억 · ${c.ct}년 계약${c.assign?` · ${AC_SLOT_BY[c.assign].n} 담당`:""}`, "good", "club");
  notify(`${RO.ic} <b>${c.n}</b> ${RO.n} 계약 완료 — 연 <b>${c.wage}억</b> · ${c.ct}년${N.wage<N.ask?` <span class="small">(요구 ${N.ask}억에서 ${Math.round((N.ask-N.wage)*10)/10}억 절감)</span>`:""}`,"good");
  try{
    const _v=acOvr(c), _V={p:c.n, t:t.short, r:TRn, v:_v};
    const big=_v>=16;
    socialFill(big?(SOC.acInBig||[]).concat(SOC.acIn||[]):SOC.acIn, big?(4+R(3)):(2+R(2)), big?1:0, _V);
    fmkFill(big?(FMK.acInBig||[]).concat(FMK.acIn||[]):FMK.acIn, big?(3+R(2)):(1+R(2)), _V);
    if(big) try{ adjustTrust("fans", +2, `${c.n} ${RO.n} 선임`); }catch(e2){}
  }catch(e2){}
  G.acNego=null;
  show("nego");
}
/* ── 포기 ── */
function acNegoQuit(){
  const N=G.acNego; if(!N) return;
  showConfirm(`🤝 진행 중인 스태프 협상을 접습니다.<br><span class="small">지금까지 주고받은 조건은 사라지지만, 냉각기는 붙지 않습니다.</span>`,
    ()=>{ G.acNego=null; show("nego"); }, {okLabel:"접는다"});
}
/* ── 경쟁 — ⚠ 선택: 우수 이상만. 뜸 들이면 놓친다 ── */
function acNegoRivalTick(){
  const N=G.acNego; if(!N) return;
  const c=acPool().find(x=>x.id===N.id);
  if(!c){ G.acNego=null; return; }
  if(acOvr(c)<15) return;                                  // 우수 아래는 아무도 안 채 간다
  N.days=(N.days||0)+1;
  const pr=clamp(0.05 + (acOvr(c)-15)*0.035 + (N.days-1)*0.02, 0, 0.30);
  if(Math.random()>=pr) return;
  const RO=acRole(c);
  let to=null;
  try{
    const pool=Object.keys(G.teams).map(k=>G.teams[k]).filter(x=>x && !x.isUser);
    to=pick(pool);
  }catch(e){}
  const P=acPool(); const i=P.findIndex(x=>x.id===c.id); if(i>=0) P.splice(i,1);
  G.acNego=null;
  addNews(`🏃 <b>${c.n}</b> ${RO.n}, ${to?to.name:"타 구단"}과 계약 — 우리 협상은 결렬됐습니다.`, "bad", "club");
  notify(`🏃 <b>${c.n}</b> ${RO.n}를 놓쳤습니다. <span class="small">${to?to.short:"다른 구단"}이 먼저 도장을 찍었습니다 — 좋은 스태프는 기다려 주지 않습니다.</span>`,"bad");
  try{ staffLog(`${c.n} ${RO.n}를 ${to?to.short:"타 구단"}에 놓쳤습니다.`); }catch(e){}
}
function acSign(id){
  const t=userTeam(); if(!t) return;
  const P=acPool();
  const i=P.findIndex(c=>c.id===id);
  if(i<0){ gameAlert("이미 다른 구단과 계약했습니다."); show("transfer"); return; }
  const c=P[i];
  /* ⚠ 지역 R 이 전역 난수 R() 을 가려 socialFill 의 R(3) 이 역할 객체를 호출했다 —
     try 안이라 조용히 삼켜져 스태프 영입 소셜 반응이 통째로 안 떴다. 이름을 분리한다. */
  const RO=acRole(c);
  const isAc=(c.role||"ac")==="ac";
  /* 수석코치는 자리가 하나라 「교체」가 되고, 나머지는 정원이 남아 있어야 뽑는다 */
  const cur=isAc?acOf():null;
  const fee=cur?acFireFee():0;
  if(!isAc){
    if(roleFull(c.role)){ gameAlert(`${RO.n}는 ${RO.cap}명까지만 둘 수 있습니다. 먼저 한 명을 정리하세요.`); return; }
    if(crewCount()>=crewCap(t)){
      gameAlert(`스태프 정원이 찼습니다 (${crewCount()}/${crewCap(t)}명).\n훈련시설 등급을 올리면 정원이 늘어납니다.`); return; }
  }
  const room=acRoom(t)+(cur?cur.wage:0);      // 교체라면 지금 그 사람 연봉이 풀린다
  if(c.wage>room+0.001){ gameAlert(`스태프 연봉 여력이 모자랍니다. (여유 ${room}억 · 요구 ${c.wage}억)`); return; }
  if(fee>0 && t.budget<fee){ gameAlert(`기존 수석코치 위약금 ${fee}억을 낼 예산이 없습니다. (현재 ${t.budget}억)`); return; }
  const go=()=>{
    if(cur){
      t.budget=Math.round(Math.max(0,t.budget-fee)*10)/10;
      G.acPool.push(Object.assign({}, cur, {hired:false, ct:undefined, since:undefined, assign:undefined}));
      const _ix=crew().indexOf(cur); if(_ix>=0) crew().splice(_ix,1);
      addNews(`🎩 <b>${cur.n}</b> 수석코치가 팀을 떠났습니다 — 후임은 <b>${c.n}</b>입니다.${fee>0?` (위약금 ${fee}억)`:""}`, null, "club");
    }
    P.splice(i,1);
    c.hired=true; c.ct=2+(Math.random()<0.4?1:0); c.since=G.season;
    c.ovr=acOvr(c); c.wage=acWage(c);
    /* 배정 칸 — 비어 있는 자리가 있으면 알아서 들어간다(감독이 언제든 바꾼다) */
    if(RO.slot && !c.assign){
      const pref = c.role==="fit" ? ["phy","bal"] : ["atk","def","tac","set","pos","bal"];
      c.assign = pref.find(k=>!slotStaff(k).length) || null;
    }
    crew().push(c);
    try{ staffLog(`${c.n} ${RO.n}를 선임했습니다. (연봉 ${c.wage}억 · ${c.ct}년)`); }catch(e){}
    const TRn = isAc ? (AC_TRAIT[c.trait]||AC_TRAIT.bal).n : RO.n;
    const TRic= isAc ? (AC_TRAIT[c.trait]||AC_TRAIT.bal).ic : RO.ic;
    addNews(`${RO.ic} <b>${t.short}</b>, <b>${c.n}</b>(${c.age}세) ${RO.n} 선임 — ${TRic} ${TRn} · 연봉 ${c.wage}억 · ${c.ct}년 계약`, "good", "club");
    notify(`${RO.ic} <b>${c.n}</b> ${RO.n} 선임 완료 — 종합 <b>${acOvr(c)}</b>/20${RO.slot&&c.assign?` · <b>${AC_SLOT_BY[c.assign].ic} ${AC_SLOT_BY[c.assign].n}</b> 담당`:""}`,"good");
    /* 🎩 팬 반응 — 특급(17+)이면 판이 커진다 */
    try{
      const _v=acOvr(c), _V={p:c.n, t:t.short, r:TRn, v:_v};
      const big=_v>=17;
      socialFill(big?(SOC.acInBig||[]).concat(SOC.acIn||[]):SOC.acIn, big?(4+R(3)):(2+R(2)), big?1:0, _V);
      fmkFill(big?(FMK.acInBig||[]).concat(FMK.acIn||[]):FMK.acIn, big?(3+R(2)):(1+R(2)), _V);
      if(big) try{ adjustTrust("fans", +2, `${c.n} ${RO.n} 선임`); }catch(e2){}
    }catch(e2){}
    show("transfer");
  };
  if(cur) showConfirm(`🎩 <b>${cur.n}</b> 수석코치와 계약을 해지하고 <b>${c.n}</b>을(를) 선임합니다.<br>
     위약금 <b class="money">${fee}억</b>이 이적 예산에서 나갑니다. (현재 ${t.budget}억)<br>
     <span class="small">영입하면 ${c.n}의 정확한 능력치가 드러납니다 — 추정과 다를 수 있습니다.</span>`,
     go, {okLabel:"교체한다"});
  else showConfirm(`${RO.ic} <b>${c.n}</b>(${c.age}세)을(를) <b>${RO.n}</b>로 선임합니다. 연봉 <b class="money">${c.wage}억</b>.<br>
     <span class="small">${RO.d}<br>영입하면 정확한 능력치가 드러납니다 — 추정과 다를 수 있습니다.</span>`,
     go, {okLabel:"선임한다"});
}
function acFire(id){
  const t=userTeam(); const c=id?crewById(id):acOf(); if(!c) return;
  const R=acRole(c), isAc=(c.role||"ac")==="ac";
  const fee=acFireFee(c.id);
  if(t.budget<fee){ gameAlert(`위약금 ${fee}억을 낼 예산이 없습니다. (현재 ${t.budget}억)`); return; }
  showConfirm(`🚪 <b>${c.n}</b> ${R.n}와의 계약을 해지합니다. 위약금 <b class="money">${fee}억</b>.<br>
     <span class="small">${isAc?"후임을 뽑기 전까지 자리가 비어 조언·보고·육성이 나빠집니다."
       :(R.slot&&c.assign?`<b>${AC_SLOT_BY[c.assign].n}</b> 칸이 비게 됩니다.`:"그 자리의 효과가 사라집니다.")}</span>`, ()=>{
    t.budget=Math.round(Math.max(0,t.budget-fee)*10)/10;
    G.acPool=G.acPool||[]; G.acPool.push(Object.assign({},c,{hired:false, ct:undefined, since:undefined, assign:undefined}));
    const ix=crew().indexOf(c); if(ix>=0) crew().splice(ix,1);
    try{ staffLog(`${c.n} ${R.n}와 계약을 해지했습니다. (위약금 ${fee}억)`); }catch(e){}
    addNews(`🚪 <b>${t.short}</b>, <b>${c.n}</b> ${R.n}와 결별 — 위약금 ${fee}억`, "warn", "club");
    if(isAc) try{ socialFill(SOC.acVoid, 2+R(2), -1, {p:c.n, t:t.short}); }catch(e2){}
    acBack();
  }, {okLabel:"해지한다", danger:true});
}
/* 💸 월 급여 — 스카우트 유지비와 같은 창구(매달 1일, 이적 예산에서) */
function acWageBill(){ return Math.round(crew().reduce((s,c)=>s+(c&&c.wage||0),0)*10)/10; }
/* 스태프에게 쓸 수 있는 여력 — 선수 연봉 여력에서 지금 코치진 급여를 뺀 값.
   ⚠ 코치 급여는 totalWage(선수 합계)에 안 잡히므로 따로 빼 주지 않으면 무한정 뽑을 수 있다. */
function acRoom(t){ return Math.round((wageRoom(t||userTeam()) - acWageBill())*10)/10; }
function acMonthTick(){
  const t=userTeam(); if(!t) return;
  const tot=acWageBill(); if(tot<=0) return;
  try{
    const dt=dateOfDay(G.day||0), mk=`${G.season}-${dt.getMonth()+1}`;
    if(dt.getDate()!==1 || G.acMon===mk) return;
    G.acMon=mk;
    const bill=Math.round(tot/12*100)/100;
    if(bill>0) t.budget=Math.round(Math.max(0, t.budget-bill)*10)/10;
  }catch(e){}
}
/* ⭐ 관심 목록 탭 — 담아 둔 선수의 「지금」을 다시 읽어 보여주고, 여기서 바로 접촉한다 */
function slRow(e, wi, t){
  const p=findAnyPlayer(e.pid); if(!p) return "";
  let ot=null;
  for(const id in G.teams) if(G.teams[id].players.some(q=>q.id===p.id)){ ot=G.teams[id]; break; }
  const fa=!ot && (G.freeAgents||[]).some(q=>q.id===p.id);
  const os=!ot && !fa && (G.overseas||[]).some(q=>q.id===p.id);
  const age=G.season-p.by;
  const blocked=negoBlockDaysLeft(p.id);
  const W=SL_WHY[e.why]||SL_WHY.eye;
  let act="";
  if(!wi.open)             act=`<span class="tag inj">시장 닫힘</span>`;
  else if(blocked>0)       act=`<span class="tag inj">재협상 ${blocked}일 뒤</span>`;
  else if(p.army&&p.army.out) act=`<span class="tag inj">🎖️ 복무 중</span>`;
  else if(p.loan)          act=`<span class="tag inj">임대 중</span>`;
  else if(fa)              act=`<button class="mini" onclick="startFANego(${p.id})">🤝 FA 협상</button>`;
  else if(os)              act=`<button class="mini" onclick="startOverseasNego(${p.id})">✍️ 영입 시도</button>`;
  else if(ot)              act=`<button class="mini" onclick="startNego(${p.id},'${ot.id}')">🤝 영입 시도</button>`;
  else                     act=`<span class="tag inj">접촉 불가</span>`;
  /* 담아 둔 뒤 무엇이 달라졌는지 — 팀을 옮겼거나 FA 가 됐으면 그게 가장 중요한 소식이다 */
  const where = ot ? ot.short+(ot.div===2?" (K2)":"") : fa ? "🆓 FA" : os ? "🌍 해외" : "—";
  const val = fa ? `요구연봉 약 ${Math.round(faWageAsk(p)*10)/10}억`
                 : `<b class="money">${marketValue(p)}억</b> · 연봉 ${p.wage}억`;
  return `<div class="psRow">
    <div class="psMain">
      <div class="psName clickable" onclick="openPlayerMenu(event,${p.id})"><span class="${p.frn?"frnN":""}">${p.name}</span>${pTags(p)}</div>
      <div class="psSub"><span class="pos-${p.pos}">${p.pos}</span> · ${age}세 · ${where}
        · <span style="opacity:.8">${W.ic} ${W.n}</span>${e.s&&e.s!==G.season?` <span style="opacity:.6">(${e.s}시즌)</span>`:""}</div>
      ${psPosBadge(p)}
    </div>
    <div class="psVal">${val}</div>
    <div class="psAct"><button class="mini" onclick="slToggle(${p.id})" title="목록에서 뺍니다">✕</button>${act}</div>
  </div>`;
}
function shortlistTab(){
  const t=userTeam(), wi=windowInfo();
  const L=slSweep();
  if(!L.length) return `<div class="card"><h3>⭐ 관심 목록</h3>
    <p class="small" style="padding:10px 2px">아직 담아 둔 선수가 없습니다.<br><br>
      선수 검색·FA 시장·스카우트 보고서에서 <b>☆</b> 를 누르면 여기에 담깁니다.
      <b>영입을 시도했거나 협상이 결렬된 선수는 자동으로 담깁니다</b> — 재협상이 풀리면 여기서 바로 다시 접촉할 수 있습니다.</p></div>`;
  /* 최근에 담은 순 — 다만 지금 접촉할 수 있는 선수를 위로 올린다 */
  const rank=(e)=>{ const b=negoBlockDaysLeft(e.pid); return (b>0?1:0)*1000 + (10000-(e.s||0)*400-(e.at||0)); };
  const rows=[...L].sort((a,b)=>rank(a)-rank(b)).map(e=>slRow(e, wi, t)).join("");
  const ready=L.filter(e=>!negoBlockDaysLeft(e.pid)).length;
  return `<div class="card"><h3>⭐ 관심 목록 <span class="small">— ${L.length}명 · 지금 접촉 가능 ${ready}명</span></h3>
    <p class="small" style="margin-bottom:8px">눈여겨본 선수와 접촉했던 선수가 모입니다. 소속·몸값은 열 때마다 새로 읽으므로,
      담아 둔 뒤 팀을 옮겼거나 FA 가 됐다면 그대로 보입니다.
      <button class="mini" style="margin-left:6px" onclick="slClear()">🗑️ 전체 비우기</button></p>
    ${rows}</div>`;
}
/* ═══════════════════════════════════════════════════════════════
   재계약 · 임대 화면
   이적시장 탭 안에 묻어 두니 "지금 잡아야 할 계약"이 눈에 띄지 않았다.
   만료가 다가온 선수는 그 자체로 감독이 매주 확인해야 할 일이라 메뉴를 따로 뺐다.
═══════════════════════════════════════════════════════════════ */
let ctTab="renew";
function setCtTab(k){ ctTab=k; show("contract"); }
/* 🔁 임대는 임대 센터로 옮겼다 — 옛 상태가 남아 있으면 재계약 탭으로 되돌린다 */
function ctTabSafe(){ if(ctTab!=="renew" && ctTab!=="sell") ctTab="renew"; return ctTab; }
/* ═══════════════════════════════════════════════════════════════
   🔁 임대 센터 — 임대에 관한 모든 것을 한 화면에
   내보내기 · 빌려오기 · 들어온 제안 · 진행 현황을 탭 하나로 묶는다.
   (제보 — 임대 기능이 재계약 메뉴·이적시장·협상 탭 세 곳에 흩어져 있었다)
═══════════════════════════════════════════════════════════════ */
let lcTab="status";
function setLcTab(k){ lcTab=k; show("loancenter"); }
let lcQ="", lcPage=1, lcOnly=false;
const LC_PER=20;
function lcSearch(v){ lcQ=String(v||""); lcPage=1; lcRefresh(); }
function lcGo(n){ lcPage=Math.max(1,n|0); lcRefresh();
  try{ const el=document.getElementById("lcList"); if(el&&el.scrollTo) el.scrollTo({top:0}); }catch(e){} }
function lcToggleOnly(){ lcOnly=!lcOnly; lcPage=1; show("loancenter"); }
function lcRefresh(){ const el=document.getElementById("lcList"); if(el) el.innerHTML=lcInList(); }
/* 임대 문의 대상 — 리그 전체 선수. 임대가 성립하지 않는 선수도 보여 주되 이유를 함께 표시한다.
   (제보 — 목록을 걸러 두면 "왜 저 선수가 안 보이지"가 되고, 문의 자체는 할 수 있어야 한다) */
function lcInCands(){
  const t=userTeam(); const out=[];
  const q=psNorm(lcQ);
  for(const id in G.teams){ const c=G.teams[id];
    if(c.isUser) continue;
    if(isArmyTeam(c)) continue;        // 🎖️ 상무 선수는 임대도 되지 않는다 — 목록에서 뺀다
    for(const p of c.players){
      if(p.emg) continue;
      if(q && psScore({p, ot:c}, q)<=0) continue;
      const blk=loanInBlocked(p, c);
      if(lcOnly && blk) continue;
      out.push({p, c, role:squadRole(p, c), blk});
    }
  }
  /* 임대가 되는 선수 먼저, 그 안에서 못 뛰는 선수 · 능력 좋은 순 */
  return out.sort((a,b)=> (a.blk?1:0)-(b.blk?1:0) || (a.role-b.role) || (b.p.ovr-a.p.ovr));
}
function lcInList(){
  const t=userTeam(), wi=windowInfo();
  const L=lcInCands();
  if(!L.length) return `<p class="small" style="padding:14px 4px">🔍 조건에 맞는 선수가 없습니다.</p>`;
  const last=Math.max(1, Math.ceil(L.length/LC_PER));
  const page=clamp(lcPage||1, 1, last); lcPage=page;
  const from=(page-1)*LC_PER;
  const shown=L.slice(from, from+LC_PER);
  const okN=L.filter(x=>!x.blk).length;
  const head=`<div class="psCount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    전체 <b>${L.length}명</b> <span style="opacity:.7">· ${from+1}~${Math.min(from+LC_PER, L.length)}번째</span>
    <span class="small" style="opacity:.75">· 임대 가능 <b style="color:var(--green)">${okN}명</b></span></div>`;
  const rows=shown.map(({p,c,role,blk})=>{
    const age=G.season-p.by;
    const _new=(p._joinS===G.season) && !((p.mn||0)>0);
    const tag = blk ? '<span class="tag inj">임대 불가</span>'
              : _new ? '<span class="tag" style="background:#8957e533;color:#d2a8ff">새 영입</span>'
              : role<0.12 ? '<span class="tag" style="background:#2ea04333;color:#3fb950">출전 없음</span>'
              : role<0.35 ? '<span class="tag">후보</span>' : '<span class="tag">로테이션</span>';
    return `<div class="psRow"${blk?' style="opacity:.62"':""}>
      <div class="psMain">
        <div class="psName clickable" onclick="openPlayerMenu(event,${p.id})"><span class="${p.frn?"frnN":""}">${p.name}</span>${pTags(p)}</div>
        <div class="psSub"><span class="pos-${p.pos}">${p.pos}</span> · ${age}세 · ${c.short}${c.div===2?" (K2)":""} · ${tag}</div>
        ${psPosBadge(p)}
      </div>
      <div class="psVal">${abilityStars(p)}<br><span class="small">잠재 ${potentialStars(p)}</span></div>
      <div class="psAct">${wi.open?`<button class="mini" style="${blk?"":"border-color:var(--gold);color:var(--gold)"}" title="${blk?"주전·핵심 자원이라 거절당할 가능성이 큽니다":"임대 협상을 시작합니다"}" onclick="openLoanIn(${p.id},'${c.id}')">🔁 임대 문의</button>`:'<span class="small">시장 닫힘</span>'}</div>
    </div>`;}).join("");
  return head + rows + psPager(L.length, page, "lcGo", LC_PER);
}
/* 🔙 임대 조기 복귀 — 감독이 먼저 데려오겠다고 나서는 경우.
   임대 구단 입장에서는 계산이 다르다. 이미 주전으로 쓰고 있으면 놓아줄 이유가 없다. */
/* 🗓️ 이 임대가 언제 끝나는가 — 「반 시즌」이라는 말만으로는 언제 돌아오는지 알 수 없다.
   ⚠ 제보 — 「시즌이 끝나지 않았는데 말도 없이 스쿼드에 돌아왔다」.
      반 시즌 임대는 원래 약 19라운드 뒤에 복귀하는 사양인데, 그 시점을 어디에서도
      알려 주지 않아 「버그로 돌아온 것」처럼 보였다. 남은 라운드를 늘 함께 적는다. */
function loanBackInfo(p){
  const L=p&&p.loan; if(!L) return null;
  if(!L.half || L.backR==null) return {half:false, txt:"시즌 종료 후 복귀"};
  const club=G.teams[L.to];
  const r=club ? (club.div===1?G.r1:G.r2) : 0;
  const left=Math.max(0, L.backR-r);
  return {half:true, backR:L.backR, left,
          txt: L.s!==G.season ? "시즌 종료 후 복귀"
             : left<=0 ? "이번 라운드 복귀"
             : `${L.backR+1}R 복귀 예정 (${left}R 남음)`};
}
/* 🩹 제보 — 화면(📤 내보낸 선수)과 조회가 어긋나지 않도록 같은 함수를 쓴다.
   예전에는 여기서만 p.loan.to===id 를 요구해, 표식이 어긋난 선수에게 「임대 중인 선수가
   아닙니다」가 떴다. */
function loanedOutOf(t){ return loanedOut(t); }
function recallChance(p, club){
  if(!p || !p.loan) return 0;
  const played=(p.apps||0)-(p.loan.apps0||0);
  let c=0.88;
  c -= clamp(played*0.045, 0, 0.55);              // 많이 뛰었으면 붙잡는다
  if(p.loan.buy) c-=0.18;                          // 완전이적을 노리고 데려간 선수
  if((p.seasonRating||0)>=7.35 && played>=5) c-=0.12;
  if(club){
    try{ const depth=club.players.filter(q=>q.pos===p.pos&&avail(q)).length; if(depth<=3) c-=0.10; }catch(e){}
  }
  if(p.loan.half) c+=0.06;                         // 애초에 짧게 빌려준 계약
  try{ const A=(G.trust&&G.trust.fans)||60; c += (A-60)*0.0012; }catch(e){}
  return clamp(c, 0.10, 0.95);
}
function askRecall(pid){
  const t=userTeam(); if(!t) return;
  const hit=loanedOutOf(t).find(x=>x.p.id===pid);
  if(!hit){ flash("임대 중인 선수가 아닙니다.","warn"); return; }
  if(!transferOpen()){ flash("이적시장이 닫혀 있어 조기 복귀를 요청할 수 없습니다.","warn"); return; }
  const {p, c}=hit;
  const played=(p.apps||0)-(p.loan.apps0||0);
  const ch=recallChance(p, c);
  showConfirm(`<b>🔙 임대 조기 복귀 요청</b>\n\n${p.name} — ${c?c.name:"임대 구단"}\n임대 후 ${played}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}${p.loan.buy?"\n⚠ 완전이적 옵션이 걸린 임대입니다":""}\n\n${c?c.short:"상대 구단"}에 조기 복귀를 요청합니다.\n수락 가능성 <b>${Math.round(ch*100)}%</b>\n\n<span class="small">거절당하면 이번 이적시장에는 다시 요청할 수 없습니다.</span>`,
    ()=>{
      if(p._recallTried===G.season+"-"+(windowInfo().name||"w")){
        flash("이번 이적시장에는 이미 요청했습니다.","warn"); show("loancenter"); return;
      }
      p._recallTried=G.season+"-"+(windowInfo().name||"w");
      if(Math.random()<ch){
        const club=c;
        endLoan(p, club);
        addNews(`🔙 <b>${p.name}</b> 임대 조기 복귀 — ${club?club.short:"임대 구단"}에서 ${played}경기를 뛰고 돌아왔습니다.`, "good", "club");
        notify(`🔙 <b>${p.name}</b> 선수가 팀으로 돌아왔습니다.`,"good");
        try{ p.morale=clamp((p.morale||70)+(played>=8?-4:3), 25, 99); }catch(e){}
        try{ loanSocial(p, club, "back"); }catch(e){}
      }else{
        addNews(`🚫 ${c?c.name:"임대 구단"}, ${p.name} 조기 복귀 요청 거절 — "지금 우리 전력의 일부입니다."`, "warn", "club");
        notify(`🚫 ${c?c.short:"임대 구단"}이(가) 조기 복귀를 거절했습니다.`,"warn");
      }
      saveGame(); show("loancenter");
    },
    {okLabel:"요청한다", cancelLabel:"그만두기"});
}
/* ═══ 💰 완전이적 옵션 조기 행사 ═══════════════════════════════════════
   임대 종료를 기다릴 필요가 없다. 계약에 박아 둔 금액으로 시즌 중에 바로 사 온다.
   다만 등록 절차가 필요하므로 이적시장이 열려 있어야 한다. */
function loanBuyNow(pid){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid);
  if(!p || !p.loan || !p.loan.buy || !p.loan.inbound){ gameAlert("완전이적 옵션이 걸린 임대 선수가 아닙니다."); return; }
  if(armyGate("완전 영입")) return;
  if(!transferOpen()){
    gameAlert(`💰 <b>완전이적 옵션</b>은 이적시장이 열려 있을 때만 행사할 수 있습니다.\n\n선수 등록 절차가 필요하기 때문입니다 — 시장이 열리면 임대 센터에서 바로 발동할 수 있고, 그때까지 옵션은 그대로 유지됩니다.`);
    return;
  }
  const own=G.teams[p.loan.own];
  if(!own){ gameAlert("원소속 구단을 찾을 수 없습니다."); return; }
  const fee=loanOptFee(p);
  const played=(p.apps||0)-(p.loan.apps0||0);
  const mv=(()=>{ try{ return marketValue(p); }catch(e){ return 0; } })();
  const diff=mv-fee;
  showConfirm(`<b>💰 완전이적 옵션 행사</b>\n\n${p.name} — ${own.short}에서 임대로 온 선수입니다.`
    +`\n임대 후 ${played}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}`
    +`\n\n임대 협상 때 못박은 금액으로 <b>지금 바로</b> 완전 영입합니다.`
    +`\n이적료 <b>${fee}억</b> (예산 ${t.budget}억) · 현재 시장가 ${Math.round(mv*10)/10}억`
    +(diff>=fee*0.15?`\n<b style="color:var(--green)">시장가보다 ${Math.round(diff*10)/10}억 싸게 데려옵니다.</b>`
      : diff<=-fee*0.15?`\n<b style="color:var(--red)">시장가보다 ${Math.round(-diff*10)/10}억 비쌉니다 — 옵션을 접고 임대만 마쳐도 됩니다.</b>`:"")
    +`\n영입 후에는 주급 <b>${p.wage}억</b>을 전액 부담하며, 원소속과의 경기 출전 제한도 풀립니다.`,
    ()=>{
      if(!p.loan){ show("loancenter"); return; }
      if(t.budget<fee){ gameAlert(`예산이 부족합니다. (필요 ${fee}억 · 보유 ${t.budget}억)`); return; }
      t.budget=Math.round((t.budget-fee)*10)/10;
      own.budget=Math.round((own.budget+fee)*10)/10;
      p.loan=null; p.ct=Math.max(p.ct||1, 2);
      try{ clearClubBaggage(p, clamp((p.morale||70)+7, 30, 99)); }catch(e){}
      try{ tfLogAdd("in", p, own.short+" (완전이적 옵션 조기 행사)", fee, p.wage, p.ct); }catch(e){}
      addNews(`💰 <b>${t.name}</b>, 임대 중이던 ${p.name} 완전 영입 — 옵션 행사가 <b>${fee}억</b>`, "good");
      notify(`💰 <b>${p.name}</b>을/를 완전 영입했습니다! (${fee}억 · 이제 우리 선수입니다)`,"good");
      try{ pushFeed({cat:"transfer", ic:"💰", tone:1, tid:t.id, src:"K리그 공식",
        head:`${t.name}, 임대생 ${p.name} 완전 영입`,
        sub:`임대 계약에 포함된 완전이적 옵션을 시즌 중 행사했다. 이적료 ${fee}억. ${own.short}는 사실상 선택권이 없었다.`}); }catch(e){}
      try{ loanSocial(p, own, "buy"); }catch(e){}
      saveGame(); lcTab="status"; show("loancenter");
    },
    {okLabel:`${fee}억에 영입`, cancelLabel:"나중에"});
}
function loanCenterView(){
  const t=userTeam(), wi=windowInfo();
  const sentOut=loanedOut(t).concat(armySentOut(t)), came=loanedInFrom(t), cands=loanCandidates(t);
  let asks=0, offers=0;
  try{ asks=loanAsksPrune().length; }catch(e){ asks=(G.loanAsks||[]).length; }
  try{ offers=loanOffersPrune().length; }catch(e){ offers=(G.loanOffers||[]).length; }
  const tab=(k,l)=>`<button class="mini ${lcTab===k?'sel':''}" style="padding:8px 16px;font-size:14px" onclick="setLcTab('${k}')">${l}</button>`;
  let body="";
  if(lcTab==="status"){
    body=`<div class="card"><h3>📥 빌려온 선수 <span class="small">(${came.length}/${LOAN_IN_MAX}) — 원소속 구단과의 경기에는 출전할 수 없습니다</span></h3>
    ${came.length?`<div class="tblScroll"><table><tr><th>이름</th><th>포지션</th><th>나이</th><th>원소속</th><th>기간</th><th>주급 부담</th><th>옵션</th><th>우리 팀에서</th></tr>
      ${came.map(p=>{ const c=G.teams[p.loan.own]; const played=(p.apps||0)-(p.loan.apps0||0);
        return `<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</td>
        <td class="pos-${p.pos}" title="${p.pos}"><b>${prefSlotOf(p)}</b></td>
        <td>${G.season-p.by}</td>
        <td>${c?c.short:"-"}</td><td class="small">${p.loan.half?"반 시즌":"시즌 종료까지"}<br>
          <span style="opacity:.75">${(loanBackInfo(p)||{}).txt||""}</span></td>
        <td class="small">${Math.round(p.loan.share*100)}% (${Math.round(p.wage*p.loan.share*10)/10}억)</td>
        <td class="small">${p.loan.buy?`<b style="color:var(--gold)">완전이적 ${loanOptFee(p)}억</b><br>
          <button class="mini" style="padding:3px 9px;margin-top:3px;border-color:var(--gold);color:var(--gold);font-weight:800"
            onclick="loanBuyNow(${p.id})">💰 지금 영입</button>`:"—"}</td>
        <td>${played}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}</td></tr>`;}).join("")}
      </table></div>
      <p class="small" style="opacity:.85;margin:6px 0 0">💰 <b>완전이적 옵션</b>이 걸린 선수는 임대 종료를 기다릴 필요 없이, <b>이적시장이 열려 있는 동안</b> 계약에 못박아 둔 금액으로 바로 사 올 수 있습니다.${wi.open?"":" <b style=\"color:var(--gold)\">(지금은 시장이 닫혀 있습니다)</b>"}</p>`:`<p class="small">빌려온 선수가 없습니다. <b>📥 임대 영입</b> 탭에서 찾아보세요.</p>`}
    </div>
    <div class="card"><h3>📤 내보낸 선수 <span class="small">(${sentOut.length}) — 출전 시간이 성장으로 돌아옵니다</span></h3>
    ${sentOut.length?`<div class="tblScroll"><table><tr><th>이름</th><th>포지션</th><th>나이</th><th>임대 구단</th><th>기간</th><th>주급 분담</th><th>옵션</th><th>임대 후 출전</th><th></th></tr>
      ${sentOut.map(({p,c,army})=>{
        /* 🎖️ 병역 이행 중 — 임대와 규칙이 다르다. 주급 분담도 옵션도 조기 복귀도 없다 */
        if(army){
          const pl=(p.apps||0);
          /* ⚠ 제보 — 「내보낸 선수 명단에 포지션도 표기해 달라」 */
          return `<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})"><span class="lcArmy">🎖️ ${nmF(p)}</span></td>
          <td class="pos-${p.pos}" title="${p.pos}"><b>${prefSlotOf(p)}</b></td>
          <td>${G.season-p.by}</td><td>${c?c.short:"-"}</td>
          <td class="small"><b style="color:#c9a227">병역 이행 중</b><br>
            <span style="opacity:.85">${armyBackTxt(p)}</span></td>
          <td class="small">—</td><td class="small">—</td>
          <td>${pl}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}</td>
          <td><span class="small" style="opacity:.6">전역까지 복귀 불가</span></td></tr>`;
        }
        const pl=(p.apps||0)-(p.loan.apps0||0);
        const ch=Math.round(recallChance(p, c)*100);
        return `<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</td>
        <td class="pos-${p.pos}" title="${p.pos}"><b>${prefSlotOf(p)}</b></td>
        <td>${G.season-p.by}</td><td>${c?c.short:"-"}</td>
        <td class="small">${p.loan.half?"반 시즌":"시즌 종료까지"}<br>
          <span style="opacity:.75">${(loanBackInfo(p)||{}).txt||""}</span></td><td class="small">${Math.round(p.loan.share*100)}%</td>
        <td class="small">${p.loan.buy?"완전이적 옵션":"—"}</td>
        <td>${pl}경기${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}</td>
        <td>${transferOpen()
          ? `<button class="mini" onclick="askRecall(${p.id})" title="임대를 끊고 데려옵니다 — 상대 구단의 동의가 필요합니다">🔙 조기 복귀 <span class="small">(${ch}%)</span></button>`
          : '<span class="small" style="opacity:.6">이적시장 닫힘</span>'}</td></tr>`;}).join("")}
      </table></div>
      <p class="small" style="opacity:.7;margin-top:6px">임대 구단에서 많이 뛰고 있는 선수일수록 놓아주지 않습니다. 완전이적 옵션이 걸린 임대는 더 어렵습니다.<br>
        <span class="lcArmy">🎖️ 금색 이름</span>은 <b>병역 이행 중</b>입니다 — 전역일까지 데려올 수 없고, 그동안 <b>원소속과의 계약 기간은 흐르지 않습니다</b>.</p>`
      :`<p class="small">임대 보낸 선수가 없습니다.</p>`}
    </div>`;
  } else if(lcTab==="in"){
    body=`<div class="card"><h3>📥 임대 영입 <span class="small">— 이적료 없이 주급만 분담합니다</span></h3>
      <div class="msg info">임대는 <b>원소속에서 출전 기회를 못 받는 선수</b>만 대상입니다. 주전·핵심 자원은 문의해도 거절당합니다.
        시즌당 <b>${LOAN_IN_MAX}명</b>까지 · 현재 <b>${came.length}명</b>${came.length>=LOAN_IN_MAX?' <span style="color:var(--red)">(한도 도달)</span>':""}</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <input type="text" placeholder="🔍 이름으로 찾기 (초성 가능)" value="${lcQ.replace(/"/g,"&quot;")}"
          oninput="lcSearch(this.value)" style="flex:1;min-width:180px;padding:9px 10px;font-size:15px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg)">
        <button class="mini ${lcOnly?'sel':''}" onclick="lcToggleOnly()">${lcOnly?"☑":"☐"} 임대 가능만</button>
      </div>
      <div id="lcList" class="tblScroll" style="max-height:62vh;overflow-y:auto;-webkit-overflow-scrolling:touch">${lcInList()}</div>
    </div>`;
  } else if(lcTab==="out"){
    /* 전 선수 대상 — 어리고 못 뛰는 선수를 위로 올리되, 누구든 보낼 수 있게 한다 */
    const all=t.players.filter(p=>!p.loan);
    const recIds=new Set(cands.map(p=>p.id));
    const xiIds=new Set((bestXI(t)||[]).map(q=>q.id));   // 진짜 「주전급」은 지금 선발인 선수뿐이다
    body=`<div class="card"><h3>📤 임대 보내기 <span class="small">— 선수단 전체 (${all.length}명) · 추천 대상이 위로 옵니다</span></h3>
    ${all.length?`<div class="tblScroll" style="max-height:62vh;overflow-y:auto;-webkit-overflow-scrolling:touch"><table><tr>${sortTh("loan","name","이름")}${sortTh("loan","pos","포지션")}${sortTh("loan","age","나이")}${sortTh("loan","ovr","능력")}${sortTh("loan","aff","호감도")}${sortTh("loan","apps","올 시즌")}<th>상태</th><th></th></tr>
    ${applySort("loan", [...all].sort((a,b)=>(recIds.has(b.id)?1:0)-(recIds.has(a.id)?1:0) || (a.apps||0)-(b.apps||0)),
      {name:p=>p.name, pos:p=>prefSlotOf(p), age:p=>G.season-p.by, ovr:p=>sortLv(p), aff:p=>aff(p), apps:p=>p.apps||0}, "").map(p=>{
      const A=affLabel(aff(p)); const rec=recIds.has(p.id);
      const starter=xiIds.has(p.id);
      const _age=G.season-p.by;
      /* 흐리게 두는 건 「진짜 선발」뿐 — 나머지는 언제든 보낼 수 있으니 버튼도 또렷하게 */
      /* ⚠ 제보 — 「임대 보내기 창에 이름·나이는 나오는데 포지션이 안 나온다」 */
      return `<tr${starter?' style="opacity:.72"':""}><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</td>
      <td class="pos-${p.pos}" title="${p.pos}"><b>${prefSlotOf(p)}</b></td>
      <td>${G.season-p.by}</td><td>${abilityStars(p)}</td>
      <td title="감독 호감도">${A.ic} <b style="color:${A.c}">${Math.round(aff(p))}</b></td>
      <td>${p.apps||0}경기</td>
      <td class="small">${
        starter ? '<span class="small" style="opacity:.7">주전</span>'
        : rec ? ((p.apps||0)<=3
            ? `<span class="tag" style="background:#2ea04333;color:#3fb950">추천 · ${(p.apps||0)===0&&_age<=20?"유스 졸업":"출전 부족"}</span>`
            : '<span class="tag" style="background:#2ea04333;color:#3fb950">추천</span>')
        : (_age>LOAN_MAX_AGE ? '<span class="small" style="opacity:.75">성장기 지남</span>'
                             : '<span class="small" style="opacity:.75">로테이션</span>')}</td>
      <td>${wi.open?`<button class="mini" style="${rec?"border-color:var(--gold);color:var(--gold);font-weight:800":""}" onclick="openLoanOut(${p.id})">🔁 임대 보내기</button>`:'<span class="small">이적시장 닫힘</span>'}</td></tr>`;}).join("")}
    </table></div>`:`<p class="small">임대를 보낼 선수가 없습니다.</p>`}
    </div>`;
  } else {
    const cards=(typeof loanOfferCard==="function"?loanOfferCard():"")+(typeof loanAskCard==="function"?loanAskCard():"");
    body=cards.trim()?cards:`<div class="card"><p class="small">들어온 임대 제안이 없습니다.<br><br>
      · 타 구단이 <b>우리 선수를 빌려가겠다</b>고 문의하거나<br>
      · <b>자기 유망주를 맡아 달라</b>고 제안해 오면 여기에 표시됩니다.<br><br>
      <span class="small">이적시장이 열려 있을 때 시간을 보내면 연락이 옵니다.</span></p></div>`;
  }
  return `<h2>🔁 임대 센터</h2>
  <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">
    ${tab("status","📋 현황"+((came.length+sentOut.length)?` (${came.length+sentOut.length})`:""))}
    ${tab("in","📥 임대 영입")}
    ${tab("out","📤 임대 보내기")}
    ${tab("offer","📨 받은 제안"+((asks+offers)?` 🔴${asks+offers}`:""))}
  </div>
  ${body}`;
}
function contractView(){
  const t=userTeam(); const wi=windowInfo();
  ctTabSafe();
  const exp=expiringSoon();
  const urgent=exp.filter(p=>(p.ct||1)<=1);
  const listed=(G.transferBids||[]).map(b=>t.players.find(p=>p.id===b.pid)).filter(Boolean);
  const tab=(k,l)=>`<button class="mini ${ctTab===k?'sel':''}" style="padding:8px 18px;font-size:14px" onclick="setCtTab('${k}')">${l}</button>`;
  const ctCol=n=>n<=1?"var(--red)":n<=2?"var(--gold)":"var(--sub)";
  let body="";

  if(ctTab==="renew"){
    const allCt=applySort("renew", [...t.players].filter(p=>!p.loan).sort((a,b)=>(a.ct||1)-(b.ct||1)||b.ovr-a.ovr),
      {name:p=>p.name, pos:p=>p.pos, age:p=>G.season-p.by, ovr:p=>sortLv(p), aff:p=>aff(p),
       wage:p=>p.wage||0, ct:p=>p.ct||1, ask:p=>{const a=renewAsk(p); return (a&&(a.wage||a.ask))||0;}}, "");
    body=`${urgent.length?`<div class="msg warn" style="border-width:2px">⏳ <b>올 시즌 안에 잡아야 할 계약 ${urgent.length}건</b> —
      시즌이 끝나면 자유계약(FA)으로 팀을 떠납니다. 이적료 한 푼 못 받습니다.</div>`
     :`<div class="msg good">✅ 당장 만료되는 계약은 없습니다.</div>`}
    <div class="card"><h3>📄 계약 현황 <span class="small">— 머리글을 눌러 정렬할 수 있습니다 (기본: 잔여 기간 짧은 순)</span></h3>
    <div class="tblScroll"><table><tr>${sortTh("renew","name","이름")}${sortTh("renew","pos","포지션")}${sortTh("renew","age","나이")}${sortTh("renew","ovr","능력")}${sortTh("renew","aff","호감도")}${sortTh("renew","wage","연봉")}${sortTh("renew","ct","잔여 계약")}${sortTh("renew","ask","요구 조건")}<th></th></tr>
    ${allCt.map(p=>{ const a=renewAsk(p); const ct=p.ct||1; const A=affLabel(aff(p));
      return `<tr><td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}${pTags(p)}</td>
      <td class="pos-${p.pos}">${p.pos}</td><td>${G.season-p.by}</td><td>${abilityStars(p)}</td>
      <td title="감독 호감도 ${Math.round(aff(p))}/100">${A.ic} <b style="color:${A.c}">${Math.round(aff(p))}</b></td>
      <td class="small">${p.wage}억</td>
      <td><b style="color:${ctCol(ct)}">${ct}년</b>${ct<=1?' <span class="tag inj">만료 임박</span>':""}</td>
      <td class="small">${a.want}억 · ${a.years}년</td>
      <td>${renewLockLeft(p)>0
        ? `<span class="small" title="최근 재계약">🔒 ${Math.ceil(renewLockLeft(p)/30)}개월 뒤</span>`
        : `<button class="mini" onclick="openRenew(${p.id})">📝 재계약</button>`}</td></tr>`;}).join("")}
    </table></div></div>`;
  } else {
    body=`<div class="card"><h3>📤 판매 · 이적명단 <span class="small">등록하면 제의가 빨리 옵니다 (제의 처리는 <b>📨 타 구단 제의</b> 탭)</span></h3>
    <p class="small">등록 중: ${listed.length?listed.map(p=>p.name).join(", "):"없음"}</p>
    <div class="tblScroll"><table><tr>${sortTh("sell","name","이름","ovr")}${sortTh("sell","pos","포지션","ovr")}${sortTh("sell","age","나이","ovr")}${sortTh("sell","ovr","능력","ovr")}${sortTh("sell","ct","잔여 계약","ovr")}${sortTh("sell","mv","가치","ovr")}${sortTh("sell","unhappy","상태","ovr")}<th></th></tr>
    ${applySort("sell", [...t.players].filter(p=>!p.loan),
      {name:p=>p.name, pos:p=>p.pos, age:p=>G.season-p.by, ovr:p=>sortLv(p),
       ct:p=>p.ct||1, mv:p=>marketValue(p), unhappy:p=>p.unhappy||0}, "ovr").map(p=>`<tr>
      <td class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}${pTags(p)}</td>
      <td class="pos-${p.pos}">${p.pos}</td><td>${G.season-p.by}</td><td>${abilityStars(p)}</td>
      <td><b style="color:${ctCol(p.ct||1)}">${p.ct||1}년</b></td>
      <td>${marketValue(p)}억</td>
      <td>${p.unhappy>=3?'<span class="tag inj">이적 요청</span>':p.unhappy>0?'<span class="tag" style="background:#d2992233;color:#d29922">불만</span>':""}</td>
      <td>${(function(){ const b=(G.transferBids||[]).find(x=>x.pid===p.id);
          if(!b) return `<button class="mini" onclick="listForSale(${p.id});show('contract')">리스트 등록</button>`;
          const w=(G.offers||[]).filter(o=>o.pid===p.id).length;
          const dd=Math.max(0,(G.day||0)-(b.d0!=null?b.d0:(G.day||0)));
          return `<span class="small" style="color:var(--sub)" title="등록 후 경과일 · 지금 제의 탭에 대기 중인 건수">D+${dd} · 제의 ${w}건</span>
            <button class="mini" onclick="unlist(${p.id});show('contract')">등록 해제</button>`; })()}</td></tr>`).join("")}
    </table></div></div>`;
  }
  return `<h2>📝 재계약 · 판매</h2>
  <div style="margin-bottom:12px">
    ${tab("renew","📄 재계약"+(urgent.length?" 🔴":""))}
    ${tab("sell","📤 판매/이적명단"+(listed.length?` (${listed.length})`:""))}
  </div>
  ${body}`;
}
/* ── 재계약·임대에 대한 여론 ────────────────────────────────────
   팬들은 영입만 보지 않는다. 주축을 잡았는지, 유망주를 어디로 보냈는지가 더 오래 회자된다.
   선수의 급(별점)과 나이에 따라 반응의 결이 달라야 한다. */
function renewSocial(p, kind){
  const t=userTeam(); if(!t) return;
  const V={p:p.name, t:t.short, o:""};
  const star=(playerLevel(p)-starRefLevel())*STAR_GAIN >= 20;   // 팀의 얼굴급인가
  const vet=(G.season-p.by)>=32;
  if(kind==="ok"){
    const pool = star ? SOC.renewStar : vet ? SOC.renewVet : SOC.renewOk;
    socialFill(pool, 3+R(3), 1, V);
    if(star){ fmkFill(FMK.renewStar, 2+R(2), V); rivalFill(FMK.renewStar, 1, 0, V); }
  } else if(kind==="fail"){
    socialFill(SOC.renewFail, 2+R(3), -1, V);
  } else if(kind==="leave"){
    socialFill(SOC.renewLeave, 3+R(3), -1, V);
    fmkFill(FMK.renewLeave, 2+R(2), V);
    rivalFill(FMK.renewLeave, 1+R(2), 0, V);
  }
}
function loanSocial(p, club, kind){
  const t=userTeam(); if(!t) return;
  const V={p:p.name, t:t.short, o:club?club.short:""};
  try{
    if(kind==="out"){
      // 주전급을 내보내면 팬이 화를 낸다
      const key=(p.apps||0)>=10 && p.ovr>=72 ? SOC.loanBad : SOC.loanOut;
      socialFill(key, 3+R(3), key===SOC.loanBad?-1:1, V);
      fmkFill(FMK.loanOut, 2+R(2), V);
    } else if(kind==="refuse"){
      socialFill(SOC.loanRefuse, 2+R(2), 0, V);
    } else if(kind==="back"){
      /* 임대에서 돌아왔다 — 성과에 따라 결이 갈린다 */
      const played=(p.apps||0)-((p.loan&&p.loan.apps0)||0);
      const good = played>=12 || (p.seasonRating||0)>=7.30;
      socialFill(good?SOC.loanReturn2:SOC.loanBack, 2+R(2), good?1:0, V);
    } else if(kind==="in"){
      socialFill(SOC.loanIn, 2+R(2), 1, V); fmkFill(FMK.loanIn, 1+R(2), V);
    } else if(kind==="recall"){
      socialFill(SOC.loanRecall, 2+R(2), -1, V); fmkFill(FMK.loanRecall, 1+R(2), V);
    } else if(kind==="buy"){
      socialFill(SOC.loanBuy, 3+R(2), 1, V); fmkFill(FMK.loanBuy, 1+R(2), V);
    }
  }catch(e){}
}
/* 판단에 들어간 항목을 그대로 펼쳐 보여 준다 — 무엇을 고쳐야 잡히는지가 보여야 협상이 게임이 된다 */
function factorCard(title, F, generic){
  if(!F||!F.length) return "";
  const sorted=[...F].sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
  const bar=v=>{ const w=Math.min(100, Math.abs(v)*260);
    return `<span style="display:inline-block;width:90px;height:8px;background:#21262d;border-radius:4px;vertical-align:middle;position:relative">
      <span style="position:absolute;${v>0?"left:50%":"right:50%"};top:0;height:8px;width:${w/2}%;background:${v>0?"var(--green)":"var(--red)"};border-radius:4px"></span></span>`; };
  return `<div class="card"><h3>🔍 ${title}</h3>
    <table style="width:100%">
    ${sorted.map(x=>`<tr><td class="small" style="width:60%">${x.label}</td>
      <td style="width:110px">${bar(x.v)}</td>
      <td class="small" style="text-align:right;color:${x.v>0?"var(--green)":"var(--red)"}">${x.v>0?"+":""}${Math.round(x.v*100)}</td></tr>`).join("")}
    </table>
    <p class="small" style="margin-top:6px">${generic?"구단마다 값이 다릅니다 — 아래 표의 수락 가능성을 보세요.":"녹색은 붙잡는 힘, 붉은색은 밀어내는 힘입니다."}</p></div>`;
}
/* ---------- 재계약 협상 화면 ---------- */
function renewView(){
  const t=userTeam();
  if(!RENEW) return transfer();
  const p=t.players.find(x=>x.id===RENEW.pid);
  if(!p){ RENEW=null; return squad(); }
  const back=retBtn("squad", "RENEW=null;");
  if(RENEW.done==="ok"){
    return `<h2>📝 재계약 — ${p.name} ${back}</h2>
      <div class="msg good" style="border-width:2px"><b>계약이 성사됐습니다.</b><br>${p.name}: ${RENEW.say}</div>
      <div class="card"><p>연봉 <b>${RENEW.wage}억</b> · 계약 <b>${RENEW.years}년</b>
        <span class="small">(재계약 전 잔여 ${RENEW.was||"?"}년 → ${RENEW.years}년)</span></p>
        <button class="bigbtn" style="max-width:260px;margin-top:10px" onclick="RENEW=null;retBack('contract')">✅ ${(RET_NAME[retView("contract")]||"돌아가기").replace("← ","")}(으)로 돌아가기</button></div>`;
  }
  if(RENEW.done==="no"){
    return `<h2>📝 재계약 — ${p.name} ${back}</h2>
      <div class="msg warn"><b>거절당했습니다.</b><br>${p.name}: ${RENEW.say}<br>
        <span class="small">${RENEW.hint||""}</span></div>
      <div class="card">
        <button class="mini" onclick="openRenew(${p.id})">🔁 조건을 올려 다시 제안</button>
        <button class="mini" onclick="RENEW=null;retBack('contract')">${(RET_NAME[retView("contract")]||"← 돌아가기")}</button>
        <p class="small" style="margin-top:6px">무성의한 제시는 사기와 호감도를 깎습니다.</p>
        ${RENEW.noRetry?`<p class="small" style="margin-top:10px;color:var(--red)">이미 설득을 시도했습니다. 이번 라운드에는 더 이상 말이 통하지 않습니다.</p>`
        :RENEW.canPersuade?`<h3 style="margin-top:12px">🗣️ 직접 설득하기 <span class="small">— 라운드당 1회, 실패하면 관계가 상합니다</span></h3>
          ${Object.keys(RENEW_TALK).map(k=>{ const c=persuadeChance(p,k,"renew");
            const L=c>=0.65?["유력","var(--green)"]:c>=0.4?["반반","var(--gold)"]:["희박","var(--red)"];
            return `<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px${k==="pressure"?";border-color:var(--red)":""}"
              onclick="renewPersuade('${k}')">${RENEW_TALK[k].n}
              <span class="small">${RENEW_TALK[k].d} — 성공 <b style="color:${L[1]}">${L[0]}</b></span></button>`;}).join("")}`
        :`<p class="small" style="margin-top:10px">이번 라운드 설득 기회를 이미 썼습니다.</p>`}
      </div>`;
  }
  const ask=renewAsk(p), age=G.season-p.by;
  const ch=renewChance(p, RENEW.wage, RENEW.years, RENEW.promise);
  const room=Math.round((wageRoom(t)+(p.wage||0))*10)/10;
  const lv=ch>=0.7?["매우 높음","var(--green)"]:ch>=0.45?["보통","var(--gold)"]:ch>=0.25?["낮음","#f0883e"]:["희박","var(--red)"];
  return `<h2>📝 재계약 협상 — ${p.name} ${back}</h2>
  <div class="msg info">${age}세 ${POS_KO[p.pos]||p.pos} · 현재 연봉 <b>${p.wage}억</b> · 잔여 계약 <b>${p.ct||1}년</b>
    ${(p.ct||1)<=CT_WARN?'<span class="tag inj">만료 임박</span>':""}<br>
    <span class="small">에이전트 요구: 연봉 약 <b>${ask.want}억</b> · <b>${ask.years}년</b> · 연봉 여유 ${room}억</span></div>
  <div class="card">
    <h3>제시 조건</h3>
    <p>연봉 <b class="money">${RENEW.wage}억</b>
      <button class="mini" onclick="renewSet('wage',-0.5)">−0.5</button>
      <button class="mini" onclick="renewSet('wage',0.5)">+0.5</button>
      <button class="mini" onclick="renewSet('wage',2)">+2</button>
      <span class="small">(요구 대비 ${Math.round(RENEW.wage/ask.want*100)}%)</span></p>
    <p>계약 기간 <b>${RENEW.years}년</b>
      <button class="mini" onclick="renewSet('years',-1)">−1</button>
      <button class="mini" onclick="renewSet('years',1)">+1</button>
      <span class="small">잔여 <b>${p.ct||1}년</b> → <b style="color:var(--green)">${RENEW.years}년</b>
        (선수 희망 ${ask.years}년 · 최소 ${Math.min(CT_MAX,(p.ct||1)+1)}년)</span></p>
    <p><button class="mini ${RENEW.promise?'sel':''}" onclick="renewSet('promise',0)">
      ${RENEW.promise?"☑":"☐"} 출전 시간 약속 (8라운드 내 5경기)</button>
      <span class="small">지키지 못하면 크게 악화됩니다</span></p>
    <p style="margin-top:10px">수락 가능성: <b style="color:${lv[1]}">${lv[0]}</b> <span class="small">(${Math.round(ch*100)}%)</span></p>
    <button class="bigbtn" style="max-width:260px" onclick="renewSubmit()">🤝 제안하기</button>
  </div>
  ${factorCard("이 협상에 작용하는 것들", renewFactors(p, RENEW.wage, RENEW.years, RENEW.promise).F)}`;
}
/* ---------- 임대 협상 화면 ---------- */
/* ── 🔁 임대 영입 화면 ─────────────────────────────────────── */
let LOANIN=null;   // {pid, fromId, share, buy, half, fee, refuse?}
function openLoanIn(pid, fromId){
  const t=userTeam();
  if(armyGate("임대 영입")) return;
  if(!transferOpen()){ gameAlert("이적시장이 닫혀 있습니다."); return; }
  if(loanInCount(t)>=LOAN_IN_MAX){ gameAlert(`임대 영입은 시즌당 ${LOAN_IN_MAX}명까지 가능합니다. (현재 ${loanInCount(t)}명)`); return; }
  const from=G.teams[fromId]; if(!from || from.isUser) return;
  const p=from.players.find(x=>x.id===pid); if(!p) return;
  const blk=loanInBlocked(p, from);
  if(blk){
    /* 문의 자체는 할 수 있다 — 다만 상대가 그 자리에서 잘라 낸다. 시도한 흔적은 남는다. */
    retMark();
    LOANIN={pid, fromId, share:0.5, buy:false, half:false, fee:null, blocked:blk};
    addNews(fixJosa(`🔁 ${from.short}이/가 ${p.name} 임대 문의를 일축했습니다.`));
    try{ if(p.ovr>=teamOVR(from)+1 && Math.random()<0.35)
      pushFeed({cat:"rumor", ic:"🔁", tone:0, tid:from.id, src:pick(MEDIA),
        head:`${userTeam().short}, ${from.short} ${p.name} 임대 타진… ${from.short} "논의 대상 아니다"`,
        sub:`${from.short} 관계자는 "핵심 자원을 임대로 내보낼 계획은 없다"고 선을 그었다.`}); }catch(e){}
    show("loanin");
    return;
  }
  retMark();                     // ↩ 임대 센터 📥 탭에서 왔으면 그 탭으로 돌아간다
  LOANIN={pid, fromId, share:0.5, buy:false, half:false, fee:loanBuyFair(p)};
  show("loanin");
}
function loanInSet(k,v){
  if(!LOANIN) return;
  const _f=G.teams[LOANIN.fromId], _p=_f&&_f.players.find(x=>x.id===LOANIN.pid);
  const fair=_p? loanBuyFair(_p) : 1;
  if(LOANIN.fee==null) LOANIN.fee=fair;
  if(k==="share") LOANIN.share=clamp(Math.round((LOANIN.share+v)*100)/100, 0, 1);
  if(k==="buy") LOANIN.buy=!LOANIN.buy;
  if(k==="half") LOANIN.half=!LOANIN.half;
  /* 💰 완전영입 이적료를 여기서 못박는다 — 적정가의 40%~250% 사이에서 부를 수 있다 */
  if(k==="fee") LOANIN.fee=clamp(Math.round((LOANIN.fee+loanBuyStep(fair)*v)*10)/10,
                                 Math.round(fair*0.40*10)/10, Math.round(fair*2.50*10)/10);
  show("loanin");
}
function loanInAsk(){
  const t=userTeam(); if(!LOANIN) return;
  const from=G.teams[LOANIN.fromId]; const p=from&&from.players.find(x=>x.id===LOANIN.pid);
  if(!p||!from){ LOANIN=null; retBack("loancenter"); return; }
  const blk=loanInBlocked(p, from);
  if(blk){ gameAlert(`🔁 <b>${from.short}</b>의 답변\n\n${blk}`); LOANIN=null; retBack("loancenter"); return; }
  const ch=loanInChance(p, from, LOANIN.share, LOANIN.buy, LOANIN.half, LOANIN.buy?LOANIN.fee:null);
  if(Math.random()>=ch){
    addNews(fixJosa(`🔁 ${from.name}이/가 ${p.name} 임대 제안을 거절했습니다.`));
    notify(fixJosa(`❌ ${from.short}이/가 ${p.name} 임대 제안을 거절했습니다. — "${pick([`그 선수는 우리 계획 안에 있습니다.`,`올 시즌은 함께 갑니다.`,`조건이 부족합니다.`])}"`),"warn");
    LOANIN=null; retBack("loancenter"); return;   // ↩ 거절당해도 있던 탭에 남는다
  }
  // 구단은 합의 — 이제 선수 본인
  if(Math.random()<loanInAccept(p, from)){
    doLoanIn(p, from, LOANIN.share, LOANIN.buy, LOANIN.half, LOANIN.buy?LOANIN.fee:null);
  } else {
    LOANIN.refuse={say:loanInRefuseSay(p, from)};
    notify(fixJosa(`🙅 ${from.short}은/는 동의했지만 ${p.name} 본인이 난색을 표합니다.`),"warn");
    show("loanin");
  }
}
function loanInView(){
  const t=userTeam();
  if(!LOANIN) return transfer();
  const from=G.teams[LOANIN.fromId];
  const p=from&&from.players.find(x=>x.id===LOANIN.pid);
  if(!p||!from){ LOANIN=null; return transfer(); }
  const back=retBtn("loancenter", "LOANIN=null;");
  const age=G.season-p.by, share=LOANIN.share;
  const myWage=Math.round(p.wage*share*10)/10;
  /* 🚫 문의는 했지만 구단이 그 자리에서 잘라 낸 경우 */
  if(LOANIN.blocked){
    const role=squadRole(p, from);
    const why = role>=0.55 ? `${from.short}에서 <b>주전</b>으로 뛰고 있는 선수입니다.`
              : p.ovr>=teamOVR(from)+0.5 ? `${from.short}의 <b>핵심 전력</b>입니다.`
              : `지금 ${from.short}이 내보낼 수 있는 상황이 아닙니다.`;
    return `<h2>🔁 임대 문의 — ${p.name} ${back}</h2>
    <div class="msg warn" style="border-width:2px">
      <b>${from.name}, 임대 논의 자체를 거부했습니다.</b><br>
      <span style="font-size:15px">${from.short} 단장: ${LOANIN.blocked}</span></div>
    <div class="card">
      <h3>${nmF(p)} <span class="small">${from.name}</span></h3>
      <p class="small"><span class="pos-${p.pos}">${p.pos}</span> · ${age}세 · ${prefSlotOf(p)} · ${abilityStars(p)} · 연봉 ${p.wage}억 · 계약 ${p.ct||1}년</p>
      <p class="small" style="margin-top:8px">${why} 임대는 출전 기회를 못 받는 선수를 내보내는 제도라, 이런 선수는 조건을 아무리 올려도 협상 테이블이 열리지 않습니다.</p>
      <p class="small" style="opacity:.85">💡 <b>완전 영입</b>이라면 이야기가 다릅니다 — 이적료를 들고 가면 협상은 시작됩니다. 또는 <b>본인이 이적을 원하는</b> 선수라면 임대도 길이 열립니다.</p>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="mini" onclick="LOANIN=null;startNego(${p.id},'${from.id}')">🤝 완전 영입으로 협상 시도</button>
        <button class="mini" onclick="LOANIN=null;retBack('loancenter')">돌아가기</button>
      </div>
    </div>`;
  }
  if(LOANIN.refuse){
    return `<h2>🔁 임대 영입 — ${p.name} ${back}</h2>
    <div class="msg warn" style="border-width:2px"><b>${from.short}은/는 동의했지만 선수가 거절했습니다.</b><br>${p.name}: ${LOANIN.refuse.say}</div>
    <div class="card"><p class="small">조건을 바꿔 다시 시도하거나, 다른 선수를 알아보세요. 출전 기회가 확실한 팀일수록 선수가 응합니다.</p>
      <button class="mini" onclick="LOANIN.refuse=null;show('loanin')">↩ 조건을 바꿔 다시 제안</button>
      <button class="mini" onclick="LOANIN=null;retBack('loancenter')">돌아가기</button></div>`;
  }
  const bFair=loanBuyFair(p);
  if(LOANIN.fee==null) LOANIN.fee=bFair;
  const bFee=Math.round(LOANIN.fee*10)/10;
  const bMood=loanBuyMood(bFee, bFair);
  const ch=loanInChance(p, from, share, LOANIN.buy, LOANIN.half, LOANIN.buy?bFee:null);
  const acc=loanInAccept(p, from);
  /* 숫자를 그대로 보여 주면 조건을 확률 게임처럼 굴리게 된다 — 협상은 감으로 하는 것이다 */
  const L=(c)=> c>=0.62?["긍정적","var(--green)"] : c>=0.42?["신중함","var(--gold)"]
              : c>=0.22?["회의적","var(--gold)"] : ["부정적","var(--red)"];
  const l1=L(ch), l2=L(acc);
  const say1 = ch>=0.62?`"조건이 맞으면 못 할 것도 없지요."` : ch>=0.42?`"내부적으로 검토해 보겠습니다."`
             : ch>=0.22?`"솔직히 내키지는 않습니다."` : `"그 선수는 우리 계획 안에 있습니다."`;
  const say2 = acc>=0.62?`"뛸 수만 있다면 어디든 갑니다."` : acc>=0.42?`"고민해 보겠습니다."`
             : acc>=0.22?`"글쎄요... 여기서 더 해보고 싶은데요."` : `"저는 옮길 생각이 없습니다."`;
  const depth=t.players.filter(q=>q.pos===p.pos && avail(q)).length;
  return `<h2>🔁 임대 영입 — ${p.name} ${back}</h2>
  <div class="msg info">임대는 <b>이적료가 없습니다</b> — 대신 주급을 나눠 냅니다. 임대 선수는 <b>원소속 구단과의 경기에 출전할 수 없고</b>, 재계약·판매도 불가능합니다.
    시즌당 <b>${LOAN_IN_MAX}명</b>까지 빌려올 수 있습니다. (현재 ${loanInCount(t)}명)</div>
  <div class="row">
    <div class="card" style="flex:1;min-width:260px">
      <h3>${nmF(p)} <span class="small">${from.name}</span></h3>
      <p class="small"><span class="pos-${p.pos}">${p.pos}</span> · ${age}세 · ${prefSlotOf(p)} · 연봉 <b>${p.wage}억</b> · 계약 ${p.ct||1}년</p>
      <p class="small">${abilityStars(p)} · 시즌 ${p.apps||0}경기 ${p.goals||0}골 ${p.assists||0}도움${p.apps?` · 평점 ${(p.seasonRating||0).toFixed(2)}`:""}</p>
      <p class="small" style="opacity:.85">우리 팀 같은 포지션 ${depth}명 · 원소속 출전 지분 ${Math.round(playShare(p)*100)}%</p>
    </div>
    <div class="card" style="flex:1;min-width:260px">
      <h3>조건</h3>
      <p class="small">주급 분담 <b class="money">${Math.round(share*100)}%</b> — 우리가 매주 <b>${myWage}억</b>어치를 부담합니다.
        <button class="mini" style="padding:2px 10px" onclick="loanInSet('share',-0.25)">−25%</button>
        <button class="mini" style="padding:2px 10px" onclick="loanInSet('share',0.25)">+25%</button></p>
      <p class="small"><button class="mini ${LOANIN.half?'sel':''}" onclick="loanInSet('half')">${LOANIN.half?"☑":"☐"} 반 시즌만</button>
        <button class="mini ${LOANIN.buy?'sel':''}" onclick="loanInSet('buy')">${LOANIN.buy?"☑":"☐"} 완전이적 옵션</button></p>
      ${LOANIN.buy?`<div style="border:1px solid var(--gold);border-radius:8px;padding:8px 10px;margin:0 0 8px">
        <p class="small" style="margin:0">💰 완전영입 이적료 <b class="money" style="font-size:17px">${bFee}억</b>
          <span style="opacity:.7">· 적정가 ${bFair}억</span>
          <button class="mini" style="padding:2px 10px" onclick="loanInSet('fee',-1)">−</button>
          <button class="mini" style="padding:2px 10px" onclick="loanInSet('fee',1)">+</button></p>
        <p class="small" style="margin:4px 0 0;color:${bMood[1]}">🏟️ ${from.short} — "${bMood[0]}"</p>
      </div>
      <p class="small" style="opacity:.85">이 금액은 <b>계약서에 박힙니다</b> — 이후 선수가 아무리 잘해도 값은 오르지 않습니다.
        <b>시즌 중에도</b> 임대 센터에서 바로 행사해 완전 영입할 수 있습니다.</p>`:
      `<p class="small" style="opacity:.85">완전이적 옵션을 넣으면 <b>이적료를 지금 못박고</b>, 시즌 중이든 임대 종료 시점이든 그 금액으로 <b>완전 영입</b>할 수 있습니다 — 대신 상대가 부담스러워합니다.</p>`}
      <div class="msg ${ch>=0.5?"good":"warn"}" style="margin:10px 0 6px">🏟️ <b>${from.short}</b> 반응 — <b style="color:${l1[1]}">${l1[0]}</b><br><span class="small">${say1}</span></div>
      <div class="msg ${acc>=0.5?"good":"warn"}" style="margin:0 0 10px">🙋 <b>${p.name}</b> 반응 — <b style="color:${l2[1]}">${l2[0]}</b><br><span class="small">${say2}</span></div>
      <button class="bigbtn" style="max-width:280px" onclick="loanInAsk()">🔁 임대 제안하기</button>
    </div>
  </div>`;
}
function openLoanOut(pid){
  if(armyGate("임대")) return;
  const p=userTeam().players.find(x=>x.id===pid); if(!p) return;
  retMark();                     // ↩ 임대 센터에서 왔으면 임대 센터로, 계약 화면에서 왔으면 그리로
  LOANUI={pid, share:0.5, buy:false, half:false};
  show("loan");
}
function loanSet(k,v){
  if(!LOANUI) return;
  if(k==="share") LOANUI.share=clamp(Math.round((LOANUI.share+v)*100)/100, 0, 1);
  if(k==="buy") LOANUI.buy=!LOANUI.buy;
  if(k==="half") LOANUI.half=!LOANUI.half;
  show("loan");
}
function loanView(){
  const t=userTeam();
  if(!LOANUI) return contractView();
  const p=t.players.find(x=>x.id===LOANUI.pid);
  if(!p){ LOANUI=null; return contractView(); }
  const back=retBtn("contract", "LOANUI=null;");
  /* 구단은 합의했는데 선수가 거절한 상태 */
  if(LOANUI.refuse){
    const r=LOANUI.refuse, club=G.teams[r.club];
    return `<h2>🔁 임대 — ${p.name} ${back}</h2>
    <div class="msg warn" style="border-width:2px">
      <b>${club.short}과/와는 합의했지만 선수가 거절했습니다.</b><br>${p.name}: ${r.say}
      ${r.say2?`<br><span class="small">${p.name}: ${r.say2}</span>`:""}</div>
    <div class="card">
      ${r.done?`<p class="small" style="color:var(--red)">설득에 실패했습니다. 이번 라운드에는 더 말이 통하지 않습니다.</p>
        <button class="mini" onclick="LOANUI=null;retBack('contract')">돌아가기</button>`
      :r.canPersuade?`<h3>🗣️ 설득하기 <span class="small">— 라운드당 1회, 실패하면 관계가 상합니다</span></h3>
        ${Object.keys(RENEW_TALK).map(k=>{ const c=persuadeChance(p,k,"loan");
          const L=c>=0.65?["유력","var(--green)"]:c>=0.4?["반반","var(--gold)"]:["희박","var(--red)"];
          return `<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px${k==="pressure"?";border-color:var(--red)":""}"
            onclick="loanPersuade('${k}')">${RENEW_TALK[k].n}
            <span class="small">${RENEW_TALK[k].d} — 성공 <b style="color:${L[1]}">${L[0]}</b></span></button>`;}).join("")}
        <button class="mini" style="margin-top:6px" onclick="LOANUI={pid:${p.id},share:${r.share},buy:${r.buy},half:${r.half}};show('loan')">↩ 조건을 바꿔 다른 구단에</button>`
      :`<p class="small">이번 라운드 설득 기회를 이미 썼습니다.</p>
        <button class="mini" onclick="LOANUI=null;retBack('contract')">돌아가기</button>`}
    </div>`;
  }
  const age=G.season-p.by, share=LOANUI.share;
  // 받아 줄 만한 구단 — 그 자리가 급하고, 우리보다 아래이거나 비슷한 팀부터
  /* ⚠ 제보 — 「임대 갈 구단에 김천 상무가 포함되어 있다」. 상무는 입대로만 선수를 받는다. */
  const cands=Object.values(G.teams).filter(c=>c.id!==t.id && !(typeof isArmyTeam==="function"&&isArmyTeam(c)))
    .map(c=>({c, ch:loanOutChance(p, c, share, LOANUI.buy, LOANUI.half)}))
    .sort((a,b)=>b.ch-a.ch).slice(0,8);
  const lvl=c=>c>=0.7?["수락 유력","var(--green)"]:c>=0.45?["가능","var(--gold)"]:c>=0.25?["난색","#f0883e"]:["거절 유력","var(--red)"];
  return `<h2>🔁 임대 보내기 — ${p.name} ${back}</h2>
  ${(p.ct||1)<=1?`<div class="msg warn" style="border-width:2px">⚠️ <b>계약이 ${p.ct||1}년 남았습니다.</b>
    임대를 보내면 복귀할 때쯤 계약이 끝나 <b>자유계약(FA)으로 팀을 떠날 수</b> 있습니다.
    <span class="small">보내기 전에 🤝 재계약을 먼저 마치는 편이 안전합니다.</span></div>`:""}
  <div class="msg info">${age}세 ${POS_KO[p.pos]||p.pos} · ${abilityStars(p)} · 연봉 ${p.wage}억 · 계약 <b>${p.ct||1}년</b> · 올 시즌 ${p.apps||0}경기
    ${age>=LOAN_MIN_AGE&&age<=LOAN_MAX_AGE?'<span class="tag" style="background:#3fb95033;color:#3fb950">성장기</span>':""}<br>
    <span class="small">벤치에 두면 성장이 멈춥니다. 하부 리그에서 90분을 뛰는 편이 나을 때가 있습니다.</span></div>
  <div class="card">
    <h3>임대 조건</h3>
    <p>우리 주급 분담 <b>${Math.round(share*100)}%</b>
      <button class="mini" onclick="loanSet('share',-0.25)">−25%</button>
      <button class="mini" onclick="loanSet('share',0.25)">+25%</button>
      <span class="small">많이 낼수록 받아 주는 팀이 늘어납니다 (우리 부담 ${Math.round(p.wage*share*10)/10}억/년)</span></p>
    <p><button class="mini ${LOANUI.half?'sel':''}" onclick="loanSet('half',0)">${LOANUI.half?"☑":"☐"} 반 시즌 임대</button>
       <button class="mini ${LOANUI.buy?'sel':''}" onclick="loanSet('buy',0)">${LOANUI.buy?"☑":"☐"} 완전이적 옵션</button></p>
  </div>
  ${(function(){
    const sel=LOANUI.club?G.teams[LOANUI.club]:null;
    const fac=loanFactors(p, sel);
    const acc=sel?Math.round(loanPlayerAccept(p, sel)*100):null;
    const accC=acc==null?"":(acc>=65?"var(--green)":acc>=40?"var(--gold)":"var(--red)");
    const title=sel
      ? `${p.name} 선수가 <b>${sel.short}</b>(${divName(sel.div)}) 임대를 받아들일 이유 — 의향 <b style="color:${accC}">${acc}%</b>`
      : `${p.name} 선수가 임대를 받아들일 이유 <span class="small">— 아래 표에서 구단 이름을 누르면 그 팀 기준으로 계산합니다</span>`;
    return factorCard(title, fac.F, !sel);
  })()}
  <div class="card">
    <h3>임대 갈 구단 <span class="small">— 구단 이름을 누르면 위 카드가 그 팀 기준으로 바뀝니다</span></h3>
    <div class="tblScroll"><table><tr><th>구단</th><th>리그</th><th>전력</th><th>같은 포지션</th><th>구단 수락</th><th>선수 의향</th><th></th></tr>
    ${cands.map(({c,ch})=>{ const L=lvl(ch);
      const pa=Math.round(loanPlayerAccept(p, c)*100);
      const pc=pa>=65?"var(--green)":pa>=40?"var(--gold)":"var(--red)";
      const on=LOANUI.club===c.id;
      /* 거절당한 구단 — 같은(또는 더 나쁜) 조건이면 쿨다운 표시, 조건을 올렸으면 버튼이 돌아온다 */
      const rf=(p._lrefs||{})[c.id];
      /* 시즌이 지났거나(작년 거절) 선수가 성장(+2)했으면 다시 제안할 수 있다 (제보) */
      const rfBlock = rf && rf.s===G.season && !(rf.o!=null && (p.ovr||0)>=rf.o+2)
        && ((G.day||0)-rf.d)<7 && ((G.day||0)-rf.d)>=0
        && share<=rf.sh && (LOANUI.buy?1:0)>=rf.b && (LOANUI.half?1:0)>=rf.h;
      return `<tr${on?' style="background:#1f6feb1c"':""}>
      <td class="clickable" style="text-decoration:underline dotted;text-underline-offset:3px" title="이 구단 기준으로 수락 이유를 봅니다" onclick="LOANUI.club='${c.id}';show('loan')">${on?"▶ ":""}${c.name}</td>
      <td>${divName(c.div)}</td>
      <td>${teamStars(c, c.short)}</td><td>${c.players.filter(q=>q.pos===p.pos).length}명</td>
      <td><b style="color:${L[1]}">${L[0]}</b></td>
      <td title="선수 본인이 이 팀 임대를 받아들일 의향"><b style="color:${pc}">${pa}%</b></td>
      <td>${rfBlock?`<span class="small" style="color:var(--red)" title="조건을 올리면 바로 다시 제안할 수 있습니다">거절함 · D-${7-((G.day||0)-rf.d)}</span>`
                   :`<button class="mini" onclick="loanOut(${p.id},'${c.id}',${share},${LOANUI.buy},${LOANUI.half})">제안</button>`}</td></tr>`;}).join("")}
    </table></div>
  </div>`;
}
