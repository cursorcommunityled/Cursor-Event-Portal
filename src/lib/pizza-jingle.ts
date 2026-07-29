/** Original ~6s Italian-style jingle (Web Audio). No third-party audio assets. */

const DURATION_SEC = 6;

type ActiveJingle = {
  ctx: AudioContext;
  stopTimer: number;
};

let active: ActiveJingle | null = null;

function accordionTone(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  gain = 0.18
) {
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const oscC = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();

  // Accordion-ish: dual saws slightly detuned + soft triangle body
  oscA.type = "sawtooth";
  oscB.type = "sawtooth";
  oscC.type = "triangle";
  oscA.frequency.setValueAtTime(frequency, start);
  oscB.frequency.setValueAtTime(frequency * 1.006, start);
  oscC.frequency.setValueAtTime(frequency * 0.5, start);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, start);
  filter.Q.setValueAtTime(0.7, start);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  env.gain.exponentialRampToValueAtTime(gain * 0.75, start + duration * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscA.connect(filter);
  oscB.connect(filter);
  oscC.connect(filter);
  filter.connect(env);
  env.connect(destination);

  oscA.start(start);
  oscB.start(start);
  oscC.start(start);
  oscA.stop(start + duration + 0.02);
  oscB.stop(start + duration + 0.02);
  oscC.stop(start + duration + 0.02);
}

function bassTone(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env);
  env.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Tarantella-flavored original phrase in C major / A minor color. */
function scheduleJingle(ctx: AudioContext, master: GainNode, t0: number) {
  const step = 0.15; // lively 6/8 feel
  // Melody (Hz)
  const melody = [
    523.25, 659.25, 783.99, 659.25, 523.25, 659.25, // C E G E C E
    783.99, 880.0, 783.99, 659.25, 587.33, 523.25, // G A G E D C
    523.25, 659.25, 783.99, 1046.5, 880.0, 783.99, // C E G C6 A G
    659.25, 587.33, 523.25, 587.33, 659.25, 523.25, // E D C D E C
    392.0, 523.25, 659.25, 783.99, 659.25, 523.25, // G4 C E G E C
    880.0, 783.99, 659.25, 783.99, 880.0, 1046.5, // A G E G A C6
    783.99, 659.25, 587.33, 523.25, // G E D C
  ];

  melody.forEach((freq, i) => {
    const start = t0 + i * step;
    if (start - t0 >= DURATION_SEC - 0.05) return;
    const dur = Math.min(step * 0.92, t0 + DURATION_SEC - start);
    accordionTone(ctx, master, freq, start, dur, i % 6 === 0 ? 0.2 : 0.15);
  });

  // Oom-pah bass every other beat
  const bass = [130.81, 196.0, 146.83, 196.0, 130.81, 196.0, 174.61, 196.0];
  for (let i = 0; i < 16; i++) {
    const start = t0 + i * step * 2.5;
    if (start - t0 >= DURATION_SEC - 0.1) break;
    bassTone(ctx, master, bass[i % bass.length], start, step * 1.8);
  }
}

export function stopPizzaJingle() {
  if (!active) return;
  try {
    window.clearTimeout(active.stopTimer);
    const { ctx } = active;
    void ctx.close();
  } catch {
    // ignore
  }
  active = null;
}

export async function playPizzaJingle() {
  if (typeof window === "undefined") return;
  stopPizzaJingle();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // Autoplay may block until a gesture; overlay dismiss/click can unlock later.
    }
  }

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.08);
  master.gain.setValueAtTime(0.7, ctx.currentTime + DURATION_SEC - 0.45);
  master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + DURATION_SEC);
  master.connect(ctx.destination);

  scheduleJingle(ctx, master, ctx.currentTime + 0.02);

  const stopTimer = window.setTimeout(() => {
    stopPizzaJingle();
  }, DURATION_SEC * 1000 + 200);

  active = { ctx, stopTimer };
}
