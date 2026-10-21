// The heavens' music, and what you hear up on the peak. A slow glass piano
// over a deep, soft pad and a round sub, in a reverb as big as the night; a
// melody in E that takes its time and leaves room to breathe (every third time
// round it rests, and only a few high bells and the shimmer carry on). Outside,
// thin wind at altitude, a whistle in the slit now and then. Inside, the dome's
// motor grinds low while it turns, and a meteor brings a tiny chime.
import type { Band, SoundKit } from '../../audio';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Chord = { bass: number; pad: number[] };

/** Two bars each. E major, with the colors of the ninths and elevenths left in. */
export const CHORDS: Chord[] = [
  { bass: 40, pad: [52, 59, 63, 66, 68] }, // Emaj9
  { bass: 37, pad: [56, 59, 63, 64, 66] }, // C#m11
  { bass: 33, pad: [57, 61, 64, 68, 71] }, // Amaj9
  { bass: 35, pad: [54, 59, 61, 64, 66] }, // Bsus4(9)
  { bass: 44, pad: [56, 59, 64, 66, 71] }, // E/G#
  { bass: 45, pad: [57, 61, 63, 64, 68] }, // Amaj7#11
  { bass: 42, pad: [57, 61, 64, 66, 71] }, // F#m11
  { bass: 35, pad: [54, 59, 61, 63, 66] }, // Badd9
];

/** The tune, a phrase for each chord: [note, sixteenth it starts on, how many sixteenths it rings]. */
export const MELODY: [number, number, number][][] = [
  [
    [71, 4, 6],
    [68, 10, 4],
    [66, 14, 12],
    [64, 28, 4],
  ],
  [
    [63, 2, 4],
    [64, 6, 4],
    [68, 10, 8],
    [71, 18, 12],
  ],
  [
    [73, 4, 6],
    [71, 10, 4],
    [68, 14, 6],
    [64, 20, 12],
  ],
  [
    [66, 6, 8],
    [68, 14, 4],
    [66, 18, 14],
  ],
  [
    [76, 4, 8],
    [75, 12, 4],
    [71, 16, 14],
  ],
  [
    [75, 2, 6],
    [73, 8, 4],
    [68, 12, 10],
    [69, 24, 6],
  ],
  [
    [73, 4, 6],
    [71, 10, 6],
    [69, 16, 6],
    [68, 22, 8],
  ],
  [
    [66, 4, 12],
    [63, 16, 4],
    [64, 20, 12],
  ],
];

export interface HeavensBand extends Band {
  /** How hard the dome's motor is working, 0..1. */
  motor(level: number): void;
  /** A meteor: a tiny chime. */
  meteor(): void;
}

export function buildBand(): HeavensBand {
  let kit: SoundKit | null = null;
  let motorGain: GainNode | null = null;
  let lastChime = 0;

  /** A glass piano: a struck sine with a few soft partials, ringing long into the room. */
  const glass = (k: SoundKit, at: number, midi: number, vel: number, len: number) => {
    const { ctx } = k;
    const out = ctx.createGain();
    out.gain.value = vel;
    const pan = ctx.createStereoPanner();
    pan.pan.value = (midi - 68) / 24;
    out.connect(pan);
    pan.connect(k.music);
    const wet = ctx.createGain();
    wet.gain.value = 1.3;
    pan.connect(wet).connect(k.verb);
    const echo = ctx.createGain();
    echo.gain.value = 0.18;
    pan.connect(echo).connect(k.echo);
    const ring = Math.max(2.5, len * 1.4);
    for (const [mult, amp, decay] of [
      [1, 1, ring],
      [2, 0.32, ring * 0.45],
      [3, 0.12, 1.1],
      [4.02, 0.06, 0.6],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(amp, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + decay + 0.05);
    }
  };

  /** The pad: triangles and sines a hair apart, swelling in slowly and fading slowly, mostly heard in the room. */
  const pad = (k: SoundKit, at: number, notes: number[], len: number) => {
    const { ctx } = k;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, at);
    lp.frequency.linearRampToValueAtTime(1300, at + len * 0.5);
    lp.frequency.linearRampToValueAtTime(600, at + len);
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.016, at + len * 0.3);
    g.gain.setValueAtTime(0.016, at + len * 0.62);
    g.gain.linearRampToValueAtTime(0, at + len);
    lp.connect(g);
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    g.connect(dry).connect(k.music);
    g.connect(k.verb);
    for (const n of notes)
      for (const [cents, type] of [
        [-5, 'triangle'],
        [4, 'sine'],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = hz(n);
        o.detune.value = cents;
        o.connect(lp);
        o.start(at);
        o.stop(at + len + 0.1);
      }
  };

  /** A high shimmer: a pure tone two octaves up, swelling and fading in the reverb only. */
  const shimmer = (k: SoundKit, at: number, midi: number, len: number) => {
    const { ctx } = k;
    const o = ctx.createOscillator();
    o.frequency.value = hz(midi);
    const trem = ctx.createOscillator();
    trem.frequency.value = 0.3 + Math.random() * 0.4;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.004, at + len * 0.45);
    g.gain.linearRampToValueAtTime(0, at + len);
    // The tremolo wobbles a level of its own (1 give or take a half) after the
    // swell, so the swell still starts and ends at silence: added straight onto
    // the swell, it left the tone sounding (and cut off with a click) at the end.
    const wobble = ctx.createGain();
    wobble.gain.value = 1;
    trem.connect(tremDepth).connect(wobble.gain);
    o.connect(g).connect(wobble).connect(k.verb);
    o.start(at);
    trem.start(at);
    o.stop(at + len + 0.1);
    trem.stop(at + len + 0.1);
  };

  /** Wind across the summit: a low rush that gusts, and a thin whistle where it catches the slit. */
  const wind = (k: SoundKit) => {
    const { ctx } = k;
    const bed = k.sound.loop(k.sound.noiseBuffer(6, true));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 1.2;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.06;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 240;
    gust.connect(gustDepth).connect(lp.frequency);
    gust.start();
    const level = ctx.createGain();
    level.gain.value = 0.9;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.037;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.35;
    swell.connect(swellDepth).connect(level.gain);
    swell.start();
    bed.connect(lp).connect(level).connect(k.weather);
    bed.start();
    const air = k.sound.loop(k.noise);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1150;
    bp.Q.value = 14;
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.023;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = 260;
    drift.connect(driftDepth).connect(bp.frequency);
    drift.start();
    // It comes and goes: the level swings between nothing and a little, never below
    // nothing (a negative level is still sound, just upside down: a constant hiss).
    const whistle = ctx.createGain();
    whistle.gain.value = 0.05;
    const comes = ctx.createOscillator();
    comes.frequency.value = 0.051;
    const comesDepth = ctx.createGain();
    comesDepth.gain.value = 0.05;
    comes.connect(comesDepth).connect(whistle.gain);
    comes.start();
    air.connect(bp).connect(whistle).connect(k.weather);
    air.start();
  };

  /** The dome's drive: a low electric hum and the rumble of the wheels on the ring, silent until it moves. */
  const motor = (k: SoundKit) => {
    const { ctx } = k;
    motorGain = ctx.createGain();
    motorGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    for (const [f, type, level] of [
      [47, 'sawtooth', 0.5],
      [94.3, 'sawtooth', 0.25],
      [141, 'triangle', 0.2],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(lp);
      o.start();
    }
    const rumble = k.sound.loop(k.sound.noiseBuffer(3, true));
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 140;
    const rg = ctx.createGain();
    rg.gain.value = 1.6;
    rumble.connect(rlp).connect(rg).connect(motorGain);
    rumble.start();
    // A faint whine from the gearbox.
    const whine = ctx.createOscillator();
    whine.frequency.value = 612;
    const wg = ctx.createGain();
    wg.gain.value = 0.03;
    whine.connect(wg).connect(motorGain);
    whine.start();
    lp.connect(motorGain);
    motorGain.connect(k.ambience);
  };

  return {
    bpm: 54,
    // The music is sparse, so the record's crackle is kept low under it.
    // (Its steady hiss, between the pops, is what you'd hear as static in the quiet passages.)
    crackle: 0.15,
    swing: 0,
    room: [6.5, 0.85],
    echoBeats: 1.5,
    outside: [0.05, 0.12],
    start(k) {
      kit = k;
      wind(k);
      motor(k);
    },
    play(k, at, step, bar, sixteenth) {
      const block = Math.floor(bar / 2) % CHORDS.length;
      const half = bar % 2;
      const chord = CHORDS[block];
      const cycle = Math.floor(bar / (CHORDS.length * 2));
      const blockLen = sixteenth * 32;
      if (step === 0 && half === 0) {
        pad(k, at, chord.pad, blockLen * 1.25);
        k.sound.sub(at, chord.bass, blockLen * 0.95);
      }
      // The tune; every third time round it rests and the sky has the room.
      const resting = cycle % 3 === 2;
      if (!resting)
        for (const [note, start, len] of MELODY[block])
          if (start === half * 16 + step) {
            glass(k, at, note, 0.075, len * sixteenth);
            // An octave below, very soft, under the long notes.
            if (len >= 10) glass(k, at + 0.02, note - 12, 0.025, len * sixteenth);
          }
      // A low chord tone under the start of each phrase, struck softly.
      if (step === 0 && half === 0) glass(k, at + 0.01, chord.pad[0], 0.035, 16 * sixteenth);
      // The shimmer, high over the pad.
      if (step === 8 && half === 0) shimmer(k, at, chord.pad[2] + 24, blockLen * 0.9);
      if (step === 0 && half === 1) shimmer(k, at, chord.pad[4] + 12, blockLen * 0.7);
      // When the tune rests, a few high bells, far apart.
      if (resting && (step === 4 || step === 12) && Math.random() < 0.3) k.sound.bell(at, chord.pad[1 + Math.floor(Math.random() * 4)] + 12, 0.02);
    },
    motor(level) {
      if (!kit || !motorGain) return;
      motorGain.gain.setTargetAtTime(Math.min(1, level) * 0.11, kit.ctx.currentTime, 0.25);
    },
    meteor() {
      if (!kit || kit.sound.muted) return;
      const { ctx } = kit;
      const now = ctx.currentTime;
      if (now - lastChime < 2) return;
      lastChime = now;
      // Two little glassy notes, high and fading, the second a fourth below.
      for (const [midi, delay] of [
        [100, 0],
        [95, 0.11],
      ] as const) {
        const at = now + 0.02 + delay;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(hz(midi), at);
        o.frequency.exponentialRampToValueAtTime(hz(midi) * 0.985, at + 1.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.012, at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
        o.connect(g);
        g.connect(kit.ambience);
        g.connect(kit.verb);
        o.start(at);
        o.stop(at + 1.5);
      }
    },
  };
}
