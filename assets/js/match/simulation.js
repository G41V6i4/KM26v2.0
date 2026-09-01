"use strict";
/* =====================================================
   경기 시뮬레이션
===================================================== */
/* ---------- 문자중계 텍스트 ---------- */
const COMM={
 ko:["📢 킥오프! 경기가 시작됩니다.","📢 심판의 휘슬! 경기 시작입니다.",
     "📢 {r} 주심의 휘슬과 함께 경기가 시작됩니다!","📢 오늘의 주심은 {r}. 킥오프!"],
 shotOn:["{p}, 슈팅 자세를 잡습니다!","{p}의 슛!","{p}, 강력하게 때립니다!","{p}, 침착하게 슈팅을 노립니다!","{p}의 과감한 슈팅 시도!","{p}, 골문을 향해 강하게 찝니다!","{p}, 골키퍼와 1대1 찬스! 슈팅!","{p}, 컷백을 받아 그대로 때립니다!","{p}, 반박자 빠른 슈팅!","{p}, 페널티 박스 바깥에서 중거리포를 노립니다!"],
 miss:["골대를 살짝 벗어납니다.","아깝게 빗나갑니다.","골대 위로 뜹니다.","옆그물을 때립니다.","크로스바를 강타합니다!","임팩트가 흔들리며 완전히 빗나갑니다.","슈팅 타이밍을 놓치며 애매하게 흐릅니다."],
 save:["{p}의 슈팅! 골키퍼 {g} 선수, 슈퍼 세이브!","{p}, 강력한 슛— 골키퍼 {g} 선수가 쳐냅니다!","{p}의 헤더, 골키퍼 {g} 선수 정면입니다.","{p}의 낮은 슛, 골키퍼 {g} 선수가 몸을 날려 막아냅니다!"],
 saveReflex:["{p}의 날카로운 슛! 골키퍼 {g} 선수가 반사신경으로 쳐냅니다!","{p}의 슈팅, 골키퍼 {g} 선수가 순간적으로 손끝에 걸어냅니다!","{p}의 임팩트 좋은 슛이었지만, 골키퍼 {g} 선수의 놀라운 반응 속도에 막힙니다!"],
 saveCommand:["{p}의 슈팅을 골키퍼 {g} 선수가 안정적으로 정면에서 캐치합니다.","{p}의 슛, 골키퍼 {g} 선수가 침착하게 몸으로 감싸안습니다.","{p}의 슈팅, 노련한 골키퍼 {g} 선수가 미리 각도를 좁혀 손쉽게 막아냅니다."],
 block:["{p}, 몸을 던져 극적으로 블록해냅니다!","{p}의 결정적인 클리어링!","{p}, 슈팅 코스에 정확히 몸을 갖다 대며 막아냅니다!","{p}, 마지막 순간 발을 뻗어 막아냅니다!"],
 goal:["⚽ 고오오올!! {p}의 득점!","⚽ {p}!! 네트가 출렁입니다!","⚽ 골입니다! {p}이/가 해냈습니다!","⚽ {p}, 완벽한 마무리!","⚽ 터졌습니다! {p}의 득점!"],
 goalA:["⚽ 고오오올!! {a}의 패스를 {p}이/가 침착하게 마무리!","⚽ {p} 득점! {a}의 환상적인 도움이었습니다!","⚽ {a}이/가 열어준 찬스, {p}이/가 놓치지 않습니다!"],
 ownGoal:["😱 아, 이럴 수가... {p}의 클리어링이 그대로 자책골이 되고 맙니다!","😱 {p}, 걷어내려던 공이 불행히도 자기 골문으로 빨려 들어갑니다... 자책골!","😱 {p}의 몸에 맞고 굴절된 공이 골키퍼를 완전히 속이며 자책골이 됩니다!"],
 pen:["📣 페널티킥! {p}이/가 박스 안에서 쓰러졌습니다!",
   "📣 {r} 주심, 지체 없이 스팟을 가리킵니다! 페널티킥!",
   "📣 박스 안 접촉 — 휘슬! {p}이/가 얻어낸 페널티킥입니다!"],
 offside:["🚩 {p}, 오프사이드 깃발이 올라갑니다.","🚩 부심의 깃발 — {p}이/가 한 발 앞서 나갔습니다.","🚩 오프사이드입니다. {p}의 타이밍이 빨랐습니다."],
 /* ── 하이라이트 자막용 실시간 해설 (LIVE) ────────────────────────
    화면에서 벌어지는 동작 하나하나를 따라가는 문장들이다. 문자중계 로그와 달리
    하이라이트 재생 중 하단 패널에만 흐르고, 시즌 기록에는 남지 않는다. */
 lvPass:["{p}, {q}에게 연결합니다.","{p}이/가 {q}에게 붙여 줍니다.","{p}의 패스, {q}이/가 받습니다.","{p} — {q}, 간결하게 이어 갑니다.","{p}, 지체 없이 {q}에게 내줍니다."],
 lvPassLong:["{p}, 크게 방향을 전환합니다! {q}을/를 향합니다.","{p}의 롱패스가 {q}에게 향합니다.","{p}, 단번에 전방으로 띄웁니다 — {q}!"],
 lvThrough:["{p}, 수비 뒷공간으로 찔러 줍니다! {q}이/가 달려 들어갑니다!","{p}의 스루패스! {q}이/가 침투합니다!","{p}, 라인 사이를 갈랐습니다 — {q}!"],
 lvCross:["{p}, 크로스를 올립니다!","{p}의 크로스가 문전으로 향합니다!","{p}, 감아 올립니다 — 박스 안이 붐빕니다!"],
 lvCutback:["{p}, 뒤로 낮게 빼줍니다!","{p}의 컷백! 문전으로 흘러 들어갑니다!"],
 lvDrib:["{p}, 몰고 들어갑니다.","{p}이/가 공을 끌고 전진합니다.","{p}, 속도를 올립니다!"],
 lvTakeOnWin:["{p}, 제쳤습니다! 그대로 파고듭니다!","{p}의 돌파! 수비수를 벗겨냈습니다!","{p}, 방향 전환 한 번에 수비를 지나칩니다!","아! {p}, 완전히 따돌렸습니다!"],
 lvTakeOnLose:["{p}, 막힙니다. 뚫지 못했습니다.","{p}의 돌파 시도— 수비가 잘 버텨냅니다.","{p}, 각을 못 찾고 걸립니다."],
 lvTackle:["아! {p}의 태클! 볼을 빼앗습니다!","{p}, 정확한 태클로 끊어냅니다!","{p}이/가 발을 뻗어 걷어냅니다!"],
 lvSlide:["{p}, 몸을 던진 슬라이딩 태클!","{p}의 슬라이딩! 아슬아슬하게 걷어냅니다!"],
 lvItc:["{p}, 패스 길목을 읽었습니다! 가로챕니다!","{p}이/가 중간에서 잘라냅니다!","{p}, 미리 읽고 있었습니다 — 인터셉트!"],
 lvClear:["{p}, 일단 크게 걷어냅니다.","{p}이/가 지체 없이 걷어냅니다.","{p}, 위험 지역을 벗어나게 보냅니다.","{p}, 머뭇거리지 않고 크게 처리합니다."],
 /* 🎙️ 상대 진영에서의 「걷어내기」는 수비 장면이 아니다 — 감사에서 공격수가 몰고 들어가다 「걷어냅니다」로 읽히는 어긋남 확인 */
 lvClearAtt:["{p}, 일단 급하게 처리합니다.","{p}, 복잡한 상황 — 정리부터 합니다."],
 lvShot:["{p}, 때립니다!","{p}의 슛!","{p}, 주저 없이 감아 찹니다!","{p}이/가 왼발을 휘두릅니다!","{p}, 한 박자 빠르게 때립니다!"],
 lvShotLong:["{p}, 중거리에서 노려 봅니다!","{p}, 멀리서 강하게 때립니다!"],
 lvHead:["{p}, 머리로 방향을 바꿉니다!","{p}의 헤더!"],
 lvSave:["{g} 골키퍼! 막아냅니다!","{g}, 손끝으로 걷어냅니다!","{g}의 선방! 소리가 터져 나옵니다!","{g}이/가 반응합니다 — 막아냅니다!"],
 lvCatch:["{g}, 안정적으로 품에 안습니다."],
 lvParry:["{g}이/가 쳐냈습니다! 아직 살아 있습니다!","{g}, 앞으로 쳐냅니다 — 위험합니다!"],
 lvTip:["{g}, 손끝에 걸었습니다! 코너킥!"],
 lvPunch:["{g}, 주먹으로 멀리 걷어냅니다!"],
 lvBlock:["{p}, 몸을 던져 막아냅니다!","{p}이/가 슈팅 코스를 막습니다!"],
 lvMiss:["빗나갑니다! 아깝습니다!","골문을 살짝 벗어납니다.","크로스바를 넘어갑니다!","옆그물을 때립니다. 아쉽습니다."],
 lvPost:["아! 골포스트를 때립니다!","크로스바 강타! 믿기지 않습니다!"],
 lvGoalLive:["⚽ 들어갔습니다!! {p}!!","⚽ 골!! {p}의 득점입니다!!","⚽ {p}!!! 그물이 흔들립니다!!","⚽ 터졌습니다! {p}!!"],
 lvGoalA:["⚽ {a}의 패스, {p}이/가 마무리합니다!!","⚽ {a}이/가 내준 공을 {p}이/가 밀어 넣습니다!!"],
 /* ── 골 종류별 첫 마디 ─────────────────────────────────────── */
 gHeader:["⚽ 헤더 골!! {p}, 완벽한 타이밍이었습니다!!","⚽ {p}의 머리!! 그대로 꽂힙니다!!","⚽ 솟아올랐습니다 — {p}의 헤더 골!!"],
 gVolley:["⚽ 발리 슛!! {p}, 이걸 그대로 때립니다!!","⚽ {p}의 논스톱 발리!! 환상적입니다!!","⚽ 떨어지는 공을 {p}이/가 그대로 감아 찼습니다!!"],
 gLong:["⚽ 중거리포!! {p}, 엄청난 슛입니다!!","⚽ {p}, 먼 거리에서 그대로 꽂아 넣습니다!!","⚽ 이건 대포알입니다! {p}의 중거리 골!!"],
 gFinesse:["⚽ 감아 찼습니다!! {p}, 구석으로 정확하게!!","⚽ {p}의 감아차기!! 골키퍼 손이 닿지 않습니다!!","⚽ 완벽한 궤적입니다 — {p}!!"],
 gChip:["⚽ 로빙 슛!! {p}, 골키퍼 머리 위를 넘겼습니다!!","⚽ {p}, 침착하게 띄워 넣습니다!!"],
 gPower:["⚽ 강슛!! {p}, 그물을 찢을 기세입니다!!","⚽ {p}의 강력한 슛이 그대로 들어갑니다!!"],
 gTap:["⚽ {p}, 밀어 넣기만 하면 됐습니다!!","⚽ 문전에서 {p}이/가 놓치지 않습니다!!","⚽ {p}, 침착하게 마무리합니다!!"],
 gPen:["⚽ 페널티킥 성공!! {p}, 흔들리지 않았습니다!!","⚽ {p}, 스팟에서 침착하게 넣습니다!!"],
 gFK:["⚽ 프리킥 골!!! {p}, 벽을 넘겨 그대로 꽂았습니다!!","⚽ {p}의 프리킥이 그대로 골문으로!!"],
 gSolo:["⚽ 단독 돌파에 이은 마무리!! {p}, 혼자 다 했습니다!!","⚽ {p}, 제치고 또 제치고— 그대로 골!!"],
 /* ── 세리머니 중 이어지는 리액션 ───────────────────────────── */
 celA:["와... 정말 멋진 골입니다.","이건 다시 봐야 합니다. 대단한 마무리였어요.","경기장이 완전히 폭발했습니다!","{p}, 두 팔을 벌리고 달려갑니다!","동료들이 {p}에게 몰려듭니다!"],
 celKeeper:["골키퍼도 막을 수 없는 슛이었습니다.","골키퍼는 그저 지켜볼 수밖에 없었습니다.","저건 어떤 골키퍼라도 어렵습니다."],
 celScore:["{t} {h} : {a} — 스코어가 바뀌었습니다.","이제 {h} 대 {a}입니다."],
 goalOffText:["🚩 골이 취소됩니다! {p}의 득점, 오프사이드 판정입니다.","🚩 {p}의 골— 부심의 깃발이 올라갑니다. 노골!"],
 lvOffFlag:["...그런데 부심의 깃발이 올라가 있습니다!","아, 잠깐— 깃발입니다!","부심이 깃발을 들고 있습니다!"],
 lvOffCancel:["🚩 오프사이드! {p}의 골이 취소됩니다!","🚩 노골입니다. {p}이/가 한 발 앞서 있었습니다.","🚩 득점 취소— 아슬아슬했습니다."],
 lvOffAfter:["선수들이 주심에게 항의합니다.","벤치에서 거세게 항의합니다.","리플레이로는 정말 종이 한 장 차이였습니다."],
 lvVarWait:["📺 판독이 길어집니다... 양 팀 선수들이 주심 주변에 모여 있습니다.","📺 관중석도 숨을 죽입니다. 전광판만 쳐다봅니다.","📺 주심이 손가락으로 귀를 누른 채 움직이지 않습니다."],
 lvVarOk:["📺 골 인정! {p}, 이제야 마음껏 웃습니다!","📺 주심이 센터서클을 가리킵니다 — 골입니다!"],
 lvVarNo:["📺 골 취소! {p}, 믿을 수 없다는 표정입니다.","📺 판독 결과 노골 — 벤치가 폭발합니다!"],
 celTeam:["{t} 벤치가 들썩입니다!","{t}, 분위기를 완전히 가져왔습니다!"],
 celEqual:["{t}, 승부를 다시 원점으로 돌립니다!","동점입니다! {t}이/가 균형을 맞췄습니다.","{t}, 기어이 따라붙었습니다!"],
 celLead:["{t}, 경기를 뒤집었습니다!","역전입니다! {t} 벤치가 뛰쳐나옵니다!","{t}이/가 앞서 나갑니다!"],
 celExtra:["{t}, 한 골 더 달아납니다.","{t}이/가 격차를 벌립니다.","쐐기를 박는 분위기입니다.","{t}, 이제 여유가 생겼습니다."],
 celRout:["{t}, 완전히 경기를 지배하고 있습니다.","이제는 일방적인 흐름입니다.","{t} 팬들은 축제 분위기입니다."],
 celChase:["{t}, 아직 포기하지 않았습니다!","한 골 따라붙습니다! 시간은 남아 있습니다.","{t} 벤치가 선수들을 재촉합니다."],
 lvFoulLive:["{p}, 반칙입니다. 휘슬이 울립니다.","{p}의 파울 — 주심이 경기를 끊습니다.","{p}, 늦었습니다. 반칙 선언입니다."],
 lvYellowLive:["🟨 {p}, 경고를 받습니다."],
 lvRedLive:["🟥 {p}, 퇴장입니다! 경기장이 술렁입니다!"],
 lvPenLive:["🅿️ 주심이 스팟을 가리킵니다! 페널티킥입니다!"],
 lvOffLive:["🚩 오프사이드! {p}이/가 먼저 나갔습니다."],
 lvCornerLive:["코너킥입니다. {t}의 기회입니다.","{t}, 코너킥을 얻어냅니다."],
 lvFKLive:["프리킥입니다. 벽이 세워집니다.","위험한 위치의 프리킥— 수비벽이 섭니다."],
 lvAerial:["{p}, 공중볼을 따냅니다!","{p}이/가 높이 솟아 머리에 맞힙니다!"],
 /* 🌦️ 날씨 해설 — ⚠ 요청 「날씨 관련 해설 코멘트」. 경기 중 이따금 그날의 조건을 짚어 준다 */
 wxRain:["🌧️ 빗줄기가 굵어집니다. 그라운드가 완전히 젖었습니다",
   "🌧️ 젖은 잔디 위에서 공이 예상보다 빠르게 흐릅니다",
   "🌧️ 이런 날에는 짧은 패스보다 확실한 처리가 낫습니다",
   "🌧️ 물이 고인 자리에서 공이 갑자기 멈춰 섭니다",
   "🌧️ 선수들 유니폼이 몸에 달라붙었습니다. 체감 무게가 다릅니다",
   "🌧️ 골키퍼가 장갑을 계속 털어냅니다 — 잡기 어려운 공입니다"],
 wxStorm:["⛈️ 폭우입니다. 정상적인 축구를 하기 어려운 조건입니다",
   "⛈️ 라인 근처에 물이 고여 공이 그대로 멈춥니다",
   "⛈️ 주심이 그라운드 상태를 살펴봅니다",
   "⛈️ 관중석은 이미 비옷 물결입니다. 그래도 자리를 지킵니다",
   "⛈️ 이 정도 비면 롱볼과 세컨볼 싸움이 됩니다"],
 wxSnow:["🌨️ 눈발이 날립니다. 라인이 보이지 않을 정도입니다",
   "🌨️ 발을 디딜 때마다 미끄러집니다 — 방향 전환이 위험합니다",
   "🌨️ 그라운드 관리팀이 라인을 다시 그리고 있습니다",
   "🌨️ 이런 날엔 공보다 발이 먼저 미끄러집니다",
   "🌨️ 흰 공이 눈에 묻혀 잘 보이지 않습니다"],
 wxHot:["🔥 폭염 경보 속 경기입니다. 선수들이 벌써 지쳐 보입니다",
   "🔥 급수 시간이 필요해 보입니다 — 벤치가 계속 물병을 던져 줍니다",
   "🔥 이 더위에서는 후반 30분이 승부처가 될 겁니다",
   "🔥 땀으로 유니폼 색이 달라졌습니다",
   "🔥 템포가 눈에 띄게 떨어집니다. 더위 탓입니다"],
 wxCold:["❄️ 입김이 하얗게 올라옵니다. 매서운 추위입니다",
   "❄️ 몸이 굳어 첫 발이 잘 나가지 않습니다",
   "❄️ 벤치의 선수들은 담요를 두르고 있습니다",
   "❄️ 언 땅이라 바운스가 예측되지 않습니다"],
 wxWind:["🌬️ 강한 바람이 붑니다. 롱볼이 크게 흐릅니다",
   "🌬️ 코너 깃발이 완전히 눕습니다",
   "🌬️ 바람을 등진 쪽이 확실히 유리해 보입니다",
   "🌬️ 골킥이 바람에 밀려 되돌아옵니다",
   "🌬️ 크로스가 바람을 타고 골문 쪽으로 흘러 들어갑니다"],
 lvInjury:["아... {p}이/가 쓰러져 있습니다. 괜찮을까요?","{p}, 그라운드에 주저앉습니다. 부상인가요?"],
 lvGKrush:["{g} 골키퍼가 뛰쳐나옵니다!","{g}, 박스 밖까지 나와 처리합니다!"],
 penGiven:["🅿️ 페널티킥이 선언됩니다! {t}에게 절호의 기회!","🅿️ 주심이 스팟을 가리킵니다 — {t}의 페널티킥!"],
 fkSpot:["{t}, 슈팅 각도에서 프리킥을 얻어냅니다. 벽이 세워집니다."],
 penGoal:["⚽ {p}, 페널티킥을 침착하게 성공시킵니다!"],
 penMiss:["{p}의 페널티킥... 골키퍼 {g} 선수 선방!! 믿을 수 없습니다!","{p}의 페널티킥을 골키퍼 {g} 선수가 정확히 예측하고 막아냅니다!"],
 foul:["{p}의 파울. 프리킥이 주어집니다.","{p}, 다소 거친 태클. 휘슬이 울립니다.",
   "{p}의 반칙 — {r} 주심, 어드밴티지 없이 바로 끊습니다.","{p}, 상대 유니폼을 잡아챕니다. 휘슬.",
   "{r} 주심이 {p}을/를 불러 짧게 주의를 줍니다.","{p}의 파울. 카드는 아낍니다."],
 yellow:["🟨 {p}, 경고를 받습니다.","🟨 {p}에게 옐로카드가 나옵니다.",
   "🟨 {r} 주심, 망설임 없이 카드를 꺼냅니다 — {p} 경고.","🟨 {p}, 전술적인 파울. 대가는 옐로카드입니다.",
   "🟨 {r} 주심이 {p}을/를 불러 세웁니다. 경고입니다.","🟨 {p}, 항의해 보지만 카드는 이미 나왔습니다."],
 second:["🟥 {p}, 두 번째 경고!! 퇴장입니다! 팀이 10명으로 싸웁니다!",
   "🟥 {r} 주심, 옐로 그리고 레드!! {p}, 경고 누적 퇴장입니다!",
   "🟥 {p}, 알고도 갔습니다 — 두 번째 옐로카드, 퇴장!"],
 red:["🟥 {p}, 다이렉트 퇴장!!! 심각한 반칙이었습니다!",
   "🟥 {r} 주심, 곧바로 레드카드!! {p}, 그라운드를 떠납니다!",
   "🟥 {p}!! 변명의 여지가 없는 태클 — 다이렉트 퇴장입니다!",
   "🟥 레드카드!! {p}의 항의도 소용없습니다. {r} 주심의 판정은 단호합니다."],
 dissentYellow:["🟨 실점 직후 흥분한 {p}, 주심에게 거칠게 항의하다 경고를 받습니다.","🟨 {p}, 판정에 격하게 항의하며 경고를 자초합니다.",
   "🟨 {p}, {r} 주심 면전까지 다가가 소리칩니다 — 바로 카드가 나옵니다."],
 dissentRed:["🟥 {p}, 흥분을 참지 못하고 주심에게 거칠게 항의하다 곧바로 퇴장당합니다!","🟥 실점에 격분한 {p}, 도를 넘는 항의로 다이렉트 퇴장!"],
 dissentSecond:["🟥 {p}, 항의로 두 번째 경고!! 흥분을 이기지 못하고 결국 퇴장당합니다.","🟥 이미 경고가 있던 {p}, 격분한 항의로 두 번째 옐로— 퇴장입니다!"],
 varCheck:["📺 골이 터진 듯했지만... 주심이 헤드셋에 손을 얹습니다. VAR 확인에 들어갑니다!","📺 {p}의 득점 장면, VAR 판독실에서 확인을 요청합니다. 경기가 잠시 중단됩니다.","📺 골 셀레브레이션이 채 끝나기도 전에 VAR 확인 사인이 떨어집니다!",
   "📺 {r} 주심이 귀에 손을 댑니다 — 판독실의 {v} 심판과 교신 중입니다.","📺 {r} 주심, 사각형을 그립니다. 온에어 리뷰!"],
 varConfirm:["📺 길었던 VAR 확인이 끝났습니다 — 골 인정!","📺 주심이 그라운드로 돌아와 골을 선언합니다. 판독 결과 이상 없음!",
   "📺 {v} 심판의 확인 끝 — {r} 주심이 센터서클을 가리킵니다. 골입니다!"],
 varOverturnOffside:["📺 판독 결과 — 오프사이드! {p}의 득점이 최종 취소됩니다.","📺 라인 판독 결과 미세한 오프사이드가 확인되며 골이 취소됩니다."],
 varOverturnFoul:["📺 판독 결과 — 빌드업 과정에서 파울이 확인되어 골이 취소됩니다.","📺 {p}의 골이 만들어지기 직전 핸드볼 파울이 확인되며 취소됩니다."],
 varOverturnPen:["📺 판독 결과 — 키커가 슛 순간 미끄러지며 공을 두 번 찼습니다. 재차 터치, 골 취소입니다!","📺 판독 결과 — 키커가 차기 전 수비 선수가 먼저 박스 안으로 들어왔습니다. 골이 취소되고 다시 찹니다."],
 corner:["{t}, 코너킥을 얻어냅니다.","{t}의 코너킥 찬스."],
 inj:["🚑 {p}, 그라운드에 쓰러집니다. 부상인 것 같습니다."],
 ht:["⏸️ 전반 종료. 라커룸으로 향합니다.","⏸️ 전반이 끝났습니다.","⏸️ {r} 주심의 휘슬 — 전반 45분이 끝났습니다."],
 ft:["📢 경기 종료!","📢 {r} 주심의 긴 휘슬! 경기가 끝났습니다.","📢 끝났습니다! 90분의 승부가 마무리됩니다."],

 /* ⏱️ 추가시간 — 4심이 전광판을 든다 */
 addH1:["⏱️ 4심이 전광판을 들어 올립니다 — 전반 추가시간 <b>{m}분</b>.",
   "⏱️ 전반 추가시간 <b>{m}분</b>이 표시됩니다.",
   "⏱️ {r} 주심, 전반에 <b>{m}분</b>을 더 줍니다."],
 addH2:["⏱️ 전광판에 <b>{m}분</b>. 후반 추가시간입니다.",
   "⏱️ 4심이 <b>{m}분</b>을 들어 올립니다 — 승부를 뒤집을 시간이 남았습니다.",
   "⏱️ {r} 주심이 <b>{m}분</b>을 더 줍니다. 벤치가 일제히 일어섭니다.",
   "⏱️ 후반 추가시간 <b>{m}분</b> — 이 시간 안에 끝내야 합니다."],
 addE:["⏱️ 연장 추가시간 <b>{m}분</b>입니다.",
   "⏱️ 전광판에 <b>{m}분</b> — 다리가 무거운 선수들에게는 긴 시간입니다.",
   "⏱️ {r} 주심, 연장에 <b>{m}분</b>을 더합니다."],

 /* ⏱️ 연장전 */
 etIn:["⏱️ <b>90분으로는 갈리지 않았습니다. 연장전입니다.</b> 전·후반 15분씩, 여기서 끝을 봅니다.",
   "⏱️ <b>{r} 주심의 휘슬 — 정규 시간 종료. 연장전으로 갑니다.</b> 양 팀 선수들이 그라운드에 주저앉습니다.",
   "⏱️ <b>승부는 연장으로 넘어갑니다.</b> 벤치가 급히 선수들을 불러 모읍니다 — 이제 체력과 집중력의 싸움입니다.",
   "⏱️ <b>연장전.</b> 90분 동안 못 낸 답을 30분 안에 내야 합니다."],
 etHt:["⏱️ 연장 전반 종료. 그라운드에서 짧게 물을 마시고 곧바로 방향을 바꿉니다.",
   "⏱️ 연장 전반이 끝났습니다. 앉을 시간도 없이 진영을 바꿉니다.",
   "⏱️ 연장 전반 종료 — 다리에 쥐가 난 선수들이 서로를 일으켜 세웁니다."],
 etGoal:["⚡ <b>연장에서 터졌습니다!</b> {p}!! 이 골 하나가 전부를 가릅니다!",
   "⚡ <b>{p}!!</b> 무거운 다리를 끌고 들어가 기어이 밀어 넣습니다!",
   "⚡ <b>{p}의 연장 결승골이 될 수 있습니다!</b> 벤치가 통째로 뛰쳐나옵니다!",
   "⚡ <b>{p}!!</b> 이 순간을 위해 120분을 버텼습니다!"],
 etTired:["😮‍💨 양 팀 모두 다리가 무겁습니다. 패스 하나에 숨이 찹니다.",
   "😮‍💨 벤치는 이미 교체 카드를 다 썼습니다. 남은 건 정신력뿐입니다.",
   "😮‍💨 그라운드 여기저기서 쥐가 나 주저앉습니다. 트레이너가 계속 뛰어 들어갑니다."],

 /* 🥅 승부차기 */
 pkStart:["🥅 <b>승부차기.</b> 120분으로도 갈리지 않았습니다. 이제 11m입니다.",
   "🥅 <b>결국 승부차기입니다.</b> 양 팀 선수들이 센터서클에서 어깨를 겁니다.",
   "🥅 <b>운명의 11m.</b> {r} 주심이 동전을 던지고, 골문이 정해졌습니다.",
   "🥅 <b>승부차기로 갑니다.</b> 여기서부터는 실력만큼이나 심장이 중요합니다."],
 pkGoal:["⚽ {p}, 침착하게 밀어 넣습니다.","⚽ {p} — 골키퍼는 반대로 넘어졌습니다. 성공!",
   "⚽ {p}, 망설임이 없었습니다. 골대 구석에 꽂힙니다.",
   "⚽ {p}이/가 성공시킵니다. 벤치가 주먹을 쥡니다.",
   "⚽ {p} — 강하게, 그리고 정확하게. 들어갑니다."],
 pkSave:["🧤 <b>막았습니다!</b> {g}, 방향을 정확히 읽었습니다!",
   "🧤 {g}의 선방! {p}의 킥이 손끝에 걸립니다!",
   "🧤 <b>{g}!!</b> 몸을 날려 쳐냅니다 — 골문이 그를 살렸습니다!",
   "🧤 {p}, 너무 가운데였습니다. {g}이/가 발로 막아냅니다!"],
 pkMiss:["❌ {p}, 하늘로 넘어갑니다. 고개를 들지 못합니다.",
   "❌ 골대를 맞고 나옵니다! {p}이/가 그 자리에 주저앉습니다.",
   "❌ {p}의 킥이 옆그물을 때립니다. 관중석에서 탄식이 터집니다.",
   "❌ 크게 벗어났습니다. {p}, 두 손으로 얼굴을 감쌉니다."],
 pkPressure:["🫥 이걸 넣으면 끝납니다. {p}이/가 공을 내려놓습니다.",
   "🫥 {p} — 실축하면 여기서 끝입니다. 경기장이 조용해집니다.",
   "🫥 팀의 운명을 진 킥입니다. {p}이/가 길게 숨을 내쉽니다."],
 pkEnd:["🏆 <b>{t}, 승부차기 끝에 살아남았습니다!</b> {p}이/가 마지막 킥을 성공시킵니다!",
   "🏆 <b>{t}의 승리!</b> 골문 앞에서 선수들이 뒤엉킵니다.",
   "🏆 <b>{t}이/가 11m 승부를 이겨냈습니다.</b> 반대편은 그라운드에 주저앉았습니다."]
};
/* 받침이 있는 글자인가 — 조사(이/가, 은/는, 을/를)를 고르는 기준 */
function hasJong(ch){
  if(!ch) return false;
  const c=ch.charCodeAt(0);
  if(c<0xAC00 || c>0xD7A3) return /[0-9a-zA-Z]/.test(ch) ? /[lmnr1360-9]/i.test(ch) : false;
  return ((c-0xAC00)%28)!==0;
}
/* 해설 문장 만들기.
   {p}{q}{a}{t}{g} 를 채우고, 바로 뒤에 오는 조사를 이름의 받침에 맞춰 고른다.
   ("맹성웅가" → "맹성웅이", "야고이" → "야고가") */
const JOSA={"이/가":["이","가"], "은/는":["은","는"], "을/를":["을","를"],
            "과/와":["과","와"], "와/과":["과","와"], "으로/로":["으로","로"]};
function fixJosa(s){
  return s.replace(/(.)(이\/가|은\/는|을\/를|과\/와|와\/과|으로\/로)/g,
    (m,ch,j)=> ch + JOSA[j][hasJong(ch)?0:1]);
}
const F_=(a,o)=>{
  o=o||{};
  let s=(typeof a==="string")?a:pick(a);
  // ⚠ \w 는 한글을 포함하지 않는다. timeVars() 가 주는 {개막D}·{시기}·{계절} 같은 한글 키가
  //    치환되지 않고 그대로 화면에 찍히던 버그가 있어, 한글 음절도 키로 받도록 넓혔다.
  s=s.replace(/\{([\w가-힣]+)\}/g, (m,k)=> (o[k]!==undefined && o[k]!==null) ? String(o[k]) : (k==="g"?"골키퍼":k==="r"?"주심":""));
  return fixJosa(s);
};
/* ---------- 매치 엔진 (분 단위) ---------- */
/* 관중이 많을수록 홈 이점이 커진다. 넓은 경기장에 반만 찬 것보다, 작은 전용구장이
   꽉 찬 쪽이 훨씬 시끄럽다 — 절대 인원과 좌석 점유율을 함께 본다. */
function homeBoost(M){
  if(M.opts && (M.opts.neutral || M.opts.friendly)) return 0;
  const sd=stadOf(M.home);
  const att=M.att || sd.avg;
  const fill=clamp(att/Math.max(1,sd.cap), 0, 1);
  const size=clamp(att/16000, 0, 1.2);
  /* ⚠ 실측 — 같은 두 팀으로 홈만 바꿔 240경기를 돌리니 홈 승률 49.2% · 원정 21.7% 가 나왔다.
     실제 K리그는 홈 43~46% · 무 24~26% · 원정 30~33% 다. 홈 이점이 과했다.
     여기(전력 보정)와 아래 liveRates 의 기본 공격 계수(1.30 vs 1.10)가 이중으로 걸려 있었다. */
  return clamp(0.60 + fill*0.88 + size*0.42, 0.5, 1.85);
}
/* 🧑‍💼 감독의 매치 플랜 — 선발을 뽑기 「전에」 이 경기용 전술을 짠다.
   전력 차와 상대의 시즌 성향을 읽어 슬라이더·포메이션을 조정하고,
   바뀐 포메이션 기준으로 선발이 뽑히므로 라인업 자체가 감독의 색을 입는다.
   경기가 끝나면(applyMatchResult) 시즌 기본값으로 복원된다. */
/* 🎲 경기 단위로 고정된 난수 — 같은 시즌·같은 상대·같은 홈원정이면 언제 물어도 같은 답이 나온다.
   ⚠ 제보 — 「사흘 전 전술 탭의 정찰 조언은 두루뭉술한데 경기 당일에야 상세해진다」.
     상대 감독의 경기 플랜(aiMatchPlan)이 createMatch 안에서, 즉 경기 당일에야 세워졌다.
     그래서 사흘 전에는 「시즌 기본 전술」을, 당일에는 「그 경기 플랜」을 보고 있었다.
     ─ 플랜 계산을 떼어 내 미리 볼 수 있게 하고, 난수를 경기 단위로 고정한다.
       사흘 전에 읽은 정찰과 당일에 실제로 나오는 전술이 같아진다. */
function planRand(key){
  let h=2166136261>>>0; const s=String(key);
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
  return function(){ h^=h<<13; h>>>=0; h^=h>>>17; h^=h<<5; h>>>=0; return (h>>>0)/4294967296; };
}
/* 상대 감독이 이 경기에 들고 나올 판 — 실제 적용과 정찰 미리보기가 같은 함수를 쓴다 */
function aiPlanFor(t, opp, isHome){
  /* 대회 클럽(EACL·CWC)은 COACHES 목록에 없다 — 팀 객체가 들고 있는 감독을 본다.
     이게 없으면 대륙·세계 대회 상대에 대한 수석코치 조언이 기본값으로만 나온다. */
  const c=(()=>{ try{
    return coachOf(t) || (((t&&(t.eacl||t.cwc)) && t.coach && t.coach.tac!=null) ? t.coach : null);
  }catch(e){ return null; } })();
  if(!c || !t || !t.tactic || t.isUser || !opp) return null;
  if(c.judg==null || c.tac==null) return null;
  /* 이미 이 경기의 플랜이 적용돼 있으면 「원래 판」에서 다시 계산한다 —
     그러지 않으면 적용된 값 위에 또 얹혀 정찰과 실제가 어긋난다 */
  const T=t._planBase0 || t.tactic;
  const P={formation:T.formation}; for(const k of TAC_KEYS) P[k]=T[k];
  let gap=0; try{ gap=teamOVR(opp)-teamOVR(t); }catch(e){}
  const jd=(c.judg-15)/5, tq=(c.tac-15)/5;
  const rnd=planRand(`${G.season}|${t.id}|${opp.id}|${isHome?1:0}`);
  const changed=_aiPlanBody(P, c, gap, jd, tq, opp, rnd);
  return changed ? P : null;
}
function aiMatchPlan(M, t, opp, isHome){
  const P=aiPlanFor(t, opp, isHome);
  if(!P) return;
  const T=t.tactic;
  const base={formation:T.formation}; for(const k of TAC_KEYS) base[k]=T[k];
  T.formation=P.formation; for(const k of TAC_KEYS) T[k]=P[k];
  t._planBase0=base;                       // 정찰이 원래 판을 볼 수 있게 남겨 둔다
  (M._planBase=M._planBase||{})[t.id]=base;
}
/* 실제 판단 — T 는 「고칠 대상」(플랜 객체)이고, rnd 는 경기 단위로 고정된 난수다 */
function _aiPlanBody(T, c, gap, jd, tq, opp, rnd){
  let changed=false;
  /* ① 전력 차 대응 — 언더독은 내려앉고, 압도적이면 무게를 싣는다. 전술 좋은 감독일수록 과감하다 */
  if(gap>=2.5){
    T.mentality=clamp(T.mentality-1,0,4); T.line=clamp(T.line-1,0,4); T.counter=clamp(T.counter+1,0,4); changed=true;
    if(gap>=4.5 && rnd()<0.45+tq*0.35){
      /* 상대가 압도적이면 아예 버스를 세우고 시작하는 감독도 있다 — 🚌 이제 진짜 텐백까지 */
      const bus=["5-3-2","4-1-4-1","5-2-1-2"];
      T.formation = (gap>=7 && (c.def-c.att)>=1 && rnd()<0.30) ? "7-2-1"
        : bus[Math.floor(rnd()*bus.length)];
      T.defGap=0; T.line=0;   // 🚌 텐백 = 매우 좁게 + 매우 낮은 라인 (토글 폐지)
      changed=true;
    }
  } else if(gap<=-2.5){
    T.mentality=clamp(T.mentality+1,0,4); T.press=clamp(T.press+1,0,4); changed=true;
    const atk=["4-3-3","4-2-2-2","3-4-3"];
    if(gap<=-4.5 && (c.att-c.def)>=1 && rnd()<0.35+tq*0.30){ T.formation=atk[Math.floor(rnd()*atk.length)]; changed=true; }
  }
  /* ② 상대 성향 읽기 — 경기판단 좋은 감독만 상대에 맞춘다 (윤정환·이정효급은 거의 매번)
     ⚠ TAC() 가 돌려주는 값은 0~4 를 0~2 로 줄여 놓은 것이다. 여기서 3·4 와 비교하고 있어서
        「상대가 와이드하다 / 압박이 강하다」 판정이 한 번도 성립하지 않았다 — 원본(raw)을 본다. */
  if(rnd() < 0.30 + jd*0.50){
    let oR=null; try{ oR=(TAC(opp)||{}).raw||null; }catch(e){}
    if(oR){
      if(oR.width>=3) T.width=clamp(T.width-1,0,4);            // 상대 와이드 → 좁혀 중앙 보호
      else if(oR.width<=1) T.width=clamp(T.width+1,0,4);       // 상대 좁음 → 측면 공략
      if(oR.press>=3){ T.pass=clamp(T.pass+1,0,4); T.tempo=clamp(T.tempo+1,0,4); }  // 압박 회피 다이렉트
      if(oR.mentality>=3 && gap>-2) T.counter=clamp(T.counter+1,0,4);               // 공격적 상대 → 역습 준비
      if(oR.line>=3) T.longShot=clamp(T.longShot+1,0,4);       // 높은 라인 → 뒷공간·중거리
      changed=true;
    }
  }
  return changed;
}
function aiPlanRestore(M){
  if(!M || !M._planBase) return;
  for(const tid in M._planBase){
    const t=G.teams[tid]; if(!t || !t.tactic) continue;
    const b=M._planBase[tid];
    for(const k of TAC_KEYS) if(b[k]!=null) t.tactic[k]=b[k];
    if(b.formation) t.tactic.formation=b.formation;
    delete t._planBase0;
  }
  M._planBase=null;
}
/* ═══════════════════════════════════════════════════════════════════════════
   ⏱️ 연장전 · 🥅 승부차기
   ⚠ 제보 — 「아챔 8강이 무승부였는데 결과가 1:0(승부차기)로 나온다. 경기는 90분에 끝났는데
      연장을 지나 승부차기까지 갔다는 뜻 아니냐」.
      맞다. 지금까지 토너먼트 동점은 eaclRecordKO 안에서 동전 던지기 한 줄로 끝났다 —
      `if(Math.random()<0.5) hg++; else ag++;`. 연장도 승부차기도 없었다.
   ─ 이제 녹아웃 경기가 90분에 동점이면 전·후반 15분씩 연장을 치르고,
     그래도 동점이면 실제로 한 명씩 차는 승부차기를 진행한다.
   ═══════════════════════════════════════════════════════════════════════════ */
const ET_SECONDS=1800;      // 연장 30분
/* ═══ ⏱️ 추가시간 — 「멈춰 있던 시간」을 되돌려 준다 ═══════════════════════
   주심은 정해진 숫자를 뽑는 게 아니라, 그 45분 동안 공이 죽어 있던 시간을 더한다.
   실제로 시간을 잡아먹는 것들만 센다 (2022 월드컵 이후 계측이 엄격해져 길어지는 추세).
     · 득점 + 세리머니   35초    · 교체          25초
     · 경고             12초    · 퇴장          45초
     · 부상 치료         55초    · 페널티킥      70초
     · VAR 판독         알아서 (판독이 걸리면 60~110초)
   여기에 그 45분의 기본 지연(전반 60초 · 후반 90초 · 연장 30초)을 얹고,
   주심이 올려 주는 판은 30초 단위로 끊어 올린다(45+2 처럼 분 단위로 보이게). */
const ADD_SEC={goal:35, sub:22, yellow:11, red:45, inj:55, pen:70, var:0};
const ADD_BASE={1:60, 2:90, 3:30, 4:30};      // 전반 · 후반 · 연장전반 · 연장후반
const ADD_MAX ={1:6*60, 2:11*60, 3:4*60, 4:5*60};
function addTimeCalc(c, period){
  c=c||{};
  let s=ADD_BASE[period]||60;
  s += (c.goal||0)*ADD_SEC.goal + (c.sub||0)*ADD_SEC.sub + (c.yellow||0)*ADD_SEC.yellow
     + (c.red||0)*ADD_SEC.red   + (c.inj||0)*ADD_SEC.inj + (c.pen||0)*ADD_SEC.pen;
  /* VAR 판독 — 득점·페널티·퇴장이 있었으면 걸릴 수 있다 */
  const varChance=clamp(((c.goal||0)+(c.pen||0)*1.5+(c.red||0)*1.5)*0.16, 0, 0.55);
  if(Math.random()<varChance) s += 60+R(51);
  s += R(26)-10;                                  // 주심마다 조금씩 다르다
  s = clamp(Math.round(s), 60, ADD_MAX[period]||600);
  /* 전광판은 분 단위로 뜬다 — 안내 문구와 실제 남은 시간이 어긋나지 않게 분으로 끊는다 */
  return Math.max(60, Math.round(s/60)*60);
}
/* 「45+2」 같은 표기 */
function addLabel(baseMin, sec){ return `${baseMin}+${Math.max(1, Math.round(sec/60))}`; }
const PK_ROUNDS=5;          // 정규 승부차기 5명
/* 키커 순서 — 페널티·침착성·결정력 순. 골키퍼는 맨 뒤로 밀린다. */
function pkSkillOf(p){
  if(!p) return 0;
  const a=p.attr||{};
  let v=(a.pen||60)*1.7 + (a.cmp||60)*1.1 + (a.fin||60)*0.9 + (a.tec||60)*0.5;
  if(p.pos==="GK") v-=260;
  return v;
}
/* 키커 순서 — ① 감독이 지정한 승부차기 순서(so) 중 지금 그라운드에 있는 선수
   ② 그다음 경기 중 페널티킥 전담(pk) ③ 남은 선수는 능력치 순 */
function pkOrderOf(sd){
  const on=(typeof onPitch==="function")?onPitch(sd):[];
  const live=on.map(x=>x.p).filter(p=>p && !p.red);
  const byId=(id)=>live.find(p=>p.id===id);
  const out=[], used=new Set();
  const push=(p)=>{ if(p && !used.has(p.id)){ used.add(p.id); out.push(p); } };
  /* 차기 직전 화면에서 확정한 순서가 있으면 그게 최우선 */
  try{ for(const id of (sd._pkOrder||[])) push(byId(id)); }catch(e){}
  try{
    const K=(sd.team&&(sd.team.kickers||(sd.team.tactic&&sd.team.tactic.kickers)))||null;
    if(K){ for(const id of (K.so||[])) push(byId(id));
           for(const id of (K.pk||[])) push(byId(id)); }
  }catch(e){}
  for(const p of live.slice().sort((x,y)=>pkSkillOf(y)-pkSkillOf(x))) push(p);
  return out;
}
function pkGkOf(sd){
  const on=(typeof onPitch==="function")?onPitch(sd):[];
  const g=on.map(x=>x.p).find(p=>p && p.pos==="GK");
  return g || (on[0]||{}).p || null;
}
/* 한 번의 킥 — 실축 성공률(약 75%)에 능력치를 얹는다 */
function pkKick(kicker, gk){
  const a=(kicker&&kicker.attr)||{}, g=(gk&&gk.gkA)||{}, ga=(gk&&gk.attr)||{};
  let p = 0.755
        + ((a.pen||60)-62)*0.0044
        + ((a.cmp||60)-62)*0.0022
        + ((a.tec||60)-62)*0.0010;
  p -= ((g.one||ga.pos||60)-62)*0.0015;
  p -= ((g.ref||60)-62)*0.0019;
  p = clamp(p, 0.48, 0.94);
  if(Math.random()<p) return {ok:true, how:"goal"};
  return {ok:false, how: Math.random()<0.60 ? "save" : "miss"};
}
/* ═══ 🥅 승부차기 직전 — 키커 순서를 마지막으로 확인한다 ═══════════════════
   전술판에서 미리 정해 둔 순서(kickers.so)를 그대로 들고 오되, 그 사이 교체·퇴장으로
   그라운드에 없는 선수는 빠져 있다. 차기 전에 한 번 더 손볼 수 있게 한다. */
let PK_PICK=null;
function pkNeedsPick(M){
  try{
    if(!M || !M.ko || M.pk || M.hg!==M.ag) return false;
    return !!(M.home.isUser || M.away.isUser);
  }catch(e){ return false; }
}
function pkPickOpen(M, done){
  const sd = M.home.isUser ? M.h : M.a;
  const live=pkOrderOf(sd);
  PK_PICK={M, sd, live, order:live.slice(0,5).map(p=>p.id), done};
  pkPickRender();
}
function pkPickMove(i, d){
  const K=PK_PICK; if(!K) return;
  const j=i+d; if(j<0 || j>=K.order.length) return;
  const o=K.order; [o[i], o[j]]=[o[j], o[i]];
  pkPickRender();
}
function pkPickSet(i, v){
  const K=PK_PICK; if(!K) return;
  const pid=parseInt(v,10)||0;
  if(pid) for(let j=0;j<K.order.length;j++) if(j!==i && K.order[j]===pid) K.order[j]=K.order[i];
  K.order[i]=pid;
  pkPickRender();
}
function pkPickRender(){
  const K=PK_PICK; if(!K) return;
  const box=$("#gcModal"); if(!box) return;
  box.className="";
  const nm=(pid)=>{ const p=K.live.find(x=>x.id===pid); return p?p:null; };
  const opt=(sel)=>K.live.map(p=>`<option value="${p.id}" ${sel===p.id?"selected":""}>${p.name} (PK ${attr20((p.attr||{}).pen||0)} · 침착 ${attr20((p.attr||{}).cmp||0)})</option>`).join("");
  const rows=K.order.map((pid,i)=>{
    const p=nm(pid);
    return `<div style="display:flex;align-items:center;gap:6px;margin:5px 0">
      <b style="width:34px;color:var(--gold)">${i+1}번</b>
      <select style="flex:1;min-width:0" onchange="pkPickSet(${i}, this.value)"><option value="">— 자동 —</option>${opt(pid)}</select>
      <button class="mini" style="padding:3px 8px" ${i===0?"disabled":""} onclick="pkPickMove(${i},-1)">▲</button>
      <button class="mini" style="padding:3px 8px" ${i===K.order.length-1?"disabled":""} onclick="pkPickMove(${i},1)">▼</button>
      ${p?`<span class="small" style="width:52px;text-align:right;color:var(--sub)">${Math.round(pkKickOdds(p, pkGkOf(K.M.home.isUser?K.M.a:K.M.h))*100)}%</span>`:`<span class="small" style="width:52px"></span>`}
    </div>`;
  }).join("");
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox">
    <div class="gcBody"><b style="font-size:17px">🥅 승부차기 — 키커 순서를 정하세요</b>

<span class="small">연장 120분에도 승부가 갈리지 않았습니다. 다섯 명의 순서를 확인하고 차러 나갑니다.
6번 이후와 서든데스는 남은 선수 중 능력치 순으로 이어집니다.</span>

${rows}
<span class="small" style="color:var(--sub)">오른쪽 숫자는 상대 골키퍼를 상대로 한 <b>예상 성공률</b>입니다.</span></div>
    <div class="gcBtns">
      <button class="gcBtn" onclick="pkPickAuto()">✨ 능력치순</button>
      <button class="gcBtn ok" onclick="pkPickGo()">차러 나간다 ▶</button>
    </div></div></div>`;
}
function pkPickAuto(){
  const K=PK_PICK; if(!K) return;
  K.order=K.live.slice().sort((a,b)=>pkSkillOf(b)-pkSkillOf(a)).slice(0,5).map(p=>p.id);
  pkPickRender();
}
function pkPickGo(){
  const K=PK_PICK; if(!K) return;
  PK_PICK=null;
  try{ const box=$("#gcModal"); if(box){ box.className="hidden"; box.innerHTML=""; } }catch(e){}
  /* 이번 경기에만 쓰는 순서 — 다음 경기를 위해 전술판에도 남겨 둔다 */
  try{ const kk=kickersOf(K.sd.team); kk.so=K.order.filter(Boolean).slice(0,5); }catch(e){}
  K.sd._pkOrder=K.order.filter(Boolean);
  try{ if(typeof K.done==="function") K.done(); }catch(e){}
}
/* 예상 성공률 — 화면에 보여 주는 값 (pkKick 과 같은 식) */
function pkKickOdds(kicker, gk){
  const a=(kicker&&kicker.attr)||{}, g=(gk&&gk.gkA)||{}, ga=(gk&&gk.attr)||{};
  let p = 0.755 + ((a.pen||60)-62)*0.0044 + ((a.cmp||60)-62)*0.0022 + ((a.tec||60)-62)*0.0010;
  p -= ((g.one||ga.pos||60)-62)*0.0015;
  p -= ((g.ref||60)-62)*0.0019;
  return clamp(p, 0.48, 0.94);
}
/* 승부차기 전체 — {h, a, win, kicks:[…]} */
function runShootout(M){
  const H=pkOrderOf(M.h), A=pkOrderOf(M.a);
  const gkH=pkGkOf(M.h), gkA=pkGkOf(M.a);
  if(!H.length || !A.length) return {h:M.hg>=M.ag?1:0, a:M.ag>M.hg?1:0, win:M.hg>=M.ag?"h":"a", kicks:[]};
  const res={h:0, a:0, kicks:[], win:null};
  const taken={h:0, a:0};
  const kickerAt=(list, i)=>list[i % list.length];
  const one=(side)=>{
    const isH=(side==="h");
    const k=kickerAt(isH?H:A, taken[side]);
    const r=pkKick(k, isH?gkA:gkH);
    taken[side]++;
    if(r.ok) res[side]++;
    res.kicks.push({side, name:k?k.name:"선수", pid:k?k.id:null, ok:r.ok, how:r.how, h:res.h, a:res.a, n:taken[side]});
  };
  /* 정규 5명 — 남은 킥으로 뒤집을 수 없게 되면 그 자리에서 끝난다 */
  const settled=()=>{
    const remH=Math.max(0, PK_ROUNDS-taken.h), remA=Math.max(0, PK_ROUNDS-taken.a);
    if(res.h > res.a + remA) return "h";
    if(res.a > res.h + remH) return "a";
    return null;
  };
  for(let n=0; n<PK_ROUNDS; n++){
    if(settled()) break;
    one("h");
    if(settled()) break;
    one("a");
  }
  let w=settled();
  /* 서든데스 — 한 라운드를 똑같이 차고 갈리면 끝 */
  let guard=0;
  while(!w && guard++<20){
    one("h"); one("a");
    if(res.h!==res.a) w = res.h>res.a ? "h" : "a";
  }
  res.win = w || (Math.random()<0.5?"h":"a");
  return res;
}
/* 승부차기 해설 줄 — 두 엔진이 같이 쓴다 */
function pkLines(M, S){
  const out=[];
  const RV=refVars(M);
  const _ah=(M.opts&&M.opts.aggH)||0, _aa=(M.opts&&M.opts.aggA)||0;
  out.push(fixJosa(F_(COMM.pkStart, RV))
    + ((_ah||_aa)?` <span class="small">(1·2차전 합계 ${M.hg+_ah} - ${M.ag+_aa})</span>`:""));
  /* 이 킥이 「넣으면 끝 / 놓치면 끝」인가 — 차기 전에 무게를 얹는다 */
  const clutch=(i)=>{
    const k=S.kicks[i]; if(!k || k.n<4) return false;
    const before={h:i?S.kicks[i-1].h:0, a:i?S.kicks[i-1].a:0};
    const me=k.side, foe=(me==="h"?"a":"h");
    const takenMe=k.n, takenFoe=S.kicks.slice(0,i).filter(x=>x.side===foe).length;
    const remMe=Math.max(0, PK_ROUNDS-takenMe), remFoe=Math.max(0, PK_ROUNDS-takenFoe);
    /* 넣으면 상대가 남은 킥으로 못 따라오거나, 놓치면 내가 못 따라잡는 상황 */
    return (before[me]+1 > before[foe]+remFoe) || (before[foe] > before[me]+remMe);
  };
  for(let i=0;i<S.kicks.length;i++){
    const k=S.kicks[i];
    const sd=(k.side==="h"?M.h:M.a), foeSd=(k.side==="h"?M.a:M.h);
    const tm=(k.side==="h"?M.home:M.away).short;
    const gk=pkGkOf(foeSd);
    const V=Object.assign({p:k.name, g:gk?gk.name:"골키퍼", t:tm}, RV);
    if(clutch(i) || k.n>PK_ROUNDS) out.push(fixJosa(F_(COMM.pkPressure, V)));
    const body = k.ok ? F_(COMM.pkGoal, V)
               : (k.how==="save" ? F_(COMM.pkSave, V) : F_(COMM.pkMiss, V));
    const tag = k.n>PK_ROUNDS ? `서든데스 ${k.n-PK_ROUNDS}번째` : `${k.n}번 키커`;
    out.push(fixJosa(body)+` <span class="small">[${tm} ${tag} · ${k.h} - ${k.a}]</span>`);
  }
  const wt=(S.win==="h"?M.home:M.away);
  const last=S.kicks.filter(k=>k.side===S.win&&k.ok).slice(-1)[0];
  out.push(fixJosa(F_(COMM.pkEnd, Object.assign({t:wt.short, p:last?last.name:"마지막 키커"}, RV)))
    + ` <b>${S.h} - ${S.a}</b>`);
  return out;
}
function createMatch(home, away, opts={}){
  ensureAIRoles(home); ensureAIRoles(away);   // 이적으로 새로 온 선수도 역할을 갖고 뛰게
  /* 🔁 임대 선수 친정팀 출전 금지 — 선발·벤치를 짜기 전에 걸어 둔다 */
  try{ loanBlockSet(home, away); }catch(e){}
  const _MP={};                                     // 플랜 기록용 임시 컨테이너
  try{ aiMatchPlan(_MP, home, away, true); aiMatchPlan(_MP, away, home, false); }catch(e){}
  /* 🌦️ 오늘 날씨 — 달(月)이 판을 깔고 그 위에서 주사위를 굴린다 (요청) */
  /* 같은 날 열리는 모든 경기는 같은 하늘 아래다 — 날짜가 날씨를 정한다 (요청) */
  const _wx = opts.wx ? opts.wx : dayWeather(G.day);
  const H=xiStrength(home), A=xiStrength(away);
  const mk=(xi)=>xi.map(p=>({p, fit:matchStartFit(p), y:0, red:false, goals:0, assists:0, on:0, off:null}));   /* ⚡ 잔여 피로 반영 (요청) */
  const M={home, away, opts, min:0, half:1, hg:0, ag:0, done:false, addedTotal:2+R(4), xiDirty:true,
    /* 🏆 녹아웃 — 90분 동점이면 연장·승부차기로 간다 (대회 8강 이후 · 승강 PO 2차전) */
    ko: !!(opts.ko || (opts.eacl && opts.eaclStage && opts.eaclStage!=="md")),
    etOn:false, pk:null,
    _planBase:_MP._planBase||null,
    h:{team:home, list:mk(H.xi), bench:matchBench(home), subs:0, red:0},
    a:{team:away, list:mk(A.xi), bench:matchBench(away), subs:0, red:0},
    st:{hS:0,aS:0,hT:0,aT:0,hF:0,aF:0,hC:0,aC:0,hY:0,aY:0,hR:0,aR:0},
    wx:_wx,                                        // 🌦️ 이 경기의 날씨
    needsSubPause:false, pauseReason:null, pauseEntryId:null,
    pendingQueue:{h:[],a:[]}, // VAR 판독처럼 실제로 시간이 걸리는 판정만 다음 분으로 미루는 대기열
    events:[]};
  /* 명단이 확정됐으니 표식은 지운다 — 스쿼드 화면 등 다른 곳까지 막으면 안 된다.
     M.h/M.a 의 list·bench 는 이미 배열로 복사돼 있어 영향을 받지 않는다. */
  try{ loanBlockClear(home, away); }catch(e){}
  try{ M.loanOutIds=[home,away].flatMap(t=>t.players.filter(p=>p.loan && p.loan.own===(t===home?away.id:home.id)).map(p=>p.id)); }catch(e){}
  // 오늘 이 경기장에 몇 명이 왔는가 — 홈 이점·입장 수입·기사·팬 반응이 모두 여기서 갈린다
  try{
    if(opts.friendly){
      M.att=Math.max(200, Math.round(stadOf(home).avg*(0.16+Math.random()*0.16)));
    } else {
      const rd = home.div===1?G.r1:G.r2;
      M.att=attendanceFor(home, away, {opener: rd===0 && !opts.noTable, po: !!opts.noTable});
    }
    M.aatt=awayAttFor(home, away, M.att);      // 그중 원정 팬
  }catch(e){ M.att=0; M.aatt=0; }
  ev(M, null, F_(COMM.ko,refVars(M)), "info", false, {kind:"kickoff"});
  /* 🌦️ 오늘 그라운드 상태 — 킥오프 직후 한 줄 (요청) */
  try{
    const w=M.wx;
    if(w && w.k!=="clear" && w.k!=="cloud"){
      const say={ rain:"🌧️ 비가 내립니다 — 그라운드가 젖어 공이 빠르게 흐릅니다.",
                  storm:"⛈️ 폭우입니다 — 공이 미끄러지고 발이 밀립니다. 정상적인 축구가 어려운 날씨입니다.",
                  snow:"🌨️ 눈이 내립니다 — 방향 전환이 어렵고 넘어지는 선수가 나올 겁니다.",
                  hot:"🔥 폭염 속 경기입니다 — 후반 체력이 승부를 가를 것 같습니다.",
                  cold:"❄️ 한파입니다 — 몸이 굳어 첫 발이 잘 안 나갑니다.",
                  windy:"🌬️ 강풍이 붑니다 — 롱볼과 크로스가 바람을 탑니다." }[w.k];
      if(say) ev(M, null, say, "info", false, {kind:"weather"});
    }
  }catch(e){}
  return M;
}
/* 전광판 표기 — 45+2 · 90+4 · 105+1 · 120+2 처럼 실제 중계와 같은 꼴로 */
function matchMinLabel(M, min){
  const a1=M.a1||0, a2=M.a2||0, a3=M.a3||0;
  if(min<=45) return (min===45&&M.half===2)?"45":min;
  if(min<=45+a1) return "45+"+(min-45);                       // 전반 추가시간
  const m2=min-a1;                                            // 후반부터는 전반 추가시간을 뺀 값이 실제 시계
  if(m2<=90) return m2;
  if(m2<=90+a2) return "90+"+(m2-90);                         // 후반 추가시간
  if(!M.etOn) return "90+"+(m2-90);
  const m3=m2-a2;                                             // 연장 시계
  if(m3<=105) return m3;
  if(m3<=105+a3) return "105+"+(m3-105);                      // 연장 전반 추가시간
  const m4=m3-a3;
  if(m4<=120) return m4;
  return "120+"+(m4-120);                                     // 연장 후반 추가시간
}
function dispMin(M){ return matchMinLabel(M, M.min); }
/* 🕐 ⚠ 제보 원문 — 「경기 중 실제 경기 시간과 해설 문구가 가리키는 경기 시간이 상이한
   버그가 있습니다. 바로잡아 주시면 감사하겠습니다」.
   원인 — M.min 은 전반 추가시간을 끊지 않고 이어 세는 「내부 카운터」다. 전광판과 문자중계는
     matchMinLabel/clockLabel 로 전반 추가시간(a1)을 빼고 찍는데, 득점자 명단·교체 해설·
     퇴장 명단·조언 패널 머리글처럼 M.min 을 그대로 찍는 자리가 남아 있었다.
     그래서 a1=3 인 경기의 후반은 그 자리들만 전광판보다 3분 앞서 있었다.
   ─ 기록해 둔 내부 분을 화면 시계 글자(45+2 · 90+3 꼴)로 옮기는 창구를 하나 둔다. */
function recMinTxt(M, raw){ try{ return matchMinLabel(M, Math.max(0, +raw||0)); }catch(e){ return raw; } }
/* 🕐 화면 시계를 「숫자」로 — 조언·판정처럼 분을 비교해야 하는 곳이 쓴다.
   ⚠ 제보 원문 — 「후반전 진행 시 수석코치의 조언이 전반전에 주어진 추가시간만큼 더 빨리
      진행이 되는 문제가 있습니다」. 정확한 지적이다. M.min 은 전반 추가시간까지 끊지 않고
      이어 세는 「내부 카운터」인데, 화면 시계(matchMinLabel)는 후반부터 전반 추가시간(a1)을
      빼고 찍는다. 그래서 a1=3 인 경기의 후반은 M.min 이 화면보다 늘 3 앞서 있었고,
      「55분 교체」 같은 문턱이 화면상 52분에 터졌다.
   ─ matchMinLabel 과 똑같은 뺄셈을 하되 문자열("45+2") 대신 수를 돌려준다. */
function dispMinNum(M){
  try{
    const a1=M.a1||0, a2=M.a2||0, a3=M.a3||0;
    let m=+M.min||0;
    if(m<=45+a1) return m;
    m-=a1;                                   // 후반 — 전반 추가시간을 뺀 실제 시계
    if(!M.etOn || m<=90+a2) return m;
    m-=a2;                                   // 연장
    if(m<=105+a3) return m;
    return m-a3;
  }catch(e){ return +((M&&M.min)||0); }
}
function ev(M, side, txt, type, noTime, scene){
  const t=side?side.team.short:"";
  // noTime(시간 배지 없이 "이어지는 줄"처럼 보이게 하는 연출)은 바로 앞 줄이 "같은 팀"의 이벤트일 때만 허용한다.
  // 그렇지 않으면(직전 줄이 다른 팀 이벤트) — 예: A팀 선수 슛 액션 줄 바로 다음에 B팀의 (한 템포 늦게 공개되는)
  // 슛 결과가 나오는 경우 — 시간 배지 없이 붙어 나와서 마치 A팀 슛이 B팀 결과로 이어진 것처럼 오해를 산다.
  // 이런 경우엔 강제로 시간 배지를 붙여 "다른 순간의 다른 팀 이야기"라는 걸 명확히 한다.
  const prev=M.events.length?M.events[M.events.length-1]:null;
  const effNoTime = !!noTime && (!prev || prev.t===t);
  // scene: 2D 매치엔진(바둑알 시각화)이 이 이벤트를 어떻게 애니메이션으로 재현할지 알려주는 메타데이터.
  // {kind, side:'h'|'a', ...관련 선수 id} 형태 — 없으면(scene:null) 2D 화면은 정지된 포메이션 위에 자막만 띄운다.
  // scene이 있을 때만 "지금 이 순간" 22명의 좌표 스냅샷(form)을 함께 저장해 둔다 — 실제 2D 화면에는
  // 이벤트가 한 템포(혹은 그 이상) 늦게 재생되므로, 재생 시점에 M을 다시 조회하면 그 사이 교체·퇴장 등으로
  // 선수가 그라운드에 없어져 애니메이션이 깨질 수 있다. 이벤트 발생 "그 순간"의 좌표를 박제해 두면 안전하다.
  const form = scene ? computeFormationPositions(M) : null;
  /* 🕐 이 줄이 공개될 때의 스코어와 통계 — 화면보다 먼저 올라가지 않게 한다.
     ⚠ 제보 — 「하이라이트는 이제 시작인데 아래 통계의 유효슛이 먼저 올라간다」.
        전광판(hg/ag)만 이 원칙을 지키고 있었고, 통계표는 시뮬의 현재값을 그대로 찍고 있었다. */
  const _s=M.st||{};
  try{ if(M.opts && M.opts.pvp && typeof pvpFwdEv==="function") setTimeout(()=>{ try{ pvpFwdEv(M); }catch(_){}} ,0); }catch(e){}
  M.events.push({min:matchMinLabel(M, M.min), t, txt, type:type||"txt", noTime:effNoTime, col:(side&&side.team)?side.team.col:null, scene:scene||null, form,
                 hg:M.hg, ag:M.ag,
                 st:{hS:_s.hS|0, aS:_s.aS|0, hT:_s.hT|0, aT:_s.aT|0, hF:_s.hF|0, aF:_s.aF|0,
                     hC:_s.hC|0, aC:_s.aC|0, hY:_s.hY|0, aY:_s.aY|0, hR:_s.hR|0, aR:_s.aR|0}});
}
function onPitch(sd){ return sd.list.filter(x=>x.off===null); }
function pickW(xs, w, team){ // 포지션(팀이 주어지면 실제 배치 라인 기준) 가중 추첨
  // 주의: `||1`을 쓰면 가중치를 의도적으로 0으로 지정한 경우(예: GK는 슛/PK 없음)에도 0이 falsy라
  // 기본값 1로 덮어써져 버린다 — 그 결과 골키퍼가 슈터·페널티 키커로 뽑히는 어색한 버그가 있었다.
  // 반드시 값이 "정의돼 있는지"만 확인하고, 정의 안 된 포지션만 기본값 1을 쓴다.
  const ws=xs.map(x=>{ const k=team?getZone(team,x.p):x.p.pos; return w[k]!==undefined ? w[k] : 1; });
  let tot=ws.reduce((a,b)=>a+b,0), r=Math.random()*tot;
  for(let i=0;i<xs.length;i++){ r-=ws[i]; if(r<=0) return xs[i]; }
  return xs[xs.length-1];
}
function pickWFn(xs, weightFn){ // 함수 기반 가중 추첨 — 슬롯 단위처럼 더 세밀한 가중치가 필요할 때 사용
  const ws=xs.map(weightFn); let tot=ws.reduce((a,b)=>a+b,0), r=Math.random()*tot;
  if(tot<=0) return xs[R(xs.length)]; // 전원 가중치 0인 극단적 상황 대비 안전장치
  for(let i=0;i<xs.length;i++){ r-=ws[i]; if(r<=0) return xs[i]; }
  return xs[xs.length-1];
}
function pickWAttr(xs, key){ // 세부 능력치 가중 추첨 (예: 패스 능력치가 높을수록 어시스트 확률 ↑)
  const ws=xs.map(x=>attrAvg(x.p,[key])+15); let tot=ws.reduce((a,b)=>a+b,0), r=Math.random()*tot;
  for(let i=0;i<xs.length;i++){ r-=ws[i]; if(r<=0) return xs[i]; }
  return xs[xs.length-1];
}
function attrAvg(p, keys, fallback){ // 세부 능력치 평균 (없으면 ovr로 대체)
  const fb = fallback!==undefined?fallback:p.ovr;
  if(!p.attr) return fb;
  let s=0;
  for(const k of keys){
    const v=p.attr[k];
    s += (typeof v==="number" && isFinite(v)) ? v : fb;   // 오타/미정의 키가 있어도 NaN으로 번지지 않게
  }
  return s/keys.length;
}
function squadAttrBonus(sd){ // 세부 능력치가 팀 전력에 주는 소폭 보정 (ovr 기반 기존 계산 위에 얹는 정도) — 실제 배치 라인(zone) 기준
  const xs=onPitch(sd);
  const atkers=xs.filter(x=>{const z=getZone(sd.team,x.p); return z==="FW"||z==="MF";});
  const defers=xs.filter(x=>getZone(sd.team,x.p)==="DF");
  const gk=xs.find(x=>x.p.pos==="GK");
  const avgAtk=atkers.length?atkers.reduce((s,x)=>s+attrAvg(x.p,["fin","dri","pace"]),0)/atkers.length:65;
  const avgDef=defers.length?defers.reduce((s,x)=>s+attrAvg(x.p,["mar","tck","pos_"]),0)/defers.length:65;
  const gkQ=gk?(gk.p.gk?(gk.p.gk.shot+gk.p.gk.cmd)/2:gk.p.ovr):65;
  return (avgAtk-67)*0.018 + (avgDef-67)*0.014 + (gkQ-67)*0.010;
}
/* 포메이션 형태(라인별 실제 배치 인원수)에 따른 공수 트레이드오프 — FM처럼 공격수를 늘리면 공격 기회는
   늘지만 뒷문이 얇아지고, 수비수를 늘리면 뒷문은 단단해지지만 공격 기회가 줄어든다.
   기준선: DF 4명 · FW 3명(4-4-2/4-3-3 등 표준형 인원 기준) — 그보다 많고 적음에 따라 선형으로 가감된다. */
function formationShapeBonus(sd, team){
  const xs=onPitch(sd);
  const df=xs.filter(x=>getZone(team,x.p)==="DF").length;
  const fw=xs.filter(x=>getZone(team,x.p)==="FW").length;
  const atk=(fw-3)*0.045-(df-4)*0.03; // FW 많을수록 공격 기회↑ · DF 많을수록(수비적으로 변할수록) 공격 기회↓
  const def=(df-4)*4.0;               // DF 많을수록 수비 견고+ · 적을수록 뒷공간 노출로 -(procMinute의 defSkill에 가산)
  return {atk, def};
}
function liveRates(M){
  const calc=(sd)=>{ const xs=onPitch(sd);
    let s=xs.reduce((sum,x)=>sum+x.p.ovr*(0.85+0.15*x.fit/100),0)/Math.max(xs.length,1);
    s+=(sd.team.morale-75)*0.04 + sd.team.form.slice(-5).filter(r=>r==="W").length*0.25;
    s+=(xs.reduce((a,x)=>a+(x.p.morale||70),0)/Math.max(xs.length,1) - 70)*0.05;
    s+=squadAttrBonus(sd); // 세부 능력치 보정
    s*=(1-0.075*sd.red);
    return s; };
  let hs=calc(M.h)+homeBoost(M), as=calc(M.a);
  const LH=lineAvgs(onPitch(M.h).map(x=>x.p), M.home), LA=lineAvgs(onPitch(M.a).map(x=>x.p), M.away);
  const tbH=tacticAtkBonus(M.home,M.away,LH,LA), tbA=tacticAtkBonus(M.away,M.home,LA,LH);
  const mH=M.home.tactic.mentality, mA=M.away.tactic.mentality;
  const shapeH=formationShapeBonus(M.h, M.home), shapeA=formationShapeBonus(M.a, M.away);
  /* ⚠ 상대 성향 보정이 `mA===2 ? 0.08 : mA===0 ? -0.10 : 0` 이었다. 전술 눈금이 3단계(0·1·2)이던
     시절의 잔재로, 그때는 2가 "가장 공격적"이었다. 5단계로 바뀐 뒤에도 그대로 남아
     상대가 공격적(3)이든 총공세(4)든 우리 공격에 아무 영향이 없었다.
     — 실측: 총공세를 써도 실점이 기본 전술과 똑같았다(1.54 vs 1.55).
     이제 눈금 그대로 비례한다. 앞으로 나올수록 뒤가 열린다. */
  const OPP_MENT=0.085;
  /* ⚠ 제보 — 2D 엔진과 결과 결이 너무 다르다. 실측: 전력차 3+ 인데 강팀 승률 36%(동전 던지기 이하),
     경기당 2.12골. 전력 계수를 두 배 가까이 세우고 볼륨을 소폭 올려 2D(강팀이 이기고, ~2.7골)와 맞춘다. */
  /* 홈 기본 우위는 0.20 → 0.10 으로. 나머지 홈 이점은 homeBoost(관중·점유율)가 맡는다 */
  const atkH=Math.max(0.15, 1.15+(hs-as)*0.085+(mH-1)*0.18+(mA-2)*OPP_MENT+tbH+shapeH.atk);
  const atkA=Math.max(0.15, 1.09+(as-hs)*0.085+(mA-1)*0.18+(mH-2)*OPP_MENT+tbA+shapeA.atk);
  M.rates={atkH, atkA, hs, as, defShapeH:shapeH.def, defShapeA:shapeA.def};
}
/* 다음 분으로 미뤄둔 판정(현재는 VAR 판독만)을 이번 분 시작 시점에 공개한다.
   슛·PK 결과는 2D 연출이 끊기지 않도록 같은 분에 즉시 처리하므로 여기로 오지 않는다. */
function resolvePending(M, key){
  const q=M.pendingQueue && M.pendingQueue[key];
  if(!q || !q.length) return;
  const fns=q.splice(0, q.length);
  for(const fn of fns) fn();
}
/* ═══ 몰수패 — 그라운드에 7명을 못 채우면 경기는 그 자리에서 끝난다 ═══
   IFAB 규정: 최소 7명. 결과는 0-3 몰수패로 기록하되, 상대가 이미 3골 차 이상
   앞서 있었다면 그 스코어를 그대로 인정한다(FIFA 관례). */
/* ═══ 경기 후 판정 여론 — 팬들은 스코어만큼 휘슬을 기억한다 ═══
   우리 팬은 우리가 손해 봤다고 느낄 때, 상대 팬은 자기들이 손해 봤다고 느낄 때 떠든다.
   기준은 카드 격차·퇴장·양 팀 합계 카드. 주심 이름이 함께 불려 나온다. */
function socialOnReferee(M){
  if(!M || !M.st || (M.opts&&M.opts.friendly)) return;
  const ut=userTeam(); if(!ut) return;
  const isHome=M.home.isUser;
  if(!isHome && !M.away.isUser) return;
  const st=M.st;
  const myY=isHome?st.hY:st.aY, myR=isHome?st.hR:st.aR;
  const opY=isHome?st.aY:st.hY, opR=isHome?st.aR:st.hR;
  const total=(st.hY||0)+(st.aY||0)+((st.hR||0)+(st.aR||0))*2;
  const griev=(myY-opY)+(myR-opR)*3;
  const opp=isHome?M.away:M.home;
  let crew=null; try{ crew=refCrewOf(M); }catch(e){}
  const V={t:ut.short, o:opp.short, r:crew?crew.main.n:"주심", n:myY+myR, m:opY+opR, c:total};
  const won=(isHome?M.hg>M.ag:M.ag>M.hg), lost=(isHome?M.hg<M.ag:M.ag<M.hg);
  /* ① 우리가 손해 봤다 — 카드 3장 차 이상이거나 우리만 퇴장 */
  if((griev>=3 || (myR>0&&opR===0)) ){
    socialFill(SOC.refRobbed, lost?4+R(3):2+R(2), -1, V);
    fmkFill(FMK.refTalk, 2+R(2), V);
    if(myR>0) socialFill(SOC.refRed, 2+R(2), -1, V);
  }
  /* ② 상대가 손해 봤다 — 상대 팬이 심판 탓, 우리 팬은 어깨를 으쓱 */
  else if(griev<=-3 || (opR>0&&myR===0)){
    rivalFill(RIV.refRobbed, 3+R(3), -1, V);
    if(won && Math.random()<0.6) socialFill(SOC.refSmug, 1+R(2), 0, V);
    if(opR>0) rivalFill(RIV.refRed, 2+R(2), -1, V);
  }
  /* ③ 카드가 쏟아진 경기 — 양쪽 다 한마디씩 */
  if(total>=7){
    socialFill(SOC.refCardFest, 2+R(2), 0, V);
    fmkFill(FMK.refCardFest, 2+R(2), V);
  }
}
function forfeitCheck(M){
  if(M.done || M.forfeit) return false;
  for(const [key, sd] of [["h",M.h],["a",M.a]]){
    if(onPitch(sd).length>=7) continue;
    const isH = key==="h";
    const oppLead = isH ? (M.ag-M.hg) : (M.hg-M.ag);
    if(oppLead<3){ if(isH){ M.hg=0; M.ag=3; } else { M.hg=3; M.ag=0; } }
    M.forfeit={side:key, team:sd.team.short};
    M.done=true;
    ev(M, null, `🚫 <b>몰수패!</b> ${sd.team.short}의 그라운드 인원이 7명 미만이 되어 주심이 경기를 중단합니다. — 최종 ${M.home.short} ${M.hg} : ${M.ag} ${M.away.short}`, "big", false, {kind:"ft"});
    try{ addNews(`🚫 <b>${sd.team.name}, 몰수패</b> — 퇴장 누적으로 경기 인원(7명)을 채우지 못해 경기가 중단됐습니다. (${M.home.short} ${M.hg}-${M.ag} ${M.away.short})`, "warn", "club"); }catch(e){}
    if(sd.team.isUser){
      try{ adjustTrust("owner", -10, "몰수패"); adjustTrust("fans", -8, "몰수패"); }catch(e){}
      try{ socialFill(SOC.loseBig, 4+R(3), -1, {t:sd.team.short, o:(isH?M.away:M.home).short, s:3}); }catch(e){}
    }
    return true;
  }
  return false;
}
/* 이 경기 심판진의 이름 변수 — 해설 문구에 {r}(주심)·{v}(VAR) 로 꽂힌다 */
/* ⏱️ 이 구간에 시간을 잡아먹은 사건이 몇 번 있었나 (분 단위 엔진용) */
function mSnapNow(M){
  const st=M.st||{};
  return {g:(M.hg||0)+(M.ag||0), s:(M.h.subs||0)+(M.a.subs||0),
          y:(st.hY||0)+(st.aY||0), r:(st.hR||0)+(st.aR||0)};
}
function mSnapTake(M){ M._snap=mSnapNow(M); }
function mSnapDiff(M){
  const a=M._snap||{g:0,s:0,y:0,r:0}, b=mSnapNow(M);
  return {goal:Math.max(0,b.g-a.g), sub:Math.max(0,b.s-a.s),
          yellow:Math.max(0,b.y-a.y), red:Math.max(0,b.r-a.r), inj:0, pen:0};
}
/* 🏆 아직 승부가 안 갈렸는가 — 홈앤어웨이면 합산으로 본다 */
function koLevel(M){
  const ah=(M.opts&&M.opts.aggH)||0, aa=(M.opts&&M.opts.aggA)||0;
  return (M.hg+ah)===(M.ag+aa);
}
function refVars(M){
  try{ const c=refCrewOf(M); return {r:c.main.n, v:c.var_.n, rt:(c.main.t||{}).n||""}; }
  catch(e){ return {r:"주심", v:"VAR", rt:""}; }
}
function stepMinute(M){
  if(M.done) return;
  if(forfeitCheck(M)) return;
  const _g0=(M.hg||0)+(M.ag||0), _sc0={h:M.hg, a:M.ag};
  M.min++;
  M.minTxt=matchMinLabel(M, M.min);
  // 체력 소모
  for(const sd of [M.h,M.a]){ const cf=condFactor(sd.team);
    for(const x of onPitch(sd)){
      /* 타고난 체력(nat)·지구력(sta)이 좋으면 같은 90분을 뛰어도 덜 지친다.
         ⚠ 제보 — 「컨디션에 지구력과 타고난 체력이 반영되는지 확인해 달라」.
           확인해 보니 실시간 2D 엔진에는 지구력이 들어 있는데 분 단위 엔진에는 빠져 있었다.
           같은 선수가 내가 직접 지휘하면 지구력이 반영되고, 위임하면 반영되지 않았다.
           두 엔진이 같은 식을 쓰도록 맞춘다. */
      /* ⚠ 두 엔진이 갈라져 있었다 — 2D 엔진만 완화하면 AI 끼리의 경기(분 단위)는 예전 속도로
         깎여 리그 전체 체력이 어긋난다. 식·계수·하한을 2D 와 똑같이 맞춘다.
         (0.34 → 0.285 · 흔들림 0.14 → 0.10 · 지구력이 주역) */
      const nf = x.p.attr ? clamp(1.24 - (attr20(x.p.attr.sta)-10)*0.026 - (attr20(x.p.attr.nat)-10)*0.012, 0.66, 1.26) : 1;
      const gkf = (x.p.pos==="GK" || x.slot==="GK") ? GK_STAM_K : 1;   // 🧤 골키퍼는 훨씬 덜 지친다
      x.fit=Math.max(20, x.fit-(0.285*cf+Math.random()*0.10)*nf*ageWearK(x.p)*gkf);   // 노장은 후반에 더 빨리 지친다
    } }
  if(M.xiDirty || M.min%7===0){ liveRates(M); M.xiDirty=false; }
  // 팀별로 "지난 분에 예고했던 결과 공개 → 이번 분 새 시도"를 한 묶음으로 처리한다 —
  // 예전에는 양 팀의 결과 공개를 먼저 몰아서 처리하고 그다음 양 팀의 새 액션을 몰아서 처리했는데,
  // 그러면 "A팀 액션(이번 분 마지막 줄)" 바로 다음 줄이 "B팀 결과(다음 분 첫 줄)"가 되어버려서
  // 마치 A팀 선수가 슛했는데 B팀 선수가 골을 넣은 것처럼 보이는 문자중계 오작동이 있었다.
  // 팀별로 묶어서 처리하면 그 팀 자신의 "결과"가 항상 그 팀 자신의 "다음 액션" 바로 앞에 붙어서 나오므로
  // 상대팀 이벤트가 중간에 끼어들 일이 없다.
  resolvePending(M,"h"); procMinute(M, M.h, M.a, M.rates.atkH, "h");
  resolvePending(M,"a"); procMinute(M, M.a, M.h, M.rates.atkA, "a");
  /* ⚡ 연장에서 터진 골 — 그냥 골이 아니다 */
  if(M.etOn && ((M.hg||0)+(M.ag||0))>_g0){
    const side=(M.hg>_sc0.h)?M.h:M.a;
    let nm="선수"; try{ const sc=(M.sc||[]).slice(-1)[0]; if(sc&&sc.name) nm=sc.name; }catch(e){}
    ev(M,null,F_(COMM.etGoal,Object.assign({p:nm, t:side.team.short},refVars(M))),"goal",false,{kind:"et"});
  }
  aiSubs(M);
  /* ⏱️ 추가시간 — 그 45분 동안 공이 죽어 있던 만큼 되돌려 준다 */
  if(M.min===45 && M.a1==null){
    M.a1=Math.max(1, Math.round(addTimeCalc(mSnapDiff(M),1)/60));
    mSnapTake(M);
    ev(M,null,F_(COMM.addH1,Object.assign({m:M.a1},refVars(M))),"info",false,{kind:"add"});
  }
  if(M.half===1 && M.a1!=null && M.min>=45+M.a1){
    M.half=2;
    ev(M,null,F_(COMM.ht,refVars(M))+` (${M.home.short} ${M.hg} - ${M.ag} ${M.away.short}) <span class="small">${addLabel(45,M.a1*60)}</span>`,"info",false,{kind:"ht"});
    M.htBreak=true;
  }
  if(M.half===2 && M.a1!=null && M.a2==null && M.min>=90+M.a1){
    M.a2=Math.max(1, Math.round(addTimeCalc(mSnapDiff(M),2)/60));
    mSnapTake(M);
    M.addedTotal=M.a1+M.a2;
    ev(M,null,F_(COMM.addH2,Object.assign({m:M.a2},refVars(M))),"info",false,{kind:"add"});
  }
  /* ⏱️ 연장전 — 녹아웃 경기가 90분에 동점이면 15분씩 두 번 더 뛴다 */
  if(M.ko && !M.etOn && koLevel(M) && M.a2!=null && M.min>=90+M.addedTotal){
    M.etOn=true;
    M.a3=Math.max(1, Math.round(addTimeCalc(mSnapDiff(M),3)/60));
    mSnapTake(M);
    M.addedTotal=(M.addedTotal||0)+30+M.a3;
    ev(M,null,F_(COMM.etIn,refVars(M))+` <span class="small">(${addLabel(90,(M.a2||1)*60)} · ${M.hg}:${M.ag} · 연장 전반 추가 ${M.a3}분)</span>`,"info",false,{kind:"et"});
  }
  if(M.etOn && M.a4==null && M.a3!=null && M.min>=105+M.a1+M.a2+M.a3){
    M.a4=Math.max(1, Math.round(addTimeCalc(mSnapDiff(M),4)/60));
    mSnapTake(M);
    M.addedTotal=(M.addedTotal||0)+M.a4;
    ev(M,null,F_(COMM.etHt,refVars(M))+` <span class="small">${M.home.short} ${M.hg} : ${M.ag} ${M.away.short} · 연장 후반 추가 ${M.a4}분</span>`,"info",false,{kind:"et"});
    if(Math.random()<0.6) ev(M,null,F_(COMM.etTired,refVars(M)),"info",false,{kind:"et"});
  }
  if(M.a2!=null && M.min>=90+M.addedTotal){
    resolvePending(M,"h"); resolvePending(M,"a"); // 경기 종료 직전 마지막 슛/PK 결과까지 마무리하고 끝낸다
    M.done=true;
    ev(M,null,F_(COMM.ft,refVars(M))+` ${M.home.short} ${M.hg} - ${M.ag} ${M.away.short}`,"info",false,{kind:"ft"});
    /* 🥅 그래도 갈리지 않으면 승부차기 */
    if(M.ko && koLevel(M)){
      try{
        M.pk=runShootout(M);
        for(const line of pkLines(M, M.pk)) ev(M,null,line,"info",false,{kind:"pk"});
      }catch(e){ M.pk=null; }
    }
  }
}
function procMinute(M, me, opp, atk, key){
  const xs=onPitch(me); if(!xs.length) return;
  const st=M.st;
  // ── 공격 시도
  const pAtt=clamp(0.115+(atk-1.05)*0.05, 0.05, 0.28);
  if(Math.random()<pAtt){
    st[key+"S"]++;
    // 세부 슬롯 기준 슈팅 관여도 — 스트라이커 최다, 측면 공격수·중앙 미드필더 중간, 측면 미드필더·풀백 드묾,
    // 센터백은 아주 가끔(세트피스), 골키퍼는 항상 0. 공격수를 수비로 내리면 슈팅 관여도↓
    const shooter=pickWFn(xs, x=>shotWeight(me.team, x.p));
    // 개인 세부 능력치 반영: 슈터의 골결정력·침착성·중거리·헤더 vs 상대 수비·GK
    const shotSkill=attrAvg(shooter.p,["fin","cmp","lng","hea"]);
    const oppDefs=onPitch(opp).filter(x=>getZone(opp.team,x.p)==="DF"); // 실제 배치 라인 기준 — 완전수비로 내리면 수비 두께↑
    // 평균 능력치 + 포메이션 형태 보너스: 공격수를 수비로 내려도 평균 수비 능력치는 다소 떨어질 수 있지만,
    // 몸싸움·공간 압축 자체가 슈팅을 방해하므로 표준(4명) 대비 인원 많고 적음에 따라 수비 견고함이 가감된다
    // (formationShapeBonus, liveRates에서 매 갱신 시 계산 — DF 많으면 +, 적으면 -로 대칭 적용).
    const defShapeBonus = M.rates ? (key==="h" ? M.rates.defShapeA : M.rates.defShapeH) : 0;
    const defSkill=(oppDefs.length?oppDefs.reduce((s,x)=>s+attrAvg(x.p,["mar","tck","pos_"]),0)/oppDefs.length:65) + defShapeBonus;
    const oppGK=onPitch(opp).find(x=>x.p.pos==="GK");
    const gkShot=oppGK?(oppGK.p.gk?oppGK.p.gk.shot:oppGK.p.ovr):65;
    const fitFactor=0.85+0.15*shooter.fit/100; // 체력
    const skillFactor=clamp(1+((shotSkill-defSkill)*0.007),0.75,1.3)*fitFactor;
    const gkFactor=clamp(1-(gkShot-70)*0.005,0.78,1.2);
    const gp=clamp(atk/93/pAtt*skillFactor*gkFactor, 0.02, 0.4);
    const saveBand=clamp(0.30+(gkShot-70)*0.0025,0.18,0.4); // 골키퍼 선방 능력이 높을수록 선방 비중 ↑
    const r=Math.random();
    // 결과를 바로 알려주지 않고 "{p}의 슛!"만 먼저 보여준 뒤, 결과(골/선방/빗맞음)는 다음 분에 공개한다 —
    // 문자중계에 텀을 둬서 긴장감을 준다. 원래 문구가 없던 케이스(조용한 코너 등)는 그대로 무음 처리.
    let resultFn=null;
    if(r<gp){
      st[key+"T"]++; // 골이 되는 슈팅도 당연히 유효슛(온타깃)이므로 기존에 빠져 있던 카운트를 보정
      // 아주 가끔 슈터의 슛이 상대 수비수 몸에 맞고 굴절되며 자책골이 되는 경우 — 수비수의 침착성·마킹이
      // 낮을수록(당황할수록), 그리고 상대 수비 자체가 흔들리고 있을수록(defSkill<shotSkill) 조금 더 위험해진다.
      const ogChance = clamp(0.035 + Math.max(0, shotSkill-defSkill)*0.0008, 0.02, 0.08);
      if(oppDefs.length && Math.random()<ogChance){
        const unlucky=pickWFn(oppDefs, x=>Math.max(0.4, 78-attrAvg(x.p,["cmp","mar"],72)));
        resultFn=()=>scoreGoal(M, me, key, shooter, false, true, unlucky);
      } else {
        resultFn=()=>scoreGoal(M, me, key, shooter, false);
      }
    }
    else if(r<gp+saveBand){
      st[key+"T"]++;
      // 골키퍼의 커맨딩(cmd) vs 반사신경(shot) 중 어느 쪽이 더 뛰어난지에 따라 선방 문구 스타일을 다르게 골라
      // 같은 "막았다"도 매번 다른 느낌으로 읽히게 한다.
      const gkAttr=oppGK && oppGK.p.gk;
      const pool = !gkAttr ? COMM.save : (gkAttr.cmd>=gkAttr.shot ? COMM.saveCommand : COMM.saveReflex);
      const gkName = oppGK ? oppGK.p.name : "상대 수문장";
      resultFn=()=>{ ev(M,me,F_(pool,{p:shooter.p.name, g:gkName}),"txt",true,{kind:"shot_save",atkSide:key,shooterId:shooter.p.id,gkId:oppGK?oppGK.p.id:null}); };
    }
    else {
      // 수비가 탄탄할수록(defSkill이 슈터의 shotSkill보다 높을수록) 그냥 빗나가기보다 몸에 맞고 코너로
      // 흘러나가는 "막힌 슛"의 비중이 커진다 — 수비 개인 능력치가 실제로 결과에 드러나도록 한다.
      const blockProb=clamp(0.30+(defSkill-shotSkill)*0.004, 0.15, 0.5);
      if(Math.random()<blockProb){
        st[key+"C"]++;
        if(oppDefs.length && Math.random()<0.5){
          const blocker=pickWAttr(oppDefs,"tck");
          resultFn=()=>{ ev(M, opp, F_(COMM.block,{p:blocker.p.name}), "txt", true,{kind:"shot_block",atkSide:key,shooterId:shooter.p.id,blockerId:blocker.p.id}); };
        } else if(Math.random()<0.5){
          resultFn=()=>{ ev(M,me,F_(COMM.corner,{t:me.team.short}),"txt",true,{kind:"shot_corner",atkSide:key,shooterId:shooter.p.id}); };
        }
      }
      else if(Math.random()<0.55){ resultFn=()=>{ ev(M,me,F_(COMM.miss,{p:shooter.p.name}),"txt",true,{kind:"shot_miss",atkSide:key,shooterId:shooter.p.id}); }; }
    }
    if(resultFn){
      // 슛 예고와 결과는 반드시 같은 분에 연속으로 나와야 한다 — 2D 화면에서 슈터가 공을 때린 직후
      // 그 공이 골망/키퍼/골대밖으로 이어져야 하므로, 결과를 다음 분으로 미루면 때린 공이 공중에
      // 멈춘 채 경기 시간만 흐르는 것처럼 보인다. (문자중계 시절의 "한 템포 늦추기"는 제거)
      ev(M,me,F_(COMM.shotOn,{p:shooter.p.name}),"txt",false,{kind:"shot_action",atkSide:key,shooterId:shooter.p.id});
      resultFn();
    }
  }
  // ── 파울 (압박 강도 + 수비 강도만큼 증가)
  const T=TAC(me.team);
  if(Math.random()<(0.10+(T.press-1)*0.022+(T.tackle-1)*0.028)*meTune("foul")){
    st[key+"F"]++;
    const fouler=pickW(xs,{DF:3,MF:2,FW:1,GK:0.2}, me.team);
    const r=Math.random();
    // 수비 강도: 거칠게(2) 지시할수록 다이렉트 퇴장·경고 위험 구간이 넓어지고, 신중하게(0)는 좁아진다.
    // 다혈질(pers===3) 선수는 거친 태클 지시 하에서 특히 다이렉트 퇴장 위험이 크게 뛴다.
    const hotHead = fouler.p.pers===3 ? (HI(T.tackle)?0.035:MID(T.tackle)?0.012:0.004) : 0;
    let redWidth = (clamp(0.0025+(T.tackle-1)*0.006, 0.0006, 0.0085) + hotHead)*meTune("card");
    let yellowWidth = clamp(0.255+(T.tackle-1)*0.07, 0.15, 0.34)*meTune("card");   /* ⚖️ 압박 간격이 넓어져 경고 2.87(실축 4) — 파울당 경고율을 올린다 */
    let penW = 0.032;
    const penEnd=penW, redEnd=penEnd+redWidth, yellowEnd=redEnd+yellowWidth;
    if(r<penEnd && onPitch(opp).length){ // 페널티 헌납
      const ox=onPitch(opp);
      let taker=null;
      try{ const K=opp.team.tactic && opp.team.tactic.kickers;
        if(K && Array.isArray(K.pk)) for(const pid of K.pk){ const x=ox.find(z=>z.p.id===pid); if(x){ taker=x; break; } } }catch(e){}
      if(!taker) taker=pickW(ox,{FW:8,MF:2,DF:0.3,GK:0}, opp.team);
      const oppKey=key==="h"?"a":"h";
      ev(M,opp,F_(COMM.pen,{p:taker.p.name}),"big",false,{kind:"pen_action",atkSide:oppKey,shooterId:taker.p.id});
      st[oppKey+"S"]++; st[oppKey+"T"]++;
      const penOk=clamp(0.62+(attrAvg(taker.p,["cmp"])-70)*0.007,0.45,0.93); // 침착성이 페널티 성공률 좌우
      const penOkResult=Math.random()<penOk;
      const meGK=onPitch(me).find(x=>x.p.pos==="GK"); // PK를 막아설 골키퍼는 반칙을 저지른 팀(me) 소속
      const meGKName=meGK?meGK.p.name:"상대 수문장";
      // PK 선언 → 키커가 걸어와 공을 놓고 → 슛까지가 하나의 연속 장면이므로 결과도 같은 분에 이어서 낸다
      if(penOkResult) scoreGoal(M, opp, oppKey, taker, true);
      else ev(M,opp,F_(COMM.penMiss,Object.assign({p:taker.p.name, g:meGKName},refVars(M))),"big",true,{kind:"pen_miss",atkSide:oppKey,shooterId:taker.p.id,gkId:meGK?meGK.p.id:null});
    }
    else if(r<redEnd){ sendOff(M, me, key, fouler, false); }         // 다이렉트 퇴장 (수비 강도·성격에 따라 위험도 변동)
    else if(r<yellowEnd){ // 경고
      // 이미 경고 있는 선수는 심판이 다소 관대 (연속 퇴장 방지)
      if(fouler.y>=1 && Math.random()<0.45){ ev(M,me,F_(COMM.foul,Object.assign({p:fouler.p.name},refVars(M))),"txt",false,{kind:"foul",atkSide:key,playerId:fouler.p.id}); }
      else {
        fouler.y++;
        if(fouler.y>=2){ sendOff(M, me, key, fouler, true); }
        else { st[key+"Y"]++; ev(M,me,F_(COMM.yellow,Object.assign({p:fouler.p.name},refVars(M))),"card",false,{kind:"card_yellow",atkSide:key,playerId:fouler.p.id}); }
      }
    }
    else if(Math.random()<0.35){ ev(M,me,F_(COMM.foul,Object.assign({p:fouler.p.name},refVars(M))),"txt",false,{kind:"foul",atkSide:key,playerId:fouler.p.id}); }
  }
  // ── 부상 (체력이 떨어질수록 위험이 자연스럽게 커진다 — FM처럼 피로 누적이 부상으로 이어짐)
  for(const x of xs){
    let injRisk=0.0001; // 체력 85 이상(팔팔한 상태) 기준 분당 개인 부상 확률
    if(x.fit<85){ const fatigue=85-x.fit; injRisk *= 1+Math.pow(fatigue/20,1.6); } // 완만하다가 저질 체력에서 급격히 상승
    if(x.fit<72){ injRisk *= 1+Math.pow((72-x.fit)/20, 1.7); }                     // 72 밑은 교체를 고민할 구간 — 위험이 가파르다
    injRisk *= 1+(T.tackle-1)*0.15; // 거친 몸싸움을 시키면 본인 부상 위험도 소폭 증가
    /* ⚠ 제보 — 나이 보정이 2D 엔진에만 있었다. 두 엔진의 기조를 맞춘다. */
    { const _a=G.season-x.p.by; injRisk *= 0.75+clamp((_a-24)/16,0,1)*0.7; }
    /* 🐛 2D 엔진에만 걸려 있던 처치 위험 배수(💊 진통제·⚡ 집중 재활·🏥 수술)를 여기도 건다.
       빠져 있으면 문자 중계로 치른 경기에서는 소견서가 약속한 「재발 위험」이 존재하지 않는다. */
    try{ injRisk *= injTreatRiskMul(x.p); }catch(e){}
    if(Math.random()<injRisk){
      freezeLiveSlots(me);             // ⚠ 아직 11명일 때 굳혀야 남은 선수들이 옆으로 밀리지 않는다
      /* 🚑 배선 — 분 단위 엔진도 같은 창구를 지난다 (요청). 체력이 바닥이면 누적 피로 쪽으로. */
      try{ mkInjury(x.p, {cause: (x.fit<70?"overuse":(Math.random()<0.5?"sprint":"solo")),
                          fit:x.fit, age:G.season-(x.p.by||2000)}); }
      catch(e){ try{ setInjury(x.p, 1+R(4)); }catch(e2){ x.p.inj=1+R(4); } }
      x.injGap=true;                   // 부상으로 비운 자리 — 채우기 전까지 교체 후보로 계속 남는다
      ev(M,me,F_(COMM.inj,{p:x.p.name})+` — ${(function(){ try{ return injPhrase(x.p, true); }catch(e){ return `전치 ${x.p.inj}주`; } })()}`,"bad",false,{kind:"injury",atkSide:key,playerId:x.p.id});
      x.off=M.min; M.xiDirty=true;
      if(me.team.isUser){ M.needsSubPause=true; M.pauseEntryId=x.p.id; M.pauseReason=`🚑 <b>${x.p.name}</b> 선수가 부상으로 그라운드를 떠났습니다. 교체 여부를 결정하세요.`; }
      else autoSubFor(M, me, key, x); // AI 팀은 교체 가능하면 자동 투입
      break; // 한 분(minute)에 한 명만
    }
  }
}
/* 골이 만들어지는 순간을 실제로 스코어보드·개인기록에 반영하는 부분 — VAR 판독을 통과했거나(혹은 애초에
   판독 대상이 아니었거나) 확정된 골에 한해 호출된다. isOG(자책골)면 골은 공격팀(me) 쪽 스코어에 더해지지만,
   실제로 공을 넣은 선수(ogScorer, 상대팀 수비수)의 개인 득점 기록에는 반영하지 않고 별도로 자책골만 남긴다. */
function finalizeGoal(M, me, key, shooter, isPen, isOG, ogScorer, prefix){
  /* 득점자 명단 — VAR 취소는 여기 오지 않으므로 실제 골만 기록된다 */
  if(!Array.isArray(M.sc)) M.sc=[];
  M.sc.push({n:isOG?(ogScorer&&ogScorer.p?ogScorer.p.name:"?"):(shooter&&shooter.p?shooter.p.name:"?"),
             /* 🕐 제보 — 전광판과 같은 시계로 남긴다 (45+2 · 90+3) */
             side:key, min:recMinTxt(M, M.min||0), og:isOG?1:0, pen:isPen?1:0});
  if(key==="h") M.hg++; else M.ag++;
  let txt;
  if(isOG){
    ogScorer.p.ownGoals=(ogScorer.p.ownGoals||0)+1;
    txt=F_(COMM.ownGoal,{p:ogScorer.p.name});
  } else {
    shooter.goals++; shooter.p.goals++;
    if(isPen) txt=F_(COMM.penGoal,{p:shooter.p.name});
    else if(Math.random()<0.62){
      const others=onPitch(me).filter(x=>x!==shooter&&x.p.pos!=="GK");
      const ax=others.length?pickWAttr(others,"pass"):null; // 패스 능력치가 높은 선수가 어시스트할 확률 ↑
      if(ax){ ax.assists++; ax.p.assists++; txt=F_(COMM.goalA,{p:shooter.p.name,a:ax.p.name}); }
      else txt=F_(COMM.goal,{p:shooter.p.name});
    } else txt=F_(COMM.goal,{p:shooter.p.name});
  }
  const goalKind = isOG?"shot_owngoal":(isPen?"pen_goal":"shot_goal");
  ev(M, me, (prefix||"")+txt+` <b>[${M.home.short} ${M.hg} - ${M.ag} ${M.away.short}]</b>`, "goal", true,
    {kind:goalKind, atkSide:key, shooterId:shooter?shooter.p.id:null, ogScorerId:isOG?ogScorer.p.id:null});
  // 실점 직후 흥분한 선수의 항의성 카드 — 태클 파울과는 별개의, 감정적 대응으로 인한 퇴장/경고
  const concKey=key==="h"?"a":"h", concSd=key==="h"?M.a:M.h;
  maybeDissentCard(M, concSd, concKey);
}
/* 정규 필드골(자책골 제외)에 한해 드물게 VAR 판독이 걸린다 — 골 셀레브레이션 직후 "확인 중" 문구가 먼저 나오고,
   한 템포 뒤(다음 분) 인정/취소 여부가 공개된다(기존 슛-결과 서스펜스 큐를 그대로 재사용). */
function scoreGoal(M, me, key, shooter, isPen, isOG, ogScorer){
  if(!isPen && !isOG && Math.random()<0.07){
    ev(M, me, F_(COMM.varCheck,Object.assign({p:shooter.p.name},refVars(M))), "info", true, {kind:"var_check", atkSide:key, shooterId:shooter.p.id});
    /* 사유는 지금 정해 둔다 — 결과가 나올 때 동전을 던지면 장면과 문구가 어긋난다 */
    const varReason = Math.random()<0.5 ? "off" : "foul";
    M.pendingQueue[key].push(()=>{
      if(Math.random()<0.6){ finalizeGoal(M, me, key, shooter, isPen, false, null, "📺 VAR 확인 결과 — 골 인정! "); }
      else { ev(M, me, F_(varReason==="off"?COMM.varOverturnOffside:COMM.varOverturnFoul,{p:shooter.p.name}), "bad", true, {kind:"var_overturn", atkSide:key, shooterId:shooter.p.id}); }
    });
    return;
  }
  finalizeGoal(M, me, key, shooter, isPen, isOG, ogScorer, "");
}
/* 실점 직후 흥분한 선수의 항의 — 태클성 파울이 아니라 감정적 대응(거친 항의·소란)으로 인한 카드.
   다혈질(pers===3) 선수일수록, 이미 경고가 있을수록 위험이 커진다. */
function maybeDissentCard(M, concedingSd, concedingKey){
  const xs=onPitch(concedingSd).filter(x=>!x.red);
  const candidate=xs.find(x=>x.p.pers===3);
  if(!candidate) return;
  const already=candidate.y>=1;
  const chance = already ? 0.09 : 0.045;
  if(Math.random()>=chance) return;
  if(already){
    candidate.y++;
    sendOffDissent(M, concedingSd, concedingKey, candidate, true);
  } else if(Math.random()<0.25){
    sendOffDissent(M, concedingSd, concedingKey, candidate, false);
  } else {
    candidate.y++;
    M.st[concedingKey+"Y"]++;
    ev(M, concedingSd, F_(COMM.dissentYellow,Object.assign({p:candidate.p.name},refVars(M))), "card", false, {kind:"card_yellow", atkSide:concedingKey, playerId:candidate.p.id});
  }
}
/* 퇴장 징계 — K리그 규정에 맞춘다.
     경고 누적 퇴장은 다음 1경기, 다이렉트 퇴장은 2경기(사안이 나쁘면 3경기). */
function banMatches(second){ return second ? 1 : (2 + (Math.random()<0.3?1:0)); }
/* 🟥 ⚠ 제보 — 「리그에서 퇴장당한 선수가 EACL 경기에 못 나온다. 친선/리그/대회를 더 엄격히 나눠 달라」.
   퇴장 처리가 대회 종류를 보지 않고 무조건 p.ban(리그 장부)에 적고 있었다.
   대회 경기는 경기 전 eaclBanPush 로 장부를 갈아 끼워 두므로 결과적으로는 맞았지만,
   그 갈아끼우기가 어긋나는 순간(중간 저장·대행 처리·AI 경로) 리그 징계가 대회로 새어 나갔다.
   ─ 어느 장부에 적을지 「경기 자체」가 정하게 한다. 연습경기는 애초에 공식 징계가 아니다.
       · 연습경기  — 그 경기에서만 열 명. 징계는 남지 않는다
       · 대회(EACL) — banE (대회 경기에만 적용)
       · 리그·PO   — ban  (리그 경기에만 적용)                                       */
function banApply(M, p, second){
  if(!p) return;
  const o=(M&&M.opts)||{};
  if(o.friendly) return;                                   // 연습경기 퇴장 — 기록에 남지 않는다
  if(o.pvp) return;                                        // ⚔️ 온라인 대전 — 클론 팀 친선, 징계 없음
  const n=banMatches(second);
  /* ⚠ 제보 — 「리그 1R 퇴장 정지 선수가 EACL 1차전에도 정지 상태였다. 대회별 징계 구분을
     엄격히 점검해 달라」. 추적 결과 리그↔EACL 장부 교체(push/pop)는 정상이었고 진짜 구멍은
     CWC였다: CWC 경기도 eacl:true 로 돌아서, 여기서 CWC 퇴장을 EACL 장부(banE)에 적었다 —
     CWC 정지는 안 걸리고, 3월 EACL 1차전에 「유령 정지」가 튀어나왔다.
     ─ 대회를 정확히 가른다: CWC → banC · EACL → banE · 리그/PO → ban.
       장부가 갈아 끼워진 상태(_banLC/_banL)면 지금 ban 자리가 곧 그 대회의 장부다. */
  if(o.cwc){
    if(p._banLC!=null){ p.ban=Math.max(p.ban||0, n); p.banNew=1; }
    else { p.banC=Math.max(p.banC||0, n); p.banCNew=1; }
    return;
  }
  if(o.eacl){
    if(p._banL!=null){ p.ban=Math.max(p.ban||0, n); p.banNew=1; }
    else { p.banE=Math.max(p.banE||0, n); p.banENew=1; }
    return;
  }
  p.ban=Math.max(p.ban||0, n); p.banNew=1;                 // 리그·PO — 리그 장부에 적는다
}
function sendOffDissent(M, sd, key, x, second){
  // ev()는 퇴장 선수가 아직 "그라운드 위"인 상태(off===null)일 때 호출해야 2D 매치엔진이
  // 이 순간의 스냅샷에서 그 선수의 도트를 찾아 카드 애니메이션을 보여줄 수 있다 — 그래서
  // x.off=M.min(그라운드에서 제외 처리)은 ev() 호출 "다음"으로 미룬다.
  freezeLiveSlots(sd);                 // 퇴장으로 한 명이 빠져도 남은 열 명은 제자리를 지킨다
  x.red=true; sd.red++; M.st[key+"R"]++; M.xiDirty=true;
  banApply(M, x.p, second);
  ev(M, sd, F_(second?COMM.dissentSecond:COMM.dissentRed,Object.assign({p:x.p.name},refVars(M))), "red", false, {kind:"card_red", atkSide:key, playerId:x.p.id});
  x.off=M.min;
  if(sd.team.isUser){ M.needsSubPause=true; M.pauseEntryId=x.p.id; M.pauseReason=`🟥 <b>${x.p.name}</b> 선수가 흥분해 항의하다 퇴장당했습니다. 전술을 점검하세요.`; }
}
function sendOff(M, me, key, x, second){
  // sendOffDissent와 동일한 이유로 ev() 호출 이후에 x.off를 설정한다.
  freezeLiveSlots(me);                 // 퇴장으로 한 명이 빠져도 남은 열 명은 제자리를 지킨다
  x.red=true; me.red++; M.st[key+"R"]++; M.xiDirty=true;
  banApply(M, x.p, second);                     // 다음 경기부터 출장정지 (banNew: 이번 라운드 차감 면제)
  ev(M, me, F_(second?COMM.second:COMM.red,Object.assign({p:x.p.name},refVars(M))), "red", false, {kind:"card_red", atkSide:key, playerId:x.p.id});
  x.off=M.min;
  if(me.team.isUser){ M.needsSubPause=true; M.pauseEntryId=x.p.id; M.pauseReason=`🟥 <b>${x.p.name}</b> 선수가 퇴장당했습니다 (${me.team.short} ${onPitch(me).length}명 남음). 전술을 점검하세요.`; }
}
/* ── 사람이 바뀌기 직전에 지금 서 있는 자리를 못 박는다 ──────────────────
   computeRenderSlots() 는 감독이 직접 끌어다 놓지 않은 선수를 매번 처음부터 자동 배치한다.
   그 자동 배치는 "자유 선수들을 id 순으로 줄 세워" 라인의 빈 자리를 나눠 주는 방식이라,
   교체·퇴장·부상으로 한 명만 바뀌어도 id 순서가 달라져 그 라인 전체가 한 칸씩 밀렸다.
   감독 눈에는 "교체하고 나왔더니 진영이 통째로 바뀐" 것으로 보였다.
   그래서 사람이 바뀌기 '직전'에 현재 자리를 그대로 굳혀 둔다 — 그러면 비는 건 나간 자리 하나뿐이다.
   경기 중에만 굳히고, 종료 시 restoreTactic() 이 경기 전 전술로 통째로 되돌린다. */
function freezeLiveSlots(sd){
  const t=sd&&sd.team;
  if(!t || !t.isUser || !t.tactic) return;
  const xi=onPitch(sd).map(x=>x.p);
  if(xi.length<3) return;
  if(!t.tactic.slot) t.tactic.slot={};
  /* ⚠ 인원이 빠진 상태(10명 이하)에서 계산하면 「남은 인원용 기본 배치」로 다시 짜여
     중앙 선수가 옆으로 밀린 결과를 그대로 굳혀 버린다. 이미 자리가 정해진 선수는 손대지 않고,
     아직 자리가 없는 선수만 채운다. */
  const partial = xi.length<11;
  let slotOf; try{ slotOf=computeRenderSlots(t, xi); }catch(e){ return; }
  for(const q of xi){
    if(partial && t.tactic.slot[q.id]) continue;
    const sl=slotOf[q.id];
    if(sl && sl!=="GK" && SLOT_BAND[sl]) t.tactic.slot[q.id]=sl;
  }
}
/* ═══ 🔁 교체 카드 한 장 ═══════════════════════════════════════════
   공식 경기는 다섯 장. 다만 연습경기는 승점이 걸린 경기가 아니라, 실제로도 감독들이
   명단에 넣은 선수를 전부 돌려 본다 — 그게 연습경기를 잡는 이유다.
   ⚠ 제보 — 「친선 경기 때에 한정해서 교체 선수를 5명에서 9명으로 늘려 달라」.
     교체 명단이 9명이므로 연습경기에서는 벤치 전원을 쓸 수 있다. */
const SUB_MAX=5, SUB_MAX_FR=9;
function subMax(M){ return (M && M.opts && M.opts.friendly) ? SUB_MAX_FR : SUB_MAX; }
/* 🔁 교체 카드 표기 — 「쓴 장수 / 전체」와 남은 장수를 함께.
   ⚠ 제보 — 「교체를 하면 2/5 → 3/5 로, 되돌리면 1/5 로 실시간으로 보였으면 좋겠다」.
     예전에는 「남은 장수/전체」만 보여 줘서, 교체할수록 숫자가 줄고 되돌리면 늘어 헷갈렸다.
     교체·되돌리기·취소는 모두 sd.subs 를 그 자리에서 되돌리므로 이 표기는 늘 실시간이다. */
function subChipTxt(sd){
  const mx=subMax(typeof liveM!=="undefined"?liveM:null);
  const used=clamp((sd&&sd.subs)||0, 0, mx);
  const left=mx-used;
  return `🔁 교체 <b>${used}/${mx}</b>` + (left>0?` · ${left}장 남음` : ` · <b style="color:#ff9d5c">소진</b>`);
}
function subIn(M, sd, key, outX, inP, silent){
  /* ⚠ 마지막 방어선 — 호출부(UI·AI)가 각자 검사하지만, 어느 경로가 놓쳐도 한 장 더는 없다 */
  if(sd.subs>=subMax(M)) return null;
  if(!inP || !outX || outX.off!==null && !outX.injGap) return null;   // 이미 나간 선수를 또 빼는 사고 방지
  freezeLiveSlots(sd);                 // ⚠ 교체로 사람이 바뀌기 전에 현재 진영을 굳힌다
  outX.off=M.min;
  // 교체 투입 선수는 "최적 포지션"으로 자동 재배치되는 게 아니라, 나간 선수가 있던 자리(zone+slot)를
  // 정확히 그대로 물려받는다 — 실제 축구에서 교체 선수가 나간 선수 자리로 들어가는 것과 동일하게.
  const t=sd.team;
  let _oldSlot=null;
  if(inP.pos!=="GK" && outX.p.pos!=="GK" && t && t.tactic){
    const oldZone=getZone(t, outX.p);
    const oldSlot=(t.tactic.slot && t.tactic.slot[outX.p.id]) || null;
    _oldSlot=oldSlot;
    setZone(t, inP.id, oldZone);
    if(oldSlot) setSlot(t, inP.id, oldSlot);
  }
  /* 역할·임무도 함께 물려받는다.
     ⚠ 역할은 선수 id 로 저장된다(t.tactic.role[pid]). 그래서 교체로 사람이 바뀌면 그 자리에
        지정해 둔 역할이 사라지고 슬롯 기본 역할로 되돌아갔다 — 라움도이터로 세워 둔 왼쪽 윙어가
        교체 한 번에 그냥 '윙'이 되는 식이다. 카드에 찍힌 역할 이름이 전부 바뀌니
        감독 눈에는 "교체했더니 전술이 통째로 갈렸다"로 보인다.
        나간 선수가 맡던 역할을 그대로 넘겨준다. 그 자리에서 맡을 수 없는 역할이면 넘기지 않는다. */
  if(t && t.tactic){
    const rMap = t.tactic.role || (t.tactic.role={});
    const oldRole = rMap[outX.p.id];
    if(oldRole && ROLE_BY_KEY[oldRole.r]){
      const slotKey = _oldSlot || (outX.p.pos==="GK" ? "GK" : null);
      const grp = slotKey ? ROLE_GRP[slotKey] : null;
      if(!grp || ROLE_BY_KEY[oldRole.r].grp.includes(grp)) rMap[inP.id]={r:oldRole.r, d:oldRole.d};
    }
  }
  const nx={p:inP, fit:matchStartFit(inP), y:0, red:false, goals:0, assists:0, on:M.min, off:null};   /* ⚡ 교체 투입도 잔여 피로 반영 */
  sd.list.push(nx);
  const _bi=sd.bench.findIndex(p=>p===inP || (p&&p.id===inP.id));
  if(_bi>=0) sd.bench.splice(_bi,1);   // ⚠ indexOf가 -1이면 splice(-1)이 엉뚱한 마지막 선수를 지운다
  sd.subs++; M.xiDirty=true;
  if(!silent){
    /* ⚠ 예전에는 F_(COMM.sub,{}) 로 부른 뒤 replace 로 이름을 끼워 넣었다. F_ 가 {o}/{i} 를
       먼저 빈 문자열로 지워 버려서, 문자중계에 "🔁 교체:  OUT →  IN" 처럼 이름 없이 찍혔다. */
    ev(M, sd, F_(COMM.sub,{o:outX.p.name, i:inP.name}), "sub", false, {kind:"sub", atkSide:key, outId:outX.p.id, inId:inP.id});
    /* 중계 화면이 잠깐 멈추고 해설이 읽어 줄 거리 — 양 팀 모두 남긴다.
       ⚠ 예전에는 한 변수(M.subShow)에 덮어썼다. 한 창에서 두 명을 바꾸면 뒤엣것이 앞엣것을
          지워 버려서 해설이 한 번만 나왔다. 큐에 쌓아 하나씩 읽는다. */
    if(!M.subQueue) M.subQueue=[];
    /* 🕐 제보 — min 은 화면 시계 숫자(비교용), minTxt 는 전광판 글자(표시용) */
    M.subQueue.push({out:outX.p.name, in:inP.name, side:key, min:dispMinNum(M), minTxt:recMinTxt(M, M.min),
               team:t?t.short:"", isUser:!!(t&&t.isUser), col:(t&&t.col)||null, shown:false,
               /* ⚔️ 제보 — 온라인 대전 상대는 사람이다. AI 감독 실명 대신 팀 이름(닉네임)으로 읽는다 */
               cn:(t&&!t.isUser&&!t.pvpRemote&&typeof COACHES!=="undefined"&&COACHES[t.id])?COACHES[t.id].n:null});
  }
  return nx;
}
COMM.sub=["🔁 교체: {o} OUT → {i} IN"];
/* 교체 순간 해설 — 우리 팀과 상대 팀의 말투가 다르다 */
COMM.subOur=["🔁 {t}, 선수를 바꿉니다. {o} 나가고 {i} 들어갑니다.",
  "🔁 {t} 벤치가 움직입니다 — {o} 대신 {i}입니다.",
  "🔁 교체입니다. {o}이/가 벤치로, {i}이/가 그라운드로 들어섭니다.",
  "🔁 {t}의 카드. {o} 빠지고 {i} 투입됩니다.",
  "🔁 {o}, 박수를 받으며 나갑니다. 자리는 {i}이/가 채웁니다."];
COMM.subMore=["🔁 {t}, 한 번에 둘을 바꿉니다 — 먼저 {o} 나가고 {i}입니다.",
  "🔁 {t} 벤치가 두 장을 씁니다. {o} 대신 {i}, 그리고 한 명 더 있습니다.",
  "🔁 {t}의 이중 교체. 우선 {o}과/와 {i}이/가 교대합니다."];
COMM.subOpp=["🔁 {t} 벤치가 움직입니다 — {o} 나가고 {i} 들어갑니다.",
  "🔁 {t} 벤치, {o}을/를 불러들이고 {i}을/를 넣습니다.",
  "🔁 {t}의 교체. {i}이/가 몸을 다 풀었습니다. {o}과/와 교대합니다.",
  "🔁 {t}, {i}을/를 투입하며 흐름을 바꾸려 합니다.",
  "🔁 {t}, {o}을/를 부릅니다. {i} 투입."];
/* 우리가 먼저 바꾼 직후의 상대 교체 — 이때만 "맞대응" 뉘앙스가 성립한다 */
COMM.subOppReact=["🔁 {t}도 곧바로 손을 씁니다 — {o} 나가고 {i} 들어갑니다.",
  "🔁 우리 교체를 보고 {t} 벤치가 반응합니다. {o} 아웃, {i} 인.",
  "🔁 맞교체입니다. {t}, {i}을/를 꺼내 듭니다."];
/* 전반 이른 교체 — 대개 좋은 신호가 아니다 */
COMM.subEarly=["🔁 이른 시간의 교체입니다 — {t}, {o} 대신 {i}. 몸 상태가 좋지 않아 보였습니다.",
  "🔁 벌써 카드를 씁니다. {t}의 {o}, 아쉬운 표정으로 나옵니다. {i} 투입."];
/* 종반 승부수 */
COMM.subLate=["🔁 {t}의 마지막 카드 — {o} 나가고 {i}. 이 교체가 승부를 가를 수 있습니다.",
  "🔁 종료가 머지않았습니다. {t}, {i}을/를 넣으며 마지막 승부수를 던집니다."];
/* ═══ 🌏 AFC 대회에는 외국인 동시 출전 제한이 없다 ═══════════════════════
   ⚠ 제보 — 「EACL 은 외국인 용병 제한이 없는데 인게임에서는 K리그 규정(K1 5 · K2 4)으로 걸린다」.
   K리그 규정은 리그 경기에만 적용된다. 대회 경기(리그 스테이지·토너먼트)에서는 등록된 외국인을
   전원 내보낼 수 있다. 한도를 세던 자리가 열 곳 넘게 흩어져 있어 창구를 하나로 모은다. */
function frnFreeNow(){
  try{
    if(typeof liveM!=="undefined" && liveM && liveM.opts && (liveM.opts.eacl||liveM.opts.cwc)) return true;
    if(typeof EACL_SIM_ON!=="undefined" && EACL_SIM_ON) return true;
    if(typeof G==="undefined" || !G) return false;
    if(G.pendingEACL) return true;
    /* ⚠ 제보 — 「cwc도 외국인 5명 제한걸려있던 것 같은데」. CWC 도 국제 대회다 —
       제한이 없어야 하는데 이 창구가 EACL 만 알고 있었다. CWC 는 1월 프리시즌에
       열리므로 phase!=="pre" 가드도 CWC 검사에는 걸면 안 된다. */
    if(G.pendingCWC) return true;
    if(!G.jobless && typeof cwcUserDue==="function" && cwcUserDue()) return true;
    /* 전술판·라인업 화면 — 오늘 치를 경기가 대회 경기면 그 기준으로 짠다 */
    if(!G.jobless && G.phase!=="pre" && typeof eaclUserDue==="function" && eaclUserDue()) return true;
  }catch(e){}
  return false;
}
/* 제한이 풀린 이유가 되는 대회 이름 — 안내문에 EACL·CWC 를 구분해 쓴다 */
function frnFreeComp(){
  try{
    if(typeof liveM!=="undefined" && liveM && liveM.opts && liveM.opts.cwc) return cwcShort();
    if(G && G.pendingCWC) return cwcShort();
    if(G && !G.jobless && typeof cwcUserDue==="function" && cwcUserDue()) return cwcShort();
  }catch(e){}
  try{ return eaclShort(); }catch(e){ return "국제 대회"; }
}
function frnLimOf(t){ return frnFreeNow() ? 99 : ((t && t.div===1) ? 5 : 4); }
let EACL_SIM_ON=false;      // AI끼리의 대회 경기를 돌리는 동안 켜진다
function canEnter(sd, outX, p){ // 외국인 동시 출전 한도 + 골키퍼 중복 검사 (홈그로운은 쿼터 미적용)
  /* 골키퍼를 넣으려면 지금 골문에 선 선수가 나가야 한다 — 안 그러면 키퍼가 둘이 된다 */
  if(p.pos==="GK" && onPitch(sd).some(x=>x!==outX && x.p.pos==="GK")) return false;
  if(!frnQ(p)) return true;
  const lim=frnLimOf(sd.team);
  return onPitch(sd).filter(x=>x!==outX&&frnQ(x.p)).length+1<=lim;
}
function autoSubFor(M, sd, key, outX){
  if(sd.subs>=subMax(M)) { return; }
  const ok=p=>canEnter(sd,outX,p);
  const cand=sd.bench.filter(p=>p.pos===outX.p.pos&&ok(p)).sort((a,b)=>b.ovr-a.ovr)[0]
          || sd.bench.filter(p=>p.pos!=="GK"&&ok(p)).sort((a,b)=>b.ovr-a.ovr)[0];
  /* ⚠ 여기도 같은 순서 버그가 있었다 — injGap 을 먼저 지우면 subIn 이 거부한다 */
  if(cand){ const done=subIn(M, sd, key, outX, cand); if(done!==null && done!==false) outX.injGap=false; }
}
/* ── AI 구단의 교체 ────────────────────────────────────────────────
   예전 버전은 46·60·72·81분 딱 네 번만 검토했고, 조건도 "지친 선수"와 "지고 있으면 공격수"
   둘뿐이었다. 게다가 연속 2D 매치엔진(MatchSim)에서는 아예 호출되지 않아서,
   감독이 직접 보는 경기에서 상대 팀은 90분 내내 단 한 명도 바꾸지 않았다(측정: 3경기 0명).
   이제 여섯 번의 창에서 상황을 읽고, 실제 벤치처럼 이유를 갖고 바꾼다.
     · 체력이 무너진 선수부터
     · 지고 있으면 공격 카드, 이기고 있으면 문을 닫는 카드
     · 경고 받은 선수가 지쳐 있으면 퇴장 전에 뺀다
     · 팀 최고 선수 둘은 웬만해선 빼지 않는다
     · 외국인 동시 출전 한도(canEnter)를 지킨다                                       */
/* ⚠ 제보 — 「AI가 교체를 잘 안 해서 주전이 계속 갈린다」.
   창을 늘리고(하프타임 직후·60분대 추가), 이번 창을 그냥 넘길 확률도 낮춘다. */
/* ═══ 🎩 수석코치가 벤치를 맡았을 때 ══════════════════════════════════════
   ⚠ 제보(직접 확인) — 「수석코치의 능력치가 수석코치에게 맡겼을때의 결과에 영향을 주니?」
      확인해 보니 전혀 아니었다. 그 정도가 아니라 손해였다 —
      엔진의 자동 교체(aiSubs·aiFillGaps)가 첫 줄에서 「내 팀」을 통째로 건너뛰고 있어서
      (원래 「내 팀 교체는 감독 몫」이라는 전제로 쓰인 가드다),
      위임·부상 대행 경기에서는 아무도 교체를 하지 않았다.
      실측: 강원 vs 포항 한 판 — 내 팀 교체 0회 / 상대(AI) 5회, 종료 시 체력 57·60·62.
      조직력 페널티만 받고 벤치는 놀리는 상태였다.
   ─ 이제 위임·대행 경기에서는 내 팀 벤치도 굴러간다. 다만 그 「질」을 수석코치가 정한다.
     · judg 경기판단 — 언제 손을 대는가 (첫 교체 시점 · 창을 흘려보낼 확률)
     · man  선수관리 — 누구를 뺄 것인가 (엉뚱한 선수를 빼는 실수)
     · tac  전술     — 누구를 넣을 것인가 (자리 궁합·업그레이드 판정)
     · flex 유연성   — 경기 흐름에 맞춰 성향을 손보는가
     별도의 숨은 승률 보정은 넣지 않는다 — 교체의 질만으로 충분히 갈리고,
     보이지 않는 숫자는 게임을 불투명하게 만든다. */
function acBenchLv(){
  try{ const c=acOf(); if(!c) return 0;
    return clamp((c.judg|0)*0.50 + (c.man|0)*0.28 + (c.tac|0)*0.22, 1, 20);
  }catch(e){ return 0; }
}
/* 이 경기의 내 팀 벤치를 수석코치가 굴리는가 — 위임했거나 감독이 다쳤을 때만 */
function acRunBench(M){ return !!(M && M.acRun); }
/* 첫 교체 시점 — 판단이 좋을수록 이르다. 공석이면 아무도 손을 대지 않는다(90). */
function acFirstWin(lv){ return lv<=0?90 : lv>=16?46 : lv>=13?55 : lv>=10?61 : lv>=7?68 : 74; }
/* 이번 교체 창을 그냥 흘려보낼 확률 */
function acSkipP(lv, tiredN){
  const base=clamp(0.46 - lv*0.022, 0.05, 0.46);
  return base * (tiredN>=2 ? 0.35 : tiredN>=1 ? 0.6 : 1);
}
/* 「최선의 선택」을 실제로 고를 확률 — 낮으면 엉뚱한 선수를 빼거나 아무나 넣는다 */
function acRightP(lv){ return clamp(0.30 + lv*0.038, 0.30, 0.96); }
const AI_SUB_WINDOWS=[46,55,61,68,74,79,84,88];
const AI_SUB_TIRED=64;        // 이 밑이면 피로 교체 후보
const AI_SUB_URGENT=54;       // 이 밑이면 최고 선수라도 뺀다
/* 🚑 부상으로 비어 버린 자리를 채운다 — 교체 창과 무관하게 즉시.
   ⚠ 제보 — 「1명 퇴장인데 그라운드 인원이 9명」. 레드카드는 한 장뿐인데 한 명이 더 비어 있었다.
      실시간 2D 엔진에서 부상 선수를 그라운드에서 빼면서 x.injGap 표시만 남기는데,
      그 자리를 채우는 루틴이 분 단위 엔진(autoSubFor)에만 있었다. AI 팀은 남은 경기를
      영영 10명으로 뛰었고, 거기에 퇴장이 겹치면 9명이 된다.
      실제 감독은 들것이 나가는 즉시 교체 카드를 쓴다. */
function aiFillGaps(M){
  for(const [sd,key] of [[M.h,"h"],[M.a,"a"]]){
    if(!sd) continue;
    /* ⚔️ ⚠ 제보 원문 — 「온라인 대전에서 퇴장 경고 조차 없었는데, 10명으로 뛰는 현상이 있었대!」.
       원인 — 온라인 대전은 두 팀 모두 pvpRemote 라 이 함수가 통째로 건너뛰었다. 게다가 대전 팀은
         세이브 격리를 위한 「클론」이라 isUser 도 아니어서, 2D 엔진의 「부상 — 경기를 멈추고
         교체하세요」 안내(needsSubPause)도 뜨지 않았다. 그래서 부상으로 한 명이 빠지면
         카드도 경고도 없이 남은 시간을 조용히 열 명으로 뛰었다.
       ─ 부상 공백은 전술적 선택이 아니다. 어떤 감독도 열 명으로 버티지 않는다.
         온라인 대전에서도 벤치에서 곧바로 채운다(양 팀 대칭). 전술 교체는 예전대로 감독 몫이다.
       🎩 위임 경기라면 내 팀은 수석코치가 채운다. */
    const _pvp=!!(sd.team && sd.team.pvpRemote);
    if(!_pvp && sd.team.isUser && !(acRunBench(M) && acBenchLv()>0)) continue;
    let guard=0;
    while(guard++<12 && (sd.subs||0)<subMax(M)){
      const gap=(sd.list||[]).find(x=>x.off!==null && !x.red && x.injGap);
      if(!gap) break;
      const bench=(sd.bench||[]);
      const inP = bench.find(p=>p.pos===gap.p.pos && canEnter(sd, gap, p))
               || bench.find(p=>p.pos!=="GK" && canEnter(sd, gap, p))
               || bench.find(p=>canEnter(sd, gap, p));
      if(!inP){
        /* 벤치가 비었거나 외국인 한도 — 어쩔 수 없이 한 명 적게 뛴다.
           ⚔️ 제보 — 적어도 「왜 열 명인지」는 화면에 남겨야 한다. 한 번만 알린다. */
        if(!gap._noFill){ gap._noFill=1;
          try{ ev(M, sd, fixJosa(`🚑 ${gap.p.name} 자리를 채울 선수가 벤치에 없습니다 — ${sd.team.short}은/는 <b>열 명</b>으로 뜁니다.`), "warn"); }catch(e){}
        }
        break;
      }
      /* ⚠ injGap 을 먼저 지우면 subIn 의 「이미 나간 선수」 검사에 걸려 교체가 조용히 무산된다.
         반드시 교체를 성사시킨 뒤에 표식을 지운다. */
      const done=subIn(M, sd, key, gap, inP);
      if(done===null || done===false) break;
      gap.injGap=false;
      /* 🚑 이 교체는 「부상 공백 메우기」다 — 해설이 그렇게 읽어 준다 (제보) */
      try{ const q=M.subQueue; if(q && q.length) q[q.length-1].inj=1; }catch(e){}
    }
  }
}
function aiSubs(M, minNow){
  const m = (minNow!=null) ? minNow : M.min;
  aiFillGaps(M);                            // 교체 창과 상관없이 빈 자리부터
  if(AI_SUB_WINDOWS.indexOf(m)<0) return;
  const acLv=acRunBench(M) ? acBenchLv() : 0;
  for(const [sd,key,myG,opG] of [[M.h,"h",M.hg,M.ag],[M.a,"a",M.ag,M.hg]]){
    if(sd.team.pvpRemote) continue;                     // ⚔️ 제보 — PvP 는 감독이 직접 교체한다
    const mine=!!sd.team.isUser;
    if(mine && !(acRunBench(M) && acLv>0)) continue;    // 감독이 직접 보는 경기 — 교체는 감독 몫
    if(!sd.bench || !sd.bench.length) continue;
    /* 선수단이 지쳐 있을수록 벤치를 적극적으로 쓴다 */
    let _tiredN=0;
    try{ _tiredN=onPitch(sd).filter(x=>x.p.pos!=="GK" && x.fit<AI_SUB_TIRED).length; }catch(e){}
    if(mine){
      /* 🎩 수석코치가 굴린다 — 언제 손을 대는지가 경기판단에 달렸다 */
      if(m < acFirstWin(acLv)) continue;
      if(Math.random() < acSkipP(acLv, _tiredN)) continue;
    } else {
      if(Math.random() < (_tiredN>=2 ? 0.04 : _tiredN>=1 ? 0.08 : 0.16)) continue;   // 이번 창은 그냥 지켜본다
    }
    let made=0;
    /* 판단이 좋은 코치만 한 창에서 둘을 바꾼다 */
    const cap = mine ? ((_tiredN>=2 && acLv>=12) || (acLv>=15 && Math.random()<0.34) ? 2 : 1)
                     : ((_tiredN>=2 || Math.random()<0.34) ? 2 : 1);
    while(sd.subs<subMax(M) && made<cap && aiSubOnce(M, sd, key, myG-opG, m, mine?acLv:0)) made++;
  }
  /* 🎩 유연성 — 흐름에 맞춰 성향을 손보는 코치도 있다 (경기 뒤 restoreTactic 이 되돌린다) */
  try{ if(acLv>0) acLiveTweak(M, m); }catch(e){}
}
/* 🎩 경기 중 전술 조정 — 유연성(flex)이 높은 코치만, 경기당 한 번.
   숫자를 몰래 바꾸는 게 아니라 감독이 평소에 만지는 그 슬라이더(성향)를 한 칸 민다. */
function acLiveTweak(M, m){
  const c=acOf(); if(!c) return;
  const sd=M.h.team.isUser?M.h:(M.a.team.isUser?M.a:null); if(!sd) return;
  if(M._acTweak) return;
  const flex=c.flex|0;
  if(m<62 || flex<11) return;
  const my=(sd===M.h)?M.hg:M.ag, op=(sd===M.h)?M.ag:M.hg, gd=my-op;
  if(gd===0) return;
  if(Math.random() > clamp((flex-9)*0.09, 0, 0.72)) return;
  const T=sd.team.tactic; if(!T) return;
  const before=T.mentality|0;
  T.mentality = clamp(before + (gd<0 ? 1 : -1), 0, 4);
  if(T.mentality===before) return;
  M._acTweak={min:m, minTxt:recMinTxt(M, m), from:before, to:T.mentality, up:gd<0};
}
/* 한 명만 바꾼다. 바꿨으면 true. */
function aiSubOnce(M, sd, key, diff, m, acLv){
  const pitch=onPitch(sd).filter(x=>x.p.pos!=="GK" && !x.red);
  if(pitch.length<8) return false;                       // 이미 수적 열세면 더 빼지 않는다
  const bench=sd.bench.filter(p=>p.pos!=="GK");
  if(!bench.length) return false;
  // 이 팀의 기둥 — 웬만해선 빼지 않는다
  const core=[...pitch].sort((a,b)=>b.p.ovr-a.p.ovr).slice(0,2).map(x=>x.p.id);
  const protectedOut=x=>core.indexOf(x.p.id)>=0 && x.fit>=AI_SUB_URGENT;
  /* 🎩 수석코치가 굴리는 경기 — 판단이 흐리면 「가장 나은 선택」을 못 고른다.
     자리 궁합·능력을 보고 고르는 대신 벤치에서 아무나 집어 든다(요청). */
  const _acOn=(acLv|0)>0;
  const _right=_acOn ? (Math.random() < acRightP(acLv)) : true;
  const best=(list,f)=>{
    const c=list.filter(f||(()=>true));
    if(!c.length) return null;
    if(!_right) return c[Math.floor(Math.random()*c.length)];   // 어긋난 판단
    return c.sort((a,b)=>b.ovr-a.ovr)[0];
  };
  const tryPair=(outX, inP)=>{
    if(!outX||!inP) return false;
    if(!canEnter(sd, outX, inP)) return false;
    subIn(M, sd, key, outX, inP);
    return true;
  };
  // ① 경고 + 피로 — 퇴장 나기 전에 뺀다
  const risky=pitch.filter(x=>x.y>0 && x.fit<72 && !protectedOut(x)).sort((a,b)=>a.fit-b.fit)[0];
  if(risky){
    const inP=best(bench, p=>p.pos===risky.p.pos) || best(bench, p=>p.pos!=="GK");
    if(tryPair(risky, inP)) return true;
  }
  // ② 체력이 무너진 선수
  const _tiredList=pitch.filter(x=>x.fit<AI_SUB_TIRED && (!protectedOut(x)||x.fit<AI_SUB_URGENT))
                        .sort((a,b)=>a.fit-b.fit);
  /* 판단이 흐린 코치는 「제일 지친 선수」가 아니라 그 언저리의 다른 선수를 뺀다 */
  const tired = _tiredList.length
    ? (_right ? _tiredList[0] : _tiredList[Math.floor(Math.random()*Math.min(3,_tiredList.length))])
    : undefined;
  if(tired){
    const inP=best(bench, p=>p.pos===tired.p.pos) || best(bench, p=>p.pos!=="GK");
    if(tryPair(tired, inP)) return true;
  }
  // ③ 지고 있다 — 수비를 하나 줄이고 공격 자원을 넣는다
  if(diff<0 && m>=58){
    const df=pitch.filter(x=>x.p.pos==="DF");
    const outX=df.length>3 ? df.sort((a,b)=>(a.p.ovr+a.fit*0.3)-(b.p.ovr+b.fit*0.3))[0]
                           : pitch.filter(x=>x.p.pos==="MF").sort((a,b)=>a.fit-b.fit)[0];
    const inP=best(bench, p=>p.pos==="FW") || best(bench, p=>p.pos==="MF");
    if(outX && !protectedOut(outX) && tryPair(outX, inP)) return true;
  }
  // ④ 이기고 있다 — 문을 닫는다. 공격수를 빼고 수비·중원을 채운다
  if(diff>0 && m>=73){
    const fw=pitch.filter(x=>x.p.pos==="FW");
    const outX=fw.length>1 ? fw.sort((a,b)=>a.fit-b.fit)[0] : null;
    const inP=best(bench, p=>p.pos==="DF") || best(bench, p=>p.pos==="MF");
    if(outX && !protectedOut(outX) && tryPair(outX, inP)) return true;
  }
  // ⑤ 그 밖에는 확실한 업그레이드가 있을 때만 (벤치가 더 좋고, 나갈 선수는 지쳐 있을 때)
  if(m>=66){
    for(const outX of [...pitch].sort((a,b)=>a.fit-b.fit)){
      if(protectedOut(outX)) continue;
      const inP=best(bench, p=>p.pos===outX.p.pos && p.ovr>outX.p.ovr+2 && outX.fit<78);
      if(inP && tryPair(outX, inP)) return true;
    }
  }
  return false;
}
/* ── 경기 결과에 따른 구단주·팬 신뢰도 변화 (FM 스타일) ──
   단순히 "이기면 +, 지면 -"가 아니라, 상대와의 전력차·기대치 대비 결과로 판단한다:
   약팀 상대로 이기는 건 당연하니 소폭만 오르고, 강팀을 잡는 이변엔 크게 오른다.
   반대로 약팀에게 지면 팬·구단주 모두 크게 실망하고, 강팀에게 지는 건 어느 정도 이해받는다.
   점수차(마진)가 클수록 임팩트가 더 커지도록 배율을 곱한다. */
function matchTrustDelta(myTeam, oppTeam, gf, ga, isHome){
  const myS=xiStrength(myTeam).s, oppS=xiStrength(oppTeam).s;
  const diff=(myS-oppS)+(isHome?1.5:-1.5); // 전력차 + 홈 어드밴티지 보정 = "이 결과가 얼마나 예상됐는가"
  const margin=Math.abs(gf-ga);
  const marginMult=1+Math.min(margin-1,3)*0.15; // 큰 스코어차일수록 임팩트 소폭 증폭 (최대 1.45배)
  let fan=0, owner=0;
  if(gf>ga){ // 승리: 이변일수록(diff가 매우 음수, 즉 열세였는데 이김) 크게 오른다
    fan = diff<=-6?6 : diff<=-2?4 : diff<=3?2.5 : 1.2;
    owner = fan*0.55;
  } else if(gf===ga){ // 무승부: 강팀 상대 선전은 소폭 긍정, 약팀 상대 무승부는 아쉬움
    fan = diff>=6?-2 : diff>=2?-0.8 : diff<=-6?1.5 : diff<=-2?0.5 : -0.2;
    owner = fan*0.5;
  } else { // 패배: 우세했는데 진 경우(이변 패배)일수록 크게 떨어진다
    fan = diff>=6?-6 : diff>=2?-4 : diff>=-3?-2.5 : -1.2;
    owner = fan*0.65;
  }
  fan*=marginMult; owner*=marginMult;
  return {fan:Math.round(fan*10)/10, owner:Math.round(owner*10)/10};
}
/* ── 경기 결과에 따른 팀 사기 변동 ────────────────────────────
   승리는 조금씩 오르고, 패배는 확실하게 깎인다(최소 -3).
   같은 패배라도 몇 점 차로 졌는지, 그리고 그 경기가 얼마나 중요했는지에 따라 무게가 다르다. */
const MOR_LOSS_MIN=2;      // 지면 최소 이만큼은 깎인다
const MOR_LOSS_MAX=6.5;    // 아무리 크게 져도 여기까지
function matchImportance(t, opp, isHome){
  let k=1;
  { const d=derbyOf(t.id, opp.id); if(d) k *= (d.tier>=2?1.45:1.3); }   // 더비 — 급이 높을수록 크게 흔들린다
  const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1, op=tbl.findIndex(x=>x.id===opp.id)+1;
  const rd=t.div===1?G.r1:G.r2, total=(t.div===1?G.k1Fix:G.k2Fix).length;
  if(pos>0 && op>0){
    if(pos<=3 && op<=3) k*=1.20;                        // 우승 경쟁 맞대결
    if(pos>=tbl.length-3 && op>=tbl.length-3) k*=1.22;  // 강등권 6인승부
  }
  if(rd<=1) k*=1.10;                                     // 개막전
  if(total && rd>=total-5) k*=1.18;                      // 시즌 막바지
  if(isHome) k*=1.10;                                    // 홈에서의 결과는 더 크게 다가온다
  return clamp(k, 0.85, 1.9);
}
/* 사기 표시용 — 소수 첫째 자리까지, 정수면 정수로 (부동소수점 찌꺼기 제거) */
function mor1(v){
  const n2=Math.round((Number(v)||0)*10)/10;
  return Number.isInteger(n2) ? String(n2) : n2.toFixed(1);
}
function resultMorale(t, opp, gf, ga, isHome){
  const imp=matchImportance(t, opp, isHome);
  const gap=teamOVR(opp) - teamOVR(t);                   // +면 상대가 강하다
  if(gf>ga){
    const margin=Math.min(gf-ga, 4);
    // 예전엔 무조건 +3이었다. 이기는 게 당연한 상대를 이겨도 사기가 쭉쭉 올라 인플레가 생겼다.
    /* 이기는 것만으로 사기가 쭉쭉 오르면 시즌 중반에 전원 90대가 된다(제보 — "올리는 게 너무 쉽다").
       한 골 차 승리는 거의 본전, 대승이나 강팀 격파에만 의미 있는 상승을 준다. */
    let v=1.35 + (margin-1)*0.40;
    v *= clamp(1 + gap*0.050, 0.55, 1.60);              // 강팀을 잡으면 크게, 약팀은 당연한 결과
    return Math.round(clamp(v*(0.7+imp*0.3), 0.5, 3.6)*10)/10;
  }
  if(gf===ga){
    // 비긴 건 대체로 본전. 다만 이겼어야 할 상대와 비기면 살짝 깎인다.
    return gap>=4 ? 0.4 : gap<=-5 ? -1.2 : 0;
  }
  const margin=Math.min(ga-gf, 5);
  let v = MOR_LOSS_MIN + (margin-1)*0.70;               // 1점 차 -2, 3점 차 -3.4, 5점 차 -4.8
  v *= clamp(1 - gap*0.028, 0.78, 1.35);                // 약체에게 지면 더 아프다
  v *= imp;
  return -Math.round(clamp(v, MOR_LOSS_MIN, MOR_LOSS_MAX)*10)/10;
}
/* 경기 결과 반영 */
/* 💊 경기가 끝났다 — 진통제를 맞고 뛴 선수를 정산한다 (요청)
   ① 뛰었는데 재발 → 원래보다 훨씬 길게 눕는다
   ② 뛰고 무사히 마쳤다 → 약효가 끝나고 남은 회복을 그때 치른다
   ③ 아예 안 뛰었다 → 처방은 그대로 남는다(다음 경기까지) */
function painSettle(M){
  try{
    const t=userTeam(); if(!t) return;
    const sd=(M.h&&M.h.team&&M.h.team.isUser)?M.h:((M.a&&M.a.team&&M.a.team.isUser)?M.a:null);
    if(!sd) return;
    /* sd.list 는 「그라운드를 밟은 선수」만 담는다 — 벤치는 sd.bench 다 */
    const played=new Set((sd.list||[]).filter(x=>x && x.p && x.on!=null).map(x=>x.p.id));
    for(const p of t.players){
      if(!painOn(p)) continue;
      if(!played.has(p.id)) continue;              // 벤치에만 있었다 — 약은 남겨 둔다
      const w=p.pain.w||1;
      /* 🐛 경기 중에 이미 쓰러졌다면(p.inj>0) mkInjury 가 기사·이력·유형을 이미 남겼다.
         여기서 또 「재발」로 처리하면 뉴스가 두 번 나가고 이력이 두 줄 쌓이며,
         엉뚱하게 「새 부상의 유형」을 한 단계 더 올려 버린다. 처방만 걷고 끝낸다. */
      if(p.inj>0){
        delete p.pain;
        try{ affAdd(p, -10, "진통제 강행 중 부상"); }catch(e){}
        try{ p.morale=clamp((p.morale||70)-8, 25, 99); }catch(e){}
        try{ staffLog(`🚑 ${p.name} — 진통제를 맞고 뛰다 경기 중 쓰러졌습니다.`); }catch(e){}
        try{ addMood(`💬 의무팀: "말씀드렸습니다. 무리였습니다." (${p.name})`); }catch(e){}
        continue;
      }
      const broke=(Math.random() < painBreakP(p));
      delete p.pain;
      if(broke){
        /* 🚑 배선 — 재발은 「같은 자리가 더 크게」다. 유형을 한 단계 무겁게 올린다 (요청) */
        const up={knock:"ham", ham:"hamT", calf:"hamT", groin:"ham", ankle:"ankleT",
                  bruise:"knock", back:"back", knee:"acl", shoul:"shoul", ill:"ill", fati:"knock"};
        const k0=p.injT||"knock";
        const k1=up[k0]||k0;
        const T1=INJ_TYPE[k1]||INJ_TYPE.knock;
        const nw=Math.max(w+1, Math.max(T1.w[0], Math.round(w*1.7)+R(3)));
        p.injT=k1; p.injC="relapse";
        setInjury(p, nw, true);
        p.injW0=Math.max(p.injW0||0, nw);
        try{ p.injLog=Array.isArray(p.injLog)?p.injLog:[];
             p.injLog.unshift({k:k1, part:T1.part, c:"relapse", w:nw, s:G.season, d:G.day||0});
             p.injLog=p.injLog.slice(0,5); }catch(e){}
        try{ affAdd(p, -10, "진통제 재발"); }catch(e){}
        try{ p.morale=clamp((p.morale||70)-8, 25, 99); }catch(e){}
        addNews(`🚑 <b>${p.name} 부상 재발</b> — 진통제를 맞고 나섰다가 다시 쓰러졌습니다. ${T1.ic} <b>${T1.n}</b> · 전치 <b>${nw}주</b>.`,"warn","club");
        addMood(`💬 의무팀: "말씀드렸습니다. 무리였습니다." (${p.name} ${nw}주)`);
        try{ staffLog(`🚑 ${p.name} 진통제 재발 — 전치 ${nw}주.`); }catch(e){}
        try{ adjustTrust("fans", -2, `${p.name} 부상 재발`); }catch(e){}
      } else {
        const nw=Math.max(1, Math.round(w*(0.70 + clamp((10-docMed())*0.02, 0, 0.2))));
        setInjury(p, nw, true);
        addNews(`💊 ${p.name} — 경기는 마쳤지만 약효가 끝났습니다. 남은 회복 <b>${nw}주</b>.`,null,"club");
        try{ staffLog(`💊 ${p.name} 진통제 경기 완주 — 남은 회복 ${nw}주.`); }catch(e){}
      }
    }
  }catch(e){}
}
function applyMatchResult(M){
  try{ aiPlanRestore(M); }catch(e){}
  try{ painSettle(M); }catch(e){}      // 💊 진통제 정산 (요청)
  /* 🗓️ 내가 경기를 치른 날을 기록해 둔다 — 같은 날 두 경기를 뛰지 않게 하는 기준 (제보) */
  try{ if(M && ((M.home&&M.home.isUser)||(M.away&&M.away.isUser))) G.lastMD=G.day||0; }catch(e){}
  /* 📋 이 경기를 치른 전술은 한동안 손발이 풀리지 않는다 — 실전이 곧 반복 훈련이다 (제보) */
  try{ if(M.home) markTacticUsed(M.home); if(M.away) markTacticUsed(M.away); }catch(e){}
  const pairs=[[M.h,M.home,M.hg,M.ag,M.away,true],[M.a,M.away,M.ag,M.hg,M.home,false]];
  for(const [sd,t,gf,ga,opp,isHome] of pairs){
    /* 🥅 승부차기로 갈린 경기 — 90분 스코어는 무승부지만, 감정·사기·신뢰는 승패로 갈린다.
       ⚠ 제보 — 「승부차기로 이겼는데 경기가 끝나면 '이길 수 있었는데 아쉽다'로 평가된다」.
         순위표에 올라가는 기록(승/무/패·승점)은 규정대로 무승부 그대로 두고,
         사람의 반응만 실제 결과를 따르게 한다. ef/ea = 평가용 스코어(한 골 차 승부). */
    const _pkw = (M.pk && M.pk.win) ? (((M.pk.win==="h")===isHome) ? 1 : -1) : 0;
    const ef = gf + (_pkw>0?1:0), ea = ga + (_pkw<0?1:0);
    const _pkTxt = _pkw ? ` · 승부차기 ${_pkw>0?"승":"패"}` : "";
    if(M.opts&&M.opts.friendly){
      // 연습경기 — 승패 기록도 순위표도 없다. 다만 라커룸 분위기는 조금 움직인다.
      const fv=resultMorale(t, opp, gf, ga, isHome)*0.4;
      t.morale=Math.round(clamp(t.morale+fv,40,99)*100)/100;
    }
    if(!M.opts.noTable){
      t.GF+=gf; t.GA+=ga;
      let mdv=resultMorale(t, opp, ef, ea, isHome);
      /* 👔 선수 관리 — 좋은 감독의 라커룸은 <b>패배에 덜 무너지고</b>, 이겨도 덜 들뜬다.
         AI 팀에만 건다(유저 팀 사기는 감독=플레이어가 라커룸 토크로 직접 다룬다). */
      if(!t.isUser){
        const _mk=aiManK(t);
        mdv = mdv<0 ? mdv/Math.max(0.5,_mk) : mdv*_mk;   // man 높으면 하락은 완만, 상승은 조금 크게
      }
      const setMor=(v)=>{ t.morale=Math.round(clamp(v,40,99)*100)/100; };
      if(gf>ga){t.W++; t.Pts+=3; t.form.push("W"); setMor(t.morale+mdv);}
      else if(gf===ga){t.Dw++; t.Pts+=1; t.form.push("D"); setMor(t.morale+mdv);}
      else {t.L++; t.form.push("L"); setMor(t.morale+mdv);
        if(t.isUser) addMood(`📉 ${opp.short}전 ${gf}-${ga} 패배 — 라커룸이 가라앉았습니다. (팀 사기 ${mor1(mdv)})`);
        if(t.isUser && t.form.length>=3 && t.form.slice(-3).every(x=>x==="L")){
          adjustTrust("owner",-4,"리그 3연패 이상"); adjustTrust("fans",-3,"리그 3연패 이상");
        }
      }
    }
    // 승강 PO 등 noTable 경기도 신뢰도만큼은 반영한다(오히려 이런 경기가 가장 크게 흔든다).
    if(t.isUser && G.mgrTaunt && G.mgrTaunt.opp===opp.id && !(M.opts&&M.opts.friendly)){
      const cn=G.mgrTaunt.cn||"상대";
      if(ef>ea){
        fmkFill([[`"${cn}의 시대는 갔다" 도발하고 진짜 이겨버림 ㅋㅋㅋ 폼 미쳤다`,1],[`도발하고 이기는 게 제일 간지지 ㅋㅋ 오늘부로 우리 감독 승부사 인정`,1]],2,{});
        addNews(`🔥 도발은 현실이 됐다 — ${t.short}, ${cn} 감독과의 설전에서 완승`,"good","club");
        adjustTrust("fans",+2,"도발 설전 승리");
      } else if(ef<ea){
        fmkFill([[`${cn} 시대는 갔다며 ㅋㅋㅋ 오늘 보니 누구 시대가 갔는지 알겠던데`,-1],[`도발하고 지는 게 제일 꼴받는다 진짜 ㅅㅂ`,-1],[`오늘부로 우리 감독 기자회견 금지시켜라`,-1]],3,{});
        addNews(`🤐 설전의 대가 — ${cn} 감독을 도발했던 ${t.short}, 고개를 숙였다`,"warn","club");
        adjustTrust("fans",-3,"도발 후 패배"); G.press.rel=clamp(G.press.rel-3,0,100);
      } else {
        fmkFill([[`도발까지 해놓고 비김 ㅋㅋ 이게 제일 애매하다`,0]],1,{});
      }
      G.mgrTaunt=null;
    }
    if(t.isUser){
      const {fan,owner}=matchTrustDelta(t, opp, ef, ea, isHome);
      const reason = (ef>ea?`${opp.short}전 승리 (${gf}-${ga})`:ef===ea?`${opp.short}전 무승부 (${gf}-${ga})`:`${opp.short}전 패배 (${gf}-${ga})`)+_pkTxt;
      if(Math.abs(fan)>=0.1) adjustTrust("fans", fan, reason);
      if(Math.abs(owner)>=0.1) adjustTrust("owner", owner, reason);
    }
    const cf=condFactor(t);
    const frMatch=!!(M.opts&&M.opts.friendly);   // 연습경기 — 개인 기록을 본 시즌과 분리해서 쌓는다
    /* ⚠ 제보 — 「리그 4경기 + EACL 1경기를 뛰었는데 리그 출장이 5경기로 잡힌다」.
       연습경기만 장부를 나눠 두고 대륙대회는 그대로 리그 기록에 얹고 있었다.
       대회 출장·득점·도움은 p.eacl 에만 쌓는다(대회 순위표가 그 값을 쓴다). */
    const eaclMatch=!!(M.opts&&M.opts.eacl);
    for(const x of sd.list){
      const mins=(x.off===null?M.min:x.off)-x.on; if(mins<=0) continue;
      const p=x.p;
      if(frMatch){
        /* 엔진은 골이 터지는 순간 p.goals 를 구분 없이 올린다 — 여기서 회수해 프리시즌 장부로 옮긴다 */
        p.fApps=(p.fApps||0)+1;
        p.fGoals=(p.fGoals||0)+(x.goals||0);   p.goals-=(x.goals||0);
        p.fAssists=(p.fAssists||0)+(x.assists||0); p.assists-=(x.assists||0);
      } else if(eaclMatch){
        /* 대회 경기 — 리그 장부에서 회수한다. 대회 기록은 eaclStatCollect 가 따로 쌓는다 */
        p.goals-=(x.goals||0); p.assists-=(x.assists||0);
      } else { p.apps++; p.career=(p.career||0)+1; }
      p.mn=(p.mn||0)+mins;   // 최근 출전 시간 — 성장·노쇠 계산에 쓴다(주간 감쇠는 completeRound)
      /* ⚠ 제보 원문 — 「반 시즌 내내 그 역할로만 출전시켰음에도 역할 숙련도가 오르지 않는다.
         김성주를 딥라잉 플레이메이커로 반시즌 주전으로 내보냈는데 26%(처음 맡는다)에 머묾」.
         원인 — x.slot 은 명단 엔트리에 아예 없는 필드고 sd.slotOf 는 어디서도 채우지 않아,
         항상 p.prefPos(타고난 선호 포지션)로 떨어졌다. 실제 뛴 자리가 아니다. 선호 포지션
         그룹이 지정 역할 그룹과 다르면 getRole 이 다른 역할로 폴백해 반 시즌치 적립이
         엉뚱한 역할에 쌓였다(DLP 는 시드 26 그대로). 포지션 능숙도(gainPosFam)도 같은 병.
         ─ 시뮬이 경기마다 기록하는 실제 슬롯 점유(team._slotOcc, 6600 빌드)를 먼저 본다. */
      const _sl = x.slot || (sd.slotOf&&sd.slotOf[p.id])
                || (sd.team&&sd.team._slotOcc&&sd.team._slotOcc[p.id]) || p.prefPos;
      gainPosFam(p, _sl, mins);   // 그 자리에서 뛴 만큼 익숙해진다
      /* 🎓 그 자리에서 「맡은 역할」도 함께 익힌다 — 앵커로 뛴 시간은 앵커에만 쌓인다 */
      try{ const _rd=getRole(t, p, canonSlot(_sl)||_sl); if(_rd && _rd.r) gainRoleFam(p, _rd.r, mins); }catch(e){}
      // 경기 피로. 달력이 생기면서 회복이 하루 단위로 들어오므로 종전보다 살짝 낮췄다 —
      //   기본 루틴으로 매 경기 풀타임을 뛰면 시즌 중반에 80대 초반까지 내려간다.
      /* 경기 뒤 컨디션 소모 — 여기에도 지구력이 빠져 있었다(제보).
         90분을 버티는 힘은 지구력이고, 다음 날 아침의 몸 상태는 타고난 체력이 가른다.
         리그 평균(지구력 11.3 · 타고난 체력 13.5)에서 소모량이 그대로가 되도록 기준값을 맞췄다. */
      const natK = p.attr ? clamp(1.19 - (attr20(p.attr.nat)-10)*0.018 - (attr20(p.attr.sta)-10)*0.014, 0.80, 1.22) : 1;
      /* 🧤 골키퍼는 한 경기를 뛰어도 몸에 남는 피로가 훨씬 적다 — 주중·주말 연전을 버틴다 */
      const gkK = (p.pos==="GK") ? GK_STAM_K : 1;
      /* 출전 부하 — 정비례가 아니다. 밟는 순간 드는 몫(APP_BASE)이 있고,
         교체로 들어간 선수는 짧게 뛰는 대신 분당 강도가 높다(SUB_RATE). */
      const load = clamp((APP_BASE + (mins/93)*(1-APP_BASE)*(x.on>0?SUB_RATE:1))*gkK, 0, 1.15);
      p.cond=clamp(p.cond-Math.round(load*(8+R(6))*cf*natK),55,100);
      p.mFat=Math.round(clamp((p.mFat||0)+load, 0, 1.30)*100)/100;   // 다음 며칠의 회복을 늦춘다
      /* ⭐ 실축 눈금 평점 — 팀 성적·골득실·공격 포인트·무실점/실점·리그 대비 실력·출전 시간 (제보) */
      const base=matchRating(x, p, t, mins, gf, ga, ef, ea);
      x.rating=base;                    // 이 경기의 평점 — 리포트·MOM 선정에 쓰인다
      if(frMatch){ p.fRTot=(p.fRTot||0)+base; p.fRating=Math.round(p.fRTot/p.fApps*100)/100; }
      else if(eaclMatch){ /* 대회 평점 — eaclStatCollect 가 x.rating 을 가져간다 */ }
      else { p.rTot+=base; p.seasonRating=Math.round(p.rTot/p.apps*100)/100; }
      p.morale=clamp(p.morale+(ef>ea?3:ef<ea?-3:0)+(base>=7.9?2:0),30,99);
      /* 특성 경험치 — 뛴 만큼, 잘한 만큼 쌓인다 (우리 팀 선수만 관리 대상) */
      if(t.isUser){
        try{ addTraitXp(p, traitXpForMatch(p, mins, clamp(base,3,10), x.goals, x.assists,
              {derby: !!(typeof derbyOf==="function" && derbyOf(t.id, opp.id))})); }catch(e){}
      }
    }
    /* 출전하지 않은 선수의 경기일 회복은 matchDayRecover 가 하루 시작에 이미 처리했다 —
       선발·교체·명단 외가 같은 값을 받는다(제보). 여기서 또 얹지 않는다. */
  }
  try{ pickMOM(M); }catch(e){}
}
/* ═══════════════════════════════════════════════════════════════
   🏅 MAN OF THE MATCH — 오늘 경기의 주인공
   평점이 기본이지만 경기를 결정한 장면에 가중을 준다.
   골은 도움보다 무겁고, 무실점을 지킨 키퍼와 수비수도 후보가 된다.
   퇴장당한 선수는 뽑히지 않는다 — 아무리 잘했어도.
═══════════════════════════════════════════════════════════════ */
const MOM_SOC={
 our:["{p} 오늘 진짜 미쳤다 MOM 인정","{p} 평점 {r}이면 말 다 했지",
   "오늘 경기 {p} 혼자 다 했다","{p} 이 선수 요즘 폼 실화냐",
   "MOM 당연히 {p}지. 다른 선택지가 없었음","{p} 오늘 하이라이트만 열 번 봤다",
   "{p} 계약 연장 언제 합니까 구단아","우리 팀에 {p} 있어서 다행이다 진심",
   "{p} 오늘 경기는 두고두고 회자될 듯","경기장에서 {p} 이름 부르는데 소름 돋았다"],
 opp:["{p}한테 다 털렸네... 인정하기 싫지만 잘하더라",
   "상대 {p} 평점 {r}이라던데 우리 수비는 뭐 했냐",
   "{p} 저 선수 우리한테만 잘하는 것 같음","오늘 MOM이 상대팀이라는 게 다 말해준다",
   "{p} 데려올 수 없나 진지하게","저런 선수 하나만 있으면 우리도 다른 팀 됐다"]
};
/* ═══ 🔥 활약 반응 리뉴얼 ═══════════════════════════════════════════════
   예전 MOM 반응은 여섯 줄짜리 한 덩어리라, 평점 7.2 로 MOM 을 받은 날과
   해트트릭에 평점 9.4 를 찍은 날이 <b>같은 말</b>을 했다. 두 단계로 나눈다.
     big  — MOM 급 활약 (평점·기록을 인용한다)
     hype — 「이 새끼 미쳤다」 소리가 나오는 날. 커뮤니티가 이성을 놓는 결이다.        */
const MOM_FMK={
 big:[["{t} {p} 오늘 경기 봤냐 평점 {r} ㄷㄷ",1],["{p} 이 정도면 리그 최고 아님?",1],
   ["MOM 논란 없는 경기였음",1],["{p} 하이라이트 올라왔는데 미쳤다",1],
   ["이 선수 곧 해외 나갈 듯",0],["{t} 팬들 오늘 행복하겠네",0],
   ["{p} 평점 {r} 실화냐 이거 조작 아님?",1],["{p} 오늘 풀타임 스탯 좀 보고 와라 말이 안 나온다",1],
   ["솔직히 {p} 없었으면 오늘 경기 뒤집혔다",1],["{p} 몸값 지금 얼마임? 올려야 될 듯",0],
   ["{t} 팬 아닌데 {p} 때문에 하이라이트 챙겨 봄",1],
   ["{p} 국대 안 뽑으면 그건 감독이 이상한 거지",1],
   ["에이전트한테 전화 몇 통 왔을지 궁금하다",0],
   ["{p} 저 나이에 저 정도면 진짜 물건임",1],
   ["그냥… 걷는 폼이 섹스였다. 가까이 오니까 {p}이었음.",1],
   ["죽는 날까지 {p}을/를 우러러<br>한 점 부끄럼이 없기를",1],
   ["형들 지금 {p} 의심하는겨? ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ",1]],
 /* 🔥 광신 — 팬이 이성을 놓는 순간. 펨코 특유의 결이라 여기만 수위가 다르다 */
 hype:[["크악 {p} 이 미친놈이 기어코 딸딸이를 부르는구나 오냐 덤벼라 딸딸딸딸딸딸딸",1],
   ["{p} 크아아악 내 새끼 크아아아악",1],
   ["형들 나 오늘 {p} 유니폼 질렀다 후회 안 함",1],
   ["{p} 평점 {r} ㅋㅋㅋㅋ 이건 뭐 게임을 혼자 하네",1],
   ["아 진짜 {p} 이런 거 보면 축구 못 끊는다",1],
   ["{p} 오늘 경기 다시보기 세 번 돌림 미친놈아",1],
   ["{p} 나 이 선수한테 인생 걸었다 진짜로",1],
   ["{t} 프런트 지금 당장 재계약 들고 뛰어가라",1],
   ["크 {p} 크 크 크 (더 이상 문장이 안 됨)",1]]
};
/* ═══ 🕸️ 패스맵 ══════════════════════════════════════════════════════════
   실제 패스맵과 같은 규칙으로 그린다.
     · 노드 = 그 선수의 「평균 위치」 (공을 갖지 않은 시간까지 포함한 실제 서 있던 자리)
     · 선   = 두 선수 사이의 패스 연결. 굵기와 진하기가 곧 횟수다
     · 15분 미만 뛴 선수는 그리지 않는다 — 교체 투입 선수까지 넣으면 그림이 뭉갠다
   위쪽이 우리가 공격하는 방향이다(후반 진영 교대는 수집 단계에서 이미 뒤집어 놨다). */
let PMAP_SIDE="h";
function pmapSide(k){ PMAP_SIDE=k; try{ show("home"); }catch(e){} }
/* 📈 경기 모멘텀 — FM 의 그 막대 그래프 (요청).
   1분 단위 값을 5분 묶음으로 눌러 18칸 안팎으로 그린다. 위(밝은 색)=홈, 아래(팀 색)=원정.
   전·후반 사이에 구분선을 긋고, 골이 난 칸에는 ⚽ 를 얹는다. */
/* ═══ 🎩 경기 총평 — 수석코치가 경기를 어떻게 읽었는가 ══════════
   경기 중 조언과 같은 규칙을 쓴다: 담당 능력치가 낮으면 그 대목을 못 보고,
   경기판단이 낮으면 결과의 「원인」을 엉뚱한 데서 찾는다.
   ⚠ 경기가 끝난 뒤라 판정을 흔들 이유가 없다 — 경기 결과로 해시를 고정한다. */
function acReportCard(res, h, a){
  if(!res || !h || !a) return "";
  if(!h.isUser && !a.isUser) return "";              // 남의 경기는 총평하지 않는다
  const c=acOf();
  const mine=h.isUser?"h":"a";
  const st=res.st||{};
  const S =mine==="h"?(st.hS|0):(st.aS|0), oS=mine==="h"?(st.aS|0):(st.hS|0);
  const T =mine==="h"?(st.hT|0):(st.aT|0), oT=mine==="h"?(st.aT|0):(st.hT|0);
  const F =mine==="h"?(st.hF|0):(st.aF|0);
  const Y =mine==="h"?(st.hY|0):(st.aY|0), R=mine==="h"?(st.hR|0):(st.aR|0);
  const C =mine==="h"?(st.hC|0):(st.aC|0);
  const P =mine==="h"?(st.hP|0):(st.aP|0), oP=mine==="h"?(st.aP|0):(st.hP|0);
  const poss=(P+oP)>0 ? Math.round(P/(P+oP)*100) : 50;
  const gf=mine==="h"?(res.hg|0):(res.ag|0), ga=mine==="h"?(res.ag|0):(res.hg|0);
  const key=`rep|${h.id}|${a.id}|${res.hg}-${res.ag}|${S}-${oS}|${G.season||0}`;
  const box=(inner, sub)=>`<div class="card" style="flex:1 1 300px;min-width:280px">
    <h3>🎩 ${c?`${c.n} 수석코치 총평`:"경기 총평"}
      ${c?`<span class="small">— ${AC_TRAIT[c.trait]?AC_TRAIT[c.trait].ic+" "+AC_TRAIT[c.trait].n:""} · 경기판단 <b style="color:${acGrade(c.judg)[1]}">${c.judg}</b>${
        (function(){ try{ const a=acAnaLv(); return a?` · 📊 분석 ${Math.round(a)}`:""; }catch(e){ return ""; } })()}</span>`:""}</h3>
    ${inner}${sub||""}</div>`;
  if(!c) return box(`<p class="small" style="opacity:.8">수석코치가 공석이라 경기를 함께 되짚을 사람이 없습니다.
    <span style="color:var(--gold)">💸 이적시장 → 🎩 스태프 탭</span>에서 한 명 선임하시죠.</p>`);
  /* ── 그가 볼 수도, 못 볼 수도 있는 것들 ── */
  const O=[];
  const say=(tag, txt)=>O.push({tag, txt});
  const onPct = S>0 ? Math.round(T/S*100) : 0;
  if(S>=6 && onPct<32)  say("att", `슈팅 ${S}개 중 골문 안으로 간 건 ${T}개(${onPct}%)뿐입니다. 마무리 훈련을 한 주 잡겠습니다.`);
  else if(S>=6 && onPct>=55 && gf<=1) say("att", `유효슛 비율은 ${onPct}%로 좋았습니다. 오늘은 상대 골키퍼가 잘했을 뿐입니다.`);
  if(S>=10 && gf===0)   say("att", `슈팅 ${S}개에 무득점입니다. 숫자는 만들었는데 마지막 한 명이 없었습니다.`);
  if(oS>=S+5)           say("def", `슈팅을 ${S}:${oS}로 내줬습니다. 오늘 결과와 별개로 이 흐름은 다음 경기까지 가면 안 됩니다.`);
  if(oT>=5 && ga<=1)    say("def", `상대 유효슛 ${oT}개에 실점 ${ga}입니다. 골키퍼가 승점을 지켰습니다.`);
  if(poss>=60 && gf<=1) say("tac", `점유율 ${poss}%를 쥐고도 ${gf}골입니다. 돌리기만 하고 마지막 3분의 1에서 선택이 없었습니다.`);
  if(poss<=40 && gf>=2) say("tac", `점유는 ${poss}%였지만 필요한 순간에만 나갔습니다. 오늘 같은 경기는 이렇게 이기는 겁니다.`);
  if(F>=15)             say("man", `파울 ${F}개는 많습니다. 다음 경기 주심이 이 기록을 보고 들어옵니다.`);
  if(Y>=3 || R>0)       say("man", `경고 ${Y}장${R?` · 퇴장 ${R}장`:""}. 발이 늦게 나가고 있다는 뜻입니다 — 회복 훈련을 늘리겠습니다.`);
  if(C>=8 && gf===0)    say("att", `코너킥 ${C}개를 얻고 소득이 없었습니다. 세트피스 배치를 다시 짜 보겠습니다.`);
  /* 흐름 — 모멘텀 그래프가 남긴 값 */
  try{
    const MO=res.momo;
    if(MO && Array.isArray(MO.v) && MO.v.length>=10){
      const ht=MO.ht||45, sgn=(mine==="h")?1:-1;
      const av=(f,t2)=>{ let s=0,n=0; for(const it of MO.v) if(it.m>=f&&it.m<t2){ s+=it.v*sgn; n++; } return n?s/n:0; };
      const h1=av(0,ht), h2=av(ht,999);
      if(h1-h2>=0.20)      say("judg", `전반은 우리 경기였는데 후반에 통째로 넘어갔습니다. 체력이든 교체 타이밍이든, 45분을 못 버틴 겁니다.`);
      else if(h2-h1>=0.20) say("judg", `후반에 확실히 살아났습니다. 하프타임에 만진 게 먹혔습니다 — 다음에도 이 카드는 씁니다.`);
    }
  }catch(e){}
  if(!O.length) say("judg", `특별히 짚을 대목은 없습니다. 평소 하던 대로 나온 경기였습니다.`);
  /* ── 렌즈 ── */
  const kp=(tag, txt)=>{
    const at=c[AC_TAG_ATTR[tag]||"judg"]|0;
    const pH=clamp((15-at)*0.055, 0, 0.40);
    if(pH<=0) return true;
    return ((uidHash(key+"|"+tag+"|"+txt.slice(0,40))%1000)/1000) >= pH;
  };
  let lines=O.filter(x=>kp(x.tag, x.txt)).map(x=>x.txt);
  /* 📊 분석가가 붙으면 되짚는 대목이 늘어난다 — 영상과 데이터를 같이 보기 때문이다 */
  let anB=0; try{ const a=acAnaLv(); anB = a>=16?2 : a>=12?1 : 0; }catch(e){}
  const nMax=clamp(1+Math.round((acOvr(c)-10)/2.4)+anB, 1, 6);
  lines=lines.slice(0, nMax);
  /* 🎭 오독 — 경기판단이 낮으면 결과의 원인을 엉뚱한 데서 찾는다 */
  let bad="";
  if((c.judg|0)<11){
    const pW=clamp((11-(c.judg|0))*0.12, 0, 0.42);
    if(((uidHash(key+"|badread")%1000)/1000) < pW){
      const W=[];
      if(gf>ga) W.push(`오늘 이긴 건 전술이 맞아떨어져서입니다. 이대로만 가면 됩니다.`);
      if(gf<ga) W.push(`오늘은 운이 없었을 뿐입니다. 내용은 우리가 나았습니다.`);
      if(gf===ga) W.push(`무승부지만 사실상 이긴 경기였습니다. 바꿀 건 없습니다.`);
      if(poss>=55) W.push(`점유를 내준 게 패인입니다. 공을 더 쥐어야 합니다.`);
      else W.push(`공을 너무 오래 쥐고 있었습니다. 더 빨리 넘겨야 합니다.`);
      bad=W[uidHash(key+"|bw")%W.length];
    }
  }
  if(bad) lines.splice(Math.min(1, lines.length), 0, bad);
  if(!lines.length) lines=[`오늘은 저도 잘 모르겠습니다. 영상 다시 보고 말씀드리겠습니다.`];
  const hedged=(c.judg|0)>=13 ? lines
    : lines.map(t2=> (((uidHash(key+"|h|"+t2.slice(0,30))%1000)/1000) < clamp((13-(c.judg|0))*0.16,0,0.65))
        ? t2+` <span class="small" style="opacity:.55">…제 생각입니다만.</span>` : t2);
  return box(hedged.map(t2=>`<div class="small" style="line-height:1.85;margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid #21262d">📋 "${t2}"</div>`).join(""),
    `<p class="small" style="opacity:.6;margin-top:2px">경기판단이 높을수록 더 많이, 더 정확하게 짚습니다.</p>`);
}
/* 🎨 어두운 차트 위의 구단색 — 배경(#0d1117)과 밝기가 붙으면 막대가 통째로 사라진다.
   ⚠ 제보 원문 — 「이렇게 성남으로 플레이하면 모멘텀 그래프가 검은색이라 가시성이 없어져.
      성남 모멘텀 그래프는 흰색으로 하자」. (성남 블랙스타 킷은 #101010, 차트 배경은 #0d1117 —
      밝기 차가 3 밖에 안 나서 검은 판에 검은 막대를 그리고 있었다.)
   ─ 구단색을 바꾸지 않는다. 배경과 구분이 안 될 때만 색조를 유지한 채 반대쪽으로 끌어올린다 —
     새까만 킷은 자연히 흰색이 되고, 남색·자주색 같은 어두운 킷은 같은 계열의 밝은 색이 된다. */
function chartCol(col, bg){
  try{
    const BG=bg||"#0d1117";
    const px=(c)=>{ const m=/^#?([0-9a-f]{6})/i.exec(String(c||"")); if(!m) return null;
      const v=parseInt(m[1],16); return [(v>>16)&255,(v>>8)&255,v&255]; };
    const C=px(col); if(!C) return col||"#e6edf3";
    const B=px(BG)||[13,17,23];
    const hex=(q)=>"#"+q.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,"0")).join("");
    /* 밝기만 보면 안 된다 — 포항의 진홍(#c8102e)은 밝기가 낮아도 검은 판에서 또렷하다.
       색 자체의 거리(colDist — 잔디 위 디스크 구분에 쓰는 그 자)로 판정한다. */
    if(colDist(col, BG)>=62) return col;                  // 충분히 구분된다 — 구단색 그대로
    const L=(q)=>(q[0]*0.299+q[1]*0.587+q[2]*0.114);
    if(L(B)>=128){                                        // 밝은 배경이면 어두운 쪽으로
      for(let t=0.2;t<=1.001;t+=0.2){ const o=C.map(v=>v*(1-t*0.8));
        if(colDist(hex(o), BG)>=90) return hex(o); }
      return "#12161c";
    }
    const mx=Math.max(C[0],C[1],C[2]);
    if(mx<28) return "#f2f4f7";                           // 사실상 무채색 검정 → 흰색 (성남)
    /* ① 색조·채도를 지킨 채 밝기만 끝까지 올려 본다 (남색 → 선명한 파랑) */
    let out=C.map(v=>v*Math.min(255/Math.max(1,mx), 4.2));
    if(colDist(hex(out), BG)>=90) return hex(out);
    /* ② 그래도 모자라면 흰색을 조금씩 섞는다 */
    for(let t=0.15;t<=1.001;t+=0.15){ const o=out.map(v=>v+(255-v)*t);
      if(colDist(hex(o), BG)>=90) return hex(o); }
    return "#f2f4f7";
  }catch(e){ return col||"#e6edf3"; }
}
function momentumCard(res, h, a){
  const MO=res && res.momo;
  if(!MO || !Array.isArray(MO.v) || MO.v.length<8) return "";
  const ht=MO.ht||45;
  /* 5분 묶음 — 전·후반 경계에서 끊어 두 구간이 섞이지 않게 한다 */
  const BIN=5, bins=[];
  const put=(from, to)=>{
    for(let s=from; s<to; s+=BIN){
      const e=Math.min(s+BIN, to);
      let sum=0, n=0;
      for(const it of MO.v){ if(it.m>=s && it.m<e){ sum+=it.v; n++; } }
      if(!n) continue;
      /* 추가시간 자투리(1~2분)는 앞 칸에 합친다 — 「90분부터 91분까지」 같은 토막이 안 생기게 */
      const prev=bins[bins.length-1];
      if((e-s)<=2 && prev && prev.half===(s<ht?1:2)){ prev.v=(prev.v+sum/n)/2; prev.e=e; continue; }
      bins.push({s, e, v:sum/n, half:(s<ht?1:2)});
    }
  };
  const last=MO.v.reduce((m2,it)=>Math.max(m2,it.m), 0)+1;
  put(0, ht); put(ht, Math.max(ht+1, last));
  if(bins.length<4) return "";
  const W=560, H=250, PADX=18, PADY=24, MID=PADY+(H-PADY*2)/2;
  const bw=(W-PADX*2)/bins.length;
  /* ⚠ 제보 — 차트 배경 위에서 안 보이는 구단색은 여기서 한 번 걸러 준다(성남 검정 → 흰색) */
  const CHART_BG="#0d1117";
  let hCol=chartCol((h&&h.col)||"#e6edf3", CHART_BG), aCol=chartCol((a&&a.col)||"#e5484d", CHART_BG);
  /* 두 팀 색이 끌어올린 뒤에 서로 붙어 버리면(둘 다 어두운 킷) 범례에서 구분이 안 된다 */
  try{ if(colDist(hCol, aCol)<90) aCol = (colDist(hCol,"#e5484d")>=110) ? "#e5484d" : "#ffa657"; }catch(e){}
  const hInk=(typeof inkOn==="function")?inkOn(hCol):"#fff";
  /* 막대 */
  let bars="";
  bins.forEach((b,i)=>{
    const x=PADX+i*bw+bw*0.14, w=bw*0.72;
    const hgt=Math.max(1.5, Math.abs(b.v)*(H-PADY*2)/2*0.94);
    if(b.v>=0) bars+=`<rect x="${x.toFixed(1)}" y="${(MID-hgt).toFixed(1)}" width="${w.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${hCol}" rx="1"/>`;
    else       bars+=`<rect x="${x.toFixed(1)}" y="${MID.toFixed(1)}" width="${w.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${aCol}" rx="1"/>`;
  });
  /* 골 표식 */
  let goals="";
  for(const g of (MO.g||[])){
    let idx=bins.findIndex(b=>g.m>=b.s && g.m<b.e);
    if(idx<0) continue;
    const x=PADX+idx*bw+bw/2;
    const y=(g.s==="h") ? MID-((H-PADY*2)/2)*0.62 : MID+((H-PADY*2)/2)*0.62;
    goals+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#0d1117" stroke="#e6edf3" stroke-width="1.4"/>`
         + `<text x="${x.toFixed(1)}" y="${(y+3.4).toFixed(1)}" text-anchor="middle" font-size="8.5">⚽</text>`;
  }
  /* 하프타임 구분선 */
  const n1=bins.filter(b=>b.half===1).length;
  const hx=PADX+n1*bw;
  /* 왼쪽 요약 — 이 경기가 어떤 흐름이었는지 문장으로 (FM 의 그 설명문) */
  const hs=bins.filter(b=>b.half===1), as2=bins.filter(b=>b.half===2);
  const avg=(A)=>A.length?A.reduce((s,b)=>s+b.v,0)/A.length:0;
  const nm=(v)=>v>0?((h&&h.short)||"홈"):((a&&a.short)||"원정");
  const say=[];
  const all=avg(bins);
  say.push(Math.abs(all)<0.12 ? `양 팀 모두 경기 내내 <b>비슷한 수준의 대결</b>을 펼쳤습니다.`
    : `경기 전체로는 <b>${nm(all)}</b> 쪽이 흐름을 쥐었습니다.`);
  const a1=avg(hs), a2=avg(as2);
  if(hs.length) say.push(Math.abs(a1)<0.14 ? `전반전은 전체적으로 <b>비슷했습니다</b>.`
    : `전반전은 <b>${nm(a1)}</b> 쪽이 <b>${Math.abs(a1)>0.42?"확실히":"조금"}</b> 우세했습니다.`);
  if(as2.length) say.push(Math.abs(a2)<0.14 ? `후반전 들어 <b>팽팽한 접전</b>이 이어졌습니다.`
    : `후반전은 <b>${nm(a2)}</b> 쪽이 <b>${Math.abs(a2)>0.42?"주도권을 가져갔습니다":"조금 앞섰습니다"}</b>.`);
  /* 가장 뜨거웠던 구간 */
  let bestP=null, bestN=null;
  for(const b of bins){ if(!bestP||b.v>bestP.v) bestP=b; if(!bestN||b.v<bestN.v) bestN=b; }
  if(bestP && bestP.v>0.45) say.push(`<b>${bestP.s}분부터 ${bestP.e}분</b>까지는 <b>${(h&&h.short)||"홈"}</b> 쪽이 확실히 우세했습니다.`);
  if(bestN && bestN.v<-0.45) say.push(`<b>${bestN.s}분부터 ${bestN.e}분</b>까지는 <b>${(a&&a.short)||"원정"}</b> 쪽이 주도권을 잡았습니다.`);
  return `<div class="card" style="flex:1;min-width:330px">
    <h3>📈 경기 모멘텀 <span class="small">— 5분 단위 우세도</span></h3>
    <div class="tblScroll" style="overflow-x:auto">
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:340px;display:block">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#0d1117" rx="8"/>
        <line x1="${PADX}" y1="${MID}" x2="${W-PADX}" y2="${MID}" stroke="#8b949e" stroke-width="1"/>
        ${n1&&as2.length?`<line x1="${hx.toFixed(1)}" y1="${PADY-6}" x2="${hx.toFixed(1)}" y2="${H-PADY+6}" stroke="#30363d" stroke-width="1.4"/>`:""}
        ${bars}${goals}
        <text x="${PADX+2}" y="${PADY-8}" font-size="10" fill="#8b949e">수적 우위 ↑</text>
        ${n1?`<text x="${(PADX+n1*bw/2).toFixed(1)}" y="${H-6}" font-size="10.5" fill="#8b949e" text-anchor="middle">전반</text>`:""}
        ${as2.length?`<text x="${(hx+as2.length*bw/2).toFixed(1)}" y="${H-6}" font-size="10.5" fill="#8b949e" text-anchor="middle">후반</text>`:""}
      </svg>
    </div>
    <div class="small" style="display:flex;gap:14px;justify-content:center;margin:4px 0 8px">
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${hCol};vertical-align:-1px"></i> ${(h&&h.short)||"홈"}</span>
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${aCol};vertical-align:-1px"></i> ${(a&&a.short)||"원정"}</span>
    </div>
    <div class="small" style="line-height:1.75;opacity:.9">${say.map(s=>`· ${(typeof fixJosa==="function")?fixJosa(s):s}`).join("<br>")}</div>
  </div>`;
}
function passMapCard(res, h, a){
  const PM=res && res.pmap; if(!PM) return "";
  const meIsHome = !!(h && h.isUser);
  /* 기본은 우리 팀. 우리 경기가 아니면(관전) 홈 팀. */
  if(PMAP_SIDE!=="h" && PMAP_SIDE!=="a") PMAP_SIDE = meIsHome?"h":"a";
  const key = PMAP_SIDE;
  const side = PM[key]; if(!side || !side.nodes || side.nodes.length<3) return "";
  const team = key==="h" ? h : a;
  const nodes=side.nodes.slice();     // 선발 11명 — 수집 단계에서 이미 걸러져 있다
  if(nodes.length<3) return "";
  const ok=new Set(nodes.map(n=>n.id));
  const links=(side.links||[]).filter(l=>ok.has(l.a)&&ok.has(l.b) && l.n>=2);
  const subbed=nodes.filter(n=>n.mn<85).length;
  const maxN=links.length?links[0].n:1;
  const by={}; for(const n of nodes) by[n.id]=n;
  /* 겹쳐 붙은 노드는 아주 조금 밀어낸다 — 번호가 서로를 가리면 읽을 수가 없다 */
  for(let it=0; it<12; it++){
    let moved=false;
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const A=nodes[i], B=nodes[j];
      let dx=A.x-B.x, dy=(A.y-B.y)*0.72, d=HYP(dx,dy);
      if(d>=0.075) continue;
      if(d<1e-5){ dx=(i%2?1:-1)*0.01; dy=0.01; d=HYP(dx,dy); }
      const push=(0.075-d)/2/d;
      A.x=clamp(A.x+dx*push, 0.03, 0.97); A.y=clamp(A.y+dy*push, 0.05, 0.95);
      B.x=clamp(B.x-dx*push, 0.03, 0.97); B.y=clamp(B.y-dy*push, 0.05, 0.95);
      moved=true;
    }
    if(!moved) break;
  }
  /* 좌표 — 세로 피치. 게임 좌표는 x=길이(0~1), y=폭(0~1)이므로 세로로 세운다.
     공격 방향이 위가 되도록 x 를 뒤집는다.
     ⚠ 제보 원문 — 「지난경기 리포트 패스맵에서 좌우 선수가 우윙→좌윙 이런 식으로 반전되어
        표시되는데 수정 부탁드립니다」.
     ─ 원인: x 와 y 를 둘 다 뒤집고 있었다 — (x,y) → (1-y, 1-x) 는 회전이 아니라 「거울」이다
       (야코비 행렬식 −1). 그래서 왼쪽 선수가 오른쪽에, 오른쪽 선수가 왼쪽에 그려졌다.
     ─ 중계 화면은 x=오른쪽, y=아래(pitchToCanvasXY)다. 공격 방향(+x)이 위가 되게 화면을
       반시계로 90° 돌리면 위쪽 터치라인(y 작은 쪽)이 왼쪽으로 온다 → 화면 x = y, 화면 y = 1−x.
       (dir<0 인 팀은 수집 단계에서 이미 (1−x, 1−y) 로 180° 돌려 놨으므로, 두 팀 모두
        「y 가 작은 쪽 = 우리 왼쪽 측면」으로 통일돼 있다.) */
  const W=300, H2=430, PAD=26;
  const px=(n)=>PAD + n.y*(W-PAD*2);
  const py=(n)=>PAD + (1-n.x)*(H2-PAD*2);
  const col=(team&&team.col)||"#e5484d";
  const line=links.map(l=>{
    const A=by[l.a], B=by[l.b];
    const k=l.n/maxN;
    const w=(1.2+k*5.4).toFixed(1);
    const op=(0.30+k*0.62).toFixed(2);
    /* 굵은 연결은 팀 색, 가는 연결은 흰빛으로 — 실제 패스맵처럼 강약이 한눈에 들어온다 */
    const c2 = k>=0.45 ? col : "#e8eef6";
    return `<line x1="${px(A).toFixed(1)}" y1="${py(A).toFixed(1)}" x2="${px(B).toFixed(1)}" y2="${py(B).toFixed(1)}"
      stroke="${c2}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"><title>${A.nm} ↔ ${B.nm} · ${l.n}회</title></line>`;
  }).join("");
  /* 노드 크기 = 그 선수가 관여한 패스 총량 */
  const deg={}; for(const l of links){ deg[l.a]=(deg[l.a]||0)+l.n; deg[l.b]=(deg[l.b]||0)+l.n; }
  const maxD=Math.max(1, ...Object.values(deg));
  const dot=nodes.map(n=>{
    const d=deg[n.id]||0;
    const r=(9+ (d/maxD)*7).toFixed(1);
    const x=px(n).toFixed(1), y=py(n).toFixed(1);
    return `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="#fff" stroke-width="1.6"/>
      <text x="${x}" y="${(+y+3.6).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="800" fill="#fff">${n.no||""}</text>
      <text x="${x}" y="${(+y+ +r + 11).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#e8eef6"
        stroke="#0d1117" stroke-width="2.2" stroke-opacity="0.85" paint-order="stroke">${n.nm}</text>
      <title>${n.nm} · ${n.mn}분 · 연결 ${d}회</title></g>`;
  }).join("");
  const top=links.slice(0,3).map(l=>`${by[l.a].nm} ↔ ${by[l.b].nm} <b>${l.n}</b>`).join(" · ");
  const tot=links.reduce((s,l)=>s+l.n,0);
  const tab=(k,lab)=>`<button class="mini ${key===k?"sel":""}" onclick="pmapSide('${k}')">${lab}</button>`;
  return `<div class="card"><h3>🕸️ 패스맵 <span class="small">— 평균 위치와 패스 연결</span></h3>
  <div style="display:flex;gap:6px;margin-bottom:7px">${tab("h",h.short)}${tab("a",a.short)}</div>
  <div style="display:flex;justify-content:center">
  <svg viewBox="0 0 ${W} ${H2}" style="width:100%;max-width:330px;border-radius:10px">
    <defs><pattern id="pmStripe" width="${W}" height="${(H2/8).toFixed(1)}" patternUnits="userSpaceOnUse">
      <rect width="${W}" height="${(H2/16).toFixed(1)}" fill="#ffffff" fill-opacity="0.045"/></pattern></defs>
    <rect width="${W}" height="${H2}" fill="#20603a"/>
    <rect width="${W}" height="${H2}" fill="url(#pmStripe)"/>
    <g stroke="#ffffff" stroke-opacity="0.30" fill="none" stroke-width="1.2">
      <rect x="8" y="8" width="${W-16}" height="${H2-16}"/>
      <line x1="8" y1="${H2/2}" x2="${W-8}" y2="${H2/2}"/>
      <circle cx="${W/2}" cy="${H2/2}" r="42"/>
      <rect x="${W/2-62}" y="8" width="124" height="62"/>
      <rect x="${W/2-28}" y="8" width="56" height="24"/>
      <rect x="${W/2-62}" y="${H2-70}" width="124" height="62"/>
      <rect x="${W/2-28}" y="${H2-32}" width="56" height="24"/>
    </g>
    ${line}${dot}
    <text x="${W/2}" y="${H2-3}" text-anchor="middle" font-size="9" fill="#ffffff" fill-opacity="0.55">▲ 공격 방향</text>
  </svg></div>
  <p class="small" style="margin-top:7px">선이 굵을수록 그 둘 사이로 공이 많이 오갔습니다 · 원이 클수록 패스 관여가 많았습니다.
    <span style="color:var(--sub)">(선발 ${nodes.length}명 기준 · 2회 이상 연결${subbed?` · 교체된 선수는 뛴 시간까지만 반영`:""})</span></p>
  ${top?`<p class="small">🔗 가장 굵은 연결 — ${top} &nbsp;·&nbsp; 표시된 연결 합계 <b>${tot}</b>회</p>`:""}
  </div>`;
}
/* 🏅 MOM 카드 — 경기 리포트 안에 한 줄로 */
function momCard(m){
  if(!m) return "";
  const line=[];
  if(m.goals) line.push(`⚽ ${m.goals}골`);
  if(m.assists) line.push(`🅰️ ${m.assists}도움`);
  line.push(`평점 <b>${m.rating.toFixed(2)}</b>`);
  return `<div style="text-align:center;margin:6px 0 8px;padding:7px 10px;border-radius:8px;
      background:linear-gradient(90deg,#d2992218,#d2992208);border:1px solid #d2992255">
    <span style="font-size:11px;color:var(--gold);font-weight:700;letter-spacing:.5px">🏅 MAN OF THE MATCH</span><br>
    <b style="font-size:15px;color:${m.isUser?"var(--acc)":"#e6edf3"}">${m.name}</b>
    <span class="small" style="opacity:.75"> ${m.team} · ${POS_KO[m.pos]||m.pos}</span><br>
    <span class="small">${line.join(" · ")}</span></div>`;
}
function momScore(x, won, drew, cleanSheet){
  if(!x || !x.p || x.red) return -99;
  let s=(x.rating||6.0);
  s += (x.goals||0)*0.85 + (x.assists||0)*0.42;
  if(cleanSheet){
    if(x.p.pos==="GK") s+=0.55;
    else if(x.p.pos==="DF") s+=0.22;
  }
  if(won) s+=0.30; else if(drew) s+=0.05;
  if(x.y>=1) s-=0.15;
  const mins=(x.off===null?90:x.off)-x.on;
  if(mins<25) s-=0.60;                       // 잠깐 뛰고 뽑히면 이상하다
  return s;
}
/* ═══ ⭐ 평점 — 실축(K리그1·2) 통계에 맞춘 눈금 ══════════════════════════
   ⚠ 제보 원문 — 「현재 평점 시스템이 실축과 다르게 짜게 편성되어 있는 것 같다.
      시즌 최우수 베스트 11의 경우 평점이 6점대인 후보가 여덟 명인데, 특히 미드필더진·
      수비진·골키퍼는 모두가 6점대였다. 실축에서는 작년 기준 리그 베스트11이 모두 7점대
      이상이었다(최고점 이동경 7.65). 공격수 또한 리그 파괴급이 아니면 저평가당한다.
      K리그1·K리그2 실축 평점 통계를 활용해 현실화해 달라」.
   ── 원인 ────────────────────────────────────────────────────
   옛 식은 이랬다:  6.0 + 골×1.0 + 도움×0.5 − 경고×0.3 − 퇴장×1.2 + 골득실×0.2 + rand(−0.3~+0.9)
     · 공격 포인트가 없으면 무조건 6.3 언저리다. 골키퍼·수비수·수비형 미드필더는
       한 시즌을 아무리 잘 막아도 6점대를 벗어날 방법이 아예 없었다 —
       무실점·실점·선방·상대 전력·팀 성적이 식에 단 한 줄도 없었기 때문이다.
     · 리그 평균이 6.3이라 실축 눈금(평균 6.75)보다 통째로 0.45 낮았고,
       그래서 베스트11이 6점대로 발표됐다.
   ── 새 눈금 (실축 분포에 맞춤) ────────────────────────────────
     리그 평균 ≈ 6.75 · 주전 하위권 ≈ 6.3 · 베스트11 ≈ 7.2~7.7 · 최고 ≈ 7.7
   ── 무엇을 보는가 ───────────────────────────────────────────
     ① 팀 성적(승·무·패)과 골득실 — 이긴 팀의 선수가 더 받는다
     ② 공격 포인트 — 포지션마다 무게가 다르다 (수비수의 한 골 > 공격수의 한 골)
     ③ 무실점·실점 — 골키퍼와 수비수의 성적표다 (옛 식에는 아예 없었다)
     ④ 「보이지 않는 기여」 — 이 매치엔진은 선수별 태클·선방·키패스를 따로 적지 않는다.
        실축 평점의 절반은 그 항목들에서 나온다. 대신 <b>같은 리그 평균 대비 실력</b>을
        그 자리에 놓는다. 리그마다 기준선이 따로 잡히므로 K리그2 베스트11도 7점대에 선다.
     ⑤ 출전 시간 — 짧게 뛴 교체 선수는 평균 쪽으로 당겨진다 (15분 뛰고 8점이 나오지 않게)
   ⚠ 분포를 통째로 0.45 올렸으므로, 평점을 읽는 다른 판정(부진·호조·이적료·재계약·
      임대 완전영입·MOM 화제성)의 문턱도 같은 폭으로 함께 옮겼다. */
const RT_BASE=6.66;
/* 포지션 기준선 — 실축 평점도 자리마다 바탕이 조금씩 다르다. 골키퍼·수비수는
   기록에 남는 공격 포인트가 거의 없어 바탕을 조금 높게 잡아야 눈금이 맞는다 (제보). */
const RT_POS ={GK:0.06, DF:0.05, MF:0.00, FW:-0.02};                                     // 아무 일 없이 풀타임을 뛴 선수의 바탕
const RT_WIN=0.36, RT_DRAW=0.02, RT_LOSS=-0.26;         // 팀 성적
const RT_GD=0.05, RT_GD_CAP=0.20;                       // 골득실 한 점당 (상·하한)
const RT_GOAL={GK:1.60, DF:1.25, MF:1.05, FW:1.00};     // 골 — 수비수의 한 골이 더 무겁다
const RT_AST ={GK:0.90, DF:0.68, MF:0.60, FW:0.52};     // 도움
const RT_CS  ={GK:0.48, DF:0.42, MF:0.12, FW:0.02};     // 무실점
const RT_CONC={GK:0.16, DF:0.10, MF:0.03, FW:0.00};     // 2실점째부터 한 점당
/* 「보이지 않는 기여」 — ⚠ 능력치 절대값으로 재면 안 된다. K리그1 의 실력 폭은 아주 좁고
   (측정: 평균 72.6 · 90% 75 · 최고 80) K리그2 는 넓다(평균 66.6 · 90% 72 · 최고 80).
   같은 계수를 쓰면 1부에서는 이 항이 사실상 0이 되어 베스트11 이 6점대에 머문다.
   ─ 그 리그 안에서의 <b>표준편차 기준 위치(z)</b>로 잰다. 실축 평점도 리그 안의 상대 평가다. */
const RT_QUAL_Z=0.27, RT_QUAL_LO=-0.50, RT_QUAL_HI=0.90;
const RT_RAND=0.45;                                     // 경기마다의 흔들림 (시즌 평균에는 거의 영향이 없다)
const RT_YEL=0.15, RT_RED=1.00;
/* 그 리그(부)의 실력 분포(평균·표준편차) — 클럽별 상위 18명(실제로 뛰는 인원)만 센다.
   하루에 한 번만 계산하고 캐시한다. */
let RT_MID_CACHE=null;
function rateMidOvr(div){
  try{
    const key=(G.season||0)+"|"+(G.day||0);
    if(!RT_MID_CACHE || RT_MID_CACHE.k!==key) RT_MID_CACHE={k:key, v:{}};
    const c=RT_MID_CACHE.v, d=(div|0)||1;
    if(c[d]) return c[d];
    const arr=[];
    for(const id in G.teams){
      const t=G.teams[id]; if(!t || (t.div|0)!==d || !Array.isArray(t.players)) continue;
      const top=t.players.slice().sort((a,b)=>(b.ovr||0)-(a.ovr||0)).slice(0,18);
      for(const p of top) arr.push(p.ovr||60);
    }
    if(!arr.length) return (c[d]={m:70, s:4});
    const m=arr.reduce((s,x)=>s+x,0)/arr.length;
    const s=Math.sqrt(arr.reduce((s2,x)=>s2+(x-m)*(x-m),0)/arr.length) || 4;
    return (c[d]={m, s:Math.max(1.6, s)});
  }catch(e){ return {m:70, s:4}; }
}
function ratePosK(p){
  const z=p&&p.pos;
  return z==="GK"?"GK" : z==="DF"?"DF" : z==="FW"?"FW" : "MF";
}
/* 한 경기 평점 — 두 엔진(2D·분 단위)이 같은 식을 쓴다 */
function matchRating(x, p, t, mins, gf, ga, ef, ea){
  const k=ratePosK(p);
  const w=clamp(mins/72, 0.42, 1);                       // 출전 시간 가중
  const res=(ef>ea)?RT_WIN : (ef<ea)?RT_LOSS : RT_DRAW;
  const MD=rateMidOvr(t&&t.div);
  const qual=clamp((((p.ovr||60) - MD.m)/MD.s) * RT_QUAL_Z, RT_QUAL_LO, RT_QUAL_HI);
  const cs = (ga===0) ? RT_CS[k]*w : -Math.max(0, ga-1)*RT_CONC[k]*w;
  const v = RT_BASE + RT_POS[k]
    + (res + clamp((gf-ga)*RT_GD, -RT_GD_CAP, RT_GD_CAP) + qual) * w
    + (x.goals||0)*RT_GOAL[k] + (x.assists||0)*RT_AST[k]
    + cs
    - (x.y||0)*RT_YEL - (x.red?RT_RED:0)
    + (Math.random()*2-1)*RT_RAND;
  return clamp(v, 3, 10);
}
function pickMOM(M){
  if(!M || M.opts&&M.opts.friendly) return null;
  const hWon=M.hg>M.ag, aWon=M.ag>M.hg, drew=M.hg===M.ag;
  const cands=[];
  const add=(sd, won, clean)=>{
    for(const x of (sd.list||[])){
      const mins=(x.off===null?M.min:x.off)-x.on;
      if(mins<=0) continue;
      cands.push({x, side:sd, sc:momScore(x, won, drew, clean)});
    }
  };
  add(M.h, hWon, M.ag===0);
  add(M.a, aWon, M.hg===0);
  if(!cands.length) return null;
  cands.sort((a,b)=>b.sc-a.sc);
  const top=cands[0];
  const isHome=top.side===M.h;
  M.mom={ id:top.x.p.id, name:top.x.p.name, pos:top.x.p.pos,
          team:(isHome?M.home:M.away).short, teamId:(isHome?M.home:M.away).id,
          isUser:!!(isHome?M.home:M.away).isUser,
          rating:Math.round((top.x.rating||6)*100)/100,
          goals:top.x.goals||0, assists:top.x.assists||0, sc:Math.round(top.sc*100)/100 };
  /* 선수 개인 기록 — 시즌 MOM 횟수 */
  try{
    const p=top.x.p;
    if(!p.momS || p.momS!==G.season){ p.momS=G.season; p.momN=0; }
    p.momN=(p.momN||0)+1; p.momCareer=(p.momCareer||0)+1;
  }catch(e){}
  return M.mom;
}
/* 즉석 시뮬 (AI 경기용) — 라운드당 11경기를 돌려야 하므로 항상 빠른 분 단위 엔진을 쓴다 */
function instantMatch(home, away, opts={}){
  const M=createMatch(home,away,opts);
  while(!M.done) stepMinute(M);
  applyMatchResult(M);
  return M;
}
/* 도움 인정 시간 — 이 시간 안에 들어온 패스만 도움으로 기록한다 */
const ASSIST_WINDOW=8;
/* 어떤 엔진으로 경기를 치를지. "sim"=연속 2D 매치엔진, "text"=기존 분 단위 엔진 */
function matchEngine(){ return "sim"; }   // 분 단위 엔진은 내 경기용으로는 은퇴 — AI 경기 전용이다
/* 연속 매치엔진으로 유저 경기를 끝까지 치른다 — 결과·기록·해설이 모두 M에 남는다.
   기존 stepMinute 경로와 똑같은 모양의 M을 돌려주므로 뒤쪽(순위표·평점·뉴스·라커룸)은 손댈 게 없다. */
function simMatchFull(M){
  const sim=new MatchSim(M, {live:true});
  sim.run();
  return sim;
}
