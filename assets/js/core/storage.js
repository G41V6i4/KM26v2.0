"use strict";
/* ---------- 저장 ---------- */
function stripCaches(){
  for(const id in G.teams){ const t=G.teams[id];
    delete t._xiC; delete t._xiCK; delete t._xiCf; delete t._xiCKf; delete t._planBase0;
    delete t._autoSlots; delete t._autoForm;
    delete t._suSet; delete t._suMap; delete t._suN;
  }   // 선수별 slotRating 캐시는 _SR_CACHE(Map)에 있으므로 세이브에 딸려 나가지 않는다
  /* 🥗 자리별 능숙도 — 열여섯 자리 중 대부분이 0 이다. 0 은 저장하지 않는다.
     읽는 쪽이 전부 `posFam[k]||0` 이라 없는 자리는 자연히 0으로 읽힌다(손실 없음).
     ⚠ 제보 — 「5MB가 넘어가면 다른 기기로 못 옮긴다」. 세이브를 가볍게 만드는 쪽도 함께 손본다. */
  try{
    const trim=(arr)=>{ if(!Array.isArray(arr)) return;
      for(const p of arr){ const f=p&&p.posFam; if(!f) continue;
        for(const k in f) if(!(f[k]>0)) delete f[k]; } };
    for(const id in G.teams) trim(G.teams[id].players);
    trim(G.freeAgents); trim(G.overseas); trim(G.youthPool); trim(G.retired);
    if(G.scout) trim(G.scout.list);
    for(const k in (G.eaclClubs||{})){ const c=G.eaclClubs[k]; trim(c && c.t && c.t.players); }
    for(const k in (G.cwcClubs||{})){ const c=G.cwcClubs[k]; trim(c && c.t && c.t.players); }
    /* 🌍 대회가 끝나면 그 시즌 클럽 스쿼드는 세이브에 남길 이유가 없다 — 640명이 통째로 붙는다.
       ⚠ 참가 클럽만 남기고, 대회가 종료됐으면 전부 버린다. 다음 시즌엔 새로 만든다. */
    try{
      if(!G.cwc || G.cwc.s!==G.season || G.cwc.stage==="end"){ G.cwcClubs={}; }
      else {
        const keep={}; for(const id of (G.cwc.teams||[])){
          const k=String(id).replace(/^cwc_/,"");
          if(G.cwcClubs && G.cwcClubs[k]) keep[k]=G.cwcClubs[k]; }
        G.cwcClubs=keep;
      }
    }catch(e){}
  }catch(e){}
}
/* ═══════════════════════════════════════════════════════════════
   세이브 호환 — 옛 파일을 새 버전에서 열 때
   깃허브에 올린 html 을 갱신하면, 감독이 예전에 내려받아 둔 .json 세이브에는 그 사이 추가된
   항목(군 복무 정보·특성 경험치·해외 시장·더비 상태 …)이 통째로 없다. 없는 값을 그대로 읽으면
   화면이 죽거나 조용히 이상하게 굴러간다. 여는 시점에 빠진 것을 전부 채워 넣는다.
   ⚠ 규칙: 여기서는 "없으면 만든다"만 한다. 이미 있는 값은 절대 덮어쓰지 않는다.
═══════════════════════════════════════════════════════════════ */
const SAVE_VER=8;   // 8 = 🆔 고유번호(UID) 세대
/* 🆔 UID 정합성 — 불러오기·새 시즌마다 돌린다.
   ① 없는 번호를 채운다 — 실존 선수는 새 게임과 「완전히 같은 규칙·같은 순서」로 계산하므로,
      구버전(실명) 세이브를 불러와도 새 게임과 똑같은 번호가 나온다.
   ② 겹치는 번호는 뒤에 온 쪽을 생성 번호(900000+)로 밀어낸다 — 파일 매칭이 엉키지 않게.
   ③ 생성 번호 카운터를 실제 최댓값 위로 올려 둔다 — 새로 만드는 선수와 충돌 방지.
   반환값은 진단용 요약이다(채움/중복정리 건수). */
function uidIntegrity(){
  const res={filled:0, deduped:0, total:0};
  if(!G || !G.teams) return res;
  const used=new Set(); const dupFix=[];
  /* 소속 팀 순서를 새 게임(D1→D2)과 맞춘다 — 충돌 회피 순서까지 같아야 번호가 일치한다 */
  const order=[];
  try{ for(const d of D1) if(G.teams[d.id]) order.push(d.id); }catch(e){}
  try{ for(const d of D2) if(G.teams[d.id] && order.indexOf(d.id)<0) order.push(d.id); }catch(e){}
  for(const id in G.teams) if(order.indexOf(id)<0) order.push(id);
  const pass=(arr, salt)=>{ if(!Array.isArray(arr)) return;
    for(const p of arr){ if(!p) continue;
      res.total++;
      if(p.uid==null){ p.uid=uidForReal(p.name, p.by, p.bd||"", salt, used); res.filled++; }
      else if(used.has(+p.uid)) dupFix.push(p);
      else used.add(+p.uid);
    } };
  for(const id of order) pass(G.teams[id].players, id);
  pass(G.freeAgents,"fa"); pass(G.overseas,"os");
  /* 🌏 EACL 클럽 선수도 같은 번호 공간을 쓴다 — 빼먹으면 uidSeq가 되감겨 번호가 겹친다 */
  try{ for(const k in (G.eaclClubs||{})) pass(G.eaclClubs[k] && G.eaclClubs[k].t && G.eaclClubs[k].t.players, "eacl:"+k); }catch(e){}
  pass(G.scout&&G.scout.list,"scout"); pass(G.youthPool,"youth");
  let mx=UID_GEN-1; for(const u of used) if(u>mx) mx=u;
  if(!G.uidSeq || G.uidSeq<=mx) G.uidSeq=Math.max(UID_GEN, mx+1);
  for(const p of dupFix){ p.uid=nextGenUid(); used.add(+p.uid); res.deduped++; }
  return res;
}
function migrateSave(){
  /* 📈 잠재력 정합성 — 종합이 잠재를 넘어선 채 저장된 세이브를 바로잡는다
     (임대 복귀 보너스 등으로 종합만 오른 경우) */
  try{ if(G&&G.teams){
    const fixPot=(arr)=>{ if(!Array.isArray(arr)) return;
      for(const p of arr) if(p && (p.pot||0) < (p.ovr||0)) p.pot=p.ovr; };
    for(const id in G.teams) fixPot(G.teams[id].players);
    fixPot(G.freeAgents); fixPot(G.overseas); fixPot(G.youthPool);
    if(G.scout) fixPot(G.scout.list);
  } }catch(e){}
  /* 🚑 부상 회복 예정일 백필 — 날짜 기반으로 바뀌기 전 세이브 (경기를 치러야만 회복되던 시절) */
  try{ if(G&&G.teams) for(const id in G.teams) for(const p of (G.teams[id].players||[]))
    if(p.inj>0 && p.injUntil==null) p.injUntil=(G.day||0)+p.inj*7; }catch(e){}
  if(!G || !G.teams) return;
  const from=G.ver||0;
  try{ uidIntegrity(); }catch(e){}
  try{ acEnsure(); }catch(e){}      // 🎩 수석코치 인물화 — 예전 세이브에 사람을 붙여 준다

  /* 에디터로 바꾼 감독 이름 복원 — COACHES 는 코드 상수라 세이브에서 다시 입힌다 */
  try{ if(G.coachNames) for(const id in G.coachNames) if(COACHES[id]) COACHES[id].n=G.coachNames[id]; }catch(e){}
  /* 에디터로 바꾼 감독 능력치도 되살린다 */
  try{ if(G.coachAttrs) for(const id in G.coachAttrs){ const c=COACHES[id]; if(!c) continue;
    for(const k in G.coachAttrs[id]){ const v=G.coachAttrs[id][k];
      if(typeof v==="number" && ["tac","flex","att","def","man","dev","judg","ovr"].indexOf(k)>=0) c[k]=clamp(Math.round(v),1,20); } } }catch(e){}
  /* 🎩 FM 24개 표로 고친 감독 능력치 — 옛 키보다 「뒤에」 입혀야 파생이 그걸 이긴다 (요청) */
  try{ if(G.coachSA) for(const id in G.coachSA){ const c=COACHES[id]; if(!c) continue;
    if(acNeedSeed(c)) acSeedFromLegacy(c);
    for(const k in G.coachSA[id]){ const v=G.coachSA[id][k];
      if(typeof v==="number" && SA_KEYS.indexOf(k)>=0) c.a[k]=clamp(Math.round(v),1,20); }
    acSync(c); c.ovr=Math.round((c.tac+c.flex+c.att+c.def+c.man+c.dev+c.judg)/7);
  } }catch(e){}
  /* 김찬영(부천 GK) 리그 명단 제외 — 기존 세이브에도 반영 (UID 332520) */
  try{
    const bc=G.teams.bucheon;
    if(bc && bc.players) bc.players=bc.players.filter(p=>!(+p.uid===332520 || (p.name==="김찬영"&&p.pos==="GK"&&p.by===2007)));
    if(Array.isArray(G.freeAgents)) G.freeAgents=G.freeAgents.filter(p=>+p.uid!==332520);
  }catch(e){}
  /* 어정원(포항) 만능 유틸 개편 — 기존 세이브에도 반영 (중복 생성분은 제거) */
  try{
    const ph=G.teams.pohang;
    if(ph && ph.players){
      const dup=ph.players.filter(p=>p.name==="어정원");
      if(dup.length>1) ph.players=ph.players.filter(p=>p.name!=="어정원" || p===dup[0]);
      const uj=ph.players.find(p=>p.name==="어정원");
      if(uj && !uj._v2Util){ applyTweakObj(uj, PLAYER_TWEAK["pohang:어정원"]); uj._v2Util=1; }
    }
  }catch(e){}
  /* 대전 수비진 능숙도 보정 — 기존 세이브에도 반영 */
  try{
    const dj=G.teams.daejeon;
    if(dj && dj.players){
      const FIX={"박규현":"DL","안톤":"DC","조성권":"DC","서영재":"DL"};
      for(const p of dj.players){
        const k=FIX[p.name];
        if(k){ if(!p.posFam) p.posFam=initPosFam(p); p.posFam[k]=Math.max(p.posFam[k]||0,100); }
      }
    }
  }catch(e){}
  /* 마르쿠스(경남)·오베르단(전북) — 스쿼드를 떠나 외국인 이적시장으로 (기존 세이브 반영) */
  try{
    const gn=G.teams.gyeongnam;
    if(gn && gn.players) gn.players=gn.players.filter(p=>!(p.name==="마르쿠스"&&p.frn));
    if(Array.isArray(G.overseas)) G.overseas=G.overseas.filter(p=>p.osKey!=="마르쿠스"&&p.name!=="마르쿠스");
    /* 레안드로 — 해외 시장에서 인천 유나이티드로 */
    const ic=G.teams.incheon;
    if(ic && ic.players && !ic.players.some(p=>p.name==="레안드로")){
      const wasOs=Array.isArray(G.overseas) ? G.overseas.find(p=>(p.osKey||p.name)==="레안드로") : null;
      if(Array.isArray(G.overseas)) G.overseas=G.overseas.filter(p=>(p.osKey||p.name)!=="레안드로");
      if(!(G.osGone||[]).includes("레안드로")){   // 이미 어딘가로 이적한 세이브면 건드리지 않는다
        let lp=wasOs;
        if(lp){ delete lp.osClub; delete lp.osNat; delete lp.osFee; delete lp.osNote; delete lp.osWage; delete lp.osKey; delete lp.osTier; delete lp.osPool; delete lp.osEggs; }
        else { try{ lp=mkPlayer("레안드로","FW",1995,71,1,{no:25,h:178,w:75,bd:"01/13"}); }catch(e){ lp=null; } }
        if(lp){ lp.no=25; ic.players.push(lp); }
        (G.osGone=G.osGone||[]).push("레안드로");  // 시장에 다시 생성되지 않게
      }
    }
    const jb=G.teams.jeonbuk;
    if(jb && jb.players) jb.players=jb.players.filter(p=>!(p.name==="오베르단"&&p.frn));
    /* 루이스 — 김포에서 수원 블루스타로.
       ⚠ 세이브 안의 이름은 개명 규칙이 적용된 뒤라 원래 이름으로는 못 찾는다 — 둘 다 본다. */
    try{
      const gm=G.teams.gimpo, sw=G.teams.suwon;
      if(gm && sw && Array.isArray(gm.players) && Array.isArray(sw.players) && !G._luisSuwon){
        const nm2=(typeof fictName==="function") ? fictName("루이스",1) : "루이스";
        const i=gm.players.findIndex(p=>p && p.frn && p.by===1993 && (p.name==="루이스"||p.name===nm2));
        if(i>=0){
          const lp=gm.players.splice(i,1)[0];
          const used={}; for(const q of sw.players) used[q.no]=1;
          let no=9; while(no<100 && used[no]) no++;
          lp.no=no;
          try{ applyTweakObj(lp, PLAYER_TWEAK["suwon:루이스"]); }catch(e){}
          if(!sw.players.includes(lp)) sw.players.push(lp);
        }
        G._luisSuwon=1;
      }
    }catch(e){}
  }catch(e){}
  /* 스카우팅 망 — 이 기능이 없던 세이브에도 자리를 만들어 준다 */
  if(!G.scout || typeof G.scout!=="object") G.scout={send:[], key:"", list:[], gone:[], bill:0};
  if(!Array.isArray(G.scout.send)) G.scout.send=[];
  if(!Array.isArray(G.scout.list)) G.scout.list=[];
  if(!Array.isArray(G.scout.gone)) G.scout.gone=[];
  /* 🔟 10단계 이관 — 예전 세이브(1~5 눈금)를 성능 보존 변환한다: 예전 5단계 = 지금 10단계.
     새 게임과 이미 변환된 세이브는 G.fac10 이 있어 건너뛴다. */
  if(!G.fac10){
    for(const id in G.teams){ const T=G.teams[id];
      if(typeof T.youthLv==="number" && T.youthLv>0) T.youthLv=lv10From5(clamp(T.youthLv,1,5));
      if(typeof T.trainLv==="number" && T.trainLv>0) T.trainLv=lv10From5(clamp(T.trainLv,1,5));
    }
    G.fac10=1;
  }
  for(const id in G.teams){ const T=G.teams[id];
    if(typeof T.scoutLv!=="number") T.scoutLv=1;
    /* 훈련시설 — 구단별 기본 등급(baseTrainLv)을 따르되, 유스 등급이 더 높으면 그쪽을 쓴다.
       기업구단은 하한이 보장되고, 인프라로 이름난 구단은 위쪽에서 시작한다. (🔟 10단계 눈금) */
    if(typeof T.trainLv!=="number"){
      T.trainLv=clamp(Math.max(T.youthLv||1, baseTrainLv(id, T.div)), 1, FAC_MAX);
    }
    /* 유스 등급도 구단별 기본값을 따른다 — 예전 세이브는 전 구단이 1등급이었다 */
    if(typeof T.youthLv!=="number" || T.youthLv<=0) T.youthLv=clamp(baseYouthLv(id, T.div), 1, FAC_MAX);
  }
  if(!G.stad && G.stad!==null) G.stad=null;
  if(typeof G.stadNo!=="number") G.stadNo=0;
  if(!G.board || typeof G.board!=="object") G.board={stage:0, ultiFrom:null, ultiPts:0, warned:0, ultiCool:0, ultiSaved:0};
  if(typeof G.board.ultiCool!=="number") G.board.ultiCool=0;
  try{ me(); }catch(e){}                      // 감독 자산 — 없으면 여기서 만들어 둔다

  /* 최상위 — 나중에 추가된 컨테이너들 */
  if(!Array.isArray(G.social))   G.social=[];
  if(!Array.isArray(G.fmk))      G.fmk=[];
  if(!Array.isArray(G.feed))     G.feed=[];
  if(!Array.isArray(G.news))     G.news=[];
  if(!Array.isArray(G.offers))   G.offers=[];
  if(!Array.isArray(G.freeAgents)) G.freeAgents=[];
  if(!Array.isArray(G.overseas)) G.overseas=[];
  if(!Array.isArray(G.osGone))   G.osGone=[];
  if(!Array.isArray(G.friendlies)) G.friendlies=[];
  if(!Array.isArray(G.pgMade)) G.pgMade=[];
  if(!Array.isArray(G.tfLog)) G.tfLog=[];
  if(G.jobless && !G.mgrFree) G.mgrFree={from:null, reason:"", s:G.season, off:[], block:{}, weeks:0};
  if(G.mgrFree && !G.mgrFree.block) G.mgrFree.block={};
  if(!G.negoBlock) G.negoBlock={};
  if(!G.staff) G.staff={delegatePre:false, handled:{}, log:[]};
  if(!G.staff.handled) G.staff.handled={};
  if(!Array.isArray(G.staff.log)) G.staff.log=[];
  if(!G.press) G.press={rel:50, skip:0};
  if(!G.trust) G.trust={owner:70, fans:70, log:[]};
  if(!Array.isArray(G.trust.log)) G.trust.log=[];
  if(!G.opt) G.opt={engine:"sim"};
  if(!G.seen) G.seen={};
  if(G.introDone===undefined) G.introDone=true;
  if(G.sue && G.sue.s!==G.season) G.sue=null;      // 시즌이 다르면 새로 센다
  /* 소송 — 로펌 개편 이전 세이브의 진행 중 소송에 빠진 필드를 채운다 */
  if(G.suit && typeof G.suit==="object"){
    if(!Array.isArray(G.suit.events)) G.suit.events=[];
    if(G.suit.stage==null) G.suit.stage=0;
    if(G.suit.filed==null) G.suit.filed=G.day||0;
    if(G.suit.due==null) G.suit.due=(G.day||0)+21;
    /* ⚠ 이미 축이 어긋난 채 저장된 세이브 구제 — 판결까지 남은 날이 한 시즌을 넘길 수는 없다.
       (제보 — 시즌이 끝나자 남은 날짜가 300일대로 늘어났다) */
    const _left=(G.suit.due||0)-(G.day||0);
    if(_left>60){ G.suit.due=(G.day||0)+8+R(6); G.suit.filed=Math.max(0,(G.day||0)-10); }
    if(G.suit.filed>(G.day||0)) G.suit.filed=Math.max(0,(G.day||0)-3);
  }
  if(G.suit && typeof G.suit!=="object") G.suit=null;
  /* ⚠ 제보 — 「스카우트 파견이 새 시즌에 리롤되고 다음 보고까지 346일이라고 뜬다」.
     소송과 같은 원인이다 — 기한이 절대 일자로 저장되는데 시즌이 바뀌면 축이 0 으로 돌아간다.
     새 세이브는 rebaseDayFields 가 옮겨 주지만, 이미 어긋난 채 저장된 파일은 여기서 바로잡는다.
     「남은 날이 그 항목의 최대 기간을 넘어섰다」면 축이 어긋난 것이다. */
  try{
    const day=G.day||0;
    const cap=(o,k,max,def)=>{ if(!o||typeof o[k]!=="number") return;
      if(o[k]-day > max) o[k]=day+(def!=null?def:Math.round(max*0.4)); if(o[k]<0) o[k]=0; };
    const past=(o,k)=>{ if(o&&typeof o[k]==="number" && o[k]>day) o[k]=Math.max(0, day-1); };
    if(G.scout && G.scout.trip) for(const k in G.scout.trip){
      const t=G.scout.trip[k];
      cap(t, "next", 70, Math.round(SCOUT_LEAD[clamp(scoutLv(),1,5)]*0.6));
      past(t, "from");
    }
    const M=G.me;
    if(M){
      cap(M.fut, "due", 95); past(M.fut, "at");
      if(M._dunPromise) cap(M._dunPromise, "due", 35);
      if(M.bank){
        /* 예적금은 상품 기간(개월)이 곧 만기다 — 그 기간을 넘어서 남아 있으면 축이 어긋난 것이다 */
        if(Array.isArray(M.bank.acc))  for(const a of M.bank.acc){
          const term=Math.max(1,(a.m||12))*30;
          cap(a,"due", term+20, term); past(a,"start");
        }
        if(Array.isArray(M.bank.loan)) for(const a of M.bank.loan) past(a,"start");
        if(Array.isArray(M.bank.hist)) for(const h of M.bank.hist) past(h,"d");
      }
    }
    if(G.stock && Array.isArray(G.stock.tips)) for(const x of G.stock.tips){ cap(x,"due", 20); past(x,"d"); }
    if(G.req && G.req.pend) cap(G.req.pend, "due", 12);
    for(const id in G.teams) for(const p of (G.teams[id].players||[])){
      if(p.osLink) cap(p.osLink, "due", 20);
      if(typeof p._renewAt==="number" && p._renewAt>day) p._renewAt=Math.max(0, day-1);
    }
  }catch(e){}
  /* 구단 */
  for(const id in G.teams){
    const t=G.teams[id];
    if(!t.tactic) t.tactic={...TAC_DEF, formation:"4-3-3"};
    if(!t.tactic.slot) t.tactic.slot={};
    if(!t.tactic.zone) t.tactic.zone={};
    if(!t.tactic.role) t.tactic.role={};
    if(!Array.isArray(t.tactic.benchSel)) t.tactic.benchSel=[];
    if(!t.tactic.kickers) t.tactic.kickers={pk:[], fk:[], ck:[], so:[]};
    try{ kickersOf(t); }catch(e){}   // 🎯 전담 키커를 전술 밖(t.kickers)으로 승격
    if(t.tactic.presetCur==null) t.tactic.presetCur=0;
    if(!Array.isArray(t.tactic.presets) || t.tactic.presets.length!==PRESET_N)
      t.tactic.presets=new Array(PRESET_N).fill(null);
    if(t.hype==null) t.hype=1;
    if(!Array.isArray(t.form)) t.form=[];
    if(t.morale==null) t.morale=75;
    if(!t.cap) t.cap={s:G.season, c:null, v:null, set:false};
    if(!Array.isArray(t.players)) t.players=[];
    /* 선수 */
    for(const p of t.players){
      if(p.txp==null) p.txp=0;
      if(p.tpt==null) p.tpt=0;
      if(!Array.isArray(p.traits)) p.traits=[];
      if(!p.posFam) p.posFam=initPosFam(p);
      if(p.inj==null) p.inj=0;
      if(p.ban==null) p.ban=0;
      if(p.sulk==null) p.sulk=0;
      if(p.unhappy==null) p.unhappy=0;
      if(p.ct==null) p.ct=1;
      if(p.pers==null) p.pers=0;
      if(p.mn==null) p.mn=0;
      if(!p.prefPos) p.prefPos=inferPrefPos(p);
    }
  }
  for(const p of (G.freeAgents||[])){
    if(p.txp==null) p.txp=0; if(p.tpt==null) p.tpt=0;
    if(!Array.isArray(p.traits)) p.traits=[];
    if(!p.posFam) p.posFam=initPosFam(p);
  }
  /* 홈그로운 소급 — 개명 전(바또)·후(사또) 이름 모두 찾는다 */
  if(!G.hgV1){
    try{
      for(const id in G.teams) for(const p of G.teams[id].players)
        if(p.frn && (HOMEGROWN_NAMES.includes(p.name) || HOMEGROWN_NAMES.map(n=>fictName(n,1)).includes(p.name))) p.hg=1;
      G.hgV1=true;
    }catch(e){}
  }
  /* 윙어의 LM/RM 능숙도 소급 — 인접표를 올리기 전에 만들어진 선수들도 같은 대우를 받는다 */
  if(!G.famWingV1){
    try{
      const pools=[...Object.values(G.teams).flatMap(t=>t.players), ...(G.freeAgents||[]), ...(G.overseas||[])];
      if(G.scout && Array.isArray(G.scout.list)) for(const x of G.scout.list) pools.push(x && x.p ? x.p : x);
      for(const q of pools){
        const f=q && q.posFam; if(!f) continue;
        if((f.LW||0)>=85) f.ML=Math.max(f.ML||0, 80);
        if((f.RW||0)>=85) f.MR=Math.max(f.MR||0, 80);
      }
      G.famWingV1=true;
    }catch(e){}
  }
  /* AM 라인 소급 — CAM 이 몸에 밴 선수는 LAM/RAM 도, 측면 AM 이 몸에 밴 선수는 CAM 도 낯설지 않다 */
  if(!G.famAmV1){
    try{
      const pools=[...Object.values(G.teams).flatMap(t=>t.players), ...(G.freeAgents||[]), ...(G.overseas||[])];
      if(G.scout && Array.isArray(G.scout.list)) for(const x of G.scout.list) pools.push(x && x.p ? x.p : x);
      for(const q of pools){
        const f=q && q.posFam; if(!f) continue;
        if((f.AMC||0)>=85){ f.AML=Math.max(f.AML||0, 75); f.AMR=Math.max(f.AMR||0, 75); }
        if((f.AML||0)>=85) f.AMC=Math.max(f.AMC||0, 62);
        if((f.AMR||0)>=85) f.AMC=Math.max(f.AMC||0, 62);
      }
      G.famAmV1=true;
    }catch(e){}
  }
  /* 김천 군 복무 정보 — 나중에 생긴 항목이라 옛 세이브에는 없다 */
  try{ armyAttach(G.teams.gimcheon); }catch(e){}
  G.ver=SAVE_VER;
  return from;
}
/* ═══════════════════════════════════════════════════════════════
   저장 — 조용히 실패하지 않는다.
   ⚠ 예전에는 setItem 이 실패해도 false 만 돌려주고 끝이었다. 감독은 몇 시즌을 진행한 뒤에야
     "저장이 안 됐다"는 걸 알게 된다. 실패는 대부분 아래 셋 중 하나다.
       ① 사생활 보호(시크릿) 모드 — 사파리는 setItem 자체를 막는다
       ② 저장 공간 초과 — 시즌이 쌓이면 기록성 데이터가 불어난다
       ③ 브라우저 설정에서 사이트 데이터 차단
     ②는 스스로 복구할 수 있으므로 기록을 잘라내고 한 번 더 시도하고, ①③은 알려 준다.
   그리고 어떤 경우에도 잃지 않도록 세이브 파일 내보내기/불러오기를 따로 둔다.
═══════════════════════════════════════════════════════════════ */
const SAVE_KEY="klm2026";
let SAVE_FAIL=0, SAVE_WARN_AT=0, SAVE_LAST=0, SAVE_SIZE=0;
function storageOK(){
  try{ localStorage.setItem("__klm_t","1"); localStorage.removeItem("__klm_t"); return true; }
  catch(e){ return false; }
}
/* 저장이 안 들어갈 때 버릴 수 있는 것들 — 기록·로그류만 자른다. 선수/구단 데이터는 건드리지 않는다. */
/* ═══ 💽 IndexedDB — 큰 저장소 ══════════════════════════════════════
   ⚠ 제보 — 「기기에 용량이 넉넉한데 저장이 안 된다」.
      원인은 기기 용량이 아니라 브라우저의 localStorage 상한(도메인당 약 5MB)이다.
      게다가 브라우저는 문자열을 UTF-16 으로 세는 경우가 많아, 1.4M 글자 세이브가
      실제로는 약 2.8MB 를 차지하고, 불러오기 백업(_bak)까지 있으면 5.6MB — 그대로 한도 초과다.
   ─ IndexedDB 는 디스크 용량 기준이라 수백 MB까지 쓸 수 있다. 이쪽을 주 저장소로 올리고
     localStorage 는 「즉시 읽히는 사본」으로 남긴다(창을 닫는 순간처럼 동기 쓰기가 필요한 곳).
   ─ 불러올 때 둘 중 더 최신인 쪽을 쓴다. */
const IDB_NAME="klm2026db", IDB_STORE="save";
let IDB=null, IDB_FAIL=false;
let IDB_LAST=0, IDB_SIZE=0;
function idbOpen(){
  if(IDB) return Promise.resolve(IDB);
  if(IDB_FAIL) return Promise.reject(new Error("no idb"));
  return new Promise((res,rej)=>{
    try{
      if(typeof indexedDB==="undefined" || !indexedDB.open){ IDB_FAIL=true; return rej(new Error("no idb")); }
      const rq=indexedDB.open(IDB_NAME, 1);
      rq.onupgradeneeded=()=>{ try{ rq.result.createObjectStore(IDB_STORE); }catch(e){} };
      rq.onsuccess=()=>{ IDB=rq.result; res(IDB); };
      rq.onerror=()=>{ IDB_FAIL=true; rej(rq.error||new Error("idb open")); };
      rq.onblocked=()=>{ IDB_FAIL=true; rej(new Error("idb blocked")); };
    }catch(e){ IDB_FAIL=true; rej(e); }
  });
}
function idbPut(key, val){
  return idbOpen().then(db=>new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,"readwrite");
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete=()=>res(true);
    tx.onerror=()=>rej(tx.error||new Error("idb put"));
    tx.onabort=()=>rej(tx.error||new Error("idb abort"));
  }));
}
function idbGet(key){
  return idbOpen().then(db=>new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,"readonly");
    const rq=tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess=()=>res(rq.result);
    rq.onerror=()=>rej(rq.error||new Error("idb get"));
  }));
}
function idbDel(key){
  return idbOpen().then(db=>new Promise((res)=>{
    try{ const tx=db.transaction(IDB_STORE,"readwrite");
      tx.objectStore(IDB_STORE).delete(key); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
    }catch(e){ res(false); }
  }));
}
/* 세이브 문자열을 IDB 에 넣는다 — 실패해도 게임은 계속 굴러간다 */
function idbSave(s){
  try{
    idbPut(SAVE_KEY, s).then(()=>{ IDB_LAST=Date.now(); IDB_SIZE=s.length; IDB_OK=true; })
      .catch(()=>{ IDB_OK=false; });
  }catch(e){ IDB_OK=false; }
}
let IDB_OK=null;   // null=아직 모름 · true=쓰기 성공 · false=실패
function trimSaveData(){
  try{
    if(Array.isArray(G.news))   G.news=G.news.slice(0,20);
    if(Array.isArray(G.social)) G.social=G.social.slice(0,24);
    if(Array.isArray(G.fmk))    G.fmk=G.fmk.slice(0,20);
    if(Array.isArray(G.feed))   G.feed=G.feed.slice(0,20);
    if(G.trust && Array.isArray(G.trust.log)) G.trust.log=G.trust.log.slice(0,8);
    if(G.staff && Array.isArray(G.staff.log)) G.staff.log=G.staff.log.slice(0,10);
    /* 🥗 시즌을 거듭하면 여기가 제일 빨리 불어난다 — 게임 진행에 쓰이지 않는 「기록」들 */
    if(Array.isArray(G.tfLog))     G.tfLog=G.tfLog.slice(0,60);
    if(Array.isArray(G.rumors))    G.rumors=G.rumors.slice(0,30);
    if(Array.isArray(G.shortlist)) G.shortlist=G.shortlist.slice(0,60);
    if(Array.isArray(G.retired))   G.retired=G.retired.slice(-120);
    if(Array.isArray(G.pgMade))    G.pgMade=G.pgMade.slice(-40);
    if(G.stock){
      if(Array.isArray(G.stock.news)) G.stock.news=G.stock.news.slice(0,30);
      if(Array.isArray(G.stock.log))  G.stock.log=G.stock.log.slice(0,30);
      /* 종목별 시세 기록 — 차트는 60일분만 쓴다 */
      if(Array.isArray(G.stock.list)) for(const s of G.stock.list){
        if(Array.isArray(s.h))  s.h=s.h.slice(-70);
        if(Array.isArray(s.hh)) s.hh=s.hh.slice(-70);
      }
    }
    if(G.me){
      if(Array.isArray(G.me.log))  G.me.log=G.me.log.slice(0,40);
      if(Array.isArray(G.me.hist)) G.me.hist=G.me.hist.slice(-60);
      if(G.me.bank && Array.isArray(G.me.bank.hist)) G.me.bank.hist=G.me.bank.hist.slice(-40);
    }
    for(const id in G.teams){ const t=G.teams[id];
      if(t.fin){ if(Array.isArray(t.fin.log)) t.fin.log=t.fin.log.slice(0,8);
                 if(Array.isArray(t.fin.att)) t.fin.att=t.fin.att.slice(-20); }
      if(Array.isArray(t.retired)) t.retired=t.retired.slice(-24);
      /* 선수 개인 기록 — 성장 스냅샷은 최근 것만 남긴다 */
      for(const p of (t.players||[])){
        if(Array.isArray(p.snap) && p.snap.length>14) p.snap=p.snap.slice(-14);
        if(Array.isArray(p.hist) && p.hist.length>16) p.hist=p.hist.slice(-16);
      }
    }
  }catch(e){}
}
/* ⚠ 제보 — 「아챔 전승하고 1위로 시즌 끝까지 갔는데 저장이 안 돼 이적시장부터 다시 시작」.
   배너 한 줄로는 부족하다. 한 시즌을 날리는 사고다 — 무시할 수 없게 막아 세운다. */
function saveFailNotice(){
  SAVE_FAIL++;
  /* 💽 IDB 가 살아 있으면 진행 상황은 안전하다 — 조용히 알리고 넘어간다 */
  if(IDB_OK===true){
    if(Date.now()-SAVE_WARN_AT > 300000){
      SAVE_WARN_AT=Date.now();
      try{ flash(`💽 브라우저 기본 저장소가 가득 찼지만 큰 저장소(IndexedDB)에 저장되고 있습니다.
        <span class="small">진행 상황은 안전합니다. 그래도 ⚙️ 설정 → 💾 세이브파일 저장으로 한 번 백업해 두시면 확실합니다.</span>`,"info"); }catch(e){}
    }
    return true;
  }
  const now=Date.now();
  if(now-SAVE_WARN_AT < 45000) return false;
  SAVE_WARN_AT=now;
  const why = storageOK()
    ? "브라우저가 이 사이트에 내주는 저장 공간(약 5MB)이 가득 찼습니다. <b>기기 여유 용량과는 별개의 한도</b>입니다."
    : "브라우저가 이 사이트의 저장을 막고 있습니다. <b>사생활 보호(시크릿) 모드</b>이거나 사이트 데이터가 차단된 상태입니다.";
  /* 두 번째 실패부터는 팝업으로 붙잡는다 — 그냥 지나가면 시즌이 날아간다 */
  if(SAVE_FAIL>=2){
    try{
      showConfirm(`<b style="color:var(--red);font-size:17px">⚠️ 저장이 되지 않습니다</b>

${why}

<b>지금 진행 상황은 브라우저에 남아 있지 않습니다.</b> 창을 닫거나 페이지가 새로 고쳐지면 사라집니다.

아래 <b>💾 파일로 내보내기</b>를 눌러 지금 상태를 파일로 받아 두세요. 다음에 그 파일을 불러오면 이어서 하실 수 있습니다.

<span class="small">해결 방법 — ① 파일로 내보내 두기 ② 브라우저 설정에서 이 사이트의 저장 데이터를 정리하고 파일을 다시 불러오기
③ 홈 화면에 추가해서 앱처럼 쓰면 저장 공간이 넉넉해집니다</span>`,
        ()=>{ try{ exportSave(); }catch(e){} },
        {okLabel:"💾 파일로 내보내기", cancelLabel:"나중에", danger:true});
    }catch(e){}
  } else {
    try{ notify(`⚠️ <b>저장에 실패했습니다.</b> ${why}<br><span class="small">⚙️ 설정 → <b>💾 세이브파일 저장</b>으로 지금 진행 상황을 파일로 보관하세요.</span>`,"warn"); }catch(e){}
  }
  return false;
}
/* ═══ 💽 저장소 구조 ═══════════════════════════════════════════════════════
   ⚠ 제보 — 「5MB 제한 너무 적은데 개선 못 하나?」. 개선할 수 있다.
     그 5MB 는 브라우저 「기본 저장소(localStorage)」의 한도다. 같은 브라우저 안에
     한도가 훨씬 큰 저장소(IndexedDB)가 이미 있고, 이 게임도 거기에 함께 쓰고 있었다.
     문제는 기본 저장소를 여전히 「주 저장소」처럼 다뤄서,
       ① 한도에 닿으면 기록(뉴스·이적사·주식 이력·성장 스냅샷)을 실제로 잘라 냈고
       ② 읽기는 기본 저장소만 봐서, 큰 세이브는 이어하기 버튼조차 안 떴다.
   ─ 이제 큰 저장소가 주 저장소다. 기본 저장소는 「빠른 사본」일 뿐이고,
     거기에 안 들어가면 잘라 내지 않고 이정표(SAVE_PTR)만 남긴다.
     큰 저장소까지 막혔을 때만 예전처럼 다이어트한다.
   ═══════════════════════════════════════════════════════════════════════ */
const SAVE_PTR=SAVE_KEY+"_at";     // 기본 저장소에 두는 아주 작은 이정표 (수십 바이트)
/* 큰 저장소가 살아 있는가 — 아직 모르면(null) 살아 있다고 본다(첫 저장은 비동기라 결과가 늦다) */
function idbAlive(){ return IDB_OK!==false; }
/* 큰 저장소에만 세이브가 있는 상태인가 */
function savePtr(){
  try{ const v=localStorage.getItem(SAVE_PTR); return v?JSON.parse(v):null; }catch(e){ return null; }
}
/* 이어하기가 가능한가 — 기본 저장소든 큰 저장소든 하나라도 있으면 된다 */
function haveSave(){
  try{ if(localStorage.getItem(SAVE_KEY)) return true; }catch(e){}
  return !!savePtr();
}
/* 이 크기를 넘어가면 저장 전에 알아서 기록을 줄인다.
   ⚠ 큰 저장소가 살아 있으면 굳이 줄일 이유가 없다 — 한도가 기가바이트 단위다.
     기본 저장소가 막혔을 때만 이 값이 의미를 갖는다. */
const SAVE_SOFT_MAX=1500000;   // 약 1.5M 글자(≈3MB)
/* 💤 연타 흡수 — 저장 한 번에 1.6MB 직렬화 + 두 저장소 쓰기가 든다(데스크톱 ~46ms, 폰은 그 몇 배).
     화면 조작마다 saveGame() 이 붙은 곳이 300군데라, 빠르게 누르면 그만큼 화면이 멈춘다.
   ─ 첫 저장은 즉시 한다. 그 직후 1.1초 안에 몰려드는 호출만 하나로 합쳐 꼬리에서 한 번 쓴다.
     탭이 숨거나 닫힐 때·불러오기·내보내기 직전에는 saveFlush() 로 밀린 저장을 먼저 흘려보낸다.
     ⚠ 반환값을 쓰는 호출부는 없다(전수 확인). 미룬 저장은 true 를 돌려준다. */
const SAVE_COALESCE=1100;
let _svTimer=null, _svLastAt=0;
function saveFlush(){
  if(!_svTimer) return false;
  clearTimeout(_svTimer); _svTimer=null; _svLastAt=Date.now();
  try{ return saveGameNow(); }catch(e){ return false; }
}
function saveGame(){
  if(typeof PREGEN!=="undefined" && PREGEN) return true;
  const now=Date.now(), gap=now-_svLastAt;
  if(gap>=SAVE_COALESCE){
    if(_svTimer){ clearTimeout(_svTimer); _svTimer=null; }
    _svLastAt=now; return saveGameNow();
  }
  if(!_svTimer) _svTimer=setTimeout(()=>{
    _svTimer=null; _svLastAt=Date.now(); try{ saveGameNow(); }catch(e){}
  }, SAVE_COALESCE-gap);
  return true;
}
function saveGameNow(){
  /* 🧬 팀 선택 화면에서 연 「선수 만들기」는 임시 세계다 — 저장소를 절대 건드리지 않는다.
     여기서 만든 선수는 preMade()(브라우저 별도 보관함)에 따로 쌓이고, 새 게임에 옮겨진다. */
  if(typeof PREGEN!=="undefined" && PREGEN) return true;
  stripCaches();
  G._svAt=Date.now();                        // 어느 저장소가 더 최신인지 비교용
  let s;
  try{ s=JSON.stringify(G); }catch(e){ return saveFailNotice(); }
  /* 🥗 선제 다이어트 — 큰 저장소가 죽어 있을 때만. 살아 있으면 기록을 잘라 낼 이유가 없다 */
  if(s.length>SAVE_SOFT_MAX && !idbAlive()){
    try{ trimSaveData(); s=JSON.stringify(G); }catch(e){}
  }
  /* 💽 큰 저장소부터 — 여기가 주 저장소다. 비동기라 결과를 기다리지 않는다. */
  idbSave(s);
  try{ localStorage.setItem(SAVE_KEY, s); SAVE_FAIL=0; SAVE_LAST=Date.now(); SAVE_SIZE=s.length;
    try{ localStorage.removeItem(SAVE_PTR); }catch(_){}   // 사본이 최신이다 — 이정표는 필요 없다
    try{ persistAutoOnce(); }catch(e){}      // 🔒 첫 저장 때 한 번 영구 보존을 요청해 둔다
    return true; }
  catch(e){
    /* 💽 기본 저장소에 안 들어간다 — 큰 저장소가 살아 있으면 그걸로 충분하다.
       ⚠ 여기서 기록을 잘라 내면 「용량 때문에 뉴스·이적사·주식 이력이 사라지는」 손실이 된다.
         낡은 사본만 지우고(그걸 남기면 부팅 때 옛 진행이 읽힌다) 이정표를 남긴다. */
    if(idbAlive()){
      try{ localStorage.removeItem(SAVE_KEY); }catch(_){}
      try{ localStorage.removeItem(SAVE_KEY+"_bak"); }catch(_){}
      try{ localStorage.setItem(SAVE_PTR, JSON.stringify({at:G._svAt, n:s.length})); }catch(_){}
      SAVE_FAIL=0; SAVE_LAST=Date.now(); SAVE_SIZE=s.length;
      try{ persistAutoOnce(); }catch(_){}
      if(!G._bigNoted){ G._bigNoted=1;
        try{ flash("💽 세이브가 커져 큰 저장소로 옮겼습니다 — 진행에는 아무 영향이 없습니다.","good"); }catch(_){}
      }
      return true;
    }
    // 큰 저장소까지 막혔다 — 그때는 기록을 줄여서라도 살린다
    try{
      /* 불러오기 백업이 자리를 절반이나 먹고 있다 — 공간이 급하면 이것부터 버린다 */
      try{ localStorage.removeItem(SAVE_KEY+"_bak"); }catch(_){}
      trimSaveData();
      const s2=JSON.stringify(G);
      localStorage.setItem(SAVE_KEY, s2);
      SAVE_FAIL=0; SAVE_LAST=Date.now(); SAVE_SIZE=s2.length;
      idbSave(s2);
      return true;
    }catch(e2){ return saveFailNotice(); }
  }
}
/* ── 세이브 파일 내보내기 / 불러오기 ──────────────────────────
   브라우저 저장은 언제든 날아갈 수 있다(사파리는 한동안 안 들어오면 지운다).
   파일로 뽑아 두면 기기를 바꿔도, 브라우저를 갈아도 그대로 이어서 할 수 있다. */
function exportSave(){
  try{ saveFlush(); }catch(e){}      // 💤 미뤄 둔 저장을 먼저 반영하고 뽑는다
  try{
    saveGame();
    const s=localStorage.getItem(SAVE_KEY) || JSON.stringify(G);
    const t=userTeam();
    const d=new Date();
    const stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const name=`klm2026_${t?t.short:"save"}_${G.season}_${stamp}.json`;
    const blob=new Blob([s],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name; a.style.display="none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 800);
    const _mb=s.length/1024/1024;
    notify(`💾 세이브파일을 저장했습니다. <span class="small">${name} (${_mb>=1?(Math.round(_mb*10)/10+"MB"):(Math.round(s.length/1024)+"KB")})</span>`
      + (_mb>=4.5 ? `<br><span class="small">📦 파일이 큽니다 — 다른 기기에서 불러올 때 <b>큰 저장소</b>로 넘어갑니다(정상입니다). 첫 로딩이 조금 걸릴 수 있습니다.</span>` : ""),"good");
  }catch(e){ notify("내보내기에 실패했습니다. 브라우저가 파일 저장을 막고 있을 수 있습니다.","warn"); }
}
function importSave(input){
  try{ saveFlush(); }catch(e){}      // 💤 덮어쓰기 전에 밀린 저장을 정리한다 (백업이 최신이 되도록)
  const f=input && input.files && input.files[0];
  if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    let obj=null;
    try{
      const txt=String(r.result||"");
      try{ obj=JSON.parse(txt); }
      catch(pe){ notify("이 파일은 세이브 파일이 아닙니다 — JSON 형식이 아닙니다.","warn"); return; }
      if(!obj || typeof obj!=="object"){ notify("이 파일은 세이브 파일이 아닙니다.","warn"); return; }
      /* ⚠ 제보 — 이름 파일·에디터 데이터 파일을 세이브 불러오기에 넣으면
         "올바른 세이브 파일이 아닙니다"만 떴다. 둘 다 teams 를 갖고 있어 형식 검사에서 함께 걸린 것.
         어떤 파일인지 알려 주고, 맞는 메뉴로 안내한다. */
      if(obj.kind===ED_NAMES_KIND){
        notify(`📛 이 파일은 <b>이름 파일</b>입니다 — 세이브가 아닙니다.<br><span class="small">⚙️ 설정 → 🛠️ 에디터 → <b>📥 불러오기</b>에서 적용하세요.</span>`,"warn");
        return;
      }
      if(obj.kind===ED_DB_KIND){
        notify(`🗂️ 이 파일은 <b>에디터 데이터 파일</b>입니다 — 세이브가 아닙니다.<br><span class="small">⚙️ 설정 → 🛠️ 에디터 → <b>📥 불러오기</b>에서 적용하세요.</span>`,"warn");
        return;
      }
      if(obj.formation || obj.tactic){   // 전술 파일
        notify(`📋 이 파일은 <b>전술 파일</b>입니다 — 세이브가 아닙니다.<br><span class="small">전술 화면에서 불러오세요.</span>`,"warn");
        return;
      }
      if(!obj.teams){ notify("세이브 파일이 아닙니다 — 구단 데이터가 들어 있지 않습니다.","warn"); return; }
      if(!obj.userTeamId){ // 아주 옛 세이브 — 우리 팀 표시가 있는 구단을 찾아 복구한다
        for(const id in obj.teams) if(obj.teams[id] && obj.teams[id].isUser){ obj.userTeamId=id; break; }
        if(!obj.userTeamId){ notify("세이브 파일이 손상된 것 같습니다 — 감독이 맡은 구단 정보를 찾을 수 없습니다.","warn"); return; }
      }
      /* 저장소에 먼저 써 넣고 정식 경로(loadGame)로 읽는다 — 구버전 세이브 마이그레이션이
         전부 loadGame 안에 있어서, G 에 직접 꽂으면 그 과정을 통째로 건너뛴다. */
      /* 덮어쓰기 전에 지금 세이브를 백업해 둔다 — 파일이 이상해도 원래 진행은 잃지 않는다 */
      /* 💽 덮어쓰기 전 백업은 큰 저장소에 둔다 — localStorage 에 두면 자리를 두 배로 먹어
         그것만으로 한도를 넘긴다(제보의 직접 원인 중 하나). */
      try{ const cur=localStorage.getItem(SAVE_KEY); if(cur){ idbPut(SAVE_KEY+"_bak", cur).catch(()=>{});
        try{ localStorage.removeItem(SAVE_KEY+"_bak"); }catch(_){} } }catch(e){}
      let viaStorage=true;
      try{ localStorage.setItem(SAVE_KEY, txt); }catch(e){ viaStorage=false; }
      if(viaStorage && loadGame()){
        const old=(obj.ver||0)<SAVE_VER;
        notify(old?`💾 세이브를 불러왔습니다. <span class="small">이전 버전(v${obj.ver||1}) 세이브라 새 항목을 자동으로 채웠습니다.</span>`
                  :"💾 세이브를 불러왔습니다.","good");
        enterGame();
      }
      else if(viaStorage){
        /* 저장은 됐는데 읽기에 실패 — 방금 백업해 둔 원래 세이브로 되돌린다 */
        try{ const bak=localStorage.getItem(SAVE_KEY+"_bak"); if(bak){ localStorage.setItem(SAVE_KEY, bak); loadGame(); }
        else idbGet(SAVE_KEY+"_bak").then(b2=>{ if(b2){ try{ localStorage.setItem(SAVE_KEY, b2); }catch(_){}
          try{ G=JSON.parse(b2); migrateLoadedG(); PID=nextPid(); enterGame(); }catch(_){} } }).catch(()=>{}); }catch(e){}
        notify("이 파일을 읽지 못해 원래 세이브로 되돌렸습니다. 파일이 손상되지 않았는지 확인해 주세요.","warn");
      }
      else {
        /* 💽 브라우저 기본 저장소(대개 5MB)를 넘는 세이브 — 큰 저장소(IndexedDB)에 넣는다.
           ⚠ 제보 — 「5MB가 넘어가면 아이폰에서 하던 걸 PC로 못 옮기나요? 자꾸 실패합니다」.
             예전에는 여기서 「이번 세션에서만」 불러오고 끝났다. 새로 고치면 통째로 사라졌으니
             옮기기가 사실상 실패였다. IndexedDB 는 한도가 훨씬 커서 이 크기를 감당한다.
             다음에 게임을 열면 부팅 점검(idbSyncCheck)이 그 세이브를 그대로 되살린다. */
        G=obj;
        try{ migrateLoadedG(); PID=nextPid(); }catch(e){ try{ migrateSave(); }catch(_){} }
        try{ G._svAt=Date.now(); }catch(e){}
        const _mb=Math.round(txt.length/1024/1024*10)/10;
        let _big=txt; try{ _big=JSON.stringify(G); }catch(e){}
        try{
          idbPut(SAVE_KEY, _big).then(()=>{
            IDB_OK=true; IDB_SIZE=_big.length;
            try{ notify(`💾 세이브를 불러왔습니다.<br><span class="small">파일이 커서(${_mb}MB) <b>큰 저장소</b>에 보관합니다 — 다음에 열면 그대로 이어집니다.</span>`,"good"); }catch(e){}
          }).catch(()=>{
            IDB_OK=false;
            try{ notify(`💾 세이브를 불러왔지만 <b>저장은 되지 않았습니다</b> — 이번 세션에서만 유지됩니다.<br><span class="small">브라우저의 저장 공간이 막혀 있습니다. 시크릿 모드라면 일반 창에서 다시 시도해 주세요.</span>`,"warn"); }catch(e){}
          });
        }catch(e){ try{ flash("저장소에 쓸 수 없어 이번 세션에서만 불러옵니다.","warn"); }catch(_){} }
        enterGame();
      }
    }catch(e){
      /* 형식은 맞는데 불러오는 도중 문제가 생긴 경우 — 원인을 짧게 알려 준다(그래야 제보가 된다) */
      try{ const bak=localStorage.getItem(SAVE_KEY+"_bak"); if(bak){ localStorage.setItem(SAVE_KEY, bak); loadGame(); } }catch(_){}
      const why=(e&&e.message)?String(e.message).slice(0,80):"알 수 없는 오류";
      notify(`세이브를 불러오는 중 문제가 생겨 원래 진행으로 되돌렸습니다.<br><span class="small">(${why})</span>`,"warn");
      try{ console.warn("세이브 불러오기 실패:", e); }catch(_){}
    }
  };
  r.onerror=()=>notify("파일을 읽지 못했습니다.","warn");
  r.readAsText(f);
}
/* 구 능력치 → FM 능력치 승격. 이미 승격된 선수(tec 키 존재)는 건드리지 않는다. */
function upgradeAttrsAll(){
  const all=[];
  for(const id in G.teams) all.push(...G.teams[id].players);
  if(Array.isArray(G.fa)) all.push(...G.fa);                        // 아주 옛 세이브의 FA 키
  if(Array.isArray(G.freeAgents)) all.push(...G.freeAgents);        // ⚠ 예전엔 G.fa 만 봐서 FA 승격이 통째로 빠졌다
  if(Array.isArray(G.overseas)) all.push(...G.overseas);
  if(G.scout && Array.isArray(G.scout.list)) for(const x of G.scout.list) all.push(x && x.p ? x.p : x);
  for(const p of all){
    if(!p || typeof p!=="object" || !p.pos) continue;
    if(p.attr && typeof p.attr.tec==="number") continue;      // 이미 새 체계
    const o=p.attr||{}, fb=p.ovr||65;
    const g=k=>(typeof o[k]==="number")?o[k]:fb;
    const jit=()=>Math.round((Math.random()-0.5)*10);
    const base=genAttrsFM(p.pos, fb);                          // 포지션다운 기본값을 깔고
    // 구 값이 있던 항목은 그 값을 존중해서 덮는다
    base.fin=g("fin"); base.lon=g("lng"); base.hea=g("hea"); base.pas=g("pass");
    base.tec=g("dri"); base.pos=g("pos_"); base.mar=g("mar"); base.tck=g("tck");
    base.pac=g("pace"); base.cmp=g("cmp");
    base.dri=clamp(Math.round((g("dri")+g("pace"))/2+jit()),15,99);
    base.acc=clamp(Math.round(g("pace")+jit()),15,99);
    base.fir=clamp(Math.round((g("dri")+g("cmp"))/2+jit()),15,99);
    base.dec=clamp(Math.round((g("cmp")+g("pos_"))/2+jit()),15,99);
    base.ant=clamp(Math.round((g("pos_")+g("mar"))/2+jit()),15,99);
    base.str=clamp(Math.round((g("hea")+g("tck"))/2+jit()),15,99);
    base.jum=clamp(Math.round(g("hea")+jit()),15,99);
    base.crs=clamp(Math.round((g("pass")+g("lng"))/2+jit()),15,99);
    p.attr=syncLegacyAttrs(base);
    if(!p.h){ const b2=genBody(p.pos,p.attr); p.h=b2.h; p.w=b2.w; }
    if(p.pos==="GK" && !p.gkA){
      const old=p.gk||{};
      p.gkA=genGkAttrsFM(fb, p.h);
      if(typeof old.shot==="number"){ p.gkA.ref=old.shot; p.gkA.one=clamp(old.shot-3,15,99); }
      if(typeof old.cmd==="number"){ p.gkA.cmd=old.cmd; p.gkA.com=old.cmd; }
      if(typeof old.gkp==="number"){ p.gkA.kic=old.gkp; }
      syncLegacyGk(p);
    }
    if(!p.traits || !p.traits.length || typeof p.traits[0]!=="string" || !TRAIT_BY_KEY[p.traits[0]]) p.traits=genTraits(p.pos,p.attr,p);
    if(!p.posFam) p.posFam=initPosFam(p);
    else migratePosFam(p);
  }
}
/* 구버전 세이브에는 LW/RW 능숙도가 없다 — 예전엔 윙어를 AML/AMR로 묶어 뒀기 때문이다.
   그동안 쌓은 AML/AMR 능숙도를 그대로 물려받게 해서, 세이브를 이어도 윙어가 갑자기 초보가 되지 않게 한다. */
function migratePosFam(p){
  const f=p.posFam; if(!f) return;
  if(f.LW===undefined) f.LW = p.prefPos==="LW" ? 100 : Math.round((f.AML||0)*0.85);
  if(f.RW===undefined) f.RW = p.prefPos==="RW" ? 100 : Math.round((f.AMR||0)*0.85);
  for(const k of FAM_POS) if(typeof f[k]!=="number") f[k]=0;
}
/* 💽 부팅 뒤 IDB 확인 — localStorage 가 비었거나 IDB 가 더 최신이면 그쪽으로 갈아탄다.
   (모바일에서 스크롤 중 탭이 죽어 새로 고쳐지면, 마지막 동기 저장이 실패했을 수 있다) */
function idbSyncCheck(){
  try{
    idbGet(SAVE_KEY).then(raw=>{
      if(!raw || typeof raw!=="string") return;
      IDB_SIZE=raw.length;
      let o=null; try{ o=JSON.parse(raw); }catch(e){ return; }
      if(!o || !o.teams) return;
      const mine=(G && G._svAt) || 0, theirs=o._svAt||0;
      /* 🚪 아직 팀 선택 화면이다 — 게임 진입은 감독이 「이어하기」를 눌러서 한다.
         ⚠ 사용자 요청 — 「나갔다가 다시 접속하면 팀 선택 화면이 강제로 스킵된다. 그냥 팀 선택
           화면이 나오게 해달라」. 이 점검이 부팅 0.9초 뒤 세이브를 찾으면 말없이 enterGame() 을
           불러 화면을 건너뛰고 있었다. 세이브만 준비해 두고(이어하기 버튼이 뜨도록) 화면은
           그대로 둔다. */
      const _picking=(function(){ try{ const tp=$("#teamPick"); return !!tp && !tp.classList.contains("hidden"); }catch(e){ return false; } })();
      /* 💽 기본 저장소가 한도를 넘겨 이정표만 남은 상태 — 큰 저장소가 정답이다. */
      try{
        const ptr=savePtr();
        if(ptr && (!G || !G.teams || theirs>=mine)){
          G=o; migrateLoadedG(); PID=nextPid();
          if(_picking){ try{ renderTeamPick(); }catch(e){} }
          else { try{ flash("💽 큰 저장소에서 이어서 진행합니다.","good"); }catch(e){} try{ enterGame(); }catch(e){} }
          return;
        }
      }catch(e){}
      if(!G || !G.teams){                       // 브라우저 기본 저장소가 비었다 — IDB 로 살린다
        G=o; migrateLoadedG(); PID=nextPid();
        /* ⚠ 제보 — 이 안내가 「구단 소식」에 남는다. 저장소 이야기는 구단에서 벌어진 일이 아니다.
           배너로만 알리고 뉴스에는 쓰지 않는다(notify → flash). */
        if(_picking){ try{ renderTeamPick(); }catch(e){} }
        else { try{ flash("💽 큰 저장소에서 진행 상황을 되살렸습니다.","good"); }catch(e){} try{ enterGame(); }catch(e){} }
        return;
      }
      if(_picking) return;                      // 팀 선택 화면에서는 최신 세이브 확인창도 띄우지 않는다
      if(theirs > mine + 1000){                 // IDB 쪽이 확실히 더 최신이다
        try{ showConfirm(`<b>💽 더 최신 진행 상황이 있습니다</b>

큰 저장소(IndexedDB)에 <b>${new Date(theirs).toLocaleString("ko-KR")}</b> 시점 세이브가 있습니다.
지금 불러온 것은 ${mine?new Date(mine).toLocaleString("ko-KR"):"시점 불명"} 입니다.

최신 쪽으로 이어서 하시겠습니까?`,
          ()=>{ G=o; migrateLoadedG(); PID=nextPid(); try{ saveGame(); }catch(e){} try{ enterGame(); }catch(e){} },
          {okLabel:"최신으로 이어하기", cancelLabel:"지금 것으로 계속"}); }catch(e){}
      }
    }).catch(()=>{});
  }catch(e){}
}
function loadGame(){
  let s=null;
  try{ s=localStorage.getItem(SAVE_KEY); }catch(e){}
  if(!s) return false;
  SAVE_SIZE=s.length;
  let obj=null;
  try{ obj=JSON.parse(s); }catch(e){ return false; }
  if(!obj || typeof obj!=="object" || !obj.teams) return false;
  G=obj;
  /* ⚠ 예전에는 마이그레이션 전체가 하나의 try 안에 있어서, 어느 한 단계만 넘어져도 "세이브가 없다"로
     보였다. 깃허브 페이지로 게임을 받는 사람들의 구버전 세이브가 전부 이 문으로 들어오므로,
     이제 단계별로 나눠 돌린다 — 한 단계가 실패해도 나머지는 전부 밟고, 세이브 자체는 반드시 살린다. */
  migrateLoadedG();
  PID=nextPid();
  return true;
}
/* 불러온 G 를 현재 버전으로 승격 — loadGame 과 (저장소가 막힌 환경의) importSave 가 같이 쓴다 */
/* 🧹 선수 한 명을 구단에서 통째로 걷어낸다 — 명단만 지우면 전술판·선발·전담 키커에
   유령 번호가 남아 화면이 어긋난다. 세이브 정리용 도구다. */
function purgePlayerFrom(t, pred){
  try{
    if(!t || !Array.isArray(t.players)) return 0;
    const gone=t.players.filter(p=>p && pred(p));
    if(!gone.length) return 0;
    const ids=new Set(gone.map(p=>p.id));
    t.players=t.players.filter(p=>!(p && ids.has(p.id)));
    const T=t.tactic||{};
    for(const k of ["slot","zone","roleBy"]) if(T[k]) for(const id of ids) delete T[k][id];
    for(const k of ["benchSel","xiExcl","benchExcl"])
      if(Array.isArray(T[k])) T[k]=T[k].filter(id=>!ids.has(id));
    if(T.kickers) for(const k in T.kickers)
      if(Array.isArray(T.kickers[k])) T.kickers[k]=T.kickers[k].filter(id=>!ids.has(id));
    if(Array.isArray(G.userXI) && t.id===G.userTeamId) G.userXI=G.userXI.filter(id=>!ids.has(id));
    return gone.length;
  }catch(e){ return 0; }
}
function migrateLoadedG(){
  const step=(name,f)=>{ try{ f(); }catch(e){ try{ console.warn("세이브 승격 단계 실패:",name,e); }catch(_){} } };
  /* 🆔 번호부터 맞춘다 — 마이그레이션 도중에 선수가 새로 만들어지는 단계(긴급 등록·스쿼드 보강)가
     있어서, 여기서 PID 를 올려 두지 않으면 그 선수들이 기존 번호를 물고 나온다. */
  step("선수 번호 선점", ()=>{ PID=nextPid(); });
  /* 🔀 국면 포메이션 폐지 (요청 — 「너무 극단적이었던 것 같다」). 구세이브에 남은 형태 키를 지운다.
     남겨 두면 아무 일도 하지 않는 값이 전술 서명·프리셋 비교에 섞여 친숙도 계산이 흔들린다. */
  step("국면 형태 정리", ()=>{
    for(const id in G.teams){ const t2=G.teams[id]; if(!t2) continue;
      if(t2.tactic){ delete t2.tactic.atkShape; delete t2.tactic.defShape; }
      delete t2._shapeAdj;
      const ps=t2.tactic&&t2.tactic.presets;
      if(Array.isArray(ps)) for(const q of ps) if(q){ delete q.atkShape; delete q.defShape; }
    }
  });
  step("전술 기본값", ()=>{ for(const id in G.teams){ const tc=G.teams[id].tactic||{};
    G.teams[id].tactic={...TAC_DEF, formation:tc.formation||"4-3-3", ...tc};
    if(!Array.isArray(G.teams[id].tactic.benchSel)) G.teams[id].tactic.benchSel=[]; } });
  step("옵션", ()=>{ if(!G.press) G.press={rel:50, skip:0}; if(!G.opt) G.opt={engine:"sim"};
    for(const id in G.teams){ const T=G.teams[id].tactic; if(T && T.longShot===undefined) T.longShot=2; } });
  step("등번호", ()=>{ for(const id in G.teams) assignNumbers(G.teams[id]); });
  step("증시", ()=>{
    if(!G.stock) stkInit();
    const M=G.me;
    if(M){ if(!M.inv) M.inv={}; if(!M.stkInv) M.stkInv={};
      /* 예전 세이브 — 주식 보유가 선물 인벤토리(M.inv)와 같은 칸을 쓰고 있었다. 숫자 키만 옮긴다. */
      for(const k in M.inv){ const v=M.inv[k]; if(v && typeof v==="object" && v.q!=null){ M.stkInv[k]=v; delete M.inv[k]; } }
    }
  });
  step("임대 정합성", ()=>{
    /* 한 시즌 임대인데 복귀 라운드가 박혀 있는 꼬인 데이터를 지운다 —
       이게 남아 있으면 시즌 중에 느닷없이 복귀한다(제보) */
    for(const id in G.teams){
      for(const p of (G.teams[id].players||[])){
        const L=p.loan; if(!L) continue;
        if(!L.half && L.backR!=null) L.backR=null;
        if(L.half && L.backR==null){                       // 반 시즌인데 복귀 시점이 없다 — 지금 기준으로 채운다
          const c=G.teams[L.to];
          L.backR=(c ? (c.div===1?G.r1:G.r2) : 0)+19;
        }
      }
    }
  });
  /* 🏆 구세이브 — 4강·결승이 12월 하순·다음 해로 밀려 있으면 12월 주말로 당긴다.
     이미 치른 단계는 건드리지 않는다. (제보 — 4강 12/19, 결승 다음 해 1/2) */
  /* 🏅 트로피 캐비닛 — 같은 대회·같은 시즌에 성적이 겹쳐 쌓인 기록을 정리한다(제보) */
  /* 🏟️ 제보 — 구단 표식이 없던 시절의 구장 사업. 지금 맡은 구단의 것으로 본다
     (팀을 옮긴 뒤라면 이 세이브에서는 그 사업이 사라지지만, 남의 구단 공사가 뜨는 것보다 낫다) */
  /* 🧹 ⚠ 제보 — 이미 장부에 박힌 「존재하지 않는 구단」 결과를 걷어낸다.
     CWC 임시 클럽(cwc_eu_bar 등)이 리그 결과로 썰인 세이브가 그대로는 일정 탭을 열 수 없다. */
  step("결과 장부 정리", ()=>{
    if(!Array.isArray(G.results) || !G.results.length) return;
    const n=G.results.length;
    G.results=G.results.filter(r=>r && G.teams[r.hid] && G.teams[r.aid]);
    if(G.results.length!==n){ try{ console.warn("삭제된 유령 결과:", n-G.results.length); }catch(_){} }
  });
  /* 👥 ⚠ 요청 원문 — 「서울 이스트 FC에 타이오라는 선수와 카이오라는 선수가 있는데,
     이 선수 둘 같은 선수거든? 카이오를 없애자」.

     원인: 명단에 실린 선수는 mkTeam 끝에서 fictName 으로 개명되어 화면에 「타이오」로 나온다.
        그런데 세이브 승격 단계 하나가 「카이오라는 이름이 없으면 서울 이스트에 넣는다」며
        mkPlayer 로 한 명을 직접 만들어 넣고 있었다 — 이 경로는 개명을 거치지 않으므로
        이름이 「카이오」 그대로다. 검사도 개명 뒤 이름(타이오)을 못 알아본다.
        결과: 같은 선수가 타이오 · 카이오 두 명으로 늘어난다. 제보 그대로다.
     ─ 끼워 넣던 단계를 없앴고, 이미 늘어난 세이브는 여기서 되돌린다.
       서울 이스트에 있을 때만 손댄다(다른 구단으로 보낸 선수까지 건드리지 않기 위해서다). */
  step("서울 이스트 중복 선수 정리", ()=>{
    const se=G.teams && G.teams.seoule;
    if(se && Array.isArray(se.players)){
      const hasT=se.players.some(p=>p && p.name==="타이오");
      if(hasT){
        /* 둘 다 있는 세이브 — 끼어든 카이오만 걷어낸다 (전술판·선발·전담 키커까지) */
        const n=purgePlayerFrom(se, p=>p.name==="카이오");
        if(n) try{ console.warn("서울 이스트 중복 선수 정리 — 카이오 제거:", n); }catch(_){}
      } else {
        /* 카이오만 있는 세이브 — 지우면 수비수 한 자리가 빈다.
           개명을 거치지 않고 들어온 그 한 명이니, 다른 선수들과 같은 이름 규칙으로 맞춰 준다. */
        for(const q of se.players) if(q && q.name==="카이오"){
          q.name=(function(){ try{ return fictName("카이오", 1); }catch(e){ return "타이오"; } })();
          try{ applyTweakObj(q, PLAYER_TWEAK["seoule:카이오"]); }catch(e){}
        }
      }
    }
    /* 시장에 남아 있는 카이오는 어느 쪽이든 걷어낸다 — 다시 흘러들지 않게 */
    if(Array.isArray(G.overseas)) G.overseas=G.overseas.filter(p=>(p.osKey||p.name)!=="카이오");
    if(Array.isArray(G.freeAgents)) G.freeAgents=G.freeAgents.filter(p=>p && p.name!=="카이오");
    try{ if(!(G.osGone||[]).includes("카이오")) (G.osGone=G.osGone||[]).push("카이오"); }catch(e){}
  });
  /* 🎓 ⚠ 제보 — 멘토가 이적한 뒤에도 남아 있던 튜터 관계를 걷어낸다 */
  step("멘토 관계 정리", ()=>{ for(const id in G.teams) tutorSweep(G.teams[id]); });
  step("구장 사업 소유 정리", ()=>{
    try{ if(G.stad && !G.stad.tid && !G.jobless && G.userTeamId) G.stad.tid=G.userTeamId; }catch(e){}
  });
  step("트로피 캐비닛 정리", ()=>{ try{ trophySweep(); }catch(e){} });
  /* 🔒 ⚠ 제보 — 「에디터로 고쳐 놓으면 몇 시즌 지나서 원상복귀 되는 버그」.
     세이브를 열 때 한 번 훑어, 그 사이 무엇이 덮어썼든 감독이 고친 명칭으로 되돌려 놓는다. */
  step("에디터 구단 정보 복원", ()=>{ edLockSweep(); });
  /* 📜 감독 경력 장부가 없던 시절의 세이브 — 트로피에서 되살릴 수 있는 만큼 되살린다 (요청) */
  step("감독 경력 장부", ()=>{ cvSeed(); });
  /* 📈 ⚠ 제보 — 이미 「구단」으로 쌓여 있는 주식 소식을 다시 분류한다.
     새 분류만 만들면 지금까지 받은 청약·찌라시 기사는 그대로 구단에 남아 섞인다. */
  /* 🚫 ⚠ 제보 — 이미 장부에 박혀 있는 「내가 영입한 적 없는 선수」를 걷어낸다.
     원인(osAiSign)이 남긴 자국은 하나뿐이다: 그 선수는 지금 「다른 구단」 소속이고,
     우리 장부에 방출·판매 기록이 없으며, 상대란에 K리그 구단이 아닌 이름(해외 클럽)이 적혀 있다.
     ⚠ 조건을 셋 다 만족할 때만 지운다 — 진짜 내 거래를 실수로 지우지 않기 위해서다. */
  step("영입 장부 정리", ()=>{
    if(!Array.isArray(G.tfLog) || !G.tfLog.length) return;
    if(G.jobless) return;
    const ut=userTeam(); if(!ut) return;
    const mine=new Set((ut.players||[]).map(x=>x&&x.name).filter(Boolean));
    const outN=new Set(G.tfLog.filter(x=>x&&x.k==="out").map(x=>x.n));
    const elsewhere=new Set();
    for(const id in (G.teams||{})){ if(id===ut.id) continue;
      for(const q of (G.teams[id].players||[])) if(q&&q.name) elsewhere.add(q.name); }
    const kNames=new Set();
    for(const id in (G.teams||{})){ const t=G.teams[id];
      if(t.short) kNames.add(t.short); if(t.name) kNames.add(t.name); }
    const domestic=(o)=>{ const v=String(o||"");
      if(!v || v==="FA") return true;
      if(/임대|교환|옵션|방출|사우디|판매/.test(v)) return true;
      for(const n of kNames) if(n && v.indexOf(n)===0) return true;
      return false; };
    G.tfLog=G.tfLog.filter(x=>{
      if(!x || x.k!=="in") return true;
      if(domestic(x.o)) return true;            // 국내 거래·임대·교환은 손대지 않는다
      if(mine.has(x.n)) return true;            // 지금 우리 선수 — 내가 데려온 게 맞다
      if(outN.has(x.n)) return true;            // 나중에 내보낸 기록이 있다 — 내 거래였다
      return !elsewhere.has(x.n);               // 남의 구단에 앉아 있으면 AI 영입이 새어 든 것
    });
  });
  step("주식 소식 재분류", ()=>{
    const RX=/청약|찌라시|상장폐지|관리종목|공모가|배당|반대매매|담보비율|사채|파산|숏스퀴즈|공매도|증거금|테마가|국세청|예약 매(수|도) 체결|시초가|경쟁률/;
    /* 💰 제보 「경제 탭 신설」 — 은행·부동산 소식도 같이 떼어낸다 */
    const RX_BANK=/자동이체|만기|연체|특판|기준금리|신용점수|대출을 다 갚|예·적금/;
    const RX_RE=/임차인|재산세|시세|경매로 넘어|담보 가치|취득세|월세|전세|매물/;
    const fix=(arr,isFeed)=>{ if(!Array.isArray(arr)) return;
      for(const x of arr){ if(!x || x.cat!=="club") continue;
        const t=String((x.txt||"")+(x.head||"")+(x.sub||""));
        if(RX.test(t)){ x.cat="stock"; if(isFeed){ x.ic="📈"; x.src="증권가"; } }
        else if(RX_BANK.test(t)){ x.cat="bank"; if(isFeed){ x.ic="🏦"; x.src="금융권"; } }
        else if(RX_RE.test(t)){ x.cat="realty"; if(isFeed){ x.ic="🏘️"; x.src="부동산"; } } } };
    fix(G.news, false); fix(G.feed, true);
  });
  /* 🎩 FM 능력치 표가 없던 시절 — 옛 값으로 24개를 채운다 (요청).
     지금 데리고 있는 코치의 실력이 그대로 유지되도록 역변환한다. */
  step("스태프 능력치 FM 체계", ()=>{
    /* 🐛 시장 후보 배열 이름을 틀렸었다 — G.staff.pool 이 아니라 G.acPool 이다.
       그래서 옛 세이브의 시장 후보 70여 명이 FM 표를 못 받았다. */
    try{ for(const c of crew()) if(acNeedSeed(c)) acSeedFromLegacy(c); }catch(e){}
    try{ if(Array.isArray(G.acPool)) for(const c of G.acPool) if(acNeedSeed(c)) acSeedFromLegacy(c); }catch(e){}
    /* 👔 감독도 같은 표를 쓴다 — AI 감독 30명 + 에디터로 고친 값까지 (요청) */
    try{ for(const k in COACHES){ const c=COACHES[k]; if(acNeedSeed(c)) acSeedFromLegacy(c); } }catch(e){}
  });
  /* 🚑 유형이 없던 시절의 부상 — 남은 주수에 맞는 진단을 하나 붙여 준다.
     안 붙이면 옛 세이브의 부상자만 「부상 N주」로 남아 화면이 어긋난다 (요청 「배선도 정확하게」). */
  step("부상 진단 백필", ()=>{
    const fit=(w)=>injTypeForWeeks(w);
    const walk=(arr)=>{ if(!Array.isArray(arr)) return;
      for(const p of arr){ if(!p || !(p.inj>0) || p.injT) continue;
        p.injT=fit(injWeeksLeft(p)); p.injC="overuse"; } };
    for(const id in (G.teams||{})) walk(G.teams[id].players);
    walk(G.freeAgents); walk(G.overseas); walk(G.youthPool);
  });
  step("대회 4강·결승 일정", ()=>{
    if(!G.eacl || !G.eacl.koDay) return;
    const K=G.eacl.ko||{};
    const sfD=decWeekendDay(2), fD=decWeekendDay(3);
    if(sfD==null || fD==null || fD<=sfD) return;
    const qfD=(G.eacl.koDay.qf!=null)?G.eacl.koDay.qf:0;
    const sfTies=K.sf||[], fTie=K.f;
    const sfDone=sfTies.length>0 && sfTies.every(x=>x&&x.done);
    const fDone=!!(fTie&&fTie.done);
    if(!sfDone && sfD>qfD+3 && G.eacl.koDay.sf!==sfD) G.eacl.koDay.sf=sfD;
    if(!fDone && G.eacl.koDay.f!==fD) G.eacl.koDay.f=fD;
    if(G.cal && G.eacl.koDay.f!=null && (G.cal.last||0)<G.eacl.koDay.f+2) G.cal.last=G.eacl.koDay.f+2;
  });
  step("대회 징계", ()=>{
    /* 대회 경기 도중 저장된 세이브라면 p.ban 자리에 대회 징계가 올라가 있다 — 원위치시킨다 */
    for(const id in G.teams){
      for(const p of (G.teams[id].players||[])){
        if(p._banL==null) continue;
        p.banE=p.ban||0; if(p.banNew) p.banENew=1;
        p.ban=p._banL||0; if(p._banNewL) p.banNew=1; else delete p.banNew;
        delete p._banL; delete p._banNewL;
      }
    }
  });
  step("감독 부상", ()=>{
    const I=G.mgrInj; if(!I) return;
    /* 시즌 경계에서 부풀어 오른 회복 기간을 바로잡는다(제보 「전치 55주」) */
    if(I.left==null) I.left=Math.max(0,(I.until||0)-(G.day||0));
    I.weeks=clamp(Math.round(I.weeks||1), 1, 12);
    I.left=Math.min(I.left, I.weeks*7);
    delete I.until; delete I.from;
    if(I.left<=0) G.mgrInj=null;
  });
  /* 🎮 옛 세이브 — 지난 부상이 켜 두고 간 위임 값이 남아 있으면, 그건 감독의 뜻이 아니다.
     감독이 직접 정한 적(delSet)이 없고 지금 부상도 아니면 한 번만 「직접 지휘」로 되돌린다. (요청) */
  step("경기 운영 위임 정리", ()=>{
    if(!G.staff) return;
    if(!G.staff.delSet && G.staff.delegatePre && !G.mgrInj) G.staff.delegatePre=false;
  });
  step("역할 기억", ()=>{
    for(const id in G.teams){
      const T=G.teams[id].tactic; if(!T) continue;
      if(!T.roleBy) T.roleBy={};
      /* 지금 내려져 있는 지시를 그대로 기억으로 옮겨 둔다 — 승격 직후 역할이 바뀌지 않게 */
      for(const pid in (T.role||{})){
        const rd=T.role[pid]; const R=rd&&ROLE_BY_KEY[rd.r]; if(!R) continue;
        const m=T.roleBy[pid]||(T.roleBy[pid]={});
        for(const g of (R.grp||[])) if(!m[g]) m[g]={r:rd.r, d:rd.d};
      }
    }
  });
  step("전술 프리셋 인선 정리", ()=>{
    /* 인선(선발·벤치)은 전술 슬롯이 갖지 않는다 — 옛 세이브의 프리셋에 남아 있으면 걷어낸다 */
    for(const id in G.teams){ try{ scrubPresetSquads(G.teams[id]); }catch(e){} }
  });
  step("증시 — 시민구단 운영주체 상장 해제", ()=>{
    const S=G.stock; if(!S || !Array.isArray(S.list)) return;
    const gone=[];
    const used=new Set(S.list.map(x=>x.n));
    for(const s of S.list){
      if(!s || !s.tid) continue;
      const t=G.teams[s.tid]; if(!t) continue;
      const ct=clubType(t);
      if(stkListable(ct)){ if(ct.o && s.n!==ct.o){ s.n=ct.o; } continue; }   // 기업구단 — 이름만 최신으로
      /* 시민·기업+시민·군경 — 상장사가 아니다. 계열 관계를 끊고 사기업으로 남긴다. */
      let nn=STK_SPINOFF[s.tid] || (s.n+"홀딩스");
      let g=0; while(used.has(nn) && g++<9) nn=nn+"㈜";
      used.delete(s.n); used.add(nn);
      gone.push({old:s.n, nw:nn, tm:t.short});
      s.n=nn; s.tid=null;
      /* 업종이 「도시개발」에서 온 값이라 그대로 쓰면 어색하지 않다 — 손대지 않는다 */
    }
    try{ delete G._stkSpin; }catch(e){}      // 세이브에 남기지 않는다 (재로딩마다 같은 안내가 뜨던 문제)
    if(gone.length){
      STK_SPIN_N=gone.length;
      try{ for(const x of gone.slice(0,4)){
        /* 조사는 이름 바로 뒤 글자를 봐야 한다 — 태그(</b>) 뒤에 붙이면 판정이 어긋난다 */
        const _ro=fixJosa(x.nw+"으로/로").slice(x.nw.length);
        stkLog(null, `🏙️ ${x.old} — ${x.tm} 운영에서 손을 떼고 사명을 <b>${x.nw}</b>${_ro} 변경, 계열 분리`, 0);
      } }catch(e){}
      try{ setTimeout(()=>{ try{ notify(`🏙️ <b>시민구단 운영 주체 ${gone.length}곳</b>이 증시에서 내려갔습니다.
        <span class="small">시·도와 시민 주주가 운영하는 구단은 상장사가 아닙니다. 보유 주식은 계열 분리된 사기업으로 그대로 남습니다.</span>`,"info"); }catch(e){} }, 1500); }catch(e){}
    }
  });
  step("관심 목록", ()=>{
    if(!Array.isArray(G.shortlist)) G.shortlist=[];
    /* 옛 형식(숫자만) 대비 + 사라진 선수 정리 */
    G.shortlist=G.shortlist.map(x=>(typeof x==="number")?{pid:x, why:"eye", at:0, s:G.season, note:""}:x)
                           .filter(x=>x && x.pid!=null);
  });
  /* 🧯 오염 복구 — 대분류를 다시 읽기 「전에」 가짜 골키퍼를 걷어낸다 */
  step("골키퍼 오염 복구", ()=>{
    let n=0;
    for(const id in G.teams) n+=repairFakeGK(G.teams[id].players);
    n+=repairFakeGK(G.freeAgents); n+=repairFakeGK(G.overseas);
    n+=repairFakeGK(G.youthPool);  n+=repairFakeGK(G.retired);
    if(G.scout) n+=repairFakeGK(G.scout.list);
    if(n>0){
      try{ delete G._gkFixed; }catch(e){}
      try{ setTimeout(()=>{ try{ notify(`🧯 세이브 복구 — 골키퍼로 잘못 기록돼 있던 <b>${n}명</b>의 포지션을 원래대로 되돌렸습니다.
        <span class="small">불러올 때마다 전 선수가 GK가 되던 문제입니다.</span>`,"good"); }catch(e){} }, 1200); }catch(e){}
      try{ console.log("🧯 가짜 골키퍼 복구:", n, "명"); }catch(e){}
      GK_FIXED_N=n;
    }
  });
  /* 포지션 대분류를 능숙도 기준으로 다시 읽는다 — 등록만 FW 였던 풀백 같은 선수가 바로잡힌다 */
  step("포지션 대분류", ()=>{
    const band=(arr)=>{ if(!Array.isArray(arr)) return;
      for(const p of arr) if(p && p.posFam){ migratePosFam(p); syncPosBand(p); try{ retuneTraits(p); }catch(e){} } };
    for(const id in G.teams) band(G.teams[id].players);
    band(G.freeAgents); band(G.overseas); band(G.youthPool); band(G.retired);
    if(G.scout) band(G.scout.list);
  });
  step("공통 백필", ()=>{ migrateSave(); });
  /* 🗓️ 일정 정합성
     ① 12팀 시즌 — 정규 라운드보다 긴 일정이 깔려 있으면 규정 길이로 자른다.
     ② 14팀 시즌(2027~) — 스플릿이 폐지되고 3로빈 39R 로 바뀌었다.
        옛 세이브는 「2로빈 26R + 파이널」로 깔려 있으므로, 아직 스플릿 전이면 3번째 로빈을 이어 붙인다.
        (이미 파이널까지 붙은 세이브는 그 시즌을 예전 방식대로 마치게 둔다 — 진행 중인 순위를 흔들지 않는다) */
  step("일정 정합성", ()=>{
    if(G.phase!=="league" || !Array.isArray(G.k1Fix) || !G.k1Fix.length) return;
    const N=(G.k1||[]).length;
    if(N>=14){
      const two=(N-1)*2, three=(N-1)*3;
      /* ⚠ 제보 — 「53라운드 사건 패치 뒤 2027을 39라운드로 정상 시작했는데,
           업데이트를 몇 번 거치고 오랜만에 켜 보니 다시 53라운드가 되어 있다」.
         이번엔 원인이 달랐다. 정규 39R 은 정상으로 깔렸고, 그 「뒤에」 파이널 라운드 14R 이
         덧붙어 있었다 — 14팀 시즌은 스플릿이 폐지됐는데도 옛 빌드가 makeSplit 을 돌린 것이다.
         복구 단계는 「26R 짜리를 39R 로 늘리는」 경우만 보고 있어서 이 세이브를 그냥 지나쳤다.
         (게다가 splitDone 이 true 라 조건에 아예 걸리지도 않았다)
         ─ 14팀 시즌에 정규 39R 보다 긴 일정이 있으면 잘라내고, 스플릿 잔재도 함께 지운다. */
      if(G.k1Fix.length>three){
        const cut=G.k1Fix.length-three;
        G.k1Fix.length=three;
        if((G.r1||0)>three) G.r1=three;          // 이미 넘겨 진행한 세이브는 곧바로 시즌 종료로 간다
        G.splitDone=true; G.finalA=[]; G.finalB=[];   // 14팀엔 파이널 라운드가 없다
        try{ addNews(`📢 <b>일정이 규정에 맞게 복구되었습니다.</b> 14팀 체제의 K리그1은 파이널 라운드(스플릿) 없이 <b>3라운드 로빈 ${three}경기</b>로 치릅니다. 잘못 덧붙어 있던 ${cut}개 라운드를 제거했습니다.`, "info"); }catch(e){}
        return;
      }
      if(!G.splitDone && G.k1Fix.length===two){
        /* 3번째 로빈을 붙여 39라운드로 만든다 */
        let order=null;
        try{ order=(G.finalTbl && G.finalTbl.k1) ? G.finalTbl.k1.filter(id=>G.k1.indexOf(id)>=0) : null; }catch(e){}
        if(!order || order.length<N){
          try{ order=tableOf(1).map(t=>t.id); }catch(e){ order=G.k1.slice(); }
        }
        const host=thirdRobinHosts(G.k1, order);
        const r3=singleRobin(shuffled(G.k1)).map(rd=>rd.map(([h,a])=>{
          const H=host(h,a); return H===h?[h,a]:[a,h];
        }));
        for(const rd of r3) G.k1Fix.push(rd);
        G.k1HomeOrder=order.slice();
        try{ addNews("📢 <b>2027 시즌부터 K리그1은 파이널 라운드(스플릿)를 폐지하고 3라운드 로빈 39경기로 치릅니다.</b> 남은 일정이 새 규정에 맞춰 재편성되었습니다.", "info"); }catch(e){}
      }
      return;
    }
    const want=splitAt();
    if(!G.splitDone && G.k1Fix.length>want){
      G.k1Fix.length=want;
      if((G.r1||0)>want) G.r1=want;    // 초과 진행분은 다음 진행에서 곧바로 스플릿으로 넘어간다
    }
  });
  /* 🗓️ 달력이 라운드보다 먼저 끝난 세이브 — 불러오는 순간 바로 고친다 (제보: 강원 2028 무한 경기) */
  step("달력 정합성", ()=>{ calRoundRepair(); });
  /* 🏢 ⚠ 제보 — 「부동산 제일 먼저 산 건물들이 보유 0년으로 뜹니다. 그 후에 산 건 2년이라고 뜨는데」.
     취득 시즌(s) 필드가 생기기 전 구버전에서 산 건물에는 s 가 없어, 보유 연수 계산이
     「올해 산 것」으로 처리했다(0년 + 양도세 중과까지). 실제 취득 시즌은 복원할 수 없지만,
     s 가 찍힌 건물보다 먼저 산 것은 확실하므로 「기록된 것 중 가장 이른 시즌」과
     「2시즌 전」 중 이른 쪽으로 채운다 — 최소한 2년 미만 중과는 억울하게 맞지 않는다. */
  step("부동산 취득연도", ()=>{
    const M=G.me; const ps=M && M.props;
    if(!Array.isArray(ps) || !ps.length) return;
    if(!ps.some(x=>x && x.s==null)) return;
    const known=ps.filter(x=>x && x.s!=null).map(x=>x.s);
    const guess=Math.min(known.length?Math.min.apply(null, known):(G.season||0), (G.season||0)-2);
    for(const it of ps) if(it && it.s==null) it.s=guess;
  });
  /* 구버전 세이브 복구 — 꼬인 임대(원소속에 loan 잔재, 만료 미복귀, FA 고아) 정리 */
  step("임대 정합성", ()=>{ loanSweep(); });
  step("군 복무 정합성", ()=>{ armySweep(); });
  /* 재계약 잠금 복구 — 시즌 경계에서 부풀려졌거나(700일+), 복귀 선수에게 잘못 걸린 잠금을 푼다 */
  /* 협상 냉각기 — 시즌 경계를 넘어 얼어붙은 값을 푼다 */
  /* ⚡ 역습 — 켜고 끄는 스위치에서 5단계 슬라이더로 바뀌었다. 옛 세이브의 true/false 를 옮긴다.
     ⚠ 처음엔 false/null → 0(안 함)으로 옮겼는데, 옛 스위치의 false 는 「의도적 끔」이 아니라
        그냥 기본값이었다. 그래서 모든 세이브가 「역습 안 함」으로 굳어 버렸다(제보).
        기본값 보통(2)으로 다시 옮긴다 — 이미 0으로 변환된 세이브도 한 번만 2로 끌어올린다. */
  step("역습 슬라이더", ()=>{
    const redo=!G._ctrDef2;                 // 0→2 재변환은 딱 한 번 — 이후의 0은 사용자의 선택
    const fixT=(T)=>{ if(!T) return;
      if(T.counter===true) T.counter=3;
      else if(T.counter===false||T.counter==null) T.counter=2;
      else { T.counter=clamp(Math.round(+T.counter)||0, 0, TAC_STEPS-1);
             if(redo && T.counter===0) T.counter=2; }
    };
    for(const id in G.teams){ const t=G.teams[id];
      fixT(t.tactic);
      const ps=(t.tactic&&t.tactic.presets)||[];
      for(const s of ps) if(s && s.tac) fixT(s.tac);
    }
    G._ctrDef2=1;
  });
  step("협상 냉각기", ()=>{
    if(!G.negoBlock) { G.negoBlock={}; return; }
    for(const pid in G.negoBlock){
      const B=G.negoBlock[pid];
      if(typeof B==="object"){ if(B.s!==G.season) delete G.negoBlock[pid]; }
      else if((B-(G.day||0))>NEGO_COOLDOWN_DAYS) delete G.negoBlock[pid];
    }
  });
  step("재계약 잠금", ()=>{
    const fix=p=>{ if(!p || p._renewAt==null) return;
      /* 미래 값·지난 시즌 값·잠금 기간을 넘는 값은 전부 옛 계산식의 잔재다 */
      const stale = p._renewAt>(G.day||0)
                 || (G.season-(p._renewS||G.season))>=1
                 || ((G.day||0)-p._renewAt) > RENEW_LOCK_DAYS;
      if(stale){ p._renewAt=null; p._renewS=null; } };
    for(const id in G.teams) for(const p of G.teams[id].players) fix(p);
    for(const p of (G.freeAgents||[])) fix(p);
  });
  /* 구버전 세이브 복구 ② — 프리시즌인데 시즌 기록이 남아 있으면(FA 리셋 누락) 0으로 되돌린다. */
  step("프리시즌 기록 초기화", ()=>{
    if(G.phase!=="pre") return;
    for(const id in G.teams) for(const p of G.teams[id].players) resetSeasonStats(p);
    for(const p of (G.freeAgents||[])) resetSeasonStats(p);
    for(const p of (G.overseas||[])) resetSeasonStats(p);
  });
  step("신뢰 로그", ()=>{ if(!G.trust.log) G.trust.log=[]; });
  // 전술 눈금이 3단계(0·1·2)에서 5단계(0~4)로 바뀌었다 — 예전 값을 두 배로 늘려 같은 성향을 유지한다
  step("전술 5단계", ()=>{ if(!G.tac5){
    for(const id in G.teams){ const T=G.teams[id].tactic; if(!T) continue;
      for(const k of TAC_KEYS){ const v=T[k]; if(typeof v==="number" && v<=2) T[k]=clamp(Math.round(v*2),0,4); } }
    G.tac5=true; } });
  /* 🚌 텐백 토글(빌드 3900~4000) → 수비 간격 슬라이더 통합. 켜져 있던 세이브는 「매우 좁게」로 */
  step("수비 간격", ()=>{
    for(const id in G.teams){ const T=G.teams[id].tactic; if(!T) continue;
      if(T.defGap==null) T.defGap=(+T.bus>0)?0:2;
      delete T.bus; } });
  // 달력·훈련·전술 적응도 — 구버전 세이브에는 없다. 지금 라운드 위치에 맞춰 달력을 깔아 준다.
  step("달력", ()=>{ if(!G.cal){
    const rounds=Math.max((G.k1Fix||[]).length,(G.k2Fix||[]).length)+6;
    buildCalendar(rounds);
    const ut=userTeam();
    G.day=matchDayOf(clamp(ut&&ut.div===1?G.r1:G.r2, 0, G.cal.roundDay.length-1)); } });
  step("훈련 계획", ()=>{ ensureTrainPlan(); });
  // 경기장·시즌권은 이번 버전에서 생겼다 — 옛 세이브에는 시즌 도중이라도 지금 채워 넣는다
  step("경기장·시즌권", ()=>{ for(const id in G.teams){ const t=G.teams[id];
    stadOf(t); if(t.hype==null) t.hype=1;
    if(t.seasonTix==null){ sellSeasonTickets(t); t.seasonTixRev=0; } } });   // 이미 지난 수입은 소급 지급하지 않는다
  step("재정", ()=>{ for(const id in G.teams) if(t_needFin(G.teams[id])) setupFinance(G.teams[id]); });
  step("구단 보조", ()=>{ for(const id in G.teams){ const t=G.teams[id];
    if(t.fam==null) t.fam = t.isUser ? 70 : 74+R(7);
    if(t._sig===undefined) t._sig=tacticSig(t); }
    if(!G.seen) G.seen={}; });
  // 뉴스 피드는 이번 버전에서 생겼다 — 이미 돌고 있던 루머와 최근 구단 소식으로 첫 화면을 채워 준다
  step("뉴스 피드", ()=>{ if(!G.feed){
    G.feed=[]; G.feedSeq=0;
    for(const r of (G.rumors||[]).slice(0,12).reverse()) rumorToFeed(r);
    for(const n of (G.news||[]).filter(x=>x.cat!=="mood").slice(0,15).reverse())
      pushFeed({cat:"club", ic:"🏷️", head:n.txt, tone:0, tid:G.userTeamId, src:"구단 공식"});
    G.feedSeen=G.feedSeq; } });   // 지난 소식이 전부 "새 글"로 잡히는 건 막는다
  // 구버전(세부 능력치 10개) 세이브를 FM 체계로 승격 — 기존 값을 씨앗 삼아 채운다
  step("능력치 승격", ()=>{ upgradeAttrsAll(); });
  step("나이 소급", ()=>{ if(!G.ageV2){
    for(const id in G.teams) for(const p of G.teams[id].players) applyAgeDecline(p, G.season-(p.by||2000));
    for(const p of (G.freeAgents||[])) applyAgeDecline(p, G.season-(p.by||2000));
    G.ageV2=true; } });
  step("장신 소급", ()=>{ if(!G.htV1){
    for(const id in G.teams) for(const p of G.teams[id].players) applyHeightBody(p);
    for(const p of (G.freeAgents||[])) applyHeightBody(p);
    G.htV1=true; } });
  step("특화 소급", ()=>{ if(!G.specV1){
    for(const id in G.teams) for(const p of G.teams[id].players) applySpecialization(p);
    for(const p of (G.freeAgents||[])) applySpecialization(p);
    G.specV1=true; } });
  step("기타 필드", ()=>{ if(G.introDone===undefined) G.introDone=true;
    if(!G.offers) G.offers=[]; if(G.nego===undefined) G.nego=null; if(G.snego===undefined) G.snego=null; });
  /* ⚠ 예전 코드는 여기서 genOutfieldAttrs/genGkAttrs 를 불렀는데, 그 함수들은 능력치 개편 때 사라졌다.
     세부 능력치가 없는 아주 옛 세이브를 만나면 그 자리에서 넘어져 로드 전체가 죽었다.
     지금 세대 생성기로 채운다 — upgradeAttrsAll 이 정상 동작했다면 여긴 안전망일 뿐이다. */
  step("선수 필드", ()=>{ for(const id in G.teams) for(const p of G.teams[id].players){
    if(p.pers===undefined){ p.pers=R(4); p.unhappy=0; p.uWhy=""; p.talkR=-9; p.promise=null; if(p.morale===undefined) p.morale=64+R(15); }
    if(p.aff===undefined) p.aff=AFF_DEF-6+R(13);
    if(p.career===undefined) p.career=careerGuess(p);   // 통산 출장 — 데뷔전 기사 판별용
    if(p.sulk===undefined){ p.sulk=0; p.noMove=false; }
    if(p.ct===undefined) p.ct=1+R(3);
    if(!p.attr || typeof p.attr.tec!=="number") p.attr=syncLegacyAttrs(genAttrsFM(p.pos, p.ovr||65));
    if(p.pos==="GK" && !p.gkA){ p.gkA=genGkAttrsFM(p.ovr||65, p.h||188); syncLegacyGk(p); }
  } });
  step("FA 필드", ()=>{ if(!G.freeAgents) G.freeAgents=[];
    for(const p of G.freeAgents){
      if(p.ct===undefined) p.ct=1;
      if(!p.attr || typeof p.attr.tec!=="number") p.attr=syncLegacyAttrs(genAttrsFM(p.pos, p.ovr||65));
      if(p.pos==="GK" && !p.gkA){ p.gkA=genGkAttrsFM(p.ovr||65, p.h||188); syncLegacyGk(p); }
    } });
  /* 🔁 임대 유령 복제 정리 — 번호 정리보다 먼저 (사본을 지운 뒤에 번호를 매겨야 한다) */
  step("징계 정합성", ()=>{ const n=banSweep(); if(n) try{ console.log("징계 잔재 "+n+"건 정리"); }catch(e){} });
  step("임대 유령 정리", ()=>{
    const g1=loanGhostFix(), g2=loanLogSlim();
    if(g1) try{ console.log("임대 유령 복제 "+g1+"명 정리"); }catch(e){}
    if(g1) try{ addNews(`🛟 임대 기록이 꼬여 있던 선수 <b>${g1}명</b>을 정리했습니다.`, "warn"); }catch(e){}
  });
  /* 🆔 선수 번호 중복 정리 — 어느 경로로 불러왔든 반드시 마지막에 밟는다.
     여기가 빠지면 스카우트 보고서·유스·FA 가 EACL 클럽 선수와 같은 번호를 들고 다닌다. */
  step("선수 번호 중복", ()=>{ PID=nextPid();
    const r=pidIntegrity();
    if(r.fixed){ try{ console.log("선수 번호 중복 "+r.fixed+"건 정리"); }catch(e){} } });
}
/* ⚠ 제보 — 「스카우트 보고서의 에메르송을 눌렀는데 다나카 다쓰야가 열린다. 전원이 이런 식이다.」
   원인은 선수 번호(id) 중복이었다. nextPid 가 EACL 클럽 선수를 훑지 않아서, 세이브를 불러올 때
   PID 가 EACL 선수 번호(리그 최대 번호보다 크다)보다 낮게 되감겼다. 그 뒤에 만들어진
   스카우트 보고서·유스·FA 가 EACL 선수와 같은 번호를 받고, findAnyPlayer 는 팀·EACL 을 먼저 훑으니
   보고서의 브라질 선수를 눌러도 일본 클럽 선수가 열렸다. 번호를 매기는 곳을 하나도 빼지 않는다. */
function pidScanAll(fn){
  const scan=arr=>{ if(!Array.isArray(arr)) return; for(const p of arr) if(p) fn(p); };
  for(const id in (G.teams||{})) scan(G.teams[id] && G.teams[id].players);
  scan(G.freeAgents); scan(G.overseas);
  if(G.scout) scan(G.scout.list);
  scan(G.youthPool);
  try{ for(const k in (G.eaclClubs||{})){ const c=G.eaclClubs[k]; scan(c && c.t && c.t.players); } }catch(e){}
}
function nextPid(){
  let mx=0;
  pidScanAll(p=>{ if(p.id>mx) mx=p.id; });
  return mx+1;
}
/* 이미 번호가 겹친 채 저장된 세이브를 바로잡는다.
   번호를 지키는 우선순위는 ① 리그 구단 선수 ② EACL 클럽 선수 ③ FA·해외 ④ 유스풀 ⑤ 스카우트 보고서.
   전술·선발 명단·협상이 참조하는 리그 선수 번호는 절대 건드리지 않는다. */
function pidIntegrity(){
  if(!G || !G.teams) return {fixed:0};
  const seen=new Set(), dups=[];
  const pass=(arr, movable)=>{ if(!Array.isArray(arr)) return;
    for(const p of arr){ if(!p || p.id==null) continue;
      if(!seen.has(p.id)) seen.add(p.id);
      else if(movable) dups.push(p);
      else seen.add(p.id);      // 옮길 수 없는 쪽은 그대로 둔다
    } };
  for(const id in G.teams) pass(G.teams[id].players, false);
  try{ for(const k in (G.eaclClubs||{})){ const c=G.eaclClubs[k]; pass(c && c.t && c.t.players, true); } }catch(e){}
  pass(G.freeAgents, true); pass(G.overseas, true);
  pass(G.youthPool, true); pass(G.scout && G.scout.list, true);
  /* ⚠ 리그 구단 선수끼리 겹치는 경우 — 이건 그냥 둘 수 없다(선발 명단·협상이 엉뚱한 선수를 가리킨다).
     먼저 등장한 쪽이 번호를 지키고, 뒤에 온 쪽만 새 번호를 받는다. */
  {
    const first=new Set(), later=[];
    for(const id in G.teams) for(const p of (G.teams[id].players||[])){
      if(p==null || p.id==null) continue;
      if(!first.has(p.id)) first.add(p.id); else later.push(p);
    }
    for(const p of later) dups.push(p);
  }
  if(!dups.length) return {fixed:0};
  let mx=0; for(const v of seen) if(v>mx) mx=v;
  try{ for(const id in G.teams) for(const p of (G.teams[id].players||[])) if(p && p.id>mx) mx=p.id; }catch(e){}
  let next=mx+1;
  /* 이 번호를 들고 있을 만한 곳을 전부 따라가 고친다 */
  const move=(old, nid)=>{
    const fixArr=(a)=>{ if(Array.isArray(a)) for(let i=0;i<a.length;i++) if(a[i]===old) a[i]=nid; };
    const fixMapKey=(o)=>{ if(o && typeof o==="object" && o[old]!==undefined){ o[nid]=o[old]; delete o[old]; } };
    try{ fixArr(G.userXI); }catch(e){}
    try{ for(const tid in G.teams){ const T=G.teams[tid].tactic; if(!T) continue;
      fixArr(T.benchSel); fixArr(T.benchExcl); fixArr(T.xi);
      fixMapKey(T.role); fixMapKey(T.roleBy); fixMapKey(T.slot); fixMapKey(T.zone);
      if(T.kickers && typeof T.kickers==="object") for(const kk in T.kickers) if(T.kickers[kk]===old) T.kickers[kk]=nid;
    } }catch(e){}
    try{ if(G.nego){ if(G.nego.pid===old) G.nego.pid=nid;
      if(G.nego.offerSwapPid===old) G.nego.offerSwapPid=nid;
      if(G.nego.agreedSwapPid===old) G.nego.agreedSwapPid=nid; } }catch(e){}
    try{ for(const o of (G.offers||[])) if(o && o.pid===old) o.pid=nid; }catch(e){}
    try{ for(const s of (G.shortlist||[])) if(s && s.pid===old) s.pid=nid; }catch(e){}
    try{ for(const a of (G.loanAsks||[])) if(a && a.pid===old) a.pid=nid; }catch(e){}
    try{ for(const a of (G.loanOffers||[])) if(a && a.pid===old) a.pid=nid; }catch(e){}
  };
  for(const p of dups){
    const old=p.id; p.id=next++;
    /* 뒤에 온 쪽만 옮기므로, 참조는 「먼저 등장한 선수」를 계속 가리키는 게 맞다.
       다만 그 참조가 실제로는 이 선수를 뜻했을 수 있어 팀 안에서만 한 번 더 확인한다. */
    if(!Object.keys(G.teams).some(tid=>(G.teams[tid].players||[]).some(q=>q!==p && q.id===old))) move(old, p.id);
  }
  PID=Math.max(PID||0, next);
  return {fixed:dups.length};
}
