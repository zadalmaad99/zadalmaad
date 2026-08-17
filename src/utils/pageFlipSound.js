// A page turn synthesised on the fly instead of shipping an audio file:
// a short burst of noise pushed through a sweeping band-pass filter, which
// is essentially what a sheet of paper sounds like — broadband, brief, and
// brightest in the middle of the motion. Keeps the bundle unchanged and
// works offline.
const MUTE_KEY = "mushafFlipMuted";

let ctx = null;
let noiseBuffer = null;

export function isFlipMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFlipMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
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
  const len = Math.floor(audio.sampleRate * 0.32);
  noiseBuffer = audio.createBuffer(1, len, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

export function playPageFlip() {
  if (isFlipMuted()) return;
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
  src.playbackRate.value = 0.9 + Math.random() * 0.25; // no two turns identical

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  // Sweeping upward then down mimics the paper lifting and settling.
  band.frequency.setValueAtTime(700, now);
  band.frequency.exponentialRampToValueAtTime(2600, now + 0.09);
  band.frequency.exponentialRampToValueAtTime(900, now + 0.26);

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.27);

  src.connect(band).connect(gain).connect(audio.destination);
  src.start(now);
  src.stop(now + 0.3);
}
