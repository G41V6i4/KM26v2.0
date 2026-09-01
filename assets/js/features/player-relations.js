"use strict";
/* ═══════════════════════════════════════════════════════════════
   👋 작별 인사
   선수가 팀을 떠나는 날, 감독실에 들른다. 무슨 말을 남기고 가는지는
   그동안 쌓인 호감도가 정한다 — 눈물의 포옹일 수도, 문을 쾅 닫고 나가는 것일 수도 있다.
   감독의 대답은 라커룸 분위기와 팬 여론에 그대로 남는다.
   ═══════════════════════════════════════════════════════════════ */
const BYE_LINES={
  warm:[   // 호감도 68+
    `"감독님 밑에서 뛴 시간, 제 커리어에서 제일 좋았습니다. 잊지 않겠습니다."`,
    `"언젠가 꼭 다시 모시고 싶습니다. 그때는 제가 더 좋은 선수가 되어 있겠습니다."`,
    `(눈시울이 붉어진다) "...감사했습니다, 감독님. 정말로요."`,
    `"이 팀 경기, 앞으로도 챙겨 보겠습니다. 우승하시는 거 꼭 보고 싶습니다."`],
  ok:[     // 45~67
    `"짧았지만 배운 게 많았습니다. 감사했습니다."`,
    `"좋은 기억으로 남기겠습니다. 건강하십시오."`,
    `"어디서든 이 팀 결과는 챙겨 보겠습니다."`,
    `"프로니까요. 서로 좋은 선택이었길 바랍니다."`],
  cold:[   // 28~44
    `"...뭐, 그동안 수고하셨습니다." (악수는 짧다)`,
    `"할 말은 많지만 여기까지 하겠습니다. 가보겠습니다."`,
    `"기회를 조금만 더 주셨으면 어땠을까, 그 생각은 계속 날 것 같네요."`,
    `(고개만 까딱한다) "네. 가보겠습니다."`],
  hate:[   // ~27
    `"함께해서 더러웠고 다신 만나지 맙시다."`,
    `"솔직히 말할까요? 감독님 밑에서 제 커리어 1년 날렸습니다."`,
    `"이 팀에서 배운 건 하나입니다. 감독을 잘 만나야 한다는 거요."`,
    `(짐을 들고 뒤도 안 돌아본다) "인사는 됐습니다."`,
    `"나가서 우리 경기 나오면 꼭 이기고 오겠습니다. 그거 하나 보고 갑니다."`]
};
/* 감독의 대답 — a: 호감도 변화, t: 팀 사기, f: 팬 여론(소셜 톤), tone: 반응 분기 */
const BYE_REPLY=[
  {t:`"고생 많았다. 어디서든 잘되길 진심으로 바란다."`, a:+8, mor:+1.0, soc:1, k:"warm"},
  {t:`"네 자리는 항상 비워 두겠다. 언제든 돌아와라."`, a:+12, mor:+1.5, soc:1, k:"door"},
  {t:`"프로의 세계다. 다음에 만나면 적으로 만나는 거야."`, a:+2, mor:0, soc:0, k:"pro"},
  {t:`"솔직히 아쉽다. 내가 더 잘 썼어야 했는데."`, a:+10, mor:+0.8, soc:1, k:"regret"},
  {t:`"네가 나가서 잘하는 걸 봐야 내 판단이 틀렸는지 알겠지."`, a:-2, mor:-0.3, soc:0, k:"cool"},
  {t:`"어~ 가~"`, a:-25, mor:-3.0, soc:-1, k:"meme"},
  {t:`(아무 말 없이 서류만 본다)`, a:-14, mor:-2.0, soc:-1, k:"ignore"},
  {t:`"이 팀에 있는 동안 네가 보여준 게 뭐가 있지?"`, a:-20, mor:-2.5, soc:-1, k:"burn"}
];
const BYE_REACT={
  warm:{good:`"감독님... 감사합니다. 진짜로."`, mid:`"감사합니다. 잊지 않겠습니다."`, bad:`(표정이 굳는다) "...네."`},
  door:{good:`"그 말씀만으로도 충분합니다. 꼭 다시 오겠습니다."`, mid:`"...고맙습니다."`, bad:`"돌아올 일은 없을 것 같네요."`},
  pro:{good:`"그렇죠. 그라운드에서 뵙겠습니다."`, mid:`"네. 그렇게 하죠."`, bad:`"기대하십시오. 제가 이깁니다."`},
  regret:{good:`"그렇게 말씀해 주시니... 마음이 좀 풀리네요."`, mid:`"아닙니다. 제 부족함도 컸습니다."`, bad:`"이제 와서 그런 말씀을 하시네요."`},
  cool:{good:`"보여드리겠습니다."`, mid:`"...두고 보시죠."`, bad:`"틀리셨다는 거, 곧 아시게 될 겁니다."`},
  meme:{good:`"...예? 아, 예..." (당황한 표정으로 나간다)`, mid:`"...진심이십니까?" (헛웃음을 짓는다)`, bad:`"하... 끝까지 이러시네요." (문을 쾅 닫는다)`},
  ignore:{good:`"...가보겠습니다." (한참 서 있다 나간다)`, mid:`(인사를 하려다 그만둔다)`, bad:`"역시. 마지막까지 이럴 줄 알았습니다."`},
  burn:{good:`"...죄송합니다. 더 잘했어야 했는데."`, mid:`"할 말 없습니다."`, bad:`"그 말, 평생 기억하겠습니다."`}
};
/* 떠나는 선수가 남긴 말과 감독의 대답에 팬들이 반응한다 */
SOC.byeWarm=[
 ["{p} 마지막 인사 봤는데 눈물 나네 ㅠㅠ 잘 가라",1],["{p} 어디서든 잘하길. 고마웠다",1],
 ["감독이랑 {p} 사이 좋았나 보네. 훈훈하다",1],["{p} 유니폼 액자에 걸어둔다",1],
 ["{p} 마지막 경기 직관 갔던 게 아직도 생생하다",1],["언젠가 돌아와라 진심으로",1],
 ["떠나는 방식이 이렇게 중요합니다",1]];
SOC.byeCold=[
 ["{p} 인터뷰 뉘앙스가 좀... 감독이랑 사이 안 좋았나?",-1],["{p} 이렇게 보내는 게 맞나",-1],
 ["떠나는 선수한테 저러는 건 좀 아니지 않나",-1],["{p} 마지막까지 서운했겠다",0],
 ["보낼 땐 곱게 보내야 다음 영입도 되는 겁니다",-1],["{p} 팬미팅 한 번 없이 이렇게 끝?",-1],
 ["구단 공식 계정 인사말이 두 줄이더라...",-1]];
SOC.byeMeme=[
 ["감독 마지막 인사가 '어~ 가~' 였다는 게 사실임?",-1],["ㅋㅋㅋㅋ 어 가 ㅋㅋㅋ 이거 밈 된다",-1],
 ["{p}한테 그러면 안 되지 진짜...",-1],["구단 이미지 생각 좀 합시다",-1],
 ["짤 벌써 세 개 봤다 ㅋㅋㅋㅋ",-1],["{p} 표정이 굳는 거 그대로 찍혔더라",-1],
 ["웃긴데 우리 구단이라서 하나도 안 웃김",-1]];
FMK.byeMeme=[
 ["어~ 가~ ㅋㅋㅋㅋㅋㅋㅋ 이 감독 물건이네",-1],
 ["{p} 보내면서 '어 가' ㅋㅋㅋ 캡처 박제함",-1],
 ["ㅅㅂ 이건 좀 심했다 아무리 그래도",-1],
 ["감독님 인성 논란 시작 ㅋㅋ",-1]];
FMK.byeWarm=[
 ["{p} 작별 인사 보고 울었다 ㅅㅂ 진짜",1],["이런 감독 밑이면 선수들 뛸 맛 나겠다",1],
 ["{p} 잘 가라 ㅠㅠ 우리 팀 레전드다",1]];
let BYE=null, BYE_QUEUE=null;
/* 이적·방출이 확정되는 시점에 예약해 두고, 화면 전환 직전에 감독실로 부른다 */
function queueFarewell(p, destName){
  BYE_QUEUE={p:{id:p.id, name:p.name, pos:p.pos, no:p.no, by:p.by, pers:p.pers, ovr:p.ovr,
                aff:aff(p), apps:p.apps||0, goals:p.goals||0}, dest:destName};
}
/* 예약된 작별 인사가 있으면 그 화면을 띄우고, 없으면 곧바로 cont 실행 */
function runPendingBye(cont){
  const q=BYE_QUEUE; BYE_QUEUE=null;
  if(!q){ if(cont) cont(); return false; }
  startFarewell(q.p, q.dest, cont);
  return true;
}
/* 떠나는 선수를 감독실로 부른다 (완료 후 cont 실행) */
function startFarewell(p, destName, cont){
  BYE={p:{id:p.id, name:p.name, pos:p.pos, no:p.no, by:p.by, pers:p.pers, ovr:p.ovr,
          aff:(p.aff!=null?p.aff:AFF_DEF), apps:p.apps||0, goals:p.goals||0},
       dest:destName||"새 소속팀", cont:cont||null, tier:null, line:null};
  const v=BYE.p.aff;
  BYE.tier = v>=68?"warm" : v>=45?"ok" : v>=28?"cold" : "hate";
  BYE.line = pick(BYE_LINES[BYE.tier]);
  VIEW="match";
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  renderFarewell();
}
function renderFarewell(){
  const b=BYE; if(!b) return;
  const L=affLabel(b.p.aff);
  const btns=BYE_REPLY.map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px"
    onclick="farewellReply(${i})">${o.t}</button>`).join("");
  $("#main").innerHTML=`<h2>👋 작별 인사</h2>
  <div class="card stCard">
    <p><b class="pos-${b.p.pos}">${b.p.name}</b> <span class="small">${G.season-b.p.by}세 · ${PERS_N[b.p.pers||0]}
      · 이번 시즌 ${b.p.apps}경기 ${b.p.goals}골</span></p>
    <p class="small">행선지: <b style="color:#fff;font-weight:800">${b.dest}</b>
      · 감독 호감도 <b style="color:${L.c};font-weight:800">${L.ic} ${L.t}</b></p>
    <div class="stSay">💬 ${b.p.name}: ${b.line}</div>
  </div>
  <div class="card stCard"><h3>뭐라고 답하시겠습니까?</h3>${btns}</div>`;
  window.scrollTo(0,0);
}
function farewellReply(i){
  const b=BYE; if(!b) return;
  const o=BYE_REPLY[i]; if(!o) return;
  const t=userTeam();
  // 험한 말로 나간 선수에게 따뜻하게 답하면 마음이 조금 풀린다. 반대라면 최악으로 끝난다.
  const before=b.p.aff;
  let after=clamp(before+o.a, 0, 100);
  const react = after>=62 ? "good" : after>=32 ? "mid" : "bad";
  const line=(BYE_REACT[o.k]||BYE_REACT.pro)[react];
  // 라커룸은 감독이 동료를 어떻게 배웅했는지 지켜본다
  const teamD = o.mor * (b.p.ovr>=75?1.5:1);
  t.morale=Math.round(clamp(t.morale+teamD,35,99)*100)/100;
  if(o.a<0) for(const q of t.players) affAdd(q, o.a*0.12, "동료 배웅");
  else      for(const q of t.players) affAdd(q, o.a*0.08, "동료 배웅");
  // 팬 여론
  const v={p:b.p.name, o:b.dest};
  if(o.k==="meme"){ socialFill(SOC.byeMeme, 3+R(2), -1, v); fmkFill(FMK.byeMeme, 3+R(2), v); }
  else if(o.soc>0){ socialFill(SOC.byeWarm, 2+R(2), 1, v); fmkFill(FMK.byeWarm, 1+R(2), v); }
  else if(o.soc<0){ socialFill(SOC.byeCold, 2+R(2), -1, v); }
  if(o.k==="meme"||o.k==="burn"){ adjustTrust("fans", -2, `${b.p.name} 작별 인사 논란`); }
  else if(o.a>=8){ adjustTrust("fans", 1, `${b.p.name}과의 훈훈한 작별`); }
  addMood(`👋 ${b.p.name}이(가) ${b.dest}(으)로 떠났습니다. — "${o.t.replace(/^\(|\)$/g,"")}"`);
  staffLog(`${b.p.name} 작별 인사 (${affLabel(before).t} → ${affLabel(after).t})`);
  const cls = o.a>=8 ? "good" : o.a>=0 ? "info" : "warn";
  const cont=b.cont;
  $("#main").innerHTML=`<h2>👋 작별 인사</h2>
  <div class="card stCard">
    <p>🗣️ 감독: <b>${o.t}</b></p>
    <p style="color:var(--acc)">💬 ${b.p.name}: ${line}</p>
    <div class="msg ${cls}">호감도 ${Math.round(before)} → ${Math.round(after)} · 팀 사기 ${teamD>0?"+":""}${mor1(teamD)}
      ${o.k==="meme"?" · 🔥 커뮤니티가 들끓고 있습니다":""}</div>
  </div>
  <div class="card"><button class="mini" style="width:100%;padding:11px" onclick="closeFarewell()">감독실을 나선다 ▶</button></div>`;
  BYE=null; PENDING_BYE_CONT=cont;
  saveGame(); window.scrollTo(0,0);
}
let PENDING_BYE_CONT=null;
function closeFarewell(){
  const c=PENDING_BYE_CONT; PENDING_BYE_CONT=null;
  if(c) c(); else { show("home"); window.scrollTo(0,0); }
}
/* ═══════════════════════════════════════════════════════════════
   👤 감독 개인 호감도 (p.aff, 0~100)
   팀 사기가 "지금 기분"이라면, 호감도는 "이 감독을 어떻게 생각하는가"다.
   한 경기로 확 바뀌지 않고, 감독이 쌓아 온 행동이 천천히 누적된다.
     · 꾸준히 기용하면 오르고, 계속 벤치에 앉히면 내린다
     · 라커룸에서 한 말·면담에서 준 약속·지킨 약속이 크게 작용한다
     · 호감도가 높으면 불만을 덜 품고, 사기가 잘 안 떨어지고, 재계약·설득이 쉽다
     · 낮으면 태업으로 가는 길이 짧아지고, 떠날 때 험한 말을 남긴다
   ═══════════════════════════════════════════════════════════════ */
const AFF_DEF=50;
function aff(p){ return p && p.aff!=null ? p.aff : AFF_DEF; }
function affSet(p, v){ p.aff=Math.round(clamp(v, 0, 100)*10)/10; }
/* 호감도를 올리고 내린다. 성격에 따라 같은 대우도 다르게 받아들인다. */
function affAdd(p, d, why){
  if(!p || !d) return;
  const pers=p.pers||0;
  if(d<0){
    if(pers===3) d*=1.35;          // 다혈질 — 서운한 건 오래 간다
    if(pers===0) d*=0.75;          // 프로페셔널 — 감정을 잘 안 싣는다
  } else {
    if(pers===2) d*=1.20;          // 온화함 — 잘해 주면 금방 마음을 연다
    if(pers===1) d*=0.85;          // 야심가 — 좀처럼 만족하지 않는다
  }
  affSet(p, aff(p)+d);
  if(why) p._affWhy=why;
}
function affLabel(v){
  return v>=85 ? {t:"헌신적", c:"#3fb950", ic:"💚"}
       : v>=68 ? {t:"우호적", c:"#56d364", ic:"🙂"}
       : v>=45 ? {t:"보통",   c:"#c9d1d9", ic:"😐"}
       : v>=28 ? {t:"냉랭",   c:"#d29922", ic:"😒"}
                : {t:"적대적", c:"#f85149", ic:"😠"};
}
function affBar(p){
  const v=aff(p), L=affLabel(v);
  return `<span title="감독 개인 호감도 ${Math.round(v)}/100">${L.ic} <b style="color:${L.c};font-weight:800">${L.t}</b> <span class="small">(${Math.round(v)})</span></span>`;
}
/* 라운드마다 굴러가는 호감도 — 출전 시간이 가장 큰 변수다 */
function affWeekly(t){
  const rp=t.div===1?G.r1:G.r2; if(rp<1) return;
  const xi=bestXI(t), inXI={}; xi.forEach(x=>inXI[x.id]=1);
  const tAvg=teamOVR(t);
  for(const p of t.players){
    let d=0;
    const share=playShare(p);
    if(share>=0.8) d+=0.9;                                  // 붙박이 주전
    else if(share>=0.35) d+=0.25;                           // 로테이션
    else if(p.inj<=0 && p.ovr>=tAvg-2) d-=0.8;              // 쓸 만한데 안 쓴다
    else if(p.inj<=0) d-=0.25;
    if(p.sulk>0) d-=0.6;
    if(p.unhappy>0) d-=0.35;
    // 아주 천천히 중앙으로 — 아무 일도 없으면 기억은 옅어진다
    d += (AFF_DEF-aff(p))*0.012;
    affAdd(p, d);
  }
}
/* ═══════════════════════════════════════════════════════════════
   📋 스태프 회의
   수석코치가 감독에게 보고하는 자리다. FM의 스태프 미팅을 이 게임 크기에 맞게 줄였다.
     · 프리시즌 연습경기 위임 — 맡기면 결과만 받아 본다
     · 선수 불만 보고 — 면담해서 약속하거나, 그냥 무시하거나
     · 훈련·부상·유망주에 대한 짧은 보고
   불만은 방치하면 커지고, 약속은 지키지 않으면 더 크게 터진다.
   ═══════════════════════════════════════════════════════════════ */
function staffOpt(){
  if(!G.staff) G.staff={delegatePre:false, handled:{}, log:[]};
  if(G.staff.delegatePre===undefined) G.staff.delegatePre=false;
  if(!G.staff.handled) G.staff.handled={};
  if(!G.staff.log) G.staff.log=[];
  acEnsure();
  return G.staff;
}
/* 🎩 수석코치 자리 보장 — 예전 세이브에는 사람이 없다. 「원래 있던 그 수석코치」에게
   이름을 주는 것이므로 자동으로 한 명 붙여 준다.
   ⚠ 해임해서 비운 자리(null)는 그대로 둔다 — undefined 일 때만 채운다. */
function acEnsure(){
  try{
    if(!G.staff) G.staff={delegatePre:false, handled:{}, log:[]};
    const t=(typeof userTeam==="function")?userTeam():null;
    if(!Array.isArray(G.staff.crew)) G.staff.crew=[];
    const C=G.staff.crew;
    /* ① 예전 세이브(수석코치 한 명만 있던 시절) — 그 사람을 코치진 배열로 옮긴다 */
    if(G.staff.ac && typeof G.staff.ac==="object"){
      G.staff.ac.role=G.staff.ac.role||"ac";
      if(!C.some(x=>x&&x.id===G.staff.ac.id)) C.unshift(G.staff.ac);
      delete G.staff.ac;
    }
    /* ② 역할이 안 적힌 옛 항목은 수석코치로 본다 */
    for(const c of C) if(c && !c.role) c.role="ac";
    /* ②-b 고유번호 백필 — 번호 체계가 생기기 전에 만들어진 스태프에게도 붙여 준다 */
    for(const c of C) if(c && !c.uid) c.uid=nextStaffUid();
    for(const c of (G.acPool||[])) if(c && !c.uid) c.uid=nextStaffUid();
    /* ③ 기본 코치진 — ⚠ 선택: 「기본 4명 자동 배정」.
       없던 사람을 만드는 게 아니라, 원래 벤치에 있던 스태프에게 이름을 주는 것이다.
       이 상태가 효과 1.00 기준이라 지금보다 나빠지지 않는다.
       ⚠ 한 번만 채운다 — 해임해서 비운 자리를 매일 다시 채우면 안 된다. */
    if(t && !G.staff.crewInit){
      G.staff.crewInit=1;
      const need=[["ac",null],["coach","atk"],["coach","def"],["gk",null],["doc",null]];
      for(const [rk, slot] of need){
        if(C.some(x=>x&&x.role===rk && (rk!=="coach" || x.assign===slot))) continue;
        if(rk!=="ac" && C.filter(x=>x&&x.role===rk).length>=AC_ROLE[rk].cap) continue;
        const c=acDefaultFor(t, rk);
        if(slot) c.assign=slot;
        C.push(c);
      }
    }
    if(!Array.isArray(G.acPool) || !G.acPool.length) acPoolFill();
    else if(G.acPool.length < AC_POOL_N) acPoolTopUp(G.acPool);   // 시장이 넓어졌으면 그만큼 채운다
  }catch(e){}
}
function staffLog(txt){
  const st=staffOpt();
  st.log.unshift({txt, d:G.day||0, s:G.season});
  st.log=st.log.slice(0,12);
}
/* ── 불만 사유 정의 ────────────────────────────────────────────
   FM처럼 "무엇에 불만인가"에 따라 감독이 줄 수 있는 카드가 다르다. */
const GRIEVE={
  playtime:{n:"출전 시간", ic:"⏱️",
    say:p=>`"${p.name} 선수가 출전 기회를 두고 답답해합니다. ${(p.apps|0)>0?`올 시즌 ${p.apps}경기 출전이 성에 차지 않는 모양입니다.`:"올 시즌 아직 한 경기도 나서지 못했으니까요."}"`,
    talk:[
      {t:"다음 3경기 안에 반드시 기회를 주겠다고 약속한다", k:"promise", m:6, r:2,
       say:p=>`"믿겠습니다, 감독님. 준비하고 있겠습니다."`},
      {t:"지금 네 경기력으로는 부족하다고 솔직히 말한다", k:"blunt", m:-4, r:0,
       say:p=>`"...알겠습니다. 훈련장에서 보여드리죠."`},
      {t:"팀 사정을 설명하고 조금만 기다려 달라고 한다", k:"calm", m:2, r:1,
       say:p=>`"이해합니다. 다만 오래 기다리진 못합니다."`}]},
  wage:{n:"연봉", ic:"💰",
    say:p=>`"${p.name} 선수 에이전트가 연봉 이야기를 꺼냈습니다. 또래보다 적게 받고 있다고 생각합니다."`,
    talk:[
      {t:"재계약 때 반드시 반영하겠다고 약속한다", k:"promiseWage", m:5, r:2,
       say:p=>`"약속하신 겁니다. 기억하고 있겠습니다."`},
      {t:"연봉은 성적으로 증명한 뒤에 이야기하자고 한다", k:"blunt", m:-3, r:0,
       say:p=>`"...증명하면 되는 겁니까? 좋습니다."`},
      {t:"구단 재정 사정을 솔직히 털어놓는다", k:"calm", m:1, r:1,
       say:p=>`"사정이 그렇다면... 알겠습니다."`}]},
  star:{n:"핵심 선수 이적", ic:"💔",
    say:p=>`"핵심 선수가 팀을 떠난 뒤로 ${p.name} 선수가 구단의 방향을 의심하고 있습니다."`,
    talk:[
      {t:"이적료로 반드시 좋은 선수를 데려오겠다고 약속한다", k:"promiseSign", m:6, r:2,
       say:p=>`"그 말 믿고 남는 겁니다."`},
      {t:"이제 네가 이 팀의 중심이라고 말한다", k:"lift", m:8, r:2,
       say:p=>`"...제가요? 부담되지만, 해보겠습니다."`},
      {t:"프로라면 선수 한 명에 흔들리면 안 된다고 한다", k:"blunt", m:-4, r:0,
       say:p=>`"맞는 말씀입니다만... 서운한 건 서운한 겁니다."`}]},
  form:{n:"팀 성적", ic:"📉",
    say:p=>`"최근 성적 때문에 ${p.name} 선수가 라커룸에서 불안한 이야기를 하고 다닙니다."`,
    talk:[
      {t:"반등 계획을 구체적으로 설명한다", k:"calm", m:5, r:1,
       say:p=>`"계획이 있다니 다행입니다. 따르겠습니다."`},
      {t:"팀 분위기를 흔들지 말라고 경고한다", k:"warn", m:-5, r:0,
       say:p=>`"...제 말이 그런 뜻은 아니었습니다."`},
      {t:"고참으로서 라커룸을 잡아 달라고 부탁한다", k:"lead", m:6, r:2,
       say:p=>`"제가 뭐라고... 알겠습니다. 해보겠습니다."`}]},
  role:{n:"전술 내 역할", ic:"🧭",
    say:p=>`"${p.name} 선수가 자기 자리가 아닌 곳에서 뛰는 것에 불만이 있습니다."`,
    talk:[
      {t:"원래 포지션으로 돌려주겠다고 약속한다", k:"promiseRole", m:6, r:2,
       say:p=>`"감사합니다. 거기서라면 자신 있습니다."`},
      {t:"팀을 위해 그 자리가 필요하다고 설득한다", k:"calm", m:2, r:1,
       say:p=>`"팀을 위해서라면... 해보겠습니다."`},
      {t:"어디서든 뛰는 게 프로라고 잘라 말한다", k:"blunt", m:-4, r:0,
       say:p=>`"...네, 알겠습니다."`}]},
  listed:{n:"이적명단 등록", ic:"📤",
    say:p=>`"${p.name} 선수가 자기 이름이 이적명단에 올라간 걸 알았습니다. 많이 상해 있습니다."`,
    talk:[
      {t:"명단에서 빼겠다고 약속한다", k:"unlist", m:9, r:2,
       say:p=>`"...감사합니다. 이 팀에서 더 보여드리겠습니다."`},
      {t:"구단 재정 사정을 솔직히 설명한다", k:"calm", m:2, r:1,
       say:p=>`"구단 사정이라면... 이해는 하겠습니다."`},
      {t:"좋은 팀을 찾아주겠다고 약속한다", k:"allow", m:4, r:1,
       say:p=>`"그렇게까지 신경 써 주신다면, 알겠습니다."`},
      {t:"프로는 언제든 팔릴 수 있다고 말한다", k:"blunt", m:-7, r:0,
       say:p=>`"...그 말씀, 잊지 않겠습니다."`}]},
  rumor:{n:"이적 루머", ic:"📰",
    say:p=>`"${p.name} 선수가 자기 이적설 기사를 계속 보고 있습니다. 집중이 흔들립니다."`,
    talk:[
      {t:"너는 우리 계획의 중심이라고 못 박는다", k:"lift", m:7, r:2,
       say:p=>`"그 말씀 들으니 마음이 놓입니다. 경기에 집중하겠습니다."`},
      {t:"기사에 신경 쓰지 말라고 담담히 말한다", k:"calm", m:3, r:1,
       say:p=>`"네. 신경 안 쓰겠습니다."`},
      {t:"관심이 온 건 사실이지만 결정은 구단이 한다고 한다", k:"blunt", m:-2, r:1,
       say:p=>`"...그럼 저는 뭘 준비해야 합니까?"`},
      {t:"기자회견에서 공개적으로 잔류를 선언하겠다고 한다", k:"pledgeStay", m:8, r:3,
       say:p=>`"감독님이 그렇게까지 해주신다면... 남겠습니다."`}]},
  abroad:{n:"해외 진출 희망", ic:"✈️",
    say:p=>`"${p.name} 선수가 해외에서 뛰어 보고 싶어 합니다. 나이도 지금이 마지막 기회라 생각하는 것 같습니다."`,
    talk:[
      {t:"좋은 제안이 오면 막지 않겠다고 약속한다", k:"allow", m:6, r:2,
       say:p=>`"그 말씀만으로도 충분합니다. 남은 기간 최선을 다하겠습니다."`},
      {t:"여기서 더 성장한 뒤에 가는 게 낫다고 설득한다", k:"calm", m:3, r:1,
       say:p=>`"...한 시즌만 더 생각해 보겠습니다."`},
      {t:"지금 실력으로는 어디서도 안 통한다고 잘라 말한다", k:"blunt", m:-9, r:0,
       say:p=>`"제가 그 정도밖에 안 됩니까?"`}]},
  transfer:{n:"이적 요청", ic:"🚪",
    say:p=>`"${p.name} 선수가 새로운 도전을 원한다고 합니다. 이적을 알아봐 달라는 뜻이죠."`,
    talk:[
      {t:"이적을 허용하고 좋은 팀을 찾아보겠다고 한다", k:"allow", m:4, r:1,
       say:p=>`"고맙습니다. 마지막까지 최선을 다하겠습니다."`},
      {t:"너는 우리 계획의 중심이라고 붙잡는다", k:"lift", m:5, r:2,
       say:p=>`"...한 시즌만 더 해보겠습니다."`},
      {t:"계약이 남아 있으니 그런 소리 말라고 한다", k:"blunt", m:-6, r:0,
       say:p=>`"계약서로 사람 붙잡는 건 좀 아니지 않습니까."`}]},
  /* 💸 ⚠ 제보 원문 — 「1라운드부터 19라운드까지 붙박이 주전으로 사용한 선수가 '출전 시간이
     부족해 답답하다'고 스태프 회의에 올라오는 버그 (1명은 GK라서 교체 출전 또한 없던 상황)
     … 임금 체불로 인한 불만이었는데 임금 체불 불만이 없어서 모두 '출전 시간'을 빌미로
     불만을 표출한 것」. 원인 — waHit 가 uWhy="임금 체불"을 세팅하는데 grieveKey 에 그
     매핑이 없어 기본값 "playtime"으로 떨어졌다. 전용 대본을 만든다. */
  arrears:{n:"임금 체불", ic:"💸",
    say:p=>`"${p.name} 선수, 밀린 급여 이야기를 꺼냈습니다. 라커룸 전체가 이 문제를 지켜보고 있습니다."`,
    talk:[
      {t:"밀린 임금을 최우선으로 해결하겠다고 약속한다", k:"payFirst", m:4, r:1,
       say:p=>`"감독님 잘못이 아닌 건 압니다. 그래도... 빨리 해결됐으면 합니다."`},
      {t:"구단 재정 상황을 숨김없이 설명한다", k:"calmArrears", m:2, r:1,
       say:p=>`"솔직하게 말씀해 주셔서 감사합니다. 조금만 더 기다려 보겠습니다."`},
      {t:"프로라면 돈 문제로 흔들리지 말라고 말한다", k:"blunt", m:-7, r:0,
       say:p=>`"...가족이 있는 사람한테 하실 말씀은 아닌 것 같습니다."`}]},
  /* 😶 매핑 없는 사유가 「출전 시간」으로 둔갑하지 않게 — 중립 대본으로 받는다 (제보 재발 방지) */
  general:{n:"사기 저하", ic:"😶",
    say:p=>`"${p.name} 선수 마음이 편치 않아 보입니다. 딱 하나를 꼬집기는 어렵지만, 한번 챙겨 보시죠."`,
    talk:[
      {t:"최근 활약을 칭찬하며 힘을 실어 준다", k:"lift", m:5, r:2,
       say:p=>`"...감사합니다. 조금 나아진 것 같습니다."`},
      {t:"고민이 있으면 언제든 찾아오라고 한다", k:"calm", m:3, r:1,
       say:p=>`"네. 마음 써 주셔서 감사합니다."`},
      {t:"프로답게 스스로 추스르라고 한다", k:"blunt", m:-3, r:0,
       say:p=>`"...알겠습니다."`}]}
};
/* 루머·이적설로 흔들리는 건 감독에 대한 불만이 아니라 "혼란"이다 — 표시를 구분한다 */
const CONFUSE_WHY=["이적 루머","이적설","해외 진출 희망","이적 요청"];
function isConfused(p){ return !!(p && p.unhappy>0 && CONFUSE_WHY.indexOf(p.uWhy)>=0); }
function moodTag(p){
  if(p.sulk>0) return {t:"😡 태업", c:"bad"};
  if(isConfused(p)) return {t:"😵 혼란", c:"warn"};
  if(p.unhappy>0) return {t:"😤 불만", c:"bad"};
  if(p.morale>=80) return {t:"😊 즐거움", c:"good"};
  if(p.morale>=62) return {t:"🙂 차분함", c:""};
  if(p.morale>=48) return {t:"😐 걱정스러움", c:"warn"};
  return {t:"😞 불안함", c:"bad"};
}
function grieveKey(p){
  const w=p.uWhy||"";
  /* 💸 체불이 이적 요청으로 번진 뒤에는 이적 대본이 맞다 — 순수 체불만 전용 대본으로 */
  if(w.indexOf("체불")>=0 && w.indexOf("이적")<0) return "arrears";
  if(w.indexOf("출전")>=0) return "playtime";
  if(w.indexOf("연봉")>=0) return "wage";
  if(w.indexOf("핵심")>=0||w.indexOf("이적으로")>=0) return "star";
  if(w.indexOf("성적")>=0) return "form";
  if(w.indexOf("역할")>=0||w.indexOf("포지션")>=0) return "role";
  if(w.indexOf("이적명단")>=0) return "listed";
  if(w.indexOf("루머")>=0) return "rumor";
  if(w.indexOf("해외")>=0) return "abroad";
  if(w.indexOf("이적")>=0) return "transfer";
  /* ⚠ 제보 — 기본값이 "playtime"이라 매핑 없는 사유(임금 체불·폭행·약속 불이행 등)가
     전부 「출전 시간이 부족해 답답하다」로 표시됐다. 붙박이 주전 GK까지. 중립 대본으로. */
  return "general";
}
/* 오늘 수석코치가 들고 온 안건
   ⚠ 제보 — 「연봉, 출전시간 불만인 선수들이 있는데 스태프회의에 안뜨네용」.
   ① 안건을 4건으로 자르니 불만 3단계(이적 요청)·고OVR 선수가 늘 위 4칸을 차지해
      연봉·출전시간 1단계 불만은 영영 회의에 못 올라왔다 → 자르지 않는다. 전부 보고한다.
   ② 면담·무시한 선수(handled)는 라운드가 끝나야 풀렸는데, 프리시즌·오프시즌·컵
      기간에는 라운드가 안 끝나 몇 주씩 회의에서 사라졌다 → 7일이 지나면 다시 올라온다. */
function staffAgenda(){
  const t=userTeam(); if(!t) return [];
  const st=staffOpt();
  return t.players
    .filter(p=>{
      if(!(p.unhappy>0) || p.promise) return false;
      const h=st.handled[p.id];
      if(!h) return true;
      if(h===true) return false;                       // 구버전 값 — 라운드 종료 청소를 기다린다
      if(h.s!==G.season) return true;
      return (G.day||0)-(h.d||0) >= 7;                 // 넘긴 지 7일이 지나면 다시 보고한다
    })
    .sort((a,b)=>(b.unhappy-a.unhappy)||(b.ovr-a.ovr));
}
/* ═══════════════════════════════════════════════════════════════
   선수 개인 고민 — 체중 관리
   불만(unhappy)과는 다른 축이다. 팀이 미운 게 아니라 자기 몸이 걱정인 것이다.
   그래서 이적 요청이나 태업으로 번지지 않고, 대신 방치하면 몸이 실제로 무거워진다.
   체중은 bodyFx() 를 통해 몸싸움(+)·민첩(-)·주력(-)에 그대로 반영되므로
   살이 찌면 강해지는 대신 굼떠진다 — 어느 쪽이 그 선수에게 이득인지는 포지션마다 다르다.
═══════════════════════════════════════════════════════════════ */
const WEIGHT_MIN=80;                 // 이 밑으로는 고민이 생기지 않는다
function bmiOf(p){ const h=(p.h||178)/100; return (p.w||74)/(h*h); }
function weightRisk(p){
  if((p.w||0) < WEIGHT_MIN) return 0;
  const a=p.attr||{}, age=G.season-p.by;
  let r = 0.06 + (bmiOf(p)-23.2)*0.15;                // 체형이 두꺼울수록
  r += clamp(((p.w||74)-84)*0.012, 0, 0.14);          // 절대 체중도 본다 — 90kg은 그 자체로 부담이다
  r += clamp((age-27)*0.020, 0, 0.16);                // 나이가 들수록 관리가 어렵다
  if(p.pos==="GK") r*=0.55;                            // 골키퍼는 덩치가 곧 무기라 잣대가 다르다
  r += (10-attr20(a.nat||60))*0.014;                  // 타고난 체력이 낮으면 잘 찐다
  r += (10-attr20(a.det||60))*0.010;                  // 승부욕(자기 관리)
  r += (75-(p.cond||90))*0.004;                       // 요즘 몸 상태
  if(playShareKnown() && playShare(p)<0.3) r+=0.10;   // 안 뛰면 관리가 느슨해진다
  if(p.inj>0) r+=0.08;                                 // 재활 중에는 특히
  return clamp(r, 0, 0.9);
}
/* 라운드마다 한 번씩 굴린다 — 팀에 한 명 정도만 걸리게 */
function brewConcerns(){
  const t=userTeam(); if(!t) return;
  const rp=t.div===1?G.r1:G.r2; if(rp<2) return;
  for(const p of t.players){
    if(p.concern || p.loan) continue;
    const r=weightRisk(p);
    if(r<=0) continue;
    if(Math.random() < r*0.14){
      p.concern={k:"weight", lv:1, d:(G.day||0), w0:p.w};
      addMood(`⚖️ ${p.name} 선수가 체중 때문에 고민하고 있습니다. (스태프 회의에서 다룰 수 있습니다)`);
      break;
    }
  }
  // 방치하면 더 무거워진다 — 2주에 1kg씩
  for(const p of t.players){
    if(!p.concern || p.concern.k!=="weight") continue;
    if((G.day||0)-(p.concern.d||0) >= 14){
      p.concern.d=(G.day||0); p.concern.lv=Math.min(3, (p.concern.lv||1)+1);
      if(p.w < (p.concern.w0||p.w)+8) p.w=(p.w||74)+1;   // 무한정 찌지는 않는다
      p.cond=clamp((p.cond||90)-3, 40, 100);
      if(p.concern.lv>=2) addMood(`⚖️ ${p.name} 선수의 체중이 또 늘었습니다 (${p.w}kg). 방치하면 경기력에 영향이 옵니다.`);
    }
  }
}
/* 감독의 대응 — 방식마다 통하는 선수가 다르다.
   ok/no 는 여러 줄 중 하나가 뽑힌다. 같은 선택지를 두 번 골라도 같은 말을 듣지 않게. */
const WEIGHT_OPTS=[
  {k:"train", t:"🏃 새벽에 같이 뛴다", d:"감독이 직접 나와 같이 달린다. 시간이 들지만 이 방법을 싫어하는 선수는 드물다.",
   base:0.50, kg:2, mor:6, aff:8, cost:0,
   ok:["\"감독님이 먼저 나와 계시니 안 나올 수가 없더군요. 계속하겠습니다.\"",
       "\"솔직히 첫 주는 죽는 줄 알았습니다. 지금은 안 뛰면 이상해요.\"",
       "\"감독님이 저보다 빠르시더라고요. 그게 제일 부끄러웠습니다.\""],
   no:["\"...죄송합니다. 사흘 나오고 못 나갔습니다.\"",
       "\"새벽에 일어나는 게 이렇게 힘든 줄 몰랐습니다.\"",
       "\"뛰고 나서 더 먹게 되더라고요.\""]},
  {k:"diet", t:"🥗 영양사를 붙이고 식단을 관리한다", d:"돈이 든다(0.5억). 대신 성격을 타지 않고 꾸준히 듣는다.",
   base:0.62, kg:2, mor:2, aff:3, cost:0.5,
   ok:["\"먹는 걸 바꾸니까 몸이 가벼워졌습니다. 진작 할 걸 그랬어요.\"",
       "\"제가 뭘 잘못 먹고 있었는지 이제 알겠습니다.\"",
       "\"닭가슴살이 이렇게 맛있을 일인가 싶다가도, 숫자가 줄어드니까요.\""],
   no:["\"식단표는 받았는데... 회식이 많아서요.\"",
       "\"집에서 주시는 걸 안 먹을 수가 없습니다, 감독님.\"",
       "\"낮에는 지켰습니다. 밤이 문제였죠.\""]},
  {k:"talk", t:"💬 조용히 불러 이야기한다", d:"자존심을 건드리지 않는다. 자기 관리가 되는 선수에게 잘 통한다.",
   base:0.40, kg:1, mor:3, aff:5, cost:0,
   ok:["\"말씀 안 하셨어도 알고는 있었습니다. 잡겠습니다.\"",
       "\"조용히 불러 주셔서 감사합니다. 라커룸에서 들었으면 더 힘들었을 겁니다.\"",
       "\"거울은 매일 봤습니다. 이제 체중계도 보겠습니다.\""],
   no:["\"네, 알겠습니다.\" (말뿐인 대답이었다)",
       "\"저 정도면 괜찮은 편 아닙니까?\" (그렇지 않다)",
       "(고개만 끄덕이고 나갔다. 그게 전부였다)"]},
  {k:"harsh", t:"😤 \"넌 오늘부터 굶어라\" 하고 다그친다", d:"통하면 확실하다. 어긋나면 사기와 관계가 함께 무너진다.",
   base:0.30, kg:3, mor:8, aff:4, cost:0, risk:true,
   ok:["\"...두고 보십시오. 두 달 뒤에 다시 말씀하시죠.\"",
       "\"열받아서라도 뺍니다.\" (눈빛이 달라졌다)",
       "\"그 말씀 잊지 않겠습니다.\" (다음 날 새벽 러닝머신에 그가 있었다)"],
   no:["\"굶으라고요? 제가 애도 아니고...\" (표정이 굳었다)",
       "\"프로 선수한테 하실 말씀은 아닌 것 같습니다.\"",
       "(아무 말 없이 나갔다. 라커룸 분위기가 하루 종일 무거웠다)"]},
  {k:"fine", t:"💸 체중 기준을 정하고 벌금을 건다", d:"프로답게 계약으로 다룬다. 감정은 상하지만 효과는 있다.",
   base:0.54, kg:2, mor:-3, aff:-4, cost:0,
   ok:["\"벌금 내기 싫어서라도 뺍니다. 계약서에 넣으시죠.\"",
       "\"기준이 있으니까 오히려 편합니다. 숫자만 맞추면 되니까요.\"",
       "\"한 달치 벌금 내고 정신 차렸습니다.\""],
   no:["\"돈으로 사람을 움직이시는군요.\" (벌금만 내고 그대로다)",
       "\"낼 만합니다.\" (그게 문제였다)",
       "\"구단이 저를 선수가 아니라 숫자로 보시는 것 같습니다.\""]},
  {k:"vet", t:"🎖️ 주장에게 관리를 맡긴다", d:"라커룸에서 형이 잡아 주는 게 나을 때가 있다.",
   base:0.44, kg:2, mor:4, aff:2, cost:0, byCap:true,
   ok:["\"형이 매일 체중계 앞으로 끌고 갑니다. 도망을 못 가요.\"",
       "\"형이 자기도 같이 뺀다고 해서... 안 할 수가 없었습니다.\"",
       "\"감독님한테 혼나는 것보다 형한테 혼나는 게 더 무섭습니다.\""],
   no:["\"형도 저랑 같이 야식을 먹던데요...\"",
       "\"형이 바쁘셔서 며칠 보고 마셨습니다.\"",
       "(주장도 난감해했다. \"저놈은 제 말도 안 듣습니다.\")"]}
];
/* 코치 보고와 선수의 첫 마디 — 상황을 읽어서 고른다 */
function weightCoachSay(p, lv){
  if(lv>=3) return `"${p.name} 선수, 이제는 눈에 보일 정도입니다. 더 두면 몸이 먼저 무너집니다."`;
  if(lv>=2) return `"지난번에 말씀드린 뒤로 더 늘었습니다. 이번엔 넘어가면 안 됩니다."`;
  if(p.inj>0) return `"재활 중이라 훈련량이 준 사이에 체중이 올라왔습니다. 지금 잡아야 복귀가 편합니다."`;
  if(playShareKnown() && playShare(p)<0.3) return `"경기를 못 뛰다 보니 관리가 느슨해진 것 같습니다. 마음이 뜬 겁니다."`;
  if(G.season-p.by>=31) return `"나이가 있는 선수라 예전 훈련량으로는 안 빠집니다. 방식을 바꿔야 합니다."`;
  return `"${p.name} 선수 체중이 관리 범위를 넘었습니다. 지금이 잡을 때입니다."`;
}
function weightPlayerSay(p, lv){
  const age=G.season-p.by, pool=[];
  if(lv>=3) pool.push(`"거울 보기가 싫습니다. 저도 알고 있습니다..."`, `"이제는 팬들도 아시는 것 같습니다."`);
  if(p.inj>0) pool.push(`"다쳐서 못 뛰는 동안 몸이 이렇게 됐습니다."`);
  if(playShareKnown() && playShare(p)<0.3) pool.push(`"안 뛰니까 관리할 이유를 못 찾겠습니다. 핑계인 건 압니다."`);
  if(age>=32) pool.push(`"예전엔 이틀만 뛰면 빠졌는데, 지금은 안 빠집니다."`);
  if(age<=22) pool.push(`"프로 와서 밥이 너무 맛있습니다... 죄송합니다."`);
  if(p.pos==="GK") pool.push(`"키퍼는 좀 있어도 된다고들 하는데, 발이 안 나갑니다."`);
  pool.push(`"요즘 몸이 좀 무겁습니다. 저도 압니다..."`, `"작년 유니폼이 안 맞습니다, 감독님."`,
            `"체중계 올라가기가 무섭습니다."`, `"머리로는 아는데 다리가 늦어요."`);
  return pick(pool);
}
function weightChance(p, o){
  const a=p.attr||{}, pers=p.pers||0, age=G.season-p.by;
  let c=o.base;
  c += (attr20(a.det||60)-10)*0.022;                  // 승부욕 = 자기 관리
  c += (attr20(a.nat||60)-10)*0.008;
  c += (aff(p)-50)*0.005;
  c += ((p.morale||70)-70)*0.004;
  c -= ((p.concern&&p.concern.lv||1)-1)*0.12;         // 오래 방치했을수록 되돌리기 어렵다
  if(o.k==="harsh"){ c += [0.10,0.06,-0.22,-0.14][pers];  if(age>=32) c-=0.10; }
  if(o.k==="talk"){  c += [0.12,0.00,0.14,-0.08][pers]; }
  if(o.k==="train"){ c += [0.06,0.08,0.06,0.10][pers];  if(age>=33) c-=0.12; }
  if(o.k==="fine"){  c += [0.08,0.10,-0.10,-0.12][pers]; }
  if(o.k==="vet"){
    const t=userTeam(), cap=captainOf(t);
    if(!cap || cap.id===p.id) return 0;
    c += (attr20((cap.attr||{}).ldr||60)-10)*0.018 + (attr20((cap.attr||{}).tea||60)-10)*0.010;
    if((cap.w||74)>=WEIGHT_MIN) c-=0.12;              // 자기도 무거운 형이 잡아 봐야
  }
  return clamp(c, 0.05, 0.95);
}
function weightCard(p){
  const t=userTeam();
  const lv=(p.concern&&p.concern.lv)||1;
  const gained=(p.w||74)-((p.concern&&p.concern.w0)||p.w||74);
  const bmi=bmiOf(p).toFixed(1);
  const say=weightPlayerSay(p, lv);
  return `<div class="stItem">
    <div class="stHead">⚖️ <b class="pos-${p.pos}">${p.name}</b>
      <span class="small">${G.season-p.by}세 · ${PERS_N[p.pers||0]} · ${p.h||178}cm ${p.w||74}kg (BMI ${bmi})
      ${gained>0?` · <b style="color:var(--red)">+${gained}kg</b>`:""} · 심각도 ${lv}/3</span></div>
    <div class="stSay">📋 컨디셔닝 코치: ${weightCoachSay(p, lv)}</div>
    <div class="stSay" style="opacity:.85">${p.name}: ${say}</div>
    <div class="stBtns">
      ${WEIGHT_OPTS.map((o,i)=>{ const ch=weightChance(p,o);
        if(!ch) return "";
        const col=ch>=0.7?"var(--green)":ch>=0.45?"var(--gold)":"var(--red)";
        return `<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:8px${o.risk?";border-color:var(--red)":""}"
          onclick="weightPick(${p.id},${i})">${o.t}
          <span class="small">${o.d} — 성공 <b style="color:${col}">${Math.round(ch*100)}%</b>${o.cost?` · 비용 ${o.cost}억`:""}</span></button>`;}).join("")}
      <button class="mini" onclick="weightIgnore(${p.id})">🙉 알아서 하겠지</button>
    </div></div>`;
}
function weightPick(pid, i){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); const o=WEIGHT_OPTS[i];
  if(!p||!o||!p.concern) return;
  if(o.cost && t.budget<o.cost){ flash("예산이 부족합니다.","warn"); return; }
  if(o.cost) t.budget=Math.round((t.budget-o.cost)*10)/10;
  const ch=weightChance(p,o);
  const st=staffOpt();
  const cap=captainOf(t);
  let box;
  const roll=Math.random();
  if(roll<ch){
    const great = roll < ch*0.22;                       // 기대 이상으로 잘 풀린 경우
    const kg=o.kg + (great?2:(Math.random()<0.35?1:0));
    p.w=Math.max(62, (p.w||74)-kg);
    p.cond=clamp((p.cond||90)+(great?9:5), 40, 100);
    p.morale=clamp(p.morale+o.mor+(great?4:0), 25, 99);
    affAdd(p, o.aff+(great?4:0), "체중 관리");
    p.concern=null;
    if(o.byCap && cap){ cap.morale=clamp(cap.morale+2,25,99); affAdd(cap,3,"후배 관리"); }
    if(great) addMood(`💪 ${p.name} 선수가 몸을 완전히 만들어 돌아왔습니다. (${p.w}kg)`, "good");
    box=`<div class="msg good" style="border-width:2px">${great?"💪 <b>기대 이상입니다</b> — ":"⚖️ "}<b>${p.name}</b> ${kg}kg 감량 (${p.w}kg)<br>
      ${p.name}: ${pick(o.ok)}
      <span class="small"> — 민첩성·주력이 가벼워지고 컨디션이 올랐습니다. 대신 몸싸움은 조금 줄어듭니다.</span></div>`;
    staffLog(`${p.name}의 체중 관리 — ${o.t.replace(/^[^ ]+ /,"")} ${great?"대성공":"성공"} (${kg}kg 감량)`);
  } else {
    const bad = o.risk && roll > ch+(1-ch)*0.55;         // 다그치기가 최악으로 어긋난 경우
    p.morale=clamp(p.morale+(bad?-16:o.risk?-9:o.k==="fine"?-4:-2), 25, 99);
    affAdd(p, bad?-15:o.risk?-8:o.k==="fine"?-5:-1, "체중 관리 실패");
    p.concern.lv=Math.min(3,(p.concern.lv||1)+1);
    p.concern.d=(G.day||0);
    if(o.byCap && cap){ cap.morale=clamp(cap.morale-2,25,99); }
    if(bad && !p.unhappy){ p.unhappy=1; p.uWhy="감독과의 갈등";
      addMood(`😠 ${p.name}이(가) 감독의 언사에 크게 상했습니다. 불만이 생겼습니다.`, "bad"); }
    box=`<div class="msg ${bad?"bad":"warn"}" style="border-width:2px">⚖️ <b>${p.name}</b> — ${bad?"완전히 어긋났습니다.":"나아지지 않았습니다."}<br>
      ${p.name}: ${pick(o.no)}
      <span class="small"> — 심각도 ${p.concern.lv}/3${bad?" · 선수가 감독에게 등을 돌렸습니다":o.risk?" · 관계가 상했습니다":""}</span></div>`;
    staffLog(`${p.name}의 체중 관리 시도가 ${bad?"역효과를 냈습니다":"실패했습니다"}.`);
  }
  st.delegBox=box;
  saveGame(); show("staff");
}
function weightIgnore(pid){
  const p=userTeam().players.find(x=>x.id===pid); if(!p||!p.concern) return;
  p.concern.lv=Math.min(3,(p.concern.lv||1)+1);
  p.concern.d=(G.day||0);
  p.morale=clamp(p.morale-2,25,99);
  staffOpt().delegBox=`<div class="msg info">⚖️ ${p.name} 선수의 체중 문제를 그대로 두었습니다. <span class="small">방치하면 2주마다 1kg씩 늘어납니다.</span></div>`;
  saveGame(); show("staff");
}
/* ── 불만 발생기 — 라운드마다 상황을 훑어 새 불만을 만든다.
   기존 로직(출전시간·연봉)에 더해 팀 성적·핵심 선수 이탈·전술 역할까지 본다. */
function brewGrievances(){
  const t=userTeam(); if(!t) return;
  const rp=t.div===1?G.r1:G.r2; if(rp<3) return;
  const tAvg=teamOVR(t);
  const last5=t.form.slice(-5), losses=last5.filter(f=>f==="L").length;
  const xi=bestXI(t), slots=computeRenderSlots(t, xi);
  for(const p of t.players){
    if(p.unhappy>0 || p.promise || p.inj>0) continue;
    const key=(p.pers||0);
    let bold = key===1 ? 1.6 : key===3 ? 1.3 : key===2 ? 0.6 : 1;     // 야심가·다혈질이 먼저 목소리를 낸다
    bold *= clamp(1.8 - aff(p)/62, 0.35, 1.9);                        // 감독을 신뢰하면 웬만해선 참는다
    /* 🎩 수석코치의 선수관리 — 좋은 코치는 불만이 커지기 전에 라커룸에서 끈다.
       공석이면 아무도 안 듣고 있어서 1.5배로 자란다. */
    try{ bold *= acManK(); }catch(e){}
    // 팀 성적 우려 — 최근 5경기 3패 이상
    if(losses>=3 && Math.random()<0.05*bold){
      p.unhappy=1; p.uWhy="팀 성적";
      addMood(`😟 ${p.name}이(가) 최근 팀 성적을 두고 불안해합니다. (스태프 회의에서 처리)`); continue;
    }
    // 핵심 선수 이탈 직후 — G.starGone 은 판매 시 세팅된다
    if(G.starGone && G.starGone>0 && p.ovr>=tAvg && Math.random()<0.07*bold){
      p.unhappy=1; p.uWhy="핵심 선수 이적";
      addMood(`💔 ${p.name}이(가) 구단의 방향에 의문을 품고 있습니다. (스태프 회의에서 처리)`); continue;
    }
    // 전술 내 역할 — 선발이지만 선호 포지션이 아닌 자리에서 계속 뛴다
    const sl=slots[p.id];
    if(sl && prefSlotOf(p)!==sl && SLOT_BAND[sl]!==SLOT_BAND[prefSlotOf(p)] && Math.random()<0.05*bold){
      p.unhappy=1; p.uWhy="전술 역할";
      addMood(`🧭 ${p.name}이(가) 맡은 자리에 대해 불만을 표합니다. (스태프 회의에서 처리)`); continue;
    }
  }
  if(G.starGone>0) G.starGone--;
}
/* 🎩 조기 경보 — 선수관리가 좋은 코치는 「아직 불만이 되기 전」에 귀띔한다.
   ⚠ 요청의 「능력치가 좋을수록 … 효과가 탁월해져」를 라커룸 쪽에서 체감하게 하는 자리다.
   man 15 미만이면 이 보고 자체가 올라오지 않는다 — 그 코치는 아직 못 본 것이다. */
function acEarlyWarn(t){
  const c=acOf(); if(!c || (c.man|0)<15) return "";
  const risk=[];
  try{
    for(const p of (t.players||[])){
      if(p.unhappy>0 || p.promise || p.loan) continue;
      const a=aff(p), sh=playShare(p), age=G.season-(p.by||2000);
      let why=null;
      if(sh<0.30 && age<=24 && (p.pot||0)-(p.ovr||0)>=4) why="출전 시간이 모자랍니다 — 이대로면 성장도 멈추고 마음도 떠납니다";
      else if(a<=34)                                      why="감독을 향한 신뢰가 낮습니다 — 먼저 불러 이야기해 두시죠";
      else if((p.morale||65)<=42)                         why="사기가 바닥입니다 — 다음 경기 전에 손을 쓰는 게 좋겠습니다";
      if(why) risk.push({p, why, k:(a||0)+(p.morale||0)});
    }
  }catch(e){ return ""; }
  if(!risk.length) return "";
  risk.sort((x,y)=>x.k-y.k);
  const cap=(c.man|0)>=18 ? 4 : 2;                 // 눈이 밝을수록 더 멀리 본다
  return `<div style="margin-top:10px;padding:9px 11px;background:#0d1117;border:1px solid #30363d;border-radius:7px">
    <div class="small" style="margin-bottom:5px;color:var(--gold)">🎩 ${c.n}: "아직 불만으로 올라온 건 아닙니다만, 미리 말씀드립니다."
      <span style="opacity:.65">— 선수관리 ${c.man}</span></div>
    ${risk.slice(0,cap).map(r=>`<div class="small" style="line-height:1.8">· <b class="pos-${r.p.pos}">${r.p.name}</b> — ${r.why}</div>`).join("")}
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════
   📋 스태프 회의 — 직책별 보고
   ⚠ 지금까지 이 화면의 코치들은 전부 가짜였다. 「컨디셔닝 코치 보고」·「스카우트·육성 보고」는
   하드코딩된 이름이라 우리 코치진과 아무 연결이 없었고, 애초에 「컨디셔닝 코치」라는 직책은
   우리 시스템에 없다 — 팀 닥터를 특급으로 뽑아 놔도 회의에서 한마디도 안 했다.
   ─ 카드마다 실제로 그 자리에 앉은 사람이 자기 분야를 보고한다. 자리가 비면 카드가 사라진다.
   ─ 종합이 높을수록 더 많이·더 앞서 짚는다(경기 중 조언 렌즈와 같은 철학).
═══════════════════════════════════════════════════════════════ */
/* ⚠ 요청 — 「코치들이 보고할 때 선수들 능력치 나오는 거, 별 개수로 표현하게 해 줘」.
   보고에 숫자가 박혀 있으면 읽는 게 아니라 계산하게 된다. 게임의 기존 별 눈금을 그대로 쓴다.
   ─ 선수 종합은 abilityStars(p) (K리그 전체 대비 눈금)
   ─ 20 눈금 평균(훈련 갈래 능력)은 별도 눈금이라 여기서 따로 만든다. */
function stpStars20(v20, label){
  const v=clamp(Math.round((v20/20)*5*2)/2, 0.5, 5);
  return renderStars(v, `${label||""} ${(+v20).toFixed(1)}/20 · ${v}★`, null, true);
}
/* 선수 한 명을 「이름 + 별」로 — 보고 줄에서 반복해 쓴다 */
function stpP(p, extra){
  if(!p) return "";
  return `<b>${p.name}</b> ${abilityStars(p)}${extra?` <span style="opacity:.75">${extra}</span>`:""}`;
}
/* 보고 한 줄 — 텍스트 + (선택) 바로가기 버튼 */
function stpLine(txt, btn){
  return `<div class="small" style="display:flex;gap:8px;align-items:flex-start;line-height:1.8;padding:3px 0">
    <span style="flex:1;min-width:0">${txt}</span>${btn||""}</div>`;
}
function stpBtn(label, onclick){ return `<button class="mini" style="flex:0 0 auto;padding:3px 9px;white-space:nowrap" onclick="${onclick}">${label}</button>`; }
/* 직책 카드 껍데기 — 담당자 이름과 종합을 늘 달고 나온다 */
function stpCard(c, lines, foot){
  if(!c || !lines || !lines.length) return "";
  const RO=acRole(c), o=acOvr(c), g=acGrade(o);
  return `<div class="card stCard">
    <h3>${RO.ic} ${RO.n} 보고
      <span class="small">— <b>${c.n}</b> · 종합 <b style="color:${g[1]}">${o}</b>/20 ${g[0]}</span></h3>
    ${lines.join("")}
    ${foot||""}</div>`;
}
/* 등급 — 이 사람이 몇 줄까지, 얼마나 앞서 보는가 */
function stpDepth(c){ const o=acOvr(c); return o>=17?3 : o>=14?2 : o>=11?1 : 0; }

/* 🚑 팀 닥터 — 부상자·복귀·재발 위험 */
/* 🩺 부상자 한 명의 소견서 — 감독이 처치를 고르는 자리 (요청) */
function injChartRow(p){
  const w=injWeeksLeft(p); if(w<=0) return "";
  const doc=docOf();
  const canPain=(w<=INJ_PAIN_MAXW && injCanPain(p));
  const canSurg=(injCanSurg(p) && w>=2 && !!doc);
  const pushK=doc?clamp(INJ_PUSH_K-(docReh()-10)*0.024, 0.52, 0.95):1;
  const pushW=Math.max(1, Math.round(w*pushK));
  const canPush=(!!doc && w>=2 && pushW<w && injCanPush(p));
  const pct=Math.round(painBreakOf(w)*100);
  const cost=injSurgCost(w);
  const tag=[];
  if(p.surg && p.surg.s===G.season) tag.push(`<span class="tag" style="color:#7ee2a8;border:1px solid #2c4">🏥 수술 후</span>`);
  if(p.rehab && (G.day||0)<(p.rehab.until||0)) tag.push(`<span class="tag" style="color:#ff9d5c;border:1px solid #a63">⚡ 집중 재활</span>`);

  const btn=(on,ic,nm,fn,ttl)=>on
    ? `<button class="mini" onclick="${fn}" title="${ttl}">${ic} ${nm}</button>`
    : `<button class="mini" disabled style="opacity:.32" title="${ttl}">${ic} ${nm}</button>`;
  /* 🚑 유형·원인·같은 부위 반복 (요청) */
  const T0=injTypeOf(p), C0=INJ_CAUSE[p.injC];
  const partK=T0?T0.part:null;
  const rep0=partK?injPartCount(p, partK):0;
  if(rep0>=2) tag.push(`<span class="tag" style="color:#f85149;border:1px solid #a33" title="이 부위를 반복해 다치고 있습니다 — 다시 다칠 확률과 회복 기간이 함께 올라갑니다">🔁 ${INJ_PART_N[partK]||"같은 부위"} ${rep0}회째</span>`);
  return `<div class="meRow" style="align-items:flex-start">
    <span class="meIc">${T0?T0.ic:"🩹"}</span>
    <span class="meN"><b>${p.name}</b> ${abilityStars(p)} <span class="small">${p.pos} · ${G.season-p.by}세</span> ${tag.join(" ")}<br>
      <span class="small">${T0?`<b>${T0.n}</b> <span style="opacity:.7">(${INJ_PART_N[T0.part]||""})</span> · `:""}진단 <b style="color:${w>=6?"#f85149":w>=3?"var(--gold)":"#e6edf3"}">${w}주</b>
        ${(p.injW0&&p.injW0>w)?`<span style="opacity:.6">(최초 ${p.injW0}주)</span>`:""}</span>
      ${C0?`<br><span class="small" style="opacity:.7">${C0.ic} ${C0.tell} 다쳤습니다</span>`:""}
      <div class="stBtns" style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">
        ${btn(canPain,"💊","진통제",`injPain(${p.id})`, canPain?`다음 한 경기를 뛴다 — 재발 위험 ${pct}%`:(!injCanPain(p)?injWhyNo(p,"pain"):`${INJ_PAIN_MAXW}주를 넘는 부상에는 쓸 수 없습니다`))}
        ${btn(canSurg,"🏥","수술",`injSurg(${p.id})`, canSurg?`회복 ${w}주 → ${Math.max(w+1,Math.round(w*INJ_SURG_K))}주 · ${cost}억 · 재발 위험 소멸`:(!doc?"팀 닥터가 없습니다":injWhyNo(p,"surg")))}
        ${btn(canPush,"⚡","집중 재활",`injPush(${p.id})`, canPush?`복귀 ${w}주 → ${pushW}주 · 대신 재발 위험`:(!doc?"팀 닥터가 없습니다":(!injCanPush(p)?injWhyNo(p,"push"):"더 당길 여지가 없습니다")))}
      </div></span>
    <span class="meV" style="white-space:nowrap">${painOn(p)?`<span style="color:var(--red)">💊 처방됨</span>`:""}</span>
  </div>`;
}
function stpDoc(t){
  const c=crewOf("doc")[0];
  /* 🩺 ⚠ 요청 — 팀 닥터가 공석이어도 「소견서」는 감독이 직접 봐야 한다.
     담당자가 없을 때는 진통제만 열리고 위험이 가장 크다는 걸 앞에서 알린다. */
  if(!c){
    const inj0=t.players.filter(p=>p.inj>0 && !p.loan).sort((a,b)=>injWeeksLeft(a)-injWeeksLeft(b));
    if(!inj0.length && !t.players.some(p=>painOn(p))) return "";
    return `<div class="card stCard" style="border-color:#3a2a2a">
      <h3>🩺 부상자 소견서 <span class="small">— 팀 닥터 공석</span></h3>
      <p class="small" style="color:var(--gold)">🩺 <b>팀 닥터가 없습니다</b> — 수술·집중 재활은 결정할 수 없고,
        진통제만 쓸 수 있으며 <b>재발 위험이 가장 큽니다</b>. 전치 기간도 길게 나옵니다.</p>
      ${inj0.map(injChartRow).join("")}
      <div class="stBtns" style="margin-top:6px"><button class="mini" onclick="acGoHire()">🎩 팀 닥터 영입하러 가기</button></div>
    </div>`;
  }
  const d=stpDepth(c), L=[];
  const inj=t.players.filter(p=>p.inj>0 && !p.loan).sort((a,b)=>injWeeksLeft(a)-injWeeksLeft(b));
  if(!inj.length) L.push(stpLine(`🩺 "부상자는 없습니다. 지금 몸 상태는 좋습니다."`));
  else {
    L.push(stpLine(`🩺 부상자 <b>${inj.length}명</b> — ${inj.slice(0,4).map(p=>stpP(p,`${(function(){ try{ const T=injTypeOf(p); return T?T.n+" ":""; }catch(e){ return ""; } })()}${injWeeksLeft(p)}주`)).join(", ")}${inj.length>4?` 외 ${inj.length-4}명`:""}`,
      stpBtn("🧑‍⚕️ 스쿼드", `show('squad')`)));
    /* 12+ — 복귀 예정일까지 */
    if(d>=1){
      const soon=inj.filter(p=>injWeeksLeft(p)<=2);
      if(soon.length) L.push(stpLine(`📅 곧 돌아옵니다 — ${soon.map(p=>stpP(p,`${injWeeksLeft(p)<=0?"이번 주":injWeeksLeft(p)+"주 뒤"}`)).join(", ")}`));
    }
    /* 14+ — 장기 이탈 별도 경고 */
    if(d>=2){
      const long=inj.filter(p=>injWeeksLeft(p)>=6);
      if(long.length) L.push(stpLine(`⚠️ 장기 이탈 — ${long.map(p=>stpP(p,`${injWeeksLeft(p)}주`)).join(", ")}. "그 자리를 시장에서 메우실지 판단하셔야 합니다."`,
        stpBtn("💸 이적시장", `tfTab='search';show('transfer')`)));
    }
  }
  /* 17+ — 아직 안 다친 선수 중 위험군을 먼저 짚는다 */
  if(d>=3){
    const risk=t.players.filter(p=>p.inj<=0 && !p.loan && (p.cond||90)<74 && (G.season-(p.by||2000))>=30)
      .sort((a,b)=>(a.cond||90)-(b.cond||90)).slice(0,3);
    if(risk.length) L.push(stpLine(`🔬 "지금 무리하면 다칩니다" — ${risk.map(p=>stpP(p,`${G.season-p.by}세 · 컨디션 ${mor(p.cond)}`)).join(", ")}`,
      stpBtn("📅 일정", `ftShow('cal')`)));
    const rep_=t.players.filter(p=>p.inj<=0 && !p.loan && (p.injW0||0)>=4 && (p.cond||90)<82).slice(0,2);
    if(rep_.length) L.push(stpLine(`🔁 재발 주의 — ${rep_.map(p=>stpP(p)).join(", ")}. "큰 부상에서 돌아온 지 얼마 안 됐습니다."`));
  }
  /* 🩺 소견서 — 부상자마다 처치를 고른다 (요청) */
  /* 💊 진통제로 뛰는 중인 선수는 inj=0 이라 부상자 목록에서 빠진다 — 따로 세워 둔다 */
  const onPain=t.players.filter(p=>painOn(p) && !p.loan);
  const painLine=onPain.length ? `<div class="msg warn" style="margin:6px 0">💊 <b>진통제 처방 중</b> —
      ${onPain.map(p=>`${stpP(p)} <span class="small">(진단 ${p.pain.w}주 · 재발 위험 ${Math.round(painBreakP(p)*100)}%)</span>`).join(", ")}
      <br><span class="small">다음 한 경기까지입니다. 그 경기를 뛰고 나면 재발하거나, 남은 회복을 그때 치릅니다.</span></div>` : "";
  const chart=(inj.length||onPain.length) ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #21262d">
      <div class="small" style="margin-bottom:5px;color:var(--gold)">🩺 소견서 — 처치를 정해 주십시오
        <span style="opacity:.7">(의무 ${c.med|0} · 재활 ${c.reh|0})</span></div>
      ${painLine}${inj.map(injChartRow).join("")}</div>` : "";
  const foot=(d<3?`<p class="small" style="opacity:.6;margin-top:4px">종합이 높을수록 복귀 예정·재발 위험·부상 직전 신호까지 미리 짚습니다.</p>`:"")+chart;
  return stpCard(c, L, foot);
}
/* 💪 체력 코치 — 피로·과부하·체중 */
function stpFit(t){
  const c=crewOf("fit")[0]; if(!c) return "";
  const d=stpDepth(c), L=[];
  const tired=t.players.filter(p=>p.inj<=0 && !p.loan && (p.cond||90)<70).sort((a,b)=>(a.cond||90)-(b.cond||90));
  if(!tired.length) L.push(stpLine(`💪 "선수단 체력은 문제없습니다."`));
  else L.push(stpLine(`😮‍💨 체력 저하 <b>${tired.length}명</b> — ${tired.slice(0,4).map(p=>stpP(p,`컨디션 ${mor(p.cond)}`)).join(", ")}${tired.length>4?` 외 ${tired.length-4}명`:""}`,
    stpBtn("🏋️ 훈련", `ftShow('train')`)));
  if(d>=1){
    /* 지금 잡혀 있는 훈련 강도가 스쿼드 상태에 비해 센가 */
    try{
      let hard=0; for(let i=0;i<7;i++){ const pl=dayPlan((G.day||0)+i); if(pl&&pl.t==="train"&&(pl.i|0)>=2) hard++; }
      const avg=t.players.filter(p=>!p.loan).reduce((s,p)=>s+(p.cond||90),0)/Math.max(1,t.players.filter(p=>!p.loan).length);
      if(hard>=3 && avg<82) L.push(stpLine(`⚠️ "앞으로 일주일에 강훈련이 <b>${hard}일</b>입니다. 평균 컨디션 ${Math.round(avg)}에 이 강도는 무리입니다."`,
        stpBtn("📅 일정", `ftShow('cal')`)));
      else if(hard===0 && avg>=90) L.push(stpLine(`🔋 "평균 컨디션 ${Math.round(avg)}입니다. 한 번쯤 강하게 굴려도 됩니다."`, stpBtn("📅 일정", `ftShow('cal')`)));
    }catch(e){}
  }
  if(d>=2){
    const mf=t.players.filter(p=>!p.loan && (p.mFat||0)>=0.6).sort((a,b)=>(b.mFat||0)-(a.mFat||0)).slice(0,3);
    if(mf.length) L.push(stpLine(`🦵 지난 경기 여파가 남았습니다 — ${mf.map(p=>stpP(p)).join(", ")}. "오늘은 빼 주시죠."`));
  }
  /* 체중 관리 — 예전 「컨디셔닝 코치 안건」 자리 */
  const cc=t.players.filter(p=>p.concern&&p.concern.k==="weight"&&!p.loan);
  const foot = cc.length ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #21262d">
      <div class="small" style="margin-bottom:5px;color:var(--gold)">⚖️ 체중 관리 안건 ${cc.length}건</div>
      ${cc.map(weightCard).join("")}</div>` : "";
  return stpCard(c, L, foot);
}
/* 🌱 유소년 코치 — 21세 이하 */
function stpYouth(t){
  const c=crewOf("youth")[0]; if(!c) return "";
  const d=stpDepth(c), L=[];
  const yng=t.players.filter(p=>!p.loan && (G.season-(p.by||2000))<=21);
  if(!yng.length) L.push(stpLine(`🌱 "21세 이하 자원이 없습니다. 아카데미나 시장에서 데려와야 합니다."`, stpBtn("🌱 유스", `show('youth')`)));
  else {
    const grow=yng.filter(p=>(p.pot||0)-(p.ovr||0)>=6).sort((a,b)=>((b.pot||0)-(b.ovr||0))-((a.pot||0)-(a.ovr||0)));
    L.push(stpLine(`🌱 21세 이하 <b>${yng.length}명</b>${grow.length?` · 성장 여지가 큰 자원 <b>${grow.length}명</b>`:""}`, stpBtn("🌱 유스", `show('youth')`)));
    if(d>=1 && grow.length) L.push(stpLine(`📈 "가장 크게 클 아이들입니다" — ${grow.slice(0,3).map(p=>`${stpP(p,`${G.season-p.by}세`)} → 잠재력 ${ovrStars(p.pot||p.ovr)}`).join(" · ")}`));
    if(d>=2){
      const stuck=yng.filter(p=>playShare(p)<0.25 && (p.pot||0)-(p.ovr||0)>=8).slice(0,3);
      if(stuck.length) L.push(stpLine(`⏳ "못 뛰어서 멈춰 있습니다" — ${stuck.map(p=>stpP(p)).join(", ")}. 출전 시간이나 임대를 봐 주셔야 합니다.`,
        stpBtn("🔁 임대", `lcTab='out';show('loancenter')`)));
    }
    if(d>=3){
      const ready=yng.filter(p=>(p.ovr||0)>=teamOVR(t)-4).slice(0,2);
      if(ready.length) L.push(stpLine(`⭐ "이제 1군에서 통합니다" — ${ready.map(p=>stpP(p,`${G.season-p.by}세`)).join(", ")}`, stpBtn("👥 스쿼드", `show('squad')`)));
    }
  }
  return stpCard(c, L, d<3?`<p class="small" style="opacity:.6;margin-top:4px">종합이 높을수록 정체한 자원과 승격 시점까지 짚습니다.</p>`:"");
}
/* 🧤 골키퍼 코치 */
function stpGk(t){
  const c=crewOf("gk")[0]; if(!c) return "";
  const d=stpDepth(c), L=[];
  const gks=t.players.filter(p=>p.pos==="GK" && !p.loan).sort((a,b)=>(b.ovr||0)-(a.ovr||0));
  if(!gks.length) return "";
  L.push(stpLine(`🧤 골키퍼 <b>${gks.length}명</b> — ${gks.map(p=>stpP(p,`${G.season-p.by}세${p.inj>0?` · 부상 ${injWeeksLeft(p)}주`:""}`)).join(", ")}`));
  if(gks.length<2) L.push(stpLine(`⚠️ "주전 하나가 다치면 대안이 없습니다. 한 명 더 두시는 게 좋겠습니다."`, stpBtn("💸 이적시장", `tfTab='search';show('transfer')`)));
  if(d>=1){
    const y=gks.filter(p=>(G.season-(p.by||2000))<=23 && (p.pot||0)-(p.ovr||0)>=5)[0];
    if(y) L.push(stpLine(`📈 "${stpP(y)} — 제가 맡아 키워 보겠습니다." <span style="opacity:.75">잠재력 ${ovrStars(y.pot||y.ovr)}</span>`));
  }
  if(d>=2 && gks[0]){
    const g0=gks[0], age=G.season-(g0.by||2000);
    if(age>=34) L.push(stpLine(`⏳ "${stpP(g0)}도 ${age}세입니다. 후계자를 슬슬 보셔야 합니다."`, stpBtn("💸 이적시장", `tfTab='search';show('transfer')`)));
  }
  return stpCard(c, L);
}
/* 📊 분석가 — 다음 상대와 우리 지표 */
function stpAna(t){
  const c=crewOf("anal")[0]; if(!c) return "";
  const d=stpDepth(c), L=[];
  let opp=null, tag="", home=null;
  try{
    const fix=t.div===1?G.k1Fix:G.k2Fix, r=t.div===1?G.r1:G.r2;
    if(r<fix.length) for(const [hid,aid] of fix[r]) if(hid===t.id||aid===t.id){
      opp=G.teams[hid===t.id?aid:hid]; tag=(t.div===1?"K리그1":"K리그2")+" "+(r+1)+"R"; home=(hid===t.id); }
    const ex=eaclNextForUser(); if(ex && ex.opp && !opp){ opp=ex.opp; tag=ex.label; home=ex.home; }
  }catch(e){}
  if(opp) L.push(stpLine(`🔎 다음 상대 <b>${opp.short||opp.name}</b> <span style="opacity:.75">${tag}${home===null?"":(home?" · 홈":" · 원정")}</span> — <b style="color:var(--gold)">${styleName(opp)}</b>`,
    stpBtn("📋 전술", `show('tactics')`)));
  else L.push(stpLine(`🔎 "다음 상대가 아직 정해지지 않았습니다."`));
  if(d>=1){
    const my=Math.round(teamOVR(t)), ov=opp?Math.round(teamOVR(opp)):null;
    if(ov!=null) L.push(stpLine(`📊 전력 비교 — 우리 ${teamStars(t,"우리 팀")} vs ${opp.short||opp.name} ${teamStars(opp,opp.short||opp.name)}
      <span style="opacity:.75">(${ov>my+2?"저쪽이 위":ov<my-2?"우리가 위":"비슷"})</span>`));
  }
  if(d>=2){
    const f=(t.form||[]).slice(-5);
    if(f.length) L.push(stpLine(`📈 우리 최근 5경기 ${f.map(x=>x==="W"?"🟢":x==="D"?"🟡":"🔴").join("")} · 득실 ${t.GF|0}:${t.GA|0}`,
      stpBtn("📊 기록", `show('stats')`)));
  }
  if(d>=3 && opp){
    try{
      const key=(opp.players||[]).filter(x=>x&&!x.loan&&x.inj<=0&&x.pos!=="GK")
        .sort((a,b)=>((b.goals||0)*2+(b.assists||0))-((a.goals||0)*2+(a.assists||0))||(b.ovr||0)-(a.ovr||0))[0];
      if(key) L.push(stpLine(`🎯 "저쪽 핵심은 ${stpP(key,`${prefSlotOf(key)} · ${key.goals||0}골 ${key.assists||0}도움`)}입니다. 그 자리를 누가 볼지 정하셔야 합니다."`));
    }catch(e){}
  }
  return stpCard(c, L, d<3?`<p class="small" style="opacity:.6;margin-top:4px">종합이 높을수록 전력 비교·팀 흐름·상대 핵심까지 올라옵니다.</p>`:"");
}
/* ♟️ 훈련 담당 코치 — 자기 부문에서 눈에 띄는 선수 */
function stpCoach(t){
  const list=crew().filter(c=>c.role==="coach");
  if(!list.length) return "";
  const KEYMAP={atk:["fin","cro","pas"], def:["tkl","mrk","pos"], tac:["dec","vis","tea"], set:["cro","fin","lng"], pos:["pos","dec"], bal:["dec","sta"], phy:["sta","str","pac"]};
  let out="";
  for(const c of list){
    const d=stpDepth(c), L=[];
    const s=c.assign?AC_SLOT_BY[c.assign]:null;
    if(!s){
      L.push(stpLine(`🪑 "저는 아직 맡은 훈련이 없습니다. 어디를 볼지 정해 주십시오."`, stpBtn("🏋️ 훈련 배정", `ftShow('train')`)));
      out+=stpCard(c, L); continue;
    }
    let days=0; try{ for(let i=0;i<14;i++){ const pl=dayPlan((G.day||0)+i); if(pl&&pl.t==="train"&&(pl.f||"bal")===s.k) days++; } }catch(e){}
    L.push(stpLine(`${s.ic} 담당 <b>${s.n}</b> — 앞으로 2주 중 <b>${days}일</b>${days?"":' <span style="color:var(--red)">(한 번도 안 합니다)</span>'}`,
      stpBtn("📅 일정", `ftShow('cal')`)));
    if(!days) L.push(stpLine(`🤔 "제 훈련이 일정에 없으면 저는 아무것도 못 합니다."`));
    if(d>=1){
      /* 담당 갈래에서 가장 약한 주전 — 개인 과제를 붙일 후보 */
      try{
        const ks=KEYMAP[s.k]||["dec"];
        const xi=bestXI(t).filter(p=>p.pos!=="GK");
        const score=(p)=>ks.reduce((a,k)=>a+((p.attr&&p.attr[k]!=null)?attr20(p.attr[k]):10),0)/ks.length;
        const weak=xi.slice().sort((a,b)=>score(a)-score(b))[0];
        if(weak) L.push(stpLine(`🔧 "주전 중 이 갈래가 가장 약한 건 <b>${weak.name}</b>입니다." ${stpStars20(score(weak), s.n)}`,
          stpBtn("🎯 개인 훈련", `ftShow('train')`)));
      }catch(e){}
    }
    if(d>=2){
      try{
        const xi=bestXI(t).filter(p=>p.pos!=="GK");
        const ks=KEYMAP[s.k]||["dec"];
        const score=(p)=>ks.reduce((a,k)=>a+((p.attr&&p.attr[k]!=null)?attr20(p.attr[k]):10),0)/ks.length;
        const best=xi.slice().sort((a,b)=>score(b)-score(a))[0];
        if(best) L.push(stpLine(`⭐ "이 갈래는 <b>${best.name}</b> 쪽이 제일 낫습니다. 그 쪽으로 풀어도 됩니다." ${stpStars20(score(best), s.n)}`));
      }catch(e){}
    }
    out+=stpCard(c, L);
  }
  return out;
}
/* 🔍 ⚠ 제보 원문 — 「오늘 비어있던 자리에서 스태프 영입하러가기 있잖아. 그거 누르면
   이적시장에서 스태프 탭으로 이동하잖아. 근데 스태프 탭의 중간에서 뜨거든?
   스크롤바를 위로 올려서 상단 검색창이 있는 위치로 나오게 해줄래?」
   ─ show() 는 #main 의 내용만 갈아 끼우고 스크롤 위치는 건드리지 않는다. 스태프 회의 화면
     중간쯤에서 눌렀으니 새 화면도 그 높이에서 열렸다. 옮긴 뒤 맨 위로 올린다.
     한 번으로는 부족한 기기가 있어(레이아웃이 잡히기 전에 올려 버린다) 다음 프레임에 한 번 더 올린다. */
function acGoHire(){
  try{ tfTab="staff"; }catch(e){}
  show("transfer");
  const top=()=>{ try{ window.scrollTo(0,0); }catch(e){}
                  try{ document.documentElement.scrollTop=0; document.body.scrollTop=0; }catch(e){} };
  top();
  try{ requestAnimationFrame(top); }catch(e){ setTimeout(top, 0); }
}
/* 빈 자리 모음 — 오늘 보고가 없었던 이유 */
function stpVacant(){
  const miss=AC_ROLE_ORDER.filter(k=>k!=="ac" && !crewOf(k).length);
  if(!miss.length) return "";
  return `<div class="card stCard" style="border-color:#3a2a2a">
    <h3>🪑 오늘 비어 있던 자리 <span class="small">— ${miss.length}개</span></h3>
    <p class="small" style="opacity:.9">${miss.map(k=>`${AC_ROLE[k].ic} <b>${AC_ROLE[k].n}</b>`).join(" · ")} 자리가 비어 있어 그 분야 보고가 올라오지 않았습니다.</p>
    <div class="stBtns" style="margin-top:6px"><button class="mini" onclick="acGoHire()">🎩 스태프 영입하러 가기</button></div>
  </div>`;
}
/* ── 화면 ─────────────────────────────────────────────────── */
function staffView(){
  const t=userTeam(); const st=staffOpt();
  const agenda=staffAgenda();
  const del=st.delegatePre;
  const preLeft=(G.friendlies||[]).filter(f=>!f.done).length;
  const injured=t.players.filter(p=>p.inj>0);
  const tired=t.players.filter(p=>p.cond<70 && p.inj<=0).sort((a,b)=>a.cond-b.cond).slice(0,3);
  const rising=t.players.filter(p=>p.trend && Object.values(p.trend).filter(x=>x>0).length>=6)
    .sort((a,b)=>(G.season-b.by)-(G.season-a.by)).slice(0,2);
  const falling=t.players.filter(p=>p.trend && Object.values(p.trend).filter(x=>x<0).length>=6).slice(0,2);
  const card=(p)=>{
    const g=GRIEVE[grieveKey(p)];
    return `<div class="stItem">
      <div class="stHead">${g.ic} <b class="pos-${p.pos}">${p.name}</b>
        <span class="small">${G.season-p.by}세 · ${PERS_N[p.pers||0]} · ${isConfused(p)?"혼란":"불만"} ${p.unhappy}/3</span></div>
      <div class="stSay">📋 ${acName()}: ${g.say(p)}</div>
      <div class="stBtns">
        <button class="mini" onclick="staffTalk(${p.id})">💬 ${p.name} 선수를 부른다</button>
        ${delegateBtn(p)}
        <button class="mini" onclick="staffIgnore(${p.id})">🙉 무시한다</button>
      </div>${delegateHint(p)}</div>`;
  };
  const dBox=st.delegBox; st.delegBox=null;
  return `<h2>📋 스태프 회의</h2>
  ${dBox||""}
  ${acCrewCard()}
  <div class="card stCard">
    <h3>📋 ${acTitle()} 보고 <span class="small">— 오늘의 안건 ${agenda.length}건</span></h3>
    ${agenda.length ? agenda.map(card).join("")
      : `<p class="small">📋 "특별히 보고드릴 건 없습니다. 선수단 분위기는 나쁘지 않습니다."</p>`}
    ${acEarlyWarn(t)}
  </div>
  ${(function(){ try{ return stpDoc(t)+stpFit(t)+stpGk(t)+stpYouth(t)+stpAna(t)+stpCoach(t); }catch(e){ return ""; } })()}
  ${(function(){ try{ return stpVacant(); }catch(e){ return ""; } })()}
  ${(function(){
    /* 💪 체력 코치가 없으면 체중 안건이 통째로 사라진다 — 그건 손해다.
       담당자가 없을 때만 감독이 직접 보는 자리로 남겨 둔다. */
    try{
      if(crewOf("fit").length) return "";
      const cc=t.players.filter(p=>p.concern&&p.concern.k==="weight"&&!p.loan);
      if(!cc.length) return "";
      return `<div class="card stCard">
        <h3>⚖️ 체중 관리 <span class="small">— ${cc.length}건 · 💪 체력 코치가 없어 감독이 직접 봅니다</span></h3>
        ${cc.map(weightCard).join("")}</div>`;
    }catch(e){ return ""; }
  })()}
  ${seasonGoalCard(t)}
  ${captainCard(t)}
  ${retiredCard(t)}
  <div class="card stCard">
    <h3>🎮 경기 운영</h3>
    <p class="small"><b>연습경기뿐 아니라 리그·승강 PO·${(function(){ try{ return eaclShort(); }catch(e){ return "EACL"; } })()}·${(function(){ try{ return cwcShort(); }catch(e){ return "CWC"; } })()}까지 모든 경기</b>를
      ${acTitle()}에게 맡길 수 있습니다. 맡기면 전술 화면·라커룸 토크·하프타임을 거치지 않고
      <b>진행 버튼 한 번에 결과만 보고</b>됩니다 — 시즌을 빠르게 넘길 때 쓰세요.
      대신 라커룸 토크로 얻는 사기 변화가 없고, 조직력이 붙는 폭도 줄어듭니다.</p>
    <p class="small" style="opacity:.85">🎩 <b>벤치는 ${acTitle()}가 굴립니다</b> — 교체 시점과 사람 선택의 질이
      <b>경기판단·선수관리·전술</b>에 달렸고, <b>유연성</b>이 높으면 경기 중 성향까지 손봅니다.
      ${(function(){ try{ const c=acOf(); if(!c) return `<span style="color:var(--red)">지금은 수석코치가 공석이라 위임해도 교체가 한 명도 나오지 않습니다.</span>`;
        const lv=acBenchLv(); const [gn,gc]=acGrade(acOvr(c));
        return `현재 <b>${c.n}</b> <span style="color:${gc}">${gn}</span> — 벤치 판단력 <b>${Math.round(lv*10)/10}</b>/20
          <span style="opacity:.75">(첫 교체 ${acFirstWin(lv)}분 · 최선의 선택 ${Math.round(acRightP(lv)*100)}%)</span>`;
      }catch(e){ return ""; } })()}</p>
    <div class="stToggle">
      <button class="mini ${del?"":"on"}" onclick="setDelegatePre(false)">🎯 직접 지휘한다</button>
      <button class="mini ${del?"on":""}" onclick="setDelegatePre(true)">🤝 ${acName()}에게 맡긴다</button>
    </div>
    <p class="small" style="margin-top:6px">현재: <b style="color:${del?"var(--gold)":"#fff"};font-weight:800">${del?`${acName()} 위임 — 모든 경기`:"감독 직접 지휘"}</b>
      ${preLeft?` · 남은 연습경기 <b style="color:#fff;font-weight:800">${preLeft}경기</b>`:""}</p>
    ${(function(){ try{ return mgrInjured()
      ? `<p class="small" style="margin-top:4px;color:var(--gold)">🚑 감독이 부상 중입니다${(G.mgrInj&&G.mgrInj.t)?` — ${G.mgrInj.ic||"🚑"} <b>${G.mgrInj.t}</b> · 잔여 ${mgrInjLeft()}주`:""} — 이 설정과 무관하게 회복까지는 ${acTitle()}가 지휘합니다.</p>` : ""; }catch(e){ return ""; } })()}
  </div>
  ${(function(){
    /* 📈 능력치 추세 — 특정 직책의 몫이 아니라 한 달에 한 번 찍는 구단 공통 측정치다.
       담당자를 붙이지 않고 그대로 둔다. */
    if(!rising.length && !falling.length) return "";
    return `<div class="card stCard">
      <h3>📈 능력치 추세 <span class="small">— 한 달에 한 번 측정</span></h3>
      ${rising.length?`<p class="small">🔼 성장 중 — ${rising.map(p=>`<b>${p.name}</b>(${G.season-p.by}세)`).join(", ")}</p>`:""}
      ${falling.length?`<p class="small">🔽 하락 중 — ${falling.map(p=>`<b>${p.name}</b>(${G.season-p.by}세)`).join(", ")}</p>`:""}
    </div>`;
  })()}
  ${st.log.length?`<div class="card stCard"><h3>🗒️ 회의록</h3>
    ${st.log.map(l=>`<div class="small" style="padding:3px 0;border-bottom:1px solid #21262d">${feedDate(l)} · ${l.txt}</div>`).join("")}</div>`:""}`;
}
function captainCard(t){
  const c=capInfo(t), cap=captainOf(t), vice=viceOf(t);
  const cands=capCandidates(t).slice(0,8);
  const pill=(p,role)=>{
    const on=(role==="c"?c.c:c.v)===p.id;
    const ap=capApproval(t,p);
    const col=ap>=0.75?"var(--green)":ap>=0.45?"var(--gold)":"var(--red)";
    return `<button class="mini ${on?'sel':''}" style="display:block;width:100%;text-align:left;margin-bottom:5px;padding:8px"
      onclick="setCaptain(${p.id},'${role}')">${on?"✅ ":""}<b>${p.name}</b>
      <span class="small">${G.season-p.by}세 · 리더십 ${attr20(p.attr.ldr)} · 팀워크 ${attr20(p.attr.tea)} ·
      ${abilityStars(p).replace(/ title="[^"]*"/,"")} · 수용도 <b style="color:${col}">${Math.round(ap*100)}%</b></span></button>`;
  };
  return `<div class="card stCard">
    <h3>🎖️ ${G.season} 시즌 주장단 ${c.set?'<span class="tag" style="background:#3fb95033;color:#3fb950">확정</span>':'<span class="tag inj">미정</span>'}</h3>
    ${c.set?`<p>주장 <b>${cap?cap.name:"-"}</b>${vice?` · 부주장 <b>${vice.name}</b>`:""}
      <button class="mini" style="margin-left:8px" onclick="userTeam().cap.set=false;show('staff')">완장 다시 정하기</button></p>
      ${c.react||""}`
    :`<p class="small">완장은 능력만으로 정해지지 않습니다. <b>리더십·팀워크</b>가 자격이고, <b>실력</b>이 있어야 라커룸에서 말이 먹히며,
       <b>나이와 경력</b>이 받쳐 줘야 선배들이 따릅니다. 납득이 안 되는 선택에는 선수단이 반발합니다.</p>
     ${(()=>{
       /* 접이식 선택 — 버튼을 누르면 후보 목록이 펼쳐진다 (칸 절약, 사용자 요청) */
       const selBtn=(role)=>{
         const id=(role==="c"?c.c:c.v);
         const p=id?t.players.find(x=>x.id===id):null;
         const lab=p?`✅ <b>${p.name}</b> <span class="small">리더십 ${attr20(p.attr.ldr)} · 수용도 ${Math.round(capApproval(t,p)*100)}%</span>`
                   :`<span class="small">선택하세요…</span>`;
         return `<button class="mini" style="width:100%;text-align:left;padding:9px" onclick="capListToggle('${role}')">${role==="c"?"🅒":"🅥"} ${lab} ▾</button>
           <div id="capList_${role}" class="hidden" style="max-height:270px;overflow:auto;border:1px solid var(--line);border-radius:8px;margin-top:4px;padding:5px;background:#0f141b">
             ${cands.map(p2=>pill(p2,role)).join("")}
           </div>`;
       };
       return `<div class="row" style="gap:10px">
         <div style="flex:1;min-width:220px">${selBtn("c")}</div>
         <div style="flex:1;min-width:220px">${selBtn("v")}</div>
       </div>`;
     })()}
     <button class="mini" style="margin-top:8px;padding:8px 22px;background:#58c7f0;color:#04222e;font-weight:800" onclick="confirmCaptains()">확정</button>`}
  </div>`;
}
function capListToggle(role){
  const me=document.getElementById("capList_"+role);
  const other=document.getElementById("capList_"+(role==="c"?"v":"c"));
  if(other) other.classList.add("hidden");
  if(me) me.classList.toggle("hidden");
}
function retireFromSelect(){
  const el=document.getElementById("retSel");
  const pid=el?parseInt(el.value,10):NaN;
  if(!pid){ flash("먼저 선수를 선택하세요.","warn"); return; }
  retireNumber(pid);
}
function retiredCard(t){
  const list=retiredList(t);
  return `<div class="card stCard">
    <h3>🎽 영구결번 <span class="small">— 지정된 번호는 누구도 달 수 없습니다</span></h3>
    ${list.length?`<div class="tblScroll"><table><tr><th>번호</th><th>대상</th><th>사유</th><th></th></tr>
      ${[...list].sort((a,b)=>a.n-b.n).map(r=>`<tr><td><b style="color:#d2a8ff;font-size:16px">${r.n}</b></td>
        <td><b>${r.who}</b></td><td class="small">${r.why||""}</td>
        <td>${r.def?'<span class="small">구단 전통</span>':`<button class="mini" onclick="unretireNumber(${r.n})">해제</button>`}</td></tr>`).join("")}
      </table></div>`:`<p class="small">아직 영구결번이 없습니다.</p>`}
    <h3 style="margin-top:12px;font-size:13px">새로 지정하기</h3>
    <p class="small" style="margin-bottom:6px">선수를 고르면 그 선수가 달고 있는 번호가 영구결번이 됩니다.</p>
    <select id="retSel" style="min-width:260px">
      <option value="">— 선수를 선택하세요 —</option>
      ${[...t.players].filter(p=>p.no && !isRetiredNo(t,p.no))
        .sort((a,b)=>(a.no||99)-(b.no||99))
        /* ⚠ 요청 — 「스태프 회의에서 영구결번 설정할 때 출장 경기수 나오잖아. 그거 없애」 */
        .map(p=>`<option value="${p.id}">${String(p.no).padStart(2," ")}번 · ${p.name} (${p.pos} ${G.season-p.by}세)</option>`).join("")}
    </select>
    <button class="mini" style="margin-left:6px" onclick="retireFromSelect()">🎽 영구결번 지정</button>
  </div>`;
}
function setDelegatePre(v){
  const st=staffOpt(); st.delegatePre=!!v;
  st.delSet=1;                     // 감독이 직접 정한 값이다 — 부상 대행이 덮어쓰지 않는다 (요청)
  staffLog(v?`모든 경기 운영을 ${acTitle()}에게 위임했습니다.`:"모든 경기를 감독이 직접 지휘합니다.");
  saveGame(); show("staff");
}
/* ── 주장단에게 맡기기 ────────────────────────────────────────────
   FM의 "주장에게 대화를 맡긴다". 감독이 직접 나서면 결과가 크지만 관계가 걸리고,
   주장에게 맡기면 감독은 손을 안 대는 대신 성패가 주장의 그릇에 달린다.
   성공률을 가르는 것들:
     · 주장의 리더십·팀워크 — 말이 먹히는가
     · 주장과 그 선수의 나이 차 — 선배 말은 다르게 들린다
     · 불만의 종류 — 출전 시간은 감독 소관이라 주장이 풀기 어렵다
     · 불만 단계 — 이미 곪았으면 말로 안 된다
     · 주장 본인의 사기·불만 — 자기가 흔들리면서 남을 다잡을 수는 없다
   실패하면 불만이 한 단계 더 자라고, 주장의 사기도 함께 깎인다. */
const DELEG_HARD={
  playtime:-0.18,   // 출전 시간 — 결정권이 감독에게 있다
  wage:-0.16,       // 연봉 — 라커룸에서 풀 문제가 아니다
  listed:-0.12,     // 이적명단 등록
  role:-0.04,       // 역할·포지션
  rumor:+0.08,      // 이적 루머 — 선배가 다독이기 좋다
  form:+0.10,       // 팀 성적 부진
  star:+0.06        // 핵심 선수 이탈
};
function delegateTargets(t){
  const out=[]; const c=capInfo(t);
  const cap=captainOf(t), vice=viceOf(t);
  if(cap) out.push({p:cap, r:"주장"});
  if(vice) out.push({p:vice, r:"부주장"});
  return out;
}
function delegateChance(t, leader, p){
  const a=leader.attr||{};
  const key=grieveKey(p);
  let c = 0.22
    + (attr20(a.ldr||60)-10)*0.040
    + (attr20(a.tea||60)-10)*0.028
    + (attr20(a.cmp||60)-10)*0.012;
  c += (DELEG_HARD[key]||0);
  c -= (p.unhappy-1)*0.14;                                   // 이미 곪은 불만은 말로 안 풀린다
  const gap=(G.season-p.by)-(G.season-leader.by);            // 리더가 몇 살 위인가
  c += clamp(gap*0.022, -0.06, 0.14);
  c += ((leader.morale||70)-70)*0.005;
  if(leader.unhappy>0) c-=0.15;                              // 자기가 불만인 사람에게 맡길 수는 없다
  if(leader.pos===p.pos) c+=0.05;                            // 같은 자리 경쟁자끼리는 오히려 말이 통한다
  if((p.pers||0)===3) c-=0.10;                               // 다혈질
  if((p.pers||0)===2) c+=0.08;                               // 온화
  if(playerLevel(leader)<playerLevel(p)-4) c-=0.12;          // 나보다 못하는 선배 말은 안 듣는다
  return clamp(c, 0.05, 0.92);
}
function delegateBtn(p){
  const t=userTeam(); const tg=delegateTargets(t).filter(x=>x.p.id!==p.id);
  if(!tg.length) return "";
  return tg.map(({p:L,r})=>{
    const ch=delegateChance(t, L, p);
    const col=ch>=0.65?"var(--green)":ch>=0.4?"var(--gold)":"var(--red)";
    return `<button class="mini" onclick="delegateGrievance(${p.id},${L.id})">🎖️ ${r} <b>${L.name}</b>에게 맡긴다
      <span class="small" style="color:${col}">${Math.round(ch*100)}%</span></button>`;
  }).join("");
}
function delegateHint(p){
  const key=grieveKey(p);
  if(key==="playtime") return `<div class="small" style="margin-top:4px;color:var(--sub)">— 출전 시간 문제는 주장이 풀기 어렵습니다. 결정권이 감독에게 있으니까요.</div>`;
  if(key==="wage") return `<div class="small" style="margin-top:4px;color:var(--sub)">— 연봉 얘기는 라커룸에서 풀 수 있는 게 아닙니다.</div>`;
  return "";
}
function delegateGrievance(pid, lid){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid), L=t.players.find(x=>x.id===lid);
  if(!p||!L) return;
  const st=staffOpt();
  const ch=delegateChance(t, L, p);
  st.handled[p.id]={d:(G.day||0), s:G.season};   // ⚠ 제보(스태프회의 안 뜸) — 날짜를 남겨 7일 뒤 재보고
  const role = (capInfo(t).c===L.id) ? "주장" : "부주장";
  let box;
  if(Math.random()<ch){
    const heal = p.unhappy>=3 ? 2 : 1;
    p.unhappy=Math.max(0, p.unhappy-heal);
    p.morale=clamp(p.morale+5,25,99);
    L.morale=clamp(L.morale+2,25,99);
    affAdd(L, 3, "주장 역할 수행");
    if(p.unhappy===0) affAdd(p, 2, "선배가 풀어 줌");
    box=`<div class="msg good" style="border-width:2px">🎖️ <b>${L.name}</b>(${role})이/가 ${p.name}을/를 따로 불렀습니다.<br>
      ${pick([
        `${p.name}: "형이 그렇게까지 말하는데... 알겠습니다."`,
        `${p.name}: "감독님한테 직접 말 못 하던 걸 형이 들어줬습니다."`,
        `${L.name}: "제가 정리했습니다. 감독님은 신경 안 쓰셔도 됩니다."`,
        `${p.name}: "괜히 저 혼자 예민했던 것 같습니다."`])}
      <span class="small"> — 불만 ${heal}단계 해소${p.unhappy?` (남은 단계 ${p.unhappy})`:" (완전 해소)"}</span></div>`;
    staffLog(`${L.name}(${role})에게 ${p.name}의 불만 처리를 맡겨 풀었습니다.`);
  } else {
    p.unhappy=Math.min(3, p.unhappy+1);
    p.morale=clamp(p.morale-3,25,99);
    L.morale=clamp(L.morale-3,25,99);
    affAdd(L, -3, "중재 실패");
    affAdd(p, -2, "감독이 직접 오지 않음");
    box=`<div class="msg warn" style="border-width:2px">💢 <b>${L.name}</b>(${role})이/가 나섰지만 통하지 않았습니다.<br>
      ${pick([
        `${p.name}: "형한테 할 얘기가 아니라 감독님한테 할 얘기입니다."`,
        `${p.name}: "왜 감독님이 직접 안 오시죠?"`,
        `${L.name}: "...제 선에서는 안 되겠습니다, 감독님."`,
        `${p.name}: "중간에서 전달만 하실 거면 됐습니다."`])}
      <span class="small"> — 불만 한 단계 악화 · ${L.name} 사기도 함께 떨어졌습니다</span></div>`;
    staffLog(`${L.name}(${role})의 중재가 실패해 ${p.name}의 불만이 커졌습니다.`);
  }
  st.delegBox=box;
  saveGame(); show("staff");
}
function staffIgnore(pid){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p) return;
  const st=staffOpt();
  st.handled[p.id]={d:(G.day||0), s:G.season};   // ⚠ 제보(스태프회의 안 뜸) — 날짜를 남겨 7일 뒤 재보고
  // 무시는 공짜가 아니다 — 사기가 깎이고, 불만이 한 단계 더 자랄 확률이 붙는다
  p.morale=Math.round(clamp(p.morale-3,25,99)*100)/100;
  affAdd(p, -4.5, "면담 거절");        // 불러 주지도 않았다는 건 오래 기억된다
  const grew = Math.random() < (0.35 + (p.pers===1?0.2:p.pers===3?0.15:0));
  if(grew){ p.unhappy=Math.min(3,p.unhappy+1); }
  staffLog(`${p.name}의 ${p.uWhy} 불만을 넘겼습니다.${grew?" (불만이 커졌습니다)":""}`);
  notify(`🙉 ${p.name}의 불만을 넘겼습니다.${grew?` 표정이 더 굳었습니다. (불만 ${p.unhappy}/3)`:""}`, grew?"warn":"info");
  saveGame(); show("staff");
}
let STALK=null;
function staffTalk(pid){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p) return;
  STALK={pid, key:grieveKey(p)};
  renderStaffTalk();
}
function renderStaffTalk(){
  const t=userTeam(); const p=t.players.find(x=>x.id===STALK.pid); if(!p){ STALK=null; return show("staff"); }
  const g=GRIEVE[STALK.key];
  const btns=g.talk.map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px"
     onclick="staffTalkPick(${i})">${o.t}</button>`).join("");
  $("#main").innerHTML=`<h2>💬 ${p.name} 선수 면담</h2>
  <div class="card stCard">
    <p><b class="pos-${p.pos}">${p.name}</b> <span class="small">${G.season-p.by}세 · ${PERS_N[p.pers||0]} · ${abilityStars(p)}</span></p>
    <p class="small">${isConfused(p)?"혼란":"불만"} 사유: <b style="color:#fff;font-weight:800">${g.ic} ${g.n}</b> (${p.unhappy}/3) · 현재 사기 ${mor(p.morale)}</p>
    <div class="stSay">📋 ${acName()}: ${g.say(p)}</div>
  </div>
  <div class="card"><h3>어떻게 말하시겠습니까?</h3>${btns}
    <button class="mini" style="display:block;width:100%;padding:9px;margin-top:4px" onclick="STALK=null;show('staff')">← 회의로 돌아간다</button>
  </div>`;
  window.scrollTo(0,0);
}
function staffTalkPick(i){
  const t=userTeam(); const p=t.players.find(x=>x.id===STALK.pid); if(!p) return;
  const g=GRIEVE[STALK.key], o=g.talk[i]; if(!o) return;
  const st=staffOpt();
  // 성격에 따라 같은 말도 다르게 받아들인다
  const pers=p.pers||0;
  let m=o.m;
  if(o.k==="blunt"||o.k==="warn"){ if(pers===2) m-=2; if(pers===3) m-=2; if(pers===0) m+=2; }
  if(o.k==="lift"){ if(pers===1) m+=2; if(pers===2) m-=1; }
  if(o.k==="calm"){ if(pers===0) m+=1; if(pers===1) m-=1; }
  m=Math.round(m);
  p.morale=Math.round(clamp(p.morale+m,25,99)*100)/100;
  affAdd(p, m*0.8, "면담");            // 면담은 호감도에 가장 직접적으로 남는다
  let extra="";
  if(o.k==="promise"){
    p.promise={apps0:p.apps, need:3, rounds:5}; p.unhappy=0;
    extra="출전 약속을 했습니다 — 5라운드 안에 3경기를 뛰게 해야 합니다.";
  } else if(o.k==="promiseWage"){
    p.unhappy=0; p.pledgeWage=true;
    extra="재계약 때 연봉을 올려주기로 했습니다.";
  } else if(o.k==="promiseSign"){
    p.unhappy=0; p.pledgeSign=(G.day||0)+42;
    extra="6주 안에 보강을 하겠다고 약속했습니다.";
  } else if(o.k==="promiseRole"){
    p.unhappy=0; p.pledgeRole=true;
    extra="선호 포지션으로 돌려주기로 했습니다.";
  } else if(o.k==="payFirst"||o.k==="calmArrears"){
    /* 💸 임금 체불 — 면담으로는 지워지지 않는다. 급여가 실제로 지급(waClear)돼야 풀린다. */
    p.unhappy=Math.max(1, (p.unhappy||1)-1);
    extra=o.k==="payFirst"
      ? "약속은 했습니다 — 하지만 밀린 급여가 실제로 지급되기 전까지는 불만이 남습니다."
      : "이해는 얻었습니다 — 급여가 지급돼야 완전히 풀립니다.";
  } else if(o.k==="unlist"){
    p.unhappy=0; p.sulk=0; p.noMove=false;
    G.transferBids=(G.transferBids||[]).filter(b=>b.pid!==p.id);
    G.offers=(G.offers||[]).filter(x=>x.pid!==p.id);
    affAdd(p, +8, "이적명단 철회");
    extra="이적명단에서 뺐습니다.";
  } else if(o.k==="pledgeStay"){
    p.unhappy=0; p.noMove=true; p.pledgeStay=(G.day||0)+56; clearAllowOut(p);
    affAdd(p, +6, "공개 잔류 선언");
    adjustTrust("fans", 2, `${p.name} 잔류 선언`);
    addNews(`🎤 감독이 ${p.name}의 잔류를 공개적으로 선언했습니다.`);
    extra="기자회견에서 잔류를 선언하기로 했습니다. (8주간 이적 거부)";
  } else if(o.k==="allow"){
    p.unhappy=0; p.noMove=false;
    allowOut(p, "스태프 회의 — 이적 허용");
    if(!G.transferBids.some(b=>b.pid===p.id)) listForSale(p.id, true);
    extra="이적명단에 올렸습니다. 개인 협상에서도 웬만하면 응할 겁니다.";
  } else if(o.k==="lift"||o.k==="lead"){
    p.unhappy=Math.max(0,p.unhappy-1);
    if(p.unhappy===0) extra="불만이 풀렸습니다.";
    if(o.k==="lead") t.morale=Math.round(clamp(t.morale+1.5,40,99)*100)/100;
  } else if(m<0){
    p.unhappy=Math.min(3,p.unhappy+ (Math.random()<0.45?1:0));
  } else {
    p.unhappy=Math.max(0,p.unhappy-1);
  }
  if(p.unhappy===0){ p.uWhy=""; }
  st.handled[p.id]={d:(G.day||0), s:G.season};   // ⚠ 제보(스태프회의 안 뜸) — 날짜를 남겨 7일 뒤 재보고
  staffLog(`${p.name} 면담 — ${o.t}`);
  const col = m>=4?"good" : m>=0?"info":"warn";
  $("#main").innerHTML=`<h2>💬 ${p.name} 선수 면담</h2>
  <div class="card stCard">
    <p>🗣️ 감독: "${o.t}"</p>
    <p style="color:var(--acc)">💬 ${p.name}: ${o.say(p)}</p>
    <div class="msg ${col}">사기 ${m>0?"+":""}${m} · 불만 ${p.unhappy}/3${extra?` · ${extra}`:""}</div>
  </div>
  <div class="card"><button class="mini" style="width:100%;padding:11px" onclick="STALK=null;show('staff')">회의로 돌아간다 ▶</button></div>`;
  saveGame(); window.scrollTo(0,0);
}
/* ---------- 선수단 첫 인사 (부임 첫날) ----------
   1단계: 감독의 첫 마디  → 성향별로 호오가 갈린다(첫인상을 망칠 수도 있다)
   2단계: 시즌 목표 공언  → 구단 규모·스쿼드 수준에 비해 너무 높거나 너무 낮으면 선수들이 반응한다
   두 단계 모두 선수 개개인의 성향(프로페셔널·야심가·온화함·다혈질)에 따라 사기 증감이 달라진다. */
const GREET_LINES=[
 [`"잘 부탁드립니다, 감독님. 결과로 보여드리겠습니다."`,`"필요하신 게 있으면 언제든 말씀해 주세요. 준비는 늘 되어 있습니다."`,`"첫인상이 중요하다고들 하죠. 훈련장에서 뵙겠습니다."`,
  `"어떤 축구를 하실지 궁금합니다. 맞출 준비는 되어 있습니다."`,`"저는 시키는 대로 합니다. 대신 확실하게 해주십시오."`],
 [`"드디어 새 감독님이시군요. 제 가치를 증명할 기회로 삼겠습니다."`,`"기대하셔도 좋습니다. 저는 더 큰 무대를 노리고 있으니까요."`,`"주전 자리는 제 겁니다. 미리 말씀드리는 겁니다."`,
  `"공정하게만 봐주십시오. 그럼 제가 알아서 증명하겠습니다."`,`"이 팀에서 제 커리어가 끝나면 안 됩니다. 도와주십시오."`],
 [`"긴장되네요... 잘 부탁드립니다, 감독님!"`,`"환영합니다! 팀 분위기는 걱정 마세요, 제가 잘 챙기겠습니다."`,`"좋은 감독님이셨으면 좋겠어요. 잘 부탁드려요!"`,
  `"선수들 다 착합니다. 금방 정 붙이실 거예요."`,`"편하게 대해주셔서 감사합니다. 열심히 하겠습니다!"`],
 [`"오, 드디어 오셨네요! 한번 화끈하게 해봅시다!"`,`"말씀만 하십시오. 몸이 근질거립니다!"`,`"빡세게 굴려주세요! 그게 더 편합니다!"`,
  `"지난 시즌은 잊읍시다. 올해는 다릅니다, 제가 보장합니다!"`,`"누가 우리를 무시하는지 그라운드에서 보여주죠!"`]];
/* 감독의 첫 마디 — d는 성향별 사기 증감 [프로페셔널, 야심가, 온화함, 다혈질] */
const GREET_OPTS=[
 {ic:"🤝", t:`"모두 잘 부탁합니다. 함께 좋은 시즌을 만들어봅시다."`, d:[3,1,4,2],
  sum:"무난하고 정중한 첫인사"},
 {ic:"🔥", t:`"실력으로 증명하는 사람만 살아남습니다. 각오하십시오."`, d:[3,6,-5,3],
  sum:"경쟁을 선언한다 — 야심가는 반기고, 온화한 선수는 위축된다"},
 {ic:"😌", t:`"편하게 갑시다. 부담 갖지 말고 즐기면서 하죠."`, d:[-1,-4,6,2],
  sum:"긴장을 풀어준다 — 야심가에겐 물러 보인다"},
 {ic:"📋", t:`"규율부터 세우겠습니다. 지각과 불성실은 용납하지 않습니다."`, d:[6,1,-2,-6],
  sum:"원칙을 못 박는다 — 다혈질 선수들이 반발한다"},
 {ic:"🎯", t:`"3년 안에 이 팀을 리그 최고로 만들 겁니다. 함께 갈 사람만 남으십시오."`, d:[3,7,0,4],
  sum:"비전을 제시한다 — 야망 있는 선수들이 눈을 빛낸다"},
 {ic:"🗣️", t:`"제 방문은 늘 열려 있습니다. 할 말이 있으면 저에게 직접 하십시오."`, d:[2,0,6,3],
  sum:"소통을 약속한다 — 라커룸이 편안해진다"},
 {ic:"😤", t:`"지난 시즌 성적표 보셨습니까? 저는 부끄러웠습니다."`, d:[-3,1,-7,-5],
  sum:"군기를 잡는다 — 첫날부터 라커룸이 얼어붙을 수 있다"},
 {ic:"🙇", t:`"저도 배우는 자세로 임하겠습니다. 여러분이 주인공입니다."`, d:[1,-6,5,-2],
  sum:"몸을 낮춘다 — 일부는 감독을 얕본다"},
 {ic:"⚔️", t:`"이 라커룸에 보장된 자리는 없습니다. 저부터 매 경기 평가받겠습니다."`, d:[5,4,-3,1],
  sum:"자신도 평가 대상에 올린다 — 프로들이 신뢰한다"},
 {ic:"🍺", t:`"오늘은 훈련 없습니다. 대신 다 같이 저녁이나 먹읍시다."`, d:[-2,-3,7,5],
  sum:"파격적인 친화 — 프로페셔널한 선수들은 시간 낭비라 여긴다"}];
/* 성향 × 반응 강도별 대사 */
const GREET_REACT=[
 { g:[`"확실한 분이시네요. 이런 감독 밑에서 뛰고 싶었습니다."`,`"군더더기가 없습니다. 마음에 듭니다."`,`"말씀대로 하겠습니다. 준비되어 있습니다."`,`"기준이 분명한 게 제일 좋습니다."`],
   m:[`(고개를 끄덕인다) "알겠습니다."`,`"...일단 훈련장에서 뵙겠습니다."`,`"네, 잘 알겠습니다 감독님."`],
   b:[`(표정이 굳는다) "...그렇게 생각하실 수도 있겠네요."`,`"프로답지 못한 말씀 같습니다만."`,`"...할 말은 훈련장에서 하겠습니다."`,`"저는 그런 식으로 일하지 않습니다."`]},
 { g:[`"바로 이겁니다. 제대로 붙어보죠!"`,`"이런 얘기 기다렸습니다. 제 자리는 제가 만들겠습니다."`,`"감독님, 저 쓰실 거죠? 후회 안 하실 겁니다."`,`(눈빛이 달라진다) "재밌어지겠는데요."`],
   m:[`"...뭐, 나쁘지 않네요."`,`(팔짱을 낀 채 듣는다) "네."`,`"두고 보겠습니다."`],
   b:[`"...그 정도 목표로 여기 있는 게 아닙니다만."`,`(헛웃음) "진심이십니까?"`,`"이런 팀에 계속 있어야 하나 싶네요."`,`"저는 더 높은 데를 보고 있습니다, 감독님."`]},
 { g:[`"감독님 말씀 들으니까 마음이 놓이네요!"`,`"분위기 좋을 것 같아요. 잘 부탁드립니다!"`,`"이런 팀이라면 즐겁게 할 수 있겠어요."`,`(밝게 웃는다) "감사합니다, 감독님!"`],
   m:[`"네, 감독님..."`,`(조용히 고개를 끄덕인다)`,`"열심히 하겠습니다."`],
   b:[`(눈에 띄게 위축된다) "...네, 알겠습니다."`,`"제가... 잘할 수 있을까요."`,`(고개를 숙인 채 아무 말도 하지 못한다)`,`"...무섭네요, 솔직히."`]},
 { g:[`"좋습니다! 이런 게 축구죠!"`,`"바로 그겁니다 감독님! 다 뒤집어 놓읍시다!"`,`(주먹을 불끈 쥔다) "가시죠!"`,`"오늘부터 진짜 시작이네요!"`],
   m:[`"뭐, 알겠습니다."`,`(어깨를 으쓱한다)`,`"해보죠."`],
   b:[`"...지금 우리를 뭐로 보시는 겁니까?"`,`(자리를 박차고 나갈 기세다) "그런 말씀은 좀..."`,`"저희도 사람입니다, 감독님."`,`(대놓고 표정을 구긴다)`]}];
/* 시즌 목표 — req는 "이 정도 순위는 해야 달성"이라는 기준 순위 */
function goalOptions(t){
  return t.div===1
   ? [{k:"title", n:"우승", ic:"🏆", req:1, d:"리그 정상. 그 이하는 실패다."},
      {k:"acl",   n:`${(typeof eaclShort==="function")?eaclShort():"EACL"} 진출 (3위 이내)`, ic:"🌏", req:3, d:"아시아 무대를 밟는다."},
      {k:"finalA",n:"파이널 A 진입 (6위 이내)", ic:"🅰️", req:6, d:"상위 스플릿에서 시즌을 마친다."},
      {k:"mid",   n:"중위권 안착 (9위 이내)", ic:"⚖️", req:9, d:"강등 걱정 없는 시즌."},
      {k:"stay",  n:"1부 잔류", ic:"🛟", req:11, d:"살아남는 게 먼저다."}]
   : [{k:"title", n:"우승 · 다이렉트 승격", ic:"🏆", req:1, d:"곧장 1부로 올라간다."},
      {k:"po",    n:"승격 플레이오프 (5위 이내)", ic:"🎟️", req:5, d:"승격 티켓 경쟁에 낀다."},
      {k:"mid",   n:"중상위권 (8위 이내)", ic:"⚖️", req:8, d:"내년을 노릴 발판을 만든다."},
      {k:"build", n:"팀 재건 · 순위는 다음 문제", ic:"🌱", req:12, d:"성적보다 육성이 먼저다."}];
}
/* 전력(스쿼드 평균)만 놓고 봤을 때 이 팀이 갈 만한 순위 */
function expectRank(t){
  const ids = t.div===1?G.k1:G.k2;
  const arr = ids.map(id=>({id, o:teamOVR(G.teams[id])})).sort((a,b)=>b.o-a.o);
  const i = arr.findIndex(x=>x.id===t.id);
  return (i<0?Math.ceil(ids.length/2):i+1);
}
/* 공언한 목표가 전력 대비 어느 정도인지 — tier가 반응의 방향을 정한다 */
function goalTier(t, g){
  const gap = expectRank(t) - g.req;   // +면 전력보다 높은 목표
  if(gap>=6) return {k:"insane", n:"무모한 목표", gap, d:[-3,2,-6,-1],
    fans:5, owner:2, mood:"라커룸이 술렁입니다. 몇몇 핵심 선수는 대놓고 당황한 표정입니다."};
  if(gap>=3) return {k:"bold", n:"야심 찬 목표", gap, d:[3,7,-1,4],
    fans:4, owner:2, mood:"쉽지 않은 목표지만, 선수들의 눈빛이 달라졌습니다."};
  if(gap>=-2) return {k:"fair", n:"현실적인 목표", gap, d:[4,3,4,3],
    fans:1, owner:1, mood:"납득할 만한 목표입니다. 선수단이 차분하게 받아들였습니다."};
  if(gap>=-5) return {k:"safe", n:"보수적인 목표", gap, d:[0,-6,3,-2],
    fans:-3, owner:0, mood:"안전한 목표입니다. 다만 야심 있는 선수들의 표정이 좋지 않습니다."};
  return {k:"weak", n:"패배주의적인 목표", gap, d:[-4,-9,-1,-6],
    fans:-7, owner:-4, mood:"라커룸에 찬물을 끼얹었습니다. 이 팀이 이 정도밖에 안 되냐는 표정입니다."};
}
const GOAL_REACT={
 insane:[[0,`"...진심으로 하시는 말씀입니까? 저희 전력을 아직 못 보신 것 같은데요."`],
         [1,`(잠시 멍하니 있다가) "뭐, 목표는 높게 잡는 거니까요. 근데 진짜로요?"`],
         [2,`"우, 우승이요...? 저희가요...?"`],
         [3,`"좋긴 한데... 감독님, 우리 지난 시즌 순위 아시죠?"`]],
 bold:[[0,`"높은 목표군요. 대신 그만큼 준비시켜 주십시오."`],
       [1,`"이제야 말이 통하는 감독님이 오셨네요. 해봅시다."`],
       [2,`"부담되지만... 감독님이 그렇게 말씀하시면 해봐야죠!"`],
       [3,`"바로 그거죠! 못 할 게 뭐 있습니까!"`]],
 fair:[[0,`"합리적입니다. 거기부터 시작하죠."`],
       [1,`"일단 거기까지는 확실히 가고, 그다음은 그때 얘기하시죠."`],
       [2,`"저희가 할 수 있는 목표 같아요. 다행이에요."`],
       [3,`"딱 좋네요. 그 이상도 노려봅시다!"`]],
 safe:[[0,`"...그 정도로 만족하실 겁니까?"`],
       [1,`(표정이 식는다) "저는 그것보다 위를 보고 왔습니다만."`],
       [2,`"안전하게 가는 것도 나쁘지 않죠..."`],
       [3,`"에이, 감독님. 너무 몸 사리시는 거 아닙니까?"`]],
 weak:[[0,`"프로 선수에게 할 말씀은 아닌 것 같습니다."`],
       [1,`"이 팀에 남을 이유를 하나 잃었네요."`],
       [2,`"...저희가 그렇게 못하나요?"`],
       [3,`"시작도 전에 포기 선언입니까? 어이가 없네요."`]]};
let greetStep=0, greetPick=null;
function showSquadGreeting(){ greetStep=0; greetPick=null; inGreeting=true; document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match")); renderSquadGreeting(); }
/* 선수단에서 발언권이 큰 순서 — 핵심 선수일수록 첫인상 영향이 크다 */
function greetCore(t, n){ return [...t.players].sort((a,b)=>b.ovr-a.ovr).slice(0,n||6); }
function renderSquadGreeting(){
  const t=userTeam();
  const core=greetCore(t,5);
  const lines=core.map(p=>{
    const pers=p.pers||0;
    return `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #21262d">
      <b class="pos-${p.pos}">${p.name}</b> ${abilityStars(p)} <span class="small">${G.season-p.by}세 · ${PERS_N[pers]}</span>
      <div style="margin-top:3px">${pick(GREET_LINES[pers])}</div>
    </div>`;
  }).join("");
  // 선수단 성향 분포 — 어떤 말이 먹힐지 감독이 미리 가늠할 수 있게 보여준다
  const cnt=[0,0,0,0]; for(const p of t.players) cnt[p.pers||0]++;
  const mixTxt=PERS_N.map((n,i)=>`${n} <b style="color:#fff;font-weight:800">${cnt[i]}</b>명`).join(" · ");
  const btns=GREET_OPTS.map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" onclick="greetSay(${i})">${o.ic} ${o.t}<div class="small" style="margin-top:2px;opacity:.75">${o.sum}</div></button>`).join("");
  $("#main").innerHTML=`${introBar(1)}<h2>🤝 선수단 첫 인사</h2>
  <div class="card">
    <p>라커룸 문을 열자 선수들이 하나둘 모여듭니다. <b>${t.name}</b>의 새 감독으로서 첫 인사를 나눌 시간입니다.</p>
    <p class="small">선수단 성향: ${mixTxt}</p>
    <h3>핵심 선수들의 반응</h3>
    ${lines}
  </div>
  <div class="card">
    <h3>선수단에게 한마디 <span class="small">— 첫인상은 한 번뿐입니다</span></h3>
    ${btns}
  </div>`;
}
/* 성향별 증감치를 선수 개인에게 적용한다. 나이·현재 사기에 따라 체감이 조금씩 다르다. */
function applyGreetDelta(t, d){
  const out=[];
  for(const p of t.players){
    const base=d[p.pers||0]||0;
    const age=G.season-p.by;
    let v=base;
    if(age>=32 && base<0) v*=0.7;            // 베테랑은 어지간한 말에 흔들리지 않는다
    if(age<=21) v*=1.25;                     // 어린 선수는 첫인상에 크게 좌우된다
    v=Math.round(v + (Math.random()<0.35 ? (Math.random()<0.5?-1:1) : 0));
    p.morale=clamp(p.morale+v,25,99);
    out.push({p, v});
  }
  return out;
}
function reactFor(pers, v){ const r=GREET_REACT[pers]; return pick(v>=3?r.g : v<=-3?r.b : r.m); }
function greetSay(i){
  const t=userTeam(), o=GREET_OPTS[i]; if(!o) return;
  greetPick={i, res:applyGreetDelta(t, o.d)};
  const avg=greetPick.res.reduce((s,x)=>s+x.v,0)/Math.max(1,greetPick.res.length);
  t.morale=clamp(Math.round(t.morale+avg*1.5),35,99);   // 첫인상은 라커룸 전체 공기를 바꾼다
  greetStep=1;
  renderGreetGoal();
}
/* 2단계 — 시즌 목표 공언 */
function renderGreetGoal(){
  const t=userTeam(), o=GREET_OPTS[greetPick.i];
  const core=greetCore(t,6);
  const byId={}; greetPick.res.forEach(x=>byId[x.p.id]=x.v);
  const rows=core.map(p=>{
    const v=byId[p.id]||0;
    const col=v>=3?"var(--green)":v<=-3?"var(--red)":"var(--sub)";
    return `<div style="margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid #21262d">
      <b class="pos-${p.pos}">${p.name}</b> <span class="small">${PERS_N[p.pers||0]}</span>
      <span class="small" style="color:${col};font-weight:800">사기 ${v>0?"+"+v:v}</span>
      <div style="margin-top:3px">${reactFor(p.pers||0, v)}</div>
    </div>`;
  }).join("");
  const avg=greetPick.res.reduce((s,x)=>s+x.v,0)/Math.max(1,greetPick.res.length);
  const verdict = avg>=3?["첫인상 성공", "var(--green)"] : avg>=0.5?["무난한 출발","var(--gold)"]
                : avg>=-1.5?["미지근한 반응","var(--gold)"] : ["첫인상을 망쳤습니다","var(--red)"];
  const exp=expectRank(t), star=teamStarVal(t);
  const opts=goalOptions(t).map((g,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" onclick="greetGoal(${i})">${g.ic} <b>${g.n}</b><div class="small" style="margin-top:2px;opacity:.75">${g.d}</div></button>`).join("");
  $("#main").innerHTML=`${introBar(2)}<h2>🤝 선수단 첫 인사</h2>
  <div class="card">
    <p>${o.ic} <b>"${o.t.replace(/"/g,"")}"</b></p>
    <p class="small">전체 반응: <b style="color:${verdict[1]};font-weight:800">${verdict[0]}</b> · 선수단 평균 사기 ${avg>=0?"+":""}${Math.round(avg*10)/10}</p>
  </div>
  <div class="card"><h3>선수들의 반응</h3>${rows}</div>
  <div class="card">
    <h3>올 시즌 목표를 밝히십시오</h3>
    <p class="small">우리 전력: ${teamStars(t)} · 전력만 놓고 보면 <b style="color:#fff;font-weight:800">${exp}위권</b> 전력입니다.
      선수들은 감독이 내건 목표가 현실적인지 아닌지 금방 알아챕니다.</p>
    ${opts}
  </div>`;
  window.scrollTo(0,0);
}
/* 🎯 새 시즌 목표 카드 — 스태프 회의에서 해마다 새로 세운다 (부임 첫 시즌은 상견례가 담당) */
function seasonGoalCard(t){
  if(!goalNeeded()) {
    const gl=G.goal;
    return gl ? `<div class="card stCard"><h3>🎯 ${G.season} 시즌 목표 <span class="tag" style="background:#3fb95033;color:#3fb950">확정</span></h3>
      <p>${gl.ic} <b style="color:#fff;font-weight:800">${gl.n}</b> <span class="small">— 구단주가 기대하는 성적: ${gl.req}위 이내 · 공언 평가 <b>${gl.tierN||""}</b></span></p></div>` : "";
  }
  const exp=expectRank(t);
  const opts=goalOptions(t).map((g,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px"
    onclick="setSeasonGoal(${i})">${g.ic} <b>${g.n}</b><div class="small" style="margin-top:2px;opacity:.75">${g.d}</div></button>`).join("");
  return `<div class="card stCard" style="border-color:var(--gold)">
    <h3>🎯 ${G.season} 시즌 목표 <span class="tag inj">미정</span></h3>
    <p class="small">새 시즌이 시작됩니다. 구단주와 팬 앞에서 <b>올 시즌 목표</b>를 밝히십시오.<br>
      우리 전력: ${teamStars(t)} · 전력만 놓고 보면 <b style="color:#fff;font-weight:800">${exp}위권</b>입니다.
      너무 낮게 잡으면 야심이 없다는 소리를, 너무 높게 잡으면 시즌 내내 그 말이 따라다닙니다.</p>
    ${opts}</div>`;
}
function setSeasonGoal(gi){
  const t=userTeam(), g=goalOptions(t)[gi]; if(!g) return;
  const tier=goalTier(t, g);
  G.goal={k:g.k, n:g.n, ic:g.ic, req:g.req, tier:tier.k, tierN:tier.n, gap:tier.gap, s:G.season, exp:expectRank(t)};
  adjustTrust("fans", tier.fans, `${G.season} 시즌 목표 공언 (${g.n})`);
  adjustTrust("owner", tier.owner, `${G.season} 시즌 목표 공언 (${g.n})`);
  /* 선수단도 감독의 말을 듣는다 — 현실적인 목표면 힘이 나고, 허풍이면 눈치를 본다 */
  try{ const res=applyGreetDelta(t, tier.d);
    const avg=res.reduce((s,x)=>s+x.v,0)/Math.max(1,res.length);
    t.morale=clamp(Math.round((t.morale+avg*0.8)*100)/100,30,99);
  }catch(e){}
  addMood(`🎯 ${G.season} 시즌 목표 — 감독이 <b>${g.n}</b>을(를) 공언했습니다. ${tier.mood}`);
  addNews(`🎯 ${t.name}, ${G.season} 시즌 목표는 <b>${g.n}</b> — ${tier.n}`, tier.k==="insane"||tier.k==="bold"?"warn":null, "club");
  try{ socialOnGoal(g, tier); }catch(e){}
  saveGame(); show("staff"); window.scrollTo(0,0);
}
function greetGoal(gi){
  const t=userTeam(), g=goalOptions(t)[gi]; if(!g) return;
  const tier=goalTier(t, g);
  const res=applyGreetDelta(t, tier.d);
  const avg=res.reduce((s,x)=>s+x.v,0)/Math.max(1,res.length);
  t.morale=clamp(Math.round(t.morale+avg*1.5),30,99);
  G.goal={k:g.k, n:g.n, ic:g.ic, req:g.req, tier:tier.k, tierN:tier.n, gap:tier.gap, s:G.season, exp:expectRank(t)};
  adjustTrust("fans", tier.fans, `시즌 목표 공언 (${g.n})`);
  adjustTrust("owner", tier.owner, `시즌 목표 공언 (${g.n})`);
  addMood(`🎯 ${t.name} 시즌 목표 — 감독이 <b>${g.n}</b>을(를) 공언했습니다. ${tier.mood}`);
  socialOnGoal(g, tier);
  // 반응 화면
  const core=greetCore(t,6);
  const byId={}; res.forEach(x=>byId[x.p.id]=x.v);
  const pool=GOAL_REACT[tier.k]||GOAL_REACT.fair;
  const rows=core.map(p=>{
    const v=byId[p.id]||0, pers=p.pers||0;
    const line=(pool.find(x=>x[0]===pers)||pool[0])[1];
    const col=v>=3?"var(--green)":v<=-3?"var(--red)":"var(--sub)";
    return `<div style="margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid #21262d">
      <b class="pos-${p.pos}">${p.name}</b> <span class="small">${PERS_N[pers]}</span>
      <span class="small" style="color:${col};font-weight:800">사기 ${v>0?"+"+v:v}</span>
      <div style="margin-top:3px">${line}</div>
    </div>`;
  }).join("");
  const tcol = tier.k==="fair"||tier.k==="bold" ? "var(--green)" : tier.k==="insane"||tier.k==="weak" ? "var(--red)" : "var(--gold)";
  $("#main").innerHTML=`${introBar(2)}<h2>🎯 시즌 목표 발표</h2>
  <div class="card">
    <p>${g.ic} <b>"올 시즌 우리의 목표는 ${g.n}입니다."</b></p>
    <p class="small">평가: <b style="color:${tcol};font-weight:800">${tier.n}</b> · ${tier.mood}</p>
    <p class="small">팀 사기 ${avg>=0?"+":""}${Math.round(avg*10)/10} · 팬 신뢰 ${tier.fans>=0?"+":""}${tier.fans} · 구단주 신뢰 ${tier.owner>=0?"+":""}${tier.owner}</p>
  </div>
  <div class="card"><h3>선수들의 반응</h3>${rows}</div>
  <div class="msg info">👈 왼쪽 메뉴 하단의 <b>라커룸을 나선다</b> 버튼으로 진행합니다.</div>`;
  greetReady=true;
  try{ applyNavLock(); }catch(e){}
  window.scrollTo(0,0);
}
function greetDone(){
  greetReady=false;
  const t=userTeam();
  addMood(`🤝 ${t.name} 선수단 상견례 — 새 감독의 첫 만남이 마무리됐습니다. (팀 사기 ${t.morale})`);
  G.introDone=true; greetStep=0; greetPick=null; saveGame();
  inGreeting=false;
  applyNavLock();                         // 여기서 모든 메뉴가 열린다
  $("#advBtn").disabled=false;
  notify("✅ 부임 절차가 끝났습니다. 이제 좌측의 모든 메뉴를 쓸 수 있습니다. 먼저 <b>👥 스쿼드</b>와 <b>📋 전술</b>을 둘러보세요.","good");
  show("home"); window.scrollTo(0,0);
}
