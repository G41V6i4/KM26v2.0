"use strict";
/* ═══════════════════════════════════════════════════════════════
   뉴스 / 소셜 탭
═══════════════════════════════════════════════════════════════ */
let mediaTab="news";
let newsFilter="all";
let _newsSeenAt=0;   // 이 화면을 열기 직전까지 읽은 기사 번호 — NEW 배지 기준선
function setMediaTab(k){ mediaTab=k; show("media"); }
function setNewsFilter(k){ newsFilter=k; show("media"); }
function feedUnread(){
  const L=feedList(); const seen=G.feedSeen||0;
  return L.filter(x=>x.id>seen).length;
}
function newsRow(x){
  const c=NEWS_CAT[x.cat]||NEWS_CAT.club;
  const t=x.tid?G.teams[x.tid]:null;
  const isNew = x.id>_newsSeenAt;
  const mineCls = x.tid===G.userTeamId ? " mine" : "";
  return `<div class="nwRow${mineCls}${isNew?" fresh":""}" style="--nwc:${c.c}">
    <div class="nwIc">${x.ic||c.ic}</div>
    <div class="nwBody">
      <div class="nwHead">${isNew?'<span class="nwNew">NEW</span>':""}${x.head}</div>
      ${x.sub?`<div class="nwSub">${x.sub}</div>`:""}
      <div class="nwMeta">
        <span class="nwCat" style="color:${c.c};border-color:${c.c}">${c.n}</span>
        ${t?`<span class="nwTeam" style="border-left:3px solid ${t.col}">${t.short}</span>`:""}
        <span>${x.src||""}</span>
        <span class="nwDate">${feedDate(x)}</span>
      </div>
    </div></div>`;
}
function newsTabView(){
  /* 💰 제보 — 주식·은행·부동산은 「경제」 탭이 가져갔다. 여기서는 빼고 센다. */
  const L=feedList().filter(x=>x && ECON_CATS.indexOf(x.cat)<0);
  const cats=["all","match","star","debut","streak","table","transfer","rumor","injury","manager","record","club"];
  const has=k=> k==="all" ? L.length : L.filter(x=>x.cat===k).length;
  const list=(newsFilter==="all"?L:L.filter(x=>x.cat===newsFilter)).slice(0,70);
  const chips=cats.filter(k=>k==="all"||has(k)).map(k=>{
    const c=NEWS_CAT[k];
    return `<button class="nwChip ${newsFilter===k?"on":""}" onclick="setNewsFilter('${k}')"
      ${c?`style="--nwc:${c.c}"`:""}>${k==="all"?"전체":`${c.ic} ${c.n}`} <b>${has(k)}</b></button>`;
  }).join("");
  return `<div class="card"><h3>📰 리그 뉴스 <span class="small">— K리그1 · K리그2 전체 소식이 실시간으로 들어옵니다</span></h3>
    <div class="nwChips">${chips}</div>
    ${list.length?`<div class="nwList">${list.map(newsRow).join("")}</div>`
      :`<p class="small" style="padding:14px 4px">아직 들어온 기사가 없습니다. 일정을 진행하면 리그 곳곳의 소식이 쌓입니다.</p>`}
  </div>`;
}
/* 💰 ⚠ 제보 원문 — 「뉴슽탭 소셜탭 있잖아. 여기 옆에 경제 탭 신설하고 거기로 옮기는게 낫겠다.
   그게 더 가시성이 좋지」. 증권·은행·부동산 소식을 뉴스에서 떼어 한 탭에 모은다. */
let econFilter="all";
function setEconFilter(k){ econFilter=k; show("media"); }
function econList(){ return feedList().filter(x=>x && ECON_CATS.indexOf(x.cat)>=0); }
function econTabView(){
  const L=econList();
  const cats=["all"].concat(ECON_CATS);
  const has=k=> k==="all" ? L.length : L.filter(x=>x.cat===k).length;
  const list=(econFilter==="all"?L:L.filter(x=>x.cat===econFilter)).slice(0,70);
  const chips=cats.filter(k=>k==="all"||has(k)).map(k=>{
    const c=NEWS_CAT[k];
    return `<button class="nwChip ${econFilter===k?"on":""}" onclick="setEconFilter('${k}')"
      ${c?`style="--nwc:${c.c}"`:""}>${k==="all"?"전체":`${c.ic} ${c.n}`} <b>${has(k)}</b></button>`;
  }).join("");
  return `<div class="card"><h3>💰 경제 소식 <span class="small">— 증권 계좌 · 은행 · 부동산 소식만 따로 모았습니다</span></h3>
    <div class="nwChips">${chips}</div>
    ${list.length?`<div class="nwList">${list.map(newsRow).join("")}</div>`
      :`<p class="small" style="padding:14px 4px">아직 들어온 소식이 없습니다. 주식·예금·대출·부동산에 손을 대면 이곳에 쌓입니다.</p>`}
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════════════════
   🗞️ FM코리아 루머 게시판
   제보 원문 — 「소셜탭 아래 [우리구단팬] [타구단팬] 옆에 [펨코 루머탭]을 추가하고, 펨코 유저들이
   만들어내는 루머를 만들자. 고소도 되고, 게시글 형태라 누르면 내용이 나오는 형식으로」.
   ─ 기존 펨코 카드(fmkCard)는 «한 줄짜리 반응»이다. 루머는 다르다 —
     제목 · 본문 여러 줄 · 댓글 · 조회수 · 추천, 그리고 「정ㅋ벅ㅋ」(확정) 표식까지 붙는 진짜 게시판이다.
   ─ 내용은 <b>실제 게임 상태에서 뽑는다</b>. 계약 만료가 임박한 선수, 폼이 떨어진 선수,
     연패 중인 감독, 모기업이 흔들리는 구단… 그래서 「어? 이거 진짜네」가 나온다.        */
const RUM_MAX=40;                       // 게시판에 남기는 글 수
const RUM_CONF_P=0.42;                  // 「정ㅋ벅ㅋ」 확정 표식이 붙을 확률
/* ═══ ✍️ 펨코 말투 ═══════════════════════════════════════════════════════════
   실제 게시판(fmkorea 국내축구·루머)에서 관찰한 규칙을 그대로 옮긴다.
     · 제목이 <b>극도로 짧다</b> — 이름만, 「팀 이름」만. "전남 발디" "한국영" "조규성"
       서술어도 조사도 없다. 길어질 때는 「~관련」「~ 팩트체크-」가 붙는다.
     · 띄어쓰기를 안 지킨다 — "사임할것을" "알고있었던" "영입가능성에"
     · 본문은 짧은 줄 여러 개. 줄 끝이 ".." "...." 로 흐려진다. 단정하지 않는다.
     · 출처는 「ㅊㅊ:」 로 붙인다. 없으면 없다고 적는다.
     · 비속어는 순화하지 않고 그대로 쓴다 — "ㅅㅂ" "시발련들" "씹창"
     · 댓글은 더 짧다. 물음표 앞을 띄운다("있겠지 ?"). ";;;" "...." 를 즐겨 쓴다.
     · 대댓글은 <b>상대 닉네임을 부르고</b> 한 줄로 묻거나 답한다.                */
const RUM_TAIL=["..","....","…","...",""];            // 줄 끝 흐리기
const RUM_TAIL2=[" ?"," ??"," ?;;",";;",";;;","."];   // 댓글 끝
const RT=()=>pick(RUM_TAIL);
/* 📎 ㅊㅊ(출처) — 각 줄에 «등급»을 달아둔다. 댓글이 이 등급을 보고 깐다.
     kin=아는 사람 · ins=구단 라인 · nbr=건너건너 · pro=기자/에이전트 · none=출처 없음 */
const RUM_SRC=[
  ["ㅊㅊ:아는 형","kin"],["ㅊㅊ:아는 동생","kin"],["ㅊㅊ:아는 지인","kin"],
  ["ㅊㅊ:친구 형","kin"],["ㅊㅊ:사촌 형","kin"],["ㅊㅊ:군대 선임","kin"],
  ["아는 형이 구단에 있음","kin"],["ㅊㅊ:아는 형의 아는 형","kin"],
  ["ㅊㅊ:구단 관계자 형","ins"],["ㅊㅊ:구단 관계자","ins"],["ㅊㅊ:구단 직원 썰","ins"],
  ["ㅊㅊ:프런트에 아는 사람","ins"],["ㅊㅊ:훈련장 목격담","ins"],["ㅊㅊ:선수 아버지 지인","ins"],
  ["ㅊㅊ:스카우트 쪽 형","ins"],
  ["ㅊㅊ:옆집 아저씨","nbr"],["ㅊㅊ:옆집 형","nbr"],["ㅊㅊ:건너건너 들은 내용","nbr"],
  ["ㅊㅊ:건너건너 들었음","nbr"],["ㅊㅊ:동네 형","nbr"],["ㅊㅊ:같은 회사 사람","nbr"],
  ["ㅊㅊ:택시기사님","nbr"],["ㅊㅊ:미용실에서 들음","nbr"],["ㅊㅊ:PC방에서 옆자리 대화","nbr"],
  ["ㅊㅊ:에이전트","pro"],["ㅊㅊ:기자 지인","pro"],["ㅊㅊ:기자 형","pro"],
  ["ㅊㅊ:방송국에 아는 형","pro"],
  ["ㅊㅊ 없음 그냥 들은 거","none"],["ㅊㅊ은 못 밝힘","none"],["믿거나 말거나","none"],
  ["ㅊㅊ 밝히면 그 형 짤림","none"],["ㅊㅊ 나중에 공개함","none"]];
/* 🗣️ ㅊㅊ 보고 까는 댓글 — 등급별로 까는 포인트가 다르다 */
const RUM_CM_SRC={
 kin:[["아는 형이 누군데 ㅋㅋ","doubt"],["아는 형 시리즈 또 시작이네","mock"],
   ["님 아는 형 직급이 어떻게 되심 ?","mock"],["그 아는 형 작년에도 틀렸음","doubt"],
   ["아는 형 = 나무위키","mock"],["형 동생 지인 다 나왔는데 정작 ㅊㅊ은 없네","doubt"],
   ["아는 동생이면 걔도 아는 형한테 들은거겠지 ㅋㅋ","joke"],["세상에 아는 형 참 많다","mock"],
   ["그 형 좀 데려와봐","mock"],["아는 형 라인이 의외로 잘 맞더라","believe"],
   ["아는 형 ㅊㅊ은 걸러도 됨","doubt"]],
 ins:[["구단 관계자 형이면 실명 까고 와라","angry"],["구단 관계자 형은 대체 몇명임","mock"],
   ["진짜 관계자면 이런거 커뮤에 안 흘림","doubt"],["관계자라기엔 내용이 너무 팬 시선인데","doubt"],
   ["관계자 ㅊㅊ이면 그래도 좀 무겁긴 함","believe"],["훈련장 목격담이면 사진은 ?","ask"],
   ["프런트 라인이면 이정도는 알겠지","believe"],["관계자 팔이 좀 그만해라","angry"],
   ["선수 아버지 지인 ㅋㅋㅋ 족보 길다","joke"]],
 nbr:[["건너건너면 그냥 소문이잖아 ㅋㅋ","doubt"],["옆집 아저씨가 구단 사정을 어케 암","mock"],
   ["건너건너 들은거 = 지어낸거","doubt"],["몇 다리 건넜는지부터 세보자","mock"],
   ["택시기사님 라인 ㅋㅋㅋㅋ","joke"],["동네 형이 스카우트냐","mock"],
   ["미용실 ㅊㅊ 진짜 어이없네 ㅋㅋ","joke"],["근데 이런건 뼈는 있더라","cool"],
   ["옆집 형 승진했나보네","joke"]],
 pro:[["기자 지인이면 왜 기사가 안 뜨는데","doubt"],["에이전트발은 반은 흘리는거임","cool"],
   ["기자 형은 왜 자기 기사로 안 쓰고","mock"],["에이전트가 흘린거면 이미 협상 들어간거다","believe"],
   ["방송국 라인은 좀 믿을만함","believe"],["기자 ㅊㅊ인데 이렇게 부실하다고 ?","doubt"]],
 none:[["ㅊㅊ 없으면 그냥 소설","doubt"],["못 밝히는게 아니라 없는거겠지","mock"],
   ["믿거나 말거나면 왜 씀","angry"],["ㅊㅊ 없음 = 내 상상","mock"],
   ["나중에 공개한다더니 공개한 적이 없음","doubt"],["그래도 이사람 예전에 하나 맞췄음","believe"],
   ["ㅊㅊ 밝히면 짤린다는 말은 10년째 나온다","mock"]]};
/* ═══ 🤡 게시판 상주 인물 둘 ═══════════════════════════════════════════════
   어느 게시판에나 있다. 글만 봐도 누군지 아는 사람들.
     · <b>벤투</b>  — 「우리 에이스가 하부리그 간다」만 쓴다. 비추천이 압도적이고 댓글은 욕이다.
     · <b>노루막이</b> — 스케일이 우주로 간다. PL 팀이 K리그에 편입된다는 식의 글을
       번호까지 매겨 진지하게 쓴다. 길고, 구체적이고, 완전히 말이 안 된다.
   ─ 둘 다 <b>troll</b> 표식이 붙어 고소 화면에서 「상주 악플러」로 잡힌다. */
const RUM_TROLL_NICK={bt:"벤투", nr:"노루막이"};
const RUM_LOWER=["3부 리그 팀","실업축구 팀","대학팀","동남아 2부 팀","4부 승격팀","지역 아마추어 클럽"];
function rumTrollBenthu(){
  try{
    const T=Object.values(G.teams||{}).filter(t=>t && !isArmyTeam(t));
    const t=pick(T); if(!t) return null;
    const ps=(t.players||[]).filter(p=>p.pos!=="GK").sort((a,b)=>b.ovr-a.ovr).slice(0,4);
    if(!ps.length) return null;
    const P=pick(ps), low=pick(RUM_LOWER);
    const B=[];
    B.push(`${P.name} ${low}행 유력함`+RT());
    B.push(pick([
      `본인이 먼저 원했다고 함..`,
      `구단도 잡을 생각 없다는듯..`,
      `연봉 절반 깎고 가는 조건이라고 함....`]));
    B.push(pick([
      `내 정보력은 다들 알잖아 ㅇㅇ`,
      `이번엔 진짜임 지난번이랑 다름`,
      `믿기 싫으면 말고`]));
    B.push(`ㅊㅊ: 말 못함`);
    return {ttl:pick([`${P.name} ${low}행`, `${t.short} ${P.name}`, `${P.name} 이적 관련`]),
      body:B, tid:t.id, pid:P.id, kind:"trollBt", troll:"bt", pn:P.name, tn:t.short, on:low};
  }catch(e){ return null; }
}
function rumTrollNoru(){
  try{
    const T=Object.values(G.teams||{}).filter(t=>t && !isArmyTeam(t));
    const home=pick(T); if(!home) return null;
    /* 구단과 약칭은 짝으로 뽑는다 — 따로 뽑으면 「풀럼(약칭 CRY)」 같은 게 나온다 */
    const _cl=pick([["풀럼","FU"],["에버턴","EV"],["울버햄튼","WO"],
      ["크리스탈 팰리스","CP"],["사우스햄튼","SO"],["노팅엄","NO"]]);
    const club=_cl[0], abbr=_cl[1]+"I";
    const st=(function(){ try{ const s2=stadOf(home); return s2?s2.n:`${home.short} 월드컵경기장`; }catch(e){ return `${home.short} 월드컵경기장`; } })();
    const st2=`${home.short} 아시아드주경기장`;
    const name=`${club}${home.short}FC`;
    const B=[];
    B.push(`방금 전 ${club}이 한국프로축구연맹에 공식적으로 편입 의사를 밝힘.`);
    B.push("");
    B.push(`유럽팀, 그것도 PL팀이 지구 반대편 리그로 이전을 한다는 게 축구 역사 전체적으로 봐도 초유의 사태인지라, 현지 여론을 우려한 ${club}과 연맹은 팀의 빠른 이전을 위해 운영안을 내놓았는데, 정리하자면 일단 다음과 같음.`);
    B.push("");
    B.push(`1) 편입 시 2부가 아닌 K리그1로 직행하며, 이후 1부리그는 13팀으로 운영됨`);
    B.push(`2) ${club}은 외국인 쿼터제의 제한을 받지 않음. 대신 매경기 한국인 선수 최소 2명 이상이 선발명단에 포함되어야 함.`);
    B.push(`3) 국내 홈경기장에서 12경기, 중립구장에서 12경기, 원정에서 12경기를 치르게 되는데, 로빈 1에서 홈경기, 로빈 2에서 원정경기, 로빈 3에서 중립경기를 치름. (지난번에 팀을 통째로 옮기는건 아니라고 했었지? 그게 이걸 말하는 거였음)`);
    B.push(`4) 유스 체계는 기존 그대로 잉글랜드 현지에서 운영함.`);
    B.push(`5) (아직 확정된 건 아님) 팀 명칭은 ${name} (${club} ${home.short} FC, 약칭 ${abbr})일 예정`);
    B.push("");
    B.push(`전술했듯이, 홈구장은 빠른 출입국을 위해 ${home.short}에 마련하기로 함. 현재`);
    B.push(`1.     ${st}`);
    B.push(`2.     ${st2}`);
    B.push(`이 후보로 올라있고, 둘 다 전면적인 리모델링 후 사용할 예정.`);
    B.push("");
    B.push(`중립구장은 사우디아라비아 아브하에 위치한 프린스 술탄 빈 압둘 아지즈 스타디움을 이용할 예정.`);
    B.push(`구단주는 애초에 아시아 시장을 위해 연고를 사우디로 이전하고, 사우디 리그로 편입할 계획이었는데, 지난번 말했던 국내 대기업과의 계약으로 인해 K리그 편입으로 계획을 바꾼 듯 함.`);
    B.push("");
    B.push(`국내 선수 영입은 현재 아겜 멤버 공미가 1순위. 얼마전 언급됐던, 이 선수에 관심있다던 잉글랜드 팀이 ${club}인듯함.`);
    B.push(`그 외에는, 일단 공격수 위주로 영입할 계획.`);
    B.push("");
    B.push(`현재 연고 이전에 관해서는 ${club} 수뇌부, 프로축구연맹 극히 일부만이 알고 있음.`);
    B.push("");
    B.push(`ㅊㅊ: ㅇㄱㅇㅈ`);
    B.push("");
    B.push(`일단 내가 알기론 여기까지. 가장 궁금했던건, 도대체 왜 갑자기 국외, 그것도 지구 반대편으로의 연고 이전을 선택했냐는 건데, 아직 이부분에 대해서는 아는 바가 없음. 추가적으로 정보 나오면 바로바로 올려볼게ㅇㅇ`);
    return {ttl:pick([`${club} K리그 편입 관련`, `${club} 연고이전 후속`, `${club} 관련 정리`,
      `${club} K리그 편입 (운영안 포함)`]), body:B, tid:home.id, pid:null, kind:"trollNr", troll:"nr",
      pn:club, tn:home.short, on:club};
  }catch(e){ return null; }
}
/* ═══ 🏷️ 탭 잘못 단 글 ═══════════════════════════════════════════════════════
   루머탭에 루머가 아닌 글(점심 뭐먹지, 일상 잡담)을 올리면 게시판이 가만두지 않는다.
   비추를 우수수 맞고, 댓글에는 「ㅌ」 「탭 확인」 이 <b>쫘르륵</b> 달린다.
   ─ 「이거 루머맞다」는 비꼬는 말이고, 「아 포가 아깝다」는 잘못 누른 추천이 아깝다는 뜻이다. */
const RUM_OFF=[
  {t:"점심 뭐먹지", b:["회사 근처에 먹을게 없음..","추천좀"]},
  {t:"응가 마려움", b:["회의 30분 남았는데","어떡함"]},
  {t:"오늘 날씨 뭐냐", b:["아침에 나올땐 시원했는데","지금 미쳤음"]},
  {t:"주말에 뭐하지", b:["경기도 없고","심심함"]},
  {t:"직장인 여러분 힘내세요", b:["월요일이 제일 힘든듯","다들 파이팅"]},
  {t:"이 노래 아는사람", b:["예전에 경기장에서 들었던건데","제목이 기억이 안남"]},
  {t:"치킨 뭐가 제일 맛있음", b:["오늘 시켜먹으려는데","골라줘"]},
  {t:"라면 맛있게 끓이는법", b:["물 조절이 제일 어려움","스프 먼저 넣는게 맞음 ?"]},
  {t:"자기 전에 한마디", b:["다들 잘자라","내일 봅시다"]},
  {t:"운동 시작했는데", b:["3일차인데 벌써 힘듬","다들 얼마나 하심"]},
  {t:"차 뽑았다", b:["10년 탄 차 보내고 새로 뽑음","기분 좋아서 자랑함"]},
  {t:"고양이 자랑", b:["우리집 고양이 좀 봐라","귀엽지"]}];
/* 「탭 확인해라」 댓글 — 실제 게시판처럼 짧고 많이 달린다 */
const RUM_CM_TAB=[
  "ㅌ","ㅌㅌ","ㅌㅌㅌ","ㅌ;;","ㅌ 좀","탭","탭탭","탭 확인","탭 확인좀해라","탭 확인 좀",
  "ㅉㅉ","이거 루머맞다","이거 루머맞음","루머네 ㅋㅋ","얼른 탭 고치셈","아 포가 아깝다",
  "여기 루머탭임","이게 왜 루머탭에 있음","탭 옮겨라","방출 눌렀다","ㅌ ㅌ ㅌ",
  "루머 아니면 나가라","ㅌ 안보이냐","포 아깝게 진짜","자유게시판 어디갔냐","ㅌ 좀 봐주세요"];
const RUM_CM_TAB_RE=[
  ["ㅈㅅ 바로 옮길게요","op"],["아 몰랐음 미안","op"],["이건 좀 심한거 아님 ?","op"],
  ["ㅌ","x"],["ㅋㅋㅋㅋㅋ 벌써 20개 달렸네","x"],["글쓴이 도망감","x"],
  ["옮기면 되는걸 왜 버티냐","x"],["그래도 답글은 다네 ㅋㅋ","x"],["ㅌ 아니고 그냥 지워라","x"]];
function rumOffTopic(){
  try{
    const T=Object.values(G.teams||{}).filter(t=>t && !isArmyTeam(t));
    const t=pick(T); if(!t) return null;
    const o=pick(RUM_OFF);
    return {ttl:o.t, body:o.b.slice(), tid:t.id, pid:null, kind:"offtopic", off:1,
            pn:"", tn:t.short, on:t.short};
  }catch(e){ return null; }
}
/* 댓글 — 이 둘의 글에는 결이 완전히 다른 반응이 달린다 */
const RUM_CM_BT=[
  ["또 벤투냐 ㅋㅋㅋㅋㅋ",42],["지랄하네 ㅄ아",67],["이 새끼 또 시작이네",38],
  ["니가 하부리그 가라",55],["ㅅㅂ 진짜 이런 글로 게시판 더럽히지 마라",44],
  ["작년에 니가 판 선수 지금 우리팀 주전이다",29],["ㅄ 인증 또 하네",33],
  ["차단 좀 하자 진짜",27],["글 이력 봐라 100% 헛소리임",31],
  ["이런거 올릴 시간에 경기나 봐라",19],["또 낚였네 ㅋㅋ 내가 진짜 ㅄ이지",24],
  ["운영자 이 사람 좀 어떻게 해봐라",22],["벤투 = 반대로 하면 맞음 ㅇㅇ",48]];
const RUM_CM_NR=[
  ["ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ 뭐라는거야",71],["지랄하네 ㅄ",63],
  ["PL팀이 왜 한국을 와 ㅄ아",58],["이새끼 병원 가봐라 진심으로",49],
  ["중립구장이 사우디 ㅋㅋㅋㅋㅋㅋㅋ 아 배아파",66],["소설 쓰는 정성은 인정한다",41],
  ["약을 하셨네요",37],["3번 읽었는데 진짜 진지해서 더 웃김",52],
  ["ㅊㅊ: ㅇㄱㅇㅈ ← 이게 킬포",59],["작년엔 레알이 부산 온다고 했었지",44],
  ["노루막이 시리즈 언제 완결남 ?",33],["이걸 진심으로 쓴 거면 더 무섭다",39],
  ["이새끼 그만해 제발",28],["이 정도면 재능임 인정",26]];
function rumList(){ if(!Array.isArray(G.rum)) G.rum=[]; return G.rum; }
function rumById(id){ return rumList().find(x=>x.id===id)||null; }
/* 제목·본문 만들기 — 종류마다 재료가 다르다 */
/* 🔄 살아 있는 이름 — 게시판 글은 «이름»이 아니라 «누구인지»를 저장한다.
     예전엔 글을 만드는 순간의 이름을 문자열로 박아 넣어서, 에디터에서 구단명·선수명·
     감독명을 바꿔도 옛 글에는 옛 이름이 그대로 남았다.
   ─ 이제 글·본문·댓글의 이름 자리에 표식(⟦종류|번호⟧)을 넣고, 화면에 그릴 때마다 푼다.
     종류: p=선수 · t=구단 약칭 · tn=구단 정식명 · m=감독 · ow=모기업 */
function rumPlayerById(id){
  try{
    if(id==null) return null;
    for(const t of Object.values(G.teams||{})){
      const q=(t.players||[]).find(x=>x&&x.id===id); if(q) return q;
    }
    for(const src of [G.fa, G.retired, G.osPool]){
      if(Array.isArray(src)){ const q=src.find(x=>x&&x.id===id); if(q) return q; }
    }
  }catch(e){}
  return null;
}
function rumMgrName(t){
  try{ const v=(typeof mgrName==="function")?mgrName(t):null;
    return (!v||/감독님/.test(v)) ? `${t.short} 감독` : v; }catch(e){ return `${t?t.short:""} 감독`; }
}
function rumFill(str){
  const S0=String(str==null?"":str);
  const FJ=(z)=>{ try{ return (typeof fixJosa==="function")?fixJosa(z):z; }catch(e){ return z; } };
  if(S0.indexOf("⟦")<0) return FJ(S0);
  const S=S0;
  return FJ(S.replace(/⟦([a-z]{1,2})\|([^⟧]*)⟧/g, (m,k,id)=>{
    try{
      if(k==="p"){ const q=rumPlayerById(isNaN(+id)?id:+id); return q?q.name:m.slice(0,0)||"그 선수"; }
      const t=(G.teams||{})[id];
      if(!t) return "그 구단";
      if(k==="t")  return t.short;
      if(k==="tn") return t.name;
      if(k==="m")  return rumMgrName(t);
      if(k==="ow") return (typeof clubType==="function")?clubType(t).o:t.name;
    }catch(e){}
    return "";
  }));
}
/* 만들어진 문장에서 «지금 이름»을 찾아 표식으로 바꾼다. 긴 이름부터 — 약칭이 정식명을 갉아먹지 않게 */
function rumTokenize(str, reg){
  let S=String(str==null?"":str);
  for(const [lit, tok] of reg){
    if(!lit || lit.length<2) continue;
    S=S.split(lit).join(tok);
  }
  return S;
}
/* 문장에 나올 수 있는 이름 목록 — 긴 것부터 (약칭이 정식명을 갉아먹지 않게) */
function rumReg(t, other){
  const R=[];
  const add=(lit,tok)=>{ if(lit && String(lit).length>=2) R.push([String(lit), tok]); };
  try{
    for(const x of Object.values(G.teams||{})){
      if(!x) continue;
      add(x.name, `⟦tn|${x.id}⟧`);
      add(x.short, `⟦t|${x.id}⟧`);
      add(rumMgrName(x), `⟦m|${x.id}⟧`);
      try{ add(clubType(x).o, `⟦ow|${x.id}⟧`); }catch(e){}
    }
    /* 글에 등장할 수 있는 선수는 이 두 팀 안에 있다 */
    for(const x of [t, other]){
      for(const q of ((x&&x.players)||[])) add(q&&q.name, `⟦p|${q.id}⟧`);
    }
  }catch(e){}
  R.sort((a,b)=>b[0].length-a[0].length);
  return R;
}
function rumMake(){
  try{
    const T=Object.values(G.teams||{}).filter(t=>t && !isArmyTeam(t));
    if(!T.length) return null;
    const ut=userTeam();
    /* 🎲 ⚠ 제보 — 「포텐 루머글은 타구단 가릴 것 없이 다양하게 나와야 한다」.
       예전에는 45% 가 내 팀 글이라 게시판이 우리 구단 이야기로만 도배됐다. */
    const pickT=()=> (Math.random()<0.18 && ut && !G.jobless) ? ut : pick(T);
    const t=pickT(); if(!t) return null;
    const ps=(t.players||[]).filter(p=>p && p.pos!=="GK");
    const P=ps.length?pick(ps):null;
    const kinds=[];
    if(P) kinds.push("move","renew","form","injury","bus","bus");   // 🚌 목격담은 자주 올라온다
    if(T.length>=3) kinds.push("saga");   // 📖 대사까지 있는 장문 소설
    if(P && P.frn) kinds.push("frnOut");
    if((t.form||[]).slice(-3).join("")==="LLL") kinds.push("sack");
    if(clubType(t).k==="corp" && typeof ownHealth==="function" && ownHealth(t)<0.9) kinds.push("owner");
    kinds.push("stad","board");
    /* 💢 불화 — 게시판이 제일 좋아하는 소재다. 재료가 있을 때만 올라온다. */
    const _unh=ps.filter(x=>(x.unhappy||0)>0 || (x.sulk||0)>0 || (typeof aff==="function" && aff(x)<=35));
    const _low=ps.filter(x=>(x.morale||70)<58);
    if(ps.length>=2) kinds.push("feudPP");
    if(_unh.length || _low.length) { kinds.push("feudPM"); kinds.push("feudPP"); }
    if((G.trust&&G.trust.owner!=null?G.trust.owner:60) < 55) kinds.push("feudFO");
    if(T.length>=2) kinds.push("feudMM");
    /* 🗓️ 시기가 게시판의 화제를 정한다 — 겨울엔 이적시장, 시즌 중엔 목격담·폼·부상 */
    const _wh=rumWhen();
    if(_wh==="stove"){
      if(P) kinds.push("market","market","market","market","move","move","renew","renew");
      kinds.push("sack","board");
    } else if(_wh==="summer"){
      if(P) kinds.push("market","market","market","move","move","renew","injury");
    } else if(_wh==="pre"){
      if(P) kinds.push("market","market","form","form","renew");
      kinds.push("stad","board");
    } else {
      if(P) kinds.push("bus","bus","bus","form","form","injury","injury");
      kinds.push("stad");
    }
    const k=pick(kinds);
    const other=pick(T.filter(x=>x.id!==t.id))||t;
    const pn=P?P.name:"", tn=t.short, on=other.short;
    const _mn=(x)=>{ try{ const v=(typeof mgrName==="function")?mgrName(x):null;
      return (!v||/감독님/.test(v)) ? `${x.short} 감독` : v; }catch(e){ return `${x.short} 감독`; } };
    const B=[];
    let ttl="", _hit=0, _saga=0;   // 🚌 목격담 적중 여부 · 📖 소설 표식
    /* 제목은 세 갈래로 짧게 — 이름만 / 팀+이름 / ~관련 */
    /* 제목 조합 — 실제 게시판은 「팀+이름」이 가장 흔하고, 포지션이나 「베테랑」 같은
       수식을 앞에 붙이기도 한다. 이름만 던지는 것도 물론 있다. */
    const POSN={DF:"센터백", MF:"미드필더", FW:"공격수", GK:"골키퍼"};
    const age0=(x)=>(G.season||2026)-((x&&x.by)||2000);
    const deco=(x)=>{ if(!x) return "";
      const r2=Math.random();
      if(r2<0.30) return (POSN[x.pos]||"")+" ";
      if(r2<0.42 && age0(x)>=33) return "베테랑 ";
      if(r2<0.52 && x.frn) return "용병 ";
      return ""; };
    const T3=(a,b2)=>{ const r=Math.random(), d=deco(P);
      return r<0.18 ? a
           : r<0.58 ? `${tn} ${d}${a}`
           : r<0.78 ? `${d}${a}`
           : `${tn} ${a} ${b2||"관련"}`; };
    if(k==="move"){
      ttl=T3(pn, `${on}행`);
      B.push(`${on} 쪽에서 먼저 찔러봤다고 함`+RT());
      B.push(`${pn} 본인도 나쁘지않게 보고있다는듯`+RT());
      if(Math.random()<0.5) B.push(`이적료는 생각보다 안된다는 얘기가`+RT());
      B.push(`ㅅㅂ ${tn} 이거 막아야되는데`+RT());
    } else if(k==="renew"){
      ttl=T3(pn, "재계약");
      B.push(`재계약 안 할 확률 높음`+RT());
      B.push(`${pn} 연봉으로 용병 2명 영입가능성에 둠`+RT());
      B.push(`ㅅㅂ ${tn} 망하겠네${pick(["...",".."])}${tn}팬들 유니폼&굿즈 많이 사자`+RT());
    } else if(k==="form"){
      ttl=pick([`${pn} 요즘 왜저럼`, `${tn} ${pn}`, `${tn} ${pn} 근황`, `${pn} 폼 관련`, `${tn} ${pn} 왜저럼`]);
      B.push(`훈련장 분위기 안좋다는 얘기 돌음`+RT());
      B.push(`코칭스탭이랑 뭐가 좀 있는듯`+RT());
      if(Math.random()<0.45) B.push(`본인은 아무말 안하고 있다고 함`+RT());
    } else if(k==="injury"){
      ttl=pick([`${pn} 몸상태`, `${tn} ${pn}`, `${tn} ${pn} 부상 관련`, `${pn} ${on}전 결장 관련`]);
      B.push(`생각보다 심각하다는 말이있음`+RT());
      B.push(`구단은 쉬쉬하는중`+pick([".."," ㅋㅋ",""])+` 발표보다 길어질듯`+RT());
      if(Math.random()<0.4) B.push(`${on}전에는 못나온다고 보면 됨`+RT());
    } else if(k==="frnOut"){
      ttl=T3(pn, "방출설");
      B.push(`용병 정리 들어간다는 말 나옴`+RT());
      B.push(`대체자 이미 보고있다고 함 ㅇㅇ`);
      B.push(`${pn} 에이전트가 다른리그 알아보는중이라는 썰`+RT());
    } else if(k==="sack"){
      const mn=_mn(t);
      ttl=pick([`${mn} 사임관련 팩트체크-`, `${tn} 감독 관련`, `${mn}`,
        `${mn}이 이미 사임할것을 혼자 알고있었던 프런트`]);
      B.push(`이미 내부적으로는 정리된 분위기라고 함`+RT());
      B.push(`후임 후보도 두명정도 추려놨다는 얘기가`+RT());
      B.push(`발표만 남았다는게 중론`+RT());
    } else if(k==="owner"){
      const ct=clubType(t);
      ttl=pick([`${tn} 모기업 관련`, `${ct.o}`, `${tn}`]);
      B.push(`${ct.o} 쪽 사정이 진짜 안좋다고 함`+RT());
      B.push(`내년예산 얘기 나오는데 분위기 싸하다는듯`+RT());
      B.push(`ㅅㅂ 이거 구단까지 오는거 아니냐`+RT());
    } else if(k==="market"){
      /* 💸 이적시장 루머 — 실명을 안 쓰고 «두루뭉술하게» 부른다. 신뢰도는 랜덤 */
      const vFrom=rumVague(t), vTo=rumVague(other);
      const A=pick([pn, `${pn}`, `${tn} ${pn}`, `${vFrom} ${pn}`]);
      ttl=pick([
        `${vFrom} 선수 ${pn}${(typeof hasJong==="function"&&hasJong(pn.slice(-1)))?"이":""} ${vTo}에 갈 예정!`,
        `${vFrom} 주전 ${vTo}행 임박`,
        `${pn} ${vTo}행 유력하다는데`,
        `${vFrom} 핵심자원 ${vTo}으로/로 간다는 얘기`,
        `[속보] ${vFrom} → ${vTo} 딜 진행중`,
        `${vTo}, ${vFrom}에서 ${pn} 노린다`,
        `${pn} 이적 관련 (${vTo})`]);
      B.push(pick([`${vFrom} ${pn}${(typeof hasJong==="function"&&hasJong(pn.slice(-1)))?"이":"가"} ${vTo}에 갈 예정임`,
        `${vTo}에서 ${pn} 데려가려고 사람 보냈다고 함`,
        `${vFrom}쪽에서 이미 대체자 알아보는중이라는 얘기`,
        `${pn} 에이전트가 ${vTo}과/와 얘기하고 있다는듯`])+RT());
      B.push(pick([`이적료는 생각보다 안 크다고 함`,`연봉 두배 부른다는 말 있음`,
        `구단끼리는 거의 합의됐고 본인 결정만 남음`,`메디컬 얘기까지 나왔다는듯`,
        `아직 오퍼 단계고 확정은 아님`])+RT());
      if(Math.random()<0.5) B.push(pick([`${vFrom} 팬들은 아직 모르는듯`,
        `이 바닥에서 이정도 진행되면 거의 되는거임`,
        `발표는 다음주쯤 나올거라고 함`,`반대급부로 선수 한명 내려온다는 얘기도`])+RT());
      _hit=(Math.random()<0.5)?1:0;
    } else if(k==="saga"){
      /* 📖 「~썰」 — 대사가 통째로 들어간 장문. 아무도 안 믿지만 다들 끝까지 읽는다.
         ㅊㅊ 자리에 「뇌피셜」이라고 스스로 적어놓는 게 이 장르의 핵심이다 */
      const o2t=pick(T.filter(x=>x.id!==t.id&&x.id!==other.id))||other;
      const mA=_mn(t), mB=_mn(other), mC=_mn(o2t);
      const fr=pick([`${on} 프런트`, `${on} 관계자`, `${on} 사무국`]);
      const V=pick([0,1,2]);
      if(V===0){
        ttl=pick([`${mB} ${tn}행 썰`, `${mB} ${tn}행 관련 썰 하나`, `${mB} ${tn} 간다는 썰`]);
        B.push(`지난 라운드 결과가 ${pick(["무승부로","패배로","졸전으로","역전패로"])} 끝나고,`,"");
        B.push(`${mA}에 대해 의문을 품은 ${fr}는`,"");
        B.push(`${mB}에게 가장 먼저 접촉함.`,"");
        B.push(`무려 K리그에서 탑급 대우해주는 조건이었음.`,"");
        B.push(`하지만, ${mB}는 '단호' 하게 거절`,"");
        B.push(`당황한 ${on} 관계자.`,"");
        B.push(`이유를 묻자,`,"");
        B.push(`'이미 갈 팀을 정했습니다.'`,"");
        B.push(`${on} 관계자는 그것이 ${o2t.short}${(typeof hasJong==="function"&&hasJong(o2t.short.slice(-1)))?"이":""}냐며 다시 묻자,`,"");
        B.push(`'아뇨, K리그 최고의 명문 ${t.name||tn}입니다.'`,"");
        B.push(`라고 대답했다고 함`,"");
        B.push(`${on} 관계자는 학을 떼며 딜을 파토냄`,"","");
      } else if(V===1){
        ttl=pick([`${pn||tn} 이적 썰 하나 풀어봄`, `${tn} ${pn} 관련 썰`, `${pn} 잔류 썰`]);
        B.push(`이번 겨울에 ${on}에서 사람이 왔었다고 함.`,"");
        B.push(`조건은 지금 연봉의 세 배.`,"");
        B.push(`${pn}은/는 말없이 창밖만 봤다고 함.`,"");
        B.push(`관계자가 조심스럽게 물었음.`,"");
        B.push(`'왜 망설이십니까.'`,"");
        B.push(`${pn}이/가 대답하길,`,"");
        B.push(`'저는 여기서 데뷔했습니다.'`,"");
        B.push(`'그리고 여기서 끝낼 생각입니다.'`,"");
        B.push(`${on} 관계자는 아무말도 못하고 돌아갔다고 함`,"");
        B.push(`그날 ${tn} 훈련장 불은 새벽 두시까지 꺼지지 않았다고 함`,"","");
      } else {
        ttl=pick([`${tn} 프런트 내부 썰`, `${tn} 사무국에서 있었던 일 썰`, `${tn} 회의실 썰`]);
        B.push(`지난주 ${tn} 회의실.`,"");
        B.push(`예산안을 본 ${mA}의 표정이 굳었다고 함.`,"");
        B.push(`'이걸로 뭘 하라는 겁니까.'`,"");
        B.push(`사무국장은 조용히 서류를 덮으며 말했음.`,"");
        B.push(`'감독님, 저희도 최선입니다.'`,"");
        B.push(`${mA}은/는 자리에서 일어나며 딱 한마디 했다고 함.`,"");
        B.push(`'그럼 저도 최선을 다하겠습니다.'`,"");
        B.push(`다음날 훈련량이 두 배가 됐다고 함`,"");
        B.push(`선수들은 아직도 그 회의가 무슨 회의였는지 모른다고 함`,"","");
      }
      B.push(`출처: ${pick(["지인에게서 건너건너 얼핏들은 뇌피셜","건너건너 들은 뇌피셜","아는 형에게 들은 뇌피셜","그냥 제 뇌피셜입니다","꿈에서 봄"])}`);
      _saga=1;
    } else if(k==="bus"){
      /* 🚌 목격담 — 「버스에 안 탔다」. 맞을 때도 있고 틀릴 때도 있다.
         hit 이 붙은 글은 나중에 댓글로 «맞았다»가, 아니면 «선발 나왔는데요 ㅋㅋ» 가 달린다 */
      ttl=pick([`${tn} 오늘 원정버스에 ${pn} 안탔음`, `${pn} 오늘 선발 빠질듯`,
        `${tn} ${on}전 라인업 관련`, `방금 ${tn} 버스 봤는데`, `${tn} ${pn} 오늘 못나올듯`,
        `${pn} 버스 안탄거 맞음 ?`]);
      B.push(pick([`방금 호텔앞에서 버스 봤는데 ${pn} 안탐`,
        `짐 싣는거 세봤는데 한명 비더라 ${pn} 없었음`,
        `아까 공항에서 ${tn} 선수단 봤는데 ${pn} 안보였음`,
        `버스 옆에서 담배피다가 봤는데 ${pn} 진짜 없었다`])+RT());
      B.push(pick([`${pn} 따로 승용차로 이동했다는 얘기도 있음`,
        `훈련장에서 혼자 러닝만 하고 있었다고 함`,
        `어제 훈련도 통으로 빠졌다는 말 있음`,
        `그냥 늦게 합류한걸수도 있는데 일단 씀`])+RT());
      if(Math.random()<0.5) B.push(pick([`선발 명단에서 빠졌다고 보는게 맞을듯`,
        `${on}전 못나온다고 보면 됨`, `로테일수도 있는데 느낌이 안좋다`])+RT());
      _hit=(Math.random()<0.5)?1:0;
    } else if(k==="stad"){
      ttl=pick([`${tn} ${on} 경기 경기장 관련`, `${tn} 잔디`, `${tn} 홈경기 관련`]);
      B.push(`잔디상태 진짜 심각하다는 제보 있음`+RT());
      B.push(`연맹에서도 한번 본다는 얘기 돌음`+RT());
    } else if(k==="feudPP"){
      const cand=(_unh.length?_unh:_low.length?_low:ps);
      const a1=pick(cand), a2=pick(ps.filter(x=>x!==a1))||a1;
      ttl=pick([`${tn} ${a1.name} ${a2.name}`, `${a1.name} ${a2.name}`, `${tn} 라커룸 관련`]);
      B.push(`둘이 사이 안좋다는 얘기 계속 나옴`+RT());
      B.push(`지난경기 끝나고 라커룸에서 한번 붙었다는 썰`+RT());
      B.push(`${a1.name} 쪽이 먼저 뭐라했다는데 확실친 않음`+RT());
      B.push(`ㅅㅂ 이런건 성적으로 덮어야되는데`+RT());
    } else if(k==="feudPM"){
      const a1=pick(_unh.length?_unh:(_low.length?_low:ps));
      ttl=pick([`${tn} ${a1.name} 감독이랑`, `${tn} ${a1.name}`, `${tn} 감독 ${a1.name} 관련`,
        `${a1.name} 감독 관련`]);
      B.push(`감독이랑 틀어졌다는 말이 돌음`+RT());
      B.push(`요즘 훈련에서도 따로 노는게 보인다고`+RT());
      B.push(`${a1.name} 측에서 겨울에 정리 원한다는 얘기까지 나옴`+RT());
      B.push(`구단은 부인중이긴 한데 글쎄`+RT());
    } else if(k==="feudMM"){
      const o2=other, n1=_mn(t), n2=_mn(o2);
      ttl=pick([`${n1} ${n2} 사이 관련`, `${n1} ${n2}`, `${tn} ${o2.short} 감독들`]);
      B.push(`둘이 예전부터 안좋았다는건 아는사람은 다 앎`);
      B.push(`지난번 ${tn} ${o2.short} 경기 끝나고 악수도 안했다던데`+RT());
      B.push(`기자회견에서 서로 돌려까기 한것도 그래서임`+RT());
      B.push(`다음 맞대결 벌써 기대된다 ㅋㅋ`);
    } else if(k==="feudFO"){
      const ct2=clubType(t);
      ttl=pick([`${tn} 감독 프런트 갈등`, `${tn} 후런트 관련`, `${tn} 프런트`]);
      /* 「사무국랑」이 나오지 않게 조사 마커를 쓴다 (fixJosa 가 과/와 를 받침에 맞춰 바꾼다) */
      B.push(`감독이랑 ${ct2.k==="corp"?"이사회":"사무국"}과/와 완전히 틀어졌다고 함`+RT());
      B.push(`영입요청 계속 반려됐다는 얘기가 있음`+RT());
      B.push(`감독이 공개적으로 말 못하고있는거지 속으로는 터지기 직전이라는듯`+RT());
      B.push(`이정도면 시즌끝나고 갈라서는 각 아님`+pick([" ?","?",""]));
    } else {
      ttl=pick([`${tn} 프런트 관련`, `${tn}`, `오늘도 ${tn}은 다이나믹 합니다`]);
      B.push(`위에서 방향 정리중이라는 얘기가 있음`+RT());
      B.push(`이번겨울에 크게 한번 움직인다는듯`+RT());
    }
    const _sc=pick(RUM_SRC); if(!_saga) B.push(_sc[0]);   // 📎 ㅊㅊ 한 줄 — 소설은 스스로 「뇌피셜」이라 적는다
    /* 🔄 이름을 표식으로 — 여기서 굳히지 않아야 에디터에서 바꾼 이름이 옛 글에도 즉시 반영된다.
       조사(이/가·은/는)도 표식 상태로 남겨 두고, 화면에 그릴 때 이름을 채운 뒤에 푼다.
       그래야 「울산이」가 「대구가」로 바뀔 때 조사까지 따라간다. */
    const REG=rumReg(t, other);
    const TZ=(z)=>rumTokenize(z, REG);
    return {ttl:TZ(ttl), body:B.map(TZ), tid:t.id, pid:P?P.id:null, kind:k,
      src:(_saga?"none":_sc[1]), hit:_hit, saga:_saga,
      pn:(P?`⟦p|${P.id}⟧`:""), tn:`⟦t|${t.id}⟧`, on:`⟦t|${other.id}⟧`};
  }catch(e){ return null; }
}
/* ═══ 💬 댓글 — 글을 «읽고» 다는 댓글, 그리고 그 댓글에 «대답하는» 대댓글 ═══════
   ⚠ 제보 — 「댓글이 게시글과 동떨어진 얘기가 많고, 대댓글도 서로 안 맞는다」. 맞다.
      예전 구조는 ① 공용 문장 풀에서 뽑고 ② 대댓글도 별개 풀에서 뽑았다.
      부상 글에 「재계약 안 할 확률」 소리가 달리고, "ㅊㅊ 어디임?" 밑에 "ㅇㅈ" 이 붙었다.
   ─ 두 축으로 다시 짠다.
       ① <b>글의 종류마다 댓글 풀이 따로다</b> — 이적설·부상·재계약·불화가 각각 다른 말을 한다.
          문장에는 선수·구단 이름이 들어간다({p} {t} {o}).
       ② <b>모든 댓글에 「입장(stance)」이 붙는다</b> — 의심·확신·걱정·분노·농담·정보·질문.
          대댓글은 <b>부모의 입장을 보고</b> 고른다. 의심에는 출처를 대거나 같이 의심하고,
          확신에는 동조하거나 찬물을 끼얹는다. 그 대댓글에도 입장이 있어 다음 대댓글이 이어진다.
       ③ 입장이 부딪히면(확신↔의심, 분노↔진정) 그 자리에서 <b>싸움으로 번진다</b>.
     그래서 댓글창이 「각자 혼잣말」이 아니라 「대화」가 된다.                        */
const RUM_CM_KIND={
 bus:[["몇시쯤 봤음 ?","ask"],["사진은 없음 ?","ask"],["버스에 없었다고 결장 확정은 아니지","doubt"],
   ["따로 이동하는 경우도 종종 있음","cool"],["ㅅㅂ {p} 빠지면 오늘 어렵다","worry"],
   ["{p} 어제 훈련도 안했다던데","info"],["이거 맞으면 진짜 대박","believe"],
   ["버스 목격담은 반은 맞더라","cool"],["이분 눈 좋으시네 ㅋㅋ","joke"],
   ["{t} 오늘 로테 돌린다는 얘기 있었음","info"],["라인업 뜨면 알겠지","cool"],
   ["또 버스 얘기 ㅋㅋ 이 게시판 특징","joke"],["{p} 없으면 {o}전 힘든데","worry"],
   ["몇명 탔는지 세는 사람 실화냐 ㅋㅋㅋ","joke"],["아프면 미리 좀 알려주지","angry"],
   ["작년에도 버스글 하나 맞췄었음","believe"]],
 market:[["ㅊㅊ 어디임","ask"],["지방구단 지방구단 하지말고 이름을 쓰라고 ㅋㅋ","mock"],
   ["팀 이름 안 쓰는거 보니 뻔하다","doubt"],["이런식이면 29팀 다 해당됨","mock"],
   ["또 기업구단이 빨아가네 ㅅㅂ","angry"],["돈으로 사는거 이제 지겹다","angry"],
   ["{p} 이 정도면 갈만하지","cool"],["보내줄 때 됐다 잘 가라","cool"],
   ["이적료나 제대로 받아라 제발","cool"],["대체자 없이 보내면 진짜 답없음","worry"],
   ["시민구단은 매번 이런식임 ㅋㅋ","angry"],["선수 커리어 생각하면 맞는 선택","cool"],
   ["이거 뜬 지 3일째인데 아직 발표 없음","doubt"],["겨울마다 나오는 레퍼토리","doubt"],
   ["오퍼 온거랑 가는거랑은 다름","cool"],["에이전트가 값 올리려고 흘린듯","info"],
   ["{t} 팬인데 솔직히 잡을 명분이 없다","cool"],["연봉 두배면 나라도 감","joke"],
   ["수도권 가면 관중은 확실히 늘지","info"],["이번 시장 왜이렇게 시끄럽냐","cool"],
   ["메디컬까지 나왔으면 거의 확정 아님 ?","believe"],["발표 나기 전엔 아무것도 아님","doubt"],
   ["우리팀 얘기 아니길 빌면서 들어옴","joke"],["결국 또 우리팀이었음 ㅅㅂ","angry"],
   ["{o}행이면 벤치 각인데","worry"],["이 이적 되면 다음 시장 판 다 흔들림","info"]],
 wild:[["아 그 사건 ㅋㅋㅋㅋㅋ 아직도 회자되네","joke"],["그때 생중계로 봤는데 진짜 미친줄","joke"],
   ["이걸 후일담까지 파는거 ㅋㅋ","joke"],["솔직히 그때 통쾌하긴 했음","agree"],
   ["아무리 그래도 선은 넘었지","cool"],["우리 감독 진짜 대단하다 ㅋㅋㅋ","joke"],
   ["이런 감독 밑에서 선수들 어떻게 뛰냐","worry"],["레전드 짤 아직도 돌아다님","joke"],
   ["그날 이후로 팬 떨어져나간거 맞음","worry"],["뒷얘기가 더 웃기네 ㅋㅋㅋ","joke"],
   ["구단 이미지 생각은 좀 하자","angry"],["근데 성적만 내면 다 용서됨 ㅋㅋ","joke"],
   ["이거 다큐로 만들어야함","joke"],["당사자들 심정이 어땠을까","cool"],
   ["징계 끝나고도 계속 회자되는게 더 문제","cool"],["난 그날 이후로 팬됨 ㅋㅋ","joke"],
   ["ㅋㅋㅋㅋㅋ 저걸 실제로 함","joke"],["후일담 더 없냐 더 풀어봐","ask"],
   ["당사자 아니면 알수 없는 얘기 같긴 한데","believe"],["ㅊㅊ 없으면 그냥 창작 아님 ?","doubt"],
   ["이런거 쓰면 구단에서 연락 안오냐","worry"],["연맹에서 이거 보면 또 시끄러워짐","worry"],
   ["그때 현장에 있었는데 저것보다 더했음","believe"],["다음 사건 언제임 ㅋㅋ","joke"]],
 saga:[["이건 속일 의도조차 없어 보이는게 ㅈㄴ 웃기네 ㅋㅋㅋ","joke"],
   ["진짜 몇 살이 올리는건지 진심 궁금. 극단적으로 적거나 극단적으로 많을 것 같은데 ㅋㅋ","joke"],
   ["잡담탭이었음 문학으로 인기글갔을텐데 ㅅㅂㅋㅋㅋㅋ","joke"],["어휴 ㅅㅂ ㅋㅋㅋ","joke"],
   ["소설 쓰지 마라 진짜 ㅋㅋ","mock"],["대사까지 있는거 실화냐","joke"],
   ["'단호' 에 따옴표 친거에서 터짐","joke"],["뇌피셜을 ㅊㅊ에 적는 패기 ㅋㅋㅋ","joke"],
   ["이분 시나리오 작가 하셔야될듯","mock"],["K리그 최고의 명문 ㅋㅋㅋㅋㅋ","joke"],
   ["글 쓰는데 몇시간 걸렸냐","mock"],["장문인데 내용이 하나도 없음","mock"],
   ["이거 읽고 있는 내가 더 부끄럽다","joke"],["드라마 극본 공모전 넣어라","mock"],
   ["근데 재밌어서 추천 눌렀다 ㅋㅋ","joke"],["아 ㅋㅋㅋ 아침부터 뭐하는거야 진짜","joke"],
   ["관계자 대사가 왜케 정중해 ㅋㅋㅋ","joke"],["'아뇨,' 에서 쉼표 찍는 디테일 봐라","joke"],
   ["끝까지 읽은 내가 문제다","joke"],["문체가 은근 좋아서 더 화남","joke"],
   ["이걸 진지하게 쓴거면 좀 무섭다","mock"],["다음편 언제 나옴","joke"],
   ["ㅋㅋㅋㅋㅋㅋ 아 배아파","joke"],["이런 글 볼때마다 이 게시판 못 떠남","joke"],
   ["대사 있는 루머는 100% 창작임","doubt"],["훈련장 불 안 꺼졌대 ㅋㅋㅋㅋㅋ","joke"]],
 move:[["{p} 진짜 가는거임 ?","ask"],["{o} 갈 급은 아닌데","doubt"],["ㅅㅂ {p} 가면 우리 뭐 남냐","angry"],
   ["이적료나 제대로 받자","cool"],["본인이 원하면 잡을 방법 없음","cool"],["{p} 대체자는 있고 ?","ask"],
   ["또 {o}야 ㅋㅋ 우리 선수만 데려가네","angry"],["에이전트가 흘린 거 같은데","info"],
   ["{p} 계약 몇 년 남았지","ask"],["가면 잘 가라고 해줄 사람 ㅇㅇ","cool"],
   ["작년에도 {o} 간다더니 그대로 있었음","doubt"],["{p} SNS 팔로우 해제했다던데","info"]],
 renew:[["{p} 재계약 이건 무조건 잡아야지","believe"],["연봉 얼마 부르는데 ?","ask"],
   ["{t} 프런트 또 늦게 움직이다 놓친다","angry"],["FA로 나가면 진짜 손해임","worry"],
   ["나이 생각하면 장기계약은 좀","cool"],["{p} 본인은 남고싶어한다던데","info"],
   ["작년 재계약 때도 이 난리였음 ㅋㅋ","joke"],["ㅊㅊ 없으면 안믿음","doubt"],
   ["{p} 없으면 우리 중원 누가 봄","worry"]],
 form:[["{p} 최근 경기 보면 확실히 이상함","believe"],["몸 상태 문제 아님 ?","ask"],
   ["폼은 원래 오르내리는거임","cool"],["{p} 요즘 표정부터가 안좋더라","info"],
   ["감독이 자꾸 자리 바꿔서 그런 듯","believe"],["훈련장 얘기는 좀 조심하자","cool"],
   ["ㅅㅂ 돈값 좀 해라","angry"],["다음 경기 보고 판단","cool"]],
 injury:[["{p} 심각한거임 ??","ask"],["ㅅㅂ 하필 지금","angry"],["{o}전에는 뛸수 있겠지 ? ;;;","worry"],
   ["구단 발표는 항상 짧게 나옴","info"],["무리시키지마라 진짜","worry"],["대체자들 있잖아 ?.... 아닌가","ask"],
   ["작년에도 2주라더니 두달 갔음","doubt"],["재활 잘하고 오면 됨","cool"]],
 frnOut:[["{p} 방출이면 대체 용병은 ?","ask"],["돈값 못한건 맞지","believe"],
   ["{t} 용병 보는 눈 진짜 없다","angry"],["적응 시간을 안주잖아 ㅋㅋ","cool"],
   ["{p} 정도면 다른팀 가면 잘할듯","cool"],["ㅊㅊ 어디임 ?","doubt"],
   ["시즌 중에 용병 갈면 그게 더 손해임","worry"]],
 sack:[["이미 늦었다 진작 했어야","angry"],["후임이 더 문제인데","worry"],
   ["감독 탓만 할 상황은 아님","cool"],["ㅊㅊ 없이 이런거 쓰면 안되지","doubt"],
   ["프런트가 사줘야 감독도 하지","cool"],["다음이 누군데 ?","ask"],
   ["또 소방수 데려오겠네 ㅋㅋ","joke"],["성적 보면 할 말은 없다","believe"]],
 owner:[["ㅅㅂ 이거 진짜면 큰일인데","worry"],["예산 깎이는건 확정이라고 봄","believe"],
   ["모기업 주가 보고 왔는데 ㄷㄷ","info"],["설마 매각까지 가겠냐","doubt"],
   ["선수부터 팔릴텐데","worry"],["구단만 불쌍하지","cool"]],
 stad:[["잔디 그거 진짜 심각함 사진봄","info"],["연맹이 뭘 하겠냐 ㅋㅋ","joke"],
   ["선수들 다치면 누가 책임짐","angry"],["원정 갔다왔는데 진짜 별로였음","info"],
   ["돈 없다는 소리만 10년째","angry"]],
 board:[["또 무슨 소리를 하려고","doubt"],["겨울에 크게 움직인다는건 매년 나옴","joke"],
   ["방향이라도 있으면 다행이지","cool"],["ㅊㅊ 있으면 좀 풀어봐","ask"]],
 feudPP:[["둘이 사이 안좋은건 유명함","believe"],["라커룸 갈라지면 성적은 끝임","worry"],
   ["둘다 프로면 그라운드에서 풀어라","cool"],["누가 먼저 시작했는데 ?","ask"],
   ["ㅊㅊ 없으면 이건 그냥 소설","doubt"],["감독이 정리해야지 뭐하냐","angry"],
   ["겨울에 한명은 나가겠네","believe"],["근데 최근 경기 보면 확실히 이상하긴 했음","info"]],
 feudPM:[["{p} 겨울에 나가겠네","believe"],["감독 스타일이 원래 그럼","cool"],
   ["{p} 편도 좀 들어주자 ㅋㅋ","joke"],["누구 잘못인지는 알아야지","ask"],
   ["이런 얘기가 나오는거 자체가 문제임","worry"],["구단 부인은 원래 다 함","doubt"],
   ["ㅅㅂ 성적도 안좋은데 이런것까지","angry"]],
 feudMM:[["둘이 원래 사이 안좋음 ㅇㅇ","believe"],["기자회견 다시보기 해봐라 진짜 웃김","joke"],
   ["다음 맞대결 벌써 기대된다 ㅋㅋ","joke"],["어른들이 왜 저러냐","cool"],
   ["악수 안한건 확인된거임 ?","ask"],["이런건 선수들만 피해봄","worry"]],
 feudFO:[["영입 요청 반려는 진짜 많이 들리더라","info"],["감독이 무슨 힘이 있냐","cool"],
   ["시즌 끝나고 갈라서는 각","believe"],["후런트가 문제라니까","angry"],
   ["ㅊㅊ 어디임 ? 이건 좀 크다","ask"],["돈 안쓰면서 성적은 바라고","angry"]]};
/* 어느 글에나 붙는 게시판 소음 — 15% 정도만 섞는다 */
/* 🧊 상식적인 반응 — 게시판이 늘 과열되어 있는 건 아니다. 판단을 유보하고 말리는 사람들.
     어떤 종류의 글에도 붙을 수 있어서 종류별 풀과 별개로 둔다 */
const RUM_CM_SANE=[
  ["일단 공식발표 나오기 전엔 판단 보류","cool"],["이런 얘기는 매년 이맘때 나옴","cool"],
  ["가능성은 있는데 확정처럼 쓰진 말자","cool"],["사실이면 구단이 먼저 정리하겠지","cool"],
  ["선수 입장도 생각해줘야지","cool"],["루머는 루머로만 보자","cool"],
  ["ㅊㅊ이 애매하긴 한데 아예 근거 없진 않아 보임","cool"],["기사 하나만 떠도 정리될 얘기","cool"],
  ["이 게시판 특성상 반은 걸러 들어야 함","cool"],["감정적으로 갈 사안은 아닌 것 같은데","cool"],
  ["팩트만 놓고 보면 아직 아무것도 없음","doubt"],["시즌 중이라 확정 짓기 어려운 시기임","info"],
  ["결과로 보면 되는거지 뭘 이렇게까지","cool"],["{p} 커리어 생각하면 이해되는 부분도 있음","cool"],
  ["{t} 상황상 아주 무리한 얘기는 아님","believe"],["양쪽 다 일리는 있음","cool"],
  ["일단 다음 경기 보고 얘기하자","cool"],["과열되지 말고 좀 지켜보자","cool"],
  ["여기서 싸운다고 바뀌는거 없음","cool"],["나쁜 소식만은 아닐 수도 있음","cool"],
  ["구단 공지 뜨면 그때 반응해도 늦지 않음","cool"],["댓글이 본문보다 앞서가고 있음","cool"],
  ["아니면 말고 식이라도 정보는 정보지","cool"],["차분하게 봅시다 다들","cool"]];
const RUM_CM_NOISE=[["ㅊㅊ 없으면 그냥 소설임 ㅋㅋ","doubt"],["이사람 예전에 하나 맞춘적 있음 ㅇㅇ","believe"],
  ["작년에도 똑같은 글 봤다","doubt"],["댓글에 벌써 확정론자 등장 ㅋㅋㅋ","joke"],
  ["확정 뜨면 다시 오겠음","cool"],["{t} 망함","joke"],["그래서 언제 발표되는데 ?","ask"]];
/* 🔁 입장별 «대답» — 부모 댓글의 입장을 보고 고른다. 각 대답에도 입장이 있어 다음이 이어진다 */
const RUM_REPLY={
 ask:[["나도 그게 궁금함","ask"],["위에 본문에 써있잖아","cool"],["그건 아무도 모름","cool"],
   ["기사 뜨면 알겠지","cool"],["나도 들은건 없음","cool"],["그걸 알면 내가 기자하지 ㅋㅋ","joke"]],
 doubt:[["ㅊㅊ 못 밝힌다고 썼잖아","cool"],["나도 반신반의","doubt"],["이번엔 좀 구체적이긴 해","believe"],
   ["의심은 하는데 아예 없는 얘긴 아닐듯","cool"],["그럼 안믿으면 되지 왜 화냄","angry"],
   ["작년 그 글도 결국 맞았음","believe"]],
 believe:[["아직 아무것도 확정 아님","doubt"],["ㅇㅈ","agree"],["근거가 뭔데 ?","ask"],
   ["확신하는 이유가 궁금하다","ask"],["ㄹㅇ 이거임","agree"],["김칫국 좀 그만","mock"]],
 worry:[["미리 걱정해서 뭐하냐","cool"],["나도 그게 제일 무섭다","worry"],["아직 아무것도 안 정해졌음","cool"],
   ["걱정한다고 바뀌면 매일 하겠다","joke"],["ㅇㅈ 진짜 답답함","worry"]],
 angry:[["진정 좀 해라 ㅋㅋ","mock"],["화날만 하지","agree"],["여기서 화내봐야 소용없음","cool"],
   ["나도 같은 심정","agree"],["말이 너무 세다","cool"]],
 joke:[["ㅋㅋㅋㅋㅋㅋ","agree"],["웃을 일이 아닌데","cool"],["ㄹㅇㅋㅋ","agree"],["센스 ㅋㅋ","agree"]],
 info:[["오 이건 처음 듣네","agree"],["그거 어디서 봄 ?","ask"],["ㅊㅊ 좀","ask"],
   ["나도 비슷한 얘기 들었음","agree"],["그건 좀 다른 얘기임","doubt"]],
 cool:[["ㅇㅈ 그게 맞다","agree"],["너무 차분한거 아님 ?","mock"],["맞는 말임","agree"],["ㅇㅇ 기다려보자","agree"]],
 agree:[["ㄹㅇ","agree"],["ㅇㅇ","agree"],["ㅋㅋㅋ ㅇㅈ","agree"]],
 mock:[["니가 뭘 아는데 ?","angry"],["ㅋㅋ 그래 잘났다","angry"],["말 이쁘게 하자","cool"]]};
/* 🚌 목격담의 «결말» — 라인업이 뜨면 판가름난다. 신뢰도는 글마다 다르다 */
const RUM_CM_BUS_HIT=[["ㄹㅇ 진짜 빠졌네 이분 인정","believe"],["라인업 떴는데 진짜 없다","info"],
  ["와 이건 맞췄네 ㅊㅊ 인정","believe"],["이분 다음에도 버스 좀 봐주세요 ㅋㅋ","joke"],
  ["버스맨 이분 감사합니다","joke"],["선발 명단 나왔음 {p} 없음","info"]];
const RUM_CM_BUS_MISS=[["선발 나왔는데요 ㅋㅋㅋ","mock"],["방금 라인업 떴는데 그대로 선발임","info"],
  ["버스 잘못 본거 아님 ?","doubt"],["ㅋㅋㅋㅋ 또 틀렸네","mock"],["아 포 아깝다 진짜","mock"],
  ["다음부터는 좀 확인하고 쓰셈","angry"],["{p} 풀타임 뛰는중 ㅋㅋ","mock"]];
/* 💸 이적시장 루머의 «결말» — 발표가 나거나, 조용히 묻힌다 */
const RUM_CM_MK_HIT=[["공홈 떴다 ㅋㅋ 진짜였네","info"],["오늘 발표남 ㅊㅊ 인정","believe"],
  ["이사람 이번엔 맞췄다","believe"],["메디컬 통과했다고 기사 떴음","info"],
  ["와 진짜 가네 ㅅㅂ","angry"],["떠난다 진짜로","worry"]];
const RUM_CM_MK_MISS=[["시장 닫혔는데요 ㅋㅋ","mock"],["잔류 확정 기사 떴다","info"],
  ["또 아니었네 ㅋㅋㅋ","mock"],["매년 간다간다 하고 남아있음","doubt"],
  ["이새끼 ㅊㅊ 좀 바꿔라","mock"],["재계약 도장 찍었다는데 ?","info"]];
/* ⚔️ 입장이 부딪히면 싸움이 된다 — 어느 조합에서 불이 붙는가 */
const RUM_CLASH={"believe|doubt":1,"doubt|believe":1,"angry|mock":1,"mock|angry":1,
  "believe|mock":1,"angry|cool":1,"worry|mock":1};
const RUM_FIGHT=[
  ["그래서 니가 아는게 뭔데 ?","적어도 너보단 안다","ㅋㅋ 그래 잘났다","됐고 결과로 보자"],
  ["팬이면 좀 응원을 해라","응원이랑 비판은 다른거다","그게 비판이냐 그냥 욕이지","말 통하는 사람이랑 얘기하고싶다"],
  ["또 니냐 ㅋㅋ","또 나다 왜","닉값하네 진짜","서로 시간아끼자"],
  ["여기 우리팀 팬 맞음 ?","맞으니까 화내는거다","화낼데가 없어서 여기서 그러냐","..."],
  ["ㅊㅊ 없으면 닥치는게 맞다","ㅊㅊ 달면 믿을거냐","믿을지는 보고 정한다","그럼 기다려라"],
  ["님 저번 글도 틀렸잖아요","기억력 좋으시네요","틀린걸 틀렸다는데 뭐가 문제냐","네 다음 훈수"]];
/* 🤬 작정하고 붙는 개싸움 — 위의 «투닥»과 달리 이건 서로 물어뜯는다.
     길고, 욕이 섞이고, 비추천을 잔뜩 먹고, 끝에는 신고·차단 얘기가 나온다.
     ⚠ 두 사람 사이의 핑퐁이므로 짝수/홀수 화자가 그대로 유지되어야 한다 */
const RUM_FLAME=[
  ["ㅋㅋ 진짜 개소리 오지네","ㅅㅂ 니가 뭔데 판단하냐","판단이 아니라 팩트인데 ㅄ아",
   "ㅄ은 니 얼굴이고","어휴 수준 ㅉㅉ 대화가 안된다","먼저 시비 건건 니다 븅신아"],
  ["이 새끼 또 왔네 ㅋㅋ","새끼 ? 야 너 신고했다","신고 ㅋㅋ 무서워 죽겠네 ㅋㅋㅋ",
   "ㅅㅂ 진짜 어이가 없어서","어이 없으면 나가면 되잖아 ㅋㅋ","니가 나가라 좀 제발"],
  ["글 좀 읽고 댓글 달아라 ㅄ아","읽었으니까 다는거지 ㅁㅊ놈아","읽고 저 소리면 더 문제 아니냐 ㅋㅋ",
   "아 ㅅㅂ 진짜 말 섞기 싫다","먼저 싸지른건 너고","됐고 블라함 ㅅㄱ"],
  ["팬질 좀 곱게 해라 진짜 ㅉㅉ","곱게 ? ㅅㅂ 이 팀 보고 곱게가 되냐","그럴거면 접어 그냥 ㅋㅋ",
   "니가 뭔데 접으라 마라야 ㅄ아","어휴 또 시작이네 ㅋㅋㅋ","시작은 니가 했지 븅신아"],
  ["ㅋㅋㅋ 이새끼 또 정신승리하네","정신승리는 ㅅㅂ 니가 하고 있고","거울 좀 봐라 진심으로",
   "거울 얘기 나오는거 보니 밑천 떨어졌네 ㅋㅋ","아 진짜 ㅁㅊ 답답해서 블라한다","블라해라 ㅋㅋ 아쉬울거 없음"],
  ["ㅅㅂ 이런 애들 때문에 팬들이 욕먹는거임","팬 대표 났네 ㅋㅋㅋ","대표는 무슨 상식 얘기하는거지 ㅄ아",
   "상식 ㅋㅋ 니 댓글이 제일 비상식적임","어휴 됐다 니랑 말 섞은 내가 ㅄ 블라 ㅅㄱ","드디어 맞는 말 하네 ㅋㅋㅋ"],
  ["ㅁㅊ 이걸 믿는 애가 있네","안 믿으면 조용히 지나가면 되잖아","조용히 넘어가기엔 너무 ㅄ같아서 ㅋㅋ",
   "ㅅㅂ 말하는 뽄새 봐라","뽄새 타령할 시간에 축구나 봐라","블라 박는다 ㅅㄱ"],
  ["여기 또 그 새끼네 ㅋㅋ 닉 외웠다","외우든 말든 ㅄ아","ㅋㅋㅋ 발작하는거 봐",
   "발작은 ㅅㅂ 니가 하고있는데","어휴 노답 ㅉㅉ 블라 ㅅㄱ","블라 좋아하시네 ㅋㅋ 잘가라"]];
/* 개싸움 구경꾼 — 말리는 게 아니라 즐긴다 */
const RUM_FLAME_BY=["ㅋㅋㅋㅋ 팝콘각","둘 다 정지 좀","신고 넣었다 둘 다","관리자 어디감",
  "루머글에서 왜 개싸움이냐","이거 캡쳐해야지","둘이 사귀냐 ㅋㅋ","아침부터 뭐하는거임 진짜",
  "이 스크롤 뭔데 ㅋㅋㅋ","둘 다 블라함 ㅅㄱ","둘 다 블라 박았다","블라 목록 늘어나네 ㅋㅋ"];
function rumMkC(txt, up, dn){
  return {u:pick(FMK_NICK), rk:fmkRankRoll(0), t:txt,
          up:(up!=null?up:R(9)), dn:(dn!=null?dn:R(4)), re:[]};
}
function rumComments(r){
  /* 🏷️ 탭 잘못 단 글 — 「ㅌ」이 쫘르륵 달린다. 대화가 아니라 «집단 지적»이라 결이 다르다 */
  if(r && r.off){
    const outO=[], seenO=new Set();
    const nO=8+R(8);                                    // 많이 달린다
    const o2=(no)=>{ for(let z=0;z<12;z++){ const v=pick(FMK_NICK); if(v!==no) return v; } return pick(FMK_NICK); };
    for(let i=0;i<nO;i++){
      let c=null;
      for(const x of sampleN(RUM_CM_TAB, RUM_CM_TAB.length)){ if(!seenO.has(x)){ seenO.add(x); c=x; break; } }
      if(!c) c=pick(["ㅌ","ㅌㅌ","탭"]);                 // 바닥나면 짧은 것으로 계속 채운다
      const C=rumMkC(c, (i<3?6+R(40):R(14)), R(3));
      /* 글쓴이가 가끔 답한다 — 사과하거나 버틴다 */
      if(i<3 && Math.random()<0.45){
        const e=pick(RUM_CM_TAB_RE);
        C.re.push({u:(e[1]==="op"?(r.u||"글쓴이"):o2(C.u)), rk:fmkRankRoll(0), to:C.u,
                   t:e[0], up:R(20), dn:R(6)});
      }
      outO.push(C);
    }
    return outO;
  }
  /* 🤡 상주 인물의 글 — 댓글이 통째로 다르다 */
  if(r && r.troll){
    const src=(r.troll==="nr")?RUM_CM_NR:RUM_CM_BT;
    const outT=[], seenT=new Set();
    const nT=4+R(4);
    const o2=(no)=>{ for(let z=0;z<12;z++){ const v=pick(FMK_NICK); if(v!==no) return v; } return pick(FMK_NICK); };
    for(let i=0;i<nT;i++){
      let c=null;
      for(const x of sampleN(src, src.length)){ if(!seenT.has(x[0])){ seenT.add(x[0]); c=x; break; } }
      if(!c) break;
      const C=rumMkC(c[0], c[1]+R(30), R(4));
      if(Math.random()<0.40)
        C.re.push({u:o2(C.u), rk:fmkRankRoll(0), to:C.u,
          t:pick(["ㄹㅇㅋㅋ","ㅇㅈ","이게 맞다","이분 말이 맞음","ㅋㅋㅋㅋㅋㅋ","팩트임"]), up:R(18), dn:R(3)});
      outT.push(C);
    }
    return outT;
  }
  const out=[];
  const V={p:(r&&r.pn)||"그 선수", t:(r&&r.tn)||"우리", o:(r&&r.on)||"상대"};
  const F=(a)=>String(a).replace(/\{p\}/g,V.p).replace(/\{t\}/g,V.t).replace(/\{o\}/g,V.o);
  const base=(RUM_CM_KIND[r&&r.kind]||RUM_CM_KIND.board);
  const n=3+R(6);
  const seen=new Set();
  const o2=(no)=>{ for(let z=0;z<12;z++){ const v=pick(FMK_NICK); if(v!==no) return v; } return pick(FMK_NICK); };
  /* 📎 ㅊㅊ은 반드시 한 번은 씹힌다 — 실제 게시판에서 제일 먼저 달리는 댓글이 이거다 */
  const sp0=RUM_CM_SRC[(r&&r.src)||""]||null;
  const srcAt=(sp0 && Math.random()<0.66) ? R(Math.min(n,3)) : -1;
  for(let i=0;i<n;i++){
    /* 지정된 자리엔 ㅊㅊ 저격, 나머지는 85% 주제 풀 · 15% 게시판 소음 */
    /* 지정된 자리엔 ㅊㅊ 저격 · 나머지는 주제 62% · 상식적인 반응 23% · 게시판 소음 15% */
    const _rr=Math.random();
    const src=(i===srcAt&&sp0)?sp0 : (_rr<0.62?base : _rr<0.85?RUM_CM_SANE : RUM_CM_NOISE);
    let e=null;
    for(const x of sampleN(src, src.length)){ if(!seen.has(x[0])){ seen.add(x[0]); e=x; break; } }
    if(!e){ for(const x of sampleN(base, base.length)){ if(!seen.has(x[0])){ seen.add(x[0]); e=x; break; } } }
    if(!e) break;
    const C=rumMkC(F(e[0]), i===0?8+R(30):R(8), i===0?R(3):R(5));
    C.st=e[1];
    /* ── 대댓글 — 부모의 «입장»에 대답한다 ── */
    if(Math.random()<0.52){
      let curSt=C.st, curU=C.u;
      const speakers=[C.u];
      const depth=1+ (Math.random()<0.45?1:0) + (Math.random()<0.20?1:0);
      for(let d=0; d<depth; d++){
        const rp=RUM_REPLY[curSt]||RUM_REPLY.cool;
        const e2=pick(rp);
        const who=o2(curU);
        /* 입장이 부딪혔다 — 여기서 싸움으로 번진다 */
        if(RUM_CLASH[curSt+"|"+e2[1]] && Math.random()<0.55){
          /* 35% 는 그냥 투닥이 아니라 «작정한 개싸움»으로 번진다 */
          const _flame=Math.random()<0.35;
          const FG=_flame?pick(RUM_FLAME):pick(RUM_FIGHT);
          /* ⚔️ 싸움의 당사자는 «지금 말을 주고받던 두 사람»이다.
             예전엔 b 를 제3의 유저로 새로 뽑아서, 시비를 걸린 curU 는 가만히 있고
             엉뚱한 사람이 대신 싸웠다 — 누가 누구랑 싸우는지 읽히지 않았다 */
          const a=who, b=curU;
          for(let m2=0;m2<FG.length;m2++){
            const sp=(m2%2===0)?a:b, to=(m2%2===0)?b:a;
            /* 개싸움 줄은 추천이 거의 없고 비추가 쌓인다 — 게시판이 싫어한다 */
            C.re.push({u:sp, rk:fmkRankRoll(0), to, t:FG[m2],
              up:_flame?R(6):R(14), dn:_flame?(8+R(60)):R(7), fl:_flame?1:0});
          }
          /* 구경꾼은 «마지막으로 떠든 사람»을 콕 집어 말린다 — 이것도 대상이 분명해야 한다 */
          if(Math.random()<(_flame?0.75:0.35)){
            const last=(FG.length%2===0)?b:a;
            C.re.push({u:o2(last), rk:fmkRankRoll(0), to:last,
              t:pick(_flame?RUM_FLAME_BY
                           :["둘이 쪽지로 하셈","싸우지들 마라 ㅋㅋ","이게 뭔 난리냐","루머글에서 왜 싸움",
                             "구경 재밌네 계속해라","서로 블라하면 될듯"]), up:5+R(30), dn:R(4)});
          }
          break;
        }
        C.re.push({u:who, rk:fmkRankRoll(0), to:curU, t:F(e2[0]), up:R(12), dn:R(4)});
        curSt=e2[1]; curU=who; speakers.push(who);
      }
    }
    out.push(C);
  }
  /* 🚌 목격담은 결말이 붙는다 — 맞으면 인정, 틀리면 조롱 */
  if(r && (r.kind==="bus"||r.kind==="market") && out.length && Math.random()<(r.kind==="bus"?0.8:0.45)){
    const e3=pick(r.kind==="bus" ? (r.hit?RUM_CM_BUS_HIT:RUM_CM_BUS_MISS)
                                 : (r.hit?RUM_CM_MK_HIT:RUM_CM_MK_MISS));
    const C3=rumMkC(F(e3[0]), r.hit?(10+R(60)):(2+R(20)), R(4));
    C3.st=e3[1]; out.push(C3);
  }
  return out;
}
/* 🎭 후일담 — 예능 모드의 「그 사건」은 며칠 지나 게시판에서 다시 살아난다.
     당사자가 아니라 «주변 사람»의 입을 통해 나온다. 그게 후일담의 문법이다. */
const RUM_WILD_AFTER={
 press:[`맞은 기자분 어깨에 스친 정도라고 함 병원 간건 뻥`,
   `그날 기자실에서 그 얘기만 두시간 했다는듯`,
   `카메라감독이 그 장면 따로 저장해놨다고 함`,
   `그 기자분 다음날에도 취재 왔다고 ㅋㅋ 프로다`,
   `기자단 회식에서 물병 건배사 나왔다는 얘기 있음`],
 fans:[`그날 앞줄에 있던 사람이 그 물병 아직도 갖고있다고 함`,
   `그 뒤로 간담회 앞줄은 스태프가 앉는다고 함`,
   `당일 현장에 있던 사람 말로는 정적이 30초는 갔다고`,
   `물병 맞은 자리 사진 찍어서 액자 해놨다는 사람도 있음`,
   `구단에서 그날 참석자들한테 따로 연락 돌렸다고 함`],
 locker:[`상대 라커룸 청소하시는 분이 제일 놀라셨다고 함`,
   `그 팀 라커룸 문에 잠금장치 새로 달았다는 얘기`,
   `양쪽 코칭스태프가 그날 이후로 인사도 안한다고 함`,
   `말리던 스태프 한명이 안경 깨졌다고 함 ㅋㅋ`,
   `상대 선수들은 아직도 그날 얘기하면서 웃는다고 함`,
   `그날 복도 CCTV 원본 달라는 요청이 아직도 온다고 함`],
 ref:[`그 심판 그 뒤로 우리 경기 안잡는다는 얘기 있음`,
   `심판협회에서 그날 따로 회의 열었다고 함`,
   `대기실에 있던 부심이 제일 당황했다고 함`,
   `그 뒤로 우리팀 경기에 대기실 앞에 사람 세워둔다고 함`,
   `그 심판분이 사석에서 「그럴 수도 있죠」 했다고 함 대인배`],
 player:[`맞은 선수가 그날 밤에 짐 쌌다는데 다음날 훈련 나왔다고 함`,
   `그 뒤로 라커룸에서 아무도 농담 안한다고 함`,
   `선수들끼리 그날 이후로 감독 눈 안마주친다는 얘기`,
   `주장이 따로 면담 신청했었다고 함`,
   `그 선수 부모님이 구단에 전화하셨다는 얘기가 있음`],
 gamble:[`그 사건 이후로 구단에서 폰 걷는다는 얘기까지 나왔다고 함`,
   `프런트가 제일 먼저 안게 아니라 제일 나중에 알았다고 함`,
   `그날 이후로 스폰서 미팅이 두번 밀렸다고 함`,
   `구단 내부에서는 이미 다 알고 있었다는 얘기도 있음`],
 etc:[`그날 이후로 구단 분위기가 확 달라졌다고 함`,
   `그 일로 프런트에서 사람 한명 옷 벗었다는 얘기`,
   `아직도 그 얘기 나오면 다들 웃는다고 함`,
   `그날 현장에 있던 사람 몇명은 아직도 그 얘기 안한다고 함`]};
const RUM_WILD_TAIL=[`근데 이거 어디까지가 진짜인지 모르겠음`,`아는 사람만 아는 얘기라 조심스럽긴 한데`,
  `이거 쓴다고 잡혀가는건 아니겠지`,`더 있는데 이건 못쓰겠다`,`아직 안 알려진 게 하나 더 있음`];
function rumWild(){
  try{
    const L=(G.wildLog||[]).filter(x=>x && (((G.day||0)-(x.d||0)+330)%330)<70);
    if(!L.length) return null;
    const e=pick(L);
    const tn=e.tn||"우리팀";
    const N=(RUM_WILD_AFTER[e.k]||RUM_WILD_AFTER.etc);
    const ttl=pick([`[후일담] ${tn} 그 사건 뒷얘기 들었음`, `${tn} 그때 그 사건 후일담`,
      `${tn} 감독 사건 후일담 하나 풀어봄`, `그 사건 후일담 (${tn})`,
      `${tn} 그날 있었던 일 하나 더 있음`, `[후일담] 그때 그거 실제로는 이랬다고 함`]);
    const B=[];
    /* 장부에 적힌 문구는 회계용이다 — 「선수 체벌 — 구단 자체 징계금」에서 사건만 뽑아 쓴다 */
    const ev=String(e.w||"").split("—")[0].split("(")[0]
      .replace(/징계금|제재금|합의금|파문|중징계/g,"").replace(/\s+/g," ").trim() || "그 사건";
    B.push(pick([`${ev} 그거 다들 기억하지`, `${ev} 그때 그 사건 말인데`,
      `${ev} 뒷얘기 하나 들었음`, `${ev} 그거 아직도 뒷말 나온다`])+RT());
    const two=sampleN(N, Math.min(2+R(2), N.length));
    for(const x of two) B.push(x+RT());
    if(Math.random()<0.5) B.push(`징계금만 ${(e.a||0).toFixed(1)}억 나갔다고 함`+RT());
    B.push(pick(RUM_WILD_TAIL));
    const _t=(G.teams&&e.tid)?G.teams[e.tid]:null;
    const TK=e.tid?`⟦t|${e.tid}⟧`:tn;
    const TZ=(z)=>String(z).split(tn).join(TK);   // 🔄 구단명은 표식으로 — 개명해도 따라온다
    return {ttl:TZ(ttl), body:B.map(TZ), tid:e.tid||null, pid:null, kind:"wild",
            wild:1, src:"nbr", hit:0, saga:0, pn:"", tn:TK, on:TK};
  }catch(e){ return null; }
}
/* 하루에 한두 건 — 게시판이 살아 있게 */
function rumTick(){
  try{
    if(Math.random()>0.55) return;
    const n=1+(Math.random()<0.35?1:0);
    for(let i=0;i<n;i++){
      /* 🤡 상주 인물 — 벤투 8% · 노루막이 5%. 게시판에 가끔 등장해야 「또 얘야」가 된다 */
      const _tr=Math.random();
      const m = _tr<0.08 ? (rumTrollBenthu()||rumMake())
              : _tr<0.13 ? (rumTrollNoru()||rumMake())
              : _tr<0.20 ? (rumOffTopic()||rumMake())      // 🏷️ 탭 잘못 단 글 7%
              : _tr<0.30 ? (rumWild()||rumMake())          // 🎭 후일담 — 사건이 있었을 때만
              : rumMake();
      if(!m) continue;
      const L=rumList();
      const id=(G.rumSeq=(G.rumSeq||0)+1);
      /* 상주 인물의 글은 추천이 거의 없고 비추천이 압도적이다 */
      const _up = m.troll ? R(4) : m.off ? R(6) : m.saga ? (12+R(90)) : m.wild ? (40+R(260)) : 5+R(110);
      const _dn = m.troll ? (140+R(900)) : m.off ? (60+R(240))
                : m.saga ? (30+R(180)) : R(24);   // 🏷️ 탭 글·📖 소설도 비추를 맞는다
      const _row={id, fid:"rum"+id, ttl:m.ttl, body:m.body, tid:m.tid, pid:m.pid, kind:m.kind,
        u:(m.troll?RUM_TROLL_NICK[m.troll]:pick(FMK_NICK)), rk:(m.troll?0:fmkRankRoll(0)),
        troll:(m.troll||0), off:(m.off||0), src:(m.src||""), hit:(m.hit||0), saga:(m.saga||0), wild:(m.wild||0), pn:m.pn, tn:m.tn, on:m.on, d:G.day||0, s:G.season,
        e:"🗞️", tone:-1, sd:"o",          // 고소 화면이 읽는 공통 필드 (아바타·논조·진영)
        v:900+R(24000), up:_up, dn:_dn, conf:(m.troll?0:(Math.random()<RUM_CONF_P?1:0)),
        cm:rumComments(m), txt:m.ttl+" — "+m.body.join(" ")};   // txt: 고소 판정이 읽는 본문
      L.unshift(_row);
      G.rum=L.slice(0, RUM_MAX);
    }
  }catch(e){}
}
let socSide="o";   // 소셜 탭에서 보고 있는 진영: o=우리 구단 팬 · r=타구단 팬
function setSocSide(k){ socSide=k; show("media"); }
/* 📋 루머 게시판 — 목록 · 글 보기 */
let RUM_OPEN=null;
function rumOpen(id){
  RUM_OPEN=id;
  try{ const r=rumById(id); if(r){ r.read=1; r.v=(r.v||0)+1+R(40); } }catch(e){}
  show("media");
}
function rumClose(){ RUM_OPEN=null; show("media"); }
/* 🍪 포텐 / 방출 — 게시글 추천·비추천. 한 글에 한 번만. */
/* 🍪 포텐/방출 — ⚠ 제보 「내가 눌러도 숫자가 안 바뀐다」.
     ① 가운데 숫자가 «추천»만 보여줘서 방출을 눌러도 화면에 변화가 없었다 → 양쪽을 다 띄운다.
     ② 화면 전체를 다시 그리면(show) 스크롤이 글 맨 위로 튄다 → 그 자리에서 숫자만 고친다.
     ③ 표를 저장하지 않아 새로고침하면 되돌아갔다 → 눌렀으면 저장한다. */
function rumVote(id, dir){
  const r=rumById(id); if(!r) return;
  if(r._v){ try{ flash(r._v>0?"이미 포텐을 눌렀습니다.":"이미 방출을 눌렀습니다.","warn"); }catch(e){} return; }
  r._v=dir>0?1:-1;
  if(dir>0){ r.up=(r.up||0)+1; try{ flash("🍪 포텐을 눌렀습니다.","good"); }catch(e){} }
  else     { r.dn=(r.dn||0)+1; try{ flash("🍪 방출을 눌렀습니다.","warn"); }catch(e){} }
  let done=false;
  try{
    const w=document.querySelector(".rumPotenWrap");
    if(w){
      const nu=w.querySelector(".pnum.up"), nd=w.querySelector(".pnum.dn");
      if(nu) nu.textContent=(r.up||0).toLocaleString();
      if(nd) nd.textContent=(r.dn||0).toLocaleString();
      const bu=w.querySelector(".pbtn.up"), bd=w.querySelector(".pbtn.dn");
      if(bu) bu.classList.toggle("done", r._v===1);
      if(bd) bd.classList.toggle("done", r._v===-1);
      const hot=(r._v===1)?nu:nd;
      if(hot){ hot.classList.remove("pop"); void hot.offsetWidth; hot.classList.add("pop"); }
      done=true;
    }
  }catch(e){}
  if(!done) show("media");
  try{ saveGame(); }catch(e){}
}
/* 💬 댓글·대댓글 추천·비추천 — ri 가 null 이면 원댓글, 숫자면 그 대댓글 */
function rumCVote(id, ci, ri, dir){
  const r=rumById(id); if(!r) return;
  const c=(r.cm||[])[ci]; if(!c) return;
  const o=(ri==null)?c:((c.re||[])[ri]); if(!o) return;
  if(o._v){ try{ flash("이미 눌렀습니다.","warn"); }catch(e){} return; }
  o._v=dir>0?1:-1;
  if(dir>0) o.up=(o.up||0)+1; else o.dn=(o.dn||0)+1;
  /* 댓글도 같은 이유로 그 자리에서 고친다 — 긴 댓글창에서 스크롤이 튀면 어디를 눌렀는지 잃는다 */
  let done=false;
  try{
    const key=`${id}_${ci}_${ri==null?"n":ri}`;
    const bu=document.getElementById("cvu"+key), bd=document.getElementById("cvd"+key);
    if(bu||bd){
      if(bu){ const sp=bu.querySelector("span"); if(sp) sp.textContent=(o.up||0); bu.classList.toggle("on", o._v===1); }
      if(bd){ const sp=bd.querySelector("span"); if(sp) sp.textContent=(o.dn||0); bd.classList.toggle("on", o._v===-1); }
      const hot=(o._v===1)?bu:bd;
      if(hot){ hot.classList.remove("pop"); void hot.offsetWidth; hot.classList.add("pop"); }
      done=true;
    }
  }catch(e){}
  if(!done) show("media");
  try{ saveGame(); }catch(e){}
}
function rumViewCnt(v){ return v>=10000 ? Math.floor(v/10000)+"만" : (v||0).toLocaleString(); }
function rumRankImg(rk){
  const i=clamp(rk|0,0,FMK_RANK.length-1);
  return `<img class="fmkRk" src="${FMK_RANK[i]}" alt="${FMK_RANK_N[i]}" title="${FMK_RANK_N[i]}">`;
}
function rumListCard(){
  const L=rumList();
  if(!L.length) return `<div class="card"><h3>🗞️ FM코리아 · 루머 게시판</h3>
    <p class="small">아직 올라온 글이 없습니다. 시즌이 굴러가면 하나둘 올라옵니다.</p></div>`;
  return `<div class="card"><h3>🗞️ FM코리아 · 루머 게시판 <span class="small">— 믿거나 말거나 (수위 주의)</span></h3>
  <div class="rumList">${L.map(r=>`
    <div class="rumRow" onclick="rumOpen(${r.id})">
      <span class="rumTag">루머</span>
      <span class="rumTtl${r.read?" read":""}">${rumFill(r.ttl)}</span>
      <span class="rumCm">${(r.cm||[]).length}</span>
      ${r.conf?`<span class="rumConf">정ㅋ벅ㅋ</span>`:""}
      ${r.troll?`<span class="rumTrollTag">주의</span>`:""}
      <span class="rumGap"></span>
      <span class="rumU">${rumRankImg(r.rk)}${r.u}</span>
      <span class="rumV">${rumViewCnt(r.v)}</span>
      <span class="rumUp${((r.up||0)-(r.dn||0))<0?" neg":""}">${(r.up||0)-(r.dn||0)}</span>
    </div>`).join("")}</div></div>`;
}
function rumPostCard(){
  const r=rumById(RUM_OPEN);
  if(!r) return rumListCard();
  const cm=(r.cm||[]);
  const mine=(function(){ try{ const ut=userTeam(); return !!(ut && !G.jobless && r.tid===ut.id); }catch(e){ return false; } })();
  /* ⚖️ 고소는 «우리 구단 관련 글»만 — 남의 구단 이야기를 우리 법무팀이 들고 갈 수는 없다 (제보) */
  const nickHtml=(u, sueable)=> sueable
    ? `<span class="sueName" title="닉네임을 눌러 이 글을 고소할 수 있습니다" onclick="openSue('rum','${r.fid}')">${u}</span>`
    : `<span class="rumNick" title="우리 구단과 관련된 글만 고소할 수 있습니다">${u}</span>`;
  const vbtn=(on,dir,n,fn,key)=>`<button id="cv${dir>0?"u":"d"}${key}" class="rumVb${on===(dir>0?1:-1)?" on":""}" onclick="${fn}">${dir>0?"👍":"👎"}<span>${n||0}</span></button>`;
  const cmHtml=(c,i)=>`
    <div class="rumCm1${i===0?" best":""}">
      <div class="rumCmTop">${i===0?`<span class="rumBest">BEST</span>`:""}${rumRankImg(c.rk)}
        <b>${nickHtml(c.u, mine)}</b>
        <span class="small">${1+R(5)}시간 전</span>
        <span class="rumCmVote">
          ${vbtn(c._v,+1,c.up,`rumCVote(${r.id},${i},null,1)`,`${r.id}_${i}_n`)}
          ${vbtn(c._v,-1,c.dn,`rumCVote(${r.id},${i},null,-1)`,`${r.id}_${i}_n`)}
        </span>
      </div>
      <div class="rumCmTxt">${rumFill(c.t)}</div>
      ${(c.re||[]).map((q,j)=>`
        <div class="rumRe">
          <span class="rumReArrow">↳</span>
          <div style="flex:1;min-width:0">
            <div class="rumCmTop">${rumRankImg(q.rk)}<b>${nickHtml(q.u, mine)}</b>
              <span class="small">${1+R(5)}시간 전</span>
              <span class="rumCmVote">
                ${vbtn(q._v,+1,q.up,`rumCVote(${r.id},${i},${j},1)`,`${r.id}_${i}_${j}`)}
                ${vbtn(q._v,-1,q.dn,`rumCVote(${r.id},${i},${j},-1)`,`${r.id}_${i}_${j}`)}
              </span>
            </div>
            <div class="rumCmTxt"><span class="rumTo">${q.to}</span> ${rumFill(q.t)}</div>
          </div>
        </div>`).join("")}
    </div>`;
  return `<div class="card">
    <div class="rumHead">
      <h3 style="margin:0">${rumFill(r.ttl)}</h3>
      <span class="small">${dateLabel(r.d)}${r.s!=null&&r.s!==G.season?` · ${r.s}시즌`:""}</span>
    </div>
    <div class="rumMeta">
      ${rumRankImg(r.rk)}${nickHtml(r.u, mine)}
      <span>조회 수 <b>${(r.v||0).toLocaleString()}</b></span>
      <span>추천 수 <b style="color:#f0883e">${r.up}</b></span>
      <span>댓글 <b>${cm.length}</b></span>
    </div>
    ${r.troll?`<div class="msg warn" style="margin:10px 0 0">🤡 <b>게시판 상주 인물</b>의 글입니다 —
      이 사람 글은 <b>맞은 적이 거의 없습니다.</b> 비추천 ${(r.dn||0).toLocaleString()}개.</div>`:""}
    <div class="rumBody">${r.body.map(l=>l===""?`<div style="height:10px"></div>`:`<p>${rumFill(l)}</p>`).join("")}</div>
    <div class="rumPotenWrap">
      <div class="rumPotenTag">[포텐 허용된 글]</div>
      <div class="rumPoten">
        <button class="pbtn up${r._v===1?" done":""}" onclick="rumVote(${r.id},1)">🍪 포텐</button>
        <span class="pnum up">${(r.up||0).toLocaleString()}</span>
        <span class="pnum dn">${(r.dn||0).toLocaleString()}</span>
        <button class="pbtn dn${r._v===-1?" done":""}" onclick="rumVote(${r.id},-1)">🍪 방출</button>
      </div>
    </div>
    <div class="rumBtns"><button class="mini" onclick="rumClose()">목록으로</button></div>
    ${mine?`<p class="small" style="margin:6px 2px 0;color:#a9b4c0">⚖️ 우리 구단 관련 글입니다 — <b>닉네임을 누르면</b> 고소할 수 있습니다.</p>`
          :`<p class="small" style="margin:6px 2px 0;color:#8b949e">남의 구단 이야기라 우리 법무팀이 나설 수 없습니다.</p>`}
    <div class="rumCmHead">댓글 ${cm.length}개</div>
    ${cm.map(cmHtml).join("")}
  </div>`;
}
function socialTabView(){
  const nOwn=socListOf("o").length+fmkListOf("o").length;
  const nRiv=socListOf("r").length+fmkListOf("r").length;
  const btn=(k,l,c)=>`<button class="mini socSideBtn ${socSide===k?"sel":""}" onclick="setSocSide('${k}')">${l} <b>${c}</b></button>`;
  if(G.jobless){
    /* 무직 — 우리 구단이라는 개념이 없다. 진영 구분 없이 리그 팬들의 반응을 한 줄기로 본다. */
    return `<div class="socSideBar">
      ${btn("o","💬 팬 반응",socListOf("o").length+fmkListOf("o").length)}${btn("rum","🗞️ 펨코 루머",rumList().length)}
    </div>
    ${socSide==="rum"
      ? `<p class="small" style="margin:0 2px 8px;color:#a9b4c0">무직이어도 루머 게시판은 돌아갑니다 — 남의 구단 이야기를 구경할 수 있습니다.</p>
         ${RUM_OPEN?rumPostCard():rumListCard()}`
      : `<p class="small" style="margin:0 2px 8px;color:#a9b4c0">무직 중에는 각 구단 팬들이 자기 팀 경기를 두고 떠드는 소리가 흘러갑니다.</p>
         ${socialCard("o")}${fmkCard("o")}`}`;
  }
  return `<div class="socSideBar">
    ${btn("o","🏠 우리 구단 팬",nOwn)}${btn("r","🌐 타구단 팬",nRiv)}${btn("rum","🗞️ 펨코 루머",rumList().length)}
  </div>
  ${socSide==="rum"
    ? `<p class="small" style="margin:0 2px 8px;color:#a9b4c0">펨코 유저들이 만들어 내는 이적·재계약·감독 거취 루머입니다.
        <b>사실인 것도 있고 아닌 것도 있습니다.</b> 제목을 누르면 글이 열리고, 닉네임을 누르면 고소할 수 있습니다.</p>
       ${RUM_OPEN?rumPostCard():rumListCard()}`
    : `${socSide==="r"
      ? `<p class="small" style="margin:0 2px 8px;color:#a9b4c0">다른 구단 팬들이 우리 경기·영입·감독을 두고 하는 이야기입니다. 우리 팬 여론과 따로 굴러갑니다.</p>`
      : ""}
    ${socialCard(socSide)}${fmkCard(socSide)}`}`;
}
function mediaView(){
  /* 💰 경제 탭도 읽음 처리를 한다 — 안 그러면 증권·은행 기사만 남아 NEW 배지가 안 꺼진다 */
  if(mediaTab==="news"||mediaTab==="econ"){ _newsSeenAt=G.feedSeen||0; G.feedSeen=(G.feedSeq||0); }
  const btn=(k,l)=>`<button class="mini ${mediaTab===k?'sel':''}" style="padding:8px 20px;font-size:14px" onclick="setMediaTab('${k}')">${l}</button>`;
  return `<h2>📰 뉴스 / 소셜 / 경제</h2>
  <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">${btn("news","📰 뉴스")}${btn("social","💬 소셜")}${btn("econ","💰 경제")}</div>
  ${suitCard()}
  ${mediaTab==="econ"?econTabView():mediaTab==="social"?socialTabView():newsTabView()}`;
}
/* 라커룸 상태 — 팀 사기와 개인 불만은 성적만큼이나 감독이 관리해야 할 지표다.
   뉴스 피드에 섞여 흘러가 버리면 지금 우리 팀 분위기가 어떤지 한눈에 볼 수가 없다. */
function moodLabel(m){
  return m>=88?"최고조":m>=78?"좋음":m>=66?"안정적":m>=54?"미지근함":m>=44?"침체":"최악";
}
function moodCard(){
  const t=userTeam();
  const m=mor(t.morale);
  const bar = m>=78?"var(--green)":m>=54?"var(--gold)":"var(--red)";
  const sulk=t.players.filter(p=>p.sulk>0);
  const confused=t.players.filter(p=>isConfused(p) && !(p.sulk>0));
  const unhappy=t.players.filter(p=>p.unhappy>0 && !(p.sulk>0) && !isConfused(p));
  const low=t.players.filter(p=>p.morale<50 && !(p.sulk>0) && !(p.unhappy>0)).sort((a,b)=>a.morale-b.morale).slice(0,3);
  const chip=(p,tag)=>`<span class="pchip clickable" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 8px" onclick="openPlayerMenu(event,${p.id})">${moodIcon(p)} ${p.name}<span class="small"> ${tag}</span></span>`;
  const feed=G.news.filter(n=>n.cat==="mood").slice(0,6);
  const gl=G.goal;
  const glCol = gl ? (gl.tier==="fair"||gl.tier==="bold" ? "var(--green)" : gl.tier==="insane"||gl.tier==="weak" ? "var(--red)" : "var(--gold)") : "";
  return `<div class="card"><h3>🤝 팀 분위기</h3>
  ${gl?`<p class="small" style="margin:0 0 6px">시즌 목표: <b style="color:#fff;font-weight:800">${gl.ic} ${gl.n}</b>
    <span style="color:${glCol};font-weight:800">(${gl.tierN})</span></p>`:""}
  <div class="attrRow"><span class="an">팀 사기</span><div class="ab"><div class="af" style="width:${m}%;background:${bar}"></div></div><span class="av">${m}</span></div>
  <p class="small" style="margin-top:6px">라커룸 분위기: <b style="color:#fff;font-weight:800">${moodLabel(m)}</b>
   · 불만 <b style="color:#fff;font-weight:800">${unhappy.length}</b>명
   · 혼란 <b style="color:#fff;font-weight:800">${confused.length}</b>명
   · 태업 <b style="color:#fff;font-weight:800">${sulk.length}</b>명</p>
  ${sulk.length||unhappy.length||confused.length||low.length?`<div style="margin-top:4px">
    ${sulk.map(p=>chip(p,"태업")).join("")}
    ${confused.map(p=>chip(p,"😵 "+(p.uWhy||"혼란"))).join("")}
    ${unhappy.map(p=>chip(p,p.uWhy||"불만")).join("")}
    ${low.map(p=>chip(p,"사기 저하")).join("")}
  </div>`:`<p class="small" style="margin-top:4px">선수단에 특별한 불만은 없습니다.</p>`}
  ${feed.length?`<div style="margin-top:8px;border-top:1px solid #21262d;padding-top:6px">
    ${feed.map(n=>`<div class="small" style="padding:3px 0">${n.txt}</div>`).join("")}</div>`:""}
  <p class="small" style="margin-top:6px">경기 결과와 라커룸 토크, 이적·방출이 사기를 움직입니다. 사기가 낮으면 경기력이 떨어지고 불만이 태업으로 번집니다.</p>
  </div>`;
}
function pressCard(){
  if(!G.press) G.press={rel:50, skip:0};
  if(!G.opt) G.opt={engine:"sim"};   // 경기 엔진 선택 (구버전 세이브 기본값)
  for(const id in G.teams){ const T=G.teams[id].tactic; if(T && T.longShot===undefined) T.longShot=2; }
  for(const id in G.teams) assignNumbers(G.teams[id]);   // 구버전 세이브 — 등번호가 없으면 채운다
  const rel=G.press.rel;
  const barColor = rel>=65?"var(--green)":rel>=35?"var(--gold)":"var(--red)";
  return `<div class="card"><h3>🎙️ 기자단과의 관계</h3>
  <div class="attrRow"><span class="an">우호도</span><div class="ab"><div class="af" style="width:${rel}%;background:${barColor}"></div></div><span class="av">${rel}</span></div>
  <p class="small" style="margin-top:6px">현재 상태: <b>${relLabel()}</b> · 기자회견 불참(${acName()} 대신 참석) 누적 <b>${G.press.skip||0}회</b></p>
  <p class="small">경기 전후 기자회견 답변에 따라 관계가 오르내립니다. 관계가 냉랭해지면 가십성·도발적 질문이 늘어납니다.</p>
  </div>`;
}
function trustCard(){
  if(!G.trust) G.trust={owner:70, fans:70, log:[]};
  const o=G.trust.owner, f=G.trust.fans;
  const barColor=(v)=>v>=70?"var(--green)":v>=40?"var(--gold)":"var(--red)";
  const recent=(G.trust.log||[]).slice(0,4).map(l=>`<div class="small">${l.delta>0?"📈":"📉"} ${l.reason} (${l.delta>0?"+":""}${l.delta})</div>`).join("");
  return `<div class="card"><h3>🏛️ 구단주 · 팬 신뢰도</h3>
  <div class="attrRow"><span class="an">구단주</span><div class="ab"><div class="af" style="width:${o}%;background:${barColor(o)}"></div></div><span class="av">${o}</span></div>
  <div class="attrRow"><span class="an">팬</span><div class="ab"><div class="af" style="width:${f}%;background:${barColor(f)}"></div></div><span class="av">${f}</span></div>
  <p class="small" style="margin-top:6px">구단주: <b>${trustLabel(o)}</b> · 팬: <b>${trustLabel(f)}</b></p>
  ${recent?`<div style="margin-top:6px">${recent}</div>`:""}
  <p class="small" style="margin-top:6px">연패, 핵심 선수 방출·이적 시 하락하고, 핵심 선수 영입·좋은 성적 시 상승합니다. 신뢰가 바닥나면 경질·서포터 시위 등 후폭풍이 있을 수 있습니다.</p>
  </div>`;
}
/* 🏆 오피스 「다음 경기」에 올릴 대회(EACL·CWC) 경기 — 둘 중 빠른 것
   ⚠ 제보 원문 — 「EACL 8강부터 오피스탭의 다음 경기 박에 8강·4강·결승 경기 정보가 보이는 것이
      아니라 '승강 플레이오프가 진행 중입니다'라고 뜬다」 + 「CWC가 진행 중인데 다음 CWC 경기
      정보가 아니라 다음 친선 경기의 정보가 뜨고 있다」.
   ─ 원인: nextOpponent()가 phase 로 문을 먼저 닫았다. EACL 8강~결승은 승강PO 기간(phase="po")에,
     CWC 는 프리시즌(phase="pre")에 열리는데, po 는 고정 문구를, pre 는 친선경기만 돌려줬다.
     이제 어느 국면이든 대회 일정을 먼저 보고, 있으면 그 경기를 올린다. */
function cupNextBest(){
  const today=G.day||0;
  const rank=(d)=>(d>=today ? d : d+100000);
  let best=null;
  try{ const ex=eaclNextForUser(); if(ex && ex.opp) best={kind:"eacl", x:ex}; }catch(e){}
  try{ const cx=cwcNextForUser(); if(cx && cx.opp && (!best || rank(cx.day)<rank(best.x.day))) best={kind:"cwc", x:cx}; }catch(e){}
  return best;
}
function cupNextHtml(best, tail){
  const t=userTeam(), ex=best.x, opp=ex.opp;
  const today=G.day||0, d=Math.max(0, ex.day-today);
  const dt=(G.cal?dateOfDay(ex.day):null);
  const dow=dt?DOW_KR[dt.getDay()]:"";
  const isC=best.kind==="cwc";
  let stN="중립 구장";
  try{ stN = isC ? `${(G.cwc&&G.cwc.host)||"중립"} · 중립 구장` : (stadOf(ex.home?t:opp)||{}).n||"중립 구장"; }catch(e){}
  let stars="-", styleN="-", form="-";
  try{ stars=teamStars(opp, opp.short||opp.name); }catch(e){}
  try{ styleN=styleName(opp); }catch(e){}
  try{ form=(opp.form||[]).slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")||"-"; }catch(e){}
  const tag=isC?`<span class="tag" style="background:#a371f733;color:#c9a7ff">🌍 ${ex.label}</span>`
               :`<span class="tag" style="background:#1f6feb33;color:#58a6ff">🌏 ${ex.label}</span>`;
  return `${tag}<br>
  <b>${opp.name}</b> ${isC?`<span class="small">(중립)</span>`:(ex.home?"(홈)":"(원정)")}${opp.nat?` <span class="small">${opp.nat}</span>`:""}<br>
  🏟️ ${stN} · ${dt?dateLabel(ex.day):""} <span class="small">${dow?"("+dow+")":""} ${d>0?`D-${d}`:"오늘"}</span><br>
  상대 전력: ${stars} · 스타일: <b>${styleN}</b><br>
  최근: ${form}${tail?`<br><span class="small">${tail}</span>`:""}`;
}
function nextOpponent(){
  const t=userTeam();
  if(G.phase==="pre"){
    const f=nextFriendly();
    const openOff=(G.cal&&G.cal.openOff)||0, left=Math.max(0, openOff-(G.day||0));
    /* 🌍 프리시즌에 세계 대회가 열려 있으면 그쪽이 먼저다 (제보 — CWC 대신 친선경기가 떴다) */
    {
      const cb=cupNextBest();
      const today=G.day||0, rank=(d)=>(d>=today?d:d+100000);
      if(cb && (!f || rank(cb.x.day)<=rank(f.d)))
        return cupNextHtml(cb, `개막까지 ${left}일${f?` · 다음 연습경기는 ${dateLabel(f.d)}`:""}`);
    }
    if(f){
      const opp=G.teams[f.oppId];
      const d=Math.max(0, f.d-(G.day||0));
      const st=staffOpt();
      return `🌱 <b>프리시즌 연습경기</b><br>
      <b>${opp?opp.name:"상대 미정"}</b> ${f.home?"(홈)":"(원정)"} · ${dateLabel(f.d)} ${d>0?`<span class="small">(D-${d})</span>`:`<span class="small">(오늘)</span>`}<br>
      상대 전력: ${opp?teamStars(opp, opp.short):"-"} · 스타일: <b>${opp?styleName(opp):"-"}</b><br>
      <span class="small">${st.delegatePre?`🤝 경기 운영을 ${acTitle()}에게 맡겼습니다 — 결과만 보고받습니다.`:"🎯 감독이 직접 지휘합니다."}
      · 개막까지 ${left}일</span>`;
    }
    return `🌱 <b>프리시즌</b> — 연습경기 일정을 모두 마쳤습니다.<br>
      <span class="small">개막까지 ${left}일 · 남은 기간은 훈련과 이적시장에 집중하세요.</span>`;
  }
  if(G.phase==="sacked") return "경질되어 지휘할 경기가 없습니다.";
  if(G.phase==="po"){
    /* 🌏 승강PO 기간에도 EACL 8강~결승은 그대로 열린다 (제보 — 고정 문구가 대회 경기를 가렸다) */
    const cb=cupNextBest();
    if(cb) return cupNextHtml(cb, "⚔️ 승강 플레이오프 기간 — 우리에게는 대회 일정이 먼저 잡혀 있습니다");
    return "⚔️ 승강 플레이오프가 진행 중입니다.";
  }
  if(G.phase!=="league"){
    const cb=cupNextBest();
    if(cb) return cupNextHtml(cb, "");
    return "시즌 일정이 종료되었습니다.";
  }
  const fix=t.div===1?G.k1Fix:G.k2Fix, r=t.div===1?G.r1:G.r2;
  /* ⚠ 제보 — 「다음 경기가 EACL 인데 오피스에는 리그 경기가 뜬다」.
     여기는 리그 fixture 만 훑고 있었다. 시즌 중에 끼어드는 경기(대회·친선)를 먼저 본다. */
  {
    const today=G.day||0;
    const rank=(d)=>(d>=today ? d : d+100000);      // 이미 지난 날짜는 뒤로
    const lgDay=(r<fix.length) ? matchDayOf(r) : 1e9;
    let best=null;
    /* 🌏 대회 — EACL·CWC 중 빠른 것 (제보 — CWC 도 여기 서야 한다) */
    try{
      const cb=cupNextBest();
      if(cb && rank(cb.x.day)<rank(lgDay)) best=cb;
    }catch(e){}
    /* 🌱 시즌 중 친선경기 */
    try{
      const f=(G.friendlies||[]).find(y=>!y.done && rank(y.d)<rank(lgDay)
                && (!best || rank(y.d)<rank(best.x.day!=null?best.x.day:best.x.d)));
      if(f) best={kind:"fr", x:f};
    }catch(e){}
    if(best && (best.kind==="eacl"||best.kind==="cwc")){
      return cupNextHtml(best, `리그 ${r+1}R 은 ${lgDay<1e9?dateLabel(lgDay):"-"}에 있습니다 — 전술 탭에서 정찰 정보 확인`);
    }
    if(best && best.kind==="fr"){
      const f=best.x, opp=G.teams[f.oppId];
      const d=Math.max(0, f.d-today);
      return `<span class="tag" style="background:#3fb95033;color:#3fb950">🌱 연습경기</span><br>
      <b>${opp?opp.name:"상대 미정"}</b> ${f.home?"(홈)":"(원정)"}<br>
      📅 ${dateLabel(f.d)} <span class="small">${d>0?`D-${d}`:"오늘"}</span><br>
      상대 전력: ${opp?teamStars(opp, opp.short):"-"} · 스타일: <b>${opp?styleName(opp):"-"}</b>
      <br><span class="small">리그 ${r+1}R 은 ${lgDay<1e9?dateLabel(lgDay):"-"}에 있습니다</span>`;
    }
  }
  if(r>=fix.length) return "잔여 경기가 없습니다.";
  for(const [hid,aid] of fix[r]){
    if(hid===t.id||aid===t.id){
      const opp=G.teams[hid===t.id?aid:hid];
      const isH=hid===t.id, host=isH?t:opp, sdv=stadOf(host);
      const md=matchDayOf(r), dt=(G.cal?dateOfDay(md):null);
      const dow=dt?DOW_KR[dt.getDay()]:"";
      const wk = dt ? (dt.getDay()===0||dt.getDay()===6 ? "주말" : dt.getDay()===5 ? "금요일 저녁" : "주중") : "";
      const est = isH ? attEstimate(t, opp, md) : null;
      return `<b>${opp.name}</b> ${isH?"(홈)":"(원정)"}<br>
      🏟️ ${sdv.n} · ${dt?dateLabel(md):""} <span class="small">${wk}</span><br>
      상대 전력: ${teamStars(opp, opp.short)} · 스타일: <b>${styleName(opp)}</b><br>
      ${(()=>{ try{
        const tb=tableOf(opp.div);
        const op=tb.findIndex(x=>x.id===opp.id)+1, mp=tb.findIndex(x=>x.id===t.id)+1;
        if(!op) return "";
        const oe=tb[op-1];
        return `현재 순위: <b style="color:#fff">${op}위</b> <span class="small">(승점 ${oe.Pts} · ${oe.W}승 ${oe.Dw}무 ${oe.L}패 · 득실 ${oe.GF-oe.GA>0?"+":""}${oe.GF-oe.GA})</span>${mp?` <span class="small" style="color:var(--sub)">— 우리 ${mp}위</span>`:""}<br>`;
      }catch(e){ return ""; } })()}
      최근: ${opp.form.slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")||"-"}
      ${est?`· <span class="small">예상 관중 <b style="color:#fff">${est.lo.toLocaleString()}~${est.hi.toLocaleString()}</b>명</span>`:""}
      <br><span class="small">라운드 ${r+1} — 전술 탭에서 정찰 정보 확인</span>`;
    }
  }
  return "이번 라운드는 휴식입니다. (17팀 체제)";
}
/* 시즌 종료 화면 — 결과 한 줄이 아니라 시상식과 트로피까지 보여 준다 */
function seasonEndPanel(){
  const h=G.history[G.history.length-1];
  if(!h) return "";
  const u=userTeam();
  const mine = h.champ===u.name || h.champ2===u.name;
  const tro=(G.trophies||[]).filter(x=>x.s===G.season);
  const eaclTro=tro.find(x=>x.kind==="eacl"||x.kind==="eaclRunner");
  const eaclBanner = !eaclTro ? "" : (eaclTro.kind==="eacl"
    ? `<div class="msg good" style="border-width:2px;font-size:16px">🌏 <b>${G.season} ${eaclShort()} 우승 — 아시아 챔피언!</b> ${u.name}<br>
       <span class="small">구단 통산 ${eaclShort()} 우승 ${eaclHonorOf(u.id).champ}회</span></div>`
    : `<div class="msg info" style="border-width:2px">🌐 <b>${G.season} ${eaclShort()} 준우승</b> — ${u.name}</div>`);
  const banner = tro.some(x=>x.kind==="champ")
      ? `<div class="msg good" style="border-width:2px;font-size:16px">🏆 <b>${G.season} K리그1 우승!</b> — ${u.name}<br>
         <span class="small">감독 통산 리그 우승 ${(G.trophies||[]).filter(x=>x.kind==="champ").length}회</span></div>`
    : tro.some(x=>x.kind==="champ2"||x.kind==="promo")
      ? `<div class="msg good" style="border-width:2px;font-size:16px">⬆️ <b>승격!</b> — ${u.name}, 다음 시즌 K리그1</div>`
    : tro.some(x=>x.kind==="releg")
      ? `<div class="msg warn" style="border-width:2px;font-size:16px">⬇️ <b>강등</b> — ${u.name}, 다음 시즌 K리그2</div>`
    : tro.some(x=>x.kind==="runner")
      ? `<div class="msg info" style="border-width:2px">🥈 <b>준우승</b> — ${u.name}</div>` : "";
  const xi=(h.bestXI||[]);
  const xiRow=g=>xi.filter(x=>x.pos===g).map(x=>`<b>${x.n}</b><span class="small">(${x.t} ${x.r})</span>`).join(" · ")||"-";
  const cab=(G.trophies||[]).slice().reverse().slice(0,8)
    .map(x=>`<span class="tag">${x.kind==="cwc"?"🌍":x.kind==="cwcRunner"?"🌎":(x.kind==="cwcSF"||x.kind==="cwcQF")?"🌐":x.kind==="eacl"?"🌏":x.kind==="eaclRunner"?"🌐":x.kind==="eaclQF"?"🎽":x.kind==="champ"?"🏆":x.kind==="champ2"||x.kind==="promo"?"⬆️":x.kind==="releg"?"⬇️":"🥈"} ${x.label}</span>`).join(" ");
  return `${eaclBanner}${banner}
  <div class="card">
    <h3>🏁 ${h.season} 시즌 종료 <span class="small">— 내 성적: ${divName(h.userDiv)} <b>${h.userPos}위</b></span></h3>
    <p>K리그1 우승 <b>${h.champ}</b> · K리그2 우승 <b>${h.champ2}</b></p>
    <h3 style="margin-top:12px">🎖️ ${divName(h.userDiv)} 시상식</h3>
    <table style="width:100%">
      <tr><td class="small" style="width:110px">MVP</td><td><b>${h.mvp||"-"}</b></td></tr>
      <tr><td class="small">득점왕</td><td>${h.topScorer||"-"}</td></tr>
      <tr><td class="small">도움왕</td><td>${h.assist||"-"}</td></tr>
      <tr><td class="small">영플레이어</td><td>${h.young||"-"}</td></tr>
      <tr><td class="small">최우수 GK</td><td>${h.gk||"-"}</td></tr>
      <tr><td class="small">올해의 감독</td><td>${h.coach||"-"}</td></tr>
    </table>
    ${xi.length?`<h3 style="margin-top:12px">⭐ 시즌 베스트 11</h3>
      <p class="small">FW &nbsp;${xiRow("FW")}<br>MF &nbsp;${xiRow("MF")}<br>DF &nbsp;${xiRow("DF")}<br>GK &nbsp;${xiRow("GK")}</p>`:""}
    ${cab?`<h3 style="margin-top:12px">🏅 트로피 캐비닛</h3><p>${cab}</p>`:""}
    <p class="small" style="margin-top:10px">좌측 <b>"다음 시즌 시작 ▶▶"</b> 버튼으로 새 시즌을 시작하세요.</p>
  </div>`;
}
