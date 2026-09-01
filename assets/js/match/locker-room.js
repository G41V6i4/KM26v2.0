"use strict";
/* ---------- 라커룸 토크 (킥오프 전 / 경기 종료 후 — 기자회견과 별개로 선수단에게 직접 하는 말) ---------- */
const LOCKER_PRE=[
  [5,`🔥 "오늘 반드시 잡아야 할 경기입니다! 처음부터 강하게 밀어붙입시다!"`,"선수들의 눈빛이 이글거립니다."],
  [3,`⚖️ "평소 준비한 대로만 하면 됩니다. 침착하게 갑시다."`,"차분한 분위기 속에 라커룸을 나섭니다."],
  [3,`😌 "편하게 즐기고 옵시다. 너무 부담 갖지 마세요."`,"선수들의 표정이 한결 가벼워집니다."],
  [2,`🎯 "오늘 활약하는 선수는 다음 경기도 믿고 쓰겠습니다."`,"몇몇 선수들의 눈빛이 달라집니다."],
  [-1,`⚠️ "이 경기를 지면 순위가 위험합니다. 각오하세요."`,"긴장감이 감돌지만 다소 위축된 표정도 보입니다."],
  [1,`😂 (가벼운 농담을 던지며 분위기를 풀어줍니다.)`,"웃음소리와 함께 긴장이 풀립니다."],
  [4,`🤝 "저는 여러분을 믿습니다. 자신 있게 하세요."`,"신뢰의 말에 선수들이 고개를 끄덕입니다."],
  [0,`🤐 (별다른 말 없이 조용히 선수들을 지켜봅니다.)`,"감독의 침묵에 선수들도 말없이 준비합니다."],
  [3,`🎯 "오늘 노릴 곳은 딱 하나입니다. 저쪽 왼쪽 뒷공간. 그것만 봅시다."`,"목표가 하나로 좁혀지자 표정이 단단해집니다."],
  [2,`🛡️ "첫 20분만 버팁시다. 그 뒤는 우리 시간입니다."`,"차분하게 각오를 다집니다."],
  [-2,`📉 "오늘 못 하는 선수는 다음 주에 벤치입니다."`,"긴장은 올라갔지만 몇몇은 굳어 있습니다."],
  [4,`🏟️ "밖에 저 사람들, 오늘 하루 벌어서 여기 온 겁니다. 값은 하고 나옵시다."`,"관중석 소리가 라커룸까지 들어옵니다."],
  [0,`🖥️ (FIGHT가 표시된 스크린을 보여주며) "단어 알지? 싸워."`,"","fightScreen"]]
const LOCKER_POST_WIN=[
  [4,`👏 "완벽했습니다! 이 기세를 이어갑시다!"`,"승리의 기쁨이 라커룸을 가득 채웁니다."],
  [3,`⚖️ "좋은 결과지만 방심은 금물입니다. 다음 경기도 준비하죠."`,"담담하게 다음을 준비하는 분위기입니다."],
  [1,`🧊 "부족한 부분도 있었습니다. 영상으로 다시 점검하죠."`,"칭찬보다 냉정한 평가에 다소 숙연해집니다."],
  [4,`🌟 (오늘 가장 활약한 선수를 콕 집어 칭찬합니다.)`,"지목된 선수의 어깨가 으쓱해집니다."],
  [2,`😂 "오늘 그 슛은 진짜 웃겼습니다." (농담을 던집니다)`,"웃음이 터지며 분위기가 풀어집니다."],
  [0,`🧐 "다음 상대가 더 만만치 않습니다. 방심하지 마세요."`,"경계심이 다시 살아납니다."],
  [3,`🤝 "오늘은 팀워크의 승리였습니다. 모두 고생했어요."`,"팀 전체가 하나가 된 듯한 분위기입니다."],
  [2,`🙂 (짧게 박수만 치고 조용히 마무리합니다.)`,"담백한 축하에 선수들도 편안해합니다."],
  [3,`🍖 "오늘은 제가 쏘겠습니다. 회식 잡으세요."`,"환호가 터집니다. 라커룸이 시끄러워집니다."],
  [1,`📼 "이겼지만 실점 장면은 다시 봅니다. 축하는 그 뒤에."`,"기쁨이 조금 눌리지만 다들 수긍합니다."],
  [4,`🙌 "오늘 이건 여러분이 만든 겁니다. 저는 한 게 없어요."`,"공을 돌리는 말에 선수들이 웃습니다."]]
const LOCKER_POST_DRAW=[
  [2,`⚖️ "나쁘지 않았습니다. 다음엔 더 잘할 수 있어요."`,"덤덤하게 결과를 받아들이는 분위기입니다."],
  [-1,`😤 "이길 수 있었던 경기였습니다. 아쉬움이 남습니다."`,"아쉬움 속에 라커룸이 조용합니다."],
  [3,`👏 "쉽지 않은 상대였습니다. 다들 수고했어요."`,"격려에 선수들의 표정이 풀립니다."],
  [0,`🧐 "후반 집중력이 흐트러졌습니다. 다시 점검합시다."`,"몇몇 선수가 뜨끔한 표정을 짓습니다."],
  [1,`😐 (별다른 언급 없이 다음 경기 이야기로 넘어갑니다.)`,"특별한 동요 없이 다음을 준비합니다."],
  [-2,`🧊 "솔직히 실망스러운 경기였습니다."`,"무거운 침묵이 흐릅니다."],
  [2,`🤝 "버텨낸 것만으로도 의미가 있습니다."`,"위로의 말에 표정이 다소 풀립니다."],
  [4,`🔥 "다음 경기에서 반드시 되갚아 줍시다!"`,"선수들의 눈빛에 다시 불이 붙습니다."]];
const LOCKER_POST_LOSS=[
  [-2,`🧊 "오늘 경기 내용은 받아들이기 힘듭니다. 철저히 분석하겠습니다."`,"무거운 침묵이 라커룸을 감쌉니다."],
  [0,`⚖️ "패배도 과정입니다. 다음 경기에 집중합시다."`,"담담하게 다음을 기약하는 분위기입니다."],
  [2,`🤝 "오늘은 상대가 좋았을 뿐입니다. 고개 들어요."`,"격려에 선수들이 조금씩 표정을 풉니다."],
  [-3,`😡 "이런 경기력으로는 안 됩니다! 정신 차리세요!"`,"질책에 라커룸 분위기가 얼어붙습니다."],
  [1,`🙏 "다치지 않은 것만으로도 다행입니다. 다음을 준비하죠."`,"안도와 아쉬움이 뒤섞인 표정입니다."],
  [-1,`🧐 (조용히 개인별 실수를 하나하나 짚습니다.)`,"지적받은 선수들의 표정이 굳어집니다."],
  [3,`💪 "이 정도로 무너질 팀이 아닙니다. 다시 일어섭시다."`,"격려의 말에 눈빛이 다시 살아납니다."],
  [0,`😶 (아무 말 없이 라커룸을 나갑니다.)`,"감독의 침묵이 오히려 더 큰 부담으로 다가옵니다."],
  [0,`🪑 (의자를 걷어차며) "이게 팀이야?! 이게 팀이야!!"`,"…","chairKick"],
  [0,`🤫 (아무 말 없이 선수들을 한 명씩 오래 바라봅니다.)`,"…","silentStare"],
  [2,`📼 "오늘 건 제 준비 부족입니다. 영상은 제가 먼저 보고 오겠습니다."`,"책임을 감독이 먼저 지자 공기가 달라집니다."],
  [-2,`🗣️ "이 결과를 팬들 앞에서 어떻게 설명할지, 각자 생각해 보십시오."`,"선수들이 고개를 들지 못합니다."],
  [3,`🤝 "오늘은 여기까지. 집에 가서 푹 쉬고, 월요일에 다시 시작합시다."`,"무거웠던 어깨가 조금 내려갑니다."]]
/* ---------- 하프타임 라커룸 토크 (전반전을 마치고 후반전을 앞둔 시점 — 스코어 상황별 멘트) ---------- */
const LOCKER_HT_WIN=[
  [3,`👏 "좋습니다! 딱 이대로 후반전도 이어갑시다."`,"차분하면서도 자신감 있는 표정들입니다."],
  [4,`🔥 "여기서 만족하면 안 됩니다. 후반에 한 골 더 추가합시다!"`,"눈빛이 다시 날카로워집니다."],
  [1,`🛡️ "리드는 지키는 게 우선입니다. 무리하지 말고 침착하게 갑시다."`,"신중한 표정으로 고개를 끄덕입니다."],
  [2,`🌟 (전반전 활약한 선수를 콕 집어 칭찬합니다.)`,"지목된 선수가 자신감을 얻은 표정입니다."],
  [0,`🧐 "방심은 금물입니다. 후반전에 뒤집힌 경기 많이 봤습니다."`,"긴장감이 다시 살아납니다."],
  [-1,`😤 "이 정도로 만족하지 마세요. 더 확실하게 끝냅시다."`,"칭찬 대신 나온 채찍에 다소 위축된 표정도 보입니다."],
  [2,`🤝 "전반전 팀워크, 정말 좋았습니다. 그대로만 가죠."`,"팀 전체가 하나로 뭉친 분위기입니다."],
  [1,`😌 (짧게 격려만 하고 후반전 준비를 지시합니다.)`,"담백한 격려에 선수들도 편안해합니다."]];
const LOCKER_HT_DRAW=[
  [2,`⚖️ "팽팽합니다. 후반전에 집중력을 끌어올립시다."`,"차분히 각오를 다지는 분위기입니다."],
  [4,`🔥 "후반전에 승부를 봅시다! 우리가 더 간절합니다!"`,"눈빛이 뜨겁게 달아오릅니다."],
  [-1,`😤 "이 정도밖에 못 합니까? 더 뛰어야 합니다."`,"질책에 라커룸이 다소 얼어붙습니다."],
  [3,`💪 "충분히 이길 수 있는 경기입니다. 후반에 결판냅시다."`,"자신감이 다시 차오릅니다."],
  [0,`🧐 "전반전 약점을 후반엔 보완합시다."`,"몇몇 선수가 뜨끔한 표정을 짓습니다."],
  [1,`😌 "나쁘지 않습니다. 침착하게 기회를 기다립시다."`,"담담하게 후반전을 준비하는 분위기입니다."],
  [2,`🤝 "포기하지 않는 모습, 좋습니다. 끝까지 갑시다."`,"격려에 표정이 한결 밝아집니다."],
  [-2,`🧊 "기대에 못 미치는 전반전이었습니다."`,"무거운 분위기 속에 후반전을 준비합니다."],
  [0,`📋 (전술판을 지우고 후반 그림을 처음부터 다시 그립니다.)`,"…","boardWipe"],
  [2,`🔍 "저쪽 오른쪽 풀백, 후반에 반드시 지칩니다. 그쪽으로 계속 가세요."`,"구체적인 지시에 눈빛이 살아납니다."],
  [1,`⏱️ "60분까지는 지금 그대로. 그 뒤에 승부 겁니다."`,"계획이 잡히자 표정이 차분해집니다."]]
const LOCKER_HT_LOSS=[
  [-2,`😡 "이대로는 안 됩니다! 후반전엔 완전히 달라져야 해요!"`,"질책에 정신이 번쩍 든 표정들입니다."],
  [3,`💪 "아직 후반전이 남았습니다. 충분히 뒤집을 수 있어요!"`,"눈빛에 다시 불이 붙습니다."],
  [0,`🧐 (조용히 전반전 실수를 하나하나 짚어줍니다.)`,"지적받은 선수들의 표정이 굳어집니다."],
  [1,`🤝 "괜찮습니다. 후반전엔 우리 페이스로 갑시다."`,"격려에 조금씩 표정이 풀립니다."],
  [4,`🔥 "여기서 무너지면 안 됩니다! 후반에 전부 쏟아부읍시다!"`,"결의에 찬 표정들이 늘어납니다."],
  [-3,`😠 "변명의 여지가 없는 전반전이었습니다. 정신 차리세요!"`,"라커룸에 무거운 침묵이 흐릅니다."],
  [-1,`⚖️ "쉽지 않지만, 후반전에 만회할 시간은 있습니다."`,"긴장 속에 침착하게 준비하는 분위기입니다."],
  [2,`🙏 "다들 힘든 거 압니다. 그래도 끝까지 해봅시다."`,"위로의 말에 다시 힘을 내는 표정입니다."],
  [0,`🪑 (의자를 걷어차며) "이게 팀이야?! 이게 팀이야!!"`,"…",  "chairKick"],
  [0,`📋 (전술판을 손으로 쓸어 지우고 처음부터 다시 그립니다.)`,"…","boardWipe"],
  [0,`🤫 (한마디도 하지 않고 선수들을 한 명씩 오래 바라봅니다.)`,"…","silentStare"],
  [2,`🎯 "후반 15분만 버티면 저쪽이 먼저 무너집니다. 그때까지만 참읍시다."`,"구체적인 그림에 선수들이 고개를 끄덕입니다."],
  [3,`🫂 (고개 숙인 선수 옆에 앉아 어깨를 두드립니다.) "네 탓 아니다. 같이 하자."`,"주변 선수들까지 표정이 풀립니다."],
  [-2,`📉 "지금 나가는 열한 명, 다음 경기 선발 아닐 수도 있습니다."`,"긴장과 불만이 동시에 감돕니다."]]
function lockerTalkUI(title, resHtml, opts, onclickFn){
  inLockerTalk=true;
  lockerScreenState={kind:'options', title, resHtml, opts, onclickFn};
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  $("#advBtn").disabled=true;
  $("#main").innerHTML=`<h2>🚪 ${title}</h2>
  ${resHtml}
  <div class="card">
    ${opts.map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" onclick="${onclickFn}(${i})">${o[1]}</button>`).join("")}
  </div>`;
}
/* ── 특수 라커룸 선택지 ────────────────────────────────────────────
   보통 선택지는 사기 증감이 고정이다. 하지만 "의자를 걷어차는" 종류의 행동은 결과가 정해져 있으면
   고를 이유가 없다. 선수단의 리더십·팀워크·승부욕과 지금 사기를 보고 주사위를 굴린다.
   뭉치면 크게 오르고, 어긋나면 크게 깎인다. 어느 쪽이든 기억에는 남는다. */
const LOCKER_SPECIAL={
  chairKick:{
    unite:[9, "라커룸이 물을 끼얹은 듯 조용해지더니, 주장이 자리에서 일어나 소리쳤습니다. \"감독님 말씀이 맞습니다. 후반에 보여줍시다!\" 선수들이 하나둘 따라 일어섭니다."],
    fail:[-11, "걷어차인 의자가 락커에 부딪혀 큰 소리를 냈습니다. 아무도 눈을 마주치지 않습니다. 몇몇은 그저 감독이 나가기만을 기다리는 표정입니다."]
  },
  boardWipe:{
    unite:[7, "전술판을 손등으로 쓸어 지운 뒤 처음부터 다시 그렸습니다. 선수들이 반쯤 일어서서 보드를 들여다봅니다."],
    fail:[-7, "지워진 전술판 앞에서 선수들이 서로 눈치를 봅니다. \"그래서 뭘 하라는 거지?\" 누군가 작게 중얼거렸습니다."]
  },
  silentStare:{
    unite:[6, "감독은 한마디도 하지 않고 선수들을 하나씩 오래 바라봤습니다. 그 침묵이 어떤 말보다 무거웠습니다."],
    fail:[-5, "긴 침묵에 선수들이 서로 눈짓만 주고받습니다. 무슨 뜻인지 아무도 모르는 표정입니다."]
  },
  fightScreen:{
    unite:[8, "스크린에 대문짝만하게 FIGHT 한 단어. 3초쯤 정적이 흐르다 주장이 픽 웃더니 일어섰습니다. \"...단어 알죠. 싸웁시다.\" 웃음과 함성이 뒤섞이며 라커룸이 달아올랐습니다."],
    fail:[-6, "스크린의 FIGHT를 다들 멀뚱히 쳐다봅니다. \"...이게 대체 무슨 소리야?\" 뒷줄에서 새어 나온 혼잣말에 몇몇이 웃음을 참습니다. 파워포인트는 조용히 꺼졌습니다."]
  }
};
/* 선택지가 특수 항목이면 그 자리에서 결과를 굴려 실제 [증감, 문구]를 만들어 돌려준다 */
function resolveLockerOpt(o){
  const key=o[3]; if(!key || !LOCKER_SPECIAL[key]) return o;
  const t=userTeam();
  const xi=(t.players||[]).slice().sort((a,b)=>b.ovr-a.ovr).slice(0,14);
  const avg=k=>xi.length?xi.reduce((s,p)=>s+(p.attr?attr20(p.attr[k]):10),0)/xi.length:10;
  let unite = 0.30
    + (avg("ldr")-10)*0.034      // 라커룸에 목소리 내는 선수가 있으면 뭉친다
    + (avg("tea")-10)*0.028
    + (avg("det")-10)*0.020
    + ((t.morale||70)-70)*0.008
    + (aff && xi.length ? (xi.reduce((s,p)=>s+aff(p),0)/xi.length-50)*0.005 : 0);  // 감독을 믿는 만큼
  unite=clamp(unite, 0.10, 0.90);
  const r=LOCKER_SPECIAL[key][Math.random()<unite ? "unite" : "fail"];
  return [r[0], o[1], r[1], key];
}
function applyLockerEffect(o){
  const t=userTeam();
  /* 라커룸 한마디로 사기가 5씩 오르면 말만으로 시즌이 굴러간다.
     ─ 상승분은 절반으로 줄이고, 이미 사기가 높을수록 덜 먹힌다(잘나갈 때 더 해줄 말이 없다).
     ─ 하락분은 그대로 — 잘못 말한 대가는 온전히 치른다. */
  let d=o[0];
  if(d>0){ d *= 0.55 * clamp(1-(t.morale-58)/55, 0.30, 1); d=Math.round(d*10)/10; }
  t.morale=clamp(t.morale+d,40,99);
  // 개인별 사기 증감은 이제 renderPlayerReactions에서 선수별 반응 카테고리에 따라 각자 다르게 적용한다(reactAndApply) —
  // 여기서는 팀 전체 사기만 조정한다.
  addMood(`🚪 ${t.name} 라커룸 — ${o[2]}`);
}
/* =====================================================
   팬 간담회 (리그 3연패 이상 시 경기 종료 후 발생)
   기자회견과 비슷한 형식으로 관중석에 남은 팬 대표와 즉석 문답을 나눈다. 대답의 수위에 따라
   팬 신뢰도(G.trust.fans)가 오르내리며, 화를 내며 자리를 박차고 나가거나 팬들에게 물병을 던지는
   극단적 선택도 가능하다(이 경우 구단주 신뢰도·구단 이미지에도 함께 타격을 준다).
   간담회가 끝나면 곧바로 경기 후 라커룸 토크로 이어진다.
===================================================== */
const FAN_TOWNHALL_Q_LOSE=[
  `"감독님! 벌써 리그 {n}연패입니다. 저희가 지금 이 팀에 시즌권을 갖다 바친 게 맞습니까?!" — 경기장을 떠나지 않고 남아있던 팬 대표가 마이크를 잡고 소리쳤습니다.`,
  `"{n}연패라니, 도대체 팀에 무슨 일이 있는 겁니까? 저흰 설명을 들을 자격이 있다고 봅니다." — 격앙된 팬들이 감독을 둘러싸고 즉석 간담회를 요구했습니다.`,
  `"매주 경기장에 나오는 저희 심정은 생각해 보셨습니까? {n}연패, 이제 정말 실망스럽습니다." — 서포터즈석에서 걸어 나온 팬 대표가 담담하지만 단호하게 물었습니다.`];
/* 순수 연패는 아니지만(무승부가 섞여 있음) 5경기 이상 승리가 없는 경우 — "연패"라는 표현 대신 "무승"으로 문구를 구분한다 */
const FAN_TOWNHALL_Q_WINLESS=[
  `"감독님! 벌써 {n}경기째 승리가 없습니다. 저희가 지금 이 팀에 시즌권을 갖다 바친 게 맞습니까?!" — 경기장을 떠나지 않고 남아있던 팬 대표가 마이크를 잡고 소리쳤습니다.`,
  `"{n}경기 무승이라니, 도대체 팀에 무슨 일이 있는 겁니까? 저흰 설명을 들을 자격이 있다고 봅니다." — 격앙된 팬들이 감독을 둘러싸고 즉석 간담회를 요구했습니다.`,
  `"매주 경기장에 나오는 저희 심정은 생각해 보셨습니까? {n}경기째 이기는 모습을 못 봤습니다, 이제 정말 실망스럽습니다." — 서포터즈석에서 걸어 나온 팬 대표가 담담하지만 단호하게 물었습니다.`];
/* [팬 신뢰도 증감, 버튼 문구, 팬 반응 후보들, 진행자/취재진 반응 후보들] — 앞 6개는 일반 답변, 마지막 2개(스톰아웃/물병)는
   별도 함수(fanTownhallStormOut/fanTownhallThrowBottle)에서 확인창을 거쳐 즉시 처리된다. */
const FAN_TOWNHALL_OPTS=[
  [8, `🙇 "면목 없습니다. 이 결과는 전적으로 제 책임입니다. 반드시 바꿔놓겠습니다."`,
    ["팬들 사이에 잠시 정적이 흐르다, 이내 나지막한 박수가 터져나옵니다.","가장 격앙됐던 팬도 팔짱을 풀며 표정이 누그러집니다.","\"그래요, 일단 믿어보겠습니다\" — 누군가의 외침에 여기저기서 고개를 끄덕입니다."],
    ["진행을 맡은 서포터즈 대표가 \"솔직한 사과, 팬들도 느꼈을 겁니다\"라며 자리를 정리합니다.","현장 취재진들도 \"의외로 담백한 사과\"라며 수첩에 적어 내려갑니다."]],
  [5, `🧐 "냉정하게 원인을 분석했습니다. 다음 경기부터 바로 바꾸겠습니다."`,
    ["팬들이 진지하게 귀를 기울이며 고개를 끄덕입니다.","\"그래서 구체적으로 뭘 바꾼다는 겁니까!\"라는 날카로운 목소리도 섞여 나옵니다.","차분한 설명에 격앙됐던 분위기가 조금씩 가라앉습니다."],
    ["진행자가 \"구체적인 답변, 나쁘지 않네요\"라고 평합니다.","취재진 몇몇이 \"전술적 코멘트\"라며 서둘러 메모합니다."]],
  [4, `🤝 "선수들은 최선을 다했습니다. 조금만 더 믿고 응원해 주십시오."`,
    ["일부는 고개를 끄덕이지만, \"그놈의 최선 타령 지겹다\"는 야유도 함께 섞입니다.","선수단을 감싸는 말에 박수와 야유가 동시에 터져나옵니다."],
    ["진행자가 \"선수단을 감싸는 감독님\"이라며 조심스럽게 분위기를 살핍니다."]],
  [1, `😅 "죄송합니다. 다음엔 꼭 좋은 모습 보여드리겠습니다."`,
    ["형식적인 사과에 팬들의 표정이 떨떠름합니다.","\"그 말, 지난주에도 들었는데요?\"라는 냉소가 나옵니다."],
    ["진행자도 애매한 표정으로 서둘러 자리를 정리합니다."]],
  [-2, `⚖️ "결과로 보여드리는 수밖에 없습니다. 지켜봐 주십시오."`,
    ["원론적인 대답에 팬들 사이에서 실망 섞인 한숨이 나옵니다.","\"그 결과가 지금 이거잖아요!\"라는 고성이 터집니다."],
    ["진행자가 \"팬들이 원한 건 그 이상이었을 텐데요\"라며 되묻습니다."]],
  [-7, `🙄 "저희도 최선을 다했습니다. 결과만 갖고 몰아세우진 말아주시죠."`,
    ["방어적인 답변에 야유가 쏟아집니다.","\"핑계 대지 마세요!\"라는 외침이 곳곳에서 터집니다.","실망한 팬 몇몇이 등을 돌리고 자리를 뜹니다."],
    ["진행자가 당황한 기색으로 \"진정하시라\"며 팬들을 다독입니다.","취재진들이 \"방어적 태도\"라고 일제히 받아적습니다."]],
  [-14, `😠 (화를 내며 자리를 박차고 나갑니다.)`,
    ["황당해하던 팬들 사이에서 야유와 탄식이 동시에 터집니다.","\"저게 지금 감독이 할 짓이냐!\"라는 고성이 터져나옵니다.","등을 돌린 팬 여럿이 굿즈를 그 자리에 버리고 갑니다."],
    ["진행자가 당혹스러운 표정으로 서둘러 마이크를 정리합니다.","취재진 카메라 플래시가 일제히 감독을 향해 터집니다."]],
  [-30, `🍾 (팬들을 향해 물병을 집어 던집니다.)`,
    ["비명과 고성이 뒤섞이며 현장이 순식간에 아수라장이 됩니다.","경악한 팬들이 항의하며 구단 사무국으로 몰려갑니다.","맞을 뻔한 팬이 \"이게 프로 구단 감독이 할 짓이냐\"며 목소리를 높입니다."],
    ["진행자가 급히 마이크를 끄고 행사를 중단시킵니다.","취재진 카메라가 일제히 그 장면을 향해 몰려듭니다."]]
];
/* 발동 조건: 리그 3연패 이상, 또는 최근 5경기 이상 무승(무승부 포함, 승리가 하나도 없는 경우) */
/* 팬 간담회 발생 조건 — 3연패, 또는 5경기 이상 무승.
   ⚠ 연패가 이어지는 동안 매 경기 다시 열리면(3연패·4연패·5연패…) 라커룸 토크·기자회견까지
      매번 세 단계를 거치게 돼 지겨워진다. 한 번 열면 3라운드는 쉬고,
      그 사이에 상황이 더 나빠졌을 때(연패가 2 이상 길어졌을 때)만 예외로 다시 연다. */
const TOWNHALL_GAP=3;
function shouldTriggerFanTownhall(){
  const t=userTeam();
  if(!t) return false;
  if(G.phase==="pre" || G.phase==="sacked") return false;      // 연습경기로는 팬이 몰려오지 않는다
  const last3=t.form.slice(-3);
  const streakL = last3.length>=3 && last3.every(f=>f==="L");
  const last5=t.form.slice(-5);
  const winless5 = last5.length>=5 && last5.every(f=>f!=="W");
  // 서포터 신뢰가 이미 바닥이면 2연패만으로도 몰려온다
  const fansAngry = (G.trust&&G.trust.fans<35) && t.form.slice(-2).length>=2 && t.form.slice(-2).every(f=>f!=="W");
  if(!(streakL || winless5 || fansAngry)) return false;
  const rd = t.div===1?G.r1:G.r2;
  if(rd<3) return false;                                        // 개막 직후는 아직 참아 준다
  const info = fanTownhallStreakInfo(t);
  const last = G.townhall || null;                 // {rd, n}
  if(last){
    const gapOk = rd-last.rd >= TOWNHALL_GAP;
    const muchWorse = info.n >= last.n+3;   // 3연패 → 6연패 → 9연패 처럼 확실히 더 나빠졌을 때만
    if(!gapOk && !muchWorse) return false;
  }
  G.townhall={rd, n:info.n};
  return true;
}
function fanLoseStreakLen(t){
  const rev=t.form.slice().reverse();
  const idx=rev.findIndex(f=>f!=="L");
  return idx===-1 ? rev.length : idx;
}
function fanWinlessStreakLen(t){
  const rev=t.form.slice().reverse();
  const idx=rev.findIndex(f=>f==="W");
  return idx===-1 ? rev.length : idx;
}
/* 3연패(정확히 "연패")와 5경기 이상 무승(패+무 섞임)은 팬들이 체감하는 절박함의 결이 달라 질문 문구를 구분한다 —
   순수 연패가 3 이상이면 그쪽을 우선하고, 아니면(즉 무승부가 섞여 3연패는 아니지만 5경기 이상 무승인 경우) 무승 문구를 쓴다. */
function fanTownhallStreakInfo(t){
  const loseLen=fanLoseStreakLen(t);
  if(loseLen>=3) return {kind:'lose', n:loseLen};
  return {kind:'winless', n:fanWinlessStreakLen(t)};
}
function showFanTownhall(M, cont){
  fanTownhallCtx={M, cont, phase:'question'};
  $("#advBtn").disabled=true;
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("on",b.dataset.v==="match"));
  renderFanTownhall();
}
function renderFanTownhall(){
  const ctx=fanTownhallCtx; if(!ctx) return;
  const t=userTeam();
  if(ctx.phase==='result'){
    const {fanLine, hostLine, delta}=ctx.resultData;
    $("#main").innerHTML=`<h2>📢 팬 간담회</h2>
    <div class="msg ${delta>0?'good':delta<0?'warn':'info'}">📊 팬 신뢰도 ${delta>0?'+':''}${delta} (현재 ${trustLabel(G.trust.fans)} · ${Math.round(G.trust.fans)})</div>
    <div class="card">
      <p>${fanLine}</p>
      <p class="small" style="margin-top:8px">${hostLine}</p>
      <button class="bigbtn" style="max-width:280px;margin-top:14px" onclick="continueFanTownhall()">🚪 라커룸으로 ▶</button>
    </div>`;
    return;
  }
  const info=fanTownhallStreakInfo(t);
  const q=pick(info.kind==='lose'?FAN_TOWNHALL_Q_LOSE:FAN_TOWNHALL_Q_WINLESS).replace("{n}", info.n);
  $("#main").innerHTML=`<h2>📢 팬 간담회</h2>
  <div class="msg warn">팬 신뢰도: <b>${trustLabel(G.trust.fans)}</b> (${Math.round(G.trust.fans)}) — 경기장을 떠나지 않은 팬들이 감독과의 즉석 간담회를 요구했습니다.</div>
  <div class="card">
    <p>${q}</p>
    ${FAN_TOWNHALL_OPTS.slice(0,6).map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:9px" onclick="fanTownhallAnswer(${i})">${o[1]}</button>`).join("")}
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="mini" style="border-color:var(--gold);color:var(--gold)" onclick="fanTownhallBangeo()">🐟 "여러분들, 지금 방어철입니다! 방어회, 제가 쏘겠습니다!"</button>
      <button class="mini" style="border-color:var(--red);color:var(--red)" onclick="fanTownhallStormOut()">${FAN_TOWNHALL_OPTS[6][1]}</button>
      ${wildOff()?"":`<button class="mini" style="border-color:var(--red);background:#3a0d0d;color:#ff8080" onclick="fanTownhallThrowBottle()">${FAN_TOWNHALL_OPTS[7][1]}</button>`}
    </div>
  </div>`;
}
/* 🐟 방어회 승부수 */
function fanTownhallBangeo(){
  const ctx=fanTownhallCtx; if(!ctx) return;
  const t=userTeam();
  const info=fanTownhallStreakInfo(t);
  const mo=(()=>{ try{ return dateOfDay(G.day||0).getMonth()+1; }catch(e){ return 6; } })();
  const inSeason = (mo>=11 || mo<=2);
  let okP = 0.34 + (G.trust.fans-50)*0.006 - Math.max(0,(info.n||3)-3)*0.06 + (inSeason?0.10:-0.12);
  okP=clamp(okP, 0.08, 0.72);
  const M=me();
  if(M.cash<0.6){
    showConfirm(`<b>🐟 방어회를 쏘려면 돈이 필요합니다.</b>\n\n서포터즈 수십 명분 방어회면 최소 0.6억은 듭니다.\n(보유 ${moneyEok(M.cash)} — 감독 사비)`,
      ()=>{}, {okLabel:"알겠습니다", cancelLabel:""});
    return;
  }
  const win=Math.random()<okP;
  if(win){
    mePay(-(0.6+R(5)/10), "서포터즈 방어회 회식");
    adjustTrust("fans", 9, "방어회 회식");
    t.morale=Math.round(clamp((t.morale||70)+2,40,99)*100)/100;
    const fanLine=pick([
      `3초쯤 정적이 흐르다 — 맨 앞줄에서 누가 웃음을 터뜨립니다. "아니 ㅋㅋㅋ 지금 그 얘기가 나옵니까" 웃음이 번지고, 누군가 외칩니다. "가시죠 그럼!"`,
      `"...진짜 쏘시는 겁니까?" 반신반의하던 팬들이 감독이 법인카드가 아니라 개인카드를 꺼내자 환호합니다.`,
      `성토 대회가 순식간에 회식 장소 투표로 바뀝니다. 서포터즈 대표가 "오늘만 봐드립니다"라며 웃습니다.`]);
    addNews(`🐟 ${t.name} 감독, 성난 팬들에게 "방어철" 승부수 — 간담회가 방어회 회식으로 끝났습니다. 감독 사비.`, "good", "club");
    socialFill(SOC.bangeoOk, 4+R(3), 1, {t:t.short});
    fmkFill(FMK.bangeoOk, 3+R(2), {t:t.short});
    ctx.phase='result'; ctx.resultData={fanLine, hostLine:`진행자가 마이크를 내려놓으며 웃습니다. "간담회는 여기서 마치고... 회식 장소로 이동하겠습니다."`, delta:9};
  } else {
    adjustTrust("fans", -8, "간담회 중 부적절한 농담");
    G.press.rel=clamp(G.press.rel-4,0,100);
    const fanLine=pick([
      `정적. "...지금 장난하십니까?" 맨 앞줄 팬의 목소리가 떨립니다. "우리가 지금 회 먹자고 모인 줄 아세요?"`,
      `"${info.n}연${info.kind==='lose'?'패':'무'} 중인데 방어 타령이 나옵니까!" 야유가 쏟아지고, 몇몇은 자리를 박차고 일어납니다.`,
      `아무도 웃지 않았습니다. 침묵 속에서 누군가 또박또박 말합니다. "성적으로 쏘세요, 성적으로."`]);
    addNews(`🐟 ${t.name} 감독, 성난 팬 간담회에서 "방어회 쏘겠다" 발언 — 분위기가 얼어붙었습니다.`, "warn", "club");
    socialFill(SOC.bangeoBad, 4+R(3), -1, {t:t.short});
    fmkFill(FMK.bangeoBad, 3+R(2), {t:t.short});
    rivalFill(RIV.bangeo, 2+R(2), 0, {t:t.short});
    ctx.phase='result'; ctx.resultData={fanLine, hostLine:`진행자가 헛기침을 하며 서둘러 다음 질문으로 넘깁니다.`, delta:-8};
  }
  saveGame(); renderFanTownhall();
}
function fanTownhallAnswer(i){
  const ctx=fanTownhallCtx; if(!ctx) return;
  const o=FAN_TOWNHALL_OPTS[i]; if(!o) return;
  const t=userTeam();
  adjustTrust("fans", o[0], "팬 간담회 답변");
  const fanLine=pick(o[2]), hostLine=pick(o[3]);
  addNews(`📢 ${t.name} 팬 간담회 — ${fanLine}`);
  ctx.phase='result'; ctx.resultData={fanLine, hostLine, delta:o[0]};
  saveGame();
  renderFanTownhall();
}
function continueFanTownhall(){
  const ctx=fanTownhallCtx; fanTownhallCtx=null;
  $("#advBtn").disabled=false;
  if(ctx && ctx.cont) ctx.cont();
}
/* 화를 내며 팬 간담회장을 박차고 나간다 — 확인창을 거쳐 즉시 종료, 팬 신뢰도 크게 하락 + 구단주 신뢰도도 소폭 하락 */
function fanTownhallStormOut(){
  const ctx=fanTownhallCtx; if(!ctx) return;
  showConfirm(`😠 정말 화를 내며 팬 간담회장을 박차고 나가시겠습니까?\n팬 신뢰도가 크게 떨어지고, 구단주 신뢰도에도 영향을 줍니다.`, ()=>{
    const o=FAN_TOWNHALL_OPTS[6];
    const t=userTeam();
    adjustTrust("fans", o[0], "팬 간담회 도중 격분 퇴장");
    adjustTrust("owner", -6, "팬 간담회 도중 격분 퇴장");
    const reaction=pick(o[2]);
    addNews(`😠 [속보] ${t.name} 감독, 팬 간담회 도중 격분해 자리를 박차고 나감 — ${reaction}`);
    socialFill(SOC.thStorm, 4+R(2), -1, {t:t.short}); fmkFill(FMK.thStorm, 3+R(2), {t:t.short}); rivalOnManager(false);
    for(const q of t.players) affAdd(q, -3, "간담회 퇴장");   // 선수들도 그 장면을 봤다
    fanTownhallCtx=null; $("#advBtn").disabled=false;
    saveGame(); ctx.cont();
  }, {okLabel:"박차고 나가기", danger:true});
}
/* 팬들에게 물병 투척 — 팬 신뢰도 폭락 + 구단주 신뢰도 큰 폭 하락 + 구단 자체 징계금 */
function fanTownhallThrowBottle(){
  if(wildOff()) return;
  const ctx=fanTownhallCtx; if(!ctx) return;
  showConfirm(`🍾 정말 팬들을 향해 물병을 던지시겠습니까?!\n팬 신뢰도가 폭락하고, 구단주 신뢰도와 구단 이미지에도 심각한 타격을 줍니다.`, ()=>{
    const o=FAN_TOWNHALL_OPTS[7];
    const t=userTeam();
    adjustTrust("fans", o[0], "팬 물병 투척 파문");
    adjustTrust("owner", -18, "팬 물병 투척 파문");
    const fine=mgrFine(2+R(16)/10, "팬 물병 투척 징계금");
    const reaction=pick(o[2]);
    addNews(`🚨 [속보] ${t.name} 감독, 팬 간담회 도중 관중을 향해 물병 투척! 구단 발칵 — 감독에게 자체 징계금 <b>${fine}억</b> 부과`);
    addNews(`💬 ${reaction}`);
    socialFill(SOC.thBottle, 5+R(3), -1, {t:t.short}); fmkFill(FMK.thBottle, 4+R(3), {t:t.short}); rivalOnManager(false);
    for(const q of t.players) affAdd(q, -7, "간담회 물병 투척");
    t.morale=Math.round(clamp(t.morale-4,35,99)*100)/100;
    fanTownhallCtx=null; $("#advBtn").disabled=false;
    saveGame(); ctx.cont();
  }, {okLabel:"투척", danger:true});
}
/* ---------- 선수별 개별 반응 (FM처럼 — 같은 말이라도 선수 성격·컨디션에 따라 제각각 다르게 반응한다) ---------- */
/* ═══ 🚪 라커룸 반응 — 리뉴얼 ═══════════════════════════════════════════
   ⚠ 예전 판은 <b>성격(4종) · 팀 사기 · 감독 호감도 · 지시 톤</b> 넷만 보고 카테고리를 뽑았다.
      그래서 해트트릭을 한 선수와 퇴장당한 선수가 <b>같은 문장</b>을 말했다.
      경기에서 무슨 일이 있었는지가 반응에 하나도 반영되지 않았다 —
      x.rating · x.goals · x.assists · x.y · x.red · 교체 시점 · 스코어 · 주장 · 불만/약속 ·
      컨디션 같은 재료가 <b>이미 다 있는데</b> 아무것도 읽지 않았다.
   ─ 반응의 재료를 「성격」에서 「성격 + 오늘 있었던 일」로 넓힌다.
     문장도 사실을 인용한다({g}골 · 평점 {r} · 교체 시각 {m}분).                       */
const REACT_POOL={
  /* ── 기존 결(성격·톤) ── */
  determined:  ["🔥 {p}, 결의에 찬 표정으로 고개를 끄덕입니다.","🔥 {p}: \"반드시 해내겠습니다.\"","🔥 {p}, 정강이 보호대를 고쳐 차며 눈빛이 달라집니다.","🔥 {p}: \"오늘은 다릅니다. 지켜봐 주세요.\""],
  fired_up:    ["💥 {p}, 흥분을 감추지 못하고 주먹을 불끈 쥡니다.","💥 {p}: \"당장 나가서 뛰고 싶습니다!\"","💥 {p}, 라커를 손바닥으로 한 번 치고 일어섭니다."],
  confident:   ["😎 {p}: \"맡겨만 주세요.\"","😎 {p}, 자신감 넘치는 표정으로 팀원들을 다독입니다.","😎 {p}: \"문제없습니다, 감독님.\""],
  calm:        ["😐 {p}, 별다른 동요 없이 담담하게 듣습니다.","😐 {p}: \"네, 알겠습니다.\" (덤덤한 반응)","😐 {p}, 평소와 다름없는 표정입니다."],
  nervous:     ["😰 {p}, 살짝 긴장한 기색이 역력합니다.","😰 {p}: \"잘할 수 있을까요...\" 하며 손을 꼭 쥡니다.","😰 {p}, 시선을 피하며 조용히 고개만 끄덕입니다."],
  distracted:  ["🙄 {p}, 다른 생각을 하는 듯 집중력이 흐트러져 보입니다.","🙄 {p}, 표정이 영 딴 데 가 있습니다.","🙄 {p}, 건성으로 고개만 끄덕입니다."],
  unhappy:     ["😤 {p}, 못마땅한 표정을 숨기지 않습니다.","😤 {p}, 팔짱을 낀 채 시선을 돌립니다.","😤 {p}: \"...\" (불만스러운 표정)"],
  relieved:    ["🙂 {p}, 안도한 표정으로 미소를 짓습니다.","🙂 {p}, 긴장이 풀린 듯 어깨를 폅니다."],
  /* ── 🆕 오늘 있었던 일이 만드는 결 ── */
  proud:       ["🌟 {p}, {g}골을 넣은 얼굴로 조용히 웃습니다. \"더 넣을 수 있었습니다.\"",
                "🌟 동료들이 {p}의 등을 두드리고 지나갑니다. 애써 담담한 척하지만 입꼬리가 올라가 있습니다.",
                "🌟 {p}: \"골은 제가 넣었지만 만들어 준 건 팀입니다.\" 평점 {r}짜리 경기였습니다."],
  humble_star: ["🫡 {p}, 평점 {r}을 받고도 \"수비에서 한 번 놓친 게 계속 걸립니다\"라며 고개를 젓습니다.",
                "🫡 {p}, 칭찬이 나오자 오히려 자세를 고쳐 앉습니다. \"다음 경기가 더 중요합니다.\""],
  guilty:      ["😞 {p}, 고개를 들지 못합니다. 오늘의 실수가 계속 머릿속을 맴도는 표정입니다.",
                "😞 {p}: \"제 탓입니다. 변명하지 않겠습니다.\" 목소리가 잠겨 있습니다.",
                "😞 {p}, 유니폼으로 얼굴을 덮은 채 한참을 그대로 앉아 있습니다."],
  red_shame:   ["🟥 {p}, 퇴장당한 뒤로 라커룸 구석에서 한마디도 하지 않습니다.",
                "🟥 {p}: \"동료들한테 미안합니다. 제가 팀을 열 명으로 만들었습니다.\"",
                "🟥 {p}, 주장이 어깨를 두드리자 그제서야 고개를 들었습니다."],
  angry_off:   ["😠 {p}, {m}분 만에 교체된 것이 못마땅한 표정입니다. 벤치에 앉을 때 물병을 툭 밀쳤습니다.",
                "😠 {p}: \"제가 그렇게 못했습니까?\" {m}분 교체에 납득하지 못한 얼굴입니다.",
                "😠 {p}, 교체 사인을 보고 장갑을 벗어 던지듯 내려놓았습니다."],
  pro_off:     ["🤝 {p}, {m}분 교체를 담담히 받아들이고 들어온 선수와 손바닥을 마주칩니다.",
                "🤝 {p}: \"팀에 필요한 결정이었다면 괜찮습니다.\""],
  rally:       ["🅒 주장 {p}가 자리에서 일어나 라커룸을 둘러봅니다. \"고개 들어. 아직 안 끝났다.\"",
                "🅒 주장 {p}: \"감독님 말씀대로 갑니다. 각자 자기 자리에서 한 발씩만 더 뜁시다.\"",
                "🅒 {p}, 완장을 고쳐 매며 어린 선수들을 하나씩 눈으로 붙잡습니다."],
  defiant:     ["🧨 {p}, 감독의 말이 끝나기도 전에 짧게 코웃음을 쳤습니다.",
                "🧨 {p}: \"...그 얘긴 지난번에도 들었습니다.\" 라커룸이 순간 조용해집니다.",
                "🧨 {p}, 대놓고 휴대폰을 꺼내 들여다봅니다."],
  drained:     ["🥵 {p}, 벽에 등을 기댄 채 숨을 고르느라 말이 없습니다.",
                "🥵 {p}, 고개를 끄덕이긴 하는데 다리가 풀려 일어서질 못합니다.",
                "🥵 {p}, 얼음주머니를 허벅지에 올린 채 눈을 감고 듣습니다."],
  debut_awe:   ["🐣 {p}, 선배들 사이에서 잔뜩 굳은 얼굴로 감독의 말을 한 마디도 놓치지 않으려 합니다.",
                "🐣 {p}, 심장이 뛰는 게 보일 만큼 긴장했습니다. 물을 두 번이나 들이켰습니다."]
};
/* 반응 카테고리별 개인 사기 증감 — 오늘 있었던 일이 만드는 결은 폭이 더 크다 */
const CATEGORY_MORALE_DELTA={
  determined:2, fired_up:3, confident:1, calm:0, relieved:1, nervous:-1, distracted:-2, unhappy:-3,
  proud:4, humble_star:2, guilty:-3, red_shame:-5, angry_off:-4, pro_off:0,
  rally:2, defiant:-4, drained:-1, debut_awe:1
};
/* 🆕 오늘 이 선수에게 무슨 일이 있었나 — 라커룸 반응의 재료.
   경기 전·하프타임에는 x.rating 이 아직 없다(경기 종료 시 계산). 없으면 없는 대로 굴러가게 만든다. */
function reactCtxOf(p, x, M, stage){
  const t=userTeam();
  const c={g:0, a:0, y:0, red:false, rating:null, mins:null, offAt:null, early:false,
           cap:false, unhappy:0, cond:(p.cond!=null?p.cond:100), rookie:false, res:0};
  try{
    if(x){
      c.g=x.goals||0; c.a=x.assists||0; c.y=x.y||0; c.red=!!x.red;
      c.rating=(x.rating!=null?x.rating:null);
      if(x.on!=null) c.mins=((x.off!=null?x.off:(M&&M.min!=null?M.min:90))-x.on);
      if(x.off!=null && !x.red && !x.injGap){ c.offAt=x.off; c.early=(x.off<66 && x.on===0); }
    }
    const ci=(typeof capInfo==="function")?capInfo(t):null;
    c.cap = !!(ci && ci.c===p.id);
    c.unhappy=(p.unhappy||0)+((p.promiseBroken||0)>0?1:0);
    c.rookie = ((p.apps||0)<=2 && (p.age||25)<=21);
    if(M){ const us=(M.home.id===t.id), gf=us?M.hg:M.ag, ga=us?M.ag:M.hg;
           c.res = gf>ga?1 : gf<ga?-1 : 0; }
  }catch(e){}
  return c;
}
/* 🆕 카테고리 선택 — ① 오늘 있었던 일이 먼저, ② 그다음이 성격·톤.
   실제 라커룸이 그렇다. 퇴장당한 선수에게 성격은 부차적이다. */
function playerReactionCategory(p, toneScore, ctx, stage){
  const pers=p.pers||0; // 0프로페셔널 1야심가 2온화함 3다혈질
  const moraleLow=(p.morale||70)<55;
  const A=aff(p);
  toneScore += A>=72 ? 1 : A<=30 ? -1 : 0;
  const r=Math.random();
  const c=ctx||{};
  /* ── ① 사건 우선순위 ── */
  if(c.red) return r<0.75?'red_shame':'guilty';
  if(c.unhappy>=2 && A<=45 && r<0.62) return 'defiant';
  if(stage==='post'){
    if(c.rating!=null){
      if(c.rating>=8.0 || (c.g>=2)) return (pers===0 && r<0.5) ? 'humble_star' : 'proud';
      if(c.g>=1 || c.a>=2) return r<0.62?'proud':(pers===0?'humble_star':'confident');
      if(c.rating<=5.4) return r<0.6?'guilty':(pers===3?'unhappy':'nervous');
    } else if(c.g>=1) return 'proud';
    if(c.cond<=62 && r<0.55) return 'drained';
  } else {
    if(c.g>=1 && r<0.7) return 'proud';
  }
  if(c.early && stage!=='pre'){
    /* 조기 교체 — 야심가·다혈질은 대놓고 화를 내고, 프로페셔널은 받아들인다 */
    const mad = (pers===1?0.72 : pers===3?0.80 : pers===2?0.40 : 0.28) + (A<=45?0.15:0) - (c.res>0?0.18:0);
    return r<clamp(mad,0.10,0.92) ? 'angry_off' : 'pro_off';
  }
  if(c.cap && toneScore<=0 && r<0.55) return 'rally';          // 분위기가 가라앉으면 주장이 먼저 일어선다
  if(c.rookie && r<0.55) return 'debut_awe';
  /* ── ② 성격·톤 (기존 결) ── */
  if(toneScore>=3){
    if(pers===3) return r<0.55?'fired_up':'determined';
    if(pers===1) return r<0.6?'determined':'confident';
    if(pers===0) return r<0.65?'determined':'confident';
    return r<0.5?'relieved':(r<0.85?'calm':'confident');
  }
  if(toneScore<=-1){
    if(moraleLow) return r<0.5?'unhappy':'distracted';
    if(pers===3) return r<0.55?'unhappy':'distracted';
    if(pers===2) return r<0.5?'nervous':'calm';
    if(pers===1) return r<0.45?'unhappy':'nervous';
    return r<0.4?'nervous':'calm';
  }
  if(toneScore===0){
    if(pers===3) return r<0.3?'distracted':(r<0.65?'calm':'nervous');
    if(pers===2) return r<0.6?'calm':'nervous';
    return r<0.5?'calm':(r<0.8?'nervous':'determined');
  }
  if(moraleLow) return r<0.4?'nervous':'calm';
  if(pers===2) return r<0.55?'calm':'relieved';
  if(pers===3) return r<0.35?'distracted':(r<0.7?'determined':'fired_up');
  return r<0.4?'calm':(r<0.75?'determined':'confident');
}
/* 문장 안의 사실 자리표를 채운다 — {p} 이름 · {g} 골 · {r} 평점 · {m} 교체 시각 */
function reactFill(line, p, c){
  return line.replace(/\{p\}/g, p.name)
             .replace(/\{g\}/g, String(c&&c.g?c.g:1))
             .replace(/\{r\}/g, (c&&c.rating!=null)?c.rating.toFixed(2):"—")
             .replace(/\{m\}/g, String((c&&c.offAt!=null)?c.offAt:"?"));
}
function samplePlayers(t, n){
  // 선발급(상위) 선수 위주로 후보를 뽑되, 매번 다른 얼굴이 나오도록 순서를 섞는다
  // (매치 컨텍스트가 없는 예외적인 경우에 한해 쓰이는 fallback)
  const pool=[...t.players].filter(p=>avail(p)).sort((a,b)=>b.ovr-a.ovr).slice(0,16);
  const shuffled=pool.map(p=>({p,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.p);
  return shuffled.slice(0,Math.min(n,shuffled.length));
}
/* 이번 라커룸 토크가 어느 경기의 매치데이 스쿼드(출전 11 + 벤치)를 대상으로 하는지 알아낸다 */
function matchSquadFor(M){
  if(!M) return null;
  const t=userTeam();
  if(M.home.id!==t.id && M.away.id!==t.id) return null;
  return M.home.id===t.id ? M.h : M.a;
}
// 반응 카테고리별 "개인 사기" 증감폭 — 같은 지시를 들어도 결의에 차면 더 오르고, 못마땅해하면 오히려 떨어진다(FM처럼 개인차를 준다)
/* (카테고리별 사기 증감표는 REACT_POOL 옆으로 옮겼다 — 새 카테고리와 한자리에서 관리한다) */
/* 경기 후 라커룸에서 "결장(벤치에만 있었던)" 선수들의 반응 — 실제로 뛰지 못했으니 감독의 지시 톤과 별개로
   기본적으로 아쉬움·불만이 깔려 있다(FM처럼 현실적으로: 선수들은 못 뛰면 기분이 나쁘다). */
/* 🪑 벤치 반응도 같은 원칙으로 리뉴얼한다.
   ⚠ 예전 판은 성격 하나로만 갈렸다 — <b>이번 시즌 한 번도 못 뛴 선수</b>와
      <b>지난 경기에 풀타임을 뛴 선수</b>가 똑같이 「아쉬워」했다.
      게다가 감독이 <b>출전 약속을 깨 놓은</b> 선수도 그냥 「마뜩잖은 표정」이었다.
   ─ 출전 가뭄(시즌 출전 시간)·약속 파기·불만 단계·팀 승패를 함께 본다. */
const BENCH_REACT_POOL={
  annoyed:     ["😑 {p}, 오늘도 벤치 신세였습니다. 마뜩잖은 표정입니다.","😑 {p}: \"언제쯤 기회가 올까요...\" 씁쓸해합니다.","😑 {p}, 애써 태연한 척하지만 아쉬움이 묻어납니다.","😑 {p}, 유니폼을 정리하며 한숨을 내쉽니다."],
  frustrated:  ["😤 {p}, 노골적으로 불만스러운 표정을 짓습니다.","😤 {p}: \"이 정도면 저도 뛸 자격 있는 거 아닙니까?\"","😤 {p}, 팔짱을 낀 채 시선을 피합니다.","😤 {p}, 라커룸 문을 세게 닫고 나갑니다."],
  patient:     ["🙂 {p}, 묵묵히 다음 기회를 기다립니다.","🙂 {p}: \"제 차례가 올 겁니다.\" 담담한 표정입니다.","🙂 {p}, 프로답게 담담히 받아들입니다."],
  /* 🆕 */
  drought:     ["🥀 {p}, 이번 시즌 출전 시간이 거의 없습니다. 아무 말 없이 가방을 챙깁니다.",
                "🥀 {p}: \"제가 여기 왜 있는지 모르겠습니다.\" 혼잣말에 가까웠습니다.",
                "🥀 {p}, 벤치에서 몸을 푸는 것도 이제 그만뒀습니다."],
  betrayed:    ["💔 {p}, 출전 약속을 떠올리는 표정으로 감독을 똑바로 쳐다봅니다.",
                "💔 {p}: \"약속하셨잖습니까.\" 짧은 한마디에 라커룸이 조용해집니다."],
  glad_win:    ["👏 {p}, 못 뛴 아쉬움보다 팀이 이긴 게 먼저인 듯 동료들과 손뼉을 마주칩니다.",
                "👏 {p}: \"오늘은 형들이 다 했네요.\" 웃으며 물병을 돌립니다."],
  ready:       ["🔥 {p}, 못 나간 게 분한 듯 다음 경기를 벼르는 눈빛입니다.",
                "🔥 {p}: \"다음엔 준비돼 있겠습니다.\" 목소리에 힘이 들어가 있습니다."]
};
const BENCH_MORALE_DELTA={annoyed:-2, frustrated:-4, patient:-1, drought:-5, betrayed:-6, glad_win:0, ready:-1};
function benchReactionCategory(p, ctx){
  const pers=p.pers||0; // 0프로페셔널 1야심가 2온화함 3다혈질
  const c=ctx||{}; const r=Math.random();
  /* 약속을 깨 놓고 또 앉혀 두면 그게 제일 크게 남는다 */
  if((p.promiseBroken||0)>0 && r<0.70) return 'betrayed';
  /* 출전 가뭄 — 시즌 누적 출전 시간이 사실상 없다 */
  if((p.apps||0)<=1 && (G.round||0)>=6 && r<0.65) return 'drought';
  if((p.unhappy||0)>=2 && r<0.60) return 'frustrated';
  /* 팀이 이겼으면 못 뛴 아쉬움이 조금 묻힌다 — 프로페셔널·온화함일수록 */
  if(c.res>0 && r<(pers===0?0.55:pers===2?0.45:0.25)) return 'glad_win';
  if(pers===0) return r<0.45?'patient':(r<0.72?'annoyed':(r<0.90?'ready':'frustrated'));
  if(pers===1) return r<0.32?'annoyed':(r<0.66?'frustrated':(r<0.88?'ready':'patient'));
  if(pers===2) return r<0.45?'patient':(r<0.78?'annoyed':(r<0.92?'ready':'frustrated'));
  return r<0.28?'annoyed':(r<0.66?'frustrated':(r<0.88?'ready':'patient'));
}
/* kind: 'starter'(선발로 뛴 선수) | 'sub'(교체로 투입돼 뛴 선수) | 'unused'(경기 후 — 벤치에서 한 번도 못 뛴 선수) */
function reactAndApply(p, toneScore, kind, x, M, stage){
  kind = kind||'starter';
  const ctx=reactCtxOf(p, x, M, stage);
  if(kind==='unused'){
    const cat=benchReactionCategory(p, ctx);
    const line=reactFill(pick(BENCH_REACT_POOL[cat]), p, ctx);
    // 감독이 아무리 좋은 말을 해도 못 뛴 아쉬움이 더 크게 작용하지만, 톤이 긍정적이면 그나마 조금은 누그러진다
    const delta=(BENCH_MORALE_DELTA[cat]!==undefined?BENCH_MORALE_DELTA[cat]:0)+Math.round(toneScore*0.15);
    p.morale=clamp((p.morale||70)+delta,30,99);
    affAdd(p, delta*0.28, "결장");     // 못 뛴 선수에게 감독의 말은 더 크게 남는다
    return {p, cat, line, delta, kind};
  }
  const effTone = kind==='sub' ? toneScore+1 : toneScore; // 교체로나마 뛴 선수는 출전 자체를 긍정적으로 받아들인다
  const cat=playerReactionCategory(p, effTone, ctx, stage);
  let line=reactFill(pick(REACT_POOL[cat]), p, ctx);
  if(kind==='sub') line += ` <span class="small">(교체 출전 · ${ctx.mins!=null?ctx.mins+"분":"—"})</span>`;
  /* 🆕 사기 증감에도 오늘의 활약이 들어간다 — 잘한 선수는 같은 말에도 더 오르고,
     퇴장·저평점은 감독이 뭐라 하든 스스로 깎인다. */
  let perf=0;
  if(ctx.rating!=null) perf += clamp((ctx.rating-6.6)*1.6, -3, 3);
  perf += ctx.g*1.2 + ctx.a*0.6 - (ctx.red?2.5:0) - ctx.y*0.3;
  const delta=Math.round(toneScore*0.4 + perf*0.6)
             +(CATEGORY_MORALE_DELTA[cat]!==undefined?CATEGORY_MORALE_DELTA[cat]:0)+(kind==='sub'?1:0);
  p.morale=clamp((p.morale||70)+delta,30,99);
  affAdd(p, delta*0.22, "라커룸");     // 라커룸에서 들은 말이 감독에 대한 인상을 만든다
  return {p, cat, line, delta, kind};
}
function renderPlayerReactionRow(r){
  /* 같은 카드를 두 화면이 쓰지만 수치의 의미가 다르다 — 우리 라커룸 토크는 '선수 개인 사기',
     상대 라커룸 방문(kind:"away")은 '그 선수의 감독 호감도'가 움직인다. 라벨로 구분해 준다. */
  const lbl = r.kind==="away" ? "감독 호감도" : "사기";
  const arrow=r.delta>0?`<span style="color:var(--green)">${lbl} ▲${r.delta}</span>`:r.delta<0?`<span style="color:var(--red)">${lbl} ▼${Math.abs(r.delta)}</span>`:`<span class="small">${lbl} ±0</span>`;
  return `<div class="reactCell">
    <div class="reactHead"><span class="pos-${r.p.pos}"><b>${r.p.name}</b></span>
      <span class="small">${PERS_N[r.p.pers||0]}</span> ${arrow}</div>
    <div class="reactLine">${r.line}</div>
  </div>`;
}
/* 라커룸 토크의 선수단 반응 계산 — 뛴 선수(선발+교체 출전) 전원과 벤치 대기 선수 전원이 각자 반응하고, 그 자리에서
   각자의 개인 사기도 함께 갱신된다. stage==='post'(경기 후)일 때만 벤치 대기 선수를 "결장으로 아쉬워하는" 반응으로 처리한다 —
   킥오프 전/하프타임엔 아직 뛸 기회가 남아있으므로 실망시킬 필요가 없다.
   "경기" 탭 재진입시 재계산되어 사기가 중복 적용되지 않도록, 이 결과는 호출 측(lockerScreenState.reactionsData)에 캐시해서 재사용해야 한다. */
function computeSquadReactions(M, toneScore, stage){
  const sd=matchSquadFor(M);
  if(!sd){
    const picks=samplePlayers(userTeam(), 4+R(2));
    return {onPitch:picks.map(p=>reactAndApply(p,toneScore,'starter',null,M,stage)), bench:[]};
  }
  // 출전 선수 = 선발이든 교체든 실제로 그라운드를 밟은 모든 선수(현재 뛰고 있는지 여부와 무관 — 이미 교체돼 나간 선수도 포함)
  const onPitch=sd.list.map(x=>reactAndApply(x.p, toneScore, x.on>0?'sub':'starter', x, M, stage));
  const benchKind = stage==='post' ? 'unused' : 'starter';
  const bench=sd.bench.slice().map(p=>reactAndApply(p,toneScore, benchKind, null, M, stage));
  return {onPitch, bench};
}
/* 스무 명 넘는 반응을 한 줄씩 세로로 쌓으면 화면을 한참 굴려야 한다 — 2열로 접어 한눈에 담는다. */
function renderReactionsHtml(data){
  const col=(rows, empty)=> rows.length
    ? `<div class="reactGrid">${rows.map(renderPlayerReactionRow).join("")}</div>`
    : `<p class="small">${empty}</p>`;
  return `<h4 style="margin:10px 0 6px">⚽ 출전 선수 <span class="small">(${data.onPitch.length}명)</span></h4>
  ${col(data.onPitch, "그라운드를 밟은 선수 정보가 없습니다.")}
  <h4 style="margin:14px 0 6px">🪑 벤치 대기 선수 <span class="small">(${data.bench.length}명)</span></h4>
  ${col(data.bench, "벤치 대기 선수가 없습니다.")}`;
}
/* 상단 바 — 오늘 날짜, 다음 경기까지 남은 날, 그리고 지금 신경 써야 할 것들 */
function calDateText(){
  if(!G.cal || G.day==null) return `${G.season} 시즌`;
  const dt=dateOfDay(G.day);
  /* 🌦️ 오늘 날씨 — 좌측 메뉴 하단 날짜 옆에 (요청) */
  let wx=""; try{ const w=dayWeather(G.day); wx=` <span title="${w.n}" style="font-size:13px">${w.ic}</span>`; }catch(e){}
  return `${dt.getMonth()+1}월 ${dt.getDate()}일 (${DOW_KR[dt.getDay()]})${wx}`;
}
/* 🌏 다음에 치를 EACL 경기 — 상단 일정 표기가 리그만 보지 않도록 */
function eaclNextForUser(){
  if(!eaclOn() || G.jobless) return null;
  const me=G.userTeamId;
  if(G.eacl.teams.indexOf(me)<0) return null;
  const day=G.day||0;
  const out=[];
  for(const m of G.eacl.fix){
    if(m.done || (m.h!==me && m.a!==me)) continue;
    const d=eaclMdDay(m.d);
    out.push({day:d, label:`${eaclShort()} ${m.d+1}차전`, home:m.h===me, opp:eaclTeam(m.h===me?m.a:m.h)});
  }
  const K=G.eacl.ko;
  for(const st of ["qf","sf","f"]){
    if(G.eacl.stage!==st) continue;
    const ties = st==="f" ? [K.f] : (K[st]||[]);
    for(const x of (ties||[])){
      if(!x || x.done || (x.h!==me && x.a!==me)) continue;
      out.push({day:eaclKoDay(st), label:`${eaclShort()} ${EACL_KO_NAME[st]}`, home:x.h===me, opp:eaclTeam(x.h===me?x.a:x.h)});
    }
  }
  if(!out.length) return null;
  out.sort((a,b)=>a.day-b.day);
  /* 이미 지난 날짜(치러야 하는데 밀린 경기)는 오늘로 본다 */
  const nx=out.find(x=>x.day>=day) || out[0];
  return nx && nx.opp ? nx : null;
}
/* 🌏 승강 PO 기간(12월)에 EACL 4강·결승을 치른다 — 그때 화면에 「승강 플레이오프」라고
   적으면 틀린 안내다. ⚠ 제보 — 「4강·결승인데 상단 날짜 옆과 좌측 정보 박스가
   둘 다 승강 플레이오프로 뜬다」. 지금 실제로 기다리고 있는 경기를 적는다. */
function eaclPhaseTag(withOpp){
  if(G.phase!=="po") return null;
  try{
    /* 승강 PO 일정이 남아 있고 오늘 치를 대회 경기도 없다면, 지금은 승강 PO 기간이 맞다 */
    if((G.poQueue||[]).length && !eaclUserDue()) return null;
    const en=eaclNextForUser(); if(!en) return null;
    const left=Math.max(0, (en.day||0)-(G.day||0));
    const opp=(withOpp && en.opp) ? ` · ${en.home?"홈":"원정"} ${en.opp.short||en.opp.name}` : "";
    return `🌏 ${en.label}${left===0?" — 오늘":` D-${left}`}${opp}`;
  }catch(e){}
  return null;
}
function updateTopBar(t, r, fix){
  const dEl=$("#tbD"), sEl=$("#tbSub"), rEl=$("#tbRight");
  if(!dEl) return;
  if(G.cal && G.day!=null){
    const dt=dateOfDay(G.day);
    /* 🌦️ 오늘 날씨 — 상단 날짜 옆에 (요청) */
    let wx=""; try{ const w=dayWeather(G.day); wx=` <span title="${w.n} — 공·발·체력에 영향을 줍니다">${w.ic}</span>`; }catch(e){}
    dEl.innerHTML=`${dt.getFullYear()}년 ${dt.getMonth()+1}월 ${dt.getDate()}일 (${DOW_KR[dt.getDay()]})${wx}`;
  } else {
    dEl.textContent=`${G.season} 시즌`;
  }
  let sub="";
  const _cwcTag=cwcTopTag();
  if(G.phase==="sacked") sub="🪑 경질";
  else if(_cwcTag) sub=_cwcTag;
  else if(G.phase==="po") sub=eaclPhaseTag(true) || "⚔️ 승강 플레이오프";
  else if(G.phase==="seasonEnd") sub="🏁 시즌 종료";
  else if(G.cal){
    /* ⚠ 제보 — 사흘 뒤 EACL 경기가 있는데 13일 뒤 리그 경기를 안내한다.
       상단 표기가 리그 일정만 보고 있었다. 다음에 실제로 치를 경기를 찾아 보여 준다. */
    const nr=userRoundNow();
    const cands=[];
    if(nr<fix.length){
      const opp=(function(){ for(const [hid,aid] of (fix[nr]||[])) if(hid===t.id||aid===t.id)
          return {o:G.teams[hid===t.id?aid:hid], home:hid===t.id}; return null; })();
      /* ⚠ 제보 — 「(오늘 3R 홈 아산)에 친선/리그/EACL/CWC 구분과 상대 순위도 적어 달라」 */
      cands.push({day:matchDayOf(nr), label:`${divName(t.div)} ${nr+1}R`, opp, tag:""});
    }
    try{
      const en=eaclNextForUser();
      if(en) cands.push({day:en.day, label:en.label, opp:{o:en.opp, home:en.home}, tag:"🌏 "});
    }catch(e){}
    /* 🌱 연습경기도 「다음에 치를 경기」다 — 제보: 코앞에 친선이 있는데 49일 뒤 리그를 안내한다 */
    try{
      const f=(G.friendlies||[]).filter(x=>!x.done && x.d>=G.day).sort((a,b)=>a.d-b.d)[0];
      if(f) cands.push({day:f.d, label:"연습경기", opp:{o:G.teams[f.oppId], home:f.home}, tag:"🌱 "});
    }catch(e){}
    if(cands.length){
      cands.sort((a,b)=>(a.day-b.day));
      const nx=cands[0];
      const left=Math.max(0, nx.day-G.day);
      const _rk=(o)=>{ try{
        if(!o) return "";
        if(o.div===1||o.div===2){ const tb=tableOf(o.div); const i=tb.findIndex(x=>x.id===o.id); if(i>=0) return `(${i+1}위)`; }
        else if(o.eacl && typeof eaclOn==="function" && eaclOn() && ["qf","sf","f"].indexOf(G.eacl.stage)<0){
          const i=eaclTableSorted().indexOf(o.id); if(i>=0) return `(${i+1}위)`;   // 토너먼트면 라벨(8강 등)이 대신 말한다
        }
      }catch(e){} return ""; };
      /* ⚠ 제보 — 「홈 OO(12위) 처럼 붙어 있는데 홈 OO (12위) 로 띄어 주세요」 */
      const _rkTxt=(o)=>{ const s=_rk(o); return s?` ${s}`:""; };
      const oppTxt=nx.opp&&nx.opp.o ? ` · ${nx.opp.home?"홈":"원정"} ${nx.opp.o.short}${_rkTxt(nx.opp.o)}` : "";
      sub = left===0
        ? `⚽ 오늘 ${nx.tag}${nx.label}${oppTxt}`
        : `${nx.tag}${nx.label}까지 ${left}일${oppTxt}`;
    } else sub="잔여 일정 없음";
  }
  sEl.textContent=sub;
  const bits=[`${G.season} 시즌 · ${Math.min(r+1,fix.length)}/${fix.length}R`,
    `예산 <b class="money">${t.budget}억</b>`,
    transferOpen()?`<span class="tbTag">🟢 이적시장</span>`:`🔴 이적시장 마감`];
  if(G.nego||G.snego) bits.push(`<span class="tbTag">🤝 협상 중</span>`);
  if((G.offers||[]).length) bits.push(`<span class="tbTag">📨 제의 ${G.offers.length}</span>`);
  const inj=t.players.filter(p=>p.inj>0).length, ban=t.players.filter(p=>p.ban>0).length;
  if(inj) bits.push(`🚑 ${inj}`);
  if(ban) bits.push(`⛔ ${ban}`);
  rEl.innerHTML=bits.join("<span style='opacity:.35'>|</span>");
}
