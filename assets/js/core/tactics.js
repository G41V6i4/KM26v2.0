"use strict";
/* =====================================================
   세부 전술 시스템
===================================================== */
/* ── 전술 눈금 (FM식 슬라이더) ────────────────────────────────
   화면에서는 0~4 다섯 칸으로 다루고, 매치엔진에는 0.0~2.0 실수로 넘긴다.
   엔진 곳곳의 `(T.press-1)*0.35` 같은 계산식은 예전 3단계(0·1·2)를 전제로 쓰였는데,
   0~4를 2로 나누면 중앙값(1)과 범위가 그대로라 계산식을 하나도 안 고쳐도 된다.
   대신 `HI(T.line)` 같은 "정확히 최대치" 비교만 임계값 비교(HI/LO/MID)로 바꿨다. */
const TAC_KEYS=["pass","tempo","press","line","width","mentality","tackle","longShot","counter","crossFq","defGap","transSpd","defCommit","marking","trap"];
const TAC_STEPS=5;                    // 0,1,2,3,4
const TAC_DEF={pass:2,tempo:2,press:2,line:2,width:2,counter:2,mentality:2,tackle:2,longShot:2,crossFq:2,defGap:2,transSpd:2,
               defCommit:2,marking:2,trap:2};
/* ⚡ 역습 강도 — 예전에는 켜고 끄는 스위치(boolean)였다. 5단계 슬라이더로 바꾸면서
   옛 세이브·프리셋의 true/false 도 그대로 읽히도록 여기서 한 번에 숫자로 환산한다.
   0 안 함 · 1 가끔 · 2 보통 · 3 적극 · 4 극단적 */
function ctrLv(T){
  const v=T&&T.counter;
  if(v===true) return 3;
  if(v===false) return 0;
  if(v==null) return 2;                 // 미지정 = 보통 (역습 기본값)
  return clamp(Math.round(+v)||0, 0, TAC_STEPS-1);
}
/* 엔진이 쓰는 계수 — 0.0(안 함) ~ 1.0(극단) */
function ctrK(T){ return ctrLv(T)/4; }
function tacVal(v){ return clamp((v==null?2:+v),0,TAC_STEPS-1)/2; }   // 0~4 → 0.0~2.0
/* 팀(또는 tactic 객체)의 전술을 엔진용 실수 스케일로 변환 */
/* ⚡ ⚠ 제보 — 「수석코치에게 위임하면 렉이 심하다」. 위임 경기는 90분치 시뮬을 <b>한 번에</b>
   돌린다(관전은 실시간에 흩어져 티가 안 난다). 실측: 한 경기 43초 · 틱당 2.12ms —
   그동안 화면이 통째로 멈춘다. CPU 프로파일 상위: moveAgents 19% · tacticalAnchorXY 13% ·
   assignOffRoles 10% · spaceQuality 8.9%.
   ─ TAC() 는 호출 때마다 Object.assign 으로 새 객체를 만들고 키를 전부 변환한다. 전술은
     경기 중에 거의 바뀌지 않는데 틱마다 수십 번 불린다. 값이 같으면 같은 객체를 돌려준다
     (GC 압력도 함께 줄어든다). */
/* ⚠ 1차 시도는 캐시 키를 문자열로 만들었다가 <b>더 느려졌다</b>(틱당 2.12 → 2.31ms) —
   12칸짜리 문자열을 조립하는 비용이 계산 비용보다 컸다. 값만 직접 비교한다. */
function TAC(src){
  const _tc=(src && src.tactic) ? src.tactic : null;
  if(_tc){
    const c=_tc._tacC;
    if(c!==undefined && c.f===_tc.formation && c.a===_tc.mentality && c.b===_tc.pass
       && c.c===_tc.tempo && c.d===_tc.press && c.e===_tc.line && c.g===_tc.width
       && c.h===_tc.tackle && c.i===_tc.longShot && c.j===_tc.counter && c.k===_tc.crossFq
       && c.l===_tc.defGap && c.m===_tc.transSpd
       && c.n===_tc.defCommit && c.p===_tc.marking && c.q===_tc.trap) return c.o;
  }
  const raw=Object.assign({}, TAC_DEF, (src && src.tactic) ? src.tactic : (src||{}));
  const o={formation:raw.formation, raw};
  for(const k of TAC_KEYS) o[k]=tacVal(raw[k]);
  /* ⚠ counter 는 0~4 정수 단계를 그대로 쓴다(ctrLv/ctrK 가 /4 로 나눔).
     루프 뒤에 두지 않으면 tacVal(0~2 스케일)이 덮어써서 5단계가 3단계로 뭉개진다(실측). */
  o.counter=ctrLv(raw);
  if(_tc){
    /* ⚠ 세이브에 딸려 나가면 안 된다 — 열거되지 않는 속성으로 붙인다 */
    const c={f:_tc.formation, a:_tc.mentality, b:_tc.pass, c:_tc.tempo, d:_tc.press,
             e:_tc.line, g:_tc.width, h:_tc.tackle, i:_tc.longShot, j:_tc.counter,
             k:_tc.crossFq, l:_tc.defGap, m:_tc.transSpd,
             n:_tc.defCommit, p:_tc.marking, q:_tc.trap, o};
    try{ Object.defineProperty(_tc, "_tacC", {value:c, enumerable:false, writable:true, configurable:true}); }
    catch(e){}
  }
  return o;
}
const HI =(v)=>v>=1.5;      // 슬라이더 4·3 칸 (높음 쪽)
const LO =(v)=>v<=0.5;      // 슬라이더 0·1 칸 (낮음 쪽)
const MID=(v)=>v>0.5&&v<1.5;// 정확히 가운데
/* 슬라이더 칸 이름 — 화면 표시용 */
const TAC_LABELS={
  pass:      ["매우 짧게","짧게","혼합","다이렉트","롱볼 위주"],
  tempo:     ["매우 느리게","느리게","보통","빠르게","매우 빠르게"],
  press:     ["압박 자제","낮은 압박","보통","높은 압박","극한 압박"],
  line:      ["매우 낮은 라인","낮은 라인","보통","높은 라인","매우 높은 라인"],
  width:     ["매우 좁게","좁게","보통","넓게","매우 넓게"],
  mentality: ["매우 수비적","수비적","균형","공격적","매우 공격적"],
  tackle:    ["매우 신중하게","신중하게","적당히","거칠게","매우 거칠게"],
  longShot:  ["거의 안 참","자제","보통","적극","매우 적극"],
  counter:   ["역습 안 함","가끔","보통","적극","극단적 역습"],
  crossFq:   ["거의 안 올림","자제","보통","적극","매우 적극"],
  defGap:    ["매우 좁게","좁게","보통","넓게","매우 넓게"],
  transSpd:  ["매우 느리게","느리게","보통","빠르게","매우 빠르게"],
  defCommit: ["톱은 안 내려옴","최소 인원","보통","적극 가담","전원 블록"],
  marking:   ["완전 지역방어","지역 위주","혼합","대인 위주","강한 대인방어"],
  trap:      ["트랩 안 씀","가끔","보통","자주","매우 자주"]};
function tacLabel(key, v){ return (TAC_LABELS[key]||[])[clamp(Math.round(v),0,4)] || String(v); }
/* ── 자유 배치(zone) 시스템: 선수의 "타고난 포지션(p.pos)"과 별개로, 전술판에서 드래그로 지정한
   실제 배치 라인을 관리한다. GK는 항상 고정이며 재배치 불가. 미지정 시 타고난 포지션이 기본값. ── */
/* FM식 포메이션 이름 — 윙백은 수비 숫자에 합산하고, 비어 있는 라인은 건너뛴다.
   예) DF4 + DM2 + AM3 + FW1 → 4-2-3-1 / DF3 + WB2 + MF3 + FW2 → 5-3-2 */
function formationLabel(t, xi){
  /* 배치가 지금 고른 포메이션과 정확히 같으면 그 이름을 그대로 쓴다.
     숫자만 세면 3-5-2 가 5-3-2 로 보인다(윙백을 수비로 세기 때문). 감독이 3-5-2 를 골랐는데
     화면에 5-3-2 라고 뜨면 "선택과 표시가 다르다"고 느낄 수밖에 없다. */
  const picked=(t&&t.tactic&&t.tactic.formation)||null;
  if(picked && FORMATION_SHAPE[picked] && xi && xi.length>=11){
    const so=computeRenderSlots(t, xi);
    const want=formationSlots(picked).slice().sort().join(",");
    const got=xi.filter(p=>p.pos!=="GK").map(p=>so[p.id]).sort().join(",");
    if(want===got) return picked;
  }
  /* ⚠ 예전에는 여기서 getZone(=t.tactic.zone) 으로 줄 수를 셌다. 그런데 피치에 실제로 그려지는 줄은
     computeRenderSlots() 가 내주는 '슬롯'이 정한다. 둘은 어긋날 수 있다 —
     감독이 수비수 한 명을 미드필더 줄로 끌어올리면 수비 칸이 하나 비고, 그 자리는 슬롯을 직접
     지정받지 않은 다른 선수가 '자동 배치'로 채운다. 자동 배치는 zone 에 되쓰지 않으므로
     (그렇게 하면 감독이 직접 옮긴 자리로 둔갑해 굳어버린다) 그 선수의 zone 은 여전히 MF 다.
     결과적으로 화면에는 4명이 서 있는데 이름표는 3명으로 세어 4-1-2-3 이 3-1-3-3 으로 나왔다.
     그래서 이름표도 화면과 같은 근거 — 슬롯 — 로 센다. */
  const so=(xi&&xi.length) ? computeRenderSlots(t, xi) : {};
  const cnt={}; for(const b of BANDS) cnt[b]=0;
  for(const p of xi){
    if(p.pos==="GK") continue;
    const sl=so[p.id];
    if(sl==="GK") continue;                       // 비상 골키퍼로 세워진 필드 플레이어
    let b=(sl && SLOT_BAND[sl]) || getZone(t,p);
    if(!ROW_SLOTS[b]) b=p.pos;
    cnt[b]=(cnt[b]||0)+1;
  }
  // 윙백은 언제나 수비 숫자에 포함한다. 풀백을 윙백 라인으로 올렸다고 해서
  // 미드필더 숫자가 늘어나면(4-4-2 → 2-6-2) 사람이 읽기에 이상하다.
  const parts=[cnt.SW + cnt.DF + cnt.WB, cnt.DM, cnt.MF, cnt.AM, cnt.FW];
  return parts.filter((v,i)=>v>0 || i===0).join("-");
}
function getZone(t,p){
  if(p.pos==="GK") return "GK";
  const z=t&&t.tactic&&t.tactic.zone;
  return (z&&z[p.id]) || p.pos;
}
function setZone(t,pid,zone){
  if(!t.tactic.zone) t.tactic.zone={};
  t.tactic.zone[pid]=zone;
}
/* ── 세부 위치(slot) 시스템: 각 라인을 FM처럼 5개 세부 지역으로 나눈다.
   zone(DF/MF/FW)은 매치엔진 계산(가중치·수비두께 등)에 쓰이는 대분류 그대로 유지하고,
   slot은 화면 표시·포지션별 별점 계산 전용 세부 좌표다. ── */
/* 전술판 라인 — FM처럼 세분화한다. 한 줄은 항상 5칸이고, 그 라인에 없는 자리는 null(빈 칸).
   위(공격)에서 아래(수비) 순서: FW → AM → MF → DM → WB → DF */
/* 옛 FM식 명단 나열 순서 — 우측부터, 스트라이커는 마지막. 표(명단)에만 쓰고 경기장 배치는 ROW_SLOTS 그대로. */
const LIST_SLOTS={
  SW:["SW"],
  DF:["RB","RCB","CB","LCB","LB"],
  WB:["RWB","LWB"],
  DM:["RDM","DM","LDM"],
  MF:["RM","RCM","CM","LCM","LM"],
  AM:["RAM","CAM","LAM"],
  FW:["RW","LW","RS","ST","LS"]
};
const ROW_SLOTS={
  SW:[null,null,"SW",null,null],
  DF:["LB","LCB","CB","RCB","RB"],
  WB:["LWB",null,null,null,"RWB"],
  DM:[null,"LDM","DM","RDM",null],
  MF:["LM","LCM","CM","RCM","RM"],
  AM:[null,"LAM","CAM","RAM",null],
  FW:["LW","LS","ST","RS","RW"]
};
/* 자리 → 라인 역인덱스 (자동 배치가 어느 줄에 속하는지 판단할 때 쓴다) */
const SLOT_BAND=(function(){ const m={}; for(const b in ROW_SLOTS) for(const s of ROW_SLOTS[b]) if(s) m[s]=b; return m; })();
const BANDS=["SW","DF","WB","DM","MF","AM","FW"];         // 뒤에서 앞 순서
const BANDS_TOPDOWN=["FW","AM","MF","DM","WB","DF","SW"]; // 화면에 그리는 순서
const BAND_N={SW:"스위퍼",DF:"수비",WB:"윙백",DM:"수비형 미드필더",MF:"미드필더",AM:"공격형 미드필더",FW:"공격"};
const POS_ROW={}; for(const band in ROW_SLOTS) for(const s of ROW_SLOTS[band]) if(s) POS_ROW[s]=band;
const SLOT_LABEL={SW:"스위퍼",LB:"왼쪽 풀백",LCB:"왼쪽 센터백",CB:"센터백",RCB:"오른쪽 센터백",RB:"오른쪽 풀백",
  LWB:"왼쪽 윙백",RWB:"오른쪽 윙백",LDM:"왼쪽 수비형 미드필더",DM:"수비형 미드필더",RDM:"오른쪽 수비형 미드필더",
  LM:"왼쪽 미드필더",LCM:"왼쪽 중앙 미드필더",CM:"중앙 미드필더",RCM:"오른쪽 중앙 미드필더",RM:"오른쪽 미드필더",
  LAM:"왼쪽 공격형 미드필더",CAM:"공격형 미드필더",RAM:"오른쪽 공격형 미드필더",
  LW:"왼쪽 윙어",LS:"왼쪽 스트라이커",ST:"스트라이커",RS:"오른쪽 스트라이커",RW:"오른쪽 윙어",GK:"골키퍼"};
/* ── 2D 매치엔진(바둑알 시각화)용 좌표 ──
   0~1로 정규화된 피치 좌표계: x=0은 "이 팀의 자기 진영 골라인", x=1은 "상대 골라인"(즉 항상 왼쪽→오른쪽으로
   공격하는 방향 기준 좌표). y=0~1은 위쪽 터치라인→아래쪽 터치라인. 실제 화면에 그릴 때 원정팀은 공격 방향이
   반대이므로 중심점(0.5,0.5) 기준으로 180도 점대칭 이동(mirrorXY)해서 배치한다. */
const SLOT_XY={
  GK:{x:0.04,y:0.5},
  LB:{x:0.20,y:0.10}, LCB:{x:0.16,y:0.32}, CB:{x:0.14,y:0.5}, RCB:{x:0.16,y:0.68}, RB:{x:0.20,y:0.90},
  SW:{x:0.09,y:0.5},
  LWB:{x:0.25,y:0.06}, RWB:{x:0.25,y:0.94},
  LDM:{x:0.29,y:0.36}, DM:{x:0.27,y:0.5}, RDM:{x:0.29,y:0.64},
  LM:{x:0.46,y:0.12}, LCM:{x:0.42,y:0.34}, CM:{x:0.40,y:0.5}, RCM:{x:0.42,y:0.66}, RM:{x:0.46,y:0.88},
  LAM:{x:0.60,y:0.28}, CAM:{x:0.60,y:0.5}, RAM:{x:0.60,y:0.72},
  LW:{x:0.72,y:0.15}, LS:{x:0.76,y:0.36}, ST:{x:0.80,y:0.5}, RS:{x:0.76,y:0.64}, RW:{x:0.72,y:0.85}
};
function mirrorXY(pos){ return {x:1-pos.x, y:1-pos.y}; }
/* 현재 그라운드 위에 있는 22명 + 공의 "쉬는 자세(idle)" 좌표를 계산한다.
   home은 SLOT_XY를 그대로, away는 mirrorXY로 180도 점대칭 이동해서 서로 마주보게 배치한다. */
function computeFormationPositions(M){
  const build=(sd, isHome)=>{
    const xi=onPitch(sd).map(x=>x.p);
    const slotOf=computeRenderSlots(sd.team, xi);
    return onPitch(sd).map(x=>{
      /* ⚠ 예전에는 pos 가 GK 면 무조건 골문에 세웠다. 어쩌다 GK가 둘 올라오면 둘 다 골대 앞에 섰다.
         배정된 자리가 있으면 그 자리를 따른다. */
      const slot = slotOf[x.p.id] || (x.p.pos==="GK" ? "GK" : "CM");
      const base = SLOT_XY[slot] || SLOT_XY.CM;
      const pos = isHome ? base : mirrorXY(base);
      return {id:x.p.id, name:x.p.name, pos:x.p.pos, slot, x:pos.x, y:pos.y, side:isHome?"h":"a"};
    });
  };
  // 코멘터리에서 팀 이름·색을 쓰기 위해 스냅샷에 함께 저장한다(이벤트가 나중에 재생돼도 그때의 정보가 남는다)
  return { h: build(M.h, true), a: build(M.a, false), ball:{x:0.5,y:0.5},
           hShort:M.home.short, aShort:M.away.short, hCol:M.home.col, aCol:M.away.col };
}
/* 특정 선수 id의 idle 좌표만 빠르게 찾을 때 쓰는 헬퍼 (씬 애니메이션의 시작/종료 좌표 계산용) */
function findFormationXY(fp, pid){
  return (fp.h.find(d=>d.id===pid) || fp.a.find(d=>d.id===pid)) || null;
}
// 인원수별 기본 배치(빈 슬롯 인덱스 패턴) — 실제 포메이션 관습을 반영 (백3/미드3은 중앙 위주, 스리톱은 좌우 윙 위주)
const DEFAULT_SPREAD={
  DF:{0:[],1:[2],2:[1,3],3:[1,2,3],4:[0,1,3,4],5:[0,1,2,3,4]},
  MF:{0:[],1:[2],2:[1,3],3:[1,2,3],4:[0,1,3,4],5:[0,1,2,3,4]},
  FW:{0:[],1:[2],2:[1,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4]},
  SW:{0:[],1:[2]},
  WB:{0:[],1:[0],2:[0,4]},
  DM:{0:[],1:[2],2:[1,3],3:[1,2,3]},
  AM:{0:[],1:[2],2:[1,3],3:[1,2,3]}
};
// 세부 지역별 참고 능력치 가중치 — 공격수가 CB로 가면 대인수비·태클 등 수비 스탯 기준으로 별점이 다시 매겨진다
/* ── 포지션별 주요 능력치 가중치 (FM 기준표) ─────────────────────────
   값은 0~100. 그 포지션에서 "얼마나 중요한가"를 뜻하며, 적합도 별점은
   이 가중치로 능력치를 가중평균해서 매긴다.
   CM 은 원표에 없어 DM 과 AM 의 중간으로 둔다. */
const FMW={
 CD:{tec:35,fin:10,dri:40,mar:55,thr:5,lon:10,cor:5,crs:1,tck:40,pas:30,fir:35,pen:10,fre:10,hea:55,
     bra:30,ldr:10,det:20,vis:50,ant:50,otb:10,pos:55,agg:40,cnt:50,fla:10,cmp:80,tea:10,dec:50,wor:55,
     acc:90,bal:35,str:50,agi:60,jum:65,pac:90,sta:30,nat:10},
 FB:{tec:45,fin:10,dri:50,mar:45,thr:30,lon:10,cor:25,crs:45,tck:50,pas:45,fir:35,pen:10,fre:10,hea:20,
     bra:20,ldr:10,det:20,vis:25,ant:45,otb:70,pos:30,agg:45,cnt:45,fla:20,cmp:30,tea:10,dec:45,wor:90,
     acc:100,bal:25,str:25,agi:60,jum:40,pac:100,sta:100,nat:10},
 DM:{tec:50,fin:10,dri:45,mar:20,thr:5,lon:40,cor:10,crs:10,tck:35,pas:65,fir:50,pen:10,fre:30,hea:10,
     bra:30,ldr:15,det:20,vis:55,ant:55,otb:45,pos:65,agg:50,cnt:50,fla:50,cmp:60,tea:10,dec:65,wor:90,
     acc:65,bal:35,str:35,agi:45,jum:15,pac:70,sta:70,nat:10},
 W: {tec:50,fin:15,dri:55,mar:35,thr:10,lon:10,cor:30,crs:65,tck:35,pas:30,fir:30,pen:15,fre:10,hea:10,
     bra:15,ldr:10,det:20,vis:35,ant:45,otb:40,pos:35,agg:35,cnt:35,fla:20,cmp:30,tea:10,dec:35,wor:75,
     acc:100,bal:15,str:30,agi:30,jum:30,pac:100,sta:75,nat:10},
 AM:{tec:65,fin:65,dri:65,mar:1,thr:1,lon:20,cor:5,crs:15,tck:15,pas:50,fir:40,pen:15,fre:30,hea:10,
     bra:20,ldr:10,det:20,vis:30,ant:70,otb:35,pos:10,agg:50,cnt:25,fla:35,cmp:35,tea:10,dec:40,wor:80,
     acc:100,bal:50,str:30,agi:30,jum:30,pac:80,sta:80,nat:10},
 ST:{tec:65,fin:80,dri:75,mar:1,thr:1,lon:25,cor:5,crs:5,tck:5,pas:40,fir:50,pen:20,fre:5,hea:60,
     bra:20,ldr:10,det:20,vis:20,ant:65,otb:45,pos:5,agg:50,cnt:5,fla:25,cmp:45,tea:10,dec:45,wor:60,
     acc:100,bal:50,str:25,agi:30,jum:30,pac:70,sta:65,nat:10}
};
/* 스위퍼 — 중앙 수비 기준에서 위치선정·예측력·판단력을 크게, 대인마크를 조금 낮춘다.
   최후방에서 혼자 읽고 정리하는 자리라 몸싸움보다 머리가 중요하다. */
FMW.SWP=(function(){ const o=Object.assign({},FMW.CD);
  o.pos=85; o.ant=80; o.dec=70; o.cnt=65; o.cmp=85;
  o.mar=40; o.tck=45; o.hea=45; o.pas=45; o.fir=45; o.tec=45;
  o.pac=75; o.acc=75; o.jum=45;
  return o; })();
// CM 은 원표에 없으므로 DM·AM 의 평균으로 만든다
FMW.CM=(function(){
  // 단순 평균이면 공격 능력치(골결정력·드리블) 비중이 커져 공격수가 CM 상위에 오른다.
  const o={}; for(const k in FMW.DM) o[k]=Math.round(FMW.DM[k]*0.65+FMW.AM[k]*0.35);
  o.pas=70; o.fir=60; o.tec=55; o.dec=65; o.tea=45; o.vis=55; o.wor=85; o.sta=80;
  o.fin=20; o.dri=45; o.tck=45; o.pos=55; o.mar=30;
  return o;
})();
/* 원표는 측면 수비의 신체 능력치(가속·주력·지구력 100)가 압도적이라, 빠른 공격수가
   수비수보다 풀백 적합도가 높게 나온다. 수비를 가르는 항목을 올려 균형을 맞춘다. */
FMW.FB.mar=75; FMW.FB.tck=75; FMW.FB.pos=60; FMW.FB.cnt=55; FMW.FB.ant=55;
FMW.FB.fin=5;  FMW.FB.dri=35; FMW.FB.tec=35;
/* 측면 공격수도 마찬가지 — 크로스·드리블 비중을 올려 순수 스피드만으로 오르지 않게 한다 */
FMW.W.crs=80; FMW.W.dri=70; FMW.W.tec=60; FMW.W.otb=55;
/* 슬롯 → 가중치 그룹 */
const SLOT_FMW={
  SW:"SWP", LCB:"CD", CB:"CD", RCB:"CD",
  LB:"FB", RB:"FB", LWB:"FB", RWB:"FB",
  LDM:"DM", DM:"DM", RDM:"DM",
  LCM:"CM", CM:"CM", RCM:"CM",
  LM:"W", RM:"W", LW:"W", RW:"W",
  LAM:"AM", CAM:"AM", RAM:"AM",
  LS:"ST", ST:"ST", RS:"ST"
};
/* 골키퍼는 별도 표 — 필드 능력치가 아니라 GK 전용 능력치로 매긴다 */
const FMW_GK={ ref:100,one:90,han:85,cmd:80,aer:75,com:65,kic:55,pun:35,tro:30,tro2:30,ecc:10,
               cnt:60,dec:55,cmp:55,pos:50,ant:45,bra:35,agi:45,jum:40,acc:20,pac:20,str:25,bal:25 };
// 세부 지역별 슈팅 관여도 — 스트라이커가 가장 많이 쏘고, 측면 공격수·중앙 미드필더가 그 다음,
// 측면 미드필더·풀백은 드물게, 센터백은 세트피스에서나(아주 가끔), 골키퍼는 0(항상 제외).
const SHOT_WEIGHT_SLOT={
  ST:9, LS:7.5, RS:7.5, LW:5, RW:5,
  CM:3.5, LCM:3, RCM:3, LM:2.2, RM:2.2,
  CB:0.6, LCB:0.5, RCB:0.5, LB:0.9, RB:0.9,
  GK:0
};
function shotWeight(t, p){
  if(p.pos==="GK") return 0;
  const slot=t && t.tactic && t.tactic.slot && t.tactic.slot[p.id];
  if(slot && SHOT_WEIGHT_SLOT[slot]!==undefined) return SHOT_WEIGHT_SLOT[slot];
  // 세부 슬롯이 아직 없으면(예: 막 투입된 선수) 대분류 라인 기준으로 대략치를 쓴다
  const band=t?getZone(t,p):p.pos;
  return band==="FW"?6:band==="MF"?3:band==="DF"?1:0;
}
/* ── 이 자리에서의 적합도 ─────────────────────────────────────────
   FM 기준표를 그대로 가중평균하면 변별력이 죽는다. 가속도·주력·지구력·활동량처럼
   "포지션과 무관하게 누구나 높으면 좋은" 항목이 가중치의 30%를 차지하는 반면,
   포지션을 가르는 항목(대인마크·골결정력 등)은 20%뿐이기 때문이다.
   그래서 리그 평균 대비 편차로 계산한다 — 공통 항목은 상쇄되고 특화 항목만 남는다. */
let ATTR_MEAN=null, ATTR_MEAN_AT=-1;
function attrMeans(){
  // 시즌이 바뀌거나 선수단이 크게 달라지면 다시 계산한다
  if(ATTR_MEAN && ATTR_MEAN_AT===G.season) return ATTR_MEAN;
  const sum={}, cnt={}, gsum={}, gcnt={};
  for(const id in G.teams) for(const q of G.teams[id].players){
    if(q.attr) for(const k in q.attr){ sum[k]=(sum[k]||0)+q.attr[k]; cnt[k]=(cnt[k]||0)+1; }
    if(q.gkA)  for(const k in q.gkA){ gsum[k]=(gsum[k]||0)+q.gkA[k]; gcnt[k]=(gcnt[k]||0)+1; }
  }
  const m={}, gm={};
  for(const k in sum) m[k]=sum[k]/Math.max(1,cnt[k]);
  for(const k in gsum) gm[k]=gsum[k]/Math.max(1,gcnt[k]);
  ATTR_MEAN={m, gm}; ATTR_MEAN_AT=G.season;
  return ATTR_MEAN;
}
const ROLEFIT_Q=1.45;  // 역할 적합도에서 "선수의 전반적 실력"이 차지하는 비중
const ROLEFIT_S=1.35;  // "그 역할다운 능력치 배분인가"가 차지하는 비중
const FIT_BASE=62;    // 리그 평균 선수가 자기 포지션에서 받는 기준 점수
const FIT_Q=0.95;     // 선수의 전반적인 수준이 반영되는 정도
const FIT_S=2.6;      // "그 포지션에 맞는 모양인가"가 반영되는 정도
/* 선수 자신의 평균 능력치 — 이걸 빼면 "잘하는 선수는 뭐든 잘한다"는 성분이 사라지고
   그 자리에 필요한 것들을 상대적으로 잘하는지(모양)만 남는다. */
/* ⚠ 제보 — 「종합 능력에 비해 별이 현저히 적게 표시되는 선수가 간혹 있다」.
   원인은 이 함수가 36개 능력치를 「단순 평균」했다는 것이다. 종합(ovr)은 포지션 가중 평균인데
   별점만 단순 평균을 쓰니 두 눈금이 어긋났다 — 수비수는 결정력·개인기·프리킥처럼 그 자리에서
   안 쓰는 능력치가 낮게 생성되고, 그게 평균을 끌어내린다.
   실측(능력치 평균 − 종합): CB −9.6 · LM −9.4 · LB −7.6 · RWB −6.8 · ST −6.0 · DM −1.1.
   그래서 같은 종합 70이라도 센터백은 1.5★, 중앙 미드필더는 3.5★가 나왔다.
   이제 종합과 똑같은 표(POS_WEIGHT)로 잰다. 골키퍼도 이 표가 이미 gkA 를 크게 쳐 주므로
   따로 갈래를 두지 않는다. */
function playerLevel(p){
  const a=p.attr; if(!a) return 62;
  const W=POS_WEIGHT[p.pos]||POS_WEIGHT.MF;
  const g=p.gkA||{};
  let s=0, w=0;
  for(const k in W){
    const raw = (typeof g[k]==="number") ? g[k] : (typeof a[k]==="number" ? a[k] : null);
    if(raw==null) continue;
    s += raw*W[k]; w += W[k];
  }
  return w ? s/w : (p.ovr||62);
}
/* ── 별점의 기준선 ────────────────────────────────────────────────
   FM처럼 별점은 절대 기준이 아니다. "우리 팀 수준"과 "우리가 뛰는 리그 수준"을
   섞은 값을 기준으로, 그보다 얼마나 나은 선수인지를 보여준다.
   그래서 같은 선수라도 강팀에서 보면 별이 적고, 약팀에서 보면 많다. */
/* FM은 "우리 팀 주전 XI 평균"을 기준으로 본다. 주전들이 평균 3~3.5★가 되도록 맞추고,
   그보다 처지는 후보는 2★ 이하, 핵심은 4★ 이상으로 나오게 한다.
   월드클래스를 영입해 주전 수준이 올라가면 기존 후보들의 별은 자동으로 떨어진다. */
const STAR_W_TEAM=0.80;   // 기준선에서 주전 XI 평균이 차지하는 비중
const STAR_W_DIV =0.20;   // 소속 리그 평균 (팀이 통째로 약할 때 5★가 남발되지 않게 하는 닻)
const STAR_MID=3.25;      // 주전 평균 선수가 받는 별
const STAR_SPAN=13.2;     // 별 한 칸에 해당하는 실력 차이
/* 기량 차이를 별점 점수로 바꾸는 배율.
   이 값이 곧 "은색이 언제 뜨는가"를 정한다 — 주전 평균보다 약 13.5 낮으면 1군 눈금(금색 0.5)의
   바닥에 닿고, 그 아래부터 은색이다. 우리 리그 기준으로는 유스 콜업과 하부 리그 하위권이 여기 걸린다. */
const STAR_GAIN=2.70;
/* 리그 전체 평균에는 벤치·유스까지 다 들어가서 그대로 쓰면 별이 전반적으로 후해진다.
   "리그 평균 선수 = 2.5★" 가 되도록 기준선을 조금 올려 둔다. */
/* ⚠ playerLevel 을 포지션 가중 평균으로 바꾸면서 눈금이 통째로 올라갔다(리그 평균 67.4 → 75.2).
   보정값을 그대로 두면 별이 전 구단 0.75★씩 낮게 나온다 — 세 보정을 같은 폭(−3.7)으로 내린다.
   재측정 기준: 리그 평균 2.5★ · 주전 XI 평균 3.25★ */
const STAR_LEAGUE_OFF=3.9;
const PREF_LEAGUE_OFF=7.8;    // 자리 별점을 능력 별점과 같은 눈금에 맞추는 보정
const ROLEFIT_LEAGUE_OFF=6.3; // 역할 적합도 별점의 같은 보정
let STAR_CTX=null, STAR_CTX_KEY="";
function teamLevelOf(t){
  if(!t||!t.players||!t.players.length) return leagueLevel();
  // 실제 선발 XI 를 기준으로 삼는다 (없으면 능력 상위 11명)
  let xi=null;
  try{ if(t.isUser && Array.isArray(G.userXI) && G.userXI.length===11)
         xi=G.userXI.map(id=>t.players.find(q=>q.id===id)).filter(Boolean); }catch(e){}
  if(!xi || xi.length<11){
    try{ xi=bestXI(t); }catch(e){ xi=null; }
  }
  if(!xi || !xi.length) xi=[...t.players].sort((a,b)=>b.ovr-a.ovr).slice(0,11);
  let s=0,n=0;
  for(const q of xi){ if(!q) continue; s+=playerLevel(q); n++; }
  return n? s/n : leagueLevel();
}
function divLevelOf(div){
  let s=0,n=0;
  for(const id in G.teams){ const t=G.teams[id]; if(t.div!==div) continue;
    for(const q of t.players){ s+=playerLevel(q); n++; } }
  return n? s/n : leagueLevel();
}
/* 별점을 보는 관점 — 기본은 내 팀. 스카우팅 화면에서도 내 팀 기준으로 본다(FM과 동일). */
/* 배경색이 밝으면 글자를 검게 — 서울 이랜드 FC처럼 흰색을 쓰는 팀이 생기면서 필요해졌다 */
function inkOn(hex){
  if(!hex || hex[0]!=="#" || hex.length<7) return "#fff";
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return (r*0.299+g*0.587+b*0.114) > 165 ? "#12161c" : "#fff";
}
/* 별점의 기준선 — 예전에는 "내 팀 주전 XI"였다. 그래서 같은 선수가 강팀에 가면 별이 줄고
   약팀에 가면 늘었다. 팀 안에서 누가 주전감인지는 알기 쉬웠지만, 영입 후보를 볼 때
   "이 선수가 리그에서 어느 정도인가"를 알 수 없었다.
   이제 K리그1+K리그2 전체 선수의 평균을 기준으로 삼는다 — 어느 화면에서 보든 같은 별이 나온다. */
function starRefLevel(){
  const key="LEAGUE|"+G.season+"|"+(G.r1||0)+"_"+(G.r2||0);
  if(STAR_CTX && STAR_CTX_KEY===key) return STAR_CTX;
  let s=0,n=0;
  for(const id in G.teams){ const t=G.teams[id];
    for(const q of (t.players||[])){ s+=playerLevel(q); n++; } }
  STAR_CTX = n ? s/n + STAR_LEAGUE_OFF : leagueLevel();
  STAR_CTX_KEY = key;
  return STAR_CTX;
}
function leagueLevel(){
  const MM=attrMeans();
  if(MM.lv!==undefined) return MM.lv;
  let s=0,n=0; for(const k in MM.m){ s+=MM.m[k]; n++; }
  MM.lv = n? s/n : 62;
  return MM.lv;
}
/* ⚠ slotRating 은 가중합이 여러 번 도는 무거운 함수다. bestXI 가 (선수 × 자리) 전 조합을
   훑기 때문에 캐시가 없으면 한 번 부를 때마다 수백 번 계산된다(실측: 라운드당 20초 추가).
   능력치가 바뀌지 않는 한 값도 그대로이므로 선수 객체에 붙여 둔다. */
/* 캐시는 선수 객체가 아니라 바깥 Map 에 둔다 — 객체에 붙이면 세이브(JSON)에 딸려 나가고,
   그걸 막으려고 저장 직전에 지우면 매 라운드 전부 다시 계산하게 된다(실측: 경기당 2.4초). */
const _SR_CACHE=new Map();
function slotRating(p, slot){
  const ck=(p.ovr||65)+"|"+((p.attr&&p.attr.sta)||0)+"|"+((p.attr&&p.attr.fin)||0);
  let e=_SR_CACHE.get(p.id);
  if(!e || e.k!==ck){ e={k:ck, v:{}}; _SR_CACHE.set(p.id, e); }
  const hit=e.v[slot];
  if(hit!==undefined) return hit;
  return (e.v[slot]=slotRatingCalc(p, slot));
}
function slotRatingCalc(p, slot){
  const fb=p.ovr||65, MM=attrMeans();
  const isGK = (slot==="GK");
  // 골키퍼 자리에 필드 플레이어를 놓거나 그 반대면 애초에 말이 안 된다
  if(isGK && p.pos!=="GK") return 24;
  if(!isGK && p.pos==="GK") return 24;
  if(isGK){
    const g=p.gkA, a0=p.attr||{};
    if(!g) return p.gk?(p.gk.shot+p.gk.cmd+p.gk.gkp)/3:fb;
    let d=0,w=0;
    for(const k in FMW_GK){
      const v=(typeof g[k]==="number")?g[k]:(typeof a0[k]==="number"?a0[k]:fb);
      const mean=(MM.gm[k]!==undefined?MM.gm[k]:(MM.m[k]!==undefined?MM.m[k]:62));
      d+=(v-mean)*FMW_GK[k]; w+=FMW_GK[k];
    }
    return clamp(FIT_BASE + (w?d/w:0)*1.9, 20, 99);
  }
  const W=FMW[SLOT_FMW[slot]||"CM"], a=p.attr;
  if(!W||!a) return fb;
  // 모양(shape)은 전체 평균 기준으로 재고, 수준(quality)은 "우리 팀·리그" 기준으로 잰다
  const lvAbs = playerLevel(p) - leagueLevel();      // 능력치 배분을 볼 때 쓰는 절대 기준
  const lv    = playerLevel(p) - starRefLevel();     // 별점에 반영되는 상대 수준
  let shape=0, w=0;
  for(const k in W){
    const v=(typeof a[k]==="number")?a[k]:fb;
    const mean=(MM.m[k]!==undefined?MM.m[k]:62);
    // 전반적 수준(lv)을 빼서, 그 능력치가 "이 선수 기준으로도" 두드러지는지만 본다
    shape += ((v-mean) - lvAbs)*W[k]; w+=W[k];
  }
  return clamp(FIT_BASE + lv*FIT_Q + (w?shape/w:0)*FIT_S, 20, 99);
}
/* 칩에 보이는 별 — 그 자리에 지정된 "역할"의 적합도다.
   포지션 적합도만 보여주면 역할을 바꿔도 별이 그대로라 무엇이 바뀌었는지 알 수 없다. */
/* 포지션 능숙도가 별에 미치는 영향.
   FM처럼 능력치가 좋아도 그 자리를 못 하면 별이 확 줄어든다 — 빨간색(0)이면 반 개까지. */
function famStarMul(fam){
  const f=clamp(fam/100, 0, 1);
  return FAMSTAR_MIN + (1-FAMSTAR_MIN)*Math.pow(f, FAMSTAR_POW);
}
const FAMSTAR_MIN=0.10;   // 능숙도 0 일 때 남는 비율
const FAMSTAR_POW=0.75;   // 곡선 — 낮은 구간에서 더 가파르게 떨어진다
function roleStarsFor(t, p, slot){
  if(!p || !slot) return "";
  if(slot==="GK" && p.pos!=="GK") return slotStars(p, slot);
  const rd=getRole(t, p, slot), R=ROLE_BY_KEY[rd.r];
  if(!R) return slotStars(p, slot);
  const raw=roleFit(p, rd.r);
  const fam=getPosFam(p, slot), L=famLevel(fam);
  /* 🎓 별은 「이 자리 · 이 역할로 지금 내보내면 얼마나 하는가」다 —
     역할 적합도(능력치가 맞는가)에 자리 능숙도와 역할 능숙도를 차례로 곱한다. */
  const rf=getRoleFam(p, rd.r), RL=roleFamLevel(rf);
  const v=clamp(Math.round(raw*famStarMul(fam)*roleFamMul(rf)*2)/2, 0.5, 5);
  const drop = (v<raw) ? ` (능숙도 반영 ${raw}★ → ${v}★)` : "";
  return renderStars(v, `${R.n}(${DUTY_N[rd.d]||rd.d}) 적합도 ${raw}★ · 포지션 능숙도 ${fam} ${L.n} · 역할 능숙도 ${rf} ${RL.n}${drop}`, p, true);
}
function slotStars(p, slot){
  const r=slotRating(p, slot);
  const raw=ovrStarVal(r);
  const fam=getPosFam(p, slot);
  const v=clamp(Math.round(raw*famStarMul(fam)*2)/2, 0.5, 5);
  const pct=Math.round((v/5)*100);
  // 교체 투입 여부를 판단할 때 참고할 수 있도록, 이 자리에서의 적합도 별점 옆에 선수의 선호 포지션도 함께 보여준다
  const prefTxt = p.prefPos ? ` · 선호 포지션: ${p.prefPos}` : "";
  return `<span class="stars" style="--pct:${pct}%" title="${SLOT_LABEL[slot]||slot} 적합도 ${Math.round(r)} · ${v}★${prefTxt}">★★★★★</span>`;
}
/* ── 선호 포지션 기준 별점 (벤치·미등록 명단용) ────────────────────
   벤치에 앉아 있는 선수는 아직 배치된 자리가 없다. 그러니 전체 평균 능력이 아니라
   "이 선수가 원래 뛰는 자리에서 얼마나 하는가"로 보여주는 편이 교체 판단에 훨씬 쓸모 있다.
   FM처럼 우리 팀 주전 평균 기준의 상대평가이고, 1군 수준에 한참 못 미치면 은색으로 나온다. */
function prefSlotOf(p){
  if(!p) return "CM";
  if(p.pos==="GK") return "GK";
  const s=p.prefPos && canonSlot(p.prefPos);
  if(s && SLOT_FAM[s]) return s;
  return p.pos==="DF" ? "CB" : p.pos==="MF" ? "CM" : "ST";
}
/* ── 자리마다 다른 "점수 인심"을 걷어내기 ──────────────────────────
   slotRating은 자리별로 다른 가중치표를 쓰기 때문에, 같은 수준의 선수라도 자리에 따라
   점수가 통째로 달라진다(예: 스트라이커는 후하고 센터백은 짜다). 그대로 별로 바꾸면
   66짜리 공격수가 73짜리 센터백보다 별을 더 받는 이상한 일이 생긴다.
   그래서 "그 자리 리그 평균"을 먼저 빼서 자리별 인심을 없앤 다음, 팀 주전 평균과 비교한다. */
let POSMEAN=null, POSMEAN_KEY="";
function posMeanRating(slot){
  const key=G.season+"|"+(G.r1||0)+"_"+(G.r2||0);
  if(!POSMEAN || POSMEAN_KEY!==key){
    const acc={};
    for(const id in G.teams) for(const q of G.teams[id].players){
      const s=prefSlotOf(q); if(!s) continue;
      const a=acc[s]||(acc[s]={s:0,n:0});
      a.s+=slotRating(q, s); a.n++;
    }
    POSMEAN={}; for(const s in acc) POSMEAN[s]=acc[s].s/acc[s].n;
    POSMEAN_KEY=key;
  }
  return (POSMEAN[slot]!==undefined) ? POSMEAN[slot] : FIT_BASE;
}
/* 자리별 인심을 걷어낸 점수 — 이제 포지션이 달라도 서로 비교할 수 있다 */
function posDevRating(p, slot){ return slotRating(p, slot) - posMeanRating(slot); }
/* 기준점 — 우리 팀 주전 11명의 (자리 보정된) 평균.
   FM처럼 "주전 평균 = 별 3~3.5개"가 되도록, 이 값을 별 3.25개 자리에 놓는다. */
let PREFREF=null, PREFREF_KEY="";
/* 자리 적성의 기준선. 별점 기준선(starRefLevel)을 리그 전체로 옮기면서 이쪽도 같이 옮겼다 —
   한쪽만 리그 기준이면 전술창 벤치 칩의 별과 스쿼드 화면의 별이 서로 어긋난다.
   ⚠ 리그 전 선수를 매번 훑으면 무거우므로 시즌·라운드 단위로 캐시한다. */
function prefRefRating(){
  const key="LEAGUE|"+G.season+"|"+(G.r1||0)+"_"+(G.r2||0);
  if(PREFREF!==null && PREFREF_KEY===key) return PREFREF;
  let s=0,n=0;
  for(const id in G.teams){ for(const q of (G.teams[id].players||[])){
    if(!q) continue; s+=posDevRating(q, prefSlotOf(q)); n++; } }
  PREFREF = n? s/n : 0; PREFREF_KEY = key;
  return PREFREF;
}
/* 벤치·미등록 명단에 쓰는 별점 — 선호 포지션 기준, 우리 팀 주전 평균 대비.
   두 가지를 함께 본다: 순수한 기량(lv)과, 그 자리에 얼마나 맞는 몸인가(fit).
   자리에 아무리 잘 맞아도 기량이 낮으면 별이 따라 내려가야 하므로 기량 쪽에 더 무게를 둔다. */
const PREF_W_LV=2.45;   // 기량 (우리 팀 주전 평균 대비)
const PREF_W_FIT=1.10;  // 자리 적성 (리그 같은 포지션 평균 대비)
function prefStarScore(p){
  const slot=prefSlotOf(p);
  const lv=playerLevel(p) - starRefLevel();
  const fit=posDevRating(p, slot) - prefRefRating();
  /* 기준선을 리그 전체로 옮기면서 자리 별점만 후해졌다(측정: 5★ 5.5% vs 능력 별점 0.9%).
     두 눈금이 어긋나면 같은 선수가 전술창에서 5★, 스쿼드에서 4★로 보인다. 눈금을 맞춘다. */
  return FIT_BASE + lv*PREF_W_LV + fit*PREF_W_FIT - PREF_LEAGUE_OFF;
}
/* 능숙도는 "표시될 별"을 깎는다 — 금색이든 은색이든 각자 눈금 안에서 줄어든다 */
function prefStarGrade(p){
  const gr=starGrade(prefStarScore(p), abilityIsSilver(p));
  const mul=famStarMul(getPosFam(p, prefSlotOf(p)));
  return {silver:gr.silver, v:clamp(Math.round(gr.v*mul*2)/2, 0.5, 5), gold:gr.gold*mul};
}
function prefStarVal(p){ return prefStarGrade(p).v; }
function prefStars(p){
  if(!p) return "";
  const slot=prefSlotOf(p), gr=prefStarGrade(p);
  return renderStars(gr, `${SLOT_LABEL[slot]||slot} 기준 ${starGradeText(gr)} (K리그 전체 평균 대비)${gr.silver?" · 1군 눈금 아래 (유스·하부 리그 수준)":""}`, p);
}
/* 우클릭 팝업에 띄울 "포지션별 별 개수" — 능숙도 0인 자리는 애초에 소화할 수 없으니 빼고,
   해본 적 있는 자리만 별점이 높은 순으로 보여준다. */
const FAM_SLOT={GK:"GK",SW:"SW",DC:"CB",DL:"LB",DR:"RB",WBL:"LWB",WBR:"RWB",DM:"DM",MC:"CM",
  ML:"LM",MR:"RM",AMC:"CAM",AML:"LAM",AMR:"RAM",LW:"LW",RW:"RW",ST:"ST"};
function positionStarRows(p){
  if(!p) return [];
  if(!p.posFam) p.posFam=initPosFam(p); else migratePosFam(p);
  const pref=prefSlotOf(p);
  const sil=abilityIsSilver(p);   // 눈금은 선수 하나당 하나 — 자리마다 금·은이 뒤섞이면 비교가 안 된다
  const rows=[];
  for(const k of FAM_POS){
    const fam=clamp(Math.round(p.posFam[k]||0),0,100);
    if(fam<=0) continue;                       // 아예 못 하는 자리는 표시하지 않는다
    const slot=FAM_SLOT[k]; if(!slot) continue;
    if((p.pos==="GK") !== (k==="GK")) continue; // 골키퍼/필드 플레이어는 서로의 자리를 섞지 않는다
    // 벤치 칩과 같은 잣대(기량 + 자리 적성, 주전 평균 대비)를 써야 팝업의 별 개수가 어긋나지 않는다
    const lv=playerLevel(p) - starRefLevel();
    const g=starGrade(FIT_BASE + lv*PREF_W_LV + (posDevRating(p, slot) - prefRefRating())*PREF_W_FIT, sil);
    const mul=famStarMul(fam);
    const gr={silver:g.silver, v:clamp(Math.round(g.v*mul*2)/2, 0.5, 5), gold:g.gold*mul};
    rows.push({k, slot, fam, v:gr.v, gr, rank:starRank(gr), pref:slot===pref, L:famLevel(fam)});
  }
  // 은색 5개는 금색 0.5개보다 낫지 않다 — 같은 잣대(starRank)로 줄을 세운다
  rows.sort((a,b)=> b.rank-a.rank || b.fam-a.fam);
  return rows;
}
function setSlot(t,pid,slot){ if(!t.tactic.slot) t.tactic.slot={}; t.tactic.slot[pid]=slot; }
/* 현재 선발 XI 전체를 놓고 각 선수의 세부 슬롯을 계산한다 — 사용자가 직접 지정한 슬롯은 그대로 쓰고,
   아직 지정되지 않은 선수만 같은 라인 내 빈 자리에 자동 배치한다. 자동 배치된 자리는 즉시 t.tactic.slot에
   "고정(sticky)"으로 저장해 둔다 — 그래야 나중에 다른 선수가 같은 라인으로 들어오거나 나가서 인원수가
   바뀌어도, 이미 자리 잡은 선수들은 절대 다시 계산되어 밀려나지 않는다(= "주변 선수가 따라 이동" 버그 방지). */
/* 🧤 ⚠ 요청 — 「골키퍼도 선발 제외할수있게하자」.
   감독이 ⬇ 제외로 골문을 비워 뒀는가? 그렇다면 전술판에서는 필드 플레이어를 골문에 세우지 않고
   빈 자리로 둔다. 경기 중에는 비상 키퍼가 반드시 필요하므로 예전 그대로 둔다. */
function xiGkEmptyEdit(t, xi){
  try{
    if(typeof inLiveTactics!=="undefined" && inLiveTactics) return false;
    if(typeof liveM!=="undefined" && liveM && !liveM.done) return false;
    return !!(t && t.isUser && t.tactic && t.tactic.xiManual
              && Array.isArray(xi) && !xi.some(p=>p && p.pos==="GK"));
  }catch(e){ return false; }
}
function computeRenderSlots(t, xi){
  const slotOf={};
  // 골문에 설 선수 — 정식 키퍼가 없으면(전원 부상) 비상 키퍼를 세운다.
  let gkP=xi.find(p=>p.pos==="GK");
  if(!gkP && !xiGkEmptyEdit(t, xi)) gkP=pickEmergencyGK(xi);
  if(gkP) slotOf[gkP.id]="GK";
  if(t && !t.tactic.slot) t.tactic.slot={};
  const savedSlot=(t&&t.tactic&&t.tactic.slot)||{};
  /* ── 배치는 "지금 고른 포메이션"을 따른다 ─────────────────────────
     예전에는 선수의 타고난 포지션(DF/MF/FW)으로 줄을 나눴다. 그래서 선발을 손으로 바꿔
     수비수를 한 명 더 넣으면, 포메이션은 4-3-3인데 화면은 5-2-3으로 그려졌다.
     이제는 ① 감독이 직접 끌어다 놓은 자리(t.tactic.slot)를 최우선으로 지키고,
     ② 남은 선수는 그 포메이션이 요구하는 남은 자리에 별점 순으로 앉힌다.
     그래서 선발을 어떻게 바꾸든 화면 모양은 고른 포메이션과 항상 일치한다. */
  const fname=(t&&t.tactic&&t.tactic.formation)||"4-3-3";
  const shapeSlots=formationSlots(fname);
  // ⚠ "골키퍼 포지션이 아닌 선수"가 아니라 "골문에 선 그 한 명을 뺀 전원"이어야 한다.
  //    예비 키퍼가 선발에 끼면 그 선수는 어느 쪽에도 안 들어가 자리를 못 받는다.
  const outfield=xi.filter(p=>p!==gkP);
  const pinned={}, freeMen=[];
  const takenSlots=new Set();
  for(const p of outfield){
    const s=savedSlot[p.id];
    if(s && SLOT_BAND[s] && !takenSlots.has(s)){ pinned[p.id]=s; takenSlots.add(s); }
    else freeMen.push(p);
  }
  // 포메이션이 요구하는 자리 중 아직 비어 있는 곳
  let openSlots=shapeSlots.filter(s=>!takenSlots.has(s));
  // 고정된 선수가 포메이션 밖 자리에 서 있으면(자유 배치) 자리 수가 모자랄 수 있다 —
  // 그럴 땐 아무 라인의 빈 자리라도 내준다.
  if(openSlots.length<freeMen.length){
    for(const b of BANDS) for(const s of ROW_SLOTS[b])
      if(s && !takenSlots.has(s) && openSlots.indexOf(s)<0) openSlots.push(s);
  }
  const autoAssign={};
  const pairs=[];
  for(const p of freeMen) for(const s of openSlots) pairs.push({p, s, v:slotPickScore(p, s)});
  pairs.sort((a,b)=>b.v-a.v);
  const doneP=new Set(), doneS=new Set();
  for(const c of pairs){
    if(doneP.size>=freeMen.length) break;
    if(doneP.has(c.p.id)||doneS.has(c.s)) continue;
    doneP.add(c.p.id); doneS.add(c.s); autoAssign[c.p.id]=c.s;
  }
  const slotFor=(p)=> pinned[p.id] || autoAssign[p.id] || null;
  const bands={}; for(const b of BANDS) bands[b]=[];
  for(const p of xi){
    if(p===gkP) continue;
    const sl=slotFor(p);
    let b = (sl && SLOT_BAND[sl]) || getZone(t,p);
    if(!ROW_SLOTS[b]) b=p.pos;
    (bands[b]=bands[b]||(bands[b]=[])).push(p);
  }
  for(const band of BANDS){
    const members=bands[band]||[];
    // 이미 이 라인에 유효한(현재 밴드와 일치하는) 저장 슬롯을 가진 선수는 그대로 고정 — 재계산하지 않는다.
    // 혹시 저장값이 겹치는 경우(과거 세이브 등)는 먼저 처리되는 선수가 그 자리를 갖고, 나머지는 새로 배치된다.
    const taken=new Set();
    const sticky=[], needsPlacement=[];
    for(const p of members){
      const s=slotFor(p);
      if(s && ROW_SLOTS[band].indexOf(s)>=0 && !taken.has(s)){ taken.add(s); sticky.push(p); slotOf[p.id]=s; }
      else needsPlacement.push(p);
    }
    const freeSlots=ROW_SLOTS[band].filter(s=>s&&!taken.has(s));
    const n=needsPlacement.length;
    const pattern=(DEFAULT_SPREAD[band][Math.min(n,5)]||[]).map(i=>ROW_SLOTS[band][i]).filter(s=>s&&freeSlots.includes(s));
    const chosen = pattern.length>=n ? pattern.slice(0,n) : [...pattern, ...freeSlots.filter(s=>!pattern.includes(s))];
    needsPlacement.sort((a,b)=>a.id-b.id);
    needsPlacement.forEach((p,i)=>{
      const s=chosen[i] || freeSlots[i] || ROW_SLOTS[band].filter(Boolean)[i%ROW_SLOTS[band].filter(Boolean).length];
      slotOf[p.id]=s;
      // ⚠ 여기서 t.tactic.slot 에 되받아 쓰면 안 된다. 자동 배치가 "감독이 직접 옮긴 자리"로
      //    둔갑해 굳어버리고, 나중에 포메이션을 바꿔도 옛 자리가 남아 모양이 어긋난다.
      //    배치는 매번 같은 입력에서 같은 결과가 나오므로 저장하지 않아도 흔들리지 않는다.
    });
  }
  return slotOf;
}
function lineAvgs(xi, t){
  const avg=a=>a.length?a.reduce((s,p)=>s+p.ovr,0)/a.length:65;
  const age=xi.length?xi.reduce((s,p)=>s+(G.season-p.by),0)/xi.length:28;
  const z=p=>t?getZone(t,p):p.pos; // 팀이 주어지면 실제 배치 라인 기준, 아니면 타고난 포지션 기준
  // 중거리 슛 지시의 적합도를 보려면 "누가 그걸 잘 차는가"를 알아야 한다 (필드 플레이어 평균)
  const fp=xi.filter(p=>p.pos!=="GK");
  const lng=fp.length? fp.reduce((s,p)=>s+((p.attr&&p.attr.lon)||60),0)/fp.length : 60;
  // 화면에 보여줄 값은 선수 능력치와 같은 1~20 눈금으로 낸다 (내부 계산은 계속 0~100 원본).
  const a20=(list,key)=> list.length ? list.reduce((s,p)=>s+attr20((p.attr&&p.attr[key])!=null?p.attr[key]:60),0)/list.length : 12;
  return {def:(avg(xi.filter(p=>z(p)==="GK"))+avg(xi.filter(p=>z(p)==="DF"))*3)/4,
          mid:avg(xi.filter(p=>z(p)==="MF")), atk:avg(xi.filter(p=>z(p)==="FW")), age, lng,
          lng20:a20(fp,"lon"), sta20:a20(fp,"sta"), wor20:a20(fp,"wor")};
}
/* 내 공격 기대치 보정 — 내 전술 × 스쿼드 적합도 × 상대 전술 상성 */
function tacticAtkBonus(me, opp, L, Lo){
  const T=TAC(me), O=TAC(opp);
  let a=0;
  // 패스 스타일: 짧은(0)=미드 의존/압박에 취약, 다이렉트(2)=FW 의존/압박 회피/뒷공간 공략
  if(LO(T.pass)){ a += (L.mid-70)*0.030; if(HI(O.press) && L.mid<73) a -= (73-L.mid)*0.030; }
  if(HI(T.pass)){ a += (L.atk-70)*0.020; if(HI(O.line)) a += 0.10; if(HI(O.press)) a += 0.05; }
  // 템포: 빠름=기회↑ 실수↑(미드 약하면), 느림=기회↓ 안정↑
  if(HI(T.tempo)){ a += 0.07; if(LO(T.pass) && L.mid<72) a -= 0.06; if(L.age>29) a -= 0.03; }
  if(LO(T.tempo)){ a -= 0.05; }
  // 수비 라인: 높음=진영 압박↑ / 낮음=공격 기회↓
  if(HI(T.line)) a += 0.06;
  if(LO(T.line)) a -= 0.05;
  // 폭: 넓게=측면 공격(다이렉트와 시너지), 좁게=중앙 밀집
  if(HI(T.width)){ a += (HI(T.pass)?0.05:0.03); if(LO(O.width)) a -= 0.02; }
  if(LO(T.width) && HI(O.press)) a -= 0.03;
  // 역습: 상대가 공격적/높은 라인일 때만 위력
  { const ck=ctrK(T);
    if(ck>0) a += ck*(((HI(O.mentality)||HI(O.line))?0.22:-0.07) + (LO(T.line)?0.04:0)); }
  // 상대 전술이 내 공격에 주는 영향
  if(HI(O.press)) a -= 0.04;      // 전방 압박의 전반적 억제
  /* 상대 수비 라인 — 예전에는 HI/LO 두 칸만 보고 ±0.04~0.05 였다. 라인 3과 4가 같은 취급을 받아
     극단적으로 올린 라인의 대가가 거의 없었다. 눈금에 그대로 비례시킨다. */
  /* ⚠ 전술창 배선 감사 — O 는 TAC 변환값(0~2)인데 원시 눈금 공식이 그대로 남아
     (O.line-2) 가 「±비례」가 아니라 0~-0.11 상시 감점이 됐고(보통 라인 상대에도 -0.055),
     O.press>=3 은 영원히 거짓이라 「강한 압박 뚫렸을 때의 보상」이 전혀 안 들어갔다.
     0~2 눈금 기준(보통=1)으로 다시 쓴다 — 의도한 크기(±0.11 / 최대 +0.06)는 그대로. */
  a += (O.line-1)*0.11;           // 높을수록 뒷공간, 낮을수록 공간 없음
  if(HI(O.press)) a += (O.press-1)*0.06;  // 강한 압박은 뚫렸을 때 그만큼 크게 열린다
  if(LO(O.tempo)) a -= 0.02;
  if(HI(O.press) && Lo.age>29) a += 0.03; // 노장 압박은 후반 헐거움
  // 수비 강도: 거친 태클은 몸싸움으로 공격 전개를 자주 끊어놓고, 신중한 태클은 공격수에게 더 많은 시간·공간을 내준다
  if(HI(O.tackle)) a -= 0.05;
  if(LO(O.tackle)) a += 0.04;
  return a;
}
/* 압박/템포에 따른 체력 소모 계수 */
/* 🔋 전술이 체력에 물리는 배수. 폭이 넓으면 「압박하는 전술을 못 쓸 정도」가 된다 —
   0.35/0.25 → 0.29/0.20 으로 좁혔다(최대 1.60 → 1.49 · 최소 0.40 → 0.51). */
function condFactor(t){ const T=TAC(t); return 1+(T.press-1)*0.29+(T.tempo-1)*0.20; }
function styleName(t){
  const T=TAC(t);
  /* ⚠ 제보 — 「선수비 후역습」으로 맞춰 놨는데 위쪽 표기는 「롱볼 역습」이었다.
     이 프리셋은 다이렉트 패스(3)도 함께 쓰기 때문에 롱볼 조건에 먼저 걸렸다.
     ─ 라인과 멘탈리티가 함께 낮으면 그건 롱볼이 아니라 「내려서서 역습」이다. 먼저 판정한다. */
  if(ctrLv(T)>=3 && LO(T.line) && LO(T.mentality)) return "선수비 후역습";
  /* 짧은 패스 + 강한 압박 + 높은 라인 = 티키타카 (게겐과 갈라 준다) */
  if(LO(T.pass) && HI(T.press) && HI(T.line)) return "티키타카";
  if(HI(T.press)&&HI(T.line)) return "게겐프레싱";
  if(LO(T.pass)&&T.tempo<=1&&T.width<=1) return "점유율 축구";
  if(HI(T.pass)&&ctrLv(T)>=3) return "롱볼 역습";
  if(ctrLv(T)>=3&&LO(T.line)) return "선수비 후역습";
  if(ctrLv(T)>=4) return "극단적 역습";
  if(HI(T.pass)&&HI(T.width)) return "측면 크로스";
  if(HI(T.mentality)) return "닥공";
  if(LO(T.mentality)) return "실리 축구";
  return "밸런스";
}
/* 🕵️ 수석코치의 대응 조언 — ⚠ 제보 원문 — 「상대가 '점유율 축구', '실리 축구' 일 때는
   상대의 정보만 알려줄 뿐 적절한 조언을 해주지 않고 있다 (…) '닥공' 일 때도 마찬가지다.
   보일 때도 있고 안 보일 때도 있는 듯 합니다」.
   원인 — 조언이 「라인이 높은가 / 압박이 강한가」 두 가지만 보고 붙었다. 그래서 라인이 보통이고
      압박도 평범한 스타일(점유율 축구·실리 축구·닥공 등)에서는 조언 줄이 통째로 비어 버렸다.
      같은 스타일이라도 라인·압박이 우연히 높으면 조언이 뜨니 「보일 때도 있고 안 보일 때도」였다.
   ─ 스타일마다 대응 한 수를 반드시 붙이고, 라인·압박·전력 차 조언을 그 위에 얹는다. */
const SCOUT_PLAN={
  "점유율 축구":"공을 길게 소유하며 우리를 끌고 다닙니다. 쫓아다니면 체력만 빠집니다 — <b>중앙을 좁혀</b> 길목을 막고, 끊는 즉시 <b>빠른 역습</b>으로 나가세요.",
  "실리 축구":"내려앉아 기다리는 팀입니다. <b>폭을 넓혀</b> 수비 블록을 벌리고 <b>측면 크로스·중거리</b>로 두드리세요. 대신 <b>역습 한 방</b>은 늘 대비해야 합니다.",
  "닥공":"앞에서부터 몰아칩니다. <b>라인을 낮춰</b> 뒷공간을 지우고 <b>역습</b>으로 응수하세요 — 무리한 빌드업보다 다이렉트가 안전합니다.",
  "티키타카":"짧은 패스로 삼각형을 만들어 조립합니다. <b>중앙 압박</b>으로 연결 고리를 끊고, 빼앗으면 <b>한 번에</b> 앞으로 넘기세요.",
  "게겐프레싱":"공을 잃으면 곧바로 달려듭니다. 우리 진영에서 짧게 돌리지 말고 <b>한 번에 넘겨</b> 첫 압박을 건너뛰세요.",
  "롱볼 역습":"길게 넘겨 우리 뒤를 노립니다. <b>라인을 내리고</b> 세컨드볼 다툼에 사람을 두세요.",
  "선수비 후역습":"버스를 세우고 기다립니다. 서두르지 말고 <b>넓게</b> 돌리되, 우리 뒷공간에 <b>한 명은 남겨</b> 두세요.",
  "극단적 역습":"오직 역습만 봅니다. 공을 잃는 위치가 곧 승부입니다 — <b>무리한 전진</b>과 얕은 패스를 줄이세요.",
  "측면 크로스":"측면에서 올려 붙입니다. <b>폭을 좁혀</b> 박스 안 숫자를 늘리고, 제공권이 약하면 <b>측면부터</b> 차단하세요.",
  "밸런스":"뚜렷한 색이 없는 팀입니다. 우리 색을 그대로 밀어붙이되, 흐름을 보고 <b>먼저 한 수</b>를 두세요."
};
/* st=스타일 이름 · OT=TAC() 결과(0~2) · gap=상대 전력-우리 전력 */
function scoutAdvice(st, OT, gap){
  const out=[];
  if(SCOUT_PLAN[st]) out.push(SCOUT_PLAN[st]);
  try{
    if(OT){
      if(HI(OT.line))      out.push("라인이 높습니다 — <b>배후 침투·다이렉트</b>로 뒷공간을 노려보세요.");
      else if(LO(OT.line)) out.push("깊이 내려섭니다 — <b>짧은 패스 + 넓은 폭</b>으로 끈질기게 두드리세요.");
      if(HI(OT.press))      out.push("압박이 강합니다 — 중원이 밀리면 <b>다이렉트 패스</b>가 안전합니다.");
      else if(LO(OT.press)) out.push("압박이 헐겁습니다 — <b>템포를 올려</b> 상대가 정비되기 전에 들어가세요.");
      /* 🛡️ 새 수비 지시도 정찰에 잡힌다 — 상대가 어떤 수비를 들고 나오는지가 곧 우리 공격의 답이다 */
      if(OT.defCommit!=null && HI(OT.defCommit))
        out.push("<b>전원이 내려앉습니다</b>(가담 인원 높음) — 박스 앞이 두껍습니다. 중앙을 두드리기보다 <b>폭을 넓혀 측면·컷백</b>으로 여세요. 대신 뺏으면 앞이 텅 빕니다.");
      else if(OT.defCommit!=null && LO(OT.defCommit))
        out.push("앞선이 <b>내려오지 않습니다</b> — 우리 후방은 압박을 덜 받지만, 뺏기는 순간 상대 앞선이 그대로 남아 있습니다. <b>역습 대비</b>를 두세요.");
      if(OT.marking!=null && HI(OT.marking))
        out.push("<b>대인 방어</b>로 붙습니다 — 끌고 다니면 자리가 벌어집니다. <b>스위칭·오버래핑</b>으로 마크를 흔들고 빈 레인을 쓰세요.");
      else if(OT.marking!=null && LO(OT.marking))
        out.push("<b>지역 방어</b>입니다 — 형태가 잘 안 깨집니다. 줄 <b>사이(하프 스페이스)</b>에서 받는 선수를 만들어야 열립니다.");
      if(OT.trap!=null && HI(OT.trap))
        out.push("<b>오프사이드 트랩</b>을 자주 겁니다 — 침투를 반 박자 늦추고, 라인을 <b>등지고 받는</b> 선수를 먼저 쓰세요. 한 번 깨면 곧바로 1대1입니다.");
    }
    if(typeof gap==="number"){
      if(gap>=2.5)       out.push("전력이 처집니다 — 실점 없이 버티다 <b>후반 승부</b>를 보는 편이 낫습니다.");
      else if(gap<=-2.5) out.push("우리가 앞섭니다 — 상대는 내려앉을 겁니다. <b>인내심</b>을 갖고 두드리세요.");
    }
  }catch(e){}
  if(!out.length) out.push("특별히 경계할 색은 없습니다 — 우리 전술을 그대로 밀고 나가세요.");
  return out.slice(0,3);
}
/* AI 팀 전술 성향 부여 */
function assignAITactics(t){
  if(t.isUser) return;
  const str=teamOVR(t);
  const T=t.tactic;
  // 0~4 눈금. 가운데(2)를 기준으로 팀 색깔만큼 좌우로 벌린다.
  if(str>=73){        T.press=2+R(3); T.line=2+R(3); T.pass=1+R(2); T.tempo=2+R(3); T.width=1+R(3); T.counter=R(2);
                      T.mentality=2+(Math.random()<0.35?1+R(2):0); T.tackle=1+R(3); T.longShot=1+R(3); }
  else if(str>=69){   T.press=1+R(3); T.line=2;      T.pass=1+R(3); T.tempo=1+R(3); T.width=1+R(3); T.counter=1+R(3);
                      T.mentality=2;                 T.tackle=1+R(3); T.longShot=1+R(3); }
  else {              T.press=R(3);   T.line=R(3);   T.pass=2+R(3); T.tempo=1+R(3); T.width=1+R(3); T.counter=2+R(3);
                      T.mentality=Math.random()<0.3?R(2):2;
                      T.tackle=Math.random()<0.4?3+R(2):R(3);       // 약팀은 거친 몸싸움에 의존하는 경향
                      T.longShot=Math.random()<0.4?3+R(2):R(3); }
  /* ⚠ 배선 감사 — AI 는 press·line·pass·tempo·width·counter·mentality·tackle·longShot 아홉 개만
     뽑고 있었다. defGap·transSpd·crossFq 는 물론 새로 넣은 defCommit·marking·trap 까지
     전부 기본값 2(보통)로 고정이라, <b>AI 감독끼리 수비 색깔이 전혀 안 갈렸다</b>.
     나머지도 여기서 뽑는다 — 라인·성향과 결이 맞도록 묶어서 정한다. */
  T.defGap   = (T.line<=1 ? R(2) : (T.line>=3 ? 2+R(3) : 1+R(3)));      // 낮은 라인 = 좁게
  T.transSpd = (T.press>=3 ? 2+R(3) : (T.press<=1 ? R(3) : 1+R(3)));    // 압박 팀이 전환도 빠르다
  T.crossFq  = (T.width>=3 ? 2+R(3) : (T.pass>=3 ? 2+R(2) : 1+R(3)));   // 넓게·롱볼이면 크로스가 는다
  /* 🛡️ 수비 가담 인원 — 라인이 낮고 수비적일수록 전원이 내려온다 */
  T.defCommit = clamp(2 + (T.line<=1?1:0) + (T.mentality<=1?1:0) - (T.line>=3?1:0)
                        - (T.mentality>=3?1:0) + (Math.random()<0.30?1:0) - (Math.random()<0.30?1:0), 0, 4);
  /* 🧷 마킹 — 압박이 세면 대인 쪽, 내려앉으면 지역 쪽. 약팀은 대인에 기대는 경향 */
  T.marking = clamp(2 + (T.press>=3?1:0) - (T.line<=1?1:0)
                      + (str<69 && Math.random()<0.35?1:0) + (Math.random()<0.25?1:0) - (Math.random()<0.25?1:0), 0, 4);
  /* 🪤 트랩 — 높은 라인의 무기다. 낮은 라인은 거의 안 쓴다 */
  T.trap = T.line<=1 ? R(2) : clamp((T.line>=3 ? 2 : 1) + R(3) - 1, 0, 4);
  /* 감독의 색깔 — 공격 성향 감독은 무게를 앞으로, 수비 성향 감독은 실리로 (이정효 19/15 → 닥공) */
  const c=(typeof coachOf==="function")?coachOf(t):null;
  if(c){
    const lean=c.att-c.def;
    const k=Math.abs(lean)>=4?2:1;   // 이정효(+4)급 극단 성향은 두 칸씩 민다
    if(lean>=2){ T.mentality=clamp(T.mentality+k,0,4); T.press=clamp(T.press+k,0,4); T.line=clamp(T.line+1,0,4); T.tempo=clamp(T.tempo+(k-1),0,4); }
    else if(lean<=-2){ T.mentality=clamp(T.mentality-k,0,4); T.counter=clamp(T.counter+k,0,4); T.line=clamp(T.line-1,0,4); }
    /* 🛡️ ⚠ 배선 구멍 — 새로 넣은 수비 지시 셋(가담 인원·마킹·트랩)이 위에서 팀 슬라이더로만
       뽑히고, 정작 <b>감독 성향(att−def)은 안 타고</b> 있었다. 바로 윗줄에서 성향·압박·라인을
       밀면서 수비 지시만 그대로 두면, 수비형 감독과 공격형 감독의 수비가 똑같아진다. */
    if(lean<=-2){        // 수비형 감독 — 전원이 내려오고, 형태를 지키고, 모험은 안 한다
      T.defCommit=clamp(T.defCommit+k,0,4);
      T.marking  =clamp(T.marking-1,0,4);
      T.trap     =clamp(T.trap-k,0,4);
    } else if(lean>=2){  // 공격형 감독 — 앞선을 남기고, 붙어서 뺏고, 라인을 밀어 올린다
      T.defCommit=clamp(T.defCommit-k,0,4);
      T.marking  =clamp(T.marking+1,0,4);
      T.trap     =clamp(T.trap+k,0,4);
    }
    /* 🧠 전술 능력 — 판을 잘 읽는 감독일수록 지시가 <b>서로 맞물린다</b>.
       라인이 높은데 트랩을 안 걸거나, 라인이 낮은데 트랩을 거는 어긋남을 스스로 정리한다. */
    if(c.tac>=17){
      if(T.line>=3 && T.trap<2) T.trap=2+R(2);
      if(T.line<=1 && T.trap>1) T.trap=R(2);
      if(T.line<=1 && T.defCommit<2) T.defCommit=2+R(2);
    }
    /* 감독 선호 포메이션 — 시즌 정체성. 공격 성향은 3톱·2톱, 수비 성향은 5백·원톱 계열 */
    const FPOOL = lean>=2 ? ["4-3-3","4-2-3-1","4-2-2-2","3-4-3"]
      : lean<=-2 ? ["4-1-4-1","5-3-2","4-4-1-1","5-2-1-2"]
      : ["4-4-2","4-2-3-1","4-3-3","3-5-2"];
    if(Math.random()<0.75) T.formation=pick(FPOOL);   // 극단 전술(2-3-5·7-2-1)은 시즌 편성에 쓰지 않는다
    /* ⚠ 요청 — 「국면 포메이션은 없애자. 너무 극단적이었던 것 같다」. AI 채택도 함께 걷어냈다. */
  }
  assignAIRoles(t);
}
/* ── AI 구단의 개인 역할 배정 ──────────────────────────────────────────
   여태 AI는 팀 슬라이더만 정하고 개인 역할은 손대지 않았다. 그래서 리그의
   측면 자원은 예외 없이 "윙(지원)", 최전방은 전원 "전진형 포워드"였고
   인사이드 포워드·레지스타·포처 같은 역할이 리그에 한 명도 없었다.
   역할 적합도(roleFit)도 AI에게는 아무 의미가 없는 숫자였다.
   이제 세 가지를 섞어 고른다.
     ① 역할 적합도 — 잘하는 걸 시킨다
     ② 팀 전술 궁합 — 좁게 서는 팀은 안으로 접는 역할을, 다이렉트한 팀은 타깃형을
     ③ 약간의 무작위 — 같은 전술이라도 팀마다 색깔이 갈리도록                     */
const AI_ROLE_FIT_W=1.00;   // 적합도 1★ 이 주는 점수
const AI_ROLE_TAC_W=0.55;   // 전술 궁합의 최대 가중
const AI_ROLE_RAND=0.85;    // 무작위 폭 — 이게 없으면 같은 전술의 팀이 전부 똑같아진다
/* 역할의 효과(fx)가 팀 전술과 얼마나 맞는지. 슬라이더 0~4를 -1~+1로 놓고 곱한다. */
function aiRoleTacFit(fx, T){
  const c=v=>((v===undefined?2:v)-2)/2;
  const press=c(T.press), width=c(T.width), direct=c(T.pass),
        ment=c(T.mentality), tempo=c(T.tempo), line=c(T.line),
        lsh=c(T.longShot), ctr=c(ctrLv(T));
  let s=0;
  s += (fx.press||0)*press*0.9 + (fx.aggPress||0)*press*0.7;
  s += (fx.wide||0)*width*0.8;                 // wide 는 음수(안으로 접기)일 수 있다 — 좁은 팀이면 저절로 가점
  s += (fx.cutIn||0)*(-width)*0.5;
  s += (fx.cross||0)*(width*0.6+direct*0.4)*0.8 + (fx.earlyCross||0)*direct*0.6;
  s += (fx.aerialTarget||0)*direct*0.9 + (fx.hold||0)*direct*0.5 + (fx.longPass||0)*direct*0.6;
  s += (fx.pm||0)*(-direct)*0.9 + (fx.shortPass||0)*(-direct)*0.5 + (fx.oneTwo||0)*(-direct)*0.4;
  s += (fx.killer||0)*(ment*0.5+ctr*0.4)*0.6;
  s += (fx.breakLine||0)*ctr*0.9 + (fx.lateRun||0)*ctr*0.4;
  s += (fx.fwd||0)*ment*0.7 + (fx.deep||0)*(-ment)*0.6;
  s += (fx.shoot||0)*lsh*0.7 + (fx.longShot||0)*lsh*0.9;
  s += (fx.dribble||0)*(-direct)*0.5 + (fx.roam||0)*(tempo*0.3+ment*0.3);
  s += (fx.sweep||0)*line*0.9 + (fx.sweepBack||0)*line*0.6;
  s += (fx.tightMark||0)*(-line)*0.4 + (fx.clearFirst||0)*(-line)*0.5;
  return clamp(s, -1.6, 1.6);
}
function assignAIRoles(t, onlyMissing){
  if(!t || t.isUser || !t.players) return;
  const T=t.tactic; if(!T) return;
  if(!T.role) T.role={};
  /* 🧠 ⚠ 배선 구멍 — 이 함수는 <b>감독을 한 번도 보지 않았다.</b> 누가 인사이드 포워드고
     누가 레지스타인지를 정하는 자리인데, 전술 능력 12 짜리 감독과 18 짜리 감독이
     똑같은 폭의 무작위로 배치했다.
     ─ 전술(tac) 능력이 두 가지를 바꾼다:
       ① 무작위 폭 — 잘 읽는 감독은 덜 헤맨다(AI_ROLE_RAND ×0.55 ~ ×1.45)
       ② 전술 궁합 가중 — 잘 읽는 감독은 「우리 전술에 맞는 역할」을 더 크게 본다 */
  const _cT=(typeof coachOf==="function")?coachOf(t):null;
  const _tacQ=_cT&&_cT.tac!=null ? clamp((_cT.tac-15)/5, -1.2, 1.2) : 0;
  const _rnd = AI_ROLE_RAND*clamp(1-_tacQ*0.38, 0.55, 1.45);
  const _tacW= AI_ROLE_TAC_W*clamp(1+_tacQ*0.45, 0.62, 1.55);
  // 좋은 선수부터 원하는 역할을 가져간다 — 플레이메이커 자리를 4순위 선수가 차지하지 않게
  const order=[...t.players].sort((a,b)=>(b.ovr||0)-(a.ovr||0));
  let pmUsed=0, roamUsed=0, cbSeen=0;
  for(const p of order){
    if(onlyMissing && T.role[p.id]) continue;
    const cands=rolesForSlot(p.prefPos||"CM");
    if(!cands.length) continue;
    let best=null, bestS=-99, bestFx=null;
    for(const R0 of cands){
      const fx=normalizeFx(Object.assign({}, R0.fx(R0.duty[0])||{}));
      let s=roleFit(p, R0.k)*AI_ROLE_FIT_W + aiRoleTacFit(fx, T)*_tacW + Math.random()*_rnd;
      if((fx.pm||0)>0   && pmUsed>=1)   s-=1.6;   // 한 팀에 플레이메이커가 셋이면 서로 공을 뺏는다
      if((fx.roam||0)>0 && roamUsed>=1) s-=1.2;
      if(s>bestS){ bestS=s; best=R0; bestFx=fx; }
    }
    if(!best) continue;
    // 임무 — 공격 성향이 높을수록 앞쪽 임무를. 센터백만은 스토퍼·커버를 번갈아 짝지어 준다
    // (둘 다 스토퍼면 뒷공간이 통째로 비고, 둘 다 커버면 아무도 나가서 막지 않는다).
    const du=best.duty; let d;
    if(du.includes("St")||du.includes("Cv")){
      d = (cbSeen++%2===0) ? (du.includes("St")?"St":du[0]) : (du.includes("Cv")?"Cv":du[0]);
    } else {
      const grp=ROLE_GRP[p.prefPos]||"CM";
      const wantA=(T.mentality===undefined?2:T.mentality)
                + ((grp==="ST"||grp==="AM")?1.2:0) + ((grp==="CB"||grp==="GK")?-1.5:0);
      d = wantA>=3 ? (du.includes("A")?"A":du[du.length-1])
        : wantA<=1 ? (du.includes("D")?"D":du[0])
        : (du.includes("S")?"S":du[Math.min(1,du.length-1)]);
    }
    if((bestFx.pm||0)>0) pmUsed++;
    if((bestFx.roam||0)>0) roamUsed++;
    T.role[p.id]={r:best.k, d};
  }
}
/* 이적으로 새로 들어온 선수는 역할이 비어 있다 — 경기 전에 빈 자리만 채운다 */
function ensureAIRoles(t){
  if(!t || t.isUser || !t.players) return;
  if(!t.tactic) return;
  if(!t.tactic.role){ assignAIRoles(t); return; }
  if(t.players.some(p=>!t.tactic.role[p.id])) assignAIRoles(t, true);
}
