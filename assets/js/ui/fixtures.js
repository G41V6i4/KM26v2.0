"use strict";
/* ---------- 일정 ---------- */
/* ── 🌏 EACL 카드 — 대진 추첨 · 리그 스테이지 순위 · 내 일정 · 토너먼트 ── */
/* 🏴 국기 — 유니코드 국기 이모지(🇰🇷)는 윈도우에서 렌더링되지 않고 "KR" 두 글자로 나온다.
   FMK 공유용이라 대다수가 윈도우다. 그래서 이모지 대신 인라인 SVG로 직접 그린다. */
const EACL_FLAG_SVG={
  "한국":`<rect width="30" height="20" fill="#fff"/>
    <path d="M11 10a4 4 0 0 1 8 0z" fill="#cd2e3a"/><path d="M11 10a4 4 0 0 0 8 0z" fill="#0047a0"/>
    <g fill="#111"><rect x="3" y="4.2" width="5" height="1.1"/><rect x="3" y="14.7" width="5" height="1.1"/>
    <rect x="22" y="4.2" width="5" height="1.1"/><rect x="22" y="14.7" width="5" height="1.1"/></g>`,
  "일본":`<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5.4" fill="#bc002d"/>`,
  "중국":`<rect width="30" height="20" fill="#de2910"/>
    <polygon fill="#ffde00" points="5,1.8 5.72,4.01 8.04,4.01 6.16,5.38 6.88,7.59 5,6.22 3.12,7.59 3.84,5.38 1.96,4.01 4.28,4.01"/>
    <g fill="#ffde00"><circle cx="10.4" cy="2.4" r="0.95"/><circle cx="12.4" cy="4.6" r="0.95"/><circle cx="12.4" cy="7.6" r="0.95"/><circle cx="10.4" cy="9.7" r="0.95"/></g>`,
  "태국":`<rect width="30" height="20" fill="#a51931"/><rect y="3.33" width="30" height="13.34" fill="#f4f5f8"/><rect y="6.67" width="30" height="6.66" fill="#2d2a4a"/>`,
  "말레이시아":`<rect width="30" height="20" fill="#cc0001"/>
    <g fill="#fff"><rect y="1.43" width="30" height="1.43"/><rect y="4.29" width="30" height="1.43"/><rect y="7.14" width="30" height="1.43"/>
    <rect y="10" width="30" height="1.43"/><rect y="12.86" width="30" height="1.43"/><rect y="15.71" width="30" height="1.43"/><rect y="18.57" width="30" height="1.43"/></g>
    <rect width="16" height="11.43" fill="#010066"/>
    <circle cx="6.4" cy="5.6" r="3.3" fill="#ffcc00"/><circle cx="7.9" cy="5.6" r="2.8" fill="#010066"/>
    <polygon fill="#ffcc00" points="11.5,2.9 12.08,4.7 13.97,4.7 12.44,5.81 13.03,7.6 11.5,6.49 9.97,7.6 10.56,5.81 9.03,4.7 10.92,4.7"/>`
};
function eaclFlag(nat, big){
  const b=EACL_FLAG_SVG[nat];
  const w=big?21:16, h=Math.round(w/1.5);
  if(!b) return `<span style="display:inline-block;width:${w}px;height:${h}px;border-radius:2px;background:#39414d;margin-right:5px;vertical-align:-1px"></span>`;
  return `<svg viewBox="0 0 30 20" width="${w}" height="${h}" style="border-radius:2px;margin-right:5px;vertical-align:-1px;box-shadow:0 0 0 1px rgba(255,255,255,.18)">${b}</svg>`;
}
function eaclDot(id){ const t=eaclTeam(id); return t?eaclFlag((t&&t.nat)||"한국"):""; }
function eaclNm(id, full){
  const t=eaclTeam(id); if(!t) return "?";
  const me=id===G.userTeamId;
  /* 클럽명을 누르면 스쿼드가 열린다 — K리그 팀이든 EACL 클럽이든 같은 화면을 쓴다 */
  return `<span class="clickable peekOK" onclick="openTeamSquad('${id}')" title="${t.name} 스쿼드 보기"
    style="text-decoration:underline dotted;text-underline-offset:3px;${me?"font-weight:800;color:var(--acc)":""}">${eaclDot(id)}${full?t.name:t.short}</span>`;
}
function eaclStageLabel(){
  return {draw:"리그 스테이지", qf:"8강", sf:"4강", f:"결승", end:"종료"}[(G.eacl&&G.eacl.stage)||"draw"]||"";
}
/* 🌏 일정 화면용 — 우리 경기 일정만 간단히. 순위표·대진표는 「순위표 → EACL」 탭에 있다 */
function eaclSchedCard(){
  if(!eaclOn() || G.jobless) return "";
  const E=G.eacl, me=G.userTeamId;
  if(E.teams.indexOf(me)<0) return "";
  const rows=[];
  for(const m of E.fix.filter(x=>x.h===me||x.a===me).sort((x,y)=>x.d-y.d)){
    const home=m.h===me, opp=eaclTeam(home?m.a:m.h);
    const my=home?m.hg:m.ag, op=home?m.ag:m.hg;
    rows.push({label:`${m.d+1}차전`, day:eaclMdDay(m.d), home, opp, done:m.done, my, op});
  }
  const K=E.ko;
  for(const st of ["qf","sf","f"]){
    const ties = st==="f" ? [K.f] : (K[st]||[]);
    for(const t of (ties||[])){
      if(!t || (t.h!==me && t.a!==me)) continue;
      const home=t.h===me, opp=eaclTeam(home?t.a:t.h);
      rows.push({label:EACL_KO_NAME[st], day:eaclKoDay(st), home, opp,
                 done:t.done, my:home?t.hg:t.ag, op:home?t.ag:t.hg, pk:t.pk});
    }
  }
  if(!rows.length) return "";
  const W=rows.filter(r=>r.done&&r.my>r.op).length, D=rows.filter(r=>r.done&&r.my===r.op).length,
        L=rows.filter(r=>r.done&&r.my<r.op).length;
  const next=rows.find(r=>!r.done);
  return `<div class="card"><h3>🌏 ${eaclName()} 일정
    <span class="small">— ${W}승 ${D}무 ${L}패${next?` · 다음 경기 ${dateLabel(next.day)} ${next.home?"홈":"원정"} ${next.opp.short}`:""}</span></h3>
    <div class="tblScroll"><table>
      <tr><th>단계</th><th>날짜</th><th>장소</th><th style="text-align:left">상대</th><th>결과</th></tr>
      ${rows.map(r=>{
        const res=r.done
          ? `<b style="color:${r.my>r.op?"var(--green)":r.my===r.op?"var(--gold)":"var(--red)"}">${r.my} : ${r.op}</b>${r.pk?'<span class="small"> (승부차기)</span>':""}`
          : `<span class="small" style="opacity:.6">예정</span>`;
        return `<tr${!r.done&&r===next?' style="background:rgba(80,160,255,.10)"':''}>
          <td>${r.label}</td><td class="small">${dateLabel(r.day)}</td><td>${r.home?"홈":"원정"}</td>
          <td style="text-align:left">${eaclNm(r.home?(r.opp.id.indexOf("eacl_")===0?r.opp.id:r.opp.id):r.opp.id, true)}</td>
          <td>${res}</td></tr>`;
      }).join("")}
    </table></div>
    <p class="small" style="opacity:.65;margin-top:6px">순위표·대진 추첨·토너먼트는 <b>🏆 순위표 → 🌏 ${eaclShort()}</b> 탭에서 볼 수 있습니다.</p>
  </div>`;
}
function eaclCard(){
  if(!eaclOn()) return "";
  const E=G.eacl, me=G.userTeamId, joined=E.teams.indexOf(me)>=0;
  const title=eaclName()+" · 동아시아 클럽 대항전";

  /* ① 대진 추첨 — 포트 구성 */
  const pots=E.pots.map((p,i)=>`<tr><td style="white-space:nowrap"><b>포트 ${i+1}</b></td>
    <td>${p.map(id=>eaclNm(id)).join(" &nbsp; ")}</td></tr>`).join("");

  /* ② 리그 스테이지 순위표 */
  const sorted=eaclTableSorted();
  const rows=sorted.map((id,i)=>{
    const r=eaclRow(id), t=eaclTeam(id);
    const cut=i<8;
    return `<tr class="${i===0?"rank-champ":cut?"rank-acl":""}" style="${id===me?"background:rgba(80,160,255,.10)":""}">
      <td>${i+1}</td><td style="text-align:left">${eaclNm(id)}<span class="small" style="opacity:.55"> ${t&&t.nat?t.nat:"한국"}</span></td>
      <td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GF}:${r.GA}</td><td><b>${r.Pts}</b></td></tr>`;
  }).join("");

  /* ③ 내 일정 */
  const mine=!joined?"":`<div class="tblScroll" style="margin-top:8px"><table>
    <tr><th>차전</th><th>날짜</th><th>장소</th><th>상대</th><th>결과</th></tr>
    ${E.fix.filter(m=>m.h===me||m.a===me).sort((x,y)=>x.d-y.d).map(m=>{
      const home=m.h===me, opp=home?m.a:m.h;
      const my=home?m.hg:m.ag, op=home?m.ag:m.hg;
      const res=m.done?`<b style="color:${my>op?"var(--green)":my===op?"var(--gold)":"var(--red)"}">${my} : ${op}</b>`
                      :`<span class="small">${dateLabel(eaclMdDay(m.d))}</span>`;
      return `<tr><td>${m.d+1}차전</td><td class="small">${dateLabel(eaclMdDay(m.d))}</td><td>${home?"홈":"원정"}</td><td style="text-align:left">${eaclNm(opp, true)}</td><td>${res}</td></tr>`;
    }).join("")}</table></div>`;

  /* ④ 토너먼트 */
  const tie=(t, nm, st)=>{
    if(!t) return "";
    const res=t.done?`<b>${t.hg} : ${t.ag}</b>${t.pk?'<span class="small"> (승부차기)</span>':""}`
                    :`<span class="small">${st?dateLabel(eaclKoDay(st)):"예정"}</span>`;
    return `<tr><td>${nm}</td><td style="text-align:right">${eaclNm(t.h)}</td><td>${res}</td><td style="text-align:left">${eaclNm(t.a)}</td></tr>`;
  };
  let ko="";
  if(E.stage!=="draw"){
    ko=`<div class="tblScroll" style="margin-top:8px"><table>
      ${E.ko.qf.map(t=>tie(t,"8강","qf")).join("")}
      ${(E.ko.sf||[]).map(t=>tie(t,"4강","sf")).join("")}
      ${tie(E.ko.f,"결승","f")}
    </table></div>`;
    if(E.champ) ko+=`<div class="small" style="margin-top:6px">🏆 우승 — <b>${eaclTeam(E.champ).name}</b></div>`;
  }

  /* ⑤ 참가 클럽 등록 정보 — 구단 · 감독 · 구장 · 모기업이 각자 고유번호를 갖는다 */
  const uidCell=(u)=>`<span class="small" style="opacity:.5">#${u}</span>`;
  const info=E.teams.map(id=>{
    const t=eaclTeam(id); if(!t) return "";
    const isK=!!G.teams[id];
    const eid=isK?null:String(id).replace(/^eacl_/,"");
    const sd=isK?stadOf(t):(t.stad||{n:"-",cap:0});
    const sdU=isK?uidStadOf(id):uidEaclStadOf(eid);
    const ct=isK?clubType(t):null;
    const ownN=isK?ct.o:((t.own&&t.own.n)||"-");
    const ownU=isK?ct.uid:uidEaclOwnerOf(eid);
    let mgN, mgU;
    if(isK){
      mgU=uidCoachOf(id);
      if(t.isUser){ mgN="감독님 (본인)"; }
      else { const c=(typeof coachOf==="function")?coachOf(t):null; mgN=(c&&c.n)||mgrName(t); }
    } else { const c=t.coach||eaclCoach(eid); mgN=(c&&c.n)||"미상"; mgU=(c&&c.uid)||uidEaclCoachOf(eid); }
    return `<tr>
      <td style="text-align:left">${eaclNm(id)} ${uidCell(t.uid||uidClubOf(id))}</td>
      <td class="small">${isK?"한국":(t.nat||"-")}</td>
      <td style="text-align:left">${mgN} ${uidCell(mgU)}</td>
      <td style="text-align:left">${sd.n} <span class="small" style="opacity:.6">${(sd.cap||0).toLocaleString()}석</span> ${uidCell(sdU)}</td>
      <td style="text-align:left">${ownN} ${uidCell(ownU)}</td></tr>`;
  }).join("");
  const infoBox=`<details style="margin-top:8px"><summary class="small" style="cursor:pointer">🆔 참가 클럽 등록 정보 (구단 · 감독 · 구장 · 모기업)</summary>
    <div class="tblScroll" style="margin-top:6px"><table>
      <tr><th style="text-align:left">구단</th><th>국가</th><th style="text-align:left">감독</th><th style="text-align:left">홈구장</th><th style="text-align:left">모기업 · 운영주체</th></tr>
      ${info}</table></div></details>`;

  return `<div class="card"><h3>🌏 ${title}</h3>
    ${(function(){
      const H=eaclHonorOf(me);
      if(!H.champ && !H.runner && !H.qf && H.apps<=1) return "";
      const bits=[];
      if(H.champ) bits.push(`🏆 우승 <b>${H.champ}회</b>${H.seasons.length?` <span class="small">(${H.seasons.join(", ")})</span>`:""}`);
      if(H.runner) bits.push(`🥈 준우승 ${H.runner}회`);
      if(H.qf) bits.push(`🎽 8강 ${H.qf}회`);
      if(H.apps) bits.push(`<span class="small">통산 ${H.apps}회 출전</span>`);
      return `<div class="msg info" style="margin-bottom:8px">🌏 <b>${userTeam().short}</b>의 아시아 이력 — ${bits.join(" · ")}</div>`;
    })()}
    <div class="small" style="opacity:.7;margin-bottom:6px">현재 단계: <b>${eaclStageLabel()}</b> · 12개 클럽 · 각 팀 8경기 후 상위 8팀 단판 토너먼트${joined?"":" · <b>우리 팀은 미참가</b>"}</div>
    <div class="tblScroll"><table><tr><th colspan=2 style="text-align:left">🎱 추첨 포트 <span class="small" style="font-weight:400;opacity:.7">— 각 포트에서 홈 1 · 원정 1씩 뽑아 8경기</span></th></tr>${pots}</table></div>
    ${mine}
    <div class="tblScroll" style="margin-top:8px"><table>
      <tr><th>#</th><th style="text-align:left">클럽</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>${rows}</table></div>
    <div class="small" style="opacity:.6;margin-top:4px">🔵 1~8위 토너먼트 진출 — 조 없이 12팀 단일 순위표 (승점 → 골득실 → 다득점)</div>
    ${ko}
    ${(function(){
      const top=eaclTopScorers(5);
      if(!top.length) return "";
      return `<div class="tblScroll" style="margin-top:8px"><table>
        <tr><th colspan=5 style="text-align:left">🥇 우리 팀 대회 기록</th></tr>
        <tr><th style="text-align:left">선수</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>
        ${top.map(p=>`<tr><td style="text-align:left" class="clickable" onclick="showPlayerInfoPopup(event,${p.id})">${nmF(p)}</td>
          <td>${p.eacl.apps}</td><td><b>${p.eacl.goals}</b></td><td>${p.eacl.assists}</td>
          <td>${p.eacl.rn?(p.eacl.rate/p.eacl.rn).toFixed(2):"-"}</td></tr>`).join("")}
      </table></div>`;
    })()}
    ${infoBox}
  </div>`;
}
/* 📅/🏋️ ⚠ 요청 — 「일정 및 훈련 메뉴에서 일정탭과 훈련탭으로 나누자」.
   달력·연습경기·대회 일정·결과는 「언제 무슨 일이 있는가」이고,
   주간 루틴·훈련 배정·개인 훈련·조직력은 「무엇을 어떻게 시킬 것인가」다. 성격이 다르다. */
let ftTab="cal";
function ftShow(k){ if(k) ftTab=k; show("fixtures"); }
function fixtures(){
  const t=userTeam();
  /* ⚠ 제보 — 구단 정보가 없는 결과 한 줄이 섞이면 이 화면 전체가 그려지지 않았다.
     이제는 그런 줄은 건너뛰고 나머지를 그린다 — 탭이 멈추는 일은 다시 없다. */
  const my=G.results.filter(r=>r.s===G.season&&(r.hid===t.id||r.aid===t.id)
                              &&G.teams[r.hid]&&G.teams[r.aid]).slice(-40);
  const rows=my.map(r=>{
    const h=G.teams[r.hid], a=G.teams[r.aid];
    const win = (r.hid===t.id&&r.hg>r.ag)||(r.aid===t.id&&r.ag>r.hg);
    const draw=r.hg===r.ag;
    return `<tr><td>R${r.r}</td><td style="${r.hid===t.id?'font-weight:700':''}">${h.short}</td>
    <td><b style="color:${win?'var(--green)':draw?'var(--gold)':'var(--red)'}">${r.hg} : ${r.ag}</b></td>
    <td style="${r.aid===t.id?'font-weight:700':''}">${a.short}</td></tr>`;
  }).join("");
  const acl = eaclSchedCard();
  const cwcSc = (function(){ try{ return cwcSchedCard(); }catch(e){ return ""; } })();
  if(ftTab!=="train") ftTab="cal";
  const tabBtn=(k,l,sub)=>`<button class="mini ${ftTab===k?"sel":""}" style="padding:8px 18px;font-size:14px"
    onclick="ftShow('${k}')">${l}${sub?` <span class="small" style="opacity:.7">${sub}</span>`:""}</button>`;
  /* 훈련 탭에 손볼 게 남아 있으면 탭 이름 옆에 표시한다 — 탭을 나눈 뒤 놓치기 쉬운 것들 */
  const _todo=(function(){
    try{
      const idle=crew().filter(c=>acRole(c).slot && !c.assign).length;
      return idle ? `🔴${idle}` : "";
    }catch(e){ return ""; }
  })();
  const body = ftTab==="train"
    ? `${famCard()}
       ${routineCard()}
       ${acSlotCard()}
       ${indTrainCard()}
       <p class="small" style="opacity:.75;margin-top:4px">📅 특정 날짜의 강도·주제를 콕 집어 바꾸려면 <b>일정</b> 탭의 달력에서 하세요.</p>`
    : `${preseasonCard()}
       ${calendarCard()}
       ${cwcSc}
       ${acl}
       <div class="card"><h3>내 경기 결과</h3><div class="tblScroll"><table><tr><th>R</th><th>홈</th><th>스코어</th><th>원정</th></tr>${rows||"<tr><td colspan=4>아직 경기가 없습니다.</td></tr>"}</table></div></div>`;
  return `<h2>${ftTab==="train"?"🏋️ 훈련":"📅 일정"}</h2>
  <div style="margin-bottom:12px">${tabBtn("cal","📅 일정")} ${tabBtn("train","🏋️ 훈련", _todo)}</div>
  ${body}`;
}
/* ── 프리시즌 카드 — 연습경기 일정과 결과 ─────────────────── */
function preseasonCard(){
  const list=G.friendlies||[];
  /* ⚠ 제보 — 「잡아 둔 연습경기를 전부 취소하면 다시 잡는 메뉴가 안 뜬다」.
     목록이 비면 카드를 통째로 접어 버려서, 편성 도구까지 같이 사라졌다.
     프리시즌이라면 한 경기도 없어도 카드를 띄운다 — 편성 창구는 늘 열려 있어야 한다.
     (아래 본문은 이미 「잡아 둔 연습경기가 없습니다」 문구를 갖고 있다) */
  const _canEdit = G.phase==="pre" && !G.jobless && !!userTeam();
  if(!list.length && !_canEdit) return "";
  const t=userTeam();
  const openOff=(G.cal&&G.cal.openOff)||0;
  const rows=list.map(f=>{
    const opp=G.teams[f.oppId];
    const mine=f.home?f.hg:f.ag, his=f.home?f.ag:f.hg;
    const played=f.done && f.d<(G.day||0);
    const col = !played ? "var(--sub)" : mine>his?"var(--green)":mine===his?"var(--gold)":"var(--red)";
    const idx=list.indexOf(f);
    const lock = f.done || (f.d-(G.day||0))<PRE_FR_LOCK;
    const canEdit = G.phase==="pre" && !G.jobless;
    return `<tr><td>${dateLabel(f.d)}</td>
      <td>${canEdit&&!lock?`<span class="clickable" style="text-decoration:underline dotted;text-underline-offset:3px" onclick="preFlip(${idx})" title="장소 바꾸기">${f.home?"홈":"원정"}</span>`:(f.home?"홈":"원정")}</td>
      <td style="font-weight:700">${opp?opp.name:"미정"}${opp?` <span class="small" style="opacity:.7">${divName(opp.div)}</span>`:""}</td>
      <td style="color:${col};font-weight:800">${played?`${mine} : ${his}`:"예정"}</td>
      ${canEdit?`<td>${lock?`<span class="small" style="opacity:.5">${f.done?"종료":"확정"}</span>`
        :`<button class="mini" style="padding:2px 8px;font-size:11px;border-color:#f85149;color:#f85149" onclick="preDel(${idx})">✕</button>`}</td>`:""}</tr>`;
  }).join("");
  const done=list.filter(f=>f.done&&f.d<(G.day||0));
  const rec=done.reduce((a,f)=>{ const m=f.home?f.hg:f.ag, h=f.home?f.ag:f.hg;
    if(m>h) a[0]++; else if(m===h) a[1]++; else a[2]++; return a; },[0,0,0]);
  /* 🌱 편성 도구 — 프리시즌 동안에는 감독이 직접 짠다 */
  const editable = G.phase==="pre" && !G.jobless;
  const nLeft=list.filter(f=>!f.done).length;
  const est=(()=>{
    const n=list.length;
    const fam=Math.round(n*FAM_MATCH*10)/10;
    const tire=n*3;
    return `<span style="color:#3fb950">🧩 조직력 +${fam}</span> · <span style="color:#ff9d5c">😮‍💨 개막 체력 부담 ${tire}%p</span>`;
  })();
  const slots=preSlotDays();
  const dayOpt=slots.map(d=>{
    const bad=preSlotOK(d);
    const w=["일","월","화","수","목","금","토"][dayOfWeekOf(d)];
    return `<option value="${d}" ${PREF.d===d?"selected":""} ${bad?"disabled":""}>${dateLabel(d)} (${w})${bad?" — 불가":""}</option>`;
  }).join("");
  const oppOpt=Object.values(G.teams)
    .filter(x=>x.id!==t.id)
    .sort((a,b)=>(a.div-b.div)||teamOVR(b)-teamOVR(a))
    .map(x=>{ const n2=list.filter(f=>f.oppId===x.id).length;
      /* 전력은 숫자보다 별이 한눈에 읽힌다 (제보) — 우리 팀 별과 같은 눈금이다 */
      return `<option value="${x.id}" ${PREF.opp===x.id?"selected":""} ${n2>=2?"disabled":""}>${teamStarText(x)} · ${x.name} · ${divName(x.div)}${n2?` (이미 ${n2}경기)`:""}</option>`; }).join("");
  const why=editable?preAddOK(PREF.opp, PREF.d):null;
  const editor = !editable ? "" : `
    <div style="border-top:1px solid #21262d;margin-top:10px;padding-top:10px">
      <div class="small" style="margin-bottom:6px"><b>🗓️ 연습경기 잡기</b>
        <span style="color:var(--sub)">— ${nLeft}/${PRE_FR_MAX}경기 · 경기 사이 최소 ${PRE_FR_GAP}일 · 같은 구단 두 번까지</span></div>
      <div class="small" style="margin-bottom:5px;color:var(--sub)">우리 전력 ${teamStars(t)} <b>${starText(teamStarVal(t))}</b> — 상대 목록의 별과 같은 눈금입니다.</div>
      <div class="stkOrder">
        <select style="flex:1;min-width:130px;padding:8px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg)"
          onchange="preSet('d',this.value)"><option value="0">— 날짜 —</option>${dayOpt}</select>
        <select style="flex:2;min-width:160px;padding:8px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg)"
          onchange="preSet('opp',this.value)"><option value="">— 상대 구단 —</option>${oppOpt}</select>
        <button class="mini ${PREF.home?"sel":""}" onclick="preSet('home',true)">🏠 홈</button>
        <button class="mini ${PREF.home?"":"sel"}" onclick="preSet('home',false)">✈️ 원정</button>
      </div>
      <button class="mini" style="width:100%;margin-top:8px;padding:10px;border-color:var(--green);color:var(--green)"
        ${why?"disabled":""} onclick="preAdd()">＋ 연습경기 편성${why?` — ${why}`:""}</button>
      <div style="display:flex;gap:7px;margin-top:7px">
        <button class="mini" style="flex:1" onclick="preAuto()">🎲 기본 일정으로</button>
        <button class="mini" style="flex:1;border-color:#f85149;color:#f85149" onclick="preClearAll()">🚫 예정 전부 취소</button>
      </div>
    </div>`;
  return `<div class="card"><h3>🌱 프리시즌 <span class="small">— 연습경기 (순위표에 반영되지 않습니다)</span></h3>
  <p class="small">${G.phase==="pre"
      ? `개막까지 <b style="color:#fff;font-weight:800">${Math.max(0,openOff-(G.day||0))}일</b> · 전적 <b style="color:#fff;font-weight:800">${rec[0]}승 ${rec[1]}무 ${rec[2]}패</b>`
      : `프리시즌 전적 <b style="color:#fff;font-weight:800">${rec[0]}승 ${rec[1]}무 ${rec[2]}패</b>`}
    ${list.length?` · 총 <b>${list.length}경기</b> — ${est}`:""}</p>
  ${list.length?`<div class="tblScroll"><table><tr><th>날짜</th><th>장소</th><th>상대</th><th>결과</th>${editable?"<th></th>":""}</tr>${rows}</table></div>`
    :`<p class="small">잡아 둔 연습경기가 없습니다. ${editable?"아래에서 직접 편성하세요 — 한 경기도 잡지 않아도 됩니다.":""}</p>`}
  ${editor}
  <p class="small" style="margin-top:8px">연습경기는 승점·순위에 들어가지 않지만 체력·컨디션·<b>전술 적응도</b>·라커룸 분위기는 실제 경기처럼 움직입니다.
    ${editable?"많이 치르면 손발이 맞고, 적게 치르면 개막을 싱싱한 다리로 맞습니다.":""}</p></div>`;
}
/* ── 🎯 개인 훈련 카드 ─────────────────────────────────────── */
const _IND_ORD={GK:0, DF:1, MF:2, FW:3};
function indTrainCard(){
  const t=userTeam(); if(!t) return "";
  const cap=indCap(t), n=indCount(t);
  const list=[...t.players].filter(p=>!p.loan)
    .sort((a,b)=>(_IND_ORD[a.pos]||9)-(_IND_ORD[b.pos]||9) || (b.ovr||0)-(a.ovr||0));
  const opt=(p)=>{
    const cur=p.itr||"-";
    const ok=(x)=> x.k!=="gk" ? p.pos!=="GK" : p.pos==="GK";
    return `<select class="fmRoleSel" style="min-width:132px" onchange="setIndTrain(${p.id}, this.value)">
      <option value="-" ${cur==="-"?"selected":""}>— 지정 안 함</option>
      ${IND_TRAIN.filter(ok).map(x=>`<option value="${x.k}" ${cur===x.k?"selected":""}>${x.ic} ${x.n}</option>`).join("")}
    </select>`;
  };
  const row=(p)=>{
    const it=indOf(p);
    return `<tr class="fmTr">
      <td class="fmName"><span class="sqNo">${p.no||"-"}</span><b class="clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</b></td>
      <td class="fmPos pos-${p.pos}">${prefSlotOf(p)}</td>
      ${fmAgeCell(p)}
      ${bodyCell(p.cond)}
      <td>${opt(p)}</td>
      <td class="small" style="color:var(--sub)">${it?it.d:""}</td></tr>`;
  };
  /* 🎯 ⚠ 요청 — 「개인 훈련에 스크롤바 달아주고, 접었다가 펼 수 있게 해줘」.
     스쿼드 전원이 한 줄씩 깔려 카드 하나가 화면을 통째로 먹고 있었다.
     접힘 상태는 세이브에 남긴다 — 매번 다시 접게 하면 그게 더 성가시다. */
  const open=indFoldOpen();
  const assigned=list.filter(p=>p.itr && IND_BY_K[p.itr]);
  return `<div class="card"><h3 class="cardFold" onclick="indFoldToggle()">${open?"▾":"▸"} 🎯 개인 훈련
    <span class="small">— 선수마다 따로 가져가는 과제 ·
      <b style="color:${n>=cap?"var(--gold)":"var(--green)"}">${n}/${cap}명</b> 배정${open?"":" · 눌러서 펼치기"}</span></h3>
  ${!open ? (assigned.length
      ? `<p class="small" style="opacity:.85;margin:0">${assigned.slice(0,6).map(p=>`${(indOf(p)||{}).ic||""} <b>${nmF(p)}</b>`).join(" · ")}${assigned.length>6?` 외 ${assigned.length-6}명`:""}</p>`
      : `<p class="small" style="opacity:.7;margin:0">배정된 개인 과제가 없습니다.</p>`)
  : `<div class="msg info">팀 훈련 주제 위에 <b>선수별 과제</b>를 하나씩 얹습니다. 그 항목이 <b>팀 주제의 두 배 무게</b>로 오르는 대신,
    과제를 맡은 선수는 훈련일마다 몸이 조금 더 갈립니다. 부상·태업 중에는 적용되지 않습니다.<br>
    <span class="small">코치진이 한 번에 볼 수 있는 인원 <b style="color:${n>=cap?"var(--gold)":"var(--green)"}">${n} / ${cap}명</b>
    — 훈련 시설 ${trainLv(t)}등급(<b>${Math.round(2+lvEff(trainLv(t))*2)}</b>) + 코치진 <b>${crew().length}명</b>(<b>+${indStaffBonus(t)}</b>) 기준입니다.
    <b>스태프를 늘리면 더 많은 선수에게 과제를 줄 수 있습니다.</b></span></div>
  <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
    <button class="mini" onclick="autoIndTrain()">✨ 자리에 맞게 자동 배정</button>
    <button class="mini" onclick="clearIndTrain()">전체 해제</button>
    <span class="small" style="margin-left:auto;opacity:.7">${list.length}명 · 목록 안에서 스크롤됩니다</span>
  </div>
  <div class="vScroll tblScroll"><table>
    <thead><tr><th>이름</th><th>자리</th><th>나이</th><th>컨디션</th><th>개인 과제</th><th></th></tr></thead>
    <tbody>${list.map(row).join("")}</tbody>
  </table></div>`}</div>`;
}
/* 접힘 상태 — 기본은 펼침(예전 그대로). 감독이 한 번 접으면 그 선택을 세이브에 남긴다. */
function indFoldOpen(){
  G.opt=G.opt||{};
  return G.opt.indFold===undefined ? true : !G.opt.indFold;
}
function indFoldToggle(){
  G.opt=G.opt||{};
  G.opt.indFold = indFoldOpen() ? 1 : 0;
  saveGame();
  try{ ftTab="train"; }catch(e){}
  try{ show((typeof VIEW==="string"&&VIEW)?VIEW:"fixtures"); }catch(e){ show("fixtures"); }
}
/* ── 전술 적응도 카드 ─────────────────────────────────────── */
function famCard(){
  const t=userTeam(), v=Math.round(famOf(t));
  const col=v>=80?"var(--green)":v>=54?"var(--gold)":"var(--red)";
  return `<div class="card"><h3>🧩 전술 적응도</h3>
  <div class="attrRow"><span class="an">조직력</span><div class="ab"><div class="af" style="width:${v}%;background:${col}"></div></div><span class="av">${v}</span></div>
  <p class="small" style="margin-top:6px">현재 상태: <b style="color:#fff;font-weight:800">${famLabel(v)}</b>
   · 전술: <b>${styleName(t)}</b> (${(t.tactic&&t.tactic.formation)||"4-3-3"})</p>
  <p class="small">훈련일과 경기를 치를수록 오릅니다. <b>포메이션을 바꾸면 크게 떨어지고</b>(-20), 세부 전술을 손봐도 조금씩 떨어집니다.
  낮으면 패스 연결·수비 라인 간격·침투 타이밍이 눈에 띄게 흔들립니다.</p>
  ${famFresh(t)
    ? `<p class="small" style="color:var(--green)">⚡ <b>실전 감각</b> — 최근 이 전술로 경기를 치렀습니다. 앞으로 <b>${t._famUseL}일</b> 동안은 훈련을 쉬어도 조직력이 거의 깎이지 않습니다.</p>`
    : `<p class="small" style="opacity:.8">💤 이 전술로 치른 지 오래됐습니다 — 훈련을 쉬는 날마다 조직력이 조금씩 흩어집니다. 한 번 실전에 쓰면 ${FAM_USE_DAYS}일 동안 유지됩니다.</p>`}
  </div>`;
}
/* ── 주간 루틴 카드 ───────────────────────────────────────── */
const SEL_CSS='padding:4px 6px;background:var(--bg);border:1px solid var(--acc);border-radius:6px;color:var(--fg);font-size:11.5px';
function routineCard(){
  ensureTrainPlan();
  const r=G.train.routine;
  const cell=(dow)=>{
    const e=r[dow];
    const btn=(lab,t,i)=>{
      const on = e.t===t && (t==="rest"||((e.i||0)===i));
      return `<button class="mini ${on?"sel":""}" style="padding:2px 6px" onclick="setRoutine(${dow},'${t}',${i})">${lab}</button>`;
    };
    const isTr=e.t==="train";
    const foc=focusOf(e);
    const fsel=`<select style="${SEL_CSS}" ${isTr?"":"disabled"} onchange="setRoutineFocus(${dow}, this.value)">`
      + TRAIN_FOCUS.map(f=>`<option value="${f.k}" ${foc.k===f.k?"selected":""}>${f.ic} ${f.n}</option>`).join("")
      + `</select>`;
    const lsel = (isTr && foc.k==="pos")
      ? `<select style="${SEL_CSS};margin-left:4px" onchange="setRoutineFocus(${dow},'pos',this.value)">`
        + POS_LINES.map(L=>`<option value="${L.k}" ${(e.ln||"ALL")===L.k?"selected":""}>${L.n}</option>`).join("")
        + `</select>` : "";
    return `<tr><th style="width:38px">${DOW_KR[dow]}</th>
      <td style="white-space:nowrap">${btn("휴식","rest",0)} ${btn("가볍게","train",0)} ${btn("보통","train",1)} ${btn("강하게","train",2)}</td>
      <td style="white-space:nowrap">${fsel}${lsel}</td></tr>`;
  };
  const legend=TRAIN_FOCUS.map(f=>
    `<div style="display:flex;gap:7px;align-items:flex-start;margin-top:3px">
       <b style="min-width:88px;white-space:nowrap">${f.ic} ${f.n}</b>
       <span class="small" style="flex:1">${f.d}</span></div>`).join("");
  return `<div class="card"><h3>🗓️ 주간 루틴 <span class="small">— 경기가 없는 날의 기본값 (강도 · 주제)</span></h3>
  <div class="tblScroll"><table>${[1,2,3,4,5,6,0].map(cell).join("")}</table></div>
  <p class="small" style="margin-top:6px">경기일과 <b>경기 다음 날</b>은 루틴과 상관없이 각각 경기·회복으로 처리됩니다.
  달력에서 특정 날짜를 눌러 그날만 따로 지정할 수도 있습니다.</p>
  <p class="small"><b>강도</b> — 가볍게 = 체력 회복하며 가볍게 · 보통 = 균형 · 강하게 = 조직력이 빨리 오르지만 체력이 깎이고 <b>훈련 중 부상</b> 위험이 커집니다.</p>
  <div style="border-top:1px solid #21262d;margin-top:9px;padding-top:8px">
    <div class="small" style="margin-bottom:2px"><b>🏋️ 훈련 주제</b> — 같은 강훈련이라도 무엇을 반복했는지에 따라 남는 것이 다릅니다.</div>
    ${legend}
  </div></div>`;
}
/* ── 달력 ────────────────────────────────────────────────── */
let calMonth=null;
let calAnchor=null;   // calMonth 를 고정한 시점의 「오늘 달」
/* ⚠ 제보 — 달력이 이번 달로 넘어가지 않고 지난달에 멈춰 있다.
   화살표를 한 번 누르면 calMonth 가 그 달로 굳어, 날짜가 흘러 달이 바뀌어도 따라오지 않았다.
   고정한 시점의 달을 함께 기억해 두고, 오늘이 다른 달로 넘어가면 자동으로 고정을 푼다. */
function calShift(d){ calMonth=(calMonth===null?curCalMonth():calMonth)+d; calAnchor=curCalMonth(); ftShow("cal"); }
function calToday(){ calMonth=null; calAnchor=null; ftShow("cal"); }
function curCalMonth(){ const dt=dateOfDay(G.day||0); return dt.getFullYear()*12+dt.getMonth(); }
/* 🌏 이 날짜에 우리 EACL 경기가 있는가 — 달력 칸에 쓰인다 */

/* ── 🌍 CWC 화면 ───────────────────────────────────────────────────── */
/* 🏴 CWC 국기 — ⚠ 제보 원문 — 「CWC 팀별 국가 국기가 표기 안 되는데 EACL 국가 국기 표기방법으로 해줄래?」
   ─ 원인: 여기만 유니코드 국기 이모지(🇧🇷)를 쓰고 있었다. 윈도우는 국기 이모지를 그리지 않아서
     "BR" 두 글자로 나오거나 아예 빈칸이 된다. EACL 은 이미 그 이유로 인라인 SVG 를 직접 그리고 있다.
     같은 방식으로 통일한다 — 아시아 다섯 나라는 EACL 이 그려 둔 그림을 그대로 물려받는다. */
const CWC_FLAG_SVG=Object.assign({}, (typeof EACL_FLAG_SVG!=="undefined"?EACL_FLAG_SVG:{}), {
  "스페인":`<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>
    <rect x="6.2" y="7.7" width="3" height="4.6" rx="0.5" fill="#c60b1e"/>`,
  "잉글랜드":`<rect width="30" height="20" fill="#fff"/><rect x="12" width="6" height="20" fill="#ce1124"/>
    <rect y="7" width="30" height="6" fill="#ce1124"/>`,
  "독일":`<rect width="30" height="20" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/>
    <rect y="13.34" width="30" height="6.66" fill="#ffce00"/>`,
  "프랑스":`<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#002395"/>
    <rect x="20" width="10" height="20" fill="#ed2939"/>`,
  "이탈리아":`<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#009246"/>
    <rect x="20" width="10" height="20" fill="#ce2b37"/>`,
  "포르투갈":`<rect width="30" height="20" fill="#da291c"/><rect width="12" height="20" fill="#046a38"/>
    <circle cx="12" cy="10" r="3.6" fill="#ffe900"/><circle cx="12" cy="10" r="2.1" fill="#046a38"/>
    <circle cx="12" cy="10" r="1.1" fill="#fff"/>`,
  "오스트리아":`<rect width="30" height="20" fill="#ed2939"/><rect y="6.67" width="30" height="6.66" fill="#fff"/>`,
  "아르헨티나":`<rect width="30" height="20" fill="#74acdf"/><rect y="6.67" width="30" height="6.66" fill="#fff"/>
    <circle cx="15" cy="10" r="2.1" fill="#f6b40e"/><circle cx="15" cy="10" r="1.1" fill="#e0a020"/>`,
  "브라질":`<rect width="30" height="20" fill="#009b3a"/>
    <polygon points="15,2.4 27.2,10 15,17.6 2.8,10" fill="#fedf00"/>
    <circle cx="15" cy="10" r="4.2" fill="#002776"/>
    <path d="M11.2 9.0 Q15 13.0 18.9 10.3" stroke="#fff" stroke-width="1.1" fill="none"/>`,
  "이집트":`<rect width="30" height="20" fill="#ce1126"/><rect y="6.67" width="30" height="6.66" fill="#fff"/>
    <rect y="13.33" width="30" height="6.67" fill="#000"/><circle cx="15" cy="10" r="1.9" fill="#c09300"/>`,
  "모로코":`<rect width="30" height="20" fill="#c1272d"/>
    <polygon points="15,5.6 16.55,10.36 21.55,10.36 17.5,13.3 19.05,18.06 15,15.12 10.95,18.06 12.5,13.3 8.45,10.36 13.45,10.36"
      fill="none" stroke="#006233" stroke-width="0.95"/>`,
  "남아공":`<rect width="30" height="20" fill="#de3831"/><rect y="10" width="30" height="10" fill="#002395"/>
    <path d="M0 0 L3.2 0 L16.4 8.4 L30 8.4 L30 11.6 L16.4 11.6 L3.2 20 L0 20 Z" fill="#fff"/>
    <path d="M0 3.4 L1.4 3.4 L13.8 9.2 L30 9.2 L30 10.8 L13.8 10.8 L1.4 16.6 L0 16.6 Z" fill="#007a4d"/>
    <path d="M0 2.2 L12.6 10 L0 17.8 Z" fill="#ffb612"/><path d="M0 4.4 L9.6 10 L0 15.6 Z" fill="#000"/>`,
  "튀니지":`<rect width="30" height="20" fill="#e70013"/><circle cx="15" cy="10" r="5.3" fill="#fff"/>
    <circle cx="15.3" cy="10" r="3.5" fill="#e70013"/><circle cx="16.7" cy="10" r="2.8" fill="#fff"/>
    <polygon points="16.5,7.8 17.12,9.62 19.05,9.62 17.49,10.75 18.09,12.57 16.5,11.45 14.91,12.57 15.51,10.75 13.95,9.62 15.88,9.62" fill="#e70013"/>`,
  "멕시코":`<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#006847"/>
    <rect x="20" width="10" height="20" fill="#ce1126"/>
    <ellipse cx="15" cy="10" rx="2.2" ry="1.9" fill="none" stroke="#7a5c33" stroke-width="0.85"/>`,
  "미국":`<rect width="30" height="20" fill="#fff"/>
    <g fill="#b22234"><rect width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.15" width="30" height="1.54"/>
    <rect y="9.23" width="30" height="1.54"/><rect y="12.31" width="30" height="1.54"/><rect y="15.38" width="30" height="1.54"/>
    <rect y="18.46" width="30" height="1.54"/></g>
    <rect width="12.6" height="10.77" fill="#3c3b6e"/>
    <g fill="#fff"><circle cx="2.1" cy="1.9" r="0.55"/><circle cx="5.3" cy="1.9" r="0.55"/><circle cx="8.5" cy="1.9" r="0.55"/><circle cx="11.7" cy="1.9" r="0.55"/>
    <circle cx="3.7" cy="4.3" r="0.55"/><circle cx="6.9" cy="4.3" r="0.55"/><circle cx="10.1" cy="4.3" r="0.55"/>
    <circle cx="2.1" cy="6.7" r="0.55"/><circle cx="5.3" cy="6.7" r="0.55"/><circle cx="8.5" cy="6.7" r="0.55"/><circle cx="11.7" cy="6.7" r="0.55"/>
    <circle cx="3.7" cy="9.1" r="0.55"/><circle cx="6.9" cy="9.1" r="0.55"/><circle cx="10.1" cy="9.1" r="0.55"/></g>`,
  "뉴질랜드":`<rect width="30" height="20" fill="#00247d"/>
    <path d="M0 0 L12.6 10 M12.6 0 L0 10" stroke="#fff" stroke-width="2.2"/>
    <path d="M0 0 L12.6 10 M12.6 0 L0 10" stroke="#cf142b" stroke-width="1"/>
    <path d="M6.3 0 V10 M0 5 H12.6" stroke="#fff" stroke-width="3.4"/>
    <path d="M6.3 0 V10 M0 5 H12.6" stroke="#cf142b" stroke-width="1.9"/>
    <g fill="#cf142b" stroke="#fff" stroke-width="0.4">
      <circle cx="24.2" cy="4.2" r="1"/><circle cx="26.6" cy="9.6" r="1"/><circle cx="21.6" cy="11.2" r="1"/><circle cx="24.4" cy="15.6" r="1"/></g>`,
  "호주":`<rect width="30" height="20" fill="#00247d"/>
    <path d="M0 0 L12.6 10 M12.6 0 L0 10" stroke="#fff" stroke-width="2.2"/>
    <path d="M0 0 L12.6 10 M12.6 0 L0 10" stroke="#cf142b" stroke-width="1"/>
    <path d="M6.3 0 V10 M0 5 H12.6" stroke="#fff" stroke-width="3.4"/>
    <path d="M6.3 0 V10 M0 5 H12.6" stroke="#cf142b" stroke-width="1.9"/>
    <g fill="#fff"><circle cx="6.3" cy="15.2" r="1.5"/>
      <circle cx="24.2" cy="4.4" r="0.95"/><circle cx="26.7" cy="9.6" r="0.95"/><circle cx="21.7" cy="11.4" r="0.95"/>
      <circle cx="24.4" cy="16" r="0.95"/><circle cx="23.4" cy="8.2" r="0.5"/></g>`
});
function cwcNat(id){ const t=cwcTeam(id); if(!t) return "-"; return G.teams[id]?"한국":(t.nat||"-"); }
/* EACL 과 완전히 같은 방식·같은 크기로 그린다 (eaclFlag 참고) */
function cwcFlag(id, big){
  const b=CWC_FLAG_SVG[cwcNat(id)];
  const w=big?21:16, h=Math.round(w/1.5);
  if(!b) return `<span style="display:inline-block;width:${w}px;height:${h}px;border-radius:2px;background:#39414d;margin-right:5px;vertical-align:-1px"></span>`;
  return `<svg viewBox="0 0 30 20" width="${w}" height="${h}" style="border-radius:2px;margin-right:5px;vertical-align:-1px;box-shadow:0 0 0 1px rgba(255,255,255,.18)">${b}</svg>`;
}
function cwcConfOf(id){
  if(G.teams[id]||String(id).indexOf("eacl_")===0) return "AS";
  const d=cwcClubDef(String(id).replace(/^cwc_/,"")); return d?d.cf:"?";
}
function cwcDayLabel(i){ try{ return dateLabel(i); }catch(e){ return "예정"; } }
/* 조별 순위표 한 덩어리 */
function cwcGroupTable(k){
  const me=G.userTeamId, C=G.cwc;
  const rows=cwcGrpSorted(k).map((id,i)=>{
    const r=cwcRow(id), t=cwcTeam(id);
    return `<tr class="${i<2?"rank-acl":""}" style="${id===me?"background:rgba(80,160,255,.10)":""}">
      <td>${i+1}</td>
      <td style="text-align:left">${cwcFlag(id)}${cwcNm(id)}<span class="small" style="opacity:.5"> ${Math.round(teamOVR(t)||0)}</span></td>
      <td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GF}:${r.GA}</td><td><b>${r.Pts}</b></td></tr>`;
  }).join("");
  /* ⚠ 제보 원문 — 「순위표 탭의 CWC 항목에서 각 조의 박스가 A, B, C 조는 조그마한데 D 조만
     커서 A, B, C, D 조의 조별 상황 박스를 균등하게 크기를 맞춰 달라」.
     ─ 원인: 부모가 flex-wrap 이고 자식이 flex-grow:1 이었다. A·B·C 가 한 줄에 들어가고 D 만
       다음 줄로 넘어가면, 그 줄에 혼자 남은 D 가 남은 폭을 전부 먹어 혼자 커졌다.
       칸을 고정하는 grid 로 바꾼다 — 몇 개가 한 줄에 들어가든 네 조가 같은 폭이다. */
  return `<div class="cwcGrpBox">
    <div class="small" style="font-weight:800;margin-bottom:3px">${k}조</div>
    <div class="tblScroll"><table>
      <tr><th>#</th><th style="text-align:left">클럽</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>점</th></tr>
      ${rows}</table></div></div>`;
}
function cwcCard(){
  if(!cwcOn()) return "";
  const C=G.cwc, me=G.userTeamId, joined=C.teams.indexOf(me)>=0;
  const KEY=["A","B","C","D"];
  /* ① 조별 순위표 */
  const groups=`<div class="cwcGrpGrid">${KEY.map(cwcGroupTable).join("")}</div>`;
  /* ② 내 일정 */
  const myFix=!joined?"":(function(){
    const rows=C.fix.filter(m=>m.h===me||m.a===me).sort((x,y)=>x.r-y.r).map(m=>{
      const home=m.h===me, opp=home?m.a:m.h, my=home?m.hg:m.ag, op=home?m.ag:m.hg;
      const res=m.done?`<b style="color:${my>op?"var(--green)":my===op?"var(--gold)":"var(--red)"}">${my} : ${op}</b>`
                      :`<span class="small">${cwcDayLabel(C.day.g[m.r])}</span>`;
      return `<tr><td>조별 ${m.r+1}차전</td><td class="small">${cwcDayLabel(C.day.g[m.r])}</td>
        <td style="text-align:left">${cwcFlag(opp)}${cwcNm(opp,true)}</td><td>${res}</td></tr>`;
    }).join("");
    const ko=[];
    for(const st of ["qf","sf","f"]){
      const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
      for(const t of (ties||[])){
        if(!t || (t.h!==me && t.a!==me)) continue;
        const home=t.h===me, opp=home?t.a:t.h, my=home?t.hg:t.ag, op=home?t.ag:t.hg;
        const res=t.done?`<b style="color:${t.w===me?"var(--green)":"var(--red)"}">${my} : ${op}</b>${t.pk?'<span class="small"> (승부차기)</span>':""}`
                        :`<span class="small">${cwcDayLabel(C.day[st])}</span>`;
        ko.push(`<tr><td>${CWC_KO_NAME[st]}</td><td class="small">${cwcDayLabel(C.day[st])}</td>
          <td style="text-align:left">${cwcFlag(opp)}${cwcNm(opp,true)}</td><td>${res}</td></tr>`);
      }
    }
    return `<div class="tblScroll" style="margin-top:10px"><table>
      <tr><th>단계</th><th>날짜</th><th style="text-align:left">상대</th><th>결과</th></tr>${rows}${ko.join("")}</table></div>`;
  })();
  /* ③ 토너먼트 대진 */
  const tie=(t, nm, st)=>{
    if(!t) return "";
    const res=t.done?`<b>${t.hg} : ${t.ag}</b>${t.pk?'<span class="small"> (승부차기)</span>':""}`
                    :`<span class="small">${cwcDayLabel(C.day[st])}</span>`;
    const hi=(x)=>x===me?`<b style="color:var(--gold)">${cwcNm(x)}</b>`:cwcNm(x);
    return `<tr><td class="small">${nm}</td><td style="text-align:right">${cwcFlag(t.h)}${hi(t.h)}</td>
      <td>${res}</td><td style="text-align:left">${cwcFlag(t.a)}${hi(t.a)}</td></tr>`;
  };
  let ko="";
  if(C.stage!=="grp"){
    ko=`<div class="tblScroll" style="margin-top:10px"><table>
      ${(C.ko.qf||[]).map(t=>tie(t,"8강","qf")).join("")}
      ${(C.ko.sf||[]).map(t=>tie(t,"4강","sf")).join("")}
      ${tie(C.ko.f,"결승","f")}</table></div>`;
    if(C.champ) ko+=`<div style="margin-top:6px">🏆 우승 — <b>${cwcFlag(C.champ,true)}${cwcNm(C.champ,true)}</b></div>`;
  }
  /* ④ 참가 클럽 등록 정보 */
  const uidCell=(u)=>`<span class="small" style="opacity:.5">#${u}</span>`;
  const info=C.teams.map(id=>{
    const t=cwcTeam(id); if(!t) return "";
    const isK=!!G.teams[id];
    const sd=isK?stadOf(t):(t.stad||{n:"-",cap:0});
    let mgN;
    if(isK){ if(t.isUser) mgN="감독님 (본인)";
             else { const c=(typeof coachOf==="function")?coachOf(t):null; mgN=(c&&c.n)||mgrName(t); } }
    else mgN=(t.coach&&t.coach.n)||"미상";
    const own=isK?(clubType(t).o):((t.own&&t.own.n)||"-");
    return `<tr><td style="text-align:left">${cwcFlag(id)}${cwcNm(id)} ${uidCell(t.uid||0)}</td>
      <td class="small">${cwcNat(id)}</td><td style="text-align:left">${mgN}</td>
      <td style="text-align:left">${sd.n} <span class="small" style="opacity:.6">${(sd.cap||0).toLocaleString()}석</span></td>
      <td style="text-align:left">${own}</td></tr>`;
  }).join("");
  const infoBox=`<details style="margin-top:8px"><summary class="small" style="cursor:pointer">🆔 참가 클럽 등록 정보 (구단 · 감독 · 구장 · 모기업)</summary>
    <div class="tblScroll" style="margin-top:6px"><table>
      <tr><th style="text-align:left">구단</th><th>국가</th><th style="text-align:left">감독</th><th style="text-align:left">홈구장</th><th style="text-align:left">모기업 · 운영주체</th></tr>
      ${info}</table></div></details>`;
  const stageN={grp:"조별리그", qf:"8강", sf:"4강", f:"결승", end:"종료"}[C.stage]||"";
  const head=joined
    ? `<p class="small" style="opacity:.8;margin:0 0 8px">지난 시즌 ${eaclShort()} 결승 진출 자격으로 출전합니다. 전 경기 중립지 · ${C.host} 개최 · 조 1·2위가 8강에 오릅니다.</p>`
    : `<p class="small" style="opacity:.8;margin:0 0 8px">올해는 우리 구단이 나가지 못했습니다. ${eaclShort()} 결승에 오른 두 팀이 아시아를 대표합니다. · ${C.host} 개최</p>`;
  return `<div class="card"><h3>🌍 ${cwcName()} <span class="small" style="color:var(--gold)">— ${stageN}</span></h3>
    ${head}${groups}${myFix}${ko}${infoBox}</div>`;
}

/* ── 🌍 CWC 개인 기록 ───────────────────────────────────────────────
   AI끼리의 경기는 매치엔진을 돌리지 않는다. 이걸 안 하면 대회 득점 순위가
   우리 팀 선수만으로 채워진다 — 32팀이 나오는 대회에서 그건 말이 안 된다. */
/* ⚠ CWC 는 여섯 경기짜리 단기 대회다. EACL(리그 스테이지 8 + 녹아웃) 가중치를 그대로 쓰면
   득점왕이 평균 6.6골까지 치솟았다 — 실제 대회 득점왕은 네 골이다.
   에이스 쏠림을 낮추고 미드필더·수비수의 몫을 조금 키운다. */
const CWC_SCORE_W={FW:7, MF:4.5, DF:1.4, GK:0.02};
const CWC_ASSIST_W={FW:5, MF:8, DF:3.0, GK:0.05};
const CWC_ACE_K=1.45;
function cwcStatOf(p){
  if(!p.cwcS || p.cwcS.s!==G.season) p.cwcS={s:G.season, apps:0, goals:0, assists:0, rate:0, rn:0};
  return p.cwcS;
}
function cwcCredit(tid, goals, skipUser){
  const t=cwcTeam(tid); if(!t || !t.players) return;
  if(t.isUser && skipUser) return;              // 우리 경기는 매치엔진이 정확히 집계한다
  const pool=[...t.players].filter(p=>p && (!p.inj || p.inj<=0));
  if(!pool.length) return;
  pool.sort((a,b)=>(b.ovr-a.ovr)+(Math.random()-0.5)*6);
  const xi=pool.slice(0, Math.min(11, pool.length));
  for(const p of xi) cwcStatOf(p).apps++;
  const field=xi.filter(p=>p.pos!=="GK");
  const ace=[...t.players].filter(p=>p.pos==="FW").sort((a,b)=>b.ovr-a.ovr)[0]
         || [...t.players].filter(p=>p.pos==="MF").sort((a,b)=>b.ovr-a.ovr)[0] || null;
  for(let i=0;i<goals;i++){
    const sc=eaclPickBy(field.length?field:xi, CWC_SCORE_W, ace, CWC_ACE_K); if(!sc) continue;
    cwcStatOf(sc).goals++;
    if(Math.random()<0.68){
      const cand=field.filter(p=>p!==sc);
      const as=eaclPickBy(cand.length?cand:field, CWC_ASSIST_W);
      if(as) cwcStatOf(as).assists++;
    }
  }
}
/* 우리가 매치엔진으로 치른 경기 — 실제로 뛴 선수만 정확히 집계한다 */
function cwcStatCollect(M){
  try{
    const sd=M.home.isUser?M.h:M.a; if(!sd) return;
    for(const x of sd.list){
      const p=x.p; if(!p) continue;
      const mins=(x.off===null?M.min:x.off)-x.on;
      if(mins<=0) continue;
      const s=cwcStatOf(p);
      s.apps++; s.goals+=(x.goals||0); s.assists+=(x.assists||0);
      if(x.rating){ s.rate+=x.rating; s.rn++; }
    }
  }catch(e){}
}


/* ── 🌍 CWC 서사 — 팬 반응 · 커뮤니티 · 뉴스 ──────────────────────────
   K리그 구단이 유럽·남미 챔피언과 붙는 일은 팬들에게 리그와 다른 온도의 사건이다.
   {t}=우리 팀 · {o}=상대 · {n}=상대 국가 · {cs}=대회 약칭 */
const CSOC={
  draw:["{cs} 조 편성 나왔다... {o} 실화냐", "이게 우리가 만날 팀이라고?", "조 추첨 보고 술 깼다",
    "{t}이 {o}랑 붙는 걸 살아서 보네", "일단 한 골만 넣자 진짜", "졌잘싸만 해도 성공이다 이번엔",
    "TV로만 보던 팀을 우리 유니폼 앞에서 본다는 게", "{cs} 나가는 것만으로 감개무량하다"],
  win:["{t}이 {o}를 잡았다고?? 지금 무슨 일이 일어난 거야", "세계가 우리를 봤다",
    "{n} 클럽을 우리가 이겼다 이거 실화임", "오늘 밤 잠 못 잔다", "이 경기 평생 기억할 듯",
    "K리그 무시하지 마라 진짜", "출근 못 해요 사장님"],
  draw2:["{o} 상대로 승점 1점 가져왔다", "비긴 게 이긴 거지 이건", "잘 버텼다 진짜",
    "이 정도면 세계 무대에서 통한다는 거 아님?", "골키퍼 오늘 미쳤다"],
  lose:["역시 세계의 벽은 높구나", "그래도 잘 싸웠다 고생했다", "{o}는 그냥 다른 스포츠 하더라",
    "이게 격차구나... 근데 배운 게 있을 거다", "선수들 표정 보니까 마음이 아프다",
    "졌지만 부끄럽지 않다", "우리 애들 다치지만 마라"],
  grpOut:["조별 탈락... 그래도 나간 게 어디냐", "다음엔 더 잘하자", "세계 무대 경험값이 남았다",
    "3전 전패라도 괜찮다 우리가 아시아 챔피언이었으니까", "돈은 벌었잖아 그걸로 보강하자"],
  qfIn:["{t} 8강이라고?!?! 세계 8강??", "이거 역사다 진짜", "아시아 자존심 지켰다",
    "8강 대진 어디야 빨리", "회사에 반차 씁니다"],
  sfIn:["세계 4강... 눈물 난다", "{t} 4강 진출 이거 진짜 실화냐", "역사에 기록될 시즌"],
  finalIn:["세계 클럽 결승... 우리 팀이...", "한 경기 남았다", "이걸 보려고 이 팀을 응원했나 보다",
    "결승 티켓 어디서 사냐 진심으로 묻는다"],
  champ:["{t} 세계 챔피언!!!!!", "우리가 세계 1위 클럽이다", "이걸 살아서 보네 진짜",
    "K리그가 세계를 먹었다", "평생 자랑할 거다 이건", "오늘부로 우리 팀은 명문이다"],
  runnerUp:["준우승... 아쉽지만 자랑스럽다", "여기까지 온 것만으로도 대단하다",
    "다음엔 반드시 넘는다", "선수들 고개 들어라"],
  koOut:["여기까지... 그래도 잘 왔다", "{o} 상대로 이 정도면 진 게 아니다",
    "아쉽다 진짜 한 골만 더 넣었으면", "울어도 되는 거 맞지?", "고생했다 우리 애들",
    "세계 무대에서 여기까지 온 팀이 몇이나 되냐", "내년에 또 오면 되지"]
};
/* 🗣️ 타 구단 팬 — 세계 대회는 「우리 리그 대표」가 나가는 자리다. 평소 앙숙도 이때는 다르다.
   ⚠ 처음엔 우리 팬 반응만 넣었다. 조 추첨부터 우승까지 리그 전체가 조용한 건 이상하다. */
const CRIV={
  draw:[["{t} 조 편성 봤는데 저건 좀...",0],["아시아 대표니까 응원은 한다",1],
    ["솔직히 우리였으면 더 잘했을 듯",-1],["K리그 대표로 나가는 거니까 화이팅",1],
    ["{t} 팬들 지금 심정 알 것 같다",0]],
  win:[["{t} 이겼다고?? 인정한다",1],["오늘만큼은 {t} 응원했다",1],
    ["아시아 자존심 지켜줘서 고맙다",1],["부럽다 진짜... 우리도 저기 나가고 싶다",0]],
  lose:[["그래도 잘 싸웠다",0],["체급 차이는 어쩔 수 없지",0],
    ["우리였어도 똑같이 졌을 거다",0],["{t} 욕하지 마라 저기 나간 것만도 대단하다",1]],
  grpOut:[["아쉽다 진짜",0],["K리그 수준을 알게 된 대회였다",-1],
    ["그래도 상금은 챙겼네 부럽다",0],["다음엔 우리가 나간다",1]],
  qfIn:[["{t} 8강이라니 ㄷㄷ",1],["이건 리그 전체의 자랑이다",1],
    ["솔직히 지금은 {t} 응원 중",1],["K리그 주가 올라가는 소리 들린다",1]],
  champ:[["{t} 우승... 인정한다 진심으로",1],["오늘만은 다 같은 K리그 팬이다",1],
    ["질투는 나는데 자랑스럽다",1],["우리 리그에서 세계 챔피언이 나왔다",1],
    ["{t} 팬들 오늘 마음껏 자랑해라 그럴 자격 있다",1]],
  runnerUp:[["준우승도 역사다",1],["잘 싸웠다 {t}",1],["아쉽겠지만 대단했다",1]],
  koOut:[["여기까지 온 것만도 대단하다",1],["{o}는 우리도 못 이겼을 거다",0],
    ["{t} 수고했다 진심으로",1],["K리그 위상은 확실히 올랐다",1]]
};
const CFMK={
  draw:[["{t} {cs} 조편성 ㅋㅋㅋㅋ 죽음의 조",0],["아시아 대표 화이팅",1],["{o}랑 붙네 ㄷㄷ",0],
    ["솔직히 한 골이라도 넣으면 성공",0],["K리그 클럽 세계무대 나가는 거 오랜만이네",1]],
  win:[["{t} {o} 잡았다 ㅁㅊ",1],["아시아 자존심 ㅇㅈ",1],["이거 유럽에서도 기사 났음",1],
    ["K리그 다시 봤다",1],["오늘 하이라이트 필수시청",1]],
  lose:[["실력차 어쩔 수 없다",0],["그래도 잘 버팀",0],["{o}는 체급이 다름",0],["경험이 남았다고 본다",0]],
  grpOut:[["조별 탈락 ㅠㅠ",-1],["나간 게 어디냐",0],["상금은 챙겼네",0],["다음 아챔부터 다시 시작",0]],
  qfIn:[["{t} 세계 8강 ㄷㄷㄷ",1],["이건 진짜 사건임",1],["아시아 클럽이 8강이라니",1]],
  champ:[["{t} 세계 챔피언 ㅅㅂ 소름",1],["K리그 역사 새로 씀",1],["이거 국가적 경사 아님?",1],
    ["다음 시즌 우리 팀 몸값 폭등 예상",1]],
  runnerUp:[["준우승도 대단함",1],["아쉽다 진짜 다 잡았는데",0],["잘 싸웠다",1]],
  draw2:[["{o} 상대로 승점 따냄 ㄷㄷ",1],["버틴 것만도 대단",1],["수비 오늘 미쳤음",1]],
  sfIn:[["{t} 세계 4강 ㅁㅊ",1],["이건 진짜 역사임",1],["아시아 클럽이 4강이라니",1],
    ["해외 커뮤에서도 난리났다",1]],
  finalIn:[["{t} 결승 진출 ㄷㄷㄷㄷ",1],["살다 살다 이런 걸 다 보네",1],
    ["결승전 시청률 역대급 나올 듯",1],["이거 지면 더 아쉬울 듯",0]],
  koOut:[["여기까지도 충분히 잘함",1],["{o}는 진짜 강했다",0],["아쉽지만 박수",1],
    ["돈이랑 경험 다 챙겼다",0]]
};
function cwcSocial(kind, extra){
  const t=userTeam(); if(!t || G.jobless) return;
  const v=Object.assign({t:t.short, c:cwcName(), cs:cwcShort()}, extra||{});
  try{
    if(kind==="draw"){ socialFill(CSOC.draw, 3+R(3), 0, v); fmkFill(CFMK.draw, 2+R(3), v); rivalFill(CRIV.draw, 1+R(3), 0, v); }
    else if(kind==="win"){ socialFill(CSOC.win, 3+R(4), 1, v); fmkFill(CFMK.win, 2+R(3), v); rivalFill(CRIV.win, 1+R(3), 1, v); }
    else if(kind==="draw2"){ socialFill(CSOC.draw2, 2+R(3), 0, v); fmkFill(CFMK.draw2, 1+R(2), v); }
    else if(kind==="lose"){ socialFill(CSOC.lose, 2+R(3), -1, v); fmkFill(CFMK.lose, 1+R(3), v); rivalFill(CRIV.lose, 1+R(2), 0, v); }
    else if(kind==="grpOut"){ socialFill(CSOC.grpOut, 3+R(3), -1, v); fmkFill(CFMK.grpOut, 2+R(2), v); rivalFill(CRIV.grpOut, 1+R(3), 0, v); }
    else if(kind==="koOut"){ socialFill(CSOC.koOut, 3+R(3), -1, v); fmkFill(CFMK.koOut, 2+R(2), v); rivalFill(CRIV.koOut, 1+R(2), 1, v); }
    else if(kind==="qfIn"){ socialFill(CSOC.qfIn, 3+R(3), 1, v); fmkFill(CFMK.qfIn, 2+R(3), v); rivalFill(CRIV.qfIn, 2+R(2), 1, v); }
    else if(kind==="sfIn"){ socialFill(CSOC.sfIn, 3+R(3), 1, v); fmkFill(CFMK.sfIn, 2+R(3), v); rivalFill(CRIV.qfIn, 1+R(2), 1, v); }
    else if(kind==="finalIn"){ socialFill(CSOC.finalIn, 3+R(4), 1, v); fmkFill(CFMK.finalIn, 2+R(3), v); rivalFill(CRIV.qfIn, 2+R(2), 1, v); }
    else if(kind==="champ"){ socialFill(CSOC.champ, 4+R(5), 1, v); fmkFill(CFMK.champ, 3+R(4), v); rivalFill(CRIV.champ, 3+R(3), 1, v); }
    else if(kind==="runnerUp"){ socialFill(CSOC.runnerUp, 3+R(3), 0, v); fmkFill(CFMK.runnerUp, 2+R(2), v); rivalFill(CRIV.runnerUp, 2+R(2), 1, v); }
  }catch(e){}
}
/* 경기 직후 — 기사 · MOM · 팬 반응. 대회 장부를 리그로 되돌리는 것도 여기서 한다. */
function matchNewsCwc(M, tag){
  const t=userTeam(); if(!t) return;
  const home=M.home.isUser, my=home?M.hg:M.ag, op=home?M.ag:M.hg;
  const opp=home?M.away:M.home;
  addNews(`📰 <b>${tag}</b> — ${M.home.short} ${M.hg} : ${M.ag} ${M.away.short} <span class="small">(${(G.cwc&&G.cwc.host)||""} · 중립지)</span>`,
    my>op?"good":my===op?"info":"bad", "club");
  try{
    const mm=M.mom;
    if(mm){
      addNews(`🏅 <b>${mm.name}</b> (${mm.team}) — ${tag} MOM · 평점 ${mm.rating.toFixed(2)}`
        +`${mm.goals?` · ${mm.goals}골`:""}${mm.assists?` · ${mm.assists}도움`:""}`, mm.isUser?"good":"info", "club");
    }
  }catch(e){}
  try{
    const v={o:opp?opp.short:"상대", n:(opp&&opp.nat)||"해외"};
    cwcSocial(my>op?"win":my===op?"draw2":"lose", v);
  }catch(e){}
  /* 🟨 이 경기에서 받은 카드는 대회 장부에 남기고, 리그 징계는 원래대로 돌려놓는다 */
  try{ cwcBanPop(t); cwcBanTick(t); }catch(e){}
}
/* ── 🏅 CWC 성적 이력 · 보상 ────────────────────────────────────────── */
function cwcHonorAdd(tid, kind){
  if(!G.cwcHonors) G.cwcHonors={};
  const h=G.cwcHonors[tid] || (G.cwcHonors[tid]={champ:0, runner:0, qf:0, apps:0, seasons:[]});
  if(kind && h[kind]!=null) h[kind]++;
  if(h.seasons.indexOf(G.season)<0){ h.seasons.push(G.season); h.apps++; }
  return h;
}
function cwcHonorOf(tid){ return (G.cwcHonors&&G.cwcHonors[tid]) || {champ:0, runner:0, qf:0, apps:0, seasons:[]}; }
/* 🏆 세계 정상 — 아시아 제패와는 다른 무게다 */
function cwcOnChampion(){
  const t=userTeam(); if(!t) return;
  const h=cwcHonorAdd(t.id, "champ");
  try{ trophyAdd("cwc", `${G.season} ${cwcShort()} 우승`, t.name); }catch(e){}
  /* ① 팬 — 대륙 대회와는 자릿수가 다르다 */
  t.fans=Math.round(clamp(t.fans*1.45, 4, 200)*10)/10;
  for(const p of t.players) p.morale=clamp(p.morale+16, 30, 99);
  t.morale=clamp((t.morale||70)+16, 40, 99);
  try{ t.hype=clamp(hypeOf(t)+0.45, 0.70, 2.20); }catch(e){}
  /* ② 스폰서 — 「세계 챔피언」 배지가 계약서를 다시 쓰게 만든다 */
  const spon=Math.round((90+R(70))*10)/10;
  t.budget=Math.round((t.budget+spon)*10)/10;
  try{ const fin=finLedger(t); fin.prize=Math.round((fin.prize+spon)*100)/100; }catch(e){}
  addNews(`🤝 세계 챔피언 <b>우승 인센티브</b> — 스폰서들이 계약서에 걸어 둔 보너스를 지급했습니다 (+${spon}억)<br><span class="small">다음 시즌 계약 갱신에서는 금액 자체가 달라집니다.</span>`, "good", "club");
  /* ③ 감독 — 세계를 제패한 감독에게는 다른 종류의 전화가 온다 */
  try{ mePay(20+R(15), cwcShort()+" 우승 보너스"); }catch(e){}
  G.eaclRepBonus=(G.eaclRepBonus||0)+20;
  G.eaclPull={s:G.season+1, v:0.28};        // 이적 시장에서 우리 이름의 무게
  try{ adjustTrust("owner",30,cwcShort()+" 우승"); adjustTrust("fans",34,cwcShort()+" 우승"); }catch(e){}
  /* ④ 우리 팀 최다 공격포인트 */
  try{
    const mine=t.players.filter(p=>p.cwcS && p.cwcS.s===G.season && p.cwcS.apps>0)
      .sort((a,b)=>(b.cwcS.goals*2+b.cwcS.assists)-(a.cwcS.goals*2+a.cwcS.assists));
    if(mine.length){ const b=mine[0];
      addNews(`🥇 <b>${b.name}</b>, ${cwcName()} 우리 팀 최다 공격포인트 — ${b.cwcS.apps}경기 ${b.cwcS.goals}골 ${b.cwcS.assists}도움`, "good", "club");
      b.morale=clamp(b.morale+10,30,99); }
  }catch(e){}
  addNews(`🏆 <b>${t.name}, 세계 정상!</b> 구단 통산 ${h.champ}번째 ${cwcShort()} 우승 — K리그 구단이 세계 클럽 챔피언이 되었습니다.`, "good", "club");
  try{ pushFeed({cat:"club", ic:"🌍", tone:1, tid:t.id, src:"국제축구연맹",
    head:`${t.name}, ${cwcName()} 우승`,
    sub:`아시아를 넘어 세계 정상. ${t.short}이(가) 유럽·남미의 벽을 넘고 클럽 세계 챔피언에 올랐다.`}); }catch(e){}
  try{ cwcSocial("champ"); }catch(e){}
}
function cwcOnRunnerUp(){
  const t=userTeam(); if(!t) return;
  cwcHonorAdd(t.id, "runner");
  try{ trophyAdd("cwcRunner", `${G.season} ${cwcShort()} 준우승`, t.name); }catch(e){}
  t.fans=Math.round(clamp(t.fans*1.22, 4, 200)*10)/10;
  for(const p of t.players) p.morale=clamp(p.morale+7, 30, 99);
  try{ t.hype=clamp(hypeOf(t)+0.22, 0.70, 2.20); }catch(e){}
  G.eaclRepBonus=(G.eaclRepBonus||0)+9;
  try{ adjustTrust("owner",14,cwcShort()+" 준우승"); adjustTrust("fans",16,cwcShort()+" 준우승"); }catch(e){}
  addNews(`🥈 ${t.short}, ${cwcShort()} 준우승 — 세계 정상까지 한 걸음이었습니다.`, "info", "club");
  try{ cwcSocial("runnerUp"); }catch(e){}
  try{ pushFeed({cat:"club", ic:"🥈", tone:1, tid:t.id, src:"국제축구연맹",
    head:`${t.name}, ${cwcName()} 준우승`,
    sub:`세계 정상까지 한 경기를 남기고 멈췄다. 그래도 아시아 축구가 어디까지 왔는지는 충분히 보여 줬다.`}); }catch(e){}
}
function cwcOnQuarter(){
  const t=userTeam(); if(!t) return;
  cwcHonorAdd(t.id, "qf");
  try{ trophyAdd("cwcQF", `${G.season} ${cwcShort()} 8강`, t.name); }catch(e){}
  t.fans=Math.round(clamp(t.fans*1.10, 4, 200)*10)/10;
  G.eaclRepBonus=(G.eaclRepBonus||0)+4;
  try{ adjustTrust("owner",7,cwcShort()+" 8강"); adjustTrust("fans",9,cwcShort()+" 8강"); }catch(e){}
}
/* 참가만으로도 이력에는 남는다 */
function cwcOnEnter(){ try{ cwcHonorAdd(G.userTeamId, null); }catch(e){} }
/* 🗄️ 대회가 끝나면 기록을 표로 떠서 남긴다.
   ⚠ 참가 클럽 스쿼드 640명을 세이브에 계속 들고 있으면 파일이 1MB 가까이 불어난다.
     그렇다고 그냥 버리면 득점 순위가 우리 팀 선수만 남는다(실측으로 걸렸다).
     상위 60명만 이름·클럽·기록으로 떠서 남기고, 스쿼드는 stripCaches 가 치운다. */
function cwcArchiveStats(){
  try{
    if(!G.cwc) return;
    const out=[];
    for(const id of (G.cwc.teams||[])){
      const t=cwcTeam(id); if(!t || !t.players) continue;
      for(const p of t.players){
        const s=p.cwcS; if(!s || s.s!==G.season) continue;
        if(!(s.goals||s.assists)) continue;
        out.push({n:p.name, ps:p.pos, tid:id, ap:s.apps, g:s.goals, a:s.assists,
                  pid:(G.teams[id]?p.id:null)});
      }
    }
    out.sort((x,y)=>(y.g-x.g)||(y.a-x.a)||(x.ap-y.ap));
    G.cwc.stats=out.slice(0, 60);
  }catch(e){}
}
/* 화면이 쓰는 단일 창구 — 대회 중에는 스쿼드에서, 끝난 뒤에는 남겨 둔 표에서 읽는다 */
function cwcStatRows(){
  if(G.cwc && Array.isArray(G.cwc.stats) && G.cwc.stats.length)
    return G.cwc.stats.map(x=>({nm:x.n, pos:x.ps, tid:x.tid, apps:x.ap, goals:x.g, assists:x.a, pid:x.pid}));
  return cwcAllStats().map(x=>({nm:x.p.name, pos:x.p.pos, tid:x.t.id,
    apps:x.s.apps, goals:x.s.goals, assists:x.s.assists, pid:(G.teams[x.t.id]?x.p.id:null)}));
}
function cwcAllStats(){
  const out=[];
  if(!cwcOn()) return out;
  for(const id of G.cwc.teams){
    const t=cwcTeam(id); if(!t || !t.players) continue;
    for(const p of t.players){
      if(!p.cwcS || p.cwcS.s!==G.season) continue;
      if(!(p.cwcS.goals||p.cwcS.assists)) continue;
      out.push({p, t, s:p.cwcS});
    }
  }
  return out;
}
function cwcRankCard(kind, n){
  const all=cwcStatRows();
  if(!all.length) return "";
  const goal = kind!=="assist";
  all.sort((a,b)=> goal
    ? (b.goals-a.goals) || (b.assists-a.assists) || (a.apps-b.apps)
    : (b.assists-a.assists) || (b.goals-a.goals) || (a.apps-b.apps));
  const top=all.filter(x=> goal ? x.goals>0 : x.assists>0).slice(0, n||12);
  if(!top.length) return "";
  const me=G.userTeamId;
  return `<div class="card"><h3>${goal?"⚽":"🅰️"} ${cwcName()} ${goal?"득점":"도움"} 순위</h3>
    <div class="tblScroll"><table>
      <tr><th>#</th><th style="text-align:left">선수</th><th style="text-align:left">클럽</th><th>경기</th><th>${goal?"골":"도움"}</th><th>${goal?"도움":"골"}</th></tr>
      ${top.map((x,i)=>{
        const mine=x.tid===me;
        return `<tr style="${mine?"background:rgba(80,160,255,.10);font-weight:700":""}">
          <td>${i+1}</td>
          <td style="text-align:left"${(mine&&x.pid!=null)?` class="clickable" onclick="showPlayerInfoPopup(event,${x.pid})"`:""}>${x.nm}<span class="small pos-${x.pos}" style="margin-left:4px">${x.pos}</span></td>
          <td style="text-align:left">${cwcFlag(x.tid)}${cwcNm(x.tid)}</td>
          <td>${x.apps}</td>
          <td><b>${goal?x.goals:x.assists}</b></td>
          <td class="small">${goal?x.assists:x.goals}</td></tr>`;
      }).join("")}
    </table></div></div>`;
}

/* 다음 CWC 경기 — 수석코치 정찰과 상단 표기가 같은 창구를 쓴다 */
function cwcNextForUser(){
  if(!cwcMine()) return null;
  const me=G.userTeamId, C=G.cwc, day=G.day||0;
  const out=[];
  for(const m of C.fix){
    if(m.done || (m.h!==me && m.a!==me)) continue;
    out.push({day:C.day.g[m.r], label:`${cwcShort()} 조별 ${m.r+1}차전`, home:false, opp:cwcTeam(m.h===me?m.a:m.h)});
  }
  for(const st of ["qf","sf","f"]){
    if(C.stage!==st) continue;
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    for(const x of (ties||[])){
      if(!x || x.done || (x.h!==me && x.a!==me)) continue;
      out.push({day:C.day[st], label:`${cwcShort()} ${CWC_KO_NAME[st]}`, home:false, opp:cwcTeam(x.h===me?x.a:x.h)});
    }
  }
  if(!out.length) return null;
  out.sort((a,b)=>a.day-b.day);
  const nx=out.find(x=>x.day>=day) || out[0];
  return nx && nx.opp ? nx : null;
}
/* 📅 일정 화면 카드 — 리그·EACL 과 같은 자리에 CWC 도 선다 */
function cwcSchedCard(){
  if(!cwcOn() || G.jobless) return "";
  const C=G.cwc, me=G.userTeamId;
  if(C.teams.indexOf(me)<0) return "";
  const rows=[];
  for(const m of C.fix.filter(x=>x.h===me||x.a===me).sort((x,y)=>x.r-y.r)){
    const home=m.h===me;
    rows.push({label:`조별 ${m.r+1}차전`, day:C.day.g[m.r], opp:cwcTeam(home?m.a:m.h),
               done:m.done, my:home?m.hg:m.ag, op:home?m.ag:m.hg});
  }
  for(const st of ["qf","sf","f"]){
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    for(const t of (ties||[])){
      if(!t || (t.h!==me && t.a!==me)) continue;
      const home=t.h===me;
      rows.push({label:CWC_KO_NAME[st], day:C.day[st], opp:cwcTeam(home?t.a:t.h),
                 done:t.done, my:home?t.hg:t.ag, op:home?t.ag:t.hg, pk:t.pk});
    }
  }
  if(!rows.length) return "";
  const W=rows.filter(r=>r.done&&r.my>r.op).length, D=rows.filter(r=>r.done&&r.my===r.op).length,
        L=rows.filter(r=>r.done&&r.my<r.op).length;
  const gk=Object.keys(C.grp).find(k=>C.grp[k].indexOf(me)>=0);
  const pos=gk?cwcGrpSorted(gk).indexOf(me)+1:0;
  const stageN={grp:"조별리그", qf:"8강", sf:"4강", f:"결승", end:"종료"}[C.stage]||"";
  const body=rows.map(r=>{
    const res=r.done
      ? `<b style="color:${r.my>r.op?"var(--green)":r.my===r.op?"var(--gold)":"var(--red)"}">${r.my} : ${r.op}</b>${r.pk?'<span class="small"> (승부차기)</span>':""}`
      : `<span class="small" style="opacity:.7">${dateLabel(r.day)}${r.day>=(G.day||0)?` · D-${r.day-(G.day||0)}`:""}</span>`;
    return `<tr><td class="small">${r.label}</td><td class="small">${dateLabel(r.day)}</td>
      <td style="text-align:left">${cwcFlag(r.opp&&r.opp.id)}${r.opp?(r.opp.short||r.opp.name):"-"}
        <span class="small" style="opacity:.5">${r.opp?Math.round(teamOVR(r.opp)):""}</span></td><td>${res}</td></tr>`;
  }).join("");
  return `<div class="card"><h3>🌍 ${cwcName()} <span class="small" style="color:var(--gold)">— ${stageN}${gk?` · ${gk}조 ${pos}위`:""}</span></h3>
    <p class="small" style="opacity:.75;margin:0 0 6px">${C.host} 개최 · 전 경기 중립지 · ${W}승 ${D}무 ${L}패</p>
    <div class="tblScroll"><table>
      <tr><th>단계</th><th>날짜</th><th style="text-align:left">상대</th><th>결과</th></tr>${body}</table></div>
    <p class="small" style="opacity:.6;margin-top:6px">조 순위·대진표 전체는 <b>순위표 → 🌍 ${cwcShort()}</b> 탭에서 볼 수 있습니다.</p></div>`;
}
/* 상단바 표기 — 다음 CWC 경기와 남은 날수. 프리시즌 표기(🌱)보다 먼저 걸린다. */
function cwcTopTag(){
  try{
    if(!cwcMine() || !cwcUserLeft()) return null;
    const C=G.cwc, me=G.userTeamId, d=G.day||0;
    let day=null, nm=null, opp=null;
    const gi=C.day.g.findIndex((x,ix)=>x>=d && C.fix.some(m=>m.r===ix && !m.done && (m.h===me||m.a===me)));
    if(gi>=0){
      const m=C.fix.find(x=>x.r===gi && !x.done && (x.h===me||x.a===me));
      day=C.day.g[gi]; nm=`조별 ${gi+1}차전`; opp=m?(m.h===me?m.a:m.h):null;
    } else for(const st of ["qf","sf","f"]){
      const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
      const t=(ties||[]).find(x=>x && !x.done && (x.h===me||x.a===me));
      if(t){ day=C.day[st]; nm=CWC_KO_NAME[st]; opp=(t.h===me?t.a:t.h); break; }
    }
    if(day==null) return null;
    const left=day-d;
    return `🌍 ${cwcShort()} ${nm}${opp?` · ${cwcNm(opp)}`:""} ${left>0?`(D-${left})`:"— 오늘"}`;
  }catch(e){ return null; }
}
/* 달력 한 칸 — 그날 내 CWC 경기 */
function cwcCalOf(i){
  if(!cwcMine()) return null;
  const me=G.userTeamId, C=G.cwc;
  const mk=(m,label,st)=>{
    const home=m.h===me, opp=cwcTeam(home?m.a:m.h); if(!opp) return null;
    return {m, home, opp, label, done:!!m.done, my:home?m.hg:m.ag, op:home?m.ag:m.hg};
  };
  const gi=C.day.g.indexOf(i);
  if(gi>=0){ const m=C.fix.find(x=>x.r===gi && (x.h===me||x.a===me));
             if(m) return mk(m, `${cwcShort()} ${gi+1}차전`); }
  for(const st of ["qf","sf","f"]){
    if(C.day[st]!==i) continue;
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    for(const t of (ties||[])) if(t && (t.h===me||t.a===me)) return mk(t, `${cwcShort()} ${CWC_KO_NAME[st]}`);
  }
  return null;
}

function eaclCalOf(i){
  if(!eaclOn() || G.jobless) return null;
  const me=G.userTeamId; if(G.eacl.teams.indexOf(me)<0) return null;
  const mk=(m, label)=>{
    const home=m.h===me, opp=eaclTeam(home?m.a:m.h); if(!opp) return null;
    return {m, home, opp, label, done:!!m.done, my:home?m.hg:m.ag, op:home?m.ag:m.hg};
  };
  for(let d=0; d<8; d++){
    if(eaclMdDay(d)!==i) continue;
    const m=G.eacl.fix.find(x=>x.d===d && (x.h===me||x.a===me));
    if(m) return mk(m, `${eaclShort()} ${d+1}차전`);
  }
  const K=G.eacl.ko;
  for(const st of ["qf","sf","f"]){
    if(eaclKoDay(st)!==i) continue;
    const ties = st==="f" ? [K.f] : (K[st]||[]);
    const t=(ties||[]).find(x=>x && (x.h===me||x.a===me));
    if(t) return mk(t, eaclShort()+" "+EACL_KO_NAME[st]);
  }
  return null;
}
/* 홈·원정 꼬리표 — 「vs / @」보다 「(홈) / (원정)」이 한눈에 읽힌다(제보) */
function homeTag(home){ return `<span class="cdHA ${home?"hm":"aw"}">${home?"홈":"원정"}</span>`; }
function calendarCard(){
  if(!G.cal) return "";
  ensureTrainPlan();
  if(calMonth!==null && calAnchor!==curCalMonth()){ calMonth=null; calAnchor=null; }   // 달이 바뀌었으면 이번 달로 되돌린다
  const ym=(calMonth===null?curCalMonth():calMonth);
  const y=Math.floor(ym/12), mo=ym%12;
  const first=new Date(y,mo,1), lastD=new Date(y,mo+1,0).getDate();
  const open=calOpenDate();
  const dayIndexOf=(dd)=>Math.round((new Date(y,mo,dd)-open)/86400000);
  const t=userTeam();
  const fixOf=(r)=>{ const fx=t.div===1?G.k1Fix:G.k2Fix; if(r<0||r>=fx.length) return null;
    for(const [hid,aid] of fx[r]) if(hid===t.id||aid===t.id) return {opp:G.teams[hid===t.id?aid:hid], home:hid===t.id};
    return null; };
  const cells=[];
  for(let i=0;i<first.getDay();i++) cells.push(`<div class="calD calNull"></div>`);
  for(let dd=1;dd<=lastD;dd++){
    const i=dayIndexOf(dd);
    const past = i < (G.day||0);
    if(i<0 || i>G.cal.last+2){ cells.push(`<div class="calD calNull"><span class="cdn">${dd}</span></div>`); continue; }
    const r=roundOfDay(i);
    const fr=(G.friendlies||[]).find(x=>x.d===i);
    const ec=eaclCalOf(i);
    const cwcC=(function(){ try{ return cwcCalOf(i); }catch(e){ return null; } })();
    /* 치른 경기는 결과가 한눈에 보이게 — 우리 팀 기준 「내 득점 : 상대 득점」과 승/무/패 색 */
    const scHtml=(my,op)=>`<span class="cdSc">${my} : ${op}</span>`;
    const scCls =(my,op)=>my>op?" calWin":my===op?" calDraw":" calLoss";
    const leagueRes=(rr)=>{
      const g=(G.results||[]).find(x=>x.s===G.season && x.div===t.div && x.r===rr+1 && (x.hid===t.id||x.aid===t.id));
      if(!g) return null;
      const home=g.hid===t.id;
      return {my:home?g.hg:g.ag, op:home?g.ag:g.hg, forfeit:!!g.forfeit};
    };
    let inner, cls="";
    if(cwcC){
      cls="calMatch calCwc";
      inner = `<span class="cdPre">${cwcC.label}</span><b>${cwcC.opp.short}</b>`;
      if(cwcC.done){ cls+=scCls(cwcC.my,cwcC.op); inner+=scHtml(cwcC.my,cwcC.op); }
    } else if(ec){
      cls="calMatch calEacl";
      inner = `<span class="cdPre">${ec.label}</span><b>${homeTag(ec.home)}${ec.opp.short}</b>`;
      if(ec.done){ cls+=scCls(ec.my,ec.op); inner+=scHtml(ec.my,ec.op); }
    } else if(fr){
      cls="calMatch calFriendly";
      const fo=G.teams[fr.oppId];
      inner = `<span class="cdPre">연습</span><b>${homeTag(fr.home)}${fo?fo.short:""}</b>`;
      if(fr.done && !fr.cancelled && i<(G.day||0)){
        const my=fr.home?fr.hg:fr.ag, op=fr.home?fr.ag:fr.hg;
        cls+=scCls(my,op); inner+=scHtml(my,op);
      } else if(fr.cancelled){ inner+=`<span class="small">취소</span>`; }
    } else if(r>=0){
      const f=fixOf(r);
      cls="calMatch";
      if(!f){ inner=`<span class="small">R${r+1} 휴식</span>`; }
      else{
        inner=`<b>${homeTag(f.home)}${f.opp.short}</b>`;
        const lr=leagueRes(r);
        if(lr){ cls+=scCls(lr.my,lr.op); inner+=scHtml(lr.my,lr.op)+(lr.forfeit?`<span class="small">몰수</span>`:""); }
      }
    } else {
      const pl=dayPlan(i);
      cls = pl.t==="rest" ? "calRest" : "calTrain i"+(pl.i||0);
      const lab = pl.t==="rest" ? "휴식" : TRAIN_INT[pl.i||0].n;
      const _fix=!!(G.train.days && G.train.days[i]);
      /* 🔒 감독이 직접 잡은 휴식 — 눈으로 바로 확인되게 자물쇠를 붙인다 (제보) */
      inner = `<span class="cdt">${lab}</span>${_fix?(pl.t==="rest"?'<span class="cdFix" title="감독이 직접 지정한 휴식 — 다른 설정으로 바뀌지 않습니다">🔒</span>':'<span class="cdFix">•</span>'):""}`;
      if(!past) inner=`<div class="cdBtns">
        <button onclick="event.stopPropagation();setDayPlan(${i},'rest')" title="휴식">휴</button>
        <button onclick="event.stopPropagation();setDayPlan(${i},'train',0)" title="가볍게">가</button>
        <button onclick="event.stopPropagation();setDayPlan(${i},'train',1)" title="보통">보</button>
        <button onclick="event.stopPropagation();setDayPlan(${i},'train',2)" title="강하게">강</button>
        ${TRAIN_FOCUS.map(f=>`<button onclick="event.stopPropagation();setDayFocus(${i},'${f.k}')" title="${f.n}">${f.ic}</button>`).join("")}
        ${G.train.days[i]?`<button onclick="event.stopPropagation();clearDayPlan(${i})" title="루틴으로 되돌리기">↺</button>`:""}
      </div>`+inner;
    }
    /* ⚠ 제보 — 달력에서 EACL 경기일을 누르면 훈련이 설정된다.
       리그 경기일은 roundOfDay 로 걸러졌지만 EACL·연습경기는 라운드가 없어 빈 날로 취급됐다. */
    const tapable = r<0 && !past && !ec && !fr;
    cells.push(`<div class="calD ${cls}${past?" calPast":""}${i===(G.day||0)?" calToday":""}"`
      + (tapable?` onclick="pickDayPlan(${i})" title="탭하면 휴식/훈련을 고를 수 있습니다"`:"")
      + `><div class="cdHdr"><span class="cdn">${dd}</span><span class="cdw" title="${(function(){try{return dayWeather(i).n;}catch(e){return "";}})()}">${(function(){try{return dayWeather(i).ic;}catch(e){return "";}})()}</span></div>${inner}</div>`);
  }
  const today=dateOfDay(G.day||0);
  return `<div class="card"><h3>🗓️ ${y}년 ${mo+1}월
    <button class="mini" onclick="calShift(-1)">‹</button><button class="mini" onclick="calShift(1)">›</button>
    ${ym!==curCalMonth()?`<button class="mini" onclick="calToday()" title="오늘이 있는 달로">오늘</button>`:""}
    <span class="small">— 오늘: ${today.getMonth()+1}월 ${today.getDate()}일</span></h3>
  <div class="calHead">${DOW_KR.map(d=>`<div>${d}</div>`).join("")}</div>
  <div class="calGrid">${cells.join("")}</div>
  <p class="small" style="margin-top:6px">경기 없는 날을 <b>탭(또는 클릭)</b>하면 휴식·훈련을 고를 수 있습니다.
    PC에서는 마우스를 올려 <b>휴/가/보/강</b> 버튼을 바로 눌러도 됩니다. • 표시는 개별 지정한 날입니다.</p></div>`;
}
