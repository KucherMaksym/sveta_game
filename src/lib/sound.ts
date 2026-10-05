// Game sound effects (generated with ElevenLabs, files in /public/sounds).
// Web Audio instead of <audio>: no start-up lag, and once the context is unlocked by a tap
// it can play at any moment, which iOS otherwise only allows right inside a user gesture.

export type Sound = 'tick' | 'go' | 'reveal' | 'phase' | 'join' | 'yes' | 'no' | 'guess' | 'win' | 'lose';

const SOUNDS: Sound[] = ['tick', 'go', 'reveal', 'phase', 'join', 'yes', 'no', 'guess', 'win', 'lose'];
const VOLUME: Partial<Record<Sound, number>> = { tick: 0.45, join: 0.7, guess: 0.7 };
const MUTE_KEY = 'sgn-sound-off';

let ctx: AudioContext | null = null;
const buffers = new Map<Sound, AudioBuffer>();
const listeners = new Set<() => void>();
let muted = false;
try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
} catch {}

/** Call from a click/tap handler: creates and resumes the audio context and loads every sound. */
export function unlockSounds() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    ctx = new AudioContext();
    for (const name of SOUNDS) {
      fetch(`/sounds/${name}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx!.decodeAudioData(data))
        .then((buf) => buffers.set(name, buf))
        .catch(() => {});
    }
  }
  void ctx.resume();
}

export function playSound(name: Sound) {
  const buf = buffers.get(name);
  if (muted || !ctx || !buf) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = VOLUME[name] ?? 0.85;
  src.buffer = buf;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {}
  if (!value) unlockSounds();
  for (const fn of listeners) fn();
}

export function subscribeMuted(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
