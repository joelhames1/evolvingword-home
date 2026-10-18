// All the sound is synthesized live with Web Audio: rain against the glass,
// vinyl crackle, a neon hum, and a lo-fi band (electric piano, bass, soft
// drums) playing a slow chord loop with a little tape wobble. No audio files.

const CHORDS = [
  { bass: 43, notes: [58, 62, 65, 69] }, // Gm9
  { bass: 48, notes: [58, 64, 69, 74] }, // C13
  { bass: 41, notes: [57, 60, 64, 67] }, // Fmaj9
  { bass: 38, notes: [53, 57, 60, 64] }, // Dm9
];
const PENTATONIC = [65, 67, 69, 72, 74, 77, 79, 81];
const BPM = 74;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambience!: GainNode;
  private rainGain!: GainNode;
  private wow!: GainNode;
  private noise!: AudioBuffer;
  private timer = 0;
  private step = 0;
  private nextAt = 0;
  musicOn = true;
  muted = true;

  get started() {
    return !!this.ctx;
  }

  /** Must be called from a click or key press: browsers only allow sound after one. */
  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
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

    this.noise = this.noiseBuffer(4);
    this.startRain();
    this.startCrackle();
    this.startHum();

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

  /** 0 inside, 1 out in the street: the rain gets loud and the band fades. */
  setOutside(k: number) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(0.1 + k * 0.35, this.ctx.currentTime, 0.5);
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

  private startRain() {
    const ctx = this.ctx!;
    const bed = this.loop(this.noiseBuffer(5, true));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.1;
    bed.connect(lp).connect(this.rainGain).connect(this.ambience);
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
    patter.connect(bp).connect(pg).connect(this.rainGain);
    patter.start();
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

  // --- the band ---------------------------------------------------------------

  private schedule() {
    const ctx = this.ctx!;
    const sixteenth = 60 / BPM / 4;
    while (this.nextAt < ctx.currentTime + 0.15) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      // Swing: every other sixteenth lands late.
      const at = this.nextAt + (s % 2 ? sixteenth * 0.18 : 0);
      if (this.musicOn) this.playStep(at, s, bar);
      this.nextAt += sixteenth;
      this.step++;
    }
  }

  private playStep(at: number, s: number, bar: number) {
    const chord = CHORDS[bar % CHORDS.length];
    if (s === 0 || s === 7 || (s === 10 && bar % 2)) this.kick(at, s === 0 ? 1 : 0.7);
    if (s === 4 || s === 12) this.snare(at);
    if (s % 2 === 0) this.hat(at, s % 4 === 0 ? 0.5 : 0.3, s === 14 && bar % 4 === 3);
    if (s === 0) chord.notes.forEach((n, i) => this.keys(at + i * 0.018, n, 0.11, 2.6));
    if (s === 6) chord.notes.slice(1).forEach((n, i) => this.keys(at + i * 0.014, n, 0.06, 1.2));
    if (s === 0) this.bass(at, chord.bass, 1.4);
    if (s === 11) this.bass(at, chord.bass + (bar % 2 ? 7 : 12), 0.5);
    if ((s === 3 || s === 9 || s === 14) && Math.random() < 0.3) {
      this.keys(at, PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)], 0.045, 1.6);
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

  private snare(at: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.8;
    const g = this.env(at, 0.22, 0.002, 0.18);
    n.connect(bp).connect(g).connect(this.musicBus);
    n.start(at, Math.random() * 3, 0.25);
    const body = ctx.createOscillator();
    body.frequency.value = 185;
    const bg = this.env(at, 0.12, 0.002, 0.08);
    body.connect(bg).connect(this.musicBus);
    body.start(at);
    body.stop(at + 0.12);
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

  stop() {
    window.clearInterval(this.timer);
    void this.ctx?.close();
    this.ctx = null;
  }
}
