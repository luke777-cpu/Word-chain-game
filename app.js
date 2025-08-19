(() => {
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));

  const startBtn=$("#startBtn"), resetBtn=$("#resetBtn"), difficultySel=$("#difficulty");
  const modeRadios=$$("input[name='mode']);
  const turnSecondsInput=$("#turnSeconds"), pointsToWinInput=$("#pointsToWin"), maxPassInput=$("#maxPass");

  const dictStatus=$("#dictStatus"), dictFile=$("#dictFile"), loadFileBtn=$("#loadFileBtn");
  const dictUrlInput=$("#dictUrl"), loadUrlBtn=$("#loadUrlBtn");
  const saveDictBtn=$("#saveDictBtn"), clearSavedDictBtn=$("#clearSavedDictBtn");

  const allowProperNouns=$("#allowProperNouns"), minLenInput=$("#minLen"), bannedLastCharsInput=$("#bannedLastChars");
  const showHints=$("#showHints");

  const turnLabel=$("#turnLabel"), requiredCharEl=$("#requiredChar"), timerEl=$("#timer");
  const scoreP1El=$("#scoreP1"), scoreP2El=$("#scoreP2"), passLeftEl=$("#passLeft");
  const hintLine=$("#hintLine"), hintCountEl=$("#hintCount");

  const wordInput=$("#wordInput"), submitBtn=$("#submitBtn"), passBtn=$("#passBtn"), surrenderBtn=$("#surrenderBtn");
  const messageEl=$("#message"), usedList=$("#usedList");

  let DICT_SET=new Set(), BY_FIRST_CHAR=new Map(), BY_LAST_CHAR_COUNT=new Map();
  let used=new Set(), history=[], requiredStart="", turn=0, mode="ai", running=false, timer=null;
  let passesLeft=0, scores=[0,0];
  const HANGUL_RE=/^[가-힣]+$/;

  const showMessage=(m,t="info")=>{messageEl.textContent=m; messageEl.style.color=(t==="error"?"#ff8585":t==="success"?"#a7f3d0":"#e6edf3");};
  const updateDictStatus=()=>{dictStatus.textContent=`로딩된 단어: ${DICT_SET.size.toLocaleString()}개`;};
  const sanitize=(w)=> (w||"").trim();
  const isHangul=(w)=> HANGUL_RE.test(w);
  const first=(w)=> w[0], last=(w)=> w[w.length-1];

  function addToIndex(w){ const f=first(w); if(!BY_FIRST_CHAR.has(f)) BY_FIRST_CHAR.set(f, []); BY_FIRST_CHAR.get(f).push(w); }
  function buildIndexes(){
    BY_FIRST_CHAR.clear(); BY_LAST_CHAR_COUNT.clear();
    for(const w of DICT_SET) addToIndex(w);
    for(const w of DICT_SET){ const l=last(w); const c=(BY_FIRST_CHAR.get(l)||[]).length; BY_LAST_CHAR_COUNT.set(l,c); }
  }

  async function loadDictFromText(text){
    const lines=text.split(/\r?\n/); const next=new Set(); const minLen=Number(minLenInput.value||2);
    for(let line of lines){ const w=sanitize(line); if(!w||!isHangul(w)) continue; if(w.length<minLen) continue; next.add(w); }
    DICT_SET=next; buildIndexes(); updateDictStatus(); showMessage("사전 로드 완료!","success");
  }

  loadFileBtn.addEventListener("click", async()=>{
    const f=dictFile.files?.[0]; if(!f){showMessage("사전 파일을 선택하세요.","error"); return;}
    const text=await f.text(); await loadDictFromText(text);
  });
  loadUrlBtn.addEventListener("click", async()=>{
    const url=dictUrlInput.value.trim(); if(!url){showMessage("사전 URL/경로를 입력하세요.","error"); return;}
    try{ const res=await fetch(url,{cache:"no-store"}); if(!res.ok) throw new Error(res.status); const text=await res.text(); await loadDictFromText(text); }
    catch(e){ console.error(e); showMessage("사전 URL 로드 실패(CORS/경로 확인).","error"); }
  });
  saveDictBtn.addEventListener("click", ()=>{
    try{ const words=Array.from(DICT_SET); const chunk=20000;
      localStorage.setItem("dict_chunks", String(Math.ceil(words.length/chunk)));
      for(let i=0,j=0;i<words.length;i+=chunk,j++){ localStorage.setItem(`dict_${j}`, JSON.stringify(words.slice(i,i+chunk))); }
      showMessage("사전 저장 완료(localStorage).","success");
    }catch(e){ console.error(e); showMessage("사전 저장 실패(브라우저 용량 제한).","error"); }
  });
  clearSavedDictBtn.addEventListener("click", ()=>{
    const n=Number(localStorage.getItem("dict_chunks")||0);
    for(let j=0;j<n;j++) localStorage.removeItem(`dict_${j}`);
    localStorage.removeItem("dict_chunks"); showMessage("저장된 사전을 삭제했습니다.");
  });
  function tryLoadSavedDict(){
    const n=Number(localStorage.getItem("dict_chunks")||0); if(!n) return false;
    const arr=[]; for(let j=0;j<n;j++){ try{ arr.push(...JSON.parse(localStorage.getItem(`dict_${j}`)||"[]")); }catch{} }
    if(arr.length){ DICT_SET=new Set(arr); buildIndexes(); updateDictStatus(); showMessage("저장된 사전을 불러왔습니다."); return true; }
    return false;
  }
  async function loadBuiltIn(){ const r=await fetch("words_small.txt"); const t=await r.text(); await loadDictFromText(t); }

  function renderUsed(){ usedList.innerHTML=""; for(const w of history){ const d=document.createElement("div"); d.className="chip"; d.textContent=w; usedList.appendChild(d); } }
  function updateHint(){
    if(!showHints.checked||!requiredStart){ hintLine.classList.add("hidden"); return; }
    const list=BY_FIRST_CHAR.get(requiredStart)||[]; const remain=list.filter(w=>!used.has(w));
    hintCountEl.textContent=String(remain.length); hintLine.classList.remove("hidden");
  }
  function setRequiredFrom(w){ requiredStart=last(w); requiredCharEl.textContent=requiredStart; updateHint(); }
  function currentMode(){ const r=modeRadios.find(r=>r.checked); return r?.value||"ai"; }

  function resetGame(hard=false){
    used.clear(); history=[]; requiredStart=""; renderUsed();
    requiredCharEl.textContent="-"; turnLabel.textContent="-"; timerEl.textContent="-";
    clearInterval(timer); timer=null; messageEl.textContent=""; running=false;
    passesLeft=Number(maxPassInput.value||0); passLeftEl.textContent=String(passesLeft);
    if(hard){ scores=[0,0]; scoreP1El.textContent="0"; scoreP2El.textContent="0"; }
    wordInput.disabled=false; submitBtn.disabled=false; passBtn.disabled=false;
  }

  // 🔧 시간초과 → 즉시 패배 처리
  function startTimer(){
    clearInterval(timer);
    let left=Number(turnSecondsInput.value||0);
    if(!left){ timerEl.textContent="무제한"; return; }
    timerEl.textContent=String(left);
    timer=setInterval(()=>{
      left--; timerEl.textContent=String(left);
      if(left<=0){
        clearInterval(timer); timer=null;
        const loser = (turn===0) ? "플레이어 1" : (mode==="ai" ? "AI" : "플레이어 2");
        endGame(loser);
      }
    },1000);
  }

  function nextTurn(){ turn=(turn+1)%2; turnLabel.textContent=(turn===0)?"플레이어 1":(mode==="ai"?"AI":"플레이어 2"); }
  const bannedList=()=> bannedLastCharsInput.value.split(",").map(s=>s.trim()).filter(Boolean);

  function canUse(w){
    if(!w) return false; if(!isHangul(w)) return false;
    const minLen=Number(minLenInput.value||2); if(w.length<minLen) return false;
    if(used.has(w)) return false; if(requiredStart && first(w)!==requiredStart) return false;
    const b=bannedList(); if(b.length && b.includes(last(w))) return false;
    if(!allowProperNouns.checked && !DICT_SET.has(w)) return false;
    return true;
  }

  function commitWord(w){
    used.add(w); history.push(w); renderUsed(); setRequiredFrom(w);
    scores[turn] += 1; scoreP1El.textContent=String(scores[0]); scoreP2El.textContent=String(scores[1]);
    const goal=Number(pointsToWinInput.value||10);
    if(scores[turn] >= goal){ endMatch(turn===0?"플레이어 1":(mode==="ai"?"AI":"플레이어 2")); }
  }
  function endMatch(w){ running=false; clearInterval(timer); timer=null; showMessage(`승리! → ${w}가 목표 점수에 도달했습니다.`,"success"); wordInput.disabled=true; submitBtn.disabled=true; passBtn.disabled=true; }
  function endGame(loser){ running=false; clearInterval(timer); timer=null; const winner=(loser==="플레이어 1")?(mode==="ai"?"AI":"플레이어 2"):"플레이어 1"; showMessage(`${loser} 패배! → 승자: ${winner}`,"success"); wordInput.disabled=true; submitBtn.disabled=true; passBtn.disabled=true; }

  function pickAIWord(){
    if(!requiredStart){ const arr=Array.from(DICT_SET); for(let i=0;i<200;i++){ const w=arr[Math.floor(Math.random()*arr.length)]; if(!used.has(w)) return w; } return null; }
    const cands=(BY_FIRST_CHAR.get(requiredStart)||[]).filter(w=>!used.has(w)); if(!cands.length) return null;
    const diff=difficultySel.value;
    if(diff==="easy") return cands[Math.floor(Math.random()*cands.length)];
    if(diff==="normal"){
      const scored=cands.map(w=>{ const next=(BY_FIRST_CHAR.get(last(w))||[]).filter(n=>!used.has(n)).length; return {w,score:w.length-0.01*next+Math.random()*0.1}; });
      scored.sort((a,b)=>b.score-a.score); const top=scored.slice(0,Math.max(1,Math.floor(scored.length*0.2))); return top[Math.floor(Math.random()*top.length)].w;
    }else{
      const scored=cands.map(w=>{ const next=(BY_FIRST_CHAR.get(last(w))||[]).filter(n=>!used.has(n)).length; return {w,score:-next + w.length*0.001 + Math.random()*0.01}; });
      scored.sort((a,b)=>b.score-a.score); return scored[0].w;
    }
  }
  function aiMove(){
    if(!running) return;
    setTimeout(()=>{
      const w=pickAIWord();
      if(!w){ endGame("AI"); return; }
      commitWord(w); showMessage(`AI: ${w}`);
      nextTurn(); startTimer(); wordInput.disabled=false; submitBtn.disabled=false; passBtn.disabled=false; updateHint();
    },400);
  }

  function startGame(){
    if(DICT_SET.size<10 && !allowProperNouns.checked){ showMessage("사전을 먼저 로드하세요. (또는 고유명사 허용 체크)","error"); return; }
    resetGame(true); running=true; mode=currentMode(); turn=Math.random()<0.5?0:1;
    turnLabel.textContent=(turn===0)?"플레이어 1":(mode==="ai"?"AI":"플레이어 2");
    requiredStart=""; requiredCharEl.textContent="-"; passesLeft=Number(maxPassInput.value||0); passLeftEl.textContent=String(passesLeft);
    showMessage("게임 시작!"); startTimer();
    if(mode==="ai"&&turn===1){ wordInput.disabled=true; submitBtn.disabled=true; passBtn.disabled=true; aiMove(); }
    updateHint();
  }
  function handleSubmit(){
    if(!running) return; const w=sanitize(wordInput.value);
    if(!canUse(w)){ showMessage("단어가 유효하지 않습니다. (한글/사전/중복/시작글자/끝글자 제한)","error"); return; }
    wordInput.value=""; commitWord(w); nextTurn(); startTimer(); updateHint();
    if(mode==="ai"&&turn===1){ wordInput.disabled=true; submitBtn.disabled=true; passBtn.disabled=true; aiMove(); }
  }
  function handlePass(){ if(!running) return; if(passesLeft<=0){ showMessage("남은 패스가 없습니다.","error"); return; } passesLeft-=1; passLeftEl.textContent=String(passesLeft); showMessage("패스!"); nextTurn(); startTimer(); if(mode==="ai"&&turn===1){ wordInput.disabled=true; submitBtn.disabled=true; passBtn.disabled=true; aiMove(); } }
  function handleSurrender(){ if(!running) return; const loser=(turn===0)?"플레이어 1":(mode==="ai"?"AI":"플레이어 2"); endGame(loser); }

  startBtn.addEventListener("click", startGame);
  resetBtn.addEventListener("click", ()=>resetGame(true));
  submitBtn.addEventListener("click", handleSubmit);
  passBtn.addEventListener("click", handlePass);
  surrenderBtn.addEventListener("click", handleSurrender);
  wordInput.addEventListener("keydown", e=>{ if(e.key==="Enter") handleSubmit(); });
  showHints.addEventListener("change", updateHint);

  (async function init(){ if(!tryLoadSavedDict()){ await loadBuiltIn(); } })();
})();
