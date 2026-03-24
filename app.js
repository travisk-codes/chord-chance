/* ═══════════════════════════════════════════════════════════
   Chord Chance – main application
   ═══════════════════════════════════════════════════════════ */

// ── Music Data ────────────────────────────────────────────────

const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Every chromatic pitch class indexed 0-11
const SEMITONE_TO_SHARP = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const SEMITONE_TO_FLAT  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];

const NOTE_TO_SEMITONE = {
  'C':0,'C♯':1,'D♭':1,'D':2,'D♯':3,'E♭':3,
  'E':4,'F':5,'F♯':6,'G♭':6,'G':7,'G♯':8,
  'A♭':8,'A':9,'A♯':10,'B♭':10,'B':11,
};

// Enharmonic pairs shown beneath accidental notes
const ENHARMONIC = {
  'C♯':'D♭','D♭':'C♯','D♯':'E♭','E♭':'D♯',
  'F♯':'G♭','G♭':'F♯','G♯':'A♭','A♭':'G♯',
  'A♯':'B♭','B♭':'A♯',
};

// All sharps & flats (semitones 1,3,6,8,10 have both)
const SHARPS = ['C♯','D♯','F♯','G♯','A♯'];
const FLATS  = ['D♭','E♭','G♭','A♭','B♭'];

// Chord definitions: intervals from root (semitones), display suffix
const CHORD_DEFS = {
  'maj':   { intervals:[0,4,7],       suffix:''       },
  'min':   { intervals:[0,3,7],       suffix:'m'      },
  '7':     { intervals:[0,4,7,10],    suffix:'7'      },
  'maj7':  { intervals:[0,4,7,11],    suffix:'maj7'   },
  'min7':  { intervals:[0,3,7,10],    suffix:'m7'     },
  'sus2':  { intervals:[0,2,7],       suffix:'sus2'   },
  'sus4':  { intervals:[0,5,7],       suffix:'sus4'   },
  'dim':   { intervals:[0,3,6],       suffix:'dim'    },
  'aug':   { intervals:[0,4,8],       suffix:'aug'    },
  '5':     { intervals:[0,7],         suffix:'5'      },
  'add9':  { intervals:[0,2,4,7],     suffix:'add9'   },
  '6':     { intervals:[0,4,7,9],     suffix:'6'      },
  'min6':  { intervals:[0,3,7,9],     suffix:'m6'     },
  'dim7':  { intervals:[0,3,6,9],     suffix:'dim7'   },
  'm7b5':  { intervals:[0,3,6,10],    suffix:'m7♭5'   },
};

// ── State ──────────────────────────────────────────────────────

const state = {
  mode:         'note',      // 'note' | 'chord'
  interval:     10,          // seconds
  playing:      true,
  naturals:     new Set(NATURALS),
  sharps:       true,
  flats:        true,
  chordTypes:   new Set(Object.keys(CHORD_DEFS)),

  current:      null,        // { root, chordType } or { note }
  timerStart:   0,
  animFrame:    null,
  timeoutId:    null,

  // Audio
  micActive:    false,
  audioCtx:     null,
  analyser:     null,
  micStream:    null,
  audioLoop:    null,
  feedbackState:'neutral',   // 'neutral'|'correct'|'wrong'
};

// ── DOM References ─────────────────────────────────────────────

const $ = id => document.getElementById(id);
const card           = $('card');
const noteRoot       = $('note-root');
const chordSuffix    = $('chord-suffix');
const enharmonicEl   = $('enharmonic');
const feedbackLabel  = $('feedback-label');
const progressBar    = $('progress-bar');
const iconPause      = $('icon-pause');
const iconPlay       = $('icon-play');
const intervalSlider = $('interval-slider');
const intervalVal    = $('interval-val');
const cbSharps       = $('cb-sharps');
const cbFlats        = $('cb-flats');
const audioLevel     = $('audio-level');
const audioBar       = $('audio-bar');
const settingsOverlay= $('settings-overlay');

// ── Note Pool ─────────────────────────────────────────────────

function buildNotePool() {
  const pool = [];
  for (const n of NATURALS) {
    if (state.naturals.has(n)) pool.push(n);
  }
  if (state.sharps) {
    for (const n of SHARPS) {
      // include if the natural root of the sharp is selected
      // e.g. C♯ → root C; D♯ → root D etc.
      const natural = n[0];
      if (state.naturals.has(natural)) pool.push(n);
    }
  }
  if (state.flats) {
    for (const n of FLATS) {
      // E♭ → root E, etc.
      const natural = n[0];
      if (state.naturals.has(natural)) pool.push(n);
    }
  }
  return pool.length ? pool : ['C'];
}

function buildChordPool() {
  const rootPool = buildNotePool();
  const types    = [...state.chordTypes];
  if (!types.length) return [{ root:'C', type:'maj' }];
  const pool = [];
  for (const root of rootPool) {
    for (const type of types) {
      pool.push({ root, type });
    }
  }
  return pool;
}

// ── Pick Random ───────────────────────────────────────────────

function pickRandom() {
  if (state.mode === 'note') {
    const pool = buildNotePool();
    let note;
    do { note = pool[Math.floor(Math.random() * pool.length)]; }
    while (pool.length > 1 && state.current?.note === note);
    state.current = { note };
  } else {
    const pool = buildChordPool();
    let pick;
    do { pick = pool[Math.floor(Math.random() * pool.length)]; }
    while (pool.length > 1 &&
           state.current?.root === pick.root &&
           state.current?.type === pick.type);
    state.current = { root: pick.root, type: pick.type };
  }
}

// ── Display ───────────────────────────────────────────────────

function updateDisplay() {
  // trigger animation
  card.classList.remove('note-change');
  void card.offsetWidth; // reflow
  card.classList.add('note-change');

  if (state.mode === 'note') {
    noteRoot.textContent    = state.current.note;
    chordSuffix.textContent = '';
    enharmonicEl.textContent = ENHARMONIC[state.current.note]
      ? `= ${ENHARMONIC[state.current.note]}`
      : '';
  } else {
    const def = CHORD_DEFS[state.current.type];
    noteRoot.textContent    = state.current.root;
    chordSuffix.textContent = def.suffix;
    enharmonicEl.textContent = ENHARMONIC[state.current.root]
      ? `${ENHARMONIC[state.current.root]}${def.suffix}`
      : '';
  }

  setCardState('neutral');
}

function setCardState(s) {
  state.feedbackState = s;
  card.className = `state-${s}`;
  const labels = { neutral:'', correct:'✓ Correct!', wrong:'✗ Keep trying…' };
  feedbackLabel.textContent = labels[s] ?? '';
  feedbackLabel.style.color =
    s === 'correct' ? 'var(--correct)' :
    s === 'wrong'   ? 'var(--wrong)'   : 'var(--text-muted)';
  progressBar.style.background =
    s === 'correct' ? 'var(--correct)' :
    s === 'wrong'   ? 'var(--wrong)'   : 'var(--accent)';
}

// ── Timer ─────────────────────────────────────────────────────

function startTimer() {
  clearTimeout(state.timeoutId);
  cancelAnimationFrame(state.animFrame);
  state.timerStart = performance.now();

  function tick() {
    if (!state.playing) return;
    const elapsed = (performance.now() - state.timerStart) / 1000;
    const frac    = Math.min(elapsed / state.interval, 1);
    progressBar.style.transform = `scaleX(${1 - frac})`;
    if (frac < 1) {
      state.animFrame = requestAnimationFrame(tick);
    }
  }
  tick();

  state.timeoutId = setTimeout(() => {
    if (state.playing) advance();
  }, state.interval * 1000);
}

function stopTimer() {
  clearTimeout(state.timeoutId);
  cancelAnimationFrame(state.animFrame);
}

function advance() {
  pickRandom();
  updateDisplay();
  if (state.playing) startTimer();
}

function setPlaying(val) {
  state.playing = val;
  iconPause.classList.toggle('hidden', !val);
  iconPlay.classList.toggle('hidden',  val);
  if (val) {
    state.timerStart = performance.now();
    startTimer();
  } else {
    stopTimer();
    progressBar.style.transform = 'scaleX(1)';
  }
}

// ── Audio Feedback ────────────────────────────────────────────

// Autocorrelation pitch detector (YIN-like)
function detectPitch(floatData, sampleRate) {
  const n = floatData.length;
  const half = Math.floor(n / 2);

  // RMS check – silence
  let rms = 0;
  for (let i = 0; i < n; i++) rms += floatData[i] * floatData[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null;

  // Autocorrelation
  const corr = new Float32Array(half);
  for (let lag = 0; lag < half; lag++) {
    let sum = 0;
    for (let i = 0; i < half; i++) sum += floatData[i] * floatData[i + lag];
    corr[lag] = sum;
  }

  // Find first peak after initial drop
  let start = 1;
  while (start < half - 1 && corr[start] > corr[start + 1]) start++;

  let bestLag = start, bestVal = -Infinity;
  for (let i = start; i < half; i++) {
    if (corr[i] > bestVal) { bestVal = corr[i]; bestLag = i; }
  }

  if (bestVal / corr[0] < 0.4) return null; // weak correlation

  // Parabolic interpolation for sub-sample accuracy
  const x0 = bestLag > 0     ? corr[bestLag - 1] : corr[bestLag];
  const x2 = bestLag < half - 1 ? corr[bestLag + 1] : corr[bestLag];
  const refinedLag = bestLag + (x2 - x0) / (2 * (2 * corr[bestLag] - x0 - x2) || 1);
  return sampleRate / refinedLag;
}

// Build a chroma vector from FFT magnitude data
function buildChroma(freqData, sampleRate, fftSize) {
  const chroma = new Float32Array(12);
  const binHz  = sampleRate / fftSize;
  for (let b = 1; b < freqData.length; b++) {
    const freq = b * binHz;
    if (freq < 60 || freq > 5000) continue;
    const midi  = 12 * Math.log2(freq / 440) + 69;
    const pc    = ((Math.round(midi) % 12) + 12) % 12;
    // freqData is 0-255 (byte); linearise
    const power = Math.pow(10, (freqData[b] - 255) / 20);
    chroma[pc] += power;
  }
  // Normalise
  const max = Math.max(...chroma, 1e-9);
  for (let i = 0; i < 12; i++) chroma[i] /= max;
  return chroma;
}

function freqToNoteName(freq) {
  const midi  = Math.round(12 * Math.log2(freq / 440) + 69);
  return SEMITONE_TO_SHARP[((midi % 12) + 12) % 12];
}

function targetSemitone() {
  const note = state.mode === 'note' ? state.current.note : state.current.root;
  return NOTE_TO_SEMITONE[note] ?? 0;
}

function expectedChromaSet() {
  const rootSt = targetSemitone();
  if (state.mode === 'note') return new Set([rootSt]);
  const ints = CHORD_DEFS[state.current.type]?.intervals ?? [0];
  return new Set(ints.map(i => (rootSt + i) % 12));
}

function evaluateAudio(floatData, byteFreqData, sampleRate, fftSize) {
  if (state.mode === 'note') {
    const freq = detectPitch(floatData, sampleRate);
    if (freq === null) return 'neutral';
    const detectedSt = ((Math.round(12 * Math.log2(freq / 440) + 69) % 12) + 12) % 12;
    return detectedSt === targetSemitone() ? 'correct' : 'wrong';
  } else {
    // Chord: check that expected pitch classes are present & prominent
    const chroma  = buildChroma(byteFreqData, sampleRate, fftSize);
    const rootSt  = targetSemitone();

    // Check overall loudness
    const rms = chroma.reduce((a, b) => a + b, 0) / 12;
    if (rms < 0.05) return 'neutral';

    const expected = expectedChromaSet();
    let score = 0;
    for (const pc of expected) score += chroma[pc];
    score /= expected.size;

    // Score > 0.55 → at least the expected notes are ringing
    if (score > 0.55) return 'correct';
    if (score < 0.25) return 'wrong';
    return 'neutral';
  }
}

async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    state.micStream = stream;
    state.audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    const source    = state.audioCtx.createMediaStreamSource(stream);

    const FFT_SIZE  = 2048;
    state.analyser  = state.audioCtx.createAnalyser();
    state.analyser.fftSize        = FFT_SIZE;
    state.analyser.smoothingTimeConstant = 0.7;
    source.connect(state.analyser);

    const floatData   = new Float32Array(FFT_SIZE);
    const byteFreqData= new Uint8Array(FFT_SIZE / 2);

    let lastResult = 'neutral';
    let sameCount  = 0;
    const CONFIRM  = 5; // frames before committing (≈ ~80 ms)

    function audioTick() {
      state.analyser.getFloatTimeDomainData(floatData);
      state.analyser.getByteFrequencyData(byteFreqData);

      // Audio level meter
      let lvl = 0;
      for (let i = 0; i < floatData.length; i++) lvl += floatData[i] * floatData[i];
      lvl = Math.sqrt(lvl / floatData.length);
      audioBar.style.width = Math.min(lvl * 400, 100) + '%';

      const result = evaluateAudio(floatData, byteFreqData,
                                   state.audioCtx.sampleRate, FFT_SIZE);

      if (result === lastResult) {
        sameCount++;
        if (sameCount >= CONFIRM) setCardState(result);
      } else {
        lastResult = result;
        sameCount  = 0;
      }

      state.audioLoop = requestAnimationFrame(audioTick);
    }
    audioTick();

    state.micActive = true;
    $('mic-btn').classList.replace('mic-off','mic-on');
    $('mic-btn').querySelector('span').textContent = 'Audio feedback on';
    audioLevel.classList.add('active');

  } catch (err) {
    alert('Could not access microphone: ' + err.message);
  }
}

function stopMic() {
  cancelAnimationFrame(state.audioLoop);
  if (state.micStream) state.micStream.getTracks().forEach(t => t.stop());
  if (state.audioCtx)  state.audioCtx.close();
  state.micActive = false;
  $('mic-btn').classList.replace('mic-on','mic-off');
  $('mic-btn').querySelector('span').textContent = 'Enable audio feedback';
  audioLevel.classList.remove('active');
  audioBar.style.width = '0%';
  setCardState('neutral');
}

// ── Settings Panel ────────────────────────────────────────────

function buildNoteCheckboxes() {
  const container = $('note-checks');
  container.innerHTML = '';
  for (const n of NATURALS) {
    container.appendChild(makeChip(n, n, state.naturals.has(n), checked => {
      if (checked) state.naturals.add(n);
      else         state.naturals.delete(n);
      guardMinOne(state.naturals, NATURALS[0]);
    }));
  }
}

function buildChordCheckboxes() {
  const container = $('chord-checks');
  container.innerHTML = '';
  for (const [key, def] of Object.entries(CHORD_DEFS)) {
    const label = def.suffix || 'maj';
    container.appendChild(makeChip(key, label, state.chordTypes.has(key), checked => {
      if (checked) state.chordTypes.add(key);
      else         state.chordTypes.delete(key);
      guardMinOne(state.chordTypes, 'maj');
    }));
  }
}

function makeChip(key, label, checked, onChange) {
  const chip = document.createElement('label');
  chip.className = 'check-chip' + (checked ? ' checked' : '');
  chip.dataset.key = key;

  const input = document.createElement('input');
  input.type    = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => {
    chip.classList.toggle('checked', input.checked);
    onChange(input.checked);
  });

  const text = document.createElement('span');
  text.textContent = label;

  chip.append(input, text);
  return chip;
}

function guardMinOne(set, fallback) {
  if (set.size === 0) {
    set.add(fallback);
    // re-check the chip
    document.querySelectorAll('.check-chip').forEach(chip => {
      if (chip.dataset.key === fallback) {
        chip.classList.add('checked');
        chip.querySelector('input').checked = true;
      }
    });
  }
}

function openSettings() {
  buildNoteCheckboxes();
  buildChordCheckboxes();
  settingsOverlay.classList.remove('hidden');
}

function closeSettings() {
  settingsOverlay.classList.add('hidden');
}

// ── Event Listeners ───────────────────────────────────────────

$('settings-btn').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', e => {
  if (e.target === settingsOverlay) closeSettings();
});

$('play-pause-btn').addEventListener('click', () => setPlaying(!state.playing));
$('next-btn').addEventListener('click', () => { advance(); });
$('prev-btn').addEventListener('click', () => {
  // Just re-randomise (no real history needed for practice)
  advance();
});

intervalSlider.addEventListener('input', () => {
  state.interval = +intervalSlider.value;
  intervalVal.textContent = state.interval + 's';
  if (state.playing) {
    stopTimer();
    startTimer();
  }
});

cbSharps.addEventListener('change', () => { state.sharps = cbSharps.checked; });
cbFlats.addEventListener('change',  () => { state.flats  = cbFlats.checked;  });

document.querySelectorAll('.pill[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.mode === state.mode) return;
    state.mode = btn.dataset.mode;
    document.querySelectorAll('.pill[data-mode]').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === state.mode));
    $('note-section').style.display  = 'block';
    $('chord-section').style.display = state.mode === 'chord' ? 'block' : 'none';
    advance();
    closeSettings();
    setTimeout(openSettings, 50);
  });
});

$('mic-btn').addEventListener('click', () => {
  if (state.micActive) stopMic();
  else startMic();
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (settingsOverlay.classList.contains('hidden')) {
    if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
    if (e.key === 'p')  setPlaying(!state.playing);
    if (e.key === 's')  openSettings();
    if (e.key === 'm')  { if (state.micActive) stopMic(); else startMic(); }
  } else {
    if (e.key === 'Escape') closeSettings();
  }
});

// ── Init ──────────────────────────────────────────────────────

(function init() {
  intervalSlider.value  = state.interval;
  intervalVal.textContent = state.interval + 's';
  cbSharps.checked = state.sharps;
  cbFlats.checked  = state.flats;

  pickRandom();
  updateDisplay();
  startTimer();
})();
