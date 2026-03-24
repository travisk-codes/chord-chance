// ─── DATA ──────────────────────────────────────────────────────────────────

const ROOT_NOTES = ['C','D','E','F','G','A','B'];

const CHORD_TYPES = [
  { val: 'maj',    label: 'Major',      symbol: 'Δ',     intervals: [0,4,7] },
  { val: 'min',    label: 'Minor',      symbol: 'm',     intervals: [0,3,7] },
  { val: '7',      label: 'Dom 7',      symbol: '7',     intervals: [0,4,7,10] },
  { val: 'maj7',   label: 'Major 7',    symbol: 'maj7',  intervals: [0,4,7,11] },
  { val: 'min7',   label: 'Minor 7',    symbol: 'm7',    intervals: [0,3,7,10] },
  { val: 'min7b5', label: 'Half Dim',   symbol: 'm7♭5',  intervals: [0,3,6,10] },
  { val: 'dim',    label: 'Diminished', symbol: 'dim',   intervals: [0,3,6] },
  { val: 'dim7',   label: 'Dim 7',      symbol: 'dim7',  intervals: [0,3,6,9] },
  { val: 'aug',    label: 'Augmented',  symbol: 'aug',   intervals: [0,4,8] },
  { val: 'sus2',   label: 'Sus 2',      symbol: 'sus2',  intervals: [0,2,7] },
  { val: 'sus4',   label: 'Sus 4',      symbol: 'sus4',  intervals: [0,5,7] },
  { val: 'add9',   label: 'Add 9',      symbol: 'add9',  intervals: [0,2,4,7] },
  { val: '9',      label: 'Dom 9',      symbol: '9',     intervals: [0,4,7,10,14] },
  { val: 'maj9',   label: 'Major 9',    symbol: 'maj9',  intervals: [0,4,7,11,14] },
  { val: 'min9',   label: 'Minor 9',    symbol: 'm9',    intervals: [0,3,7,10,14] },
  { val: '6',      label: 'Major 6',    symbol: '6',     intervals: [0,4,7,9] },
  { val: 'min6',   label: 'Minor 6',    symbol: 'm6',    intervals: [0,3,7,9] },
  { val: '11',     label: 'Dom 11',     symbol: '11',    intervals: [0,4,7,10,14,17] },
  { val: 'maj11',  label: 'Major 11',   symbol: 'maj11', intervals: [0,4,7,11,14,17] },
  { val: '13',     label: 'Dom 13',     symbol: '13',    intervals: [0,4,7,10,14,21] },
];

// Semitone maps for audio detection
const SEMITONE_TO_SHARP = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const NOTE_TO_SEMITONE = {
  'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11,
  'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10,
};

// Enharmonic equivalents for accidental notes
const ENHARMONIC = {
  'C#':'D♭', 'Db':'C♯', 'D#':'E♭', 'Eb':'D♯',
  'F#':'G♭', 'Gb':'F♯', 'G#':'A♭', 'Ab':'G♯',
  'A#':'B♭', 'Bb':'A♯',
};

// ─── STATE ─────────────────────────────────────────────────────────────────

const state = {
  mode: 'note',
  playing: false,
  interval: 5,
  activeNotes: new Set(ROOT_NOTES),
  activeAcc: new Set(['natural','sharp','flat']),
  activeChords: new Set(CHORD_TYPES.map(c => c.val)),
  current: { root: 'C', acc: '', chord: null },
  // Audio feedback
  micActive: false,
  audioCtx: null,
  analyser: null,
  micStream: null,
  audioLoop: null,
  feedbackState: 'neutral',
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

// ─── AUDIO BEEP ────────────────────────────────────────────────────────────

let beepCtx = null;

function playBeep(freq = 880, vol = 0.15, dur = 0.08) {
  try {
    if (!beepCtx) {
      beepCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (beepCtx.state === 'suspended') beepCtx.resume();
    const now = beepCtx.currentTime;
    const oscillator = beepCtx.createOscillator();
    const gain = beepCtx.createGain();
    oscillator.connect(gain);
    gain.connect(beepCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + dur);
    oscillator.start(now);
    oscillator.stop(now + dur);
  } catch (e) {
    console.warn('Audio not supported', e);
  }
}

function playTick() {
  playBeep(660, 0.06, 0.04);
}

function playAdvanceBeep() {
  playBeep(880, 0.2, 0.12);
}

// ─── AUDIO FEEDBACK (Microphone) ───────────────────────────────────────────

function detectPitch(floatData, sampleRate) {
  const n = floatData.length;
  const half = Math.floor(n / 2);

  // Check signal level
  let rms = 0;
  for (let i = 0; i < n; i++) rms += floatData[i] * floatData[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.004) return null;  // lowered threshold for sensitivity

  // Autocorrelation
  const corr = new Float32Array(half);
  for (let lag = 0; lag < half; lag++) {
    let sum = 0;
    for (let i = 0; i < half; i++) sum += floatData[i] * floatData[i + lag];
    corr[lag] = sum;
  }

  // Find first dip (skip DC peak)
  let start = 1;
  while (start < half - 1 && corr[start] > corr[start + 1]) start++;

  // Find best peak after dip
  let bestLag = start, bestVal = -Infinity;
  for (let i = start; i < half; i++) {
    if (corr[i] > bestVal) { bestVal = corr[i]; bestLag = i; }
  }

  if (bestVal / corr[0] < 0.25) return null;  // lowered from 0.4

  // Parabolic interpolation for sub-sample accuracy
  const x0 = bestLag > 0 ? corr[bestLag - 1] : corr[bestLag];
  const x2 = bestLag < half - 1 ? corr[bestLag + 1] : corr[bestLag];
  const denom = 2 * (2 * corr[bestLag] - x0 - x2);
  const refinedLag = bestLag + (denom !== 0 ? (x2 - x0) / denom : 0);
  return sampleRate / refinedLag;
}

function buildChroma(freqData, sampleRate, fftSize) {
  const chroma = new Float32Array(12);
  const binHz = sampleRate / fftSize;
  for (let b = 1; b < freqData.length; b++) {
    const freq = b * binHz;
    if (freq < 60 || freq > 5000) continue;
    const midi = 12 * Math.log2(freq / 440) + 69;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    const power = Math.pow(10, (freqData[b] - 255) / 20);
    chroma[pc] += power;
  }
  const max = Math.max(...chroma, 1e-9);
  for (let i = 0; i < 12; i++) chroma[i] /= max;
  return chroma;
}

function currentNoteName() {
  return state.current.root + (state.current.acc === '#' ? '#' : state.current.acc === 'b' ? 'b' : '');
}

function targetSemitone() {
  return NOTE_TO_SEMITONE[currentNoteName()] ?? 0;
}

function expectedChromaSet() {
  const rootSt = targetSemitone();
  if (state.mode === 'note') return new Set([rootSt]);
  const ct = CHORD_TYPES.find(c => c.val === state.current.chord);
  const intervals = ct?.intervals ?? [0];
  return new Set(intervals.map(i => (rootSt + i) % 12));
}

const SEMITONE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function evaluateAudio(floatData, byteFreqData, sampleRate, fftSize) {
  if (state.mode === 'note') {
    const freq = detectPitch(floatData, sampleRate);
    if (freq === null) return { result: 'neutral', detected: null };
    const midi = 12 * Math.log2(freq / 440) + 69;
    const detectedSt = ((Math.round(midi) % 12) + 12) % 12;
    const detectedName = SEMITONE_NAMES[detectedSt];
    const match = detectedSt === targetSemitone() ? 'correct' : 'wrong';
    return { result: match, detected: detectedName };
  } else {
    const chroma = buildChroma(byteFreqData, sampleRate, fftSize);
    const total = chroma.reduce((a, b) => a + b, 0) / 12;
    if (total < 0.03) return { result: 'neutral', detected: null };
    const expected = expectedChromaSet();
    let score = 0;
    for (const pc of expected) score += chroma[pc];
    score /= expected.size;
    // Find strongest pitch class for display
    let maxPc = 0, maxVal = 0;
    for (let i = 0; i < 12; i++) { if (chroma[i] > maxVal) { maxVal = chroma[i]; maxPc = i; } }
    const detectedName = SEMITONE_NAMES[maxPc];
    if (score > 0.45) return { result: 'correct', detected: detectedName };
    if (score < 0.2) return { result: 'wrong', detected: detectedName };
    return { result: 'neutral', detected: detectedName };
  }
}

async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    state.micStream = stream;
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = state.audioCtx.createMediaStreamSource(stream);

    const FFT_SIZE = 4096;  // larger for better pitch resolution
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = FFT_SIZE;
    state.analyser.smoothingTimeConstant = 0.5;  // less smoothing for faster response
    source.connect(state.analyser);

    const floatData = new Float32Array(FFT_SIZE);
    const byteFreqData = new Uint8Array(state.analyser.frequencyBinCount);

    let lastResult = 'neutral';
    let sameCount = 0;
    const CONFIRM = 3;  // fewer frames needed to confirm

    function audioTick() {
      state.analyser.getFloatTimeDomainData(floatData);
      state.analyser.getByteFrequencyData(byteFreqData);

      // Audio level meter
      let lvl = 0;
      for (let i = 0; i < floatData.length; i++) lvl += floatData[i] * floatData[i];
      lvl = Math.sqrt(lvl / floatData.length);
      audioBar.style.width = Math.min(lvl * 500, 100) + '%';

      const { result, detected } = evaluateAudio(floatData, byteFreqData, state.audioCtx.sampleRate, FFT_SIZE);

      if (result === lastResult) {
        sameCount++;
        if (sameCount >= CONFIRM) {
          setFeedbackState(result, detected);
        }
      } else {
        lastResult = result;
        sameCount = 0;
      }

      state.audioLoop = requestAnimationFrame(audioTick);
    }
    audioTick();

    state.micActive = true;
    micBtn.classList.add('mic-on');
    audioLevel.classList.add('active');
  } catch (err) {
    console.warn('Could not access microphone:', err.message);
  }
}

function stopMic() {
  cancelAnimationFrame(state.audioLoop);
  if (state.micStream) state.micStream.getTracks().forEach(t => t.stop());
  if (state.audioCtx) state.audioCtx.close();
  state.micActive = false;
  micBtn.classList.remove('mic-on');
  audioLevel.classList.remove('active');
  audioBar.style.width = '0%';
  setFeedbackState('neutral');
}

// ─── DOM REFS ──────────────────────────────────────────────────────────────

const noteDisplay   = document.getElementById('noteDisplay');
const chordQuality  = document.getElementById('chordQuality');
const enharmonicEl  = document.getElementById('enharmonic');
const feedbackLabel = document.getElementById('feedbackLabel');
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
const micBtn        = document.getElementById('micBtn');
const audioLevel    = document.getElementById('audioLevel');
const audioBar      = document.getElementById('audioBar');
const glowOrb       = document.querySelector('.glow-orb');

// ─── FEEDBACK STATE ────────────────────────────────────────────────────────

function setFeedbackState(s, detectedNote) {
  state.feedbackState = s;

  // Note display color
  noteDisplay.classList.remove('state-correct', 'state-wrong');
  if (s === 'correct') noteDisplay.classList.add('state-correct');
  if (s === 'wrong') noteDisplay.classList.add('state-wrong');

  // Glow orb
  glowOrb.classList.remove('correct', 'wrong');
  if (s !== 'neutral') glowOrb.classList.add(s);

  // Feedback text - show detected note when wrong
  if (s === 'correct') {
    feedbackLabel.textContent = 'Correct';
  } else if (s === 'wrong' && detectedNote) {
    feedbackLabel.textContent = `Hearing: ${detectedNote}`;
  } else {
    feedbackLabel.textContent = '';
  }
  feedbackLabel.style.color =
    s === 'correct' ? 'var(--green)' :
    s === 'wrong'   ? 'var(--red)'   : 'var(--text-dim)';
}

// ─── RENDER ────────────────────────────────────────────────────────────────

function renderDisplay(item, animate = true) {
  if (!item) return;
  state.current = item;

  const accChar = item.acc === '#' ? '♯' : item.acc === 'b' ? '♭' : '';
  const inner = accChar ? `${item.root}<sup>${accChar}</sup>` : item.root;

  // Enharmonic
  const noteKey = item.root + item.acc;
  const enh = ENHARMONIC[noteKey];

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

      enharmonicEl.textContent = enh ? `= ${enh}` : '';
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
    enharmonicEl.textContent = enh ? `= ${enh}` : '';
  }

  setFeedbackState('neutral');
}

function updateModeUI() {
  modeLabel.textContent = state.mode === 'note' ? 'Note' : 'Chord';
  modeLabel.style.animation = 'none';
  void modeLabel.offsetWidth;
  modeLabel.style.animation = '';
  chordSection.style.display = '';
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.mode);
  });
}

// ─── TIMER ─────────────────────────────────────────────────────────────────

let timerStart = null;
let rafId = null;
let tickInterval = null;
let lastTickSecond = -1;

function startTimer() {
  stopTimer();
  timerStart = performance.now();
  lastTickSecond = -1;
  const duration = state.interval * 1000;

  function tick(now) {
    const elapsed = now - timerStart;
    const pct = Math.min((elapsed / duration) * 100, 100);
    progressBar.style.transition = 'none';
    progressBar.style.width = pct + '%';
    const remaining = Math.ceil((duration - elapsed) / 1000);
    timerLabel.textContent = remaining + 's';

    // Beep every second
    const elapsedSec = Math.floor(elapsed / 1000);
    if (elapsedSec > lastTickSecond && elapsed < duration) {
      lastTickSecond = elapsedSec;
      playTick();
    }

    if (elapsed >= duration) {
      playAdvanceBeep();
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
  lastTickSecond = -1;
}

function setPlaying(val) {
  state.playing = val;
  playIcon.style.display  = val ? 'none' : '';
  pauseIcon.style.display = val ? '' : 'none';
  if (val) {
    startTimer();
  } else {
    stopTimer();
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
    chip.textContent = ct.symbol;
    grid.appendChild(chip);
  });
}

buildNotesGrid();
buildChordsGrid();

// Chip click delegation
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
  if (state.playing) startTimer();
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

// ─── MIC TOGGLE ────────────────────────────────────────────────────────────

micBtn.addEventListener('click', () => {
  if (state.micActive) stopMic();
  else startMic();
});

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
  if (panel.classList.contains('open')) {
    if (e.key === 'Escape') closeSettingsPanel();
    return;
  }
  if (e.code === 'Space')      { e.preventDefault(); setPlaying(!state.playing); }
  if (e.code === 'ArrowRight') goForward();
  if (e.code === 'ArrowLeft')  goBack();
  if (e.key === 's')           openPanel();
  if (e.key === 'm')           { if (state.micActive) stopMic(); else startMic(); }
});

// Final UI update
updateModeUI();
