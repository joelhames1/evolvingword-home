// The greenhouse's music and air. Every flower in bloom has its own note, and
// the band holds a slow chord made of them: a soft glass harmonium, breathing in
// over each pair of bars, so the more you grow (and the more different their
// notes) the richer it gets. A harp picks out the same notes now and then, and
// a low drone on D keeps it all at home. Under the music: birds in the garden,
// a wind chime somewhere off by the wall, a breeze, and when a shower passes,
// rain ticking on the glass. And the small sounds of gardening: the bee's buzz,
// water from the can, the shears, the compost bin's lid, a seed going in, and a
// bell for each flower that opens.
import type { Band, SoundKit } from '../../audio';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** The garden's notes: D major pentatonic, from the A below middle C up two octaves. */
export const SCALE = [57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88, 90, 93];
/** The drone, always: D and A. */
export const DRONE = [38, 45];
/** Birds: a blackbird's phrase is a few notes in this range, sliding. */
const BIRD = [1800, 2600];

export interface GreenhouseBand extends Band {
  /** The notes of the flowers in bloom (indexes into SCALE). */
  setNotes(notes: number[]): void;
  /** 0 dry, 1 the height of a shower. */
  rain(level: number): void;
  /** The bee: how hard it's buzzing (0..1), how near (0..1), and where (-1 left .. 1 right). */
  bee(level: number, near: number, pan: number): void;
  /** A flower opening: its note, as a soft bell. */
  bloom(note: number): void;
  /** A seed into the soil. */
  plop(): void;
  pour(): void;
  snip(): void;
  /** The compost bin's lid coming down. */
  thunk(): void;
  /** A rosette for the catalog: a little rising run on the harp. */
  stamp(): void;
  /** For the tests: what it's playing now. */
  chord(): number[];
}

export function buildBand(): GreenhouseBand {
  let kit: SoundKit | null = null;
  let notes: number[] = [];
  let chordNow: number[] = [];
  let rainBus: GainNode | null = null;
  let tickGain: GainNode | null = null;
  let beeGain: GainNode | null = null;
  let beeOsc: OscillatorNode | null = null;
  let beePan: StereoPannerNode | null = null;
  let raining = 0;
  /** What the bee's voice was last set to, so the frame only touches it when it changes. */
  const beeSet = { level: -1, pan: 2, pitch: -1 };

  /** A note of the glass harmonium: sines on a few partials, slow in, slow out. */
  const glass = (k: SoundKit, at: number, midi: number, len: number, vel: number) => {
    const ctx = k.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + Math.min(2.2, len * 0.35));
    out.gain.setValueAtTime(vel, at + len * 0.6);
    out.gain.linearRampToValueAtTime(0, at + len);
    out.connect(k.music);
    const wet = ctx.createGain();
    wet.gain.value = 1.1;
    out.connect(wet).connect(k.verb);
    for (const [mult, amp, cents] of [
      [1, 1, -3],
      [1, 0.6, 4],
      [2, 0.22, 0],
      [3, 0.06, 2],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      o.detune.value = cents;
      k.wow.connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.onended = () => k.wow.disconnect(o.detune);
      o.start(at);
      o.stop(at + len + 0.05);
    }
  };

  /** A plucked harp string: bright at first, ringing on into the room and the echo. */
  const harp = (k: SoundKit, at: number, midi: number, vel: number, dest?: AudioNode) => {
    const ctx = k.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + 0.004);
    out.gain.exponentialRampToValueAtTime(vel * 0.3, at + 0.4);
    out.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, at);
    lp.frequency.exponentialRampToValueAtTime(1100, at + 1.2);
    lp.connect(out);
    out.connect(dest ?? k.music);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    out.connect(wet).connect(k.verb);
    const echo = ctx.createGain();
    echo.gain.value = 0.25;
    out.connect(echo).connect(k.echo);
    for (const [mult, amp, type] of [
      [1, 1, 'triangle'],
      [2, 0.35, 'sine'],
      [3, 0.12, 'sine'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(lp);
      o.start(at);
      o.stop(at + 3.3);
    }
  };

  /** A short burst of filtered noise. */
  const burst = (k: SoundKit, at: number, freq: number, q: number, vol: number, attack: number, decay: number, type: BiquadFilterType = 'bandpass', dest?: AudioNode, pan = 0) => {
    const ctx = k.ctx;
    const n = ctx.createBufferSource();
    n.buffer = k.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    n.connect(f).connect(g).connect(p).connect(dest ?? k.ambience);
    n.start(at, Math.random() * 3, attack + decay + 0.05);
    return f;
  };

  /** A blackbird somewhere in the garden: a few fluting notes that slide. */
  const bird = (k: SoundKit) => {
    const ctx = k.ctx;
    const t0 = ctx.currentTime + 0.1;
    const pan = Math.random() * 1.6 - 0.8;
    const n = 3 + Math.floor(Math.random() * 5);
    let at = t0;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(k.weather);
    for (let i = 0; i < n; i++) {
      const len = 0.08 + Math.random() * 0.22;
      const f0 = BIRD[0] + Math.random() * (BIRD[1] - BIRD[0]);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.75 + Math.random() * 0.6), at + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.05, at + 0.015);
      g.gain.setValueAtTime(0.05, at + len * 0.6);
      g.gain.linearRampToValueAtTime(0, at + len);
      o.connect(g).connect(p);
      o.start(at);
      o.stop(at + len + 0.02);
      at += len + 0.04 + Math.random() * 0.12;
    }
  };

  /** The wind chime by the wall: a few tubes touching in the breeze. */
  const chime = (k: SoundKit) => {
    const ctx = k.ctx;
    const t0 = ctx.currentTime + 0.1;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const at = t0 + i * (0.18 + Math.random() * 0.5);
      const midi = SCALE[8 + Math.floor(Math.random() * 7)];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.012, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 4);
      g.connect(k.weather);
      for (const [mult, amp] of [
        [1, 1],
        [2.76, 0.35],
        [5.4, 0.12],
      ]) {
        const o = ctx.createOscillator();
        o.frequency.value = hz(midi) * mult;
        const og = ctx.createGain();
        og.gain.value = amp;
        o.connect(og).connect(g);
        o.start(at);
        o.stop(at + 4.1);
      }
    }
  };

  /** Air moving outside: a soft bed of noise, breathing slowly. */
  const breeze = (k: SoundKit) => {
    const ctx = k.ctx;
    const bed = k.sound.loop(k.sound.noiseBuffer(6, true));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    // The swell rides on top of a level that never goes below it, so the gain never turns negative.
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.05;
    const depth = ctx.createGain();
    depth.gain.value = 0.25;
    swell.connect(depth).connect(g.gain);
    swell.start();
    bed.connect(lp).connect(g).connect(k.weather);
    bed.start();
  };

  /** Rain on the glass: a hush of drops and, over it, single ticks on the panes. Both rise and fall with the shower. */
  const rainBed = (k: SoundKit) => {
    const ctx = k.ctx;
    rainBus = ctx.createGain();
    rainBus.gain.value = 0;
    rainBus.connect(k.ambience);
    const hush = k.sound.loop(k.sound.noiseBuffer(5, true));
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1600;
    hp.Q.value = 0.5;
    const hg = ctx.createGain();
    hg.gain.value = 0.5;
    hush.connect(hp).connect(hg).connect(rainBus);
    hush.start();
    tickGain = ctx.createGain();
    tickGain.gain.value = 1;
    tickGain.connect(rainBus);
  };

  /** The bee's drone: a buzzing saw, low-passed, its level and place set from the scene. */
  const beeVoice = (k: SoundKit) => {
    const ctx = k.ctx;
    beeOsc = ctx.createOscillator();
    beeOsc.type = 'sawtooth';
    beeOsc.frequency.value = 196;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 9;
    const wd = ctx.createGain();
    wd.gain.value = 12;
    wobble.connect(wd).connect(beeOsc.frequency);
    wobble.start();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 2;
    beeGain = ctx.createGain();
    beeGain.gain.value = 0;
    beePan = ctx.createStereoPanner();
    beeOsc.connect(lp).connect(beeGain).connect(beePan).connect(k.ambience);
    beeOsc.start();
  };

  return {
    bpm: 58,
    room: [4.5, 0.6],
    echoBeats: 1.5,
    outside: [0.07, 0.14],
    crackle: 0.4,
    start(k) {
      kit = k;
      breeze(k);
      rainBed(k);
      beeVoice(k);
      const later = (fn: () => void, lo: number, hi: number) => {
        const go = () => {
          if (!k.sound.muted) fn();
          window.setTimeout(go, (lo + Math.random() * (hi - lo)) * 1000);
        };
        window.setTimeout(go, (lo * 0.3 + Math.random() * lo * 0.4) * 1000);
      };
      later(() => raining < 0.5 && bird(k), 5, 16);
      later(() => chime(k), 20, 45);
    },
    play(k, at, step, bar, sixteenth) {
      const barLen = sixteenth * 16;
      // The drone, renewed every four bars.
      if (step === 0 && bar % 4 === 0) DRONE.forEach((n, i) => glass(k, at + i * 0.3, n, barLen * 4 + 3, i ? 0.016 : 0.022));
      // The garden's chord: every flower in bloom has a note in it (each pitch once), breathing in over two bars.
      if (step === 0 && bar % 2 === 0) {
        const pitches = [...new Set(notes)].sort((a, b) => a - b).map((n) => SCALE[Math.min(SCALE.length - 1, Math.max(0, n))]);
        // Kept to a soft voicing: at most eight notes, quieter the more there are.
        chordNow = pitches.length > 8 ? pitches.filter((_, i) => i % Math.ceil(pitches.length / 8) === 0) : pitches;
        const vel = 0.022 / Math.sqrt(Math.max(1, chordNow.length / 2));
        chordNow.forEach((n, i) => glass(k, at + i * 0.22, n, barLen * 2 + 2.5, vel));
      }
      // The harp picks out the garden's notes now and then, a little run up or a single note.
      if ((step === 4 || step === 10) && chordNow.length && Math.random() < 0.3) {
        if (Math.random() < 0.35) chordNow.slice(0, 4).forEach((n, i) => harp(k, at + i * sixteenth * 1.5, n + 12, 0.035 - i * 0.004));
        else harp(k, at, chordNow[Math.floor(Math.random() * chordNow.length)] + 12, 0.03);
      }
      // Rain ticking on the panes, as many as the shower brings.
      if (raining > 0.02 && tickGain) {
        const n = Math.floor(raining * 6 + Math.random() * raining * 4);
        for (let i = 0; i < n; i++) burst(k, at + Math.random() * sixteenth, 3500 + Math.random() * 3500, 3, 0.03 + Math.random() * 0.04, 0.001, 0.02 + Math.random() * 0.03, 'bandpass', tickGain, Math.random() * 1.6 - 0.8);
      }
    },
    setNotes(n) {
      notes = n.slice(0, 32);
    },
    rain(level) {
      const k0 = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
      const k = k0 < 0.002 ? 0 : k0;
      // (Called every frame: only a change worth hearing goes to the graph, and the last of a shower always does.)
      if (Math.abs(k - raining) < 0.002 && !(k === 0 && raining !== 0)) return;
      raining = k;
      if (kit && rainBus) rainBus.gain.setTargetAtTime(raining * 0.5, kit.ctx.currentTime, 0.6);
    },
    bee(level, near, pan) {
      if (!kit || !beeGain || !beePan || !beeOsc) return;
      const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : 0));
      const now = kit.ctx.currentTime;
      const loud = kit.sound.muted ? 0 : clamp(level, 0, 1) * clamp(near, 0, 1) * 0.03;
      const where = clamp(pan, -1, 1);
      const pitch = 170 + clamp(level, 0, 1) * 50;
      if (Math.abs(loud - beeSet.level) > 0.0005) beeGain.gain.setTargetAtTime((beeSet.level = loud), now, 0.08);
      if (Math.abs(where - beeSet.pan) > 0.02) beePan.pan.setTargetAtTime((beeSet.pan = where), now, 0.1);
      if (Math.abs(pitch - beeSet.pitch) > 0.5) beeOsc.frequency.setTargetAtTime((beeSet.pitch = pitch), now, 0.2);
    },
    bloom(note) {
      if (!kit || kit.sound.muted) return;
      harp(kit, kit.ctx.currentTime + 0.05, SCALE[Math.min(SCALE.length - 1, Math.max(0, note))] + 12, 0.05, kit.ambience);
    },
    plop() {
      if (!kit || kit.sound.muted) return;
      const ctx = kit.ctx;
      const at = ctx.currentTime + 0.02;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(420, at);
      o.frequency.exponentialRampToValueAtTime(140, at + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.08, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      o.connect(g).connect(kit.ambience);
      o.start(at);
      o.stop(at + 0.16);
      burst(kit, at, 900, 0.8, 0.03, 0.002, 0.08, 'lowpass');
    },
    pour() {
      if (!kit || kit.sound.muted) return;
      const at = kit.ctx.currentTime + 0.02;
      // Water through the rose: a splashy hiss that runs a second and a half.
      const f = burst(kit, at, 2400, 0.6, 0.06, 0.15, 1.5);
      f.frequency.setValueAtTime(1800, at);
      f.frequency.linearRampToValueAtTime(3000, at + 1.4);
      burst(kit, at + 0.2, 700, 0.9, 0.03, 0.2, 1.2, 'lowpass');
    },
    snip() {
      if (!kit || kit.sound.muted) return;
      const at = kit.ctx.currentTime + 0.02;
      for (const d of [0, 0.42]) {
        burst(kit, at + d, 5200, 4, 0.06, 0.001, 0.03);
        burst(kit, at + d + 0.015, 2600, 6, 0.04, 0.001, 0.05);
      }
    },
    thunk() {
      if (!kit || kit.sound.muted) return;
      const ctx = kit.ctx;
      const at = ctx.currentTime + 0.01;
      // A wooden lid dropping: a hollow knock, a low thud under it, and the rattle of the slats.
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(160, at);
      o.frequency.exponentialRampToValueAtTime(70, at + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.16, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      o.connect(g).connect(kit.ambience);
      o.start(at);
      o.stop(at + 0.28);
      burst(kit, at, 420, 3, 0.09, 0.002, 0.12);
      burst(kit, at + 0.04, 1500, 2, 0.025, 0.002, 0.08);
    },
    stamp() {
      if (!kit || kit.sound.muted) return;
      const at = kit.ctx.currentTime + 0.05;
      [62, 66, 69, 74, 78].forEach((n, i) => harp(kit!, at + i * 0.11, n + 12, 0.05, kit!.ambience));
    },
    chord: () => chordNow.slice(),
  };
}
