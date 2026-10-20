// All the sound is synthesized live with Web Audio: the weather outside (wind
// and far-off cowbells by the lake; rain, a neon hum and passing spinners in
// the city; the cab's air, radio squelch and jets spooling up at the tower;
// wind, birdsong and a far bell at the monastery), vinyl crackle, a band for
// each world (by the lake, electric piano over brushes with a celesta falling
// like snow; in the city, slow analog pads, an echoing arpeggio and a quiet drum
// machine; at the tower, airy pads with a sonar ping; at the monastery, a chant
// over a drone), all with a little tape wobble, and the small sounds of things
// in the room. No audio files.

import { unlockedAudio } from './audio-unlock';

/** What's outside the window, for the ambience. */
export type Weather = 'alps' | 'city' | 'tower' | 'monastery';

type Chord = { bass: number; notes: number[] };

/** Each world's band: the lake plays warm lo-fi, the city slow synth. */
const SCORES: Record<Weather, { bpm: number; swing: number; chords: Chord[]; sparkle: number[] }> = {
  // Electric piano over brushes and a shaker; a celesta now and then, like snow.
  alps: {
    bpm: 70,
    swing: 0.16,
    chords: [
      { bass: 41, notes: [57, 60, 64, 67] }, // Fmaj9
      { bass: 40, notes: [55, 59, 62, 67] }, // Em7
      { bass: 38, notes: [53, 57, 60, 64] }, // Dm9
      { bass: 46, notes: [57, 62, 65, 69] }, // Bbmaj7
    ],
    sparkle: [72, 74, 76, 79, 81, 84, 86, 88],
  },
  // Slow detuned pads, an echoing arpeggio, a plucked bass and a soft drum machine.
  city: {
    bpm: 84,
    swing: 0.04,
    chords: [
      { bass: 36, notes: [55, 58, 62, 63] }, // Cm9
      { bass: 44, notes: [55, 60, 63, 67] }, // Abmaj7
      { bass: 41, notes: [56, 60, 63, 67] }, // Fm9
      { bass: 43, notes: [55, 60, 62, 67] }, // Gsus4
    ],
    sparkle: [],
  },
  // Slow airy pads, a sub bass, and a ping now and then like a sweep on the scope.
  tower: {
    bpm: 64,
    swing: 0,
    chords: [
      { bass: 38, notes: [57, 61, 64, 66] }, // Dmaj9
      { bass: 35, notes: [57, 62, 64, 66] }, // Bm11
      { bass: 43, notes: [59, 62, 66, 69] }, // Gmaj7
      { bass: 45, notes: [57, 61, 64, 71] }, // A6/9
    ],
    sparkle: [81, 83, 85, 88, 90],
  },
  // A drone on D and A under a chant line in the Dorian mode.
  monastery: {
    bpm: 60,
    swing: 0,
    chords: [{ bass: 38, notes: [45, 50] }],
    sparkle: [],
  },
};

/** The chant: phrases of [note, length in sixteenths], sung one after another with a breath between. */
const CHANT: [number, number][][] = [
  [[50, 4], [53, 4], [55, 4], [57, 8], [57, 4], [55, 4], [57, 4], [59, 4], [57, 8], [55, 4], [53, 4], [55, 8], [57, 12]],
  [[57, 4], [60, 4], [59, 4], [57, 4], [55, 8], [57, 4], [55, 4], [53, 4], [52, 4], [50, 12]],
  [[53, 4], [55, 4], [57, 4], [57, 4], [57, 4], [59, 4], [60, 8], [59, 4], [57, 4], [55, 4], [57, 8], [53, 4], [55, 4], [53, 4], [52, 4], [50, 16]],
  [[50, 4], [50, 4], [53, 4], [55, 8], [53, 4], [55, 4], [57, 12], [55, 4], [53, 4], [52, 8], [50, 16]],
];

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambience!: GainNode;
  private windGain!: GainNode;
  private verbIn!: GainNode;
  private echoIn!: GainNode;
  private weather: Weather = 'alps';
  private wow!: GainNode;
  private noise!: AudioBuffer;
  private penGain!: GainNode;
  private timer = 0;
  private step = 0;
  private nextAt = 0;
  musicOn = true;
  muted = true;

  get started() {
    return !!this.ctx;
  }

  constructor(weather: Weather = 'alps') {
    this.weather = weather;
  }

  /**
   * Browsers only allow sound after a click or key press. The globe you clicked
   * usually opened the audio already (audio-unlock.ts); if the browser is still
   * holding it back, the first click or key press in the room lets it go.
   */
  start() {
    if (this.ctx) return;
    const ctx = unlockedAudio() ?? new AudioContext();
    this.ctx = ctx;
    if (ctx.state === 'suspended') {
      const wake = () => {
        if (this.muted) return;
        void ctx.resume().then(() => {
          if (ctx.state !== 'running') return;
          window.removeEventListener('pointerdown', wake, true);
          window.removeEventListener('keydown', wake, true);
        });
      };
      window.addEventListener('pointerdown', wake, true);
      window.addEventListener('keydown', wake, true);
    }
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // A shared slow wobble on every pitch: worn tape.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.45;
    this.wow = ctx.createGain();
    this.wow.gain.value = 7;
    lfo.connect(this.wow);
    lfo.start();

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    tone.Q.value = 0.4;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(tone).connect(this.master);

    this.ambience = ctx.createGain();
    this.ambience.gain.value = 1;
    this.ambience.connect(this.master);

    // A soft room for the band (bigger in the city), and an echo for the city's arpeggio.
    const verb = ctx.createConvolver();
    // A stone church is the biggest room of all.
    const size = { alps: 1.6, city: 3.4, tower: 3, monastery: 5 }[this.weather];
    verb.buffer = this.impulse(size);
    this.verbIn = ctx.createGain();
    const verbOut = ctx.createGain();
    verbOut.gain.value = { alps: 0.3, city: 0.55, tower: 0.5, monastery: 0.75 }[this.weather];
    this.verbIn.connect(verb).connect(verbOut).connect(this.musicBus);
    const echo = ctx.createDelay(1.5);
    echo.delayTime.value = (60 / SCORES[this.weather].bpm) * 0.75;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 1600;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.4;
    this.echoIn = ctx.createGain();
    this.echoIn.connect(echo).connect(echoTone).connect(feedback).connect(echo);
    echoTone.connect(this.musicBus);
    echoTone.connect(this.verbIn);

    this.noise = this.noiseBuffer(4);
    if (this.weather === 'city') {
      this.startRain();
      this.startHum();
    } else if (this.weather === 'tower') {
      this.startWind(1500, 0.06);
      this.startCab();
    } else if (this.weather === 'monastery') {
      this.startWind(700, 0.06);
      this.birdsong();
      this.bells();
    } else {
      this.startWind();
      this.cowbells();
    }
    this.startCrackle();
    this.startPen();

    this.nextAt = ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.setMuted(false);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, now, 0.4);
    if (!m) void this.ctx.resume();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.3);
  }

  /** 0 at the desk, 1 with your nose to the glass (or out in the street): the weather gets louder. */
  setOutside(k: number) {
    if (!this.ctx) return;
    const [base, more] = { alps: [0.08, 0.12], city: [0.1, 0.35], tower: [0.05, 0.3], monastery: [0.07, 0.16] }[this.weather];
    this.windGain.gain.setTargetAtTime(base + k * more, this.ctx.currentTime, 0.5);
  }

  /** A spinner passing the window, left to right: turbine whine, rushing air, a low hum that drops as it goes. */
  flyby(seconds: number) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const mid = now + seconds / 2;
    const end = now + seconds;
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.9, now);
    pan.pan.linearRampToValueAtTime(0.9, end);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.5, mid);
    out.gain.exponentialRampToValueAtTime(0.0001, end);
    out.connect(pan).connect(this.ambience);
    // Rushing air.
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(260, now);
    band.frequency.exponentialRampToValueAtTime(900, mid);
    band.frequency.exponentialRampToValueAtTime(220, end);
    air.connect(band).connect(out);
    air.start(now);
    air.stop(end);
    // Engine hum, dropping in pitch as it passes.
    for (const [base, type, level] of [
      [62, 'sawtooth', 0.12],
      [124.5, 'triangle', 0.08],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(base * 1.06, now);
      osc.frequency.setValueAtTime(base * 1.06, mid - 0.6);
      osc.frequency.linearRampToValueAtTime(base * 0.94, mid + 0.6);
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 520;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(low).connect(g).connect(out);
      osc.start(now);
      osc.stop(end);
    }
  }

  private noiseBuffer(seconds: number, brown = false) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  private loop(buffer: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    return s;
  }

  /** Wind: brown noise through a filter that gusts. Higher and thinner round the tower's glass. */
  private startWind(cutoff = 520, level = 0.08) {
    const ctx = this.ctx!;
    const bed = this.loop(this.noiseBuffer(6, true));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 1.6;
    // Gusts: the filter and the level both breathe, slowly and out of step.
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.07;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = cutoff * 0.5;
    gust.connect(gustDepth).connect(lp.frequency);
    gust.start();
    this.windGain = ctx.createGain();
    this.windGain.gain.value = level;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.043;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.03;
    swell.connect(swellDepth).connect(this.windGain.gain);
    swell.start();
    bed.connect(lp).connect(this.windGain).connect(this.ambience);
    bed.start();
  }

  /** Rain on the city and patter on the glass. Shares the weather level with the wind. */
  private startRain() {
    const ctx = this.ctx!;
    const bed = this.loop(this.noiseBuffer(5, true));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.1;
    bed.connect(lp).connect(this.windGain).connect(this.ambience);
    bed.start();
    // Patter on the glass: brighter, choppier.
    const patter = this.loop(this.noise);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 0.7;
    const pg = ctx.createGain();
    pg.gain.value = 0.035;
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 7.3;
    const fg = ctx.createGain();
    fg.gain.value = 0.015;
    flutter.connect(fg).connect(pg.gain);
    flutter.start();
    patter.connect(bp).connect(pg).connect(this.windGain);
    patter.start();
  }

  /** The neon sign over the window, humming through the wall. */
  private startHum() {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.006;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 240;
    bp.Q.value = 3;
    for (const f of [60, 120.4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(bp);
      o.start();
    }
    bp.connect(g).connect(this.ambience);
  }

  /** Now and then, a few cowbells somewhere down the valley. */
  private cowbells() {
    const ctx = this.ctx!;
    const ring = () => {
      if (!this.ctx) return;
      const t0 = ctx.currentTime + 0.1;
      const n = 2 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const at = t0 + i * (0.25 + Math.random() * 0.5);
        const f = 520 + Math.random() * 260;
        for (const [mult, amp] of [
          [1, 1],
          [2.76, 0.5],
          [5.4, 0.25],
        ]) {
          const o = ctx.createOscillator();
          o.frequency.value = f * mult;
          const g = this.env(at, 0.006 * amp, 0.004, 0.9);
          o.connect(g).connect(this.ambience);
          o.start(at);
          o.stop(at + 1);
        }
      }
      window.setTimeout(ring, 25000 + Math.random() * 35000);
    };
    window.setTimeout(ring, 9000);
  }

  /**
   * The tower cab: the air handling's low hum, and the radio now and then: a
   * squelch, a pair of beeps, a click. Made up from tones and noise; there are
   * no voices and nothing recorded.
   */
  private startCab() {
    const ctx = this.ctx!;
    const hum = ctx.createGain();
    hum.gain.value = 0.012;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    for (const f of [59.7, 119.6, 180.2]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    const air = this.loop(this.noiseBuffer(5, true));
    const airLp = ctx.createBiquadFilter();
    airLp.type = 'lowpass';
    airLp.frequency.value = 300;
    const airG = ctx.createGain();
    airG.gain.value = 0.05;
    air.connect(airLp).connect(airG).connect(this.ambience);
    air.start();
    lp.connect(hum).connect(this.ambience);
    const radio = () => {
      if (!this.ctx) return;
      if (!this.muted) this.radio();
      window.setTimeout(radio, 9000 + Math.random() * 16000);
    };
    window.setTimeout(radio, 4000);
  }

  /** One radio call: squelch opens, a short warble of tones, squelch closes, a courtesy beep. */
  private radio() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.05;
    const out = ctx.createGain();
    out.gain.value = 0.5;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1700;
    band.Q.value = 0.9;
    band.connect(out).connect(this.ambience);
    const hiss = (at: number, len: number, vol: number) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.01);
      g.gain.setValueAtTime(vol, at + len - 0.02);
      g.gain.linearRampToValueAtTime(0, at + len);
      n.connect(g).connect(band);
      n.start(at, Math.random() * 3, len + 0.05);
    };
    const beep = (at: number, f: number, len: number, vol = 0.02) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.env(at, vol, 0.004, len);
      o.connect(g).connect(band);
      o.start(at);
      o.stop(at + len + 0.05);
    };
    hiss(t0, 0.09, 0.05);
    // A little data burst, like a transponder reply on the scope.
    const n = 3 + Math.floor(Math.random() * 6);
    let at = t0 + 0.12;
    for (let i = 0; i < n; i++) {
      beep(at, [1180, 1320, 1480, 1760][Math.floor(Math.random() * 4)], 0.05, 0.016);
      at += 0.07 + Math.random() * 0.05;
    }
    hiss(at + 0.05, 0.14, 0.04);
    beep(at + 0.24, 1050, 0.09);
    beep(at + 0.36, 1400, 0.12);
    // Every so often, a second station answers, further off.
    if (Math.random() < 0.4) {
      const back = at + 1.4 + Math.random();
      hiss(back, 0.07, 0.03);
      beep(back + 0.1, 980, 0.07, 0.012);
      beep(back + 0.2, 1240, 0.1, 0.012);
    }
  }

  /**
   * A jet down on the runway spooling up for takeoff, or roaring in reverse thrust
   * after landing: a rising whine over a broad roar, a long way off and through
   * the glass. Runs through the weather level, so it's louder up at the window.
   */
  jet(seconds: number, kind: 'takeoff' | 'landing' = 'takeoff') {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const end = now + seconds;
    const out = ctx.createGain();
    const peak = kind === 'takeoff' ? 0.9 : 0.6;
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(peak, now + (kind === 'takeoff' ? seconds * 0.45 : 2));
    out.gain.setValueAtTime(peak, now + seconds * (kind === 'takeoff' ? 0.55 : 0.3));
    out.gain.exponentialRampToValueAtTime(0.0001, end);
    // Far away and behind glass: little above a couple of kilohertz gets through.
    const glass = ctx.createBiquadFilter();
    glass.type = 'lowpass';
    glass.frequency.value = 2200;
    out.connect(glass).connect(this.windGain);
    const roar = this.loop(this.noiseBuffer(4, true));
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.Q.value = 0.8;
    rlp.frequency.setValueAtTime(160, now);
    rlp.frequency.exponentialRampToValueAtTime(kind === 'takeoff' ? 900 : 600, now + seconds * 0.4);
    rlp.frequency.exponentialRampToValueAtTime(220, end);
    const rg = ctx.createGain();
    rg.gain.value = 1.4;
    roar.connect(rlp).connect(rg).connect(out);
    roar.start(now);
    roar.stop(end + 0.1);
    // The turbine: two whines a fifth apart, climbing as the engines spool.
    for (const [f0, f1, level] of [
      [380, 2300, 0.03],
      [570, 3450, 0.015],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0, now);
      o.frequency.exponentialRampToValueAtTime(kind === 'takeoff' ? f1 : f1 * 0.6, now + Math.min(7, seconds * 0.35));
      o.frequency.exponentialRampToValueAtTime(f1 * 0.45, end);
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(out);
      o.start(now);
      o.stop(end + 0.1);
    }
  }

  /** Birds in the garden: little phrases of chirps and trills, never quite the same twice. */
  private birdsong() {
    const ctx = this.ctx!;
    const sing = () => {
      if (!this.ctx) return;
      const t0 = ctx.currentTime + 0.05;
      const kind = Math.random();
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      pan.connect(this.windGain);
      const chirp = (at: number, f0: number, f1: number, len: number, vol: number) => {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, at);
        o.frequency.exponentialRampToValueAtTime(f1, at + len);
        const g = this.env(at, vol, 0.006, len);
        o.connect(g).connect(pan);
        o.start(at);
        o.stop(at + len + 0.05);
      };
      if (kind < 0.45) {
        // A sparrow: a run of quick downward chirps.
        const n = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) chirp(t0 + i * 0.13, 5200 - i * 120, 3400, 0.07, 0.05);
      } else if (kind < 0.8) {
        // A finch: a trill, then a flourish up.
        for (let i = 0; i < 10; i++) chirp(t0 + i * 0.045, 4200, 4800, 0.03, 0.035);
        chirp(t0 + 0.5, 3200, 6200, 0.18, 0.05);
      } else {
        // A dove, far off: two soft low coos.
        for (const d of [0, 0.7]) {
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(520, t0 + d);
          o.frequency.linearRampToValueAtTime(600, t0 + d + 0.15);
          o.frequency.linearRampToValueAtTime(480, t0 + d + 0.45);
          const g = this.env(t0 + d, 0.03, 0.08, 0.45);
          o.connect(g).connect(pan);
          o.start(t0 + d);
          o.stop(t0 + d + 0.6);
        }
      }
      window.setTimeout(sing, 1800 + Math.random() * 6500);
    };
    window.setTimeout(sing, 1500);
  }

  /** The bell in the tower, now and then: a few slow strokes, each one humming away for a long time. */
  private bells() {
    const ctx = this.ctx!;
    const toll = () => {
      if (!this.ctx) return;
      const t0 = ctx.currentTime + 0.1;
      const strokes = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < strokes; i++) {
        const at = t0 + i * 3.2;
        // A church bell's partials: hum, prime, minor third, fifth, nominal.
        for (const [mult, amp, decay] of [
          [0.5, 0.6, 7],
          [1, 1, 5],
          [1.19, 0.5, 3.5],
          [1.5, 0.35, 3],
          [2, 0.45, 2.5],
          [2.66, 0.15, 1.6],
        ]) {
          const o = ctx.createOscillator();
          o.frequency.value = 196 * mult;
          const g = this.env(at, 0.012 * amp, 0.004, decay);
          o.connect(g).connect(this.ambience);
          g.connect(this.verbIn);
          o.start(at);
          o.stop(at + decay + 0.2);
        }
      }
      window.setTimeout(toll, 40000 + Math.random() * 40000);
    };
    window.setTimeout(toll, 12000);
  }

  private startCrackle() {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.0004) d[i] = (Math.random() * 2 - 1) * 0.9;
    }
    const s = this.loop(buf);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    s.connect(hp).connect(g).connect(this.musicBus);
    s.start();
  }

  // --- the band ---------------------------------------------------------------

  private schedule() {
    const ctx = this.ctx!;
    const score = SCORES[this.weather];
    const sixteenth = 60 / score.bpm / 4;
    while (this.nextAt < ctx.currentTime + 0.15) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      // Swing: every other sixteenth lands a little late.
      const at = this.nextAt + (s % 2 ? sixteenth * score.swing : 0);
      if (this.musicOn) {
        if (this.weather === 'city') this.playCity(at, s, bar, sixteenth * 16);
        else if (this.weather === 'tower') this.playTower(at, s, bar, sixteenth * 16);
        else if (this.weather === 'monastery') this.playMonastery(at, s, bar, sixteenth);
        else this.playLake(at, s, bar);
      }
      this.nextAt += sixteenth;
      this.step++;
    }
  }

  /** The lake: Rhodes chords, a round bass, brushes, and a celesta like falling snow. */
  private playLake(at: number, s: number, bar: number) {
    const { chords, sparkle } = SCORES.alps;
    const chord = chords[bar % chords.length];
    if (s === 0 || (s === 10 && bar % 2)) this.kick(at, s === 0 ? 0.75 : 0.45);
    if (s === 4 || s === 12) this.brush(at, s === 12 ? 1 : 0.8);
    if (s % 2 === 0) this.shaker(at, s % 4 === 0 ? 0.8 : 0.5);
    if (s === 0) chord.notes.forEach((n, i) => this.keys(at + i * 0.022, n, 0.1, 3.2));
    if (s === 8 && bar % 2 === 0) chord.notes.slice(1).forEach((n, i) => this.keys(at + i * 0.016, n, 0.05, 1.4));
    if (s === 0) this.bass(at, chord.bass, 1.6);
    if (s === 11) this.bass(at, chord.bass + 7, 0.6);
    if ((s === 2 || s === 7 || s === 13) && Math.random() < 0.22) this.bell(at, sparkle[Math.floor(Math.random() * sparkle.length)], 0.028);
  }

  /** The city: a pad that swells over each bar, an arpeggio in the echo, a plucked bass, a quiet drum machine. */
  private playCity(at: number, s: number, bar: number, barLength: number) {
    const { chords } = SCORES.city;
    const chord = chords[bar % chords.length];
    if (s === 0) this.pad(at, [...chord.notes, chord.notes[0] + 12], barLength * 1.15);
    if (s % 2 === 0) {
      const order = [0, 1, 2, 3, 2, 1, 3, 1];
      this.arp(at, chord.notes[order[(s / 2) % order.length]] + 12, s === 0 ? 0.034 : 0.024);
    }
    if (s === 0 || s === 8) this.synthBass(at, chord.bass, 0.45);
    if (s === 3 || s === 11) this.synthBass(at, chord.bass + (s === 11 && bar % 2 ? 12 : 0), 0.2);
    if (s === 0 || s === 8) this.kick(at, 0.6);
    if (s === 4 || s === 12) this.snap(at);
    if (s % 2 === 1) this.hat(at, 0.22, false);
  }

  /** The tower: airy pads that breathe over two bars, a sub bass, a ping in the echo like a sweep on the scope. */
  private playTower(at: number, s: number, bar: number, barLength: number) {
    const { chords, sparkle } = SCORES.tower;
    const chord = chords[Math.floor(bar / 2) % chords.length];
    if (s === 0 && bar % 2 === 0) this.airPad(at, chord.notes, barLength * 2.2);
    if (s === 0) this.sub(at, chord.bass, barLength * 0.9);
    if (s === 0 && bar % 2 === 1) this.ping(at, chord.notes[3] + 24, 0.03);
    if (s === 10 && Math.random() < 0.35) this.ping(at, sparkle[Math.floor(Math.random() * sparkle.length)], 0.016);
    if (s % 4 === 2) this.hat(at, 0.12, false);
  }

  private chantPhrase = 0;
  private chantNote = 0;
  private chantNext = 0;
  /** The monastery: a drone that never stops, and a chant line over it with a breath between phrases. */
  private playMonastery(at: number, s: number, bar: number, sixteenth: number) {
    const step = bar * 16 + s;
    if (s === 0 && bar % 4 === 0) {
      const len = sixteenth * 16 * 4.4;
      this.voice(at, 38, len, 0.022, 'o');
      this.voice(at, 45, len, 0.016, 'o');
    }
    if (step < this.chantNext) return;
    const phrase = CHANT[this.chantPhrase % CHANT.length];
    const [note, sixteenths] = phrase[this.chantNote];
    const len = sixteenths * sixteenth;
    this.voice(at, note, len * 1.05, 0.05, this.chantNote % 3 === 1 ? 'o' : 'a');
    // An octave below, quietly: a second brother joining in.
    this.voice(at, note - 12, len * 1.05, 0.018, 'u');
    this.chantNext = step + sixteenths;
    if (++this.chantNote >= phrase.length) {
      this.chantNote = 0;
      this.chantPhrase++;
      this.chantNext += 10 + Math.floor(Math.random() * 8);
    }
  }

  private env(at: number, peak: number, attack: number, decay: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }

  /** Electric piano: a sine with a quiet bell partial, tape-wobbled. */
  private keys(at: number, midi: number, vel: number, len: number) {
    const ctx = this.ctx!;
    const g = this.env(at, vel, 0.012, len);
    g.connect(this.musicBus);
    for (const [mult, amp, type] of [
      [1, 1, 'sine'],
      [2.001, 0.18, 'sine'],
      [1, 0.25, 'triangle'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mult;
      this.wow.connect(o.detune);
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.onended = () => this.wow.disconnect(o.detune);
      o.start(at);
      o.stop(at + len + 0.1);
    }
  }

  private bass(at: number, midi: number, len: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(midi);
    this.wow.connect(o.detune);
    const g = this.env(at, 0.32, 0.02, len);
    o.connect(g).connect(this.musicBus);
    o.onended = () => this.wow.disconnect(o.detune);
    o.start(at);
    o.stop(at + len + 0.1);
  }

  private kick(at: number, vel: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    const g = this.env(at, 0.7 * vel, 0.003, 0.32);
    o.connect(g).connect(this.musicBus);
    o.start(at);
    o.stop(at + 0.4);
  }

  private hat(at: number, vel: number, open: boolean) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = this.env(at, 0.07 * vel, 0.001, open ? 0.22 : 0.045);
    n.connect(hp).connect(g).connect(this.musicBus);
    n.start(at, Math.random() * 3, open ? 0.3 : 0.08);
  }

  /** A bell: a celesta-ish sine with an inharmonic partial, straight into the room. */
  private bell(at: number, midi: number, vel: number) {
    const ctx = this.ctx!;
    const g = this.env(at, vel, 0.002, 1.8);
    g.connect(this.musicBus);
    g.connect(this.verbIn);
    for (const [mult, amp] of [
      [1, 1],
      [4.07, 0.22],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(at);
      o.stop(at + 1.9);
    }
  }

  /** Brushes on a snare: filtered noise with a soft swept attack. */
  private brush(at: number, vel: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, at);
    bp.frequency.exponentialRampToValueAtTime(1200, at + 0.2);
    bp.Q.value = 0.6;
    const g = this.env(at, 0.09 * vel, 0.03, 0.22);
    n.connect(bp).connect(g).connect(this.musicBus);
    g.connect(this.verbIn);
    n.start(at, Math.random() * 3, 0.3);
  }

  private shaker(at: number, vel: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6200;
    bp.Q.value = 1.2;
    const g = this.env(at, 0.03 * vel, 0.012, 0.06);
    n.connect(bp).connect(g).connect(this.musicBus);
    n.start(at, Math.random() * 3, 0.1);
  }

  /** A slow analog pad: three detuned saws a note, through a low filter that breathes. */
  private pad(at: number, notes: number[], len: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(380, at);
    lp.frequency.linearRampToValueAtTime(1100, at + len * 0.45);
    lp.frequency.linearRampToValueAtTime(500, at + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.05, at + Math.min(1.6, len * 0.4));
    g.gain.setValueAtTime(0.05, at + len * 0.7);
    g.gain.linearRampToValueAtTime(0, at + len + 0.6);
    lp.connect(g);
    g.connect(this.musicBus);
    g.connect(this.verbIn);
    for (const n of notes) {
      for (const cents of [-9, 0, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = cents;
        this.wow.connect(o.detune);
        o.connect(lp);
        o.onended = () => this.wow.disconnect(o.detune);
        o.start(at);
        o.stop(at + len + 0.7);
      }
    }
  }

  /** A soft square pluck, mostly heard in the echo. */
  private arp(at: number, midi: number, vel: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, at);
    lp.frequency.exponentialRampToValueAtTime(500, at + 0.25);
    const g = this.env(at, vel, 0.004, 0.3);
    o.connect(lp).connect(g);
    g.connect(this.musicBus);
    g.connect(this.echoIn);
    o.start(at);
    o.stop(at + 0.4);
  }

  /** A synth bass: saw and sub, with a filter that snaps shut. */
  private synthBass(at: number, midi: number, len: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(900, at);
    lp.frequency.exponentialRampToValueAtTime(180, at + len);
    const g = this.env(at, 0.2, 0.005, len + 0.15);
    lp.connect(g).connect(this.musicBus);
    for (const [type, mult, amp] of [
      ['sawtooth', 1, 0.7],
      ['sine', 0.5, 1],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(at);
      o.stop(at + len + 0.2);
    }
  }

  /** The drum machine's snare: a short noise snap into a long room. */
  private snap(at: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 0.9;
    const g = this.env(at, 0.12, 0.002, 0.12);
    n.connect(bp).connect(g);
    g.connect(this.musicBus);
    const wet = ctx.createGain();
    wet.gain.value = 1.4;
    g.connect(wet).connect(this.verbIn);
    n.start(at, Math.random() * 3, 0.2);
  }

  /** A soft pad: sines and triangles, gently detuned, slow in and slow out, mostly heard in the room. */
  private airPad(at: number, notes: number[], len: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.045, at + len * 0.35);
    g.gain.linearRampToValueAtTime(0.03, at + len * 0.7);
    g.gain.linearRampToValueAtTime(0, at + len);
    lp.connect(g);
    g.connect(this.musicBus);
    g.connect(this.verbIn);
    for (const n of notes) {
      for (const [cents, type] of [
        [-6, 'triangle'],
        [5, 'sine'],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = hz(n);
        o.detune.value = cents;
        this.wow.connect(o.detune);
        o.connect(lp);
        o.onended = () => this.wow.disconnect(o.detune);
        o.start(at);
        o.stop(at + len + 0.1);
      }
    }
  }

  /** A round sine bass under the pads. */
  private sub(at: number, midi: number, len: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = hz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.16, at + 0.4);
    g.gain.setValueAtTime(0.16, at + len * 0.7);
    g.gain.linearRampToValueAtTime(0, at + len);
    o.connect(g).connect(this.musicBus);
    o.start(at);
    o.stop(at + len + 0.1);
  }

  /** A sonar-ish ping: a pure tone with a soft bell partial, into the echo. */
  private ping(at: number, midi: number, vel: number) {
    const ctx = this.ctx!;
    const g = this.env(at, vel, 0.003, 1.4);
    g.connect(this.musicBus);
    g.connect(this.echoIn);
    for (const [mult, amp] of [
      [1, 1],
      [2.0, 0.12],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(at);
      o.stop(at + 1.5);
    }
  }

  /** A sung note: buzzing saws through three vowel formants, a slow swell and a little vibrato, into a long stone room. */
  private voice(at: number, midi: number, len: number, vel: number, vowel: 'a' | 'o' | 'u') {
    const ctx = this.ctx!;
    const formants = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530] }[vowel];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + Math.min(0.25, len * 0.3));
    out.gain.setValueAtTime(vel, at + len * 0.75);
    out.gain.linearRampToValueAtTime(0, at + len + 0.25);
    out.connect(this.musicBus);
    const wet = ctx.createGain();
    wet.gain.value = 1.6;
    out.connect(wet).connect(this.verbIn);
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.8;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 9;
    vib.connect(vibDepth);
    vib.start(at);
    vib.stop(at + len + 0.4);
    const src = ctx.createGain();
    for (const cents of [-5, 4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(midi);
      o.detune.value = cents;
      vibDepth.connect(o.detune);
      o.connect(src);
      o.start(at);
      o.stop(at + len + 0.4);
    }
    formants.forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 6 + i * 2;
      const fg = ctx.createGain();
      fg.gain.value = [1, 0.5, 0.18][i];
      src.connect(bp).connect(fg).connect(out);
    });
  }

  /** A made-up room: stereo noise that dies away. */
  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  // --- little sounds --------------------------------------------------------------

  click() {
    if (!this.ctx || this.muted) return;
    const at = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 1800;
    const g = this.env(at, 0.03, 0.001, 0.03);
    o.connect(g).connect(this.ambience);
    o.start(at);
    o.stop(at + 0.05);
  }

  /** A dial-up handshake, for walking up to the BBS. */
  modem() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const tone = (at: number, freqs: number[], len: number, vol = 0.035) => {
      for (const f of freqs) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(vol, at + 0.01);
        g.gain.setValueAtTime(vol, at + len - 0.01);
        g.gain.linearRampToValueAtTime(0, at + len);
        o.connect(g).connect(this.ambience);
        o.start(at);
        o.stop(at + len + 0.02);
      }
    };
    const dtmf: [number, number][] = [
      [697, 1209],
      [770, 1336],
      [852, 1477],
      [697, 1336],
      [941, 1336],
      [770, 1209],
      [852, 1336],
    ];
    dtmf.forEach((pair, i) => tone(t + i * 0.11, pair, 0.07));
    const h = t + dtmf.length * 0.11 + 0.25;
    tone(h, [2100], 0.5, 0.03);
    tone(h + 0.55, [1300, 2100], 0.35, 0.025);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, h + 0.95);
    g.gain.linearRampToValueAtTime(0.03, h + 1.0);
    g.gain.setValueAtTime(0.03, h + 1.7);
    g.gain.linearRampToValueAtTime(0, h + 1.8);
    n.connect(bp).connect(g).connect(this.ambience);
    n.start(h + 0.95, 0, 0.9);
  }

  /** The nib on paper: a soft scratch that runs while the pen writes. */
  private startPen() {
    const ctx = this.ctx!;
    const n = this.loop(this.noise);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 1.2;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 9;
    const wd = ctx.createGain();
    wd.gain.value = 900;
    wobble.connect(wd).connect(bp.frequency);
    wobble.start();
    this.penGain = ctx.createGain();
    this.penGain.gain.value = 0;
    n.connect(bp).connect(this.penGain).connect(this.ambience);
    n.start();
  }

  pen(on: boolean) {
    if (!this.ctx) return;
    this.penGain.gain.setTargetAtTime(on && !this.muted ? 0.035 : 0, this.ctx.currentTime, 0.05);
  }

  /** A short burst of filtered noise: the building block of most room sounds. */
  private burst(freq: number, q: number, vol: number, len: number, delay = 0, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + delay;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(at, vol, 0.002, len);
    n.connect(f).connect(g).connect(this.ambience);
    n.start(at, Math.random() * 3, len + 0.1);
  }

  /** A bite of chocolate: a snap, then a little crunch. */
  crunch() {
    this.burst(3200, 0.9, 0.12, 0.05);
    for (let i = 1; i < 5; i++) this.burst(1400 + Math.random() * 1800, 1.2, 0.05, 0.04, 0.05 + i * 0.06);
  }

  /** A sip of cappuccino. */
  sip() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const at = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(700, at);
    bp.frequency.linearRampToValueAtTime(1600, at + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.06, at + 0.08);
    g.gain.linearRampToValueAtTime(0.0, at + 0.4);
    n.connect(bp).connect(g).connect(this.ambience);
    n.start(at, Math.random() * 3, 0.5);
  }

  /** The steam wand, for a refill. */
  steam() {
    this.burst(5200, 0.6, 0.05, 1.1, 0, 'highpass');
  }

  /** A watch pusher: a crisp mechanical click. */
  pusher() {
    this.burst(6000, 3, 0.09, 0.02);
    this.burst(2400, 4, 0.05, 0.03, 0.012);
  }

  /** One tick of a watch, very small. */
  tick() {
    this.burst(7200, 6, 0.012, 0.012);
  }

  /** Paper: a page turning, or a sheet torn off the pad. */
  page() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const at = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(1800, at);
    bp.frequency.exponentialRampToValueAtTime(4200, at + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.05, at + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    n.connect(bp).connect(g).connect(this.ambience);
    n.start(at, Math.random() * 3, 0.4);
  }

  /** A coin on foil. Call it often; it keeps itself quiet. */
  private lastScratch = 0;
  scratch() {
    if (!this.ctx || performance.now() - this.lastScratch < 45) return;
    this.lastScratch = performance.now();
    this.burst(4800 + Math.random() * 2000, 1.4, 0.03, 0.05);
  }

  /** Split-flaps falling: a quick clatter, one click per flap. */
  flaps(n: number) {
    for (let i = 0; i < Math.min(n, 6); i++) this.burst(3800 + Math.random() * 1500, 5, 0.018, 0.012, i * 0.012);
  }

  /** A medal swinging against its neighbor. */
  jingle() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const at = ctx.currentTime;
    for (const [f, d] of [
      [2637, 0],
      [3520, 0.07],
      [3136, 0.16],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = this.env(at + d, 0.02, 0.002, 0.5);
      o.connect(g).connect(this.ambience);
      o.start(at + d);
      o.stop(at + d + 0.6);
    }
  }

  /** A card flicking past on the Rolodex. */
  flick() {
    this.burst(2600, 2, 0.06, 0.03);
  }

  /** Shoes landing on the floorboards. */
  thud() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const at = ctx.currentTime;
    for (const d of [0, 0.12]) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, at + d);
      o.frequency.exponentialRampToValueAtTime(60, at + d + 0.1);
      const g = this.env(at + d, 0.12, 0.003, 0.14);
      o.connect(g).connect(this.ambience);
      o.start(at + d);
      o.stop(at + d + 0.2);
    }
  }

  stop() {
    window.clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
  }
}
