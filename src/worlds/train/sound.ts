// The night train's music, and what you hear on board. A slow, warm late
// night band: brushes whose beat is the wheels' (one beat for every rail
// joint, nudged into step with them, so the pulse slows into a station and
// picks up again after), a plucked upright bass, an accordion's breathing
// chords, a soft electric piano, and now and then a lonely harmonica. Under
// it all the train: the wheels over the joints, the rolling roar, the wind
// when the window's down, the tunnel's boom, the car's creaks; and the one-off
// sounds: the brakes screaming to a stop, then crickets; the crossing's bells
// going by; the horn far up front, echoing off whatever is out there.
// Everything is made from oscillators and noise; nothing is recorded.
import type { Band, SoundKit } from '../../audio';
import { bpmFor, inStep, RAIL, type Land } from './journey';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Chord = { bass: number; fifth: number; notes: number[] };
/** Two bars each, in D minor: the slow turn of a late-night tune. */
export const CHORDS: Chord[] = [
  { bass: 38, fifth: 45, notes: [53, 57, 60, 64] }, // Dm9
  { bass: 43, fifth: 50, notes: [53, 57, 58, 62] }, // Gm9
  { bass: 36, fifth: 43, notes: [52, 57, 58, 62] }, // C13
  { bass: 41, fifth: 48, notes: [52, 55, 57, 60] }, // Fmaj9
  { bass: 34, fifth: 41, notes: [50, 53, 57, 64] }, // Bbmaj7#11
  { bass: 40, fifth: 46, notes: [55, 58, 62, 64] }, // Em7b5
  { bass: 33, fifth: 40, notes: [55, 58, 61, 64] }, // A7b9
  { bass: 38, fifth: 45, notes: [53, 57, 59, 64] }, // Dm6/9
];

/** The harmonica's tune, a phrase for each chord: [note, sixteenth it starts on (of 32), how many it holds]. */
export const MELODY: [number, number, number][][] = [
  [
    [69, 6, 6],
    [67, 12, 2],
    [65, 14, 10],
  ],
  [
    [62, 4, 4],
    [65, 8, 4],
    [67, 12, 12],
  ],
  [
    [70, 6, 4],
    [69, 10, 4],
    [67, 14, 12],
  ],
  [
    [65, 4, 8],
    [64, 12, 4],
    [60, 16, 12],
  ],
  [
    [62, 6, 4],
    [64, 10, 4],
    [65, 14, 6],
    [69, 22, 8],
  ],
  [
    [70, 4, 6],
    [69, 10, 4],
    [67, 14, 10],
  ],
  [
    [64, 4, 4],
    [65, 8, 4],
    [67, 12, 6],
    [61, 20, 8],
  ],
  [
    [62, 6, 20],
  ],
];

/** Where the wheels nearest us are, along the train from our compartment: our bogie's two axles, the car ahead's last two, ours at the far end. */
export const WHEELS = [
  { x: 1.55, gain: 1 },
  { x: -0.95, gain: 0.9 },
  { x: 8.95, gain: 0.45 },
  { x: 6.45, gain: 0.5 },
  { x: -16.05, gain: 0.25 },
  { x: -18.55, gain: 0.22 },
];

/** How the horn comes back off each landscape: delays (s) and how loud each echo is. */
export const ECHOES: Record<Land | 'tunnel', { delays: number[]; gains: number[]; tone: number }> = {
  gorge: { delays: [0.95, 1.8, 2.7, 3.7], gains: [0.5, 0.36, 0.24, 0.14], tone: 1100 },
  pass: { delays: [0.65, 1.4, 2.3], gains: [0.42, 0.26, 0.14], tone: 1300 },
  lake: { delays: [2.3, 4.4], gains: [0.26, 0.1], tone: 900 },
  fields: { delays: [1.6], gains: [0.1], tone: 900 },
  city: { delays: [0.11, 0.19, 0.31, 0.46], gains: [0.32, 0.24, 0.16, 0.1], tone: 2600 },
  tunnel: { delays: [0.045, 0.09, 0.14, 0.2, 0.27], gains: [0.6, 0.5, 0.4, 0.3, 0.2], tone: 800 },
};

export interface TrainBand extends Band {
  /** Where the train is (m along the line) and how fast it's going, each frame. */
  wheels(s: number, v: number): void;
  /** The window: 0 shut .. 1 open. */
  setWindow(k: number): void;
  /** In a tunnel: 0 out .. 1 deep in. */
  setTunnel(k: number): void;
  /** The level crossing's bells: how loud (0 for none), where (-1 left .. 1 right), and how fast they're coming at us (m/s, + toward). */
  setBells(level: number, pan: number, closing: number): void;
  /** Stopped out in the country: the crickets. */
  setCrickets(k: number): void;
  /** The emergency brake: on, then how hard it's working (the speed), then off. */
  brakeOn(): void;
  brakeLevel(v: number): void;
  brakeOff(): void;
  /** The horn, far ahead, echoing off what's out there. */
  horn(where: Land | 'tunnel'): void;
  points(): void;
  lever(): void;
  punch(): void;
  windowSlide(open: boolean): void;
  chime(): void;
  whistle(): void;
  /** The brakes letting go after a stop: a long hiss. */
  release(): void;
}

export function buildBand(): TrainBand {
  let kit: SoundKit | null = null;
  // The train as last seen: where, how fast, and when (on the audio clock).
  const w = { s: 0, v: 0, at: 0, last: NaN };
  let windowOpen = 0;
  let tunnel = 0;
  let correction = 1;
  let brown: AudioBuffer | null = null;
  let white: AudioBuffer | null = null;
  let roll: GainNode | null = null;
  let rollTone: BiquadFilterNode | null = null;
  let wind: GainNode | null = null;
  let windTone: BiquadFilterNode | null = null;
  let roar: GainNode | null = null;
  let crickets = 0;
  let bells = { level: 0, pan: 0, closing: 0 };
  let screech: { out: GainNode; tones: OscillatorNode[]; hiss: AudioBufferSourceNode; grind: AudioBufferSourceNode; nodes: AudioNode[] } | null = null;
  let timer = 0;
  let nextCricket = 0;
  let nextBell = 0;
  let bellSide = 0;
  let nextCreak = 0;

  const muted = () => !kit || kit.sound.muted;

  const buffer = (ctx: BaseAudioContext, seconds: number, brownish: boolean) => {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const x = Math.random() * 2 - 1;
      if (brownish) {
        last = (last + 0.02 * x) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = x;
    }
    return b;
  };
  const loop = (ctx: BaseAudioContext, b: AudioBuffer) => {
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.loop = true;
    return s;
  };
  /** A gain that rises from nothing, holds, and dies away: every note and noise starts and ends at silence. */
  const env = (ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  };
  /** A burst of filtered noise at a time. */
  const burst = (k: SoundKit, to: AudioNode, at: number, freq: number, q: number, vol: number, len: number, type: BiquadFilterType = 'bandpass') => {
    const n = k.ctx.createBufferSource();
    n.buffer = white!;
    const f = k.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = env(k.ctx, at, vol, 0.002, len);
    n.connect(f).connect(g).connect(to);
    n.start(at, Math.random() * 3, len + 0.05);
  };
  /** A low thump. */
  const thump = (k: SoundKit, to: AudioNode, at: number, f0: number, f1: number, vol: number, len: number) => {
    const o = k.ctx.createOscillator();
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + len);
    const g = env(k.ctx, at, vol, 0.003, len);
    o.connect(g).connect(to);
    o.start(at);
    o.stop(at + len + 0.05);
  };

  /** One wheel over one joint: a click of steel and a knock through the floor. */
  const clack = (k: SoundKit, at: number, gain: number) => {
    const v = Math.max(0, w.v);
    const loud = Math.min(1.3, 0.25 + v / 22) * gain * (1 + windowOpen * 0.6 + tunnel * 0.8);
    if (loud < 0.01) return;
    burst(k, k.ambience, at, 900 + windowOpen * 900 + Math.random() * 200, 1.6, 0.05 * loud, 0.05);
    thump(k, k.ambience, at, 120, 55, 0.12 * loud, 0.09);
    if (tunnel > 0.1) burst(k, k.verb, at, 700, 1, 0.04 * loud * tunnel, 0.12);
  };

  /** The wheels: looks ahead on the audio clock and schedules every joint each axle will cross. */
  const schedule = () => {
    if (!kit) return;
    const k = kit;
    const now = k.ctx.currentTime;
    const ahead = now + 0.16;
    const predict = (t: number) => w.s + w.v * (t - w.at);
    const s1 = predict(ahead);
    if (Number.isNaN(w.last) || s1 - w.last > 60 || s1 < w.last - 5) {
      w.last = s1;
      return;
    }
    if (s1 <= w.last || w.v < 0.2) {
      w.last = Math.max(w.last, s1);
    } else {
      for (const wheel of WHEELS) {
        const from = w.last + wheel.x;
        const to = s1 + wheel.x;
        for (let j = Math.floor(from / RAIL) + 1; j * RAIL <= to; j++) {
          const t = w.at + (j * RAIL - wheel.x - w.s) / w.v;
          if (!muted()) clack(k, Math.max(now + 0.005, t), wheel.gain);
        }
      }
      w.last = s1;
    }
    // Now and then a creak from the car's woodwork, more when it's moving fast.
    if (now > nextCreak) {
      nextCreak = now + 5 + Math.random() * 11;
      if (w.v > 4 && !muted()) creak(k, now + 0.05);
    }
    if (crickets > 0.02 && now > nextCricket && !muted()) {
      nextCricket = now + 0.35 + Math.random() * 0.9;
      cricket(k, now + 0.05);
    }
    if (bells.level > 0.01 && now > nextBell) {
      nextBell = now + 0.42;
      if (!muted()) bell(k, now + 0.05);
    }
  };

  const creak = (k: SoundKit, at: number) => {
    const n = k.ctx.createBufferSource();
    n.buffer = white!;
    const f = k.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 18;
    const f0 = 260 + Math.random() * 300;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.linearRampToValueAtTime(f0 * (1.3 + Math.random() * 0.5), at + 0.35);
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.05, at + 0.08);
    g.gain.linearRampToValueAtTime(0.03, at + 0.25);
    g.gain.linearRampToValueAtTime(0, at + 0.4);
    n.connect(f).connect(g).connect(k.ambience);
    n.start(at, Math.random() * 3, 0.5);
  };

  const cricket = (k: SoundKit, at: number) => {
    const pan = k.ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(k.weather);
    const f = 4200 + Math.random() * 600;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = k.ctx.createOscillator();
      o.frequency.value = f;
      const t = at + i * 0.045;
      const g = env(k.ctx, t, 0.03 * crickets, 0.004, 0.03);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.05);
    }
  };

  /** One stroke of the crossing's bell, pitched up as we come at it and down as we leave. */
  const bell = (k: SoundKit, at: number) => {
    const doppler = 343 / Math.max(200, 343 - bells.closing);
    bellSide = 1 - bellSide;
    const pan = k.ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, bells.pan));
    pan.connect(k.weather);
    const base = (bellSide ? 1180 : 1100) * doppler;
    for (const [mult, amp, len] of [
      [1, 1, 0.5],
      [2.4, 0.4, 0.25],
      [3.9, 0.15, 0.12],
    ]) {
      const o = k.ctx.createOscillator();
      o.frequency.value = base * mult;
      const g = env(k.ctx, at, 0.05 * amp * Math.min(1, bells.level), 0.002, len);
      o.connect(g).connect(pan);
      o.start(at);
      o.stop(at + len + 0.05);
    }
  };

  // --- the instruments -------------------------------------------------------------------------

  /** The brushes: a swish on two and four, a soft tap on the off-beats, a padded kick. */
  const swish = (k: SoundKit, at: number, vel: number) => {
    const n = k.ctx.createBufferSource();
    n.buffer = white!;
    const bp = k.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(3200, at);
    bp.frequency.exponentialRampToValueAtTime(1400, at + 0.25);
    const g = env(k.ctx, at, 0.05 * vel, 0.035, 0.26);
    n.connect(bp).connect(g);
    g.connect(k.music);
    g.connect(k.verb);
    n.start(at, Math.random() * 3, 0.35);
  };
  const tap = (k: SoundKit, at: number, vel: number) => burst(k, k.music, at, 5200, 1.2, 0.018 * vel, 0.06);
  const kick = (k: SoundKit, at: number, vel: number) => thump(k, k.music, at, 95, 45, 0.28 * vel, 0.3);

  /** The upright bass: a pluck that thumps and rings, its pitch settling a hair after the attack. */
  const bass = (k: SoundKit, at: number, midi: number, len: number, vel = 1) => {
    const f = hz(midi);
    const lp = k.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, at);
    lp.frequency.exponentialRampToValueAtTime(320, at + 0.4);
    const g = env(k.ctx, at, 0.2 * vel, 0.008, Math.max(0.6, len));
    lp.connect(g).connect(k.music);
    for (const [type, mult, amp] of [
      ['triangle', 1, 1],
      ['sine', 2, 0.25],
    ] as const) {
      const o = k.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * mult * 1.018, at);
      o.frequency.exponentialRampToValueAtTime(f * mult, at + 0.05);
      const og = k.ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(at);
      o.stop(at + Math.max(0.6, len) + 0.1);
    }
  };

  /** The accordion: reeds a few cents apart (that beating is its sound), breathing in and out over the chord. */
  const accordion = (k: SoundKit, at: number, notes: number[], len: number) => {
    const lp = k.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = 0.6;
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.012, at + len * 0.3);
    g.gain.setValueAtTime(0.012, at + len * 0.6);
    g.gain.linearRampToValueAtTime(0, at + len);
    lp.connect(g);
    g.connect(k.music);
    const wet = k.ctx.createGain();
    wet.gain.value = 0.6;
    g.connect(wet).connect(k.verb);
    for (const n of notes)
      for (const cents of [-7, 0, 8]) {
        const o = k.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = cents;
        k.wow.connect(o.detune);
        o.connect(lp);
        o.onended = () => k.wow.disconnect(o.detune);
        o.start(at);
        o.stop(at + len + 0.1);
      }
  };

  /** The electric piano: a sine with a soft bell partial, struck gently. */
  const keys = (k: SoundKit, at: number, midi: number, vel: number, len: number) => {
    const g = env(k.ctx, at, vel, 0.01, len);
    g.connect(k.music);
    for (const [mult, amp, type] of [
      [1, 1, 'sine'],
      [2.0, 0.16, 'sine'],
      [1, 0.2, 'triangle'],
    ] as const) {
      const o = k.ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mult;
      k.wow.connect(o.detune);
      const og = k.ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.onended = () => k.wow.disconnect(o.detune);
      o.start(at);
      o.stop(at + len + 0.1);
    }
  };

  /** The harmonica: reedy, a little breath, scooping up into each note, a slow vibrato once it's held. */
  const harp = (k: SoundKit, at: number, midi: number, len: number) => {
    const f = hz(midi);
    const out = k.ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(0.035, at + 0.07);
    out.gain.setValueAtTime(0.035, at + Math.max(0.08, len - 0.12));
    out.gain.linearRampToValueAtTime(0, at + len + 0.08);
    const bp = k.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    const lp = k.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    bp.connect(lp).connect(out);
    out.connect(k.music);
    const wet = k.ctx.createGain();
    wet.gain.value = 0.7;
    out.connect(wet).connect(k.verb);
    const echo = k.ctx.createGain();
    echo.gain.value = 0.25;
    out.connect(echo).connect(k.echo);
    const vib = k.ctx.createOscillator();
    vib.frequency.value = 5.2;
    const depth = k.ctx.createGain();
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(0, at + 0.25);
    depth.gain.linearRampToValueAtTime(14, at + 0.6);
    vib.connect(depth);
    vib.start(at);
    vib.stop(at + len + 0.2);
    for (const [type, amp] of [
      ['sawtooth', 0.6],
      ['square', 0.4],
    ] as const) {
      const o = k.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f * 0.975, at);
      o.frequency.exponentialRampToValueAtTime(f, at + 0.09);
      depth.connect(o.detune);
      const og = k.ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(bp);
      o.start(at);
      o.stop(at + len + 0.2);
    }
    burst(k, out, at, 2400, 0.8, 0.12, Math.min(0.3, len));
  };

  // --- the train ---------------------------------------------------------------------------------

  /** The steady sounds: the rolling roar under the floor, the wind at the window, the tunnel. */
  const beds = (k: SoundKit) => {
    const ctx = k.ctx;
    // Rolling: brown noise, low, its level and brightness following the speed.
    const r = loop(ctx, brown!);
    rollTone = ctx.createBiquadFilter();
    rollTone.type = 'lowpass';
    rollTone.frequency.value = 180;
    roll = ctx.createGain();
    roll.gain.value = 0;
    r.connect(rollTone).connect(roll).connect(k.ambience);
    r.start();
    // The wind rushing in at the open window.
    const wn = loop(ctx, white!);
    windTone = ctx.createBiquadFilter();
    windTone.type = 'bandpass';
    windTone.frequency.value = 700;
    windTone.Q.value = 0.5;
    wind = ctx.createGain();
    wind.gain.value = 0;
    // It gusts: a level of its own that wavers between 0.6 and 1 (never below nothing).
    const gust = ctx.createGain();
    gust.gain.value = 0.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.21;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.2;
    lfo.connect(lfoDepth).connect(gust.gain);
    lfo.start();
    wn.connect(windTone).connect(gust).connect(wind).connect(k.ambience);
    wn.start();
    // The tunnel: a deep boom and a roar off the walls.
    const tn = loop(ctx, brown!);
    const tl = ctx.createBiquadFilter();
    tl.type = 'lowpass';
    tl.frequency.value = 420;
    tl.Q.value = 2;
    roar = ctx.createGain();
    roar.gain.value = 0;
    tn.connect(tl).connect(roar).connect(k.ambience);
    tn.start();
    // Out there: a night breeze, louder with your nose to the glass.
    const nb = loop(ctx, brown!);
    const nl = ctx.createBiquadFilter();
    nl.type = 'lowpass';
    nl.frequency.value = 500;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    nb.connect(nl).connect(ng).connect(k.weather);
    nb.start();
  };

  const update = () => {
    if (!kit || !roll || !rollTone || !wind || !windTone || !roar) return;
    const now = kit.ctx.currentTime;
    const v = Math.max(0, w.v);
    const sp = Math.min(1.2, v / 24);
    roll.gain.setTargetAtTime(0.32 * sp * (1 + windowOpen * 0.7) * (1 - tunnel * 0.3), now, 0.3);
    rollTone.frequency.setTargetAtTime(140 + v * 14 + windowOpen * 300, now, 0.3);
    wind.gain.setTargetAtTime(windowOpen * (0.05 + sp * 0.16) * (1 - tunnel * 0.4), now, 0.25);
    windTone.frequency.setTargetAtTime(500 + v * 30, now, 0.4);
    roar.gain.setTargetAtTime(tunnel * (0.12 + sp * 0.5) * (1 + windowOpen), now, 0.2);
  };

  return {
    // One beat per rail joint, held in step with the wheels; a slow walk below the speeds the band can follow.
    get bpm() {
      return bpmFor(w.v) * (inStep(w.v) ? correction : 1);
    },
    swing: 0.14,
    room: [2.6, 0.45],
    echoBeats: 0.75,
    outside: [0.05, 0.18],
    crackle: 0.45,
    start(k) {
      kit = k;
      brown = buffer(k.ctx, 6, true);
      white = buffer(k.ctx, 4, false);
      beds(k);
      w.at = k.ctx.currentTime;
      timer = window.setInterval(() => {
        schedule();
        update();
      }, 25);
      void timer;
    },
    play(k, at, step, bar, sixteenth) {
      const block = Math.floor(bar / 2) % CHORDS.length;
      const half = bar % 2;
      const chord = CHORDS[block];
      const next = CHORDS[(block + 1) % CHORDS.length];
      const cycle = Math.floor(bar / (CHORDS.length * 2));
      const beatLen = sixteenth * 4;
      const moving = inStep(w.v);
      // Keep the beat on the wheels: at each beat, see where the joint is and lean the tempo toward it.
      if (step % 4 === 0 && moving) {
        const s = w.s + w.v * (at - w.at) + WHEELS[0].x;
        let e = s / RAIL - Math.floor(s / RAIL);
        if (e > 0.5) e -= 1;
        correction = Math.min(1.12, Math.max(0.88, 1 + e * 0.35));
      } else if (!moving) correction = 1;
      // The accordion breathes over each chord.
      if (step === 0 && half === 0) accordion(k, at, chord.notes, beatLen * 8.2);
      // The piano comps lightly, off the beat.
      if ((step === 6 || (step === 14 && half === 1)) && Math.random() < 0.85)
        chord.notes.forEach((n, i) => keys(k, at + i * 0.018, n + 12, 0.022, beatLen * 1.6));
      if (step === 0 && half === 1) chord.notes.slice(1).forEach((n, i) => keys(k, at + i * 0.024, n, 0.018, beatLen * 2.4));
      // The bass: root on one, the fifth on three; leading into the next chord from a half step away.
      if (step === 0) bass(k, at, chord.bass, beatLen * 1.8);
      if (step === 8) bass(k, at, half ? chord.bass + 12 : chord.fifth, beatLen * 1.6, 0.8);
      if (step === 12 && half === 1) bass(k, at, next.bass + (Math.random() < 0.5 ? 1 : -1), beatLen * 0.9, 0.7);
      // Brushes, only while the wheels are keeping time for them.
      if (moving) {
        if (step === 4 || step === 12) swish(k, at, step === 12 ? 1 : 0.85);
        if (step % 4 === 2) tap(k, at, 0.8);
        if (step === 0) kick(k, at, 0.7);
        if (step === 10 && Math.random() < 0.3) kick(k, at, 0.4);
      }
      // The harmonica: every other time round, and never two cycles running without a rest.
      if (cycle % 2 === 1)
        for (const [note, start, len] of MELODY[block]) if (start === half * 16 + step) harp(k, at, note, len * sixteenth);
    },
    wheels(s, v) {
      if (!kit) return;
      w.s = s;
      w.v = v;
      w.at = kit.ctx.currentTime;
    },
    setWindow(k) {
      windowOpen = k;
    },
    setTunnel(k) {
      tunnel = k;
    },
    setBells(level, pan, closing) {
      bells = { level, pan, closing };
    },
    setCrickets(k) {
      crickets = k;
    },
    brakeOn() {
      if (!kit || screech) return;
      const k = kit;
      const ctx = k.ctx;
      const now = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(0.06, now + 0.5);
      out.connect(k.ambience);
      const outer = ctx.createGain();
      outer.gain.value = 0.6;
      out.connect(outer).connect(k.weather);
      const nodes: AudioNode[] = [];
      // The squeal: a few high tones, each wandering in pitch on its own.
      const tones: OscillatorNode[] = [];
      for (const [f, amp, rate] of [
        [2350, 0.5, 3.1],
        [3120, 0.35, 5.3],
        [4460, 0.22, 7.7],
        [1680, 0.2, 2.2],
      ]) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const wob = ctx.createOscillator();
        wob.frequency.value = rate;
        const wd = ctx.createGain();
        wd.gain.value = 40 + Math.random() * 40;
        wob.connect(wd).connect(o.detune);
        const g = ctx.createGain();
        g.gain.value = amp;
        o.connect(g).connect(out);
        o.start(now);
        wob.start(now);
        tones.push(o, wob);
        nodes.push(g, wd);
      }
      // A hiss of steel on steel, and the grinding under it.
      const hiss = loop(ctx, white!);
      const hb = ctx.createBiquadFilter();
      hb.type = 'bandpass';
      hb.frequency.value = 3400;
      hb.Q.value = 0.8;
      const hg = ctx.createGain();
      hg.gain.value = 0.7;
      hiss.connect(hb).connect(hg).connect(out);
      hiss.start(now);
      const grind = loop(ctx, brown!);
      const gl = ctx.createBiquadFilter();
      gl.type = 'lowpass';
      gl.frequency.value = 600;
      const gg = ctx.createGain();
      gg.gain.value = 1.6;
      grind.connect(gl).connect(gg).connect(out);
      grind.start(now);
      nodes.push(hb, hg, gl, gg);
      screech = { out, tones, hiss, grind, nodes };
    },
    brakeLevel(v) {
      if (!kit || !screech) return;
      const now = kit.ctx.currentTime;
      // Loudest in the middle of the stop, rising in pitch as it slows (the squeal does).
      const k = Math.min(1, v / 8) * (0.7 + 0.3 * Math.min(1, (24 - v) / 12));
      screech.out.gain.setTargetAtTime(0.07 * Math.max(0, k), now, 0.15);
      for (let i = 0; i < screech.tones.length; i += 2) screech.tones[i].detune.setTargetAtTime((24 - Math.min(24, v)) * 9, now, 0.4);
    },
    brakeOff() {
      if (!kit || !screech) return;
      const now = kit.ctx.currentTime;
      const s = screech;
      screech = null;
      s.out.gain.cancelScheduledValues(now);
      s.out.gain.setValueAtTime(s.out.gain.value, now);
      s.out.gain.linearRampToValueAtTime(0, now + 0.7);
      for (const o of s.tones) o.stop(now + 0.8);
      s.hiss.stop(now + 0.8);
      s.grind.stop(now + 0.8);
      // The last jolt as it stops.
      if (!muted()) thump(kit, kit.ambience, now + 0.05, 80, 40, 0.25, 0.35);
    },
    release() {
      if (!kit || muted()) return;
      const now = kit.ctx.currentTime;
      const n = kit.ctx.createBufferSource();
      n.buffer = white!;
      const hp = kit.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2600;
      const g = kit.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05, now + 0.08);
      g.gain.linearRampToValueAtTime(0.03, now + 0.9);
      g.gain.linearRampToValueAtTime(0, now + 1.6);
      n.connect(hp).connect(g).connect(kit.weather);
      n.start(now, 0, 1.7);
      thump(kit, kit.ambience, now + 0.9, 70, 40, 0.12, 0.3);
    },
    horn(where) {
      if (!kit || muted()) return;
      const k = kit;
      const ctx = k.ctx;
      const now = ctx.currentTime + 0.25;
      const e = ECHOES[where];
      // Far up at the front: muffled, the high note then the low one.
      const out = ctx.createGain();
      out.gain.value = where === 'tunnel' ? 0.32 : 0.2;
      const far = ctx.createBiquadFilter();
      far.type = 'lowpass';
      far.frequency.value = 1700;
      out.connect(far);
      far.connect(k.ambience);
      // The echoes, each a little darker than the last.
      e.delays.forEach((d, i) => {
        const dl = ctx.createDelay(5);
        dl.delayTime.value = d;
        const tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = e.tone * Math.pow(0.85, i);
        const g = ctx.createGain();
        g.gain.value = e.gains[i];
        far.connect(dl).connect(tone).connect(g).connect(k.ambience);
      });
      const toot = (at: number, f: number, len: number) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(1, at + 0.06);
        g.gain.setValueAtTime(1, at + len - 0.15);
        g.gain.linearRampToValueAtTime(0, at + len);
        const body = ctx.createBiquadFilter();
        body.type = 'bandpass';
        body.frequency.value = f * 2.6;
        body.Q.value = 0.7;
        body.connect(g).connect(out);
        for (const [type, mult, amp] of [
          ['sawtooth', 1, 0.5],
          ['square', 1.004, 0.3],
          ['sawtooth', 1.498, 0.25],
        ] as const) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.setValueAtTime(f * mult * 0.97, at);
          o.frequency.linearRampToValueAtTime(f * mult, at + 0.12);
          const og = ctx.createGain();
          og.gain.value = amp;
          o.connect(og).connect(body);
          o.start(at);
          o.stop(at + len + 0.05);
        }
      };
      toot(now, 370, 0.75);
      toot(now + 0.7, 277, 1.15);
    },
    points() {
      if (!kit || muted()) return;
      const now = kit.ctx.currentTime;
      // The wheels over the frogs and switch rails: a quick, uneven rattle.
      let t = now + 0.02;
      for (let i = 0; i < 9; i++) {
        clack(kit, t, 0.8 + Math.random() * 0.4);
        t += 0.035 + Math.random() * 0.07;
      }
      burst(kit, kit.ambience, now + 0.1, 3000, 6, 0.02, 0.3);
    },
    lever() {
      if (!kit || muted()) return;
      const now = kit.ctx.currentTime;
      // A heavy iron clunk, the catch dropping in, a ring of the rod.
      thump(kit, kit.ambience, now + 0.01, 110, 50, 0.3, 0.25);
      burst(kit, kit.ambience, now + 0.01, 500, 1.2, 0.12, 0.1);
      burst(kit, kit.ambience, now + 0.09, 2400, 4, 0.08, 0.05);
      burst(kit, kit.ambience, now + 0.16, 3200, 8, 0.03, 0.4);
    },
    punch() {
      if (!kit || muted()) return;
      const now = kit.ctx.currentTime;
      burst(kit, kit.ambience, now, 6000, 2, 0.1, 0.02);
      burst(kit, kit.ambience, now + 0.012, 2600, 3, 0.06, 0.04);
      thump(kit, kit.ambience, now, 300, 160, 0.06, 0.05);
    },
    windowSlide(open) {
      if (!kit || muted()) return;
      const now = kit.ctx.currentTime;
      const n = kit.ctx.createBufferSource();
      n.buffer = white!;
      const bp = kit.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1;
      bp.frequency.setValueAtTime(open ? 900 : 600, now);
      bp.frequency.linearRampToValueAtTime(open ? 500 : 900, now + 0.4);
      const g = kit.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05, now + 0.05);
      g.gain.linearRampToValueAtTime(0, now + 0.45);
      n.connect(bp).connect(g).connect(kit.ambience);
      n.start(now, Math.random() * 3, 0.5);
      thump(kit, kit.ambience, now + 0.42, 160, 80, 0.12, 0.12);
    },
    chime() {
      if (!kit || muted()) return;
      const now = kit.ctx.currentTime + 0.4;
      // Three soft notes over the platform's speakers, before nobody says anything.
      [76, 72, 67].forEach((m, i) => {
        const at = now + i * 0.55;
        for (const [mult, amp] of [
          [1, 1],
          [2.76, 0.12],
        ]) {
          const o = kit!.ctx.createOscillator();
          o.frequency.value = hz(m) * mult;
          const g = env(kit!.ctx, at, 0.035 * amp, 0.005, 1.6);
          o.connect(g).connect(kit!.weather);
          g.connect(kit!.verb);
          o.start(at);
          o.stop(at + 1.7);
        }
      });
    },
    whistle() {
      if (!kit || muted()) return;
      const now = kit.ctx.currentTime + 0.05;
      // The guard's whistle: a pea rattling in it.
      const o = kit.ctx.createOscillator();
      o.frequency.value = 2650;
      const trill = kit.ctx.createOscillator();
      trill.frequency.value = 32;
      const td = kit.ctx.createGain();
      td.gain.value = 120;
      trill.connect(td).connect(o.frequency);
      const g = kit.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.035, now + 0.04);
      g.gain.setValueAtTime(0.035, now + 0.75);
      g.gain.linearRampToValueAtTime(0, now + 0.9);
      o.connect(g).connect(kit.weather);
      o.start(now);
      trill.start(now);
      o.stop(now + 1);
      trill.stop(now + 1);
    },
  };
}
