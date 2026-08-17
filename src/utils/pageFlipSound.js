// A page turn synthesised on the fly instead of shipping an audio file:
// a short burst of noise pushed through a sweeping band-pass filter, which
// is essentially what a sheet of paper sounds like — broadband, brief, and
// brightest in the middle of the motion. Keeps the bundle unchanged and
// works offline.
const MODE_KEY = "mushafFlipSound";

// Two calm profiles the reader can pick between, plus silence. "soft" stays
// audible on a phone's own speaker; "whisper" is for a quiet room or
// headphones, where even that reads as loud.
export const FLIP_MODES = ["soft", "whisper", "off"];
export const FLIP_MODE_LABELS = { soft: "ناعم", whisper: "همس", off: "صامت" };

const PROFILES = {
  soft: { rate: 0.42, freq: [300, 780, 360], q: 0.4, lowpass: 1200, peak: 0.032, attack: 0.2, release: 0.8, dur: 0.9 },
  whisper: { rate: 0.32, freq: [240, 560, 280], q: 0.35, lowpass: 900, peak: 0.02, attack: 0.28, release: 1.05, dur: 1.2 },
};

let ctx = null;
let noiseBuffer = null;

export function getFlipMode() {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return FLIP_MODES.includes(v) ? v : "soft";
  } catch {
    return "soft";
  }
}

export function setFlipMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // storage unavailable — the choice just won't persist
  }
}

export function nextFlipMode(mode) {
  return FLIP_MODES[(FLIP_MODES.indexOf(mode) + 1) % FLIP_MODES.length];
}

const SPEED_KEY = "mushafFlipSpeed";
export const FLIP_SPEED_MIN = 400;
export const FLIP_SPEED_MAX = 1600;
export const FLIP_SPEED_DEFAULT = 900;

export function getFlipSpeed() {
  try {
    const n = Number(localStorage.getItem(SPEED_KEY));
    if (!n) return FLIP_SPEED_DEFAULT;
    return Math.min(FLIP_SPEED_MAX, Math.max(FLIP_SPEED_MIN, n));
  } catch {
    return FLIP_SPEED_DEFAULT;
  }
}

export function setFlipSpeed(ms) {
  try {
    localStorage.setItem(SPEED_KEY, String(ms));
  } catch {
    // storage unavailable — the choice just won't persist
  }
}

function getContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // Browsers start the context suspended until a gesture; a page turn *is*
  // a gesture, so this resolves on the first flip.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function getNoise(audio) {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(audio.sampleRate * 1.5);
  noiseBuffer = audio.createBuffer(1, len, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

export function playPageFlip(mode = getFlipMode()) {
  const p = PROFILES[mode];
  if (!p) return; // "off"
  let audio;
  try {
    audio = getContext();
  } catch {
    return;
  }
  if (!audio) return;

  const now = audio.currentTime;
  const src = audio.createBufferSource();
  src.buffer = getNoise(audio);
  src.playbackRate.value = p.rate * (0.94 + Math.random() * 0.12); // no two turns identical

  // Soft paper, not a sharp rustle: a gentle mid sweep with the harshness
  // rolled off on top, so it reads as calm rather than papery static.
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = p.q;
  band.frequency.setValueAtTime(p.freq[0], now);
  band.frequency.exponentialRampToValueAtTime(p.freq[1], now + p.dur * 0.34);
  band.frequency.exponentialRampToValueAtTime(p.freq[2], now + p.dur * 0.88);

  const tame = audio.createBiquadFilter();
  tame.type = "lowpass";
  tame.frequency.value = p.lowpass;

  // Slow fade in and a long tail — no click, no snap.
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(p.peak, now + p.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + p.release);

  src.connect(band).connect(tame).connect(gain).connect(audio.destination);
  src.start(now);
  src.stop(now + p.dur + 0.2);
}
