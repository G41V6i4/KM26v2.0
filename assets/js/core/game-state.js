"use strict";
/* =====================================================
   게임 상태
===================================================== */
let G = null;
function newGame(teamId){
  PID=1;
  _UID_USED=new Set();      // 🆔 새 게임 — 고유번호 발급 기록을 비운다 (두 번째 게임도 같은 번호가 나오게)
  G = {season:2026, userTeamId:teamId, teams:{}, news:[], history:[], userXI:null,
       k1:[], k2:[], k1Fix:[], k2Fix:[], r1:0, r2:0, phase:"league", splitDone:false,
       results:[], poResults:[], aclTeams:[], aclFix:[], eacl:null, eaclClubs:{}, pendingEACL:null, cwc:null, cwcClubs:{}, cwcQual:null, cwcName:{}, pendingCWC:null, sponHeat:0, transferBids:[], offers:[], nego:null, snego:null, freeAgents:[], press:{rel:50, skip:0}, trust:{owner:70, fans:70, log:[]}, seen:{}, introDone:false,
       ageV2:true, htV1:true, specV1:true, fac10:1};   // 선수를 만들 때 이미 나이·키만큼 몸을 깎았다 — 다시 읽어도 두 번 깎지 않는다 · fac10: 시설 10단계 눈금
  for(const d of D1){ const t=mkTeam(d,1); G.teams[t.id]=t; G.k1.push(t.id); }
  for(const d of D2){ const t=mkTeam(d,2); G.teams[t.id]=t; G.k2.push(t.id); }
  /* 홈그로운 표시 — 개명 전 원본 이름으로 찾는다 */
  for(const id in G.teams) for(const p of G.teams[id].players)
    if(p.frn && HOMEGROWN_NAMES.includes(p.name)) p.hg=1;
  /* 선수 이름 — 실명 유지. (가명화를 두 차례 시도했으나 되돌렸다.
     fictName 계열 함수는 에디터 DB 매칭 호환용으로 남아 있다.) */
  const ut=G.teams[teamId]; ut.isUser=true;
  /* 🎩 감독 30명을 FM 24개 표로 승격 — 스태프와 같은 자로 비교된다 (요청) */
  try{ for(const k in COACHES){ const c=COACHES[k]; if(acNeedSeed(c)) acSeedFromLegacy(c); } }catch(e){}
  try{ cvOpenSpell(teamId); }catch(e){}   // 📜 감독 경력 장부 — 첫 부임 (요청)
  for(const id in G.teams) assignAITactics(G.teams[id]);
  buildSeason();
  // 2026 EACL: 2025 시즌 성적 기준 — 한국은 3장을 받는다 (전북 · 포항 · 대전)
  G.aclTeams=["jeonbuk","pohang","daejeon"].filter(id=>G.teams[id]&&G.teams[id].div===1&&eaclEligible(id));
  setupACL();
  try{ sponSeason(); }catch(e){}   // 🤝 개막 전 스폰서 계약 — 모든 구단이 이 표에서 살림을 시작한다
  addNews(`${G.season} 시즌 개막! ${ut.name}의 감독으로 부임했습니다.`);
  addNews(`이적시장이 열려 있습니다. (${divName(ut.div)} 소속, 예산 ${ut.budget}억)`);
  /* 🎩 수석코치 — 구단에 원래 있던 사람이다. 부임 인사와 함께 소개받는다. */
  try{
    acEnsure();
    const _ac=acOf();
    if(_ac){
      const _TR=AC_TRAIT[_ac.trait]||AC_TRAIT.bal;
      addNews(`🎩 <b>${_ac.n}</b> 수석코치(${_ac.age}세)가 감독을 맞았습니다 — ${_TR.ic} ${_TR.n} · 종합 ${acOvr(_ac)}/20. <span class="small">💸 이적시장 → 🎩 스태프 탭에서 언제든 교체할 수 있습니다.</span>`, null, "club");
    }
  }catch(e){}
}
/* 📚 시즌 커리어 — 시즌이 바뀌기 전에 그해 성적을 선수에게 남긴다(최근 5시즌).
   기록이 없으면 프로필에서 「올 시즌」밖에 볼 수 없어, 선수의 내력이 통째로 사라졌다. */
const CAREER_KEEP=5;
function archiveSeasonRec(p, tid, season){
  if(!p) return;
  const ap=p.apps||0;
  if(ap<=0) return;                                   // 한 경기도 못 뛴 시즌은 남기지 않는다
  if(!Array.isArray(p.rec)) p.rec=[];
  if(p.rec.some(x=>x.s===season)) return;             // 중복 방지
  const t=G.teams[tid];
  const legs=(function(){ try{ return seasonLegs(p); }catch(e){ return null; } })();
  p.rec.push({s:season, t:tid||"", sh:(t&&t.short)||"", d:(t&&t.div)||0,
              ap, g:p.goals||0, a:p.assists||0,
              r: ap ? Math.round(((p.rTot||0)/ap)*100)/100 : 0,
              /* 📚 그 시즌에 거쳐 간 팀들 — 한 팀만 있었으면 남기지 않는다 */
              legs: legs ? legs.map(x=>({sh:x.sh, ap:x.ap, g:x.g, a:x.a, r:x.r})) : null});
  if(p.rec.length>CAREER_KEEP) p.rec=p.rec.slice(-CAREER_KEEP);
}
function archiveAllSeasonRecs(season){
  for(const id in (G.teams||{})){
    const t=G.teams[id];
    for(const p of (t.players||[])) archiveSeasonRec(p, id, season);
  }
  const walk=(arr)=>{ if(Array.isArray(arr)) for(const p of arr) archiveSeasonRec(p, "", season); };
  walk(G.freeAgents); walk(G.overseas);
}
/* 🧭 유스 배출 자리 — 실제 아카데미 구성 비율.
   골키퍼가 빠져 있고 수비수의 세부 자리를 정하지 않아 풀백·GK 유망주가 나오지 않았다(제보). */
const YOUTH_SLOTS=[
  {pos:"GK", prefs:["GK"],                        w:9},
  {pos:"DF", prefs:["CB","CB","LB","RB"],          w:30},
  /* 🧭 ⚠ 제보 원문 — 「'유스' 에서 선수들이 배출 되어 콜업 될 때에 … 공격형 미드필더와
     수비형 미드필더도 유스에서 배출 되는 포지션에 넣어주시면 감사하겠습니다」.
     확인해 보니 DM·CAM 이 목록에 있기는 했다 — 다만 중원 여섯 칸 중 한 칸씩(전체의 약 6%)이라,
     한 시즌에 1~5명 올라오는 아카데미에서는 몇 시즌을 기다려도 얼굴을 보기 어려웠다.
     중앙 세 갈래(수비형·중앙·공격형)를 비슷한 몫으로 맞춘다. */
  {pos:"MF", prefs:["DM","DM","CM","CM","CM","CAM","CAM","LM","RM"], w:35},
  {pos:"FW", prefs:["ST","ST","LW","RW"],          w:26}
];
/* 팀에 모자란 자리는 더 잘 나온다 — 유스 코치가 필요한 자리를 먼저 키운다 */
function youthPickSlot(t){
  const have={};
  try{ for(const p of (t.players||[])){ const s=p.prefPos||p.pos; have[s]=(have[s]||0)+1; } }catch(e){}
  const need=(list, floor)=>{ let n=0; for(const s of list) n+=(have[s]||0); return n<floor ? 1.9 : (n<floor+2 ? 1.3 : 1); };
  /* ⚠ 제보 — 「유스 콜업이 부족한 포지션 먼저 나오는데, 전체 랜덤이 현실적」. 유스는 1군
     사정을 봐주지 않는다 — 유저 팀은 실제 아카데미 구성 비율로만 뽑는다.
     AI 팀은 가중을 유지한다: 이 가중이 리그 풀백·GK 기근을 막는 장치다(이전 제보의 해결책). */
  const pure = !!(t && t.isUser);
  const bonus= pure ? {GK:1, DF:1, MF:1, FW:1} : {
    GK: need(["GK"], 3),
    DF: need(["LB","RB","LWB","RWB"], 4),          // 풀백 기근 보정
    MF: 1,
    FW: need(["LW","RW"], 3)
  };
  let tot=0; const ws=YOUTH_SLOTS.map(s=>{ const v=s.w*(bonus[s.pos]||1); tot+=v; return v; });
  let r=Math.random()*tot, k=0;
  for(let i=0;i<ws.length;i++){ r-=ws[i]; if(r<=0){ k=i; break; } }
  const S=YOUTH_SLOTS[k];
  /* 세부 자리도 모자란 쪽을 우선 — 풀백이 없으면 CB보다 LB/RB가 먼저 나온다 */
  let prefs=S.prefs;
  if(!pure && S.pos==="DF" && ((have["LB"]||0)+(have["RB"]||0))<3) prefs=["LB","RB","CB"];
  if(!pure && S.pos==="FW" && ((have["LW"]||0)+(have["RW"]||0))<2) prefs=["LW","RW","ST"];
  /* 🧭 제보 — 중원도 같은 장치를 둔다. 풀백·골키퍼가 그랬듯, 보정이 없으면 리그 전체에서
     수비형·공격형 미드필더가 해마다 줄어 몇십 시즌 뒤에는 사실상 사라진다. */
  if(!pure && S.pos==="MF"){
    const _dm=have["DM"]||0, _am=have["CAM"]||0;
    if(_dm<2 && _am<2)      prefs=["DM","CAM","CM"];
    else if(_dm<2)          prefs=["DM","DM","CM","CAM"];
    else if(_am<2)          prefs=["CAM","CAM","CM","DM"];
  }
  return {pos:S.pos, pref:pick(prefs)};
}
/* 세부 자리 → 큰 자리 */
const AI_PREF_POS={GK:"GK", CB:"DF", LB:"DF", RB:"DF", LWB:"DF", RWB:"DF",
  DM:"MF", CM:"MF", CAM:"MF", LM:"MF", RM:"MF", LW:"FW", RW:"FW", ST:"FW"};
/* ═══════════════════════════════════════════════════════════════════════════
   🧮 AI 구단의 오프시즌 인원 — 유스 배출 + 자리별 보강
   ⚠ 제보 ① 「해가 갈수록 왼쪽·오른쪽 풀백이 검색에 9명, 8명밖에 안 나온다. 다른 팀 유스에서도
             풀백·골키퍼가 배출되게 해 달라.」
      ② 「처음엔 선수가 1000명이 넘었는데 10년이 지나니 850명. 100년이 지나도 1000명은 넘어야 한다.」
   원인은 둘 다 여기였다. AI 보강이
     · 자리를 pick(["DF","MF","FW"]) 로만 정하고 세부 자리(prefPos)를 비워 둬서 능력치 추론이
       전부 센터백·중앙 미드필더로 몰렸고 (10시즌 실측 LB 41→11 · RB 40→10 · GK 116→75)
     · 스쿼드 하한이 24명뿐이라 실제 로스터(29~50명)가 해마다 깎여 리그 총원이 1022→792(−22%)로
       내려앉았다.
   그래서 ① 유저와 똑같이 youthPickSlot 으로 자리를 뽑고 ② 자리별 하한을 못 박고
   ③ 스쿼드 하한을 실축 등록 규모(K1 31 · K2 28)로 올린다.
   ⚠ 난이도 — 인원을 늘리면 저점이 낮은 선수가 쏟아져 AI가 헛돈을 쓸 수 있다. 그래서 보충 선수는
      싸고(연봉 = 능력치 기준), 구단 예산에 비례해서만 조금 나아진다. 유스 졸업생은 연봉 0.3억 고정.
   ═══════════════════════════════════════════════════════════════════════════ */
function aiSquadFloor(t){
  if(isArmyTeam(t)) return 24;            // 상무는 입대로만 채운다 — 억지로 늘리지 않는다
  return t.div===1 ? 32 : 29;             // 실축 K리그 등록 인원(30명 내외)에 맞춘다
}
/* 🌱 AI 구단 유스 졸업 — 다른 구단 아카데미에서도 풀백·골키퍼가 올라온다 */
function aiYouthIntake(t){
  if(isArmyTeam(t)) return 0;             // 국군체육부대에는 아카데미가 없다
  const yl=lvEff(t.youthLv||1), tl=lvEff(trainLv(t));   // 🔟 10단계 → 예전 1~5 성능 축
  const n=1+R(2)+[0,0,0,1,1,2][Math.round(yl)];       // 1~5명 — 유스 등급이 높은 명문이 더 많이 낸다
  for(let i=0;i<n;i++){
    const sl=youthPickSlot(t);
    const hgY=Math.random()<(0.05+yl*0.015);
    const yp=mkPlayer(hgY?genFrnName():genName(), sl.pos, G.season-17-R(2),
                      Math.round(50+R(9)+(yl-1)+(tl-1)*0.5), hgY?1:0);
    if(hgY) yp.hg=1;
    try{ yp.prefPos=sl.pref; yp.posFam=initPosFam(yp); syncPosBand(yp); applySpecialization(yp); retuneTraits(yp); }catch(e){}
    /* 저점은 낮게, 천장은 유저 아카데미보다 조금 낮게 — AI가 특급을 매년 뽑아 오면 난이도가 무너진다.
       (유저 천장 하향과 함께 내렸다 — 안 내리면 유저만 손해 보는 비대칭이 된다.
        리그 상위권 재생산은 특급(84~92)이 맡는다: 25구단 합산 시즌당 1.5~2명) */
    const gem=Math.random() < (0.004+(yl-1)*0.010+(tl-1)*0.004);
    const pot0=clamp(Math.round(yp.ovr+3+R(9)+(yl-1)*1.4), 64, Math.round(68+(yl-1)*1.8));
    yp.pot=gem ? clamp(pot0+4+R(7), 84, 92) : pot0;
    yp.wage=0.3; yp.ct=aiCtYears(yp);          // 유스는 장기 계약으로 묶는다 (제보 — 보스만 방어)
    yp.ythOf=t.id;                       // 🌱 이 구단 유스 출신 — 은퇴 후 지도자 연봉 할인 근거 (요청)
    t.players.push(yp);
    if(gem && yp.pot>=88)
      try{ addNews(`🌱 <b>${t.short}</b> 유스에서 ${POS_KO[yp.pos]||yp.pos} <b>${yp.name}</b>(${G.season-yp.by}세)가 1군에 올라왔습니다 — 코치진 평가 "특급".`, null, "league"); }catch(e){}
  }
  return n;
}
/* 🧱 자리별 하한을 채우고, 그다음 스쿼드 인원을 채운다 */
function aiSquadFill(t){
  /* 🎖️ ⚠ 제보 원문 — 「김천 상무는 유스 콜업이 없는 팀이라서 김천 상무의 유스 콜업이 있다면 없애 달라」.
     ─ 원인이 여기였다. 이 함수는 모자란 자리를 youthPickSlot 으로 뽑아 선수를 '만들어' 채운다.
       상무에도 그대로 돌아서, 입대한 적 없는 19~27세 선수가 해마다 새로 생겨났다. 사실상 유스 콜업이다.
       상무의 선수는 오직 입대로만 온다 — 모자라면 연맹이 다른 구단 현역을 배정한다(armyAutoFloor). */
  if(isArmyTeam(t)) return;
  const cnt=(list)=>{ let n=0; for(const p of t.players){ const s=p.prefPos||p.pos; if(list.indexOf(s)>=0) n++; } return n; };
  const rich=clamp((t.budget||0)/60, 0, 1);
  /* 🎖️ 국군체육부대는 용병을 뽑지 않는다 — 자동 보충으로도 외국인이 생기면 안 된다 (제보) */
  const noFrn=(typeof isArmyTeam==="function") && isArmyTeam(t);
  const mk=(pref)=>{
    const pos=AI_PREF_POS[pref]||"MF";
    const f=!noFrn && Math.random() < ((t.div===1?0.16:0.10)+rich*0.06);
    const np=mkPlayer(f?genFrnName():genName(), pos, G.season-19-R(9),
                      56+R(12)+Math.round(rich*4)+(f?2:0), f);
    try{ np.prefPos=pref; np.posFam=initPosFam(np); syncPosBand(np); applySpecialization(np); retuneTraits(np); }catch(e){}
    if(f && (G.season-np.by)<=21 && Math.random()<0.4) np.hg=1;   // 국내에서 자란 어린 외국 선수 — 홈그로운
    np.ct=aiCtYears(np);
    t.players.push(np);
    return np;
  };
  let g=0;
  while(cnt(["GK"])<3            && g++<60) mk("GK");
  while(cnt(["LB","LWB"])<2      && g++<60) mk(Math.random()<0.78?"LB":"LWB");
  while(cnt(["RB","RWB"])<2      && g++<60) mk(Math.random()<0.78?"RB":"RWB");
  while(cnt(["CB"])<4            && g++<60) mk("CB");
  while(cnt(["DM","CM","CAM"])<5 && g++<60) mk(pick(["DM","CM","CM","CAM"]));
  while(cnt(["LW","RW","LM","RM"])<4 && g++<60) mk(pick(["LW","RW","LM","RM"]));
  while(cnt(["ST"])<3            && g++<60) mk("ST");
  const floor=aiSquadFloor(t);
  let g2=0;
  while(t.players.length<floor && g2++<60){ const sl=youthPickSlot(t); mk(sl.pref); }
}
/* ═══ 🧮 리그 총원 평형 ═══════════════════════════════════════════════════
   ⚠ 제보 — 「100년이 지나도 선수 검색에 나오는 선수가 1000명은 넘는 수준이어야 한다.」
   은퇴·계약 만료로 빠지는 인원을 구단 유스 배출만으로는 다 메울 수 없다. 모자란 만큼은
   하부 리그·해외에서 새 자원이 들어온 것으로 본다 — 매년 시즌 전환의 맨 마지막에,
   모자란 인원만큼만, 한 번에 45명까지만 시장(FA)에 풀어 준다.
   ⚠ 난이도 — 이 선수들은 능력치가 낮게 깔리고 값·연봉도 능력치 그대로 매겨진다.
      AI가 이 자원에 큰돈을 쓸 이유가 없어야 하고, 자리는 고르게 뿌려 특정 자리 기근을 막는다. */
const POSTRAIN_K=0.26;   // 포지션 훈련 하루 = 경기 한 판의 26%
const POOL_TARGET=1010;
const POOL_PREFS=["GK","GK","CB","CB","LB","LB","RB","RB","LWB","RWB",
  "DM","DM","CM","CM","CAM","LM","RM","LW","LW","RW","RW","ST","ST"];
function poolTopUp(){
  let n=0; for(const id in G.teams) n+=(G.teams[id].players||[]).length;
  G.freeAgents=G.freeAgents||[];
  let need=POOL_TARGET-(n+G.freeAgents.length);
  if(need<=0) return 0;
  need=Math.min(need, 45);
  for(let i=0;i<need;i++){
    const pref=pick(POOL_PREFS), pos=AI_PREF_POS[pref]||"MF";
    const f=Math.random()<0.12;
    const p=mkPlayer(f?genFrnName():genName(), pos, G.season-19-R(11), 52+R(12)+(f?2:0), f);
    try{ p.prefPos=pref; p.posFam=initPosFam(p); syncPosBand(p); applySpecialization(p); retuneTraits(p); }catch(e){}
    p.ct=1; p.wage=wageExpect(p.ovr, p.frn, 2);
    G.freeAgents.push(p);
  }
  return need;
}
function resetSeasonStats(p){
  p.apps=0;p.goals=0;p.assists=0;p.rTot=0;p.seasonRating=0;
  p.fApps=0;p.fGoals=0;p.fAssists=0;p.fRTot=0;p.fRating=0;
}
/* @param keepUser  새 시즌 전환(startNewSeason)에서 true — 유저가 짜 둔 선발을 지우지 않는다.
   ⚠ 제보 — 「1월 1일이 되면 AI가 임의로 베스트 일레븐과 후보를 다시 짠다」.
      원인은 여기였다. buildSeason 이 G.userXI 를 통째로 null 로 만들어 버려서,
      bestXI() 가 "유저가 짠 선발이 없다"고 보고 매번 자동 편성을 새로 뽑고 있었다.
      12월 31일의 판(선발·배치·세부 역할·벤치)은 그대로 이어져야 한다. */
/* ═══ 📆 날짜 축 재설정 ═══════════════════════════════════════════════
   ⚠ 제보 — 「악플러 소송이 안 끝난 채로 시즌이 끝나니 남은 날짜가 갑자기 300일대로 늘어났다」.
   시즌이 바뀌면 달력을 새로 깔면서 G.day 가 0 으로 돌아간다. 그런데 「며칠 뒤에 결과가 나온다」류의
   기한은 전부 그때의 G.day 에 더한 **절대 일자**로 저장돼 있었다. 축이 0 으로 리셋되니
   지난 시즌 330일차에 잡아 둔 판결일이 새 시즌에서는 그대로 D-330 이 된다.
   소송만이 아니다 — 예적금 만기, 스카우트 파견, 증시 제보 판정일, 지수선물 만기,
   사채 상환 약속, 추경 심의일, 해외 이적 링크, 재계약 잠금이 모두 같은 축을 쓴다.
   ─ 시즌을 넘길 때 「남은 날수」가 보존되도록 축을 통째로 옮긴다. */
function rebaseDayFields(oldDay){
  const off=Math.max(0, Math.round(oldDay||0));
  if(!off) return 0;
  let n=0;
  /* 미래 기한 — 남은 날수를 지킨다. 이미 지난 것은 0(=오늘)으로 내린다. */
  const F=(o,k)=>{ if(o && typeof o[k]==="number"){ o[k]=Math.max(0, Math.round(o[k]-off)); n++; } };
  /* 과거 시점 — 「언제 있었던 일인가」. 시즌을 넘겼으므로 0 아래로는 의미가 없다. */
  const B=(o,k)=>{ if(o && typeof o[k]==="number"){ o[k]=Math.max(0, Math.round(o[k]-off)); n++; } };
  try{
    /* ⚖️ 명예훼손 소송 — 비시즌 두어 달이 실제로 흘렀다. 남은 심리는 짧게 잡아 준다. */
    if(G.suit){
      const left=Math.max(0, (G.suit.due||0)-off);
      G.suit.due=Math.min(left, 12);
      B(G.suit, "filed");
    }
    if(G.me){
      F(G.me.fut, "due"); B(G.me.fut, "at");
      if(G.me._dunPromise) F(G.me._dunPromise, "due");
      if(G.me.bank){
        if(Array.isArray(G.me.bank.acc))  for(const a of G.me.bank.acc){ F(a,"due"); B(a,"start"); }
        if(Array.isArray(G.me.bank.loan)) for(const a of G.me.bank.loan) B(a,"start");
        if(Array.isArray(G.me.bank.hist)) for(const h of G.me.bank.hist) B(h,"d");
      }
      if(Array.isArray(G.me.props)) for(const p of G.me.props) B(p,"at");
    }
    if(G.stock && Array.isArray(G.stock.tips)) for(const x of G.stock.tips){ F(x,"due"); B(x,"d"); }
    if(G.scout && G.scout.trip) for(const k in G.scout.trip){ F(G.scout.trip[k],"next"); B(G.scout.trip[k],"from"); }
    /* 🔎 보고서의 유효기간·관찰 시작일도 함께 되감는다 — 안 그러면 영영 만료되지 않는다 (제보) */
    if(G.scout && Array.isArray(G.scout.list)) for(const p of G.scout.list){ F(p,"scUntil"); F(p,"scNewTil"); B(p,"scAt"); }
    /* 🎖️ 입영 예정일 — 시즌이 바뀌어도 남은 날수를 지킨다 */
    try{ for(const id in G.teams) for(const p of G.teams[id].players) if(p.armyCall) F(p.armyCall, "at"); }catch(e){}
    /* 🗓️ 날짜를 콕 집어 지정한 훈련 — 지난 시즌의 「210일차 강훈련」이 새 시즌 210일차에
       그대로 되살아난다. 그 날짜에 무슨 경기가 있는지는 시즌마다 다르므로 옮길 수가 없다.
       ⚠ 제보 — 「EACL 전날에 훈련이 자동으로 편성돼 있다」. 이게 원인 중 하나였다.
       ─ 새 시즌은 백지에서 시작한다. 주간 루틴은 그대로 남는다. */
    if(G.train && G.train.days) G.train.days={};
    if(G.req && G.req.pend) F(G.req.pend, "due");
    if(G.req && G.req.cool) for(const k in G.req.cool) B(G.req.cool[k], "d");
    for(const id in G.teams) for(const p of (G.teams[id].players||[])){
      if(p.osLink) F(p.osLink, "due");
      if(typeof p._renewAt==="number") B(p, "_renewAt");
      if(p.concern) B(p.concern, "d");
    }
  }catch(e){}
  return n;
}
function buildSeason(keepUser){
  const _oldDay=G.day||0;
  for(const id in G.teams){ const t=G.teams[id];
    t.W=0;t.Dw=0;t.L=0;t.GF=0;t.GA=0;t.Pts=0;t.form=[];
    /* 🌱 새 시즌 사기 — 백지에서 시작하지 않는다.
       ⚠ 제보 — 「지난 시즌 사기가 100이었는데 새 시즌이 되면 50으로 리셋된다」.
          한 해 내내 쌓아 올린 분위기가 개막 하루 만에 사라지는 건 이상하다.
          그렇다고 그대로 들고 가면 시즌 초부터 높은 사기를 공짜로 얻는다.
       ─ 기준선(50)으로 절반쯤 끌어당긴다. 좋았던 팀은 좋게, 나빴던 팀은 나쁘게 출발한다.
            100 → 79   ·   90 → 73   ·   80 → 67   ·   50 → 50   ·   30 → 38
          여기에 지난 시즌 성적이 조금 더 얹힌다(우승·승격은 들뜬 채로, 강등은 무겁게). */
    {
      const prev=(t.morale!=null) ? t.morale : 50;
      let m = 50 + (prev-50)*0.58;
      try{
        const tro=(G.trophies||[]).filter(x=>x.s===G.season-1 && (t.isUser || x.team===t.id));
        if(t.isUser){
          if(tro.some(x=>x.kind==="champ"))            m+=7;
          else if(tro.some(x=>x.kind==="champ2"||x.kind==="promo")) m+=6;
          else if(tro.some(x=>x.kind==="eacl"))        m+=5;
          else if(tro.some(x=>x.kind==="releg"))       m-=8;
        }
      }catch(e){}
      /* 지난 시즌 마지막 흐름도 며칠은 남는다 */
      try{ const f=(t.form||[]).slice(-5);
        m += f.filter(x=>x==="W").length*1.1 - f.filter(x=>x==="L").length*1.1; }catch(e){}
      t.morale=Math.round(clamp(m, 28, 82)*10)/10;
    }
    for(const p of t.players){resetSeasonStats(p);p.talkR=-9;p.promise=null;p.unhappy=Math.max(0,(p.unhappy||0)-1);
      /* 선수 개인 사기도 같은 원리로 — 완전히 지우지 않고 절반쯤 끌어당긴다 */
      if(p.morale!=null) p.morale=Math.round(clamp(50+(p.morale-50)*0.55, 30, 88)*10)/10;
      /* 📚 시즌 첫 구간 — 개막 소속을 0에서 시작하는 구간으로 깔아 둔다.
         이게 없으면 시즌 중에 처음 팀을 옮길 때 그 전 팀의 몫이 통째로 사라진다. */
      p.sLeg=[{s:G.season, t:t.id, sh:t.short||"", d:0, ap0:0, g0:0, a0:0, r0:0}];
    }
  }
  /* ⚠ 구단 소속이 아닌 선수도 기록을 리셋해야 한다 — FA로 겨울을 난 선수가 전 시즌 31경기 7골을
     그대로 들고 입단해 개막 전 득점 순위에 오르던 버그 (제보). */
  for(const p of (G.freeAgents||[])) resetSeasonStats(p);
  for(const p of (G.overseas||[])) resetSeasonStats(p);
  /* K1 정규 라운드 — 팀 수에 따라 실제 K리그 방식을 따른다.
       12팀(2026): 3로빈 33R + 파이널 5R = 팀당 38경기
       14팀(2027~): 3라운드 로빈 39R, 스플릿 폐지 = 팀당 39경기 (실제 규정)
     ⚠ 제보 — 「2027 시즌부터 스플릿이 폐지되고 3라운드 로빈으로 바뀐다」. */
  if(k1N()>=14){
    /* 직전 시즌 순위대로 홈 20경기 우선권을 준다 (없으면 무작위) */
    let order=null;
    try{ order=(G.finalTbl && G.finalTbl.k1) ? G.finalTbl.k1.filter(id=>G.k1.indexOf(id)>=0) : null; }catch(e){ order=null; }
    if(!order || order.length<G.k1.length){
      const seen=new Set(order||[]);
      order=[...(order||[]), ...shuffled(G.k1.filter(id=>!seen.has(id)))];
    }
    G.k1Fix = buildTripleRobin(G.k1, order);                     // 3로빈 39R
    G.k1HomeOrder = order.slice();
  } else {
    const rr1 = roundRobin(shuffled(G.k1));                      // 2로빈 = 2(N-1)
    const rr1b = singleRobin(shuffled(G.k1));                    // 3번째 로빈 = N-1
    G.k1Fix = [...rr1, ...rr1b];
    G.k1HomeOrder = null;
  }
  G.k2Fix = roundRobin(shuffled(G.k2));      // 17팀 → 32R + 휴식, 총 32~34R
  G.r1=0; G.r2=0; G.phase="league"; G.splitDone=false; G.results=[]; G.poResults=[];
  if(!keepUser) G.userXI=null;
  // 스플릿(파이널 라운드 5경기)은 33R 이후에 붙는다 — 달력은 그만큼 넉넉히 잡아 둔다
  G.tac5=true;                       // 새 게임은 처음부터 5칸 눈금
  for(const id in G.teams) setupFinance(G.teams[id]);
  buildCalendar(Math.max(G.k1Fix.length, G.k2Fix.length)+splitRounds()+4);
  /* 📆 달력이 새로 깔리며 G.day 가 0 으로 돌아갔다 — 진행 중인 기한들을 같은 축으로 옮긴다 */
  try{ if(keepUser) rebaseDayFields(_oldDay); }catch(e){}
  runSeasonTicketSale();
  ensureTrainPlan();
  for(const id in G.teams){ const t=G.teams[id];
    // 새 시즌 — AI 팀은 프리시즌을 온전히 치렀다고 보고, 새로 부임한 감독의 팀만 조직력이 낮다
    t.fam = t.isUser ? FAM_START : 72+R(9);
    t._sig = tacticSig(t);
  }
}
/* ═══ 🧷 시즌을 넘어가도 감독의 판은 그대로 ═══════════════════════════
   새 시즌이 시작되면 선발 열한 명, 판 위의 자리(slot/zone), 자리별 세부 역할,
   벤치 편성, 전담 키커가 모두 지난 시즌 마지막 설정 그대로 유지된다.
   달라지는 건 딱 하나 — 팀을 떠난 선수(계약 만료·은퇴·이적·임대)뿐이다.
   그 자리는 비워 두고 감독에게 알린다. 남은 선수의 자리는 절대 건드리지 않는다. */
function carryUserTacticToNewSeason(){
  const t=userTeam(); if(!t || !t.isUser || !t.tactic) return;
  const T=t.tactic;
  const alive=new Set(t.players.map(p=>p.id));
  const nameOf={};                       // 떠난 선수 이름은 명단에서 지워지기 전에 못 받는다 — 로그로 대체
  const gone=[];
  /* 선발 — 남아 있는 선수는 순서까지 그대로 */
  if(Array.isArray(G.userXI) && G.userXI.length){
    const keep=[];
    for(const id of G.userXI){ if(alive.has(id)) keep.push(id); else gone.push(id); }
    G.userXI = keep.length ? keep : null;
  }
  /* 벤치 편성 — 직접 짠 명단이면 그대로 두고 떠난 선수만 뺀다 */
  if(Array.isArray(T.benchSel))  T.benchSel  = T.benchSel.filter(id=>alive.has(id));
  if(Array.isArray(T.benchExcl)) T.benchExcl = T.benchExcl.filter(id=>alive.has(id));
  /* 배치·역할 — pid 로 걸린 항목만 청소한다 (자리 이름으로 걸린 설정은 손대지 않는다) */
  for(const k of ["slot","zone","role","roleBy"]){
    const m=T[k];
    if(!m || typeof m!=="object" || Array.isArray(m)) continue;
    for(const key in m){ const n=+key; if(!isNaN(n) && key!=="" && !alive.has(n)) delete m[key]; }
  }
  /* 전담 키커 — 떠난 선수는 지우고, 순번은 앞으로 당긴다 */
  try{
    const K=kickersOf(t);
    for(const s of ["pk","fk","ck"]) if(Array.isArray(K[s])) K[s]=K[s].filter(id=>id&&alive.has(id));
    t.kickers=K; T.kickers=K;
  }catch(e){}
  if(gone.length){
    try{ notify(`🧷 지난 시즌 <b>선발·배치·세부 역할</b>을 그대로 이어받았습니다 — 팀을 떠난 <b>${gone.length}명</b>의 자리만 비었습니다.
      <span class="small">전술 화면에서 그 자리만 채우시면 됩니다.</span>`,"info"); }catch(e){}
  }
}
function shuffled(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=R(i+1);[b[i],b[j]]=[b[j],b[i]];} return b;}
/* 뉴스 분류 — cat "mood" 는 뉴스 피드가 아니라 '팀 분위기' 패널로 간다.
   이적·영입 소식 사이에 라커룸 잡담이 섞이면 정작 봐야 할 시장 소식이 묻힌다. */
/* fd: false = 뉴스 피드에 싣지 않음, 객체 = 피드 항목 필드 덮어쓰기 */
function addNews(txt, cls, cat, fd){
  G.news.unshift({s:G.season, r:G.r1, txt, cls, cat:cat||"club"}); G.news=G.news.slice(0,60);
  // 라커룸 잡담(mood)만 빼고 구단 소식은 통합 뉴스 피드에도 실린다
  if((cat||"club")!=="mood" && fd!==false)
    pushFeed(Object.assign({cat:"club", ic:"🏷️", head:txt, tone:0, tid:G.userTeamId, src:"구단 공식"}, fd||{}));
}
function addMood(txt, cls){ addNews(txt, cls, "mood"); }

/* ═══════════════════════════════════════════════════════════════
   뉴스 피드 (FM Inbox 스타일)
   리그는 우리 팀 경기장 밖에서도 굴러간다. 다른 구단이 대파당하고, 어린 선수가
   데뷔골을 넣고, 누군가는 5연패 끝에 경질된다. 그런 소식이 매일 쌓이는 곳.
═══════════════════════════════════════════════════════════════ */
const FEED_MAX=160;
const MEDIA=["스포츠경향","인터풋볼","풋볼리스트","베스트일레븐","스포탈코리아","엑스포츠뉴스","K리그 공식","OSEN 스포츠","일간스포츠"];
const NEWS_CAT={
  match:{n:"경기",   ic:"⚽", c:"#58a6ff"},
  star: {n:"선수",   ic:"🌟", c:"#d29922"},
  debut:{n:"데뷔",   ic:"🎬", c:"#a371f7"},
  streak:{n:"흐름",  ic:"🔥", c:"#f0883e"},
  table:{n:"순위",   ic:"🏆", c:"#3fb950"},
  injury:{n:"부상",  ic:"🚑", c:"#f85149"},
  transfer:{n:"이적",ic:"💸", c:"#56d364"},
  rumor:{n:"루머",   ic:"🗞️", c:"#8b949e"},
  manager:{n:"감독", ic:"🪑", c:"#e08c3a"},
  record:{n:"기록",  ic:"📊", c:"#79c0ff"},
  /* 📈 ⚠ 제보 원문 — 「뉴스 / 소셜 탭에서 '구단' 항목으로 주식 청약, 찌라시 관련 소식들이
     들어오는데 이것들이 딱히 구단 관련 일이라고 볼 수 없으므로 '주식' 항목을 새로 만들어서
     그 쪽에 주식 관련 소식을 몰아두는 것이 필요 할 것 같습니다」.
     원인 — 증시 계열은 전부 notify() 를 쓰는데, notify → addNews(txt) 는 분류를 안 넘기므로
       기본값 "club" 으로 떨어졌다. 증권 계좌 소식 전용 창구(notifyStk)를 따로 만든다. */
  stock:{n:"주식",   ic:"📈", c:"#f0883e"},
  /* 💰 ⚠ 제보 원문 — 「뉴슽탭 소셜탭 있잖아. 여기 옆에 경제 탭 신설하고 거기로 옮기는게 낫겠다.
     그게 더 가시성이 좋지」.
     원인 — 주식뿐 아니라 은행(예금 만기·연체·기준금리)과 부동산(임차인·재산세·경매)도
       전부 notify() 를 타서 「구단」에 섞여 있었다. 경제 계열을 셋으로 나눠 별도 탭으로 뺀다. */
  bank: {n:"은행",   ic:"🏦", c:"#4dd0b1"},
  realty:{n:"부동산",ic:"🏘️", c:"#d2a8ff"},
  club: {n:"구단",   ic:"🏷️", c:"#8b949e"}
};
/* 💰 경제 탭이 가져가는 분류 — 뉴스 탭은 이 셋을 빼고 보여 준다 */
const ECON_CATS=["stock","bank","realty"];
/* 📈 증권 계좌 소식 — 구단 뉴스가 아니라 「주식」으로 간다 (제보) */
function notifyStk(txt, cls){
  try{ addNews(txt, cls, "stock", {cat:"stock", ic:"📈", src:"증권가", tid:null}); }catch(e){}
  try{ flash(txt, cls||"info"); }catch(e){}
}
/* 🏦 은행 소식 — 예·적금 만기, 대출 연체·완납, 기준금리 (제보: 경제 탭으로) */
function notifyBank(txt, cls){
  try{ addNews(txt, cls, "bank", {cat:"bank", ic:"🏦", src:"금융권", tid:null}); }catch(e){}
  try{ flash(txt, cls||"info"); }catch(e){}
}
/* 🏘️ 부동산 소식 — 임차인, 시세, 재산세, 담보 (제보: 경제 탭으로) */
function notifyRealty(txt, cls){
  try{ addNews(txt, cls, "realty", {cat:"realty", ic:"🏘️", src:"부동산", tid:null}); }catch(e){}
  try{ flash(txt, cls||"info"); }catch(e){}
}
/* 외국인 선수 이름 — 동그라미 아이콘 대신 이름 자체를 밝은 보라색으로 칠한다.
   포메이션 카드처럼 좁은 자리에서 아이콘 한 글자가 이름을 잘라먹는 걸 막는다. */
function nmF(p){
  if(!p) return "";
  /* 📨 입영 통지를 받은 선수 — 아직 우리 팀에서 뛰지만 입소일이 잡혀 있다.
     라인업을 짤 때 「이 선수는 다음 달까지만 있다」가 한눈에 보여야 한다. */
  if(p.armyCall){
    const L=armyCallLeft(p);
    const d=dateOfDay(p.armyCall.at||0);
    return `<span class="lcCall" title="입영 통지 — ${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 김천 상무 FC 입소 (${ARMY_MONTHS}개월 복무) · 그때까지 이적·임대 불가">📨 ${p.name} <span class="small">D-${L}</span></span>`;
  }
  /* 🔁 임대 신분 — 외국인·홈그로운보다 앞세운다.
     ⚠ 제보 — 「임대해 온 선수도 이름 색을 다르게 하면 시즌 뒤 돌아갈 것을 미리 계산해
       스쿼드를 짜기 좋겠다」. 유저 구단뿐 아니라 AI 구단 명단에도 그대로 적용된다. */
  if(p.loan){
    const ow=(G && G.teams && G.teams[p.loan.own]) || null;
    const tip=`임대 선수 — 원소속 ${ow?ow.name:"타 구단"} · ${p.loan.half?"반 시즌":"시즌 종료까지"}`
            + (p.frn ? (p.hg?" · 홈그로운":" · 외국인") : "");
    return `<span class="loanN" title="${tip}">${p.name}</span>`;
  }
  if(p.hg) return `<span class="hgN" title="홈그로운 — 국내 유스 출신 외국 국적 선수. 외국인 쿼터를 차지하지 않습니다">${p.name}</span>`;
  return p.frn ? `<span class="frnN">${p.name}</span>` : p.name;
}
function feedList(){ if(!G.feed) G.feed=[]; return G.feed; }
function pushFeed(o){
  const L=feedList();
  const e=Object.assign({id:(G.feedSeq=(G.feedSeq||0)+1), d:G.day||0, s:G.season,
                         src:o.src||pick(MEDIA)}, o);
  e.head=fixJosa(e.head||"");
  if(e.sub) e.sub=fixJosa(e.sub);
  L.unshift(e);
  G.feed=L.slice(0, FEED_MAX);
  return e;
}
/* 우리 팀 기준 감정 톤 — 우리와 무관한 소식은 0 */
function feedTone(tid, good){ return tid===G.userTeamId ? (good?1:-1) : 0; }
/* AI 구단 감독 이름 — 경질 소식 같은 데 쓰인다 */
const MGR_SUR=["김","이","박","최","정","강","조","윤","장","임","한","오","신","서","권","황","안","송","전","홍"];
const POS_KO={GK:"골키퍼", DF:"수비수", MF:"미드필더", FW:"공격수"};
const MGR_GIV=["정우","상철","태호","현수","진규","도훈","성환","영민","경호","재훈","기석","용수","병수","학범","남일","두리","동원","성용","진섭","건하"];
/* ⚠ 제보 원문 — 「타구단 뉴스 중에 감독 경질인데 후임은 같은 이름의 감독대행 체제라고 내용에 뜹니다 ㅋㅋ」
   원인 — 이름을 구단 id·이름만으로 만들어 냈다. 경질하면서 t.mgr 을 비우고 다시 부르면
      같은 씨앗에서 같은 이름이 또 나온다 = 「김정우 감독 경질, 후임은 김정우 감독대행」.
   ─ 몇 번째 감독인지(_mgrGen)를 씨앗에 섞어, 새로 앉힐 때마다 다른 사람이 나오게 한다. */
function mgrName(t){
  if(t.isUser) return "감독님";
  if(!t.mgr){
    const gen=(t._mgrGen|0);
    const base=(t.id.length*7 + (t.name||"").charCodeAt(0)) + gen*7;
    const seed=((base % MGR_SUR.length)+MGR_SUR.length) % MGR_SUR.length;
    t.mgr = MGR_SUR[seed] + MGR_GIV[(seed*3+5+gen*11) % MGR_GIV.length];
  }
  return t.mgr;
}
/* 새 감독을 앉힌다 — 반드시 전임과 다른 이름이 나온다 */
function mgrRenew(t){
  const old=t.mgr || null;
  let guard=0;
  do{ t._mgrGen=(t._mgrGen|0)+1; t.mgr=null; }
  while(mgrName(t)===old && guard++<40);
  return t.mgr;
}
/* ── 경기 한 건에서 뽑아내는 소식 ─────────────────────────── */
/* 득점 기록이 없는 옛 리포트 — 경기 이벤트의 골 장면(scene)에서 복원한다 */
function scFromEvents(events){
  const out=[];
  for(const e of (events||[])){
    const sc=e && e.scene; if(!sc) continue;
    const k=String(sc.kind||"");
    if(k!=="sim_goal" && k!=="shot_goal" && k!=="pen_goal" && k!=="shot_owngoal") continue;
    const own=k==="shot_owngoal";
    const pid=own?sc.ogScorerId:(sc.scorerId!=null?sc.scorerId:sc.shooterId);
    if(pid==null) continue;
    const p=(typeof findAnyPlayer==="function")?findAnyPlayer(pid):null;
    out.push({n:p?p.name:"?", side:sc.atkSide||sc.side||"h", min:e.min||0, og:own?1:0, pen:k==="pen_goal"?1:0});
  }
  return out;
}
/* 스코어 아래에 붙는 득점자 줄 — 홈 왼쪽·원정 오른쪽, 같은 선수는 시간을 묶는다 (12' 45' 78') */
function scLineHtml(sc, h, a){
  if(!Array.isArray(sc) || !sc.length) return "";
  const gp=(side)=>{
    const m={};
    for(const g of sc){ if(g.side!==side) continue;
      const k=g.n+(g.og?" (자책)":""); (m[k]=m[k]||[]).push(`${g.min}'${g.pen?"(PK)":""}`); }
    return Object.entries(m).map(([n,ts])=>`${n} ${ts.join(" ")}${ts.length>=3?" <span class=\"tag star\">해트트릭</span>":""}`).join(", ");
  };
  const hs=gp("h"), as=gp("a");
  return `<div class="small" style="display:flex;justify-content:space-between;gap:10px;margin:-2px 0 6px;padding:0 4px">
    <span style="text-align:left">${hs?`⚽ ${hs}`:""}</span><span style="text-align:right">${as?`⚽ ${as}`:""}</span></div>`;
}
/* 한 경기에서 2골 이상 넣은 선수 — [{n, side, k}] */
function multiScorers(M){
  const m={};
  for(const g of (M.sc||[])){ if(g.og) continue; const key=g.side+"|"+g.n; m[key]=(m[key]||0)+1; }
  return Object.entries(m).filter(([k,v])=>v>=2)
    .map(([k,v])=>({side:k.split("|")[0], n:k.split("|")[1], k:v}))
    .sort((x,y)=>y.k-x.k);
}
function matchNews(M, div, rnd){
  if(!M || (M.opts&&(M.opts.friendly||M.opts.noTable))) return;
  const h=M.home, a=M.away, hg=M.hg, ag=M.ag;
  const rd=`${rnd}라운드`, dv=divName(div);
  const win = hg>ag?h : ag>hg?a : null;
  const los = hg>ag?a : ag>hg?h : null;
  const wg=Math.max(hg,ag), lg=Math.min(hg,ag), mg=wg-lg;
  const score=`${hg}-${ag}`;
  const mine = h.isUser||a.isUser;
  const out=[];   // 이 경기에서 나온 소식들

  /* 🏅 MAN OF THE MATCH — 오늘 경기의 주인공 */
  try{
    const mm=M.mom;
    if(mm){
      const mt=G.teams[mm.teamId]||{short:mm.team};
      const line=[]; if(mm.goals) line.push(`${mm.goals}골`); if(mm.assists) line.push(`${mm.assists}도움`);
      const detail=line.length?line.join(" ")+" · ":"";
      if(mm.isUser){
        addNews(`🏅 <b>${mm.name}</b>, ${rd} MOM 선정 — ${detail}평점 <b>${mm.rating.toFixed(2)}</b>`, "good", "club");
        socialFill(MOM_SOC.our, 2+R(2), 1, {p:mm.name, t:mt.short, r:mm.rating.toFixed(2)});
        if(mm.rating>=8.6 || mm.goals>=2) fmkFill(MOM_FMK.big, 1+R(2), {p:mm.name, t:mt.short, r:mm.rating.toFixed(2)});
        /* 🔥 이성을 놓는 날 — 평점 9.0 이상이거나 3골 이상. 여기서만 광신 반응이 나온다 */
        if(mm.rating>=9.0 || mm.goals>=3) fmkFill(MOM_FMK.hype, 2+R(2), {p:mm.name, t:mt.short, r:mm.rating.toFixed(2)});
        try{
          const pl=(userTeam().players||[]).find(x=>x.id===mm.id);
          if(pl){ pl.morale=clamp((pl.morale||70)+3,30,99); affAdd(pl, 2, "MOM 선정"); }
        }catch(e){}
      } else if(mine){
        /* 우리 경기인데 상대 선수가 MOM — 팬들은 그것대로 할 말이 있다 */
        addNews(`🏅 ${rd} MOM — <b>${mm.name}</b> (${mt.short}) · 평점 ${mm.rating.toFixed(2)}${mm.goals?` · ${mm.goals}골`:""}`, "info", "club");
        socialFill(MOM_SOC.opp, 1+R(2), -1, {p:mm.name, t:mt.short, r:mm.rating.toFixed(2)});
      }
      out.push({cat:"star", ic:"🏅", tone:feedTone(mm.teamId,true), tid:mm.teamId,
        head:`${mm.name}, ${dv} ${rd} MOM`,
        sub:`${h.short} ${score} ${a.short} — ${detail}평점 ${mm.rating.toFixed(2)}로 경기 최우수 선수에 뽑혔다.`});
    }
  }catch(e){}

  /* ⚽ 해트트릭·멀티골 — 리그 어느 경기든 사람이 헤드라인이 되는 순간 */
  try{
    for(const ms of multiScorers(M)){
      const mt=ms.side==="h"?h:a;
      if(ms.k>=3){
        out.push({cat:"star", ic:"👑", tone:feedTone(mt.id,true), tid:mt.id,
          head:`${ms.n}, 해트트릭 대활약 — ${mt.short} ${score} ${ms.side==="h"?"승리 견인":"원정 폭격"}`,
          sub:`${dv} ${rd} · ${h.short} ${score} ${a.short} — ${ms.n}이(가) 혼자 ${ms.k}골을 몰아치며 경기를 끝냈다.`});
        if(mt.isUser){
          socialFill(SOC.hatOur, 4+R(3), 1, {p:ms.n, t:mt.short});
          fmkFill(FMK.hatOur, 3+R(2), {p:ms.n, t:mt.short});
          try{ rivalFill(RIV.hatRiv, 2+R(2), -1, {p:ms.n, t:mt.short}); }catch(e){}
        } else if(G.jobless){
          pushSocial(F_(pick(["{p} 해트트릭 실화냐 ㅋㅋ 오늘 리그 주인공은 정해졌다","{p} 3골 몰아치기 봤냐. 이런 날 직관한 사람이 승자다"]), {p:ms.n}), 1);
        }
      } else if(mt.isUser || ms.k>=2 && Math.random()<0.35){
        out.push({cat:"star", ic:"⚽", tone:feedTone(mt.id,true), tid:mt.id,
          head:`${ms.n}, 멀티골 폭발 — ${mt.short} 공격을 홀로 이끌다`,
          sub:`${dv} ${rd} · ${h.short} ${score} ${a.short} — ${ms.n}이(가) 두 골을 책임졌다.`});
        if(mt.isUser){ socialFill(SOC.multiOur, 2+R(2), 1, {p:ms.n, t:mt.short}); fmkFill(FMK.multiOur, 2, {p:ms.n, t:mt.short}); }
      }
    }
  }catch(e){}

  /* 관중 — 기사에 늘 따라붙는 한 줄 */
  const att=M.att||0;
  const stn=stadOf(h).n;
  const attLine = att ? ` · ${stn} 관중 ${att.toLocaleString()}명${isSellout(h,att)?" (매진)":""}` : "";
  const whereWin = win ? (win===h ? "홈에서" : "원정에서") : "";
  /* 1. 스코어라인 */
  if(win && mg>=4){
    out.push({cat:"match", ic:"💥", tone:feedTone(win.id,true),
      head:`${win.name}, ${whereWin} ${los.short}을/를 ${wg}-${lg}로 완파`, tid:win.id,
      sub:`${dv} ${rd} · ${h.short} ${score} ${a.short}${attLine} — ${win.short}이/가 전반부터 경기를 지배하며 대량 득점에 성공했다.`});
  } else if(win && mg===3){
    out.push({cat:"match", ic:"⚽", tone:feedTone(win.id,true),
      head:`${win.name}, ${whereWin} ${los.short} 상대 ${wg}-${lg} 완승`, tid:win.id,
      sub:`${dv} ${rd} · ${h.short} ${score} ${a.short}${attLine}`});
  } else if(!win && hg>=3){
    out.push({cat:"match", ic:"🔁", tone:0,
      head:`난타전 끝 ${score}… ${h.short}-${a.short} 승부 못 가려`, tid:h.id,
      sub:`${dv} ${rd} · 양 팀 합계 ${hg+ag}골이 터진 경기였다.`});
  } else if(!win && hg===0){
    if(Math.random()<0.35) out.push({cat:"match", ic:"🥱", tone:0,
      head:`${h.short}-${a.short} 0-0… 답답한 무득점 무승부`, tid:h.id,
      sub:`${dv} ${rd} · 양 팀 모두 결정적인 장면을 만들지 못했다.`});
  }
  /* 2. 이변 — 순위가 한참 아래인 팀이 위를 잡았을 때 */
  if(win && los){
    const tb=tableOf(div);
    const wp=tb.findIndex(x=>x.id===win.id)+1, lp=tb.findIndex(x=>x.id===los.id)+1;
    if(wp-lp>=6 && rnd>=4){
      out.push({cat:"match", ic:"😱", tone:feedTone(win.id,true),
        head:`이변! ${lp}위 ${los.short}, ${wp}위 ${win.short}에게 ${whereWin==="홈에서"?"안방을 내주며 ":""}${lg}-${wg} 발목`, tid:win.id,
        sub:`${dv} ${rd}${attLine} · 순위표를 뒤엎는 결과가 나왔다. ${los.short} 벤치는 할 말을 잃은 표정이었다.`});
    }
  }
  /* 관중 자체가 기사가 되는 날 */
  if(att){
    const sdh=stadOf(h);
    if(isSellout(h, att) && Math.random()<0.7){
      out.push({cat:"record", ic:"🎟️", tone:feedTone(h.id,true), tid:h.id,
        head:`${stn} 매진! ${h.short}-${a.short}전에 ${att.toLocaleString()}명 운집`,
        sub:`${dv} ${rd} · 올 시즌 ${h.short} 홈경기 최다 관중이 들어찼다.`});
    } else if(att>=sdh.avg*1.55 && Math.random()<0.35){
      out.push({cat:"record", ic:"📈", tone:feedTone(h.id,true), tid:h.id,
        head:`${h.short} 홈에 ${att.toLocaleString()}명… 평균의 1.5배`,
        sub:`${dv} ${rd} · ${stn}이/가 오랜만에 시끄러웠다.`});
    } else if(att<=sdh.avg*0.55 && Math.random()<0.30){
      out.push({cat:"record", ic:"🪑", tone:feedTone(h.id,false), tid:h.id,
        head:`${stn} 관중 ${att.toLocaleString()}명… 텅 빈 관중석`,
        sub:`${dv} ${rd} · ${h.short}은/는 흥행에서도 고전하고 있다.`});
    }
  }
  /* 3. 개인 기록 */
  for(const sd of [M.h, M.a]){
    const t=sd.team, opp = sd===M.h ? a : h;
    for(const x of sd.list){
      const p=x.p; if(!p) continue;
      const age=G.season-p.by;
      if(x.goals>=4){
        out.push({cat:"star", ic:"🎆", tone:feedTone(t.id,true),
          head:`${p.name} 혼자 ${x.goals}골! ${t.short} ${opp.short}전 초토화`, tid:t.id,
          sub:`${dv} ${rd} · 시즌 ${p.goals}호골. K리그 역사에 남을 만한 하루였다.`});
      } else if(x.goals===3){
        out.push({cat:"star", ic:"🎩", tone:feedTone(t.id,true),
          head:`${p.name} 해트트릭! ${t.short}, ${opp.short} 제압`, tid:t.id,
          sub:`${dv} ${rd} · ${p.name}(${age}세)이/가 세 골을 몰아치며 시즌 ${p.goals}호골 고지에 올랐다.`});
      } else if(x.goals===2 && Math.random()<0.5){
        out.push({cat:"star", ic:"⚡", tone:feedTone(t.id,true),
          head:`${p.name} 멀티골, ${t.short}의 해결사로`, tid:t.id,
          sub:`${dv} ${rd} · 시즌 ${p.goals}골 ${p.assists}도움.`});
      } else if(x.goals>=1 && p.career===1){
        out.push({cat:"debut", ic:"🎬", tone:feedTone(t.id,true),
          head:`데뷔전에서 데뷔골! ${t.short} ${p.name}, 강렬한 첫인상`, tid:t.id,
          sub:`${dv} ${rd} · ${age}세 ${POS_KO[p.pos]||p.pos}이/가 프로 첫 경기에서 곧바로 골망을 흔들었다.`});
      } else if(p.career===1){
        out.push({cat:"debut", ic:"🌱", tone:0,
          head:`${t.short}, ${age}세 ${p.name} ${dv} 데뷔전`, tid:t.id,
          sub:`${rd} ${opp.short}전에서 프로 데뷔. ${t.short}이/가 유망주에게 기회를 줬다.`});
      } else if(p.career>=100 && p.career%100===0 && Math.random()<(p.career>=300?0.35:0.12)){
        out.push({cat:"record", ic:"🏅", tone:feedTone(t.id,true),
          head:`${p.name}, K리그 통산 ${p.career}경기 출장`, tid:t.id,
          sub:`${dv} ${rd} ${opp.short}전에서 개인 통산 ${p.career}번째 경기를 치렀다.`});
      } else if(x.assists>=3){
        out.push({cat:"star", ic:"🅰️", tone:feedTone(t.id,true),
          head:`${p.name}, 한 경기 ${x.assists}도움 폭발`, tid:t.id,
          sub:`${dv} ${rd} · 시즌 ${p.assists}도움째.`});
      }
      if(x.red && Math.random()<0.6){
        out.push({cat:"match", ic:"🟥", tone:feedTone(t.id,false),
          head:`${t.short} ${p.name} 퇴장… ${opp.short}전 수적 열세`, tid:t.id,
          sub:`${dv} ${rd} · 다음 경기 출장이 정지된다.`});
      }
      // 무실점 완승을 지킨 골키퍼 — 가끔 조명한다
      if(p.pos==="GK" && x.on===0 && x.off===null && (sd===M.h?ag:hg)===0 && (sd===M.h?hg:ag)>=2 && Math.random()<0.10){
        out.push({cat:"record", ic:"🧤", tone:feedTone(t.id,true),
          head:`${p.name} 무실점 방어, ${t.short} ${opp.short}전 완승`, tid:t.id,
          sub:`${dv} ${rd} · 뒷문을 완전히 잠갔다. 시즌 평점 ${(p.seasonRating||0).toFixed(2)}.`});
      }
    }
  }
  // 우리 경기는 이미 리포트·SNS로 충분히 다뤄지므로 최대 2건, 남의 경기는 최대 2건만 싣는다
  const lim = mine?2:2;
  shuffled(out).slice(0, lim).forEach(pushFeed);
}
/* ── 라운드가 끝난 뒤 리그 전체를 훑는 소식 ────────────────── */
function leagueNews(div, rnd){
  const tb=tableOf(div), dv=divName(div);
  const total=(div===1?G.k1Fix:G.k2Fix).length;
  if(rnd<2) return;
  /* 선두 변동 */
  const key = div===1?"_lead1":"_lead2";
  const lead=tb[0];
  if(G[key] && G[key]!==lead.id){
    const prev=G.teams[G[key]];
    pushFeed({cat:"table", ic:"👑", tone:feedTone(lead.id,true), tid:lead.id,
      head:`${lead.name}, ${prev?prev.short+"을/를 끌어내리고 ":""}${dv} 선두 등극`,
      sub:`${rnd}라운드 종료 시점 ${lead.Pts}점 (${lead.W}승 ${lead.Dw}무 ${lead.L}패)`});
  }
  G[key]=lead.id;
  /* 연승·연패 */
  for(const t of tb){
    const f=t.form;
    const wStreak=(()=>{let n=0;for(let i=f.length-1;i>=0&&f[i]==="W";i--)n++;return n;})();
    const lStreak=(()=>{let n=0;for(let i=f.length-1;i>=0&&f[i]==="L";i--)n++;return n;})();
    const uStreak=(()=>{let n=0;for(let i=f.length-1;i>=0&&f[i]!=="L";i--)n++;return n;})();
    if(wStreak>=4 && wStreak%2===0)
      pushFeed({cat:"streak", ic:"🚀", tone:feedTone(t.id,true), tid:t.id,
        head:`${t.name} ${wStreak}연승 질주`, sub:`${dv} ${rnd}라운드 현재 ${tb.findIndex(x=>x.id===t.id)+1}위 · 승점 ${t.Pts}`});
    else if(lStreak>=4 && lStreak%2===0)
      pushFeed({cat:"streak", ic:"🧊", tone:feedTone(t.id,false), tid:t.id,
        head:`${t.name} ${lStreak}연패 수렁`, sub:`${mgrName(t)} 감독의 입지가 흔들리고 있다.`});
    else if(uStreak>=8 && uStreak%4===0)
      pushFeed({cat:"streak", ic:"🛡️", tone:feedTone(t.id,true), tid:t.id,
        head:`${t.name}, ${uStreak}경기 무패 행진`, sub:`${dv}에서 가장 지지 않는 팀이 됐다.`});
  }
  /* 강등권 / 우승 경쟁 */
  if(rnd>=Math.floor(total*0.55) && rnd%4===0){
    const bot=tb[tb.length-1];
    pushFeed({cat:"table", ic:"⚠️", tone:feedTone(bot.id,false), tid:bot.id,
      head:`${bot.name}, ${dv} 최하위… 남은 ${total-rnd}경기`,
      sub:`승점 ${bot.Pts}. ${tb[tb.length-2].short}와/과 ${tb[tb.length-2].Pts-bot.Pts}점 차.`});
    if(tb[0].Pts-tb[1].Pts<=2)
      pushFeed({cat:"table", ic:"🥊", tone:0, tid:tb[0].id,
        head:`${tb[0].short}-${tb[1].short} 승점 ${tb[0].Pts-tb[1].Pts}점 차 초접전`,
        sub:`${dv} 우승 경쟁이 끝까지 갈 분위기다.`});
  }
  /* 득점왕 레이스 */
  if(rnd%5===0){
    const ids=div===1?G.k1:G.k2;
    const all=[];
    for(const id of ids) for(const p of G.teams[id].players) if(p.goals>0) all.push({p,t:G.teams[id]});
    all.sort((x,y)=>y.p.goals-x.p.goals);
    if(all.length && all[0].p.goals>=4){
      const top=all[0], nx=all[1];
      pushFeed({cat:"record", ic:"📊", tone:feedTone(top.t.id,true), tid:top.t.id,
        head:`${dv} 득점 선두 ${top.p.name}(${top.t.short}) ${top.p.goals}골`,
        sub: nx?`2위 ${nx.p.name}(${nx.t.short}) ${nx.p.goals}골 · ${rnd}라운드 종료 기준`:`${rnd}라운드 종료 기준`});
    }
  }
  /* AI 구단 감독 경질 — 성적이 무너지면 남의 집에도 칼바람이 분다 */
  if(rnd>=8) for(const t of tb){
    if(t.isUser || t._sacked>rnd-10) continue;
    const last6=t.form.slice(-6), bad=last6.filter(f=>f==="L").length;
    const pos=tb.findIndex(x=>x.id===t.id)+1;
    if(last6.length>=6 && bad>=5 && pos>=tb.length-3 && Math.random()<0.30){
      const old=mgrName(t); t._sacked=rnd;
      const nu=mgrRenew(t);                     // ⚠ 제보 — 후임이 전임과 같은 이름으로 나오던 자리
      pushFeed({cat:"manager", ic:"🪑", tone:0, tid:t.id,
        head:`${t.name}, ${old} 감독 경질`,
        sub:`최근 6경기 ${bad}패. 구단은 "성적 부진에 따른 불가피한 결정"이라고 밝혔다. 당분간 ${nu} 수석코치가 감독대행을 맡는다.`});
    }
  }
}
/* 루머를 뉴스 피드에도 태운다 */
function rumorToFeed(r){
  if(!r) return;
  const tr=rumorTrust(r);
  pushFeed({cat:"rumor", ic:r.ric||"🗞️", tone:0, tid:r.fromId||r.toId||null,
    head:r.txt, src:`${r.rep} 기자 · ${r.ro}`, sub:`신빙성: ${tr.t}`, truth:r.truth});
}
/* ⚔️ ⚠ 제보 원문 — 「내가 원하는 전술창은 일반 리그 경기 중 전술 수정 창하고 똑같아야하는데,
   그게 아니네? 온라인 매칭도 경기중 전술 수정창이 리그에서의 경기중 전술 수정창과 동일하게
   만들어줘」.
   온라인 대전은 양 팀 모두 「클론」으로 뛴다(세이브 격리). 그래서 리그 전술판이 보는
   userTeam() 이 대전에서는 엉뚱한 팀을 가리켰다 — 그 한 줄 때문에 별도 패널을 따로 만들었던 것이다.
   ─ 전술판이 열려 있는 동안만 「지금 다루는 팀」을 갈아 끼운다. 화면이 닫히면 곧바로 되돌린다. */
let PVP_TAC_TEAM=null;
function userTeam(){ return PVP_TAC_TEAM || G.teams[G.userTeamId]; }
/* 경기 중 전술판이 다루는 쪽 — 온라인 대전에서는 언제나 「내 팀 = h」로 맞춰 둔다
   (호스트는 실제 경기의 홈, 게스트는 아래에서 만드는 그림자 경기의 홈) */
function liveMyKey(M){
  try{ if(M && M.opts && M.opts.pvp) return "h"; }catch(e){}
  return (M && M.home && M.home.isUser) ? "h" : "a";
}
/* ⚠ 제보 — 「시즌이 끝난 뒤 골·도움·관중 순위를 보면 승격 이후 기준으로 나온다.
      전남이 우승해서 승격했는데 K리그1 득점 순위에 전남 선수가 있다.」
   순위표(tableOf)에는 「그 시즌을 치른 구성」 스냅샷이 있었는데, 득점·도움·관중 카드는
   현재 소속(G.k1/G.k2)을 그대로 읽고 있었다. 한 창구로 모은다. */
function seasonDivIds(div){
  try{
    if(G.finalTbl && G.finalTbl.s===G.season && (G.phase==="seasonEnd" || G.phase==="po"))
      return (div===1 ? G.finalTbl.k1 : G.finalTbl.k2) || [];
  }catch(e){}
  return (div===1 ? G.k1 : G.k2) || [];
}
function tableOf(div){
  /* 시즌이 끝난 뒤에는 「그 시즌을 치른 구성」으로 보여 준다 — 승강이 이미 반영된 새 구성이 아니라.
     새 시즌이 시작되면(G.season 증가) 스냅샷은 자동으로 무효가 된다. */
  const ids=seasonDivIds(div);
  const list=(ids||[]).map(id=>G.teams[id]).filter(Boolean);
  /* 🏆 ⚠ 제보 — 「파이널 A 최하위가 파이널 B 상위 팀보다 승점이 낮으면 순위가 뒤로 밀린다」.
     K리그 규정상 스플릿이 갈린 뒤에는 파이널 A 6팀이 승점과 무관하게 1~6위,
     파이널 B 6팀이 7~12위다. 그래서 파이널 A 최하위는 파이널 B 1위보다 승점이 적어도 6위다.
     ─ 스플릿이 확정된 뒤에는 그룹을 1차 기준으로 두고, 그 안에서 승점·득실을 따진다. */
  /* ⚠ splitOn() 가드가 빠져 있었다 — 스플릿이 폐지된 14팀 시즌인데도 옛 세이브에 남아 있던
     finalA 명단이 순위표를 강제로 갈라, 승점이 낮은 팀이 위에 붙는 일이 생길 수 있었다. */
  const A = (div===1 && G.splitDone && splitOn() && Array.isArray(G.finalA) && G.finalA.length) ? new Set(G.finalA) : null;
  return list.sort((a,b)=>
      (A ? ((A.has(b.id)?1:0)-(A.has(a.id)?1:0)) : 0)
      || b.Pts-a.Pts || (b.GF-b.GA)-(a.GF-a.GA) || b.GF-a.GF);
}
/* ── ⏳ 출장정지·부상 차감 ────────────────────────────────────
   ⚠ 제보 — 프리시즌에서 퇴장·부상을 당하면 영원히 풀리지 않았다. 차감이 completeRound
     (정규 라운드 종료) 안에만 있었기 때문이다. 연습경기도 하루 넘김도 이 루프를 못 탔다.
   이제 두 갈래로 돈다.
     · ban(경기 단위) — 정규 라운드가 끝날 때 + 연습경기를 치를 때
     · inj(주 단위)   — 정규 라운드가 끝날 때 + 프리시즌은 7일마다
   banNew 는 "징계는 다음 경기부터"를 위한 한 번짜리 유예다. 연습경기에서도 똑같이 소모된다 —
   그렇지 않으면 프리시즌 퇴장이 개막 후 한 경기를 더 쉬게 만든다. */
/* 🚑 부상 회복은 「날짜」로 흐른다.
   ⚠ 제보 — "1주 남은 선수가 13일이 지나도 안 풀린다".
      예전에는 부상 잔여(주)를 라운드를 치를 때만 깎았다. 그래서 휴식기·이적시장처럼 경기가
      없는 기간에는 달력이 아무리 흘러도 회복이 멈춰 있었다(프리시즌만 7일마다 예외 처리).
   ─ 이제 부상이 생기는 순간 「회복 예정일(injUntil)」을 잡고, 하루가 지날 때마다 그 날짜를 본다.
     남은 주(p.inj)는 화면 표시용으로 날짜에서 역산한다. 출장정지(ban)는 경기 수가 맞으므로 그대로 둔다. */
function injWeeksLeft(p){
  if(!p) return 0;
  if(p.injUntil!=null) return Math.max(0, Math.ceil((p.injUntil-(G.day||0))/7));
  return p.inj||0;
}
const INJ_BACK_W=2;   // 이 주수 이상 이탈했던 선수가 돌아오면 감독에게 따로 알린다
/* ═══ 🚑 부상 유형·원인 ═══════════════════════════════════════════════════
   ⚠ 요청 원문 — 「부상도 FM처럼 다양하게 만들고 다양한 이유도 만들자. 배선도 정확하게 하고」.

   지금까지 부상은 「주수」 하나였다. 1+R(4) 로 숫자만 뽑았을 뿐, 어디를 어떻게 다쳤는지가
   아예 없었다. 그래서 뉴스도 소견서도 「부상 3주」 말고는 할 말이 없었다.

   ─ 유형(INJ_TYPE) 17종 · 원인(INJ_CAUSE) 10종을 두고, 부상이 생기는 자리 일곱 군데를
     전부 mkInjury() 한 창구로 모은다(배선). 원인이 유형의 가중치를 정하고,
     나이·체력·태클 강도가 「가벼운 쪽 / 무거운 쪽」을 민다.
   ─ 유형마다 가능한 처치가 다르다 — 골절·인대 파열에 진통제를 물리는 건 말이 안 되고,
     근육 뭉침을 수술하지도 않는다.
   ─ 같은 부위를 반복해 다치면 그 부위가 다시 다칠 확률이 오르고 회복도 길어진다.

   grp: 계열 — bruise 타박 · muscle 근육 · lig 인대 · bone 골절 · misc 기타
   w:   [최소, 최대] 주 · part: 부위(재발 판정 키) · pain/surg/push: 가능한 처치 */
const INJ_TYPE={
  bruise:{n:"타박상",          ic:"🤕", grp:"bruise", part:"leg",   w:[1,1],  pain:1, surg:0, push:0},
  knock: {n:"근육 뭉침",        ic:"🦵", grp:"muscle", part:"leg",   w:[1,1],  pain:1, surg:0, push:1},
  back:  {n:"요통",            ic:"🦴", grp:"misc",   part:"back",  w:[1,3],  pain:1, surg:0, push:1},
  groin: {n:"서혜부 통증",      ic:"🦵", grp:"muscle", part:"groin", w:[2,3],  pain:1, surg:0, push:1},
  calf:  {n:"종아리 근육 손상",  ic:"🦵", grp:"muscle", part:"calf",  w:[2,4],  pain:0, surg:0, push:1},
  ham:   {n:"햄스트링 염좌",     ic:"🦵", grp:"muscle", part:"ham",   w:[2,4],  pain:0, surg:0, push:1},
  hamT:  {n:"햄스트링 파열",     ic:"🦵", grp:"muscle", part:"ham",   w:[6,10], pain:0, surg:1, push:1},
  ankle: {n:"발목 염좌",        ic:"🦶", grp:"lig",    part:"ankle", w:[2,5],  pain:1, surg:0, push:1},
  ankleT:{n:"발목 인대 파열",    ic:"🦶", grp:"lig",    part:"ankle", w:[8,14], pain:0, surg:1, push:0},
  knee:  {n:"무릎 인대 손상",    ic:"🦿", grp:"lig",    part:"knee",  w:[6,12], pain:0, surg:1, push:0},
  acl:   {n:"십자인대 파열",     ic:"🦿", grp:"lig",    part:"knee",  w:[26,38],pain:0, surg:1, push:0},
  meta:  {n:"중족골 골절",       ic:"🦴", grp:"bone",   part:"foot",  w:[8,13], pain:0, surg:1, push:0},
  rib:   {n:"갈비뼈 골절",       ic:"🦴", grp:"bone",   part:"rib",   w:[4,7],  pain:0, surg:1, push:0},
  shoul: {n:"어깨 탈구",        ic:"💪", grp:"bone",   part:"shoul", w:[3,6],  pain:0, surg:1, push:1},
  head:  {n:"뇌진탕",           ic:"🤯", grp:"misc",   part:"head",  w:[1,3],  pain:0, surg:0, push:0},
  ill:   {n:"몸살",             ic:"🤒", grp:"misc",   part:"body",  w:[1,2],  pain:1, surg:0, push:1},
  fati:  {n:"피로 누적",         ic:"😮‍💨", grp:"misc",  part:"body",  w:[1,2],  pain:1, surg:0, push:1}
};
const INJ_PART_N={leg:"다리", ham:"허벅지 뒤", calf:"종아리", groin:"사타구니", ankle:"발목",
  knee:"무릎", foot:"발", rib:"갈비", shoul:"어깨", head:"머리", back:"허리", body:"몸"};
/* 원인 — 어디서 어떻게 다쳤는가. tell 은 문장에 그대로 들어간다. */
const INJ_CAUSE={
  slide:  {tell:"슬라이딩 태클에 걸려",     ic:"🦵"},
  tackle: {tell:"거친 몸싸움 중",           ic:"💥"},
  sprint: {tell:"전력 질주 도중",           ic:"💨"},
  land:   {tell:"착지하다",                ic:"🪂"},
  clash:  {tell:"공중볼 경합 중 충돌로",     ic:"🤜"},
  overuse:{tell:"누적된 피로로",            ic:"😮‍💨"},
  train:  {tell:"훈련 중",                 ic:"🏋️"},
  warm:   {tell:"몸을 푸는 도중",           ic:"🧘"},
  solo:   {tell:"상대 없이 혼자 넘어지며",   ic:"🌀"},
  relapse:{tell:"복귀 직후 같은 자리가",     ic:"🔁"},
  off:    {tell:"경기 밖에서",              ic:"🚨"}
};
/* 원인별 유형 가중치 — 이 표가 「무엇을 다치는가」를 정한다 */
const INJ_POOL={
  slide:  {ankle:26, bruise:20, knee:12, meta:10, ankleT:7, calf:6, shoul:4, knock:9, acl:1},
  tackle: {bruise:28, knock:16, ankle:14, rib:9, shoul:8, knee:7, head:5, meta:5, ankleT:3},
  sprint: {ham:34, calf:20, groin:14, knock:12, hamT:9, back:6, acl:3},
  land:   {ankle:26, knee:18, shoul:14, back:12, meta:10, bruise:10, acl:4},
  clash:  {head:26, rib:18, bruise:20, shoul:14, knock:8, ankle:8, meta:4},
  overuse:{knock:24, ham:18, calf:16, back:12, groin:11, fati:10, hamT:5, ill:4},
  train:  {knock:26, ham:16, ankle:12, groin:10, calf:10, bruise:10, back:8, hamT:3, knee:2},
  warm:   {knock:30, ham:22, calf:16, groin:14, back:10, hamT:5},
  solo:   {ham:22, knee:16, ankle:14, calf:12, groin:10, acl:9, back:8, hamT:6},
  relapse:{ham:22, calf:14, groin:10, ankle:14, knee:12, hamT:10, ankleT:8, meta:5, back:5},
  off:    {bruise:44, knock:22, head:12, ankle:10, rib:8, shoul:4}
};
function injType(k){ return INJ_TYPE[k]||INJ_TYPE.knock; }
/* 주수만 알 때 붙일 그럴듯한 진단 — 구세이브 백필과 에디터가 함께 쓴다 */
function injTypeForWeeks(w){
  for(const k in INJ_TYPE){ const T=INJ_TYPE[k]; if(w>=T.w[0] && w<=T.w[1]) return k; }
  return (w>=26) ? "acl" : (w>=15 ? "ankleT" : "knock");
}
function injTypeOf(p){ return p && p.injT ? injType(p.injT) : null; }
function injTypeName(p){ const T=injTypeOf(p); return T?T.n:"부상"; }
/* 🔁 그 부위를 몇 번이나 다쳤는가 — 최근 이력에서 센다 */
function injPartCount(p, part){
  try{ return (p.injLog||[]).filter(x=>x && x.part===part).length; }catch(e){ return 0; }
}
/* ═══ 부상 한 건을 만든다 — 부상이 생기는 자리는 전부 여기를 지난다 ═══
   ctx = {cause, hard, fit, age, heavy}   heavy: 무거운 쪽으로 미는 추가 가중(0~1) */
function mkInjury(p, ctx){
  ctx=ctx||{};
  const cause=INJ_CAUSE[ctx.cause]?ctx.cause:"overuse";
  const pool=INJ_POOL[cause]||INJ_POOL.overuse;
  const age=ctx.age!=null?ctx.age:(G.season-(p&&p.by||2000));
  const fit=ctx.fit!=null?ctx.fit:90;
  /* 무거운 부상으로 기우는 정도 — 나이·바닥난 체력·거친 태클이 민다 */
  let heavy=clamp((ctx.heavy||0) + clamp((age-27)/14,0,0.35) + clamp((70-fit)/70,0,0.35)
                  + (ctx.hard?0.22:0), 0, 0.9);
  /* 같은 부위를 반복해 다친 선수는 그 부위가 또, 그리고 더 크게 다친다 (요청) */
  const w={}; let tot=0;
  for(const k in pool){
    const T=INJ_TYPE[k]; if(!T) continue;
    let v=pool[k];
    const midW=(T.w[0]+T.w[1])/2;
    v *= (midW>=6) ? (0.55+heavy*1.9) : (1.25-heavy*0.45);   // 큰 부상은 heavy 가 밀어 올린다
    const rep=injPartCount(p, T.part);
    if(rep>0) v *= 1 + Math.min(rep,3)*0.55;                  // 🔁 재발 — 그 부위가 다시 걸린다
    if(v>0){ w[k]=v; tot+=v; }
  }
  let key="knock", r=Math.random()*tot;
  for(const k in w){ r-=w[k]; if(r<=0){ key=k; break; } }
  const T=INJ_TYPE[key];
  /* 주수 — 유형 범위 안에서, 무거운 쪽일수록 위로 */
  const span=T.w[1]-T.w[0];
  let wk=T.w[0]+Math.round(span*clamp(Math.random()*0.75+heavy*0.45, 0, 1));
  const rep=injPartCount(p, T.part);
  if(rep>0) wk=Math.round(wk*(1+Math.min(rep,3)*0.14));       // 🔁 반복 부위는 더 오래 걸린다
  wk=Math.max(1, wk);
  p.injT=key; p.injC=cause;
  setInjury(p, wk);                       // 팀 닥터 보정(acDocInjK)은 여기서 걸린다
  /* 이력 — 최근 5건 */
  try{
    p.injLog=Array.isArray(p.injLog)?p.injLog:[];
    p.injLog.unshift({k:key, part:T.part, c:cause, w:injWeeksLeft(p), s:G.season, d:G.day||0});
    p.injLog=p.injLog.slice(0,5);
  }catch(e){}
  try{ injNews(p); }catch(e){}
  return {key, T, cause, weeks:injWeeksLeft(p), rep};
}
/* 🚑 부상 기사 — 내 팀 선수가 다치면 유형·원인이 담긴 한 건을 남긴다 (요청) */
function injNews(p){
  try{
    const t=userTeam(); if(!t || !isOurPlayer(p)) return;
    const T=injTypeOf(p), C=INJ_CAUSE[p.injC]; if(!T) return;
    const w=injWeeksLeft(p);
    const rep0=injPartCount(p, T.part);
    addNews(`🚑 <b>${p.name}</b>, ${C?C.tell+" ":""}${T.ic} <b>${T.n}</b> — 전치 <b>${w}주</b>`
      + (rep0>=2?` <span class="small" style="color:var(--gold)">(${INJ_PART_N[T.part]||""} ${rep0}회째)</span>`:""),
      w>=6?"warn":null, "club");
    if(w>=6) pushFeed({cat:"injury", ic:T.ic, tone:-1, tid:t.id, src:"구단 의무팀",
      head:`${p.name} ${T.n} — 전치 ${w}주`,
      sub:`${C?C.tell+" ":""}쓰러진 ${p.name}은(는) ${INJ_PART_N[T.part]||""} ${T.n} 진단을 받았다. 복귀까지 약 ${w}주가 걸릴 전망이다.`});
  }catch(e){}
}
/* 한 줄 문장 — 뉴스·해설·소견서가 같은 말을 쓴다 */
function injPhrase(p, withCause){
  const T=injTypeOf(p); if(!T) return `부상 ${injWeeksLeft(p)}주`;
  const C=INJ_CAUSE[p.injC];
  return `${withCause&&C?C.tell+" ":""}${T.ic} <b>${T.n}</b> — 전치 ${injWeeksLeft(p)}주`;
}
function injShort(p){ const T=injTypeOf(p); return T?`${T.ic} ${T.n}`:"🚑 부상"; }
/* ═══ 🩺 부상 소견서 — 감독이 고르는 처치 ══════════════════════════════════
   ⚠ 요청 원문 — 「FM처럼 선수가 부상당했을때 팀닥터 보고에서 해당 선수를 진통제 처방하고
      다음경기를 뛸수 있게 할지(물론 후폭풍이 있음) 아니면 수술이나 병원에 보내게할지 등등
      이런것도 구현해줄래?」

   ─ 안전하게 붙인다. 진통제는 p.inj 를 0 으로 만들어 「출전 가능」 판정을 한 줄도 건드리지
     않고, 갚아야 할 회복분은 따로 장부(p.pain)에 단다. 경기 중 재발은 이미 있는
     injuryCheck 의 위험값에 배수만 곱한다.
   ─ 팀 닥터 능력이 전부 여기에 걸린다 — med(의무)가 재발 확률과 후폭풍을,
     reh(재활)가 집중 재활의 폭을 정한다. 공석이면 진통제만 가능하고 위험은 최대. */
const INJ_PAIN_MAXW=3;      // 진통제로 밀어붙일 수 있는 진단 상한(주)
const INJ_SURG_MINW=4;      // 수술을 권할 수 있는 진단 하한(주)
const INJ_SURG_K=1.60;      // 수술 — 회복 기간 배수
const INJ_PUSH_K=0.84;      // 집중 재활 — 회복 기간 배수(기본). 재활 능력이 이 값을 깎는다
/* 🩺 유형이 처치를 정한다 (요청 — 「배선도 정확하게」)
   골절·인대 파열에 진통제를 물릴 수는 없고, 근육 뭉침을 수술하지도 않는다. */
function injCanPain(p){ const T=injTypeOf(p); return T ? !!T.pain : true; }
function injCanSurg(p){ const T=injTypeOf(p); return T ? !!T.surg : (injWeeksLeft(p)>=INJ_SURG_MINW); }
function injCanPush(p){ const T=injTypeOf(p); return T ? !!T.push : true; }
/* 왜 안 되는지 한 줄로 — 버튼 툴팁에 그대로 쓴다 */
function injWhyNo(p, kind){
  const T=injTypeOf(p);
  if(!T) return "";
  if(kind==="pain") return `${T.n}에는 진통제가 통하지 않습니다 — 통증이 아니라 구조가 상했습니다.`;
  if(kind==="surg") return `${T.n}은(는) 수술 대상이 아닙니다 — 째서 나을 부상이 아닙니다.`;
  return `${T.n}은(는) 재활을 당겨 봤자 위험만 커집니다.`;
}
function docOf(){ try{ return crewOf("doc")[0]||null; }catch(e){ return null; } }
function docMed(){ const c=docOf(); return c?(c.med|0):0; }
function docReh(){ const c=docOf(); return c?(c.reh|0):0; }
/* 🩺 처치가 남긴 몸 상태 — 경기 중 부상 위험 배수 (요청) */
function injTreatRiskMul(p){
  if(!p) return 1;
  let k=1;
  try{ if(painOn(p)) k*=painRiskMul(p); }catch(e){}
  try{ if(p.rehab && (G.day||0) < (p.rehab.until||0)) k*=1.28; }catch(e){}   // ⚡ 덜 여문 몸
  try{ if(p.surg && p.surg.s===G.season) k*=0.86; }catch(e){}                // 🏥 뿌리를 뽑았다
  return k;
}
/* 💊 진통제를 맞고 뛰는 중인가 */
function painOn(p){ return !!(p && p.pain && (p.pain.g|0)>0); }
/* 그 선수의 경기당 재발 확률 — 의무 능력이 높을수록 낮다 */
function painBreakOf(w){
  const med=docMed();
  const base=0.28 + clamp(((w||1)-1)*0.055, 0, 0.16);         // 진단이 길수록 위험하다
  const k=med? clamp(1.30-(med-10)*0.048, 0.58, 1.30) : 1.55; // 팀 닥터 공석이면 최악
  return clamp(base*k, 0.12, 0.72);
}
function painBreakP(p){ return painOn(p) ? painBreakOf(p.pain.w||1) : 0; }
/* 진통제 경기 중 「자연 부상」 위험 배수 — 엔진의 injuryCheck 가 곱해 쓴다 */
function painRiskMul(p){ return painOn(p) ? (2.4 - clamp((docMed()-8)*0.055, 0, 0.7)) : 1; }
/* 💊 처방 — 다음 한 경기를 뛴다 */
function injPain(pid){
  const t=userTeam(); const p=t&&t.players.find(x=>x.id===pid); if(!p) return;
  const w=injWeeksLeft(p);
  if(w<=0){ flash("부상 중인 선수가 아닙니다.","warn"); return; }
  if(!injCanPain(p)){ flash(`💊 ${injWhyNo(p,"pain")}`,"warn"); return; }
  if(w>INJ_PAIN_MAXW){ flash(`💊 <b>${INJ_PAIN_MAXW}주</b>를 넘는 부상에는 진통제를 쓸 수 없습니다 — 뛰다 무너집니다.`,"warn"); return; }
  const c=docOf();
  const pct=Math.round(painBreakOf(w)*100);
  showConfirm(`<b>💊 ${p.name} — 진통제 처방</b>

`
    +`진단 <b>${w}주</b>짜리 부상을 눌러 <b>다음 한 경기</b>를 뛰게 합니다.

`
    +`· 그 경기 동안 컨디션이 <b>72</b> 위로 올라가지 않습니다
`
    +`· 뛰는 중 재발 확률 <b style="color:var(--red)">약 ${pct}%</b> — 재발하면 원래보다 <b>훨씬 길게</b> 눕습니다
`
    +`· 무사히 마쳐도 약효가 끝나면 남은 회복을 <b>그때 치릅니다</b>
`
    +`· 선수는 이 결정을 좋아하지 않습니다

`
    +`<span class="small">${c?`🩺 ${c.n} — "권하지는 않습니다. 감독님이 정하시면 준비하겠습니다." (의무 ${c.med|0})`
                              :`🩺 <b style="color:var(--red)">팀 닥터가 공석입니다</b> — 관리해 줄 사람이 없어 위험이 가장 큽니다.`}</span>`,
    ()=>{
      p.pain={g:1, w, at:G.day||0};
      p.inj=0; p.injUntil=null;                 // 출전 가능 — 갚을 회복은 p.pain 에 달아 둔다
      p.cond=Math.min(p.cond||90, 72);
      try{ affAdd(p, -8, "진통제 강행"); }catch(e){}
      try{ p.morale=clamp((p.morale||70)-5, 25, 99); }catch(e){}
      try{ staffLog(`💊 ${p.name} 진통제 처방 — 다음 한 경기 출전 (진단 ${w}주).`); }catch(e){}
      try{ addNews(`💊 <b>${p.name} 진통제 투여</b> — 다음 경기 출전을 강행합니다 <span class="small">(진단 ${w}주 · 재발 위험 ${pct}%)</span>`,"warn","club"); }catch(e){}
      try{ addMood(`💬 ${p.name}: "뛸 수 있습니다. …뛰겠습니다."`); }catch(e){}
      saveGame(); show("staff");
    }, {okLabel:"💊 처방한다", cancelLabel:"그만두기", danger:true});
}
/* 🏥 수술 — 오래 걸리지만 뿌리를 뽑는다 */
function injSurgCost(w){ return Math.round(clamp(1.4 + w*0.55, 2, 9)*10)/10; }
function injSurg(pid){
  const t=userTeam(); const p=t&&t.players.find(x=>x.id===pid); if(!p) return;
  const w=injWeeksLeft(p);
  if(!injCanSurg(p)){ flash(`🏥 ${injWhyNo(p,"surg")||`<b>${INJ_SURG_MINW}주</b> 미만은 수술 대상이 아닙니다.`}`,"warn"); return; }
  if(w<2){ flash("🏥 수술할 만한 부상이 아닙니다.","warn"); return; }
  if(!docOf()){ flash("🩺 팀 닥터가 없으면 수술을 결정할 수 없습니다 — 먼저 영입하세요.","warn"); return; }
  const cost=injSurgCost(w);
  const nw=Math.max(w+1, Math.round(w*INJ_SURG_K));
  if((t.budget||0) < cost){ flash(`🏥 수술비 <b>${cost}억</b>이 필요합니다 — 이적 예산이 모자랍니다 (${(t.budget||0).toFixed(1)}억).`,"warn"); return; }
  showConfirm(`<b>🏥 ${p.name} — 수술</b>

`
    +`· 회복 <b>${w}주 → ${nw}주</b>
`
    +`· 수술비 <b>${cost}억</b> (이적 예산에서 차감)
`
    +`· 복귀 뒤 <b>재발 위험이 사라집니다</b> — 이번 시즌 부상 확률도 조금 낮아집니다

`
    +`<span class="small">🩺 ${docOf().n} — "지금 째는 게 낫습니다. 끌면 만성이 됩니다."</span>`,
    ()=>{
      t.budget=Math.round(((t.budget||0)-cost)*10)/10;
      try{ const fin=finLedger(t); fin.med=Math.round(((fin.med||0)+cost)*100)/100; }catch(e){}
      setInjury(p, nw, true);
      p.surg={s:G.season, at:G.day||0};
      delete p.pain;
      try{ staffLog(`🏥 ${p.name} 수술 — 회복 ${nw}주 · 수술비 ${cost}억.`); }catch(e){}
      try{ addNews(`🏥 <b>${p.name} 수술대에 오릅니다</b> — 복귀까지 약 ${nw}주. 구단은 "재발 없이 완전히 낫는 쪽을 택했다"고 밝혔습니다.`,"warn","club"); }catch(e){}
      saveGame(); show("staff");
    }, {okLabel:`🏥 수술한다 (${cost}억)`, cancelLabel:"그만두기"});
}
/* ⚡ 집중 재활 — 복귀를 앞당기고 재발 위험을 진다 */
function injPush(pid){
  const t=userTeam(); const p=t&&t.players.find(x=>x.id===pid); if(!p) return;
  const w=injWeeksLeft(p);
  if(!injCanPush(p)){ flash(`⚡ ${injWhyNo(p,"push")}`,"warn"); return; }
  if(w<2){ flash("⚡ 2주 미만은 앞당길 여지가 없습니다.","warn"); return; }
  const reh=docReh();
  if(!docOf()){ flash("🩺 팀 닥터가 없으면 집중 재활을 돌릴 수 없습니다.","warn"); return; }
  const k=clamp(INJ_PUSH_K - (reh-10)*0.024, 0.52, 0.95);
  const nw=Math.max(1, Math.round(w*k));
  if(nw>=w){ flash("⚡ 지금 의무팀 수준으로는 더 당길 수 없습니다.","warn"); return; }
  showConfirm(`<b>⚡ ${p.name} — 집중 재활</b>

`
    +`· 복귀 <b>${w}주 → ${nw}주</b>
`
    +`· 대신 복귀 뒤 <b>재발 위험이 남습니다</b> (한동안 부상 확률이 오릅니다)

`
    +`<span class="small">🩺 ${docOf().n} — "당길 수는 있습니다. 다만 몸이 덜 여문 채로 나가는 겁니다." (재활 ${reh})</span>`,
    ()=>{
      setInjury(p, nw, true);
      p.rehab={s:G.season, until:(G.day||0)+nw*7+42};
      try{ staffLog(`⚡ ${p.name} 집중 재활 — 복귀 ${w}주 → ${nw}주.`); }catch(e){}
      try{ addNews(`⚡ <b>${p.name} 집중 재활</b> — 복귀를 ${w-nw}주 앞당깁니다. <span class="small">의무팀은 재발 위험을 경고했습니다.</span>`,null,"club"); }catch(e){}
      saveGame(); show("staff");
    }, {okLabel:"⚡ 앞당긴다", cancelLabel:"그만두기"});
}
/* 🚑 팀 닥터 — 진단 그 자체를 바꾼다. 같은 부상도 좋은 의무팀이면 한두 주 짧다.
   ⚠ raw=true 는 「이 숫자를 그대로 써라」다 — 에디터·세이브 복원처럼 의도한 값을 넣는 자리. */
function setInjury(p, weeks, raw){
  let w0=Math.max(0, Math.round(weeks));
  if(!raw && w0>0){
    try{ if(isOurPlayer(p)) w0=Math.max(1, Math.round(w0*acDocInjK())); }catch(e){}
  }
  const w=w0;
  p.inj=w;
  p.injUntil=(G.day||0)+w*7;
  /* 처음 진단받은 기간을 남겨 둔다 — 잔여 주(p.inj)는 매일 깎이므로
     복귀 시점에는 「원래 몇 주짜리였는지」를 알 수 없다. */
  if(w>0) p.injW0=Math.max(p.injW0||0, w);
  else delete p.injW0;
}
/* 하루가 지날 때마다 — 회복일이 된 선수를 풀어 준다 */
function tickInjuryDays(){
  const walk=(arr, isUser)=>{
    if(!Array.isArray(arr)) return;
    for(const p of arr){
      if(!p || !(p.inj>0)) continue;
      if(p.injUntil==null) p.injUntil=(G.day||0)+p.inj*7;   // 옛 세이브 백필
      let left=injWeeksLeft(p);
      /* 🚑 어긋남 복구 (제보 — 1주 → 38주) — 예정일이 잔여 주와 크게 다르면(묵은 예정일이
         남았거나, 부상 중 재부상으로 주수가 직접 커진 경우) 잔여 주 기준으로 다시 잡는다. */
      if(Math.abs(left-(p.inj||0))>1){
        p.injUntil=(G.day||0)+(p.inj||0)*7;
        p.injW0=Math.max(p.injW0||0, p.inj||0);
        left=p.inj||0;
      }
      if(left<=0){
        const w0=p.injW0||p.inj||0;
        p.inj=0; p.injUntil=null; delete p.injW0;
        const _T0=(function(){ try{ return injTypeOf(p); }catch(e){ return null; } })();
        delete p.injT; delete p.injC;        // 🚑 활성 유형은 지운다 — 이력(injLog)은 남는다
        /* 🏥 수술로 나았으면 「큰 부상에서 돌아온 지 얼마 안 됐다」는 꼬리표를 뗀다 (요청) */
        try{ if(p.surg){ delete p.injW0; } }catch(e){}
        if(isUser){
          addNews(`💪 ${p.name} 선수가 ${_T0?`${_T0.ic} ${_T0.n}에서 `:"부상에서 "}회복해 훈련에 복귀했습니다.`);
          /* ⚠ 「2주 이상 이탈했던 선수가 돌아오면 알려 주면 좋겠다 — 스쿼드 반영을 놓친다」.
             맞는 말이다. 긴 부상은 그 사이 라인업이 통째로 바뀌어 있어서,
             뉴스 한 줄로는 감독이 복귀를 모르고 지나간다. */
          if(w0>=INJ_BACK_W){
            try{ const Q=(G.injBack=G.injBack||{n:0,list:[]});
                 Q.n++; Q.list.push({nm:p.name, pos:p.pos, w:w0, id:p.id}); }catch(e){}
          }
        }
      } else if(left!==p.inj){
        p.inj=left;   // 표시용 잔여 주 갱신
      }
    }
  };
  for(const id in G.teams){ const t=G.teams[id]; walk(t.players, !!t.isUser); }
  /* 💊 진통제를 맞고 대기 중인 선수는 컨디션이 올라오지 않는다 — 통증을 누르고 있을 뿐이다 (요청) */
  try{ const ut=userTeam(); if(ut) for(const p of (ut.players||[])) if(painOn(p)) p.cond=Math.min(p.cond||90, 72); }catch(e){}
  walk(G.freeAgents, false);      // FA도 시간이 흐르면 낫는다
  walk(G.overseas, false);
  try{ devUnattachedTick(); }catch(e){}   // 🧳 무적 선수도 매일 조금씩 변한다 (아래 주석)
  /* 🌏 해외 클럽(EACL·CWC)도 시간이 흐르면 낫는다 — 유저전에서 다친 선수가 시즌 내내
     부상자 명단에 갇혀 있었다 (제보 — 컨디션·회복 패치의 해외 구단 동일 적용) */
  try{ for(const k in (G.eaclClubs||{})){ const c=G.eaclClubs[k]; if(c&&c.s===G.season&&c.t) walk(c.t.players, false); } }catch(e){}
  try{ for(const k in (G.cwcClubs||{})){ const c=G.cwcClubs[k]; if(c&&c.s===G.season&&c.t) walk(c.t.players, false); } }catch(e){}
}
function tickBanInj(opt){
  const doBan=!!(opt&&opt.ban);
  for(const id in G.teams){ const t=G.teams[id];
    for(const p of t.players){
      if(doBan){
        if(p.banNew){ delete p.banNew; }
        else if(p.ban>0){ p.ban--;
          if(p.ban===0 && t.isUser) addNews(`✅ ${p.name} 선수의 출장정지가 끝났습니다.`); }
      }
    }
  }
  for(const p of (G.freeAgents||[])){
    /* 🚑 부상은 여기서 깎지 않는다 — 날짜 기반(tickInjuryDays)이 맡는다 */
    if(doBan){ if(p.banNew) delete p.banNew; else if(p.ban>0) p.ban--; }
  }
}
/* ═══════════════════════════════════════════════════════════════
   🌏 EACL — 동아시아 클럽 대항전
   한·중·일 클럽이 겨루는 대회. 한국 참가팀은 K리그 순위에서 뽑히고,
   중국·일본 클럽은 아래 풀에서 매 시즌 추첨한다.
   ⚠ 실존 구단과 겹치지 않도록 도시 + 창작 애칭으로 짓는다 (K리그 구단명과 같은 원칙).
     ovr — 팀 전력 기준값. 스쿼드는 이 값에 맞춰 자동 생성한다.
   ═══════════════════════════════════════════════════════════════ */
const UID_EACL=6001;                 // EACL 클럽 6001~
/* 국가별 클럽 풀 — 매 시즌 여기서 추첨한다 (일본4·중국2·태국2·말레이1 = 9팀 + K리그 3팀)
     ovr  — 자국 선수 기준 팀 전력 (별점 눈금: 3성 66 · 3.5성 69 · 4성 71 · 4.5성 73)
     fOvr — 용병 기준 전력.  fN — 20명 중 용병 수 (EACL은 외국인 무제한) */
const EACL_CLUBS=[
  /* ⚠ 제보 — 「대륙대회 진출 팀인데 스쿼드 전력이 별 반 개 수준이다. 상향 평준화가 필요하다」.
     실측해 보니 K리그1 상위권이 4.0★인데 EACL 클럽은 2.0~3.5★에 몰려 있었다.
     각국 리그 우승·상위권 자격으로 올라온 팀들이라 「우리 리그 중하위권보다 약한 팀」이
     대륙대회에 나오는 그림은 맞지 않는다. 나라별 결은 그대로 두고 눈금만 끌어올린다.
       · 일본  — 자국 선수층이 두껍고 조직력이 좋다. 전체적으로 K1 상위권과 겨루는 수준
       · 중국  — 자국 선수는 평범하지만 용병에 큰돈을 쓴다. 용병 기준을 가장 높게
       · 태국  — 아세안 최상위. 부리람·방콕은 K1 중위권과 붙을 만하다
       · 말레이시아 — 선발 대부분이 용병인 기형 구조. 조호르는 아시아에서도 손꼽히는 씀씀이
     fOvr — 용병 기준 전력.  fN — 20명 중 용병 수 (EACL은 외국인 무제한) */
  /* 🇯🇵 일본 — 자국 선수층이 두껍고 용병은 소수 정예 */
  {id:"jp_kawa",  name:"가와사키 프론테",   short:"가와사키", nat:"일본", col:"#7fc7f0", col2:"#111111", ovr:75, fOvr:77, fN:3},
  {id:"jp_yoko",  name:"요코하마 마리너스", short:"요코하마", nat:"일본", col:"#0a2f6e", col2:"#d21b3c", ovr:75, fOvr:77, fN:3},
  {id:"jp_kobe",  name:"고베 오션즈",      short:"고베",   nat:"일본", col:"#f2f2f2", col2:"#111111", ovr:75, fOvr:77, fN:3},
  {id:"jp_urawa", name:"우라와 레드윙스",   short:"우라와",  nat:"일본", col:"#d0021b", col2:"#111111", ovr:74, fOvr:76, fN:3},
  {id:"jp_osaka", name:"오사카 블루웨이브", short:"오사카",  nat:"일본", col:"#1b5fbe", col2:"#111111", ovr:73, fOvr:76, fN:3},
  {id:"jp_hiro",  name:"히로시마 퍼플즈",   short:"히로시마", nat:"일본", col:"#5b2d8e", col2:"#ffffff", ovr:74, fOvr:76, fN:2},
  {id:"jp_nagoya",name:"나고야 그램퍼",     short:"나고야",  nat:"일본", col:"#c8102e", col2:"#f5c518", ovr:73, fOvr:76, fN:3},
  /* 🇨🇳 중국 — 자국 선수는 평범하지만 용병이 팀을 캐리한다 */
  {id:"cn_shhb",  name:"상하이 하버",      short:"상하이",  nat:"중국", col:"#e30613", col2:"#1c1c1c", ovr:70, fOvr:78, fN:5},
  {id:"cn_shbs",  name:"상하이 블루샤크",   short:"상하이B", nat:"중국", col:"#1e5fa8", col2:"#ffffff", ovr:70, fOvr:76, fN:5},
  {id:"cn_shan",  name:"산둥 타이거스",     short:"산둥",   nat:"중국", col:"#e85d0d", col2:"#1c1c1c", ovr:70, fOvr:78, fN:5},
  {id:"cn_bj",    name:"베이징 캐피탈",     short:"베이징",  nat:"중국", col:"#0b7a3b", col2:"#ffffff", ovr:70, fOvr:76, fN:5},
  {id:"cn_cd",    name:"청두 드래곤스",     short:"청두",   nat:"중국", col:"#c8102e", col2:"#f5c518", ovr:69, fOvr:76, fN:4},
  /* 🇹🇭 태국 — 아세안 최상위. 상위 두 팀은 K1 중위권과 겨룬다 */
  {id:"th_buri",  name:"부리람 썬더",      short:"부리람",  nat:"태국", col:"#1e5fa8", col2:"#ffffff", ovr:72, fOvr:75, fN:5},
  {id:"th_bkk",   name:"방콕 킹스",        short:"방콕",   nat:"태국", col:"#14224f", col2:"#f5c518", ovr:72, fOvr:75, fN:5},
  {id:"th_chon",  name:"촌부리 샤크스",     short:"촌부리",  nat:"태국", col:"#7fc7f0", col2:"#ffffff", ovr:71, fOvr:74, fN:4},
  {id:"th_muang", name:"무앙통 워리어스",   short:"무앙통",  nat:"태국", col:"#d0021b", col2:"#111111", ovr:71, fOvr:74, fN:5},
  /* 🇲🇾 말레이시아 — 선발 대부분이 용병인 기형 구조 */
  {id:"my_johor", name:"조호르 타이거스",   short:"조호르",  nat:"말레이시아", col:"#1e4fa8", col2:"#d0021b", ovr:69, fOvr:77, fN:14, natStar:2},
  {id:"my_sel",   name:"슬랑오르 로열스",   short:"슬랑오르", nat:"말레이시아", col:"#d0021b", col2:"#f5c518", ovr:69, fOvr:75, fN:13, natStar:2},
  {id:"my_sabah", name:"사바 이글스",      short:"사바",   nat:"말레이시아", col:"#1e5fa8", col2:"#ffffff", ovr:68, fOvr:74, fN:13, natStar:2}
];
/* 🏟️🏢👔 클럽 부속 정보 — 구장 · 모기업(운영 주체) · 감독.
   K리그 구단과 똑같이 각각 고유번호를 가진다 (구단 6001~ · 감독 6101~ · 구장 6201~ · 모기업 6301~) */
const EACL_META={
  jp_kawa:  {mgr:"모리시타 다이치", stad:{n:"가와사키 리버스타디움", cap:27000}, own:"가와사키 정밀기계"},
  jp_yoko:  {mgr:"아리타 겐스케",   stad:{n:"요코하마 베이아레나",   cap:72000}, own:"닛세이자동차"},
  jp_kobe:  {mgr:"사카모토 유타카", stad:{n:"고베 하버스타디움",     cap:30000}, own:"고베제강해운"},
  jp_urawa: {mgr:"호리우치 마사시", stad:{n:"사이타마 레드돔",       cap:63000}, own:"사이타마전기"},
  jp_osaka: {mgr:"니시무라 고지",   stad:{n:"오사카 사쿠라파크",     cap:47000}, own:"간사이철도"},
  jp_hiro:  {mgr:"다케다 신야",     stad:{n:"히로시마 피스아레나",   cap:28500}, own:"세토내해상사"},
  jp_nagoya:{mgr:"이시바시 도루",   stad:{n:"나고야 미들랜드파크",   cap:35000}, own:"주부자동차"},
  cn_shhb:  {mgr:"리쥔하오",  stad:{n:"상하이 푸둥 스타디움",   cap:37000}, own:"상하이항만그룹"},
  cn_shbs:  {mgr:"저우옌린",  stad:{n:"상하이 훙커우 아레나",   cap:33000}, own:"선화문화미디어"},
  cn_shan:  {mgr:"장하이펑",  stad:{n:"지난 올림픽 스포츠파크", cap:56000}, own:"루넝에너지그룹"},
  cn_bj:    {mgr:"왕중치",    stad:{n:"베이징 노동자경기장",     cap:66000}, own:"국안금융지주"},
  cn_cd:    {mgr:"마샤오둥",  stad:{n:"청두 판다 스타디움",     cap:60000}, own:"룽청산업그룹"},
  th_buri:  {mgr:"솜차이 프라윳",     stad:{n:"부리람 썬더캐슬",       cap:32000}, own:"이산주류그룹"},
  th_bkk:   {mgr:"아누차 시리퐁",     stad:{n:"방콕 라차망갈라 파크",  cap:49000}, own:"시암통신그룹"},
  th_chon:  {mgr:"위라텝 분마탄",     stad:{n:"촌부리 샤크 아레나",    cap:8600},  own:"촌부리 해양산업"},
  th_muang: {mgr:"차이야왓 나콘",     stad:{n:"무앙통 노스아레나",     cap:15000}, own:"시암시멘트그룹"},
  my_johor: {mgr:"아리프 빈 하산",    stad:{n:"술탄 이브라힘 스타디움", cap:40000}, own:"조호르 왕실재단"},
  my_sel:   {mgr:"사프완 빈 유소프",  stad:{n:"샤알람 로열파크",       cap:80000}, own:"슬랑오르 주정부개발공사"},
  my_sabah: {mgr:"하디 빈 오스만",    stad:{n:"리카스 이글네스트",     cap:35000}, own:"사바 에너지코퍼레이션"}
};
const UID_EACL_COACH=6101, UID_EACL_STAD=6201, UID_EACL_OWNER=6301;
function eaclIdx(id){ const i=EACL_CLUBS.findIndex(c=>c.id===id); return i<0?90:i; }
function uidEaclCoachOf(id){ return UID_EACL_COACH+eaclIdx(id); }
function uidEaclStadOf(id){ return UID_EACL_STAD+eaclIdx(id); }
function uidEaclOwnerOf(id){ return UID_EACL_OWNER+eaclIdx(id); }
function eaclMeta(id){ return EACL_META[id] || {mgr:"미상", stad:{n:"홈구장", cap:20000}, own:"미상"}; }
/* 👔 EACL 감독 — 능력치는 클럽 전력에서 결정론적으로 뽑는다(같은 클럽이면 언제나 같은 값).
   K리그 감독(COACHES)과 같은 8개 항목을 쓴다. */
function eaclCoach(id){
  const def=eaclClubDef(id); if(!def) return null;
  const M=eaclMeta(id);
  const h=uidHash(id+"|coach");
  const base=Math.round((def.ovr-64)*1.05)+10;                 // 팀 전력 → 감독 기본기
  const v=(k,sp)=>clamp(base+((uidHash(id+k)%(sp*2+1))-sp), 6, 20);
  const o={ n:M.mgr, uid:uidEaclCoachOf(id), club:def.name,
    tac:v("t",3), flex:v("f",3), att:v("a",4), def:v("d",4), man:v("m",3), dev:v("v",4), judg:v("j",3) };
  o.ovr=Math.round((o.tac+o.flex+o.att+o.def+o.man+o.dev+o.judg)/7);
  o.nat=def.nat; o.seed=h;
  try{ acSeedFromLegacy(o); o.ovr=Math.round((o.tac+o.flex+o.att+o.def+o.man+o.dev+o.judg)/7); }catch(e){}
  return o;
}
/* 이번 시즌 참가 클럽 — 일본4 · 중국2 · 태국2 · 말레이1 (한국 3팀은 K리그에서 뽑힌다) */
const EACL_SLOTS={"일본":4, "중국":2, "태국":2, "말레이시아":1};
function eaclClubDef(id){ return EACL_CLUBS.find(c=>c.id===id)||null; }
function uidEaclOf(id){ const i=EACL_CLUBS.findIndex(c=>c.id===id); return UID_EACL+(i<0?90:i); }
function eaclDraw(){
  const out=[];
  for(const nat in EACL_SLOTS){
    const pool=EACL_CLUBS.filter(c=>c.nat===nat).map(c=>c.id);
    out.push(...shuffled(pool).slice(0, EACL_SLOTS[nat]));
  }
  return out;
}
/* ---------- 국가별 선수 이름 생성기 ----------
   EACL 클럽은 매 시즌 새로 뽑히므로 선수도 그때그때 만든다.
   현지 선수는 그 나라 이름으로, 용병은 출신 대륙에 맞는 이름으로 짓는다. */
const JP_SUR=["사토","스즈키","다카하시","다나카","이토","와타나베","야마모토","나카무라","고바야시","가토",
  "요시다","야마다","사사키","야마구치","마쓰모토","이노우에","기무라","시미즈","하야시","사이토",
  "모리","이케다","하시모토","이시카와","오가와","마에다","후지타","고다마","엔도","아오키"];
const JP_GIV=["쇼타","유토","하루토","다이키","겐토","소타","리쿠","유마","가이토","다쿠미",
  "료타","고타로","하야토","유키","슌스케","다이스케","게이스케","신지","다쓰야","마코토",
  "아쓰시","조","가즈키","레오","미나토","슈토","도모야","나오키","고지","쓰바사"];
const CN_SUR=["왕","리","장","류","천","양","황","자오","우","저우",
  "쉬","쑨","마","주","후","궈","린","허","가오","뤄"];
const CN_GIV=["웨이","하오","레이","양","펑","천","제","타오","빈","위",
  "밍","젠","강","융","리","성","쥔","시","보","한"];
const TH_GIV=["차나팁","티라실","티라톤","사라치","크리사다","수파촉","아디삭","분마톤","위라텝","나룹폰",
  "피티왓","차이야왓","솜차이","아누차","엑카니트","파칸","산티팝","위라판","자로엔삭","펑사콘"];
const TH_SUR=["송크라신","분마탄","분삼","라차왓","시왁쿤","펫부리","촘촘","분테","깨우삼","타위",
  "수완낫","프라디타","시리퐁","분추","나콘"];
const MY_GIV=["무하맛","아즈리","샤룰","파이잘","사프완","하디","아리프","이르판","루크만","자프리",
  "아크말","다니알","하즈리","나즈미","살리프","키리","라시드","아드완","이스칸다르","파딜"];
const MY_SUR=["빈 하산","빈 이스마일","빈 아흐맛","빈 라흐만","빈 유소프","빈 자이날","빈 무스타파","빈 오스만",
  "빈 술라이만","빈 자밀","빈 카밀","빈 아지즈"];
/* 용병 — 아시아 클럽에 실제로 오는 결을 따라간다. 브라질이 절반, 나머지는 유럽·아프리카·남미 */
const FRN_BR=["카를로스","치아구","하파엘","마르코스","브루노","지에구","루카스","마테우스","펠리피","조나탄",
  "이고르","알렉스","레안드로","무리치","바그네르","에두아르도","안드리고","니콜라스","다닐로","히카르두",
  "제르손","윌리안","알랑","마르시뉴","파울리뉴","호베르투","비니시우스","제카"];
const FRN_EU=["니콜라 요비치","마르코 페트로비치","루카 코바치","스테판 밀리치","다리오 부리치","이반 크네제비치",
  "미하일 포포프","안드레아스 뮐러","야니스 케르바","토마스 노박","다비드 호르바트","필립 오브라도비치"];
const FRN_AF=["에마뉘엘 오콘퀘","사무엘 아사모아","이브라히마 디알로","무사 코네","존 아데예미",
  "케빈 멘사","압둘라이 사르","치네두 오비","라민 자로","제임스 오세이"];
const FRN_SA=["세바스티안 로하스","마르틴 아길라르","디에고 카스트로","호세 모랄레스","니콜라스 벨라스케스",
  "산티아고 로메로","후안 데 라 크루스","에스테반 아르세"];
const FRN_OC=["잭 톰슨","라이언 밀러","코너 오브라이언","루크 하퍼","조시 벤틀리"];
function genJpName(){ return pick(JP_SUR)+" "+pick(JP_GIV); }
function genCnName(){ return pick(CN_SUR)+pick(CN_GIV)+(Math.random()<0.45?pick(CN_GIV):""); }
function genThName(){ return pick(TH_GIV)+" "+pick(TH_SUR); }
function genMyName(){ return pick(MY_GIV)+" "+pick(MY_SUR); }
function genEaclFrnName(){
  const r=Math.random();
  return r<0.46?pick(FRN_BR) : r<0.66?pick(FRN_EU) : r<0.82?pick(FRN_AF) : r<0.94?pick(FRN_SA) : pick(FRN_OC);
}
function genNatName(nat){
  return nat==="일본"?genJpName() : nat==="중국"?genCnName()
       : nat==="태국"?genThName() : nat==="말레이시아"?genMyName() : genName();
}
/* ---------- EACL 클럽 스쿼드 생성 ----------
   팀당 20명 (GK2·DF7·MF6·FW5). EACL은 외국인 무제한이라 등록·선발 제한을 두지 않는다.
   용병은 좋은 자리(공격·중원)부터 채운다 — 실제로 그렇게 쓰기 때문이다. */
const EACL_POS=[["GK",2],["DF",7],["MF",6],["FW",5]];
function eaclSquadPlan(def){
  /* ⚠ 제보 — 「EACL 해외 구단도 풀백 품귀 — 풀백을 전부 센터백 출신이 뛰고 있다. 처음
     구성될 때부터 전문 풀백 주전+후보가 있게 해달라」. 세부 자리를 정하지 않아 능력치
     추론이 센터백·중미로 몰리던 국내 유스와 같은 병. 자리표를 못박는다 (CWC 클럽도 공유). */
  const PREF={GK:["GK","GK"],
              DF:["CB","CB","LB","RB","CB","LB","RB"],          // 주전 CB2+LB+RB · 후보 CB+LB+RB
              MF:["DM","CM","CM","CAM","DM","CM"],
              FW:["ST","LW","RW","ST","RW"]};
  const slots=[];
  for(const [pos,n] of EACL_POS) for(let i=0;i<n;i++) slots.push({pos, i, pref:(PREF[pos]||[])[i]||pos});
  /* 용병 배정 우선순위 — 각 라인의 주전 자리부터 한 칸씩 돌아가며 채운다.
     한 포지션에 몰아넣으면 다섯 번째 공격수 같은 후보 자리가 용병으로 낭비된다.
     골키퍼는 대개 자국 선수가 지키므로 맨 뒤로 민다. */
  const rank={FW:0, MF:1, DF:2, GK:3};
  const key=s=>(s.pos==="GK"?s.i+20:s.i)*10+rank[s.pos];
  const order=[...slots].sort((a,b)=>key(a)-key(b));
  const fN=clamp(def.fN||0, 0, 19);
  for(let k=0;k<fN;k++) order[k].frn=1;
  /* 말레이시아처럼 용병이 스쿼드를 덮는 팀도 자국 대표급 한두 명은 반드시 선발로 뛴다.
     남은 자국 슬롯 중 뒷선(GK·DF)부터 용병 수준으로 끌어올려 준다. */
  const star=def.natStar||0;
  if(star>0){
    const home=order.filter(s=>!s.frn).sort((a,b)=>(rank[b.pos]-rank[a.pos])||(a.i-b.i));
    for(let k=0;k<Math.min(star, home.length);k++) home[k].star=1;
  }
  return slots;
}
/* ═══ 🔒 에디터로 고친 구단 정보 — 그 세이브에서는 영원히 유지된다 ═══════════════
   ⚠ 제보 원문 — 「인게임 에디터로 국내 구단, 해외 구단 전부 팀 이름, 약칭, 모기업 / 운영 주체,
      구장 이름, 수용 인원 등 구단 정보 고쳐 놓으면 몇 시즌 지나서 원상복귀 되는 버그가 있습니다!!
      나무위키 보고 열심히 고쳐놨는데 처음에는 고친 상태로 가다가 나중에 EACL 보면 구장명이
      원상복구 되어있고 그런 증상이 있습니다 ㅠ … 명칭 현실화 패치를 했든 하지 않았든 …
      절대 AI 의 임의대로 원상복구 하지 않고, 유저의 수정 사항 그대로 언제까지든 유지가 되게」

   원인은 두 갈래였다.
   ① 해외(EACL·CWC) 구단 — 스쿼드를 시즌마다 새로 만들면서 팀 객체를 통째로 갈아 끼운다.
      덮어쓰기 표에 남기는 항목이 이름·약칭·구장 이름·수용 인원·평균 관중·모기업 여섯뿐이라,
      팬 규모·이적 예산·사기·조직력·유스/훈련/스카우팅 등급은 그 시즌 캐시에만 써서
      다음 시즌에 사라졌다(실측: 팬 규모 55 → 30, 훈련시설 9 → 없음).
   ② 국내 구단 — 값 자체는 세이브에 남지만, 게임이 나중에 덮어썼다.
      · 기업 인수(acqDo)가 팀 이름을 「도시+브랜드」로, 모기업을 새 브랜드로 갈아엎었다
        (실측: 「강원 FC / 강원도청」 → 「강원 도원 / 도원모빌리티」)
      · 시즌말 기준 관중 조정(attSeasonAdjust)이 옛 자료값(_base0) 기준 천장으로 끌어내렸다
        (실측: 평균 관중 14,000 → 10,400)

   ─ 해결: 에디터가 건드린 항목은 「표」에 남기고, 팀이 새로 만들어지거나 세이브를 열거나
     시즌이 바뀔 때마다 그 표를 다시 얹는다. 게임 안에서 정당하게 이름이 바뀌는 사건
     (기업 인수·철수·신구장 개장)만 예외로, 그때는 「새 이름으로 표를 갱신」해서
     그 뒤로도 다시는 되돌아가지 않게 한다. */
const OVR_TEAM_F=["name","short","owner","ownKind","stadName","stadCap","stadAvg",
                  "budget","wageCap","fans","morale","fam","youthLv","trainLv","scoutLv"];
function ovrTeamKey(f){ return f==="stadName"?"stadN" : f==="owner"?"own" : f; }
/* 표 한 칸에 값을 넣는다 — 비었거나 말이 안 되는 값이면 그 칸을 지운다(=기본값으로) */
function ovrTeamPut(o, field, v){
  const k=ovrTeamKey(field);
  const num=(lo,hi,dp)=>{ const n=parseFloat(String(v).replace(/[^0-9.\-]/g,""));
    if(!isFinite(n)) return null; const pw=Math.pow(10,dp||0);
    return clamp(Math.round(n*pw)/pw, lo, hi); };
  let val=null;
  if(field==="stadCap")            val=num(1000,150000,0);
  else if(field==="stadAvg")       val=num(100,150000,0);
  else if(field==="budget"||field==="wageCap") val=num(0,99999,1);
  else if(field==="fans")          val=num(1,200,1);
  else if(field==="morale")        val=num(40,99,0);
  else if(field==="fam")           val=num(0,100,0);
  else if(field==="youthLv"||field==="trainLv") val=num(1,10,0);
  else if(field==="scoutLv")       val=num(1,5,0);
  else if(field==="ownKind"){ const t2=String(v||"").trim();
    val=(typeof CLUB_TYPE_N!=="undefined" && CLUB_TYPE_N[t2]) ? t2 : null; }
  else { const nm=String(v==null?"":v).trim().slice(0, field==="short"?8:field==="stadName"?24:20);
    val=nm||null; }
  if(val==null) delete o[k]; else o[k]=val;
}
/* 표를 팀 객체에 얹는다 — 해외 구단은 시즌마다 새로 만들어진 껍데기 위에 이걸 다시 씌운다 */
function ovrTeamApply(t, o, avgK, fanD){
  if(!t||!o) return t;
  if(o.name)  t.name=o.name;
  if(o.short) t.short=o.short;
  if(t.stad){
    if(o.stadN) t.stad.n=o.stadN;
    if(o.stadCap){ t.stad.cap=o.stadCap;
      if(!o.stadAvg) t.stad.avg=Math.round(o.stadCap*(avgK||0.42));
      t.fans=Math.round(o.stadCap/(fanD||900)); }
    if(o.stadAvg) t.stad.avg=Math.min(o.stadAvg, t.stad.cap||o.stadAvg);
  }
  if(o.own && t.own) t.own.n=o.own;
  try{ if(o.ownKind){ G.ownerKinds=G.ownerKinds||{}; G.ownerKinds[t.id]=o.ownKind; } }catch(e){}
  /* 팬 규모는 수용 인원에서 유추한 값보다 「직접 지정」이 이긴다 — 순서가 중요하다 */
  if(o.fans!=null)     t.fans=o.fans;
  if(o.budget!=null)   t.budget=o.budget;
  if(o.wageCap!=null)  t.wageCap=o.wageCap;
  if(o.morale!=null)   t.morale=o.morale;
  if(o.fam!=null)      t.fam=o.fam;
  if(o.youthLv!=null)  t.youthLv=o.youthLv;
  if(o.trainLv!=null)  t.trainLv=o.trainLv;
  if(o.scoutLv!=null)  t.scoutLv=o.scoutLv;
  return t;
}
/* ── 🔒 국내 구단 잠금 등록부 ──────────────────────────────────────────
   국내 구단은 값이 팀 객체에 그대로 남으므로 「명칭류」만 잠근다.
   (예산·사기 같은 살아 있는 수치까지 잠그면 게임이 굴러가지 않는다) */
const ED_LOCK_F=["name","short","owner","ownKind","stadName"];
function edLockOf(tid){ return (G.edLock && G.edLock[tid]) || null; }
function edLockPut(tid, field, v){
  if(!tid || ED_LOCK_F.indexOf(field)<0) return;
  G.edLock=G.edLock||{};
  const o=G.edLock[tid] || (G.edLock[tid]={});
  ovrTeamPut(o, field, v);
  if(!Object.keys(o).length) delete G.edLock[tid];
}
/* 게임 안의 정당한 개명 사건 — 잠겨 있으면 「새 이름으로」 잠금을 갱신한다.
   잠근 적이 없는 구단에는 새로 잠금을 만들지 않는다(게임 진행을 방해하지 않게). */
function edLockRenew(tid, field, v){
  const o=edLockOf(tid); if(!o) return;
  if(o[ovrTeamKey(field)]==null) return;
  ovrTeamPut(o, field, v);
  if(!Object.keys(o).length && G.edLock) delete G.edLock[tid];
}
function edLockApply(t){
  const o=t && edLockOf(t.id); if(!o) return;
  if(o.name)  t.name=o.name;
  if(o.short) t.short=o.short;
  if(o.own){ G.ownerNames=G.ownerNames||{}; G.ownerNames[t.id]=o.own;
             if(G.ownerAuto) delete G.ownerAuto[t.id]; }
  if(o.ownKind){ G.ownerKinds=G.ownerKinds||{}; G.ownerKinds[t.id]=o.ownKind; }
  if(o.stadN){ try{ stadOf(t).n=o.stadN; }catch(e){} }
}
/* 불러오기·새 시즌마다 한 번 훑는다 — 그 사이 무엇이 덮어썼든 여기서 되돌려 놓는다 */
function edLockSweep(){
  try{ for(const id in (G.edLock||{})){ const t=G.teams && G.teams[id]; if(t) edLockApply(t); } }catch(e){}
}
/* ✏️ 해외 구단 정보 덮어쓰기 — 인게임 에디터에서 고친 값(제보).
   스쿼드는 시즌마다 다시 만들어지므로 팀 객체가 아니라 여기 따로 보관한다. */
function eaclNameOv(id){ return (G.eaclName && G.eaclName[String(id).replace(/^eacl_/,"")]) || null; }
function eaclApplyName(t, id){
  const o=eaclNameOv(id); if(!o || !t) return t;
  /* ⚠ 제보 — 에디터 팀 탭의 「전 항목」을 표로 남겨 되살린다(이름·구장·모기업만이 아니다) */
  return ovrTeamApply(t, o, 0.42, 900);
}
function eaclSetName(id, field, v){
  const key=String(id).replace(/^eacl_/,"");
  if(!G.eaclName) G.eaclName={};
  const o=G.eaclName[key] || (G.eaclName[key]={});
  ovrTeamPut(o, field, v);
  if(!Object.keys(o).length) delete G.eaclName[key];
  /* 이미 만들어 둔 스쿼드에도 즉시 반영한다 */
  try{ const c=G.eaclClubs && G.eaclClubs[key]; if(c && c.t) eaclApplyName(c.t, key); }catch(e){}
  saveGame();
}
function eaclClub(id){
  if(!G.eaclClubs) G.eaclClubs={};
  const cache=G.eaclClubs[id];
  if(cache && cache.s===G.season) return eaclApplyName(cache.t, id);   // 시즌 안에서는 같은 스쿼드를 유지한다
  const def=eaclClubDef(id); if(!def) return null;
  const t={id:"eacl_"+def.id, name:def.name, short:def.short, col:def.col, col2:def.col2,
    nat:def.nat, eacl:true, div:0, budget:0, fans:0, players:[],
    form:[], morale:50, uid:uidEaclOf(def.id),
    tactic:{formation:"4-3-3", mentality:2, pass:2, tempo:2, press:2, line:2, width:2, counter:2, crossFq:2, longShot:2, benchSel:[]},
    W:0,Dw:0,L:0,GF:0,GA:0,Pts:0, isUser:false, aclMoney:0};
  const used={};                                   // 한 팀 안에 같은 이름이 두 번 나오지 않게 한다
  const uniqName=(fn)=>{ let n=fn(); for(let k=0;k<24 && used[n];k++) n=fn(); used[n]=1; return n; };
  for(const s of eaclSquadPlan(def)){
    const frn=s.frn?1:0;
    const base=(frn||s.star)?(def.fOvr||def.ovr):def.ovr;
    /* ⚠ 제보 — 「해외 구단 선수들이 거의 30~40대다. 시즌이 흐른 만큼 나이가 더해진 것 같다」.
       정확한 진단이었다. 생년을 1991~2004 로 못박아 두어서, 그 해에 새로 만든 스쿼드인데도
       2032 시즌이면 28~41세가 됐다. 나이는 「그 시즌 기준」으로 뽑아야 한다.
       ─ 18~35세, 26세 언저리가 가장 두꺼운 종 모양. 주전에서 멀수록 어린 자원이 섞인다. */
    const _bell=Math.min(R(9)+R(9), 17);
    const _age0=18+_bell-(s.i>=3?2:0)+((s.star||s.i===0)?2:0);
    const by=G.season-clamp(_age0, 17, 36);
    const age=G.season-by;
    const ageAdj = age<=19?-8 : age<=21?-5 : age<=23?-2 : age<=31?1 : age<=34?-1 : -4;
    const depth = s.i===0?3 : s.i===1?1 : s.i===2?-1 : -4;   // 주전에서 멀어질수록 약해진다
    const ovr=clamp(base+ageAdj+depth+(s.star?1:0)+(R(5)-2), 50, base+6);
    const name=uniqName(frn?genEaclFrnName:()=>genNatName(def.nat));
    const pl=mkPlayer(name, s.pos, by, ovr, frn);
    pl.uid=nextGenUid();
    pl.natCode=frn?"용병":def.nat;
    /* 세부 자리를 못박는다 — 전문 풀백·윙어가 실제로 나오게 (제보) */
    try{ if(s.pref){ pl.prefPos=s.pref; pl.posFam=initPosFam(pl); syncPosBand(pl); applySpecialization(pl); retuneTraits(pl); } }catch(e){}
    t.players.push(pl);
  }
  /* 🆔 부속 정보 — 구장 · 모기업 · 감독까지 각자 고유번호를 갖는다 */
  const M=eaclMeta(def.id);
  t.stad={uid:uidEaclStadOf(def.id), n:M.stad.n, cap:M.stad.cap, avg:Math.round(M.stad.cap*0.42)};
  t.own={uid:uidEaclOwnerOf(def.id), n:M.own};
  t.coach=eaclCoach(def.id);
  t.fans=Math.round(M.stad.cap/900);
  /* ⚠ 제보(CWC·해외 구단 에디터) — 덮어쓰기는 구장·모기업을 만든 「뒤」에 얹어야 한다.
     이름만 덮던 시절 습관으로 stad 생성 전에 불러서, 구장 수정이 META 값에 도로 덮였다.
     ⚠ 제보(구단 정보 원상복구) — 팬 규모도 마찬가지였다. t.fans 를 자료값으로 다시 깔아 버려서
       에디터로 정한 팬 규모(55)가 매 시즌 30 으로 돌아갔다. 「맨 마지막」에 얹는다. */
  eaclApplyName(t, def.id);            // ✏️ 에디터에서 고쳐 둔 값이 있으면 얹는다
  try{ assignNumbers(t); }catch(e){}
  try{ assignAIRoles(t); }catch(e){}
  try{ assignAITactics(t); }catch(e){}   // 감독 성향대로 전술을 짠다 — 기본값 그대로 두면 다 똑같이 뛴다
  G.eaclClubs[id]={s:G.season, t};
  return t;
}
