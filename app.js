// ========================= DOM Helpers & Keys =========================
const el = id => document.getElementById(id);
const HISTORY_KEY = 'golf-history-v4';   // rounds
const PLAYERS_KEY = 'golf-players-v1';   // players catalog

// Safe JSON helpers
const safeParse = (str, fallback) => {
  try { const v = JSON.parse(str); return (v ?? fallback); } catch { return fallback; }
};
const isStringArray = v => Array.isArray(v) && v.every(x => typeof x === 'string');

// ========================= Drawer / Routing (index side) =========================
const $burger = el('burger');
const $drawer = el('drawer');
const $drawerLinks = document.querySelectorAll('.drawer-link');

function openDrawer(open) {
  if (!$drawer || !$burger) return;
  $drawer.classList.toggle('open', open);
  $drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  $burger.setAttribute('aria-expanded', open ? 'true' : 'false');
}
$burger?.addEventListener('click', () => openDrawer(!$drawer.classList.contains('open')));
$drawerLinks.forEach(btn => btn.addEventListener('click', () => {
  const route = btn.dataset.route;
  if (route !== 'scorecard') {
    const hash = btn.dataset.hash || route;
    location.href = `history.html#${hash}`;
  }
  openDrawer(false);
}));

// ========================= Storage =========================
function saveHistoryItem(item) {
  const arr = safeParse(localStorage.getItem(HISTORY_KEY), []);
  arr.push(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}
function loadHistory() {
  const arr = safeParse(localStorage.getItem(HISTORY_KEY), []);
  return Array.isArray(arr) ? arr : [];
}

// Players store with schema validation & normalization
function loadPlayers() {
  const raw = safeParse(localStorage.getItem(PLAYERS_KEY), []);
  if (!isStringArray(raw)) return [];
  // unique (case-insensitive), trimmed
  const seen = new Set();
  const out = [];
  raw.forEach(n => {
    const name = String(n).trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(name); }
  });
  return out;
}
function savePlayers(list) {
  // persist only valid strings, normalized & unique
  const seen = new Set();
  const normalized = [];
  list.forEach(n => {
    const name = String(n).trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); normalized.push(name); }
  });
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(normalized));
  return normalized;
}

// ========================= App State =========================
let players = loadPlayers();          // catalog (persisted)
let roundPlayers = [];                // selected for current round
let state = { course:'', area:'', holes:18, scores:{}, par:[] };

// ========================= Elements (Scorecard page) =========================
const $course = el('course'), $area = el('area'), $holes = el('holes');
const $playerSelect = el('playerSelect');
const $playerList = el('playerList');
const $roundCount = el('roundCount');
const $roundPlayerSelect = el('roundPlayerSelect');
const $generate = el('generate'), $saveHistory = el('saveHistory');
const $workspace = el('workspace'), $summary = el('summary');

// WHS UI (present on index page)
const $totalParKPI = el('totalParKPI');
const $totalScoreKPI = el('totalScoreKPI');
const $scoreVsParKPI = el('scoreVsParKPI');
const $previewDiffKPI = el('previewDiffKPI');
const $courseRating = el('courseRating');
const $slopeRating = el('slopeRating');
const $pcc = el('pcc');
const $recalcPreview = el('recalcPreview');
const $goToHistory = el('goToHistory');

// Add Player Modal elems
const $openAddPlayerModal = document.getElementById('openAddPlayerModal');
const $addPlayerModal = document.getElementById('addPlayerModal');
const $modalPlayerForm = document.getElementById('modalPlayerForm');
const $modalPlayerName = document.getElementById('modalPlayerName');
const $modalAddAlsoToRound = document.getElementById('modalAddAlsoToRound');
const $cancelAddPlayer = document.getElementById('cancelAddPlayer');

// ========================= Players (catalog) UI =========================
function renderPlayerSelectsFromCatalog() {
  if ($playerSelect) {
    $playerSelect.innerHTML = players.map(p => `<option value="${p}">${p}</option>`).join('');
  }
  if ($roundPlayerSelect) {
    $roundPlayerSelect.innerHTML = players.map(p => `<option value="${p}">${p}</option>`).join('');
  }
  syncRoundSelectWithRoundPlayers();
  renderPlayerList();
}

function syncRoundSelectWithRoundPlayers() {
  if (!$roundPlayerSelect) return;
  [...$roundPlayerSelect.options].forEach(opt => {
    opt.selected = roundPlayers.includes(opt.value);
  });
}

function renderPlayerList() {
  if (!$playerList) return;
  if (!players.length) { $playerList.innerHTML = '<div class="muted">No players yet.</div>'; return; }

  $playerList.innerHTML = players.map((p, idx) => `
    <div class="player-row" data-player="${p}">
      <div class="name">${p}</div>
      <div class="actions">
        <button class="btn" data-edit="${idx}">Edit</button>
        <button class="btn" data-delete="${idx}">Delete</button>
      </div>
    </div>
  `).join('');

  // Edit name
  $playerList.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.edit, 10);
      const oldName = players[i];
      const row = btn.closest('.player-row');
      row.innerHTML = `
        <input type="text" value="${oldName}" />
        <div class="actions">
          <button class="btn" data-save="${i}">Save</button>
          <button class="btn" data-cancel="${i}">Cancel</button>
        </div>
      `;
      const input = row.querySelector('input[type="text"]');
      input.focus();

      row.querySelector('button[data-save]').onclick = () => {
        const newName = (input.value || '').trim();
        if (!newName || newName === oldName) { renderPlayerList(); return; }
        if (players.some(n => n.toLowerCase() === newName.toLowerCase())) { alert('A player with that name already exists.'); return; }
        players[i] = newName;
        players = savePlayers(players);

        const rpIdx = roundPlayers.indexOf(oldName);
        if (rpIdx !== -1) roundPlayers[rpIdx] = newName;
        if (state.scores[oldName]) { state.scores[newName] = state.scores[oldName]; delete state.scores[oldName]; }

        renderPlayerSelectsFromCatalog();
        renderWorkspace();
        renderSummary();
      };
      row.querySelector('button[data-cancel]').onclick = () => renderPlayerList();
    };
  });

  // Delete name
  $playerList.querySelectorAll('button[data-delete]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.delete, 10);
      const name = players[i];
      if (!confirm(`Delete player "${name}" from catalog?`)) return;
      players.splice(i, 1);
      players = savePlayers(players);
      roundPlayers = roundPlayers.filter(n => n !== name);
      delete state.scores[name];
      renderPlayerSelectsFromCatalog();
      renderWorkspace();
      renderSummary();
    };
  });
}

// ========================= Round selection logic =========================
// QoL: toggle selection on click (no Ctrl/Cmd needed)
function enableMultiSelectToggle(selectEl) {
  if (!selectEl) return;
  selectEl.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'OPTION') return;
    e.preventDefault();
    const opt = e.target;
    opt.selected = !opt.selected;
    const event = new Event('change', { bubbles: true });
    selectEl.dispatchEvent(event);
  });
}
enableMultiSelectToggle($roundPlayerSelect);

$roundPlayerSelect?.addEventListener('change', () => {
  const countLimit = parseInt($roundCount?.value || '1', 10);
  const chosen = [...$roundPlayerSelect.selectedOptions].map(o => o.value);
  if (chosen.length > countLimit) {
    alert(`You selected ${chosen.length}. Limit is ${countLimit}. Deselect some names or increase the count.`);
    syncRoundSelectWithRoundPlayers();
  } else {
    roundPlayers = chosen;
  }
});

$roundCount?.addEventListener('input', () => {
  const limit = Math.max(1, Math.min(8, parseInt($roundCount.value || '1',10)));
  $roundCount.value = limit;
  const chosen = [...($roundPlayerSelect?.selectedOptions || [])].map(o => o.value);
  if (chosen.length > limit) {
    roundPlayers = chosen.slice(0, limit);
    syncRoundSelectWithRoundPlayers();
  }
});

// ========================= Generate Scorecard =========================
$generate?.addEventListener('click', () => {
  state.course = ($course?.value || '').trim();
  state.area   = ($area?.value || '').trim();
  state.holes  = parseInt($holes?.value || '18', 10);

  const limit = parseInt($roundCount?.value || '1', 10);
  if (roundPlayers.length === 0) { alert('Select at least one player for this round.'); return; }
  if (roundPlayers.length > limit) { alert(`You selected ${roundPlayers.length} players but limit is ${limit}.`); return; }

  if (!Array.isArray(state.par) || state.par.length !== state.holes) {
    state.par = Array.from({ length: state.holes }, () => 0);
  } else {
    state.par = state.par.slice(0, state.holes).concat(Array(Math.max(0, state.holes - state.par.length)).fill(0));
  }

  const prevScores = { ...state.scores };
  state.scores = {};
  roundPlayers.forEach(p => {
    const existing = prevScores[p] || [];
    state.scores[p] = Array.from({ length: state.holes }, (_, h) => existing[h] ?? 0);
  });

  renderWorkspace();
  renderSummary();
});

// ========================= Workspace & Summary =========================
function renderWorkspace() {
  if (!$workspace) return;
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { $workspace.innerHTML = '<div class="muted">Pick players and click Generate.</div>'; return; }

  let thead = '<tr><th class="left">Row</th>';
  for (let i = 1; i <= state.holes; i++) thead += `<th>H${i}</th>`;
  thead += '<th>Total</th></tr>';

  const parInputs = state.par.map((v, idx) =>
    `<td><input type="number" min="0" max="6" value="${v}" data-role="par" data-h="${idx}" style="width:56px"/></td>`
  ).join('');
  const parTotal = state.par.reduce((a, b) => a + (+b || 0), 0);
  const parRow = `<tr><td class="left">Par</td>${parInputs}<td>${parTotal}</td></tr>`;

  const bodyRows = playersInRound.map(p => {
    const tds = state.scores[p].map((v, idx) =>
      `<td><input type="number" min="0" value="${v}" data-role="stroke" data-p="${p}" data-h="${idx}" style="width:56px"/></td>`
    ).join('');
    const total = state.scores[p].reduce((a, b) => a + (+b || 0), 0);
    return `<tr><td class="left">${p}</td>${tds}<td>${total}</td></tr>`;
  }).join('');

  $workspace.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>${thead}</thead>
        <tbody>${parRow}${bodyRows}</tbody>
      </table>
    </div>
  `;

  $workspace.querySelectorAll('input[data-role="par"]').forEach(inp => {
    inp.oninput = () => {
      const h = parseInt(inp.dataset.h, 10);
      state.par[h] = Math.max(0, Math.min(20, parseInt(inp.value || '0', 10)));
      renderWorkspace();
      renderSummary();
    };
  });
  $workspace.querySelectorAll('input[data-role="stroke"]').forEach(inp => {
    inp.oninput = () => {
      const p = inp.dataset.p;
      const h = parseInt(inp.dataset.h, 10);
      state.scores[p][h] = Math.max(0, Math.min(30, parseInt(inp.value || '0', 10)));
      renderWorkspace();
      renderSummary();
    };
  });
}

function renderSummary() {
  if (!$summary) return;
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { $summary.innerHTML = ''; return; }
  const parTotal = state.par.reduce((a, b) => a + (+b || 0), 0);
  let html = '<h3>Summary</h3><div class="table-wrap"><table><thead><tr><th class="left">Player</th><th>Total</th><th>Par</th><th>±Par</th></tr></thead><tbody>';
  playersInRound.forEach(p => {
    const total = state.scores[p].reduce((a, b) => a + (+b || 0), 0);
    const toPar = total - parTotal;
    const tag = `${toPar >= 0 ? '+' : ''}${toPar}`;
    html += `<tr><td class="left">${p}</td><td>${total}</td><td>${parTotal}</td><td>${tag}</td></tr>`;
  });
  html += '</tbody></table></div>';
  $summary.innerHTML = html;
}

// ========================= Save Round =========================
$saveHistory?.addEventListener('click', () => {
  const playersInRound = Object.keys(state.scores);
  if (!playersInRound.length) { alert('Generate a scorecard first.'); return; }
  const item = {
    id: Date.now(),
    ts: new Date().toISOString(),
    course: state.course,
    area: state.area,
    holes: state.holes,
    scores: state.scores,   // { playerName: [h1..] }
    par: state.par          // [p1..]
  };
  saveHistoryItem(item);
  alert('Round saved to history.');
  // Also attach CR/Slope/PCC to newest round if provided on this page
  setTimeout(() => {
    const hist = loadHistory();
    if (!hist.length) return;
    const last = hist[hist.length - 1];
    const parTotal = (last.par || []).slice(0, last.holes || 0).reduce((a,b)=>a+(+b||0),0);
    const cr = ($courseRating && $courseRating.value !== '') ? Number($courseRating.value) : parTotal;
    const slope = Number($slopeRating?.value) || 113;
    const pccVal = Number($pcc?.value) || 0;
    last.cr = cr; last.slope = slope; last.pcc = pccVal;
    last.differentials = {};
    Object.entries(last.scores || {}).forEach(([player, sc]) => {
      const ags = (sc || []).slice(0, last.holes || 0).reduce((a,b)=>a+(+b||0),0);
      last.differentials[player] = whsDifferential(ags, cr, slope, pccVal);
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  }, 0);
});

// ========================= WHS helpers (index page preview) =========================
const round2 = n => Math.round(n*100)/100;
const round1 = n => Math.round(n*10)/10;

function whsDifferential(ags, cr, slope, pcc=0){
  if(!Number.isFinite(ags)||!Number.isFinite(cr)||!Number.isFinite(slope)||slope<=0) return null;
  return round2((113/slope)*(ags-cr-(pcc||0)));
}
function getParTotalFromState(){
  return (state.par||[]).slice(0, state.holes||0).reduce((a,b)=>a+(+b||0),0);
}
function getFirstPlayerInRound(){
  const keys = Object.keys(state.scores||{}); return keys.length?keys[0]:null;
}
function getPlayerTotalFromState(player){
  if(!player||!state.scores[player]) return 0;
  return state.scores[player].slice(0,state.holes||0).reduce((a,b)=>a+(+b||0),0);
}
function updateRoundTotalsUI(){
  if(!$totalParKPI||!$totalScoreKPI||!$scoreVsParKPI||!$previewDiffKPI) return;
  const parTotal = getParTotalFromState();
  const player = getFirstPlayerInRound();
  const scoreTotal = getPlayerTotalFromState(player);
  $totalParKPI.textContent = parTotal;
  $totalScoreKPI.textContent = scoreTotal;
  const toPar = scoreTotal - parTotal;
  $scoreVsParKPI.textContent = `${toPar>=0?'+':''}${toPar}`;

  const cr = ($courseRating && $courseRating.value !== '') ? Number($courseRating.value) : parTotal;
  const slope = Number($slopeRating?.value)||113;
  const pccVal = Number($pcc?.value)||0;
  const diff = whsDifferential(scoreTotal, cr, slope, pccVal);
  $previewDiffKPI.textContent = (diff==null?'—':diff.toFixed(2));
}

// Patch renders to update preview without changing your original outputs
const __renderWorkspace = renderWorkspace;
renderWorkspace = function(){ __renderWorkspace(); try{updateRoundTotalsUI();}catch{} };
const __renderSummary = renderSummary;
renderSummary = function(){ __renderSummary(); try{updateRoundTotalsUI();}catch{} };

// Buttons & input listeners (preview + nav)
$recalcPreview?.addEventListener('click', updateRoundTotalsUI);
[$courseRating,$slopeRating,$pcc].forEach(i=>i?.addEventListener('input', updateRoundTotalsUI));
$goToHistory?.addEventListener('click', ()=>{ location.href = 'history.html#history'; });

// ========================= Add Player Modal (robust) =========================
function showAddPlayerModal() {
  if (!$addPlayerModal) return;
  $modalPlayerName.value = '';
  if ($modalAddAlsoToRound) $modalAddAlsoToRound.checked = false;
  $addPlayerModal.classList.add('show');
  $addPlayerModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => $modalPlayerName?.focus(), 0);
}
function hideAddPlayerModal() {
  if (!$addPlayerModal) return;
  $addPlayerModal.classList.remove('show');
  $addPlayerModal.setAttribute('aria-hidden', 'true');
}
$openAddPlayerModal?.addEventListener('click', showAddPlayerModal);
$addPlayerModal?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) hideAddPlayerModal();
});
$cancelAddPlayer?.addEventListener('click', hideAddPlayerModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $addPlayerModal?.classList.contains('show')) hideAddPlayerModal();
});

$modalPlayerForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = ($modalPlayerName?.value || '');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) { alert('Please enter a player name.'); return; }

  // Case-insensitive duplication
  if (players.some(n => n.toLowerCase() === name.toLowerCase())) {
    alert('This name already exists.');
    return;
  }

  players.push(name);
  players = savePlayers(players); // normalize & persist

  // Auto-add to round if space and requested
  const limit = parseInt(($roundCount?.value || '8'), 10);
  const wantInRound = $modalAddAlsoToRound?.checked ?? true;
  if (wantInRound && !roundPlayers.includes(name) && roundPlayers.length < limit) {
    roundPlayers.push(name);
  }

  // Refresh UI
  renderPlayerSelectsFromCatalog();
  hideAddPlayerModal();

  // Ensure visible as selected in the multi-select
  syncRoundSelectWithRoundPlayers();

  // If user already generated a scorecard, extend state to include new player with zeroes
  if (Object.keys(state.scores).length && state.holes > 0 && roundPlayers.includes(name)) {
    const len = state.holes;
    state.scores[name] = Array.from({ length: len }, () => 0);
    renderWorkspace();
    renderSummary();
  }
});

// ========================= INIT =========================
function init() {
  // Initial render
  renderPlayerSelectsFromCatalog();
  updateRoundTotalsUI();

  // If players list is empty, provide a gentle hint (optional)
  // (No UI change; just console feedback)
  if (!players.length) console.info('Tip: Click "Add New Player" to create your first player.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
