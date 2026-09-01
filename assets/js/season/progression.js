"use strict";
/* =====================================================
   시즌 진행
===================================================== */
function findUserFixture(){
  const t=userTeam();
  const fix=t.div===1?G.k1Fix:G.k2Fix, r=t.div===1?G.r1:G.r2;
  if(r>=fix.length) return null;
  for(const [hid,aid] of fix[r]) if(hid===t.id||aid===t.id) return {hid,aid};
  return null;
}
function advance(){
  if(G.phase==="sacked"){ showSackScreen(); return {type:"sacked"}; }
  if(G.phase==="seasonEnd"){ startNewSeason(); return {type:"newseason"}; }
  /* 새 시즌 주장단이 정해지지 않았으면 경기를 치를 수 없다 — FM처럼 프리시즌에 반드시 거치는 절차다.
     스태프 회의로 보내고, 확정하면 다시 진행할 수 있다. */
  if(!G.jobless && goalNeeded()){ show("staff"); return {type:"needGoal"}; }
  if(!G.jobless && capNeeded()){ show("staff"); return {type:"needCaptain"}; }
  if(G.phase==="pre"){
    /* 🌍 CWC — 1월 대회는 연습경기보다 먼저 걸린다.
       프리시즌은 지금까지 「연습경기만 있는 조용한 기간」이었다. 여기에 공식전이 들어온다. */
    {
      let CP=null; try{ CP=cwcUserDue(); }catch(e){ CP=null; }
      if(CP && !G.jobless){
        const ut0=userTeam();
        try{ ensureSquad(ut0, true); }catch(e){}
        const okN=ut0.players.filter(avail).length;
        const gkN=ut0.players.filter(p=>avail(p)&&p.pos==="GK").length;
        if(okN<7 || gkN<1){
          /* 인원이 모자라면 수석코치가 대신 치른다 — 세계 대회를 취소할 수는 없다 */
          try{ cwcTick(true); }catch(e){}
          return {type:"round"};
        }
        const me=G.userTeamId, m=CP.m, home=(m.h===me);
        const H=cwcTeam(m.h), A=cwcTeam(m.a);
        /* 🟨 리그 징계를 잠시 내려놓고 대회 장부를 끼운다 — 끝나면 되돌린다 */
        try{ cwcBanPush(ut0); }catch(e){}
        G.pendingCWC={kind:CP.kind, hid:m.h, aid:m.a, r:(m.r!=null?m.r:-1), tag:CP.tag};
        /* ⚠ 검증에서 걸림 — M.ko 판정이 「opts.ko || (eacl && eaclStage!=="md")」인데 CWC 는
           eaclStage 를 넘기지 않아 8강·4강·결승도 ko=false 였다. 90분 동점이면 연장·승부차기 없이
           경기가 끝나고, 승자는 cwcRecordKO 의 가중 동전던지기로 화면 밖에서 정해졌다
           (실측: 8강 1-1 — 슛아웃 없이 「승부차기 패」 통보). 단판 토너먼트는 ko 를 명시한다. */
        return {type:"live", tag:CP.tag,
                M:createMatch(H, A, {noTable:true, cwc:true, cwcStage:CP.kind, eacl:true, neutral:true, ko:CP.kind!=="grp"})};
      }
    }
    const f=friendlyOn(G.day) || ((G.day||0)>=((G.cal&&G.cal.openOff)||0)-1 ? null : null);
    if(f && G.jobless){ f.done=true; }              // 무직 — 옛 팀 친선경기는 조용히 지나간다
    if(f && !G.jobless){
      const ut=userTeam(), opp=G.teams[f.oppId];
      /* ⚠ 제보 — 출전 가능 선수가 1명인 상태로 친선경기 킥오프까지 가서 게임이 굳었다.
         리그 경기에는 있던 최소 인원 검사가 친선 분기에만 빠져 있었다. 연습경기는 순위에
         들어가지 않으니 몰수패가 아니라 "취소"로 넘기고 그날을 소화시킨다. */
      try{ ensureSquad(ut, true); }catch(e){}
      const okN=ut.players.filter(avail).length;
      const gkN=ut.players.filter(p=>avail(p)&&p.pos==="GK").length;
      if(okN<7 || gkN<1){
        f.done=true; f.hg=0; f.ag=0; f.cancelled=1;
        addNews(`🚫 <b>연습경기 취소</b> — ${opp?opp.short:"상대"}전. 출전 가능 선수 ${okN}명${gkN<1?" · 골키퍼 없음":""}으로 경기를 치를 수 없습니다.`, "warn");
        notify(`🚫 <b>연습경기가 취소되었습니다</b> — 출전 가능 선수 ${okN}명${gkN<1?", 골키퍼 없음":""}. 선수단을 먼저 추스르세요.`,"warn");
        checkPreseasonEnd();
        return {type:"round"};
      }
      G.pendingFriendly=f;
      return {type:"live", tag:"프리시즌 친선경기",
              M:createMatch(f.home?ut:opp, f.home?opp:ut, {noTable:true, friendly:true})};
    }
    checkPreseasonEnd();
    if(G.phase==="pre") return {type:"round"};   // 아직 개막 전 — 날짜만 흐른다
  }
  /* 🌏 EACL — 리그 경기일보다 먼저 걸린다. 주중 아시아 경기를 치르고 주말 리그로 간다. */
  {
    let P=null; try{ P=eaclUserDue(); }catch(e){ P=null; }
    if(P){
      const ut0=userTeam();
      try{ ensureSquad(ut0, true); }catch(e){}
      const okN=ut0.players.filter(avail).length;
      const gkN=ut0.players.filter(p=>avail(p)&&p.pos==="GK").length;
      if(okN<7 || gkN<1){
        /* 인원을 못 채우면 대회 규정상 0-3 몰수. 리그 순위표와 무관하므로 EACL 기록에만 남긴다. */
        const meId=G.userTeamId;
        const tgt = P.kind==="md" ? P.m : P.t;
        const home = tgt.h===meId;
        if(P.kind==="md") eaclRecord(tgt, home?0:3, home?3:0); else eaclRecordKO(tgt, P.kind, home?0:3, home?3:0);
        if(P.kind==="md"){ eaclPlayMD(P.d); eaclMirrorUserFix(); if(G.eacl.fix.every(m=>m.done)&&G.eacl.stage==="draw") eaclSeedKO(); }
        else eaclPlayKO(P.kind);
        addNews(`⚫ <b>${eaclShort()} 몰수패</b> — 출전 가능 선수 ${okN}명${gkN<1?" · 골키퍼 없음":""}. 0-3 패배로 처리되었습니다.`, "warn", "club");
        notify("⚫ 출전 인원을 채우지 못해 "+eaclShort()+" 경기가 몰수패 처리되었습니다.","warn");
        saveGame();
        return {type:"round"};
      }
      const meId=G.userTeamId;
      const tgt = P.kind==="md" ? P.m : P.t;
      const H=eaclTeam(tgt.h), A=eaclTeam(tgt.a);
      G.pendingEACL={kind:P.kind, d:P.d, hid:tgt.h, aid:tgt.a, tag:P.tag};
      /* 🟨 대회 징계로 갈아 끼운다 — 리그에서 받은 출전정지는 이 경기에 영향을 주지 않는다.
         ⚠ 갈아끼우기가 빠지면 리그 징계가 그대로 대회에 걸린다(제보). 여기서 반드시 건다. */
      try{ eaclBanPush(userTeam()); }catch(e){}
      try{ banSweepEacl(userTeam()); }catch(e){}
      return {type:"live", tag:P.tag, M:createMatch(H, A, {noTable:true, eacl:true, eaclStage:P.kind, neutral:(P.kind!=="md"&&P.kind!=="qf")})};
    }
  }
  if(G.phase==="po"){
    if(!G.poQueue.length){
      /* 🏆 승강 PO 는 끝났지만 대회가 남아 있다 — 시즌을 닫지 않는다.
         날짜만 흘려보내 4강·결승 경기일까지 가고, 그 경기는 감독이 직접 지휘한다. */
      if(eaclUserLeft()){ try{ eaclTick(false); }catch(e){} completeRound(null); return {type:"round"}; }
      endSeason(); return {type:"seasonEnd"};
    }
    const m=G.poQueue[0];
    const hid=resolvePOid(m.h), aid=resolvePOid(m.a);
    if(!G.jobless && (hid===G.userTeamId||aid===G.userTeamId)){
      G.poQueue.shift(); G.pendingPO={m,hid,aid};
      return {type:"live", M:createMatch(G.teams[hid],G.teams[aid],poOpts(m)), tag:m.tag};
    }
    return runPOInstant();
  }
  const uf=G.jobless?null:findUserFixture();
  if(uf){ // 유저 경기 → 라이브 중계
    /* ⚫ 킥오프 전 최소 인원 검사 — 실제 규정처럼 7명을 못 채우면 경기 없이 0-3 몰수패다.
       (제보: 선수단을 전부 패서 단체 태업 → 7명 미만으로도 킥오프가 됐다)
       유스 긴급 콜업(ensureSquad)이 먼저 한 번 더 시도되고, 그래도 안 되면 몰수. */
    const ut0=userTeam();
    try{ ensureSquad(ut0, true); }catch(e){}       // 최종 소집 — 같은 날 이미 콜업했어도 한 번 더
    const okN=ut0.players.filter(avail).length;
    if(okN<7) return forfeitUserMatch(uf, okN);
    return {type:"live", M:createMatch(G.teams[uf.hid],G.teams[uf.aid],{})};
  }
  completeRound(null); // 휴식 라운드
  return {type:"round"};
}
/* 부상·출장정지·태업으로 못 뛰게 된 선수를 선발 명단과 배치도에서 정리한다.
   이걸 안 하면 다음 경기 전술판이 그 선수를 자리에 붙잡아 둔 채 화면이 어긋난다. */
function pruneUserLineup(){
  const t=userTeam(); if(!t) return;
  try{ banCtxSync(); }catch(e){}         // 🟥 제보 — 대회가 다르면 정지는 걸리지 않는다
  /* ⚠ 제보 — 선발에 부상자가 생기면 벤치에 빈자리가 생기고, 그 자리와 그 외 명단이 뒤죽박죽이 된다.
     예전에는 못 뛰게 된 선수를 「지우기만」 했다. 그가 서 있던 자리는 주인 없이 남고,
     대신 들어온 선수는 자리를 물려받지 못해 전술판이 임의로 다시 그려졌다.
     ─ 빠진 자리를 기억해 두었다가, 그 자리를 대체 선수에게 그대로 물려준다. */
  const _lostSlots=[];
  if(Array.isArray(G.userXI) && G.userXI.length){
    const keep=G.userXI.filter(id=>{ const p=t.players.find(x=>x.id===id); return p && avail(p); });
    if(keep.length!==G.userXI.length){
      for(const id of G.userXI){
        if(keep.indexOf(id)>=0) continue;
        const s=t.tactic && t.tactic.slot && t.tactic.slot[id];
        if(s) _lostSlots.push(s);
      }
      G.userXI = keep.length ? keep : null;
    }
  }
  /* ⚠ 여기가 "경기만 끝나면 전술판이 기본 포메이션으로 돌아가는" 버그의 원인이었다.
     t.tactic.slot 은 { 선수id : 슬롯이름 } 인데(setSlot 참조), 예전 코드는 이걸
     { 슬롯이름 : 선수id } 로 착각해서 키(=선수id)로 순회하며 값(="LWB" 같은 문자열)을
     선수 id 로 찾았다. 그런 선수가 있을 리 없으니 매번 전 항목이 지워졌고,
     경기가 끝날 때마다(finishLive → pruneUserLineup) 손으로 잡아 둔 배치가 통째로 날아갔다.
     zone 맵도 같은 구조이므로 함께 정리한다. */
  for(const key of ["slot","zone"]){
    const map=t.tactic && t.tactic[key];
    if(!map) continue;
    for(const pid in map){
      const p=t.players.find(x=>String(x.id)===String(pid));
      if(!p || !avail(p)) delete map[pid];
    }
  }
  /* 🧩 ① 선발 빈자리를 「그 자리에 맞는 선수」로 메운다.
     ⚠ 제보 — 「미드필더가 다쳤는데 윙어가 그 자리에 올라온다」.
        예전에는 열한 명을 통째로 다시 짠 뒤(bestXI), 새로 들어온 선수와 빈 자리를
        순서대로 짝지었다. 그 두 순서는 아무 관계가 없어서 자리와 사람이 어긋났다.
        ─ 빈 자리마다 그 자리 점수(자리 기준 별점 × 포지션 능숙도)가 가장 높은 선수를 세운다.
          쓸 만한 사람이 없으면 그 자리는 비워 둔다 — 엉뚱한 선수를 억지로 넣지 않는다. */
  try{
    if(t.isUser && Array.isArray(G.userXI) && G.userXI.length>0 && G.userXI.length<11 && _lostSlots.length){
      if(t.tactic) t.tactic.slot=t.tactic.slot||{};
      const frnLim=frnLimOf(t);
      const cntFrn=()=>G.userXI.filter(id=>{ const q=t.players.find(x=>x.id===id); return q&&frnQ(q); }).length;
      const FAM_OK=45;                          // 이 밑이면 「그 자리를 볼 줄 모른다」로 본다
      for(const s of _lostSlots){
        if(G.userXI.length>=11) break;
        const used=new Set(G.userXI);
        const cands=t.players.filter(q=>avail(q) && !used.has(q.id) && !(q.loan&&q.loan.own!==t.id));
        const best=cands.map(q=>({q, v:slotPickScore(q, s), f:getPosFam(q, s)}))
                        .filter(x=>x.v>0 && x.f>=FAM_OK)
                        .sort((a,b)=>b.v-a.v)[0];
        if(!best) continue;                     // 마땅한 사람이 없다 — 자리를 비워 둔다
        if(frnQ(best.q) && cntFrn()>=frnLim) continue;
        G.userXI.push(best.q.id);
        if(t.tactic) t.tactic.slot[best.q.id]=s;
      }
      /* 아직 비어 있으면 문턱을 한 번 낮춰 다시 본다 — 다만 「그 자리를 아예 볼 줄 모르는」
         선수(능숙도 25 미만)는 넣지 않는다. 억지로 세우느니 열 명으로 나가는 게 낫고,
         그 편이 감독 눈에도 「여기가 빈다」가 보인다. */
      if(G.userXI.length<11){
        const filled=new Set(G.userXI.map(id=>(t.tactic&&t.tactic.slot||{})[id]).filter(Boolean));
        for(const s of _lostSlots){
          if(G.userXI.length>=11) break;
          if(filled.has(s)) continue;                    // 이미 채워진 자리
          const used=new Set(G.userXI);
          const cands=t.players.filter(q=>avail(q) && !used.has(q.id) && !(q.loan&&q.loan.own!==t.id));
          const best=cands.map(q=>({q, v:slotPickScore(q, s), f:getPosFam(q, s)}))
                          .filter(x=>x.v>0 && x.f>=25).sort((a,b)=>b.v-a.v)[0];
          if(!best) continue;
          if(frnQ(best.q) && cntFrn()>=frnLim) continue;
          G.userXI.push(best.q.id);
          if(t.tactic) t.tactic.slot[best.q.id]=s;
          filled.add(s);
        }
      }
      /* 자리를 비운 채로 남았다면 감독에게 알린다 — 모르고 열 명으로 나가는 일이 없게 */
      if(G.userXI.length<11){
        try{ notify(`⚠️ 선발에 <b>${11-G.userXI.length}자리</b>가 비었습니다 — 그 자리를 소화할 만한 선수가 없습니다.
          전술 탭에서 직접 채워 주세요.`,"warn"); }catch(e){}
      }
    }
  }catch(e){}
  /* 🪑 ② 교체 명단 정리 — 못 뛰게 된 선수와 「선발로 올라간 선수」를 함께 빼고, 그만큼만 다시 채운다.
     (선발 승격을 빼먹으면 명단에는 9명인데 실제 벤치는 6명이 되는 어긋남이 생긴다) */
  if(t.tactic && Array.isArray(t.tactic.benchSel)){
    const before=t.tactic.benchSel.length;
    const starters=new Set((G.userXI||[]).map(Number));
    t.tactic.benchSel=t.tactic.benchSel.filter(id=>{
      const p=t.players.find(x=>x.id===id);
      return p && avail(p) && !starters.has(Number(id));
    });
    const lostN=before-t.tactic.benchSel.length;
    if(lostN>0){
      try{
        const xiSet=new Set(bestXI(t).map(p=>p.id));
        const inSel=new Set(t.tactic.benchSel);
        const excl=new Set(t.tactic.benchExcl||[]);
        const pool=t.players.filter(p=>avail(p)&&!xiSet.has(p.id)&&!inSel.has(p.id)&&!excl.has(p.id))
                            .sort((a,b)=>(b.ovr-a.ovr));
        const needGK=!t.tactic.benchSel.some(id=>{ const q=t.players.find(x=>x.id===id); return q&&q.pos==="GK"; });
        if(needGK){ const gk=pool.find(p=>p.pos==="GK"); if(gk){ t.tactic.benchSel.push(gk.id); inSel.add(gk.id); } }
        for(const p of pool){
          if(t.tactic.benchSel.length>=before) break;
          if(inSel.has(p.id)) continue;
          t.tactic.benchSel.push(p.id); inSel.add(p.id);
        }
      }catch(e){}
    }
  }
}
/* ═══ 🏆 리그 우승 확정 ═══════════════════════════════════════════════
   최종전 트로피 세리머니(endSeason)와는 별개로, 「수학적으로 더 뒤집힐 수 없는」
   그 라운드가 있다. 실제 리그에서도 그날이 진짜 우승의 날이다.
   ⚠ 스플릿·3로빈 등 어떤 형식이든 「남은 라운드 수 × 3점」으로만 판단한다. */
function divRoundsLeft(div){
  try{
    const fx=(div===1?G.k1Fix:G.k2Fix)||[];
    const r =(div===1?G.r1:G.r2)||0;
    return Math.max(0, fx.length-r);
  }catch(e){ return 99; }
}
function titleClinched(div){
  const tb=tableOf(div);
  if(!tb || tb.length<2) return null;
  const left=divRoundsLeft(div);
  if(left<=0) return null;                       // 최종전에서 갈렸다면 시즌 종료 처리가 맡는다
  const gap=(tb[0].Pts||0)-(tb[1].Pts||0);
  if(gap > left*3) return {champ:tb[0], left, gap};
  return null;
}
function checkTitleClinch(){
  if(!G.cal) return;
  G.clinched=G.clinched||{};
  for(const div of [1,2]){
    const key=G.season+"-"+div;
    if(G.clinched[key]) continue;
    const c=titleClinched(div);
    if(!c) continue;
    G.clinched[key]=c.champ.id;
    const u=(!G.jobless && userTeam()) ? userTeam() : null;
    const mine=!!(u && u.id===c.champ.id);
    const V={t:c.champ.short, n:c.left, d:divName(div), g:c.gap};
    /* ── 리그 공식·기사 ── */
    addNews(`🏆 <b>${c.champ.name}, ${G.season} ${divName(div)} 우승 확정!</b> — ${c.left}경기를 남기고 정상을 확정했습니다. (2위와 승점 ${c.gap})`, "good", "club");
    pushFeed({cat:"club", ic:"🏆", tone: mine?1:0, tid:c.champ.id, src:"K리그 공식",
      head:`${c.champ.name}, ${c.left}경기 남기고 ${divName(div)} 우승 확정`,
      sub:`승점 ${c.champ.Pts}. 2위와의 격차 ${c.gap}점으로 남은 일정과 무관하게 정상이 확정됐다.`});
    if(!mine) continue;                          // 남의 우승은 기사까지만
    /* ── 여론 ── */
    try{
      socialFill(SOC.clinch, 6+R(4), 1, V);
      fmkFill(FMK.clinch, 4+R(3), V);
      rivalFill(SOC.clinchRival, 2+R(3), 0, V);
    }catch(e){}
    /* ── 구단 반응 ── */
    try{
      adjustTrust("owner", 14, `${divName(div)} 우승 확정`);
      adjustTrust("fans", 16, `${divName(div)} 우승 확정`);
      G.press.rel=clamp((G.press.rel||50)+6, 0, 100);
      u.morale=clamp((u.morale||70)+7, 40, 99);
      for(const p of u.players){ p.morale=clamp((p.morale||70)+6, 30, 99); try{ affAdd(p, 5, "우승 확정"); }catch(e){} }
      addFam(u, 3);                              // 다 이룬 팀은 손발이 더 맞는다
    }catch(e){}
    /* ── 구단주·프런트의 말 ── */
    try{
      const own=clubType(u);
      const say = own && own.k==="corp"
        ? [`"그룹 차원에서 감사드립니다. 이 성과는 숫자로도 증명될 겁니다."`,
           `"내년 예산 회의에서 감독님 편에 서겠습니다. 오늘은 그냥 즐기시죠."`,
           `"모기업 회장님이 직접 축전을 보내셨습니다."`]
        : [`"시민들께 이보다 큰 선물이 없습니다. 시청 앞에 현수막이 걸렸습니다."`,
           `"의회에서도 축하 인사가 왔습니다. 내년 예산 얘기가 수월해지겠군요."`,
           `"우리 구단 역사에 남을 시즌입니다. 감독님 덕분입니다."`];
      addMood(`🏆 <b>${divName(div)} 우승 확정!</b> 구단주: ${pick(say)}`, "good");
      addMood(`🎉 라커룸이 뒤집혔습니다. 남은 ${c.left}경기는 홈 팬들에게 바치는 잔치가 됩니다. <span class="small">(팀 사기 +7 · 선수 사기 +6)</span>`, "good");
    }catch(e){}
    /* ── 우승 보너스 ── */
    try{
      const bonus=Math.round((div===1?3.5:1.8)*10)/10;
      u.budget=Math.round((u.budget+bonus)*10)/10;
      try{ const fin=finLedger(u); fin.prize=Math.round(((fin.prize||0)+bonus)*100)/100; }catch(e){}
      addNews(`💰 우승 확정 보너스 <b>${bonus}억</b>이 구단 예산에 반영되었습니다.`, "good", "club");
    }catch(e){}
    try{ notify(`🏆 <b>${divName(div)} 우승 확정!</b> ${c.left}경기를 남기고 정상에 올랐습니다.`, "good"); }catch(e){}
  }
}
/* ⚫ 몰수패 — 최소 인원(7명) 미달. 경기 없이 상대의 3-0 승리로 기록된다. */
function forfeitUserMatch(uf, okN){
  const t=userTeam(), home=G.teams[uf.hid], away=G.teams[uf.aid];
  const hg=home.isUser?0:3, ag=home.isUser?3:0;
  const div=t.div, r=div===1?G.r1:G.r2;
  for(const [tt,gf,ga] of [[home,hg,ag],[away,ag,hg]]){
    tt.GF+=gf; tt.GA+=ga;
    if(gf>ga){ tt.W++; tt.Pts+=3; tt.form.push("W"); }
    else { tt.L++; tt.form.push("L"); }
  }
  G.results.push({s:G.season, div, r:r+1, hid:uf.hid, aid:uf.aid, hg, ag, att:0, forfeit:1});
  addNews(`⚫ <b>몰수패</b> — ${t.name}, 출전 가능 선수 ${okN}명. 최소 인원(7명)을 채우지 못해 <b>0-3 몰수패</b> 처리되었습니다.`, "warn");
  addNews(`🏛️ 연맹, ${t.short} 몰수패 공식 확인 — "구단 운영 책임을 엄중히 본다"`, "warn", "club");
  adjustTrust("owner", -12, "몰수패 — 선수단 붕괴");
  adjustTrust("fans", -10, "몰수패");
  t.morale=clamp((t.morale||70)-6, 40, 99);
  try{ socialFill(SOC.forfeitOur, 4+R(2), -1, {t:t.short, n:okN}); fmkFill(FMK.forfeitOur, 3+R(2), {t:t.short, n:okN}); rivalOnManager(false); }catch(e){}
  lastMatch={type:"match", res:{hg, ag, events:[{min:0, type:"bad", txt:`⚫ 몰수패 — 출전 가능 선수 ${okN}명 (최소 7명)`}], sc:[]}, h:home, a:away, att:0};
  completeRound(null);   // 나머지 경기 진행 + 라운드 마감 (우리 경기는 이미 기록됐다)
  saveGame();
  notify(`⚫ <b>몰수패.</b> 출전 가능 선수가 ${okN}명뿐입니다 — 0-3 패배로 기록되었습니다. 태업·부상·징계부터 수습하세요.`,"warn");
  return {type:"round", forfeit:1};
}
/* 라운드 마무리: 유저 경기 결과 반영 + AI 경기 일괄 시뮬 + 후처리 */
function completeRound(M){
  const ut=userTeam();
  /* 🛑 ⚠ 제보 — 「일정 및 훈련 탭을 눌러도 아무 반응이 없는데 왜 이런 걸까요 ㅠㅠ」
     순위표 밖의 경기(CWC·EACL·연습경기·승강PO·온라인)는 각자의 pending 표식으로 갈라졌는데,
     그 표식이 사라진 채(경기 중 저장·재접속 등) 이 함수로 흘러들면 리그 결과로 기록된다.
     그러면 G.teams 에 없는 임시 클럽 id(cwc_eu_bar 등)가 G.results 에 박히고,
     일정 화면이 그 줄을 그리다 죽어 탭 자체가 안 열린다.
     → 표식이 아니라 경기 자체(M.opts.noTable)로 판단해 리그 장부에서 제외한다. */
  if(M && M.opts && (M.opts.noTable || M.opts.friendly || M.opts.pvp || M.opts.cwc || M.opts.eacl)){
    try{ applyMatchResult(M); }catch(e){}
    try{ saveGame(); }catch(e){}
    return {type:"round", skipped:1};
  }
  if(M){
    applyMatchResult(M);
    const div=ut.div, r=div===1?G.r1:G.r2;
    G.results.push({s:G.season,div,r:r+1,hid:M.home.id,aid:M.away.id,hg:M.hg,ag:M.ag,att:M.att||0,aatt:M.aatt||0});
    try{ aiMatchIncome(M); }catch(e){}
    try{ matchNews(M, div, r+1); }catch(e){}
    try{ socialOnReferee(M); }catch(e){}
    // 연봉은 구단 운영비에서 나간다(연봉 상한으로 관리) — 이적 예산에서 빼지 않는다.
    // 이적 예산에는 입장 수입·중계권 배분 같은 "쓸 수 있는 현금"만 들어온다.
    // 라운드 수입 = 중계권·리그 분배금(고정) + 홈경기라면 입장·부대 수입
    const fin=finLedger(ut);
    let inc=TV_ROUND[ut.div]||0.25;
    fin.tv=Math.round((fin.tv+inc)*100)/100;
    if(M.home.isUser && !(M.opts&&M.opts.friendly)){
      const att=M.att||0;
      const gate=gateRevenue(ut, att);
      inc+=gate;
      fin.gate=Math.round((fin.gate+gate)*100)/100;
      /* 🏪 편의시설 순수익 — 관중 수에 비례해 홈경기마다 (제보 — 시설이 구단 수익으로) */
      const facInc=facMatchIncome(ut, att);
      if(facInc>0){ inc+=facInc; fin.fac=Math.round(((fin.fac||0)+facInc)*100)/100; }
      fin.att.push(att);
      if(att>(fin.best||0)){ fin.best=att; fin.bestOpp=(M.away.short||""); }
      logHomeGate(ut, M, att, gate);
      try{ stadOpeningGame(M); }catch(e){}
    }
    // 총수입 중 이적 가용 현금으로 넘어오는 몫만 예산에 더한다
    let toBudget=Math.round(inc*BUD_SHARE*100)/100;
    /* 구장 사업이 돌아가는 동안에는 수입의 일부가 공사비로 먼저 빠진다 */
    try{ toBudget=Math.round((toBudget-stadSkim(ut, toBudget))*100)/100; }catch(e){}
    fin.toBudget=Math.round(((fin.toBudget||0)+toBudget)*100)/100;
    ut.budget=Math.round((ut.budget+toBudget)*10)/10;
    // 이번 경기 결과가 다음 홈경기 관중에 반영된다
    updateHype(ut, M.home.isUser?M.hg:M.ag, M.home.isUser?M.ag:M.hg, M.home.isUser);
  }
  const skipU=!G.jobless;    // 무직이면 옛 팀 경기도 AI 시뮬에 포함된다
  if(ut.div===1){
    if(G.r1<G.k1Fix.length) playRound(1,skipU);
    if(G.r2<G.k2Fix.length) playRound(2,false);
  } else {
    if(G.r2<G.k2Fix.length) playRound(2,skipU);
    if(G.r1<G.k1Fix.length) playRound(1,false);
  }
  if(G.jobless){ try{ joblessTick(); }catch(e){} }
  /* 🚨 긴급 등록 유스 — "임시 소집" 신분이다. 정규 자원이 충분해지면 유스팀으로 돌려보낸다.
     (제보 — 무한 콜업으로 유스를 쌓아 이적 장사하는 악용 차단. 판매도 막혀 있다.) */
  for(const id in G.teams){
    const t2=G.teams[id];
    const emg=t2.players.filter(p=>p.emg);
    if(!emg.length) continue;
    const regularOk=t2.players.filter(p=>!p.emg && avail(p)).length;
    if(regularOk>=13){
      for(const q of emg){ const i=t2.players.indexOf(q); if(i>=0) t2.players.splice(i,1); }
      G.transferBids=G.transferBids.filter(b=>!emg.some(q=>q.id===b.pid));
      G.offers=(G.offers||[]).filter(o=>!emg.some(q=>q.id===o.pid));
      if(t2.isUser) addMood(`🎒 긴급 등록됐던 ${emg.length}명이 유스팀으로 복귀했습니다 — 1군이 정상화되었습니다.`);
    }
  }
  playACLIfDue();
  try{ loanSweep(); }catch(e){}
  try{ armyCallPurge(); }catch(e){}   // 🎖️ 제보 — 외국 국적 입영 통지 취소
  try{ armySweep(); }catch(e){}
  try{ loanInReview(); }catch(e){}
  if(!G.splitDone && G.r1>=splitAt()) makeSplit();
  const k1done=G.r1>=G.k1Fix.length, k2done=G.r2>=G.k2Fix.length;
  if(k1done&&k2done&&G.phase==="league"){ G.phase="po"; G.poQueue=buildPOQueue(); addNews("⚔️ 정규리그 종료! 승강 플레이오프가 시작됩니다."); }
  try{ checkTitleClinch(); }catch(e){}   // 🏆 이 라운드로 우승이 정해졌는가
  try{ acqRoundCheck(); }catch(e){}      // 📰 시민구단 인수 접촉설 (요청)
  try{ banSweep(); }catch(e){}      // 🟥 갈아끼운 징계가 갇혀 있으면 먼저 되돌린다
  tickBanInj({inj:true, ban:true});
  /* ⚠ 제보 — "출장정지 해제가 안 됩니다": 방출·FA로 풀린 선수는 구단 순회 루프 밖이라
     징계·부상 시계가 얼어 있었다. 무적 신분이어도 시간은 흐른다. */
  for(const p of (G.freeAgents||[])){
    if(p.inj>0) p.inj--;
    if(p.banNew){ delete p.banNew; }
    else if(p.ban>0) p.ban--;
    // 감독을 좋아하는 선수는 조금 더 높은 곳으로, 싫어하는 선수는 낮은 곳으로 수렴한다
    const base = 62 + (aff(p)-AFF_DEF)*0.24;
    p.morale=Math.round(clamp(p.morale+(base-p.morale)*0.05,25,99)*100)/100;
    p.mn=(p.mn||0)*0.86;   // 최근 출전 시간은 매주 조금씩 잊힌다 — 안 뛰면 성장도 멈춘다
  }
  /* 사기는 서서히 기준선(58)으로 되돌아간다 — 라커룸·인터뷰 버프만으로 높은 사기가 유지되지 않게.
     높을수록 더 빨리 내려온다(90대는 유지 자체가 어렵다). 낮을 때의 회복은 느리다. */
  {
    const base=58, d=ut.morale-base;
    const k = d>0 ? (0.07 + Math.max(0, d-20)*0.006) : 0.035;
    ut.morale=clamp(Math.round((ut.morale-d*k)*100)/100,40,99);
  }
  // 지난 회의에서 넘긴 안건은 라운드가 바뀌면 다시 올라온다
  if(G.staff && G.staff.handled) G.staff.handled={};
  if(G.sue && G.sue.chill>0) G.sue.chill--;   // 눈치 보던 기간이 하루씩 풀린다
  if(G.sue && (G.sue.embold||0)>0) G.sue.embold--;   // 기고만장도 며칠이면 식는다
  /* ── 유저 팀 선수 불만·약속 처리
     ⚠ 제보 — 「무직인데 일정 진행에 면담이 필요해 보입니다가 뜬다」.
        맡은 팀이 없어도 이 블록이 옛 팀 선수들의 불만·태업·약속을 계속 굴리고 있었다.
        면담을 할 수도, 약속을 지킬 수도 없는 사람에게 그 알림이 갈 이유가 없다. */
  const rp=ut.div===1?G.r1:G.r2, tAvg=teamOVR(ut);
  for(const p of (G.jobless ? [] : ut.players)){
    if(p.sulk>0){ // 태업 중: 사기 바닥, 컨디션 저하
      p.sulk--; p.morale=Math.min(p.morale,38); p.cond=clamp(p.cond-3,55,100);
      if(p.sulk===0){ p.morale=50; addMood(`😔 ${p.name}이(가) 태업을 끝내고 훈련에 복귀했습니다. 앙금은 남아 있습니다.`); }
    }
    if(p.promise){
      if(p.apps-p.promise.apps0>=p.promise.need){ p.promise=null; p.unhappy=0; p.morale=clamp(p.morale+5,30,99);
        affAdd(p, +12, "약속 이행"); addMood(fixJosa(`🤝 ${p.name}과/와의 출전 약속 이행 — 신뢰가 깊어졌습니다. (호감도 상승)`)); }
      /* ⚠ 제보 — 「m경기 안에 n경기 출전 약속을 했는데, 부상·경고 누적으로 못 나오는 동안에도
            카운트가 흘러가서 약속이 깨지고 태업한다」.
         감독이 안 내보낸 게 아니라 선수가 나올 수 없었던 것이다 — 그 라운드는 세지 않는다.
         약속 기간이 그만큼 뒤로 밀리므로 약속 자체는 살아 있다. */
      else if((()=>{
        const why = p.inj>0 ? `부상(${p.inj}주)`
                  : p.ban>0 ? `출장정지(${p.ban}경기)`
                  : p.banE>0 ? `${eaclShort()} 출전정지(${p.banE}경기)`
                  : (p.army && p.army.out) ? "군 복무"
                  : (p.loan && p.loan.own===ut.id && p.loan.to!==ut.id) ? "타 구단 임대"
                  : null;
        if(!why) return false;
        p.promise.skip=(p.promise.skip||0)+1;
        /* 너무 오래 못 나오면 약속은 자연 소멸한다 — 벌은 없다. 장기 부상은 누구의 잘못도 아니다. */
        if(p.promise.skip>=9){
          p.promise=null;
          addMood(`🤝 ${p.name}의 출전 약속 — ${why} 기간이 길어져 없던 일로 정리했습니다. <b>불이익은 없습니다.</b>`);
          return true;
        }
        if(p.promise.skip===1 || p.promise.skip%3===0){
          const left=Math.max(0, p.promise.need-(p.apps-p.promise.apps0));
          addMood(`🤝 ${p.name} 출전 약속 — ${why} 때문에 나올 수 없어 이번 라운드는 세지 않았습니다. `
            +`(남은 ${p.promise.rounds}R · ${left}경기 필요)`);
        }
        return true;
      })()){ /* 이 라운드는 흘려보낸다 */ }
      else if(--p.promise.rounds<=0){
        /* 💢 약속을 어겼다 — 여기서부터는 유기적으로 굴러간다.
           이적시장이 열려 있으면 → 공개 이적 요청 (제의가 들어오기 시작한다)
           닫혀 있으면 → "가지도 못하게 막아 놓고" 태업으로 폭발한다 */
        p.promise=null;
        p.promiseBroken=(p.promiseBroken||0)+1;      // 같은 입에서 나온 약속은 두 번 안 믿는다
        p.morale=clamp(p.morale-8,30,99);
        affAdd(p, -16, "약속 불이행");
        p.unhappy=3;
        /* ⚠ 제보 — 「남고 싶다는 선수가 이적 요청을 한다」.
           잔류를 선언했거나 감독을 크게 신뢰하는 선수는 화가 나도 팀을 떠나겠다고 하지 않는다.
           대신 「경기에 내보내 달라」는 쪽으로 항의한다 — 요청과 본심이 어긋나지 않게. */
        const stay = p.noMove || (aff(p)>=72 && p.pers===2) || (aff(p)>=80);
        if(transferOpen() && !stay){
          p.uWhy="약속 불이행 — 이적 요청";
          addMood(`💢 ${p.name}: "약속이 다르잖습니까! 저를 원하는 팀으로 보내 주십시오." — <b>공개 이적 요청</b>`);
          addNews(`🚨 ${p.name}, 출전 약속 불이행에 공개 이적 요청 — "구단이 먼저 약속을 어겼다"`, "warn", "club");
        } else if(stay){
          p.uWhy="약속 불이행 — 출전 요구";
          addMood(`😤 ${p.name}: "저는 이 팀에 남고 싶습니다. 그러니까 더 답답한 겁니다 — 뛰게 해 주십시오."`);
        } else {
          p.uWhy="약속 불이행";
          p.sulk=Math.max(p.sulk||0, 3+R(3));
          addMood(`🤬 ${p.name}: "약속도 어기고, 이적시장도 닫혔고... 저더러 어쩌라는 겁니까." — <b>태업 돌입</b> (${p.sulk}R)`);
        }
      }
    }
    /* 🔁 이적 요청 ↔ 태업 전환 — 시장이 닫히면 나갈 길이 없어 태업으로, 열리면 태업을 멈추고 기다린다 */
    if(p.unhappy>=3 && String(p.uWhy||"").includes("이적 요청")){
      if(!transferOpen() && p.sulk<=0 && Math.random()<0.30){
        p.sulk=2+R(3);
        addMood(`🤬 ${p.name} — 이적 요청 중인데 시장이 닫혀 있습니다. 훈련장에 나오지 않습니다. (태업 ${p.sulk}R)`);
      } else if(transferOpen() && p.sulk>0 && String(p.uWhy||"").includes("약속 불이행")){
        p.sulk=0;
        addMood(`🚪 ${p.name} — 이적시장이 열리자 태업을 멈췄습니다. "제의가 오면 보내 주십시오. 그때까지는 뜁니다."`);
      }
    }
    /* 태업으로 폭발했던 약속 불이행자도 시장이 열리면 이적 요청 모드로 전환 */
    if(p.uWhy==="약속 불이행" && transferOpen()){
      p.uWhy="약속 불이행 — 이적 요청"; p.sulk=0;
      addMood(`🚪 ${p.name} — 시장이 열렸습니다. 태업 대신 공개 이적 요청으로 방향을 틀었습니다.`);
    }
    if(p.unhappy>0){
      /* ⏱️ ⚠ 제보 — 출전 불만은 「출전 상황」을 계속 봐야 한다. 불만을 품은 뒤 실제로
         꾸준히 뛰고 있으면(라운드의 55% 이상 출전) 커지는 게 아니라 식어야 맞다. */
      if(p.uWhy==="출전 시간" && rp>0 && (p.apps|0)>=rp*0.55 && Math.random()<0.30){
        p.unhappy--;
        if(p.unhappy<=0){ p.unhappy=0; p.uWhy="";
          addMood(`🕊️ ${p.name} — 꾸준한 출전으로 출전 시간 불만이 풀렸습니다.`); }
        continue;
      }
      p.morale=clamp(p.morale-2,30,99);
      if(p.unhappy<3&&Math.random()<0.07){ p.unhappy++;
        if(p.unhappy>=3){
          /* ⚠ 「공개적으로 이적을 요청했습니다」라고 알리면서 정작 사유(uWhy)는 그대로 뒀다.
             떠나고 싶은지 판정하는 wantsOut 은 그 문구를 보므로, 말과 데이터가 어긋나
             본인이 요청해 놓고 제의가 오면 거부하는 상황이 됐다(제보). 여기서 못 박는다. */
          const _w0=p.uWhy||"불만";
          if(!String(_w0).includes("이적 요청")) p.uWhy=_w0+" — 이적 요청";
          addMood(`🚨 ${p.name}, 구단에 공개적으로 이적을 요청했습니다! (사유: ${_w0})`);
        } }
    } else if(rp>6 && p.inj<=0 && p.ovr>=tAvg-1){
      const affK=clamp(1.8 - aff(p)/62, 0.35, 1.9);
      if(String(p.uWhy||"").includes("폭행") && aff(p)>=55 && Math.random()<0.06){
        p.unhappy=Math.max(0,p.unhappy-1); if(p.unhappy===0){ p.uWhy=""; addMood(`🕊️ ${p.name} — 시간이 지나며 폭행의 앙금이 조금씩 가라앉는 듯합니다.`); }
      }
      if(p.ovr>=tAvg+2 && p.apps<rp*0.45 && Math.random()<0.12*affK){
        p.unhappy=2; p.uWhy="출전 시간";
        addMood(`😡 주전급 ${p.name}이(가) 출전 시간에 강하게 불만을 표했습니다 — "제 자리는 벤치가 아닙니다." (면담 권장)`);
      }
      else if(p.apps<rp*0.3 && Math.random()<0.08*affK){ p.unhappy=1; p.uWhy="출전 시간"; addMood(`😠 ${p.name}이(가) 출전 기회 부족에 불만을 갖기 시작했습니다. (스쿼드 탭에서 면담 가능)`); }
      else if(p.wage<wageExpect(p.ovr,p.frn,(teamOfPlayer(p)||{}).div)*0.6 && Math.random()<0.04*affK){ p.unhappy=1; p.uWhy="연봉"; addMood(`😠 ${p.name} 측이 연봉 인상을 원하고 있습니다. (스쿼드 탭에서 면담 가능)`); }
    }
  }
  brewRumors();                     // 시장이 떠든다 (리그 이야기 — 무직이어도 돈다)
  if(!G.jobless){
    pruneUserLineup();              // 못 뛰게 된 선수를 선발·배치도에서 빼 둔다
    affWeekly(ut);                  // 출전 시간에 따라 감독을 보는 눈이 달라진다
    if(typeof sackCheck==="function" && sackCheck()) return;   // 경질되면 여기서 끝난다
    brewGrievances();               // 수석코치가 다음 회의에 들고 올 안건
    try{ brewConcerns(); }catch(e){}  // 체중 등 개인 고민
  }
  for(const id in G.teams) addFam(G.teams[id], FAM_MATCH);
  // 날짜는 '진행' 버튼이 하루씩 넘긴다(stepDay). 여기서 몰아서 넘기면 그 사이 소식이 통째로 사라지고,
  // 하루라도 억지로 밀면 '경기 다음 날 회복'이 통째로 날아가 시즌 말에 스쿼드가 방전된다.
  saveGame();
}
/* ═══════════════════════════════════════════════════════════════
   가상 달력 · 훈련 · 전술 적응도
   라운드 번호만 있던 시절에는 "다음 경기"가 그냥 다음 칸이었다. 실제 시즌은 그렇지 않다 —
   토요일에 경기하고 수요일에 또 하는 주가 있고, A매치 휴식기로 2주가 비는 구간도 있다.
   그 사이의 날들을 감독이 어떻게 쓰느냐가 시즌 후반의 체력과 조직력을 가른다.
═══════════════════════════════════════════════════════════════ */
const DOW_KR=["일","월","화","수","목","금","토"];
/* 달력은 1월 1일에서 시작한다(G.day = 0). 리그 개막은 그로부터 PRE_DAYS 뒤 —
   그 사이가 프리시즌이고, 이때 연습경기를 치르며 팀을 만든다. */
const SEASON_OPEN=[2,1];             // 3월 1일 개막 (month는 0-based)
const CAL_START=[0,1];               // 1월 1일 — 달력·세이브의 0일차
const PRE_FRIENDLY_N=4;              // 프리시즌 연습경기 수 (격주)
const PRE_FIRST_MIN=8;               // 1월 9일 이후 첫 일요일부터
const PRE_GAP=14;                    // 2주에 한 번 — 그 사이는 훈련과 이적시장에 쓴다
/* 이적시장 — 라운드가 아니라 실제 날짜로 연다.
   겨울: 1월 1일 ~ 3월 마지막 주 / 여름: 7월 첫째 주 ~ 6주간 */
const WIN_WINTER_END=[2,31];         // 3월 31일까지 (month 0-based)
const WIN_SUMMER_START=[6,1];        // 7월 1일부터
const WIN_SUMMER_WEEKS=6;
/* 강도별 하루치 효과. 주중 하루 경기가 있는 주(일→수→일)에는 회복이 모자라도록 잡았다 —
   그래야 로테이션이 의미가 있다. 매주 한 경기만 치르면 주전도 거의 최상으로 버틴다. */
/* ⚠ 제보 — 「경기 뒤 사흘만 쉬면 풀 컨디션이라 체력 부담이 사실상 없다」.
   실측: 풀타임 소모 9.5 · 휴식 회복 4/일 → 3일이면 100 복귀.
   회복을 늦춰 로테이션과 일정 관리가 실제 판단이 되게 한다. */
const TRAIN_INT=[
  {n:"가볍게", cond:+1.3, fam:0.9, mor:+0.09, inj:0.00035, sta:0.00},
  {n:"보통",   cond:-0.6, fam:1.7, mor:+0.04, inj:0.00110, sta:0.02},
  {n:"강하게", cond:-3.6, fam:2.7, mor:-0.25, inj:0.00280, sta:0.06}];
/* ⚠ 제보(실측 포함) — 「풀타임을 뛰고 4일만 쉬어도 거의(또는 완전히) 풀컨디션이 된다.
   컨디션 회복을 소폭 하향해 달라」. 실측: 82→94 · 89→100 · 86→98 (4일 순수 휴식).
   하루 전날 회복 버그 수정 + 추가시간 보정 + 지구력/체력 반영이 겹쳐 사실상 버프가 됐다.
   휴식 회복량·경기 잔여 피로·타고난 체력 계수를 함께 조금씩 내린다 — 목표: 풀타임 후
   4일 휴식 ≈ +9 안팎 (풀컨까지는 6일쯤). */
const REST_COND=+2.15;               // 휴식일 체력 회복 (2.4 → 2.15)
const REST_FAM=-0.35;                // 쉬기만 하면 손발은 서서히 어긋난다
const FAM_MATCH=1.6;                 // 경기를 한 번 치를 때마다 손발이 맞는다
/* 📋 실전 감각 — ⚠ 제보 「전술 3개를 돌려 쓰는데 체력 안배로 훈련을 쉬면 적응도가
     계속 떨어져 시즌이 끝나면 0이 될 것 같다」.
   훈련장에서 쉬어도, 그 판으로 최근에 경기를 치렀다면 경기 자체가 반복 훈련이다.
   실전을 치른 전술은 이 기간 동안 휴식으로 깎이지 않는다. */
const FAM_USE_DAYS=21;
const FAM_USE_REST=0.25;             // 실전을 치른 판은 휴식일 손실이 1/4로 줄어든다
/* 새 감독 부임 시점의 조직력. AI 구단은 72~80에서 시작한다.
   예전 58은 famK 기준 -0.40 으로, 조직력 영향을 키운 뒤로는 전력이 같아도 매번 지는 수준이 됐다.
   프리시즌 훈련·연습경기로 개막 전에 충분히 끌어올릴 수 있으므로 출발선만 현실적으로 올린다. */
const FAM_START=68;
/* ═══════════════════════════════════════════════════════════════
   경기장 · 관중 · 입장 수입
   K리그는 요일에 따라 관중이 크게 갈린다. 주말 홈경기는 사람이 차고, 수요일 밤 경기는
   절반도 안 온다. 개막전과 더비는 평소의 1.5배가 몰리고, 강등권으로 떨어지면 시즌권자도
   집에서 본다. 그 흐름을 그대로 재현한다.
     cap = 수용 인원 · avg = 2025시즌 평균 유료 관중(기준선)
═══════════════════════════════════════════════════════════════ */
/* ── 🧑‍💼 감독진 — 2026 실제 부임 감독. 20눈금.
   tac 전술 · flex 유연성 · att 공격 · def 수비 · man 선수관리 · dev 육성 · judg 경기판단 · ovr 종합
   유저가 맡은 팀은 유저가 감독이므로 이 데이터를 쓰지 않는다.
   배선: 시즌 전술 성향(assignAITactics) · 인게임 전술 반응(aiTacticCheck) · AI 팀 선수 성장(developPlayer) */
const COACHES={
  seoul:    {n:"김기준",        tac:18,flex:17,att:17,def:16,man:17,dev:16,judg:18,ovr:17},
  ulsan:    {n:"김현우",        tac:16,flex:15,att:16,def:16,man:17,dev:16,judg:16,ovr:16},
  jeonbuk:  {n:"정태용",        tac:17,flex:17,att:16,def:17,man:17,dev:18,judg:17,ovr:17},
  daejeon:  {n:"황선호",        tac:16,flex:16,att:16,def:15,man:17,dev:16,judg:16,ovr:16},
  pohang:   {n:"박태훈",        tac:17,flex:17,att:17,def:16,man:16,dev:16,judg:17,ovr:17},
  gangwon:  {n:"정경민",        tac:17,flex:17,att:16,def:17,man:16,dev:17,judg:17,ovr:17},
  gwangju:  {n:"이정훈",        tac:15,flex:15,att:15,def:15,man:16,dev:17,judg:15,ovr:15},
  jeju:     {n:"세르지오 코스타",tac:16,flex:17,att:15,def:17,man:15,dev:14,judg:16,ovr:16},
  incheon:  {n:"윤정호",        tac:17,flex:18,att:15,def:18,man:16,dev:15,judg:17,ovr:17},
  gimcheon: {n:"주승호",        tac:15,flex:15,att:15,def:16,man:15,dev:17,judg:15,ovr:15},
  anyang:   {n:"유병준",        tac:15,flex:15,att:15,def:16,man:17,dev:16,judg:15,ovr:15},
  bucheon:  {n:"이영준",        tac:16,flex:16,att:15,def:16,man:17,dev:17,judg:16,ovr:16},
  suwon:    {n:"이정훈",        tac:19,flex:19,att:19,def:15,man:18,dev:18,judg:19,ovr:19},
  busan:    {n:"조성호",        tac:17,flex:16,att:16,def:18,man:17,dev:16,judg:17,ovr:17},
  daegu:    {n:"김병수",        tac:17,flex:17,att:17,def:15,man:16,dev:17,judg:17,ovr:17},
  seoule:   {n:"김도윤",        tac:16,flex:17,att:16,def:16,man:17,dev:16,judg:17,ovr:16},
  suwonfc:  {n:"박건호",        tac:16,flex:16,att:16,def:17,man:17,dev:16,judg:16,ovr:16},
  gyeongnam:{n:"배성호",        tac:15,flex:15,att:15,def:15,man:16,dev:16,judg:15,ovr:15},
  gimpo:    {n:"고정훈",        tac:16,flex:16,att:16,def:18,man:16,dev:17,judg:17,ovr:16},
  jeonnam:  {n:"박동현",        tac:16,flex:16,att:16,def:16,man:17,dev:16,judg:16,ovr:16},
  seongnam: {n:"전경호",        tac:15,flex:15,att:15,def:16,man:16,dev:17,judg:15,ovr:15},
  ansan:    {n:"최문석",        tac:15,flex:16,att:15,def:15,man:16,dev:17,judg:15,ovr:15},
  asan:     {n:"임관호",        tac:15,flex:15,att:14,def:17,man:16,dev:16,judg:15,ovr:15},
  cheonan:  {n:"박진호",        tac:16,flex:16,att:16,def:16,man:16,dev:17,judg:16,ovr:16},
  cheongju: {n:"루이스 퀸타",     tac:15,flex:16,att:15,def:15,man:15,dev:16,judg:15,ovr:15},
  hwaseong: {n:"차도윤",        tac:14,flex:15,att:15,def:14,man:16,dev:17,judg:14,ovr:15},
  yongin:   {n:"최윤호",        tac:13,flex:14,att:13,def:14,man:15,dev:16,judg:13,ovr:14},
  paju:     {n:"제라르 누스",   tac:13,flex:14,att:13,def:14,man:14,dev:15,judg:13,ovr:14},
  gimhae:   {n:"손현호",        tac:13,flex:14,att:13,def:14,man:15,dev:15,judg:13,ovr:14}
};
function coachOf(t){ return (t && !t.isUser && COACHES[t.id]) || null; }
/* 감독-유저 친밀도 (0~100, 기본 50) — 기자회견 발언·도발이 움직인다 */
function coachRel(tid){ if(!G.coachRel) G.coachRel={}; return G.coachRel[tid]!=null?G.coachRel[tid]:50; }
function coachRelAdd(tid, d){ if(!G.coachRel) G.coachRel={}; G.coachRel[tid]=clamp(coachRel(tid)+d,0,100); }
function coachRelLabel(v){ return v>=75?["절친한 사이","#3fb950"]:v>=60?["우호적","#56d364"]:v>=40?["중립","#d29922"]:v>=25?["냉랭","#f0883e"]:["앙숙","#f85149"]; }
/* ═══════════════════════════════════════════════════════════════
   🎩 수석코치 — 인물화
   ⚠ 요청 원문 — 「우리 이제 수석코치 시스템을 구현해보자. 말 그대로 지금 현재 있는
   수석코치를 인물화 하는거지. 수석코치 전용 능력치도 있고, 물론 이건 감독 능력치 구성과
   같아. 능력치가 좋을수록 선수 성장이나, 경기중 조언 등등에서 효과가 탁월해져. 특히
   수석코치의 조언의 정확도가 높아지겠지. 이건 능력치 비율에 따라 다르겠지? 수석코치는
   이적시장 기한에도 영향 안받고, 영입할 수 있고. 이적시장에서 스태프 탭을 만들어서
   거기서 검색하고 영입할수 있게하면 되겠네.」

   지금까지 수석코치는 이름도 얼굴도 없는 화자였다 — 조언 패널, 스태프 회의 보고,
   감독대행, 기자회견 대참까지 전부 "수석코치"라는 말뿐이었다. 이제 사람으로 만든다.

   능력치는 상대 감독 테이블(COACHES)과 정확히 같은 7종을 쓴다:
     tac 전술 · flex 유연성 · att 공격 · def 수비 · man 선수관리 · dev 육성 · judg 경기판단
   ─ 같은 어휘를 써야 감독 능력치 화면·에디터·표기가 그대로 재사용된다.

   1차(이 패치): 데이터 · 무직 코치 풀 · 이적시장 스태프 탭(검색·영입·해임) · 실명 치환 · 월 연봉
   2차(다음):   육성 보정(dev) · 조언 정확도 렌즈(judg/tac/att/def/man/flex)
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   🎩 코치진 — ⚠ 요청 원문 — 「수석코치만 되어있잖아? 이제 이걸 코치진으로 더 확대하자.
   팀마다 사단을 꾸릴 수 있는거지. 수석코치 외에도 일반 코치(공격·수비·점유율·피지컬 등),
   골키퍼 코치, 체력 코치, 그리고 유소년 코치와 분석가 까지. 팀 닥터도 만들자.
   코치들은 훈련에 배정되는거야. 내가 직접 배정할 수 있어.」 (FM의 스태프 체계를 참고)

   능력치 어휘는 두 층이다.
     · 공통 2종 — 훈련(trn) · 의욕 고취(mot). 모든 스태프가 갖는다.
     · 전용    — 직책마다 다르다. 수석코치는 기존 7종을 그대로 쓴다(호환).
   배정은 「훈련 주제 칸에 코치를 넣는」 방식이다 — 감독이 직접 칸을 채운다.
   ═══════════════════════════════════════════════════════════════ */
/* 능력치 이름표 — 어느 직책에서 쓰이든 표기는 하나로 통일한다 */
/* ═══ 🎩 FM 식 스태프 능력치 — 감독과 모든 스태프가 같은 표를 쓴다 ═══════════
   ⚠ 요청 원문 — 「이게 FM의 스탭 능력치거든? 감독, 스탭들은 다 이 능력치 한해서
      능력이 정해져」 (FM 스태프 상황판 스크린샷 첨부).

   지금까지는 직책마다 능력치 「이름 자체」가 달랐다 — 수석코치는 전술·유연성·경기판단,
   팀 닥터는 의무·재활, GK 코치는 GK 지도… 그래서 「이 사람을 저 자리에 써도 되나」를
   비교할 자가 없었다. FM 은 반대다. 모두가 같은 24개를 갖고, 직책이 그중 어디를
   보느냐만 다르다.

   ─ 배선: SA(24개)가 「진짜 데이터」이고, 옛 키(judg·med·gkc…)는 거기서 파생시켜
     함께 들고 다닌다(acSync). 옛 키를 직접 읽는 소비처가 50군데 넘으므로,
     한 번에 다 고치지 않고 seam 을 하나 두는 쪽이 안전하다. */
const SA_GRP=[
  {k:"coach", n:"코칭",        ic:"♟️", keys:["atk","dfn","fit","men","tcl","tec","yth"]},
  {k:"gk",    n:"골키핑",       ic:"🧤", keys:["dis","han","sho"]},
  {k:"mental",n:"정신적 능력",   ic:"🧠", keys:["ada","det","dsc","mgm","mot"]},
  {k:"know",  n:"정보력",       ic:"📚", keys:["jpa","jpp","jsa","tkn","neg"]},
  {k:"med",   n:"의료진",       ic:"🚑", keys:["phy","spo"]},
  {k:"data",  n:"데이터 분석",   ic:"📊", keys:["dan","dpr"]}
];
const SA_LABEL={
  atk:"공격 훈련", dfn:"수비 훈련", fit:"체력 훈련", men:"정신력 훈련",
  tcl:"전술 훈련", tec:"기술 훈련", yth:"유소년 지도",
  dis:"배급", han:"핸들링", sho:"슈팅 저지",
  ada:"적응력", det:"승부욕", dsc:"기강 유지", mgm:"인력 관리", mot:"의욕을 불어넣는 능력",
  jpa:"선수의 현재 능력 판단", jpp:"선수의 성장 가능성 판단", jsa:"스탭 능력 판단",
  tkn:"전술 이해도", neg:"협상 능력",
  phy:"치료 능력", spo:"스포츠 과학자",
  dan:"데이터 분석", dpr:"자료 전달"
};
const SA_KEYS=[]; for(const g of SA_GRP) for(const k of g.keys) SA_KEYS.push(k);
/* 🐛 예전에는 여기서 c.a 가 없으면 만들어 줬다. 그런데 이 함수는 「읽기」다 —
   시장 카드를 한 번 그리기만 해도 후보 전원에게 빈 c.a={} 가 찍혀,
   「아직 FM 표를 안 심은 사람」이라는 표식(!c.a)이 통째로 지워졌다.
   그 뒤 acSync 가 빈 표를 전부 10 으로 채우고 옛 키를 그 10 들로 다시 파생해
   후보의 실력·종합·요구 연봉이 무너졌다. 읽기는 절대 쓰지 않는다. */
function saOf(c){ return (c && c.a) ? c.a : {}; }
/* FM 표를 아직 안 심은 사람인가 — 빈 객체({})도 「안 심은」 것으로 본다 */
function acNeedSeed(c){
  if(!c) return false;
  if(!c.a) return true;
  for(const k of SA_KEYS) if(typeof c.a[k]==="number") return false;
  return true;
}
function sa(c, k){ try{ const v=saOf(c)[k]; return (typeof v==="number")?v:10; }catch(e){ return 10; } }
/* 여러 능력치의 가중 평균 — 파생과 직책 종합이 같은 자를 쓴다 */
function saMix(c, w){
  let s=0, t=0;
  for(const k in w){ s+=sa(c,k)*w[k]; t+=w[k]; }
  return t? s/t : 10;
}
/* ── 옛 키 ← FM 24개 파생 규칙 (요청 「배선도 정확하게」) ────────────────── */
const SA_DERIVE={
  tac : {tcl:0.55, tkn:0.45},                       // 전술
  flex: {ada:0.55, tkn:0.25, dsc:0.20},             // 유연성
  att : {atk:0.75, tec:0.25},                       // 공격
  def : {dfn:0.75, tcl:0.25},                       // 수비
  man : {mgm:0.50, dsc:0.28, mot:0.22},             // 선수관리
  dev : {jpp:0.45, yth:0.32, tec:0.23},             // 육성
  judg: {tkn:0.45, jpa:0.35, det:0.20},             // 경기판단
  trn : {tec:0.34, men:0.26, fit:0.22, tcl:0.18},   // 훈련
  mot : {mot:0.70, det:0.30},                       // 의욕 고취
  gkc : {sho:0.45, han:0.35, dis:0.20},             // GK 지도
  fitc: {fit:0.72, spo:0.28},                       // 체력 지도
  yth : {yth:0.60, jpp:0.40},                       // 유소년
  per : {mgm:0.45, ada:0.30, dsc:0.25},             // 성격
  ana : {dan:0.62, tkn:0.38},                       // 분석
  dat : {dpr:0.62, dan:0.38},                       // 데이터
  med : {phy:0.75, spo:0.25},                       // 의무
  reh : {spo:0.65, phy:0.35}                        // 재활
};
/* FM 24개 → 옛 키 캐시를 다시 계산한다. 스태프를 만들거나 고칠 때마다 한 번. */
function acSync(c){
  if(!c) return c;
  /* 🐛 빈 표를 만나면 10 으로 메우지 말고, 옛 키가 있으면 그걸로 먼저 심는다.
     (예전에는 여기서 전부 10 이 되어 사람의 실력이 사라졌다) */
  if(acNeedSeed(c) && !c._seeding){
    let has=false; for(const k in SA_DERIVE) if(typeof c[k]==="number"){ has=true; break; }
    if(has){ c._seeding=1; try{ acSeedFromLegacy(c); } finally { delete c._seeding; } return c; }
  }
  if(!c.a) c.a={};
  for(const k of SA_KEYS) if(typeof c.a[k]!=="number") c.a[k]=10;
  for(const k in SA_DERIVE) c[k]=clamp(Math.round(saMix(c, SA_DERIVE[k])), 1, 20);
  try{ c.ovr=acOvr(c); }catch(e){}
  return c;
}
/* ── 옛 키 → FM 24개 역변환 (구세이브·AI 감독 승격) ──────────────────────
   ⚠ 예전에는 SA_SEED 라는 별도 표를 썼는데, 파생표(SA_DERIVE)와 값이 어긋나 있었다.
     지금은 파생표를 그대로 거꾸로 타므로 그 표는 필요 없다(삭제). */
function acSeedFromLegacy(c){
  if(!c) return c;
  /* 파생표를 거꾸로 탄다 — 갖고 있는 옛 값을 그 값을 만들던 재료 칸에 그대로 심는다.
     그러면 다시 파생했을 때 옛 값이 오차 없이 되살아난다.
     ⚠ 제보 — 「역할 외 능력치는 한자리수 정도로」. 어느 옛 값도 가리키지 않는 칸,
       즉 그 사람의 직책과 무관한 칸은 한 자리로 깐다. */
  c.a=c.a||{};
  const acc={}, wsum={};
  for(const lk in SA_DERIVE){
    if(typeof c[lk]!=="number") continue;
    const src=SA_DERIVE[lk];
    for(const sk in src){ acc[sk]=(acc[sk]||0)+c[lk]*src[sk]; wsum[sk]=(wsum[sk]||0)+src[sk]; }
  }
  for(const k of SA_KEYS){
    if(typeof c.a[k]==="number") continue;
    c.a[k] = wsum[k] ? clamp(Math.round(acc[k]/wsum[k]), 1, 20)
                     : clamp(Math.round(3.5+Math.random()*5.5), 1, 9);   // 역할 밖 — 한 자리
  }
  return acSync(c);
}
const AC_LABEL={
  tac:"전술", flex:"유연성", att:"공격", def:"수비", man:"선수관리", dev:"육성", judg:"경기판단",
  trn:"훈련", mot:"의욕 고취",
  gkc:"GK 지도", fitc:"체력 지도", yth:"유소년", per:"성격",
  ana:"분석", dat:"데이터", med:"의무", reh:"재활"
};
/* 훈련 주제 칸 — 일반 코치가 들어갈 수 있는 자리 (TRAIN_FOCUS 의 k 와 같은 키를 쓴다) */
const AC_SLOT=[
  {k:"atk", n:"공격 훈련",   ic:"⚔️", key:"att"},
  {k:"def", n:"수비 훈련",   ic:"🛡️", key:"def"},
  {k:"tac", n:"전술 훈련",   ic:"📋", key:"tac"},
  {k:"set", n:"세트피스",    ic:"🎯", key:"att"},
  {k:"phy", n:"체력 훈련",   ic:"💪", key:"fitc"},
  {k:"pos", n:"포지션 훈련", ic:"🎓", key:"tac"},
  {k:"bal", n:"균형 훈련",   ic:"⚖️", key:"trn"}
];
const AC_SLOT_BY={}; for(const s of AC_SLOT) AC_SLOT_BY[s.k]=s;
/* 직책 — 정원·능력치·설명. cap 은 「기본 정원」이고 실제 정원은 훈련시설이 정한다. */
const AC_ROLE={
  ac   :{n:"수석코치",     ic:"🎩", cap:1, slot:false, wage:1.00,
         keys:["tac","flex","att","def","man","dev","judg"],
         w:{judg:0.22, tac:0.20, man:0.16, dev:0.16, flex:0.12, att:0.07, def:0.07},
         d:"감독을 보좌합니다. 경기 중 조언·경기 총평·스태프 회의·대행 지휘를 맡습니다."},
  coach:{n:"코치",         ic:"♟️", cap:4, slot:true,  wage:0.50,
         keys:["trn","tac","att","def","mot"],
         w:{trn:0.34, tac:0.20, att:0.18, def:0.18, mot:0.10},
         d:"훈련 주제 하나를 맡습니다. 그 주제로 훈련하는 날 선수들의 성장이 달라집니다."},
  gk   :{n:"골키퍼 코치",   ic:"🧤", cap:1, slot:false, wage:0.44,
         keys:["trn","gkc","mot"],
         w:{gkc:0.52, trn:0.36, mot:0.12},
         d:"골키퍼는 팀 훈련에서 빠져 이 사람과 따로 합니다 — 골키퍼의 성장은 온전히 여기에 달렸습니다."},
  fit  :{n:"체력 코치",     ic:"💪", cap:2, slot:true,  wage:0.44,
         keys:["trn","fitc","mot"],
         w:{fitc:0.52, trn:0.36, mot:0.12},
         d:"체력·회복·훈련 부상을 맡습니다. 시즌을 버티는 몸을 만듭니다."},
  youth:{n:"유소년 코치",   ic:"🌱", cap:2, slot:false, wage:0.42,
         keys:["trn","yth","mot","per"],
         w:{yth:0.44, trn:0.28, mot:0.16, per:0.12},
         d:"21세 이하를 전담합니다. 유스 아카데미 배출 품질도 이쪽에 달렸습니다."},
  anal :{n:"분석가",       ic:"📊", cap:2, slot:false, wage:0.38,
         keys:["ana","dat","judg"],
         w:{ana:0.44, dat:0.36, judg:0.20},
         d:"상대를 뜯어봅니다. 정찰 정확도와 경기 리포트의 깊이가 올라갑니다."},
  doc  :{n:"팀 닥터",       ic:"🚑", cap:1, slot:false, wage:0.46,
         keys:["med","reh","mot"],
         w:{med:0.50, reh:0.38, mot:0.12},
         d:"부상을 다룹니다. 전치 기간과 재발, 재활 속도가 달라집니다."}
};
/* 🎩 직책이 보는 FM 능력치 (요청) — FM 이 스태프 화면에서 초록으로 세워 주는 그 항목들.
   화면 강조와 스태프 생성(주 능력치를 솟게)에 쓴다. 종합(acOvr)은 지금처럼
   파생된 옛 키의 가중합을 쓴다 — 결과가 같고, 계산이 이미 검증돼 있다. */
/* 🎩 ⚠ 제보 원문 — 「지금보면 스태프 본인 역할외의 스탯이 너무 높은데? 역할 외 능력치는
   한자리수 정도로 해야지 밸런스가 맞지」. 맞는 지적이다.
   그런데 「역할 외」를 손으로 적어 두면 파생표(SA_DERIVE)와 어긋나기 쉽다 —
   수석코치의 육성이 유소년 지도에서 나오는데 유소년 지도를 역할 밖으로 치면 육성이 무너진다.
   ─ 그래서 관련도를 「계산」한다: 직책 가중(AC_ROLE.w) × 파생 가중(SA_DERIVE) 을 곱해 합치면
     그 능력치가 이 직책의 종합에 실제로 기여하는 몫이 나온다. 그 값이 0 이면 진짜 역할 밖이다. */
const _AC_REL={};
function acSaRel(role){
  role=role||"ac";
  if(_AC_REL[role]) return _AC_REL[role];
  const W=(AC_ROLE[role]||AC_ROLE.ac).w;
  const raw={}; let mx=0;
  for(const lk in W){
    const src=SA_DERIVE[lk]; if(!src) continue;
    for(const sk in src) raw[sk]=(raw[sk]||0)+W[lk]*src[sk];
  }
  for(const k in raw) if(raw[k]>mx) mx=raw[k];
  const out={};
  for(const k of SA_KEYS) out[k]= mx ? clamp((raw[k]||0)/mx, 0, 1) : 0;
  return (_AC_REL[role]=out);
}
/* 화면에서 초록으로 세울 항목 — 실제로 쓰이는 것과 정확히 같다 */
function acRoleSA(c){
  const rel=acSaRel((c&&c.role)||"ac");
  return SA_KEYS.filter(k=>rel[k]>=0.12);
}
const AC_ROLE_ORDER=["ac","coach","gk","fit","youth","anal","doc"];
function acRole(c){ return AC_ROLE[(c&&c.role)||"ac"] || AC_ROLE.ac; }
function acKeysOf(c){ return acRole(c).keys; }
/* 수석코치 전용 어휘 — 예전 코드가 그대로 쓰던 이름들(호환용) */
const AC_ATTR=[["tac","전술"],["flex","유연성"],["att","공격"],["def","수비"],
               ["man","선수관리"],["dev","육성"],["judg","경기판단"]];
const AC_KEYS=AC_ATTR.map(x=>x[0]);
/* 성향 — 어느 쪽 능력치가 솟아 있는가. 영입 화면의 필터이자 코치의 성격이다. */
const AC_TRAIT={
  dev :{n:"육성형", ic:"🌱", up:["dev","man"],   dn:["att","def"],
        d:"유망주를 키우는 데 특화되어 있습니다. 성장이 눈에 띄게 빨라집니다."},
  tac :{n:"전술형", ic:"♟️", up:["tac","flex","judg"], dn:["man","dev"],
        d:"판을 읽습니다. 경기 중 조언의 정확도가 높고 상대 대응을 먼저 짚습니다."},
  att :{n:"공격형", ic:"⚡", up:["att","judg"],  dn:["def","man"],
        d:"공격 전개와 마무리 쪽 조언이 날카롭습니다."},
  def :{n:"수비형", ic:"🛡️", up:["def","tac"],   dn:["att","dev"],
        d:"수비 조직과 라인 관리 쪽을 먼저 봅니다."},
  man :{n:"관리형", ic:"🤝", up:["man","dev"],   dn:["tac","att"],
        d:"선수단을 다룹니다. 라커룸 문제를 먼저 알아채고 먼저 보고합니다."},
  bal :{n:"균형형", ic:"⚖️", up:[],              dn:[],
        d:"뚜렷한 강점은 없지만 빠지는 항목도 없습니다."}
};
/* ⚠ 요청 — 「이적시장에 무직 스탭들 좀 다양하게 더 늘리자. 많으면 많을수록 좋지」.
   인원만 늘리면 이름만 다른 같은 사람이 스무 명 늘어난다. 이력을 함께 넓혀,
   목록을 훑을 때 「이 사람은 어디서 뭘 하다 왔구나」가 읽히게 한다. */
const AC_CAREER={
  ac   :["프로 코치 출신","전 K리그 선수","유스 아카데미 출신","해외 리그 코치 연수",
         "전 국가대표 스태프","대학 축구 감독 출신","전력분석관 출신","전 하부리그 감독",
         "전 K리그2 감독","일본 J리그 코치 출신","동남아 리그 감독 출신","전 국가대표 선수",
         "챔피언십 우승 멤버","감독 대행 경험","해설위원 출신","프로 15년 원클럽맨",
         "전 여자실업팀 감독","군팀 코치 출신","협회 지도자 강사","유럽 유학파 지도자"],
  coach:["전 K리그 선수","대학팀 코치 출신","해외 리그 코치 연수","2군 코치 출신",
         "전 국가대표 스태프","실업팀 코치 출신","고교 축구 코치 출신","세트피스 전담 코치",
         "전 K3리그 선수","기술 훈련 전문","일본 J2 코치 출신","유스 U-18 코치 출신",
         "전 프로 미드필더","수비 조직 전문","공격 패턴 전문","현역 은퇴 직후",
         "동남아 리그 코치","클럽 아카데미 15년","지도자 자격 P급","전 대학 리그 득점왕"],
  gk   :["전 K리그 골키퍼","전 국가대표 GK","유스 GK 코치 출신","해외 GK 코치 연수",
         "전 실업팀 GK","J리그 GK 코치 출신","GK 아카데미 운영","전 2군 GK 코치",
         "무실점 기록 보유자","전 대학팀 GK 코치"],
  fit  :["체육학 석사","프로팀 피지컬 코치 출신","육상 트레이너 출신","재활센터 근무 경력",
         "운동생리학 박사","국가대표팀 트레이너","군 체력단련 교관 출신","격투기 팀 트레이너",
         "전 마라톤 선수","스포츠과학원 연구원","해외 구단 피지컬 연수","GPS 데이터 관리 전문"],
  youth:["유스 아카데미 총괄 출신","고교 축구 감독 출신","U-17 대표팀 스태프","클럽 유스 20년",
         "중학교 축구부 감독 출신","U-15 대표팀 코치","유소년 스카우트 겸직","축구교실 운영",
         "전 유스 출신 프로 선수","해외 아카데미 연수","전 대학 감독","유소년 심리 상담 자격"],
  anal :["전력분석관 출신","스포츠 데이터 회사 근무","해외 구단 분석팀 연수","통계학 전공",
         "영상 분석 전문","전 프로 선수 겸 분석관","축구 데이터 스타트업 출신","컴퓨터공학 전공",
         "리그 공식 기록원 출신","해외 스카우팅 네트워크 경력","세트피스 분석 전문","AI 분석 도구 개발 참여"],
  doc  :["정형외과 전문의","스포츠의학 전문의","프로팀 주치의 경력","재활의학과 출신",
         "대학병원 근무 경력","국가대표팀 의무팀 출신","물리치료사 자격","한방 스포츠의학",
         "무릎 수술 전문","근골격 재활 전문","해외 스포츠병원 연수","군병원 재활센터 출신"]
};
/* 종합 — 조언과 육성에 실제로 쓰이는 비중 그대로 잡는다(감독 ovr 과 같은 눈금 12~19) */
function acOvr(c){
  if(!c) return 0;
  const W=acRole(c).w;
  let v=0, tw=0;
  for(const k in W){ const x=(typeof c[k]==="number")?c[k]:12; v+=x*W[k]; tw+=W[k]; }
  return Math.round(tw>0 ? v/tw : 0);
}
/* 요구 연봉(억/년) — 종합이 한 칸 오를 때마다 가파르게 뛴다. 12는 2억, 19는 8억쯤. */
/* ⚠ 능력치 하향 뒤 요구 연봉이 0.5억까지 주저앉아 「깎을 것도 없는」 협상이 됐다.
   기준점을 6으로 내리고 기울기를 키워, 평범(12) 1억대 · 우수(16) 2억대 · 특급(18) 3억대가 되게 한다. */
function acWage(c){
  const o=acOvr(c);
  let w=(0.8 + Math.pow(Math.max(0,o-6), 2)*0.045) * (acRole(c).wage||1);
  if(c.role==="ac" && (c.trait==="tac"||c.trait==="dev")) w*=1.08;   // 감독들이 제일 탐내는 두 갈래
  if((c.age||45)>=56) w*=0.90;                        // 노장은 조금 눅다
  /* 🎩 요청 — 「자신의 구단에서 은퇴한 선수일 경우 연봉 감소, 자신의 구단의 유스일 경우 연봉 감소」.
     정든 집으로 돌아오는 길은 싸다 — 둘 다면 겹쳐서 더 싸다. */
  try{
    if(c.exTid && c.exTid===G.userTeamId) w*=0.78;
    if(c.exYouthTid && c.exYouthTid===G.userTeamId) w*=0.85;
  }catch(e){}
  return Math.round(Math.max(0.3, w)*10)/10;
}
/* 등급 — 시장 평균이 12다. 「우수」가 상위 5%, 「특급」이 1% 아래가 되도록 잡는다. */
function acGrade(o){ return o>=17?["특급","#f0883e"]:o>=15?["우수","#3fb950"]:o>=13?["준수","#56d364"]:o>=11?["평범","#d29922"]:["미흡","#f85149"]; }
/* 스태프 한 명 생성. role 을 생략하면 수석코치(예전 호출부 호환).
   tier 는 대략적인 실력 중심(10~18). */
function acMake(role, tier, traitK){
  /* ⚠ 예전 호출부 acMake(tier) 를 그대로 받아 준다 */
  if(typeof role==="number"){ traitK=tier; tier=role; role="ac"; }
  const R=AC_ROLE[role]||AC_ROLE.ac;
  const T=clamp(tier||13, 9, 19);
  const isAc=(role||"ac")==="ac";
  const tk = isAc ? (traitK || pick(["dev","tac","att","def","man","bal","bal"])) : (traitK||null);
  const TR = isAc ? (AC_TRAIT[tk]||AC_TRAIT.bal) : {up:[],dn:[]};
  const c={ id:"ac"+Math.floor(Math.random()*1e9).toString(36)+Date.now().toString(36).slice(-4),
            uid:nextStaffUid(),
            role:role||"ac", n:(function(){
              /* 🐛 한 구단 안에 같은 이름이 둘 나왔다(GK 코치 이용우 · 팀 닥터 이용우).
                 이미 쓰고 있는 이름은 피한다 — 감독·코치진·시장 후보를 함께 본다. */
              let used=new Set();
              try{ for(const q of crew()) if(q&&q.n) used.add(q.n); }catch(e){}
              /* 🐛 배열 이름을 틀렸었다 — 시장 후보는 G.staff.pool 이 아니라 G.acPool 이다.
                 그래서 시장 안에서만 같은 이름이 몇 명씩 겹쳤다(120명으로 늘리며 눈에 띄었다). */
              try{ for(const q of (G.acPool||[])) if(q&&q.n) used.add(q.n); }catch(e){}
              try{ for(const k in COACHES) if(COACHES[k]&&COACHES[k].n) used.add(COACHES[k].n); }catch(e){}
              let nm=genName();
              for(let i=0;i<40 && used.has(nm);i++) nm=genName();
              return nm;
            })(), age:32+Math.floor(Math.random()*29),
            trait:tk, career:pick(AC_CAREER[role]||AC_CAREER.ac) };
  /* 🎩 FM 24개를 굴린다 (요청) — 직책이 보는 항목은 T 언저리로 솟고, 나머지는 낮게 깔린다.
     그래야 「이 사람은 GK 코치로는 쓸 만한데 일반 코치로는 아니다」가 화면에서 읽힌다. */
  /* 🎩 역할 밖 능력치는 한 자리로 깐다 (제보) — 팀 닥터가 전술 이해도 14 를 갖고 있을 이유가 없다.
     대신 그만큼 종합이 내려가므로, 관련 능력치를 밀어 올려 tier 에 다시 맞춘다(아래 보정). */
  const rel=acSaRel(role||"ac");
  c.a={};
  for(const k of SA_KEYS){
    const r=rel[k];
    /* 관련도 0 → 한 자리, 관련도 1(핵심) → tier. 그 사이는 완만하게 이어진다.
       ⚠ 예전 곡선은 3.4 폭밖에 안 벌어져 「겨우 관련된 칸」도 14 를 찍었다(제보). */
    let v = (r<=0.02) ? (3.5 + Math.random()*5.5)                       // 역할 밖 — 3~9
                      : (9 + (T-9)*Math.pow(r, 0.45) + (Math.random()*3.0-1.5));
    /* 성향(수석코치) — 옛 키로 표현된 성향을 그 키의 파생 재료로 옮겨 준다 */
    if(isAc && r>0.02){
      const bump=(list, d)=>{ for(const ok of list){ const src=SA_DERIVE[ok]; if(src && src[k]!=null) v+=d; } };
      bump(TR.up||[],  1.5+Math.random()*1.2);
      bump(TR.dn||[], -1.2-Math.random()*1.0);
    }
    c.a[k]=clamp(Math.round(v), 1, r<=0.02?9:20);
  }
  /* 전문직은 「주 능력치가 솟은 사람」이 시장에 나온다 — 평평하면 뽑을 이유가 없다 */
  if(!isAc){
    const main=SA_KEYS.slice().sort((a,b)=>rel[b]-rel[a])[0];
    if(main) c.a[main]=clamp(c.a[main]+Math.round(0.8+Math.random()*1.4), 1, 20);
  }
  /* 🎚️ 종합 보정 — 역할 밖을 낮춘 만큼 관련 능력치를 밀어 올린다. tier 가 곧 종합이 되게 */
  for(let it=0; it<16; it++){
    acSync(c);
    const d=T-acOvr(c);
    if(Math.abs(d)<0.5) break;
    const st=d>0?1:-1;
    let moved=false;
    for(const k of SA_KEYS){ if(rel[k]<0.25) continue;      // 곁가지까지 밀면 표가 다시 평평해진다
      const nv=clamp(c.a[k]+st, 1, 20); if(nv!==c.a[k]){ c.a[k]=nv; moved=true; } }
    if(!moved) break;
  }
  acSync(c);
  /* 나이가 곧 경험이다 — 젊은 스태프는 판단이 덜 여물고, 노장은 몸 대신 눈을 갖고 있다 */
  /* 🎩 나이는 이제 FM 능력치 쪽을 민다 — 파생은 acSync 가 다시 잡는다 (요청) */
  if(c.age<=38){ c.a.jpa=clamp(c.a.jpa-1,1,20); c.a.tkn=clamp(c.a.tkn-1,1,20);
                 c.a.jpp=clamp(c.a.jpp+1,1,20); c.a.fit=clamp(c.a.fit+1,1,20); }
  else if(c.age>=55){ c.a.jpa=clamp(c.a.jpa+1,1,20); c.a.tkn=clamp(c.a.tkn+1,1,20);
                      c.a.jpp=clamp(c.a.jpp-1,1,20); c.a.fit=clamp(c.a.fit-1,1,20); }
  /* 🐛 나이 보정이 역할 밖 칸을 9 위로 밀어 올리는 일이 없게 (제보 — 한 자리 유지) */
  for(const k of SA_KEYS) if(rel[k]<=0.02) c.a[k]=Math.min(c.a[k], 9);
  acSync(c);
  c.ovr=acOvr(c);
  c.wage=acWage(c);
  return c;
}
/* ── 우리 코치진 ────────────────────────────────────────────────
   수석코치를 포함해 한 배열에 담는다. acOf() 는 그중 수석코치를 집어 오므로
   지금까지 acOf() 를 쓰던 코드는 한 줄도 고칠 필요가 없다. */
function crew(){
  try{
    if(!G.staff) G.staff={delegatePre:false, handled:{}, log:[]};
    if(!Array.isArray(G.staff.crew)) G.staff.crew=[];
    return G.staff.crew;
  }catch(e){ return []; }
}
function crewOf(role){ return crew().filter(c=>c && c.role===role); }
function crewById(id){ return crew().find(c=>c && c.id===id) || null; }
/* 정원 — ⚠ 선택: 훈련시설 등급 연동. 시설 투자가 코치진 규모로 이어진다.
   수석코치는 이 정원과 별개다(항상 한 자리). */
function crewCap(t){ return 4 + Math.floor(clamp(trainLv(t||userTeam()),1,FAC_MAX)/2); }
function crewCount(){ return crew().filter(c=>c && c.role!=="ac").length; }
/* 직책별 정원 — 골키퍼 코치를 셋씩 두는 팀은 없다 */
function roleFull(role){
  const R=AC_ROLE[role]; if(!R) return true;
  return crewOf(role).length >= R.cap;
}
/* 우리 팀 수석코치 (없으면 null = 공석) */
function acOf(){ try{ return crewOf("ac")[0] || null; }catch(e){ return null; } }
/* 훈련 주제 칸에 들어가 있는 사람 — 배정은 c.assign 에 주제 키로 적어 둔다 */
function slotStaff(k){ return crew().filter(c=>c && c.assign===k && acRole(c).slot); }
/* 칸에 넣는다. 한 사람이 두 칸을 채울 수는 없으므로 이전 칸에서 자동으로 빠진다. */
function acAssign(id, k){
  const c=crewById(id); if(!c) return;
  if(!acRole(c).slot) return;                       // 전문직은 배정 없이 상시 적용된다
  c.assign = (k && AC_SLOT_BY[k]) ? k : null;
  try{ saveGame(); }catch(e){}
  try{ ftTab="train"; }catch(e){}
  /* ⚠ 제보 — 「코치 배정하거나 빼면 화면이 이적시장으로 이동한다」.
     배정판을 일정·훈련 화면으로 옮겨 놓고 새로 그리는 대상은 이적시장으로 두고 있었다.
     배정판은 이제 두 곳에서 부를 수 있으므로 「지금 보고 있던 화면」을 다시 그린다. */
  acBack();
}
function acUnassign(id){ acAssign(id, null); }
/* 스태프 조작 뒤 돌아갈 곳 — 지금 화면. 엉뚱한 데서 불렀으면 이적시장으로 보낸다. */
function acBack(){
  try{
    const v=(typeof VIEW==="string" && VIEW) ? VIEW : "transfer";
    show((v==="fixtures"||v==="transfer"||v==="editor"||v==="staff") ? v : "transfer");
  }catch(e){ try{ show("transfer"); }catch(e2){} }
}
/* 이름 한 개 — 문장 안에서 "수석코치" 자리에 그대로 끼운다.
   공석이면 예전 그대로 "수석코치"라고만 부른다(문장이 깨지지 않게). */
function acName(){ const c=acOf(); return c ? c.n : "수석코치"; }
function acTitle(){ const c=acOf(); return c ? (c.n+" 수석코치") : "수석코치"; }
/* 기존 세이브·새 게임 마이그레이션 — 구단 명성에 맞춘 평범한 코치를 하나 붙여 준다.
   ⚠ 없던 사람이 갑자기 생기는 게 아니라, 「원래 있던 그 수석코치」에게 이름을 주는 것이다.
   그래서 지금보다 나빠지지 않도록 tier 를 팀 수준에 맞춰 잡는다. */
/* 기본 코치진의 눈금 — 효과 1.00 기준(13) 언저리에 두되, 시장 하향에 맞춰 한 칸 내린다.
   명문(팬 많은 1부)이라야 13을 넘는다. */
function acBaseTier(t){
  try{ if(t) return (t.div===1?11.9:10.8) + clamp(((t.fans||20)-20)/30, -0.9, 1.4); }catch(e){}
  return 11.4;
}
function acDefaultFor(t, role){
  const c=acMake(role||"ac", acBaseTier(t));
  c.ct=2; c.since=(G&&G.season)||2026; c.wage=acWage(c);
  c.hired=true;
  return c;
}
/* 무직 코치 풀 — 이적시장 기한과 무관하게 항상 살아 있다 */
function acPool(){
  if(!Array.isArray(G.acPool) || !G.acPool.length) acPoolFill();
  return G.acPool;
}
/* 시장에 나오는 직책 비율 — 일반 코치가 제일 흔하고, 팀 닥터·GK 코치는 드물다 */
const AC_POOL_MIX=["ac","ac","coach","coach","coach","coach","coach","coach",
                   "gk","gk","fit","fit","fit","youth","youth","anal","anal","doc","doc"];
/* ⚠ 요청 — 「무직 코치들을 더 빵빵하게 늘리자」.
   직책이 일곱이라 26명으로는 한 직책에 두세 명씩밖에 안 걸려 고를 게 없었다.
   ─ 총원을 크게 늘리고, 직책마다 최소 인원을 보장한다. */
/* ⚠ 요청 — 「무직 스탭들 좀 다양하게 더 늘리자. 많으면 많을수록 좋지」.
   68 → 120. 직책별 최소 인원도 함께 올려, 어느 자리를 찾아도 고를 게 남아 있게 한다.
   ⚠ 능력치 분포(acTierRoll)는 건드리지 않는다 — 인원이 늘어도 특급 비율은 그대로다. */
const AC_POOL_N=120;
const AC_POOL_MIN={ac:11, coach:28, gk:11, fit:14, youth:13, anal:13, doc:11};
/* ⚠ 요청 원문 — 「코치진들의 능력치를 대체적으로 낮추자. 특출난 코치는 소수여야지.」
   예전 분포는 평균 14.2에 「우수 이상」이 넷 중 하나였다 — 시장을 훑기만 해도 특급이 잡혔다.
   그러면 특급이라는 말이 의미를 잃는다(유스 배출 하향 때와 같은 이유다).
   ─ 상단을 얇게 깎고 하단을 두껍게 깐다: 특급은 시장에 두 해에 한 명 나올까 말까. */
function acTierRoll(){
  const r=Math.random();
  return r<0.015 ? 17.2 : r<0.07 ? 15.4 : r<0.24 ? 13.6 : r<0.58 ? 11.9 : 10.0;
}
function acPoolTopUp(P){
  while(P.length<AC_POOL_N) P.push(acMake(pick(AC_POOL_MIX), acTierRoll()));
  for(const rk of AC_ROLE_ORDER){
    const need=AC_POOL_MIN[rk]||3;
    let have=P.filter(c=>c.role===rk).length;
    while(have<need){ P.push(acMake(rk, acTierRoll())); have++; }
  }
  return P;
}
function acPoolFill(){
  G.acPool=[];
  acPoolTopUp(G.acPool);
  G.acPoolS=(G&&G.season)||2026;
}
/* 시즌이 바뀌면 시장이 돈다 — 절반쯤 갈아 끼운다 */
function acPoolRoll(){
  const P=acPool();
  for(let i=P.length-1;i>=0;i--) if(Math.random()<0.40) P.splice(i,1);
  acPoolTopUp(P);
  G.acPoolS=(G&&G.season)||2026;
}
/* ── 추정치 ────────────────────────────────────────────────────
   ⚠ 선택 — 「추정치 → 영입 후 확정」.
   영입 전에는 정확한 능력치를 모른다. 코치마다·항목마다 고정된 오차를 씌워 보여 준다.
   난수를 그때그때 뽑으면 화면을 다시 그릴 때마다 값이 흔들리므로 id 해시로 고정한다.
   스카우팅 등급이 높으면 오차가 줄어든다 — 사람 보는 눈도 스카우트 망의 일이다. */
/* 추정 오차 — ⚠ 6~20 눈금에서 ±3 은 너무 넓다. 평범한 코치(13)가 「특급(16)」으로 보여서
   시장이 온통 특급처럼 읽혔다. 최대 ±2 로 좁힌다. */
function acErrMax(){ try{ return clamp(2 - Math.floor(((scoutLv()||1)-1)/3), 1, 2); }catch(e){ return 2; } }
function acEst(c, k){
  if(!c) return 0;
  if(c.hired) return c[k];                       // 우리 사람이 되면 정확히 보인다
  const h=uidHash(String(c.id)+"|"+k);
  const e=acErrMax();
  const off=(h%(e*2+1))-e;
  return clamp(c[k]+off, 6, 20);
}
function acEstOvr(c){
  if(!c) return 0;
  if(c.hired) return acOvr(c);
  const o={role:c.role}; for(const k of acKeysOf(c)) o[k]=acEst(c,k);
  return acOvr(o);
}
/* ── 능력치가 실제로 하는 일 ────────────────────────────────────
   ⚠ 요청 원문 — 「능력치가 좋을수록 선수 성장이나, 경기중 조언 등등에서 효과가 탁월해져.
   특히 수석코치의 조언의 정확도가 높아지겠지. 이건 능력치 비율에 따라 다르겠지?」
   ─ 그래서 항목마다 담당이 다르다. 하나도 놀지 않게 배선한다.
       dev  → 선수 성장 (developPlayer)
       judg → 조언의 정확도 · 조언 줄 수 · 지표 노출 · 오조언
       tac  → 전술/상대 대응 계열 조언
       att  → 공격 분석 계열 조언
       def  → 수비·실점 위험 계열 조언
       man  → 체력·카드·교체 조언 + 라커룸 불만 사전 차단
       flex → 상대 벤치가 움직였을 때의 반응
   공석이면 전부 「없는 것보다 조금 나쁜」 값으로 떨어진다. */
/* ⚠ 효과의 0점. 시장 평균을 12로 내렸으니 기준선도 12다 —
   그래야 「기본 코치진 = 예전과 같음(1.00)」이 유지되고, 좋은 사람은 순수한 덤이 된다. */
const AC_BASE=12;
function acAttr(k, dflt){ const c=acOf(); return c ? (c[k]|0) : (dflt==null?10:dflt); }
/* 🌱 육성 — 13이 지금까지의 기본값(보정 없음)이다. 18이면 +15%, 9면 −13%. */
function acDevK(){
  const c=acOf();
  if(!c) return 0.94;                                   // 공석 — 훈련을 지휘할 사람이 없다
  return clamp(1 + (c.dev-AC_BASE)*0.030, 0.86, 1.20);
}
/* 🤝 선수관리 — 불만이 자라는 속도. 좋은 코치는 라커룸에서 먼저 끈다. */
function acManK(){
  const c=acOf();
  if(!c) return 1.5;                                    // 공석 — 아무도 안 듣고 있다
  return clamp(1.00 - (c.man-AC_BASE)*0.085, 0.55, 1.5);
}
/* ═══ 🎩 직책별 효과 ═══════════════════════════════════════════
   ⚠ 요청 — 「모든 역할에 대해 역할과 효과를 붙이자」.
   눈금은 하나로 통일한다: **종합 13 = 지금까지와 같음(1.00)**. 그래야 기본 코치진(12~15)이
   붙어 있는 상태가 예전 밸런스와 어긋나지 않고, 좋은 사람을 뽑을수록 위로만 올라간다.
   같은 직책을 둘 두면 두 번째 사람은 절반만 얹힌다(눈이 하나 더 있는 값). */
function acLvOf(role){
  const L=crewOf(role); if(!L.length) return null;
  const o=L.map(acOvr).sort((a,b)=>b-a);
  return o[0] + (o.length>1 ? Math.max(0,(o[1]-9))*0.12 : 0);
}
/* per = 종합 한 칸당 변화폭 · none = 그 자리가 비었을 때의 값 */
function acK(role, per, lo, hi, none){
  const L=acLvOf(role);
  if(L==null) return none;
  return clamp(1+(L-AC_BASE)*per, lo, hi);
}
/* ♟️ 훈련 주제 담당 코치 — 그 주제로 훈련하는 날에만 붙는다 */
function focCoachK(k){
  if(!k || !AC_SLOT_BY[k]) return 1.00;                 // 개인 과제만 있는 날 등 — 담당 개념이 없다
  const S=slotStaff(k);
  if(!S.length) return 0.90;                            // 빈 칸 — 감독 혼자 본다
  const o=S.map(acOvr).sort((a,b)=>b-a);
  const v=o[0] + (o.length>1 ? Math.max(0,(o[1]-9))*0.12 : 0);
  return clamp(1+(v-AC_BASE)*0.026, 0.88, 1.22);
}
function acGkK(){     return acK("gk",    0.030, 0.88, 1.20, 0.92); }   // 🧤 골키퍼 성장
function acYouthK(){  return acK("youth", 0.030, 0.94, 1.22, 0.95); }   // 🌱 21세 이하 성장
function acYouthPot(){                                                   // 🌱 유스 배출 잠재력 보정
  const L=acLvOf("youth"); if(L==null) return 0;
  return clamp((L-AC_BASE)*0.55, -2.5, 4.0);                             // 잠재력 점수에 직접 얹는다
}
function acFitRecK(){ return acK("fit",   0.018, 0.92, 1.15, 0.96); }   // 💪 컨디션 회복
function acFitInjK(){ return acK("fit",  -0.024, 0.72, 1.12, 1.10); }   // 💪 훈련 부상 위험(낮을수록 좋다)
function acDocInjK(){ return acK("doc",  -0.028, 0.70, 1.10, 1.08); }   // 🚑 전치 기간
function acDocRecK(){ return acK("doc",   0.024, 0.92, 1.22, 0.94); }   // 🚑 재활 속도
function acDocRiskK(){return acK("doc",  -0.016, 0.82, 1.06, 1.05); }   // 🚑 부상 확률
function acAnaLv(){   const L=acLvOf("anal"); return L==null?0:L; }     // 📊 분석 수준(0=없음)
/* 우리 선수인가 — 회복·부상 보정은 우리 팀에만 붙는다. 하루 단위로 캐시한다. */
let _ourSet=null, _ourDay=-1, _ourN=-1;
function isOurPlayer(p){
  try{
    const t=userTeam(); if(!t||!p) return false;
    if(_ourDay!==(G.day||0) || _ourN!==t.players.length || !_ourSet){
      _ourSet=new Set(t.players); _ourDay=(G.day||0); _ourN=t.players.length;
    }
    return _ourSet.has(p);
  }catch(e){ return false; }
}
/* 감독 미니 팝업 — 선수 팝업처럼 작은 상자: 프로필 / 감독에 대한 발언 */
function showCoachPopup(e, tid){
  if(e){ e.preventDefault&&e.preventDefault(); e.stopPropagation&&e.stopPropagation(); }
  const t=G.teams[tid], c=COACHES[tid]; if(!t||!c) return false;
  const el=document.getElementById("pInfo"); if(!el) return false;
  el.classList.remove("hidden");
  const zoom=getFontScale()/100;
  const vw=((typeof window!=="undefined"&&window.innerWidth)||1200)/zoom, vh=((typeof window!=="undefined"&&window.innerHeight)||800)/zoom;
  const px=((e&&e.clientX)||40)/zoom, py=((e&&e.clientY)||40)/zoom;
  el.style.left="0px"; el.style.top="0px";   // 선수 메뉴와 같은 제보(밑 짤림) — 그린 뒤 실측 보정
  const rv=coachRel(tid), rl=coachRelLabel(rv);
  const lean=c.att-c.def;
  const style=lean>=2?"공격 축구":lean<=-2?"실리 축구":"균형 축구";
  el.innerHTML=`<div class="pmHead">🧑‍💼 ${c.n} <span class="small">— ${t.short} 감독</span></div>
    <div class="pInfoBody">
      종합 <b>${c.ovr}</b>/20 · ${style}<br>
      <span class="small">나와의 관계 · <b style="color:${rl[1]}">${rl[0]} (${Math.round(rv)})</b></span>
      <button class="mini" style="display:block;width:100%;margin-top:8px" onclick="closePlayerInfoPopup();openCoachProfile('${tid}')">📋 프로필 <span class="small">— 능력치·스타일</span></button>
      ${G.jobless?"":`<button class="mini" style="display:block;width:100%;margin-top:5px" onclick="closePlayerInfoPopup();openCoachTalk('${tid}')">🎙️ 감독에 대한 발언 <span class="small">— 기자와 인터뷰</span></button>`}
    </div>`;
  const rr=el.getBoundingClientRect?el.getBoundingClientRect():null;
  const mw=((rr&&rr.width)||260)/zoom, mh=((rr&&rr.height)||230)/zoom;
  el.style.left=Math.max(4,Math.min(px,vw-mw-6))+"px";
  el.style.top =Math.max(4,Math.min(py,vh-mh-6))+"px";
  return false;
}
/* 🎙️ 감독에 대한 발언 — 기자가 달려와 상대 감독 이야기를 묻는다. 발언은 관계·언론·여론을 움직인다 */
/* 🎙️ 감독에 대한 발언 — 경기/인터뷰 메뉴에서 「인터뷰」로 진행한다 (팝업이 아니라 화면) */
let COACH_IV=null;
function openCoachTalk(tid){
  const t=G.teams[tid], c=COACHES[tid], ut=userTeam(); if(!t||!c||!ut) return;
  if(!G.coachSayAt) G.coachSayAt={};
  const j0=pick(journalists());
  if((G.day||0)-(G.coachSayAt[tid]!=null?G.coachSayAt[tid]:-99) < 14){
    COACH_IV={tid, j:j0, done:{txt:`"감독님, ${c.n} 감독 이야기는 지난번에 충분히 들었습니다.<br>새로운 얘깃거리가 생기면 그때 다시 여쭙죠."`, fx:""}};
  } else {
    COACH_IV={tid, j:j0, done:null};
  }
  show("match"); try{ window.scrollTo(0,0); }catch(e){}
}
function closeCoachTalk(){ COACH_IV=null; show("match"); }
const COACH_SAY_OPTS=[
  ["respect","🙏","존경하는 지도자입니다. 늘 배우는 마음으로 상대합니다."],
  ["friends","🤝","개인적으로도 잘 지내는 사이입니다. 다만 90분 동안은 적이죠."],
  ["rival","⚔️","제 라이벌입니다. 이런 상대와 겨루는 게 감독의 낙이죠."],
  ["neutral","😐","특별한 생각 없습니다. 우리는 우리 축구를 할 뿐입니다."],
  ["dislike","😒","솔직히 좋아하지 않습니다. 이유는 본인이 잘 알 겁니다."],
  ["boring","🥱","그 감독 축구는 참 재미가 없습니다. 보는 분들껜 죄송한 말이지만."],
  ["taunt","🔥","그의 시대는 갔다고 봅니다. 곧 밑천이 드러날 겁니다."],
  ["salary","💸","그 감독님은… 연봉이 얼마나 되죠? 그게 늘 궁금했습니다."],
  ["salaryScorn","💰","연봉 얼마나 받는지 참 궁금합니다. 저런 축구가 그런 억대 연봉이라뇨."]
];
/* 경기/인터뷰 화면에 그려지는 인터뷰 본문 */
function coachTalkView(){
  const iv=COACH_IV; if(!iv) return "";
  const t=G.teams[iv.tid], c=COACHES[iv.tid]; if(!t||!c){ COACH_IV=null; return ""; }
  const j=iv.j||{n:"기자",o:"매체"};
  if(iv.done){
    return `<h2>🎙️ 인터뷰 — ${c.n} 감독</h2>
    <div class="card">
      <p class="small" style="color:var(--sub)">${j.n} · ${j.o}</p>
      <p style="margin:8px 0 4px">${iv.done.txt}</p>
      ${iv.done.fx||""}
      <button class="mini" style="margin-top:10px" onclick="closeCoachTalk()">← 돌아가기</button>
    </div>`;
  }
  const rv=coachRel(iv.tid), rl=coachRelLabel(rv);
  const opts=COACH_SAY_OPTS.map(o=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:10px"
    onclick="coachSay('${iv.tid}','${o[0]}')">${o[1]} <b>「${o[2]}」</b></button>`).join("");
  return `<h2>🎙️ 인터뷰 — ${c.n} 감독 <span class="small" style="color:var(--sub)">(${t.short})</span></h2>
  <div class="card">
    <p class="small" style="color:var(--sub)">${j.n} · ${j.o}</p>
    <p style="margin:8px 0 10px">"감독님, 요즘 <b>${c.n}</b> 감독 이야기가 많습니다. 한 말씀 부탁드립니다."</p>
    <p class="small" style="margin-bottom:10px">현재 관계: <b style="color:${rl[1]}">${rl[0]} (${Math.round(rv)})</b>
      · 도발적인 발언은 <b>다음 맞대결 결과로 정산</b>됩니다.</p>
    ${opts}
    <button class="mini" style="margin-top:6px" onclick="closeCoachTalk()">🤐 말을 아낀다</button>
  </div>`;
}
function coachSay(tid, kind){
  try{ if(typeof hideConfirm==="function") hideConfirm(); }catch(e){}
  const t=G.teams[tid], c=COACHES[tid], ut=userTeam(); if(!t||!c||!ut) return;
  (G.coachSayAt=G.coachSayAt||{})[tid]=G.day||0;
  const r0=Math.round(coachRel(tid));
  try{ coachTalkFx(kind, {opp:t}, null); }catch(e){}
  const r1=Math.round(coachRel(tid));
  /* 기자는 자극적일수록 좋아한다 — 언론 관계 */
  const PR={respect:1, friends:1, rival:2, neutral:-1, dislike:2, boring:2, taunt:3, salary:3, salaryScorn:4};
  G.press.rel=clamp(G.press.rel+(PR[kind]||0),0,100);
  const RE={
    respect:`"훈훈하네요. 팬들이 좋아할 기사입니다."`,
    friends:`"감독들의 우정이라… 주말 피처 기사감이네요. (웃음)"`,
    rival:`"라이벌 선언! 제목이 벌써 나왔습니다 — 고맙습니다, 감독님."`,
    neutral:`"…이걸로는 기사가 안 됩니다만. 알겠습니다."`,
    dislike:`"오, 이건 물어보길 잘했네요. 내일 아침 1면입니다."`,
    boring:`"스타일 혹평이라… 댓글창이 뜨겁겠는데요. 잘 쓰겠습니다."`,
    taunt:`"이, 이거 그대로 내보내도 됩니까? …특종 감사합니다!"`,
    salary:`"…연봉이요? (당황) 그건 저희도 모르는데… 감독님, 이건 좀 무례한 질문 아닙니까? 그래도 씁니다."`,
    salaryScorn:`"…감독님, 지금 그 말씀 취소하실 기회를 드리겠습니다. (침묵) 안 하시는군요. 내일 아침 헤드라인은 정해졌습니다."`};
  const d=r1-r0;
  const said=(COACH_SAY_OPTS.find(o=>o[0]===kind)||[,"","..."])[2];
  const fx=`<div class="msg ${d>0?"good":d<0?"warn":"info"}" style="margin-top:10px">
    ${c.n} 감독과의 관계 <b>${r0}</b> → <b>${r1}</b>${(PR[kind]||0)?` · 언론 관계 <b>${PR[kind]>0?"+":""}${PR[kind]}</b>`:""}
    ${kind==="taunt"?`<br><span class="small">🔥 다음 ${t.short}전 결과에 따라 이 발언이 그대로 돌아옵니다.</span>`:""}</div>`;
  if(COACH_IV && COACH_IV.tid===tid){
    COACH_IV.done={txt:`<b style="color:var(--sub)">감독:</b> "${said}"<br><br>${RE[kind]||""}`, fx};
    saveGame(); show("match"); try{ window.scrollTo(0,0); }catch(e){}
    return;
  }
  saveGame();
}
/* 감독 프로필 — 타구단 스쿼드에서 감독 이름을 누르면 열린다 (FM식 능력치 카드) */
function openCoachProfile(tid){
  const t=G.teams[tid], c=COACHES[tid]; if(!t||!c) return;
  /* 🎩 감독도 스태프와 같은 FM 24개 표를 쓴다 (요청) */
  try{ if(acNeedSeed(c)) acSeedFromLegacy(c); }catch(e){}
  const bar=(v)=>{
    const col=v>=17?"#3fb950":v>=15?"#56d364":v>=13?"#d29922":"#f0883e";
    return `<span style="display:inline-block;width:110px;height:9px;background:#1a2027;border-radius:5px;vertical-align:middle;margin-right:7px"><span style="display:block;width:${v*5}%;height:100%;background:${col};border-radius:5px"></span></span><b style="color:${col}">${v}</b>`;
  };
  const row=(k,v)=>`<tr><td style="padding:3px 10px 3px 0;color:var(--sub)">${k}</td><td>${bar(v)}</td></tr>`;
  const lean=c.att-c.def;
  const style = lean>=3?"닥공 — 라인을 올려 두들기는 공격 축구"
    : lean>=2?"공격적 — 무게중심이 앞에 있다"
    : lean<=-2?"실리적 — 단단히 내려서서 역습을 노린다"
    : "균형 — 상대에 맞춰 무게중심을 옮긴다";
  const bench = c.flex>=18?"매우 빠름 — 흐름이 기울면 곧바로 움직인다"
    : c.flex>=16?"빠름 — 벤치가 부지런하다"
    : c.flex>=14?"보통":"느림 — 한 수를 오래 믿는 편";
  const rv=coachRel(tid), rl=coachRelLabel(rv);
  const ut=userTeam();
  showConfirm(`<b style="font-size:17px">🧑‍💼 ${c.n}</b> <span class="small">— ${t.name} 감독</span>

${(function(){ try{ return saGrid(Object.assign({}, c, {role:"ac", hired:true})); }catch(e){
    return `<table style="border-collapse:collapse">${row("전술",c.tac)}${row("유연성",c.flex)}${row("공격",c.att)}${row("수비",c.def)}${row("선수 관리",c.man)}${row("육성",c.dev)}${row("경기 판단",c.judg)}</table>`; } })()}
<span class="small">종합 <b style="color:${acGrade(c.ovr||12)[1]}">${c.ovr}</b>/20</span>
<span class="small">경기 스타일 · <b>${style}</b>
벤치 반응 · <b>${bench}</b>${ut&&!t.isUser?`
나와의 관계 · <b style="color:${rl[1]}">${rl[0]} (${Math.round(rv)})</b>`:""}</span>`,
    ()=>{}, {okLabel:"닫기", cancelLabel:""});
}
const STADIUM={
  seoul:    {n:"서울월드컵경기장",     cap:66704, avg:22500},
  jeonbuk:  {n:"전주월드컵경기장",     cap:42477, avg:14200},
  ulsan:    {n:"울산문수축구경기장",   cap:37119, avg:13300},
  daejeon:  {n:"대전월드컵경기장",     cap:40535, avg:10600},
  daegu:    {n:"DGB대구은행파크",      cap:12419, avg:10400},
  pohang:   {n:"포항스틸야드",         cap:15546, avg: 8600},
  gangwon:  {n:"강릉하이원아레나",     cap:20000, avg: 6500},
  anyang:   {n:"안양종합운동장",       cap:17143, avg: 6400},
  jeju:     {n:"제주월드컵경기장",     cap:29791, avg: 5500},
  gwangju:  {n:"광주월드컵경기장",     cap:40245, avg: 4600},
  suwonfc:  {n:"수원종합운동장",       cap:11806, avg: 4500},
  gimcheon: {n:"김천종합운동장",       cap:25000, avg: 2600},
  suwon:    {n:"수원월드컵경기장",     cap:44031, avg:11500},
  incheon:  {n:"인천축구전용경기장",   cap:18216, avg: 8500},
  jeonnam:  {n:"광양축구전용구장",     cap:13496, avg: 5400},
  seoule:   {n:"목동종합운동장",       cap:15511, avg: 3600},
  busan:    {n:"부산구덕운동장", cap:12349, avg: 3500},
  bucheon:  {n:"부천종합운동장",       cap:34456, avg: 3200},
  cheongju: {n:"청주종합운동장",       cap:16280, avg: 3100},
  seongnam: {n:"탄천종합운동장",       cap:16146, avg: 2600},
  gimpo:    {n:"김포솔터축구장",       cap:10000, avg: 2500},
  gyeongnam:{n:"창원축구센터",         cap:15071, avg: 2200},
  cheonan:  {n:"천안종합운동장",       cap:26000, avg: 1800},
  hwaseong: {n:"화성종합경기타운",     cap:35270, avg: 1700},
  ansan:    {n:"안산와~스타디움",      cap:35000, avg: 1500},
  asan:     {n:"이순신종합운동장",     cap:19283, avg: 1700},
  gimhae:   {n:"김해운동장",           cap:15000, avg: 1300},
  yongin:   {n:"용인미르스타디움",     cap:37155, avg: 1400},
  paju:     {n:"파주스타디움",         cap:22000, avg: 1200}
};
/* ── 구단 형태 ────────────────────────────────────────────────
   기업구단은 모기업이 돈줄이라 예산이 크고 안정적이다. 시민구단은 지자체 예산과
   시민 주주로 굴러가 규모가 작지만 지역 밀착도가 높다. 김천은 군경팀이라 아예 다르다.
     k: corp 기업 · civic 시민·도민 · mixed 도·시민 복합 또는 컨소시엄 · army 군경
     o: 운영 주체 */
const CLUB_TYPE={
  seoul:    {k:"corp",  o:"한강그룹"},
  jeonbuk:  {k:"corp",  o:"한빛모터스"},
  ulsan:    {k:"corp",  o:"동해중공업"},
  jeju:     {k:"corp",  o:"제주에너지"},
  pohang:   {k:"corp",  o:"동해제철"},
  daejeon:  {k:"corp",  o:"한성금융그룹"},
  suwon:    {k:"corp",  o:"삼원그룹"},
  busan:    {k:"corp",  o:"부산도시개발"},
  jeonnam:  {k:"corp",  o:"남해산업그룹"},
  seoule:   {k:"corp",  o:"이스트랜드그룹"},
  /* 🏙️ 시민구단 — 운영 주체는 회사가 아니라 지자체와 시민 주주다.
     ⚠ 제보 — 「시민구단 모기업이 주식시장에 상장돼 있는 게 어색하다」.
        「○○도시공사」·「○○산업그룹」 같은 회사 이름을 달고 있어서 상장사로 올라갔다.
        실제 운영 형태(지자체 + 시민주주)에 맞는 이름으로 바꾸고, 증시에서는 빼낸다. */
  gangwon:  {k:"civic", o:"강원도 · 도민주주"},
  incheon:  {k:"civic", o:"인천광역시 · 시민주주"},
  anyang:   {k:"civic", o:"안양시 · 시민주주"},
  gwangju:  {k:"civic", o:"광주광역시 · 시민주주"},
  daegu:    {k:"civic", o:"대구광역시 · 시민주주"},
  suwonfc:  {k:"civic", o:"수원시 · 시민주주"},
  seongnam: {k:"civic", o:"성남시 · 시민주주"},
  bucheon:  {k:"civic", o:"부천시 · 시민주주"},
  gyeongnam:{k:"civic", o:"경상남도 · 도민주주"},
  gimpo:    {k:"civic", o:"김포시 · 시민주주"},
  ansan:    {k:"civic", o:"안산시 · 시민주주"},
  cheonan:  {k:"civic", o:"천안시 · 시민주주"},
  hwaseong: {k:"civic", o:"화성시 · 시민주주"},
  yongin:   {k:"civic", o:"용인시 · 시민주주"},
  gimhae:   {k:"civic", o:"김해시 · 시민주주"},
  paju:     {k:"civic", o:"파주시 · 시민주주"},
  asan:     {k:"civic", o:"아산시 · 시민주주"},
  cheongju: {k:"mixed", o:"청주시 · 지역기업 컨소시엄"},
  gimcheon: {k:"army",  o:"국군체육부대"}
};
const CLUB_TYPE_N={
  corp: {n:"기업구단",  ic:"🏢", c:"#d29922", ol:"모기업",   d:"모기업의 재정 지원을 받습니다. 예산이 크고 안정적입니다."},
  civic:{n:"시민구단",  ic:"🏙️", c:"#58a6ff", ol:"운영 주체", d:"지자체 예산과 시민 주주로 운영됩니다. 규모는 작지만 지역 밀착도가 높습니다. 상장사가 아니라 증시에는 올라오지 않습니다."},
  mixed:{n:"기업+시민", ic:"🤝", c:"#3fb950", ol:"운영 주체", d:"지자체와 지역 기업이 함께 참여하는 컨소시엄 구단입니다."},
  army: {n:"군경구단",  ic:"🎖️", c:"#8b949e", ol:"소속",     d:"국군체육부대 소속 선수로 구성됩니다. 선수 영입·이적이 자유롭지 않습니다."}
};
function clubType(t){
  const c=(t && CLUB_TYPE[t.id]) || {k:"civic", o:(t&&t.name)||""};
  /* 🏢 구단 형태 — 에디터에서 바꿨으면 그 값이 우선한다 (세이브에 저장)
     ⚠ 제보 — 「시민구단 → 기업구단이 되는 상황을 에디터로 수정할 수 있게 해 달라」.
       실제로도 시민구단이 기업 인수로 기업구단이 되는 일이 있다. 형태를 바꾸면
       스폰서 매력도·파트너 수·구장 사업비·AI 예산 증액 확률·증시 상장까지 함께 따라간다. */
  const kOv=(t && G && G.ownerKinds && G.ownerKinds[t.id]);
  const k=(kOv && CLUB_TYPE_N[kOv]) ? kOv : c.k;
  /* 모기업 이름 — 에디터에서 바꿨으면 그 이름이 우선한다 (세이브에 저장) */
  const o=(t && G && G.ownerNames && G.ownerNames[t.id]) || c.o;
  /* 🆔 모기업 고유번호 — 이름을 바꿔도 번호는 구단과 함께 고정된다 */
  const ou=(t && t.own && t.own.uid) || (t ? uidOwnerOf(t.id) : UID_OWNER+90);
  return Object.assign({}, CLUB_TYPE_N[k]||CLUB_TYPE_N.civic, {k, o, uid:ou});
}
/* 요일 계수 — 0=일 … 6=토. K리그는 일·토가 본무대, 금요일 저녁도 제법 오고, 수요일은 반토막. */
/* 요일별 관중 — 실제 K리그 흐름을 따른다.
   주말(토·일)이 본무대고, 금요일 야간경기도 제법 나온다. 주중(화·수·목)은 확실히 빠진다. */
const DOW_ATT=[1.00, 0.48, 0.52, 0.57, 0.55, 0.93, 1.06];
/* 요일·계절 계수의 시즌 평균이 1보다 조금 낮아, 그대로 두면 리그 평균이 자료값보다 7% 낮게 나온다.
   기준선을 그만큼 올려 시즌 평균이 실제 자료(K1 10,649 · K2 4,311)에 맞도록 정규화한다. */
const ATT_NORM=1.09;   // 개막 특수·막바지 흥행을 넣으면서 시즌 평균을 다시 자료값에 맞춰 보정했다
const TICKET_UNIT=0.000115;   // 관중 1명당 티켓 수입(억) ≈ 11,500원
const MD_UNIT    =0.000062;   // 관중 1명당 부대 수입(억) ≈ 6,200원 (MD·식음료·주차)
const ST_MATCHES =19;         // 시즌권에 포함된 홈경기 수
const ST_DISCOUNT=0.72;       // 시즌권 장당 단가 할인율
const TV_ROUND   ={1:0.62, 2:0.20};   // 라운드당 중계권·리그 분배금(억)
/* 벌어들인 돈이 전부 이적 자금이 되지는 않는다. 대부분은 연봉·운영비로 나가고,
   구단이 감독에게 넘기는 이적 가용 현금은 그중 일부다. */
const BUD_SHARE  =0.28;
function stadOf(t){
  if(!t) return {n:"홈구장", cap:15000, avg:3000};
  if(!t.stad){
    const s=STADIUM[t.id];
    /* ⚠ 자료값이 없는 구단(하부에서 올라온 신생 팀)이 900명짜리 기준을 들고 1부를 뛰었다.
       리그 최하위권 수준(1부 2,600 · 2부 1,200)은 되도록 깔아 준다. */
    t.stad = s ? {n:s.n, cap:s.cap, avg:s.avg, _base0:s.avg}
               : {n:`${t.short} 홈구장`, cap:Math.max(8000,(t.fans||10)*450),
                  avg:Math.max(t.div===1?2600:1200, (t.fans||10)*100)};
    if(!s) t.stad._base0=t.stad.avg;
  }
  return t.stad;
}
/* ═══ 🎟️ 기준 관중은 해마다 움직인다 ══════════════════════════════
   ⚠ 제보 — 「10년이 지나니 유저 팀 빼고 홈·원정 관중이 계속 줄어드는 것 같다」.
      확인해 보니 실제로는 그 반대였다 — 구단별 「기준 관중(stad.avg)」은 자료값 그대로
      한 번 정해지면 영영 움직이지 않았다. 흥행 지수(hype)만 0.72~1.34 사이를 오갔을 뿐이라,
      · 만년 하위권 구단은 매 시즌 하한(0.72)에 붙어 늘 30% 적게 들어오고
      · 반대로 잘하는 구단도, 승격한 구단도 관중이 「늘지」 않았다
      · 하부에서 올라온 구단은 자료값이 없어 900명짜리 기준을 그대로 들고 1부를 뛰었다
      그래서 시즌이 쌓일수록 리그 전체 관중이 내려앉는 것처럼 보인다.
   ─ 시즌이 끝날 때 실제 관중과 성적을 보고 기준 관중을 조금씩 옮긴다.
     성적이 좋으면 어느 구단이든 늘고, 나쁘면 줄지만 — 전통 인기 구단은 바닥이 있다. */
/* 🎫 전통 인기 구단 — 2부로 내려가도, 성적이 나빠도 이 관중 아래로는 빠지지 않는다.
   (수원 삼성이 2부에서도 만 명을 채우는 그 현상) */
const ATT_FLOOR={
  seoul:11000, jeonbuk:7800, suwon:8200, ulsan:6800, daejeon:6600, daegu:6200,
  incheon:5600, pohang:5000, gangwon:3600, anyang:3600, jeju:3000, gwangju:2600,
  jeonnam:2800, busan:2600, suwonfc:2600, seongnam:2000, seoule:2000, bucheon:1800,
  cheongju:1700, gimpo:1400, gyeongnam:1400
};
/* 기준 관중의 하한·상한 — 자료값과 전통 인기도를 함께 본다 */
/* ⚠ 예전에는 STADIUM 자료값을 먼저 봤다. 그래서 구장을 개선해 _base0 를 올려도
      하한·상한이 자료값에 묶여 아무 변화가 없었다(감독 기부의 실익이 0). _base0 를 먼저 본다 —
      stadOf 가 처음부터 자료값으로 채워 두므로 게임 시작 시점의 값은 똑같다. */
function attBase0(t){
  const sd=stadOf(t);
  if(sd && sd._base0>0) return sd._base0;
  try{ const s=STADIUM[t.id]; if(s && s.avg) return s.avg; }catch(e){}
  return (sd && (sd.avg||1000)) || 1000;
}
function attFloorOf(t){
  const trad=ATT_FLOOR[t.id]||0;
  const b0=attBase0(t);
  /* 전통 구단은 지정한 하한, 그 밖의 구단도 자료값의 70% 아래로는 빠지지 않는다 —
     성적이 나빠도 그 동네 골수 팬은 남는다. */
  return Math.max(650, trad, Math.round(b0*0.70));
}
function attCeilOf(t){
  const sd=stadOf(t);
  /* 아무리 잘해도 자료값의 1.6배·수용 인원의 92%를 넘지 않는다.
     🛠️ 리모델링·패밀리존은 이 천장 자체를 밀어 올린다 (제보 — 점유율을 높이는 시스템) */
  let capK=0.92, baseK=1.6;
  if(t && t.fac){ capK += clamp(t.fac.remod||0,0,3)*0.02; baseK += clamp(t.fac.remod||0,0,3)*0.05 + clamp(t.fac.family||0,0,3)*0.03; }
  return Math.min(Math.round((sd.cap||30000)*Math.min(capK,0.98)), Math.round(attBase0(t)*baseK));
}
/* 시즌 종료 시 — 성적을 보고 기준 관중을 옮긴다 (전 구단 공통).
   ⚠ 「지난 시즌 실제 관중」쪽으로 수렴시키는 방식은 쓰지 않는다 — 개막 특수(1.52배)·더비(1.24배)가
      섞인 실측 평균은 기준값보다 늘 높게 나와서, 되먹임으로 관중이 무한히 불어난다(실측 10시즌 +120%).
      성적만 보고 조금씩 옮기는 쪽이 예측 가능하고 리그 총량도 안정적이다. */
function attSeasonAdjust(){
  for(const id in G.teams){
    const t=G.teams[id];
    if(!t || (t.div!==1 && t.div!==2)) continue;
    const sd=stadOf(t);
    if(sd._base0==null) sd._base0=attBase0(t);      // 원래 자료값을 기억해 둔다
    let k=1;
    /* ① 성적 — 1위 +5.5% · 중위권 변화 없음 · 최하위 −6%. 어느 구단에나 같다. */
    try{
      const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1, N=tbl.length||12;
      if(pos>0){
        const r=(pos-1)/Math.max(1,N-1);            // 0=1위 · 1=최하위
        k *= 1.055 - r*0.115;
        if(t.div===1 && pos===1) k*=1.04;            // 리그 우승
        if(t.div===2 && pos<=2)  k*=1.05;            // 승격
      }
    }catch(e){}
    /* ② 아시아 무대 */
    try{ if(G.eacl && Array.isArray(G.eacl.teams) && G.eacl.teams.indexOf(t.id)>=0) k*=1.02; }catch(e){}
    /* ③ 승강 — 부가 바뀐 그 다음 시즌에 한 번 크게 움직인다 */
    if(t._attDiv!=null && t._attDiv!==t.div) k *= (t.div===1 ? 1.10 : 0.90);
    t._attDiv=t.div;
    /* 늘 때는 빠르고, 빠질 때는 느리다 — 팬은 하루아침에 사라지지 않는다 */
    let target=sd.avg*k;
    const up=Math.round(sd.avg*0.07)+30, dn=Math.round(sd.avg*0.045)+20;
    target = clamp(Math.round(target), sd.avg-dn, sd.avg+up);
    const lo=attFloorOf(t), hi=attCeilOf(t);
    const before=sd.avg;
    sd.avg = clamp(Math.round(target), lo, Math.max(lo, hi));
    if(t.isUser && Math.abs(sd.avg-before)>=Math.max(60, before*0.015)){
      const up2=sd.avg>before;
      let why = up2 ? "지난 시즌 성적에 팬이 늘었습니다" : "지난 시즌 성적에 팬이 빠졌습니다";
      if(sd.avg<=lo && (ATT_FLOOR[t.id]||0)>0) why="전통의 지지층이 버텨 주고 있습니다";
      else if(sd.avg>=hi) why="구장 규모가 한계입니다 — 더 늘리려면 증축이 필요합니다";
      try{ addNews(`${up2?"🎟️":"🪑"} 기준 관중이 <b>${before.toLocaleString()}명 → ${sd.avg.toLocaleString()}명</b>으로 조정되었습니다 — ${why}.`,
        up2?"good":"warn", "club"); }catch(e){}
    }
  }
}
/* 흥행 지수 — 성적·순위에 따라 기준 관중이 서서히 오르내린다(0.70~1.45) */
function hypeOf(t){ if(t.hype==null) t.hype=1; return t.hype; }
/* 홈경기 뒤 다음 경기 관중에 반영될 흥행 변동. 이기면 오르고, 대패하면 크게 꺾인다. */
function updateHype(t, gf, ga, isHome){
  const d=gf-ga;
  let v = d>=3?0.042 : d>0?0.024 : d===0?-0.004 : d>=-2?-0.024 : -0.046;
  if(!isHome) v*=0.55;                                  // 원정 결과는 홈 흥행에 절반만 영향
  const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1;
  if(pos>0){
    if(pos<=3) v+=0.012;                                // 상위권이면 서서히 붙는다
    else if(pos>=tbl.length-1) v-=0.014;                // 최하위는 서서히 빠진다
  }
  // 평균으로 서서히 되돌아간다 — 안 그러면 강팀은 시즌 중반에 상한선에 붙어 버린다
  const h0=hypeOf(t);
  /* ⚠ 하한 0.72 는 「성적이 계속 나쁜 구단은 영원히 30% 적게 들어온다」는 뜻이었다.
     실제로는 그 지점에서 골수 팬만 남아 더 빠지지 않는다 — 하한을 올리고,
     장기 감소는 기준 관중(stad.avg) 쪽에서 천천히 처리한다. */
  t.hype=clamp(Math.round((h0 + v - (h0-1)*0.085)*1000)/1000, 0.82, 1.34);
}
/* 경기 밖에서 흥행이 움직이는 경우 — 큰 영입, 핵심 선수 매각 같은 사건.
   ⚠ 예전에는 hype 를 오직 경기 결과로만 움직였다. 그래서 리그 최고 선수를 데려와도
     다음 홈경기 관중이 한 명도 늘지 않았고, 반대로 에이스를 팔아도 관중은 그대로였다.
     현실에서는 영입 발표 다음 날 티켓이 팔린다. 그 감각을 넣는다. */
function bumpHype(t, v, why){
  if(!t || !v) return;
  const before=hypeOf(t);
  t.hype=clamp(Math.round((before+v)*1000)/1000, 0.82, 1.45);
  const d=t.hype-before;
  if(t.isUser && Math.abs(d)>=0.02){
    const sd=stadOf(t);
    addNews(`${d>0?"📈":"📉"} 흥행 지표가 ${d>0?"올랐":"내렸"}습니다 — ${why||""} (예상 관중 약 ${Math.round(sd.avg*t.hype*ATT_NORM/100)*100}명)`,
      d>0?"good":"warn", "club");
  }
}
/* 영입이 흥행에 주는 충격 — 이적료보다 "얼마나 잘하는 선수인가"가 더 크게 작용한다.
   구장 크기 대비 규모도 본다: 작은 구단에 온 대형 영입일수록 체감이 크다. */
function hypeFromSigning(t, p, fee){
  if(!t||!p) return 0;
  const lv = playerLevel(p) - starRefLevel();          // 리그 평균 대비 기량
  let v = clamp((lv-2)*0.011, 0, 0.11);                 // 평균보다 확실히 나은 선수부터 표가 움직인다
  v += clamp((fee||0)/Math.max(25, stadOf(t).avg/200)*0.005, 0, 0.06);    // 우리 구단 규모 대비 이적료
  if(p.osClub && (p.osTier||"big")==="big") v+=0.05;   // 해외에서 온 이름값
  if((p.osTier||"")==="minor") v*=0.35;                 // 리그를 뒤흔들 영입은 아니다
  return Math.round(clamp(v, 0, 0.17)*1000)/1000;
}
/* 경기 관중 산출.
   opts: {day, opener, derby, po} — day 를 주지 않으면 오늘 날짜로 본다. */
function attendanceFor(home, away, opts){
  opts=opts||{};
  const sd=stadOf(home);
  const day = opts.day!=null ? opts.day : (G.day||0);
  const dt  = (G.cal? dateOfDay(day) : new Date(G.season,2,1));
  let n = sd.avg * hypeOf(home) * ATT_NORM;
  n *= DOW_ATT[dt.getDay()];
  /* 🎉 개막 특수 — K리그는 개막전에 사람이 몰리고, 그 열기가 몇 라운드에 걸쳐 식는다.
     (제보 — "개막전에 관중이 많이 몰리는 편, 이러다가 점점 떨어지는 형국")
     개막 1.52배 → 2R 1.28 → 4R 1.13 → 8R 1.03 → 이후 평상. */
  {
    const rdNow = opts.rd!=null ? opts.rd : ((home.W||0)+(home.Dw||0)+(home.L||0));
    if(opts.opener) n *= 1.52;
    else if(rdNow<12) n *= 1 + 0.34*Math.exp(-rdNow/3.4);
  }
  /* 🏁 시즌 막바지 — 우승·승격·강등이 걸린 팀은 다시 사람이 차고,
     아무것도 안 걸린 중위권 소화 경기는 오히려 더 빠진다. */
  try{
    const fixN=(home.div===1?(G.k1Fix||[]).length:(G.k2Fix||[]).length)+(home.div===1?splitRounds():0);
    const rdNow=(home.div===1?G.r1:G.r2)||0;
    if(fixN && rdNow>=fixN-4){
      const tbl=tableOf(home.div), pos=tbl.findIndex(x=>x.id===home.id)+1, N2=tbl.length||12;
      const stake = pos>0 && (pos<=3 || pos>=N2-2 || (home.div===2 && pos<=5));
      n *= stake ? 1.16 : 0.94;
    }
  }catch(e){}
  // 더비·상위권 맞대결은 평소와 다르다
  const _db = away ? derbyOf(home.id, away.id) : null;
  if(opts.derby || _db) n *= (_db && _db.tier>=2) ? 1.34 : 1.24;   // 대형 더비는 더 붐빈다
  if(opts.po) n*=1.35;
  // 원정 인기 구단이 오면 원정석이 찬다
  if(away) n *= 1 + clamp(((stadOf(away).avg||1000)-3000)/60000, -0.03, 0.18);
  // 홈팀 최근 성적
  const f=(home.form||[]).slice(-5);
  if(f.length) n *= 1 + (f.filter(x=>x==="W").length*0.022 - f.filter(x=>x==="L").length*0.022);
  // 순위 — 우승 경쟁이면 붐비고, 잔류 싸움이면 빠진다.
  // ⚠ 개막 직후에는 전 구단이 승점 0이라 정렬 순서만으로 1위가 정해진다 — 5라운드는 지나야 의미가 있다.
  const played=(home.W||0)+(home.Dw||0)+(home.L||0);
  if(played>=5){
    const tbl=tableOf(home.div), pos=tbl.findIndex(x=>x.id===home.id)+1, N=tbl.length||12;
    if(pos>0){
      if(pos<=2) n*=1.07; else if(pos<=4) n*=1.03;
      else if(pos>=N) n*=0.88; else if(pos>=N-1) n*=0.94;
    }
  }
  /* 감독을 향한 팬 신뢰 — 시즌권에만 반영하고 당일권에는 전혀 안 쓰고 있었다.
     성적이 같아도 팬이 등을 돌린 감독의 경기는 표가 덜 나간다. (유저 팀 한정) */
  if(home.isUser && G.trust) n *= clamp(1 + (G.trust.fans-70)/100*0.36, 0.87, 1.13);
  /* 🛠️ 리모델링·패밀리존 — 관람 환경이 좋아지면 같은 성적에도 자리가 더 찬다 (제보 — 점유율) */
  if(home.isUser && home.fac){
    n *= 1 + (clamp(home.fac.remod||0,0,3))*0.025 + (clamp(home.fac.family||0,0,3))*0.008;
  }
  // 계절 — 개막 직후 추위, 한여름 더위, 막바지 추위
  const mo=dt.getMonth()+1;
  if(mo<=3) n*=0.93; else if(mo===7||mo===8) n*=0.95; else if(mo>=11) n*=0.90;
  else if(mo===5||mo===9||mo===10) n*=1.04;
  n *= 0.90 + Math.random()*0.20;                      // 그날의 사정
  // 시즌권자는 웬만하면 온다 — 하한선. 상한은 수용 인원.
  const st=home.seasonTix||0;
  const floor=Math.max(Math.round(sd.avg*0.30), Math.round(st*0.72));
  /* ⚠ 제보 — 관중 수 끝자리가 전부 0이라 기계가 찍은 숫자처럼 보였다.
     실제 구단 발표 관중은 21,547 처럼 한 명 단위로 나온다. 반올림하지 않는다. */
  return clamp(Math.round(n), Math.min(floor, sd.cap), sd.cap);
}
/* 🚌 원정 관중 — 오늘 그 경기장에 온 사람 중 몇 명이 원정 팬인가.
   K리그 원정석은 대개 전체의 5~15% 수준이고, 인기 구단·더비·가까운 도시일수록 많이 온다. */
function awayAttFor(home, away, att){
  if(!home || !away || !att) return 0;
  const sa=stadOf(away), sh=stadOf(home);
  /* 원정 동원력 — 그 구단의 평소 관중 규모가 기준 */
  let base = clamp(((sa.avg||1000)/Math.max(1200, (sh.avg||1000))) * 0.085, 0.02, 0.17);
  base *= clamp(hypeOf(away), 0.7, 1.4);                       // 요즘 잘 나가면 원정도 따라온다
  /* 🚌 원정 동원력 — 원정까지 따라가는 서포터가 두꺼운 구단이 따로 있다(제보).
     2부에 있어도 원정석은 채운다. */
  { const tr=ATT_FLOOR[away.id]||0;
    if(tr>=6000)      base*=1.35;
    else if(tr>=3000) base*=1.20;
    else if(tr>=1700) base*=1.10; }
  const db=derbyOf(home.id, away.id);
  if(db) base *= (db.tier>=2 ? 2.1 : 1.7);                     // 더비는 원정석이 꽉 찬다
  else if(REGION[home.id] && REGION[home.id]===REGION[away.id]) base *= 1.6;   // 같은 도시
  if(away.div===2 && home.div===1) base*=0.75;
  const f=(away.form||[]).slice(-5);
  if(f.length) base *= 1 + (f.filter(x=>x==="W").length*0.03 - f.filter(x=>x==="L").length*0.025);
  base *= 0.85+Math.random()*0.30;
  /* 원정석 상한 — 경기장 수용 인원의 15%를 넘지 않는다 */
  const capAway=Math.round((sh.cap||10000)*0.15);
  return clamp(Math.round(att*clamp(base,0.015,0.22)), 0, Math.min(capAway, att));
}
/* 다음 홈경기 예상 관중 — 무작위 요소를 뺀 구간으로 보여 준다 */
function attEstimate(home, away, day){
  const s=[]; for(let i=0;i<9;i++) s.push(attendanceFor(home, away, {day}));
  s.sort((a,b)=>a-b);
  return {lo:Math.round(s[1]/100)*100, hi:Math.round(s[7]/100)*100, mid:s[4]};
}
/* 매진 판정 — 수용 인원의 96% 이상 */
function isSellout(t, att){ return att >= Math.round(stadOf(t).cap*0.96); }
function attPct(t, att){ return Math.round(att/Math.max(1,stadOf(t).cap)*100); }
/* ── 시즌권 ────────────────────────────────────────────────
   1월 2일에 창구가 열리고 개막 전날 마감한다. 그 사이 매일 조금씩 팔리며,
   겨울 이적시장에서 좋은 선수를 데려오거나 팬 신뢰도가 오르면 판매 속도가 붙는다. */
const ST_OPEN_DAY=1;                     // 1월 2일 = 달력 1일차
function stWindow(){
  const close=Math.max(ST_OPEN_DAY+1, ((G.cal&&G.cal.openOff)||60)-1);   // 개막 전날 마감
  return {open:ST_OPEN_DAY, close, days:close-ST_OPEN_DAY+1};
}
function stIsOpen(){ const w=stWindow(); const d=G.day||0; return d>=w.open && d<=w.close; }
/* 이 구단이 올 시즌 최종적으로 팔 수 있는 시즌권 목표치 */
function seasonTixTarget(t){
  const sd=stadOf(t);
  let base = sd.avg * 0.46 * hypeOf(t);
  if(t.isUser && G.trust) base *= 0.80 + (G.trust.fans/100)*0.42;   // 팬 신뢰도가 곧 재구매율
  const ct=clubType(t);
  if(ct.k==="corp") base*=1.06;          // 모기업 단체 구매
  else if(ct.k==="army") base*=0.82;     // 군경팀은 고정 팬층이 얇다
  base *= t._stLuck || (t._stLuck = 0.92 + Math.random()*0.18);
  return clamp(Math.round(base/10)*10, Math.round(sd.avg*0.18), Math.round(sd.cap*0.62));
}
/* 판매 곡선 — 창구가 열린 직후와 개막 직전에 몰린다(S자) */
function stCurve(p){ p=clamp(p,0,1); return clamp(0.18*p + 0.82*(p*p*(3-2*p)), 0, 1); }
/* 하루치 판매 진행. 개막 전날이면 마감 처리하고 수입을 정산한다. */
function tickSeasonTickets(){
  if(!G.cal) return;
  const w=stWindow(), d=G.day||0;
  for(const id in G.teams){
    const t=G.teams[id];
    if(t.stSeason===G.season && t.stClosed) continue;
    if(t.stSeason!==G.season){ t.stSeason=G.season; t.seasonTix=0; t.seasonTixRev=0; t.stClosed=false; t._stLuck=null; t.stTarget=seasonTixTarget(t); }
    if(d<w.open) continue;
    const p=clamp((d-w.open+1)/w.days, 0, 1);
    t.seasonTix=Math.round(t.stTarget*stCurve(p)/10)*10;
    if(d>=w.close){ closeSeasonTickets(t); }
  }
}
/* 마감 — 판매 대금을 한 번에 정산한다 */
function closeSeasonTickets(t){
  if(t.stClosed) return;
  t.stClosed=true;
  t.seasonTix=t.stTarget||t.seasonTix||0;
  t.seasonTixRev = Math.round(t.seasonTix * TICKET_UNIT * ST_MATCHES * ST_DISCOUNT * 10)/10;
  t.budget=Math.round((t.budget + t.seasonTixRev*BUD_SHARE)*10)/10;
  if(!t.isUser) return;
  const fin=finLedger(t); fin.st=t.seasonTixRev;
  const sd=stadOf(t);
  addNews(`🎫 ${G.season} 시즌권 판매 마감 — <b>${t.seasonTix.toLocaleString()}장</b> (${sd.n} 수용 ${sd.cap.toLocaleString()}석의 ${Math.round(t.seasonTix/sd.cap*100)}%) · 수입 <b>${t.seasonTixRev}억</b>`,
    null, "club", {cat:"club", ic:"🎫", tid:t.id,
      head:`${t.name}, 시즌권 ${t.seasonTix.toLocaleString()}장 판매`,
      sub:`${sd.n} 기준 ${Math.round(t.seasonTix/sd.cap*100)}% · 구단은 ${t.seasonTixRev}억의 선수입을 확보했다.`});
  const pct=t.seasonTix/Math.max(1,sd.avg);
  socialFill(pct>=0.55?SOC.stGood:pct>=0.38?SOC.stOk:SOC.stBad, 2+R(2), pct>=0.55?1:pct>=0.38?0:-1,
             {t:t.short, n:t.seasonTix.toLocaleString(), st:sd.n});
  fmkFill(pct>=0.55?FMK.stGood:FMK.stBad, 1+R(2), {t:t.short, n:t.seasonTix.toLocaleString()});
}
/* 구버전 세이브·즉시 정산이 필요할 때(시즌 도중 로드 등) 한 번에 처리 */
function sellSeasonTickets(t){
  t.stSeason=G.season; t._stLuck=null; t.stTarget=seasonTixTarget(t);
  t.seasonTix=t.stTarget; t.seasonTixRev=Math.round(t.seasonTix*TICKET_UNIT*ST_MATCHES*ST_DISCOUNT*10)/10;
  t.stClosed=true;
  return t;
}
/* 홈경기 하루치 수입 — 시즌권자는 이미 값을 냈으므로 당일권 수입에서 제외한다 */
function gateRevenue(t, att){
  const st=Math.min(att, t.seasonTix||0);
  const walk=Math.max(0, att-st);
  return Math.round((walk*TICKET_UNIT + att*MD_UNIT)*100)/100;
}
/* 시즌 회계 장부 — 재정 탭에서 어디서 얼마가 들어왔는지 보여준다 */
function finLedger(t){
  /* 🏆 ⚠ 제보 원문 — 「K리그2 로 시즌을 보냈는데 '재정' 탭의 '시즌 수입' 항목에
     'K리그2 상금' 이라고 적혀야 하는데 'K리그1 상금' 이라고 적혀 있어서」.
     원인 — 이름표를 「지금의 t.div」로 찍었다. 시즌 종료 화면은 이미 승격·강등이 반영된
       뒤라, K리그2에서 승격한 감독의 장부가 통째로 「K리그1」로 둔갑했다.
     ─ 장부를 열 때 「그 시즌에 뛴 리그」를 함께 새겨 두고, 이름표는 그 값으로 찍는다. */
  if(!t.fin || t.fin.s!==G.season) t.fin={s:G.season, div:t.div, st:0, gate:0, tv:0, prize:0, spon:0, transfer:0, fac:0, att:[], best:0, bestOpp:"", log:[]};
  if(t.fin.div==null) t.fin.div=t.div;            // 옛 세이브 백필
  if(t.fin.fac==null) t.fin.fac=0;
  if(t.fin.spon==null) t.fin.spon=0;
  if(!t.fin.att) t.fin.att=[];
  if(!t.fin.log) t.fin.log=[];
  return t.fin;
}
function logHomeGate(t, M, att, gate){
  const fin=finLedger(t);
  fin.log.unshift({d:G.day||0, opp:(M.away.short||""), att, gate,
                   res:`${M.hg}-${M.ag}`, sell:isSellout(t,att)});
  fin.log=fin.log.slice(0,24);
}
function avgAtt(t){ const a=finLedger(t).att; return a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length):0; }
/* 시즌권 창구를 연다 — 실제 판매는 stepDay()에서 하루씩 진행된다 */
function runSeasonTicketSale(){
  for(const id in G.teams){ const t=G.teams[id];
    t.stSeason=G.season; t.stClosed=false; t._stLuck=null;
    t.stTarget=seasonTixTarget(t); t.seasonTix=0; t.seasonTixRev=0; }
  tickSeasonTickets();
  const ut=userTeam();
  if(ut) addNews(`🎫 ${G.season} 시즌권 판매 시작 — <b>${dateLabel(stWindow().open)}</b>부터 개막 전날(<b>${dateLabel(stWindow().close)}</b>)까지 판매합니다.`);
}
/* ═══════════════════════════════════════════════════════════════
   🤝 스폰서십 — 구단 살림의 절반은 여기서 나온다
   유니폼 앞가슴(메인) · 소매(슬리브) · 용품(킷) · 구장 명명권 네 자리를 판다.
   금액은 「구단 매력도」가 정한다 — 팬, 관중, 성적, 아시아 무대, 전력, 흥행, 모기업.
   스폰서는 성적에 반응하고(우승하면 올려 주고 강등하면 깎는다),
   감독의 사건 사고에도 반응하며(이미지 리스크), 큰 브랜드를 두고 구단끼리 경쟁한다.
   ※ 감독이 직접 협상하지는 않는다. 성적으로 값을 올리는 것이 곧 협상이다.
═══════════════════════════════════════════════════════════════ */
const SPON_SLOT={
  main:  {n:"메인 스폰서", ic:"👕", d:"유니폼 앞가슴", mul:1.00},
  sleeve:{n:"슬리브 스폰서", ic:"💪", d:"유니폼 소매", mul:0.26},
  kit:   {n:"용품 스폰서", ic:"👟", d:"유니폼·용품 공급", mul:0.42},
  naming:{n:"구장 명명권", ic:"🏟️", d:"홈구장 이름", mul:0.34}
};
function sponSlots(){ return ["main","sleeve","kit","naming"]; }
/* 🤝 파트너 스폰서 — 자리가 정해진 네 곳 말고는 개수 제한이 없다.
   보드 광고, 트레이닝 킷, 유소년, 지역 파트너… 하나하나는 작아도 쌓이면 살림이 된다.
   구단이 돈을 더 벌고 싶다면 매력도를 올려 파트너를 더 많이 끌어와야 한다. */
const SPON_PARTNER_KIND=[
  {k:"board",  n:"경기장 보드 광고", ic:"🪧", mul:0.055},
  {k:"train",  n:"트레이닝 킷",     ic:"🎽", mul:0.048},
  {k:"youth",  n:"유소년 파트너",   ic:"🧒", mul:0.032},
  {k:"food",   n:"공식 식음료",     ic:"🥤", mul:0.045},
  {k:"mobile", n:"공식 통신",       ic:"📱", mul:0.060},
  {k:"bank",   n:"공식 금융",       ic:"🏦", mul:0.062},
  {k:"car",    n:"공식 차량",       ic:"🚗", mul:0.052},
  {k:"health", n:"공식 의료",       ic:"🏥", mul:0.036},
  {k:"travel", n:"공식 여행",       ic:"✈️", mul:0.040},
  {k:"local",  n:"지역 파트너",     ic:"📍", mul:0.026}
];
/* 유치 가능한 파트너 수 — 매력도가 곧 영업력이다 */
function sponPartnerTarget(t){
  const a=sponAppeal(t);
  let n=Math.round(Math.pow(a/100, 1.35)*22);
  try{ if(clubType(t).k==="corp") n+=2; }catch(e){}
  try{ if(eaclOn() && G.eacl.teams.indexOf(t.id)>=0) n+=2; }catch(e){}
  if(t.isUser) n-=Math.round(clamp((G.sponHeat||0)*0.8, 0, 5));   // 사건이 나면 발길이 끊긴다
  return clamp(n, 1, 40);
}
function sponPartners(t){ const sp=sponOf(t); if(!Array.isArray(sp.partners)) sp.partners=[]; return sp.partners; }
function sponPartnerValue(t, kind){
  const base=sponValue(t, "main");
  return Math.max(0.1, Math.round(base*(kind.mul)*(0.75+Math.random()*0.6)*10)/10);
}
/* 브랜드 풀 — 등급이 높을수록 매력 있는 구단에만 붙는다 */
const SPON_BRAND={
  1:["한빛전자","동해모터스","태평양항공","서라벌금융","누리텔레콤","백두중공업","청류에너지","한성생명",
     "대한해운","금강전자","무궁화카드","세종반도체","아리랑카드","한강모빌리티","무진자동차","천지에너지",
     "국민상선","광개토건설","다솜전자","한빛카드"],
  2:["새벽식품","미르건설","하나로유통","광명화학","동방제약","한울제철","가온소프트","별빛유업",
     "천마물류","해오름산업","솔밭커피","은하캐피탈","한들제과","초원음료","금성공업","백록담생수",
     "달빛렌터카","오름테크","남한강시멘트","해솔보험","가람물산","진달래백화점","산들바람항공","오작교통운"],
  3:["동네슈퍼마트","우리동네은행","고향치킨","시민상호저축","한마음병원","푸른택배","참한식품","길목주유소",
     "동광인쇄","해맑은학원","시청앞분식","단골약국","골목세탁소","중앙렌탈","우리마트","성실공인중개",
     "한마음정형외과","희망운수","좋은아침우유","동네빵집","일등세차","튼튼철물","바른치과","넉넉정육점",
     "새싹어린이집","동구청소년센터","향토식당","미소미용실"]
};
/* 용품 브랜드는 현실에서도 한 회사가 여러 구단에 유니폼을 댄다 — 중복을 허용한다 */
const SPON_KIT={
  1:["아레스","볼트","하이퍼기어","피닉스스포츠"],
  2:["스톰기어","카이로스","라피드","윈드러너"],
  3:["필드메이커","스타트라인","베이직핏","홈그라운드"]
};
function sponBrandPool(tier, kind){ return (kind==="kit"?SPON_KIT:SPON_BRAND)[clamp(tier,1,3)] || SPON_BRAND[3]; }
/* 지역 업체 — 전국구 브랜드가 동나도 동네 스폰서는 마르지 않는다.
   작은 구단의 유니폼에 지역 상호가 박히는 건 실제 K리그의 풍경이기도 하다. */
const SPON_LOCAL=["상호저축은행","중앙병원","프레시마트","시티택배","로컬베이커리","한마음의원","성실공인중개",
  "제일주유소","다올정형외과","우리치킨","행복복지재단","시민신협","으뜸안경","참좋은여행","바로세차",
  "든든물류","가족한우","해맑은치과","우리동네헬스","백년약국"];
function sponLocalName(t, used){
  for(let i=0;i<24;i++){
    const n=`${t.short} ${pick(SPON_LOCAL)}`;
    if(!used || !used[n]) return n;
  }
  return `${t.short} ${pick(SPON_LOCAL)} ${1+R(9)}호점`;
}
/* ── 구단 매력도 ────────────────────────────────────────────
   스폰서가 돈을 얹는 이유는 노출이다. 다만 「사람이 많이 보는 팀」은 한 가지로 정해지지 않는다.
   팬 수, 실제로 오는 관중, 꽉 찬 관중석, 도시의 크기, 성적, 스타, 구장, 아시아 무대,
   그리고 감독이 만든 소란까지 — 항목을 나눠 두면 무엇을 고쳐야 값이 오르는지 보인다.
   ⚠ AI 구단에는 감독 개인 항목(평판·언론·사건)을 매기지 않는다. 비교가 불공정해진다.
═══════════════════════════════════════════════════════════════ */
/* 연고 도시의 크기 — 같은 성적이라도 광고가 닿는 사람 수가 다르다 */
const SPON_MARKET={
  seoul:8, seoule:8, incheon:6, busan:6, daegu:6,
  suwon:5, suwonfc:5, daejeon:5, gwangju:5, ulsan:5, yongin:5,
  seongnam:4, bucheon:4, hwaseong:4, changwon:4, gyeongnam:4, cheongju:4, cheonan:4, ansan:4,
  jeonbuk:3, pohang:3, anyang:3, jeju:3, gimpo:3, jeonnam:2, gangwon:2, paju:2, asan:2, gimhae:2,
  gimcheon:1
};
function sponMarketOf(t){ return (SPON_MARKET[t.id]!=null) ? SPON_MARKET[t.id] : 3; }
/* 항목별 점수 — 화면에서 그대로 펼쳐 보여 준다 */
function sponAppealDetail(t){
  const It=[]; const add=(n,v,max,tip)=>It.push({n, v:Math.round(v*10)/10, max, tip});
  if(!t) return {v:20, items:It};
  const mine=!!t.isUser;

  /* ① 팬 규모 — 기본이지만 위로 갈수록 완만해진다 */
  add("팬 규모", clamp(Math.pow(Math.max(0,t.fans||10), 0.78)*1.05, 0, 18), 18, `팬 ${t.fans}만`);

  /* ② 관중 동원 · ③ 좌석 점유율 — 절대수와 「꽉 찬 그림」은 다른 값이다 */
  let cap=15000, avg=3000;
  try{ const sd=stadOf(t); cap=sd.cap||15000; avg=sd.avg||3000; }catch(e){}
  add("관중 동원", clamp(avg/1500, 0, 10), 10, `평균 ${avg.toLocaleString()}명`);
  const fill=clamp(avg/Math.max(1,cap), 0, 1);
  add("좌석 점유율", clamp((fill-0.32)*15, -6, 7), 7,
    `${Math.round(fill*100)}%${fill>=0.75?" — 중계 화면이 꽉 찬다":fill<0.18?" — 텅 빈 관중석이 그대로 잡힌다":""}`);

  /* ④ 시장 규모 */
  const mk=sponMarketOf(t);
  add("연고 시장", mk, 8, ["소도시","소도시","중소도시","중견도시","중견도시","대도시","광역시","광역시","수도권 최대"][clamp(mk,0,8)]);

  /* ⑤ 리그 · ⑥ 성적 · ⑦ 최근 폼 */
  add("소속 리그", t.div===1?9:0, 9, divName(t.div));
  try{
    const tb=tableOf(t.div), pos=tb.findIndex(x=>x.id===t.id)+1;
    if(pos>0) add("리그 순위", clamp((tb.length/2 - pos)*0.85, -6, 9), 9, `${pos}위 / ${tb.length}팀`);
  }catch(e){}
  try{
    const f=(t.form||[]).slice(-5);
    if(f.length){
      const pt=f.reduce((s,x)=>s+(x==="W"?1:x==="D"?0.34:-0.6),0);
      add("최근 폼", clamp(pt*1.0, -3, 4), 4, f.join("")||"-");
    }
  }catch(e){}

  /* ⑧ 팀 전력 · ⑨ 스타 파워 — 화면에 잡히는 시간을 만드는 건 결국 선수다 */
  try{ add("팀 전력", clamp((teamOVR(t)-64)*1.1, -6, 10), 10, `선발 평균 종합 ${dispOvrRaw(teamOVR(t))}`); }catch(e){}
  try{
    const ps=[...(t.players||[])].sort((a,b)=>b.ovr-a.ovr);
    const top=ps[0]?ps[0].ovr:64, stars=ps.filter(p=>p.ovr>=76).length;
    add("스타 파워", clamp((top-72)*1.5 + stars*0.9, 0, 8), 8,
      ps[0]?`${ps[0].name} ${top}${stars>1?` · 특급 ${stars}명`:""}`:"-");
  }catch(e){}

  /* ⑩ 흥행 지수 */
  try{ add("흥행 지수", clamp((hypeOf(t)-1)*26, -8, 10), 10, `${Math.round(hypeOf(t)*100)}%`); }catch(e){}

  /* ⑪ 구단 형태 */
  try{
    const ct=clubType(t);
    add("구단 형태", ct.k==="corp"?6:ct.k==="mixed"?2:ct.k==="army"?-6:0, 6, ct.n+" · "+ct.o);
  }catch(e){}

  /* ⑫ 구장 시설 — 전용구장·돔은 광고주가 먼저 알아본다 */
  {
    let v=clamp((cap-12000)/9000, 0, 6);   // 🏟️ 한도 해제 — 5만 석 이상 대형 구장은 그 자체가 광고판이다
    let tip=`${cap.toLocaleString()}석`;
    /* 🛠️ 리모델링·메가스토어 — 관람 환경과 상업 시설도 광고주가 본다 (제보) */
    try{ if(mine && t.fac){ const r=clamp(t.fac.remod||0,0,3); if(r){ v+=r*1.2; tip+=` · 리모델링 ${r}차`; }
      if((t.fac.shop||0)>0){ v+=0.8; } } }catch(e){}
    try{
      const S=stadProj();
      if(mine && S && S.phase==="done"){
        const pl=stadPlan(S.k);
        v+=(S.k==="dome"?3.5:2.2); tip=`${pl.n} · ${tip}`;
      }
    }catch(e){}
    add("구장 시설", v, 7, tip);
  }

  /* ⑬ 아시아 무대 — 노출의 격이 다르다 */
  try{
    const H=eaclHonorOf(t.id);
    let v=clamp(H.champ*6.5 + H.runner*3.2 + H.qf*1.6 + H.apps*1.1, 0, 16);
    let tip=H.champ?`${eaclShort()} 우승 ${H.champ}회`:H.runner?`준우승 ${H.runner}회`:H.qf?`8강 ${H.qf}회`:H.apps?`출전 ${H.apps}회`:"기록 없음";
    if(eaclOn() && G.eacl.teams.indexOf(t.id)>=0){ v=clamp(v+5, 0, 16); tip+=" · 올 시즌 참가"; }
    add("아시아 실적", v, 16, tip);
  }catch(e){}

  /* ⑭ 우승 이력 */
  try{
    let n=0;
    if(mine) n=(G.trophies||[]).filter(x=>x.kind==="champ").length;
    else n=(G.history||[]).filter(h=>h.champ===t.name).length;
    if(n) add("우승 이력", clamp(n*2.6, 0, 8), 8, `리그 우승 ${n}회`);
  }catch(e){}

  /* ⑮~⑱ 감독이 만드는 값 — 우리 구단에만 매긴다 */
  if(mine){
    try{ add("감독 브랜드", clamp((mgrRep()-30)*0.12, -2, 5), 5, `평판 ${mgrRep()}`); }catch(e){}
    try{ const r=(G.press&&G.press.rel)||50; add("언론 관계", clamp((r-50)*0.06, -3, 3), 3, `호감도 ${Math.round(r)}`); }catch(e){}
    try{ const f=(G.trust&&G.trust.fans)||70; add("팬 신뢰", clamp((f-70)*0.13, -4, 4), 4, `${Math.round(f)}`); }catch(e){}
    let risk=0, why=[];
    try{ const fn=clamp(Math.sqrt(G.mgrFineTot||0)*0.85, 0, 10); if(fn>=0.3){ risk-=fn; why.push(`누적 징계금 ${Math.round(G.mgrFineTot||0)}억`); } }catch(e){}
    try{ if(G.sue && G.sue.chill>0){ risk-=2.5; why.push("소송 여파"); } }catch(e){}
    try{ const h=(G.sponHeat||0); if(h){ risk-=h*2.2; why.push(`최근 사건 ${h}/6`); } }catch(e){}
    try{ if(typeof stkBadCredit==="function" && stkBadCredit()){ risk-=5.5; why.push(`감독 파산 이력 (${stkBadCreditLeft()}시즌 남음)`); } }catch(e){}
    if(risk<0) add("이미지 리스크", clamp(risk, -16, 0), 0, why.join(" · "));
  }

  const raw=It.reduce((s,x)=>s+x.v, 0);
  return {v:clamp(Math.round(14+raw), 8, 100), items:It};
}
function sponAppeal(t){ try{ return sponAppealDetail(t).v; }catch(e){ return 20; } }
function sponTierOf(appeal){ return appeal>=68 ? 1 : appeal>=42 ? 2 : 3; }
/* 슬롯별 연간 금액(억) — 매력도의 제곱에 가깝게 올라간다.
   작은 구단과 큰 구단의 차이가 실제로도 그만큼 크다. */
function sponValue(t, slot){
  const a=sponAppeal(t), S=SPON_SLOT[slot];
  let base = Math.pow(a/100, 1.9) * 58;                         // 매력 100이면 메인 58억 안팎
  base *= S.mul;
  if(slot==="naming"){
    try{ base *= clamp((stadOf(t).cap||15000)/26000, 0.45, 1.6); }catch(e){}
    try{ if(clubType(t).k!=="corp") base *= 0.72; }catch(e){}    // 지자체 소유 구장은 값이 덜 나온다
  }
  return Math.max(0.3, Math.round(base*10)/10);
}
/* 이미 쓰이고 있는 브랜드 — 같은 이름이 리그에 둘 있으면 안 된다 */
function sponUsedNames(){
  const used={};
  for(const id in (G.teams||{})){
    const sp=(G.teams[id].spon)||{};
    for(const k of sponSlots()) if(sp[k] && sp[k].n) used[sp[k].n]=id;
  }
  return used;
}
/* 새 계약 — 매력도에 맞는 등급에서 아직 안 쓰인 브랜드를 데려온다 */
function sponSign(t, slot, opt){
  const a=sponAppeal(t), tier=sponTierOf(a);
  const used = slot==="kit" ? {} : sponUsedNames();      // 용품은 한 회사가 여러 구단에 대도 자연스럽다
  let pool=sponBrandPool(tier, slot).filter(n=>!used[n]);
  if(!pool.length) pool=sponBrandPool(Math.min(3,tier+1), slot).filter(n=>!used[n]);
  if(!pool.length) pool=sponBrandPool(3, slot).filter(n=>!used[n]);
  if(!pool.length) pool=sponBrandPool(2, slot).filter(n=>!used[n]);
  const amt=Math.round(sponValue(t, slot)*(0.88+Math.random()*0.26)*10)/10;
  const yrs=slot==="naming" ? 3+R(3) : 2+R(3);
  /* 전국구 브랜드가 동나면 지역 업체가 들어온다 (용품은 지역 업체가 만들지 않으므로 제외) */
  const name = pool.length ? pick(pool) : (slot==="kit" ? pick(sponBrandPool(3,"kit")) : sponLocalName(t, used));
  return {n:name, amt, yrs, left:yrs, since:G.season, tier:pool.length?tier:3, slot};
}
function sponOf(t){ if(!t.spon) t.spon={}; return t.spon; }
function sponTotal(t){
  const sp=sponOf(t);
  const slot=sponSlots().reduce((s,k)=>s+((sp[k]&&sp[k].amt)||0),0);
  const part=sponPartners(t).reduce((s,x)=>s+(x.amt||0),0);
  return Math.round((slot+part)*10)/10;
}
function sponPartnerTotal(t){ return Math.round(sponPartners(t).reduce((s,x)=>s+(x.amt||0),0)*10)/10; }
/* 구장 표시명 — 명명권이 팔렸으면 그 이름으로 부른다 */
function stadDisplayName(t){
  try{
    const sp=sponOf(t);
    if(sp.naming && sp.naming.n) return `${sp.naming.n} ${stadOf(t).n}`;
  }catch(e){}
  return stadOf(t).n;
}
/* ── 시즌 스폰서 정산 ────────────────────────────────────────
   ① 계약이 남았으면 한 해 깎고 그대로 간다
   ② 만료됐으면 지금 매력도로 새 계약을 맺는다 (성적이 여기서 값으로 돌아온다)
   ③ 큰 브랜드는 하나뿐이라 구단끼리 경쟁한다 — 매력도 높은 구단부터 고른다
   ④ 계약 금액은 시즌 개막에 일괄 지급된다 */
/* ═══════════════════════════════════════════════════════════════
   🤝 스폰서를 둘러싼 목소리들
   유니폼 앞가슴에 어떤 이름이 박히느냐는 팬에게 결코 사소한 문제가 아니다.
   특히 구장 이름은 — 20년을 부르던 이름이 하루아침에 기업명으로 바뀌면 반드시 싸움이 난다.
   변수 — {t}우리 {o}스폰서/상대 {m}금액 {w}구장 {s}슬롯
═══════════════════════════════════════════════════════════════ */
const SPON_SOC={
 newBig:["{o}이/가 우리 스폰서라니 ㅋㅋ 우리 팀 좀 컸다",
   "연 {m}억이면 진짜 큰 계약이다. 프런트 일했네",
   "유니폼 앞에 저 이름 박히는 거 상상하니까 설렌다","{o} 정도면 리그 상위권 대우 받는 거임",
   "이 돈이 선수 영입으로 이어지면 좋겠는데","드디어 우리도 큰 스폰서를 잡았다 ㅠㅠ",
   "{o} 로고 박힌 유니폼 나오면 무조건 산다","스폰서 규모가 곧 구단 위상이지",
   "구단이 이런 계약을 따올 줄은 몰랐다 솔직히"],
 newSmall:["새 스폰서 붙었는데 금액이 좀... 그래도 없는 것보단 낫지",
   "{o}? 처음 들어보는데 어디임","연 {m}억이면 선수 한 명 연봉인데",
   "우리 규모에 이 정도면 감사한 거다","동네 업체라도 우리를 후원해 주는 게 어디냐",
   "지역 기업이 지역 구단 밀어주는 거 나쁘지 않다고 봄","작아도 오래 갔으면 좋겠다"],
 newLocal:["{o} 사장님 우리 홈경기 매번 오시는 분이라던데 ㅋㅋ",
   "동네 가게가 스폰서라니 이게 진짜 시민구단이지","{o} 가서 밥 먹고 와야겠다 팬 도리로",
   "규모는 작아도 진심은 크다고 본다","이런 게 지역 밀착이지. 나는 좋다",
   "유니폼에 {o} 박히면 좀 웃기긴 한데 정겹다"],
 up:["스폰서가 계약을 올려줬다는데 이게 다 성적 덕이지",
   "성적 내니까 돈이 따라오네. 순리대로다","연 {m}억으로 상향. 프런트 요즘 일 잘한다",
   "{o}도 우리 가치를 인정한 거임","이 돈으로 선수 좀 사자 진짜","구단이 커지는 게 눈에 보인다"],
 down:["스폰서 금액 깎였다는데... 성적이 문제였겠지",
   "{o} 쪽에서 조건 낮췄다더라. 할 말이 없다","돈이 없으니 선수를 못 사고, 못 사니 성적이 안 나오고. 악순환",
   "이 정도 조건이면 다른 팀 절반도 안 되는데","구단 재정 걱정되기 시작한다",
   "성적으로 증명 못 하면 계속 이럴 거다"],
 quit:["스폰서가 나갔다고?? 연 {m}억이 그냥 날아간 거임",
   "{o} 빠지면 그 자리 누가 채우냐 진짜","감독님 사고 한 번에 구단 예산이 사라졌다",
   "이건 진짜 화난다. 축구를 하란 말이야","프런트가 수습 좀 해라 제발",
   "다음 시즌 유니폼 앞이 비는 거 아니냐 ㅋㅋ 웃프다","스폰서 이탈이 제일 무섭다. 돈이 마르면 다 끝이야",
   "이미지 때문에 나갔다는데 우리가 뭘 잘못했냐 진짜"],
 warn:["스폰서가 구단에 항의했다는데... 감독님 좀 조용히 하시면 안 될까요",
   "성적으로 시끄러운 건 참는데 이런 걸로 시끄러운 건 못 참겠다",
   "{o} 쪽에서 불편해한다는 기사 봤다. 이러다 진짜 빠지는 거 아님?",
   "축구 외적인 일로 뉴스 나오는 게 제일 싫다","제발 그라운드에서만 싸웁시다"],
 envy:["{o}은/는 스폰서 {m}억이라던데 우리는 뭐 하냐",
   "돈 차이가 곧 순위 차이다 진짜","부럽다는 말도 지겹다","{o} 유니폼에 박힌 이름값이 우리 예산이다",
   "우리 구단도 좀 뛰어라 제발","성적 내면 돈이 온다는데 돈이 없어서 성적을 못 낸다"],
 nameNew:["{w}이/가 {o} 이름을 달게 됐다. 솔직히 아직 입에 안 붙는다",
   "구장 이름 파는 거 반대는 안 하는데 마음이 좀 그렇다","{o} {w}... 부르기가 어색해 죽겠네",
   "돈은 필요하니까 이해한다. 이해는 하는데 서운하다","20년 부른 이름이 하루아침에 바뀌네",
   "나는 그냥 예전 이름으로 부를 거다","우리 아버지는 아직도 옛날 이름으로 부르신다",
   "명명권 판 돈으로 선수 사면 용서한다","{m}억이면... 그래 팔 만하다",
   "다른 팀도 다 하는 건데 우리만 유난 떨 필요 있나","원정 팬들이 뭐라고 부를지 벌써 궁금하다",
   "구장 이름보다 그 안에서 하는 축구가 중요하지","현수막에 뭐라고 써야 하냐 이제"],
 nameKeep:["구장 이름 안 팔았으면 좋겠는데... 결국 팔았네",
   "전통이라는 게 돈 앞에서는 별거 아니구나","이름 바뀌어도 우리 집은 우리 집이다",
   "그래도 트랙 없는 게 어디냐 하고 넘어가련다"],
 kit:["{o} 유니폼이면 원단은 괜찮겠네","{o} 킷 디자인 예쁘게 좀 뽑아주세요 제발",
   "지난 시즌 유니폼은 진짜 최악이었는데 이번엔 다르길","{o} 어웨이 킷이 벌써 기대된다",
   "유니폼 값이나 좀 내려주면 좋겠다","{o} 로고 크기 좀 줄여줬으면","{o} 사이즈 좀 넉넉하게 나왔으면"],
 partnerMany:["공식 파트너가 {n}곳이래 ㅋㅋ 보드 광고 자리 없겠다",
   "파트너 늘어나는 게 구단이 커진다는 증거지","작은 계약 많은 게 큰 계약 하나보다 안전하다고 본다",
   "연 {m}억이면 무시 못 할 돈이다","마케팅팀 요즘 발로 뛰나 보다","이런 건 칭찬해 줘야 함",
   "홈경기 갈 때마다 새 로고가 보인다 ㅋㅋ"],
 partnerLoss:["파트너들이 빠져나가는데 이거 괜찮은 거임?","{n}곳 남았다는데 작년보다 줄었다",
   "작은 스폰서부터 떨어져 나가는 게 위험 신호다","구단 영업이 안 되는 건지 우리가 매력이 없는 건지",
   "돈줄이 마르면 겨울에 선수부터 나간다"],
 kitBad:["또 이 브랜드야? 유니폼 원단이 진짜 별론데",
   "{o} 유니폼은 여름에 못 입는다 진짜","디자인은 기대 안 한다 이제"]
};
const SPON_FMK={
 newBig:[["{t} 메인 스폰서 {o}로 바뀌었네 연 {m}억이라던데",1],
   ["{m}억이면 K리그에서 상위권 계약임",1],["{t} 프런트 요즘 일 제대로 하네",1],
   ["우리 팀은 언제 저런 스폰서 잡냐",-1],["성적 나니까 스폰서가 붙는 거지 순리대로임",1],
   ["{o}이/가 축구에 돈 쓰는 거 오랜만 아님?",0],["리그 전체 스폰서 규모가 커지는 건 좋은 일",1]],
 quit:[["{t} 스폰서 중도 해지됐다는데 ㄷㄷ",-1],["감독 사고 때문이라던데 진짜냐",-1],
   ["스폰서 이탈은 구단에 치명타임",-1],["이미지 리스크라는 게 이래서 무서운 거임",-1],
   ["{t} 팬들 지금 멘탈 나갔겠다",0],["연 {m}억 구멍을 어떻게 메우려나",-1],
   ["축구 외적인 일로 이러는 거 리그 전체에 안 좋음",-1]],
 name:[["{t} 구장 이름 {o}로 바뀜",0],["명명권 판매 요즘 추세긴 함",0],
   ["팬들은 싫어할 텐데 구단은 돈이 필요하니까",0],["부르기 어려운 이름은 결국 안 불림 ㅋㅋ",0],
   ["{m}억이면 팔 만하지",1],["전통 있는 구장이었는데 좀 아깝다",-1],
   ["우리 구장도 팔아서 선수 좀 샀으면",0]],
 down:[["{t} 스폰서 금액 깎였다던데",-1],["성적이 안 나오면 이렇게 됨",-1],
   ["구단 재정 어려워지면 주축 선수 팔린다",-1],["이게 강등의 진짜 무서운 점임",-1]]
};
const SPON_RIV={
 newBig:[["{t}이/가 {m}억짜리 스폰서 잡았다던데 부럽다",0],["돈으로 순위 사는 거지 뭐",-1],
   ["우리 구단주는 이 기사 보고 있나",-1],["부럽긴 한데 성적 낸 만큼 받는 거니까",0],
   ["{o}이/가 우리한테도 좀 오지",0]],
 quit:[["{t} 스폰서 빠졌다던데 ㅋㅋ 남 얘기 같지 않다",0],["고소한데 우리도 언제 저럴지 모름",0],
   ["구단 하나 무너지는 건 순식간임",-1],["{t} 팬들 힘내라 진심으로",1]],
 name:[["{t} 구장 이름 바뀐 거 아직도 적응 안 됨",0],["원정 갈 때 뭐라고 검색해야 하냐 ㅋㅋ",0],
   ["우리 구장도 팔자 제발",0],["전통 있는 구장인데 좀 그렇다",-1]]
};
/* 스폰서 측 코멘트 — 계약서에는 사람의 말이 붙는다 */
const SPON_SAY={
 sign:['"{t}의 열정적인 팬 문화에 함께하게 되어 기쁩니다."',
   '"단순한 후원이 아니라 지역과 함께 가는 동행이라 생각합니다."',
   '"{t}이/가 아시아 무대에서 보여 준 경기력에 확신을 가졌습니다."',
   '"구단의 성장 가능성을 높이 평가했습니다. 긴 호흡으로 함께하겠습니다."',
   '"우리 브랜드와 {t}의 색이 잘 맞는다고 판단했습니다."',
   '"성적도 중요하지만, 지역 사회에서 구단이 하는 역할을 보았습니다."'],
 up:['"기대 이상의 성과를 보여 주셨습니다. 그에 맞는 대우가 필요하다고 판단했습니다."',
   '"계약 당시보다 구단의 가치가 분명히 올랐습니다."',
   '"함께 성장한다는 것이 이런 것이겠지요."'],
 down:['"내부 마케팅 예산 조정이 있었습니다. 후원은 계속됩니다."',
   '"현재 구단의 노출 규모를 다시 산정한 결과입니다."',
   '"어려운 결정이었습니다. 다음 계약 때 다시 논의하겠습니다."'],
 quit:['"브랜드가 지향하는 가치와 맞지 않는 상황이 반복되었습니다."',
   '"내부 검토 결과 후원을 지속하기 어렵다는 결론에 이르렀습니다."',
   '"팬 여러분께는 죄송하지만, 기업으로서는 불가피한 선택이었습니다."',
   '"구단의 미래를 응원합니다. 다만 함께할 수는 없게 되었습니다."'],
 name:['"이 구장이 지역의 자랑으로 오래 남기를 바랍니다."',
   '"팬 여러분께서 부르시던 이름의 무게를 알고 있습니다. 조심스럽게 함께하겠습니다."',
   '"명칭은 바뀌어도 이곳에서 만들어질 이야기는 그대로일 것입니다."']
};
/* 남의 구단 스폰서 — 큰 계약은 리그의 이야깃거리가 된다 */
function sponRivalNews(order){
  const ut=userTeam(); if(!ut) return;
  const top=(order||[]).filter(id=>G.teams[id] && !G.teams[id].isUser).slice(0,3);
  for(const id of top){
    const t=G.teams[id], sp=sponOf(t);
    if(!sp.main || sp.main.since!==G.season) continue;
    if(Math.random()>0.55) continue;
    const mine=sponOf(ut).main;
    const gap=mine ? Math.round((sp.main.amt-mine.amt)*10)/10 : 0;
    try{
      pushFeed({cat:"club", ic:"🤝", tone:(ut.div===t.div?-1:0), tid:t.id, src:pick(MEDIA),
        head:`${t.name}, ${sp.main.n}과/와 메인 스폰서 계약 — 연 ${sp.main.amt}억`,
        sub:`${divName(t.div)} ${t.short}이/가 리그 상위권 스폰서십을 확보했다.`
          + (gap>0?` 우리 구단 계약보다 ${gap}억 많다.`:"")});
    }catch(e){}
    if(ut.div===t.div && gap>0 && Math.random()<0.6){
      try{ socialFill(SPON_SOC.envy, 1+R(2), -1, {t:ut.short, o:t.short, m:sp.main.amt}); }catch(e){}
      try{ if(Math.random()<0.5) fmkFill(SPON_FMK.newBig, 1+R(2), {t:t.short, o:sp.main.n, m:sp.main.amt}); }catch(e){}
    }
  }
}
function sponSeason(){
  const order=Object.keys(G.teams||{}).sort((a,b)=>sponAppeal(G.teams[b])-sponAppeal(G.teams[a]));
  const news=[];
  for(const id of order){
    const t=G.teams[id]; if(!t) continue;
    const sp=sponOf(t);
    for(const slot of sponSlots()){
      const cur=sp[slot];
      if(cur && cur.left>1){
        cur.left--;
        /* 성적이 계약 기간 중에 크게 달라지면 스폰서도 가만있지 않는다 */
        const want=sponValue(t, slot);
        if(want > cur.amt*1.45 && Math.random()<0.55){
          const add=Math.round((want-cur.amt)*0.5*10)/10;
          cur.amt=Math.round((cur.amt+add)*10)/10; cur.left++;
          if(t.isUser) news.push({k:"up", slot, n:cur.n, amt:cur.amt, add});
        } else if(want < cur.amt*0.62 && Math.random()<0.45){
          const cut=Math.round((cur.amt-want)*0.45*10)/10;
          cur.amt=Math.max(0.3, Math.round((cur.amt-cut)*10)/10);
          if(t.isUser) news.push({k:"down", slot, n:cur.n, amt:cur.amt, cut});
        }
        continue;
      }
      const old=cur;
      const fresh=sponSign(t, slot);
      if(!fresh){ delete sp[slot]; continue; }
      /* 재계약 — 같은 브랜드가 남을 수 있다. 다만 구단의 급이 달라졌으면 스폰서도 바뀐다
         (동네 상호저축은행이 아시아 챔피언의 유니폼 앞가슴을 계속 차지하고 있으면 어색하다) */
      if(old && old.tier===fresh.tier && Math.random()<0.45){ fresh.n=old.n; }
      sp[slot]=fresh;
      if(t.isUser){
        const changed = !old || old.n!==fresh.n;
        news.push({k: (!old || changed) ? "new" : (fresh.amt>=old.amt?"renewUp":"renewDown"),
                   slot, n:fresh.n, amt:fresh.amt, old:old?old.amt:0, yrs:fresh.yrs,
                   prev: old?old.n:null});
      }
    }
  }
  /* 🤝 파트너 스폰서 — 만료된 곳은 떠나고, 매력도가 허락하는 만큼 새로 들어온다 */
  for(const id in G.teams){
    const t=G.teams[id]; if(!t) continue;
    const ps=sponPartners(t);
    let gone=0;
    for(let i=ps.length-1;i>=0;i--){ ps[i].left--; if(ps[i].left<=0){ ps.splice(i,1); gone++; } }
    const target=sponPartnerTarget(t);
    let added=0;
    const usedK={}; ps.forEach(x=>usedK[x.n]=1);
    while(ps.length<target && added<24){
      const kind=pick(SPON_PARTNER_KIND);
      const tier=clamp(sponTierOf(sponAppeal(t))+ (Math.random()<0.55?1:0), 1, 3);
      const pool=sponBrandPool(tier,"brand").filter(n=>!usedK[n] && !sponUsedNames()[n]);
      const nm = pool.length ? pick(pool) : sponLocalName(t, usedK);
      usedK[nm]=1;
      ps.push({n:nm, amt:sponPartnerValue(t, kind), yrs:1+R(3), left:1+R(3), kind:kind.k});
      added++;
    }
    /* 매력도가 떨어졌으면 자리가 남아도 파트너가 먼저 빠진다 */
    while(ps.length>target+2) ps.pop();
    if(t.isUser && (added||gone)) G._sponPartnerDelta={added, gone, total:ps.length};
  }
  /* 수입 지급 — 시즌 개막에 일괄 */
  for(const id in G.teams){
    const t=G.teams[id], amt=sponTotal(t);
    if(amt<=0) continue;
    if(t.isUser){
      const fin=finLedger(t);
      fin.spon=Math.round(((fin.spon||0)+amt)*100)/100;
      t.budget=Math.round((t.budget+amt*BUD_SHARE)*10)/10;
    } else {
      t.budget=Math.round((t.budget+amt*BUD_SHARE*0.9)*10)/10;
    }
  }
  try{ sponNews(news); }catch(e){}
  try{ sponRivalNews(order); }catch(e){}
  if(G.sponHeat) G.sponHeat=Math.max(0, G.sponHeat-1);   // 사건의 열기는 한 시즌 지나면 식는다
}
/* 우리 구단 스폰서 소식 — 계약 하나하나가 이야깃거리다 */
function sponNews(list){
  const t=userTeam(); if(!t || !list || !list.length) return;
  const tot=sponTotal(t);
  const bigCut=Math.max(12, sponValue(t,"main")*0.75);        // 「큰 계약」의 기준은 구단 규모마다 다르다
  for(const x of list){
    const S=SPON_SLOT[x.slot];
    const V={t:t.short, o:x.n, m:x.amt, w:(function(){ try{ return stadOf(t).n; }catch(e){ return "홈구장"; } })(), s:S.n};
    const local=/^\S+\s/.test(x.n) && x.n.indexOf(t.short)===0;
    if(x.k==="new"){
      const big = x.slot==="main" && x.amt>=bigCut;
      addNews(`${S.ic} <b>${x.n}</b>, ${t.short} ${S.n} 계약 — 연 <b>${x.amt}억</b> · ${x.yrs}년`
        +(x.prev?` <span class="small">(이전 ${x.prev})</span>`:"")+`<br>`
        +`<span class="small">${fixJosa(pick(x.slot==="naming"?SPON_SAY.name:SPON_SAY.sign).replace(/\{t\}/g, t.short))}</span>`, "good", "club");
      try{
        pushFeed({cat:"club", ic:S.ic, tone:1, tid:t.id, src:pick(MEDIA),
          head:`${t.name}, ${x.n}과/와 ${S.n} 계약`,
          sub:`연 ${x.amt}억 · ${x.yrs}년 조건이다. ${x.slot==="naming"?`홈구장은 ${x.n} ${V.w}(으)로 불리게 된다.`:`${S.d}에 ${x.n} 로고가 들어간다.`}`});
      }catch(e){}
      if(x.slot==="naming"){
        socialFill(SPON_SOC.nameNew, 3+R(3), 0, V);
        if(Math.random()<0.6) socialFill(SPON_SOC.nameKeep, 1+R(2), -1, V);
        fmkFill(SPON_FMK.name, 2+R(2), V); rivalFill(SPON_RIV.name, 1+R(2), 0, V);
      } else if(x.slot==="kit"){
        socialFill(Math.random()<0.72?SPON_SOC.kit:SPON_SOC.kitBad, 2+R(2), 0, V);
      } else if(big){
        socialFill(SPON_SOC.newBig, 3+R(2), 1, V);
        fmkFill(SPON_FMK.newBig, 2+R(3), V); rivalFill(SPON_RIV.newBig, 1+R(2), 0, V);
        try{ adjustTrust("owner", 3, `${x.n} ${S.n} 유치`); }catch(e){}
      } else {
        socialFill(local?SPON_SOC.newLocal:SPON_SOC.newSmall, 2+R(2), local?1:0, V);
      }
    } else if(x.k==="renewUp" || x.k==="up"){
      const add=x.k==="up" ? ` (+${x.add}억)` : (x.old?` <span class="small">${x.old}억 → ${x.amt}억</span>`:"");
      addNews(`${S.ic} <b>${x.n}</b>, ${S.n} ${x.k==="up"?"계약 상향":"재계약"} — 연 <b>${x.amt}억</b>${add}<br>`
        +`<span class="small">${fixJosa(pick(SPON_SAY.up).replace(/\{t\}/g, t.short))}</span>`, "good", "club");
      socialFill(SPON_SOC.up, 2+R(2), 1, V);
      try{ adjustTrust("owner", 2, "스폰서 계약 상향"); }catch(e){}
    } else if(x.k==="renewDown" || x.k==="down"){
      const cut=x.k==="down" ? ` (−${x.cut}억)` : (x.old?` <span class="small">${x.old}억 → ${x.amt}억</span>`:"");
      addNews(`${S.ic} <b>${x.n}</b>, ${S.n} 조건 하향 — 연 ${x.amt}억${cut}<br>`
        +`<span class="small">${pick(SPON_SAY.down)}</span>`, "warn", "club");
      socialFill(SPON_SOC.down, 2+R(2), -1, V);
      fmkFill(SPON_FMK.down, 1+R(2), V);
      try{ adjustTrust("owner", -2, "스폰서 계약 하향"); }catch(e){}
    }
  }
  /* 파트너 — 개수가 곧 영업 성과다 */
  const D=G._sponPartnerDelta; G._sponPartnerDelta=null;
  if(D){
    const ps=sponPartners(t), pt=sponPartnerTotal(t);
    const sample=ps.slice(0,3).map(x=>{
      const K=SPON_PARTNER_KIND.find(k=>k.k===x.kind)||{ic:"🤝",n:"파트너"};
      return `${K.ic} ${x.n}`;
    }).join(" · ");
    if(D.added) addNews(`🤝 <b>공식 파트너 ${D.added}곳 신규 유치</b> — 총 ${D.total}곳 · 연 ${pt}억<br><span class="small">${sample}${ps.length>3?` 외 ${ps.length-3}곳`:""}</span>`, "good", "club");
    if(D.gone && !D.added) addNews(`📉 공식 파트너 ${D.gone}곳이 재계약하지 않았습니다 — 남은 파트너 ${D.total}곳 · 연 ${pt}억`, "warn", "club");
    try{
      if(D.added>=4) socialFill(SPON_SOC.partnerMany, 2+R(2), 1, {t:t.short, n:D.total, m:pt});
      else if(D.gone>D.added) socialFill(SPON_SOC.partnerLoss, 1+R(2), -1, {t:t.short, n:D.total});
    }catch(e){}
  }
  addNews(`🤝 ${G.season} 스폰서 수입 합계 <b>${tot}억</b> <span class="small">(구단 매력도 ${sponAppeal(t)} · 파트너 ${sponPartners(t).length}곳)</span>`, "info", "club");
}
/* 🚨 감독 사건 — 스폰서는 이미지에 민감하다. 열기가 쌓이면 계약이 흔들린다 */
function sponScandal(reason, weight){
  const t=userTeam(); if(!t) return;
  G.sponHeat=clamp((G.sponHeat||0)+(weight||1), 0, 6);
  const sp=sponOf(t);
  const slots=sponSlots().filter(k=>sp[k]);
  if(!slots.length) return;
  const heat=G.sponHeat;
  /* 큰 계약보다 작은 파트너가 먼저 조용히 떠난다 — 이탈은 늘 아래부터 시작된다 */
  const ps=sponPartners(t);
  if(ps.length && Math.random()<0.55){
    const n=Math.min(ps.length, 1+R(Math.max(1,Math.round(heat/2))));
    const lost=ps.splice(ps.length-n, n);
    const amt=Math.round(lost.reduce((s,x)=>s+x.amt,0)*10)/10;
    if(amt>0){
      addNews(`📉 공식 파트너 <b>${n}곳</b>이 "${reason}" 이후 후원을 철회했습니다 — 연 ${amt}억 감소 (남은 파트너 ${ps.length}곳)`, "warn", "club");
      try{ socialFill(SPON_SOC.partnerLoss, 1+R(2), -1, {t:t.short, n:ps.length}); }catch(e){}
    }
  }
  if(heat>=5 && Math.random()<0.42){
    /* 💔 중도 해지 — 구단 살림에 구멍이 나고, 그 구멍은 감독이 낸 것이다 */
    const k=pick(slots), s=sp[k], S=SPON_SLOT[k];
    delete sp[k];
    const V={t:t.short, o:s.n, m:s.amt, s:S.n};
    addNews(`💔 <b>${s.n}</b>, ${S.n} 계약 <b>중도 해지</b> — "${reason}" 이후 브랜드 이미지 훼손을 이유로 들었습니다. (연 ${s.amt}억 손실)<br>`
      +`<span class="small">${pick(SPON_SAY.quit)}</span>`, "warn", "club");
    try{
      pushFeed({cat:"club", ic:"💔", tone:-1, tid:t.id, src:pick(MEDIA),
        head:`${s.n}, ${t.name} 후원 중단 — 연 ${s.amt}억 계약 해지`,
        sub:`"${reason}"이/가 결정적이었다는 것이 업계의 시각이다. 구단은 대체 스폰서를 찾아야 하는 처지에 놓였다.`});
    }catch(e){}
    socialFill(SPON_SOC.quit, 3+R(3), -1, V);
    fmkFill(SPON_FMK.quit, 2+R(3), V);
    rivalFill(SPON_RIV.quit, 1+R(2), 0, V);
    try{ adjustTrust("owner", -8, `${s.n} 후원 중단`); }catch(e){}
    try{ adjustTrust("fans", -4, "스폰서 이탈"); }catch(e){}
    try{ t.morale=clamp((t.morale||70)-2, 40, 99); }catch(e){}
    G.sponQuitPing={n:s.n, amt:s.amt, slot:k, s:G.season};   // 기자회견에서 반드시 나온다
  } else if(heat>=3 && Math.random()<0.5){
    const k=pick(slots), s=sp[k], S=SPON_SLOT[k];
    const cut=Math.max(0.3, Math.round(s.amt*0.18*10)/10);
    s.amt=Math.round((s.amt-cut)*10)/10;
    const V={t:t.short, o:s.n, m:s.amt, s:S.n};
    addNews(`⚠️ <b>${s.n}</b>, "${reason}"을/를 문제 삼아 후원 규모를 줄였습니다 — 연 ${s.amt}억 (−${cut}억)<br>`
      +`<span class="small">${pick(SPON_SAY.down)}</span>`, "warn", "club");
    socialFill(SPON_SOC.warn, 1+R(2), -1, V);
    if(Math.random()<0.5) fmkFill(SPON_FMK.down, 1+R(2), V);
    try{ adjustTrust("owner", -3, "스폰서 후원 축소"); }catch(e){}
  } else if(Math.random()<0.55){
    const s=sp[pick(slots)];
    addNews(`📞 <b>${s.n}</b> 홍보팀이 구단에 우려를 전달했습니다 — "${reason}". 다음 계약에 영향이 있을 수 있습니다.`, "warn", "club");
    socialFill(SPON_SOC.warn, 1+R(2), -1, {t:t.short, o:s.n});
  }
}
/* AI 구단도 홈경기 수입으로 살림을 꾸린다 — 안 그러면 이적시장이 말라붙는다 */
function aiMatchIncome(M){
  for(const [t,isH] of [[M.home,true],[M.away,false]]){
    if(t.isUser) continue;
    let inc=(TV_ROUND[t.div]||0.25);
    if(isH) inc+=gateRevenue(t, M.att||0);
    t.budget=Math.round((t.budget+inc*BUD_SHARE)*10)/10;
    updateHype(t, isH?M.hg:M.ag, isH?M.ag:M.hg, isH);
  }
}
/* 라운드를 실제 날짜에 배치한다. 기본 주 1경기, 가끔 미드위크, 가끔 휴식기. */
function buildCalendar(nRounds){
  const y=G.season;
  const start=new Date(y, CAL_START[0], CAL_START[1]);
  // 개막은 3월 첫 주말(일요일)로 맞춘다 — 1월 1일부터 세었을 때 며칠째인지 구한다
  const openRaw=new Date(y, SEASON_OPEN[0], SEASON_OPEN[1]);
  while(openRaw.getDay()!==0) openRaw.setDate(openRaw.getDate()+1);
  const OPEN_OFF=Math.round((openRaw-start)/86400000);
  // 개막일(일요일)에서 출발해 주말 축을 지킨다. 미드위크는 일→수(+3), 수→일(+4)로 한 주에 흡수한다.
  // 라운드마다 요일이 조금씩 달라야 관중 수도 달라진다 — 일요일을 기본으로 두고
  // 일부 라운드를 토요일(-1)·금요일(-2)로 당긴다. 앞뒤 라운드와 최소 4일은 띄운다.
  /* 14팀 체제(2027~)는 달력 라운드가 40개로 늘어난다 — 주중 2연전을 더 자주 넣어
     실제 K리그처럼 11월 안에 시즌을 끝낸다. (제보 — "K리그는 11월까지 경기하거든") */
  const dense = nRounds>=44;
  const midEvery = dense?5:6, brkEvery = dense?10:9;
  const roundDay=[]; let d=OPEN_OFF, mid=false; const gaps=[];
  for(let r=0;r<nRounds;r++){
    roundDay.push(d);
    let gap;
    if(mid){ gap=4; mid=false; }                              // 수요일 경기 뒤 → 다시 일요일
    else if(r>0 && r%brkEvery===brkEvery-1) gap=14;           // A매치 휴식기 — 2주 공백
    else if(r>0 && r%midEvery===midEvery-1){ gap=3; mid=true; } // 일요일 → 수요일 (주중 2연전)
    else gap=7;
    gaps.push(gap); d+=gap;
  }
  for(let r=1;r<roundDay.length;r++){
    const prevGap=gaps[r-1], nextGap=gaps[r]||7;
    if(prevGap<7 || nextGap<7) continue;                       // 미드위크 앞뒤는 건드리지 않는다
    const k=(r*7+G.season)%10;
    const off = k<2 ? -2 : k<5 ? -1 : 0;                       // 금 20% · 토 30% · 일 50%
    if(off && prevGap+off>=5) roundDay[r]+=off;
  }
  G.cal={y, open:`${y}-${String(CAL_START[0]+1).padStart(2,"0")}-${String(CAL_START[1]).padStart(2,"0")}`,
         roundDay, last:d, openOff:OPEN_OFF};
  G.day=0;
  buildPreseason();
}
/* ── 프리시즌 연습경기 ────────────────────────────────────────
   1월 중순부터 개막 전주까지, 다른 구단들과 연습경기를 잡는다.
   순위표에는 반영되지 않지만 체력·전술 적응도·컨디션·사기는 진짜 경기처럼 움직인다. */
function buildPreseason(){
  const ut=userTeam(); if(!ut || !G.cal) return;
  const openOff=G.cal.openOff||0;
  const pool=Object.keys(G.teams).filter(id=>id!==ut.id);
  // 하위 리그·약체부터 시작해 개막이 가까울수록 강한 상대 — 실제 프리시즌 구성과 같다
  pool.sort((a,b)=>teamOVR(G.teams[a])-teamOVR(G.teams[b]));
  const picks=[];
  const seg=Math.max(1, Math.floor(pool.length/PRE_FRIENDLY_N));
  for(let i=0;i<PRE_FRIENDLY_N;i++){
    const lo=i*seg, hi=Math.min(pool.length-1, lo+seg-1);
    picks.push(pool[lo+R(Math.max(1,hi-lo+1))] || pool[R(pool.length)]);
  }
  let d=PRE_FIRST_MIN, nFr=PRE_FRIENDLY_N;
  /* 🌍 CWC 참가 시즌 — 1월이 통째로 대회다. 연습경기는 결승이 끝난 뒤로 밀고 개수도 줄인다.
     (cwcSetup 이 대회를 편성한 뒤 이 함수를 한 번 더 부른다 — 그때 날짜를 알 수 있다) */
  try{ if(cwcMine()){ nFr=2; d=Math.max(d, (G.cwc.day.f||30)+4); } }catch(e){}
  while(dayOfWeekOf(d)!==0) d++;                  // 첫 일요일로 맞춘다
  const list=[];
  for(let i=0;i<nFr;i++){
    if(d>=openOff-3) break;                       // 개막 3일 전부터는 잡지 않는다
    list.push({d, oppId:picks[i], home:i%2===0, done:false, hg:0, ag:0});
    d+=PRE_GAP;
  }
  G.friendlies=list;
  G.phase="pre";
}
/* ═══════════════════════════════════════════════════════════════════════════
   🌱 프리시즌 연습경기 편성 — 감독이 직접 짠다
   ⚠ 제보 — 「친선경기가 4개로 고정이고 날짜·상대·장소를 고를 수 없다.
      체력을 아끼려 적게 잡을지, 조직력을 위해 많이 잡을지 감독이 정할 수 있어야 한다.」
   ─ 기본 일정은 그대로 깔아 두되(아무것도 안 해도 굴러가게), 전부 편집할 수 있게 한다.
     · 최대 8경기 · 경기 사이 최소 사흘 · 개막 사흘 전부터는 잡지 않는다
     · 같은 구단과는 두 번까지
     · 치른 경기와 사흘 안으로 다가온 경기는 취소할 수 없다
   ═══════════════════════════════════════════════════════════════════════════ */
const PRE_FR_MAX=8;        // 최대 편성 수
const PRE_FR_GAP=3;        // 경기 사이 최소 간격(일)
const PRE_FR_LOCK=3;       // 며칠 앞으로 다가오면 취소 불가
function preOpenOff(){ return (G.cal&&G.cal.openOff)||0; }
function preSlotDays(){
  const out=[], end=preOpenOff()-3;
  for(let d=Math.max(1,(G.day||0)+1); d<=end; d++) out.push(d);
  return out;
}
function preSlotOK(d, ignoreIdx){
  if(G.phase!=="pre") return "프리시즌에만 편성할 수 있습니다.";
  d=+d;
  if(!(d>0)) return "날짜를 고르세요.";
  if(d<=(G.day||0)) return "이미 지난 날짜입니다.";
  if(d>preOpenOff()-3) return "개막 사흘 전부터는 연습경기를 잡지 않습니다.";
  const list=(G.friendlies||[]);
  for(let i=0;i<list.length;i++){
    if(i===ignoreIdx) continue;
    if(Math.abs(list[i].d-d)<PRE_FR_GAP)
      return `앞뒤로 사흘은 비워야 합니다 (${dateLabel(list[i].d)} 경기와 너무 가깝습니다).`;
  }
  return null;
}
function preAddOK(oppId, d){
  const list=(G.friendlies||[]);
  if(list.length>=PRE_FR_MAX) return `연습경기는 최대 ${PRE_FR_MAX}경기까지 잡을 수 있습니다.`;
  if(!oppId || !G.teams[oppId]) return "상대 구단을 고르세요.";
  if(oppId===G.userTeamId) return "우리 구단과는 경기할 수 없습니다.";
  if(list.filter(f=>f.oppId===oppId).length>=2) return `${G.teams[oppId].short}과의 연습경기는 두 번까지입니다.`;
  return preSlotOK(d);
}
function preAdd(){
  const why=preAddOK(PREF.opp, PREF.d);
  if(why){ flash(why,"warn"); return; }
  (G.friendlies=G.friendlies||[]).push({d:+PREF.d, oppId:PREF.opp, home:!!PREF.home, done:false, hg:0, ag:0, user:1});
  G.friendlies.sort((a,b)=>a.d-b.d);
  const o=G.teams[PREF.opp];
  flash(`🌱 ${dateLabel(+PREF.d)} · ${o.short} (${PREF.home?"홈":"원정"}) 연습경기를 잡았습니다.`,"good");
  PREF.opp="";
  saveGame(); show("fixtures");
}
function preDel(i){
  const list=G.friendlies||[], f=list[i]; if(!f) return;
  if(f.done){ flash("이미 치른 경기입니다.","warn"); return; }
  if(f.d-(G.day||0)<PRE_FR_LOCK){ flash(`경기 ${PRE_FR_LOCK}일 전부터는 취소할 수 없습니다 — 상대 구단도 준비를 마쳤습니다.`,"warn"); return; }
  const o=G.teams[f.oppId];
  list.splice(i,1);
  flash(`🚫 ${o?o.short:"상대"}전 연습경기를 취소했습니다.`,"warn");
  saveGame(); show("fixtures");
}
function preFlip(i){
  const f=(G.friendlies||[])[i]; if(!f) return;
  if(f.done || f.d-(G.day||0)<PRE_FR_LOCK){ flash("경기가 임박해 장소를 바꿀 수 없습니다.","warn"); return; }
  f.home=!f.home; saveGame(); show("fixtures");
}
function preClearAll(){
  const list=G.friendlies||[];
  const keep=list.filter(f=>f.done || f.d-(G.day||0)<PRE_FR_LOCK);
  const n=list.length-keep.length;
  if(!n){ flash("취소할 수 있는 경기가 없습니다.","warn"); return; }
  showConfirm(`<b>🚫 예정된 연습경기 ${n}경기를 모두 취소합니다</b>\n\n`+
    `<span class="small">체력은 아끼지만 <b>전술 조직력</b>이 그만큼 덜 오릅니다. 개막전에서 손발이 안 맞을 수 있습니다.</span>`,
    ()=>{ G.friendlies=keep; saveGame(); show("fixtures"); flash(`🚫 연습경기 ${n}경기를 취소했습니다.`,"warn"); },
    {okLabel:"모두 취소", cancelLabel:"그대로 둔다"});
}
function preAuto(){
  showConfirm(`<b>🎲 연습경기를 자동으로 다시 짭니다</b>\n\n`+
    `<span class="small">약체부터 시작해 개막이 가까울수록 강한 상대를 만나는 기본 구성(4경기)입니다. 지금 잡아 둔 일정은 사라집니다.</span>`,
    ()=>{ const kept=(G.friendlies||[]).filter(f=>f.done);
      buildPreseason();
      const seen=new Set(kept.map(f=>f.d));
      G.friendlies=[...kept, ...(G.friendlies||[]).filter(f=>f.d>(G.day||0) && !seen.has(f.d))].sort((a,b)=>a.d-b.d);
      saveGame(); show("fixtures"); flash("🎲 기본 일정으로 다시 짰습니다.","good"); },
    {okLabel:"다시 짠다", cancelLabel:"취소"});
}
let PREF={d:0, opp:"", home:true};
function preSet(k,v){ PREF[k]=(k==="d")?(+v||0):v; show("fixtures"); }
function dayOfWeekOf(i){
  const st=new Date(G.cal?G.cal.y:G.season, CAL_START[0], CAL_START[1]);
  st.setDate(st.getDate()+i); return st.getDay();
}
function friendlyDays(){ return (G.friendlies||[]).map(f=>f.d); }
function nextFriendly(){ return (G.friendlies||[]).find(f=>!f.done) || null; }
function friendlyOn(i){ return (G.friendlies||[]).find(f=>f.d===i && !f.done) || null; }
/* 프리시즌이 끝났는지 — 연습경기를 다 치렀고 개막일에 도달했으면 리그로 넘어간다 */
/* 연습경기를 한 경기 치렀다 — 경기 단위 징계(ban)가 흘러간다 */
/* ⚠ 제보 원문 — 「친선 경기끼리도 출장 정지 기록을 공유하지 않게 해 달라」.
   예전에는 연습경기를 치를 때마다 리그 출장정지를 한 경기씩 깎았다(tickBanInj).
   친선은 공식 경기가 아니다 — 징계를 만들지도, 소진시키지도 않는다.
   ─ 리그 정지는 리그 라운드로만, 대회 정지는 그 대회 경기로만 흘러간다. */
function preFriendlyPlayed(){
  /* 아무것도 하지 않는다 — 친선경기는 어떤 장부에도 손대지 않는다 (제보) */
}
function checkPreseasonEnd(){
  if(G.phase!=="pre") return;
  const openOff=(G.cal&&G.cal.openOff)||0;
  if((G.day||0) < openOff-1) return;
  G.phase="league";
  for(const id in G.teams) closeSeasonTickets(G.teams[id]);   // 개막했는데 창구가 열려 있으면 안 된다
  for(const f of (G.friendlies||[])) f.done=true;
  const rec=(G.friendlies||[]).reduce((a,f)=>{
    const mine=f.home?f.hg:f.ag, his=f.home?f.ag:f.hg;
    if(mine>his) a[0]++; else if(mine===his) a[1]++; else a[2]++; return a; }, [0,0,0]);
  addNews(`🏁 프리시즌 종료 — 연습경기 ${rec[0]}승 ${rec[1]}무 ${rec[2]}패. ${G.season} 시즌 개막이 코앞입니다.`);
}
function calOpenDate(){ const [Y,M,D]=(G.cal&&G.cal.open||"2026-03-01").split("-").map(Number); return new Date(Y,M-1,D); }
function dateOfDay(i){ const t=calOpenDate(); t.setDate(t.getDate()+i); return t; }
function dayOfWeek(i){ return dateOfDay(i).getDay(); }
function dateLabel(i){ const t=dateOfDay(i); return `${t.getMonth()+1}/${t.getDate()}(${DOW_KR[t.getDay()]})`; }
function userRoundNow(){ return userTeam().div===1?G.r1:G.r2; }
/* 내 부(部)에 남은 라운드 수 */
function userFixCount(){ try{ const t=userTeam(); return ((t.div===1?G.k1Fix:G.k2Fix)||[]).length; }catch(e){ return 0; } }
function userSeasonOver(){ return userRoundNow() >= userFixCount(); }
/* ═══ ⚠ 제보 — 「날짜가 넘어가지 않고 라운드만 계속 진행되어 선수 체력이 갈린다」 ═════════
   원인: 두 부의 라운드 수가 다르다(K1 33+스플릿 5 = 38 · K2 34).
     · 리그 라운드는 completeRound 안에서만 진행된다 — 유저가 경기를 치러야 다른 부도 한 라운드 나간다.
     · 그런데 유저 부의 일정이 먼저 끝나면 findUserFixture 가 null 이 되고, playRound 도
       `r>=fix.length` 로 그냥 돌아온다. G.r2 는 영원히 그 자리.
     · atMatchDay 는 `G.day>=matchDayOf(G.r2)` 만 보고 있어서 매일 true — 날짜가 하루도 안 넘어간다.
     · 그 상태로 「라운드 진행」을 누르면 다른 부 라운드만 계속 돌아가고, 그때마다 훈련·체력 처리가
       같은 날짜에 반복된다.
   ─ ① 내 일정이 끝났으면 atMatchDay 를 멈춘다
     ② 대신 남은 부의 라운드를 「그 라운드 날짜가 되면」 하루씩 진행한다 */
function tickOtherDivRounds(){
  if(G.phase!=="league" || !G.cal) return 0;
  const ut=userTeam(); if(!ut) return 0;
  /* ⚠ K리그1 은 정규 33라운드 뒤에 파이널 라운드 5경기가 붙는다. 스플릿이 아직 안 갈렸으면
     내 일정이 끝난 것처럼 보인다 — 여기서 먼저 갈라 준다(안 그러면 33라운드에서 시즌이 멈춘다). */
  try{ if(!G.splitDone && G.r1>=splitAt()) makeSplit(); }catch(e){}
  /* 어느 부를 날짜에 맞춰 굴릴 것인가
       · 무직        — 내가 치를 경기가 없다. 두 부 모두 리그가 알아서 굴러간다
       · 내 일정 종료 — 남은 부만
       · 그 밖        — 내가 경기를 치를 때 completeRound 가 함께 굴린다 */
  const divs = G.jobless ? [1,2] : (userSeasonOver() ? [ut.div===1?2:1] : []);
  if(!divs.length) return 0;
  let played=0, guard=0;
  for(const d of divs){
    const fx=(d===1?G.k1Fix:G.k2Fix)||[];
    while(guard++<14){
      const r = d===1?G.r1:G.r2;
      if(r>=fx.length) break;
      if(G.day < matchDayOf(r)) break;
      playRound(d, false);
      played++;
      try{ if(!G.splitDone && G.r1>=splitAt()) makeSplit(); }catch(e){}
      /* 내 부가 아니어도 라운드가 지나면 징계·부상 시계는 흐른다 */
      try{ if(d===((userTeam()||{}).div)) tickBanInj({inj:true, ban:true}); }catch(e){}
    }
  }
  if(played){
    try{ if(!G.splitDone && G.r1>=splitAt()) makeSplit(); }catch(e){}
    const k1done=G.r1>=(G.k1Fix||[]).length, k2done=G.r2>=(G.k2Fix||[]).length;
    try{ checkTitleClinch(); }catch(e){}
    if(k1done && k2done && G.phase==="league"){
      G.phase="po"; G.poQueue=buildPOQueue();
      addNews("⚔️ 정규리그 종료! 승강 플레이오프가 시작됩니다.");
    }
  }
  return played;
}
function matchDayOf(r){ const rd=(G.cal&&G.cal.roundDay)||[]; return rd[r]!==undefined?rd[r]:r*7; }
/* ⚠ 제보 — 「'다음 경기까지 N일'이 EACL과 연습경기를 무시하고 리그만 세고 있다」.
   실제로 그랬다. matchDayOf(userRoundNow()) 은 리그 라운드일만 보는 함수라,
   사흘 뒤에 EACL 8강이 잡혀 있어도 화면에는 「다음 경기까지 11일」이라고 떴다.
   세 대회를 한 줄에 세워 놓고 가장 먼저 오는 경기를 돌려준다. */
function nextUserMatch(from){
  const d0 = (from!=null ? from : (G.day||0));
  let t=null; try{ t=userTeam(); }catch(e){}
  const rd=(G.cal&&G.cal.roundDay)||[];
  const fix = t ? (t.div===1?G.k1Fix:G.k2Fix) : null;
  /* 라운드일이라도 그 라운드에 내 경기가 없으면(부전승·홀수 팀) 경기일이 아니다 */
  const lgOn=(i)=>{
    if(G.jobless || !t) return false;
    const r=rd.indexOf(i); if(r<0) return false;
    const row=fix && fix[r]; if(!row) return false;
    return row.some(m=>m && (m[0]===t.id || m[1]===t.id));
  };
  for(let i=d0; i<=d0+200; i++){
    try{ if(cwcMyDay(i)) return {d:i, left:i-d0, kind:"cwc", tag:cwcShort()}; }catch(e){}
    if((G.friendlies||[]).some(x=>x.d===i && !x.done)) return {d:i, left:i-d0, kind:"friendly", tag:"연습경기"};
    try{ if(isEaclDay(i)) return {d:i, left:i-d0, kind:"eacl", tag:eaclShort()}; }catch(e){}
    if(lgOn(i)) return {d:i, left:i-d0, kind:"league", tag:"리그"};
  }
  return null;
}
/* 가장 최근에 경기가 있었던 날 — 진행 막대의 시작점 */
function lastUserMatchDay(){
  const d0=G.day||0;
  for(let i=d0-1; i>=Math.max(0,d0-45); i--){ try{ if(isMatchDayAny(i)) return i; }catch(e){} }
  return Math.max(0, d0-14);
}
/* ⚠ 제보 — 「EACL 경기 전날인데 훈련이 잡힌다」.
   이 함수가 리그 라운드일과 연습경기만 보고 있어서, 대회 경기일은 그냥 평일로 취급됐다.
   경기 다음 날 회복도, 경기 전날 휴식도 대회에는 걸리지 않았다. */
function isMatchDay(i){
  if(((G.cal&&G.cal.roundDay)||[]).indexOf(i)>=0) return true;
  if((G.friendlies||[]).some(f=>f.d===i && !f.done)) return true;
  try{ if(cwcMyDay(i)) return true; }catch(e){}   // 🌍 1월 CWC 도 경기일이다 (내 경기가 있는 날만)
  return isEaclDay(i);
}
/* 경기가 「있었거나 있을」 날 — 이미 치른 경기도 하루는 몸에 남는다.
   ⚠ 제보 — 「경기 바로 다음 날은 무조건 휴식이어야 한다」.
     끝난 경기를 빼고 세다 보니, 연습경기·대회 경기 다음 날에는 회복일이 통째로 사라졌다
     (리그는 날짜 목록으로 세어서 멀쩡했다). 다음 날 판정에는 이쪽을 쓴다. */
function isMatchDayAny(i){
  if(((G.cal&&G.cal.roundDay)||[]).indexOf(i)>=0) return true;
  if((G.friendlies||[]).some(f=>f.d===i)) return true;
  try{ if(cwcMyDay(i)) return true; }catch(e){}
  return isEaclDay(i, true);
}
/* 아직 대회에서 살아 있는가 — 리그 스테이지 통과 여부가 확정되기 전에도 「남아 있다」고 본다 */
function eaclUserAliveNow(){
  try{
    if(!eaclOn() || G.jobless) return false;
    const me=G.userTeamId;
    if(!G.eacl || (G.eacl.teams||[]).indexOf(me)<0) return false;
    const K=G.eacl.ko||{};
    const st=G.eacl.stage;
    if(st==="end") return false;
    if(st==="draw"||!st) return true;                       // 아직 조별리그 — 가능성은 열려 있다
    for(const k of ["qf","sf","f"]){
      const ties = k==="f" ? [K.f] : (K[k]||[]);
      if((ties||[]).some(x=>x && (x.h===me||x.a===me) && !x.done)) return true;
    }
    return false;
  }catch(e){ return false; }
}
/* 🌏 그날 우리 팀의 대회 경기가 있는가 */
function isEaclDay(i, incDone){
  try{
    if(!eaclOn() || G.jobless) return false;
    const me=G.userTeamId;
    if(!G.eacl || (G.eacl.teams||[]).indexOf(me)<0) return false;
    for(const m of (G.eacl.fix||[])){
      if((!incDone && m.done) || (m.h!==me && m.a!==me)) continue;
      if(eaclMdDay(m.d)===i) return true;
    }
    /* ⚠ 제보 — 「EACL 바로 전날에 훈련이 잡힌다」.
       녹아웃은 두 가지가 어긋나 있었다.
       ① 실제로 치러지는 날은 eaclKoDue(예정일과 대진이 짜인 날 중 늦은 쪽)인데
          여기서는 예정일(eaclKoDay)만 봤다 — 앞 단계가 밀리면 휴식일이 엉뚱한 날에 붙는다.
       ② 대진이 아직 안 짜였으면(추첨 전) 아무 날도 경기일로 잡히지 않아,
          8강 전날에 그대로 훈련이 편성됐다. 아직 대회에 남아 있다면 예정일을 경기일로 본다. */
    const K=G.eacl.ko||{};
    let alive=false;
    for(const st of ["qf","sf","f"]){
      const ties = st==="f" ? [K.f] : (K[st]||[]);
      const arr=(ties||[]).filter(Boolean);
      for(const x of arr){
        if((!incDone && x.done) || (x.h!==me && x.a!==me)) continue;
        alive=true;
        if(eaclKoDue(st)===i || eaclKoDay(st)===i) return true;
      }
      /* 이 단계가 아직 열리지 않았는데 우리가 탈락하지 않았다면 — 예정일을 경기일로 본다 */
      if(!arr.length && G.eacl.stage!=="end" && eaclUserAliveNow()){
        if(eaclKoDay(st)===i) return true;
      }
    }
  }catch(e){}
  return false;
}
function roundOfDay(i){ return ((G.cal&&G.cal.roundDay)||[]).indexOf(i); }
/* 요일별 기본 루틴 — 경기일과 경기 다음 날은 여기에 상관없이 따로 처리한다.
   토·일에 경기가 몰리므로 주 초반은 회복, 주 중반에 강하게, 경기 직전은 가볍게. */
/* ═══ 🏋️ 훈련 주제 (Training Focus) ══════════════════════════════════
   ⚠ 제보 — 「전술 하나를 짜서 조직력을 올려놨는데, 상대에 맞춰 조금씩 손보면 골때리게 내려간다.
      아예 훈련도 세분화해서 전술훈련·공격훈련·수비훈련·특정 포지션 훈련이 있었으면 좋겠다」.
   ─ 강도(가볍게/보통/강하게)와 별개로 「무엇을 훈련할지」를 고른다.
     같은 강훈련이라도 전술판을 붙들고 있는 하루와, 마무리만 반복하는 하루는 남는 게 다르다. */
const TRAIN_FOCUS=[
 {k:"bal", n:"균형",      ic:"⚖️", fam:1.00, dev:1.00, cond:1.00,
  d:"고르게 — 특별히 치우치지 않는 하루"},
 {k:"tac", n:"전술 훈련",  ic:"📋", fam:2.10, dev:0.70, cond:0.85,
  d:"조직력이 두 배로 오르고, <b>손본 지시가 몸에 밴다</b> — 미세 조정으로 깎인 만큼을 되찾는다"},
 {k:"atk", n:"공격 훈련",  ic:"⚔️", fam:0.80, dev:1.10, cond:1.05,
  keys:["fin","crs","dri","fir","tec","lon","otb","vis","pas","fla","cmp","hea"],
  d:"마무리·크로스·연계 — 공격 자원의 성장이 이쪽으로 몰린다"},
 {k:"def", n:"수비 훈련",  ic:"🛡️", fam:0.85, dev:1.10, cond:1.05,
  keys:["tck","mar","pos","ant","cnt","bra","hea","str","agg","dec","com","cmd"],
  d:"대인·태클·위치선정 — 뒷문을 잠그는 항목이 오른다"},
 {k:"set", n:"세트피스",   ic:"🎯", fam:0.90, dev:1.00, cond:0.90,
  keys:["cor","fre","pen","hea","jum","thr","tec","cmp"],
  d:"코너·프리킥·페널티 — 데드볼 상황에서 갈리는 항목"},
 {k:"phy", n:"체력 훈련",  ic:"💪", fam:0.55, dev:1.05, cond:1.55,
  keys:["sta","pac","acc","str","jum","bal","agi","nat","wor","det"],
  d:"지구력·주력 — 체력은 더 깎이지만 시즌을 버티는 몸이 된다"},
 {k:"pos", n:"포지션 훈련", ic:"🎓", fam:0.85, dev:0.85, cond:0.95,
  d:"고른 라인이 <b>자리와 역할</b>을 익힌다 — 포지션·역할 능숙도가 눈에 띄게 오른다"}
];
const FOCUS_BY_K={}; for(const f of TRAIN_FOCUS) FOCUS_BY_K[f.k]=f;
const POS_LINES=[{k:"GK",n:"골키퍼"},{k:"DF",n:"수비진"},{k:"MF",n:"중원"},{k:"FW",n:"공격진"},{k:"ALL",n:"전원"}];
function focusOf(pl){ return FOCUS_BY_K[(pl&&pl.f)||"bal"] || FOCUS_BY_K.bal; }
/* ═══ 🎯 개인 훈련 ══════════════════════════════════════════════════════════
   실제 훈련장에서는 열한 명이 똑같은 걸 하지 않는다. 스트라이커는 마무리를, 풀백은
   크로스를, 회복 중인 노장은 몸을 만든다.
   ⚠ 제보 — 「훈련 세션을 선수 개별로 지정할 수 있게 해 달라」.
   ─ 팀 훈련 주제는 그대로 두고, 선수마다 「개인 과제」를 하나 더 얹는다.
     그 항목이 팀 주제의 두 배 무게로 뽑히므로 눈에 띄게 빨리 오른다.
     대신 몸은 조금 더 갈리고, 코치가 볼 수 있는 인원에 한계가 있다. */
const IND_TRAIN=[
  {k:"fin", n:"골 마무리",   ic:"🎯", keys:["fin","cmp","otb","tec"],              d:"박스 안에서의 결정력과 침착함"},
  {k:"drb", n:"드리블·기술", ic:"🕺", keys:["dri","tec","agi","fla","bal","fir"],  d:"공을 달고 사람을 벗긴다"},
  {k:"pas", n:"패스·시야",   ic:"🧭", keys:["pas","vis","fir","dec","tec"],        d:"배급과 전개의 질"},
  {k:"crs", n:"측면 크로스", ic:"📐", keys:["crs","tec","pas","otb","wor"],        d:"올리는 타이밍과 정확도"},
  {k:"def", n:"수비 기본기", ic:"🛡️", keys:["tck","mar","pos","ant","cnt"],        d:"대인·위치선정·차단"},
  {k:"air", n:"제공권",     ic:"🗼", keys:["hea","jum","str","bra"],              d:"공중볼 다툼과 몸싸움"},
  {k:"phy", n:"체력·스피드", ic:"💪", keys:["sta","pac","acc","str","nat","agi"],  d:"90분을 버티는 몸"},
  {k:"men", n:"멘탈",       ic:"🧠", keys:["dec","cmp","cnt","det","wor","tea","ldr"], d:"판단·집중·투지"},
  {k:"set", n:"세트피스",   ic:"⚽", keys:["fre","cor","pen","tec","lon"],         d:"프리킥·코너·페널티"},
  {k:"gk",  n:"골키핑",     ic:"🧤", keys:["ref","one","han","cmd","aer","com","kic","pun","tro"], d:"골키퍼 전용 세션"}
];
const IND_BY_K={}; for(const x of IND_TRAIN) IND_BY_K[x.k]=x;
const IND_COND=-0.15;      // 개인 과제를 하나 더 소화하는 만큼 몸이 조금 더 갈린다
/* 코치가 한 번에 볼 수 있는 인원 — 훈련 시설 등급이 곧 코칭 스태프 규모다 */
/* 코치가 한 번에 볼 수 있는 인원 — 시설만이 아니라 「사람이 몇 명이냐」가 정한다.
   ⚠ 코치진 확대의 체감 지점: 사단을 크게 꾸릴수록 개인 과제를 더 많이 줄 수 있다.
   훈련 칸을 맡은 코치(♟️·💪)는 3명씩, 수석코치는 2명, 나머지 스태프는 1명씩 늘려 준다. */
function indStaffBonus(t){
  try{
    if(t && !t.isUser) return 0;
    let n=0;
    for(const c of crew()){
      const r=c&&c.role;
      if(r==="ac") n+=1;
      else if(r==="coach"||r==="fit") n+= (c.assign?1.5:0.8);   // 칸을 맡은 코치가 실제로 본다
      else n+=0.8;
    }
    return Math.min(9, Math.round(n));
  }catch(e){ return 0; }
}
function indCap(t){ t=t||userTeam(); return Math.round(3 + lvEff(trainLv(t))*2 + indStaffBonus(t)); }   // 🔟
function indCount(t){ t=t||userTeam(); return (t&&t.players||[]).filter(p=>p.itr && IND_BY_K[p.itr]).length; }
function indOf(p){ return (p && p.itr && IND_BY_K[p.itr]) || null; }
function indKeysOf(p){
  const it=indOf(p); if(!it) return null;
  const hit=it.keys.filter(k=>(p.attr&&p.attr[k]!=null)||(p.gkA&&p.gkA[k]!=null));
  return hit.length?hit:null;
}
/* 자리에 맞는 기본 과제 — 「자동 배정」이 쓰는 표 */
function indSuggest(p){
  if(!p) return "phy";
  if(p.pos==="GK") return "gk";
  const sl=(prefSlotOf(p)||p.pos||"CM");
  if(["ST","LS","RS"].indexOf(sl)>=0) return "fin";
  if(["LW","RW","AML","AMR","LM","RM"].indexOf(sl)>=0) return "crs";
  if(["AMC","AM"].indexOf(sl)>=0) return "pas";
  if(["LB","RB","LWB","RWB"].indexOf(sl)>=0) return "crs";
  if(["CB","LCB","RCB","SW"].indexOf(sl)>=0) return "air";
  if(["DM","LDM","RDM"].indexOf(sl)>=0) return "def";
  return "pas";
}
function setIndTrain(pid, k){
  const t=userTeam(); const p=t&&t.players.find(x=>x.id===pid); if(!p) return;
  if(!k || k==="-"){ delete p.itr; saveGame(); ftShow("train"); return; }
  if(!IND_BY_K[k]) return;
  if(!p.itr && indCount(t)>=indCap(t)){
    flash(`코치진이 한 번에 볼 수 있는 인원은 ${indCap(t)}명입니다 — 훈련 시설을 올리면 늘어납니다.`,"warn");
    return;
  }
  p.itr=k; saveGame(); ftShow("train");
}
function autoIndTrain(){
  const t=userTeam(); if(!t) return;
  const cap=indCap(t);
  /* 주전부터 채운다 — 코치의 시간은 한정돼 있다 */
  const order=[...t.players].filter(p=>!p.loan).sort((a,b)=>(b.ovr||0)-(a.ovr||0));
  let n=0;
  for(const p of t.players) delete p.itr;
  for(const p of order){ if(n>=cap) break; p.itr=indSuggest(p); n++; }
  flash(`🎯 개인 훈련을 자리에 맞게 ${n}명에게 배정했습니다.`);
  saveGame(); ftShow("train");
}
function clearIndTrain(){
  const t=userTeam(); if(!t) return;
  for(const p of t.players) delete p.itr;
  flash("개인 훈련을 모두 해제했습니다.");
  saveGame(); ftShow("train");
}
/* 포지션 훈련 — 그 라인에 속하는가 */
function inTrainLine(p, ln){
  if(!ln || ln==="ALL") return true;
  return (p.pos||"MF")===ln;
}
function defaultRoutine(){
  return [ {t:"rest"},            // 일
           {t:"rest"},            // 월
           {t:"train", i:1},      // 화
           {t:"train", i:2},      // 수
           {t:"train", i:1},      // 목
           {t:"train", i:0},      // 금
           {t:"rest"} ];          // 토
}
function ensureTrainPlan(){
  if(!G.train) G.train={routine:defaultRoutine(), days:{}};
  if(!G.train.routine||G.train.routine.length!==7) G.train.routine=defaultRoutine();
  if(!G.train.days) G.train.days={};
}
/* 그날 무엇을 하는가.
   개별 지정 > 경기 전날 휴식 > 경기 다음 날 회복 > 요일 루틴
   ⚠ 제보 — 「경기 전날인데 훈련이 잡혀 있다」. 전날 훈련은 컨디션을 깎은 채 경기에 나서게 한다.
      리그·연습경기·대회를 가리지 않고 하루 전은 비워 둔다(감독이 직접 지정하면 그 뜻을 따른다). */
function dayPlan(i){
  ensureTrainPlan();
  if(isMatchDay(i)) return {t:"match"};
  const o=G.train.days[i];
  if(o) return Object.assign({}, o);
  if(isMatchDay(i+1) || isMatchDayAny(i+1)) return {t:"rest", auto:"경기 전날"};
  if(i>0 && isMatchDayAny(i-1)) return {t:"rest", auto:"경기 다음 날"};
  /* 🌍 대회 기간은 회복이 먼저다 — 프리시즌 훈련 강도가 세계 대회 성적을 가르면 안 된다 */
  if(cwcWindow(i)) return {t:"train", i:0, f:"bal", ln:"ALL", auto:"🌍 대회 기간"};
  return Object.assign({auto:"주간 루틴"}, G.train.routine[dayOfWeek(i)]);
}
function setDayPlan(i, t, inten, foc, ln){
  ensureTrainPlan();
  if(isMatchDay(i)) return;
  const old=G.train.days[i]||{};
  G.train.days[i]= t==="train"
    ? {t:"train", i:inten||0, f:foc||old.f||"bal", ln:ln||old.ln||"ALL"}
    : {t:"rest"};
  saveGame(); ftShow("cal");
}
/* 강도는 그대로 두고 주제만 바꾼다 */
function setDayFocus(i, foc, ln){
  ensureTrainPlan();
  if(isMatchDay(i)) return;
  const cur=dayPlan(i);
  /* ⚠ 제보 — 「휴식으로 처리해 둔 날에 어느 순간 보통 훈련이 잡혀 있었다.
     EACL 전날이라 모르고 넘어갔다가 컨디션을 다 잃었다」.
     달력 한 칸 안에서 훈련 주제 아이콘이 「휴」 버튼 바로 옆에 붙어 있는데,
     휴식일에 주제를 누르면 조용히 「보통(강도 1) 훈련」으로 바뀌고 있었다.
     ─ 휴식은 감독이 정한 것이다. 주제를 눌렀다고 깨지지 않는다. */
  if(cur.t!=="train"){
    try{ flash("이 날은 <b>휴식</b>입니다 — 훈련 주제를 정하려면 먼저 강도(가볍게·보통·강하게)를 골라 주세요.","warn"); }catch(e){}
    return;
  }
  G.train.days[i]={t:"train", i:cur.i||0, f:foc||cur.f||"bal", ln:ln||cur.ln||"ALL"};
  saveGame(); ftShow("cal");
}
function setRoutineFocus(dow, foc, ln){
  ensureTrainPlan();
  const cur=G.train.routine[dow]||{};
  if(cur.t!=="train") G.train.routine[dow]={t:"train", i:1, f:foc||"bal", ln:ln||"ALL"};
  else G.train.routine[dow]={t:"train", i:cur.i||0, f:foc||cur.f||"bal", ln:ln||cur.ln||"ALL"};
  saveGame(); ftShow("train");
}
function clearDayPlan(i){ ensureTrainPlan(); delete G.train.days[i]; saveGame(); ftShow("cal"); }
function setRoutine(dow, t, inten){
  ensureTrainPlan();
  const old=G.train.routine[dow]||{};
  G.train.routine[dow]= t==="train"
    ? {t:"train", i:inten||0, f:old.f||"bal", ln:old.ln||"ALL"} : {t:"rest"};
  saveGame(); ftShow("train");
}
/* ── 하루를 소화한다 ────────────────────────────────────────── */
/* 나이가 들면 같은 훈련을 하고도 회복이 더디다 */
function recoverMul(p){
  const age=G.season-(p.by||2000);
  let m = age<=23 ? 1.10 : age<=27 ? 1.00 : age<=30 ? 0.92 : age<=33 ? 0.84 : 0.76;
  /* 타고난 체력(nat) — 스탯이 상향 평준화되어 있어 계수를 낮춘다 (0.030 → 0.022 · 제보) */
  if(p.attr && p.attr.nat!=null) m *= clamp(1 + (attr20(p.attr.nat)-10)*0.022, 0.82, 1.18);
  return m;
}
/* ⚠ 제보 — 「벤치에서 교체 투입된 선수의 체력 회복이 선발로 나갔다가 교체된 선수보다 빠르다.
   교체 투입 선수는 경기 당일에도 회복되는 것 같다. 명단 외 선수도 확인해 달라」.

   확인해 보니 세 군데가 어긋나 있었다.
   ① 경기 피로가 출전 시간에 **정비례**했다. 15분 뛴 교체 선수의 부하가 풀타임의 16%뿐이라,
      다음 날 휴식(+2.4) 한 번이면 경기 전보다 오히려 몸이 좋아졌다.
      실제로는 몸을 풀고 그라운드를 밟는 것 자체가 비용이고, 교체 선수는 짧게 뛰는 대신
      분당 강도가 더 높다(그래서 들여보내는 것이다).
   ② 경기일은 달력이 훈련·휴식을 건너뛰는 날인데, 출전하지 않은 선수 전원에게 +1을 줬다.
      벤치에서 몸만 풀고 앉아 있던 선수와 훈련장에 남아 세션을 소화한 명단 외 선수가 같은 값이었다.
   ③ 회복 '속도' 자체는 모두 같았다. 90분을 뛴 다리는 다음 날 아침에도 무겁다 —
      p.mFat 에 지난 경기의 부하를 담아 두고, 그만큼 다음 며칠의 회복을 늦춘다. */
const APP_BASE  = 0.20;   // 출전 그 자체의 몫 — 워밍업·이동·경기 강도 (분과 무관)
const SUB_RATE  = 1.18;   // 교체 투입 선수의 분당 강도 — 신선한 다리로 더 뛴다
/* 🛌 경기 당일의 회복 — 경기 전까지도 하루는 하루다.
   ⚠ 제보 — 「경기 전날에서 당일로 하루를 보냈는데 컨디션이 하나도 오르지 않았다」.
     경기일에는 하루 처리(applyDayToTeam)를 통째로 건너뛰어 회복이 0이었다.
     경기가 끝난 뒤에야 벤치(+0.4)·명단 외(+1.2)만 조금 받았고, 그마저 서로 달랐다.
   ─ 경기 당일에도 「휴식일과 같은 회복」을 전원에게 똑같이 준다.
     선발·교체·명단 외를 가리지 않는다 — 경기에서 뛴 몫은 경기가 따로 계산한다. */
const MD_REST   = REST_COND;   // 경기 당일 회복 = 휴식일과 동일
/* ⏱️ 추가시간이 들어오면서 한 경기가 길어졌다 — 그만큼 회복도 올린다.
   ⚠ 제보 — 「추가시간 구현 뒤 경기당 10분 정도 더 뛰는데 회복은 90분 시절 그대로다」.
     실측(286경기): 경기 종료 평균 <b>98.3분</b> — 예전 90분 대비 +8.3분.
     풀타임 선발의 출전 부하는 0.974 → 1.046 으로 <b>+7.3%</b>, 경기당 소모가 약 +0.75 늘었다.
     그만큼을 회복 쪽에 돌려준다. 다만 「경기당 소모 +7.3%」를 그대로 회복에 얹으면 과보정이다 —
     지치면 AI도 유저도 휴식을 더 넣고, 100 상한에 붙은 선수는 더 받지도 못하기 때문이다.
   ─ 시즌 평균 컨디션이 「90분 시절」로 정확히 돌아오는 값을 실측으로 찾았다: ×1.04
       (선발급 기준 — 90분 시절 87.89 · 보정 전 87.42 · 보정 후 88.03)
     유저 구단과 AI 구단이 같은 상수를 쓴다. */
const RECOV_K   = 1.04;
const MFAT_SLOW = 0.30;   // 잔여 피로 1.0(풀타임)이면 다음 날 회복이 30% 느리다 (0.20 → 0.30 · 제보)
const MFAT_DECAY= 0.58;   // 하루가 지나면 잔여 피로는 58%가 남는다 — 나흘은 다리가 무겁다 (0.42 → 0.58)
/* 오늘 이 선수의 회복 배수 — 나이·회복력에 지난 경기의 잔여 피로를 얹는다 */
function dayRecMul(p){
  let m = recoverMul(p) * (1 - clamp(p.mFat||0, 0, 1.15)*MFAT_SLOW);
  /* 💪 체력 코치는 평상시 회복을, 🚑 팀 닥터는 재활 중 회복을 맡는다 (우리 선수에게만) */
  try{ if(isOurPlayer(p)) m *= ((p.inj>0) ? acDocRecK() : acFitRecK()); }catch(e){}
  return m;
}
function mFatDecay(p){
  if(!p.mFat) return;
  const v=p.mFat*MFAT_DECAY;
  if(v<0.04) delete p.mFat; else p.mFat=Math.round(v*100)/100;
}
/* ⚡ 지금 뛰면 어느 체력으로 시작하는가 — ⚠ 요청: 「체력 버튼이 타고난 체력(지구력 능력치)으로
   표시되는 것 같다. 나는 그냥 현재 뛸 수 있는 체력을 말한 것」.
   컨디션에서 지난 경기의 잔여 피로(mFat — "무거운 다리")를 뺀 값이다. 표시와 엔진이 같은
   값을 쓰도록 킥오프 시작 체력(createMatch·교체 투입·PvP)도 전부 이 함수로 통일했다. */
function matchStartFit(p){
  return clamp(Math.round((p&&p.cond!=null?p.cond:90) - ((p&&p.mFat)||0)*22), 40, 100);
}
/* 훈련장 부상 위험 배수 — 나이·부상 이력이 쌓일수록 위험하다 */
function trainInjMul(t, p){
  const age=G.season-(p.by||2000);
  let m = 1 + (100-(p.cond||90))/45;                 // 지쳐 있을수록
  m *= age<=23 ? 0.85 : age<=29 ? 1.00 : age<=32 ? 1.25 : 1.55;
  m *= 1.12 - (lvEff(trainLv(t))-1)*0.05;                    // 좋은 훈련시설일수록 덜 다친다 (🔟)
  /* 💪 체력 코치가 부하를 관리하고, 🚑 팀 닥터가 위험 신호를 먼저 잡는다 */
  if(t && t.isUser){ try{ m *= acFitInjK() * acDocRiskK(); }catch(e){} }
  return m;
}
/* ⚠ 임대 나간 선수는 우리 훈련장에 없다. 그런데도 우리 강도·부상 판정을 그대로 받고 있었다.
   임대 구단에서 평범한 강도로 훈련한다고 보고, 우리 조직력·부상과는 분리한다. */
function trainLoanee(t, p){
  developPlayer(t, p, 1);
  mFatDecay(p);
  if(p.inj>0){ p.cond=Math.round(clamp(p.cond+2,55,100)); return; }
  p.cond=Math.round(clamp(p.cond+1*RECOV_K*recoverMul(p), 55, 100));
}
/* 🛌 경기 당일 회복 — 하루가 흘렀으면 회복도 흘러야 한다.
   선발·교체·명단 외 구분 없이 같은 속도·같은 양으로 회복한다 (제보). */
function matchDayRecover(t){
  if(!t || !t.players) return;
  /* 👔 ⚠ 배선 구멍 — 선수 관리(man)가 <b>AI 팀 경기에 전혀 닿지 않았다.</b>
     쓰이는 곳이 두 군데뿐인데 둘 다 유저 쪽이었다(수석코치 위임 지휘력·수석코치 연봉).
     ─ 선수 관리가 좋은 감독은 <b>선수를 덜 축내고 더 빨리 회복시킨다</b>. 리그 평균 15 기준
       ±0.14 배. 눈에 띄는 크기는 아니지만 시즌이 쌓이면 스쿼드 상태에서 차이가 난다. */
  const _mK=aiManK(t);
  for(const p of t.players){
    if(p.loan) continue;                        // 임대 나간 선수는 임대처에서 회복한다
    const rm=dayRecMul(p)*_mK; mFatDecay(p);    // 지난 경기의 잔여 피로도 하루만큼 빠진다
    if(p.inj>0){ p.cond=Math.round(clamp(p.cond+2*recoverMul(p),55,100)*10)/10; continue; }
    if(p.sulk>0) continue;                      // 태업 중인 선수는 회복도 더디다
    p.cond=Math.round(clamp(p.cond+MD_REST*RECOV_K*rm, 55, 100)*10)/10;
  }
}
/* 👔 AI 감독의 선수 관리 배수 — 회복에 곱한다 (유저 팀은 1, 감독 없으면 1) */
function aiManK(t){
  try{
    if(!t || t.isUser) return 1;
    const c=(typeof coachOf==="function")?coachOf(t):null;
    if(!c || c.man==null) return 1;
    return clamp(1+(c.man-15)*0.028, 0.86, 1.14);
  }catch(e){ return 1; }
}
/* 🌏 해외 클럽(EACL·CWC) 하루치 회복 — 국내 구단과 같은 상수(REST_COND·RECOV_K·잔여 피로)를 쓴다.
   ⚠ 제보 — 「컨디션 관련 패치를 유저 구단·국내 AI·해외 AI의 선발/교체/그 외 명단에 똑같이
     적용해 달라」. 해외 클럽은 G.teams 밖에 있어 일일 회복 루프가 닿지 않았다 — 유저와 붙은
     경기에서 소모된 컨디션·잔여 피로가 시즌 내내 그대로 남아, 다시 만나면 지쳐 있는 상대와
     싸우는 숨은 이점이 됐다. 국내 AI(aiDayPlan)와 같은 감각으로: 지쳐 있으면 쉬고(휴식 회복),
     멀쩡하면 가볍게 굴린다(가볍게 훈련 수준). 명단 구분 없이 전원이 같은 값을 받는다. */
function foreignCondTick(){
  const bags=[G.eaclClubs||{}, G.cwcClubs||{}];
  for(const bag of bags){
    for(const k in bag){
      const c=bag[k];
      if(!c || c.s!==G.season || !c.t || !Array.isArray(c.t.players)) continue;
      for(const p of c.t.players){
        const rm=dayRecMul(p); mFatDecay(p);
        if(p.inj>0){ p.cond=Math.round(clamp((p.cond||90)+2*recoverMul(p), 55, 100)); continue; }
        const add=(p.cond||90)<86 ? REST_COND*RECOV_K*rm : TRAIN_INT[0].cond*rm;
        p.cond=Math.round(clamp((p.cond||90)+add, 55, 100)*10)/10;
      }
    }
  }
}
/* 오늘이 경기일이면 리그 전체가 하루치 회복을 받는다 — 하루에 한 번만 */
function matchDayRecoverAll(){
  const d=G.day||0;
  if(!isMatchDay(d)) return;              // 경기일에만 — 평일은 applyDayToTeam 이 처리한다
  if(G._mdRecDay===d) return;
  G._mdRecDay=d;
  for(const id in G.teams){ try{ matchDayRecover(G.teams[id]); }catch(e){} }
}
/* ═══ 🧳 무적 선수의 발달 ══════════════════════════════════════════════════════
   ⚠ 제보 확인 — developPlayer 를 부르는 곳이 <b>세 곳 모두 팀 단위 루프</b>여서,
      FA 시장·해외 시장 선수는 <b>성장도 하락도 전혀 없었다.</b> 능력치가 얼어붙은 채
      리그만 흘러가, 몇 시즌 지나면 시장에 「나이만 먹고 실력은 그대로인」 선수가 쌓인다.
   ─ 소속이 없으니 훈련 환경도 없다. 2부 수준 환경·최저 시설·감독 없음으로 된 대역 소속을
      만들어 그대로 통과시킨다. 출전 기록(p.mn)이 0 이라 playShare 도 0 —
      즉 「안 뛰니까 늘지 않는다」가 저절로 성립하고, 나이 곡선만큼 서서히 내려간다.
   ⚠ 해외 진열대 선수는 제외한다 — 그쪽은 원본 정의 기준으로 나이를 되돌리는 목록이라
      (startNewSeason 의 나이 고정 주석 참고) 능력만 계속 깎이면 전설이 몇 시즌 만에
      허수아비가 된다. 원본이 없는 항목만 늙고 깎인다. */
const FREE_ENV={id:"__free", div:2, trainLv:1, isUser:false, players:[]};
function devUnattachedTick(){
  const _dev=(p)=>{ try{ developPlayer(FREE_ENV, p, null); }catch(e){} };
  for(const p of (G.freeAgents||[])) _dev(p);
  if(Array.isArray(G.overseas) && G.overseas.length){
    let def=null;
    try{ def={}; for(const d of OVERSEAS_DEF) def[d.name]=1; }catch(e){ def=null; }
    for(const p of G.overseas) if(!def || !def[p.osKey||p.name]) _dev(p);
  }
}
function applyDayToTeam(t, pl){
  try{ famUseTick(t); }catch(e){}      // 📋 실전 감각은 하루씩 옅어진다
  if(pl.t==="rest"){
    for(const p of t.players){
      if(p.loan){ trainLoanee(t, p); continue; }
      developPlayer(t, p, null);                              // 쉬는 날에도 몸은 아주 조금 변한다
      const rmR=dayRecMul(p)*aiManK(t); mFatDecay(p);         // 👔 AI 감독의 선수 관리가 회복 속도를 가른다
      if(p.sulk>0) continue;                                  // 태업 중인 선수는 회복도 더디다
      p.cond=Math.round(Math.round(clamp(p.cond+REST_COND*RECOV_K*rmR+(p.inj>0?1:0), 55, 100)*10)/10*10)/10;
    }
    t.morale=Math.round(clamp(t.morale+0.06, 40, 99)*100)/100;
    /* 📋 훈련을 쉬면 손발은 서서히 어긋난다 — 다만 최근 그 전술로 실전을 치렀다면
       경기가 곧 반복 훈련이다. 체력 안배로 쉰다고 적응도가 0으로 흘러가지 않는다. (제보) */
    addFam(t, REST_FAM*(famFresh(t)?FAM_USE_REST:1));
    if(t.isUser) addFamPresets(t, REST_FAM);
    return null;
  }
  const k=TRAIN_INT[clamp(pl.i||0,0,2)];
  const lv=lvEff(trainLv(t));   // 🔟 예전 1~5 성능 축
  const pre=(typeof G.phase!=="undefined" && G.phase==="pre");
  const FOC=focusOf(pl);                       // 🏋️ 오늘의 훈련 주제
  const line=pl.ln||"ALL";
  let hurt=null;
  for(const p of t.players){
    if(p.loan){ trainLoanee(t, p); continue; }
    const onFoc = (FOC.k==="pos") ? inTrainLine(p, line) : true;
    /* 🎯 개인 훈련 — 팀 주제 위에 자기 과제를 얹는다. 두 배 무게로 뽑히므로 그 항목이 빨리 는다 */
    const _ind=indKeysOf(p);
    let _foc = onFoc?FOC:null;
    if(_ind && p.inj<=0 && !p.sulk){
      _foc={k:(_foc&&_foc.k)||"ind", keys:((_foc&&_foc.keys)||[]).concat(_ind, _ind)};
    }
    developPlayer(t, p, clamp(pl.i||0,0,2), _foc);
    /* 🎓 포지션 훈련 — 고른 라인이 자기 자리와 역할을 익힌다. 경기 한 판의 1/4쯤 */
    if(FOC.k==="pos" && onFoc && p.inj<=0 && !p.sulk){
      try{
        const sl=canonSlot(prefSlotOf(p))||prefSlotOf(p);
        gainPosFam(p, sl, 90*POSTRAIN_K*(0.8+(pl.i||0)*0.2));
        const rd=getRole(t, p, sl); if(rd&&rd.r) gainRoleFam(p, rd.r, 90*POSTRAIN_K*(0.8+(pl.i||0)*0.2));
      }catch(e){}
    }
    const rmT=dayRecMul(p); mFatDecay(p);                     // 지난 경기의 잔여 피로가 오늘 회복을 늦춘다
    if(p.inj>0){ p.cond=Math.round(clamp(p.cond+2*recoverMul(p),55,100)); continue; }   // 재활 중 — 훈련에 끼지 않는다
    // 지구력이 좋은 선수는 같은 훈련을 하고도 덜 지친다
    const staBonus=p.attr&&p.attr.sta!=null ? (attr20(p.attr.sta)-11)*0.08 : 0;
    /* 주제에 따라 몸에 남는 부담이 다르다 — 체력 훈련은 더 갈리고, 전술판은 덜 갈린다 */
    const _kc = k.cond>=0 ? k.cond/Math.max(0.35,FOC.cond) : k.cond*FOC.cond;
    const cd = _kc>=0 ? _kc*rmT*RECOV_K : _kc/Math.max(0.75, rmT);
    /* ⚠ 제보 — 컨디션이 58.00000094 처럼 찍힌다. 소수 누적을 쓰면서 부동소수 찌꺼기가 남았다.
       화면은 정수로 그리지만, 저장값도 한 자리로 못 박아 둔다(툴팁·에디터·세이브 전부 깔끔하게). */
    const _indC=(_ind && p.inj<=0 && !p.sulk) ? IND_COND : 0;      // 과제를 하나 더 하면 몸이 더 갈린다
    p.cond=Math.round(clamp(p.cond+cd+staBonus+_indC, 55, 100)*10)/10;   // 소수 누적 — +1.3 같은 값이 반올림에 먹히지 않게
    p.cond=Math.round(p.cond*10)/10;
    p.morale=Math.round(clamp(p.morale+k.mor*(p.pers===2?0.4:1), 30, 99)*100)/100;
    /* 프리시즌은 체력을 쌓는 기간이다 — 같은 강훈련이라도 이때가 두 배로 남는다 */
    if((k.sta || FOC.k==="phy") && p.attr && Math.random()<Math.max(k.sta, FOC.k==="phy"?0.055:0)*(pre?2:1))
      p.attr.sta=clamp(p.attr.sta+1, 20, 99);
    /* 훈련장에서도 조금씩 몸에 밴다 — 경기만큼은 아니지만 강하게 굴릴수록 더.
       감독을 믿는 선수가 더 잘 흡수한다(선물·면담이 여기로 돌아온다). */
    if(t.isUser){ try{ const age=G.season-p.by;
      const affK=clamp(0.80+(aff(p)-50)/100*0.55, 0.72, 1.32);
      addTraitXp(p, (0.35+(pl.i||0)*0.30) * affK * (1+(lv-1)*0.06)
                    * (age<=21?1.45:age<=24?1.22:age<=28?1:age<=31?0.82:0.62)); }catch(e){} }
    // 강하게 굴리면 훈련장에서 다친다. 이미 지쳐 있을수록, 나이가 많을수록 위험하다.
    if(Math.random() < k.inj*trainInjMul(t, p)){
      /* 🚑 배선 — 훈련장 부상도 유형이 있다. 강훈련일수록 무거운 쪽으로 (요청) */
      try{ mkInjury(p, {cause:"train", fit:p.cond||90, age:G.season-(p.by||2000),
                        heavy:clamp(((pl&&pl.i)||0)*0.10, 0, 0.25)}); }
      catch(e){ try{ setInjury(p, 1+R(3)); }catch(e2){ p.inj=1+R(3); } }
      p.cond=Math.round(clamp(p.cond-6,55,100));
      if(!hurt) hurt=p;
    }
  }
  /* 🏋️ 주제에 따라 조직력이 오르는 폭이 다르다 — 전술 훈련이면 두 배로 오른다 */
  addFam(t, k.fam*FOC.fam);
  if(t.isUser) addFamPresets(t, k.fam*FOC.fam);   // 대안 전술도 훈련장에서 함께 다듬는다
  /* 📋 전술 훈련 — 손본 지시를 반복해서 몸에 새긴다.
     미세 조정으로 깎였던 만큼(_devPen)을 그 폭만큼 되돌리고 기준선을 지금 판으로 당겨 온다. */
  if(FOC.k==="tac"){ try{ tacDrill(t, k.fam*FOC.fam); }catch(e){} }
  return hurt;
}
/* 🏋️ AI 구단의 하루 — 요일만 보던 고정 루틴이었다.
   ⚠ 제보 — 「AI 구단이 선수 컨디션을 조절할 줄 모른다」.
     주전이 갈려 나가도 수요일이면 강훈련을 하고, 경기 전날에도 그대로 굴렀다.
   ─ 선발로 나설 열한 명의 컨디션을 보고 강도를 정한다. 지쳐 있으면 쉬고, 싱싱하면 굴린다. */
function aiSquadCond(t){
  try{
    const xi=bestXI(t)||[];
    const src=xi.length? xi : (t.players||[]).filter(avail).slice(0,11);
    if(!src.length) return 90;
    let s=0; for(const p of src) s+=(p.cond||90);
    return s/src.length;
  }catch(e){ return 90; }
}
function aiDayPlan(t, i){
  if(i>0 && isMatchDay(i-1)) return {t:"rest"};      // 경기 다음 날은 회복
  if(isMatchDay(i+1))        return {t:"rest"};      // 경기 전날도 비운다 (유저 팀과 같은 원칙)
  const dow=dayOfWeek(i);
  if(dow===0||dow===6) return {t:"rest"};
  const c=aiSquadCond(t);
  /* 선수단이 지쳐 있으면 강도를 낮추거나 하루를 통째로 쉰다 */
  if(c<70) return {t:"rest"};
  if(c<78) return (dow===1||dow===4) ? {t:"rest"} : {t:"train", i:0};
  if(c<86) return (dow===1) ? {t:"rest"} : {t:"train", i: dow===3?1:0};
  if(dow===1) return {t:"rest"};
  return {t:"train", i: dow===3?2:1};                 // 싱싱하면 예전처럼 굴린다
}
/* ══════════════════════════════════════════════════════════════
   성장과 노쇠 — FM식 일 단위 발달
   내부 능력치는 소수점으로 아주 조금씩 움직이고, 화면에는 반올림해 보여준다.
   그래서 눈에 보이는 1~20 숫자가 한 칸 바뀌려면 보통 한두 달, 확실한 변화는 한 시즌이 걸린다.
   · 어릴수록 (특히 16~20세) 빠르게 큰다. 잠재력에 가까워질수록 느려진다.
   · 출전 시간이 없으면 거의 못 큰다 — 어린 선수일수록 치명적이다.
   · 훈련 강도가 높을수록 잘 큰다(대신 부상 위험은 이미 훈련 로직이 감당한다).
   · 30세를 넘기면 신체 능력부터 무너지고, 정신 능력은 한참 더 버틴다.
   ══════════════════════════════════════════════════════════════ */
const DEV_STEP=0.115;      // 하루에 능력치 하나가 움직이는 기준 폭(99 스케일). 5 = 화면 1칸
const DEV_PICK=4;          // 하루에 손대는 능력치 개수 (전부 건드리면 너무 빠르다)
const DEV_LOAD=[0.72, 1.00, 1.45];   // 훈련 강도별 배수 (가볍게/보통/강하게)
const DEV_REST=0.42;                  // 휴식일 — 성장은 거의 멈추고 회복만 한다
const DEV_SNAP_DAYS=28;               // 이 간격마다 능력치 사진을 찍어 그래프·추세 화살표에 쓴다
const DEV_HIST_MAX=26;
function devAgeCurve(age){
  if(age<=18) return 1.80;
  if(age<=20) return 1.50;
  if(age<=22) return 1.18;
  if(age<=24) return 0.88;
  if(age<=26) return 0.52;
  if(age<=28) return 0.24;
  if(age<=29) return 0.06;
  if(age<=30) return -0.12;
  if(age<=32) return -0.34;
  return -(0.58+(age-32)*0.22);
}
/* 능력치 갈래별 나이 반응 — 신체는 먼저 무너지고, 정신은 오래 큰다 */
const DEV_PHYS={up:1.15, dn:1.65}, DEV_TECH={up:1.00, dn:0.62}, DEV_MENT={up:0.80, dn:0.26};
/* 내리막에서 항목별 낙폭 배수. 발(주력·가속도)이 가장 먼저 죽고, 힘(몸싸움)은 끝까지 남는다.
   활동량은 발이 죽는 만큼 같이 준다 — 못 뛰는 게 아니라 예전만큼 못 따라간다. */
const DECAY_MUL={ pac:1.40, acc:1.34, wor:1.22, sta:1.16, agi:1.10, jum:1.05,
                  bal:0.70, nat:0.70, str:0.45 };
function devKind(k){
  if(PHYS_ATTRS.indexOf(k)>=0) return DEV_PHYS;
  if(MENT_ATTRS.indexOf(k)>=0) return DEV_MENT;
  return DEV_TECH;
}
/* 포지션 가중 원시 능력치 — ovr 과 같은 스케일이라 변화분을 그대로 ovr 에 더할 수 있다 */
function rawCA(p, fb){
  const W=POS_WEIGHT[p.pos]||POS_WEIGHT.MF, a=p.attr||{}, g=p.gkA||{};
  let sum=0, wt=0;
  for(const k in W){
    const v = (typeof g[k]==="number") ? g[k] : (typeof a[k]==="number" ? a[k] : null);
    if(v===null) continue;                     // 없는 항목(fb로 때우는 칸)은 변화 계산에서 뺀다
    sum+=v*W[k]; wt+=W[k];
  }
  return wt ? sum/wt : (fb||p.ovr||65);
}
/* 그 선수가 요즘 얼마나 뛰고 있는가 (0 = 전혀 못 뜀, 1.2 = 붙박이 주전) */
function playShare(p){ return clamp((p.mn||0)/430, 0, 1.2); }
/* 출전 비중을 "협상 근거"로 쓸 수 있는가.
   playShare 는 최근 출전 시간(p.mn)으로 계산하는데, 프리시즌과 시즌 초반에는 이 값이 0이다.
   그대로 쓰면 프리시즌에 전원이 "출전 시간 부족"으로 잡혀 26세 주전이 어린 선수 취급을 받는다.
   실제로 그런 버그가 있었다 — 근거가 쌓이기 전에는 이 항목을 아예 빼는 게 맞다. */
/* 🔎 그 선수가 그 팀의 주전인가 — 0(전혀 못 뜀) ~ 1(붙박이).
   ⚠ 프리시즌·시즌 초반에는 출전 기록(p.mn)이 0이라 전원이 "안 뛰는 선수"로 잡힌다.
     그때는 실제 경기 대신 그 팀의 베스트 XI 편성으로 판단한다 — 감독이 눈으로 보는 것과 같은 근거다.
     (제보 — "프리시즌엔 출전 기록이 없는데 뭘로 핵심 선수인지 아나?") */
function squadRole(p, team){
  const t=team||teamOfPlayer(p);
  if(!t) return 0;
  const rd=(t.div===1?(G.r1||0):(G.r2||0));
  /* 🔁 제보 — 이번 시즌 새로 온 선수는 그 팀에서 뛴 시간이 아직 없다. 출전 기록으로 재면
     방금 큰돈 들여 데려온 선수가 「안 뛰는 선수」로 잡힌다 — 프리시즌과 같은 잣대(편성)로 본다.
     한 번이라도 뛰고 나면 그때부터는 실제 기록이 말한다. */
  const _fresh = (p._joinS===G.season) && !((p.mn||0)>0);
  const sample = (G.phase!=="pre") && rd>=5 && !_fresh;
  if(sample) return clamp(playShare(p), 0, 1);
  /* 근거가 없을 땐 편성으로 본다: 선발 XI = 주전, 벤치 9인 = 로테이션, 그 외 = 후보 */
  try{
    const xi=bestXI(t);
    if(xi.some(q=>q.id===p.id)) return 0.85;
    const bench=matchBench(t);
    if(bench.some(q=>q.id===p.id)) return 0.35;
  }catch(e){
    /* 편성 계산이 실패하면 팀 내 능력치 서열로 근사한다 */
    const rank=[...t.players].sort((a,b)=>b.ovr-a.ovr).findIndex(q=>q.id===p.id);
    if(rank>=0 && rank<11) return 0.85;
    if(rank>=0 && rank<20) return 0.35;
  }
  return 0.08;
}
function playShareKnown(){
  const t=userTeam(); if(!t) return false;
  if(G.phase==="pre") return false;
  const rd=(t.div===1?(G.r1||0):(G.r2||0));
  return rd>=5;
}
/* 발달에서 손댈 능력치 후보 — 포지션에서 중요한 항목이 더 자주 뽑힌다 */
const _DK_CACHE=new Map();
function devKeys(p){
  const ck=(p.pos||"MF")+(p.gkA?"G":"")+(p.attr&&p.attr.pos!=null?"a":"");
  if(_DK_CACHE.has(ck)) return _DK_CACHE.get(ck);
  const W=POS_WEIGHT[p.pos]||POS_WEIGHT.MF;
  const pool=[];
  const isGK=p.pos==="GK";
  for(const k in W){
    const inGk = p.gkA && typeof p.gkA[k]==="number";
    const inAt = p.attr && typeof p.attr[k]==="number";
    if(!inGk && !inAt) continue;
    const rep_=1+Math.min(3, Math.round(W[k]/3));
    for(let i=0;i<rep_;i++) pool.push(k);
  }
  // 포지션 가중치에 없는 항목도 아주 가끔은 움직인다(선수는 편식하지 않는다)
  if(!isGK) for(const k of PHYS_ATTRS.concat(TECH_ATTRS)) if(p.attr && p.attr[k]!=null) pool.push(k);
  const out=pool.length?pool:["dec"];
  _DK_CACHE.set(ck, out);
  return out;
}
/* 하루치 발달을 적용한다. load: 0~2 훈련 강도, null 이면 휴식.
   foc = 오늘의 훈련 주제 — 성장이 그 갈래로 몰린다(공격 훈련이면 마무리·크로스가 먼저 는다). */
function developPlayer(t, p, load, foc){
  if(!p || !p.attr) return;
  /* 📏 ⚠ 제보 — 「뉴스에서 선수 성장 오버롤 표현이 나오는데(예: 종합 74 → 75) 이것을
     현재 선수 프로필의 종합/잠재와 같은 3자리 표현으로 바꿔 주세요」.
     화면 종합(dispOvr)은 세부 능력치에서 나오므로, 능력치를 건드리기 전에 미리 찍어 둔다. */
  let _dspB=0; try{ _dspB=dispOvr(p); }catch(e){}
  const age=G.season-(p.by||2000);
  let dir=devAgeCurve(age);
  const share=playShare(p);
  if(dir>0){
    const room=clamp(((p.pot||p.ovr)-(p.ovr||0))/9, 0, 1.2);   // 잠재력을 다 쓴 선수는 멈춘다
    if(room<=0.02) return;
    /* ⚽ 실전이 곧 훈련이다 — 뛴 만큼 는다(제보: "유스가 경기를 뛰어도 크는 티가 안 난다").
       예전엔 한 경기도 못 뛰어도 기본 0.52배가 붙어, 벤치에 앉혀 둬도 알아서 자랐다.
       이제 벤치만 지키면 0.30배로 사실상 정체하고, 붙박이 주전은 1.5배 넘게 큰다. */
    let sh = 0.30 + share*1.05;
    /* 어릴수록 실전 한 경기의 값이 크다 — 21세 이하는 경기장에서 배우는 게 훈련장의 몇 배다 */
    if(age<=21) sh *= (1 + share*0.30);
    else if(age<=23) sh *= (1 + share*0.18);
    /* 잘하고 있으면 더 는다 — 자신감이 붙은 유망주는 다음 경기가 또 다르다 */
    if(p.seasonRating>=7.30 && (p.apps||0)>=3) sh *= 1.10;
    else if(p.seasonRating && p.seasonRating<6.50 && (p.apps||0)>=5) sh *= 0.94;
    dir *= (0.25+room*0.92) * sh * (load==null?DEV_REST:DEV_LOAD[clamp(load,0,2)]);
    if(p.inj>0) dir*=0.22;                                      // 재활 중엔 성장이 멈춘다
    if(p.sulk>0) dir*=0.35;                                     // 태업하는 선수는 늘지 않는다
    dir *= (t && t.div===1) ? 1.05 : 0.96;                      // 1부의 훈련 환경이 조금 낫다
    /* 시설이 곧 훈련의 질이다 — 1등급 0.88배 … 5등급 1.16배.
       (예전 0.90~1.10은 room 감쇠를 거치면 한 시즌 차이가 0.4 OVR 남짓이라 체감이 없었다) */
    dir *= 0.88 + (lvEff(trainLv(t))-1)*0.07;   // 🔟
    dir *= 0.88 + (p.morale||65)/100*0.30;                      // 사기가 좋으면 훈련이 잘 붙는다
    /* 감독을 믿는 선수가 코치의 말을 듣는다 — 면담·선물이 성장으로 돌아온다 */
    if(t && t.isUser){
      try{ dir *= clamp(0.93+(aff(p)-50)/100*0.16, 0.88, 1.10); }catch(e){}
      /* 🎩 우리 수석코치의 육성 능력 — 지금까지 유저 팀에만 이 보정이 없었다.
         AI 팀은 예전부터 coachOf(t).dev 를 쓰고 있었으니, 이제 눈금을 맞춘다.
         13 = 보정 없음(예전과 동일) · 18 = +15% · 공석 = −6% */
      try{ dir *= acDevK(); }catch(e){}
      /* 🧤 ⚠ 지적 — 「u21 gk의 경우에는 gk 코치만 영향 받도록 하는 건 어떨까?」
         맞다. 골키퍼는 실제로도 팀 훈련에서 빠져나가 따로 세션을 한다 —
         「오늘은 공격 훈련」이 골키퍼에게 걸릴 이유가 없고, 유소년 코치도 필드 훈련을 본다.
         ─ 골키퍼는 나이와 무관하게 <b>골키퍼 코치 하나만</b> 본다.
           그래서 21세 이하 골키퍼에게 네 배율이 겹쳐 2.6배까지 벌어지던 일이 사라지고,
           대신 「GK 코치가 없으면 골키퍼가 아예 안 큰다」가 된다. */
      if(p.pos==="GK"){
        try{ dir *= acGkK(); }catch(e){}
      } else {
        /* ♟️ 오늘 이 주제를 맡은 코치 — 빈 칸이면 감독 혼자 보는 셈이라 −10% */
        try{ dir *= focCoachK(foc && foc.k); }catch(e){}
        /* 🌱 21세 이하는 유소년 코치의 손을 탄다 */
        try{ if(age<=21) dir *= acYouthK(); }catch(e){}
      }
    }
    /* AI 팀은 감독의 육성 능력이 그 역할을 한다 — 정정용·이정효(18) 밑에서는 눈에 띄게 잘 큰다 */
    else if(t){ try{ const c=coachOf(t); if(c) dir *= clamp(1+(c.dev-16)*0.035, 0.85, 1.12); }catch(e){} }
    if(p.tutor && t){                                            // 베테랑이 붙어 있으면 더 빨리 는다
      const mt=t.players.find(x=>x.id===p.tutor.id);
      if(mt && !mt.sulk) dir *= 1 + clamp(TUTOR_GAIN*((mt.attr?attr20(mt.attr.ldr):10)+(mt.attr?attr20(mt.attr.tea):10))/20, 0.05, 0.35);
      else p.tutor=null;                                         // 튜터가 팀을 떠났거나 태업 중이면 해제
    }
  } else {
    dir *= (1.18 - share*0.38);                                 // 계속 뛰는 선수는 덜 무너진다
    if(p.inj>0) dir*=1.45;                                      // 다치면 몇 주 만에도 뚝 떨어진다
  }
  if(Math.abs(dir)<0.004) return;
  const fb=p.ovr||65;
  const before=rawCA(p, fb);
  let keys=devKeys(p);
  /* 🏋️ 오늘의 주제 — 그 갈래의 항목을 더 자주 뽑는다(다른 항목이 아예 멈추지는 않는다) */
  if(foc && foc.keys && dir>0){
    const hit=foc.keys.filter(k=>(p.attr&&p.attr[k]!=null)||(p.gkA&&p.gkA[k]!=null));
    if(hit.length){
      keys=keys.slice();
      const rep_=Math.max(2, Math.round(keys.length/Math.max(1,hit.length)*1.5));
      for(let r=0;r<rep_;r++) for(const k of hit) keys.push(k);
    }
  }
  for(let i=0;i<DEV_PICK;i++){
    const k=keys[Math.floor(Math.random()*keys.length)];
    const kd=devKind(k);
    // 내려갈 때는 항목마다 속도가 다르다 — 발이 먼저 죽고, 힘은 마지막까지 남는다
    const km=(dir<0 ? (DECAY_MUL[k]||1) : 1);
    const d=dir*DEV_STEP*(dir>0?kd.up:kd.dn)*km*(0.45+Math.random()*1.1);
    // 30대의 몸에는 천장이 있다 — 훈련으로 다시 스무 살의 발을 얻을 수는 없다
    if(dir<0 && AGE_CEIL_W[k]){
      const cap=Math.round(attrCap(p, k, age));
      if(typeof p.attr[k]==="number" && p.attr[k]>cap) p.attr[k]=cap;
    }
    const R2=(x)=>Math.round(x*100)/100;                       // 세이브 용량 — 소수점 두 자리까지만
    if(p.gkA && typeof p.gkA[k]==="number") p.gkA[k]=R2(clamp(p.gkA[k]+d, 12, 99));
    else if(typeof p.attr[k]==="number")    p.attr[k]=R2(clamp(p.attr[k]+d, 12, 99));
  }
  // 세부 능력치가 움직인 만큼 오버롤도 같이 움직인다
  if(p.ovrF===undefined) p.ovrF=p.ovr;
  p.ovrF = Math.round(clamp(p.ovrF + (rawCA(p, fb)-before), 38, 96)*100)/100;
  /* ⚠ 잠재력은 상한선이다 — room 검사만으로는 소수점 성장이 PA 를 1 남짓 넘을 수 있었다 */
  if(dir>0 && p.pot && p.ovrF>p.pot) p.ovrF=p.pot;
  const _ovrBefore=p.ovr;
  p.ovr  = Math.round(p.ovrF);
  /* 📈 성장 체감 — 우리 팀 23세 이하가 한 칸 올라가면 그 자리에서 알려 준다.
     매일 조금씩 오르는 소수점은 눈에 안 보이지만, 칸이 바뀌는 순간은 사건이다.
     ⚠ 「한 칸」의 기준을 내부 눈금에서 화면 눈금(90~200)으로 옮겼다 (요청 — 표기 통일).
        내부 1 ≈ 화면 4 이므로, 마지막으로 알린 값에서 4 이상 오르면 알린다.
        내부 눈금이 올라간 순간만 보면 화면 값이 안 움직인 채로 알림이 나가거나
        반대로 화면이 움직였는데 조용한 일이 생긴다 — 보이는 값을 기준으로 삼는다. */
  const _dspN=(function(){ try{ return dispOvr(p); }catch(e){ return _dspB; } })();
  if(t && t.isUser && (G.season-(p.by||2000))<=23){
    if(p._dspSeen==null) p._dspSeen=_dspB;             // 처음 본 값이 기준선
    if(_dspN < p._dspSeen) p._dspSeen=_dspN;           // 내려갔으면 기준선도 같이 내린다
    if(dir>0 && _dspN-p._dspSeen>=4){
      const _from=p._dspSeen; p._dspSeen=_dspN;
      try{
        const nm2=p.name, ag2=G.season-p.by;
        notify(`📈 <b>${nm2}</b> 성장 — 종합 <b>${_from} → ${_dspN}</b> <span class="small">(잠재 ${(function(){ try{ return dispPot(p); }catch(e){ return "-"; } })()} · ${ag2}세 · ${(p.apps||0)}경기 출전)</span>`,"good");
        if(p.ovr>=(p.pot||99)-1) addMood(`🌟 ${nm2}이(가) 잠재력의 끝에 닿았습니다. 이제는 완성된 선수입니다.`);
        else if((p.apps||0)>=5) addMood(`📈 ${nm2}이(가) 경기를 뛸수록 눈에 띄게 좋아지고 있습니다.`);
      }catch(e){}
    }
  }
  if(p.attr) syncLegacyAttrs(p.attr);
  if(p.pos==="GK" && p.gkA) syncLegacyGk(p);
}
/* 한 달에 한 번 능력치 사진을 찍는다 — 추세 화살표(▲▼)와 성장 그래프의 원본이다.
   저장 용량을 아끼려고 화면 표시값(1~20)의 10배 정수로만 남긴다. */
function attr20f(raw){ return clamp((raw||0)/5, 0.5, 20); }
/* 마지막 촬영으로부터 한 달이 지났는가 (경기일에 걸려 건너뛰는 일이 없도록 날짜 차이로 판단) */
function devSnapDue(){
  if(G.lastSnap===undefined) G.lastSnap=G.day||0;
  if(G.lastSnap>(G.day||0)) G.lastSnap=G.day||0;   // 새 시즌이 되면 날짜가 0으로 돌아간다
  if((G.day||0) - G.lastSnap < DEV_SNAP_DAYS) return false;
  G.lastSnap=G.day||0;
  return true;
}
function devSnapshot(t){
  const isUser=!!t.isUser;
  if(!isUser) return;          // 추세·그래프 기록은 우리 팀 선수만 — 세이브 용량 때문
  for(const p of t.players){
    const cur={};
    if(p.attr) for(const k in p.attr) if(typeof p.attr[k]==="number") cur[k]=p.attr[k];
    if(p.gkA)  for(const k in p.gkA)  if(typeof p.gkA[k]==="number")  cur[k]=p.gkA[k];
    // 추세 — 지난 사진 대비 얼마나 움직였나
    if(p.snap){
      p.trend={};
      for(const k in cur){
        const d=cur[k]-(p.snap[k]!=null?p.snap[k]:cur[k]);
        p.trend[k] = d>=0.45 ? 1 : d<=-0.45 ? -1 : 0;
      }
    }
    for(const k in cur) cur[k]=Math.round(cur[k]*10)/10;
    p.snap=cur;
    const v={}; for(const k in cur) v[k]=Math.round(attr20f(cur[k])*10);
    p.hist=(p.hist||[]).concat([{d:G.day||0, s:G.season, o:p.ovr, v}]).slice(-DEV_HIST_MAX);
  }
}
/* 지난 경기 다음 날부터 다음 경기 전날까지를 한꺼번에 소화한다 */
function advanceCalendar(){
  if(!G.cal) return;
  ensureTrainPlan();
  const nr=userRoundNow();
  const target=(nr<G.cal.roundDay.length)?matchDayOf(nr):G.cal.last;
  const ut=userTeam();
  const log=[];
  for(let d=G.day+1; d<=target; d++){
    if(isMatchDay(d)) continue;
    const pl=dayPlan(d);
    const hurt=applyDayToTeam(ut, pl);
    /* 기사는 mkInjury → injNews 가 이미 냈다 (요청 「배선도 정확하게」) */
    for(const id in G.teams){ const t=G.teams[id]; if(!t.isUser) applyDayToTeam(t, aiDayPlan(t,d)); }
    { const dd=G.day; G.day=d; if(devSnapDue()) for(const id in G.teams) devSnapshot(G.teams[id]); G.day=dd; }
    log.push(pl.t);
  }
  G.day=target;
  return log;
}
/* ── 전술 적응도 ──────────────────────────────────────────────
   같은 전술로 오래 훈련할수록 선수들이 서로의 위치를 안다. 포메이션을 갈아엎으면 그게 리셋된다.
   FM의 전술 친숙도와 같은 개념이되, 이 게임에서는 팀 단위 하나의 숫자로만 다룬다. */
function tacticSig(t){
  const T=TAC(t);
  return [T.formation,T.mentality,T.pass,T.tempo,T.press,T.line,T.width,T.tackle,T.longShot,ctrLv(T)].join("|");
}
/* ⚠ 제보 — 「4-3-3 을 쓰다가 4-2-1-3 으로 바꿔도 친숙도가 그대로다」.
   두 가지가 겹쳐 있었다.
     ① 구조 변경의 무게(20)가 지시 슬라이더 대비 충분히 무겁지 않았다.
     ② 이탈 페널티는 「기준선에서 얼마나 벗어났나」를 재는 방식이라,
        이미 포메이션을 한 번 바꿔 둔 상태에서는 또 바꿔도 이탈량이 그대로였다(=공짜).
        되돌려도 마찬가지였다 — 갈아엎기를 반복해도 값이 안 움직였다.
   ─ 구조 무게를 올리고, 그 위에 「바꿀 때마다 실제로 깎이는」 몫(FAM_FORM_HIT)을 따로 둔다.
     슬라이더(지시)는 되돌리면 돌려받지만, 포메이션은 되돌려도 두 번 새로 익힌 값을 치른다. */
const FAM_PENALTY={formation:28, mentality:5, pass:6, tempo:4, press:5, line:5, width:4, tackle:3, longShot:2, counter:4};
const FAM_FORM_HIT=12;     // 포메이션을 바꿀 때마다 즉시 깎이는 몫 (되돌려받지 않는다)
const FAM_SIG_KEYS=["formation","mentality","pass","tempo","press","line","width","tackle","longShot","counter","crossFq"];
/* ⚠ 제보 — 「전술 하나로 조직력을 올려놨는데, 상대에 맞춰 조금씩 손보면 골때리게 내려간다」.
   예전에는 슬라이더를 움직일 때마다 그 자리에서 깎고 끝이었다. 그래서
     ① 눌렀다가 되돌려도 두 번 깎였고(2→3→2 가 공짜가 아니었다),
     ② 한 경기 준비하며 서너 칸 만지면 조직력이 20 가까이 날아갔다.
   ─ 이제는 「지금까지 드릴한 판(기준선)에서 얼마나 벗어나 있는가」를 본다.
     · 벗어난 총량만큼만 깎인다 — 되돌리면 그만큼 돌려받는다.
     · 지시(슬라이더)는 구조(포메이션)의 절반 무게다. 지시는 경기 전 조정이 정상이다.
     · 전술 훈련(tacDrill)을 하면 벗어난 판이 기준선으로 당겨져 손실이 사라진다. */
const FAM_TWEAK_K=0.5;     // 슬라이더 = 지시. 포메이션(구조)의 절반 무게
function tacDevOf(t, sigStr){
  const base=String(t._sigBase||"").split("|"), now=String(sigStr||tacticSig(t)).split("|");
  if(base.length<2) return 0;
  let pen=0;
  for(let i=0;i<FAM_SIG_KEYS.length;i++){
    if(base[i]===undefined || now[i]===undefined || base[i]===now[i]) continue;
    const k=FAM_SIG_KEYS[i];
    if(k==="formation"){ pen+=FAM_PENALTY[k]; continue; }
    const d=Math.abs((+now[i]||0)-(+base[i]||0));
    pen += FAM_PENALTY[k]*FAM_TWEAK_K*clamp(d/2, 0.5, 2);
  }
  return pen;
}
function noteTacticChange(t, scale){
  if(!t) return;
  const sig=tacticSig(t);
  if(t._sig===undefined){ t._sig=sig; t._sigBase=sig; t._devPen=0; return; }
  if(t._sigBase===undefined){ t._sigBase=t._sig; t._devPen=0; }
  if(t._sig===sig) return;
  const k=(scale===undefined?1:scale);
  const before=t._devPen||0;
  const after=tacDevOf(t, sig);
  /* 🧱 구조가 바뀌었다 — 되돌려도 공짜가 아니다. 선수들은 두 번 새로 익힌 셈이다. */
  const f0=String(t._sig||"").split("|")[0], f1=sig.split("|")[0];
  const hit = (f0 && f1 && f0!==f1) ? FAM_FORM_HIT*k : 0;
  t._sig=sig; t._devPen=after;
  const diff=(after-before)*k + hit;
  const fam0=famOf(t);
  if(diff!==0) t.fam=clamp(fam0-diff, 0, 100);       // 음수면 되돌려받는다
  /* 📉 얼마나 깎였는지 그 자리에서 알려 준다 — 「바꿔도 안 떨어지는 것 같다」는 오해를 막는다 */
  if(hit>0 && t.isUser){
    const drop=Math.round((fam0-famOf(t))*10)/10;
    try{ if(drop>0.5) flash(`📋 포메이션 변경 — 조직력 <b>${Math.round(fam0)} → ${Math.round(famOf(t))}</b> (−${drop})<br><span class="small">다시 손발을 맞추려면 훈련이 필요합니다. 📋 전술 훈련이 가장 빠릅니다.</span>`,"warn");
      else if(drop<-0.5) flash(`📋 원래 포메이션으로 되돌렸습니다 — 조직력 ${Math.round(fam0)} → ${Math.round(famOf(t))}`,"info"); }catch(e){}
  }
}
/* 📋 전술 훈련 — 기준선을 지금 판으로 당겨 온다.
   당긴 만큼 이탈 페널티가 줄고, 줄어든 만큼 조직력이 되돌아온다.
   g 는 오늘 훈련의 크기 — 한 번에 다 새기지는 못하고 며칠에 걸쳐 몸에 밴다. */
function tacDrill(t, g){
  if(!t || !t._sigBase) { if(t) { t._sigBase=tacticSig(t); t._devPen=0; } return 0; }
  const pen=t._devPen||0;
  if(pen<=0.01){ t._sigBase=tacticSig(t); t._devPen=0; return 0; }
  const heal=Math.min(pen, Math.max(1.2, g*2.2));   // 오늘 새길 수 있는 양
  t._devPen=pen-heal;
  t.fam=clamp(famOf(t)+heal, 0, 100);
  if(t._devPen<=0.01){ t._sigBase=tacticSig(t); t._devPen=0; }   // 다 새겼다 — 이 판이 새 기준
  return heal;
}
function famOf(t){ return t && t.fam!=null ? t.fam : 70; }
/* 🧩 ⚠ 제보 원문 — 「특별한 이유 없이 똑같은 전술과 선수들인데도 경기 전 '전술' 의 숙련도와
      경기 도중의 '전술' 숙련도가 차이가 난다(보통 경기 전이 더 높다). 경기 전 숙련도로
      경기 도중의 숙련도를 통일해 달라」.
   원인 — 경기 중 전술판에서 무엇이든 건드리면(포메이션·성향·슬라이더·프리셋) 그 자리에서
     noteTacticChange 가 조직력을 깎는다. 그런데 이 깎임은 <b>그 경기 한정</b>이다 —
     종료 휘슬과 함께 restoreTactic 이 킥오프 시점 값으로 그대로 되돌린다.
     즉 「경기 중에만 낮게 보이는 값」이었고, 감독은 아무것도 안 바꿨다고 느끼는 사소한 조정
     (성향 한 칸, 되돌렸다 다시 놓기, 퇴장 뒤 자리 재배치)에도 숫자가 내려가 있었다.
     되돌릴 값을 경기 내내 낮게 보여 줄 이유가 없다.
   수정 — 경기 중에는 <b>킥오프 시점(preMatchTactic.fam)</b>을 기준으로 삼는다.
     화면(친숙도 게이지·전술 슬롯)과 경기 엔진(famK)이 같은 값을 쓰므로 표시와 실제가 어긋나지 않는다. */
function famLive(t){
  try{
    if(t && t.isUser && preMatchTactic && typeof preMatchTactic.fam==="number"
       && typeof liveM!=="undefined" && liveM && !liveM.done) return preMatchTactic.fam;
  }catch(e){}
  return famOf(t);
}
/* 조직력은 위로 갈수록 더디게 오른다. 58에서 시작해 5주면 '매우 익숙함',
   시즌 중반에 95 근처로 수렴한다. 포메이션을 갈아엎으면(-20) 다시 5주가 든다. */
/* ── 🧓 노장 페널티 ────────────────────────────────────────────
   ⚠ 제보 — 33세 이상은 몸값이 1/5, 판매 거부도 잘 안 걸리는데 경기에서 치르는 대가가
     거의 없었다(체력 소모에 나이 항목 자체가 없었고, 부상 나이 보정도 2D 엔진에만 있었다).
     그래서 겨울에 노장만 쓸어 담으면 한 시즌 만에 최상위 전력이 됐다.
   현실처럼 포지션마다 노화 속도가 다르다 — 골키퍼와 중앙 수비는 완만하고, 측면은 가파르다. */
const AGE_WEAR_POS={GK:0.35, CB:0.70, DM:0.85, CM:1.0, LB:1.20, RB:1.20, LWB:1.25, RWB:1.25,
                    LM:1.25, RM:1.25, CAM:1.05, LW:1.30, RW:1.30, ST:1.05};
function ageWearK(p){
  if(!p) return 1;
  const age=(G.season-(p.by||G.season-26));
  if(age<=29) return 1;
  const slot=(p.prefPos||p.pos||"CM");
  const posK=(p.pos==="GK") ? AGE_WEAR_POS.GK : (AGE_WEAR_POS[slot]!==undefined?AGE_WEAR_POS[slot]:1.0);
  /* 30세부터 붙기 시작해 36세에 최대. 측면 자원은 같은 나이에 훨씬 빨리 닳는다. */
  return 1 + clamp((age-29)/7, 0, 1) * 0.34 * posK;
}
function addFam(t, g){
  const f=famOf(t);
  // 위로 갈수록 둔해진다 — 100은 사실상 닿지 않는 상한이고, 90대 중반에서 균형을 이룬다.
  const room = g>0 ? clamp((100-f)/45, 0, 1) : 1;
  t.fam=clamp(f + g*room, 0, 100);
}
/* 📋 대안 전술(비활성 슬롯) 조직력 — 훈련장에서 함께 익힌다.
   ⚠ 제보 — 비활성 슬롯의 fam 은 그 슬롯을 떠나던 순간 값에 얼어 있어서, B·C 플랜을
     준비하는 게 사실상 불가능했다. 현실의 선수단은 주 전술 외에 대안 판도 함께 훈련한다.
     다만 실전에서 굴린 판만큼은 아니므로 활성 슬롯의 35%만 쌓인다. */
const FAM_BENCH_RATE=0.35;
function addFamPresets(t, g){
  if(!t || !t.tactic || !Array.isArray(t.tactic.presets)) return;
  const cur=clamp(t.tactic.presetCur|0, 0, PRESET_N-1);
  for(let i=0;i<t.tactic.presets.length;i++){
    if(i===cur) continue;
    const ps=t.tactic.presets[i]; if(!ps || typeof ps.fam!=="number") continue;
    /* 📋 최근 그 판으로 실전을 치렀다면 훈련장에서 쉬어도 손발이 거의 풀리지 않는다 (제보) */
    const gg=g*FAM_BENCH_RATE*((g<0 && ps.useL>0)?FAM_USE_REST:1);
    const room = gg>0 ? clamp((100-ps.fam)/45, 0, 1) : 1;
    ps.fam=clamp(ps.fam + gg*room, 0, 100);
  }
}
/* 📋 이 전술로 최근에 실전을 치렀는가 — 날짜가 아니라 남은 일수로 센다.
   (달력은 시즌마다 되감기므로 절대 일자로 재면 시즌이 바뀔 때 어긋난다) */
function markTacticUsed(t){ if(t) t._famUseL=FAM_USE_DAYS; }
function famFresh(t){ return !!(t && t._famUseL>0); }
function famUseTick(t){
  if(!t) return;
  if(t._famUseL>0) t._famUseL--;
  const ps=t.tactic&&t.tactic.presets;
  if(Array.isArray(ps)){
    const cur=clamp(t.tactic.presetCur|0, 0, PRESET_N-1);
    for(let i=0;i<ps.length;i++){ if(i===cur) continue; if(ps[i] && ps[i].useL>0) ps[i].useL--; }
  }
}
function famLabel(v){
  return v>=92?"완벽히 몸에 뱄다":v>=80?"매우 익숙함":v>=68?"익숙함":v>=54?"익히는 중":v>=38?"어색함":"전혀 맞지 않음";
}
/* 경기에 미치는 영향 계수 — 70을 기준선으로 -1.5 ~ +1.0.
   패스 정확도·수비 간격·압박 타이밍에 곱해 쓴다. 체감은 되지만 전력 차를 뒤집지는 못한다. */
function famK(t){ return clamp((famLive(t)-70)/30, -1.5, 1); }
function playRound(div, skipUser){
  /* 🟥 리그 라운드를 굴리기 전에 징계 문맥을 리그로 맞춘다 — 프리시즌의 「친선」 문맥이
     남아 있으면 리그 경기에 정지 선수가 뛴다 (제보: 대회 간 징계 완전 분리) */
  try{ banCtxSync(); }catch(e){}
  const fix=div===1?G.k1Fix:G.k2Fix;
  const r=div===1?G.r1:G.r2;
  if(r>=fix.length) return;
  for(const [hid,aid] of fix[r]){
    if(skipUser&&(hid===G.userTeamId||aid===G.userTeamId)) continue;
    const M=instantMatch(G.teams[hid],G.teams[aid],{});
    G.results.push({s:G.season,div,r:r+1,hid,aid,hg:M.hg,ag:M.ag,att:M.att||0,aatt:M.aatt||0});
    try{ aiMatchIncome(M); }catch(e){}
    try{ matchNews(M, div, r+1); }catch(e){}
    try{ socialOnReferee(M); }catch(e){}
  }
  if(div===1) G.r1++; else G.r2++;
  try{ leagueNews(div, div===1?G.r1:G.r2); }catch(e){}
}
function resolvePOid(x){
  return x==="W1"?G.poW1 : x==="W2"?G.poW2
       : x==="WA"?G.poWA : x==="WB"?G.poWB
       : x==="LPO"?G.poRunnerUp : x;   // LPO = K2 PO 결승 패자(승강PO 진출)
}
/* ⚠ 1소수 연봉을 서른 개 더하면 110.29999999999997 같은 먼지가 남는다.
   이 값이 화면 곳곳(협상 무산 안내·연봉 여유 등)으로 흘러가므로 합산 지점에서 끊는다. */
function totalWage(t){ return Math.round(t.players.reduce((s,p)=>s+(p.wage||0),0)*100)/100; }
/* ── 구단 재정 구조 ──────────────────────────────────────────
   FM처럼 두 주머니를 나눈다.
     · budget   — 이적 예산(현금). 이적료·위약금·에이전트 비용을 여기서 쓴다.
     · wageCap  — 연봉 총액 상한. 여기를 넘기면 구단주가 가만있지 않는다.
   K리그는 이적료 시장이 작고(리그 전체 연 100억 미만) 연봉 총액은 크다(1부 1300억+).
   그래서 이적 예산은 몇 억~수십억, 연봉 상한은 팀당 수십~150억 규모로 잡는다. */
function setupFinance(t){
  const bill=totalWage(t);
  // 연봉 상한 — 현재 지출에 구단 규모만큼의 여유를 얹는다
  t.wageCap = Math.round(Math.max(bill*1.10, bill + (t.div===1?9:3) + t.fans*0.25));
  // 이적 예산 — 원래 데이터의 budget(구단 규모 지표)을 실제 K리그 이적 지출 규모로 환산
  /* 이적 예산 — 몸값 곡선을 실제 K리그 이적료 규모(최상급 25~30억)로 올렸으므로
     구단 이적 예산도 같은 비율로 함께 올린다. 한쪽만 바꾸면 리그 전체가 아무도 못 사는 시장이 된다. */
  if(!t._finV3){ const raw = t._finV2 ? t.budget/0.14 : t.budget;
    t.budget = Math.round(Math.max(t.div===1?16:6, raw*0.58)*10)/10; t._finV2=1; t._finV3=1; }
  t._split=null; delete t._pool;             // 재배분 비율 초기화(_pool 은 이제 쓰지 않는다)
}
function t_needFin(t){ return !t.wageCap || !t._finV2; }
/* 시즌이 바뀌면 구단 규모(성적·팬)에 따라 연봉 상한을 다시 잡는다 */
function setupFinance2(t){
  const bill=totalWage(t);
  const grow=(t.div===1?1.0:0.72)*(1+clamp((t.fans-25)/120,-0.15,0.25));
  t.wageCap=Math.round(Math.max(bill*1.05, (t.wageCap||bill)*0.9 + bill*0.2 + (t.div===1?10:4)*grow));
  delete t._pool;
  if(t._split!=null) applyBudgetSplit(t, t._split*100);
}
/* ── 예산 재배분 (FM식 슬라이더) ────────────────────────────
   구단이 감독에게 주는 돈은 하나의 덩어리다. 그걸 이적료로 쓸지 연봉으로 쓸지는 감독이 정한다.
   이적 예산을 최대로 당기면 연봉 상한이 줄어 좋은 선수에게 줄 주급이 모자라고,
   반대로 연봉 쪽에 몰아 두면 큰 이적료를 감당할 현금이 없다.
   환산비: 이적 예산 1억을 포기하면 연봉 상한 0.55억이 늘어난다(연봉은 매년 나가는 돈이라 더 비싸다). */
const BUD_CONV=0.55;
const BUD_MIN=0.15, BUD_MAX=0.85;      // 전체 재원 중 이적 예산이 차지할 수 있는 비율 범위
/* 재배분의 기준이 되는 "가용 재원" = 이적 현금 + 남은 연봉 여유를 현금으로 환산한 값.
   ⚠ 예전에는 이 값을 t._pool 에 한 번 계산해 두고 시즌 내내 재사용했다. 그 사이 선수를 팔거나
   입장 수입이 들어와 t.budget 이 늘어도 _pool 은 그대로였고, 슬라이더를 건드리는 순간
   t.budget = _pool * 비율 로 덮어써져 그동안 번 돈이 통째로 증발했다.
   그래서 메모를 없애고 매번 현재 상태에서 다시 계산한다.
   (budget' = pool*r, room' = pool*(1-r)*BUD_CONV 이므로 다시 계산해도 pool 은 그대로 — 값이 튀지 않는다) */
function budPool(t){
  return Math.round((t.budget + ((t.wageCap||0)-totalWage(t))/BUD_CONV)*10)/10;
}
/* ═══════════════════════════════════════════════════════════════════════════
   🏢 모기업 실적 → 구단 예산
   ⚠ 여태 연결이 <b>한 방향뿐</b>이었다. 구단 성적이 모기업 주가를 움직이는 길(stkClubEffect)은
      있는데, 그 반대 — 모기업이 흔들리면 구단이 쪼그라드는 길 — 이 없었다.
      `stkOfTeam()` 은 정의만 되어 있고 <b>어디서도 쓰이지 않았다</b>.
   ─ 실제 K리그가 그렇다. 기업구단 예산의 대부분은 모기업 지원금이고, 모기업이 어려워지면
     지원금이 먼저 깎인다. 선수를 팔아야 하고, 심하면 매각·해체까지 간다.
   ─ 체력(ownHealth)은 <b>주가 / 90일 평균</b>이다. 1.0 이 평시, 아래로 내려가면 긴축이다.
     시민·도민구단은 모기업이 없으므로 언제나 1.0 (시의회 추경은 기존 경로 그대로).      */
const OWN_H_LO=0.86, OWN_H_HI=1.22;   // 이 아래면 긴축, 이 위면 특별 지원
const OWN_H_MIN=0.55, OWN_H_MAX=1.45; // 계수 상·하한 — 예산이 0 이 되거나 폭주하지 않게
const OWN_EV_COOL=45;                 // 같은 구단에 사건이 연달아 나지 않게 (일)
function ownStock(t){ try{ return t?stkOfTeam(t.id):null; }catch(e){ return null; } }
function ownHealth(t){
  try{
    if(!t) return 1;
    if(clubType(t).k!=="corp") return 1;          // 모기업이 없다
    const s=ownStock(t); if(!s || s.dead) return (s&&s.dead)?OWN_H_MIN:1;
    const H=(s.hist||[]).slice(-90);
    if(H.length<20) return 1;                     // 아직 볼 기록이 없다
    const avg=H.reduce((a,b)=>a+b,0)/H.length;
    if(!(avg>0)) return 1;
    return clamp(s.p/avg, OWN_H_MIN, OWN_H_MAX);
  }catch(e){ return 1; }
}
/* 예산에 곱하는 계수 — 체력 1.0 이 1.0 이 되도록 완만하게 편다 */
function ownBudK(t){
  const h=ownHealth(t);
  return clamp(1 + (h-1)*0.55, 0.62, 1.30);
}
function ownLabel(t){
  const h=ownHealth(t);
  return h<=0.70 ? {t:"위기", c:"#f85149"} : h<OWN_H_LO ? {t:"긴축", c:"#ff9d5c"}
       : h<=OWN_H_HI ? {t:"안정", c:"var(--sub)"} : {t:"호황", c:"var(--green)"};
}
/* ═══════════════════════════════════════════════════════════════════════════
   🏳️ 모기업 부도 → 구단 매각
   실제 K리그에서 여러 번 있었던 일이다. 모기업이 무너지면 구단은 매물이 되고,
   ① 다른 기업이 인수하거나 ② 연고 지자체가 떠안아 시민구단이 된다.
   ─ 해체는 넣지 않는다. 리그 구조가 깨지고 일정·순위표가 통째로 흔들린다.
     대신 「아무도 안 나서면 지자체가 마지막으로 떠안는다」로 간다 — 실제로도 그랬다. */
const SALE_DAYS=[18,32];        // 매각 절차에 걸리는 기간
const SALE_CORP_P=0.55;         // 기업 인수 성사 확률 — 나머지는 지자체 인수
const CITY_OF={ulsan:"울산광역시", jeonbuk:"전주시", daejeon:"대전광역시", gimcheon:"김천시",
  gangwon:"강원도", gwangju:"광주광역시", seoul:"서울특별시", pohang:"포항시", jeju:"제주특별자치도",
  anyang:"안양시", incheon:"인천광역시", bucheon:"부천시", suwon:"수원시", daegu:"대구광역시",
  suwonfc:"수원시", busan:"부산광역시", jeonnam:"전라남도", seoule:"서울특별시", seongnam:"성남시",
  cheongju:"청주시", asan:"아산시", hwaseong:"화성시", gimpo:"김포시", gyeongnam:"경상남도",
  cheonan:"천안시", ansan:"안산시", gimhae:"김해시", yongin:"용인시", paju:"파주시"};
function cityOf(t){ return (t && CITY_OF[t.id]) || `${t?t.short:""}시`; }
/* 🌍 구단을 «두루뭉술하게» 부르는 법 — 이적시장 루머는 실명을 안 쓴다.
     「지방구단 선수 A가 기업구단에 갈 예정!」 이 장르의 문법이다. */
const RUM_CAPITAL=new Set(["seoul","seoule","incheon","suwon","suwonfc","seongnam","anyang",
  "bucheon","ansan","gimpo","hwaseong","yongin","paju"]);
function rumVague(t){
  try{
    if(!t) return "어느 구단";
    const out=[];
    const ct=(typeof clubType==="function")?clubType(t):{k:"civic"};
    if(ct.k==="corp") out.push("기업구단","모기업 있는 구단");
    else out.push("시민구단","시도민구단");
    out.push(RUM_CAPITAL.has(t.id) ? "수도권 구단" : "지방구단");
    out.push(RUM_CAPITAL.has(t.id) ? "수도권 팀" : "지방 팀");
    if(t.div===1) out.push("1부 구단","K리그1 팀"); else out.push("2부 구단","K리그2 팀");
    /* 순위가 잡히면 성적으로도 부른다 */
    try{
      const tb=(typeof tableOf==="function")?tableOf(t.div):null;
      if(tb&&tb.length){ const i=tb.findIndex(x=>(x.t?x.t.id:x.id)===t.id);
        if(i>=0){ const q=i/tb.length;
          out.push(q<0.25?"상위권 팀":q<0.6?"중위권 팀":"하위권 팀"); } }
    }catch(e){}
    if((t.form||[]).slice(-3).join("")==="WWW") out.push("요즘 잘나가는 팀");
    return pick(out);
  }catch(e){ return "어느 구단"; }
}
/* 🗓️ 시기 — 게시판이 무슨 얘기를 하는 계절인가 */
function rumWhen(){
  try{
    const d=(typeof dateOfDay==="function")?dateOfDay(G.day||0):new Date();
    const mo=d.getMonth()+1;
    if(mo===11||mo===12||mo===1) return "stove";    // 스토브리그 — 이적시장이 게시판을 덮는다
    if(mo===2) return "pre";                         // 프리시즌 — 기대와 걱정
    if(mo===6||mo===7) return "summer";              // 여름 이적시장
    return "league";                                 // 시즌 중 — 목격담·폼·부상
  }catch(e){ return "league"; }
}

function saleState(){ if(!G.sale) G.sale={}; return G.sale; }
/* 매각 절차 시작 — 모기업이 부도났다 */
function clubSaleStart(t){
  try{
    if(!t) return;
    const SL=saleState(); if(SL[t.id]) return;             // 이미 진행 중
    const ct=clubType(t), mine=!!t.isUser;
    SL[t.id]={due:(G.day||0)+SALE_DAYS[0]+R(SALE_DAYS[1]-SALE_DAYS[0]), from:ct.o};
    addNews(`🏳️ <b>${ct.o} 부도 — ${t.name} 매각 절차 착수</b>`, "warn", "club",
      {cat:"club", ic:"🏳️", tone:-1, tid:t.id, src:"K리그 공식",
       head:`${t.name}, 새 주인을 찾는다`,
       sub:`모기업 ${ct.o}가 무너지면서 구단이 매물로 나왔다. 연맹은 시즌 운영에 차질이 없도록 인수 절차를 서두르겠다고 밝혔다. 인수자가 나서지 않으면 연고 지자체가 떠안는 방안도 거론된다.`});
    if(mine){
      try{ notify(`🏳️ <b>${ct.o}가 부도났습니다.</b><br>구단이 매각 절차에 들어갑니다 — 새 주인이 정해질 때까지 <b>예산 증액 요청이 막힙니다.</b><br><span class="small">기업 인수와 지자체 인수 중 어느 쪽이 될지는 아직 알 수 없습니다.</span>`,"warn"); }catch(e){}
      try{ addMood(`🏳️ 모기업이 무너졌습니다. 선수단이 술렁입니다 — "우리 어떻게 되는 겁니까?"`); }catch(e){}
      try{ for(const q of (t.players||[])) q.morale=clamp((q.morale||70)-6, 20, 99); }catch(e){}
      try{ socialFill(["모기업 부도라니... 구단은 어떻게 되는 거야","제발 누구라도 인수해줘라","20년 응원했는데 이런 일이"], 3+R(3), -1, {t:t.short}); }catch(e){}
      try{ fmkFill([["{t} 모기업 부도 ㄷㄷ 이거 진짜 큰일인데",-1],
        ["{t} 인수 후보 나왔냐? 아직이면 시청밖에 없다",-1],
        ["시민구단 되면 예산 반토막인데",-1]], 3+R(2), {t:t.short}); }catch(e){}
    } else {
      try{ fmkFill([["{t} 모기업 부도래 남 일 같지가 않다",-1]], 1+R(2), {t:t.short}); }catch(e){}
    }
  }catch(e){}
}
/* 인수 후보 — 상장사 중에서 고른다. 이미 구단을 가진 기업은 제외한다(1기업 1구단) */
function saleBidders(t){
  try{
    const S=stkState(); if(!S) return [];
    const owned=new Set(Object.values(G.teams||{}).map(x=>clubType(x).o));
    return (S.list||[]).filter(x=>!x.dead && !x.tid && !owned.has(x.n))
      .sort((a,b)=>stkCap(b)-stkCap(a)).slice(0, 8);
  }catch(e){ return []; }
}
/* 매각 결론 */
function clubSaleResolve(t){
  try{
    const SL=saleState(), rec=SL[t.id]; if(!rec) return;
    delete SL[t.id];
    const mine=!!t.isUser, city=cityOf(t);
    const bids=saleBidders(t);
    const corp = bids.length && Math.random()<SALE_CORP_P;
    if(corp){
      /* 🏢 기업 인수 — 새 모기업이 생기고 예산도 회복된다 */
      const b=bids[R(Math.min(4,bids.length))];
      if(!G.ownerNames) G.ownerNames={};
      if(!G.ownerKinds) G.ownerKinds={};
      G.ownerNames[t.id]=b.n; G.ownerKinds[t.id]="corp";
      b.tid=t.id;                                   // 그 종목이 이 구단의 모기업이 된다
      const add=Math.round(Math.max(3, budPool(t)*0.30)*10)/10;
      t.budget=Math.round(((t.budget||0)+add)*10)/10;
      addNews(`🤝 <b>${b.n}, ${t.name} 인수</b> — 새 모기업으로`, "good", "club",
        {cat:"club", ic:"🤝", tone:1, tid:t.id, src:"K리그 공식",
         head:`${t.name}, ${b.n} 품으로`,
         sub:`${rec.from} 부도 이후 표류하던 구단이 새 주인을 찾았다. ${b.n}은 구단 운영을 정상화하겠다며 지원금 ${add}억을 우선 투입하기로 했다.`});
      if(mine){
        try{ notify(`🤝 <b>${b.n}</b>이(가) 구단을 인수했습니다.<br>새 모기업의 첫 지원금 <b>${add}억</b>이 들어왔습니다.`,"good"); }catch(e){}
        try{ addMood(`🤝 새 모기업이 정해졌습니다. 라커룸이 한숨 돌렸습니다.`, "good"); }catch(e){}
        try{ for(const q of (t.players||[])) q.morale=clamp((q.morale||70)+5, 20, 99); }catch(e){}
        try{ adjustTrust("fans", +3, "구단 인수 성사"); }catch(e){}
        try{ socialFill(["살았다 진짜 살았다","인수 확정 떴다 눈물 난다","{t} 다시 시작이다"], 3+R(3), 1, {t:t.short}); }catch(e){}
        try{ fmkFill([["{t} 인수 확정 ㅊㅋ 부럽다 진짜",1],["새 모기업 돈 좀 있냐?",0]], 2+R(2), {t:t.short}); }catch(e){}
      }
    } else {
      /* 🏙️ 지자체 인수 — 시민구단이 된다. 살아남지만 규모는 줄어든다 */
      if(!G.ownerNames) G.ownerNames={};
      if(!G.ownerKinds) G.ownerKinds={};
      G.ownerNames[t.id]=`${city}`; G.ownerKinds[t.id]="civic";
      try{ stkSyncClubListing(t); }catch(e){}       // 상장 종목은 비상장 전환으로 정리된다
      const cut=Math.round(Math.max(1, budPool(t)*0.22)*10)/10;
      t.budget=Math.round(Math.max(0,(t.budget||0)-cut)*10)/10;
      addNews(`🏙️ <b>${city}, ${t.name} 인수 — 시민구단으로 전환</b>`, "warn", "club",
        {cat:"club", ic:"🏙️", tone:0, tid:t.id, src:"K리그 공식",
         head:`${t.name}, 시민구단으로 새출발`,
         sub:`기업 인수자가 끝내 나서지 않으면서 ${city}가 구단을 떠안았다. 리그 잔류는 확정됐지만 운영 예산은 ${cut}억 줄어든다. "규모는 작아져도 축구는 계속된다"는 것이 시의 설명이다.`});
      if(mine){
        try{ notify(`🏙️ <b>${city}</b>가 구단을 인수했습니다 — <b>시민구단</b>으로 전환됩니다.<br>리그에는 남지만 예산이 <b>${cut}억</b> 줄었습니다.<br><span class="small">이제 예산은 모기업이 아니라 시의회 추경으로 움직입니다.</span>`,"warn"); }catch(e){}
        try{ addMood(`🏙️ 시민구단으로 전환됩니다. 팀은 남았지만 씀씀이는 줄어듭니다.`); }catch(e){}
        try{ socialFill(["시민구단이라도 남은 게 어디냐","돈은 없어도 팀은 있다","이제 진짜 우리 팀이네"], 3+R(3), 0, {t:t.short}); }catch(e){}
        try{ fmkFill([["{t} 시민구단 전환 확정 ㅠㅠ 그래도 살았다",0],
          ["{t} 이제 예산 반토막인데 감독 불쌍하다",-1],
          ["시민구단도 잘하는 팀 많다 힘내라",1]], 3+R(2), {t:t.short}); }catch(e){}
      }
    }
  }catch(e){}
}
/* 매각 진행 중인가 — 예산 증액 요청 등을 막는 데 쓴다 */
function clubForSale(t){ try{ return !!(t && saleState()[t.id]); }catch(e){ return false; } }
/* 하루에 한 번 — 모기업 사정이 실제로 구단 예산을 움직인다 */
function ownTick(){
  try{
    const S=stkState(); if(!S) return;
    if(!G.own) G.own={last:{}};
    /* 🏳️ 진행 중인 매각의 결론이 오늘인가 */
    { const SL=saleState();
      for(const tid in SL){ const rec=SL[tid];
        if(rec && (G.day||0)>=rec.due){ const tt=G.teams[tid]; if(tt) clubSaleResolve(tt); else delete SL[tid]; } } }
    for(const t of Object.values(G.teams||{})){
      if(!t || clubType(t).k!=="corp") continue;
      const s=ownStock(t);
      const dead=!s;                                  // 상장폐지 = 모기업 부도
      const h=ownHealth(t);
      if(!dead && h>=OWN_H_LO && h<=OWN_H_HI) continue;
      if(((G.day||0)-(G.own.last[t.id]||-999)) < OWN_EV_COOL) continue;
      G.own.last[t.id]=G.day||0;
      const ct=clubType(t), pool=budPool(t), mine=!!t.isUser;
      if(dead) clubSaleStart(t);                      // 🏳️ 모기업 부도 → 매각 절차
      if(dead || h<=0.70){
        /* 🔻 긴급 지원금 삭감 — 모기업이 흔들리면 구단이 먼저 줄인다 */
        const cut=Math.round(Math.max(1, pool*(dead?0.35:0.18))*10)/10;
        t.budget=Math.round(Math.max(0, (t.budget||0)-cut)*10)/10;
        const head=dead ? `${ct.o} 부도 — ${t.short} 지원금 전면 중단`
                        : `${ct.o} 실적 악화 — ${t.short} 지원금 ${cut}억 삭감`;
        try{ addNews(`🔻 <b>${head}</b>`, "warn", "club",
          {cat:"club", ic:"🔻", tone:-1, tid:t.id, src:"산업 담당",
           head, sub: dead
             ? `모기업이 상장폐지되면서 구단 운영자금 조달 경로가 끊겼다. 겨울 이적시장에서 주력 선수 매각이 불가피할 전망이다.`
             : `모기업 주가가 90일 평균 대비 ${Math.round((1-h)*100)}% 낮은 수준에 머물면서, 구단 지원금이 ${cut}억 줄었다.`}); }catch(e){}
        if(mine){
          try{ notify(`🔻 <b>${ct.o}</b>의 사정이 나빠졌습니다.<br>구단 이적 예산이 <b>${cut}억</b> 삭감됐습니다. <span class="small">(모기업 체력 ${Math.round(h*100)}%)</span>`,"warn"); }catch(e){}
          try{ addMood(`🔻 모기업 사정으로 예산이 ${cut}억 깎였습니다. 프런트도 난감한 표정입니다.`); }catch(e){}
          try{ socialFill(["모기업이 흔들리는데 구단이 무사할 리가 없지","돈 없다는 소리 또 나오겠네","이러다 선수 다 팔리는 거 아니냐"], 2+R(2), -1, {t:t.short}); }catch(e){}
          try{ fmkFill([["{t} 모기업 실적 봤냐 이거 구단까지 온다",-1],
            ["{t} 겨울에 주력 팔릴 각",-1],["모기업 주가로 구단 예산 예측하는 시대",0]], 2+R(2), {t:t.short}); }catch(e){}
        }
      } else if(h>=OWN_H_HI){
        /* 🔺 특별 지원금 — 모기업이 좋으면 구단에도 돈이 돈다 */
        const add=Math.round(Math.max(1, pool*0.16)*10)/10;
        t.budget=Math.round(((t.budget||0)+add)*10)/10;
        const head=`${ct.o} 호실적 — ${t.short}에 특별 지원금 ${add}억`;
        try{ addNews(`🔺 <b>${head}</b>`, "good", "club",
          {cat:"club", ic:"🔺", tone:1, tid:t.id, src:"산업 담당",
           head, sub:`모기업 주가가 90일 평균을 ${Math.round((h-1)*100)}% 웃돌면서 구단 지원금이 늘었다. 겨울 이적시장에서 움직일 여지가 생겼다.`}); }catch(e){}
        if(mine){
          try{ notify(`🔺 <b>${ct.o}</b>의 실적이 좋습니다.<br>특별 지원금 <b>${add}억</b>이 이적 예산에 들어왔습니다.`,"good"); }catch(e){}
          try{ addMood(`🔺 모기업 특별 지원금 ${add}억이 들어왔습니다. 프런트 분위기가 밝습니다.`, "good"); }catch(e){}
          try{ fmkFill([["{t} 모기업 실적 좋다던데 이거 영입 기대해도 됨?",1],
            ["{t} 지원금 들어왔다는데 누구 데려오냐",1]], 1+R(2), {t:t.short}); }catch(e){}
        }
      }
    }
  }catch(e){}
}
function budSplit(t){ if(t._split==null) t._split=0.5; return t._split; }
/* 슬라이더 값(0~100 = 이적 예산 비중)으로 두 주머니를 다시 나눈다 */
function applyBudgetSplit(t, pct){
  const pool=budPool(t);
  const r=clamp(pct/100, BUD_MIN, BUD_MAX);
  t._split=r;
  const bill=totalWage(t);
  t.budget=Math.round(pool*r*10)/10;
  t.wageCap=Math.round((bill + pool*(1-r)*BUD_CONV)*10)/10;
  // 이미 지출한 연봉보다 상한이 낮아질 수는 없다
  if(t.wageCap<bill) t.wageCap=Math.round(bill*10)/10;
}
function setBudgetSplit(v){
  const t=userTeam();
  applyBudgetSplit(t, +v);
  saveGame(); show("finance");
}
function wageRoom(t){ return Math.round(((t.wageCap||0)-totalWage(t))*10)/10; }
function wagePct(t){ return t.wageCap ? Math.round(totalWage(t)/t.wageCap*100) : 0; }
/* 팀 수에 따라 달라지는 값들 — 12팀: 정규 33R + 파이널 5R / 14팀: 39R + 6R */
function k1N(){ return (G.k1||[]).length||12; }
function k1Robin(){ return k1N()-1; }
/* 스플릿이 붙는 지점 — 14팀(2027~)은 스플릿이 없다. 절대 도달하지 않는 값을 돌려준다. */
function splitOn(){ return k1N()<14; }
function splitAt(){ return splitOn() ? k1Robin()*3 : 99999; }
/* 파이널 라운드 수 — 그룹 인원이 짝수면 (인원-1) 라운드, 홀수면 부전승이 끼므로 인원만큼 돈다.
   12팀 → 6팀씩 5R / 14팀 → 7팀씩 7R (매 라운드 한 팀은 쉰다). */
function splitRounds(){
  if(!splitOn()) return 0;                     // 14팀 — 스플릿 폐지 (3로빈 39R로 끝)
  const half=Math.floor(k1N()/2);
  return half%2===0 ? half-1 : half;           // 6팀 5R
}
function makeSplit(){
  if(!splitOn()){ G.splitDone=true; return; }   // 14팀 — 스플릿 없음
  G.splitDone=true;
  const tbl=tableOf(1), half=Math.floor(k1N()/2), R2=splitRounds();
  const A=tbl.slice(0,half).map(t=>t.id), B=tbl.slice(half).map(t=>t.id);
  const fA=roundRobin(A).slice(0,R2), fB=roundRobin(B).slice(0,R2);
  for(let i=0;i<R2;i++) G.k1Fix.push([...(fA[i]||[]),...(fB[i]||[])]);
  G.finalA=A; G.finalB=B;
  /* 🅰️🅱️ ⚠ 제보 원문 — 「K리그2 34 라운드가 끝난 이후 오피스 탭에서 파이널 라운드 확정이라는
     문구가 나오는데, K리그2는 2026 시즌에 상위, 하위 스플릿이 없는 2라운드 로빈(팀당 32경기,
     총 34라운드) 제도를 채택해 운영하고 있으므로 문구를 삭제 해주시면 감사하겠습니다 /
     또한, 팝업에도 상위, 하위 스플릿이 확정 되었다고 뜨는데 마찬가지로 … 삭제 해주시면
     감사하겠습니다」.
     원인 — 스플릿은 K리그1 규정인데 안내(구단 소식 · 배너 · 진행 팝업)를 부(部) 구분 없이
       모두에게 띄웠다. 게다가 K리그2 팀은 파이널 A 명단에 있을 수가 없으니 indexOf 가 -1 이라
       배너가 「파이널 B 입니다 — 남은 5경기는 같은 그룹끼리만」이라고 잘못 단정했다.
     수정 — K리그1 감독(과 리그 전체를 지켜보는 무직 상태)에게만 알린다. */
  let _splitTell=true;
  try{ const _t=userTeam(); _splitTell = !!G.jobless || !!(_t && _t.div===1); }catch(e){}
  if(_splitTell) addNews(`📢 ${divName(1)} 파이널 라운드 스플릿 확정! 파이널A: `+A.map(id=>G.teams[id].short).join(", "));
  /* 📊 스플릿 돌입 — 리그의 성격이 통째로 바뀌는 순간이다. 뉴스 한 줄로 흘려보내지 않는다.
     ⚠ 2027 시즌부터는 14팀 3로빈(39R)으로 바뀌어 스플릿 자체가 없다 —
        splitOn() 이 false 라 이 함수는 맨 위에서 돌아가므로 안내도 뜨지 않는다. (제보) */
  try{
    if(!_splitTell) return;                                    // K리그2 감독에게는 남의 리그 일이다 (제보)
    if(!G.jobless) G.splitPop={s:G.season, r:R2, A:A.slice(), B:B.slice()};
    const _u=userTeam();
    if(_u && !G.jobless) notify(`📊 <b>파이널 라운드 스플릿 확정</b> — ${_u.short}은/는 <b>${A.indexOf(_u.id)>=0?"파이널 A":"파이널 B"}</b>입니다. 남은 ${R2}경기는 같은 그룹끼리만 치릅니다.`,
                  A.indexOf(_u.id)>=0?"good":"warn");
  }catch(e){}
}
/* ---------- 승강 PO ---------- */
/* 2026 시즌만 규정이 다르다 — 김천 상무 FC가 무조건 강등되고, K리그1이 14팀으로 늘어난다.
   그래서 승격이 강등보다 많다. 2027년부터는 다시 '1+2 승강제'로 돌아간다. */
function isExpansionSeason(){ return G.season===2026; }
function buildPOQueue(){
  const t1=tableOf(1), t2=tableOf(2);
  const last=t1.length-1;
  if(isExpansionSeason()){
    /* 2026 — K2 3~6위 4팀 플레이오프.
         준PO: 3위 vs 6위 / 4위 vs 5위 (상위 팀 홈, 무승부 시 상위 팀 진출)
         PO  : 두 승자 단판 → 우승팀 자동 승격
       김천이 최하위면 여기서 끝(3팀 승격 · 1팀 강등).
       김천이 최하위가 아니면 PO 준우승팀이 K1 최하위와 승강PO(홈앤어웨이). */
    const q=[
      {tag:"K2 준PO A", h:t2[2].id, a:t2[5].id, note:"3위 vs 6위 · 단판 (무승부 시 3위 진출)", drawWin:"h"},
      {tag:"K2 준PO B", h:t2[3].id, a:t2[4].id, note:"4위 vs 5위 · 단판 (무승부 시 4위 진출)", drawWin:"h"},
      {tag:"K2 PO 결승", h:"WA", a:"WB", note:"단판 · 승자 자동 승격 (무승부 시 상위 시드)", drawWin:"h"}
    ];
    const gimLast = t1[last] && t1[last].id==="gimcheon";
    if(!gimLast){
      q.push({tag:"승강PO 1차전", h:"LPO", a:t1[last].id, note:`K1 ${t1.length}위 vs K2 PO 준우승`, drawWin:null, agg:1});
      q.push({tag:"승강PO 2차전", h:t1[last].id, a:"LPO", note:"합산 승부 (동률 시 K1 잔류)", drawWin:"h", agg:2});
    }
    return q;
  }
  /* 2027~ — 기존 1+2 승강제. 최하위 자동 강등, 11위·10위가 각각 승강PO. */
  return [
    {tag:"K2 준PO", h:t2[3].id, a:t2[4].id, note:"4위 vs 5위 · 단판 (무승부 시 4위 진출)", drawWin:"h"},
    {tag:"K2 PO", h:t2[2].id, a:"W1", note:"3위 vs 승자 · 단판 (무승부 시 3위 진출)", drawWin:"h"},
    {tag:"승강PO 1차전", h:"W2", a:t1[last-2].id, note:`K1 ${last-1}위 vs K2 PO승자`, drawWin:null, agg:1},
    {tag:"승강PO 2차전", h:t1[last-2].id, a:"W2", note:"합산 승부 (동률 시 K1 잔류)", drawWin:"h", agg:2},
    {tag:"승강PO(2위) 1차전", h:t2[1].id, a:t1[last-1].id, note:`K1 ${last}위 vs K2 2위`, drawWin:null, agg:1},
    {tag:"승강PO(2위) 2차전", h:t1[last-1].id, a:t2[1].id, note:"합산 승부 (동률 시 K1 잔류)", drawWin:"h", agg:2}
  ];
}
/* ⚔️ 플레이오프 경기 설정 — 승부를 그 자리에서 내야 하는 경기는 연장·승부차기로 간다.
   ⚠ 1차전(agg:1)은 아직 합산이 남아 있으므로 90분에 끝난다.
      2차전(agg:2)은 「1차전 결과를 합쳐서」 동률일 때만 연장에 들어간다. */
function poOpts(m){
  const o={noTable:true};
  if(m.agg===1) return o;
  o.ko=true;
  if(m.agg===2){ o.aggH=(G.aggA||0); o.aggA=(G.aggH||0); }   // 2차전 홈 = 1차전 원정
  return o;
}
function poResolve(m, hid, aid, hg, ag, pk){
  const h=G.teams[hid], a=G.teams[aid];
  let winner;
  const byPk = pk ? (pk>0?hid:aid) : null;
  if(m.agg===1){ G.aggH=hg; G.aggA=ag; winner=null; }
  else if(m.agg===2){
    const tot1=hg+(G.aggA||0), tot2=ag+(G.aggH||0); // 2차전 홈=1차전 원정
    winner = tot1>tot2?hid : tot2>tot1?aid : (byPk || (m.drawWin==="h"?hid:aid));
  } else {
    winner = hg>ag?hid : ag>hg?aid : (byPk || (m.drawWin==="h"?hid:aid));
  }
  G.poResults.push({tag:m.tag, hid, aid, hg, ag});
  addNews(`⚔️ ${m.tag}: ${h.short} ${hg} - ${ag} ${a.short}`);
  if(m.tag==="K2 준PO") G.poW1=winner;
  if(m.tag==="K2 PO") G.poW2=winner;
  if(m.tag==="K2 준PO A") G.poWA=winner;
  if(m.tag==="K2 준PO B") G.poWB=winner;
  if(m.tag==="K2 PO 결승"){
    G.poW2=winner;                                   // 우승팀 = 자동 승격
    G.poRunnerUp = (winner===hid) ? aid : hid;       // 준우승팀 = 승강PO 진출
    addNews(`🎉 ${divName(2)} 플레이오프 우승: ${G.teams[winner].name} — ${divName(1)} 승격 확정!`);
  }
  if(m.tag==="승강PO 2차전"){ G.poFinal1=winner; addNews(`🔥 승강PO: ${G.teams[winner].name} ${G.teams[winner].div===1?divName(1)+" 잔류!":divName(1)+" 승격!"}`); }
  if(m.tag==="승강PO(2위) 2차전"){ G.poFinal2=winner; addNews(`🔥 승강PO: ${G.teams[winner].name} ${G.teams[winner].div===1?divName(1)+" 잔류!":divName(1)+" 승격!"}`); }
}
/* ⚔️ ⚠ 제보 원문 — 「k1 갈라고 승강플레이오프하는데 하루에 다하는데요..?
   3경기째 하니깐 애들 퍼져서 저버렸습니다」.
   원인 — phase "po" 는 달력 밖이라 경기 사이에 하루도 흐르지 않았다. 준PO→PO결승→승강PO
   1·2차전을 연달아 뛰면 회복이 0이라 3경기째엔 전원 방전. 실제 일정처럼 경기 사이에
   며칠을 쉬게 한다 — 전 구단 공통(상대도 같이 쉬니 공정하다). */
const PO_REST_DAYS=5;
function poRestDays(n){
  try{
    for(let d=0; d<(n||PO_REST_DAYS); d++)
      for(const id in G.teams){
        try{ applyDayToTeam(G.teams[id], {t:"rest"}); }catch(e){}
      }
  }catch(e){}
}
function runPOInstant(){
  const m=G.poQueue.shift();
  const hid=resolvePOid(m.h), aid=resolvePOid(m.a);
  const M=instantMatch(G.teams[hid],G.teams[aid],poOpts(m));
  poResolve(m, hid, aid, M.hg, M.ag, M.pk?(M.pk.win==="h"?1:-1):0);
  poRestDays();   // ⚔️ 다음 경기까지 며칠 쉰다 (제보 — 하루에 몰아치던 문제)
  return {type:"pomatch", res:{hg:M.hg,ag:M.ag,events:M.events}, h:G.teams[hid], a:G.teams[aid], tag:m.tag};
}
/* ---------- 시즌 종료 ---------- */
/* ═══ 🏢 기업 인수 — 시민구단이 기업구단이 된다 ═══════════════════════
   ⚠ 요청 원문 — 「시민구단이 매력도도 높고 일정 기준을 크게 충족하면 기업인이 인수하는
      그런 이벤트도 구현해볼까?」
   ─ 정한 것 ─────────────────────────────────────────────────
     · 감독은 결정에 개입하지 않는다 — 인수는 구단주와 주주의 일이고, 감독은 통보를 받는다
     · AI 시민구단에도 일어난다 — 리그 판도가 살아 움직인다 (한 시즌에 한 구단만)
     · 구단명에 기업명이 반영된다 (K리그 관행: 「울산 HD」·「전북 현대」 꼴)
   ⚠ 배관은 이미 있다 — G.ownerKinds/G.ownerNames 를 바꾸면 스폰서 매력도·파트너 수·
      구장 사업비·AI 예산 증액 확률·모기업 증시 상장까지 전부 따라간다(에디터용으로 만든 길).
      이 이벤트는 그 길을 그대로 쓴다. */
const ACQ_BAR=92;           // 인수 문턱 점수 — 1부 3위권을 두세 시즌 유지한 시민구단이 겨우 닿는다
const ACQ_GAP=2;            // 리그 전체 쿨다운 (시즌)
const ACQ_BRAND_A=["한백","대선","세종","우성","태산","서진","동보","가온","해성","진성",
                   "백산","유정","대양","신원","청람","도원","명진","광일","성진","한영",
                   "무학","금정","연호","다산","벽산"];
const ACQ_BRAND_B=["그룹","산업","모빌리티","전자","건설","화학","바이오","에너지",
                   "제철","금융지주","물산","해운","식품","텔레콤","중공업","리테일"];
/* 이미 리그에서 쓰고 있는 모기업 이름과 겹치지 않게 고른다 */
function acqBrand(){
  const used=new Set();
  try{
    for(const id in CLUB_TYPE) used.add(String(CLUB_TYPE[id].o||""));
    for(const id in (G.ownerNames||{})) used.add(String(G.ownerNames[id]||""));
  }catch(e){}
  for(let i=0;i<60;i++){
    const a=pick(ACQ_BRAND_A), b=pick(ACQ_BRAND_B), full=a+b;
    if(used.has(full)) continue;
    let dup=false; for(const u of used) if(u.indexOf(a)===0){ dup=true; break; }
    if(dup) continue;
    return {core:a, full};
  }
  return {core:"한백", full:"한백그룹"};
}
/* 도시 이름 — 「수원FC」처럼 붙어 있는 꼬리를 떼고 앞의 지명만 남긴다 */
function acqCityOf(t){
  return String(t.short||t.name||"").replace(/(FC|유나이티드|시티)$/,"").trim() || String(t.short||"구단");
}
/* 얼마나 「살 만한 구단」인가 — 매력도가 주축이고 성적·관중·구장·팬이 얹힌다 */
function acqScore(t, pos){
  try{
    if(!t || t.id==="gimcheon") return null;
    const k=clubType(t).k;
    if(k!=="civic" && k!=="mixed") return null;          // 이미 기업구단이면 대상이 아니다
    const why=[]; let s=0;
    const ap=(typeof sponAppeal==="function")?sponAppeal(t):20;
    const vA=clamp(Math.round((ap-40)*1.5), 0, 60);
    s+=vA; if(vA) why.push(`구단 매력도 ${ap}`);
    /* 성적 — 1부 상위권일수록 값이 뛴다 */
    let vR=0;
    if(t.div===1){ vR = pos<=1?36 : pos<=3?26 : pos<=6?16 : 8; }
    else         { vR = pos<=2?12 : pos<=4?6 : 0; }
    s+=vR; if(vR) why.push(`${divName(t.div)} ${pos}위`);
    /* 아시아 무대 — 기업이 가장 탐내는 간판 */
    try{ if(t.div===1 && pos<=3){ s+=8; why.push("아시아 무대 진출권"); } }catch(e){}
    /* 관중 */
    const b0=(typeof attBase0==="function")?attBase0(t):3000;
    const vC=clamp(Math.round((b0-3000)/700), 0, 12);
    s+=vC; if(vC) why.push(`평균 관중 ${Math.round(b0).toLocaleString()}명`);
    /* 전용구장 */
    const cap=(stadOf(t).cap)|0;
    if(cap>=25000){ s+=10; why.push(`${cap.toLocaleString()}석 대형 구장`); }
    else if(cap>=18000){ s+=6; why.push(`${cap.toLocaleString()}석 구장`); }
    /* 팬 규모 */
    const vF=clamp(Math.round(((t.fans||10)-10)*0.5), 0, 10);
    s+=vF; if(vF) why.push(`팬 규모 ${Math.round(t.fans||10)}`);
    /* 꾸준함 — 「한 해 반짝」에는 자본이 움직이지 않는다 */
    const g=((G.acqGood||{})[t.id])|0;
    const vG=Math.min(3, g)*6;
    s+=vG; if(vG) why.push(`${Math.min(3,g)}시즌 연속 호성적`);
    return {s, why, ap, pos};
  }catch(e){ return null; }
}
/* ═══ 📰 1단계 — 접촉설 ════════════════════════════════════════════
   ⚠ 요청 — 「시즌 중반에 『○○그룹, 인수 검토』 기사가 먼저 뜨고 여론이 들끓다가 성사/무산」.
   시즌이 끝나는 순간 통보만 하면 드라마가 없다. 시즌 후반에 먼저 설이 돌고,
   그 설이 있어야만 시즌 말에 인수가 성사된다 — 물론 그대로 무산되기도 한다. */
const ACQ_RUM_FROM=0.52, ACQ_RUM_TO=0.86;   // 시즌 진행률 이 구간에서만 설이 돈다
const ACQ_RUM_BAR=78;                        // 설이 도는 문턱 (성사 문턱보다 낮다 — 그래서 무산이 나온다)
function acqProgress(){
  try{
    const a=(G.k1Fix||[]).length, b=(G.r1|0);
    return a? clamp(b/a, 0, 1) : 0;
  }catch(e){ return 0; }
}
function acqRoundCheck(){
  try{
    G.acq=G.acq||{last:0, list:[], corp:{}};
    if(G.acq.rum && G.acq.rum.s===G.season) return;      // 한 시즌에 설은 하나
    if(G.acq.rumDone===G.season) return;
    if(G.season-(G.acq.last|0) < ACQ_GAP) return;
    const pg=acqProgress();
    if(pg<ACQ_RUM_FROM || pg>ACQ_RUM_TO) return;
    const cands=[];
    const scan=(tb)=>tb.forEach((t,i)=>{ const r=acqScore(t, i+1); if(r && r.s>=ACQ_RUM_BAR) cands.push({t, r}); });
    scan(tableOf(1)); scan(tableOf(2));
    if(!cands.length) return;
    if(Math.random()>=0.20) return;                      // 라운드마다 굴리므로 낮게
    cands.sort((a,b)=>b.r.s-a.r.s);
    const t=cands[0].t, r=cands[0].r, br=acqBrand();
    G.acq.rum={s:G.season, tid:t.id, brand:br.full, core:br.core, score:r.s, why:(r.why||[]).slice(0,3)};
    const isU=!!t.isUser;
    const V={t:t.short, o:br.full, n:`${acqCityOf(t)} ${br.core}`, p:t.name};
    addNews(fixJosa(`📰 <b>${br.full}, ${t.name} 인수 검토</b> — 복수의 관계자에 따르면 `
      + `${br.full}이/가 ${clubTypeName(clubType(t).o)}와 인수 협상을 진행 중입니다. `
      + `양측 모두 "확정된 것은 없다"는 입장입니다.`), null, "club");
    try{
      pushFeed({cat:"club", ic:"📰", tone:0, tid:t.id, src:pick(MEDIA),
        head:`${br.full}, ${t.name} 인수 검토설`,
        sub:`${(r.why||[]).slice(0,3).join(" · ")}. 구단은 "드릴 말씀이 없다"고만 했다.`});
    }catch(e){}
    try{
      if(isU){
        socialFill(SOC.acqRumOurs, 4+R(3), 0, V);
        fmkFill(FMK.acqRum, 2+R(3), V);
        notify(`📰 <b>${br.full}이 우리 구단 인수를 검토 중이라는 보도가 나왔습니다</b><br>`
          + `<span class="small">확정된 것은 없습니다. 시즌이 끝날 때 결론이 납니다 — `
          + `남은 경기 성적이 협상 테이블의 값을 정합니다.</span>`, "info");
      } else {
        socialFill(SOC.acqRumOther, 2+R(2), 0, V);
        fmkFill(FMK.acqRum, 1+R(2), V);
      }
    }catch(e){}
  }catch(e){}
}
/* ═══ 📉 인수 그 뒤 — 모기업 지원 축소와 철수 ══════════════════════
   ⚠ 요청 — 「인수 후 몇 시즌 성적이 나쁘면 발을 빼는 역이벤트. 팬들이 걱정하는 그 시나리오」.
   두 단계다. 두 시즌 부진 → <b>지원 축소</b>(예산이 확 준다). 거기서 두 시즌 더 → <b>철수</b>
   (시민구단으로 되돌아가고 구단명도 원래대로). 중간에 성적을 내면 지원이 회복된다. */
function acqSeasonRating(t, pos, n){
  /* 그 시즌이 모기업 눈에 어떻게 보였는가 */
  if(t.div===1){
    if(pos<=6) return "good";
    if(pos> Math.max(8, Math.round(n*0.66))) return "bad";
  } else {
    if(pos<=3) return "good";
    if(pos>6) return "bad";
  }
  return "flat";
}
function acqAfterCheck(t1, t2){
  try{
    G.acq=G.acq||{last:0, list:[], corp:{}};
    G.acq.corp=G.acq.corp||{};
    const posOf=(id)=>{
      let i=t1.findIndex(x=>x.id===id); if(i>=0) return {pos:i+1, n:t1.length};
      i=t2.findIndex(x=>x.id===id);     if(i>=0) return {pos:i+1, n:t2.length};
      return null;
    };
    for(const tid in G.acq.corp){
      const e=G.acq.corp[tid], t=G.teams[tid];
      if(!t){ delete G.acq.corp[tid]; continue; }
      if(e.s===G.season) continue;                 // 인수한 그해는 묻지 않는다
      const P=posOf(tid); if(!P) continue;
      const q=acqSeasonRating(t, P.pos, P.n);
      if(q==="bad") e.bad=(e.bad|0)+1; else if(q==="good") e.bad=Math.max(0,(e.bad|0)-1); 
      if(q==="good" && e.cut){ acqRestore(t, e); continue; }
      if(!e.cut && (e.bad|0)>=2){ acqCut(t, e); continue; }
      if(e.cut && (e.bad|0)>=4){ acqWithdraw(t, e); continue; }
    }
  }catch(e){}
}
function acqCut(t, e){
  e.cut=G.season;
  const isU=!!t.isUser;
  const before=t.budget;
  t.budget=Math.round(t.budget*0.55*10)/10;
  try{ bumpHype(t, -0.08, `${e.brand} 지원 축소`); }catch(e2){}
  const V={t:t.short, o:e.brand, n:t.name};
  addNews(fixJosa(`📉 <b>${e.brand}, ${t.name} 지원 축소</b> — 두 시즌 연속 부진에 모기업이 `
    + `투자 규모를 줄입니다. 이적 예산이 <b>${before}억 → ${t.budget}억</b>으로 깎였습니다.`),
    isU?"bad":null, "club");
  try{
    pushFeed({cat:"club", ic:"📉", tone:-1, tid:t.id, src:pick(MEDIA),
      head:`${e.brand}, ${t.short} 투자 축소`,
      sub:`모기업 관계자는 "성과에 따른 정상적인 조정"이라고 했다. 구단 안팎에서는 철수설까지 나온다.`});
  }catch(e2){}
  try{
    if(isU){
      socialFill(SOC.acqCut, 4+R(3), -1, V);
      fmkFill(FMK.acqCut, 2+R(3), V);
      adjustTrust("fans", -5, `${e.brand} 지원 축소`);
      notify(`📉 <b>${e.brand}이 지원을 줄였습니다</b><br><span class="small">이적 예산 ${before}억 → <b>${t.budget}억</b>. `
        + `이대로 두 시즌 더 부진하면 <b>모기업이 철수</b>합니다 — 상위권 성적을 내면 지원이 돌아옵니다.</span>`, "warn");
    } else socialFill(SOC.acqCutOther, 1+R(2), 0, V);
  }catch(e2){}
}
function acqRestore(t, e){
  const isU=!!t.isUser;
  e.cut=0; e.bad=0;
  const add=(t.div===1?18+R(14):8+R(8));
  t.budget=Math.round((t.budget+add)*10)/10;
  try{ bumpHype(t, 0.06, `${e.brand} 지원 재개`); }catch(e2){}
  addNews(fixJosa(`📈 <b>${e.brand}, ${t.name} 지원 재개</b> — 성적으로 답했습니다. 이적 예산 <b>+${add}억</b>.`),
    isU?"good":null, "club");
  try{ if(isU){ socialFill(SOC.acqBack, 3+R(2), 1, {t:t.short, o:e.brand, n:t.name}); adjustTrust("fans", +3, `${e.brand} 지원 재개`); } }catch(e2){}
}
function acqWithdraw(t, e){
  const isU=!!t.isUser;
  const corpName=t.name, brand=e.brand;
  /* 시민구단으로 되돌아간다 — 이름도 원래대로 */
  G.ownerKinds=G.ownerKinds||{}; G.ownerNames=G.ownerNames||{}; G.ownerAuto=G.ownerAuto||{};
  G.ownerKinds[t.id]="civic";
  delete G.ownerNames[t.id]; delete G.ownerAuto[t.id];   // CLUB_TYPE 의 원래 운영 주체로 돌아간다
  if(e.from) t.name=e.from;
  /* 🔒 철수도 정당한 개명 사건 — 잠금을 지금 이름으로 갱신하고 모기업 잠금은 푼다(제보) */
  try{ edLockRenew(t.id, "name", t.name); edLockRenew(t.id, "owner", "");
       edLockRenew(t.id, "ownKind", "civic"); }catch(e2){}
  try{ stkSyncClubListing(t); }catch(e2){}               // 📉 모기업이 증시에서 내려간다
  const before=t.budget;
  t.budget=Math.round(t.budget*0.45*10)/10;
  t.fans=Math.round(clamp((t.fans||10)*0.94, 4, 140)*10)/10;
  try{ bumpHype(t, -0.12, `${brand} 철수`); }catch(e2){}
  delete G.acq.corp[t.id];
  G.acq.list.unshift({s:G.season, tid:t.id, brand, from:corpName, to:t.name, out:1});
  G.acq.list=G.acq.list.slice(0,20);
  const V={t:t.short, o:brand, n:t.name, p:corpName};
  addNews(fixJosa(`🏳️ <b>${brand}, ${corpName}에서 철수</b> — 구단은 다시 <b>${t.name}</b> 시민구단 체제로 돌아갑니다. `
    + `이적 예산 <b>${before}억 → ${t.budget}억</b>.`), isU?"bad":null, "club");
  try{
    pushFeed({cat:"club", ic:"🏳️", tone:-1, tid:t.id, src:"K리그 공식",
      head:`${brand} 철수 — ${t.name} 시민구단 환원`,
      sub:`지자체와 시민 주주가 다시 운영을 맡는다. 팬들은 "그럴 줄 알았다"와 "그래도 돌아와서 다행"으로 갈렸다.`});
  }catch(e2){}
  try{
    if(isU){
      socialFill(SOC.acqOut, 5+R(3), -1, V);
      fmkFill(FMK.acqOut, 3+R(3), V);
      adjustTrust("fans", -8, `${brand} 철수`);
      adjustTrust("owner", -6, `${brand} 철수`);
      notify(`🏳️ <b>${brand}이 철수했습니다</b><br><span class="small">구단명 ${corpName} → <b>${t.name}</b> · 이적 예산 ${before}억 → <b>${t.budget}억</b><br>`
        + `다시 시민구단입니다. 팬들이 걱정하던 바로 그 시나리오가 현실이 됐습니다.</span>`, "bad");
    } else { socialFill(SOC.acqOutOther, 2+R(2), 0, V); fmkFill(FMK.acqOut, 1+R(2), V); }
  }catch(e2){}
}
/* 시즌이 끝날 때 한 번 — 「올해 자본이 움직였는가」 */
function acqSeasonCheck(t1, t2){
  try{
    G.acq=G.acq||{last:0, list:[]};
    G.acqGood=G.acqGood||{};
    /* ① 올해 성적을 「호성적 연속」 장부에 반영한다 (다음 해 판정의 밑감) */
    const mark=(tb, div)=>{ tb.forEach((t,i)=>{
      const good = div===1 ? (i<6) : (i<2);
      G.acqGood[t.id] = good ? Math.min(5, (G.acqGood[t.id]|0)+1) : 0;
    }); };
    mark(t1,1); mark(t2,2);
    /* ② 인수 뒤의 이야기 — 지원 축소·철수·회복 (요청) */
    try{ acqAfterCheck(t1, t2); }catch(e){}
    /* ③ 결론 — 올해 돌던 접촉설이 성사되는가. 설이 없었으면 인수도 없다 */
    const rum=G.acq.rum;
    if(!rum || rum.s!==G.season) return;
    G.acq.rum=null; G.acq.rumDone=G.season;
    const t=G.teams[rum.tid]; if(!t) return;
    const pos=(function(){ let i=t1.findIndex(x=>x.id===t.id); if(i>=0) return i+1;
                           i=t2.findIndex(x=>x.id===t.id); return i>=0?i+1:99; })();
    const r=acqScore(t, pos);
    /* 시즌 후반 성적이 협상 테이블의 값을 정한다 — 무너졌으면 그대로 무산된다 */
    const prob = (r && r.s>=ACQ_BAR) ? clamp(0.45 + (r.s-ACQ_BAR)/180, 0.45, 0.90) : 0;
    if(prob>0 && Math.random()<prob){ acqDo(t, r, rum); return; }
    acqFail(t, rum, r);
  }catch(e){}
}
/* 📰 무산 — 설만 돌다 끝났다. 이것도 하나의 소식이다 */
function acqFail(t, rum, r){
  const isU=!!t.isUser;
  const V={t:t.short, o:rum.brand, n:`${acqCityOf(t)} ${rum.core}`, p:t.name};
  const why = (r && r.s<ACQ_BAR) ? "시즌 막판 성적이 협상 테이블의 값을 깎았다는 분석이 나옵니다."
                                 : "양측이 인수 조건에 끝내 합의하지 못했습니다.";
  addNews(fixJosa(`📰 <b>${rum.brand}의 ${t.name} 인수 무산</b> — ${why} `
    + `구단은 당분간 ${clubTypeName(clubType(t).o)} 체제를 유지합니다.`), null, "club");
  try{
    pushFeed({cat:"club", ic:"📰", tone:0, tid:t.id, src:pick(MEDIA),
      head:`${rum.brand}, ${t.short} 인수 협상 결렬`,
      sub:`${why} 구단 관계자는 "다시 논의될 여지는 남아 있다"고 했다.`});
  }catch(e){}
  try{
    if(isU){
      socialFill(SOC.acqFail, 4+R(3), 0, V);
      fmkFill(FMK.acqRum, 1+R(2), V);
      notify(`📰 <b>${rum.brand}의 인수가 무산됐습니다</b><br><span class="small">${why}<br>`
        + `우리는 계속 ${clubTypeName(clubType(t).o)} 체제입니다. 성적을 더 쌓으면 다시 테이블이 열립니다.</span>`, "info");
    } else socialFill(SOC.acqFailOther, 1+R(2), 0, V);
  }catch(e){}
}
function acqDo(t, r, rum){
  G.acq=G.acq||{last:0, list:[], corp:{}}; G.acqGood=G.acqGood||{};   // 옛 세이브 안전망
  G.acq.corp=G.acq.corp||{};
  /* 접촉설에서 이미 기업 이름이 나갔다면 그 이름 그대로 간다 — 기사와 결론이 어긋나면 안 된다 */
  const br=(rum && rum.brand && rum.core) ? {core:rum.core, full:rum.brand} : acqBrand();
  const city=acqCityOf(t);
  const oldName=t.name, oldOwner=clubType(t).o;
  const isU=!!t.isUser;
  /* ① 구단 형태·모기업·이름 */
  G.ownerKinds=G.ownerKinds||{}; G.ownerNames=G.ownerNames||{}; G.ownerAuto=G.ownerAuto||{};
  G.ownerKinds[t.id]="corp";
  G.ownerNames[t.id]=br.full;
  delete G.ownerAuto[t.id];                    // 사람이 정한 이름과 같은 자격으로 남긴다
  t.name=`${city} ${br.core}`;
  /* 🔒 ⚠ 제보 — 에디터로 고쳐 둔 팀 이름·모기업이 여기서 통째로 갈아엎히고 있었다
     (실측: 「강원 FC / 강원도청」 → 「강원 도원 / 도원모빌리티」).
     인수는 게임 안의 정당한 개명 사건이라 그대로 두되, 잠금을 「새 이름」으로 갱신한다 —
     그래야 이 사건 뒤에 다시 옛 이름으로 되돌아가는 일이 없다. */
  try{ edLockRenew(t.id, "name", t.name); edLockRenew(t.id, "owner", br.full);
       edLockRenew(t.id, "ownKind", "corp"); }catch(e){}
  try{ stkSyncClubListing(t); }catch(e){}      // 📈 모기업이 증시에 올라온다
  /* ② 돈 — 인수 자금이 한 번에 들어오고, 이후 규모는 매력도가 알아서 끌어올린다 */
  const cash = (t.div===1 ? 30+R(26) : 15+R(14));
  t.budget=Math.round((t.budget+cash)*10)/10;
  t.fans=Math.round(clamp((t.fans||10)*1.06, 4, 140)*10)/10;
  try{ bumpHype(t, 0.10, `${br.full} 인수`); }catch(e){}
  /* ③ 장부 */
  G.acq.last=G.season;
  G.acq.rum=null; G.acq.rumDone=G.season;
  G.acq.list.unshift({s:G.season, tid:t.id, brand:br.full, from:oldName, to:t.name, owner:oldOwner});
  G.acq.list=G.acq.list.slice(0,20);
  G.acqGood[t.id]=0;
  /* 📉 인수 뒤의 이야기를 여기서부터 센다 — 두 시즌 부진하면 지원이 줄고, 거기서 더 가면 철수한다 */
  G.acq.corp[t.id]={s:G.season, brand:br.full, from:oldName, cut:0, bad:0};
  /* ④ 소식 */
  const V={t:t.short, o:br.full, n:t.name, p:oldName};
  addNews(fixJosa(`🏢 <b>${br.full}, ${oldName} 인수</b> — 구단명이 <b>${t.name}</b>(으)로 바뀝니다. `
    + `${clubTypeName(oldOwner)}이 20년 넘게 지켜 온 시민구단이 기업구단으로 전환됩니다.`),
    isU?"good":null, "club");
  try{
    pushFeed({cat:"club", ic:"🏢", tone:isU?1:0, tid:t.id, src:"K리그 공식",
      head:`${br.full}, ${oldName} 인수 — ${t.name}으로 새 출발`,
      sub:`인수 자금 ${cash}억. 구단은 "지역 연고와 엠블럼은 그대로 간다"고 밝혔다. ${r&&r.why&&r.why.length?`(${r.why.slice(0,3).join(" · ")})`:""}`});
  }catch(e){}
  try{
    if(isU){
      socialFill(SOC.acqOurs, 5+R(3), 0, V);
      fmkFill(FMK.acq, 3+R(3), V);
      rivalFill(SOC.acqRiv, 2+R(2), 0, V);
      adjustTrust("fans", -6, `${br.full} 인수 — 시민구단 정체성 논란`);
      adjustTrust("owner", +8, `${br.full} 인수 — 새 구단주 부임`);
      notify(`🏢 <b>${br.full}이 우리 구단을 인수했습니다</b><br>`
        + `<span class="small">구단명 <b>${oldName} → ${t.name}</b> · 이적 예산 <b>+${cash}억</b><br>`
        + `기업구단으로 전환되어 스폰서 매력도와 예산 규모가 올라갑니다. `
        + `다만 새 구단주는 성과를 빨리 봅니다 — 팬 일부는 시민구단 정체성을 잃었다고 봅니다.</span>`, "good");
    } else {
      /* 남의 구단 인수 — 우리 팬에게는 「경쟁자가 돈을 쥐었다」는 소식이다 */
      socialFill(SOC.acqOther, 2+R(3), -1, V);
      fmkFill(FMK.acq, 2+R(3), V);
    }
  }catch(e){}
}
/* 「대구광역시 · 시민주주」 → 「대구광역시」 (문장에 넣기 좋게 앞머리만) */
function clubTypeName(o){ return String(o||"운영 주체").split("·")[0].trim(); }
function endSeason(){
  G.phase="seasonEnd";
  /* 🌍 CWC 자격 — 시즌이 닫히기 전에 찍어 둔다.
     대회는 다음 해 1월에 열리는데, 그때는 startNewSeason 이 이미 돌아가 G.eacl 이 새로 깔린 뒤다.
     지금 남기지 않으면 「누가 아시아 챔피언이었는지」를 아무도 모르게 된다.
     자격은 감독이 아니라 구단에 붙는다 — 우승 뒤 팀을 떠났다면 그 대회는 옛 팀의 것이다. */
  try{
    const E=G.eacl, F=E&&E.ko&&E.ko.f;
    if(E && E.champ){
      const run = F ? (F.w===F.h ? F.a : F.h) : null;
      G.cwcQual={s:G.season, champ:E.champ, runner:run};
    } else G.cwcQual=null;
  }catch(e){ G.cwcQual=null; }
  const t1=tableOf(1), t2=tableOf(2);
  const champ=t1[0], champ2=t2[0];
  // 상금 — 순위별 지급 (K리그1: 38경기 승점·득실 확정 순위 기준 / K리그2도 순위별 지급)
  const prize1=[9,6,4,3,2,1.5,1.2,1,0.8,0.6,0.5,0.5];
  const prize2=[3,2,1.5,1,0.8,0.6,0.5,0.5,0.4,0.4,0.3,0.3,0.3,0.3,0.3,0.3,0.3];
  t1.forEach((t,i)=>t.budget=Math.round((t.budget+(prize1[i]||0.5))*10)/10);
  t2.forEach((t,i)=>t.budget=Math.round((t.budget+(prize2[i]||0.3))*10)/10);
  // 유저 팀 최종 순위·상금 안내
  const ut0=userTeam(); const utTbl0=ut0.div===1?t1:t2; const utPos0=utTbl0.findIndex(x=>x.isUser)+1;
  const utPrize0=(ut0.div===1?prize1:prize2)[utPos0-1]||1;
  const utRounds0=ut0.div===1?G.k1Fix.length:G.k2Fix.length;
  addNews(`📢 ${G.season} 시즌 최종전(${utRounds0}경기) 종료 — ${divName(ut0.div)} <b>${utPos0}위</b> 확정! 상금 <b>${utPrize0}억</b> 지급`,"good");
  // 기록 + 시상식
  const aw=seasonAwards(t1, userTeam().div);
  G.history.push({season:G.season, s:G.season, champ:champ.name, champ2:champ2.name,
    topScorer: aw.topScorer, mvp: aw.mvp, assist:aw.assist, young:aw.young,
    bestXI: aw.bestXI, coach: aw.coach, gk:aw.gkAward,
    userPos: (userTeam().div===1?t1:t2).findIndex(t=>t.isUser)+1, userDiv:userTeam().div});
  addNews(`🏆 ${G.season} ${divName(1)} 우승: ${champ.name}!`);
  addNews(`🥇 K리그2 우승·승격: ${champ2.name}`);
  // 구단주·팬 신뢰도: 우승 시 크게 상승
  const uid=userTeam().id;
  if(champ.id===uid || champ2.id===uid){ adjustTrust("owner",18,"리그 우승"); adjustTrust("fans",18,"리그 우승"); }
  /* 🎯 시즌 목표 결산 — 공언한 목표를 지켰는가.
     ⚠ 제보 — 「잔류가 목표였는데 2위를 하고도 경질됐다」. 시즌이 끝나도 목표 달성을 아무도
        평가하지 않아, 한 해를 잘 치르고도 구단주 신뢰가 회복되지 않았다. */
  try{
    if(!G.jobless && G.goal && G.goal.s===G.season){
      const ut2=userTeam();
      const tb2=(ut2.div===1?t1:t2);
      const gpos=tb2.findIndex(x=>x.isUser)+1;
      if(gpos>0){
        const miss=gpos-G.goal.req;
        let d, why;
        if(miss<=-4){ d=17; why="목표를 크게 뛰어넘었습니다"; }
        else if(miss<=-1){ d=11; why="목표를 넘어섰습니다"; }
        else if(miss<=0){ d=7;  why="목표를 지켰습니다"; }
        else if(miss<=2){ d=-4; why="목표에 조금 못 미쳤습니다"; }
        else if(miss<=5){ d=-11; why="목표에 미달했습니다"; }
        else { d=-19; why="목표에 크게 미달했습니다"; }
        adjustTrust("owner", d, `${G.season} 시즌 목표(${G.goal.n}) 결산 — ${gpos}위`);
        adjustTrust("fans", Math.round(d*0.6*10)/10, `${G.season} 시즌 결산 — ${gpos}위`);
        addNews(`🎯 <b>${G.season} 시즌 목표 결산</b> — 공언 「${G.goal.n}」(${G.goal.req}위 이내) · 최종 <b>${gpos}위</b><br>`
          +`<span class="small">${why} 구단주 신뢰 ${d>0?"+":""}${d}</span>`, d>=0?"good":"warn", "club");
        /* 목표를 지켰다면 경고·통첩은 여기서 풀린다 — 다음 시즌을 빚 없이 시작한다 */
        if(d>0){ const bb=boardState(); bb.stage=0; bb.ultiFrom=null; bb.warned=0; }
      }
    }
  }catch(e){}
  /* 📸 이 시즌의 최종 순위를 찍어 둔다 — 승강을 적용하면 G.k1/G.k2 구성이 바로 바뀌기 때문이다.
     ⚠ 제보 — "마지막 라운드 순위표에 K리그1 한 팀 대신 K리그2 우승팀이 끼어 있다".
        승격팀이 이미 K1 목록에 들어가고 강등팀은 빠진 상태로 그 시즌 표를 그려서 생긴 일이다. */
  G.finalTbl={s:G.season, k1:t1.map(t=>t.id), k2:t2.map(t=>t.id)};
  // 승강 적용 — 시즌 규정에 따라 갈린다
  applyPromotionRelegation(t1, t2, champ2, uid);
  seasonCeremony(t1, t2, champ, champ2, G._relIds||[], G._proIds||[]);
  try{ stadSeasonEnd(); }catch(e){}
  /* 🌏 다음 시즌 EACL 진출권 — 한국 배정은 3장.
     ① EACL 우승 클럽이 K리그 팀이면 리그 성적과 상관없이 자동 진출
     ② 나머지 자리를 K리그1 상위 순으로 채운다 (우승팀이 4위 아래면 리그 3위가 밀린다) */
  try{ eaclTick(true); }catch(e){}   // 리그가 끝나도 남아 있는 EACL 단계는 여기서 마무리한다
  {
    const chId=(G.eacl && G.eacl.champ && G.teams[G.eacl.champ] && eaclEligible(G.eacl.champ)) ? G.eacl.champ : null;
    /* 🎖️ 군경 구단은 건너뛴다 — 3위 안에 들어도 그 자리는 다음 순위 구단이 가져간다 */
    const lg=t1.filter(x=>x && eaclEligible(x.id)).slice(0,3).map(x=>x.id);
    const skipped=t1.slice(0,3).filter(x=>x && !eaclEligible(x.id));
    const next=(chId ? [chId, ...lg.filter(id=>id!==chId)] : lg).slice(0,3);
    for(const s of skipped){
      addNews(`🎖️ <b>${s.name}</b>은 군경 구단이라 ${eaclShort()} 출전 자격이 없습니다 — 진출권은 다음 순위 구단에 넘어갑니다.`, "info", "club");
    }
    if(chId && lg.indexOf(chId)<0){
      const outId=lg[2];
      addNews(`🌏 <b>${G.teams[chId].short}</b>, ${eaclShort()} 우승으로 다음 시즌 출전권 자동 획득 — 리그 3위 ${outId&&G.teams[outId]?G.teams[outId].short:"팀"}은(는) 진출이 무산됐습니다.`, "info", "club");
    }
    G.aclTeams=next;
  }
}
/* ── 승격·강등 적용 ──────────────────────────────────────────────
   2026: 김천 무조건 강등 + K2 1·2위 자동 승격 + K2 3~6위 PO 우승팀 승격 (→ K1 14팀)
         김천이 최하위가 아니면 K1 최하위가 PO 준우승팀과 승강PO를 치른다.
   2027~: 최하위 자동 강등 / K2 1위 자동 승격 / 11위·10위는 각각 승강PO. */
function applyPromotionRelegation(t1, t2, champ2, uid){
  const down=[], up=[];
  const move=(id, div)=>{ const t=G.teams[id]; if(!t||t.div===div) return;
    if(div===2){ G.k1=G.k1.filter(x=>x!==id); if(G.k2.indexOf(id)<0) G.k2.push(id); }
    else       { G.k2=G.k2.filter(x=>x!==id); if(G.k1.indexOf(id)<0) G.k1.push(id); }
    t.div=div; };
  const last=t1.length-1;
  if(isExpansionSeason()){
    const gim = G.teams["gimcheon"];
    if(gim && gim.div===1){ down.push("gimcheon");
      addNews(`⬇️ ${gim.name} — 2026 승강 규정에 따라 K리그2 강등 확정`); }
    up.push(t2[0].id, t2[1].id);                       // K2 1·2위 자동 승격
    if(G.poW2) up.push(G.poW2);                        // K2 3~6위 PO 우승팀
    // 김천이 최하위가 아니었다면 K1 최하위가 승강PO를 치렀다
    const gimLast = t1[last] && t1[last].id==="gimcheon";
    if(!gimLast && G.poFinal1){
      if(G.teams[G.poFinal1].div===2){ up.push(G.poFinal1); down.push(t1[last].id); }
    }
    addNews(`📢 2026 시즌 종료 — K리그1이 다음 시즌부터 <b>14팀</b>으로 확대됩니다.`);
  } else {
    down.push(t1[last].id);                            // 최하위 자동 강등
    up.push(champ2.id);                                // K2 우승 자동 승격
    if(G.poFinal1 && G.teams[G.poFinal1].div===2){ up.push(G.poFinal1); down.push(t1[last-2].id); }
    if(G.poFinal2 && G.teams[G.poFinal2].div===2){ up.push(G.poFinal2); down.push(t1[last-1].id); }
  }
  const dn=[...new Set(down)], upl=[...new Set(up)].filter(id=>dn.indexOf(id)<0);
  for(const id of dn) move(id, 2);
  for(const id of upl) move(id, 1);
  G._relIds=dn; G._proIds=upl;
  if(dn.length) addNews(`⬇️ 강등: ${dn.map(id=>G.teams[id].name).join(", ")}`);
  if(upl.length) addNews(`⬆️ 승격: ${upl.map(id=>G.teams[id].name).join(", ")}`);
  if(dn.indexOf(uid)>=0){ adjustTrust("owner",-18,"리그 강등"); adjustTrust("fans",-15,"리그 강등"); }
  if(upl.indexOf(uid)>=0){ adjustTrust("owner",12,"리그 승격"); adjustTrust("fans",12,"리그 승격"); }
  /* 🏢 자본이 움직였는가 — 시민구단 기업 인수 (요청). 승강이 확정된 뒤에 본다 */
  try{ acqSeasonCheck(t1, t2); }catch(e){}
  /* 🎩 수석코치 — 한 해가 지난다. 나이를 먹고, 늘거나 줄고, 계약이 깎이고,
     잘 키워 놓은 코치는 남의 집 감독 자리로 불려 간다. */
  try{
    acPoolRoll();
    for(const _c of crew().slice()){
      acAgeOne(_c);
      _c.ct=Math.max(0,(_c.ct||1)-1);
      if(_c.ct<=0){
        _c.ct=2;
        try{ staffLog(`${_c.n} ${acRole(_c).n}와 2년 재계약했습니다. (연봉 ${_c.wage}억)`); }catch(e){}
      }
      /* 나이가 너무 들면 스스로 물러난다 — 68세 넘겨 남는 스태프는 없다 */
      if(_c.age>=68 && Math.random()<0.5){
        const ix=crew().indexOf(_c); if(ix>=0) crew().splice(ix,1);
        addNews(`👋 <b>${_c.n}</b> ${acRole(_c).n}가 ${_c.age}세로 지도자 생활을 마무리했습니다.`, null, "club");
        try{ staffLog(`${_c.n} ${acRole(_c).n}가 은퇴했습니다. 후임을 뽑아야 합니다.`); }catch(e){}
      }
    }
    for(const c of (G.acPool||[])) acAgeOne(c);
    acPoachCheck(t1, t2);
  }catch(e){}
}
/* ── 시즌 시상식 ─────────────────────────────────────────────────
   예전에는 득점왕과 MVP 두 줄이 전부였다. 한 시즌을 끝냈는데 남는 게 그것뿐이면
   다음 시즌을 시작할 이유가 약하다. FM처럼 개인상과 베스트11을 뽑는다. */
/* ═══ 🏅 이달의 선수 · 이달의 감독 ══════════════════════════════════════
   ⚠ 요청 원문 — 「이달의 선수상과 이달의 감독상도 구현하고 배선 잘해주자」.

   ─ 선수 기록은 시즌 누적(goals·assists·apps·rTot)뿐이라 월간 성적을 바로 뽑을 수 없다.
     월이 바뀌는 날 「지난달 = 지금 누적 − 월초 스냅샷」으로 계산하고 새 스냅샷을 찍는다.
   ─ 1부·2부 각각 시상한다(시즌 시상식과 같은 규칙).
   ─ 배선: 뉴스·피드·소셜 + 선수 이력(p.acc.motm) + 감독 위신·구단주/팬 신뢰·라커룸 사기까지.
     이력에 남으므로 재계약 협상·사우디 오퍼 자격 판정이 이 실적을 그대로 읽는다. */
const MOTM_MIN_APP=2;      // 그 달 이만큼은 뛰어야 후보
const MOTM_MIN_MATCH=2;    // 구단도 그 달 이만큼은 치러야 감독상 후보
const MOTM_KEEP=180;       // 표시용 목록 보관 개수(두 부 × 매달 — 약 아홉 시즌)
function motmState(){
  if(!G.motm) G.motm={last:null, pl:[], mg:[], nMe:0, nPl:0};
  if(!Array.isArray(G.motm.pl)) G.motm.pl=[];
  if(!Array.isArray(G.motm.mg)) G.motm.mg=[];
  /* 🐛 통산 횟수를 「표시용 목록」에서 세면 목록이 잘릴 때마다 통산이 줄어든다.
     (두 부 × 매달이면 시즌당 16~20줄 — 세 시즌이면 창을 넘긴다)
     별도 카운터로 못 박고, 옛 세이브는 지금 목록에서 한 번만 복원한다. */
  if(typeof G.motm.nMe!=="number") G.motm.nMe=G.motm.mg.filter(x=>x&&x.me).length;
  if(typeof G.motm.nPl!=="number") G.motm.nPl=0;
  return G.motm;
}
function motmKey(d){ const t=dateOfDay(d==null?(G.day||0):d); return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0"); }
function motmMonthNo(k){ return parseInt(String(k||"").split("-")[1],10)||0; }
/* 월초 스냅샷 — 선수는 누적 기록, 구단은 승/무/패 */
function motmSnap(){
  try{
    for(const id in G.teams){ const t=G.teams[id];
      t._mo={W:t.W|0, D:t.Dw|0, L:t.L|0, GF:t.GF|0, GA:t.GA|0};
      for(const p of (t.players||[])){
        /* 🥗 아직 한 경기도 안 뛴 선수는 스냅샷을 남기지 않는다 — 없으면 0 으로 읽힌다.
           1000명분을 매달 세이브에 얹을 이유가 없다(세이브 용량 제보). */
        if((p.apps|0)===0 && (p.goals|0)===0 && (p.assists|0)===0 && !(p.rTot>0)){ delete p._mo; continue; }
        p._mo={ap:p.apps|0, g:p.goals|0, a:p.assists|0, r:p.rTot||0};
      }
    }
  }catch(e){}
}
/* 지난달 성적 한 명분 */
function motmDelta(p){
  const s0=p._mo||{ap:0,g:0,a:0,r:0};
  const ap=(p.apps|0)-(s0.ap|0);
  if(ap<=0) return null;
  const g=(p.goals|0)-(s0.g|0), a=(p.assists|0)-(s0.a|0);
  const rt=(p.rTot||0)-(s0.r||0);
  return {ap, g, a, r: ap? Math.round(rt/ap*100)/100 : 0};
}
/* 이달의 선수 점수 — 평점이 뼈대고 공격포인트가 얹힌다. 골키퍼는 무실점으로 겨룬다. */
function motmScore(p, d){
  let v=(d.r-6.2)*d.ap*1.35 + d.g*2.2 + d.a*1.4;
  if(p.pos==="GK") v += Math.max(0,(d.r-6.4))*d.ap*0.8;
  return v;
}
/* 이달의 감독 점수 — 승점률에 「전력 대비 초과 성과」를 얹는다.
   시즌 시상식의 올해의 감독과 같은 철학: 약체를 끌고 올라간 쪽이 받는다. */
function motmMgrScore(t, d, avgOvr){
  const n=d.W+d.D+d.L; if(n<=0) return -99;
  const ppg=(d.W*3+d.D)/n;
  const gap=clamp((avgOvr-teamOVR(t))/6, -1.2, 1.2);     // 전력이 약할수록 +
  return ppg + gap*0.55 + clamp((d.GF-d.GA)/Math.max(1,n)*0.10, -0.35, 0.35);
}
/* 한 달을 마감한다 — 달이 바뀌는 날 하루에 한 번 */
function motmTick(){
  try{
    const M=motmState();
    const now=motmKey();
    if(M.last===null){ M.last=now; motmSnap(); return; }
    if(M.last===now) return;                        // 아직 같은 달
    const closed=M.last;                            // 마감할 달
    M.last=now;
    if(G.phase!=="league" && G.phase!=="po"){ motmSnap(); return; }   // 프리시즌·비시즌은 시상하지 않는다
    /* 🐛 시상 중 어디선가 넘어지면 스냅샷을 못 찍어, 다음 달 성적이 「두 달치」로 잡혔다.
       무슨 일이 있어도 기준점은 다시 찍는다. */
    try{ for(const div of [1,2]) motmAward(div, closed); }
    finally{ motmSnap(); }
    try{ saveGame(); }catch(e){}
  }catch(e){}
}
function motmAward(div, mkey){
  const M=motmState();
  const teams=Object.values(G.teams).filter(t=>t.div===div);
  if(!teams.length) return;
  const mno=motmMonthNo(mkey);
  /* ── 이달의 선수 ── */
  let best=null, bestV=-1e9, bestT=null, bestD=null;
  for(const t of teams) for(const p of (t.players||[])){
    /* 🐛 B — 예전 필터는 「임대로 들어온 선수」를 뺐다. 임대 선수는 그 팀 소속으로 뛰므로
       이달의 선수 후보다. 실제로 뛰지 않았으면 아래 출전 수 조건에서 자연히 걸러진다. */
    const d=motmDelta(p); if(!d || d.ap<MOTM_MIN_APP) continue;
    const v=motmScore(p, d);
    if(v>bestV){ bestV=v; best=p; bestT=t; bestD=d; }
  }
  /* ── 이달의 감독 ── */
  const avgOvr=teams.reduce((s,t)=>s+teamOVR(t),0)/teams.length;
  let bm=null, bmV=-1e9, bmD=null;
  for(const t of teams){
    const s0=t._mo||{W:0,D:0,L:0,GF:0,GA:0};
    const d={W:(t.W|0)-(s0.W|0), D:(t.Dw|0)-(s0.D|0), L:(t.L|0)-(s0.L|0),
             GF:(t.GF|0)-(s0.GF|0), GA:(t.GA|0)-(s0.GA|0)};
    if(d.W+d.D+d.L < MOTM_MIN_MATCH) continue;
    const v=motmMgrScore(t, d, avgOvr);
    if(v>bmV){ bmV=v; bm=t; bmD=d; }
  }
  if(!best && !bm) return;
  /* 🐛 E — 무직이면 userTeam() 이 옛 팀을 돌려준다. 그 팀 선수의 수상을 「우리 팀」으로
     처리하면 남의 집 잔치에 라커룸이 들썩인다. */
  const ut=(G.jobless?null:userTeam()), mine=(x)=>!!(ut && x && x.id===ut.id);
  /* ── 기록 ── */
  if(best){
    M.pl.unshift({s:G.season, m:mno, k:mkey, div, pid:best.id, n:best.name, pos:best.pos,
                  t:bestT.short, tid:bestT.id, ap:bestD.ap, g:bestD.g, a:bestD.a, r:bestD.r});
    M.pl=M.pl.slice(0,MOTM_KEEP);
    /* 🐛 A — A.s(수상 시즌)를 안 찍으면 saudiAccText 의 「최근 N시즌」 검사가 항상 실패해
       이달의 선수 실적이 대륙 시장에 한 번도 닿지 않는다. 시즌 개인상과 같은 표식을 남긴다. */
    /* 🐛 S5 — A.s 는 「시즌 개인상」의 신선도 도장이다. 여기서 함께 찍으면
       6년 전 MVP 가 2부 이달의 선수 한 번으로 되살아나 사우디 자격이 열린다.
       월간상은 자기 도장(A.sMotm)을 따로 쓴다. */
    try{ const A=(best.acc=best.acc||{}); A.motm=(A.motm||0)+1;
         if(div===1){ A.motm1=(A.motm1||0)+1; A.sMotm=G.season; } }catch(e){}
    try{ if(mine(bestT)) M.nPl=(M.nPl|0)+1; }catch(e){}
  }
  if(bm){
    const cn = bm.isUser ? "나" : ((COACHES[bm.id]||{}).n||"감독");
    M.mg.unshift({s:G.season, m:mno, k:mkey, div, tid:bm.id, t:bm.short, n:cn,
                  W:bmD.W, D:bmD.D, L:bmD.L, GF:bmD.GF, GA:bmD.GA, me:!!bm.isUser});
    M.mg=M.mg.slice(0,MOTM_KEEP);
    if(bm.isUser) M.nMe=(M.nMe|0)+1;

  }
  /* ── 배선: 뉴스 · 피드 · 소셜 · 실제 효과 ── */
  const dn=divName(div);
  if(best){
    const line=`${bestD.ap}경기 ${bestD.g}골 ${bestD.a}도움 · 평점 ${bestD.r.toFixed(2)}`;
    addNews(`🏅 <b>${mno}월 ${dn} 이달의 선수 — ${best.name}</b> <span class="small">(${bestT.short}) ${line}</span>`,
      mine(bestT)?"good":null, "club");
    if(mine(bestT)){
      pushFeed({cat:"star", ic:"🏅", tone:1, tid:bestT.id, src:"K리그 공식",
        head:`${best.name}, ${mno}월 이달의 선수`,
        sub:`${line}. ${bestT.name}의 ${mno}월을 끌고 간 선수로 뽑혔다.`});
      try{ best.morale=clamp((best.morale||70)+6, 30, 99); }catch(e){}
      try{ affAdd(best, +6, `${mno}월 이달의 선수`); }catch(e){}
      try{ socialFill([[`{p} 이달의 선수 축하한다!!`,1],[`{p} 요즘 진짜 미쳤음`,1],
                       [`이달의 선수 나왔다 ㅋㅋ 우리 팀도 되는구나`,1],
                       [`{p} 재계약 빨리 해야 하는 거 아니냐`,1]], 3+R(2), 1,
                      {t:bestT.short, p:best.name}); }catch(e){}
      try{ addMood(`🏅 ${best.name} 선수가 ${mno}월 이달의 선수로 뽑혔습니다. 라커룸 분위기가 좋습니다.`, "good"); }catch(e){}
    }
  }
  if(bm){
    const rec=`${bmD.W}승 ${bmD.D}무 ${bmD.L}패`;
    const cn = bm.isUser ? "우리 감독" : ((COACHES[bm.id]||{}).n||"감독");   // 뉴스 문장용
    addNews(`🎖️ <b>${mno}월 ${dn} 이달의 감독 — ${bm.short} ${cn}</b> <span class="small">${rec}</span>`,
      bm.isUser?"good":null, "club");
    if(bm.isUser){
      pushFeed({cat:"manager", ic:"🎖️", tone:1, tid:bm.id, src:"K리그 공식",
        head:`${bm.name} 감독, ${mno}월 이달의 감독`,
        sub:`${mno}월 ${rec}. 전력 대비 성과가 가장 좋았던 사령탑으로 뽑혔다.`});
      try{ adjustTrust("owner", +5, `${mno}월 이달의 감독`); }catch(e){}
      try{ adjustTrust("fans",  +5, `${mno}월 이달의 감독`); }catch(e){}
      try{ for(const p of (bm.players||[])) p.morale=clamp((p.morale||70)+2, 30, 99);
           bm.morale=clamp((bm.morale||70)+2, 40, 99); }catch(e){}
      try{ socialFill([[`감독님 이달의 감독 축하드립니다`,1],[`전술이 확실히 먹히고 있다`,1],
                       [`{t} 요즘 경기 볼 맛 난다`,1],[`이 흐름 시즌 끝까지 갔으면`,1]], 3+R(2), 1, {t:bm.short}); }catch(e){}
      try{ fmkFill([[`{t} 감독 이달의 감독 받았네 ㄹㅇ 잘하더라`,1],[`저 전력으로 저 성적이면 인정`,1]], 2+R(2), {t:bm.short}); }catch(e){}
      try{ addMood(`🎖️ 감독이 ${mno}월 이달의 감독으로 뽑혔습니다.`, "good"); }catch(e){}
      try{ meLog(`🎖️ ${mno}월 ${dn} 이달의 감독 수상 (${rec})`); }catch(e){}
    }
  }
}
/* 감독이 받은 이달의 감독 횟수 — 위신·경력에 쓴다 */
function motmMgrCount(){ try{ const M=motmState(); return Math.max(M.nMe|0, (M.mg||[]).filter(x=>x&&x.me).length); }catch(e){ return 0; } }
function motmPlCount(){ try{ const M=motmState(); const ut=(G.jobless?null:userTeam());
  return Math.max(M.nPl|0, (M.pl||[]).filter(x=>x&&ut&&x.tid===ut.id).length); }catch(e){ return 0; } }
function seasonAwards(t1, div){
  /* ⚠ 시상식은 리그별로 열린다. 예전처럼 전 구단을 한 통에 넣으면 K리그1 시상식에
     K리그2 선수가 베스트11로 뽑힌다(실측: 11명 중 6명이 2부 선수였다). */
  const D=div||1;
  const all=Object.values(G.teams).filter(t=>t.div===D).flatMap(t=>t.players.map(p=>({p,t})));
  const played=all.filter(x=>x.p.apps>=10);
  const nm=x=>x?`${x.p.name}(${x.t.short})`:"-";
  const topS=[...all].sort((x,y)=>(y.p.goals||0)-(x.p.goals||0))[0];
  const topA=[...all].sort((x,y)=>(y.p.assists||0)-(x.p.assists||0))[0];
  const mvp=[...played].sort((x,y)=>(y.p.seasonRating||0)-(x.p.seasonRating||0))[0];
  const young=[...played].filter(x=>G.season-x.p.by<=23).sort((x,y)=>(y.p.seasonRating||0)-(x.p.seasonRating||0))[0];
  const gk=[...played].filter(x=>x.p.pos==="GK").sort((x,y)=>(y.p.seasonRating||0)-(x.p.seasonRating||0))[0];
  /* 베스트 11 — 4-3-3 기준으로 포지션별 평점 상위. 실제 시상식도 포지션 정원을 지킨다. */
  const need={GK:1, DF:4, MF:3, FW:3}, used=new Set(), xi=[];
  for(const pos of ["GK","DF","MF","FW"]){
    const cs=[...played].filter(x=>x.p.pos===pos && !used.has(x.p.id))
      .sort((a,b)=>(b.p.seasonRating||0)-(a.p.seasonRating||0));
    for(let i=0;i<need[pos] && i<cs.length;i++){ used.add(cs[i].p.id); xi.push(cs[i]); }
  }
  /* 올해의 감독 — 순위가 아니라 "전력 대비 얼마나 넘겼는가". 약체를 끌고 올라간 쪽이 받는다. */
  const rank=(div===2?tableOf(2):t1).map((t,i)=>({t, pos:i+1, s:teamOVR(t)}));
  const bySt=[...rank].sort((a,b)=>b.s-a.s);
  let coach=null, bestOver=-99;
  for(const r of rank){
    const expect=bySt.findIndex(x=>x.t.id===r.t.id)+1;
    const over=expect-r.pos;                      // 예상 순위보다 몇 계단 위로 올라왔나
    if(over>bestOver){ bestOver=over; coach=r; }
  }
  /* 🏅 수상 이력을 선수 자신에게 남긴다 — 화면 문자열로만 두면 「이 선수가 상을 받았나」를
     되물을 방법이 없다. 중동 오퍼 자격 판정처럼 실적을 봐야 하는 곳에서 쓴다.
     ⚠ K리그1 시상식만 새긴다 — 2부 개인상은 대륙 시장의 관심사가 아니다. */
  if(D===1){
    const mark=(x,k)=>{ if(!x||!x.p) return; const A=(x.p.acc=x.p.acc||{}); A[k]=(A[k]||0)+1; A.s=G.season; };
    mark(topS,"top"); mark(topA,"ast"); mark(mvp,"mvp"); mark(young,"young"); mark(gk,"gk");
    for(const x of xi) mark(x,"xi");
  }
  return {
    topScorer: topS?`${nm(topS)} ${topS.p.goals}골`:"-",
    assist:    topA?`${nm(topA)} ${topA.p.assists}도움`:"-",
    mvp:       mvp?`${nm(mvp)} 평점 ${mvp.p.seasonRating.toFixed(2)}`:"-",
    young:     young?`${nm(young)} ${G.season-young.p.by}세 · 평점 ${young.p.seasonRating.toFixed(2)}`:"-",
    gkAward:   gk?`${nm(gk)} 평점 ${gk.p.seasonRating.toFixed(2)}`:"-",
    coach:     coach?`${coach.t.name} (예상 대비 ${bestOver>0?"+":""}${bestOver}계단)`:"-",
    bestXI:    xi.map(x=>({n:x.p.name, t:x.t.short, pos:x.p.pos, r:(x.p.seasonRating||0).toFixed(2)}))
  };
}
/* ── 시즌 세리머니 ───────────────────────────────────────────────
   우승·승격·강등은 숫자만 바뀌고 끝날 일이 아니다. 트로피를 기록하고, 팬이 떠들고,
   구단 규모(팬 수)와 선수단 사기가 실제로 움직인다. */
function seasonCeremony(t1, t2, champ, champ2, relIds, proIds){
  const u=userTeam(); if(!u) return;
  if(!G.trophies) G.trophies=[];
  const utTbl=u.div===1?t1:t2, pos=utTbl.findIndex(x=>x.isUser)+1;
  const V={t:u.short, o:"", n:pos};
  const add=(kind,label)=>{ G.trophies.push({s:G.season, kind, label, team:u.name}); };
  const bump=(fans,mor)=>{ u.fans=Math.round(clamp(u.fans*(1+fans),4,120)*10)/10;
    for(const p of u.players) p.morale=clamp(p.morale+mor,30,99);
    u.morale=clamp((u.morale||70)+mor,40,99); };

  if(champ.id===u.id){
    add("champ", `${G.season} ${divName(1)} 우승`);
    bump(0.16, 8);
    socialFill(SOC.champ, 6+R(3), 1, V); fmkFill(FMK.champ, 4+R(3), V);
    rivalFill(SOC.runnerUp, 2, 0, V);
    pushFeed({cat:"club", ic:"🏆", tone:1, tid:u.id, src:"K리그 공식",
      head:`${u.name}, ${G.season} ${divName(1)} 우승`,
      /* 🏟️ ⚠ 제보 원문 — 「리그 우승 시 뉴스에 '트로피가 강릉하이원아레나로 들어온다' 는 문구가
         있는데 현재 구장이 아닌 이전 구장을 서술하고 있다. 신구장 건설 또는 인게임 에디터로
         변경한 이름을 반영하지 않는 것 같다」.
         원인 — 여기만 <b>고정 자료표(STADIUM)</b>를 직접 읽고 있었다. 그 표는 게임 시작 시점의
           원본 값이라 전용구장 신축(stadFinish)도, 에디터 구장 이름 변경도, 명명권 판매도
           반영되지 않는다. 살아 있는 값은 t.stad 이고, 그걸 읽는 창구가 stadOf(t) 다.
           (구단명·선수명·모기업명은 이미 살아 있는 값을 읽고 있었다 — 구장만 새고 있었다) */
      sub:`시즌 최종 ${u.Pts}점. 트로피가 ${(function(){ try{ return stadOf(u).n; }catch(e){ return "홈 구장"; } })()}에 들어온다.`});
    addNews(`🏆 <b>${u.name} ${G.season} ${divName(1)} 우승!</b> 감독 통산 ${G.trophies.filter(x=>x.kind==="champ").length}번째 리그 우승`,"good");
  } else if(champ2.id===u.id){
    add("champ2", `${G.season} K리그2 우승 · 승격`);
    bump(0.20, 8);
    socialFill(SOC.promoted, 5+R(3), 1, V); fmkFill(FMK.promoted, 3+R(2), V);
    addNews(`🥇 <b>${u.name} K리그2 우승 — 1부 승격!</b>`,"good");
  } else if((proIds||[]).indexOf(u.id)>=0){
    add("promo", `${G.season} 승격`);
    bump(0.14, 6);
    socialFill(SOC.promoted, 4+R(3), 1, V); fmkFill(FMK.promoted, 2+R(2), V);
  } else if((relIds||[]).indexOf(u.id)>=0){
    add("releg", `${G.season} 강등`);
    bump(-0.18, -8);
    socialFill(SOC.relegated, 5+R(3), -1, V); fmkFill(FMK.relegated, 3+R(3), V);
    pushFeed({cat:"club", ic:"⬇️", tone:-1, tid:u.id, src:"K리그 공식",
      head:`${u.name}, ${G.season} 시즌 강등 확정`,
      sub:`주축 선수 이탈이 불가피하다는 관측이 나온다. 감독 거취도 도마에 올랐다.`});
  } else if(pos===2 && u.div===1){
    add("runner", `${G.season} 준우승`);
    bump(0.08, 4);
    socialFill(SOC.runnerUp, 4+R(2), 0, V);
  } else if(u.div===1 && pos>=t1.length-2){
    socialFill(SOC.stayUp, 3+R(2), 1, V);
  } else {
    socialFill(SOC.midTable, 3+R(2), 0, V);
  }
  // 개인상 수상자가 우리 팀이면 별도 소식
  const h=G.history[G.history.length-1];
  for(const [k,label] of [["topScorer","득점왕"],["mvp","MVP"],["young","영플레이어"],["assist","도움왕"]]){
    if(h && h[k] && h[k].includes(`(${u.short})`)){
      addNews(`🎖️ ${label}: ${h[k]} — ${u.short} 소속`,"good");
      socialFill([[`우리 팀에서 ${label} 나왔다 ㅠㅠ 자랑스럽다`,1],
                  [`${label} 축하합니다!! 내년에도 부탁해요`,1]], 2, 1, V);
    }
  }
  /* 📜 계약 만료 — 재계약이 안 됐으면 여기서 팀을 떠난다 (시즌 정산의 맨 마지막) */
  try{ mgrCtSeasonEnd(); }catch(e){}
}
function ageDecline(p, drop){ // 33세 이상: 세부 능력치도 함께 하락 (신체 능력 > 정신 능력 순으로 빠르게 하락)
  const phys=Math.max(1,Math.round(drop*1.1));
  const ment=Math.max(0,Math.round(drop*0.5));
  if(p.attr){
    p.attr.pace=clamp(p.attr.pace-phys-R(2),20,99);
    p.attr.tck=clamp(p.attr.tck-Math.round(phys*0.7),20,99);
    p.attr.dri=clamp(p.attr.dri-Math.round(phys*0.6),20,99);
    p.attr.hea=clamp(p.attr.hea-Math.round(phys*0.4),20,99);
    p.attr.mar=clamp(p.attr.mar-Math.round(ment*0.6),20,99);
    p.attr.pos_=clamp(p.attr.pos_-Math.round(ment*0.4),20,99);
    p.attr.pass=clamp(p.attr.pass-Math.round(ment*0.4),20,99);
    p.attr.fin=clamp(p.attr.fin-Math.round(ment*0.4),20,99);
    p.attr.lng=clamp(p.attr.lng-Math.round(ment*0.4),20,99);
    p.attr.cmp=clamp(p.attr.cmp-Math.round(ment*0.2)+(Math.random()<0.25?1:0),20,99); // 침착성은 경험으로 거의 유지
  }
  if(p.gk){
    p.gk.shot=clamp(p.gk.shot-ment,20,99);
    p.gk.cmd=clamp(p.gk.cmd-Math.round(ment*0.6)+(Math.random()<0.2?1:0),20,99);
    p.gk.gkp=clamp(p.gk.gkp-ment,20,99);
  }
}
/* ═══════════════════════════════════════════════════════════════
   💰 계약 만료 전 매각 — FA 로 그냥 잃느니 헐값에라도 판다.
   현실의 구단이 반드시 하는 일이고, 이게 없으면 리그의 좋은 선수가 매년
   이적료 0원으로 시장에 쏟아진다(제보). 좋은 선수일수록 사겠다는 곳이 많다.
   ⚠ 만료가 코앞이라 값은 시장가의 55~90%밖에 못 받는다 — 파는 쪽도 손해를 본다.
   ══════════════════════════════════════════════════════════════ */
/* 📜 AI 계약 연차 정책 — ⚠ 제보: 「AI 구단 계약이 대부분 1~2년이라 보스만 룰과 타 구단
   제의에 매우 취약하다. 어린 선수일수록 장기(최대 5년), 30세 이상은 (레전드가 아니면)
   줄여 가는 현명한 재계약을 학습했으면 좋겠다」. 재계약·영입·유스·FA 전 경로가 이걸 쓴다. */
/* 🌱 ⚠ 제보 원문 — 「AI 구단들이 포텐 160 이상인데도 현재 어빌만 놓고 FA 대상자로 선정한다.
   일정 포텐 이상의 어린 선수는 절대 시장에 풀지 말고, 어빌이 부족하면 임대를 보내서라도
   끝까지 키워 쓰거나 팔아야 한다」. 실측(3시즌): FA 시장에 포텐 160+ 25세 이하가 9~13명씩
   쌓였고, OVR 75~78 급이 3시즌째 주인을 못 찾고 남아 있었다(쟈고 28→30세).
   ─ 「놓아주면 안 되는 자원」을 한 곳에서 정의한다. 방출·계약만료 두 경로가 함께 쓴다. */
function aiKeepTalent(p){
  try{
    if(!p) return false;
    const age=G.season-(p.by||2000);
    const pot=dispPot(p);
    if(age<=25 && pot>=150) return true;      // 어리고 재능 있으면 무조건 잡는다
    if(age<=28 && pot>=170) return true;      // 특급 재능은 조금 더 늦게까지
    if(age<=30 && p.ovr>=76) return true;      // 지금 당장 리그 최상급이면 나이와 무관하게 잡는다
    if(age<=32 && p.ovr>=77) return true;      // 리그 파괴급 (제보 — 31세 야잔 · 실측 32세 OVR78 유출 후 77 로)
    return false;
  }catch(e){ return false; }
}
/* 🔁 재능은 있는데 지금 스쿼드에 자리가 없다 — 방출 대신 임대를 보낸다 (요청) */
function aiLoanOutYoung(from, p){
  try{
    if(!from || !p || p.loan || p.army) return false;
    const mv=marketValue(p)||1;
    const cands=[];
    for(const id in G.teams){
      const t=G.teams[id];
      if(!t || t===from || t.isUser || isArmyTeam(t)) continue;
      if((t.players||[]).length>=30) continue;
      if(p.ovr < teamOVR(t)-8) continue;                 // 그 팀에서도 못 뛸 수준이면 의미가 없다
      if(frnQ(p) && t.players.filter(q=>frnQ(q)).length >= (t.div===1?6:5)) continue;
      cands.push(t);
    }
    if(!cands.length) return false;
    /* 출전 기회가 있는 곳 — 아래 리그·약팀 우선 */
    cands.sort((a,b)=>(teamOVR(a)+(a.div===1?4:0))-(teamOVR(b)+(b.div===1?4:0)));
    const to=cands[Math.floor(Math.random()*Math.min(4, cands.length))];
    from.players.splice(from.players.indexOf(p),1);
    to.players.push(p);
    p.loan={own:from.id, to:to.id, until:G.season+1, half:false, share:0.5, buy:false, fee:null,
            s:G.season, apps0:p.apps||0, mv0:mv, backR:null, inbound:1};
    try{ clearClubBaggage(p, clamp((p.morale||70)+6, 30, 99)); joinClub(to, p, false); }catch(e){}
    p.ct=Math.max(p.ct||0, 2);                            // 원소속과의 계약은 살려 둔다
    if(p.ovr>=68 || dispPot(p)>=170)
      addNews(`🔁 ${from.short}, ${p.name}(${G.season-(p.by||2000)}세) ${to.short}으로 임대 — 출전 시간을 주기 위한 결정`, null, "club");
    return true;
  }catch(e){ return false; }
}
function aiCtYears(p){
  const age=G.season-(p.by||2000);
  if(age<=23) return 4+R(2);                 // 4~5년 — 유망주는 길게 묶는다
  if(age<=26) return 3+R(2);                 // 3~4년
  if(age<=29) return 2+R(2);                 // 2~3년
  /* 30대 — 구단의 얼굴(통산 280경기+ 레전드)은 한 해 더 예우한다 */
  if(age<=32) return ((p.career||0)>=280 ? 2 : 1) + R(2);   // 1~2년 · 레전드 2~3년
  return 1;                                   // 33세+ — 해마다 본다
}
function tryPreExpirySale(from, p){
  try{
    if(!p || p.army || (p.loan && p.loan.own!==from.id)) return false;
    /* 성사 확률 — 잘하는 선수일수록 사겠다는 곳이 줄을 선다.
       젊은 상위 자원(27세 이하 · OVR 70+)은 이 주사위를 건너뛴다 — 안 팔리는 건
       예산 문제일 때뿐이고, 그 경우는 원소속이 재계약으로 붙잡는다 (제보). */
    const _sAge=G.season-(p.by||2000);
    const _hot=_sAge<=27 && p.ovr>=70;
    if(!_hot && Math.random() > clamp(0.20+(p.ovr-64)*0.058, 0.10, 0.92)) return false;
    const mv=marketValue(p);
    const cands=[];
    for(const id in G.teams){
      const t=G.teams[id];
      if(!t || t===from || t.isUser || isArmyTeam(t)) continue;
      if((t.players||[]).length>=30) continue;
      if(p.ovr < teamOVR(t)-1) continue;             // 그 팀에 보탬이 안 되면 사지 않는다
      if((t.budget||0) < mv*(_hot?0.35:0.7)) continue;   // 살 돈이 없다 (상위 유망 자원은 할부라도 긁는다)
      cands.push(t);
    }
    if(!cands.length) return false;
    /* 좋은 선수는 돈 있고 강한 팀이 데려간다. 무작위로 뿌리면 리그가 평준화돼
       우승 후보의 전력이 눈에 띄게 깎인다(실측 최고 팀OVR 74.6 → 71.5). */
    cands.sort((a,b)=>(teamOVR(b)*2.0+(b.budget||0)*0.02)-(teamOVR(a)*2.0+(a.budget||0)*0.02));
    const to=cands[Math.floor(Math.random()*Math.min(4, cands.length))];
    const fee=Math.round(Math.min(mv*(0.55+Math.random()*0.35), Math.max(0.1,(to.budget||0)))*10)/10;
    to.budget=Math.round(((to.budget||0)-fee)*10)/10;
    from.budget=Math.round(((from.budget||0)+fee)*10)/10;
    const i=from.players.indexOf(p); if(i<0) return false;
    from.players.splice(i,1);
    p.ct=aiCtYears(p); clearClubBaggage(p, 68); p._faWhy=null;
    p.wage=Math.max(p.wage, wageExpect(p.ovr,p.frn,to.div));
    to.players.push(p);
    try{ joinClub(to, p); }catch(e){}
    if(p.ovr>=74) addNews(`💸 ${from.short}, 계약 만료를 앞둔 <b>${p.name}</b>을(를) ${to.short}에 ${fee}억에 매각했습니다`, null, "club");
    return true;
  }catch(e){ return false; }
}
function startNewSeason(){
  /* 🏗️ 겨울 증설 공사 완공 — 수용 인원이 늘어난 뒤에 기준 관중을 다시 잡아야 한다 */
  try{ donSeasonTick(); }catch(e){}
  /* 🎟️ 기준 관중 갱신 — 지난 시즌 실제 관중과 성적을 본다. 순위표·회계가 지워지기 전에 먼저. */
  try{ attSeasonAdjust(); }catch(e){}
  /* 🔒 ⚠ 제보 — 시즌을 넘길 때마다 에디터로 고친 구단 명칭을 다시 못 박는다(원상복구 방지) */
  try{ edLockSweep(); }catch(e){}
  try{ uidIntegrity(); }catch(e){}   // 🆔 유스 승격·영입으로 늘어난 선수까지 번호 정합성 유지
  /* 🎖️ 새 시즌 주장단은 프리시즌에 정한다 — 진행 게이트(capNeeded)가 막고, 여기서 미리 알려 준다 */
  try{ if(!G.jobless) notify("🎖️ 새 시즌 주장단을 <b>시즌 시작 전에</b> 정해야 합니다 — 스태프 화면에서 주장·부주장을 지정하세요.","warn"); }catch(e){}
  try{ archiveAllSeasonRecs(G.season); }catch(e){}   // 📚 지난 시즌 성적을 커리어에 남긴다
  /* 📜 감독 경력 장부 — 순위표·기록이 지워지기 전에 시즌 한 줄을 찍는다 (요청) */
  try{ cvPushRow("season"); }catch(e){}
  G.season++;
  try{ seasonLegInit(); }catch(e){}   // 🗓️ 제보 — 새 시즌 「출발 소속」 도장
  /* 🏅 월간 시상 — 새 시즌은 새 달력이다. 기준점을 다시 잡고 지난 시즌 목록은 남긴다 (요청) */
  try{ const M=motmState(); M.last=null; }catch(e){}
  G.negoBlock={};      // 협상 냉각기는 시즌을 넘기지 않는다 (제보 — 겨울 이적시장에서도 안 풀림)
  G.loanAsks=[];       // 🔁 임대 문의도 시즌을 넘기지 않는다 (제보 — 지난 시즌 문의가 빈 채로 남아 있음)
  G.hiredAtR=0;   // 새 시즌 — 유예 기준점 초기화
  loanReturnAll();
  /* 🎯 시즌 목표도 해마다 새로 세운다 — 지난 시즌의 목표가 그대로 남아 평가 기준이 되면 안 된다.
     G.goal 을 비우면 goalNeeded() 가 진행 게이트를 막고, 감독이 새 목표를 공언해야 시즌이 시작된다. */
  if(!G.jobless) G.goal=null;
  G.finalTbl=null;      // 지난 시즌 최종 순위 스냅샷은 여기서 버린다
  // 완장은 시즌마다 새로 정한다 (capInfo 가 시즌이 바뀐 걸 보고 set 을 내린다)
  for(const id in G.teams){ const t=G.teams[id]; if(t.cap) t.cap.set=false; }          // 임대 나간 선수들이 원 소속으로 돌아온다
  // 성장/노화
  for(const id in G.teams){ const t=G.teams[id];
    for(const p of t.players){
      // 성장·노쇠는 이제 매일(developPlayer) 처리된다. 시즌 전환에서는 몸 상태만 리셋한다.
      const age=G.season-p.by;
      if(age>=34 && Math.random()<0.5){        // 비시즌 동안의 추가 노쇠 — 나이 많은 선수만
        if(p.ovrF===undefined) p.ovrF=p.ovr;
        p.ovrF=clamp(p.ovrF-1, 38, 96); p.ovr=Math.round(p.ovrF);
        ageDecline(p, 1);
      }
      p.ovr=clamp(p.ovr,40,96); p.ovrF=p.ovr; p.cond=95; p.mn=0;
      /* 🩺 처치 꼬리표는 시즌을 넘기지 않는다 — 진통제는 그 경기용이고 재활 창은 끝난다 (요청) */
      delete p.pain; delete p.rehab; if(p.surg && p.surg.s<G.season-1) delete p.surg;
      /* 🚑 ⚠ 제보 원문 — 「경기 중 부상당했던 선수가 처음에는 1주라고 써있었는데 일정 진행해서
         며칠 지나니까 갑자기 38주로 늘어나 있다」.
         ─ 원인: 시즌 전환이 p.inj=0 으로 몸만 고치고 「회복 예정일(injUntil)」은 지우지 않았다.
           새 시즌은 달력이 0일부터 다시 시작하는데, 지난 시즌 막바지(260일께)의 예정일이
           남아 있으면 새 부상(1주)이 하루 뒤 일일 정산에서 (260-0)/7 ≈ 38주로 둔갑했다.

         🚑 ⚠ 제보 원문 ② — 「연말에 부상 당한 선수가 시즌이 바뀌면 부상 상태가 초기화 되는
            버그가 있는지 한 번 확인 부탁드리겠습니다!! 저희 팀 이지후라는 선수가 2039년 12월
            17일에 부상 3주 상태였는데 2040년 1월 3일 경기에 정상 상태로 출전을 했습니다.
            … 부상 일수가 남았다면 시즌이 바뀌어도 계속 부상 일수까지 부상 상태로 남게」.
         ─ 맞는 지적이다. 위 수정이 「예정일까지 싹 지우는」 방향이라, 12월에 다친 선수가
           1월 1일에 멀쩡해졌다. 비시즌은 두 주 남짓이라 3주 부상이 나을 시간이 아니다.
         ─ 달력은 1월 1일이 0일이므로, 지난 시즌의 예정일에서 한 해(365일)를 빼면
           그대로 새 달력의 예정일이 된다. 남은 날이 있으면 그만큼 계속 부상으로 둔다.
           (예: 12/17 = 350일에 3주 → 예정일 371 → 371−365 = 새 달력 6일 = 1/7 복귀) */
      {
        const _due=(typeof p.injUntil==="number") ? p.injUntil-365 : -1;   // 새 달력 기준 예정일
        if((p.inj||0)>0 && _due>0){
          p.injUntil=_due;
          p.inj=Math.max(1, Math.ceil(_due/7));
          p.injW0=Math.max(p.injW0||0, p.inj);
        } else {
          p.inj=0; p.injUntil=null; delete p.injW0;
        }
      }
      /* 🎁 선물 쿨다운 도장도 새 달력으로 옮긴다 — 안 그러면 「220일 남음」이 된다 (제보) */
      if(typeof p._giftAt==="number"){
        const g=p._giftAt-365;
        if(g+GIFT_COOL>0) p._giftAt=g; else delete p._giftAt;
      }
      /* 🟨 대회(EACL·CWC) 징계는 그 시즌 에디션과 함께 끝난다 — 새 대회로 이월되지 않는다.
         (리그 잔여 징계는 실제 규정처럼 이월 유지 · 제보 — CWC발 유령 EACL 정지 차단의 이중 안전망) */
      delete p.banE; delete p.banENew; delete p.banC; delete p.banCNew;
    }
    /* 계약 연차 감소. 예전에는 만료되면 조용히 자동 갱신됐다 — 그러면 재계약이라는 행위 자체가
       의미가 없다. 이제 만료되면 실제로 팀을 떠난다(AI 구단은 알아서 다시 잡는다). */
    for(const p of [...t.players]){
      /* ⚠ 제보 — 「임대 보낸 선수가 FA로 풀려 사라졌다」.
         계약은 원소속 구단과 맺은 것인데, 임대 나간 선수는 임대처 명단에 있어서
         임대처가 계약을 깎고 만료 처리해 시장에 내놓고 있었다.
         빌려온 선수의 계약에는 손대지 않는다 — 복귀한 뒤 원소속에서 처리된다. */
      if(p.loan && p.loan.own!==t.id) continue;
      /* 🎖️ ⚠ 제보 — 「김천에서 돌아온 선수 연봉이 몇 배로 뻥튀기되어 있다」.
         복무 중인 선수의 계약은 원소속 구단과 맺은 것인데, 명단상 상무 소속이라
         오프시즌마다 상무가 그를 「재계약」하면서 상무 기준 연봉(wageExpect)으로 올려 버렸다.
         만료되면 상무가 FA로 풀거나 다른 팀에 팔기까지 했다.
         ─ 연차만 정상적으로 줄이되 0 이 되지 않게 두고, 처분은 전역 후 원소속이 판단한다. */
      /* 🎖️ 복무 중에는 계약 기간이 흐르지 않는다 — 전역하면 남은 햇수를 그대로 들고 돌아온다.
         ⚠ 제보 — 「병역 기간만큼 계약이 정지되는지 확인해 달라」. 예전에는 줄어들고 있었다. */
      if(p.army || isArmyTeam(t)) continue;
      p.ct=(p.ct||1)-1;
      if(p.ct>0) continue;
      /* 임대 나가 있는 우리 선수의 계약이 만료됐다 — 먼저 불러들이고 나서 판단한다 */
      if(p.loan && p.loan.own===t.id){
        p.ct=1;                       // 복귀할 자리는 남겨 둔다(다음 오프시즌에 다시 판단)
        continue;
      }
      if(t.isUser){
        /* ⚠ 제보 — 「36세 선수는 재계약 의미가 없어지려나요. 근데 그러면 또 은퇴인사 못보고 떠나고」.
           은퇴는 37세부터 해마다 70% 확률이라 재계약이 무의미하진 않다 — 문제는 재계약을 안 했을 때다.
           36세 이상은 FA 시장에 나가는 즉시 조용히 정리된다(startNewSeason 의 FA 은퇴 처리).
           그 길로 보내면 오래 뛴 선수가 인사 한마디 없이 사라진다 — 계약 만료가 곧 은퇴인 나이면
           FA 대신 은퇴 인사(retireFarewell)를 거쳐 배웅한다. */
        const _age=G.season-(p.by||2000);
        t.players.splice(t.players.indexOf(p),1);
        if(_age>=36){
          retireFarewell(p, t);
        } else {
          clearClubBaggage(p, 70); p.ct=1;
          (G.freeAgents=G.freeAgents||[]).push(p);
          addNews(`📄 <b>${p.name}</b> 계약 만료 — 자유계약(FA)으로 팀을 떠났습니다`,"warn");
          renewSocial(p, "leave");
        }
      } else {
        /* AI 구단의 재계약 판단.
           ⚠ 제보 — 「어빌 좋고 어린 선수가 연봉까지 싸게 FA 시장에 너무 자주 풀린다」.
              예전 조건은 `나이<=32 && 스쿼드<=27 && 확률 0.78` 이 전부였다. 능력을 아예
              보지 않아서 25세 OVR 80 도 매년 22% 확률로 시장에 나왔다. 실측으로도
              오프시즌마다 「27세 이하 · 리그 상위 25%」가 1~3명씩 공짜로 풀렸다.
           ─ 구단이 실제로 하는 판단을 넣는다: 어리고 잘하면 어떻게든 잡고,
             감당 못 할 연봉이거나 나이가 찼으면 놓되 그냥 잃지 않고 판다. */
        const age=G.season-p.by;
        const lv=p.ovr-teamOVR(t);                       // 팀 안에서의 위상
        let keepP;
        if(age<=23)      keepP = p.ovr>=68 ? 0.985 : 0.90;
        else if(age<=27) keepP = p.ovr>=72 ? 0.98  : p.ovr>=66 ? 0.94 : 0.83;
        else if(age<=30) keepP = p.ovr>=74 ? 0.95  : p.ovr>=68 ? 0.87 : 0.70;
        else if(age<=32) keepP = p.ovr>=76 ? 0.88  : 0.62;
        else if(age<=34) keepP = p.ovr>=78 ? 0.70  : 0.34;
        else             keepP = p.ovr>=80 ? 0.42  : 0.14;
        /* 스쿼드가 넘치면 아래쪽부터 정리한다 — 다만 주전급은 자리를 만들어서라도 잡는다 */
        if(t.players.length>27 && lv<-2) keepP*=0.45;
        /* 💸 감당 못 할 연봉 — 이건 실제로 구단이 놓아주는 가장 흔한 이유다.
           놓아준 이유를 표시해 둔다: 이런 선수는 FA 시장에서도 그 연봉을 그대로 부른다. */
        const load = p.wage/Math.max(0.4, wageExpect(p.ovr,p.frn,t.div));
        let why = age>=33 ? "age" : (t.players.length>27 ? "squad" : "form");
        /* ⚠ 제보 — 「타 팀 23세 어빌 175 윙어가 FA로 풀렸다. 어리고 재능 있는 선수는
           재계약이 새로 사 오는 것보다 싸고, 놓아주면 남 좋은 일이라는 걸 구단이 학습해야
           한다」. 젊은 핵심의 비싼 연봉은 놓아줄 이유가 아니라 다시 잡거나 팔 이유다 —
           연봉 부담 감액을 젊은 상위 자원(27세 이하 · OVR 70+)에게는 거의 적용하지 않는다. */
        const youngStar = age<=27 && p.ovr>=70;
        /* 🌱 ⚠ 제보 — 「포텐 160 이상인데 현재 어빌만 보고 FA 대상자로 선정한다」.
           여태 keepP 가 p.ovr 만 봤다. 잠재력을 함께 본다 — 어리고 재능 있으면 지금 못해도 잡는다. */
        {
          const _pot=dispPot(p);
          if(age<=23)      keepP=Math.max(keepP, _pot>=170?0.999 : _pot>=150?0.995 : _pot>=140?0.985 : keepP);
          else if(age<=26) keepP=Math.max(keepP, _pot>=170?0.995 : _pot>=150?0.985 : _pot>=140?0.96  : keepP);
          else if(age<=28) keepP=Math.max(keepP, _pot>=175?0.98  : _pot>=160?0.95  : keepP);
        }
        if(load>1.55){ keepP *= youngStar ? 0.92 : 0.55; why="wage"; }
        /* 🚫 놓아주면 안 되는 자원 — 연봉 부담이 있어도 재계약이 정답이다 (요청) */
        if(aiKeepTalent(p)) keepP=Math.max(keepP, 0.985);
        if(Math.random()<keepP){ p.ct=aiCtYears(p); p.wage=Math.max(p.wage, wageExpect(p.ovr,p.frn,t.div)); }   // 어릴수록 길게 (제보 — 보스만 방어)
        else{
          p._faWhy=why;
          /* 💰 놓아줄 선수라도 그냥 잃지는 않는다 — 계약이 끝나기 전에 팔아 이적료를 회수한다.
             좋은 선수일수록 사겠다는 구단이 있고, 그만큼 시장에는 나오지 않는다. */
          if(!tryPreExpirySale(t, p)){
            /* 🔁 재능은 있는데 자리가 없어서 놓으려던 경우 — 임대로 돌린다 (요청) */
            if(age<=24 && dispPot(p)>=150 && aiLoanOutYoung(t, p)){ p._faWhy=null; }
            else if(youngStar || aiKeepTalent(p)){
              /* 사겠다는 곳조차 없으면(예산 사정 등) 공짜로 내보내는 대신 1~2년 더 데리고
                 간다 — FA는 나이 들었거나 평범한 선수의 길이다 (제보). */
              p.ct=aiCtYears(p); p.wage=Math.max(p.wage, wageExpect(p.ovr,p.frn,t.div)); p._faWhy=null;
            } else {
              t.players.splice(t.players.indexOf(p),1);
              clearClubBaggage(p, 68); p.ct=1;
              (G.freeAgents=G.freeAgents||[]).push(p);
            }
          }
        }
      }
    }
    /* 👋 은퇴 — ⚠ 요청: 「35세부터 은퇴 확률이 생기고, 40세가 될 경우 은퇴.
       호감도 100이면 설득해서 번복 가능(45세까지)」. 예전에는 37세부터 일률 70%였다.
       나이 곡선으로 바꾼다 — 35세 15% → 39세 80% → 40세부터 무조건(유저 팀은 배웅 대화에서
       호감도 100 선수에 한해 붙잡을 수 있다 — _retireNext 쪽). 45세는 최종 은퇴. */
    const _retP=(a)=> a>=45?1 : a>=40?1 : a>=39?0.80 : a>=38?0.62 : a>=37?0.48 : a>=36?0.30 : a>=35?0.15 : 0;
    const retired=t.players.filter(p=>!p.army && !(p.loan&&p.loan.own!==t.id) && Math.random()<_retP(G.season-p.by));
    for(const rp of retired){
      t.players.splice(t.players.indexOf(rp),1);
      if(t.isUser) retireFarewell(rp, t);        // 👋 마지막 인사 — 조용히 사라지지 않는다 (번복 기회 포함)
      else {
        if(rp.ovr>=76) addNews(`👋 ${rp.name}(${t.short}), ${G.season-rp.by}세로 현역 은퇴`, null, "club");
        try{ retireToStaff(rp, t); }catch(e){}   // 🎩 일정 확률로 지도자 시장에 나온다 (요청)
      }
    }
    // AI 스쿼드 정리 → FA 시장 방출
    /* ⚠ 제보 — 김천(상무) 소속 복무 중인 선수가 FA 시장에 나와 영입이 됐다.
       aiReleaseCheck 에는 군 가드가 있었는데 이 오프시즌 정리 루프에는 빠져 있었다.
       복무 중인 선수는 어떤 경로로도 시장에 나오지 않는다. */
    if(!t.isUser && !isArmyTeam(t)){
      G.freeAgents=G.freeAgents||[];
      while(G.freeAgents.length<25){
        const pool=t.players.filter(p=>!p.army);
        /* ⚠ 이 상한이 스쿼드 하한보다 낮으면 같은 오프시즌에 방출과 보강이 서로 싸운다 */
        if(pool.length<=aiSquadFloor(t)+2) break;
        const low=[...pool].sort((a,b)=>a.ovr-b.ovr)[0];
        if(!low) break;
        t.players.splice(t.players.indexOf(low),1);
        clearClubBaggage(low, 60); low.ct=1;
        G.freeAgents.push(low);
      }
    }
    // 🌱 AI 구단 유스 배출 → 🧱 자리별 스쿼드 보강 (풀백·골키퍼 기근과 리그 총원 감소를 함께 막는다)
    if(!t.isUser){
      try{ aiYouthIntake(t); }catch(e){}
      try{ aiSquadFill(t); }catch(e){}
    }
    t.budget=Math.round((t.budget + (t.div===1?11:4) + t.fans*0.16)*10)/10; // 스폰서/시즌 이적 자금
    setupFinance2(t);                                                        // 연봉 상한 재산정
  }
  // 유스 영입 (유저) — ⚠ 김천 상무 FC는 유스 아카데미가 없다. 선수는 오직 입대로만 온다.
  const ut=userTeam();
  if(isArmyTeam(ut)){
    addNews(`🎖️ 국군체육부대에는 유스 아카데미가 없습니다 — 새 시즌 전력은 입대 지원으로 채웁니다.`, null, "club");
  } else {
  /* 유스 등급(youthLv) — 몇 명을, 얼마나 큰 재목으로 '발굴'하는가
     훈련시설(trainLv) — 그 재목이 올라올 때 얼마나 '다듬어져' 있고, 특급이 터질 확률 보정
     둘 다 최고면 FM의 명문 아카데미처럼 매년 한 명쯤은 리그를 놀라게 할 아이가 나온다. */
  const yl=lvEff(ut.youthLv||1);   // 🔟 10단계 → 예전 1~5 성능 축
  const tl=lvEff(trainLv(ut));
  /* 배출 인원 — 등급마다 한 칸씩 차이가 난다 (예전엔 4등급 이상에서만 +1이라 1~3등급이 똑같았다) */
  const n=1+R(2)+[0,0,1,2,2,3][Math.round(yl)];
  for(let i=0;i<n;i++){
    /* 🧭 어느 자리 유망주가 올라오는가 — 예전에는 DF/MF/FW 만 뽑아 골키퍼가 아예 없었고,
       수비수도 세부 자리를 정하지 않아 능력치 추론이 대부분 센터백으로 몰렸다(제보 — 풀백·GK 기근).
       실제 아카데미 구성 비율로 뽑고, 팀에 모자란 자리는 가중치를 올린다. */
    const _slot=youthPickSlot(ut);
    const pos=_slot.pos;
    /* 🌱 홈그로운 제도(2025~) — 만 18세까지 국내 아마추어 팀에서 합계 5년(또는 연속 3년) 이상
       성장한 선수는 국적과 무관하게 '국내 선수'로 등록된다. 우리 아카데미 졸업생은 정의상
       이 기간 요건을 채우고 올라오므로, 외국 국적 유스는 콜업 즉시 홈그로운 판정을 받는다.
       유스 등급이 높을수록 외국 유소년을 일찍 발굴해 데려왔을 확률도 높다. */
    const hgY = Math.random() < (0.07 + yl*0.02);          // 1등급 9% → 5등급 17%
    const yp=mkPlayer(hgY?genFrnName():genName(),pos,G.season-17-R(2),Math.round(54+R(10)+(yl-1)+(tl-1)*0.6),hgY?1:0);
    if(hgY) yp.hg=1;
    /* 세부 자리를 못 박는다 — 능력치 추론에 맡기면 풀백·윙어가 거의 안 나온다 */
    try{ yp.prefPos=_slot.pref; yp.posFam=initPosFam(yp); syncPosBand(yp); applySpecialization(yp); retuneTraits(yp); }catch(e){}
    /* ⚠ 제보 — 「유스·훈련 시설이 최상이면 해마다 특급이 두세 명씩 나와 스쿼드가 너무 강해진다」.
       실측(유스5·훈련5): 포텐 92+ 가 1.8년에 1명, 85~91 이 매년 1명, 80~84 가 2.6명.
       특급이 흔하면 특급이라는 말이 의미를 잃는다.
       ─ 목표: 최상급(92+) 3년에 1명 · 특급(85~91) 2년에 1명 · 우수(80~84)도 절반으로. */
    /* ⚠ 제보(2차) — 「5성 유스+훈련이라도 특급은 가뭄에 콩 나듯 나와야 한다. 포텐 200 둘에
       185·181이 같은 시즌 콜업은 과하다」. 하향 후에도 특급이 1.4년에 1명꼴이라(실측 100시즌)
       다시 줄인다 — 목표: 특급(85+) 2년에 1명 · 최상급(92+) 5년에 1명. */
    /* 🌱 유소년 코치 — 아카데미 등급과 별개로 「사람」이 재목을 알아보고 키운다 */
    const _ycK=(function(){ try{ const L=acLvOf("youth"); return L==null?0.85:clamp(1+(L-AC_BASE)*0.075,0.85,1.45); }catch(e){ return 1; } })();
    const gemP = (0.008 + (yl-1)*0.016 + (tl-1)*0.009) * _ycK;   // 1/1등급 0.8% → 5/5등급 10.8%
    const gem = Math.random()<gemP;
    /* ⚠ 제보(3차) — 「이 게임은 풀출전 2년이면 풀포텐까지 크는 시스템이니(그게 FM 대비
       장점), 특급 확률만이 아니라 배출 전체의 포텐을 하향하는 게 맞다」.
       실측이 이를 뒷받침한다 — 포텐 84 유망주가 풀주전 1년 만에 풀포텐, 88·92도 2년.
       그런데 일반 배출 천장이 유스5 기준 84 = K리그1 역대 최고(79)보다 위였다.
       "보통" 유망주가 1년 만에 리그 최강이 되는 구조.
       ─ 천장을 리그 상위 3% 선(76~77)으로 내린다: 1등급 70 → 5등급 77.
         일반 배출은 「잘 키우면 리그 주전~탑급」, 리그를 넘는 건 특급(85+)만. */
    const _ycP=(function(){ try{ return acYouthPot(); }catch(e){ return 0; } })();
    const pot0=clamp(Math.round(yp.ovr+3+R(9)+(yl-1)*1.4+_ycP), 66, Math.round(70+(yl-1)*1.8+Math.max(0,_ycP)));
    /* 보석이라도 전원이 최상급은 아니다. 대부분 85~91에 머물고, 그중 일부만 92 위로 간다.
       유스5·훈련5 기준 — 최상급 3년에 1명 · 특급 2년에 1명 */
    const superGem = gem && Math.random()<0.42;
    yp.pot = gem ? (superGem ? clamp(pot0+9+R(8), 92, Math.round(92+(yl-1)))
                             : clamp(pot0+3+R(6), 85, 91))
                 : pot0;
    yp.wage=0.3;
    yp.ythOf=ut.id;                      // 🌱 우리 유스 출신 표식 (요청 — 은퇴 후 지도자 할인)
    ut.players.push(yp);
    addNews(`🌱 유스 아카데미 졸업: ${yp.name} (${pos}, ${G.season-yp.by}세, 잠재력 ${yp.pot>=85?"특급":yp.pot>=78?"우수":"보통"})${hgY?" — 외국 국적이지만 우리 유스에서 5년 이상 성장해 <b>홈그로운</b>으로 국내 선수 등록됩니다 (외국인 쿼터 미차지)":""}${gem&&yp.pot>=85?" — 코치진이 \"10년에 한 번 나올 재목\"이라 평가했습니다":""}`,
      gem&&yp.pot>=85?"good":undefined);
  }
  }
  /* 📈 결산 — 배당이 들어오고, 구단 성적이 모기업 주가로 돌아온다 */
  try{ stkSeasonEffect(); }catch(e){}
  try{ stkDividend(); }catch(e){}
  /* 🩺 오프시즌 두 달 — 감독의 몸도 그동안 낫는다.
     시즌 중에만 하루씩 깎으면, 시즌 막바지에 다친 감독이 새 시즌 개막일에도 그대로 병실에 있다. */
  try{ if(G.mgrInj) tickMgrInj(60); }catch(e){}
  for(const id in G.teams) assignAITactics(G.teams[id]); // AI 전술 리셋
  // FA 시장 정리: 노장 은퇴·무적 장기화
  /* ⚠ 재계약 판정이 깐깐해지면서 시장에 남는 인원이 크게 늘었다(실측 23명 → 163명).
     품질은 낮지만 목록이 지나치게 길어진다 — 능력이 낮고 나이가 많을수록 먼저 떠난다. */
  G.freeAgents=(G.freeAgents||[]).filter(p=>{
    const _a=G.season-(p.by||2000);
    if(_a>=36) return false;                                   // 은퇴
    const go = 0.25 + clamp((68-p.ovr)*0.035, 0, 0.35) + clamp((_a-30)*0.04, 0, 0.20);
    return Math.random() >= go;                                // 은퇴 / 해외 진출 / 하부 리그행
  });
  /* 🌏 ⚠ 제보 — 「해외 이적시장 선수들도 늙으면 은퇴하나?」 확인해 보니 <b>둘 다 아니었다.</b>
       ① 은퇴·정리 코드가 없다 — FA 시장(G.freeAgents)에는 36세 정리가 있는데 여기엔 없었다.
       ② 그런데 <b>애초에 늙으면 안 되는 목록이었다.</b> mkOverseas 를 보면 생년을 시즌만큼
          밀어서 「그 시즌의 그 나이」를 유지한다 — 이 시장은 실존 스타를 늘 같은 나이로
          보여 주는 진열대라는 뜻이다. 그런데 그 규칙이 <b>만들 때 한 번만</b> 적용돼서,
          이미 목록에 앉아 있는 선수는 해마다 그냥 늙었다(2026년 41세 → 2036년 51세).
     ─ 그래서 「은퇴」가 아니라 <b>나이 고정</b>이 맞는 수리다. 해마다 원본 정의 기준으로
       생년을 다시 맞춘다. 대신 원본이 없는 항목(에디터로 만든 선수 등)은 기준이 없으므로
       예전 FA 시장과 같은 잣대로 늙고 떠난다. */
  {
    const _osDef={}; try{ for(const d of OVERSEAS_DEF) _osDef[d.name]=d; }catch(e){}
    const _gone=[];
    G.overseas=(G.overseas||[]).filter(p=>{
      const _d=_osDef[p.osKey||p.name];
      if(_d && _d.bd){
        /* 진열대 선수 — 원본의 「기준 시즌 나이」로 되돌린다 (mkOverseas 와 같은 식) */
        try{ p.by=parseInt(_d.bd.slice(0,4),10)
                 + Math.max(0, (G.season||OS_BASE_SEASON)-OS_BASE_SEASON); }catch(e){}
        return true;
      }
      /* 원본이 없는 항목 — 여기는 진짜로 나이를 먹는다 */
      const _a=G.season-(p.by||2000);
      if(_a>=38){ _gone.push(p); return false; }
      if(_a<31) return true;
      const _go=(_a>=36?0.62:_a>=35?0.48:_a>=33?0.30:0.15)
              - clamp(((p.ovr||65)-70)*0.020, 0, 0.18);
      if(Math.random()<_go){ _gone.push(p); return false; }
      return true;
    });
    if(_gone.length){
      if(!Array.isArray(G.osGone)) G.osGone=[];
      for(const p of _gone) G.osGone.push(p.osKey||p.name);
    }
  }
  try{ poolTopUp(); }catch(e){}   // 🧮 리그 총원 평형 — 마지막에 모자란 만큼만 채운다
  buildSeason(true); setupACL();
  try{ cwcSetup(); }catch(e){ G.cwc=null; }   // 🌍 달력이 깔린 뒤에 편성한다 — 1월 날짜가 필요하다
  try{ carryUserTacticToNewSeason(); }catch(e){}   // 🧷 12월 31일의 선발·배치·역할·벤치를 그대로 이어받는다
  try{ sponSeason(); }catch(e){}   // 🤝 새 시즌 스폰서 정산 — 지난 시즌 성적이 여기서 값으로 돌아온다
  G.poFinal1=null; G.poFinal2=null;
  runSeasonTicketSale();   // 새 시즌 시즌권 판매 — 지난 시즌 흥행이 그대로 반영된다
  addNews(`📢 ${G.season} 시즌 개막! ${ut.div===1?"K리그1":"K리그2"}에서 새 시즌을 시작합니다.`);
}
