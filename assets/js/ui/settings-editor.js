"use strict";
/* 💽 저장소 두 곳의 상태 — 어디에 얼마나 들어가 있는지 */
function storeRowHtml(){
  const kb=(n)=> n? ((n*2)>=1048576 ? ((n*2)/1048576).toFixed(2)+"MB" : Math.round(n*2/1024)+"KB") : "—";
  let lsN=0; try{ const raw=localStorage.getItem(SAVE_KEY); lsN=raw?raw.length:0; }catch(e){}
  const pct=clamp(Math.round(lsN*2/5242880*100), 0, 100);     // 약 5MB 한도 기준
  const idb = IDB_FAIL ? `<span style="color:var(--gold)">지원 안 함</span>`
            : IDB_OK===true ? `<span style="color:var(--green)">정상</span>${IDB_SIZE?` · ${kb(IDB_SIZE)}`:""}`
            : IDB_OK===false ? `<span style="color:var(--red)">실패</span>`
            : `<span style="opacity:.7">대기</span>`;
  return `<div style="margin-top:9px;border-top:1px solid #21262d;padding-top:9px">
    <div class="small" style="line-height:1.7">
      💽 <b>큰 저장소(IndexedDB)</b> — ${idb} <span style="opacity:.75">· 기기 용량 기준, 수백 MB까지 씁니다</span><br>
      📦 <b>기본 저장소(localStorage)</b> — ${kb(lsN)} / 약 5MB
      <span style="color:${pct>=85?"var(--red)":pct>=65?"var(--gold)":"var(--sub)"}">(${pct}%)</span></div>
    <div class="partyBar" style="margin-top:5px"><div style="width:${pct}%;${pct>=85?"background:linear-gradient(90deg,#8b1a1a,#f85149)":pct>=65?"":""}"></div></div>
    <p class="small" style="margin-top:6px;color:var(--sub);line-height:1.6">
      브라우저 기본 저장소는 <b>사이트당 약 5MB</b>로 고정입니다 — 기기 여유 용량과는 별개라, 여기가 차면 저장이 실패합니다.
      그래서 진행 상황은 <b>큰 저장소에 먼저</b> 쓰고, 기본 저장소에는 사본만 둡니다.
      시즌이 쌓여 한도에 가까워지면 <b>오래된 기록(뉴스·소셜·이적 기록·시세)부터 자동으로 정리</b>합니다.</p>
  </div>`;
}
/* 🔒 저장소 영구 보존 — 상태와 요청 버튼 */
function persistRowHtml(){
  const st=PERSIST_ST;
  const u=PERSIST_USE;
  const mb=(n)=> n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.round(n/1024)+"KB";
  const usage = u ? `<span class="small" style="opacity:.8">· 이 사이트가 쓰는 용량 ${mb(u.used)}${u.quota?` / 한도 ${mb(u.quota)}`:""}</span>` : "";
  let box;
  if(st==="na"){
    box=`<div class="small" style="color:var(--sub)">🔓 이 브라우저는 영구 보존 요청을 지원하지 않습니다 — <b>💾 세이브파일 저장</b>으로 백업해 주세요.</div>`;
  } else if(st===true){
    box=`<div class="small" style="color:var(--green)">🔒 <b>영구 보존 켜짐</b> — 브라우저가 저장 공간을 정리할 때 이 게임의 세이브는 건드리지 않습니다. ${usage}</div>`;
  } else if(st===false){
    box=`<div class="small" style="color:var(--gold)">🔓 <b>영구 보존 꺼짐</b> — 디스크가 빠듯하면 브라우저가 세이브를 정리할 수 있습니다. ${usage}</div>
      <button class="mini" style="margin-top:6px;border-color:var(--gold);color:var(--gold)" onclick="persistAsk(true)">🔒 영구 보존 요청</button>`;
  } else {
    box=`<div class="small" style="color:var(--sub)">🔒 영구 보존 상태를 확인하는 중…</div>
      <button class="mini" style="margin-top:6px" onclick="persistAsk(true)">🔒 영구 보존 요청</button>`;
  }
  return `<div style="margin-top:9px;border-top:1px solid #21262d;padding-top:9px">
    ${box}
    <p class="small" style="margin-top:6px;color:var(--sub);line-height:1.6">
      브라우저는 공간이 부족하면 오래 안 쓴 사이트의 저장 데이터를 스스로 지웁니다. 영구 보존을 받아 두면 그 <b>자동 정리 대상에서 빠집니다.</b><br>
      크롬·엣지는 방문 빈도·북마크·홈 화면 추가 여부를 보고 <b>묻지 않고 판단</b>하고, 파이어폭스는 한 번 물어봅니다.
      승인이 안 되면 이 페이지를 <b>북마크</b>하거나 <b>홈 화면에 추가</b>하고 며칠 더 플레이한 뒤 다시 눌러 보세요.<br>
      ⚠️ 사용자가 직접 사이트 데이터를 지우는 것과 사파리의 7일 규칙은 <b>영구 보존으로도 막지 못합니다.</b></p>
  </div>`;
}
function saveInfoHtml(){
  const ok=storageOK();
  let size=SAVE_SIZE, when=SAVE_LAST;
  try{ const raw=localStorage.getItem(SAVE_KEY); if(raw) size=raw.length; }catch(e){}
  const kb=size?Math.round(size/1024):0;
  /* 💽 지금 세이브가 어디에 사는가 — 기본 저장소(약 5MB)인가, 큰 저장소인가 */
  const _ptr=(()=>{ try{ return savePtr(); }catch(e){ return null; } })();
  const _big=!!_ptr;
  const _mb=size?(size*2/1024/1024):0;      // 브라우저는 글자당 2바이트로 센다
  const whereHtml = _big
    ? `<div class="msg good" style="margin:6px 0"><b>💽 큰 저장소(IndexedDB)에 보관 중</b>
         <span class="small">— 세이브가 브라우저 기본 저장소 한도(약 5MB)를 넘어, 한도가 훨씬 큰 쪽으로 옮겼습니다.
         기록을 잘라 내지 않고 통째로 보관합니다. 이어하기·자동 저장 모두 정상입니다.</span></div>`
    : `<p class="small" style="opacity:.8">💽 저장 위치 — <b>기본 저장소</b> (사용량 약 ${_mb.toFixed(2)}MB / 한도 약 5MB)
         · 한도를 넘으면 <b>큰 저장소</b>로 자동으로 옮겨 갑니다.</p>`;
  const t=when? new Date(when) : null;
  const ago=t? `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}` : "—";
  return `<div class="card" style="${ok?"":"border-color:var(--red)"}">
    <h3>💾 세이브 관리</h3>
    ${ok
      ? `<p class="small">진행할 때마다 브라우저에 자동 저장됩니다. <b>마지막 저장 ${ago}</b> · 크기 <b>${kb}KB</b>
           ${SAVE_FAIL?` · <span style="color:var(--red)">최근 실패 ${SAVE_FAIL}회</span>`:""}</p>`
      : `<div class="msg warn" style="margin-bottom:8px">⚠️ <b>이 브라우저에서는 자동 저장이 되지 않습니다.</b><br>
           <span class="small">사생활 보호(시크릿) 모드이거나 사이트 데이터가 차단된 상태입니다.
           일반 창으로 다시 열거나, 아래 <b>세이브파일 저장</b>으로 파일에 보관하세요.</span></div>`}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      <button class="mini" onclick="exportSave()">💾 세이브파일 저장</button>
      <label class="mini" style="display:inline-flex;align-items:center;cursor:pointer;margin:0">📂 세이브파일 불러오기
        <input type="file" accept="application/json,.json" style="display:none" onchange="importSave(this)"></label>
    </div>
    ${whereHtml}
    ${storeRowHtml()}
    ${persistRowHtml()}
    <p class="small" style="margin-top:8px;color:var(--sub)">
      📱 <b>아이폰 사파리</b>는 사이트를 <b>7일</b> 동안 열지 않으면 저장 데이터를 스스로 지웁니다(브라우저 정책 — 영구 보존으로도 못 막습니다).
      오래 쉴 예정이라면 <b>세이브파일 저장</b>을 눌러 두세요. 기기를 바꿔도 그 파일로 이어서 할 수 있습니다.<br>
      🧹 브라우저 「인터넷 사용 기록 삭제」에서 <b>쿠키 및 기타 사이트 데이터</b>를 체크하면 세이브도 함께 지워집니다.
      <span style="opacity:.8">(「캐시된 이미지 및 파일」만 지우면 세이브는 남습니다)</span><br>
      ${fsStandalone()?`📲 <b style="color:var(--green)">홈 화면 앱으로 실행 중</b> — 가장 안전한 상태입니다.`
        :`📲 <b>홈 화면에 추가</b>해서 앱처럼 쓰면 더 안전합니다 — 아래 카드에 방법이 있습니다.`}</p>
  </div>`;
}
/* ═══════════════════════════════════════════════════════════════
   🛠️ 인게임 에디터
   팀·선수·감독의 수치를 직접 고친다. 밸런스 검증이나 "내 마음대로 리그" 용도.
   페널티는 없다 — 다만 저장에 그대로 남으므로 되돌리려면 직접 되돌려야 한다.
═══════════════════════════════════════════════════════════════ */
let ED={tid:null, pid:null, tab:"team"};

function edTeam(){
  if(!ED.tid) return null;
  if(G.teams[ED.tid]) return G.teams[ED.tid];
  /* 🌏 대회 구단은 G.teams 에 없다 — 따로 꺼내 온다 */
  if(String(ED.tid).indexOf("eacl_")===0){ try{ return eaclTeam(ED.tid); }catch(e){ return null; } }
  if(String(ED.tid).indexOf("cwc_")===0){ try{ return cwcClub(String(ED.tid).slice(4)); }catch(e){ return null; } }
  return null;
}
function edIsCwc(t){ return !!(t && (t.cwc || String(t.id||"").indexOf("cwc_")===0)); }
function edIsEacl(t){ return !!(t && !edIsCwc(t) && (t.eacl || String(t.id||"").indexOf("eacl_")===0)); }
function edPlayer(){
  if(ED.pid==null) return null;
  if(ED.tid==="fa") return (G.freeAgents||[]).find(p=>p.id===ED.pid)||null;
  if(ED.tid==="os") return (G.overseas||[]).find(p=>p.id===ED.pid)||null;
  const t=edTeam(); return t ? t.players.find(p=>p.id===ED.pid) : null;
}
/* 🔍 에디터 선수 검색 — 팀을 고를 필요 없이 이름(초성 포함)으로 바로 찾아 수정한다 */
let ED_Q="";
function edSearchRefresh(v){
  ED_Q=String(v||"");
  const el=document.getElementById("edSearchRes");
  if(el) el.innerHTML=edSearchResults(ED_Q);
}
function edSearchResults(qRaw){
  const q=psNorm(qRaw);
  if(!q) return `<p class="small" style="margin:4px 0">이름 일부나 초성(ㅅㅇㅁ)으로 리그 전체에서 찾습니다.</p>`;
  const pool=[];
  for(const id in G.teams){ const ot=G.teams[id];
    for(const p2 of ot.players) pool.push({p:p2, ot, tid:id, lbl:ot.short}); }
  for(const p2 of (G.freeAgents||[])) pool.push({p:p2, ot:null, tid:"fa", lbl:"🆓 FA"});
  /* ⚠ 해외 시장은 탭을 처음 열 때 생성되는 지연 목록이다 — G.overseas 를 그냥 읽으면
     해외 탭을 한 번도 안 연 세이브에서 텅 비어 "검색이 안 되는" 것처럼 보인다. */
  let osArr=[]; try{ osArr=overseasList(); }catch(e){ osArr=G.overseas||[]; }
  for(const p2 of osArr) pool.push({p:p2, ot:null, tid:"os", lbl:"🌍 "+(p2.osClub||"해외")});
  const hits=pool.map(e=>({...e, sc:psScore(e, q)})).filter(e=>e.sc>0)
                 .sort((a,b)=>b.sc-a.sc || sortLv(b.p)-sortLv(a.p)).slice(0,8);
  if(!hits.length) return `<p class="small" style="margin:4px 0">"${qRaw}" — 조건에 맞는 선수가 없습니다.</p>`;
  return hits.map(e=>`<button class="mini" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;margin-bottom:4px;padding:8px 10px" onclick="edPickPlayer('${e.tid}',${e.p.id})">
    <b class="${e.p.frn?"frnN":""}">${psMark(e.p.name, q)}</b>
    <span class="small pos-${e.p.pos}">${e.p.pos}</span>
    <span class="small">${e.lbl}</span>
    <span class="small" style="margin-left:auto">${abilityStars(e.p)}</span>
  </button>`).join("");
}
function edPickPlayer(tid, pid){
  ED.tid=tid; ED.pid=pid; ED.tab="player"; ED_Q="";
  show("editor");
}
function edGo(k,v){
  if(k==="tid"){ ED.tid=v||null; ED.pid=null; }
  else if(k==="pid"){ ED.pid=v?parseInt(v,10):null; }
  else if(k==="tab"){ ED.tab=v; }
  show("editor");
}
function edNum(v, lo, hi, dec){
  let n=parseFloat(String(v).replace(",", "."));
  if(!isFinite(n)) return null;
  n=clamp(n, lo, hi);
  const m=Math.pow(10, dec||0);
  return Math.round(n*m)/m;
}
/* ── 팀 필드 ── */
/* 수정 내역 기록 — "수정한 부분만 내보내기"의 원본.
   같은 대상·같은 항목은 마지막 값만 남긴다. 선수는 이름으로 기록하고(세이브마다 id가 다르다),
   개명 후의 수정은 새 이름으로 이어 기록되므로 순서대로 적용하면 그대로 재현된다. */
function edLog(tid, pn, kind, field, v){
  if(!Array.isArray(G.edits)) G.edits=[];
  const key=tid+"|"+(pn||"")+"|"+kind+"|"+field;
  const i=G.edits.findIndex(e=>e.key===key);
  if(i>=0) G.edits.splice(i,1);
  G.edits.push({key, tid, pn:pn||null, k:kind, f:field, v:String(v)});
  if(G.edits.length>600) G.edits=G.edits.slice(-600);
}
/* 에디터로 이름을 바꾸면, 이미 쌓여 있는 소셜 반응·뉴스·팀 분위기·루머 속 옛 이름도 따라 바뀐다.
   긴 이름부터 바꿔 "김현"이 "김현우"의 배 속을 갉아먹지 않게 한다. */
function renameEverywhere(pairs){
  const ps=(pairs||[]).filter(x=>x&&x[0]&&x[1]&&x[0]!==x[1]&&String(x[0]).length>=2)
                      .sort((a,b)=>String(b[0]).length-String(a[0]).length);
  if(!ps.length) return;
  const fix=s=>{ if(typeof s!=="string"||!s) return s;
    for(const [o,n] of ps) if(s.indexOf(o)>=0) s=s.split(o).join(n);
    return s; };
  const walk=(arr,keys)=>{ if(!Array.isArray(arr)) return;
    for(const it of arr){ if(!it) continue; for(const k of keys) if(typeof it[k]==="string") it[k]=fix(it[k]); } };
  walk(G.news,   ["txt"]);
  walk(G.social, ["txt","u"]);
  walk(G.fmk,    ["txt","u"]);
  walk(G.feed,   ["head","sub"]);
  walk(G.rumors, ["txt"]);
  if(G.trust) walk(G.trust.log, ["why","t","txt"]);
  if(G.staff) walk(G.staff.log, ["t","txt"]);
  try{ walk(refState().log, ["t"]); }catch(e){}
  try{ walk(me().log, ["t"]); }catch(e){}
}
function edSetTeamQ(t, field, v){
  /* 🌏 대회 구단은 세이브에 스쿼드가 통째로 다시 만들어지므로, 덮어쓰기 표로 관리한다.
     ⚠ 제보 — 「홈구장이랑 수용 인원 등 명칭 바꾸고 넘어가면 다시 가칭으로 돌아가서」.
     이름·약칭만 표로 가고 구장·모기업은 캐시에 직접 써서 저장 때 날아갔다 — 같이 보낸다. */
  /* ⚠ 제보 — 여섯 항목만 표로 보냈더니 팬 규모·예산·등급 따위가 다음 시즌에 사라졌다.
     이제 에디터 팀 탭의 전 항목(OVR_TEAM_F)을 표로 보낸다. */
  if(edIsCwc(t)  && OVR_TEAM_F.indexOf(field)>=0){ cwcSetName(t.id, field, v); return; }
  if(edIsEacl(t) && OVR_TEAM_F.indexOf(field)>=0){ eaclSetName(t.id, field, v); return; }
  /* 🔒 국내 구단 — 명칭류는 잠금 등록부에 남긴다. AI 가 나중에 덮어써도 여기서 되돌린다. */
  try{ edLockPut(t.id, field, v); }catch(e){}
  if(field==="name"){ const nm=String(v).trim().slice(0,20); if(nm){ const old=t.name; t.name=nm; renameEverywhere([[old,nm]]); } }
  else if(field==="short"){ const nm=String(v).trim().slice(0,8); if(nm){ const old=t.short; t.short=nm; renameEverywhere([[old,nm]]); } }
  else if(field==="owner"){ const nm=String(v).trim().slice(0,20);
    if(!G.ownerNames) G.ownerNames={};
    if(nm) G.ownerNames[t.id]=nm; else delete G.ownerNames[t.id];
    /* 감독이 직접 지은 이름은 형태를 바꿔도 건드리지 않는다 */
    if(G.ownerAuto) delete G.ownerAuto[t.id];
    try{ stkSyncClubListing(t); }catch(e){} }
  /* 🏢 구단 형태 — 기업 / 시민 / 기업+시민 / 군경 */
  else if(field==="ownKind"){
    const k=String(v||"").trim();
    if(!CLUB_TYPE_N[k]) return;
    if(!G.ownerKinds) G.ownerKinds={};
    const base=(CLUB_TYPE[t.id]||{}).k || "civic";
    if(k===base) delete G.ownerKinds[t.id]; else G.ownerKinds[t.id]=k;
    /* 운영 주체 이름을 따로 지정하지 않았다면 형태에 맞는 기본 이름으로 갈아 준다 —
       「기업구단인데 운영 주체가 ○○시 · 시민주주」 같은 어긋남을 막는다 */
    const _auto=!G.ownerNames || !G.ownerNames[t.id] || ((G.ownerAuto||{})[t.id]);
    if(_auto){
      const rg=(typeof REGION!=="undefined" && REGION[t.id]) || t.short || t.name;
      const def = k==="corp"  ? `${t.short||rg}그룹`
                : k==="civic" ? `${rg} · 시민주주`
                : k==="mixed" ? `${rg} · 지역기업 컨소시엄`
                :               `국군체육부대`;
      G.ownerNames=G.ownerNames||{}; G.ownerAuto=G.ownerAuto||{};
      if(def===((CLUB_TYPE[t.id]||{}).o||"")){ delete G.ownerNames[t.id]; delete G.ownerAuto[t.id]; }
      else { G.ownerNames[t.id]=def; G.ownerAuto[t.id]=1; }
    }
    /* 📈 기업구단이 되면 모기업이 증시에 올라온다 (반대면 상장 폐지가 아니라 조용히 빠진다) */
    try{ stkSyncClubListing(t); }catch(e){}
  }
  else if(field==="budget"){ const n=edNum(v,0,99999,1); if(n!=null) t.budget=n; }
  else if(field==="wageCap"){ const n=edNum(v,0,99999,1); if(n!=null) t.wageCap=n; }
  else if(field==="fans"){ const n=edNum(v,1,200,1); if(n!=null) t.fans=n; }
  else if(field==="morale"){ const n=edNum(v,40,99,0); if(n!=null) t.morale=n; }
  else if(field==="fam"){ const n=edNum(v,0,100,0); if(n!=null) t.fam=n; }
  /* 🏟️ 홈구장 — 이름·수용 인원·평균 관중을 직접 고친다 (세이브의 t.stad 에 저장) */
  else if(field==="stadName"){ const s=stadOf(t); const nm=String(v).trim().slice(0,24);
    if(nm && nm!==s.n){ const old=s.n; s.n=nm; try{ renameEverywhere([[old,nm]]); }catch(e){} } }
  else if(field==="stadCap"){ const s=stadOf(t); const n2=edNum(v,1000,120000,0); if(n2!=null) s.cap=n2; }
  /* ⚠ 제보 — 「고쳐 놓으면 몇 시즌 지나서 원상복귀」. 평균 관중이 그랬다.
     시즌말 조정(attSeasonAdjust)의 하한·상한이 옛 자료값(_base0)에 묶여 있어서,
     14,000 으로 올려 둬도 첫 시즌말에 10,400 으로 끌려 내려갔다(실측).
     감독이 손수 넣은 값은 「그 구단의 진짜 기준 관중」으로 인정하고 밑값까지 옮긴다. */
  else if(field==="stadAvg"){ const s=stadOf(t); const n2=edNum(v,100,120000,0);
    if(n2!=null){ s.avg=Math.min(n2, s.cap||n2); s._base0=s.avg; } }
  else if(field==="youthLv"){ const n=edNum(v,1,10,0); if(n!=null) t.youthLv=n; }
  else if(field==="trainLv"){ const n=edNum(v,1,10,0); if(n!=null) t.trainLv=n; }
  else if(field==="scoutLv"){ const n=edNum(v,1,5,0); if(n!=null) t.scoutLv=n; }
}
function edSetTeam(field, v){
  const t=edTeam(); if(!t) return;
  edLog(t.id, null, "t", field, v);
  edSetTeamQ(t, field, v);
  saveGame(); show("editor");
}
/* ── 선수 필드 ── */
function edSetPlayerQ(p, field, v){
  if(field==="name"){ const nm=String(v).trim().slice(0,14); if(nm){ const old=p.name; p.name=nm; renameEverywhere([[old,nm]]); } }
  else if(field==="pos"){ if(["GK","DF","MF","FW"].indexOf(v)>=0 && p.pos!==v){
    p.pos=v;
    /* ⚠ 제보 — 에디터로 포지션을 고쳐도 다시 불러오면 GK로 돌아갔다.
       능숙도(posFam)는 그대로라 syncPosBand 가 원래 값으로 되돌렸기 때문.
       ① 손으로 못 박았다고 표시하고 ② 능숙도도 앞뒤가 맞게 정리한다. */
    p._posLock=1;
    if(!p.posFam) p.posFam=initPosFam(p);
    if(v==="GK"){ p.posFam.GK=100; }
    else{
      p.posFam.GK=0;
      const home=SLOT_FAM[p.prefPos];
      if(!home || home==="GK" || FAM_LINE[home]!==v){
        /* 주 포지션이 새 대분류와 어긋난다 — 그 라인의 기본 자리를 열어 준다 */
        const dflt = v==="DF"?"DC" : v==="MF"?"MC" : "ST";
        p.posFam[dflt]=Math.max(p.posFam[dflt]||0, 100);
        if(!p.prefPos || p.prefPos==="GK") p.prefPos = v==="DF"?"CB" : v==="MF"?"CM" : "ST";
      }
    }
  } }
  else if(field==="prefPos"){ if(SLOT_FAM[v]){
    p.prefPos=v;
    /* ⚠ 제보 — 주 포지션만 바뀌고 능숙도는 옛 자리에 남아, 새 주 포지션이 "미숙함"으로 떴다.
       새 주 포지션 기준의 기본 능숙도(본 자리 100 + 인접 자리)를 깔되,
       이미 경기로 익힌 자리는 그대로 존중한다(max 병합 — 배운 걸 빼앗지 않는다). */
    const fresh=initPosFam(p);
    if(!p.posFam) p.posFam=fresh;
    else for(const k of FAM_POS) p.posFam[k]=Math.max(p.posFam[k]||0, fresh[k]||0);
    /* 🧯 필드 자리를 주 포지션으로 삼았는데 GK 능숙도가 남아 있으면 대분류가 GK로 튄다 */
    if(v!=="GK") p.posFam.GK=0; else p.posFam.GK=100;
    syncPosBand(p);
  } }
  else if(field==="by"){ const n=edNum(v,1900,2026,0); if(n!=null) p.by=n; }   // 나이 제한 없음
  else if(field==="status"){
    /* 계약 신분 — 각 신분에 맞는 실제 로직으로 이동시킨다 */
    if(v==="own"){ p.loan=null; p.ct=Math.max(p.ct||1,1); }
    else if(v==="loan"){
      const t2=G.teams[ED.tid];
      if(t2){
        const own=Object.values(G.teams).find(x=>x.id!==ED.tid && !x.isUser) || Object.values(G.teams).find(x=>x.id!==ED.tid);
        p.loan={own:own?own.id:null, to:ED.tid, until:G.season, apps0:p.apps||0, buy:null};
      }
    }
    else if(v==="fa"){
      const t2=G.teams[ED.tid];
      if(t2){
        const i=t2.players.indexOf(p); if(i>=0) t2.players.splice(i,1);
        p.loan=null; (G.freeAgents=G.freeAgents||[]).push(p);
        if(t2.isUser && Array.isArray(G.userXI)) G.userXI=G.userXI.filter(id=>id!==p.id);
        if(t2.tactic&&Array.isArray(t2.tactic.benchSel)) t2.tactic.benchSel=t2.tactic.benchSel.filter(id=>id!==p.id);
        ED.tid="fa";   // 에디터도 FA 시장으로 따라간다
      }
    }
  }
  else if(field==="loanOwn"){ if(p.loan && G.teams[v]) p.loan.own=v; }
  else if(field==="hg"){ p.hg = (String(v).trim()==="1") ? 1 : 0; }
  else if(field==="h"){ const n=edNum(v,155,215,0); if(n!=null) p.h=n; }
  else if(field==="w"){ const n=edNum(v,48,115,0); if(n!=null) p.w=n; }
  else if(field==="wage"){ const n=edNum(v,0.1,3000,1); if(n!=null) p.wage=n; }
  else if(field==="ct"){ const n=edNum(v,1,6,0); if(n!=null) p.ct=n; }
  else if(field==="mv"){ const n=edNum(v,0,3000,1); if(n!=null){ if(n>0) p.mvFix=n; else delete p.mvFix; } }
  else if(field==="mvAuto"){ delete p.mvFix; }
  else if(field==="pot"){ const n=edNum(v,90,200,0); if(n!=null) p.pot=potFromDisp(p, n); }
  else if(field==="cond"){ const n=edNum(v,55,100,0); if(n!=null) p.cond=n; }
  else if(field==="morale"){ const n=edNum(v,30,99,0); if(n!=null) p.morale=n; }
  else if(field==="aff"){ const n=edNum(v,0,100,0); if(n!=null) affSet(p,n); }
  else if(field==="inj"){ const n=edNum(v,0,30,0); if(n!=null){
    try{ setInjury(p, n, true); }catch(e){ p.inj=n; }
    /* 🐛 유형을 안 붙이면 소견서가 진단명 없이 뜨고, 골절에 진통제가 열린다.
       0 으로 되돌릴 때 유형을 안 지우면 낡은 진단이 남아 재발 판정이 그걸 읽는다. */
    try{ if(n>0){ if(!p.injT){ p.injT=injTypeForWeeks(n); p.injC=p.injC||"train"; } }
         else { delete p.injT; delete p.injC; } }catch(e){}
  } }
  else if(field==="ban"){ const n=edNum(v,0,10,0); if(n!=null) p.ban=n; }
  else if(field==="tpt"){ const n=edNum(v,0,99,0); if(n!=null) p.tpt=n; }
}
function edSetPlayer(field, v){
  const p=edPlayer(); if(!p) return;
  edLog(ED.tid, field==="name"?p.name:p.name, "p", field, v);
  edSetPlayerQ(p, field, v);
  saveGame(); show("editor");
}
/* 능력치 — 화면 1~20 단위로 받고 내부 15~99 로 저장한다 */
function edSetAttrQ(p, key, v){
  const n=edNum(v,1,20,0); if(n==null) return;
  const raw=clamp(n*5, 15, 99);
  const isGk=GKT_ATTRS.indexOf(key)>=0;
  if(isGk){ if(!p.gkA) p.gkA={}; p.gkA[key]=raw; }
  else { if(!p.attr) p.attr={}; p.attr[key]=raw; }
  /* 🛠️ 나이 천장이 걸리는 항목(주력·가속·활동량 …)을 천장 위로 올렸다면, 그 값을 이 선수의 천장으로 남긴다.
     이게 없으면 다음 훈련 틱에서 나이 천장까지 그대로 끌어내려진다(제보). */
  try{
    if(AGE_CEIL_W[key]){
      const _age=G.season-(p.by||G.season-25);
      if(raw>ageCeil(_age, AGE_CEIL_W[key])){ if(!p.capOv) p.capOv={}; p.capOv[key]=raw; }
      else if(p.capOv){ delete p.capOv[key]; }
    }
  }catch(e){}
  if(p.attr) syncLegacyAttrs(p.attr);
  if(p.gkA && typeof syncLegacyGk==="function"){ try{ syncLegacyGk(p); }catch(e){} }
  /* 오버롤도 능력치를 따라간다 */
  try{
    const ca=rawCA(p, p.ovr);
    p.ovrF=Math.round(clamp(ca,38,96)*100)/100;
    p.ovr=Math.round(p.ovrF);
    if(p.pot<p.ovr) p.pot=p.ovr;
  }catch(e){}
}
function edSetAttr(key, v){
  const p=edPlayer(); if(!p) return;
  edLog(ED.tid, p.name, "a", key, v);
  edSetAttrQ(p, key, v);
  saveGame(); show("editor");
}
/* 포지션 능숙도 0~100 */
function edSetFamQ(p, key, v){
  const n=edNum(v,0,100,0); if(n==null) return;
  if(!p.posFam) p.posFam=initPosFam(p);
  p.posFam[key]=n;
}
function edSetFam(key, v){
  const p=edPlayer(); if(!p) return;
  edLog(ED.tid, p.name, "f", key, v);
  edSetFamQ(p, key, v);
  saveGame(); show("editor");
}
/* ── 감독·게임 전역 ── */
function edAddNick(){
  const nEl=document.getElementById("nkName"), eEl=document.getElementById("nkEmoji");
  const n=nEl?String(nEl.value).trim().slice(0,14):"";
  const e=eEl?String(eEl.value).trim().slice(0,4):"";
  if(!n){ flash("닉네임을 입력하세요.","warn"); show("editor"); return; }
  const C=customNicks();
  if(C.some(x=>x.n===n)){ flash("이미 있는 닉네임입니다.","warn"); show("editor"); return; }
  if(C.length>=40){ flash("커스텀 닉네임은 40개까지입니다.","warn"); show("editor"); return; }
  C.push({n, e:e||"💬"});
  edLog(null, null, "nick", n, "+"+(e||"💬"));
  saveGame(); show("editor");
}
function edDelNick(i){
  const C=customNicks();
  if(C[i]) edLog(null, null, "nick", C[i].n, "-");
  C.splice(i,1); saveGame(); show("editor");
}
/* 기자단 — 기자회견 3인·이적시장 6인의 이름/매체 */
function edSetOwner(t, v){
  edSetTeamQ(t, "owner", v);
  edLog(t.id, null, "t", "owner", String(v).trim().slice(0,20));   // 수정본 패치에도 실린다
  saveGame(); show("editor");
}
function edSetPressQ(i, f, v){
  const s=String(v).trim().slice(0, f==="n"?10:14);
  if(!Array.isArray(G.pressCrew)) G.pressCrew=[{},{},{}];
  if(!G.pressCrew[i]) G.pressCrew[i]={};
  G.pressCrew[i][f]=s;
}
function edSetPress(i, f, v){
  edSetPressQ(i, f, v);
  edLog(null, null, "press", i+":"+f, String(v).trim());
  saveGame(); show("editor");
}
function edSetRepQ(i, f, v){
  const s=String(v).trim().slice(0, f==="n"?10:14);
  if(!Array.isArray(G.repCrew)) G.repCrew=REPORTERS.map(()=>({}));
  if(!G.repCrew[i]) G.repCrew[i]={};
  G.repCrew[i][f]=s;
}
function edSetRep(i, f, v){
  edSetRepQ(i, f, v);
  edLog(null, null, "rep", i+":"+f, String(v).trim());
  saveGame(); show("editor");
}
function edPressReset(){ G.pressCrew=null; G.repCrew=null; saveGame(); show("editor"); }
function edSetRefQ(i, v){
  const nm=String(v).trim().slice(0,8);
  if(nm) refNames()[i]=nm;
}
function edSetRef(i, v){
  edSetRefQ(i, v);
  edLog(null, null, "ref", String(i), String(v).trim().slice(0,8));
  saveGame(); show("editor");
}
function edSetComp(k, field, v){
  if(!COMP_DEF[k]) return;
  const s=String(v).trim().slice(0, field==="s"?12:40);
  if(!s) return;
  if(!G.compNames) G.compNames={};
  if(!G.compNames[k]) G.compNames[k]={};
  G.compNames[k][field]=s;
  edLog(null,null,"mgr","comp:"+k+":"+field,s);
  saveGame(); show("editor");
}
function edCompReset(){ G.compNames=null; saveGame(); show("editor"); }
function edSetCoachName(tid, v){
  const c=COACHES[tid]; if(!c) return;
  const nn=String(v).trim().slice(0,12);
  if(nn){ c.n=nn; (G.coachNames=G.coachNames||{})[tid]=nn; edLog(null,null,"mgr","coachName",nn); }
  saveGame(); show("editor");
}
function edCoachOpen(tid){ ED.coach = (ED.coach===tid) ? null : tid; show("editor"); }
/* 감독 능력치 — 세이브에 남겨 두고, 불러올 때 다시 입힌다(COACHES 는 코드 상수) */
/* 🎩 수석코치 편집 — 능력치는 1~20, 이름·나이·연봉·계약·성향까지 손본다 */
function edSetAc(key, v, id){
  acEnsure();
  const c=id?crewById(id):acOf(); if(!c) return;
  if(key==="n"){ const s=String(v||"").trim().slice(0,12); if(s) c.n=s; }
  else if(key==="trait"){ if(AC_TRAIT[v]) c.trait=v; }
  else if(key==="age")  c.age=clamp(Math.round(+v||45), 28, 75);
  else if(key==="ct")   c.ct=clamp(Math.round(+v||0), 0, 6);
  else if(key==="wage") c.wage=Math.max(0, Math.round((+v||0)*10)/10);
  else if(key==="assign"){ c.assign=(v&&AC_SLOT_BY[v])?v:null; }
  /* 🎩 FM 능력치를 직접 고친다 — 옛 키는 acSync 가 다시 파생한다 (요청) */
  else if(SA_KEYS.indexOf(key)>=0){ c.a=c.a||{}; c.a[key]=clamp(Math.round(+v||10), 1, 20); acSync(c); }
  /* 🐛 옛 키를 직접 고치면 다음 acSync 가 FM 표에서 다시 파생해 그 수정을 지운다.
     고친 값을 FM 표 쪽에 심어 두 표가 어긋나지 않게 한다. */
  else if(acKeysOf(c).indexOf(key)>=0){ c[key]=clamp(Math.round(+v||10), 1, 20);
    try{ delete c.a; acSeedFromLegacy(c); }catch(e){} }
  c.ovr=acOvr(c); c.hired=true;
  try{ edLog(null,null,"ac",key,v); }catch(e){}
  saveGame(); show("editor");
}
function edAcNew(role){
  acEnsure();
  const rk=AC_ROLE[role]?role:"ac";
  if(rk==="ac" && acOf()){ const ix=crew().indexOf(acOf()); if(ix>=0) crew().splice(ix,1); }
  const c=acDefaultFor(userTeam(), rk);
  c.hired=true; c.ct=2; c.since=G.season;
  crew().push(c);
  saveGame(); show("editor");
}
function edSetCoachAttr(tid, key, v){
  const c=COACHES[tid]; if(!c) return;
  const isSA=(SA_KEYS.indexOf(key)>=0);
  if(!isSA && ["tac","flex","att","def","man","dev","judg","ovr"].indexOf(key)<0) return;
  const n=edNum(v,1,20,0); if(n==null){ show("editor"); return; }
  if(isSA){
    /* 🎩 FM 표가 진짜 데이터다 — 옛 키는 acSync 가 다시 파생한다 (요청) */
    try{ if(acNeedSeed(c)) acSeedFromLegacy(c); }catch(e){}
    c.a=c.a||{}; c.a[key]=n;
    try{ acSync(c); c.ovr=Math.round((c.tac+c.flex+c.att+c.def+c.man+c.dev+c.judg)/7); }catch(e){}
    const st2=(G.coachSA=G.coachSA||{});
    (st2[tid]=st2[tid]||{})[key]=n;             // 세이브 복원용 — 코드 상수 COACHES 는 매번 새로 뜬다
    edLog(null,null,"mgr","coachSA:"+tid+":"+key,n);
    saveGame(); show("editor"); return;
  }
  c[key]=n;
  if(key!=="ovr"){ try{ delete c.a; acSeedFromLegacy(c); }catch(e){} }
  const st=(G.coachAttrs=G.coachAttrs||{});
  (st[tid]=st[tid]||{})[key]=n;
  edLog(null,null,"mgr","coachAttr:"+tid+":"+key,n);
  saveGame(); show("editor");
}
function edSetCoachRel(tid, v){
  const n2=edNum(v,0,100,0);
  if(n2!=null){ (G.coachRel=G.coachRel||{})[tid]=n2; edLog(null,null,"mgr","coachRel",n2); }
  saveGame(); show("editor");
}
function edSetRefRel(v){ const n=edNum(v,-100,100,0); if(n!=null){ refState().rel=n; edLog(null,null,"mgr","refs",n); } saveGame(); show("editor"); }
function edRefReset(){ G.refNames=REF_FAM_DEF.slice(); saveGame(); show("editor"); }
function edSetTune(k, v){ meTuneSet(k, v); saveGame(); show("engineEd"); }
function edTuneReset(){ G.meTune=Object.assign({}, ME_TUNE_DEF); saveGame(); show("engineEd"); }
/* 매치엔진 튠은 선수 데이터와 성격이 다르다 — 파일도 따로 나눈다.
   "리얼 저득점 패치" 같은 걸 선수 오버홀과 별개로 공유할 수 있게. */
const ME_TUNE_KIND="klm2026-engine-tune";
function tuneExport(){
  const obj={kind:ME_TUNE_KIND, v:1, made:new Date().toISOString().slice(0,10),
             tune:Object.assign({}, ME_TUNE_DEF, G.meTune||{})};
  try{
    const txt=JSON.stringify(obj);
    const name=`klm2026_engine_${obj.made.replace(/-/g,"")}.json`;
    const blob=new Blob([txt],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name; a.style.display="none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 800);
    showConfirm(`<b>📤 매치엔진 설정을 내보냈습니다.</b>\n\n· 파일명: ${name}\n· ${ME_TUNE_INFO.map(([k])=>`${k} ×${meTune(k).toFixed(1)}`).join(" · ")}\n\n<span class="small">선수 데이터와 무관하게 엔진 배수만 담깁니다.</span>`,
      ()=>{}, {okLabel:"확인", cancelLabel:""});
  }catch(e){ flash("내보내기에 실패했습니다.","warn"); show("engineEd"); }
}
function tuneImport(input){
  const f=input && input.files && input.files[0];
  if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const obj=JSON.parse(String(r.result||""));
      if(!obj || obj.kind!==ME_TUNE_KIND || !obj.tune) throw new Error("형식");
      G.meTune={};
      for(const k in ME_TUNE_DEF) meTuneSet(k, obj.tune[k]);
      saveGame();
      showConfirm(`<b>✅ 매치엔진 설정을 적용했습니다.</b>\n\n${ME_TUNE_INFO.map(([k,n])=>`· ${n} ×${meTune(k).toFixed(1)}`).join("\n")}\n\n<span class="small">다음 경기부터 바로 적용됩니다.</span>`,
        ()=>show("engineEd"), {okLabel:"확인", cancelLabel:""});
    }catch(err){
      /* 무엇이 문제였는지 알려 준다 — "읽을 수 없는 파일"만으로는 제보가 되지 않는다 */
      const why=(err&&err.message)?String(err.message).slice(0,90):"알 수 없는 오류";
      showConfirm(`<b>❌ 이 파일을 적용하지 못했습니다.</b>\n\n<span class="small">${why}</span>\n\n에디터에서는 다음 파일을 읽을 수 있습니다:\n· 에디터 데이터 <b>klm2026_DB_*.json</b>\n· 이름 파일 <b>klm2026_names_*.json</b>\n· 수정본 패치 <b>klm2026_patch_*.json</b>\n\n<span class="small">세이브 파일(klm2026_save_*)은 ⚙️ 설정 → 💾 세이브 불러오기에서 여세요.</span>`,
        ()=>show("editor"), {okLabel:"확인", cancelLabel:""});
    }
    try{ input.value=""; }catch(e2){}
  };
  r.readAsText(f);
}
/* 선수 특성 편집 — 에디터는 포지션 제한·포인트 소모 없이 곧바로 넣고 뺀다 */
function edAddTrait(v){
  const p=edPlayer(); if(!p || !v) return;
  edLog(ED.tid, p.name, "tr", v, "+");
  if(!TRAIT_BY_KEY[v]){ show("editor"); return; }
  if(!Array.isArray(p.traits)) p.traits=[];
  if(p.traits.indexOf(v)>=0){ flash("이미 가진 특성입니다.","warn"); show("editor"); return; }
  if(p.traits.length>=TRAIT_MAX){ flash(`특성은 최대 ${TRAIT_MAX}개까지입니다. 먼저 하나를 빼세요.`,"warn"); show("editor"); return; }
  p.traits.push(v);
  saveGame(); show("editor");
}
function edDelTrait(v){
  const p=edPlayer(); if(!p) return;
  edLog(ED.tid, p.name, "tr", v, "-");
  p.traits=(p.traits||[]).filter(k=>k!==v);
  saveGame(); show("editor");
}
function edSetMgrQ(field, v){
  if(field==="cash"){ const n=edNum(v,-999,99999,2); if(n!=null) me().cash=n; }
  else if(field==="debt"){ const n=edNum(v,0,9999,2); if(n!=null) me().debt=n; }
  else if(field==="own"){ const n=edNum(v,0,100,0); if(n!=null) G.trust.owner=n; }
  else if(field==="fan"){ const n=edNum(v,0,100,0); if(n!=null) G.trust.fans=n; }
  else if(field==="press"){ const n=edNum(v,0,100,0); if(n!=null) G.press.rel=n; }
  else if(field==="refs"){ const n=edNum(v,-100,100,0); if(n!=null) refState().rel=n; }
}
function edSetMgr(field, v){
  edSetMgrQ(field, v);
  edLog(null, null, "mgr", field, v);
  saveGame(); show("editor");
}
/* ── FM식 에디터 데이터 파일 ──────────────────────────────────
   리그 전체(모든 팀·모든 선수)의 값을 통째로 담아 내보내고,
   불러오면 자기 세이브 위에 그대로 덮어쓴다. 시즌 진행(순위·일정·기록)은 건드리지 않고
   "누가 얼마나 잘하는가"만 파일의 값으로 바뀐다. */
const ED_DB_KIND="klm2026-editor-db";
let ED_RENAMES=null;   // DB 가져오기 중에만 채워진다 — 끝나면 renameEverywhere 로 피드 소급
const ED_PATCH_KIND="klm2026-editor-patch";
const ED_NAMES_KIND="klm2026-names";
function edExportPatch(){
  const list=(G.edits||[]);
  if(!list.length){ flash("아직 에디터로 수정한 내역이 없습니다.","warn"); show("editor"); return; }
  const t=userTeam();
  const obj={kind:ED_PATCH_KIND, v:1, from:t?t.short:"", season:G.season,
             made:new Date().toISOString().slice(0,10),
             edits:list.map(e=>({tid:e.tid, pn:e.pn, k:e.k, f:e.f, v:e.v}))};
  try{
    const txt=JSON.stringify(obj);
    const name=`klm2026_patch_${obj.made.replace(/-/g,"")}_${list.length}건.json`;
    const blob=new Blob([txt],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name; a.style.display="none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 800);
    showConfirm(`<b>📤 수정본 패치를 내보냈습니다.</b>\n\n· 수정 ${list.length}건 · ${Math.round(txt.length/102.4)/10}KB\n· 파일명: ${name}\n\n<span class="small">전체 데이터가 아니라 "무엇을 어떻게 바꿨는가"만 담깁니다.\n받은 사람은 자기 게임 위에 이 수정만 얹습니다 — 나머지는 그대로 둔 채로.</span>`,
      ()=>{}, {okLabel:"확인", cancelLabel:""});
  }catch(e){ flash("내보내기에 실패했습니다.","warn"); show("editor"); }
}
/* 패치 한 건 적용 — 에디터와 같은 검증 경로(Q setter)를 태운다 */
/* 파일 속 이름으로 세이브의 선수를 찾는다 — 성씨 변환(실존 인물 보호) "전"에 만든 파일과
   "후"에 만든 파일이 서로 호환되도록 네 단계로 본다.
   ① 이름 그대로 ② 파일 이름을 변환해 보고(충돌 회피 한 칸 더 민 것 포함)
   ③ 역방향(세이브 이름을 변환하면 파일 이름이 되는 경우)
   ④ 성만 다른 동일 인물 — 이름 꼬리(2글자 이상)+출생연도+포지션 일치 */
/* 🔤 ⚠ 제보 — 「새 게임인데도 이름 패치가 적용은 됐다는데 이름이 안 바뀐다」.
   이름 패치 파일은 선수를 고유번호(UID)로 찾는다. 그런데 고유번호는 비교적 최근에 들어간
   장치라, 그 이전 판을 쓰는 사람(모바일은 옛 파일이 캐시에 오래 남는다)에게는 번호가 없다.
   ⚠ 이 게임의 가명 처리는 「성씨만」 바꾸고 이름은 그대로 둔다 — 최주호→추주호, 류성민→나성민.
      그러니 번호가 통째로 어긋나도 「성을 뺀 이름」으로는 거의 다 찾을 수 있다.
   ─ 마지막 손질용 느슨한 매칭. 팀 안에서 「성만 다른 같은 이름」이 딱 한 명일 때만 가져간다
     (둘 이상이면 엉뚱한 사람을 개명시킬 수 있으므로 건드리지 않는다). */
const ED_SUR2=["남궁","황보","제갈","사공","선우","서문","독고","동방"];
function edGivenOf(nm){
  const s=String(nm||"").trim();
  if(!s || /[A-Za-z]/.test(s) || s.indexOf(" ")>=0) return "";     // 외국식 표기(공백·로마자)는 제외
  for(const k of ED_SUR2) if(s.length>=3 && s.indexOf(k)===0) return s.slice(2);
  return s.length>=2 ? s.slice(1) : "";
}
function edLooseFind(T, nm, used){
  const g=edGivenOf(nm); if(!g) return null;
  const L=String(nm).length;
  const cand=(T.players||[]).filter(p=>p && !used.has(p.id)
    && String(p.name).length===L && edGivenOf(p.name)===g);
  return cand.length===1 ? cand[0] : null;
}
function edFindPlayer(T, o, used){
  const free=x=>!used || !used.has(x.id);
  /* 🆔 고유번호가 있으면 최우선 — 개명·이적과 무관하게 그 선수다 */
  if(o && o.uid!=null){
    let p0=(T.players||[]).find(x=>x && +x.uid===+o.uid && free(x));
    if(p0) return p0;
    p0=findByUid(o.uid);
    if(p0 && free(p0)) return p0;
  }
  let p=T.players.find(x=>x.name===o.name && free(x)); if(p) return p;
  try{
    const n1=fictName(o.name, o.frn?1:0);
    if(n1!==o.name){
      p=T.players.find(x=>x.name===n1 && free(x)); if(p) return p;
      const n2=shiftCho(n1[0])+n1.slice(1);
      p=T.players.find(x=>x.name===n2 && free(x)); if(p) return p;
    }
    p=T.players.find(x=>free(x) && fictName(x.name, x.frn?1:0)===o.name); if(p) return p;
  }catch(e){}
  const tail=String(o.name||"").slice(1);
  if(tail.length>=2){
    p=T.players.find(x=>free(x) && x.name.slice(1)===tail
        && (o.by==null || x.by===o.by) && (!o.pos || x.pos===o.pos));
    if(p) return p;
  }
  return null;
}
function edApplyOne(e){
  /* 팀에 매이지 않는 수정 — 감독·심판·기자단·닉네임 */
  if(e.k==="mgr"){ edSetMgrQ(e.f, e.v); return true; }
  if(e.k==="ref"){ const i=parseInt(e.f,10); if(!(i>=0 && i<refNames().length)) return false; edSetRefQ(i, e.v); return true; }
  if(e.k==="press"||e.k==="rep"){
    const m=String(e.f).split(":"), i=parseInt(m[0],10), f=m[1];
    if(!(i>=0) || ["n","o"].indexOf(f)<0) return false;
    (e.k==="press"?edSetPressQ:edSetRepQ)(i, f, e.v);
    return true;
  }
  if(e.k==="nick"){
    const C=customNicks(), val=String(e.v||"");
    if(val.charAt(0)==="+"){
      const em=val.slice(1)||"💬";
      if(!C.some(x=>x.n===e.f) && C.length<40) C.push({n:String(e.f).slice(0,14), e:em.slice(0,4)});
      return true;
    }
    const i=C.findIndex(x=>x.n===e.f); if(i>=0) C.splice(i,1);
    return true;
  }
  /* FA·해외 시장 선수에 대한 수정 — 가상 팀 취급 */
  if(e.tid==="fa" || e.tid==="os"){
    const arr = e.tid==="fa" ? (G.freeAgents||[]) : (G.overseas||[]);
    const fakeT={players:arr};
    const p2=edFindPlayer(fakeT, {name:e.pn}, null);
    if(!p2) return false;
    if(e.k==="p") edSetPlayerQ(p2, e.f, e.v);
    else if(e.k==="a") edSetAttrQ(p2, e.f, e.v);
    else if(e.k==="f") edSetFamQ(p2, e.f, e.v);
    else if(e.k==="tr"){
      if(!Array.isArray(p2.traits)) p2.traits=[];
      if(e.v==="+"){ if(TRAIT_BY_KEY[e.f] && p2.traits.indexOf(e.f)<0 && p2.traits.length<TRAIT_MAX) p2.traits.push(e.f); }
      else p2.traits=p2.traits.filter(k2=>k2!==e.f);
    } else return false;
    return true;
  }
  const t=G.teams[e.tid]; if(!t) return false;
  if(e.k==="t"){ edSetTeamQ(t, e.f, e.v); return true; }
  const p=edFindPlayer(t, {name:e.pn}, null);
  if(!p) return false;
  if(e.k==="p") edSetPlayerQ(p, e.f, e.v);
  else if(e.k==="a") edSetAttrQ(p, e.f, e.v);
  else if(e.k==="f") edSetFamQ(p, e.f, e.v);
  else if(e.k==="tr"){
    if(!Array.isArray(p.traits)) p.traits=[];
    if(e.v==="+"){ if(TRAIT_BY_KEY[e.f] && p.traits.indexOf(e.f)<0 && p.traits.length<TRAIT_MAX) p.traits.push(e.f); }
    else p.traits=p.traits.filter(k2=>k2!==e.f);
  }
  else return false;
  return true;
}
function edApplyPatch(obj){
  let ok=0, miss=0;
  for(const e of (obj.edits||[])){ try{ if(edApplyOne(e)) ok++; else miss++; }catch(err){ miss++; } }
  saveGame();
  showConfirm(`<b>✅ 수정본 패치를 적용했습니다.</b>\n\n· 적용 ${ok}건${miss?` · <span style="color:var(--gold)">건너뜀 ${miss}건</span>`:""}\n${miss?`<span class="small">건너뛴 항목은 이 세이브에 없는 팀·선수입니다 (이적·개명·시즌 차이 등).</span>\n`:""}\n<span class="small">제작: ${obj.from||"?"} · ${obj.made||""} · 시즌 ${obj.season||"?"} 기준</span>`,
    ()=>show("editor"), {okLabel:"확인", cancelLabel:""});
}
function edClearLog(){
  showConfirm(`<b>🧹 수정 내역을 비웁니다.</b>\n\n이미 적용된 수정은 게임에 그대로 남고,\n"수정본만 내보내기" 목록만 비워집니다. (${(G.edits||[]).length}건)`,
    ()=>{ G.edits=[]; saveGame(); show("editor"); }, {okLabel:"비운다", cancelLabel:"취소"});
}
function edSnapPlayer(p){
  const o={uid:p.uid, name:p.name, pos:p.pos, prefPos:p.prefPos||null, by:p.by, frn:p.frn?1:0, h:p.h||0, w:p.w||0,
    ovr:p.ovr, ovrF:p.ovrF!=null?p.ovrF:p.ovr, pot:p.pot,
    wage:p.wage, ct:p.ct||1, cond:Math.round(p.cond||90), morale:Math.round(p.morale||70),
    aff:Math.round(aff(p)), inj:p.inj||0, ban:p.ban||0, tpt:p.tpt||0};
  if(p.mvFix!=null) o.mvFix=p.mvFix;
  if(p.attr){ o.attr={}; for(const k in p.attr) if(typeof p.attr[k]==="number") o.attr[k]=Math.round(p.attr[k]*100)/100; }
  if(p.gkA){ o.gkA={}; for(const k in p.gkA) if(typeof p.gkA[k]==="number") o.gkA[k]=Math.round(p.gkA[k]*100)/100; }
  if(p.posFam){ o.posFam={}; for(const k of FAM_POS) o.posFam[k]=Math.round(p.posFam[k]||0); }
  if(Array.isArray(p.traits)) o.traits=p.traits.slice(0,TRAIT_MAX);
  return o;
}
function edExport(){
  const t=userTeam();
  const teams={};
  for(const id in G.teams){
    const T=G.teams[id];
    teams[id]={name:T.name, short:T.short, owner:clubType(T).o, budget:T.budget, wageCap:T.wageCap||0,
      fans:T.fans, morale:Math.round(T.morale||70), fam:Math.round(T.fam!=null?T.fam:70),
      youthLv:T.youthLv||1, trainLv:trainLv(T), scoutLv:T.scoutLv||1,
      uid:uidClubOf(id), stad:{uid:uidStadOf(id), n:stadOf(T).n, cap:stadOf(T).cap, avg:stadOf(T).avg},
      players:T.players.map(edSnapPlayer)};
  }
  const obj={kind:ED_DB_KIND, v:2, from:t?t.short:"", season:G.season,
             made:new Date().toISOString().slice(0,10), teams,
             refs:{names:refNames().slice(), rel:refState().rel},
             nicks:customNicks().slice(0,40),
             press:{crew:journalists().map(j=>({n:j.n,o:j.o})), reps:reporters().map(j=>({n:j.n,o:j.o}))},
             mgr:{cash:me().cash, debt:me().debt||0, own:G.trust?G.trust.owner:70, fan:G.trust?G.trust.fans:70, pressRel:G.press?G.press.rel:50}};
  try{
    const txt=JSON.stringify(obj);
    const name=`klm2026_DB_${obj.made.replace(/-/g,"")}.json`;
    const blob=new Blob([txt],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name; a.style.display="none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 800);
    const nPl=Object.values(teams).reduce((s2,x)=>s2+x.players.length,0);
    showConfirm(`<b>📤 에디터 데이터를 내보냈습니다.</b>\n\n· ${Object.keys(teams).length}개 팀 · 선수 ${nPl}명 · ${Math.round(txt.length/1024)}KB\n· 파일명: ${name}\n\n<span class="small">받은 사람이 불러오면 리그 전체의 팀·선수 값이 이 파일의 값으로 덮어써집니다.\n(순위·일정·기록 같은 시즌 진행은 그대로 유지됩니다)</span>`,
      ()=>{}, {okLabel:"확인", cancelLabel:""});
  }catch(e){ flash("내보내기에 실패했습니다.","warn"); show("editor"); }
}
/* ── 📛 이름만 내보내기 — 선수명·구단명·모기업명만 담는 가벼운 파일.
   k(찾을 이름)는 그대로 두고 n(새 이름)만 고쳐서 배포하면 이름 패치가 된다. ── */
function edExportNames(){
  const teams={};
  for(const id in G.teams){ const T=G.teams[id];
    const _sd=stadOf(T);
    teams[id]={ uid:uidClubOf(id), name:T.name, short:T.short, owner:clubType(T).o,
      stad:{u:uidStadOf(id), k:_sd.n, n:_sd.n},
      players:T.players.map(p=>({u:p.uid, k:p.name, n:p.name})) };
  }
  const coaches={};
  try{ for(const id in COACHES){ const c=COACHES[id];
    coaches[id]={u:uidCoachOf(id), k:c.n, n:c.n,
      a:{tac:c.tac, flex:c.flex, att:c.att, def:c.def, man:c.man, dev:c.dev, judg:c.judg, ovr:c.ovr}}; } }catch(e){}
  const comps={};
  try{ for(const k of compKeys()){ const c=compInfo(k); comps[k]={u:c.uid, n:c.rawN, s:c.rawS}; } }catch(e){}
  const refs=[];
  try{ refNames().forEach((rn2,i)=>refs.push({u:uidRefOf(i), k:rn2, n:rn2})); }catch(e){}
  const obj={kind:ED_NAMES_KIND, v:1, season:G.season, made:new Date().toISOString().slice(0,10),
             teams, coaches, comps, refs,
             fa:(G.freeAgents||[]).map(p=>({u:p.uid, k:p.name, n:p.name})),
             os:overseasList().map(p=>({u:p.uid, k:p.name, n:p.name}))};   // 지연 생성 풀을 먼저 채운다 — 해외 선수 전원 포함
  try{
    const txt=JSON.stringify(obj, null, 1);      // 손으로 고치는 파일이라 줄바꿈을 넣어 준다
    const name=`klm2026_names_${obj.made.replace(/-/g,"")}.json`;
    const blob=new Blob([txt],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name; a.style.display="none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 800);
    const nPl=Object.values(teams).reduce((s2,x)=>s2+x.players.length,0);
    showConfirm(`<b>📛 이름 파일을 내보냈습니다.</b>\n\n· ${Object.keys(teams).length}개 팀(구장 포함) · 선수 ${nPl}명 (+FA ${obj.fa.length}·해외 ${obj.os.length}) · 감독 ${Object.keys(coaches).length}명 · 대회 ${Object.keys(comps).length}개 · 심판 ${refs.length}명\n· 파일명: ${name}\n\n<span class="small">파일 안의 <b>n</b> 값만 고쳐서 배포하세요 — <b>k</b>는 찾을 이름이라 그대로 둬야 합니다.\n팀은 name·short·owner, 감독은 coaches, 대회는 comps(n=정식명·s=짧은표기), 심판은 refs 항목을 고치면 됩니다.\n🆔 u(고유번호)는 그대로 두세요 — 개명·이적해도 대상을 정확히 찾아 줍니다.</span>`,
      ()=>{}, {okLabel:"확인", cancelLabel:""});
  }catch(e){ flash("내보내기에 실패했습니다.","warn"); show("editor"); }
}
/* 🔍 건너뛴 항목 패널 — 무엇을 못 찾았는지 그대로 보여 준다(너무 길면 앞쪽만) */
function edMissBox(list, why){
  if(!list || !list.length) return "";
  const show=list.slice(0,14), more=list.length-show.length;
  return `<div style="margin:8px 0;padding:8px 10px;background:#1a1f26;border-left:3px solid var(--gold);border-radius:6px;text-align:left">
    <b style="color:var(--gold);font-size:13px">건너뛴 ${list.length}건</b>
    <div class="small" style="margin:4px 0 6px;color:var(--sub)">${why||""}</div>
    <div class="small" style="line-height:1.7;max-height:180px;overflow:auto">${show.map(x=>`· ${x}`).join("<br>")}${more>0?`<br><span style="color:var(--sub)">…외 ${more}건</span>`:""}</div>
  </div>`;
}
function edApplyNames(obj){
  let tOk=0, pOk=0, pMiss=0, stOk=0;
  const rn=[], missList=[];      // 🔍 건너뛴 항목 — 무엇을 못 찾았는지 그대로 보여 준다
  const setName=(p, nv)=>{ const nn=String(nv).trim().slice(0,14); if(!nn||nn===p.name) return false;
    rn.push([p.name, nn]); p.name=nn; return true; };
  for(const id in (obj.teams||{})){
    const T=G.teams[id], D=obj.teams[id];
    if(!T||!D){ if(D) missList.push(`구단 · ${D.name||id} (이 세이브에 없음)`); continue; }
    tOk++;
    if(D.name && D.name!==T.name){ rn.push([T.name, String(D.name).slice(0,20)]); T.name=String(D.name).slice(0,20); }
    if(D.short && D.short!==T.short){ rn.push([T.short, String(D.short).slice(0,8)]); T.short=String(D.short).slice(0,8); }
    if(D.owner && typeof D.owner==="string"){ (G.ownerNames=G.ownerNames||{})[id]=String(D.owner).trim().slice(0,20); }
    /* 🏟️ 구장 이름 */
    if(D.stad && D.stad.n){
      const s=stadOf(T), nn=String(D.stad.n).trim().slice(0,24);
      if(nn && nn!==s.n){ rn.push([s.n, nn]); s.n=nn; stOk++; }
    }
    /* 🔒 ⚠ 제보 — 「명칭 현실화 패치를 했든 하지 않았든 … 절대 원상복구 하지 않고」.
       이름 파일로 들어온 값도 감독이 고른 값이다 — 잠금 등록부에 그대로 남긴다. */
    try{
      if(D.name)  edLockPut(id, "name",  T.name);
      if(D.short) edLockPut(id, "short", T.short);
      if(D.owner) edLockPut(id, "owner", D.owner);
      if(D.stad && D.stad.n) edLockPut(id, "stadName", stadOf(T).n);
    }catch(e){}
    const used=new Set(), leftover=[];
    for(const o of (D.players||[])){
      /* ⚠ k===n 을 통째로 건너뛰면 안 된다 — 실명 세이브에서 그대로 내보낸 파일(k=n=실명)을
         이름이 다른 세이브에 적용하는 게 주 사용처다. 대상 선수를 찾아 이름이 다를 때만 바꾼다.
         🆔 고유번호가 있으면 그게 최우선 — 개명·이적해도 정확히 그 선수를 찾는다. */
      if(!o || !o.n) continue;
      let p=null;
      if(o.u!=null){ const q=findByUid(o.u); if(q && !used.has(q.id)) p=q; }
      if(!p && o.k) p=edFindPlayer(T, {name:o.k}, used) || (o.k!==o.n ? edFindPlayer(T, {name:o.n}, used) : null);
      if(!p){ leftover.push(o); continue; }        // 2차에서 다시 본다
      used.add(p.id);
      if(setName(p, o.n)) pOk++;
    }
    /* 🔁 2차 — 남은 항목을 「성만 다른 같은 이름」으로 다시 찾는다 (요청: 번호 없이도 한 번 더).
       1차에서 확정된 선수를 제외한 뒤라, 이 시점의 「딱 한 명」은 훨씬 믿을 만하다. */
    for(const o of leftover){
      const p=edLooseFind(T, o.k||o.n, used) || (o.k && o.k!==o.n ? edLooseFind(T, o.n, used) : null);
      if(!p){ pMiss++; missList.push(`${T.short} · ${o.k||o.n}`); continue; }
      used.add(p.id);
      if(setName(p, o.n)) pOk++;
    }
  }
  let cOk=0, cpOk=0, rfOk=0;
  try{
    for(const id in (obj.coaches||{})){
      const o=obj.coaches[id];
      let key=id;
      if(o && o.u!=null){ for(const tid in COACHES) if(uidCoachOf(tid)===+o.u){ key=tid; break; } }
      const c=COACHES[key];
      if(!o || !o.n || !c) continue;
      const nn=String(o.n).trim().slice(0,12);
      if(nn && nn!==c.n){ rn.push([c.n, nn]); c.n=nn; (G.coachNames=G.coachNames||{})[key]=nn; cOk++; }
      /* 능력치도 함께 온다 — 없는 파일(옛 버전)이면 그냥 건너뛴다 */
      if(o.a && typeof o.a==="object"){
        const st=(G.coachAttrs=G.coachAttrs||{}); st[key]=st[key]||{};
        for(const k of ["tac","flex","att","def","man","dev","judg","ovr"]){
          const v=o.a[k];
          if(typeof v==="number" && isFinite(v)){ const n2=clamp(Math.round(v),1,20); c[k]=n2; st[key][k]=n2; }
        }
      }
    }
  }catch(e){}
  /* 🏆 대회명 */
  try{
    for(const k in (obj.comps||{})){
      const o=obj.comps[k];
      let key=k;
      if(o && o.u!=null){ for(const kk of compKeys()) if(uidCompOf(kk)===+o.u){ key=kk; break; } }
      if(!o || !COMP_DEF[key]) continue;
      const cur=compInfo(key);
      const nn=o.n?String(o.n).trim().slice(0,40):null, ss=o.s?String(o.s).trim().slice(0,12):null;
      if((nn && nn!==cur.rawN) || (ss && ss!==cur.rawS)){
        if(!G.compNames) G.compNames={};
        if(!G.compNames[key]) G.compNames[key]={};
        if(nn){ rn.push([cur.n, nn]); G.compNames[key].n=nn; }
        if(ss){ rn.push([cur.s, ss]); G.compNames[key].s=ss; }
        cpOk++;
      }
    }
  }catch(e){}
  /* 🧑‍⚖️ 심판명 */
  try{
    const NA=refNames();
    for(const o of (obj.refs||[])){
      if(!o || !o.n) continue;
      let i=(o.u!=null) ? (+o.u - UID_REF) : NA.indexOf(o.k);
      if(i<0 || i>=NA.length) continue;
      const nn=String(o.n).trim().slice(0,10);
      if(nn && nn!==NA[i]){ rn.push([NA[i], nn]); NA[i]=nn; rfOk++; }
    }
  }catch(e){}
  for(const [key, arr] of [["fa", G.freeAgents||[]], ["os", overseasList()]]){
    for(const o of (obj[key]||[])){
      if(!o || !o.n) continue;
      /* 🆔 uid 우선 — 그 사이 팀에 입단했어도(FA·해외 → 구단) 리그 전체에서 찾아낸다 */
      let p=(o.u!=null) ? findByUid(o.u) : null;
      if(!p && o.k) p=arr.find(x=>x && (x.name===o.k || (x.osKey && x.osKey===o.k)));
      if(!p){ if(o.k!==o.n){ pMiss++; missList.push(`${key==="fa"?"FA":"해외"} · ${o.k||o.n}`); } continue; }
      if(setName(p, o.n)) pOk++;   // 해외 선수의 osKey(정체성 키)는 그대로 둔다 — 개명해도 중복 생성이 없다
    }
  }
  try{ renameEverywhere(rn); }catch(e){}
  saveGame();
  /* ⚠ 제보 — 「적용됐다고는 나오는데 이름이 그대로다」. 한 명도 못 바꿨으면 그 사실을
     축하 문구 뒤에 숨기지 않고 앞에서 크게 알린다 — 대부분 게임 판이 오래된 경우다. */
  const _none = (pOk===0 && pMiss>0)
    ? `<div class="msg warn" style="margin:8px 0"><b>⚠ 실제로 바뀐 이름이 하나도 없습니다.</b>
        <span class="small">이 파일의 선수를 이 세이브에서 찾지 못했습니다. 대개 <b>게임 판이 오래되어</b> 생깁니다 —
        브라우저를 강제 새로고침해 최신 판(현재 빌드 ${(typeof GAME_BUILD!=="undefined")?GAME_BUILD:"?"})으로 올린 뒤 다시 시도해 주세요.
        그래도 같다면 이 파일이 다른 시즌·다른 명단을 기준으로 만들어졌을 수 있습니다.</span></div>` : "";
  showConfirm(`<b>✅ 이름 패치 적용 완료</b>\n${_none}\n· 팀 ${tOk}개 · 개명 ${pOk}명${cOk?` · 감독 ${cOk}명`:""}${cpOk?` · 대회 ${cpOk}개`:""}${rfOk?` · 심판 ${rfOk}명`:""}${stOk?` · 구장 ${stOk}곳`:""}${pMiss?` · <span style="color:var(--gold)">${pMiss}건 건너뜀</span>`:""}\n${edMissBox(missList, "이 세이브에 없는 이름입니다 — 이적·방출·삭제됐거나 파일이 예전 버전일 수 있습니다.")}<span class="small">옛 소셜·뉴스 기록의 이름까지 소급 적용됐습니다.</span>`,
    ()=>show("editor"), {okLabel:"확인", cancelLabel:""});
}
/* 선수 한 명을 파일 값으로 덮어쓴다 */
function edOverwritePlayer(p, o){
  /* 이름도 파일 값이 이긴다 — 매칭은 이미 끝났으므로(edFindPlayer) 안심하고 덮는다.
     이게 있어야 "이름 수정 패치"를 만들어 공유할 수 있다. */
  if(o.name && typeof o.name==="string"){ const nm=o.name.trim().slice(0,20);
    if(nm && nm!==p.name){ if(Array.isArray(ED_RENAMES)) ED_RENAMES.push([p.name, nm]); p.name=nm; } }
  if(o.pos && ["GK","DF","MF","FW"].indexOf(o.pos)>=0) p.pos=o.pos;
  if(o.prefPos && SLOT_FAM[o.prefPos]) p.prefPos=o.prefPos;
  if(typeof o.by==="number") p.by=clamp(o.by,1980,2012);
  if(typeof o.h==="number" && o.h>0) p.h=clamp(Math.round(o.h),155,215);
  if(typeof o.w==="number" && o.w>0) p.w=clamp(Math.round(o.w),48,115);
  if(typeof o.wage==="number") p.wage=clamp(o.wage,0.1,3000);
  if(typeof o.ct==="number") p.ct=clamp(Math.round(o.ct),1,6);
  if(typeof o.mvFix==="number") p.mvFix=clamp(o.mvFix,0.1,3000); else delete p.mvFix;
  if(typeof o.cond==="number") p.cond=clamp(o.cond,55,100);
  if(typeof o.morale==="number") p.morale=clamp(o.morale,30,99);
  if(typeof o.aff==="number") affSet(p, clamp(o.aff,0,100));
  if(typeof o.inj==="number"){ const _iw=clamp(Math.round(o.inj),0,30);
    try{ setInjury(p,_iw,true); }catch(e){ p.inj=_iw; }
    try{ if(_iw>0){ if(!p.injT){ p.injT=injTypeForWeeks(_iw); p.injC=p.injC||"train"; } }
         else { delete p.injT; delete p.injC; } }catch(e){} }
  if(typeof o.ban==="number") p.ban=clamp(Math.round(o.ban),0,10);
  if(typeof o.tpt==="number") p.tpt=clamp(Math.round(o.tpt),0,99);
  if(o.attr){ p.attr=p.attr||{}; for(const k in o.attr) if(typeof o.attr[k]==="number") p.attr[k]=clamp(o.attr[k],12,99); syncLegacyAttrs(p.attr); }
  if(o.gkA){ p.gkA=p.gkA||{}; for(const k in o.gkA) if(typeof o.gkA[k]==="number") p.gkA[k]=clamp(o.gkA[k],12,99);
    if(typeof syncLegacyGk==="function"){ try{ syncLegacyGk(p); }catch(e){} } }
  if(o.posFam){ p.posFam=p.posFam||initPosFam(p); for(const k of FAM_POS) if(typeof o.posFam[k]==="number") p.posFam[k]=clamp(o.posFam[k],0,100); }
  if(Array.isArray(o.traits)) p.traits=o.traits.filter(k=>TRAIT_BY_KEY[k]).slice(0,TRAIT_MAX);
  /* 오버롤 — 파일 값을 존중하되 능력치와 크게 어긋나면 능력치 쪽으로 재계산한다 */
  if(typeof o.ovrF==="number") p.ovrF=clamp(o.ovrF,38,96);
  else if(typeof o.ovr==="number") p.ovrF=clamp(o.ovr,38,96);
  try{ const ca=rawCA(p, p.ovrF||p.ovr);
    if(Math.abs(ca-(p.ovrF||p.ovr))>4) p.ovrF=Math.round(clamp(ca,38,96)*100)/100; }catch(e){}
  p.ovr=Math.round(p.ovrF||p.ovr);
  if(typeof o.pot==="number") p.pot=clamp(Math.round(o.pot),p.ovr,96);
  else if(p.pot<p.ovr) p.pot=p.ovr;
}
function edImport(input){
  const f=input && input.files && input.files[0];
  if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const obj=JSON.parse(String(r.result||""));
      if(obj && obj.kind===ED_PATCH_KIND && Array.isArray(obj.edits)){
        /* 수정본 패치 — 확인 후 적용 */
        showConfirm(`<b>📥 수정본 패치를 적용합니다.</b>\n\n· 수정 ${obj.edits.length}건 · 제작 ${obj.from||"?"} (${obj.made||""})\n· 파일에 담긴 항목만 바뀌고 나머지는 그대로 유지됩니다\n\n<span class="small">⚠ 되돌릴 수 없습니다. 적용 전에 세이브파일을 내보내 두세요.</span>`,
          ()=>edApplyPatch(obj), {okLabel:"적용한다", cancelLabel:"취소", danger:true});
        try{ input.value=""; }catch(e2){}
        return;
      }
      if(obj && obj.kind===ED_NAMES_KIND && obj.teams){
        /* 📛 이름 패치 — 선수명·구단명·모기업명만 바꾼다 */
        const nPl=Object.values(obj.teams).reduce((s2,x)=>s2+((x.players||[]).length),0);
        showConfirm(`<b>📛 이름 패치를 적용합니다.</b>\n\n· ${Object.keys(obj.teams).length}개 팀 · 선수 항목 ${nPl}개 (${obj.made||""})\n· 이름·약칭·모기업만 바뀌고 능력치·기록은 그대로입니다\n\n<span class="small">⚠ 되돌릴 수 없습니다. 적용 전에 세이브파일을 내보내 두세요.</span>`,
          ()=>edApplyNames(obj), {okLabel:"적용한다", cancelLabel:"취소", danger:true});
        try{ input.value=""; }catch(e2){}
        return;
      }
      if(!obj || obj.kind!==ED_DB_KIND || !obj.teams) throw new Error("형식");
      const dbMiss=[];   // 🔍 덮어쓰기에서 못 찾은 선수 목록
      showConfirm(`<b>📥 에디터 데이터를 덮어씁니다.</b>\n\n· 제작: ${obj.from||"?"} · ${obj.made||""} · 시즌 ${obj.season||"?"} 기준\n· 리그 전체의 팀·선수 값이 파일의 값으로 바뀝니다\n· 순위·일정·기록은 유지됩니다\n\n<span class="small">⚠ 되돌릴 수 없습니다. 적용 전에 세이브파일을 내보내 두세요.</span>`,
        ()=>{
          let pOk=0, pMiss=0, tOk=0;
          ED_RENAMES=[];                      // 이번 가져오기에서 바뀐 이름들 — 끝에 피드 소급용
          for(const id in obj.teams){
            const T=G.teams[id], D=obj.teams[id];
            if(!T||!D) continue;
            tOk++;
            if(D.name && D.name!==T.name){ ED_RENAMES.push([T.name, String(D.name).slice(0,20)]); T.name=String(D.name).slice(0,20); }
            else if(D.name) T.name=String(D.name).slice(0,20);
            if(D.short && D.short!==T.short){ ED_RENAMES.push([T.short, String(D.short).slice(0,8)]); T.short=String(D.short).slice(0,8); }
            else if(D.short) T.short=String(D.short).slice(0,8);
            if(D.owner && typeof D.owner==="string"){ if(!G.ownerNames) G.ownerNames={}; G.ownerNames[id]=String(D.owner).trim().slice(0,20); }
            if(typeof D.budget==="number") T.budget=clamp(D.budget,0,99999);
            if(typeof D.wageCap==="number") T.wageCap=clamp(D.wageCap,0,99999);
            if(typeof D.fans==="number") T.fans=clamp(D.fans,1,200);
            if(typeof D.morale==="number") T.morale=clamp(D.morale,40,99);
            if(typeof D.fam==="number") T.fam=clamp(D.fam,0,100);
            if(typeof D.youthLv==="number") T.youthLv=clamp(Math.round(D.youthLv),1,10);
            if(typeof D.trainLv==="number") T.trainLv=clamp(Math.round(D.trainLv),1,10);
            if(typeof D.scoutLv==="number") T.scoutLv=clamp(Math.round(D.scoutLv),1,5);
            if(D.stad){ const s=stadOf(T);
              if(D.stad.n){ const nn=String(D.stad.n).slice(0,24); if(nn!==s.n){ ED_RENAMES.push([s.n, nn]); s.n=nn; } }
              if(typeof D.stad.cap==="number") s.cap=clamp(Math.round(D.stad.cap),1000,120000);
              /* 에디터로 손수 넣은 기준 관중은 밑값(_base0)까지 옮긴다 — 시즌말 조정이 되돌리지 않게(제보) */
              if(typeof D.stad.avg==="number"){ s.avg=clamp(Math.round(D.stad.avg),100,s.cap||120000); s._base0=s.avg; } }
            /* 🔒 ⚠ 제보 — 에디터 데이터 파일로 들어온 구단 명칭도 잠금 등록부에 남긴다 */
            try{
              if(D.name)  edLockPut(id, "name",  T.name);
              if(D.short) edLockPut(id, "short", T.short);
              if(D.owner) edLockPut(id, "owner", D.owner);
              if(D.stad && D.stad.n) edLockPut(id, "stadName", stadOf(T).n);
            }catch(e){}
            /* 선수 매칭 — 성씨 변환 전/후 파일이 모두 통하도록 edFindPlayer 로 찾는다 */
            const used=new Set();
            for(const o of (D.players||[])){
              const p=edFindPlayer(T, o, used);
              if(!p){ pMiss++; dbMiss.push(`${T.short} · ${o.name||"?"}${o.by?` (${o.by}년생)`:""}`); continue; }
              used.add(p.id);
              try{ edOverwritePlayer(p, o); pOk++; }catch(e){ pMiss++; dbMiss.push(`${T.short} · ${o.name||"?"} (적용 실패)`); }
            }
          }
          if(Array.isArray(obj.nicks)) G.customNicks=obj.nicks.filter(x=>x&&x.n).slice(0,40).map(x=>({n:String(x.n).slice(0,14), e:String(x.e||"💬").slice(0,4)}));
          if(obj.refs){
            if(Array.isArray(obj.refs.names)) G.refNames=obj.refs.names.slice(0,REF_FAM_DEF.length).map(x=>String(x).slice(0,8));
            if(typeof obj.refs.rel==="number") refState().rel=clamp(obj.refs.rel,-100,100);
          }
          if(obj.press){
            if(Array.isArray(obj.press.crew)) G.pressCrew=obj.press.crew.slice(0,3).map(x=>({n:String(x&&x.n||"").slice(0,10), o:String(x&&x.o||"").slice(0,14)}));
            if(Array.isArray(obj.press.reps)) G.repCrew=obj.press.reps.slice(0,REPORTERS.length).map(x=>({n:String(x&&x.n||"").slice(0,10), o:String(x&&x.o||"").slice(0,14)}));
          }
          if(obj.mgr){
            const M=me();
            if(typeof obj.mgr.cash==="number") M.cash=Math.round(clamp(obj.mgr.cash,-9999,99999)*100)/100;
            if(typeof obj.mgr.debt==="number") M.debt=Math.round(clamp(obj.mgr.debt,0,99999)*100)/100;
            if(typeof obj.mgr.own==="number") G.trust.owner=clamp(Math.round(obj.mgr.own),0,100);
            if(typeof obj.mgr.fan==="number") G.trust.fans=clamp(Math.round(obj.mgr.fan),0,100);
            if(typeof obj.mgr.pressRel==="number") G.press.rel=clamp(Math.round(obj.mgr.pressRel),0,100);
          }
          /* ⚠ 제보 — 「덮어쓰기 완료 · 966명 적용이라고 뜨는데 이름이 그대로다」.
             에디터 데이터 파일(전체 덮어쓰기)과 이름 패치 파일은 서로 다른 파일이다.
             전자는 능력치·소속 같은 값을 덮어쓰는 파일이라, 만든 사람이 가명 상태에서 뽑았으면
             이름은 하나도 안 바뀐다 — 그런데 화면은 「966명 적용」만 말하니 이름 패치를 넣은 줄 안다.
             ─ 이름이 한 글자도 안 바뀌었으면 그 사실과 함께 「이름 파일은 따로 있다」를 알려 준다. */
          const _rnN=(Array.isArray(ED_RENAMES)?ED_RENAMES.length:0);
          try{ renameEverywhere(ED_RENAMES); }catch(e){}
          ED_RENAMES=null;
          saveGame();
          const _noRn = (pOk>0 && _rnN===0)
            ? `<div class="msg info" style="margin:8px 0">ℹ️ <b>이 파일에는 이름 변경이 없습니다.</b>
                <span class="small">능력치·소속 같은 값만 담긴 <b>에디터 데이터 파일</b>입니다.
                선수·구단 이름을 바꾸려면 <b>이름 파일</b>(적용할 때 「📛 이름 패치를 적용합니다」라고 뜨는 파일)이 따로 필요합니다.</span></div>` : "";
          showConfirm(`<b>✅ 덮어쓰기 완료</b>\n${_noRn}\n· 팀 ${tOk}개 · 선수 ${pOk}명 적용${pMiss?` · <span style="color:var(--gold)">${pMiss}건 건너뜀</span>`:""}\n${edMissBox(dbMiss, "이 세이브에서 찾지 못한 선수입니다 — 이적·방출·시즌 차이거나 파일이 예전 버전일 수 있습니다.")}`,
            ()=>show("editor"), {okLabel:"확인", cancelLabel:""});
        }, {okLabel:"덮어쓴다", cancelLabel:"취소", danger:true});
    }catch(err){
      showConfirm(`<b>❌ 읽을 수 없는 파일입니다.</b>\n\n에디터 데이터 파일(klm2026_DB_*.json) 또는 수정본 패치(klm2026_patch_*.json)가 맞는지 확인해 주세요.\n세이브파일 전체를 불러오려면 ⚙️ 설정의 <b>세이브파일 불러오기</b>를 쓰세요.`,
        ()=>show("editor"), {okLabel:"확인", cancelLabel:""});
    }
    try{ input.value=""; }catch(e2){}
  };
  r.readAsText(f);
}
const ED_ROW=(label, input)=>`<div class="edRow"><span class="edL">${label}</span>${input}</div>`;
/* 🔤 글자를 넣는 칸 — 모바일에서 숫자 키보드가 뜨면 아예 입력을 못 한다.
   ⚠ 제보 — 구장 이름을 고치는데 숫자 키패드가 올라온다(stadName 이 목록에 없었다).
   필드 이름으로 한 번, 값이 숫자로 안 읽히면 한 번 더 걸러 낸다 — 앞으로 칸이 늘어도 안전하다. */
const ED_TEXT_FIELD=/^(name|short|stadName|owner|nick|title|note|club|mgr|ref|n|s)$/;
const edIsText=(field, val)=>ED_TEXT_FIELD.test(String(field))
  || (typeof val==="string" && val.trim()!=="" && !/^-?\d+(\.\d+)?$/.test(val.trim()));
const ED_IN=(fn, field, val, w)=>`<input type="text" inputmode="${edIsText(field,val)?"text":"decimal"}" value="${val}" style="width:${w||70}px"
  onchange="${fn}('${field}', this.value)">`;
/* ═══════════════════════════════════════════════════════════════
   🧬 선수 생성 — FM 에디터의 "선수 만들기"
   이름·신체·국적·성격·능력·특성·계약을 정해 새 선수를 만든다.
   행선지는 셋 중 하나: 소속팀 입단 / FA 시장 / 해외 이적시장.
   세부 능력치 미세조정은 만들어 둔 뒤 인게임 에디터 선수 탭에서 이어서 한다.
═══════════════════════════════════════════════════════════════ */
let PG=null;
/* 🌐 외국인 국적 선택지 — K리그에 실제로 오는 권역 위주 (요청) */
const PG_NATIONS=["브라질","아르헨티나","콜롬비아","우루과이","파라과이","칠레","포르투갈","스페인","이탈리아",
  "독일","프랑스","네덜란드","벨기에","오스트리아","크로아티아","세르비아","보스니아","몬테네그로",
  "북마케도니아","슬로베니아","조지아","러시아","우크라이나","스웨덴","노르웨이","덴마크","잉글랜드",
  "일본","호주","우즈베키스탄","이란","이라크","요르단","팔레스타인","태국","베트남","인도네시아",
  "말레이시아","중국","미국","캐나다","코스타리카","나이지리아","가나","코트디부아르","세네갈",
  "카메룬","이집트","튀니지","모로코"];
function pgInit(){
  PG={ name:"", pos:"FW", pref:"ST", by:G.season-24, h:180, w:74, frn:0, pers:0,
       ovr:70, pot:78, stars:3, wage:2.0, ct:3, dest:"team", tid:G.userTeamId,
       osClub:"", osNat:"", mv:0, traits:[], attr:null, gkA:null, fam:null,
       knm:"", natl:"", armyDone:0 };   /* 🌐 외국인 — K리그 등록명·국적 · 🎖️ 병역 (요청) */
  pgGenAttrs(); pgGenFam();
}
/* 별 개수 → 내부 능력 역산 — 리그 평균(starRefLevel)에 앵커를 건 실시간 환산이라
   시즌이 흐르고 리그 수준이 변해도 "3성 = 리그 평균급"이 유지된다 */
function pgOvrForStars(st){
  const raw=clamp(st, 0.5, 5);
  const score=62 + (raw-STAR_MID)*STAR_SPAN;             // starRawFromScore 역산
  const lv=starRefLevel() + (score-62)/STAR_GAIN;        // abilityStars 역산
  return clamp(Math.round(lv), 45, 92);
}
function pgSetStars(v){
  if(!PG) pgInit();
  const st=clamp(parseFloat(v)||3, 0.5, 5);
  PG.stars=st;
  PG.ovr=pgOvrForStars(st);
  if(PG.pot<PG.ovr) PG.pot=PG.ovr;
  pgGenAttrs();
  show("playerGen");
}
/* 목표 능력 기준으로 세부 능력치를 새로 뽑는다 — 이후 하나하나 손볼 수 있다 */
function pgGenAttrs(){
  if(!PG) return;
  if(PG.pos==="GK"){ PG.gkA=genGkAttrsFM(PG.ovr, PG.h); PG.attr=genAttrsFM("DF", Math.max(45,PG.ovr-18)); }
  else { PG.attr=genAttrsFM(PG.pos, PG.ovr); PG.gkA=null; }
  if(PG.attr) syncLegacyAttrs(PG.attr);
  /* 초안 보정 — 무작위 추첨이 목표에서 반 별쯤 벗어날 수 있다.
     전체 능력치를 균일하게 밀어 목표 능력에 붙인다 (두 번이면 충분히 수렴한다). */
  try{
    const lvOf=()=>playerLevel({pos:PG.pos, attr:PG.attr, gkA:PG.gkA, ovr:PG.ovr});
    for(let it=0; it<3; it++){
      const diff=PG.ovr-lvOf();          // ⚠ 별 계산은 playerLevel 기준 — rawCA 로 맞추면 반 별씩 어긋난다
      if(Math.abs(diff)<0.8) break;
      const bag=(PG.pos==='GK'&&PG.gkA)?PG.gkA:PG.attr;
      for(const k in bag) if(typeof bag[k]==='number') bag[k]=clamp(bag[k]+diff, 15, 99);
      if(PG.attr) syncLegacyAttrs(PG.attr);
    }
  }catch(e){}
  /* 초안이 목표보다 세게 나오면 잠재력이 현재 능력 아래로 떨어진다 — 상한선이 상한이 되게 맞춘다 */
  try{ const ca=pgCA(); if(PG.pot<ca) PG.pot=ca; }catch(e){}
}
function pgGenFam(){
  if(!PG) return;
  PG.fam=initPosFam({prefPos:PG.pref, pos:PG.pos});
}
/* 편집 중인 선수의 현재 능력 — FM 에디터처럼 세부 능력치에서 역산한다 */
function pgCA(){
  if(!PG || (!PG.attr && !PG.gkA)) return PG?PG.ovr:70;
  return Math.round(clamp(rawCA({pos:PG.pos, attr:PG.attr, gkA:PG.gkA, ovr:PG.ovr}, PG.ovr), 38, 96));
}
/* 화면용 — 현재 능력·잠재력 모두 90~200 눈금으로 통일 (FM 방식) */
function pgFake(){ return {pos:PG.pos, attr:PG.attr, gkA:PG.gkA, ovr:pgCA(), pot:PG.pot}; }
function pgDispCA(){ return dispOvr(pgFake()); }
function pgDispPot(){ return dispPot(pgFake()); }
function pgSetAttr(key, v){
  if(!PG) return;
  const n=edNum(v,1,20,0); if(n==null){ show("playerGen"); return; }
  const raw=clamp(n*5, 15, 99);
  if(GKT_ATTRS.indexOf(key)>=0){ if(!PG.gkA) PG.gkA={}; PG.gkA[key]=raw; }
  else { if(!PG.attr) PG.attr={}; PG.attr[key]=raw; }
  if(PG.attr) syncLegacyAttrs(PG.attr);
  const ca=pgCA();
  if(PG.pot<ca) PG.pot=ca;          // 잠재력은 상한선 — 현재 능력이 오르면 따라 오른다
  show("playerGen");
}
function pgSetFam(key, v){
  if(!PG) return;
  const n=edNum(v,0,100,0); if(n==null){ show("playerGen"); return; }
  if(!PG.fam) pgGenFam();
  PG.fam[key]=n;
  show("playerGen");
}
function pgSet(k, v){
  if(!PG) pgInit();
  if(k==="name") PG.name=String(v).trim().slice(0,14);
  else if(k==="pos"){ if(["GK","DF","MF","FW"].indexOf(v)>=0){ PG.pos=v;
    PG.pref = v==="GK"?"GK" : v==="DF"?"CB" : v==="MF"?"CM" : "ST";
    pgGenAttrs(); pgGenFam(); } }
  else if(k==="pref"){ if(SLOT_FAM[v]){ PG.pref=v; pgGenFam(); } }
  else if(k==="by"){ const n=edNum(v,1900,(G.season||2026)-1,0); if(n!=null) PG.by=n; }   // ⚠ 요청 — 나이 작성 한도 해제 (1900년~작년생까지 전부 허용)
  else if(k==="h"){ const n=edNum(v,160,205,0); if(n!=null) PG.h=n; }
  else if(k==="w"){ const n=edNum(v,52,105,0); if(n!=null) PG.w=n; }
  else if(k==="frn") PG.frn=v?1:0;
  else if(k==="armyDone") PG.armyDone=+v?1:0;   // 🎖️ 병역 (요청)
  else if(k==="pers"){ const n=edNum(v,0,3,0); if(n!=null) PG.pers=n; }
  else if(k==="ovr"){ const n=edNum(v,45,92,0); if(n!=null){ PG.ovr=n; if(PG.pot<n) PG.pot=n; pgGenAttrs(); } }
  else if(k==="pot"){ const n=edNum(v,90,200,0); if(n!=null) PG.pot=potFromDisp(pgFake(), n); }
  else if(k==="wage"){ const n=edNum(v,0.1,3000,1); if(n!=null) PG.wage=n; }
  else if(k==="ct"){ const n=edNum(v,1,6,0); if(n!=null) PG.ct=n; }
  else if(k==="dest"){ if(["team","fa","os"].indexOf(v)>=0) PG.dest=v; }
  else if(k==="tid"){ if(G.teams[v]) PG.tid=v; }
  else if(k==="osClub") PG.osClub=String(v).trim().slice(0,20);
  else if(k==="osNat") PG.osNat=String(v).trim().slice(0,10);
  else if(k==="knm") PG.knm=String(v).trim().slice(0,14);
  else if(k==="natl") PG.natl=String(v).trim().slice(0,14);
  else if(k==="mv"){ const n=edNum(v,0,3000,1); if(n!=null) PG.mv=n; }
  show("playerGen");
}
function pgTrait(v){
  if(!PG || !v || !TRAIT_BY_KEY[v]) { show("playerGen"); return; }
  if(PG.traits.indexOf(v)>=0){ show("playerGen"); return; }
  if(PG.traits.length>=TRAIT_MAX){ flash(`특성은 ${TRAIT_MAX}개까지입니다.`,"warn"); show("playerGen"); return; }
  PG.traits.push(v); show("playerGen");
}
function pgTraitDel(v){ if(PG) PG.traits=PG.traits.filter(k=>k!==v); show("playerGen"); }
function pgCreate(toList){
  if(!PG) return;
  if(!PG.name){ flash("이름을 입력하세요.","warn"); show("playerGen"); return; }
  if(PG.dest==="os" && !PG.osClub){ flash("해외 시장에 내놓으려면 소속 클럽명이 필요합니다.","warn"); show("playerGen"); return; }
  /* 📜 목록 보관 — 인게임에 넣지 않고 스냅샷만 저장한다. 적용은 목록에서 [⚡ 인게임 적용]으로. */
  if(toList){
    const tmp=mkPlayer(PG.name, PG.pos, PG.by, PG.ovr, PG.frn, {h:PG.h, w:PG.w});
    if(PG.attr){ tmp.attr=JSON.parse(JSON.stringify(PG.attr)); try{ syncLegacyAttrs(tmp.attr); }catch(e){} }
    if(PG.pos==="GK" && PG.gkA){ tmp.gkA=JSON.parse(JSON.stringify(PG.gkA)); try{ syncLegacyGk(tmp); }catch(e){} }
    try{ tmp.ovrF=Math.round(clamp(rawCA(tmp, PG.ovr),38,96)*100)/100; tmp.ovr=Math.round(tmp.ovrF); }catch(e){}
    tmp.pot=clamp(Math.max(PG.pot, tmp.ovr), tmp.ovr, 96);
    tmp.pers=PG.pers; tmp.wage=PG.wage; tmp.ct=PG.ct; tmp.prefPos=PG.pref;
    tmp.posFam=initPosFam(tmp);
    if(PG.fam) for(const f of FAM_POS) if(typeof PG.fam[f]==="number") tmp.posFam[f]=clamp(PG.fam[f],0,100);
    syncPosBand(tmp);                          // 능숙도를 고쳤으면 대분류도 따라간다
    tmp.traits=PG.traits.slice(0,TRAIT_MAX);
    if(PG.frn){ const _k=(PG.knm||"").trim();
      if(_k && _k!==PG.name){ tmp.realName=PG.name; tmp.name=_k; }
      if((PG.natl||"").trim()) tmp.natl=PG.natl.trim(); }   /* 🌐 K리그 등록명·국적 (요청) */
    if(PG.mv>0) tmp.mvFix=PG.mv;
    if(!PG.frn && +PG.armyDone) tmp.armyDone=1;      // 🎖️ 병역 완료 (외국인은 해당 없음)
    if(PG.dest==="os"){ tmp.osClub=PG.osClub; tmp.osNat=PG.osNat||(PG.frn?"해외":"대한민국"); }
    if(!Array.isArray(G.pgMade)) G.pgMade=[];
  if(!Array.isArray(G.tfLog)) G.tfLog=[];
  if(G.jobless && !G.mgrFree) G.mgrFree={from:null, reason:"", s:G.season, off:[], block:{}, weeks:0};
  if(G.mgrFree && !G.mgrFree.block) G.mgrFree.block={};
    const snap=pgSnap(tmp, PG); snap.applied=0;
    G.pgMade.push(snap); G.pgMade=G.pgMade.slice(-100);
    saveGame(); try{ syncPreMade(); }catch(e){}
    const nm=PG.name; pgInit();
    showConfirm(`<b>📜 ${nm} 선수를 목록에 보관했습니다.</b>

아직 게임에는 없습니다 — [📜 선수 생성 목록]에서 <b>⚡ 인게임 적용</b>을 누르면 그때 들어갑니다.
파일로 내보내 다른 사람과 공유할 수도 있습니다.`,
      ()=>{ PGTAB="list"; show("playerGen"); }, {okLabel:"목록 보기", cancelLabel:""});
    return;
  }
  if(PG.dest==="team" && isArmyTeam(G.teams[PG.tid])){ flash("김천 상무 FC에는 선수를 넣을 수 없습니다 (군 파견 선수만 소속됩니다).","warn"); show("playerGen"); return; }
  /* 이름 중복 — 같은 이름이 이미 리그에 있으면 헷갈린다 */
  for(const id in G.teams) if(G.teams[id].players.some(x=>x.name===PG.name)){
    flash(`"${PG.name}" 이름의 선수가 이미 있습니다 (${G.teams[id].short}).`,"warn"); show("playerGen"); return; }
  const p=mkPlayer(PG.name, PG.pos, PG.by, PG.ovr, PG.frn, {h:PG.h, w:PG.w});
  /* 편집한 세부 능력치를 그대로 싣고, 현재 능력은 FM 에디터처럼 능력치에서 역산한다 */
  if(PG.attr){ p.attr=JSON.parse(JSON.stringify(PG.attr)); syncLegacyAttrs(p.attr); }
  if(PG.pos==="GK" && PG.gkA){ p.gkA=JSON.parse(JSON.stringify(PG.gkA)); if(typeof syncLegacyGk==="function"){ try{ syncLegacyGk(p); }catch(e){} } }
  try{ p.ovrF=Math.round(clamp(rawCA(p, PG.ovr),38,96)*100)/100; p.ovr=Math.round(p.ovrF); }catch(e){}
  p.pot=clamp(Math.max(PG.pot, p.ovr), p.ovr, 96);
  p.pers=PG.pers; p.wage=PG.wage; p.ct=PG.ct;
  p.prefPos=PG.pref;
  p.posFam=initPosFam(p);
  if(PG.fam) for(const f of FAM_POS) if(typeof PG.fam[f]==="number") p.posFam[f]=clamp(PG.fam[f],0,100);
  syncPosBand(p);                              // 능숙도를 고쳤으면 대분류도 따라간다
  p.traits=PG.traits.slice(0,TRAIT_MAX);
  if(PG.frn){ const _k=(PG.knm||"").trim();
    if(_k && _k!==PG.name){ p.realName=PG.name; p.name=_k; }   /* 🌐 표시는 K리그 등록명, 본명은 보존 (요청) */
    if((PG.natl||"").trim()) p.natl=PG.natl.trim(); }
  p.gen=1;                                    // 생성 선수 표시
  if(!PG.frn && +PG.armyDone) p.armyDone=1;   // 🎖️ 병역 완료 — 상무 차출 대상에서 빠진다
  if(PG.mv>0) p.mvFix=PG.mv;
  let where="";
  if(PG.dest==="team"){
    const t=G.teams[PG.tid];
    t.players.push(p); joinClub(t, p);
    where=`${t.name} 입단 (등번호 ${p.no})`;
    if(t.isUser){ affSet(p, 60+R(10)); addMood(`🧬 신입 ${p.name} 선수가 팀에 합류했습니다.`); }
    addNews(`✍️ ${t.short}, ${p.name}(${POS_KO[p.pos]||p.pos}) 영입 발표 — ${G.season-p.by}세, 계약 ${p.ct}년`, null, "club");
  } else if(PG.dest==="fa"){
    (G.freeAgents=G.freeAgents||[]).push(p);
    where="FA(자유계약) 시장 등록";
  } else {
    p.osClub=PG.osClub; p.osNat=PG.osNat||(PG.frn?"해외":"대한민국");
    p.osTier="minor"; p.osWage=PG.wage; p.wage=PG.wage;
    if(!p.mvFix) p.mvFix=Math.max(0.5, marketValue(p));
    (G.overseas=G.overseas||[]).push(p);
    where=`해외 이적시장 등록 (${p.osClub})`;
  }
  /* 📜 생성 목록 — 만들어진 순간의 깨끗한 스냅샷을 남긴다. 공유 파일의 원본이 된다. */
  try{
    if(!Array.isArray(G.pgMade)) G.pgMade=[];
  if(!Array.isArray(G.tfLog)) G.tfLog=[];
  if(G.jobless && !G.mgrFree) G.mgrFree={from:null, reason:"", s:G.season, off:[], block:{}, weeks:0};
  if(G.mgrFree && !G.mgrFree.block) G.mgrFree.block={};
    const snap=pgSnap(p, PG); snap.applied=1; snap.appliedWhere=where;
    G.pgMade.push(snap);
    G.pgMade=G.pgMade.slice(-100);
  }catch(e){}
  saveGame();
  const made=p;
  pgInit();
  showConfirm(`<b>🧬 ${made.name} 선수를 만들었습니다.</b>\n\n· ${G.season-made.by}세 ${POS_KO[made.pos]||made.pos} (${made.prefPos}) · ${made.h}cm/${made.w}kg${made.frn?" · 외국인":""}\n· 능력 ${dispOvr(made)} / 잠재 ${dispPot(made)} · 연봉 ${made.wage}억 · 계약 ${made.ct}년\n· 특성 ${made.traits.length}개\n· 행선지: <b>${where}</b>\n\n<span class="small">세부 능력치·능숙도 미세조정은 🛠️ 인게임 에디터 → 선수 탭에서 이어서 할 수 있습니다.</span>`,
    ()=>show("playerGen"), {okLabel:"확인", cancelLabel:""});
}
/* ── 📜 생성 선수 목록 · 공유 ─────────────────────────────────
   만든 선수의 스냅샷을 파일로 주고받는다. 받는 쪽은 자기 게임에 "그 선수를 다시 만든다" —
   id 는 새로 받고(충돌 방지), 이름이 이미 있으면 건너뛰고, 원래 행선지 구단이 없으면 FA 로 보낸다. */
const PG_SHARE_KIND="klm2026-genplayers";
function pgSnap(p, pg){
  const o={name:p.name, pos:p.pos, prefPos:p.prefPos, by:p.by, frn:p.frn?1:0, h:p.h, w:p.w,
    ovrF:p.ovrF!=null?p.ovrF:p.ovr, pot:p.pot, pers:p.pers||0, wage:p.wage, ct:p.ct||1,
    traits:(p.traits||[]).slice(0,TRAIT_MAX),
    dest:pg?pg.dest:"fa", tid:pg&&pg.dest==="team"?pg.tid:null,
    osClub:p.osClub||null, osNat:p.osNat||null,
    s:G.season, d:G.day||0};
  if(p.mvFix!=null) o.mvFix=p.mvFix;
  if(p.armyDone) o.armyDone=1;                // 🎖️ 병역 — 목록 보관·파일 공유에도 실린다
  if(p.attr){ o.attr={}; for(const k in p.attr) if(typeof p.attr[k]==="number") o.attr[k]=Math.round(p.attr[k]*100)/100; }
  if(p.gkA){ o.gkA={}; for(const k in p.gkA) if(typeof p.gkA[k]==="number") o.gkA[k]=Math.round(p.gkA[k]*100)/100; }
  if(p.posFam){ o.posFam={}; for(const k of FAM_POS) o.posFam[k]=Math.round(p.posFam[k]||0); }
  return o;
}
/* 스냅샷 → 실제 선수. 행선지: 원래 구단(있고 군팀이 아니면) → 없으면 FA / 해외는 그대로 해외 */
function pgMaterialize(o){
  for(const id in G.teams) if(G.teams[id].players.some(x=>x.name===o.name)) return {ok:false, why:"이름 중복"};
  if((G.freeAgents||[]).some(x=>x.name===o.name) || (G.overseas||[]).some(x=>x.name===o.name)) return {ok:false, why:"이름 중복"};
  const p=mkPlayer(o.name, ["GK","DF","MF","FW"].includes(o.pos)?o.pos:"MF", clamp(o.by||2000,1980,2012),
                   clamp(Math.round(o.ovrF||65),40,96), o.frn?1:0, {h:clamp(o.h||180,155,215), w:clamp(o.w||74,48,115)});
  if(o.attr){ p.attr=JSON.parse(JSON.stringify(o.attr)); try{ syncLegacyAttrs(p.attr); }catch(e){} }
  if(p.pos==="GK" && o.gkA){ p.gkA=JSON.parse(JSON.stringify(o.gkA)); try{ syncLegacyGk(p); }catch(e){} }
  p.ovrF=clamp(o.ovrF||p.ovr, 38, 96); p.ovr=Math.round(p.ovrF);
  p.pot=clamp(Math.max(o.pot||p.ovr, p.ovr), p.ovr, 96);
  p.pers=clamp(Math.round(o.pers||0),0,3); p.wage=clamp(o.wage||1,0.1,3000); p.ct=clamp(Math.round(o.ct||1),1,6);
  if(SLOT_FAM[o.prefPos]) p.prefPos=o.prefPos;
  p.posFam=initPosFam(p);
  if(o.posFam) for(const f of FAM_POS) if(typeof o.posFam[f]==="number") p.posFam[f]=clamp(o.posFam[f],0,100);
  p.traits=(Array.isArray(o.traits)?o.traits:[]).filter(k=>TRAIT_BY_KEY[k]).slice(0,TRAIT_MAX);
  if(o.mvFix>0) p.mvFix=o.mvFix;
  if(o.armyDone && !p.frn) p.armyDone=1;      // 🎖️ 병역
  p.gen=1;
  let where="";
  const t=o.dest==="team" && o.tid ? G.teams[o.tid] : null;
  if(o.dest==="os"){
    p.osClub=o.osClub||"해외 클럽"; p.osNat=o.osNat||(p.frn?"해외":"대한민국");
    p.osTier="minor"; p.osWage=p.wage;
    if(!p.mvFix) p.mvFix=Math.max(0.5, marketValue(p));
    (G.overseas=G.overseas||[]).push(p); where="해외 이적시장";
  } else if(t && !isArmyTeam(t)){
    t.players.push(p); joinClub(t, p); where=t.short+" 입단";
  } else {
    (G.freeAgents=G.freeAgents||[]).push(p); where="FA 시장"+(o.dest==="team"?" (원 소속 구단 없음)":"");
  }
  return {ok:true, p, where};
}
function pgExportMade(){
  const list=(G.pgMade||[]);
  if(!list.length){ flash("아직 생성한 선수가 없습니다.","warn"); show("playerGen"); return; }
  const obj={kind:PG_SHARE_KIND, v:1, from:(userTeam()||{}).short||"", made:new Date().toISOString().slice(0,10), players:list};
  try{
    const txt=JSON.stringify(obj);
    const name=`klm2026_생성선수_${obj.made.replace(/-/g,"")}_${list.length}명.json`;
    const blob=new Blob([txt],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name; a.style.display="none";
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 800);
    flash(`📤 생성 선수 ${list.length}명을 내보냈습니다.`,"good"); show("playerGen");
  }catch(e){ flash("내보내기에 실패했습니다.","warn"); show("playerGen"); }
}
function pgImportMade(input){
  const f=input && input.files && input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const obj=JSON.parse(String(r.result||""));
      if(!obj || obj.kind!==PG_SHARE_KIND || !Array.isArray(obj.players)) throw new Error("형식");
      showConfirm(`<b>📥 생성 선수 ${obj.players.length}명을 목록으로 불러옵니다.</b>${obj.from?`
· 제작: ${obj.from}`:""}

바로 게임에 들어가지 않습니다 — 목록에 보관되고, 원하는 선수만 <b>⚡ 인게임 적용</b>으로 들여올 수 있습니다.`,
        ()=>{
          if(!Array.isArray(G.pgMade)) G.pgMade=[];
  if(!Array.isArray(G.tfLog)) G.tfLog=[];
  if(G.jobless && !G.mgrFree) G.mgrFree={from:null, reason:"", s:G.season, off:[], block:{}, weeks:0};
  if(G.mgrFree && !G.mgrFree.block) G.mgrFree.block={};
          let ok=0, dup=0;
          for(const o of obj.players.slice(0,100)){
            if(!o || !o.name){ continue; }
            if(G.pgMade.some(x=>x.name===o.name && !x.applied)){ dup++; continue; }   // 보관 중 동명 중복만 거른다
            G.pgMade.push(Object.assign({}, o, {imported:1, applied:0, appliedWhere:null}));
            ok++;
          }
          G.pgMade=G.pgMade.slice(-100);
          saveGame();
          PGTAB="list";
          showConfirm(`<b>✅ ${ok}명을 목록에 보관했습니다.</b>${dup?`
· ${dup}명은 이미 목록에 있어 건너뜀`:""}

목록에서 원하는 선수를 골라 ⚡ 적용하세요.`,
            ()=>show("playerGen"), {okLabel:"확인", cancelLabel:""});
        }, {okLabel:"불러온다", cancelLabel:"취소"});
    }catch(e){
      flash("생성 선수 파일(klm2026_생성선수_*.json)이 아닙니다.","warn"); show("playerGen");
    }
    try{ input.value=""; }catch(e2){}
  };
  r.readAsText(f);
}
function pgDelMade(i){ (G.pgMade||[]).splice(i,1); saveGame(); try{ syncPreMade(); }catch(e){} show("playerGen"); }
function pgApplyMade(i){
  const o=(G.pgMade||[])[i]; if(!o) return;
  if(o.applied){ flash("이미 인게임에 적용된 선수입니다.","warn"); show("playerGen"); return; }
  const r=pgMaterialize(o);
  if(!r.ok){ flash(`적용 실패 — ${r.why}`,"warn"); show("playerGen"); return; }
  o.applied=1; o.appliedWhere=r.where;
  saveGame();
  flash(`⚡ ${o.name} — ${r.where}`,"good");
  show("playerGen");
}
let PGTAB="make";
function pgMadeListView(){
  const L=(G.pgMade||[]);
  const rows=L.slice().reverse().map((o,ri)=>{
    const i=L.length-1-ri;
    const dest=o.dest==="os"?`🌍 ${o.osClub||"해외"}`:o.dest==="team"?`🏟️ ${(G.teams[o.tid]||{}).short||"(없는 구단)"}`:"🆓 FA";
    const stat=o.applied
      ? `<span class="small" style="color:var(--green)">✔ 적용됨${o.appliedWhere?` · ${o.appliedWhere}`:""}</span>`
      : `<button class="mini" style="padding:2px 9px;font-size:11px;border-color:var(--gold);color:var(--gold)" title="이 선수를 지금 게임에 들여옵니다" onclick="pgApplyMade(${i})">⚡ 인게임 적용</button>`;
    return `<tr><td><b>${o.name}</b>${o.imported?' <span class="tag">가져옴</span>':""}</td>
      <td class="pos-${o.pos}">${o.pos} · ${o.prefPos||"-"}</td>
      <td>${o.s-o.by}세</td><td>${o.h||"-"}cm/${o.w||"-"}kg</td>
      <td>${o.frn?"외국인":"국내"}</td><td>${dest}</td>
      <td>${stat}</td>
      <td><button class="mini" style="padding:1px 7px;font-size:10.5px" title="목록 기록만 지웁니다 — 이미 게임에 들어간 선수는 그대로 있습니다" onclick="pgDelMade(${i})">🧹</button></td></tr>`;
  }).join("");
  return `<div class="card">
    <h3>📜 선수 생성 목록 <span class="small">— ${L.length}명 (최근이 위)</span></h3>
    <p class="small" style="margin:2px 0 8px">보관 중인 선수는 <b>⚡ 인게임 적용</b>을 눌러야 게임에 들어갑니다 — 원래 지정한 행선지로 가고, 그 구단이 없으면 FA 시장으로 갑니다.
      파일로 내보내면 다른 사람이 같은 선수를 자기 목록으로 받아 골라서 적용할 수 있습니다. 기록을 지워도 이미 들어간 선수는 사라지지 않습니다.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <button class="mini" onclick="pgExportMade()" ${L.length?"":"disabled"}>📤 목록 내보내기 (${L.length}명)</button>
      <label class="mini" style="cursor:pointer">📥 생성 선수 불러오기
        <input type="file" accept="application/json,.json" style="display:none" onchange="pgImportMade(this)"></label>
    </div>
    ${L.length?`<div class="tblScroll" style="max-height:340px;overflow-y:auto"><table>
      <tr><th>이름</th><th>포지션</th><th>나이</th><th>신체</th><th>국적</th><th>행선지</th><th>상태</th><th></th></tr>
      ${rows}</table></div>`
     :`<p class="small">아직 만든 선수가 없습니다. [🧬 선수 만들기]에서 첫 선수를 만들어 보세요.</p>`}
  </div>`;
}
function playerGenView(){
  if(!PG) pgInit();
  /* ⚠ inputmode="decimal"을 전 칸에 걸면 모바일에서 이름 칸에도 숫자패드가 뜬다 — 글자 칸은 text로 */
  const IN=(k,val,w,ph)=>{
    const isTxt=(k==="name"||k==="osClub"||k==="osNat");
    return `<input type="text" inputmode="${isTxt?"text":"decimal"}" value="${val}" placeholder="${ph||""}" style="width:${w||70}px" onchange="pgSet('${k}', this.value)">`;
  };
  const SEL=(k,opts,cur)=>`<select onchange="pgSet('${k}', this.value)">${opts.map(o=>`<option value="${o[0]}" ${cur===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select>`;
  const age=G.season-PG.by;
  const pgTabs=`<div style="display:flex;gap:6px;margin-bottom:10px">
    <button class="mini ${PGTAB==="make"?"sel":""}" style="padding:7px 14px" onclick="PGTAB='make';show('playerGen')">🧬 선수 만들기</button>
    <button class="mini ${PGTAB==="list"?"sel":""}" style="padding:7px 14px" onclick="PGTAB='list';show('playerGen')">📜 선수 생성 목록${(G.pgMade&&G.pgMade.length)?` (${G.pgMade.length})`:""}</button>
  </div>`;
  /* 🧬 게임 시작 전 모드 — 넣을 리그가 없으니 「목록에만 생성」만 쓴다 */
  const preBar = PREGEN ? `<div class="msg info" style="border-width:2px">
      🧬 <b>게임 시작 전 선수 만들기</b> — 여기서 만든 선수는 <b>브라우저에 보관</b>되고,
      게임을 시작하면 <b>📜 선수 생성 목록</b>에 그대로 들어옵니다. 지금 화면의 구단·순위는 임시이며 저장되지 않습니다.
      <div style="margin-top:8px"><button class="mini" onclick="closePreGen()">◀ 팀 선택으로 돌아가기</button></div>
    </div>` : "";
  if(PGTAB==="list") return `<h2>🧬 선수 생성</h2>${preBar}${pgTabs}${pgMadeListView()}`;
  return `<h2>🧬 선수 생성</h2>${preBar}
  ${pgTabs}
  <div class="msg info">이름부터 계약까지 정해 새 선수를 만듭니다. 만든 뒤 세부 능력치는 🛠️ 인게임 에디터에서 다듬을 수 있습니다.</div>
  <div class="card">
    <div class="edSec">기본</div>
    ${ED_ROW("이름 *", IN("name",PG.name,140,"필수"))}
    ${ED_ROW("포지션 그룹", SEL("pos",[["GK","GK"],["DF","DF"],["MF","MF"],["FW","FW"]],PG.pos))}
    ${ED_ROW("주 포지션", `<select onchange="pgSet('pref', this.value)">${Object.keys(SLOT_FAM).map(k2=>`<option ${PG.pref===k2?"selected":""}>${k2}</option>`).join("")}</select>`)}
    ${ED_ROW(`출생년 (현재 ${age}세)`, IN("by",PG.by,70))}
    ${ED_ROW("키 (cm)", IN("h",PG.h,60))}
    ${ED_ROW("몸무게 (kg)", IN("w",PG.w,60))}
    ${ED_ROW("국적", SEL("frn",[["0","내국인"],["1","외국인 🌐"]],String(PG.frn)))}
    ${PG.frn?ED_ROW(`K리그 등록명 <span class="small">— 경기·명단에 표시되는 이름 (비우면 이름 그대로)</span>`, IN("knm",PG.knm||"",140,"예: 세라핌"))
      +ED_ROW("출신 국가", `<select onchange="pgSet('natl', this.value)" style="max-width:170px">
        <option value="">— 선택 —</option>
        ${PG_NATIONS.map(n2=>`<option value="${n2}" ${PG.natl===n2?"selected":""}>${n2}</option>`).join("")}
      </select>`):""}
    ${PG.frn?"":ED_ROW(`🎖️ 병역 <span class="small">— 군필이면 상무 차출 대상에서 빠집니다</span>`,
      SEL("armyDone",[["0","미필"],["1","군 복무 완료"]],String(PG.armyDone||0)))}
    ${ED_ROW("성격", SEL("pers",[["0","프로페셔널"],["1","야심가"],["2","온화"],["3","다혈질"]],String(PG.pers)))}
    <div class="edSec">능력 <span class="small">— 기준 능력으로 초안을 뽑고, 아래에서 하나하나 다듬습니다</span></div>
    ${ED_ROW(`기준 능력 <span class="small">— 별을 고르고 🎲 다시 뽑기 (K리그 전체 기준)</span>`,
      `<select onchange="pgSetStars(this.value)" style="width:130px">
        ${[5,4.5,4,3.5,3,2.5,2,1.5,1,0.5].map(st=>`<option value="${st}" ${PG.stars===st?"selected":""}>${"★".repeat(Math.floor(st))}${st%1?"☆":""} (${st}성)</option>`).join("")}
      </select> <button class="mini" onclick="pgGenAttrs();show('playerGen')">🎲 다시 뽑기</button>
      <span class="small" style="color:var(--sub)">현재 초안: ${(()=>{ const lv=pgCA()-starRefLevel(); const gr2=starGrade(62+lv*STAR_GAIN); return (gr2.silver?"은":"")+"★"+gr2.v; })()}</span>`)}
    ${ED_ROW(`<b>현재 능력 (자동)</b> <span class="small">세부 능력치에서 역산 · 90~200</span>`, `<b style="font-size:17px;color:var(--gold)">${pgDispCA()}</b>`)}
    ${ED_ROW(`잠재력 (성장 상한, 90~200)`, IN("pot",pgDispPot(),60)+`${PG.pot<=pgCA()?' <span class="small" style="color:var(--gold)">현재 능력과 같음 — 더 크지 않습니다</span>':""}`)}
    <div class="edSec">세부 능력치 <span class="small">— 1~20 · 수정하면 현재 능력이 즉시 따라 움직입니다</span></div>
    ${(()=>{ const grid=(keys,bag)=>keys.map(k2=>{
        const raw=bag&&typeof bag[k2]==="number"?bag[k2]:null;
        if(raw==null) return "";
        return `<div class="edAttr"><span title="${k2}">${ATTR_LABEL_FM[k2]||k2}</span>
          <input type="text" inputmode="numeric" value="${attr20(raw)}" onchange="pgSetAttr('${k2}', this.value)"></div>`;
      }).join("");
      return (PG.pos==="GK"&&PG.gkA?`<div class="edGrid">${grid(GK_ORDER,PG.gkA)}</div>`:"")
        + `<div class="edGrid">${grid(TECH_ORDER,PG.attr)}</div>`
        + `<div class="edGrid">${grid(MENT_ORDER,PG.attr)}</div>`
        + `<div class="edGrid">${grid(PHYS_ORDER,PG.attr)}</div>`; })()}
    <div class="edSec">포지션 능숙도 <span class="small">— 0~100 · 주 포지션을 바꾸면 초기화됩니다</span></div>
    <div class="edGrid">${FAM_POS.map(k2=>{ const f=(PG.fam&&PG.fam[k2])||0;
      return `<div class="edAttr"><span>${FAM_LABEL[k2]||k2}</span>
        <input type="text" inputmode="numeric" value="${Math.round(f)}" onchange="pgSetFam('${k2}', this.value)"></div>`; }).join("")}</div>
    <div class="edSec">특성 <span class="small">— ${PG.traits.length}/${TRAIT_MAX}개</span></div>
    ${PG.traits.length?PG.traits.map(k2=>{ const T=TRAIT_BY_KEY[k2];
      return `<div class="edRow"><span class="edL"><b style="color:var(--txt)">${T.n}</b></span>
        <button class="mini" onclick="pgTraitDel('${k2}')">🧹</button></div>`;}).join(""):""}
    ${PG.traits.length<TRAIT_MAX?`<div class="edRow"><span class="edL">특성 추가</span>
      <select onchange="pgTrait(this.value); this.value='';" style="max-width:240px">
        <option value="">— 선택 —</option>
        ${TRAITS.filter(T=>PG.traits.indexOf(T.k)<0).map(T=>`<option value="${T.k}">${T.n}</option>`).join("")}
      </select></div>`:""}
    <div class="edSec">계약 · 행선지</div>
    ${ED_ROW("연봉 (억)", IN("wage",PG.wage,60))}
    ${ED_ROW("계약 기간 (년)", IN("ct",PG.ct,50))}
    ${ED_ROW("몸값 고정 (억, 0=자동)", IN("mv",PG.mv||"",70,"자동"))}
    ${ED_ROW("행선지", SEL("dest",[["team","구단 입단"],["fa","FA 시장"],["os","해외 이적시장"]],PG.dest))}
    ${PG.dest==="team"?ED_ROW("입단할 구단", `<select onchange="pgSet('tid', this.value)" style="max-width:220px">
      ${Object.values(G.teams).filter(t=>!isArmyTeam(t)).sort((a,b)=>a.div-b.div||a.name.localeCompare(b.name,"ko")).map(t=>
        `<option value="${t.id}" ${PG.tid===t.id?"selected":""}>${t.div===2?"[K2] ":""}${t.name}${t.isUser?" ★":""}</option>`).join("")}
    </select>`):""}
    ${PG.dest==="os"?ED_ROW("소속 클럽명 *", IN("osClub",PG.osClub,170,"예: FC 산타클로스"))+ED_ROW("국적 표기", IN("osNat",PG.osNat,100,"예: 브라질")):""}
    ${PG.dest==="fa"?`<p class="small" style="margin:4px 0;color:var(--sub)">FA 시장에 무적 신분으로 올라갑니다. 어느 구단이든(AI 포함) 이적료 없이 데려갈 수 있습니다.</p>`:""}
    <div style="display:flex;gap:8px;margin-top:12px">
      ${PREGEN?"":`<button class="mini" style="flex:1;padding:12px;border-color:var(--gold);color:var(--gold);font-weight:800" onclick="pgCreate()">🧬 인게임에 바로 생성</button>`}
      <button class="mini" style="flex:1;padding:12px;font-weight:800" title="게임에 넣지 않고 목록에만 저장합니다 — 나중에 적용하거나 파일로 공유할 수 있습니다" onclick="pgCreate(true)">📜 ${PREGEN?"보관함에 저장":"목록에만 생성"}</button>
    </div>
  </div>
  ${PREGEN?`<button class="mini" onclick="closePreGen()">◀ 팀 선택으로 돌아가기</button>`
          :`<button class="mini" onclick="show('settings')">↩ 설정으로 돌아가기</button>`}`;
}
function engineEditorView(){
  let body="";
  {

    body = `
      <div class="edSec">매치엔진 배수 <span class="small">— 1.0이 기본 · 0.25~4.0 · 모든 경기(내 경기·AI 경기)에 즉시 적용</span></div>
      ${ME_TUNE_INFO.map(([k,n,d])=>`<div class="edRow">
        <span class="edL">${n} <span class="small" style="display:block">${d}</span></span>
        <input type="text" inputmode="decimal" value="${meTuneFmt(meTune(k))}" style="width:60px" onchange="edSetTune('${k}', this.value)">
        <span class="small" style="color:${meTune(k)===1?"var(--sub)":"var(--gold)"}">${meTune(k)===1?"기본 (×1.0)":"×"+meTuneFmt(meTune(k))}</span>
      </div>`).join("")}
      <button class="mini" style="margin-top:10px" onclick="edTuneReset()">↺ 전부 기본값으로</button>
      <p class="small" style="margin-top:8px;color:var(--sub)">⚠ 리그 통계(평균 득점·카드 수)가 기본값 기준으로 맞춰져 있습니다.
        크게 벌리면 시즌 기록이 실제 K리그와 많이 달라집니다.</p>
      <div class="edSec">매치엔진 설정 공유 <span class="small">— 선수 데이터 파일과 별개입니다</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="mini" onclick="tuneExport()">📤 엔진 설정 내보내기</button>
        <label class="mini" style="cursor:pointer">📥 엔진 설정 불러오기
          <input type="file" accept="application/json,.json" style="display:none" onchange="tuneImport(this)"></label>
      </div>`;
  }
  return `<h2>🎛️ 매치엔진 에디터</h2>
  <div class="msg warn">엔진 배수는 <b>즉시 저장</b>되며 모든 경기(내 경기·AI 경기)에 적용됩니다.
    <span class="small">선수 데이터와는 완전히 별개입니다 — 파일도 따로 저장하고 따로 공유합니다.</span></div>
  <div class="card">${body}</div>
  <button class="mini" onclick="show('settings')">↩ 설정으로 돌아가기</button>`;
}
function editorView(){
  const t=edTeam(), p=edPlayer();
  const tabBtn=(k,l)=>`<button class="mini ${ED.tab===k?'sel':''}" style="padding:7px 14px" onclick="edGo('tab','${k}')">${l}</button>`;
  const teamSel=`<select onchange="edGo('tid', this.value)" style="max-width:220px">
    <option value="">— 팀 선택 —</option>
    ${ED.tid==="fa"?`<option value="fa" selected>🆓 FA 시장</option>`:""}
    ${ED.tid==="os"?`<option value="os" selected>🌍 해외 이적시장</option>`:""}
    ${Object.values(G.teams).sort((a,b)=>a.div-b.div||a.name.localeCompare(b.name,"ko")).map(x=>
      `<option value="${x.id}" ${ED.tid===x.id?"selected":""}>${x.div===2?"[K2] ":""}${x.name}${x.isUser?" ★":""}</option>`).join("")}
    ${(function(){
      /* 🌏 해외(대회) 구단 — 이름·약칭을 여기서 고친다(제보) */
      try{
        const ea=EACL_CLUBS.map(c=>{
          const id="eacl_"+c.id, t2=eaclTeam(id);
          return `<option value="${id}" ${ED.tid===id?"selected":""}>[${c.nat}] ${(t2&&t2.name)||c.name}</option>`;
        }).join("");
        /* 🌍 세계 대회 구단 — 대륙대회 구단과 똑같이 이름을 고칠 수 있게 한다 */
        const cw=CWC_CLUBS.map(c=>{
          const ov=cwcNameOv(c.id);
          return `<option value="cwc_${c.id}" ${ED.tid===("cwc_"+c.id)?"selected":""}>[${c.nat||"해외"}] ${(ov&&ov.name)||c.name}</option>`;
        }).join("");
        return ea+cw;
      }catch(e){ return ""; }
    })()}
  </select>`;
  let body="";
  if(ED.tab==="team"){
    body = !t ? `<p class="small">위에서 팀을 먼저 고르세요.</p>` : `
      ${ED_ROW("🆔 구단 고유번호", `<b style="font-family:monospace;font-size:15px">${uidClubOf(t.id)}</b>`)}
      ${ED_ROW("팀 이름", ED_IN("edSetTeam","name",t.name,150))}
      ${ED_ROW("약칭", ED_IN("edSetTeam","short",t.short,90))}
      ${ED_ROW("구단 형태", `<select onchange="edSetTeam('ownKind', this.value)">
        ${["corp","civic","mixed","army"].map(k=>`<option value="${k}" ${clubType(t).k===k?"selected":""}>${CLUB_TYPE_N[k].ic} ${CLUB_TYPE_N[k].n}</option>`).join("")}
      </select> <span class="small" style="opacity:.75">${CLUB_TYPE_N[clubType(t).k].d}</span>`)}
      ${ED_ROW("모기업/운영 주체 <span class=\"small\">비우면 기본값</span>",
        `<input type="text" value="${(edIsCwc(t)||edIsEacl(t))?((t.own&&t.own.n)||""):clubType(t).o}" style="width:150px" onchange="edSetOwner(edTeam(), this.value)">`)}
      ${ED_ROW("이적 예산 (억)", ED_IN("edSetTeam","budget",t.budget))}
      ${ED_ROW("연봉 상한 (억)", ED_IN("edSetTeam","wageCap",t.wageCap||0))}
      ${ED_ROW("팬 규모", ED_IN("edSetTeam","fans",t.fans||10))}
      <div class="edSec">🏟️ 홈구장 <span class="small">— 고유번호 ${(stadOf(t)&&stadOf(t).uid)||uidStadOf(t.id)}</span></div>
      ${ED_ROW("구장 이름", ED_IN("edSetTeam","stadName",stadOf(t).n,170))}
      ${ED_ROW("수용 인원", ED_IN("edSetTeam","stadCap",stadOf(t).cap||15000,80))}
      ${ED_ROW(`평균 관중 <span class="small">티켓 수입 기준값</span>`, ED_IN("edSetTeam","stadAvg",stadOf(t).avg||3000,80))}
      ${ED_ROW("팀 사기 (40~99)", ED_IN("edSetTeam","morale",Math.round(t.morale||70)))}
      ${ED_ROW("조직력 (0~100)", ED_IN("edSetTeam","fam",Math.round(t.fam!=null?t.fam:70)))}
      ${ED_ROW("유스 등급 (1~10) <span class=\"small\">발굴 — 배출 인원·잠재력</span>", ED_IN("edSetTeam","youthLv",t.youthLv||1,50))}
      ${ED_ROW("훈련시설 (1~10) <span class=\"small\">육성 — 성장 속도·훈련 부상·특급 확률</span>", ED_IN("edSetTeam","trainLv",trainLv(t),50))}
      ${ED_ROW("스카우팅 등급 (1~5)", ED_IN("edSetTeam","scoutLv",t.scoutLv||1,50))}`;
  } else if(ED.tab==="player"){
    const vRoster = ED.tid==="fa" ? (G.freeAgents||[]) : ED.tid==="os" ? (G.overseas||[]) : null;
    if(!t && !vRoster){ body=`<div style="margin-bottom:8px">
        <input type="text" inputmode="text" value="${ED_Q}" placeholder="🔍 선수 이름 검색 (초성 가능) — 팀 선택 없이 바로"
          style="width:100%;max-width:320px" oninput="edSearchRefresh(this.value)">
        <div id="edSearchRes" style="max-width:320px;margin-top:4px">${ED_Q?edSearchResults(ED_Q):""}</div>
      </div><p class="small">또는 위에서 팀을 골라 명단에서 선택하세요.</p>`; }
    else {
      const edSearchBox=`<div style="margin-bottom:8px">
        <input type="text" inputmode="text" value="${ED_Q}" placeholder="🔍 선수 이름 검색 (초성 가능) — 팀 선택 없이 바로"
          style="width:100%;max-width:320px" oninput="edSearchRefresh(this.value)">
        <div id="edSearchRes" style="max-width:320px;margin-top:4px">${ED_Q?edSearchResults(ED_Q):""}</div>
      </div>`;
      const plSel=edSearchBox+`<select onchange="edGo('pid', this.value)" style="max-width:220px">
        <option value="">— 선수 선택 —</option>
        ${(vRoster||t.players).slice().sort((a,b)=>b.ovr-a.ovr).map(x=>
          `<option value="${x.id}" ${ED.pid===x.id?"selected":""}>${x.name} (${x.pos} ${dispOvr(x)})</option>`).join("")}
      </select>`;
      if(!p){ body=plSel+`<p class="small" style="margin-top:8px">선수를 고르면 항목이 열립니다.</p>`; }
      else {
        const age=G.season-p.by;
        const posSel=`<select onchange="edSetPlayer('pos', this.value)">
          ${["GK","DF","MF","FW"].map(k=>`<option ${p.pos===k?"selected":""}>${k}</option>`).join("")}</select>`;
        const prefSel=`<select onchange="edSetPlayer('prefPos', this.value)">
          ${Object.keys(SLOT_FAM).map(k=>`<option value="${k}" ${p.prefPos===k?"selected":""}>${k}</option>`).join("")}</select>`;
        const attrGrid=(keys)=>keys.map(k=>{
          const raw = (p.gkA && typeof p.gkA[k]==="number") ? p.gkA[k] : (p.attr ? p.attr[k] : null);
          if(typeof raw!=="number") return "";
          /* 🛠️ 나이 천장이 걸리는 항목은 그 사실을 표시한다 — 올려 놓고 왜 내려가는지 모르는 일이 없게 */
          let capTag="";
          try{
            if(AGE_CEIL_W[k] && age>=AGE_CEIL_FROM){
              const c20=Math.round(ageCeil(age, AGE_CEIL_W[k])/5*10)/10;
              const freed=!!(p.capOv && p.capOv[k]);
              capTag=`<span class="small" style="opacity:.7;margin-left:4px;color:${freed?"var(--gold)":"var(--sub)"}"
                title="${age}세 나이 천장 ${c20}. 이 위로 올리면 그 값이 이 선수의 천장으로 고정됩니다.">${freed?"🔓":"⛰"}${c20}</span>`;
            }
          }catch(e){}
          return `<div class="edAttr"><span title="${k}">${ATTR_LABEL_FM[k]||k}${capTag}</span>
            <input type="text" inputmode="numeric" value="${attr20(raw)}" onchange="edSetAttr('${k}', this.value)"></div>`;
        }).join("");
        body = plSel + `
        <div class="edSec">기본</div>
        ${ED_ROW("이름", ED_IN("edSetPlayer","name",p.name,120))}
        ${ED_ROW("포지션 그룹", posSel)}
        ${ED_ROW("주 포지션", prefSel)}
        ${ED_ROW(`출생년 (현재 ${age}세)`, ED_IN("edSetPlayer","by",p.by,70))}
        ${p.frn?ED_ROW(`홈그로운 <span class="small">국내 유스 출신 외국인 — 쿼터 미적용</span>`,
          `<select onchange="edSetPlayer('hg', this.value)"><option value="0" ${p.hg?"":"selected"}>아니오</option><option value="1" ${p.hg?"selected":""}>예 (초록 표시)</option></select>`):""}
        ${ED_ROW("키 (cm)", ED_IN("edSetPlayer","h",p.h||180,60))}
        ${ED_ROW("몸무게 (kg)", ED_IN("edSetPlayer","w",p.w||74,60))}
        ${ED_ROW(`🆔 고유번호 <span class="small">${(p.uid||0)>=UID_GEN?"생성 선수":"실존 선수"} — 개명·이적해도 바뀌지 않습니다</span>`,
          `<b style="font-family:monospace;font-size:15px">${p.uid||"-"}</b>`)}
        <div class="edSec">계약 · 가치</div>
        ${ED_ROW("연봉 (억)", ED_IN("edSetPlayer","wage",p.wage||1))}
        ${ED_ROW("잔여 계약 (년)", ED_IN("edSetPlayer","ct",p.ct||1,50))}
        ${ED_ROW(`계약 신분 <span class="small">현재 <b>${p.loan?`임대 (원소속 ${(G.teams[p.loan.own]||{}).short||"?"})`:(ED.tid==="fa"?"FA (자유계약)":"완전 소속")}</b></span>`,
          `<select onchange="edSetPlayer('status',this.value)">
            <option value="">— 신분 바꾸기 —</option>
            ${ED.tid!=="fa"&&ED.tid!=="os"?`<option value="own">완전 소속 (임대 해제·완전 이적)</option>
            <option value="loan">임대 신분으로 (원소속은 아래에서 선택)</option>
            <option value="fa">FA로 방출 (자유계약 시장으로)</option>`:`<option value="" disabled>FA·해외 선수는 구단 입단 후 바꿀 수 있습니다</option>`}
          </select>`)}
        ${p.loan?ED_ROW("임대 원소속 구단", `<select onchange="edSetPlayer('loanOwn',this.value)">
            ${Object.values(G.teams).filter(x=>x.id!==ED.tid).sort((a,b)=>a.div-b.div).map(x=>`<option value="${x.id}" ${p.loan.own===x.id?"selected":""}>${x.div===2?"[K2] ":""}${x.short}</option>`).join("")}
          </select> <span class="small">복귀: ${p.loan.until||G.season} 시즌 종료</span>`):""}
        ${ED_ROW(`몸값 고정 (억) <span class="small">현재 ${marketValue(p)}억${p.mvFix?" · 고정됨":" · 자동"}</span>`,
          ED_IN("edSetPlayer","mv",p.mvFix||"")+` <button class="mini" onclick="edSetPlayer('mvAuto','')">자동으로</button>`)}
        <div class="edSec">상태</div>
        ${ED_ROW(`잠재력 (90~200) <span class="small">현재 능력 ${dispOvr(p)} 기준</span>`, ED_IN("edSetPlayer","pot",dispPot(p),60))}
        ${ED_ROW("컨디션 (55~100)", ED_IN("edSetPlayer","cond",Math.round(p.cond||90),60))}
        ${ED_ROW("사기 (30~99)", ED_IN("edSetPlayer","morale",Math.round(p.morale||70),60))}
        ${ED_ROW("감독 호감도 (0~100)", ED_IN("edSetPlayer","aff",Math.round(aff(p)),60))}
        ${ED_ROW("부상 (주)", ED_IN("edSetPlayer","inj",p.inj||0,50))}
        ${ED_ROW("출장 정지 (경기)", ED_IN("edSetPlayer","ban",p.ban||0,50))}
        ${ED_ROW("특성 포인트", ED_IN("edSetPlayer","tpt",p.tpt||0,50))}
        <div class="edSec">특성 <span class="small">— ${(p.traits||[]).length}/${TRAIT_MAX}개 (에디터는 포지션 제한·포인트 소모 없이 넣고 뺍니다)</span></div>
        ${(p.traits||[]).length?(p.traits||[]).map(k=>{ const T=TRAIT_BY_KEY[k]; if(!T) return "";
          return `<div class="edRow"><span class="edL"><b style="color:var(--txt)">${T.n}</b>
            <span class="small" style="display:block">${T.e||""} · ${T.c||""}</span></span>
            <button class="mini" onclick="edDelTrait('${k}')">🧹 빼기</button></div>`;}).join("")
          :`<p class="small" style="margin:4px 0">가진 특성이 없습니다.</p>`}
        ${(p.traits||[]).length<TRAIT_MAX?`<div class="edRow"><span class="edL">특성 추가</span>
          <select onchange="edAddTrait(this.value); this.value='';" style="max-width:240px">
            <option value="">— 특성 선택 (${TRAITS.filter(T=>(p.traits||[]).indexOf(T.k)<0).length}종) —</option>
            ${(()=>{
              const rest=TRAITS.filter(T=>(p.traits||[]).indexOf(T.k)<0);
              const shown=new Set();
              let h="";
              for(const gp of ["FW","MF","DF","GK"]){
                const list=rest.filter(T=>traitGroups(T.k).length<4 && traitHomeGrp(T.k)===gp);
                if(!list.length) continue;
                for(const T of list) shown.add(T.k);
                h+=`<optgroup label="${TRAIT_GRP_KO[gp]} 특성 (${list.length})">${list.map(T=>`<option value="${T.k}">${T.n} · ${T.c}</option>`).join("")}</optgroup>`;
              }
              const com=rest.filter(T=>!shown.has(T.k));
              if(com.length) h+=`<optgroup label="자리 공통 (${com.length})">${com.map(T=>`<option value="${T.k}">${T.n} · ${T.c}</option>`).join("")}</optgroup>`;
              return h;
            })()}
          </select></div>`:""}
        <div class="edSec">능력치 <span class="small">— 1~20 (수정하면 오버롤이 함께 움직입니다. 현재 ${dispOvr(p)})</span></div>
        ${p.pos==="GK" && p.gkA ? `<div class="edGrid">${attrGrid(GK_ORDER)}</div>` : ""}
        <div class="edGrid">${attrGrid(TECH_ORDER)}</div>
        <div class="edGrid">${attrGrid(MENT_ORDER)}</div>
        <div class="edGrid">${attrGrid(PHYS_ORDER)}</div>
        <div class="edSec">포지션 능숙도 <span class="small">— 0~100 (0이면 그 자리를 못 봅니다)</span></div>
        <div class="edGrid">${FAM_POS.map(k=>{
          const f=(p.posFam&&p.posFam[k])||0;
          return `<div class="edAttr"><span>${FAM_LABEL[k]||k}</span>
            <input type="text" inputmode="numeric" value="${Math.round(f)}" onchange="edSetFam('${k}', this.value)"></div>`;
        }).join("")}</div>`;
      }
    }
  } else if(ED.tab==="nick"){
    const C=customNicks();
    body = `
      <div class="edSec">커스텀 닉네임 <span class="small">— ${C.length}/40개 · 우리 팬·타팀 팬·펨코 반응에 무작위로 섞여 나옵니다</span></div>
      <div class="edRow">
        <input id="nkName" type="text" maxlength="14" placeholder="닉네임 (예: 개랑이수호대)" style="width:180px">
        <input id="nkEmoji" type="text" maxlength="4" placeholder="이모지" style="width:64px">
        <button class="mini" onclick="edAddNick()">➕ 추가</button>
      </div>
      ${C.length?`<div class="edGrid">${C.map((x,i)=>`<div class="edAttr"><span>${x.e||"💬"} ${x.n}</span>
        <button class="mini" onclick="edDelNick(${i})">🧹</button></div>`).join("")}</div>`
       :`<p class="small" style="margin:6px 0">아직 추가한 닉네임이 없습니다. 많이 넣을수록 자주 등장합니다 (최대 등장률: 소셜 30% · 펨코 25%).</p>`}
      <div class="edSec">기본 닉네임 <span class="small">— 게임에 내장된 풀 (수정 불가, 참고용)</span></div>
      <p class="small" style="line-height:1.9">${SOC_NICK3.map(x=>x[1]+x[0]).slice(0,12).join(" · ")} 외 ${SOC_NICK_EXTRA.length+SOC_NICK2.length+SOC_NICK3.length-12}종</p>`;
  } else if(ED.tab==="press"){
    const js=journalists(), rp=reporters();
    body = `
      <div class="edSec">기자회견 기자단 <span class="small">— 경기 전후 기자회견에 등장하는 3인</span></div>
      ${js.map((j,i)=>`<div class="edAttr" style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
        <span style="width:34px">${j.av}</span>
        <input type="text" value="${j.n}" style="width:110px" placeholder="기자명" onchange="edSetPress(${i},'n',this.value)">
        <input type="text" value="${j.o}" style="width:140px" placeholder="매체명" onchange="edSetPress(${i},'o',this.value)">
      </div>`).join("")}
      <div class="edSec">이적시장 기자단 <span class="small">— 루머를 터뜨리는 6인 (신뢰도는 루머의 진위 확률에 쓰여 수정 불가)</span></div>
      ${rp.map((j,i)=>`<div class="edAttr" style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
        <span style="width:34px">${j.ic}</span>
        <input type="text" value="${j.n}" style="width:110px" placeholder="기자명" onchange="edSetRep(${i},'n',this.value)">
        <input type="text" value="${j.o}" style="width:140px" placeholder="매체명" onchange="edSetRep(${i},'o',this.value)">
        <span class="small">신뢰도 ${j.rel} · ${j.tone}</span>
      </div>`).join("")}
      <button class="mini" style="margin-top:8px" onclick="edPressReset()">↺ 기본 기자단으로 되돌리기</button>
      <p class="small" style="margin-top:6px;color:var(--sub)">이미 나온 기사·루머의 기자명은 바뀌지 않고, 이후 나오는 것부터 적용됩니다.</p>`;
  } else if(ED.tab==="comp"){
    const rows=compKeys().map(k=>{
      const c=compInfo(k);
      return `<div style="margin-bottom:9px">
        <div class="edAttr" style="display:flex;gap:7px;align-items:center">
          <span class="small" style="width:44px;font-family:monospace;opacity:.75">${c.uid}</span>
          <input type="text" value="${c.rawN}" style="width:250px" placeholder="정식 명칭" onchange="edSetComp('${k}','n',this.value)">
          <input type="text" value="${c.rawS}" style="width:90px" placeholder="짧은 표기" onchange="edSetComp('${k}','s',this.value)">
        </div>
        <div class="small" style="margin-left:51px;color:var(--sub)">${G.season} 시즌 표기 → <b style="color:var(--gold)">${c.n}</b> · ${c.s}</div>
      </div>`;
    }).join("");
    body=`<div class="edSec">대회 <span class="small">— 정식 명칭(스폰서 포함)과 순위표·중계에 쓰는 짧은 표기</span></div>
      <div class="small" style="margin-bottom:10px;color:var(--sub)">
        <b>{Y}</b> 자리에 시즌 연도가 들어갑니다 — 예) <b>${COMP_DEF.k1.n}</b> → ${G.season} 시즌엔 「${compYearFix(COMP_DEF.k1.n)}」.<br>
        연도를 직접 <b>2026</b>처럼 적어도 해마다 자동으로 갱신됩니다.</div>
      ${rows}
      <button class="mini" style="margin-top:8px" onclick="edCompReset()">↺ 기본 대회명으로 되돌리기</button>`;
  } else if(ED.tab==="coaches"){
    /* ⚠ 제보 — 「새 게임에서 내가 그 팀을 맡아 부임하지 않은 감독은 명단에 없어 이름을 못 고친다」.
       내가 맡은 구단의 원래 감독은 COACHES 에 그대로 남아 있고, 내가 경질당하면 그 사람이
       다시 지휘봉을 잡는다 — 즉 「미부임 감독」도 엄연히 게임 안의 인물이다.
       숨기지 않고 [미부임] 표시와 함께 보여 주고, 능력치까지 손볼 수 있게 한다. */
    const _cRow=(id)=>{
      const t2=G.teams[id]; if(!t2) return "";
      const c=COACHES[id];
      const idle=!!t2.isUser;                       // 내가 그 구단을 맡고 있다 = 이 감독은 지금 무적
      const open=ED.coach===id;
      /* 🎩 감독도 스태프와 같은 FM 24개 표를 고친다 (요청 — 「감독, 스탭들은 다 이 능력치 한해서」)
         ⚠ 옛 7개를 고치는 방식은 어긋난다 — 한 능력치가 여러 옛 키의 재료라, 하나만 바꾸면
           역변환이 평균을 내며 다른 값까지 흔든다(경기판단 8 로 고쳐도 8 이 안 나온다). */
      try{ if(acNeedSeed(c)) acSeedFromLegacy(c); }catch(e){}
      const _mcore=new Set(acRoleSA({role:"ac"}));
      const ab=(k)=>`<div class="edAttr"><span class="small"${_mcore.has(k)?' style="color:#7ee2a8"':""}>${SA_LABEL[k]||k}</span>
        <input type="text" inputmode="numeric" value="${sa(c,k)}" style="width:46px;text-align:center"
          onchange="edSetCoachAttr('${id}','${k}',this.value)"></div>`;
      return `<div style="margin-bottom:5px">
        <div class="edAttr" style="display:flex;gap:7px;align-items:center">
          <span class="small" style="width:44px;font-family:monospace;opacity:.75">${uidCoachOf(id)}</span>
          <span class="small" style="width:78px">${t2.div===2?"[K2] ":""}${t2.short}${idle?' <span style="color:var(--gold)">·미부임</span>':""}</span>
          <input type="text" value="${c.n}" style="width:118px" onchange="edSetCoachName('${id}',this.value)">
          <span class="small">관계</span>
          <input type="text" inputmode="decimal" value="${Math.round(coachRel(id))}" style="width:50px;text-align:center"
            ${idle?'disabled title="내가 맡은 구단 — 관계 수치를 쓰지 않습니다"':`onchange="edSetCoachRel('${id}',this.value)"`}>
          <span class="small" style="color:${idle?"var(--sub)":coachRelLabel(coachRel(id))[1]}">${idle?"—":coachRelLabel(coachRel(id))[0]}</span>
          <button class="mini ${open?"sel":""}" style="margin-left:auto;padding:2px 9px" onclick="edCoachOpen('${id}')">종합 ${c.ovr} ${open?"▲":"▾"}</button>
        </div>
        ${open?`<div style="margin:4px 0 8px 44px">
          ${SA_GRP.map(g=>`<div class="edSec">${g.ic} ${g.n}</div>
            <div class="edGrid" style="margin:3px 0 5px">${g.keys.map(ab).join("")}</div>`).join("")}
        </div>
        <div class="small" style="margin:0 0 8px 44px;opacity:.8">1~20. 전술·경기 판단은 경기 중 대응 속도와 상대 읽기,
          공격/수비 차이는 선호 포메이션과 성향, 육성은 소속 선수의 성장 속도에 들어갑니다.</div>`:""}
      </div>`;
    };
    const mine=Object.keys(COACHES).filter(id=>G.teams[id] && G.teams[id].isUser);
    const rest=Object.keys(COACHES).filter(id=>G.teams[id] && !G.teams[id].isUser);
    const rows=mine.concat(rest).map(_cRow).join("");
    /* 🎩 우리 수석코치 — 리그 감독과 같은 어휘(tac/flex/att/def/man/dev/judg)를 쓰므로
       같은 화면에 둔다. 공석이면 여기서 한 명 만들어 앉힐 수 있다. */
    const _acEd=(()=>{
      acEnsure();
      const C=crew().slice().sort((x,y)=>AC_ROLE_ORDER.indexOf(x.role)-AC_ROLE_ORDER.indexOf(y.role));
      const one=(c)=>{
        const R=acRole(c), isAc=(c.role||"ac")==="ac";
        /* 🎩 FM 24개를 직접 고친다 (요청) */
        const _core=new Set(acRoleSA(c));
        const ab=(k)=>`<div class="edAttr"><span class="small"${_core.has(k)?' style="color:#7ee2a8"':""}>${SA_LABEL[k]||AC_LABEL[k]||k}</span>
          <input type="text" inputmode="numeric" value="${sa(c,k)}" style="width:46px;text-align:center"
            onchange="edSetAc('${k}',this.value,'${c.id}')"></div>`;
        return `<div style="margin-bottom:9px;padding-bottom:7px;border-bottom:1px solid #21262d">
          <div class="edAttr" style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
            <span class="small" style="width:44px;font-family:monospace;opacity:.75">${c.uid||"—"}</span>
            <span class="tag" style="background:#30363d">${R.ic} ${R.n}</span>
            <input type="text" value="${c.n}" style="width:110px" onchange="edSetAc('n',this.value,'${c.id}')">
            <span class="small">나이</span>
            <input type="text" inputmode="numeric" value="${c.age}" style="width:46px;text-align:center" onchange="edSetAc('age',this.value,'${c.id}')">
            <span class="small">연봉</span>
            <input type="text" inputmode="decimal" value="${c.wage}" style="width:52px;text-align:center" onchange="edSetAc('wage',this.value,'${c.id}')">
            <span class="small">계약</span>
            <input type="text" inputmode="numeric" value="${c.ct||2}" style="width:42px;text-align:center" onchange="edSetAc('ct',this.value,'${c.id}')">
            ${isAc?`<span class="small">성향</span>
              <select onchange="edSetAc('trait',this.value,'${c.id}')" style="padding:3px 6px">
                ${Object.keys(AC_TRAIT).map(k=>`<option value="${k}"${c.trait===k?" selected":""}>${AC_TRAIT[k].ic} ${AC_TRAIT[k].n}</option>`).join("")}
              </select>`:""}
            ${R.slot?`<span class="small">담당</span>
              <select onchange="edSetAc('assign',this.value,'${c.id}')" style="padding:3px 6px">
                <option value=""${!c.assign?" selected":""}>미배정</option>
                ${AC_SLOT.map(s=>`<option value="${s.k}"${c.assign===s.k?" selected":""}>${s.ic} ${s.n}</option>`).join("")}
              </select>`:""}
            <span class="small" style="margin-left:auto">종합 <b style="color:${acGrade(acOvr(c))[1]}">${acOvr(c)}</b>/20</span>
          </div>
          ${SA_GRP.map(g=>`<div class="edSec">${g.ic} ${g.n}</div>
            <div class="edGrid" style="margin:4px 0 4px">${g.keys.map(ab).join("")}</div>`).join("")}
          ${isAc?acEffectRow(c):""}
        </div>`;
      };
      const addBtns=AC_ROLE_ORDER.map(k=>{
        const R=AC_ROLE[k], full=(k==="ac") ? !!acOf() : crewOf(k).length>=R.cap;
        return `<button class="mini" ${full?'disabled title="정원 참"':""} onclick="edAcNew('${k}')">➕ ${R.ic} ${R.n}</button>`;
      }).join(" ");
      return `<div class="edSec">🎩 우리 코치진 <span class="small">— ${C.length}명 · 능력치·담당·계약을 직접 손봅니다 (정원·연봉 여력을 무시합니다)</span></div>
      ${C.length?C.map(one).join(""):`<div class="msg warn" style="margin-bottom:8px">코치진이 통째로 비어 있습니다.</div>`}
      <div style="margin:6px 0 14px;display:flex;gap:5px;flex-wrap:wrap">${addBtns}</div>`;
    })();
    body=`${_acEd}
    <div class="edSec">리그 감독 <span class="small">— 이름 · 나와의 관계(0~100) · 능력치를 수정합니다</span></div>
    ${mine.length?`<div class="msg info" style="margin-bottom:8px"><b style="color:var(--gold)">·미부임</b> 은 내가 맡고 있어 지금은 지휘봉을 놓은 감독입니다.
      내가 경질당하면 그 구단으로 돌아오므로, 이름과 능력치를 여기서 미리 손볼 수 있습니다.</div>`:""}
    ${rows}`;
  } else if(ED.tab==="ref"){
    const NAMES=refNames();
    body = `
      <div class="edSec">심판 명단 <span class="small">— 경기마다 이 명단에서 주심·대기심·VAR이 배정됩니다</span></div>
      <div class="edGrid">${NAMES.map((n,i)=>`<div class="edAttr"><span class="small" style="font-family:monospace;opacity:.7">${uidRefOf(i)}</span>
        <input type="text" value="${n}" style="width:76px;text-align:center" onchange="edSetRef(${i}, this.value)"></div>`).join("")}</div>
      <button class="mini" style="margin-top:8px" onclick="edRefReset()">↺ 기본 명단으로 되돌리기</button>`;
  } else {
    const S=refState(), M=me();
    body = `
      <div class="edSec">감독 지갑</div>
      ${ED_ROW("보유 현금 (억)", ED_IN("edSetMgr","cash",M.cash.toFixed(2)))}
      ${ED_ROW("미납 징계금 (억)", ED_IN("edSetMgr","debt",(M.debt||0).toFixed(2)))}
      <div class="edSec">신뢰 · 관계</div>
      ${ED_ROW("구단주 신뢰 (0~100)", ED_IN("edSetMgr","own",Math.round(G.trust?G.trust.owner:70),60))}
      ${ED_ROW("서포터 신뢰 (0~100)", ED_IN("edSetMgr","fan",Math.round(G.trust?G.trust.fans:70),60))}
      ${ED_ROW("언론 관계 (0~100)", ED_IN("edSetMgr","press",Math.round(G.press?G.press.rel:50),60))}
      ${ED_ROW("심판진 관계 (-100~100)", ED_IN("edSetMgr","refs",S.rel,60))}
      <p class="small" style="margin-top:10px;color:var(--sub)">감독 위신은 집·부동산·현금으로 계산되는 파생값이라 직접 수정하지 않습니다. 현금을 올리면 따라 오릅니다.</p>`;
  }
  return `<h2>🛠️ 인게임 에디터</h2>
  <div class="msg warn">수정은 <b>즉시 저장</b>됩니다. 실험 전에 ⚙️ 설정에서 세이브파일을 내보내 두는 것을 권장합니다.
    <span class="small">에디터 사용에 페널티는 없습니다 — 감독 마음입니다.</span></div>
  <div class="card">
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      ${tabBtn("team","🏟️ 팀")} ${tabBtn("player","⚽ 선수")} ${tabBtn("mgr","👔 감독")} ${tabBtn("coaches","🧑‍💼 리그 감독")} ${tabBtn("comp","🏆 대회")} ${tabBtn("ref","🧑‍⚖️ 심판")} ${tabBtn("press","🎙️ 기자단")} ${tabBtn("nick","💬 닉네임")}
      ${ED.tab!=="mgr"?`<span style="margin-left:auto">${teamSel}</span>`:""}
    </div>
    ${body}
  </div>
  <div class="card">
    <h3>📦 에디터 데이터 파일 <span class="small">— FM식 전체 덮어쓰기</span></h3>
    <p class="small" style="margin-bottom:8px">리그 전체(모든 팀·모든 선수)의 이름·능력치·능숙도·계약·몸값에 더해
      <b>모기업 · 심판진 · 기자단 · 커스텀 닉네임 · 감독(지갑·신뢰)</b>까지 통째로 파일에 담습니다.
      불러온 쪽은 자기 세이브 위에 이 값들이 그대로 덮어써집니다 — 순위·일정·기록 같은 시즌 진행은 유지됩니다.
      선수는 이름으로 찾되, 성씨가 다른 버전의 파일(업데이트 전 실명 데이터 등)도 동일 인물로 알아봅니다. 받은 세이브에 없는 선수만 건너뜁니다.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="mini" onclick="edExport()">📤 전체 내보내기 <span class="small">(리그 통째)</span></button>
      <button class="mini" onclick="edExportPatch()" ${(G.edits||[]).length?"":"disabled"}>✂️ 수정본만 내보내기 <span class="small">(${(G.edits||[]).length}건)</span></button>
      <button class="mini" onclick="edExportNames()">📛 이름만 내보내기 <span class="small">(선수명·구단명·모기업명)</span></button>
      <label class="mini" style="cursor:pointer">📥 불러오기 <span class="small">(자동 판별)</span>
        <input type="file" accept="application/json,.json" style="display:none" onchange="edImport(this)"></label>
      <button class="mini" onclick="edClearLog()" ${(G.edits||[]).length?"":"disabled"}>🧹 기록 비우기</button>
    </div>
    ${(G.edits||[]).length?`<div style="margin-top:8px;max-height:120px;overflow-y:auto">
      ${(G.edits||[]).slice(-8).reverse().map(e=>{
        const tn=e.tid ? ((G.teams[e.tid]||{}).short||e.tid) : "공통";
        const what = e.k==="t"?"팀·"+e.f : e.k==="a"?(ATTR_LABEL_FM[e.f]||e.f) : e.k==="f"?(FAM_LABEL[e.f]||e.f)+" 능숙도"
          : e.k==="tr"?((TRAIT_BY_KEY[e.f]||{}).n||e.f)+(e.v==="+"?" 추가":" 제거")
          : e.k==="mgr"?"감독·"+e.f : e.k==="ref"?"심판 "+(parseInt(e.f,10)+1)+"번"
          : e.k==="press"?"기자회견 기자 "+e.f : e.k==="rep"?"이적시장 기자 "+e.f
          : e.k==="nick"?"닉네임 "+e.f+(String(e.v).charAt(0)==="+"?" 추가":" 제거")
          : e.k==="ac"?"수석코치·"+e.f : e.f;
        return `<div style="padding:2px 0;border-bottom:1px solid #1a2027;font-size:11.5px;color:var(--sub)">${tn}${e.pn?" · "+e.pn:""} — ${what}${e.k!=="tr"?` → <b style="color:var(--txt)">${e.v}</b>`:""}</div>`;
      }).join("")}
      ${(G.edits||[]).length>8?`<div class="small" style="padding:3px 0">외 ${(G.edits||[]).length-8}건</div>`:""}</div>`:""}
    <p class="small" style="margin-top:8px;color:var(--sub)">전체 = 리그 전 선수를 파일 값으로 덮어쓰기 · 수정본 = 내가 고친 항목만 얹기 (나머지는 받은 쪽 상태 유지) · ⚠ 불러오기는 되돌릴 수 없습니다.</p>
  </div>
  <button class="mini" onclick="show('settings')">↩ 설정으로 돌아가기</button>`;
}
/* 🎭 돌발 행동 설정 — '안 함'이면 물병·라커룸/심판실 방문·뺨때리기 선택지가 아예 나오지 않는다 (일반 FM 모드) */
function wildOff(){ return !(G.opt && G.opt.noWild===false); }   // 기본 = 안 함. 예능파만 명시적으로 허용한다
function settingsView(){
  const cur=getFontScale();
  return `<h2>⚙️ 설정</h2>
  ${saveInfoHtml()}
  ${h2aCard()}
  <div class="row">
    <div class="card"><h3>🛠️ 인게임 에디터</h3>
      <p class="small" style="margin-bottom:10px">팀·선수·감독·심판의 데이터를 직접 수정합니다 — 이름, 능력치, 특성, 능숙도, 몸값, 계약, 신뢰까지.</p>
      <button class="mini" onclick="ED={tid:G.userTeamId, pid:null, tab:'team'};show('editor')">🛠️ 에디터 열기</button>
    </div>
    <div class="card"><h3>🧬 선수 생성</h3>
      <p class="small" style="margin-bottom:10px">이름·신체·성격·능력·특성·계약을 정해 새 선수를 만듭니다. 구단 입단, FA 시장, 해외 시장 어디로든 보낼 수 있습니다.</p>
      <button class="mini" onclick="pgInit();show('playerGen')">🧬 선수 만들기</button>
    </div>
  </div>
  <div class="card">
    <h3>🔍 수신 디버그 <span class="small">— 개발/분석용</span></h3>
    <p class="small" style="margin-bottom:10px">2D 매치엔진 화면에 <b>몸 방향</b>(흰 화살표) · <b>수신 자세 목표</b>(노란 화살표) · <b>공이 오는 방향</b>(하늘 점선) · <b>선수↔공 오프셋</b>(초록 선)과 상태 텍스트를 겹쳐 그립니다.</p>
    <button class="mini ${(G.opt&&G.opt.ftDebug)?'sel':''}" onclick="G.opt=G.opt||{};G.opt.ftDebug=!G.opt.ftDebug;saveGame();show('settings')">${(G.opt&&G.opt.ftDebug)?"🔍 켜짐":"○ 꺼짐"}</button>
  </div>
  <div class="card">
    <h3>🚪 창 닫기 · 새로 고침</h3>
    <p class="small" style="margin-bottom:10px">창을 닫거나 새로 고칠 때 브라우저가 <b>한 번 물어보게</b> 합니다 — 실수로 탭을 닫는 사고를 막습니다.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="mini ${exitAskOn()?'sel':''}" onclick="setExitAsk(true)">💬 확인창 켜짐 (기본)</button>
      <button class="mini ${exitAskOn()?'':'sel'}" onclick="setExitAsk(false)">○ 끔</button>
    </div>
    <p class="small" style="margin-top:9px;color:var(--sub);line-height:1.6">
      ✅ 확인창과 별개로, <b>창이 닫히는 순간 진행 상황은 자동으로 저장됩니다.</b> 실수로 닫아도 다시 열면 그대로 이어집니다.<br>
      ⚠️ 문구는 <b>브라우저가 정합니다</b> — 「저장하시겠습니까?」처럼 우리가 원하는 말로는 띄울 수 없고,
      「이 사이트에서 나가시겠습니까?」 같은 브라우저 기본 문구가 뜹니다.<br>
      ⚠️ 페이지를 한 번도 클릭하지 않은 상태에서는 브라우저가 이 확인창을 무시합니다(정책).
      아이폰 사파리는 확인창 자체를 지원하지 않지만, <b>자동 저장은 그쪽에서도 동작합니다.</b></p>
  </div>
  <div class="card">
    <h3>🖱️ 뒤로 가기 제스처</h3>
    <p class="small" style="margin-bottom:10px">맥북 <b>트랙패드 두 손가락 좌우 스와이프</b>, 마우스 <b>4·5번 버튼</b>, <b>Alt/⌘ + ←</b> 로 이전 화면으로 돌아갑니다.
      팝업이 열려 있으면 팝업만 닫히고, 경기 중에는 동작하지 않습니다.
      <br><span style="opacity:.8">표를 가로로 넘길 때는 표가 먼저 스크롤되니 안심하고 쓰셔도 됩니다.</span></p>
  </div>
  <div class="card">
    <h3>🎭 돌발 행동</h3>
    <p class="small" style="margin-bottom:10px">기자회견·팬 간담회 물병 투척, 상대 라커룸 방문 같은 '선 넘는' 선택지입니다. 기본은 <b>안 함</b> — 일반 FM처럼 해당 선택지가 화면에 나오지 않습니다. 예능을 원하시면 허용으로 바꾸세요. (이미 벌어진 사건의 여파는 그대로 남습니다)</p>
    <button class="mini ${wildOff()?'sel':''}" onclick="G.opt=G.opt||{};G.opt.noWild=true;saveGame();show('settings')">🚫 안 함 (기본)</button>
    <button class="mini ${!wildOff()?'sel':''}" onclick="G.opt=G.opt||{};G.opt.noWild=false;saveGame();show('settings')">🎭 허용 (예능 모드)</button>
  </div>
  <div class="card">
    <h3>인게임 폰트 크기</h3>
    <p class="small" style="margin-bottom:10px">화면 전체 글자 크기를 조절합니다. (기본 100%)</p>
    ${FONT_SCALE_OPTS.map(o=>`<button class="mini ${cur===o?'sel':''}" onclick="setFontScale(${o})">${o}%</button>`).join(" ")}
  </div>
  <div class="card">
    <h3>🖥️ 전체화면 <span class="small">— 주소창·탭 막대 숨기기</span></h3>
    ${fsSupported()?`
      <p class="small" style="margin-bottom:10px">브라우저 주소창과 탭을 숨기고 게임만 화면에 채웁니다.
        한 번 켜 두면 다음에 열 때 <b>첫 터치(클릭) 한 번</b>으로 자동으로 들어갑니다. 끄려면 <b>Esc</b> 또는 같은 버튼.</p>
      <button class="mini ${fsNow()?"sel":""}" onclick="toggleFS()">${fsNow()?"⛗ 전체화면 끄기":"⛶ 전체화면 켜기"}</button>
      <p class="small" style="margin-top:8px;color:var(--sub)">화면 오른쪽 아래의 작은 <b>⛶</b> 버튼으로도 언제든 켜고 끌 수 있습니다.
        PC라면 <b>F11</b> 키도 같은 역할을 합니다.</p>`
    :`<p class="small">이 브라우저는 전체화면 기능을 지원하지 않습니다.</p>`}
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
      <b class="small">🔆 경기 중 화면 유지</b>
      <p class="small" style="margin:4px 0 8px">경기가 진행되는 동안 화면이 저절로 꺼지지 않게 잡아 둡니다. 손을 대지 않아도 끝까지 흘러갑니다.</p>
      ${wakeSupported()
        ? `<button class="mini ${wakeWant()?"sel":""}" onclick="toggleWake()">${wakeWant()?"🔆 켜짐 — 끄기":"🌙 꺼짐 — 켜기"}</button>`
        : `<p class="small" style="color:var(--sub)">이 브라우저는 화면 유지 기능을 지원하지 않습니다. 기기의 화면 자동 꺼짐 시간을 늘려 주세요.</p>`}
      <p class="small" style="margin-top:6px;color:var(--sub)">
        브라우저는 다른 앱으로 넘어가면 경기를 계속 돌릴 수 없습니다(웹의 구조적 한계라 PiP·백그라운드 실행 모두 불가).
        대신 <b>탭을 벗어나면 경기를 멈춰 두었다가 돌아왔을 때 이어서</b> 재개하므로 놓치는 장면은 없습니다.</p>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">
      <b class="small">📱 가로 모드 고정</b>
      <p class="small" style="margin:4px 0 8px">화면을 눕힌 상태로 잠급니다. 가로에서는 메뉴가 왼쪽으로 붙고 여백이 줄어드는 전용 레이아웃으로 바뀝니다.</p>
      ${orientSupported()
        ? `<button class="mini ${orientWant()?"sel":""}" onclick="toggleLandscape()">${orientWant()?"📱 가로 고정 해제":"📱 가로 모드로 고정"}</button>
           <p class="small" style="margin-top:6px;color:var(--sub)">방향 잠금은 전체화면일 때만 허용되는 기능이라, 켜면 전체화면도 함께 들어갑니다.</p>`
        : `<p class="small" style="color:var(--sub)">이 브라우저(아이폰 사파리 포함)는 방향 고정을 지원하지 않습니다.
             제어 센터에서 <b>화면 회전 잠금</b>을 끄고 기기를 눕히면 가로용 레이아웃이 자동으로 적용됩니다.</p>`}
    </div>
    <p class="small" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);color:var(--sub)">
      📱 <b>아이폰 사파리</b>는 전체화면 기능 자체가 없습니다. 대신 공유 <b>⬆️</b> → <b>홈 화면에 추가</b>로 만들어 두고
      그 아이콘으로 실행하면 주소창 없이 앱처럼 열립니다. (안드로이드 크롬은 ⋮ → <b>앱 설치</b>／<b>홈 화면에 추가</b>)<br>
      <span style="opacity:.8">단, 이 방법은 게임 파일이 인터넷 주소(https)에 올라가 있을 때만 됩니다.
      파일을 직접 열어서(<code>file://</code>) 하는 경우에는 위의 전체화면 버튼을 쓰세요.</span></p>
  </div>
  <div class="card">
    <h3>🧠 경기 엔진</h3>
    <p class="small">내 팀 경기는 <b>연속 2D 매치엔진</b>으로 치릅니다 — 0.2초 단위로 22명이 실제로 움직이고,
      전술·역할·능숙도·세트피스·오프사이드가 규칙대로 반영됩니다.<br>
      AI 구단끼리의 경기는 속도 때문에 빠른 엔진으로 처리하되, 결과 분포(득점·전력 반영)를 2D와 맞춰 두었습니다.</p>
  </div>
  <div class="card">
    <h3>🎬 골 장면 리플레이</h3>
    <p class="small" style="margin-bottom:10px">골이 터지면 세리머니가 끝난 뒤 그 장면을 조금 느리게 다시 보여줍니다.</p>
    <button class="mini ${replayOn()?"sel":""}" onclick="setReplay(true)">🎬 보기</button>
    <button class="mini ${replayOn()?"":"sel"}" onclick="setReplay(false)">🚫 안 보기</button>
  </div>
  <div class="card">
    <h3>⚽ 90분 시뮬 관전 <span class="small">(실험)</span></h3>
    <p class="small" style="margin-bottom:10px">아무 두 팀이나 붙여 연속 매치엔진을 직접 볼 수 있습니다. 경기 결과·세이브에는 전혀 영향을 주지 않습니다.</p>
    <button class="mini" onclick="openSimWatch()">관전 화면 열기 ▶</button>
  </div>`;
}
/* 골 장면 리플레이 — 기본은 켜짐 */
function replayOn(){ return !(G.opt && G.opt.replay===false); }
function setReplay(v){
  if(!G.opt) G.opt={};
  G.opt.replay=!!v; saveGame(); show("settings");
  flash(v ? "🎬 골 장면 리플레이를 보여줍니다." : "🚫 골 리플레이를 끕니다.", "good");
}
function setEngine(e){
  if(!G.opt) G.opt={};
  G.opt.engine = (e==="text") ? "text" : "sim";
  saveGame(); show("settings");
  flash(G.opt.engine==="sim" ? "🟢 내 팀 경기가 연속 2D 매치엔진으로 진행됩니다." : "📝 기존 분 단위 엔진으로 되돌렸습니다.", "good");
}
let VIEW="home", lastMatch=null, selSwap=null, FLASH=null;
