"use strict";
/* ---------- 경기 전 라인업 미리보기 (기자회견 전에 양팀 포메이션 확인) ---------- */
/* ═══════════════════════════════════════════════════════════════
   경기 전 전술판 (FM의 킥오프 직전 팀 셋업)
   진행 → [전술판: 선발·포메이션 확정] → 선발 라인업 → 기자회견 → 라커룸 → 킥오프
   전술판에서 선발을 바꿀 수 있어야 하므로, 확정하는 순간 매치 데이터를 새로 만든다.
   (advance() 가 미리 만들어 둔 M 은 옛 라인업이라 그대로 쓰면 바꾼 게 반영되지 않는다)
═══════════════════════════════════════════════════════════════ */
let inPreTactics=false;
let preTacAway=false;   // ⚽ 킥오프 준비 화면을 떠나 다른 탭을 보고 있는 중인가
function showPreMatchTactics(M, tag){
  pendingLiveM=M; pendingLiveTag=tag;
  inPreTactics=true; inLineupPreview=false; inLiveTactics=false;
  selSwap=null; tacBaseline();
  /* 좌측 진행 버튼이 이 화면의 「선발 확정」 역할을 한다 (사용자 요청) */
  { const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.classList.remove("navLocked"); _a.textContent="✅ 선발 확정 ▶"; } }
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  renderPreMatchTactics();
}
function renderPreMatchTactics(){
  const M=pendingLiveM; if(!M){ inPreTactics=false; return; }
  /* 🟥 제보 — 「경기 당일 선발 명단을 눌렀는데도 출장정지가 안 풀린다」.
     이 화면은 show() 를 거치지 않고 직접 그려진다 — 여기서도 문맥을 새로 잡는다.
     대회가 다르면(친선 포함) 그 정지는 이 경기와 무관하다. */
  try{
    if(M.opts && M.opts.friendly){ BAN_CTX="friendly"; }
    else banCtxSync();
  }catch(e){}
  const t=userTeam();
  const fx=flashHtml();
  const opp = M.home.isUser ? M.away : M.home;
  const home = M.home.isUser;
  $("#main").innerHTML=fx+`
  <div class="msg info" style="font-size:15px;border-width:2px">
    ⚽ <b>${pendingLiveTag||`${divName(t.div)} ${(t.div===1?G.r1:G.r2)+1}라운드`}</b> —
    ${home?"홈":"원정"} <b>${opp.name}</b>전 · ${G.cal?dateLabel(G.day):""}<br>
    <span class="small">킥오프 전 마지막 점검입니다. 선발·포메이션·세부 전술을 확정하고 아래 버튼을 누르세요.</span>
  </div>
  <div class="tacTopBar" style="margin-bottom:10px">
    <div class="small">상대 <b>${opp.short}</b> — ${styleName(opp)} · 전력 ${teamStars(opp, opp.short)}</div>
    <span class="msg info" style="margin:0;padding:9px 14px">👈 왼쪽 메뉴 하단 <b>선발 확정</b> 버튼으로 진행합니다</span>
  </div>
  ${tactics()}`;
}
function confirmPreMatchTactics(){
  const M=pendingLiveM, tag=pendingLiveTag;
  if(!M) { inPreTactics=false; return; }
  inPreTactics=false;
  saveGame(); tacBaseline();
  // 전술판에서 선발을 바꿨을 수 있으므로 매치 데이터를 다시 만든다
  const fresh=createMatch(M.home, M.away, M.opts||{});   // opts(승강PO 등)는 그대로 물려준다
  showLineupPreview(fresh, tag);
}
function showLineupPreview(M, tag){
  { const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.classList.remove("navLocked");
      _a.textContent=(M&&M.opts&&M.opts.friendly)?"🚪 라커룸으로 ▶":"📰 기자회견으로 ▶"; } }
  pendingLiveM=M; pendingLiveTag=tag;
  inLineupPreview=true;
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  $("#main").innerHTML = lineupPreviewLayout(M, tag);
}
/* ═══════════════════════════════════════════════════════════════
   선발 라인업 팬 반응 — 킥오프 직전, 양 팀 팬이 명단을 보고 떠드는 소리.
   조건(에이스 선발 / 유망주 / 노장 / 폼 / 벤치 / 장신 / 외국인 …)에 맞는 풀에서만 뽑으므로
   "누구 얘기인지"가 항상 맞다. 우리 팬(sd:"o")과 상대 팬(sd:"r")은 같은 명단을 보고
   정반대로 반응한다 — 우리 팬이 자랑하는 선수를 상대 팬은 경계한다.
   ⚠ 조사는 반드시 마커(이/가, 은/는 …)를 쓸 것. 하드코딩하면 "울산는"이 나온다.
═══════════════════════════════════════════════════════════════ */
const LU_OURS={
  ace:["{p} 선발, 이게 얼마나 무서운지 사람들은 모름",
    "{p} 나온다 오늘 경기 끝났네",
    "{p}만 있으면 어디든 이긴다 진심으로",
    "{p} 이름 석 자 보고 티켓 끊었습니다",
    "{p} 선발 확인하고 소리 질렀다 ㅋㅋㅋㅋ",
    "오늘 {p} 폼이면 상대 수비 세 명 붙여도 못 막음",
    "{p}은/는 우리 팀 훈장입니다 진짜",
    "{p} 나오는 날은 그냥 마음이 편해",
    "타팀 팬들 오늘 {p} 처음 보면 놀랄 듯",
    "크악 {p}이/가 선발이라니 기어코 딸딸이를 부르는구나 오냐 덤벼라 딸딸딸딸딸딸딸"],
  young:["{p}은/는 경험치 잘먹네",
    "{p} 또 선발이야? 얘 크는 거 실시간으로 보는 중",
    "{p} 나이 생각하면 이 정도면 미친 거 아님?",
    "{p} 지금부터 굴려야 3년 뒤에 우리가 웃는다",
    "{p} 실수해도 괜찮아 어차피 우리 미래야",
    "{p} 유스 때부터 봤는데 여기까지 왔다 눈물 남",
    "{p} 몸값 올라가는 소리가 들린다",
    "{p} 선발이면 오늘은 그냥 성장일지 보는 날"],
  veteran:["{p} 아직도 뛰네 ㅋㅋ 근데 왜 안 밀림?",
    "{p} 클래스는 영원하다",
    "{p} 90분은 무리인데... 60분만 뛰어도 감사",
    "{p} 저 나이에 저 위치 서는 거 자체가 대단한 거임",
    "{p} 은퇴하면 나 축구 안 볼 거임",
    "{p} 다리는 늙었어도 머리는 그대로다",
    "{p}, 오늘도 후배들 정리해 주세요"],
  hot:["저는 동성애자가 아니지만 {p} 선수와 함께 숲속 통나무 집에서 살고 싶습니다.",
    "{p} 요즘 폼 미쳤다 진짜 손 못 대겠음",
    "{p} 평점 보고 왔는데 이게 우리 선수가 맞나",
    "{p} 지금 리그 최고 아님? 아 내 눈에만 그런가",
    "{p} 계약 연장 언제 합니까 구단아 제발",
    "{p} 요즘 경기 보려고 퇴근 시간 조정했다",
    "{p} 이번 시즌 끝나면 못 잡을 것 같아서 무섭다",
    "{p}, 우리 팀에 있어 줘서 고맙습니다 진심으로",
    "크악 {p}이/가 선발이라니 기어코 딸딸이를 부르는구나 오냐 덤벼라 딸딸딸딸딸딸딸"],
  cold:["{p}은/는 아직도 선발이네...",
    "{p} 폼 안 올라오는데 계속 쓰는 이유가 뭘까",
    "{p} 오늘은 좀 살아나자 제발 부탁이야",
    "{p} 잘하는 거 아는데 요즘은 진짜 아니잖아",
    "{p} 자신감 문제 같은데 한 골이면 풀릴 듯",
    "{p} 내려도 될 것 같은데 감독님 생각이 있겠지",
    "{p} 오늘까지만 본다 진짜로"],
  scorer:["{p} 오늘도 한 방 부탁해",
    "{p} 득점왕 가자 진짜 가능성 있다",
    "{p} 골 냄새 맡는 건 타고났음",
    "{p} 박스 안에서만큼은 리그 최고",
    "{p} 오늘 넣으면 몇 골째냐 세다가 까먹었다"],
  debut:["{p} 데뷔전이다!! 다들 조용히 해",
    "{p} 첫 선발이네 긴장하지 말고 하던 대로만",
    "{p} 오늘 데뷔전인데 이 경기에서? 감독님 배짱 좋으시네",
    "{p} 데뷔전 기록해 두자 나중에 자랑하게"],
  foreign:["{p} 이번 영입은 진짜 물건 맞다",
    "{p} 적응 다 한 듯 몸놀림이 다르다",
    "{p} 통역 없이도 소통되는 거 같던데",
    "{p} 몸값 생각하면 이 정도는 해줘야지",
    "{p} K리그 오래 있어 줬으면 좋겠다"],
  lowCond:["{p} 컨디션 안 좋아 보이는데 괜찮나",
    "{p} 저 몸 상태로 선발? 후반에 다리 풀릴 텐데",
    "{p} 무리시키지 마세요 시즌 깁니다",
    "{p} 오늘 60분만 뛰게 해주세요 감독님"],
  tall:["{p} 세트피스 때만 기다린다",
    "{p} 저 키는 반칙이지 코너킥 다 우리 거",
    "{p} 공중볼 경합 지는 거 본 적이 없음"],
  fast:["{p} 뒷공간 한 번만 열리면 바로 끝난다",
    "{p} 상대 수비 오늘 러닝머신 타는 날",
    "{p} 속도로만 먹고 사는 선수 아닌데 속도도 리그 최고"],
  benched:["{p}은/는 벤치네..",
    "{p} 왜 빠졌지? 뭔 일 있나",
    "{p} 벤치라니 이건 좀 아쉽다 진심",
    "{p} 후반 조커로 쓰려는 그림인가",
    "{p} 벤치 보고 김샜다 솔직히",
    "{p} 로테이션이겠지... 그렇겠지?"],
  gk:["{p} 뒤에 있으면 든든하다",
    "{p} 오늘 선방 하나만 해주면 이긴다",
    "{p} 발밑 불안한 건 좀 고쳐 주세요"],
  team:["오늘 라인업 밸런스 좋다 이러면 해볼 만해",
    "{o}전은 늘 어렵다 방심하지 말자",
    "이 명단으로 지면 할 말 없는 거다",
    "{t} 오늘 무조건 이긴다 나는 믿는다",
    "명단 보니까 감독님 이기려고 나오셨네",
    "오늘 {o} 상대로 이 정도면 충분하지",
    "제발 오늘은 실점부터 하지 말자"]
};
const LU_RIVAL={
  theirAce:["{p} 나오네... 오늘 우리 수비 고생하겠다",
    "{p}만 지우면 이긴다 그게 어렵지",
    "{p} 그냥 반칙으로라도 막아야 함",
    "{p} 저 선수 우리 팀에 있었으면 좋겠다 솔직히",
    "{p} 나온다고? 아 오늘 마음 비운다",
    "{p} 볼 때마다 느끼는데 체급이 다르다",
    "{p} 오늘 컨디션 안 좋기를 기도하는 중",
    "우리 풀백 혼자서 {p} 막으라고? 두 명 붙여야지"],
  theirYoung:["{p} 쟤 어리던데 벌써 선발이야?",
    "{p} 신인이라고 얕보면 큰코다칠 듯",
    "{p} 오늘 우리한테 경험치 헌납받겠네",
    "{p} 어린 선수 상대로는 압박 세게 가야지"],
  theirCold:["{p} 요즘 폼 바닥이던데 나온다니 다행이다",
    "{p} 오늘도 부진하기를",
    "{p} 저 선수 왜 계속 쓰는지 모르겠음 (우리한텐 좋고)",
    "{p} 나오면 그쪽 측면은 뚫린 거나 마찬가지"],
  theirBench:["{p} 벤치네? 오늘 해볼 만하다",
    "{p} 안 나온다 이건 호재다 진짜",
    "{p} 빠진 거 확인하고 맥주 꺼냈다",
    "{p} 후반에 나올 텐데 그때가 진짜 고비"],
  /* 🆕 상대 팬 관점 확장 — 우리 팬 쪽은 13갈래인데 여기는 9갈래라 반응 수가 늘 모자랐다.
     ① 상대 팀(=우리) 명단을 보는 각도를 늘리고 ② 자기 팀 선수 얘기도 하게 만든다.
     실제 타팀 팬은 남의 명단만 보지 않는다 — 자기 팀 키퍼 걱정을 더 많이 한다. */
  theirVeteran:["{p} 아직도 뛰네 저 나이에",
    "{p} 느려진 거 다 보인다 그쪽으로 파고들자",
    "{p} 노련해서 우리 어린 선수들 다 속을 듯 조심",
    "{p} 은퇴 전에 한 번은 이겨 보고 싶었다"],
  theirForeign:["{p} 저 외국인 물건이던데",
    "{p} 몸값 얼마였지? 그 돈 값은 하는 듯",
    "{p} K리그 적응 끝난 것 같아서 무섭다",
    "{p} 우리도 저런 외국인 좀 데려와라 프런트야"],
  theirDebut:["{p} 데뷔전이라는데 우리한테? 만만하게 봤나",
    "{p} 첫 경기부터 험한 꼴 보게 해주자",
    "{p} 데뷔전 상대가 우리라니 운도 없다"],
  theirLowCond:["{p} 몸 상태 안 좋다던데 그대로 나오네 ㅋㅋ 호재다",
    "{p} 저 컨디션으로 90분? 후반에 무너진다",
    "{p} 무리해서 나온 티가 난다 그쪽 집중 공략"],
  theirGK:["{p} 저 키퍼 요즘 안정적이라 걱정이다",
    "{p} 발밑 약한 거 알고 있다 전방 압박 걸자",
    "{p}만 넘으면 되는데 그게 제일 어렵지"],
  theirHot:["{p} 요즘 폼 미쳤던데 하필 오늘 만나네",
    "{p} 최근 경기 다 봤는데 진짜 답이 없다",
    "{p} 오늘만 좀 쉬어 가면 안 되나"],
  /* 자기 팀 얘기 — 상대 팬도 결국 자기 팀이 제일 걱정이다 */
  ourYoung:["우리 {p} 오늘 큰 경기 데뷔인데 잘 버텨라",
    "{p} 이런 경기에서 크는 거지",
    "{p} 얘 오늘 잘하면 진짜 물건이다"],
  ourGK:["{p} 오늘 하나만 막아주면 된다 진짜",
    "{p} 제발 오늘은 실수 없이",
    "{p} 뒤에 있으니까 그나마 마음이 놓인다"],
  ourVeteran:["{p} 형이 오늘 뒤를 잡아줘야 한다",
    "{p} 아직 안 죽었다는 거 보여주자"],
  ourForm:["우리도 요즘 폼 나쁘지 않다 해볼 만해",
    "지난 경기 보고 기대치 좀 올렸다",
    "솔직히 오늘 지면 좀 그렇지 않냐"],
  theirTall:["{p} 저 키... 세트피스 때 조심해야 함",
    "{p} 공중볼은 그냥 포기하고 세컨볼 노리자",
    "{p} 우리 센터백보다 머리 하나 크네"],
  theirFast:["{p} 발 빠른 거 알고 있다 라인 내려야 함",
    "{p}한테 뒷공간 주면 그날로 끝",
    "{p} 상대로 하이라인? 그건 자살이지"],
  ourAce:["우리도 {p} 있다 쫄 거 없음",
    "{p} 오늘 한 방만 터뜨려 주라",
    "{p} 믿고 간다 오늘도",
    "{p} 이런 경기에서 해줘야 진짜 에이스지"],
  ourWorry:["우리 라인업 이거 맞아? 왜 이렇게 불안하지",
    "이 명단으로 원정 가면 답 없는데",
    "감독 또 실험하네 오늘은 좀 진지하게 하자",
    "선발 보고 채널 돌릴 뻔했다"],
  team:["{t} 이번엔 진짜 각오하고 나오네",
    "{t} 상대로 승점 하나만 챙겨도 성공이다",
    "솔직히 오늘 {t} 이길 자신 없다",
    "{t} 요즘 잘나가던데 오늘 발목 좀 잡자",
    "{t} 명단 보니까 우리 무시하는 거 아님?",
    "무승부만 해도 만족한다 진짜로"]
};
/* ── 프리시즌 전용 ─────────────────────────────────────────────────
   연습경기 팬은 승부를 안 본다. 몸 상태, 새 얼굴, 유망주, 다치지 않기 — 관심사가 통째로 다르다.
   시즌 중 문구를 그대로 쓰면 "이 명단으로 지면 할 말 없다" 같은 말이 연습경기에 붙는다. */
const LU_PRE={
  ace:["{p} 연습경기까지 나오네 몸 만드는 거 진심이다",
    "{p} 오늘은 30분만 뛰고 들어가라 제발",
    "{p} 프리시즌부터 저러면 시즌은 어쩌려고",
    "{p} 다치지만 마라 그거면 된다",
    "{p} 발끝 감각 벌써 올라온 듯"],
  young:["{p} 프리시즌은 유망주 보는 맛이지",
    "{p} 오늘 45분은 줘야 뭘 보든가 하지",
    "{p} 여기서 눈도장 찍으면 시즌 내내 기회 온다",
    "{p} 실수해도 박수 쳐주자 연습경기잖아",
    "{p} 작년보다 몸이 확실히 커졌다"],
  veteran:["{p} 프리시즌엔 좀 쉬게 해드리자",
    "{p} 어차피 시즌 들어가면 다 아는 선수인데",
    "{p} 몸 만드는 속도가 예전 같지 않네 걱정된다"],
  foreign:["{p} 첫 실전이다 어떤 선수인지 좀 보자",
    "{p} 영상만 봤는데 오늘 직접 보니 다르네",
    "{p} 적응 기간 필요할 듯 조급해하지 말자",
    "{p} 이 선수 데려온 스카우트 누구야 칭찬해"],
  debut:["{p} 첫 출전이네 프리시즌이라 다행이다",
    "{p} 오늘 데뷔전인데 긴장 풀고 하던 대로"],
  tall:["{p} 저 체격 시즌 들어가면 세트피스 무기 되겠다"],
  fast:["{p} 발은 확실히 빠르다 나머지는 시즌에 보자"],
  benched:["{p}은/는 오늘 쉬는구나 잘한 결정",
    "{p} 프리시즌에 무리시킬 이유가 없지",
    "{p} 벤치인데 오히려 안심된다"],
  lowCond:["{p} 아직 몸이 안 올라왔네 시간 필요할 듯",
    "{p} 프리시즌인데 벌써 지쳐 보이는 건 좀"],
  team:["연습경기 결과는 신경 안 쓴다 부상만 없으면 된다",
    "포메이션 실험하는 거 보니 감독님 생각이 있으시네",
    "이겨도 져도 상관없다 다들 다치지만 마라",
    "프리시즌 성적으로 호들갑 떠는 거 제일 웃김",
    "새 얼굴들 손발 맞는지만 보면 된다",
    "{o}전이지만 오늘은 결과보다 내용",
    "슬슬 시즌 시작이구나 설렌다 진짜"]
};
/* 🆕 프리시즌 상대 팬 — 예전에는 갈래가 «둘»뿐이라(우리 팬은 열둘) 반응 수가 7:4 로 벌어졌다.
   프리시즌의 타팀 팬은 「정찰」하러 온다 — 남의 영입·유망주·노장을 자기 팀과 견주는 게 본업이다. */
const LU_PRE_R={
  theirAce:["{p} 연습경기에 저 선수를 왜 쓰지",
    "{p} 몸 상태 미리 보는 것도 나쁘지 않네",
    "{p} 시즌 들어가면 우리도 만나야 하는데 벌써 머리 아프다",
    "{p} 벌써 저 정도 몸이면 개막 때는 어떡하라고",
    "{p} 저 선수만 없으면 {t}은/는 그냥 중위권인데"],
  theirYoung:["{p} 쟤 누구냐 처음 보는데 좋아 보인다",
    "{p} {t} 유스에서 또 하나 나왔네 부럽다 진짜",
    "{p} 이름 적어 뒀다 나중에 우리가 데려오자"],
  theirForeign:["{p} 새 외국인이라던데 어떤가 보러 왔다",
    "{p} 이번 영입 성공이면 {t} 골치 아파진다",
    "{p} 몸값 들었는데 그 돈이면 우리는 셋 데려온다"],
  theirVeteran:["{p} 아직도 뛰네 프리시즌부터 무리하는 거 아님?",
    "{p} 저 나이에 연습경기 풀타임? 관리 좀 해줘라"],
  theirDebut:["{p} 처음 보는 이름인데 유스인가",
    "{p} 프리시즌은 저런 선수 보는 재미로 본다"],
  theirNew:["{t} 이번 겨울에 돈 좀 썼네 명단이 달라졌다",
    "{t} 영입 명단 보고 왔는데 솔직히 부럽다",
    "{t} 저 정도 보강했으면 올해는 진짜 노리는 듯"],
  ourSquad:["우리 팀 프리시즌은 언제 하냐",
    "남의 팀 보다가 우리 팀 생각나서 우울해짐",
    "우리도 저런 영입 좀 해줘라 프런트야"],
  team:["연습경기라 별 의미 없다 그냥 보는 거지",
    "{t} 새 선수들 어떤지 정찰하러 왔습니다",
    "우리도 프리시즌인데 이런 거 신경 쓸 때가 아님",
    "결과 말고 조직력만 보고 가겠다",
    "{t} 전술 바뀐 것 같은데 캡처해 뒀다",
    "프리시즌 성적으로 시즌 예측하는 건 매년 틀리더라",
    "개막까지 얼마 안 남았네 슬슬 실감 난다"]
};
/* ── 시즌 국면별 ───────────────────────────────────────────────── */
const LU_CTX={
  opening:["드디어 개막이다 1년을 기다렸다",
    "개막전 선발이 시즌 주전이라고 봐도 되나?",
    "올해는 진짜 다르다 나는 믿는다",
    "개막전만큼은 무조건 잡고 시작하자",
    "작년 생각하면 아직도 화가 난다 올해는 갚아주자",
    "새 시즌 첫 경기, 심장이 벌써 뛴다"],
  derby:["더비다. 오늘은 실력이고 뭐고 없다",
    "이 경기만큼은 무조건 이겨야 한다 순위는 나중 문제",
    "더비 지면 한 주 내내 회사에서 못 산다",
    "오늘 진 쪽이 1년 내내 놀림받는 거임",
    "더비 앞두고 이 명단이면 감독님 각오하신 듯",
    "심장 떨려서 전반전 못 보겠다"],
  title:["우승 경쟁 중이다 오늘 승점 3 필요해",
    "지금 순위 보고 왔는데 진짜 가능성 있다",
    "이런 경기에서 이겨야 우승하는 팀이지",
    "매 경기가 결승이다 오늘도 총력전 가자",
    "올해 아니면 언제 우승해보나"],
  releg:["강등권 싸움이다 오늘 무조건 잡아야 한다",
    "제발... 오늘은 승점 좀 챙기자",
    "이 명단으로 안 되면 진짜 답이 없다",
    "강등되면 이 선수들 다 나간다 생각하면 아찔하다",
    "내려가면 안 된다 그것만 생각하자",
    "감독님 오늘만큼은 안전하게 가주세요"],
  winStreak:["연승 중이다 분위기 탔을 때 계속 가자",
    "요즘 우리 팀 경기 보는 맛이 있다",
    "연승 이어가면 순위 확 올라간다",
    "이 흐름 끊기지만 말자 제발"],
  loseStreak:["연패 중인데 명단 보니까 또 불안하다",
    "오늘도 지면 진짜 감독 얘기 나올 듯",
    "선수들 표정부터 좀 살아났으면",
    "연패 끊는 게 먼저다 무승부라도 좋다"],
  finale:["시즌 막바지다 오늘 결과가 다 정한다",
    "마지막까지 왔다 후회 없이 하자",
    "이 경기 끝나면 시즌이 끝난다니 실감이 안 난다"]
};
const LU_CTX_R={
  opening:["개막전부터 {t} 만나네 운도 없지",
    "새 시즌 첫 경기, 우리도 각오 단단히 하고 왔다",
    "작년에 당한 거 올해 개막부터 갚는다"],
  derby:["더비에 안 올 수가 없지",
    "오늘만큼은 순위고 뭐고 없다 {t}만 잡으면 된다",
    "더비 앞두고 잠을 못 잤다 진짜로",
    "{t} 팬들 오늘 조용히 돌아가게 해주자"],
  title:["{t} 우승 경쟁 중이던데 오늘 발목 좀 잡아줄게",
    "상위권 팀 잡는 맛이 있지",
    "{t} 승점 떨어뜨리는 게 우리 시즌 목표다"],
  releg:["{t} 강등권이라던데 우리도 남 걱정할 때가 아니다",
    "{t} 절박한 팀이 제일 무섭다 방심하지 말자",
    "강등권 팀한테 지면 그게 진짜 망신이다"],
  winStreak:["{t} 연승 중이라던데 오늘 끊자",
    "{t} 요즘 기세 좋던데 부담되네"],
  loseStreak:["{t} 연패 중이라던데 지금이 기회다",
    "{t} 분위기 안 좋을 때 확실히 밟아야 한다"],
  finale:["시즌 마지막까지 이런 경기라니",
    "이제 다음 시즌 준비나 하자 (오늘은 이기고)"]
};
/* 조건에 맞는 선수를 찾아 반응 후보를 모으고, 겹치지 않게 뽑는다 */
function lineupFanReactions(M){
  const meH = M.home.isUser;
  const usSd = meH ? M.h : M.a, themSd = meH ? M.a : M.h;
  const us=usSd.team, them=themSd.team;
  const ours=usSd.list.map(x=>x.p), theirs=themSd.list.map(x=>x.p);
  const ourBench=(usSd.bench||[]), theirBench=(themSd.bench||[]);
  const age=p=>(G.season||2026)-(p.by||2000);
  // 에이스·세트피스·발 얘기는 필드 플레이어 기준이다. 골키퍼를 넣으면
  // "골키퍼가 세트피스 때 기다린다" 같은 문장이 나온다.
  const OF=a=>a.filter(p=>p.pos!=="GK");
  const top=a=>{ const f=OF(a); return f.length?f.slice().sort((x,y)=>y.ovr-x.ovr)[0]:null; };
  const rate=p=>(p.apps>=3?(p.seasonRating||0):0);
  const V=p=>({p:p?p.name:"", t:us.short, o:them.short});
  const cand=[];
  const add=(side,pool,p)=>{ if(pool&&pool.length&&(p||pool===LU_OURS.team||pool===LU_RIVAL.team||pool===LU_RIVAL.ourWorry)) cand.push({side,pool,v:V(p)}); };
  const one=(arr,f)=>{ const hit=arr.filter(f); return hit.length?pick(hit):null; };

  /* ── 지금이 어떤 경기인가. 프리시즌·개막·더비·우승 경쟁·강등 싸움은 팬들이 보는 것 자체가 다르다. */
  const pre = !!(M.opts && M.opts.friendly) || G.phase==="pre";
  let ctx=null, ctxR=null;
  if(!pre){
    const div=us.div||1;
    const tbl=(typeof tableOf==="function") ? tableOf(div) : [];
    const rank=tbl.findIndex(x=>x.id===us.id)+1;
    const rnd=(div===1?(G.r1||0):(G.r2||0));
    const total=(div===1?(G.k1Fix||[]).length:(G.k2Fix||[]).length)||33;
    const prog=rnd/Math.max(1,total);
    const f3=(us.form||[]).slice(-3).join("");
    /* 더비는 순위 상황과 별개로 늘 얹는다 — 강등권 더비면 두 얘기가 같이 나와야 진짜다.
       나머지 국면(개막·막판·우승·강등·연승·연패)은 하나만 고른다. */
    const CX=[], CXR=[];
    if(isRival(us.id, them.id)){ CX.push(LU_CTX.derby); CXR.push(LU_CTX_R.derby); }
    if(prog<=0.06)                                        { CX.push(LU_CTX.opening);    CXR.push(LU_CTX_R.opening); }
    else if(prog>=0.92)                                   { CX.push(LU_CTX.finale);     CXR.push(LU_CTX_R.finale); }
    else if(prog>=0.5 && rank>0 && rank<=3)               { CX.push(LU_CTX.title);      CXR.push(LU_CTX_R.title); }
    else if(prog>=0.5 && rank>=tbl.length-2 && tbl.length){ CX.push(LU_CTX.releg);      CXR.push(LU_CTX_R.releg); }
    else if(f3==="WWW")                                   { CX.push(LU_CTX.winStreak);  CXR.push(LU_CTX_R.winStreak); }
    else if(f3==="LLL")                                   { CX.push(LU_CTX.loseStreak); CXR.push(LU_CTX_R.loseStreak); }
    ctx=CX; ctxR=CXR;
  }
  // ── 프리시즌이면 관심사 자체가 다르다. 시즌 기록이 없으니 폼·득점 얘기도 뺀다.
  if(pre){
    add("o", LU_PRE.ace,     top(ours));
    add("o", LU_PRE.young,   one(ours,p=>age(p)<=21));
    add("o", LU_PRE.veteran, one(ours,p=>age(p)>=34));
    add("o", LU_PRE.foreign, one(ours,p=>p.frn));
    add("o", LU_PRE.debut,   one(ours,p=>(p.career||0)<=1));
    add("o", LU_PRE.tall,    one(OF(ours),p=>(p.h||0)>=190));
    add("o", LU_PRE.fast,    one(OF(ours),p=>p.attr&&attr20(p.attr.pac)>=17));
    add("o", LU_PRE.lowCond, one(ours,p=>(p.cond||100)<=70));
    {
      const avg=ours.reduce((s,p)=>s+p.ovr,0)/Math.max(1,ours.length);
      add("o", LU_PRE.benched, one(ourBench,p=>p.ovr>=avg));
    }
    cand.push({side:"o", pool:LU_PRE.team, v:V(null)});
    cand.push({side:"o", pool:LU_PRE.team, v:V(null)});
    cand.push({side:"o", pool:LU_PRE.team, v:V(null)});
    const rv=p=>({p:p?p.name:"", t:us.short, o:them.short});
    const addPR=(pool,pp)=>{ if(pool&&pool.length&&pp) cand.push({side:"r",pool,v:rv(pp)}); };
    const ta=top(ours); if(ta) cand.push({side:"r", pool:LU_PRE_R.theirAce, v:rv(ta)});
    /* 🆕 정찰 나온 타팀 팬의 눈 — 유망주·새 외국인·노장·처음 보는 이름까지 본다 */
    addPR(LU_PRE_R.theirYoung,   one(ours,p=>age(p)<=21));
    addPR(LU_PRE_R.theirForeign, one(ours,p=>p.frn));
    addPR(LU_PRE_R.theirVeteran, one(ours,p=>age(p)>=34));
    addPR(LU_PRE_R.theirDebut,   one(ours,p=>(p.career||0)<=1));
    cand.push({side:"r", pool:LU_PRE_R.theirNew, v:rv(null)});
    cand.push({side:"r", pool:LU_PRE_R.ourSquad, v:rv(null)});
    cand.push({side:"r", pool:LU_PRE_R.team, v:rv(null)});
    cand.push({side:"r", pool:LU_PRE_R.team, v:rv(null)});
    cand.push({side:"r", pool:LU_PRE_R.team, v:rv(null)});
    cand.push({side:"r", pool:LU_PRE_R.team, v:rv(null)});
    /* 📏 프리시즌도 양쪽 개수를 맞춘다 (요청) — 예전 7:5 (제보: 「상대 구단 팬 반응도 동일한 개수로」) */
    return luDraw(cand, 8, 8);
  }
  for(const pl of (ctx||[])){ cand.push({side:"o", pool:pl, v:V(null)}); cand.push({side:"o", pool:pl, v:V(null)}); }
  for(const pl of (ctxR||[])){ cand.push({side:"r", pool:pl, v:V(null)}); }
  // ── 우리 팬이 우리 선발을 본다
  add("o", LU_OURS.ace,      top(ours));
  add("o", LU_OURS.young,    one(ours,p=>age(p)<=21));
  add("o", LU_OURS.veteran,  one(ours,p=>age(p)>=34));
  add("o", LU_OURS.hot,      one(ours,p=>rate(p)>=7.2));
  add("o", LU_OURS.cold,     one(ours,p=>rate(p)>0&&rate(p)<=6.4));
  add("o", LU_OURS.scorer,   one(OF(ours),p=>(p.goals||0)>=3));
  add("o", LU_OURS.debut,    one(ours,p=>(p.career||0)<=1&&!(p.apps>0)));
  add("o", LU_OURS.foreign,  one(ours,p=>p.frn));
  add("o", LU_OURS.lowCond,  one(ours,p=>(p.cond||100)<=70));
  add("o", LU_OURS.tall,     one(OF(ours),p=>(p.h||0)>=190));
  add("o", LU_OURS.fast,     one(OF(ours),p=>p.attr&&attr20(p.attr.pac)>=17));
  add("o", LU_OURS.gk,       one(ours,p=>p.pos==="GK"));
  // 벤치에 앉은 좋은 선수 — 선발 평균보다 나은데 앉아 있으면 팬들이 먼저 알아본다
  {
    const avg=ours.reduce((s,p)=>s+p.ovr,0)/Math.max(1,ours.length);
    add("o", LU_OURS.benched, one(ourBench,p=>p.ovr>=avg));
  }
  cand.push({side:"o", pool:LU_OURS.team, v:V(null)});
  cand.push({side:"o", pool:LU_OURS.team, v:V(null)});

  // ── 상대 팬이 같은 명단을 본다 (그들에게 "우리"는 상대다)
  const RV=p=>({p:p?p.name:"", t:us.short, o:them.short});
  const addR=(pool,p)=>{ if(pool&&pool.length&&p) cand.push({side:"r",pool,v:RV(p)}); };
  addR(LU_RIVAL.theirAce,   top(ours));
  addR(LU_RIVAL.theirYoung, one(ours,p=>age(p)<=21));
  addR(LU_RIVAL.theirCold,  one(ours,p=>rate(p)>0&&rate(p)<=6.4));
  addR(LU_RIVAL.theirTall,  one(OF(ours),p=>(p.h||0)>=190));
  addR(LU_RIVAL.theirFast,  one(OF(ours),p=>p.attr&&attr20(p.attr.pac)>=17));
  {
    const avg=ours.reduce((s,p)=>s+p.ovr,0)/Math.max(1,ours.length);
    addR(LU_RIVAL.theirBench, one(ourBench,p=>p.ovr>=avg));
  }
  addR(LU_RIVAL.theirVeteran, one(ours,p=>age(p)>=34));
  addR(LU_RIVAL.theirForeign,  one(ours,p=>p.frn));
  addR(LU_RIVAL.theirDebut,    one(ours,p=>(p.career||0)<=1&&!(p.apps>0)));
  addR(LU_RIVAL.theirLowCond,  one(ours,p=>(p.cond||100)<=70));
  addR(LU_RIVAL.theirGK,       one(ours,p=>p.pos==="GK"));
  addR(LU_RIVAL.theirHot,      one(ours,p=>rate(p)>=7.3));
  /* 자기 팀 선수 얘기 — theirs 는 상대 팬 입장에서 «우리» 선수다 */
  addR(LU_RIVAL.ourAce,      top(theirs));
  addR(LU_RIVAL.ourYoung,    one(theirs,p=>age(p)<=21));
  addR(LU_RIVAL.ourGK,       one(theirs,p=>p.pos==="GK"));
  addR(LU_RIVAL.ourVeteran,  one(theirs,p=>age(p)>=34));
  cand.push({side:"r", pool:LU_RIVAL.ourForm, v:RV(null)});
  cand.push({side:"r", pool:LU_RIVAL.ourWorry, v:RV(null)});
  cand.push({side:"r", pool:LU_RIVAL.team, v:RV(null)});

  /* 📏 양쪽 개수를 맞춘다 (요청) — 예전에는 8:7 이었고, 게다가 상대 팬 후보 갈래가
     적어서 실제로는 4:2 까지 벌어지는 경기도 있었다. 위에서 갈래를 늘렸으니 정원도 같게 준다. */
  return luDraw(cand, 8, 8);
}
/* 🔥 펨코 전용 문장 — 소셜미디어 탭에 뜨면 결이 안 맞는 줄들. 채널 배정에서 강제로 게시판에 보낸다. */
const LU_FMK_ONLY=new Set([
  "크악 {p}이/가 선발이라니 기어코 딸딸이를 부르는구나 오냐 덤벼라 딸딸딸딸딸딸딸",
  "저는 동성애자가 아니지만 {p} 선수와 함께 숲속 통나무 집에서 살고 싶습니다."
]);
/* 후보에서 실제로 뽑아 문장으로 만든다 — 같은 문장·같은 선수가 도배되지 않게 거른다 */
function luDraw(cand, nOur, nRiv){
  const seen=new Set(), nameCnt={};
  /* 📏 ⚠ 예전에는 후보를 «한 바퀴»만 돌았다. 그래서 조건에 맞는 선수가 없어 후보가 적은 쪽은
     정원을 못 채운 채 끝났다 — 상대 팬 후보 갈래가 적어 실측 7:4 까지 벌어졌다(제보).
     ─ 정원을 채울 때까지 남은 후보에서 «다른 문장»을 더 뽑는다. 같은 문장은 seen 이 막고,
       한 선수가 두 번 넘게 화제가 되는 것은 nameCnt 가 막으므로 도배는 그대로 방지된다. */
  const drawSide=(side, want)=>{
    const pool=cand.filter(x=>x.side===side), got=[];
    for(let round=0; round<3 && got.length<want; round++){
      for(const c of sampleN(pool, pool.length)){
        if(got.length>=want) break;
        // 한 선수가 한쪽 팬 사이에서 두 번까지만 화제가 되게 — 아니면 명단 전체가 한 명 얘기로 덮인다
        const nk=side+"|"+(c.v.p||"");
        if(c.v.p && (nameCnt[nk]||0)>=2) continue;
        let txt=null;
        for(const t of sampleN(c.pool, c.pool.length)){ if(!seen.has(t)){ seen.add(t); txt=t; break; } }
        if(!txt) continue;                       // 이 갈래는 쓸 문장이 바닥났다
        if(c.v.p) nameCnt[nk]=(nameCnt[nk]||0)+1;
        got.push({side, txt:F_(txt, c.v), raw:txt});
      }
    }
    return got;
  };
  const out=drawSide("o", nOur).concat(drawSide("r", nRiv));
  /* 📑 채널 분배 (요청 — 라인업 팬 반응을 「FM코리아」와 「소셜미디어」 두 탭으로 나눈다).
     같은 반응이 양쪽에 동시에 뜨면 탭을 나눈 의미가 없다 — 한 줄은 한 채널에만 간다.
     닉네임·아이콘도 채널 문법을 따른다: 소셜은 @핸들 + 이모지, 펨코는 익명 닉 + 등급 아이콘. */
  out.forEach((o,i)=>{
    /* 펨코 전용 줄은 무조건 게시판으로 — 소셜 탭에 뜨면 결이 안 맞는다 */
    o.ch = LU_FMK_ONLY.has(o.raw) ? "fmk" : ((i%2===0) ? "fmk" : "soc");
    if(o.ch==="fmk"){
      o.u = pick(o.side==="r" ? FMK_RIVAL_NICK : FMK_NICK);
      o.rk = fmkRankRoll(0);
      o.up = 3+R(180); o.dn = R(30); o.v = 60+R(1400);
    } else {
      const h = o.side==="r" ? rivalHandle() : socHandle();
      o.u=h.n; o.e=h.e;
    }
  });
  return out;
}
/* 한 팀의 팬 반응만 — 라인업 프리뷰에서 그 팀 라인업 바로 아래에 붙인다.
   (제보 — 원정 경기면 우리 라인업은 오른쪽인데 우리 팬 반응은 늘 왼쪽이라 눈이 어긋난다) */
/* 📑 탭 상태 — 팀(홈/원정)마다 따로 기억한다 */
let LU_RTAB={h:"fmk", a:"fmk"};
function setLuTab(w, ch){
  LU_RTAB[w]=ch;
  try{ if(inLineupPreview && pendingLiveM) $("#main").innerHTML=lineupPreviewLayout(pendingLiveM, pendingLiveTag); }catch(e){}
}
function lineupReactionCardFor(M, which){
  /* ⚠ 탭을 누를 때마다 다시 뽑으면 반응 내용이 매번 바뀐다 — 경기마다 한 번만 만들어 붙들어 둔다 */
  let rs=[];
  try{
    if(!M._luReact) M._luReact=lineupFanReactions(M);
    rs=M._luReact;
  }catch(e){ return ""; }
  if(!rs.length) return "";
  const meH=!!M.home.isUser;
  /* rs 의 side 는 우리 팬("o")·상대 팬("r") 기준이다. 홈/원정으로 바꿔 준다. */
  const side = (which==="h") ? (meH?"o":"r") : (meH?"r":"o");
  const team = (which==="h") ? M.home : M.away;
  const list = rs.filter(x=>x.side===side);
  if(!list.length) return "";
  const mine = (which==="h")===meH;
  const tab = LU_RTAB[which]||"fmk";
  const fmk = list.filter(x=>x.ch==="fmk"), soc = list.filter(x=>x.ch!=="fmk");
  const body = (tab==="fmk")
    ? (fmk.length ? `<div class="fmkList">${fmk.map(x=>`
        <div class="fmkRow ${mine?"":""}">
          <div class="fmkTitle">${x.txt}</div>
          <div class="fmkMeta"><img class="fmkRk" src="${FMK_RANK[clamp(x.rk|0,0,FMK_RANK.length-1)]}" alt="${FMK_RANK_N[clamp(x.rk|0,0,FMK_RANK.length-1)]}" title="${FMK_RANK_N[clamp(x.rk|0,0,FMK_RANK.length-1)]}"><span>${x.u}</span>
            <span>조회 ${x.v}</span><span class="fmkUp">▲${x.up}</span><span class="fmkDn">▼${x.dn}</span></div>
        </div>`).join("")}</div>` : `<p class="small">아직 올라온 글이 없습니다.</p>`)
    : (soc.length ? soc.map(x=>`<div class="socPost${mine?"":" riv"}">
        <div class="socHead"><span class="socAv">${x.e}</span><b>@${x.u}</b></div>
        <div class="socTxt">${x.txt}</div>
      </div>`).join("") : `<p class="small">아직 올라온 글이 없습니다.</p>`);
  return `<div class="card" style="margin-top:10px">
    <h3 style="color:${mine?"var(--acc)":"var(--sub)"}">💬 ${team.short} 팬 반응</h3>
    <div class="luTabs">
      <button class="luTab${tab==="fmk"?" on":""}" onclick="setLuTab('${which}','fmk')">🔥 FM코리아 <span class="luN">${fmk.length}</span></button>
      <button class="luTab${tab==="soc"?" on":""}" onclick="setLuTab('${which}','soc')">💬 소셜미디어 <span class="luN">${soc.length}</span></button>
    </div>
    ${body}
  </div>`;
}
function lineupPreviewLayout(M, tag){
  // 라인 분류 — SW·WB·DM·AM 까지 포함한 전 밴드를 다룬다.
  // (예전에는 DF/MF/FW 세 칸만 만들어 두고 BANDS_TOPDOWN 7개를 훑어서, AM·DM 라인에 선수를 두면
  //  undefined.filter 로 이 화면이 통째로 렌더에 실패했다 → 다음경기가 먹통으로 보였다)
  /* ⚠ 배치된 슬롯을 기준으로 줄을 나눈다. 예전에는 선수의 타고난 포지션으로 나눴는데,
       슬롯은 computeRenderSlots 가 포메이션에 맞춰 따로 정하므로 둘이 어긋나면
       그 선수는 어느 줄에서도 안 그려진다 — 실측: 192개 라인업 중 164개에서 1~2명 누락. */
  const mkLines=(sd, slotOf)=>{
    const g={GK:[]}; for(const b of BANDS) g[b]=[];
    for(const x of sd.list){
      // 골문에 선 사람 = 슬롯이 GK 인 사람. 포지션으로 보면 비상 키퍼(수비수)가 어디에도 안 그려진다.
      if(slotOf[x.p.id]==="GK"){ g.GK.push(x); continue; }
      let b=SLOT_BAND[slotOf[x.p.id]] || getZone(sd.team, x.p);
      if(!ROW_SLOTS[b]) b="MF";
      g[b].push(x);
    }
    return g;
  };
  /* 🎨 리마스터 (제보 — 「선발 라인업 화면도 전술창처럼」) — 전술판과 같은 카드의 열람 전용 변형.
     드래그·역할 메뉴는 없고, 이름 클릭(선수 메뉴)·우클릭(프로필 팝업)은 유지. 하단은 컨디션. */
  const chip=(sd,x,slot)=>{
    const t2=sd.team, p=x.p, sl=slot||"GK";
    const rd=getRole(t2,p,sl), R=ROLE_BY_KEY[rd.r];
    const dutyN=DUTY_N[rd.d]||rd.d;
    const fam=getPosFam(p, sl);
    const famCol = fam>=90?"#3fb950" : fam>=60?"#56d364" : fam>=30?"#d29922" : "#f85149";
    return `<div class="fmCard view" oncontextmenu="showPlayerInfoPopup(event,${p.id})">
      <div class="fmCardRole asDiv">${R?R.k:"?"}<span class="rd">${dutyN}</span></div>
      <div class="fmCardName"><span class="fmDot" style="background:${famCol}"></span>
        <b class="pos-${p.pos} clickable" onclick="openPlayerMenu(event,${p.id})">${nmF(p)}</b></div>
      <div class="fmCardSub">${fmSubForPrev(t2,p,sl)}</div>
    </div>`;
  };
  const teamBlock=(sd,label)=>{
    const formName=formationLabel(sd.team, sd.list.map(x=>x.p));
    const slotOf=computeRenderSlots(sd.team, sd.list.map(x=>x.p));
    const lines=mkLines(sd, slotOf);
    const slotCell=(band,slot)=>{
      const occ=(lines[band]||[]).filter(x=>slotOf[x.p.id]===slot);
      return `<div class="pslot"><div class="pslotLabel">${slot}</div>${occ.map(x=>chip(sd,x,slot)).join("")}</div>`;
    };
    // 아무도 없는 라인은 낮게 그려 화면을 잡아먹지 않게 한다 (전술판과 같은 규칙)
    const rowHtml=(band)=>{
      const used=(ROW_SLOTS[band]||[]).some(s=>s&&(lines[band]||[]).some(x=>slotOf[x.p.id]===s));
      return `<div class="prow${used?"":" thin"}">${(ROW_SLOTS[band]||[]).map(s=>s?slotCell(band,s):'<div class="pslot empty"></div>').join("")}</div>`;
    };
    return `<div class="card" style="margin:0">
      <h3>${label} <span class="small">— ${sd.team.name} (${styleName(sd.team)} · ${formName})</span></h3>
      <div class="pitch">
        ${BANDS_TOPDOWN.map(b=>rowHtml(b)).join('')}
        <div class="pline">${lines.GK.map(x=>chip(sd,x,'GK')).join("")}</div>
      </div>
      <p class="small" style="margin-top:8px">벤치: ${sd.bench.length?sd.bench.map(p=>`<b class="clickable" onclick="showPlayer(${p.id})">${p.name}</b>`).join(", "):"없음"}</p>
    </div>`;
  };
  /* 팀마다 「라인업 → 그 팀 팬 반응」을 한 줄로 세운다. 원정 경기여도 우리 팬은 우리 라인업 밑에 있다. */
  const col=(sd, label, which)=>`<div style="flex:1;min-width:280px;display:flex;flex-direction:column">
    ${teamBlock(sd, label)}
    ${lineupReactionCardFor(M, which)}
  </div>`;
  return `<h2>🆚 선발 라인업 ${tag?`— ${tag}`:`— ${divName(userTeam().div)} ${(userTeam().div===1?G.r1:G.r2)+1}라운드`}</h2>
  <div class="fmSubBar" style="margin:2px 0 10px">
    <span class="small" style="opacity:.7">카드 하단 표시:</span>
    ${[["cond","💚 컨디션"],["sta","⚡ 체력"],["ovr","📊 능력치"],["fam","🎓 역할 능숙도"]].map(([m,n])=>
      `<button class="fmSubBtn${fmSubModePrev()===m?" on":""}" onclick="setFmSubPrev('${m}')">${n}</button>`).join("")}
  </div>
  <div class="row">
    ${col(M.h,"🏠 홈","h")}
    ${col(M.a,"✈️ 원정","a")}
  </div>
  <div class="msg info" style="max-width:420px;margin-top:14px">👈 왼쪽 메뉴 하단 <b>${(M.opts&&M.opts.friendly)?"라커룸으로":"기자회견으로"}</b> 버튼으로 진행합니다</div>`;
}
function proceedToPreInterview(){
  { const _a=$("#advBtn"); if(_a) _a.textContent="진행 ▶"; }
  const M=pendingLiveM, tag=pendingLiveTag;
  pendingLiveM=null; pendingLiveTag=null; inLineupPreview=false;
  if(!M) return;
  // 연습경기는 기자회견을 하지 않는다 — 라커룸 토크만 하고 바로 킥오프
  if(M.opts && M.opts.friendly){ showPreMatchTalk(M, tag); return; }
  // FM처럼: 사전 기자회견 → 라커룸 토크 → 킥오프(문자중계) 순서로 진행한다
  startInterview("pre", M, ()=>showPreMatchTalk(M, tag));
}
function startLive(M, tag){
  snapshotTactic();          // 킥오프 직전 전술을 찍어 둔다 (종료 후 되돌리기용)
  liveM=M; liveShown=0; livePaused=false; livePanelKey=""; liveTag=tag; inLiveTactics=false; liveTacBackup=null;
  try{ wakeAcquire(); }catch(e){}   // 경기 동안 화면이 꺼지지 않게 잡아 둔다
  shownHg=0; shownAg=0; shownSt=null;
  // 연속 2D 매치엔진으로 치를 경기라면 여기서 시뮬을 만들어 둔다.
  // 이후 liveTick 이 stepMinute 대신 이 시뮬을 굴리고, 캔버스는 그 좌표를 실시간으로 그린다.
  /* ⚠ 제보 — 시뮬 생성 중 예외가 나면 liveM 이 이미 채워져 있어 show() 가 전부 막히고,
     진행 버튼도 라커룸에서 잠긴 채라 새로 고침 말고는 빠져나올 수 없었다. 되돌린다. */
  try{
    liveSim = (matchEngine()==="sim") ? new MatchSim(M, {live:true}) : null;
  }catch(err){
    liveM=null; liveSim=null; liveTag=null;
    try{ eaclBanPop(userTeam()); }catch(e){}   // 🟨 대회용으로 갈아 끼운 징계를 원위치
    G.pendingFriendly=null; G.pendingPO=null; G.pendingEACL=null; G.pendingCWC=null;
    try{ wakeRelease(); }catch(e){}
    try{ $("#advBtn").disabled=false; }catch(e){}
    try{ notify("⚠️ 경기를 시작할 수 없습니다 — 출전 가능한 선수가 부족합니다. 선수단을 먼저 추스르세요.","warn"); }catch(e){}
    try{ show("squad"); }catch(e){ try{ show("home"); }catch(e2){} }
    return;
  }
  liveSimHalf=false; liveHL=null; liveFF=false; lastHLTick=null; goalPanelShownFor=null; hideGoalPanel();
  if(revealTimer){ clearTimeout(revealTimer); revealTimer=null; } revealQueue=[]; // 이전 경기의 잔여 공개 큐 정리
  current2DScene=null;
  VIEW="match";
  $("#advBtn").disabled=true;
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  $("#main").innerHTML=liveLayout(M, tag);
  matchMode=MATCH_MODE.TEXT; applyMatchModeUI(); // 킥오프 전까지는 텍스트 모드로 시작
  // 연속 엔진은 짧은 간격으로 자주 조금씩 굴린다(시간 예산 방식) — 그래야 화면이 안 끊긴다.
  // 기존 분 단위 엔진은 한 번에 1분이 끝나므로 예전 간격을 그대로 쓴다.
  liveSpeed = liveSim ? LIVE_SIM_TICK_MS : Math.max(24, Math.round(TEXT_TICK_MS/liveMul()));
  idleDrawKey=null;
  render2DTick(nowMs()); // 첫 하이라이트가 재생되기 전에도 빈 캔버스가 아니라 킥오프 포메이션이 바로 보이게
  start2DLoop(); // 하이라이트 씬을 부드럽게 재생하기 위한 렌더 루프 시작(씬이 없을 땐 그리지 않고 대기)
  syncLive();
  setLiveSpeed(liveSpeed); // TEXT_TICK_MS 간격으로 경기 시간이 흐른다
}
function liveLayout(M, tag){
  try{ document.body.classList.add("matchFS"); }catch(e){}
  /* 경기 중에는 좌측 진행 버튼을 잠근다 — 게이트 화면들이 켜 둔 활성(초록) 상태가
     경기 화면까지 남아 있던 문제(제보). 하프타임 라커룸 등이 다시 켜고, 여기서 다시 잠근다. */
  try{ const _a=$("#advBtn"); if(_a){ _a.disabled=true; _a.classList.add("navLocked"); _a.textContent="⚽ 경기 진행 중"; } }catch(e){}
  return `<div class="lvGrid">
    <div class="lvCenter card">
      <div class="lvHead">
        <span class="t" style="background:${M.home.col};color:${inkOn(M.home.col)}">${M.home.short||M.home.name}</span>
        <span id="lvScore">0 : 0</span>
        <span class="t" style="background:${M.away.col};color:${inkOn(M.away.col)}">${M.away.short||M.away.name}</span>
        <span id="lvMin">0'</span><span id="lvRed"></span>
        <span id="lvCtrl" style="display:flex;gap:5px;align-items:center"></span>
        ${(M.opts&&M.opts.pvp)
          ? `<button class="mini sel" onclick="pvpTacOpen()" title="경기를 멈추고 교체·세부 전술을 수정합니다 — 경기당 ${PVP_TAC_USES}회">📋 전술${(typeof PVP!=="undefined"&&PVP&&PVP.tacMe!=null)?` (${PVP.tacMe})`:""}</button>
             <button class="mini" onclick="pvpLeave()" title="경기 중 이탈은 0:3 몰수패입니다">🚪 기권</button>`
          : (M.home.isUser||M.away.isUser)?`<button class="mini" onclick="openLiveTactics()">📋 전술</button>`:""}
        <span id="pitchMode" class="pitchMode" style="margin-left:auto">○ 경기 진행 중</span>
      </div>
      <div class="pitchWrap">
        <canvas id="pitch2d" class="dim" width="960" height="630"
                onclick="pickPlayerOnPitch(event,this,liveSim)" title="선수를 클릭하면 이름이 표시됩니다"></canvas>
        <div id="lvSpdPanel" class="lvSpdPanel hidden">${lvSpdPanelHtml()}</div>
        <div id="goalPanel" class="goalPanel hidden"></div>
      </div>
      <div id="lvNudge" class="lvNudge hidden"></div>
      <div id="pitchCaption" class="pitchCaption">킥오프를 기다리는 중...</div>
      <div class="small" style="text-align:left; margin-top:6px; color:var(--sub)">2D 매치엔진 2.0 by 청백적시메오네</div>
    </div>
    <div class="lvSide">
      <div class="card hidden" id="lvOffCard" style="border-color:#e5484d">
        <h3 style="color:#e5484d" id="lvOffTitle">🟥 퇴장</h3><div id="lvOff"></div></div>
      <div class="card"><h3>📊 경기 통계</h3><div id="lvStats"></div></div>
      <div class="card"><h3>${(M.opts&&M.opts.pvp)?"📋 전술 · 💬 채팅":`📋 ${acName()}의 조언`}</h3><div id="lvPanel"></div></div>
    </div>
  </div>`;
}
/* ═══ 🟥 퇴장 명단 ══════════════════════════════════════════════════
   ⚠ 제보 — 「퇴장이 나오면 어느 팀의 어느 포지션 누구인지 한 켠에 적혀야 상황이 읽힌다」.
   화면이 도달한 시점까지의 퇴장만 보여 준다(스포 방지). */
/* 🟥 ⚠ 제보 원문 — 「경기 도중 후반 추가 시간에 누군가 퇴장 당할 때는 퇴장 정보가 담긴
   우측 상단의 박스가 뜨지 않는다. 후반 추가 시간에도 퇴장 정보 박스가 나오게 해 달라」.
   원인 ① 이 목록은 「화면(재생헤드)이 도달한 시점까지」만 보여 준다 — 스포 방지 장치다.
          그런데 추가시간 퇴장은 그 장면이 다 재생되기도 전에 종료 휘슬이 울리는 일이 잦다.
          휘슬이 울리면 시뮬은 멈추고 재생헤드도 더 이상 전진하지 않으므로, 필터가 영영
          그 퇴장을 가린 채 화면이 굳었다.
        → 경기가 끝났고 재생 중인 장면도 없으면 더 감출 것이 없다. 필터를 푼다.
   원인 ② 「건너뛰기」로 마무리하면 분 단위 엔진(stepMinute)이 남은 시간을 처리한다.
          그 퇴장은 liveSim.sentOff 가 아니라 출전 기록(sd.list[].red)에만 적히는데,
          옛 경로가 `!liveSim` 일 때만 돌게 막혀 있어 목록에서 통째로 빠졌다.
        → 경기가 끝난 뒤에는 두 곳을 합쳐 본다(이름 기준 중복 제거). */
/* 🟥🚑 ⚠ 제보 원문 — 「경기 중 상대가 퇴장 당했는데 퇴장 정보 박스가 우측 상단에 뜨지 않는다.
      퇴장 장면을 보여주지 않았고, 유저는 수석 코치의 조언에 '수적 우위입니다, 폭을 넓히고
      라인을 올려 상대를 좌우로 흔드세요' 를 보고 상대의 퇴장을 알았다. 경기 중 퇴장을 당하면
      그 즉각 우측 상단의 퇴장 정보 박스를 보여 달라. 또, 퇴장 장면을 하이라이트에서 보여주지
      않아도 퇴장 정보 박스를 통해 알려 달라」.
   ── 원인 (14경기를 돌려 확인) ────────────────────────────────
   ① 「🟥 수적 우위/열세」 조언은 퇴장뿐 아니라 <b>채우지 못한 부상 공백</b>(injGap)까지 세는데,
      우측 상단 박스는 「퇴장이 한 명이라도 있어야」만 열렸다 — `if(!list.length) return ""`.
      상대가 교체 카드를 다 써서 열 명이 된 경우가 여기 해당한다.
      실제로 14경기에서 「수적 우위·열세」 조언이 뜬 16순간이 <b>전부</b> 이 경우였고,
      그 16순간 모두 박스는 닫힌 채였다. 감독 입장에서는 「퇴장인데 박스가 안 뜬다」로 보인다.
      (그래서 「퇴장 장면」도 없었던 것이다 — 애초에 카드가 나온 게 아니었다)
   ② 퇴장은 재생헤드(화면이 도달한 시점)로 걸러 스포를 막는데, 부상 공백은 안 걸렀다.
      조언이 장면보다 먼저 인원 변화를 흘렸다.
   ③ 퇴장 자체도 「지금 재생 중인 장면」이 그 순간을 품고 있지 않으면 영영 안 뜰 여지가 있었다
      (장면 프레임이 모자라 통째로 버려지는 경우 등).
   ── 수정 ────────────────────────────────────────────────────
   · 박스를 「퇴장 · 인원」 박스로 넓힌다 — 퇴장이 0명이어도 인원 공백이 있으면 즉시 열린다.
   · 부상 공백에도 발생 시각(gapT)을 남기고 퇴장과 똑같은 재생헤드 필터를 태운다.
   · 지금 재생 중인 장면 밖의 사건은 기다리지 않고 즉시 공개한다 — 장면을 보여주지 않는
     퇴장이 묻히지 않는다.
   · 박스와 조언이 완전히 같은 함수(revealedAt·shownRedCount·shownGaps)를 쓰므로
     두 곳의 말이 다시 어긋날 수 없다. */
function hlPlayT(){
  try{ if(liveHL && liveHL.frames && liveHL.frames[liveHL.i]) return liveHL.frames[liveHL.i].t; }catch(e){}
  return null;
}
function revealedAt(t){
  try{
    if(!liveSim) return true;                              // 분 단위 엔진 — 지연 재생이 없다
    if(liveM && liveM.done && !liveHL) return true;        // 휘슬이 울렸다 — 감출 것이 없다
    if(t==null) return true;
    const ph=hlPlayT();
    if(ph==null) return (t<=liveSim.t+1e-6);               // 재생 중인 장면이 없다 — 시뮬 시점 기준
    if(t<=ph+1e-6) return true;                            // 재생헤드가 이미 지났다
    /* 아직 안 지났다 — 지금 재생 중인 장면 안에서 곧 나올 순간이면 기다리고(스포 방지),
       그 장면 밖이면 이 화면으로는 나오지 않으므로 지금 알린다 */
    return !(t>=liveHL.t0-1e-6 && t<=liveHL.tEnd+1e-6);
  }catch(e){ return true; }
}
/* 🚑 화면에 공개된 「채우지 못한 부상 공백」 명단 */
function shownGaps(M, key){
  try{
    const sd=(key==="h")?M.h:M.a;
    const all=(sd&&Array.isArray(sd.list)) ? sd.list.filter(x=>x && x.off!==null && !x.red && x.injGap) : [];
    if(!liveSim) return all;
    return all.filter(x=>revealedAt(x.gapT));
  }catch(e){ return []; }
}
function liveSentOffHtml(){
  const M=liveM; if(!M) return "";
  const _over = !!(M.done && !liveHL);      // 휘슬이 울렸고 재생 중인 장면도 없다 — 감출 것이 없다
  let list=[];
  try{
    if(liveSim && Array.isArray(liveSim.sentOff) && liveSim.sentOff.length){
      list=liveSim.sentOff.filter(x=>revealedAt(x.t)).map(x=>({
        side:x.side, min:(x.lbl!=null?x.lbl:(x.min!=null?x.min:Math.round((x.t||0)/60))),
        name:x.name||"", ps:x.slot||x.pos||"", second:!!x.second}));
    }
  }catch(e){}
  /* 분 단위 엔진(옛 경로) — 출전 기록에서 읽는다.
     ⚠ 연속 엔진이 굴러가는 중에는 절대 여기로 오면 안 된다. 재생헤드 필터로 목록이 비었을 때
        이 경로를 타면 아직 화면에 안 나온 퇴장까지 통째로 새어 나간다(스포).
        경기가 끝난 뒤(_over)에는 스포가 성립하지 않으므로 빠진 것을 여기서 채운다. */
  if(_over && liveSim){
    try{
      const seen=new Set(list.map(x=>x.side+"|"+x.name));
      for(const key of ["h","a"]){
        const sd=M[key]; if(!sd||!Array.isArray(sd.list)) continue;
        for(const x of sd.list){
          if(!x || !x.red) continue;
          const nm=(x.p&&x.p.name)||"";
          if(seen.has(key+"|"+nm)) continue;
          seen.add(key+"|"+nm);
          list.push({side:key, min:recMinTxt(M, x.off!=null?x.off:M.min), name:nm,
                     ps:(x.slot||(x.p&&x.p.pos)||""), second:false});
        }
      }
    }catch(e){}
  }
  if(!list.length && !liveSim){
    try{
      for(const key of ["h","a"]){
        const sd=M[key]; if(!sd||!Array.isArray(sd.list)) continue;
        for(const x of sd.list) if(x && x.red)
          list.push({side:key, min:recMinTxt(M, x.off!=null?x.off:M.min), name:(x.p&&x.p.name)||"",
                     ps:(x.slot||(x.p&&x.p.pos)||""), second:false});
      }
    }catch(e){}
  }
  /* 🚑 인원 공백 — 퇴장이 한 명도 없어도 「열 명으로 뛰는 팀」은 알려야 한다.
     (수석코치는 이걸 세어 「수적 우위」라고 말하는데 박스만 닫혀 있던 것이 이번 제보다) */
  const gh=shownGaps(M,"h"), ga=shownGaps(M,"a");
  if(!list.length && !gh.length && !ga.length) return "";
  /* 「90+2」 같은 전광판 글자도 섞이므로 앞뒤 숫자를 합쳐 정렬 기준을 만든다 */
  const _ord=(v)=>{ const s=String(v==null?0:v); const m=s.match(/(\d+)(?:\+(\d+))?/);
                    return m ? (+m[1])*100 + (+(m[2]||0)) : 0; };
  list.sort((a,b)=>_ord(a.min)-_ord(b.min));
  const row=(x)=>{
    const t=(x.side==="h")?M.home:M.away;
    const left=(()=>{ try{ return liveSim ? liveSim.agents.filter(a=>a.side===x.side).length : null; }catch(e){ return null; } })();
    return `<div style="display:flex;gap:7px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <span style="font-size:15px">🟥</span>
      <b style="color:var(--gold);font-family:monospace;width:32px">${x.min}'</b>
      <span class="t" style="background:${t.col};color:${inkOn(t.col)};padding:2px 7px;border-radius:5px;font-size:11.5px;font-weight:800">${t.short||t.name}</span>
      ${x.ps?`<span class="small" style="opacity:.85;font-family:monospace">${x.ps}</span>`:""}
      <b>${x.name}</b>
      ${x.second?'<span class="small" style="opacity:.7">경고 누적</span>':""}
    </div>`;
  };
  const cnt={h:list.filter(x=>x.side==="h").length, a:list.filter(x=>x.side==="a").length};
  /* ⚠ 예전에는 시뮬의 실시간 인원(liveSim.agents)을 그대로 적었다 — 장면이 나오기도 전에
     숫자가 먼저 줄어 스포가 됐다. 수석코치와 똑같은 「공개된 인원」을 쓴다. */
  const numLeft=(key)=>{ try{ return shownOnPitch(M, key); }catch(e){ return 11-cnt[key]; } };
  /* 🚑 퇴장이 아닌데 인원이 빈 경우 — 교체 카드를 다 썼거나 벤치가 없어 채우지 못한 부상 이탈.
     ⚠ 제보 — 「퇴장은 한 명인데 그라운드에 9명」. 숫자만 보여 주니 버그로 보였다. 이유를 적는다. */
  const gapTxt=[];
  for(const [key, arr] of [["h",gh],["a",ga]]){
    if(!arr.length) continue;
    const tm=(key==="h")?M.home:M.away;
    const who=arr.map(x=>(x.p&&x.p.name)||"선수").join(", ");
    const sd=M[key];
    const why=(sd&&(sd.subs||0)>=subMax(M)) ? "교체 카드를 모두 써" : "채울 선수가 없어";
    gapTxt.push(`🚑 <b>${tm.short}</b> — ${who} 부상 이탈, ${why} 자리를 비운 채 뜁니다.`);
  }
  return list.map(row).join("")
    + (gapTxt.length?`<div class="small" style="margin-top:6px;color:#ff9d5c;line-height:1.6">${gapTxt.join("<br>")}</div>`:"")
    + `<div class="small" style="margin-top:7px;opacity:.85">그라운드 인원 —
        <b>${M.home.short}</b> ${numLeft("h")}명 · <b>${M.away.short}</b> ${numLeft("a")}명
        <span style="opacity:.7">(퇴장 ${cnt.h+cnt.a}명${(gh.length+ga.length)?` · 부상 공백 ${gh.length+ga.length}명`:""})</span></div>`;
}
function syncSentOffPanel(){
  /* ⚔️ 퇴장 명단 중계 — 화면 공개 시점 기준 목록을 게스트에도 (제보: 카드 동기화) */
  try{
    if(liveM && liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP && PVP.role==="host" && liveSim){
      const list=(liveSim.sentOff||[]).filter(x=>revealedAt(x.t)).slice(0,8).map(x=>({
        s:x.side, m:(x.lbl!=null?x.lbl:(x.min!=null?x.min:Math.round((x.t||0)/60))), n:String(x.name||"").slice(0,12), p:String(x.slot||x.pos||"").slice(0,4)}));
      const j=JSON.stringify(list);
      if(PVP._offJ!==j){ PVP._offJ=j; if(list.length) pvpSend({t:"offl", list}); }
    }
  }catch(e){}
  const box=document.getElementById("lvOff"), card=document.getElementById("lvOffCard");
  if(!box||!card) return;
  const h=liveSentOffHtml();
  if(!h){ card.classList.add("hidden"); box.innerHTML=""; return; }
  card.classList.remove("hidden");
  /* 🚑 퇴장이 없이 인원 공백만 있을 때도 열리므로, 제목을 상황에 맞게 바꾼다 (제보) */
  try{
    const ttl=document.getElementById("lvOffTitle");
    if(ttl && liveM){
      const nr=shownRedCount(liveM,"h")+shownRedCount(liveM,"a");
      const ng=shownGaps(liveM,"h").length+shownGaps(liveM,"a").length;
      const s = (nr&&ng) ? "🟥 퇴장 · 🚑 인원 공백" : nr ? "🟥 퇴장" : "🚑 인원 공백";
      if(ttl.textContent!==s) ttl.textContent=s;
    }
  }catch(e){}
  if(box.innerHTML!==h) box.innerHTML=h;
}
function toggleSpdPanel(){
  if(liveM && liveM.opts && liveM.opts.pvp) return;   // ⚔️ 제보 — 온라인 대전은 배속 고정
  const p=document.getElementById("lvSpdPanel");
  if(p) p.classList.toggle("hidden");
}
function replayMulUI(){
  try{ if(liveM && liveM.opts && liveM.opts.pvp) return 2; }catch(e){}   // ⚔️ 제보 — 다시보기 2배 고정
  return clamp((G.opt&&G.opt.replay)||1, 0.5, 2); }
function setReplayMul(v){
  if(!G.opt) G.opt={};
  G.opt.replay=clamp(Math.round(+v*10)/10, 0.5, 2);
  const lb=document.getElementById("lvRepLbl");
  if(lb) lb.textContent=G.opt.replay.toFixed(1)+"×";
  saveGame();
}
function liveTick(){
  if(!liveM||livePaused) return;
  // HIGHLIGHT_MODE(2D 연출 중)에는 경기 시계를 멈춘다 — 장면이 다 끝나고 TEXT_MODE로 돌아와야 다음 분으로
  // 넘어간다. 그래야 "전반 종료·후반전 시작"같은 경기 상태가 화면에 나오는 장면보다 앞서가지 않는다.
  if(matchMode===MATCH_MODE.HIGHLIGHT || revealQueue.length || revealTimer || current2DScene){
    if(liveM && liveSim){ liveM._flowClock=liveSim.clock; liveM._flowSnap={hS:(liveM.st&&liveM.st.hS)||0, aS:(liveM.st&&liveM.st.aS)||0};   // 🎬 장면이 나오는 동안 가뭄 시계 리셋
      try{ lvNudgeHide(); }catch(e){} }                                                    // 장면이 나왔다 — 「가뭄」 알림은 내린다
    /* ⚠ PvP — 호스트 탭이 백그라운드면 rAF 가 죽어 하이라이트가 영영 안 끝난다.
       상대가 실시간으로 기다린다 — 여기서 장면을 밀어 준다 (stepLiveSim 안전망과 동일 수법). */
    if(liveM.opts && liveM.opts.pvp && document.hidden && typeof liveHL!=="undefined" && liveHL){
      try{
        const t=nowMs();
        if(liveHL.lastAdv && t-liveHL.lastAdv>400) advanceHighlight((t-liveHL.lastAdv)/1000);
        else if(!liveHL.lastAdv) liveHL.lastAdv=t;
      }catch(e){}
    }
    return;
  }
  // 이전 틱에서 하프타임이 우선 처리되어 미뤄진 부상/퇴장 알림이 있으면, 다음 분으로 넘어가기 전에 먼저 처리
  // (재생 중인 장면이 있으면 그게 끝난 뒤에 — 퇴장 장면보다 전술창이 먼저 뜨지 않게)
  /* ⚠ 여기는 「장면 재생 중이면 안 연다」 가드가 없어 보이지만, 바로 위 조기 return 이
     matchMode·revealQueue·revealTimer·current2DScene 를 이미 걸러 낸다 — 여기 닿았다면
     장면은 끝난 뒤다. (아래쪽 짝은 stepLiveSim 이 그 틱에 장면을 시작할 수 있어서 직접 본다) */
  if(liveM.needsSubPause && !liveHL){ liveM.needsSubPause=false;
    if(!(liveM.opts&&liveM.opts.pvp)) { openLiveTactics(); return; } }
  // 교체 — 잠깐 멈추고 해설이 읽어 준다. 양 팀 모두, 바꾼 인원 수만큼 차례로.
  if(liveM.subQueue && liveM.subQueue.length){
    const sx=liveM.subQueue[0];
    if(!sx.shown){ sx.shown=true; sx.until=nowMs()+SUB_PAUSE_MS; announceSub(sx); }
    if(nowMs()<sx.until) return;               // 이 동안 경기 시계가 멈춘다
    liveM.subQueue.shift();
    if(liveM.subQueue.length) return;          // 다음 교체도 이어서 읽는다
  }
  /* 전술 변경 해설은 없앴다(제보) — 중계가 멈추고 읽는 것은 교체뿐이다.
     옛 세이브에 남아 있을 수 있는 큐만 조용히 비운다. */
  if(liveM.tacQueue && liveM.tacQueue.length) liveM.tacQueue.length=0;
  const gBefore=liveM.hg+liveM.ag, mBefore=liveM.min;
  if(liveSim) stepLiveSim();          // 연속 2D 매치엔진 — 시간 예산만큼 굴린다
  else        stepMinute(liveM);      // 기존 분 단위 엔진
  const scored=liveM.hg+liveM.ag>gBefore;
  // 연속 엔진은 초당 30번 호출된다. 매번 통계표·코치 조언까지 다시 그리면 그 DOM 작업이
  // 캔버스보다 무거워져 화면이 끊긴다. 화면에 실제로 바뀔 게 있을 때만 갱신한다.
  // ⚠ 연속 엔진에서는 scored(시뮬 상태)로 반짝이면 안 된다 — 골 장면이 재생되기 전에 전광판이
  //    먼저 번쩍여 스포일러가 된다. 번쩍임은 revealScore(=화면이 그 골에 도달한 순간)가 담당한다.
  if(!liveSim || scored || liveM.min!==mBefore || liveM.done || liveHL) syncLive(liveSim ? false : scored);
  /* 🟥 제보 — 추가시간 퇴장이 옆 칸에 안 뜬다. 위 갱신은 「분이 바뀌었을 때」가 주 조건이라
     퇴장과 종료 휘슬이 같은 분 안에 몰리면 한 번도 돌지 않을 수 있다. 퇴장 명단만은 매 틱 맞춘다
     (내용이 그대로면 DOM 을 건드리지 않으므로 비용이 없다). */
  else if(liveSim){ try{ syncSentOffPanel(); }catch(e){} }
  /* 🎬 가뭄 안전망 — FLOW_PAUSE_MIN 주석 */
  if(liveSim && !liveHL && !liveM.htBreak && !liveM.done && !(liveM.opts&&liveM.opts.pvp)
     && (liveM.home.isUser||liveM.away.isUser)){
    if(liveM._flowClock==null){ liveM._flowClock=liveSim.clock; liveM._flowSnap={hS:0,aS:0}; }
    if(liveSim.clock-liveM._flowClock >= FLOW_PAUSE_MIN*60){
      liveM._flowClock=liveSim.clock;
      const st=liveM.st||{};
      const sn=liveM._flowSnap||{hS:0,aS:0};
      const dHS=Math.max(0,(st.hS||0)-(sn.hS||0)), dAS=Math.max(0,(st.aS||0)-(sn.aS||0));
      liveM._flowSnap={hS:st.hS||0, aS:st.aS||0};
      const _pt=(st.hP||0)+(st.aP||0);                     // ⚠ st.hP 는 틱 카운트 — 백분율로 바꿔 보여준다
      const _hp=_pt>0?Math.round(100*(st.hP||0)/_pt):50;
      /* ⚠ 제보 원문 — 「경기 중에 교체창이 켜지는 버그가 있다」.
         버그가 아니라 이 안전망이었다 — 15분 동안 큰 장면이 없으면 <b>전술창을 대신 열어</b> 줬다.
         하이라이트를 「결정적 장면만」으로 보면 무장면 구간이 20~83분까지 가므로 한 경기에
         여러 번 튀어나왔고, 보고 있던 화면을 밀어내니 「저절로 켜진다」로 읽혔다.
         ─ 이제 <b>열지 않는다.</b> 흐름 요약과 함께 「전술 손보기」 버튼만 띄우고,
           들어갈지 말지는 감독이 정한다. 무시하면 그대로 경기가 흐른다. */
      try{ lvNudgeShow(`📊 큰 장면 없이 <b>${FLOW_PAUSE_MIN}분</b> — 그동안 슈팅 ${liveM.home.short} <b>${dHS}</b> : <b>${dAS}</b> ${liveM.away.short} · 점유 ${_hp}:${100-_hp}`); }catch(e){}
      return;
    }
  }
  if(liveM.htBreak){ liveM.htBreak=false;
    try{ lvNudgeHide(); }catch(e){}
    if(liveM.opts&&liveM.opts.pvp){ pvpHalftime(); return; }
    livePaused=true; showHalftimeTalk(liveM); return; }
  if(liveM.done){
    if(liveTimer){clearInterval(liveTimer); liveTimer=null;}
    try{ lvNudgeHide(); }catch(e){}
    updLiveCtrl("ft");
    // 경기가 끝나는 경로가 여럿이라(하이라이트 종료·시간 만료) 자막은 여기서 한 번에 마무리한다
    const cap=document.getElementById("pitchCaption");
    if(cap) cap.textContent="🏁 경기 종료";
    resetComm("🏁 경기가 끝났습니다.");
    return;
  }
  /* ⚠ 제보 — 우리 선수가 퇴장당하면 전술창이 먼저 뜨고 그 뒤에 퇴장 장면이 재생됐다.
     stepLiveSim 이 그 틱에서 하이라이트를 시작(startHighlight)했는데, 여기서 모드를 보지 않고
     곧바로 전술창을 열어 장면을 밀어냈기 때문이다. 장면이 다 끝난 다음 틱에서 열린다. */
  if(liveM.needsSubPause && !liveHL && !(liveM.opts&&liveM.opts.pvp) && matchMode!==MATCH_MODE.HIGHLIGHT
     && !revealQueue.length && !revealTimer && !current2DScene){
    liveM.needsSubPause=false; openLiveTactics();
  }
}
/* FM식 하이라이트 중계.
   경기는 뒤에서 빠르게 굴러가고, 화면은 결정적 장면만 되감아 실시간으로 보여준다.
   ─ 하이라이트를 재생하는 동안에는 시뮬을 세운다. 그래야 화면과 스코어보드가 어긋나지 않는다. */
function stepLiveSim(){
  const s=liveSim, M=liveM;
  // 하이라이트 재생 중 — 경기는 멈춰 있다.
  // 재생은 화면 렌더 루프(60fps)가 굴리는데, 브라우저 탭이 백그라운드로 가면 그 루프가 멎는다.
  // 그때 경기가 영영 멈추지 않도록 여기서도 밀어 준다(안전망).
  if(liveHL){
    const t=nowMs();
    if(liveHL.lastAdv && t-liveHL.lastAdv>400) advanceHighlight((t-liveHL.lastAdv)/1000);
    else if(!liveHL.lastAdv) liveHL.lastAdv=t;
    return;
  }
  // 볼거리 없는 시간은 빠르게 흘려보낸다. 결정적 장면이 잡히는 즉시 멈추므로 놓치는 건 없다.
  //   ⚠ "몇 분치"로 끊으면 안 된다. 1분 = 300틱이고 틱마다 22명을 굴리므로,
  //      3분치를 한 번에 돌리면 메인 스레드가 수백 ms 멈춰 화면이 뚝뚝 끊긴다.
  //      대신 "이번 호출에 쓸 시간"을 정해 두고 그만큼만 굴린다 — 기기가 느려도 화면은 부드럽다.
  /* ⚠ PvP — 백그라운드 탭은 타이머가 초당 1회로 묶인다(크롬 스로틀). 호출 횟수가 30분의 1로
     줄어든 만큼 호출당 예산을 키워, 호스트가 탭을 벗어나도 상대의 경기가 실시간으로 흐르게 한다. */
  const _pvpBg = !!(liveM && liveM.opts && liveM.opts.pvp && document.hidden);
  const t0=nowMs(), budget=_pvpBg ? 180 : Math.min(22, 6*liveMul());
  let guard=0;
  /* ⚠ 제보 — 전반 45분에 PK를 얻으면 휘슬이 울리고 후반에 차는 버그.
     실제 규정처럼, 진행 중인 반칙 장면·PK·날아가는 슛·세리머니가 있으면 그게 끝날 때까지
     하프타임을 미룬다 (전반 추가시간에 PK를 차는 그림). */
  const htHold=()=>s.pkHold();   // 진행 중인 PK·슛·세리머니 — 클래스 공용 판정으로 통일
  /* 📺 판독 중이면 종료 휘슬을 미룬다 — 하프타임을 미루는 htHold 와 같은 이치 (제보) */
  while((s.clock<s.endSec || s.varPending || htHold()) && guard++<4000){   // 🅿️ 종료 직전 PK — 찰 때까지 계속 굴린다
    s.tick();
    s.stoppageCheck();
    if(s.hl) break;                        // 결정적 장면 발생 — 여기서 끊고 되감는다
    // 하프타임은 정확히 45분에 끊어야 한다 — 건너뛰기 중에도 넘겨서는 안 된다 (PK 등 진행 중이면 예외)
    if(!liveSimHalf && s.clock>=s.htSec && !htHold()) break;
    if((guard&7)===0 && nowMs()-t0>=budget) break;    // 시간 예산 소진 — 다음 호출로 넘긴다
  }
  s.syncClock(); s.syncStats();
  s.aiTacticCheck();          // 상대 감독도 시계와 점수를 보고 지시를 바꾼다
  if(s.hl) startHighlight();
  // 하프타임 — 전반이 끝나는 순간 라커룸으로 넘긴다 (하이라이트 재생 중이거나 PK가 진행 중이면 끝난 뒤에)
  if(!liveHL && !liveSimHalf && s.clock>=s.htSec && !htHold()){
    liveSimHalf=true; M.half=2; M.min=45; M.htBreak=true;
    return;
  }
  if(!liveHL && s.clock>=s.endSec && !s.varPending && !htHold()){
    /* ⏱️ 녹아웃 동점 — 여기서 연장으로 넘어간다 (넘어가면 이번 호출은 그대로 끝낸다) */
    if(s.tryExtraTime()) return;
    /* 🥅 차기 전에 키커 순서를 정하게 한다 — 정하고 나면 그 자리에서 이어서 끝낸다 */
    if(pkNeedsPick(M) && !PK_PICK){
      livePaused=true;
      if(liveTimer){ clearInterval(liveTimer); liveTimer=null; }
      pkPickOpen(M, ()=>{ livePaused=false; s.runShootoutIfNeeded(); s.finishMatch(); syncLive(); liveFinishUI(); });
      return;
    }
    if(PK_PICK) return;
    s.runShootoutIfNeeded();
    s.finishMatch();
  }
}
/* ══════════════════════════════════════════════════════════════════
   📖 MATCH NARRATIVE ENGINE — 이벤트를 창작하지 말고, 이벤트 사이의 관계를 해석하라.
   장면이 잘리는 순간 그 구간의 evlog(구조화 이벤트)를 읽어 빌드업 자막을 새로 쓴다.
   · 트리거(슛·파울) 이후의 기존 자막(슛/선방/골/카드 체인)은 손대지 않는다
   · 여기 쓰는 모든 문장은 로그에 있는 사실에만 대응한다 (§35)
   · 연속된 평범한 패스는 압축하고(§23), 결정적 이벤트만 이름을 붙인다(§25)
   ══════════════════════════════════════════════════════════════════ */
const NARR={
  buildGK:  ["골키퍼부터 차분하게 시작합니다","후방에서 천천히 풀어 나옵니다"],
  passFlow: ["짧은 패스로 공격을 이어갑니다","패스를 주고받으며 틈을 찾습니다","서두르지 않고 돌립니다"],
  passAdv:  ["차분히 전진합니다","한 칸씩 밀고 올라옵니다","공격 지역으로 넘어옵니다"],
  counter:  ["🔄 공을 뺏어냅니다 — 곧바로 전환합니다!","🔄 탈취! 상대 수비가 아직 정돈되지 않았습니다!"],
  intercept:["🧤 {p}, 패스를 가로챕니다!","🧤 {p}이/가 길목을 지키고 있었습니다 — 차단!"],
  tackleWin:["💪 {p}, 태클로 끊어냅니다!","💪 {p}이/가 몸을 던져 공을 따냅니다!"],
  pressPass:["압박을 받으며 {p}, {q}에게 연결합니다","{p}, 압박 속에서도 {q}에게 이어줍니다"],
  escPass:  ["압박을 벗어나는 패스 — {q}가 받아줍니다","{p}, 포위를 빠져나옵니다. {q}에게"],
  switchP:  ["↔️ 반대편이 열렸습니다 — {p}, 크게 전환합니다!","↔️ {p}, 방향을 바꿔 반대쪽으로 보냅니다!"],
  longP:    ["{p}, 길게 앞쪽을 노립니다","{p}가 한 번에 넘겨버립니다"],
  through:  ["👁️ {p}, 수비 뒷공간을 봤습니다!","👁️ {p}의 눈이 빛납니다 — 뒷공간!"],
  throughB: ["{q}이/가 침투합니다!","{q}이/가 이미 움직이고 있었습니다!"],
  keyPass:  ["{p}, {q}에게 열어줍니다!","{p}의 침투 패스 — {q}!"],
  touchGood:["{p}, 좋은 퍼스트터치로 잡아냅니다","{p}, 받는 순간 정리가 끝났습니다"],
  touchBad: ["😖 {p}, 터치가 깁니다!","😖 퍼스트터치가 흔들립니다!"],
  knock:    ["🏃 {p}, 공을 길게 밀어놓고 달립니다!","🏃 {p}이/가 공을 차놓고 속도를 붙입니다!"],
  fastDrb:  ["{p}, 속도를 올립니다!","{p}이/가 몰고 들어갑니다!"],
  protect:  ["{p}, 몸으로 공을 지켜냅니다","{p}이/가 등을 지고 버팁니다"],
  crossUp:  ["{p}, 크로스 올립니다!"], crossLow:["{p}, 낮게 깔아 보냅니다!"], crossCut:["{p}, 컷백!"],
  second:   ["🔁 세컨드 볼! {p}이/가 다시 잡습니다!","🔁 흘러나온 공 — {p}이/가 가장 빨랐습니다!"],
  oneTwo:   ["🔁 2대1! {p}, {q}에게 되돌려줍니다!","🔁 벽패스 — {p}이/가 원터치로 내줍니다!"],
  lineGap:  ["🚨 수비 라인이 깨졌습니다 — {p}, 그 공간을 찔러줍니다!","🚨 센터백이 끌려 나온 자리! {p}이/가 놓치지 않습니다!"],
  thruFail: ["패스가 조금 깁니다 — 골키퍼가 거둬들입니다","뒷공간을 노렸지만, 골키퍼가 먼저 닿습니다"],
  crossClr: ["수비가 먼저 걷어냅니다","문전에서 수비가 차단해 냅니다"],
  /* 🎯 압박 결과 → 인과 문장 (제보 — 「하이라이트 시스템에도 엄청 좋다」) */
  prBeat:   ["{q}, 압박을 벗겨내며 전진합니다!","{q}이/가 {p}의 압박을 정면으로 뚫어냅니다!"],
  prThru:   ["압박 사이로 — {q}, 중앙을 열어냅니다!","{q}, 압박 속에서 가운데를 통과시킵니다!"],
  prWide:   ["{p}의 압박 — {q}, 측면으로 밀려납니다","{p}이/가 안쪽을 지웁니다 — {q}는 밖으로 돌 수밖에 없습니다"],
  prBack:   ["{p}이/가 달려듭니다 — {q}, 뒤로 돌립니다","전진 길이 막혔습니다 — {q}, 백패스"],
  prLong:   ["{p}의 압박에 {q}, 급하게 걷어냅니다","몰렸습니다 — {q}, 일단 길게 찹니다"],
  gkOut:    ["🧤 골키퍼가 나옵니다 — 각을 좁힙니다!"],
  gkRead:   ["🧤 골키퍼가 먼저 읽었습니다 — 빠르게 나옵니다!"]
};
function buildNarrative(hl){
  const evs=hl.evs; if(!evs || evs.length<2) return null;
  const trigT=hl.trigT, out=[], atk=hl.side;
  const F=(pool,vars)=>F_(pool,vars||{});
  const seen={};   // 같은 선수가 같은 계열 문구를 짧은 간격에 반복하지 않게 (§24)
  const add=(t,side,pool,vars)=>{
    const key=side+"|"+((vars&&(vars.p||vars.q))||"")+"|"+pool[0];
    if(seen[key]!=null && t-seen[key]<8) return;
    seen[key]=t;
    const txt=F(pool,vars);
    if(out.length && out[out.length-1].txt===txt) return;   // §50 같은 문장 연속 금지
    out.push({t,side,txt}); };
  // 최근 패스 찾기 — 인터셉트 판정용 (내가 터치한 공을 누가 찼는가)
  let lastPass=null;
  const pre=evs.filter(e=>e.t<trigT-0.05);
  /* ── 인과 연결 (causedBy) — 각 이벤트에 「무엇이 이 사건을 만들었는가」를 단다.
     · TOUCH ← 직전 PASS      : 같은 편이면 RECEIVE, 다른 편이면 INTERCEPT
     · TOUCH ← 직전 SHOT_OUT  : 블록/선방/골대에서 흘러나온 REBOUND (세컨드볼)
     · GK_CATCH ← 상대 스루    : 너무 긴 패스를 키퍼가 거둬들인 THRU_FAIL
     · CLEAR ← 상대 CROSS      : 크로스를 수비가 먼저 걷어낸 CROSS_CLEAR      */
  { let lp=null, lso=null, lcr=null;
    for(const e of evs){
      if(e.ty==="TOUCH" || e.ty==="GK_CATCH"){
        if(lso && e.t-lso.t<2.6) e.cz="REBOUND";
        else if(lp && lp.id===e.from) e.cz=(lp.s===e.s)?"RECEIVE":"INTERCEPT";
        if(e.ty==="GK_CATCH" && lp && lp.s!==e.s && (lp.pt==="THROUGH"||lp.pt==="LEAD") && e.t-lp.t<5.5) e.cz="THRU_FAIL";
        if(!e.cz && lcr && e.s!==lcr.s && e.t-lcr.t<2.8) e.cz="CROSS_CLEAR";
      }
      else if(e.ty==="CLEAR"){
        if(lcr && e.s!==lcr.s && e.t-lcr.t<2.8) e.cz="CROSS_CLEAR";
        else if(e.gk && lp && lp.s!==e.s && (lp.pt==="THROUGH"||lp.pt==="LEAD") && e.t-lp.t<5.5) e.cz="THRU_FAIL";
      }
      if(e.ty==="PASS") lp=e;
      else if(e.ty==="CROSS") lcr=e;
      if(e.ty==="SHOT_OUT") lso=(e.k==="BLOCK"||e.k==="SAVE"||e.k==="POST")?e:null;
    }
  }
  // ── 맥락 감지 (전부 로그 사실 기반) ──
  const firstT=pre.length?pre[0].t:trigT;
  const gkStart = pre.length && (pre[0].ty==="GK_CATCH" || (pre[0].ty==="PASS"&&(pre[0].bu==="FIRST"||pre[0].bu==="RESTART")));
  let counterAt=-1;
  for(const e of pre){
    if((e.ty==="TACKLE"&&e.won&&e.s===atk) ||
       (e.ty==="TOUCH"&&e.s===atk&&lastPass&&lastPass.s!==atk&&lastPass.id===e.from)) counterAt=e.t;
    if(e.ty==="PASS") lastPass=e;
  }
  lastPass=null;
  // ── 이벤트 → 자막 ──
  let flowRun=[];   // 압축 대기 중인 평범한 패스들
  const flush=()=>{
    if(!flowRun.length) return;
    if(flowRun.length>=2){
      // 전진했으면 전진 문구, 아니면 순환 문구 — 실제 x 이동으로 판단한다
      const adv=Math.abs(flowRun[flowRun.length-1].x-flowRun[0].x)>0.12;
      add(flowRun[0].t, flowRun[0].s, adv?NARR.passAdv:NARR.passFlow);
    }
    // 1개짜리는 그냥 침묵 — 모든 패스를 말할 필요가 없다 (§22)
    flowRun=[];
  };
  for(const e of pre){
    const near=trigT-e.t<7;                       // 트리거 임박 — 상세 모드 (§33)
    switch(e.ty){
      case "GK_CATCH":
        if(e.t===firstT && gkStart) add(e.t, e.s, NARR.buildGK);
        break;
      case "PASS": {
        const vars={p:e.nm, q:e.toNm};
        if(e.pt==="THROUGH"||e.pt==="LEAD"){
          flush();
          if(e.lg) add(e.t, e.s, NARR.lineGap, vars);                   // §30 — 라인이 깨진 건 기록된 사실이다
          else add(e.t, e.s, e.pt==="THROUGH"?NARR.through:NARR.keyPass, vars);
          if(e.pt==="THROUGH") add(e.t+0.6, e.s, NARR.throughB, vars);  // 침투는 실제다 — startChase가 뛰게 한다
        }
        else if(e.pt==="SWITCH"){ flush(); add(e.t, e.s, NARR.switchP, vars); }
        else if(e.bu==="ESCAPE"&&near){ flush(); add(e.t, e.s, NARR.escPass, vars); }
        else if(e.press>0.62&&near){ flush(); add(e.t, e.s, NARR.pressPass, vars); }
        else if(e.pt==="LONG"&&near){ flush(); add(e.t, e.s, NARR.longP, vars); }
        else flowRun.push(e);                     // 평범한 패스 — 압축 후보
        lastPass=e;
        break; }
      case "TOUCH": {
        // 인터셉트 — 상대가 찬 공을 내가 잡았다 (인과 연결로 증명되는 사실)
        if(e.cz==="INTERCEPT" && e.s===atk){
          flush();
          add(e.t, e.s, Math.abs(e.t-counterAt)<0.3?NARR.counter:NARR.intercept, {p:e.nm});
        }
        else if(e.cz==="REBOUND" && e.s===atk){ flush(); add(e.t, e.s, NARR.second, {p:e.nm}); }
        else if(e.cz==="CROSS_CLEAR"){ flush(); add(e.t, e.s, NARR.crossClr); }
        else if(e.loose&&near){ flush(); add(e.t, e.s, NARR.touchBad, {p:e.nm}); }
        else if(near && e.q==="PERFECT" && lastPass && (lastPass.pt==="THROUGH"||lastPass.pt==="LEAD") && e.s===atk){
          add(e.t, e.s, NARR.touchGood, {p:e.nm});
        }
        break; }
      case "TACKLE":
        if(e.won){ flush(); add(e.t, e.s, e.s===atk&&Math.abs(e.t-counterAt)<0.3?NARR.counter:NARR.tackleWin, {p:e.nm}); }
        break;
      case "DRIBBLE":
        if(!near) break;
        flush();
        if(e.ds===DRB.KNOCK) add(e.t, e.s, NARR.knock, {p:e.nm});
        else if(e.ds===DRB.FAST) add(e.t, e.s, NARR.fastDrb, {p:e.nm});
        else if(e.ds===DRB.PROTECT) add(e.t, e.s, NARR.protect, {p:e.nm});
        break;
      case "CROSS":
        flush();
        add(e.t, e.s, e.ct===CROSS_TYPE.CUTBACK?NARR.crossCut:(e.traj===CROSS_TRAJ.LOW?NARR.crossLow:NARR.crossUp), {p:e.nm});
        break;
      case "GK_RUSH":
        if(near) { flush(); add(e.t, e.s, e.stg==="ANTICIPATE"?NARR.gkRead:NARR.gkOut); }
        break;
      case "CLEAR":
        if(e.cz==="CROSS_CLEAR"){ flush(); add(e.t, e.s, NARR.crossClr); }
        else if(e.cz==="THRU_FAIL"){ flush(); add(e.t, e.s, NARR.thruFail); }
        break;
      case "ONE_TWO":
        flush(); add(e.t, e.s, NARR.oneTwo, {p:e.nm, q:e.toNm});
        break;
      /* 🎯 압박 결과 → 인과 문장. e.s 는 압박자 쪽, e.car 는 눌린 캐리어.
         · 공격팀 캐리어가 압박을 뚫었다(BEATEN) — 이 장면의 주인공 서사
         · 공격팀의 압박이 상대를 몰아냈다(FORCE_*) — 소유 획득 직전의 인과(임박 구간만)
         · WIN 은 침묵 — TACKLE/인터셉트/역습 자막이 이미 그 순간을 말한다 (중복 금지) */
      case "PRESS_RES":
        if(e.how==="recover") break;
        if(e.res==="BEATEN" && e.s!==atk){
          flush(); add(e.t, atk, e.how==="pass"?NARR.prThru:NARR.prBeat, {p:e.nm||"", q:e.car});
        } else if(near && e.s===atk){
          if(e.res==="FORCE_LONG"){ flush(); add(e.t, e.s, NARR.prLong, {p:e.nm, q:e.car}); }
          else if(e.res==="FORCE_WIDE"){ flush(); add(e.t, e.s, NARR.prWide, {p:e.nm, q:e.car}); }
          else if(e.res==="FORCE_BACK" && trigT-e.t<4){ flush(); add(e.t, e.s, NARR.prBack, {p:e.nm, q:e.car}); }
        }
        break;
      // CLEAR·SHOT·SHOT_OUT — 빌드업 구간의 걷어내기는 침묵, 슛 계열은 트리거 뒤 기존 자막이 맡는다
    }
  }
  flush();
  // 트리거 이후 — 슛/선방/골 자막은 기존 시스템이 맡고, 여기서는 「관계」 라인만 끼워 넣는다
  for(const e of evs){
    if(e.t<trigT-0.05) continue;
    if(e.ty==="TOUCH" && e.cz==="REBOUND" && e.s===atk) add(e.t+0.05, e.s, NARR.second, {p:e.nm});
    else if(e.cz==="THRU_FAIL") add(e.t, atk, NARR.thruFail);
    else if(e.cz==="CROSS_CLEAR") add(e.t, e.s, NARR.crossClr);
  }
  if(!out.length) return null;   // 말할 게 없으면 기존 자막을 그대로 둔다 (한 줄짜리 장면까지 침묵시키지 않게)
  // §20 분량 제한 — 빌드업은 최대 7줄 (뒤에서부터 남긴다: 마지막이 제일 중요하다)
  return out.length>7 ? out.slice(out.length-7) : out;
}

/* 결정적 장면이 잡혔다 — 결말까지 조금 더 굴린 뒤, 빌드업부터 잘라 재생 목록을 만든다 */
function startHighlight(){
  const s=liveSim, hl=s.hl; s.hl=null;
  // ── 결말이 날 때까지 마저 녹화한다.
  //    트리거는 "슛을 때리기로 결정한 순간"이라 공은 아직 발 앞에 있다. 여기서 시간으로 잘라 버리면
  //    날아가는 도중에 화면이 끊긴다. 대신 공이 실제로 잠잠해질 때까지 따라간다 —
  //    슛 → 키퍼 선방 → 리바운드 → 정리, 또는 골대 맞고 튕겨 나가 골라인 아웃까지가 한 장면이다.
  /* 🅿️ ⚠ 제보 원문 — 「추가시간에 페널티킥이 주어졌는데 보지 않고 그냥 건너뛰어서 경기가 종료된다.
     끝까지 페널티킥을 하이라이트로 충분히 보고 종료되게 해 달라」.
     원인 — 하이라이트는 「공이 잠잠해지면」 끊는다(HL_SETTLE 2.2초). 그런데 PK 는 선언 직후
        공이 점 위에 놓인 채 十여 초를 기다린다 — 그 정지 상태가 「잠잠함」으로 읽혀 장면이
        선언 2.5초 만에 잘렸다. 정작 차는 장면은 화면 밖에서 지나갔다.
     ─ PK 장면은 공이 실제로 발을 떠날 때까지 끊지 않는다. 선언 → 런업 → 킥 → 결과가 한 장면이다. */
  const isPen = hl.kind==="pen";
  const tMin=s.t+HL_TAIL_MIN, tMax=s.t+(isPen?HL_TAIL_MAX*2.5:HL_TAIL_MAX);
  let calm=0, guard=0, pending=null;
  while(s.t<tMax && (s.clock<s.endSec || s.varPending || s.pkHold()) && guard++<900){
    s.tick();
    /* ⚠ 예전에는 꼬리 구간의 새 트리거를 무조건 지웠다(s.hl=null). 슛 장면 직후 반칙 → PK가 나면
       PK 트리거가 여기서 삼켜져서, PK가 하이라이트도 해설도 없이 라이브로 흘러갔다("아무 말 없이
       바로 PK"라는 그 제보). 골은 이 장면의 결말이라 합치는 게 맞지만, PK·퇴장은 새 사건이다 —
       현재 장면을 여기서 끊고, 트리거를 남겨 다음 장면으로 잇는다. */
    if(s.hl && (s.hl.kind==="pen"||s.hl.kind==="red") && !pending) pending=s.hl;
    s.hl=null;
    if(pending) break;
    const b=s.ball;
    if(b.celebrate){                            // 골 — 세리머니를 조금 보고 끊는다
      calm=0;
      if(b.celebrate.t>=HL_CELEB) break;
      continue;
    }
    /* 🅿️ 아직 차지 않은 페널티킥 — 공이 점 위에 멈춰 있어도 장면이 끝난 게 아니다 (제보) */
    if(isPen && s.penPending()){ calm=0; continue; }
    // 공이 날아가거나 굴러다니는 동안은 장면이 끝난 게 아니다
    const moving = b.state==="SHOT" || b.state==="PASS" || b.state==="LOOSE";
    calm = moving ? 0 : calm+SIM_DT;
    if(s.t>=tMin && calm>=HL_SETTLE) break;     // 잠잠해졌다 — 여기서 장면 종료
  }
  s.syncClock(); s.syncStats();
  // 버퍼에서 [트리거 리드인 전 → 지금] 구간을 잘라낸다 — 리드인은 장면 종류별로 다르다
  const lead=HL_LEAD_BY[hl.kind]||HL_LEAD;
  let from=hl.t-lead;
  // 자연스러운 시퀀스 시작점 — 리드인 구간 안에서 공격팀이 소유를 얻은 순간이 있으면 거기부터.
  // (그 앞은 상대의 공놀이라 이 장면의 서사가 아니다. 못 찾으면 = 긴 우리 소유 → 풀 리드인)
  { let lp=null, gain=null;
    for(const e of s.evlog){
      if(e.t<from){ if(e.ty==="PASS") lp=e; continue; }
      if(e.t>hl.t-2.5) break;
      if(e.s===hl.side && ((e.ty==="TACKLE"&&e.won) || e.ty==="GK_CATCH" ||
         (e.ty==="TOUCH" && lp && lp.s!==hl.side && lp.id===e.from))){ gain=e.t; break; }
      if(e.ty==="PASS") lp=e;
    }
    if(gain!=null) from=Math.max(from, gain-1.5);
    from=Math.min(from, hl.t-(HL_LEAD_MIN_BY[hl.kind]||HL_LEAD_MIN));   // 소유획득 스냅이 있어도 등급별 최소 빌드업은 보여준다
  }
  const frames=s.buf.filter(f=>f.t>=from);
  if(frames.length<4){ s.buf.length=0; return; }   // 보여줄 게 없으면 그냥 넘어간다
  liveHL={ frames, i:0, acc:0, kind:hl.kind, side:hl.side, trigT:hl.t,
           t0:frames[0].t, tEnd:frames[frames.length-1].t, last:null,
           caps:s.caps.filter(c=>c.t>=from), ci:0,      // 이 구간의 해설 자막도 함께 잘라 온다
           evs:s.evlog.filter(e=>e.t>=from) };          // 📓 장면 재구성용 이벤트 로그
  // 📖 빌드업 자막 재구성 — 트리거 이전의 낱개 패스 자막을 내러티브로 교체한다.
  //    실패하면 기존 자막이 그대로 나간다 (안전망).
  try{
    const nar=buildNarrative(liveHL);
    if(nar && nar.length){
      const hasPre=nar.some(l=>l.t<liveHL.trigT-0.05);
      const keep=liveHL.caps.filter(c=>c.t>=liveHL.trigT-0.05 || !c.rt || !hasPre);
      liveHL.caps=nar.concat(keep).sort((a,b)=>a.t-b.t);
    }
  }catch(e){}
  if(pending){
    // PK·퇴장 장면을 위해 그 앞 구간의 프레임·해설은 남겨 둔다
    const keepFrom=pending.t-(HL_LEAD_BY[pending.kind]||HL_LEAD);
    s.buf=s.buf.filter(f=>f.t>=keepFrom);
    const keptCaps=s.caps.filter(c=>c.t>=keepFrom);
    s.caps.length=0; for(const c of keptCaps) s.caps.push(c);
    const keptEv=s.evlog.filter(e=>e.t>=keepFrom);
    s.evlog.length=0; for(const e of keptEv) s.evlog.push(e);
    s.hl=pending;                                   // 이 장면 재생이 끝나면 곧바로 PK 장면이 시작된다
  } else {
    /* 🎬 다 비우면 20초 안에 오는 다음 장면의 리드인이 잘린다(실측: 확장 레벨 장면의 4분의 1이
       빌드업 없이 시작). PK 체이닝의 keepFrom 수법을 일반화 — 직전 15초는 남긴다. */
    const _kf=s.t-15;
    s.buf=s.buf.filter(f=>f.t>=_kf);
    const _kc=s.caps.filter(c=>c.t>=_kf); s.caps.length=0; for(const c of _kc) s.caps.push(c);
    const _ke=s.evlog.filter(e=>e.t>=_kf); s.evlog.length=0; for(const e of _ke) s.evlog.push(e);
  }
  setMatchMode(MATCH_MODE.HIGHLIGHT);
  // ⚠ 여기서 "골"·"결정적 기회" 같은 장면 종류를 띄우면 결과를 미리 알려주는 꼴이다.
  //    무슨 일이 벌어지는지는 화면과 해설로만 알게 한다.
  // 예전에는 여기서 캡션을 "▶ 중계 중"으로 덮어썼다. 그 자리는 해설이 들어갈 자리이고,
  // 해설이 경기 화면 위에 겹쳐 뜨는 바람에 피치 하단이 가려졌다. 이제 해설이 캡션 바에 들어간다.
  // ⚠ 제보 — ""를 넘기면 텍스트를 안 건드려서, 직전 장면이 끝나며 남긴 "다음 장면을
  //    기다리는 중..."이 재생이 시작된 화면 위에 그대로 떠 있었다. 첫 해설이 나오기 전까지의
  //    빈 시간을 중립 문구로 채운다 (장면 종류는 말하지 않는다 — 결과 스포일러 금지).
  resetComm("🎥 장면이 이어집니다…");
}
/* 하이라이트 한 프레임 진행 — 화면 렌더 루프(60fps)에서 호출된다 */
function advanceHighlight(dtSec){
  const hl=liveHL; if(!hl) return;
  hl.lastAdv=nowMs();
  // 리플레이는 일부러 느리게 — 무슨 일이 있었는지 눈으로 따라갈 수 있게
  const rate = HL_RATE * liveMul() * (hl.isReplay ? HL_REPLAY_RATE*0.5*replayMulUI() : 1); // 슬로모 — 기본 2배속 상쇄 × 사용자 다시보기 배속
  /* 🎾 ⚠ 제보 원문 — 「매치엔진에서 공이 막 스킵되면서 라인 아웃되는 경우가 간헐적으로 보인다」.
     원인: 재생헤드를 「흐른 시간 × 배속」만큼 한 번에 밀고 있었다. 화면이 한 번 버벅이면
        (다른 탭에서 돌아왔을 때·GC·모바일 프레임 하락) dtSec 이 0.5초까지 튀는데,
        2배속이면 그 한 번의 호출로 재생헤드가 다섯 칸(=시뮬 1초) 앞으로 뛴다.
        프레임 사이 보간은 「다음 한 칸」만 이어 주므로, 그렇게 뛴 만큼은 그냥 순간이동으로 보인다.
        날아가던 공은 틱당 최대 11m 라, 다섯 칸이면 50m 를 건너뛴다 — 그 사이에 라인을 넘으면
        「공이 확 튀더니 아웃」이 된다.
     ─ 한 번의 화면 갱신으로는 최대 두 칸까지만 민다. 넘치는 시간은 버린다(느리게 재생될 뿐
       장면이 잘리지는 않는다). 60fps 기준 2배속이 필요로 하는 양은 0.07칸이라 평소에는
       이 상한에 닿지도 않는다 — 버벅인 그 순간에만 작동한다. */
  hl.acc += Math.min(dtSec, 0.12)*rate;               // 한 번에 너무 많이 건너뛰지 않게 (탭 복귀 시 순간이동 방지)
  let _adv=0;
  while(hl.acc>=SIM_DT && hl.i<hl.frames.length-1 && _adv<HL_MAX_STEP){ hl.acc-=SIM_DT; hl.i++; _adv++; }
  if(hl.acc>SIM_DT) hl.acc=SIM_DT;                    // 밀린 시간은 쌓아 두지 않는다
  // 재생헤드가 지난 해설만 공개한다 — 화면보다 글이 앞서 결과를 알려 버리지 않게
  const ph=hl.frames[hl.i].t;
  revealEventsUpTo(ph);
  /* 🟥 퇴장 명단도 재생헤드를 따라간다 — 장면이 카드에 도달한 순간 옆 칸에 뜬다 */
  try{ syncSentOffPanel(); }catch(e){}
  // 하단 해설 자막 — 지금 화면에서 벌어지는 동작을 그대로 읽어 준다
  while(hl.ci<hl.caps.length && hl.caps[hl.ci].t<=ph){ showComm(hl.caps[hl.ci]); hl.ci++; }
  if(hl.i>=hl.frames.length-1){ endHighlight(); }
}
function endHighlight(){
  // 골 리플레이 — 방금 본 장면을 골 순간 중심으로 다시, 조금 느리게 보여준다.
  // 설정에서 끌 수 있고, 리플레이 자체는 한 번만 돈다(무한 반복 방지).
  if(liveHL && liveHL.kind==="goal" && !liveHL.isReplay && replayOn()){
    const src=liveHL, gT=src.trigT;
    const frames=src.frames.filter(f=>f.t>=gT-HL_REPLAY_PRE && f.t<=gT+HL_REPLAY_POST);
    if(frames.length>=4){
      liveHL={ frames, i:0, acc:0, kind:"goal", side:src.side, trigT:gT, isReplay:true,
               t0:frames[0].t, tEnd:frames[frames.length-1].t,
               caps:[], ci:0 };   // 리플레이 중에는 해설을 다시 읽지 않는다
      const cap=document.getElementById("pitchCaption");
      if(cap) cap.textContent="🎬 골 장면 리플레이";
      const pm=document.getElementById("pitchMode");
      if(pm) pm.textContent="● 리플레이";
      resetComm("🎬 다시 보겠습니다.");
      return;
    }
  }
  /* 🎞️ 방금까지 보던 마지막 프레임을 붙잡아 둔다 — 다음 장면이 시작될 때까지 화면은 여기서 멈춘다 */
  liveHL=null;
  setMatchMode(MATCH_MODE.TEXT);
  const pm=document.getElementById("pitchMode");
  if(pm) pm.textContent="○ 경기 진행 중";
  const over=liveM && liveM.done;
  const cap=document.getElementById("pitchCaption");
  if(cap) cap.textContent = over ? "🏁 경기 종료" : "다음 장면을 기다리는 중...";
  resetComm(over ? "🏁 경기가 끝났습니다." : null);
  if(liveSim) revealEventsUpTo(liveSim.t);        // 남은 해설을 따라잡는다
  syncLive();
  // 하이라이트 때문에 미뤄 뒀던 하프타임·종료 처리를 이어서 한다
  if(liveSim && !liveSimHalf && liveSim.clock>=liveSim.htSec){
    // ⚠ 여기서 라커룸을 직접 열 때는 htBreak 를 남겨 두면 안 된다.
    //    남겨 두면 후반 첫 틱에서 liveTick 이 그 깃발을 보고 하프타임 토크를 한 번 더 연다.
    liveSimHalf=true; liveM.half=2; liveM.min=45; liveM.htBreak=false;
    if(liveM.opts&&liveM.opts.pvp){ pvpHalftime(); return; }
    livePaused=true; showHalftimeTalk(liveM); return;
  }
  if(liveSim && liveSim.clock>=liveSim.endSec && !liveSim.varPending && !liveSim.pkHold() && !liveM.done){
    if(liveSim.tryExtraTime()){ syncLive(); return; }
    if(pkNeedsPick(liveM) && !PK_PICK){
      livePaused=true;
      if(liveTimer){ clearInterval(liveTimer); liveTimer=null; }
      const _s=liveSim;
      pkPickOpen(liveM, ()=>{ livePaused=false; _s.runShootoutIfNeeded(); _s.finishMatch(); syncLive(); liveFinishUI(); });
      return;
    }
    if(PK_PICK) return;
    liveSim.runShootoutIfNeeded();
    liveSim.finishMatch(); syncLive();
    liveFinishUI();
  }
}
/* 🏁 경기 종료 화면 처리 — 승부차기까지 끝난 뒤에도 같은 마무리를 탄다 */
function liveFinishUI(){
  try{ if(liveTimer){ clearInterval(liveTimer); liveTimer=null; } }catch(e){}
  try{ updLiveCtrl("ft"); }catch(e){}
  try{ const c=document.getElementById("pitchCaption"); if(c) c.textContent="🏁 경기 종료"; }catch(e){}
  try{ resetComm("🏁 경기가 끝났습니다."); }catch(e){}
}
/* 하단 해설 자막 한 줄 — 공을 가진 팀 색이 패널 배경으로 깔린다 (FM의 그 바) */
/* 해설 자막 — 피치 아래 캡션 바에 쓴다.
   예전에는 피치 위에 반투명 바를 얹었는데(commBar.inPitch), 골문 앞 상황이 그 바에 가렸다. */
function showComm(c){
  /* ⚠ 제보(풀 동기화) — 호스트의 해설 자막을 게스트에 그대로 중계한다 */
  try{ if(liveM && liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP && PVP.role==="host")
    pvpSend({t:"cap", x:String((c&&c.txt)||"").slice(0,220), s:(c&&c.side)||""}); }catch(e){}
  const bar=document.getElementById("pitchCaption");
  if(!bar||!liveM) return;
  bar.textContent=c.txt;
  bar.className="pitchCaption";
  const col = c.side==="h" ? (liveM.home.col||"#2ea8ff") : (liveM.away.col||"#f85149");
  setCssVar(bar, "--cbar", col);
  // 골·퇴장처럼 큰 장면은 테두리를 금색으로 물들여 눈에 띄게 한다
  if(bar.classList && bar.classList.toggle) bar.classList.toggle("hot", /⚽|🟥|🅿️/.test(c.txt));
}
function setCssVar(el, k, v){
  if(!el||!el.style) return;
  if(el.style.setProperty) el.style.setProperty(k, v); else el.style[k]=v;
}
function resetComm(txt){
  /* ⚠ 제보(풀 동기화) — 장면 전환 문구도 게스트와 같이 본다 */
  try{ if(liveM && liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP && PVP.role==="host" && txt!=="")
    pvpSend({t:"cap", x:String(txt||"다음 장면을 기다리는 중...").slice(0,220), s:""}); }catch(e){}
  const bar=document.getElementById("pitchCaption");
  if(!bar) return;
  if(txt!=="") bar.textContent=txt||"다음 장면을 기다리는 중...";
  bar.className="pitchCaption";
  setCssVar(bar, "--cbar", "#1b2129");
  if(bar.classList && bar.classList.remove) bar.classList.remove("hot");
}
/* 해설 공개 — 시뮬 시각이 t 이하인 줄까지만 화면에 내보낸다 */
function revealEventsUpTo(t){
  const M=liveM; if(!M) return;
  let any=false;
  while(liveShown<M.events.length){
    const e=M.events[liveShown];
    if(e.simT!==undefined && e.simT>t) break;    // 아직 화면이 거기까지 안 갔다
    if(liveSim) revealScore(e);                  // 연속 엔진 — 이 줄이 보이는 순간이 곧 공개 시점
    if(e.st) shownSt=e.st;                       // 통계도 이 줄까지만 공개한다
    revealQueue.push(e); liveShown++; any=true;
  }
  if(any) pumpReveal();
}
function setLiveSpeed(ms){ liveSpeed=ms; livePaused=false; if(liveTimer) clearInterval(liveTimer); liveTimer=setInterval(liveTick,ms); updLiveCtrl(); }
/* ── 경기 배속 (FM식 슬라이더) ─────────────────────────────────
   하이라이트 재생 속도와, 장면 사이를 흘려보내는 속도를 함께 바꾼다.
   일시정지 상태는 건드리지 않는다 — 배속을 만졌다고 경기가 멋대로 재개되면 안 된다. */
/* 표시 1× = 실제 2× (2배속이 기본이자 표준 시청 속도). 슬라이더는 표시값 1~5를 다루고,
   엔진·재생은 liveMul()=표시×2 를 쓴다. 구버전 저장(실제값 1~4 저장)은 1회 1×로 리셋. */
/* ⏩ ⚠ 요청 원문 — 「매치엔진 화면에서 배속을 다시 1.0배속부터 5.0 배속까지 5단계로 슬라이더 바로
   적용되게 해줘. 이거 롤백해달라는 요청이 많았거든. / 온라인대전은 지금 2.2 배속 고정이잖아.
   2.0 배속 고정으로 바꾸자」.
   ─ 한동안 기본(2.2)-빠름(3.3)-매우 빠름(4.4) 세 칸 버튼이었다. 원래대로 되돌린다:
     1.0× ~ 5.0× 를 1.0 단위 다섯 칸으로 끄는 슬라이더. 숫자를 그대로 보여 준다.
   ⚠ 표시 1× = 엔진 실제 2× 다(liveMul). 이 관계는 예전 그대로 유지한다. */
const LIVE_SPD_MIN=1, LIVE_SPD_MAX=5, LIVE_SPD_PVP=2.0;   // ⚔️ 온라인 대전 고정 배속 (요청: 2.2 → 2.0)
function liveSpdVal(){
  if(!G.opt) G.opt={};
  let v=+G.opt.speed;
  if(!isFinite(v) || v<LIVE_SPD_MIN || v>LIVE_SPD_MAX){
    /* 세 칸 버튼 시절(_spd3)에 골라 둔 속도가 있으면 가장 가까운 칸으로 옮긴다 */
    const i=(G.opt._spd3==null) ? null : (G.opt._spd3|0);
    v = (i===2) ? 4 : (i===1) ? 3 : (i===0) ? 2 : 1;
  }
  return clamp(Math.round(v), LIVE_SPD_MIN, LIVE_SPD_MAX);
}
function liveMulUI(){
  /* ⚔️ 제보 — 온라인 대전은 배속 고정 (양쪽이 같은 속도의 중계를 본다) */
  try{ if(liveM && liveM.opts && liveM.opts.pvp) return LIVE_SPD_PVP; }catch(e){}
  return liveSpdVal();
}
/* ⏩ 속도·하이라이트 패널 — 경기 화면 우상단 ⏩ 버튼으로 연다 */
function lvSpdPanelHtml(){
  /* ⏩ 요청 — 1.0× ~ 5.0× 다섯 칸 슬라이더로 되돌린다 */
  return `<div class="small">⏩ 경기 속도 <b id="lvSpdLbl" style="color:var(--gold)">${liveSpdVal().toFixed(1)}×</b></div>
    <div class="lvSpd" style="margin:5px 0 0;display:flex;width:100%">
      <input type="range" min="${LIVE_SPD_MIN}" max="${LIVE_SPD_MAX}" step="1" value="${liveSpdVal()}"
             style="width:100%" oninput="setLiveSpd(this.value)">
    </div>
    <div class="small" style="display:flex;justify-content:space-between;opacity:.6;margin-top:2px">
      <span>1.0×</span><span>2.0×</span><span>3.0×</span><span>4.0×</span><span>5.0×</span></div>
    <div class="small" style="margin-top:11px">🎬 하이라이트 빈도${hlPvpLock()?' <span style="color:var(--gold)">🔒 대전 고정</span>':""}</div>
    <div style="display:flex;gap:4px;margin-top:5px">
      ${HL_LV.map((h,i)=>`<button class="mini hlBtn${i===hlLvIdx()?" sel":""}" style="flex:1;padding:5px 3px;font-size:11.5px${hlPvpLock()&&i!==hlLvIdx()?";opacity:.35":""}"
        ${hlPvpLock()?'disabled title="온라인 대전은 확장 하이라이트로 고정입니다"':`onclick="setHlLv(${i})"`}>${h.ic} ${h.n}</button>`).join("")}
    </div>
    <div class="small" style="margin-top:4px;opacity:.75;line-height:1.6">${hlPvpLock()
      ? "⚔️ 온라인 대전은 <b>확장 하이라이트</b>로 고정입니다 — 호스트·게스트가 같은 장면을 봅니다."
      : HL_LV[hlLvIdx()].d}</div>
    <div class="small" style="margin-top:11px">🎞️ 다시보기(리플레이) 배속 <b id="lvRepLbl">${replayMulUI().toFixed(1)}×</b></div>
    <input type="range" min="0.5" max="2" step="0.1" value="${replayMulUI()}"
           oninput="setReplayMul(this.value)">`;
}
function liveSpdName(){
  try{ if(liveM && liveM.opts && liveM.opts.pvp) return LIVE_SPD_PVP.toFixed(1)+"× 고정"; }catch(e){}
  return liveSpdVal().toFixed(1)+"×";
}
function liveMul(){ return liveMulUI()*2; }
function setLiveSpd(v){
  if(!G.opt) G.opt={};
  G.opt.speed=clamp(Math.round(+v||1), LIVE_SPD_MIN, LIVE_SPD_MAX);
  try{ delete G.opt._spd3; }catch(e){}      // 세 칸 시절의 표식은 더 쓰지 않는다
  // 연속 엔진은 간격을 고정하고 "한 번에 굴리는 양"으로 배속을 낸다(stepLiveSim의 시간 예산).
  const ms = liveSim ? LIVE_SIM_TICK_MS : Math.max(24, Math.round(TEXT_TICK_MS/liveMul()));
  liveSpeed=ms;
  if(liveTimer){ clearInterval(liveTimer); liveTimer=setInterval(liveTick, ms); }
  try{ const el=document.getElementById("lvSpdLbl"); if(el) el.textContent=liveSpdVal().toFixed(1)+"×"; }catch(e){}
  updLiveCtrl();   // 스코어버그의 배속 버튼 라벨 갱신
  saveGame();
}
function setLiveMul(v){ setLiveSpd(v); }   // 옛 호출부 호환
function pauseLive(){
  if(liveM && liveM.opts && liveM.opts.pvp){ try{ flash("⚔️ 온라인 대전 중에는 경기를 멈출 수 없습니다.","warn"); }catch(e){} return; }
  livePaused=true; updLiveCtrl(); }
function resumeLive(){
  /* ⏸ 자리 비움·전술 수정 일시정지 중에는 수동 재개 불가 — 각 시스템이 푼다 (제보) */
  if(liveM && liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP && (PVP.awayMe||PVP.awayOpp||PVP.tacEdit||PVP.tacOppOn)) return;
  /* 멈춰 있던 시간만큼 한꺼번에 건너뛰지 않도록 재생 기준 시각을 지금으로 다시 잡는다 */
  try{ if(liveHL) liveHL.lastAdv=nowMs(); lastHLTick=null; }catch(e){}
  livePaused=false; updLiveCtrl();
}
function skipLive(){
  if(!liveM) return;
  while(!liveM.done){
    // 스킵 중에는 사용자가 직접 교체를 결정할 수 없으므로, 다음 분으로 넘어가기 전에 대기 중인 부상 결원을 먼저 자동으로 채운다.
    // (퇴장은 원래도 대체 선수를 투입하지 않으므로 플래그만 해제) — pauseEntryId로 정확히 어느 선수인지 특정해 분(min) 불일치 문제를 피한다.
    if(liveM.needsSubPause){
      const id=liveM.pauseEntryId;
      liveM.needsSubPause=false; liveM.pauseReason=null; liveM.pauseEntryId=null;
      const sd=liveM.home.isUser?liveM.h:liveM.a, key=liveM.home.isUser?"h":"a";
      const entry = id!=null ? sd.list.find(e=>e.p.id===id) : null;
      if(entry && !entry.red){
        autoSubFor(liveM, sd, key, entry);
      }
    }
    stepMinute(liveM);
  }
  // 마지막 분에 걸린 대기 플래그도 정리 (경기가 끝났으니 더 이상 의미 없음)
  liveM.needsSubPause=false; liveM.pauseReason=null; liveM.pauseEntryId=null;
  if(liveTimer){clearInterval(liveTimer); liveTimer=null;} syncLive(false, true); updLiveCtrl("ft"); // 스킵은 결과를 즉시 몰아서 보여준다(줄별 텀 없음)
}
function updLiveCtrl(state){
  /* ⚔️ 제보 — 게스트의 「결과 확인」도 이 순간에 함께 떠야 한다 (버튼 유무와 무관하게 먼저 알린다) */
  if(state==="ft"){ try{ pvpAnnounceEnd(); }catch(e){} }
  const el=document.getElementById("lvCtrl"); if(!el) return;
  if(state==="ft"){ el.innerHTML=`<button class="mini sel" onclick="finishLiveSafe()">📋 결과 확인 ▶</button>`; return; }
  if(state==="ht"){
    /* ⚔️ 온라인 대전 — 양쪽 준비 시스템 (제보) */
    if(liveM && liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP){
      el.innerHTML = (PVP.htMe
        ? `<span class="small" style="color:var(--gold);font-weight:700">⏳ 상대 감독 준비 대기…</span>`
        : `<button class="mini sel" onclick="pvpHtReady()">✅ 후반전 준비 완료</button>`)
        + ` <button class="mini" onclick="pvpTacOpen()" title="하프타임 교체는 수정 기회를 소모하지 않습니다">📋 교체</button>`;
      return;
    }
    el.innerHTML=`<button class="mini sel" onclick="resumeLive()">후반전 시작 ▶</button>`; return; }
  /* ⚔️ 제보 — 온라인 대전: 일시정지·둘러보기·배속 전부 잠긴 기능이라 버튼 자체를 걷어낸다 */
  if(liveM && liveM.opts && liveM.opts.pvp){
    el.innerHTML=`<span class="small" style="opacity:.6" title="온라인 대전은 경기 속도가 고정됩니다 (양쪽이 같은 속도의 중계를 봅니다)">⏩ ${LIVE_SPD_PVP.toFixed(1)}× 고정</span>`;
    return;
  }
  el.innerHTML=`
    <button class="mini ${livePaused?'sel':''}" onclick="${livePaused?'resumeLive()':'pauseLive()'}" title="${livePaused?'재개':'일시정지'}">${livePaused?"▶":"⏸"}</button>
    <button class="mini" onclick="peekLive()" title="경기를 세워 두고 순위표·기록 같은 다른 탭을 봅니다 (보기 전용)">🔍 둘러보기</button>
    <button class="mini" onclick="toggleSpdPanel()" title="경기 속도·다시보기 배속">⏩ ${liveSpdName()} ▾</button>`;
}
/* 하이라이트 씬 하나를 재생 예약한다 — 실제 프레임 그리기는 지속 루프(render2DTick)가 current2DScene을
   매 프레임 읽어서 수행하고, 여기서는 씬을 "선언"하고 완료 콜백만 등록한다. */
/* 진행률 t까지 도달한 자막 비트를 순서대로 내보낸다 */
function fireCommentaryBeats(cs, t){
  while(cs.beats && cs.beats.length && cs.beats[0].at<=t){
    const b=cs.beats.shift();
    if(b.type==="__EVENT__") setCaption2D(cs.event);
    else COMMENTARY.printCommentary(b.type, Object.assign({minute:cs.event.min, color:commTeamColor(cs.event)}, b.data||{}));
  }
}
function playSceneEvent(e, onDone){
  if(!e.scene || !e.form){
    // 연출할 장면이 없는 이벤트 — 자막만 갱신하고 곧바로 다음으로 넘어간다(시계를 붙잡지 않는다)
    setCaption2D(e);
    current2DScene=null;
    revealTimer=setTimeout(()=>{ revealTimer=null; onDone(); }, 0);
    return;
  }
  prepScene(e);
  const dur=SCENE_DURATION[e.scene.kind]||900;
  const cs={event:e, start:nowMs(), dur, done:onDone, beats:(e._beats||[]).slice()};
  fireCommentaryBeats(cs, 0); // 시작 시점(at<=0) 자막은 첫 프레임을 기다리지 않고 바로 띄운다
  current2DScene=cs;
}
/* 큐를 소진한다 — TEXT_MODE에서는 자막만 있는 이벤트를 지체 없이 흘려보내고, scene을 가진 이벤트
   (=찬스/하이라이트)를 만나는 순간 HIGHLIGHT_MODE로 전환해 2D 연출을 시작한다. 큐가 비면 다시 TEXT_MODE.
   instant=true면(스킵 등) 연출 없이 즉시 마지막 상태로 몰아서 보여준다. */
const SUB_PAUSE_MS=2200;   // 교체 장면에서 중계가 멈춰 있는 시간
/* 교체 해설 — 캡션 바에 팀 색을 입혀 읽어 준다 */
function announceSub(sx){
  const more = liveM && liveM.subQueue && liveM.subQueue.length>1;
  /* "…도 손을 씁니다"는 우리가 먼저 바꾼 직후에만 성립한다 — 아니면 그냥 벤치가 움직이는 것 */
  if(liveM && !Array.isArray(liveM._subHist)) liveM._subHist=[];
  const hist=(liveM && liveM._subHist)||[];
  const prev=hist[hist.length-1];
  const react = !sx.isUser && prev && prev.user && (sx.min-prev.min)<=8;
  if(liveM) hist.push({user:!!sx.isUser, min:sx.min||0});
  let pool;
  /* ⚔️ 제보 — 「실시간 대전에서 해설자가 교체를 언급하지 않는다」.
     온라인 대전에서는 상대 벤치가 AI 가 아니라 사람이다 — 「몸 상태가 안 좋아 보였다」처럼
     AI 감독을 짐작하는 문장은 걸러 내고, 우리/상대 두 갈래만 쓴다. */
  const _pvp=!!(liveM && liveM.opts && liveM.opts.pvp);
  /* 🚑 ⚠ 제보 — 부상으로 빈 자리를 메우는 교체는 「벤치가 움직였다」가 아니라
     「한 명이 못 뛰게 됐다」는 소식이다. 그렇게 읽어 줘야 열 명으로 뛰는 이유가 화면에 남는다. */
  if(sx.inj){
    const _t = sx.cn ? `${sx.cn} 감독` : sx.team;
    const _tx = F_(pick([
      "🚑 {t} 벤치가 곧바로 움직입니다 — {o} 대신 {i}. 부상 교체입니다.",
      "🚑 들것이 나가자마자 교체입니다. {o} → {i}, {t}는 열한 명을 유지합니다.",
      "🚑 {o}가 더 못 뜁니다. {t}, 급하게 {i}를 투입합니다.",
      "🚑 계획에 없던 교체입니다. {o}의 자리를 {i}가 대신합니다."]), {t:_t, o:sx.out, i:sx.in});
    const bar0=document.getElementById("pitchCaption");
    if(bar0){
      bar0.className="pitchCaption cmt-big";
      bar0.innerHTML=`<b>${sx.minTxt!=null?sx.minTxt:sx.min}'</b> ${_tx}`;
      if(sx.col) setCssVar(bar0, "--cbar", sx.col);
    }
    try{
      if(liveM && liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP && PVP.role==="host")
        pvpSend({t:"cap", x:(`${sx.minTxt!=null?sx.minTxt:sx.min}' `+_tx).slice(0,220), s:sx.side||""});
    }catch(e){}
    const el0=document.getElementById("lvCtrl");
    if(el0 && !el0.querySelector(".tacApply")) el0.dataset.subFlash="1";
    return;
  }
  if(more) pool=COMM.subMore;
  else if(_pvp) pool = sx.isUser ? COMM.subOur : (react ? COMM.subOppReact : COMM.subOpp);
  else if(sx.min<=30 && !sx.isUser) pool=COMM.subEarly;
  else if(sx.min>=78) pool=COMM.subLate;
  else if(sx.isUser) pool=COMM.subOur;
  else pool = react ? COMM.subOppReact : COMM.subOpp;
  /* AI 구단은 감독 실명으로 읽는다 — "수원 벤치" 대신 "이정효 감독" */
  const txt = F_(pool, {t: sx.cn ? `${sx.cn} 감독` : sx.team, o:sx.out, i:sx.in});
  const bar=document.getElementById("pitchCaption");
  if(bar){
    bar.className="pitchCaption cmt-big";
    bar.innerHTML=`<b>${sx.minTxt!=null?sx.minTxt:sx.min}'</b> ${txt}`;
    if(sx.col) setCssVar(bar, "--cbar", sx.col);
  }
  const el=document.getElementById("lvCtrl");
  if(el && !el.querySelector(".tacApply")) el.dataset.subFlash="1";
  /* ⚔️ 제보 — 교체 해설은 announceSub 가 자막 바에 직접 쓰기 때문에 showComm 중계망을 타지 않아
     게스트 화면에서는 한 줄도 나오지 않았다. 같은 문장을 그대로 보낸다.
     (이 사이 호스트 엔진은 SUB_PAUSE_MS 동안 멈춰 있어 다음 해설이 덮어쓰지 않는다) */
  try{
    if(liveM && liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP && PVP.role==="host")
      pvpSend({t:"cap", x:(`${sx.minTxt!=null?sx.minTxt:sx.min}' `+txt).slice(0,220), s:sx.side||""});
  }catch(e){}
}
function pumpReveal(instant){
  const cv=document.getElementById("pitch2d"); if(!cv) return;
  // 연속 2D 매치엔진으로 치르는 중이라면 "각본 하이라이트"라는 개념 자체가 없다.
  // 화면은 이미 지금 굴러가는 경기를 그리고 있으므로, 여기서는 자막만 흘려보낸다.
  // (이 분기가 없으면 킥오프 씬이 재생 상태로 남아 경기 시계가 0분에서 멈춘다)
  if(liveSim){
    if(revealTimer){ clearTimeout(revealTimer); revealTimer=null; }
    current2DScene=null;
    /* 🅿️ 안전망 — 페널티 선언이 하이라이트 "밖"에서 지나가면 하단 해설 바가 침묵한다.
       그 순간만은 여기서 직접 한 줄 읽어 준다. */
    if(!liveHL) for(const e of revealQueue){
      if(e && e.scene && e.scene.kind==="sim_pen" && e.txt)
        showComm({txt:String(e.txt).replace(/<[^>]*>/g,""), side:(e.scene.side||"h")});
    }
    revealQueue.length=0;
    // ⚠ 여기서 자막(setCaption2D)을 건드리면 하단 해설 바와 두 줄이 겹쳐 나오고,
    //    setMatchMode(TEXT)를 부르면 캔버스에 .dim 이 다시 붙어 하이라이트·리플레이가 흐려진다.
    //    연속 엔진에서 화면 상태는 startHighlight/endHighlight 만 정한다.
    return;
  }
  if(instant){
    if(revealTimer){ clearTimeout(revealTimer); revealTimer=null; }
    current2DScene=null;
    let last=null;
    while(revealQueue.length) last=revealQueue.shift();
    if(last) setCaption2D(last);
    setMatchMode(MATCH_MODE.TEXT);
    return;
  }
  if(revealTimer || current2DScene) return; // 이미 재생 중 — 새 이벤트는 큐에 쌓여 이어서 재생된다
  const step=()=>{
    // 연출할 장면이 나올 때까지 자막만 즉시 갱신하며 큐를 흘려보낸다
    while(revealQueue.length && !(revealQueue[0].scene && revealQueue[0].form)){
      setCaption2D(revealQueue.shift());
    }
    if(!revealQueue.length){ setMatchMode(MATCH_MODE.TEXT); return; } // 하이라이트 종료 → 시계 재개
    setMatchMode(MATCH_MODE.HIGHLIGHT);                              // 찬스 발생 → 시계 정지 + 2D 연출
    playSceneEvent(revealQueue.shift(), step);
  };
  step();
}
function syncLive(goalFlash, instant){
  const M=liveM; if(!M) return;
  const sc=document.getElementById("lvScore"); if(!sc) return;
  // ⚠ M.hg/M.ag 를 그대로 찍으면 안 된다. 시뮬은 하이라이트보다 앞서 있어서 골이 터지기 전에
  //   전광판 숫자가 먼저 올라가 스포일러가 된다. 공개된 이벤트(revealScore)까지만 반영한다.
  // 경기가 끝나고 남은 해설까지 전부 흘러나온 뒤에야 최종 스코어로 맞춘다
  if(M.done && liveShown>=M.events.length && !revealQueue.length && !current2DScene){ shownHg=M.hg; shownAg=M.ag; }
  if(sc.textContent!==`${shownHg} : ${shownAg}`) sc.textContent=`${shownHg} : ${shownAg}`;
  if(goalFlash){ sc.classList.remove("flash"); void sc.offsetWidth; sc.classList.add("flash"); }
  // 하프타임 라커룸에서 막 돌아와 일시정지된 상태(전반 45분에 멈춰 후반 시작을 기다리는 중)에는
  // "45' 후반"처럼 어중간하게 보이거나 초기화 템플릿값인 "0'"이 그대로 남는 것보다 "하프타임"이라고 명확히 표시한다.
  const isHalftimePause = livePaused && !M.done && M.half===2 && M.min===45;
  {
    const lab = M.minTxt!=null ? M.minTxt : matchMinLabel(M, M.min);
    const per = M.done ? " 종료"
              : (M.etOn ? (String(lab).indexOf("120")===0 || (+lab>105) ? " 연장 후반" : " 연장 전반")
                        : (M.half===1 ? " 전반" : " 후반"));
    document.getElementById("lvMin").textContent = isHalftimePause ? "하프타임" : lab+"'"+per;
  }
  /* 🟥 ⚠ 제보 — 「퇴장 장면이 나오기도 전에 전광판 옆에 빨간 카드가 먼저 뜬다」.
     시뮬은 하이라이트보다 앞서 있는데 이 표시만 M.h.red(시뮬 현재값)를 그대로 읽었다.
     퇴장 정보는 화면이 도달한 시점까지만 채우는 전용 패널(syncSentOffPanel)이 따로 있으므로
     전광판 옆 표시는 없앤다 — 같은 정보를 두 곳에서, 그것도 다른 시점으로 보여 줄 이유가 없다. */
  { const _r=document.getElementById("lvRed"); if(_r && _r.innerHTML) _r.innerHTML=""; }
  // 통계 — 화면이 도달한 시점까지만 보여 준다(전광판 점수와 같은 원칙)
  /* 경기가 끝나고 남은 해설까지 전부 흘러나오면 최종값으로 맞춘다 */
  const _allShown = M.done && liveShown>=M.events.length && !revealQueue.length && !current2DScene;
  const st = (liveSim && shownSt && !_allShown) ? shownSt : M.st;
  const r=M.rates||{hs:70,as:70};
  const TH=TAC(M.home);
  /* 점유율만은 시뮬 현재값을 쓴다 — 연속적으로 변하는 값이라 스포일러가 되지 않고,
     줄과 줄 사이에 멈춰 있으면 오히려 어색하다 */
  const _sp=M.st;
  let poss;
  if((_sp.hP||0)+(_sp.aP||0) > 40){
    // 연속 2D 엔진 — 실제로 공을 잡고 있던 시간 비율 그대로
    poss=clamp(Math.round((_sp.hP/(_sp.hP+_sp.aP))*100), 12, 88);
  } else {
    // 분 단위 엔진(관전·AI 경기) — 공격 빈도 추정치로 대신한다
    poss=clamp(Math.round(50+(r.hs-r.as)*1.8+(TH.pass===0?4:TH.pass===2?-4:0)),25,75);
  }
  /* 🎨 통계 색 = 그라운드에서 입고 있는 색.
     ⚠ 제보 — 홈은 늘 하늘색, 원정은 늘 주황색으로 고정돼 있어 대구·강원처럼
        구단 색이 겹치는 매치업에서 어느 쪽이 어느 쪽인지 헷갈렸다.
        피치의 선수 디스크와 「완전히 같은 계산」을 쓴다(awayDiscCol 은 두 색이
        너무 비슷하면 원정을 흰색으로 바꾸는, 실제 어웨이 유니폼과 같은 규칙이다). */
  const _hC=M.home.col||"#2ea8ff";
  const _aC=awayDiscCol(_hC, M.away.col||"#f85149");
  /* 숫자는 어두운 배경에서도 읽혀야 한다 — 색조는 그대로, 밝기만 올린 값을 쓴다 */
  const _hT=uiInk(_hC), _aT=uiInk(_aC);
  const bar=(l,hv,av)=>{const tot=hv+av||1; return `<div class="statbar">`
    +`<span style="width:26px;text-align:right;color:${_hT};font-weight:800">${hv}</span>`
    +`<div class="bg"><div class="fh" style="width:${hv/tot*100}%;background:${_hC}"></div>`
    +`<div class="fa" style="width:${av/tot*100}%;background:${_aC}"></div></div>`
    +`<span style="width:26px;color:${_aT};font-weight:800">${av}</span>`
    +`<span style="width:52px" class="small">${l}</span></div>`;};
  /* 범례 — 어느 색이 어느 팀인지 한 줄로 못박는다 */
  const _lg=`<div class="statLg">`
    +`<span><i style="background:${_hC}"></i><b style="color:${_hT}">${M.home.short||M.home.name}</b> <span class="small">홈</span></span>`
    +`<span class="small" style="opacity:.6">vs</span>`
    +`<span><i style="background:${_aC}"></i><b style="color:${_aT}">${M.away.short||M.away.name}</b> <span class="small">원정</span></span></div>`;
  document.getElementById("lvStats").innerHTML= _lg +
    bar("점유율",poss,100-poss)+bar("슈팅",st.hS,st.aS)+bar("유효슈팅",st.hT,st.aT)+
    bar("코너킥",st.hC,st.aC)+bar("파울",st.hF,st.aF)+bar("경고",st.hY,st.aY)+bar("퇴장",st.hR,st.aR);
  // 중계 로그 — 새로 생긴 이벤트를 큐에 쌓고, 한 줄씩 텀을 두고 공개한다.
  // 하이라이트 중계에서는 재생헤드가 지난 줄만 내보낸다(revealEventsUpTo) — 그래야 화면보다
  // 글이 먼저 나가 "골!"을 미리 알려 버리지 않는다.
  if(liveSim){
    if(liveHL) revealEventsUpTo(liveHL.frames[liveHL.i].t);
    else       revealEventsUpTo(liveSim.t);
  } else {
    while(liveShown<M.events.length){ revealQueue.push(M.events[liveShown++]); }
    pumpReveal(instant);
  }
  // 🟥 퇴장 명단 — 화면이 도달한 시점까지
  try{ syncSentOffPanel(); }catch(e){}
  // 수석코치의 조언 — 매 분 경기 상황(체력·카드·스코어·시간대·슈팅 수)에 맞춰 새로 갱신한다
  renderCoachAdvice();
}
/* 스코어·시간대·슈팅 수 흐름을 보고 수비적으로/공격적으로 갈지에 대한 현실적인 조언을 만든다 */
/* ── 수석코치의 조언 ───────────────────────────────────────────────
   예전 버전은 스코어와 슈팅 수만 보고 네 문장 중 하나를 골랐다. 그래서 어떤 경기에서든
   비슷한 말이 나왔고, "그래서 뭘 하라는 건지"가 없었다.
   지금은 연속 엔진이 점유율·패스 성공률·크로스·돌파·공중볼·태클까지 전부 갖고 있으므로,
   그 숫자를 읽고 "지금 무엇이 안 되고 있는지 + 어느 손잡이를 돌려야 하는지"를 짚는다.
   우선순위대로 최대 다섯 줄까지만 내보낸다 — 다 늘어놓으면 아무것도 안 읽힌다. */
function coachStats(M, isHome){
  const S=(typeof liveSim!=="undefined" && liveSim && liveSim.stats) ? liveSim.stats : null;
  const st=M.st||{};
  const mine=S ? (isHome?S.h:S.a) : null, opp=S ? (isHome?S.a:S.h) : null;
  const pct=(a,b)=> (a+b)>0 ? Math.round(a/(a+b)*100) : 50;
  return {
    S, mine, opp,
    shot:  S? mine.shot : (isHome?st.hS:st.aS)||0,
    oShot: S? opp.shot  : (isHome?st.aS:st.hS)||0,
    shotOn: S? mine.shotOn : 0,
    poss:  S ? pct(mine.poss, opp.poss) : 50,
    passOk: S && mine.pass>20 ? Math.round(mine.passOk/mine.pass*100) : null,
    oPassOk: S && opp.pass>20 ? Math.round(opp.passOk/opp.pass*100) : null,   // 🧷 마킹 조언이 본다
    cross: S? mine.cross : 0,
    crossOk: S && mine.cross>0 ? Math.round(mine.crossOk/mine.cross*100) : null,
    takeOn: S? mine.takeOn : 0,
    takeOnPct: S && mine.takeOn>3 ? Math.round(mine.takeOnWon/mine.takeOn*100) : null,
    aerialPct: S && mine.aerial>3 ? Math.round(mine.aerialWon/mine.aerial*100) : null,
    tackle: S? mine.tackle : 0,
    foul: S? mine.foul : 0,
    offside: S? mine.offside : 0,
    thirds: S? S.thirds : null,
    /* ── 아래는 「왜 안 되는가」를 짚기 위한 세부 지표 ── */
    shotOnPct: S && mine.shot>=4 ? Math.round(mine.shotOn/mine.shot*100) : null,
    shotBlockPct: S && mine.shot>=5 ? Math.round(mine.shotBlocked/mine.shot*100) : null,
    shotLongPct: S && mine.shot>=5 ? Math.round(mine.shotLong/mine.shot*100) : null,
    shotClose: S? mine.shotClose : 0,
    save: S? opp.save : 0,                       // 상대 골키퍼가 막아 낸 수
    woodwork: S? mine.woodwork : 0,
    /* 우리가 공을 잡고 있던 구역 비율 — 상대 진영에 못 들어가면 z3 가 바닥이다 */
    z3: S && (mine.z1+mine.z2+mine.z3)>200 ? Math.round(mine.z3/(mine.z1+mine.z2+mine.z3)*100) : null,
    oZ3: S && (opp.z1+opp.z2+opp.z3)>200 ? Math.round(opp.z3/(opp.z1+opp.z2+opp.z3)*100) : null,
    backPct: S && mine.pass>40 ? Math.round(mine.back/mine.pass*100) : null,
    fwdPct: S && mine.pass>40 ? Math.round(mine.fwd/mine.pass*100) : null,
    lost: S? mine.lost : 0,
    oIntercept: S? opp.intercept : 0,
    corner: S? mine.corner : 0,
    longPassT: S? mine.longPassT : 0,
    pass: S? mine.pass : 0,
    goal: S? mine.goal : 0,
    /* 상대의 위험도 — 우리 수비가 실제로 막고 있는지 */
    oShotOn: S? opp.shotOn : 0,
    oShotClose: S? opp.shotClose : 0,
    oTakeOnWon: S? opp.takeOnWon : 0
  };
}
/* 📈 흐름 — 「최근 15분」과 전체를 견준다. 총합만 보면 초반에 벌어 둔 우위로
   지금 밀리고 있다는 사실이 가려진다. 코치가 가장 먼저 말해야 할 것은 「지금」이다. */
function coachMomentum(M, c){
  if(!c.S) return null;
  const now={min:M.min, shot:c.shot, oShot:c.oShot, poss:c.poss, z3:c.z3||0};
  const prev=M._coachSnap;
  /* 15분마다 스냅샷을 새로 뜬다 */
  if(!prev || M.min-prev.min>=15){ M._coachSnap=now; }
  if(!prev || M.min-prev.min<6) return null;
  const dS=now.shot-prev.shot, dO=now.oShot-prev.oShot, span=now.min-prev.min;
  if(span<6) return null;
  return {span, dS, dO, dPoss:now.poss-prev.poss, dZ3:now.z3-prev.z3};
}
/* ═══ 🕵️ 상대 벤치의 움직임 ═══════════════════════════════════════════
   상대 감독이 경기 중 전술을 바꾸면 여기에 쌓인다. 해설이 경기를 세우고 읽는 대신,
   수석코치가 조언 패널에서 짚어 준다 — 리그·컵·EACL·친선 모두 같은 방식이다. */
const OPP_TAC_KEEP=4;        // 최근 몇 건까지 들고 있을 것인가
function noteOppTactic(M, o){
  if(!M || !o) return;
  if(!Array.isArray(M.oppTac)) M.oppTac=[];
  M.oppTac.push({side:o.side, coach:o.coach||o.team, team:o.team, min:o.min||0,
                 /* 🕐 제보 — min 은 재생헤드 비교용(내부 분), minTxt 가 화면에 찍히는 글자 */
                 minTxt:recMinTxt(M, o.min||0),
                 form:o.form||null, msg:o.msg||"", t:(typeof nowMs==="function"?nowMs():0)});
  if(M.oppTac.length>OPP_TAC_KEEP) M.oppTac.splice(0, M.oppTac.length-OPP_TAC_KEEP);
}
/* 지금 화면에 「이미 벌어진 일」로 공개해도 되는 상대 전술 변화만 골라 준다.
   ⚠ 하이라이트 재생 중에는 시뮬이 앞서 있으므로, 재생헤드보다 뒤의 사건만 보여 준다(스포 방지). */
function oppTacVisible(M){
  if(!M || !Array.isArray(M.oppTac) || !M.oppTac.length) return [];
  let cutMin=M.min;
  try{
    if(liveSim){
      const sec = (liveHL && liveHL.frames && liveHL.frames[liveHL.i])
        ? (liveHL.frames[liveHL.i].clock!=null ? liveHL.frames[liveHL.i].clock : liveSim.clock)
        : liveSim.clock;
      cutMin=Math.floor((sec||0)/60);
    }
  }catch(e){}
  return M.oppTac.filter(x=>x.min<=cutMin);
}
/* 🟥 화면에 이미 공개된 「우리 퇴장」 수 — 하이라이트 재생 중에는 시뮬이 앞서 있다.
   ⚠ 제보 — 「퇴장 장면이 나오기도 전에 수석코치가 "수적 열세입니다" 조언을 한다」.
     조언 패널이 시뮬의 실시간 상태(sd.red)를 읽어서, 재생헤드가 그 장면에 닿기 전에
     스포일러가 났다. 퇴장 명단(liveSentOffHtml)과 같은 재생헤드 필터를 태운다. */
function shownRedCount(M, key){
  try{
    if(liveSim && Array.isArray(liveSim.sentOff)){
      /* 🟥 퇴장 명단(liveSentOffHtml)과 완전히 같은 판정을 쓴다 — 두 곳의 말이 어긋나지 않게 (제보) */
      return liveSim.sentOff.filter(x=>x.side===key && revealedAt(x.t)).length;
    }
  }catch(e){}
  return (key==="h"?M.h:M.a).red||0;   // 분 단위 엔진 — 지연 재생이 없으니 그대로
}
/* 🟥 화면에 공개된 기준으로 「지금 그라운드에 몇 명인가」 — 퇴장 + 채우지 못한 부상 공백.
   ⚠ 제보 원문 — 「상대도 한 명 퇴장, 우리도 한 명 퇴장이라 10명 대 10명인데 수석코치가
      '수적 열세입니다' 라고 한다. 상대보다 우리 숫자가 적을 때만 나오게 해 달라」.
   원인 — 조언이 「우리 퇴장이 한 명이라도 있는가」만 봤다. 상대 인원은 아예 세지 않았다. */
function shownOnPitch(M, key){
  try{
    const sd=(key==="h")?M.h:M.a;
    const red=shownRedCount(M, key);
    /* 🚑 부상 공백도 재생헤드로 거른다 — 예전에는 안 걸러서 조언이 장면보다 먼저 인원을 흘렸다 (제보) */
    const gap=shownGaps(M, key).length;
    return Math.max(7, 11-red-gap);
  }catch(e){ return 11; }
}
/* ═══ 🎩 조언 렌즈 ══════════════════════════════════════════════
   같은 경기 상황을 보고도 코치마다 다른 것을 본다. 조언 문장을 새로 쓰는 게 아니라,
   「이 코치가 그걸 봤겠는가」를 판정해서 걸러 낸다.
     · 줄 수      — 종합이 낮으면 조언 자체가 적다 (3줄 ~ 7줄)
     · 누락       — 담당 능력치가 낮으면 그 계열 조언을 못 보고 지나친다
     · 지표       — 경기판단이 낮으면 머리줄에서 세부 지표가 빠진다
     · 확신       — 경기판단이 낮으면 말끝이 흐려진다
     · 오조언     — 경기판단 11 이하면 방향이 반대인 조언이 섞인다
   ⚠ 판정을 매번 난수로 뽑으면 패널을 다시 그릴 때마다 조언이 깜빡인다.
      경기 + 태그 + 문장으로 해시를 만들어 고정한다 — 한 경기 안에서는 늘 같은 판단이다.
   ⚠ "always" 태그(퇴장·수적 우열, 마지막 정리 한 줄)는 절대 감추지 않는다.
      퇴장 정보가 안 보이는 건 예전에 제보로 잡은 버그다. 되살리면 안 된다. */
function acMatchKey(M){
  try{ return `${M.home.id}@${M.away.id}#${M.round||G.round||0}/${G.season||0}`; }catch(e){ return "m"; }
}
const AC_TAG_ATTR={tac:"tac", att:"att", def:"def", man:"man", flex:"flex", judg:"judg"};
function acLens(M){
  const c=acOf();
  const key=acMatchKey(M);
  if(!c){
    /* 공석 — 옆에 아무도 없다. 눈에 띄는 것 두어 개가 전부다. */
    /* ⚠ 공석이어도 「퇴장·수적 우열」과 마지막 정리 한 줄(always)은 남는다.
       그건 코치가 짚어 주는 정보가 아니라 감독의 눈에도 보이는 사실이다. */
    return {none:true, key, n:2, keep:(tag)=>tag==="always", hedge:()=>"", bits:1, wrong:null, judg:0};
  }
  const o=acOvr(c), jg=c.judg|0;
  const n=clamp(3+Math.round((o-10)/2.0), 3, 7);
  const keep=(tag, html)=>{
    if(tag==="always") return true;
    const k=AC_TAG_ATTR[tag]; if(!k) return true;
    const a=c[k]|0;
    const pHide=clamp((15-a)*0.055, 0, 0.40);
    if(pHide<=0) return true;
    const h=uidHash(key+"|"+tag+"|"+String(html).slice(0,48));
    return ((h%1000)/1000) >= pHide;
  };
  /* 말끝 — 판단이 흐린 코치는 단정하지 못한다 */
  const hedge=(html)=>{
    if(jg>=13) return "";
    const h=uidHash(key+"|h|"+String(html).slice(0,48));
    const pH=clamp((13-jg)*0.16, 0, 0.65);
    if(((h%1000)/1000) >= pH) return "";
    return ` <span class="small" style="opacity:.6">${pick2(h, ["…확신은 없습니다만.","…제 눈에는 그렇습니다.","…아닐 수도 있습니다."])}</span>`;
  };
  /* 📊 분석가 — 벤치로 넘어오는 실시간 지표의 양. 수석코치의 눈만으로는 여기까지 못 본다. */
  let bits = jg>=15 ? 4 : jg>=12 ? 3 : jg>=9 ? 2 : 1;
  let anBonus=0;
  try{ const a=acAnaLv(); anBonus = a>=16?2 : a>=13?1 : 0; }catch(e){}
  bits=clamp(bits, 1, 4);
  return {none:false, key, n, keep, hedge, bits, judg:jg, coach:c, ana:anBonus};
}
function pick2(h, arr){ return arr[h%arr.length]; }
/* 🎭 오조언 — 경기판단이 낮은 코치는 가끔 상황을 거꾸로 읽는다.
   ⚠ 선택 원문 — 「가끔 대놓고 틀린 조언까지」.
   경기당 최대 한 개. 티가 나는 표식은 붙이지 않는다 — 그게 이 기능의 전부다.
   대신 패널 머리줄에 코치의 「경기판단」 수치를 늘 띄워 둔다. 감독은 알고 쓰는 것이다. */
function acWrongLine(M, LZ, st){
  if(LZ.none || LZ.judg>=11 || st.min<22) return null;
  const pW=clamp((11-LZ.judg)*0.10, 0, 0.35);
  const h=uidHash(LZ.key+"|wrong");
  if(((h%1000)/1000) >= pW) return null;
  const C=[];
  if(st.diff>0)      C.push(`🔥 앞서고는 있지만 여기서 멈추면 따라잡힙니다. <b>라인을 끝까지 올리고</b> 한 골 더 가져가시죠.`);
  if(st.diff<0)      C.push(`🛡️ 지금은 무리할 때가 아닙니다. <b>라인을 내리고</b> 실점부터 막은 뒤에 기회를 보시죠.`);
  if(st.tiredN>0)    C.push(`💪 다리는 아직 남아 있습니다. <b>교체 카드는 마지막 10분</b>까지 아껴 두시죠.`);
  if(st.poss>=55)    C.push(`🧱 점유를 상대에게 내주고 있습니다. 중원을 두껍게 가져가 <b>공을 되찾는 게</b> 먼저입니다.`);
  if(st.poss<=45)    C.push(`🧩 공은 우리가 쥐고 있습니다. 조급해하지 말고 <b>지금 리듬을 그대로</b> 가져가시죠.`);
  if(st.shotDiff>0)  C.push(`😵 슈팅에서 밀리고 있습니다. 공격 숫자를 <b>한 명 더</b> 올려야 합니다.`);
  if(!C.length)      C.push(`⚖️ 지금은 아무것도 건드리지 않는 게 낫습니다. 형태만 지키시죠.`);
  return C[h%C.length];
}
function renderCoachAdvice(){
  const M=liveM; const el=document.getElementById("lvPanel"); if(!el||!M) return;
  /* ⚔️ 온라인 대전 — 조언 대신 실시간 전술 지시 패널 (게스트와 완전히 같은 조작권) */
  if(M.opts && M.opts.pvp){
    /* ⚠ 제보(실시간 채팅) — 매번 다시 그리면 채팅 입력이 날아간다. 한 번만 그리고,
       슬라이더·채팅 로그는 각자 자기 조각만 갱신한다. */
    if(el.getAttribute && el.getAttribute("data-pvppanel")==="1") return;
    el.innerHTML=(typeof pvpHostPanel==="function")?pvpHostPanel():"";
    try{ el.setAttribute("data-pvppanel","1"); }catch(e){}
    try{ chatBoxSync(); }catch(e){}      // 💬 제보 — 경기 중 채팅창도 크기 조절
    try{ const _cl=document.getElementById("pvpChatLog"); if(_cl) _cl.scrollTop=_cl.scrollHeight||9e6; }catch(e){}
    return;
  }
  try{ if(el.getAttribute && el.getAttribute("data-pvppanel")) el.removeAttribute("data-pvppanel"); }catch(e){}
  const user=userTeam();
  if(M.home.id!==user.id && M.away.id!==user.id){ el.innerHTML='<span class="small">내 팀 경기가 아닙니다.</span>'; return; }
  const isHome=M.home.isUser;
  const sd=isHome?M.h:M.a, osd=isHome?M.a:M.h;
  const opp=isHome?M.away:M.home;
  const pitch=onPitch(sd).filter(x=>x.p.pos!=="GK");
  /* ⚠ 제보 원문 — 「득점으로 이어지는 공격 상황이 나올때 실제 골이 터지기 전에 '앞서 있다'는
     문구가 표시되는 문제가 있는 것 같고」. 맞다. 시뮬은 하이라이트·문자중계보다 앞서 굴러가므로
     M.hg / M.ag 에는 아직 화면에 나오지 않은 골이 이미 들어가 있다. 전광판이 스포일러를 피하려고
     쓰는 「공개된 점수」(shownHg/shownAg — syncLive 와 같은 값)를 조언도 그대로 쓴다. */
  let _hg=M.hg, _ag=M.ag;
  try{ if(typeof shownHg==="number" && typeof shownAg==="number"){ _hg=shownHg; _ag=shownAg; } }catch(e){}
  const myG=isHome?_hg:_ag, oppG=isHome?_ag:_hg;
  /* 🕐 조언의 시계도 화면 시계를 본다 (제보 ② — 전반 추가시간만큼 앞서 가던 문제) */
  const min=dispMinNum(M), diff=myG-oppG;
  const T=TAC(user), c=coachStats(M, isHome);
  const subsLeft=subMax(M)-(sd.subs||0);
  const L=[];   // {pri, html, tag} — 낮은 pri 가 먼저
  /* 🎩 _tg = 지금 구역의 담당 능력치. 구역마다 바꿔 두고, 예외인 줄만 세 번째 인자로 덮는다. */
  let _tg="judg";
  const add=(pri,html,tag)=>L.push({pri,html,tag:tag||_tg});

  /* ── 사람 문제부터 (제일 급하다) ───────────────────── */
  _tg="always";   // 🟥 퇴장·수적 우열은 어떤 코치라도 본다 (예전 제보 — 이게 안 보이면 버그다)
  /* 🟥 제보 — 상대 인원까지 세고 「우리가 적을 때만」 수적 열세라고 말한다 */
  {
    const _mk=isHome?"h":"a", _ok=isHome?"a":"h";
    const _mine=shownOnPitch(M,_mk), _theirs=shownOnPitch(M,_ok);
    const _cnt=`(${_mine} vs ${_theirs})`;
    if(_mine<_theirs)
      add(0, `🟥 <b>수적 열세</b>입니다 ${_cnt}. 공격 자원 하나를 내리고 중원을 한 명 더 채우는 게 안전합니다.`);
    else if(_mine>_theirs)
      add(0, `🟥 <b>수적 우위</b>입니다 ${_cnt}. 폭을 넓히고 라인을 올려 상대를 좌우로 흔드세요.`);
    else if(_mine<11)
      add(0, `🟥 양 팀 모두 한 명씩 빠져 <b>${_mine} 대 ${_theirs}</b>입니다. 인원은 같지만 공간이 넓어집니다 — 체력 관리와 역습 대비를 함께 챙기세요.`);
  }
  /* 🌦️ ⚠ 요청 — 「수석코치의 조언에서도 날씨 관련해서 조언하게 하자」.
     날씨 자체를 읊지 않는다("비가 옵니다"는 화면 위에 이미 있다) — <b>지금 내 전술 설정</b>과
     대조해서 "그래서 무엇을 돌려야 하는가"만 말한다. 이미 맞게 해 뒀으면 아무 말도 하지 않는다. */
  _tg="tac";      // 🌦️ 날씨 대응은 「내 전술 설정을 어떻게 돌릴 것인가」의 문제다
  {
    const w=M.wx;
    const sev = w ? Math.max(w.wet, w.slip, Math.abs(w.heat), w.wind*0.8) : 0;
    if(w && sev>0.35){
      const hi=(v)=>v>=1.35, lo=(v)=>v<=0.65;   // 슬라이더는 0~2 눈금이다
      if(w.wet>0.45){
        /* 젖은 잔디 — 공이 빠르게 흐른다. 짧게 주고받을수록 위험하고, 키퍼는 공을 흘린다 */
        if(lo(T.pass))
          add(1, `${w.ic} <b>젖은 그라운드</b>인데 <b>짧은 패스</b>로 풀고 있습니다. 공이 예상보다 빠르게 흐릅니다 — 후방에서는 <b>다이렉트하게</b> 넘기는 게 안전합니다.`);
        if(hi(T.line))
          add(1, `${w.ic} 젖은 잔디에서는 <b>백패스와 백헤딩이 미끄러집니다</b>. 라인을 한 칸 내려 뒷공간을 줄이는 걸 권합니다.`);
        add(2, `${w.ic} 키퍼가 공을 잡기 어려운 날입니다 — <b>중거리 슛</b>과 <b>골문 앞 세컨볼</b>을 노려 볼 만합니다.`);
      }
      if(w.slip>0.45){
        /* 미끄러운 잔디 — 태클이 발을 못 멈춘다 */
        if(hi(T.tackle))
          add(1, `${w.ic} <b>태클 강도가 높습니다</b>. 이 그라운드에서는 발이 멈추지 않습니다 — 카드와 부상이 나오기 전에 한 칸 낮추세요.`);
        if(hi(T.press))
          add(2, `${w.ic} 미끄러운 잔디에서 <b>강한 압박</b>은 한 번 벗겨지면 그대로 뚫립니다. 조금 물러서서 간격을 지키는 편이 낫습니다.`);
      }
      if((w.heat||0)>0.45){
        /* 폭염 — 체력이 먼저 무너진다 */
        const dead2=pitch.filter(x=>x.fit<66).length;
        if(hi(T.press) || hi(T.tempo))
          add(1, `${w.ic} <b>폭염</b>입니다. 지금 템포·압박으로는 후반 30분을 못 버팁니다 — 한 칸씩 낮추고 공을 돌리며 쉬어 가세요.`);
        if(min>=55 && subsLeft>0)
          add(1, `${w.ic} 이 더위에서는 <b>교체를 아끼는 게 손해</b>입니다. 남은 카드 ${subsLeft}장, 지금부터 쓰기 시작하세요.${dead2?` (체력 66 미만 ${dead2}명)`:""}`);
        else if(min>=70 && subsLeft===0)
          add(2, `${w.ic} 교체 카드를 다 썼습니다 — 남은 시간은 <b>공을 돌려 쉬는 것</b> 말고 방법이 없습니다.`);
      }
      if((w.heat||0)<-0.25 && min<20)
        add(2, `${w.ic} 추운 날은 <b>초반 15분</b>에 실점이 몰립니다. 몸이 풀릴 때까지는 무리해서 나가지 말고 간격부터 잡으세요.`);
      if((w.wind||0)>0.55){
        add(2, `${w.ic} <b>강풍</b>입니다 — 롱볼과 크로스가 바람을 탑니다. 바람을 안고 뛰는 하프에서는 <b>땅볼로 짧게</b>, 등지는 하프에서는 <b>과감한 롱볼과 중거리</b>가 유효합니다.`);
        if(hi(T.pass))
          add(2, `${w.ic} 지금 <b>롱볼 위주</b>인데 바람이 셉니다. 낙하 지점이 계속 밀리면 세컨볼을 상대가 먹습니다.`);
      }
    }
  }
  _tg="man";      // 😔 체력·경고·교체는 선수관리의 영역이다
  const tired=[...pitch].sort((a,b)=>a.fit-b.fit);
  const dead=tired.filter(x=>x.fit<58);
  /* 🔁 「누구를 빼라」에서 끝내지 않는다 — 그 자리를 맡을 수 있는 벤치 자원을 이름으로 짚어 준다.
     같은 자리 능숙도가 가장 높고, 그중 실력이 나은 선수를 고른다. */
  const _slotOf=(()=>{ try{ return computeRenderSlots(user, onPitch(sd).map(q=>q.p)); }catch(e){ return {}; } })();
  const benchFor=(x)=>{
    try{
      const sl=_slotOf[x.p.id] || x.slot || (sd.slotOf&&sd.slotOf[x.p.id]) || prefSlotOf(x.p);
      const cands=(sd.bench||[]).filter(q=>q && !q.inj && q.pos!=="GK");
      if(!cands.length) return null;
      const best=cands.map(q=>({q, f:getPosFam(q, sl), lv:playerLevel(q)}))
                      .sort((a,b)=>(b.f-a.f)||(b.lv-a.lv))[0];
      /* 능숙도가 어중간해도 알려는 준다 — 대안이 낯선 자리라는 사실도 감독이 알아야 할 정보다 */
      return (best && best.f>=30) ? best : null;
    }catch(e){ return null; }
  };
  if(dead.length){
    const b0=benchFor(dead[0]);
    add(1, `😔 <b>${dead.slice(0,2).map(x=>x.p.name).join(", ")}</b> 다리가 완전히 풀렸습니다(체력 ${Math.round(dead[0].fit)}).
      ${subsLeft>0
        ? `교체 카드가 ${subsLeft}장 남았습니다. 지금 쓰시죠.${b0
            ? ` — <b>${b0.q.name}</b>${b0.f>=70?"이(가) 같은 자리를 봅니다":b0.f>=45?"이(가) 그 자리를 소화합니다":"밖에 없는데 그 자리가 낯섭니다"}(능숙도 ${b0.f}).`
            : " 다만 벤치에 그 자리를 볼 사람이 없습니다 — 자리를 옮겨서라도 메워야 합니다."}`
        : "카드가 없습니다. 활동량을 줄이는 쪽으로 지시하셔야 합니다."}`);
  }
  else if(tired[0] && tired[0].fit<66){
    const b1=benchFor(tired[0]);
    add(3, `🫤 <b>${tired[0].p.name}</b> 체력이 ${Math.round(tired[0].fit)}까지 떨어졌습니다. 다음 10분 안에 정리하는 게 좋겠습니다.${b1?` <b>${b1.q.name}</b>을(를) 준비시키시죠.`:""}`);
  }
  const cardRisk=pitch.find(x=>x.y>0 && (x.fit<74 || T.tackle>=1.5));
  if(cardRisk) add(2, `🟨 <b>${cardRisk.p.name}</b>, 경고를 안고 뛰고 있습니다.${T.tackle>=1.5?" 태클 강도가 높아 두 번째 카드가 나올 수 있습니다 — 강도를 한 칸 내리시죠.":" 무리한 태클만 피하면 됩니다."}`);

  /* ── 경기 내용 읽기 ───────────────────────────────── */
  _tg="tac";      // 🧩 기본은 전술 — 공격 분석은 "att", 실점 위험은 "def" 로 개별 지정한다
  if(min>=20){
    if(c.poss>=62 && c.shot<=c.oShot)
      add(4, `🧩 점유율은 <b>${c.poss}%</b>인데 슈팅은 ${c.shot}:${c.oShot}입니다. 돌리기만 하고 있습니다 — 템포를 올리거나 스루패스를 허용해 앞으로 찔러야 합니다.`);
    else if(c.poss<=38 && diff>=0)
      add(6, `🧱 점유율 <b>${c.poss}%</b>. 내주고 버티는 그림입니다. 이대로 지킬 거면 라인을 더 내리고, 뒤집을 거면 압박을 올려야 합니다.`, "def");
    if(c.passOk!=null && c.passOk<70)
      add(5, `📉 패스 성공률 <b>${c.passOk}%</b>. 압박에 걸려 계속 끊깁니다. 패스를 짧게 가져가거나 템포를 한 칸 낮춰 정리하시죠.`);
    if(c.crossOk!=null && c.cross>=6 && c.crossOk<20)
      add(5, `🎯 크로스 ${c.cross}번 중 <b>${c.crossOk}%</b>만 닿았습니다. 박스 안에 머리가 없습니다 — 폭을 좁혀 중앙으로 파고드는 게 낫습니다.`, "att");
    if(c.takeOnPct!=null && c.takeOnPct<35)
      add(7, `🚧 돌파 성공률 <b>${c.takeOnPct}%</b>. 일대일로는 안 뚫립니다. 2대1 패스나 측면 오버래핑으로 숫자를 만들어야 합니다.`, "att");
    if(c.aerialPct!=null && c.aerialPct<40)
      add(7, `🪂 공중볼을 <b>${100-c.aerialPct}%</b> 내주고 있습니다. 롱볼은 그만 올리고 발밑으로 붙이시죠.`, "att");
    if(c.offside>=3)
      add(8, `🚩 오프사이드 <b>${c.offside}번</b>. 침투 타이밍이 반 박자 빠릅니다. 라인브레이커 성향을 줄이거나 한 템포 늦춰야 합니다.`, "att");
    if(c.foul>=10)
      add(8, `⚠️ 파울이 <b>${c.foul}개</b>입니다. 심판이 이미 우리 쪽을 보고 있습니다. 태클 강도를 내리는 게 좋겠습니다.`, "man");

    /* ── 🔬 「슛은 나오는데 왜 안 들어가는가」를 나눠서 본다 ── */
    _tg="att";
    if(c.shotLongPct!=null && c.shotLongPct>=55 && c.shotClose<=1)
      add(4, `🎯 슈팅 ${c.shot}개 중 <b>${c.shotLongPct}%</b>가 먼 거리에서 나왔고, 박스 근처 슛은 ${c.shotClose}개뿐입니다.
        박스 안으로 들어가질 못하고 있습니다 — 중거리 지시를 줄이고 침투를 늘려야 합니다.`);
    else if(c.shotBlockPct!=null && c.shotBlockPct>=40)
      add(5, `🧱 슛의 <b>${c.shotBlockPct}%</b>가 몸에 맞고 있습니다. 정면에서만 때리고 있다는 뜻입니다 — 폭을 넓혀 각을 만들어야 합니다.`);
    else if(c.shotOnPct!=null && c.shotOnPct<30 && c.shot>=6)
      add(5, `😵 슈팅 ${c.shot}개 중 골문 안으로 간 건 <b>${c.shotOnPct}%</b>뿐입니다. 조급하게 때리고 있습니다 — 한 번 더 내주는 선택이 필요합니다.`);
    else if(c.save>=4 && c.goal===0)
      add(4, `🧤 상대 골키퍼가 벌써 <b>${c.save}개</b>를 막아 냈습니다. 만들어 내는 건 되고 있습니다 — 형태를 바꾸기보다 계속 두드리는 게 맞습니다.`);
    if(c.woodwork>=2)
      add(6, `🥅 골대를 <b>${c.woodwork}번</b> 맞혔습니다. 운이 따라 주지 않을 뿐, 방향은 맞습니다.`);

    /* ── 🗺️ 우리가 어디까지 올라가고 있는가 ── */
    _tg="tac";
    if(c.z3!=null && c.z3<24 && diff<=0)
      add(4, `🗺️ 공을 잡고도 상대 진영에 머문 시간이 <b>${c.z3}%</b>뿐입니다. 전진 자체가 안 되고 있습니다 —
        라인을 올리고 전방 압박으로 시작 지점을 앞으로 당겨야 합니다.`);
    else if(c.oZ3!=null && c.oZ3>=42 && diff>=0)
      add(5, `🚨 상대가 소유 시간의 <b>${c.oZ3}%</b>를 우리 진영에서 보내고 있습니다. 계속 이러면 한 방 나옵니다 — 중원을 두껍게 가져가시죠.`, "def");

    /* ── 🔁 패스의 방향 ── */
    if(c.backPct!=null && c.backPct>=32 && c.poss>=52)
      add(6, `↩️ 패스의 <b>${c.backPct}%</b>가 뒤로 향합니다. 안전하게만 돌리고 있습니다 —
        성향을 한 칸 올리거나 전방으로 뛰는 역할(침투)을 하나 더 두시죠.`);
    else if(c.fwdPct!=null && c.fwdPct>=46 && c.passOk!=null && c.passOk<74)
      add(6, `⚡ 전진 패스 비중이 <b>${c.fwdPct}%</b>인데 성공률이 ${c.passOk}%입니다. 급하게 앞으로만 넣다 끊깁니다 — 한 박자 늦추는 게 낫습니다.`);

    /* ── 🎪 세트피스 ── */
    if(c.corner>=6 && c.goal===0)
      add(7, `⛳ 코너킥을 <b>${c.corner}개</b>나 얻고도 소득이 없습니다. 키커나 박스 안 배치를 손볼 때입니다.`, "att");

    /* ── 🕵️ 상대 전술을 읽고 처방한다 ── */
    const OT=TAC(opp);
    if(min>=25){
      if(OT.line>=1.5 && c.longPassT<=2 && diff<=0)
        add(5, `🕵️ 상대 라인이 높습니다(${styleName(opp)}). 그런데 우리는 배후로 넘기는 공이 거의 없습니다 —
          롱패스 성향을 올리고 빠른 선수를 뒷공간으로 뛰게 하면 그림이 나옵니다.`);
      else if(OT.line<=0.5 && c.cross<=3 && c.poss>=55)
        add(5, `🕵️ 상대가 완전히 내려앉았습니다. 좁은 중앙만 두드려서는 안 열립니다 — 폭을 넓히고 측면에서 올려야 합니다.`);
      if(OT.press>=1.5 && c.lost>=c.pass*0.22 && c.pass>50)
        add(4, `🕵️ 상대 압박이 강한데 후방에서 계속 빼앗기고 있습니다(로스트 ${c.lost}회).
          짧은 빌드업을 고집하기보다 한 번씩 길게 넘겨 압박을 벗겨야 합니다.`, "def");
    }
  }

  /* ── 🛡️ 새 수비 지시 세 가지 (수비 가담 인원 · 마킹 방식 · 오프사이드 트랩) ──────
     ⚠ 세부 전술에 손잡이를 만들어 놓고 조언이 그걸 모르면, 감독은 그 지시가 있는 줄도 모른다.
        기존 조언이 「라인·압박·폭」만 말하던 자리에 세 지시를 얹는다. */
  _tg="def";
  {
    const _dcT=(T.defCommit!=null?T.defCommit:1);      // 0~2
    const _mkT=(T.marking!=null?T.marking:1);
    const _trT=(T.trap!=null?T.trap:1);
    const _lead=(isHome?M.hg-M.ag:M.ag-M.hg);
    /* 🛡️ 수비 가담 인원 */
    if(min>=30 && c.oZ3>=42 && _dcT<1.5)
      add(3, `🛡️ 상대가 우리 진영에서 <b>${c.oZ3}%</b>를 보내는데 앞선이 그대로 남아 있습니다.
        <b>수비 가담 인원</b>을 올리면 윙백이 내려와 백5가 서고 앞선 한 명이 중원을 메웁니다 — 박스 앞이 두꺼워집니다.`);
    else if(min>=60 && _lead>0 && _dcT<1.5 && c.oShot>=c.shot)
      add(4, `🛡️ 리드를 지키는 국면입니다. <b>수비 가담 인원</b>을 올려 줄을 하나 더 세우면 슈팅 각부터 사라집니다.`);
    else if(_lead<0 && min>=65 && _dcT>=1.5)
      add(3, `🛡️ 지고 있는데 <b>전원이 내려와</b> 있습니다 — 뺏어도 앞에 나갈 사람이 없습니다.
        가담 인원을 낮춰 앞선을 남겨 두시죠.`, "att");
    else if(_dcT>=1.5 && pitch.filter(x=>x.fit<66).length>=3)
      add(5, `🛡️ 가담 인원을 높게 쓰는 만큼 <b>왕복 거리가 큽니다</b>(체력 저하 ${pitch.filter(x=>x.fit<66).length}명). 한 칸 낮추거나 교체로 다리를 바꿔 주셔야 합니다.`, "man");   // ⚠ tired 는 전원 정렬 목록이라 길이로 세면 안 된다
    /* 🧷 마킹 방식 */
    if(min>=25 && _mkT<1.05 && c.oPassOk!=null && c.oPassOk>=84)
      add(4, `🧷 상대가 <b>패스 성공률 ${c.oPassOk}%</b>로 편하게 돌리고 있습니다. 지역으로 서 있으면 좋은 선수를 자유롭게 두는 셈입니다 —
        <b>마킹 방식</b>을 대인 쪽으로 옮겨 중심을 지우는 게 낫습니다.`);
    else if(_mkT>=1.5 && c.oZ3>=40 && min>=35)
      add(4, `🧷 <b>대인 방어</b>로 붙어 다니다 형태가 벌어지고 있습니다(상대 우리 진영 점유 ${c.oZ3}%).
        지역 쪽으로 한 칸 돌려 줄 간격부터 잡으시죠.`);
    /* 🪤 오프사이드 트랩 */
    if(T.line>=1.5 && _trT<1.05 && min>=20)
      add(5, `🪤 라인을 높게 쓰면서 <b>트랩을 안 걸고</b> 있습니다. 뒷공간을 내주기만 하는 상태입니다 — 트랩 빈도를 올리면 그 공간이 함정이 됩니다.`);
    else if(_trT>=1.5 && T.line<=0.5)
      add(6, `🪤 라인이 낮은데 <b>트랩</b>을 자주 겁니다. 내려앉은 블록의 트랩은 걸리지 않습니다 — 라인을 올리든 트랩을 줄이든 하나로 맞춰야 합니다.`);
    else if(_trT>=1.5 && c.oShotClose!=null && c.oShotClose>=4 && min>=40)
      add(3, `🪤 <b>트랩이 뚫리고 있습니다</b> — 박스 근처 슛을 ${c.oShotClose}개 내줬습니다. 한 번 넘어가면 곧바로 1대1입니다. 빈도를 낮추시죠.`);
  }

  /* ── 📈 지금의 흐름 (총합이 가리는 것) ─────────────── */
  _tg="judg";     // 📈 총합이 가리는 흐름을 읽어 내는 건 경기판단의 일이다
  const mo=coachMomentum(M, c);
  if(mo && min>=25){
    if(mo.dO-mo.dS>=3)
      add(2, `📈 최근 <b>${mo.span}분</b> 동안 슈팅을 ${mo.dS}:${mo.dO}로 내줬습니다. 흐름이 완전히 넘어갔습니다 —
        지금 손을 쓰지 않으면 실점합니다.`, "def");
    else if(mo.dS-mo.dO>=3)
      add(6, `📈 최근 ${mo.span}분은 우리 시간입니다(슈팅 ${mo.dS}:${mo.dO}). 이 리듬을 끊지 마시죠 — 교체는 흐름을 식힙니다.`);
    else if(mo.dPoss<=-12)
      add(5, `📉 최근 ${mo.span}분 사이 점유가 <b>${Math.abs(mo.dPoss)}%p</b> 빠졌습니다. 중원이 밀리기 시작했습니다.`);
  }

  /* ── 🕵️ 상대 벤치가 방금 움직였다 (해설이 경기를 세우는 대신 여기서 알린다) ── */
  _tg="flex";     // 🎽 상대가 손을 댄 순간을 잡아내는 건 유연성이다
  try{
    const ot=oppTacVisible(M).filter(x=>x.side!==(isHome?"h":"a"));
    if(ot.length){
      const last=ot[ot.length-1];
      const fresh=(min-last.min)<=6;                       // 방금 벌어진 일이면 맨 위로
      const older=ot.slice(0,-1).slice(-2);
      add(fresh?0.5:4,
        `🎽 <b>${last.minTxt!=null?last.minTxt:last.min}' ${last.coach}이 전술을 바꿨습니다.</b>${last.form?` 포메이션 <b>${last.form}</b> 전환.`:""}
         <br><span style="opacity:.9">${last.msg||""}</span>
         ${older.length?`<br><span class="small" style="opacity:.65">앞서 ${older.map(x=>`${x.minTxt!=null?x.minTxt:x.min}'${x.form?` ${x.form}`:""}`).join(" · ")}에도 손을 댔습니다.</span>`:""}`);
    }
  }catch(e){}

  /* ── 상대를 읽는다 ────────────────────────────────── */
  _tg="flex";
  const oSubs=osd.subs||0;
  if(min>=60 && oSubs>=2 && diff<=0)
    add(6, `👀 상대는 벌써 ${oSubs}명을 바꿨습니다(${styleName(opp)}). 저쪽은 승부수를 던졌습니다 — 우리도 카드를 아낄 때가 아닙니다.`);
  else if(min>=70 && oSubs===0 && diff<0)
    add(7, `👀 상대 벤치가 조용합니다. 지금 이대로가 만족스럽다는 뜻입니다. 우리가 먼저 흔들어야 합니다.`);

  /* ── 스코어와 시간 ────────────────────────────────── */
  _tg="always";   // ⚖️ 마지막 정리 한 줄은 어떤 코치라도 한다
  if(diff>0){
    add(9, min>=75
      ? `🛡️ ${myG}-${oppG}로 앞서 있습니다. 마지막 15분은 라인을 내리고 중원을 두껍게 가져가는 편이 안전합니다.${T.line>=1.5?" 지금 라인이 높습니다 — 한 칸 내리시죠.":""}`
      : `😊 앞서 있습니다. 무리하지 말고 이 리듬을 유지하면서 한 골 더 노려보시죠.`);
  } else if(diff<0){
    add(9, min>=70
      ? `🔥 ${Math.abs(diff)}골 뒤진 채 ${90-min}분 남았습니다. 성향을 올리고 남은 카드 ${subsLeft}장을 지금 쓰지 않으면 쓸 곳이 없습니다.`
      : `🧐 아직 시간이 있습니다. 조급하게 라인을 올렸다가 역습 한 방에 무너지는 게 제일 나쁩니다.`);
  } else {
    add(9, min>=78
      ? `⚖️ 승점 1이냐 3이냐의 시간입니다. 3점을 노리신다면 지금이 마지막 카드를 쓸 타이밍입니다.`
      : `⚖️ 팽팽합니다. 상대가 먼저 움직일 때까지 형태를 유지하는 것도 방법입니다.`);
  }

  /* ── 🎩 여기서부터 「이 코치가 무엇을 봤는가」다 ────────────────
     조언 문장은 위에서 이미 다 만들어졌다. 렌즈는 그중 무엇이 감독의 귀에 닿는지를 정한다. */
  const LZ=acLens(M);
  L.sort((a,b)=>a.pri-b.pri);
  const seen=L.filter(x=>LZ.keep(x.tag, x.html));
  /* 🎭 오조언 — 판단이 흐린 코치는 가끔 거꾸로 읽는다. 눈에 띄는 표식은 붙이지 않는다. */
  const _wrong=acWrongLine(M, LZ, {
    min, diff, poss:c.poss, shotDiff:(c.oShot|0)-(c.shot|0),
    tiredN:pitch.filter(x=>x.fit<66).length
  });
  if(_wrong) seen.splice(Math.min(1, seen.length), 0, {pri:1.5, html:_wrong, tag:"always"});
  /* ⚠ 마무리 한 줄(스코어·남은 시간)은 pri 가 제일 뒤라 줄 수 제한에 늘 먼저 잘렸다.
     그게 감독이 제일 듣고 싶은 말이다 — 한 칸을 비워 두고 맨 아래에 붙인다. */
  const _close=seen.filter(x=>x.tag==="always" && x.pri>=9);
  const _rest =seen.filter(x=>!(x.tag==="always" && x.pri>=9));
  const picked=_rest.slice(0, Math.max(1, LZ.n-(_close.length?1:0))).concat(_close.slice(0,1));
  const lines=picked.map(x=>x.html + (x.tag==="always"?"":LZ.hedge(x.html)));
  /* 머리줄 — 지금 상황을 한눈에. 지표는 「판단에 쓰이는 것」만 올린다.
     ⚠ 경기판단이 낮은 코치는 세부 지표까지 챙겨 보지 못한다 — 뒤에서부터 잘린다. */
  const bits=[`${min}분`, `점유 ${c.poss}%`, `슈팅 ${c.shot}:${c.oShot}`];
  const xtra=[];
  if(c.shotOnPct!=null) xtra.push(`유효 ${c.shotOn}(${c.shotOnPct}%)`);
  if(c.passOk!=null)    xtra.push(`패스 ${c.passOk}%`);
  if(c.z3!=null)        xtra.push(`상대 진영 체류 ${c.z3}%`);
  xtra.push(`교체 ${subsLeft}장`);
  for(const b of xtra.slice(0, Math.max(1, LZ.bits))) bits.push(b);
  /* 📊 ⚠ 분석가 가산이 기본 지표 넷과 같은 통에 들어가 상한(4칸)에 막혀 있었다 —
     분석가 13과 18이 화면상 똑같았다. 분석가만 가져오는 지표를 따로 둔다.
     벤치에 데이터가 들어온다는 뜻이니, 수석코치의 눈으로는 못 보는 것들이라야 한다. */
  if(LZ.ana>0){
    const ax=[];
    if(c.oShotOn!=null)   ax.push(`<span style="opacity:.9">상대 유효 ${c.oShotOn}</span>`);
    if(c.takeOnPct!=null) ax.push(`<span style="opacity:.9">돌파 ${c.takeOnPct}%</span>`);
    if(c.foul!=null)      ax.push(`<span style="opacity:.9">파울 ${c.foul}</span>`);
    if(c.corner!=null)    ax.push(`<span style="opacity:.9">코너 ${c.corner}</span>`);
    if(c.aerialPct!=null) ax.push(`<span style="opacity:.9">공중 ${c.aerialPct}%</span>`);
    for(const b of ax.slice(0, LZ.ana*2)) bits.push(b);
  }
  const head = min<1 ? "킥오프를 기다리는 중입니다." : bits.join(" · ");
  /* 코치 명패 — 이 조언이 누구의 눈인지, 그 눈이 얼마나 밝은지를 늘 띄워 둔다.
     오조언을 섞는 이상, 감독은 자기 코치의 「경기판단」을 알고 있어야 공평하다. */
  const _ac=acOf();
  const nameLine = _ac
    ? (()=>{ const gj=acGrade(_ac.judg), TRr=AC_TRAIT[_ac.trait]||AC_TRAIT.bal;
        return `<div class="small" style="margin-bottom:4px;opacity:.9">🎩 <b>${_ac.n}</b> 수석코치
          <span style="opacity:.7">· ${TRr.ic} ${TRr.n} · 경기판단 <b style="color:${gj[1]}">${_ac.judg}</b> · 전술 ${_ac.tac}</span></div>`; })()
    : `<div class="small" style="margin-bottom:4px;color:var(--gold)">🎩 수석코치 공석 — 옆에서 봐 주는 사람이 없습니다.
        <span style="opacity:.75">💸 이적시장 → 🎩 스태프 탭</span></div>`;
  el.innerHTML=`${nameLine}
  <div class="small" style="margin-bottom:6px;line-height:1.7">${head}</div>
  ${lines.map(l=>`<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #21262d">${l}</div>`).join("")}
  ${LZ.none?`<p class="small" style="opacity:.7">코치가 없어 보이는 것만 겨우 짚습니다.</p>`:""}
  <p class="small" style="margin-top:6px">💡 교체·성향 변경은 상단의 <b>"📋 전술"</b> 버튼에서.</p>`;
}
let _finishingLive=false;
/* 🛟 「결과 확인」 버튼 전용 안전 진입점 (제보 — 버튼이 아예 먹통이 된다).
   ① 이전 시도에서 플래그가 켜진 채 남았어도 무조건 풀고 시작한다
   ② finishLive 가 어떤 이유로 실패해도 경기 후 화면을 반드시 연다
   ③ 그마저 안 되면 홈으로 돌려보내 게임이 멈추지 않게 한다 */
function finishLiveSafe(){
  const M0=liveM;
  _finishingLive=false;
  try{ finishLive(); }
  catch(e){ try{ console.warn("결과 확인 처리 실패:", e); }catch(_){} }
  try{
    const opened = inLockerTalk || IV || fanTownhallCtx || awayLockerCtx;
    if(!opened){
      liveM=null;
      try{ if(liveTimer){ clearInterval(liveTimer); liveTimer=null; } }catch(_){}
      try{ stop2DLoop(); }catch(_){}
      matchMode=MATCH_MODE.TEXT;
      try{ document.body.classList.remove("matchFS"); }catch(_){}
      try{ const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.classList.remove("navLocked"); _a.textContent="진행 ▶"; } }catch(_){}
      if(M0 && M0.opts && M0.opts.pvp){ try{ show("pvp"); }catch(_){ show("home"); } }
      else if(M0){ try{ showPostMatchTalk(M0); }catch(_){ show("home"); } }
      else show("home");
      try{ window.scrollTo(0,0); }catch(_){}
    }
  }catch(e){ try{ show("home"); }catch(_){} }
  finally{ _finishingLive=false; }
}
function finishLive(){
  /* ⚠ 제보 — 「결과 확인」을 눌렀는데 화면이 넘어가지 않는다.
     ① 버튼이 두 번 눌리거나(연타·재진입) ② 이미 정리된 뒤 다시 호출되면 liveM 이 null 인데
        그대로 결과 처리를 돌려 예외가 났고, 그 순간 흐름이 통째로 멈췄다.
     ─ 재진입을 막고, 경기 객체가 없으면 조용히 홈으로 돌려보낸다. */
  if(_finishingLive) return;
  if(!liveM){
    try{ const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.classList.remove("navLocked"); _a.textContent="진행 ▶"; } }catch(e){}
    try{ document.body.classList.remove("matchFS"); }catch(e){}
    try{ stop2DLoop(); }catch(e){}
    matchMode=MATCH_MODE.TEXT;
    show("home"); try{ window.scrollTo(0,0); }catch(e){}
    return;
  }
  _finishingLive=true;
  try{
  try{ document.body.classList.remove("matchFS"); }catch(e){}
  try{ const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.classList.remove("navLocked"); _a.textContent="진행 ▶"; } }catch(e){}
  try{ wakeRelease(); }catch(e){}   // 경기가 끝났으니 화면 유지를 푼다
  const M=liveM; liveM=null;
  try{ LIVE_PEEK=false; peekBarRender(); const _m=document.getElementById("main"); if(_m) _m.classList.remove("peekOnly"); }catch(e){}
  if(liveTimer){ clearInterval(liveTimer); liveTimer=null; }
  if(revealTimer){ clearTimeout(revealTimer); revealTimer=null; } revealQueue=[];
  current2DScene=null; matchMode=MATCH_MODE.TEXT; stop2DLoop();
  try{
  if(M.opts && M.opts.pvp){
    /* ⚔️ 온라인 대전 — 클론 팀 경기. 컨디션·부상·징계·성장·재정 전부 무반영, 전적만 남긴다 */
    try{ pvpFinish(M); }catch(e){}
  } else if(G.pendingFriendly){
    const f=G.pendingFriendly; G.pendingFriendly=null;
    f.done=true; f.hg=M.hg; f.ag=M.ag;
    preFriendlyPlayed();          // 연습경기도 한 경기다 — 출장정지가 흘러간다
    applyMatchResult(M);                       // 체력·컨디션·평점·전술 적응도는 진짜 경기처럼
    const ut=userTeam();
    const mine=M.home.isUser?M.hg:M.ag, his=M.home.isUser?M.ag:M.hg;
    const opp=M.home.isUser?M.away:M.home;
    addNews(`🤝 연습경기: ${ut.short} ${mine}-${his} ${opp.short}`);
    lastMatch={type:"match", res:{hg:M.hg,ag:M.ag,events:M.events,sc:M.sc||[],st:M.st,pmap:M.pmap||null, momo:M.momo||null}, h:M.home, a:M.away, friendly:true, att:M.att||0};
    checkPreseasonEnd();
    saveGame();
  } else if(G.pendingPO){
    const {m,hid,aid}=G.pendingPO; G.pendingPO=null;
    applyMatchResult(M);
    poResolve(m, hid, aid, M.hg, M.ag, M.pk?(M.pk.win==="h"?1:-1):0);
    poRestDays();   // ⚔️ 다음 PO 경기까지 회복 (제보)
    lastMatch={type:"pomatch", res:{hg:M.hg,ag:M.ag,events:M.events,sc:M.sc||[],st:M.st,pmap:M.pmap||null, momo:M.momo||null}, h:M.home, a:M.away, tag:m.tag, att:M.att||0, mom:M.mom||null};
    saveGame();
  } else if(G.pendingCWC){
    /* 🌍 CWC — 프리시즌 한복판의 공식전. 리그 순위표도 라운드도 건드리지 않는다. */
    const P=G.pendingCWC; G.pendingCWC=null;
    applyMatchResult(M);
    try{ cwcStatCollect(M); }catch(e){}
    try{ cwcResolveUser(P, M.hg, M.ag, M.pk?(M.pk.win==="h"?1:-1):0); }catch(e){}
    try{ matchNewsCwc(M, P.tag); }catch(e){}
    lastMatch={type:"cwc", res:{hg:M.hg,ag:M.ag,events:M.events,sc:M.sc||[],st:M.st,pmap:M.pmap||null, momo:M.momo||null}, h:M.home, a:M.away, tag:P.tag, att:M.att||0, mom:M.mom||null};
    saveGame();
  } else if(G.pendingEACL){
    /* 🌏 EACL — 리그 순위표를 건드리지 않고 대회 기록만 남긴다(noTable). 라운드도 넘기지 않는다. */
    const P=G.pendingEACL; G.pendingEACL=null;
    applyMatchResult(M);
    const P2 = P.kind==="md"
      ? {kind:"md", d:P.d, m:(G.eacl&&G.eacl.fix.find(x=>x.d===P.d && x.h===P.hid && x.a===P.aid))}
      : {kind:P.kind, t:(P.kind==="f" ? (G.eacl&&G.eacl.ko.f) : (G.eacl&&(G.eacl.ko[P.kind]||[]).find(x=>x.h===P.hid && x.a===P.aid)))};
    if((P2.m||P2.t)) eaclResolveUser(P2, M.hg, M.ag, M.pk?(M.pk.win==="h"?1:-1):0);
    try{ eaclGate(M); }catch(e){}
    try{ matchNewsEacl(M, P.tag); }catch(e){}
    lastMatch={type:"eacl", res:{hg:M.hg,ag:M.ag,events:M.events,sc:M.sc||[],st:M.st,pmap:M.pmap||null, momo:M.momo||null}, h:M.home, a:M.away, tag:P.tag, att:M.att||0, mom:M.mom||null};
    saveGame();
  } else {
    lastMatch={type:"match", res:{hg:M.hg,ag:M.ag,events:M.events,sc:M.sc||[],st:M.st,pmap:M.pmap||null, momo:M.momo||null}, h:M.home, a:M.away, att:M.att||0, mom:M.mom||null};
    completeRound(M);
  }
  }catch(e){ try{ console.warn("경기 결과 반영 실패:", e); }catch(_){} }
  /* ⚔️ 제보 — 「경기 끝나면 라커룸 토크는 하지 마」. 온라인 친선전은 클론 경기라
     SNS 반응·팬 간담회·라커룸 토크·기자회견이 전부 어울리지 않는다 — 결과 화면 직행. */
  if(M.opts && M.opts.pvp){
    try{ restoreTactic(); }catch(e){}
    try{ show("pvp"); window.scrollTo(0,0); }catch(e){}
    return;
  }
  try{ socialOnResult(M); }catch(e){}  // 팬들은 휘슬이 울리는 순간 이미 떠들기 시작한다
  try{ restoreTactic(); }catch(e){}   // 경기 중 만진 전술은 여기서 원상 복구 (경기 결과 반영이 끝난 뒤)
  try{ pruneUserLineup(); }catch(e){} // 이 경기에서 다치거나 퇴장당한 선수를 선발·배치도에서 정리한다
  // FM처럼: 경기 종료 → (리그 3연패 이상이면 팬 간담회) → 라커룸 토크(결과 반응) → 사후 기자회견 순서로 진행한다
  // 경기 후: (팬 간담회) → (버스 저지) → 라커룸 토크 → 기자회견
  const afterFans = ()=>{
    if(shouldTriggerBusBlock()) showBusBlock(M, ()=>showPostMatchTalk(M));
    else showPostMatchTalk(M);
  };
  /* 어느 단계에서 문제가 생겨도 화면이 멈추지 않게 — 실패하면 곧바로 다음 단계로 넘긴다 */
  try{
    if(shouldTriggerFanTownhall()) showFanTownhall(M, afterFans);
    else afterFans();
  }catch(e){
    try{ console.warn("경기 후 진행 실패:", e); }catch(_){}
    try{ afterPostTalk(M); }
    catch(e2){
      try{ const _a=$("#advBtn"); if(_a) _a.disabled=false; }catch(_){}
      show("home"); try{ window.scrollTo(0,0); }catch(_){}
    }
  }
  /* 🛟 최종 안전망 — 여기까지 왔는데 아무 화면도 열리지 않았다면(제보: "결과 확인을 눌렀는데
     라커룸으로 안 넘어간다") 라커룸을 직접 연다. 화면이 빈 채로 멈추는 일은 없어야 한다. */
  try{
    const nothingOpen = !inLockerTalk && !IV && !fanTownhallCtx && !awayLockerCtx && !liveM;
    if(nothingOpen && M){
      try{ console.warn("경기 후 화면이 열리지 않아 라커룸을 직접 엽니다."); }catch(_){}
      showPostMatchTalk(M);
    }
  }catch(e){
    try{ const _a=$("#advBtn"); if(_a) _a.disabled=false; }catch(_){}
    show("home");
  }
  }catch(e){
    /* ⚠ 제보 — 「결과 확인」 버튼이 아예 먹통이 된다(정규 시즌 첫 경기).
       결과 처리(completeRound 등) 도중 예외가 나면 재진입 플래그가 켜진 채 남아,
       그 뒤로는 몇 번을 눌러도 아무 반응이 없었다. 여기서 반드시 화면을 넘긴다. */
    try{ console.warn("경기 종료 처리 실패:", e); }catch(_){}
    try{ const _a=$("#advBtn"); if(_a){ _a.disabled=false; _a.textContent="진행 ▶"; } }catch(_){}
    try{ if(M) showPostMatchTalk(M); else { show("home"); } }
    catch(e2){ try{ show("home"); }catch(_){} }
  }finally{
    _finishingLive=false;      // 무슨 일이 있어도 버튼은 다시 살아난다
  }
}
