"use strict";
/* =====================================================
   2D 매치엔진 (바둑알 시각화) — 문자중계를 대체해, 하이라이트 장면(슛/골/카드/교체 등)이 벌어질 때마다
   피치 위 22개 도트(선수)+공이 그 장면을 짧게 재연하고, 화면 하단에 그 순간의 상황 자막이 함께 뜬다.
   실제 판정(누가 슈팅해서 골/선방/미스가 됐는지 등)은 procMinute 등 기존 시뮬레이션이 그대로 다 하고,
   이 엔진은 오직 "이미 정해진 결과"를 시각적으로 재현하는 역할만 한다. ===================================================== */
const SCENE_DURATION={ // 씬 종류별 재생 시간(ms) — 빌드업/항의처럼 여러 동작이 이어지는 씬은 길게 잡는다
  kickoff:1000, ht:1000, ft:1200,
  shot_action:2900, shot_goal:1900, shot_save:1700, shot_block:1400, shot_miss:1500, shot_corner:1400, shot_owngoal:1900,
  pen_action:2000, pen_goal:2200, pen_miss:2100,
  var_check:1600, var_overturn:1600,
  card_yellow:2800, card_red:3400, foul:2000, injury:2200, sub:2000
};
const CAPTION_ONLY_MS=650; // scene이 없는(=애니메이션할 게 없는) 일반 자막의 표시 시간
/* 결과 자막을 "언제" 띄울지 — 공이 실제로 결판나는 순간에 맞춘다.
   이 목록에 있는 씬은 시작하자마자 자막을 바꾸지 않고, 공이 골망에 꽂히거나 키퍼 손에 맞는 그 순간에
   자막이 바뀐다. 그 전까지는 직전의 "{선수}의 슛!" 자막이 그대로 남아 있어, 공이 날아가는 동안
   결과가 미리 새어나가지 않는다. */
const SCENE_CAPTION_AT={
  shot_goal:0.55, shot_owngoal:0.55, pen_goal:0.80,
  shot_save:0.44, pen_miss:0.62,
  shot_miss:0.75, shot_block:0.38, shot_corner:0.72
};
/* ── 보간·이징·구간 유틸 ── */
function lerp(a,b,t){ return a+(b-a)*t; }
function lerpXY(a,b,t){ return {x:lerp(a.x,b.x,t), y:lerp(a.y,b.y,t)}; }
function easeInOutQ(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function easeOutQ(t){ return 1-(1-t)*(1-t); }      // 처음 빠르고 뒤로 갈수록 감속 — 패스·슛처럼 힘이 실린 움직임
function easeInQ(t){ return t*t; }                  // 처음 느리고 점점 가속 — 걸어나가기 시작하는 움직임
function easeOutBack(t){ const c=1.7; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); } // 살짝 튀며 멈춤(카드 들어올리기)
/* 전체 진행률 t 안에서 [a,b] 구간만 떼어내 0~1로 환산 — 한 씬 안에서 동작을 시간순으로 이어붙일 때 쓴다 */
function seg(t,a,b){ return clamp01((t-a)/(b-a)); }
function distXY(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
/* 항의·부상처럼 "그 자리에서 흥분해 몸을 흔드는" 연출 — 선수 id마다 위상이 달라 다 같이 똑같이 안 흔들린다 */
function agitate(id, t, amp){
  const s=(id*53)%100;
  return { x: Math.sin(t*Math.PI*14+s)*amp, y: Math.cos(t*Math.PI*11+s*1.3)*amp*0.8 };
}
/* 드리블 경로 — 직선이 아니라 좌우로 흔들며 전진해 공을 몰고 가는 것처럼 보이게 한다 */
function dribbleXY(from, to, p){
  const base=lerpXY(from, to, easeInOutQ(p));
  const wob=Math.sin(p*Math.PI*3.2)*0.028*(1-p*0.4);
  return {x:base.x, y:clamp01(base.y+wob)};
}
/* ── 공 물리 ──
   정규화 좌표계(0~1 × 0~1)는 실제 화면에서 가로가 세로보다 훨씬 길기 때문에, 각도·반사를 그냥 계산하면
   화면에서 엉뚱한 방향으로 튀어 보인다. 그래서 방향 계산은 x축을 화면 비율만큼 늘린 "등방 좌표계"에서
   하고, 결과만 다시 정규화 좌표로 되돌린다. */
/* 🏟️ 경기장 110×70m — 실제 규격(105×68)보다 살짝 넓다.
   목적은 축척 재현이 아니라 「선수 간 공간 → 움직임 → 패스 → 압박」이 숨 쉴 자리다.
   캔버스 비(604/384≈1.573)와 물리 비(110/70≈1.571)의 차이는 0.1%로 무시 가능. */
const PITCH_AR=110/70;
function toIso(p){ return {x:p.x*PITCH_AR, y:p.y}; }
function fromIso(p){ return {x:p.x/PITCH_AR, y:p.y}; }
/* 공이 무언가(키퍼 손·수비수 몸)에 맞고 튕겨나가는 궤적 — 날아온 방향을 되반사시키되 ang만큼 틀어주고,
   튕긴 뒤에는 점점 감속하며(easeOutQ) 굴러간다. hit 지점이 곧 "맞은 바둑알"의 위치다. */
function ricochetXY(from, hit, ang, dist, p){
  const A=toIso(from), B=toIso(hit);
  let vx=B.x-A.x, vy=B.y-A.y;
  const L=HYP(vx,vy)||1; vx/=L; vy/=L;
  const a=Math.atan2(-vy,-vx)+ang;          // 입사 반대 방향 + 편향
  const e=easeOutQ(clamp01(p));
  const P={x:B.x+Math.cos(a)*dist*e, y:B.y+Math.sin(a)*dist*e};
  const r=fromIso(P);
  return {x:clamp01(r.x), y:clamp01(r.y)};
}
/* 튕긴 공이 몇 번 낮게 튀다 잦아드는 감쇠 바운스 (n=튀는 횟수) */
function bounceLift(p, n, amp){
  const q=clamp01(p);
  return Math.abs(Math.sin(q*Math.PI*n))*amp*(1-q);
}
/* 주심이 서 있어야 할 자리 — 공에 달라붙지 않고, 공격 진행 방향의 뒤쪽·대각선으로 거리를 두고 따라간다
   (실제 주심의 대각선 운영). 터치라인 쪽으로 살짝 빠져 플레이를 옆에서 지켜보는 위치를 잡는다. */
const REF_TRAIL=0.11;  // 공 뒤로 물러나는 거리
const REF_SIDE=0.10;   // 옆으로 비켜서는 거리
const REF_MIN=0.09;    // 인플레이 중 공과 최소한 이만큼은 떨어져 있는다
const REF_EASE=0.06;   // 목표 지점으로 접근하는 감속 계수
const REF_SPEED=0.045; // 초당 최대 이동 거리(피치 가로=1.0 기준) — 사람이 뛰는 속도 수준으로 제한해 순간이동을 막는다
function refPostXY(ballXY, dir){
  return { x: clamp01(ballXY.x - dir*REF_TRAIL),
           y: clamp01(ballXY.y + (ballXY.y<0.5 ? REF_SIDE : -REF_SIDE)) };
}
// 슈터가 슛을 때리는 지점 — shot_action(빌드업)과 결과 씬이 같은 좌표로 이어지도록 결정적으로 계산한다
function shotStageXY(atkSide, baseXY){
  const stageX = atkSide==="h" ? 0.72 : 0.28;
  const y = clamp(0.5 + ((baseXY?baseXY.y:0.5)-0.5)*0.5, 0.12, 0.88);
  return {x:stageX, y};
}
const GOAL_X={h:0.985, a:0.015}; // atkSide가 공격하는 방향의 골문 x좌표
const GOAL_W=0.14;               // 골문 세로 폭(drawPitchBase가 그리는 골대와 동일한 비율)
function goalMouthXY(atkSide, seedY){ return {x:GOAL_X[atkSide], y: seedY===undefined?0.5:seedY}; }
