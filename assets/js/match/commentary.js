"use strict";
/* =====================================================
   하이라이트 중계 코멘터리 시스템

   2D 화면 하단 자막을 담당한다. 애니메이션의 각 단계(패스 → 돌파 → 슛 → 결과)가 진행될 때마다
   그 순간에 맞는 문장이 실시간으로 바뀌어, 화면에서 벌어지는 일과 자막이 항상 일치한다.

   [코멘터리 DB] 상황(type)별 문장 배열. 문장 안의 %PLAYER% / %TEAM% / %OPPONENT_PLAYER% /
                 %OPPONENT_TEAM% 은 호출 시 넘긴 data로 치환된다.
   [매니저]      CommentaryManager.printCommentary(type, data) — 배열에서 하나를 골라(직전 문장은 피함)
                 변수를 치환하고 화면에 출력한다. GOAL·SAVE 같은 중요한 순간에는 팀 색상 배경과
                 강조/점멸 CSS 클래스를 동적으로 입힌다.
===================================================== */
const COMM_DB={
  PASS:[
    "%PLAYER%, 침착하게 앞으로 연결합니다.",
    "%PLAYER%의 정확한 패스가 들어갑니다!",
    "%TEAM%, %PLAYER%를 거쳐 공격을 전개합니다.",
    "%PLAYER%, 한 박자 빠르게 내줍니다!",
    "%PLAYER%의 날카로운 스루패스!",
    "%TEAM%가 %PLAYER%를 통해 템포를 올립니다."
  ],
  DRIBBLE:[
    "%PLAYER%, 공을 몰고 파고듭니다!",
    "%PLAYER%가 %OPPONENT_PLAYER%를 제치고 전진합니다!",
    "%PLAYER%, 드리블 돌파를 시도합니다!",
    "%PLAYER%가 속도를 올려 수비를 흔듭니다!",
    "%PLAYER%, 공간을 파고들며 각을 만듭니다!"
  ],
  CROSS:[
    "%PLAYER%, 페널티 박스 안으로 크로스를 올립니다!",
    "%PLAYER%의 얼리 크로스!",
    "%PLAYER%, 측면에서 안쪽으로 감아 올립니다!"
  ],
  SHOOTING:[
    "%PLAYER%, 슛!",
    "%PLAYER%가 강하게 때립니다!",
    "%PLAYER%, 골문을 향해 감아 찹니다!",
    "%PLAYER%의 과감한 슈팅!"
  ],
  GOAL:[
    "고오올!!! %PLAYER%가 환상적인 슈팅으로 골망을 흔듭니다!",
    "대단합니다! %TEAM%의 %PLAYER%, 골을 터뜨립니다!",
    "들어갔습니다! %PLAYER%의 완벽한 마무리!",
    "%TEAM% 골! %PLAYER%가 해냅니다!"
  ],
  SAVE:[
    "%OPPONENT_PLAYER% 골키퍼가 몸을 날려 걷어냅니다!",
    "선방! %OPPONENT_PLAYER%가 %PLAYER%의 슛을 쳐냅니다!",
    "%OPPONENT_PLAYER%의 반사신경! 코너킥으로 흘려보냅니다!"
  ],
  MISS:[
    "%PLAYER%의 슛, 골대를 살짝 벗어납니다!",
    "아깝습니다! %PLAYER%의 슈팅이 크게 떴습니다.",
    "%PLAYER%, 머리를 감싸쥡니다. 빗나갔습니다!"
  ],
  BLOCK:[
    "%OPPONENT_PLAYER%가 몸을 던져 막아냅니다!",
    "블로킹! %OPPONENT_PLAYER%의 헌신적인 수비입니다!"
  ],
  CORNER:["%TEAM%, 코너킥을 얻어냅니다!","굴절된 공, %TEAM%의 코너킥입니다!"]
};
/* 중요한 순간의 연출 강도 — "flash"는 점멸+강조, "big"은 강조만 */
const COMM_BIG={GOAL:"flash", OWNGOAL:"flash", RED:"flash", SAVE:"big", PEN:"big"};
/* 씬 종류 → 결과 자막에 입힐 연출 등급 */
const COMM_STYLE={
  shot_goal:"GOAL", pen_goal:"GOAL", shot_owngoal:"OWNGOAL",
  shot_save:"SAVE", pen_miss:"SAVE", card_red:"RED", pen_action:"PEN"
};
function hexA(hex, a){ // #rrggbb → rgba()
  const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||"")); if(!m) return `rgba(88,166,255,${a})`;
  const n=parseInt(m[1],16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
class CommentaryManager{
  constructor(elementId){ this.elId=elementId; this.last={}; }
  el(){ return document.getElementById(this.elId); }
  /* 같은 문장이 연속으로 나오지 않도록 직전 것은 피해서 고른다 */
  pick(type){
    const pool=COMM_DB[type];
    if(!pool || !pool.length) return null;
    if(pool.length===1) return pool[0];
    let s, guard=0;
    do{ s=pool[Math.floor(Math.random()*pool.length)]; }while(s===this.last[type] && guard++<6);
    this.last[type]=s;
    return s;
  }
  fill(tpl, data){
    data=data||{};
    return String(tpl)
      .replace(/%PLAYER%/g, data.player||"선수")
      .replace(/%OPPONENT_PLAYER%/g, data.opponentPlayer||"상대 선수")
      .replace(/%OPPONENT_TEAM%/g, data.opponentTeam||"상대팀")
      .replace(/%TEAM%/g, data.team||"");
  }
  /* 상황(type)에 맞는 문장을 골라 변수 치환 후 출력한다 */
  printCommentary(type, data){
    const tpl=this.pick(type);
    if(tpl===null) return null;
    const html=this.fill(tpl, data);
    this.render(html, type, data);
    return html;
  }
  /* 매치 시뮬레이션이 이미 완성해 둔 문장(스코어 표시 등이 포함된 결과 자막)을 그대로 출력할 때 */
  printRaw(html, styleKey, data){ this.render(html, styleKey, data); return html; }
  render(html, styleKey, data){
    const el=this.el(); if(!el) return;
    data=data||{};
    const big=COMM_BIG[styleKey];
    const min=(data.minute!=null) ? `<b>${data.minute}'</b> ` : "";
    const tag=data.tag ? `<span class="small">[${data.tag}]</span> ` : "";
    el.innerHTML = min+tag+html;
    // 중요 순간에는 팀 색상 배경 + 강조/점멸 클래스를 동적으로 입힌다
    el.className = "pitchCaption" + (big ? " cmt-big" : "") + (big==="flash" ? " cmt-flash" : "");
    if(big && data.color){
      el.style.borderLeft=`4px solid ${data.color}`;
      el.style.background=`linear-gradient(90deg, ${hexA(data.color,0.30)} 0%, #0a0f14 62%)`;
    } else {
      el.style.borderLeft=""; el.style.background="";
    }
    if(big==="flash" && el.offsetWidth!==undefined){ void el.offsetWidth; } // 같은 연출이 연달아 나와도 애니메이션 재시작
  }
}
const COMMENTARY=new CommentaryManager("pitchCaption");
/* 이벤트가 이미 갖고 있는 완성 문장을 자막으로 띄운다(연출 등급은 씬 종류에서 가져온다) */
/* 전광판에 지금 보여 주고 있는 스코어. 시뮬은 이미 앞서가 있어도, 화면은 공개된 이벤트까지만 안다. */
let shownHg=0, shownAg=0;
/* 화면(하이라이트·문자중계)이 도달한 시점의 통계 — 없으면 시뮬 현재값을 쓴다 */
let shownSt=null;
function revealScore(e){
  if(!e || e.hg==null) return;
  if(e.hg<shownHg || e.ag<shownAg) return;   // 리플레이로 되감긴 장면 — 전광판은 내리지 않는다
  if(e.hg!==shownHg || e.ag!==shownAg){
    shownHg=e.hg; shownAg=e.ag;
    const sc=document.getElementById("lvScore");
    if(sc){ sc.textContent=`${shownHg} : ${shownAg}`; sc.classList.remove("flash"); void sc.offsetWidth; sc.classList.add("flash"); }
  }
}
/* 💥 ⚠ 요청 — 「골대를 맞추거나 강력한 중거리 슛이 터졌을 때 경기장 전체를 미세하게 흔든다」.
   ⚠ 시뮬은 화면보다 앞서 굴러간다 — 시뮬이 그 순간에 흔들면 스포일러이자 타이밍이 어긋난다.
     그래서 「화면이 그 장면의 자막을 띄우는 순간」(setCaption2D)에 흔든다. 하이라이트 재생이든
     실시간 관전이든 사람이 보는 그 순간과 정확히 맞는다.
   세기(p)는 이벤트가 실어 온다: 골은 거리·슛 종류로, 골대 강타는 고정 1.25. */
function pitchShake(p){
  try{
    const w=document.querySelector(".pitchWrap"); if(!w) return;
    const k=clamp(+p||0.6, 0.15, 1.4);
    w.style.setProperty("--shk", (2.6*k).toFixed(2)+"px");
    w.style.setProperty("--shkR", (0.30*k).toFixed(2)+"deg");
    w.classList.remove("shake"); void w.offsetWidth;      // 연달아 터져도 다시 시작한다
    w.classList.add("shake");
    clearTimeout(pitchShake._t);
    pitchShake._t=setTimeout(()=>{ try{ w.classList.remove("shake"); }catch(e){} }, k>=1 ? 620 : 460);
  }catch(e){}
}
function setCaption2D(e, styleKey){
  revealScore(e);
  /* 💥 이 자막이 화면에 뜨는 그 순간에 흔든다 (요청) */
  try{
    const _sk = (e && e.shake) || (e && e.scene && e.scene.shake) || 0;
    if(_sk) pitchShake(_sk);
  }catch(e2){}
  const style = styleKey!==undefined ? styleKey : (e.scene ? COMM_STYLE[e.scene.kind] : undefined);
  COMMENTARY.printRaw(e.txt, style, {
    minute: e.noTime ? null : e.min,
    tag: e.t || null,
    color: commTeamColor(e)
  });
}
/* 이벤트를 일으킨 팀(공격 측)의 색 — 스냅샷에 저장해 둔 값을 쓴다 */
function commTeamColor(e){
  if(!e.form || !e.scene) return null;
  return e.scene.atkSide==="a" ? e.form.aCol : e.form.hCol;
}
let pendingLiveM=null, pendingLiveTag=null, pendingPostM=null;
let awayReactReady=false;   // 상대 라커룸 반응 화면 — 좌측 진행 버튼이 「계속」이 된다
let inLockerTalk=false; // FM처럼 라커룸 토크 진행 중 상태(true인 동안 "경기" 탭에서 이 화면이 이어진다)
let inLineupPreview=false; // 라인업 프리뷰 화면 진행 중 상태("경기" 탭 복귀시 재현용)
let lockerScreenState=null; // 라커룸 토크의 현재 하위 화면(선택지/반응)을 기억해 "경기" 탭 복귀시 그대로 재현한다
let fanTownhallCtx=null; // {M, cont, phase:'question'|'result', resultData} — 팬 간담회 진행 상태("경기" 탭 복귀시 재현용)
