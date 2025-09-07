// ===== Shared =====
const STORE_KEY = 'whs_rounds_v1';
const $$ = (s, r=document)=> r.querySelector(s);
const $$$ = (s, r=document)=> [...r.querySelectorAll(s)];
const round2 = n => Math.round(n*100)/100;
const round1 = n => Math.round(n*10)/10;

function loadRounds(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }catch(e){ return []; }
}

// WHS Differential (already stored per round, but recompute if needed)
function calcDifferential(ags, cr, slope, pcc=0){
  if(!isFinite(ags) || !isFinite(cr) || !isFinite(slope) || slope<=0) return null;
  return round2((113/Number(slope)) * (Number(ags) - Number(cr) - Number(pcc||0)));
}

// WHS selection table (scores < 20) or best 8 of last 20
function whsSelection(n){
  if(n <= 0) return { useN: 0, adj: 0 };
  if(n === 1 || n === 2) return { useN: n, adj: 0 }; // not publishable, but we show preview
  if(n === 3) return { useN: 1, adj: -2.0 };
  if(n === 4) return { useN: 1, adj: -1.0 };
  if(n === 5) return { useN: 1, adj:  0.0 };
  if(n === 6) return { useN: 2, adj: -1.0 };
  if(n === 7 || n === 8) return { useN: 2, adj: 0.0 };
  if(n >= 9 && n <= 11) return { useN: 3, adj: 0.0 };
  if(n >= 12 && n <= 14) return { useN: 4, adj: 0.0 };
  if(n === 15 || n === 16) return { useN: 5, adj: 0.0 };
  if(n === 17 || n === 18) return { useN: 6, adj: 0.0 };
  if(n === 19) return { useN: 7, adj: 0.0 };
  return { useN: 8, adj: 0.0 }; // 20+
}

function computeHI(rounds){
  // Sort newest → oldest already; WHS uses last 20. We’ll take up to 20 most recent.
  const last20 = rounds.slice(0, 20);
  // Collect differentials (recompute if missing)
  const diffs = last20
    .map(r => r.differential ?? calcDifferential(r.ags, r.cr, r.slope, r.pcc))
    .filter(x => x !== null)
    .sort((a,b)=> a-b); // ascending

  const n = diffs.length;
  const { useN, adj } = whsSelection(n);
  if(useN === 0) return { hi:null, usedN:0, adj, diffsUsed:[] };

  const used = diffs.slice(0, useN);
  const avg = used.reduce((a,b)=>a+b,0)/used.length;
  const hi = round1(avg + adj);
  return { hi, usedN:useN, adj, diffsUsed:used };
}

function holesPlayed(rounds){
  return rounds.reduce((sum,r)=> sum + (r.holesCount||18), 0);
}

function render(){
  const rounds = loadRounds(); // newest first
  const histBody = $$('#historyBody');
  const statusLabel = $$('#statusLabel');
  const statusNote = $$('#statusNote');
  const hiValue = $$('#hiValue');
  const chValue = $$('#chValue');
  const usedN = $$('#usedN');
  const adjNote = $$('#adjNote');
  const targetSlope = $$('#targetSlope');

  // Table
  histBody.innerHTML = '';
  rounds.forEach((r, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${idx+1}</td>
      <td>${r.date}</td>
      <td>${r.tee || '—'}</td>
      <td class="mono">${r.holesCount||18}</td>
      <td class="mono">${r.totalPar}</td>
      <td class="mono">${r.totalScore}</td>
      <td class="mono">${Number(r.cr).toFixed(1)}</td>
      <td class="mono">${Math.round(r.slope)}</td>
      <td class="mono">${r.pcc||0}</td>
      <td class="mono">${r.differential==null?'—':Number(r.differential).toFixed(2)}</td>
    `;
    histBody.appendChild(tr);
  });

  // Progress & HI
  const holes = holesPlayed(rounds);
  const have54holes = holes >= 54;
  const { hi, usedN: nUsed, adj } = computeHI(rounds);

  if(!have54holes){
    statusLabel.textContent = 'Getting Established';
    const need = 54 - holes;
    statusNote.textContent = `You need ${need} more hole${need===1?'':'s'} to reach 54. (e.g., ${Math.ceil(need/18)} × 18-hole rounds)`;
    hiValue.textContent = '—';
    chValue.textContent = '—';
    usedN.textContent = String(nUsed);
    adjNote.textContent = `Adj: ${adj.toFixed(1)}`;
  }else{
    statusLabel.textContent = 'Established (WHS)';
    statusNote.textContent = 'Your Handicap Index uses the official WHS selection table (or best 8 of 20).';
    if(hi==null){
      hiValue.textContent = '—';
      chValue.textContent = '—';
      usedN.textContent = '0';
      adjNote.textContent = 'Adj: 0.0';
    }else{
      hiValue.textContent = hi.toFixed(1);
      const slope = Number(targetSlope.value)||120;
      const ch = Math.round(hi * (slope/113));
      chValue.textContent = String(ch);
      usedN.textContent = String(nUsed);
      adjNote.textContent = `Adj: ${adj.toFixed(1)}`;
    }
  }
}

$$('#targetSlope').addEventListener('input', render);
render();
