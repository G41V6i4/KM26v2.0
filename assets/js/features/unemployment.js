"use strict";
/* ═══ 🕊️ 무직 감독 — 경질 뒤의 삶 ═══
   경질 → 무직(리그는 AI로 계속 돈다) → 타 구단 지원 or 제의 → 부임.
   평판(mgrRep)이 좋을수록 더 좋은 구단의 문이 열린다. */
function mgrRep(){
  let v=30;
  try{ v+=clamp(mgrPrestige()*0.5, 0, 25); }catch(e){}
  try{ v+=Math.min(20, mgrSeasons()*4); }catch(e){}
  if(G.sack && G.sack.pos) v+=clamp((8-G.sack.pos)*1.5, -10, 8);   // 잘리기 전 순위도 이력서다
  v+=(G.mgrFree && G.mgrFree.repMod)||0;                            // 무직 중 활동(연수·방송·사고)의 흔적
  try{ v+=eaclRepBonus(); }catch(e){}                               // 🌏 아시아 무대 성적 — 이력서에서 가장 눈에 띄는 줄
  /* ⚖️ 누적 징계금 — 물병·폭행·소송의 이력은 이력서보다 오래 남는다.
     (제보 — "벌금 2000억 찍었는데 오퍼가 너무 자주 옴") 100억이면 −15, 400억이면 −30, 그 위는 −35. */
  v-=clamp(Math.sqrt(G.mgrFineTot||0)*1.5, 0, 35);
  return clamp(Math.round(v), 5, 90);
}
function jobTier(t){ return clamp(Math.round(teamOVR(t)-60), 1, 30) + (t.div===1?8:0); }
/* ── 무직 시절의 피드 — 관점이 바뀐다 ──────────────────────────
   팀이 없으니 "우리 팀" 반응이 나올 수 없다. 소셜은 리그 전체를 구경하는 중립 계정들의
   잡담이 되고, 가끔 무직 감독 본인의 근황이 가십으로 오르내린다. */
/* 무직 = 유저가 팀이 없는 것뿐이다. 피드는 여전히 각 구단 "팬"들의 목소리다 —
   이긴 팀 팬은 신나고, 진 팀 팬은 속이 터진다. 매 라운드 결과를 두고 떠든다. */
const SOC_JOBLESS_WIN=[
 ["오늘 {w} 경기력 미쳤다 ㅋㅋ {l} 상대로 완승",1],
 ["{w} {hg}:{ag} 승! 이 맛에 축구 본다",1],
 ["{w} 팬 {n}년차인데 오늘 같은 날이 제일 행복하다",1],
 ["{l}전 이겼으니 이번 주는 발 뻗고 잔다",1],
 ["{w} 이 기세면 순위 더 올라간다 진짜",1]];
const SOC_JOBLESS_LOSE=[
 ["{l} 이게 뭐냐 진짜... {w}한테 이렇게 지는 게 맞냐",-1],
 ["{l} {hg}:{ag} 패배. 오늘 경기 본 시간 환불해 달라",-1],
 ["{l} 감독은 오늘 라인업 설명 좀 해봐라",-1],
 ["또 졌네... {l} 팬은 인내심 수련하는 자리다",-1],
 ["{w}전 지고 나니까 다음 경기가 벌써 무섭다",-1]];
const SOC_JOBLESS_DRAW=[
 ["{h} {hg}:{ag} {a} — 이길 수 있는 경기를 비겼다 답답하네",0],
 ["무승부면 뭐... 승점 1점이라도 챙긴 걸 다행으로 여겨야 하나",0],
 ["{h}전 비긴 게 잘한 건지 못한 건지 모르겠다",0]];
const SOC_JOBLESS_MGR=[
 ["{m} 요즘 뭐 하나 했더니 경기장에서 직관하고 있더라",0],
 ["{m} 야인 생활 {w}주차. 슬슬 어디든 잡는 거 아니냐",0],
 ["{m} 다음 행선지 어디일 것 같음? 하위권 쪽 물밑 접촉설 돈다",0],
 ["잘린 감독치고 평가 나쁘지 않던데. 재취업 금방 할 듯",1],
 ["{t}는 감독 자르고 뭐가 나아졌냐? ㅋㅋ",-1],
 ["{m} 해설위원 하면 잘할 것 같지 않냐",1]];
const FMK_JOBLESS=[
 ["{m} 근황: 무직 {w}주차 ㅋㅋ 직관석에서 목격됨",0],
 ["감독 없는 삶 개꿀일 듯. 매주 욕 안 먹잖아",1],
 ["{m} 유튜브나 해라 전술 분석 컨텐츠 각인데",1],
 ["{t} 팬들아 니네 전 감독 요즘 평화로워 보이더라",0],
 ["무직 감독 특) 남의 경기 보면서 훈수 두고 싶어서 손이 떨림",1],
 ["이번 주도 감독 시장 조용하네. {m} 몸값 떨어지는 소리 들린다",-1]];
/* ── 🎲 무직 인카운터 — 야인 생활에도 일은 벌어진다 ──
   틱마다 낮은 확률로 하나가 열리고, 무직 홈 화면의 카드에서 선택한다. 2주 방치하면 조용히 사라진다. */
const JOBLESS_ENC={
  tv:{ ic:"📺", t:"방송 해설 출연 제의",
    d:"케이블 축구 채널에서 주말 경기 해설을 제안했습니다. 출연료도 괜찮고, 얼굴을 비추면 감독 시장에 이름이 다시 돌 겁니다. 다만 생방송은 말 한마디가 무섭습니다.",
    a:"🎙️ 출연한다", b:"거절한다" },
  study:{ ic:"✈️", t:"해외 지도자 연수", cost:3,
    d:"협회 소개로 유럽 구단 2주 참관 연수 자리가 났습니다. 사비 3억이 들지만, 이력서에 '최신 전술 연수' 한 줄이 생깁니다.",
    a:"✈️ 떠난다 (−3억)", b:"보류한다" },
  lecture:{ ic:"🎓", t:"축구협회 특강 요청",
    d:"지도자 과정 수강생들에게 '실전 감독론' 특강을 해달라는 요청입니다. 강사료 1억. 협회에 눈도장도 찍힙니다.",
    a:"🎓 수락한다 (+1억)", b:"거절한다" },
  inter:{ ic:"🗞️", t:"언론 인터뷰 요청",
    d:"스포츠지에서 근황 인터뷰를 요청했습니다. 담백하게 갈 수도, 경질시킨 전 구단을 저격해 화제를 만들 수도 있습니다.",
    a:"🔥 전 구단을 저격한다", b:"🍵 담백하게 근황만" },
  pupil:{ ic:"🍚", t:"옛 제자의 연락",
    d:"전 구단에서 지도했던 선수가 밥을 사겠다며 연락해 왔습니다. \"감독님 요즘 어떠세요. 저희끼리는 아직 감독님 얘기 합니다.\"",
    a:"🍚 만나러 간다", b:"다음에 보자고 한다" },
  chicken:{ ic:"🍗", t:"치킨집 창업 권유", cost:5,
    d:"지인이 상가 자리가 났다며 치킨집 동업을 제안합니다. \"감독님 이름 걸면 대박이에요.\" ...축구계가 이 소식을 들으면 어떻게 볼지는 모르겠습니다.",
    a:"🍗 차린다 (−5억)", b:"정중히 거절한다" }
};
function joblessEncTick(){
  const J=G.mgrFree; if(!J || J.enc) return;
  if(Math.random()>0.22) return;
  const keys=Object.keys(JOBLESS_ENC).filter(k=>!(J.encDone&&J.encDone[k]) && !(k==="chicken"&&J.chicken));
  if(!keys.length) return;
  const k=pick(keys);
  J.enc={k, until:(G.day||0)+14};
  notify(`${JOBLESS_ENC[k].ic} <b>${JOBLESS_ENC[k].t}</b> — 무직 홈 화면에서 확인하세요.`,"info");
}
/* 인카운터 — 클릭하고 끝이 아니라, 그 자리에서 무슨 일이 벌어졌는지 장면으로 보여준다.
   (제보 — "치킨집·해설·연수·강연 다 해봤는데 클릭하고 끝이라는 느낌. 결과를 딴 탭 가야만 안다") */
function joblessEncScene(o){
  VIEW="home";
  $("#main").innerHTML=`<h2>${o.ic} ${o.t}</h2>
  <div class="card stCard">
    ${o.body}
    ${o.fx&&o.fx.length?`<div class="msg info" style="margin-top:10px">${o.fx.join("<br>")}</div>`:""}
    ${o.soc&&o.soc.length?`<div style="margin-top:8px;border-top:1px solid var(--line);padding-top:8px"><div class="small" style="opacity:.7;margin-bottom:2px">실시간 반응</div>${o.soc.map(s=>`<div class="small" style="padding:2px 0">${s}</div>`).join("")}</div>`:""}
    <button class="bigbtn" style="max-width:260px;margin-top:14px" onclick="show('home')">확인 ▶</button>
  </div>`;
}
function repFx(before){
  const after=mgrRep(), d=after-before;
  return `📇 감독 평판 <b>${before}</b> → <b style="color:${d>=0?"var(--green)":"var(--red)"}">${after}</b> (${d>=0?"+":""}${d})`;
}
function joblessEncChoose(ok){
  const J=G.mgrFree; if(!J || !J.enc) return;
  const k=J.enc.k, E=JOBLESS_ENC[k], mv={m:joblessMgrName(), t:J.from?(G.teams[J.from]||{}).short||"":""};
  if(!J.encDone) J.encDone={};
  const rep0=mgrRep();
  J.encDone[k]=1; J.enc=null;
  J.repMod=J.repMod||0;
  if(!ok){ // 거절/보류 — 담백 인터뷰만 예외적으로 소소한 이득
    if(k==="inter"){
      J.repMod+=1;
      addNews(`🗞️ ${joblessMgrName()}, 인터뷰에서 담담한 근황 — "축구는 늘 그립습니다."`);
      const s=F_("{m} 인터뷰 봤는데 점잖게 잘하더라. 어디든 곧 잡을 듯",{m:mv.m});
      pushSocial(s, 1); saveGame();
      joblessEncScene({ic:"🍵", t:"담백한 근황 인터뷰",
        body:`<p>저격 대신 담백함을 골랐습니다. "선수들이 그립습니다. 축구는 늘 그립습니다." — 짧은 기사가 조용히 좋은 인상을 남겼습니다.</p>`,
        fx:[repFx(rep0)], soc:["💬 "+s]});
      return;
    }
    saveGame(); show("home"); return;
  }
  if(k==="tv"){ saveGame(); tvSceneStart(rep0); return; }
  if(k==="study"){
    if(me().cash<3){ flash("사비가 부족합니다 (3억 필요).","warn"); J.encDone[k]=0; J.enc={k, until:(G.day||0)+7}; show("home"); return; }
    mePay(-3, "해외 지도자 연수");
    J.repMod+=5;
    addNews(`✈️ ${joblessMgrName()}, 유럽 구단 참관 연수 — "돌아오면 다른 감독이 되어 있을 것"`);
    const s=F_("{m} 유럽 연수 갔다더라. 준비된 감독이라는 소리 나온다",{m:mv.m});
    pushSocial(s, 1); saveGame();
    const learn=pick([
      "하이 프레스 발동 신호를 \'상대 패스 속도\'로 잡는 훈련이 인상적이었습니다",
      "세트피스 전담 코치가 코너킥 하나를 하루 세 시간씩 다듬고 있었습니다",
      "유스 훈련장부터 1군과 똑같은 전술 용어를 쓰고 있었습니다",
      "경기 다음 날 회복 훈련이 데이터로만 굴러가는 걸 봤습니다"]);
    joblessEncScene({ic:"✈️", t:"해외 지도자 연수 — 2주 참관기",
      body:`<p>유럽 구단 훈련장에서 2주. 수첩 세 권이 가득 찼습니다.</p>
      <p class="small">✍️ ${learn}. 이력서에 \'최신 전술 연수\' 한 줄이 생겼고, 감독 시장에 "준비된 감독"이라는 말이 돌기 시작합니다.</p>`,
      fx:[`💸 사비 −3억 (연수비)`, repFx(rep0)], soc:["💬 "+s]});
    return;
  }
  if(k==="lecture"){
    mePay(1, "축구협회 특강료");
    J.repMod+=2;
    addNews(`🎓 ${joblessMgrName()}, 지도자 과정 특강 — "경질도 커리어다" 발언에 웃음바다`);
    const f=F_("{m} 특강 짤 돌던데 \"경질도 커리어다\" ㅋㅋ 멘탈 좋네",{m:mv.m});
    fmkPush(f, 1); saveGame();
    const q=pick(["감독님, 다시 돌아가면 뭘 바꾸시겠어요?","선수단 장악은 어떻게 하는 건가요?","경질 통보받던 날 얘기를 해 주실 수 있나요?"]);
    joblessEncScene({ic:"🎓", t:"축구협회 특강 — 실전 감독론",
      body:`<p>지도자 과정 강의실. "경질도 커리어다"라는 첫마디에 웃음이 터졌고, 두 시간이 순식간에 갔습니다.</p>
      <p class="small">🙋 마지막 질문 — "${q}" — 이 질문에 답하는 데 가장 오래 걸렸습니다. 협회에 눈도장은 확실히 찍었습니다.</p>`,
      fx:[`💰 강사료 +1억`, repFx(rep0)], soc:["🔥 "+f]});
    return;
  }
  if(k==="inter"){
    J.repMod+=2;
    addNews(`🗞️ [단독] ${joblessMgrName()}, 전 구단 작심 발언 — "선수단은 좋았다. 문제는 위에 있었다"`);
    const s1=F_("{m} 저격 인터뷰 떴다 ㅋㅋ {t} 프런트 발끈하겠는데",mv);
    const f1=F_("{m} 인터뷰 수위 보소 ㅋㅋ 다리 불태우네. 근데 화제성은 확실히 잡음",mv);
    const f2=F_("{t} 팬인데 저 말 반박을 못 하겠다...",mv);
    pushSocial(s1, 0); fmkPush(f1, 0); fmkPush(f2, -1); saveGame();
    joblessEncScene({ic:"🗞️", t:"작심 인터뷰 — 다음 날 아침",
      body:`<div class="msg warn" style="font-size:15px">🗞️ [단독] ${joblessMgrName()}, 전 구단 작심 발언 — "선수단은 좋았다. 문제는 위에 있었다"</div>
      <p class="small" style="margin-top:8px">기사가 포털 메인에 걸렸습니다. 다리는 불탔지만, 이름은 다시 오르내립니다. ${mv.t||"전 구단"} 프런트와의 재회는... 어색해질 겁니다.</p>`,
      fx:[repFx(rep0)], soc:["💬 "+s1, "🔥 "+f1, "🔥 "+f2]});
    return;
  }
  if(k==="pupil"){
    mePay(-0.2, "옛 제자와 식사");
    J.repMod+=1;
    meLog("🍚 옛 제자와 저녁 — 오랜만에 축구 얘기로 웃었다.");
    const s=F_("어제 고깃집에서 {m}이랑 {t} 선수 같이 있는 거 봤다는 목격담 떴다. 훈훈하네",mv);
    pushSocial(s, 1); saveGame();
    joblessEncScene({ic:"🍚", t:"옛 제자와의 저녁",
      body:`<p>고깃집 구석 자리. 옛 제자가 고기를 뒤집으며 말합니다 — "저희끼리는 아직 감독님 얘기 합니다. 훈련 빡세다고 욕하던 애들이 제일 많이 해요."</p>
      <p class="small">밥값은 감독이 냈습니다 (−0.2억). 돌아오는 길이 오랜만에 가벼웠습니다.</p>`,
      fx:[repFx(rep0)], soc:["💬 "+s]});
    return;
  }
  if(k==="chicken"){
    if(me().cash<5){ flash("사비가 부족합니다 (5억 필요).","warn"); J.encDone[k]=0; J.enc={k, until:(G.day||0)+7}; show("home"); return; }
    mePay(-5, "치킨집 개업");
    J.chicken=1; J.chickenTot=0; J.repMod-=2;
    addNews(`🍗 ${joblessMgrName()}, 치킨집 개업 — 간판은 "볼 점유율 치킨"`);
    const f1=F_("{m} 치킨집 차림 ㅋㅋㅋㅋ 개업 화환에 전 구단 서포터즈 이름 있던데",mv);
    fmkPush(f1, 1);
    fmkPush("볼 점유율 치킨 ㅋㅋ 4-4-2 세트 시키면 윙 8조각 오냐", 1);
    const s1=F_("{m} 이제 축구 접는 건가... 치킨은 맛있다더라",mv);
    pushSocial(s1, 0); saveGame();
    joblessEncScene({ic:"🍗", t:"볼 점유율 치킨 — 개업식",
      body:`<p>간판이 올라갑니다 — <b>볼 점유율 치킨</b>. 가게 앞에 화환이 늘어섰습니다.</p>
      <p class="small">🌸 "개업 축하드립니다 — ${mv.t||"전 구단"} 서포터즈 일동" · 🌸 "치킨은 점유율보다 맛입니다 — 지도자 동기 일동"</p>
      <p class="small" style="margin-top:6px">이제 라운드마다 정산이 <b>알림으로</b> 들어오고, 무직 홈 화면의 🍗 카드에서 누적 매출과 손님 리뷰를 볼 수 있습니다. 축구계 평판은... 조금 잃었습니다.</p>`,
      fx:[`💸 사비 −5억 (개업 비용)`, repFx(rep0)], soc:["🔥 "+f1, "💬 "+s1]});
    return;
  }
  saveGame(); show("home");
}
/* ── 📺 생방송 해설 미니게임 — 코멘트 세 번, 수위는 감독 마음.
   센 발언일수록 화제성(평판)이 크지만 실언 확률이 쌓인다. ── */
let TVS=null;
const TV_STEPS=[
 {q:`중계 시작 10분 전, 캐스터가 마이크를 넘깁니다 — "오늘 {h} 대 {a}, 관전 포인트 하나만 짚어 주시죠."`,
  opts:[
   {t:`🎙️ 교과서 전망 — "중원 싸움이 관건입니다"`, rep:1, risk:0, cm:"무난한 출발. 제작진이 고개를 끄덕입니다."},
   {t:`📊 소신 분석 — "{a} 수비 뒷공간, 오늘 반드시 뚫립니다"`, rep:2, risk:0.08, cm:"단호한 분석에 스튜디오 공기가 팽팽해집니다."},
   {t:`🔥 작심 발언 — "양 팀 다 감독이 문제예요"`, rep:3, risk:0.30, cm:"PD가 헤드셋을 고쳐 씁니다. 시청자 게시판이 벌써 시끄럽습니다."}]},
 {q:`전반 종료 직전, {h}의 골이 오프사이드로 취소됩니다. 리플레이는 애매합니다. 캐스터가 묻습니다 — "감독님 보시기엔 어떻습니까?"`,
  opts:[
   {t:`🎙️ 중립 유지 — "판독 화면상 근거는 있어 보입니다"`, rep:1, risk:0, cm:"안전 운전. 판정 논란은 넘어갑니다."},
   {t:`📊 소신 판정 — "이건 온사이드예요. 오늘 판정 기준이 흔들립니다"`, rep:2, risk:0.10, cm:"자막으로 박제됐습니다. 심판계가 들었을 겁니다."},
   {t:`🔥 직격 — "이 정도면 심판이 경기를 망치고 있는 거죠"`, rep:4, risk:0.35, cm:"스튜디오가 조용해집니다. 실시간 검색어가 움직입니다."}]},
 {q:`경기 종료. 마무리 멘트 시간입니다. PD가 손가락으로 10초를 셉니다.`,
  opts:[
   {t:`🎙️ 모범 답안 — "좋은 경기였습니다. 시청해 주셔서 감사합니다"`, rep:1, risk:0, cm:"깔끔한 마무리."},
   {t:`😏 셀프 어필 — "저라면 오늘 {a}를 다르게 운영했을 겁니다"`, rep:2, risk:0.08, cm:"감독 시장에 보내는 공개 이력서였습니다."},
   {t:`🔥 폭탄 발언 — "솔직히 저 벤치보다는 제가 낫습니다"`, rep:3, risk:0.30, cm:"캐스터가 급히 클로징 멘트를 덮습니다."}]}];
function tvSceneStart(rep0){
  const ts=Object.values(G.teams).filter(t=>t.div===1&&!t.isUser);
  const h=pick(ts); let a=pick(ts); let gd=0; while(a.id===h.id && gd++<9) a=pick(ts);
  TVS={i:0, rep:0, risk:0, log:[], h:h.short, a:a.short, rep0:rep0};
  renderTvScene();
}
function renderTvScene(){
  if(!TVS) return;
  const st=TV_STEPS[TVS.i], vars={h:TVS.h, a:TVS.a};
  VIEW="home";
  $("#main").innerHTML=`<h2>📺 생방송 해설 — ${TVS.h} vs ${TVS.a}</h2>
  <div class="msg info">🔴 <b>ON AIR</b> · 코멘트 ${TVS.i+1}/${TV_STEPS.length} — 수위가 셀수록 화제성(평판)이 크지만, <b>실언 확률</b>이 쌓입니다. ${TVS.risk>0?`현재 누적 위험 <b style="color:var(--red)">${Math.round(TVS.risk*100)}%</b>`:"아직 안전 운행 중"}</div>
  ${TVS.log.length?`<div class="card">${TVS.log.map(l=>`<p class="small" style="margin:3px 0">🎙️ ${l.pick}<br><span style="opacity:.7">— ${l.cm}</span></p>`).join("")}</div>`:""}
  <div class="card">
    <p>${F_(st.q, vars)}</p>
    ${st.opts.map((o,i)=>`<button class="mini" style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:10px${i===2?";border-color:var(--red);color:#ff9d95":i===1?";border-color:var(--gold)":""}" onclick="tvPick(${i})">${F_(o.t, vars)} <span class="small">(${o.risk>0?`실언 +${Math.round(o.risk*100)}%`:"안전"})</span></button>`).join("")}
  </div>`;
}
function tvPick(j){
  if(!TVS) return;
  const st=TV_STEPS[TVS.i], o=st.opts[j], vars={h:TVS.h, a:TVS.a};
  TVS.rep+=o.rep; TVS.risk+=o.risk;
  TVS.log.push({pick:F_(o.t, vars), cm:o.cm});
  TVS.i++;
  if(TVS.i<TV_STEPS.length) renderTvScene(); else tvResolve();
}
function tvResolve(){
  const J=G.mgrFree; if(!J){ TVS=null; show("home"); return; }
  J.repMod=J.repMod||0;
  const mvm=joblessMgrName();
  const fee=2+R(2); mePay(fee, "방송 해설 출연료");
  const slip=Math.random()<clamp(TVS.risk, 0, 0.75);
  const fx=[`💰 출연료 +${fee}억`], soc=[];
  const recap=TVS.log.map(l=>`<p class="small" style="margin:3px 0">🎙️ ${l.pick}<br><span style="opacity:.7">— ${l.cm}</span></p>`).join("");
  let body;
  if(slip){
    J.repMod-=4;
    addNews(`📺 ${mvm}, 생방송 해설 중 실언 — 발언 수위 논란`);
    const f1=F_("{m} 해설하다 사고침 ㅋㅋㅋ 수위 조절 실패. 저러니 잘리지",{m:mvm});
    fmkPush(f1, -1); soc.push("🔥 "+f1);
    body=`${recap}<div class="msg warn" style="margin-top:10px">💥 <b>방송 사고.</b> 수위 높은 발언 하나가 그대로 잘려 나가 온라인에 박제됐습니다. 다음 날 아침, 사과 요구 기사가 떴습니다.</div>`;
  } else {
    const gain=Math.max(1, TVS.rep);
    J.repMod+=gain;
    addNews(`📺 ${mvm}, 주말 경기 해설 데뷔 — ${TVS.risk>0.3?"아슬아슬했지만 화제성 만점":"차분한 진행으로 호평"}`);
    const s1=F_(TVS.risk>0.3?"{m} 해설 수위 보소 ㅋㅋ 근데 맞는 말만 해서 못 끊겠음":"{m} 해설 은근 잘하네 ㅋㅋ 현장 감각 살아있다. 재취업 각",{m:mvm});
    pushSocial(s1, 1); soc.push("💬 "+s1);
    const f2=F_("{m} 해설 데뷔 봤냐 전술 짚는 게 다르긴 하더라",{m:mvm});
    fmkPush(f2, 1); soc.push("🔥 "+f2);
    body=`${recap}<div class="msg good" style="margin-top:10px">📺 <b>방송 종료.</b> ${TVS.risk>0.3?"수위는 아슬아슬했지만 무사히 끝났고, 화제성은 확실히 잡았습니다.":"차분한 진행으로 무사히 끝났습니다."} 감독 시장에 이름이 다시 돌기 시작합니다.</div>`;
  }
  fx.push(repFx(TVS.rep0));
  saveGame();
  joblessEncScene({ic:"📺", t:slip?"생방송 해설 — 사고":"생방송 해설 — 무사 종료", body, fx, soc});
  TVS=null;
}
function joblessMgrName(){
  const J=G.mgrFree||{};
  const t=J.from?G.teams[J.from]:null;
  return t?`전 ${t.short} 감독`:"그 무직 감독";
}
function joblessSocialTick(){
  const J=G.mgrFree; if(!J) return;
  const mv={m:joblessMgrName(), t:J.from?(G.teams[J.from]||{}).short||"":"", w:J.weeks||1};
  /* ① 이번 라운드 결과 — 각 팀 팬들이 자기 팀 경기를 두고 떠든다 (이긴 팬은 신나고, 진 팬은 터진다) */
  const recent=(G.results||[]).slice(-11).filter(r=>r.s===G.season);
  if(recent.length){
    const n=2+R(2);
    for(let i=0;i<n;i++){
      const r=pick(recent);
      const h=G.teams[r.hid], a=G.teams[r.aid];
      if(!h||!a) continue;
      const win = r.hg>r.ag?h : r.ag>r.hg?a : null;
      const lose= r.hg>r.ag?a : r.ag>r.hg?h : null;
      const vars={h:h.short, a:a.short, hg:r.hg, ag:r.ag, w:win?win.short:"", l:lose?lose.short:"", n:1+R(15)};
      const it = !win ? pick(SOC_JOBLESS_DRAW)
               : Math.random()<0.5 ? pick(SOC_JOBLESS_WIN) : pick(SOC_JOBLESS_LOSE);
      pushSocial(F_(it[0], vars), it[1]);
    }
  }
  /* ② 무직 감독 본인 가십 */
  if(Math.random()<0.35){ const it=pick(SOC_JOBLESS_MGR); pushSocial(F_(it[0], mv), it[1]); }
  if(Math.random()<0.35){ const it=pick(FMK_JOBLESS); fmkPush(F_(it[0], mv), it[1]); }
  /* ③ 시모·독고는 무직도 놓치지 않는다 (요청 — 이쪽 문도 넓힌다) */
  if(Math.random()<0.15 && G.fmk){
    const h2=pick(SOC_TROLL);
    G.fmk.unshift({txt:pick(TROLL_JOBLESS),
      tone:-1, u:h2[0], e:h2[1], up:R(25), dn:120+R(400), v:800+R(4000),
      d:(G.day||0), s:G.season, sd:"o", troll:1});
    G.fmk=trimBySide(G.fmk, FMK_MAX);
  }
}
/* 라운드마다 — 제의가 오거나, 온 제의가 삭는다 */
function joblessTick(){
  const J=G.mgrFree; if(!J) return;
  J.weeks=(J.weeks||0)+1;
  try{ joblessSocialTick(); }catch(e){}
  try{ joblessEncTick(); }catch(e){}
  if(J.enc && (G.day||0)>J.enc.until) J.enc=null;              // 2주 방치 — 조용히 사라진다
  if(J.chicken && Math.random()<0.3){
    const inc=Math.round((0.2+R(4)/10)*100)/100;
    mePay(inc, "치킨집 수입");
    J.chickenTot=Math.round(((J.chickenTot||0)+inc)*100)/100; J.chickenLast=inc;
    notify(`🍗 볼 점유율 치킨 정산 <b>+${inc}억</b> (누적 ${J.chickenTot}억)`,"info");
    if(Math.random()<0.25) fmkPush(pick([
      "볼 점유율 치킨 갔다 옴. 사장님이 계속 전술 얘기함 ㅋㅋ",
      "치킨집 사장님(전 감독)이 포장 기다리는 동안 K리그 중계 틀어놓고 훈수 두더라",
      "볼 점유율 치킨 후기: 반반 시켰더니 \"밸런스가 중요하다\"고 하심"]), 1);
  }
  J.off=(J.off||[]).filter(o=>{
    if((G.day||0)>o.due){ addNews(`📪 ${(G.teams[o.tid]||{}).name||"구단"}의 감독직 제의가 철회되었습니다.`); return false; }
    return true;
  });
  if(J.off.length>=2 || Math.random()<0.5) return;
  const rep=mgrRep();
  const cands=Object.values(G.teams).filter(t=>!t.isUser && t.id!==J.from && !J.off.some(o=>o.tid===t.id));
  for(const t of cands){
    const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1, n=tbl.length;
    const bad=clamp((pos-n*0.5)/n, -0.5, 0.5);                    // 하위권일수록 감독을 갈고 싶다
    const losses=t.form.slice(-5).filter(x=>x==="L").length;
    let w=0.015 + bad*0.10 + losses*0.02;
    w*=clamp(1+(rep-jobTier(t)*2)/60, 0.3, 2.0);                  // 급이 안 맞으면 연락도 없다
    if(rep<30) w*=clamp((rep-4)/50, 0.04, 1);                     // 평판이 바닥(징계 이력 등)이면 전화기가 조용하다
    if(Math.random()<clamp(w,0,0.28)){
      J.off.push({tid:t.id, due:(G.day||0)+14});
      addNews(`📬 <b>${t.name}</b>이(가) 감독직을 제의했습니다 — 2주 안에 답해야 합니다.`, "good");
      notify(`📬 <b>${t.name}</b> 감독직 제의가 도착했습니다!`,"good");
      /* 🕊️ 무직에게 이보다 중요한 일은 없다 — 일정 진행을 여기서 멈춘다 (제보) */
      G._jobOfferPing={tid:t.id, name:t.name, short:t.short, div:t.div};
      /* 제의설은 곧바로 커뮤니티에 샌다 */
      try{
        pushSocial(fixJosa(F_(pick([
          ["{o}이/가 {m}한테 접촉했다는 소문 있던데",0],
          ["{o} 차기 감독 후보에 {m} 올랐다는 기사 봤냐",0],
          ["{o} 지금 감독 바꿀 때 되긴 했지",0]])[0], {o:t.short, m:joblessMgrName()})), 0);
        fmkPush(fixJosa(F_(pick([
          "{o} → {m} 제의설 떴다 ㅋㅋ 성사되면 꿀잼",
          "{o}이/가 {m} 데려간다고? 이 리그 감독 시장 좁긴 좁다"]), {o:t.short, m:joblessMgrName()})), 0);
      }catch(e){}
      break;
    }
  }
}
function applyJob(tid){
  const J=G.mgrFree; if(!J) return;
  const t=G.teams[tid]; if(!t || t.isUser) return;
  if((J.block[tid]||0) > (G.day||0)){ flash("최근에 거절당한 구단입니다 — 시간을 두고 다시 지원하세요.","warn"); show("home"); return; }
  const rep=mgrRep();
  const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1, n=tbl.length;
  const struggling = pos>n*0.65 || t.form.slice(-5).filter(x=>x==="L").length>=3;
  let pr=0.16 + (rep-jobTier(t)*2)/100 + (struggling?0.22:0) - (t.div===1?0.06:0);
  pr=clamp(pr, 0.04, 0.75);
  if(Math.random()<pr){
    if(!J.off.some(o=>o.tid===tid)) J.off.push({tid, due:(G.day||0)+10});
    saveGame();
    showConfirm(`<b>📬 ${t.name}이(가) 지원을 긍정적으로 검토했습니다!</b>

· 현재 ${divName(t.div)} ${pos}위 (최근 5경기 ${t.form.slice(-5).join(" ")||"-"})
· 지금 부임하시겠습니까?

<span class="small">보류하면 제의 목록에 열흘간 남아 있습니다.</span>`,
      ()=>takeJob(tid), {okLabel:"🤝 부임한다", cancelLabel:"보류"});
  } else {
    J.block[tid]=(G.day||0)+35;
    addNews(`📪 ${t.name} — "현 체제를 유지하기로 했습니다." (감독직 지원 거절)`);
    try{ fmkPush(F_(pick([
      "{m}이 {o}에 지원했다가 까였다는 소문 ㅋㅋ",
      "{o}: \"현 체제 유지\" = 정중한 거절 공식 멘트지",
      "{m} 재취업 쉽지 않네. 눈을 낮추든가 해야"]), {o:t.short, m:joblessMgrName()}), -1); }catch(e){}
    flash(`📪 ${t.short}이(가) 정중히 거절했습니다. (35일간 재지원 불가)`,"warn");
    saveGame(); show("home");
  }
}
function declineJobOffer(tid){
  const J=G.mgrFree; if(!J) return;
  J.off=(J.off||[]).filter(o=>o.tid!==tid);
  addNews(`🙅 ${(G.teams[tid]||{}).name||"구단"}의 감독직 제의를 거절했습니다.`);
  saveGame(); show("home");
}
function takeJob(tid){
  const t=G.teams[tid]; if(!t) return;
  const J=G.mgrFree||{};
  const old=J.from?G.teams[J.from]:null;
  t.isUser=true; G.userTeamId=tid;
  G.jobless=0; G.mgrFree=null; G._jobOfferPing=null;
  try{ cvOpenSpell(tid); }catch(e){}      // 📜 감독 경력 장부 — 새 구단 부임 (요청)
  G.trust={owner:56+R(10), fans:50+R(12), log:[]};
  G.press={rel:50, skip:(G.press&&G.press.skip)||0};
  G.board={stage:0, ultiFrom:null, ultiPts:0, warned:0, ultiCool:0, ultiSaved:0};
  G.hiredAtR = t.div===1?G.r1:G.r2;
  /* 📜 부임 계약 — 구단 규모와 감독 평판이 조건을 정한다 */
  G.mgrCt=null;
  {
    const rep0=(typeof mgrRep==="function")?mgrRep():40;
    const yrs = rep0>=62 ? 3 : rep0>=42 ? 2+ (Math.random()<0.4?1:0) : 2;
    const wg  = Math.round(mgrWageBase(t)*(0.86+clamp((rep0-40)/100,0,0.34))*10)/10;
    mgrSignContract(yrs, wg, 0);
  }
  G.goal=null;                                     // 중도 부임 — 이번 시즌 공식 목표는 없다
  G.userXI=null;
  if(t.tactic){ t.tactic.benchSel=[]; t.tactic.benchExcl=[]; t.tactic.benchManual=false; }
  for(const p of t.players){ affSet(p, 48+R(12)); p.talkR=-9; }
  if(J.chicken){ meLog("🍗 볼 점유율 치킨 — 감독 복귀로 사장님 대행 체제 전환."); try{ fmkPush("볼 점유율 치킨 사장님 감독 복귀 ㅋㅋ 가게는 이모님이 보신다더라", 1); }catch(e){} }
  meLog(`🤝 ${t.name} 감독 부임 — 월급이 다시 나온다.`);
  addNews(`🤝 <b>${t.name}, 신임 감독 선임</b> — ${old?`전 ${old.name} 감독이 지휘봉을 잡는다`:"새 사령탑 부임"}`, "good");
  try{ socialFill(SOC.hiredNew, 3+R(2), 0, {t:t.short}); fmkFill(FMK.hiredNew, 2+R(2), {t:t.short}); }catch(e){}
  saveGame();
  show("home");
  { const c=mgrCt();
    notify(`🤝 <b>${t.name}</b> 감독으로 부임했습니다 — <b>${c?c.years:2}년</b> 계약 · 연봉 <b>${c?c.wage:0}억</b>. 유예 ${SACK_GRACE}라운드 안에 팀을 파악하세요.`,"good"); }
}
/* 무직 홈 화면 */
function joblessView(){
  const J=G.mgrFree||{off:[],block:{},weeks:0};
  const rep=mgrRep();
  const offCards=(J.off||[]).map(o=>{
    const t=G.teams[o.tid]; if(!t) return "";
    const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1;
    const left=Math.max(0, o.due-(G.day||0));
    return `<div class="card" style="border-color:var(--gold)">
      <h3>📬 ${t.name} <span class="small">— ${divName(t.div)} ${pos}위 · 답변 기한 D-${left}</span></h3>
      <p class="small">최근 5경기: ${t.form.slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")||"-"} · 예산 ${t.budget}억 · 스쿼드 ${t.players.length}명</p>
      <div style="display:flex;gap:8px">
        <button class="mini" style="flex:1;padding:10px;border-color:var(--gold);color:var(--gold);font-weight:800" onclick="takeJob('${t.id}')">🤝 수락하고 부임</button>
        <button class="mini" style="padding:10px" onclick="declineJobOffer('${t.id}')">거절</button>
      </div></div>`;
  }).join("");
  const rows=Object.values(G.teams).filter(t=>!t.isUser && t.id!==J.from)
    .sort((a,b)=>a.div-b.div || (tableOf(a.div).findIndex(x=>x.id===a.id)) - (tableOf(b.div).findIndex(x=>x.id===b.id)))
    .map(t=>{
      const tbl=tableOf(t.div), pos=tbl.findIndex(x=>x.id===t.id)+1;
      const blocked=(J.block[t.id]||0) > (G.day||0);
      return `<tr><td>${divName(t.div)}</td><td><b>${t.name}</b></td><td>${pos}위</td>
        <td>${t.form.slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")||"-"}</td>
        <td>${blocked?`<span class="small">재지원 대기</span>`:`<button class="mini" style="padding:2px 10px" onclick="applyJob('${t.id}')">📨 지원</button>`}</td></tr>`;
    }).join("");
  /* 📜 요청 — 무직일 때야말로 이력서를 들여다보게 된다. 같은 탭을 여기도 단다. */
  const ofcBtn=(k,l)=>`<button class="mini ${ofcTab===k?"sel":""}" style="padding:8px 16px;font-size:14px" onclick="ofcSetTab('${k}')">${l}</button>`;
  const ofcTabs=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px">${ofcBtn("now","🕊️ 현황")}${ofcBtn("cv","📜 경력")}</div>`;
  if(ofcTab==="cv") return `<h2>🕊️ 무직 감독</h2>${ofcTabs}${(function(){ try{ return careerView(); }catch(e){ return `<div class="card"><p class="small">경력을 불러오지 못했습니다: ${e.message}</p></div>`; } })()}`;
  return `<h2>🕊️ 무직 감독</h2>
  ${ofcTabs}
  <div class="msg warn"><b>${(G.sack&&G.sack.team)||"전 구단"}</b>에서 ${leaveWay().past} 뒤 ${J.weeks||0}주째 — 월급은 끊겼지만 집세는 나갑니다.
    리그는 계속 돌아갑니다. <b>진행 ▶</b>으로 시간을 보내면 제의가 오고, 아래에서 직접 지원할 수도 있습니다.</div>
  <div class="card"><h3>📇 감독 평판 <b style="color:var(--gold)">${rep}</b><span class="small"> /90 — 위신·경력·마지막 성적으로 계산됩니다. 평판보다 급이 높은 구단은 연락이 잘 오지 않습니다.</span></h3>
    <p class="small">${leaveWay().why}: ${(G.sack&&G.sack.reason)||"-"} · 당시 성적 ${(G.sack&&G.sack.rec)||"-"} (${(G.sack&&G.sack.pos)||"-"}위)</p>
    ${(G.mgrFineTot||0)>=10?`<p class="small" style="color:var(--red)">⚖️ 커리어 누적 징계금 <b>${Math.round(G.mgrFineTot)}억</b> — 이 이력이 평판을 깎고, 구단들의 연락을 머뭇거리게 합니다.</p>`:""}</div>
  ${J.enc&&JOBLESS_ENC[J.enc.k]?(()=>{ const E=JOBLESS_ENC[J.enc.k];
    return `<div class="card" style="border-color:var(--green)">
      <h3>${E.ic} ${E.t} <span class="small">— D-${Math.max(0,J.enc.until-(G.day||0))}</span></h3>
      <p class="small" style="margin:4px 0 10px">${E.d}</p>
      <div style="display:flex;gap:8px">
        <button class="mini" style="flex:1;padding:10px;border-color:var(--green);color:var(--green);font-weight:700" onclick="joblessEncChoose(true)">${E.a}</button>
        <button class="mini" style="padding:10px" onclick="joblessEncChoose(false)">${E.b}</button>
      </div></div>`; })():""}
  ${J.chicken?`<div class="card"><h3>🍗 볼 점유율 치킨 <span class="small">— 영업 중</span></h3>
    <p class="small">누적 매출 <b style="color:var(--gold)">${(J.chickenTot||0).toFixed(2)}억</b> · 지난 정산 ${(J.chickenLast||0).toFixed(2)}억 — 정산은 라운드마다 불규칙하게 들어오고, 들어올 때마다 알림이 뜹니다. 부임하면 사장님 대행 체제로 갑니다.</p>
    <p class="small" style="opacity:.8">📝 최근 리뷰: "${pick(["반반 시켰더니 밸런스가 중요하다고 하심","사장님이 튀김 시간을 스톱워치로 잼. 로테이션이라고 함","포장 기다리는데 K리그 중계 틀어놓고 훈수 두심","윙 8조각 세트 이름이 4-4-2임 ㅋㅋ","맛은 우승권, 배달은 강등권"])}" ★★★★☆</p></div>`:""}
  ${offCards||`<div class="card"><p class="small">📭 아직 도착한 제의가 없습니다. 흔들리는 구단(연패·하위권)일수록 문이 빨리 열립니다.</p></div>`}
  <div class="card"><h3>📨 감독직 지원</h3>
    <p class="small" style="margin-bottom:6px">거절당하면 그 구단에는 35일간 다시 지원할 수 없습니다. 하위권·연패 구단이 잘 받아 줍니다.</p>
    <div class="tblScroll" style="max-height:380px;overflow-y:auto"><table>
      <tr><th>리그</th><th>구단</th><th>순위</th><th>최근 5경기</th><th></th></tr>${rows}</table></div></div>`;
}
/* ── 📜 계약 만료 · 자진 사임 — 경질과 같은 「무직으로 나가는 문」을 쓴다 ── */
function mgrLeaveClub(kind, reason, repHit){
  const t=userTeam(); if(!t) return;
  const c=mgrCt();
  G.sack={reason, s:G.season, r:t.div===1?G.r1:G.r2, kind:kind,
          rec:`${t.W}승 ${t.Dw}무 ${t.L}패`, pos:tableOf(t.div).findIndex(x=>x.isUser)+1,
          owner:Math.round(G.trust.owner), fans:Math.round(G.trust.fans),
          team:t.name, tid:t.id, goal:G.goal?G.goal.n:null};
  /* 📜 감독 경력 장부 — 떠나기 전에 그 시점까지의 성적을 한 줄로 남긴다 (요청) */
  try{ G.sack.kind=kind; cvPushRow("leave"); cvCloseSpell(kind); }catch(e){}
  t.isUser=false;
  try{ assignAITactics(t); }catch(e){}
  G.jobless=1;
  G.mgrFree={from:t.id, reason, s:G.season, off:[], block:{}, weeks:0, repMod:0};
  if(repHit) G.mgrFree.repMod=-Math.abs(repHit);
  G.userXI=null;
  /* 남아 있던 「나에게 온」 일거리는 함께 접는다 — 무직 화면에 유령으로 남으면 안 된다 */
  G.offers=[]; G.loanAsks=[]; G.loanOffers=[]; G.transferBids=[];
  G._loanStopPing=null; G._loanPing=[]; G.nego=null; G.snego=null;
  /* 지난 계약을 이력으로 남기고 계약서는 접는다 */
  try{ if(c){ (c.hist=c.hist||[]).push({tid:c.tid, from:c.from, to:G.season, years:c.years, wage:c.wage, end:kind});
    G.mgrCtHist=(G.mgrCtHist||[]).concat(c.hist.slice(-1)); } }catch(e){}
  G.mgrCt=null;
  saveGame();
  showSackScreen();
}
function doSack(reason){
  const t=userTeam();
  G.sack={reason, s:G.season, r:t.div===1?G.r1:G.r2,
          rec:`${t.W}승 ${t.Dw}무 ${t.L}패`, pos:tableOf(t.div).findIndex(x=>x.isUser)+1,
          owner:Math.round(G.trust.owner), fans:Math.round(G.trust.fans),
          team:t.name, tid:t.id, goal:G.goal?G.goal.n:null};
  /* 경질은 끝이 아니다 — 무직이다. 옛 팀은 AI가 맡고(감독 없이도 리그는 돈다),
     userTeamId 는 그대로 둔다(달력·라운드 진행이 이 팀의 일정을 축으로 돌기 때문).
     isUser 만 내리면 경기는 AI 시뮬로 흐르고, 유저는 구경꾼이 된다. */
  /* 📜 감독 경력 장부 — 경질 시점까지의 성적을 남긴다 (요청) */
  try{ G.sack.kind="sack"; cvPushRow("leave"); cvCloseSpell("sack"); }catch(e){}
  t.isUser=false;
  try{ assignAITactics(t); }catch(e){}
  G.jobless=1;
  G.mgrFree={from:t.id, reason, s:G.season, off:[], block:{}, weeks:0};
  G.userXI=null;
  G.offers=[]; G.loanAsks=[]; G.loanOffers=[]; G.transferBids=[];
  G._loanStopPing=null; G._loanPing=[]; G.nego=null; G.snego=null;
  try{ const c=mgrCt(); if(c) G.mgrCtHist=(G.mgrCtHist||[]).concat([{tid:c.tid, from:c.from, to:G.season, years:c.years, wage:c.wage, end:"sack"}]); }catch(e){}
  G.mgrCt=null;
  addNews(`🪑 <b>${t.name}, 감독 경질</b> — ${reason}`);
  socialFill(SOC.sacked, 4+R(2), -1, {t:t.short});
  fmkFill(FMK.sacked, 4+R(2), {t:t.short});
  rivalOnManager(false);
  meLog(`🪑 ${t.short}에서 경질 — 무직. 월급이 끊겼다.`);
  G.sack.kind="sack";
  saveGame();
  showSackScreen();
}
/* 🪑 어떻게 팀을 떠났는가 — 경질 · 자진 사임 · 계약 만료
   ⚠ 제보 — 「자진 사임했는데 'OO에서 경질된 뒤 0주째'로 나온다」.
      무직으로 나가는 문을 경질과 함께 쓰다 보니 문구까지 경질로 굳어 있었다. */
function leaveWay(){
  const k=(G.sack&&G.sack.kind)||"sack";
  const nm=(G.sack&&G.sack.team)||"전 구단";
  if(k==="quit")   return {k, ic:"🚪", ttl:"자진 사임", past:"자진 사임한", why:"사임 사유", col:"#ff9d5c",
                           head:`${nm} 감독직에서 스스로 물러났습니다.`};
  if(k==="expire") return {k, ic:"📜", ttl:"계약 만료", past:"계약이 만료된", why:"계약 종료", col:"#d29922",
                           head:fixJosa(`${nm}과/와의 계약이 만료되었습니다.`)};
  return {k:"sack", ic:"🪑", ttl:"경질", past:"경질된", why:"경질 사유", col:"var(--red)",
          head:`${nm} 구단은 감독과의 계약을 해지했습니다.`};
}
function showSackScreen(){
  const k=G.sack||{}; const t=userTeam();
  VIEW="home";
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.remove("on"));
  /* ⚠ 이 화면은 show() 를 타지 않아서 진행 버튼 문구가 직전 상태(「경기 시작 ▶」)로 남아 있었다 */
  const btn=$("#advBtn"); if(btn){ btn.disabled=false; btn.textContent="🕊️ 시간 보내기 ▶"; }
  const tbl=(G.social||[]).slice(0,6).map(x=>`<div class="small" style="padding:2px 0">💬 ${x.txt}</div>`).join("");
  const fmk=(G.fmk||[]).slice(0,5).map(x=>`<div class="small" style="padding:2px 0">🔥 ${x.txt}</div>`).join("");
  const W=leaveWay();
  $("#main").innerHTML=`<h2>${W.ic} ${W.ttl}</h2>
  <div class="card stCard" style="border-color:${W.col}">
    <div class="msg warn" style="font-size:17px;font-weight:800">${W.head}</div>
    <p style="margin-top:10px">${W.why}: <b>${k.reason}</b></p>
    <p class="small">
      ${k.s} 시즌 ${k.r}라운드 · 성적 <b style="color:#fff;font-weight:800">${k.rec}</b> (리그 ${k.pos}위)<br>
      ${k.goal?`시즌 목표: <b style="color:#fff;font-weight:800">${k.goal}</b><br>`:""}
      구단주 신뢰 <b style="color:${W.col};font-weight:800">${k.owner}</b> ·
      서포터 신뢰 <b style="color:${W.col};font-weight:800">${k.fans}</b></p>
  </div>
  <div class="card stCard"><h3>💬 여론</h3>${tbl}${fmk}</div>
  <div class="card">
    <p class="small">${W.k==="quit"
      ? "스스로 내려놓은 자리입니다 — <b>무직 감독</b>으로 남아 다음 구단을 고르거나 직접 지원할 수 있습니다. 다만 한동안은 좋은 제의가 뜸할 겁니다."
      : W.k==="expire"
      ? "계약이 끝났을 뿐입니다 — <b>무직 감독</b>으로 남아 타 구단에 지원하거나 제의를 기다릴 수 있습니다. 평판에는 흠이 남지 않았습니다."
      : "여기서 끝이 아닙니다 — <b>무직 감독</b>으로 남아 타 구단에 지원하거나 제의를 기다릴 수 있습니다. 리그는 계속 돌아가고, 시간이 흐를수록 흔들리는 구단의 문이 열립니다."}</p>
    <button class="bigbtn" style="width:100%;max-width:none" onclick="show('home')">🕊️ 무직으로 커리어 계속 ▶</button>
    <button class="mini" style="display:block;width:100%;margin-top:8px;padding:10px" onclick="restartAfterSack()">🔄 아니면 새 커리어 시작</button>
  </div>`;
  window.scrollTo(0,0);
}
function restartAfterSack(){
  showConfirm(`<b>새 커리어를 시작합니다</b>\n\n현재 세이브는 삭제되고 구단 선택 화면으로 돌아갑니다.\n계속하시겠습니까?`, ()=>{
    try{ localStorage.removeItem("klm2026"); }catch(e){}
    location.reload();
  }, {okLabel:"새로 시작", danger:true});
}
SOC.forfeitOur=[
 ["몰수패?? 프로 구단이 선수 7명을 못 채워서 몰수패???",-1],
 ["살다 살다 우리 팀이 몰수패 당하는 걸 다 본다",-1],
 ["선수단이 단체로 등을 돌렸다는 거잖아 이거... 감독 뭐 하는 거냐",-1],
 ["몰수패는 구단 역사에 영원히 남는다. 부끄러운 줄 알아라",-1],
 ["티켓 값 환불해라. 경기 자체가 없었잖아",-1],
 ["이 감독은 팀을 지휘하는 게 아니라 해체하고 있다",-1]];
FMK.forfeitOur=[
 ["{t} 몰수패 ㅋㅋㅋㅋ K리그 역사에 남을 사건",-1],
 ["선수 {n}명 남아서 몰수패 실화냐 ㄷㄷ",-1],
 ["감독이 선수단을 팼다는 소문이 사실인가 봄...",-1],
 ["몰수패 나오는 구단은 처음 본다 리그 수준 어쩌냐",-1]];
SOC.hatOur=[
 ["{p} 해트트릭 실화냐!!! 오늘 밤 하이라이트 무한재생 간다",1],
 ["{p} 유니폼 사러 갑니다. 오늘부로 최애 등극",1],
 ["한 명이 세 골을 넣는 걸 직관하는 기분... 이 맛에 축구 본다",1],
 ["{p} 공 가져갔지? 해트트릭 볼은 챙겨야지 ㅋㅋ",1],
 ["다음 경기 {p} 선발 아니면 폭동이다",1]];
FMK.hatOur=[
 ["{t} {p} 해트트릭 ㄷㄷㄷ 리그 폼 미쳤다",1],
 ["{p} 오늘 3골 넣고 평점 몇이냐 10점 줘라",1],
 ["해트트릭 나온 날은 자다가도 웃음 나옴 ㅋㅋ",1],
 ["{p} 이적료 오르는 소리 여기까지 들린다",1]];
SOC.multiOur=[
 ["{p} 멀티골! 오늘 혼자 다 했다",1],
 ["{p} 두 골 ㅋㅋ 요즘 폼이 심상치 않다",1],
 ["{p} 이 기세면 다음 경기 해트트릭 간다",1]];
FMK.multiOur=[
 ["{t} {p} 멀티골 폭발 ㅋㅋ 에이스 인정",1],
 ["{p} 요즘 미쳤네 득점왕 경쟁 각",1]];
SOC.hiredNew=[
 ["새 감독 왔다. 이번엔 좀 다르길 바란다",0],
 ["전 구단에서 잘린 감독인데... 반신반의다",-1],
 ["부임 기자회견 보니까 말은 잘하더라. 축구로 보여줘",0],
 ["감독 바뀌면 한 달은 반짝한다던데 그 한 달이라도 보자",0],
 ["새 술은 새 부대에. 선수단 개편 기대한다",1]];
FMK.hiredNew=[
 ["{t} 신임 감독 선임 ㅋㅋ 재취업 성공했네",0],
 ["잘린 감독 데려오는 구단 심리가 궁금하다",-1],
 ["{t} 이번 감독은 몇 라운드 버틸까 배팅 간다",0],
 ["중도 부임은 원래 첫 5경기가 전부다",0]];
/* ⚠ 제보 — 「감독 재계약했는데 소셜 반응이 전부 "새 감독 왔다·새 술은 새 부대·전 구단에서
   잘린 감독" — 신임 부임 반응이 그대로 나온다」. 재계약은 부임이 아니다 — 전용 풀을 둔다. */
SOC.mgrRenew=[
 ["감독 재계약 떴다!! 이 축구 몇 년 더 본다",1],
 ["구단이 일 잘하네. 잡을 사람은 잡아야지",1],
 ["재계약 소식에 마음이 놓인다. 감독 흔들기 이제 그만",1],
 ["{t}의 축구가 이어진다는 것 자체가 뉴스다",1],
 ["연봉 얼마에 도장 찍었을까. 그래도 아깝지 않다",0],
 ["재계약은 좋은데 이적시장에서도 힘 실어줘라",0],
 ["감독은 잡았고, 이제 선수단 지킬 차례",1],
 ["솔직히 불안했는데 눌러앉혀서 다행이다",1]];
FMK.mgrRenew=[
 ["{t} 감독 재계약 ㅋㅋ 그 구단 팬들 축제 분위기던데",1],
 ["{t} 감독 눌러앉음. 다른 팀 팬으로서 부럽다",0],
 ["재계약 시켜 줄 만하지. 인정할 건 인정",1],
 ["{t} 프런트가 요즘 일을 하네",0],
 ["감독 재계약 = 그 팀 방향성 유지. 견제 대상 확정",0]];
SOC.sacked=[
 ["{t} 감독 경질... 예상은 했지만 막상 보니 착잡하다",-1],
 ["결국 이렇게 되는구나. 다음 감독은 좀 오래 갔으면",0],
 ["감독 한 명 자른다고 뭐가 달라지나. 구단이 문제지",-1],
 ["고생하셨습니다. 다른 팀에서 잘되시길",0],
 ["이번 경질은 늦은 감이 있다. 진작 했어야",-1],
 ["새 감독 후보 명단 벌써 돌아다니던데",0]];
FMK.sacked=[
 ["경질 ㅋㅋㅋㅋ 드디어",-1],["감독 나갔다 ㅅㅂ 축하한다 우리 팀",-1],
 ["잘 가라... 미워하진 않는다 (미워함)",-1],
 ["다음 감독도 3개월 컷이면 진짜 구단이 문제임",0],
 ["경질 축하 파티 어디서 함?",-1],
 ["솔직히 감독만 문제였나? 프런트도 갈아엎어야지",0]];

/* ═══ 🚪 자진 사임 — 경질과는 결이 다르다 ═══════════════════════════════
   잘린 게 아니라 스스로 나간 것이다. 팬들은 「왜」를 먼저 묻고,
   그 「왜」가 납득이 안 될수록 화살은 감독에게 돌아간다.
   특히 부임하자마자 나가면 그건 사건이 아니라 코미디가 된다. */
/* ① 부임 직후 (경기도 몇 번 못 치르고) */
SOC.quitInstant=[
 ["...엥? 방금 부임한 거 아니었나요? {n}일 만에 사임이요?",-1],
 ["기자회견 사진 잉크도 안 말랐는데 나갔다고요",-1],
 ["환영 걸개 어제 걸었는데 이거 어떡하죠",-1],
 ["유니폼에 감독 이름 새긴 사람 지금 심정 어떨까",-1],
 ["이 정도면 부임한 게 아니라 잠깐 들른 거 아님?",-1],
 ["뭘 보고 도망친 건지 그게 더 궁금하다",-1],
 ["구단이 뭘 숨긴 건지 감독이 뭘 본 건지 알려주세요 제발",-1],
 ["역대 최단 재임 기록 아니냐 이거",-1],
 ["...그래도 위약금은 다 내고 갔다니까 그건 인정",0],
 ["프런트 브리핑 한 번만 받고 튄 수준인데",-1]];
FMK.quitInstant=[
 ["{t} 신임 감독 {n}일 만에 사임 ㅋㅋㅋㅋㅋㅋ",-1],
 ["부임 기사랑 사임 기사가 같은 페이지에 뜬다",-1],
 ["이 구단은 감독이 도망칠 정도구나 ㄷㄷ",-1],
 ["출근 도장은 찍었냐",-1],
 ["역대 최단 재임 갱신 ㅋㅋ 기네스 올려라",-1],
 ["감독이 스쿼드 보고 현타 온 듯",-1],
 ["위약금 내고 나갈 정도면 진짜 뭔가 있는 거임",0],
 ["{t} 팬들 불쌍하다 진심으로",0],
 ["차기 감독 후보들 지금 전화 안 받는다에 한 표",-1]];
const RIV_QUIT_INSTANT=[
 ["{t} 감독 사임했대 ㅋㅋ 며칠 만이야",-1],
 ["부임하자마자 도망가는 팀 처음 본다",-1],
 ["우리 감독은 최소한 시즌은 채운다",0],
 ["{t} 감독직 = 기피 직종 등극",-1]];

/* ② 시즌 중 사임 */
SOC.quitMid=[
 ["시즌 중에 나가는 건 좀... 끝은 보고 가시지",-1],
 ["힘드셨겠죠. 그래도 이 타이밍은 아프네요",-1],
 ["남은 경기는 누가 지휘하나요 진짜",-1],
 ["감독님 마음은 알겠는데 선수들은 어쩌라고",-1],
 ["책임지고 나간다는 말이 제일 무책임할 때가 있다",-1],
 ["그동안 고생하셨습니다. 원망은 안 할게요",0],
 ["구단이 등 떠민 거면 그건 그거대로 화나는데",0],
 ["시즌 중 감독 교체... 우리 팀 잔류는 어떡하죠",-1]];
FMK.quitMid=[
 ["{t} 감독 시즌 중 자진 사임 ㄷㄷ",-1],
 ["도망간 거지 사임이냐 이게",-1],
 ["시즌 중에 던지는 감독은 좀 아니지 않냐",-1],
 ["위약금 물고 나갔다는데 그럼 진짜 못 버틴 거네",0],
 ["대행 체제로 남은 시즌 ㅋㅋ 강등 각",-1],
 ["{t} 프런트 vs 감독 뭐가 있었는지 궁금하다",0]];
const RIV_QUIT_MID=[
 ["{t} 감독 시즌 중에 던졌다는데 ㅋㅋ",-1],
 ["저 팀 지금 대행 체제라던데 붙기 딱 좋네",-1],
 ["감독 나간 팀이랑 하는 경기는 조심해야 하는데",0]];

/* ③ 시즌을 마치고 물러날 때 — 이건 이별에 가깝다 */
SOC.quitEnd=[
 ["감독님, 그동안 고생 많으셨습니다",1],
 ["떠나신다니 실감이 안 나네요. 좋은 기억 감사합니다",1],
 ["더 좋은 곳에서 뵙겠습니다 감독님",1],
 ["결국 이렇게 끝나는구나... 마지막 홈경기 못 간 게 후회된다",0],
 ["구단이 더 붙잡았어야 하는 거 아닌가요",0],
 ["다음 감독이 이 자리를 채울 수 있을지 모르겠다",0],
 ["박수로 보내드립시다. 그럴 자격 있는 분입니다",1]];
FMK.quitEnd=[
 ["{t} 감독 자진 사퇴. 뭐 이 정도면 명예로운 퇴진 아니냐",0],
 ["잡을 만한 감독이었는데 프런트가 안 잡았나",0],
 ["다음 팀 어디 갈지가 더 궁금함",0],
 ["{t} 감독 나간다니까 우리 팀 팬들이 더 아쉬워하네 ㅋㅋ",1],
 ["떠날 때를 아는 감독은 드물다",1]];
