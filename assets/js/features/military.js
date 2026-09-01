"use strict";
/* ═══════════════════════════════════════════════════════════════
   김천 상무 FC — 군 복무 임대
   상무 선수는 원소속 구단에서 18개월 파견 나온 신분이다. 전역일이 되면 자기 팀으로 돌아간다.
   그래서 김천은 매년 스쿼드가 통째로 갈리고, 다른 구단은 시즌 중에 전력이 불쑥 늘어난다.
   ⚠ 무소속(FA) 신분으로 입대한 선수는 돌아갈 곳이 없다 — 전역과 동시에 자유계약이 된다.
═══════════════════════════════════════════════════════════════ */
const ARMY_MONTHS=18;                 // 복무 기간
/* 🎖️ 입대 예고 — 합격 통보와 입소 사이의 시간.
   ⚠ 「현실에서도 합격하고 바로 입대하지는 않는다. 한 달 전쯤 미리 알려 줬으면 좋겠다」.
     맞는 말이다. 예전에는 선발되는 순간 선수가 스쿼드에서 사라져,
     감독은 다음 경기 라인업을 짜다가 그제야 알아차렸다.
   ─ 이제 「입영 통지」가 먼저 온다. 그 사이 선수는 우리 팀에서 계속 뛰고,
     스쿼드·달력에 D-day 가 붙는다. 대신 그동안 이적·임대는 묶인다(입영 대상자다). */
const ARMY_CALL_DAYS=30;
function armyCallLeft(p){
  if(!p || !p.armyCall || p.armyCall.at==null) return null;
  return Math.max(0, p.armyCall.at-(G.day||0));
}
function armyCalled(p){ return !!(p && p.armyCall); }
/* 2026 시즌 시작 시점의 실제 명단 — [원소속 구단, 입대일, 전역일] */
const ARMY26={
  "백종범":["seoul","2025-04-07","2026-10-06"],   "민경현":["incheon","2025-06-02","2026-12-01"],
  "박철우":["suwonfc","2025-04-07","2026-10-06"], "김현우":["daejeon","2025-06-02","2026-12-01"],
  "김민규":["seoule","2025-06-02","2026-12-01"],  "이수빈":["jeonbuk","2025-04-07","2026-10-06"],
  "고재현":["daegu","2025-04-07","2026-10-06"],   "김이석":["gangwon","2025-04-07","2026-10-06"],
  "이건희":["jeju","2025-04-07","2026-10-06"],    "전병관":["jeonbuk","2025-04-07","2026-10-06"],
  "김태환":["jeju","2025-04-07","2026-10-06"],    "박세진":["daegu","2025-04-07","2026-10-06"],
  "임덕근":["daejeon","2025-06-02","2026-12-01"], "김주찬":["suwon","2025-04-07","2026-10-06"],
  "이찬욱":["gyeongnam","2025-04-07","2026-10-06"],"김인균":["daejeon","2025-06-02","2026-12-01"],
  "이정택":["daejeon","2025-04-07","2026-10-06"], "박진성":["daejeon","2025-06-02","2026-12-01"],
  "문현호":["ulsan","2025-04-07","2026-10-06"],   "박만호":["daegu","2025-12-15","2027-06-14"],
  "홍시후":["incheon","2025-11-17","2027-05-16"], "김서진":["pohang","2025-11-17","2027-05-16"],
  "박민서":["ulsan","2025-12-15","2027-06-14"],   "변준수":["jeonbuk","2026-01-19","2027-07-18"],
  "정마호":["asan","2025-11-17","2027-05-16"],    "이상헌":["gangwon","2025-11-17","2027-05-16"],
  "홍윤상":["pohang","2025-11-17","2027-05-16"],  "강민규":["asan","2025-11-17","2027-05-16"],
  "강주혁":["seoul","2025-11-17","2027-05-16"],   "안준수":[null,"2026-01-15","2027-07-14"],
  "노경호":["suwonfc","2025-12-15","2027-06-14"], "윤재석":["ulsan","2025-12-15","2027-06-14"],
  "박태준":["gwangju","2025-06-02","2026-12-01"], "이강현":[null,"2026-01-15","2027-07-14"],
  "정재민":["seoule","2025-12-15","2027-06-14"],  "박용희":["suwonfc","2025-12-15","2027-06-14"]
};
/* ⚠ 김천 상무 FC는 이적시장에 존재하지 않는 구단이다. 선수는 전원 원소속 구단에서 파견된
   현역 군인이라 사올 수도, 팔 수도, 방출할 수도 없고 외국인은 아예 등록이 안 된다.
   그런데 AI 이적 로직이 김천을 평범한 구단으로 취급해서, 해외 시장까지 뛰어들고 있었다. */
function isArmyTeam(t){
  if(!t) return false;
  if(t.id==="gimcheon") return true;
  const c=(typeof CLUB_TYPE!=="undefined") && CLUB_TYPE[t.id];
  return !!(c && c.k==="army");
}
let _ARMY26F=null;
function armyKey(name){
  /* 개명된 이름으로도 복무 정보를 찾는다 — 원본 키를 같은 규칙으로 변환해 둔 색인 */
  if(!_ARMY26F){ _ARMY26F={}; for(const k in ARMY26) _ARMY26F[fictName(k,0)]=ARMY26[k]; }
  return ARMY26[name] || _ARMY26F[name] || null;
}
function armyAttach(t){
  if(!t || t.id!=="gimcheon") return;
  for(const p of t.players){
    const a=armyKey(p.name);
    if(a && !p.army) p.army={own:a[0], in:a[1], out:a[2]};
  }
}
function armyDaysLeft(p){
  if(!p || !p.army || !p.army.out) return null;
  const out=new Date(p.army.out+"T00:00:00");
  const now=dateOfDay(G.day||0);
  return Math.ceil((out-now)/86400000);
}
/* 🎩 은퇴 → 지도자 (요청) — 「은퇴한 선수는 일정 확률로 스태프나 코치가 된다.
   선수 시절 활약을 많이 한 선수일수록 스태프/코치 능력 상승」.
   통산 경기·능력이 확률과 지도자 능력(tier)을 함께 올린다. GK 는 GK 코치로.
   우리 구단에서 은퇴(exTid)·우리 유스 출신(exYouthTid)은 acWage 에서 할인된다. */
function retireToStaff(p, t){
  if(!p) return null;
  const age=G.season-(p.by||2000), career=p.career||0, ov=p.ovr||60;
  let pr=0.16 + Math.min(0.20, career/900) + (ov>=74?0.08:0) + (age<=38?0.03:0);
  if(Math.random()>=pr) return null;
  const role = p.pos==="GK" ? "gk" : pick(["coach","coach","coach","fit","youth","anal"]);
  const tier = clamp(9.8 + Math.max(0,ov-60)*0.09 + Math.min(2.4, career/180) + (Math.random()*1.6-0.8), 9.5, 16.5);
  const c=acMake(role, tier);
  c.n=p.name; c.age=Math.max(33, age);
  c.career=`전 ${t?t.short:"프로"} 선수 · 통산 ${career}경기`;
  c.exTid=t?t.id:null;
  if(p.ythOf) c.exYouthTid=p.ythOf;
  (G.acPool=G.acPool||[]).push(c);
  const R=AC_ROLE[role]||AC_ROLE.coach;
  const legend = ov>=76 || career>=250;
  const mine=!!(t&&t.isUser);
  if(mine || legend)
    addNews(fixJosa(`🎩 은퇴한 ${p.name}, ${R.n}(으)로 새 출발 — 지도자 시장에 이름을 올렸습니다`), mine?"good":null, "club");
  try{
    const V={p:p.name, t:t?t.short:""};
    if(mine){
      pushSocial(fixJosa(F_(pick([
        "{p} 코치 연수 받는다더니 진짜였네. 우리 벤치로 데려오자",
        "{p}이/가 지도자라니… 세월 참 빠르다. 그래도 반갑다",
        "선수 때 그 축구 지능이면 {p} 코치는 잘할 듯",
        "{p} 다시 {t} 트레이닝복 입는 그림 보고 싶다"]), V)), 1);
      fmkPush(fixJosa(F_(pick([
        "{p} 은퇴하자마자 지도자행 ㅋㅋ 부지런하네",
        "{t} 프런트 일해라 — {p} 코치 다른 팀 가기 전에 선점하자",
        "{p} 코치 데뷔하면 훈련장 개방 날 사인 받으러 간다"]), V)), 1);
    } else if(legend){
      pushSocial(fixJosa(F_(pick([
        "{p}이/가 코치로 돌아온다니, 리그가 한 바퀴 돌았구나",
        "{p} 정도 커리어면 어느 벤치든 자리 있지",
        "은퇴한 {p} 지도자 연수설이 진짜였네"]), V)), 0);
      fmkPush(fixJosa(F_(pick([
        "{p} 코치 시작한다는데 어디로 갈지 벌써 궁금하다",
        "선출 코치 중에 {p}급 커리어 흔치 않다"]), V)), 0);
    }
  }catch(e){}
  return c;
}
/* 👋 은퇴 인사 — 오래 뛴 선수가 조용히 사라지면 안 된다(제보: "노장이 갑자기 없어져가지고").
   입대 배웅과 같은 방식으로, 한 명씩 마지막 인사를 나눈다. */
let _retireQ=[];
function retireFarewell(p, t){
  _retireQ.push({p, t});
  if(_retireQ.length===1) _retireNext();
}
function _retireNext(){
  const it=_retireQ[0]; if(!it) return;
  const p=it.p, t=it.t||userTeam();
  /* 🙏 은퇴 번복 (요청) — 「호감도가 100일 경우 선수를 설득해서 은퇴 번복 가능 (45세까지)」.
     각별한 신뢰(호감도 100)를 쌓은 감독만 쓸 수 있는 카드다. 45세부터는 몸이 먼저 끝난다. */
  const _age0=G.season-p.by;
  if(!it.asked && aff(p)>=100 && _age0<45){
    it.asked=1;
    showConfirm(`👋 <b>${p.name}, 은퇴를 알리러 왔습니다</b>\n\n`
      +`"감독님께 제일 먼저 말씀드리고 싶었습니다. 이제 그만 내려놓으려 합니다."\n\n`
      +`<span class="small">${POS_KO[p.pos]||p.pos} · ${_age0}세 · 통산 ${p.career||0}경기 · 호감도 ${Math.round(aff(p))}</span>\n\n`
      +`감독과의 신뢰가 각별합니다 — 한 시즌만 더 뛰어 달라고 붙잡아 볼 수 있습니다.`,
      ()=>{
        t.players.push(p);
        p.ct=Math.max(p.ct||0,1); p.morale=clamp((p.morale||70)+8,20,99);
        addMood(fixJosa(`🙏 ${p.name}: "…감독님이 그렇게까지 말씀하시니, 한 시즌 더 달려 보겠습니다."`));
        addNews(fixJosa(`🙏 <b>${p.name}</b>, 은퇴 번복 — 감독의 설득에 ${_age0}세 시즌을 더 뛰기로 했습니다`),"good","club");
        try{
          const V={p:p.name, t:t.short};
          pushSocial(fixJosa(F_(pick([
            "{p} 은퇴 번복 ㅋㅋㅋ 감독이 잡았다는데 이게 사람 관리지",
            "{p} 한 시즌 더!!! 유니폼 한 장 더 사야겠다",
            "감독이 직접 붙잡았다는 {p} 기사 봤냐. 낭만 있다"]), V)), 1);
          fmkPush(fixJosa(F_(pick([
            "{p} 은퇴 번복은 감독 리더십 인정해야 한다",
            "{t} {p} 한 시즌 더 간다 ㄷㄷ 노장의 품격 보여줘라"]), V)), 1);
        }catch(e){}
        _retireQ.shift(); saveGame(); setTimeout(_retireNext, 60);
      },
      {okLabel:"🙏 「한 시즌만 더 같이 갑시다」 (은퇴 번복)",
       cancelLabel:"👋 뜻을 존중한다 (배웅으로)",
       onCancel:()=>{ setTimeout(_retireNext, 0); }});
    return;
  }
  /* 🎽 ⚠ 요청 원문 — 「선수가 은퇴할 때 영구결번할 거냐 묻는 옵션이 생겼으면 좋겠습니다.
     보통 영결은 선수 은퇴할 때 하는데 게임에서는 현역 선수만 영결이 가능하다 보니,
     은퇴할 때쯤 영결해 줘야지 싶었던 선수가 은퇴해 버려서 결국 영결을 못 해 주는 문제가 생긴다」.
     ─ 배웅 인사를 마친 뒤, 자격이 되는 선수에 한해 한 번 더 묻는다. */
  const done=(fn)=>{ try{ fn(); }catch(e){} try{ retireToStaff(p, t); }catch(e){}   /* 🎩 배웅이 끝난 뒤 지도자 전직을 굴린다 (요청) */
    retireNoAsk(p, t, ()=>{ _retireQ.shift(); saveGame(); setTimeout(_retireNext, 60); }); };
  const nm=p.name, age=G.season-p.by, yrs=Math.max(1, Math.round((p.career||0)/34));
  const legend=(p.apps||0)>=25 || (p.ovr||0)>=74;
  const say=pick(legend
    ? [`"감독님, 이제 그만 뛰려고 합니다. 몸이 먼저 알더군요."`,
       `"마지막 한 시즌만 더… 하고 싶었는데, 여기까지가 제 축구인 것 같습니다."`,
       `"라커룸 냄새가 제일 그리울 겁니다. 진심으로 감사했습니다."`]
    : [`"저는 여기까지입니다. 감독님 밑에서 뛴 시간, 잊지 않겠습니다."`,
       `"더 보여드리지 못해 죄송합니다. 이제 그만 내려놓으려 합니다."`]);
  showConfirm(`👋 <b>${nm}, 은퇴를 알리러 왔습니다</b>\n\n${say}\n\n<span class="small">${POS_KO[p.pos]||p.pos} · ${age}세 · 통산 ${p.career||0}경기${(p.apps||0)?` · 올 시즌 ${p.apps}경기 ${p.goals||0}골`:""}</span>\n\n어떻게 보내시겠습니까?`,
    ()=>done(()=>{      // 🤝 예우
      addMood(fixJosa(`👋 ${nm}이/가 은퇴합니다. 선수단 전원이 도열해 박수로 배웅했습니다.`));
      try{ t.morale=clamp(t.morale+1.5,40,99); }catch(e){}
      addNews(fixJosa(`👋 <b>${nm}</b>, ${age}세로 현역 은퇴 — ${t.short}이/가 도열 박수로 배웅했습니다 (통산 ${p.career||0}경기)`),"good","club");
      const V={p:nm, t:t.short};
      try{
        socialFill(legend?SOC.retireBig:SOC.retire, legend?(3+R(2)):2, 1, V);
        fmkFill(legend?FMK.retireBig:FMK.retire, legend?(2+R(2)):1, V);
        if(legend) rivalFill(RIV.retireBig, 1+R(2), 1, V);   // 남의 팬도 레전드에겐 박수를 보낸다
      }catch(e){}
      if(legend) try{ adjustTrust("fans",+2,`${nm} 은퇴 예우`); }catch(e){}
    }),
    {okLabel:"🤝 「고생 많았습니다. 도열해서 배웅합시다」",
     cancelLabel:"🙂 「수고했어요」 (짧게 인사한다)",
     onCancel:()=>done(()=>{
      addMood(fixJosa(`👋 ${nm}이/가 조용히 팀을 떠났습니다.`));
      addNews(fixJosa(`👋 ${nm}, ${age}세로 현역 은퇴 (통산 ${p.career||0}경기)`), null, "club");
      const V={p:nm, t:t.short};
      try{
        /* 오래 뛴 선수를 짧게 보내면 팬들이 서운해한다 */
        if(legend){
          socialFill(SOC.retireCold, 2+R(2), -1, V);
          fmkFill(FMK.retireBig, 1+R(2), V);
          rivalFill(RIV.retireBig, 1+R(1), 1, V);
          try{ adjustTrust("fans",-2,`${nm} 은퇴 홀대`); }catch(e){}
        } else socialFill(SOC.retire, 1+R(2), 0, V);
      }catch(e){}
     })});
}
/* 🎽 은퇴 선수 영구결번 — 자격이 되면 배웅 직후에 묻는다 (요청).
   ⚠ retireNumber() 는 t.players 에서 선수를 찾는다. 은퇴 처리 중에는 이미 명단에서 빠졌을 수
      있으므로, 선수 객체를 직접 받는 전용 경로를 둔다. */
function retireNoEligible(p, t){
  try{
    if(!p || !t || !p.no) return false;
    if(isRetiredNo(t, p.no)) return false;
    if((p.career||0)>=120) return true;                      // 오래 뛴 선수
    if((p.ovr||0)>=78) return true;                          // 리그를 대표하던 선수
    if(p.acc && ((p.acc.xi|0)>0 || (p.acc.mvp|0)>0 || (p.acc.top|0)>0)) return true;   // 수상 이력
    return false;
  }catch(e){ return false; }
}
function retireNoAsk(p, t, next){
  const go=()=>{ try{ next&&next(); }catch(e){} };
  try{
    t=t||userTeam();
    if(!retireNoEligible(p, t)) return go();
    const n=p.no, nm=p.name, age=G.season-p.by;
    showConfirm(`<b>🎽 ${nm}의 ${n}번을 영구결번으로 남기시겠습니까?</b>\n\n`
      + `${POS_KO[p.pos]||p.pos} · ${age}세 은퇴 · 통산 ${p.career||0}경기\n\n`
      + `<span class="small">· 이 번호는 앞으로 어떤 선수도 달 수 없습니다\n`
      + `· 팬과 선수단이 이 결정을 기억합니다\n`
      + `· 나중에 스태프 회의에서 해제할 수 있습니다</span>`,
      ()=>{ try{ retireNoGrant(p, t); }catch(e){} go(); },
      {okLabel:`🎽 ${n}번을 영구결번으로`, cancelLabel:"아니오", onCancel:go});
  }catch(e){ go(); }
}
function retireNoGrant(p, t){
  t=t||userTeam(); if(!t || !p || !p.no) return;
  const n=p.no, nm=p.name;
  if(isRetiredNo(t, n)) return;
  retiredList(t).push({n, who:nm, why:`${G.season}시즌 은퇴`, s:G.season, ret:true});
  for(const q of t.players) q.morale=clamp(q.morale+1,20,99);
  notify(`🎽 <b>${nm}</b> 선수의 <b>${n}번</b>이 영구결번으로 지정되었습니다`,"good");
  addNews(fixJosa(`🎽 <b>${t.short} ${n}번</b>, 영구결번 — ${nm}의 은퇴와 함께 이 번호는 비워집니다 (통산 ${p.career||0}경기)`), "good", "club");
  try{
    pushFeed({cat:"club", ic:"🎽", tone:1, tid:t.id, src:"K리그 공식",
      head:`${t.name}, 은퇴하는 ${nm}의 ${n}번 영구결번`,
      sub:`구단은 "이 번호는 앞으로 누구도 달지 않는다"고 밝혔다.`});
  }catch(e){}
  const V={p:nm, t:t.short, n};
  /* 🎽 은퇴 전용 반응 — 현역 결번 풀도 섞어 같은 문장이 반복되지 않게 한다 (요청) */
  try{
    socialFill((SOC.retireNoBye||[]).concat(SOC.retireNo||[]), 5+R(3), 1, V);
    fmkFill((FMK.retireNoBye||[]).concat(FMK.retireNo||[]), 3+R(3), V);
    rivalFill((SOC.retireNoByeRiv||[]).concat(FMK.retireNo||[]), 2+R(2), 1, V);
  }catch(e){}
  try{ adjustTrust("fans", +3, `${nm} 영구결번`); }catch(e){}
  try{ staffLog(`은퇴하는 ${nm}의 ${n}번을 영구결번으로 지정했습니다.`); }catch(e){}
}
/* 🎖️ 입대 배웅 — 내 선수가 김천 상무로 떠날 때, 훈련소 가기 전 마지막 인사.
   여러 명이 같은 날 뽑혀도 한 명씩 차례로 인사한다. */
let _armyByeQ=[];
function armyFarewell(p){
  _armyByeQ.push(p);
  if(_armyByeQ.length===1) _armyByeNext();
}
function _armyByeNext(){
  const p=_armyByeQ[0]; if(!p) return;
  const done=(fn)=>{ try{ fn(); }catch(e){} _armyByeQ.shift(); saveGame(); setTimeout(_armyByeNext, 60); };
  const nm=p.name, age=G.season-p.by;
  const say=pick([
    `"감독님… 다녀오겠습니다. ${ARMY_MONTHS}개월, 금방입니다."`,
    `"머리는 이미 밀고 왔습니다. 훈련소 들어가기 전에 인사드리고 싶었습니다."`,
    `"상무에서도 리그는 계속 뜁니다. 폼 안 죽이고 돌아오겠습니다."`,
    `"입대 영장 나왔을 때 잠이 안 왔는데… 막상 가려니 팀이 벌써 그립습니다."`]);
  showConfirm(`🎖️ <b>${nm}, 입대 인사를 하러 왔습니다</b>

${say}

<span class="small">${POS_KO[p.pos]||p.pos} · ${age}세 · 김천 상무 FC — ${ARMY_MONTHS}개월 복무 후 복귀</span>

어떻게 배웅하시겠습니까?`,
    ()=>done(()=>{      // 🤝 따뜻한 배웅 — 호감도·사기, 라커룸 분위기까지
      affAdd(p, +10, "입대 배웅");
      p.morale=clamp((p.morale||70)+9,25,99);
      addMood(`🎖️ ${nm}의 입대를 온 팀이 배웅했습니다. "네 자리는 비워 두겠다"는 감독의 말에 라커룸이 뭉클해졌습니다.`);
      fmkPush(`${nm} 입대 배웅 사진 떴는데 감독이 직접 안아줌ㅠㅠ 이런 게 구단이지`, 1);
      addNews(`🎖️ ${userTeam()?userTeam().short:""} 구단, ${nm} 입대 배웅식 — "전역하면 그대로 우리 선수"`, "good", "club");
    }),
    {okLabel:"🤝 「몸 건강히. 네 자리는 비워 두겠다」",
     cancelLabel:"💪 「가서도 폼 유지해라. 뛰고 있어야 돌아와서도 뛴다」",
     onCancel:()=>done(()=>{   // 프로다운 배웅 — 담백하지만 진심
      affAdd(p, +5, "입대 배웅");
      p.morale=clamp((p.morale||70)+4,25,99);
      addMood(`🎖️ ${nm}이 입대했습니다. 감독의 담백한 배웅 — "상무에서도 넌 우리 선수다."`);
      fmkPush(`${nm} 상무 입대 확정. 거기서 꾸준히 뛰고 오면 오히려 이득임`, 0);
     })});
}
/* 🧑‍💼 타구단 감독의 뜬금 언급 — 일정을 돌리다 보면 어느 날 문득 뉴스가 뜬다.
   친밀도가 높으면 칭찬, 낮으면 비난, 중간이면 "요즘 그 팀 축구를 눈여겨보고 있다"는 관찰.
   소셜(FMK)도 함께 반응한다. */
/* 💬 상대 감독의 맞발언 — 내 발언이 하루 이틀 뒤 되돌아온다. 뉴스 + 양 팀 팬 반응 */
function coachReplyFire(rp){
  const t2=G.teams[rp.tid], c=COACHES[rp.tid], ut=userTeam(); if(!t2||!c||!ut) return;
  const cn=c.n, V={c:cn, o:t2.short, t:ut.short};
  let msg, tone=0;
  if(rp.kind==="taunt"){
    msg=pick([`"말은 경기장에서 하는 겁니다. 시대가 갔는지는 ${ut.short}와 만나는 날 알게 되겠죠."`,
              `"밑천이라… 곧 누구 바닥이 먼저 드러나는지 보게 될 겁니다."`]);
    coachRelAdd(rp.tid,-5); tone=-1;
  } else if(rp.kind==="salaryScorn"){
    msg=pick([`"제 연봉이 아까우면 그쪽이 성적으로 증명하시면 됩니다. 경기장에서 뵙죠."`,
              `"축구인의 밥그릇을 조롱하는 건 후배들 앞에서 부끄러운 일입니다. 그 말, 오래 기억하겠습니다."`]);
    coachRelAdd(rp.tid,-8); tone=-1;
  } else if(rp.kind==="salary"){
    msg=pick([`"제 연봉이 궁금하시면 성적표부터 비교해 보시죠. 그쪽이 더 빠를 겁니다."`,
              `"돈 이야기를 꺼내신 건 그쪽입니다. 저는 축구 이야기만 하겠습니다."`]);
    coachRelAdd(rp.tid,-6); tone=-1;
  } else if(rp.kind==="scorn"){
    msg=pick([`"저희 축구가 마음에 안 드셨다니 유감입니다. 다만 이긴 건 저희였죠."`,
              `"이기는 축구가 좋은 축구입니다. 다음에도 그렇게 하겠습니다."`]);
    coachRelAdd(rp.tid,-5); tone=-1;
  } else if(rp.kind==="boring"){
    msg=pick([`"재미없는 축구가 이기는 축구입니다. 결과로 보여드리죠."`,
              `"남의 축구 평가할 시간에 자기 수비나 다듬으시길."`]);
    coachRelAdd(rp.tid,-4); tone=-1;
  } else if(rp.kind==="dislike"){
    msg=`"나도 그 감독을 좋아할 이유가 없습니다. 피차 마찬가지죠."`;
    coachRelAdd(rp.tid,-3); tone=-1;
  } else if(rp.kind==="rival"){
    msg=`"라이벌이라니 영광입니다. 다음 맞대결이 벌써 기다려지는군요."`;
    coachRelAdd(rp.tid,+3); tone=1;
  } else {
    msg=`"${ut.short} 감독 역시 훌륭한 지도자입니다. 좋은 말은 늘 고맙지요."`;
    coachRelAdd(rp.tid,+4); tone=1;
  }
  addNews(`💬 [맞발언] ${cn} 감독 — ${msg}`, tone<0?"warn":tone>0?"good":null, "club");
  if(tone<0){
    fmkFill([[`${cn}이 우리 감독한테 받아침 ㅋㅋㅋ 설전 개꿀잼`,0],[`${cn} 발언 보소. 이건 경기로 조져야 한다`,-1]],2,V);
    fmkFill([[`${cn} 감독 사이다 ㅋㅋㅋ 잘 받아쳤다`,1],[`우리 감독 말빨 살아있네`,1]],2,V,"rival");
  } else {
    fmkFill([[`감독들 서로 덕담 주고받는 거 보기 좋다`,1]],1,V);
    fmkFill([[`${cn} 감독 품격 보소. 이런 게 어른이지`,1]],1,V,"rival");
  }
  saveGame();
}
function tickCoachTalk(){
  const ut=userTeam(); if(!ut || G.jobless || G.phase!=="league") return;
  if(G.coachReply && (G.day||0)>=G.coachReply.due){
    const rp=G.coachReply; G.coachReply=null;
    try{ coachReplyFire(rp); }catch(e){}
  }
  if(Math.random()>=0.022) return;                       // 대략 6~7주에 한 번
  const cands=Object.keys(COACHES).filter(id=>{ const t2=G.teams[id]; return t2 && !t2.isUser && t2.div===ut.div; });
  if(!cands.length) return;
  const tid=pick(cands), c=COACHES[tid], t2=G.teams[tid];
  const rel=coachRel(tid), V={c:c.n, o:t2.short, t:ut.short};
  if(rel>=60){
    addNews(fixJosa(pick([
      `💬 ${c.n} 감독 "${ut.short}의 축구, 요즘 K리그에서 가장 인상적이다" — 공개 칭찬`,
      `💬 ${c.n} 감독 "${ut.short} 감독은 준비가 된 지도자다. 배울 점이 많다"`,
      `💬 ${c.n} 감독, 인터뷰에서 ${ut.short} 언급 — "그 팀은 감독의 색깔이 분명하다"`])), "good", "club");
    fmkFill([[`${c.n}이 우리 감독 칭찬함 ㅋㅋ 어깨 올라가는 소리 들린다`,1],
             [`타팀 감독한테 인정받는 거 이게 진짜지`,1],
             [`${c.n} 보는 눈 있네`,0]], 2, V);
    if(Math.random()<0.5){ ut.morale=clamp(ut.morale+1,40,99); }
  } else if(rel<40){
    addNews(fixJosa(pick([
      `📰 ${c.n} 감독 "${ut.short}의 축구? 글쎄, 결과가 다는 아니다" — 뼈 있는 발언`,
      `📰 ${c.n} 감독, ${ut.short} 감독 공개 저격 — "그런 식의 축구는 오래 못 간다"`,
      `📰 ${c.n} 감독 "${ut.short}는 과대평가됐다. 곧 드러날 것"`])), "warn", "club");
    fmkFill([[`${c.n} 저 인간 또 우리 저격함 ㅋㅋ 신경 쓰이나 봄`,0],
             [`${c.n} 발언 수위 보소... 다음에 만나면 밟아야 한다`,-1],
             [`무시가 답이다. 실력으로 조지자`,0]], 2, V);
  } else {
    addNews(fixJosa(pick([
      `👀 ${c.n} 감독 "최근 ${ut.short}의 경기를 집중적으로 보고 있다" — 심상치 않은 관심`,
      `👀 ${c.n} 감독, ${ut.short}전 대비 전력 분석 착수설 — "그 팀은 철저히 준비해야 하는 상대"`])), null, "club");
    fmkFill([[`${c.n}이 우리 경기 챙겨본다는데 뭔가 쎄하다`,0],
             [`분석당하고 있다는 건 그만큼 위협적이라는 거임 ㅋㅋ`,1]], 1, V);
  }
  saveGame();
}
/* 오늘 전역하는 선수를 원소속으로 돌려보내고, 그 자리를 새 입대 자원으로 채운다 */
function tickArmy(){
  const gc=G.teams&&G.teams.gimcheon; if(!gc) return;
  armyAttach(gc);
  const ut=userTeam();
  const go=gc.players.filter(p=>p.army && p.army.out && armyDaysLeft(p)<=0);
  if(!go.length) return;
  const backTo={};
  for(const p of go){
    gc.players.splice(gc.players.indexOf(p),1);
    const own=p.army.own && G.teams[p.army.own];
    const nm=p.name;
    p.army=null; p.armyDone=1;   // 병역은 한 번뿐 — 다시 뽑히지 않는다
    p.morale=clamp((p.morale||70)+6,25,99); p.inj=0; p.injUntil=null; delete p.injW0; p.ban=0; p.sulk=0;
    if(own){
      own.players.push(p); joinClub(own, p, false);   // 전역 복귀 — 재계약 잠금 없음
      p.ct=Math.max(p.ct||1, 1);
      (backTo[own.id]=backTo[own.id]||[]).push(nm);
      if(own.isUser){
        notify(`🎖️ <b>${nm}</b> 선수가 전역해 복귀했습니다. <span class="small">(${POS_KO[p.pos]||p.pos} · ${G.season-p.by}세)</span>`,"good");
        addMood(`🎖️ ${nm} 선수가 군 복무를 마치고 팀에 돌아왔습니다. 라커룸이 반갑게 맞이합니다.`);
      }
    } else {
      /* 무소속으로 입대한 선수 — 돌아갈 팀이 없어 그대로 FA */
      (G.freeAgents=G.freeAgents||[]).push(p);
      addNews(`🎖️ ${nm} 선수가 전역했습니다. 입대 당시 무소속이라 <b>자유계약(FA)</b> 신분이 됩니다.`, null, "club");
    }
  }
  for(const tid in backTo)
    addNews(`🎖️ ${G.teams[tid].short}, 전역 복귀 ${backTo[tid].length}명 — ${backTo[tid].join(", ")}`, "good", "club");
  if(gc.isUser){
    notify(`🎖️ <b>${go.length}명이 전역했습니다.</b> ${go.map(p=>p.name).join(", ")} <span class="small">— 군팀의 숙명입니다. 새 입대 자원이 곧 합류합니다.</span>`,"warn");
    addMood(`🎖️ ${go.length}명이 한꺼번에 전역했습니다. 남은 선수들의 어깨가 무거워졌습니다.`);
  }
  /* 🎖️ ⚠ 제보 — 「전역 팝업이 안 뜬다(입대는 뜬다)」.
     전역 처리는 notify(뉴스+배너)로만 끝났다. 일정 진행 중에는 배너가 다음 화면 전환에 묻혀
     감독이 「내 선수가 돌아왔다」는 걸 모르고 지나갔다. 입대는 멈춤 처리가 있었지만 전역은 없었다.
     ─ 내 선수가 걸린 전역이면 진행을 멈추고 알린다. */
  try{
    const mine=[];
    for(const tid in backTo) if(G.teams[tid] && G.teams[tid].isUser) mine.push(...backTo[tid]);
    if(gc.isUser) mine.push(...go.map(p=>p.name));
    if(mine.length) G.armyBack={n:mine.length, names:mine.slice(0,6), gone:gc.isUser?go.length:0};
  }catch(e){}
  armyIntake(gc, go.length);
  saveGame();
}
/* 새 입대 — 리그 전체에서 스쿼드가 두꺼운 구단의 젊은 선수를 데려온다.
   실제로도 출전이 막힌 20대 초중반 선수들이 병역을 해결하러 들어온다. */
function armyIntake(gc, n){
  /* 감독이 직접 맡은 부대라면 사람을 마음대로 붙여 주지 않는다 — 자리를 비워 두고 직접 뽑게 한다 */
  if(gc.isUser){
    notify(`🎖️ 전역으로 <b>${n}자리</b>가 비었습니다 — 💸 이적시장 → 🎖️ 입대 지원 탭에서 선발하세요.`,"warn");
    return;
  }
  const out=new Date(dateOfDay(G.day||0));
  out.setMonth(out.getMonth()+ARMY_MONTHS);
  const outStr=`${out.getFullYear()}-${String(out.getMonth()+1).padStart(2,"0")}-${String(out.getDate()).padStart(2,"0")}`;
  const inStr=dateOfDay(G.day||0).toISOString().slice(0,10);
  const cands=[];
  for(const id in G.teams){
    const t=G.teams[id];
    if(id==="gimcheon" || t.players.length<=22) continue;
    for(const p of t.players){
      const age=G.season-p.by;
      /* 🎖️ ⚠ 제보 원문 — 「홈그로운 외국인 선수가 김천상무로 입대하는데 수정 부탁드리겠습니다」.
         홈그로운(hg)은 「외국인 쿼터를 차지하지 않는다」는 등록상의 취급일 뿐 국적은 외국이다.
         병역은 국적의 문제라 frnQ(쿼터 기준)로 거르면 홈그로운 용병이 그대로 뽑혔다.
         ─ 입대 자격은 p.frn(국적) 으로 판정한다. */
      if(age<20 || age>26 || p.loan || p.frn || p.armyDone || p.armyCall) continue;
      cands.push({p, t, sc: p.ovr - (p.apps||0)*0.35 - (t.isUser?6:0)});   // 안 뛰는 선수부터
    }
  }
  cands.sort((a,b)=>b.sc-a.sc);
  const taken=[];
  for(const c of cands){
    if(taken.length>=n) break;
    if(c.t.players.length<=22) continue;
    /* 📨 즉시 데려가지 않는다 — 입영 통지를 보내고 한 달 뒤에 데려간다 */
    armySetCall(c.p, c.t, gc);
    taken.push({p:c.p, from:c.t});
    if(c.t.isUser){
      /* 통지는 armySetCall 이 이미 띄웠다 — 여기서는 배웅하지 않는다(아직 안 갔다) */
    } else if(Math.random()<0.30){
      /* 타 구단 선수의 입대도 커뮤니티는 안다 */
      fmkPush(pick([`${c.p.name} 상무 간다며 ㅋㅋ 머리 민 거 봤냐`,
                    `${c.from?c.from.short:c.t.short} ${c.p.name} 입대라니… 전역하면 폼 어떨지`,
                    `상무 이번 픽 ${c.p.name} ㅇㅇ 거기서 터지는 선수 은근 많다`]), 0);
    }
  }
  if(taken.length) addNews(`🎖️ 김천 상무 FC, ${G.season} 신규 입대 ${taken.length}명 — ${taken.map(x=>`${x.p.name}(${x.from.short})`).join(", ")}`, null, "club");
}
