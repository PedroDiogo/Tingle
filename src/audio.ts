let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientStarted = false;
let ambientPad: GainNode | null = null;
let ambientLevel = 1;

function ensureCtx(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensureCtx();
}

export function playNote(freq: number) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime;
  const dur = 0.7;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(1.0, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  gain.connect(master);

  const sine = ctx.createOscillator();
  sine.type = "sine";
  sine.frequency.value = freq;
  sine.connect(gain);
  sine.start(t0);
  sine.stop(t0 + dur);

  const tri = ctx.createOscillator();
  tri.type = "triangle";
  tri.frequency.value = freq * 2;
  const triGain = ctx.createGain();
  triGain.gain.value = 0.15;
  tri.connect(triGain).connect(gain);
  tri.start(t0);
  tri.stop(t0 + dur);
}

export function setAmbientLevel(level: number) {
  ambientLevel = Math.max(0, Math.min(1, level));
  if (!ctx || !ambientPad) return;
  const target = Math.max(0.0001, 0.12 * ambientLevel);
  const now = ctx.currentTime;
  ambientPad.gain.cancelScheduledValues(now);
  ambientPad.gain.setValueAtTime(Math.max(0.0001, ambientPad.gain.value), now);
  ambientPad.gain.exponentialRampToValueAtTime(target, now + 1.2);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playPiano(midi: number, velocity: number = 1) {
  if (!ctx || !master) return;
  const freq = midiToFreq(midi);
  const t0 = ctx.currentTime;
  const dur = 1.4;
  const peak = 0.9 * Math.max(0.2, Math.min(1, velocity));

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.25 * peak, t0 + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = Math.min(6000, freq * 6);
  filter.Q.value = 0.5;

  gain.connect(filter).connect(master);

  const sine = ctx.createOscillator();
  sine.type = "sine";
  sine.frequency.value = freq;
  sine.connect(gain);
  sine.start(t0);
  sine.stop(t0 + dur);

  const tri = ctx.createOscillator();
  tri.type = "triangle";
  tri.frequency.value = freq * 2;
  const triGain = ctx.createGain();
  triGain.gain.value = 0.12;
  tri.connect(triGain).connect(gain);
  tri.start(t0);
  tri.stop(t0 + dur);

  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  saw.frequency.value = freq;
  saw.detune.value = 6;
  const sawGain = ctx.createGain();
  sawGain.gain.value = 0.05;
  saw.connect(sawGain).connect(gain);
  saw.start(t0);
  saw.stop(t0 + dur);
}

export function startAmbient() {
  if (ambientStarted) return;
  const c = ensureCtx();
  if (!master) return;
  ambientStarted = true;

  // Soft C-major pad: C3, G3, E4, G4. Sine + tiny triangle harmonic.
  const notes = [130.81, 196.0, 329.63, 392.0];
  const pad = c.createGain();
  pad.gain.value = 0.0001;
  pad.connect(master);
  ambientPad = pad;
  // gentle fade-in — target scales with current ambientLevel
  pad.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.12 * ambientLevel), c.currentTime + 6);

  // slow breathing LFO on pad gain
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.06; // ~17s period
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain).connect(pad.gain);
  lfo.start();

  for (const f of notes) {
    const voice = c.createGain();
    voice.gain.value = 1 / notes.length;
    voice.connect(pad);

    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.value = f;
    // tiny random detune for warmth
    o1.detune.value = (Math.random() - 0.5) * 6;
    o1.connect(voice);
    o1.start();

    const o2 = c.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = f * 2;
    const o2g = c.createGain();
    o2g.gain.value = 0.08;
    o2.connect(o2g).connect(voice);
    o2.start();

    // per-voice slow shimmer
    const shimmer = c.createOscillator();
    shimmer.frequency.value = 0.04 + Math.random() * 0.05;
    const shimmerGain = c.createGain();
    shimmerGain.gain.value = 0.15;
    shimmer.connect(shimmerGain).connect(voice.gain);
    shimmer.start();
  }
}
