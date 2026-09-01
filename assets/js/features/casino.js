"use strict";
/* ═══════════════════════════════════════════════════════════════
   🎰 도박 — ⚠ 요청 원문 「자산 메뉴에서 [기부] 탭 오른쪽에 [도박] 탭을 만들자.
      거기서 보유현금을 걸고 도박게임을 하는거지」.
   ─ 설계 원칙 ─────────────────────────────────────────────────
     · 주식·부동산·사채와 같은 「감독 사생활」 계열이다. 공짜 돈이 아니라 위험이어야 한다.
       세 게임 모두 하우스 엣지를 넣어 기대값이 1 아래다(오래 하면 반드시 잃는다).
     · 진짜 위험은 돈이 아니라 <b>직업</b>이다. K리그 감독이 도박판에 앉아 있는 게 알려지면
       기사가 나고, 구단주 신뢰와 평판이 깎이고, 협회 조사까지 간다. 판이 클수록 위험도 크다.
     · 크게 잃고 있으면 화면이 그 사실을 정직하게 알려 준다.
   ═══════════════════════════════════════════════════════════════ */
/* ⚠ 설계 검산 — 처음에 슬롯을 3개 일치 ×24 · 2개 일치 ×1.6 으로 잡았더니 환수율이
   107.8% 로 <b>플레이어에게 유리</b>했다(기호 7종: 3개 일치 2.04% · 2개 일치 36.7%).
   그대로 뒀으면 돌리기만 해도 돈이 불어나는 「도박」이 될 뻔했다. 2개 일치를 1.15 로 낮춰
   환수율 91.2% 로 맞춘다 — 잭팟(×24)의 손맛은 그대로 두고 기대값만 1 아래로.
     환수율: 동전 97.5% · 주사위 홀짝 97.5% · 숫자 지목 90.0% · 슬롯 91.2% */
const GAM_EDGE={coin:1.95, dOdd:1.95, dNum:5.4, slot3:24, slot2:1.15};
const GAM_SYM=["🍒","🔔","🍋","⭐","💎","7️⃣","🍀"];
const GAM_BAN_D=28;            // 협회 징계 — 이 기간 동안 판에 못 앉는다
let GAM_AMT="", GAM_PICK={coin:"H", dice:"odd", num:1};
let GAM_BUSY=null;          // 🎬 지금 굴러가는 중 — 연출이 끝날 때까지 버튼을 잠근다
let GAM_WARN="";            // ⚠ 제보 — 판돈 경고는 상단 배너 대신 「입력칸 바로 아래」에 띄운다
function gamWarn(msg){
  GAM_WARN=msg||"";
  try{
    const el=document.getElementById("gmWarn");
    if(el){ el.innerHTML = msg?`⚠️ ${msg}`:""; el.style.display=msg?"":"none";
      if(msg){ el.classList.remove("gmWarn"); void el.offsetWidth; el.classList.add("gmWarn"); }
      return; }
  }catch(e){}
  if(msg) show("mylife");
}
/* 판돈이 올바른가 — 세 게임과 블랙잭이 같은 검사를 쓴다 */
function gamBetOk(){
  const M=me(), g=gamOf();
  if(gamBanned()){ gamWarn(`협회 징계 중입니다 — ${Math.ceil((g.banUntil-(G.day||0)))}일 남았습니다.`); return 0; }
  const bet=Math.round((parseFloat(GAM_AMT)||0)*100)/100;
  if(!(bet>0)){ gamWarn("걸 금액을 입력하세요."); return 0; }
  if(bet>M.cash){ gamWarn(`보유 현금이 모자랍니다 — 지금 ${moneyEok(M.cash)} 있습니다.`); return 0; }
  if(bet>gamMax()){ gamWarn(`한 판 상한은 ${gamMax().toFixed(2)}억입니다.`); return 0; }
  gamWarn("");
  return bet;
}
function gamOf(){
  const M=me();
  if(!M.gam) M.gam={bets:0, won:0, lost:0, heat:0, s:G.season, sAmt:0, big:0, banUntil:0, last:null, caught:0};
  const g=M.gam;
  if(g.s!==G.season){ g.s=G.season; g.sAmt=0; }     // 시즌이 바뀌면 그 해 판돈만 리셋(이력은 남는다)
  return g;
}
function gamBanned(){ const g=gamOf(); return (g.banUntil||0)>(G.day||0); }
/* 한 판 상한 — 순자산에 비례하되 절대 상한을 둔다. 무한 배팅으로 게임을 부수지 않게. */
/* 한 판 상한 — ⚠ 요청 「판돈 상한을 자산에 더 비례해서 높일 수 있게」.
   예전에는 순자산의 15% 로 일률이라, 자산이 불어도 상한이 답답하게 따라왔다.
   ─ 이제 자산 구간마다 비율이 커진다(누진). 판을 키울 수 있는 사람은 크게 걸 수 있다.
       순자산 10억 → 2.2억 · 50억 → 15억 · 100억 → 34억 · 200억 → 76억 · 1000억 → 420억
     한 판에 전부를 걸 수는 없게 최대 42% 로 묶었다 — 클릭 한 번에 파산하는 판은 게임이 아니다.
     「가진 현금」도 절대 넘지 못하고, 판이 클수록 발각 위험(gamHeat)이 그만큼 빨리 오른다. */
function gamMax(){
  const M=me();
  let nw=0; try{ nw=netWorth()/1e8; }catch(e){ nw=M.cash; }
  nw=Math.max(0, nw);
  const rate = nw>=500 ? 0.42 : nw>=200 ? 0.38 : nw>=100 ? 0.34 : nw>=50 ? 0.30 : nw>=20 ? 0.26 : 0.22;
  const cap = Math.max(2, nw*rate);
  return Math.max(0.1, Math.round(Math.min(cap, Math.max(0.1, M.cash))*100)/100);
}
function gamSetAmt(v){ GAM_AMT=String(v||"").replace(/[^0-9.]/g,""); }
function gamPickSet(k,v){ GAM_PICK[k]=(k==="num")?clamp(parseInt(v,10)||1,1,6):v; show("mylife"); }
function gamAmtQuick(f){ const M=me(); GAM_AMT=String(Math.round(Math.min(gamMax(), M.cash*f)*100)/100); show("mylife"); }
/* 판이 끝날 때마다 열기(heat)가 오른다 — 판돈이 클수록, 자주 할수록 */
function gamHeat(bet){
  const g=gamOf(), M=me();
  const rel=clamp(bet/Math.max(0.5, M.cash+bet), 0, 1);
  g.heat=clamp((g.heat||0) + 0.35 + rel*1.6 + (bet>=5?0.5:0), 0, 100);
}
function gamPlay(kind){
  const M=me(), g=gamOf();
  if(GAM_BUSY) return;                       // 🎬 굴러가는 중 — 연타 방지
  if(bjLive()){ flash("🃏 블랙잭 판이 진행 중입니다 — 먼저 끝내세요.","warn"); return; }
  if(G.phase==="sacked"){ flash("지금은 그럴 때가 아닙니다.","warn"); return; }
  const bet=gamBetOk(); if(!bet) return;
  mePay(-bet, null);
  g.bets++; g.lost=Math.round(((g.lost||0)+bet)*100)/100;
  g.sAmt=Math.round(((g.sAmt||0)+bet)*100)/100;
  if(bet>=(g.big||0)) g.big=bet;
  let pay=0, line="", detail="", res=null;
  if(kind==="coin"){
    const r=Math.random()<0.5?"H":"T";
    res=r;
    const hit=(r===GAM_PICK.coin);
    detail=`${r==="H"?"앞면":"뒷면"} — 내 선택 ${GAM_PICK.coin==="H"?"앞면":"뒷면"}`;
    if(hit) pay=bet*GAM_EDGE.coin;
    line=`🪙 동전이 ${r==="H"?"앞면":"뒷면"}으로 떨어졌습니다.`;
  } else if(kind==="dice"){
    const r=1+Math.floor(Math.random()*6);
    res=r;
    if(GAM_PICK.dice==="num"){
      detail=`주사위 ${r} — 내 지목 ${GAM_PICK.num}`;
      if(r===GAM_PICK.num) pay=bet*GAM_EDGE.dNum;
    } else {
      const odd=(r%2===1);
      detail=`주사위 ${r}(${odd?"홀":"짝"}) — 내 선택 ${GAM_PICK.dice==="odd"?"홀":"짝"}`;
      if((odd&&GAM_PICK.dice==="odd")||(!odd&&GAM_PICK.dice==="even")) pay=bet*GAM_EDGE.dOdd;
    }
    line=`🎲 주사위가 ${r} 을(를) 보였습니다.`;
  } else {
    const a=[0,0,0].map(()=>GAM_SYM[Math.floor(Math.random()*GAM_SYM.length)]);
    res=a;
    detail=a.join(" ");
    if(a[0]===a[1]&&a[1]===a[2]) pay=bet*GAM_EDGE.slot3;
    else if(a[0]===a[1]||a[1]===a[2]||a[0]===a[2]) pay=bet*GAM_EDGE.slot2;
    line=`🎰 ${a.join(" ")}`;
  }
  pay=Math.round(pay*100)/100;
  if(pay>0){ mePay(pay, null); g.won=Math.round(((g.won||0)+pay)*100)/100; }
  const net=Math.round((pay-bet)*100)/100;
  GAM_LAST={kind, bet, pay, net, line, detail, res, t:(G.day||0)};   /* 화면 상태 — 세이브에 남지 않는다 (제보) */
  gamHeat(bet);
  /* 📒 가계부에는 판마다 남긴다 — 나중에 「내가 얼마를 태웠나」를 볼 수 있게 */
  meLog(`${net>=0?"＋":"－"}${Math.abs(net).toFixed(2)}억 · 🎰 ${kind==="coin"?"동전":kind==="dice"?"주사위":"슬롯"} (판돈 ${bet.toFixed(2)}억)`);
  /* 대박은 소문이 난다 — 큰 배당은 그 자체로 발각 위험이다 */
  if(pay>=bet*8 && pay>=3){ g.heat=clamp((g.heat||0)+6, 0, 100);
    try{ pushSocial(pick([
      "감독님 어제 어디서 목격됐다는 소문 도는데 진짜냐",
      "우리 감독 요즘 씀씀이가 좀 이상하다는 얘기가 있던데"]), -1); }catch(e){} }
  /* 🎬 발각 판정과 화면 갱신은 연출이 끝난 뒤에 — 굴러가는 중에 화면이 갈아엎히면 안 된다 */
  saveGame();
  GAM_BUSY={kind};
  try{
    const box=document.getElementById("gmStage");
    if(box){
      const btns=document.querySelectorAll("#main .gmBtn");
      btns.forEach(b=>b.classList.add("gmRolling"));
      const rs=document.getElementById("gmRes");
      if(rs){ rs.className="gmRes"; rs.textContent="…"; }
      gamRoll(kind, res, ()=>{
        GAM_BUSY=null;
        try{ gamCatchRoll(); }catch(e){}
        saveGame(); show("mylife");
        try{ gamWinFx(net, bet); }catch(e){}
      });
      return;
    }
  }catch(e){}
  GAM_BUSY=null;
  try{ gamCatchRoll(); }catch(e){}
  show("mylife");
}
/* 🚨 발각 — 열기가 높을수록 기자·협회의 눈에 걸린다 */
function gamCatchRoll(force){
  const g=gamOf(), M=me(), t=userTeam();
  /* 🎰 무직이면 소문이 안 난다 (요청) — 소속 구단도, 협회에 걸 징계도, 실망할 팬도 없다.
     ⚠ 예전에는 `!force` 가 붙어 있어서 <b>하루 단위 강제 굴림(gamDayTick)이 이 가드를 그대로 통과</b>했다.
        열기가 18 이상이면 매일 4% 로 force=true 가 들어와, 무직인데도 「사생활 구설」 기사가 떴다.
        force 는 「지금 굴려라」는 뜻이지 「가드를 무시하라」는 뜻이 아니다. */
  if(G.jobless) { g.heat=clamp((g.heat||0)*0.9,0,100); return false; }
  const h=g.heat||0;
  const p=clamp((h-12)/260, 0, 0.16);
  if(!force && Math.random()>=p) return false;
  g.caught=(g.caught||0)+1;
  g.heat=clamp(h*0.35, 0, 100);
  const hard=(g.caught>=2 || (g.big||0)>=8);
  const nm=t?t.short:"구단";
  if(hard){
    /* 협회 조사 — 벌금 + 활동 정지(도박 금지). 승부조작 의혹까지 번진다. */
    const fine=Math.round(Math.min(Math.max(1, (g.big||1)*0.8), 12)*100)/100;
    try{ mgrFine(fine, "도박 물의"); }catch(e){}
    g.banUntil=(G.day||0)+GAM_BAN_D;
    try{ adjustTrust("owner", -12, "감독 도박 물의"); adjustTrust("fans", -8, "감독 도박 물의"); }catch(e){}
    try{ if(G.press) G.press.rel=clamp((G.press.rel||50)-14, 0, 100); }catch(e){}
    try{ G.mgrRepMod=(G.mgrRepMod||0)-4; }catch(e){}
    try{ sponScandal("감독 도박 물의", 2); }catch(e){}
    addNews(`🚨 <b>${nm} 감독, 도박 물의로 협회 조사</b> — 제재금 ${fine}억`, "warn", "club",
      {cat:"club", ic:"🚨", tone:-1, tid:(t?t.id:null),
       head:`${nm} 감독 도박 물의 — 협회 조사 착수`,
       sub:`복수의 목격담이 이어졌다. 협회는 제재금과 함께 재발 방지를 요구했다. 승부조작과의 연관성은 확인되지 않았다.`,
       src:"K리그 공식"});
    notify(`🚨 <b>도박이 발각됐습니다.</b> 제재금 <b>${fine}억</b> · 구단주 신뢰 −12 · 팬 신뢰 −8<br><span class="small">${GAM_BAN_D}일간 판에 앉을 수 없습니다.</span>`,"warn");
    try{
      socialFill(["감독이 도박이라니... 진짜 실망이다","성적도 성적인데 이건 좀 아니지","구단은 뭐하고 있었냐",
        "이런 사람한테 우리 팀을 맡긴 거였나"], 3+R(2), -1, {t:nm});
      fmkFill([["{t} 감독 도박 물의 ㄷㄷ 이거 커지겠는데",-1],
        ["감독 도박 = 승부조작 의심부터 받는다 그게 이 바닥",-1],
        ["{t} 프런트 지금 머리 아프겠다",-1]], 2+R(2), {t:nm});
    }catch(e){}
  } else {
    /* 첫 발각 — 기사 한 줄과 경고 */
    try{ adjustTrust("owner", -5, "감독 사생활 구설"); }catch(e){}
    try{ if(G.press) G.press.rel=clamp((G.press.rel||50)-5, 0, 100); }catch(e){}
    addNews(`📰 <b>${nm} 감독, 사생활 구설</b> — "판돈이 오가는 자리에 있었다"는 목격담`, "warn", "club");
    notify(`📰 <b>기자에게 포착됐습니다.</b> 구단주 신뢰 −5 · 언론 관계 −5<br><span class="small">한 번 더 걸리면 협회가 움직입니다.</span>`,"warn");
    try{ socialFill(["감독님 그 소문 사실 아니죠?","기사 봤는데 좀 그렇더라","실력으로만 말해주셨으면 좋겠다"], 2+R(2), -1, {t:nm}); }catch(e){}
  }
  return true;
}
/* 하루가 지나면 열기는 식는다 — 다만 완전히 사라지지는 않는다 */
function gamDayTick(){
  try{
    const M=me(); if(!M || !M.gam) return;
    const g=M.gam;
    g.heat=clamp((g.heat||0)*0.86, 0, 100);
    if(g.heat>=18 && Math.random()<0.04) gamCatchRoll(true);
  }catch(e){}
}


/* ═══ 🎬 카지노 연출 엔진 (요청) ═══════════════════════════════════════════
   ⚠ 제보 — 「결과가 나온 상태에서 다른 메뉴 갔다 들어와도 결과 화면이 계속 유지된다」.
      원인: 마지막 판 결과를 세이브에 남는 g.last 에 담아 뒀다. 결과는 「지금 이 화면에서
      방금 일어난 일」이므로 세이브가 아니라 화면 상태다 — 전역으로 옮기고, 탭을 떠나면 지운다. */
let GAM_LAST=null;                 // 방금 판의 결과 (세이브에 남지 않는다)
let GAM_AC=null;
function gamSfxOn(){ return !(G.opt && G.opt.gamSfx===0); }
function gamSfxToggle(){ G.opt=G.opt||{}; G.opt.gamSfx = gamSfxOn()?0:1; saveGame(); show("mylife"); }
/* 🔔 소리 — 파일 없이 합성한다. 짧고 작게. */
function gamSfx(kind){
  if(!gamSfxOn()) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    if(!GAM_AC) GAM_AC=new AC();
    const ac=GAM_AC; if(ac.state==="suspended") ac.resume();
    const t0=ac.currentTime;
    const play=(f,at,dur,vol,type)=>{
      const o=ac.createOscillator(), g2=ac.createGain();
      o.type=type||"triangle"; o.frequency.value=f;
      g2.gain.setValueAtTime(0.0001, t0+at);
      g2.gain.exponentialRampToValueAtTime(vol, t0+at+0.012);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0+at+dur);
      o.connect(g2); g2.connect(ac.destination); o.start(t0+at); o.stop(t0+at+dur+0.05);
    };
    if(kind==="jack"){ [1046.5,1318.5,1568,2093,2637].forEach((f,i)=>play(f,i*0.085,0.6,0.13)); }
    else if(kind==="win"){ [880,1108.7,1318.5].forEach((f,i)=>play(f,i*0.075,0.5,0.11)); }
    else if(kind==="lose"){ play(233,0,0.30,0.05,"sawtooth"); play(175,0.10,0.34,0.045,"sawtooth"); }
    else if(kind==="card") play(1400,0,0.06,0.035,"square");
    else if(kind==="tick") play(760,0,0.05,0.05,"square");
    else if(kind==="tense") play(320,0,0.10,0.035,"square");
    else play(660,0,0.12,0.06);
  }catch(e){}
}
/* 🪙 코인 비 — 이겼을 때 화면 전체에 쏟아진다 */
function gamRain(big){
  try{
    const old=document.getElementById("gmRain"); if(old) old.remove();
    const w=document.createElement("div"); w.className="gmRain"; w.id="gmRain";
    const n=big?46:24;
    const S=big?["🪙","💰","💎","🪙","⭐"]:["🪙","🪙","💰"];
    let h="";
    for(let i=0;i<n;i++){
      const x=Math.random()*100, d=(big?1.5:1.3)+Math.random()*1.1, dl=Math.random()*(big?0.7:0.45);
      const sz=(big?20:18)+Math.random()*(big?20:14);
      h+=`<i style="left:${x}%;font-size:${sz}px;animation-duration:${d}s;animation-delay:${dl}s">${S[Math.floor(Math.random()*S.length)]}</i>`;
    }
    w.innerHTML=h; document.body.appendChild(w);
    setTimeout(()=>{ try{ w.remove(); }catch(e){} }, (big?2900:2300));
  }catch(e){}
}
/* 이긴 판의 마무리 — 소리 + 코인 + 무대 발광 */
function gamWinFx(net, bet){
  if(!(net>0)) { gamSfx("lose"); return; }
  const big = net >= (bet||1)*4;
  gamSfx(big?"jack":"win");
  gamRain(big);
}
/* 😬 긴장 — 멈추기 직전 줌인 + 미세한 떨림 */
function gamTense(on){
  try{ const st=document.getElementById("gmStage"); if(!st) return;
    if(on){ st.classList.add("tense"); gamSfx("tense"); } else st.classList.remove("tense"); }catch(e){}
}
/* ── 🎨 판을 그린다 (요청 — 「CSS로 이미지화, 진짜 게임하는 것처럼」) ─────────────
   결과는 gamPlay 가 이미 정했다. 여기서는 그 결과로 <b>끝나도록</b> 굴려 보여 줄 뿐이다.
   (연출이 결과를 바꾸지 않는다 — 애니메이션 중 새로고침해도 값은 그대로다) */
const GM_PIP={1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8]};
function gmDiceFace(n){
  const on=GM_PIP[n]||[];
  let h="";
  for(let i=0;i<9;i++) h += on.indexOf(i)>=0 ? "<b></b>" : "<span></span>";
  return h;
}
/* 주사위 큐브를 그 숫자가 정면에 오도록 돌리는 각 */
const GM_DROT={1:[0,0], 2:[0,-90], 3:[0,180], 4:[0,90], 5:[-90,0], 6:[90,0]};
function gmCoinHtml(face){
  const deg = face==="T" ? 180 : 0;
  return `<div class="gmCoinBox"><div class="gmCoin" id="gmCoin" style="transform:rotateY(${deg}deg)">
    <i class="gcF">앞</i><i class="gcB">뒤</i></div></div>`;
}
function gmDiceHtml(n){
  const R=GM_DROT[n]||[0,0];
  return `<div class="gmDiceBox"><div class="gmDice" id="gmDice" style="transform:rotateX(${R[0]}deg) rotateY(${R[1]}deg)">
    ${[1,2,3,4,5,6].map(k=>`<i class="d${k}">${gmDiceFace(k)}</i>`).join("")}</div></div>`;
}
function gmSlotHtml(syms, hit){
  return `<div class="gmSlot ${hit?"hit":""}" id="gmSlot">${syms.map((sy,i)=>
    `<div class="gmReel"><div class="gmStrip" id="gmStrip${i}"><span>${sy}</span></div></div>`).join("")}</div>`;
}
/* 지금 무대에 무엇을 세워 둘 것인가 — 판을 돌리기 전(대기)과 돌린 뒤(결과) */
function gamStage(){
  const g=gamOf(), L=GAM_LAST;
  /* 🃏 블랙잭 판이 걸려 있으면 무대는 카드 테이블이다 */
  if(g.bj){
    const B=g.bj, w=(B.res&&B.res.net>0);
    return `<div class="gmStage${w?" win":""}" id="gmStage" style="min-height:190px">${bjTable()}</div>
      <div class="gmRes ${B.stage==="done"?(B.res.net>0?"win":(B.res.net===0?"":"lose")):""}" id="gmRes">${
        B.stage==="done" ? (B.res.net>0?`+${B.res.net.toFixed(2)}억`:(B.res.net===0?"±0":`−${Math.abs(B.res.net).toFixed(2)}억`)) : "히트 또는 스탠드"
      }</div>
      ${B.stage==="done"?`<div class="small" style="text-align:center;color:var(--sub);margin-top:-4px">${B.msg}</div>`:""}`;
  }
  const kind=(GAM_BUSY&&GAM_BUSY.kind) || (L&&L.kind) || "coin";
  let inner="", cls="";
  if(kind==="coin"){
    inner=gmCoinHtml((L&&L.kind==="coin")?L.res:GAM_PICK.coin);
  } else if(kind==="dice"){
    inner=gmDiceHtml((L&&L.kind==="dice")?L.res:1);
  } else {
    const sy=(L&&L.kind==="slot"&&L.res)?L.res:[GAM_SYM[0],GAM_SYM[3],GAM_SYM[5]];
    inner=gmSlotHtml(sy, !!(L&&L.kind==="slot"&&L.net>0));
  }
  if(L && L.net>0 && !GAM_BUSY) cls=" win";
  return `<div class="gmStage${cls}" id="gmStage">${inner}</div>
    <div class="gmRes ${L?(L.net>0?"win":"lose"):""}" id="gmRes">${
      GAM_BUSY ? "…" : (L ? (L.net>0?`+${L.net.toFixed(2)}억`:`−${Math.abs(L.net).toFixed(2)}억`) : "&nbsp;")
    }</div>`;
}
/* 실제로 굴린다 — DOM 을 직접 만져서 화면 전체를 다시 그리지 않는다 */
function gamRoll(kind, res, cb){
  try{
    const st=document.getElementById("gmStage");
    if(!st){ cb&&cb(); return; }
    if(kind==="coin"){
      st.innerHTML=gmCoinHtml("H");
      const el=document.getElementById("gmCoin");
      const end=(res==="T"?180:0)+1800;                 // 다섯 바퀴 돌고 결과 면으로
      requestAnimationFrame(()=>{ el.style.transform=`rotateY(${end}deg)`; });
      setTimeout(()=>{ gamTense(true); }, 780);
      setTimeout(()=>{ gamTense(false); cb&&cb(); }, 1180);
    } else if(kind==="dice"){
      st.innerHTML=gmDiceHtml(1);
      const el=document.getElementById("gmDice");
      const R=GM_DROT[res]||[0,0];
      requestAnimationFrame(()=>{ el.style.transform=`rotateX(${R[0]+720}deg) rotateY(${R[1]+1080}deg)`; });
      setTimeout(()=>{ gamTense(true); }, 780);
      setTimeout(()=>{ gamTense(false); cb&&cb(); }, 1180);
    } else {
      /* 릴 세 개 — 긴 띠를 위로 굴려 마지막 칸이 결과가 되게 하고, 하나씩 순서대로 멈춘다 */
      st.innerHTML=gmSlotHtml(res, false);
      const H=(window.innerWidth<=560)?62:74;
      for(let i=0;i<3;i++){
        const strip=document.getElementById("gmStrip"+i); if(!strip) continue;
        const spin=14+i*4;                                // 릴마다 도는 양이 다르다
        let h="";
        for(let k=0;k<spin;k++) h+=`<span>${GAM_SYM[Math.floor(Math.random()*GAM_SYM.length)]}</span>`;
        h+=`<span>${res[i]}</span>`;
        strip.innerHTML=h;
        strip.style.transition="none";
        strip.style.transform="translateY(0)";
        const dist=spin*H;
        const dur=0.85+i*0.28;
        requestAnimationFrame(()=>{
          strip.style.transition=`transform ${dur}s cubic-bezier(.16,.62,.2,1)`;
          strip.style.transform=`translateY(-${dist}px)`;
        });
        setTimeout(()=>{ gamSfx("tick"); }, dur*1000);      // 릴이 하나씩 딸깍 멈춘다
      }
      /* 😬 마지막 릴이 멈추기 직전 — 줌인 + 미세한 떨림 (요청) */
      setTimeout(()=>{ gamTense(true); }, 1080);
      setTimeout(()=>{ gamTense(false); cb&&cb(); }, 1560);
    }
  }catch(e){ cb&&cb(); }
}

/* ═══ 🃏 블랙잭 (요청) ═══════════════════════════════════════════
   지하 카지노 규칙 — 딜러는 소프트 17 에서도 한 장 더 받고, 블랙잭 배당은 ×2.2(6:5)다.
   더블·스플릿은 없다. 싸구려 판일수록 규칙이 손님에게 박하다 — 그래서 환수율이 약 97% 다
   (동전 97.5% · 슬롯 91% 사이). 한 판마다 새 덱을 쓰므로 카운팅은 통하지 않는다. */
const BJ_PAY_WIN=2.0, BJ_PAY_BJ=2.2;      // 판돈 포함 반환액 (푸시는 ×1)
const BJ_SUIT=[["♠",0],["♥",1],["♦",1],["♣",0]];
const BJ_RANK=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function bjDeck(){
  const d=[];
  for(const [sy,red] of BJ_SUIT) for(const r of BJ_RANK) d.push({r, s:sy, red});
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=d[i]; d[i]=d[j]; d[j]=t; }
  return d;
}
function bjVal(hand){
  let t=0, a=0;
  for(const c of hand){
    if(c.r==="A"){ a++; t+=11; }
    else if(c.r==="J"||c.r==="Q"||c.r==="K"||c.r==="10") t+=10;
    else t+=(+c.r);
  }
  while(t>21 && a>0){ t-=10; a--; }
  return t;
}
function bjSoft(hand){                       // 에이스를 11 로 쓰고 있는가 (소프트 핸드)
  let t=0, a=0;
  for(const c of hand){ if(c.r==="A"){a++;t+=11;} else if("JQK".indexOf(c.r)>=0||c.r==="10") t+=10; else t+=(+c.r); }
  let soft=false;
  while(t>21 && a>0){ t-=10; a--; }
  return a>0;
}
function bjNat(hand){ return hand.length===2 && bjVal(hand)===21; }
function bjLive(){ const g=gamOf(); return !!(g.bj && g.bj.stage==="play"); }
function bjStart(){
  const M=me(), g=gamOf();
  if(GAM_BUSY || bjLive()) return;
  if(G.phase==="sacked"){ flash("지금은 그럴 때가 아닙니다.","warn"); return; }
  const bet=gamBetOk(); if(!bet) return;
  mePay(-bet, null);
  g.bets++; g.lost=Math.round(((g.lost||0)+bet)*100)/100;
  g.sAmt=Math.round(((g.sAmt||0)+bet)*100)/100;
  if(bet>=(g.big||0)) g.big=bet;
  const d=bjDeck();
  const you=[d.pop(), d.pop()], dl=[d.pop(), d.pop()];
  g.bj={deck:d, you, dl, bet, stage:"play", res:null, msg:"", seenY:0, seenD:0};
  GAM_LAST=null;
  /* 자연 블랙잭 — 그 자리에서 끝난다 */
  if(bjNat(you) || bjNat(dl)){ bjFinish(); return; }
  saveGame(); show("mylife");
}
function bjHit(){
  const g=gamOf(); if(!bjLive() || GAM_BUSY) return;
  const B=g.bj;
  B.you.push(B.deck.pop());
  gamSfx("card");
  if(bjVal(B.you)>=21){
    /* 버스트·21 — 잠깐 보여 주고 정산한다 (숫자가 바뀌는 걸 볼 시간) */
    saveGame(); show("mylife");
    GAM_BUSY={kind:"bj"};
    setTimeout(()=>{ GAM_BUSY=null; bjFinish(); }, 620);
    return;
  }
  saveGame(); show("mylife");
}
function bjStand(){
  const g=gamOf(); if(!bjLive() || GAM_BUSY) return;
  /* 🎬 요청 — 「스탠드를 누르면 딜러 카드가 뒤집히기 직전 0.5초간 미세하게 떨리며 천천히 열린다」 */
  const card=document.getElementById("pc_d1");
  if(!card){ bjFinish(); return; }
  GAM_BUSY={kind:"bj"};
  gamTense(true); gamSfx("tense");
  card.classList.add("tremble");
  setTimeout(()=>{
    try{ card.classList.remove("tremble"); card.classList.remove("hid"); gamSfx("card"); }catch(e){}
    setTimeout(()=>{
      gamTense(false);
      GAM_BUSY=null;
      const B=gamOf().bj; if(B){ B.seenD=B.dl.length; }   // 이미 보인 카드는 다시 날아오지 않는다
      bjFinish();
    }, 760);                                              // 천천히 열리는 시간
  }, 540);                                                // 떨림 0.5초
}
/* 딜러가 규칙대로 받고, 승부를 가른다 */
function bjFinish(){
  const M=me(), g=gamOf(), B=g.bj; if(!B) return;
  const you=bjVal(B.you);
  const natY=bjNat(B.you), natD=bjNat(B.dl);
  if(!natY && !natD && you<=21){
    /* 딜러 — 17 미만이면 무조건, 소프트 17 이면 한 장 더 (지하 카지노 규칙) */
    let guard=0;
    while(guard++<12){
      const v=bjVal(B.dl);
      if(v<17 || (v===17 && bjSoft(B.dl))) B.dl.push(B.deck.pop());
      else break;
    }
  }
  const dl=bjVal(B.dl);
  let pay=0, msg="";
  if(natY && natD){ pay=B.bet; msg="양쪽 다 블랙잭 — 무승부입니다."; }
  else if(natY){ pay=B.bet*BJ_PAY_BJ; msg="🃏 블랙잭! 배당 ×2.2"; }
  else if(natD){ pay=0; msg="딜러가 블랙잭입니다."; }
  else if(you>21){ pay=0; msg=`버스트 (${you}) — 딜러가 가져갑니다.`; }
  else if(dl>21){ pay=B.bet*BJ_PAY_WIN; msg=`딜러 버스트 (${dl}) — 이겼습니다!`; }
  else if(you>dl){ pay=B.bet*BJ_PAY_WIN; msg=`${you} 대 ${dl} — 이겼습니다!`; }
  else if(you<dl){ pay=0; msg=`${you} 대 ${dl} — 졌습니다.`; }
  else { pay=B.bet; msg=`${you} 대 ${dl} — 무승부(푸시), 판돈을 돌려받습니다.`; }
  pay=Math.round(pay*100)/100;
  if(pay>0){ mePay(pay, null); g.won=Math.round(((g.won||0)+pay)*100)/100; }
  const net=Math.round((pay-B.bet)*100)/100;
  B.stage="done"; B.res={pay, net}; B.msg=msg;
  GAM_LAST={kind:"bj", bet:B.bet, pay, net, line:`🃏 ${msg}`,
          detail:`나 ${you} · 딜러 ${dl}`, res:null, t:(G.day||0)};
  gamHeat(B.bet);
  meLog(`${net>=0?"＋":"－"}${Math.abs(net).toFixed(2)}억 · 🃏 블랙잭 (판돈 ${B.bet.toFixed(2)}억)`);
  if(pay>=B.bet*2 && pay>=3){ g.heat=clamp((g.heat||0)+4, 0, 100); }
  try{ gamCatchRoll(); }catch(e){}
  saveGame(); show("mylife");
  try{ gamWinFx(net, B.bet); }catch(e){}
}
/* 판을 치운다 — 다음 판으로 */
function bjClear(){ const g=gamOf(); g.bj=null; show("mylife"); }
/* 🎨 카드 한 장 */
function bjCardHtml(c, hide, i, fresh, side){
  /* 🃏 앞뒤 두 면을 가진 3D 카드 — 뒤집기(flip)와 「덱에서 날아오기」를 함께 쓴다 (요청) */
  const cls=`pcard${c.red?" red":""}${hide?" hid":""}${fresh?" deal":""}`;
  return `<div class="${cls}" id="pc_${side}${i}" style="animation-delay:${(i||0)*0.09}s">
    <div class="pcIn">
      <div class="pcF fr"><b>${c.r}<br><span style="font-size:12px">${c.s}</span></b><u>${c.s}</u><i>${c.r}</i></div>
      <div class="pcF bk"></div>
    </div></div>`;
}
/* 합계 배지 색 — 21 이 가까워질수록 붉어진다 (요청: 16 노랑 → 17 주황 → 18 빨강) */
function bjTotCls(v, hand, done){
  if(v>21) return " bust";
  if(hand && bjNat(hand)) return " bj";
  if(v>=18) return " w18";
  if(v===17) return " w17";
  if(v===16) return " w16";
  return "";
}
function bjTable(){
  const g=gamOf(), B=g.bj; if(!B) return "";
  const live=(B.stage==="play");
  const you=bjVal(B.you);
  const dl= live ? bjVal([B.dl[0]]) : bjVal(B.dl);
  const bust=(you>21);
  /* 이미 화면에 있던 카드는 다시 날아오지 않는다 — 새로 받은 장만 딜 연출 */
  const sY=B.seenY||0, sD=B.seenD||0;
  const html=`<div class="gmBJ${bust?" bust":""}" id="gmBJ">
    <div class="gmRow"><span class="gmWho">딜러</span>
      ${B.dl.map((c,i)=>bjCardHtml(c, live && i>0, i, i>=sD, "d")).join("")}
      <span class="gmTot${live?"":bjTotCls(dl, B.dl, true)}">${live?`${dl} + ?`:dl}</span></div>
    <div class="gmRow"><span class="gmWho">나</span>
      ${B.you.map((c,i)=>bjCardHtml(c,false,i,i>=sY,"y")).join("")}
      <span class="gmTot${bjTotCls(you, B.you)}">${you}${bjSoft(B.you)&&you<21?" (소프트)":""}${bust?" 버스트":""}</span></div>
  </div>`;
  B.seenY=B.you.length; B.seenD=B.dl.length;
  return html;
}
function gamCard(){
  const M=me(), g=gamOf();
  const net=Math.round(((g.won||0)-(g.lost||0))*100)/100;
  const mx=gamMax();
  const a=Math.round((parseFloat(GAM_AMT)||0)*100)/100;
  const heat=Math.round(g.heat||0);
  const hCol = heat>=45?"#f85149" : heat>=22?"#ff9d5c" : heat>=8?"#d29922" : "#3fb950";
  const hTxt = heat>=45?"매우 위험" : heat>=22?"주목받는 중" : heat>=8?"소문이 돈다" : "조용함";
  const L=GAM_LAST;
  const banned=gamBanned();
  const bjOn=bjLive();                       // 🃏 판이 걸려 있으면 다른 게임은 잠근다
  const lock=banned||bjOn;
  const btn=(k,l,tip)=>`<button class="gmGo gmBtn" ${lock?"disabled":`onclick="gamPlay('${k}')"`} title="${tip}">${l}</button>`;
  const pk=(k,v,l)=>`<button class="mini ${GAM_PICK[k]===v?"sel":""}" style="padding:5px 12px" onclick="gamPickSet('${k}','${v}')">${l}</button>`;
  return `<div class="card">
    <div class="gmNeon"><s></s>🎰 지하 카지노<s></s>
      <button class="gmSfxBtn" title="효과음 켜기/끄기" onclick="gamSfxToggle()">${gamSfxOn()?"🔊":"🔇"}</button></div>
    <p class="small" style="text-align:center;color:var(--sub);margin:-4px 0 8px">감독 사비를 겁니다 — 구단 돈은 걸 수 없습니다</p>
    <div class="stkSum">
      <div><span>보유 현금</span><b class="money">${moneyEok(M.cash)}</b></div>
      <div><span>누적 손익</span><b style="color:${net>=0?"var(--green)":"#f85149"}">${net>=0?"+":""}${net.toFixed(2)}억</b></div>
      <div><span>지금까지</span><b>${g.bets||0}판</b></div>
      <div><span>발각 위험</span><b style="color:${hCol}">${hTxt}</b></div>
    </div>
    ${banned?`<div class="msg warn" style="margin-top:9px">⛔ <b>협회 징계 중</b> — ${Math.ceil(g.banUntil-(G.day||0))}일간 판에 앉을 수 없습니다.</div>`:""}
    ${heat>=22&&!banned?`<div class="msg warn" style="margin-top:9px">👀 <b>주변의 눈이 늘었습니다.</b> 판을 쉬면 소문은 가라앉습니다 — 계속하면 기사가 납니다.</div>`:""}
    ${(net<=-3)?`<div class="msg warn" style="margin-top:9px">🧾 지금까지 <b>${Math.abs(net).toFixed(2)}억</b>을 잃었습니다.
      <span class="small">세 게임 모두 오래 할수록 잃도록 설계돼 있습니다 — 본전을 노리는 판이 제일 위험합니다.</span></div>`:""}
    ${gamStage()}
    ${L&&!GAM_BUSY&&!g.bj?`<div class="small" style="text-align:center;color:var(--sub);margin-top:-4px">
      ${L.detail} · 판돈 ${L.bet.toFixed(2)}억${L.net>0?` → 배당 <b style="color:var(--green)">${L.pay.toFixed(2)}억</b>`:" → 꽝"}</div>`:""}
    <div style="margin-top:11px">
      <div class="small" style="color:var(--sub);margin-bottom:5px">판돈
        <span style="opacity:.8">— 한 판 상한 <b style="color:var(--gold)">${mx.toFixed(2)}억</b>
        <span style="opacity:.7">(순자산이 커질수록 상한도 함께 올라갑니다)</span></span></div>
      <div class="gmChips">
        <input type="text" inputmode="decimal" class="gmBet" placeholder="금액(억)" value="${GAM_AMT}"
               oninput="gamSetAmt(this.value)">
        <button class="gmChip" onclick="gamAmtQuick(0.1)">10%</button>
        <button class="gmChip" onclick="gamAmtQuick(0.25)">25%</button>
        <button class="gmChip" onclick="gamAmtQuick(0.5)">50%</button>
        <button class="gmChip alt" onclick="gamAmtQuick(1)">올인</button>
      </div>
      <div id="gmWarn" class="${GAM_WARN?"gmWarn":""}" style="${GAM_WARN?"":"display:none"}">${GAM_WARN?"⚠️ "+GAM_WARN:""}</div>
    </div>
    <div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--line)">
      <div style="margin-bottom:5px"><b>🪙 동전 던지기</b> <span class="small" style="color:var(--sub)">— 적중 ×${GAM_EDGE.coin}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${pk("coin","H","앞면")} ${pk("coin","T","뒷면")}
        ${btn("coin","🪙 던진다", "50% · 배당 1.95배")}
      </div>
    </div>
    <div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--line)">
      <div style="margin-bottom:5px"><b>🎲 주사위</b> <span class="small" style="color:var(--sub)">— 홀짝 ×${GAM_EDGE.dOdd} · 숫자 지목 ×${GAM_EDGE.dNum}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${pk("dice","odd","홀")} ${pk("dice","even","짝")} ${pk("dice","num","숫자 지목")}
        ${GAM_PICK.dice==="num"?`<select onchange="gamPickSet('num',this.value)" style="padding:5px">
          ${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${GAM_PICK.num===n?"selected":""}>${n}</option>`).join("")}</select>`:""}
        ${btn("dice","🎲 굴린다", "홀짝 50% · 숫자 지목 16.7%")}
      </div>
    </div>
    <div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--line)">
      <div style="margin-bottom:5px"><b>🎰 슬롯머신</b> <span class="small" style="color:var(--sub)">— 3개 일치 ×${GAM_EDGE.slot3} · 2개 일치 ×${GAM_EDGE.slot2}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span class="small" style="opacity:.7">${GAM_SYM.join(" ")}</span>
        ${btn("slot","🎰 돌린다", "3개 일치 2% · 2개 일치 37%")}
      </div>
    </div>
    <div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--line)">
      <div style="margin-bottom:5px"><b>🃏 블랙잭</b> <span class="small" style="color:var(--sub)">— 승리 ×${BJ_PAY_WIN} · 블랙잭 ×${BJ_PAY_BJ} · 무승부 판돈 반환</span></div>
      ${bjOn?`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="gmGo" ${GAM_BUSY?"disabled":`onclick="bjHit()"`}>🃏 히트</button>
        <button class="gmGo gray" ${GAM_BUSY?"disabled":`onclick="bjStand()"`}>✋ 스탠드</button>
        <span class="small" style="color:var(--sub)">판돈 ${(g.bj.bet||0).toFixed(2)}억 · 21 을 넘기면 그 자리에서 집니다</span>
      </div>`
      : (g.bj?`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="gmGo" onclick="bjClear()">🔄 판을 치운다</button>
        <span class="small" style="color:var(--sub)">다음 판을 시작하려면 먼저 판을 치우세요</span>
      </div>`
      :`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="gmGo gmBtn" ${banned?"disabled":`onclick="bjStart()"`}>🃏 딜</button>
        <span class="small" style="color:var(--sub)">딜러는 소프트 17 에서도 한 장 더 받습니다 · 더블·스플릿 없음</span>
      </div>`)}
    </div>
    <p class="small" style="margin-top:12px;color:var(--sub)">
      네 게임 모두 <b>기대값이 판돈보다 낮습니다</b> — 오래 할수록 잃습니다. 그게 도박입니다.<br>
      진짜 위험은 돈이 아닙니다. K리그 감독이 판돈 오가는 자리에 앉아 있는 게 알려지면
      <b>기사가 나고, 구단주 신뢰가 깎이고, 협회가 움직입니다.</b> 판이 클수록 눈에 띕니다.</p>
  </div>`;
}
/* 💝 기부 화면 — 무직이면 잠긴다 */
function donCard(){
  const why=donBlockWhy();
  if(why) return `<div class="card"><h3>💝 구단 기부</h3>
    <div class="msg warn" style="margin-top:6px">🕊️ ${why}</div>
    <p class="small" style="margin-top:9px;color:var(--sub)">구단을 맡으면 사비를 넣어 <b>관중석을 늘리거나</b> 진행 중인 <b>구장 사업의 공사비</b>를 댈 수 있습니다.
      돈을 낸 감독은 구단주도, 팬도 다르게 봅니다.</p></div>`;
  const t=userTeam(), M=me(), d=donOf(t), sd=stadOf(t);
  const S=stadProj(), building = S && S.phase!=="done";
  const cost=donSeatCost(t), need=Math.max(0, Math.round((cost-d.fund)*10)/10);
  const prog=clamp(d.fund/Math.max(0.1,cost),0,1);
  const a=Math.round((parseFloat(DON_AMT)||0)*100)/100;
  const g=a>0?donGain(a, d.sAmt||0, d):null;
  const maxSeat=stadRoom(t)<DON_STEP;   // 🏟️ 구장이 100,000석에 닿았을 때만 (제보 — 한도 해제)
  return `<div class="card">
    <h3>💝 구단 기부 <span class="small">— 감독 사비를 ${t.short} 시설에 넣습니다</span></h3>
    <div class="stkSum">
      <div><span>보유 현금</span><b class="money">${moneyEok(M.cash)}</b></div>
      <div><span>누적 기부</span><b>${(d.total||0).toFixed(2)}억</b></div>
      <div><span>올 시즌</span><b>${(d.sAmt||0).toFixed(2)}억</b></div>
      <div><span>늘린 좌석</span><b>${(d.seats||0).toLocaleString()}석</b></div>
    </div>
    ${(d.sOwn||0)>=DON_CAP_OWN&&(d.sFans||0)>=DON_CAP_FANS?`<div class="msg warn" style="margin-top:9px">
      🧾 올 시즌 기부로 얻을 수 있는 신뢰를 모두 채웠습니다 — 더 내도 <b>돈은 기금에 쌓이지만 신뢰는 오르지 않습니다</b>.
      <span class="small">기부로 성적을 대신할 수는 없습니다.</span></div>`:""}
    ${building?`<div class="msg" style="margin-top:9px;background:#1f6feb22;border-color:#1f6feb66">
      🏗️ <b>${stadPlan(S.k).n}</b> 사업이 진행 중입니다 — 기부금은 <b>공사비</b>로 먼저 들어갑니다.
      <span class="small">(${S.paid}/${S.cost}억)</span></div>`
    :maxSeat?`<div class="msg warn" style="margin-top:9px">🏟️ 구장이 최대 규모(${STAD_CAP_MAX.toLocaleString()}석)에 도달했습니다 — 세계 최대급 축구 전용 구장입니다.</div>`
    :`<div style="margin-top:10px">
      <div class="small" style="display:flex;justify-content:space-between;color:var(--sub)">
        <span>🪑 구장 개선 기금 <span style="color:var(--sub)">— 좌석 ${DON_STEP.toLocaleString()}석 · 시야 · 편의시설 · 원정석</span></span>
        <span><b style="color:var(--gold)">${d.fund.toFixed(1)}억</b> / ${cost}억</span></div>
      <div style="height:9px;background:var(--bg3);border-radius:5px;overflow:hidden;margin-top:5px">
        <div style="height:100%;width:${(prog*100).toFixed(1)}%;background:linear-gradient(90deg,#e3b341,#f0c674)"></div></div>
      <p class="small" style="margin-top:6px;color:var(--sub)">${need>0?`<b>${need}억</b>이 더 모이면 그 겨울에 공사에 들어갑니다.`:`다음 기부에 곧바로 착공합니다.`}
        수용 인원 <b>${(sd.cap||0).toLocaleString()}명</b> · 기준 관중 <b>${(sd.avg||0).toLocaleString()}명</b>
        · 관중 상한 <b>${attCeilOf(t).toLocaleString()}명</b> → <b style="color:var(--gold)">${Math.min(Math.round((sd.cap+DON_STEP)*0.92), Math.round((( sd._base0||sd.avg)+DON_STEP*0.40)*1.6)).toLocaleString()}명</b></p>
    </div>`}
    ${d.pend>0?`<div class="msg" style="margin-top:9px;background:#3fb95022;border-color:#3fb95066">
      🏗️ <b>${d.pend.toLocaleString()}석</b> 규모 구장 개선 공사 중 — 다음 시즌 개막에 맞춰 개방됩니다.</div>`:""}
    <div class="stkOrder" style="margin-top:12px">
      <input type="text" inputmode="decimal" placeholder="기부 금액(억)" value="${DON_AMT}" oninput="donSetAmt(this.value)"
        style="flex:1;min-width:110px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
      <button class="mini" onclick="DON_AMT=String(Math.round(((parseFloat(DON_AMT)||0)+1)*100)/100);show('mylife')">+1</button>
      <button class="mini" onclick="DON_AMT=String(Math.round(((parseFloat(DON_AMT)||0)+10)*100)/100);show('mylife')">+10</button>
      ${(!building&&!maxSeat&&need>0&&need<=M.cash)?`<button class="mini" style="border-color:var(--gold);color:var(--gold)" onclick="DON_AMT='${need}';show('mylife')">착공까지 ${need}억</button>`:""}
      <button class="mini" onclick="DON_AMT=me().cash.toFixed(2);show('mylife')">전액</button>
    </div>
    <div style="display:flex;gap:7px;margin-top:9px;align-items:center;flex-wrap:wrap">
      <button class="mini ${DON_ANON?"":"sel"}" onclick="if(DON_ANON)donToggleAnon()">📣 공개</button>
      <button class="mini ${DON_ANON?"sel":""}" onclick="if(!DON_ANON)donToggleAnon()">🤫 익명</button>
      <span class="small" style="color:var(--sub)">${DON_ANON
        ?"구단주만 압니다. 언젠가 알려지면 그때 팬 신뢰가 크게 오릅니다."
        :"구단주·팬 신뢰가 함께 오르고 기자회견에서 질문이 나옵니다."}</span>
    </div>
    ${g?`<div class="small" style="margin-top:9px;padding:8px 10px;background:var(--bg3);border-radius:8px;line-height:1.7">
      예상 반응 — 구단주 신뢰 <b style="color:#3fb950">+${DON_ANON?(g.own*1.15).toFixed(1):g.own.toFixed(1)}</b>
      ${DON_ANON?`<span style="color:var(--sub)">· 팬·언론은 아직 모릅니다</span>`
        :`· 팬 신뢰 <b style="color:#3fb950">+${g.fans.toFixed(1)}</b> · 흥행 <b style="color:#3fb950">+${g.hype.toFixed(3)}</b> · 언론 호감 <b style="color:#3fb950">+${g.press}</b>`}
      ${(d.sAmt||0)>0?`<br><span style="color:#ff9d5c">⚠ 올 시즌 이미 ${(d.sAmt||0).toFixed(2)}억을 냈습니다 — 반복 기부는 반응이 줄어듭니다.
        (시즌 한도 구단주 ${(d.sOwn||0).toFixed(1)}/${DON_CAP_OWN} · 팬 ${(d.sFans||0).toFixed(1)}/${DON_CAP_FANS})</span>`:""}
    </div>`:""}
    <button class="mini" style="width:100%;margin-top:10px;padding:11px;font-size:15px;border-color:var(--gold);color:var(--gold)"
      onclick="donOpen()">💝 ${a>0?a.toFixed(2)+"억 ":""}기부하기</button>
    <p class="small" style="margin-top:9px;color:var(--sub)">기부금은 돌려받을 수 없고 <b>이적 예산으로도 쓰이지 않습니다</b> — 전액 시설에 들어갑니다.
      개선된 구장은 다음 시즌부터 관중과 <b>입장 수입</b>으로 되돌아옵니다.</p>
  </div>`;
}
function mylifeView(){
  const M=me(), t=userTeam();
  const h=homeOf(), sal=mgrSalary(), pres=mgrPrestige();
  const propSum=M.props.reduce((s,x)=>s+(x.value||x.price),0);
  const monthly=Math.round((sal/12 + M.props.reduce((s,x)=>s+propRent(x),0)
                 - (M.homeOwn?h.rent*0.35:h.rent))*100)/100;
  const tab=(k,l)=>`<button class="mini ${meTab===k?'sel':''}" style="padding:8px 16px;font-size:14px" onclick="meSetTab('${k}')">${l}</button>`;
  let body="";
  if(meTab==="home"){
    const R=realty();
    const cur=homePrice(h), gain=(M.homeOwn&&h.buy)?Math.round((cur-h.buy)*100)/100:0;
    const loan=hmlLoan();
    body=`<div class="card"><h3>🏘️ 부동산 시장 <span class="small">— 지수 ${(R.idx*100).toFixed(1)}</span></h3>
      <div class="stkSum">
        <div><span>지금 사는 곳</span><b>${h.ic} ${h.n}</b>
          <span class="tag" style="margin-top:3px;display:inline-block;background:${M.homeOwn?"#3fb95033":"#1f6feb33"};color:${M.homeOwn?"#3fb950":"#58a6ff"}">${M.homeOwn?"자가":"월세"}</span></div>
        <div><span>${M.homeOwn?"보유 시세":"월세"}</span><b>${M.homeOwn?cur+"억":homeRent(h)+"억/월"}</b></div>
        ${M.homeOwn&&h.buy?`<div><span>평가손익</span><b style="color:${gain>=0?"#f85149":"#58a6ff"}">${gain>=0?"+":""}${gain}억</b></div>`:""}
        ${loan>0?`<div><span>🏦 담보대출</span><b style="color:#ff9d5c">${loan.toFixed(2)}억</b></div>
        <div><span>누적 이자</span><b style="color:#ff9d5c">${(M.hmlInt||0).toFixed(2)}억</b></div>`:""}
        <div><span>위신 기여</span><b style="color:var(--gold)">${h.pres>=0?"+":""}${h.pres}</b></div>
      </div>
      ${R.log.length?`<p class="small" style="margin-top:8px;color:var(--sub)">${R.log[0].t}</p>`:""}
    </div>
    ${M.homeOwn&&h.buy?`<div class="card"><h3>🏦 주택담보대출 <span class="small">— 시세의 ${Math.round(HML_LTV*100)}%까지 · 연 ${(HML_RATE*365*100).toFixed(1)}%</span></h3>
      <p class="small" style="color:var(--sub);margin-bottom:7px">집을 담보로 목돈을 만듭니다. 신용융자보다 이자가 훨씬 싸지만,
        <b>집값이 대출을 밑돌면 은행이 상환을 요구</b>하고 오래 방치하면 <b>경매</b>로 넘어갑니다. 이사하면 매각 대금에서 자동 상환됩니다.</p>
      <div class="stkOrder">
        <input type="text" inputmode="decimal" placeholder="금액(억)" value="${HML_AMT}" oninput="hmlSet(this.value)"
          style="flex:1;min-width:100px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
        <button class="mini" onclick="HML_AMT=String(Math.round((parseFloat(HML_AMT)||0)+1));show('mylife')">+1억</button>
        <button class="mini" onclick="HML_AMT=hmlMax().toFixed(2);show('mylife')">최대 ${hmlMax().toFixed(1)}억</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:7px">
        <button class="mini" style="flex:1;padding:9px;border-color:#ff9d5c;color:#ff9d5c" onclick="hmlBorrow(HML_AMT)">🏦 대출 실행</button>
        <button class="mini" style="flex:1;padding:9px;border-color:var(--green);color:var(--green)" onclick="hmlRepay(HML_AMT)">💵 상환</button>
      </div>
    </div>`:""}
    ${!homePartyBlock()?(()=>{ const left=homePartyLeft(), done=HOME_PARTY_CD-left, pc=Math.round(done/HOME_PARTY_CD*100);
      const openDay=(M.partyAt||0)+HOME_PARTY_CD;
      return `<div class="card"><h3>🎉 집들이 <span class="small">— 거실 ${h.party}등급 · ${h.party*4+6}명 초대 · ${HOME_PARTY_CD}일에 한 번</span></h3>
      <p class="small" style="color:var(--sub);margin-bottom:7px">호감도가 낮은 선수부터 불러 밥을 먹입니다. 집이 좋을수록 효과가 큽니다.</p>
      ${left>0?`<div class="partyLock">
        <div class="partyLockHead"><span>🔒 준비 중</span>
          <b>${left}일 남음</b></div>
        <div class="partyBar"><div style="width:${pc}%"></div></div>
        <div class="small" style="color:var(--sub);margin-top:5px">
          지난 집들이 ${dateLabel(M.partyAt||0)} · 다음 가능 <b style="color:var(--gold)">${dateLabel(openDay)}</b>
          <span style="opacity:.75">— 너무 자주 부르면 선수들도 부담스러워합니다.</span></div>
      </div>`
      :`${partyPickHtml()}
        <button class="mini" style="width:100%;padding:10px;margin-top:9px;border-color:var(--gold);color:var(--gold);font-weight:700"
          onclick="homeParty()">🎉 집들이 열기 (${(0.15+h.party*0.12).toFixed(2)}억)</button>`}
      ${partyLogHtml()}
    </div>`; })():(()=>{ const b=homePartyBlock();
      return `<div class="card"><h3>🎉 집들이</h3>
      <p class="small" style="padding:6px 2px;color:var(--sub)">${b.ic} <b>${b.t}</b><br>${b.d}</p>
      ${partyLogHtml()}</div>`; })()}
    <div class="card"><h3>🏠 매물 <span class="small">— 사는 곳이 곧 감독의 얼굴입니다</span></h3>
      ${HOMES.map(x=>{ const px=homePrice(x), mk=homeMkt(x.k);
        const dv=x.buy?Math.round((mk-1)*1000)/10:0;
        return `<div class="meRow ${x.k===M.home?"on":""}">
        <span class="meIc">${x.ic}</span>
        <span class="meN"><b>${x.n}</b>${x.party?`<span class="stkTag">거실 ${x.party}등급</span>`:""}<span class="small"> ${x.d}</span></span>
        <span class="meV">${x.buy?`${px}억 <span class="small" style="color:${dv>=0?"#f85149":"#58a6ff"}">${dv>=0?"+":""}${dv}%</span>`:"—"}
          <br><span class="small">월세 ${homeRent(x)}억 · 위신 ${x.pres>=0?"+":""}${x.pres}</span></span>
        ${x.k===M.home
          ? (M.homeOwn
              ? `<span class="tag" style="background:#3fb95033;color:#3fb950">🏡 거주 중 · 자가</span>`
              : `<span class="meLive"><span class="tag" style="background:#1f6feb33;color:#58a6ff">🔑 거주 중 · 월세</span>
                 ${x.buy?`<button class="mini" onclick="meMoveHome('${x.k}')">💰 매입</button>`:""}</span>`)
          : `<button class="mini" onclick="meMoveHome('${x.k}')">이사</button>`}</div>`;}).join("")}
    </div>`;
  } else if(meTab==="prop"){
    const R=realty();
    const tot=propTotal(), cost=M.props.reduce((s,x)=>s+x.price,0);
    const mRent=M.props.reduce((s,x)=>s+propRent(x),0);
    const vacN=M.props.filter(x=>x.vac>0).length;
    const loan=propLoan();
    body=`<div class="card"><h3>🏢 부동산 포트폴리오 <span class="small">— 시장 지수 ${(R.idx*100).toFixed(1)}</span></h3>
      <div class="stkSum">
        <div><span>보유</span><b>${M.props.length}건</b></div>
        <div><span>평가액</span><b class="money">${tot.toFixed(2)}억</b></div>
        <div><span>평가손익</span><b style="color:${tot-cost>=0?"#f85149":"#58a6ff"}">${tot-cost>=0?"+":""}${(tot-cost).toFixed(2)}억</b></div>
        <div><span>월 임대수익</span><b style="color:var(--green)">${mRent.toFixed(2)}억</b></div>
        <div><span>공실</span><b style="color:${vacN?"#ff9d5c":"var(--sub)"}">${vacN}/${M.props.length}건</b></div>
        ${loan>0?`<div><span>🏦 담보대출</span><b style="color:#ff9d5c">${loan.toFixed(2)}억</b></div>`:""}
        <div><span>순자산 기여</span><b>${(tot-loan).toFixed(2)}억</b></div>
      </div>
      ${vacN?`<div class="msg warn" style="margin-top:8px">🚪 <b>${vacN}건</b>이 공실입니다 — 그동안 임대수익이 나오지 않습니다.</div>`:""}
    </div>
    ${M.props.length?`<div class="card"><h3>📦 보유 매물</h3>
      ${M.props.map((it,i)=>{ const P=propDef(it.k); const v=propVal(it);
        const d=Math.round((v-it.price)*100)/100, dp=(d/it.price*100);
        const up=PROP_UP[it.up||0];
        const nx=PROP_UP[(it.up||0)+1];
        const yrs=(G.season||0)-(it.s!=null?it.s:(G.season||0));
        return `<div class="propRow">
          <div class="propHead">
            <span class="meIc">${P.ic}</span>
            <span class="propN"><b>${P.n}</b>
              <span class="stkTag">${P.reg}</span>
              ${it.vac>0?`<span class="stkTier" style="color:#ff9d5c;border-color:#ff9d5c66">🚪 공실 ${it.vac}개월</span>`:""}
              ${up?`<span class="stkTier" style="color:#7ee2a8;border-color:#7ee2a866">🔨 ${up.n}</span>`:""}</span>
            <span class="propV"><b>${v.toFixed(2)}억</b>
              <span class="small" style="color:${d>=0?"#f85149":"#58a6ff"}">${d>=0?"+":""}${d}억 (${dp>=0?"+":""}${dp.toFixed(1)}%)</span></span>
          </div>
          <div class="small" style="color:var(--sub);margin:3px 0 5px">
            매입 ${it.price}억 · 보유 ${yrs}년${yrs<2?' <span style="color:#ff9d5c">(2년 미만 — 양도세 중과)</span>':""} ·
            월 임대 <b style="color:${it.vac>0?"#ff9d5c":"var(--green)"}">${propRent(it).toFixed(2)}억</b>
            <span style="opacity:.7">(임대료 지수 ${Math.round((it.rentK||1)*100)}%)</span> ·
            실질 수익률 <b>${propNetYield(it)}%</b></div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${nx?`<button class="mini" onclick="mePropUp(${i})">🔨 ${nx.n} (${(v*nx.cost).toFixed(2)}억 · 시세 +${Math.round(nx.val*100)}%)</button>`
                :`<span class="small" style="color:var(--sub);align-self:center">더 손볼 곳이 없습니다</span>`}
            <button class="mini" style="margin-left:auto;border-color:#f85149;color:#ff8080" onclick="meSellProp(${i})">매각</button>
          </div>
        </div>`;}).join("")}
    </div>
    <div class="card"><h3>🏦 부동산 담보대출 <span class="small">— 시세의 ${Math.round(PLN_LTV*100)}%까지 · 연 ${(PLN_RATE*365*100).toFixed(1)}%</span></h3>
      <p class="small" style="color:var(--sub);margin-bottom:7px">보유 부동산을 담보로 빌려 <b>한 채 더</b> 살 수 있습니다.
        임대수익이 이자를 넘으면 남는 장사지만, 공실이 겹치면 이자만 나갑니다.
        ${loan>0?`<br>누적 이자 <b style="color:#ff9d5c">${(M.plnInt||0).toFixed(2)}억</b>`:""}</p>
      <div class="stkOrder">
        <input type="text" inputmode="decimal" placeholder="금액(억)" value="${PLN_AMT}" oninput="plnSet(this.value)"
          style="flex:1;min-width:100px;padding:9px 10px;font-size:16px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg);text-align:right">
        <button class="mini" onclick="PLN_AMT=propLoanMax().toFixed(2);show('mylife')">최대 ${propLoanMax().toFixed(1)}억</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:7px">
        <button class="mini" style="flex:1;padding:9px;border-color:#ff9d5c;color:#ff9d5c" onclick="plnBorrow(PLN_AMT)">🏦 대출 실행</button>
        <button class="mini" style="flex:1;padding:9px;border-color:var(--green);color:var(--green)" onclick="plnRepay(PLN_AMT)">💵 상환</button>
      </div>
    </div>`:""}
    ${(R.plog||[]).length?`<div class="card"><h3>📰 부동산 소식</h3>
      ${R.plog.slice(0,10).map(x=>`<div class="small" style="padding:5px 0;border-bottom:1px solid #21262d">
        <span style="color:var(--sub)">${dateLabel(x.d)}</span> ${x.t}</div>`).join("")}
    </div>`:""}
    <div class="card"><h3>🏬 매물 <span class="small">— ${PROPS.length}건</span></h3>
      <p class="small" style="color:var(--sub);margin-bottom:7px">
        <b>실질 수익률</b>은 명목 수익률에서 공실률과 재산세를 뺀 값입니다. 명목이 높아도 공실이 잦으면 남는 게 없습니다.</p>
      ${PROPS.map(P=>{ const fee=Math.round(P.price*PROP_FEE*100)/100;
        const ny=Math.round((P.yield*(1-P.vac)-PROP_TAX)*1000)/10;
        return `<div class="meRow"><span class="meIc">${P.ic}</span>
        <span class="meN"><b>${P.n}</b> <span class="stkTag">${P.reg}</span>
          <span class="small"> 명목 ${(P.yield*100).toFixed(1)}% → <b style="color:${ny>=3.5?"var(--green)":ny>=2?"var(--gold)":"var(--red)"}">실질 ${ny}%</b>
            · 공실률 ${Math.round(P.vac*100)}% · 변동성 ${P.risk>=0.24?"매우 높음":P.risk>=0.2?"높음":P.risk>=0.14?"보통":"낮음"}</span></span>
        <span class="meV">${P.price}억<br><span class="small">+세금 ${fee}억</span></span>
        <button class="mini" onclick="meBuyProp('${P.k}')" ${P.price+fee>M.cash?"disabled":""}>매입</button></div>`;}).join("")}
    </div>`;
  } else if(meTab==="shop"){
    const inv=Object.keys(M.inv).filter(k=>M.inv[k]>0);
    body=`<div class="card"><h3>🛍️ 쇼핑 <span class="small">— 선수에게 줄 물건을 삽니다</span></h3>
      ${GIFTS.map(x=>`<div class="meRow"><span class="meIc">${x.ic}</span>
        <span class="meN"><b>${x.n}</b><span class="small"> ${x.d}</span><br>
          <span class="small" style="color:var(--sub)">호감 +${x.aff} · 사기 +${x.mor}${x.cond?` · 컨디션 +${x.cond}`:""}${x.xp?` · 특성 경험치 +${x.xp}`:""}</span></span>
        <span class="meV">${x.price}억${M.inv[x.k]?`<br><span class="small" style="color:var(--gold)">보유 ${M.inv[x.k]}</span>`:""}</span>
        <button class="mini" onclick="meBuyGift('${x.k}')" ${x.price>M.cash?"disabled":""}>구매</button></div>`).join("")}
    </div>
    <div class="card"><h3>🎁 선물하기 <span class="small">— 같은 선수에게는 ${GIFT_COOL}일에 한 번</span></h3>
      ${G.jobless?`<p class="small">🚫 <b>지금은 맡고 있는 팀이 없습니다.</b> 선물은 내 선수에게만 보낼 수 있습니다 — 새 팀에 부임한 뒤에 이용하세요.
        <br><span style="color:var(--sub)">사 둔 물건은 그대로 보관됩니다.</span></p>`
      : inv.length?`
      <p class="small" style="margin-bottom:5px">보낼 물건을 하나 고른 뒤, 선수 옆의 <b>보내기</b>를 누르면 바로 전달됩니다.</p>
      <div class="giftPick">${inv.map(k=>{const x=GIFTS.find(y=>y.k===k);
        return `<button class="psChip sm ${meGiftSel===k?"on":""}" onclick="meSelGift('${k}')">${x.ic} ${x.n} <span class="psSubN">${M.inv[k]}</span></button>`;}).join("")}</div>
      ${(()=>{ const cur=GIFTS.find(x=>x.k===meGiftSel);
        return cur?`<p class="small" style="margin:6px 0 4px;color:var(--sub)">${cur.ic} <b style="color:var(--txt)">${cur.n}</b> — 호감 +${cur.aff} · 사기 +${cur.mor}${cur.cond?` · 컨디션 +${cur.cond}`:""}${cur.xp?` · 특성 경험치 +${cur.xp}`:""}</p>`:""; })()}
      <div class="giftBox">
        ${t.players.slice().sort((a,b)=>aff(a)-aff(b)).map(p=>{ const left=giftCoolLeft(p);
          return `<div class="giftRow">
            <span class="giftN"><b>${nmF(p)}</b> <span class="small pos-${p.pos}">${p.pos}</span></span>
            <span class="giftV small">호감 <b style="color:${aff(p)>=60?"var(--green)":aff(p)>=40?"var(--gold)":"var(--red)"}">${Math.round(aff(p))}</b> · 컨디션 ${mor(p.cond)}%</span>
            ${left>0?`<span class="small" style="color:var(--sub);flex:0 0 auto">${left}일 뒤</span>`
              :`<button class="mini giftGo" ${meGiftSel?"":"disabled"} onclick="meGiveGift(${p.id},'${meGiftSel||""}')">🎁 보내기</button>`}
          </div>`;}).join("")}
      </div>`
      :`<p class="small">가진 물건이 없습니다. 위에서 먼저 사세요.</p>`}
    </div>`;
  } else if(meTab==="bank"){
    body=bankView();
  } else if(meTab==="stock"){
    body=stkView();
  } else if(meTab==="don"){
    body=donCard();
  } else if(meTab==="gam"){
    body=gamCard();
  } else if(meTab==="debt"){
    body=mgrDebtCard();
  } else {
    body=`<div class="card"><h3>📒 가계부</h3>
      ${M.log.length?M.log.map(x=>`<div style="padding:4px 0;border-bottom:1px solid #21262d;font-size:13px">
        <span class="small" style="color:var(--sub)">${dateLabel(x.d)}</span> ${x.t}</div>`).join("")
        :`<p class="small">아직 기록이 없습니다.</p>`}
      <p class="small" style="margin-top:8px;color:var(--sub)">누적 수입 ${M.earned.toFixed(2)}억 · 누적 지출 ${M.spent.toFixed(2)}억</p>
    </div>`;
  }
  /* 💎 한눈에 보는 전부 — 현금·주식·부동산·예금·자가에서 모든 빚을 뺀 값 */
  const nw=netWorth(), dbt=debtTotal();
  const asset=nw+dbt;
  const parts=[
    ["현금", M.cash*1e8, "#c9d1d9"],
    ["주식", (()=>{try{return stkEval()+stkShortPL()+stkFutEquity()}catch(e){return 0}})(), "#f85149"],
    ["부동산", (()=>{try{return propTotal()*1e8}catch(e){return 0}})(), "#7ee2a8"],
    ["예·적금", (()=>{try{return bankDepTotal()*1e8}catch(e){return 0}})(), "#58a6ff"],
    ["자가", (()=>{try{return M.homeOwn?homePrice(homeOf())*1e8:0}catch(e){return 0}})(), "#e3b341"]
  ].filter(x=>Math.abs(x[1])>1e4);
  const debts=[
    ["미납금(위약금·징계금)", (()=>{try{return Math.max(0,(M.debt||0))*1e8}catch(e){return 0}})()],
    ["증권 신용", (()=>{try{return stkLoan()}catch(e){return 0}})()],
    ["사채", (()=>{try{return stkDebt()}catch(e){return 0}})()],
    ["주택담보", (()=>{try{return hmlLoan()*1e8}catch(e){return 0}})()],
    ["부동산담보", (()=>{try{return propLoan()*1e8}catch(e){return 0}})()],
    ["은행 신용", (()=>{try{return bankLoanTotal()*1e8}catch(e){return 0}})()]
  ].filter(x=>x[1]>1e4);
  return `<h2>💼 내 자산</h2>
  <div class="card" style="border-color:${nw>=0?"#3fb95044":"#f8514966"}">
    <h3>💎 순자산 <span class="small">— 가진 것 전부에서 빚을 뺀 값</span></h3>
    <div style="font-size:30px;font-weight:800;color:${nw>=0?"var(--gold)":"#f85149"};line-height:1.2">${stkMoney(nw)}</div>
    <div class="small" style="color:var(--sub);margin:3px 0 8px">자산 ${stkMoney(asset)} − 부채 ${stkMoney(dbt)}</div>
    ${parts.length?`<div class="nwBar">${parts.map(x=>`<div style="width:${Math.max(1,x[1]/Math.max(1,asset)*100)}%;background:${x[2]}"></div>`).join("")}</div>
    <div class="nwLeg">${parts.map(x=>`<span><i style="background:${x[2]}"></i>${x[0]} ${stkMoney(x[1])}</span>`).join("")}</div>`:""}
    ${debts.length?`<div class="small" style="margin-top:7px;color:#ff9d5c">💳 ${debts.map(x=>`${x[0]} ${stkMoney(x[1])}`).join(" · ")}</div>`:""}
    ${G.jobless?`<div class="msg warn" style="margin-top:8px">🕊️ <b>무직</b> — 월급이 들어오지 않습니다.
      집세·관리비·대출 원리금은 그대로 나가니, 자리를 찾을 때까지 버틸 현금을 확인하세요.</div>`:""}
    ${nw<0?`<div class="msg warn" style="margin-top:8px">⚠️ 빚이 자산을 넘어섰습니다. 사채가 있다면 넉 달 안에 정리하지 못하면 <b>파산</b>합니다.</div>`:""}
  </div>
  <div class="row">
    <div class="card"><h3>💰 보유 현금</h3><div style="font-size:26px" class="money">${moneyEok(M.cash)}</div>
      ${M.debt>0?`<p class="small" style="margin:4px 0 0;color:var(--red)">⚖️ 미납금 <b>${M.debt.toFixed(2)}억</b> — ${G.jobless?"무직이라 월급 공제가 없습니다. 직접 갚아야 줄어듭니다.":"매달 월급의 절반이 공제됩니다."}
        <button class="mini" style="padding:1px 7px;font-size:11px;margin-left:5px;border-color:var(--gold);color:var(--gold)" onclick="show('mylife')">💼 자산에서 갚기</button></p>`:""}
      <p class="small" style="margin-top:6px">연봉 <b>${sal}억</b> (월 ${(sal/12).toFixed(2)}억) · 세후 월 순수입 <b style="color:${monthly>=0?"var(--green)":"var(--red)"}">${monthly>=0?"+":""}${(monthly*0.86).toFixed(2)}억</b></p></div>
    <div class="card"><h3>🏠 거주</h3><div style="font-size:20px">${h.ic} ${h.n}</div>
      <p class="small" style="margin-top:6px">${M.homeOwn?"자가 · 관리비":"월세"} ${(M.homeOwn?h.rent*0.35:homeRent(h)).toFixed(2)}억/월</p></div>
    <div class="card"><h3>👔 감독 위신</h3><div style="font-size:26px;color:var(--gold)">${pres}</div>
      <p class="small" style="margin-top:6px">선수 영입 설득력과 재계약 성공률에 반영됩니다.<br>집 ${h.pres>=0?"+":""}${h.pres} · 부동산 ${Math.min(15,M.props.length*3).toFixed(0)} · 현금 ${clamp(M.cash*0.05,0,10).toFixed(1)}</p></div>
  </div>
  <div style="margin:10px 0">${tab("home","🏠 거주")} ${tab("prop","🏢 부동산")} ${tab("stock","📈 주식")} ${tab("shop","🛍️ 쇼핑 · 선물")} ${tab("bank","🏦 은행")} ${tab("don","💝 기부")} ${tab("gam","🎰 도박")}${(M.debt||0)>0?" "+tab("debt","⚖️ 미납금"):""} ${tab("log","📒 가계부")}</div>
  ${body}`;
}
