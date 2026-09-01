"use strict";
/* ── 90분 시뮬 관전 (실험 기능) ──
   1단계 연속 시뮬레이션(MatchSim)을 실제로 눈으로 확인하기 위한 화면.
   기존 경기 진행과는 완전히 분리돼 있어서, 여기서 무엇을 하든 세이브·성적에 영향을 주지 않는다. */
/* 관전 화면의 시간 배율 — 1배속에서 경기 시계 1초가 실제 0.5초로 흐른다.
   90분 경기를 실제 45분에 볼 수 있다. (버튼의 배속은 여기에 곱해진다) */
const SIM_TIME_SCALE=2;   // 라이브 재생 배속 — 시계 배율을 2로 되돌리며 다시 절반으로 (화면 체감 속도 동일)
let simWatch=null, simWatchRAF=null, simWatchSpeed=4, simWatchLast=null, simWatchAcc=0, simInfoAt=0;
let SIMSET={hid:null, aid:null, hf:"4-3-3", af:"4-2-3-1"};
function simTeamIds(){
  const ids=Object.keys(G.teams);
  if(!SIMSET.hid || !G.teams[SIMSET.hid]){ const uf=findUserFixture(); SIMSET.hid = uf?uf.hid:ids[0]; }
  if(!SIMSET.aid || !G.teams[SIMSET.aid] || SIMSET.aid===SIMSET.hid){
    const uf=findUserFixture(); SIMSET.aid = (uf&&uf.aid!==SIMSET.hid)?uf.aid:ids.find(i=>i!==SIMSET.hid);
  }
  return [SIMSET.hid, SIMSET.aid];
}
function setSimTeam(side, id){ SIMSET[side==="h"?"hid":"aid"]=id; restartSimWatch(); }
function setSimForm(side, f){ SIMSET[side==="h"?"hf":"af"]=f; restartSimWatch(); }
function simWatchView(){
  return `<h2>⚽ 90분 시뮬 관전 <span class="small">(실험 기능 · 경기 결과에 영향 없음)</span></h2>
  <div class="card">
    <p class="small" style="margin-bottom:10px">
      확률 엔진과 별개로 도는 연속 시뮬레이션입니다. 22명이 실제로 볼을 주고받고, 압박하고, 뺏는 모습을 그대로 보여줍니다.
      아직 슈팅·침투·오프사이드는 들어가 있지 않습니다(다음 단계).
    </p>
    ${simSetupHtml()}
    <canvas id="simPitch" width="640" height="420"></canvas>
    <div id="simInfo" class="pitchCaption">준비 중...</div>
    <div style="margin-top:10px">
      ${[1,4,10,30].map(sp=>`<button class="mini ${simWatchSpeed===sp?'sel':''}" onclick="setSimSpeed(${sp})">${sp}배속</button>`).join(" ")}
      <button class="mini" style="margin-left:10px" onclick="restartSimWatch()">↻ 처음부터</button>
    </div>
  </div>`;
}
/* 관전 화면 — 양 팀과 포메이션을 직접 고른다. 특정 전술 대결을 반복 관찰할 때 쓴다. */
function simSetupHtml(){
  const [hid,aid]=simTeamIds();
  const opts=(sel)=>Object.keys(G.teams).map(id=>
    `<option value="${id}" ${id===sel?"selected":""}>${G.teams[id].name}</option>`).join("");
  const fopts=(sel)=>Object.keys(FORMATION_SHAPE).map(f=>
    `<option value="${f}" ${f===sel?"selected":""}>${f}</option>`).join("");
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div style="background:#0d1117;border:1px solid var(--bd);border-radius:8px;padding:8px">
      <div class="small" style="color:var(--acc);font-weight:700;margin-bottom:4px">홈</div>
      <select onchange="setSimTeam('h',this.value)" style="width:100%;margin-bottom:4px">${opts(hid)}</select>
      <select onchange="setSimForm('h',this.value)" style="width:100%">${fopts(SIMSET.hf)}</select>
    </div>
    <div style="background:#0d1117;border:1px solid var(--bd);border-radius:8px;padding:8px">
      <div class="small" style="color:var(--red);font-weight:700;margin-bottom:4px">원정</div>
      <select onchange="setSimTeam('a',this.value)" style="width:100%;margin-bottom:4px">${opts(aid)}</select>
      <select onchange="setSimForm('a',this.value)" style="width:100%">${fopts(SIMSET.af)}</select>
    </div>
  </div>`;
}
function setSimSpeed(sp){ simWatchSpeed=sp; if(VIEW==="simwatch"){ show("simwatch"); startSimWatchLoop(true); } }
function restartSimWatch(){ simWatch=null; startSimWatchLoop(); }
function openSimWatch(){ show("simwatch"); startSimWatchLoop(); }
function stopSimWatch(){ if(simWatchRAF){ cancelAnimationFrame(simWatchRAF); simWatchRAF=null; } }
function startSimWatchLoop(keep){
  stopSimWatch();
  if(!keep || !simWatch){
    const [hid,aid]=simTeamIds();
    // 고른 포메이션을 양 팀에 실제로 적용하고 나서 매치를 만든다
    applyFormation(G.teams[hid], SIMSET.hf);
    applyFormation(G.teams[aid], SIMSET.af);
    simWatch=new MatchSim(createMatch(G.teams[hid], G.teams[aid], {}));
  }
  simWatchLast=null; simWatchAcc=0;
  const step=(now)=>{
    const cv=document.getElementById("simPitch");
    if(!cv || VIEW!=="simwatch"){ stopSimWatch(); return; }
    const t=(now===undefined?nowMs():now);
    const dtMs = simWatchLast==null ? 16 : Math.min(250, t-simWatchLast);
    simWatchLast=t;
    simWatchAcc += (dtMs/1000)*simWatchSpeed*SIM_TIME_SCALE;
    let guard=0;
    while(simWatchAcc>=SIM_DT && simWatch.clock<simWatch.endSec && guard++<400){
      snapshotSim(simWatch);          // 틱 직전 위치를 남긴다 — 이 사이를 화면에서 이어 그린다
      simWatch.tick();
      simWatchAcc-=SIM_DT;
    }
    if(simWatchAcc>SIM_DT*400) simWatchAcc=0;   // 탭 전환 등으로 크게 밀렸을 때 몰아서 튀지 않게
    drawSimWatch(cv);
    simWatchRAF=requestAnimationFrame(step);
  };
  simWatchRAF=requestAnimationFrame(step);
}
/* 한 틱(0.2초) 직전의 위치를 기록해 둔다.
   시뮬레이션은 0.2초 간격으로만 갱신되므로, 그대로 그리면 초당 5프레임처럼 뚝뚝 끊긴다.
   직전 위치와 현재 위치 사이를 화면 프레임마다 이어 그려야 공이 흐르듯 움직인다. */
function snapshotSim(s){
  if(!s) return;
  for(const a of s.agents){ a._rx=a.x; a._ry=a.y; a._rf=a.face; }
  const b=s.ball; b._rx=b.x; b._ry=b.y; b._rz=b.z||0;
  if(s.ref){ s.ref._rx=s.ref.x; s.ref._ry=s.ref.y; }
}
/* 보간 계수 — 다음 틱까지 얼마나 왔는가(0~1). 한 틱 뒤처져 그리는 대신 완전히 매끄럽다. */
function simAlpha(){ return clamp01(simWatchAcc/SIM_DT); }
/* 각도 보간 — -π~π 경계를 넘어갈 때 반대로 도는 것을 막는다 */
function lerpAngle(a0, a1, t){
  if(a0===undefined||a1===undefined) return a1;
  let d=a1-a0; while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2;
  return a0+d*t;
}
/* 캔버스에서 클릭으로 고른 선수 id (FM처럼 찍으면 이름이 뜬다). null = 선택 없음 */
let simPick=null;
/* 색이 밝은지 — 밝은 유니폼 위에는 검은 등번호를 써야 읽힌다 */
/* 🎽 원정 유니폼 — 홈과 색이 비슷한 계열이면 원정 바둑알을 흰색으로 (K리그 원정은 흰색) */
function awayDiscCol(hCol, aCol){
  const px=(c)=>{ const m=/^#?([0-9a-f]{6})/i.exec(c||""); if(!m) return [128,128,128];
    const v=parseInt(m[1],16); return [(v>>16)&255,(v>>8)&255,v&255]; };
  const A=px(hCol), B=px(aCol);
  const d=Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2]);
  return d<120 ? "#f2f4f7" : aCol;
}
/* ═══ 🧤 골키퍼 킷 — 실제 규정처럼 「모두와 다른 색」 ═══════════════════════
   ⚠ 제보 — 「전남처럼 노란 유니폼을 입은 팀은 경기 중에 필드 플레이어와 골키퍼가 구분되지 않는다」.
      골키퍼를 양 팀 모두 금색(#e3b341) 한 가지로 그리고 있었다. 노란 킷과 겹치는 건 물론이고,
      두 팀 골키퍼가 같은 색이라 누구 골문인지도 헷갈렸다.
   ─ 실제 규정(경기규칙 제4조)대로 골키퍼는 「양 팀 필드 플레이어·상대 골키퍼·주심과 구별되는」
     색을 입는다. 후보 색 중에서 그 조건을 가장 잘 만족하는 색을 경기마다 고른다. */
const GK_KITS=["#e3b341","#3fb950","#a371f7","#ff7ab6","#20c9c9","#ff8a3d","#f2f4f7","#111418"];
function colDist(a,b){
  const px=(c)=>{ const m=/^#?([0-9a-f]{6})/i.exec(String(c||"")); if(!m) return [128,128,128];
    const v=parseInt(m[1],16); return [(v>>16)&255,(v>>8)&255,v&255]; };
  const A=px(a), B=px(b);
  /* 사람 눈이 민감한 쪽에 가중치 — 초록 잔디 위 작은 점을 구분하는 기준 */
  return Math.hypot((A[0]-B[0])*0.9, (A[1]-B[1])*1.2, (A[2]-B[2])*0.7);
}
/* avoid 에 든 색들과 가장 멀리 떨어진 킷을 고른다 */
function pickGkKit(avoid, seed){
  let best=GK_KITS[0], bestD=-1;
  const list=GK_KITS.slice();
  /* 같은 대진에서 매번 같은 색이 나오게 — 팀 이름으로 시작점만 돌린다 */
  const off=Math.abs(seed||0)%list.length;
  for(let i=0;i<list.length;i++){
    const c=list[(i+off)%list.length];
    let d=1e9;
    for(const x of (avoid||[])) if(x) d=Math.min(d, colDist(c,x));
    if(d>bestD){ bestD=d; best=c; }
  }
  return best;
}
function seedOf(s){ let h=0; for(let i=0;i<String(s||"").length;i++) h=(h*31+String(s).charCodeAt(i))|0; return h; }
/* 이 경기의 골키퍼 두 벌 — 서로도, 필드 킷과도 겹치지 않게 */
function gkKitsFor(hCol, aCol, hId, aId){
  const PITCH="#2f7d3a";                                   // 잔디
  const hk=pickGkKit([hCol, aCol, PITCH], seedOf(hId));
  const ak=pickGkKit([hCol, aCol, PITCH, hk], seedOf(aId)+7);
  return {h:hk, a:ak};
}
/* 🎨 어두운 배경 위에 글자로 쓸 색 — 구단 색이 너무 진하면(울산 남색 등) 숫자가 안 읽힌다.
   색조는 유지하고 밝기만 끌어올린다. */
function uiInk(hex){
  const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||"").trim());
  if(!m) return "#e6edf3";
  const v=parseInt(m[1],16);
  let r=(v>>16)&255, g=(v>>8)&255, b=v&255;
  const lum=0.299*r+0.587*g+0.114*b;
  if(lum>=96) return "#"+m[1];
  const k=clamp((96-lum)/150, 0, 0.62);          // 어두울수록 흰색을 더 섞는다
  r=Math.round(r+(255-r)*k); g=Math.round(g+(255-g)*k); b=Math.round(b+(255-b)*k);
  const hx=(n)=>n.toString(16).padStart(2,"0");
  return "#"+hx(r)+hx(g)+hx(b);
}
function isLightColor(hex){
  if(!hex || hex[0]!=="#") return false;
  const h=hex.length===4 ? "#"+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3] : hex;
  const r=parseInt(h.substr(1,2),16), g=parseInt(h.substr(3,2),16), b=parseInt(h.substr(5,2),16);
  return (0.299*r+0.587*g+0.114*b) > 150;
}
function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
/* 캔버스 클릭 — 누른 자리에서 가장 가까운 선수를 고른다. 빈 곳을 누르면 선택 해제. */
function pickPlayerOnPitch(ev, cv, sim){
  if(!sim || !cv || !cv.getBoundingClientRect) return;
  const rc=cv.getBoundingClientRect();
  // 화면에 표시된 크기와 캔버스 실제 픽셀 크기가 다를 수 있다(반응형·폰트 배율).
  // 클릭 좌표를 캔버스 픽셀 좌표로 옮겨 놓고 비교해야 어긋나지 않는다.
  const kx=cv.width/(rc.width||cv.width), ky=cv.height/(rc.height||cv.height);
  const cx=(ev.clientX-rc.left)*kx, cy=(ev.clientY-rc.top)*ky;
  let best=null, bd=1e9;
  for(const a of sim.agents){
    const pt=pitchToCanvasXY(cv, a.x, a.y);
    const d=HYP(pt.x-cx, pt.y-cy);
    if(d<bd){ bd=d; best=a; }
  }
  simPick = (best && bd<26) ? best.id : null;   // 26px 안이면 그 선수를 고른 것으로 본다
}
/* 녹화해 둔 하이라이트 한 프레임을 그린다.
   시뮬 객체의 좌표를 잠시 그 순간의 값으로 바꿔 놓고 평소 그림 함수를 그대로 쓴다 —
   재생 중에는 시뮬이 멈춰 있으므로 안전하고, 캔버스 코드를 두 벌 유지하지 않아도 된다. */
/* ── 득점자 패널 (FM처럼 화면 한가운데) ─────────────────────
   골이 들어간 순간 GOAL · 득점자 · 시간을 큼직하게 띄우고, 세리머니가 끝나면 걷는다. */
let goalPanelTimer=null;
/* ⚠ 제보 — 「팀에 같은 이름의 FW 알렉스와 MF 알렉스가 있는데, 골 팝업에 포지션이 없어
     누가 넣었는지 헷갈린다」. 이름 앞에 그 선수의 자리(등록 포지션 + 세부 자리)를 붙인다. */
function showGoalPanel(side, name, minute, sub, cancelled, pos, slot){
  if(!liveM) return;
  const team = side==="h" ? liveM.home : liveM.away;
  /* ⚔️ ⚠ 제보 — 「게스트 화면에서 골 팝업이 표시되지 않는다」.
     원인: 게스트에게 보내는 중계가 이 함수 「맨 끝」에 있었는데, 맨 앞에서
        `#goalPanel` 이 없으면 곧바로 돌아 나갔다. 호스트가 전술판·하프타임 화면처럼
        경기 레이아웃이 아닌 곳에 있으면 그 패널이 존재하지 않는다 —
        그 순간 골이 공개되면 호스트도 못 보고 게스트에게도 아예 안 갔다.
     ─ 중계를 먼저 한다. 내 화면에 패널이 있든 없든 상대에게는 팝업이 떠야 한다. */
  try{
    if(liveM.opts && liveM.opts.pvp && typeof PVP!=="undefined" && PVP && PVP.role==="host"){
      pvpSend({t:"gp", off:cancelled?1:0, nm:String(name||"득점").slice(0,14), min:String(minute||""),
               sub:String(sub||"").slice(0,40), pos:pos||"", slot:slot||"",
               col:cancelled?"#f85149":readableTeamColor(team), tm:String(team.short||"").slice(0,18)});
      PVP._gpOn=1;
    }
  }catch(e){}
  const el=document.getElementById("goalPanel"); if(!el) return;
  /* ⚠ 제보 — 「성남이 골을 넣을 때 GOAL! 글자가 안 보인다」.
     골 팝업의 글자·테두리 색으로 구단 대표색을 그대로 썼는데, 성남(#101010)처럼
     거의 검정인 팀은 어두운 배경(rgba(8,12,17))에 묻혀 글씨가 사라졌다.
     너무 어두운 색이면 보조색을 쓰고, 그것도 어두우면 기본 파랑으로 넘긴다. */
  el.style.setProperty("--gpCol", cancelled ? "#f85149" : readableTeamColor(team));
  /* ⚠ 제보 — 「득점자는 고유 포지션(CB), 도움은 상세 포지션(LCB)으로 갈려서 헷갈린다」.
     둘 다 그날 실제로 선 자리로 통일한다. 색은 등록 포지션(수비·미드·공격)을 따른다. */
  const posTag = (slot||pos) ? `<span class="gpPos pos-${pos||"MF"}">${slot||pos}</span>` : "";
  el.innerHTML = cancelled
    ? `<div class="gpBox gpOff">
         <div class="gpTag">NO GOAL</div>
         <div class="gpName">${posTag}<span class="gpStrike">${name||"득점"}</span></div>
         <div class="gpMeta"><b>${minute}'</b> · 🚩 오프사이드로 <b style="color:#ff7b72">득점 취소</b></div>
       </div>`
    : `<div class="gpBox">
         <div class="gpTag">GOAL!</div>
         <div class="gpName">${posTag}${name||"득점"}</div>
         <div class="gpMeta"><b>${minute}'</b> · ${team.short}${sub?` <span class="gpSub">${sub}</span>`:""}</div>
       </div>`;
  el.classList.remove("hidden");
  if(goalPanelTimer) clearTimeout(goalPanelTimer);
  goalPanelTimer=setTimeout(hideGoalPanel, cancelled?5200:6200);
}
/* 어두운 배경 위에서 읽히는 구단 색 — 대표색이 너무 어두우면 보조색·기본색으로 대체한다 */
function colorLum(hex){
  const m=/^#?([0-9a-fA-F]{6})$/.exec(String(hex||""));
  if(!m) return null;
  const n=parseInt(m[1],16);
  return (0.2126*((n>>16)&255) + 0.7152*((n>>8)&255) + 0.0722*(n&255))/255;
}
/* 어두운 화면에서 「눈에 띄는가」 — 사람 눈 기준 밝기(luminance)로만 보면 빨강이 지나치게
   낮게 나와, 잘 보이는 구단색까지 대체된다. 가장 밝은 채널로 본다:
   선명한 빨강(#e4002b)은 0.89로 살아남고, 무채색에 가까운 검정(#101010)만 걸린다. */
function colorPunch(hex){
  const m=/^#?([0-9a-fA-F]{6})$/.exec(String(hex||""));
  if(!m) return null;
  const n=parseInt(m[1],16);
  return Math.max((n>>16)&255, (n>>8)&255, n&255)/255;
}
function readableTeamColor(t, fallback){
  const fb=fallback||"#2ea8ff";
  if(!t) return fb;
  const c1=colorPunch(t.col);
  if(c1===null) return fb;
  if(c1>=0.40) return t.col;                 // 충분히 또렷하다 — 구단색 그대로
  const c2=colorPunch(t.col2);
  if(c2!==null && c2>=0.55) return t.col2;   // 보조색이 밝으면 그쪽 (성남 → 흰빛 회색)
  return fb;
}
function hideGoalPanel(){
  if(goalPanelTimer){ clearTimeout(goalPanelTimer); goalPanelTimer=null; }
  const el=document.getElementById("goalPanel");
  if(el){ el.classList.add("hidden"); el.innerHTML=""; }
  /* ⚔️ ⚠ 제보 원문 — 「게스트일때 득점 팝업 표시되는게 너무 길게 표시되거든? 호스트의 것과
     같은 호흡으로 표시되게 해주고」.
     원인 — 호스트는 세리머니가 끝나는 순간 syncGoalPanel 이 패널을 걷는다(타이머는 상한일 뿐).
        게스트에는 「띄워라」만 보냈기 때문에 늘 상한(6.2초)까지 떠 있었다.
     ─ 걷는 순간도 그대로 중계한다. */
  try{
    if(typeof PVP!=="undefined" && PVP && PVP._gpOn && PVP.role==="host"
       && liveM && liveM.opts && liveM.opts.pvp){
      PVP._gpOn=0; pvpSend({t:"gp", hide:1});
    }
  }catch(e){}
}
/* 지금 "화면에 보이고 있는" 상태를 기준으로 패널을 켜고 끈다.
   ⚠ 하이라이트 재생 중에는 시뮬이 멈춰 있고 그 시점의 ball.celebrate 는 이미 켜져 있다.
      그걸 그대로 보면 빌드업이 재생되는 내내 GOAL 패널이 떠 있어 결과를 미리 알려준다.
      그래서 재생 중에는 "지금 재생 중인 프레임"에 새겨 둔 세리머니 정보를 쓴다. */
const GOAL_OFF_REVEAL=2.4;   // 골 → 깃발이 올라가기까지 (취소 연출)
function currentCelebration(s){
  if(liveHL && liveHL.frames && liveHL.frames[liveHL.i]){
    const f=liveHL.frames[liveHL.i];
    if(!f.cg) return null;
    return {side:f.cg.s, scorerId:f.cg.id, t:f.cg.t, disallowed:f.cg.dis, own:f.cg.own,
            clock:(f.cg.clk!=null ? f.cg.clk : f.clock)};
  }
  const cel = s && s.ball && s.ball.celebrate;
  if(!cel) return null;
  return {side:cel.side, scorerId:cel.scorerId, t:cel.t, disallowed:!!cel.disallowed,
          own:!!cel.own, clock:(cel.clk!=null ? cel.clk : s.clock)};
}
function syncGoalPanel(s){
  if(!s || !liveM) return;
  // 골 리플레이는 "이미 아는 장면을 다시 보는 것"이다. 패널까지 또 띄우면 화면만 가린다.
  //   ⚠ 표식(goalPanelShownFor)만 보고 넘기면, 리플레이 직전에 떠 있던 패널이 그대로 남는다.
  //      리플레이 중에는 표식과 무관하게 무조건 걷는다.
  if(liveHL && liveHL.isReplay){ goalPanelShownFor=null; hideGoalPanel(); return; }
  const cel=currentCelebration(s);
  if(!cel){ if(goalPanelShownFor!==null){ goalPanelShownFor=null; hideGoalPanel(); } return; }
  // 취소된 골도 일단 GOAL 로 띄웠다가, 깃발이 올라가는 시점에 취소 표시로 바뀐다
  const phase = (cel.disallowed && cel.t>=GOAL_OFF_REVEAL) ? "off" : "goal";
  const key=cel.side+"|"+cel.scorerId+"|"+phase;
  if(goalPanelShownFor===key) return;
  goalPanelShownFor=key;
  /* 👻 득점 직후 교체·퇴장으로 그라운드를 떠났어도 이름은 남아야 한다(제보 — 이름이 안 떴다) */
  const sc=(s.byIdAny ? s.byIdAny(cel.scorerId) : null) || (s.byId ? s.byId(cel.scorerId) : null);
  const nm=sc&&sc.p?sc.p.name:"득점";
  /* ⏱️ 전광판과 같은 시계를 쓴다.
     ⚠ 제보 — 「골 팝업의 시간과 실제 시간이 안 맞는다」. 두 가지가 겹쳐 있었다.
       ① 팝업만 초를 60으로 나눠 찍어서, 추가시간 골이 전광판 45+1 · 90+3 인데 46' · 93' 로 떴다.
       ② 세리머니가 도는 동안에도 시계는 흐른다 — 그 사이에 분이 넘어가면 한 분 뒤로 밀렸다.
     ─ 공이 들어간 「그 순간」의 시각(cel.clk)을 새겨 두고, 전광판과 같은 함수로 읽는다. */
  const _at=(cel.clock!=null ? cel.clock : s.clock);
  let min="";
  try{ min=s.clockLabel(_at); }catch(e){ min=String(Math.max(1, Math.floor(_at/60))); }
  if(!min || min==="0") min="1";
  /* 도움 — K리그 규정으로 판정된 마지막 패스 주인. 자책골·도움 없음이면 표기 없음 */
  let astTxt="";
  try{
    const gt=s.goalTag;
    if(!cel.own && gt && gt.sid===cel.scorerId && gt.aid){
      const ap=s.byId(gt.aid) || (s.byIdAny?s.byIdAny(gt.aid):null);
      if(ap && ap.p) astTxt=`도움 ${ap.slot?`<b>${ap.slot}</b> `:""}${ap.p.name}`;
    }
  }catch(e){}
  /* 🎽 동명이인 구분 — 등록 포지션과, 오늘 실제로 선 자리를 함께 보여 준다 */
  let _pos=null, _slot=null;
  try{ if(sc&&sc.p){ _pos=sc.p.pos||null; _slot=sc.slot||null; } }catch(e){}
  if(phase==="off") showGoalPanel(cel.side, nm, min, "", true, _pos, _slot);
  else              showGoalPanel(cel.side, nm, min, cel.own?"자책골":astTxt, false, _pos, _slot);
}
let goalPanelShownFor=null;
function drawHighlightFrame(cv, hl){
  const s=liveSim; if(!s) return;
  const f=hl.frames[hl.i], nf=hl.frames[Math.min(hl.i+1, hl.frames.length-1)];
  const k=clamp01(hl.acc/SIM_DT);                  // 프레임 사이를 이어 그려 부드럽게
  /* 🎬 퇴장 선수는 s.agents 에서 빠져 있다 — 그리기용 유령을 잠깐 되살린다.
     ⚠ 이게 없으면 퇴장 장면을 되감아도 정작 그 선수만 화면에서 사라져 있었다(제보). */
  const byId={}; for(const a of s.agents) byId[a.id]=a;
  const ghosts=[];
  if(Array.isArray(s.gone)) for(const gg of s.gone){
    if(byId[gg.id]) continue;
    if(!f.a.some(r=>r.id===gg.id)) continue;      // 이 프레임에 있던 선수만
    byId[gg.id]=gg; ghosts.push(gg); s.agents.push(gg);
  }
  /* 볼 소유자가 이미 그라운드를 떠난 선수라도(PK 키커가 교체·퇴장된 경우) 그 프레임에는 있어야 한다 */
  if(f.oi && !byId[f.oi] && Array.isArray(s.gone)){
    const ow=s.gone.find(x=>x.id===f.oi);
    if(ow){ byId[ow.id]=ow; ghosts.push(ow); s.agents.push(ow); }
  }
  const save=[];
  for(let i=0;i<f.a.length;i++){
    const rec=f.a[i], nx=(nf.a[i]&&nf.a[i].id===rec.id)?nf.a[i]:rec;
    const ag=byId[rec.id]; if(!ag) continue;
    save.push([ag, ag.x, ag.y, ag.face, ag._rx, ag._ry, ag._rf, ag._hlJ]);
    ag._hlJ=(rec.j!==undefined || nx.j!==undefined) ? lerp(rec.j||0, nx.j||0, k) : 0;   // 🦘 점프 (재생)
    // ⚠ 보간은 여기서 이미 끝냈다. drawSimWatch 는 _rx→x 를 자기 나름의 알파로 한 번 더
    //    보간하는데, 그 알파는 관전 화면용이라 여기와 무관하다. 두 번 보간되면 화면이 뚝뚝 끊긴다.
    //    _rx 를 결과값과 같게 맞춰 두 번째 보간을 무력화한다.
    const px=lerp(rec.x, nx.x, k), py=lerp(rec.y, nx.y, k);
    ag.x=px; ag.y=py; ag._rx=px; ag._ry=py;
    ag.face=lerpAngle(rec.face, nx.face, k);
    /* ⚠ drawSimWatch 는 face 를 _rf 와 한 번 더 섞는다(그 알파는 관전 화면용이라 여기와 무관하다).
       _rx 와 같은 이유로 _rf 도 결과값에 맞춰 두 번째 보간을 무력화한다. */
    ag._rf=ag.face;
  }
  s._hlOwner = (f.oi!==undefined) ? (f.oi||null) : undefined;   // 이 프레임의 볼 소유자 (흰 링용)
  /* 🎯 슛 궤적 — 재생 중에는 시뮬이 멈춰 있어 s.ball.state 가 「장면이 끝난 뒤의 상태」다.
     그 프레임에 기록해 둔 값(bs)을 써야 슛이 날아가는 그 순간에만 꼬리가 붙는다 */
  s._hlShot = (f.bs!==undefined) ? (f.bs==="SHOT") : undefined;
  const b=s.ball, bs=[b.x,b.y,b.z,b._rx,b._ry,b._rz];
  const bx=lerp(f.bx, nf.bx, k), by=lerp(f.by, nf.by, k);
  b.x=bx; b.y=by; b._rx=bx; b._ry=by;
  b.z=lerp(f.bz, nf.bz, k); b._rz=b.z;   // 높이도 같은 이유로 못 박는다 (안 그러면 공이 위아래로 튄다)
  // 심판도 그때 그 자리로 되돌린다
  const rf=s.ref, rs = rf ? [rf.x, rf.y, rf._rx, rf._ry] : null;
  if(rf && f.rx!==undefined){
    const rx=lerp(f.rx, nf.rx!==undefined?nf.rx:f.rx, k), ry=lerp(f.ry, nf.ry!==undefined?nf.ry:f.ry, k);
    rf.x=rx; rf.y=ry; rf._rx=rx; rf._ry=ry;
  }
  try{
  drawSimWatch(cv, s);
  /* 🟥🟨 카드 연출 — 주심이 들어 올린 카드와 「누구인지」를 그 자리에 그린다 */
  if(f.cd && cv.getContext) drawCardFx(cv, s, f.cd, byId);
  // 리플레이 배지 — 지금 보고 있는 게 다시보기라는 걸 분명히 한다
  if(hl.isReplay && cv.getContext){
    const c2=cv.getContext("2d");
    c2.fillStyle="rgba(8,12,17,0.78)";
    roundRectPath(c2, 12, 12, 96, 24, 5); c2.fill();
    c2.strokeStyle="#e3b341"; c2.lineWidth=1.5; c2.stroke();
    c2.fillStyle="#e3b341"; c2.font="bold 12px system-ui,sans-serif";
    c2.textAlign="left"; c2.textBaseline="middle";
    c2.fillText("🎬 다시보기", 22, 25);
  }
  }finally{
  /* ⚠ 제보(투명 키커) — 되감기용 유령을 s.agents 에 잠깐 끼워 두고 그리는데, 그리기 도중
     예외가 한 번이라도 나면 그 유령이 영영 남아 경기 로직(전담 키커 선정 등)에 끼어들었다.
     그렇게 뽑힌 키커는 엔트리상 이미 나간 선수라 화면에 그려지지 않는다 = 「투명 선수」.
     무슨 일이 있어도 걷어내도록 finally 로 묶는다. */
  // 원래 좌표로 되돌린다 — 재생이 끝나면 경기가 그 자리에서 이어져야 한다
  s._hlOwner=undefined; s._hlShot=undefined;
  if(ghosts.length) s.agents=s.agents.filter(a=>ghosts.indexOf(a)<0);   // 유령은 다시 걷어낸다
  for(const [ag,x,y,fc,rx,ry,rf,hj] of save){ ag.x=x; ag.y=y; ag.face=fc; ag._rx=rx; ag._ry=ry; ag._rf=rf; ag._hlJ=hj; }
  b.x=bs[0]; b.y=bs[1]; b.z=bs[2]; b._rx=bs[3]; b._ry=bs[4]; b._rz=bs[5];
  if(rs){ s.ref.x=rs[0]; s.ref.y=rs[1]; s.ref._rx=rs[2]; s.ref._ry=rs[3]; }
  }
}
/* ═══ 🟥 카드 연출 ══════════════════════════════════════════════════
   주심이 카드를 들어 올린다 — 카드가 살짝 솟았다가 멈추고, 그 아래에
   「팀 · 자리 · 이름」이 붙는다. 퇴장은 붉게, 경고는 노랗게. */
function drawCardFx(cv, s, cd, byId){
  const ctx=cv.getContext("2d"); if(!ctx) return;
  const K=cvK(cv);
  const red=(cd.k==="R");
  const T=cd.t||0;
  const rise=clamp(T/0.45, 0, 1);                       // 들어 올리는 동작
  const fade=clamp((CARD_FX_SEC-T)/0.8, 0, 1);          // 끝에서 서서히 사라진다
  const a=byId[cd.id];
  /* 카드는 반칙한 선수 머리 위에 — 선수를 못 찾으면 주심 위에 */
  const tgt = a || s.ref || {x:0.5,y:0.5};
  const px=(tgt.x!=null?tgt.x:0.5), py=(tgt.y!=null?tgt.y:0.5);
  /* 🟨 ⚠ 제보 — 「경고 표시가 선수 바둑알 위치에서 크게 어긋난다」.
     원인: 여기만 경기장 좌표(0~1)를 캔버스 크기에 그대로 곱하고 있었다. 다른 그림은 전부
        pitchToCanvasXY 를 쓴다 — 골대 뒤·터치라인 밖 여백(PITCH_PAD)과 화면 비율을 반영한
        좌표계다. 그래서 카드만 여백만큼 통째로 밀려 그려졌고, 골대 뒤 공간을 넓힌 뒤로
        어긋남이 눈에 띄게 커졌다. */
  const _cp=pitchToCanvasXY(cv, px, py);
  const X=_cp.x, Y=_cp.y;
  ctx.save();
  ctx.globalAlpha=fade;
  /* 카드 — 세로로 긴 직사각형, 살짝 기울여 든 모양 */
  const cw=13*K, ch=19*K;
  const cx=X+16*K, cy=Y-26*K - rise*8*K;
  ctx.translate(cx, cy);
  ctx.rotate(-0.16);
  ctx.fillStyle = red ? "#e5484d" : "#f0c000";
  ctx.strokeStyle="rgba(0,0,0,0.55)"; ctx.lineWidth=1.4*K;
  roundRectPath(ctx, -cw/2, -ch/2, cw, ch, 2.5*K);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  /* 이름표 — 팀 · 자리 · 이름 (제보: 어느 팀 어느 포지션의 누구인지 알아야 상황이 읽힌다) */
  const label=`${red?"🟥":"🟨"} ${cd.tm||""} ${cd.ps?cd.ps+" ":""}${cd.nm||""}`;
  ctx.save();
  ctx.globalAlpha=fade;
  ctx.font=`bold ${Math.round(12*K)}px system-ui,sans-serif`;
  ctx.textAlign="center"; ctx.textBaseline="middle";
  const w=ctx.measureText(label).width+14*K, h=20*K;
  let bx=clamp(X, w/2+4, cv.width-w/2-4), by=Y-46*K-rise*8*K;
  if(by<h) by=Y+40*K;
  ctx.fillStyle="rgba(8,12,17,0.86)";
  roundRectPath(ctx, bx-w/2, by-h/2, w, h, 5*K); ctx.fill();
  ctx.strokeStyle= red ? "#e5484d" : "#f0c000"; ctx.lineWidth=1.6*K; ctx.stroke();
  ctx.fillStyle="#e6edf3";
  ctx.fillText(label, bx, by);
  ctx.restore();
}
/* 연속 매치엔진 화면 그리기.
   관전 화면(simWatch)과 실제 경기(liveSim)가 같은 그림을 쓰므로, 어떤 시뮬을 그릴지 인자로 받는다. */
function drawSimWatch(cv, simOverride){
  if(!cv.getContext) return;
  const ctx=cv.getContext("2d");
  drawPitchBase(ctx, cv);
  const s=simOverride || simWatch; if(!s) return;
  const hCol=s.M.home.col||"#2ea8ff", aCol=awayDiscCol(hCol, s.M.away.col||"#f85149");
  /* 🧤 골키퍼 킷 — 양 팀 필드 킷·서로와 겹치지 않는 색을 경기마다 고른다 */
  if(!s._gkKit) s._gkKit=gkKitsFor(hCol, aCol, s.M.home.id, s.M.away.id);
  const gkH=s._gkKit.h, gkA=s._gkKit.a;
  const AL=simAlpha();
  // 킥오프처럼 좌표가 통째로 바뀌는 순간까지 이어 그리면 피치를 가로질러 미끄러진다 — 그때만 보간을 끈다
  // 실제 비행은 최대 11m/틱(0.164)까지 나온다. 임계값이 그보다 낮으면
  // 빠른 패스마다 보간이 꺼져 화면이 뚝뚝 끊긴다. 순간이동(킥오프 30~50m)만 걸러낸다.
  const JUMP=0.26;
  const far=(o)=> o._rx!==undefined && HYP((o.x-o._rx)*PITCH_AR, o.y-o._ry) > JUMP;
  const IX=(o)=> (o._rx===undefined||far(o)) ? o.x : lerp(o._rx, o.x, AL);
  const IY=(o)=> (o._ry===undefined||far(o)) ? o.y : lerp(o._ry, o.y, AL);
  const K2=cvK(cv);
  _trailTick++;                          // 💨 잔상 샘플링 주기
  for(const a of s.agents){
    const isGK=a.slot==="GK";
    /* 흰 링(볼 소유) — 재생 중에는 "그 프레임의" 소유자를 따라간다. 안 그러면 리플레이에서
       드리블하는 선수를 놔두고, 장면이 끝난 시점의 소유자(예: 공 잡은 키퍼)에게 링이 붙는다. */
    const owner = (s._hlOwner!==undefined) ? (s._hlOwner===a.id) : (s.ball.ownerId===a.id);
    let ax=IX(a), ay=IY(a);
    /* 🤜 몸싸움 떨림 — 부딪힌 직후 짧게 (요청) */
    { const _jt=(a._hlJit!==undefined && a._hlJit!==null) ? a._hlJit : jitterOf(a, s.t);
      if(_jt){ ax=clamp01(ax+_jt.dx); ay=clamp01(ay+_jt.dy); } }
    const af=lerpAngle(a._rf, a.face, AL);
    const R0=isGK?6.2:5.6;   // FM 비율 — 바둑알 지름 ≈2m (11/9.5px는 3.5~4m 상당이었다)
    /* 🦘 점프 — 재생 중에는 프레임에 적어 둔 값(_hlJ), 관전 중에는 지금 시각으로 계산 (요청) */
    const _jz = (a._hlJ!==undefined && a._hlJ!==null) ? a._hlJ : jumpZOf(a, s.t);
    const _jl = _jz>0.02 ? _jz*JUMP_LIFT*K2 : 0;      // 화면에서 위로 띄우는 픽셀
    const _R0 = R0*(1+ (_jz>0.02?_jz*JUMP_GROW:0));
    const _P  = (px0,py0)=>{ const c=pitchToCanvasXY(cv, px0, py0); return {x:c.x, y:c.y-_jl}; };
    /* 💨 빠르게 달리면 지나온 자리에 잔상이 남는다 (요청) — 바둑알보다 먼저 그려 뒤에 깔린다 */
    { const _dc=isGK?(a.side==="h"?gkH:gkA):(a.side==="h"?hCol:aCol);
      const _tk=trailK(a);
      trailPush(a, ax, ay, _tk);
      drawTrail(ctx, cv, a, _dc, R0);
      a._tpx=a.x; a._tpy=a.y; }
    drawDotXY(ctx, cv, ax, ay, isGK?(a.side==="h"?gkH:gkA):(a.side==="h"?hCol:aCol), R0, _jz);
    if(a.face!==undefined){            // 바라보는 방향 — 바둑알 앞에 붙는 작은 삼각형
      const c0=_P(ax, ay);
      const ux=Math.cos(af), uy=Math.sin(af), px=-uy, py=ux;
      const tipD=(_R0+5.5)*K2, baseD=(_R0+1.0)*K2, halfW=3.0*K2;   // (바둑알 축소·해상도 배율 반영)
      ctx.beginPath();
      ctx.moveTo(c0.x+ux*tipD, c0.y+uy*tipD);                       // 뾰족한 끝
      ctx.lineTo(c0.x+ux*baseD+px*halfW, c0.y+uy*baseD+py*halfW);   // 밑변 한쪽
      ctx.lineTo(c0.x+ux*baseD-px*halfW, c0.y+uy*baseD-py*halfW);   // 밑변 반대쪽
      ctx.closePath();
      ctx.fillStyle="rgba(255,255,255,0.92)"; ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,0.35)"; ctx.lineWidth=1; ctx.stroke();
    }
    // 등번호 — 바둑알 안에 새긴다. 팀 색이 밝으면 검은 글씨로 뒤집어 가독성을 지킨다.
    {
      const pt=_P(ax, ay);
      const col=isGK?(a.side==="h"?gkH:gkA):(a.side==="h"?hCol:aCol);
      ctx.font="bold "+(7.5*K2*(1+(_jz>0.02?_jz*JUMP_GROW:0))).toFixed(1)+"px system-ui,sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle = isLightColor(col) ? "#0d1117" : "#f2f6fa";
      ctx.fillText(String(a.p&&a.p.no||""), pt.x, pt.y+0.5);
    }
    if(owner){ // 볼 소유자 표시
      const pt=_P(ax, ay);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, (_R0+4)*K2, 0, Math.PI*2);
      ctx.strokeStyle="#fff"; ctx.lineWidth=2*K2; ctx.stroke();
    }
    // 클릭으로 고른 선수 — 이름표를 달아 준다 (FM에서 선수를 찍으면 이름이 뜨는 그것)
    if(simPick===a.id){
      const pt=_P(ax, ay);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, (_R0+6)*K2, 0, Math.PI*2);
      ctx.strokeStyle="#e3b341"; ctx.lineWidth=2*K2; ctx.stroke();
      const nm=(a.p&&a.p.name)||"";
      const label=(a.p&&a.p.no?a.p.no+" ":"")+nm;
      ctx.font="bold 11px system-ui,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="alphabetic";
      const mt=ctx.measureText&&ctx.measureText(label);
      const w=((mt&&mt.width)||label.length*8)+10;
      const ly=pt.y-_R0-8;
      ctx.fillStyle="rgba(8,12,17,0.88)";
      roundRectPath(ctx, pt.x-w/2, ly-13, w, 16, 4); ctx.fill();
      ctx.strokeStyle="#e3b34188"; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle="#f2f6fa"; ctx.fillText(label, pt.x, ly-1);
    }
  }
  // 주심 — 검은 점. 반칙 장면에서는 카드를 든다.
  if(s.ref){
    const rx=IX(s.ref), ry=IY(s.ref);
    drawDotXY(ctx, cv, rx, ry, "#1b1b1b", 6);
    const fs=s.ball.foulScene;
    if(fs && fs.card && fs.card!=="VERBAL"){
      const pt=pitchToCanvasXY(cv, rx, ry);
      ctx.fillStyle = fs.card==="RED" ? "#f85149" : "#e3b341";
      ctx.fillRect(pt.x+6, pt.y-16, 7, 10);
      ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.strokeRect(pt.x+6, pt.y-16, 7, 10);
    }
  }
  /* 🟨🔵 판정 표시 — 반칙한 선수의 바둑알 위에 띄운다 (요청).
     카드가 나오면 카드를, 카드 없는 반칙(주의·구두경고 포함)이면 휘슬을 그린다.
     ⚠ 주심 옆에만 카드를 그리면 「누가 반칙했는지」가 화면에서 안 읽힌다. */
  {
    const fs=s.ball.foulScene;
    if(fs && fs.foulerId){
      let fa=null;
      for(const q of s.agents) if(q.id===fs.foulerId){ fa=q; break; }
      if(fa){
        const pt=pitchToCanvasXY(cv, IX(fa), IY(fa));
        const top=pt.y-(5.6+14)*K2;
        const hasCard = fs.card && fs.card!=="VERBAL";
        if(hasCard){
          const w=8*K2, h=11.5*K2;
          ctx.fillStyle = fs.card==="RED" ? "#f85149" : "#e3b341";
          ctx.fillRect(pt.x-w/2, top, w, h);
          ctx.strokeStyle="rgba(0,0,0,.75)"; ctx.lineWidth=1*K2;
          ctx.strokeRect(pt.x-w/2, top, w, h);
        } else {
          drawWhistle2D(ctx, pt.x-2.6*K2, top+5.6*K2, 1.05*K2);   /* 카드와 같은 자리에 가운데 맞춤 */
        }
      }
    }
  }
  const bz = s.ball._rz===undefined ? (s.ball.z||0) : lerp(s.ball._rz, s.ball.z||0, AL);
  /* 🎾 빠른 공은 잔상을 남긴다 — ⚠ 제보 원문 — 「공이 패스나 슈팅으로 이동되어지다가 확
     빨라져서 스킵되는거같이 보이는 현상」.
     ─ 공은 지름 6~12px 짜리 점인데, 강한 패스(26m/s)는 한 화면 프레임에 그보다 멀리 간다.
       제 몸집보다 멀리 뛰는 점은 이어져 보이지 않는다 — 스트로보처럼 툭툭 끊겨 보인다.
       실제 중계 화면이 그렇듯 지나온 자리를 옅게 이어 그려 하나의 궤적으로 읽히게 한다.
       공이 느리면 잔상 길이가 0에 수렴하므로 평소 화면은 그대로다. */
  /* 🎞️ 빨리 감기 중의 공 — 한 화면 프레임에 시뮬 수십 틱이 굴러 공이 순간이동한다(제보).
     JUMP 임계값(0.26)을 넘으면 보간이 아예 꺼져 스트로보처럼 튄다.
     ─ 화면에 남아 있는 자리(_ffx)에서 지금 자리로 매 프레임 조금씩 끌어당긴다.
       0.3 이면 10프레임(≈0.16초)에 따라붙으므로, 「휙 훑고 지나간다」로 읽힌다. */
  let _bx, _by;
  if(liveFF && !simOverride){
    const b0=s.ball, FFA=0.30;
    if(b0._ffx===undefined || HYP((b0.x-b0._ffx)*PITCH_AR, b0.y-b0._ffy) > 0.90){ b0._ffx=b0.x; b0._ffy=b0.y; }
    b0._ffx += (b0.x-b0._ffx)*FFA; b0._ffy += (b0.y-b0._ffy)*FFA;
    _bx=b0._ffx; _by=b0._ffy;
  } else {
    if(s.ball._ffx!==undefined){ s.ball._ffx=undefined; s.ball._ffy=undefined; }
    _bx=IX(s.ball); _by=IY(s.ball);
  }
  (function(){
    try{
      const b=s.ball, tr=(b._tr=b._tr||[]);
      /* 🎯 ⚠ 요청 — 「슈팅할 때 이펙트로 공 진행 방향 뒤로 트레일 나오게. 슈팅인 게 바로 눈에 띄게」.
         평소 잔상은 다섯 점짜리 옅은 점선이라 「빠른 공」과 「슛」이 구분되지 않았다.
         슛일 때만 꼬리를 길게(14칸) 잡고, 점이 아니라 <b>공 지름에서 0 으로 좁아지는 유선형 띠</b>로
         그린다. 재생 중에는 프레임에 적어 둔 상태(_hlShot)를 본다 — 시뮬은 멈춰 있기 때문. */
      const isShot = (s._hlShot!==undefined) ? s._hlShot : (b.state==="SHOT");
      const MAXT = isShot ? 14 : 5;
      const lastP=tr.length?tr[tr.length-1]:null;
      /* 장면 전환·세트피스 배치처럼 통째로 튀면 잔상을 끊는다 (선을 그으면 안 되는 순간) */
      if(lastP && HYP((_bx-lastP.x)*PITCH_AR, _by-lastP.y) > 0.10) tr.length=0;
      /* 슛이 시작되는 순간에는 이전 잔상을 버린다 — 드리블 흔적이 슛 꼬리에 이어 붙으면 안 된다 */
      if(isShot && !b._trShot) tr.length=0;
      b._trShot=isShot;
      tr.push({x:_bx, y:_by, z:bz});
      while(tr.length>MAXT) tr.shift();
      if(tr.length<3) return;
      const p0=pitchToCanvasXY(cv, tr[0].x, tr[0].y), p1=pitchToCanvasXY(cv, _bx, _by);
      if(HYP(p1.x-p0.x, p1.y-p0.y) < (isShot?4:6)) return;      // 느린 공 — 잔상 없음
      const K3=cvK(cv);
      const _lf=(q)=>Math.min(24, ((q.z||0)*ISO_TO_M)*3.0)*K3;
      if(isShot){
        /* 유선형 띠 — 꼬리 끝은 뾰족하고 공 쪽은 지름만큼 굵다. 위아래 가장자리를 따로 이어
           하나의 닫힌 도형으로 그리면 canvas 에서 폭이 변하는 선을 만들 수 있다. */
        const pts=tr.map(q=>{ const c=pitchToCanvasXY(cv,q.x,q.y); return {x:c.x, y:c.y-_lf(q)}; });
        const n=pts.length;
        const rEnd=(3.0+3.45)*K3*0.92;                 // 공 반지름과 맞춘 두께
        const nrm=(i)=>{ const a2=pts[Math.max(0,i-1)], b2=pts[Math.min(n-1,i+1)];
                         const dx=b2.x-a2.x, dy=b2.y-a2.y, L=HYP(dx,dy)||1;
                         return {x:-dy/L, y:dx/L}; };
        const up=[], dn=[];
        for(let i=0;i<n;i++){
          const w=rEnd*Math.pow(i/(n-1||1), 1.35), v=nrm(i);
          up.push({x:pts[i].x+v.x*w, y:pts[i].y+v.y*w});
          dn.push({x:pts[i].x-v.x*w, y:pts[i].y-v.y*w});
        }
        let grad=null;
        try{
          grad=ctx.createLinearGradient(pts[0].x, pts[0].y, pts[n-1].x, pts[n-1].y);
          grad.addColorStop(0,   "rgba(255,255,255,0)");
          grad.addColorStop(0.45,"rgba(255,236,190,0.30)");
          grad.addColorStop(1,   "rgba(255,255,255,0.72)");
        }catch(e2){ grad=null; }
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(up[0].x, up[0].y);
        for(let i=1;i<n;i++) ctx.lineTo(up[i].x, up[i].y);
        for(let i=n-1;i>=0;i--) ctx.lineTo(dn[i].x, dn[i].y);
        ctx.closePath();
        ctx.fillStyle=grad||"rgba(255,246,214,0.55)";
        try{ ctx.shadowColor="rgba(255,214,120,0.55)"; ctx.shadowBlur=7*K3; }catch(e2){}
        ctx.fill();
        ctx.restore();
      } else {
        for(let i=0;i<tr.length-1;i++){
          const q=tr[i], a=(i+1)/tr.length;
          const pt=pitchToCanvasXY(cv, q.x, q.y);
          ctx.globalAlpha=a*a*0.34;
          ctx.beginPath(); ctx.arc(pt.x, pt.y-_lf(q), (1.6+a*1.9)*K3, 0, Math.PI*2);
          ctx.fillStyle="#ffffff"; ctx.fill();
        }
      }
      ctx.globalAlpha=1;
    }catch(e){ try{ ctx.globalAlpha=1; }catch(_){} }
  })();
  drawBallZ(ctx, cv, _bx, _by, bz);
  /* 🌧️ 날씨 연출 — 비는 사선으로 긋고, 눈은 천천히 흩날린다 (요청).
     경기 판정과 무관한 순수 그림이라 실패해도 조용히 넘어간다. */
  try{ drawWeatherFx(ctx, cv, (s.M&&s.M.wx)||null); }catch(e){}
  try{ if(G.opt && G.opt.ftDebug) drawReceiveDebug(ctx, cv, s, IX, IY); }catch(e){}
  const el=document.getElementById("simInfo");
  // 매 프레임 통계를 다시 집계하고 HTML 을 새로 쓰면 60fps 가 버겁다. 5Hz 로 충분하다.
  const nowT=(typeof nowMs==="function")?nowMs():0;
  if(el && (simInfoAt===0 || nowT-simInfoAt>200)){
    simInfoAt=nowT;
    const r=s.report();
    const done=s.clock>=s.endSec;
    const _wxs=(s.M&&s.M.wx)?`<span title="오늘의 날씨 — 공·발·체력에 영향을 줍니다">${wxLabel(s.M.wx)}</span> · `:"";
    el.innerHTML=`<b>${Math.floor(s.clock/60)}'</b>${done?" <span class='small'>(종료)</span>":""} · `+_wxs
      +`점유 <b>${s.M.home.short}</b> ${r.h.possPct}% / <b>${s.M.away.short}</b> ${r.a.possPct}% · `
      +`패스 ${r.totalPass} (성공률 ${r.h.acc}% / ${r.a.acc}%) · `
      +`볼 위치 수비 ${r.thirds.def}% · 중원 ${r.thirds.mid}% · 공격 ${r.thirds.att}%`
      +` · <span class="small"${s.matchState==="PENALTY"?' style="color:#e3b341;font-weight:700"':''}>`
      +`${s.matchState==="PENALTY"?"🅿️ ":""}${MATCH_STATE_KO[s.matchState]||s.matchState}</span>`
      +(s.sentOff.length?` · <span style="color:#f85149">퇴장 ${s.sentOff.length}</span>`:"")
      +(function(){
        const e=s.lastEvent; if(!e || s.t-e.t>8) return "";
        if(e.kind==="FOUL"){
          const C={RED:"🟥 레드카드 — 퇴장!", YELLOW:"🟨 옐로카드", VERBAL:"구두 경고", NONE:""};
          return C[e.card] ? ` · <b style="color:#e3b341">반칙 — ${C[e.card]}</b>` : "";
        }
        const NM={GOAL:"⚽ 골!", POST:"골포스트 강타!", CROSSBAR:"크로스바 강타!", MISS:"빗나감",
                  CATCH:"키퍼 캐치", PARRY:"키퍼가 쳐냄", PUNCH:"키퍼 펀칭", TIP:"키퍼가 골대 옆으로", BLOCK:"수비 블록"};
        const TY={HEADER:"헤더", VOLLEY:"발리", FINESSE:"감아차기", CHIP:"로빙슛", POWER:"중거리", PLACED:"정교한 슛"};
        const nm=NM[e.kind]; if(!nm) return "";
        return ` · <b style="color:#e3b341">${e.type?TY[e.type]+" — ":""}${nm}</b>`;
      })();
    el.innerHTML+="";
  }
}

