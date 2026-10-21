// The living word's music and weather. A slow heartbeat under a choir that
// breathes in and out on four warm chords in E flat; a melody on something like
// a soft glass flute that comes and goes, singing a while and then resting;
// little glassy runs falling into a long echo now and then, like proteins
// folding; and all round, the cell itself: a low warm wash of flow, bubbles, a
// drop now and then. Everything rings in a very big room. No recordings.
import type { Band, SoundKit } from '../../audio';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Two bars each: Ebmaj9, Cm9, Abmaj9(#11), Bbsus. */
export const CHORDS: { bass: number; notes: number[] }[] = [
  { bass: 39, notes: [55, 58, 62, 65] },
  { bass: 36, notes: [55, 58, 62, 63] },
  { bass: 44, notes: [55, 60, 62, 63] },
  { bass: 46, notes: [53, 58, 60, 63] },
];

/** The melody's phrases, [note, sixteenths] (0 is a rest), each eight bars: once round the chords. */
export const TUNES: [number, number][][] = [
  [[70, 8], [72, 4], [74, 4], [75, 12], [0, 4], [74, 8], [72, 4], [70, 4], [67, 12], [0, 4], [72, 6], [74, 2], [75, 8], [77, 4], [75, 4], [74, 8], [72, 8], [70, 8], [0, 16]],
  [[79, 12], [77, 4], [75, 8], [74, 8], [75, 8], [74, 4], [72, 4], [70, 16], [72, 4], [75, 4], [79, 8], [77, 8], [75, 8], [74, 6], [72, 2], [70, 8], [0, 16]],
  [[67, 4], [70, 4], [72, 8], [70, 8], [67, 8], [70, 6], [72, 2], [74, 8], [72, 16], [75, 8], [74, 4], [72, 4], [74, 16], [72, 6], [70, 2], [72, 8], [0, 16]],
];
/** Which phrase each time round the chords: the first time just the choir, and a rest every few. */
const PLAN = [-1, 0, 1, -1, 2, 0, -1, 1, 2, -1];

/** How many sixteenths a phrase lasts. */
export const length = (tune: [number, number][]) => tune.reduce((n, [, d]) => n + d, 0);

export function buildBand(): Band {
  let tuneNote = 0;
  let tuneNext = -1;
  let tune: [number, number][] | null = null;

  /** One choir voice: soft triangles and a quiet saw through "oh" formants, swelling in and out. */
  const choir = (k: SoundKit, at: number, midi: number, len: number, vel: number, pan: number) => {
    const { ctx } = k;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + len * 0.32);
    out.gain.linearRampToValueAtTime(vel * 0.8, at + len * 0.7);
    out.gain.linearRampToValueAtTime(0, at + len);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    out.connect(p);
    p.connect(k.music);
    const wet = ctx.createGain();
    wet.gain.value = 1.3;
    p.connect(wet).connect(k.verb);
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.2 + Math.random() * 0.8;
    const vd = ctx.createGain();
    vd.gain.value = 5;
    vib.connect(vd);
    vib.start(at);
    vib.stop(at + len + 0.1);
    const src = ctx.createGain();
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 1500;
    warm.Q.value = 0.5;
    src.connect(warm);
    for (const [type, cents, amp] of [
      ['triangle', -6, 1],
      ['triangle', 7, 1],
      ['sawtooth', 2, 0.28],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi);
      o.detune.value = cents;
      vd.connect(o.detune);
      k.wow.connect(o.detune);
      o.onended = () => k.wow.disconnect(o.detune);
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(src);
      o.start(at);
      o.stop(at + len + 0.1);
    }
    // "Oh": the body of the vowel, plus a little of the plain tone underneath for warmth.
    [
      [420, 4, 1],
      [820, 5, 0.45],
      [2700, 6, 0.08],
    ].forEach(([f, q, amp]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = amp;
      warm.connect(bp).connect(g).connect(out);
    });
    const plain = ctx.createGain();
    plain.gain.value = 0.25;
    warm.connect(plain).connect(out);
  };

  /** The tune's instrument: a soft rounded tone, like a glass flute, with a vibrato that comes in late. */
  const flute = (k: SoundKit, at: number, midi: number, len: number, vel: number) => {
    const { ctx } = k;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + Math.min(0.22, len * 0.3));
    out.gain.setTargetAtTime(vel * 0.75, at + 0.3, len * 0.6);
    out.gain.setTargetAtTime(0, at + len * 0.92, 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.connect(out);
    out.connect(k.music);
    const wet = ctx.createGain();
    wet.gain.value = 1.1;
    out.connect(wet).connect(k.verb);
    const send = ctx.createGain();
    send.gain.value = 0.25;
    out.connect(send).connect(k.echo);
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.8;
    const vd = ctx.createGain();
    vd.gain.setValueAtTime(0, at);
    vd.gain.linearRampToValueAtTime(9, at + Math.min(1.2, len * 0.7));
    vib.connect(vd);
    vib.start(at);
    vib.stop(at + len + 0.8);
    for (const [type, mult, amp] of [
      ['sine', 1, 1],
      ['triangle', 2, 0.08],
      ['sine', 3, 0.03],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mult;
      vd.connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(lp);
      o.start(at);
      o.stop(at + len + 0.8);
    }
    // A breath at the start of each note.
    const n = ctx.createBufferSource();
    n.buffer = k.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz(midi) * 2;
    bp.Q.value = 2;
    const ng = k.sound.env(at, vel * 0.12, 0.05, 0.25);
    n.connect(bp).connect(ng).connect(out);
    n.start(at, Math.random() * 3, 0.4);
  };

  /** A glassy note: a sine with two faint bell partials, mostly heard in the echo. */
  const glass = (k: SoundKit, at: number, midi: number, vel: number, pan: number) => {
    const { ctx } = k;
    const g = k.sound.env(at, vel, 0.004, 2.4);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(k.music);
    p.connect(k.echo);
    p.connect(k.verb);
    for (const [mult, amp] of [
      [1, 1],
      [2.76, 0.12],
      [5.4, 0.04],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(at);
      o.stop(at + 2.5);
    }
  };

  /** The heart: a low soft thump, and its smaller echo just after. */
  const beat = (k: SoundKit, at: number, vel: number, pitch: number) => {
    const { ctx } = k;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(pitch, at);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.68, at + 0.16);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    // Kept soft: a deep thump this loud would make the compressor duck everything
    // four times a bar, and small speakers can't play it anyway.
    const g = k.sound.env(at, 0.2 * vel, 0.018, 0.32);
    o.connect(lp).connect(g).connect(k.music);
    o.start(at);
    o.stop(at + 0.5);
    // So it's still felt on a laptop: a short knock an octave and more up.
    const knock = ctx.createOscillator();
    knock.frequency.setValueAtTime(pitch * 2.3, at);
    knock.frequency.exponentialRampToValueAtTime(pitch * 1.7, at + 0.1);
    const kg = k.sound.env(at, 0.045 * vel, 0.006, 0.1);
    knock.connect(kg).connect(k.music);
    knock.start(at);
    knock.stop(at + 0.2);
    const n = ctx.createBufferSource();
    n.buffer = k.noise;
    const nl = ctx.createBiquadFilter();
    nl.type = 'lowpass';
    nl.frequency.value = 360;
    const ng = k.sound.env(at, 0.07 * vel, 0.01, 0.12);
    n.connect(nl).connect(ng).connect(k.music);
    n.start(at, Math.random() * 3, 0.2);
  };

  /** A round low bass under the choir. */
  const bass = (k: SoundKit, at: number, midi: number, len: number) => {
    const { ctx } = k;
    const o = ctx.createOscillator();
    o.frequency.value = hz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.1, at + 1.2);
    g.gain.setValueAtTime(0.1, at + len * 0.7);
    g.gain.linearRampToValueAtTime(0, at + len);
    o.connect(g).connect(k.music);
    o.start(at);
    o.stop(at + len + 0.1);
  };

  /** A bubble rising: a quick upward sweep of a pure tone. */
  const bubble = (k: SoundKit, at: number, f: number, vel: number, pan: number) => {
    const { ctx } = k;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * (1.8 + Math.random()), at + 0.06 + Math.random() * 0.05);
    const g = k.sound.env(at, vel, 0.003, 0.08);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(k.weather);
    // A little of it into the room, so it rings a moment.
    const send = ctx.createGain();
    send.gain.value = 0.06;
    g.connect(send).connect(k.verb);
    o.start(at);
    o.stop(at + 0.2);
  };

  return {
    bpm: 60,
    swing: 0,
    room: [6.5, 0.72],
    echoBeats: 0.75,
    outside: [0.1, 0.14],
    start(k) {
      const { ctx } = k;
      // The flow: a low, warm wash that swells and settles.
      const bed = k.sound.loop(k.sound.noiseBuffer(6, true));
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      lp.Q.value = 0.8;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.05;
      const sd = ctx.createGain();
      sd.gain.value = 120;
      swell.connect(sd).connect(lp.frequency);
      swell.start();
      const bg = ctx.createGain();
      bg.gain.value = 0.55;
      bed.connect(lp).connect(bg).connect(k.weather);
      bed.start();
      // Bubbles, a few at a time, and now and then a drop.
      const fizz = () => {
        if (!k.sound.started) return;
        if (!k.sound.muted) {
          const t0 = ctx.currentTime + 0.05;
          const n = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 4) : 1;
          const pan = Math.random() * 1.6 - 0.8;
          for (let i = 0; i < n; i++) bubble(k, t0 + i * (0.05 + Math.random() * 0.12), 280 + Math.random() * 520, 0.25 + Math.random() * 0.2, pan + (Math.random() - 0.5) * 0.3);
          if (Math.random() < 0.18) {
            const at = t0 + 0.3;
            const o = ctx.createOscillator();
            const f = 900 + Math.random() * 700;
            o.frequency.setValueAtTime(f * 0.7, at);
            o.frequency.exponentialRampToValueAtTime(f, at + 0.03);
            const g = k.sound.env(at, 0.22, 0.002, 0.18);
            o.connect(g).connect(k.weather);
            const send = ctx.createGain();
            send.gain.value = 0.05;
            g.connect(send).connect(k.verb);
            o.start(at);
            o.stop(at + 0.3);
          }
        }
        window.setTimeout(fizz, 500 + Math.random() * 2600);
      };
      window.setTimeout(fizz, 1200);
    },
    play(k, at, s, bar, sixteenth) {
      const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
      const step = bar * 16 + s;
      // The choir, breathing in over each chord and out into the next.
      if (s === 0 && bar % 2 === 0) {
        const len = sixteenth * 32 * 1.25;
        chord.notes.forEach((n, i) => choir(k, at + i * 0.08, n, len, i === 3 ? 0.03 : 0.04, (i - 1.5) * 0.35));
        // The root an octave above the bass, very quietly, for depth.
        choir(k, at, chord.bass + 12, len, 0.025, 0);
        bass(k, at, chord.bass, sixteenth * 32 * 1.05);
      }
      // The heart, every other beat: lub, dub.
      if (s === 0 || s === 8) beat(k, at, s === 0 ? 1 : 0.8, 62);
      if (s === 1 || s === 9) beat(k, at, s === 1 ? 0.55 : 0.45, 70);
      // The tune, when it's its turn.
      if (s === 0 && bar % 8 === 0) {
        const p = PLAN[Math.floor(bar / 8) % PLAN.length];
        tune = p >= 0 ? TUNES[p] : null;
        tuneNote = 0;
        tuneNext = step;
      }
      if (tune && step >= tuneNext && tuneNote < tune.length) {
        const [n, d] = tune[tuneNote++];
        if (n) flute(k, at, n, d * sixteenth * 1.02, 0.065);
        tuneNext = step + d;
      }
      // Proteins folding: a little glassy run up the chord now and then, into the echo.
      if ((s === 2 || s === 10) && Math.random() < 0.33) {
        const up = [...chord.notes.map((n) => n + 24), chord.notes[0] + 36];
        const from = Math.floor(Math.random() * 2);
        const n = 3 + Math.floor(Math.random() * 3);
        const pan = Math.random() * 1.2 - 0.6;
        for (let i = 0; i < n; i++) glass(k, at + i * sixteenth * (0.5 + Math.random() * 0.15), up[(from + i) % up.length], 0.022 * (1 - i * 0.12), pan);
      }
    },
  };
}
