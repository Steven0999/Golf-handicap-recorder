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

// ---- Long-form help content ---------------------------------------------
const HELP = {
  ags: {
    title: "Adjusted Gross Score (AGS)",
    body: `
<p><strong>Adjusted Gross Score (AGS)</strong> is the score you record for handicap purposes after applying specific adjustments that make scores across different courses and formats comparable. In plain terms, it starts with your actual strokes—including penalty strokes—and then replaces any unusually high single-hole result with a capped value, and accounts for holes not played or not finished. The goal is fairness: prevent a single disastrous hole, a conceded putt, or an unfinished hole in a Stableford/match from distorting your handicap calculation.</p>

<p>To build AGS, begin with your <em>gross score</em> for the round. For holes you played to completion, include the strokes you actually took plus any penalties. Next, apply the hole-by-hole cap your system uses (many modern systems use a limit equivalent to “net double bogey” on each hole). That cap means if you blow up on a par 4 and make, say, a 10, you don’t carry that full 10 into handicap calculations; you replace it with the capped value for that hole. The cap depends on the hole’s par and your playing handicap for that hole (stroke index allocation), so it scales for different golfers and course difficulties.</p>

<p>For holes you <em>did not complete</em>—for example, you pick up once you can’t score in the format—you record the “most likely score” or an adjusted value defined by your handicap authority. Similarly, if weather stops play and you only complete, say, 14 holes, unplayed holes are filled using guidance so that the round can be used for handicap purposes without giving you an unfairly low or high AGS. The idea is consistent treatment regardless of whether you were playing stroke play, Stableford, or match play.</p>

<p>AGS also includes penalty strokes in the normal way; there’s no special discount for rules penalties. If you hit a ball out of bounds, take a penalty, and then finish the hole, those strokes count before the capping step. By capping extreme outcomes and standardizing unfinished holes, AGS reflects your <em>typical</em> scoring potential rather than outliers.</p>

<p>Why does this matter? Handicap systems compare your scoring to a course’s difficulty through a formula that uses Course Rating and Slope. If two players shoot the same raw number on wildly different courses, their performances aren’t equivalent. AGS ensures that the number you feed into the handicap formula isn’t artificially inflated by a single catastrophe or administrative quirks (like concessions). Over time, using AGS stabilizes your Handicap Index so that it responds to your form, not freak occurrences.</p>

<p>Practical tips: keep a clean scorecard and mark any holes where you picked up, were conceded, or didn’t finish. After the round, compute the capped values hole-by-hole before totaling to AGS. If you often play various formats, write the adjusted hole score in a separate column so you can audit later. Remember that AGS is a standardized <em>input</em> to the handicap differential; it’s not meant to replace your real gross score for competition results. Treat it like a calibrated version of your round for the purpose of fair comparisons.</p>

<p>In this app, you enter AGS directly (we assume you’ve performed your hole-by-hole adjustments). The calculator then uses AGS with Course Rating and Slope to compute your differential, which is what drives the Handicap Index. Getting AGS right is the single best way to make your index reflect your true playing ability rather than a handful of blow-ups.</p>
`
  },
  cr: {
    title: "Course Rating",
    body: `
<p><strong>Course Rating</strong> represents the expected score for a scratch golfer (an expert player) under normal course and weather conditions from a specified set of tees. Think of it as a course’s “par” for a scratch player, but based on detailed measurement rather than just the card’s par. Two courses with a par of 72 can play very differently—one might be short but tricky, the other long and exposed to wind. Course Rating captures that real-world difficulty for elite play more precisely than par alone.</p>

<p>How is it established? Trained evaluators assess the course hole by hole. They consider length (measured along expected lines of play) and a suite of obstacles: landing area width, rough height, green target size and firmness, bunkering, penalty areas, trees, forced layups, doglegs, out-of-bounds pressure, elevation changes, prevailing wind, and recovery difficulty. Each factor is quantified using standardized procedures. The data produces an expected “scratch” score that becomes the Course Rating for that tee set—often a number around the low 70s for full-length courses, but it can be lower or higher.</p>

<p>Course Rating differs from par in important ways. Par is a design target based on hole length groups, whereas Course Rating is performance-derived: what would a scratch player realistically shoot? A par-72 course can carry a Course Rating of 70.8 (plays a bit easier for a scratch) or 74.5 (plays tougher). That spread matters when converting your score into a handicap differential; shooting 82 on a course rated 74.5 is a stronger performance than the same 82 on a course rated 70.8.</p>

<p>Course Rating is tee-specific because the effective playing length and angle into hazards change with tee position. A back tee might bring bunkers or penalty carries into range for a scratch hitter that are irrelevant from the forward tee. That’s why score posting requires you to match your round to the correct tee set and its listed Course Rating. The rating assumes “normal” conditions; it isn’t adjusted for a freak weather day, unusual green speeds, temporary tees, or abnormal pin placements unless the committee issues a special adjustment for that day.</p>

<p>In handicap math, Course Rating acts as the benchmark you compare your Adjusted Gross Score against. The differential formula subtracts Course Rating from your AGS, scales by a constant, and then divides by Slope Rating to normalize for course difficulty across skill levels. Intuitively, if you beat (or approach) the Course Rating, you’ve played at or near scratch level relative to that tee; if you trail it significantly, your performance is farther from scratch, and the differential rises.</p>

<p>Practical notes: when you travel, check that you’ve got the up-to-date Course Rating for the tees you actually played. Courses sometimes re-rate after renovations or material changes (length, bunkers, green complexes), and different tees—even on the same day—will often have different ratings. If you’re comparing rounds across courses, Course Rating provides a common yardstick for how tough a scratch player would find them, enabling fairer performance comparisons than using par alone.</p>

<p>Bottom line: Course Rating anchors the difficulty scale for expert play. When paired with Slope Rating (which models how difficulty increases for a typical bogey golfer), it enables a consistent translation from your adjusted score to a portable, comparable handicap measure.</p>
`
  },
  slope: {
    title: "Slope Rating",
    body: `
<p><strong>Slope Rating</strong> measures how much more (or less) difficult a golf course is for a typical bogey golfer compared to a scratch golfer. While Course Rating tells us what a scratch player is expected to shoot, Slope tells us how steeply difficulty ramps up as skill decreases. The standard reference value is 113; ratings range from roughly 55 (very easy relative to scratch) up to 155 (extremely difficult relative to scratch). Higher Slope means that scoring gets disproportionately tougher for the average player even if the Course Rating itself isn’t extreme.</p>

<p>Conceptually, evaluators determine two perspectives: the scratch player’s challenge and the bogey golfer’s challenge. The difference between those perspectives—after accounting for course length, obstacles, and recoverability—translates into Slope. Courses with narrow corridors, thick rough, forced carries, penal hazards near typical bogey landing zones, and demanding recoveries tend to have higher Slope because errors snowball faster for mid-handicap players. Conversely, a course that is open, has gentle surrounds, and few forced carries might be perfectly testing for scratch (moderate Course Rating) but not punish the average player as severely, yielding a lower Slope.</p>

<p>In the handicap calculation, Slope is the scaling factor that normalizes your performance across courses. The differential formula takes your Adjusted Gross Score minus Course Rating, multiplies by the constant 113, and divides by Slope. If you play a high-Slope course, the same scoring gap from Course Rating converts into a <em>smaller</em> differential than it would on a low-Slope course, recognizing that it was relatively tougher terrain for a non-scratch golfer. This keeps your Handicap Index portable: a 15 on a low-Slope resort course and a 15 on a tightly treed championship course become comparable after normalization.</p>

<p>Importantly, Slope is tee-specific because landing zones shift with distance. A back tee may push a carry over a hazard right into the bogey player’s range while a forward tee removes that carry entirely, changing how punishing the hole is for the average golfer. That’s why you should always pair your posted round with the correct tee’s Slope Rating. Although daily weather can alter difficulty, Slope is intended to be a stable course property under normal conditions; it changes only when the course is re-evaluated.</p>

<p>What do the numbers feel like? Around 113 is considered “average.” As you climb into the 130s, mishits are penalized more, recoveries are less certain, and double bogeys become more common for the average player; into the 140s and 150s, expect forced carries, penal hazards, and narrow landing zones that demand consistent ball-striking. A Slope in the 90s or lower suggests wide fairways, modest rough, accessible greens, and fewer forced shots, so scores spread less dramatically between scratch and bogey golfers.</p>

<p>For decision-making, Slope helps you set realistic expectations and choose tees that keep the game fun. If your index balloons on a new course, glance at the Slope: a high value explains why your normal scoring felt harder to achieve. When converting your Handicap Index to a Course Handicap for a specific round, you multiply by (Slope / 113). That step translates your portable index into the number of strokes you receive on that particular tee, reflecting how much the course amplifies or dampens difficulty for non-scratch players.</p>

<p>In short, Course Rating anchors the scratch baseline, and Slope Rating tilts the playing field for the rest of us. Together, they make your handicap meaningful from course to course and tee to tee.</p>
`
  }
};

// ---- Load from localStorage ---------------------------------------------
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
    .map((r)=> ({ id:r.id, diff:r.diff }))
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
  $$('#courseHcp').textContent = ch===null ? '—' : String(ch);

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

// ---- Modal controls ------------------------------------------------------
const modal = $$('#infoModal');
const modalTitle = $$('#modalTitle');
const modalBody = $$('#modalBody');
let lastFocused = null;

function openModal(topic){
  const entry = HELP[topic];
  if(!entry) return;
  lastFocused = document.activeElement;
  modalTitle.textContent = entry.title;
  modalBody.innerHTML = entry.body.trim();
  modal.hidden = false;
  // Focus trap: move focus to close button
  const firstBtn = modal.querySelector('[data-close="button"]');
  firstBtn?.focus();
  document.addEventListener('keydown', escClose);
}

function closeModal(){
  modal.hidden = true;
  document.removeEventListener('keydown', escClose);
  if(lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
}

function escClose(e){
  if(e.key === 'Escape') closeModal();
}

// Wire info buttons
$$$('.info-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> openModal(btn.getAttribute('data-topic')));
});

// Close actions
modal.addEventListener('click', (e)=>{
  const target = e.target;
  if(target.dataset.close === 'backdrop' || target.dataset.close === 'button'){
    closeModal();
  }
});

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
  const data = JSON.stringify({
    rounds: state.rounds,
    settings:{useCount:state.useCount, bonus:state.bonus, targetSlope:state.targetSlope}
  }, null, 2);
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
