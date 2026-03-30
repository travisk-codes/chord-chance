// ─── DEBUG ─────────────────────────────────────────────────────────────────

const DEBUG = false; // set to true to enable verbose console output

function dbg(...args) { if (DEBUG) console.log('[CC]', ...args); }

function debugDump(label = 'dump') {
  if (!DEBUG) return;
  const rootStr = state.current.root + state.current.acc;
  const ct = CHORD_TYPES.find(c => c.val === state.current.chord);
  const rootPC = NOTE_TO_SEMITONE[rootStr] ?? null;
  const expected = (state.mode === 'chord' && ct)
    ? [...new Set(ct.intervals.map(i => (rootPC + i) % 12))].map(pc => SEMITONE_NAMES[pc])
    : null;
  const held = [...heldMidiNotes].sort((a,b)=>a-b);
  const heldNames = held.map(n => SEMITONE_NAMES[n%12] + (Math.floor(n/12)-1));
  const heldPCs   = [...new Set(held.map(n=>n%12))].map(pc=>SEMITONE_NAMES[pc]);

  // Pool snapshot
  const pool = buildPool();
  const chordPool = [...state.activeChords];
  const topNoteWeights = Object.entries(noteWeights)
    .sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([k,v]) => `${k}:${v.toFixed(2)}`).join(' ');
  const topChordWeights = Object.entries(chordWeights)
    .sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([k,v]) => `${k}:${v.toFixed(2)}`).join(' ');

  console.group(`[CC] ${label}`);
  console.log('── card ──────────────────');
  console.log('  current:     ', rootStr + (ct ? ' ' + ct.label : ' (note)'));
  console.log('  expected PCs:', expected ? expected.join(' ') : 'n/a');
  console.log('  inversion:   ', state.showInversions ? state.currentInversion : 'off');
  console.log('── input ─────────────────');
  console.log('  held notes:  ', heldNames.join(' ') || '(none)');
  console.log('  held PCs:    ', heldPCs.join(' ')   || '(none)');
  console.log('  midi raw:    ', held.join(' ')       || '(none)');
  console.log('── mode / flags ──────────');
  console.log('  mode:        ', state.mode);
  console.log('  feedbackState', state.feedbackState);
  console.log('  twoHandMode: ', state.twoHandMode);
  console.log('  earMode:     ', state.earMode);
  console.log('  showInv:     ', state.showInversions);
  console.log('  weakSpots:   ', state.weakSpotsOnly);
  console.log('  untimedMode: ', state.untimedMode);
  console.log('── pool ──────────────────');
  console.log('  notePool sz: ', pool.length, '/', ROOT_NOTES.length * 3, '(all combos)');
  console.log('  chordPool sz:', chordPool.length, '/', CHORD_TYPES.length);
  console.log('  activeNotes: ', [...state.activeNotes].join(' '));
  console.log('  activeAcc:   ', [...state.activeAcc].join(' '));
  console.log('  activeChords:', [...state.activeChords].join(' '));
  console.log('  topNoteW:    ', topNoteWeights || '(none)');
  console.log('  topChordW:   ', topChordWeights || '(none)');
  console.log('── input sources ─────────');
  console.log('  midi:        ', state.midiActive);
  console.log('  mic:         ', state.micActive);
  console.log('  desktop:     ', state.desktopActive);
  console.log('  midiMinNote: ', state.midiMinNote);
  console.log('── stats ─────────────────');
  console.log('  correct:     ', stats.correct);
  console.log('  wrong:       ', stats.wrong);
  console.log('  streak:      ', stats.streak);
  console.log('  bestStreak:  ', stats.bestStreak);
  console.log('  wrongCounted:', wrongCountedMidi);
  console.log('  penaltyTimer:', wrongPenaltyTimer !== null);
  console.groupEnd();
}

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

const NOTE_TO_SEMITONE = {
  'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11,
  'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10,
};

const SEMITONE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Interval semitone → display name
const INTERVAL_LABEL = {
  0:'1', 2:'2', 3:'♭3', 4:'3', 5:'4', 6:'♭5',
  7:'5', 8:'♭6', 9:'6', 10:'♭7', 11:'7', 14:'9', 17:'11', 21:'13'
};

// ─── STATE ─────────────────────────────────────────────────────────────────

const state = {
  mode: 'note',
  playing: false,
  interval: 5,
  micSensitivity: 5,
  ticksEnabled: true,
  autoAdvanceOnCorrect: false,
  activeNotes: new Set(ROOT_NOTES),
  activeAcc: new Set(['natural','sharp','flat']),
  activeChords: new Set(CHORD_TYPES.map(c => c.val)),
  current: { root: 'C', acc: '', chord: null },
  // audio inputs
  micActive: false,
  desktopActive: false,
  midiActive: false,
  midiAccess: null,
  audioCtx: null,
  analyser: null,
  audioStream: null,
  audioLoop: null,
  feedbackState: 'neutral',
  correctChime: true,
  midiMinNote: 0,
  midiSoundEnabled: true,
  earMode: false,
  weakSpotsOnly: false,
  bpmMode: false,
  bpm: 80,
  showInversions: false,
  currentInversion: 0,
  showDiagram: true,
  showScaleDegrees: true,
  untimedMode: false,
  showAvgTime: false,
  cardShownAt: null,
  twoHandMode: false,
};

function anyInputActive() {
  return state.micActive || state.desktopActive || state.midiActive;
}

const stats = { correct: 0, wrong: 0, streak: 0, bestStreak: 0 };
const timingEntries = []; // { ts: Date.now(), sec: number }
const MAX_TIMING = 300;

const noteWeights = {};
const chordWeights = {};
const noteStats = {};
const chordStats = {};

function saveStats() {
  try {
    localStorage.setItem('cc2_stats', JSON.stringify({
      correct: stats.correct, wrong: stats.wrong, bestStreak: stats.bestStreak,
      noteStats, chordStats, noteWeights, chordWeights,
      timingEntries: timingEntries.slice(-MAX_TIMING),
    }));
  } catch(e) {}
}

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('cc2_stats') || 'null');
    if (!s) return;
    if (typeof s.correct === 'number')    stats.correct    = s.correct;
    if (typeof s.wrong === 'number')      stats.wrong      = s.wrong;
    if (typeof s.bestStreak === 'number') stats.bestStreak = s.bestStreak;
    if (s.noteStats)    Object.assign(noteStats,    s.noteStats);
    if (s.chordStats)   Object.assign(chordStats,   s.chordStats);
    if (s.noteWeights)  Object.assign(noteWeights,  s.noteWeights);
    if (s.chordWeights) Object.assign(chordWeights, s.chordWeights);
    if (Array.isArray(s.timingEntries)) timingEntries.push(...s.timingEntries.slice(-MAX_TIMING));
  } catch(e) {}
}

// ─── SETTINGS PERSISTENCE ──────────────────────────────────────────────────

function saveSettings() {
  try {
    localStorage.setItem('cc2_settings', JSON.stringify({
      interval:             state.interval,
      micSensitivity:       state.micSensitivity,
      ticksEnabled:         state.ticksEnabled,
      autoAdvanceOnCorrect: state.autoAdvanceOnCorrect,
      activeNotes:          [...state.activeNotes],
      activeAcc:            [...state.activeAcc],
      activeChords:         [...state.activeChords],
      mode:                 state.mode,
      correctChime:         state.correctChime,
      midiMinNote:          state.midiMinNote,
      midiSoundEnabled:     state.midiSoundEnabled,
      earMode:              state.earMode,
      weakSpotsOnly:        state.weakSpotsOnly,
      bpmMode:              state.bpmMode,
      bpm:                  state.bpm,
      showInversions:       state.showInversions,
      showDiagram:          state.showDiagram,
      showScaleDegrees:     state.showScaleDegrees,
      showAvgTime:          state.showAvgTime,
      untimedMode:          state.untimedMode,
      twoHandMode:          state.twoHandMode,
    }));
  } catch(e) {}
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('cc2_settings') || 'null');
    if (!s) return;
    if (typeof s.interval === 'number')            state.interval            = s.interval;
    if (typeof s.micSensitivity === 'number')      state.micSensitivity      = s.micSensitivity;
    if (typeof s.ticksEnabled === 'boolean')       state.ticksEnabled        = s.ticksEnabled;
    if (typeof s.autoAdvanceOnCorrect === 'boolean') state.autoAdvanceOnCorrect = s.autoAdvanceOnCorrect;
    if (Array.isArray(s.activeNotes)  && s.activeNotes.length)  state.activeNotes  = new Set(s.activeNotes);
    if (Array.isArray(s.activeAcc)    && s.activeAcc.length)    state.activeAcc    = new Set(s.activeAcc);
    if (Array.isArray(s.activeChords) && s.activeChords.length) state.activeChords = new Set(s.activeChords);
    if (s.mode === 'note' || s.mode === 'chord') state.mode = s.mode;
    if (typeof s.correctChime === 'boolean') state.correctChime = s.correctChime;
    if (typeof s.midiMinNote === 'number')       state.midiMinNote       = s.midiMinNote;
    if (typeof s.midiSoundEnabled === 'boolean') state.midiSoundEnabled  = s.midiSoundEnabled;
    if (typeof s.earMode === 'boolean') state.earMode = s.earMode;
    if (typeof s.weakSpotsOnly === 'boolean') state.weakSpotsOnly = s.weakSpotsOnly;
    if (typeof s.bpmMode === 'boolean') state.bpmMode = s.bpmMode;
    if (typeof s.bpm === 'number') state.bpm = s.bpm;
    if (typeof s.showInversions === 'boolean') state.showInversions = s.showInversions;
    if (typeof s.showDiagram === 'boolean')       state.showDiagram       = s.showDiagram;
    if (typeof s.showScaleDegrees === 'boolean')  state.showScaleDegrees  = s.showScaleDegrees;
    if (typeof s.showAvgTime === 'boolean')       state.showAvgTime       = s.showAvgTime;
    if (typeof s.untimedMode === 'boolean')   state.untimedMode   = s.untimedMode;
    if (typeof s.twoHandMode === 'boolean')   state.twoHandMode   = s.twoHandMode;
  } catch(e) {}
}

// ─── THEME ─────────────────────────────────────────────────────────────────

let darkTheme = localStorage.getItem('cc2_theme') !== 'light';

function applyTheme(save = false) {
  document.documentElement.classList.toggle('light', !darkTheme);
  const meta = document.getElementById('themeColorMeta');
  if (meta) meta.content = darkTheme ? '#0d0d0f' : '#f8f5ef';
  const iconDark  = document.querySelector('#themeBtn .icon-dark');
  const iconLight = document.querySelector('#themeBtn .icon-light');
  if (iconDark)  iconDark.style.display  = darkTheme ? '' : 'none';
  if (iconLight) iconLight.style.display = darkTheme ? 'none' : '';
  if (save) localStorage.setItem('cc2_theme', darkTheme ? 'dark' : 'light');
}

// ─── POOL (cached, invalidated on settings change) ─────────────────────────

const SHARP_NOTES = new Set(['C','D','F','G','A']);
const FLAT_NOTES  = new Set(['D','E','G','A','B']);

let _cachedPool = null;
function invalidatePool() { _cachedPool = null; }

function buildPool() {
  if (_cachedPool) return _cachedPool;
  const pool = [];
  for (const note of ROOT_NOTES) {
    if (!state.activeNotes.has(note)) continue;
    if (state.activeAcc.has('natural')) pool.push({ root: note, acc: '' });
    if (state.activeAcc.has('sharp') && SHARP_NOTES.has(note)) pool.push({ root: note, acc: '#' });
    if (state.activeAcc.has('flat')  && FLAT_NOTES.has(note))  pool.push({ root: note, acc: 'b' });
  }
  _cachedPool = pool;
  return pool;
}

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedRandom(arr, keyFn, weightMap) {
  if (!arr.length) return null;
  const weights = arr.map(item => weightMap[keyFn(item)] ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function isWeak(key, statMap) {
  const s = statMap[key];
  return s && (s.c + s.w) >= 3 && s.c / (s.c + s.w) < 0.6;
}

function nextItem(avoidCurrent = true) {
  let pool = buildPool();
  if (!pool.length) return null;
  let chordPool = [...state.activeChords];
  if (state.mode === 'chord' && !chordPool.length) return null;

  const prevKey = state.current.root + state.current.acc + (state.current.chord ?? '');

  const fullPool      = pool;
  const fullChordPool = chordPool;

  if (state.weakSpotsOnly) {
    const weakNotes = pool.filter(item => isWeak(item.root + item.acc, noteStats));
    if (weakNotes.length) pool = weakNotes;
    if (state.mode === 'chord') {
      const weakChords = chordPool.filter(v => isWeak(v, chordStats));
      if (weakChords.length) chordPool = weakChords;
    }
  }

  // If the weak-spots pool is a single option that matches the current card,
  // there's no alternative — fall back to the full pool so we don't loop forever.
  const poolLocked =
    pool.length === 1 &&
    pool[0].root === state.current.root &&
    pool[0].acc  === state.current.acc  &&
    (state.mode !== 'chord' || (chordPool.length === 1 && chordPool[0] === state.current.chord));
  if (poolLocked) {
    dbg('nextItem — weak pool is only current card, falling back to full pool');
    pool      = fullPool;
    chordPool = fullChordPool;
  }

  dbg('nextItem — pool:', pool.length, 'chordPool:', chordPool.length,
      'weakSpotsOnly:', state.weakSpotsOnly, 'prev:', prevKey);

  let candidate, chord, tries = 0;
  do {
    candidate = weightedRandom(pool, item => item.root + item.acc, noteWeights);
    chord = null;
    if (state.mode === 'chord') {
      chord = weightedRandom(chordPool, v => v, chordWeights);
    }
    const key = candidate.root + candidate.acc + (chord ?? '');
    dbg(`  try ${tries + 1}: ${key}${key === prevKey ? ' ← DUPLICATE' : ''}`);
    tries++;
  } while (
    avoidCurrent && tries < 10 &&
    candidate.root === state.current.root &&
    candidate.acc  === state.current.acc  &&
    chord          === state.current.chord
  );

  const finalKey = candidate.root + candidate.acc + (chord ?? '');
  const isDupe = finalKey === prevKey;
  if (isDupe) dbg('  !! gave up after', tries, 'tries — returning duplicate');
  dbg('  → picked:', finalKey, isDupe ? '(DUPE)' : '');

  if (state.showInversions && chord) {
    const ct = CHORD_TYPES.find(c => c.val === chord);
    const maxInv = ct ? Math.min(ct.intervals.length - 1, 3) : 0;
    state.currentInversion = maxInv > 0 ? Math.floor(Math.random() * (maxInv + 1)) : 0;
  } else {
    state.currentInversion = 0;
  }

  dbg('  inversion:', state.currentInversion);
  return { root: candidate.root, acc: candidate.acc, chord };
}

// ─── AUDIO UTILITIES ───────────────────────────────────────────────────────

let beepCtx = null;

function ensureBeepCtx() {
  if (!beepCtx) beepCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (beepCtx.state === 'suspended') beepCtx.resume();
  return beepCtx;
}

function playTone(freq, vol = 0.2, dur = 0.5, type = 'triangle') {
  try {
    const ctx = ensureBeepCtx();
    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.start(now);
    osc.stop(now + dur);
  } catch(e) {}
}

function playBeep(freq = 880, vol = 0.15, dur = 0.08) { playTone(freq, vol, dur, 'sine'); }
function playTick()        { if (state.ticksEnabled) playBeep(660, 0.06, 0.04); }
function playAdvanceBeep() { playBeep(880, 0.2,  0.12); }

function playCorrectChime() {
  try {
    const ctx = ensureBeepCtx();
    const now = ctx.currentTime;
    [[1047, 0], [1319, 0.06]].forEach(([freq, delay]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);
      osc.start(now + delay);
      osc.stop(now + delay + 0.5);
    });
  } catch(e) {}
}

// ─── HINT (play note/chord tones) ──────────────────────────────────────────

function currentNoteSemitone() {
  const name = state.current.root + (state.current.acc === '#' ? '#' : state.current.acc === 'b' ? 'b' : '');
  return NOTE_TO_SEMITONE[name] ?? 0;
}

function semitoneToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function playHint() {
  ensureBeepCtx();
  const midiBase = 60 + currentNoteSemitone(); // C4 octave

  if (state.mode === 'note') {
    playTone(semitoneToFreq(midiBase), 0.3, 1.0);
  } else {
    const ct = CHORD_TYPES.find(c => c.val === state.current.chord);
    const intervals = ct?.intervals ?? [0];
    // Arpeggiate up
    intervals.forEach((interval, i) => {
      setTimeout(() => playTone(semitoneToFreq(midiBase + interval), 0.22, 0.9), i * 110);
    });
    // Then play all together
    setTimeout(() => {
      intervals.forEach(interval => playTone(semitoneToFreq(midiBase + interval), 0.15, 1.4));
    }, intervals.length * 110 + 60);
  }
}

// ─── AUTO-ADVANCE ──────────────────────────────────────────────────────────

let autoAdvanceTimer = null;

function cancelAutoAdvance() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
}

// ─── AUDIO FEEDBACK (Microphone) ───────────────────────────────────────────

function getMicThreshold() {
  // sensitivity 1 = 0.020 (needs loud signal), 10 = 0.002 (picks up quiet sounds)
  return 0.002 + (10 - state.micSensitivity) * 0.002;
}

function detectPitch(floatData, sampleRate) {
  const n = floatData.length, half = Math.floor(n / 2);

  let rms = 0;
  for (let i = 0; i < n; i++) rms += floatData[i] * floatData[i];
  rms = Math.sqrt(rms / n);
  if (rms < getMicThreshold()) return null;

  const corr = new Float32Array(half);
  for (let lag = 0; lag < half; lag++) {
    let sum = 0;
    for (let i = 0; i < half; i++) sum += floatData[i] * floatData[i + lag];
    corr[lag] = sum;
  }

  let start = 1;
  while (start < half - 1 && corr[start] > corr[start + 1]) start++;

  let bestLag = start, bestVal = -Infinity;
  for (let i = start; i < half; i++) {
    if (corr[i] > bestVal) { bestVal = corr[i]; bestLag = i; }
  }

  if (bestVal / corr[0] < 0.35) return null;

  const x0    = bestLag > 0       ? corr[bestLag - 1] : corr[bestLag];
  const x2    = bestLag < half - 1 ? corr[bestLag + 1] : corr[bestLag];
  const denom = 2 * (2 * corr[bestLag] - x0 - x2);
  const refinedLag = bestLag + (denom !== 0 ? (x2 - x0) / denom : 0);
  return sampleRate / refinedLag;
}

function buildChroma(freqData, sampleRate, fftSize) {
  const chroma = new Float32Array(12);
  const binHz  = sampleRate / fftSize;
  for (let b = 1; b < freqData.length; b++) {
    const freq = b * binHz;
    if (freq < 60 || freq > 5000) continue;
    const midi  = 12 * Math.log2(freq / 440) + 69;
    const pc    = ((Math.round(midi) % 12) + 12) % 12;
    const power = Math.pow(10, (freqData[b] - 255) / 20);
    chroma[pc] += power;
  }
  const max = Math.max(...chroma, 1e-9);
  for (let i = 0; i < 12; i++) chroma[i] /= max;
  return chroma;
}

function targetSemitone() { return currentNoteSemitone(); }

function expectedChromaSet() {
  const rootSt = targetSemitone();
  if (state.mode === 'note') return new Set([rootSt]);
  const ct = CHORD_TYPES.find(c => c.val === state.current.chord);
  return new Set((ct?.intervals ?? [0]).map(i => (rootSt + i) % 12));
}

function evaluateAudio(floatData, byteFreqData, sampleRate, fftSize) {
  if (state.mode === 'note') {
    const freq = detectPitch(floatData, sampleRate);
    if (freq === null) return { result: 'neutral', detected: null };
    const midi        = 12 * Math.log2(freq / 440) + 69;
    const detectedSt  = ((Math.round(midi) % 12) + 12) % 12;
    const detectedName = SEMITONE_NAMES[detectedSt];
    return { result: detectedSt === targetSemitone() ? 'correct' : 'wrong', detected: detectedName };
  } else {
    const chroma = buildChroma(byteFreqData, sampleRate, fftSize);
    const total  = chroma.reduce((a, b) => a + b, 0) / 12;
    if (total < 0.03) return { result: 'neutral', detected: null };
    const expected = expectedChromaSet();
    let score = 0;
    for (const pc of expected) score += chroma[pc];
    score /= expected.size;
    let maxPc = 0, maxVal = 0;
    for (let i = 0; i < 12; i++) { if (chroma[i] > maxVal) { maxVal = chroma[i]; maxPc = i; } }
    const detectedName = SEMITONE_NAMES[maxPc];
    if (score > 0.45) return { result: 'correct', detected: detectedName };
    if (score < 0.2)  return { result: 'wrong',   detected: detectedName };
    return { result: 'neutral', detected: detectedName };
  }
}

// ─── SHARED AUDIO PIPELINE ─────────────────────────────────────────────────

function startAudioPipeline(stream) {
  state.audioStream = stream;
  state.audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
  const source      = state.audioCtx.createMediaStreamSource(stream);

  const FFT_SIZE = 4096;
  state.analyser = state.audioCtx.createAnalyser();
  state.analyser.fftSize = FFT_SIZE;
  state.analyser.smoothingTimeConstant = 0.6;
  source.connect(state.analyser);

  const floatData    = new Float32Array(FFT_SIZE);
  const byteFreqData = new Uint8Array(state.analyser.frequencyBinCount);
  let lastResult = 'neutral', sameCount = 0;
  const CONFIRM = 4;

  function audioTick() {
    state.analyser.getFloatTimeDomainData(floatData);
    state.analyser.getByteFrequencyData(byteFreqData);

    let lvl = 0;
    for (let i = 0; i < floatData.length; i++) lvl += floatData[i] * floatData[i];
    audioBar.style.width = Math.min(Math.sqrt(lvl / floatData.length) * 500, 100) + '%';

    const { result, detected } = evaluateAudio(floatData, byteFreqData, state.audioCtx.sampleRate, FFT_SIZE);
    if (!state.earMode) {
      if (result === lastResult) {
        sameCount++;
        if (sameCount >= CONFIRM) setFeedbackState(result, detected);
      } else {
        lastResult = result;
        sameCount  = 0;
      }
    } else {
      lastResult = 'neutral'; sameCount = 0;
    }
    state.audioLoop = requestAnimationFrame(audioTick);
  }
  audioTick();
  audioLevel.classList.add('active');
}

function stopAudioPipeline() {
  if (state.audioLoop)  cancelAnimationFrame(state.audioLoop);
  if (state.audioStream) state.audioStream.getTracks().forEach(t => t.stop());
  if (state.audioCtx)  { state.audioCtx.close(); state.audioCtx = null; }
  state.audioStream = null;
  audioLevel.classList.remove('active');
  audioBar.style.width = '0%';
}

// ─── MICROPHONE ────────────────────────────────────────────────────────────

async function startMic() {
  if (state.desktopActive) stopDesktopAudio();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    startAudioPipeline(stream);
    state.micActive = true;
    micBtn.classList.add('active-input');
  } catch(err) {
    console.warn('Microphone access denied:', err.message);
  }
}

function stopMic() {
  cancelAutoAdvance();
  stopAudioPipeline();
  state.micActive = false;
  micBtn.classList.remove('active-input');
  setFeedbackState('neutral');
  updateStatsUI();
}

// ─── DESKTOP AUDIO ─────────────────────────────────────────────────────────

async function startDesktopAudio() {
  if (state.micActive) stopMic();
  try {
    // Request minimal video to satisfy browser requirements; stop it immediately
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl:  false,
      },
      video: { width: 1, height: 1, frameRate: 1 },
    });
    stream.getVideoTracks().forEach(t => t.stop());

    if (stream.getAudioTracks().length === 0) {
      console.warn('No audio track captured — ensure "Share tab audio" was checked');
      return;
    }

    // If user closes the share via browser UI, treat it as stopDesktopAudio
    stream.getAudioTracks()[0].addEventListener('ended', () => stopDesktopAudio());

    startAudioPipeline(stream);
    state.desktopActive = true;
    desktopAudioBtn.classList.add('active-input');
  } catch(err) {
    if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
      console.warn('Desktop audio capture failed:', err.message);
    }
  }
}

function stopDesktopAudio() {
  cancelAutoAdvance();
  stopAudioPipeline();
  state.desktopActive = false;
  desktopAudioBtn.classList.remove('active-input');
  setFeedbackState('neutral');
  updateStatsUI();
}

// ─── MIDI INPUT ────────────────────────────────────────────────────────────

const heldMidiNotes = new Set(); // MIDI note numbers currently held

let wrongPenaltyTimer = null;
let wrongCountedMidi  = false; // true if a wrong-chord penalty already fired for the current card

function cancelWrongPenalty() {
  if (wrongPenaltyTimer) { clearTimeout(wrongPenaltyTimer); wrongPenaltyTimer = null; }
}

// Record wrong immediately (called 400 ms after a wrong chord is held)
function fireWrongPenalty() {
  dbg('fireWrongPenalty — streak reset');
  wrongCountedMidi = true;
  const noteKey  = state.current.root + state.current.acc;
  const chordKey = state.current.chord;
  stats.wrong++;
  stats.streak = 0;
  noteWeights[noteKey]  = Math.min(8, (noteWeights[noteKey]  ?? 1) * 1.8);
  if (chordKey) chordWeights[chordKey] = Math.min(8, (chordWeights[chordKey] ?? 1) * 1.8);
  if (!noteStats[noteKey])  noteStats[noteKey]  = { c: 0, w: 0 };
  noteStats[noteKey].w++;
  if (chordKey) {
    if (!chordStats[chordKey]) chordStats[chordKey] = { c: 0, w: 0 };
    chordStats[chordKey].w++;
  }
  updateStatsUI();
  saveStats();
}

function chordCoverage(pcs, expected) {
  let count = 0;
  for (const pc of expected) { if (pcs.has(pc)) count++; }
  return count / expected.size;
}

function midiNoteName(n) {
  return SEMITONE_NAMES[n % 12] + (Math.floor(n / 12) - 1);
}

function evaluateMidi() {
  if (state.earMode) return;
  // Once correct is detected, don't overwrite with neutral/wrong while notes
  // are still being processed — let the auto-advance timer run to completion.
  if (state.feedbackState === 'correct') return;
  if (heldMidiNotes.size === 0) {
    cancelWrongPenalty();
    setFeedbackState('neutral');
    if (midiNoteDisplay) midiNoteDisplay.textContent = '';
    return;
  }
  dbg('evaluateMidi — held:', [...heldMidiNotes].sort((a,b)=>a-b).map(n=>SEMITONE_NAMES[n%12]+(Math.floor(n/12)-1)).join(' '));

  const heldPCs = new Set([...heldMidiNotes].map(n => n % 12));

  // Update MIDI note display
  if (midiNoteDisplay) {
    if (state.twoHandMode && state.mode === 'chord') {
      // Show each note with its octave number so the user can see span
      midiNoteDisplay.textContent = [...heldMidiNotes].sort((a, b) => a - b)
        .map(n => SEMITONE_NAMES[n % 12] + (Math.floor(n / 12) - 1)).join('  ');
    } else {
      const sortedPCs = [...heldPCs].sort((a, b) => a - b);
      midiNoteDisplay.textContent = sortedPCs.map(pc => SEMITONE_NAMES[pc]).join(' · ');
    }
  }

  // Helper: set wrong state and start penalty timer (only once per card)
  function wrongMidi(note, customMsg) {
    setFeedbackState('wrong', note, customMsg);
    if (!wrongPenaltyTimer && !wrongCountedMidi) {
      wrongPenaltyTimer = setTimeout(() => {
        wrongPenaltyTimer = null;
        if (state.feedbackState === 'wrong') fireWrongPenalty();
      }, 400);
    }
  }

  if (state.mode === 'note') {
    if (heldPCs.has(targetSemitone())) {
      cancelWrongPenalty();
      setFeedbackState('correct');
    } else {
      wrongMidi(SEMITONE_NAMES[[...heldPCs][0]]);
    }
  } else {
    // Chord mode: check coverage of expected pitch classes
    const expected = expectedChromaSet();

    let extraCount = 0;
    for (const pc of heldPCs) { if (!expected.has(pc)) extraCount++; }

    const lowestMidi = [...heldMidiNotes].sort((a, b) => a - b)[0];
    const lowestPC   = lowestMidi % 12;

    const coverage = chordCoverage(heldPCs, expected);

    // In two-hand mode allow up to 2 extra notes (one accidental per hand)
    const maxExtra = state.twoHandMode ? 2 : 1;

    // Compute root PC once for both inversion and two-hand checks
    const rootStr = state.current.root + (state.current.acc === '#' ? '#' : state.current.acc === 'b' ? 'b' : '');
    const rootPC  = NOTE_TO_SEMITONE[rootStr] ?? 0;

    dbg('chord check — coverage:', coverage.toFixed(2), 'extra:', extraCount, '/', maxExtra,
        'expected:', [...expected].map(pc=>SEMITONE_NAMES[pc]).join(' '),
        'rootPC:', SEMITONE_NAMES[rootPC]);

    if (coverage >= 0.8 && extraCount <= maxExtra) {
      // Check inversion bass if enabled
      if (state.showInversions) {
        const ct = CHORD_TYPES.find(c => c.val === state.current.chord);
        const expectedBassPC = ct ? (rootPC + ct.intervals[state.currentInversion]) % 12 : rootPC;
        dbg('inversion check — lowestPC:', SEMITONE_NAMES[lowestPC], 'expectedBass:', SEMITONE_NAMES[expectedBassPC]);
        if (lowestPC !== expectedBassPC) {
          wrongMidi(SEMITONE_NAMES[lowestPC] + ' bass');
          return;
        }
      }

      // Two-hand mode: find all notes that can start a complete ascending voicing
      // of the chord, then require two such starts ≥12 semitones apart.
      // This handles any inversion and any voicing order without octave-boundary issues.
      if (state.twoHandMode) {
        const notesForPC = {};
        for (const pc of expected) notesForPC[pc] = [];
        for (const n of heldMidiNotes) {
          const pc = n % 12;
          if (expected.has(pc)) notesForPC[pc].push(n);
        }
        for (const pc of expected) notesForPC[pc].sort((a, b) => a - b);

        // Try to build a complete ascending voicing starting from startNote.
        // PCs are ordered by ascending interval from startNote's pitch class.
        function tryVoicing(startNote) {
          const startPC = startNote % 12;
          const orderedPCs = [...expected].sort(
            (a, b) => ((a - startPC + 12) % 12) - ((b - startPC + 12) % 12)
          );
          let cursor = startNote;
          for (const pc of orderedPCs) {
            const note = notesForPC[pc].find(n => n >= cursor);
            if (note === undefined) return false;
            cursor = note + 1;
          }
          return true;
        }

        const voicingStarts = [...heldMidiNotes]
          .filter(n => expected.has(n % 12))
          .sort((a, b) => a - b)
          .filter(n => tryVoicing(n));

        const twoHandOk = voicingStarts.length >= 2 &&
          voicingStarts[voicingStarts.length - 1] - voicingStarts[0] >= 12;

        dbg('two-hand voicingStarts:', voicingStarts, twoHandOk ? '✓' : '✗');
        if (!twoHandOk) {
          wrongMidi(null, 'Play full chord in another octave');
          return;
        }
      }

      dbg('→ CORRECT');
      cancelWrongPenalty();
      setFeedbackState('correct');
    } else if (heldPCs.size > 0) {
      dbg('→ WRONG (coverage/extra fail)');
      wrongMidi(SEMITONE_NAMES[lowestPC]);
    }
  }
}

function playMidiNote(midiNote, velocity = 100) {
  if (!state.midiSoundEnabled) return;
  try {
    const ctx = ensureBeepCtx();
    const now = ctx.currentTime;
    const freq = semitoneToFreq(midiNote);
    const vol  = (velocity / 127) * 0.22;
    // Fundamental + 2nd + 3rd harmonic for a piano-ish timbre
    [[freq, 'triangle', 1.0], [freq * 2, 'sine', 0.12], [freq * 3, 'sine', 0.06]].forEach(([f, type, mul]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * mul, now + 0.004); // sharp attack
      gain.gain.exponentialRampToValueAtTime(vol * mul * 0.35, now + 0.07); // quick initial decay
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);  // long release
      osc.start(now);
      osc.stop(now + 1.9);
    });
  } catch(e) {}
}


function handleMidiMessage(e) {
  const [status, note, velocity] = e.data;
  const cmd = status & 0xf0;
  if (cmd === 0x90 || cmd === 0x80) {
    if (state.midiMinNote > 0 && note < state.midiMinNote) return;
  }
  if (cmd === 0x90 && velocity > 0) {
    heldMidiNotes.add(note);
    playMidiNote(note, velocity);
  } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
    heldMidiNotes.delete(note);
  }
  // Ignore other message types (CC, pitch bend, etc.)
  if (cmd === 0x90 || cmd === 0x80) evaluateMidi();
}

async function startMidi() {
  if (!navigator.requestMIDIAccess) {
    console.warn('Web MIDI API not supported in this browser');
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    state.midiAccess = access;
    access.inputs.forEach(input => { input.onmidimessage = handleMidiMessage; });
    access.onstatechange = e => {
      if (e.port.type === 'input' && e.port.state === 'connected') {
        e.port.onmidimessage = handleMidiMessage;
      }
    };
    state.midiActive = true;
    midiBtn.classList.add('active-input');
  } catch(err) {
    console.warn('MIDI access denied:', err.message);
  }
}

function stopMidi() {
  if (state.midiAccess) {
    state.midiAccess.inputs.forEach(input => { input.onmidimessage = null; });
    state.midiAccess = null;
  }
  heldMidiNotes.clear();
  state.midiActive = false;
  midiBtn.classList.remove('active-input');
  setFeedbackState('neutral');
  midiNoteDisplay.textContent = '';
  updateStatsUI();
}

// ─── DOM REFS ──────────────────────────────────────────────────────────────

const noteDisplay       = document.getElementById('noteDisplay');
const chordQuality      = document.getElementById('chordQuality');
const intervalDisplay   = document.getElementById('intervalDisplay');
const feedbackLabel     = document.getElementById('feedbackLabel');
const modeLabel         = document.getElementById('modeLabel');
const progressBar       = document.getElementById('progressBar');
const timerLabel        = document.getElementById('timerLabel');
const playPauseBtn      = document.getElementById('playPauseBtn');
const playIcon          = document.getElementById('playIcon');
const pauseIcon         = document.getElementById('pauseIcon');
const prevBtn           = document.getElementById('prevBtn');
const nextBtn           = document.getElementById('nextBtn');
const intervalSlider    = document.getElementById('intervalSlider');
const intervalVal       = document.getElementById('intervalVal');
const sensitivitySlider = document.getElementById('sensitivitySlider');
const sensitivityVal    = document.getElementById('sensitivityVal');
const settingsBtn       = document.getElementById('settingsBtn');
const overlay           = document.getElementById('overlay');
const panel             = document.getElementById('panel');
const closePanel        = document.getElementById('closePanel');
const chordSection      = document.getElementById('chordSection');
const notesWarn         = document.getElementById('notesWarn');
const accWarn           = document.getElementById('accWarn');
const chordsWarn        = document.getElementById('chordsWarn');
const micBtn            = document.getElementById('micBtn');
const desktopAudioBtn   = document.getElementById('desktopAudioBtn');
const midiBtn           = document.getElementById('midiBtn');
const audioLevel        = document.getElementById('audioLevel');
const audioBar          = document.getElementById('audioBar');
const hintBtn           = document.getElementById('hintBtn');
const glowOrb           = document.querySelector('.glow-orb');
const streakRow         = document.getElementById('streakRow');
const streakBadge       = document.getElementById('streakBadge');
const statCorrect       = document.getElementById('statCorrect');
const statWrong         = document.getElementById('statWrong');
const statBest          = document.getElementById('statBest');
const statAccuracy      = document.getElementById('statAccuracy');
const pianoDisplay      = document.getElementById('pianoDisplay');
const invDisplay        = document.getElementById('invDisplay');
const midiNoteDisplay   = document.getElementById('midiNoteDisplay');
const midiLowSlider     = document.getElementById('midiLowSlider');
const midiLowVal        = document.getElementById('midiLowVal');
const earChoices        = document.getElementById('earChoices');
const summaryOverlay    = document.getElementById('summaryOverlay');
const summaryPanel      = document.getElementById('summaryPanel');
const summaryBody       = document.getElementById('summaryBody');
const summaryBtn        = document.getElementById('summaryBtn');

// ─── GLOW POSITION ─────────────────────────────────────────────────────────

function updateGlowPosition() {
  const rect = noteDisplay.getBoundingClientRect();
  glowOrb.style.top  = (rect.top  + rect.height / 2) + 'px';
  glowOrb.style.left = (rect.left + rect.width  / 2) + 'px';
}
window.addEventListener('resize', updateGlowPosition);

// ─── PIANO VOICING ─────────────────────────────────────────────────────────

function buildPianoSVG(highlightPCs) {
  const WHITE = [{pc:0,x:0},{pc:2,x:13},{pc:4,x:26},{pc:5,x:39},{pc:7,x:52},{pc:9,x:65},{pc:11,x:78}];
  const BLACK = [{pc:1,x:9},{pc:3,x:22},{pc:6,x:48},{pc:8,x:61},{pc:10,x:74}];
  const W=90, H=42, BH=26;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block">`;
  WHITE.forEach(k => {
    const lit = highlightPCs.has(k.pc);
    s += `<rect x="${k.x}" y="0" width="12" height="${H}" rx="1" fill="${lit?'var(--green)':'var(--piano-white)'}" stroke="var(--piano-border)" stroke-width="0.5"/>`;
  });
  BLACK.forEach(k => {
    const lit = highlightPCs.has(k.pc);
    s += `<rect x="${k.x}" y="0" width="8" height="${BH}" rx="1" fill="${lit?'var(--green)':'var(--piano-black)'}"/>`;
  });
  return s + '</svg>';
}

// 2-octave piano (C4–B5) for inversion voicings
function buildPianoSVG2Oct(highlightMidi) {
  const hi = new Set(highlightMidi);
  const W=182, H=48, BH=30;
  const WHITE = [
    {m:60,x:0},{m:62,x:13},{m:64,x:26},{m:65,x:39},{m:67,x:52},{m:69,x:65},{m:71,x:78},
    {m:72,x:91},{m:74,x:104},{m:76,x:117},{m:77,x:130},{m:79,x:143},{m:81,x:156},{m:83,x:169},
  ];
  const BLACK = [
    {m:61,x:9},{m:63,x:22},{m:66,x:48},{m:68,x:61},{m:70,x:74},
    {m:73,x:100},{m:75,x:113},{m:78,x:139},{m:80,x:152},{m:82,x:165},
  ];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block">`;
  WHITE.forEach(k => {
    const lit = hi.has(k.m);
    s += `<rect x="${k.x}" y="0" width="12" height="${H}" rx="1" fill="${lit?'var(--green)':'var(--piano-white)'}" stroke="var(--piano-border)" stroke-width="0.5"/>`;
  });
  BLACK.forEach(k => {
    const lit = hi.has(k.m);
    s += `<rect x="${k.x}" y="0" width="8" height="${BH}" rx="1" fill="${lit?'var(--green)':'var(--piano-black)'}"/>`;
  });
  s += `<line x1="91" y1="0" x2="91" y2="${H}" stroke="var(--piano-border)" stroke-width="1" opacity="0.35"/>`;
  return s + '</svg>';
}

function getVoicingMidi(rootPC, intervals, inversion) {
  let notes = intervals.map(i => 60 + rootPC + i);
  for (let i = 0; i < inversion; i++) {
    notes[0] += 12;
    notes.sort((a, b) => a - b);
  }
  return notes;
}

const INV_LABELS = ['Root pos.', '1st inv.', '2nd inv.', '3rd inv.'];

function renderPianoVoicing(item) {
  if (!pianoDisplay) return;
  if (!item || state.mode !== 'chord' || !item.chord || !state.showDiagram) {
    pianoDisplay.style.opacity = '0';
    return;
  }
  const ct = CHORD_TYPES.find(c => c.val === item.chord);
  if (!ct) { pianoDisplay.style.opacity = '0'; return; }
  const root = item.root + (item.acc === '#' ? '#' : item.acc === 'b' ? 'b' : '');
  const rootPC = NOTE_TO_SEMITONE[root] ?? 0;

  if (state.showInversions) {
    const midiNotes = getVoicingMidi(rootPC, ct.intervals, state.currentInversion);
    pianoDisplay.innerHTML = buildPianoSVG2Oct(midiNotes);
  } else {
    const pcs = new Set(ct.intervals.map(i => (rootPC + i) % 12));
    pianoDisplay.innerHTML = buildPianoSVG(pcs);
  }
  pianoDisplay.style.opacity = '1';
}

function renderInversionLabel(item) {
  if (!invDisplay) return;
  if (!item || state.mode !== 'chord' || !item.chord || !state.showInversions) {
    invDisplay.textContent = '';
    return;
  }
  invDisplay.textContent = INV_LABELS[state.currentInversion] ?? 'Root pos.';
}

// ─── EAR TRAINING ──────────────────────────────────────────────────────────

let earHintTimer = null;
let earAnswered  = false;

function showEarChoices(item) {
  if (!earChoices) return;
  earAnswered = false;
  if (!state.earMode) { earChoices.innerHTML = ''; earChoices.style.display = 'none'; return; }

  let choices; // [{label, correct}]
  if (state.mode === 'note') {
    const correctPC   = targetSemitone();
    const correctLabel = SEMITONE_NAMES[correctPC].replace('#','♯');
    const wrongs = SEMITONE_NAMES
      .map((n, i) => ({ n, i }))
      .filter(x => x.i !== correctPC)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(x => ({ label: x.n.replace('#','♯'), correct: false }));
    choices = [{ label: correctLabel, correct: true }, ...wrongs].sort(() => Math.random() - 0.5);
  } else {
    const correctVal  = item.chord;
    const correctType = CHORD_TYPES.find(c => c.val === correctVal);
    const pool = CHORD_TYPES.filter(c => c.val !== correctVal);
    const wrongs = pool.sort(() => Math.random() - 0.5).slice(0, 3)
      .map(c => ({ label: c.label, correct: false }));
    choices = [{ label: correctType?.label ?? correctVal, correct: true }, ...wrongs]
      .sort(() => Math.random() - 0.5);
  }

  earChoices.style.display = 'grid';
  earChoices.innerHTML = '';
  const btns = choices.map(ch => {
    const btn = document.createElement('button');
    btn.className = 'ear-btn';
    btn.textContent = ch.label;
    btn._earCorrect = ch.correct;
    btn.addEventListener('click', () => handleEarChoice(ch.correct, btn, btns, item));
    earChoices.appendChild(btn);
    return btn;
  });

  const replay = document.createElement('button');
  replay.className = 'ear-replay-btn';
  replay.textContent = '↺ Replay';
  replay.title = 'Replay hint (H)';
  replay.style.gridColumn = '1 / -1';
  replay.addEventListener('click', playHint);
  earChoices.appendChild(replay);
}

function recordEarAnswer(isCorrect, item) {
  const noteKey  = item.root + item.acc;
  const chordKey = item.chord;
  if (isCorrect) {
    stats.correct++;
    stats.streak++;
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    noteWeights[noteKey]  = Math.max(1, (noteWeights[noteKey]  ?? 1) / 1.15);
    if (chordKey) chordWeights[chordKey] = Math.max(1, (chordWeights[chordKey] ?? 1) / 1.15);
    if (!noteStats[noteKey])  noteStats[noteKey]  = { c: 0, w: 0 };
    noteStats[noteKey].c++;
    if (chordKey) {
      if (!chordStats[chordKey]) chordStats[chordKey] = { c: 0, w: 0 };
      chordStats[chordKey].c++;
    }
  } else {
    stats.wrong++;
    stats.streak = 0;
    noteWeights[noteKey]  = Math.min(8, (noteWeights[noteKey]  ?? 1) * 1.8);
    if (chordKey) chordWeights[chordKey] = Math.min(8, (chordWeights[chordKey] ?? 1) * 1.8);
    if (!noteStats[noteKey])  noteStats[noteKey]  = { c: 0, w: 0 };
    noteStats[noteKey].w++;
    if (chordKey) {
      if (!chordStats[chordKey]) chordStats[chordKey] = { c: 0, w: 0 };
      chordStats[chordKey].w++;
    }
  }
  updateStatsUI();
  saveStats();
}

function handleEarChoice(isCorrect, clickedBtn, allBtns, item) {
  if (earAnswered) return;
  earAnswered = true;

  allBtns.forEach(b => {
    b.disabled = true;
    if (b._earCorrect) b.classList.add('correct');
  });
  if (!isCorrect) clickedBtn.classList.add('wrong');

  recordEarAnswer(isCorrect, item);
  setFeedbackState(isCorrect ? 'correct' : 'wrong');

  // Reveal the note/chord display
  const accChar = item.acc === '#' ? '♯' : item.acc === 'b' ? '♭' : '';
  noteDisplay.innerHTML = accChar ? `${item.root}<sup>${accChar}</sup>` : item.root;
  if (item.chord) {
    const ct = CHORD_TYPES.find(c => c.val === item.chord);
    chordQuality.textContent   = ct ? ct.label : '';
    chordQuality.style.opacity = '1';
    renderIntervalDisplay(item);
    renderPianoVoicing(item);
    renderInversionLabel(item);
  }

  cancelAutoAdvance();
  setTimeout(() => advance(), 1800);
}

// ─── SESSION SUMMARY ───────────────────────────────────────────────────────

function openSummary() {
  if (!summaryPanel) return;
  const total = stats.correct + stats.wrong;
  let html = `
    <div class="summary-overall">
      <div class="stat-row"><span>Correct</span><strong>${stats.correct}</strong></div>
      <div class="stat-row"><span>Wrong</span><strong>${stats.wrong}</strong></div>
      <div class="stat-row"><span>Accuracy</span><strong>${total > 0 ? Math.round(stats.correct/total*100)+'%' : '—'}</strong></div>
      <div class="stat-row"><span>Best streak</span><strong>${stats.bestStreak}</strong></div>
    </div>`;

  const noteEntries = Object.entries(noteStats).sort((a,b) => (b[1].w - b[1].c) - (a[1].w - a[1].c));
  if (noteEntries.length) {
    html += `<div class="summary-section-title">Notes</div>
      <table class="summary-table"><thead><tr><th>Note</th><th>✓</th><th>✗</th><th>Acc</th></tr></thead><tbody>`;
    noteEntries.forEach(([key, s]) => {
      const acc = s.c + s.w > 0 ? Math.round(s.c/(s.c+s.w)*100)+'%' : '—';
      html += `<tr><td>${key.replace('#','♯').replace('b','♭')}</td><td>${s.c}</td><td>${s.w}</td><td>${acc}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  const chordEntries = Object.entries(chordStats).sort((a,b) => (b[1].w - b[1].c) - (a[1].w - a[1].c));
  if (chordEntries.length) {
    html += `<div class="summary-section-title">Chords</div>
      <table class="summary-table"><thead><tr><th>Chord</th><th>✓</th><th>✗</th><th>Acc</th></tr></thead><tbody>`;
    chordEntries.forEach(([key, s]) => {
      const label = CHORD_TYPES.find(c => c.val === key)?.label ?? key;
      const acc = s.c + s.w > 0 ? Math.round(s.c/(s.c+s.w)*100)+'%' : '—';
      html += `<tr><td>${label}</td><td>${s.c}</td><td>${s.w}</td><td>${acc}</td></tr>`;
    });
    html += '</tbody></table>';
  }

  if (!noteEntries.length && !chordEntries.length) {
    html += `<p style="color:var(--text-dim);font-size:13px;margin-top:12px">No data yet — play some cards with an input source active.</p>`;
  }

  html += `<button class="summary-copy-btn" onclick="copySummaryToClipboard()">Copy to clipboard</button>`;
  summaryBody.innerHTML = html;
  summaryOverlay.style.display = '';
  summaryPanel.style.display   = '';
}

function copySummaryToClipboard() {
  const total = stats.correct + stats.wrong;
  let text = `Chord Chance — Session Summary\n`;
  text += `Correct: ${stats.correct}  Wrong: ${stats.wrong}  Accuracy: ${total > 0 ? Math.round(stats.correct/total*100)+'%' : '—'}  Best streak: ${stats.bestStreak}\n`;
  const noteEntries = Object.entries(noteStats).sort((a,b) => (b[1].w - b[1].c) - (a[1].w - a[1].c));
  if (noteEntries.length) {
    text += `\nNotes\n`;
    noteEntries.forEach(([key, s]) => {
      const acc = s.c + s.w > 0 ? Math.round(s.c/(s.c+s.w)*100)+'%' : '—';
      text += `  ${key.replace('#','♯').replace('b','♭')}  ✓${s.c}  ✗${s.w}  ${acc}\n`;
    });
  }
  const chordEntries = Object.entries(chordStats).sort((a,b) => (b[1].w - b[1].c) - (a[1].w - a[1].c));
  if (chordEntries.length) {
    text += `\nChords\n`;
    chordEntries.forEach(([key, s]) => {
      const label = CHORD_TYPES.find(c => c.val === key)?.label ?? key;
      const acc = s.c + s.w > 0 ? Math.round(s.c/(s.c+s.w)*100)+'%' : '—';
      text += `  ${label}  ✓${s.c}  ✗${s.w}  ${acc}\n`;
    });
  }
  navigator.clipboard.writeText(text).catch(() => {});
}

function closeSummary() {
  if (summaryOverlay) summaryOverlay.style.display = 'none';
  if (summaryPanel)   summaryPanel.style.display   = 'none';
}

// ─── FEEDBACK STATE ────────────────────────────────────────────────────────

function setFeedbackState(s, detectedNote, customMsg) {
  const prev = state.feedbackState;
  if (prev !== s) dbg('feedbackState:', prev, '→', s, detectedNote ?? customMsg ?? '');
  state.feedbackState = s;
  noteDisplay.classList.remove('state-correct', 'state-wrong');
  if (s === 'correct') noteDisplay.classList.add('state-correct');
  if (s === 'wrong')   noteDisplay.classList.add('state-wrong');
  glowOrb.classList.remove('correct', 'wrong');
  if (s !== 'neutral') glowOrb.classList.add(s);

  if (s === 'correct') {
    feedbackLabel.textContent = 'Correct';
  } else if (s === 'wrong' && customMsg) {
    feedbackLabel.textContent = customMsg;
  } else if (s === 'wrong' && detectedNote) {
    feedbackLabel.textContent = `Hearing: ${detectedNote}`;
  } else {
    feedbackLabel.textContent = '';
  }
  feedbackLabel.style.color =
    s === 'correct' ? 'var(--green)' :
    s === 'wrong'   ? 'var(--red)'   : 'var(--text-dim)';

  // Record response time on correct transition
  if (s === 'correct' && prev !== 'correct' && anyInputActive() && state.cardShownAt !== null) {
    const elapsed = (performance.now() - state.cardShownAt) / 1000;
    timingEntries.push({ ts: Date.now(), sec: elapsed });
    if (timingEntries.length > MAX_TIMING) timingEntries.shift();
    state.cardShownAt = null;
    updateAvgTimeUI();
    renderTimingChart();
    saveStats();
  }

  // Play chime on correct transition
  if (s === 'correct' && prev !== 'correct' && state.correctChime) playCorrectChime();

  // Auto-advance: trigger once when transitioning into 'correct'
  if (s === 'correct' && prev !== 'correct' && state.autoAdvanceOnCorrect && anyInputActive()) {
    cancelAutoAdvance();
    const delay = state.midiActive ? 350 : 1200;
    autoAdvanceTimer = setTimeout(() => { autoAdvanceTimer = null; advance(); }, delay);
  } else if (s !== 'correct') {
    cancelAutoAdvance();
  }
}

// ─── SESSION STATS ─────────────────────────────────────────────────────────

function recordAdvance() {
  if (!anyInputActive()) return;
  const noteKey  = state.current.root + state.current.acc;
  const chordKey = state.current.chord;

  if (state.feedbackState === 'correct') {
    stats.correct++;
    stats.streak++;
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    // Decrease weight (floor at 1)
    noteWeights[noteKey]  = Math.max(1, (noteWeights[noteKey]  ?? 1) / 1.15);
    if (chordKey) chordWeights[chordKey] = Math.max(1, (chordWeights[chordKey] ?? 1) / 1.15);
    // Per-note/chord stats
    if (!noteStats[noteKey])  noteStats[noteKey]  = { c: 0, w: 0 };
    noteStats[noteKey].c++;
    if (chordKey) {
      if (!chordStats[chordKey]) chordStats[chordKey] = { c: 0, w: 0 };
      chordStats[chordKey].c++;
    }
  } else if (state.feedbackState === 'wrong' && !wrongCountedMidi) {
    // wrongCountedMidi means the MIDI penalty timer already recorded this wrong
    stats.wrong++;
    stats.streak = 0;
    // Increase weight (cap at 8)
    noteWeights[noteKey]  = Math.min(8, (noteWeights[noteKey]  ?? 1) * 1.8);
    if (chordKey) chordWeights[chordKey] = Math.min(8, (chordWeights[chordKey] ?? 1) * 1.8);
    // Per-note/chord stats
    if (!noteStats[noteKey])  noteStats[noteKey]  = { c: 0, w: 0 };
    noteStats[noteKey].w++;
    if (chordKey) {
      if (!chordStats[chordKey]) chordStats[chordKey] = { c: 0, w: 0 };
      chordStats[chordKey].w++;
    }
  }
  // neutral = not played, no penalty
  updateStatsUI();
  saveStats();
}

function updateStatsUI() {
  const total = stats.correct + stats.wrong;
  statCorrect.textContent  = stats.correct;
  statWrong.textContent    = stats.wrong;
  statBest.textContent     = stats.bestStreak;
  statAccuracy.textContent = total > 0 ? Math.round(stats.correct / total * 100) + '%' : '—';

  if (stats.streak >= 2 && anyInputActive()) {
    streakRow.style.display = '';
    streakBadge.textContent = stats.streak;
  } else {
    streakRow.style.display = 'none';
  }
}

function windowAvg(ms) {
  const entries = ms !== null ? timingEntries.filter(e => e.ts >= Date.now() - ms) : timingEntries;
  return entries.length ? entries.reduce((s, e) => s + e.sec, 0) / entries.length : null;
}

function fmtSec(v) { return v !== null ? v.toFixed(1) + 's' : '—'; }

function updateAvgTimeUI() {
  const row = document.getElementById('avgTimeRow');
  if (!row) return;
  row.style.display = state.showAvgTime ? '' : 'none';
  if (!state.showAvgTime) return;
  const ids = { avgTime1m: 60_000, avgTime5m: 300_000, avgTime10m: 600_000, avgTime30m: 1_800_000, avgTimeAll: null };
  for (const [id, ms] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = fmtSec(windowAvg(ms));
  }
}

function renderTimingChart() {
  const wrap = document.getElementById('timingChartWrap');
  if (!wrap) return;
  if (!state.showAvgTime || timingEntries.length < 2) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';

  const W = 180, H = 70;
  const PL = 6, PR = 6, PT = 8, PB = 8;
  const cW = W - PL - PR, cH = H - PT - PB;

  // Rolling 5-point average for the line
  const ROLL = 5;
  const smooth = timingEntries.map((_, i) => {
    const slice = timingEntries.slice(Math.max(0, i - ROLL + 1), i + 1);
    return slice.reduce((s, e) => s + e.sec, 0) / slice.length;
  });

  const n   = smooth.length;
  const minY = Math.min(...smooth, ...timingEntries.map(e => e.sec));
  const maxY = Math.max(...smooth, ...timingEntries.map(e => e.sec));
  const rY   = Math.max(maxY - minY, 0.5);

  const px = i => (PL + (i / Math.max(n - 1, 1)) * cW).toFixed(2);
  const py = v  => (PT + (1 - (v - minY) / rY) * cH).toFixed(2);

  // Trend: last third vs first third
  const t = Math.max(1, Math.floor(n / 3));
  const early = smooth.slice(0, t).reduce((s, v) => s + v, 0) / t;
  const late  = smooth.slice(-t).reduce((s, v) => s + v, 0) / t;
  const diff  = (late - early) / early;
  const col   = diff < -0.07 ? 'var(--green)' : diff > 0.07 ? 'var(--red)' : 'var(--gold)';

  // Smooth line using cubic bezier between each pair of points
  let linePath = `M ${px(0)} ${py(smooth[0])}`;
  for (let i = 1; i < n; i++) {
    const x0 = parseFloat(px(i - 1)), y0 = parseFloat(py(smooth[i - 1]));
    const x1 = parseFloat(px(i)),     y1 = parseFloat(py(smooth[i]));
    const cx  = ((x0 + x1) / 2).toFixed(2);
    linePath += ` C ${cx} ${y0.toFixed(2)} ${cx} ${y1.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  // Fill under the line
  const fillPath = linePath
    + ` L ${px(n - 1)} ${(PT + cH).toFixed(2)} L ${PL} ${(PT + cH).toFixed(2)} Z`;

  // Raw dots
  const dots = timingEntries.map((e, i) =>
    `<circle cx="${px(i)}" cy="${py(e.sec)}" r="1.8" fill="${col}" opacity="0.3"/>`
  ).join('');

  const windows = [
    ['1m', windowAvg(60_000)], ['5m', windowAvg(300_000)], ['10m', windowAvg(600_000)],
    ['30m', windowAvg(1_800_000)], ['All', windowAvg(null)],
  ].map(([lbl, v]) =>
    `<span class="cw-item"><span class="cw-val">${fmtSec(v)}</span><span class="cw-lbl">${lbl}</span></span>`
  ).join('');

  wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${dots}
  <path d="${fillPath}" fill="url(#chartGrad)"/>
  <path d="${linePath}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
<div class="chart-windows">${windows}</div>
<div class="chart-count">${n} responses</div>`;
}

function clearTiming() {
  timingEntries.length = 0;
  updateAvgTimeUI();
  renderTimingChart();
  saveStats();
}

function clearStats() {
  stats.correct = 0; stats.wrong = 0; stats.streak = 0; stats.bestStreak = 0;
  Object.keys(noteStats).forEach(k => delete noteStats[k]);
  Object.keys(chordStats).forEach(k => delete chordStats[k]);
  Object.keys(noteWeights).forEach(k => delete noteWeights[k]);
  Object.keys(chordWeights).forEach(k => delete chordWeights[k]);
  clearTiming();
  updateStatsUI();
  saveStats();
}

// ─── INTERVAL DISPLAY ──────────────────────────────────────────────────────

function renderIntervalDisplay(item) {
  if (!item || state.mode !== 'chord' || !item.chord || !state.showScaleDegrees) {
    intervalDisplay.textContent = '';
    intervalDisplay.style.opacity = '0';
    return;
  }
  const ct = CHORD_TYPES.find(c => c.val === item.chord);
  if (!ct) { intervalDisplay.textContent = ''; intervalDisplay.style.opacity = '0'; return; }
  intervalDisplay.textContent = ct.intervals.map(i => INTERVAL_LABEL[i] ?? i).join(' · ');
  intervalDisplay.style.animation = 'none';
  void intervalDisplay.offsetWidth;
  intervalDisplay.style.animation = 'fadeUp 0.35s 0.2s ease forwards';
  intervalDisplay.style.opacity = '0';
}

// ─── RENDER ────────────────────────────────────────────────────────────────

function renderDisplay(item, animate = true) {
  if (!item) return;
  cancelAutoAdvance();
  cancelWrongPenalty();
  wrongCountedMidi = false;
  if (earHintTimer) { clearTimeout(earHintTimer); earHintTimer = null; }
  state.current = item;
  state.cardShownAt = performance.now();
  const _ct = item.chord ? CHORD_TYPES.find(c => c.val === item.chord) : null;
  dbg(`new card — ${item.root + item.acc} ${_ct ? _ct.label : '(note)'} inv:${state.currentInversion} ${state.twoHandMode ? '[two-hand]' : ''}`);

  const accChar     = item.acc === '#' ? '♯' : item.acc === 'b' ? '♭' : '';
  const inner       = accChar ? `${item.root}<sup>${accChar}</sup>` : item.root;
  const displayInner = state.earMode ? '?' : inner;

  if (animate) {
    noteDisplay.classList.add('flash-out');
    setTimeout(() => {
      noteDisplay.innerHTML = displayInner;
      noteDisplay.classList.remove('flash-out', 'flash-in');
      void noteDisplay.offsetWidth;
      noteDisplay.classList.add('flash-in');

      if (!state.earMode && state.mode === 'chord' && item.chord !== null) {
        const ct = CHORD_TYPES.find(c => c.val === item.chord);
        chordQuality.style.opacity   = 0;
        chordQuality.textContent     = ct ? ct.label : '';
        chordQuality.style.animation = 'none';
        void chordQuality.offsetWidth;
        chordQuality.style.opacity   = '';
        chordQuality.style.animation = 'fadeUp 0.35s 0.1s ease forwards';
      } else {
        chordQuality.textContent   = '';
        chordQuality.style.opacity = '0';
      }
      if (!state.earMode) { renderIntervalDisplay(item); renderPianoVoicing(item); renderInversionLabel(item); }
    }, 140);
  } else {
    noteDisplay.innerHTML = displayInner;
    if (!state.earMode && state.mode === 'chord' && item.chord !== null) {
      const ct = CHORD_TYPES.find(c => c.val === item.chord);
      chordQuality.textContent   = ct ? ct.label : '';
      chordQuality.style.opacity = '1';
    } else {
      chordQuality.textContent   = '';
      chordQuality.style.opacity = '0';
    }
    if (!state.earMode) { renderIntervalDisplay(item); renderPianoVoicing(item); renderInversionLabel(item); }
  }

  setFeedbackState('neutral');

  if (state.earMode) {
    showEarChoices(item);
    earHintTimer = setTimeout(() => { earHintTimer = null; playHint(); }, 700);
  } else {
    if (state.midiActive && heldMidiNotes.size > 0) evaluateMidi();
  }
  updateGlowPosition();
}

function updateModeUI() {
  const label = state.earMode ? 'Ear' : (state.mode === 'note' ? 'Note' : 'Chord');
  modeLabel.textContent = label;
  modeLabel.style.animation = 'none';
  void modeLabel.offsetWidth;
  modeLabel.style.animation = '';
  chordSection.style.display = state.mode === 'chord' ? '' : 'none';
  document.querySelectorAll('.mode-btn').forEach(b => {
    if (b.dataset.mode === 'ear') {
      b.classList.toggle('active', state.earMode);
    } else {
      b.classList.toggle('active', b.dataset.mode === state.mode && !state.earMode);
    }
  });
  if (!state.earMode) {
    if (earChoices)   { earChoices.innerHTML = ''; earChoices.style.display = 'none'; }
    if (pianoDisplay && state.mode !== 'chord') pianoDisplay.style.opacity = '0';
    if (invDisplay && state.mode !== 'chord') invDisplay.textContent = '';
  }
}

// ─── TIMER ─────────────────────────────────────────────────────────────────

let timerStart = null, rafId = null, lastTickSecond = -1;

function updateTimerUI() {
  const hide = state.untimedMode;
  document.querySelector('.progress-wrap').style.display = hide ? 'none' : '';
  timerLabel.style.display = hide ? 'none' : '';
}

function startTimer() {
  if (state.untimedMode) return;
  stopTimer();
  timerStart     = performance.now();
  lastTickSecond = -1;
  const duration = state.interval * 1000;

  function tick(now) {
    const elapsed   = now - timerStart;
    const pct       = Math.min((elapsed / duration) * 100, 100);
    progressBar.style.width = pct + '%';
    timerLabel.textContent  = Math.ceil((duration - elapsed) / 1000) + 's';

    const elapsedSec = Math.floor(elapsed / 1000);
    if (elapsedSec > lastTickSecond && elapsed < duration) {
      lastTickSecond = elapsedSec;
      playTick();
    }

    if (elapsed >= duration) { playAdvanceBeep(); advance(); return; }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

function stopTimer() {
  if (rafId) cancelAnimationFrame(rafId);
  progressBar.style.width = '0%';
  timerLabel.textContent  = '';
  lastTickSecond = -1;
}

function setPlaying(val) {
  state.playing = val;
  playIcon.style.display  = val ? 'none' : '';
  pauseIcon.style.display = val ? '' : 'none';
  if (val) { ensureBeepCtx(); startTimer(); }
  else     { stopTimer(); }
}

// ─── HISTORY ───────────────────────────────────────────────────────────────

const history = [];
let histIdx = -1;

function advanceWithHistory() {
  recordAdvance();
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

// ─── INTERVAL UI ───────────────────────────────────────────────────────────

function updateIntervalUI() {
  if (state.bpmMode) {
    intervalSlider.min   = '40';
    intervalSlider.max   = '200';
    intervalSlider.step  = '5';
    intervalSlider.value = state.bpm;
    intervalVal.textContent = state.bpm + ' BPM';
    state.interval = Math.round(60 / state.bpm * 10) / 10;
  } else {
    intervalSlider.min   = '2';
    intervalSlider.max   = '30';
    intervalSlider.step  = '1';
    intervalSlider.value = state.interval;
    intervalVal.textContent = state.interval + 's';
  }
}

// ─── INIT ──────────────────────────────────────────────────────────────────

// Expose debug helper globally: call debugDump() in the browser console,
// then paste the output here with a description of the bug.
window.debugDump = debugDump;
window.CC_DEBUG  = () => { /* flip DEBUG at runtime — reload required for full effect */ };

loadSettings();
loadStats();

(function init() {
  updateIntervalUI();
  sensitivitySlider.value    = state.micSensitivity;
  sensitivityVal.textContent = state.micSensitivity;
  if (midiLowSlider) {
    const oct = state.midiMinNote > 0 ? Math.round((state.midiMinNote - 24) / 12) : 0;
    midiLowSlider.value = oct;
    midiLowVal.textContent = oct === 0 ? 'All' : 'C' + (oct + 1);
  }
  syncToggles();

  const item = nextItem(false);
  if (item) { history.push(item); histIdx = 0; renderDisplay(item, false); }

  applyTheme();
  updateModeUI();
  updateTimerUI();
  updateAvgTimeUI();
  renderTimingChart();
  updateGlowPosition();
})();

// ─── CHIP BUILDERS ─────────────────────────────────────────────────────────

function buildNotesGrid() {
  const grid = document.getElementById('notesGrid');
  grid.innerHTML = '';
  ROOT_NOTES.forEach(n => {
    const chip = document.createElement('div');
    chip.className   = 'chip' + (state.activeNotes.has(n) ? ' on' : '');
    chip.dataset.group = 'notes';
    chip.dataset.val   = n;
    chip.textContent   = n;
    grid.appendChild(chip);
  });
}

function buildChordsGrid() {
  const grid = document.getElementById('chordsGrid');
  grid.innerHTML = '';
  CHORD_TYPES.forEach(ct => {
    const chip = document.createElement('div');
    chip.className   = 'chip' + (state.activeChords.has(ct.val) ? ' on' : '');
    chip.dataset.group = 'chords';
    chip.dataset.val   = ct.val;
    chip.textContent   = ct.symbol;
    grid.appendChild(chip);
  });
}

buildNotesGrid();
buildChordsGrid();
document.querySelectorAll('.chip[data-group="acc"]').forEach(c => {
  c.classList.toggle('on', state.activeAcc.has(c.dataset.val));
});

// Chip click delegation
document.addEventListener('click', e => {
  const chip = e.target.closest('.chip[data-group]');
  if (!chip) return;
  const group = chip.dataset.group, val = chip.dataset.val;

  if (group === 'notes') {
    if (state.activeNotes.has(val)) {
      if (state.activeNotes.size <= 1) { notesWarn.classList.add('visible'); return; }
      state.activeNotes.delete(val);
    } else {
      state.activeNotes.add(val);
    }
    notesWarn.classList.remove('visible');
    invalidatePool(); buildNotesGrid(); saveSettings();
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
    invalidatePool(); saveSettings();
  } else if (group === 'chords') {
    if (state.activeChords.has(val)) {
      if (state.activeChords.size <= 1) { chordsWarn.classList.add('visible'); return; }
      state.activeChords.delete(val);
    } else {
      state.activeChords.add(val);
    }
    chordsWarn.classList.remove('visible');
    buildChordsGrid(); saveSettings();
  }
});

// Select all / none
document.addEventListener('click', e => {
  const btn = e.target.closest('.chip-action-btn[data-group]');
  if (!btn) return;
  const group = btn.dataset.group, action = btn.dataset.action;

  if (group === 'notes') {
    if (action === 'all') ROOT_NOTES.forEach(n => state.activeNotes.add(n));
    else { state.activeNotes.clear(); state.activeNotes.add(ROOT_NOTES[0]); }
    notesWarn.classList.remove('visible');
    invalidatePool(); buildNotesGrid(); saveSettings();
  } else if (group === 'chords') {
    if (action === 'all') CHORD_TYPES.forEach(c => state.activeChords.add(c.val));
    else { state.activeChords.clear(); state.activeChords.add(CHORD_TYPES[0].val); }
    chordsWarn.classList.remove('visible');
    buildChordsGrid(); saveSettings();
  }
});

// ─── TOGGLES ───────────────────────────────────────────────────────────────

function syncToggles() {
  document.getElementById('ticksToggle').classList.toggle('on', state.ticksEnabled);
  document.getElementById('autoAdvanceToggle').classList.toggle('on', state.autoAdvanceOnCorrect);
  const ct = document.getElementById('chimeToggle');
  if (ct) ct.classList.toggle('on', state.correctChime);
  const ms = document.getElementById('midiSoundToggle');
  if (ms) ms.classList.toggle('on', state.midiSoundEnabled);
  const bt = document.getElementById('bpmModeToggle');
  if (bt) bt.classList.toggle('on', state.bpmMode);
  const wt = document.getElementById('weakSpotsToggle');
  if (wt) wt.classList.toggle('on', state.weakSpotsOnly);
  const it = document.getElementById('inversionsToggle');
  if (it) it.classList.toggle('on', state.showInversions);
  const at = document.getElementById('showAvgTimeToggle');
  if (at) at.classList.toggle('on', state.showAvgTime);
  const sd = document.getElementById('showDegreesToggle');
  if (sd) sd.classList.toggle('on', state.showScaleDegrees);
  const dt = document.getElementById('showDiagramToggle');
  if (dt) dt.classList.toggle('on', state.showDiagram);
  const ut = document.getElementById('untimedToggle');
  if (ut) ut.classList.toggle('on', state.untimedMode);
  const th = document.getElementById('twoHandToggle');
  if (th) th.classList.toggle('on', state.twoHandMode);
  if (midiLowSlider) {
    const octave = state.midiMinNote > 0 ? Math.round((state.midiMinNote - 24) / 12) : 0;
    midiLowSlider.value = octave;
    if (midiLowVal) midiLowVal.textContent = octave === 0 ? 'All' : 'C' + (octave + 1);
  }
}

document.addEventListener('click', e => {
  const tog = e.target.closest('.setting-toggle[data-key]');
  if (!tog) return;
  const key = tog.dataset.key;
  if (key === 'ticks') {
    state.ticksEnabled = !state.ticksEnabled;
    tog.classList.toggle('on', state.ticksEnabled);
    saveSettings();
  } else if (key === 'autoAdvance') {
    state.autoAdvanceOnCorrect = !state.autoAdvanceOnCorrect;
    tog.classList.toggle('on', state.autoAdvanceOnCorrect);
    if (!state.autoAdvanceOnCorrect) cancelAutoAdvance();
    saveSettings();
  } else if (key === 'chime') {
    state.correctChime = !state.correctChime;
    tog.classList.toggle('on', state.correctChime);
    saveSettings();
  } else if (key === 'midiSound') {
    state.midiSoundEnabled = !state.midiSoundEnabled;
    tog.classList.toggle('on', state.midiSoundEnabled);
    saveSettings();
  } else if (key === 'bpmMode') {
    state.bpmMode = !state.bpmMode;
    tog.classList.toggle('on', state.bpmMode);
    updateIntervalUI();
    if (state.playing) startTimer();
    saveSettings();
  } else if (key === 'weakSpots') {
    state.weakSpotsOnly = !state.weakSpotsOnly;
    tog.classList.toggle('on', state.weakSpotsOnly);
    saveSettings();
  } else if (key === 'inversions') {
    state.showInversions = !state.showInversions;
    tog.classList.toggle('on', state.showInversions);
    const cur = history[histIdx];
    if (cur && state.mode === 'chord' && !state.earMode) {
      if (state.showInversions) {
        const ct = CHORD_TYPES.find(c => c.val === cur.chord);
        const maxInv = ct ? Math.min(ct.intervals.length - 1, 3) : 0;
        state.currentInversion = maxInv > 0 ? Math.floor(Math.random() * (maxInv + 1)) : 0;
      } else {
        state.currentInversion = 0;
      }
      renderPianoVoicing(cur);
      renderInversionLabel(cur);
    }
    saveSettings();
  } else if (key === 'showAvgTime') {
    state.showAvgTime = !state.showAvgTime;
    tog.classList.toggle('on', state.showAvgTime);
    updateAvgTimeUI();
    renderTimingChart();
    saveSettings();
  } else if (key === 'showDegrees') {
    state.showScaleDegrees = !state.showScaleDegrees;
    tog.classList.toggle('on', state.showScaleDegrees);
    const cur = history[histIdx];
    if (cur) renderIntervalDisplay(cur);
    saveSettings();
  } else if (key === 'showDiagram') {
    state.showDiagram = !state.showDiagram;
    tog.classList.toggle('on', state.showDiagram);
    const cur = history[histIdx];
    if (cur) renderPianoVoicing(cur);
    saveSettings();
  } else if (key === 'untimed') {
    state.untimedMode = !state.untimedMode;
    tog.classList.toggle('on', state.untimedMode);
    if (state.untimedMode && state.playing) stopTimer();
    else if (!state.untimedMode && state.playing) startTimer();
    updateTimerUI();
    saveSettings();
  } else if (key === 'twoHand') {
    state.twoHandMode = !state.twoHandMode;
    tog.classList.toggle('on', state.twoHandMode);
    saveSettings();
  }
});

// ─── SLIDERS ───────────────────────────────────────────────────────────────

intervalSlider.addEventListener('input', () => {
  if (state.bpmMode) {
    state.bpm = parseInt(intervalSlider.value);
    state.interval = Math.round(60 / state.bpm * 10) / 10;
    intervalVal.textContent = state.bpm + ' BPM';
  } else {
    state.interval = parseInt(intervalSlider.value);
    intervalVal.textContent = state.interval + 's';
  }
  if (state.playing) startTimer();
  saveSettings();
});

sensitivitySlider.addEventListener('input', () => {
  state.micSensitivity = parseInt(sensitivitySlider.value);
  sensitivityVal.textContent = state.micSensitivity;
  saveSettings();
});

if (midiLowSlider) {
  midiLowSlider.addEventListener('input', () => {
    const oct = parseInt(midiLowSlider.value);
    state.midiMinNote = oct > 0 ? oct * 12 + 24 : 0; // oct 1 → C2(MIDI 36), oct 2 → C3(48)...
    midiLowVal.textContent = oct === 0 ? 'All' : 'C' + (oct + 1);
    saveSettings();
  });
}

// ─── MODE BUTTONS ──────────────────────────────────────────────────────────

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.mode === 'ear') {
      if (state.mode === 'note') {
        // Ear training is chord recognition; auto-switch to chord mode
        state.mode = 'chord';
        state.earMode = true;
      } else {
        state.earMode = !state.earMode;
      }
      updateModeUI();
      const cur = history[histIdx];
      if (cur) renderDisplay(cur, false);
      saveSettings();
      return;
    }
    // note or chord
    if (btn.dataset.mode === state.mode && !state.earMode) return;
    state.mode = btn.dataset.mode;
    state.earMode = false;
    updateModeUI();
    const item = nextItem(false);
    if (item) { history.length = 0; history.push(item); histIdx = 0; renderDisplay(item); }
    if (state.playing) startTimer();
    saveSettings();
  });
});

// ─── CONTROLS ──────────────────────────────────────────────────────────────

playPauseBtn.addEventListener('click', () => setPlaying(!state.playing));
prevBtn.addEventListener('click', () => goBack());
nextBtn.addEventListener('click', () => goForward());
noteDisplay.addEventListener('click', () => goForward());
hintBtn.addEventListener('click', playHint);

// ─── SWIPE GESTURES ────────────────────────────────────────────────────────

let touchStartX = 0, touchStartY = 0;

document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (panel.classList.contains('open')) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) goForward();
    else        goBack();
  }
}, { passive: true });

// ─── MIC ───────────────────────────────────────────────────────────────────

micBtn.addEventListener('click', () => {
  if (state.micActive) stopMic(); else startMic();
});

desktopAudioBtn.addEventListener('click', () => {
  if (state.desktopActive) stopDesktopAudio(); else startDesktopAudio();
});

midiBtn.addEventListener('click', () => {
  if (state.midiActive) stopMidi(); else startMidi();
});

// Hide MIDI button on browsers that don't support Web MIDI
if (!navigator.requestMIDIAccess) midiBtn.style.display = 'none';

// ─── THEME TOGGLE ──────────────────────────────────────────────────────────

document.getElementById('themeBtn').addEventListener('click', () => {
  darkTheme = !darkTheme;
  applyTheme(true);
});

// ─── SETTINGS PANEL ────────────────────────────────────────────────────────

function openPanel()          { overlay.classList.add('open'); panel.classList.add('open'); }
function closeSettingsPanel() { overlay.classList.remove('open'); panel.classList.remove('open'); }

settingsBtn.addEventListener('click', openPanel);
overlay.addEventListener('click', closeSettingsPanel);
closePanel.addEventListener('click', closeSettingsPanel);

document.getElementById('clearStatsBtn').addEventListener('click', clearStats);
const clearTimingBtn = document.getElementById('clearTimingBtn');
if (clearTimingBtn) clearTimingBtn.addEventListener('click', clearTiming);
if (summaryBtn) summaryBtn.addEventListener('click', openSummary);
if (summaryOverlay) summaryOverlay.addEventListener('click', closeSummary);
const closeSummaryBtn = document.getElementById('closeSummary');
if (closeSummaryBtn) closeSummaryBtn.addEventListener('click', closeSummary);

// ─── RESET ─────────────────────────────────────────────────────────────────

document.getElementById('resetBtn').addEventListener('click', () => {
  state.interval = 5;                intervalSlider.value = 5;    intervalVal.textContent = '5s';
  state.micSensitivity = 5;         sensitivitySlider.value = 5; sensitivityVal.textContent = '5';
  state.ticksEnabled = true;
  state.autoAdvanceOnCorrect = false;
  state.correctChime = true;
  state.midiMinNote = 0;
  state.midiSoundEnabled = true;
  state.earMode = false;
  state.weakSpotsOnly = false;
  state.bpmMode = false;
  state.bpm = 80;
  state.showInversions = false;
  state.currentInversion = 0;
  state.showDiagram = true;
  state.showScaleDegrees = true;
  state.showAvgTime = false;
  state.untimedMode = false;
  state.twoHandMode = false;
  if (midiLowSlider) { midiLowSlider.value = 0; midiLowVal.textContent = 'All'; }
  updateIntervalUI();
  syncToggles();
  updateModeUI();
  updateTimerUI();
  state.activeNotes  = new Set(ROOT_NOTES);
  state.activeAcc    = new Set(['natural','sharp','flat']);
  state.activeChords = new Set(CHORD_TYPES.map(c => c.val));
  invalidatePool();
  buildNotesGrid();
  buildChordsGrid();
  document.querySelectorAll('.chip[data-group="acc"]').forEach(c => c.classList.add('on'));
  [notesWarn, accWarn, chordsWarn].forEach(w => w.classList.remove('visible'));
  if (state.playing) startTimer();
  saveSettings();
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
  if (e.key === 'm') { if (state.micActive) stopMic(); else startMic(); }
  if (e.key === 'd') { if (state.desktopActive) stopDesktopAudio(); else startDesktopAudio(); }
  if (e.key === 'h') playHint();
  if (e.key === 'e') {
    if (state.mode === 'note') { state.mode = 'chord'; state.earMode = true; }
    else state.earMode = !state.earMode;
    updateModeUI();
    const cur = history[histIdx];
    if (cur) renderDisplay(cur, false);
    saveSettings();
  }
});
