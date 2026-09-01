"use strict";
/* =====================================================
   일정 (더블 라운드로빈)
===================================================== */
/* ═══════════════════════════════════════════════════════════════════════════
   🗓️ K리그1 3라운드 로빈 (14팀 · 2027~)
   실제 규정 — 14팀 체제에서는 스플릿을 폐지하고 모든 팀이 서로 세 번씩 만난다(39경기).
   홀수 번(3번)을 만나므로 어느 한쪽은 그 상대와 홈에서 두 번 뛴다.
   시즌 전체로는 홈 20 / 원정 19 인 팀과 홈 19 / 원정 20 인 팀이 절반씩 생긴다.
   ─ 앞 두 로빈은 홈·원정을 한 번씩 나눠 가지므로 모든 팀이 홈 13경기로 같다.
     세 번째 로빈에서 상위 7팀이 홈 7경기(총 20), 하위 7팀이 홈 6경기(총 19)를 갖는다.
     배정 기준은 「직전 시즌 순위」다 — 성적이 좋았던 팀에게 홈 한 경기를 더 준다.
   ⚠ 합이 맞아야 한다: 3번째 로빈의 총 경기 91 = 상위 7팀×7 + 하위 7팀×6.
      · 같은 그룹끼리(각 21경기)는 순환식으로 팀마다 3경기씩 홈
      · 다른 그룹끼리(49경기)는 상위가 4경기, 하위가 3경기씩 홈
   ═══════════════════════════════════════════════════════════════════════════ */
function thirdRobinHosts(ids, order){
  const n=ids.length, half=Math.floor(n/2);
  const rank={}; (order||ids).forEach((id,i)=>{ rank[id]=i; });
  const sorted=[...ids].sort((a,b)=>(rank[a]==null?99:rank[a])-(rank[b]==null?99:rank[b]));
  const gi={}; sorted.forEach((id,i)=>{ gi[id]={top:i<half, k:i<half?i:i-half}; });
  const oddHalf = half%2===1;
  return (a,b)=>{
    const A=gi[a], B=gi[b];
    if(!A||!B) return Math.random()<0.5?a:b;
    if(A.top===B.top){
      if(!oddHalf) return ((A.k+B.k)%2===0)?a:b;          // 짝수 그룹 — 단순 교대
      const d=((B.k-A.k)%half+half)%half;
      return d>0 && d<=Math.floor(half/2) ? a : b;         // 7팀 → 팀마다 3경기 홈
    }
    const t0=A.top?a:b, b0=A.top?b:a;
    if(!oddHalf) return t0;
    const i=gi[t0].k, j=gi[b0].k;
    const d=((j-i)%half+half)%half;
    return d < Math.ceil(half*4/7) ? t0 : b0;              // 7팀 → 상위 4 / 하위 3
  };
}
/* 3로빈 전체 일정 — 1·2로빈은 홈앤어웨이, 3로빈은 위 규칙대로 홈을 정한다 */
function buildTripleRobin(ids, order){
  /* ⚠ roundRobin 은 이미 홈앤어웨이 「2로빈」을 돌려준다 — 앞 두 바퀴는 그것 하나로 끝난다.
     세 번째 바퀴만 따로 한 바퀴(singleRobin) 만들어 홈을 규정대로 정한다. */
  const twoRobins=roundRobin(shuffled(ids));                    // 1·2로빈 (각 팀 홈 13 · 원정 13)
  const host=thirdRobinHosts(ids, order);
  const r3=singleRobin(shuffled(ids)).map(rd=>rd.map(([h,a])=>{
    const H=host(h,a);
    return H===h ? [h,a] : [a,h];
  }));
  return [...twoRobins, ...r3];
}
function roundRobin(ids){
  const n=ids.length, arr=[...ids];
  const bye = n%2===1; if(bye) arr.push(null);
  const m=arr.length, rounds=[];
  for(let r=0;r<m-1;r++){
    const rd=[];
    for(let i=0;i<m/2;i++){
      const a=arr[i], b=arr[m-1-i];
      if(a!==null&&b!==null) rd.push(r%2===0?[a,b]:[b,a]);
    }
    rounds.push(rd);
    arr.splice(1,0,arr.pop());
  }
  /* 🔀 ⚠ 제보 원문 — 「각 로빈마다 똑같이 라운드 상대가 반복 되고 있습니다. 1로빈 1라운드에
     강원과 붙었다면 2로빈 1라운드도 강원 … 로빈이 그대로 복사 되는 형식입니다.
     현행 실축 K리그1은 로빈마다 상대하는 팀들의 서순을 랜덤으로 섞습니다」.
     원인: 두 번째 로빈을 첫 로빈의 「같은 순서」에 홈·원정만 뒤집어 만들고 있었다.
        서클 방식이 만든 라운드 묶음은 그대로 두고 순서만 섞으면, 각 라운드가 여전히
        「모든 팀이 한 경기씩」이고 로빈 안에서 모든 팀을 한 번씩 만나는 성질도 그대로다.
     ⚠ 로빈이 넘어가는 자리에서 같은 상대를 연속으로 만나지 않게, 첫 라운드가 앞 로빈의
        마지막 라운드와 겹치면 다시 섞는다. */
  const _rkey=(rd)=>rd.map(([a,b])=>[a,b].slice().sort().join(">")).sort().join("|");
  const lastK=rounds.length?_rkey(rounds[rounds.length-1]):"";
  let ord=null;
  for(let tries=0;tries<40;tries++){
    const c2=shuffled(rounds);
    if(!lastK || !c2.length || _rkey(c2[0])!==lastK){ ord=c2; break; }
  }
  if(!ord) ord=shuffled(rounds);
  const second = ord.map(rd=>rd.map(([a,b])=>[b,a]));
  return [...rounds,...second];
}
/* 한 바퀴만 — 각 팀이 서로 한 번씩 만난다 (N-1 라운드, 홀수면 부전승 포함 N 라운드) */
function singleRobin(ids){
  const n=ids.length;
  const one=(n%2===1)?n:n-1;
  return roundRobin(ids).slice(0, one);
}
