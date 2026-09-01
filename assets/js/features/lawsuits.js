"use strict";
/* ═══════════════════════════════════════════════════════════════
   댓글 고소
   감독도 사람이라 인터넷 글에 상처받는다. 닉네임을 눌러 그 글을 걸 수 있다.
   다만 이건 이기는 싸움이 아니다 — 이겨도 "검열 감독"이 되고, 지면 두 배로 웃음거리가 된다.
   그래서 효과를 양쪽으로 준다.
     · 승소 : 합의금 회수 + 한동안 악플이 눈에 띄게 줄어든다(눈치를 본다) + 구단주는 조용해서 좋아한다
     · 패소 : 변호사비만 날리고 팬 신뢰·언론 관계가 크게 상한다
     · 공통 : 고소 자체가 이미지 손상이다. 횟수가 쌓일수록 대가가 커진다.
═══════════════════════════════════════════════════════════════ */
const SUE_COST=1.5;                 // 변호사 선임비 (억)
const SUE_MAX_SEASON=5;             // 이 이상은 구단주가 막는다
function sueState(){
  if(!G.sue || G.sue.s!==G.season) G.sue={s:G.season, n:0, win:0, lose:0, chill:0};
  return G.sue;
}
/* 게시물 식별자 — 옛 세이브에는 없으므로 그릴 때 붙여 준다 */
let SUE_UID=0;
function feedId(x){ if(x && !x.fid) x.fid="f"+(++SUE_UID); return x?x.fid:""; }
function findFeed(kind, fid){
  /* 🗞️ 루머 게시판 글도 고소 대상이다 — txt 에 제목+본문이 합쳐져 있어 판정 로직이 그대로 통한다 */
  const arr = kind==="rum" ? (G.rum||[]) : kind==="fmk" ? (G.fmk||[]) : (G.social||[]);
  return arr.find(x=>x.fid===fid) || null;
}
/* 이 글이 얼마나 험한가 — 험할수록 이길 확률이 높다 */
const SUE_HARSH=["ㅅㅂ","ㅆㅂ","씨발","좆","병신","ㅂㅅ","븅신","ㅄ","ㅉㅉ","븅","세금리그","인생 낭비","인생 망","꺼져","뒤져","죽어","등신","멍청","머저리","무능","사퇴","경질","환불","쓰레기","답없","답 없"];
function sueHarshness(x){
  const t=String((typeof rumFill==="function")?rumFill(x&&x.txt||""):(x&&x.txt||""));
  let h=0;
  for(const w of SUE_HARSH) if(t.indexOf(w)>=0) h++;
  if((x&&x.tone)<0) h+=1;
  if(x && x.troll) h+=2;      // 상주 악플러는 누적된 전력이 있다 — 법원도 그걸 본다
  return clamp(h, 0, 5);
}
/* ⚖️ 고소를 걸 수 있는 상태인가 — 막는 이유를 <b>한곳</b>에 모은다.
   ⚠ 예전에는 「이미 진행 중」과 「시즌 한도」 두 가지만 봤다. 그 사이에 시스템이 여럿 생겼는데
      어디에도 연결돼 있지 않았다 — <b>무직인 감독이 「구단 법무팀」을 부르고</b>,
      매각 절차로 주인이 없는 구단이 소송을 걸고, 금감원 조사로 계좌가 얼어붙은 감독이
      변호사비를 치렀다. 전부 말이 안 된다.
   ─ 막을 이유가 있으면 그 «이유»를 돌려주고, 없으면 null 을 돌려준다. */
function sueBlock(){
  try{
    if(G.jobless || !userTeam())
      return `소속 구단이 없습니다.\n\n"구단 법무팀은 «구단 소속 감독»을 위한 조직입니다. 무직 상태에서는 쓰실 수 없습니다."\n\n<span class="small">개인 변호사를 선임하는 것은 말릴 수 없지만, 그건 게임에서 다루지 않습니다.</span>`;
    if(G.phase==="sacked") return `지휘할 팀이 없습니다.`;
    if(typeof clubForSale==="function" && clubForSale(userTeam())){
      const _r=(typeof saleState==="function")?saleState()[userTeam().id]:null;
      return `구단이 «매각 절차» 중입니다.\n\n"소송을 결재할 주인이 없습니다. 인수 결론이 난 뒤에 다시 말씀해 주세요."${_r?`\n\n<span class="small">결론 예정일: ${dateLabel(_r.due)}</span>`:""}`;
    }
    if(typeof fssFrozen==="function" && fssFrozen())
      return `금융감독원 조사로 계좌가 동결돼 있습니다.\n\n"지금 감독님이 남을 고소할 처지가 아닙니다. 그쪽부터 정리하시죠."`;
    if(typeof stkBadCredit==="function" && stkBadCredit())
      return `파산 이력이 남아 있습니다.\n\n"변호사 선임비를 감당하실 수 있는 상태가 아닙니다."`;
    const _st=sueState();
    if(_st.n>=SUE_MAX_SEASON)
      return `올 시즌 벌써 ${_st.n}건입니다. 더는 안 됩니다.\n\n<span class="small">한 시즌 고소는 ${SUE_MAX_SEASON}건까지입니다.</span>`;
  }catch(e){}
  return null;
}
function sueChance(x){
  const st=sueState();
  let c = 0.30 + sueHarshness(x)*0.11;
  c += (G.trust?(G.trust.owner-70)/400:0);       // 구단이 밀어 주면 변호사도 좋은 사람이 붙는다
  c -= st.n*0.07;                                 // 남발할수록 법원도 지겨워한다
  if(x && x.sd==="r") c += 0.05;                  // 남의 팬 글은 감정적으로 걸기 쉽다
  /* 🗞️ 루머 게시판 — <b>사실이면 명예훼손이 안 된다.</b> 「정ㅋ벅ㅋ」이 붙은 글,
     즉 커뮤니티가 확정으로 받아들인 글은 오히려 지기 쉽다. */
  if(x && x.conf) c -= 0.16;
  /* 📰 언론 관계 — 기자들이 등을 돌려 있으면 여론전에서 진다 */
  try{ if(G.press && G.press.rel!=null) c += (G.press.rel-50)/500; }catch(e){}
  /* 🎖️ 감독 위신 — 물의를 일으킨 이력이 있으면 법정에서도 불리하다 (도박·주가조작) */
  try{ c += clamp((G.mgrRepMod||0)*0.012, -0.12, 0.06); }catch(e){}
  return clamp(c, 0.05, 0.88);
}
function openSue(kind, fid){
  if(G.suit){
    showConfirm(`<b>⚖️ 구단 법무팀</b>

"이미 진행 중인 소송이 있습니다. 두 건을 동시에 끌고 갈 수는 없습니다."

<span class="small">📰 뉴스/소셜 탭의 소송 카드에서 진행 상황을 확인하세요.</span>`,
      ()=>{}, {okLabel:"알겠습니다", cancelLabel:""});
    return;
  }
  /* ⚖️ 지금 고소를 걸 수 있는 상태인가 (sueBlock 주석) */
  { const why=sueBlock();
    if(why){ showConfirm(`<b>⚖️ 구단 법무팀</b>\n\n${why}`, ()=>{}, {okLabel:"알겠습니다", cancelLabel:""}); return; } }
  const x=findFeed(kind, fid);
  if(!x){ notify("그 글을 찾을 수 없습니다.","warn"); return; }
  /* ⚖️ 루머 게시판은 «우리 구단 관련 글»만 고소할 수 있다 (제보) — 남의 집 싸움에 낄 수 없다 */
  if(kind==="rum"){
    const _ut=userTeam();
    if(G.jobless || !_ut){ flash("소속 구단이 없어 구단 법무팀을 쓸 수 없습니다.","warn"); return; }
    if(x.tid!==_ut.id){
      const _t2=G.teams[x.tid];
      flash(`⚖️ <b>${_t2?_t2.short:"타 구단"}</b> 관련 글입니다 — 우리 구단 법무팀이 나설 사안이 아닙니다.`,"warn"); return;
    }
  }
  const t=userTeam(); const st=sueState();
  const ch=sueChance(x), h=sueHarshness(x);
  const L=ch>=0.6?["승소 유력","var(--green)"]:ch>=0.35?["반반","var(--gold)"]:["희박","var(--red)"];
  const hn=h>=4?"매우 험함":h>=2?"험함":h>=1?"거친 편":"평범함";
  const who = x.troll ? '<span style="color:var(--red)">상주 악플러</span>' : (x.sd==="r" ? "타 구단 팬" : "우리 구단 팬");
  const M=me();
  showConfirm(
    `<b style="font-size:16px">⚖️ 이 글을 고소하시겠습니까?</b>\n\n`+
    `<div class="msg ${x.tone<0?"warn":"info"}" style="margin:6px 0">@${x.u} <span class="small">(${who})</span><br>"${(typeof rumFill==="function")?rumFill(x.txt):x.txt}"</div>`+
    `· 표현 수위: <b>${hn}</b>\n· 기본 승소 전망: <b style="color:${L[1]}">${L[0]}</b> <span class="small">(${Math.round(ch*100)}%)</span>\n`+
    `· 올 시즌 고소: <b>${st.n}/${SUE_MAX_SEASON}건</b>\n\n`+
    (x.conf
      ? `<span style="color:var(--red)">⚠ 커뮤니티가 <b>「정ㅋ벅ㅋ」</b>으로 받아들인 글입니다 — <b>사실이면 명예훼손이 성립하지 않습니다.</b> 승소 전망이 크게 떨어집니다.</span>`
      : x.troll
      ? `<span style="color:var(--green)">✅ 커뮤니티 전체가 지긋지긋해하는 상주 악플러입니다. 팬들이 오히려 박수를 칠 겁니다.</span>`
      : `<span class="small">이겨도 "검열 감독" 소리를 듣습니다. 다음 단계에서 변호를 누구에게 맡길지 고릅니다.</span>`),
    ()=>sueFirmPick(kind, fid), {okLabel:"⚖️ 진행한다", cancelLabel:"🚪 넘어간다", danger:true});
}
/* ── 변호 선택 — 누구에게 맡기느냐가 승률·기간·비용을 가른다 ── */
const SUE_FIRMS=[
 /* 소송은 원래 오래 걸린다 — 아무리 빨라도 2주는 법원 문턱도 못 넘는 기간이다 */
 {k:"club",  n:"구단 법무팀",   ic:"🏢", cost:0.3, chMod:-0.10, days:[28,45],
  d:"구단 소속 변호사가 겸업으로 맡는다. 싸지만 전문성이 떨어지고 오래 걸린다."},
 {k:"small", n:"소형 로펌",     ic:"⚖️", cost:1.5, chMod:0,     days:[20,32],
  d:"명예훼손 전문. 표준적인 선택."},
 {k:"big",   n:"대형 로펌",     ic:"🏛️", cost:4.0, chMod:+0.15, days:[14,21],
  d:"이름만으로 상대가 떤다. 빠르고 세다 — 다만 '감독이 대형 로펌까지'라는 말이 나온다."}];
function sueFirmPick(kind, fid){
  const x=findFeed(kind, fid); if(!x) return;
  const M=me(), t=userTeam(), ch=sueChance(x);
  /* 🏢 구단 법무팀은 «구단이 감독을 밀어 줄 때»만 붙는다. 구단주 신뢰가 바닥이면 알아서 하라고 한다.
     모기업이 흔들리는 구단도 이런 데 사람을 못 뺀다. */
  const _own=(G.trust&&G.trust.owner!=null)?G.trust.owner:60;
  const _tight=(typeof ownHealth==="function" && ownHealth(t)<0.82);
  const FIRMS=SUE_FIRMS.filter(f=>f.k!=="club" || (_own>=45 && !_tight));
  if(FIRMS.length<SUE_FIRMS.length){
    try{ flash(_own<45 ? "🏢 구단 법무팀은 이번 건에 손대지 않겠다고 합니다 — 구단주 신뢰가 낮습니다."
                       : "🏢 모기업 사정으로 구단 법무팀을 쓸 수 없습니다 — 외부 로펌만 가능합니다.","warn"); }catch(e){}
  }
  const rows=FIRMS.map(f=>{
    const eff=clamp(ch+f.chMod, 0.05, 0.92);
    const afford=(M.cash>=f.cost)||(t.budget>=f.cost);
    return `${f.ic} <b>${f.n}</b> — ${f.cost}억 · 승소 ${Math.round(eff*100)}% · ${f.days[0]}~${f.days[1]}일${afford?"":" <span style=\"color:var(--red)\">(잔고 부족)</span>"}\n<span class="small">${f.d}</span>`;
  });
  showChoice(`<b>⚖️ 변호를 누구에게 맡기시겠습니까?</b>\n<span class="small">비용은 감독 사비에서 나갑니다 (보유 ${moneyEok(M.cash)})</span>`,
    rows, (i)=>sueFile(kind, fid, FIRMS[i].k));
}
/* ── 소송 제기 — 이제 결과는 며칠 뒤에 나온다 ── */
function sueFile(kind, fid, firmK){
  const x=findFeed(kind, fid); if(!x) return;
  { const why=sueBlock();
    if(why){ try{ flash("⚖️ 지금은 고소를 진행할 수 없습니다.","warn"); }catch(e){} return; } }
  const firm=SUE_FIRMS.find(f=>f.k===firmK)||SUE_FIRMS[1];
  const t=userTeam(), st=sueState();
  st.n++;
  mgrFine(firm.cost, `${x.u} 고소 — ${firm.n} 선임`);
  const due=(G.day||0)+firm.days[0]+R(firm.days[1]-firm.days[0]+1);
  G.suit={kind, u:x.u, e:x.e, txt:x.txt, tone:x.tone, troll:x.troll?1:0, sd:x.sd||"o",
          firm:firmK, ch:clamp(sueChance(x)+firm.chMod, 0.05, 0.92),
          harsh:sueHarshness(x), filed:G.day||0, due, stage:"filed", events:[]};
  const v={t:t.short, u:x.u};
  addNews(`⚖️ ${t.name} 감독, 게시물 작성자 <b>@${x.u}</b> 상대 명예훼손 소송 제기 — ${firm.n} 선임. 결과는 ${due-(G.day||0)}일 안팎.`, "warn", "club");
  socialFill(x.troll?SOC.sueFileTroll:SOC.sueFile, 3+R(2), x.troll?1:-1, v);
  fmkFill(FMK.sueFile, 2+R(2), v);
  rivalFill(RIV.sueWatch, 2+R(2), 0, v);
  if(firmK==="big"){ socialFill(SOC.sueBigFirm, 2, 0, v); }
  /* 소장이 날아갔다는 소식만으로도 커뮤니티는 움츠러든다 — 판결 전인데도 글 지우는 사람이 나온다 */
  st.chill=Math.max(st.chill||0, firmK==="big"?3 : firmK==="small"?2 : 1);
  saveGame(); show("media");
}
/* ── 하루하루 — 사과가 오거나, 더 폭발하거나 ── */
function tickSuit(){
  const S=G.suit; if(!S) return;
  const t=userTeam(); if(!t) return;
  const day=G.day||0;
  if(S.stage==="filed"){
    /* 사과문 — 험한 글일수록, 트롤일수록 안 굽힌다 */
    /* 트롤은 평소엔 안 굽히지만, 판결이 닥치면(D-5) 갑자기 "선처 호소문"을 쓴다 — 물론 반쯤 비꼬는 문체다 */
    const apoP = S.troll ? ((day>=S.due-5) ? 0.06 : 0.008) : clamp(0.07 - S.harsh*0.012, 0.015, 0.07);
    const boomP = S.troll ? 0.09 : 0.02 + S.harsh*0.008;
    const r=Math.random();
    if(r<apoP){
      S.stage="apology";
      /* 글솜씨 — 진심 45% / 형편없음 35% / 대필 티 20% */
      const roll2=Math.random();
      S.apoKind = S.troll ? "fake" : (roll2<0.45 ? "sincere" : roll2<0.80 ? "poor" : "ai");
      const pool = S.apoKind==="fake"?SUE_APOLOGY_FAKE : S.apoKind==="sincere"?SUE_APOLOGY_SINCERE : S.apoKind==="poor"?SUE_APOLOGY_POOR : SUE_APOLOGY_AI;
      const apo=F_(pick(pool),{t:t.short});
      S.apoTxt=apo;                                     // 원문 보관 — 팝업·카드 어디서든 그대로 보여 준다
      if(S.troll){ fmkPush(apo, 0); if(G.fmk&&G.fmk[0]){ G.fmk[0].u=S.u; G.fmk[0].troll=1; } }   // 시모·독고는 펨코에 쓴다
      else { pushSocial(apo, 0, S.sd==="r"?"rival":undefined);
             if(G.social && G.social[0]) G.social[0].u=S.u; }    // 그 사람 명의로
      addNews(`📩 소송 중인 게시물 작성자 @${S.u}, 공개 사과문 게재 — "합의를 원한다"`, null, "club");
      /* 사과문 자체가 화제가 된다 — 글솜씨에 따라 반응이 갈린다 */
      const av={t:t.short, u:S.u};
      if(S.apoKind==="fake"){ socialFill(SOC.apoPoor, 3+R(2), -1, av); fmkFill(FMK.apoPoor, 2, av); }
      else if(S.apoKind==="ai"){ socialFill(SOC.apoAI, 3+R(2), 0, av); fmkFill(FMK.apoAI, 2+R(2), av); }
      else if(S.apoKind==="poor"){ socialFill(SOC.apoPoor, 3+R(2), -1, av); fmkFill(FMK.apoPoor, 2, av); }
      else { socialFill(SOC.apoGood, 2+R(2), 0, av); }
      rivalFill(RIV.sueWatch, 2+R(2), 0, av);
      /* 진행(로딩) 중이면 그 자리에서 팝업을 띄우지 않는다 — 뒤이어 흐르는 날짜 로그에 묻히거나
         다른 모달이 덮어쓸 수 있다. 진행을 멈추고, 멈춘 화면에서 사과문 팝업을 연다. */
      if(typeof PROG!=="undefined" && PROG){
        prgPush(`📩 <b>@${S.u}</b>이(가) 사과문을 올렸습니다 — 수용 여부를 정해야 합니다.`, "prgStop");
        saveGame(); stopProgress({kind:"suitApology"});
      } else {
        suitApologyPopup();
      }
    } else if(r<apoP+boomP){
      S.ch=clamp(S.ch+0.07, 0.05, 0.95);               // 스스로 증거를 쌓는다
      S.events.push("boom");
      const boom=pick(S.troll?SUE_BOOM_TROLL:SUE_BOOM);
      if(S.troll){ fmkPush(F_(boom,{t:t.short}), -1); if(G.fmk&&G.fmk[0]){ G.fmk[0].u=S.u; G.fmk[0].troll=1; } }
      else { pushSocial(F_(boom,{t:t.short}), -1, S.sd==="r"?"rival":undefined);
             if(G.social && G.social[0]) G.social[0].u=S.u; }
      notify(`🔥 소송 중인 <b>@${S.u}</b>이(가) 오히려 더 큰 글을 올렸습니다. 변호사가 웃으며 캡처했습니다. (승소 전망 +7%p)`,"info");
    }
  }
  if(day>=S.due && S.stage!=="apology"){
    if(typeof PROG!=="undefined" && PROG){
      prgPush(`⚖️ <b>@${S.u}</b> 소송 판결이 나왔습니다.`, "prgStop");
      saveGame(); stopProgress({kind:"suitVerdict"});
    } else sueVerdict();
  }
}
/* 사과문 팝업 — 로딩창 멈춤 뒤 또는 즉시 */
function suitApologyPopup(){
  const S=G.suit; if(!S || S.stage!=="apology") { show("media"); return; }
  const apo=S.apoTxt||"";
  showConfirm(`<b>📩 @${S.u}이(가) 사과문을 올렸습니다</b>\n\n`+
    `<div class="msg info" style="margin:8px 0;white-space:pre-line">"${apo}"</div>`+
    `<span class="small">${S.apoKind==="ai"?"…어딘가 변호사나 AI가 다듬어 준 문장 같습니다. 진심인지는 감독님이 판단하실 일입니다.\n":S.apoKind==="poor"?"…사과문이라기엔 성의가 없습니다. 그래도 사과는 사과입니다.\n":""}받아들이면 소송은 여기서 끝납니다 — 합의금은 없지만 훈훈하게 마무리되고 팬 신뢰가 오릅니다.\n`+
    `거부하면 소송을 계속합니다${S.troll?" (상주 악플러 — 팬들은 끝까지 가길 원합니다)":" (팬 신뢰가 조금 깎입니다)"}.</span>`,
    ()=>sueAcceptApology(),
    {okLabel:"🤝 수용한다", cancelLabel:"⚖️ 거부하고 계속 간다", onCancel:()=>sueRejectApology()});
}
/* ── 사과 처리 ── */
function sueAcceptApology(){
  const S=G.suit; if(!S || S.stage!=="apology") return;
  const t=userTeam(), st=sueState();
  G.suit=null;
  const v={t:t.short, u:S.u};
  adjustTrust("fans", S.apoKind==="fake"?1 : S.troll?3 : (S.apoKind==="poor"?3:5), `@${S.u} 사과 수용`);
  if(S.apoKind==="poor") socialFill(SOC.apoPoorAccept, 2, 0, {t:t.short, u:S.u});
  G.press.rel=clamp(G.press.rel+3, 0, 100);
  addNews(`🤝 ${t.name} 감독, @${S.u}의 사과를 받아들이고 소송 취하 — "축구로 돌아가겠다"`, "good", "club");
  socialFill(SOC.sueMercy, 4+R(2), 1, v);
  fmkFill(FMK.sueMercy, 2+R(2), v);
  st.chill=Math.max(st.chill||0, 2);
  saveGame(); show("media");
}
function sueRejectApology(){
  const S=G.suit; if(!S || S.stage!=="apology") return;
  S.stage="filed";
  S.due=Math.max(S.due, (G.day||0)+3);
  const v={t:userTeam().short, u:S.u};
  adjustTrust("fans", S.troll?0:-3, `@${S.u} 사과 거부`);
  addNews(`⚖️ ${userTeam().short} 감독 측 "사과로 끝날 일이 아니다" — @${S.u} 소송 계속`, "warn", "club");
  socialFill(S.troll?SOC.sueNoMercyTroll:SOC.sueNoMercy, 3+R(2), S.troll?0:-1, v);
  saveGame(); show("media");
}
/* ── 철회 ── */
function sueWithdraw(){
  const S=G.suit; if(!S) return;
  const t=userTeam();
  showConfirm(`<b>🕊️ 소송을 철회하시겠습니까?</b>\n\n@${S.u} 상대 소송을 여기서 접습니다.\n이미 낸 선임비는 돌아오지 않습니다.\n\n<span class="small">${S.troll?"상주 악플러를 놓아주면 팬들이 아쉬워합니다.":"관용으로 읽히면 이미지가 오히려 좋아질 수 있습니다."}</span>`,
    ()=>{
      G.suit=null;
      const v={t:t.short, u:S.u};
      if(S.troll){ adjustTrust("fans", -2, "악플러 소송 철회"); socialFill(SOC.sueDropTroll, 3+R(2), -1, v); }
      else { adjustTrust("fans", 2, "소송 철회"); G.press.rel=clamp(G.press.rel+2,0,100); socialFill(SOC.sueDrop, 3+R(2), 0, v); }
      fmkFill(FMK.sueDrop, 2, v);
      addNews(`🕊️ ${t.name} 감독, @${S.u} 상대 소송 철회`, null, "club");
      saveGame(); show("media");
    }, {okLabel:"철회한다", cancelLabel:"계속 간다"});
}
/* ── 판결 ── */
function sueVerdict(){
  const S=G.suit; if(!S) return;
  const t=userTeam(), st=sueState();
  G.suit=null;
  const win=Math.random()<S.ch;
  const mine=S.sd!=="r";
  const v={t:t.short, u:S.u, n:st.n};
  const k = 1 + (st.n-1)*0.45;
  const firm=SUE_FIRMS.find(f=>f.k===S.firm)||SUE_FIRMS[1];
  if(win){
    st.win++;
    const back=Math.round((2.2 + S.harsh*0.9 + Math.random()*1.8 + (S.events.length*0.5))*10)/10;
    mePay(back, `${S.u} 소송 합의금`);
    if(S.troll){
      adjustTrust("fans", 6, `${S.u} 고소 (승소)`);
      adjustTrust("owner", 3, "상습 악성 게시자 대응 승소");
      socialFill(SOC.sueTroll, 4+R(3), 1, v);
      fmkFill(FMK.sueTroll, 3+R(3), v);
    } else {
      adjustTrust("fans", -(mine?6:2)*k, `${S.u} 고소 (승소)`);
      adjustTrust("owner", 2, "법적 대응 승소");
      G.press.rel=clamp(G.press.rel-4*k, 0, 100);
      socialFill(mine?SOC.sueWinMine:SOC.sueWinRiv, 3+R(2), mine?-1:0, v);
      fmkFill(FMK.sueWin, 3+R(3), v);
      rivalFill(RIV.sue, 3+R(2), 0, v); rivalFmk(FRIV.sue, 2+R(3), v);
    }
    addNews(S.troll
      ? `⚖️ ${t.name} 감독, 상습 악성 게시자 <b>@${S.u}</b> 상대 소송 승소 — 합의금 ${back}억. 커뮤니티가 환호했습니다.`
      : `⚖️ ${t.name} 감독, <b>@${S.u}</b> 상대 명예훼손 소송 승소 — 합의금 ${back}억.`, "good", "club");
    st.chill=Math.max(st.chill, 3+R(3));
    if(S.troll){ st.chill+=2; st.trollBack=(G.day||0)+4+R(5); }   // 상주 악플러는 더 오래 숨었다가, 부계정으로 돌아온다
    /* 고소당한 글 내리기 — 그 사람 명의의 글을 소셜·펨코 양쪽에서 정리한다 */
    G.social=(G.social||[]).filter(q=>!(q.u===S.u && q.tone<0));
    G.fmk=(G.fmk||[]).filter(q=>!(q.u===S.u && q.tone<0));
    /* 판결문은 배너 한 줄로 지나가면 안 된다 — 전문을 팝업으로 확인한다 */
    showConfirm(`<b style="color:var(--green);font-size:17px">⚖️ 승소했습니다</b>\n\n`+
      `<div class="msg info" style="margin:8px 0">사건: @${S.u}의 게시물\n"${(S.txt||"").slice(0,60)}${(S.txt||"").length>60?"…":""}"</div>`+
      `· 판결: <b style="color:var(--green)">원고 승소</b> — 게시물 삭제 및 손해배상 인정\n`+
      `· 합의금: <b class="money">${back}억</b> 수령 <span class="small">(보유 ${me().cash.toFixed(2)}억)</span>\n`+
      `· 변호: ${firm.ic} ${firm.n}${S.events.length?`\n· 소송 중 도발 ${S.events.length}회가 증거로 인정되어 배상액이 늘었습니다`:""}\n\n`+
      (S.troll
        ? `<span style="color:var(--green)">상습 악플러를 잡았습니다. 커뮤니티가 환호하고 있습니다.</span>`
        : `<span class="small">한동안 커뮤니티가 눈치를 봅니다(${st.chill}라운드). 다만 팬 신뢰와 언론 관계는 깎였습니다 — 이긴 소송에도 대가는 있습니다.</span>`),
      ()=>show("media"), {okLabel:"확인", cancelLabel:""});
  } else {
    st.lose++;
    const cost=Math.round(0.5*10)/10;
    mgrFine(cost, `${S.u} 소송 패소 (상대 소송비)`);
    adjustTrust("fans", -(mine?11:6)*k, `${S.u} 고소 (패소)`);
    adjustTrust("owner", -4*k, "법적 대응 패소");
    G.press.rel=clamp(G.press.rel-8*k, 0, 100);
    t.morale=clamp(t.morale-2,40,99);
    st.chill=0; st.embold=Math.max(st.embold||0, 4+R(3));   // 눈치 볼 이유가 사라졌다 — 며칠간 더 날뛴다
    socialFill(SOC.sueLose, 4+R(3), -1, v);
    fmkFill(FMK.sueLose, 4+R(3), v);
    rivalFill(RIV.sue, 3+R(3), 0, v); rivalFmk(FRIV.sue, 3+R(3), v);
    addNews(`⚖️ ${t.name} 감독이 제기한 소송, <b>기각</b> — 표현의 자유 범위 내라는 판단. (${firm.n})`, "warn", "club");
    showConfirm(`<b style="color:var(--red);font-size:17px">⚖️ 기각당했습니다</b>\n\n`+
      `<div class="msg warn" style="margin:8px 0">사건: @${S.u}의 게시물\n"${(S.txt||"").slice(0,60)}${(S.txt||"").length>60?"…":""}"</div>`+
      `· 판결: <b style="color:var(--red)">기각</b> — "표현의 자유 범위 내"라는 판단\n`+
      `· 상대 소송비 <b>${cost}억</b>을 물어 줬습니다 <span class="small">(보유 ${me().cash.toFixed(2)}억)</span>\n`+
      `· 변호: ${firm.ic} ${firm.n}\n\n`+
      `<span class="small">커뮤니티가 물 만났습니다. 팬 신뢰와 언론 관계가 크게 상했고, 라커룸 분위기도 가라앉았습니다.</span>`,
      ()=>show("media"), {okLabel:"확인", cancelLabel:""});
  }
  saveGame();
}
/* ── 진행 중 소송 카드 (뉴스/소셜 탭 상단) ── */
function suitCard(){
  const S=G.suit; if(!S) return "";
  const firm=SUE_FIRMS.find(f=>f.k===S.firm)||SUE_FIRMS[1];
  const left=Math.max(0, S.due-(G.day||0));
  return `<div class="card" style="border-color:var(--gold)">
    <h3>⚖️ 진행 중인 소송 <span class="small">— ${firm.ic} ${firm.n} · 판결까지 약 D-${left}</span></h3>
    <div class="msg ${S.tone<0?"warn":"info"}" style="margin:6px 0">@${S.u}${S.troll?' <span class="tag inj">상주 악플러</span>':""}<br>"${S.txt}"</div>
    <p class="small">승소 전망 <b style="color:${S.ch>=0.6?"var(--green)":S.ch>=0.35?"var(--gold)":"var(--red)"}">${Math.round(S.ch*100)}%</b>
      ${S.events.length?` · 소송 중 도발 ${S.events.length}회 <span class="small">(증거로 쌓였습니다)</span>`:""}</p>
    ${S.stage==="apology"?`<div class="msg good" style="border-width:2px">📩 <b>@${S.u}이(가) 사과문을 올렸습니다.</b></div>
      ${S.apoTxt?`<div class="msg info" style="margin:6px 0;white-space:pre-line">"${S.apoTxt}"</div>`:""}
      <p class="small">받아들이면 소송은 여기서 끝납니다 — 합의금은 없지만 훈훈하게 마무리됩니다.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="mini" style="border-color:var(--green);color:var(--green)" onclick="sueAcceptApology()">🤝 사과를 받아들인다</button>
        <button class="mini" style="border-color:var(--red);color:#ff9d95" onclick="sueRejectApology()">⚖️ 그래도 끝까지 간다</button>
      </div>`
    :`<div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="mini" onclick="sueWithdraw()">🕊️ 소송 철회</button>
      </div>`}
  </div>`;
}
/* 진영 필터 — sd 가 없는 옛 게시물은 우리 팬 글로 본다 */
function sideOf(x){ return x && x.sd==="r" ? "r" : "o"; }
function socListOf(side){ return (G.social||[]).filter(x=>sideOf(x)===side); }
function fmkListOf(side){ return (G.fmk||[]).filter(x=>sideOf(x)===side); }
function fmkCard(side, n){
  const list=fmkListOf(side||"o").slice(0, n||12);
  const rival = side==="r";
  return `<div class="card"><h3>🔥 FM코리아 ${G.jobless?`<span class="sideTag own">팬 반응</span>`:rival?`<span class="sideTag riv">타구단 팬</span>`:`<span class="sideTag own">우리 구단 팬</span>`}
    <span class="small">— 축구 커뮤니티 (수위 주의)</span></h3>
  ${list.length?`<div class="fmkList">${list.map(x=>`
    <div class="fmkRow ${x.tone>0?"pos":x.tone<0?"neg":""}">
      <div class="fmkTitle">${x.txt}</div>
      <div class="fmkMeta"><img class="fmkRk" src="${FMK_RANK[fmkRankOf(x)]}" alt="${FMK_RANK_N[fmkRankOf(x)]}" title="${FMK_RANK_N[fmkRankOf(x)]}">${G.jobless
        ? `<span class="rumNick" title="소속 구단이 없어 고소할 수 없습니다">${x.u}</span>`
        : `<span class="sueName" title="닉네임을 눌러 이 글을 고소할 수 있습니다" onclick="openSue('fmk','${feedId(x)}')">${x.u}</span>`}<span class="fmkDate">${feedDate(x)}</span>
        <span>조회 ${x.v}</span>
        <span class="fmkUp">▲${x.up}</span><span class="fmkDn">▼${x.dn}</span></div>
    </div>`).join("")}</div>`
   :`<p class="small">아직 올라온 글이 없습니다.</p>`}
  </div>`;
}
/* 여론 온도 — 우리 팬은 "우리 팀에 대한 감정", 타팬은 "우리를 보는 시선"으로 라벨이 다르다 */
function socialMood(list, rival){
  const r=list.slice(0,20);
  if(!r.length) return {t:"조용함", c:"var(--sub)"};
  const sum=r.reduce((s,x)=>s+(x.tone||0),0)/r.length;
  if(rival) return sum>=0.45?{t:"부러움",c:"var(--green)"}:sum>=0.1?{t:"인정",c:"var(--green)"}
         : sum>-0.1?{t:"관망",c:"var(--gold)"}:sum>-0.45?{t:"비웃음",c:"var(--red)"}:{t:"조롱",c:"var(--red)"};
  return sum>=0.45?{t:"열광",c:"var(--green)"}:sum>=0.1?{t:"긍정적",c:"var(--green)"}
       : sum>-0.1?{t:"반반",c:"var(--gold)"}:sum>-0.45?{t:"불만",c:"var(--red)"}:{t:"분노",c:"var(--red)"};
}
function socialCard(side, n){
  const rival = side==="r";
  const all=socListOf(rival?"r":"o");
  const list=all.slice(0, n||14);
  const mood=socialMood(all, rival);
  return `<div class="card"><h3>💬 소셜미디어 ${G.jobless?`<span class="sideTag own">팬 반응</span>`:rival?`<span class="sideTag riv">타구단 팬</span>`:`<span class="sideTag own">우리 구단 팬</span>`}
    <span class="small">— ${rival?"우리를 보는 시선":"팬 여론"}: <b style="color:${mood.c}">${mood.t}</b></span></h3>
  ${list.length?`<div class="socFeed">${list.map(x=>`
    <div class="socPost ${x.tone>0?"pos":x.tone<0?"neg":""}${rival?" riv":""}">
      <div class="socHead"><span class="socAv">${x.e}</span>${G.jobless
        ? `<b class="rumNick" title="소속 구단이 없어 고소할 수 없습니다">@${x.u}</b>`
        : `<b class="sueName" title="닉네임을 눌러 이 글을 고소할 수 있습니다" onclick="openSue('soc','${feedId(x)}')">@${x.u}</b>`}
        <span class="small">${feedDate(x)}</span></div>
      <div class="socTxt">${x.txt}</div>
    </div>`).join("")}</div>`
   :`<p class="small">${rival?"아직 다른 구단 팬들이 우리 이야기를 하지 않습니다. 경기를 치르면 옆 동네가 시끄러워집니다."
                            :"아직 올라온 반응이 없습니다. 경기를 치르거나 영입을 하면 팬들이 떠들기 시작합니다."}</p>`}
  </div>`;
}
function newsCard(){
  const list=G.news.filter(n=>n.cat!=="mood").slice(0,8);
  return `<div class="card"><h3>🏷️ 구단 소식 <span class="small">— 이적 · 영입 · FA · 계약</span>
    <button class="mini" style="float:right" onclick="show('media')">📰 뉴스 / 소셜 전체보기</button></h3>
  ${list.map(n=>`<div style="padding:3px 0;border-bottom:1px solid #21262d">${n.txt}</div>`).join("")||"뉴스가 없습니다."}</div>`;
}

