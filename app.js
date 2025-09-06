// ---- Helpers -------------------------------------------------------------
const $$ = (sel, root=document) => root.querySelector(sel);
const $$$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const round2 = x => Math.round(x * 100) / 100;
const round1 = x => Math.round(x * 10) / 10;
const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.floor(Number(v)||0)));
const fmtNum = (n, dp=1) => (!Number.isFinite(n) ? '—' : (dp===0 ? Math.round(n).toString() : Number(n).toFixed(dp)));

// ---- App State -----------------------------------------------------------
const state = {
  rounds: [],               // { id, ags, cr, slope, diff }
  selectedId: null,
  useCount: 1,
  bonus: 0.96,
  targetSlope: 120
};

// Load from localStorage
(function load(){
  try{
    const raw = localStorage.getItem('golf_hcp_state_v1');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved.rounds)) state.rounds = saved.rounds;
      if(Number.isFinite(saved.useCount)) state.useCount = saved.useCount;
      if(Number.isFinite(saved.bonus)) state.bonus = saved.bonus;
      if(Number.isFinite(saved.targetSlope)) state.targetSlope = saved.targetSlope;
    }
  }catch(e){ console.warn('No saved data'); }
})();

function persist(){
  localStorage.setItem('golf_hcp_state_v1', JSON.stringify({
    rounds: state.rounds,
    useCount: state.useCount,
    bonus: state.bonus,
    targetSlope: state.targetSlope
  }));
}

// ---- Calculation ---------------------------------------------------------
function calcDifferential(ags, cr, slope){
  if(!isFinite(ags) || !isFinite(cr) || !isFinite(slope) || slope <= 0) return null;
  return round2(((ags - cr) * 113) / slope);
}

// ---- Rendering -----------------------------------------------------------
function render(){
  // Inputs
  $$('#useCount').value = state.useCount;
  $$('#bonus').value = state.bonus;
  $$('#targetSlope').value = state.targetSlope;
  $$('#countLabel').textContent = state.rounds.length;
  $$('#bonusLabel').textContent = Number(state.bonus).toFixed(2);

  // Sorted differentials
  const diffs = state.rounds
    .map((r, idx)=> ({ idx, id:r.id, diff:r.diff }))
    .filter(d => d.diff !== null)
    .sort((a,b)=> a.diff - b.diff);

  const useN = Math.min(state.useCount, diffs.length);
  const selectedIds = new Set(diffs.slice(0, useN).map(d => d.id));

  // Table
  const tbody = $$('#tbody');
  tbody.innerHTML = '';
  state.rounds.forEach((r, i) => {
    const tr = document.createElement('tr');
    if(selectedIds.has(r.id)) tr.classList.add('selectedRow');
    tr.innerHTML = `
      <td class="mono">${i+1}</td>
      <td class="mono">${fmtNum(r.ags)}</td>
      <td class="mono">${fmtNum(r.cr)}</td>
      <td class="mono">${fmtNum(r.slope,0)}</td>
      <td class="mono">${r.diff===null ? '—' : r.diff.toFixed(2)}</td>
      <td>
        <div class="row" style="gap:6px">
          <button class="secondary" data-edit="${r.id}">Edit</button>
          <button class="danger" data-del="${r.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // KPIs
  $$('#usedN').textContent = useN;

  let hi = null, ch = null;
  if(useN > 0){
    const used = diffs.slice(0, useN).map(d => d.diff);
    const avg = used.reduce((a,b)=>a+b,0) / used.length;
    const hiRaw = avg * state.bonus;
    hi = round1(hiRaw);
    if(isFinite(state.targetSlope) && state.targetSlope > 0){
      ch = Math.round(hi * (state.targetSlope / 113));
    }
  }
  $$('#handicapIdx').textContent = hi===null ? '—' : hi.toFixed(1);
  $$('#courseHcp').textContent = ch===null ? '—' : ch.toString();

  // Row actions
  $$$('button[data-edit]').forEach(btn=>{
    btn.onclick = () => startEdit(btn.getAttribute('data-edit'));
  });
  $$$('button[data-del]').forEach(btn=>{
    btn.onclick = () => delRound(btn.getAttribute('data-del'));
  });

  persist();
}

// ---- CRUD ---------------------------------------------------------------
function addRound(ags, cr, slope){
  const diff = calcDifferential(ags, cr, slope);
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  state.rounds.push({ id, ags:Number(ags), cr:Number(cr), slope:Number(slope), diff });
  render();
}

function startEdit(id){
  const r = state.rounds.find(x=>x.id===id);
  if(!r) return;
  state.selectedId = id;
  $$('#ags').value = r.ags;
  $$('#cr').value = r.cr;
  $$('#slope').value = r.slope;
  $$('#updateBtn').disabled = false;
  $$('#addBtn').disabled = true;
}

function updateSelected(ags, cr, slope){
  const id = state.selectedId;
  const idx = state.rounds.findIndex(r=>r.id===id);
  if(idx === -1) return;
  const diff = calcDifferential(ags, cr, slope);
  state.rounds[idx] = { id, ags:Number(ags), cr:Number(cr), slope:Number(slope), diff };
  state.selectedId = null;
  $$('#updateBtn').disabled = true;
  $$('#addBtn').disabled = false;
  clearForm();
  render();
}

function delRound(id){
  state.rounds = state.rounds.filter(r=>r.id!==id);
  if(state.selectedId === id){
    state.selectedId = null;
    $$('#updateBtn').disabled = true;
    $$('#addBtn').disabled = false;
    clearForm();
  }
  render();
}

function clearForm(){
  $$('#ags').value = '';
  $$('#cr').value = '';
  $$('#slope').value = '';
}

// ---- Event Wiring -------------------------------------------------------
$$('#addBtn').onclick = () => {
  const ags = Number($$('#ags').value);
  const cr = Number($$('#cr').value);
  const slope = Number($$('#slope').value);
  if(!isFinite(ags) || !isFinite(cr) || !isFinite(slope) || slope<=0){
    alert('Please enter valid numbers.'); return;
  }
  addRound(ags, cr, slope);
  clearForm();
};

$$('#updateBtn').onclick = () => {
  const ags = Number($$('#ags').value);
  const cr = Number($$('#cr').value);
  const slope = Number($$('#slope').value);
  if(!isFinite(ags) || !isFinite(cr) || !isFinite(slope) || slope<=0){
    alert('Please enter valid numbers.'); return;
  }
  updateSelected(ags, cr, slope);
};

$$('#clearFormBtn').onclick = clearForm;

$$('#useCount').addEventListener('input', e=>{
  const n = clampInt(e.target.value, 1, 50);
  state.useCount = n; render();
});
$$('#bonus').addEventListener('input', e=>{
  const b = Number(e.target.value);
  state.bonus = (isFinite(b) && b>=0) ? b : 0.96; render();
});
$$('#targetSlope').addEventListener('input', e=>{
  const s = Number(e.target.value);
  state.targetSlope = (isFinite(s) && s>0) ? s : 120; render();
});

$$('#resetSettings').onclick = ()=>{
  state.useCount = 1; state.bonus = 0.96; state.targetSlope = 120; render();
};

$$('#clearAllBtn').onclick = ()=>{
  if(confirm('Delete all rounds? This cannot be undone.')){ state.rounds = []; render(); }
};

$$('#exportBtn').onclick = ()=>{
  const data = JSON.stringify({ rounds: state.rounds, settings:{useCount:state.useCount, bonus:state.bonus, targetSlope:state.targetSlope} }, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'handicap_data.json'; a.click();
  URL.revokeObjectURL(url);
};

$$('#importBtn').onclick = async ()=>{
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0]; if(!file) return;
    try{
      const text = await file.text();
      const parsed = JSON.parse(text);
      if(Array.isArray(parsed.rounds)){
        state.rounds = parsed.rounds.map(r => ({
          id: r.id || (crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),
          ags: Number(r.ags), cr: Number(r.cr), slope: Number(r.slope),
          diff: calcDifferential(Number(r.ags), Number(r.cr), Number(r.slope))
        }));
      }
      if(parsed.settings){
        if(Number.isFinite(parsed.settings.useCount)) state.useCount = parsed.settings.useCount;
        if(Number.isFinite(parsed.settings.bonus)) state.bonus = parsed.settings.bonus;
        if(Number.isFinite(parsed.settings.targetSlope)) state.targetSlope = parsed.settings.targetSlope;
      }
      render();
    }catch(err){
      alert('Invalid JSON file.');
    }
  };
  input.click();
};

$$('#loadExample').onclick = ()=>{
  state.rounds = [
    { id:'e1', ags:95, cr:72.0, slope:120, diff: calcDifferential(95,72.0,120) },
    { id:'e2', ags:88, cr:71.0, slope:113, diff: calcDifferential(88,71.0,113) },
    { id:'e3', ags:102, cr:73.0, slope:130, diff: calcDifferential(102,73.0,130) },
  ];
  state.useCount = 1; state.bonus = 0.96; state.targetSlope = 120;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Initial render
render();
