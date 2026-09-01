"use strict";
/* ── 패스 시스템 ────────────────────────────────────────────────────────────
   숏패스 : 가까운 동료 발밑으로 낮고 빠르게 굴린다. 높이 변화 없이 마찰만 받는다.
   롱패스 : 멀거나 사이에 사람이 많으면 띄워 보낸다. z축 포물선을 그린다.
   스루패스: 달리는 동료의 "현재 위치"가 아니라 공과 만날 "미래 위치"를 계산해 찔러 넣는다.  */
const PASS_TYPE={SHORT:"SHORT", LONG:"LONG", THROUGH:"THROUGH", LEAD:"LEAD", SWITCH:"SWITCH", BACK:"BACK"};
/* ═══════════════════════════════════════════════════════════════
   🎯 패스 난이도 · 오차 — "정확도 확률" 하나로 성패를 가르지 않는다
   난이도(거리·각도·몸 방향·압박·원터치·수신자 이동)와 실력을 견주어
   "얼마나 빗나갔는가"를 종/횡으로 나눠 물리적으로 만든다.
     세로 오차 = 언더히트 / 오버히트 (짧거나 길거나)
     가로 오차 = 좌우로 빗나감
   ⚠ 모든 값은 여기서 튜닝한다.
═══════════════════════════════════════════════════════════════ */
/* 📏 20260913-2700 계측(n=4, 패스 2867회) — 실행 오차가 사실상 없었다:
      조준 오차 평균 <b>가로 0.46m · 세로 1.6%</b> · 등급 PERFECT 66% · MISDIRECTED 2.4%
      그 결과 패스 실패 227회 중 차단 154 + 굴절 68 = <b>222회</b> — 실패가 전부 인터셉트다.
   실축은 반대다. 패스 실패의 대부분은 「잘못 찬 공」이 흐르거나 라인을 넘는 것이고,
   인터셉트(Opta)는 패스의 2~3% 에 지나지 않는다. 그래서 실축에서는 소유를 잃어도
   대개 <b>루즈볼</b>이 되지, 상대에게 깨끗이 넘어가지 않는다 — 이게 우리 엔진에서
   전환(트랜지션)이 과하게 잦은 구조적 이유다.
   ─ 오차를 실축 수준(짧은 패스 가로 1.2~1.5m)으로 키우고, 대신 인터셉트를 줄인다. */
const PE={
  LAT: 0.340,    // 가로 오차 기준(iso ≈ 9m) — 실력·난이도로 곱해진다 (0.135 → 계측 기반)
  LON: 0.520,    // 세로 오차 기준(비율) — 세기 조절 실패 (0.32 →)
  BODY: 0.55,    // 몸 방향이 어긋날 때의 난이도 가중
  PRESS_R: 0.075,
  ONE_TOUCH: 0.42
};
/* ═══════════════════════════════════════════════════════════════
   🌌 공간 평가 — "선수에게 보내는 패스"와 "공간에 보내는 패스"를 가른다
     spaceQuality : 그 지점이 얼마나 좋은 공간인가 (상대 밀집·전진성·라인 뒤)
     corridorRisk : 패스 경로에 수비수가 걸쳐 있는가
     passAngleFit : 수신자 진행 방향과 패스 방향이 얼마나 맞는가
   ⚠ 세 값 모두 0~1 로 정규화한다.
═══════════════════════════════════════════════════════════════ */
function spaceQuality(pt, opps, dir, receiver){
  let crowd=0, nearest=9;
  for(const o of (opps||[])){
    if(o.slot==="GK") continue;
    const d=HYP((o.x-pt.x)*PITCH_AR, o.y-pt.y);
    if(d<nearest) nearest=d;
    if(d<0.14) crowd += (1-d/0.14);            // 반경 9m 안의 밀집도
  }
  let s=clamp(nearest/0.13, 0, 1)*0.55;         // 가까운 상대가 멀수록 좋다
  s += clamp(1-crowd/2.2, 0, 1)*0.25;           // 여럿이 몰려 있으면 나쁘다
  /* 전진성 — 상대 골문에 가까울수록 가치가 크다 */
  const adv = dir>0 ? pt.x : 1-pt.x;
  s += clamp((adv-0.45)/0.45, 0, 1)*0.20;
  /* 수비 라인 뒤인가 — 뒤에서 두 번째 수비수보다 앞이면 가산 */
  /* ⚡ 오프사이드 라인은 「이 상대 배열·이 좌표 세대」에 하나뿐인데, 예전에는 호출마다
     filter + map + sort 를 새로 돌렸다. 역할 후보 평가에서 틱당 30번 가까이 불려
     이 한 줄이 전체의 1% 를 먹었다(실측). 배열에 세대 도장을 찍어 한 번만 구한다. */
  const _op=opps;
  if(_op && _op.length){
    let line;
    if(_op._olG===SQ_GEN && _op._olD===dir) line=_op._olV;
    else{
      if(_op._olG===undefined){
        try{
          Object.defineProperty(_op,"_olG",{value:-1,writable:true,configurable:true,enumerable:false});
          Object.defineProperty(_op,"_olD",{value:0,writable:true,configurable:true,enumerable:false});
          Object.defineProperty(_op,"_olV",{value:0,writable:true,configurable:true,enumerable:false});
        }catch(e){}
      }
      try{
        const _df=[]; for(const o of _op) if(o.slot!=="GK") _df.push(o);
        line=offsideLineX(_df, dir);
      }catch(e){ line=undefined; }
      try{ _op._olG=SQ_GEN; _op._olD=dir; _op._olV=line; }catch(e){}
    }
    if(line!==undefined){
      const behind = dir>0 ? (pt.x>line) : (pt.x<line);
      if(behind) s=clamp(s+0.18, 0, 1);
    }
  }
  return clamp(s, 0, 1);
}
/* 패스 경로(코리도)에 걸친 수비수 — 0=완전히 열림, 1=완전히 막힘 */
function corridorRisk(from, to, opps){
  const dx=(to.x-from.x)*PITCH_AR, dy=to.y-from.y;
  const L=HYP(dx,dy); if(L<1e-6) return 0;
  const ux=dx/L, uy=dy/L;
  let risk=0;
  for(const o of (opps||[])){
    if(o.slot==="GK") continue;
    const rx=(o.x-from.x)*PITCH_AR, ry=o.y-from.y;
    const t=rx*ux+ry*uy;                        // 경로 위 투영 거리
    if(t<0.01 || t>L) continue;                 // 뒤나 목표 너머는 무관
    const perp=Math.abs(rx*uy - ry*ux);         // 경로에서 떨어진 거리
    if(perp>0.055) continue;                    // 3.7m 밖이면 못 건드린다
    /* 경로 중간쯤에서 가로막을수록, 가까울수록 위험하다 */
    const mid=1-Math.abs(t/L-0.5)*1.2;
    risk += (1-perp/0.055)*clamp(mid,0.2,1)*(0.55+(o.posSkill||0.6)*0.45);
  }
  return clamp(risk, 0, 1);
}
/* 수신자 진행 방향과 패스 방향의 궁합 — 1이면 결을 살린 패스 */
function passAngleFit(to, target){
  const vx=vSx(to)*PITCH_AR, vy=vSy(to);      // 방향 — 평활값
  const sp=HYP(vx,vy);
  if(sp<1e-6) return 0.6;                       // 멈춰 있으면 방향 개념이 약하다
  const tx=(target.x-to.x)*PITCH_AR, ty=target.y-to.y;
  const tl=HYP(tx,ty); if(tl<1e-6) return 0.6;
  return clamp(((vx/sp)*(tx/tl)+(vy/sp)*(ty/tl))*0.5+0.5, 0, 1);
}
/* 패스 난이도 (0=아주 쉬움 ~ 1.5=매우 어려움) */
function passDifficulty(a, opt, ctx){
  const distM=opt.dist*ISO_TO_M;
  let d = clamp(distM/38, 0, 1)*0.52;                       // 거리
  /* 몸 방향 — 정면으로 차는 패스가 가장 쉽다 */
  if(a.face!==undefined){
    const pa=Math.atan2(opt.to.y-a.y, (opt.to.x-a.x)*PITCH_AR);
    let df=pa-a.face; while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
    d += clamp(Math.abs(df)/Math.PI, 0, 1)*PE.BODY;
  }
  /* 압박 */
  let nd=9;
  for(const o of (ctx.opps||[])){ if(o.slot==="GK") continue;
    const dd=HYP((o.x-a.x)*PITCH_AR, o.y-a.y); if(dd<nd) nd=dd; }
  if(nd<PE.PRESS_R) d += (1-nd/PE.PRESS_R)*0.34;
  /* 원터치 — 받자마자 차면 어렵다 */
  if(ctx.oneTouch) d += PE.ONE_TOUCH;
  /* 달리는 수신자에게 맞추는 건 더 어렵다 */
  const rs=HYP(vSx(opt.to)*PITCH_AR, vSy(opt.to))/(SPD.SPRINT*SIM_DT);   // 「달리는 중인가」 — 평활값
  d += clamp(rs, 0, 1)*0.18;
  /* 자신이 달리면서 차는 것도 */
  const ps=HYP((a.vx||0)*PITCH_AR,(a.vy||0))/(SPD.SPRINT*SIM_DT);
  d += clamp(ps, 0, 1)*0.14;
  return clamp(d, 0, 1.5);
}
/* 패스 실행 실력 — 어려울수록 기술·침착성의 비중이 커진다.
   ⚠ 시야(vis)는 "어디로 찰지 고르는" 능력이라 여기 넣지 않는다. */
function passExecSkill(a, diff){
  const A=(a.p&&a.p.attr)||{};
  const g=(k)=>clamp(attr20(A[k]!=null?A[k]:60)/20, 0.15, 1);
  const pas=g("pas"), tec=g("tec"), cmp=g("cmp");
  const w=clamp(diff/1.3, 0, 1);
  const base=pas*(0.74-w*0.24) + tec*(0.14+w*0.16) + cmp*(0.12+w*0.08);
  /* 지치면 발끝이 무뎌진다 — 어려운 패스일수록 더 크게 흔들린다 */
  return clamp(base*stamK(a, 0.78-w*0.10), 0.1, 1);
}
/* 패스 결과 등급 — 오차 크기로 나눈다 */
function passGrade(latM, lonR){
  const a=Math.abs(latM), b=Math.abs(lonR);
  if(a<0.45 && b<0.05) return "PERFECT";
  if(a<1.1 && b<0.11) return "GOOD";
  if(b<-0.15) return "UNDERHIT";
  if(b>0.15)  return "OVERHIT";
  if(a<2.4) return "SLIGHTLY_OFF";
  return "MISDIRECTED";
}
const PASS_LONG_M=26;         // 이 거리를 넘으면 땅볼로 붙이기 어려워 띄운다
const PASS_VMAX=0.46;         // 사람이 낼 수 있는 최대 킥 속도 (iso/s ≈ 31m/s)
const PASS_OVER=1.25;         // 목표를 살짝 지나 죽도록 하는 여유분

/* 달리는 동료와 공이 만나는 미래 지점.
   공은 마찰로 감속하므로 "t초 뒤 공이 가 있을 거리"가 비선형이다.
   그래서 도달 시간 t를 몇 번 되풀이해 수렴시킨다(요격 문제). */
function interceptPoint(from, to, ballSpeed){
  const vx=vSx(to)/SIM_DT, vy=vSy(to)/SIM_DT;          // 동료의 초당 속도 — 방향이라 평활값
  let t=0.5;
  for(let i=0;i<6;i++){
    const px=to.x+vx*t, py=to.y+vy*t;
    const d=HYP((px-from.x)*PITCH_AR, py-from.y);
    const nt=d/Math.max(0.06, ballSpeed);
    if(Math.abs(nt-t)<0.02){ t=nt; break; }
    t=0.5*t+0.5*nt;                                    // 진동하지 않게 절반씩 수렴
  }
  t=clamp(t, 0, 2.2);
  return {x:clamp01(to.x+vx*t), y:clamp01(to.y+vy*t), t};
}

/* ── 스루패스(공간 패스) 판정 ─────────────────────────────────────────
   실제 스루패스가 성립하려면 세 가지가 동시에 맞아야 한다.
     (1) 리시버 앞에 "달려갈 뒷공간"이 실제로 있어야 한다 — 라인이 높아야 생긴다
     (2) 패스 순간 리시버가 온사이드여야 한다 (오프사이드는 패스 시점 기준)
     (3) 그 공간에 상대가 몰려 있으면 찔러봐야 끊긴다
   벡터 연산만 쓴다 — 방향 단위벡터, 거리, 내적. */
const THRU_SPACE_MIN=0.055;   // 뒷공간이 최소 이만큼(약 3.7m)은 있어야 찌를 값어치가 있다
const THRU_LOOK=0.20;         // 타깃 공간 주변 이 반경(약 13m) 안의 상대를 센다
const THRU_CROWD_MAX=2;       // 이보다 많으면 스루패스를 접고 일반 패스로 돌린다
function throughSpaceCheck(carrier, recv, opps, dir){
  // 뒤에서 두 번째 수비수(보통 최후방 필드 수비수)가 오프사이드 라인
  const line=offsideLineX(opps.filter(o=>o.slot!=="GK"), dir);
  // (2) 온사이드 확인 — 라인을 이미 넘어서 있으면 찔러도 오프사이드다
  const beyond = dir>0 ? (recv.x - line) : (line - recv.x);
  if(beyond > 0.004) return null;
  // (1) 라인과 골라인 사이 = 달려 들어갈 뒷공간. 라인이 낮으면(수비가 내려앉으면) 공간이 없다.
  const goalX = dir>0 ? 1 : 0;
  const space = Math.abs(goalX - line)*PITCH_AR;
  if(space < THRU_SPACE_MIN) return null;
  // 타깃 공간의 중심 — 라인에서 뒷공간 쪽으로 절반쯤 들어간 지점, 좌우는 리시버 라인
  const sx = clamp01(line + (goalX-line)*0.45);
  const sy = clamp01(recv.y);
  // (3) 그 공간의 상대 밀집도
  let crowd=0;
  for(const o of opps){
    if(o.slot==="GK") continue;
    if(HYP((o.x-sx)*PITCH_AR, o.y-sy) < THRU_LOOK) crowd++;
  }
  if(crowd > THRU_CROWD_MAX) return null;
  return {line, space, crowd, sx, sy};
}
/* 가속을 반영한 교차점 — 리시버는 지금 속도에서 최고 속도까지 가속하며 달린다.
   등가속 구간 t_a=(vmax-v0)/a 를 지나면 그 뒤로는 vmax 등속.
     d(t) = v0·t + ½a·t²                     (t <= t_a)
          = v0·t_a + ½a·t_a² + vmax·(t-t_a)  (t >  t_a)
   공의 도착 시간과 리시버의 도착 시간이 같아지는 t 를 수렴시켜 찾는다. */
function runDistance(v0, vmax, acc, t){
  const ta=Math.max(0, (vmax-v0)/acc);
  if(t<=ta) return v0*t + 0.5*acc*t*t;
  return v0*ta + 0.5*acc*ta*ta + vmax*(t-ta);
}
function interceptPointAccel(from, to, ballSpeed, vmax, acc){
  // 달리는 방향 단위벡터 — 움직이고 있으면 그 방향, 아니면 상대 골 방향
  /* ⚠ 「안 움직이면 골 방향」이라는 대체값은 순간 속도를 못 믿어서 붙인 것이다.
     평활값을 쓰면 진짜 정지한 선수만 그 분기로 간다. */
  let ux=vSx(to)*PITCH_AR, uy=vSy(to);
  const ul=HYP(ux,uy);
  if(ul>1e-5){ ux/=ul; uy/=ul; }
  else { ux=(to.dir>0?1:-1); uy=0; }
  const v0=ul/SIM_DT;                       // 현재 속도 (iso/초)
  let t=0.6;
  for(let i=0;i<7;i++){
    const d=runDistance(v0, vmax, acc, t);  // t초 동안 달려간 거리
    const px=to.x + ux*d/PITCH_AR, py=to.y + uy*d;
    const bd=HYP((px-from.x)*PITCH_AR, py-from.y);
    const nt=bd/Math.max(0.06, ballSpeed);  // 공이 그 지점까지 가는 데 걸리는 시간
    if(Math.abs(nt-t)<0.02){ t=nt; break; }
    t=0.5*t+0.5*nt;                         // 진동하지 않게 절반씩 수렴
  }
  t=clamp(t, 0, 2.4);
  const d=runDistance(v0, vmax, acc, t);
  return {x:clamp01(to.x+ux*d/PITCH_AR), y:clamp01(to.y+uy*d), t, lead:d};
}

/* 목표까지 굴러가 그 지점에서 거의 멈추도록 초기 속도를 역산한다.
   마찰 f 로 감속하는 공의 총 이동거리 = v0·dt/(1-f) 이므로 v0 = D(1-f)/dt.
   여유분(PASS_OVER)만큼 더 세게 차서 받는 선수가 발을 대기 좋게 만든다. */
/* 🍌 감아 차는 방향 — 패스 길목에 선 수비수의 「반대쪽」으로 감는다.
   랜덤으로 휘면 그냥 부정확한 패스일 뿐이다. 커브가 의미를 가지려면
   "막고 선 발을 피해 돌아 들어가는" 방향이어야 한다.
   반환 −1(왼쪽으로 감음) ~ +1(오른쪽) — 0이면 막는 사람이 없어 감을 이유가 없다. */
function passCurveSide(carrier, tx, ty, opps){
  const dx=(tx-carrier.x)*PITCH_AR, dy=ty-carrier.y;
  const D=HYP(dx,dy);
  if(D<0.035 || !opps || !opps.length) return 0;      // 2m 미만 짧은 패스는 감지 않는다
  const ux=dx/D, uy=dy/D;
  let bLat=0, bW=0;
  for(const o of opps){
    if(!o || o.off) continue;
    const ox=(o.x-carrier.x)*PITCH_AR, oy=o.y-carrier.y;
    const lon=ox*ux+oy*uy;                            // 패스 진행 방향 성분
    if(lon<0.035 || lon>D*0.95) continue;             // 등 뒤나 목표 너머는 길을 막지 않는다
    const lat=-ox*uy+oy*ux;                           // 경로에서 좌우로 벗어난 거리
    const aL=Math.abs(lat);
    if(aL>0.108) continue;                            // 약 7.3m 밖이면 상관없다
    /* 경로 한복판(진행률 0.45쯤)에 바짝 붙어 선 수비수가 가장 거슬린다 */
    const w=(1-aL/0.108)*(1-Math.abs(lon/D-0.45)*0.9);
    if(w>bW){ bW=w; bLat=lat; }
  }
  if(bW<=0.025) return 0;
  return (bLat>0 ? -1 : 1) * clamp(bW*1.35, 0, 1);    // 막는 쪽의 반대로 감아 넘긴다
}
function passLaunchSpeed(distIso, over){
  return Math.min(PASS_VMAX, distIso*(over||PASS_OVER)*(1-PASS_LAUNCH_F)/SIM_DT);
}

/* 공을 가진 선수가 주변을 훑어 최선의 패스를 고른다.
   후보 점수는 evaluatePassOptions 가 매기고, 여기서는 "어떻게 보낼지"를 정한다 —
   종류(숏/롱/스루), 목표(발밑 / 미래의 공간), 세기, 그리고 능력치에 따른 오차. */
/* ══════════════════════════════════════════════════════════════════
   🆘 ESCAPE PASS — 걷어내기 직전에 「안전한 한 발」이 있는지 먼저 본다.
   전진 이득은 아예 보지 않는다. 끊기지 않고 살아남는 것만 본다.
   ⚠ 실측: 걷어내기의 96%가 실제 압박(평균 1.18) 아래서 나왔다. 즉 "무리하게 걷어낸다"가
      아니라 "줄 곳이 없다"가 원인이다. 문턱을 낮추는 대신 선택지를 만들어 준다.
   ══════════════════════════════════════════════════════════════════ */
function escapeOption(carrier, opts, opps, skill){
  let best=null, bs=-1e9;
  for(const o of opts){
    if(o.dist>0.26) continue;                                  // 짧은 것만 — 긴 탈출은 걷어내기와 같다
    const free = clamp(1-(o.recvPress||0)/0.50, 0, 1);
    const open = clamp(1-(o.blocked||0)/0.55, 0, 1);
    const near = clamp(1-o.dist/0.18, 0, 1);
    /* 받는 선수 근처에 상대가 있으면 탈출이 아니라 헌납이다 */
    let vuln=0;
    for(const q of (opps||[])){
      if(q.slot==="GK") continue;
      const d=HYP((q.x-o.to.x)*PITCH_AR, q.y-o.to.y);
      if(d<0.13) vuln=Math.max(vuln, 1-d/0.13);
    }
    const s = free*1.60 + open*1.30 + near*0.90 - vuln*1.75;
    if(s>bs){ bs=s; best=o; }
  }
  /* 침착하고 기술 좋은 선수일수록 낮은 문턱에서도 빼낼 자신이 있다.
     ⚠ 문턱이 낮으면 걷어내기는 줄지만 후방 턴오버가 늘어 실점이 뛴다
        (실측 2.05 기준: 걷어내기 36→18회/팀, 대신 슛 102→153·골 10→20). */
  /* 문턱 — 낮추면 걷어내기가 줄지만 후방 턴오버가 늘어난다.
     A/B(4경기, 같은 대진): 켬 → 패스 1069·걷어내기 207·슛 121·골 17
                            끔 → 패스  952·걷어내기 248·슛 128·골 12
     슛 수는 사실상 같고 골 차이는 표본 잡음 범위다. 빌드업 이득(패스 +12%,
     걷어내기 −16%)을 취해 켜 둔다. */
  return bs > (2.30 - skill*0.70) ? best : null;
}
/* 🔭 이 패스를 받은 뒤, 그 선수에게 이어갈 곳이 있는가 (§29).
   지금 당장 안전한 패스라도 받은 사람이 막다른 골목이면 좋은 패스가 아니다.
   비용이 크므로 상위 후보 몇 개에만 적용한다. */
function nextOptions(m, carrier, mates, opps, dir){
  let cnt=0, bestFwd=0;
  for(const q of mates){
    if(q===m || q===carrier || q.slot==="GK") continue;
    const d=HYP((q.x-m.x)*PITCH_AR, q.y-m.y);
    if(d<0.05 || d>0.30) continue;
    if(laneBlocked(m, q, opps) > 0.50) continue;
    if(pressureOn(q, opps, 1) > 0.80) continue;
    cnt++;
    const f=(q.x-m.x)*dir;
    if(f>bestFwd) bestFwd=f;
  }
  return {n:cnt, fwd:bestFwd};
}
function findBestPass(carrier, mates, opps, ctx){
  /* ⚡ act() 가 이미 한 번 평가해 둔 목록이 있으면 그대로 쓴다 — 한 번의 판단에서
     findBestPass 가 2~4번 불리는데(옵션 → 플랜 변환), 그때마다 전 후보를 다시 재고 있었다. */
  const opts=(ctx && ctx.opts) ? ctx.opts : evaluatePassOptions(carrier, mates, opps, ctx);
  if(!opts.length) return null;
  /* 🔭 상위 후보만 한 수 앞을 본다 — 받은 뒤 이어갈 곳이 없으면 값을 깎는다.
     시야가 좋은 선수일수록 이걸 잘 읽는다. */
  /* 🚫 비활성 — 세 설정 모두 「패스 성공률은 오르는데 슛이 3분의 1 줄어드는」 결과였다.
     (같은 대진 2경기 · 기준: 팀당 패스 212 · 성공률 76.6% · 슛 16.8 · 골 4.5)
       감점형   → 패스 232 · 80.6% · 슛  8.8 · 골 1.5
       가점만   → 패스 204 · 76.6% · 슛 11.5 · 골 5.0
       절충     → 패스 226 · 78.5% · 슛 11.8 · 골 2.0
     원인은 같다 — 「받은 뒤 이어갈 곳」을 보면 전진 패스가 늘 손해로 나온다.
     전진의 가치를 함께 세지 않으면 이 지표는 팀을 후방 순환에 가둔다.
     되살리려면 아래 false 를 지우면 된다. */
  if(false && !ctx.pick && opts.length>1){
    const _vA=(carrier.p&&carrier.p.attr)||{};
    const _vs=clamp(attr20(_vA.vis!=null?_vA.vis:60)/20, 0.15, 1);
    opts.sort((x,y)=>y.score-x.score);
    const look=Math.min(3, opts.length);
    for(let i=0;i<look;i++){
      const o=opts[i];
      const nx=nextOptions(o.to, carrier, mates, opps, ctx.dir);
      o.nextN=nx.n;
      /* ⚠ 「이어갈 곳이 없으면 감점」으로 짰더니 전진 패스가 전부 막혔다
         (실측: 팀당 슛 16.8→8.8회). 최종 3분의 1에서는 다음 수가 「슛」이라
         이어갈 동료가 없는 게 정상이다. 감점 없이 가점만 주고, 앞선에서는 아예 끈다. */
      const _adv=(ctx.dir>0 ? o.to.x : 1-o.to.x);
      if(_adv < 0.62){
        o.score += (clamp(nx.n/2.5, 0, 1)-0.22) * (0.28 + _vs*0.50)
                 + clamp(nx.fwd/0.20, 0, 1)*0.16*_vs;
      }
    }
    opts.sort((x,y)=>y.score-x.score);
  }
  /* ⚡ 역습 — 옆으로 돌리는 안전한 패스보다 전진 옵션이 크게 가산된다.
     수비가 대형을 갖추기 전 몇 초가 역습 전술의 존재 이유다. */
  if(ctx.counter) { const cw=0.30+(ctx.counterK||0.75)*0.55;   // 1단계 0.34 → 4단계 0.85
    opts.sort((x,y)=>(y.score+(y.forward||0)*cw)-(x.score+(x.forward||0)*cw)); }
  const opt=ctx.pick ? ctx.pick(opts) : opts[0];
  if(!opt) return null;

  const skill=ctx.passSkill||carrier.passSkill||0.6;
  const distM=opt.dist*ISO_TO_M;
  const runner = opt.to.offRole===OFF_ROLE.RUN || opt.to.offRole===OFF_ROLE.OVERLAP || opt.to.offRole===OFF_ROLE.INSIDE;
  const moving = HYP(vSx(opt.to)*PITCH_AR, vSy(opt.to))/SIM_DT > 0.030;   // 잔발질을 달리기로 읽지 않는다

  // ── 종류를 정한다
  let type;
  // 스루패스는 "침투 역할 + 움직이는 중"만으로는 부족하다. 뒷공간이 실제로 있고,
  // 온사이드이고, 그 공간이 비어 있어야 한다 — 아니면 일반 패스로 돌린다.
  const thru = (runner && moving) ? throughSpaceCheck(carrier, opt.to, opps, ctx.dir) : null;
  // 공간이 넓고 상대가 적을수록 자주 시도한다
  /* 뒷공간이 넓을수록 더 자주 노린다 — 이게 없으면 상대가 라인을 아무리 올려도
     "공간은 생겼는데 아무도 안 찌르는" 상태가 되어, 높은 라인이 순수 이득이 돼버린다. */
  const spaceK = thru ? clamp(thru.space/20, 0.55, 2.2) : 1;
  /* 뒷공간으로 찌를지 말지는 "누가 뛰느냐"에 크게 좌우된다. 발 느린 타깃형 9번에게는
     아무도 스루패스를 넣지 않고, 빠른 윙어가 뛰면 어지간히 좁아도 한 번 찔러 본다. */
  const runFast = thru ? clamp(0.62+(opt.to.topSpeed!=null?opt.to.topSpeed:0.6)*0.78, 0.62, 1.45) : 1;
  /* 👁️ 패서의 눈 — 시야와 예측력. thruP 보다 위에서 잡는다(예전에는 아래에 있었다). */
  const _A=(carrier.p&&carrier.p.attr)||{};
  const _vis=clamp(attr20(_A.vis!=null?_A.vis:60)/20, 0.15, 1);
  const _dec=clamp(attr20(_A.dec!=null?_A.dec:60)/20, 0.15, 1);
  const _ant=clamp(attr20(_A.ant!=null?_A.ant:60)/20, 0.15, 1);
  /* 👁️ 스루패스는 시야를 읽지 않고 있었다 — <b>기존 코드 안에서도 앞뒤가 안 맞던 자리다</b>.
     바로 아래 전환 패스(0.10+_vis*0.34)와 리드 패스(0.12+_vis*0.42)는 시야를 읽는데,
     축구에서 시야가 가장 중요한 패스인 스루패스만 passSkill(패스 기술)로만 정해졌다.
     기술이 좋아도 못 보면 못 찌르고, 기술이 평범해도 보면 찌른다 — 그게 스루패스다.
     리그 평균(vis 0.59 · ant 0.74)에서 약 1.0, 바닥 0.56 ~ 천장 1.37. */
  const _eyeThru = 0.42 + _vis*0.70 + _ant*0.25;
  /* 제보: 1대1이 너무 자주 나온다(측정 경기당 10회) — 스루패스가 사실상 상한(0.9)에 붙어 살았다.
     기본 시도율을 낮추고 상한을 절반으로. 대신 성공한 1대1의 마무리는 resolveShot 에서 현실화했다. */
  const thruP = thru ? clamp((0.10 + skill*0.26)*_eyeThru*spaceK*runFast*(1 + FX(carrier,"killer")) * (1 - thru.crowd*0.22)
                             * (ctx.counter?(1.25+(ctx.counterK||0.75)*0.75):1), 0,
                             ctx.counter?(0.48+(ctx.counterK||0.75)*0.20):0.45) : 0;   // ⚡ 역습 창에는 찔러 본다
  /* 긴 패스 / 짧은 패스 선호 — "몇 m부터 길게 차는가"의 문턱 자체를 움직인다.
     예전에는 특성만 읽었고(TP.longPass), 게다가 shortPass 가지는 아래 기본 분기와
     조건이 완전히 같아 아무 일도 하지 않는 죽은 줄이었다. 역할(딥라잉 플레이메이커의
     긴 패스, 앵커·하프백의 짧고 안전한 패스)이 실제로 동작하도록 FX로 합쳐 읽는다. */
  const lpF=FX(carrier,"longPass"), spF=FX(carrier,"shortPass");
  /* 🎚️ 팀 지시가 선수 성향과 <b>곱해진다</b> — 롱볼 지시를 받은 짧은 패스 선수는
     그 중간 어딘가에 선다. 지시가 특성을 덮어쓰지 않는 게 요점이다.
     _pT: -1(매우 짧게) · 0(혼합) · +1(롱볼 위주) */
  const _pT = clamp((ctx.passTac==null?1:ctx.passTac)-1, -1, 1);
  const longGate = PASS_LONG_M*clamp(1 - lpF*0.38 + spF*0.45, 0.55, 1.85)*(1 - _pT*0.22);
  /* 🎯 패스 종류 — 스루/롱/숏에 더해, 달리는 동료 앞으로 붙여 주는 리드 패스와
     반대편으로 크게 벌리는 스위치를 구분한다. 시야(vis)가 좋을수록 이런 패스를 본다.
     (_vis·_dec·_ant 는 위에서 이미 잡았다) */
  let _spaceInfo=null;
  const rsp=HYP(vSx(opt.to)*PITCH_AR, vSy(opt.to))/(SPD.SPRINT*SIM_DT);   // 리드 패스 판정 — 평활값
  const wideSwitch = Math.abs(opt.to.y-carrier.y)>0.34 && distM>24;
  if(thru && Math.random() < thruP)                            type=PASS_TYPE.THROUGH;
  else if(wideSwitch && Math.random() < 0.10+_vis*0.34)        type=PASS_TYPE.SWITCH;
  /* ⚠ ① 공격적인 패스의 <b>생성 빈도</b> (요청 — 「인터셉트율만 보는 게 아니라 생성률도 같이 봐야 한다」).
     실측: LEAD 가 경기당 <b>134.6회</b>(팀당 67회) 나왔다. 조건이 「동료가 움직이는 중」
     (rsp>0.35 = 전력질주의 35%)이기만 하면 최대 54% 확률이라, <b>옆으로·뒤로 걷는 동료</b>
     에게도 앞으로 찔러 주는 패스가 나갔다. 그 공이 전부 수비 뒷공간으로 향하니
     1대1 찬스가 계속 났다.
     ─ 실제로 「앞으로 붙여 주는 패스」는 ⓐ 앞으로 달리는 동료에게 ⓑ 그 앞이 열려 있을 때다. */
  else if(rsp>0.55 && (vSx(opt.to)*carrier.dir)>0.0006 && distM<30
          && Math.random() < 0.06+_vis*0.26)                  type=PASS_TYPE.LEAD;
  else if(distM > longGate || (opt.laneRisk||0) > 0.7)         type=PASS_TYPE.LONG;
  else if(((opt.to.x-carrier.x)*carrier.dir) < -0.02)          type=PASS_TYPE.BACK;
  else                                                          type=PASS_TYPE.SHORT;

  // ── 목표 지점을 정한다
  let tx, ty, lead=0;
  if(type===PASS_TYPE.THROUGH){
    const guess=passLaunchSpeed(opt.dist, PASS_OVER+0.15);
    // 리시버의 가속·최고속도를 반영해 "달려가서 닿을 수 있는" 지점을 잡는다
    const vmax=SPD.SPRINT*BURST_MUL*paceMul(opt.to);
    const acc =ACCEL_BASE*accMul(opt.to);
    const ip=interceptPointAccel(carrier, opt.to, guess, vmax, acc);
    tx=ip.x; ty=ip.y;
    lead=HYP((tx-opt.to.x)*PITCH_AR, ty-opt.to.y);
    if(lead < 0.012){ type=PASS_TYPE.SHORT; tx=opt.to.x; ty=opt.to.y; lead=0; }  // 사실상 발밑이면 스루가 아니다
  } else if(type===PASS_TYPE.LEAD){
    /* 🌌 리드 패스 = 공간 패스 — 목표는 선수가 아니라 "선수가 도착할 공간"이다.
       ① 공 도달 시간을 먼저 구하고 ② 그 시간 동안 수신자가 갈 지점을 예측하며
       ③ 그 공간의 질과 ④ 수신자가 실제로 닿을 수 있는지를 함께 본다. */
    const rvx=vSx(opt.to)/SIM_DT, rvy=vSy(opt.to)/SIM_DT;   // 수신자 속도(iso/s) — 방향이라 평활값
    const rv=HYP(rvx*PITCH_AR, rvy);
    if(rv>1e-6){
      const guess=passLaunchSpeed(opt.dist, PASS_OVER);
      const tT=clamp(opt.dist/Math.max(0.05,guess), 0.2, 1.6);    // ① 공 도달 시간
      /* ② 기본 리드 — 시야가 좋을수록 앞을 정확히 본다 */
      let leadT=tT*(0.55+_vis*0.45);
      /* 상대 수비가 빠르면 공간이 빨리 닫힌다 — 리드를 줄인다 */
      let dSpd=0;
      for(const o of opps){ if(o.slot==="GK") continue;
        const d=HYP((o.x-opt.to.x)*PITCH_AR, o.y-opt.to.y);
        if(d<0.16) dSpd=Math.max(dSpd, (o.paceSkill||0.6)); }
      if(dSpd>0.62) leadT*= (1 - (dSpd-0.62)*0.55);
      /* ③ 후보 공간을 몇 개 만들어 가장 좋은 곳을 고른다 (판단력이 좋을수록 잘 고른다) */
      let best=null;
      /* 🗺️ 후보 공간 — 두 종류를 함께 본다.
         ⓐ 러닝 라인 : 수신자가 지금 뛰는 방향의 연장선
         ⓑ 배후·채널 : 수신자가 "방향을 틀어서라도 갈" 골문 쪽 빈 공간
         ⓑ가 없으면 후보가 전부 한 직선 위에 놓여, 각도·도달 점수가 늘 만점이 되고
         결국 "조금 앞에 준 패스"만 나온다. 배후 침투가 사라지는 원인. */
      const cands=[];
      for(const k of [0.6, 1.1, 1.8, 2.6, 3.6])
        cands.push({x:opt.to.x+rvx*leadT*k, y:opt.to.y+rvy*leadT*k});
      const fwd=(carrier.dir>0?1:-1);
      for(const dm of [9, 15, 22]) for(const ly of [-0.075, 0, 0.075])
        cands.push({x:opt.to.x+fwd*(dm/67)/PITCH_AR, y:opt.to.y+ly});
      for(const c of cands){
        const cx=clamp01(c.x), cy=clamp01(c.y);
        const sq=spaceQuality({x:cx,y:cy}, opps, carrier.dir, opt.to);
        const cr=corridorRisk(carrier, {x:cx,y:cy}, opps);
        const af=passAngleFit(opt.to, {x:cx,y:cy});
        /* ④ 수신자가 그 지점까지 닿을 수 있는가 — 못 닿으면 "너무 깊은 패스"다 */
        /* ④ 수신자와 공, 누가 먼저 그 공간에 닿는가 — 둘 다 "그 지점까지" 다시 잰다.
           ⚠ 공 시간을 수신자 위치 기준(tT)으로 고정하면 먼 배후 공간은 전부
              "못 닿음"이 되어 배후 침투 패스가 영영 안 나온다. */
        const dm2=HYP((cx-opt.to.x)*PITCH_AR, cy-opt.to.y);
        if(dm2<0.004) continue;                      // 사실상 발밑
        const cd=HYP((cx-carrier.x)*PITCH_AR, cy-carrier.y);
        const ballT=clamp(cd/Math.max(0.05, passLaunchSpeed(cd, PASS_OVER)), 0.2, 2.2);
        const need=travelTime(opt.to, dm2) + (1-passAngleFit(opt.to,{x:cx,y:cy}))*0.45;
        /* 공이 공간으로 굴러 들어가는 동안 따라붙어도 된다 — 0.55초까지는 봐준다.
           "공보다 먼저 도착"만 인정하면 배후 침투 패스는 영원히 안 나온다. */
        const reach=clamp(1-(need-ballT-0.55)/0.85, 0, 1);
        /* 판단력이 좋을수록 "닿을 수 있는 공간"을 고르고,
           낮으면 공간의 매력(빈 곳)에만 끌려 너무 깊은 패스를 고른다. */
        const sc = sq*(0.30+(1-_dec)*0.22) + (1-cr)*0.28 + af*0.14
                 + reach*(0.22+_dec*0.42)
                 + clamp(dm2/0.22, 0, 1)*0.16          // 공간을 만드는 패스에 가산
                 + (Math.random()-0.5)*(0.06+(1-_dec)*0.55);  // 판단력이 낮으면 고르는 눈이 흔들린다
        if(!best || sc>best.sc) best={x:cx, y:cy, sc, sq, cr, af, reach};
      }
      tx=best.x; ty=best.y;
      lead=HYP((tx-opt.to.x)*PITCH_AR, ty-opt.to.y);
      _spaceInfo={sq:best.sq, corridor:best.cr, angle:best.af, reach:best.reach, leadM:lead*67};
    } else { tx=opt.to.x; ty=opt.to.y; }
  } else { tx=opt.to.x; ty=opt.to.y; }

  /* ── 🎯 오차 — 난이도와 실행 실력을 견줘 "얼마나 빗나갔는가"를 만든다.
     가로(좌우)와 세로(길이)를 따로 계산한다. 확률로 성패를 가르지 않는다. */
  const _diff=passDifficulty(carrier, opt, {opts:opps, opps, oneTouch:!!ctx.oneTouch});
  const _exec=passExecSkill(carrier, _diff);
  const _miss=clamp(_diff*1.20 - (_exec-0.42)*1.25, 0.03, 1.7);   // 0=완벽 ~ 1.7=엉망
  const typeK = type===PASS_TYPE.SHORT?0.55 : type===PASS_TYPE.BACK?0.42
              : type===PASS_TYPE.THROUGH?1.25 : type===PASS_TYPE.SWITCH?1.35
              : type===PASS_TYPE.LEAD?1.10 : 1.0;
  /* 가로 오차 — 목표 방향에 수직으로 빗나간다 */
  const _pang=Math.atan2(ty-carrier.y, (tx-carrier.x)*PITCH_AR);
  const _gauss=()=>(Math.random()+Math.random()+Math.random()-1.5)/1.5;   // 종 모양 분포
  const latIso=_gauss()*PE.LAT*_miss*typeK;
  tx = clamp01(tx + Math.cos(_pang+Math.PI/2)*latIso/PITCH_AR);
  ty = clamp01(ty + Math.sin(_pang+Math.PI/2)*latIso);
  /* 세로 오차 — 짧게 차거나(언더히트) 길게 찬다(오버히트) */
  const lonR=_gauss()*PE.LON*_miss*typeK;
  const misWeight = clamp(1 + lonR, 0.55, 1.65);
  const _grade=passGrade(latIso*67, lonR);

  const dIso=HYP((tx-carrier.x)*PITCH_AR, ty-carrier.y);
  const over = PASS_OVER + (type===PASS_TYPE.THROUGH?0.30:0) + (opt.recvPress||0)*0.18;
  const speed = passLaunchSpeed(dIso, over)*misWeight;
  const lofted = type===PASS_TYPE.LONG;

  // 도착 시간 — 거리에 따라 늘어나고, 세게 찰수록 짧아진다
  // 도착 시간 — 실제 축구의 패스 소요 시간(5m 0.4초 / 20m 0.8초 / 40m 1.4초)에 맞춘다.
  // 여기가 길면 공이 공중에 머무는 시간이 늘어 커트가 폭증한다.
  /* 💪 세기 — 예전에는 거리와 오차(misWeight)만 세기를 정했다. 즉 킥이 강한 선수나
     다급한 상황이나 똑같은 속도로 굴러갔다. 킥력·패스 기술이 좋을수록 같은 거리를
     더 빠르게 보내고, 압박을 받으면 급하게 세게 찬다(대신 오차는 이미 위에서 커졌다). */
  const _kick = (carrier.shotPower!=null?carrier.shotPower:0.55)*0.42
              + (carrier.passSkill!=null?carrier.passSkill:0.55)*0.58;
  const _urg  = Math.min(0.5, (opt.recvPress||0)*0.34 + (ctx.press||0)*0.12);
  /* ⚠ 계수를 크게 잡았다가 실측에서 경기당 골이 1.7 → 5.3 으로 뛰었다. 패스가 조금만
     빨라져도 인터셉트가 통째로 사라진다 — 여기는 밸런스에 아주 민감한 손잡이다.
     선수 개성이 느껴질 만큼만 남기고 폭을 4분의 1로 줄인다(±6%). */
  const powK  = clamp(1.00 - (_kick-0.55)*0.09 - _urg*0.04, 0.945, 1.055);
  /* 🐢 살살 주는 패스 — 제보: 패스가 전부 곧고 빠르다.
     실제로 선수들이 늘 최고 세기로 차지는 않는다. 아무도 쫓아오지 않는데 3m 옆 동료에게
     대포알을 쏠 이유가 없다. 「세게 찰 이유가 없는 상황」을 찾아 힘을 뺀다.
     ⚠ 세기를 뺀 만큼 공이 오래 굴러 마그누스·롤커브가 더 오래 작용한다 — 더 휘어 보인다. */
  let easeK = 1;
  if(type===PASS_TYPE.BACK)  easeK += 0.17;                             // 백패스는 급할 게 없다
  if(type===PASS_TYPE.SHORT && distM<14) easeK += 0.11;                 // 가까우면 툭 밀어 준다
  if(type===PASS_TYPE.THROUGH || type===PASS_TYPE.LEAD) easeK -= 0.05;  // 찔러 주는 공만 여전히 빠르게
  /* 압박이 전혀 없는 여유로운 상황일수록 느긋하게 굴린다 */
  const _calm = clamp(1 - ((opt.recvPress||0)*1.6 + (ctx.press||0)*0.5), 0, 1);
  easeK += _calm*0.19;
  /* 🦶 받는 발 (제보 — 「받는 선수의 퍼스트터치 능력을 패스 세기에 반영」) — 퍼스트터치가 나쁜 동료에게는
     살살 준다. 터치 난이도의 최대 항이 공 속도(0.42)라 세기를 빼면 실제로 덜 흘린다. 맞춰 주는 정도는
     패서의 팀워크가 정한다 — 배려는 능력이다. */
  easeK += (Math.random()+Math.random()-1)*0.19;   // 같은 상황도 매번 똑같이 차지는 않는다
  easeK = clamp(easeK, 0.82, 1.55);
  {
    /* ⚠ 1·2차 시도 기록 — 더하기(0.85, 1.5 계수)로는 easeK 상한(1.55)에 잘려 수신 속도가 안 내려갔다.
       클램프 뒤에 곱으로 얹는다: 여유 있을 때만, 최대 +26%. */
    const _ftq=(opt.to.p&&opt.to.p.attr&&attr20(opt.to.p.attr.fir)/20)||0.6;
    const _aware=clamp(((carrier.p&&carrier.p.attr&&attr20(carrier.p.attr.tea)/20)||0.6), 0.3, 1);
    easeK *= 1 + Math.min(0.26, Math.max(0, 0.66-_ftq)*1.3*_aware*(0.35+_calm*0.65));
  }
  /* ⏱️ 기준 도착 시간을 15% 늘린다(요청) — 리그 전체 패스 속도가 그만큼 내려간다 */
  const T = clamp((0.274 + dIso*ISO_TO_M*0.0373)*powK*easeK/Math.max(0.6, misWeight), 0.30, 2.75);
  /* 🍌 길목을 막고 선 수비수를 감아 넘긴다 — 방향만 정하고, 휘는 폭은 kickSpin 이 정한다 */
  const curve = passCurveSide(carrier, tx, ty, opps);
  return {opt, to:opt.to, type, tx, ty, dist:dIso, lead, speed, lofted, T, curve, powK,
          diff:_diff, exec:_exec, miss:_miss, grade:_grade, space:_spaceInfo,
          latM:latIso*67, lonR,
          aim:{x:opt.to.x, y:opt.to.y},          // 원래 노린 지점 (디버그용)
          /* ⚠ 예전 power 는 passLaunchSpeed 기반이라 실제 발사 속도(거리÷T)와 따로 놀았다.
             몸에 맞고 튀는 세기가 여기 걸리므로, 살살 준 패스는 덜 튀어야 한다. */
          power: clamp((dIso/Math.max(0.12,T))/0.30, 0.40, 2.2)};
}
function decidePassDelivery(carrier, opt, ctx){
  const skill=ctx.passSkill||0.6;
  const recvPress=opt.recvPress||0;
  const dist=opt.dist;
  const runner = opt.to.offRole===OFF_ROLE.RUN || opt.to.offRole===OFF_ROLE.OVERLAP;
  // 공간 패스 — 침투 중인 동료에게, 시야가 좋을수록 자주
  const toSpace = runner && Math.random() < 0.16+skill*0.40;
  const lead = toSpace ? (0.04+skill*0.07) : 0;
  // 세기 — 기본 + 거리 + 압박. 능력치가 좋으면 과하지 않게 조절한다.
  let power = 0.70 + Math.min(0.55, dist*0.85) + Math.min(0.45, recvPress*0.32);
  if(toSpace) power += 0.10;
  power = clamp(power*(0.90+skill*0.16), 0.55, 1.95);
  return {power, toSpace, lead};
}
/* 크로스를 어떻게 올릴지 — 강하게 낮게 감아 올릴지, 천천히 띄워 올릴지.
     · 컷백은 낮고 빠르게
     · 받는 선수가 헤딩이 좋으면 띄워서 (경합할 시간을 준다)
     · 수비가 몰려 있으면 강하게 (머뭇거릴 틈을 주지 않는다) */
function decideCrossDelivery(carrier, cr, ctx){
  const skill=carrier.crossSkill||0.6;
  const str=(carrier.shotPower||0.6);
  switch(cr.traj){
    case CROSS_TRAJ.LOW:                                     // 컷백·낮은 크로스 — 빠르고 낮게
      return {power:clamp(1.15+skill*0.25+str*0.15, 0.9, 1.75), floated:false, traj:cr.traj};
    case CROSS_TRAJ.DRIVEN:                                  // 감아 올리는 빠른 크로스
      return {power:clamp(1.20+skill*0.35+str*0.20, 1.0, 1.95), floated:false, traj:cr.traj};
    case CROSS_TRAJ.CHIPPED:                                 // 툭 띄워 넘기는 공
      return {power:clamp(0.62+skill*0.16, 0.50, 0.92), floated:true, traj:cr.traj};
    default:                                                 // LOFTED — 천천히 높게
      return {power:clamp(0.74+skill*0.20, 0.58, 1.05), floated:true, traj:cr.traj};
  }
}
const EARLY_RUN_P=0.014;      // 라인을 미리 깨고 나가는 빈도
const EARLY_RUN_LEAD=0.055;  // 그때 라인을 넘는 깊이(약 3.7m)
const OFFSIDE_SEEN=0.002;   /* 패서가 「아슬아슬해서 못 본다」고 넘기는 폭(≈0.7m → 0.3m).
   0.011 에서 오프사이드가 경기당 7.0 회(실축 4)라 좁힌다 — 좁힐수록 명백한 위치를 더 피한다. */
/* ⚡ 좌표 세대 — 선수 좌표가 바뀔 때마다 올린다. 「이 배열·이 틱에서 이미 구한 값」을
   재사용하는 캐시(오프사이드 라인 등)가 스스로 낡음을 알아채는 기준이다. */
let SQ_GEN=0;  // 패서가 "명백한 오프사이드"로 인지하는 최소 차이 (이보다 아슬아슬하면 못 본다)
/* 오프사이드 라인 — 뒤에서 두 번째 수비수의 x (보통 최후방은 키퍼이므로 최종 필드 수비수) */
function offsideLineX(defs, dir){
  const xs=defs.map(d=>d.x).sort((a,b)=> dir>0 ? b-a : a-b);   // 상대 골문에 가까운 순
  if(xs.length>=2) return xs[1];
  return xs.length ? xs[0] : (dir>0?0.98:0.02);
}
/* 패스가 나가는 그 순간, 받는 선수가 오프사이드 위치인가.
   조건: 상대 진영 + 뒤에서 두 번째 수비수보다 앞 + 볼보다 앞 */
function isOffsidePos(recv, passer, defs, dir){
  const inOppHalf = dir>0 ? recv.x>0.5 : recv.x<0.5;
  if(!inOppHalf) return false;
  const line=offsideLineX(defs, dir);
  const beyondLine = dir>0 ? recv.x > line+0.004 : recv.x < line-0.004;
  const beyondBall = dir>0 ? recv.x > passer.x   : recv.x < passer.x;
  return beyondLine && beyondBall;
}
const PRESS_RADIUS=0.10;   // 압박으로 치는 거리
/* 전술이 반영된 선수의 기본 자리.
   width  — 좁게(0)/보통(1)/넓게(2) : 좌우 간격을 압축하거나 벌린다
   line   — 수비라인 높이           : 팀 전체 x를 앞뒤로 민다
   mentality + 소유 여부            : 공격 시 라인을 올리고 수비 시 내린다 */
/* 한 라인의 "좌 · 가운데 · 우" 짝 — 가운데가 비면 좌우가 그 공간을 나눠 메운다 */
/* 센터백만 적용한다. 중원·공격진까지 좁히면 팀 전체가 촘촘해져 공격할 공간 자체가 사라진다
   (실측: 중원까지 좁혔더니 슛이 29→14개로 반토막 났다). 뒷문은 좁히고 앞은 넓게 — 그게 맞다. */
const PAIR_CENTER={LCB:"CB", RCB:"CB"};
/* 가운데가 비었을 때 안쪽으로 좁히는 비율.
   1.0 = 그대로(24m — 센터백 사이가 뻥 뚫려 스트라이커가 걸어 들어온다)
   0.46 = 11.1m — 실제 백4의 센터백 간격. 중앙 슛이 크게 줄어드는 대신 수비가 단단해진다. */
const PAIR_TIGHT=0.46;
/* 🛡️ 수비 가담의 <b>비대칭</b> — 같은 밴드라도 한 명이 더 내려온다.
   투톱(LS/RS)이 늘 같이 내려오면 5-4-1 이 아니라 5-3-2 밖에 안 나온다.
   앵커는 (전술·슬롯·국면)만 보는 순수 함수라 「둘 중 누가」를 팀 상태로 못 고른다 —
   그래서 슬롯으로 못 박는다. 오른쪽(RS·RW·RAM)이 내려오는 쪽이다. */
const DROP_ASYM={ RS:1.75, LS:0.45, RW:1.45, LW:0.70, RAM:1.35, LAM:0.80, RM:1.20, LM:0.85 };
/* 그 슬롯에 실제로 선수가 서 있는가 — 전술판이 저장해 둔 슬롯 맵을 본다.
   매 틱 여러 번 불리므로 팀별로 캐시해 두고, 슬롯 맵이 바뀌면 다시 계산한다. */
function slotUsed(team, slot){
  const sm=(team && team.tactic && team.tactic.slot) || null;
  if(!sm) return false;
  if(team._suMap!==sm || team._suN!==Object.keys(sm).length){
    const set={};
    for(const id in sm) set[sm[id]]=true;
    team._suSet=set; team._suMap=sm; team._suN=Object.keys(sm).length;
  }
  return !!(team._suSet && team._suSet[slot]);
}
/* ⚠ 요청 — 「국면 포메이션은 없애자. 너무 극단적이었던 것 같다」.
   공격시/수비시 형태(PHASE_SHAPES · shapeMapFor · _shapeRoleAdj · 앵커 모핑)를 통째로 걷어냈다.
   포메이션은 다시 하나다 — 국면에 따라 달라지는 건 라인·간격·성향(기존 슬라이더)뿐이다.
   ─ 남겨 둔 것: team._slotOcc(경기 시점 실제 슬롯 배치)는 능숙도 적립이 쓰므로 그대로 둔다. */
/* ⚡ 앵커 좌표 캐시 — (전술값 · 슬롯 · 국면 · 홈여부)만으로 정해지는 순수 함수인데
   에이전트마다 매 틱 다시 계산했다(프로파일 13.2%). 전술이 바뀌면 키가 달라져 저절로 갱신된다. */
/* 앵커 캐시 통 — (국면 × 홈여부) 네 개. 문자열 키를 만들지 않기 위해 미리 갈라 둔다. */
function _ancBin(T, phase, isHome){
  if(phase==="ATT") return isHome ? (T._ancA1||(T._ancA1={})) : (T._ancA0||(T._ancA0={}));
  return isHome ? (T._ancD1||(T._ancD1={})) : (T._ancD0||(T._ancD0={}));
}
function tacticalAnchorXY(team, slot, phase, isHome){
  const T=TAC(team);
  /* 캐시는 TAC 결과 객체에 붙인다 — 전술이 바뀌면 그 객체가 새로 만들어지므로 저절로 무효화된다.
     ⚡ 국면·홈여부로 통을 네 개 나눠 둔다 — 예전엔 호출마다 "RCB"+"D"+1 같은 문자열을 새로 이어
     붙여 키를 만들었고, 그 한 줄이 전체의 1% 였다(실측). 이제 키는 슬롯 이름 그대로다. */
  const _ac = _ancBin(T, phase, isHome);
  const hit=_ac[slot];
  if(hit!==undefined) return {x:hit.x, y:hit.y};   // 호출부가 결과를 손대므로 복사해서 준다
  const base=SLOT_XY[slot]||SLOT_XY.CM;
  // SLOT_XY는 전술판 표시용이라 최후방~최전방이 피치 전체(약 80m)에 걸쳐 있다. 실제 팀 블록은
  // 40m 안쪽으로 훨씬 촘촘하므로, 시뮬에서는 필드 플레이어의 x를 중심 쪽으로 압축한다.
  // (이걸 안 하면 동료 간 거리가 너무 멀어서 짧은 패스라는 선택지 자체가 존재하지 않는다)
  const COMPACT=0.52, MIDX=0.44;
  const bx = slot==="GK" ? base.x : MIDX+(base.x-MIDX)*COMPACT;
  const wScale=0.72+T.width*0.28;                          // 0.72 / 1.00 / 1.28
  let y=0.5+(base.y-0.5)*wScale;
  // ── 가운데 칸이 비면 좌우가 안쪽으로 좁힌다 ─────────────────────────
  //   전술판은 한 라인을 5칸으로 나눠 놓았다. 백4를 쓰면 LB·LCB·RCB·RB 만 채워지고
  //   한가운데 CB 칸이 통째로 빈다. 그러면 두 센터백 앵커가 y 0.32 / 0.68 —
  //   무려 24m가 벌어져, 그 사이로 스트라이커가 그냥 걸어 들어와 공을 받는다.
  //   실제 백4의 센터백은 9~12m 간격으로 붙어 선다. 가운데가 비었으면 그만큼 좁혀 준다.
  //   (중원·공격진의 짝도 같은 문제를 겪는다 — 4-4-2의 두 중앙 미드필더 등)
  const ctr=PAIR_CENTER[slot];
  if(ctr && !slotUsed(team, ctr)) y = 0.5 + (y-0.5)*PAIR_TIGHT;
  /* 수비 라인 지시는 "뒷선을 어디에 두느냐"다. 예전에는 열한 명 전부를 똑같이 밀어 올려서,
     라인을 올리면 공격진까지 오프사이드 라인에 처박히며 공간이 사라졌다.
     (실측: 라인 0 → 우리 슛 30.5 · 라인 4 → 20.5 로 오히려 공격이 죽었다)
     실제로는 뒷선이 많이 올라오고 앞선은 거의 그대로다 — 그래서 블록이 "압축"된다. */
  const LINE_W = {SW:1.0, DF:1.0, WB:0.95, DM:0.85, MF:0.70, AM:0.45, FW:0.25};
  const lineShift=(T.line-1)*0.055*(slot==="GK" ? 0.5 : (LINE_W[SLOT_BAND[slot]] !== undefined ? LINE_W[SLOT_BAND[slot]] : 0.7))*1.55;
  // 풀백은 소유 시 한 라인을 통째로 올라간다(현대축구). 이게 없으면 오버래핑 목표까지 거리가 너무 멀어
  // 소유가 끝나기 전에 도착하지 못해, 지시만 있고 실제로는 올라가지 못한다.
  const isFB = (slot==="LB"||slot==="RB");
  const isWB = (slot==="LWB"||slot==="RWB");
  // 윙백은 풀백보다 더 올라간다 — 그게 윙백이다
  const _dc = (T.defCommit!=null ? T.defCommit : 1);          // 0~2 — 수비 가담 인원
  const fbPush = (phase==="ATT" && (isFB||isWB)) ? ((isWB?0.125:0.11)+(T.mentality-1)*0.03) : 0;
  /* 🛡️ 반대편 — 가담을 올리면 수비 시 윙백이 백라인 깊이까지 내려온다.
     3-5-2 기준 윙백 DEF 앵커 0.193 → 0.138, 3백(0.093)과 간격 0.045 < SH_SPLIT(0.052)
     이라 shapeLines 가 <b>다섯을 한 줄로</b> 묶는다 = 백5. */
  const fbDrop = (phase!=="ATT" && (isFB||isWB)) ? Math.max(0, (_dc-1))*0.055 : 0;
  const phaseShift = (phase==="ATT" ? (0.06+(T.mentality-1)*0.035) : -(0.045+(2-T.mentality)*0.012)) + fbPush;
  /* 🚌 텐백(전원 수비) (제보 — 「현대축구에서는 페널티 박스 안에서 수비를 많이 하거든? 우리 매치엔진은
     그렇지가 않더라고. 톱까지 전원 페널티박스 안에서 수비 가담하는 빽빽한 두줄수비, 전술 옵션으로」).
     실측(lowblock.js): 상대가 우리 진영 42m 안 소유 중일 때 기본 전술 박스 안 0.45명(중앙값 0),
     최수비 전술로도 1.11명·30m 안 5.9명·톱 50m — 로우블록이라는 그림 자체가 없었다.
     수비 국면 앵커부터 앞선일수록 끌어내린다(공격 국면은 그대로 — 역습은 살아야 한다). */
  /* 🛡️ 수비 가담 인원 (세부 전술) — 예전에는 blockComp(라인·간격·성향에서 파생)만 보고
     감독이 직접 못 건드렸고, <b>밴드 균일</b>이라 투톱이 늘 같이 내려왔다.
     ─ 이제 감독이 정하고, 슬롯별로 비대칭이다. 3-5-2 라면 RS 한 명만 미드필드 줄까지
       내려와 5-4-1 이 된다. 앵커가 바뀌면 shapeLines 가 라인 구성을 저절로 다시 잡는다. */
  const _busK = clamp(clamp((blockComp(T)-0.58)/0.30, 0, 1) + (_dc-1)*0.62, 0, 1.7);
  const _busT = (phase!=="ATT")
    ? _busK * ({FW:0.155, AM:0.105, MF:0.045, DM:0.02}[SLOT_BAND[slot]]||0) * (DROP_ASYM[slot]||1) : 0;
  let x=clamp01(bx + lineShift + (slot==="GK"?0:phaseShift-_busT-fbDrop));
  const p={x, y:clamp01(y)};
  const _out = isHome ? p : mirrorXY(p);
  _ac[slot]={x:_out.x, y:_out.y};
  return {x:_out.x, y:_out.y};
}
/* ⚡ 같은 값을 「고쳐 쓰지 않고 읽기만」 할 때 쓰는 참조판 — 캐시 객체를 그대로 준다.
   ⚠ 돌려받은 객체를 절대 고치지 말 것(캐시가 오염된다). 고쳐야 하면 tacticalAnchorXY 를 쓴다. */
function tacticalAnchorRef(team, slot, phase, isHome){
  const hit=_ancBin(TAC(team), phase, isHome)[slot];
  return hit || tacticalAnchorXY(team, slot, phase, isHome);
}
/* 어떤 지점이 상대 선수들에게 받는 압박 강도. 가까울수록 급격히 커지고, 압박 전술이 높으면 가중된다. */
function pressureOn(pt, opponents, pressTac){
  let s=0;
  for(const o of opponents){
    const d=HYP((o.x-pt.x)*PITCH_AR, o.y-pt.y);
    if(d<PRESS_RADIUS) s+=(1-d/PRESS_RADIUS);
  }
  return s*(0.8+((pressTac===undefined?1:pressTac))*0.25);
}
/* 패스 경로 위에 상대가 걸쳐 있는 정도(0=완전히 열림, 1=완전히 막힘) */
function laneBlocked(from, to, opponents){
  const dx=(to.x-from.x)*PITCH_AR, dy=to.y-from.y;
  const L=HYP(dx,dy); if(L<1e-6) return 0;
  const ux=dx/L, uy=dy/L;
  let worst=0;
  for(const o of opponents){
    const px=(o.x-from.x)*PITCH_AR, py=o.y-from.y;
    const along=px*ux+py*uy;
    if(along<=0.01 || along>=L) continue;                  // 패서 뒤 / 리시버 너머는 무관
    const perp=Math.abs(px*uy-py*ux);
    const near=1-clamp01(perp/0.038);                      // 경로에서 3.8% 안이면 위협(그보다 넓으면 다 막힌 걸로 잡힌다)
    if(near>worst) worst=near;
  }
  return worst;
}
/* 🏃 침투 의도별 가중치 — 「그 선수가 지금 무엇을 하려는가」.
   좌표가 아니라 의도를 읽는 자리다. 다섯 가지 움직임(윙어 뒷공간 · 채널 런 · 2선 침투 ·
   오버랩 · 파포스트)이 전부 여기 있다. 값은 작게 — 위 주석의 경고 참고. */
const RUN_INTENT={ RUN:0.26, CHANNEL:0.24, THIRD:0.20, OVERLAP:0.28,   /* 🔁 콤보 — 추월하는 풀백은 살려 준다 (0.18→0.28) */
                   INSIDE:0.17, FARPOST:0.15, UNDERLAP:0.14 };
/* 동료 전원을 점수화한다. 전진 이득은 크게 치고, 받는 선수가 압박받거나 경로가 막히면 깎는다.
   내가 압박받는 상황에서는 안전한 후방 옵션에 가점이 붙어 — 별도 로직 없이 — 백패스가 자연히 선택된다. */
function evaluatePassOptions(carrier, mates, opps, ctx){
  const dir=ctx.dir, out=[];
  /* 🔄 반대 전환 준비 — 상대가 한쪽에 몰려 있는지는 팀 단위로 이미 읽어 두었다(buildUpContext).
     여기서는 「그 정보를 본 선수가 반대편을 찾을 수 있는가」만 판단한다. */
  const _cA=(carrier.p&&carrier.p.attr)||{};
  const _cVis=clamp(attr20(_cA.vis!=null?_cA.vis:60)/20, 0.15, 1);
  /* 👁️ 「그 침투를 보는 눈」 — FM 의 능력치 구조를 따랐다.
     FM 은 침투를 <b>만드는 쪽</b>(오프 더 볼)과 <b>읽는 쪽</b>(시야·예측력)을 따로 둔다.
     그래서 시야가 낮은 선수는 좋은 침투를 자주 놓친다.
     ⚠ 우리는 RUN_INTENT 가점을 <b>누가 패스하든 똑같이</b> 주고 있었다 —
        시야 8짜리 수비수와 시야 18짜리 플레이메이커가 같은 침투를 같은 확률로 봤다.
        화면에만 있고 경기에는 없던 시야·예측력에 값어치를 준다.
     리그 평균(60)에서 약 1.0, 바닥 0.52 ~ 천장 1.44. */
  const _cAnt=clamp(attr20(_cA.ant!=null?_cA.ant:60)/20, 0.15, 1);
  const _cDec=clamp(attr20(_cA.dec!=null?_cA.dec:60)/20, 0.15, 1);   // 🧠 판단력 — EV 추정 오차
  const _eye=0.36 + _cVis*0.72 + _cAnt*0.36;
  const _cLng=clamp(carrier.lngSkill!=null?carrier.lngSkill:0.6, 0.1, 1.2);
  const _bu=ctx.bu||null;
  const _swK = _bu ? clamp((_bu.swing-1.0)/3.0, 0, 1) : 0;   // 좌우 밀집 차가 클수록 값이 크다
  /* 🎚️ 패스 성향 — -1(매우 짧게) ~ +1(롱볼 위주). 두 곳에 건다:
     ① 거리 감점(짧게 지시면 먼 옵션이 더 비싸진다)  ② 전진 가중(롱볼 지시면 앞을 더 본다).
     이 둘이 「짧게 돌린다 / 앞으로 붙인다」의 실제 내용이다. */
  const _pT = clamp((ctx.passTac==null?1:ctx.passTac)-1, -1, 1);
  const _pDist = clamp(1 - _pT*0.42, 0.58, 1.42);   // 롱볼 ×0.58 · 짧게 ×1.42
  const _pProg = 1.35 + _pT*0.55;                   // 짧게 0.80 · 롱볼 1.90 (⚠ 재계측 — 전진 성향 폭 확대)
  for(const m of mates){
    if(m.id===carrier.id) continue;
    const dx=(m.x-carrier.x)*PITCH_AR, dy=m.y-carrier.y;
    const dist=HYP(dx,dy);
    if(dist<0.03 || dist>0.70) continue;
    const forward=(m.x-carrier.x)*dir;
    // 전진 이득은 포화시킨다 — 이게 없으면 "가장 멀리 전진하는 패스"가 항상 이겨서 롱볼만 나온다
    const prog=Math.max(-1.2, Math.min(1.2, forward/0.25));
    // 거리 위험은 급격히 커진다(20m 부근이 기준). 패스 능력치가 높으면 완화된다.
    let distPen=Math.pow(dist/0.25, 1.8)*0.55*(1.35-ctx.passSkill*0.6)*_pDist;
    /* 🔄 반대 전환은 「긴 패스」로 취급하면 영원히 안 나온다.
       상대가 한쪽에 몰려 있으면 그 긴 공은 오히려 안전하다 — 지나갈 사람이 없기 때문이다.
       ⚠ 가점만 얹어 봤더니(최대 +0.45) 30m 거리 감점(약 1.5)에 눌려 전환이 0회였다.
          그래서 가점이 아니라 감점을 깎는다. */
    {
      const _ms = m.y<0.42 ? -1 : (m.y>0.58 ? 1 : 0);
      if(_swK>0 && _bu && _bu.ballSide!==0 && _ms!==0 && _ms!==_bu.ballSide &&
         Math.abs(m.y-carrier.y)>0.22){
        distPen *= (1 - _swK*0.62);
      }
    }
    /* ⏭️ 「리시버의 미래 위치로 압박·통로를 재기」 — <b>네 번 시도해 네 번 다 기각됐다</b>(기록).
       제보 원문 — "패스 선택이 너무 「현재 위치」 중심이다. … 미래 궤적으로 패스 선택에 들어가야 한다."
       요구 자체는 타당했다. 뒷공간으로 뛰는 윙어는 지금은 수비수 옆이라 압박 높음·통로 막힘으로
       찍히지만, 공이 도착할 때쯤엔 벗어나 있다. 그런데 실측이 계속 아니라고 했다.

       구현 — 리시버의 PRED_T 초 뒤 좌표를 만들어 pressureOn·laneBlocked 를 한 번 더 재고
              현재값과 섞는다(움직이는 선수만, 빠를수록 많이).
       실측 (같은 시드 3개 × 3경기 = 9경기, 난수 소비 동일):
         ① 순간속도 · 0.9초 · 45%           골 1.90 · 유효 30%      (기준선 골 2.67 · 유효 36%)
         ② 순간속도 · 0.5초 · 25%           골 2.33 · 유효 33%
         ─ 여기서 속도 평활(_vxS/_vyS)을 넣었다. 전제 조건이라고 봤다.
         ③ 평활 · 0.9초 · 45% (압박+통로)   성공률 77.1→74.4 · 스루패스 27→17 · 유효 42.4→37.4
         ④ 평활 · 0.9초 · 45% (압박만)      슛 99→86 · 유효 42.4→45.3  ← 유효슛 <b>총량</b>은 42.0→39.0 감소
         ⑤ 평활 · 0.9초 · 22% (압박만)      슛 99→106 · 유효 42.5 · <b>스루패스 27→20</b>
       ⑤ 는 유효슛 총량이 조금 늘었지만 스루패스가 26% 줄었다 — 이 변경이 하려던 바로 그 일이
          오히려 후퇴했다. 방향이 맞다면 나올 수 없는 모양이다.

       왜 안 되는가 (추정) — <b>선택과 실행이 어긋난다</b>. 미래 지점으로 채점하면 리드 패스를
       가정한 셈인데, 실행 단계에서 나가는 건 대개 평범한 패스라 현재 위치로 간다.
       채점이 약속한 공간과 공이 실제로 가는 곳이 다르다. 게다가 SHOW·OUTLET 처럼
       <b>공 쪽으로</b> 받으러 나오는 역할은 예측이 혼전 지역으로 밀어 넣는다.

       그리고 정작 제보가 짚은 문제는 다른 두 곳에서 풀렸다:
         · RUN_INTENT — 의도를 속도에서 분리 (침투자에게 간 패스 37.3% → 40.4%)
         · 속도 평활  — 스루패스 19→27 · 유효슛률 30.4% → 42.4%
       즉 「현재 위치 중심」이 병목이 아니라, <b>의도를 못 읽는 것</b>과 <b>속도값이 노이즈인 것</b>이
       병목이었다. 다시 시도한다면 채점이 아니라 <b>실행</b> 쪽(리드 패스 선택률)을 손대야 한다. */
    const recvPress=pressureOn(m, opps, ctx.press);
    const blocked=laneBlocked(carrier, m, opps);

    const recvAdv = dir>0 ? m.x : 1-m.x;                  // 0=자기 골문, 1=상대 골문
    const recvOwn = 1-(dir>0?m.x:1-m.x);                  // 0=상대 골문 쪽, 1=우리 골문 쪽
    // 우리 골문에 가까운 선수일수록, 그가 압박받고 있으면 패스 리스크가 급격히 커진다
    /* ⚠ 1차 점수는 <b>싼 대용치</b>(laneBlocked)로 매긴다 — 진짜 확률 모델(passCutP)은
       아래에서 상위 후보에게만 돌린다. 2단 랭킹: 싸게 거르고, 비싸게 고른다.
       (전 후보에게 돌렸더니 틱당 0.45 → 0.96ms 로 두 배가 됐다 — 실측) */
    /* ═══ 🎯 ② EV — 이제 Value 와 Risk 가 같은 단위(골 확률)를 쓴다 ═══════════════
       Value : 성공하면 오르는 골 기대값 + 압박 탈출 + 공간
       Risk  : 잃으면 상대가 얻는 골 기대값 (그 자리에서)
       score = (1−P잃음) × Value − P잃음 × Risk
       ⚠ 잃을 확률은 「끊기는 것」만이 아니다 — 눌린 채 받으면 거기서 잃는다.
          그 항을 값어치 쪽 감점으로 두면 확률과 곱해지지 않아, 「확실히 성공하는
          백패스」와 「받자마자 뺏길 백패스」의 대가가 같아진다(2단계 1차 실패 원인). */
    const _vNow = zoneValue(carrier.x, carrier.y, dir);
    const _gain = (zoneValue(m.x, m.y, dir) - _vNow) * EV_K;
    /* 🫁 압박 탈출 — 예전에는 selfPress 가 백패스 가점(최대 0.18)에만 붙어 있어,
       전진 패스로 빠져나가는 선택에는 아무 값도 얹지 않았다. */
    const escape = clamp((ctx.selfPress||0) - recvPress, 0, 1.2) * 0.30;
    /* 🌿 공간 창출 — 받는 사람 주변이 얼마나 비어 있는가. 없던 항이다. */
    let _nearO=9;
    for(const o of opps){
      if(o.slot==="GK") continue;
      const d2=HYP((o.x-m.x)*PITCH_AR, o.y-m.y);
      if(d2<_nearO) _nearO=d2;
    }
    const space = clamp((_nearO-0.045)/0.10, 0, 1) * 0.15;
    const pressLoss = clamp(recvPress*0.55, 0, 0.60);
    const evRisk = zoneValue(m.x, m.y, -dir) * EV_K;
    /* ═══ 🦶 ③ 발 방향 + 실행 오차 ═══════════════════════════════════════════════
       ⚠ carrier.face 는 여태 패스 <b>선택</b>에 한 번도 안 들어갔다(수신자의 침투 판단에만).
          그래서 등지고 있는 선수가 등 뒤로 정확한 패스를 아무렇지 않게 찔렀다.
       ⚠ 이 항이 캘리브레이션 잔차의 정체이기도 하다 — 1단계 모델은 「공이 의도한 자리로
          정확히 간다」고 가정했고, 그래서 「안전」 구간(예측 5%)의 실제 차단률이 15.5% 였다.
          빗나간 공이 끊긴다. 그 몫을 여기서 확률에 넣는다. */
    let faceOff=0;
    if(carrier.face!==undefined){
      let df=Math.atan2(dy, dx)-carrier.face;
      while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
      faceOff=Math.abs(df)/Math.PI;                 // 0=정면 · 1=완전히 등짐
    }
    const _tec=clamp(attr20((_cA.tec!=null?_cA.tec:60))/20, 0.15, 1);   // 개인기 — 몸이 안 돌아가도 처리한다
    /* 실행 실패 확률 — 몸 방향(돌아서 차야 하는 각) + 거리 대비 패스 능력 */
    const execLoss = clamp(faceOff*0.42*(1.30-_tec*0.55)
                         + Math.max(0, dist-0.22)*0.60*(1.35-(ctx.passSkill||0.6)*0.75),
                         0, 0.50);
    let score = _gain*_pProg/1.35 - distPen - blocked*1.2 + escape + space;
    /* 🧲 플레이메이커 유인 (제보 — 미드필더 역할 감사) — DLP(pm 1.0)의 패스 수가 일반 DM과
       -5~+20%로 차이가 없었고, 4-2-3-1의 10번은 경기당 패스 33~56회로 피벗(83~96)의 절반이었다.
       역할에 pm을 줘도 "공이 그를 찾아가는" 구조가 없어서다 — 동료의 패스 대상 평가는
       위치·압박·통로만 봤다. 수신자의 pm이 높으면, 그가 자유롭고 길이 열려 있을 때 가점.
       (막히거나 눌린 플레이메이커에게 억지로 찔러 주는 건 유인이 아니라 헌납이다) */
    { const _pmk=FX(m,"pm");
      if(_pmk>0.3) score += Math.min(0.42, _pmk*0.34)*clamp(1-recvPress/0.5,0,1)*(1-blocked*0.7); }
    /* 🔁 2대1 리턴 — 벽패스의 두 번째 패스. 침투 중인 최초 패서를 알아본다.
       고정 +1.00 은 경쟁에서 자주 밀렸다(완성 3%) — 침투자가 실제로 풀려 있을수록 가점이 커진다. */
    if(ctx.oneTwo && ctx.oneTwo.recvId===carrier.id && m.id===ctx.oneTwo.initId
       && (ctx.now||0)<ctx.oneTwo.until) score += 0.70 + clamp(1-recvPress/0.45, 0, 1)*0.85;
    /* 🏃 제3자 연계 (§8) — 이미 전력 침투 중인 동료는 공간을 공격하고 있다. 그 발에 맞춘다 */
    if((m.burstUntil||0)>(ctx.now||0) && recvAdv>0.60) score += 0.14;   /* 0.26→0.14 — 골 3.3/반경기로 튀어 조정 */
    /* 🔁 ③ 서드맨 1수 내다보기 (제보) — 이 동료에게 주면 그가 침투자를 풀어줄 수 있는가.
       받는 사람 기준 25m 안·전진 방향에 달리기 의도(RUN·CHANNEL·THIRD)의 동료가 있고 그 길이 열려 있으면 가점.
       A→B(내주고)→C(침투) 연계가 우연이 아니라 선택이 되게 한다. */
    if(ctx.mates && recvAdv>0.45 && recvPress<0.55){
      for(const r3 of ctx.mates){
        if(r3===m || r3===carrier || r3.slot==="GK") continue;
        const _rr=r3.offRole;
        if(_rr!==OFF_ROLE.RUN && _rr!==OFF_ROLE.CHANNEL && _rr!==OFF_ROLE.THIRD) continue;
        if((r3.x-m.x)*dir<0.02) continue;
        if(HYP((r3.x-m.x)*PITCH_AR, r3.y-m.y)>0.37) continue;
        if(laneBlocked(m, r3, opps)>0.35) continue;
        score += 0.26; break;
      }
    }
    /* 🚀 압박 탈출 아웃렛 — 후방에서 좌우로 돌리며 상대 압박을 끌어올렸다면(3초+),
       한산한 먼 전방 동료에게 한 번에 보내는 롱킥이 값을 얻는다.
       (후퇴 → 백패스 → 좌우 전개까지는 기존 시스템이 이미 한다 — 마지막 탈출구만 연다) */
    if((ctx.presCirc||0)>3.0 && dist>0.34 && recvAdv>0.58 && recvPress<0.30)
      score += Math.min(0.85, 0.30+((ctx.presCirc||0)-3.0)*0.10);
    if(m.slot==="GK"){
      /* 🧤 키퍼로의 백패스 — 「자살행위」로 못 박아 두면 12경기 내내 한 번도 안 나온다(실측).
         실제로는 앞이 막혔을 때 판을 다시 짜는 정상적인 수단이다.
         · 키퍼가 눌려 있으면 여전히 위험하다 (recvPress 가 가파르게 깎는다)
         · 내가 압박받고 앞이 막혔을수록 값이 오른다
         · 우리 골문에 너무 가까운 자리에서는 여전히 피한다 */
      /* 실제 PL 기준 팀당 30~34회. 백패스 자체는 정상적인 빌드업 수단이므로 넉넉히 연다.
         실점이 늘었던 원인은 백패스 횟수가 아니라 「키퍼가 받은 뒤의 배급」이었다 — 아래에서 고친다. */
      const gkFree = clamp(1 - recvPress/0.50, 0, 1);
      const stuck  = clamp(((ctx.selfPress||0)-0.12)/0.95, 0, 1);
      const myOwn  = 1-(dir>0?carrier.x:1-carrier.x);              // 1=우리 골문 앞
      score += -0.62                                                // 후퇴이므로 기본 감점
             + gkFree*(0.92 + stuck*1.85)                            // 키퍼가 자유롭고 내가 막혔으면 가치
             - recvPress*2.10                                        // 눌린 키퍼에게는 절대 금물
             - Math.max(0, myOwn-0.82)*3.0;                          // 골문 코앞에서는 피한다
    }
    // 명백한 오프사이드 위치의 동료에게는 주지 않는다. 다만 라인과의 차이가 아슬아슬하면
    // 패서도 그걸 못 본다 — 실제 경기의 오프사이드는 대부분 이 미세한 오차에서 나온다.
    if(ctx.defs){
      const oline=offsideLineX(ctx.defs, dir);
      const over = dir>0 ? (m.x-oline) : (oline-m.x);
      const inOpp = dir>0 ? m.x>0.5 : m.x<0.5;
      if(inOpp && over > OFFSIDE_SEEN){
        // 얼마나 명백하냐에 비례해서 깎는다. 아슬아슬하면 그냥 찔러 넣고 깃발이 오른다.
        const obvious = clamp((over-OFFSIDE_SEEN)/0.045, 0, 1);
        score -= (0.35 + obvious*(1.85+(ctx.passSkill||0.6)*2.2));
      }
    }
    // 플레이메이커 역할은 볼이 그를 거쳐 가게 만든다 (FM: 모든 플메는 볼을 받으러 다가온다)
    if(m.role&&m.role.pm) score += m.role.pm*ROLE_PM_BONUS;
    // 특성: 반대편 측면으로 보내기 — 볼과 반대쪽에 있는 동료에게 가점
    const sw=FX(carrier,"switchPlay");
    if(sw) score += sw*clamp(Math.abs(m.y-carrier.y)/0.45,0,1)*0.55;
    /* 🔄 반대편이 비어 있으면 그쪽으로 크게 벌리는 패스의 값이 오른다 (§11·§12·§13).
       ⚠ 예전에는 switchPlay 특성을 가진 선수만 가점을 받아, 팀이 한쪽으로 몰려도
          전환이 전체 패스의 1%에 그쳤다. 시야와 롱패스 능력이 그걸 볼 수 있게 한다. */
    if(_swK>0 && _bu && _bu.ballSide!==0){
      const ms = m.y<0.42 ? -1 : (m.y>0.58 ? 1 : 0);
      if(ms!==0 && ms!==_bu.ballSide){
        const lat  = clamp(Math.abs(m.y-carrier.y)/0.40, 0, 1);
        const open = clamp(1-recvPress/0.55, 0, 1);
        score += _swK * lat * open * (0.42 + _cVis*0.62 + _cLng*0.40)
               - blocked*0.55;
      }
    }
    if(forward<0) score += Math.min(0.18, ctx.selfPress*0.20);  // 압박받을 때만 백패스가 살아난다
    /* 🏃 앞으로 뛰고 있는 동료 — 「의도」와 「속도」를 분리해서 읽는다.
       제보 원문 — "패스 선택이 너무 「현재 위치」 중심이다. 윙어의 뒷공간 침투 · 풀백
       오버랩 · ST의 채널 런 · 3선 미드필더의 2선 침투 · 반대쪽 윙의 파 포스트 침투가
       현재 좌표가 아니라 미래 궤적으로 패스 선택에 들어가야 한다."
       ⚠ 확인해 보니 미래 궤적 계산 자체는 이미 있다 — interceptPointAccel 이 리시버의
          가속·최고속도로 「달려가서 닿을 지점」을 풀고, LEAD 패스는 발 앞에 붙인다.
          다섯 가지 움직임도 전부 OFF_ROLE 로 존재한다.
          없는 건 <b>선택 함수가 그 의도를 못 읽는 것</b>이었고, 결함이 둘이었다.
       결함 ① — 의도 가중치(running 1.6 vs 0.7)가 곱해지는 대상이
          (topSpeed - 0.60), 즉 <b>리그 평균에서 정확히 0</b>이었다.
          「침투 중」이라는 정보가 빠른 선수에게만 전달되고, 평균 이하 선수에게는
          부호가 뒤집혀 오히려 감점이 커졌다. 의도가 속도에 실려 있어 따로 살지 못했다.
       결함 ② — 인식하는 역할이 RUN·OVERLAP·INSIDE 셋뿐이었다.
          CHANNEL(채널 런) · THIRD(3선 침투) · FARPOST(파포스트)가 <b>가만히 서 있는
          선수와 같은 0.7</b>을 받았다 — 제보가 짚은 셋이 정확히 그 셋이다.
       ⚠ 계수를 크게 잡으면 안 된다. 침투 동료 가점을 0.26 으로 뒀다가 반경기 3.3골로
          튀어 0.14 로 내린 기록이 바로 위에 있다. 아직 생기지 않은 공간에 패스를 꽂게 된다. */
    if(forward>0.01){
      const fw=Math.min(1, forward/0.18);
      const iw=RUN_INTENT[m.offRole]||0;           // 의도 — 속도와 무관하게 살아난다
      score += iw*fw*_eye;                         // 👁️ 다만 「보는 눈」이 있어야 값이 산다
      /* 속도는 그대로 둔다 — 같은 침투라도 발 빠른 윙어가 살리는 패스가 있다.
         여기는 평균 0 이 맞다(빠르면 가점, 느리면 감점). */
      const spd_=(m.topSpeed!=null?m.topSpeed:0.6)-0.60;
      score += spd_*(iw>0?1.6:0.7)*fw;
    }
    /* 1차 점수 — 진짜 확률은 아래 2단 랭킹에서 다시 넣는다(여기선 대용치로 근사) */
    const _value=score;
    const _oth=1-(1-pressLoss)*(1-execLoss);        // 끊김 말고 잃는 경로 (눌림 · 실행 실패)
    const _pl0=clamp(blocked*0.85 + (1-clamp(blocked*0.85,0,0.95))*_oth, 0.02, 0.97);
    score = (1-_pl0)*_value - _pl0*evRisk;
    /* ═══ 👁️ ④ 시야 — 「보이지 않는 옵션은 고를 수 없다」 ═════════════════════════
       ⚠ 여태 시야(vis)는 <b>침투 가점에 곱해지는 계수</b>였다. 그러면 시야가 낮은 선수도
          모든 옵션을 다 보고 값만 조금 다르게 매기는 셈이다. FM 은 그렇게 다루지 않는다 —
          시야는 <b>선택지의 개수</b>를 정한다. 등 뒤·먼 쪽 옵션은 시야가 낮으면 못 본다. */
    const seeP=clamp(0.42 + _cVis*0.72 - faceOff*0.60
                     - clamp((dist-0.22)/0.36, 0, 1)*0.28, 0.06, 1);
    if(seeP<0.999 && Math.random()>seeP) continue;   // 이번 판단에서는 안 보였다
    out.push({to:m, score, value:_value, evRisk, otherLoss:_oth, dist, forward, blocked, recvPress, pCut:null});
  }
  out.sort((a,b)=>b.score-a.score);
  /* 🎯 ② 상위 후보만 진짜 확률로 다시 잰다 — 대용치(blocked*1.2)를 빼고 pCut 을 넣는다.
     실제로 겨루는 건 늘 상위 몇 개뿐이므로, 아래쪽까지 비싸게 계산할 이유가 없다. */
  {
    const K=Math.min(PASS_REFINE_N, out.length);
    const _ps=ctx.passSkill||carrier.passSkill||0.6;
    for(let i=0;i<K;i++){
      const o=out[i];
      o.pCut=passCutP(carrier, o.to, opps, o.dist, _ps);
      /* 대용치를 걷어내고 진짜 확률로 다시 조립한다 */
      const pLose=clamp(o.pCut + (1-o.pCut)*o.otherLoss, 0.02, 0.97);
      o.score = (1-pLose)*(o.value + o.blocked*1.2) - pLose*o.evRisk;
      /* 🧠 ④ 판단력 — 「EV 를 얼마나 정확히 재는가」. 가중치가 아니라 <b>추정 오차</b>다.
         판단력 낮은 선수는 좋은 옵션과 나쁜 옵션의 값을 헷갈려 가끔 나쁜 쪽을 고른다. */
      o.score += (Math.random()-0.5)*EV_NOISE*(1.35-_cDec);
    }
    if(K>1) out.sort((a,b)=>b.score-a.score);
  }
  return out;
}
/* ── 오프더볼 역할 ──
   같은 라인의 선수가 전부 같은 판단을 하면 라인이 통째로 움직여서 공간이 생기지 않는다.
   실제 축구는 한 명이 내려받고, 한 명은 하프스페이스로 들어가고, 한 명은 뒷공간으로 뛴다.
   그 역할 분담을 명시적으로 만든다. */
/* ══════════════════════════════════════════════════════════════════
   🏃 MOVEMENT INTENT — 선수는 좌표를 따라가지 않는다. 「의도」를 고른다.
   모두가 공을 향해 움직이면 축구가 아니라 공 쫓는 군중이 된다. (§39)
   ══════════════════════════════════════════════════════════════════ */
const OFF_ROLE={ RUN:"RUN", HALF:"HALF", WIDE:"WIDE", DEEP:"DEEP", HOLD:"HOLD",
                 BALANCE:"BALANCE", OVERLAP:"OVERLAP", INSIDE:"INSIDE",
                 UNDERLAP:"UNDERLAP",   // 풀백이 바깥이 아니라 하프스페이스로 올라간다
                 VACATE:"VACATE",       // 공간을 비워 동료에게 내준다 (§8)
                 THIRD:"THIRD",         // 제3의 침투 — 지금 공과 무관한 자리에서 앞으로 (§13)
                 FARPOST:"FARPOST",     // 공 반대편에서 뒷문으로 (§17)
                 OUTLET:"OUTLET",       // 후방 빌드업 — 키퍼·센터백에게 짧은 패스 길을 내준다
                 CHANNEL:"CHANNEL",     // 뒷선의 「틈」(CB-CB·CB-FB 사이)으로 침투한다
                 SHOW:"SHOW" };         // 줄 곳이 없는 동료에게 받아 주러 나간다
/* 어느 쪽을 보고 있는 의도인가 — 공인가, 공간인가 (§39) */
const INTENT_AIM={ RUN:"SPACE", HALF:"SPACE", WIDE:"SPACE", DEEP:"BALL", HOLD:"OPPONENT",
                   BALANCE:"SPACE", OVERLAP:"SPACE", INSIDE:"GOAL",
                   UNDERLAP:"SPACE", VACATE:"OPPONENT", THIRD:"GOAL", FARPOST:"GOAL",
                   OUTLET:"BALL", SHOW:"BALL", CHANNEL:"GOAL" };
/* 공격의 단계 — 단계마다 팀이 원하는 움직임이 다르다 (§20) */
const ATK_PHASE={ BUILD:"BUILD", PROG:"PROG", FINAL:"FINAL", PEN:"PEN" };
/* ══════════════════════════════════════════════════════════════════
   🏗️ BUILD-UP CONTEXT — 「지금 우리 팀이 어떤 빌드업 상황인가」를 팀 단위로 한 번만 읽는다.
   개별 패스 후보를 매기기 전에 상황부터 파악한다. 틱당 1회 계산해 캐시한다.
   ⚠ Phase 1 에서는 계산만 한다. 어떤 판단도 아직 이 값을 쓰지 않는다.
   ══════════════════════════════════════════════════════════════════ */
const BU_STATE={ RESTART:"RESTART", FIRST:"FIRST", PROGRESS:"PROGRESS", PRESSURE:"PRESSURE",
                 RECYCLE:"RECYCLE", SWITCH:"SWITCH", ESCAPE:"ESCAPE", FINAL:"FINAL" };
function buildUpContext(mine, opps, ball, dir, carrier){
  const own = dir>0 ? ball.x : 1-ball.x;          // 0=우리 골문, 1=상대 골문
  /* ① 압박 프로파일 — 몇 명이, 얼마나 가까이, 어느 각도에서 오는가 */
  let pressers=0, nearest=9, ahead=0;
  if(carrier){
    for(const o of opps){
      if(o.slot==="GK") continue;
      const d=HYP((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
      if(d<nearest) nearest=d;
      if(d<0.13){ pressers++; if((o.x-carrier.x)*dir < 0) ahead++; }   // 앞을 막고 선 사람
    }
  }
  const press = clamp((pressers*0.30) + clamp(1-nearest/0.13, 0, 1)*0.55 + ahead*0.10, 0, 1.6);
  /* ② 좌·중·우 밀집도 — 전환(SWITCH) 판단의 재료 */
  let dL=0, dC=0, dR=0, hi=0;
  for(const o of opps){
    if(o.slot==="GK") continue;
    if(o.y<0.38) dL++; else if(o.y>0.62) dR++; else dC++;
    if((dir>0 ? o.x : 1-o.x) < 0.45) hi++;                            // 우리 진영까지 올라온 상대
  }
  const ballSide = ball.y<0.42 ? -1 : (ball.y>0.58 ? 1 : 0);
  const nearDen  = ballSide<0 ? dL : ballSide>0 ? dR : dC;
  const farDen   = ballSide<0 ? dR : ballSide>0 ? dL : Math.min(dL,dR);
  const swing    = nearDen - farDen;                                   // 클수록 반대편이 비었다
  /* ③ 상대 라인 높이 — 안 나오면 우리가 전진할 수 있다 */
  const oLine = oppLineX(opps.filter(o=>o.slot!=="GK"), -dir);
  const lineHigh = clamp((dir>0 ? (0.5-oLine)/0.35 : (oLine-0.5)/0.35), -1, 1);
  /* ④ 상태 — 위 값들로 결정한다 */
  let st;
  if(carrier && carrier.slot==="GK")         st=BU_STATE.RESTART;
  else if(own>0.62)                          st=BU_STATE.FINAL;
  else if(press>0.95)                        st=(own<0.30 ? BU_STATE.ESCAPE : BU_STATE.PRESSURE);
  else if(swing>=3 && own<0.60)              st=BU_STATE.SWITCH;
  else if(own<0.30)                          st=BU_STATE.FIRST;
  else if(press>0.55)                        st=BU_STATE.RECYCLE;
  else                                       st=BU_STATE.PROGRESS;
  return {state:st, press, pressers, nearest, dL, dC, dR, ballSide,
          nearDen, farDen, swing, oppHigh:hi, lineHigh, own};
}
/* ══════════════════════════════════════════════════════════════════
   🔁 INTENT SWITCH — 의도가 매 틱 진동하지 않게 하는 단 하나의 규칙 (§17).
   ① 최소 유지 시간이 지나야 하고 ② 새 의도가 지금 것보다 「충분히」 나아야 바꾼다.
   판단력이 좋은 선수는 빨리 갈아타고, 낮은 선수는 굼뜨게 붙들고 있다.
   ⚠ 예전에는 공격은 「지연 후 전환」, 수비는 「전환 후 목표 동결」로 규칙이 따로 놀았다. */
let SW_DWELL=1.4;         // 최소 유지 시간(초) — 🚶 4라운드 0.55 → 1.0 → 1.4 (역할·의도 전환 점프가 이동 예산의 남은 큰 몫)
let SW_MARGIN=0.22;   // (테스트에서 0으로 두고 A/B 할 수 있게 let)       // 갈아타려면 이만큼 더 좋아야 한다
function intentSwitch(a, curRole, bestRole, bestS, curS, t, key){
  if(curRole===bestRole) return true;
  const dec=(a.decSkill!=null?a.decSkill:0.55);
  const ant=(a.antSkill!=null?a.antSkill:0.55);
  const at=a[key];
  const dwell=SW_DWELL*(1.35-ant*0.70);                 // 예측이 좋으면 빨리 바꾼다
  if(at!=null && (t-at)<dwell) return false;
  const need=SW_MARGIN*(1.30-dec*0.60);                 // 판단력이 좋으면 문턱이 낮다
  return (curS==null) || (bestS >= curS + need);
}
function attackPhase(ball, dir, opps, carrier){
  const adv = dir>0 ? ball.x : 1-ball.x;
  if(adv>0.80) return ATK_PHASE.PEN;
  if(adv>0.64) return ATK_PHASE.FINAL;
  if(adv>0.40) return ATK_PHASE.PROG;
  return ATK_PHASE.BUILD;
}
const WIDE_SLOTS={LB:1,RB:1,LM:1,RM:1,LW:1,RW:1};
/* 슬롯 이름 기준 좌(-1)/중앙(0)/우(+1). home.y로 판단하면 CM은 y가 정확히 0.5여서
   RCM과 같은 쪽으로 가버리고, 결국 LCM·CM·RCM이 똑같이 움직이게 된다. */
const SLOT_SIDE={LB:-1,LCB:-1,LM:-1,LCM:-1,LW:-1,LS:-1, RB:1,RCB:1,RM:1,RCM:1,RW:1,RS:1, CB:0,CM:0,ST:0,GK:0};
const MID_SLOTS={LCM:1,CM:1,RCM:1};
const FWD_SLOTS={ST:1,LS:1,RS:1};
/* 🎯 상대 수비라인 분석 — ST 침투의 재료 (§3).
   최후방 라인에 서 있는 수비수들을 골라 y 로 정렬하고, 인접한 둘 사이의 「틈」을 찾는다.
   가장 넓은 틈이 채널이다 — CB-CB 사이일 수도, CB-FB 사이일 수도 있다. */
function backLineGaps(opps, dir){
  /* ⚠ 최후방 「한 명」 기준으로 라인을 잡으면, 낙오한 풀백 하나가 라인이 되어
     정작 센터백들이 뒷선에서 빠진다(실측: 39.8m짜리 가짜 틈). 두 번째로 깊은
     수비수를 기준선으로 삼고, 그 앞뒤 8m 를 뒷선으로 본다. */
  const fp=opps.filter(o=>o.slot!=="GK");
  if(fp.length<3) return null;
  const depth=(o)=> dir>0 ? o.x : 1-o.x;               // 상대 골문 기준 깊이
  const sorted=fp.slice().sort((p,q)=>depth(q)-depth(p));
  const line=sorted[1].x;                               // 두 번째로 깊은 수비수
  const backs=fp.filter(o=>Math.abs(o.x-line)<0.115);
  if(backs.length<2) return null;
  backs.sort((p,q)=>p.y-q.y);
  let best=null, minPace=1.2, sumStr=0;
  for(const b0 of backs){
    const pc0=(b0.paceSkill!=null?b0.paceSkill:0.6);
    if(pc0<minPace) minPace=pc0;
    sumStr+=(b0.strSkill!=null?b0.strSkill:0.55);
  }
  for(let i=0;i<backs.length-1;i++){
    const gap=backs[i+1].y-backs[i].y;
    if(gap>0.30) continue;                              // 20m 넘는 틈 = 라인 해석 실패
    const cy=(backs[i].y+backs[i+1].y)/2;
    if(Math.abs(cy-0.5)>0.38) continue;                 // 터치라인 밖 틈은 채널이 아니다
    if(!best || gap>best.gap) best={gap, y:cy, l:backs[i], r:backs[i+1], line, n:backs.length};
  }
  if(best){ best.minPace=minPace; best.avgStr=sumStr/backs.length; }
  return best;
}
/* 상대 최종 수비 라인의 x — 침투(RUN)의 기준선이 된다 */
function oppLineX(opps, dir){
  let line=null;
  for(const o of opps){
    if(o.slot==="GK") continue;
    if(line===null) line=o.x;
    else line = dir>0 ? Math.max(line,o.x) : Math.min(line,o.x);
  }
  return line===null ? (dir>0?0.8:0.2) : line;
}
/* 소유 팀의 역할 분담. 슬롯을 기본으로 하되 시간에 따라 순환시켜, 같은 선수가 늘 같은 움직임만
   하지 않게 한다(6초 주기 + 선수별 위상차). 침투는 항상 소수만 나간다. */
/* 🧬 MOVEMENT PROFILE — 슬롯 이름으로 분기하지 않는다.
   "이 선수가 어떤 성향인가"로 환원해 두면, 4-2-3-1이든 3-5-2든 새 전술을 넣어도
   여기를 지나가기만 하면 되므로 매치엔진을 다시 뜯을 필요가 없다.
   포메이션은 슬롯을 밴드에 꽂는 일이고, 움직임은 밴드와 역할이 정한다. */
const MOVE_BAND={
  /*        얼마나 높이 · 폭 · 뒷공간 · 내려받기 · 받쳐주기 · 박스침투 · 자리규율 */
  SW:{depth:0.05, width:0.10, behind:0.00, drop:0.60, support:0.35, box:0.02, hold:0.95},
  DF:{depth:0.12, width:0.20, behind:0.02, drop:0.45, support:0.40, box:0.06, hold:0.90},
  WB:{depth:0.62, width:0.85, behind:0.25, drop:0.25, support:0.50, box:0.20, hold:0.45},
  DM:{depth:0.28, width:0.25, behind:0.08, drop:0.85, support:0.85, box:0.10, hold:0.80},
  MF:{depth:0.50, width:0.35, behind:0.30, drop:0.55, support:0.75, box:0.35, hold:0.55},
  AM:{depth:0.78, width:0.35, behind:0.55, drop:0.35, support:0.60, box:0.70, hold:0.30},
  FW:{depth:0.92, width:0.20, behind:0.80, drop:0.30, support:0.35, box:0.85, hold:0.25}
};
function movementProfile(a){
  const B=MOVE_BAND[SLOT_BAND[a.slot]] || MOVE_BAND.MF;
  const lat=Math.abs((a.home?a.home.y:0.5)-0.5);
  const wide=clamp(lat/0.32, 0, 1);                      // 원래 서는 자리가 얼마나 측면인가
  /* 역할 + 특성 — 이동 로직이 역할만 읽던 탓에, fwd/wide 축으로 정규화되는 특성
     (forward·cutIn·hugLine·deep·boxPlayer·lateRun)이 선수 264명 중 60명(23%)에게서
     통째로 무시되고 있었다. 특성을 붙였는데 움직임이 안 바뀌던 원인. */
  const _B=roleBias(a);
  const rf=_B.fFwd, rw=_B.fWide;
  const A=(a.p&&a.p.attr)||{};
  const at=(k,fb)=>clamp(attr20(A[k]!=null?A[k]:(fb||60))/20, 0.15, 1);
  return {
    depth:  clamp(B.depth  + rf*0.34, 0, 1),
    width:  clamp(B.width*0.30 + wide*0.72 + rw*0.30, 0, 1),
    behind: clamp(B.behind + rf*0.28, 0, 1),
    drop:   clamp(B.drop   - rf*0.24, 0, 1),
    support:clamp(B.support, 0, 1),
    box:    clamp(B.box    + rf*0.26, 0, 1),
    /* ⚠ 예전엔 a.roamFx 를 읽었지만 그 값은 어디서도 대입되지 않았다 — 역할의 roam
       (레지스타 0.85 · 로밍 플메 1.0 · 리베로 0.6 · 메짤라 0.5)이 통째로 무효였던 원인 */
    /* ⚠ 예전엔 roam 을 0 아래로 자르지 않아 「음수 roam」(자제 성향)이 통째로 무효였다.
       🛡️ 「현재 위치를 고수」 특성이 여기서 실제로 로밍을 눌러야 한다(제보). */
    hold:   clamp(B.hold   - clamp(FX(a,"roam"),-1.2,1.2)*0.30 + Math.max(0,-FX(a,"roam"))*0.22, 0, 1),
    roam:   clamp(at("fla",55)*0.45 + at("otb",60)*0.35 + clamp(FX(a,"roam"),-1.2,1.2)*0.40, 0, 1),
    /* 🛡️ 자리 고수 강도 — 규율(되당김) 계산이 이 값을 읽는다 */
    stay:   clamp(FX(a,"stayPos"), 0, 1.2)
  };
}
/* 🧭 의도 후보 — 모든 의도는 누구에게나 열려 있다. 성향과 상황이 점수를 정할 뿐이다 (§38).
   보드(board)는 먼저 정한 동료들이 남긴 흔적이다 — 그래서 움직임이 연쇄로 이어진다 (§9). */
function intentCands(a, ctx, board){
  const {phase, ball, dir, ment} = ctx;
  const P=a._mp;
  const mySide = (a.home && Math.abs(a.home.y-0.5)>0.06) ? (a.home.y<0.5?-1:1) : 0;
  const ballSide= ball.y<0.5 ? -1 : 1;
  const onBall = (mySide===0) || (mySide===ballSide);
  const K = phase===ATK_PHASE.BUILD ? {fwd:-0.30, wide:0.28, box:-0.45, drop:0.34}
          : phase===ATK_PHASE.PROG  ? {fwd: 0.18, wide:0.12, box:-0.10, drop:0.06}
          : phase===ATK_PHASE.FINAL ? {fwd: 0.32, wide:0.00, box: 0.28, drop:-0.12}
          :                           {fwd: 0.24, wide:-0.12, box: 0.46, drop:-0.22};
  /* 팀이 얼마나 올라와 있는가 — 뒤에 남는 값어치는 여기에 반비례한다.
     이게 없으면 아무리 상대 진영에 캠프를 쳐도 풀백이 제자리를 지켜 오버랩이 안 나온다. */
  const adv=dir>0?ball.x:1-ball.x;
  const up=clamp((adv-0.45)/0.40, 0, 1);
  const L=[]; const add=(r,s)=>{ if(s>0.04) L.push({r,s}); };
  /* 📮 패스 직후 한 번의 재결정 힌트 — 읽는 즉시 버린다. 가점일 뿐 강제가 아니다:
     전방→침투/지원 성향↑ · 백패스→균형/재전개↑ · 스루→따라 들어가기↑ · 압박 속 패스→자리 비우기↑ */
  let _ppB=null;
  if(a._pp){ _ppB=a._pp; a._pp=null; }
  const bump=(r,v)=>{ if(_ppB && v>0){ const c=L.find(c2=>c2.r===r); if(c) c.s+=v; else L.push({r,s:v}); } };
  /* 🎯 패서 인지 (§16~19) — 패서가 준비되면 침투가 살고(EARLY), 아니면 눌려서
     라인 앞 대기(HOLD)로 남는다. 패서가 풀리는 순간 점수가 뛰며 그때 폭발한다(DELAYED). */
  const pR=(ctx.passerReady!=null?ctx.passerReady:0.5);
  const runMod=(pR-0.45)*0.85;
  /* 🎯 상대 뒷선의 약점 (§30) — 가장 느린 수비수가 느릴수록 뒷공간의 값이 오른다 */
  const cbSlow=ctx.chGap ? clamp((0.62-ctx.chGap.minPace)/0.35, 0, 1) : 0;
  /* 🔗 ST 가 내려가며 앞을 비웠다 — 2선(AM·윙)의 침투가 그 공간을 물려받는다 (§9·§23) */
  const stDrop=(board && board.stDropped && SLOT_BAND[a.slot]!=="FW") ? 0.32 : 0;
  /* 🎭 스트라이커 역할 점검 (제보 — 「스트라이커 역할에 따라 움직임이 변하는지 봐줘」). A/B 실측(특성 중화):
     전진형 포워드(fwd 0.95)와 폴스 나인(fwd 0.25 + deep 1)의 전진 중앙값이 77.6 vs 76.7m — 사실상 같았다.
     역할의 fwd 축이 앵커 이동(9m 게이트)에만 닿고, 실제 위치를 정하는 <b>의도 점수</b>(RUN·CHANNEL vs DEEP·HALF)
     에는 P.depth 로 34%만 희석되어 들어갔다. FW·AM 밴드에 한해 fwd 축을 의도 점수에 직접 얹는다 —
     전진형/포처는 라인에 붙고, 폴스 나인/딥라잉은 내려와 받는다. */
  const _fB=(SLOT_BAND[a.slot]==="FW"||SLOT_BAND[a.slot]==="AM") ? clamp(roleBias(a).fFwd, -1, 1) : 0;
  /* 🏃 늦은 침투 (제보 — 미드필더 역할 감사). 계측: 볼란테 공격 임무 박스 점유 1.1%·슛 0,
     BBM 위치 분포가 CM 공격 임무와 동일(x50 70.9 vs 71.9m). lateRun 은 fwd+0.20 정규화와
     판단 미세 가점뿐이라 박스 도착을 전혀 만들지 못했다. 파이널 서드에서 미드필더에게
     쿨다운 18초·서지 6초로 RUN·INSIDE 가점 — 상시 캠핑이 아니라 「늦게」 한 번씩 도착한다. */
  let _lrB=0;
  {
    const _lrK=clamp(FX(a,"lateRun"),0,1);
    const _bd=SLOT_BAND[a.slot];
    if(_lrK>0.25 && (_bd==="MF"||_bd==="DM") && (phase===ATK_PHASE.FINAL||phase===ATK_PHASE.PEN)){
      const _t=ctx.t||0;
      if(a._lrUntil!=null && _t<a._lrUntil) _lrB=_lrK;
      else if(a._lrCool==null || _t-a._lrCool>18){ a._lrCool=_t; a._lrUntil=_t+6; _lrB=_lrK; }
    } else a._lrUntil=null;
  }
  /* 🎭 엔간체 왜곡 (미드필더 역할 감사 부산물) — roam -0.7·hold 0.6 의 「포켓에 서는 10번」이
     CHANNEL 의도를 85~88% 골랐다. RUN·CHANNEL·THIRD 점수가 roam 을 전혀 안 읽어서
     음수 roam(자리 지킴)이 침투를 하나도 억제하지 못했다. FW 밴드는 제외 — 포처(roam -0.4)의
     박스 침투까지 죽이면 안 된다. */
  const _stay=(SLOT_BAND[a.slot]!=="FW") ? Math.min(0, FX(a,"roam"))*1.35 : 0;   // 0.45→81% · 0.90→71% — 갭 항(1.3)+패서 준비(+0.5)를 이기려면 이만큼
  add(OFF_ROLE.RUN,     P.behind*0.95 + P.depth*0.30 + K.fwd*0.9 + runMod + cbSlow*0.30 + stDrop + _fB*0.40 + _lrB*0.85 + _stay);
  /* 🎯 채널 런 (§7) — 뒷선의 틈이 사람 하나 들어갈 만큼 넓으면 그 틈이 직선 침투보다 낫다.
     크로스가 날아가는 동안은 박스 존 배정(crossZonePoints)이 이미 돌고 있으니 접는다. */
  if(ctx.chGap && !(ball.isCross && ball.state==="PASS")){
    const g=ctx.chGap;
    /* 넓은 틈이면 직선 침투(RUN≈1.47)를 이겨야 한다 — 10m 틈에서 역전되도록 잡았다.
       (실측: 계수 1.05 로는 11.8m 틈에서도 1.37 < 1.47 로 영원히 안 뽑혔다) */
    /* ⚠ 문턱이 낮으면 CHANNEL 이 기본값이 된다(실측: FW 의도의 64%, 평균 틈 15.4m —
       전환 국면의 라인은 생각보다 자주 벌어져 있다). 7.4m 부터 시작해 16m 에서 포화,
       10m 아래에서는 직선 침투(RUN)에게 진다. */
    add(OFF_ROLE.CHANNEL, clamp((g.gap-0.11)/0.13, 0, 1)*1.30
                        + P.behind*0.40 + K.fwd*0.7 + runMod + cbSlow*0.25 + _fB*0.30
                        + clamp(FX(a,"channels"),0,1)*0.40 + _stay);   // 특성: 수비수 사이 침투 선호 · 🎭 fwd 축 · 🎭 자리 지킴
  }
  add(OFF_ROLE.HOLD,    P.box*0.55 + (1-P.drop)*0.25 + K.box*0.5
                      + (SLOT_BAND[a.slot]==="AM" ? clamp(FX(a,"hold"),0,1)*0.50+clamp(FX(a,"pm"),0,1)*0.40 : 0));   // 🎭 10번의 포켓 — 엔간체·플메는 라인이 아니라 라인 사이에 선다
  {
    const myStr=(a.strSkill!=null?a.strSkill:0.55);
    let postK=0, dropCtx=0;
    if(SLOT_BAND[a.slot]==="FW"){
      if(ctx.chGap) postK=clamp((myStr-ctx.chGap.avgStr)*1.1, 0, 0.45)
                        + clamp(FX(a,"aerialTarget"),0,1)*0.22;
      /* 🎯 내려받기의 이유 (§9·§10) — 공이 그쪽에 있어서가 아니다.
         · 수비수가 바짝 붙어 있으면 → 내려가며 그를 「끌고 갈」 수 있다 (공간 창출)
         · 패서의 앞 출구가 막혀 있으면 → 내려가 「연결 고리」가 되어 준다 (링크)
         둘 다 아니면 최전방을 비울 이유가 없다. */
      if(ctx.chGap){
        const tight = (Math.abs(ctx.chGap.l.y-a.y)<0.09 || Math.abs(ctx.chGap.r.y-a.y)<0.09)
                   && Math.abs(a.x-ctx.chGap.line)<0.055;
        if(tight) dropCtx += 0.34;                      // 끌 상대가 붙어 있다
      }
      if(ctx.outletN!=null && ctx.outletN<=1) dropCtx += 0.30;   // 패서가 막혔다 — 연계 필요
      /* 패서가 준비돼 뒷공간이 살아 있는 순간엔 내려가지 않는다 — 침투가 먼저다 */
      dropCtx -= Math.max(0, (ctx.passerReady||0.5)-0.60)*0.55;
    }
    add(OFF_ROLE.DEEP,    P.drop*0.90 + P.support*0.35 + K.drop + postK + dropCtx + Math.max(0,-_fB)*0.70);   // 🎭
  }
  add(OFF_ROLE.HALF,    P.support*0.55 + P.depth*0.40 + (1-P.width)*0.30 + K.fwd*0.5 + Math.max(0,-_fB)*0.35
                      + clamp(FX(a,"halfSpace"),0,1)*0.25);   /* 🎭 메짤라 — 앵커 이동만으론 의도 스팟에 씻겨 폭 +0(실측).
                        ⚠ 0.50 은 HALF 독점 77~79%로 의도 다양성을 죽였고 하프스페이스 체류는 오히려 −5%p(간격 단계가 밀어냄) — 절반으로 */
  /* ⚠ 폭은 「팀이 전진했을 때」 값어치가 커진다 — 상대를 벌려야 중앙이 열린다.
     예전에는 성향(P.width)만 봐서, 팀이 아무리 올라가도 폭을 잡는 사람이 안 늘었다.
     실측 WIDE 7.0% · OVERLAP 2.2% — 폭을 만드는 역할이 열한 명 중 한 명이었다. */
  add(OFF_ROLE.WIDE,    P.width*1.00 + K.wide + up*0.34*(P.width>0.50?1:0.3));
  add(OFF_ROLE.INSIDE,  P.width*0.45 + P.box*0.70 + K.box*0.8 + stDrop*0.7 + _lrB*1.15);   // 🏃 늦은 침투 (0.75 로는 HALF 에 밀려 10.6%)
  /* 🔁 윙어–풀백 콤보 (요청 · 오버랩 강화의 반쪽). 실측(빌드 0230): 풀백 오버랩 점유 15% 인데
     「윙어를 추월」은 1% — 윙어가 멈추거나 안으로 접는 시간이 10~12%, INSIDE 의도 1% 라
     트리의 첫 노드 「윙어가 폭 유지? → 아니오/안쪽 이동」이 거의 참이 안 됐다.
     ─ 같은 쪽 풀백이 뒤에 붙어 있거나(SUPPORT, 뒤 18m 안·터치라인 쪽) 오버랩·언더랩 중이면 윙어는
       안으로 접어(INSIDE) 바깥을 비운다. 볼 쪽·상대 진영에서만. 풀백은 윙어 뒤 순서(BAND_ORD)로
       판단하므로 직전 틱의 offRole 과 현재 위치를 읽는다. */
  a._comboIn=0;
  if(mySide!==0 && onBall && up>0.25 && a.home && Math.abs(a.home.y-0.5)>0.10 &&
     (SLOT_BAND[a.slot]==="FW"||SLOT_BAND[a.slot]==="AM"||SLOT_BAND[a.slot]==="MF")){
    const _adv2=p=>dir>0?p.x:1-p.x;
    let fbNear=0;
    for(const m of (ctx.mates||[])){
      if(m===a || !(m.slot==="LB"||m.slot==="RB"||m.slot==="LWB"||m.slot==="RWB") || !m.home) continue;
      if((m.home.y<0.5?-1:1)!==mySide) continue;
      const da=_adv2(m)-_adv2(a);
      if(m.offRole===OFF_ROLE.OVERLAP || m.offRole===OFF_ROLE.UNDERLAP) fbNear=Math.max(fbNear, 1);
      else if(da>-0.16 && da<0.03 && Math.abs(m.y-0.5)>0.25) fbNear=Math.max(fbNear, 0.7);
    }
    if(fbNear>0){
      const _adj=(r,v)=>{ const c=L.find(x=>x.r===r); if(c) c.s+=v; else if(v>0.04) L.push({r,s:v}); };
      _adj(OFF_ROLE.INSIDE, WING_COMBO_IN*fbNear);
      _adj(OFF_ROLE.WIDE,  -WING_COMBO_WIDE*fbNear);
      a._comboIn=fbNear;
    }
  }
  /* 🏗️ 후방 빌드업 — 볼이 우리 진영에 있고 내가 뒷선이면, 짧은 패스 길을 내주는 게 최우선이다.
     ⚠ 실측에서 이 역할이 <b>전체의 32.1%</b> 를 먹고 있었다. 열한 명 중 셋이 늘 볼 쪽으로
        받으러 내려와 있는 셈이다. 그 결과 공격이 중앙에 몰렸다 —
        터치라인 두 레인의 점유율이 합쳐서 20% 뿐이고(가운데 세 레인이 77%),
        볼보다 앞선 선수 6.3명이 20칸 중 4.4칸만 쓰며 그중 1.9명이 남의 칸에 겹쳐 있었다.
     원인은 점수 규모다 — OUTLET 은 최대 2.05점인데 폭을 만드는 WIDE 는 최대 1.0점 남짓이라
        볼이 우리 진영에 있는 동안 <b>폭이 이길 방법이 없었다</b>.
     ⚠ 없애면 안 된다. 이 역할을 볼 기준으로 상시화했을 때의 실측 기록이 남아 있다 —
        「백패스 85→56 · 슛 102→131 · 골 10→18」. 값어치는 분명하다.
     ─ 자격을 좁히고(뒷선 위주), 점수를 <b>볼이 얼마나 깊은가</b>에 비례시킨다.
       자기 골문 앞에서는 예전만큼 강하고, 중원으로 나오면 빠르게 약해진다. */
  {
    const bOwn = (dir>0 ? ball.x : 1-ball.x);
    if(bOwn<0.34 && P.depth<0.45){
      const deepK = clamp((0.34-bOwn)/0.34, 0, 1);      // 골문 앞 1.0 → 중원 경계 0
      add(OFF_ROLE.OUTLET, 0.42 + deepK*0.95 + (1-P.depth)*0.55 + P.support*0.30 - K.fwd*0.4);
    }
  }
  /* 🙋 동료가 갇혔다 — 가까이 있는 선수가 받아 주러 나간다 (§16) */
  if(ctx.stuck && ctx.carrier){
    const d=HYP((ctx.carrier.x-a.x)*PITCH_AR, ctx.carrier.y-a.y);
    if(d>0.05 && d<0.32)
      add(OFF_ROLE.SHOW, 0.85 + clamp(1-d/0.32, 0, 1)*0.75 + P.support*0.40);
  }
  add(OFF_ROLE.BALANCE, P.hold*0.85 + (1-P.depth)*0.45 - K.fwd*0.5
      - up*0.34*(P.width>0.58 && onBall ? 1 : 0.28));      // 측면 수비는 팀이 올라가면 뒤에 남을 이유가 준다
  add(OFF_ROLE.VACATE,  P.box*0.42 + P.roam*0.40 + K.box*0.3);
  add(OFF_ROLE.THIRD,   P.behind*0.45 + P.roam*0.45 + K.fwd*0.6 + runMod*0.6 + stDrop*0.8 + _fB*0.22 + _stay);   // 🎭
  {
    const ballWide=Math.abs(ball.y-0.5)>0.20, adv=dir>0?ball.x:1-ball.x;
    /* ⚠ 실측 0.2% — 사실상 나오지 않는 역할이었다. 반대편 윙이 뒷문으로 들어가는 그림이 없었다.
       최종 3분의 1 조건(0.66)이 빡빡했고 가점도 작아 CHANNEL·HALF 에 늘 밀렸다. */
    add(OFF_ROLE.FARPOST, P.box*0.72*(onBall?0.14:1) + K.box*0.7
        + ((!onBall && ballWide && adv>0.58) ? 0.85 : 0));   // 반대편에서 크로스가 올라온다
  }
  /* 오버랩·언더랩은 「내 앞의 동료가 무엇을 하고 있는가」에 달렸다 (§14·§15·§9).
     윙어가 폭을 잡아 주면 안쪽이 열리고, 윙어가 접어 들어가면 바깥이 통째로 빈다. */
  /* ⚠ 폭 성향만으로 문을 열면 인버티드 풀백(전진 높음·폭 낮음)이 아예 못 들어와
     언더랩이 0%가 된다. 측면에 서는 선수라면 「폭이 넓거나, 전진 성향이 있거나」로 연다. */
  /* 🔁 오버랩·언더랩은 풀백·윙백의 달리기다 — 윙어는 WIDE·RUN·CHANNEL·INSIDE 로 같은 공간을 쓴다.
     ⚠ 실측(빌드 0330): 볼 쪽 윙어의 의도가 OVERLAP 51%·UNDERLAP 24% 였다. 게이트가 「측면에 서는 선수」라
        윙어도 자기 자신을 추월하는 오버랩을 골랐고, 관계 가점(outsideRel·flankSpace)까지 받아 터치라인을
        끝까지 달렸다. 그래서 윙어가 멈추거나 접는 시간이 안 나왔다 — 콤보의 반쪽이 여기서 막혀 있었다. */
  const _isFBslot=(a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB");
  /* ↔️ 3백 2차 ③ — 와이드 센터백의 드라이브 (WIDE3_MIN 주석). 전진 성향이 실려 있어야(와이드 센터백/공격·지원,
     역할 미배정 CD 는 0) 후보가 되고, 점수도 풀백보다 낮게(×0.68) 잡아 「가끔 나오는」 무기로 둔다. */
  const _cb3lap=(a.slot==="LCB"||a.slot==="RCB") && (ctx.mates||[]).some(m=>m.slot==="CB") && clamp(roleBias(a).fFwd,0,1.5)>0.18;
  if((_isFBslot || _cb3lap) && mySide!==0 && ment>=1 && (P.width>0.58 || clamp(roleBias(a).fFwd,0,1.5)>0.22)){
    const ahead=board.wing[mySide];                    // 내 쪽 측면 동료가 고른 의도
    /* 🔁 오버랩을 「관계」로 읽는다 (외부 제안·요청: 윙어 위치 → 이동 방향 → 측면 공간 → 상대 풀백 → 후방 커버).
       ⚠ 실측(seed 2, 상대 진영 공격 중 풀백 틱): OVERLAP·UNDERLAP 점유 <b>0%</b>, 같은 쪽 윙어보다 앞인 시간 5%.
          outsideFree 가 「윙어가 INSIDE <b>의도</b>를 골랐을 때」만 켜졌는데 그 의도는 전체의 1% 였다 —
          윙어가 실제로 안쪽에 서 있어도 이름표가 다르면 바깥이 빈 걸 못 봤다. 작성자가 뒷문(잔여 수비)이
          없던 시절 일부러 눌러 둔 값이기도 하다("결정률 25%"). 이제 10c·10d·fbRisk 가 뒷문을 지킨다.
       ─ 윙어의 실제 위치(안쪽 0.20 안)·이동 방향(중앙 쪽)·볼을 잡고 접는 중 → 바깥 공간.
         내 앞 3~33m 측면에 상대(대개 상대 풀백)가 없으면 공간, 15m 안에 있으면 막힘. 후방 커버는 fbRisk 가 이미 감점한다. */
    const _matesL=ctx.mates||[], _oppsL=ctx.opps||[];
    const _advF=p=>dir>0?p.x:1-p.x;
    let _w=null, _wBest=-1;
    for(const m of _matesL){
      if(m===a || m.slot==="GK" || !m.home) continue;
      const bd2=SLOT_BAND[m.slot];
      /* ↔️ 3백 2차 ③ — 좌우 CB 의 「내 쪽 폭 담당」은 윙백이다. 윙백(WB 밴드)을 못 보면 관계 항이 전부 0 이라
         후보 가점이 한 번도 안 붙었다(실측 0%). CB 후보일 때만 윙백도 관계 대상으로 본다. */
      if(bd2!=="FW" && bd2!=="AM" && bd2!=="MF" && !(_cb3lap && bd2==="WB")) continue;
      if(Math.abs(m.home.y-0.5)<0.10) continue;                 // 중앙 선수는 윙어가 아니다
      if((m.home.y<0.5?-1:1)!==mySide) continue;
      const sc2=_advF(m); if(sc2>_wBest){ _wBest=sc2; _w=m; }
    }
    let outsideRel=0, insideRel=0, flankSpace=1, oppFBBlock=0;
    if(_w){
      const wIn=Math.abs(_w.y-0.5)<0.20 ? 1 : 0;
      const wMovIn=(vSy(_w)*mySide)<-0.0015 ? 1 : 0;            // 중앙 쪽으로 움직인다
      const wCut=(ctx.carrier===_w && wIn) ? 1 : 0;              // 볼을 잡고 안으로 접는 중
      outsideRel=clamp(wIn*0.70 + wMovIn*0.40 + wCut*0.40, 0, 1);
      insideRel=(!wIn && Math.abs(_w.y-0.5)>0.28) ? 1 : 0;       // 윙어가 터치라인을 잡고 있다 → 안쪽
    }
    for(const o of _oppsL){
      if(o.slot==="GK") continue;
      if((o.y-0.5)*mySide<0.22) continue;
      const da=_advF(o)-_advF(a);
      if(da>0.03 && da<0.30){ flankSpace=0; if(da<0.14) oppFBBlock=1; break; }
    }
    a._lapWing=_w;
    const outsideFree = (ahead===OFF_ROLE.INSIDE) || outsideRel>0.5;   // 윙어가 안으로 접었다 → 바깥이 빈다
    const insideFree  = (ahead===OFF_ROLE.WIDE) || insideRel>0;        // 윙어가 폭을 잡았다 → 안쪽이 열린다
    /* ⚠ 이 값을 키우면 풀백이 시원하게 올라가지만 뒷문이 함께 열린다.
       실측: 0.30+0.34 로 두니 슛은 줄고 결정률이 25%까지 뛰었다(기회가 너무 좋아진다). */
    /* 🔀 역할 조합 — 더하기가 아니라 곱하기다 (§9).
       fwd 와 wide 가 「둘 다」 높아야 공격적 윙백이 되고, 어느 하나만 높으면 그렇지 않다.
       반대로 전진 성향이 높은데 폭 성향이 낮으면 안쪽으로 올라가는 인버티드 풀백이다. */
    const _RB=roleBias(a);
    const cF=clamp(_RB.fFwd, 0, 1.5), cW=clamp(_RB.fWide, 0, 1.5);
    /* 🧩 풀백 역할 점검 (제보 — 「역할에 따라 전진도가 차이 나는지 봐줘」). A/B 실측(4-3-3, 특성 중화):
       풀백 수비/지원/공격 임무의 오버랩 점유가 24 / 21 / 23% — 임무와 무관하게 똑같이 달렸다. 점수 항에
       전진 성향 곱이 없던 것. 전체 점수에 임무 배수를 곱한다: 수비 0.62 · 지원 0.74 · 공격 0.88 · 윙백 공격 1.05. */
    /* ⚠ 보정 기록: 1차 0.62+0.62cF — 공격 임무까지 23→6% 로 죽음. 2차 0.84+0.50cF — 수비 임무가 13~21% 로 여전히
       공격 임무급. 점수가 승부선(±10%) 근처라 배수에 극도로 민감하다. 수비 임무를 확실히 낮추는 기울기로. */
    const _lapDutyK=clamp(0.55+cF*1.2, 0.55, 1.25);
    const comboOut = cF*cW;                       // 전진 × 폭 → 바깥으로 치고 올라간다
    const comboIn  = cF*clamp(1-cW, 0, 1.5);      // 전진 × 좁음 → 안쪽 하프스페이스로
    const push=up*(0.16+(ment-1)*0.20);
    /* ⚠ 밀어 올리는 값도 「내 쪽에 공이 있을 때」만이다.
       이걸 밖에 두면 반대쪽 풀백까지 같이 올라가 뒷문이 통째로 열린다. */
    const sideK = onBall ? 1 : 0.18;
    const _wbK=(a.slot==="LWB"||a.slot==="RWB") ? 1.5 : _cb3lap ? 0.68 : 1;   // 윙백은 훨씬 적극적 · ↔️ CB 는 드물게
    /* ↔️ ⚠ 1차: 가중 ×0.68 만으로는 실측 점유 0% — 와이드 센터백은 P.width 가 높아 comboIn 이 죽고 comboOut 도
       작아 BALANCE 를 한 번도 못 이겼다. 조건(안/밖이 열림)이 성립할 때만 기본 가점을 얹는다. */
    /* ↔️ ⚠ 2차: 0.75 로 두자 시드에 따라 0% ↔ 22%(과다) — 조건이 맞는 경기에서는 유지 가점(LAP_HOLD)과 맞물려
       상시 드라이브가 됐다. 스펠이 끝나면 18초 쿨다운 — 「가끔 나오는」 무기로 고정. */
    const _cb3Base=(_cb3lap && (phase===ATK_PHASE.PROG||phase===ATK_PHASE.FINAL)
                    && !(ctx.t!=null && a._cb3Cool && ctx.t<a._cb3Cool)) ? 0.75 : 0;   // 전진 국면에서만
    /* 🔁 오버랩은 「달리기」다 — 한 번 나가면 끝까지 간다. 실측(빌드 0230): 오버랩 스펠 571회/경기,
       중앙값 0.8초, 스펠당 전진 2.5m. 최소 유지 0.55초(SW_DWELL)로는 매 틱 BALANCE 와 오가며 목표
       스무딩(16%/틱)이 따라잡기도 전에 끝났다. 시작 후 LAP_HOLD 동안은 그 의도가 크게 우세하다. */
    const _lapNow=(a.offRole===OFF_ROLE.OVERLAP||a.offRole===OFF_ROLE.UNDERLAP) && (ctx.t!=null) && (ctx.t-(a._intentAt||0))<LAP_HOLD;
    const _lapKeep=_lapNow ? 0.60 : 0;
    add(OFF_ROLE.OVERLAP,  ((P.width*0.70+P.depth*0.55) + push + comboOut*0.42*_wbK + (outsideFree?_cb3Base:0)
                          + (outsideFree?0.55:0) + (insideFree?0.22:0)
                          + outsideRel*0.45 + flankSpace*0.30 - oppFBBlock*0.35)*sideK*_lapDutyK + K.fwd*0.5
                          + (a.offRole===OFF_ROLE.OVERLAP?_lapKeep:0));
    add(OFF_ROLE.UNDERLAP, ((P.depth*0.60+(1-P.width)*0.35) + push*0.8 + comboIn*0.50*_wbK + (insideFree?_cb3Base:0)
                          + (insideFree?0.48:0) + insideRel*0.30 - oppFBBlock*0.15)*sideK*_lapDutyK + K.fwd*0.45
                          + (a.offRole===OFF_ROLE.UNDERLAP?_lapKeep:0));
  }
  /* 🏛️ 구조 감쇠 + 풀백 리스크 (§7·19·32) — 확장 의도(침투·오버랩류)에만 적용.
     지원·정지·복귀·폭 유지 의도는 건드리지 않는다 — 구조가 낮을수록 그쪽이 자연히 이긴다. */
  {
    /* 게이트 0.34 — 실측 정상 작동점이 평균 0.45(역할·의도가 홈에서 당겨가는 만큼)라
       0.62로 걸면 상시 감쇠가 된다. 하위 구간(진짜 벌어진 순간)에만 문턱을 올린다. */
    const lowI=(ctx.integ!=null && ctx.integ<0.34 && !ctx.risk) ? (0.34-ctx.integ)*1.5 : 0;
    const isFB=(a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB");
    const fbPen=(isFB && ctx.fbHighId && ctx.fbHighId!==a.id) ? 0.30 : 0;
    if(lowI>0 || fbPen>0){
      for(const c of L){
        const r=c.r;
        if(r===OFF_ROLE.RUN||r===OFF_ROLE.THIRD||r===OFF_ROLE.CHANNEL||
           r===OFF_ROLE.OVERLAP||r===OFF_ROLE.UNDERLAP||r===OFF_ROLE.FARPOST){
          c.s -= lowI;
          if(fbPen && (r===OFF_ROLE.OVERLAP||r===OFF_ROLE.UNDERLAP||r===OFF_ROLE.RUN)) c.s -= fbPen;
        }
      }
    }
  }
  if(_ppB){
    const otb2=(a.offTiming!=null?a.offTiming:0.6), tea2=(a.teamSkill!=null?a.teamSkill:0.55);
    if(_ppB.thru)      bump(OFF_ROLE.RUN, 0.22+otb2*0.20);
    else if(_ppB.fwd){ bump(OFF_ROLE.RUN, 0.08+otb2*0.12); bump(OFF_ROLE.HALF, 0.10);
                       bump(OFF_ROLE.THIRD, 0.10+tea2*0.12); }
    else if(_ppB.back){ bump(OFF_ROLE.BALANCE, 0.16); bump(OFF_ROLE.DEEP, 0.10+tea2*0.10); }
    else               bump(OFF_ROLE.WIDE, 0.08);
    if(_ppB.press>0.55){ bump(OFF_ROLE.VACATE, 0.14); bump(OFF_ROLE.WIDE, 0.10); }
  }
  return L;
}
/* 공간을 거칠게 칸으로 나눈다 — 두 선수가 같은 칸을 노리는 걸 막는 데 쓴다 (§5·§7) */
/* 🧭 소유 국면 리시 반경 — 그 역할이 앵커에서 얼마나 멀어져도 되는가.
   ⚠ 이 값을 이동 루프와 조율 층이 <b>같이 써야 한다</b>. 따로 두면
      「의도 공간」과 「앵커 공간」이 화해하지 않는다(아래 reachSpot 주석 참고). */
function attLeash(role, tPress){
  const base = role===OFF_ROLE.OVERLAP ? 0.62      // 풀백이 윙어를 추월할 만큼
             : role===OFF_ROLE.INSIDE  ? 0.52      // 컷인은 측면에서 골문 앞까지 가는 큰 움직임
             : role===OFF_ROLE.RUN     ? 0.42
             : role===OFF_ROLE.HALF    ? 0.28
             : 0.20;
  return base + ((tPress==null?1:tPress)-1)*0.05;
}
/* 🧭 「실현 가능한 자리」로 접는다 ────────────────────────────────────────
   ⚠ 오늘 이 영역에서 세 번 시도해 세 번 다 칸 중복이 안 움직였다(계수·대형·리시 완화).
      원인을 재 보니 하나였다:
        · 칸 중복 <b>의도 2.19명 vs 실제 2.32명</b> — 겹침이 이미 의도 단계에 있다
        · 그런데 선수는 자기 목표에서 평균 <b>26.6m</b> 떨어져 있다
      roleAnchorXY 가 내는 좌표는 상대 오프사이드 라인·볼 기준이라 40m 밖일 수 있고,
      이동 파이프라인 9단계(규율)가 그걸 앵커 반경 안으로 도로 접는다.
      즉 <b>조율 층은 「의도 공간」에서 계산하는데 파이프라인은 「앵커 공간」으로 접는다.</b>
      그러니 계수를 아무리 올려도 <b>실현되지 않을 자리들끼리 떼어놓는</b> 셈이었다.
   ─ 조율에 쓸 좌표를 이동 루프와 <b>같은 자</b>로 한 번 접어서 본다.
     그러면 「갈 수 있는 곳」에서 겹침을 보게 되고, 선점·레인 제한이 비로소 뜻을 갖는다. */
function reachSpot(a, want, ball, dir, role, tPress){
  /* ⚡ 참조판으로 읽고 좌표는 지역 변수로 옮긴다 — 캐시 객체는 절대 고치지 않는다 */
  const an=tacticalAnchorRef(a.team, a.slot, "ATT", a.isHome);
  const anx=clamp01(an.x + (ball.x-0.5)*0.38 + dir*0.11);   // blockShift + 소유 시 dirBias
  const any=an.y;
  const lz=attLeash(role, tPress);
  const dx=(want.x-anx)*PITCH_AR, dy=want.y-any;
  const d=HYP(dx,dy);
  if(d<=lz || d<1e-6) return want;
  return {x:clamp01(anx + dx/d*lz/PITCH_AR), y:clamp01(any + dy/d*lz)};
}
/* 세로 레인만 — 「같은 길로 둘이 뛰는가」를 보는 데 쓴다 (zoneKey 의 레인 경계와 같다) */
function laneOf(p){ return p.y<0.26?0 : p.y<0.42?1 : p.y<0.58?2 : p.y<0.74?3 : 4; }
function zoneKey(p, dir){
  const adv = dir>0 ? p.x : 1-p.x;
  const band = adv>0.80?3 : adv>0.62?2 : adv>0.40?1 : 0;
  const lane = p.y<0.26?0 : p.y<0.42?1 : p.y<0.58?2 : p.y<0.74?3 : 4;
  return band*5+lane;
}
/* 소유 팀의 역할 분담 — 슬롯이 후보를 정하고, 상황이 점수를 정한다.
   같은 공간을 두 명이 노리지 않게 하고, 공을 가진 선수 주변에 지원 옵션을 남긴다. */
function assignOffRoles(mine, t, ball, dir, ment, opps, carrier, tPress){
  const out=mine.filter(a=>a.slot!=="GK");
  ball=ball||{x:0.5,y:0.5}; dir=dir||1; ment=(ment===undefined?1:ment);
  opps=opps||[];
  const phase=attackPhase(ball, dir, opps, carrier);
  const lineX=oppLineX(opps, dir);
  /* 역습 위험 — 우리 최종 라인보다 뒤에 남아 있는 상대가 몇이나 되는가 */
  let counterRisk=0;
  {
    const myLine=oppLineX(out, -dir);          // 우리 최후방
    let back=0;
    for(const o of opps){
      if(o.slot==="GK") continue;
      const behind = dir>0 ? (o.x < myLine+0.06) : (o.x > myLine-0.06);
      if(behind) back++;
    }
    counterRisk = clamp(back*0.30, 0, 1.2);
  }
  /* 🏛️ FORMATION INTEGRITY (§7) — 팀이 앵커(홈 포지션) 대비 얼마나 벌어져 있는가. 1=완벽한 구조.
     낮을수록 「추가」 확장 움직임을 억제한다 — 이미 벌어진 구조 위에 또 이탈을 얹지 않는다.
     포메이션은 제약이 아니라 기준틀(§49): 좌표를 되돌리는 게 아니라 다음 이탈의 문턱만 올린다.
     예외(§32) — 페널티 국면·초공격 멘탈리티는 위험을 감수한다. */
  let integ=1, fbHighId=0;
  {
    /* ⚠ 절대 좌표(a.home) 대비로 재면 팀 전체가 함께 전진한 것도 「이탈」로 잡혀
       무결성이 상시 0.2로 붕괴 판정됐다(실측). §4 — 포메이션은 위치가 아니라 관계다:
       팀 중심(centroid) 기준 상대 배치를 홈 상대 배치와 비교한다. 평행이동 불변. */
    let cx=0, cy=0, hx=0, hy=0, n2=0;
    for(const a2 of out){ if(!a2.home) continue;
      cx+=a2.x; cy+=a2.y; hx+=a2.home.x; hy+=a2.home.y; n2++; }
    if(n2){
      cx/=n2; cy/=n2; hx/=n2; hy/=n2;
      let s2=0;
      for(const a2 of out){
        if(!a2.home) continue;
        const dx2=((a2.x-cx)-(a2.home.x-hx))*PITCH_AR, dy2=(a2.y-cy)-(a2.home.y-hy);
        s2+=Math.min(1, HYP(dx2,dy2)/0.20);
      }
      integ=1-(s2/n2)*0.9;
    }
    /* §19 풀백 리스크 밸런스 — 한쪽 풀백이 이미 높이 올라갔으면 반대쪽은 자제한다 */
    for(const a2 of out){
      if(a2.slot!=="LB"&&a2.slot!=="RB"&&a2.slot!=="LWB"&&a2.slot!=="RWB") continue;
      if((dir>0?a2.x:1-a2.x)>0.55){ fbHighId=a2.id; break; }
    }
    for(const a2 of out) a2._integ=integ;   // 디버그·리포트 노출용
  }
  /* 🆘 갇힘 판정 — 볼 가진 동료에게 「닿고, 길이 열리고, 눌리지 않은」 출구가 몇이나 되는가.
     하나도 없으면 걷어내기밖에 안 남는다. 그때 동료가 받아 주러 나간다. */
  let outletN=0;
  if(carrier){
    for(const m of out){
      if(m===carrier) continue;
      const d=HYP((m.x-carrier.x)*PITCH_AR, m.y-carrier.y);
      if(d<0.045 || d>0.30) continue;
      if(laneBlocked(carrier, m, opps) > 0.45) continue;
      if(pressureOn(m, opps, 1) > 0.75) continue;
      outletN++;
    }
  }
  /* 🚫 비활성 — 「갇히면 동료가 받아 주러 나온다」를 세 번 시도했고 세 번 다 나빠졌다.
     ① 상시 OUTLET 을 볼 기준으로:  백패스 85→56 · 슛 102→131 · 골 10→18
     ② SHOW (출구 1개 이하):        패스 251→206 · 걷어내기 45→58.5 · 성공률 76→72.7%
     ③ SHOW (출구 0개, 한 명만):    패스 251→200 · 슛 15.8→17.5 · 골 2.75→5.0
     공통 원인은 같다 — 공 쪽으로 나오면 그 순간 다른 자리가 비고, 패스 길은 오히려 좁아진다.
     올바른 형태는 「자기 구역을 지키면서 옆으로 한 발 움직여 길을 여는 것」인데,
     그건 좌표 이동이 아니라 각도 조정이라 별도 설계가 필요하다.
     구조는 남겨 두었으니 stuck 판정만 되살리면 다시 켤 수 있다. */
  const stuck = false;
  void outletN;
  const chGap=backLineGaps(opps, dir);                 // 🎯 뒷선의 틈 — 팀당 1회
  /* 🎯 패서 상태 (§16·§17) — 캐리어가 자유롭고 전방을 보고 있어야 침투가 산다.
     등지고 압박받는 패서 앞에서 뛰어 봐야 공은 안 나온다 — 그때는 라인에서 기다린다. */
  let passerReady=0.5;
  if(carrier && carrier.slot!=="GK"){
    const pr=pressureOn(carrier, opps, 1);
    let faceFwd=0.5;
    if(carrier.face!==undefined){
      faceFwd=clamp(Math.cos(carrier.face)*dir*0.5+0.5, 0, 1);   // 1=전방, 0=자기 골문
    }
    passerReady=clamp(1-pr/0.95, 0, 1)*(0.35+faceFwd*0.65);
  }
  const ctx={phase, ball, dir, ment, carrier, counterRisk, stuck, outletN, chGap, passerReady,
             integ, fbHighId, risk:(phase===ATK_PHASE.PEN || ment>=1.5)?1:0,
             mates:out, opps, t};               // 🔁 오버랩 관계 판정용 (윙어 위치·상대 풀백) · t 는 유지 판정
  /* 지원 구조 — 공 주변에 앞·옆·뒤 옵션이 있는가 (§11) */
  let fwdOpt=0, backOpt=0;
  for(const m of out){
    if(carrier && m.id===carrier.id) continue;
    const d=HYP((m.x-ball.x)*PITCH_AR, m.y-ball.y);
    if(d>0.26) continue;
    if((m.x-ball.x)*dir>0.01) fwdOpt++; else backOpt++;
  }
  /* 📋 보드 — 먼저 정한 동료가 남기는 흔적. 이게 있어야 움직임이 연쇄가 된다.
     "ST가 수비수를 끌고 빠졌다 → 그 자리가 비었다 → AMC가 그리로 침투한다" 가
     각자의 스크립트가 아니라 하나의 시스템에서 나온다. */
  /* 🔗 ⚠ 재설계 — 예전 board.claims 는 「같은 격자 칸(zoneKey)을 먼저 찜한 사람이 있으면 감점」이었다.
     측정으로 무력함이 확인됐다: 이 감점을 <b>0 으로 꺼도</b> 밀도가 안 변했다
     (8m 내 동료 있음 34.1% → 34.3%). 격자는 축구의 단위가 아니다 —
     둘이 같은 칸에 서는 것 자체는 문제가 아니고(박스·코너에서는 정상이다).
     진짜 겹침은 두 가지다:
       ① 둘이 <b>같은 수비수 하나</b>에게 잡힌다 — 위협이 둘이 아니라 하나가 된다
       ② 볼에서 본 <b>각과 거리가 같다</b> — 패서 입장에서 두 번째 사람은 새 선택지가 아니다
     pinned = 상대 수비수 id → 그를 묶어 둔 동료 id · aim = 이미 잡힌 패스 각·거리 */
  const board={ pinned:new Map(), aim:[], freed:[], wing:{"-1":null,"1":null}, runners:0, deep:0,
                width:{"-1":null,"1":null}, runLane:{} };
  /* 내가 가려는 자리를 책임지는 상대 — 그 자리에서 가장 가까운 수비수 (11m 안) */
  const pinOf=(sp)=>{
    let p=null, pd=0.16;
    for(const o of opps){
      if(o.slot==="GK") continue;
      const d=HYP((o.x-sp.x)*PITCH_AR, o.y-sp.y);
      if(d<pd){ pd=d; p=o; }
    }
    return p;
  };
  /* 🧱 폭 배정 — 점수를 매기기 <b>전에</b> 「이번 국면에 폭을 잡을 두 명」을 고정한다.
     ⚠ 왜 경합으로는 안 되는가 — 지금 구조는 매 틱 열다섯 역할이 점수로 겨루는 경매다.
        실측에서 WIDE 가 <b>0.9명/팀</b> 밖에 안 나왔고, OUTLET 점수를 깎아 9% 로 올려도
        빠진 몫이 DEEP·BALANCE 로 갔지 폭으로 오지 않았다. 바깥 레인 점유율은 그대로였다.
        현대 축구에서 폭은 경매 대상이 아니라 <b>구조적 배정</b>이다 —
        「소유 중에는 양쪽이 폭을 잡는다」가 먼저 정해지고 나머지가 그 안에서 움직인다.
     ─ 좌우 한 명씩 지명한다. 지명자는 WIDE·OVERLAP 이 크게 유리하고, 같은 쪽의 다른 사람은
       불리해진다(둘이 같은 터치라인에 서지 않게).
     ⚠ 볼이 우리 진영 깊은 곳이면 배정하지 않는다 — 그때는 폭보다 짧은 패스 길(OUTLET)이 먼저다. */
  {
    const bOwn0 = dir>0 ? ball.x : 1-ball.x;
    if(bOwn0>0.30){
      for(const sd of [-1,1]){
        let bestW=null, bw=-1;
        for(const a of out){
          const hy=a.home?a.home.y:a.y;
          if(Math.abs(hy-0.5)<0.10) continue;               // 중앙 선수는 폭을 잡지 않는다
          if((hy<0.5?-1:1)!==sd) continue;
          const bd=SLOT_BAND[a.slot]||"MF";
          if(bd==="DF"||bd==="SW") continue;                // 센터백 제외 (풀백·윙백은 포함)
          if(!a._mp || a._mpSlot!==a.slot){ a._mp=movementProfile(a); a._mpSlot=a.slot; }
          const w=(a._mp && a._mp.width!=null) ? a._mp.width : 0.5;
          const sw=w*1.00 + clamp(roleBias(a).fWide, 0, 1.5)*0.50
                 + (bd==="FW"||bd==="AM" ? 0.45 : bd==="MF" ? 0.30 : 0.10)
                 + Math.abs(hy-0.5)*0.80;
          if(sw>bw){ bw=sw; bestW=a; }
        }
        if(bestW) board.width[sd]=bestW.id;
      }
    }
  }
  /* 앞선부터 정한다 — 앞이 정해져야 뒤가 그걸 보고 맞출 수 있다 */
  const BAND_ORD={FW:0, AM:1, MF:2, DM:3, WB:4, DF:5, SW:6};
  const order=[...out].sort((p,q)=>
    (BAND_ORD[SLOT_BAND[p.slot]]===undefined?3:BAND_ORD[SLOT_BAND[p.slot]])
   -(BAND_ORD[SLOT_BAND[q.slot]]===undefined?3:BAND_ORD[SLOT_BAND[q.slot]]));
  for(const a of order){
    if(!a._mp || a._mpSlot!==a.slot){ a._mp=movementProfile(a); a._mpSlot=a.slot; }
    /* 🏃 풀백 위험 — 트리의 「뒤 공간 위험」 노드. 높으면 HOLD(BALANCE), 낮으면 OVERLAP/ADVANCE 가 이긴다 (fbRisk 주석) */
    const _isFBa=(a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB");
    const _isWBa=(a.slot==="LWB"||a.slot==="RWB");
    if(_isFBa) a._fbBall=ball.x;                       // 🔁 fbRisk 의 「WM 이 볼 뒤인가」 판정용
    const _fbRk=_isFBa ? fbRisk(a, out, opps, dir) : 0;
    const cands=intentCands(a, ctx, board);
    const dec=(a.decSkill!=null?a.decSkill:0.55);
    const otb=(a.offTiming!=null?a.offTiming:0.6);
    const tw =(a.teamSkill!=null?a.teamSkill:0.55);
    let best=null;
    for(const c of cands){
      let s=c.s;
      /* 🚨 역습 위험 — 우리 뒤에 상대가 남아 있으면, 전진 성향이 높아도 나가지 않는다 (§10) */
      if(ctx.counterRisk>0.45 &&
         (c.r===OFF_ROLE.RUN||c.r===OFF_ROLE.THIRD||c.r===OFF_ROLE.OVERLAP||
          c.r===OFF_ROLE.UNDERLAP||c.r===OFF_ROLE.FARPOST||c.r===OFF_ROLE.CHANNEL))
        s -= (ctx.counterRisk-0.45)*1.30*(1-(a._mp?a._mp.depth:0.5)*0.45);   // 원래 앞선인 선수는 덜 눌린다
      if(_isFBa && _fbRk>0){
        if(c.r===OFF_ROLE.RUN||c.r===OFF_ROLE.THIRD||c.r===OFF_ROLE.OVERLAP||
           c.r===OFF_ROLE.UNDERLAP||c.r===OFF_ROLE.FARPOST||c.r===OFF_ROLE.CHANNEL)
          s -= _fbRk*FB_RISK_PEN*(_isWBa?0.5:1);
        if(c.r===OFF_ROLE.BALANCE) s += _fbRk*0.30;
      }
      if(fwdOpt<1 && (c.r===OFF_ROLE.RUN||c.r===OFF_ROLE.HALF||c.r===OFF_ROLE.THIRD)) s+=0.26*tw;
      if(backOpt<1 && (c.r===OFF_ROLE.DEEP||c.r===OFF_ROLE.BALANCE))                  s+=0.30*tw;
      if(c.r===OFF_ROLE.THIRD && fwdOpt>=1) s += 0.42 + 0.20*tw;
      if(c.r===OFF_ROLE.VACATE){
        if(board.runners>=1) s += 0.40*tw;
        if(phase===ATK_PHASE.PEN||phase===ATK_PHASE.FINAL) s += 0.22;
      }
      /* 🏃 늦은 침투 서지 중엔 러너 정원(2명) 감점을 면제 — 후방에서 뒤늦게 도착하는 제3의 러너가
         이 캡의 취지이지 억제 대상이 아니다 (디버그: 서지 중 RUN 3.4%·HALF 49% — 캡에 눌렸다) */
      if((c.r===OFF_ROLE.RUN||c.r===OFF_ROLE.THIRD||c.r===OFF_ROLE.FARPOST||c.r===OFF_ROLE.CHANNEL) && board.runners>=2
         && !(a._lrUntil!=null && (ctx.t||0)<a._lrUntil)) s-=0.85;
      if(c.r===OFF_ROLE.DEEP && board.deep>=2) s-=0.50;
      const _keep=a.offRole; a.offRole=c.r;
      const want=roleAnchorXY(a, a.home, ball, dir, lineX);
      a.offRole=_keep;
      /* 🧭 조율은 <b>갈 수 있는 곳</b>에서 한다 — 이동 루프와 같은 자(attLeash)로 한 번 접는다.
         ⚠ spaceQuality 는 아직 want 로 본다. 「그 공간이 값진가」는 도달 여부와 별개로
            의도의 값어치를 재는 쪽이라, 같이 바꾸면 변경 둘이 섞여 원인을 못 가린다. */
      const reach=reachSpot(a, want, ball, dir, c.r, tPress);
      /* 빈 공간의 값어치는 「그 공간을 쓸 사람」에게만 크다.
         모두에게 똑같이 주면 잔디가 넓은 쪽이 늘 이겨서 센터백이 라인을 버리고 나간다. */
      s += spaceQuality(want, opps, dir, a)*0.42*(0.6+otb*0.8)
           * clamp(0.30 + a._mp.roam*0.45 + a._mp.depth*0.55, 0.25, 1.25);
      /* 🔗 동료가 비워 준 공간 — 먼저 정한 선수가 수비수를 끌고 나갔다면 그 자리가 값지다 */
      for(const f of board.freed){
        const d=HYP((reach.x-f.x)*PITCH_AR, reach.y-f.y);
        if(d<0.12) s += (1-d/0.12)*0.55*(0.5+otb*0.9);   // 눈이 좋은 선수가 먼저 알아본다
      }

      /* ⚠ 이 감점을 0.55 → 1.35 로 올려 봤다가 <b>되돌렸다</b>(기록).
         「역할 점수가 2점대라 0.55 로는 못 민다」는 가설이었는데 실측이 아니라고 했다 —
         칸 중복 1.91 → 1.91 로 <b>소수점도 안 움직였다</b>.
         파고들어 재 보니 원인이 계수가 아니었다:
           · 칸 중복 <b>의도 2.19명 vs 실제 2.32명</b> — 겹침이 이미 「의도 단계」에 있다
           · 그런데 선수는 자기 _spot 에서 평균 <b>26.6m</b> 떨어져 있다
         이 자리의 좌표(want = roleAnchorXY)는 상대 오프사이드 라인·볼 기준이라
         현재 위치에서 40m 밖일 수 있고, 그 뒤 9단계 규율이 앵커 쪽으로 되당긴다.
         즉 <b>조율 층(claims·freed·lane)은 「의도 공간」에서 계산하는데
         파이프라인은 그 의도를 「앵커 공간」으로 다시 접는다.</b> 둘이 화해하지 않는다.
         계수를 아무리 올려도 <b>실현되지 않을 자리들끼리 떼어놓는</b> 셈이다.
         제대로 고치려면 조율을 <b>규율 통과 뒤의 좌표</b>에서 하거나,
         공격 의도가 규율을 통과해 살아남게 해야 한다 — 계수 문제가 아니다.
         ─ 그 뒤 reachSpot 으로 「갈 수 있는 곳」에서 조율하게 고쳤다(레인 중복 0.80 → 0.66).
           그리고 밀도 기반 지표로 다시 재 보니 <b>결론이 뒤집혔다</b>:
             · 이 선점 감점을 <b>완전히 0 으로 꺼도</b> 밀도가 안 바뀐다
               (8m 내 동료 있음 34.1% → 34.3%) — 이 층은 사실상 <b>무력하다</b>
             · SPACING_R 을 3.7m → 8.8m 로 키워도 34.1% → 33.9% (포화)
             · 규율을 풀면(SOFT ×2.2) 오히려 <b>나빠진다</b> 34.1% → 36.7%
           공격 목표는 대부분 볼 기준이라 <b>자연히 볼 근처로 모인다</b>.
           그걸 서로 다른 앵커로 되당기는 규율이 <b>지금 유일하게 퍼뜨리는 힘</b>이다.
           즉 「칸 중복 1.9명」은 격자 지표의 허상이었고, 실제 밀도(최근접 7.6m ·
           8m 내 34%)는 이미 균형점에 있다. <b>여기엔 고칠 결함이 없다.</b>
           이 선점 층은 무력하므로 나중에 걷어내거나 제대로 다시 설계할 자리로 남긴다. */
      {
        /* ① 같은 수비수를 둘이 묶는가 */
        const _pin=pinOf(reach);
        if(_pin && board.pinned.has(_pin.id) && board.pinned.get(_pin.id)!==a.id) s -= 0.70*tw;
        /* ② 볼에서 본 각·거리가 이미 잡힌 사람과 겹치는가 (약 12° · 10m 안) */
        const _ang=Math.atan2(reach.y-ball.y, (reach.x-ball.x)*PITCH_AR);
        const _dst=HYP((reach.x-ball.x)*PITCH_AR, reach.y-ball.y);
        for(const q of board.aim){
          let da=_ang-q.a; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2;
          if(Math.abs(da)<0.21 && Math.abs(_dst-q.d)<0.14){ s -= 0.50*tw; break; }
        }
      }
      /* 🛣️ 같은 레인으로 둘이 뛰면 수비수 <b>하나가 둘을 막는다</b> — 위협이 둘이 아니라 하나가 된다.
         기존 board.runners 제한은 「침투 인원 총량」이지 「같은 길」을 막지 못했다
         (실측 침투 3명 중 0.8명이 같은 레인). 레인별로 따로 센다. */
      if(c.r===OFF_ROLE.RUN||c.r===OFF_ROLE.THIRD||c.r===OFF_ROLE.FARPOST||c.r===OFF_ROLE.CHANNEL){
        if((board.runLane[laneOf(reach)]||0)>0) s -= 0.95*tw;
      }
      /* 🧱 폭 배정 — 지명된 사람은 폭을 잡는 쪽이 크게 유리하고,
         같은 쪽의 다른 사람은 불리해진다(둘이 같은 터치라인에 겹쳐 서지 않게). */
      if(c.r===OFF_ROLE.WIDE || c.r===OFF_ROLE.OVERLAP){
        const _hy=a.home?a.home.y:a.y;
        const _sd=(_hy<0.5?-1:1);
        if(board.width[_sd]===a.id)        s += 1.15;
        else if(board.width[_sd]!=null)    s -= 0.50;
      }
      /* 판단 오차 — 다만 규율이 높은 자리일수록 흔들림이 작다.
         센터백이 주사위 한 번에 라인을 버리고 나가면 그건 오차가 아니라 사고다. */
      s += (Math.random()-0.5)*(0.10+(1-dec)*0.62)*(1-a._mp.hold*0.62);
      if(!best || s>best.s) best={r:c.r, s, want, reach};
    }
    if(!best) best={r:OFF_ROLE.BALANCE, s:0};
    if(SLOT_BAND[a.slot]==="FW"){
      const top=cands.slice().sort((x,y)=>y.s-x.s).slice(0,3);
      a._fwDbg=top.map(c=>c.r+" "+c.s.toFixed(2)).join(" · ")+"  준비"+(ctx.passerReady!=null?ctx.passerReady.toFixed(2):"-");
    }
    /* 지금 들고 있는 의도의 점수 — 갈아탈 값어치가 있는지 견준다 */
    let curS=null;
    for(const c of cands) if(c.r===a.offRole){ curS=c.s; break; }
    /* 보드 갱신 — 내 결정이 다음 사람의 판단 재료가 된다 */
    if(best.r===OFF_ROLE.SHOW){
      board.show=(board.show||0)+1;
      if(board.show>1) best={r:OFF_ROLE.BALANCE, s:0};          // 한 명만 나간다
    }
    if(best.r===OFF_ROLE.RUN||best.r===OFF_ROLE.THIRD||best.r===OFF_ROLE.FARPOST||best.r===OFF_ROLE.CHANNEL){
      board.runners++;
      if(best.reach){ const _l=laneOf(best.reach); board.runLane[_l]=(board.runLane[_l]||0)+1; }
    }
    if(best.r===OFF_ROLE.CHANNEL) a._chGap=chGap;
    if(best.r===OFF_ROLE.DEEP) board.deep++;
    /* 보드에 남긴다 — 내가 묶은 수비수와, 내가 차지한 패스 각·거리 */
    if(best.reach){
      const _pin=pinOf(best.reach);
      if(_pin && !board.pinned.has(_pin.id)) board.pinned.set(_pin.id, a.id);
      board.aim.push({a:Math.atan2(best.reach.y-ball.y, (best.reach.x-ball.x)*PITCH_AR),
                      d:HYP((best.reach.x-ball.x)*PITCH_AR, best.reach.y-ball.y)});
    }
    if(best.r===OFF_ROLE.VACATE) board.freed.push({x:a.x, y:a.y});   // 내가 있던 자리가 열린다
    /* 🎯 ST 내려받기도 같은 신호다 — 최전방을 비우면 그 자리가 동료의 침투 공간이 된다.
       CB 가 따라 내려오면 공간이 실제로 열리고, 안 따라오면 ST 가 자유롭게 받는다.
       ⚠ 「지금 높이 서 있는 상태에서 내려가기 시작할 때」만 신호다 — 이미 내려간 뒤의
          위치를 남기면 중원 한복판을 침투 공간이라고 알리는 꼴이 된다. */
    if(best.r===OFF_ROLE.DEEP && SLOT_BAND[a.slot]==="FW"){
      if((dir>0 ? a.x : 1-a.x) > 0.55){
        board.freed.push({x:a.x, y:a.y});
        board.stDropped=true;              // AM·윙에게 직접 신호 — 앞이 비었다
      }
    }
    const ms=(a.home && Math.abs(a.home.y-0.5)>0.06) ? (a.home.y<0.5?-1:1) : 0;
    if(ms!==0 && a._mp.width>0.55 && board.wing[ms]===null) board.wing[ms]=best.r;
    if(a._cb3 && (a.offRole===OFF_ROLE.OVERLAP||a.offRole===OFF_ROLE.UNDERLAP) && best.r!==a.offRole) a._cb3Cool=t+40;   // ↔️ CB 드라이브 쿨다운 (18초 → 40초: 실측 20% 는 과다)
    if(intentSwitch(a, a.offRole, best.r, best.s, curS, t, "_intentAt")){
      if(a.offRole!==best.r) a._intentAt=t;
      a.offRole=best.r;
    }
    if(a._intentAt===undefined) a._intentAt=t;
    a._intentAim=INTENT_AIM[a.offRole]||"SPACE";
    a._phase=phase;
  }
  /* 🅛 라볼피아나 (참고 자료 — 「포백도 빌드업 시 수비형 미드필더가 두 센터백 사이로 내려와 일시적 3백을
     만들고, 풀백이 높게 전진하며 센터백들이 좌우로 벌려 그 공간을 메운다」).
     4백(CB 슬롯 없음)·빌드업 국면·풀백 하나 이상이 CB 라인보다 전진했을 때: 가장 뒤의 피벗(DM 밴드,
     없으면 drop 성향 미드필더)이 OUTLET 으로 두 CB 사이에 내려서고, 두 CB 는 OUTLET 폭을 더 벌린다.
     켜짐/꺼짐은 볼 전진도에 히스테리시스(0.40 켜짐 / 0.48 꺼짐, 팀 객체에 기억)로 잡아 국면 경계에서
     떨리지 않게 한다. */
  {
    const _b3=out.some(m=>m.slot==="CB");
    for(const a of out){ a._lavo=false; a._lavoWide=false; a._cb3=_b3&&(a.slot==="LCB"||a.slot==="RCB"); }
    const _ownB=v=>dir>0?v:1-v;
    const bOwn=_ownB(ball.x);
    /* ⚠ 이 함수의 t 는 팀이 아니라 시간이다 — 히스테리시스 기억은 첫 필드 플레이어 객체에 둔다 */
    const _lv=out[0];
    if(_lv._lavoTeamOn){ if(bOwn>0.48) _lv._lavoTeamOn=false; }
    else if(phase===ATK_PHASE.BUILD) _lv._lavoTeamOn=true;
    if(_lv._lavoTeamOn && !out.some(m=>m.slot==="CB")){
      const cbs=out.filter(m=>m.slot==="LCB"||m.slot==="RCB");
      const fbs=out.filter(m=>m.slot==="LB"||m.slot==="RB"||m.slot==="LWB"||m.slot==="RWB");
      if(cbs.length===2 && fbs.length>=2){
        const cbX=(_ownB(cbs[0].x)+_ownB(cbs[1].x))/2;
        /* 🅗 하프백(salida)은 풀백 전진을 기다리지 않고 빌드업이면 선제적으로 내려간다 —
           진짜 하프백은 내려가는 것이 먼저고, 풀백 전진은 그 결과다 */
        const _salAny=out.some(m=>m!==carrier && FX(m,"salida")>0.5);
        if(_salAny || fbs.some(f=>_ownB(f.x)>cbX+0.05)){
          let dm=null, _dmSc=-1;
          for(const m of out){
            if(m===carrier) continue;
            const _sal=FX(m,"salida")>0.5;
            const _dmB=SLOT_BAND[m.slot]==="DM" || (MID_SLOTS[m.slot] && FX(m,"drop")>0.3) || _sal;
            if(!_dmB) continue;
            const _sc=(_sal?10:0)+(1-_ownB(m.x));   // 살리다 역할 최우선, 다음은 가장 뒤
            if(_sc>_dmSc){ _dmSc=_sc; dm=m; }
          }
          /* ⚠ 1차: 벌림 보너스를 OUTLET 목표에만 얹었더니 CB 들이 BALANCE 를 골라 폭이 그대로(6m)였고,
             피벗·CB 모두 9단계 규율이 앵커로 되당겨 피벗이 CB 사이에 선 시간이 26%에 그쳤다.
             셋 다 OUTLET 으로 고정하고, 규율 면제(9단계)·걷지 않기(RUN)를 함께 건다. */
          if(dm){ dm._lavo=true; dm.offRole=OFF_ROLE.OUTLET; for(const c of cbs){ c._lavoWide=true; c.offRole=OFF_ROLE.OUTLET; } }
        }
      }
    }
  }
}
/* 역할별 "가고 싶은 기준점" */
function roleAnchorXY(a, anchor, ball, dir, lineX){
  let side = SLOT_SIDE[a.slot];
  if(side===undefined) side = a.home.y<0.5 ? -1 : 1;
  if(side===0) side = (a.seed%2) ? 0.35 : -0.35;   // 중앙 선수는 좌우로 살짝만 어긋나게
  switch(a.offRole){
    case OFF_ROLE.RUN: {
      // 오프사이드 라인 "바로 앞"에 붙어 기다린다. 타이밍(위치선정+침착성)이 좋을수록 라인에
      // 바짝 붙고(위협적) 흔들림이 적다. 나쁜 선수는 자꾸 라인을 넘어가 걸린다.
      const tm=a.offTiming||0.6;
      const margin=0.010+(1-tm)*0.018;                                   // 라인 앞에 두는 여유
      const jitter=Math.sin(a.seed*1.7+(a._runPhase||0))*(1-tm)*0.075;   // 흔들림 — 나쁜 선수는 여유를 넘어 라인을 넘는다
      return {x:clamp01(lineX-dir*margin+dir*jitter), y:clamp01(0.5+side*(0.10+Math.abs(a.home.y-0.5)*0.5))};
    }
    case OFF_ROLE.CHANNEL: {
      /* 🎯 채널 침투 — 오프사이드 라인 규칙은 RUN 과 같되, y 는 뒷선의 가장 넓은 틈. */
      const tm=a.offTiming||0.6;
      const margin=0.010+(1-tm)*0.018;
      const gp=a._chGap;
      if(!gp) return {x:clamp01(lineX-dir*margin), y:clamp01(0.5+side*0.14)};
      return {x:clamp01(gp.line-dir*margin), y:clamp01(gp.y)};
    }
    case OFF_ROLE.HALF:  // 라인 사이 하프스페이스 — 볼보다 앞, 중앙과 측면 사이
      return {x:clamp01(ball.x+dir*0.11), y:clamp01(0.5+side*(0.19+clamp(FX(a,"halfSpace"),0,1)*0.055))};   // 🎭 메짤라는 4m 더 바깥
    case OFF_ROLE.WIDE: {  // 터치라인 쪽으로 벌려 블록을 넓힌다
      /* ⚠ 이 좌표가 <b>상수</b>였다 — y = 0.5 + side*0.40. 공이 어디 있든 같은 자리다.
         제보 원문 — "근데 윙어는 꼭 터치라인 쪽에 늘 서있는건 아니잖아."
         맞는 지적이다. 실축에서 폭은 고정이 아니라 <b>공 위치의 함수</b>다:
           · 공이 반대쪽 → 최대한 벌린다. 상대 블록을 늘려야 하니까
           · 공이 내 쪽  → 오히려 안으로 접어 하프스페이스로. 폭은 오버래핑하는 풀백이 잡는다
         엔진에 INSIDE·UNDERLAP·FARPOST 가 따로 있긴 하지만, 그것들은 WIDE 와
         <b>매 틱 점수로 경쟁하는 별개 역할</b>이라 「같은 선수가 상황에 따라 벌렸다 접었다」가 아니다.
         오늘 만든 폭 배정 층이 「누가 폭 담당인지」를 이미 정해 두므로,
         여기서는 그 담당자가 <b>얼마나 벌릴지</b>만 상황에 맡기면 된다. */
      const _bs=(ball.y-0.5)*side;                       // +면 공이 내 쪽, −면 반대쪽
      const _sm=clamp(_bs/0.30, -1, 1);
      const _w = 0.37 - _sm*0.09;                        // 반대쪽 0.46 · 중앙 0.37 · 내 쪽 0.28
      /* 반대쪽에 공이 있으면 반 발 더 높이 선다 — 넘어오는 공의 표적이 되어야 한다 */
      const _up = 0.05 + Math.max(0, -_sm)*0.045;
      return {x:clamp01(ball.x+dir*_up), y:clamp01(0.5+side*_w)};
    }
    case OFF_ROLE.INSIDE: {  // 컷인 — 안쪽으로 접어 박스 뒷문으로 들어간다
      const tm=a.offTiming||0.6;
      const margin=0.012+(1-tm)*0.016;
      // 오프사이드 라인을 넘지 않는 선에서 박스 언저리까지 파고든다
      const want = dir>0 ? Math.min(0.88, lineX-margin) : Math.max(0.12, lineX+margin);
      return {x:clamp01(want), y:clamp01(0.5+side*0.115)};
    }
    case OFF_ROLE.OVERLAP: { // 풀백 오버래핑 — 볼보다 앞, 터치라인 끝까지 (윙어를 추월한다)
      /* 🔁 「윙어보다 앞선 위치」 — 볼 기준만 보면 윙어가 볼보다 앞에 있을 때 그 뒤에 멈춘다 */
      let ox=ball.x+dir*0.16;
      if(a._lapWing){ const wx=a._lapWing.x+dir*0.06; ox = dir>0 ? Math.max(ox,wx) : Math.min(ox,wx); }
      return {x:clamp01(ox), y:clamp01(0.5+side*0.45)};
    }
    case OFF_ROLE.DEEP:  // 볼보다 살짝 뒤에서 안전하게 받아준다 (피벗 한 명만)
      /* 🎭 얼마나 내려오는가는 역할이 정한다 — 폴스 나인/딥라잉(drop↑)은 8m+, 전진형은 5m (스트라이커 역할 점검) */
      return {x:clamp01(ball.x-dir*(0.045+clamp((a._mp&&a._mp.drop)||0.3,0,1)*0.055)), y:clamp01(anchor.y*0.65+0.5*0.35)};
    case OFF_ROLE.BALANCE: { // 수비 라인 유지 — 볼을 따라 내려가지 않는다
      /* 🔁 SUPPORT — 볼 쪽 풀백·윙백은 앵커가 아니라 「윙어 뒤 12m」에 선다 (트리의 SUPPORT 분기).
         실측(빌드 0230 디버그): 오버랩 목표는 30m 앞에 잘 찍히는데 풀백이 엔진 최고 속도(5.2m/s)로 달려도
         같은 속도로 전진하는 윙어를 30m 뒤에서 영영 못 따라잡았다(스펠당 전진 3m). 실제 오버랩은 30m 달리기가
         아니라 「이미 윙어 뒤에 붙어 있다가」 10~15m 치고 나가는 것이다. 위험(fbRisk)이 높거나 볼이 반대쪽이면
         예전처럼 앵커(HOLD). 10d 천장(윙어·커버·반대쪽 하프라인)은 그대로 이 위에 걸린다. */
      const _isFBb=(a.slot==="LB"||a.slot==="RB"||a.slot==="LWB"||a.slot==="RWB");
      a._fbSupport=false;
      if(_isFBb && a._lapWing && (ball.y-0.5)*side>0.02 && (a._fbRisk||0)<0.6){
        const w=a._lapWing;
        /* 🧩 SUPPORT 깊이도 역할이 정한다 — 수비 임무는 윙어 14m 뒤, 완성형 윙백은 8m 뒤 (풀백 역할 점검) */
        const _supD=0.14 - clamp(FX(a,"fwd"), 0, 1)*0.06;
        const sx = dir>0 ? Math.max(anchor.x, w.x-_supD) : Math.min(anchor.x, w.x+_supD);
        a._fbSupport=true;                       // 규율(9단계) 면제 표시 — 앵커가 아니라 윙어 기준으로 선다
        return {x:clamp01(sx), y:clamp01(0.5+side*0.40)};
      }
      return {x:anchor.x, y:clamp01(anchor.y+(ball.y-anchor.y)*0.18)};
    }
    case OFF_ROLE.OUTLET: {
      /* 🏗️ 후방 빌드업 출구 — 팀 구조를 유지한 채 짧은 패스 길을 낸다.
         센터백은 박스 옆으로 넓게, 풀백은 터치라인 높이, 피벗은 그 앞 중앙.
         ⚠ 「볼 가진 사람 기준」으로 잡아 봤더니 전부 공 주변으로 몰려 구조가 무너졌다
            (실측: 백패스 85→56, 슛 102→131, 골 10→18). 빌드업은 자리를 지켜야 성립한다.
            「더 안정적인 자리」는 좌표를 옮기는 게 아니라, 아래 findOpenSpot 이
            압박·패스길을 보고 그 주변에서 안전한 각을 고르는 방식으로 얻는다. */
      const P=a._mp||{depth:0.3, width:0.4, drop:0.5};
      /* 🅛 라볼피아나 — 피벗은 두 센터백 사이(그 깊이)로, 센터백은 한 칸 더 벌린다 (assignOffRoles 끝 주석) */
      if(a._lavo) return {x:clamp01(dir>0 ? 0.135 : 1-0.135), y:0.5};
      const ax = 0.10 + P.depth*0.34 + P.drop*0.06;          // 앞선일수록 조금 더 나간다
      const ay = 0.16 + P.width*0.34 + (a._lavoWide?0.085:0) + (a._cb3?CB3_OUTLET_Y:0);   // ↔️ 3백 2차
      return {x:clamp01(dir>0 ? ax : 1-ax), y:clamp01(0.5+side*ay)};
    }
    case OFF_ROLE.SHOW: {
      /* 🙋 받아 주러 나간다 — 동료가 갇혔을 때만 켜지는 임시 구조.
         볼에서 패스가 닿는 거리(9~16m)에, 내 쪽 측면으로 벌려 각을 만든다.
         ⚠ 이걸 상시로 켜면 전원이 공 주변으로 몰려 구조가 무너진다(OUTLET에서 확인).
            그래서 갇힌 순간에만, 최대 두 명만 나간다. */
      const P=a._mp||{support:0.5};
      const want = 0.135 + P.support*0.075;
      const bx = ball.x + dir*want*0.45;                 // 살짝 앞으로
      const by = ball.y + side*want*0.90;                // 내 쪽으로 벌려 각을 만든다
      return {x:clamp01(bx), y:clamp01(by)};
    }
    case OFF_ROLE.UNDERLAP: // 언더랩 — 윙어가 폭을 잡아 주면 안쪽 하프스페이스로 올라간다 (§15)
      return {x:clamp01(ball.x+dir*0.13), y:clamp01(0.5+side*0.21)};
    case OFF_ROLE.VACATE: {  // 공간 비우기 — 수비수를 끌고 반대 방향으로 빠진다 (§8)
      const away = ball.y<0.5 ? 1 : -1;                       // 공 반대쪽으로
      return {x:clamp01(anchor.x+dir*0.03), y:clamp01(0.5+away*0.32)};
    }
    case OFF_ROLE.THIRD: {   // 제3의 침투 — 볼과 무관한 레인에서 라인 뒤를 노린다 (§13)
      const tm=a.offTiming||0.6;
      const lane = (ball.y<0.5) ? 1 : -1;                     // 공이 없는 쪽 레인
      return {x:clamp01(lineX-dir*(0.014+(1-tm)*0.016)), y:clamp01(0.5+lane*0.16)};
    }
    case OFF_ROLE.FARPOST: { // 공 반대편 뒷문 — 크로스가 넘어올 자리 (§17)
      const far = ball.y<0.5 ? 1 : -1;
      const want = dir>0 ? Math.min(0.90, lineX-0.010) : Math.max(0.10, lineX+0.010);
      return {x:clamp01(want), y:clamp01(0.5+far*0.13)};
    }
    default:
      return {x:anchor.x, y:anchor.y};
  }
}
/* 역할 기준점 주변에서 실제로 설 자리를 고른다. 역할마다 무엇을 중시하는지가 다르다 —
   침투는 전진을 최우선으로 보고(아직 받는 게 아니므로 패스 길은 덜 중요),
   내려받기는 압박이 없고 패스 길이 열린 곳을 최우선으로 본다. */
function findOpenSpot(a, anchor, carrier, opps, mates, dir, ball, lineX){
  const base=roleAnchorXY(a, anchor, ball, dir, lineX);
  const cands=[base];
  /* ⚠ 출구(OUTLET)만 탐색 반경을 0.145로 넓혀 「더 안전한 각」을 찾게 해 봤지만
     오히려 나빠졌다(실측: 백패스 85→67, 슛 102→126, 골 10→14).
     넓게 훑으면 압박이 적은 자리를 찾는 대신 서로의 간격이 무너진다. 원래 반경을 쓴다. */
  for(let k=0;k<4;k++){
    const th=(k/4)*Math.PI*2 + a.seed*0.7;
    const r=0.09;
    cands.push({x:clamp01(base.x+Math.cos(th)*r/PITCH_AR), y:clamp01(base.y+Math.sin(th)*r)});
  }
  // 역할의 전진 성향을 빈 공간 탐색에도 반영한다.
  // 이게 없으면 앵커만 앞으로 옮겨두고 실제 움직임은 역할과 무관해진다
  // (앵커 기준으로는 16m 차이인데 경기 중 평균은 5m밖에 안 벌어지던 원인).
  const _B=roleBias(a);
  const rFwd=_B.fFwd;
  const rWide=_B.fWide;
  if(rFwd||rWide){
    const sideY = base.y<0.5 ? -1 : 1;
    for(let k=0;k<3;k++){
      cands.push({x:clamp01(base.x + dir*rFwd*(0.05+k*0.045)),
                  y:clamp01(base.y + sideY*rWide*(0.04+k*0.035))});
    }
  }
  const W = a.offRole===OFF_ROLE.RUN  ? {press:0.9, lane:0.5, crowd:1.0, adv:2.6}
          : a.offRole===OFF_ROLE.HALF ? {press:1.6, lane:1.8, crowd:1.3, adv:1.4}
          : a.offRole===OFF_ROLE.WIDE ? {press:1.4, lane:1.3, crowd:1.5, adv:0.8}
          : a.offRole===OFF_ROLE.INSIDE ? {press:0.7, lane:0.7, crowd:0.7, adv:2.0, narrow:3.4}
          : a.offRole===OFF_ROLE.DEEP ? {press:2.0, lane:2.0, crowd:1.2, adv:0.0}
          : a.offRole===OFF_ROLE.BALANCE ? {press:1.0, lane:0.6, crowd:1.0, adv:0.3}
          : a.offRole===OFF_ROLE.OVERLAP ? {press:1.1, lane:0.9, crowd:1.0, adv:2.0}
          : a.offRole===OFF_ROLE.UNDERLAP ? {press:1.0, lane:1.2, crowd:1.1, adv:2.0, narrow:1.6}
          : a.offRole===OFF_ROLE.OUTLET   ? {press:2.2, lane:2.2, crowd:1.4, adv:0.0}
          : a.offRole===OFF_ROLE.SHOW     ? {press:2.6, lane:2.8, crowd:1.6, adv:0.0}
          : a.offRole===OFF_ROLE.VACATE   ? {press:0.4, lane:0.2, crowd:0.3, adv:0.4}
          : a.offRole===OFF_ROLE.THIRD    ? {press:0.8, lane:0.6, crowd:1.1, adv:2.4}
          : a.offRole===OFF_ROLE.FARPOST  ? {press:0.9, lane:0.5, crowd:1.4, adv:2.2}
          :                             {press:1.6, lane:1.5, crowd:1.2, adv:0.7};
  let best=cands[0], bs=-1e9;
  const tmv=a.offTiming||0.6;
  for(const c of cands){
    const press=pressureOn(c, opps, 1);
    const adv0=dir>0?c.x:1-c.x;
    /* 🎛️ 역할 성향 = 후보의 점수 가중. 좌표를 미는 게 아니라 「이 자리가 나에게 얼마나 어울리는가」다.
       전진 성향이 높으면 앞쪽 자리의 값이, 폭 성향이 높으면 벌어진 자리의 값이 오른다.
       아래의 압박·패스길·혼잡·오프사이드 감점은 그대로 걸린다 — 그래서 위험하면 억제된다. */
    const rBias = (rFwd ? (dir>0 ? (c.x-base.x) : (base.x-c.x))*rFwd*ROLE_SPOT_W : 0)
                + rFwd*adv0*ROLE_ADV_W
                + rWide*Math.abs(c.y-0.5)*ROLE_WID_W;
    const lane=carrier?laneBlocked(carrier, c, opps):0;
    // 오프사이드 라인을 넘는 자리는 피한다 — 타이밍이 좋은 선수일수록 확실히 지킨다
    const over = dir>0 ? (c.x-lineX) : (lineX-c.x);
    const offPen = over>0 ? (0.6+tmv*2.6) : 0;
    let crowd=0;
    for(const m of mates){
      if(m===a) continue;
      const d=HYP((m.x-c.x)*PITCH_AR, m.y-c.y);
      if(d<0.10) crowd+=(1-d/0.10);
    }
    const adv=adv0;
    /* 컷인은 "빈 공간"이 아니라 "골문 앞"으로 가는 움직임이다. 압박·혼잡만 보면
       늘 텅 빈 터치라인 쪽이 최고점을 받아, 역할만 컷인이고 몸은 계속 측면에 남았다.
       (실측: 컷인 배정 중에도 슛 위치의 좌우 편차가 0.34 — 사실상 윙에서 때린 것) */
    const narrow = W.narrow ? (0.5-Math.min(0.5, Math.abs(c.y-0.5)))*W.narrow : 0;
    const sc = -press*W.press - lane*W.lane - crowd*W.crowd + adv*W.adv - offPen + rBias + narrow;
    if(sc>bs){ bs=sc; best=c; }
  }
  return best;
}
