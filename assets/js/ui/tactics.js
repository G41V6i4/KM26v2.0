"use strict";
/* ---------- 전술 ---------- */
/* ═══════════════════════════════════════════════════════════════
   📋 FM 스타일 전술판
   위쪽 바에 포메이션·스타일·성향과 친숙도/강도 게이지, 아래는 좌우 2단 —
   왼쪽은 피치, 오른쪽은 선발 정보 표(역할·전술적 능력·컨디션·경고·반응·평점).
   ═══════════════════════════════════════════════════════════════ */
/* 상단 바 */
/* ── 전술 프리셋 (FM의 전술 1·2·3) ────────────────────────────
   슬롯마다 포메이션·배치·역할·세부 지시를 통째로 담아 둔다.
   전환하면 그 전술의 친숙도도 함께 따라온다 — 새 전술은 처음부터 손발을 맞춰야 한다. */
let tacDetailOpen=false;
function toggleTacDetail(){ tacDetailOpen=!tacDetailOpen; refreshTactics(); }
const PRESET_N=3;
function tacPresets(t){
  if(!t.tactic.presets || t.tactic.presets.length!==PRESET_N) t.tactic.presets=new Array(PRESET_N).fill(null);
  if(t.tactic.presetCur==null) t.tactic.presetCur=0;
  return t.tactic.presets;
}
/* 인선(선발·벤치)은 전술 슬롯의 소유물이 아니다 — 전술 1·2·3이 같은 명단을 쓴다.
   ⚠ 제보 — 「전술마다 선발·교체 명단이 달라진다. 포메이션 바꾸는 사람은 잘 없으니
      명단은 그대로 유지해 달라」. 스냅샷에 아예 담지 않아 되돌아갈 여지를 없앤다. */
/* ⚠ presetNames 도 스냅샷 밖 — 이름을 바꾼 뒤 슬롯을 전환하면 스냅샷 속 옛 이름이 되살아났다 */
const PRESET_SKIP=["presets","presetCur","benchSel","benchExcl","benchManual","presetNames"];
/* 지금 전술판 상태를 통째로 복사한다 (프리셋 자체는 제외해 재귀를 막는다) */
function snapTactic(t){
  const o={};
  for(const k in t.tactic){
    if(PRESET_SKIP.indexOf(k)>=0) continue;
    const v=t.tactic[k];
    o[k]=(v && typeof v==="object") ? JSON.parse(JSON.stringify(v)) : v;
  }
  /* 📋 ⚠ 제보 — 드릴 기준선(_sigBase)과 이탈량(_devPen)은 슬롯마다 따로 가야 한다.
     하나만 들고 있으면 1번에서 이미 치른 이탈량 때문에 2·3번의 같은 변경이 헐값이 된다. */
  return {tac:o, fam:famOf(t), sig:tacticSig(t), useL:(t._famUseL||0),
          base:(t._sigBase||tacticSig(t)), dev:(t._devPen||0)};
}
/* 🎯 지금 화면에 보이는 역할을 전술에 <b>못 박는다</b>.
   ⚠ 제보 — 「전술 두 개를 번갈아 쓰면 롤이랑 임무가 지 멋대로 막 바뀐다. 저장해도 그렇다」.
      원인은 「바뀐다」가 아니라 <b>애초에 저장된 적이 없다</b>는 것이었다.
      감독이 역할 메뉴를 한 번도 열지 않은 선수는 t.tactic.role 에 아무 값도 없다.
      화면에 보이는 역할은 그때그때 getRole() 이 계산해 낸 값이다 —
        · 그 선수가 가장 능숙한 역할(rolesSortedFor 1순위)을 시즌·자리그룹 단위로 캐시
        · 자리 그룹이 바뀌면(포메이션 전환) 다시 계산
        · 시즌이 바뀌거나 능력치가 자라면 1순위 자체가 달라진다
      그래서 「내가 아무것도 안 건드렸는데 역할이 달라져 있다」가 되고,
      저장을 눌러도 <b>저장할 값이 없어서</b> 아무 일도 일어나지 않았다.
   ─ 프리셋에 담거나 프리셋을 불러올 때, 지금 보이는 역할을 그대로 role 맵에 적는다.
     한 번 적히면 감독이 직접 바꾸기 전까지 다시는 저절로 변하지 않는다.
     이미 유효한 지시가 있는 선수는 손대지 않는다. */
function pinRoles(t){
  if(!t || !t.tactic) return;
  const rMap = t.tactic.role || (t.tactic.role={});
  let xi=[]; try{ xi=bestXI(t)||[]; }catch(e){ return; }
  for(const p of xi){
    const sl=(t.tactic.slot||{})[p.id] || (p.pos==="GK" ? "GK" : null);
    if(!sl) continue;
    const g=ROLE_GRP[sl]||"CM";
    const cur=rMap[p.id];
    if(cur && ROLE_BY_KEY[cur.r] && ROLE_BY_KEY[cur.r].grp.includes(g)) continue;
    let rd=null; try{ rd=getRole(t, p, sl); }catch(e){}
    if(rd && rd.r && ROLE_BY_KEY[rd.r]) rMap[p.id]={r:rd.r, d:rd.d};
  }
}
function storeCurPreset(t){
  const ps=tacPresets(t);
  try{ pinRoles(t); }catch(e){}          // 🎯 보이는 대로 못 박고 담는다
  ps[clamp(t.tactic.presetCur,0,PRESET_N-1)]=snapTactic(t);
}
/* 옛 세이브 정리 — 이미 저장된 프리셋 안에 남아 있는 인선 데이터를 걷어낸다.
   그대로 두면 그 슬롯으로 전환할 때 옛 명단이 되살아난다. */
function scrubPresetSquads(t){
  try{
    const ps=(t&&t.tactic&&t.tactic.presets)||null;
    if(!Array.isArray(ps)) return;
    for(const p of ps){
      if(!p || !p.tac) continue;
      delete p.tac.benchSel; delete p.tac.benchExcl; delete p.tac.benchManual; delete p.tac.presetNames;
    }
  }catch(e){}
}
/* ═══ 🧷 전술을 갈아도 인선은 그대로 ══════════════════════════════════
   ⚠ 제보 — 「로테이션을 돌리려고 선발과 교체 슬롯 선수를 바꾸고 전술 1 → 2 로 바꾸면
      방금 올린 선수가 후보(그 외 명단)로 튕겨 나간다」.
   원인: 선발 명단(G.userXI)은 전술 슬롯과 무관한 전역 값인데, 배치(slot·zone)와
   벤치 편성(benchSel)은 프리셋 스냅샷에 들어 있었다. 전술을 바꾸면 배치·벤치만
   옛 스냅샷으로 되돌아가, 방금 올린 선수는 자리도 벤치 자리도 없는 상태가 됐다.
   ─ 전술 슬롯은 「모양과 지시」다. 누가 뛰는지는 전술을 따라가지 않는다.
     지금 선발을 새 포메이션의 자리에 다시 앉힌다. 그 전술에 저장돼 있던 배치는
     같은 선수에 한해 그대로 존중한다. */
function remapXIToFormation(t){
  if(!t || !t.tactic) return;
  let xi=[]; try{ xi=bestXI(t)||[]; }catch(e){ return; }
  if(!xi.length) return;
  const fname=t.tactic.formation||"4-3-3";
  const shape=FORMATION_SHAPE[fname]||FORMATION_SHAPE["4-3-3"];
  const bandOf={}; for(const [b,s] of shape) bandOf[s]=b;
  const slots=shape.map(x=>x[1]);
  const oldSlot=t.tactic.slot||{};
  const map={}, usedS=new Set();
  /* ① 골키퍼는 자리 목록에 없다(포메이션 표기는 필드 10명 기준) — 배치에서 제외한다 */
  const field=xi.filter(p=>p.pos!=="GK");
  /* ② 이 전술에 저장돼 있던 자리가 여전히 유효하면 그대로 */
  for(const p of field){
    const s=oldSlot[p.id];
    if(s && slots.includes(s) && !usedS.has(s)){ map[p.id]=s; usedS.add(s); }
  }
  /* ③ 남은 선수를 남은 자리에 적합도 순으로 */
  const rest=field.filter(p=>!map[p.id]);
  const cand=[];
  for(const p of rest) for(const s of slots){
    if(usedS.has(s)) continue;
    let v=0; try{ v=slotPickScore(p,s); }catch(e){ v=0; }
    cand.push({p, s, v});
  }
  cand.sort((a,b)=>b.v-a.v);
  const doneP=new Set();
  for(const c of cand){
    if(doneP.has(c.p.id) || usedS.has(c.s)) continue;
    map[c.p.id]=c.s; doneP.add(c.p.id); usedS.add(c.s);
  }
  /* ④ 그래도 자리가 없으면 남은 아무 자리 (11명이 안 되는 상황 방어) */
  for(const p of rest){
    if(map[p.id]) continue;
    const s=slots.find(x=>!usedS.has(x));
    if(s){ map[p.id]=s; usedS.add(s); }
  }
  const ns={}, nz={};
  for(const p of field){
    const s=map[p.id]; if(!s) continue;
    ns[p.id]=s;
    const b=bandOf[s]; if(b) nz[p.id]=b;
  }
  /* 🎯 자리에 내려 둔 지시는 자리에 남는다 — 교체(subIn)와 같은 규칙.
     ⚠ 역할은 <b>선수 id</b>로 저장되는데 여기서 선발을 새 자리에 다시 앉힌다. 그래서
        로테이션을 돌리거나 포메이션이 다른 전술로 갈아타면, 그 자리에 지정해 둔 지시가
        <b>새로 그 자리에 온 선수에게 이어지지 않고 증발</b>했다(라움도이터로 세워 둔
        왼쪽 윙어 자리가 교체 한 번에 그냥 '윙'이 되는 것과 같은 증상).
        교체 처리는 이미 자리를 따라 인계하는데 전술 전환·재배치만 빠져 있었다. */
  {
    const oldRole=t.tactic.role||{};
    const slotRole={};                                   // 자리 → 그 자리에 내려져 있던 지시
    for(const pid in oldSlot){ const r=oldRole[pid]; if(r) slotRole[oldSlot[pid]]=r; }
    const nr=Object.assign({}, oldRole);
    for(const p of field){
      const s=ns[p.id]; if(!s) continue;
      const g=ROLE_GRP[s]||"CM";
      const mine=oldRole[p.id];
      if(mine && ROLE_BY_KEY[mine.r] && ROLE_BY_KEY[mine.r].grp.includes(g)) continue;   // 내 지시가 그대로 유효
      const inh=slotRole[s];
      if(inh && ROLE_BY_KEY[inh.r] && ROLE_BY_KEY[inh.r].grp.includes(g)) nr[p.id]={r:inh.r, d:inh.d};
    }
    t.tactic.role=nr;
  }
  t.tactic.slot=ns; t.tactic.zone=nz;
}
function usePreset(i){
  const t=userTeam();
  i=clamp(i|0, 0, PRESET_N-1);
  const ps=tacPresets(t);
  scrubPresetSquads(t);                    // 옛 세이브에 남은 인선 데이터 정리
  if(t.tactic.presetCur===i){ refreshTactics(); return; }
  storeCurPreset(t);                       // 지금까지 만진 건 원래 슬롯에 남긴다
  /* 🧷 누가 뛰는지는 전술을 따라가지 않는다 — 방금 돌린 로테이션을 그대로 들고 간다 */
  const keepXI = Array.isArray(G.userXI) ? G.userXI.slice() : null;
  const keepBench = {
    sel: Array.isArray(t.tactic.benchSel)  ? t.tactic.benchSel.slice()  : [],
    exc: Array.isArray(t.tactic.benchExcl) ? t.tactic.benchExcl.slice() : [],
    man: !!t.tactic.benchManual
  };
  const nx=ps[i];
  if(nx){
    const keep={presets:ps, presetCur:i};
    // 저장해 둔 전술을 그대로 되살린다 (인선 관련 키는 애초에 담기지 않는다)
    for(const k in t.tactic){ if(PRESET_SKIP.indexOf(k)<0) delete t.tactic[k]; }
    for(const k in nx.tac){ if(PRESET_SKIP.indexOf(k)>=0) continue; t.tactic[k]=nx.tac[k]; }
    t.tactic.presets=keep.presets; t.tactic.presetCur=i;
    /* 🎯 전담 키커는 전술을 갈아도 그대로 — 팀에 하나뿐인 지정이다 */
    try{ t.tactic.kickers=kickersOf(t); }catch(e){}
    /* 🧷 인선 복원 — 선발·벤치 편성은 프리셋 스냅샷을 쓰지 않는다 */
    if(keepXI) G.userXI=keepXI;
    t.tactic.benchSel=keepBench.sel;
    t.tactic.benchExcl=keepBench.exc;
    t.tactic.benchManual=keepBench.man;
    try{ remapXIToFormation(t); }catch(e){}   // 지금 선발을 새 포메이션 자리에 앉힌다
    try{ pinRoles(t); }catch(e){}             // 🎯 불러온 뒤에도 보이는 대로 못 박는다
    t.fam=nx.fam;                          // 그 전술로 쌓아 둔 조직력이 돌아온다
    t._famUseL=nx.useL||0;                 // 그 판으로 뛴 실전 감각도 함께 돌아온다
    t._sig=nx.sig;
    /* 📋 제보 — 기준선과 이탈량도 그 슬롯의 것으로 되돌린다 (예전에는 옛 슬롯 값이 그대로 남았다) */
    t._sigBase = nx.base || nx.sig;
    t._devPen  = (typeof nx.dev==="number") ? nx.dev : 0;
    /* ⚠ 제보 — 「전술 전환 사실이 뉴스 탭에 제한 없이 게재돼 중요한 뉴스를 밀어낸다」.
       전환은 하루에도 몇 번씩 하는 일상 조작이다 — 배너로만 알리고 뉴스에는 남기지 않는다. */
    flash(`📋 전술 ${i+1}번으로 전환했습니다. (친숙도 ${Math.round(t.fam)})`,"info");
  } else {
    // 빈 슬롯 — 지금 전술을 복사해 새 판을 연다. 손발은 처음부터 맞춰야 한다.
    t.tactic.presetCur=i;
    if(keepXI) G.userXI=keepXI;
    t.tactic.benchSel=keepBench.sel;
    t.tactic.benchExcl=keepBench.exc;
    t.tactic.benchManual=keepBench.man;
    /* 📋 ⚠ 제보 원문 — 「전술 슬롯의 1번은 친숙도가 1칸으로 바뀌는데 2번과 3번 슬롯은
       똑같은 포메이션으로 처음 바꿨음에도 2칸이 됩니다 … 동일하게 만들어주시면」.
       원인이 둘 겹쳐 있었다.
         ① 드릴 기준선·이탈량을 팀이 하나만 들고 있었다. 1번에서 포메이션을 바꿔 이탈량 28을
            이미 치른 뒤라, 2·3번에서 같은 변경을 해도 「이미 벗어나 있는 상태」로 계산돼
            고정 몫 12만 빠졌다 (1번 −40 · 2·3번 −12 → 1칸 대 2칸).
         ② 빈 슬롯을 열 때 조직력을 미리 깎아 두고, 그 위에 변경 대가를 또 물렸다.
       ─ ①은 슬롯마다 기준선·이탈량을 들고 다니게 고쳤다(snapTactic/usePreset).
         ②는 없앤다. 빈 슬롯은 「지금 판의 복사본」이다 — 똑같은 판을 복사만 했다면 선수들이
         새로 익힐 것이 없다. 미리 깎지 않고, 실제로 무언가를 바꿀 때 그 대가를 온전히 치른다.
       결과 — 어느 슬롯에서 처음 포메이션을 바꾸든 똑같은 폭으로 깎인다. */
    t._famUseL=0;                          // 새로 만든 판 — 실전 감각은 아직 없다
    t._sig=tacticSig(t); t._sigBase=t._sig; t._devPen=0;
    ps[i]=snapTactic(t);
    flash(`📋 전술 ${i+1}번을 만들었습니다 — 지금 판을 그대로 복사했습니다. (친숙도 ${Math.round(t.fam)})<br><span class="small">포메이션이나 지시를 바꾸면 그만큼 손발을 다시 맞춰야 합니다.</span>`, "info");   /* 뉴스 탭 제외 (제보) */
  }
  if(liveM){ liveM.xiDirty=true; addFam(t, -6); }   // 경기 중 갈아엎으면 대가가 따른다
  selSwap=null; saveGame(); refreshTactics();
}
function clearPreset(i){
  const t=userTeam(); const ps=tacPresets(t);
  i=clamp(i|0,0,PRESET_N-1);
  if(t.tactic.presetCur===i){ gameAlert("사용 중인 전술은 지울 수 없습니다."); return; }
  showConfirm(`<b>전술 ${i+1}번을 비웁니다</b>\n\n저장된 포메이션·역할·지시가 모두 사라집니다.`, ()=>{
    ps[i]=null; saveGame(); refreshTactics();
  }, {okLabel:"비우기", danger:true});
}
function presetName(t, i){
  const nm=(t.tactic.presetNames||{})[i];
  return nm ? String(nm).slice(0,10) : "";
}
function renamePreset(i){
  const t=userTeam();
  i=clamp(i|0,0,PRESET_N-1);
  if(!tacPresets(t)[i] && t.tactic.presetCur!==i){ gameAlert("빈 슬롯입니다. 먼저 전술을 만들어 주세요."); return; }
  const cur=presetName(t,i);
  const box=$("#gcModal"); box.className="";
  box.innerHTML=`<div class="gcOverlay"><div class="gcBox">
    <div class="gcBody"><b>📋 전술 ${i+1}번 이름</b>

용도를 적어 두면 나중에 알아보기 쉽습니다. (예: 원정 잠그기, 홈 하이프레스)
비우면 기본 이름(${i+1}번)으로 돌아갑니다.
      <input id="pnIn" type="text" inputmode="text" maxlength="10" value="${(cur||"").replace(/"/g,"&quot;")}"
        style="width:100%;margin-top:12px;padding:9px 10px;font-size:15px;background:var(--bg);border:1px solid var(--acc);border-radius:8px;color:var(--fg)"
        onkeydown="if(event.key==='Enter'){event.preventDefault();savePresetName(${i});}">
    </div>
    <div class="gcBtns">
      <button class="mini" onclick="closeGc()">취소</button>
      <button class="mini sel" onclick="savePresetName(${i})">저장</button>
    </div></div></div>`;
  try{ setTimeout(()=>{ const el=document.getElementById("pnIn"); if(el){ el.focus(); el.select&&el.select(); } }, 30); }catch(e){}
}
function closeGc(){ const box=$("#gcModal"); if(box){ box.className="hidden"; box.innerHTML=""; } }
function savePresetName(i){
  const t=userTeam();
  const el=document.getElementById("pnIn");
  const nm=String((el&&el.value)||"").trim().slice(0,10);
  t.tactic.presetNames=t.tactic.presetNames||{};
  if(nm) t.tactic.presetNames[i]=nm; else delete t.tactic.presetNames[i];
  closeGc(); saveGame(); refreshTactics();
}
function presetLabel(t, i){
  const ps=tacPresets(t)[i];
  const nm=presetName(t,i);
  const form=(t.tactic.presetCur===i) ? TAC(t).formation : (ps ? (ps.tac.formation||"—") : "빈 슬롯");
  return nm ? `${nm} (${form})` : form;
}
/* 그 슬롯에 쌓인 조직력 — 활성 슬롯은 지금 값, 비활성은 저장된 값 */
function presetFam(t, i){
  if(t.tactic.presetCur===i) return Math.round(famLive(t));   // 🧩 경기 중에는 킥오프 시점 값 (제보)
  const ps=tacPresets(t)[i];
  return ps && typeof ps.fam==="number" ? Math.round(ps.fam) : null;
}
/* ── FM식 선수 카드 ──────────────────────────────────────────
   위쪽에 역할·임무 배지(누르면 역할 패널), 아래쪽에 등번호와 이름.
   우클릭으로 역할을 바꾸던 방식은 없앴다 — 눌러야 할 곳이 눈에 보여야 한다. */
/* 🔋 포메이션 카드 밑에 붙는 몸 상태 한 줄 — 명단 표(fmCond)와 똑같은 색 눈금을 쓴다.
   ⚠ 제보 — 「전술 슬롯의 숫자는 체력이 떨어지면 색이 변하는데, 포메이션 카드 밑 숫자는
     늘 회색이라 누가 지쳤는지 한눈에 안 들어온다」. 눈금이 화면마다 다르면 읽는 법을
     두 번 배워야 한다 — 같은 함수(condCol / fitColOf)를 쓰게 맞춘다. */
/* ⚠ 제보 — 「포메이션 카드의 컨디션 색과 명단 슬롯의 색이 다르게 보인다」.
   색 자체는 같은 함수를 쓰고 있었지만, 표에는 하트 아이콘(💚💛🧡❤️)이 붙고 카드에는
   숫자만 있어서 같은 77 이 표에서는 「노란 하트」, 카드에서는 「초록 숫자」로 읽혔다.
   ─ 표와 똑같이 아이콘까지 붙여 눈금을 완전히 일치시킨다. */
/* 🎚️ 카드 하단 정보 전환 (제보 — 「능력치·컨디션·역할 능숙도 세 버튼, FM처럼」).
   선택은 세이브(G.fmSub)에 남는다: 'cond'(기본) | 'ovr' | 'fam' */
function fmSubMode(){ return (typeof G!=="undefined" && G && G.fmSub) ? G.fmSub : "cond"; }
function setFmSub(m){ if(typeof G!=="undefined" && G){ G.fmSub=m; } refreshTactics(); }
function ovrSub(p){
  /* 능력치는 별 개수로 (요청) — 명단·벤치와 같은 잣대(ovrStars). hover 툴팁은 카드 우클릭 팝업과 겹쳐 제거 */
  return ovrStars(p.ovr).replace(/ title="[^"]*"/, "");
}
function famSub(t,p,slot){
  const rd=getRole(t,p,slot);
  const f=getRoleFam(p, rd.r);
  const col = f>=85?"#3fb950" : f>=60?"#56d364" : f>=35?"#d29922" : "#f85149";
  return `<i class="condBar"><i style="width:${clamp(f,4,100)}%;background:${col}"></i></i><b style="color:${col};font-weight:800">${f}</b>`;
}
/* ⚡ 평시 전술판의 「체력」 — ⚠ 요청: 처음엔 지구력(sta) 능력치를 보여줬는데
   「나는 그냥 현재 뛸 수 있는 체력을 말한 것」. 지금 킥오프하면 시작하는 체력
   (matchStartFit — 컨디션 − 잔여 경기 피로)을 게이지로 보여준다. 다리가 무거우면 🦵 표시. */
function staSub(p){
  const f=matchStartFit(p);
  const col = f>=80?"#3fb950" : f>=66?"#56d364" : f>=55?"#d29922" : "#f85149";
  return `<i class="condBar"><i style="width:${clamp(f,4,100)}%;background:${col}"></i></i><b style="color:${col};font-weight:800">${f}</b>`
       + (((p&&p.mFat)||0)>=0.25?' <span title="지난 경기의 잔여 피로 — 다리가 무겁습니다">🦵</span>':"");
}
function fmSubFor(t,p,slot){
  const m=fmSubMode();
  return m==="ovr" ? ovrSub(p) : m==="fam" ? famSub(t,p,slot) : m==="sta" ? staSub(p) : condSub(p);
}
/* 🎚️ 선발 라인업 프리뷰도 같은 전환 (제보 — 「왜 컨디션만 표시되냐」) */
function fmSubModePrev(){ return (typeof G!=="undefined" && G && G.fmSubPrev) ? G.fmSubPrev : "cond"; }
function setFmSubPrev(m){
  if(typeof G!=="undefined" && G){ G.fmSubPrev=m; }
  try{ if(inLineupPreview && pendingLiveM) $("#main").innerHTML=lineupPreviewLayout(pendingLiveM, pendingLiveTag); }catch(e){}
}
function fmSubForPrev(t,p,slot){
  const m=fmSubModePrev();
  return m==="ovr" ? ovrSub(p) : m==="fam" ? famSub(t,p,slot) : m==="sta" ? staSub(p) : condSub(p);
}
/* 🎚️ 경기 중 전술 화면도 같은 전환 (제보) — 경기 중이라 기본은 「체력」, 나머지 셋은 전술창과 동일 */
function fmSubModeLive(){ return (typeof G!=="undefined" && G && G.fmSubLive) ? G.fmSubLive : "fit"; }
function setFmSubLive(m){ if(typeof G!=="undefined" && G){ G.fmSubLive=m; } renderLiveTactics(); }
function fmSubForLive(t, x, slot){
  const m=fmSubModeLive();
  return m==="cond" ? condSub(x.p) : m==="ovr" ? ovrSub(x.p) : m==="fam" ? famSub(t,x.p,slot) : fitSub(x.fit, x.y);
}
function condSub(p){
  /* 🎨 전술판 리마스터 — 「컨디션 100」 텍스트 대신 바 게이지 + 숫자 (칸 높이 고정의 일부) */
  const c=mor(p.cond), col=condCol(c);
  return `<i class="condBar"><i style="width:${clamp(c,4,100)}%;background:${col}"></i></i><b style="color:${col};font-weight:800">${c}</b>`
       + (p.inj>0?' <span style="color:#f85149">🚑</span>':"");
}
function fitSub(fit, yc){
  const f=Math.round(fit||0), col=fitColOf(f);
  return `<i class="condBar"><i style="width:${clamp(f,4,100)}%;background:${col}"></i></i><b style="color:${col};font-weight:800">${f}</b>` + (yc?' 🟨':"");
}
function fmPlayerCard(t, p, slot, opt){
  opt=opt||{};
  const rd=getRole(t,p,slot), R=ROLE_BY_KEY[rd.r];
  const dutyN=DUTY_N[rd.d]||rd.d;
  const fam=getPosFam(p, slot);
  const famCol = fam>=90?"#3fb950" : fam>=60?"#56d364" : fam>=30?"#d29922" : "#f85149";
  /* ⚠ 이름에 걸려 있던 openPlayerMenu 를 뺐다. 포메이션에서 자리를 옮기려고 카드를 누를 때마다
     선수 메뉴가 튀어나와 배치가 사실상 불가능했다. 프로필은 오른쪽 명단에서 이름을 눌러 본다.
     이제 카드 아무 데나 누르면 "선택"이고, 역할 버튼만 따로 동작한다. */
  return `<div class="fmCard ${opt.picked?'picked':''}" onclick="swapSel(${p.id})"
      draggable="true" ondragstart="dragP(event,${p.id})" ondragover="overP(event)" ondragleave="leaveP(event)" ondrop="dropP(event,${p.id})"
      oncontextmenu="return false;">
    <button class="fmCardRole" onclick="event.stopPropagation();openRoleMenu(event,${p.id},'${slot}')"
      title="역할 변경">${R?R.k:"?"}<span class="rd">${dutyN}</span><span class="cw">▾</span></button>
    <div class="fmCardName">
      <span class="fmDot" style="background:${famCol}"></span>
      <b class="pos-${p.pos}">${nmF(p)}</b>
    </div>
    ${opt.sub?`<div class="fmCardSub">${opt.sub}</div>`:""}
  </div>`;
}
/* FM식 짧은 슬롯 표기 — D(C), M(R) 처럼 */
const SLOT_SHORT={GK:"GK", SW:"SW",
  LB:"D (L)", LCB:"D (C)", CB:"D (C)", RCB:"D (C)", RB:"D (R)",
  LWB:"WB (L)", RWB:"WB (R)",
  LDM:"DM", DM:"DM", RDM:"DM",
  LM:"M (L)", LCM:"M (C)", CM:"M (C)", RCM:"M (C)", RM:"M (R)",
  LAM:"AM (L)", AM:"AM (C)", RAM:"AM (R)", LW:"AM (L)", RW:"AM (R)",
  LS:"ST (C)", ST:"ST (C)", RS:"ST (C)"};
function fmTopBar(t, xi, formName){
  const T=TAC(t);
  /* ⚠ TAC(t) 는 이미 0~4 를 0~2 로 바꿔 놓은 값이다. 여기서 tacVal 을 한 번 더 씌우면
     0~2 를 다시 반으로 나눠 0~1 이 되어, 화면 눈금이 통째로 아래로 밀린다.
     실제로 "높은 압박(3)"과 "극한 압박(4)"이 둘 다 "보통"으로, "공격적/매우 공격적"이
     "균형"으로 표시돼 설정이 안 먹는 것처럼 보였다. 저장은 정상이었고 표시만 틀렸다.
     0~2 스케일을 0~4 눈금으로 되돌리려면 그냥 2를 곱하면 된다. */
  const ment=clamp(Math.round(T.mentality*2),0,4);
  const mentN=["매우 수비적","수비적","균형","공격적","매우 공격적"][ment];
  const tk=clamp(Math.round(T.tackle*2),0,4);
  const fam=Math.round(famLive(t));   // 🧩 경기 중에는 킥오프 시점 값으로 통일 (제보)
  const gauge=(v,max,cls)=>{
    const on=Math.round(clamp(v/max,0,1)*5);
    return `<span class="fmGauge">${[0,1,2,3,4].map(i=>`<i class="${i<on?cls:""}"></i>`).join("")}</span>`;
  };
  return `<div class="fmBar">
    <div class="fmBarL">
      <span class="fmSelLbl" title="전술 슬롯 — 포메이션·배치·역할·세부 지시를 통째로 저장해 두고 상대에 따라 바꿔 씁니다.&#10;⚽ 선발·교체 명단은 전술 1·2·3이 함께 씁니다 — 전술을 바꿔도 인선은 그대로입니다.&#10;저장된 슬롯끼리 전환할 때는 조직력이 그대로 따라오므로 페널티가 없습니다.&#10;훈련일에는 지금 안 쓰는 슬롯의 조직력도 함께 오릅니다(35%).&#10;클릭=전환 · 더블클릭=이름 붙이기 · 우클릭=비우기">📋 전술 ⓘ</span>
      ${[0,1,2].map(i=>{ const pf=presetFam(t,i);
        return `<span class="fmStep ${t.tactic.presetCur===i?"on":""}${tacPresets(t)[i]?" has":""}"
        onclick="usePreset(${i})" ondblclick="event.preventDefault();renamePreset(${i})"
        oncontextmenu="event.preventDefault();clearPreset(${i});return false;"
        title="전술 ${i+1} — ${presetLabel(t,i)}${pf!=null?` · 친숙도 ${pf}`:""}&#10;클릭 전환 · 더블클릭 이름 · 우클릭 비우기">${presetName(t,i)||(i+1)}</span>`; }).join("")}
      <select class="fmSel wide" onchange="setForm(this.value)">
        ${formListSorted().map(f=>`<option value="${f}" ${T.formation===f?"selected":""}>${f}</option>`).join("")}
      </select>
      <span class="fmSelLbl">압박</span>
      <select class="fmSel" onchange="setTac('press',this.value)">
        ${[0,1,2,3,4].map(i=>`<option value="${i}" ${clamp(Math.round(T.press*2),0,4)===i?"selected":""}>${tacLabel("press",i)}</option>`).join("")}
      </select>
      <span class="fmSelLbl">플레이 성향</span>
      <select class="fmSel" onchange="setMent(this.value)">
        ${[0,1,2,3,4].map(i=>`<option value="${i}" ${ment===i?"selected":""}>${["매우 수비적","수비적","균형","공격적","매우 공격적"][i]}</option>`).join("")}
      </select>
      <button class="fmDetailBtn ${tacDetailOpen?"on":""}" onclick="toggleTacDetail()">⚙️ 세부 전술 ${tacDetailOpen?"▲":"▼"}</button>
      ${(typeof inLiveTactics!=="undefined" && inLiveTactics && !(typeof liveM!=="undefined" && liveM && liveM.opts && liveM.opts.pvp))
        ? `<button class="fmDetailBtn ${liveAdvOpen?"on":""}" onclick="toggleLiveAdvice()">📋 ${acName()}의 조언 ${liveAdvOpen?"▲":"▼"}</button>` : ""}
      ${(typeof inLiveTactics!=="undefined" && inLiveTactics)
        ? `<button class="fmDetailBtn ${(typeof liveOppOpen!=="undefined"&&liveOppOpen)?"on":""}" onclick="toggleLiveOpp()">🔭 상대 포메이션 ${(typeof liveOppOpen!=="undefined"&&liveOppOpen)?"▲":"▼"}</button>` : ""}
    </div>
    <div class="fmBarR">
      <div class="fmMeter"><span>친숙도${famFresh(t)?` <b style="color:var(--green)" title="최근 이 전술로 실전을 치렀습니다 — 쉬어도 깎이지 않습니다">⚡${t._famUseL}일</b>`:""}</span>${gauge(fam,100,"g")}</div>
      <div class="fmMeter"><span>강도</span>${gauge(tk+1,5,"o")}</div>
    </div>
  </div>`;
}
/* 선발 정보 표 한 줄
   ⚠ 이름을 fmRow 로 두면 프로필 화면의 "능력치 한 줄" fmRow 를 덮어써서
     선수 프로필의 능력치 표가 통째로 깨진다. 반드시 다른 이름을 쓴다. */
/* 나이 한 칸 — 색으로 세대가 보인다: 유망주(초록) · 전성기(기본) · 관리(노랑) · 노장(주황·빨강) */
/* 🔋 경기 중 체력(fit) 색.
   ⚠ 제보 — 「체력이 낮아도 전부 초록으로 보인다」.
      예전 눈금(80·65·50)은 컨디션(0~100)용 감각으로 잡혀 있었다. 그런데 경기 중 체력은
      90분을 완주해도 평균 70 언저리까지만 떨어진다 — 즉 사실상 모든 선수가 늘 초록이었다.
      실제 분포(60분 73 · 90분 70 · 하위 10% 57)와 부상 위험 문턱(72)에 맞춰 다시 잡는다. */
function fitColOf(v){
  const f=Math.round(v||0);
  return f>=85 ? "#3fb950"      // 팔팔하다
       : f>=76 ? "#56d364"      // 아직 괜찮다
       : f>=68 ? "#d29922"      // 슬슬 무거워진다
       : f>=60 ? "#ff9d5c"      // 교체를 고민할 때 (부상 위험이 붙기 시작하는 구간)
       :         "#f85149";     // 한계
}
/* 🔋 명단 표의 몸 상태 한 칸 — 선발·교체·그 외 명단이 전부 같은 모양을 쓴다.
   ⚠ 제보 — 「선발 명단은 하트와 숫자로 나오는데 벤치·그 외 명단은 그냥 초록 숫자라
     서로 다른 눈금처럼 보인다」. 아이콘을 색에서 뽑아 쓰므로 둘이 어긋날 수 없다.
   useFit=true 면 경기 중 체력 눈금(주황 한 칸이 더 있다)을 쓴다. */
function bodyIconOf(col){
  return col==="#3fb950" ? "💚" : col==="#56d364" ? "💛"
       : col==="#d29922" ? "🧡" : col==="#ff9d5c" ? "🧡" : "❤️";
}
function bodyCell(v, useFit){
  const n=Math.round(v||0);
  const col=useFit ? fitColOf(n) : condCol(n);
  return `<td class="fmCond" style="color:${col};font-weight:800">${bodyIconOf(col)}<span style="font-size:11px"> ${n}</span></td>`;
}
/* 컨디션 색 — 명단 어디서든 같은 눈금을 쓴다 (선발 행의 하트 아이콘과 같은 기준) */
function condCol(v){
  const c=Math.round(v||0);
  return c>=88 ? "#3fb950" : c>=72 ? "#56d364" : c>=58 ? "#d29922" : "#f85149";
}
/* ⚠ 제보 — 벤치 명단에서 나이에 색이 붙어 있어 「많으면 빨강」이 먼저 눈에 들어왔다.
   교체를 고를 때 급한 건 나이가 아니라 지금 뛸 수 있는 몸 상태다.
   나이는 평범하게 적고, 색은 컨디션 쪽으로 옮긴다. */
function fmAgeCell(p){
  const a=G.season-(p.by||2000);
  return `<td class="fmAge">${a}</td>`;
}
/* ⚠ 제보 원문 — 「선수교체시 이름이 몇몇은 안보여요」.
   원인: 전술판 표에서 이름(.fmName) 열이 다섯 번째에 있었다. 폰(420px)에서 표는 582px라
   이름 열이 x=385~459 — 화면 밖이다. 스크롤해야 겨우 보였다. 반면 「그 외 명단」은
   별도 스크롤 박스라 좁게 접혀 이름이 보였다 → 「몇몇만 보인다」.
   .fmName 은 이미 position:sticky; left:0 으로 「맨 앞에 붙어 따라다니게」 만들어 둔 열이다
   (경기 중 표 fmLiveTable 은 실제로 맨 앞에 둔다). 여기만 순서가 옛날 그대로였다.
   ─ 이름을 맨 앞으로 옮겨 두 표의 열 순서를 맞춘다. */
/* ⛔ ⚠ 제보 원문 — 「'스쿼드' 탭에 가면 이 선수가 출장 정지를 몇 회 당했는지 바로 알 수 있는데
   '전술' 탭은 이 부분이 미구현이다. 전술 탭에서도 출장 정지가 몇 회 남았는지 알 수 있게 해 달라」.
   징계 장부는 대회별로 따로 있다 — 리그(ban) · EACL(banE) · 클럽월드컵(banC).
   지금 다음 경기 기준으로 실제로 못 뛰는 것부터 앞에 적고, 다른 대회 징계는 뒤에 덧붙인다. */
function banLabel(p, brief){
  if(!p) return "";
  const parts=[];
  const now=(typeof banNow==="function") ? banNow(p) : (p.ban||0);
  if(p.ban>0)  parts.push(`출장정지 ${p.ban}경기`);
  if(p.banE>0) parts.push(`${(typeof eaclShort==="function"?eaclShort():"EACL")} ${p.banE}경기`);
  if(p.banC>0) parts.push(`${(typeof cwcShort==="function"?cwcShort():"클럽월드컵")} ${p.banC}경기`);
  if(!parts.length) return "";
  if(brief) return now>0 ? parts[0] : parts.join(" · ");
  return parts.join(" · ") + (now>0 ? "" : " (다음 경기에는 뛸 수 있습니다)");
}
/* 전술판 상태 칸 — 부상·징계·경고누적을 아이콘과 설명으로 */
function fmStateCell(p){
  /* 🚑 ⚠ 제보 원문 — 「최근 패치 이후로 전술 탭에서 부상 선수 몇 주 남았는지 안 보여요」.
     출장정지 표시를 넣으면서 이 칸을 아이콘 하나로 줄였는데, 남은 주수가 툴팁으로만 남아
     폰에서는 확인할 방법이 없어졌다. 징계 칩과 같은 모양으로 숫자를 다시 세운다. */
  if(p.inj>0){
    const w=(typeof injWeeksLeft==="function") ? (injWeeksLeft(p)||p.inj) : p.inj;
    return `<span style="color:#f85149;white-space:nowrap" title="부상 — 복귀까지 약 ${w}주">🚑<b style="font-size:10px;margin-left:1px">${w}주</b></span>`;
  }
  const bl=banLabel(p);
  if(bl) return `<span style="color:#f85149" title="${bl}">⛔<b style="font-size:10px;margin-left:1px">${(p.ban||p.banE||p.banC)|0}</b></span>`;
  if(p._yc>=1) return `<span style="color:#d29922" title="경고 ${p._yc}장 — 한 장 더 받으면 출장정지">▣</span>`;
  return '<span style="color:#3fb950">✓</span>';
}
function fmSquadRow(t, p, slotLabel, slot, idx){
  const rd=getRole(t,p,slot);
  const R=ROLE_BY_KEY[rd.r];
  const opts=rolesSortedFor(p, slot);      // 🎓 익숙한 역할이 위로
  const warn = fmStateCell(p);   // ⛔ 징계는 남은 경기 수까지 (제보)
  const A=affLabel(aff(p));
  const mt=moodTag(p);
  const react=`<span class="fmReact ${mt.c}">${mt.t}</span>`;
  const rating = p.apps ? (p.seasonRating||0).toFixed(2) : "-";
  const rCol = p.apps ? (p.seasonRating>=7.40?"#3fb950":p.seasonRating>=6.90?"#c9d1d9":"#d29922") : "#8b949e";
  /* 행 전체가 터치 영역이다. 예전에는 이름 칸(td.fmName)에만 onclick 이 걸려 있어서
     폰에서는 이름 위를 정확히 눌러야만 선택이 됐다 — 교체가 사실상 불가능했다.
     역할·임무 드롭다운은 자기 클릭을 따로 잡으므로(stopPropagation) 서로 방해하지 않는다. */
  return `<tr class="fmTr rowPick ${selSwap===p.id?'picked':''} ${swapFitCls(t,p)}"
      onclick="swapSel(${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})"
      draggable="true" ondragstart="dragP(event,${p.id})" ondragover="overP(event)" ondragleave="leaveP(event)" ondrop="dropP(event,${p.id})">
    <td class="fmName">
      <span class="sqNo">${p.no||"-"}</span>
      <b class="clickable" onclick="event.stopPropagation();openPlayerMenu(event,${p.id})">${nmF(p)}</b>${
      /* 🚪 제보 — 벤치의 ⬇ 제외와 같은 자리에서 주전도 그 외 명단으로 내릴 수 있다.
         🧤 요청 「골키퍼도 선발 제외할수있게하자」 — 골문도 비울 수 있다. */
      `<button class="mini" style="padding:1px 7px;font-size:10.5px;margin-left:5px" title="${(p.pos==="GK"||slot==="GK")?"그 외 명단으로 내립니다 — 골문이 빈 자리로 남습니다 (열한 명을 채워야 경기를 시작할 수 있습니다)":"그 외 명단으로 내립니다 — 이 자리는 빈 자리로 남습니다 (열한 명을 채워야 경기를 시작할 수 있습니다)"}"
         onclick="event.stopPropagation();xiOut(${p.id})">⬇ 제외</button>`}</td>
    <td class="fmSlot">${slotLabel}</td>
    <td onclick="event.stopPropagation()"><select class="fmRoleSel" onchange="fmSetRole(${p.id},this.value)">
      ${opts.map(r=>`<option value="${r.k}" ${r.k===rd.r?"selected":""}>${r.k} · ${r.n}</option>`).join("")}
    </select></td>
    <td onclick="event.stopPropagation()"><select class="fmRoleSel duty" onchange="fmSetDuty(${p.id},this.value)">
      ${(R?R.duty:["S"]).map(d=>`<option value="${d}" ${d===rd.d?"selected":""}>${DUTY_N[d]||d}</option>`).join("")}
    </select></td>
    <td class="fmStars">${roleStarsFor(t,p,slot).replace(/ title="[^"]*"/,"")}</td>
    <td class="fmPos pos-${p.pos}">${prefSlotOf(p)}</td>
    ${fmAgeCell(p)}
    ${bodyCell(p.cond)}
    <td class="fmOpt">${warn}</td>
    <td class="fmOpt">${react}</td>
    <td class="fmRt fmOpt" style="color:${rCol}">${rating}</td>
  </tr>`;
}
function fmSetRole(pid, rk){
  const t=userTeam(); const R=ROLE_BY_KEY[rk]; if(!R) return;
  const cur=(t.tactic.role&&t.tactic.role[pid])||{};
  setRole(pid, rk, R.duty.includes(cur.d)?cur.d:R.duty[0]);
}
function fmSetDuty(pid, dk){
  const t=userTeam();
  const p=t.players.find(x=>x.id===pid); if(!p) return;
  const xi=bestXI(t), slotOf=computeRenderSlots(t,xi);
  const rd=getRole(t,p,slotOf[p.id]||prefSlotOf(p));
  setRole(pid, rd.r, dk);
}
let FMTAB="info";           // 전술판 우측 탭: info=선발 정보 · kick=전담 키커
/* 🎯 전담 키커 패널 — 종류별 1~3순위. 능력치 힌트(PK/FK/코너)를 함께 보여 준다. */
function kickerPanel(t, xi){
  const K=kickersOf(t);
  /* ⚠ 제보 — 「키커 지정 명단에 19명밖에 안 나온다. 부상·출장정지 선수가 빠지는 듯한데,
     임대 보낸 선수 빼고 전원을 고를 수 있게 해달라」. 맞는 지적 — 키커 지정은 우선순위
     명단일 뿐이고, 경기에서는 그라운드에 있는 최상위 순번이 차므로 다쳐 있어도 지정해 둘
     수 있어야 한다. 임대·군복무만 빼고 전원을 올리되, 상태를 표시한다. */
  const _kSt=(p)=>p.inj>0?" 🚑":p.ban>0?" ⛔":(p.sulk>0?" 😤":"");
  const kPool=t.players.filter(p=>!p.loan && !p.army);
  const pool=kPool.slice().sort((a,b)=>b.ovr-a.ovr);
  const hint=(p,kind)=>{
    const a=p.attr||{};
    const v=kind==="pk"?(a.pen||0):kind==="fk"?(a.fre||0):(a.cor||0);
    return attr20(v);
  };
  /* ⚠ 제보 — 「킥커 목록이 능력치순이 아니라 뒤죽박죽이라 고르기 불편하다」.
     예전에는 종합(ovr) 순으로만 정렬해서, 페널티킥을 잘 차는 선수가 목록 아래에 묻혀 있었다.
     이제 그 항목의 능력치 순으로 세우고, 「✨ 능력치순 자동」으로 한 번에 채울 수 있게 한다. */
  const poolBy=(kind)=>kPool.slice().sort((a,b)=>{
    const d=hint(b,kind)-hint(a,kind);
    if(d) return d;
    const c=(b.attr&&b.attr.cmp||0)-(a.attr&&a.attr.cmp||0);   // 동점이면 침착성
    return c || (b.ovr-a.ovr);
  });
  const row=(kind,label,attrName)=>{
    const cur=K[kind]||[];
    const ps=poolBy(kind);
    return `<div style="margin-bottom:12px"><b>${label}</b> <span class="small">— ${attrName} 능력치가 성공률을 좌우합니다</span>
      <button class="mini" style="margin-left:6px;padding:2px 8px;font-size:11px" onclick="kickAuto('${kind}')">✨ 능력치순 자동</button>
      <button class="mini" style="padding:2px 8px;font-size:11px" onclick="kickClear('${kind}')">↺ 비우기</button><br>
      ${[0,1,2].map(i=>`<select style="max-width:190px;margin:4px 4px 0 0" onchange="setKicker('${kind}',${i},this.value)">
        <option value="">${i+1}순위 — 자동</option>
        ${ps.map(p=>`<option value="${p.id}" ${cur[i]===p.id?"selected":""}>${p.name}${_kSt(p)} (${attrName} ${hint(p,kind)}${(p.attr&&p.attr.cmp)?` · 침착 ${attr20(p.attr.cmp)}`:""})</option>`).join("")}
      </select>`).join("")}
      ${cur.filter(Boolean).length?`<div class="small" style="margin-top:4px;color:var(--sub)">지정: ${cur.filter(Boolean).map((id,i)=>{const q=t.players.find(x=>x.id===id); return q?`${i+1}. ${q.name}(${hint(q,kind)})`:"";}).filter(Boolean).join(" · ")}</div>`:""}</div>`;
  };
  /* 🥅 승부차기 — 순서가 곧 전략이다. 1~5번을 미리 정해 둔다. */
  const so=K.so||[];
  const soHint=(p)=>{ const a=p.attr||{}; return `PK ${attr20(a.pen||0)} · 침착 ${attr20(a.cmp||0)}`; };
  const soRow=`<div style="margin-bottom:6px"><b>🥅 승부차기 순서</b>
      <span class="small">— 연장까지 승부가 안 나면 이 순서로 찹니다 (페널티킥·침착성이 성공률을 좌우)</span>
      <button class="mini" style="margin-left:6px;padding:2px 8px;font-size:11px" onclick="soAuto()">✨ 능력치순 자동</button>
      <button class="mini" style="padding:2px 8px;font-size:11px" onclick="soClear()">↺ 비우기</button><br>
      ${[0,1,2,3,4].map(i=>`<select style="max-width:200px;margin:4px 4px 0 0" onchange="setKicker('so',${i},this.value)">
        <option value="">${i+1}번 — 자동</option>
        ${pool.map(p=>`<option value="${p.id}" ${so[i]===p.id?"selected":""}>${p.name}${_kSt(p)} (${soHint(p)})</option>`).join("")}
      </select>`).join("")}
      <p class="small" style="margin-top:6px;color:var(--sub)">지정한 선수가 <b>승부차기 시점에 그라운드에 없으면</b>(교체·퇴장) 건너뛰고 다음 순번이 찹니다.
        6번 이후와 서든데스는 남은 선수 중 능력치 순으로 이어집니다.</p></div>`;
  return `<div style="padding:6px 4px">
    <p class="small" style="margin-bottom:10px">그라운드에 있는 <b>가장 높은 순위</b>의 선수가 찹니다. 전원 벤치·결장이면 엔진이 능력치로 자동 선택합니다.</p>
    ${row("pk","🅿️ 페널티킥 키커","페널티킥")}
    ${row("fk","🎯 프리킥 키커","프리킥")}
    ${row("ck","🚩 코너킥 키커","코너킥")}
    <div style="border-top:1px solid #21262d;margin:10px 0 12px"></div>
    ${soRow}
  </div>`;
}
const REST_PAGE=6;          // "그 외 명단" 한 페이지에 보여줄 인원
/* 벤치·그 외 명단 보기 정렬 — 열 머리글을 눌러 정렬한다. 표시만 바뀌고
   S번호(실제 벤치 슬롯)는 선수에게 붙어 다닌다. 두 명단이 각자의 정렬 상태를 갖는다. */
let BENCH_SORT={k:"idx", d:-1}, REST_SORT={k:"idx", d:-1};
function squadSortVal(p, k){
  switch(k){
    case "star": try{ return prefStarVal(p); }catch(e){ return 0; }
    case "pos":  return posSortIdx(p);            // 🧭 제보 — 세부 자리 차례로 (GK·RB·CB·LB·DM…ST)
    case "age":  return G.season-(p.by||2000);
    case "cond": return p.cond||0;
    case "mood": return p.morale||0;
    case "rt":   return p.seasonRating||0;
  }
  return 0;
}
function squadViewSort(arr, st){
  const withI=arr.map((p,i)=>[p,i]);
  if(!st || st.k==="idx") return withI;
  const {k,d}=st;
  return withI.sort((a,b)=>{
    if(k==="name") return a[0].name.localeCompare(b[0].name,"ko")*d;
    const c=(squadSortVal(a[0],k)-squadSortVal(b[0],k))*d;
    /* ⚠ 능력 동률은 "화면에 보이는 별"(prefStarVal) → 종합치 순으로 푼다 — 별 역전 금지 */
    return c || (squadSortVal(b[0],"star")-squadSortVal(a[0],"star")) || (playerLevel(b[0])-playerLevel(a[0]));
  });
}
/* 벤치 나열 순서 — 감독이 직접 정한 순서(benchSel)가 없을 때 줄 세우는 기준.
   🧭 제보 — 「경기 중 '전술' 화면에서의 '교체 슬롯'」도 같은 차례를 쓴다.
      예전에는 라인 배열(_BENCH_BAND)을 따로 돌아 전술 탭·스쿼드 탭과 순서가 달랐다. */
function benchLineIdx(p){ return posSortIdx(p); }
function benchViewSort(arr){
  if(BENCH_SORT && BENCH_SORT.k!=="idx") return squadViewSort(arr, BENCH_SORT);
  /* 기본 정렬 — 라인 순서 (제보: 교체 대기가 우윙·스트라이커·좌윙 순으로 섞여 보인다) */
  return arr.map((p,i)=>[p,i]).sort((a,b)=>benchLineIdx(a[0])-benchLineIdx(b[0]) || a[1]-b[1]);
}
function sqSort(scope, key){
  const st=scope==="bench"?BENCH_SORT:REST_SORT;
  if(st.k===key) st.d=-st.d;
  else { st.k=key; st.d=(key==="name"||key==="pos")?1:-1; }   // 이름·포지션은 오름차순부터, 수치는 높은 순부터
  /* ⚠ 제보 원문 — 「선수교체시 나이 차순 누르고 교체시 라인선택 오류」.
     폰에서는 나이·컨디션 머리글이 화면 밖이라 표를 오른쪽으로 밀어야 누를 수 있다.
     그런데 누르는 순간 표를 통째로 다시 그리면서 가로 스크롤이 0으로 튕겨,
     같은 자리에 있던 손가락 밑의 열·행이 바뀌어 엉뚱한 칸을 고르게 됐다.
     ─ 보고 있던 자리를 그대로 유지한 채 다시 그린다. */
  let _sx=0, _sy=0, _ry=0;
  try{
    const sc=document.querySelector(".tblScroll");
    if(sc){ _sx=sc.scrollLeft; _sy=sc.scrollTop; }
    const rs=document.querySelector(".tblScroll div[style*='overflow-y']");
    if(rs) _ry=rs.scrollTop;
  }catch(e){}
  const _restore=()=>{ try{
    const sc=document.querySelector(".tblScroll");
    if(sc){ sc.scrollLeft=_sx; sc.scrollTop=_sy; }
    const rs=document.querySelector(".tblScroll div[style*='overflow-y']");
    if(rs && _ry) rs.scrollTop=_ry;
  }catch(e){} };
  try{ if(typeof inLiveTactics!=="undefined" && inLiveTactics && liveM){ renderLiveTactics(); _restore(); return; } }catch(e){}
  refreshTactics(); _restore();
}
function sqTh(scope, key, label, colspan, opt){
  const st=scope==="bench"?BENCH_SORT:REST_SORT;
  const on=st.k===key;
  /* opt=true 인 열은 본문과 똑같이 폰에서 접힌다 — 이게 어긋나면 머리글과 값이 한 칸씩 밀린다 */
  return `<td ${colspan?`colspan="${colspan}"`:""} class="small${opt?" fmOpt":""}" style="cursor:pointer;font-weight:700;white-space:nowrap;color:${on?"var(--gold)":"var(--sub)"};padding:4px 6px"
    onclick="sqSort('${scope}','${key}')">${label}${on&&key!=="idx"?(st.d>0?" ▲":" ▼"):""}</td>`;
}
/* 전술창 벤치/그 외 명단 머리글 — 본 표의 열 배치(10칸)에 맞춘다 */
function sqHeadRow(scope, sticky){
  /* ⚠ 그 외 명단은 스크롤 박스 "안"의 별도 표다 — 머리글을 바깥 표에 두면 열 폭이 서로 달라
     라인이 어긋난다. 반드시 같은 표 안에 sticky 로 앉힌다. */
  const st=sticky?"position:sticky;top:0;background:#161b22;z-index:2;":"";
  const cell=(h)=>h.replace(/style="/,`style="${st}`);
  /* ⚠ 머리글은 본문 subRow 와 열 개수·접힘(fmOpt)이 정확히 같아야 한다.
     예전에는 본문만 별점·경고·반응·평점 네 칸이 폰에서 접히고 머리글은 그대로여서,
     좁은 화면에서 라벨이 통째로 네 칸씩 밀려 보였다(제보 — 「그 외 명단이 개판」).
       본문 : 이름 · 슬롯 · (대기 colspan2) · 별 · 포지션 · 나이 · 컨디션 · 경고* · 반응* · 평점*
       (*표시가 폰에서 접히는 열)
     ⚠ 이름이 맨 앞이다 (제보 「선수교체시 이름이 몇몇은 안보여요」 — 아래 fmSquadRow 주석 참고) */
  const tds=[
    sqTh(scope,"name","선수"),
    sqTh(scope,"idx",scope==="bench"?"슬롯":"기본"),
    `<td colspan="2" style="${st}"></td>`,
    sqTh(scope,"star","능력"), sqTh(scope,"pos","포지션"),
    sqTh(scope,"age","나이"), sqTh(scope,"cond","컨디션"),
    `<td class="fmOpt" style="${st}"></td>`,
    sqTh(scope,"mood","반응",null,true), sqTh(scope,"rt","평점",null,true)
  ].map(h=>sticky?cell(h):h).join("");
  return `<tr class="fmTr sub" style="background:#0d1117">${tds}</tr>`;
}
/* 교체 명단(9명)을 직접 지정한다 — ⬆ 벤치로 올리고 ⬇ 그 외 명단으로 내린다.
   내린 선수는 자동 보충이 도로 데려오지 않도록, 빈 자리를 그 선수 제외 후보로 채워 9명을 확정한다. */
/* ── 🎯 전담 키커 — PK·FK·코너 각각 1~3순위. 경기에서는 그라운드에 있는 최상위 순위가 찬다. ── */
/* ⚠ 제보 — 「전술 1에서 정한 전담 키커가 전술 2에서는 공란이다」.
   키커가 t.tactic 안에 있어서, 프리셋을 전환할 때 전술과 함께 통째로 갈렸다.
   페널티를 누가 차느냐는 포메이션과 상관없는 문제다 — 팀에 하나만 둔다. */
function kickersOf(t){
  if(!t) return {pk:[], fk:[], ck:[]};
  if(!t.kickers){
    /* 옛 세이브 이전 — 지금 전술이나 프리셋 어디든 지정해 둔 게 있으면 살려 온다 */
    let src=(t.tactic&&t.tactic.kickers)||null;
    if(!src){
      try{ for(const ps of (t.tactic&&t.tactic.presets)||[])
             if(ps && ps.tac && ps.tac.kickers &&
                ["pk","fk","ck"].some(k=>(ps.tac.kickers[k]||[]).some(Boolean))){ src=ps.tac.kickers; break; } }catch(e){}
    }
    t.kickers = src ? {pk:(src.pk||[]).slice(), fk:(src.fk||[]).slice(), ck:(src.ck||[]).slice(), so:(src.so||[]).slice()}
                    : {pk:[], fk:[], ck:[], so:[]};
  }
  /* 🥅 so — 승부차기 키커 순서(1~5번). 경기 중 페널티킥(pk)과는 다른 명단이다. */
  for(const k of ["pk","fk","ck","so"]) if(!Array.isArray(t.kickers[k])) t.kickers[k]=[];
  /* 전술 쪽에도 같은 객체를 물려 둔다 — 매치엔진·AI 가 team.tactic.kickers 를 읽는다 */
  if(t.tactic) t.tactic.kickers=t.kickers;
  return t.kickers;
}
function setKicker(kind, idx, pid){
  const t=userTeam(), K=kickersOf(t);
  pid=pid?parseInt(pid,10):0;
  K[kind]=K[kind]||[];
  if(pid){ // 같은 선수를 다른 순위에 중복 지정하면 이전 자리를 비운다
    K[kind]=K[kind].map(x=>x===pid?0:x);
    K[kind][idx]=pid;
  } else K[kind][idx]=0;
  while(K[kind].length && !K[kind][K[kind].length-1]) K[kind].pop();
  saveGame(); refreshTactics();
}
/* 전담 키커 — 그 항목 능력치순으로 1~3순위를 한 번에 채운다 */
function kickAuto(kind){
  const t=userTeam(), K=kickersOf(t);
  const at=kind==="pk"?"pen":kind==="fk"?"fre":"cor";
  let xi=[]; try{ xi=xiStrength(t).xi||[]; }catch(e){ xi=[]; }
  const pool=(xi.length?xi:t.players.filter(avail));
  K[kind]=pool.slice().sort((a,b)=>((b.attr&&b.attr[at]||0)-(a.attr&&a.attr[at]||0))
    || ((b.attr&&b.attr.cmp||0)-(a.attr&&a.attr.cmp||0)) || (b.ovr-a.ovr))
    .slice(0,3).map(p=>p.id);
  saveGame(); refreshTactics();
}
function kickClear(kind){ const t=userTeam(); kickersOf(t)[kind]=[]; saveGame(); refreshTactics(); }
/* 승부차기 순서 — 능력치순 자동 채움 / 비우기 */
function soAuto(){
  const t=userTeam(), K=kickersOf(t);
  let xi=[]; try{ xi=xiStrength(t).xi||[]; }catch(e){ xi=[]; }
  if(!xi.length) xi=t.players.filter(avail);
  K.so=xi.slice().sort((a,b)=>pkSkillOf(b)-pkSkillOf(a)).slice(0,5).map(p=>p.id);
  saveGame(); refreshTactics();
}
function soClear(){ const t=userTeam(); kickersOf(t).so=[]; saveGame(); refreshTactics(); }
function benchPin(pid){
  const t=userTeam();
  if(Array.isArray(t.tactic.benchExcl)) t.tactic.benchExcl=t.tactic.benchExcl.filter(id=>id!==pid);
  /* ⚠ 판단 기준은 "직접 지정한 명단"이다 — 자동 보충까지 합친 9명으로 재면
     ⬇로 비워 둔 자리가 자동 보충으로 메워져 있어서 영원히 가득 찬 것으로 보인다. */
  const pool=benchPool(t);
  let sel=(t.tactic.benchSel||[]).filter(id=>pool.some(p=>p.id===id));
  if(!sel.length) sel=matchBench(t).map(p=>p.id);   // 지정 이력이 없으면 현재 벤치를 스냅샷
  if(sel.includes(pid)){ refreshTactics(); return; }
  if(sel.length>=9){ flash("직접 지정한 교체 명단이 이미 9명입니다. 먼저 한 명을 ⬇ 제외하세요.","warn"); refreshTactics(); return; }
  t.tactic.benchSel=[...sel, pid];
  t.tactic.benchManual=true;
  saveGame(); refreshTactics();
}
function benchUnpin(pid){
  const t=userTeam();
  /* 자리를 비워 둔다 — 곧바로 자동 보충해 버리면 "빼고 → 원하는 선수 넣기"가 안 된다.
     대신 제외 목록에 올려, 자동 보충이 이 선수를 도로 데려가는 것만 막는다. */
  t.tactic.benchSel=matchBench(t).map(p=>p.id).filter(id=>id!==pid);
  if(!Array.isArray(t.tactic.benchExcl)) t.tactic.benchExcl=[];
  if(!t.tactic.benchExcl.includes(pid)) t.tactic.benchExcl.push(pid);
  t.tactic.benchManual=true;         // 이제부터 자동 보충 없음 — 빈 자리는 빈 자리로 남는다
  saveGame(); refreshTactics();
}
/* 🚪 ⚠ 제보 원문 — 「'전술' 탭에서 포메이션을 짤 때에, '교체' 슬롯에서 한 명 한 명씩 '제외'
   버튼을 눌러 '그 외 명단' 으로 보낼 수 있는 것처럼, 주전으로 기본적으로 자리잡고 있는 선수들도
   '선발 정보' 슬롯에서 한 명 한 명씩 '제외' 버튼을 눌러 '그 외 명단' 으로 보낼 수 있으면 …
   (포메이션 그림은 선수가 빠진 포지션은 그냥 빈 포지션으로 구현 해주시면 될 것 같습니다!!)」.
   ─ 벤치의 ⬇ 제외와 완전히 같은 얼개다. 선발 명단을 지금 화면 그대로 확정한 뒤 그 한 명만 빼고,
     자동 편성이 도로 데려오지 않도록 제외 목록에 올린다. 자리는 빈 자리로 남는다.
   ─ 요청 「선발라인업을 다 꾸려야 경기를 시작할 수 있게 하자」 — 빈 자리가 남아 있으면
     진행 버튼이 경기를 시작하지 않고 전술 탭으로 돌려보낸다(xiGateStop). */
function xiExclHas(t, pid){
  try{ return !!(t && t.tactic && Array.isArray(t.tactic.xiExcl) && t.tactic.xiExcl.indexOf(pid)>=0); }
  catch(e){ return false; }
}
function xiIdsNow(t){
  try{ return xiStrength(t).xi.map(p=>p.id); }catch(e){ return (G.userXI||[]).slice(); }
}
function xiOut(pid){
  const t=userTeam(); if(!t) return;
  const T=t.tactic||(t.tactic={});
  const ids=xiIdsNow(t);
  if(ids.indexOf(pid)<0){ refreshTactics(); return; }
  G.userXI=ids.filter(id=>id!==pid);
  if(!Array.isArray(T.xiExcl)) T.xiExcl=[];
  if(T.xiExcl.indexOf(pid)<0) T.xiExcl.push(pid);
  T.xiManual=true;                                  // 이제부터 빈 자리는 빈 자리로 남는다
  /* 그 외 명단으로 — 자동 벤치 보충이 도로 데려가지 않게 (벤치 ⬇ 제외와 같은 목록을 쓴다) */
  if(!Array.isArray(T.benchExcl)) T.benchExcl=[];
  if(T.benchExcl.indexOf(pid)<0) T.benchExcl.push(pid);
  /* 자리·역할 표식을 지운다 — 안 지우면 빈 칸 계산이 그 선수를 계속 붙잡고 있다 */
  try{ if(T.slot) delete T.slot[pid]; if(T.zone) delete T.zone[pid]; if(T.role) delete T.role[pid]; }catch(e){}
  selSwap=null; saveGame(); refreshTactics();
}
/* 빈 자리에 그 외/벤치 선수를 세운다 — 클릭·드래그 양쪽에서 부른다 */
function xiIn(pid, slotName){
  const t=userTeam(); if(!t) return false;
  const p=t.players.find(x=>x.id===pid); if(!p || !avail(p)) return false;
  const T=t.tactic||(t.tactic={});
  const ids=xiIdsNow(t);
  if(ids.length>=11 || ids.indexOf(pid)>=0) return false;
  const ps=[...ids.map(id=>t.players.find(q=>q.id===id)).filter(Boolean), p];
  const frnLim=frnLimOf(t);
  if(ps.filter(frnQ).length>frnLim){
    gameAlert(`외국인 선수는 최대 ${frnLim}명까지 동시 출전 가능합니다 (${divName(t.div)} 규정 · 홈그로운 제외).`);
    return true;
  }
  if(ps.filter(q=>q.pos==="GK").length>1){ gameAlert("골키퍼는 한 명만 선발로 낼 수 있습니다."); return true; }
  /* 🧤 요청 — 마지막 한 자리는 골문 몫이다. 골키퍼 없이 열한 명을 채우려 하면 막는다
     (그대로 두면 선발을 읽을 때 엔진이 키퍼를 밀어 넣으며 방금 넣은 선수를 도로 빼낸다) */
  if(ids.length===10 && p.pos!=="GK"
     && !ids.some(id=>{ const q=t.players.find(x=>x.id===id); return q && q.pos==="GK"; })){
    flash("골문이 비어 있습니다 — 마지막 한 자리는 골키퍼 몫입니다. 골키퍼를 먼저 세워 주세요.","warn");
    selSwap=null; refreshTactics(); return true;
  }
  /* 🧤 요청 — 골문과 필드는 섞지 않는다 */
  if(slotName==="GK" && p.pos!=="GK"){ flash("골문에는 골키퍼만 세울 수 있습니다.","warn"); selSwap=null; refreshTactics(); return true; }
  if(slotName && slotName!=="GK" && p.pos==="GK"){ flash("골키퍼는 필드 자리에 세울 수 없습니다.","warn"); selSwap=null; refreshTactics(); return true; }
  G.userXI=[...ids, pid];
  if(Array.isArray(T.xiExcl))    T.xiExcl   =T.xiExcl.filter(id=>id!==pid);
  if(Array.isArray(T.benchExcl)) T.benchExcl=T.benchExcl.filter(id=>id!==pid);
  if(p.pos!=="GK" && slotName && slotName!=="GK"){
    try{ setSlot(t, pid, slotName); setZone(t, pid, SLOT_BAND[slotName]||p.pos); }catch(e){}
  }
  selSwap=null; saveGame(); refreshTactics(); return true;
}
/* ⚽ ⚠ 요청 원문 — 「그냥 시작이 안되게하자. FM 이 그렇거든? 선발라인업을 다 꾸려야 경기를
   시작할 수 있게 하자. 자동보충은 좀 뭐랄까.. 버그가 있을 수도 있을거같아」.
   ─ 킥오프 자동 보충을 걷어냈다. 명단이 미완성이면 경기가 시작되지 않고, 감독을 전술 탭으로 보낸다.
     (자동 편성 상태에서는 예전 그대로 엔진이 채운다 — 이 관문은 감독이 직접 자리를 비운 경우만 본다) */
function xiIncomplete(t){
  try{
    if(!t || !t.isUser || G.jobless) return null;
    if(!t.tactic || !t.tactic.xiManual) return null;
    const cur=(G.userXI||[]).map(id=>t.players.find(q=>q.id===id)).filter(q=>q && avail(q));
    const gk=cur.filter(q=>q.pos==="GK").length;
    if(cur.length<11) return `선발이 <b>${cur.length}명</b>입니다 — <b>${11-cur.length}자리</b>가 비어 있습니다.`;
    if(gk===0) return "골문이 비어 있습니다 — 골키퍼를 세워 주세요.";
    if(gk>1)   return "골키퍼가 두 명 이상입니다 — 한 명만 남겨 주세요.";
    return null;
  }catch(e){ return null; }
}
/* 오늘 내 경기가 시작되려는 참인가 — 리그·연습·대회·승강 PO 를 함께 본다 */
function xiGateDue(){
  try{
    if(G.jobless) return false;
    if(atMatchDay()) return true;
    if(G.phase==="po" && (G.poQueue||[]).length){
      const m=G.poQueue[0];
      return resolvePOid(m.h)===G.userTeamId || resolvePOid(m.a)===G.userTeamId;
    }
  }catch(e){}
  return false;
}
/* 관문 — 막았으면 true. 막을 때는 이유를 보여 주고 전술 탭으로 보낸다. */
function xiGateStop(force){
  try{
    const t=userTeam(); if(!t) return false;
    const why=xiIncomplete(t); if(!why) return false;
    if(!force && !xiGateDue()) return false;
    try{ gameAlert(`⚽ <b>선발 명단이 완성되지 않았습니다.</b>\n\n${why}\n\n열한 명(골키퍼 1명 포함)을 모두 채워야 경기를 시작할 수 있습니다.\n\n📋 전술 탭에서 빈 자리를 채워 주세요.`); }catch(e){}
    try{ show("tactics"); }catch(e){}
    return true;
  }catch(e){ return false; }
}
/* S1~S9 순서를 직접 바꾼다 — ▲▼ 로 한 칸씩. 순서는 지정 명단(benchSel)에 그대로 저장된다. */
function benchMove(pid, dir){
  const t=userTeam();
  const sel=matchBench(t).map(p=>p.id);          // 현재 벤치 순서를 통째로 스냅샷 (전원 명시화)
  const i=sel.indexOf(pid), j=i+dir;
  BENCH_SORT={k:"idx", d:-1};                    // 순서를 만지는 중이다 — 순서대로 보여 준다
  if(i<0 || j<0 || j>=sel.length){ refreshTactics(); return; }
  [sel[i], sel[j]]=[sel[j], sel[i]];
  t.tactic.benchSel=sel;
  t.tactic.benchManual=true;
  saveGame(); refreshTactics();
}
/* 🪑 벤치 두 자리의 순번을 맞바꾼다 (S3 ↔ S7) — 명단 구성은 그대로다 */
function benchSwapOrder(a, b){
  const t=userTeam();
  const sel=matchBench(t).map(p=>p.id);          // 현재 순서를 통째로 스냅샷
  const i=sel.indexOf(a), j=sel.indexOf(b);
  if(i<0 || j<0 || i===j){ refreshTactics(); return; }
  [sel[i], sel[j]]=[sel[j], sel[i]];
  t.tactic.benchSel=sel;
  t.tactic.benchManual=true;
  BENCH_SORT={k:"idx", d:-1};                    // 순서를 만졌으니 순서대로 보여 준다
  const pa=t.players.find(p=>p.id===a), pb=t.players.find(p=>p.id===b);
  try{ flash(`🪑 S${Math.min(i,j)+1} ↔ S${Math.max(i,j)+1} — ${pa?pa.name:""} · ${pb?pb.name:""} 순번을 바꿨습니다.`,"good"); }catch(e){}
  selSwap=null; saveGame(); refreshTactics();
}
function benchAutoReset(){
  const t=userTeam();
  t.tactic.benchSel=[]; t.tactic.benchExcl=[]; t.tactic.benchManual=false;
  saveGame(); refreshTactics();
}
function benchSortBtns(){
  const t=userTeam();
  const manual=t&&t.tactic&&t.tactic.benchManual;
  return manual?`<button class="mini" style="padding:2px 8px;font-size:11px;margin-left:8px" title="직접 편성을 지우고 자동 편성으로 돌아갑니다" onclick="benchAutoReset()">↺ 자동 편성</button>`:"";
}
let restPage=0;
function setRestPage(i){ restPage=i; refreshTactics(); }
/* 선발 + 벤치 + 미등록 표 */
function fmSquadTable(t, xi, slotOf, mb, rest, sulking, injured){
  const gkP=xi.find(p=>p.pos==="GK") || (xiGkEmptyEdit(t, xi) ? null : pickEmergencyGK(xi));
  const order=[];
  if(gkP) order.push([gkP,"GK","GK"]);
  for(const band of BANDS){
    for(const sl of (LIST_SLOTS[band]||ROW_SLOTS[band])){
      if(!sl) continue;
      for(const p of xi) if(p!==gkP && slotOf[p.id]===sl) order.push([p, SLOT_SHORT[sl]||sl, sl]);
    }
  }
  for(const p of xi) if(p!==gkP && !order.some(o=>o[0]===p)) order.push([p, prefSlotOf(p), prefSlotOf(p)]);
  /* 🚪 제보 — 감독이 비워 둔 선발 자리는 표에서도 빈 자리로 보인다 (벤치의 빈 자리 줄과 같은 얼개) */
  const _xiGap=Math.max(0, 11-order.length);
  const xiGapRows=(t.tactic && t.tactic.xiManual && _xiGap>0)
    ? Array.from({length:_xiGap},()=>`<tr class="fmTr sub"><td class="fmName"></td><td class="fmSlot sub">—</td>
        <td colspan="9" class="small" style="color:var(--sub)">빈 자리 — 포메이션 그림의 빈 칸을 누르거나, 아래 명단에서 선수를 골라 그 칸에 놓으면 채워집니다 <span style="color:var(--gold)">⚠ 열한 명을 다 채워야 경기를 시작할 수 있습니다</span></td></tr>`).join("")
    : "";
  const rows=order.map(([p,lbl,sl],i)=>fmSquadRow(t,p,lbl,sl,i)).join("")+xiGapRows;
  /* 벤치·미등록·결장 공통 행 */
  const subRow=(p, lbl, note, cls)=>`<tr class="fmTr sub ${cls||""} ${cls==="out"?"":"rowPick"} ${selSwap===p.id?'picked':''} ${cls==="out"?"":swapFitCls(t,p)}"
      ${cls==="out"?`oncontextmenu="showPlayerInfoPopup(event,${p.id})"`
        :`onclick="swapSel(${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})"
          draggable="true" ondragstart="dragP(event,${p.id})" ondragover="overP(event)" ondragleave="leaveP(event)" ondrop="dropP(event,${p.id})"`}>
    <td class="fmName">
      <span class="sqNo">${p.no||"-"}</span><b class="clickable" onclick="event.stopPropagation();openPlayerMenu(event,${p.id})">${nmF(p)}</b></td>
    <td class="fmSlot sub">${lbl}</td><td colspan="2" class="small fmSubLbl">${note}</td>
    <td class="fmStars">${prefStars(p).replace(/ title="[^"]*"/,"")}</td>
    <td class="fmPos pos-${p.pos}">${prefSlotOf(p)}</td>
    ${fmAgeCell(p)}
    ${bodyCell(p.cond)}
    <td class="fmOpt">${fmStateCell(p)}</td>
    <td class="fmOpt"><span class="fmReact ${moodTag(p).c}">${moodTag(p).t}</span></td>
    <td class="fmRt fmOpt">${p.apps?(p.seasonRating||0).toFixed(2):"-"}</td></tr>`;
  const emptyBenchRows = (t.tactic&&t.tactic.benchManual)   // 어떤 정렬에서도 빈 자리는 빈 자리로 보인다
    ? Array.from({length:Math.max(0,9-mb.length)},(_,k)=>`<tr class="fmTr sub"><td class="fmName"></td><td class="fmSlot sub">S${mb.length+k+1}</td>
        <td colspan="9" class="small" style="color:var(--sub)">빈 자리 — 그 외 명단에서 ⬆ 벤치로 채울 수 있습니다</td></tr>`).join("")
    : "";
  const bench=squadViewSort(mb, BENCH_SORT).map(([p,i])=>subRow(p, "S"+(i+1),
    /* ⚠ 제보 — 「자리를 바꾸는 버튼이 갑자기 없어졌다」.
       ▲▼ 를 「순서(S번호)로 정렬했을 때만」 그렸다. 이름·능력치 같은 다른 기준으로 한 번
       정렬하면 버튼이 통째로 사라져, 감독 눈에는 기능이 없어진 것으로 보였다.
       ─ 언제나 보여 준다. 다른 기준으로 보고 있었다면 누르는 순간 순서 보기로 돌아간다. */
    `교체 대기 <button class="mini" style="padding:1px 6px;font-size:10.5px;margin-left:4px" title="한 칸 위로 (S번호가 당겨집니다)" ${(BENCH_SORT.k==="idx"&&i===0)?"disabled":""}
       onclick="event.stopPropagation();benchMove(${p.id},-1)">▲</button><button class="mini" style="padding:1px 6px;font-size:10.5px" title="한 칸 아래로" ${(BENCH_SORT.k==="idx"&&i===mb.length-1)?"disabled":""}
       onclick="event.stopPropagation();benchMove(${p.id},1)">▼</button><button class="mini" style="padding:1px 7px;font-size:10.5px;margin-left:4px" title="그 외 명단으로 내립니다"
       onclick="event.stopPropagation();benchUnpin(${p.id})">⬇ 제외</button>`)).join("") + emptyBenchRows;
  /* 그 외 명단은 스쿼드가 커지면 20명을 넘어간다. 한 줄로 쭉 늘어놓으면 스크롤만 하다 끝나므로
     REST_PAGE 명씩 끊어 페이지로 넘긴다. */
  const restAll=squadViewSort(rest||[], REST_SORT).map(x=>x[0]);
  /* 페이지 넘김 대신 스크롤 — 전체 명단을 한 통에 담고 위아래로 훑는다 */
  const restRows=restAll.map(p=>subRow(p, "-",
    `<button class="mini" style="padding:1px 7px;font-size:10.5px" title="교체 명단(9명)에 넣습니다"
       onclick="event.stopPropagation();benchPin(${p.id})">⬆ 벤치</button>`, "rest")).join("");
  const restNav = `<span class="small" style="margin-left:auto">${restAll.length}명${restAll.length>7?" · 스크롤":""}</span>`;
  const outRows=[...(sulking||[]), ...(injured||[]).filter(p=>!(p.sulk>0))]
    .map(p=>subRow(p, "✕", p.sulk>0?`태업 ${p.sulk}R`:(p.inj>0?`부상 ${p.inj}주`:(banLabel(p)||"출장정지")), "out")).join("");
  return `<div class="fmTableWrap">
    <div class="fmTabs">
      <span class="fmTab ${FMTAB==="kick"?"":"on"} clickable" onclick="FMTAB='info';refreshTactics()">👁 선발 정보</span>
      <span class="fmTab ${FMTAB==="kick"?"on":""} clickable" onclick="FMTAB='kick';refreshTactics()">🎯 전담 키커</span>
      ${liveM?`<span class="fmChip">${mb.length}/9 교체</span>
      <span class="fmChip">${subChipTxt(liveMySide()||liveM.h)}</span>`:""}
      <span class="fmChip clickable" style="margin-left:auto;${autoFitOn()?"color:var(--gold);border-color:var(--gold)":""}"
        title="${autoFitOn()?"체력 우선 — 자리 능숙도와 함께 컨디션도 크게 봅니다. 지친 주전은 쉬게 하고 갓 회복한 선수를 올립니다."
                            :"실력 우선 — 컨디션과 상관없이 그 자리에 가장 잘 맞는 열한 명을 뽑습니다."}"
        onclick="G.opt=G.opt||{};G.opt.autoFit=${autoFitOn()?"false":"true"};saveGame();refreshTactics()">${autoFitOn()?"⚡ 체력 우선":"⚖️ 실력 우선"}</span>
      <span class="fmChip clickable" style="${swapRoleTac()?"":"color:var(--gold);border-color:var(--gold)"}"
        title="${swapRoleTac()?"전술 우선 — 벤치에서 선발로 올리면 그 자리에 내려둔 역할(나간 선수의 역할)을 그대로 물려받습니다. 눌러서 선수 우선으로 전환"
                              :"선수 우선 — 벤치에서 선발로 올리면 본인에게 직접 골라 뒀던 역할, 없으면 능숙도·적합도 최상위 역할이 기본값이 됩니다. 눌러서 전술 우선으로 전환"}"
        onclick="G.opt=G.opt||{};G.opt.swapRole='${swapRoleTac()?"fit":"tac"}';saveGame();refreshTactics()">${swapRoleTac()?"🧭 전술 우선":"🎓 선수 우선"}</span>
      <button class="mini" style="padding:4px 10px;font-size:11.5px"
        title="지금 포메이션 배치와 역할은 그대로 두고, 각 자리에 가장 잘 맞는 선수로 다시 뽑습니다"
        onclick="autoPickXI();selSwap=null;refreshTactics()">🔄 자동 선발</button>
    </div>
    ${FMTAB==="kick"?kickerPanel(t, xi):`<div class="tblScroll"><table class="fmTable">
      <tr><th>선수</th><th>선발</th><th>역할</th><th>임무</th><th>능력</th><th>포지션</th><th>나이</th><th>컨디션</th><th class="fmOpt">경고</th><th class="fmOpt">반응</th><th class="fmOpt">평점</th></tr>
      ${rows}
      <tr class="fmDiv"><td colspan="11"><span class="fmSecLbl clickable" title="눌러서 접기/펼치기" onclick="G.opt=G.opt||{};G.opt.foldBench=${G.opt&&G.opt.foldBench?"false":"true"};saveGame();refreshTactics()">${G.opt&&G.opt.foldBench?"▸":"▾"} 🪑 교체 명단 (${mb.length}/9)${t.tactic&&t.tactic.benchManual?` <span class="small" style="color:var(--gold)">직접 편성</span>`:""}</span>${G.opt&&G.opt.foldBench?"":benchSortBtns()}${
        (G.opt&&G.opt.foldBench)||matchBench(t).some(p=>p.pos==="GK") ? ""
        : `<span class="small" style="color:var(--red);margin-left:8px">⚠ 예비 골키퍼 없음 — 주전 키퍼가 다치면 필드 플레이어가 골문에 섭니다</span>`}</td></tr>
      ${G.opt&&G.opt.foldBench?"":sqHeadRow("bench")+bench}
      ${restAll.length?`<tr class="fmDiv"><td colspan="11"><div style="display:flex;align-items:center">
        <span class="fmSecLbl clickable" title="눌러서 접기/펼치기" onclick="G.opt=G.opt||{};G.opt.foldRest=${G.opt&&G.opt.foldRest?"false":"true"};saveGame();refreshTactics()">${G.opt&&G.opt.foldRest?"▸":"▾"} 📋 그 외 명단</span>${restNav}</div></td></tr>
      ${G.opt&&G.opt.foldRest?"":`<tr><td colspan="11" style="padding:0;border:0">
        <div style="max-height:266px;overflow-y:auto;overscroll-behavior:contain">
          <table class="fmTable" style="margin:0;width:100%">${sqHeadRow("rest", true)}${restRows}</table>
        </div></td></tr>`}`:""}
      ${outRows?`<tr class="fmDiv"><td colspan="11"><span class="fmSecLbl">🚑 출전 불가</span></td></tr>${outRows}`:""}
    </table></div>`}
    ${selSwap!==null?`<div class="msg good" style="margin-top:8px">🔁 <b>${t.players.find(p=>p.id===selSwap)?.name}</b> 선택됨 — 바꿀 선수를 클릭하세요. (같은 선수 다시 클릭 시 취소)
      <span class="small" style="display:block;margin-top:3px;opacity:.9">
        <span style="color:#3fb950">■</span> 그 자리를 소화할 수 있음 &nbsp;
        <span style="color:#d29922">■</span> 어색하지만 가능 &nbsp;
        <span style="opacity:.5">■</span> 해본 적 없는 자리</span></div>`:""}
  </div>`;
}
function tactics(){
  const t=userTeam();
  const S=xiStrength(t); const xi=S.xi;
  const bench=t.players.filter(p=>avail(p)&&!xi.includes(p)).sort((a,b)=>b.ovr-a.ovr);
  const injured=t.players.filter(p=>!avail(p));
  const sulking=t.players.filter(p=>p.sulk>0);
  const mb=matchBench(t); const mbIds=new Set(mb.map(p=>p.id));
  const benchRest=bench.filter(p=>!mbIds.has(p.id));
  // 자유 배치: 고정 슬라이스가 아니라 각 선수의 실제 배치 라인(zone)으로 그룹핑 — 드래그할 때마다 즉시 반영된다.
  const gkP=xi.find(p=>p.pos==="GK") || (xiGkEmptyEdit(t, xi) ? null : pickEmergencyGK(xi));
  const dfP=xi.filter(p=>getZone(t,p)==="DF"), mfP=xi.filter(p=>getZone(t,p)==="MF"), fwP=xi.filter(p=>getZone(t,p)==="FW");
  const liveFormName=formationLabel(t, xi);
  const slotOf=computeRenderSlots(t, xi);
  // 전술탭 선수 칩(이름+적합도 동그라미+별점)은 더 이상 마우스 hover 툴팁을 쓰지 않는다 — 대신
  // 칩 위에서 우클릭하면 showPlayerInfoPopup()이 오버롤·별점·선호 포지션을 인게임 팝업으로 보여준다.
  // 동그라미(posFitDot)·별점(ovrStars/slotStars)이 각자 갖고 있던 title은 예전 hover 툴팁 잔재이므로
  // 계속 제거해 우클릭 팝업과 중복되는 브라우저 기본 툴팁이 뜨지 않게 한다.
  const stripTitle=(html)=>html.replace(/ title="[^"]*"/, "");
  const chip=(p)=>fmPlayerCard(t, p, "GK", {picked:selSwap===p.id, sub:fmSubFor(t,p,"GK")});
  // 벤치·미등록 칩은 클릭·드래그로 계속 만지는 자리라 넉넉하게 키운다(.benchChip).
  // 별점은 "지금 배치된 자리"가 없으므로 선호 포지션 기준으로 보여준다(prefStars).
  const benchSwapChip=(p)=>`<div class="pchip benchChip ${selSwap===p.id?'picked':''} ${swapFitCls(t,p)}"
    draggable="true" ondragstart="dragP(event,${p.id})" ondragover="overP(event)" ondragleave="leaveP(event)" ondrop="dropP(event,${p.id})"
    onclick="swapSel(${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})"><b class="pos-${p.pos}" onclick="event.stopPropagation();openPlayerMenu(event,${p.id})">${nmF(p)}</b>${stripTitle(prefStars(p))}<div class="benchSub">${prefSlotOf(p)}</div></div>`;
  // 세부 지역(예: LB/CB/ST) 전용 칩 — 이름 옆 동그라미로 선호 포지션 적합도(FM처럼 초록/노랑/빨강)를 색으로만 보여주고,
  // 텍스트 정보는 우클릭 팝업으로만 확인한다(적합도 색은 시각적으로 이미 전달되므로 텍스트로 중복 설명하지 않는다).
  /* FM처럼 두 칸짜리 카드: 위 = 역할 버튼(클릭하면 역할 패널), 아래 = 선수 이름 */
  const pitchChip=(p,slot)=>fmPlayerCard(t, p, slot, {
    picked:selSwap===p.id, sub:fmSubFor(t,p,slot),
    extra:stripTitle(posFitDot(p,slot))+stripTitle(roleStarsFor(t,p,slot))
  });
  /* 선수를 고른 뒤 빈 자리를 누르면 그 자리로 옮긴다 — 드래그가 어려운 폰·패드용 경로.
     드래그(dropZone)와 결과가 같아야 하므로 같은 함수를 부른다. */
  const slotCell=(slot)=>{
    const occ=xi.filter(p=>p!==gkP && slotOf[p.id]===slot);
    const armed = selSwap!==null && !occ.some(p=>p.id===selSwap);
    return `<div class="pslot${armed?" dropReady":""}" ondragover="overZone(event)" ondragleave="leaveZone(event)" ondrop="dropZone(event,'${slot}')"
      ${armed?`onclick="moveSelTo('${slot}')"`:""}>
      <div class="pslotLabel">${slot}</div>${occ.map(p=>pitchChip(p,slot)).join("")}
    </div>`;
  };
  // 비어 있는 라인도 항상 그린다 — 그래야 그 라인으로 드래그해 배치할 수 있다.
  // WB·DM·AM 줄은 비어 있어도 펼친 높이를 유지한다 — 카드를 놓을 때마다 판이 늘었다 줄었다 하지 않게.
  // 스위퍼(SW) 줄만 예외로 낮게 둔다(거의 안 쓰는 자리라 항상 펼치면 판만 길어진다).
  const rowHtml=(band)=>{
    const used=ROW_SLOTS[band].some(x=>x&&xi.some(p=>slotOf[p.id]===x));
    const thin=!used && band==="SW";
    return `<div class="prow${thin?" thin":""}">${ROW_SLOTS[band].map(s=>s?slotCell(s):'<div class="pslot empty"></div>').join("")}</div>`;
  };
  const mb2=matchBench(t);
  // 선발 요약 — 외국인 쿼터·전력·사기는 라인업을 짜면서 계속 보게 되는 값이라 전술판 위쪽에 둔다
  const _frnFree=frnFreeNow();
  const xiInfo=`<div class="msg info" style="margin:8px 0">외국인 선발 ${xi.filter(frnQ).length}${_frnFree?"":"/"+frnLimOf(t)}${xi.some(p=>p.hg)?` <span class="small" style="color:#3fb950">+홈그로운 ${xi.filter(p=>p.hg).length}</span>`:""} <span class="small">${_frnFree?`🌏 <b style="color:#58a6ff">${frnFreeComp()} 경기 — 외국인 출전 제한 없음</b>`:"(K리그1 5명·K리그2 4명 동시 출전, 등록 무제한)"}</span> · 선발 전력 ${teamStars(Math.round(xi.reduce((s,p)=>s+p.ovr,0)/11*10)/10, "선발 11인")} · 선발 사기 ${mor(xi.reduce((s,p)=>s+p.morale,0)/11)}</div>`;
  /* ⚔️ ⚠ 제보 원문 — 「매치 로비에서 스쿼드 전술 수정하면, 되돌아가기 버튼이 없어서 다시 메뉴를
     클릭해야하거든? 되돌아가기 버튼을 추가하자」. 대전 로비에서 넘어온 길에는 돌아갈 문을 낸다. */
  const _pvpBack=(function(){ try{
    return (typeof PVP!=="undefined" && PVP && PVP.stage==="lobby")
      ? `<div class="msg info" style="margin:0 0 8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="mini sel" style="padding:8px 16px" onclick="show('pvp')">↩️ 대전 로비로 돌아가기</button>
          <span class="small">여기서 고친 선발·전술은 돌아가는 순간 상대에게 자동으로 전송됩니다.</span>
        </div>` : "";
  }catch(e){ return ""; } })();
  return `${_pvpBack}<div class="tacTopBar">
    <h2 style="margin:0">📋 전술 — <span style="color:var(--gold)">${liveFormName}</span> <span class="small">(${styleName(t)})</span></h2>
    ${tacSaveBar(t)}
  </div>
  ${fmTopBar(t, xi, liveFormName)}
  ${xiInfo}
  ${tacShareBar()}
  ${tacDetailOpen?`<div class="fmDetailPane">${tacticDetailCard(t, xi)}</div>`:""}
  <div class="fmBody">
    <div class="fmPitchPane">
      <div class="pitch">
        ${BANDS_TOPDOWN.map(b=>rowHtml(b)).join("")}
        <div class="pline">${gkP ? chip(gkP) : (
          /* 🧤 요청 — 골문을 비워 뒀다면 「놓을 수 있는 빈 칸」으로 그린다 (다른 자리와 같은 조작) */
          (t.tactic&&t.tactic.xiManual)
            ? `<div class="pslot${selSwap!==null?" dropReady":""}" ondragover="overZone(event)" ondragleave="leaveZone(event)" ondrop="dropZone(event,'GK')"
                 ${selSwap!==null?`onclick="moveSelTo('GK')"`:""}><div class="pslotLabel">GK</div></div>`
            : "")}</div>
      </div>
      <div class="fmSubBar">
        <span class="small" style="opacity:.7">카드 하단 표시:</span>
        ${[["cond","💚 컨디션"],["sta","⚡ 체력"],["ovr","📊 능력치"],["fam","🎓 역할 능숙도"]].map(([m,n])=>
          `<button class="fmSubBtn${fmSubMode()===m?" on":""}" onclick="setFmSub('${m}')">${n}</button>`).join("")}
      </div>
      <p class="tacHint">🖱️ 드래그하거나 <b>선수를 누른 뒤 옮길 자리를 누르면</b> 배치가 바뀝니다 (폰·패드 권장) · 카드 위 역할 버튼으로 역할·임무 변경 · <span class="frnN">보라색 이름</span>은 외국인 선수</p>
    </div>
    ${fmSquadTable(t, xi, slotOf, mb2, benchRest, sulking, injured)}
  </div>`;
}
/* ---------- 벤치 등록 교체 (선발과 무관 — 교체 멤버 ↔ 미등록, 드래그 & 클릭-클릭 확인) ---------- */
function confirmBenchSwap(a,b){
  const t=userTeam();
  const mb=matchBench(t).map(p=>p.id);
  const aIn=mb.includes(a), bIn=mb.includes(b);
  /* 🪑 ⚠ 제보 — 「교체 명단자끼리 자리를 바꿀 수 없다」.
     둘 다 벤치면 「교체할 게 없다」며 아무 일도 하지 않았다. 하지만 감독에게
     S3 과 S7 의 순번은 의미가 있다 — 먼저 넣을 카드가 어느 것인지가 달라진다.
     명단은 그대로 두고 「순번만」 맞바꾼다. 인원 변동이 없으니 확인창도 필요 없다. */
  if(aIn && bIn){ benchSwapOrder(a, b); return; }
  if(aIn===bIn){ refreshTactics(); return; } // 둘 다 벤치 밖 — 교체 의미 없음
  const outId=aIn?a:b, inId=aIn?b:a; // outId: 벤치에서 빠질 선수, inId: 새로 벤치에 들어올 선수
  const outP=t.players.find(p=>p.id===outId), inP=t.players.find(p=>p.id===inId);
  if(!outP||!inP){ refreshTactics(); return; }
  showConfirm(`<b>🪑 벤치 명단 교체</b>\n\n${outP.name} (${outP.pos} ${dispOvr(outP)}) → 벤치 제외\n${inP.name} (${inP.pos} ${dispOvr(inP)}) → 벤치 등록\n\n교체하시겠습니까?`, ()=>{
    /* ⚠ benchSel 에는 이제 벤치에 못 앉는 선수(선발로 올라갔거나 부상)의 id 가 남아 있을 수 있다.
       그걸 안 걸러내면 배열이 9개를 넘고, 마지막에 push 한 새 선수가 slice(0,9) 에서 잘려 나간다.
       "일부 선수는 아무리 눌러도 교체가 안 된다"는 증상이 정확히 이것이었다. */
    const poolIds=new Set(benchPool(t).map(p=>p.id));
    let sel=((t.tactic.benchSel&&t.tactic.benchSel.length)?t.tactic.benchSel:matchBench(t).map(p=>p.id))
      .filter(id=>poolIds.has(id));
    /* ⚠ 제보 — 「교체 4번 칸 선수와 후보를 바꾸면 새 선수가 4번이 아니라 맨 밑 9번 칸으로 간다」.
       빠지는 선수를 지우고(뒤가 한 칸씩 앞으로 밀린다) 새 선수를 배열 끝에 붙였기 때문이다.
       교체 순번은 감독이 정한 순서다 — 그 자리에 그대로 앉힌다. */
    sel=sel.filter(id=>id!==inId);              // 혹시 이미 들어 있으면 중복 방지
    const _at=sel.indexOf(outId);
    if(_at>=0) sel[_at]=inId;                   // 🪑 그 칸을 그대로 물려받는다 (S4 → S4)
    else {
      sel.push(inId);                           // 예외 — 지정 명단에 없던 선수였다
      if(sel.length>9) sel=sel.filter(id=>id!==inId).slice(0, 8).concat(inId);
    }
    sel=[...new Set(sel)];
    t.tactic.benchSel=sel;
    /* ⚠ 제보 — 교체↔후보 스왑으로 키퍼를 뺐는데 자동 보충이 키퍼를 도로 데려왔다.
       ⬆/⬇ 버튼과 똑같이, 스왑도 감독이 벤치를 직접 짠 것이다 — 이후 자동 보충 없음. */
    t.tactic.benchManual=true;
    saveGame(); refreshTactics();
  }, {okLabel:"교체", onCancel:refreshTactics});
}
function setForm(f){ const t=userTeam(); applyFormation(t,f); noteTacticChange(t, liveM?0.35:1); selSwap=null; if(liveM) liveM.xiDirty=true; refreshTactics(); }
function setMent(m){ userTeam().tactic.mentality=clamp(parseInt(m,10)||0,0,TAC_STEPS-1); noteTacticChange(userTeam(), liveM?0.35:1); if(liveM) liveM.xiDirty=true; refreshTactics(); }
/* ---------- 세부 전술 UI ---------- */
function fitBadge(lv){ // 2좋음 1보통 0위험
  return lv===2?'<span class="tag" style="background:#3fb95033;color:#3fb950">적합</span>'
        :lv===1?'<span class="tag" style="background:#d2992233;color:#d29922">보통</span>'
        :'<span class="tag inj">위험</span>';
}
function tacticDetailCard(t, xi){
  const T=TAC(t); const L=lineAvgs(xi, t);
  const raw=Object.assign({}, TAC_DEF, t.tactic);
  /* FM식 슬라이더 한 줄. 값은 0~4이고, 지금 칸의 이름과 스쿼드 적합도 배지를 옆에 붙인다. */
  const seg=(label,key,fits,tip)=>{
    const v=clamp(Math.round(tacVal(raw[key])*2),0,4);
    const fit=fits?fits[v]:undefined;
    return `<tr><th style="width:96px">${label}</th><td style="min-width:210px">
      <div class="tacSlide">
        <input type="range" min="0" max="4" step="1" value="${v}"
               oninput="tacPreview(this,'${key}')" onchange="setTac('${key}',this.value)" aria-label="${label}">
        <div class="tacTicks">${[0,1,2,3,4].map(i=>`<span class="${i===v?'on':''}"></span>`).join("")}</div>
        <div class="tacNow"><b>${tacLabel(key,v)}</b>${fit!==undefined?" "+fitBadge(fit):""}</div>
      </div></td><td class="small">${tip}</td></tr>`;
  };
  // 스쿼드 적합도 — 슬라이더 5칸 각각에 대해 "이 스쿼드로 감당되는가"를 매긴다
  const midFit = L.mid>=73?2:L.mid>=70?1:0;
  const atkFit = L.atk>=73?2:L.atk>=70?1:0;
  const ageFit = L.age<=27.5?2:L.age<=29?1:0;
  const staFit = Math.min(ageFit, L.sta20>=13?2:L.sta20>=11?1:0);
  const worFit = Math.min(ageFit, L.wor20>=13?2:L.wor20>=11?1:0);
  const lngFit = L.lng20>=13?2:L.lng20>=11?1:0;
  const ramp=(hi)=>[Math.max(hi,1),Math.max(hi,1),1,hi,hi];   // 가운데는 늘 무난, 끝으로 갈수록 그 능력이 필요
  const passFits=[midFit,midFit,1,atkFit,atkFit];
  const tempoFits=ramp(worFit);
  const pressFits=ramp(staFit);
  const lsFits=[1,1,1,lngFit,lngFit];
  /* ── 다음 상대 정찰 ──────────────────────────────────────
     ⚠ 제보 — 「다음 경기가 EACL 인데 다다음 경기인 리그 상대를 분석해 준다」.
        리그 fixture 만 보고 있어서, 대회 경기가 코앞이어도 그 상대는 아예 잡히지 않았다.
        ─ 리그와 EACL 중 실제로 「먼저 치르는」 경기를 골라 분석한다. */
  let scout="";
  /* ⚠ 제보 — 「연습경기에서는 정찰 조언이 아예 안 보인다」.
     프리시즌은 phase 가 "pre" 라 이 블록 자체를 타지 않았다. 연습경기도 상대가 있는 경기다.
   ⚠ 제보 — 「EACL 4강·결승에는 정찰 조언이 아예 안 올라온다」.
     4강·결승은 리그가 끝난 12월에 치른다. 그때 phase 는 "po"(승강 PO)라 8강까지는 보이던
     조언이 통째로 사라졌다. 리그가 끝났어도 치러야 할 대회 경기가 남아 있으면 그 상대를 본다. */
  const _eaclDue=(()=>{ try{ return !!eaclNextForUser(); }catch(e){ return false; } })();
  /* 🌍 세계 대회도 리그와 무관하게 열린다 — 게이트에 같이 건다 */
  const _cwcDue=(()=>{ try{ return !!cwcNextForUser(); }catch(e){ return false; } })();
  /* ⚔️ ⚠ 승강 플레이오프(phase "po")가 게이트에서 통째로 빠져 있었다.
     한 시즌의 운명을 가르는 두 경기인데 정찰 카드가 아예 안 떴다 — 분석가를 뽑아 둬도 소용없었다. */
  const _poDue=(()=>{ try{ return G.phase==="po" && (G.poQueue||[]).length>0; }catch(e){ return false; } })();
  if(G.phase==="league" || G.phase==="pre" || _eaclDue || _cwcDue || _poDue){
    let opp=null, tag="", home=null, when=1e9;
    const fix=t.div===1?G.k1Fix:G.k2Fix, r=t.div===1?G.r1:G.r2;
    if(r<fix.length){ for(const [hid,aid] of fix[r]){ if(hid===t.id||aid===t.id){
      opp=G.teams[hid===t.id?aid:hid];
      tag=compShort(t.div===1?"k1":"k2")+" "+(r+1)+"R";
      home=(hid===t.id);
      when=matchDayOf(r);
    }}}
    /* 🏆 대회 경기가 리그보다 먼저면 그쪽을 본다.
       ⚠ 이미 치른(지나간) 날짜는 뒤로 밀어 비교한다 — 그러지 않으면 지난 라운드의
          경기일이 「가장 이른 경기」로 잡혀 대회 경기를 영영 못 본다. */
    const _today=G.day||0;
    const _rank=(d)=>(d>=_today ? d : d+100000);
    try{
      const ex=eaclNextForUser();
      if(ex && ex.opp && (!opp || _rank(ex.day)<_rank(when))){ opp=ex.opp; tag=ex.label; home=ex.home; when=ex.day; }
    }catch(e){}
    /* 🌍 CWC — 1월 대회. 이게 빠져 있어서 대회 사흘 전에도 「38일 뒤 연습경기 상대」를 분석했다. */
    let _neutral=false;
    try{
      const cx=cwcNextForUser();
      if(cx && cx.opp && (!opp || _rank(cx.day)<_rank(when))){ opp=cx.opp; tag=cx.label; home=false; when=cx.day; _neutral=true; }
    }catch(e){}
    /* ⚔️ 승강 플레이오프 — 리그 fixture 밖에 있어 위 루프로는 절대 안 잡힌다.
       큐 맨 앞이 내 경기면 그 상대를 본다. 남은 경기가 이것뿐이므로 무조건 최우선이다. */
    try{
      if(G.phase==="po" && (G.poQueue||[]).length){
        const pm=G.poQueue[0];
        const phid=resolvePOid(pm.h), paid=resolvePOid(pm.a);
        if(phid===t.id || paid===t.id){
          const po=G.teams[phid===t.id?paid:phid];
          if(po){ opp=po; tag=pm.tag||"승강 PO"; home=(phid===t.id); when=_today; }
        }
      }
    }catch(e){}
    /* 🌱 연습경기 — 프리시즌이든 시즌 중이든, 더 가까우면 그 상대를 본다 */
    try{
      const f=(G.friendlies||[]).filter(x=>!x.done).sort((a,b)=>_rank(a.d)-_rank(b.d))[0];
      if(f && G.teams[f.oppId] && (!opp || _rank(f.d)<_rank(when))){
        opp=G.teams[f.oppId]; tag="연습경기"; home=!!f.home; when=f.d;
      }
    }catch(e){}
    if(opp){
      /* 🔎 그 경기에 상대가 들고 나올 판을 미리 본다 — 사흘 전에 읽어도 당일과 같은 조언 (제보) */
      let OT=TAC(opp), _oppView=opp;
      try{ const _P=aiPlanFor(opp, t, !home); if(_P){ OT=TAC({tactic:_P}); _oppView={tactic:_P}; } }catch(e){}
      /* ⚠ OT.* 는 0~2 실수다(0.5 단위). 배열 인덱스로 그대로 쓰면 0.5·1.5에서 undefined 가 찍힌다. */
      const lv3=(v,a)=>a[v>=1.5?2:v<=0.5?0:1];
      const nm=opp.short||opp.name;
      const dLeft=Math.max(0, when-(G.day||0));
      /* 📊 분석가 — 이 보고서를 쓰는 사람이다. 없으면 「눈으로 본 것」만 남고,
         좋을수록 예상 포메이션 · 최근 폼 · 요주의 선수까지 올라온다. */
      const _anL=(function(){ try{ return acAnaLv(); }catch(e){ return 0; } })();
      const _anTag = _anL>=16 ? ["#f0883e","정밀"] : _anL>=14 ? ["#3fb950","상세"]
                   : _anL>=11 ? ["#56d364","기본"] : _anL>0 ? ["#d29922","개략"] : ["#f85149","분석가 공석"];
      scout=`🔎 다음 상대 <b>${nm}</b> <span class="small" style="opacity:.85">${tag} · ${_neutral?"중립지":(home?"홈":"원정")}${dLeft>0?` · D-${dLeft}`:" · 오늘"}</span>
      <span class="small" style="color:${_anTag[0]}">📊 ${_anTag[1]}${_anL?` (분석 ${Math.round(_anL)})`:""}</span>${
        _neutral?`<span class="small" style="opacity:.7"> · 전력 ${Math.round(teamOVR(opp))} (우리 ${Math.round(teamOVR(t))})</span>`:""}<br>
      <b style="color:var(--gold)">${styleName(_oppView)}</b> — 라인 ${lv3(OT.line,["낮음","보통","높음"])} · 압박 ${lv3(OT.press,["약함","보통","강함"])} · ${lv3(OT.pass,["짧은 패스","혼합","다이렉트"])}${ctrLv(OT)>=3?" · 역습형":ctrLv(OT)>=2?" · 역습 병행":""}
      ${_anL>=14?(function(){
        /* 상세 — 예상 포메이션과 최근 흐름 */
        const fm=(_oppView&&_oppView.tactic&&_oppView.tactic.formation)||(opp.tactic&&opp.tactic.formation)||"";
        const form=(opp.form||[]).slice(-5).map(f=>f==="W"?"🟢":f==="D"?"🟡":"🔴").join("")||"-";
        let gf="",ga="";
        try{ gf=opp.GF|0; ga=opp.GA|0; }catch(e){}
        return `<div class="small" style="margin-top:2px;opacity:.9">📊 예상 포메이션 <b>${fm||"미상"}</b> · 최근 5경기 ${form}${gf!==""?` · 득실 ${gf}:${ga}`:""}</div>`;
      })():""}
      ${_anL>=16?(function(){
        /* 정밀 — 요주의 선수 둘 */
        try{
          const key=(opp.players||[]).filter(x=>x&&!x.loan&&x.inj<=0&&x.pos!=="GK")
            .sort((a,b)=>((b.goals||0)*2+(b.assists||0))-((a.goals||0)*2+(a.assists||0)) || (b.ovr||0)-(a.ovr||0)).slice(0,2);
          if(!key.length) return "";
          return `<div class="small" style="margin-top:2px;opacity:.9">🎯 요주의 —
            ${key.map(x=>`<b>${x.name}</b> <span style="opacity:.75">(${prefSlotOf(x)} · ${x.goals||0}골 ${x.assists||0}도움)</span>`).join(" · ")}</div>`;
        }catch(e){ return ""; }
      })():""}
      ${(function(){
        /* ⚠ 제보 — 어떤 스타일이든 대응 한 수는 반드시 나온다.
           다만 분석가가 없으면 한 수만, 좋으면 전부 올라온다. */
        let _gap=null; try{ _gap=teamOVR(opp)-teamOVR(t); }catch(e){}
        let tips=scoutAdvice(styleName(_oppView), OT, _gap);
        const cap = _anL>=14 ? 9 : _anL>=11 ? 3 : _anL>0 ? 2 : 1;
        tips=tips.slice(0, cap);
        return `<div class="small" style="margin-top:3px;line-height:1.65">${tips.map(x=>`→ ${x}`).join("<br>")}
          ${_anL<11?`<div style="opacity:.7;margin-top:3px">📊 ${_anL?"분석가의 눈이 여기까지입니다":"분석가가 없어 더 깊이 보지 못합니다"} — 💸 이적시장 → 🎩 스태프</div>`:""}</div>`;
      })()}`;
    }
  }
  // 판단에 실제로 쓰이는 값만 위에 모아 굵게 보여준다 — 선수 능력치와 같은 1~20 눈금.
  const sv=(label,val,unit)=>`<span style="margin-right:16px">${label}: <b style="color:#fff;font-weight:800;font-size:1.05em">${val}</b>${unit||""}</span>`;
  const statBar=`<div class="small" style="margin:2px 0 10px;line-height:1.9">
    ${sv("팀 내 중거리 슛 평균 수치", L.lng20.toFixed(1))}
    ${sv("팀 내 지구력 평균 수치", L.sta20.toFixed(1))}
    ${sv("팀 내 활동량 평균 수치", L.wor20.toFixed(1))}
    ${sv("팀 평균 연령", L.age.toFixed(1), "세")}
  </div>`;
  return `<div class="card"><h3>⚙️ 세부 전술 <span class="small">— 스쿼드 적합도와 상대 전술에 따라 효과가 달라집니다</span></h3>
  ${statBar}
  <div style="margin-bottom:8px">
    <b class="small">프리셋:</b>
    ${[["티키타카","tiki"],["게겐프레싱","gegen"],["롱볼 역습","long"],["선수비 후역습","park"],["기본","def"]].map(([n,k])=>`<button class="mini" onclick="applyPreset('${k}')">${n}</button>`).join(" ")}
  </div>

  <div class="tblScroll"><table>
  ${seg("패스 스타일","pass",passFits,
    "짧게 = 중원을 거치는 짧은 연결(중원 능력 의존) · 다이렉트 = 전방으로 길게, 압박을 건너뛰고 뒷공간을 노린다")}
  ${seg("템포","tempo",tempoFits,
    "빠름 = 잡자마자 처리, 기회↑ 실수↑ 체력 소모↑ · 느림 = 안정적이지만 상대가 자리 잡을 시간을 준다")}
  ${seg("압박 강도","press",pressFits,
    "압박을 나가는 빈도와 범위(회랑 ±25%), 라인 사이 간격까지 죈다. 높으면 높은 위치 탈취·체력 소모, 낮으면 내려서서 저지")}
  ${seg("수비 강도","tackle",null,
    "거칠게 = 태클·슬라이딩을 아끼지 않는다(파울·카드·부상 위험↑) · 신중하게 = 붙어서 견제만, 상대에게 시간을 내준다")}
  ${seg("수비 라인","line",null,
    "블록이 서는 높이. 높으면 상대를 가두고 오프사이드를 잡지만 뒷공간이 열리고, 낮으면 뒷공간을 지운다 — 간격·성향과 합쳐 블록 압축을 정한다")}
  ${seg("수비 폭","defGap",null,
    "수비 시 줄 사이·선수 사이 간격. 매우 낮은 라인 + 매우 좁게면 톱까지 두 줄로 내려앉는 텐백 · 넓게 = 커버는 넓지만 라인 사이를 내준다")}
  ${seg("수비 가담 인원","defCommit",null,
    "수비 시 몇 명이 블록에 들어오는가. 올리면 윙백이 백라인까지 내려와 5백이 되고 앞선 한 명이 미드필드 줄에 합류한다(3-5-2 → 5-4-1) · 대신 이동 거리·체력 소모가 늘고 역습 시 앞에 사람이 없다")}
  ${seg("마킹 방식","marking",null,
    "지역 = 자기 구역을 지킨다(형태가 안 깨지지만 좋은 선수를 자유롭게 둔다) · 대인 = 상대를 따라간다(플레이메이커를 지우지만 끌려다니며 공간을 내준다)")}
  ${seg("오프사이드 트랩","trap",null,
    "라인을 밀어 올려 상대를 걸어낸다. 자주 쓰면 상대 침투를 지우지만 한 번 뚫리면 곧바로 1대1이다 · 낮은 라인에서는 값이 줄어든다")}
  ${seg("공수전환 속도","transSpd",null,
    "빠르게 = 탈취·상실 순간 전원이 뛰어서 새 형태로 간다(형태 회복 빠름 · 체력 소모↑) · 느리게 = 다리를 아끼지만 전환 순간이 취약하다")}
  ${seg("공격 폭","width",null,
    "넓게 = 터치라인까지 벌려 측면·크로스 공격 · 좁게 = 중앙 밀집, 수비 시 블록이 볼 쪽으로 더 따라간다")}
  ${seg("중거리 슛","longShot",lsFits,
    "자제 = 박스 밖에선 한 번 더 만든다 · 적극 = 각이 열리면 때린다. 중거리 능력이 낮으면 슈팅만 는다")}
  ${seg("역습 강도","counter",null,
    "탈취 즉시 전방으로. 셀수록 역습 창이 넓고 길게(최대 9초) 열려 전진·스루패스가 과감해진다. 내려앉은 상대에겐 손해")}
  ${seg("크로스 빈도","crossFq",null,
    "적극 = 얕은 각에서도 박스로 올린다(헤딩 타깃이 있을 때 위력적) · 자제 = 크로스 대신 연결·컷백·슈팅을 찾는다")}
  </table></div>
  ${scout?`<div class="msg info" style="margin-top:10px;margin-bottom:0">${scout}</div>`:""}</div>`;
}
/* 슬라이더를 끄는 동안에는 글자만 바꾼다.
   예전에는 oninput 마다 setTac → refreshTactics 로 전술 화면 전체를 다시 그렸다.
   한 번 끌 때 이벤트가 수십 번 나므로 innerHTML 재생성이 그만큼 돌아 폰에서는 탭이 죽었다.
   실제 반영(setTac)은 손을 뗄 때(onchange) 한 번만 한다. */
function tacPreview(el, key){
  try{
    const v=clamp(parseInt(el.value,10)||0, 0, TAC_STEPS-1);
    const box=el.parentElement;
    if(!box) return;
    const ticks=box.querySelector(".tacTicks");
    if(ticks) [...ticks.children].forEach((c,i)=>c.className = i===v?"on":"");
    const now=box.querySelector(".tacNow b");
    if(now) now.textContent=tacLabel(key, v);
  }catch(e){}
}
function setTac(key,val){
  /* 🔭 접속 목록에 뿌리는 선발 스냅샷을 새로 만들게 한다 (요청: 상대 포메이션 보기) */
  try{ pvpFormPackDirty(); }catch(e){}
  const t=userTeam();
  // <input type=range> 는 문자열을 준다. 숫자로 못 박지 않으면 "3"이 그대로 저장돼 계산이 어긋난다.
  t.tactic[key] = clamp(parseInt(val,10)||0, 0, TAC_STEPS-1);
  noteTacticChange(t, liveM?0.35:1);
  if(liveM) liveM.xiDirty=true;
  refreshTactics();
}
function applyPreset(k){
  const t=userTeam(); const T=t.tactic;
  // 중거리 슛 성향도 프리셋에 맞춘다 — 티키타카는 한 번 더 만들고, 롱볼·역습은 과감하게 때린다
  // 🚌 선수비 후역습 = 수비 간격 「매우 좁게」(defGap 0) — 낮은 라인·수비 성향과 합쳐 텐백이 된다
  /* ⚠ 배선 감사 — crossFq 가 모든 프리셋에서 빠져 있어, 프리셋을 갈아타도 크로스 빈도만 남았다 */
  /* ⚠ 배선 감사 2 — transSpd·defCommit·marking·trap 도 빠져 있었다. 특히 park(선수비 후역습)에
     defCommit 이 없어 <b>텐백 프리셋인데 가담 인원이 보통</b>이었다. 다섯 개 모두 값을 박는다. */
  const P={tiki: {pass:0,tempo:2,press:3,line:3,width:1,counter:0,mentality:2,tackle:1,longShot:0,defGap:2,crossFq:1,
                  transSpd:3,defCommit:1,marking:1,trap:3},
           gegen:{pass:2,tempo:4,press:4,line:4,width:2,counter:1,mentality:4,tackle:4,longShot:3,defGap:2,crossFq:2,
                  transSpd:4,defCommit:1,marking:3,trap:4},
           long: {pass:4,tempo:3,press:1,line:1,width:4,counter:3, mentality:2,tackle:2,longShot:4,defGap:2,crossFq:3,
                  transSpd:2,defCommit:2,marking:2,trap:1},
           /* 🚌 park 의 press 0→2: 텐백 실측에서 press 0 은 블록 「안」의 슈터 도전까지 죽여 실점 17/3경기,
              press 2 는 10/3경기. 깊어진 앵커의 회랑이 전방 추격을 어차피 막아서 압박 2 여도 버스는 유지된다 */
           park: {pass:3,tempo:0,press:2,line:0,width:0,counter:4, mentality:0,tackle:2,longShot:2,defGap:0,crossFq:2,
                  transSpd:1,defCommit:4,marking:0,trap:0},
           def:  {pass:2,tempo:2,press:2,line:2,width:2,counter:2,mentality:2,tackle:2,longShot:2,defGap:2,crossFq:2,
                  transSpd:2,defCommit:2,marking:2,trap:2}}[k];
  Object.assign(T,P); noteTacticChange(t, liveM?0.35:1); if(liveM) liveM.xiDirty=true; refreshTactics();
}
/* 전술 탭 재렌더 통합 진입점 — 경기 중 전술 화면이면 renderLiveTactics, 아니면 평상시 tactics 탭 */
/* ═══════════════════════════════════════════════════════════════
   전술 공유 — 내보내기 / 불러오기 (FM 의 .tac 공유와 같은 개념)
   ⚠ 역할·배치를 "선수 id" 로 저장하면 남의 세이브에서는 아무 의미가 없다. 그래서 포지션 슬롯
     (LB·LCB·CM·LW …) 기준으로 적는다. 받는 쪽은 자기 선수를 그 슬롯에 앉히고 역할을 물려받는다.
   파일과 코드 두 가지를 지원한다 — 코드는 커뮤니티 댓글에 그대로 붙여넣을 수 있다.
═══════════════════════════════════════════════════════════════ */
const TAC_SHARE_KIND="klm2026-tactic", TAC_SHARE_V=1;
function tacticToObj(name){
  const t=userTeam(); if(!t||!t.tactic) return null;
  const T=t.tactic;
  const xi=(bestXI(t)||[]);
  let so={}; try{ so=computeRenderSlots(t, xi); }catch(e){}
  const roles={};
  for(const p of xi){
    const sl=so[p.id]; if(!sl || sl==="GK") continue;
    const rd=getRole(t, p, sl);
    if(rd && rd.r) roles[sl]={r:rd.r, d:rd.d};
  }
  const gk=xi.find(p=>so[p.id]==="GK") || xi.find(p=>p.pos==="GK");
  if(gk){ const rd=getRole(t, gk, "GK"); if(rd&&rd.r) roles.GK={r:rd.r, d:rd.d}; }
  const tac={};
  for(const k of TAC_KEYS) if(typeof T[k]==="number") tac[k]=T[k];
  tac.counter=ctrLv(T);
  /* 포메이션 이름만으로는 부족하다 — 손으로 옮겨 둔 배치까지 그대로 넘기려면 자리 목록이 있어야 한다 */
  const slots=[];
  for(const p of xi){ const sl=so[p.id]; if(sl) slots.push(sl); }
  return {kind:TAC_SHARE_KIND, v:TAC_SHARE_V,
          name: name || `${T.formation||"4-3-3"} · ${styleName(t)}`,
          from: t.short||"", season:G.season,
          formation: T.formation||"4-3-3", slots, tac, roles};
}
/* 코드 문자열 — 한글이 섞이므로 UTF-8 로 바꾼 뒤 base64. */
function tacEncode(o){
  const json=JSON.stringify(o);
  try{
    const bytes=new TextEncoder().encode(json);
    let bin=""; for(const b of bytes) bin+=String.fromCharCode(b);
    return "KLM1:"+btoa(bin);
  }catch(e){ return "KLM1:"+btoa(unescape(encodeURIComponent(json))); }
}
function tacDecode(code){
  /* 커뮤니티 댓글을 거치면 제로폭 공백·스마트 따옴표 같은 보이지 않는 문자가 붙어 온다 — 전부 털어낸다 */
  let s=String(code||"").trim()
    .replace(/[\u200B-\u200D\uFEFF\u00A0"'\u2018\u2019\u201C\u201D`]/g,"")
    .replace(/\s+/g,"");
  if(s.indexOf("KLM1:")===0) s=s.slice(5);
  const bin=atob(s);
  let json;
  try{
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    json=new TextDecoder().decode(bytes);
  }catch(e){ json=decodeURIComponent(escape(bin)); }
  return JSON.parse(json);
}
/* 받은 전술을 우리 팀에 입힌다 */
function tacticApplyObj(o){
  const t=userTeam();
  if(!o || o.kind!==TAC_SHARE_KIND || !o.formation) throw new Error("형식");
  const T=t.tactic;
  /* ⚠ 예전에는 포메이션 '이름'만 보고 applyFormation 으로 열한 명을 새로 앉혔다. 그래서 보낸 사람이
     손으로 옮겨 둔 배치(4-3-3인데 오른쪽 풀백만 윙백 자리로 올린 것 등)가 통째로 사라지고
     받는 쪽 자동 배치로 덮였다 — "포메이션이 온전하게 안 온다"는 그 증상이다.
     이제는 실제로 쓰던 '자리 목록'을 함께 주고받고, 그 자리에 우리 선수를 앉힌다. */
  /* 파일이 조작됐거나 다른 버전에서 왔을 수 있다 — 우리가 아는 슬롯명만 통과시킨다 */
  let want=(Array.isArray(o.slots)&&o.slots.length>=10)
    ? o.slots.filter(sl=>sl==="GK"||SLOT_BAND[sl]) : null;
  if(!want || want.length<10)
    want=FORMATION_SHAPE[o.formation]?formationSlots(o.formation).slice():null;
  if(!want) throw new Error("포메이션 "+o.formation);
  want=want.filter((sl,i)=>sl!=="GK"||want.indexOf(sl)===i);   // GK 자리는 하나만
  if(!want.includes("GK")) want.unshift("GK");
  if(FORMATION_SHAPE[o.formation]) T.formation=o.formation;
  if(o.tac){ for(const k of TAC_KEYS) if(typeof o.tac[k]==="number") T[k]=clamp(o.tac[k],0,TAC_STEPS-1);
             T.counter=ctrLv(o.tac); }
  const pool=t.players.filter(p=>avail(p));
  const gkSlots=want.filter(x=>x==="GK"), fieldSlots=want.filter(x=>x!=="GK");
  T.slot={}; T.zone={};
  const used=new Set(), placed=[];
  const assign=(slots, cands)=>{
    const pairs=[];
    for(const sl of slots) for(const p of cands) pairs.push({sl,p,v:slotPickScore(p,sl)});
    pairs.sort((a,b)=>b.v-a.v);
    const doneS=new Set(), doneP=new Set();
    for(const c of pairs){
      if(doneS.size>=slots.length) break;
      if(doneS.has(c.sl)||doneP.has(c.p.id)||used.has(c.p.id)) continue;
      doneS.add(c.sl); doneP.add(c.p.id); used.add(c.p.id);
      setSlot(t, c.p.id, c.sl); setZone(t, c.p.id, SLOT_BAND[c.sl]||c.p.pos);
      placed.push({p:c.p, sl:c.sl});
    }
  };
  assign(gkSlots,    pool.filter(p=>p.pos==="GK"));
  assign(fieldSlots, pool.filter(p=>p.pos!=="GK"));
  G.userXI = placed.map(x=>x.p.id);                  // 선발도 이 배치 그대로 잡는다
  let applied=0, skipped=0;
  if(!T.role) T.role={};
  if(o.roles){
    for(const it of placed){
      const rd=o.roles[it.sl];
      if(!rd || !ROLE_BY_KEY[rd.r]){ skipped++; continue; }
      const R=ROLE_BY_KEY[rd.r];
      const g=ROLE_GRP[it.sl]||"CM";
      if(!R.grp.includes(g)){ skipped++; continue; }
      T.role[it.p.id]={r:rd.r, d:R.duty.includes(rd.d)?rd.d:R.duty[0]};
      applied++;
    }
  }
  noteTacticChange(t, 1);                            // 남의 전술이다 — 손발을 맞출 시간이 필요하다
  /* 전술 슬롯(프리셋) 시스템과 맞물리게 한다. 활성 전술은 t.tactic 자체이므로 위 작업이
     '지금 쓰는 슬롯'을 덮어쓴 셈인데, presets[cur] 에는 옛 스냅샷이 남아 있다.
     여기서 바로 갱신해 두면 슬롯을 오갔을 때 불러온 전술이 그대로 남는다. */
  try{ storeCurPreset(t); }catch(e){}
  saveGame();
  return {applied, skipped, slot:(t.tactic.presetCur||0)+1, placed:placed.length};
}
function exportTactic(){
  try{
    const o=tacticToObj(); if(!o) return;
    const txt=JSON.stringify(o, null, 1);
    const d=new Date();
    const name=`klm2026_전술_${o.formation}_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}.json`;
    const blob=new Blob([txt],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name; a.style.display="none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 800);
    showConfirm(`<b style="color:var(--green);font-size:16px">💾 전술 파일을 저장했습니다.</b>\n\n<span class="small">${name}</span>\n\n기기의 다운로드 폴더에서 확인할 수 있습니다.`, ()=>{}, {okLabel:"확인", cancelLabel:""});
  }catch(e){ notify("전술 내보내기에 실패했습니다.","warn"); }
}
function copyTacticCode(){
  let code;
  try{ code=tacEncode(tacticToObj()); }
  catch(e){ notify("전술 코드를 만들지 못했습니다.","warn"); return; }
  /* ⚠ notify() 는 다음 화면 렌더 때 배너로 뜨는 방식이라, 복사 버튼처럼 화면을 다시 그리지
     않는 동작에서는 아무것도 보이지 않는다. 그래서 팝업으로 직접 띄운다. */
  const ok=()=>tacShowCode(code, true);
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      const pr=navigator.clipboard.writeText(code);
      if(pr && pr.then) pr.then(ok).catch(()=>tacShowCode(code, false));
      else ok();
    } else tacShowCode(code, false);
  }catch(e){ tacShowCode(code, false); }
}
/* 복사 결과를 팝업으로 알린다. 클립보드가 막힌 환경이면 직접 복사할 수 있게 코드를 보여 준다. */
function tacShowCode(code, copied){
  const head = copied
    ? `<b style="color:var(--green);font-size:16px">📋 전술 코드가 복사되었습니다.</b>\n\n커뮤니티나 메신저에 그대로 붙여넣으면 됩니다. <span class="small">(${code.length}자)</span>`
    : `<b style="color:var(--gold);font-size:16px">📋 전술 코드</b>\n\n이 브라우저는 자동 복사를 막고 있습니다. 아래 코드를 <b>길게 눌러</b> 직접 복사해 주세요. <span class="small">(${code.length}자)</span>`;
  showConfirm(`${head}\n\n<textarea readonly onclick="this.select()" style="width:100%;height:96px;font-size:11.5px;line-height:1.45;background:#0d1117;color:var(--sub);border:1px solid var(--line);border-radius:8px;padding:8px;-webkit-user-select:text;user-select:text">${code}</textarea>`,
    ()=>{}, {okLabel:"확인", cancelLabel:""});
}
function importTacticFile(input){
  const f=input && input.files && input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ tacTryApply(String(r.result||""), true); };
  r.onerror=()=>notify("파일을 읽지 못했습니다.","warn");
  r.readAsText(f);
}
function pasteTacticCode(){
  const el=document.getElementById("tacCodeIn");
  const v=el ? String(el.value||"").trim() : "";
  if(!v){ notify("전술 코드를 붙여넣어 주세요.","warn"); if(el) el.focus(); return; }
  tacTryApply(v, false);
}
function tacTryApply(raw, isFile){
  let o=null;
  try{ o = isFile ? JSON.parse(raw) : tacDecode(raw); }
  catch(e){ try{ o=JSON.parse(raw); }catch(e2){ o=null; } }
  if(!o){ notify("전술 코드를 알아볼 수 없습니다. 복사할 때 일부가 빠지지 않았는지 확인해 주세요.","warn"); return; }
  showConfirm(`<b>📋 전술 불러오기</b>\n\n· 이름: ${o.name||"(없음)"}\n· 포메이션: ${o.formation}\n${o.from?`· 만든 구단: ${o.from} (${o.season||"?"} 시즌)\n`:""}\n지금 쓰는 <b>전술 ${(userTeam().tactic.presetCur||0)+1}번</b>의 배치와 지시를 <b>덮어씁니다.</b> 진행할까요?\n\n<span class="small">역할은 포지션(슬롯) 기준으로 옮겨집니다. 우리 선수가 그 역할을 맡을 수 없는 자리는 기본 역할로 남습니다.</span>`,
    ()=>{
      try{
        const r=tacticApplyObj(o);
        notify(`📋 <b>${o.name||"전술"}</b>을(를) <b>전술 ${r.slot}번</b>에 적용했습니다 — 배치 ${r.placed}자리 · 역할 ${r.applied}자리 반영${r.skipped?`, ${r.skipped}자리는 기본값 유지`:""}. <span class="small">남의 전술이라 조직력이 다시 쌓여야 합니다.</span>`,"good");
        tacBase=null; refreshTactics();
      }catch(e){ notify("전술을 적용하지 못했습니다. ("+(e&&e.message||"알 수 없음")+")","warn"); }
    }, {okLabel:"덮어쓰기", cancelLabel:"취소"});
}
function tacShareBar(){
  return `<div class="card" style="margin-bottom:10px">
    <h3>🔗 전술 공유 <span class="small">— 지금 쓰는 <b>전술 ${(userTeam().tactic.presetCur||0)+1}번</b> 기준으로 주고받습니다</span></h3>
    <div class="tacShareRow">
      <button class="mini" onclick="copyTacticCode()">📋 내 전술코드 복사</button>
      <button class="mini" onclick="exportTactic()">💾 전술 파일 저장</button>
      <label class="mini" style="display:inline-flex;align-items:center;cursor:pointer;margin:0">📂 전술 파일 불러오기
        <input type="file" accept="application/json,.json" style="display:none" onchange="importTacticFile(this)"></label>
    </div>
    <div class="tacShareRow" style="margin-top:6px">
      <input id="tacCodeIn" class="tacCodeIn" type="text" placeholder="받은 전술 코드를 여기에 붙여넣기 (KLM1:...)"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <button class="mini" onclick="pasteTacticCode()">▶ 적용</button>
    </div>
    <p class="small" style="margin-top:6px;color:var(--sub)">
      역할과 배치는 <b>포지션 기준</b>으로 옮겨집니다 — 선수 이름이 아니라 "왼쪽 풀백은 윙백(지원)" 식으로 저장되므로 어느 구단에서든 그대로 씁니다.
      불러오면 <b>지금 선택한 전술 슬롯</b>에 덮어쓰므로, 원본을 남기고 싶으면 먼저 빈 슬롯으로 옮긴 뒤 불러오세요. 새 전술은 조직력이 처음부터 다시 쌓입니다.</p>
  </div>`;
}
function refreshTactics(){
  if(inLiveTactics) renderLiveTactics();
  else if(inPreTactics) renderPreMatchTactics();     // 경기 전 전술판도 같은 tactics() 를 쓴다
  else show("tactics");
}
/* ---------- 선수 교체 (클릭 & 드래그) ---------- */
let dragPid=null;
function dragP(e,pid){ dragPid=pid; e.dataTransfer.effectAllowed="move"; }
function overP(e){ e.preventDefault(); e.currentTarget.style.borderColor="var(--gold)"; }
function leaveP(e){ e.currentTarget.style.borderColor=""; }
function dropP(e,pid){ e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor="";
  const a=dragPid; dragPid=null;
  if(a!==null && a!==pid){ if(inLiveTactics) confirmLiveSwap(a,pid); else confirmSwap(a,pid); }
}
/* 세부 지역(예: LB/CB/ST) 셀 자체에 드롭했을 때 — 자유 배치 포지션 이동 */
function overZone(e){ e.preventDefault(); e.currentTarget.classList.add("zoneDrop"); }
function leaveZone(e){ e.currentTarget.classList.remove("zoneDrop"); }
/* ⚔️ ⚠ 제보 원문 — 「온라인 대전에서는 경기 중 전술 수정에서 선수 포메이션 위치를 옮길 수가
   없더라. 퇴장당해서 선수 위치를 옮기려고 했더니 안 되더라」.
   원인: 「내 쪽이 어느 편인가」를 `home.isUser` 로만 판별하고 있었다. 그런데 온라인 대전의
      두 팀은 전송받은 자료로 만든 복제 구단이라 양쪽 다 isUser 가 false 다.
      → 그래서 내 쪽 대신 늘 원정(a) 쪽을 집었고, 옮기려는 선수가 그 목록에 없으니
        moveToZone 이 조용히 되돌아 나왔다 — 화면상 아무 일도 일어나지 않는다.
   ─ 지금 전술판이 다루는 구단(userTeam(); 대전에서는 PVP_TAC_TEAM)과 실제로 같은 쪽을 집는다. */
function liveMySide(){
  if(typeof liveM==="undefined" || !liveM) return null;
  try{
    const t=userTeam();
    if(liveM.h && liveM.h.team===t) return liveM.h;
    if(liveM.a && liveM.a.team===t) return liveM.a;
    /* 복제 구단이라 객체가 다를 수 있다 — 대전에서는 내 쪽이 언제나 h 다 */
    if(liveM.opts && liveM.opts.pvp) return liveM.h;
  }catch(e){}
  return (liveM.home && liveM.home.isUser) ? liveM.h : liveM.a;
}
/* 현재 화면(평상시 전술탭 또는 경기중 전술탭)에서 배치 대상이 되는 선수 목록 — 두 컨텍스트가 다른 소스를 쓰므로 통일 */
function pitchPlayersForZoneEdit(){
  const t=userTeam();
  if(inLiveTactics && liveM){
    const sd=liveMySide(); if(!sd) return xiStrength(t).xi;
    const gap=findLiveGap(sd);
    return onPitch(sd).map(x=>x.p).concat(gap?[gap.p]:[]);
  }
  return xiStrength(t).xi;
}
/* 클릭-투-클릭 이동 — 선수를 고른 상태에서 빈 자리를 누르면 그 자리로 간다.
   폰·패드에서는 드래그가 사실상 불가능해서(스크롤과 충돌) 이 경로가 주 조작이 된다. */
function moveSelTo(slotName){
  const pid=selSwap; if(pid==null) return;
  const t=userTeam();
  const xiPlayers=pitchPlayersForZoneEdit();
  const inXI=xiPlayers.some(x=>x.id===pid);
  selSwap=null;
  const redraw=()=>{ if(inLiveTactics) renderLiveTactics(); else refreshTactics(); };
  if(!inXI){
    // 벤치 선수를 자리로 → 그 자리에 있던 선수와 교체 (경기 중이면 실제 교체 카드를 쓴다)
    const slots=computeRenderSlots(t, xiPlayers);
    const occ=xiPlayers.find(x=>slots[x.id]===slotName);
    if(occ){ if(inLiveTactics) confirmLiveSwap(occ.id, pid); else confirmSwap(occ.id, pid); return; }
    /* 🚪 제보 — 감독이 '제외'로 비워 둔 칸이라면 그 자리에 그대로 세운다 */
    if(!inLiveTactics && xiPlayers.length<11 && xiIn(pid, slotName)) return;
    flash("빈 자리에는 이미 뛰고 있는 선수만 옮길 수 있습니다. 먼저 선수끼리 맞바꾸세요.","warn");
    redraw(); return;
  }
  const slots=computeRenderSlots(t, xiPlayers);
  const occupant=xiPlayers.find(x=>x.id!==pid && slots[x.id]===slotName);
  if(occupant) swapSlots(pid, occupant.id);
  else moveToZone(pid, slotName);
}
function dropZone(e, slotName){ e.preventDefault(); e.currentTarget.classList.remove("zoneDrop");
  const pid=dragPid; dragPid=null;
  if(pid==null) return;
  const t=userTeam();
  const xiPlayers=pitchPlayersForZoneEdit();
  const slots=computeRenderSlots(t, xiPlayers);
  // 드롭한 칸에 이미 다른 선수가 있으면 자리를 "이동"이 아니라 "맞바꾸기"로 처리 —
  // 그래야 한 칸에 두 명이 겹치지도 않고, 관계없는 다른 선수들이 덩달아 밀리지도 않는다.
  const occupant=xiPlayers.find(x=>x.id!==pid && slots[x.id]===slotName);
  if(occupant){ swapSlots(pid, occupant.id); return; }
  /* 🚪 제보 — 그라운드 밖 선수를 빈 칸에 떨어뜨리면 그 자리 선발이 된다 */
  if(!inLiveTactics && !xiPlayers.some(x=>x.id===pid) && xiPlayers.length<11 && xiIn(pid, slotName)) return;
  moveToZone(pid, slotName);
}
/* 드래그(또는 클릭-클릭)로 선수를 세부 지역(slot)으로 옮긴다. zone(대분류 라인)은 매치엔진 계산에 계속 쓰이므로
   함께 갱신한다. 그라운드 위(또는 부상 공백) 선수만 대상이며, 골키퍼는 항상 고정되어 이동할 수 없다.
   벤치 선수는 라인 이동이 아니라 기존 교체 절차를 이용해야 한다. 대상 칸이 비어 있을 때만 사용 — 이미
   누군가 있는 칸이면 dropZone/swapSlots가 대신 처리한다. */
function moveToZone(pid, slotName){
  const t=userTeam();
  const p=t.players.find(x=>x.id===pid);
  const band=POS_ROW[slotName]||slotName; // slotName이 이미 대분류(DF/MF/FW/GK)로 넘어온 구버전 호출도 호환
  if(!p || p.pos==="GK" || band==="GK"){ refreshTactics(); return; } // GK는 항상 고정 — 이동도, GK 자리로의 편입도 불가
  const xiPlayers=pitchPlayersForZoneEdit();
  if(!xiPlayers.some(x=>x.id===pid)){ refreshTactics(); return; }
  setZone(t, pid, band);
  if(ROW_SLOTS[band] && ROW_SLOTS[band].includes(slotName)) setSlot(t, pid, slotName);
  if(liveM) liveM.xiDirty=true;
  refreshTactics();
}
/* 두 선수의 세부 위치(slot)를 정확히 맞바꾼다 — FM처럼 한 칸에는 항상 한 명만 있도록 보장하고,
   교환에 관여하지 않은 다른 선수들의 위치는 절대 건드리지 않는다(= "따라 밀리는" 현상 방지). */
function swapSlots(pidA, pidB){
  const t=userTeam();
  const pA=t.players.find(x=>x.id===pidA), pB=t.players.find(x=>x.id===pidB);
  if(!pA || !pB || pA.pos==="GK" || pB.pos==="GK"){ refreshTactics(); return; }
  const xiPlayers=pitchPlayersForZoneEdit();
  if(!xiPlayers.some(x=>x.id===pidA) || !xiPlayers.some(x=>x.id===pidB)){ refreshTactics(); return; }
  const slots=computeRenderSlots(t, xiPlayers);
  const slotA=slots[pidA], slotB=slots[pidB];
  if(!slotA || !slotB || slotA==="GK" || slotB==="GK"){ refreshTactics(); return; }
  setZone(t, pidA, POS_ROW[slotB]); setSlot(t, pidA, slotB);
  setZone(t, pidB, POS_ROW[slotA]); setSlot(t, pidB, slotA);
  /* 역할은 "자리"에 대한 지시다 — 두 선수가 자리를 맞바꾸면 역할·임무도 자리를 따라간다.
     새 자리에서 맡을 수 없는 역할이면 지워서 그 슬롯 기본 역할로 돌아가게 한다. */
  try{
    const T=t.tactic, rMap=T.role||(T.role={});
    const slotA=T.slot?T.slot[pidA]:null, slotB=T.slot?T.slot[pidB]:null;   // 이미 맞바꾼 뒤의 슬롯
    const rA=rMap[pidA], rB=rMap[pidB];
    const fit=(rd,sl)=>rd && ROLE_BY_KEY[rd.r] && (!sl || !ROLE_GRP[sl] || ROLE_BY_KEY[rd.r].grp.includes(ROLE_GRP[sl]));
    const nA = fit(rB, slotA) ? {r:rB.r, d:rB.d} : null;
    const nB = fit(rA, slotB) ? {r:rA.r, d:rA.d} : null;
    if(nA) rMap[pidA]=nA; else delete rMap[pidA];
    if(nB) rMap[pidB]=nB; else delete rMap[pidB];
  }catch(e){}
  if(liveM) liveM.xiDirty=true;
  refreshTactics();
}
function swapSel(pid){
  try{ pvpFormPackDirty(); }catch(e){}   // 🔭 선발이 바뀌면 접속 목록용 스냅샷도 새로 만든다
  if(selSwap===null){ selSwap=pid; refreshTactics(); return; }
  if(selSwap===pid){ selSwap=null; refreshTactics(); return; }
  const a=selSwap; selSwap=null;
  if(inLiveTactics) confirmLiveSwap(a,pid); else confirmSwap(a,pid);
}
/* 통합 교체 판정: 선발↔선발(같은 라인 위에 있으면 즉시 그 라인으로 배치 이동) · 선발↔벤치/미등록(확인 팝업 후 라인업 교체) · 벤치↔미등록(등록 교체, confirmBenchSwap) */
function confirmSwap(a,b){
  const t=userTeam();
  const ids=xiStrength(t).xi.map(p=>p.id);
  const aXI=ids.includes(a), bXI=ids.includes(b);
  if(aXI&&bXI){ // 선발끼리: 두 선수의 세부 위치를 맞바꾼다(자유 배치) — 인원 변동 없어 확인 없이 즉시 처리
    swapSlots(a, b);
    return;
  }
  if(!aXI&&!bXI){ confirmBenchSwap(a,b); return; } // 둘 다 비선발: 벤치 등록 교체
  const outId=aXI?a:b, inId=aXI?b:a; // outId: 선발에서 빠질 선수, inId: 새로 선발에 들어올 선수
  const outP=t.players.find(p=>p.id===outId), inP=t.players.find(p=>p.id===inId);
  if(!outP||!inP){ refreshTactics(); return; }
  const mb=matchBench(t).map(p=>p.id);
  const inLabel=mb.includes(inId)?"벤치":"미등록";
  showConfirm(`<b>⚽ 선발 라인업 교체</b>\n\n${outP.name} (${outP.pos} ${dispOvr(outP)}) — 선발 → ${inLabel}\n${inP.name} (${inP.pos} ${dispOvr(inP)}) — ${inLabel} → 선발\n\n교체하시겠습니까?`, ()=>{
    const newXI=ids.map(id=>id===outId?inId:id);
    const ps=newXI.map(id=>t.players.find(p=>p.id===id));
    const frnLim=frnLimOf(t);
    if(ps.filter(frnQ).length>frnLim){ gameAlert(`외국인 선수는 최대 ${frnLim}명까지 동시 출전 가능합니다 (${divName(t.div)} 규정 · 홈그로운 제외).\n\n🌏 국제 대회(${eaclShort()}·${cwcShort()}) 경기에는 이 제한이 적용되지 않습니다.`); refreshTactics(); return; }
    const gkN=ps.filter(p=>p&&p.pos==="GK").length;
    if(gkN>1){ gameAlert("골키퍼는 한 명만 선발로 낼 수 있습니다."); refreshTactics(); return; }
    if(gkN<1){ gameAlert("선발에 골키퍼가 없습니다. 골키퍼를 한 명 넣어 주세요."); refreshTactics(); return; }
    if(ps.filter(p=>p.pos==="GK").length!==1){ gameAlert("골키퍼는 정확히 1명 선발해야 합니다. (GK끼리 교체하세요)"); refreshTactics(); return; }
    // 새로 선발에 들어오는 선수는 나간 선수의 정확한 세부 위치(zone/slot)를 그대로 물려받는다 —
    // 그렇지 않으면 computeRenderSlots가 이 선수를 "슬롯 미지정"으로 보고 자동배치 패턴에 따라
    // 엉뚱한 자리에 배치해버린다(라이브 교체 때 subIn()에서 이미 고친 것과 같은 버그).
    if(inP.pos!=="GK" && outP.pos!=="GK"){
      const oldZone=getZone(t, outP);
      const oldSlot=(t.tactic.slot && t.tactic.slot[outId]) || null;
      setZone(t, inId, oldZone);
      if(oldSlot) setSlot(t, inId, oldSlot);
      /* ⚠ 제보 — 역할은 선수 id 로 저장되어, 교체하면 그 자리에 지정한 역할(메짤라 등)이
         새 선수의 옛 역할이나 기본값으로 바뀌었다. 라이브 교체(subIn)와 똑같이,
         나간 선수가 맡던 역할·임무를 그 자리에서 맡을 수 있는 한 그대로 물려준다. */
      const rMap=t.tactic.role || (t.tactic.role={});
      const oldRole=rMap[outId];
      /* ⚠ 제보 ① — 「선발로 다시 올릴 때 같은 포지션이면 기존 설정값이나 적합도/능숙도
           최상위가 기본값이었으면」.
         ⚠ 제보 ② — 「전술에 선수를 맞추는 편이라, 전술 역할 그대로 / 선수 최적 역할
           두 가지 버튼으로 선택지를 달라」.
         선발 정보 탭의 「🧭 전술 우선 / 🎓 선수 우선」 칩(G.opt.swapRole)으로 고른다.
         · 전술 우선(tac) — 나간 선수의 역할(그 자리의 지시)을 그대로 물려준다 (종전 동작)
         · 선수 우선(기본) — 본인이 그 자리 그룹에서 직접 골랐던 역할(roleBy) →
           없으면 능숙도·적합도 최상위 역할을 기본값으로 깐다
         (경기 중 교체 subIn 은 흐름 유지가 우선이라 언제나 자리 역할을 잇는다) */
      const grp=oldSlot ? ROLE_GRP[oldSlot] : null;
      if(!swapRoleTac()){
        const myMem=grp ? (((t.tactic.roleBy||{})[inId]||{})[grp]) : null;
        if(myMem && ROLE_BY_KEY[myMem.r] && ROLE_BY_KEY[myMem.r].grp.includes(grp)){
          rMap[inId]={r:myMem.r, d:myMem.d};
        } else if(oldSlot){
          const best=rolesSortedFor(inP, oldSlot)[0];
          if(best) rMap[inId]={r:best.k, d:(best.duty&&best.duty[0])||"S"};
        }
      } else if(oldRole && ROLE_BY_KEY[oldRole.r]){
        if(!grp || ROLE_BY_KEY[oldRole.r].grp.includes(grp)) rMap[inId]={r:oldRole.r, d:oldRole.d};
      }
    }
    /* ⚠ 제보 — 선발↔벤치를 바꾸면 벤치가 9명에서 8명이 되고 내려온 선수가 미등록으로 사라졌다.
       G.userXI 만 갈아끼우고 benchSel 은 그대로 뒀기 때문이다. 선발로 올라간 선수의 id 는
       benchSel 에 남아 matchBench 의 pool 조회에서 떨어져 나가고(−1명), 내려온 선수는
       benchSel 에 없어 어느 쪽에도 못 든다. benchManual 이 켜져 있으면 자동 보충도 없어 그대로 굳는다.
       올라간 자리에 내려온 선수를 그대로 끼워 넣어 벤치 순서(S1~S9)까지 보존한다. */
    {
      /* ⚠ 제보 — 자동 벤치(지정 이력 없음) 상태에서 스왑하면 벤치가 능력순으로 재계산되어,
         내려온 선발이 컷에 밀려 그외 명단으로 떨어지고 순서도 매번 새로 섞였다.
         스왑하는 순간 「지금 보이는 벤치 순서」를 그대로 명시화해 자리를 계승시킨다. */
      const base=(Array.isArray(t.tactic.benchSel)&&t.tactic.benchSel.length)
        ? t.tactic.benchSel : matchBench(t).map(p=>p.id);
      const sel=[...new Set(base.map(id=>id===inId?outId:id))];
      /* 벤치에서 올라온 교체라면 위 map 이 자리를 그대로 물려준다.
         미등록 선수를 올린 경우엔 자리가 비지 않으므로, 아홉 자리에 여유가 있을 때만 끝에 붙인다
         (이미 9명이면 내려온 선수는 미등록으로 남는다 — 벤치를 억지로 열 명으로 만들지 않는다). */
      if(!sel.includes(outId) && sel.length<9) sel.push(outId);
      t.tactic.benchSel=sel;
    }
    /* 내려온 선수가 예전에 ⬇ 제외됐던 이력이 있으면 그 표식은 지운다 — 방금 벤치로 넣었으니까 */
    if(Array.isArray(t.tactic.benchExcl)) t.tactic.benchExcl=t.tactic.benchExcl.filter(id=>id!==outId);
    G.userXI=newXI; saveGame(); refreshTactics();
  }, {okLabel:"교체", onCancel:refreshTactics});
}
/* ================= 경기 중 전술 탭 (일시정지 → 전술/교체 편집 → 저장 시 재개, 취소 시 원복) ================= */
let inLiveTactics=false, liveTacBackup=null, liveActiveReason=null, liveGapId=null;
function snapshotLiveSide(sd){ return { list: sd.list.map(x=>({...x})), bench: sd.bench.slice(), subs: sd.subs, red: sd.red }; }
function restoreLiveSide(sd, snap){ sd.list = snap.list.map(x=>({...x})); sd.bench = snap.bench.slice(); sd.subs = snap.subs; sd.red = snap.red; }
let liveHLStash=null;
function resumeStashedHL(){
  if(!liveHLStash) return;
  liveHL=liveHLStash; liveHLStash=null;
  liveHL.lastAdv=nowMs(); lastHLTick=null;
  setMatchMode(MATCH_MODE.HIGHLIGHT);   // 시계는 장면이 끝날 때까지 계속 멈춰 있다
}
/* 🎬 흐름 알림 막대 — 「지금이 손볼 틈」이라고 알려 주기만 한다. 창은 감독이 직접 연다 (제보).
   같은 막대가 이미 떠 있으면 문구만 갈아 끼운다 — 겹쳐 쌓이지 않는다. */
function lvNudgeShow(html){
  const el=document.getElementById("lvNudge"); if(!el) return;
  el.innerHTML=`<span class="lvNudgeTxt">${html}</span>
    <button class="mini lvNudgeGo" onclick="lvNudgeHide();openLiveTactics()">📋 전술 손보기</button>
    <button class="mini" onclick="lvNudgeHide()">그대로 간다</button>`;
  el.classList.remove("hidden");
}
function lvNudgeHide(){
  const el=document.getElementById("lvNudge");
  if(el){ el.classList.add("hidden"); el.innerHTML=""; }
}
function openLiveTactics(){
  if(!liveM || liveM.done) return;
  try{ lvNudgeHide(); }catch(e){}
  try{ if(liveSim){ liveM._flowClock=liveSim.clock; liveM._flowSnap={hS:(liveM.st&&liveM.st.hS)||0, aS:(liveM.st&&liveM.st.aS)||0}; } }catch(e){}   // 🎬 전술창 자체가 개입 기회 — 가뭄 시계 리셋
  /* ⚔️ 제보 — 온라인 대전은 양 팀 모두 클론이라 isUser 가 없다. 대전이면 통과시킨다 */
  if(!(liveM.home.isUser || liveM.away.isUser || (liveM.opts && liveM.opts.pvp))) return;
  pauseLive();
  if(tacApplyTimer){ clearTimeout(tacApplyTimer); tacApplyTimer=null; }   // 이전 "반영 중" 대기 정리
  // 전술 화면으로 넘어가면 #pitch2d 캔버스가 사라지므로, 그 시점에 아직 재생 중이던 장면/예약 타이머는
  // 정리한다 — liveShown은 이미 해당 이벤트들을 카운트한 상태라 데이터 손실은 없고, 나중에 redrawLiveLog가
  // 마지막 장면 하나만 다시 그려준다. 정리하지 않으면 화면을 나갔다 돌아왔을 때 중복으로 재생될 수 있다.
  if(revealTimer){ clearTimeout(revealTimer); revealTimer=null; } revealQueue=[];
  current2DScene=null; setMatchMode(MATCH_MODE.TEXT);
  /* ⚠ 재생 중이던 하이라이트는 버리지 않고 「일시정지」로 보관한다.
     예전처럼 통째로 접으면(buf·caps까지 청소) 그 장면의 결말이 이미 시뮬에 반영된 상태라,
     전술탭에서 저장하고 나오는 순간 골이 그대로 공개됐다 (제보: "전술탭 누르고 저장하면 바로 골").
     이제 돌아올 때 보던 지점부터 이어서 재생한다 — 결말은 장면이 끝나야 나온다. */
  liveHLStash=liveHL; liveHL=null; lastHLTick=null;
  liveTacBackup = {
    tactic: JSON.parse(JSON.stringify(userTeam().tactic)),
    h: snapshotLiveSide(liveM.h), a: snapshotLiveSide(liveM.a),
    eventsLen: liveM.events.length
  };
  selSwap=null; inLiveTactics=true;
  LIVE_SUB_UNDO=[];                     // ↩️ 이번 세션의 교체 되돌리기 스택
  liveActiveReason = liveM.pauseReason; liveM.pauseReason=null;
  liveGapId = liveM.pauseEntryId; liveM.pauseEntryId=null; // 이번 세션 한정으로 "공백 채우기" 후보로 사용, 세션이 끝나면 다시 제안하지 않음
  renderLiveTactics();
}
/* 부상으로 이탈해 아직 대체되지 않은 선수(그라운드 밖)를 조회 — 있으면 그라운드 위 선수들과 함께 교체 후보로 노출한다.
   퇴장은 애초에 대체 선수를 투입할 수 없으므로 제외한다. */
function findLiveGap(sd){
  if(!sd || !sd.list) return null;
  /* ⚠ 예전에는 liveGapId 하나만 봤다. 이 값은 전술판을 열 때 M.pauseEntryId 에서 한 번 옮겨 담고,
     저장하든 취소하든 지워지는 '일회용' 값이었다. 그래서 부상 교체 안내를 받고 전술판에 들어갔다가
     취소한 뒤 다시 들어오면, 부상으로 빠진 선수가 목록에서 사라져 영영 교체할 수 없었다.
     — 열 명으로 경기를 마쳐야 했다.
     이제는 "부상으로 비었는데 아직 채우지 않은 자리"를 경기 상태에서 직접 찾는다. */
  if(liveGapId!=null){
    const e=sd.list.find(x=>x.p.id===liveGapId);
    if(e && e.off!==null && !e.red) return e;
  }
  if(onPitch(sd).length>=11) return null;          // 자리가 다 찼으면 공백이 아니다
  const gaps=sd.list.filter(x=>x.off!==null && !x.red && x.injGap);
  return gaps.length ? gaps[gaps.length-1] : null; // 가장 최근에 빠진 선수부터
}
/* 경기 중 전술판용 표 — 체력·경고·교체 카드가 실시간으로 보여야 한다 */
function fmLiveTable(t, pitchAndGap, bench, slotOf, sd){
  const gkX=pitchAndGap.find(x=>slotOf[x.p.id]==="GK") || pitchAndGap.find(x=>x.p.pos==="GK");
  const order=[];
  if(gkX) order.push([gkX,"GK","GK"]);
  for(const band of BANDS){
    for(const sl of (LIST_SLOTS[band]||ROW_SLOTS[band])){
      if(!sl) continue;
      for(const x of pitchAndGap) if(x!==gkX && slotOf[x.p.id]===sl) order.push([x, SLOT_SHORT[sl]||sl, sl]);
    }
  }
  for(const x of pitchAndGap) if(x!==gkX && !order.some(o=>o[0]===x)) order.push([x, prefSlotOf(x.p), prefSlotOf(x.p)]);
  const row=([x,lbl,sl])=>{
    const p=x.p, isGap=x.off!==null;
    const rd=getRole(t,p,sl), R=ROLE_BY_KEY[rd.r], opts=rolesSortedFor(p, sl);   // 🎓 익숙한 역할이 위로
    const fit=Math.round(x.fit||0);

    const card = x.y>=2||p.red ? '<span style="color:#f85149">🟥</span>' : x.y===1 ? '🟨' : '<span style="color:#3fb950">✓</span>';
    const rt = x.rating ? x.rating.toFixed(2) : "-";
    return `<tr class="fmTr rowPick ${selSwap===p.id?'picked':''} ${isGap?'out':''} ${swapFitCls(t,p)}"
        onclick="swapSel(${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})"
        draggable="true" ondragstart="dragP(event,${p.id})" ondragover="overP(event)" ondragleave="leaveP(event)" ondrop="dropP(event,${p.id})">
      <td class="fmName">
        <span class="sqNo">${p.no||"-"}</span><b class="fmNmLink" title="선수 정보 보기"
          onclick="event.stopPropagation();showPlayerInfoPopup(event,${p.id})">${nmF(p)}</b>
        ${isGap?' <span style="color:#f85149">🚑 공백</span>':''}</td>
      <td class="fmSlot">${lbl}</td>
      <td onclick="event.stopPropagation()"><select class="fmRoleSel" onchange="fmSetRole(${p.id},this.value)">
        ${opts.map(r=>`<option value="${r.k}" ${r.k===rd.r?"selected":""}>${r.k} · ${r.n}</option>`).join("")}</select></td>
      <td onclick="event.stopPropagation()"><select class="fmRoleSel duty" onchange="fmSetDuty(${p.id},this.value)">
        ${(R?R.duty:["S"]).map(d=>`<option value="${d}" ${d===rd.d?"selected":""}>${DUTY_N[d]||d}</option>`).join("")}</select></td>
      <td class="fmStars">${roleStarsFor(t,p,sl).replace(/ title="[^"]*"/,"")}</td>
      <td class="fmPos pos-${p.pos}">${prefSlotOf(p)}</td>
      ${fmAgeCell(p)}
      ${bodyCell(fit, true)}
      <td class="fmOpt">${card}</td>
      <td class="fmG fmOpt">${x.goals||0}</td>
      <td class="fmRt fmOpt">${rt}</td></tr>`;
  };
  const benchRows=benchViewSort(bench).map(([p,i])=>`<tr class="fmTr sub rowPick ${selSwap===p.id?'picked':''} ${swapFitCls(t,p)}"
      onclick="swapSel(${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})"
      draggable="true" ondragstart="dragP(event,${p.id})" ondragover="overP(event)" ondragleave="leaveP(event)" ondrop="dropP(event,${p.id})">
    <td class="fmName">
      <span class="sqNo">${p.no||"-"}</span><b class="fmNmLink" title="선수 정보 보기"
        onclick="event.stopPropagation();showPlayerInfoPopup(event,${p.id})">${nmF(p)}</b></td>
    <td class="fmSlot sub">S${i+1}</td><td colspan="2" class="small fmSubLbl">교체 대기</td>
    <td class="fmStars">${prefStars(p).replace(/ title="[^"]*"/,"")}</td>
    <td class="fmPos pos-${p.pos}">${prefSlotOf(p)}</td>
    ${fmAgeCell(p)}
    ${bodyCell(p.cond)}<td class="fmOpt"><span style="color:#3fb950">✓</span></td>
    <td class="fmG fmOpt">-</td><td class="fmRt fmOpt">-</td></tr>`).join("");
  return `<div class="fmTableWrap">
    <div class="fmTabs">
      <span class="fmTab on">👁 출전 선수</span>
      <span class="fmChip">${bench.length}명 대기</span>
      <span class="fmChip">${subChipTxt(sd)}</span>
      ${(typeof LIVE_SUB_UNDO!=="undefined" && LIVE_SUB_UNDO.length)?`
        <button class="mini" style="padding:4px 10px;font-size:11.5px;border-color:var(--gold);color:var(--gold)"
          onclick="undoLiveSub()" title="${LIVE_SUB_UNDO[LIVE_SUB_UNDO.length-1].out} ⇄ ${LIVE_SUB_UNDO[LIVE_SUB_UNDO.length-1].in} 교체를 취소합니다">
          ↩️ 교체 되돌리기${LIVE_SUB_UNDO.length>1?` (${LIVE_SUB_UNDO.length})`:""}</button>
        ${LIVE_SUB_UNDO.length>1?`<button class="mini" style="padding:4px 8px;font-size:11.5px;color:var(--sub)"
          onclick="undoAllLiveSubs()">전부</button>`:""}`:""}
      <button class="mini" style="margin-left:auto;padding:4px 10px;font-size:11.5px;background:var(--green);border-color:var(--green)"
        onclick="saveLiveTactics()">💾 저장하고 재개</button>
      <button class="mini" style="padding:4px 10px;font-size:11.5px" onclick="cancelLiveTactics()">✖ 취소</button>
    </div>
    <div class="tblScroll"><table class="fmTable">
      <tr><th>선수</th><th>위치</th><th>역할</th><th>임무</th><th>능력</th><th>포지션</th><th>나이</th><th>체력</th><th class="fmOpt">카드</th><th class="fmOpt">골</th><th class="fmOpt">평점</th></tr>
      ${order.map(row).join("")}
      ${benchRows?`<tr class="fmDiv"><td colspan="11"><span class="fmSecLbl">🪑 교체 대기</span></td></tr>
      <tr class="fmTr sub" style="background:#0d1117">
        ${sqTh("bench","name","선수")}${sqTh("bench","idx","S#")}<td colspan="2"></td>
        ${sqTh("bench","star","능력")}${sqTh("bench","pos","포지션")}${sqTh("bench","age","나이")}${sqTh("bench","cond","컨디션")}<td class="fmOpt"></td><td class="fmOpt"></td>${sqTh("bench","rt","평점",null,true)}</tr>${benchRows}`:""}
    </table></div>
  </div>`;
}
/* ↩️ 이번 전술판에서 실행한 교체를 되돌린다 — 경기를 재개하기 전까지만 유효하다 */
let LIVE_SUB_UNDO=[];
function undoLiveSub(){
  const M=liveM; if(!M) return;
  const u=LIVE_SUB_UNDO.pop();
  if(!u){ flash("되돌릴 교체가 없습니다.","warn"); return; }
  try{
    restoreLiveSide(M.h, u.h);
    restoreLiveSide(M.a, u.a);
    Object.assign(userTeam().tactic, u.tactic);
    M.events.length=u.eventsLen;
    liveShown=Math.min(liveShown, M.events.length);
    if(Array.isArray(M.subQueue)) M.subQueue.length=Math.min(M.subQueue.length, u.queueLen);
    if(u.gap) liveGapId=u.gapId;
    M.xiDirty=true;
    if(liveSim) liveSim.resyncSquads();
  }catch(e){}
  selSwap=null;
  flash(`↩️ 교체를 되돌렸습니다 — ${u.out} ⇄ ${u.in}`,"good");
  renderLiveTactics();
}
function undoAllLiveSubs(){
  if(!LIVE_SUB_UNDO.length){ flash("되돌릴 교체가 없습니다.","warn"); return; }
  const n=LIVE_SUB_UNDO.length;
  while(LIVE_SUB_UNDO.length) undoLiveSub();
  flash(`↩️ 이번에 한 교체 ${n}건을 모두 되돌렸습니다.`,"good");
}
/* 📋 경기 중 전술 수정 화면에서도 수석코치의 조언을 펼쳐 놓고 손볼 수 있게 한다(제보).
   경기 화면과 같은 패널(lvPanel)을 그대로 쓴다 — 두 화면이 동시에 뜨지는 않는다. */
let liveAdvOpen=false;
function toggleLiveAdvice(){ liveAdvOpen=!liveAdvOpen; renderLiveTactics(); }
/* 🔭 상대 포메이션 그림 — ⚠ 제보 원문 — 「개인적으로 경기중에 전술창 들어가면 상대 포메이션도
   이미지로 구현됐으면 좋겠습니다」.
   지금 그라운드 위에 서 있는 상대 11명(퇴장·교체 반영)을 전술판 좌표(SLOT_XY)에 세워 보여 준다.
   로비의 pvpFormPitch 와 같은 그리기 방식 — 상대 골문이 위, 우리를 향해 내려오는 그림이다. */
let liveOppOpen=false;
function toggleLiveOpp(){ liveOppOpen=!liveOppOpen; renderLiveTactics(); }
function liveOppCard(M, myKey){
  try{
    const ok2 = myKey==="h" ? "a" : "h";
    const osd=M[ok2]; if(!osd) return "";
    const oppT=osd.team;
    const pitch=onPitch(osd); if(!pitch.length) return "";
    const xi=pitch.map(x=>x.p);
    const slotOf=computeRenderSlots(oppT, xi);
    let col=(oppT&&oppT.col)||"#e5484d";
    if(!/^#[0-9a-fA-F]{3,8}$/.test(col)) col="#e5484d";
    const ink=(typeof isLightColor==="function"&&isLightColor(col))?"#0d1117":"#fff";
    const used={};
    const chips=pitch.map(x=>{
      const q=x.p;
      const sl=slotOf[q.id] || (q.pos==="GK"?"GK":q.pos==="DF"?"CB":q.pos==="FW"?"ST":"CM");
      const nth=(used[sl]=(used[sl]||0)+1);
      const b=SLOT_XY[sl]||SLOT_XY.CM;
      /* 같은 칸에 둘이 서면 옆으로 조금 벌린다 (로비 그림과 같은 규칙) */
      let y=b.y + (nth>1 ? ((nth%2)?1:-1)*0.11*Math.ceil((nth-1)/2) : 0);
      y=clamp(y, 0.07, 0.93);
      /* 상대는 「우리를 마주 보고 내려오는」 그림 — 상대 골키퍼가 맨 위 */
      const left=((1-y)*100).toFixed(1), top=((1-b.x)*84+6).toFixed(1);
      return `<div style="position:absolute;left:${left}%;top:${top}%;transform:translate(-50%,-50%);text-align:center;width:56px;pointer-events:none">
        <div style="width:23px;height:23px;line-height:23px;border-radius:50%;background:${col};color:${ink};font-weight:800;font-size:10.5px;margin:0 auto;border:1.5px solid rgba(0,0,0,.55)">${q.no||""}</div>
        <div style="font-size:9.5px;margin-top:1px;color:#f2f6fa;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.name||""}</div></div>`;
    }).join("");
    const formN=(function(){ try{ return formationLabel(oppT, xi); }catch(e){ return ""; } })();
    const reds=osd.red>0?` · 🟥 ${osd.red}명 퇴장 (${pitch.length}명)`:"";
    return `<div class="card" style="margin:0"><h3>🔭 상대 포메이션
      <span class="small">— ${oppT.short||oppT.name} · <b style="color:var(--gold)">${formN}</b> · 교체 ${osd.subs||0}/${subMax(M)}${reds}</span></h3>
      <div style="display:flex;justify-content:center">
      <div style="position:relative;width:100%;max-width:290px;aspect-ratio:3/3.8;background:linear-gradient(#155d31,#123f24);border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <div style="position:absolute;left:4%;right:4%;top:3%;bottom:3%;border:1px solid rgba(255,255,255,.28);border-radius:2px"></div>
        <div style="position:absolute;left:4%;right:4%;top:50%;border-top:1px solid rgba(255,255,255,.28)"></div>
        <div style="position:absolute;left:50%;top:50%;width:26%;aspect-ratio:1;border:1px solid rgba(255,255,255,.28);border-radius:50%;transform:translate(-50%,-50%)"></div>
        <div style="position:absolute;left:29%;right:29%;bottom:3%;height:13%;border:1px solid rgba(255,255,255,.28);border-bottom:none"></div>
        <div style="position:absolute;left:29%;right:29%;top:3%;height:13%;border:1px solid rgba(255,255,255,.28);border-top:none"></div>
        ${chips}
      </div></div>
      <p class="small" style="margin:6px 0 0;opacity:.75">지금 그라운드에 서 있는 상대 선수들입니다 — 교체·퇴장이 그대로 반영됩니다. 위쪽이 상대 골문입니다.</p></div>`;
  }catch(e){ return ""; }
}
function renderLiveTactics(){
  const M=liveM; if(!M){ inLiveTactics=false; return; }
  /* ⚔️ 제보 — 「온라인 경기중에 수석코치의 조언이 있던데 이거 안보이게」 */
  try{ if(M.opts && M.opts.pvp) liveAdvOpen=false; }catch(e){}
  const t=userTeam();
  const _k=liveMyKey(M); const sd=M[_k]; const key=_k;
  const gap=findLiveGap(sd);
  const pitch=onPitch(sd);
  const pitchAndGap = gap ? [...pitch, gap] : pitch;
  const bench=sd.bench;
  const xi=pitch.map(x=>x.p); // 전술 적합도 계산은 실제 뛰고 있는 선수 기준으로만
  // 자유 배치: 각 선수의 실제 배치 라인(zone)으로 그룹핑 — 드래그로 이동할 때마다 즉시 반영되고,
  // 퇴장·부상으로 결원이 생겼을 때도(공백 포함) 라인업 모양에 자연스럽게 반영된다.
  // ⚠ 라인 분류는 SW·WB·DM·AM 까지 전 밴드를 다뤄야 한다.
  //    DF/MF/FW 세 칸만 만들어 두고 BANDS_TOPDOWN 7개를 훑으면 undefined.filter 로 화면이 통째로 죽는다.
  const liveFormName=formationLabel(t, xi);
  const slotOf=computeRenderSlots(t, pitchAndGap.map(x=>x.p));
  const gkX=pitchAndGap.find(x=>slotOf[x.p.id]==="GK") || pitchAndGap.find(x=>x.p.pos==="GK");
  /* ⚠ 줄 나누기는 반드시 "배치된 슬롯"을 따라야 한다.
     타고난 포지션(zone)으로 나누면, 수비수가 미드 슬롯에 배치됐을 때 그 선수는
     DF 줄에 담기는데 DF 줄은 DF 슬롯만 그리므로 화면에서 통째로 사라진다. */
  const lineX={}; for(const b of BANDS) lineX[b]=[];
  for(const x of pitchAndGap){
    if(gkX && x===gkX) continue;
    let b=SLOT_BAND[slotOf[x.p.id]] || getZone(t,x.p);
    if(!ROW_SLOTS[b]) b="MF";
    lineX[b].push(x);
  }
  const selName=(id)=>{ const x=pitchAndGap.find(x=>x.p.id===id); if(x) return x.p.name; const p=bench.find(p=>p.id===id); return p?p.name:""; };
  const pitchChip=(x,slot)=>{
    const isGap = x.off!==null;
    const sub = isGap ? '<span style="color:#f85149">🚑 공백</span>' : fmSubForLive(t, x, slot);
    return `<div class="fmCardWrap${isGap?' gap':''}">${fmPlayerCard(t, x.p, slot, {picked:selSwap===x.p.id, sub})}</div>`;
  };
  const benchChipLive=(p)=>`<div class="pchip ${selSwap===p.id?'picked':''}" style="display:inline-block;margin:2px"
    draggable="true" ondragstart="dragP(event,${p.id})" ondragover="overP(event)" ondragleave="leaveP(event)" ondrop="dropP(event,${p.id})"
    onclick="swapSel(${p.id})" oncontextmenu="showPlayerInfoPopup(event,${p.id})"><b class="pos-${p.pos} fmNmLink" title="선수 정보 보기"
      onclick="event.stopPropagation();showPlayerInfoPopup(event,${p.id})">${nmF(p)}</b>${abilityStars(p)}</div>`;
  const slotCell=(band, slot)=>{
    const occ=(lineX[band]||[]).filter(x=>slotOf[x.p.id]===slot);
    const armed = selSwap!==null && !occ.some(x=>x.p.id===selSwap);
    return `<div class="pslot${armed?" dropReady":""}" ondragover="overZone(event)" ondragleave="leaveZone(event)" ondrop="dropZone(event,'${slot}')"
      ${armed?`onclick="moveSelTo('${slot}')"`:""}>
      <div class="pslotLabel">${slot}</div>${occ.map(x=>pitchChip(x,slot)).join("")}
    </div>`;
  };
  const rowHtml=(band)=>{
    const used=(ROW_SLOTS[band]||[]).some(s=>s&&(lineX[band]||[]).some(x=>slotOf[x.p.id]===s));
    const thin=!used && band==="SW";   // 전술판과 같은 규칙 — SW 만 접고 나머지는 항상 펼친다
    return `<div class="prow${thin?" thin":""}">${(ROW_SLOTS[band]||[]).map(s=>s?slotCell(band,s):'<div class="pslot empty"></div>').join("")}</div>`;
  };
  $("#main").innerHTML = `<h2>📋 경기 중 전술 수정 — <span style="color:var(--gold)">${liveFormName}</span></h2>
  ${liveActiveReason?`<div class="msg warn" style="font-size:15px">${liveActiveReason}</div>`:""}
  <div class="msg info">⏸ 경기가 일시정지되었습니다. 전술 변경은 즉시 반영되고, 교체는 실제 교체 카드(${sd.subs}/${subMax(liveM)})를 사용합니다.${(liveM&&liveM.opts&&liveM.opts.friendly)?` <b style="color:var(--green)">연습경기라 ${SUB_MAX_FR}명까지 바꿀 수 있습니다.</b>`:""}
    오른쪽 표 위의 <b>저장하고 재개</b>를 누르면 경기가 이어집니다.
    잘못 바꿨다면 <b>↩️ 교체 되돌리기</b>로 한 건씩 취소할 수 있습니다 — 재개 전까지는 카드도 돌아옵니다.</div>
  ${sd.red>0?`<div class="msg warn">🟥 현재 <b>${sd.red}명 퇴장</b>으로 그라운드에 <b>${onPitch(sd).length}명</b>만 남아 있습니다. 공격수를 수비 라인으로 내려 완전수비로 버틸 수도 있습니다.</div>`:""}
  ${gap?`<div class="msg warn">🚑 <b>${gap.p.name}</b>의 공백이 아직 채워지지 않았습니다 — 아래 🚑 표시된 칸을 벤치 선수와 교체하면 11명을 채울 수 있습니다.</div>`:""}
  ${selSwap!==null?`<div class="msg good">🔁 <b>${selName(selSwap)}</b> 선택됨 — 교체할 선수를 클릭하세요. (같은 선수 다시 클릭 시 취소)</div>`:""}
  ${fmTopBar(t, xi, liveFormName)}
  ${liveAdvOpen?`<div class="fmDetailPane"><div class="card" style="margin:0"><h3>📋 ${acName()}의 조언
    <span class="small">— ${dispMin(M)}분 · ${M.home.short} ${M.hg}-${M.ag} ${M.away.short}</span></h3>
    <div id="lvPanel"></div></div></div>`:""}
  ${liveOppOpen?`<div class="fmDetailPane">${liveOppCard(M, key)}</div>`:""}
  ${tacDetailOpen?`<div class="fmDetailPane">${tacticDetailCard(t, xi)}</div>`:""}
  <div class="fmBody">
    <div class="fmPitchPane">
      <div class="pitch">
        ${BANDS_TOPDOWN.map(b=>rowHtml(b)).join('')}
        <div class="pline">${gkX?pitchChip(gkX,'GK'):""}</div>
      </div>
      <div class="fmSubBar">
        <span class="small" style="opacity:.7">카드 하단 표시:</span>
        ${[["fit","⚡ 체력"],["cond","💚 컨디션"],["ovr","📊 능력치"],["fam","🎓 역할 능숙도"]].map(([m,n])=>
          `<button class="fmSubBtn${fmSubModeLive()===m?" on":""}" onclick="setFmSubLive('${m}')">${n}</button>`).join("")}
      </div>
      <p class="small" style="margin-top:6px">🖱️ 드래그하거나 <b>선수를 누른 뒤 옮길 자리를 누르면</b> 재배치 (폰·패드 권장) · 그라운드 ↔ 벤치를 맞바꾸면 교체 (카드 ${sd.subs}/${subMax(liveM)}) · 골키퍼 이동 불가</p>
    </div>
    ${fmLiveTable(t, pitchAndGap, bench, slotOf, sd)}
  </div>`;
  /* 조언은 화면을 그린 뒤에 채운다 — 경기 화면과 같은 함수를 쓴다 */
  if(liveAdvOpen){ try{ renderCoachAdvice(); }catch(e){} }
}
function confirmLiveSwap(a,b){
  const M=liveM; if(!M){ return; }
  const _k=liveMyKey(M); const sd=M[_k]; const key=_k;
  const gap=findLiveGap(sd);
  const findOut=(id)=> onPitch(sd).find(x=>x.p.id===id) || (gap && gap.p.id===id ? gap : undefined);
  const aOut=findOut(a), bOut=findOut(b);
  const aIn=sd.bench.find(p=>p.id===a), bIn=sd.bench.find(p=>p.id===b);
  if(aOut && bOut){ // 둘 다 그라운드 위(또는 공백): 교체가 아니라 자유 배치 — 두 선수의 세부 위치를 맞바꾼다
    swapSlots(a, b);
    return;
  }
  let outEntry, inP;
  if(aOut && bIn){ outEntry=aOut; inP=bIn; }
  else if(bOut && aIn){ outEntry=bOut; inP=aIn; }
  else { renderLiveTactics(); return; } // 벤치끼리는 교체 의미 없음
  if(sd.subs>=subMax(liveM)){ gameAlert(`교체 카드를 모두 사용했습니다 (${subMax(liveM)}명).`); renderLiveTactics(); return; }
  if((outEntry.p.pos==="GK")!==(inP.pos==="GK")){ gameAlert("골키퍼는 골키퍼와만 교체할 수 있습니다."); renderLiveTactics(); return; }
  if(frnQ(inP)){
    const lim=frnLimOf(userTeam());
    const cnt=onPitch(sd).filter(x=>x!==outEntry&&frnQ(x.p)).length+1;
    if(cnt>lim){ gameAlert(`외국인 동시 출전 한도 초과 (${divName(userTeam().div)}: 최대 ${lim}명 · 홈그로운 제외)`); renderLiveTactics(); return; }
  }
  const isGapFill = outEntry===gap;
  /* ⚔️ 게스트는 그림자 경기에서 교체한다 — 호스트로 옮기려면 「누가 나가고 누가 들어왔는지」를
     순서까지 기억해야 한다(들어온 선수가 나간 선수의 자리를 물려받으므로). */
  const _pvpPair = (typeof PVP!=="undefined" && PVP && PVP.role==="guest" && PVP.tacBase && liveM && liveM.opts && liveM.opts.pvp)
    ? {out:outEntry.p.no, in:inP.no} : null;
  showConfirm(`<b>${isGapFill?'🚑 부상 공백 채우기':'🔁 선수 교체'}</b>\n\n${outEntry.p.name} (${outEntry.p.pos}) OUT${isGapFill?' (이미 부상으로 이탈)':''}\n${inP.name} (${inP.pos}) IN\n\n교체하시겠습니까? (${sd.subs}/${subMax(liveM)} → ${sd.subs+1}/${subMax(liveM)})`, ()=>{
    /* ⚠ 제보 — 「잘못 올린 선수를 되돌릴 방법이 없다」.
       경기를 재개하기 전이라면 아직 아무 일도 일어나지 않은 것이나 마찬가지다.
       실행 직전 상태를 쌓아 두었다가 한 건씩 되돌린다. */
    try{
      LIVE_SUB_UNDO.push({ out:outEntry.p.name, in:inP.name, gap:isGapFill, gapId:liveGapId,
        h:snapshotLiveSide(M.h), a:snapshotLiveSide(M.a),
        tactic:JSON.parse(JSON.stringify(userTeam().tactic)),
        eventsLen:M.events.length, queueLen:(M.subQueue||[]).length });
    }catch(e){}
    subIn(M, sd, key, outEntry, inP);
    if(_pvpPair){ try{ (PVP.tacBase.pairs=PVP.tacBase.pairs||[]).push(_pvpPair); }catch(e){} }
    if(isGapFill){ liveGapId=null; outEntry.injGap=false; } // 공백을 채웠으니 더 이상 후보가 아니다
    selSwap=null; renderLiveTactics();
  }, {okLabel:"교체", onCancel:()=>{ selSwap=null; renderLiveTactics(); }});
}
/* 전술 화면에서 돌아올 때 #pitch2d가 새 빈 캔버스로 교체되므로, 지금까지 재생된 마지막 장면을
   다시 그려 넣는다 — liveShown 자체는 리셋하지 않으므로 경기가 처음부터 재생되지 않고, 과거 장면들을
   전부 다시 재생하지도 않는다(단지 화면이 빈 캔버스로 보이지 않게 마지막 상태만 복원한다). */
function redrawLiveLog(){
  if(!liveM) return;
  const upto=Math.min(liveShown, liveM.events.length);
  const last = upto>0 ? liveM.events[upto-1] : null;
  if(last) setCaption2D(last);
  applyMatchModeUI(); // 캔버스가 새 요소로 교체됐으므로 모드에 맞는 밝기·표시등을 다시 입힌다
  idleDrawKey=null;   // 정지 화면도 반드시 한 번 다시 그리게 한다
  render2DTick(nowMs());
}
function saveLiveTactics(){
  /* 🎙 내 전술 변경은 해설이 읽지 않는다 (제보).
     상대 벤치가 움직이면 중계가 짚어 주는 게 자연스럽지만, 내가 내 손으로 바꾼 지시를
     해설자가 「아, 전술을 바꿉니다」라고 읽어 주는 건 군더더기다. 게다가 한 줄마다
     경기 시계를 2초씩 멈춰서, 슬라이더 몇 칸 만지면 경기가 6~8초씩 끊겼다.
     ─ 중계가 멈추고 읽는 것은 교체뿐이다. 무엇을 바꿨는지는 전술판이 이미 보여 준다. */
  inLiveTactics=false; liveTacBackup=null; selSwap=null; liveActiveReason=null; liveGapId=null;
  LIVE_SUB_UNDO=[];
  /* ⚔️ 제보 — 온라인 대전도 리그와 같은 화면을 쓴다. 마무리만 대전 규칙을 따른다 */
  if(liveM && liveM.opts && liveM.opts.pvp){ pvpTacClose(true); return; }
  // 바뀐 포메이션·역할·교체를 굴러가고 있는 시뮬에 즉시 반영한다.
  // 이게 없으면 전술판에서 무엇을 바꾸든 그라운드에서는 아무 일도 일어나지 않는다.
  if(liveSim) liveSim.resyncSquads();
  saveGame();
  $("#main").innerHTML = liveLayout(liveM, liveTag);
  livePanelKey="";
  redrawLiveLog(); // liveShown은 그대로 유지 — 문자중계가 처음부터 다시 나오지 않는다
  resumeStashedHL();   // 보다 만 하이라이트가 있으면 그 지점부터 이어서
  syncLive();
  // FM처럼 지시가 전달되는 잠깐의 텀을 준다 — 벤치에서 소리치고 선수들이 자리를 잡는 시간이다.
  // 바로 재개해 버리면 무엇이 바뀌었는지 알아챌 겨를이 없다.
  showTacticApplying();
}
/* "전술 반영 중..." — 잠시 멈췄다가 경기를 재개한다 */
function showTacticApplying(){
  livePaused=true;
  const el=document.getElementById("lvCtrl");
  if(el) el.innerHTML=`<div class="tacApply">📋 <b>전술 반영 중…</b>
    <span class="small">벤치의 지시가 그라운드에 전달되고 있습니다.</span></div>`;
  const cap=document.getElementById("pitchCaption");
  if(cap) cap.textContent="📋 전술 반영 중…";
  /* 해설 바는 건드리지 않는다 — 전술 변경은 중계가 아니라 벤치의 일이다 */
  if(tacApplyTimer) clearTimeout(tacApplyTimer);
  tacApplyTimer=setTimeout(()=>{
    tacApplyTimer=null;
    const c2=document.getElementById("pitchCaption");
    if(liveM&&liveM.done){ if(c2) c2.textContent="🏁 경기 종료"; resetComm("🏁 경기가 끝났습니다."); }
    else if(!liveHL){ if(c2) c2.textContent="다음 장면을 기다리는 중..."; resetComm(null); }
    // 하이라이트 재생 중이면 해설 자막을 건드리지 않는다 — "대기 중"이 장면 위에 뜨던 문제
    resumeLive();
  }, TAC_APPLY_MS);
}
function cancelLiveTactics(){
  const M=liveM;
  if(liveTacBackup && M){
    Object.assign(userTeam().tactic, liveTacBackup.tactic);
    restoreLiveSide(M.h, liveTacBackup.h);
    restoreLiveSide(M.a, liveTacBackup.a);
    M.events.length = liveTacBackup.eventsLen;
    liveShown=Math.min(liveShown, M.events.length); // 되돌린 이벤트만큼 초과분이 있으면 맞춰준다(리셋은 아님)
    M.xiDirty=true;
  }
  inLiveTactics=false; liveTacBackup=null; selSwap=null; liveActiveReason=null; liveGapId=null;
  LIVE_SUB_UNDO=[];
  if(liveM && liveM.opts && liveM.opts.pvp){ pvpTacClose(false); return; }
  // 취소도 "되돌린 상태"로 다시 맞춰야 한다 — 편집 도중 교체를 눌렀다 취소했을 수 있다
  if(liveSim) liveSim.resyncSquads();
  saveGame();
  $("#main").innerHTML = liveLayout(liveM, liveTag);
  livePanelKey="";
  redrawLiveLog();
  resumeStashedHL();   // 취소해도 보던 장면은 이어서
  syncLive();
  resumeLive();
}
