// ===== Shared helpers / storage key =====
const STORE_KEY = 'whs_rounds_v1';

const $$ = (s, r=document)=> r.querySelector(s);
const $$$ = (s, r=document)=> [...r.querySelectorAll(s)];
const round2 = n => Math.round(n*100)/100;
const round1 = n => Math.round(n*10)/10;

function loadRounds(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }catch(e){ return []; }
}
function saveRounds(arr){
  localStorage.setItem(STORE_KEY, JSON.stringify(arr));
}

// WHS Differential: (113 / Slope) × (AGS − CR − PCC)
function calcDifferential(ags, cr, slope, pcc=0){
  if(!isFinite(ags) || !isFinite(cr) || !isFinite(slope) || slope<=0) return null;
  return round2((113/Number(slope)) * (Number(ags) - Number(cr) - Number(pcc||0)));
}

// ===== Page: index (add round) =====
if(location.pathname.endsWith('index.html') || location.pathname.endsWith('/')){
  const holesBody = $$('#holesBody');
  const holesCount = $$('#holesCount');
  const totalParEl = $$('#totalPar');
  const totalScoreEl = $$('#totalScore');
  const kpiPar = $$('#kpiPar');
  const kpiScore = $$('#kpiScore');
  const crInput = $$('#courseRating');
  const slopeInput = $$('#slopeRating');
  const pccInput = $$('#pcc');
  const previewDiff = $$('#previewDiff');
  const roundDate = $$('#roundDate');
  const teeName = $$('#teeName');
  const recentBody = $$('#recentBody');

  // init form
  roundDate.valueAsDate = new Date();

  function buildHoleRows(count){
    holesBody.innerHTML = '';
    for(let i=1;i<=count;i++){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${i}</td>
        <td><input type="number" step="1" data-hole="${i}" data-field="dist" placeholder="e.g. 380" /></td>
        <td><input type="number" step="1" data-hole="${i}" data-field="par" placeholder="3/4/5" /></td>
        <td><input type="number" step="1" data-hole="${i}" data-field="score" placeholder="e.g. 5" /></td>
      `;
      holesBody.appendChild(tr);
    }
  }

  function getTotals(){
    let par=0, score=0;
    $$$('input[data-field="par"]', holesBody).forEach(i=> { par += Number(i.value)||0; });
    $$$('input[data-field="score"]', holesBody).forEach(i=> { score += Number(i.value)||0; });
    return { par, score };
  }

  function refreshTotalsAndPreview(){
    const { par, score } = getTotals();
    totalParEl.textContent = par;
    totalScoreEl.textContent = score;
    kpiPar.textContent = par;
    kpiScore.textContent = score;

    // default CR = total par if blank; default slope=113
    const cr = crInput.value === '' ? par : Number(crInput.value);
    const slope = Number(slopeInput.value)||113;
    const pcc = Number(pccInput.value)||0;
    const diff = calcDifferential(score, cr, slope, pcc);
    previewDiff.textContent = (diff==null ? '—' : diff.toFixed(2));
  }

  function wireInputs(){
    ['input','change'].forEach(evt=>{
      holesBody.addEventListener(evt, e=>{
        if(e.target.matches('input[data-field]')) refreshTotalsAndPreview();
      });
      crInput.addEventListener(evt, refreshTotalsAndPreview);
      slopeInput.addEventListener(evt, refreshTotalsAndPreview);
      pccInput.addEventListener(evt, refreshTotalsAndPreview);
      holesCount.addEventListener(evt, e=>{
        buildHoleRows(Number(holesCount.value));
        refreshTotalsAndPreview();
      });
    });
  }

  function addRound(){
    const holes = [];
    const count = Number(holesCount.value)||18;
    for(let i=1;i<=count;i++){
      const dist = Number($$(`input[data-hole="${i}"][data-field="dist"]`, holesBody)?.value)||0;
      const par  = Number($$(`input[data-hole="${i}"][data-field="par"]`, holesBody)?.value)||0;
      const sc   = Number($$(`input[data-hole="${i}"][data-field="score"]`, holesBody)?.value)||0;
      holes.push({dist, par, score: sc});
    }
    const { par, score } = holes.reduce((acc,h)=>({par:acc.par+(h.par||0), score:acc.score+(h.score||0)}), {par:0, score:0});

    if(score<=0 || par<=0){ alert('Please enter pars and scores for your holes.'); return; }

    const cr = crInput.value === '' ? par : Number(crInput.value);
    const slope = Number(slopeInput.value)||113;
    const pcc = Number(pccInput.value)||0;
    if(!isFinite(cr) || !isFinite(slope) || slope<=0){ alert('Please provide a valid Course Rating (or leave blank) and Slope.'); return; }

    const rounds = loadRounds();
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
    const diff = calcDifferential(score, cr, slope, pcc);

    rounds.unshift({
      id,
      date: roundDate.value || new Date().toISOString().slice(0,10),
      tee: teeName.value || '',
      holes,
      holesCount: count,
      totalPar: par,
      totalScore: score,
      cr, slope, pcc,
      ags: score,        // using total score as AGS input
      differential: diff
    });
    saveRounds(rounds);
    renderRecent();
    clearForm(false);
  }

  function renderRecent(){
    const rounds = loadRounds();
    recentBody.innerHTML = '';
    rounds.slice(0,8).forEach((r, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${rounds.length - idx}</td>
        <td>${r.date}</td>
        <td>${r.tee || '—'}</td>
        <td class="mono">${r.totalPar}</td>
        <td class="mono">${r.totalScore}</td>
        <td class="mono">${r.cr.toFixed(1)}</td>
        <td class="mono">${Math.round(r.slope)}</td>
        <td class="mono">${r.pcc}</td>
        <td class="mono">${r.differential==null?'—':r.differential.toFixed(2)}</td>
        <td><button class="delete-btn" data-del="${r.id}">Delete</button></td>
      `;
      recentBody.appendChild(tr);
    });
    $$$('button[data-del]').forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute('data-del');
        const arr = loadRounds().filter(r=>r.id !== id);
        saveRounds(arr);
        renderRecent();
      };
    });
  }

  function clearForm(resetCR=true){
    $$$('input[data-field]', holesBody).forEach(i=> i.value = '');
    if(resetCR){ crInput.value = ''; slopeInput.value = '113'; pccInput.value = '0'; }
    teeName.value = '';
    refreshTotalsAndPreview();
  }

  // bootstrap
  buildHoleRows(Number(holesCount.value));
  wireInputs();
  refreshTotalsAndPreview();
  renderRecent();

  // buttons
  $$('#saveRound').addEventListener('click', addRound);
  $$('#clearForm').addEventListener('click', ()=> clearForm());
      }
