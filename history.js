// ===== DOM Helpers & State (shared store key) =====
const el = id => document.getElementById(id);
const HISTORY_KEY = 'golf-history-v4';

// Drawer (history page navigation)
const $burger = el('burger');
const $drawer = el('drawer');
const $drawerLinks = document.querySelectorAll('.drawer-link');

function openDrawer(open) {
  $drawer.classList.toggle('open', open);
  $drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  $burger.setAttribute('aria-expanded', open ? 'true' : 'false');
}
$burger.addEventListener('click', () => openDrawer(!$drawer.classList.contains('open')));
$drawerLinks.forEach(btn => btn.addEventListener('click', () => {
  const route = btn.dataset.route;
  if (route === 'scorecard') {
    location.href = 'index.html#scorecard';
  } else {
    // stay on history, switch hash internally
    const hash = btn.dataset.hash || route;
    location.hash = `#${hash}`;
    // scroll to HI if requested
    if (btn.dataset.hash === 'hi') setTimeout(()=> el('hiAnchor')?.scrollIntoView({behavior:'smooth'}), 30);
  }
  openDrawer(false);
}));

// ===== Elements =====
const $filterHistoryPlayer = el('filterHistoryPlayer');
const $historyList = el('historyList');
const $scoresChart = el('scoresChart');

const $playerProfileSelect = el('playerProfileSelect');
const $playerProfile = el('playerProfile');

const $courseLeaderboardSelect = el('courseLeaderboardSelect');
const $courseParInfo = el('courseParInfo');
const $courseLeaderboardTable = el('courseLeaderboardTable');
const $btnBest9 = el('btnBest9');
const $btnBest18 = el('btnBest18');
let leaderboardMode = '9';

// WHS KPIs
const $hiStatus = el('hiStatus');
const $hiStatusNote = el('hiStatusNote');
const $hiValue = el('hiValue');
const $chValue = el('chValue');
const $usedN = el('usedN');
const $adjNote = el('adjNote');
const $targetSlopeHistory = el('targetSlopeHistory');

// ===== Storage =====
function loadHistory(){ return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }

// ===== Utilities =====
const round2 = n => Math.round(n*100)/100;
const round1 = n => Math.round(n*10)/10;

// WHS Differential (recompute if needed)
function whsDifferential(ags, cr, slope, pcc=0){
  if(!Number.isFinite(ags)||!Number.isFinite(cr)||!Number.isFinite(slope)||slope<=0) return null;
  return round2((113/slope)*(ags-cr-(pcc||0)));
}

// WHS table for <20, else best 8 of 20
function whsSelection(n){
  if (n <= 0) return { useN: 0, adj: 0 };
  if (n === 1 || n === 2) return { useN: n, adj: 0 };
  if (n === 3) return { useN: 1, adj: -2.0 };
  if (n === 4) return { useN: 1, adj: -1.0 };
  if (n === 5) return { useN: 1, adj: 0.0 };
  if (n === 6) return { useN: 2, adj: -1.0 };
  if (n === 7 || n === 8) return { useN: 2, adj: 0.0 };
  if (n >= 9 && n <= 11) return { useN: 3, adj: 0.0 };
  if (n >= 12 && n <= 14) return { useN: 4, adj: 0.0 };
  if (n === 15 || n === 16) return { useN: 5, adj: 0.0 };
  if (n === 17 || n === 18) return { useN: 6, adj: 0.0 };
  if (n === 19) return { useN: 7, adj: 0.0 };
  return { useN: 8, adj: 0.0 };
}

// Compute HI for a single player
function computePlayerHI(player, rounds, targetSlope){
  const items = rounds.filter(r => r && r.scores && r.scores[player]);
  items.sort((a,b)=> new Date(a.ts) - new Date(b.ts));
  const last20 = items.slice(-20);

  const diffs = last20
    .map(r=>{
      const ags = (r.scores[player]||[]).slice(0,r.holes||0).reduce((a,b)=>a+(+b||0),0);
      const cr = Number.isFinite(r.cr) ? r.cr : (r.par||[]).slice(0,r.holes||0).reduce((a,b)=>a+(+b||0),0);
      const slope = Number.isFinite(r.slope) ? r.slope : 113;
      const pcc = Number.isFinite(r.pcc) ? r.pcc : 0;
      return whsDifferential(ags, cr, slope, pcc);
    })
    .filter(x=>x!==null)
    .sort((a,b)=>a-b);

  const n = diffs.length;
  const { useN, adj } = whsSelection(n);
  if(useN===0) return { hi:null, usedN:0, adj, holes:0, courseHcp:null };

  const used = diffs.slice(0,useN);
  const avg = used.reduce((a,b)=>a+b,0)/used.length;
  const hi = round1(avg + adj);
  const holes = items.reduce((sum,r)=>sum + (r.holes||0), 0);
  const ch = Math.round(hi * ((Number(targetSlope)||120)/113));
  return { hi, usedN:useN, adj, holes, courseHcp:ch };
}

// ===== HISTORY RENDER =====
function renderHistory() {
  const hist = loadHistory();
  // Build players list for filter/profile selects
  const allPlayers = Array.from(new Set(hist.flatMap(h => Object.keys(h.scores || {})))).sort();
  $filterHistoryPlayer.innerHTML = '<option value="__all__">All</option>' + allPlayers.map(p=>`<option value="${p}">${p}</option>`).join('');
  $playerProfileSelect.innerHTML = '<option value="__none__">Select...</option>' + allPlayers.map(p=>`<option value="${p}">${p}</option>`).join('');

  const filter = $filterHistoryPlayer.value;
  const list = hist.filter(m => filter === '__all__' || Object.keys(m.scores).includes(filter));

  $historyList.innerHTML = list.map(m => {
    const date = new Date(m.ts).toLocaleString();
    const totals = Object.entries(m.scores)
      .map(([p, sc]) => `${p}: ${sc.reduce((a, b) => a + (+b || 0), 0)}`).join(', ');
    const hid = `h_${m.id}`;
    return `
      <div class="history-item">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div><strong>${m.course || 'Course'}</strong> • ${date} • ${m.holes} holes</div>
          <button class="btn" data-expand="${hid}">View Details</button>
        </div>
        <div class="muted" style="margin-top:6px">${totals}</div>
        <div id="${hid}" class="table-wrap" style="display:none;margin-top:8px;"></div>
      </div>
    `;
  }).join('');

  // expand rows
  $historyList.querySelectorAll('button[data-expand]').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.dataset.expand;
      const host = document.getElementById(id);
      const m = list.find(x => `h_${x.id}` === id);
      if (!m) return;
      if (host.dataset.loaded === '1') { host.style.display = host.style.display === 'none' ? 'block' : 'none'; return; }
      let thead = '<tr><th class="left">Row</th>';
      for (let i = 1; i <= m.holes; i++) thead += `<th>H${i}</th>`;
      thead += '<th>Total</th></tr>';

      const parTotal = m.par.slice(0, m.holes).reduce((a,b)=>a+(+b||0),0);
      const parCells = m.par.slice(0, m.holes).map(v=>`<td>${v}</td>`).join('');
      let tbody = `<tr><td class="left">Par</td>${parCells}<td>${parTotal}</td></tr>`;

      Object.entries(m.scores).forEach(([p, arr])=>{
        const cells = arr.slice(0,m.holes).map(v=>`<td>${v}</td>`).join('');
        const total = arr.slice(0,m.holes).reduce((a,b)=>a+(+b||0),0);
        tbody += `<tr><td class="left">${p}</td>${cells}<td>${total}</td></tr>`;
      });

      host.innerHTML = `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
      host.dataset.loaded = '1';
      host.style.display = 'block';
    };
  });

  drawChart(list, filter);
  renderHI(); // update handicap KPIs
  renderPlayerProfile(); // default profile area
  rebuildCourseOptions(); // leaderboard courses
  renderCourseLeaderboard(); // leaderboard table
}

// Chart
function drawChart(list, filter) {
  const ctx = $scoresChart.getContext('2d');
  ctx.clearRect(0, 0, $scoresChart.width, $scoresChart.height);
  if (!list.length) { ctx.fillStyle = '#9aa3b2'; ctx.fillText('No history yet', 20, 28); return; }

  const data = [];
  list.forEach(m => {
    Object.entries(m.scores).forEach(([p, sc]) => {
      if (filter === '__all__' || filter === p) {
        data.push({ player: p, t: new Date(m.ts).getTime(), y: sc.reduce((a, b) => a + (+b || 0), 0) });
      }
    });
  });
  data.sort((a, b) => a.t - b.t);

  const playersSet = [...new Set(data.map(d => d.player))];
  const pad = 40, W = $scoresChart.width, H = $scoresChart.height;
  const xmin = Math.min(...data.map(d => d.t)), xmax = Math.max(...data.map(d => d.t));
  const ymin = Math.min(...data.map(d => d.y)), ymax = Math.max(...data.map(d => d.y));
  const xscale = x => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
  const yscale = y => H - pad - ((y - ymin) / (ymax - ymin || 1)) * (H - 2 * pad);

  // axes + grid
  ctx.strokeStyle = '#7b8bb2'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
  ctx.fillStyle = '#7b8bb2'; ctx.font = '12px system-ui, sans-serif';
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const y = ymin + (i * (ymax - ymin) / steps);
    const yy = yscale(y);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(W - pad, yy); ctx.stroke();
    ctx.fillText(Math.round(y), 6, yy + 4);
  }

  // series
  const colors = ['#7c9cff', '#4cc38a', '#ff6b6b', '#ffa500', '#b07cff', '#4dd0e1'];
  playersSet.forEach((pl, i) => {
    const pts = data.filter(d => d.player === pl);
    ctx.beginPath(); ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 2;
    pts.forEach((pt, j) => {
      const xx = xscale(pt.t), yy = yscale(pt.y);
      if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    ctx.fillStyle = colors[i % colors.length];
    pts.forEach(pt => { const xx = xscale(pt.t), yy = yscale(pt.y); ctx.fillRect(xx - 2, yy - 2, 4, 4); });
    ctx.fillText(pl, W - 120, 24 + 16 * i);
  });
}

// ===== Handicap KPIs =====
function renderHI(){
  const hist = loadHistory();
  // pick selected player or first seen
  let player = $filterHistoryPlayer?.value;
  if (!player || player === '__all__') {
    outer: for (const r of hist) {
      for (const p of Object.keys(r.scores || {})) { player = p; break outer; }
    }
  }
  if(!player){
    if ($hiStatus) $hiStatus.textContent = 'No Rounds';
    if ($hiStatusNote) $hiStatusNote.textContent = 'Save some rounds to compute a handicap.';
    if ($hiValue) $hiValue.textContent = '—';
    if ($chValue) $chValue.textContent = '—';
    if ($usedN) $usedN.textContent = '0';
    if ($adjNote) $adjNote.textContent = 'Adj: 0.0';
    return;
  }
  const tgtSlope = Number($targetSlopeHistory?.value)||120;
  const { hi, usedN, adj, holes, courseHcp } = computePlayerHI(player, hist, tgtSlope);
  const established = holes >= 54;

  if ($hiStatus) $hiStatus.textContent = established ? 'Established (WHS)' : 'Getting Established';
  if ($hiStatusNote) $hiStatusNote.textContent = established
    ? 'Index uses WHS table (or best 8 of last 20).'
    : `You need ${Math.max(0,54-holes)} more hole${(54-holes)===1?'':'s'} to reach 54.`;
  if ($hiValue) $hiValue.textContent = (established && hi!==null) ? hi.toFixed(1) : '—';
  if ($chValue) $chValue.textContent = (established && Number.isFinite(courseHcp)) ? String(courseHcp) : '—';
  if ($usedN) $usedN.textContent = String(usedN || 0);
  if ($adjNote) $adjNote.textContent = `Adj: ${(adj||0).toFixed(1)}`;
}

// ===== Player Profiles =====
function renderPlayerProfile() {
  const hist = loadHistory();
  const selected = $playerProfileSelect.value;
  if (selected === '__none__') { $playerProfile.innerHTML = '<div class="muted">Select a player to view history.</div>'; return; }
  const games = hist.filter(m => Object.keys(m.scores).includes(selected));
  if (!games.length) { $playerProfile.innerHTML = '<div class="muted">No games for this player.</div>'; return; }

  // Group by course
  const byCourse = {};
  games.forEach(g => {
    const course = g.course || '(Unknown Course)';
    if (!byCourse[course]) byCourse[course] = [];
    byCourse[course].push(g);
  });

  // Best 9 / 18 overall
  let best9 = null, best18 = null;
  games.forEach(g => {
    const total = g.scores[selected].reduce((a, b) => a + (+b || 0), 0);
    if (g.holes === 9)  best9  = (best9  === null || total < best9 ) ? total : best9;
    if (g.holes === 18) best18 = (best18 === null || total < best18) ? total : best18;
  });

  let html = `<h4>${selected}</h4>`;
  html += `<div class="table-wrap" style="margin-bottom:10px"><table><thead><tr><th>Best 9</th><th>Best 18</th></tr></thead><tbody>`;
  html += `<tr><td>${best9 ?? '—'}</td><td>${best18 ?? '—'}</td></tr></tbody></table></div>`;

  // Per-course sections
  Object.entries(byCourse).sort(([a],[b]) => a.localeCompare(b)).forEach(([course, rounds]) => {
    rounds.sort((a,b)=> a.ts.localeCompare(b.ts));
    html += `<h4 style="margin-top:12px;">${course}</h4>`;
    html += `<div class="table-wrap"><table><thead><tr><th class="left">Date</th><th>Holes</th><th>Total</th><th>Details</th></tr></thead><tbody>`;
    rounds.forEach(r => {
      const total = r.scores[selected].reduce((x, y) => x + (+y || 0), 0);
      const rowId = `p_${selected.replace(/\s+/g,'_')}_${r.id}`;
      html += `<tr>
        <td class="left">${new Date(r.ts).toLocaleDateString()}</td>
        <td>${r.holes}</td>
        <td>${total}</td>
        <td><button class="btn" data-pholes="${rowId}">View holes</button></td>
      </tr>
      <tr id="${rowId}" style="display:none;"><td colspan="4" class="left">
        <strong>Par:</strong> ${r.par.slice(0,r.holes).join(', ')}<br/>
        <strong>Scores:</strong> ${r.scores[selected].slice(0,r.holes).join(', ')}
      </td></tr>`;
    });
    html += `</tbody></table></div>`;
  });

  $playerProfile.innerHTML = html;

  $playerProfile.querySelectorAll('button[data-pholes]').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.dataset.pholes;
      const row = document.getElementById(id);
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    };
  });
}

// ===== COURSE LEADERBOARD =====
function rebuildCourseOptions() {
  const hist = loadHistory();
  const courses = [...new Set(hist.map(h => h.course).filter(Boolean))].sort();
  $courseLeaderboardSelect.innerHTML = '<option value="__none__">Select a course...</option>' +
    courses.map(c => `<option value="${c}">${c}</option>`).join('');
}
function renderCourseLeaderboard() {
  const course = $courseLeaderboardSelect.value;
  if (course === '__none__') { $courseParInfo.innerHTML = ''; $courseLeaderboardTable.innerHTML = ''; return; }
  const hist = loadHistory().filter(h => h.course === course);
  if (!hist.length) { $courseParInfo.innerHTML = 'No data'; $courseLeaderboardTable.innerHTML = ''; return; }

  const latest = hist[hist.length - 1];
  const parFront9 = latest.par.slice(0, 9).reduce((a, b) => a + (+b || 0), 0);
  const par18 = latest.par.slice(0, Math.min(18, latest.par.length)).reduce((a, b) => a + (+b || 0), 0);
  const has18 = hist.some(h => h.holes === 18);
  $courseParInfo.innerHTML = `Front 9 Par: ${parFront9} ${has18 ? `| 18-Hole Par: ${par18}` : ''}`;

  const playerStats = {};
  hist.forEach(h => {
    Object.entries(h.scores).forEach(([p, sc]) => {
      const total = sc.reduce((a, b) => a + (+b || 0), 0);
      if (!playerStats[p]) playerStats[p] = { rounds: 0, best9: null, best18: null };
      playerStats[p].rounds++;
      if (h.holes === 9)  playerStats[p].best9  = (playerStats[p].best9  === null || total < playerStats[p].best9 ) ? total : playerStats[p].best9;
      if (h.holes === 18) playerStats[p].best18 = (playerStats[p].best18 === null || total < playerStats[p].best18) ? total : playerStats[p].best18;
    });
  });

  const rows = Object.entries(playerStats).map(([p, stat]) => {
    if (leaderboardMode === '9') {
      const s = stat.best9;
      const vs = (s !== null) ? ` (${s - parFront9 >= 0 ? '+' : ''}${s - parFront9})` : '';
      return { player: p, scoreNum: s === null ? Infinity : s, scoreText: s !== null ? `${s}${vs}` : '', rounds: stat.rounds };
    } else {
      const s = stat.best18;
      const vs = (s !== null && has18) ? ` (${s - par18 >= 0 ? '+' : ''}${s - par18})` : '';
      return { player: p, scoreNum: s === null ? Infinity : s, scoreText: s !== null ? `${s}${vs}` : '', rounds: stat.rounds };
    }
  });

  rows.sort((a, b) => (a.scoreNum === b.scoreNum ? a.player.localeCompare(b.player) : a.scoreNum - b.scoreNum));

  let html = `<table><thead><tr><th>Player</th><th>Best ${leaderboardMode === '9' ? '9' : '18'}-Hole</th><th>Rounds</th></tr></thead><tbody>`;
  html += `<tr><td>Par</td><td>${leaderboardMode === '9' ? parFront9 : (has18 ? par18 : '')}</td><td>—</td></tr>`;
  rows.forEach(r => { html += `<tr><td>${r.player}</td><td>${r.scoreText}</td><td>${r.rounds}</td></tr>`; });
  html += `</tbody></table>`;
  $courseLeaderboardTable.innerHTML = html;
}
$btnBest9.onclick  = () => { leaderboardMode = '9';  renderCourseLeaderboard(); };
$btnBest18.onclick = () => { leaderboardMode = '18'; renderCourseLeaderboard(); };

// ===== Listeners =====
$filterHistoryPlayer.onchange = ()=>{ renderHistory(); };
$playerProfileSelect.onchange = renderPlayerProfile;
$courseLeaderboardSelect.onchange = renderCourseLeaderboard;
$targetSlopeHistory.addEventListener('input', renderHI);

// ===== INIT =====
window.onload = () => {
  renderHistory();
  // support deep links: #profiles or #leaderboard or #hi
  const hash = location.hash.replace('#','');
  if (hash === 'hi') el('hiAnchor')?.scrollIntoView({behavior:'smooth'});
};
