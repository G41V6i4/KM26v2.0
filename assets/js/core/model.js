"use strict";
/* =====================================================
   유틸 & 모델
===================================================== */
const R = (n)=>Math.floor(Math.random()*n);
const pick = (a)=>a[R(a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* ⚡ 두 값짜리 빗변 — Math.hypot 은 오버플로 방어 때문에 sqrt 보다 <b>10배</b> 느리다(실측 148ms vs 14.5ms/500만회).
   경기장 좌표는 -2~2 범위라 오버플로가 날 수 없고, 500만 표본에서 값이 <b>완전히 같았다</b>.
   매치엔진 전역에서 두 값 호출(309군데)을 이걸로 바꿨다. */
function HYP(x,y){ return Math.sqrt(x*x+y*y); }
const fmt=(n)=>n.toLocaleString('ko-KR');
/* 📐 포메이션 목록 정렬 (요청) — 2백 → 3백 → 4백 → 5백 → 7백, 같은 백 수 안에서는 이름순 */
function formListSorted(){
  return Object.keys(FORMATIONS).sort((a,b)=>
    (FORMATIONS[a][0]-FORMATIONS[b][0]) || a.localeCompare(b));
}
const FORMATIONS = {"4-3-3":[4,3,3],"4-4-2":[4,4,2],"4-2-3-1":[4,5,1],"3-5-2":[3,5,2],"5-3-2":[5,3,2],"3-4-3":[3,4,3],
  "4-1-4-1":[4,5,1],"4-2-2-2":[4,4,2],"3-4-2-1":[3,4,3],"4-4-1-1":[4,4,2],"5-2-1-2":[5,3,2],"4-3-1-2":[4,4,2],
  /* ⚠ 요청 — 「4-1-2-3(수비형 미드필더 하나 · 중앙 미드필더 둘 · 윙 둘 · 스트라이커 하나)이
     없어서, 선수를 수미 자리로 보내고 저장하면 자꾸 4-3-3 으로 돌아간다」.
     4-3-3 과 인원 배분은 같지만(수비 4 · 중원 3 · 공격 3) 중원 세 명의 높이가 다르다 —
     한 명을 수비형으로 내리고 둘을 나란히 세운다. 포메이션 목록에 정식으로 넣는다. */
  "4-1-2-3":[4,3,3],
  /* 🔥 극단 전술 — 벤치가 승부수를 던질 때만 나온다. 평상시 편성에는 쓰지 않는다. */
  "2-3-5":[2,3,5],   // 총공세 — 센터백 둘만 남기고 전부 앞으로
  "7-2-1":[7,2,1]};  // 걸어잠금 — 수비 라인을 통째로 깔고 수미 둘, 최전방 하나
/* 극단 포메이션은 어울리는 상황에서만 꺼낸다 (편성 화면·AI 기본 선택에서 제외) */
const EXTREME_FORM={"2-3-5":"atk", "7-2-1":"def"};
/* 세분화된 라인 배치 — 필드 플레이어 10명을 어느 라인·슬롯에 세울지 그대로 적는다.
   computeRenderSlots 가 이 슬롯을 그대로 존중하므로 화면과 엔진이 같은 모양을 쓴다. */
const FORMATION_SHAPE={
  "4-3-3":   [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["FW","LW"],["FW","ST"],["FW","RW"]],
  "4-4-2":   [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["FW","LS"],["FW","RS"]],
  "4-2-3-1": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["DM","LDM"],["DM","RDM"],["AM","LAM"],["AM","CAM"],["AM","RAM"],["FW","ST"]],
  "4-1-4-1": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["DM","DM"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["FW","ST"]],
  /* 🆕 4-1-2-3 — 수미 하나를 뒤에 두고 중앙 미드필더 둘, 앞은 윙 둘 + 스트라이커 (요청) */
  "4-1-2-3": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["DM","DM"],["MF","LCM"],["MF","RCM"],["FW","LW"],["FW","ST"],["FW","RW"]],
  "4-2-2-2": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["DM","LDM"],["DM","RDM"],["AM","LAM"],["AM","RAM"],["FW","LS"],["FW","RS"]],
  "4-3-1-2": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["AM","CAM"],["FW","LS"],["FW","RS"]],
  "4-4-1-1": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["AM","CAM"],["FW","ST"]],
  "3-5-2":   [["DF","LCB"],["DF","CB"],["DF","RCB"],["WB","LWB"],["WB","RWB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["FW","LS"],["FW","RS"]],
  "5-3-2":   [["DF","LB"],["DF","LCB"],["DF","CB"],["DF","RCB"],["DF","RB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["FW","LS"],["FW","RS"]],
  "5-2-1-2": [["DF","LB"],["DF","LCB"],["DF","CB"],["DF","RCB"],["DF","RB"],["DM","LDM"],["DM","RDM"],["AM","CAM"],["FW","LS"],["FW","RS"]],
  "3-4-3":   [["DF","LCB"],["DF","CB"],["DF","RCB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["FW","LW"],["FW","ST"],["FW","RW"]],
  "3-4-2-1": [["DF","LCB"],["DF","CB"],["DF","RCB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["AM","LAM"],["AM","RAM"],["FW","ST"]],
  /* 🔥 2-3-5 — 옛날 피라미드. 센터백 둘만 뒤에 남기고 다섯을 최전방에 세운다.
     지고 있는 종반, 벤치가 마지막 승부수를 던질 때의 그림이다. */
  "2-3-5":   [["DF","LCB"],["DF","RCB"],["MF","LCM"],["MF","CM"],["MF","RCM"],
              ["FW","LW"],["FW","LS"],["FW","ST"],["FW","RS"],["FW","RW"]],
  /* 🔥 7-2-1 — 버스를 세운다. 수비 라인을 통째로 깔고 수미 둘, 최전방 하나.
     한 골 지키려는 종반이나 압도적 상대를 만난 언더독의 그림이다. */
  "7-2-1":   [["DF","LB"],["DF","LCB"],["DF","CB"],["DF","RCB"],["DF","RB"],["WB","LWB"],["WB","RWB"],
              ["DM","LDM"],["DM","RDM"],["FW","ST"]]
};
/* 포메이션을 팀에 적용한다 — 선발 11명을 뽑고, 각자 어울리는 라인·슬롯에 앉힌다. */
function applyFormation(t, fname){
  const shape=FORMATION_SHAPE[fname]; if(!shape) return;
  t.tactic.formation=fname; t.tactic.zone={}; t.tactic.slot={};
  const xi=bestXI(t, fname);
  const gk=xi.find(p=>p.pos==="GK");
  const rest=xi.filter(p=>p!==gk);
  // 라인의 성격(수비/중원/공격)과 선수의 타고난 포지션을 맞춰서 배정한다
  const bandPos={DF:"DF", WB:"DF", DM:"MF", MF:"MF", AM:"MF", FW:"FW"};
  const pool=rest.slice();
  const used=new Set();
  for(const [band, slot] of shape){
    const want=bandPos[band];
    // 같은 계열 선수 우선, 없으면 아무나. 좌/우 슬롯은 그쪽 선호 포지션을 조금 우대한다.
    let best=null, bs=-1e9;
    for(const q of pool){
      if(used.has(q.id)) continue;
      let sc=(q.pos===want?40:0) + (q.ovr||60)*0.5;
      if(q.prefPos===slot) sc+=25;
      if(slot[0]==="L" && (q.prefPos||"").indexOf("L")===0) sc+=10;
      if(slot[0]==="R" && (q.prefPos||"").indexOf("R")===0) sc+=10;
      if(sc>bs){ bs=sc; best=q; }
    }
    if(best){ used.add(best.id); setZone(t,best.id,band); setSlot(t,best.id,slot); }
  }
  G.userXI = (t.isUser) ? xi.map(p=>p.id) : G.userXI;
  return xi;
}
let PID=1;
/* ═══════════════════════════════════════════════════════════════
   🆔 고유번호(UID) — FM의 UID와 같은 개념.
   p.id 는 세이브마다 1부터 새로 매기는 「런타임 번호」라, 새 게임을 시작하면 같은 선수가
   다른 번호를 받는다. 그래서 이름 파일·DB 파일이 이름 문자열로 선수를 찾을 수밖에 없었고,
   개명하거나 팀을 옮기면 매칭이 깨졌다(제보 — "3~4건을 건너뜁니다").
   ─ UID 는 원본 데이터(이름+생년월일)에서 결정론적으로 만든다. 어떤 세이브에서든 같은 값이라
     개명·이적·소속 이동과 무관하게 그 선수를 정확히 가리킨다.
     · 구단 1001~   · 감독 2001~   · 실존 선수 10000~   · 생성 선수 900000~
   ═══════════════════════════════════════════════════════════════ */
const UID_CLUB=1001, UID_COACH=2001, UID_REAL=10000, UID_GEN=900000;
const UID_COMP=3001, UID_REF=4001, UID_STAD=5001;   // 대회 3001~ · 심판 4001~ · 구장 5001~
const UID_CWC=7001;   // 🌍 CWC 클럽 7001~ · 구장 7501~ · 모기업 7601~
/* 🎩 코치진 스태프 8001~ — 구단에 묶인 상대 감독(2001~)과 달리 사람 단위로 붙는다.
   시장에 나와 있는 무직 스태프도 번호를 갖는다: 우리 팀에 왔다 나갔다 해도 같은 사람이다. */
const UID_STAFF=8001;
const UID_OWNER=7001;                               // 모기업·운영 주체 7001~
function uidStadOf(tid){ return uidClubOf(tid)-UID_CLUB+UID_STAD; }    // 구단과 1:1로 짝을 맞춘다
/* 🏢 모기업 — 구단과 1:1로 짝을 맞춘다. 에디터에서 이름을 바꿔도 번호는 그대로다.
   EACL 클럽이면 그쪽 대역(6301~)을 쓴다. */
function uidOwnerOf(tid){
  if(typeof tid==="string" && tid.indexOf("eacl_")===0) return uidEaclOwnerOf(tid.slice(5));
  return uidClubOf(tid)-UID_CLUB+UID_OWNER;
}
/* 🏆 대회 — 이름은 스폰서가 붙는 자리라 시즌마다 바뀐다. 에디터에서 고칠 수 있게 데이터로 둔다. */
const COMP_DEF={
  k1:   {n:"개리그1 펨코은행 {Y}", s:"개리그1"},
  k2:   {n:"개리그2 펨코은행 {Y}", s:"개리그2"},
  po:   {n:"펨코은행 개리그 승강 플레이오프 {Y}", s:"승강 PO"},
  eacl: {n:"EACL {Y}", s:"EACL"},         // 🌏 동아시아 클럽 대항전
  cwc:  {n:"세계클럽대항전 {Y}", s:"CWC"}   // 🌍 클럽 월드컵 — EACL 우승팀이 다음 해 1월에 나간다
};
function compKeys(){ return ["k1","k2","po","eacl","cwc"]; }
/* 🌏 대회명 — 에디터에서 바꾼 이름이 게임 전체에 그대로 쓰이도록 한 곳에서만 만든다 */
function eaclName(){ try{ return compName("eacl"); }catch(e){ return "EACL "+((G&&G.season)||CUR_YEAR); } }
function eaclShort(){ try{ return compShort("eacl"); }catch(e){ return "EACL"; } }
function uidCompOf(k){ const i=compKeys().indexOf(k); return UID_COMP + (i<0?90:i); }
/* 연도 치환 — 대회명의 {Y} 자리, 그리고 손으로 적어 넣은 20xx 네 자리를 현재 시즌으로 바꾼다.
   2026 시즌엔 「K리그1 하나은행 2026」, 2027 시즌이 되면 자동으로 2027이 된다. */
function compYearFix(s){
  const y=String((G && G.season) || CUR_YEAR);
  return String(s||"").replace(/\{Y\}/g, y).replace(/20\d{2}/g, y);
}
function compInfo(k){
  const d=COMP_DEF[k]||{n:k, s:k};
  const o=(G && G.compNames && G.compNames[k]) || null;
  const rawN=(o&&o.n)||d.n, rawS=(o&&o.s)||d.s;
  return {n:compYearFix(rawN), s:compYearFix(rawS), rawN, rawS, uid:uidCompOf(k)};
}
function compName(k){ return compInfo(k).n; }      // 정식 명칭 (스폰서 포함)
function compShort(k){ return compInfo(k).s; }     // 짧은 표기
function uidRefOf(i){ return UID_REF + i; }
/* 🏃 선수가 나갈 수 있는 라인 밖 범위 — ⚠ 요청 원문 「지금 매치엔진에서 골라인 밖으로
   선수가 나가질 못하던데, 선수도 자유롭게 라인밖으로 나가게 해줘」.
   예전에는 모든 선수 좌표가 clamp01 로 [0,1]에 묶여 있어, 나간 공을 주우러 갈 때도
   라인 위에 붙어 서서 손만 뻗는 그림이 됐다(스로인은 아예 라인을 밟고 던졌다).
   ⚠ 렌더 여백(PITCH_PAD_X/Y) 안이어야 한다 — 넘으면 캔버스 밖으로 잘린다.
      가로 0.032×540px ≈ 17px < 50 · 세로 0.030×360px ≈ 11px < 30 (둘 다 공·선수 반지름 여유 포함) */
var PLAY_OUT_X=0.032, PLAY_OUT_Y=0.030;
function clampPx(v){ return v<-PLAY_OUT_X ? -PLAY_OUT_X : (v>1+PLAY_OUT_X ? 1+PLAY_OUT_X : v); }
function clampPy(v){ return v<-PLAY_OUT_Y ? -PLAY_OUT_Y : (v>1+PLAY_OUT_Y ? 1+PLAY_OUT_Y : v); }
/* 🚶 한 틱에 사람이 낼 수 있는 만큼만 옮긴다 — 그 이상은 화면에서 순간이동으로 보인다(제보).
   목표까지 멀면 그쪽으로 maxM 만큼만 다가간다. */
function stepToward(a, tx, ty, maxM){
  if(!a) return;
  const dx=(tx-a.x)*PITCH_AR, dy=ty-a.y;
  const d=HYP(dx,dy)*ISO_TO_M;
  if(d<=maxM || d<1e-6){ a.x=clampPx(tx); a.y=clampPy(ty); return; }
  const k=(maxM/ISO_TO_M)/HYP(dx,dy);
  a.x=clampPx(a.x+dx*k/PITCH_AR); a.y=clampPy(a.y+dy*k);
}
function uidHash(str){                       // FNV-1a 32bit — 짧고 충돌이 드물다
  let h=0x811c9dc5;
  for(let i=0;i<String(str).length;i++){ h^=String(str).charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; }
  return h>>>0;
}
/* 실존 선수 UID — 「원본 이름 + 생년(+생일)」로 만든다. 나중에 개명해도 값이 바뀌지 않는다. */
let _UID_USED=new Set();
/* ⚠ UID 키는 「저장된 선수 객체에서 똑같이 다시 만들 수 있는 값」이어야 한다.
   예전에는 생성 시점엔 전체 생년월일("1993/08/30")을, 옛 세이브 백필에선 p.bd("08/30")를 써서
   같은 선수가 서로 다른 번호를 받았다. 키를 p.bd 와 같은 「MM/DD」로 통일한다. */
function uidKeyOf(name, by, bd){
  const b=String(bd||"");
  return `${name}|${by||0}|${b.length>5?b.slice(5):b}`;
}
function uidRawReal(name, by, bd){ return UID_REAL + (uidHash(uidKeyOf(name,by,bd)) % 800000); }
function uidForReal(name, by, bd, salt, usedSet){
  /* 동명이인이 같은 해에 태어나면 값이 겹친다 — 소속(salt)을 섞어 결정론적으로 비켜 준다 */
  const used=usedSet||_UID_USED;
  let u=uidRawReal(name,by,bd);
  let k=0;
  while(used.has(u) && k<40){ k++; u=UID_REAL + (uidHash(uidKeyOf(name,by,bd)+`|${salt||""}|${k}`) % 800000); }
  used.add(u);
  return u;
}
/* 구단·감독 UID — 팀 id 고정 순서. 순서가 곧 번호라 사람이 읽기도 쉽다. */
let _UID_CLUB_MAP=null;
function uidClubMap(){
  if(_UID_CLUB_MAP) return _UID_CLUB_MAP;
  _UID_CLUB_MAP={}; let i=0;
  try{ for(const d of D1) _UID_CLUB_MAP[d.id]=UID_CLUB+(i++); }catch(e){}
  try{ for(const d of D2) if(!_UID_CLUB_MAP[d.id]) _UID_CLUB_MAP[d.id]=UID_CLUB+(i++); }catch(e){}
  return _UID_CLUB_MAP;
}
function uidClubOf(tid){ return uidClubMap()[tid] || (UID_CLUB+90+(uidHash(tid)%9)); }
function uidCoachOf(tid){ return uidClubOf(tid)-UID_CLUB+UID_COACH; }
/* 코치진 — 세이브 안에서만 유일하면 된다(생성 선수와 같은 방식) */
function nextStaffUid(){
  try{
    if(!G.uidStaff || G.uidStaff<UID_STAFF) G.uidStaff=UID_STAFF;
    return G.uidStaff++;
  }catch(e){ return UID_STAFF; }
}
/* 생성 선수(유스·리젠·선수 생성기) — 세이브 안에서만 유일하면 된다 */
function nextGenUid(){
  if(!G.uidSeq || G.uidSeq<UID_GEN) G.uidSeq=UID_GEN;
  return G.uidSeq++;
}
/* UID 로 선수 찾기 — 리그 전체 + FA + 해외 + 스카우트 + 유스 */
function findByUid(uid){
  if(uid==null) return null;
  const u=+uid;
  for(const id in (G.teams||{})){ const f=(G.teams[id].players||[]).find(p=>p&&+p.uid===u); if(f) return f; }
  const scan=(arr)=>Array.isArray(arr)?arr.find(p=>p&&+p.uid===u):null;
  return scan(G.freeAgents) || scan(G.overseas) || scan(G.scout&&G.scout.list) || scan(G.youthPool) || null;
}
function teamByUid(uid){
  const u=+uid;
  for(const id in (G.teams||{})) if(uidClubOf(id)===u) return G.teams[id];
  return null;
}
const PERS_N=["프로페셔널","야심가","온화함","다혈질"];
/* ── 연봉 (억/년) ────────────────────────────────────────────
   K리그 실제 규모에 맞춘 곡선. K리그1 선수 1인 평균 약 3.1억, 최고 연봉 20억 안쪽,
   구단 연봉 총액은 1부 100억대 / 2부 40억대가 되도록 잡았다.
   외국인은 대개 조금 더 받고, 2부는 전반적으로 낮다. */
function wageExpect(ovr, frn, div){
  const x=clamp((ovr-52)/42, 0, 1.05);
  let w = 0.55 + 19.2*Math.pow(x, 2.6);
  if(frn) w*=1.22;
  if(div===2) w*=0.72;
  return Math.max(0.4, Math.round(w*10)/10);
}
/* ── 시장 가치 (이적료 기준가, 억) ───────────────────────────
   K리그는 이적료 시장이 작다 — 리그 전체 연간 지출이 100억을 밑돈다.
   대부분 2~5억 선이고, 20억을 넘으면 리그를 흔드는 대형 거래다. */
/* 능력치별 기준 몸값(억). 지수식 하나로는 상단이 너무 눌려서 최상급과 상급이 구분되지 않았다
   (측정: 리그 최고 선수 5.6억, 평균 1.4억 — 전부 한 덩어리). 구간을 직접 박고 사이를 잇는다.
     최상급 25~30억 · 상급 15~25억 · 중간급 7~15억 · 하급 3~7억 · 최하급 그 아래 */
const MV_TABLE=[[45,0.3],[52,0.8],[58,2.0],[62,3.4],[66,6.2],[69,9.0],[71,12],[73,16],
                [75,22.5],[77,28],[79,33],[83,47],[88,70],[93,98]];
function mvBase(ovr){
  const T=MV_TABLE;
  if(ovr<=T[0][0]) return T[0][1];
  for(let i=1;i<T.length;i++){
    if(ovr<=T[i][0]){
      const [x0,y0]=T[i-1], [x1,y1]=T[i];
      return y0 + (y1-y0)*(ovr-x0)/(x1-x0);
    }
  }
  return T[T.length-1][1];
}
/* ---------- 세부 능력치 (FM 방식: 기술 14 / 정신 14 / 신체 8 / GK 13) ----------
   내부 저장은 20~99 스케일, 화면 표시는 1~20 스케일(attr20)로 환산한다.
   구 버전 10개 키(fin/lng/hea/pass/dri/pos_/mar/tck/pace/cmp)는 호환 레이어에서
   새 능력치로부터 파생시켜 계속 채워 넣는다 — 기존 호출부를 전부 고치지 않아도 되게. */
const TECH_ATTRS=["cor","crs","dri","fin","fir","fre","hea","lon","thr","mar","pas","pen","tck","tec"];
const MENT_ATTRS=["agg","ant","bra","cmp","cnt","dec","det","fla","ldr","otb","pos","tea","vis","wor"];
const PHYS_ATTRS=["acc","agi","bal","jum","nat","pac","sta","str"];
const GKT_ATTRS =["aer","cmd","com","ecc","han","kic","one","ref","tro","pun","tro2"];
const ATTR_LABEL_FM={
  // 기술
  cor:"코너킥", crs:"크로스", dri:"드리블", fin:"골 결정력", fir:"퍼스트 터치",
  fre:"프리킥", hea:"헤더", lon:"중거리 슛", thr:"장거리 스로인", mar:"일대일마크",
  pas:"패스", pen:"페널티킥", tck:"태클", tec:"개인기",
  // 정신
  agg:"적극성", ant:"예측력", bra:"대담성", cmp:"침착성", cnt:"집중력",
  // otb/pos 는 원래 FM 표기(오프 더 볼 / 위치 선정)였는데, 둘 다 "자리를 잡는 능력"이라
  // 이름만 보고는 무엇이 다른지 알 수 없었다. 공격/수비를 이름에 박아 구분한다.
  dec:"판단력", det:"승부욕", fla:"천재성", ldr:"리더십", otb:"공격시 위치 선정",
  pos:"수비시 위치 선정", tea:"팀워크", vis:"시야", wor:"활동량",
  // 신체
  acc:"가속도", agi:"민첩성", bal:"균형 감각", jum:"점프 거리", nat:"타고난 체력",
  pac:"주력", sta:"지구력", str:"몸싸움",
  // 골키퍼
  aer:"공중 장악력", cmd:"패널티박스 장악력", com:"수비 조율", ecc:"기행",
  han:"볼 핸들링", kic:"골킥", one:"일대일 방어", ref:"반사신경",
  tro:"돌진 빈도", pun:"펀칭 빈도", tro2:"공던지기"
};
/* 화면에 보여주는 순서 — 이미지의 3열 배치 그대로 */
const TECH_ORDER=["tec","fin","dri","mar","thr","lon","cor","crs","tck","pas","fir","pen","fre","hea"];
const MENT_ORDER=["bra","ldr","det","vis","ant","otb","pos","agg","cnt","fla","cmp","tea","dec","wor"];
const PHYS_ORDER=["acc","bal","str","agi","jum","pac","sta","nat"];
const GK_ORDER  =["aer","cmd","com","ecc","han","kic","one","ref","tro","pun","tro2"];

/* 구 키 → 신 키 파생 규칙. 구 키는 엔진 곳곳에서 쓰이므로 항상 채워 둔다. */
/* ⚠ 예전에는 여기에 dri:["tec"] 가 있었다. 그런데 dri 는 구 호환용 이름이 아니라
   FM 능력치 "드리블" 그 자체다. 그래서 sync 를 돌 때마다 드리블이 개인기 값으로
   덮어써져, 리그 전체에서 드리블 == 개인기 가 되어 있었다(측정으로 확인).
   드리블은 특성 조건·역할 적합도·돌파 판정에 쓰이는 실제 축이므로 매핑에서 뺀다. */
const LEGACY_FROM={
  fin:["fin"], lng:["lon"], hea:["hea"], pass:["pas"],
  pos_:["pos"], mar:["mar"], tck:["tck"], pace:["pac"], cmp:["cmp"]
};
function syncLegacyAttrs(a){
  if(!a) return a;
  for(const k in LEGACY_FROM){
    const src=LEGACY_FROM[k];
    /* ⚠ 자기 자신에서 파생되는 항목(fin·hea·mar·tck·cmp)은 여기서 손대면 안 된다.
       Math.round 로 되돌리는 셈이라, 매일 조금씩 오르던 소수점이 그날 바로 깎여 나갔다.
       실측 — 300 훈련일을 굴려도 결정력·헤더·태클·대인수비·침착성이 1도 오르지 않았다.
       (개인 훈련을 넣고 「마무리 과제를 줬는데 결정력이 그대로다」를 재현하다 발견) */
    if(src.length===1 && src[0]===k) continue;
    let s=0,n=0;
    for(const q of src){ if(typeof a[q]==="number"){ s+=a[q]; n++; } }
    if(n) a[k]=Math.round(s/n);
  }
  return a;
}
const ATTRS=["fin","lng","hea","pass","dri","pos_","mar","tck","pace","cmp"];   // 구 호환용
const ATTR_LABEL={fin:"골 결정력",lng:"중거리슛",hea:"헤더",pass:"패스",dri:"개인기",pos_:"위치선정",mar:"대인수비",tck:"태클",pace:"속력",cmp:"침착성"};
const GK_ATTRS=["shot","cmd","gkp"];
const GK_LABEL={shot:"선방",cmd:"수비조율",gkp:"패스"};

function attr20(raw){ return clamp(Math.round((raw||0)/5), 1, 20); }
/* 사기·컨디션처럼 내부적으로는 소수로 굴러가는 값을 화면에 찍을 때 쓴다 */
function mor(v){ return Math.round(v||0); }
/* 오버롤 = 화면 표시 세부 능력치의 합. 포지션별로 세는 항목이 다르다. */
function dispOvr(p){
  if(!p) return 0;
  const W=POS_WEIGHT[p.pos]||POS_WEIGHT.MF;
  const a=p.attr||{}, g=p.gkA||{}, fb=p.ovr||65;
  let sum=0, wt=0;
  for(const k in W){
    const raw = (typeof g[k]==="number") ? g[k] : (typeof a[k]==="number" ? a[k] : fb);
    sum += attr20(raw)*W[k]; wt += W[k];
  }
  const m = wt ? sum/wt : 10;            // 포지션 가중 평균 (1~20)
  return clamp(Math.round(90 + (m-11.7)*19.5), 90, 200);
}
/* 📏 ⚠ 요청 원문 — 「곳곳에 나오는 두자릿수 오버롤 표현을 모두 FM 식 오버롤 표현
   (3자리 수, 종합 최대 200, 잠재 최대 200)으로 바꿔주시면 감사하겠습니다. 현재는
   두자릿수 오버롤과 세자릿수 오버롤이 혼재 되어 쓰이고 있어 유저에게 혼란을 줄 수 있을 것 같습니다」.
   dispOvr 은 세부 능력치에서 계산하므로 선수 객체가 있어야 한다. 그런데 화면 중에는
   「숫자 하나」만 들고 있는 자리가 있다 — 스카우트 추정치, 성장 알림의 이전 값, 게시판에 실려 온 값.
   그런 자리를 위해 같은 기울기(내부 1 = 화면 3.9)로 옮기는 자를 둔다.
   ⚠ 계수는 눈대중이 아니라 실측이다 — 전 구단 1024명의 (내부 ovr, dispOvr) 을 최소제곱으로
     맞추면 기울기 3.93 · 절편 −133 이 나온다. 내부 74 → 158, 75 → 162.
     같은 내부값이라도 포지션 가중치 때문에 화면값이 갈리므로, 선수 객체가 있으면
     반드시 dispOvr(p) 를 쓴다. 이 자는 「숫자 하나뿐일 때」의 최선이다. */
const DISP_K=3.93;                         // 내부 눈금 1 = 화면 눈금 3.93 (실측)
const DISP_C=-133;
function dispOvrRaw(v){ return clamp(Math.round(DISP_K*(+v||0)+DISP_C), 90, 200); }
function dispGapRaw(v){ return Math.max(0, Math.round((+v||0)*DISP_K)); }   // 오차·격차 폭
/* ── 잠재력 표시 스케일 ─────────────────────────────────────
   내부 pot 은 38~96 스케일이지만 화면의 현재 능력(dispOvr)은 90~200 이다.
   두 눈금이 섞이면 "능력 172에 잠재력 84?" 같은 그림이 된다.
   FM처럼 잠재력도 90~200 으로 보여 주고, 입력도 그 눈금으로 받는다.
   변환은 선수의 실제 dispOvr 에 앵커를 걸어 CA-PA 격차가 그대로 유지되게 한다.
   (내부 5 = 화면 19.5 — dispOvr 공식의 기울기) */
const POT_K=19.5/5;   // (구 앵커 기울기 — 기록용)
/* ⚠ 제보 — 「유스5·훈련5인데 포텐 200짜리 둘, 185, 181이 한 시즌에 콜업. 대부분 150~170에
   가뭄에 콩 나듯 170~200이 나와야 현실적」. 절반은 이 눈금의 왜곡이었다.
   예전 공식은 「지금 화면 능력 + (내부 격차)×3.9」— 어리고 약한 선수일수록 격차가 커서
   내부 80~84(코치 평가 "우수", 특급 아님)가 화면 179, 92+는 전부 200에 붙었다.
   (실측 100시즌 — 화면 185+ 시즌당 1.18명, K리그1 전체엔 185+가 443명 중 20명뿐)
   ─ 내부 pot 을 직접 매핑한다: 38→90 · 74→158 · 80→170 · 84→177 · 88→185 · 92→192 · 96→200.
     보통은 150대, 우수가 170선, 특급(85+)부터 178+, 최상급(92+)만 192+ — 제보의 그림 그대로.
     나이 든 선수는 화면 능력이 이 값보다 클 수 있으므로 max()로 「잠재 ≥ 현재」를 보장한다. */
const POT_MAP_K=110/58;   // 내부 38~96 → 화면 90~200
function dispPot(p){
  if(!p) return 0;
  const direct=90 + (((p.pot||p.ovr||65)-38))*POT_MAP_K;
  return clamp(Math.round(Math.max(dispOvr(p), direct)), 90, 200);
}
/* 🌱 성장 전망 — ⚠ 제보 원문 「선수 종합 능력이 잠재 능력 끝까지 성장 했는데도 유스 탭에서
   성장 전망이 3칸이 남는 일이 있습니다. … 종합 능력 200, 잠재 능력 200 으로 프로필 기준으로는
   이미 성장을 마쳤습니다. (나이는 19세) 그런데 유스 탭에서의 성장 전망은 3칸이 남았습니다.
   … 종합 능력 / 잠재 능력 대비해서 유스 탭의 성장 전망을 그대로 칸수로 표현이 되게 교정
   해주시면 감사하겠습니다」.
   원인: 유스 탭은 칸수를 「내부 눈금」(p.pot − p.ovr · 38~96)으로 셌다. 그런데 프로필에 찍히는
   종합·잠재는 「화면 눈금」(dispOvr·dispPot · 90~200)이다. 두 화면이 서로 다른 자를 쓰고 있었다.
     예) 내부 ovr 87 / pot 96 → 내부 격차 9 → 3칸.
         같은 선수의 화면 값은 dispOvr 200(상한) · dispPot 200 → 프로필상 「성장 완료」.
   ⚠ 어빌 재배치(제보의 추측)는 「성장 전망」이 아니다 — 그건 총량이 아니라 배분의 문제이고,
      화면 종합(포지션 가중 CA)이 상한 200에 닿은 선수는 그 자를 기준으로 더 오를 곳이 없다.
   ─ 프로필과 같은 자로 잰다. 남은 폭(화면 눈금)도 숫자로 함께 적어 눈으로 대조할 수 있게 한다.
     한 칸 = 화면 눈금 6점 (예전 내부 3점과 같은 굵기 — 내부 3 × 110/58 ≈ 5.7).
     0점이면 「완성」, 1점이라도 남았으면 최소 한 칸은 그린다. */
function growthGap(p){
  if(!p) return {now:0, cap:0, gap:0, bars:0};
  const now=dispOvr(p), cap=dispPot(p);
  const gap=Math.max(0, cap-now);
  return {now, cap, gap, bars: gap>0 ? clamp(Math.ceil(gap/6), 1, 8) : 0};
}
/* 화면 눈금(90~200)으로 받은 잠재력을 내부 눈금으로 되돌린다 (직접 매핑의 역함수) */
function potFromDisp(p, dv){
  const d=clamp(dv, 90, 200);
  return clamp(Math.round(38 + (d-90)/POT_MAP_K), p.ovr||40, 96);
}
/* 세부 능력치와 같은 1~20 눈금으로 읽는 종합 능력.
   내부 p.ovr 은 20~99 스케일이라 화면에 그대로 찍으면 "능력치는 1~20인데 왜 75냐"가 된다. */
function ovr20(p){
  if(!p) return 0;
  const W=POS_WEIGHT[p.pos]||POS_WEIGHT.MF;
  const a=p.attr||{}, g=p.gkA||{}, fb=p.ovr||65;
  let sum=0, wt=0;
  for(const k in W){
    const raw = (typeof g[k]==="number") ? g[k] : (typeof a[k]==="number" ? a[k] : fb);
    sum += attr20(raw)*W[k]; wt += W[k];
  }
  return Math.round((wt?sum/wt:10)*10)/10;
}
/* 팀의 1~20 눈금 종합 — 선발 11인 기준 */
function teamOvr20(t){
  const xi=(typeof t==="object" && t.players) ? (xiStrength(t).xi||[]) : [];
  if(!xi.length) return 0;
  return Math.round(xi.reduce((s,p)=>s+ovr20(p),0)/xi.length*10)/10;
}
/* 포지션별 역할 보정 — ovr 을 중심으로 능력치가 포지션답게 갈라진다 */
const ATTR_SPREAD=42;   // 종 모양 편차 폭 (표준편차 약 7)
const ROLE_MOD_FM={
  // 골키퍼 — 필드 기술은 거의 없다시피. 대신 집중력·침착성·판단력은 높다.
  GK:{cor:-45,crs:-45,dri:-40,fin:-48,fir:-16,fre:-34,hea:-34,lon:-45,thr:-26,mar:-40,pas:-14,pen:-40,tck:-46,tec:-22,
      agg:-8,ant:6,bra:10,cmp:8,cnt:12,dec:6,det:4,fla:-12,ldr:4,otb:-36,pos:8,tea:2,vis:-8,wor:-14,
      acc:-12,agi:4,bal:4,jum:8,nat:2,pac:-14,sta:-10,str:4},
  // 수비수 — 마무리·중거리·개인기는 낮고, 대인·태클·헤더·위치선정이 높다
  DF:{cor:-14,crs:-8,dri:-20,fin:-32,fir:-10,fre:-16,hea:12,lon:-26,thr:2,mar:16,pas:-6,pen:-26,tck:16,tec:-14,
      agg:8,ant:8,bra:10,cmp:2,cnt:10,dec:5,det:5,fla:-14,ldr:3,otb:-22,pos:16,tea:5,vis:-8,wor:5,
      acc:-3,agi:-4,bal:3,jum:10,nat:2,pac:0,sta:2,str:10},
  // 미드필더 — 패스·시야·활동량 중심. 극단적으로 못하는 항목은 적다.
  MF:{cor:6,crs:2,dri:4,fin:-10,fir:8,fre:5,hea:-10,lon:2,thr:0,mar:-2,pas:12,pen:-6,tck:2,tec:7,
      agg:2,ant:5,bra:2,cmp:7,cnt:5,dec:8,det:4,fla:3,ldr:2,otb:5,pos:2,tea:8,vis:12,wor:10,
      acc:0,agi:3,bal:2,jum:-8,nat:0,pac:0,sta:8,str:-4},
  // 공격수 — 태클·마크·수비 위치선정은 확실히 낮다
  /* fin 은 원래 +16이었다. 그 결과 리그 공격수의 27.7%가 골 결정력 19 이상이었고
     최소값도 12라 "못 넣는 공격수"가 아예 없었다. +2로 낮춰 중앙값 15, 19+ 1%대로 맞췄다. */
  FW:{cor:-8,crs:2,dri:10,fin:2,fir:8,fre:-2,hea:2,lon:7,thr:-8,mar:-30,pas:-8,pen:8,tck:-32,tec:8,
      agg:0,ant:9,bra:4,cmp:7,cnt:-4,dec:2,det:4,fla:10,ldr:-4,otb:15,pos:-24,tea:-4,vis:-2,wor:-2,
      acc:9,agi:7,bal:5,jum:2,nat:0,pac:9,sta:0,str:2}
};
/* ── 오버롤 = FM식 Current Ability(90~200).
   단순 합이 아니라 "그 포지션에서 중요한 능력치"에 가중치를 준 값이다.
   그래서 공격수의 태클이 낮아도 오버롤이 깎이지 않고, 반대로 수비수의 골 결정력도 마찬가지다. */
const POS_WEIGHT={
  GK:{ /* gkA */ ref:10, one:9, han:8, cmd:7, aer:7, com:6, kic:5, pun:3, tro:2, tro2:2, ecc:1,
       /* 정신 */ cnt:6, dec:5, cmp:5, pos:4, ant:4, bra:3, det:2, tea:2, ldr:1, wor:1,
       /* 신체 */ agi:4, jum:4, acc:2, bal:2, str:2, sta:1, nat:1, pac:1 },
  DF:{ mar:10, tck:10, pos:9, hea:8, ant:7, cnt:6, str:6, jum:5, dec:5, cmp:4, bra:4,
       pac:4, acc:3, tea:3, wor:3, agg:2, pas:3, fir:2, tec:2, bal:2, sta:2, det:2,
       vis:1, cor:1, crs:1, dri:1, lon:1, fin:1, agi:1, thr:1, fla:1, ldr:1, otb:1, fre:1, pen:1, nat:1 },
  MF:{ pas:10, fir:8, tec:8, vis:8, dec:7, wor:7, sta:6, otb:5, cmp:6, tea:5, ant:5,
       tck:4, pos:4, dri:4, agi:3, bal:3, acc:3, pac:3, cnt:3, mar:2, str:2, lon:3, cor:2,
       crs:3, fla:2, det:2, bra:2, hea:2, jum:1, ldr:1, agg:1, thr:1, fre:2, pen:1, nat:1 },
  FW:{ fin:10, otb:9, dri:8, tec:7, fir:7, acc:7, pac:7, cmp:6, ant:6, agi:4, bal:4,
       hea:4, jum:3, lon:4, fla:3, str:3, pas:3, crs:3, det:2, bra:2, sta:2, vis:2,
       pen:2, wor:2, tea:1, dec:3, cnt:1, pos:1, mar:1, tck:1, cor:1, thr:1, ldr:1, agg:1, fre:1, nat:1 }
};
function genAttrsFM(pos, ovr){
  const mod=ROLE_MOD_FM[pos]||ROLE_MOD_FM.MF;
  const out={};
  const keys=TECH_ATTRS.concat(MENT_ATTRS, PHYS_ATTRS);
  /* 균등난수를 쓰면 최상·최하가 중앙값만큼 흔해서 "평균적인 선수"가 사라진다.
     세 번 뽑아 평균 내면 종 모양이 되어 중앙값 근처가 가장 두꺼워진다. */
  const bell=()=>((Math.random()+Math.random()+Math.random())/3-0.5)*ATTR_SPREAD;
  for(const k of keys) out[k]=clamp(Math.round(ovr+(mod[k]||0)+bell()), 15, 99);
  // 신체 능력치는 서로 붙어 다닌다 — 가속도·주력·민첩성이 따로 놀면 어색하다
  const spdCore=(out.pac+out.acc)/2;
  out.pac=clamp(Math.round(spdCore+(Math.random()-0.5)*8),15,99);
  out.acc=clamp(Math.round(spdCore+(Math.random()-0.5)*8),15,99);
  out.agi=clamp(Math.round(out.agi*0.6+spdCore*0.4),15,99);
  return syncLegacyAttrs(out);
}
/* ── 능력치 다이어트 (포지션 특화) ──────────────────────────────────
   ROLE_MOD_FM 만으로는 "못하는 게 없는 선수"가 너무 많이 나왔다. 평균 능력 68짜리
   센터백이 골 결정력 12, 개인기 12를 갖고 있는 식이다. FM에서 만능은 S급의 특권이고,
   나머지는 잘하는 두세 가지와 못하는 여러 가지로 이루어진다.

   그래서 포지션마다 "핵심"과 "안 쓰는 것"을 정하고, 안 쓰는 쪽을 깎아 그만큼을
   핵심으로 옮긴다. 두 가지 원칙을 지킨다.
     ① CA 총량은 건드리지 않는다 — 깎아낸 가중합을 그대로 핵심에 되돌려준다.
        선수가 약해지는 게 아니라 모양만 뾰족해진다.
     ② 잘하는 선수일수록 덜 깎는다 — 만능은 S급의 특권이다.
   예측력·판단력·집중력·속력·가속도·타고난 체력은 포지션과 무관한 기초라 절대 깎지 않는다. */
const SPEC_KEEP=["ant","dec","cnt","pac","acc","nat"];
const SPEC_ELITE=88, SPEC_SPAN=26, SPEC_MIN=0.15, SPEC_MAX=1.10;
/* 깎는 양은 표로 일일이 적지 않고 POS_WEIGHT(그 포지션에서의 중요도)에서 뽑는다.
   중요도가 낮을수록 크게 깎이고, 최상위 중요도는 하나도 안 깎인다.
   SPEC_CUT_MAX 는 "그 포지션에서 완전히 쓸모없는 능력치"가 받는 최대 감소폭(원시값). */
/* SPEC_BOOST_MAX 가 없으면 깎아낸 총량이 핵심 대여섯 개에 몰려 리그의 모든 공격수가
   골 결정력 20을 갖게 된다(측정으로 확인: 평균 19.7). 되돌려주는 양에 천장을 둔다. */
const SPEC_CUT_MAX=18, SPEC_GAMMA=1.15, SPEC_BOOST_MAX=3;
const SPEC_CORE={
  // 공격수 — 골 결정력·공격시 위치 선정·침착성이 본체. 제공권과 주력이 유형(타겟형/침투형)을 가른다.
  FW:["fin","otb","cmp","jum","hea","pac"],
  // 미드필더 — 패스·시야·천재성·퍼스트 터치. 공간을 메우려면 활동량·팀워크·타고난 체력이 필수다.
  MF:["pas","vis","fla","fir","wor","tea","nat"],
  // 수비수 — 수비시 위치 선정·태클·대인마크, 그리고 공중볼과 몸싸움.
  DF:["pos","tck","mar","jum","str"],
  // 골키퍼 — 공중볼 처리·반사신경·1대1·수비 조율·핸들링·킥.
  GK:["aer","ref","one","com","han","kic"]
};
function applySpecialization(p){
  if(!p || !p.attr) return;
  const core=SPEC_CORE[p.pos]; if(!core) return;
  const W=POS_WEIGHT[p.pos]||{};
  let wmax=1; for(const k in W) if(W[k]>wmax) wmax=W[k];
  // 골키퍼 전용 능력치는 p.gkA 에, 나머지는 p.attr 에 들어 있다
  const own=k=>(p.gkA && typeof p.gkA[k]==="number") ? p.gkA : (typeof p.attr[k]==="number" ? p.attr : null);
  const eliteK=clamp((SPEC_ELITE-(p.ovr||65))/SPEC_SPAN, SPEC_MIN, SPEC_MAX);
  let lost=0;
  for(const k in W){
    if(SPEC_KEEP.indexOf(k)>=0 || core.indexOf(k)>=0) continue;
    const o=own(k); if(!o) continue;
    const rel=(W[k]||1)/wmax;                       // 0~1 중요도
    const cut=SPEC_CUT_MAX*Math.pow(1-rel, SPEC_GAMMA)*eliteK;
    const before=o[k];
    o[k]=clamp(Math.round(before-cut), 15, 99);
    lost += (before-o[k])*(W[k]||1);
  }
  // 깎아낸 가중합을 그대로 핵심으로 되돌린다 — 총량은 그대로, 모양만 뾰족하게
  const coreW=core.reduce((s,k)=>s+(W[k]||1), 0);
  if(coreW>0 && lost>0){
    const add=Math.min(SPEC_BOOST_MAX, lost/coreW);
    for(const k of core){ const o=own(k); if(!o) continue;
      o[k]=clamp(Math.round(o[k]+add), 15, 99); }
  }
  applyTallDribble(p);
  syncLegacyAttrs(p.attr);
  if(p.gkA && typeof syncLegacyGk==="function") syncLegacyGk(p);
}
/* 장신 선수의 드리블 — 키 페널티에 포지션 특화까지 겹치면서 190cm 이상 선수의 드리블이
   중앙값 9, 하위 25%가 6까지 내려가 있었다(측정). 큰 선수가 발밑이 둔한 건 맞지만
   프로 선수가 공을 아예 못 다루는 수준은 아니다. 원래 순서를 유지한 채 9~15 구간으로 눌러 담는다. */
const DRI_TALL_H=190, DRI_TALL_LO=45, DRI_TALL_HI=77, DRI_TALL_K=0.55;
function applyTallDribble(p){
  if(!p || !p.attr || !p.h || p.h<DRI_TALL_H || p.pos==="GK") return;
  if(typeof p.attr.dri!=="number") return;
  p.attr.dri=clamp(Math.round(DRI_TALL_LO+(p.attr.dri-15)*DRI_TALL_K), DRI_TALL_LO, DRI_TALL_HI);
}
/* ── 나이에 따른 신체 능력 하락 ───────────────────────────────────
   축구 선수의 몸은 항목마다 정점이 다르다. 한 덩어리로 "30살부터 깎는다"고 하면
   35살 센터백의 몸싸움이 스무 살처럼 약해지는 이상한 그림이 나온다.
     · 주력·가속도   — 24~26세 정점. 27세부터 가장 먼저, 가장 빠르게 무너진다.
     · 민첩성·점프   — 27~28세까지 버티다 완만하게 내려온다.
     · 지구력·활동량 — 28~29세까지 유지되다 30대 들어 확 준다. 90분을 뛸 수는 있어도
                       예전처럼 전방압박에 매번 따라 올라가지는 못한다.
     · 균형·타고난 체력 — 늦게까지 남는다.
     · 몸싸움        — 오히려 30세 전후까지 붙는다. 근력은 늦게 완성된다.
   여기에 30대에게는 "천장"을 따로 씌운다. 아무리 빨랐던 윙어라도 34세에
   20/20 주력을 유지할 수는 없다 — 전성기 기록이 아니라 지금 몸이 기준이다. */
const AGE_PEAK={ pac:26, acc:26, agi:27, jum:28, sta:28, wor:29, bal:30, nat:29, str:31 };
const AGE_FALL={ pac:1.9, acc:1.8, agi:1.4, jum:1.3, sta:1.5, wor:1.8, bal:0.8, nat:0.7, str:0.6 };
/* 천장이 씌워지는 항목과 그 강도(1 = 천장을 그대로, 0.6 = 절반쯤만 눌린다) */
const AGE_CEIL_W={ pac:1, acc:1, wor:1, agi:0.62, sta:0.60, jum:0.50 };
const AGE_CEIL_FROM=31, AGE_CEIL_BASE=64, AGE_CEIL_STEP=2.2;   // 31세 64(≈12.8/20)에서 매년 2.2씩
function ageCeil(age, w){
  if(age<AGE_CEIL_FROM) return 99;
  const hard=Math.max(44, AGE_CEIL_BASE-(age-AGE_CEIL_FROM)*AGE_CEIL_STEP);
  return 99-(99-hard)*w;
}
/* 🛠️ 선수별 천장 — 에디터로 손수 올린 값은 「그 선수의 몸」으로 인정한다.
   ⚠ 제보 — 「주력·가속을 18로 올려 줬는데 다음 경기에 11, 10으로 내려가 있다」.
      31세부터 걸리는 나이 천장(pac/acc는 31세 64 → 매년 -2.2)에 즉시 스냅됐기 때문이다.
      감독이 일부러 고친 값까지 되돌리면 에디터가 무의미하다. 고친 값을 개인 천장으로 남기고,
      그 아래로의 자연스러운 노쇠(하루하루 조금씩 깎이는 쪽)는 그대로 둔다. */
function attrCap(p, k, age){
  const w=AGE_CEIL_W[k]; if(!w) return 99;
  let c=ageCeil(age, w);
  const ov=p && p.capOv && p.capOv[k];
  if(typeof ov==="number" && ov>c) c=ov;
  return c;
}
/* 나이만큼 몸을 깎는다. 반환값은 포지션 가중 CA 변화량 — ovr 도 같이 따라 내려간다. */
function applyAgeDecline(p, age){
  if(!p || !p.attr || !age) return 0;
  const a=p.attr, before=rawCA(p);
  for(const k in AGE_FALL){
    if(typeof a[k]!=="number") continue;
    const over=age-AGE_PEAK[k];
    if(over>0){
      const accel = age>=34 ? 1+(age-33)*0.08 : 1;    // 30대 중반부터는 낙폭이 조금 더 가팔라진다
      a[k]=clamp(Math.round(a[k]-AGE_FALL[k]*over*accel), 24, 99);
    }
    const w=AGE_CEIL_W[k];
    if(w) a[k]=Math.min(a[k], Math.round(attrCap(p,k,age)));
  }
  syncLegacyAttrs(a);
  const d=rawCA(p)-before;
  p.ovr=clamp(Math.round((p.ovr||65)+d), 20, 99);
  if(p.ovrF!==undefined) p.ovrF=p.ovr;
  if(p.pot!=null) p.pot=Math.max(p.pot, p.ovr);
  return d;
}
/* ── 키에 따른 몸의 대가 ─────────────────────────────────────────────
   여태 키는 이득만 줬다 — 점프·헤더가 올라갈 뿐 잃는 게 없어서, 195cm 윙어가
   장신의 제공권을 갖고도 발과 균형이 멀쩡했다. 실제로는 반대급부가 분명하다.
   큰 선수는 무게중심이 높아 방향을 바꾸는 데 오래 걸리고(민첩성),
   접촉 상황에서 중심을 잃기 쉽고(균형), 첫 걸음이 무겁고(가속),
   좁은 공간에서 발밑으로 공을 다루기 어렵다(개인기·드리블).
   최고 속도(주력)는 상대적으로 덜 손해다 — 큰 보폭이 어느 정도 벌충한다.
   186cm부터 완만하게 시작해 190cm를 넘으면 기울기가 더 선다.
   ovr 은 건드리지 않는다. 점프·헤더 보너스도 ovr 을 올리지 않으므로,
   같은 ovr 안에서 "공중에 강하고 발밑이 둔한 몸"으로 성격만 바뀐다 — 진짜 트레이드오프다. */
const HT_FROM=186, HT_STEEP=190;
const HT_FALL={ agi:1.05, bal:0.85, acc:0.75, tec:0.60, pac:0.55, dri:0.45 };
function applyHeightBody(p){
  if(!p || !p.attr || !p.h || p.pos==="GK") return;   // 골키퍼는 전용 능력치를 따로 쓴다
  const over=Math.max(0, p.h-HT_FROM), extra=Math.max(0, p.h-HT_STEEP);
  if(!over) return;
  for(const k in HT_FALL){
    if(typeof p.attr[k]!=="number") continue;
    const cut=HT_FALL[k]*over + HT_FALL[k]*0.60*extra;
    p.attr[k]=clamp(Math.round(p.attr[k]-cut), 15, 99);
  }
  syncLegacyAttrs(p.attr);
}
function genGkAttrsFM(ovr, height){
  const out={};
  const tall=clamp((height-178)/22, -1, 1);      // 키가 크면 공중 장악·점프가 유리
  for(const k of GKT_ATTRS) out[k]=clamp(Math.round(ovr+(Math.random()-0.5)*14), 15, 99);
  out.aer=clamp(Math.round(out.aer+tall*7),15,99);
  out.cmd=clamp(Math.round(out.cmd+tall*4),15,99);
  out.ecc=clamp(Math.round(35+Math.random()*45),10,95);      // 기행은 실력과 무관한 성향
  out.pun=clamp(Math.round(35+Math.random()*50),10,95);      // 펀칭 선호도 성향
  out.tro=clamp(Math.round(30+Math.random()*55),10,95);      // 돌진 빈도 성향
  // 구 3키 호환
  return out;
}
function syncLegacyGk(p){
  const g=p.gkA; if(!g) return;
  p.gk={ shot:Math.round((g.ref*0.5+g.one*0.3+g.han*0.2)),
         cmd :Math.round((g.cmd*0.45+g.com*0.35+g.aer*0.20)),
         gkp :Math.round((g.kic*0.6+(p.attr&&p.attr.pas||60)*0.4)) };
}
/* 신장·체중 — 포지션과 능력치에 맞게 그럴듯하게
   ⚠ 주발(p.foot)은 걷어냈다. 제보 — 「지금 이 매치엔진에는 약발이 없거든?」.
      맞는 지적이었다. p.foot 은 오른발 74%·왼발 20%·양발 6% 로 굴려서 커뮤니티 카드에
      찍는 문자열 하나였고, 매치엔진은 이 값을 <b>한 번도 읽지 않았다</b>.
      약발 수치(p.weak)는 같은 이유로 예전에 이미 걷어낸 상태였다.
      발 개념 없이 몸 방향(a.face)만 보는 엔진에서 주발 라벨만 남겨 두면
      「있는 줄 알았는데 아무 일도 안 하는」 항목이 된다 — 그래서 표시까지 지운다. */
function genBody(pos, a){
  let h;
  if(pos==="GK")      h=185+Math.round((Math.random()-0.35)*14);
  else if(pos==="DF") h=180+Math.round((Math.random()-0.45)*16);
  else if(pos==="MF") h=176+Math.round((Math.random()-0.5)*16);
  else                h=179+Math.round((Math.random()-0.5)*18);
  h=clamp(h,165,199);
  const w=clamp(Math.round((h-100)*0.92+(Math.random()-0.5)*8), 60, 95);
  return {h, w};
}
/* ── FM 역할 및 임무 (Roles & Duties) ──────────────────────────────
   역할은 능력치를 더 주지 않는다. "어디에 서고, 무엇을 먼저 선택하는가"를 바꾼다.
     grp   : 이 역할을 줄 수 있는 슬롯 그룹
     duty  : 가능한 임무 (D=수비, S=지원, A=공격)
     key   : 역할 적합도를 매길 때 보는 핵심 능력치
     fx(d) : 임무별 엔진 효과. 아래 키들은 매치엔진이 직접 읽는다.
             fwd(전진 성향) wide(측면 치우침) roam(자리 이탈 허용) pm(패스 우선순위)
             press(압박 적극성) 그리고 특성과 공유하는 dribble/killer/shoot/hold/earlyCross/tightMark/slide */
const ROLE_GRP={ GK:"GK", SW:"SW", LCB:"CB", RCB:"CB", CB:"CB",
                 LB:"FB", RB:"FB", LWB:"WB", RWB:"WB",
                 LDM:"CM", DM:"CM", RDM:"CM",
                 LCM:"CM", RCM:"CM", CM:"CM", LM:"WIDE", RM:"WIDE",
                 LAM:"AM", CAM:"AM", RAM:"AM",
                 LW:"WIDE", RW:"WIDE", LS:"ST", RS:"ST", ST:"ST" };
const ROLES=[
 // ── 골키퍼
 {k:"G",  n:"골키퍼", e:"Goalkeeper", grp:["GK"], duty:["D"],
  key:["ref","one","han","cmd","pos","cnt","dec","agi"],
  fx:()=>({sweep:-0.35})},
 {k:"SK", n:"스위퍼 키퍼", e:"Sweeper Keeper", grp:["GK"], duty:["D","S","A"],
  key:["ref","one","cmd","kic","pas","fir","vis","cmp","acc"],
  fx:d=>({sweep: d==="A"?0.85 : d==="S"?0.50 : 0.22, killer: d==="A"?0.35:0.15})},
 // ── 스위퍼 (최후방 단독)
 {k:"SWP", n:"스위퍼", e:"Sweeper", grp:["SW"], duty:["D","S"],
  key:["pos","ant","cnt","dec","mar","tck","cmp","pac","acc"],
  fx:d=>({fwd: d==="S"?0.25:-0.20, roam: d==="S"?0.35:0.15,
          sweepBack:1, tightMark:-1, killer: d==="S"?0.30:0.05, press:-0.25})},
 {k:"LSW",n:"리베로", e:"Libero", grp:["SW"], duty:["D","S","A"],
  key:["pos","ant","dec","pas","fir","tec","cmp","dri","tck"],
  fx:d=>({fwd: d==="A"?0.75 : d==="S"?0.45:0.10, roam: d==="A"?0.85:0.55,
          sweepBack:1, pm:0.55, dribble:0.35, killer:0.40, press:-0.15})},
 {k:"BPS",n:"볼 플레잉 스위퍼", e:"Ball Playing Sweeper", grp:["SW"], duty:["D","S"],
  key:["pos","ant","pas","fir","vis","tec","cmp","dec"],
  fx:d=>({fwd: d==="S"?0.25:-0.10, sweepBack:1, pm:0.65, killer:0.55, longPass:1, press:-0.2})},
 {k:"NSW",n:"안정형 스위퍼", e:"No-Nonsense Sweeper", grp:["SW"], duty:["D"],
  key:["pos","ant","mar","tck","hea","str","cnt","bra"],
  fx:()=>({fwd:-0.30, sweepBack:1, killer:-0.8, clearFirst:1, press:-0.1})},
 // ── 중앙 수비
 {k:"CD", n:"중앙 수비수", e:"Central Defender", grp:["CB"], duty:["D","St","Cv"],
  key:["mar","tck","hea","pos","str","jum","cnt","bra"],
  fx:d=>({fwd: d==="St"?0.18 : d==="Cv"?-0.18 : 0, press: d==="St"?0.35:0, tightMark:d==="St"?1:0})},
 {k:"BPD",n:"공격형 수비수", e:"Ball Playing Defender", grp:["CB"], duty:["D","St","Cv"],
  key:["mar","tck","hea","pos","pas","fir","vis","tec"],
  fx:d=>({fwd: d==="St"?0.15 : d==="Cv"?-0.15 : 0, killer:0.45, pm:0.5})},
 {k:"NCB",n:"안정형 수비수", e:"No-Nonsense Centre-Back", grp:["CB"], duty:["D","St","Cv"],
  key:["mar","tck","hea","pos","str","jum","bra"],
  fx:d=>({fwd: d==="St"?0.15:0, killer:-0.9, shortPass:1, clearFirst:1})},
 {k:"L",  n:"리베로", e:"Libero", grp:["CB"], duty:["D","S"],
  key:["mar","tck","pos","pas","fir","tec","vis","cmp","dri"],
  fx:d=>({fwd: d==="S"?0.55:0.30, roam:0.6, dribble:0.35, pm:0.4})},
 {k:"WCB",n:"와이드 센터백", e:"Wide Centre-Back", grp:["CB"], duty:["D","S","A"],
  key:["mar","tck","hea","pos","crs","dri","sta","pac"],
  fx:d=>({fwd: d==="A"?0.55 : d==="S"?0.30 : 0.05, wide:0.55, cross:0.4})},
 // ── 측면 수비
 {k:"FB", n:"풀백", e:"Full-Back", grp:["FB"], duty:["D","S","A"],
  key:["mar","tck","pos","crs","pac","sta","wor","tea"],
  fx:d=>({fwd: d==="A"?0.55 : d==="S"?0.25 : -0.05, wide:0.35, cross: d==="A"?0.35:0.15})},
 {k:"WB", n:"윙백", e:"Wing-Back", grp:["WB"], duty:["D","S","A"],
  key:["crs","dri","pac","sta","wor","tck","otb","tec"],
  fx:d=>({fwd: d==="A"?0.85 : d==="S"?0.55 : 0.20, wide:0.60, cross:0.45, dribble:0.25})},
 {k:"NFB",n:"안정형 풀백", e:"No-Nonsense Full-Back", grp:["FB"], duty:["D"],
  key:["mar","tck","pos","str","cnt","bra"],
  fx:()=>({fwd:-0.25, killer:-0.8, clearFirst:1, tightMark:1})},
 {k:"CWB",n:"완성형 윙백", e:"Complete Wing-Back", grp:["WB"], duty:["S","A"],
  key:["crs","dri","tec","pac","sta","wor","otb","fla"],
  fx:d=>({fwd: d==="A"?1.0:0.70, wide:0.65, cross:0.55, dribble:0.5, roam:0.35})},
 {k:"IWB",n:"인버티드 윙백", e:"Inverted Wing-Back", grp:["FB","WB"], duty:["D","S","A"],
  key:["pas","fir","tec","tck","pos","dec","vis"],
  fx:d=>({fwd: d==="A"?0.55 : d==="S"?0.30:0.05, wide:-0.55, pm:0.35, killer:0.2})},
 {k:"IFB",n:"인버티드 풀백", e:"Inverted Full-Back", grp:["FB"], duty:["D"],
  key:["mar","tck","pos","hea","str","cnt","dec"],
  fx:()=>({fwd:-0.20, wide:-0.70, killer:-0.4, tightMark:1, clearFirst:1})},
 // ── 중앙 미드필드
 {k:"DM", n:"수비형 미드필더", e:"Defensive Midfielder", grp:["CM"], duty:["D","S"],
  key:["tck","mar","pos","ant","cnt","tea","wor","str"],
  fx:d=>({fwd: d==="S"?0.10:-0.35, press:0.35, tightMark:1})},
 {k:"DLP",n:"딥라잉 플레이메이커", e:"Deep Lying Playmaker", grp:["CM"], duty:["D","S"],
  key:["pas","fir","vis","dec","tea","cmp","ant","tec"],
  fx:d=>({fwd: d==="S"?0.05:-0.30, pm:1.0, killer:0.45, longPass:1, deep:1})},
 {k:"BWM",n:"볼 위닝 미드필더", e:"Ball Winning Midfielder", grp:["CM"], duty:["D","S"],
  key:["tck","mar","agg","bra","wor","sta","tea","str"],
  fx:d=>({fwd: d==="S"?0.15:-0.20, press:0.85, slide:0.45, tightMark:1, killer:-0.3})},
 {k:"A",  n:"앵커", e:"Anchor Man", grp:["CM"], duty:["D"],
  key:["pos","ant","cnt","tck","mar","dec","tea","hea"],
  fx:()=>({fwd:-0.50, roam:-0.6, press:-0.25, shortPass:1, killer:-0.6})},
 {k:"HB", n:"하프백", e:"Half Back", grp:["CM"], duty:["D"],
  key:["pos","ant","tck","mar","pas","fir","cmp","tea"],
  /* 🅗 살리다 라볼피아나 — 하프백의 정체성. 계측(mfrole): fwd -0.70만으로는 빌드업 때
     CB라인 앞 +1.5m로 앵커(-0.3m)보다 오히려 위에 섰다. 내려간다는 플래그를 명시한다. */
  fx:()=>({fwd:-0.70, roam:-0.4, pm:0.4, shortPass:1, salida:1})},
 {k:"RGA",n:"레지스타", e:"Regista", grp:["CM"], duty:["S"],
  key:["pas","vis","fla","tec","dec","fir","wor","sta"],
  fx:()=>({fwd:0.10, roam:0.85, pm:1.0, killer:0.7, hold:0.4, press:-0.2})},
 {k:"RPM",n:"로밍 플레이메이커", e:"Roaming Playmaker", grp:["CM"], duty:["S"],
  key:["pas","dri","tec","vis","wor","sta","otb","dec"],
  fx:()=>({fwd:0.35, roam:1.0, pm:0.9, dribble:0.55, killer:0.35})},
 {k:"VOL",n:"세군도 볼란테", e:"Segundo Volante", grp:["CM"], duty:["S","A"],
  key:["tck","wor","sta","pac","lon","otb","str"],
  /* 후방에서 뒤늦게 폭발하는 게 이 역할의 전부인데 lateRun 이 없었다 (계측: 박스 1.1%·슛 0) */
  fx:d=>({fwd: d==="A"?0.60:0.25, roam:0.35, dribble:0.25, longShot:0.35, lateRun: d==="A"?0.85:0.35})},
 {k:"CM", n:"중앙 미드필더", e:"Central Midfielder", grp:["CM"], duty:["D","S","A"],
  key:["pas","fir","tec","dec","tea","wor","sta","tck"],
  fx:d=>({fwd: d==="A"?0.45 : d==="S"?0.10 : -0.25, press: d==="D"?0.25:0})},
 {k:"BBM",n:"박스 투 박스 미드필더", e:"Box To Box Midfielder", grp:["CM"], duty:["S"],
  key:["wor","sta","pac","tck","pas","lon","otb","tea"],
  /* 계측: 공격은 CM 공격 임무만큼 올라가는데(70.9 vs 71.9m) 수비 자기진영 체류도 39 vs 36%로
     같았다 — 「공격 임무 CM의 별명」이었다. twoWay: 수비 국면에선 fwd 를 버리고 내려온다 */
  fx:()=>({fwd:0.45, roam:0.55, lateRun:1, longShot:0.4, press:0.3, twoWay:1})},
 {k:"AP", n:"전진형 플레이메이커", e:"Advanced Playmaker", grp:["CM","WIDE","ST","AM"], duty:["S","A"],
  key:["pas","fir","tec","vis","dec","otb","cmp","fla"],
  fx:d=>({fwd: d==="A"?0.65:0.40, pm:1.0, killer:0.65, oneTwo:1})},
 {k:"MEZ",n:"메짤라", e:"Mezzala", grp:["CM","AM"], duty:["S","A"],
  key:["dri","pas","tec","otb","fla","wor","acc"],
  /* 계측: wide 0.40 이 폭 +1.1~1.3m 뿐 — 카릴레로(0.35)가 오히려 더 넓었다. 하프스페이스 앵커링 플래그 */
  fx:d=>({fwd: d==="A"?0.60:0.35, wide:0.40, roam:0.5, dribble:0.4, killer:0.3, halfSpace:1})},
 {k:"CAR",n:"카릴레로", e:"Carrilero", grp:["CM"], duty:["S"],
  key:["tea","wor","sta","pas","pos","tck","dec"],
  fx:()=>({fwd:0.05, wide:0.35, roam:-0.3, press:0.25})},
 // ── 측면
 {k:"WM", n:"측면 미드필더", e:"Wide Midfielder", grp:["WIDE"], duty:["D","S","A"],
  key:["crs","pas","tec","wor","sta","tea","tck"],
  // 측면 미드필더도 임무로 크로스가 갈려야 한다 — 예전에는 cross 0.35로 셋 다 같았다
  fx:d=>({fwd: d==="A"?0.45 : d==="S"?0.15 : -0.15, wide:0.45,
          cross: d==="A"?0.55 : d==="S"?0.30 : 0.15})},
 {k:"W",  n:"윙", e:"Winger", grp:["WIDE","AM"], duty:["S","A"],
  key:["crs","dri","tec","pac","acc","agi","otb"],
  /* 임무로 크로스가 갈린다. 예전에는 두 임무의 cross 가 0.65로 같아서 측정해 보면
     지원·공격 모두 크로스 비율 33.3%로 완전히 똑같았다. earlyCross 는 "크로스를 올릴지"가
     아니라 "어떤 크로스를 올릴지"만 바꾸므로 임무 차이를 만들지 못했다.
     지원은 뒤에서 일찍 올리고, 공격은 엔드라인까지 파고들어 더 자주 올린다. */
  fx:d=>({fwd: d==="A"?0.60:0.35, wide:0.75, cross: d==="A"?0.95:0.35,
          dribble: d==="A"?0.60:0.50, earlyCross: d==="A"?0:0.70})},
 {k:"DW", n:"수비형 윙", e:"Defensive Winger", grp:["WIDE","WB"], duty:["D","S"],
  key:["wor","sta","tck","tea","crs","pos","agg"],
  /* 이름은 "수비형 윙"인데 측정해 보니 자기 진영 체류 40.5%로 평범한 윙(40.3%)과 같았고,
     임무 수비·지원이 fwd 하나(-0.25 / 0.10)만 달라 수비 지표에서 구분이 되지 않았다.
     수비 임무는 확실히 내려앉아 풀백과 두 겹으로 서고(밀착 마크),
     지원 임무는 앞에서 물어뜯는다(압박)로 성격을 갈라 놓는다. */
  fx:d=>({fwd: d==="S"?0.20:-0.75, wide:0.40,
          press: d==="S"?1.05:0.55, cross: d==="S"?0.30:0.15,
          tightMark: d==="S"?0.30:0.85})},
 {k:"WP", n:"와이드 플레이메이커", e:"Wide Playmaker", grp:["WIDE"], duty:["S","A"],
  key:["pas","fir","tec","vis","dri","dec","fla"],
  fx:d=>({fwd: d==="A"?0.45:0.25, wide:0.25, pm:1.0, killer:0.55, dribble:0.3})},
 {k:"IW", n:"인버티드 윙어", e:"Inverted Winger", grp:["WIDE","AM"], duty:["S","A"],
  key:["crs","dri","pas","tec","otb","agi","fla"],
  fx:d=>({fwd: d==="A"?0.55:0.30, wide:-0.35, cutIn:1, dribble:0.45, cross:0.35, curl:1})},
 {k:"IF", n:"인사이드 포워드", e:"Inside Forward", grp:["WIDE","AM"], duty:["S","A"],
  key:["fin","dri","tec","otb","acc","pac","agi","fla"],
  fx:d=>({fwd: d==="A"?0.75:0.50, wide:-0.55, cutIn:1, dribble:0.55, shoot:0.35, curl:1})},
 {k:"WT", n:"와이드 타깃 포워드", e:"Wide Target Forward", grp:["WIDE"], duty:["S","A"],
  key:["hea","str","jum","bal","tea","fir"],
  fx:d=>({fwd: d==="A"?0.55:0.30, wide:0.60, hold:0.7, aerialTarget:1})},
 {k:"RMD",n:"라움도이터", e:"Raumdeuter", grp:["WIDE","AM"], duty:["A"],
  key:["otb","ant","fin","cnt","dec","acc"],
  fx:()=>({fwd:0.85, wide:0.25, roam:0.8, boxPlayer:1, breakLine:1, press:-0.4})},
 // ── 중앙 공격
 {k:"AM", n:"공격형 미드필더", e:"Attacking Midfielder", grp:["ST","CM","AM"], duty:["S","A"],
  key:["pas","fir","tec","otb","fin","vis","fla"],
  /* 10번도 창조자다 — pm 0 이면 플레이메이커 유인의 수혜를 전혀 못 받아 종착지로만 남는다 */
  fx:d=>({fwd: d==="A"?0.75:0.50, killer:0.4, shoot:0.2, pm:0.35})},
 {k:"T",  n:"트레콰르티스타", e:"Trequartista", grp:["ST","CM","AM"], duty:["A"],
  key:["fin","fir","tec","vis","fla","dri","cmp"],
  fx:()=>({fwd:0.70, roam:1.0, pm:0.9, killer:0.6, press:-0.7, dribble:0.4})},
 {k:"EG", n:"엔간체", e:"Enganche", grp:["ST","CM","AM"], duty:["S"],
  key:["pas","vis","tec","fir","dec","cmp","fla"],
  fx:()=>({fwd:0.45, roam:-0.7, pm:1.0, killer:0.7, hold:0.6, press:-0.6})},
 {k:"SS", n:"쉐도우 스트라이커", e:"Shadow Striker", grp:["ST","AM"], duty:["A"],
  key:["fin","otb","ant","dri","acc","cmp","fir"],
  fx:()=>({fwd:0.90, shoot:0.45, breakLine:1, oneTwo:1, press:0.3})},
 {k:"DLF",n:"딥라잉 포워드", e:"Deep Lying Forward", grp:["ST"], duty:["S","A"],
  key:["fir","pas","tec","cmp","tea","str","otb"],
  fx:d=>({fwd: d==="A"?0.55:0.25, deep:1, hold:0.7, pm:0.6, killer:0.35})},
 {k:"AF", n:"전진형 포워드", e:"Advanced Forward", grp:["ST"], duty:["A"],
  key:["fin","dri","fir","otb","acc","pac","cmp"],
  fx:()=>({fwd:0.95, shoot:0.4, dribble:0.35, breakLine:1})},
 {k:"TF", n:"타깃 포워드", e:"Target Forward", grp:["ST"], duty:["S","A"],
  key:["hea","str","jum","bra","bal","fin","fir"],
  fx:d=>({fwd: d==="A"?0.70:0.40, hold:0.8, aerialTarget:1, boxPlayer: d==="A"?1:0})},
 {k:"P",  n:"포처", e:"Poacher", grp:["ST"], duty:["A"],
  key:["fin","otb","ant","cmp","acc"],
  fx:()=>({fwd:1.0, boxPlayer:1, shoot:0.5, press:-0.7, killer:-0.6, roam:-0.4})},
 {k:"CF", n:"완성형 포워드", e:"Complete Forward", grp:["ST"], duty:["S","A"],
  key:["fin","dri","fir","tec","hea","str","otb","pas"],
  fx:d=>({fwd: d==="A"?0.85:0.55, shoot:0.3, dribble:0.35, killer:0.3, hold:0.35, roam:0.4})},
 {k:"PF", n:"압박형 포워드", e:"Pressing Forward", grp:["ST"], duty:["D","S","A"],
  key:["wor","sta","agg","bra","tea","acc","fin"],
  fx:d=>({fwd: d==="A"?0.70 : d==="S"?0.45:0.25, press:1.0, aggPress:1})},
 {k:"F9", n:"폴스 나인", e:"False Nine", grp:["ST"], duty:["S"],
  key:["pas","fir","tec","vis","otb","dri","cmp"],
  fx:()=>({fwd:0.25, deep:1, roam:0.8, pm:0.9, killer:0.6, dribble:0.35})}
];
const ROLE_BY_KEY={}; for(const r of ROLES) ROLE_BY_KEY[r.k]=r;
const DUTY_N={D:"수비", S:"지원", A:"공격", St:"스토퍼", Cv:"커버"};
/* 슬롯에서 고를 수 있는 역할 목록 */
function rolesForSlot(slot){
  const g=ROLE_GRP[slot]||"CM";
  return ROLES.filter(r=>r.grp.includes(g));
}
/* 🎓 그 선수에게 익숙한 순서로 역할을 늘어놓는다.
   ⚠ 제보 — 「경기를 뛰어서 가장 친숙한 역할이 되어도 목록에서 위로 올라오지 않는다」.
     예전에는 능력치 적합도(roleFit)만으로 줄을 세웠다. 그건 「할 수 있는가」이지
     「해봤는가」가 아니다. 몸에 밴 역할이 먼저 눈에 들어와야 한다.
   ─ 1순위 역할 능숙도 · 2순위 적합도. 뛰면 올라오고, 안 쓰면 내려간다. */
function rolesSortedFor(p, slot){
  const list=rolesForSlot(slot).slice();
  if(!p) return list;
  const fam=(R)=>{ try{ return getRoleFam(p, R.k)||0; }catch(e){ return 0; } };
  const fit=(R)=>{ try{ return roleFit(p, R.k)||0; }catch(e){ return 0; } };
  return list.sort((a,b)=> (fam(b)-fam(a)) || (fit(b)-fit(a)) );
}
/* 슬롯의 기본 역할 — 아무것도 지정하지 않았을 때 */
const ROLE_DEFAULT={GK:["G","D"], SW:["SWP","D"], CB:["CD","D"], FB:["FB","S"], WB:["WB","S"], CM:["CM","S"], WIDE:["W","S"], AM:["AM","S"], ST:["AF","A"]};
/* ⚠ 제보 — 「메짤라·플레이메이커로 세워 두고 벤치에 내렸다가 다시 선발로 올리면
      적합도 낮은 기본 역할로 돌아간다」.
   원인 : 역할이 tactic.role[선수] 한 곳에만 있었는데, 교체·자리 맞바꾸기에서
          「새 자리에서 못 맡는 역할이면 지운다」며 그 기록을 통째로 삭제했다.
   해결 : 지시를 둘로 나눈다.
          · tactic.role   — 지금 이 자리에 내려진 지시 (교체 때 자리를 따라 인계된다)
          · tactic.roleBy — 감독이 그 자리에서 직접 고른 지시 (선수에게 붙어 다닌다)
          자리 그룹별로 따로 기억하므로, 중앙에서 메짤라 · 2선에서 플메 를 각각 기억한다. */
/* 역할 우선순위 — 「지금 이 전술에 지정된 역할」 → 「선수가 기억하는 개인 역할」 → 기본값.
   ⚠ 제보 — 경기 중 교체하면 그 자리에 지정해 둔 역할(메짤라 등)이 아니라
      들어온 선수의 옛 개인 역할로 바뀌어 전술이 어긋났다. 개인 기억이 먼저 오고 있었던 탓이다.
      교체 처리(subIn·confirmSwap)는 나간 선수의 역할을 그 자리 후임에게 role[pid] 로 넘겨 준다 —
      그러니 role 을 먼저 읽어야 전술이 유지된다.
   ⚠ 「벤치 다녀오면 역할이 초기화된다」도 그대로 해결된다 — role[pid] 는 지워지지 않으므로
      같은 자리로 돌아오면 그 역할이 살아 있고, 다른 자리 그룹으로 가면 roleBy 가 받쳐 준다. */
function getRole(t, p, slot){
  const g=ROLE_GRP[slot]||"CM";
  const map=(t&&t.tactic&&t.tactic.role)||{};
  const cur=map[p.id];
  if(cur && ROLE_BY_KEY[cur.r] && ROLE_BY_KEY[cur.r].grp.includes(g)) return cur;
  const mem=((t&&t.tactic&&t.tactic.roleBy)||{})[p.id];
  const my=mem&&mem[g];
  if(my && ROLE_BY_KEY[my.r] && ROLE_BY_KEY[my.r].grp.includes(g)) return my;
  /* ⚠ 제보 — 「교체명단 갔다가 선발로 다시 올릴 때 같은 포지션이면 기존 설정값이나
     적합도/능숙도 가장 상위버전이 기본값으로 되어 있었으면 좋겠어요」.
     기존 설정값(role → roleBy)은 위에서 이미 살렸다. 여기는 그마저 없을 때다 —
     고정 기본값(예: CM 은 무조건 중앙 미드필더·지원) 대신, 그 선수가 가장 능숙한
     역할(1순위 역할 능숙도 · 2순위 적합도 — rolesSortedFor 와 같은 기준)을 기본값으로 쓴다.
     매 호출 정렬은 엔진 안쪽에서 비싸므로 시즌·자리그룹 단위로 선수에 캐시한다. */
  try{
    const c=p._rDef;
    if(c && c.g===g && c.s===G.season) return {r:c.r, d:c.d};
    const best=rolesSortedFor(p, slot)[0];
    if(best){
      const rd={r:best.k, d:(best.duty&&best.duty[0])||"S"};
      p._rDef={g:g, s:G.season, r:rd.r, d:rd.d};
      return rd;
    }
  }catch(e){}
  const d=ROLE_DEFAULT[g]||["CM","S"];
  return {r:d[0], d:d[1]};
}
/* 감독이 직접 고른 역할을 선수에게 기억시킨다 — 그 역할이 유효한 자리 그룹 전체에 */
function rememberRole(t, pid, rk, dk){
  const R=ROLE_BY_KEY[rk]; if(!t||!t.tactic||!R) return;
  const by=t.tactic.roleBy||(t.tactic.roleBy={});
  const m=by[pid]||(by[pid]={});
  for(const g of (R.grp||[])) m[g]={r:rk, d:dk};
}
/* 역할 적합도 — 그 역할이 요구하는 능력치로만 매긴다 (0~5) */
/* 역할 적합도 — 그 역할이 요구하는 능력치에서 리그 평균보다 얼마나 앞서는가.
   단순 평균을 쓰면 좋은 선수는 모든 역할이 4~4.5로 뭉개져 역할을 바꿔도 티가 안 난다.
   포지션 적합도와 같은 방식(수준 + 모양 분리)으로 계산한다. */
function roleFit(p, roleKey){
  const R=ROLE_BY_KEY[roleKey]; if(!R||!p) return 0;
  const a=p.attr||{}, g=p.gkA||{}, fb=p.ovr||65;
  const MM=attrMeans();
  const lvAbs=(p.pos==="GK") ? 0 : (playerLevel(p)-leagueLevel());
  const lv   =(p.pos==="GK") ? (playerLevel(p)-starRefLevel()) : (playerLevel(p)-starRefLevel());
  let shape=0, n=0;
  for(const k of R.key){
    const raw=(typeof g[k]==="number")?g[k]:(typeof a[k]==="number"?a[k]:fb);
    const mean=(MM.gm[k]!==undefined?MM.gm[k]:(MM.m[k]!==undefined?MM.m[k]:62));
    shape += (raw-mean) - lvAbs;
    n++;
  }
  // FM처럼 "실력이 먼저, 역할 적성은 보정"이다.
  // 모양에 큰 가중치를 주면 능력 56짜리가 포처 4.5★를 받는 일이 생긴다.
  // ovrStarVal 은 58~92 구간용이라 그대로 쓰면 하위 선수가 전부 바닥(0.5★)에 깔린다.
  // 역할 적합도는 자체 구간으로 매핑해 위아래 모두 변별력을 남긴다.
  /* 별점 기준선을 리그 전체로 옮기면서 역할 적합도만 후해졌다(측정: 4★ 이상이 리그의 56%).
     능력 별점과 눈금을 맞춘다 — 두 별이 어긋나면 어느 쪽을 믿어야 할지 알 수 없다. */
  const score = 62 + lv*ROLEFIT_Q + (n?shape/n:0)*ROLEFIT_S - ROLEFIT_LEAGUE_OFF;
  return starValFromScore(score);
}
function roleStars(v){
  const full=Math.floor(v), half=(v-full)>=0.5;
  return `<span style="color:var(--gold)">${"★".repeat(full)}${half?"☆":""}</span>`;
}
/* 역할+임무 → 엔진 효과 */
function roleFx(t, p, slot){
  const rd=getRole(t,p,slot); const R=ROLE_BY_KEY[rd.r];
  if(!R) return {};
  const fx=R.fx(rd.d)||{};
  // 적합도가 낮으면 역할을 제대로 소화하지 못한다 (FM 설명 그대로)
  const fit=roleFit(p, rd.r);
  /* 🎓 능력치가 맞아도 그 역할을 해본 적이 없으면 지시대로 움직이지 못한다.
     처음 맡는 역할은 전진 타이밍·서는 위치가 어긋나 지시 자체가 절반쯤만 먹힌다. */
  const rfam=getRoleFam(p, rd.r);
  const eff=clamp(0.45+fit/5*0.70, 0.45, 1.15) * roleFamMul(rfam);
  const out={};
  for(const k in fx) out[k]=fx[k]*eff;
  normalizeFx(out);
  out._role=rd.r; out._duty=rd.d; out._fit=fit; out._rfam=rfam;
  return out;
}
/* ── 선호 플레이 (Player Traits / Preferred Moves) ─────────────────────
   FM처럼 "능력치를 더 주는 게 아니라, 선택지 결정을 바꾸는" 성향이다.
   req(a,p) 가 부여 가능 조건, w 가 그 조건을 만족했을 때의 상대 가중치.
   fx 는 매치엔진이 읽는 효과 플래그(agent.tr 에 합산되어 들어간다). */
const TRAITS=[
// ── 온 더 볼
{k:"cutsInside", n:"양쪽 측면에서 중앙으로 침투", e:"Cuts Inside From Both Wings", c:"온 더 볼",
 req:(a,p)=>["LW","RW","LM","RM","LB","RB"].includes(p.prefPos)&&a.dri>=68&&a.tec>=65, w:3, fx:{cutIn:1}},
{k:"knocksPast", n:"공을 차놓고 상대를 제치는 것을 선호", e:"Knocks Ball Past Opponent", c:"온 더 볼",
 req:(a)=>a.pac>=78&&a.acc>=75, w:3, fx:{knockPast:1}},
{k:"runsRarely", n:"공을 드물게 드리블", e:"Runs With Ball Rarely", c:"온 더 볼",
 req:(a)=>a.dri<=48, w:2, fx:{dribble:-0.55}},
{k:"runsOften", n:"공을 자주 드리블", e:"Runs With Ball Often", c:"온 더 볼",
 req:(a)=>a.dri>=72&&a.tec>=68, w:4, fx:{dribble:0.55}},
{k:"runsLeft", n:"왼쪽 측면 돌파 선호", e:"Runs With Ball Down Left", c:"온 더 볼",
 req:(a,p)=>["LW","LM","LB"].includes(p.prefPos)&&a.dri>=65, w:2, fx:{wide:1}},
{k:"runsRight", n:"오른쪽 측면 돌파 선호", e:"Runs With Ball Down Right", c:"온 더 볼",
 req:(a,p)=>["RW","RM","RB"].includes(p.prefPos)&&a.dri>=65, w:2, fx:{wide:1}},
{k:"runsCentre", n:"경기장 중앙으로 드리블함", e:"Runs With Ball Through The Center", c:"온 더 볼",
 req:(a,p)=>a.dri>=72&&a.bal>=70&&["ST","CM","LW","RW"].includes(p.prefPos), w:2, fx:{cutIn:1}},
{k:"stopsPlay", n:"공을 가지면 잠시 멈추는 플레이 선호", e:"Stops Play", c:"온 더 볼",
 req:(a)=>a.str>=66&&a.bal>=64&&a.tea>=62, w:2, fx:{hold:0.9}},
{k:"crossEarly", n:"얼리 크로스", e:"Crosses Early", c:"온 더 볼",
 req:(a,p)=>a.crs>=70&&["LB","RB","LM","RM","LW","RW"].includes(p.prefPos), w:3, fx:{earlyCross:1}},
/* 🎯 제보 — 「찬스에서 패스보다 크로스를 선호하는 특성이 있으면 전술의 폭이 넓어질 것 같다」.
   측면에서 공을 잡았을 때 「한 번 더 줄까, 올릴까」의 저울을 크로스 쪽으로 기울인다.
   크로스 능력이 진짜 강점인 선수(패스보다 크로스가 좋은)에게만 붙는다. */
{k:"prefCross", n:"찬스에서 패스보다 크로스 선호", e:"Looks For Cross Rather Than Pass", c:"온 더 볼",
 req:(a,p)=>a.crs>=68 && a.crs>=(a.pas||0)-4
   && ["LB","RB","LWB","RWB","LM","RM","LW","RW","CM","CAM"].includes(p.prefPos),
 w:3, fx:{crossFirst:1, cross:0.5}},
// ── 공격시 위치 선정 (오프 더 볼)
{k:"arrivesLate", n:"페널티 박스에 한 박자 늦게 침투", e:"Arrives Late In Opposition Area", c:"공격시 위치 선정",
 req:(a,p)=>["CM"].includes(p.prefPos)&&a.otb>=68&&a.fin>=60, w:2, fx:{lateRun:1}},
{k:"comesDeep", n:"공을 받기 위해 포지션보다 내려옴", e:"Comes Deep To Get Ball", c:"공격시 위치 선정",
 req:(a,p)=>a.pas>=72&&a.vis>=70&&p.pos!=="DF", w:3, fx:{deep:1}},
{k:"getsForward", n:"가능할 때마다 최전방으로 침투 선호", e:"Gets Forward Whenever Possible", c:"공격시 위치 선정",
 req:(a,p)=>a.otb>=66&&a.wor>=68&&p.pos!=="GK", w:3, fx:{forward:0.55}},
{k:"getsIntoArea", n:"페널티 박스 안으로 침투 선호", e:"Gets Into Opposition Area", c:"공격시 위치 선정",
 req:(a,p)=>a.otb>=72&&(p.pos==="FW"||p.pos==="MF"), w:3, fx:{forward:0.75}},
{k:"hugsLine", n:"터치라인을 따라 움직이는 것을 선호", e:"Hugs Line", c:"공격시 위치 선정",
 req:(a,p)=>["LW","RW","LM","RM"].includes(p.prefPos)&&a.crs>=65, w:3, fx:{hugLine:1}},
{k:"breaksOffside", n:"오프사이드 트랩 돌파를 선호", e:"Likes To Try To Break Offside Trap", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.otb>=70&&a.pac>=72, w:3, fx:{breakLine:1}},
{k:"movesChannels", n:"수비수와 풀백 사이로 침투", e:"Moves Into Channels", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.otb>=68&&a.pac>=68, w:3, fx:{channels:1}},
{k:"boxPlayer", n:"페널티 지역 선수", e:"Penalty Box Player", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.fin>=68&&a.str>=62&&a.dri<=76, w:3, fx:{boxPlayer:1}},
{k:"oneTwos", n:"2대1 패스 선호", e:"Plays One-Twos", c:"공격시 위치 선정",
 req:(a)=>a.pas>=68&&a.tea>=70&&a.acc>=68, w:2, fx:{oneTwo:1}},
{k:"backToGoal", n:"골문을 등지는 것을 선호", e:"Plays With Back To Goal", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.str>=72&&a.fir>=68, w:2, fx:{hold:0.6}},
{k:"staysBack", n:"항상 후방에 있는 것을 선호", e:"Stays Back At All Times", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="DF"&&a.pos>=70, w:3, fx:{forward:-0.7}},
// ── 패스
{k:"dictatesTempo", n:"템포 조절 선호", e:"Dictates Tempo", c:"패스",
 req:(a)=>a.dec>=75&&a.vis>=75&&a.pas>=72, w:2, fx:{hold:0.5, killer:0.2}},
{k:"switchFlank", n:"공을 반대편 측면으로 보내는 것을 선호", e:"Likes To Switch Ball To Other Flank", c:"패스",
 req:(a)=>a.pas>=72&&a.vis>=72, w:2, fx:{switchPlay:1}},
/* ⚠ 제보 — 「미드필더·윙어·공격수에게 이 특성이 있으면 전술에 맞는 움직임이 나올 것 같다」.
   실측: 리그 1022명 중 보유 16명인데 그중 11명이 골키퍼·수비수였다. 정작 슛을 고르는
   자리에는 미드필더 3명뿐, 공격수는 0명. 요구조건(판단 14.8+ & 결정력 10.4-)이 공격 자원을
   통째로 걸러 냈고 가중치도 최저(w=1)였다.
   ─ 「마무리보다 만드는 쪽이 나은 선수」로 조건을 다시 세우고, 자리도 미드필더·공격수로 좁힌다. */
{k:"looksForPass", n:"득점보다는 패스하는 것을 선호", e:"Looks For Pass Rather Than Attempting To Score", c:"패스",
 req:(a,p)=>{
   if(p.pos!=="MF" && p.pos!=="FW") return false;
   if(a.dec<66 || a.vis<64 || a.pas<62) return false;
   /* 미드필더는 「마무리보다 패스가 나은」 정도면 되고, 공격수는 연결에 능한 유형이어야 한다
      — 폴스 나인·타깃맨처럼 등지고 받아 흘려 주는 선수들 */
   return p.pos==="MF" ? (a.pas-a.fin)>=8
                       : ((a.pas-a.fin)>=0 && a.vis>=68 && a.tea>=66);
 }, w:3, fx:{shoot:-0.55}},
{k:"noThroughBalls", n:"스루 패스하지 않는 것을 선호", e:"Plays No Through Balls", c:"패스",
 req:(a)=>a.vis<=48&&a.pas<=52, w:1, fx:{killer:-0.6}},
{k:"shortSimple", n:"짧고 간단한 패스 선호", e:"Plays Short Simple Passes", c:"패스",
 req:(a)=>a.pas>=60&&a.vis<=66, w:1, fx:{shortPass:1}},
{k:"killerBalls", n:"스루 패스를 자주 시도", e:"Tries Killer Balls Often", c:"패스",
 req:(a)=>a.vis>=72&&a.pas>=70, w:3, fx:{killer:0.7}},
{k:"longPasses", n:"긴 패스를 자주 시도", e:"Tries Long Range Passes", c:"패스",
 req:(a)=>a.pas>=72&&a.vis>=68, w:2, fx:{longPass:1}},
{k:"longThrowCounter", n:"역습 시 장거리 스로인 사용", e:"Uses Long Throw To Start Counter Attacks", c:"패스",
 req:(a)=>a.thr>=75, w:2, fx:{longThrow:1}},
// ── 골 결정력
{k:"overhead", n:"오버헤드킥을 시도", e:"Attempts Overhead Kicks", c:"골 결정력",
 req:(a)=>a.fin>=70&&a.fla>=72&&a.agi>=70&&a.bra>=70, w:1, fx:{overhead:1}},
{k:"fkPower", n:"프리킥시 강력한 슛 선호", e:"Hits Free Kicks With Power", c:"골 결정력",
 req:(a)=>a.fre>=72&&a.lon>=70, w:2, fx:{fkPower:1}},
{k:"lobKeeper", n:"골키퍼를 넘기는 로빙 슛 선호", e:"Likes To Lob Keeper", c:"골 결정력",
 req:(a)=>a.fin>=70&&a.cmp>=68&&a.tec>=68, w:2, fx:{lob:1}},
{k:"roundKeeper", n:"골키퍼를 제치는 것을 선호", e:"Likes To Round Keeper", c:"골 결정력",
 req:(a)=>a.dri>=72&&a.cmp>=70&&a.pac>=70, w:2, fx:{round:1}},
{k:"placesShots", n:"정확한 슛 선호", e:"Places Shots", c:"골 결정력",
 req:(a)=>a.fin>=68&&a.cmp>=68, w:3, fx:{place:1}},
{k:"noLongShots", n:"중거리 슛 자제", e:"Refrains From Taking Long Shots", c:"골 결정력",
 req:(a)=>a.lon<=48, w:1, fx:{longShot:-0.55}},
{k:"shootsDistance", n:"중거리 슛 선호", e:"Shoots From Distance", c:"골 결정력",
 req:(a)=>a.lon>=72, w:3, fx:{longShot:0.8}},
{k:"shootsPower", n:"강력한 슛 선호", e:"Shoots With Power", c:"골 결정력",
 req:(a)=>a.lon>=68&&a.str>=68, w:2, fx:{power:1}},
{k:"firstTime", n:"빠른 박자에 슛을 자주 시도", e:"Tries First Time Shots", c:"골 결정력",
 req:(a)=>a.fin>=68&&a.ant>=70&&a.tec>=68, w:2, fx:{firstTimeShot:1}},
{k:"longFK", n:"먼 거리에서 프리킥 시 슛을 자주 시도", e:"Tries Long Range Free Kicks", c:"골 결정력",
 req:(a)=>a.fre>=70&&a.lon>=70, w:1, fx:{longFK:1}},
// ── 규율
{k:"windsUp", n:"상대 선수를 거칠게 대하는 것을 선호", e:"Winds Up Opponents", c:"규율",
 req:(a)=>a.agg>=75, w:2, fx:{cardRisk:0.35}},
{k:"crowdGoing", n:"관중들을 열광시키는 행동 선호", e:"Gets Crowd Going", c:"규율",
 req:(a)=>a.fla>=72&&a.ldr>=65, w:1, fx:{}},
{k:"arguesRef", n:"심판과 언쟁하는 것을 선호", e:"Argues With Officials", c:"규율",
 req:(a)=>a.agg>=70&&a.cmp<=62, w:2, fx:{cardRisk:0.45}},
// ── 수비
{k:"divesIn", n:"슬라이딩 태클 선호", e:"Dives Into Tackles", c:"수비",
 req:(a,p)=>p.pos!=="GK"&&a.agg>=70&&a.bra>=70, w:3, fx:{slide:0.7}},
{k:"noDiveIn", n:"슬라이딩 태클을 하지 않는 것을 선호", e:"Does Not Dive Into Tackles", c:"수비",
 req:(a,p)=>p.pos!=="GK"&&a.dec>=72&&a.agg<=62, w:3, fx:{slide:-0.7}},
{k:"marksTight", n:"상대 선수를 단단히 마크", e:"Marks Opponent Tightly", c:"수비",
 req:(a,p)=>p.pos==="DF"&&a.mar>=72&&a.ant>=68, w:3, fx:{tightMark:1}},
// ── 개인기
/* 약발 관련 특성 두 개는 삭제했다. 약발(p.weak)이 화면 표시 말고는 아무 데도 쓰이지 않았고,
   weakFoot 효과 역시 매치엔진이 읽지 않아 "복잡하기만 하고 아무 일도 안 하는" 항목이었다. */
{k:"curls", n:"휘어차는 슛 선호", e:"Curls Ball", c:"개인기",
 req:(a)=>a.tec>=72&&a.fin>=65, w:2, fx:{curl:1}},
{k:"dwells", n:"공을 오래 소유하는 것을 선호", e:"Dwells On Ball", c:"개인기",
 req:(a)=>a.tec>=68&&a.cmp>=68&&a.dec<=68, w:2, fx:{hold:0.7}},
{k:"flatThrow", n:"빠르고 낮게 깔리는 스로인 구사", e:"Possesses Long Flat Throw", c:"개인기",
 req:(a)=>a.thr>=70, w:1, fx:{longThrow:1}},
{k:"playsOutTrouble", n:"위기 상황을 벗어나기 위해 개인기를 자주 시도", e:"Tries To Play Way Out Of Trouble", c:"개인기",
 req:(a)=>a.tec>=72&&a.cmp>=70, w:2, fx:{escape:1}},
{k:"bringsOut", n:"수비 진영에서 드리블하기", e:"Brings Ball Out Of Defence", c:"개인기",
 req:(a,p)=>p.pos==="DF"&&a.dri>=62&&a.cmp>=68, w:2, fx:{carryOut:1}},
{k:"beatsRepeatedly", n:"상대를 여러 차례 속이는 것을 선호", e:"Likes To Beat Opponent Repeatedly", c:"개인기",
 req:(a)=>a.dri>=75&&a.tec>=72&&a.fla>=70, w:2, fx:{dribble:0.45, repeatBeat:1}},
{k:"tricks", n:"현란한 개인기를 자주 시도", e:"Tries Tricks", c:"개인기",
 req:(a)=>a.fla>=75&&a.tec>=72, w:2, fx:{dribble:0.35}},
{k:"ballToFeet", n:"패스를 발밑으로 받는 것을 선호", e:"Likes Ball Played Into Feet", c:"개인기",
 req:(a)=>a.fir>=72, w:2, fx:{toFeet:1}},
{k:"outsideFoot", n:"아웃프론트킥 선호", e:"Uses Outside Of Foot", c:"개인기",
 req:(a)=>a.tec>=75&&a.fla>=70, w:1, fx:{curl:1}},
{k:"gkFeet", n:"발로 공을 다룸", e:"Plays Ball With Feet", c:"개인기",
 req:(a,p)=>p.pos==="GK"&&a.pas>=55, w:4, fx:{gkSweeper:1}},
// ── 🛡️ 중원 규율 (제보 — 수비형·중앙 미드필더의 전술적 습관)
/* 「자리를 지키는 미드필더」가 게임 안에 없었다. 중원은 죄다 공을 따라 움직이거나
   전진할 뿐이어서, 4-2-3-1 의 두 피벗과 3-5-2 의 수미가 서로 구분되지 않았다.
   FM 의 Stays/Marks/Covers 계열을 셋 만들고 엔진의 움직임에 직접 연결한다. */
{k:"holdsPos", n:"현재 위치를 고수", e:"Holds Position", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="MF"&&a.pos>=60&&a.dec>=60&&a.tea>=58, w:4,
 fx:{roam:-0.9, stayPos:1, forward:-0.30, press:-0.20}},
{k:"marksMid", n:"중원에서 상대를 단단히 마크", e:"Marks Opponents Tightly", c:"수비",
 req:(a,p)=>p.pos==="MF"&&a.mar>=60&&a.ant>=58&&a.wor>=60, w:4, fx:{tightMark:0.85, press:0.15}},
{k:"backFill", n:"역습 시 수비진 숫자를 맞춘다", e:"Drops Into Defensive Line", c:"수비",
 req:(a,p)=>p.pos==="MF"&&a.pos>=62&&a.dec>=60&&(a.mar>=56||a.tck>=56)&&a.hea>=52, w:4,
 fx:{backFill:1, forward:-0.15}},
// ── 🧤 골키핑 — 골키퍼만 갖는 특성
/* 골키퍼는 특성 후보가 「발로 공을 다룸」 하나뿐이라 사실상 전원이 무특성이었다.
   실제 키퍼의 색깔이 갈리는 지점들 — 나오는가 / 잡는가 펀칭인가 / 킥이 긴가 /
   페널티에 강한가 / 뒷선을 지휘하는가 — 을 특성으로 만든다. */
{k:"gkSweep", n:"적극적으로 뛰어나옴", e:"Rushes Out Of Goal", c:"골키핑",
 req:(a,p)=>p.pos==="GK"&&((a.cmd>=62)||(a.tro>=62)||(a.pas>=62&&a.cmd>=56)), w:3, fx:{gkSweeper:1, gkOut:1}},
{k:"gkStayLine", n:"골라인을 좀처럼 벗어나지 않음", e:"Stays On Goal Line", c:"골키핑",
 req:(a,p)=>p.pos==="GK"&&a.tro<=52&&a.cmd<=60, w:2, fx:{gkOut:-0.8}},
{k:"gkPunches", n:"캐치보다 펀칭을 선호", e:"Punches Rather Than Catches", c:"골키핑",
 req:(a,p)=>p.pos==="GK"&&(a.pun>=64||a.han<=58), w:3, fx:{gkFist:1}},
{k:"gkSafeHands", n:"공을 품에 안는다", e:"Holds Onto Ball", c:"골키핑",
 req:(a,p)=>p.pos==="GK"&&a.han>=68&&a.cnt>=62, w:3, fx:{gkFist:-0.9}},
{k:"gkLongKick", n:"골킥을 길게 찬다", e:"Kicks Long", c:"골키핑",
 req:(a,p)=>p.pos==="GK"&&a.kic>=66, w:3, fx:{gkLong:1}},
{k:"gkPenKing", n:"페널티킥에 강하다", e:"Saves Penalties Well", c:"골키핑",
 req:(a,p)=>p.pos==="GK"&&a.ref>=68&&a.ant>=64, w:2, fx:{gkPen:1}},
{k:"gkCommands", n:"수비 라인을 소리로 지휘", e:"Commands Defence", c:"골키핑",
 req:(a,p)=>p.pos==="GK"&&a.com>=66&&a.cmd>=60, w:3, fx:{gkCmd:1}}
];
const TRAIT_BY_KEY={}; for(const t of TRAITS) TRAIT_BY_KEY[t.k]=t;
/* ═══ 🧩 특성 자리 분류 — 공격수 · 미드필더 · 수비수 · 골키퍼 ═════════
   FM 의 특성은 「어느 자리 선수에게 어울리는가」가 분명하다. 예전에는 능력치 조건만 보고
   뽑아서, 수비수가 「골키퍼를 넘기는 로빙 슛 선호」를 갖고 태어나거나 골키퍼가
   「득점보다 패스」를 갖는 일이 있었다(실측: 리그 1022명 중 골키퍼 특성 보유 11명이 그 사례).
   배열 첫 자리가 「대표 자리」다 — 그 자리 선수에게는 뽑힐 확률이 크게 올라간다. */
const TRAIT_GRP={
  // 🗡️ 공격수
  breaksOffside:["FW"], movesChannels:["FW"], boxPlayer:["FW"], backToGoal:["FW"],
  overhead:["FW"], lobKeeper:["FW","MF"], roundKeeper:["FW","MF"], placesShots:["FW","MF"],
  firstTime:["FW","MF"], curls:["FW","MF"], dwells:["FW","MF"], tricks:["FW","MF"],
  beatsRepeatedly:["FW","MF"], getsIntoArea:["FW","MF"], runsCentre:["FW","MF"],
  stopsPlay:["FW","MF"], knocksPast:["FW","MF","DF"], runsOften:["FW","MF","DF"],
  shootsPower:["FW","MF","DF"], cutsInside:["FW","MF"], ballToFeet:["FW","MF","DF"],
  outsideFoot:["FW","MF","DF"],
  // ⚙️ 미드필더
  dictatesTempo:["MF"], arrivesLate:["MF"], killerBalls:["MF","FW"], comesDeep:["MF","FW"],
  oneTwos:["MF","FW"], switchFlank:["MF","DF"], longPasses:["MF","DF","GK"],
  shootsDistance:["MF","FW"], fkPower:["MF","FW","DF"], longFK:["MF","DF","FW"],
  looksForPass:["MF","FW"], getsForward:["MF","DF"], hugsLine:["MF","FW","DF"],
  runsLeft:["MF","DF","FW"], runsRight:["MF","DF","FW"], crossEarly:["MF","DF"],
  prefCross:["MF","DF","FW"],
  playsOutTrouble:["MF","DF","FW"], shortSimple:["MF","DF"],
  // 🛡️ 수비수
  staysBack:["DF"], marksTight:["DF","MF"], bringsOut:["DF"], divesIn:["DF","MF"],
  /* 🛡️ 중원 규율 — 대표 자리는 미드필더 */
  holdsPos:["MF"], marksMid:["MF"], backFill:["MF"],
  noDiveIn:["DF","MF"], noThroughBalls:["DF","MF"], noLongShots:["DF","MF","FW"],
  runsRarely:["DF","MF","FW"], windsUp:["DF","MF","FW"],
  longThrowCounter:["DF","MF"], flatThrow:["DF","MF"],
  // 🧤 골키퍼
  gkFeet:["GK"], gkSweep:["GK"], gkStayLine:["GK"], gkPunches:["GK"],
  gkSafeHands:["GK"], gkLongKick:["GK"], gkPenKing:["GK"], gkCommands:["GK"],
  // 🎭 자리를 가리지 않는다
  crowdGoing:["FW","MF","DF","GK"], arguesRef:["DF","MF","FW","GK"]
};
const TRAIT_GRP_KO={FW:"공격수", MF:"미드필더", DF:"수비수", GK:"골키퍼"};
function traitGroups(k){ return TRAIT_GRP[k] || ["FW","MF","DF"]; }
function traitHomeGrp(k){ return traitGroups(k)[0]; }
/* 이 선수의 자리에서 가질 수 있는 특성인가 */
function traitGrpOK(p, k){
  if(!p) return false;
  const g=traitGroups(k);
  return g.indexOf(p.pos)>=0;
}
/* 서로 모순되는 특성은 같이 붙지 않는다 */
const TRAIT_CONFLICT=[
  ["runsOften","runsRarely"], ["shootsDistance","noLongShots"], ["killerBalls","noThroughBalls"],
  ["divesIn","noDiveIn"], ["getsForward","staysBack"], ["getsIntoArea","staysBack"],
  /* 「득점보다 패스」와 「직접 해결하는」 성향은 같이 붙을 수 없다 */
  ["looksForPass","shootsDistance"], ["looksForPass","boxPlayer"], ["looksForPass","firstTime"],
  /* 🧤 골키핑 — 서로 반대되는 습관 */
  ["gkSweep","gkStayLine"], ["gkPunches","gkSafeHands"],
  /* 🛡️ 자리를 지키는 습관과 「앞으로 나가는」 습관은 함께 붙지 않는다 */
  ["holdsPos","getsForward"], ["holdsPos","getsIntoArea"], ["holdsPos","arrivesLate"],
  ["holdsPos","runsCentre"], ["backFill","getsForward"], ["backFill","getsIntoArea"],
  ["boxPlayer","movesChannels"], ["boxPlayer","comesDeep"], ["hugsLine","cutsInside"],
  ["runsLeft","runsRight"], ["shortSimple","longPasses"],
  ["looksForPass","shootsDistance"], ["comesDeep","getsIntoArea"], ["placesShots","shootsPower"]
];
/* 선수 특성(Player Traits) — 능력치가 특출나면 붙는다 */
/* 🧩 대분류가 바뀐 뒤 특성 정리 — 능숙도 기준으로 pos 가 옮겨지면(syncPosBand)
   그 전에 뽑아 둔 특성이 자리와 어긋난다. 어긋난 것만 걷어내고 그만큼 다시 채운다. */
function retuneTraits(p){
  if(!p || !Array.isArray(p.traits) || !p.traits.length) return 0;
  const okOne=(k)=>{
    const T=TRAIT_BY_KEY[k]; if(!T) return false;
    if(!traitGrpOK(p, k)) return false;
    try{ if(typeof traitPosOK==="function" && !traitPosOK(p, T)) return false; }catch(e){}
    return true;
  };
  const keep=p.traits.filter(okOne);
  const lost=p.traits.length-keep.length;
  if(!lost) return 0;
  p.traits=keep;
  try{
    const cand=genTraits(p.pos, p.attr||{}, p);
    for(const k of cand){
      if(p.traits.length>=Math.min(TRAIT_MAX, keep.length+lost)) break;
      if(p.traits.includes(k)) continue;
      if(TRAIT_CONFLICT.some(([x,y])=>(x===k&&p.traits.includes(y))||(y===k&&p.traits.includes(x)))) continue;
      p.traits.push(k);
    }
  }catch(e){}
  return lost;
}
/* 자리별 「축 평균」 — 특성 개수를 정할 때 이 값을 기준으로 같은 눈금에 올린다 */
const TR_KEY_BASE={GK:70, DF:80, MF:73, FW:74};
const TR_HOME_W=2.6;      // 「대표 자리」가 맞으면 가중치 배수
const TR_SIDE_W=0.85;     // 어울리지만 대표 자리는 아닐 때
function genTraits(pos, a, p){
  // 조건을 만족하는 특성 중에서 가중 추첨. 능력치가 평범하면 특성도 적게 붙는다.
  const self = p || {pos, prefPos:pos, by:1998};
  /* 🧤 골키퍼 특성의 조건은 골키퍼 능력치(gkA)를 본다 — 필드 능력치만 넘기면
     cmd·han·kic·ref 가 undefined 라 조건이 전부 거짓이 되어 특성이 하나도 안 붙었다. */
  const ra = (self.pos==="GK" && p && p.gkA) ? Object.assign({}, a||{}, p.gkA) : (a||{});
  const pool=[];
  for(const t of TRAITS){
    /* 🧩 자리 분류 — 어울리지 않는 자리에는 아예 붙지 않는다.
       (예전엔 능력치 조건만 봐서 골키퍼가 「득점보다 패스」를, 수비수가 로빙 슛 선호를 가졌다) */
    if(!traitGrpOK(self, t.k)) continue;
    try{ if(typeof traitPosOK==="function" && !traitPosOK(self, t)) continue; }catch(e){}
    let ok=false;
    try{ ok=!!t.req(ra, self); }catch(e){ ok=false; }
    if(ok) pool.push(t);
  }
  if(!pool.length) return [];
  // 특성 개수 — 실제 FM처럼 대부분 0~3개, 뛰어난 선수일수록 많다
  /* 🧤 골키퍼는 필드 능력치로 재면 언제나 「평범」이라 특성이 거의 안 붙었다 — 키퍼는 키퍼 능력치로 잰다 */
  const g=(self.pos==="GK") ? ((p&&p.gkA)||{}) : null;
  const _v=(k,d)=>{ const x=(a&&a[k]); return (typeof x==="number")?x:(d||60); };
  /* 🧩 자리마다 「잘하는 것」이 다르다 — 수비수를 마무리·드리블로 재면 언제나 평범해져
     특성이 거의 안 붙었다(실측 DF 평균 0.54 vs MF 0.92). 각 자리의 축으로 잰다. */
  const axis = g
    ? (((g.ref||60)+(g.han||60)+(g.cmd||60)+(g.kic||60)+_v("ant")+_v("cnt"))/6)
    : self.pos==="DF" ? ((_v("mar")+_v("tck")+_v("pos")+_v("str")+_v("jum")+_v("hea"))/6)
    : self.pos==="MF" ? ((_v("pas")+_v("vis")+_v("dec")+_v("tec")+_v("wor")+_v("dri"))/6)
    : self.pos==="FW" ? ((_v("fin")+_v("otb")+_v("dri")+_v("tec")+_v("pac")+_v("acc"))/6)
    : ((_v("tec")+_v("dri")+_v("pas")+_v("fin")+_v("mar")+_v("pac"))/6);
  /* 축마다 평균이 다르다(실측 GK 70 · DF 80 · MF 73 · FW 74) — 그대로 쓰면 수비수만
     특성 부자가 된다. 자리별 평균을 빼서 같은 눈금으로 맞춘다. */
  const key = axis - (TR_KEY_BASE[self.pos]!=null?TR_KEY_BASE[self.pos]:73) + 70;
  let n=0; const roll=Math.random();
  if(key>=78) n = roll<0.12?1:roll<0.45?2:roll<0.80?3:4;
  else if(key>=66) n = roll<0.25?0:roll<0.60?1:roll<0.88?2:3;
  else n = roll<0.55?0:roll<0.87?1:2;
  const out=[];
  let bag=pool.slice();
  const wOf=(t)=>{
    const gg=traitGroups(t.k);
    const home=(gg[0]===self.pos);
    const only=(gg.length===1);
    /* 자기 자리의 특성이 훨씬 잘 붙는다. 그 자리 전용 특성이면 더더욱 */
    return t.w * (home ? (only?TR_HOME_W*1.25:TR_HOME_W) : TR_SIDE_W);
  };
  while(out.length<n && bag.length){
    let tot=0; for(const t of bag) tot+=wOf(t);
    let r=Math.random()*tot, pickT=bag[bag.length-1];
    for(const t of bag){ r-=wOf(t); if(r<=0){ pickT=t; break; } }
    out.push(pickT.k);
    bag=bag.filter(t=>t.k!==pickT.k && !TRAIT_CONFLICT.some(c=>
      (c[0]===pickT.k&&c[1]===t.k)||(c[1]===pickT.k&&c[0]===t.k)));
  }
  return out;
}
/* 특성 → 매치엔진 효과 플래그 묶음 */
/* 특성 + 역할을 합친 효과값을 읽는다. 엔진 곳곳의 (a.tr||{}).x 를 대체한다. */
/* ⚡ 예전엔 tr·role 이 비면 빈 객체 {} 를 두 개씩 새로 만들었다 — 틱당 수백 개. 값은 완전히 같다. */
function FX(a, k){
  if(!a) return 0;
  const t=a.tr, r=a.role;
  return ((t && t[k]) || 0) + ((r && r[k]) || 0);
}
/* ══════════════════════════════════════════════════════════════════
   🎛️ BEHAVIOR MODIFIER — fwd / wide / press / tightMark 를 읽는 단 하나의 창구.
   이 네 값은 「선수가 어디로 갈 것인가」가 아니라 「무엇을 더 하고 싶어하는가」다.
   여기를 거치게 해 두면, 나중에 소비 방식을 바꿀 때 읽는 곳을 다시 찾지 않아도 된다.

   ⚠ 지금은 동작을 바꾸지 않는다. 각 소비처가 「오늘 읽던 값 그대로」를 돌려준다.
      r* = 역할만(a.role)  ·  f* = 역할+특성(FX)
   ⚠ 발견 — 이동 로직은 fwd/wide/press 를 「역할만」 읽고, tightMark 만 FX 로 읽는다.
      그래서 fwd/wide 축으로 정규화되는 특성(forward·cutIn·hugLine·deep·boxPlayer·lateRun)이
      선수의 움직임에는 전혀 닿지 않는다. 이 불일치는 다음 단계에서 정리한다. */
/* ⚡ 역할(a.role)·특성(a.tr) 객체는 경기 내내 그대로다 — 그런데 선수마다 매 틱 새 객체를
   만들고 FX 를 네 번 불렀다. 두 객체의 <b>정체</b>가 같으면 결과도 같으므로 그대로 돌려준다.
   ⚠ 돌려받은 객체를 고치지 말 것(읽기 전용 — 모든 소비처가 읽기만 하는 것을 확인했다). */
function roleBias(a){
  const R=(a&&a.role)||null, TR=(a&&a.tr)||null;
  const c=a&&a._rbC;
  if(c && c.r===R && c.t===TR) return c.v;
  const v={
    rFwd:   (R&&R.fwd)||0,   rWide:  (R&&R.wide)||0,  rPress: (R&&R.press)||0,
    fFwd:   FX(a,"fwd"),     fWide:  FX(a,"wide"),    fPress: FX(a,"press"),
    fMark:  FX(a,"tightMark")
  };
  if(a) a._rbC={r:R, t:TR, v};
  return v;
}
/* 특성이 경기에서 갖는 무게.
   훈련으로 직접 골라 붙이는 것이 된 이상, 하나 붙였을 때 "달라졌다"는 느낌이 있어야 한다.
   역할(role) 효과와 같은 축에 더해지므로 과하게 올리면 역할이 묻힌다 — 25%만 올린다. */
const TRAIT_FX_K=1.25;
function traitFx(keys){
  const fx={};
  for(const k of (keys||[])){
    const t=TRAIT_BY_KEY[k]; if(!t) continue;
    /* 🎛️ 에디터의 특성 계수 튠 — 매치엔진에서 특성이 플레이에 얼마나 세게 묻어나는가 */
    const K=TRAIT_FX_K * (typeof meTune==="function" ? meTune("trait") : 1);
    for(const f in t.fx) fx[f]=(fx[f]||0)+t.fx[f]*K;
  }
  return normalizeFx(fx);
}
/* 이름만 다른 같은 축을 합친다. 이걸 안 하면 특성의 forward 가 역할의 fwd 와 따로 놀아 무시된다. */
function normalizeFx(fx){
  const add=(k,v)=>{ if(v) fx[k]=(fx[k]||0)+v; };
  add("fwd", fx.forward||0);            delete fx.forward;
  add("wide", -(fx.cutIn||0)*0.45);     // 안으로 파고들기 → 좌우 축 음수
  add("wide", (fx.hugLine||0)*0.50);    // 터치라인 붙기 → 좌우 축 양수
  add("fwd", -(fx.deep||0)*0.40);       // 내려와서 받기
  add("fwd", (fx.boxPlayer||0)*0.18);   // 박스 안에 머물기
  add("wide", -(fx.boxPlayer||0)*0.30);
  add("sweep", (fx.gkSweeper||0)*0.55); // 발로 공을 다루는 키퍼
  add("sweep", (fx.gkOut||0)*0.65);     // 🧤 적극적으로 뛰어나옴 / 골라인을 지킴
  add("fwd", (fx.lateRun||0)*0.20);
  add("dribble", (fx.carryOut||0)*0.35);  // 수비진에서 몰고 나오기 → 운반 성향
  add("fwd",     (fx.carryOut||0)*0.10);
  return fx;
}
/* 통산 출장 추정 — 게임을 시작하는 순간 30세 베테랑에게도 "지난 커리어"가 있어야 한다.
   0이면 아직 프로 데뷔를 하지 않은 선수(유스·신인)이고, 첫 출전이 곧 데뷔전 기사가 된다. */
function careerGuess(p){
  const age=((G&&G.season)||2026)-(p.by||2000);
  if(age<=18) return 0;
  return Math.max(0,(age-18))*(10+R(16));
}
/* bio = {no, h, w, bd} — 실제 등록 선수의 등번호·신장·체중·생년월일.
   없으면(자동 생성 선수) 종전처럼 genBody가 몸을 만들어 준다. */
function mkPlayer(name,pos,by,ovr,frn,bio){
  const p = {id:PID++, uid:nextGenUid(), name, pos, by, ovr, frn:!!frn,
    pot: clamp(ovr + (by>=2002? 4+R(8) : R(3)), ovr, 92),
    cond: 90+R(11), morale: 64+R(15), inj: 0,
    pers: R(4), unhappy:0, uWhy:"", talkR:-9, promise:null, sulk:0, noMove:false, ct:1+R(3),
    aff: AFF_DEF-6+R(13),          // 감독 개인 호감도 — 처음에는 대체로 중립
    apps:0, goals:0, assists:0, seasonRating:0, rTot:0,
    career:careerGuess({by}),       // 통산 출장 — 0이면 아직 프로 데뷔 전
    wage: wageExpect(ovr,frn),
    attr: genAttrsFM(pos, ovr), gkA:null, gk:null };
  const body=genBody(pos, p.attr);
  // 실제 신체 정보가 있으면 그걸 쓴다. 키는 아래에서 점프·헤딩에 그대로 반영되므로,
  // 194cm 골키퍼가 점프 낮게 나오는 일이 없도록 반드시 이 시점에 덮어써야 한다.
  p.h=(bio&&bio.h)||body.h; p.w=(bio&&bio.w)||body.w;
  if(bio){ if(bio.no) p.no=bio.no; if(bio.bd) p.bd=bio.bd; }
  // 신장은 헤더·점프에 실제로 영향을 준다 (FM 설명 그대로: 키 200/점프 20 == 키 180/점프 20,
  // 다만 큰 선수가 그 점프력에 도달하기 쉽다)
  const tall=clamp((p.h-178)/22, -1, 1);
  p.attr.jum=clamp(Math.round(p.attr.jum+tall*6),15,99);
  p.attr.hea=clamp(Math.round(p.attr.hea+tall*5),15,99);
  applyHeightBody(p);      // 큰 키가 주는 대가 — 민첩성·균형·가속·개인기
  syncLegacyAttrs(p.attr);
  if(pos==="GK"){ p.gkA=genGkAttrsFM(ovr, p.h); syncLegacyGk(p); }
  // 포지션 특화 — 안 쓰는 능력치를 깎아 핵심으로 옮긴다. 골키퍼 능력치가 생긴 뒤에 돌려야 한다.
  applySpecialization(p);
  // 나이를 먹은 몸으로 만들어 준다 — 서른을 넘긴 선수가 스무 살의 주력을 갖고 있으면 안 된다.
  // 선호 포지션·특성 추론보다 먼저 해야, 다 죽은 발로 "폭발적인 스피드" 특성을 받는 일이 없다.
  applyAgeDecline(p, (typeof G!=="undefined" && G && G.season ? G.season : 2026)-(by||2000));
  // 선호 포지션 기본값(능력치 기반 추론) — 실명 등록 선수는 mkTeam에서 실제 포지션으로 다시 덮어쓴다
  p.prefPos = inferPrefPos(p);
  p.traits=genTraits(pos, p.attr, p);   // 특성 조건이 선호 포지션을 보므로 그 뒤에 뽑는다
  p.posFam=initPosFam(p);
  return p;
}
function genName(){ return pick(FAM)+pick(GIV); }
const FRN_NAMES=["카를로스","치아구","하파엘","마르코스","브루노","지에구","루카스","마테우스","펠리피","조나탄","이고르","알렉스","레안드로","무리치","바그네르","에두아르도","조르당","안드리고","니콜라스","다닐로"];
function genFrnName(){ return pick(FRN_NAMES); }
function genSquad(base){
  const out=[]; const posNeed=[["GK",3],["DF",8],["MF",7],["FW",6]];
  for(const [pos,n] of posNeed){
    for(let i=0;i<n;i++){
      const by = 1990+R(15);
      let ovr = base-4+R(8); if(by>=2004) ovr=Math.min(ovr, base-2);
      // 외국인 (2026 등록 무제한 — GK 포함): FW/MF 일부 + 낮은 확률로 GK
      const frn = (pos==="FW"&&i<2&&Math.random()<0.5)||(pos==="MF"&&i===0&&Math.random()<0.3)||(pos==="GK"&&i===1&&Math.random()<0.12);
      out.push([frn?genFrnName():genName(),pos,by,clamp(ovr+(frn?2:0),55,base+5),frn?1:0]);
    }
  }
  // 유망주 두 명
  out.push([genName(),"MF",2005,base-6+R(4)]);
  out.push([genName(),"FW",2005,base-6+R(4)]);
  return out;
}
/* =====================================================
   선수별 선호 포지션 (FM처럼 — 포메이션 배치가 선호 포지션과 얼마나 맞는지 표시하는 데 쓰인다)
   실존 선수(각 구단 명단에 실명으로 등록된 선수)는 실제 알려진 주 포지션을 기준으로 지정하고,
   그 외(자동 생성 유스/후보 선수 등)는 능력치 프로필을 바탕으로 자연스럽게 추론한다.
   선호 포지션 값은 CB/LB/RB(수비), CM/LM/RM(미드필더), ST/LW/RW(공격수), GK 중 하나다.
===================================================== */
const PREF_POS_OVERRIDE={};
function addPref(teamId, list){ for(const [n,pos] of list) PREF_POS_OVERRIDE[teamId+":"+n]=pos; }
addPref("ulsan", [["조현우","GK"],["황병근","GK"],["최주호","GK"],
  ["김영권","CB"],["정승현","CB"],["서명관","CB"],["이재익","CB"],["트로야크","CB"],["윤종규","RB"],["강상우","LB"],["조현택","LB"],["심상민","LB"],["토마스","CB"],
  ["보야니치","CM"],["이규성","CM"],["이진현","CM"],["이동경","RW"],["이희균","LW"],["류성민","CM"],["박우진","CM"],["조민서","CM"],
  ["말컹","ST"],["야고","ST"],["에릭","ST"],["페드링요","RW"],["벤지","LW"],["장시영","RW"],["이민혁","CM"],["허율","ST"],["정재상","ST"],["최석현","LB"]]);
addPref("jeonbuk", [["송범근","GK"],["이주현","GK"],["전지완","GK"],
  ["박지수","CB"],["연제운","CB"],["김영빈","CB"],["조위제","CB"],["김태환","RB"],["김태현","LB"],["최우진","LB"],["이상명","LB"],["김하준","CB"],
  ["이영재","CM"],["맹성웅","CM"],["김진규","CM"],["감보아","CM"],["강상윤","CM"],["츄마시","RW"],["기티스","LW"],["김준영","CM"],["도도","CAM"],
  ["이승우","LW"],["티아고","ST"],["콤파뇨","ST"],["이동준","RW"],["모따","ST"],["김승섭","RW"],["박주영","ST"],["정대영","ST"],["이한결","CM"]]);
addPref("daejeon", [["이창근","GK"],["이준서","GK"],["김민수","GK"],
  ["안톤","CB"],["김문환","RB"],["하창래","CB"],["이명재","LB"],["김민덕","CB"],["서영재","LB"],["강윤성","RB"],["박규현","LB"],["조성권","CB"],["김진야","LB"],["임종은","CB"],["오재석","RB"],
  ["이순민","CM"],["이현식","CM"],["밥신","CM"],["마사","CAM"],["서진수","LW"],["김준범","CM"],["김봉수","DM"],["김현욱","CAM"],
  ["주민규","ST"],["디오고","ST"],["엄원상","RW"],["루빅손","LW"],["주앙 빅토르","RW"],["정재희","RW"],["유강현","ST"],["구훈민","ST"],["김지호","ST"]]);
addPref("gimcheon", [["박용희","ST"],["김서진","CB"],["정마호","DM"],["백종범","GK"],["문현호","GK"],["안준수","GK"],
  ["이정택","CB"],["민경현","LB"],["김현우","CB"],["박철우","RB"],["변준수","CB"],["이찬욱","LB"],["박민서","CB"],["박진성","CM"],["김태환","RB"],
  ["이수빈","CM"],["박태준","CM"],["김이석","CM"],["임덕근","CM"],["전병관","CAM"],["노경호","CM"],["윤재석","CM"],["박세진","CM"],
  ["고재현","ST"],["홍윤상","RW"],["김인균","LW"],["홍시후","RW"],["이건희","ST"],["이상헌","ST"],["강민규","LW"],["김주찬","ST"],["정재민","ST"],["강주혁","ST"]]);
addPref("gangwon", [["박청효","GK"],["김정훈","GK"],["조민규","GK"],
  ["이유현","RB"],["강투지","CB"],["홍철","LB"],["박호영","CB"],["조원우","CB"],["송준석","LB"],["강준혁","RB"],["정승빈","CB"],["김태혁","CB"],
  ["서민우","CM"],["김동현","CM"],["이승원","CM"],["이기혁","CB"],["카림","CM"],["강윤구","CAM"],["김태환","CM"],["최재혁","CM"],
  ["김대원","LW"],["고영준","RW"],["모재현","ST"],["김건희","ST"],["제시","ST"],["아부달라","ST"],["최병찬","RW"],["박상혁","ST"],["김도현","ST"],["이지호","ST"]]);
addPref("gwangju", [["김경민","GK"],["노희동","GK"],["이윤성","GK"],
  ["반 흐룬스벤","CB"],["김진호","RB"],["이민기","LB"],["안영규","CB"],["임승겸","CB"],["민상기","CB"],["박원재","LB"],["장석환","RB"],["곽성훈","CB"],
  ["최경록","CM"],["주세종","CM"],["정지훈","LW"],["유제호","CM"],["김동화","CM"],["김용혁","CB"],["강희수","CM"],
  ["아이데일","ST"],["사이토스키","ST"],["프리드욘슨","ST"],["주앙 페드로","CB"],["바 루아","LW"],["하승운","LW"],["권성윤","RW"],["신창무","LW"],["문민서","CM"],["김우진","ST"]]);
addPref("seoul", [["구성윤","GK"],["강현무","GK"],["임준섭","GK"],
  ["김진수","LB"],["최준","RB"],["박수일","RB"],["야잔","CB"],["바베츠","DM"],["이상민","CB"],["이한도","CB"],["안재민","LB"],["박성훈","CB"],
  ["정승원","RW"],["이승모","CM"],["로스","CB"],["황도윤","CM"],["정현우","LW"],["김지원","CB"],["손정범","CM"],
  ["안데르손","RW"],["송민규","LW"],["클리말라","ST"],["조영욱","ST"],["후이즈","ST"],["천성훈","ST"],["문선민","RW"],["바또","RW"],["고필관","CM"],["윤기욱","ST"],["박장한결","CM"]]);
/* ⚠ 제보 — 「포항 구호진(김호진)이 키퍼로 돼 있다」.
   옛 수기 명단에는 GK 였는데 실제 등록은 센터백(#36)이다. 그런데 이 주포지션 표에
   GK 가 남아 있어서 능숙도가 GK 100 으로 깔리고, 대분류까지 골키퍼로 끌려갔다. */
addPref("pohang", [["황인재","GK"],["윤평국","GK"],["김호진","CB"],
  ["박찬용","CB"],["전민광","CB"],["조성욱","CB"],["어정원","RB"],["김동진","CM"],["신광훈","RB"],["김예성","CB"],["진시우","CB"],["이수아","LB"],
  ["기성용","CM"],["김승호","CM"],["김용학","CM"],["니시야 켄토","CM"],["김범준","CM"],["이창우","CM"],["강민준","RB"],["백승원","CM"],
  ["조르지","ST"],["주닝요","RW"],["완델손","LB"],["트란지스카","ST"],["안재준","ST"],["정한민","ST"],["황재환","ST"],["조상혁","ST"],["황서웅","ST"],["홍성민","ST"]]);
addPref("jeju", [["조인정","LB"],["아이아스","ST"],["김동준","GK"],["안찬기","GK"],["주승민","GK"],
  ["토비아스","CB"],["세레스틴","CB"],["정운","LB"],["임창우","RB"],["김륜성","LB"],["김재우","CB"],["장민규","CB"],["유인수","RB"],["김재민","CM"],["허강준","CB"],["박민재","RB"],
  ["이창민","CM"],["권창훈","CM"],["남태희","CM"],["김건웅","DM"],["오재혁","CM"],["권기민","CB"],["김준하","RW"],
  ["이탈로","CM"],["네게바","LW"],["박창준","RW"],["김신진","ST"],["신상은","ST"],["강동휘","DM"],["김이안","ST"],["허재원","ST"]]);
addPref("anyang", [["김태훈","GK"],["김다솔","GK"],["김성동","GK"],
  ["권경원","CB"],["이창용","CB"],["대니 바커","CB"],["김동진","LB"],["주현우","RB"],["김영찬","CB"],["김재현","RB"],["정준연","RB"],["홍재석","CB"],["김지훈","LB"],["채현우","CB"],
  ["유키치","CM"],["크네제비치","CM"],["박종현","CM"],["김정현","CM"],["문성우","CM"],["이진용","CM"],["김보경","CM"],["김정훈","CM"],["강지훈","LM"],["한가람","CM"],
  ["마테우스","ST"],["아일톤","ST"],["엘쿠라노","RW"],["최건주","ST"],["블레이즈","ST"],["김운","LW"],["박정훈","ST"],["오형준","ST"],["김강","ST"],["강지완","CB"]]);
addPref("incheon", [["레안드로","LW"],["김성민","RW"],["김동헌","GK"],["이태희","GK"],["김영환","CM"],
  ["정태욱","CB"],["후안 이비자","CB"],["김연수","CB"],["이주용","LB"],["김건희","CB"],["김명순","RB"],["이상기","RB"],["서재민","CM"],["박경섭","CB"],["오준엽","CM"],
  ["이명주","CM"],["이케르","CM"],["문지환","CM"],["이청용","LW"],["정원진","CM"],["오후성","LW"],["고정민","CB"],["여승원","LB"],["강영훈","CB"],["왕민준","CM"],
  ["무고사","ST"],["제르소","RW"],["이동률","RW"],["페리어","ST"],["박승호","ST"],["최승구","RB"],["정치인","LW"],["이준섭","LB"],["백민규","ST"]]);
addPref("bucheon", [["김동현","CM"],["이재원","CB"],["김형근","GK"],["이충현","GK"],["김현엽","GK"],
  ["백동규","CB"],["패트릭","CB"],["안태현","RB"],["홍성욱","CB"],["이상혁","CB"],["유승현","RB"],["김종민","CB"],["김승빈","CAM"],["이예찬","CB"],
  ["윤빛가람","CM"],["바사니","LW"],["티아깅요","LWB"],["카즈","CM"],["김종우","CM"],["김상준","DM"],["정호진","DM"],["여봉훈","RWB"],["강재우","CM"],["성신","CM"],
  ["갈레고","RW"],["가브리엘","ST"],["박정인","ST"],["이의형","ST"],["신재원","RWB"],["한지호","ST"],["김규민","LWB"],["조성준","RWB"],["어담","ST"],["김민준","RW"]]);
// K리그2 — 실명 등록된 간판 선수
addPref("suwon", [["르본","LW"],["김준홍","GK"],["이건희","RB"],["헤이스","LW"],["홍정호","CB"],["박대원","LB"],["양형모","GK"],["이기제","LB"],["한호강","CB"],["이종성","CM"],["전진우","LW"],["김현","ST"]]);
addPref("daegu", [["오승훈","GK"],["홍정운","CB"],["세징야","CAM"],["김진혁","ST"]]);
addPref("suwonfc", [["강윤구","LB"],["안데르손 오사코","ST"],["김도윤","CM"]]);
addPref("busan", [["라마스","CM"],["페신","ST"]]);
addPref("jeonnam", [["발디비아","CAM"],["플라나","ST"]]);
addPref("seoule", [["에울레르","CAM"],["유정완","RW"]]);
addPref("seongnam", [["김민재","ST"],["유주안","RB"],["이정빈","LW"],["프레이타스","CM"],["박상혁","CAM"],["홍창범","CAM"],["이지훈","RB"],["박병규","LW"],["정승용","LB"],["박수빈","CM"],["양태양","LWB"],["료지","RB"],["황석기","LB"],["이종호","ST"]]);
/* ⚠ 제보 — 「청주 구선민(김선민)이 왼쪽 풀백으로 되어 있다」.
   등록은 DF 지만 실제로는 중앙 미드필더 · 수비형 미드필더다. */
addPref("cheongju", [["김선민","CM"],["피터","ST"]]);
addPref("asan", [["두아르테","ST"]]);
// 세부 슬롯을 밴드(DF/MF/FW)로 정규화 — LCB/RCB→CB, LCM/RCM→CM, LS/RS→ST 로 묶어서 판정한다
function canonSlot(slot){
  if(slot==="LCB"||slot==="RCB") return "CB";
  if(slot==="LCM"||slot==="RCM") return "CM";
  if(slot==="LS"||slot==="RS") return "ST";
  return slot;
}
function slotBand(slot){ const cs=canonSlot(slot); return cs==="GK"?"GK":(POS_ROW[cs]||"MF"); }
/* 🧭 ⚠ 제보 원문 — 「'전술' 탭에서 유저가 순서를 정하지 않고 '포지션' 버튼을 눌러서 포지션 별로
   정렬을 시킬 때, 위에서부터 GK - RB - CB - LB - DM - RM - CM - LM - RW - CAM - LW - ST 순으로
   정렬 되게 … 지금은 … FW 포지션 내에서만 위계가 있을 뿐, 그 안에서는 중구난방이라서 한 눈에
   포지션을 구분하기가 어렵습니다」.
   원인 — 정렬 키가 큰 분류(GK/DF/MF/FW) 네 칸뿐이었다. 같은 분류 안에서는 순위가 없어
     별점·종합치 같은 보조 기준으로 풀려 자리가 뒤섞였다.
   ─ 요청하신 차례를 그대로 눈금으로 만든다. 목록에 없는 변형 자리(LWB·SW·LDM·LAM 등)는
     같은 계열 옆에 붙인다. 전술 탭(교체·그 외)·경기 중 교체 슬롯·스쿼드 탭이 이 눈금을 함께 쓴다. */
const POS_SORT_LIST=["GK","RB","RWB","CB","SW","LB","LWB","RDM","DM","LDM","RM","CM","LM","RW","RAM","CAM","LAM","LW","ST"];
const POS_SORT_IDX=(function(){ const m={}; POS_SORT_LIST.forEach((k,i)=>{ m[k]=i; }); return m; })();
function posSortIdx(p){
  try{
    if(!p) return 90;
    if(p.pos==="GK") return 0;
    const sl=canonSlot(prefSlotOf(p)||"CM");
    const v=POS_SORT_IDX[sl];
    return (v==null) ? 90 : v;
  }catch(e){ return 90; }
}
/* 실명 등록이 없는 선수(유스·자동 생성 후보 등)는 능력치 프로필을 바탕으로 선호 포지션을 자연스럽게 추론한다 */
function inferPrefPos(p){
  if(p.pos==="GK") return "GK";
  const a=p.attr||{};
  if(p.pos==="DF"){
    const cbScore=(a.mar||50)+(a.tck||50)-(a.pace||50)*0.5;
    const fbScore=(a.pace||50)+(a.dri||50);
    if(cbScore>=fbScore) return "CB";
    return (p.id%2===0)?"LB":"RB";
  }
  if(p.pos==="MF"){
    const wideScore=(a.pace||50)+(a.dri||50);
    const centralScore=(a.pass||50)+(a.cmp||50);
    if(centralScore>=wideScore) return "CM";
    return (p.id%2===0)?"LM":"RM";
  }
  const wingScore=(a.pace||50)+(a.dri||50);
  const stScore=(a.fin||50)+(a.hea||50);
  if(stScore>=wingScore) return "ST";
  return (p.id%2===0)?"LW":"RW";
}
/* ═══════════════════════════════════════════════════════════════
   개별 선수 보정 — "이 선수는 이런 선수다"를 손으로 새겨 넣는다.
   자동 생성 규칙(능력치 추정·포지션 추론)은 평균적인 선수를 잘 만들지만, 리그를 아는 사람이
   보기에 명백히 다른 선수들이 있다. 그런 선수만 여기서 덮어쓴다.
     pref : 주 포지션(슬롯)            fam : 자리별 능숙도(0~100) — 소화 가능한 자리를 열어 준다
     set  : 능력치를 이 값으로 고정     add : 현재 값에 더한다     min : 최소한 이 값은 되게
   능력치는 내부 20~99 스케일이다. 화면 표시(1~20)는 raw/5 반올림이므로 18★ ≒ 90.
═══════════════════════════════════════════════════════════════ */
const PLAYER_TWEAK={
  /* 조현택(울산) — 왼쪽 풀백이 본업, 센터백까지 소화하는 4.5성급 풀백.
     왼발 크로스와 왕성한 오버래핑이 무기, 수비 기본기도 갖췄다. */
  "ulsan:조현택":{ pref:"LB", ovr:73, fam:{DL:100, DC:88, WBL:90, DR:74},
    set:{crs:83, pac:82, acc:81, sta:85, wor:84, tck:81, mar:80, pos:78,
         dri:76, tec:77, pas:78, fir:75, otb:76, ant:77, dec:75, cnt:77,
         tea:79, bra:76, agi:78, bal:76, str:74, jum:74, hea:73, det:80} },
  /* 김진수(서울) — 리그 최고를 다투던 왼쪽 풀백. 4.5성급.
     명품 왼발 크로스·세트피스와 노련한 수비 위치 선정, 몸은 전성기보다 살짝 내려왔다. */
  "seoul:김진수":{ pref:"LB", ovr:73, fam:{DL:100, WBL:92, ML:74},
    set:{crs:86, fre:81, cor:79, pas:79, tec:78, tck:80, mar:79, pos:80,
         ant:79, dec:79, cmp:79, cnt:78, tea:78, wor:78, ldr:77, det:80,
         dri:74, fir:76, otb:73, sta:74, pac:71, acc:71, agi:72, bal:74, bra:76} },
  /* 이민혁(울산) — 3.5성급 중앙 미드필더. 공격형 미드필더와 레프트백까지 소화하는 멀티 자원. */
  "ulsan:이민혁":{ pos:"MF", pref:"CM", ovr:69, fam:{MC:100, AMC:88, DL:84, ML:76},
    set:{pas:71, fir:70, tec:70, vis:69, dec:68, cmp:68, otb:68, dri:67,
         tck:66, mar:64, pos:67, ant:68, cnt:67, tea:71, wor:73, sta:73,
         agi:68, bal:67, pac:66, acc:66, str:61, jum:59, hea:58, det:70} },
  /* 에릭(울산) — 4성급 스트라이커 스탯. 왼쪽 윙어도 능숙(80). */
  "ulsan:에릭":{ pref:"ST", ovr:71, fam:{ST:100, LW:80},
    set:{fin:81, otb:80, ant:78, cmp:77, fir:77, tec:76, dri:76, pac:79,
         acc:79, agi:77, bal:75, str:74, jum:72, hea:72, lon:74, dec:73,
         cnt:74, tea:72, wor:74, bra:74, sta:76, det:77} },
  /* 윤종규(울산) — 오른쪽 풀백 맞춤 4.5성급. 공수 겸장의 전천후 라이트백. */
  "ulsan:윤종규":{ pref:"RB", ovr:73, fam:{DR:100, WBR:90, DL:80},
    set:{crs:83, pac:82, acc:81, sta:85, wor:84, tck:81, mar:80, pos:78,
         dri:76, tec:77, pas:78, fir:75, otb:76, ant:77, dec:75, cnt:77,
         tea:79, bra:76, agi:78, bal:76, str:74, jum:74, hea:73, det:80} },
  /* 최준(서울) — 오른쪽 풀백 맞춤 4.5성급. 오버래핑과 크로스가 무기. */
  "seoul:최준":{ pref:"RB", ovr:73, fam:{DR:100, WBR:92, MR:76},
    set:{crs:84, pac:81, acc:80, sta:84, wor:83, tck:80, mar:79, pos:78,
         dri:77, tec:78, pas:79, fir:76, otb:77, ant:76, dec:75, cnt:76,
         tea:78, bra:75, agi:78, bal:76, str:73, jum:73, hea:72, det:79} },
  /* 최승구(인천) — 오른쪽 풀백 맞춤 4성급. 젊고 성실한 라이트백. */
  "incheon:최승구":{ pref:"RB", ovr:71, fam:{DR:100, WBR:88},
    set:{crs:81, pac:80, acc:79, sta:83, wor:82, tck:79, mar:78, pos:76,
         dri:74, tec:75, pas:76, fir:73, otb:74, ant:75, dec:73, cnt:75,
         tea:77, bra:74, agi:76, bal:74, str:72, jum:72, hea:71, det:78} },
  /* 강준혁(강원) — 오른쪽 풀백 맞춤 4성급. */
  /* 이기혁(강원) — 센터백이 본업, 수비형 미드필더까지 소화하는 4.5성급 빌드업 수비수. */
  "gangwon:이기혁":{ pos:"DF", pref:"CB", ovr:73, fam:{DC:100, DM:90, MC:76},
    set:{mar:85, tck:85, pos:86, hea:83, jum:82, str:83, ant:83, cnt:82,
         dec:82, cmp:82, tea:82, wor:81, bra:83, det:83, agg:77,
         pas:81, fir:78, tec:77, vis:77, sta:81, pac:76, acc:75, agi:75, bal:80} },
  "gangwon:강준혁":{ pref:"RB", ovr:71, fam:{DR:100, WBR:88},
    set:{crs:81, pac:80, acc:79, sta:83, wor:82, tck:79, mar:78, pos:76,
         dri:74, tec:75, pas:76, fir:73, otb:74, ant:75, dec:73, cnt:75,
         tea:77, bra:74, agi:76, bal:74, str:72, jum:72, hea:71, det:78} },
  /* 최석현(울산) — 오른쪽 풀백 맞춤 4성급. */
  "ulsan:최석현":{ pref:"RB", ovr:71, fam:{DR:100, WBR:88, DL:80},
    set:{crs:81, pac:80, acc:79, sta:83, wor:82, tck:79, mar:78, pos:76,
         dri:74, tec:75, pas:76, fir:73, otb:74, ant:75, dec:73, cnt:75,
         tea:77, bra:74, agi:76, bal:74, str:72, jum:72, hea:71, det:78} },
  /* 장시영(울산) — 오른쪽 윙어가 본업, 오른쪽 윙백·라이트백까지 내려서도 뛴다. */
  "ulsan:장시영":{ pos:"FW", pref:"RW", fam:{RW:100, AMR:86, MR:82, WBR:84, DR:80} },
  /* 배현서(경남) — 왼쪽 풀백이 본업, 양쪽 풀백·윙백을 모두 소화하는 유망주. 잠재력 특급 직전. */
  "gyeongnam:배현서":{ pref:"LB", pot:83, fam:{DL:100, DR:86, WBL:88, WBR:82} },
  /* 손호준(경남) — 오른쪽 풀백이 본업. */
  "gyeongnam:손호준":{ pref:"RB", ovr:72, fam:{DR:100, WBR:84} },
  /* 김현오(경남) — 최전방 유망주. 잠재력 특급 직전. */
  "gyeongnam:김현오":{ pref:"ST", pot:85 },
  /* 김주엽(전남) — 오른쪽 풀백 맞춤 3성급. */
  "jeonnam:김주엽":{ pref:"RB", ovr:67, fam:{DR:100, WBR:86},
    set:{crs:76, pac:75, acc:74, sta:78, wor:77, tck:74, mar:73, pos:71,
         dri:69, tec:70, pas:71, fir:68, otb:69, ant:70, dec:68, cnt:70,
         tea:72, bra:69, agi:71, bal:69, str:67, jum:67, hea:66, det:73} },
  /* 강민준(포항) — 오른쪽 풀백 맞춤 3.5성급. */
  "pohang:강민준":{ pref:"RB", ovr:69, fam:{DR:100, WBR:86},
    set:{crs:79, pac:78, acc:77, sta:81, wor:80, tck:77, mar:76, pos:74,
         dri:72, tec:73, pas:74, fir:71, otb:72, ant:73, dec:71, cnt:73,
         tea:75, bra:72, agi:74, bal:72, str:70, jum:70, hea:69, det:76} },
  /* 어정원(포항) — 4성급 만능 유틸리티. 라이트백이 본업, 센터백과 스트라이커만 빼면 어디든 선다. */
  "pohang:어정원":{ pref:"RB", ovr:71,
    fam:{DR:100, DL:92, WBR:95, WBL:90, DM:90, MC:90, MR:90, ML:88, RW:86, LW:84, AMR:86, AML:82, AMC:80},
    set:{crs:81, pac:80, acc:79, sta:83, wor:82, tck:79, mar:78, pos:76,
         dri:76, tec:77, pas:78, fir:75, otb:76, ant:75, dec:74, cnt:75,
         tea:78, bra:74, agi:77, bal:75, str:71, jum:70, hea:69, det:78, vis:73} },
  /* 트란지스카(포항) — 위치선정·결정력·몸싸움으로 먹고사는 타깃형 스트라이커. 왼쪽 윙어도 능숙. */
  "pohang:트란지스카":{ pref:"ST", fam:{ST:100, LW:90, AML:80},
    set:{otb:82, fin:86, str:94} },
  /* 완델손(포항) — 4.5성급 만능 왼쪽 자원. 레프트백이 본업, 왼쪽 윙백·윙포워드·윙어까지 전부 소화.
     기술과 왼발 킥이 좋은 공격형 풀백. 오른쪽 윙은 어색하다(30). */
  "pohang:완델손":{ pos:"DF", pref:"LB", ovr:73,
    fam:{DL:100, WBL:100, AML:95, LW:95, ML:90, RW:30},
    set:{crs:84, tec:81, dri:80, pac:80, acc:79, sta:83, wor:82, fla:76,
         tck:77, mar:76, pos:75, pas:80, fir:78, otb:78, ant:75, dec:75,
         cnt:74, tea:77, bra:73, agi:79, bal:77, str:70, jum:70, hea:69,
         fre:79, det:78, vis:76} },
  /* 전민광(포항) — 센터백이 본업, 라이트백도 소화. */
  "pohang:전민광":{ pref:"CB", ovr:72, fam:{DC:100, DR:85} },
  /* 김동진(포항) — 중앙 미드필더가 본업, 수비형 미드필더도 소화. */
  "pohang:김동진":{ pos:"MF", pref:"CM", ovr:69, fam:{MC:100, DM:88} },
  /* 황재원(대구) — 라이트백이 본업. */
  "daegu:황재원":{ pref:"RB", ovr:71, fam:{DR:100, WBR:85} },
  /* 토마스(울산) — 주포지션 수비형 미드필더, 레프트백·센터백까지 전부 능숙도 100인 4.5성급 만능 수비 자원. */
  "ulsan:토마스":{ pref:"DM", ovr:73, fam:{DM:100, DC:100, DL:100, WBL:90, DR:86, WBR:82, MC:72},
    set:{tck:84, mar:82, pos:84, ant:83, cnt:81, dec:81, pas:81, fir:79,
         tea:83, wor:85, sta:85, str:80, agg:77, bra:79, cmp:79, vis:77,
         tec:76, dri:73, agi:76, bal:78, pac:74, acc:73, jum:77, hea:77, det:82} },
  /* 김문환(대전) — 오른쪽 풀백 맞춤 4.5성급. 폭발적인 오버래핑. */
  "daejeon:김문환":{ pref:"RB", ovr:73, fam:{DR:100, WBR:92, MR:74},
    set:{crs:83, pac:83, acc:82, sta:85, wor:84, tck:80, mar:79, pos:78,
         dri:78, tec:78, pas:78, fir:76, otb:77, ant:76, dec:75, cnt:76,
         tea:78, bra:76, agi:79, bal:77, str:73, jum:73, hea:72, det:80} },
  /* 김봉수(대전) — 주포지션 수비형 미드필더 4.5성급. 볼 배급과 위치 선정의 앵커. */
  "daejeon:김봉수":{ pref:"DM", ovr:73, fam:{DM:100, MC:90, DC:78},
    set:{tck:76, mar:73, pos:77, ant:76, cnt:75, dec:75, pas:76, fir:74,
         tea:76, wor:77, sta:77, str:71, agg:68, bra:70, cmp:74, vis:73,
         tec:72, dri:68, agi:68, bal:70, pac:65, acc:65, jum:68, hea:68, det:74} },
  /* 세징야 — 리그의 레전드. 기술과 머리는 최상위인데 몸이 예전 같지 않다.
     그래서 기술·정신은 올리고 신체는 확실히 내린다. 자리는 공격형 미드필더가 본업, 2선과 최전방 가능. */
  "daegu:세징야":{ pref:"CAM", fam:{AMC:100, AML:86, AMR:86, ST:80, MC:66},
    set:{pac:48, acc:52, sta:56, str:50, jum:44, agi:66, bal:64, nat:62},
    min:{tec:90, fla:90, vis:88, pas:87, dri:85, cmp:87, dec:86, ant:84, otb:82,
         fin:80, lon:84, fre:90, cor:86, crs:84, pen:88, tea:78, det:84, ldr:82, cnt:82} },
  /* 강윤구(강원) — 2선 자원. 공격형 미드필더가 본업이고 양 측면 윙어도 소화한다.
     같은 이름의 수원FC 강윤구(1993)는 왼쪽 풀백이라 팀 키로 구분한다. */
  "gangwon:강윤구":{ pref:"CAM", fam:{AMC:100, AML:86, AMR:82, LW:80, RW:74, MC:66, ML:70} },
  /* 에울레르(서울E) — 팀의 에이스. 공격형 미드필더가 본업이고 개인기·프리킥이 무기다. */
  /* ── FC 안양 — 실측 포지션 능숙도 ── */
  "anyang:박종현":{ pref:"CB", famOnly:true, fam:{DC:100, DM:80} },
  "anyang:김재현":{ pref:"LB", famOnly:true, fam:{DL:100, WBL:80} },
  "anyang:김민호":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:80} },
  "anyang:주현우":{ pref:"LB", famOnly:true, fam:{DL:100, DR:100, WBL:80, WBR:80, ML:50, MC:50, MR:50} },
  "anyang:김지훈":{ pref:"CB", famOnly:true, fam:{DC:100} },
  "anyang:이태희":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:80, DC:30} },
  "anyang:마테우스":{ pref:"CAM", famOnly:true, fam:{AMC:100, MC:70, ST:50, AML:50, AMR:50} },
  "anyang:최규현":{ pref:"CM", famOnly:true, fam:{MC:100, DM:80} },
  "anyang:김정현":{ pref:"DM", famOnly:true, fam:{DM:100, MC:80} },
  "anyang:강지훈":{ pref:"RB", famOnly:true, fam:{DR:100, DL:100, WBR:80, WBL:80, ML:70, MR:70, AML:50, AMR:50} },
  "anyang:김보경":{ pref:"CAM", famOnly:true, fam:{AMC:100, MC:70} },
  "anyang:김강":{ pref:"CAM", famOnly:true, fam:{AMC:100, AML:80, AMR:80, LW:80, RW:80} },
  "anyang:강지완":{ pref:"CM", famOnly:true, fam:{MC:100, DM:80, DC:50} },
  "anyang:엘쿠라노":{ pref:"ST", famOnly:true, fam:{ST:100, LW:30, RW:30} },
  "anyang:아일톤":{ pref:"LW", famOnly:true, fam:{LW:100, RW:100, AML:100, AMR:100} },
  "anyang:유키치":{ pref:"LW", famOnly:true, fam:{AML:100, LW:100, ML:80, AMR:70, RW:70} },
  "anyang:최건주":{ pref:"LW", famOnly:true, fam:{LW:100, RW:100, AML:80, AMR:80, ST:80} },
  "anyang:문성우":{ pos:"MF", fam:{AML:80} },
  "anyang:박정훈":{ pref:"LW", famOnly:true, fam:{LW:100, AML:100, ST:80, RW:50, AMC:50, AMR:50} },
  "anyang:채현우":{ pref:"CAM", famOnly:true, fam:{AMC:100, AMR:80, RW:80, AML:50, LW:50} },
  "anyang:김운":{ pref:"ST", famOnly:true, fam:{ST:100} },
  /* 구호진(포항 #36) — 등록은 센터백. 수비형·중앙 미드필더까지 내려앉아 소화한다(제보).
     2005년생 21세 — 지금은 로테이션이지만 잠재력은 3.5성급. */
  "pohang:김호진":{ pos:"DF", pref:"CB", ovr:64, pot:70, potMax:70, famOnly:true,
    fam:{DC:100, DM:84, MC:74, SW:70},
    min:{jum:74, hea:73, str:74, mar:70, tck:70, pos:71, det:72, bra:72, tea:70,
         pas:66, fir:63, cmp:64, dec:65, cnt:65, sta:70, wor:70} },
  /* 구선민(청주 #5) — 등록은 수비수지만 실제 자리는 중앙 미드필더. 수비형 미드필더까지 소화한다(제보).
     1991년생 35세 · 167cm 의 작고 부지런한 중원 — 3성급. 발은 이미 느리고, 대신 위치 선정과
     활동량·태클로 버티는 유형이다. */
  "cheongju:김선민":{ pos:"MF", pref:"CM", ovr:64, pot:64, potMax:64, famOnly:true,
    fam:{MC:100, DM:92, AMC:70, ML:66, MR:62},
    set:{pac:52, acc:53, agi:66, bal:70, jum:44, hea:46, str:52, sta:74, nat:70},
    min:{wor:78, tea:76, det:76, cnt:72, pos:73, dec:72, ant:70, cmp:70,
         pas:70, vis:68, fir:68, tec:68, tck:72, mar:66, lon:62} },
  /* ── 서울 이랜드 FC — 실측 포지션 능숙도 ── */
  /* 👥 ⚠ 요청 원문 — 「서울 이스트 FC에 타이오라는 선수와 카이오라는 선수가 있는데,
     이 선수 둘 같은 선수거든? 카이오를 없애자」.
     ⚠ 여기 적힌 이름은 「소스 이름」이고, 화면에 나오는 이름이 아니다.
        모든 선수는 mkTeam 끝에서 fictName 으로 한 번 개명되어 나간다(ㅋ→ㅌ) —
        즉 이 「카이오」가 화면의 「타이오」다. 남기는 선수는 이쪽이다.
     191cm에 발까지 빠른 유형 — 제공권과 속도로 먹고 산다. */
  "seoule:카이오":{ pref:"CB", ovr:76,
    fam:{DC:100, DL:86, SW:78, WBL:70, DR:62, DM:58},
    min:{jum:84, hea:82, str:83, pac:74, acc:71, bal:73, sta:73, nat:72,
         tck:75, mar:75, pos:73, bra:76, agg:70, cnt:70, ant:72, dec:69, det:74, wor:70, tea:70,
         cmp:67, fir:63, pas:64, ldr:66} },
  "seoule:최랑":{ pref:"LM", famOnly:true, fam:{ML:100, WBL:50, MC:50, AML:50, DL:45, LW:45, AMC:45} },
  "seoule:김주환":{ pref:"RWB", famOnly:true, fam:{WBR:100, WBL:100, DR:85, DL:85, MR:50, ML:50} },
  "seoule:오인표":{ pref:"RB", famOnly:true, fam:{DR:100, DL:80, WBR:75, WBL:40} },
  "seoule:배서준":{ pref:"LM", famOnly:true, fam:{ML:100, WBL:85, AML:85, DL:70, LW:70} },
  "seoule:손혁찬":{ pref:"LB", famOnly:true, fam:{DL:100, DC:100, DR:100} },
  "seoule:김현우":{ pref:"LB", famOnly:true, fam:{DL:100, WBL:50} },
  "seoule:오스마르":{ pref:"DM", famOnly:true, fam:{DM:100, DC:80, MC:50, ST:30} },
  "seoule:조준현":{ pref:"CM", famOnly:true, fam:{MC:100, AMC:85, ML:45, MR:45} },
  "seoule:백지웅":{ pref:"DM", famOnly:true, fam:{DM:100, MC:100, DC:80, AMC:50, AML:45, AMR:45, ST:30, LW:25, RW:25} },
  "seoule:변경준":{ pref:"RW", famOnly:true, fam:{RW:100, AMR:85, LW:85, AML:75, MR:70, ML:55} },
  "seoule:박재용":{ pref:"ST", famOnly:true, fam:{ST:100, LW:45, RW:45} },
  "seoule:이주혁":{ pref:"LW", famOnly:true, fam:{LW:100, AML:85, RW:85, AMR:75} },
  "seoule:김우빈":{ pref:"ST", famOnly:true, fam:{ST:100, LW:45, RW:45} },
  "seoule:안주완":{ pref:"LW", famOnly:true, fam:{LW:100, AML:85, RW:85, AMR:75} },
  "seoule:에울레르":{ pref:"CAM", fam:{AMC:100, AML:86, AMR:86, ST:78, MC:70},
    min:{tec:86, dri:85, fla:84, vis:84, pas:83, cmp:82, otb:82, dec:80, fre:87, cor:82, lon:82, fin:78, agi:80, bal:78} },
  /* 발디비아(전남) — 마찬가지로 팀의 에이스형 공격형 미드필더. */
  "jeonnam:발디비아":{ pref:"CAM", fam:{AMC:100, AML:86, AMR:86, ST:78, MC:70},
    min:{tec:86, dri:85, fla:85, vis:85, pas:84, cmp:82, otb:81, dec:80, fre:87, cor:82, lon:81, fin:77, agi:81, bal:78} },
  /* 네게바(제주) — 왼쪽 윙어가 본업, 오른쪽도 소화. 요즘 폼이 좋다 — 몸과 개인기를 함께 올린다. */
  "jeju:네게바":{ pref:"LW", fam:{LW:100, RW:88, AML:86, AMR:78, ST:72, ML:70},
    min:{pac:84, acc:85, agi:84, bal:82, sta:80, str:72, tec:85, dri:87, fla:82, crs:80, fin:78, otb:80, wor:78} },
  /* 바베츠(서울) — 뒤에서 경기를 읽는 수비형 미드필더. 발은 느리지만 위치 선정과 배급이 좋다. */
  "seoul:바베츠":{ pref:"DM", fam:{DM:100, DC:84, MC:78, SW:64},
    set:{pac:73, acc:70, lon:79, dri:67, tec:71},
    min:{vis:87, pas:86, pos:88, jum:85, hea:85, ant:83, dec:83, cmp:82, tck:82, mar:80,
         tea:82, cnt:82, wor:80, str:82, det:80, fir:78} },
  /* 로스(서울) — 제공권과 발밑을 겸비한 센터백. 수비형 미드필더까지 내려앉을 수 있다. */
  "seoul:로스":{ pref:"CB", fam:{DC:100, DM:84, SW:80, DL:62},
    min:{jum:87, hea:86, pac:79, acc:76, vis:83, pas:84, det:86, str:84, tck:83, mar:82,
         pos:83, ant:80, dec:80, cmp:81, bra:82, cnt:80, fir:76, tea:78} },
  /* 야잔(서울) — 리그 정상급 센터백. 일대일 마크는 리그 최고치로 못 박는다. */
  "seoul:야잔":{ pref:"CB", fam:{DC:100, SW:80, DR:62, DL:62, DM:60},
    set:{mar:99},
    min:{tck:94, pos:92, str:84, pac:84, acc:82, sta:82, nat:82, det:96, ant:88, pas:78,
         jum:86, hea:86, bra:88, cnt:84, agg:80, dec:82, ldr:82, cmp:80, wor:80} },
  /* 정승원(서울) — 오른쪽이든 왼쪽이든, 뒤든 앞이든 세울 수 있는 상급 멀티 자원.
     타고난 체력과 승부욕으로 90분을 뛰고, 중거리와 크로스가 무기다. */
  "seoul:정승원":{ pref:"RB", fam:{DR:100, DL:88, WBR:92, WBL:86, MR:88, ML:84, RW:82, LW:78, DM:80, MC:76},
    min:{nat:83, det:83, sta:83, wor:83, lon:79, crs:81, pac:77, acc:77, agi:77, bal:75,
         tec:75, dri:75, pas:74, vis:73, tck:73, pos:72, ant:73, dec:72, tea:77, cnt:73, fir:73} },
  /* 아부달라(강원) — 마무리와 침투가 좋은 최전방. 몸싸움과 발도 준수하다. */
  "gangwon:아부달라":{ pref:"ST", fam:{ST:100, AMC:64, LW:62, RW:62},
    min:{fin:88, otb:88, cmp:83, ant:82, pac:82, acc:81, str:84, jum:80, hea:80,
         bra:80, det:82, agi:76, bal:78, fir:80, tec:76, dec:76, wor:74} },
  /* 김대원(강원) — 리그 정상급 윙어. 안으로 파고들어 마무리하는 인사이드 포워드형. */
  "gangwon:김대원":{ pref:"LW", fam:{LW:100, RW:90, AML:88, AMR:82, ML:78, ST:72, AMC:70},
    min:{dri:90, tec:90, fla:87, acc:88, pac:86, agi:89, bal:85, otb:86, fin:85, lon:84,
         cmp:84, fre:80, crs:80, ant:83, dec:80, vis:80, pas:80, wor:78, det:82, sta:80} },
  /* 이동경(울산) — 왼발에서 나오는 패스와 중거리가 일품. 공격형 미드필더까지 내려올 수 있다. */
  "ulsan:이동경":{ fam:{AMC:88, AML:84, AMR:82, MC:72},
    min:{pas:88, lon:90, vis:85, tec:86, fla:84, fre:84, cor:82, dri:82, cmp:82, dec:80, otb:80} },
  /* 홍정호(수원) — 발은 느리지만 자리 잡는 눈과 뒷문을 잠그는 마킹이 좋다.
     뒤에서 경기를 시작하는 유형이라 패스와 침착성도 함께 준다. */
  "suwon:홍정호":{ pref:"CB", fam:{DC:100, SW:84, DM:64, DL:58, DR:58},
    set:{pac:60, acc:59},
    min:{pos:96, mar:95, tck:88, ant:88, dec:87, cnt:88, bra:86, cmp:87,
         str:92, jum:87, hea:88, bal:83, sta:83,
         pas:89, vis:85, tec:79, fir:79, lon:77, ldr:88, tea:85, det:86, wor:81} },
  /* 헤이스(수원) — 팀의 에이스. 왼쪽 윙어가 본업이고 최전방과 오른쪽도 소화한다.
     쉬지 않고 뛰는 유형이라 활동량·승부욕·타고난 체력이 특히 높다. */
  "suwon:헤이스":{ pref:"LW", pers:0, fam:{LW:100, RW:88, ST:86, AML:90, AMR:80, ML:74, AMC:70},
    min:{wor:94, det:94, nat:92, sta:88, dri:92, tec:91, crs:88, fla:86,
         pac:86, acc:87, agi:87, bal:84, otb:86, fin:84, lon:82, fre:80, pen:82,
         cmp:85, ant:84, dec:82, vis:82, pas:82, fir:84, tea:86, cnt:82, bra:84} },
  /* 이건희(수원) — 오른쪽 풀백. 아직 어리지만 쓸 만한 자원으로 올려 준다. */
  /* ── 수원 삼성 블루윙즈 — 순위별 포지션 능숙도 (1순위 100 / 2순위 90 / 3순위 80 …) ── */
  "suwon:이건희":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:88, DL:90, WBL:80} },
  "suwon:최지묵":{ pref:"LB", famOnly:true, fam:{DL:100, WBL:88, DC:90} },
  "suwon:이준재":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:88, DL:90, WBL:80, MR:80, ML:80} },
  "suwon:박대원":{ pref:"LB", famOnly:true, fam:{DL:100, WBL:88, DC:95, DR:80, WBR:72, DM:80} },
  "suwon:정동윤":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:88, DL:90, WBL:80, DC:80, DM:80} },
  "suwon:한현서":{ pref:"CB", famOnly:true, fam:{DC:100, DL:90, WBL:80} },
  "suwon:여민준":{ pref:"LB", famOnly:true, fam:{DL:100, WBL:88} },
  "suwon:김민우":{ pref:"DM", famOnly:true, fam:{DM:100, DL:100, WBL:88, DC:95, MC:95, ML:90} },
  "suwon:강현묵":{ pref:"CAM", famOnly:true, fam:{AMC:100, RW:90, LW:90, ST:90, MC:85} },
  "suwon:김성주":{ pref:"CAM", famOnly:true, fam:{AMC:100, LW:90, RW:90, MC:90} },
  "suwon:페신":{ pref:"RW", famOnly:true, fam:{RW:100, AMR:90, LW:85, AML:85, ST:85} },
  "suwon:브루노 실바":{ pref:"LW", famOnly:true, fam:{LW:100, AML:90, RW:90, ST:80} },
  "suwon:두비츠카스":{ pref:"ST", famOnly:true, fam:{ST:100, LW:90, RW:90} },
  "suwon:김지현":{ pref:"ST", famOnly:true, fam:{ST:100, AMC:100, LW:90, RW:90, AMR:70, AML:70, MC:60} },
  "suwon:강성진":{ pref:"RW", famOnly:true, fam:{RW:100, AMR:95, LW:90, AML:90, ST:80} },
  "suwon:박지원":{ pref:"LW", famOnly:true, fam:{LW:100, AML:90, RW:90} },
  /* 제보 — 능숙도는 왼쪽 풀백 100인데 대분류가 FW로 찍혔다. 등록 포지션이 잘못된 경우다. */
  "suwon:이상민":{ pos:"DF", ovr:71, pref:"LB", famOnly:true, fam:{DL:100, WBL:88, RW:90, AMR:90, LW:80, AML:80} },
  "suwon:김결":{ pref:"ST", famOnly:true, fam:{ST:100, LW:90, RW:90} },
  "suwon:김준홍":{ pref:"GK", fam:{GK:100},
    min:{ref:82, one:80, aer:81, com:78, han:79, cmd:79, kic:75, tro:73, pun:69, ecc:35,
         ant:75, dec:75, cnt:77, pos:77, bra:77, cmp:75, ldr:71, tea:71, jum:77, agi:77, str:75, nat:73} },
  /* 르본(수원) — 상급은 아니다. 눈에 띄는 드리블 말고는 평범한 수준으로 되돌린다. */
  "suwon:르본":{ pref:"LW", fam:{LW:100, ST:80, RW:78, AML:82, AMC:64},
    set:{fin:74, otb:74, cmp:72, ant:72, dec:70, hea:64, jum:66, str:68,
         pac:80, acc:81, agi:80, bal:76, sta:74, tec:78, dri:84, fla:74,
         pas:66, vis:66, fir:70, lon:66, wor:68, tea:66, det:70} },
  /* ── FC 서울 — 실제 기용 위치 (제보 반영) ── */
  "seoul:박수일":{ pref:"RB", famOnly:true, fam:{DR:100, DL:86} },   // RB · LB
  "seoul:안재민":{ pref:"LB", famOnly:true, fam:{DL:100, DR:86} },   // LB · RB
  "seoul:김지원":{ pref:"CB", famOnly:true, fam:{DC:100, ST:86} },   // CB · ST
  "seoul:박성훈":{ pref:"CB", famOnly:true, fam:{DC:100} },   // CB
  "seoul:고필관":{ pref:"CM", famOnly:true, fam:{MC:100, AMC:86, DM:80} },   // CM · CAM · DM
  "seoul:안데르손":{ pref:"RW", famOnly:true, fam:{RW:100, LW:86, AMC:80, AML:76, AMR:72} },   // RW · LW · CAM · LAM · RAM
  "seoul:후이즈":{ pref:"ST", famOnly:true, fam:{ST:100} },   // ST
  "seoul:바또":{ pref:"RW", famOnly:true, fam:{RW:100, LW:86} },   // RW · LW
  "seoul:정현우":{ pref:"LW", famOnly:true, fam:{LW:100} },   // LW
  "seoul:문선민":{ pref:"RW", famOnly:true, fam:{RW:100, LW:86, AMC:80, AML:76, AMR:72} },   // RW · LW · CAM · LAM · RAM
  /* ── 실제 기용 위치 보정 (제보 반영) ─────────────────────────────
     등록 포지션만 보고 추론하면 윙백이 센터백으로, 윙어가 스트라이커로 잡힌다.
     주포지션 → 소화 가능 순으로 능숙도 100/86/76/68 을 매긴다. */
  "daejeon:박규현":{ pref:"LB", famOnly:true, fam:{DL:100, DC:86} },   // LB · CB
  "daejeon:조성권":{ pref:"CB", famOnly:true, fam:{DC:100, DR:86} },   // CB · RB
  "daejeon:강윤성":{ pref:"RB", famOnly:true, fam:{DR:100, DM:86, DL:76} },   // RB · DM · LB
  "daejeon:마사":{ pref:"CAM", famOnly:true, fam:{AMC:100, ST:86} },   // AM · ST
  "daejeon:김진야":{ pref:"LB", famOnly:true, fam:{DL:100, DR:86, WBL:76, WBR:68} },   // LB · RB · LWB · RWB
  "daejeon:서진수":{ pref:"LW", famOnly:true, fam:{LW:100, AMC:86, RW:76} },   // LW · AM · RW
  "daejeon:서영재":{ pref:"LB", famOnly:true, fam:{DL:100, DR:86} },   // LB · RB
  "daejeon:김현욱":{ pref:"CAM", famOnly:true, fam:{AMC:100, ML:86, MR:76} },   // AM · LM · RM
  "daejeon:주앙 빅토르":{ pref:"RW", famOnly:true, fam:{RW:100, ST:86} },   // RW · ST
  "daejeon:안톤":{ pref:"CB", famOnly:true, fam:{DC:100, DL:86} },   // CB · LB
  "bucheon:티아깅요":{ pref:"LWB", famOnly:true, fam:{WBL:100, WBR:86, LW:76, RW:68} },   // LWB · RWB · LW · RW
  "bucheon:정호진":{ pref:"DM", famOnly:true, fam:{DM:100, DC:86, WBR:76, WBL:68} },   // DM · CB · RWB · LWB
  "bucheon:신재원":{ pref:"RWB", famOnly:true, fam:{WBR:100, RW:86, WBL:76, LW:68} },   // RWB · RW · LWB · LW
  "bucheon:이상혁":{ pref:"CB", famOnly:true, fam:{DC:100, DM:86, MC:76} },   // CB · DM · CM
  "bucheon:안태현":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:86} },   // RB · RWB
  "bucheon:이재원":{ pref:"CB", famOnly:true, fam:{DC:100, DR:86} },   // CB · RB
  "bucheon:이예찬":{ pref:"CB", famOnly:true, fam:{DC:100, DR:86} },   // CB · RB
  "bucheon:강재우":{ pref:"CM", famOnly:true, fam:{MC:100, DR:86, ST:76} },   // CM · RB · ST
  "bucheon:조성준":{ pref:"RWB", famOnly:true, fam:{WBR:100, RW:86, AMC:76} },   // RWB · RW · AM
  "bucheon:김상준":{ pref:"DM", famOnly:true, fam:{DM:100, DC:86, MC:76, ST:68} },   // DM · CB · CM · ST
  "bucheon:김동현":{ pref:"CM", famOnly:true, fam:{MC:100, AMC:86, RW:76, LW:68} },   // CM · AM · RW · LW
  "bucheon:여봉훈":{ pref:"RWB", famOnly:true, fam:{WBR:100, DR:86, MC:76} },   // RWB · RB · CM
  "bucheon:바사니":{ pref:"LW", famOnly:true, fam:{LW:100, RW:86, AMC:76, MC:68} },   // LW · RW · AM · CM
  "bucheon:갈레고":{ pref:"RW", famOnly:true, fam:{RW:100, LW:86, ST:76} },   // RW · LW · ST
  "bucheon:박정인":{ pref:"ST", famOnly:true, fam:{ST:100, RW:86} },   // ST · RW
  "bucheon:김민준":{ pref:"RW", famOnly:true, fam:{RW:100, LW:86, AMC:76, ST:68} },   // RW · LW · AM · ST
  "bucheon:김승빈":{ pref:"CAM", famOnly:true, fam:{AMC:100, LW:86, RW:76, MC:68} },   // AM · LW · RW · CM
  "bucheon:김규민":{ pref:"LWB", famOnly:true, fam:{WBL:100, WBR:86, RW:76, AMC:68} },   // LWB · RWB · RW · AM
  "bucheon:한지호":{ pref:"ST", famOnly:true, fam:{ST:100, RW:86} },   // ST · RW
  /* ── 제주 SK FC — 실제 기용 위치 (주포지션 → 소화 가능 순) ────────────── */
  "jeju:장민규":{ pref:"CB", famOnly:true, fam:{DC:100, DM:84} },   // CB · CDM
  "jeju:유인수":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:84, DM:74} },   // RB · RWB · DM
  "jeju:허강준":{ pref:"CB", famOnly:true, fam:{DC:100} },   // CB
  "jeju:권기민":{ pref:"CB", famOnly:true, fam:{DC:100, DM:84} },   // CB · CDM
  "jeju:박민재":{ pref:"RB", famOnly:true, fam:{DR:100} },   // RB
  "jeju:조인정":{ pref:"LB", famOnly:true, fam:{DL:100} },   // LB
  "jeju:김건웅":{ pref:"DM", famOnly:true, fam:{DM:100, DC:84} },   // DM · CB
  "jeju:김재민":{ pref:"CM", famOnly:true, fam:{MC:100, AMC:84} },   // CM · AM
  "jeju:강동휘":{ pref:"DM", famOnly:true, fam:{DM:100, DC:84} },   // DM · CB
  "jeju:김준하":{ pref:"RW", famOnly:true, fam:{RW:100, LW:84, AMC:74} },   // RW(주) · LW · CAM
  "jeju:아이아스":{ pref:"ST", famOnly:true, fam:{ST:100} },   // ST
  /* ── 광주 FC — 실제 뛰는 자리로 ── */
  "gwangju:주앙 페드로":{ pref:"CB", famOnly:true, fam:{DC:100, SW:76, DL:62, DR:62} },
  "gwangju:김용혁":{ pref:"CB", famOnly:true, fam:{DC:100, SW:72, DR:64, DM:58} },
  "gwangju:정지훈":{ pref:"LW", famOnly:true, fam:{LW:100, RW:80, AML:86, ML:74, ST:66} },
  "gwangju:문민서":{ pref:"CM", famOnly:true, fam:{MC:100, DM:80, AMC:76} },
  /* ── 성남 FC — 실제 기용 위치에 맞춘 포지션 보정 ──────────────────────
     자동 추론이 등록 포지션(DF/MF/FW)만 보고 정하다 보니 측면 자원이 센터백으로,
     윙어가 수비수로 잡히는 일이 많았다. 소화 가능한 자리를 손으로 못 박는다. */
  /* ── 성남FC — 실측 능숙도 반영 ── */
  "seongnam:료지":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:80, MR:60, ML:60, DL:40, WBL:40} },
  "seongnam:양태양":{ pref:"LB", famOnly:true, fam:{DL:100, WBL:75, MC:80, LW:60} },
  "seongnam:박수빈":{ pos:"MF", pref:"CM", famOnly:true, fam:{MC:100, DM:75, DC:60, DL:40} },
  "seongnam:정승용":{ pref:"LB", famOnly:true, fam:{DL:100, WBL:80, DC:70, ML:60} },
  "seongnam:박병규":{ pos:"FW", pref:"ST", famOnly:true, fam:{ST:100, LW:60, RW:60, DL:40} },
  "seongnam:이지훈":{ pref:"RB", famOnly:true, fam:{DR:100, WBR:80, MR:50} },
  "seongnam:홍창범":{ pref:"CAM", famOnly:true, fam:{AMC:100, MC:70, AML:60, AMR:60} },
  "seongnam:박상혁":{ pref:"CAM", famOnly:true, fam:{AMC:100, MC:80, ML:60, MR:60} },
  "seongnam:프레이타스":{ pos:"MF", pref:"CM", famOnly:true, fam:{MC:100, DM:80, AMC:80, DC:40} },
  "seongnam:이정빈":{ pref:"LW", famOnly:true, fam:{LW:100, RW:80, AMC:70, AML:60, AMR:60} },
  "seongnam:유주안":{ pos:"DF", pref:"RB", famOnly:true, fam:{DR:100, WBR:75, MR:70} },
  "seongnam:김민재":{ pref:"ST", famOnly:true, fam:{ST:100, DC:80, LW:70} },
  "seongnam:빌레로":{ pref:"RW", famOnly:true, fam:{RW:100, LW:80, ST:70} },
  "seongnam:이준상":{ pref:"LW", famOnly:true, fam:{LW:100, ST:75} },



  /* 루이스(수원) — K2를 지배한 브라질 골잡이. 김포에서 3.5시즌 58골.
     화려하지 않다. 박스 안에서만 산다 — 첫 터치로 각을 만들고 한 번에 마무리한다.
     서른셋이라 발은 예전 같지 않지만 골 냄새와 침착함은 리그 최상위. 5성급. */
  "suwon:루이스":{ pos:"FW", pref:"ST", ovr:80, potMax:80,
    fam:{ST:100, LW:62, RW:62, AMC:55},
    set:{fin:94, otb:93, cmp:90, ant:88, fir:88, tec:84, dri:83, pen:90, fla:76, lon:76,
         hea:83, jum:81, str:81, bal:81, agi:79, acc:82, pac:78, sta:70, wor:66,
         det:86, bra:80, agg:70, tea:70, dec:78, cnt:74, vis:64, pas:66, crs:52,
         pos:48, mar:26, tck:22} },
  /* 에드가 — 191cm 타깃맨. 몸싸움·점프·헤더가 리그 최상위(18~20). */
  "daegu:에드가":{ set:{str:92, jum:96, hea:99} },
  /* 데커스 — 200cm 96kg. 제공권은 더 키우고, 대신 골 결정력은 현실적으로 낮춘다(11~14). */
  "daegu:데커스":{ add:{str:9, jum:8, hea:9}, min:{str:76, jum:86, hea:82}, set:{fin:63} },
  /* 도도(2001) — 브라질 · 170cm 턴 플레이메이커. 공미가 본진이고 왼쪽 윙도 소화한다.
     볼 컨트롤·드리블·킬패스가 강점, 수비 가담은 약점 (나무위키 프로필 반영 · 3.5성급). */
  "jeonbuk:도도":{ pref:"CAM", fam:{AMC:100, AML:88, LW:85},
    add:{dri:9, tec:8, fir:7, vis:7, fla:6, agi:6, bal:5},
    set:{tck:44, mar:46, hea:48},
    pot:77 }
};
function applyPlayerTweak(p, teamId){
  applyTweakObj(p, PLAYER_TWEAK[teamId+":"+p.name]);
}
function applyTweakObj(p, k){
  if(!k) return;
  /* pos — 스쿼드에 DF/MF/FW 중 무엇으로 묶일지. 등록은 수비수인데 실제로는 공격수인 선수가 있다. */
  if(k.pos && ["GK","DF","MF","FW"].indexOf(k.pos)>=0){ p.pos=k.pos; p._posLock=1; }
  if(k.pref){ p.prefPos=k.pref; p.posFam=initPosFam(p); }
  if(!p.posFam) p.posFam=initPosFam(p);
  // famOnly — 딱 그 자리만 소화하는 선수. 이웃 자리 보너스를 통째로 지운다.
  if(k.famOnly) for(const f of FAM_POS) p.posFam[f]=0;
  if(k.fam) for(const f in k.fam) p.posFam[f]=Math.max(p.posFam[f]||0, k.fam[f]);
  syncPosBand(p);   // 손으로 새긴 능숙도를 반영해 대분류를 다시 읽는다(_posLock 이면 그대로 둔다)
  if(typeof k.pers==="number") p.pers=clamp(k.pers,0,3);
  if(typeof k.ovr==="number"){
    p.ovr=clamp(k.ovr,40,99);
    if(p.pos!=="GK") p.attr=syncLegacyAttrs(genAttrsFM(p.pos, p.ovr));
    if((p.pot||0)<p.ovr) p.pot=p.ovr;
  }
  if(typeof k.pot==="number") p.pot=clamp(Math.max(p.pot||0, k.pot), p.ovr||40, 99);
  /* potMax — 잠재력을 「그 값으로 못박는다」. pot 은 하한(끌어올림)만 하므로 상한이 따로 필요하다. */
  if(typeof k.potMax==="number") p.pot=clamp(Math.min(p.pot||99, k.potMax), p.ovr||40, 99);
  const A=p.attr||(p.attr={});
  /* 골키퍼 능력치는 p.gkA 에 따로 산다 — 키 이름으로 어느 쪽인지 갈라 준다 */
  const isGk=(a)=>GKT_ATTRS.indexOf(a)>=0;
  const bag=(a)=> isGk(a) ? (p.gkA||(p.gkA={})) : A;
  if(k.set) for(const a in k.set){ const B=bag(a); B[a]=clamp(k.set[a],15,99); }
  if(k.add) for(const a in k.add){ const B=bag(a); B[a]=clamp((B[a]||60)+k.add[a],15,99); }
  if(k.min) for(const a in k.min){ const B=bag(a); B[a]=clamp(Math.max(B[a]||0, k.min[a]),15,99); }
  syncLegacyAttrs(A);
  if(p.gkA && typeof syncLegacyGk==="function"){ try{ syncLegacyGk(p); }catch(e){} }
  // 능력치를 바꿨으니 특성도 다시 뽑는다 — 몸이 죽은 선수가 "폭발적인 스피드"를 갖고 있으면 안 된다
  try{ p.traits=genTraits(p.pos, A, p); }catch(e){}
}
function assignPrefPos(p, teamId){
  if(p && p.pos==="GK") return "GK";   // 🧤 골키퍼의 주 포지션은 언제나 GK — 필드 자리로 추론되면 대분류가 흔들린다
  const ov=PREF_POS_OVERRIDE[teamId+":"+p.name];
  /* 🧤 반대 방향도 막는다 — 등록이 필드 선수인데 표에 GK 가 남아 있으면(옛 명단의 잔재)
     능숙도가 GK 100 으로 깔려 대분류까지 골키퍼로 끌려간다(제보 — 포항 구호진). */
  if(ov && ov!=="GK") return ov;
  return inferPrefPos(p);
}
/* 현재 배치된 슬롯이 선수의 선호 포지션과 얼마나 맞는지 — green(적합)/yellow(다소 안맞음, 같은 라인)/red(라인 자체가 다름) */
/* ── 포지션 능숙도 (FM식) ─────────────────────────────────────────
   선수는 자리마다 "얼마나 익숙한가"를 0~100으로 갖는다. 어색한 자리라도
   경기를 뛰면 올라가고, 오래 안 뛴 자리는 아주 천천히 내려간다. */
const FAM_POS=["GK","SW","DC","DL","DR","WBL","WBR","DM","MC","ML","MR","AMC","AML","AMR","LW","RW","ST"];
const FAM_LABEL={GK:"GK",SW:"스위퍼",DC:"중앙 수비",DL:"왼쪽 수비",DR:"오른쪽 수비",WBL:"왼쪽 윙백",WBR:"오른쪽 윙백",
  DM:"수비형 미드필더",MC:"중앙 미드필더",ML:"왼쪽 미드필더",MR:"오른쪽 미드필더",
  AMC:"공격형 미드필더",AML:"왼쪽 공격형",AMR:"오른쪽 공격형",
  LW:"왼쪽 윙어",RW:"오른쪽 윙어",ST:"스트라이커"};
/* LW/RW는 AML/AMR과 다른 자리다 — 공격형 미드필더는 한 칸 내려와 경기를 조립하고,
   윙어는 최전방 라인에서 폭을 잡고 배후를 노린다. 그래서 능숙도도 따로 쌓인다. */
const SLOT_FAM={GK:"GK", SW:"SW", LCB:"DC",CB:"DC",RCB:"DC", LB:"DL",RB:"DR", LWB:"WBL",RWB:"WBR",
  LDM:"DM",DM:"DM",RDM:"DM", LCM:"MC",CM:"MC",RCM:"MC", LM:"ML",RM:"MR",
  LAM:"AML",CAM:"AMC",RAM:"AMR", LW:"LW",RW:"RW", LS:"ST",ST:"ST",RS:"ST"};
/* 가까운 자리끼리는 처음부터 어느 정도 익숙하다 */
const FAM_NEAR={
  SW:{DC:75,DM:40},
  DC:{SW:70,DL:45,DR:45,DM:50,WBL:30,WBR:30}, DL:{DC:45,WBL:80,ML:55,DR:30}, DR:{DC:45,WBR:80,MR:55,DL:30},
  WBL:{DL:80,ML:65,AML:40}, WBR:{DR:80,MR:65,AMR:40},
  DM:{MC:75,DC:50}, MC:{DM:75,AMC:65,ML:45,MR:45},
  ML:{MR:35,AML:70,WBL:55,MC:45,LW:55}, MR:{ML:35,AMR:70,WBR:55,MC:45,RW:55},
  AMC:{MC:65,ST:55,AML:75,AMR:75}, AML:{AMR:35,ML:70,ST:45,LW:85,AMC:62}, AMR:{AML:35,MR:70,ST:45,RW:85,AMC:62},   // 같은 AM 라인 — CAM이 초록인데 LAM/RAM이 빨간 건 웃기다
  LW:{AML:85,ML:80,ST:55,RW:35}, RW:{AMR:85,MR:80,ST:55,LW:35},   // 윙어에게 LM/RM 은 같은 윙 한 칸 아래일 뿐 — 노랑(무난함)은 말이 안 된다
  ST:{AMC:55,AML:45,AMR:45,LW:50,RW:50}
};
/* 능숙도 눈금 — 위 세 칸이 전부 초록 계열이라 화면에서 구분이 안 갔다.
   초록 → 연두 → 노랑 → 주황 → 빨강으로 색상환을 따라 내려가게 다시 짰다. */
const FAM_LV=[
  {min:96,n:"자연스러움",c:"#00d26a"},   // 원래 자리
  {min:85,n:"매우 능숙", c:"#5ce65c"},
  {min:70,n:"능숙함",   c:"#a8e04a"},   // 연두
  {min:55,n:"무난함",   c:"#e3d34a"},   // 노란빛
  {min:40,n:"미숙함",   c:"#e8a33a"},   // 주황
  {min:20,n:"어색함",   c:"#e8683a"},
  {min:0, n:"못함",     c:"#f85149"}
];
function famLevel(v){ for(const l of FAM_LV) if(v>=l.min) return l; return FAM_LV[FAM_LV.length-1]; }
/* ═══ 🎓 역할 능숙도 (Role Familiarity) ══════════════════════════════════
   포지션 능숙도가 「이 자리를 아는가」라면, 이건 「이 자리에서 이 역할을 아는가」다.
   같은 중앙 미드필더라도 앵커와 전진형 플레이메이커는 하는 일이 전혀 다르다 —
   서는 위치도, 공을 받는 타이밍도, 공을 잃었을 때 돌아가는 길도 다르다.
   ─ 그 역할로 뛴 만큼 오르고, 쓰지 않으면 아주 천천히 잊는다.
   ─ 낮으면 판단·위치선정이 흔들리고, 역할 지시(전진 성향 등)도 덜 먹힌다.
     무게는 포지션 능숙도의 절반이다 — 자리를 아는 것이 먼저고, 역할은 그 위에 얹힌다. */
const RFAM_GAIN=2.6;        // 풀타임 한 경기 — 한 시즌을 그 역할로 뛰면 바닥에서 「매우 능숙」까지 간다
const RFAM_DECAY=0.06;      // 쓰지 않는 역할이 한 경기마다 잊히는 정도
const RFAM_FLOOR=1;         // 한 번 배운 역할을 완전히 잊지는 않는다
const RFAM_SEED_MAIN=88;    // 주 역할 — 프로에 오기까지 몸에 밴 역할이 하나는 있다
const RFAM_SEED_SUB=68;     // 두 번째로 잘 맞는 역할
const RFAM_SEED_GRP=30;     // 같은 자리의 나머지 역할 — 개념은 알지만 해본 적은 적다
const RFAM_SEED_LO=26, RFAM_SEED_HI=52;   // 나머지는 적합도에 비례해 이 구간에 깔린다
const RFAM_MIN=0.55;        // 능숙도 0 일 때 남는 비율 (포지션은 0.10 — 딱 절반 무게)
const RFAM_POW=0.75;
const RFAM_LV=[
  {min:92,n:"완전히 체화", c:"#00d26a"},
  {min:78,n:"매우 능숙",   c:"#5ce65c"},
  {min:62,n:"능숙함",     c:"#a8e04a"},
  {min:45,n:"익히는 중",   c:"#e3d34a"},
  {min:28,n:"서투름",     c:"#e8a33a"},
  {min:0, n:"처음 맡는다", c:"#f85149"}
];
function roleFamLevel(v){ for(const l of RFAM_LV) if(v>=l.min) return l; return RFAM_LV[RFAM_LV.length-1]; }
/* 기본값은 「저장하지 않고」 그때그때 계산한다 — 구세이브도 불러오는 즉시 자기 주 역할을 갖고
   시작하고, 세이브에는 실제로 뛰어서 바뀐 값만 남는다(선수 1,000명 × 16역할을 통째로 저장하면
   세이브가 100KB 넘게 불어난다). 캐시는 열거되지 않는 속성이라 JSON 에 딸려 나가지 않는다. */
function seedRoleFam(p){
  if(p._rfSeed) return p._rfSeed;
  const f={};
  try{
    const all=rolesForSlot(prefSlotOf(p));
    const fitOf={}; for(const R of all) fitOf[R.k]=roleFit(p, R.k);
    const list=all.slice().sort((a,b)=>fitOf[b.k]-fitOf[a.k]);
    const top=Math.max(0.5, fitOf[list[0].k]||0.5);
    /* 주 역할 둘은 몸에 배어 있고, 나머지는 「능력치가 얼마나 맞는가」에 비례해 낮게 깔린다.
       비슷한 결의 역할이면 조금 덜 낯설다 — 앵커를 보던 선수가 수비형 미드필더를 처음 맡는 것과,
       포처가 트레콰르티스타를 맡는 것은 같은 낯섦이 아니다. */
    list.forEach((R,i)=>{
      f[R.k] = i===0 ? RFAM_SEED_MAIN : i===1 ? RFAM_SEED_SUB
             : Math.round(clamp(RFAM_SEED_LO + (fitOf[R.k]/top)*(RFAM_SEED_HI-RFAM_SEED_LO), RFAM_SEED_LO, RFAM_SEED_HI));
    });
  }catch(e){}
  try{ Object.defineProperty(p, "_rfSeed", {value:f, enumerable:false, writable:true, configurable:true}); }
  catch(e){ p._rfSeed=f; }
  return f;
}
function getRoleFam(p, rk){
  if(!p || !rk) return 0;
  const own = p.roleFam ? p.roleFam[rk] : null;
  if(own!=null) return clamp(Math.round(own), 0, 100);
  const s=seedRoleFam(p)[rk];
  return clamp(Math.round(s==null?RFAM_SEED_LO:s), 0, 100);
}
function gainRoleFam(p, rk, mins){
  if(!p || !rk || !(mins>=15)) return;          // 15분 미만은 배우는 게 없다
  if(!p.roleFam) p.roleFam={};
  const cur=getRoleFam(p, rk);
  if(cur<100) p.roleFam[rk]=Math.round(clamp(cur + RFAM_GAIN*Math.min(1, mins/90), 0, 100)*10)/10;
  else p.roleFam[rk]=100;
  /* 쓰지 않는 역할은 아주 천천히 잊는다 — 실제로 뛰어 본 역할만 해당한다 */
  for(const k in p.roleFam){
    if(k===rk) continue;
    if(p.roleFam[k]>RFAM_FLOOR) p.roleFam[k]=Math.round(Math.max(RFAM_FLOOR, p.roleFam[k]-RFAM_DECAY)*10)/10;
  }
}
/* 별점·엔진에 곱하는 배수 */
function roleFamMul(v){
  const f=clamp(v/100, 0, 1);
  return RFAM_MIN + (1-RFAM_MIN)*Math.pow(f, RFAM_POW);
}
/* 선호 포지션을 기준으로 초기 능숙도를 만든다 */
function initPosFam(p){
  const home = SLOT_FAM[p.prefPos] || (p.pos==="GK"?"GK":p.pos==="DF"?"DC":p.pos==="MF"?"MC":"ST");
  const f={};
  // 아예 해본 적 없는 자리는 0 — 화면에도 표시하지 않는다
  for(const k of FAM_POS) f[k]=0;
  if(p.pos==="GK"){ f.GK=100; }
  else {
    f[home]=100;
    const near=FAM_NEAR[home]||{};
    for(const k in near) f[k]=Math.max(f[k], near[k]);
  }
  return f;
}
/* ═══════════════════════════════════════════════════════════════
   🧭 포지션 대분류(GK·DF·MF·FW)는 「능숙도」가 정한다.
   등록 포지션(p.pos)은 실제 구단 등록 자료를 그대로 옮긴 값이라, 왼쪽 풀백으로만
   뛰는데 FW로 등록된 선수처럼 실제와 어긋나는 경우가 있다(제보). 화면에 찍히는
   대분류와 능숙도가 따로 노는 건 어느 쪽을 믿어야 할지 알 수 없게 만든다.
   가장 능숙한 자리가 속한 라인을 대분류로 삼는다 — 보이는 것과 실제를 일치시킨다.
   ⚠ 윙백(WBL/WBR)은 FM 관례대로 수비 라인, AML/AMR 은 미드필더로 본다. */
const FAM_LINE={ GK:"GK",
  SW:"DF", DC:"DF", DL:"DF", DR:"DF", WBL:"DF", WBR:"DF",
  DM:"MF", MC:"MF", ML:"MF", MR:"MF", AMC:"MF", AML:"MF", AMR:"MF",
  LW:"FW", RW:"FW", ST:"FW" };
function posFromFam(p){
  if(!p) return "MF";
  const f=p.posFam;
  if(!f) return p.pos||"MF";
  /* 🧯 골키퍼는 겸업이 없다 — 다만 「주 포지션이 필드 자리인데 GK 능숙도 100」은
     있을 수 없는 조합이다(오염된 세이브). 그런 값은 근거로 쓰지 않는다.
     ⚠ 제보 — 「세이브를 불러오면 선수가 전부 GK로 바뀌고 유스 11명이 긴급 등록된다」.
        에디터로 포지션을 고쳐도 다음 불러오기에서 다시 GK가 됐다 — 여기가 되돌리고 있었다. */
  const _pref=p.prefPos;
  const _fieldPref = !!(_pref && _pref!=="GK" && SLOT_FAM[_pref]);
  if((f.GK||0)>=90 && !_fieldPref) return "GK";
  let bs=-1, bk=null;
  for(const k of FAM_POS){ if(k==="GK") continue; const v=f[k]||0; if(v>bs){ bs=v; bk=k; } }
  /* 동률이면 주 포지션 쪽을 존중한다 — 순회 순서가 대분류를 정해 버리면 안 된다 */
  const hk=SLOT_FAM[p.prefPos];
  if(hk && hk!=="GK" && (f[hk]||0)>=bs) bk=hk;
  if(bs<50 || !bk) return p.pos||"MF";  // 아직 아무 자리도 못 익힌 선수는 등록값을 따른다
  return FAM_LINE[bk] || p.pos || "MF";
}
/* ═══ 🧯 「전 선수가 골키퍼가 되는」 세이브 복구 ═════════════════════════
   posFam.GK 가 100으로 오염되면 posFromFam 이 그 선수를 GK로 읽고, syncPosBand 가
   등록 포지션까지 GK로 덮어쓴다. 그러면 필드 자원이 0이 되어 ensureSquad 가
   유스 11명을 긴급 등록하고, 에디터로 고쳐도 다음 불러오기에서 원상 복구된다.
   불러오는 시점에 이 조합을 찾아 되돌린다 — 진짜 골키퍼는 절대 건드리지 않는다. */
let GK_FIXED_N=0;   // 진단용 — 세이브에는 남기지 않는다
function looksLikeRealGK(p){
  if(!p) return false;
  if(p.prefPos==="GK") return true;                       // 주 포지션이 골키퍼 — 진짜다
  const f=p.posFam||{};
  let mx=0; for(const k of FAM_POS){ if(k==="GK") continue; if((f[k]||0)>mx) mx=f[k]||0; }
  /* 골키퍼 능력치(gkA)를 갖고 있고 필드 자리를 소화하지 못한다 — 진짜 키퍼다.
     ⚠ 이 검사는 반드시 migrateSave 「전에」 돌아야 한다. 거기서 pos==="GK" 인 선수에게
        gkA 를 만들어 붙이기 때문에, 뒤에 돌리면 오염된 선수까지 키퍼로 보이게 된다. */
  const gk=p.gkA;
  if(gk && ((gk.ref||0)>0 || (gk.han||0)>0 || (gk.cmd||0)>0) && mx<60) return true;
  if(p.prefPos && SLOT_FAM[p.prefPos]) return false;      // 필드 자리를 주 포지션으로 가졌다 — 아니다
  if(mx>=60) return false;                                // 필드 자리를 능숙하게 소화한다
  const a=p.attr||{};
  /* 주 포지션 정보조차 없다 — 능력치로 가른다. 키퍼는 마무리·드리블·태클이 낮다. */
  if((a.fin||0)>=45 || (a.dri||0)>=52 || (a.tck||0)>=52) return false;
  return true;
}
function repairFakeGK(arr){
  if(!Array.isArray(arr)) return 0;
  let n=0;
  for(const p of arr){
    if(!p || typeof p!=="object") continue;
    const f=p.posFam;
    const bogus = ((f && (f.GK||0)>=90) || p.pos==="GK") && !looksLikeRealGK(p);
    if(!bogus) continue;
    /* GK 능숙도만 걷어낸다 — 경기로 쌓은 필드 자리 능숙도는 그대로 둔다 */
    let mx=0;
    if(f){ f.GK=0; for(const k of FAM_POS){ if(k==="GK") continue; if((f[k]||0)>mx) mx=f[k]||0; } }
    if(!f || mx<=0){
      /* 남은 근거가 없다 — 주 포지션을 능력치로 다시 추론하고 능숙도를 새로 깐다 */
      const a=p.attr||{};
      p.pos = ((a.fin||0)>=(a.tck||0) && (a.fin||0)>=(a.pass||a.pas||0)) ? "FW"
            : ((a.tck||0)>=(a.pass||a.pas||0) ? "DF" : "MF");
      if(!p.prefPos || p.prefPos==="GK" || !SLOT_FAM[p.prefPos]) p.prefPos=inferPrefPos(p);
      p.posFam=initPosFam(p);
    }
    delete p._posLock;
    delete p.gkA;                     // 오염 과정에서 억지로 붙은 골키퍼 능력치
    const np=posFromFam(p);
    if(np && np!=="GK") p.pos=np;
    else if(p.pos==="GK") p.pos="MF";
    n++;
  }
  return n;
}
/* 능숙도가 바뀌면 대분류도 따라 바뀐다 — 자리를 새로 익힌 선수는 소속 라인이 옮겨진다 */
function syncPosBand(p){
  if(!p || !p.posFam || p._posLock) return;   // 손으로 못 박은 대분류는 건드리지 않는다
  const np=posFromFam(p);
  if(np && np!==p.pos) p.pos=np;
}
function getPosFam(p, slot){
  if(!p) return 0;
  if(!p.posFam) p.posFam=initPosFam(p);
  const k=SLOT_FAM[canonSlot(slot)]||SLOT_FAM[slot];
  if(!k) return 50;
  return clamp(Math.round(p.posFam[k]||0), 0, 100);
}
/* 경기를 뛰면 그 자리 능숙도가 오른다 — 어릴수록, 팀워크·판단력이 좋을수록 빨리 배운다.
   FM처럼 100(자연스러움)에 가까워질수록 느려지고, 안 뛴 자리는 아주 천천히 잊는다. */
function gainPosFam(p, slot, mins){
  if(!p || p.pos==="GK" || !slot) return;
  if(!p.posFam) p.posFam=initPosFam(p);
  const k=SLOT_FAM[canonSlot(slot)]||SLOT_FAM[slot];
  if(!k) return;
  /* 한 경기를 소화하면 그 자리 능숙도 +2.
     · 출전 시간 비례 — 풀타임 +2, 후반 교체 45분이면 +1
     · 15분 미만 출전은 배우는 게 없다 (막판 시간 끌기 투입)
     · 100에서 멈춘다. 나이·재능 페널티 없음 — 뛰면 는다, 단순하고 예측 가능하게 */
  if(mins<15) return;
  const cur=p.posFam[k]||0;
  if(cur>=100) return;
  /* 🧑‍🏫 멘토가 붙은 유망주는 그 자리를 더 빨리 익힌다 — 옆에서 계속 잡아 주기 때문이다.
     경기 중 성장(능력치)에 이미 튜터 보정이 있었는데, 「자리 능숙도」에는 없었다. */
  let tk=1;
  try{
    if(p.tutor){
      const tt=teamOfPlayer(p);
      const mt=tt && (tt.players||[]).find(x=>x.id===p.tutor.id);
      if(mt && !mt.sulk) tk=FAM_TUTOR_K;
      else if(!mt) p.tutor=null;                 // 멘토가 팀을 떠났으면 해제
    }
  }catch(e){}
  p.posFam[k]=clamp(cur + FAM_GAIN*tk*Math.min(1, mins/90), 0, 100);
  /* 오래 안 선 자리를 조금씩 잊는 건 유지 — 대신 아주 완만하게, 바닥(FAM_FLOOR) 아래로는 안 내려간다 */
  for(const q of FAM_POS){
    if(q===k || q==="GK") continue;
    if(p.posFam[q]>FAM_FLOOR) p.posFam[q]=Math.max(FAM_FLOOR, p.posFam[q]-FAM_DECAY);
  }
}
const FAM_GAIN=2;      // 한 경기 풀타임으로 오르는 능숙도 — 시즌 풀타임이면 +76
const FAM_TUTOR_K=1.5; // 🧑‍🏫 멘토가 붙어 있으면 자리 능숙도가 1.5배로 붙는다
const FAM_DECAY=0.10;  // 뛰지 않은 자리가 한 경기마다 잊히는 정도
const FAM_FLOOR=1;     // 한 번 배운 자리는 완전히 잊지는 않는다
function posFitLevel(p, slot){
  if(!p || !slot) return null;
  const pref=p.prefPos || (p.pos==="GK"?"GK":null);
  if(!pref) return null;
  const cs=canonSlot(slot);
  if(cs==="GK" || pref==="GK") return (cs==="GK" && pref==="GK") ? "green" : "red";
  if(cs===pref) return "green";
  return slotBand(cs)===slotBand(pref) ? "yellow" : "red";
}
/* ═══ 🔁 교체 궁합 — 지금 고른 선수와 바꿔도 되는 자리인가 ═══════════════════
   ⚠ 제보 — 「교체하려고 선수를 찍었을 때, 같은 포지션에서 뛸 수 있는 선수가 색으로 보이면
      FM처럼 직관적일 것 같다」.
   ─ 교체는 「서로 자리를 바꾸는」 일이다. 그래서 한 방향만 보면 안 된다.
     ① 내가 저 자리로 갈 수 있는가 ② 저 선수가 내 자리로 올 수 있는가 — 둘 중 낮은 쪽이 궁합이다.
     (벤치·미등록 선수는 들어올 자리만 보면 된다) */
function swapSlotOf(t, p){
  try{
    const s=(t.tactic && t.tactic.slot && t.tactic.slot[p.id]) || null;
    return s || prefSlotOf(p);
  }catch(e){ return prefSlotOf(p); }
}
function swapFitVal(t, sel, p){
  if(!sel || !p || sel.id===p.id) return null;
  const onXI=(id)=>{ try{ return !!(t.tactic && t.tactic.slot && t.tactic.slot[id]); }catch(e){ return false; } };
  const selSlot=swapSlotOf(t, sel), pSlot=swapSlotOf(t, p);
  let v=getPosFam(p, selSlot);                       // 저 선수가 내 자리로 올 수 있는가
  if(onXI(p.id)) v=Math.min(v, getPosFam(sel, pSlot));  // 둘 다 그라운드면 반대 방향도 본다
  return v;
}
/* 클래스 — 초록(자연스러움) · 노랑(어색함) · 빨강(해본 적 없음) */
function swapFitCls(t, p){
  if(selSwap==null || !p || p.id===selSwap) return "";
  let sel=null; try{ sel=t.players.find(x=>x.id===selSwap); }catch(e){}
  if(!sel) return "";
  const v=swapFitVal(t, sel, p);
  if(v==null) return "";
  return v>=60 ? "swapOk" : v>=25 ? "swapMid" : "swapBad";
}
function posFitDot(p, slot){
  if(!p || !slot) return "";
  const v=getPosFam(p, slot), L=famLevel(v);
  const title=`${FAM_LABEL[SLOT_FAM[canonSlot(slot)]||slot]||slot} 능숙도 ${v} — ${L.n}`;
  return `<span class="posfit" title="${title}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${L.c};margin-left:5px;margin-right:2px;vertical-align:middle;box-shadow:0 0 3px ${L.c}"></span>`;
}
/* ── 등번호 ────────────────────────────────────────────────────
   실제 축구처럼 포지션대로 낮은 번호를 먼저 준다. 골키퍼 1, 수비 2~5,
   미드필더 6~8, 공격수 9~11, 나머지는 12번부터 차례로. */
const SQ_PREF={GK:[1,21,31,41], DF:[3,4,5,2,6,15,20,23,25,26,30],
               MF:[6,7,8,10,14,16,17,22,24,27,28], FW:[9,11,18,19,29,33,37,77,99]};
/* ═══════════════════════════════════════════════════════════════
   주장 · 부주장
   FM처럼 감독이 직접 고른다. 선수단은 "누가 완장을 차야 하는가"에 대해 각자 생각이 있고,
   납득이 안 되는 선택에는 반발한다. 판단 기준은 셋이다.
     · 리더십·팀워크 — 완장의 자격
     · 실력(별점)    — 라커룸에서 말이 먹히려면 경기장에서 먼저 보여야 한다
     · 나이·경력     — 어린 선수가 완장을 차면 선배들이 술렁인다
═══════════════════════════════════════════════════════════════ */
function capScore(p){
  const a=p.attr||{};
  const age=G.season-p.by;
  return attr20(a.ldr||60)*3.0 + attr20(a.tea||60)*1.8 + attr20(a.det||60)*1.0
       + attr20(a.cmp||60)*0.8 + (playerLevel(p)-leagueLevel())*0.55
       + clamp((age-22)*0.9, -6, 8) + Math.min(6, (p.career||0)/40);
}
function capCandidates(t){
  return [...t.players].filter(p=>!p.loan && !p.sulk)
    .sort((a,b)=>capScore(b)-capScore(a));
}
/* 선수단이 이 선택을 받아들이는 정도 (0~1). 낮으면 라커룸이 술렁인다. */
function capApproval(t, p){
  const ranked=capCandidates(t);
  const idx=ranked.findIndex(x=>x.id===p.id);
  const best=ranked[0]?capScore(ranked[0]):1;
  const gap=best-capScore(p);
  let ap=1 - gap/28 - Math.max(0, idx-2)*0.03;
  const a=p.attr||{};
  if(attr20(a.ldr||60)<10) ap-=0.18;
  if(attr20(a.tea||60)<10) ap-=0.10;
  if((G.season-p.by)<=21) ap-=0.15;
  if(p.unhappy>0) ap-=0.12*p.unhappy;
  return clamp(ap, 0, 1);
}
function capInfo(t){
  t.cap=t.cap||{};
  if(t.cap.s!==G.season){ t.cap={s:G.season, c:t.cap.c, v:t.cap.v, set:false}; }
  return t.cap;
}
function captainOf(t){ const c=capInfo(t); return c.c ? t.players.find(p=>p.id===c.c) : null; }
function viceOf(t){ const c=capInfo(t); return c.v ? t.players.find(p=>p.id===c.v) : null; }
/* 🎯 새 시즌 목표를 아직 안 세웠는가 — 부임 절차를 마친 감독만 해당(부임 중엔 인사 흐름이 담당) */
function goalNeeded(){
  if(G.jobless || !G.introDone) return false;
  return !(G.goal && G.goal.s===G.season);
}
/* ⚠ 제보 — 「주장단 선임 필요에서 자진 사임하면 진행 버튼이 그 상태로 멈춘다」.
   goalNeeded 에는 무직 가드가 있었는데 여기에는 없었다. 팀을 떠난 뒤에도 옛 팀의 주장이
   비어 있다고 판정해 진행 버튼이 「🎖️ 주장단 선임 필요」로 굳고, 눌러도 무직에게는 잠겨 있는
   스태프 화면으로 보내 버려서 아무것도 못 하게 된다. 맡은 팀이 없으면 주장도 없다. */
function capNeeded(){
  if(G.jobless || !G.introDone) return false;
  const t=userTeam(); if(!t) return false;
  const c=capInfo(t); return !c.set || !captainOf(t);
}
function setCaptain(pid, role){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p) return;
  const c=capInfo(t);
  if(role==="c"){ if(c.v===pid) c.v=null; c.c=pid; } else { if(c.c===pid) c.c=null; c.v=pid; }
  saveGame(); show("staff");
}
/* 완장을 확정한다 — 이때 선수단이 반응한다 */
function confirmCaptains(){
  const t=userTeam(); const c=capInfo(t);
  const cap=captainOf(t), vice=viceOf(t);
  if(!cap){ flash("주장을 먼저 지정하세요.","warn"); return; }
  c.set=true;
  const ap=capApproval(t, cap);
  const apV=vice?capApproval(t, vice):1;
  cap.morale=clamp(cap.morale+9,20,99); affAdd(cap, 8, "주장 선임");
  if(vice){ vice.morale=clamp(vice.morale+5,20,99); affAdd(vice, 5, "부주장 선임"); }
  const V={p:cap.name, t:t.short, o:vice?vice.name:""};
  let react;
  if(ap>=0.75){
    for(const q of t.players) q.morale=clamp(q.morale+2,20,99);
    t.morale=clamp((t.morale||70)+1.5,40,99);
    react=`<div class="msg good" style="border-width:2px">✅ <b>선수단이 고개를 끄덕였습니다.</b><br>
      ${pick([`"${cap.name}이면 다들 인정하죠."`,`"진작에 완장 줬어야 했습니다."`,`"라커룸에서 제일 말이 통하는 형입니다."`])}
      <span class="small"> — 팀 사기 +1.5</span></div>`;
    socialFill(SOC.capOk, 3+R(2), 1, V);
  } else if(ap>=0.45){
    react=`<div class="msg info">🤔 <b>조용히 받아들였습니다.</b><br>
      ${pick([`"감독님이 정하신 거니까요."`,`"뭐, 해보면 알겠죠."`,`"의외이긴 한데 지켜보겠습니다."`])}</div>`;
  } else {
    for(const q of t.players){ if(q.id===cap.id) continue;
      const my=capScore(q);
      if(my>capScore(cap)+6){ q.morale=clamp(q.morale-6,20,99); affAdd(q, -6, "주장 선임 불복"); }
      else q.morale=clamp(q.morale-2,20,99);
    }
    t.morale=clamp((t.morale||70)-4,40,99);
    const senior=capCandidates(t).find(q=>q.id!==cap.id);
    react=`<div class="msg warn" style="border-width:2px">💢 <b>라커룸이 술렁였습니다.</b><br>
      ${senior?`${senior.name}: ${pick([`"...제가 뭘 잘못했습니까?"`,`"납득이 안 되는데요."`,`"감독님 뜻이라면 따르겠습니다만."`])}`:""}
      <span class="small"> — 팀 사기 -4, 일부 선수 호감도 하락</span></div>`;
    socialFill(SOC.capBad, 3+R(2), -1, V);
  }
  addNews(`🎖️ ${G.season} 시즌 주장 <b>${cap.name}</b>${vice?` · 부주장 ${vice.name}`:""} 선임`, ap>=0.75?"good":undefined);
  pushFeed({cat:"club", ic:"🎖️", tone:ap>=0.75?1:ap<0.45?-1:0, tid:t.id, src:"구단 공식",
    head:`${t.name}, ${G.season} 시즌 주장에 ${cap.name}`,
    sub:vice?`부주장은 ${vice.name}이/가 맡는다.`:`부주장은 아직 정해지지 않았다.`});
  staffLog(`주장 ${cap.name}${vice?` · 부주장 ${vice.name}`:""} 선임 (선수단 수용도 ${Math.round(ap*100)}%)`);
  capInfo(t).react=react;
  saveGame(); show("staff");
}
/* ═══════════════════════════════════════════════════════════════
   영구결번
   K리그는 개인 영구결번이 드물고, 대신 서포터즈에게 12번을 헌정하는 문화가 보편적이다
   (1997년 부천 SK가 서포터즈 '헤르메스'에게 12번을 준 것이 국내 최초).
   기본값으로 실제 현황을 넣어 두고, 감독이 스태프 회의에서 추가로 지정할 수 있게 한다.
═══════════════════════════════════════════════════════════════ */
const RETIRED_DEF={
  // ── 선수 개인 영구결번
  jeonbuk:[[20,"이동국","K리그 최다 득점자, 전북 왕조의 주역"],[25,"최철순","20년 원클럽맨"],
           [12,"MGB","서포터즈"]],
  seoul:  [[13,"고요한","20년 원클럽맨, 구단 최다 출장"]],
  busan:  [[16,"김주성","K리그 최초의 영구결번 · 아시아의 야생마"],[12,"서포터즈",""]],
  suwon:  [[38,"윤성효","창단 멤버의 헌신"],[12,"그랑블루","서포터즈"]],
  // ── 서포터즈 12번 (K리그1)
  ulsan:[[12,"처용전사","서포터즈"]], pohang:[[12,"쇠부리","서포터즈"]],
  jeju:[[12,"풍백","서포터즈"]], gwangju:[[12,"빛고을","서포터즈"]],
  daejeon:[[12,"대전러버스","서포터즈"]], incheon:[[12,"파랑검투사","서포터즈"]],
  gangwon:[[12,"나르샤","서포터즈"]], anyang:[[12,"RED","서포터즈"]],
  // ── 서포터즈 12번 (K리그2)
  jeonnam:[[12,"와이번즈","서포터즈"]], seongnam:[[12,"클랜","서포터즈"]],
  bucheon:[[12,"헤르메스","서포터즈 · 국내 최초 12번 헌정(1997)"]],
  seoule:[[12,"목동","서포터즈"]], asan:[[12,"아산","서포터즈"]],
  gimpo:[[12,"김포","서포터즈"]], gyeongnam:[[12,"경남","서포터즈"]],
  cheongju:[[12,"청주","서포터즈"]], ansan:[[12,"안산","서포터즈"]],
  cheonan:[[12,"천안","서포터즈"]],
  // ── 특수
  daegu:[[12,"그라지예","서포터즈"],[1004,"엔젤클럽","시민 주주 모임"]]
};
function retiredList(t){
  if(!t) return [];
  if(!t.retired) t.retired=(RETIRED_DEF[t.id]||[]).map(([n,who,why])=>({n, who, why, def:true}));
  return t.retired;
}
function isRetiredNo(t, n){ return retiredList(t).some(r=>r.n===n); }
function retireNumber(pid){
  const t=userTeam(); const p=t.players.find(x=>x.id===pid); if(!p||!p.no) return;
  const n=p.no;
  if(isRetiredNo(t, n)){ flash(`${n}번은 이미 영구결번입니다.`,"warn"); return; }
  showConfirm(`<b>🎽 영구결번 지정</b>\n\n${p.name} 선수의 ${n}번을 영구결번으로 지정합니다.\n\n· 이 번호는 앞으로 어떤 선수도 달 수 없습니다\n· 선수단과 팬이 이 결정을 기억합니다\n\n지정하시겠습니까?`, ()=>{
    retiredList(t).push({n, who:p.name, why:`${G.season}시즌 지정`, s:G.season});
    p.morale=clamp(p.morale+10,20,99); affAdd(p, 10, "영구결번 지정");
    for(const q of t.players) q.morale=clamp(q.morale+1,20,99);
    notify(`🎽 <b>${p.name}</b> 선수의 <b>${n}번</b>이 영구결번으로 지정되었습니다`,"good");
    pushFeed({cat:"club", ic:"🎽", tone:1, tid:t.id, src:"K리그 공식",
      head:`${t.name}, ${p.name}의 ${n}번 영구결번 지정`,
      sub:`구단은 "이 번호는 앞으로 누구도 달지 않는다"고 밝혔다.`});
    socialFill(SOC.retireNo, 3+R(3), 1, {p:p.name, t:t.short, n});
    fmkFill(FMK.retireNo, 2+R(3), {p:p.name, t:t.short, n});
    rivalFill(FMK.retireNo, 1+R(2), 1, {p:p.name, t:t.short, n});
    staffLog(`${p.name}의 ${n}번을 영구결번으로 지정했습니다.`);
    saveGame(); show("staff");
  }, {okLabel:"지정"});
}
function unretireNumber(n){
  const t=userTeam();
  const i=retiredList(t).findIndex(r=>r.n===n);
  if(i<0) return;
  if(t.retired[i].def){ flash("구단 전통으로 내려오는 결번은 해제할 수 없습니다.","warn"); return; }
  const r=t.retired[i]; t.retired.splice(i,1);
  addNews(`🎽 ${r.n}번 영구결번 해제 (${r.who})`);
  saveGame(); show("staff");
}
function assignNumbers(t){
  const used=new Set();
  for(const r of retiredList(t)) used.add(r.n);      // 영구결번은 아무도 못 단다
  for(const p of t.players) if(p.no) used.add(p.no);
  // 능력치가 높은 선수부터 좋은 번호를 가져간다
  const order=[...t.players].sort((a,b)=>(b.ovr||0)-(a.ovr||0));
  for(const p of order){
    if(p.no) continue;
    const pref=SQ_PREF[p.pos]||SQ_PREF.MF;
    let n=pref.find(x=>!used.has(x));
    if(!n){ n=12; while(used.has(n) && n<99) n++; }
    p.no=n; used.add(n);
  }
}
/* ── 등번호 ───────────────────────────────────────────────────
   한 팀 안에서 번호는 유일해야 한다. 이적해 온 선수는 쓰던 번호를 그대로 쓰려 하고,
   그 번호가 이미 임자가 있으면 포지션별 선호 번호에서 빈 자리를 찾는다. */
function numTaken(t, n, exceptId){
  return t.players.some(p=>p.no===n && p.id!==exceptId);
}
function freeNumberFor(t, p){
  const pref=SQ_PREF[p.pos]||SQ_PREF.MF;
  let n=pref.find(x=>!numTaken(t,x,p.id));
  if(!n){ n=1; while(n<100 && numTaken(t,n,p.id)) n++; }
  return n<100?n:null;
}
/* 선수가 새 구단에 합류한다 — 번호 정리까지 여기서 끝낸다 */
/* 🧳 팀을 옮기면 지난 팀에서의 앙금은 두고 간다.
   ⚠ 제보 — 「태업하던 선수를 팔았는데 새 팀에서도 계속 태업 상태다」.
      판매 처리에서 unhappy·promise 는 지우면서 sulk(태업)만 빠져 있었다.
      잔류 선언·멘토 관계·설득 이력처럼 「그 구단에서만 뜻이 있는」 값도 함께 정리한다. */
function clearClubBaggage(p, morale){
  if(!p) return;
  p.unhappy=0; p.uWhy=""; p.promise=null; p.promiseBroken=0;
  p.sulk=0; p.noMove=false; p.tutor=null;
  p.talkR=-9;
  try{ delete p.okOut; }catch(e){}      // 🚪 새 구단에서는 「보내 주기로 한 약속」도 초기화된다
  try{ delete p._persuaded; delete p._persuadeR; delete p._recallTried; delete p.emg; }catch(e){}
  if(morale!=null) p.morale=clamp(morale, 25, 99);
}
/* 📚 한 시즌 안에서 거쳐 간 팀 — 군 전역·임대 복귀·여름 이적으로 소속이 바뀔 때마다 구간을 끊는다.
   ⚠ 제보 — 「시즌 중에 팀이 바뀐 선수는 커리어의 소속 칸에 현 소속만 뜬다.
     그 팀에서만 쌓은 기록인 줄 착각하게 된다」.
   ─ 팀에 들어오는 그 순간의 누적 기록을 찍어 두면, 구간별 성적을 뺄셈으로 정확히 뽑을 수 있다.
     기록 자체는 어디서도 초기화되지 않는다(실측 확인) — 나뉘어 보이지 않았을 뿐이다. */
function noteLeg(t, p){
  try{
    if(!p || !t) return;
    if(!Array.isArray(p.sLeg)) p.sLeg=[];
    if(p.sLeg.length && p.sLeg[p.sLeg.length-1].s!==G.season) p.sLeg=[];   // 시즌이 바뀌면 새로
    const last=p.sLeg.length?p.sLeg[p.sLeg.length-1]:null;
    if(last && last.t===t.id) return;                                     // 같은 팀이면 구간이 이어진다
    p.sLeg.push({s:G.season, t:t.id, sh:t.short||"", d:G.day||0,
                 ap0:p.apps||0, g0:p.goals||0, a0:p.assists||0, r0:p.rTot||0});
    if(p.sLeg.length>6) p.sLeg=p.sLeg.slice(-6);
  }catch(e){}
}
/* 🗓️ 시즌이 열릴 때 모두에게 「출발 소속」 도장을 찍는다.
   ⚠ 제보 — 「순위표 득점·도움 순위에 그 시즌 거쳐간 모든 팀을 병기해 달라」.
      구간(sLeg)은 입단할 때만 찍혀서, 시즌 중에 옮긴 선수는 「새 팀」 한 구간만 남았다.
      원래 어디서 출발했는지가 없으니 「전북 → 울산」을 적을 수가 없었다. */
function seasonLegInit(){
  try{
    for(const id in G.teams){
      const t=G.teams[id]; if(!t || !Array.isArray(t.players)) continue;
      for(const p of t.players){
        if(!p) continue;
        p.sLeg=[{s:G.season, t:t.id, sh:t.short||"", d:G.day||0, ap0:0, g0:0, a0:0, r0:0}];
      }
    }
  }catch(e){}
}
/* 이번 시즌 「실제로 뛴」 구단들 — 순위표 소속 칸이 이걸 읽는다 (제보).
   임대를 갔으면 임대 구단, 시즌 중 옮겼으면 거쳐간 팀을 순서대로 모두 적는다. */
function seasonClubsOf(p, cur){
  const fb=[{id:(cur&&cur.id)||null, sh:(cur&&cur.short)||"?", ap:p.apps||0, g:p.goals||0, a:p.assists||0}];
  try{
    const L=seasonLegs(p);
    if(!L || !L.length) return fb;
    const rows=L.map(x=>({id:x.t, sh:x.sh || ((G.teams[x.t]||{}).short) || "?", ap:x.ap|0, g:x.g|0, a:x.a|0}));
    /* 한 경기도 못 뛴 구간은 「거쳐갔다」고 적을 것이 없다 — 다만 전부 0이면 지금 소속만 남긴다 */
    const played=rows.filter(x=>x.ap>0 || x.g>0 || x.a>0);
    if(!played.length) return fb;
    /* 지금 소속은 기록이 없어도 마지막에 붙여 준다 — 「어디 소속인지」는 알아야 하니까 */
    if(cur && !played.some(x=>x.id===cur.id) && rows.length && rows[rows.length-1].id===cur.id)
      played.push(rows[rows.length-1]);
    return played;
  }catch(e){}
  return fb;
}
/* 순위표 소속 칸 — 한 곳이면 종전대로, 여러 곳이면 「전북 → 울산」처럼 병기한다 */
function seasonClubCell(p, cur, kind){
  const cl=seasonClubsOf(p, cur);
  const tip=cl.map(x=>`${x.sh} ${x.ap}경기 ${x.g}골 ${x.a}도움`).join(" · ");
  const one=(x)=>`<span class="clickable peekOK" onclick="event.stopPropagation();openTeamSquad('${x.id}')" style="text-decoration:underline dotted;text-underline-offset:3px">${x.sh}</span>`;
  if(cl.length<=1) return `<td title="${tip}">${one(cl[0])}</td>`;
  const body=cl.map((x,i)=>{
    const n=(kind==="a")?x.a:x.g;
    return one(x)+(n>0?`<span class="small" style="opacity:.75">${n}</span>`:"");
  }).join(`<span style="opacity:.45;margin:0 2px">→</span>`);
  return `<td title="${tip}" style="white-space:nowrap">${body}</td>`;
}
/* 이번 시즌 구간별 성적 — 두 곳 이상을 거쳤을 때만 의미가 있다 */
function seasonLegs(p){
  const L=(Array.isArray(p&&p.sLeg)?p.sLeg:[]).filter(x=>x && x.s===G.season);
  if(L.length<2) return null;
  const out=[];
  for(let i=0;i<L.length;i++){
    const a=L[i], b=L[i+1];
    const ap=Math.max(0, (b?b.ap0:(p.apps||0))-(a.ap0||0));
    const g =Math.max(0, (b?b.g0 :(p.goals||0))-(a.g0||0));
    const as=Math.max(0, (b?b.a0 :(p.assists||0))-(a.a0||0));
    const rt=Math.max(0, (b?b.r0 :(p.rTot||0))-(a.r0||0));
    const sh=a.sh || ((G.teams[a.t]||{}).short) || "";
    out.push({t:a.t, sh, ap, g, a:as, r: ap>0?Math.round(rt/ap*100)/100:0});
  }
  return out;
}
/* 소속 칸에 쓸 문구 — 「전북 → 부천」 */
function legPathTxt(legs){
  if(!legs || legs.length<2) return "";
  return legs.map(x=>x.sh||"무소속").join(" → ");
}
function joinClub(t, p, lock){
  try{ delete p._banAct; }catch(e){}       // 🟥 소속이 바뀌면 「다음 경기 대회」 표식은 무효다
  /* 🔁 ⚠ 제보 원문 — 「이적시장에 ai가 능력 좋은 선수를 영입했을 때 해당 팀 출전 횟수가 0이면
     임대를 쉽게 보내줍니다. 능력 좋은 선수는 임대가 어렵게 개선해야 할 것 같습니다」.
     ─ 「언제 이 팀에 왔는가」를 새겨 둔다. 갓 입단한 선수를 출전 기록으로 재면 무조건
       「전혀 못 뛰는 선수」가 되어 임대 거절 관문을 통째로 지나가 버린다. */
  try{ p._joinD=(G.day||0); p._joinS=G.season; }catch(e){}
  try{ noteLeg(t, p); }catch(e){}
  /* ⚠ 제보 — 영입 직후 곧바로 재계약해 연봉을 후려치는 악용. 입단하는 순간 재계약 잠금이 걸린다.
     계약 조건(연봉·기간)은 영입 협상 테이블에서 이미 정한 것이다.
     ⚠ 제보 2 — 다만 "돌아오는" 경우(임대 복귀·전역 복귀)는 새 계약을 맺은 게 아니다.
       원래 우리 선수가 제자리로 온 것뿐인데 신규 입단과 똑같이 잠겨 재계약이 막혔다.
       그런 경로는 lock=false 로 부른다 — 등번호 배정은 그대로 필요하다. */
  if(lock!==false){ try{ p._renewAt=(G.day||0); p._renewS=G.season; p._renewTry=0; }catch(e){} }
  if(!p.no || numTaken(t, p.no, p.id)) p.no=freeNumberFor(t, p);
  return p.no;
}
function setPlayerNumber(pid, n){
  const t=userTeam(), p=t.players.find(x=>x.id===pid);
  if(!p) return;
  n=parseInt(n,10);
  if(!(n>=1&&n<=99)) return;
  if(isRetiredNo(t, n)){
    const r=retiredList(t).find(x=>x.n===n);
    flash(`🎽 ${n}번은 영구결번입니다 (${r.who}). 누구도 달 수 없습니다.`,"warn");
    closeNumberPicker(); return;
  }
  const holder=t.players.find(x=>x.no===n && x.id!==pid);
  if(holder){                       // 이미 임자가 있으면 서로 맞바꾼다 (FM과 같은 방식)
    holder.no=p.no;
    flash(`🔁 ${p.name} ${n}번 · ${holder.name} ${holder.no}번 — 번호를 맞바꿨습니다.`);
  }
  p.no=n;
  closeNumberPicker(); saveGame(); show(VIEW==="squad"?"squad":VIEW);
}
/* ── 영입 발표 기자회견 예약 ────────────────────────────────
   FM처럼 계약서에 사인한 그날 바로 기자들 앞에 세우지 않는다. 하루 이틀 뒤 공식 발표 자리를
   잡아 두고, 그날이 되면 '진행'이 멈추면서 회견장이 열린다. */
function scheduleSignPresser(p, info){
  if(!p) return;
  G.signQueue=G.signQueue||[];
  G.signQueue.push({pid:p.id, name:p.name, fee:(info&&info.fee)||0, wage:(info&&info.wage)||0,
                    swap:!!(info&&info.swap), swapName:(info&&info.swapName)||"",
                    day:(G.day||0)+1+R(2)});
}
function duePresser(){
  /* ⚠ 제보 — 「영입 인터뷰 팝업에서 버튼을 눌러도 인터뷰 창으로 넘어가지 않는다」.
     큐에서 꺼낸(splice) 회견 정보가 팝업 상태에만 있어서, 닫기·재시작·상태 유실 등
     어떤 경로로든 그 정보가 사라지면 회견이 영영 열리지 않았다. 실제로 회견장이
     열릴 때까지 G.signPend 에 붙잡아 두고, 다음 진행에서 다시 세운다. */
  if(G.signPend) return G.signPend;
  const q=G.signQueue||[];
  for(let i=0;i<q.length;i++) if((G.day||0)>=q[i].day){ G.signPend=q.splice(i,1)[0]; return G.signPend; }
  return null;
}
function openSignPresser(info){
  const t=userTeam();
  const p=info && t.players.find(x=>x.id===info.pid);
  if(!p){ G.signPend=null; return false; }              // 그새 팔렸다면 회견도 없다 — 붙잡은 것도 놓는다
  G.signPend=null;                                      // 회견장이 실제로 열린다 — 유실 방지 해제
  G.signPresser=info;
  // ⚠ startInterview 가 '진행' 버튼을 잠근다. 끝낼 때 반드시 풀어 줘야 한다 —
  //    경기 흐름(사후 기자회견)에는 푸는 코드가 있었지만 영입 회견에는 없어서,
  //    회견이 끝나도 버튼이 눌리지 않아 게임이 멈춘 것처럼 보였다.
  startInterview("sign", null, ()=>{
    G.signPresser=null;
    $("#advBtn").disabled=false;
    saveGame(); show("home"); window.scrollTo(0,0);
  });
  return true;
}
/* 새로 데려온 선수 — 임시 번호를 이미 받았지만, 원하면 바로 바꿀 수 있게 물어본다 */
function askNumberForNewSigning(p){
  if(!p) return;
  showConfirm(`<b>${p.name}</b> 선수가 합류했습니다. 임시로 <b>${p.no}번</b>을 배정했습니다.<br><br>등번호를 직접 지정하시겠습니까?`,
    ()=>openNumberPicker(p.id), {okLabel:"번호 지정", cancelLabel:"그대로 두기"});
}
let NUMPICK=null;
function openNumberPicker(pid){
  const t=userTeam(), p=t.players.find(x=>x.id===pid);
  if(!p) return;
  NUMPICK=pid;
  const box=$("#gcModal"); box.className="";
  const cells=[];
  for(let n=1;n<=99;n++){
    const ret=retiredList(t).find(r=>r.n===n);
    const holder=t.players.find(x=>x.no===n);
    const mine=holder&&holder.id===pid;
    const cls=ret?"npRet":mine?"npMine":holder?"npUsed":"npFree";
    const tip=ret?`${n}번 — 영구결번 (${ret.who})`
      :holder?`${n}번 — ${holder.name}${mine?" (현재)":" 와 맞바꾸기"}`:`${n}번 (빈 번호)`;
    cells.push(`<button class="npN ${cls}" title="${tip}" ${ret?"disabled":""} onclick="setPlayerNumber(${pid},${n})">${n}</button>`);
  }
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox" style="max-width:520px">
    <div class="gcBody"><b>${p.name}</b> 등번호 지정 <span class="small">(현재 ${p.no||"-"}번)</span>
      <p class="small" style="margin:6px 0">회색은 이미 임자가 있는 번호입니다. 누르면 <b>두 선수의 번호가 맞바뀝니다.</b></p>
      <div class="npGrid">${cells.join("")}</div>
    </div>
    <div class="gcBtns"><button class="gcCancel">닫기</button></div>
  </div></div>`;
  const close=()=>closeNumberPicker();
  box.querySelector(".gcCancel").onclick=close;
  box.querySelector(".gcOverlay").onclick=(e)=>{ if(e.target.classList.contains("gcOverlay")) close(); };
}
function closeNumberPicker(){ NUMPICK=null; const box=$("#gcModal"); if(box){ box.className="hidden"; box.innerHTML=""; } }
/* ── 실존 인물 보호 — 선수 이름을 가상 인물로 바꾼다 ──────────────
   내국인은 성씨를 교체하고(김→금, 이→리 …), 외국인은 첫 글자의 초성만 한 칸 민다(마사→바사).
   데이터 병합·포지션 능숙도 매칭이 전부 원본 이름 기준으로 끝난 "다음"에 일괄 적용되므로
   명단 어디에서도 어긋나지 않는다. 해외 복귀 이벤트의 두 명(손흥민·이기제)과
   외국인 이적시장의 생성 선수(원래부터 가상)는 손대지 않는다. */
const NAME_KEEP=new Set();   // 예외 없음 — 실존 인물 이름은 전부 바꾼다
const SURNAME_MAP={
  /* 라이선스 대비 — 실존 선수의 성을 「실제로 있는 다른 성」으로 바꾼다.
     이름 뒷글자는 그대로라 부르는 느낌은 살아 있고, 실제 인물과는 겹치지 않는다.
     여러 성이 같은 성으로 모여도 괜찮다 — 실제 한국도 김·이·박이 인구의 절반이다. */
  "김":"구","이":"여","박":"반","정":"진","최":"추","조":"석","강":"공","윤":"은",
  "장":"지","임":"인","한":"함","오":"육","서":"선","신":"설","권":"금","황":"현",
  "안":"어","송":"소","류":"나","전":"천","홍":"변","고":"국","문":"민","양":"염",
  "손":"표","배":"방","백":"봉","허":"기","남":"마","심":"사","노":"도","하":"피",
  "곽":"길","성":"소","차":"채","주":"탁","우":"위","유":"예","지":"제","원":"명",
  "민":"맹","진":"위","구":"공","엄":"연","채":"제","천":"단","방":"봉","석":"설",
  "선":"성","공":"곽","연":"염","여":"예","은":"인","금":"강","현":"함","도":"두"
};
const CHO_NEXT={0:2,1:2,2:3,3:5,4:5,5:6,6:7,7:9,8:9,9:11,10:11,11:12,12:14,13:14,14:15,15:16,16:17,17:18,18:0};
function shiftCho(ch){
  const c=ch.charCodeAt(0);
  if(c<0xAC00||c>0xD7A3) return ch;
  const i=c-0xAC00, cho=(i/588)|0;
  return String.fromCharCode(0xAC00 + CHO_NEXT[cho]*588 + (i%588));
}
/* 🌱 홈그로운 — 외국 국적이지만 국내 유스에서 자란 선수. K리그 홈그로운 제도에 따라
   외국인 쿼터를 먹지 않는다. 이름은 초록색으로 표시된다. (개명 전 원본 이름 기준) */
const HOMEGROWN_NAMES=["바또"];
function frnQ(p){ return !!(p && p.frn && !p.hg); }   // "쿼터를 차지하는 외국인"인가
function fictName(name, frn){
  if(!name || NAME_KEEP.has(name)) return name;
  const h=name[0];
  if(frn) return shiftCho(h)+name.slice(1);
  return (SURNAME_MAP[h]||shiftCho(h))+name.slice(1);
}
function mkTeam(d, div){
  const t = {id:d.id, name:d.name, short:d.short, col:d.col, col2:d.col2, col3:d.col3||null,
    div, budget:d.budget, fans:d.fans, players:[],
    form:[], morale:50,   // 시작 사기 — 시즌을 치르며 스스로 끌어올리는 맛 (사용자 요청 75→50)
    tactic:{formation: div===1?"4-3-3":"4-4-2", mentality:2,   // 0~4 다섯 칸, 2가 가운데
            pass:2, tempo:2, press:2, line:2, width:2, counter:2, crossFq:2, longShot:2, benchSel:[]},
    W:0,Dw:0,L:0,GF:0,GA:0,Pts:0, isUser:false, aclMoney:0,
    trainLv: clamp(baseTrainLv(d.id, div), 1, FAC_MAX),   // 🏋️ 훈련시설 — 기업구단 하한 보장, 포항이 최고 (🔟 10단계 눈금)
    youthLv: clamp(baseYouthLv(d.id, div), 1, FAC_MAX),   // 🌱 유스 아카데미 — 명문은 세월로 쌓인다 (🔟 10단계 눈금)
    scoutLv: 1};
  const real = ROSTER26[d.id];
  if(real && real.length){
    // ── 실제 등록 명단으로 스쿼드를 짠다.
    //    표에 없는 건 능력치뿐이다. 기존 수기 명단에 같은 이름이 있으면 그 값을 그대로 물려받고,
    //    나머지는 구단 수준·나이·등번호를 근거로 추정한다.
    const known={};
    for(const q of (d.players||[])) known[q[0]]={ovr:q[3], frn:q[4]?1:0};
    const base = d.base || teamBaseFromSquad(d);
    for(const [name,pos,bd,no,h,w,frnFlag] of real){
      const by=parseInt(bd.slice(0,4),10);
      const k=known[name];
      const frn = k ? k.frn : (frnFlag?1:0);
      const ovr = k ? k.ovr : estimateOvr(base, by, no, frn, pos);
      const pl=mkPlayer(name,pos,by,ovr,frn,{no,h,w,bd:bd.slice(5)});
      pl.uid=uidForReal(name, by, bd, d.id);  // 🆔 실존 선수 — 이름·생일 기반 고정 번호(원본 이름 기준)
      pl.prefPos=assignPrefPos(pl, d.id); pl.posFam=initPosFam(pl); applyPlayerTweak(pl, d.id);
      syncPosBand(pl);                        // 🧭 대분류는 능숙도를 따른다 (등록 오류 교정)
      try{ retuneTraits(pl); }catch(e){}      // 🧩 자리가 옮겨졌으면 특성도 그 자리 것으로
      pl.name=fictName(pl.name, pl.frn);      // 🎭 라이선스 대비 개명 — 모든 설정이 끝난 뒤
      t.players.push(pl);
    }
  } else {
    const raw = d.players ? d.players : [...(d.stars||[]), ...genSquad(d.base)];
    for(const p of raw){ const pl=mkPlayer(...p);
      pl.uid=uidForReal(p[0], p[2], "", d.id);  // 🆔 수기 명단 실존 선수(원본 이름 기준)
      pl.prefPos=assignPrefPos(pl, d.id); pl.posFam=initPosFam(pl); applyPlayerTweak(pl, d.id);
      syncPosBand(pl);                        // 🧭 대분류는 능숙도를 따른다
      try{ retuneTraits(pl); }catch(e){}      // 🧩 자리가 옮겨졌으면 특성도 그 자리 것으로
      pl.name=fictName(pl.name, pl.frn); t.players.push(pl); }
  }
  assignNumbers(t);   // 실명 선수는 이미 번호가 있다 — 비어 있는 선수만 채운다
  try{ armyAttach(t); }catch(e){}   // 김천이면 군 복무 정보를 붙인다
  return t;
}
/* 수기 명단만 있고 base가 없는 K리그1 구단의 팀 수준 — 등록 선수 평균으로 잡는다 */
function teamBaseFromSquad(d){
  const ps=(d.players||[]).map(q=>q[3]).sort((a,b)=>b-a);
  if(!ps.length) return 66;
  const top=ps.slice(0, Math.min(18, ps.length));       // 주전급만 본다 (3군까지 넣으면 팀이 약해 보인다)
  return Math.round(top.reduce((s,v)=>s+v,0)/top.length);
}
/* 표에 능력치가 없는 선수의 추정 — 실제 K리그 스쿼드의 결을 따라간다.
   · 전성기(25~31세)가 가장 높고 10대·30대 후반은 낮다
   · 등번호가 낮을수록 주전에 가깝다 (K리그는 1~11번을 주축에게 주는 관행이 남아 있다)
   · 외국인은 대체로 즉시 전력으로 데려온다 */
function estimateOvr(base, by, no, frn, pos){
  const age=CUR_YEAR-by;
  const ageAdj = age<=19?-9 : age<=21?-6 : age<=23?-3 : age<=24?-1 : age<=31?1 : age<=34?-1 : -4;
  const noAdj  = no<=11?2 : no<=23?0 : no<=39?-2 : -3;
  const v = base + ageAdj + noAdj + (frn?3:0) + (R(7)-3);
  return clamp(v, 50, base+8);
}
function teamOVR(t){
  /* ⚠ 팀 전력은 「이 팀이 얼마나 좋은가」다 — 오늘 누가 지쳐 있는지와는 상관이 없다.
     AI 로테이션(컨디션 감점)이 들어가면서 지친 팀의 표기 전력이 함께 내려갔다.
     기자회견·평판·이적 판단이 전부 이 값을 보므로, 여기서는 컨디션을 빼고 계산한다. */
  const xi = bestXI(t, null, {noFatigue:true});
  return Math.round(xi.reduce((s,p)=>s+p.ovr,0)/11*10)/10;
}
function isU22(p){ return (G.season - p.by) <= 22; }
/* 🟥 ⚠ 제보 원문 — 「K리그 마지막 경기와 마지막 전 경기에서 퇴장 당한 선수들이 EACL 4강전
   하루 직전까지 스쿼드에서 출장 정지로 표기 되어 있다가 EACL 4강 당일날 정상 출전 가능한
   것으로 표기 되었습니다 (…) 다른 대회의 경기가 5일 후에 열린다면 바로 다음 날부터 다른
   대회는 출전이 가능하다고 출전 금지 표시를 없애주시면 감사하겠습니다」.
   원인 — 징계 장부는 대회별로 따로 있는데(ban·banE·banC), 화면과 avail() 은 리그 장부(ban)
      하나만 봤다. 대회 장부로 갈아 끼우는 시점이 「경기 시작 직전」이라, 그전까지는
      리그 징계가 대회 스쿼드에까지 그대로 걸려 주전이 매번 명단 밖으로 밀려났다.
   ─ 「다음 경기가 어느 대회인가」를 먼저 정하고, 그 대회의 장부로 판단한다.
     연습경기는 애초에 징계가 적용되지 않는다. */
let BAN_CTX="league";
function nextCompUser(){
  try{
    if(G.jobless || !userTeam()) return "league";
    const day=G.day||0;
    try{ if(typeof cwcUserDue==="function" && cwcUserDue()) return "cwc"; }catch(e){}
    try{ if(typeof eaclUserDue==="function" && eaclUserDue()) return "eacl"; }catch(e){}
    const cand=[];
    try{ const c=cwcNextForUser();  if(c && c.day>=day) cand.push({d:c.day, k:"cwc"}); }catch(e){}
    try{ const e=eaclNextForUser(); if(e && e.day>=day) cand.push({d:e.day, k:"eacl"}); }catch(e){}
    try{
      if(G.phase==="league" && G.cal && !userSeasonOver()){
        const r=userRoundNow();
        if(r<((G.cal.roundDay||[]).length)) cand.push({d:matchDayOf(r), k:"league"});
      }
    }catch(e){}
    /* ⚠ 제보 원문 — 「작년 리그에서 출장정지를 당한 선수가 친선경기 첫 경기에 못 나온다」.
       친선경기를 「대회가 하나도 없을 때의 기본값」으로만 뒀더니, 몇 달 뒤 EACL 일정이
       하나라도 잡혀 있으면 프리시즌 내내 그 대회 기준으로 판정됐다. 친선도 어엿한 다음 경기다. */
    try{
      const f=(G.friendlies||[]).filter(x=>x && !x.done && x.d!=null && x.d>=day).sort((a,b)=>a.d-b.d)[0];
      if(f) cand.push({d:f.d, k:"friendly"});
    }catch(e){}
    if(cand.length){ cand.sort((a,b)=>a.d-b.d); return cand[0].k; }
    return (G.phase==="pre") ? "friendly" : "league";
  }catch(e){ return "league"; }
}
/* 내 선수들에게 「지금 유효한 정지 경기 수」를 표시해 둔다 — avail()·전술판이 이 값을 본다 */
function banCtxSync(){
  try{
    const t=userTeam(); if(!t || !Array.isArray(t.players)) return;
    const c=nextCompUser(); BAN_CTX=c;
    for(const p of t.players){
      if(!p) continue;
      /* 대회 경기가 실제로 도는 동안에는 이미 장부가 갈아 끼워져 있다 — p.ban 이 곧 그 장부다 */
      if(p._banL!=null || p._banLC!=null){ delete p._banAct; continue; }
      const v = c==="eacl" ? (p.banE||0) : c==="cwc" ? (p.banC||0) : c==="friendly" ? 0 : (p.ban||0);
      if(v===(p.ban||0)) delete p._banAct; else p._banAct=v;
    }
  }catch(e){}
}
/* 지금 이 선수에게 걸려 있는 정지 경기 수 — 다음 경기 대회 기준.
   ⚠ 제보 — 「친선경기는 친선경기인 만큼 완전 독립적이게」. 친선에는 어떤 대회의 징계도
      걸리지 않는다 — 내 팀이든 상대 팀이든 마찬가지다. */
function banNow(p){
  if(BAN_CTX==="friendly") return 0;
  return (p && p._banAct!=null) ? p._banAct : ((p&&p.ban)||0);
}
function avail(p){ return p.inj<=0 && !(banNow(p)>0) && !(p.sulk>0) && !p._loanBlk; }
/* 🔁 임대 선수는 원소속 구단과의 경기에 나설 수 없다 (K리그 규정).
   경기를 만들기 직전에 표식을 달고, 끝나면 지운다 — avail() 을 쓰는 모든 경로가 한 번에 따른다. */
function loanBlockSet(home, away){
  for(const [t,opp] of [[home,away],[away,home]]){
    if(!t||!opp) continue;
    for(const p of t.players){ if(p.loan && p.loan.own===opp.id) p._loanBlk=1; }
  }
  try{ home._xiCK=null; away._xiCK=null; }catch(e){}
}
function loanBlockClear(home, away){
  for(const t of [home,away]){ if(!t) continue;
    for(const p of t.players) if(p._loanBlk) delete p._loanBlk; }
  try{ home._xiCK=null; away._xiCK=null; }catch(e){}
}
/* ── 베스트 XI ────────────────────────────────────────────────
   예전에는 GK/DF/MF/FW 네 덩어리로 나눠 ovr 순으로 잘라 썼다. 그래서 포메이션이
   요구하는 실제 자리(LW·ST·RCB…)와 상관없이 뽑혔고, 순수 스트라이커가 윙어 자리에
   서 있는 장면이 나왔다.
   이제는 포메이션이 요구하는 자리 목록을 먼저 펼쳐 놓고, "이 선수가 이 자리에서 몇 별인가"
   (능력치 × 포지션 능숙도 — 전술판·우클릭 팝업에 뜨는 그 별점과 같은 계산)를
   모든 (선수 × 자리) 조합에 대해 매긴 뒤, 점수가 높은 짝부터 확정한다. */
/* 쓸 수 있는 골키퍼가 하나도 없을 때(전원 부상·정지) 골문에 세울 필드 플레이어.
   실제 경기에서도 이런 일이 벌어지면 키 크고 담대한 수비수를 세운다. */
function pickEmergencyGK(list){
  if(!list||!list.length) return null;
  const sc=(p)=>(p.h||178)*0.5 + ((p.attr&&p.attr.bra)||50)*0.3 + ((p.attr&&p.attr.agi)||50)*0.2 + (p.pos==="DF"?8:0);
  return list.slice().sort((a,b)=>sc(b)-sc(a))[0];
}
function slotPickScore(p, slot){
  if(!p) return -1;
  if((slot==="GK") !== (p.pos==="GK")) return -1;     // 골키퍼와 필드 플레이어는 섞지 않는다
  const raw=ovrStarVal(slotRating(p, slot));          // 그 자리 기준 별점
  const v=raw*famStarMul(getPosFam(p, slot));         // 자리 능숙도로 깎는다
  // 같은 별점이면 능력치가 높은 쪽 — 결정적으로 정해야 캐시가 유효하다
  return v*1000 + (p.ovr||65)*0.4;
}
function formationSlots(fname){
  const shape=FORMATION_SHAPE[fname]||FORMATION_SHAPE["4-3-3"];
  return shape.map(x=>x[1]);
}
/* {xi, slotOf} — 자리 배정까지 함께 돌려준다 */
/* 캐시 키 — 스쿼드 구성(출전 가능 선수 + 능력치)과 포메이션만 본다.
   ⚠ 컨디션을 키에 넣었더니 날짜가 하루 지날 때마다 29개 팀 전부의 캐시가 깨져서
      시즌 진행이 눈에 띄게 느려졌다. 컨디션은 어차피 동점자 처리용이라 뺐다. */
function xiCacheKey(t, fname){
  /* ⚠ 제보(CWC 외국인 제한) 검증 중 발견 — 캐시 열쇠에 외국인 한도가 빠져 있어,
     국제 대회 날(무제한) 짠 선발이 리그 날에도 그대로 재사용됐다(반대 방향도 마찬가지).
     한도를 열쇠에 넣어 대회↔리그 경계에서 선발을 다시 짠다. */
  let k=fname+"#"+(t.tactic&&t.tactic.formation)+"#L"+frnLimOf(t)+"#";
  /* AI 구단은 컨디션을 보고 선발을 돌린다 — 컨디션이 바뀌면 캐시도 새로 잡아야 한다.
     10단위로 뭉뚱그려 매 경기 명단이 흔들리지 않게 한다. */
  const rot=(t && !t.isUser);
  for(const p of t.players){ if(avail(p)) k+=p.id+":"+p.ovr+(rot?(":"+Math.round((p.cond||90)/10)):"")+";"; }
  return k;
}
/* 🔄 AI 로테이션 — 지친 선수는 그 자리 점수가 깎여 후보에게 밀린다.
   실제 감독도 「가장 잘하는 열한 명」이 아니라 「오늘 뛸 수 있는 열한 명」을 낸다.
   유저 팀에는 걸지 않는다 — 감독이 직접 짠 선발을 게임이 멋대로 바꾸면 안 된다. */
function aiFatigueCut(p){
  const c=p.cond||90;
  if(c>=86) return 0;
  if(c>=78) return 0.20;
  if(c>=70) return 0.55;
  if(c>=62) return 1.10;
  return 1.80;                                   // 60 아래 — 웬만하면 쉰다
}
/* ⚡ 체력 우선 자동 선발 — 유저가 직접 켰을 때만 쓰는, 더 과감한 로테이션 잣대.
   ⚠ 제보 — 「회복이 느린 만큼 스쿼드를 두껍게 굴리는데, 매 경기 손으로 열한 명을 갈아 끼우기가 힘들다.
     자동 선발이 자리 능숙도만 보지 말고 체력도 봐 줬으면 좋겠다」.
   AI 로테이션(aiFatigueCut)보다 한 단계 세게 깎는다 — 값의 단위는 '별'이다.
   4.5★ 주전이 컨디션 78이면 3.0★으로 내려가, 갓 쉰 3.5★ 백업에게 자리를 내준다. */
function fitPickCut(p){
  const c=(p&&p.cond)||90;
  if(c>=92) return 0;
  if(c>=86) return 0.35;
  if(c>=80) return 0.85;
  if(c>=74) return 1.50;
  if(c>=66) return 2.40;
  return 3.60;
}
function autoFitOn(){ return !!(G.opt && G.opt.autoFit); }
/* 🔁 벤치→선발 역할 기본값 정책.
   ⚠ 제보 — 「보통 선수가 해당 포지션 역할이 능숙하지 않아도 전술에 선수를 맞추는 편이라서,
     전술의 역할을 그대로 가져가는 것이 기본값인 버튼이랑 선수의 포지션 역할의 적합도/능숙도
     가장 상위 버전이 기본값인 버튼이랑 선택지를 2개로 해주셨으면」.
   전술 화면 선발 정보 탭의 칩으로 고른다. 기본은 「선수 우선」(직전 제보 반영 동작). */
function swapRoleTac(){ return !!(G.opt && G.opt.swapRole==="tac"); }
function bestXISlots(t, formation, opts){
  const fname=formation||(t.tactic&&t.tactic.formation)||"4-3-3";
  const noFat=!!(opts && opts.noFatigue);
  const ck=xiCacheKey(t, fname)+(noFat?"|F":"");
  if(!noFat && t._xiCK===ck && t._xiC) return t._xiC;
  if(noFat && t._xiCKf===ck && t._xiCf) return t._xiCf;
  const slots=formationSlots(fname);
  const frnLim = frnLimOf(t);
  const av=t.players.filter(avail);
  const slotOf={};
  // 골키퍼 먼저. 쓸 수 있는 키퍼가 하나도 없으면(전원 부상·정지) 필드 플레이어를 골문에 세운다 —
  // 실제 경기에서도 그렇게 한다. 키가 크고 대담한 선수가 그나마 낫다.
  let gk=av.filter(p=>p.pos==="GK").sort((a,b)=>slotPickScore(b,"GK")-slotPickScore(a,"GK"))[0] || null;
  let emergencyGK=false;
  if(!gk){ gk=pickEmergencyGK(av); emergencyGK=!!gk; }
  const xi=[]; if(gk){ xi.push(gk); slotOf[gk.id]="GK"; }
  // (선수 × 자리) 조합을 전부 매겨서 좋은 짝부터 확정한다
  const pool=av.filter(p=>p.pos!=="GK" && p!==gk);
  const cand=[];
  const _rot = !t.isUser && !noFat;
  for(const p of pool) for(const sl of slots){
    let v=slotPickScore(p,sl); if(v<=0) continue;
    if(_rot) v -= aiFatigueCut(p)*1000;           // 별점 한 칸이 1000 — 지친 만큼 뒤로 밀린다
    cand.push({p,sl,v});
  }
  cand.sort((a,b)=>b.v-a.v);
  const usedP=new Set(), usedS=new Set();
  let frnCount=frnQ(gk)?1:0;
  for(const c of cand){
    if(usedS.size>=slots.length) break;
    if(usedP.has(c.p.id)||usedS.has(c.sl)) continue;
    if(frnQ(c.p) && frnCount>=frnLim) continue;         // 외국인 동시 출전 제한 (K1 5 / K2 4)
    usedP.add(c.p.id); usedS.add(c.sl); slotOf[c.p.id]=c.sl; xi.push(c.p);
    if(frnQ(c.p)) frnCount++;
  }
  // 그래도 자리가 남으면(국내 선수 부족 등) 제한을 풀고 채운다
  if(xi.length<11){
    for(const c of cand){
      if(xi.length>=11) break;
      if(usedP.has(c.p.id)||usedS.has(c.sl)) continue;
      usedP.add(c.p.id); usedS.add(c.sl); slotOf[c.p.id]=c.sl; xi.push(c.p);
    }
  }
  // 마지막 수단 — 그래도 모자라면 아무나 채운다. 다만 여분 골키퍼는 맨 뒤로 미룬다
  // (예비 키퍼가 필드 플레이어보다 먼저 뽑혀 골키퍼 넷이 선발로 나가는 일이 있었다).
  if(xi.length<11){
    const rest=av.filter(p=>!usedP.has(p.id)&&p!==gk)
                 .sort((a,b)=>(a.pos==="GK"?1:0)-(b.pos==="GK"?1:0) || (b.ovr||0)-(a.ovr||0));
    for(const p of rest){ if(xi.length>=11) break; usedP.add(p.id); xi.push(p); }
  }
  // 남은 슬롯이 있으면 아직 자리 없는 선수에게 하나씩 준다 (화면에서 사라지지 않게)
  const leftSlots=slots.filter(sl=>!usedS.has(sl));
  for(const p of xi){ if(p===gk||slotOf[p.id]) continue; const sl=leftSlots.shift(); if(sl){ slotOf[p.id]=sl; usedS.add(sl); } }
  const res={xi:xi.slice(0,11), slotOf, fname, emergencyGK};
  if(noFat){ t._xiCKf=ck; t._xiCf=res; } else { t._xiCK=ck; t._xiC=res; }
  return res;
}
/* ⚠ 골키퍼가 둘 들어간 선발 — 실제 제보된 버그.
   ① 손으로 짠 11인에 GK가 둘이면 아래 '수리 경로'로 빠지는데, 마지막 관문이
      `GK 수 >= 1` 이라 둘이어도 통과했다.
   ② 빈 자리를 자동으로 메울 때 GK를 거르지 않아, GK가 이미 있는데 또 넣었다.
   ③ 화면에서는 pos==="GK" 면 무조건 골문에 그렸다 — 그래서 둘 다 골대 앞에 섰다.
   여기서는 ①②를 한 번에 막는다. 어떤 경로로 만들어졌든 최종 11인은 GK 한 명이다. */
function fixOneGK(t, xi){
  if(!Array.isArray(xi)) return xi;
  const gks=xi.filter(p=>p && p.pos==="GK");
  if(gks.length<=1) return xi;
  gks.sort((a,b)=>slotPickScore(b,"GK")-slotPickScore(a,"GK") || (b.ovr||0)-(a.ovr||0));
  const keep=gks[0];
  const out=xi.filter(p=>p && (p.pos!=="GK" || p.id===keep.id));
  const has=q=>out.some(z=>z.id===q.id);
  const frnLim=frnLimOf(t);
  let frnN=out.filter(frnQ).length;
  const pool=t.players.filter(q=>avail(q) && q.pos!=="GK" && !has(q)).sort((a,b)=>(b.ovr||0)-(a.ovr||0));
  for(const q of pool){ if(out.length>=11) break; if(frnQ(q) && frnN>=frnLim) continue; out.push(q); if(frnQ(q)) frnN++; }
  for(const q of pool){ if(out.length>=11) break; if(!has(q)) out.push(q); }   // 그래도 모자라면 제한을 푼다
  /* ⚠ 필드 자원이 정말 없으면(스쿼드 붕괴) 여분 골키퍼를 빼기만 해서는 열한 명이 안 된다.
     일곱 명으로 뛰느니 예비 키퍼를 필드에 세운다 — 실제 구단도 그렇게 한다. */
  if(out.length < Math.min(11, xi.length))
    for(const q of gks.slice(1)){ if(out.length>=Math.min(11, xi.length)) break; out.push(q); }
  return out;
}
function bestXI(t, formation, opts){
  try{ ensureSquad(t); }catch(e){}
  const frnLim = frnLimOf(t);
  /* 유저가 직접 짠 선발이 있으면 그대로 존중한다.
     ⚔️ 온라인 대전 클론(t.pvp)도 마찬가지다 — 감독이 로비에서 확정한 열한 명이 t.pvpXI 에
        실려 온다. 예전에는 클론이 isUser 가 아니라 여기를 그냥 지나쳐, 능력치 순으로
        선발을 다시 뽑았다 (제보: 처음 확정한 전술과 경기 중 전술이 다르다). */
  const manualIds = (t.isUser && G.userXI && G.userXI.length) ? G.userXI
                  : ((t.pvp && Array.isArray(t.pvpXI) && t.pvpXI.length===11) ? t.pvpXI : null);
  if(manualIds){
    const manual = manualIds.map(id=>t.players.find(p=>p.id===id)).filter(p=>p&&avail(p));
    if(manual.length===11 && manual.filter(frnQ).length<=frnLim && manual.filter(p=>p.pos==="GK").length===1) return manual;
    if(manual.length===11 && manual.filter(p=>p.pos==="GK").length>1) return fixOneGK(t, manual);
    /* 🚪 제보 — 감독이 '제외'로 자리를 비워 뒀다면 전술판에서는 빈 자리 그대로 둔다.
       실제 경기는 열한 명이 채워질 때까지 시작되지 않는다(xiGateStop — 요청 「FM 처럼」). */
    if(t.isUser && t.tactic && t.tactic.xiManual && manual.length>0 && manual.length<11) return manual;
    /* ⚠ 예전엔 한 명이라도 못 뛰게 되면(부상·퇴장·태업) 손으로 짜 둔 열한 명을 통째로 버리고
       자동 편성으로 되돌렸다. 그래서 퇴장 다음 경기의 선발이 완전히 뒤집혀 보였다.
       이제는 남아 있는 선수를 그대로 두고 빈 자리만 메운다. */
    if(manual.length>=7){
      const out=manual.slice();
      const has=(p)=>out.some(q=>q.id===p.id);
      let frnN=out.filter(frnQ).length;
      // 골키퍼가 빠졌으면 먼저 채운다
      if(!out.some(p=>p.pos==="GK")){
        /* 🧤 요청 「골키퍼도 선발 제외」 — 감독이 직접 뺀 키퍼는 뒤로 미루고 다른 키퍼부터 쓴다 */
        const gkC=t.players.filter(p=>avail(p)&&p.pos==="GK"&&!has(p))
                           .sort((a,b)=>slotPickScore(b,"GK")-slotPickScore(a,"GK"));
        const gk=gkC.find(p=>!xiExclHas(t,p.id)) || gkC[0]
               || pickEmergencyGK(t.players.filter(p=>avail(p)&&!has(p)));
        /* ⚠ 골키퍼 없는 열한 명은 성립하지 않는다 — 이미 열한 명이면 한 자리를 내준다.
           (예전에는 그냥 밀어 넣어 열두 명이 됐고, 아래 두 반환문에 걸리지 않아
            손으로 짠 선발이 통째로 자동 편성으로 뒤집혔다) */
        if(gk){ if(out.length>=11) out.pop(); out.push(gk); }
        frnN=out.filter(frnQ).length;
      }
      // 나머지는 자동 편성이 뽑은 순서대로 메운다
      const auto=bestXISlots(t, formation, opts).xi;
      const gkFull=()=>out.some(q=>q.pos==="GK");
      for(const p of auto){
        if(out.length>=11) break;
        if(has(p) || !avail(p)) continue;
        if(p.pos==="GK" && gkFull()) continue;      // 골키퍼는 한 명이면 충분하다
        if(frnQ(p) && frnN>=frnLim) continue;
        if(xiExclHas(t, p.id)) continue;            // 🚪 제보 — 감독이 직접 뺀 선수는 뒤로 미룬다
        out.push(p); if(frnQ(p)) frnN++;
      }
      if(out.length<11){   // 그래도 모자라면 제한을 풀고 채운다
        for(const p of t.players){
          if(out.length>=11) break;
          if(!avail(p) || has(p)) continue;
          if(p.pos==="GK" && gkFull()) continue;
          out.push(p);
        }
      }
      if(out.length===11 && out.filter(p=>p.pos==="GK").length===1) return out;
      if(out.length===11) return fixOneGK(t, out);
    }
  }
  const r=bestXISlots(t, formation, opts);
  // 자동 배치 결과를 남겨 둔다 — 전술판이 이걸 참고해 같은 자리에 그린다(저장은 하지 않는다).
  t._autoSlots=r.slotOf; t._autoForm=r.fname;
  return fixOneGK(t, r.xi);
}
/* 🔄 자동 선발 — 유저가 판 위에 만들어 둔 '자리 목록'과 각 자리의 '역할·임무'는 그대로 두고,
   그 자리·그 역할에 가장 잘 맞는 선수로 열한 명을 다시 뽑는다.
   ⚠ 예전에는 배치(slot/zone)와 선발을 통째로 지우고 포메이션 기본형으로 되돌렸다 —
     손으로 올려 둔 윙백 자리도, 정성껏 고른 역할도 자동 선발 한 번에 다 날아갔다. */
const ROLE_PICK_W=170;   // 역할 적합도(0.5~5★)의 가중치 — 자리 점수(별당 ~1000)가 주, 역할이 보정
function autoPickXI(){
  const t=userTeam(), T=t.tactic;
  /* 🚪 제보 — '제외'로 비워 둔 자리도 여기서 되돌린다. 이 버튼이 곧 「자동 편성으로 복귀」다. */
  try{ if(T){ T.xiExcl=[]; T.xiManual=false; } }catch(e){}
  /* 1) 지금 판의 스냅샷 — 자리 목록과 자리별 역할 */
  let slots=null; const slotRole={};
  try{
    const cur=bestXI(t);
    const so=computeRenderSlots(t, cur);
    const list=cur.map(p=>so[p.id]).filter(Boolean);
    if(list.length===11){
      slots=list.slice();
      for(const p of cur){ const sl=so[p.id]; if(!sl) continue;
        const rd=getRole(t,p,sl); if(rd&&rd.r) slotRole[sl]={r:rd.r,d:rd.d}; }
    }
  }catch(e){}
  if(!slots) slots=formationSlots((T&&T.formation)||"4-3-3");
  /* 2) 자리+역할 점수로 최적 조합 */
  const fitOn=autoFitOn();
  const rolePick=(p,sl)=>{
    let v=slotPickScore(p,sl); if(v<=0) return v;
    const rd=slotRole[sl];
    if(sl!=="GK" && rd && ROLE_BY_KEY[rd.r]) v += roleFit(p, rd.r)*ROLE_PICK_W;
    /* 체력 우선 모드 — 자리 점수가 '별×1000'이라 깎는 단위도 별에 맞춘다.
       다 깎여도 0 아래로는 내려보내지 않는다(그 자리를 못 뛰는 선수와 섞이면 안 된다). */
    if(fitOn) v = Math.max(1, v - fitPickCut(p)*1000);
    return v;
  };
  const frnLim=frnLimOf(t);
  const av=t.players.filter(avail);
  const gkScore=(p)=>slotPickScore(p,"GK") - (fitOn?fitPickCut(p)*1000:0);
  let gk=av.filter(p=>p.pos==="GK").sort((a,b)=>gkScore(b)-gkScore(a))[0]
       || pickEmergencyGK(av);
  const xi=[], slotOf={};
  if(gk){ xi.push(gk); slotOf[gk.id]="GK"; }
  const fieldSlots=slots.filter(sl=>sl!=="GK");
  const pool=av.filter(p=>p.pos!=="GK" && p!==gk);
  const cand=[];
  for(const p of pool) for(const sl of fieldSlots){ const v=rolePick(p,sl); if(v>0) cand.push({p,sl,v}); }
  cand.sort((a,b)=>b.v-a.v);
  const usedP=new Set(), usedS=new Set();
  let frnN=frnQ(gk)?1:0;
  for(const c of cand){
    if(usedS.size>=fieldSlots.length) break;
    if(usedP.has(c.p.id)||usedS.has(c.sl)) continue;
    if(frnQ(c.p) && frnN>=frnLim) continue;
    usedP.add(c.p.id); usedS.add(c.sl); slotOf[c.p.id]=c.sl; xi.push(c.p);
    if(frnQ(c.p)) frnN++;
  }
  if(xi.length<11){ // 국내 자원이 모자라면 쿼터를 풀고 채운다
    for(const c of cand){
      if(xi.length>=11) break;
      if(usedP.has(c.p.id)||usedS.has(c.sl)) continue;
      usedP.add(c.p.id); usedS.add(c.sl); slotOf[c.p.id]=c.sl; xi.push(c.p);
    }
  }
  if(xi.length<11){ // 그래도 모자라면 능력순으로 (여분 GK는 맨 뒤)
    const rest=av.filter(p=>!usedP.has(p.id)&&p!==gk)
                 .sort((a,b)=>(a.pos==="GK"?1:0)-(b.pos==="GK"?1:0) || (b.ovr||0)-(a.ovr||0));
    for(const p of rest){ if(xi.length>=11) break; usedP.add(p.id); xi.push(p); }
  }
  /* 3) 결과를 유저 선발로 확정하고, 판의 배치·역할을 새 주인에게 물려준다 */
  const finalXI=fixOneGK(t, xi.slice(0,11));
  G.userXI=finalXI.map(p=>p.id);
  T.slot={}; T.zone={};
  if(!T.role) T.role={};
  for(const p of finalXI){
    const sl=slotOf[p.id]; if(!sl||sl==="GK") continue;
    setSlot(t, p.id, sl); setZone(t, p.id, SLOT_BAND[sl]||p.pos);
    const rd=slotRole[sl];
    if(rd && ROLE_BY_KEY[rd.r]){
      const R=ROLE_BY_KEY[rd.r], g=ROLE_GRP[sl]||"CM";
      if(R.grp.includes(g)) T.role[p.id]={r:rd.r, d:R.duty.includes(rd.d)?rd.d:R.duty[0]};
    }
  }
  saveGame();
}
function xiStrength(t){
  const xi = bestXI(t);
  let s = xi.reduce((sum,p)=>sum + p.ovr*(0.85+0.15*p.cond/100),0)/11;
  const u22 = xi.filter(isU22).length;
  s += (t.morale-75)*0.04;
  s += (xi.reduce((a,p)=>a+(p.morale||70),0)/11 - 70)*0.05; // 선수 개인 사기
  const wins = t.form.slice(-5).filter(r=>r==="W").length;
  s += wins*0.25;
  s += famK(t)*0.9;                 // 조직력 — AI끼리의 경기에도 같은 잣대로 적용된다
  return {s, xi, u22};
}
/* ── 벤치 (매치데이 스쿼드): K리그 규정상 9명까지만 등록 가능 ── */
/* ═══════════════════════════════════════════════════════════════
   🚨 스쿼드 붕괴 — 열한 명을 못 채울 때
   부상·출장정지·태업이 겹치면 등록 가능한 선수가 열한 명 아래로 떨어질 수 있다.
   그동안은 그대로 열 명, 아홉 명으로 경기에 나갔다. 골키퍼가 전멸하면 필드 플레이어가 골문에 섰다.
   실제 구단은 그런 상황에서 유스를 급히 프로 등록한다. 여기서도 그렇게 한다.
     · 등급이 높은 유스 아카데미일수록 나은 선수가 올라온다
     · 급히 올린 선수라 능력치는 낮고, 그대로 스쿼드에 남는다(방출은 감독 몫)
═══════════════════════════════════════════════════════════════ */
const SQUAD_FLOOR=12;                 // 선발 11 + 최소 교체 1
function emergencyCallup(t, n, needGK){
  if(!t || n<=0) return [];
  /* 🎖️ ⚠ 제보 원문 — 「김천 상무는 유스 콜업이 없는 팀이라서 김천 상무의 유스 콜업이 있다면
     없애주시면 감사하겠습니다」. 국군체육부대에는 아카데미가 없다. 어떤 경로로 불려도 만들지 않는다. */
  if(isArmyTeam(t)) return [];
  const lv=Math.round(lvEff(t.youthLv||1) + (lvEff(trainLv(t))-1)*0.6);   // 🔟 10단계 → 예전 성능 축
  const made=[];
  for(let i=0;i<n;i++){
    const pos = (needGK && i===0) ? "GK" : pick(["DF","DF","MF","MF","FW"]);
    const by=G.season-(17+R(3));
    const ovr=clamp(43+lv*2+R(7), 40, 66);
    let q=null;
    const hgY=Math.random()<0.07;                 // 유스 B팀의 홈그로운 외국 국적 유소년
    try{ q=mkPlayer(hgY?genFrnName():genName(), pos, by, ovr, hgY?1:0, {}); }catch(e){ continue; }
    if(hgY) q.hg=1;
    q.emg=1; q.ct=1; q.morale=74; q.cond=94+R(6);
    q.wage=Math.max(0.2, Math.round(wageExpect(ovr,0,t.div||1)*0.45*10)/10);
    try{ q.prefPos=inferPrefPos(q); q.posFam=initPosFam(q); syncPosBand(q); }catch(e){}
    t.players.push(q); try{ joinClub(t, q); }catch(e){}
    made.push(q);
  }
  return made;
}
/* 경기를 치를 수 있는 상태인지 확인하고, 아니면 채운다.
   force=true 는 킥오프 직전의 "최종 소집" — 같은 날 이미 콜업했더라도 한 번 더 채운다.
   (⚠ 제보 — 콜업된 유스까지 마저 패면 같은 날 가드에 걸려 몰수패가 되고, 날이 바뀌면 또 되는
    비일관 사례. 경기 직전엔 언제나 같은 규칙으로 소집한다.) */
function ensureSquad(t, force){
  if(!t || !Array.isArray(t.players)) return;
  if(isArmyTeam(t)) return;                       // 상무는 연맹이 따로 채워 준다(armyAutoFloor)
  const ok=t.players.filter(avail);
  const gkN=ok.filter(p=>p.pos==="GK").length;
  const fieldN=ok.length-gkN;
  const needGK=gkN<1;
  /* ⚠ 머릿수만 세면 안 된다. 골키퍼 여섯에 필드 둘이어도 '여덟 명'이라 넘어갔다.
     필드 자원 11명(선발 10 + 예비 1)과 골키퍼 1명을 따로 센다. */
  const need=Math.max(0, SQUAD_FLOOR-ok.length, Math.max(0, 11-fieldN) + (needGK?1:0));
  if(need<=0) return;
  if(!force && t._emgAt===G.day && !needGK) return;   // 같은 날 반복 호출 방지 (경기 직전 최종 소집은 예외)
  t._emgAt=G.day;
  const made=emergencyCallup(t, need, needGK);
  if(!made.length) return;
  const names=made.map(q=>`${q.name}(${q.pos})`).join(", ");
  if(t.isUser){
    notify(`🚨 <b>등록 가능한 선수가 모자랍니다.</b> 유스에서 <b>${made.length}명</b>을 긴급 등록했습니다 — ${names}`+
           (needGK?` <span class="small">(골키퍼 전멸)</span>`:""), "warn");
    addMood(`🚨 유스에서 ${made.length}명이 급히 1군에 올라왔습니다. 라커룸이 어수선합니다.`);
    adjustTrust("fans", -2, "스쿼드 부족으로 유스 긴급 등록");
  } else {
    addNews(`🚨 ${t.name}, 스쿼드 부족으로 유스 ${made.length}명 긴급 등록 — ${names}`, "warn", "club");
  }
}
function benchPool(t){ // 선발 제외, 출전 가능한 전체 후보 (부상·출장정지·태업 제외)
  const xi = bestXI(t);
  return t.players.filter(p=>avail(p)&&!xi.includes(p)).sort((a,b)=>b.ovr-a.ovr);
}
function matchBench(t){ // 실제 경기에 교체 투입 가능한 9명 (사용자가 지정, 미지정분은 능력순 자동 보충)
  const pool = benchPool(t);
  /* ⚠ 제보 — 벤치에 같은 선수가 두 번 떴다. 선발↔후보 스왑이 benchSel에 같은 id를
     두 번 남길 수 있다(내려온 선수가 이미 명단에 있던 경우). 여기서 걸러 준다. */
  const sel = [...new Set((t.tactic&&t.tactic.benchSel)||[])];
  const chosen = sel.map(id=>pool.find(p=>p.id===id)).filter(Boolean);
  /* ⚠ 자동 보충이 능력치 순이라 예비 골키퍼가 늘 밀려났다. 주전 키퍼가 다치거나 퇴장당하면
     벤치에 키퍼가 없어서 필드 플레이어가 골문에 서야 했다. 한 자리는 비워 둔다. */
  /* FM식 직접 편성 — 유저가 벤치를 한 번이라도 직접 만졌으면(benchManual) 자동 보충하지 않는다.
     빈 자리는 빈 자리로 남는다. 벤치 4명으로 경기하는 것도 감독의 선택이다. */
  if(t.tactic && t.tactic.benchManual && t.isUser) return chosen.slice(0,9);
  const excl=new Set((t.tactic&&t.tactic.benchExcl)||[]);   // 유저가 ⬇ 제외한 선수 — 자동 보충 금지
  const needGK = !chosen.some(p=>p.pos==="GK");
  const gk = needGK ? pool.find(p=>p.pos==="GK" && !excl.has(p.id)) : null;
  const cap = (gk && chosen.length<9) ? 8 : 9;   // 골키퍼 자리를 미리 빼 둔다
  if(chosen.length<cap){
    const ids=new Set(chosen.map(p=>p.id));
    for(const p of pool){
      if(chosen.length>=cap) break;
      if(ids.has(p.id) || excl.has(p.id) || (gk && p.id===gk.id)) continue;
      chosen.push(p); ids.add(p.id);
    }
  }
  if(gk && !chosen.some(p=>p.id===gk.id)){
    if(chosen.length<9) chosen.push(gk);
    else {
      /* 아홉 자리를 감독이 직접 다 채웠다면, 자동 보충분부터 밀어낸다 */
      let idx=-1;
      for(let i=chosen.length-1;i>=0;i--){ if(sel.indexOf(chosen[i].id)<0){ idx=i; break; } }
      chosen[idx<0 ? chosen.length-1 : idx]=gk;
    }
  }
  return chosen.slice(0,9);
}
