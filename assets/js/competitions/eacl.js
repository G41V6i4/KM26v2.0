"use strict";
/* =====================================================
   🌏 EACL 대회 엔진 — 대진 추첨 · 리그 스테이지 · 토너먼트
   12팀(한국3 · 일본4 · 중국2 · 태국2 · 말레이1)이 한 덩어리 리그를 치른다.
   각 팀은 포트별로 홈 1 · 원정 1씩 총 8경기를 뛰고, 상위 8팀이 단판 토너먼트로 넘어간다.
   (실제 ACLE도 8강부터는 중립지 단판이다)
===================================================== */
const EACL_MD_ROUND=[3,7,11,15,19,23,27,31];   // 리그 스테이지 8차전이 걸리는 K리그 라운드
const EACL_KO_ROUND={qf:34, sf:36, f:38};      // 8강 · 4강 · 결승
/* 상금(억) — 승리 수당은 리그 스테이지·토너먼트를 가리지 않고 매 경기 지급된다.
   우승 상금이 압도적인 것은 실제 대륙대회도 마찬가지다. */
/* 🌏 ⚠ 제보 원문 — 「EACL 에서 본선 참가부터 모든 경기를 승리하고 우승까지 차지할 경우에
   재정 탭에서 EACL 상금이 현재 1676억 정도로 찍히는데 현실적으로 실축 아챔처럼 우승 상금을
   200억 정도로 (참가 수당이나 경기 승리 수당 하향 제외) 제한 하는 것이 어떨까요?」.
   원인이 둘이었다.
     ① t.aclMoney 가 시즌마다 초기화되지 않아 커리어 누적액이 「이번 시즌 수입」 칸에 찍혔다.
        1676억은 한 시즌 상금이 아니라 여러 시즌을 더한 값이다(아래 finLedger 로 옮겨 고쳤다).
     ② 그와 별개로 라운드 진출·우승 상금이 후했다.
   ─ 경기 수당(승 5 · 무 2)은 그대로 두고 라운드 진출·우승만 낮춘다.
     전승 우승 = 리그 스테이지 8승 40 + 토너먼트 3승 15 + 8강 10 + 4강 18 + 결승 27 + 우승 90 ≈ 200억. */
const EACL_PRIZE={win:5, draw:2, qf:10, sf:18, fin:27, champ:90};
const EACL_CAP_SEASON=210;   // 🌏 한 시즌 대회 상금 상한 — 어떤 경로로도 이 위로 가지 않는다
function eaclOn(){ return !!(G.eacl && G.eacl.s===G.season && G.eacl.teams && G.eacl.teams.length); }
/* 참가팀 하나를 실제 팀 객체로 — K리그 팀이면 그대로, 아니면 그 시즌 생성 클럽 */
function eaclTeam(id){
  if(G.teams[id]) return G.teams[id];
  return eaclClub(String(id).replace(/^eacl_/,""));
}
function eaclNatOf(id){ const t=eaclTeam(id); return (t&&t.nat)||"한국"; }
function eaclPower(id){
  const t=eaclTeam(id); if(!t) return 66;
  try{ const s=xiStrength(t); if(s&&s.s) return s.s; }catch(e){}
  try{ return teamOVR(t); }catch(e){}
  return 66;
}
/* ── 대진 추첨 (스위스 방식) ─────────────────────────────────
   조를 나누지 않는다. 12팀이 하나의 순위표에 들어가고, 추첨은 「누구와 붙느냐」만 정한다.
   ① 전력순으로 포트 1~4 (3팀씩)  ② 각 팀은 포트마다 홈 1 · 원정 1
   ③ 같은 나라끼리는 만나지 않는다  ④ 같은 팀과 두 번 만나지 않는다
   제약이 빡빡해 그리디로는 막히므로 무작위 순서 백트래킹으로 푼다. */
function eaclMakePots(ids){
  /* 전력이 높은 팀부터 위 포트를 채우되, 한 포트에 같은 나라가 두 팀 들어가지 않게 한다.
     ⚠ 이 규칙은 미관이 아니라 대진 추첨의 성립 조건이다 — 예컨대 일본 4팀이 한 포트에 몰리면
       "같은 나라끼리 안 만난다 + 포트마다 홈1·원정1"을 동시에 만족하는 대진이 아예 없다. */
  const sorted=[...ids].sort((a,b)=>eaclPower(b)-eaclPower(a));
  const pots=[[],[],[],[]];
  const put=(k)=>{
    if(k>=sorted.length) return true;
    const id=sorted[k], n=eaclNatOf(id);
    for(let p=0;p<4;p++){
      if(pots[p].length>=3) continue;
      if(pots[p].some(q=>eaclNatOf(q)===n)) continue;
      pots[p].push(id);
      if(put(k+1)) return true;
      pots[p].pop();
    }
    return false;
  };
  if(!put(0)){ for(let p=0;p<4;p++) pots[p]=sorted.slice(p*3,p*3+3); }
  return pots;
}
function eaclDrawPairs(pots){
  const ids=[].concat(...pots);
  const potOf={}; pots.forEach((p,i)=>p.forEach(id=>potOf[id]=i));
  const nat={}; ids.forEach(id=>nat[id]=eaclNatOf(id));
  for(let attempt=0; attempt<60; attempt++){
    let nodes=0;
    const H={}, A={}, met={};                       // H[id][p] · A[id][p] = 상대 id
    ids.forEach(id=>{ H[id]=[null,null,null,null]; A[id]=[null,null,null,null]; met[id]={}; });
    const slots=[];
    for(const id of ids) for(let p=0;p<4;p++) slots.push([id,p]);
    const order=shuffled(slots);
    const games=[];
    let ok=true;
    const solve=(k)=>{
      if(++nodes>40000) return false;               // 탐색 폭발 방지 — 막히면 다시 뽑는다
      if(k>=order.length) return true;
      const [x,p]=order[k];
      if(H[x][p]) return solve(k+1);                // 이미 채워졌다
      const cand=shuffled(pots[p].filter(y=>y!==x && !met[x][y] && nat[y]!==nat[x] && !A[y][potOf[x]]));
      for(const y of cand){
        H[x][p]=y; A[y][potOf[x]]=x; met[x][y]=1; met[y][x]=1; games.push([x,y]);
        if(solve(k+1)) return true;
        H[x][p]=null; A[y][potOf[x]]=null; delete met[x][y]; delete met[y][x]; games.pop();
      }
      return false;
    };
    ok=solve(0);
    if(ok && games.length===48) return games;       // 12팀 × 8경기 ÷ 2 = 48
  }
  return null;
}
/* 48경기를 8차전으로 쪼갠다 — 한 차전에 한 팀이 두 번 뛰면 안 된다(엣지 컬러링) */
function eaclSchedule(games){
  for(let attempt=0; attempt<80; attempt++){
    let nodes=0;
    const md=new Array(games.length).fill(-1);
    const busy=[]; for(let d=0;d<8;d++) busy.push({});
    const order=shuffled(games.map((g,i)=>i));
    const solve=(k)=>{
      if(++nodes>40000) return false;
      if(k>=order.length) return true;
      const gi=order[k], [x,y]=games[gi];
      for(const d of shuffled([0,1,2,3,4,5,6,7])){
        if(busy[d][x]||busy[d][y]) continue;
        busy[d][x]=1; busy[d][y]=1; md[gi]=d;
        if(solve(k+1)) return true;
        delete busy[d][x]; delete busy[d][y]; md[gi]=-1;
      }
      return false;
    };
    if(solve(0)) return md;
  }
  return games.map((g,i)=>i%8);   // 최후 수단
}
/* 🎖️ 군경 구단은 대륙대회에 나갈 수 없다 — 소속 선수가 전원 복무 중인 부대이므로
   국제 대회 출전 자격이 없다. 리그 3위 안에 들어도 진출권은 다음 순위로 넘어간다. */
function eaclEligible(id){
  const t=G.teams[id];
  if(!t) return false;
  try{ if(isArmyTeam(t)) return false; }catch(e){}
  return true;
}
function eaclKoreanEntrants(){
  /* 전 시즌 K리그1 1~3위. 강등되었거나 군경 구단이면 그 아래로 밀린다. */
  const pick3=(G.aclTeams||[]).filter(id=>G.teams[id] && eaclEligible(id));
  const out=[...new Set(pick3)].slice(0,3);
  if(out.length<3){
    for(const id of (G.k1||[])) if(out.indexOf(id)<0 && eaclEligible(id) && out.length<3) out.push(id);
  }
  if(out.length<3){
    for(const id of (G.k2||[])) if(out.indexOf(id)<0 && eaclEligible(id) && out.length<3) out.push(id);
  }
  return out;
}
function eaclSetup(){
  G.aclFix=[];
  const kr=eaclKoreanEntrants();
  const foreign=eaclDraw();                       // 일본4 · 중국2 · 태국2 · 말레이1
  const ids=[...kr, ...foreign.map(id=>"eacl_"+id)];
  if(ids.length<12){ G.eacl=null; return; }
  ids.forEach(id=>eaclTeam(id));                  // 클럽 스쿼드를 미리 만들어 전력을 잰다
  const pots=eaclMakePots(ids);
  const games=eaclDrawPairs(pots);
  if(!games){ G.eacl=null; return; }
  const md=eaclSchedule(games);
  const fix=games.map((g,i)=>({d:md[i], h:g[0], a:g[1], done:0, hg:0, ag:0}));
  fix.sort((x,y)=>x.d-y.d);
  const tbl={}; ids.forEach(id=>tbl[id]={W:0,D:0,L:0,GF:0,GA:0,Pts:0});
  G.eacl={s:G.season, teams:ids, pots, fix, tbl, stage:"draw", ko:{qf:[],sf:[],f:null}, champ:null, seeded:null, announced:0};
  try{ eaclBuildDates(); }catch(e){}
  try{ for(const id of ids) if(G.teams[id]) eaclHonorAdd(id, "apps"); }catch(e){}
  eaclMirrorUserFix();
  /* 🧹 지난 시즌 클럽 캐시 정리 — 이번에 뽑히지 않은 클럽의 20인 스쿼드는 죽은 데이터다.
     안 지우면 시즌마다 3팀(60명)씩 세이브에 쌓인다(실측 — 3시즌 만에 9→15팀). */
  try{
    const keep={};
    for(const id of foreign) if(G.eaclClubs && G.eaclClubs[id]) keep[id]=G.eaclClubs[id];
    G.eaclClubs=keep;
  }catch(e){}
  const me=G.userTeamId;
  addNews(`🌏 <b>${eaclName()} 대진 추첨</b> — 12개 클럽이 각 8경기를 치를 상대가 확정됐습니다. <span class="small">조 없이 한 순위표에서 겨루고 상위 8팀이 8강에 오릅니다.</span>`, "info", "club");
  /* 대진 난이도 — 우리 상대 8팀의 평균 전력을 우리와 견준다 */
  if(ids.indexOf(me)>=0 && !G.jobless){
    try{
      const foes=G.eacl.fix.filter(m=>m.h===me||m.a===me).map(m=>eaclPower(m.h===me?m.a:m.h));
      const avg=foes.reduce((s,v)=>s+v,0)/Math.max(1,foes.length), mine=eaclPower(me);
      eaclSocialEvent("draw", {hard:avg>=mine+1.5, easy:avg<=mine-1.5});
    }catch(e){ eaclSocialEvent("draw", {}); }
  }
  if(ids.indexOf(me)>=0){
    const mine=G.eacl.fix.filter(m=>m.h===me||m.a===me).sort((x,y)=>x.d-y.d)
      .map(m=>{ const home=m.h===me, o=eaclTeam(home?m.a:m.h); return `${o.short}(${home?"홈":"원정"})`; });
    addNews(`🌏 <b>${G.teams[me].short} ${eaclShort()} 대진 추첨 결과</b> — ${mine.join(" · ")}`, "good", "club");
  }
}
function setupACL(){ try{ eaclSetup(); }catch(e){ G.eacl=null; G.aclFix=[]; } }

/* ═══════════════════════════════════════════════════════════════════════════
   🌍 CWC — 세계클럽대항전 (뼈대)
   EACL 우승팀이 「다음 해 1월」에 나가는 세계 대회. 16팀 · 4조 4팀 · 조 1·2위 8강.
   ⚠ 이 대회의 가장 어려운 점은 상대가 아니라 「시점」이다.
     1월은 이미 새 시즌이다 — 승강도, 이적도, 나이 +1도 끝난 뒤다.
     그래서 자격은 지난 시즌 것을 들고 넘어오고(G.cwcQual), 뛰는 스쿼드는 올해 것이다.
     (현실의 클럽 월드컵도 정확히 이 구조다)
   ─ 지금은 뼈대다. 클럽 데이터·UI·서사는 다음 단계에서 붙인다.
═══════════════════════════════════════════════════════════════════════════ */
/* 대륙 — 이름과 전력 기준. teamOVR 기준점: K리그1 최상위 74~75 · EACL 최강 75.8 */
/* ⚠ 「상금이 706억인 만큼 정말 강한 대진이어야 한다. 실제로 울산은 클럽월드컵에서 전패했다」.
   맞는 지적이었다. 첫 뼈대는 조에 약체가 하나 섞이면 8강까지 갈 만했다 —
   그 정도 난이도에 우승 상금 350억을 주면 이적시장이 무너진다.
   실제 2025 대회에서 아시아 네 팀 중 조별을 통과한 건 한 팀뿐이었고,
   K리그 대표는 아프리카 챔피언에게도 졌다. 눈금을 그 현실에 맞춘다. */
const CWC_CONF={
  EU:{n:"유럽",       ovr:88, fOvr:90, fN:12, pool:"EU"},
  SA:{n:"남미",       ovr:84, fOvr:85, fN:4,  pool:"BR"},
  AF:{n:"아프리카",   ovr:78, fOvr:80, fN:7,  pool:"AF"},
  NA:{n:"북중미",     ovr:77, fOvr:79, fN:9,  pool:"SA"},
  OC:{n:"오세아니아", ovr:63, fOvr:65, fN:5,  pool:"OC"},
  AS:{n:"아시아",     ovr:76, fOvr:78, fN:5,  pool:"EU"}
};
/* 대륙별 참가 장수 — 합 16.
   🌏 아시아 2장은 지난 시즌 EACL **결승에 오른 두 팀**이 가져간다 (우승·준우승).
      우리가 결승에서 졌더라도 나간다 — 자격은 결승 진출로 얻는다.
   나머지 14장은 대륙별로 뽑는다. 실제 대회(32팀)의 대륙 비율을 그대로 절반으로 줄인 값이다.
      유럽 12/32 → 6 · 남미 6/32 → 3 · 아프리카 4 → 2 · 북중미 5 → 2 · 오세아니아 1 → 1 */
const CWC_SLOTS=[["EU",6],["SA",3],["AF",2],["NA",2],["OC",1]];
/* 임시 클럽 풀 — 다음 단계에서 구장·모기업·감독까지 갖춘 정식 데이터로 교체한다 */
const CWC_CLUBS=[
  /* 유럽은 안에서도 편차가 크다 — 대륙 챔피언 자격으로 오는 팀과 리그 상위 자격으로 오는 팀은
     체급이 다르다. 여섯 장을 열세 팀에서 뽑으므로 시즌마다 조 편성의 무게가 달라진다.
     ⚠ 편차 없이 여섯 팀을 전부 85~89로 두었더니, 우리가 유럽 챔피언급(88)까지 성장해도
       포트 3에 눌려 우승 확률이 1% 아래로 굳었다. 그러면 350억 상금이 목표가 되지 못한다. */
  {id:"eu_mad",  name:"마드리드 레알레스",   short:"마드리드", cf:"EU", col:"#f2f2f2", col2:"#d4af37", ovr:89, cc:"ES", nat:"스페인"},
  {id:"eu_mcy",  name:"맨체스터 스카이",     short:"맨스카이", cf:"EU", col:"#6cabdd", col2:"#1c2c5b", ovr:89, cc:"EN", nat:"잉글랜드"},
  {id:"eu_bar",  name:"바르셀로나 블라우",   short:"바르사",  cf:"EU", col:"#0b2d6e", col2:"#a50044", ovr:88, cc:"ES", nat:"스페인"},
  {id:"eu_mun",  name:"뮌헨 바이언스",       short:"뮌헨",   cf:"EU", col:"#dc052d", col2:"#0066b2", ovr:88, cc:"DE", nat:"독일"},
  {id:"eu_liv",  name:"리버풀 레즈",         short:"리버풀",  cf:"EU", col:"#c8102e", col2:"#f6eb61", ovr:87, cc:"EN", nat:"잉글랜드"},
  {id:"eu_par",  name:"파리 생제르",         short:"파리",   cf:"EU", col:"#004170", col2:"#da291c", ovr:87, cc:"FR", nat:"프랑스"},
  {id:"eu_int",  name:"밀라노 네라주리",     short:"밀라노",  cf:"EU", col:"#0b1a5e", col2:"#111111", ovr:86, cc:"IT", nat:"이탈리아"},
  {id:"eu_che",  name:"런던 블루스",         short:"런던",   cf:"EU", col:"#034694", col2:"#f2f2f2", ovr:86, cc:"EN", nat:"잉글랜드"},
  {id:"eu_juv",  name:"토리노 비앙코네리",   short:"토리노",  cf:"EU", col:"#f2f2f2", col2:"#111111", ovr:84, cc:"IT", nat:"이탈리아"},
  {id:"eu_dor",  name:"도르트문트 옐로월",   short:"도르트문트",cf:"EU",col:"#f5c518", col2:"#111111", ovr:84, cc:"DE", nat:"독일"},
  {id:"eu_ben",  name:"리스본 아기아스",     short:"리스본",  cf:"EU", col:"#c8102e", col2:"#f2f2f2", ovr:82, cc:"PT", nat:"포르투갈"},
  {id:"eu_por",  name:"포르투 드라고스",     short:"포르투",  cf:"EU", col:"#1b4fa0", col2:"#f2f2f2", ovr:82, cc:"PT", nat:"포르투갈"},
  {id:"eu_sal",  name:"잘츠부르크 불스",     short:"잘츠부르크",cf:"EU",col:"#c8102e", col2:"#f2f2f2", ovr:80, cc:"DE", nat:"오스트리아"},
  {id:"sa_riv",  name:"리버 플라타",         short:"리버",   cf:"SA", col:"#f2f2f2", col2:"#d0021b", ovr:83, cc:"AR", nat:"아르헨티나"},
  {id:"sa_boc",  name:"보카 주니어스",       short:"보카",   cf:"SA", col:"#12468f", col2:"#f5c518", ovr:83, cc:"AR", nat:"아르헨티나"},
  {id:"sa_fla",  name:"플라멩구 루브로",     short:"플라멩구", cf:"SA", col:"#c8102e", col2:"#111111", ovr:85, cc:"BR", nat:"브라질"},
  {id:"sa_pal",  name:"팔메이라스 베르지",   short:"팔메이라스",cf:"SA", col:"#0b6b3a", col2:"#f2f2f2", ovr:84, cc:"BR", nat:"브라질"},
  {id:"sa_flu",  name:"플루미넨세 트리콜로", short:"플루미넨세",cf:"SA", col:"#7a1b3d", col2:"#0b6b3a", ovr:83, cc:"BR", nat:"브라질"},
  {id:"sa_bot",  name:"보타포구 알비네그로", short:"보타포구", cf:"SA", col:"#111111", col2:"#f2f2f2", ovr:83, cc:"BR", nat:"브라질"},
  {id:"af_ahl",  name:"카이로 알아흘리",     short:"카이로",  cf:"AF", col:"#c8102e", col2:"#f2f2f2", ovr:79, cc:"AB", nat:"이집트"},
  {id:"af_raj",  name:"카사블랑카 라자",     short:"카사블랑카",cf:"AF",col:"#0b7a3b", col2:"#f2f2f2", ovr:78, cc:"AB", nat:"모로코"},
  {id:"af_sun",  name:"프리토리아 선다운",   short:"프리토리아",cf:"AF",col:"#f5c518", col2:"#111111", ovr:78, cc:"ZA", nat:"남아공"},
  {id:"af_wyd",  name:"카사블랑카 위다드",   short:"위다드",  cf:"AF", col:"#c8102e", col2:"#f2f2f2", ovr:77, cc:"AB", nat:"모로코"},
  {id:"af_esp",  name:"튀니스 에스페랑스",   short:"튀니스",  cf:"AF", col:"#c8102e", col2:"#f5c518", ovr:77, cc:"AB", nat:"튀니지"},
  {id:"na_mty",  name:"몬테레이 라야도스",   short:"몬테레이", cf:"NA", col:"#1b3d7a", col2:"#f2f2f2", ovr:78, cc:"MX", nat:"멕시코"},
  {id:"na_sea",  name:"시애틀 사운더스",     short:"시애틀",  cf:"NA", col:"#5d9732", col2:"#00457c", ovr:76, cc:"US", nat:"미국"},
  {id:"na_mia",  name:"마이애미 인터",       short:"마이애미", cf:"NA", col:"#f7b5cd", col2:"#111111", ovr:77, cc:"US", nat:"미국"},
  {id:"na_gdl",  name:"과달라하라 로히블랑코",short:"과달라하라",cf:"NA",col:"#c8102e", col2:"#f2f2f2", ovr:76, cc:"MX", nat:"멕시코"},
  {id:"na_lag",  name:"로스앤젤레스 블랙골드",short:"LA",    cf:"NA", col:"#111111", col2:"#c39e6d", ovr:77, cc:"US", nat:"미국"},
  {id:"oc_auc",  name:"오클랜드 시티",       short:"오클랜드", cf:"OC", col:"#1a4a9c", col2:"#f2f2f2", ovr:63, cc:"OZ", nat:"뉴질랜드"},
  {id:"oc_wel",  name:"웰링턴 피닉스",       short:"웰링턴",  cf:"OC", col:"#f5c518", col2:"#111111", ovr:62, cc:"OZ", nat:"뉴질랜드"},
  {id:"oc_syd",  name:"시드니 하버",         short:"시드니",  cf:"OC", col:"#87ceeb", col2:"#111111", ovr:65, cc:"OZ", nat:"호주"}
];
const CWC_HOSTS=["카타르","미국","사우디아라비아","모로코","멕시코","호주"];

/* ── 🌍 CWC 국가별 이름 생성기 ─────────────────────────────────────────
   EACL 클럽이 일본·중국·태국·말레이 이름을 쓰듯, CWC 클럽도 제 나라 이름을 쓴다.
   ⚠ 뼈대 단계에서는 「유럽 풀」 하나로 뭉뚱그렸다 — 마드리드와 뮌헨 선수 이름이 같은 통에서
     나오니 어느 나라 클럽인지 이름만 봐서는 알 수 없었다. 나라별로 갈라 준다. */
const CWC_SUR={
  ES:["가르시아","로드리게스","페르난데스","마르티네스","산체스","로페스","고메스","디아스","모레노","루비오","나바로","이글레시아스","카스티요","오르테가"],
  EN:["스미스","존스","윌리엄스","브라운","테일러","데이비스","윌슨","에번스","톰프슨","워커","라이트","하퍼","벤틀리","클라크"],
  DE:["뮐러","슈미트","베버","바그너","베커","호프만","슈나이더","리히터","크뤼거","브라운","케슬러","슈타인","바흐만","로트"],
  FR:["뒤부아","르페브르","모로","라루스","베르나르","지라르","루소","포르티에","메르시에","블랑","콜랭","르메르","가르니에","보네"],
  IT:["로시","마르케티","콘티","리치","가투소","페라리","갈로","롬바르디","비앙키","모레티","산토로","베르가모","카타네오","마르티니"],
  PT:["실바","산투스","페레이라","코스타","올리베이라","카르발류","소자","마샤두","핀투","브라가","모타","텍세이라","캄푸스","파리아"],
  AR:["곤살레스","로메로","아길라르","벨라스케스","오르티스","이바라","키로가","소사","페랄타","아코스타","루한","메디나","바리오스","살라스"],
  BR:["실바","소자","알베스","리마","히베이루","고메스","바르보사","카르도주","모라이스","피녜이루","도스산투스","마샤두","아제베두","포르투갈"],
  AB:["하산","엘사예드","벤알리","만수르","자루크","엘아민","카데르","부슈타","라흐마니","셰리프","타히르","마스리","벤유세프","할리드"],
  ZA:["들라미니","은코시","모케나","반데르메르베","보타","시툴레","마샤바","프리토리우스","줄루","모디세","은들로부","코에치","마발라","세페"],
  MX:["에르난데스","라미레스","플로레스","바스케스","레예스","게레로","살라사르","메히아","콘트레라스","아코스타","델가도","루나","치아베스","마시엘"],
  US:["존슨","밀러","앤더슨","화이트","마틴","리드","무어","베이커","페레스","산티아고","오브라이언","콜","머피","도허티"],
  OZ:["톰슨","밀러","오브라이언","하퍼","벤틀리","케네디","마셜","도슨","라이언","포터","힐","콜린스","페인","브래들리"]
};
const CWC_GIV={
  ES:["세르히오","알바로","하비에르","다니엘","파블로","이케르","마르코스","루카스","안드레스","마리오","호르헤","라울","엔리케","비센테"],
  EN:["해리","잭","조지","올리버","찰리","루이스","메이슨","리스","코너","알피","네이선","토비","일라이","커티스"],
  DE:["레온","막스","펠릭스","요나스","티모","루카스","니클라스","다비트","모리츠","야닉","슈테판","마티아스","엘리아스","파비안"],
  FR:["앙투안","클레망","마티외","위고","테오","바티스트","줄리앙","아드리앵","로맹","뤼카","엔조","가브리엘","킬리안","노에"],
  IT:["로렌초","마테오","안드레아","알레시오","다비데","리카르도","니콜로","가브리엘레","시모네","페데리코","토마소","루카","마르코","피에트로"],
  PT:["주앙","티아구","히카르두","브루누","누누","페드루","디오구","곤살루","하파엘","비토르","안드레","시망","마누엘","제","펠리페"],
  AR:["마르틴","세바스티안","니콜라스","산티아고","에스테반","마티아스","프란시스코","엠마누엘","루시아노","호아킨","이그나시오","레안드로","훌리안","아구스틴"],
  BR:["가브리에우","마테우스","루카스","히카르두","펠리피","브루누","제르손","비니시우스","안드리고","제카","다닐루","카에타누","이고르","무릴루"],
  AB:["아흐메드","무함마드","유세프","오마르","칼리드","카림","사미르","라시드","타레크","이스마일","자키","무니르","아민","파리드"],
  ZA:["시야","템바","루카스","피터","보응아니","카고","티보","네빌","윌렘","시부시소","레라토","야니","마르코","루안"],
  MX:["카를로스","루이스","호세","미겔","알레한드로","디에고","세사르","엑토르","라울","호나탄","에드손","이스라엘","오마르","로드리고"],
  US:["타일러","브랜던","케빈","저스틴","코디","셰인","트래비스","마일스","제이든","오스틴","다니엘","루카스","이선","크리스"],
  OZ:["잭","라이언","코너","루크","조시","이선","브래드","칼럼","다니엘","리암","네이트","오웬","블레이크","라클란"]
};
function genCwcName(cc){
  const S=CWC_SUR[cc]||CWC_SUR.EN, G2=CWC_GIV[cc]||CWC_GIV.EN;
  return pick(G2)+" "+pick(S);
}
/* 용병 — 브라질·유럽·아프리카·남미가 섞인다. 유럽 빅클럽일수록 국적이 다양하다.
   ⚠ 처음엔 브라질 단일명(28개)·아프리카(10개) 같은 좁은 풀에 30%씩 몰아 놓았다.
     32개 클럽 640명을 뽑으니 같은 이름이 여러 팀에 흩어져, 대회 득점 순위에
     「무리치(카사블랑카) 6골 · 무리치(마드리드) 4골」처럼 같은 이름이 두 번 떴다.
     성+이름 조합 풀 쪽으로 무게를 옮겨 경우의 수를 크게 늘린다. */
function genCwcFrnName(){
  const r=Math.random();
  return r<0.10 ? pick(FRN_BR)
       : r<0.32 ? genCwcName("BR")
       : r<0.48 ? genCwcName("ES")
       : r<0.60 ? genCwcName("FR")
       : r<0.70 ? genCwcName("AR")
       : r<0.78 ? pick(FRN_AF)
       : r<0.86 ? genCwcName("AB")
       : r<0.94 ? genCwcName("PT")
       : genCwcName("IT");
}
/* 이번 시즌 CWC 클럽들이 이미 쓰고 있는 이름 — 대회 안에서 동명이인이 나오지 않게 한다 */
function cwcUsedNames(){
  const set=new Set();
  const add=(arr)=>{ if(arr) for(const p of arr) if(p&&p.name) set.add(p.name); };
  try{
    for(const k in (G.cwcClubs||{})){
      const c=G.cwcClubs[k];
      if(c && c.s===G.season && c.t) add(c.t.players);
    }
    /* 아시아 두 장은 EACL 클럽이거나 K리그 구단이다 — 그쪽 이름도 피해야 대회 안에서 겹치지 않는다.
       ⚠ 캐시만 읽는다. cwcTeam() 을 부르면 cwcClub → cwcUsedNames 로 되돌아와 무한 재귀가 된다. */
    for(const k in (G.eaclClubs||{})){
      const c=G.eaclClubs[k];
      if(c && c.s===G.season && c.t) add(c.t.players);
    }
    for(const id of ((G.cwc&&G.cwc.teams)||[])) if(G.teams[id]) add(G.teams[id].players);
  }catch(e){}
  return set;
}

/* 🏟️🏢👔 CWC 클럽 부속 정보 — 구장 · 모기업 · 감독. K리그·EACL 클럽과 똑같이 고유번호를 갖는다. */
const CWC_META={
  eu_mad: {mgr:"알바로 세라노",   stad:{n:"에스타디오 블랑코",      cap:81000}, own:"소시오스 연합"},
  eu_mcy: {mgr:"이언 홀로웨이",   stad:{n:"이스트랜즈 아레나",      cap:53000}, own:"걸프 스포츠그룹"},
  eu_bar: {mgr:"주젭 팔라우",     stad:{n:"캄 블라우그라나",       cap:99000}, own:"소시 조합"},
  eu_mun: {mgr:"토마스 케슬러",   stad:{n:"바이언 아레나",         cap:75000}, own:"바이에른 자동차"},
  eu_liv: {mgr:"숀 갤러거",       stad:{n:"머지사이드 파크",       cap:61000}, own:"보스턴 스포츠홀딩"},
  eu_par: {mgr:"뤼크 모로",       stad:{n:"파르크 데 프랭스",      cap:48000}, own:"세느 인베스트"},
  eu_int: {mgr:"안드레아 콘티",   stad:{n:"산 시로 네라주로",      cap:76000}, own:"밀라노 캐피털"},
  eu_che: {mgr:"롭 하퍼",         stad:{n:"템스브리지",           cap:42000}, own:"웨스트엔드 홀딩스"},
  eu_juv: {mgr:"파올로 비앙키",   stad:{n:"토리노 알피아레나",     cap:41000}, own:"피에몬테 자동차"},
  eu_dor: {mgr:"슈테판 리히터",   stad:{n:"베스트팔렌 옐로월",     cap:81000}, own:"루르 철강"},
  eu_ben: {mgr:"주앙 카르발류",   stad:{n:"이스타디우 다 루스",    cap:65000}, own:"리스본 소시우스"},
  eu_por: {mgr:"누누 파리아",     stad:{n:"이스타디우 두 드라강",  cap:50000}, own:"도루 인베스트"},
  eu_sal: {mgr:"야닉 바흐만",     stad:{n:"잘츠부르크 아레나",     cap:31000}, own:"알프스 음료"},
  sa_riv: {mgr:"마르틴 케베도",   stad:{n:"엘 모누멘탈",          cap:85000}, own:"리베르 소시오스"},
  sa_boc: {mgr:"세바스티안 이바라",stad:{n:"라 봄보네라",          cap:57000}, own:"보카 소시오스"},
  sa_fla: {mgr:"제르손 아제베두", stad:{n:"마라카낭 루브로",       cap:78000}, own:"히우 스포르치"},
  sa_pal: {mgr:"히카르두 모라이스",stad:{n:"아레나 베르지",        cap:43000}, own:"상파울루 크레디투"},
  sa_flu: {mgr:"브루누 텍세이라", stad:{n:"라란자이라스 파크",     cap:39000}, own:"트리콜로르 소시우스"},
  sa_bot: {mgr:"펠리피 카르도주", stad:{n:"니우통 산투스",        cap:46000}, own:"알비네그루 홀딩"},
  af_ahl: {mgr:"오마르 엘사예드", stad:{n:"카이로 인터내셔널",     cap:75000}, own:"나일 스포츠클럽"},
  af_raj: {mgr:"카림 벤알리",     stad:{n:"스타드 모하메드",       cap:67000}, own:"카사블랑카 시"},
  af_sun: {mgr:"테보 모케나",     stad:{n:"루카스 모리페 스타디움",cap:52000}, own:"골드리프 광업"},
  af_wyd: {mgr:"라시드 부슈타",   stad:{n:"스타드 라르제",        cap:45000}, own:"위다드 협회"},
  af_esp: {mgr:"아민 자루크",     stad:{n:"스타드 올랭피크 라데스",cap:60000}, own:"튀니스 산업"},
  na_mty: {mgr:"엑토르 게레로",   stad:{n:"에스타디오 아세로",     cap:53000}, own:"몬테레이 제강"},
  na_sea: {mgr:"브랜던 무어",     stad:{n:"에메랄드 필드",        cap:69000}, own:"노스웨스트 스포츠"},
  na_mia: {mgr:"루카스 산티아고", stad:{n:"베이사이드 파크",       cap:35000}, own:"선코스트 엔터"},
  na_gdl: {mgr:"미겔 델가도",     stad:{n:"에스타디오 사포판",     cap:49000}, own:"할리스코 홀딩"},
  na_lag: {mgr:"크리스 도허티",   stad:{n:"골드코스트 아레나",     cap:38000}, own:"퍼시픽 미디어"},
  oc_auc: {mgr:"라이언 케네디",   stad:{n:"킹스랜드 파크",        cap:12000}, own:"오클랜드 시티협회"},
  oc_wel: {mgr:"조시 도슨",       stad:{n:"웰링턴 스카이스타디움", cap:34000}, own:"쿡해협 물류"},
  oc_syd: {mgr:"루크 마셜",       stad:{n:"하버사이드 아레나",     cap:45000}, own:"뉴사우스 미디어"}
};
function cwcMeta(id){ return CWC_META[id] || {mgr:"미상", stad:{n:"홈구장", cap:30000}, own:"미상"}; }
/* ⚠ 감독을 이름만 들고 있으면 정찰이 그 팀을 읽지 못한다.
   aiPlanFor 는 감독의 판단력·전술 능력을 보고 「이 경기에 들고 나올 판」을 계산하는데,
   EACL 클럽과 달리 CWC 클럽은 {이름, 번호}뿐이라 조언이 통째로 비어 있었다. */
function cwcCoach(id){
  const def=cwcClubDef(id); const M=cwcMeta(id);
  const base=Math.round((cwcSeasonOvr(def)-64)*1.05)+10;
  const v=(k,sp)=>clamp(base+((uidHash(id+k)%(sp*2+1))-sp), 6, 20);
  const o={ n:M.mgr, uid:UID_CWC+700+cwcClubIdx(id), club:(def&&def.name)||"",
    tac:v("t",3), flex:v("f",3), att:v("a",4), def:v("d",4), man:v("m",3), dev:v("v",4), judg:v("j",3) };
  o.ovr=Math.round((o.tac+o.flex+o.att+o.def+o.man+o.dev+o.judg)/7);
  o.nat=(def&&def.nat)||""; o.seed=uidHash(id+"|coach");
  try{ acSeedFromLegacy(o); o.ovr=Math.round((o.tac+o.flex+o.att+o.def+o.man+o.dev+o.judg)/7); }catch(e){}
  return o;
}
function cwcClubDef(id){ return CWC_CLUBS.find(c=>c.id===id)||null; }
/* 📉📈 그 시즌의 클럽 전력 — 해마다 조금씩 오르내린다.
   ⚠ 처음엔 표에 적힌 값을 그대로 썼다. 그러면 마드리드는 100시즌을 돌려도 언제나 89 다.
     세대교체·주축 이적·감독 교체가 겹치면 유럽 강호도 한 해쯤 주저앉고, 중위권이 치고 올라온다.
     시즌·구단으로 고정된 해시라 같은 시즌을 다시 열어도 값이 흔들리지 않는다. */
const CWC_OVR_SHIFT=[-3,-2,-2,-1,-1,-1,0,0,0,0,0,1,1,1,2,2,3];
function cwcSeasonOvr(def){
  if(!def) return 75;
  const base=def.ovr||75;
  const h=uidHash(def.id+"|s"+((G&&G.season)||CUR_YEAR));
  return clamp(base+CWC_OVR_SHIFT[h%CWC_OVR_SHIFT.length], 56, 92);
}
/* ✏️ 에디터에서 고친 이름 — 스쿼드는 시즌마다 새로 만들지만 이름은 덮어쓰기 표로 남는다 */
function cwcNameOv(id){ return (G.cwcName && G.cwcName[String(id).replace(/^cwc_/,"")]) || null; }
function cwcApplyName(t, id){
  const o=cwcNameOv(id); if(!o || !t) return t;
  /* ⚠ 제보 — 「홈구장이랑 수용 인원 등 명칭 바꾸고 넘어가면 다시 가칭으로 돌아가서」.
     CWC 클럽 캐시는 저장 때 비워지고 스쿼드는 시즌마다 새로 만든다 —
     에디터 팀 탭의 전 항목을 덮어쓰기 표에서 되살린다. */
  return ovrTeamApply(t, o, 0.46, 800);
}
function cwcSetName(id, field, v){
  const key=String(id).replace(/^cwc_/,"");
  if(!G.cwcName) G.cwcName={};
  const o=G.cwcName[key] || (G.cwcName[key]={});
  ovrTeamPut(o, field, v);
  if(!Object.keys(o).length) delete G.cwcName[key];
  /* 캐시에 이미 만들어 둔 스쿼드가 있으면 그 자리에서 갈아 끼운다 */
  try{ const c=G.cwcClubs && G.cwcClubs[key]; if(c && c.t) cwcApplyName(c.t, key); }catch(e){}
  saveGame();
}
function cwcName(){ try{ return compName("cwc"); }catch(e){ return "CWC "+((G&&G.season)||CUR_YEAR); } }
function cwcShort(){ try{ return compShort("cwc"); }catch(e){ return "CWC"; } }
/* 1월 일정 — 0 = 1월 1일. 조별 4일 간격 · 녹아웃 6~7일 간격 · 결승은 1월 안에 끝난다 */
/* ⚠ 첫 뼈대는 나흘 간격이었다. 실측해 보니 3차전 킥오프 컨디션이 68까지 떨어져,
     대회가 실력 싸움이 아니라 체력 싸움이 됐다. 엿새 간격으로 벌려 한 달 안에 넣는다. */
const CWC_DAY={g:[2,8,14], qf:20, sf:25, f:30};
function cwcOn(){ return !!(G.cwc && G.cwc.s===G.season && (G.cwc.teams||[]).length); }
function cwcMine(){ return cwcOn() && G.cwc.teams.indexOf(G.userTeamId)>=0 && !G.jobless; }
function cwcAllDays(){ return cwcOn() ? [...G.cwc.day.g, G.cwc.day.qf, G.cwc.day.sf, G.cwc.day.f] : []; }
/* 팀 해석 — 유저·K리그 구단 · EACL 클럽 · CWC 클럽을 한 창구로 */
function cwcTeam(id){
  if(!id) return null;
  if(G.teams[id]) return G.teams[id];
  if(String(id).indexOf("eacl_")===0){ try{ return eaclClub(String(id).slice(5)); }catch(e){ return null; } }
  if(String(id).indexOf("cwc_")===0){ try{ return cwcClub(String(id).slice(4)); }catch(e){ return null; } }
  try{ return eaclClub(id); }catch(e){ return null; }
}
function cwcNm(id, full){ const t=cwcTeam(id); return t ? (full?t.name:(t.short||t.name)) : "?"; }
/* CWC 클럽 스쿼드 — EACL 과 같은 방식으로 그 시즌 기준 나이로 새로 만든다 */
function cwcClub(id){
  if(!G.cwcClubs) G.cwcClubs={};
  const c=G.cwcClubs[id];
  if(c && c.s===G.season) return cwcApplyName(c.t, id);
  const def=cwcClubDef(id); if(!def) return null;
  const CF=CWC_CONF[def.cf]||CWC_CONF.EU;
  const base=cwcSeasonOvr(def);          // 그 시즌의 체급 — 해마다 조금씩 다르다
  const t={id:"cwc_"+def.id, name:def.name, short:def.short, col:def.col, col2:def.col2,
    nat:def.nat||CF.n, cf:def.cf, cwc:true, eacl:true, div:0, budget:0, fans:0, players:[],
    form:[], morale:60, uid:UID_CWC+cwcClubIdx(def.id),
    tactic:{formation:"4-3-3", mentality:2, pass:2, tempo:2, press:2, line:2, width:2, counter:2, crossFq:2, longShot:2, benchSel:[]},
    W:0,Dw:0,L:0,GF:0,GA:0,Pts:0, isUser:false, aclMoney:0};
  /* 자국 선수는 그 나라 이름으로, 용병은 브라질·유럽·아프리카·남미가 섞인다 */
  const used={};
  try{ used[cwcMeta(def.id).mgr]=1; }catch(e){}   // 감독과 같은 이름의 선수가 나오지 않게
  try{ cwcUsedNames().forEach(n=>{ used[n]=1; }); }catch(e){}   // 다른 참가 클럽이 이미 쓴 이름도 피한다
  const uniq=(frn)=>{ const f=()=>frn?genCwcFrnName():genCwcName(def.cc||"EN");
    let n=f(); for(let k=0;k<40 && used[n];k++) n=f(); used[n]=1; return n; };
  for(const s of eaclSquadPlan({...def, fN:CF.fN})){
    const _bell=Math.min(R(9)+R(9), 17);
    const _age0=18+_bell-(s.i>=3?2:0)+((s.star||s.i===0)?2:0);
    const by=G.season-clamp(_age0, 17, 36);
    const age=G.season-by;
    const ageAdj = age<=19?-8 : age<=21?-5 : age<=23?-2 : age<=31?1 : age<=34?-1 : -4;
    const depth = s.i===0?3 : s.i===1?1 : s.i===2?-1 : -4;
    const ovr=clamp(base+ageAdj+depth+(R(5)-2), 50, base+6);
    const frn=s.frn?1:0;
    const pl=mkPlayer(uniq(frn), s.pos, by, ovr, 1);
    pl.uid=nextGenUid(); pl.natCode=frn?"용병":(def.nat||CF.n);
    /* 세부 자리를 못박는다 — CWC 클럽도 전문 풀백·윙어가 나오게 (제보) */
    try{ if(s.pref){ pl.prefPos=s.pref; pl.posFam=initPosFam(pl); syncPosBand(pl); applySpecialization(pl); retuneTraits(pl); } }catch(e){}
    t.players.push(pl);
  }
  /* 🆔 부속 정보 — 구장 · 모기업 · 감독이 각자 고유번호를 갖는다 */
  const MT=cwcMeta(def.id);
  t.stad={uid:UID_CWC+500+cwcClubIdx(def.id), n:MT.stad.n, cap:MT.stad.cap, avg:Math.round(MT.stad.cap*0.46)};
  t.own={uid:UID_CWC+600+cwcClubIdx(def.id), n:MT.own};
  t.coach=cwcCoach(def.id);
  t.fans=Math.round(MT.stad.cap/800);
  cwcApplyName(t, def.id);              // ✏️ 에디터에서 고쳐 둔 이름이 있으면 얹는다
  try{ assignNumbers(t); }catch(e){}
  try{ assignAIRoles(t); }catch(e){}
  try{ assignAITactics(t); }catch(e){}
  G.cwcClubs[id]={s:G.season, t};
  return t;
}
function cwcClubIdx(id){ const i=CWC_CLUBS.findIndex(c=>c.id===id); return i<0?90:i; }
/* ── 대회 편성 ─────────────────────────────────────────────────────────
   startNewSeason 이 달력을 새로 깐 「뒤에」 불린다. 지난 시즌 EACL 결승 진출 두 팀이
   아시아 2장을 가져가고, 나머지 14장은 대륙별로 채운다. */
function cwcSetup(){
  G.cwc=null;
  const Q=G.cwcQual;
  if(!Q || !Q.champ) return;                       // 지난 시즌 EACL 이 끝나지 않았다 — 대회 없음
  /* ⚠ 자격은 「직전 시즌」 것이어야 한다. 이 확인이 없으면 옛 세이브에 남은 자격표가
     해마다 되살아나, 아시아 챔피언이 아닌데도 매년 세계 대회에 나가게 된다. */
  if(Q.s !== (G.season-1)){ G.cwcQual=null; return; }
  const teams=[];
  const push=(id)=>{ if(id && teams.indexOf(id)<0) teams.push(id); };
  /* 🌏 아시아 2장 — 지난 시즌 EACL 결승에 오른 두 팀 (우승 · 준우승) */
  push(Q.champ); push(Q.runner);
  const byConf={};
  for(const c of CWC_CLUBS) (byConf[c.cf]=byConf[c.cf]||[]).push(c.id);
  const host=CWC_HOSTS[(G.season||0)%CWC_HOSTS.length];
  /* 나머지 14장 — 대륙별로 뽑는다. 후보 풀이 장수보다 많아 시즌마다 얼굴이 바뀐다. */
  for(const [cf,n] of CWC_SLOTS){
    const pool=shuffled(byConf[cf]||[]);
    let k=0;
    for(const id of pool){ if(k>=n) break; if(teams.indexOf("cwc_"+id)>=0) continue; push("cwc_"+id); k++; }
  }
  /* 안전장치 — 어떤 대륙 풀이 모자라면 남은 클럽 중 전력이 가까운 순으로 채운다 */
  if(teams.length<16){
    for(const c of shuffled(CWC_CLUBS)){ if(teams.length>=16) break;
      if(teams.indexOf("cwc_"+c.id)<0) push("cwc_"+c.id); }
  }
  if(teams.length<16) return;
  /* 🏺 포트 추첨 — 실제 클럽 월드컵과 같은 방식이다.
     전력순으로 넷씩 끊어 네 개의 포트를 만들고, 각 조가 포트마다 한 팀씩 가져간다.
     ⚠ 예전 뼈대는 「같은 대륙만 피하는」 무작위 추첨이라 약체 둘이 한 조에 몰리는 조가 나왔다.
       그 조에 걸리면 8강까지 갈 만했다 — 우승 상금 350억짜리 대회의 난이도가 아니다.
     포트제에서는 아시아 팀이 사실상 항상 포트 4다. 즉 우리 조에는
     유럽 챔피언 하나, 남미급 하나, 아프리카·북중미급 하나가 반드시 들어온다.
     (2025년 울산이 도르트문트·플루미넨세·마멜로디와 한 조에 묶였던 그림이다) */
  const confOf=(id)=>{ if(G.teams[id]) return "AS"; if(String(id).indexOf("eacl_")===0) return "AS";
                       const d=cwcClubDef(String(id).replace(/^cwc_/,"")); return d?d.cf:"EU"; };
  const powOf=(id)=>{ try{ return teamOVR(cwcTeam(id))||60; }catch(e){ return 60; } };
  const ranked=teams.slice().sort((a,b)=>powOf(b)-powOf(a));
  const pots=[ranked.slice(0,4), ranked.slice(4,8), ranked.slice(8,12), ranked.slice(12,16)];
  const grp={A:[],B:[],C:[],D:[]}, KEY=["A","B","C","D"];
  for(const pot of pots){
    const bag=shuffled(pot);
    /* 같은 대륙이 겹치지 않는 조를 먼저 채운다 — 안 되면 빈 조 아무 곳에나 */
    for(const id of bag){
      const open=KEY.filter(k=>grp[k].length<pots.indexOf(pot)+1);
      let put=open.find(k=>!grp[k].some(x=>confOf(x)===confOf(id)));
      grp[put || open[0] || "A"].push(id);
    }
  }
  /* 조별 일정 — 4팀 단일 로빈 3차전 */
  const RR=[[[0,1],[2,3]],[[0,2],[3,1]],[[0,3],[1,2]]];
  const fix=[];
  for(const k of KEY){ const a=grp[k];
    RR.forEach((rd,ri)=>rd.forEach(([x,y])=>fix.push({g:k, r:ri, h:a[x], a:a[y], done:0, hg:0, ag:0})));
  }
  const tbl={}; for(const id of teams) tbl[id]={W:0,D:0,L:0,GF:0,GA:0,Pts:0};
  G.cwc={s:G.season, host, teams, grp, tbl, fix, ko:{qf:[],sf:[],f:null},
         stage:"grp", champ:null, day:{g:CWC_DAY.g.slice(), qf:CWC_DAY.qf, sf:CWC_DAY.sf, f:CWC_DAY.f}};
  /* 달력이 결승일에 닿기 전에 끝나지 않게 늘려 둔다 */
  try{ if(G.cal && (G.cal.last||0)<CWC_DAY.f+2) G.cal.last=CWC_DAY.f+2; }catch(e){}
  /* 연습경기를 대회 뒤로 다시 깐다 — buildPreseason 은 대회가 편성되기 전에 이미 한 번 돌았다 */
  try{ if(teams.indexOf(G.userTeamId)>=0 && !G.jobless) buildPreseason(); }catch(e){}
  try{
    const meIn=teams.indexOf(G.userTeamId)>=0;
    if(meIn){ cwcPay(G.userTeamId, CWC_PRIZE.enter); try{ cwcOnEnter(); }catch(e){} }
    addNews(`🌍 <b>${cwcName()}</b> 조 추첨 완료 — ${host} 개최, 16개 클럽이 참가합니다.`
      + (meIn?` <b>${userTeam().short}</b>은(는) 지난 시즌 ${eaclShort()} 우승 자격으로 ${Object.keys(grp).find(k=>grp[k].indexOf(G.userTeamId)>=0)}조에 편성되었습니다.`:""),
      meIn?"good":"info", "club");
    if(meIn){
      const gk=Object.keys(grp).find(k=>grp[k].indexOf(G.userTeamId)>=0);
      const rivals=(grp[gk]||[]).filter(x=>x!==G.userTeamId).map(x=>cwcNm(x)).join(" · ");
      try{ cwcSocial("draw", {o:rivals}); }catch(e){}
    }
  }catch(e){}
}
/* 오늘 CWC 경기가 있는 날인가 (유저 참가 여부와 무관 — 달력 표시·휴식 판정용) */
function cwcIsDay(i){ return cwcOn() && cwcAllDays().indexOf(i)>=0; }
/* 그날 「내 경기」가 있는가 — 경기일 판정(자동 휴식·회복)에는 이쪽을 쓴다.
   ⚠ 대회가 열리는 날이라고 다 경기일이 아니다. 조별에서 탈락하고 나면 8강·4강·결승 날은
     우리에게 그냥 평일이다. 예전 판정으로는 탈락 뒤에도 사흘이 통째로 훈련 금지가 됐다. */
function cwcMyDay(i){
  if(!cwcMine()) return false;
  const me=G.userTeamId, C=G.cwc;
  const gi=C.day.g.indexOf(i);
  if(gi>=0) return C.fix.some(m=>m.r===gi && (m.h===me||m.a===me));
  for(const st of ["qf","sf","f"]){
    if(C.day[st]!==i) continue;
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    return (ties||[]).some(t=>t && (t.h===me||t.a===me));
  }
  return false;
}
/* 오늘 유저가 치를 CWC 경기 */
function cwcUserDue(){
  if(!cwcMine()) return null;
  const me=G.userTeamId, d=G.day||0, C=G.cwc;
  const gi=C.day.g.indexOf(d);
  if(gi>=0){ const m=C.fix.find(f=>f.r===gi && !f.done && (f.h===me||f.a===me));
             if(m) return {kind:"grp", m, tag:`${cwcShort()} 조별 ${gi+1}차전`}; }
  for(const st of ["qf","sf","f"]){
    if(C.day[st]!==d) continue;
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    for(const t of (ties||[])){ if(t && !t.done && (t.h===me||t.a===me))
      return {kind:st, m:t, tag:`${cwcShort()} ${CWC_KO_NAME[st]}`}; }
  }
  return null;
}
const CWC_KO_NAME={qf:"8강", sf:"4강", f:"결승"};

/* ── 대회 진행 ─────────────────────────────────────────────────────── */
const CWC_PRIZE={enter:60, win:12, draw:5, qf:40, sf:80, fin:140, champ:350};
function cwcPower(id){ try{ return teamOVR(cwcTeam(id))||70; }catch(e){ return 70; } }
/* 모든 경기가 중립지다 — 홈 이점이 없다 */
function cwcSim(hid, aid){
  const hp=cwcPower(hid), ap=cwcPower(aid);
  const poisson=(l)=>{l=Math.max(0.08,l);let L=Math.exp(-l),k=0,q=1;do{k++;q*=Math.random();}while(q>L);return k-1;};
  return [poisson(1.20+(hp-ap)*0.075), poisson(1.20+(ap-hp)*0.075)];
}
function cwcRow(id){ if(!G.cwc.tbl[id]) G.cwc.tbl[id]={W:0,D:0,L:0,GF:0,GA:0,Pts:0}; return G.cwc.tbl[id]; }
function cwcPay(id, amt){
  if(id!==G.userTeamId) return;
  const t=userTeam(); if(!t) return;
  const fin=finLedger(t);
  if(fin.cwc==null) fin.cwc=0;
  const pay=Math.max(0, +amt||0);
  t.budget=Math.round((t.budget+pay)*10)/10;
  fin.cwc=Math.round(((fin.cwc||0)+pay)*10)/10;    // 🌍 이번 시즌 몫 (재정 탭 표시)
  t.cwcMoney=Math.round(((t.cwcMoney||0)+pay)*10)/10;   // 커리어 누적
}
function cwcRecord(m, hg, ag, byEngine){
  const me=G.userTeamId;
  m.hg=hg; m.ag=ag; m.done=1;
  try{ cwcCredit(m.h, hg, byEngine); cwcCredit(m.a, ag, byEngine); }catch(e){}
  const H=cwcRow(m.h), A=cwcRow(m.a);
  H.GF+=hg; H.GA+=ag; A.GF+=ag; A.GA+=hg;
  if(hg>ag){ H.W++; A.L++; H.Pts+=3; cwcPay(m.h, CWC_PRIZE.win); }
  else if(hg<ag){ A.W++; H.L++; A.Pts+=3; cwcPay(m.a, CWC_PRIZE.win); }
  else { H.D++; A.D++; H.Pts++; A.Pts++; cwcPay(m.h, CWC_PRIZE.draw); cwcPay(m.a, CWC_PRIZE.draw); }
  if(m.h===me||m.a===me){
    const home=m.h===me, my=home?hg:ag, op=home?ag:hg;
    const money=my>op?CWC_PRIZE.win:my===op?CWC_PRIZE.draw:0;
    addNews(`🌍 ${cwcShort()} 조별 ${m.r+1}차전: ${userTeam().short} ${my} - ${op} ${cwcNm(home?m.a:m.h)}${money?` (+${money}억)`:""}`,
      my>op?"good":my===op?"info":"bad", "club");
  }
}
/* 조 순위 — 승점 · 골득실 · 다득점 */
function cwcGrpSorted(k){
  const a=(G.cwc.grp[k]||[]).slice();
  return a.sort((x,y)=>{ const X=cwcRow(x), Y=cwcRow(y);
    return Y.Pts-X.Pts || (Y.GF-Y.GA)-(X.GF-X.GA) || Y.GF-X.GF; });
}
/* 8강 대진 — A1-B2 · C1-D2 · B1-A2 · D1-C2 (같은 조끼리 다시 만나지 않는다) */
function cwcSeedKO(){
  const S={}; for(const k of ["A","B","C","D"]) S[k]=cwcGrpSorted(k);
  const pair=[["A","B"],["C","D"],["B","A"],["D","C"]];
  G.cwc.ko.qf=pair.map(([x,y])=>({h:S[x][0], a:S[y][1], done:0, hg:0, ag:0}));
  G.cwc.stage="qf";
  const me=G.userTeamId, adv=[].concat(...pair.map(([x,y])=>[S[x][0], S[y][1]]));
  if(adv.indexOf(me)>=0){ cwcPay(me, CWC_PRIZE.qf);
    addNews(`🌍 <b>${cwcShort()} 8강 진출!</b> 조별리그를 통과했습니다 (+${CWC_PRIZE.qf}억)`, "good", "club");
    try{ cwcOnQuarter(); }catch(e){}
    try{ cwcSocial("qfIn"); }catch(e){}
    try{ pushFeed({cat:"club", ic:"🌍", tone:1, tid:me, src:"국제축구연맹",
      head:`${userTeam().name}, ${cwcName()} 8강 진출`,
      sub:`유럽·남미 챔피언들과 한 조에서 살아남았다. 아시아 클럽으로는 흔치 않은 성과다.`}); }catch(e){} }
  else if(cwcMine()){ addNews(`🌍 ${cwcShort()} 조별리그 탈락 — 세계의 벽은 높았습니다.`, "bad", "club");
    try{ cwcSocial("grpOut"); }catch(e){} }
  addNews(`🌍 ${cwcShort()} 8강 대진 — ${G.cwc.ko.qf.map(t=>cwcNm(t.h)+" vs "+cwcNm(t.a)).join(" · ")}`, "info", "club");
}
/* 단판 — 비기면 승부차기 */
function cwcRecordKO(t, stage, hg, ag, pk, byEngine){
  t.hg=hg; t.ag=ag;
  try{ cwcCredit(t.h, hg, byEngine); cwcCredit(t.a, ag, byEngine); }catch(e){}
  if(hg===ag){
    let hw;
    if(pk) hw=(pk>0);
    else {
      const sk=(id)=>{ try{ const tm=cwcTeam(id), ps=(tm&&tm.players)||[];
        const top=ps.slice().sort((x,y)=>pkSkillOf(y)-pkSkillOf(x)).slice(0,5);
        return top.length? top.reduce((s,p)=>s+pkSkillOf(p),0)/top.length : 200; }catch(e){ return 200; } };
      hw = Math.random() < 0.5+clamp((sk(t.h)-sk(t.a))/900, -0.16, 0.16);
    }
    t.w = hw?t.h:t.a; t.pk=1;
  } else t.w = hg>ag ? t.h : t.a;
  t.done=1;
  const me=G.userTeamId;
  if(t.h===me||t.a===me){
    const my=(t.h===me?hg:ag), op=(t.h===me?ag:hg);
    addNews(`🌍 ${cwcShort()} ${CWC_KO_NAME[stage]}: ${userTeam().short} ${my} - ${op} ${cwcNm(t.h===me?t.a:t.h)}${t.pk?` (승부차기 ${t.w===me?"승":"패"})`:""}`,
      t.w===me?"good":"bad", "club");
    /* 🚪 8강·4강에서 떨어지는 순간 — 결승 패배(준우승)는 따로 다룬다 */
    if(t.w!==me && stage!=="f" && !G.jobless){
      try{ cwcSocial("koOut", {o:cwcNm(t.h===me?t.a:t.h)}); }catch(e){}
      try{ pushFeed({cat:"club", ic:"🌍", tone:0, tid:me, src:"국제축구연맹",
        head:`${userTeam().name}, ${cwcShort()} ${CWC_KO_NAME[stage]}에서 여정 마감`,
        sub:`${cwcNm(t.h===me?t.a:t.h)}에 ${my}-${op}${t.pk?" (승부차기)":""}. 아시아 대표의 도전은 ${CWC_KO_NAME[stage]}에서 멈췄다.`}); }catch(e){}
    }
  }
}
function cwcAdvance(stage){
  const me=G.userTeamId, K=G.cwc.ko;
  if(stage==="qf"){
    if(K.qf.some(t=>!t.done)) return;
    const w=K.qf.map(t=>t.w);
    K.sf=[{h:w[0],a:w[1],done:0,hg:0,ag:0},{h:w[2],a:w[3],done:0,hg:0,ag:0}];
    G.cwc.stage="sf";
    if(w.indexOf(me)>=0){ cwcPay(me, CWC_PRIZE.sf); addNews(`🌍 <b>${cwcShort()} 4강 진출!</b> (+${CWC_PRIZE.sf}억)`, "good", "club");
      try{ trophyAdd("cwcSF", `${G.season} ${cwcShort()} 4강`, userTeam().name); }catch(e){}
      try{ cwcSocial("sfIn"); }catch(e){} }
  } else if(stage==="sf"){
    if(K.sf.some(t=>!t.done)) return;
    const w=K.sf.map(t=>t.w);
    K.f={h:w[0], a:w[1], done:0, hg:0, ag:0};
    G.cwc.stage="f";
    if(w.indexOf(me)>=0){ cwcPay(me, CWC_PRIZE.fin); addNews(`🌍 <b>${cwcShort()} 결승 진출!</b> 세계 정상까지 한 경기 남았습니다 (+${CWC_PRIZE.fin}억)`, "good", "club");
      try{ trophyAdd("cwcSF", `${G.season} ${cwcShort()} 결승`, userTeam().name); }catch(e){}
      try{ cwcSocial("finalIn"); }catch(e){}
      try{ pushFeed({cat:"club", ic:"🌍", tone:1, tid:me, src:"국제축구연맹",
        head:`${userTeam().name}, ${cwcName()} 결승 진출`,
        sub:`K리그 구단이 세계 클럽 결승에 오른다. 한 경기 남았다.`}); }catch(e){} }
    addNews(`🌍 ${cwcShort()} 결승 — ${cwcNm(K.f.h, true)} vs ${cwcNm(K.f.a, true)}`, "info", "club");
  } else {
    if(!K.f || !K.f.done) return;
    const ch=K.f.w; G.cwc.champ=ch; G.cwc.stage="end";
    try{ cwcArchiveStats(); }catch(e){}      // 스쿼드가 치워지기 전에 기록을 떠 둔다
    addNews(`🏆 <b>${cwcName()} 우승 — ${cwcNm(ch, true)}!</b>`, ch===me?"good":"info", "club");
    if(ch===me && !G.jobless){ cwcPay(me, CWC_PRIZE.champ);
      addNews(`🏆 <b>세계 정상!</b> ${userTeam().short}이(가) ${cwcShort()} 트로피를 들어올렸습니다 (+${CWC_PRIZE.champ}억)`, "good", "club");
      try{ cwcOnChampion(); }catch(e){}
    } else if(!G.jobless && K.f && (K.f.h===me||K.f.a===me)){
      try{ cwcOnRunnerUp(); }catch(e){}
    }
  }
}
/* 오늘 날짜 기준으로 대회를 굴린다. force 면 유저 경기까지 시뮬한다(마감 처리용). */
function cwcTick(force){
  if(!cwcOn()) return;
  const C=G.cwc, me=G.userTeamId, d=G.day||0;
  const mine=cwcMine();
  const skip=(m)=>(!force && mine && (m.h===me||m.a===me));
  /* 조별 — 오늘이 그 차전 날이면 나머지 경기를 치른다 */
  const gi=C.day.g.indexOf(d);
  if(gi>=0){
    for(const m of C.fix){ if(m.r!==gi || m.done || skip(m)) continue;
      const [hg,ag]=cwcSim(m.h,m.a); cwcRecord(m,hg,ag); }
  }
  if(C.stage==="grp" && C.fix.every(m=>m.done)){ try{ cwcSeedKO(); }catch(e){} }
  /* 녹아웃 */
  for(const st of ["qf","sf","f"]){
    if(C.stage!==st) continue;
    if(C.day[st]>d) break;      // force 는 유저 경기 대행일 뿐 — 날짜를 앞당기지 않는다
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    for(const t of (ties||[])){ if(!t || t.done || skip(t)) continue;
      const [hg,ag]=cwcSim(t.h,t.a); cwcRecordKO(t, st, hg, ag, 0); }
    try{ cwcAdvance(st); }catch(e){}
  }
}
/* 내 마지막 CWC 경기일 — 대회 기간의 끝 */
function cwcMyLastDay(){
  if(!cwcMine()) return -1;
  const me=G.userTeamId, C=G.cwc; let last=-1;
  for(const m of C.fix) if(m.h===me||m.a===me) last=Math.max(last, C.day.g[m.r]);
  for(const st of ["qf","sf","f"]){
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    if((ties||[]).some(t=>t && (t.h===me||t.a===me))) last=Math.max(last, C.day[st]);
  }
  return last;
}
/* 🌍 대회 기간인가 — 시즌 시작부터 내 마지막 경기까지.
   ⚠ 「진출이 확정되었으면 프리시즌 컨디션과는 별개로 진행해야 한다」.
     맞는 말이다. 1월 내내 나흘에 한 번 세계 대회를 치르는데 주간 루틴(보통 강도)이
     그대로 깔리면, 대회 성적이 「프리시즌 훈련을 얼마나 세게 했는가」에 좌우된다.
     대회 기간에는 감독이 따로 지정하지 않은 날을 회복 위주(가볍게)로 둔다.
     ─ 대신 값을 치른다. 1월을 대회에 쓰면 개막 준비는 그만큼 늦다.
       탈락하거나 대회가 끝나면 그날로 창이 닫히고 평소 루틴이 돌아온다. */
function cwcWindow(i){
  try{
    if(!cwcMine() || !cwcUserLeft()) return false;
    const last=cwcMyLastDay();
    return last>=0 && i<=last;
  }catch(e){ return false; }
}
/* 유저 경기 결과를 대회에 반영하고, 같은 날 나머지 경기를 이어서 치른다 */
function cwcResolveUser(P, hg, ag, pk){
  if(!cwcOn()) return;
  const C=G.cwc;
  if(P.kind==="grp"){
    const m=C.fix.find(x=>x.r===P.r && x.h===P.hid && x.a===P.aid && !x.done);
    if(m) cwcRecord(m, hg, ag, true);
  } else {
    const ties = P.kind==="f" ? [C.ko.f] : (C.ko[P.kind]||[]);
    const t=(ties||[]).find(x=>x && x.h===P.hid && x.a===P.aid && !x.done);
    if(t) cwcRecordKO(t, P.kind, hg, ag, pk||0, true);
  }
  try{ cwcTick(false); }catch(e){}     // 같은 날 나머지 경기 + 단계 전환
}
/* 유저에게 아직 남은 CWC 경기가 있는가 — 달력을 그 날까지 흘려보내기 위해 */
function cwcUserLeft(){
  if(!cwcMine() || G.cwc.stage==="end") return false;
  const me=G.userTeamId, C=G.cwc;
  if(C.fix.some(m=>!m.done && (m.h===me||m.a===me))) return true;
  for(const st of ["qf","sf","f"]){
    const ties = st==="f" ? [C.ko.f] : (C.ko[st]||[]);
    if((ties||[]).some(t=>t && !t.done && (t.h===me||t.a===me))) return true;
  }
  return false;
}


/* 기존 화면들이 보던 G.aclFix — 유저팀 일정만 비춰 준다 */
/* 📅 EACL 경기일 — 리그 경기일 사흘 전(주중)에 잡는다.
   실제 아시아 대항전처럼 「주중 대륙대회 → 주말 리그」 리듬이 만들어지고,
   달력에도 리그 경기와 겹치지 않게 표시된다. */
function eaclDayOfRound(r){
  const rd=(G.cal&&G.cal.roundDay)||[];
  if(r>=0 && r<rd.length) return Math.max(1, rd[r]-3);
  return Math.max(1, ((G.cal&&G.cal.last)||220) - 6);
}
/* 리그 경기 사이의 「낄 수 있는 자리」 — 앞뒤로 최소 사흘씩 비어 있는 날만 고른다.
   ⚠ 제보 — K리그 경기 바로 다음 날 EACL 경기가 잡힌다.
      예전에는 무조건 「리그 경기일 - 3일」에 뒀는데, 그 앞 라운드가 미드위크(수요일) 경기면
      목요일 EACL 이 되어 이틀 연속 경기가 됐다. 이제는 간격이 넉넉한 구간만 후보로 삼는다. */
const EACL_REST=3;                    // 리그 경기와 EACL 경기 사이 최소 간격(일)
function eaclOpenSlots(){
  const rd=(G.cal&&G.cal.roundDay)||[];
  const out=[];
  for(let r=1; r<rd.length; r++){
    const prev=rd[r-1], next=rd[r], gap=next-prev;
    if(gap < EACL_REST*2+1) continue;                  // 주중 2연전 같은 빡빡한 구간은 건너뛴다
    const mid=prev+Math.floor(gap/2);
    if(mid-prev>=EACL_REST && next-mid>=EACL_REST) out.push(mid);
  }
  return out;
}
/* 그 시즌 12월 nth 번째 토요일의 달력 인덱스 — 4강·결승을 못 박는 기준 */
function decWeekendDay(nth){
  try{
    const open=calOpenDate(); open.setHours(12,0,0,0);
    const y=open.getFullYear();
    const d1=new Date(y,11,1);
    let dd=1+((6-d1.getDay())+7)%7;          // 12월 첫 토요일
    dd+=(Math.max(1,nth)-1)*7;
    if(dd>28) dd=28;                          // 반드시 해를 넘기기 전
    const t=new Date(y,11,dd); t.setHours(12,0,0,0);
    return Math.round((t-open)/86400000);
  }catch(e){ return null; }
}
function eaclBuildDates(){
  if(!G.eacl) return;
  const rd=(G.cal&&G.cal.roundDay)||[];
  const N=rd.length||34;
  const slots=eaclOpenSlots();
  const need=11;                                        // 리그 스테이지 8 + 8강·4강·결승
  let days=[];
  if(slots.length>=need){
    /* 시즌 전체에 고르게 펼친다 — 앞뒤로 몰리면 일정이 이상해진다 */
    const used={};
    for(let k=0;k<need;k++){
      let idx=Math.round(k*(slots.length-1)/(need-1));
      while(used[idx] && idx<slots.length-1) idx++;
      while(used[idx] && idx>0) idx--;
      used[idx]=1; days.push(slots[idx]);
    }
    days.sort((a,b)=>a-b);
  } else {
    /* 후보가 모자란 시즌(라운드가 아주 적은 경우) — 예전 방식으로 되돌아간다 */
    for(let d=0; d<8; d++) days.push(eaclDayOfRound(Math.min(N-5, EACL_MD_ROUND[d])));
    days.push(eaclDayOfRound(Math.min(N-3, EACL_KO_ROUND.qf)));
    days.push(eaclDayOfRound(Math.min(N-2, EACL_KO_ROUND.sf)));
    days.push(eaclDayOfRound(Math.min(N-1, EACL_KO_ROUND.f)));
  }
  /* 단조 증가 보정 — 어떤 경로로 왔든 날짜가 겹치지 않게 */
  for(let k=1;k<days.length;k++) if(days[k]<=days[k-1]) days[k]=days[k-1]+3;
  /* 🏆 ⚠ 제보 — 「8강은 감독이 지휘했는데 4강·결승은 수석코치가 치렀다. 4강 12/19, 결승 다음 해 1/2」.
     예전에는 4강·결승을 「리그 최종전보다 나흘 앞」으로만 당겼는데, 슬롯 배분에 따라
     대회 막판이 12월 하순·다음 해 1월까지 밀려났다. 그런데 승강 PO가 끝나는 순간 시즌이
     닫히므로(advance 의 po 분기), 그 뒤에 남은 대회 경기는 감독 손을 떠나 버렸다.
     ─ 4강 = 12월 둘째 주 토요일, 결승 = 셋째 주 토요일. 정확히 일주일 간격, 반드시 해를 넘기기 전.
       8강은 4강보다 최소 일주일 앞에 두고, 리그 스테이지 8경기는 그 앞으로 사흘씩 물린다. */
  try{
    const sfD=decWeekendDay(2), fD=decWeekendDay(3);
    if(sfD!=null && fD!=null && fD>sfD){
      days[10]=fD; days[9]=sfD;
      if(days[8]>days[9]-7) days[8]=days[9]-7;
      for(let k=7;k>=0;k--) if(days[k]>days[k+1]-3) days[k]=days[k+1]-3;
    }
  }catch(e){}
  const md=days.slice(0,8);
  G.eacl.mdDay=md;
  G.eacl.koDay={qf:days[8], sf:days[9], f:days[10]};
  /* 달력이 리그 최종전에서 끝나면 결승일에 닿기도 전에 「시즌 종료」가 된다 — 결승 뒤까지 늘려 둔다 */
  try{ if(G.cal && days[10]!=null && (G.cal.last||0)<days[10]+2) G.cal.last=days[10]+2; }catch(e){}
}
/* 구버전 세이브(날짜가 없는 세이브)도 문제없이 굴러가도록 라운드 기준으로 되돌아간다 */
function eaclMdDay(d){
  const a=G.eacl&&G.eacl.mdDay;
  return (a && a[d]!=null) ? a[d] : matchDayOf(EACL_MD_ROUND[d]);
}
function eaclKoDay(st){
  const o=G.eacl&&G.eacl.koDay;
  return (o && o[st]!=null) ? o[st] : matchDayOf(EACL_KO_ROUND[st]);
}
/* 그 단계의 대진이 실제로 짜인 날을 기억한다 — 앞 단계가 밀리면 예정일이 이미 지나 있을 수 있고,
   그러면 열리자마자 「기한 초과」로 판정되어 유저가 손도 못 대고 위임된다. */
function eaclStageOpened(st){
  const K=G.eacl&&G.eacl.ko; if(!K) return;
  K.openAt=K.openAt||{};
  if(K.openAt[st]==null) K.openAt[st]=G.day||0;
}
/* 유예 기준일 — 예정일과 「대진이 짜인 날」 중 늦은 쪽 */
function eaclKoDue(st){
  const K=G.eacl&&G.eacl.ko;
  const sched=eaclKoDay(st);
  const open=(K&&K.openAt&&K.openAt[st]!=null)?K.openAt[st]:sched;
  return Math.max(sched, open);
}
function eaclMirrorUserFix(){
  G.aclFix=[];
  if(!eaclOn()) return;
  const me=G.userTeamId; if(G.eacl.teams.indexOf(me)<0) return;
  for(const m of G.eacl.fix){
    if(m.h!==me && m.a!==me) continue;
    const home=m.h===me, opp=eaclTeam(home?m.a:m.h);
    G.aclFix.push({opp:(opp&&opp.name)||"?", oppOvr:eaclPower(home?m.a:m.h), home, done:!!m.done,
      hg:home?m.hg:m.ag, ag:home?m.ag:m.hg, afterRound:EACL_MD_ROUND[m.d]||0, md:m.d, day:eaclMdDay(m.d)});
  }
  G.aclFix.sort((a,b)=>a.afterRound-b.afterRound);
}
/* ── 경기 시뮬 ─────────────────────────────────────────── */
function eaclSim(hid, aid, neutral){
  const hp=eaclPower(hid)+(neutral?0:2.2), ap=eaclPower(aid);
  const poisson=(l)=>{l=Math.max(0.08,l);let L=Math.exp(-l),k=0,q=1;do{k++;q*=Math.random();}while(q>L);return k-1;};
  return [poisson(1.15+(hp-ap)*0.055), poisson(1.15+(ap-hp)*0.055)];
}
function eaclPay(id, amt, why){
  if(id!==G.userTeamId) return;
  const t=userTeam(); if(!t) return;
  /* 🌏 제보 — 이번 시즌 대회 상금은 시즌 장부에 담는다(재정 탭이 이 값을 보여 준다).
     t.aclMoney 는 커리어 누적으로 남긴다 — 예전 세이브·다른 화면 호환용. */
  const fin=finLedger(t);
  if(fin.acl==null) fin.acl=0;
  const room=Math.max(0, EACL_CAP_SEASON-(fin.acl||0));
  const pay=Math.min(Math.max(0, +amt||0), room);          // 시즌 상한
  if(pay<=0) return;
  t.budget=Math.round((t.budget+pay)*10)/10;
  fin.acl=Math.round(((fin.acl||0)+pay)*10)/10;
  t.aclMoney=Math.round(((t.aclMoney||0)+pay)*10)/10;
}
function eaclRow(id){ if(!G.eacl.tbl[id]) G.eacl.tbl[id]={W:0,D:0,L:0,GF:0,GA:0,Pts:0}; return G.eacl.tbl[id]; }
/* 선수의 대회 기록 그릇 — 시즌이 바뀌면 새로 판다 */
function eaclStatOf(p){
  if(!p.eacl || p.eacl.s!==G.season) p.eacl={s:G.season, apps:0, goals:0, assists:0, rate:0, rn:0};
  return p.eacl;
}
/* 시뮬로 치른 경기의 골을 선수에게 나눠 준다.
   AI끼리의 경기는 매치엔진을 돌리지 않으므로, 이걸 안 하면 대회 득점 순위가 우리 팀 선수만으로 채워진다.
   포지션과 능력치로 가중을 줘서 공격수가 많이 넣고, 도움은 골의 7할 정도에 붙는다. */
const EACL_SCORE_W={FW:10, MF:4.2, DF:1.1, GK:0.02};
const EACL_ASSIST_W={FW:5, MF:8, DF:2.4, GK:0.05};
function eaclPickBy(list, W, ace, aceK){
  let tot=0; const w=list.map(p=>{
    let v=(W[p.pos]||1)*Math.pow(0.55+Math.max(0,(p.ovr||62)-58)/22, 1.7);
    if(ace && p===ace) v*=(aceK||2.2);    // 팀의 주 득점원에게 몰린다 — 그래야 득점왕이 나온다
    tot+=v; return v; });
  if(tot<=0) return list[0]||null;
  let r=Math.random()*tot;
  for(let i=0;i<list.length;i++){ r-=w[i]; if(r<=0) return list[i]; }
  return list[list.length-1];
}
function eaclCredit(tid, goals, skipUser){
  const t=eaclTeam(tid); if(!t || !t.players) return;
  if(t.isUser && skipUser) return;            // 매치엔진으로 치른 우리 경기는 따로 정확히 집계된다
  /* 오늘 뛴 11명 — 능력순 상위에서 뽑되 매 경기 조금씩 흔든다 */
  const pool=[...t.players].filter(p=>p && (!p.inj || p.inj<=0));
  if(!pool.length) return;
  pool.sort((a,b)=>(b.ovr-a.ovr)+(Math.random()-0.5)*6);
  const xi=pool.slice(0, Math.min(11, pool.length));
  for(const p of xi) eaclStatOf(p).apps++;
  const field=xi.filter(p=>p.pos!=="GK");
  /* 팀의 주 득점원 — 시즌 내내 같은 선수에게 골이 쌓이도록 능력 기준으로 고정한다 */
  const ace=[...t.players].filter(p=>p.pos==="FW").sort((a,b)=>b.ovr-a.ovr)[0]
         || [...t.players].filter(p=>p.pos==="MF").sort((a,b)=>b.ovr-a.ovr)[0] || null;
  for(let i=0;i<goals;i++){
    const sc=eaclPickBy(field.length?field:xi, EACL_SCORE_W, ace); if(!sc) continue;
    eaclStatOf(sc).goals++;
    if(Math.random()<0.68){
      const cand=field.filter(p=>p!==sc);
      const as=eaclPickBy(cand.length?cand:field, EACL_ASSIST_W);
      if(as) eaclStatOf(as).assists++;
    }
  }
}
/* 한 경기 결과를 순위표·상금·뉴스에 기록한다 — 시뮬이든 매치엔진이든 여기를 지난다 */
function eaclRecord(m, hg, ag, byEngine){
  const me=G.userTeamId;
  m.hg=hg; m.ag=ag; m.done=1;
  try{ eaclCredit(m.h, hg, byEngine); eaclCredit(m.a, ag, byEngine); }catch(e){}
  const H=eaclRow(m.h), A=eaclRow(m.a);
  H.GF+=hg; H.GA+=ag; A.GF+=ag; A.GA+=hg;
  if(hg>ag){ H.W++; A.L++; H.Pts+=3; eaclPay(m.h, EACL_PRIZE.win); }
  else if(hg<ag){ A.W++; H.L++; A.Pts+=3; eaclPay(m.a, EACL_PRIZE.win); }
  else { H.D++; A.D++; H.Pts++; A.Pts++; eaclPay(m.h, EACL_PRIZE.draw); eaclPay(m.a, EACL_PRIZE.draw); }
  if(m.h===me||m.a===me){
    const home=m.h===me, my=home?hg:ag, op=home?ag:hg, opp=eaclTeam(home?m.a:m.h);
    const money=my>op?EACL_PRIZE.win:my===op?EACL_PRIZE.draw:0;
    addNews(`🌏 ${eaclShort()} ${m.d+1}차전: ${userTeam().short} ${my} - ${op} ${opp.short}${money?` (+${money}억)`:""}`,
      my>op?"good":my===op?"info":"bad", "club");
  }
}
/* 해당 차전에 유저가 뛸 경기가 아직 남아 있는가 — 남아 있으면 그 차전은 시뮬하지 않는다 */
function eaclUserPendingMD(d){
  const me=G.userTeamId;
  if(G.jobless || !eaclOn() || G.eacl.teams.indexOf(me)<0) return false;
  return G.eacl.fix.some(m=>m.d===d && !m.done && (m.h===me||m.a===me));
}
function eaclPlayMD(d){
  for(const m of G.eacl.fix){
    if(m.d!==d || m.done) continue;
    const [hg,ag]=eaclSim(m.h, m.a, false);
    eaclRecord(m, hg, ag);
  }
  eaclMirrorUserFix();
}
function eaclTableSorted(){
  const ids=[...G.eacl.teams];
  return ids.sort((a,b)=>{
    const X=eaclRow(a), Y=eaclRow(b);
    return (Y.Pts-X.Pts) || ((Y.GF-Y.GA)-(X.GF-X.GA)) || (Y.GF-X.GF) || (eaclPower(b)-eaclPower(a));
  });
}
/* ── 토너먼트 ─────────────────────────────────────────── */
function eaclSeedKO(){
  const top=eaclTableSorted().slice(0,8);
  G.eacl.seeded=top;
  G.eacl.ko.qf=[[top[0],top[7]],[top[3],top[4]],[top[1],top[6]],[top[2],top[5]]]
    .map(([h,a])=>({h, a, done:0, hg:0, ag:0}));
  G.eacl.stage="qf";
  try{ eaclStageOpened("qf"); }catch(e){}
  const me=G.userTeamId;
  if(top.indexOf(me)>=0){ eaclPay(me, EACL_PRIZE.qf); addNews(`🌏 <b>${eaclShort()} 8강 진출!</b> 리그 스테이지 ${top.indexOf(me)+1}위로 통과했습니다 (+${EACL_PRIZE.qf}억)`, "good", "club");
    if(!G.jobless){ try{ eaclSocialEvent("qfIn", {}); }catch(e){} try{ eaclOnQuarter(); }catch(e){} } }
  else if(G.eacl.teams.indexOf(me)>=0){ addNews(`🌏 ${eaclShort()} 리그 스테이지 탈락 — ${eaclTableSorted().indexOf(me)+1}위로 마감했습니다.`, "bad", "club");
    if(!G.jobless) try{ eaclSocialEvent("qfOut", {}); }catch(e){} }
  addNews(`🌏 ${eaclShort()} 8강 대진 확정 — ${G.eacl.ko.qf.map(t=>eaclTeam(t.h).short+" vs "+eaclTeam(t.a).short).join(" · ")}`, "info", "club");
}
const EACL_KO_NAME={qf:"8강", sf:"4강", f:"결승"};
/* 토너먼트 한 경기 기록 — 단판이라 비기면 승부차기로 승자를 낸다 */
function eaclRecordKO(t, stage, hg, ag, pk, byEngine){
  const me=G.userTeamId;
  const wasTie=(hg===ag);
  if(hg===ag){
    /* ⚠ 예전에는 여기서 동전을 던졌다 — 연장도 승부차기도 없이 점수만 1점 올렸다(제보).
       유저 경기는 매치엔진이 실제로 차고 그 결과(pk)를 들고 온다.
       AI끼리의 경기는 양 팀 페널티 능력으로 확률을 기울인 승부차기로 처리한다. */
    let hw;
    if(pk) hw=(pk>0);
    else {
      const sk=(id)=>{ try{ const tm=eaclTeam(id); const ps=(tm&&tm.players)||[];
          const top=ps.slice().sort((x,y)=>pkSkillOf(y)-pkSkillOf(x)).slice(0,5);
          return top.length? top.reduce((s,p)=>s+pkSkillOf(p),0)/top.length : 200; }catch(e){ return 200; } };
      const d=clamp((sk(t.h)-sk(t.a))/900, -0.16, 0.16);
      hw = Math.random() < 0.5+d;
    }
    if(hw) hg++; else ag++;
    t.pk=1;
  }
  if(wasTie && !G.jobless && (t.h===me||t.a===me)){
    const win=(hg>ag)===(t.h===me);
    try{ eaclSocialEvent(win?"pkWin":"pkLose", {}); }catch(e){}
  }
  t.hg=hg; t.ag=ag; t.done=1; t.w = hg>ag?t.h:t.a;
  try{ eaclCredit(t.h, hg, byEngine); eaclCredit(t.a, ag, byEngine); }catch(e){}
  eaclPay(t.w, EACL_PRIZE.win);            // 토너먼트도 이기면 승리 수당이 나온다
  if(t.h===me||t.a===me){
    const home=t.h===me, my=home?hg:ag, op=home?ag:hg;
    addNews(`🌏 ${eaclShort()} ${EACL_KO_NAME[stage]}: ${userTeam().short} ${my} - ${op} ${eaclTeam(home?t.a:t.h).short}${t.pk?" (승부차기)":""} — ${my>op?`승리! (+${EACL_PRIZE.win}억)`:"패배"}`,
      my>op?"good":"bad", "club");
  }
}
/* 그 단계가 다 끝났으면 다음 단계를 연다 */
function eaclAdvanceStage(stage){
  const me=G.userTeamId, K=G.eacl.ko;
  if(stage==="qf"){
    if(K.qf.some(t=>!t.done)) return;
    const w=K.qf.map(t=>t.w);
    K.sf=[{h:w[0],a:w[1],done:0,hg:0,ag:0},{h:w[2],a:w[3],done:0,hg:0,ag:0}];
    G.eacl.stage="sf";
    try{ eaclStageOpened("sf"); }catch(e){}
    if(w.indexOf(me)>=0){ eaclPay(me, EACL_PRIZE.sf); addNews(`🌏 <b>${eaclShort()} 4강 진출!</b> (+${EACL_PRIZE.sf}억)`, "good", "club");
      if(!G.jobless){
        try{ eaclSocialEvent("sfIn", {}); }catch(e){}
        /* 8강 줄을 4강으로 승격시킨다 — 「8강 → 우승」 사이가 비어 있으면 이력이 어색하다 */
        try{ const _ut=userTeam(); if(_ut) trophyAdd("eaclSF", `${G.season} ${eaclShort()} 4강`, _ut.name); }catch(e){}
      } }
  } else if(stage==="sf"){
    if(K.sf.some(t=>!t.done)) return;
    const w=K.sf.map(t=>t.w);
    K.f={h:w[0], a:w[1], done:0, hg:0, ag:0};
    G.eacl.stage="f";
    try{ eaclStageOpened("f"); }catch(e){}
    if(w.indexOf(me)>=0){ eaclPay(me, EACL_PRIZE.fin); addNews(`🌏 <b>${eaclShort()} 결승 진출!</b> 아시아 정상까지 한 경기 남았습니다 (+${EACL_PRIZE.fin}억)`, "good", "club");
      if(!G.jobless) try{ eaclSocialEvent("finalIn", {}); }catch(e){} }
    addNews(`🌏 ${eaclShort()} 결승 — ${eaclTeam(K.f.h).name} vs ${eaclTeam(K.f.a).name}`, "info", "club");
  } else {
    if(!K.f || !K.f.done) return;
    const ch=K.f.w; G.eacl.champ=ch; G.eacl.stage="end";
    addNews(`🏆 <b>${eaclName()} 우승 — ${eaclTeam(ch).name}!</b>`, ch===me?"good":"info", "club");
    if(ch===me){
      eaclPay(me, EACL_PRIZE.champ);
      addNews(`🏆 <b>아시아 정상!</b> ${userTeam().short}이(가) ${eaclShort()} 우승 트로피를 들어올렸습니다 (+${EACL_PRIZE.champ}억)`, "good", "club");
      try{ adjustTrust("owner",22,eaclShort()+" 우승"); adjustTrust("fans",25,eaclShort()+" 우승"); }catch(e){}
      try{ userTeam().morale=clamp(userTeam().morale+6,40,99); }catch(e){}
      if(!G.jobless){ try{ eaclSocialEvent("champ", {}); }catch(e){} try{ eaclOnChampion(); }catch(e){} }
    } else if(!G.jobless && K.f && (K.f.h===me||K.f.a===me)){
      /* 결승에서 졌다 — 준우승은 축하와 위로가 뒤섞인다 */
      addNews(`🥈 ${userTeam().short}, ${eaclShort()} 준우승 — 결승에서 ${eaclTeam(ch).short}에 무릎을 꿇었습니다.`, "info", "club");
      try{ eaclSocialEvent("runnerUp", {}); }catch(e){}
      try{ eaclOnRunnerUp(); }catch(e){}
    }
  }
}
function eaclPlayKO(stage, force){
  const me=G.userTeamId, K=G.eacl.ko;
  const ties = stage==="f" ? [K.f] : K[stage];
  for(const t of ties){
    if(!t || t.done) continue;
    /* 유저 경기는 매치엔진이 치른다 — 다만 시즌 마감처럼 더는 미룰 수 없을 때는
       수석코치가 대신 지휘한 것으로 처리한다. 대회를 미완으로 넘기지 않는다. */
    if(!force && !G.jobless && (t.h===me||t.a===me)) continue;
    const wasUser=(t.h===me||t.a===me);
    const [hg,ag]=eaclSim(t.h, t.a, stage!=="qf");
    eaclRecordKO(t, stage, hg, ag);
    if(force && wasUser && !G.jobless){
      try{
        const opp=eaclTeam(t.h===me?t.a:t.h);
        addNews(`🎩 ${eaclShort()} ${EACL_KO_NAME[stage]||stage} — 일정상 ${acTitle()}가 팀을 지휘했습니다 (vs ${opp?opp.name:"상대"})`, "warn", "club");
      }catch(e){}
    }
  }
  eaclAdvanceStage(stage);
}
/* ═══════════════════════════════════════════════════════════════
   🌏 EACL 팬 반응 — 대륙대회는 리그와 감정의 결이 완전히 다르다.
   · 일본 클럽전은 그냥 축구가 아니다. 이기면 하루가 좋고, 지면 일주일이 괴롭다.
   · 중국은 「돈으로 산 용병」이라는 시선이, 동남아는 「거기한테 지면 끝」이라는 압박이 깔린다.
   · 원정은 비행기·시차·잔디 이야기가 반드시 따라붙는다.
   · 그리고 K리그 팬은 남의 구단이 아시아에서 이겨도 결국 「우리 리그」 이야기를 한다.
   변수 — {t}우리 {o}상대 {n}상대국가 {s}점수차 {p}수훈선수 {c}대회명 {st}구장 {a}관중
   ⚠ 조사는 반드시 마커(이/가, 은/는, 을/를)를 쓸 것.
═══════════════════════════════════════════════════════════════ */
const ESOC={
 /* ── 대진 추첨 ─────────────────────────────────────── */
 pool:["대진 나왔다. 이제 진짜 실감 난다 아시아 무대","추첨 보는데 왜 내가 긴장하냐 ㅋㅋ",
   "{o} 만나네... 자료 찾아보러 간다","솔직히 상대 8팀 나쁘지 않다. 해볼 만해",
   "원정 일정부터 확인함. 비행기 값 얼마냐 이게","대진표 캡처해서 배경화면 했다",
   "우리가 아시아 대회를 나간다는 게 아직도 안 믿긴다","티켓 예매일 언제인지부터 알려줘라 구단아",
   "8경기 다 직관하고 싶은데 통장이 안 된다","추첨 생중계 보면서 손에 땀 남 진심",
   "우리 팀 유니폼 등에 {cs} 패치 붙는다 그거 하나로 설렌다",
   "리그도 벅찬데 8경기 더... 스쿼드 감당 되나 걱정부터 든다"],
 drawHard:["아니 이건 좀... 대진 운 진짜 없다","추첨 보고 한숨 나옴. 하필 저 팀들",
   "상대 8팀이 죄다 강팀이네 ㅋㅋㅋ 어차피 붙을 거 일찍 붙자","이 대진에서 8강 가면 그건 기적이다",
   "일단 한 경기라도 이기는 걸 목표로 하자","{o} 전력 찾아봤는데 눈앞이 깜깜하다",
   "어렵긴 한데 어차피 아시아 올라온 팀 중에 쉬운 팀이 어딨냐"],
 drawEasy:["이 정도면 대진 잘 뽑았다","해볼 만하다 진짜로. 8강은 가야 한다 이건",
   "이 대진에서 못 올라가면 변명 못 함","대진 보고 처음으로 기대라는 걸 해봤다",
   "8강은 기본이고 상위 시드까지 노려보자"],

 /* ── 승리 ─────────────────────────────────────────── */
 win:["아시아에서 이기는 맛이 이런 거구나","{o} 잡았다!! 오늘 잠 못 잔다",
   "{p} 오늘 진짜 미쳤다. 대륙에서도 통한다",
   "리그랑 다르게 이건 뭔가 자부심이 다르네","승점 3점이 이렇게 값질 일이냐",
   "국제 대회에서 우리 엠블럼 보는 거 아직도 적응 안 됨","{s}점 차 승리. 오늘은 그냥 행복하자",
   "해외 중계 화면에 우리 구장 나오는 거 보고 소름 돋음","이 맛에 아시아 나간다는 거구나",
   "출근길에 하이라이트 열 번 돌려봤다","우리 팀이 아시아에서 이겼다. 이 문장을 계속 읽는 중"],
 winJP:["일본 팀 잡았다!!! 오늘은 진짜 축제다","{o}전 승리. 이건 그냥 이긴 게 아니야",
   "한일전은 축구가 아니라 전쟁이라고 배웠습니다","오늘 이거 하나로 시즌 절반은 성공한 걸로 친다",
   "{p} 이름 오늘부터 외운다. 일본전 영웅","일본 원정 팬들 표정 봤냐 ㅋㅋㅋ 그게 오늘의 하이라이트",
   "우리 애들 오늘 진짜 죽기 살기로 뛰더라. 그게 보였다",
   "이겨서 좋은 게 아니라 「일본을」 이겨서 좋은 겁니다","J리그 상위권 잡았으면 우리도 할 만한 거다",
   "오늘만큼은 타팀 팬들도 다 우리 편이었을 거다","솔직히 후반에 심장 나갈 뻔했는데 버텼다"],
 winCN:["{o} 잡았다. 돈으로 산 용병들 오늘 조용하던데",
   "중국 팀은 개인 능력이 무섭긴 한데 조직력에서 우리가 이겼다",
   "몸싸움 진짜 거칠던데 애들 안 다쳐서 다행이다","{p} 오늘 용병 셋을 혼자 상대함 ㄷㄷ",
   "중국 원정 잔디 상태 보고 놀랐는데 그래도 이겼다","돈이 다가 아니라는 걸 보여준 경기"],
 winSEA:["{n} 팀 상대로는 이겨야 하는 거 맞는데, 생각보다 힘들었다",
   "더위랑 잔디가 반칙이다 진짜","동남아 원정 다녀온 선수들 진짜 고생했다",
   "이기긴 했는데 후반에 조마조마했다","{o} 홈 분위기 장난 아니던데 그걸 이겨냈다",
   "관중석 열기가 우리 리그보다 뜨겁더라 솔직히 부럽다"],
 winBig:["{s}골 차 ㅋㅋㅋㅋ 아시아에 우리 이름 좀 알렸다",
   "이건 그냥 학살이었다. 후반에는 미안할 정도","{p} 하나로 경기가 끝났다",
   "해외 축구 커뮤니티에도 우리 경기 올라왔더라","득실 차 챙겼다 이게 나중에 크다",
   "이런 경기를 리그에서도 좀 해주면 안 되겠니","오늘 우리 애들 진짜 다른 팀 같았다"],
 winAway:["원정에서 이겼다는 게 더 값지다","비행기 타고 가서 이기고 오는 팀, 그게 우리 팀입니다",
   "원정 응원 간 분들 오늘 진짜 수고하셨습니다","현지 관중 다 조용해지는 그 순간이 최고였다",
   "시차 적응도 안 됐을 텐데 어떻게 뛴 거냐","원정석에서 부르는 우리 응원가 들리더라. 울컥했다"],
 winKO:["토너먼트에서 이기는 건 차원이 다르다","한 경기에 시즌이 걸린 경기를 이겼다",
   "{p} 오늘 이 골 평생 회자될 거다","다음 라운드 간다!! 어디까지 갈 수 있는지 보자",
   "손에 땀 쥐고 봤다. 심장에 안 좋아 진짜","아직 안 끝났다. 더 갈 수 있다 우리"],
 winPk:["승부차기 ㅠㅠ 심장 떨려서 못 보고 손가락 사이로 봤다",
   "키퍼 오늘 연봉 두 배 줘야 한다","승부차기 이겨본 게 얼마 만이냐",
   "차는 선수들 표정 보는데 내가 다 긴장됨","이런 건 실력 반 운 반인데 오늘은 우리 편이었다"],

 /* ── 무승부 ─────────────────────────────────────────── */
 draw:["원정이었으면 잘한 거고 홈이었으면 아쉽고","승점 1점도 아시아에선 나쁘지 않다",
   "이겼어야 하는 경기였는데... 마무리가 아쉽다","비긴 건 비긴 거지. 다음 경기 준비하자",
   "8강 경쟁 생각하면 이 승점 1이 애매하다","골 결정력 문제는 리그나 대회나 똑같네"],
 drawAway:["원정에서 승점 1이면 챙긴 거다","비행기 값 생각하면 아쉽지만 안 진 게 어디냐",
   "원정 무승부는 나쁘지 않다고 배웠습니다","홈에서 갚아주면 된다"],

 /* ── 패배 ─────────────────────────────────────────── */
 lose:["아시아 무대가 만만한 게 아니구나","{o}한테 졌다... 실력 차이 인정할 건 인정하자",
   "리그에서 하던 축구가 여기선 안 통하네","기술적으로 우리가 부족했다 솔직히",
   "이래서 아시아 대회 성적이 중요한 거다","분하지만 배운 것도 있는 경기였다",
   "체력 관리 실패다 이건. 후반에 다 걸어 다니더라","한 경기 졌다고 끝난 거 아니다 아직 남았다"],
 loseJP:["하필 일본한테... 오늘 잠 못 잔다 진짜","{o}전 패배는 그냥 패배가 아니라고요",
   "J리그랑 격차 인정하기 싫은데 오늘 경기는 인정할 수밖에",
   "일본 팀 패스 도는 거 보고 할 말을 잃음","이건 감독 탓하기도 뭐하다 그냥 클래스 차이였다",
   "내일 회사에서 축구 얘기 안 할 거다","한일전 지면 왜 이렇게까지 화가 나는지 나도 모르겠다",
   "우리가 언제까지 J리그 뒤에서 이래야 하냐","져도 이렇게 지면 안 됐다. 최소한 싸우기라도 했어야지",
   "일본 애들 유스 시스템 부럽다는 말이 오늘 이해됐다"],
 loseCN:["중국한테 지는 건 자존심 문제인데...","용병 세 명한테 다 털렸다 ㅋㅋ 돈이 이기네",
   "몸싸움에서 밀리는 게 제일 답답했다","중국 원정 잔디 핑계 대고 싶은데 그러기엔 실력 차가 났다",
   "이 정도 돈 쓰는 리그를 우리가 무슨 수로 이기냐 싶다가도, 그래도 졌으면 안 됐다"],
 loseSEA:["{n}한테 졌다고?? 이건 진짜 변명 안 된다",
   "동남아 팀한테 지는 건 좀... 자존심 상한다 솔직히",
   "더위 핑계 대지 마라 저쪽도 90분 뛴 거다","이건 K리그 전체가 욕먹는 거다 우리 때문에",
   "{o} 축하한다. 우리가 못한 거다","기사 댓글 못 보겠다 진짜","오늘 경기는 그냥 없던 걸로 하고 싶다",
   "아시아 축구 상향 평준화라는 말, 오늘 몸으로 배웠다"],
 loseBig:["{s}골 차 ㅋㅋㅋㅋ 이건 그냥 수업료다",
   "이 경기 다시 안 볼 거다 진짜","선수들 표정이 다 죽어 있더라. 그게 제일 아프다",
   "이럴 거면 왜 나갔냐는 말까지 나온다","리그 순위 지키는 게 더 급해 보인다 지금은",
   "국제 대회에서 이렇게 무너지는 거 오랜만에 본다","오늘은 그냥 아무 말도 하기 싫다"],
 loseAway:["원정 가서 이러고 오면 마음이 더 아프다","비행기 값이 아깝다는 말은 안 하려고 했는데",
   "원정 응원 가신 분들께 죄송할 정도의 경기였다","시차고 잔디고 그건 저쪽도 마찬가지였다",
   "원정에서 지는 건 그렇다 쳐도 내용이 없었다"],
 losePk:["승부차기 ㅠㅠ 이건 누구 탓도 못 하겠다","차 준 선수 욕하지 마라 진짜. 나가서 찰 용기라도 있었냐",
   "여기까지 온 것만 해도 대단한 거다","한 발 차이로 갈렸다. 축구가 그렇지 뭐",
   "선수들 주저앉는 거 보고 나도 같이 무너졌다"],

 /* ── 대회 단계 ─────────────────────────────────────────── */
 qfIn:["8강 진출!!! 우리가 아시아 8강이다","리그 스테이지 통과. 이제부터 진짜 시작이다",
   "상금도 상금인데 그냥 자랑스럽다","구단 역사에 남는 시즌 만들자 진짜로",
   "8강 대진 언제 나오냐 벌써 궁금하다","여기까지 온 이상 욕심 좀 내도 되지 않나",
   "리그도 챙기면서 여기까지 왔다는 게 대단한 거다","우리 선수들 이제 아시아에서도 이름 팔린다"],
 qfOut:["여기까지네... 그래도 잘 싸웠다","탈락은 아쉽지만 얻은 게 많은 대회였다",
   "이제 리그에 집중하자. 그게 더 중요하다","다음에 또 나가면 된다. 그러려면 리그 순위부터",
   "선수들 고생 많았다 진심으로","경험치 쌓았다고 생각하자 우리 애들 어리잖아",
   "솔직히 나가기 전엔 8강도 기대 안 했다. 그래도 아쉬운 건 아쉬운 거"],
 sfIn:["4강이라니 이게 무슨 일이야 진짜","아시아 4강. 우리 구단 역사상 이런 적 있었나",
   "이제 두 경기 남았다. 상상만 해도 미치겠다","결승 티켓값 미리 모으는 중",
   "여기까지 왔으면 우승도 노려보자","선수들이 대회를 즐기는 게 화면으로도 보인다"],
 finalIn:["결승이다!!!! 결승!!!!","우리 팀이 아시아 결승에 간다. 이 문장을 백 번은 읽은 것 같다",
   "회사에 연차 냈습니다. 이유는 안 물어보셨으면","가족들한테 다 알렸다 ㅋㅋㅋ 축구 안 보는 사람들한테까지",
   "여기까지 온 이상 들고 오자 진짜","우승하면 나 진짜 울 것 같은데 어쩌지"],
 champ:["우승!!!!! 아시아 챔피언!!!!!","우리가 아시아 챔피언이다. 이게 현실이라니",
   "십 년 넘게 응원한 보람이 오늘 하루에 다 들어왔다","아버지랑 통화하면서 둘 다 울었다",
   "이 감독 동상 세워라 진짜","선수들 하나하나 이름 부르면서 고맙다고 하고 싶다",
   "구단 역사에 오늘 날짜가 박혔다","우승 엠블럼 박힌 유니폼 나오면 무조건 산다",
   "내년에 아시아 챔피언 자격으로 나간다는 거지? 미쳤다","오늘은 아무것도 안 하고 하이라이트만 볼 거다",
   "타팀 팬들도 오늘은 축하해 주더라. 그것도 고맙다"],
 runnerUp:["준우승... 한 발 모자랐다","분하지만 여기까지 온 것도 대단한 거다",
   "선수들 우는 거 보고 나도 울었다","다음엔 꼭 들고 오자. 진짜로",
   "결승 무대에 섰다는 것만으로도 잊지 못할 시즌","오늘은 위로하지 말고 그냥 같이 아파하자",
   "은메달도 아무나 못 따는 거다. 고개 들자 우리 애들"],

 /* ── 대회 병행 ─────────────────────────────────────────── */
 fatigue:["리그랑 병행하니까 애들 다리가 안 돌아간다","로테이션 좀 돌려주세요 감독님 제발",
   "주중 원정 갔다가 주말 리그면 사람이 아니지","이래서 아시아 대회가 독이 든 성배라는 거구나",
   "부상자 나올까 봐 그게 제일 무섭다","스쿼드 얇은 게 여기서 티가 난다",
   "우승도 좋지만 리그 강등되면 다 소용없다"],
 travel:["원정 이동만 왕복 열 시간이라는데 이게 맞냐","시차 적응 이틀 만에 경기라니",
   "잔디 상태 사진 봤는데 저게 축구장이 맞나","원정 숙소 근처에 밤새 공사한다더라 ㅋㅋ 클래식하네",
   "이런 거 다 이겨내고 이겨야 진짜 강팀인 거지","원정 응원 가신 분들 안전하게 다녀오세요"]
};
const EFMK={
 draw:[["{cs} 대진 추첨 나왔네 K리그 팀들 상대 어떰",0],["{t} 대진 저거 할 만한데?",1],
   ["아시아 대회는 원정이 반이다 진짜",0],["K리그 3팀 다 8강 가는 거 볼 수 있을까",1],
   ["일본 팀들이랑 붙는 거 벌써 재밌겠다",1],["솔직히 J리그 상위권이 제일 무섭지",0],
   ["동남아 팀 요즘 무시하면 큰코다침",0],["중국 팀 용병 명단 봤는데 ㄷㄷ 돈 많이 썼네",0]],
 win:[["{t} {cs}에서 {o} 잡았다는데 ㄷㄷ",1],["K리그 체면 살렸네",1],
   ["아시아 대회는 K리그 팀이 잘해야 리그 위상이 올라감",1],["{p} 이 선수 물건이네",1],
   ["솔직히 이 경기 안 봤는데 하이라이트 보고 놀람",1],["승점 3점 챙긴 게 크다 나중에 보면",0]],
 winJP:[["{t}이/가 일본 팀 잡았다!!",1],["한일전은 이겨야 제맛이지 ㅋㅋㅋ",1],
   ["J리그 팬들 지금 조용한 거 보면 웃김",1],["오늘만큼은 {t} 응원했다 인정",1],
   ["K리그가 J리그한테 이기는 거 오랜만에 봄",1],["이런 경기 하나가 리그 자존심임",1],
   ["솔직히 전력 차 있었는데 이겼네 대단하다",1]],
 lose:[["{t} {cs}에서 졌네 아쉽다",-1],["아시아 대회 만만치 않지",0],
   ["리그 병행이 진짜 힘든 거임",0],["K리그 팀들 국제 대회 성적 좀 챙겨야 하는데",-1],
   ["체력 관리 실패로 보임",-1],["한 경기 진 거 갖고 뭐라 하지 마라 8경기다",0]],
 loseJP:[["{t} 일본 팀한테 졌네... 이건 좀 아프다",-1],["J리그랑 격차 진짜 벌어진 거 맞음?",-1],
   ["일본은 유스 시스템부터 다르다 인정할 건 인정하자",-1],["한일전 지면 리그 전체가 우울해짐",-1],
   ["{t} 팬들 오늘 아무 말도 못 하겠지",-1],["돈 문제가 아니라 시스템 문제임 이건",-1],
   ["그래도 90분 싸우기라도 했으면 덜 억울했을 텐데",-1]],
 loseSEA:[["{t}이/가 {n} 팀한테 졌다고????",-1],["이건 진짜 사고임 ㅋㅋㅋㅋ",-1],
   ["동남아 무시하다 큰코다치는 거 요즘 자주 봄",-1],["K리그 위상 어디까지 떨어지는 거냐",-1],
   ["더위 핑계는 그만. 저쪽도 90분 뛰었다",-1],["태국 리그 요즘 투자 많이 한다더라 진짜로",0],
   ["{t}만 욕할 일은 아니고 리그 전체가 반성해야 함",-1]],
 bigWin:[["{t} {s}골 차 대승 ㄷㄷ 아시아에서 이 정도면",1],["오늘 경기 하이라이트 꼭 봐라 진짜",1],
   ["득실 차 챙긴 게 8강 경쟁에서 클 듯",1],["{p} 혼자 다 했다더라",1],
   ["K리그 팀이 아시아에서 이렇게 이기는 거 오랜만",1]],
 bigLose:[["{t} {s}골 차로 깨졌네...",-1],["이건 좀 심했다 ㅋㅋ",-1],
   ["국제 대회에서 이러면 리그 전체가 욕먹음",-1],["스쿼드 깊이 문제임 확실히",-1],
   ["로테이션 돌리다 이렇게 된 거면 그것도 감독 판단",0]],
 qfIn:[["{t} {cs} 8강 진출 ㅊㅊ",1],["K리그 팀 8강 오랜만에 보네",1],
   ["여기서부터는 진짜 실력임",1],["상금이 꽤 될 텐데 구단 재정에 도움 되겠다",1],
   ["리그도 챙기면서 8강이면 잘한 거지",1]],
 qfOut:[["{t} {cs} 탈락. 아쉽네",-1],["리그 스테이지 통과가 쉬운 게 아님",0],
   ["그래도 경험은 남았을 듯",0],["이제 리그에 집중하면 됨",0],
   ["K리그 팀들 아시아 성적 좀 신경 써야 함 진짜",-1]],
 champ:[["{t} {cs} 우승!!!! K리그 만세",1],["아시아 챔피언 K리그에서 나왔다 ㄷㄷ",1],
   ["솔직히 소름 돋았다 오늘 경기",1],["{t} 팬들 오늘 하루는 마음껏 자랑해도 됨",1],
   ["리그 위상 올라가는 소리가 들린다",1],["다음 시즌 클럽월드컵 나가는 거임?",1],
   ["우리 팀 아니어도 오늘은 같이 기쁘다",1]],
 runnerUp:[["{t} 준우승. 아쉽지만 잘 싸웠다",0],["결승까지 간 것만 해도 대단함",1],
   ["한 끗 차이였는데 아쉽다",0],["K리그 팀이 아시아 결승 간 게 얼마 만이냐",1]],
 koWin:[["{t} 토너먼트에서 살아남았네 ㄷㄷ",1],["단판 승부에서 이기는 게 진짜 실력임",1],
   ["K리그 팀이 여기까지 온 게 얼마 만이냐",1],["{p} 이 선수 오늘 경기 하나로 몸값 올랐다",1],
   ["다음 상대 누구냐 벌써 궁금함",1],["중립 경기장에서 이기는 건 또 다른 얘기임",1]],
 koLose:[["{t} 여기서 끝났네. 아쉽다",-1],["단판은 진짜 한 끗 차이임",0],
   ["여기까지 온 것만 해도 잘한 거지",0],["토너먼트에서 K리그 팀 벽이 늘 여기더라",-1],
   ["다음 시즌에 또 나가면 됨",0]],
 tie:[["{t} 비겼네. 아시아에서 승점 1도 나쁘진 않음",0],["원정이었으면 잘한 거임",0],
   ["8강 경쟁 생각하면 애매한 승점",0],["결정력만 있었으면 이겼을 경기",-1],
   ["K리그 팀들 국제 대회에서 유독 마무리가 안 되더라",-1],["비긴 게 어디냐 저 팀 상대로는",1]]
};
const ERIV={
 draw:[["{t} {cs} 나가네 부럽다 진짜",0],["우리도 언젠가 저 무대 나가보자",0],
   ["아시아 대회 원정 가는 거 낭만 있음",1],["대진 보니까 {t} 고생 좀 하겠는데 ㅋㅋ",0],
   ["부럽긴 한데 리그 병행하다 순위 떨어지는 거 여러 번 봄",0]],
 win:[["{t} 이겼네. 오늘은 인정한다",1],["아시아에서는 같은 K리그니까 응원했다",1],
   ["분하지만 잘하긴 하더라",0],["국제 대회는 어느 팀이든 이겨야지",1],
   ["{t} 팬들 오늘 시끄럽겠네 ㅋㅋ",0]],
 winJP:[["오늘만큼은 {t} 응원했다 진심으로",1],["일본 팀 잡았으면 그걸로 된 거임",1],
   ["한일전 앞에서는 우리도 {t} 팬이다",1],["평소엔 싫어해도 이런 날은 같이 기뻐해야지",1],
   ["{t} 고맙다 진짜. 속이 다 시원하다",1]],
 lose:[["{t} 졌네 ㅋㅋ 아시아는 만만한 게 아니지",-1],["역시 리그 병행은 무리였음",0],
   ["고소하긴 한데 K리그 위상 생각하면 마냥 좋진 않다",0],["우리가 나갔으면 더 잘했을 텐데",0],
   ["{t} 팬들 오늘 조용하겠네",0]],
 loseSEA:[["{t}이/가 동남아 팀한테 졌다고 ㅋㅋㅋㅋㅋ",-1],["이건 진짜 웃을 수가 없다 K리그 망신임",-1],
   ["고소하다기보다 창피하다 솔직히",-1],["우리 리그가 이 정도였나 싶어서 씁쓸함",-1],
   ["{t} 욕할 처지도 아닌 게 우리도 나가면 저럴 듯",0]],
 qfIn:[["{t} 8강 갔네. 부럽다",0],["K리그 팀이 올라가는 건 좋은 일이지",1],
   ["상금 받아서 또 좋은 선수 사겠네 ㅋㅋ",-1],["저 팀만 계속 나가는 거 보면 격차 느껴진다",-1]],
 qfOut:[["{t} 떨어졌네 ㅋㅋ",0],["아쉽긴 하다 K리그 팀이었는데",0],
   ["이제 리그에서 만나자",0],["대회 나가서 체력만 빼고 온 거 아님?",-1]],
 champ:[["{t} 우승 축하한다 진심으로",1],["오늘은 그냥 K리그 팬으로서 기쁘다",1],
   ["분하다 부럽다 그리고 자랑스럽다 다 섞였다",1],["아시아 챔피언이 우리 리그에서 나왔다는 게 중요함",1],
   ["다음엔 우리가 저기 서자",1],["{t} 팬들 자랑해도 됨. 오늘은 봐준다",1]],
 runnerUp:[["{t} 준우승도 잘한 거다",1],["결승까지 갔으면 충분함",1],
   ["한 끗 차이였는데 아쉽겠다",0]]
};
/* 상대 국가에 따라 결이 갈린다 — 일본은 한일전, 동남아는 자존심 */
function eaclNatKind(nat){
  if(nat==="일본") return "JP";
  if(nat==="중국") return "CN";
  if(nat==="태국"||nat==="말레이시아") return "SEA";
  return "";
}
/* 🌏 EACL 팬 반응 — 경기 결과에 따라 우리 팬·커뮤니티·타구단 팬이 함께 떠든다 */
function eaclSocialResult(M, opp, my, op, stage){
  const t=userTeam(); if(!t) return;
  const nat=(opp&&opp.nat)||"한국", kind=eaclNatKind(nat);
  const away=!M.home.isUser, diff=Math.abs(my-op);
  const sd=M.home.isUser?M.h:M.a;
  const best=[...sd.list].sort((a,b)=>(b.goals*2+b.assists)-(a.goals*2+a.assists))[0];
  const v={t:t.short, o:opp?opp.short:"상대", n:nat, s:diff,
    p:best?best.p.name:"우리 선수", c:eaclName(), cs:eaclShort(),
    st:stadOf(t).n, a:(M.att||0).toLocaleString()};
  const ko = stage && stage!=="md";
  try{
    if(my>op){
      socialFill(ESOC.win, 2+R(2), 1, v);
      if(kind==="JP"){ socialFill(ESOC.winJP, 2+R(3), 1, v); fmkFill(EFMK.winJP, 2+R(3), v);
                       rivalFill(ERIV.winJP, 2+R(2), 1, v); }
      else if(kind==="CN") socialFill(ESOC.winCN, 1+R(2), 1, v);
      else if(kind==="SEA") socialFill(ESOC.winSEA, 1+R(2), 1, v);
      if(diff>=3){ socialFill(ESOC.winBig, 2+R(2), 1, v); fmkFill(EFMK.bigWin, 2+R(2), v); }
      else if(!ko) fmkFill(EFMK.win, 1+R(2), v);
      else fmkFill(EFMK.koWin, 1+R(2), v);
      if(away) socialFill(ESOC.winAway, 1+R(2), 1, v);
      if(ko && stage!=="f") socialFill(ESOC.winKO, 2+R(2), 1, v);   // 결승은 우승 반응이 따로 나온다
      rivalFill(ERIV.win, 1+R(2), 1, v);
    } else if(my===op){
      socialFill(ESOC.draw, 2+R(2), 0, v);
      if(away) socialFill(ESOC.drawAway, 1+R(2), 0, v);
      fmkFill(EFMK.tie, 1+R(2), v);
      if(kind==="SEA" && Math.random()<0.5) socialFill(ESOC.loseSEA, 1, -1, v);   // 동남아 상대 무승부도 자존심이 상한다
    } else {
      socialFill(ESOC.lose, 2+R(2), -1, v);
      if(kind==="JP"){ socialFill(ESOC.loseJP, 2+R(3), -1, v); fmkFill(EFMK.loseJP, 2+R(3), v); }
      else if(kind==="CN") socialFill(ESOC.loseCN, 1+R(2), -1, v);
      else if(kind==="SEA"){ socialFill(ESOC.loseSEA, 2+R(2), -1, v); fmkFill(EFMK.loseSEA, 2+R(2), v);
                             rivalFill(ERIV.loseSEA, 1+R(2), -1, v); }
      if(diff>=3){ socialFill(ESOC.loseBig, 2+R(2), -1, v); fmkFill(EFMK.bigLose, 2+R(2), v); }
      else if(!ko) fmkFill(EFMK.lose, 1+R(2), v);
      else fmkFill(EFMK.koLose, 1+R(2), v);
      if(away) socialFill(ESOC.loseAway, 1+R(2), -1, v);
      rivalFill(ERIV.lose, 1+R(2), -1, v);
    }
    /* 대회를 치를수록 쌓이는 이야기 — 리그 병행 부담과 원정 고생 */
    if(away && Math.random()<0.45) socialFill(ESOC.travel, 1+R(2), 0, v);
    if(Math.random()<0.30) socialFill(ESOC.fatigue, 1+R(2), 0, v);
  }catch(e){}
}
/* 대진 추첨 · 단계 통과 · 우승처럼 「한 번뿐인 순간」의 반응 */
function eaclSocialEvent(kind, extra){
  const t=userTeam(); if(!t) return;
  const v=Object.assign({t:t.short, c:eaclName(), cs:eaclShort()}, extra||{});
  try{
    if(kind==="draw"){
      socialFill(ESOC.pool, 2+R(3), 0, v);
      if(extra && extra.hard) socialFill(ESOC.drawHard, 2+R(2), -1, v);
      else if(extra && extra.easy) socialFill(ESOC.drawEasy, 1+R(2), 1, v);
      fmkFill(EFMK.draw, 2+R(3), v); rivalFill(ERIV.draw, 1+R(2), 0, v);
    }
    else if(kind==="qfIn"){ socialFill(ESOC.qfIn, 3+R(3), 1, v); fmkFill(EFMK.qfIn, 2+R(3), v); rivalFill(ERIV.qfIn, 2+R(2), 0, v); }
    else if(kind==="qfOut"){ socialFill(ESOC.qfOut, 2+R(3), -1, v); fmkFill(EFMK.qfOut, 2+R(2), v); rivalFill(ERIV.qfOut, 1+R(2), 0, v); }
    else if(kind==="sfIn"){ socialFill(ESOC.sfIn, 3+R(3), 1, v); }
    else if(kind==="finalIn"){ socialFill(ESOC.finalIn, 3+R(3), 1, v); }
    else if(kind==="champ"){ socialFill(ESOC.champ, 4+R(4), 1, v); fmkFill(EFMK.champ, 3+R(4), v); rivalFill(ERIV.champ, 2+R(3), 1, v); }
    else if(kind==="runnerUp"){ socialFill(ESOC.runnerUp, 3+R(3), 0, v); fmkFill(EFMK.runnerUp, 2+R(2), v); rivalFill(ERIV.runnerUp, 1+R(2), 0, v); }
    else if(kind==="pkWin") socialFill(ESOC.winPk, 2+R(2), 1, v);
    else if(kind==="pkLose") socialFill(ESOC.losePk, 2+R(2), -1, v);
  }catch(e){}
}
/* ═══════════════════════════════════════════════════════════════
   🏆 EACL 우승·성적의 후속 처리
   트로피 하나가 구단에 남기는 것은 은잔 하나가 아니다 —
   관중이 늘고, 선수가 오고 싶어 하고, 스폰서가 붙고, 감독의 이름값이 달라진다.
═══════════════════════════════════════════════════════════════ */
/* 대회 개인 기록 — 매치엔진으로 치른 우리 경기에서만 쌓인다(AI끼리는 시뮬이라 기록이 없다) */
/* ═══════════════════════════════════════════════════════════════
   🟨 징계는 대회별로 따로 관리한다 (제보 — 리그와 EACL 의 경고·출전정지가 공유되고 있었다)
   리그 퇴장으로 대회 경기를 못 뛰거나, 대회에서 받은 카드로 리그 경기를 쉬는 일은 없다.
   ─ p.ban  : 리그 출전정지 (기존)
     p.banE : 대회 출전정지 (신규)
   화면·라인업·avail() 이 전부 p.ban 하나만 보므로, 대회 경기 동안에만 두 값을 맞바꾼다.
   이 방식이면 스무 곳 넘는 참조 지점을 건드리지 않아도 규정이 정확히 갈린다. */
/* 대회 경기 직전 안전망 — 갈아끼운 뒤에도 남아 있는 이상값을 정리한다 */
function banSweepEacl(t){
  if(!t || !t.players) return;
  for(const p of t.players){
    if(p.ban>8) p.ban=8;
    if(!(p.ban>0)) delete p.banNew;
  }
}
/* 🟨 CWC 전용 징계 장부 — 리그 경고도, EACL 경고도 세계 대회에 따라오지 않는다.
   대회는 1월, EACL 조별은 3월부터라 같은 시즌 안에서 겹친다. 슬롯을 따로 둔다(banC). */
function cwcBanPush(t){
  if(!t || !t.players) return;
  for(const p of t.players){
    delete p._banAct;                    // 🟥 이제 p.ban 자리가 곧 대회 장부다 (제보)
    if(p._banLC!=null) continue;
    p._banLC=p.ban||0; p._banNewLC=p.banNew?1:0;
    p.ban=p.banC||0; if(p.banCNew) p.banNew=1; else delete p.banNew;
  }
}
function cwcBanPop(t){
  if(!t || !t.players) return;
  for(const p of t.players){
    if(p._banLC==null) continue;
    p.banC=p.ban||0; if(p.banNew) p.banCNew=1; else delete p.banCNew;
    p.ban=p._banLC||0; if(p._banNewLC) p.banNew=1; else delete p.banNew;
    delete p._banLC; delete p._banNewLC; delete p._banAct;
    if(!p.banC) delete p.banC;
    if(!p.banCNew) delete p.banCNew;
  }
  try{ banCtxSync(); }catch(e){}          // 🟥 다음 경기 대회 기준으로 다시 잡는다 (제보)
}
function cwcBanTick(t){
  if(!t || !t.players) return;
  for(const p of t.players){
    if(p.banCNew){ delete p.banCNew; continue; }
    if(p.banC>0){
      p.banC--;
      if(!p.banC){ delete p.banC; if(t.isUser) addNews(`✅ ${p.name} 선수의 ${cwcShort()} 출전정지가 끝났습니다.`, null, "club"); }
    }
  }
}
function eaclBanPush(t){
  if(!t || !t.players) return;
  for(const p of t.players){
    delete p._banAct;                    // 🟥 이제 p.ban 자리가 곧 대회 장부다 (제보)
    if(p._banL!=null) continue;          // 이미 올려 둔 상태
    p._banL=p.ban||0; p._banNewL=p.banNew?1:0;
    p.ban=p.banE||0; if(p.banENew) p.banNew=1; else delete p.banNew;
  }
}
function eaclBanPop(t){
  if(!t || !t.players) return;
  for(const p of t.players){
    if(p._banL==null) continue;
    p.banE=p.ban||0; if(p.banNew) p.banENew=1; else delete p.banENew;
    p.ban=p._banL||0; if(p._banNewL) p.banNew=1; else delete p.banNew;
    delete p._banL; delete p._banNewL; delete p._banAct;
    if(!p.banE) delete p.banE;
    if(!p.banENew) delete p.banENew;
  }
  try{ banCtxSync(); }catch(e){}          // 🟥 다음 경기 대회 기준으로 다시 잡는다 (제보)
}
/* ═══ 🟥 징계 자가 복구 ═══════════════════════════════════════════════════
   ⚠ 제보 — 「퇴장당한 선수가 출장정지(몇 경기)가 아니라 계속 '대기' 상태로 남아 경기에 못 나온다」.
   원인은 대회용 갈아끼우기(eaclBanPush/Pop)의 짝이 어긋나는 경우였다.
   대회 경기를 시작할 때 리그 징계를 _banL 에 올려 두고 대회 징계를 ban 자리에 끼우는데,
   그 경기가 몰수·대행·중단 같은 경로로 끝나면 Pop 이 불려 오지 않는다. 그러면
     · 리그 징계가 _banL 안에 갇혀 영영 줄지 않고
     · ban 자리에는 대회 징계가 남아 리그 경기를 계속 막는다
   ─ 대회 경기 중이 아닌데 _banL 이 남아 있으면 그 자리에서 되돌린다.
     겸사겸사 「ban 은 0인데 banNew 만 남은」 잔재와 비정상적으로 큰 값도 정리한다. */
function banSweep(){
  if(!G || !G.teams) return 0;
  /* 지금 대회 경기를 치르는 중이면 건드리지 않는다 — 그때는 갈아끼운 상태가 정상이다 */
  try{ if(G.pendingEACL || G.pendingCWC || (typeof liveM!=="undefined" && liveM && liveM.opts && liveM.opts.eacl)) return 0; }catch(e){}
  let n=0;
  /* 🩹 기존 세이브 구제 — 아직 이번 시즌 EACL 경기를 한 번도 안 치렀는데 banE 가 남아 있으면
     그건 CWC 퇴장이 잘못 적힌 「유령 정지」다(대회 징계는 시즌 전환에서 지워지므로 이월분도 아니다).
     ⚠ 제보 — 「리그 정지 선수가 EACL 1차전에도 정지였다」의 세이브 쪽 치료. */
  try{
    const uid=G.userTeamId;
    if(G.eacl && Array.isArray(G.eacl.fix) && !G.eacl.fix.some(m=>m.done && (m.h===uid||m.a===uid))
       && ["qf","sf","f"].indexOf(G.eacl.stage)<0){
      const ut=userTeam();
      if(ut) for(const p of ut.players){
        if(p.banE>0 || p.banENew){ delete p.banE; delete p.banENew; n++; }
      }
    }
  }catch(e){}
  const fix=(p)=>{
    if(!p) return;
    if(p._banL!=null){
      /* 대회용으로 끼워 둔 값을 대회 쪽으로 돌려보내고, 리그 징계를 제자리에 놓는다 */
      const eacl=p.ban||0, eaclNew=p.banNew?1:0;
      if(eacl>0){ p.banE=Math.max(p.banE||0, eacl); if(eaclNew) p.banENew=1; }
      p.ban=p._banL||0;
      if(p._banNewL) p.banNew=1; else delete p.banNew;
      delete p._banL; delete p._banNewL;
      n++;
    }
    if(p._banLC!=null){          // 🌍 CWC 쪽 갈아끼우기가 짝을 못 찾은 경우
      const c=p.ban||0, cNew=p.banNew?1:0;
      if(c>0){ p.banC=Math.max(p.banC||0, c); if(cNew) p.banCNew=1; }
      p.ban=p._banLC||0;
      if(p._banNewLC) p.banNew=1; else delete p.banNew;
      delete p._banLC; delete p._banNewLC;
      n++;
    }
    if(!(p.ban>0) && p.banNew){ delete p.banNew; n++; }
    if(!(p.banE>0) && p.banENew){ delete p.banENew; n++; }
    if(!(p.banC>0) && p.banCNew){ delete p.banCNew; n++; }
    if(p.banC>8){ p.banC=8; n++; }
    if(p.ban>8){ p.ban=8; n++; }
    if(p.banE>8){ p.banE=8; n++; }
    if(!p.ban) delete p.ban;
    if(!p.banE) delete p.banE;
  };
  for(const id in G.teams) for(const p of (G.teams[id].players||[])) fix(p);
  for(const p of (G.freeAgents||[])) fix(p);
  return n;
}
/* 대회 경기를 한 판 치렀다 — 대회 출전정지만 한 경기씩 흘러간다 */
/* 대회 출전정지는 「대회 경기」를 치를 때만 깎인다 — 리그 라운드로는 소진되지 않는다 */
function eaclBanTick(t){
  if(!t || !t.players) return;
  for(const p of t.players){
    if(p.banENew){ delete p.banENew; continue; }
    if(p.banE>0){
      p.banE--;
      if(!p.banE){ delete p.banE; if(t.isUser) addNews(`✅ ${p.name} 선수의 ${eaclShort()} 출전정지가 끝났습니다.`, null, "club"); }
    }
  }
}
function eaclStatCollect(M, stage){
  try{
    const sd=M.home.isUser?M.h:M.a; if(!sd) return;
    for(const x of sd.list){
      const p=x.p; if(!p) continue;
      const mins=(x.off===null?M.min:x.off)-x.on;
      if(mins<=0) continue;                       // 실제로 뛴 선수만 — 벤치는 출장에 넣지 않는다
      if(!p.eacl || p.eacl.s!==G.season) p.eacl={s:G.season, apps:0, goals:0, assists:0, rate:0, rn:0};
      p.eacl.apps++; p.eacl.goals+=(x.goals||0); p.eacl.assists+=(x.assists||0);
      if(x.rating){ p.eacl.rate+=x.rating; p.eacl.rn++; }
    }
  }catch(e){}
}
function eaclTopScorers(n){
  const t=userTeam(); if(!t) return [];
  return t.players.filter(p=>p.eacl && p.eacl.s===G.season && p.eacl.apps>0)
    .sort((a,b)=>(b.eacl.goals*2+b.eacl.assists)-(a.eacl.goals*2+a.eacl.assists) || (b.eacl.goals-a.eacl.goals))
    .slice(0, n||3);
}
/* 🌏 대회 전체 개인 기록 — 12개 참가 클럽을 모두 훑는다 */
function eaclAllStats(){
  const out=[];
  if(!eaclOn()) return out;
  for(const id of G.eacl.teams){
    const t=eaclTeam(id); if(!t || !t.players) continue;
    for(const p of t.players){
      if(!p.eacl || p.eacl.s!==G.season) continue;
      if(!(p.eacl.goals||p.eacl.assists)) continue;
      out.push({p, t, s:p.eacl});
    }
  }
  return out;
}
function eaclRankCard(kind, n){
  const all=eaclAllStats();
  if(!all.length) return "";
  const goal = kind!=="assist";
  all.sort((a,b)=> goal
    ? (b.s.goals-a.s.goals) || (b.s.assists-a.s.assists) || (a.s.apps-b.s.apps)
    : (b.s.assists-a.s.assists) || (b.s.goals-a.s.goals) || (a.s.apps-b.s.apps));
  const top=all.filter(x=> goal ? x.s.goals>0 : x.s.assists>0).slice(0, n||12);
  if(!top.length) return "";
  const me=G.userTeamId;
  return `<div class="card"><h3>${goal?"⚽":"🅰️"} ${eaclName()} ${goal?"득점":"도움"} 순위</h3>
    <div class="tblScroll"><table>
      <tr><th>#</th><th style="text-align:left">선수</th><th style="text-align:left">클럽</th><th>경기</th><th>${goal?"골":"도움"}</th><th>${goal?"도움":"골"}</th></tr>
      ${top.map((x,i)=>{
        const mine=x.t.id===me;
        const uid=(x.t.id&&String(x.t.id).indexOf("eacl_")===0)?x.t.id:x.t.id;
        return `<tr style="${mine?"background:rgba(80,160,255,.10);font-weight:700":""}">
          <td>${i+1}</td>
          <td style="text-align:left" class="clickable" onclick="showPlayerInfoPopup(event,${x.p.id})">${x.p.name}<span class="small pos-${x.p.pos}" style="margin-left:4px">${x.p.pos}</span></td>
          <td style="text-align:left">${eaclNm(uid)}</td>
          <td>${x.s.apps}</td>
          <td><b>${goal?x.s.goals:x.s.assists}</b></td>
          <td class="small">${goal?x.s.assists:x.s.goals}</td></tr>`;
      }).join("")}
    </table></div></div>`;
}
/* 구단별 역대 EACL 성적 — 「아시아 명문」이라는 말은 이 표에서 나온다 */
function eaclHonorAdd(tid, kind){
  if(!G.eaclHonors) G.eaclHonors={};
  const h=G.eaclHonors[tid] || (G.eaclHonors[tid]={champ:0, runner:0, qf:0, apps:0, seasons:[]});
  if(kind==="champ") h.champ++;
  else if(kind==="runner") h.runner++;
  else if(kind==="qf") h.qf++;
  else if(kind==="apps") h.apps++;
  if(kind==="champ") h.seasons.push(G.season);
  return h;
}
function eaclHonorOf(tid){ return (G.eaclHonors&&G.eaclHonors[tid]) || {champ:0, runner:0, qf:0, apps:0, seasons:[]}; }
/* ═══ 🏅 트로피 캐비닛 ══════════════════════════════════════════════════
   ⚠ 제보 — 「같은 대회 우승 경력이 있는데 8강도 같이 등록돼 있다」.
     8강은 「진출한 그 순간」에 등록된다. 그 뒤에 우승해도 8강 줄이 그대로 남아
     캐비닛에 「2026 EACL 우승」과 「2026 EACL 8강」이 나란히 놓였다.
   ─ 같은 대회·같은 시즌에는 가장 좋은 성적 하나만 남긴다. 8강에서 떨어졌다면 8강이,
     우승했다면 우승만 남는다. 다른 시즌의 8강 기록은 그대로 보존된다. */
/* ═══ 📜 감독 경력 장부 ═══════════════════════════════════════════════════
   ⚠ 요청 원문 — 「감독 오피스 메뉴에서 감독의 경력을 볼 수 있는 탭을 만들자.
      팀 경력, 리그 성적, 대회 성적 시즌별로 다 나오는거지」.

   확인해 보니 게임에 시즌별 성적이 남는 장부 자체가 없었다 —
     · G.trophies 는 우승·승격·강등·대회 단계만 (순위·승무패가 없다)
     · G.finalTbl 은 시즌을 넘길 때 버려진다
     · 어느 팀에 언제 부임했는지도 라운드 하나(G.hiredAtR)뿐이다
   그래서 장부를 먼저 만든다.
     · rows   — 시즌 한 줄. 순위표가 지워지기 전(startNewSeason)에 찍는다.
     · spells — 구단별 재임 구간. 부임·사임·경질·계약만료 시점에 여닫는다.
   시즌 도중에 팀이 바뀌면 그 시즌은 두 줄이 된다(퇴임 시점에 한 줄, 시즌 끝에 한 줄). */
function mgrCv(){
  if(!G.mgrCv) G.mgrCv={rows:[], spells:[], seed:0};
  if(!Array.isArray(G.mgrCv.rows))   G.mgrCv.rows=[];
  if(!Array.isArray(G.mgrCv.spells)) G.mgrCv.spells=[];
  return G.mgrCv;
}
/* 그 시즌 우리 팀 최다 득점자 — 시즌이 초기화되기 전에 걷는다 */
function cvTopScorer(t){
  try{
    let b=null;
    for(const p of (t.players||[])) if((p.goals||0)>0 && (!b || p.goals>b.goals)) b=p;
    return b ? {n:b.name, g:b.goals|0} : null;
  }catch(e){ return null; }
}
/* 그 시즌의 대회 최고 성적 — 트로피 표에서 읽는다 */
function cvCompOf(season, group){
  try{
    let best=null, rk=-1;
    for(const x of (G.trophies||[])){
      if(x.s!==season || trophyGroup(x.kind)!==group) continue;
      const r=TROPHY_RANK[x.kind]||0;
      if(r>rk){ rk=r; best=x; }
    }
    return best ? CV_STAGE[best.kind]||best.kind : null;
  }catch(e){ return null; }
}
const CV_STAGE={champ:"우승", champ2:"우승", promo:"승격", po:"승강 PO", releg:"강등",
  eacl:"우승", eaclRunner:"준우승", eaclSF:"4강", eaclQF:"8강",
  cwc:"우승", cwcRunner:"준우승", cwcSF:"4강", cwcQF:"8강"};
/* 시즌 한 줄을 찍는다 — 순위표·기록이 살아 있는 동안에만 부를 수 있다.
   why: "season"(시즌 종료) | "leave"(중도 퇴임) */
function cvPushRow(why){
  try{
    const C=mgrCv(), t=userTeam();
    const sN=G.season;
    if(!t || G.jobless){                       // 무직으로 한 시즌을 통째로 보냈다
      if(why!=="season") return;
      if(C.rows.some(r=>r.s===sN)) return;
      C.rows.push({s:sN, tid:null, sh:"무직", nm:"무직", div:0, note:"무직"});
      return;
    }
    /* 같은 시즌·같은 팀 줄이 이미 있으면 덮어쓴다 — 두 번 찍히지 않게 */
    const old=C.rows.findIndex(r=>r.s===sN && r.tid===t.id);
    let pos=0, N=0;
    try{ const tb=tableOf(t.div); N=tb.length; pos=tb.findIndex(x=>x.id===t.id)+1; }catch(e){}
    const notes=[];
    if(why==="leave") notes.push((G.sack&&G.sack.kind==="sack")?"시즌 중 경질"
                               :(G.sack&&G.sack.kind==="quit")?"시즌 중 사임":"시즌 중 퇴임");
    if((G.hiredAtR||0)>0 && why==="season") notes.push("시즌 중 부임");
    const lg=cvCompOf(sN, t.div===1?"champ":"champ2");
    if(lg==="우승") notes.push(t.div===1?"리그 우승":"K리그2 우승");
    if(cvCompOf(sN,"promo")) notes.push("승격");
    if(cvCompOf(sN,"releg")) notes.push("강등");
    const row={s:sN, tid:t.id, sh:t.short, nm:t.name, div:t.div,
      pos, N, W:t.W|0, D:t.Dw|0, L:t.L|0, GF:t.GF|0, GA:t.GA|0, Pts:t.Pts|0,
      po:cvCompOf(sN,"po"), eacl:cvCompOf(sN,"eacl"), cwc:cvCompOf(sN,"cwc"),
      top:cvTopScorer(t), note:notes.join(" · ")||"", part:(why==="leave")?1:0};
    if(old>=0) C.rows[old]=Object.assign(C.rows[old], row); else C.rows.push(row);
    C.rows.sort((a,b)=>a.s-b.s || (a.part?0:1)-(b.part?0:1));
  }catch(e){}
}
/* 재임 구간을 연다 — 부임(새 게임 · 이직) */
function cvOpenSpell(tid){
  try{
    const C=mgrCv(), t=G.teams[tid]; if(!t) return;
    const cur=C.spells[C.spells.length-1];
    if(cur && !cur.done && cur.tid===tid) return;      // 이미 열려 있다
    C.spells.push({tid, sh:t.short, nm:t.name, s0:G.season, r0:(t.div===1?G.r1:G.r2)|0,
                   done:0, W:0, D:0, L:0, seasons:0});
  }catch(e){}
}
/* 재임 구간을 닫는다 — 사임 · 경질 · 계약 만료 */
function cvCloseSpell(how){
  try{
    const C=mgrCv(), cur=C.spells[C.spells.length-1];
    if(!cur || cur.done) return;
    const t=G.teams[cur.tid];
    cur.done=1; cur.s1=G.season; cur.r1=(t?((t.div===1?G.r1:G.r2)|0):0);
    cur.how=how||"leave";
    /* 그 구단에서의 통산 전적 — 시즌 줄을 합쳐서 낸다(중도 퇴임 줄 포함) */
    let W=0,D=0,L=0,GF=0,GA=0,ss=new Set();
    for(const r of C.rows) if(r.tid===cur.tid && r.s>=cur.s0 && r.s<=cur.s1){
      W+=r.W|0; D+=r.D|0; L+=r.L|0; GF+=r.GF|0; GA+=r.GA|0; ss.add(r.s); }
    cur.W=W; cur.D=D; cur.L=L; cur.GF=GF; cur.GA=GA; cur.seasons=ss.size;
  }catch(e){}
}
/* 🌱 구세이브 씨뿌리기 — 장부가 없던 시절의 지난 시즌을 트로피 표에서 되살린다.
   ⚠ 순위·승무패는 어디에도 남아 있지 않다. 그 칸은 「기록 없음」으로 비워 둔다.
      과거가 통째로 비는 것보다는 낫다(선택). */
function cvSeed(){
  try{
    const C=mgrCv();
    if(C.seed) return;
    C.seed=1;
    const t=userTeam();
    const bySeason={};
    for(const x of (G.trophies||[])){
      if(x.s==null || x.s>=G.season) continue;
      (bySeason[x.s]=bySeason[x.s]||[]).push(x);
    }
    for(const k of Object.keys(bySeason).sort((a,b)=>a-b)){
      const sN=+k;
      if(C.rows.some(r=>r.s===sN)) continue;
      const notes=[];
      for(const x of bySeason[k]){
        const g=trophyGroup(x.kind);
        if(g==="champ"||g==="champ2"||g==="promo"||g==="releg") notes.push(x.label||CV_STAGE[x.kind]||"");
      }
      const nm=(bySeason[k][0]||{}).team||"";
      C.rows.push({s:sN, tid:null, sh:nm.split(" ")[0]||nm, nm, div:0, seed:1,
        po:cvCompOf(sN,"po"), eacl:cvCompOf(sN,"eacl"), cwc:cvCompOf(sN,"cwc"),
        note:notes.filter(Boolean).join(" · ")});
    }
    C.rows.sort((a,b)=>a.s-b.s);
    /* 재임 구간이 하나도 없으면 지금 팀으로 하나 연다 — 부임 시즌은 알 수 없으니 첫 기록부터 */
    if(!C.spells.length && t && !G.jobless){
      const first=C.rows.length?C.rows[0].s:G.season;
      C.spells.push({tid:t.id, sh:t.short, nm:t.name, s0:first, r0:0, done:0,
                     W:0,D:0,L:0,seasons:0, est:1});
    }
  }catch(e){}
}
const TROPHY_RANK={champ:100, champ2:90, promo:50, po:30, releg:0,
                   eacl:100, eaclRunner:60, eaclSF:40, eaclQF:20,
                   cwc:120, cwcRunner:70, cwcSF:45, cwcQF:25};   // 🌍 세계 대회가 가장 위다
function trophyGroup(kind){
  if(kind==="cwc"||kind==="cwcRunner"||kind==="cwcSF"||kind==="cwcQF") return "cwc";
  return (kind==="eacl"||kind==="eaclRunner"||kind==="eaclSF"||kind==="eaclQF") ? "eacl" : kind;
}
function trophyAdd(kind, label, teamName, season){
  if(!G.trophies) G.trophies=[];
  const s=season!=null?season:G.season;
  const gp=trophyGroup(kind), rk=TROPHY_RANK[kind]||0;
  const same=G.trophies.filter(x=>x.s===s && trophyGroup(x.kind)===gp);
  if(same.some(x=>(TROPHY_RANK[x.kind]||0)>=rk)) return null;    // 이미 더 좋은 성적이 있다
  if(same.length) G.trophies=G.trophies.filter(x=>!(x.s===s && trophyGroup(x.kind)===gp));
  const o={s, kind, label, team:teamName};
  G.trophies.push(o);
  return o;
}
/* 구세이브 정리 — 이미 나란히 쌓여 있는 기록에서 낮은 성적을 걷어낸다 */
function trophySweep(){
  try{
    if(!Array.isArray(G.trophies)) return 0;
    const best={}, keep=[];
    for(const x of G.trophies){
      const k=x.s+"|"+trophyGroup(x.kind)+"|"+(x.team||"");
      const r=TROPHY_RANK[x.kind]||0;
      if(best[k]==null || r>best[k].r) best[k]={r, x};
    }
    const win=new Set(Object.values(best).map(v=>v.x));
    for(const x of G.trophies) if(win.has(x)) keep.push(x);
    const n=G.trophies.length-keep.length;
    if(n>0) G.trophies=keep;
    return n;
  }catch(e){ return 0; }
}
/* 🏆 우승 — 구단이 통째로 달라지는 순간 */
function eaclOnChampion(){
  const t=userTeam(); if(!t) return;
  if(!G.trophies) G.trophies=[];
  const h=eaclHonorAdd(t.id, "champ");
  trophyAdd("eacl", `${G.season} ${eaclShort()} 우승`, t.name);
  /* ① 팬이 늘고 선수단이 들뜬다 — 리그 우승보다 큰 폭 */
  t.fans=Math.round(clamp(t.fans*1.22, 4, 140)*10)/10;
  for(const p of t.players) p.morale=clamp(p.morale+10, 30, 99);
  t.morale=clamp((t.morale||70)+10, 40, 99);
  /* ② 흥행 지수 — 다음 시즌 관중이 오래 간다 */
  try{ t.hype=clamp(hypeOf(t)+0.22, 0.70, 1.60); }catch(e){}
  /* ③ 스폰서 — 아시아 챔피언 배지는 계약서의 숫자를 바꾼다 */
  const spon=Math.round((28+R(20))*10)/10;
  t.budget=Math.round((t.budget+spon)*10)/10;
  try{ const fin=finLedger(t); fin.prize=Math.round((fin.prize+spon)*100)/100; }catch(e){}
  addNews(`🤝 아시아 챔피언 <b>우승 인센티브</b> — 스폰서들이 계약서에 걸어 둔 보너스를 지급했습니다 (+${spon}억)<br><span class="small">다음 시즌 계약 갱신 때는 매력도가 오른 만큼 금액 자체가 달라집니다.</span>`, "good", "club");
  /* ④ 감독 몸값 — 사비와 위신 (아시아를 제패한 감독에게는 다른 제안이 온다) */
  try{ mePay(6+R(6), eaclShort()+" 우승 보너스"); }catch(e){}
  G.eaclRepBonus=(G.eaclRepBonus||0)+8;
  /* ⑤ 이적 시장에서 우리 이름이 달라진다 (한 시즌 유지) */
  G.eaclPull={s:G.season+1, v:0.12};
  /* ⑥ 대회 최우수 선수 — 우리 팀 기준 */
  const best=eaclTopScorers(3);
  if(best.length){
    const b=best[0];
    addNews(`🥇 <b>${b.name}</b>, ${eaclName()} 우리 팀 최다 공격포인트 — ${b.eacl.apps}경기 ${b.eacl.goals}골 ${b.eacl.assists}도움`, "good", "club");
    try{ b.morale=clamp(b.morale+6,30,99); }catch(e){}
  }
  addNews(`🏆 <b>${t.name}, 아시아 정복!</b> 구단 통산 ${h.champ}번째 ${eaclShort()} 우승 — 관중·스폰서·선수 영입 모든 것이 달라집니다.`, "good", "club");
  try{
    pushFeed({cat:"club", ic:"🏆", tone:1, tid:t.id, src:"아시아축구연맹",
      head:`${t.name}, ${eaclName()} 우승`,
      sub:`아시아 정상에 선 ${t.short}. 통산 ${h.champ}회 우승으로 대륙의 명문 반열에 올랐다.`});
  }catch(e){}
}
/* 🥈 준우승 · 8강 — 우승만 이야기가 되는 건 아니다 */
function eaclOnRunnerUp(){
  const t=userTeam(); if(!t) return;
  if(!G.trophies) G.trophies=[];
  eaclHonorAdd(t.id, "runner");
  trophyAdd("eaclRunner", `${G.season} ${eaclShort()} 준우승`, t.name);
  t.fans=Math.round(clamp(t.fans*1.10, 4, 140)*10)/10;
  for(const p of t.players) p.morale=clamp(p.morale+3, 30, 99);
  try{ t.hype=clamp(hypeOf(t)+0.10, 0.70, 1.60); }catch(e){}
  const spon=Math.round((10+R(8))*10)/10;
  t.budget=Math.round((t.budget+spon)*10)/10;
  G.eaclRepBonus=(G.eaclRepBonus||0)+3;
  addNews(`🥈 ${t.short} ${eaclShort()} 준우승 — 스폰서 인센티브 +${spon}억. 아시아 무대에서 이름값을 얻었습니다.`, "info", "club");
}
function eaclOnQuarter(){
  const t=userTeam(); if(!t) return;
  if(!G.trophies) G.trophies=[];
  eaclHonorAdd(t.id, "qf");
  trophyAdd("eaclQF", `${G.season} ${eaclShort()} 8강`, t.name);
  try{ t.hype=clamp(hypeOf(t)+0.05, 0.70, 1.60); }catch(e){}
  G.eaclRepBonus=(G.eaclRepBonus||0)+1;
}
/* 감독 이력서에 남는 아시아 성적 — mgrRep 에 더해진다 */
function eaclRepBonus(){ return clamp(G.eaclRepBonus||0, 0, 25); }
/* 영입 협상에서 「아시아 챔피언」이 갖는 무게 */
function eaclPullBonus(){
  const P=G.eaclPull;
  if(!P || G.season>P.s) return 0;
  return P.v||0;
}
/* 🌏 EACL 경기 기사 — 리그 기사(matchNews)는 순위·라운드를 참조하므로 따로 쓴다 */
function matchNewsEacl(M, tag){
  const t=userTeam(); if(!t) return;
  const home=M.home.isUser, my=home?M.hg:M.ag, op=home?M.ag:M.hg;
  const opp=home?M.away:M.home;
  const kind = my>op?"승리":my===op?"무승부":"패배";
  addNews(`📰 <b>${tag}</b> — ${M.home.short} ${M.hg} : ${M.ag} ${M.away.short} (관중 ${(M.att||0).toLocaleString()}명)`,
    my>op?"good":my===op?"info":"bad", "club");
  try{
    const mm=M.mom;
    if(mm){
      addNews(`🏅 <b>${mm.name}</b> (${mm.team}) — ${tag} MOM · 평점 ${mm.rating.toFixed(2)}`
        +`${mm.goals?` · ${mm.goals}골`:""}${mm.assists?` · ${mm.assists}도움`:""}`, mm.isUser?"good":"info", "club");
      if(mm.isUser) socialFill(MOM_SOC.our, 1+R(2), 1, {p:mm.name, t:mm.team, r:mm.rating.toFixed(2)});
    }
  }catch(e){}
  try{ eaclSocialResult(M, opp, my, op, (M.opts&&M.opts.eaclStage)||"md"); }catch(e){}
  try{ eaclStatCollect(M, (M.opts&&M.opts.eaclStage)||"md"); }catch(e){}
  /* 🟨 이 경기에서 받은 카드는 대회 장부에 남기고, 리그 징계는 원래대로 돌려놓는다 */
  try{ const _ut=userTeam(); eaclBanPop(_ut); eaclBanTick(_ut); }catch(e){}
}
/* 라운드가 지날 때마다 불린다 — 밀린 단계가 있으면 순서대로 소화한다 */
/* ⚠ 제보 — 「8강에 올라갔는데 다음 시즌에 다시 조별리그부터 시작한다」.
   원인은 두 가지가 겹쳐 있었다.
     ① 유저 경기가 하루라도 밀리면 eaclUserPendingMD 가 그 차수를 통째로 막아,
        대회 전체가 조별에서 멈춘 채 시즌이 끝났다.
     ② 시즌 종료 때 부르는 eaclTick(true) 는 한 번에 「한 단계」만 넘겼다.
        조별을 마치면 8강 대진만 짜고 끝나서, 8강·4강·결승이 치러지지 않았다.
   ─ force 일 때는 끝(end)까지 돌리고, 밀린 유저 경기는 기한이 지나면 수석코치가 대신 치른다.
     대회는 반드시 그 시즌 안에 우승자를 낸다. */
const EACL_GRACE=10;          // 유저 경기가 이 날수를 넘기면 위임 처리한다
function eaclTick(force){
  if(!eaclOn()) return null;
  const day=G.day||0;
  let guard=0;
  do{
    for(let d=0; d<8; d++){
      if(G.eacl.fix.every(m=>m.d!==d || m.done)) continue;
      /* 우리 경기가 남았으면 매치엔진이 먼저 치른다 — 다만 기한을 한참 넘겼으면 위임한다 */
      if(!force && eaclUserPendingMD(d)) continue;   // 내 경기가 남았으면 그 차수는 기다린다
      if(force || day>=eaclMdDay(d)) eaclPlayMD(d);
    }
    const allDone=G.eacl.fix.every(m=>m.done);
    if(allDone && G.eacl.stage==="draw") eaclSeedKO();
    for(const st of ["qf","sf","f"]){
      if(G.eacl.stage!==st) continue;
      /* ⚠ 제보 — 「패치 후에도 4강·결승을 직접 지휘 못 하고 끝났다」.
         여기 유예(EACL_GRACE)가 남아 있었다. 예정일에서 열흘이 지나면 유저 경기까지
         「일정상 수석코치 대행」으로 밀어 버린다 — 리그가 끝난 뒤로 잡힌 4강·결승은
         달력이 그 열흘을 순식간에 지나가므로 감독이 손쓸 새가 없었다.
         ─ 내가 치를 대회 경기는 기다린다. 강제 진행(force)은 시즌 정산 때만 들어온다. */
      if(!force && eaclUserPendingKO && eaclUserPendingKO(st)) break;
      if(force || day>=eaclKoDue(st)) eaclPlayKO(st, force);
    }
  } while(force && G.eacl.stage!=="end" && guard++<10);
  return null;
}
/* 이 단계에 우리 경기가 아직 남아 있는가 */
function eaclUserPendingKO(st){
  try{
    if(!eaclOn() || G.jobless) return false;
    const me=G.userTeamId;
    const K=G.eacl.ko||{};
    const ties = st==="f" ? [K.f] : (K[st]||[]);
    return (ties||[]).some(x=>x && !x.done && (x.h===me || x.a===me));
  }catch(e){ return false; }
}
/* 🏆 아직 내가 치러야 할 대회 경기가 남아 있는가 — 리그가 끝나도 시즌을 닫으면 안 되는 이유.
   ⚠ 제보 — 승강 PO 가 끝나는 순간 endSeason() 이 불려, 남아 있던 4강·결승을
      시즌 정산의 eaclTick(true) 가 「수석코치 대행」으로 몰아서 치러 버렸다. */
/* 🏆 승강 플레이오프에 내가 끼어 있는가 — 남은 대진 중 우리 경기가 있는지 (제보) */
function poUserIn(){
  try{
    if(G.jobless || !G.userTeamId) return false;
    const me=G.userTeamId;
    return (G.poQueue||[]).some(m=>{
      try{ return resolvePOid(m.h)===me || resolvePOid(m.a)===me; }catch(e){ return false; }
    });
  }catch(e){ return false; }
}
function eaclUserLeft(){
  try{
    if(!eaclOn() || G.jobless) return false;
    const me=G.userTeamId;
    if(!G.eacl || (G.eacl.teams||[]).indexOf(me)<0) return false;
    if((G.eacl.fix||[]).some(m=>!m.done && (m.h===me||m.a===me))) return true;
    const K=G.eacl.ko||{};
    for(const st of ["qf","sf","f"]){
      const ties = st==="f" ? [K.f] : (K[st]||[]);
      if((ties||[]).some(x=>x && !x.done && (x.h===me||x.a===me))) return true;
    }
  }catch(e){}
  return false;
}
/* 그중 가장 늦은 경기일 — 달력을 여기까지는 흘려보내야 한다 */
function eaclUserLastDay(){
  let d=-1;
  try{
    const me=G.userTeamId, K=G.eacl.ko||{};
    for(const m of (G.eacl.fix||[])) if(!m.done && (m.h===me||m.a===me)) d=Math.max(d, eaclMdDay(m.d));
    for(const st of ["qf","sf","f"]){
      const ties = st==="f" ? [K.f] : (K[st]||[]);
      if((ties||[]).some(x=>x && !x.done && (x.h===me||x.a===me))) d=Math.max(d, eaclKoDay(st));
    }
  }catch(e){}
  return d;
}
function playACLIfDue(){ try{ return eaclTick(false); }catch(e){ return null; } }
/* ── 🎮 유저 경기는 매치엔진으로 ─────────────────────────────
   리그 라운드가 EACL 경기일에 도달하면, 리그 경기보다 먼저 이 경기를 치른다.
   (실제로도 주중 아시아 원정을 다녀와 주말 리그를 뛴다) */
/* ⚠ 제보 — 「8강 이후로 경기 구현이 안 된다. 리그가 끝나고 나니 아챔 우승이라 뜨고
      4강·결승은 결과 페이지에서만 확인된다.」
   원인은 이 한 줄이었다 — `G.phase!=="league"` 이면 즉시 null.
   대회 4강·결승은 시즌 막바지에 잡히는데, 리그 최종전이 끝나는 순간 phase 가 "po" 로 바뀐다.
   그때부터 유저 경기가 영영 due 가 되지 않고, 시즌 정산의 eaclTick(true) 가 전부 대신 치러 버렸다.
   리그가 끝나도 대회는 남아 있다 — 프리시즌이 아니면 언제든 유저가 직접 치른다. */
function eaclUserDue(){
  if(G.jobless || !eaclOn()) return null;
  const me=G.userTeamId; if(G.eacl.teams.indexOf(me)<0) return null;
  if(G.phase==="pre" || G.phase==="seasonEnd") return null;
  const day=G.day||0;
  for(let d=0; d<8; d++){
    if(day < eaclMdDay(d)) break;
    const m=G.eacl.fix.find(x=>x.d===d && !x.done && (x.h===me||x.a===me));
    if(m) return {kind:"md", d, m, tag:`${eaclShort()} 리그 스테이지 ${d+1}차전`};
  }
  const K=G.eacl.ko, S=G.eacl.stage;
  for(const st of ["qf","sf","f"]){
    if(S!==st || day<eaclKoDue(st)) continue;
    const ties = st==="f" ? [K.f] : (K[st]||[]);
    const t=ties.find(x=>x && !x.done && (x.h===me||x.a===me));
    if(t) return {kind:st, t, tag:`${eaclShort()} ${EACL_KO_NAME[st]}`};
  }
  return null;
}
/* 유저가 치른 EACL 경기 결과를 반영하고, 같은 단계의 나머지 경기를 마저 돌린다 */
function eaclResolveUser(P, hg, ag, pk){
  if(!eaclOn()) return;
  if(P.kind==="md"){
    eaclRecord(P.m, hg, ag, true);
    eaclPlayMD(P.d);                                   // 같은 차전의 나머지 5경기
    eaclMirrorUserFix();
    if(G.eacl.fix.every(m=>m.done) && G.eacl.stage==="draw") eaclSeedKO();
  } else {
    eaclRecordKO(P.t, P.kind, hg, ag, pk||0, true);
    eaclPlayKO(P.kind);                                // 같은 라운드의 나머지 + 다음 단계 개방
  }
}
/* EACL 홈경기 입장 수입 — 리그처럼 completeRound를 타지 않으므로 여기서 따로 넣는다 */
function eaclGate(M){
  try{
    const t=userTeam(); if(!M.home.isUser) return;
    const inc=Math.round(((M.att||0)*(TICKET_UNIT+MD_UNIT) + facMatchIncome(t, M.att||0))*10)/10;   // 🏪 시설 수입 포함
    if(inc>0){
      const fin=finLedger(t);
      fin.gate=Math.round(((fin.gate||0)+inc)*100)/100;
      t.budget=Math.round((t.budget+inc*BUD_SHARE)*10)/10;
    }
  }catch(e){}
}
