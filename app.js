// ─── DATA ──────────────────────────────────────────────────────────────────

const ROOT_NOTES = ['C','D','E','F','G','A','B'];

const CHORD_TYPES = [
  { val: 'maj',    label: 'Major',      symbol: 'Δ' },
  { val: 'min',    label: 'Minor',      symbol: 'm' },
  { val: '7',      label: 'Dom 7',      symbol: '7' },
  { val: 'maj7',   label: 'Major 7',    symbol: 'maj7' },
  { val: 'min7',   label: 'Minor 7',    symbol: 'm7' },
  { val: 'min7b5', label: 'Half Dim',   symbol: 'm7♭5' },
  { val: 'dim',    label: 'Diminished', symbol: 'dim' },
  { val: 'dim7',   label: 'Dim 7',      symbol: 'dim7' },
  { val: 'aug',    label: 'Augmented',  symbol: 'aug' },
  { val: 'sus2',   label: 'Sus 2',      symbol: 'sus2' },
  { val: 'sus4',   label: 'Sus 4',      symbol: 'sus4' },
  { val: 'add9',   label: 'Add 9',      symbol: 'add9' },
  { val: '9',      label: 'Dom 9',      symbol: '9' },
  { val: 'maj9',   label: 'Major 9',    symbol: 'maj9' },
  { val: 'min9',   label: 'Minor 9',    symbol: 'm9' },
  { val: '6',      label: 'Major 6',    symbol: '6' },
  { val: 'min6',   label: 'Minor 6',    symbol: 'm6' },
  { val: '11',     label: 'Dom 11',     symbol: '11' },
  { val: 'maj11',  label: 'Major 11',   symbol: 'maj11' },
  { val: '13',     label: 'Dom 13',     symbol: '13' },
];

// ─── STATE ─────────────────────────────────────────────────────────────────

const state = {
  mode: 'note',      // 'note' | 'chord'
  playing: false,
  interval: 5,       // seconds
  activeNotes: new Set(ROOT_NOTES),
  activeAcc: new Set(['natural','sharp','flat']),
  activeChords: new Set(CHORD_TYPES.map(c => c.val)),
  current: { root: 'C', acc: '', chord: null },
};

// ─── DERIVED ───────────────────────────────────────────────────────────────

const SHARP_NOTES = new Set(['C','D','F','G','A']);
const FLAT_NOTES  = new Set(['D','E','G','A','B']);

function buildPool() {
  const pool = [];
  for (const note of ROOT_NOTES) {
    if (!state.activeNotes.has(note)) continue;
    if (state.activeAcc.has('natural')) pool.push({ root: note, acc: '' });
    if (state.activeAcc.has('sharp') && SHARP_NOTES.has(note)) pool.push({ root: note, acc: '#' });
    if (state.activeAcc.has('flat')  && FLAT_NOTES.has(note))  pool.push({ root: note, acc: 'b' });
  }
  return pool;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nextItem(avoidCurrent = true) {
  const pool = buildPool();
  if (!pool.length) return null;
  const chordPool = [...state.activeChords];
  if (state.mode === 'chord' && !chordPool.length) return null;

  let candidate;
  let tries = 0;
  do {
    candidate = randomFrom(pool);
    tries++;
  } while (avoidCurrent && tries < 8 && candidate.root === state.current.root && candidate.acc === state.current.acc);

  let chord = null;
  if (state.mode === 'chord') {
    let chordTries = 0;
    do {
      chord = randomFrom(chordPool);
      chordTries++;
    } while (avoidCurrent && chordTries < 8 && chord === state.current.chord);
  }

  return { root: candidate.root, acc: candidate.acc, chord };
}

// ─── AUDIO (beep) ──────────────────────────────────────────────────────────

let audioCtx = null;

function playBeep() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const now = audioCtx.currentTime;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 880; // A5
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.15);
    oscillator.start(now);
    oscillator.stop(now + 0.15);
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.warn('Audio not supported', e);
  }
}

// ─── DOM REFS ──────────────────────────────────────────────────────────────

const noteDisplay   = document.getElementById('noteDisplay');
const chordQuality  = document.getElementById('chordQuality');
const modeLabel     = document.getElementById('modeLabel');
const progressBar   = document.getElementById('progressBar');
const timerLabel    = document.getElementById('timerLabel');
const playPauseBtn  = document.getElementById('playPauseBtn');
const playIcon      = document.getElementById('playIcon');
const pauseIcon     = document.getElementById('pauseIcon');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const intervalSlider = document.getElementById('intervalSlider');
const intervalVal   = document.getElementById('intervalVal');
const settingsBtn   = document.getElementById('settingsBtn');
const overlay       = document.getElementById('overlay');
const panel         = document.getElementById('panel');
const closePanel    = document.getElementById('closePanel');
const chordSection  = document.getElementById('chordSection');
const notesWarn     = document.getElementById('notesWarn');
const accWarn       = document.getElementById('accWarn');
const chordsWarn    = document.getElementById('chordsWarn');

// ─── RENDER ────────────────────────────────────────────────────────────────

function renderDisplay(item, animate = true) {
  if (!item) return;
  state.current = item;

  const accChar = item.acc === '#' ? '♯' : item.acc === 'b' ? '♭' : '';
  const inner = accChar ? `${item.root}<sup>${accChar}</sup>` : item.root;

  if (animate) {
    noteDisplay.classList.add('flash-out');
    setTimeout(() => {
      noteDisplay.innerHTML = inner;
      noteDisplay.classList.remove('flash-out');
      noteDisplay.classList.add('flash-in');
      void noteDisplay.offsetWidth;
      noteDisplay.classList.remove('flash-in');
      noteDisplay.classList.add('flash-in');

      if (state.mode === 'chord' && item.chord !== null) {
        const ct = CHORD_TYPES.find(c => c.val === item.chord);
        chordQuality.style.opacity = 0;
        // Show full label instead of symbol
        chordQuality.textContent = ct ? ct.label : '';
        chordQuality.style.animation = 'none';
        void chordQuality.offsetWidth;
        chordQuality.style.animation = '';
        chordQuality.classList.remove('flash-in');
        void chordQuality.offsetWidth;
        chordQuality.style.opacity = '';
        chordQuality.style.animation = 'fadeUp 0.35s 0.1s ease forwards';
      } else {
        chordQuality.textContent = '';
        chordQuality.style.opacity = '0';
      }
    }, 140);
  } else {
    noteDisplay.innerHTML = inner;
    if (state.mode === 'chord' && item.chord !== null) {
      const ct = CHORD_TYPES.find(c => c.val === item.chord);
      chordQuality.textContent = ct ? ct.label : '';
      chordQuality.style.opacity = '1';
    } else {
      chordQuality.textContent = '';
      chordQuality.style.opacity = '0';
    }
  }
}

function updateModeUI() {
  modeLabel.textContent = state.mode === 'note' ? 'Note' : 'Chord';
  modeLabel.style.animation = 'none';
  void modeLabel.offsetWidth;
  modeLabel.style.animation = '';
  // Always show chord section in settings, regardless of mode
  chordSection.style.display = '';
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.mode);
  });
}

// ─── TIMER (seconds) and METRONOME ─────────────────────────────────────────

let timerStart = null;
let rafId = null;
let beepInterval = null;

function startTimer() {
  stopTimer(); // clears raf and progress
  timerStart = performance.now();
  const duration = state.interval * 1000;

  function tick(now) {
    const elapsed = now - timerStart;
    const pct = Math.min((elapsed / duration) * 100, 100);
    progressBar.style.transition = 'none';
    progressBar.style.width = pct + '%';
    const remaining = Math.ceil((duration - elapsed) / 1000);
    timerLabel.textContent = remaining + 's';

    if (elapsed >= duration) {
      playBeep();          // beep on automatic advance
      advance();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

function stopTimer() {
  if (rafId) cancelAnimationFrame(rafId);
  progressBar.style.width = '0%';
  timerLabel.textContent = '';
}

function setPlaying(val) {
  state.playing = val;
  playIcon.style.display  = val ? 'none' : '';
  pauseIcon.style.display = val ? '' : 'none';
  if (val) {
    startTimer();
    // Start metronome beep every second
    if (beepInterval) clearInterval(beepInterval);
    beepInterval = setInterval(() => {
      if (state.playing) playBeep();
    }, 1000);
  } else {
    stopTimer();
    if (beepInterval) {
      clearInterval(beepInterval);
      beepInterval = null;
    }
  }
}

// ─── HISTORY ───────────────────────────────────────────────────────────────

const history = [];
let histIdx = -1;

function advanceWithHistory() {
  const item = nextItem();
  if (!item) return;
  history.splice(histIdx + 1);
  history.push(item);
  if (history.length > 50) history.shift();
  histIdx = history.length - 1;
  renderDisplay(item);
  if (state.playing) startTimer();
}

function goBack() {
  if (histIdx > 0) {
    histIdx--;
    renderDisplay(history[histIdx]);
    if (state.playing) startTimer();
  }
}

function goForward() {
  if (histIdx < history.length - 1) {
    histIdx++;
    renderDisplay(history[histIdx]);
    if (state.playing) startTimer();
  } else {
    advanceWithHistory();
  }
}

function advance() { advanceWithHistory(); }

// Initial item
(function init() {
  const item = nextItem(false);
  if (item) {
    history.push(item);
    histIdx = 0;
    renderDisplay(item, false);
  }
})();

// ─── CHIP BUILDERS ─────────────────────────────────────────────────────────

function buildNotesGrid() {
  const grid = document.getElementById('notesGrid');
  grid.innerHTML = '';
  ROOT_NOTES.forEach(n => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (state.activeNotes.has(n) ? ' on' : '');
    chip.dataset.group = 'notes';
    chip.dataset.val = n;
    chip.textContent = n;
    grid.appendChild(chip);
  });
}

function buildChordsGrid() {
  const grid = document.getElementById('chordsGrid');
  grid.innerHTML = '';
  CHORD_TYPES.forEach(ct => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (state.activeChords.has(ct.val) ? ' on' : '');
    chip.dataset.group = 'chords';
    chip.dataset.val = ct.val;
    // Show only the symbol in the settings chips (makes them compact)
    chip.textContent = ct.symbol;
    grid.appendChild(chip);
  });
}

buildNotesGrid();
buildChordsGrid();

// Chip click delegation for settings chips
document.addEventListener('click', e => {
  const chip = e.target.closest('.chip[data-group]');
  if (!chip) return;
  const group = chip.dataset.group;
  const val   = chip.dataset.val;

  if (group === 'notes') {
    if (state.activeNotes.has(val)) {
      if (state.activeNotes.size <= 1) { notesWarn.classList.add('visible'); return; }
      state.activeNotes.delete(val);
    } else {
      state.activeNotes.add(val);
    }
    notesWarn.classList.remove('visible');
    buildNotesGrid();
  } else if (group === 'acc') {
    if (state.activeAcc.has(val)) {
      if (state.activeAcc.size <= 1) { accWarn.classList.add('visible'); return; }
      state.activeAcc.delete(val);
    } else {
      state.activeAcc.add(val);
    }
    accWarn.classList.remove('visible');
    document.querySelectorAll('.chip[data-group="acc"]').forEach(c => {
      c.classList.toggle('on', state.activeAcc.has(c.dataset.val));
    });
  } else if (group === 'chords') {
    if (state.activeChords.has(val)) {
      if (state.activeChords.size <= 1) { chordsWarn.classList.add('visible'); return; }
      state.activeChords.delete(val);
    } else {
      state.activeChords.add(val);
    }
    chordsWarn.classList.remove('visible');
    buildChordsGrid();
  }
});

// Select all / none
document.addEventListener('click', e => {
  const btn = e.target.closest('.chip-action-btn[data-group]');
  if (!btn) return;
  const group  = btn.dataset.group;
  const action = btn.dataset.action;

  if (group === 'notes') {
    if (action === 'all') ROOT_NOTES.forEach(n => state.activeNotes.add(n));
    else { state.activeNotes.clear(); state.activeNotes.add(ROOT_NOTES[0]); }
    notesWarn.classList.remove('visible');
    buildNotesGrid();
  } else if (group === 'chords') {
    if (action === 'all') CHORD_TYPES.forEach(c => state.activeChords.add(c.val));
    else { state.activeChords.clear(); state.activeChords.add(CHORD_TYPES[0].val); }
    chordsWarn.classList.remove('visible');
    buildChordsGrid();
  }
});

// ─── INTERVAL SLIDER ───────────────────────────────────────────────────────

intervalSlider.addEventListener('input', () => {
  state.interval = parseInt(intervalSlider.value);
  intervalVal.textContent = state.interval + 's';
  if (state.playing) startTimer(); // restart timer with new interval
});

// ─── MODE BUTTONS ──────────────────────────────────────────────────────────

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.mode === state.mode) return;
    state.mode = btn.dataset.mode;
    updateModeUI();
    const item = nextItem(false);
    if (item) {
      history.length = 0;
      history.push(item);
      histIdx = 0;
      renderDisplay(item);
    }
    if (state.playing) startTimer();
  });
});

// ─── PLAY / PAUSE ──────────────────────────────────────────────────────────

playPauseBtn.addEventListener('click', () => setPlaying(!state.playing));

// ─── PREV / NEXT ───────────────────────────────────────────────────────────

prevBtn.addEventListener('click', () => { goBack(); });
nextBtn.addEventListener('click', () => { goForward(); });

// ─── TAP CARD ──────────────────────────────────────────────────────────────

noteDisplay.addEventListener('click', () => goForward());

// ─── SETTINGS PANEL ────────────────────────────────────────────────────────

function openPanel() {
  overlay.classList.add('open');
  panel.classList.add('open');
}
function closeSettingsPanel() {
  overlay.classList.remove('open');
  panel.classList.remove('open');
}

settingsBtn.addEventListener('click', openPanel);
overlay.addEventListener('click', closeSettingsPanel);
closePanel.addEventListener('click', closeSettingsPanel);

// ─── RESET ─────────────────────────────────────────────────────────────────

document.getElementById('resetBtn').addEventListener('click', () => {
  state.interval = 5;
  intervalSlider.value = 5;
  intervalVal.textContent = '5s';
  state.activeNotes = new Set(ROOT_NOTES);
  state.activeAcc   = new Set(['natural','sharp','flat']);
  state.activeChords = new Set(CHORD_TYPES.map(c => c.val));
  buildNotesGrid();
  buildChordsGrid();
  document.querySelectorAll('.chip[data-group="acc"]').forEach(c => c.classList.add('on'));
  [notesWarn, accWarn, chordsWarn].forEach(w => w.classList.remove('visible'));
  if (state.playing) startTimer();
});

// ─── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (panel.classList.contains('open')) return;
  if (e.code === 'Space')      { e.preventDefault(); setPlaying(!state.playing); }
  if (e.code === 'ArrowRight') goForward();
  if (e.code === 'ArrowLeft')  goBack();
});

// Final UI update
updateModeUI();