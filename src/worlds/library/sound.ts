// The library's music and its air. A slow organ holds D and A under everything;
// soft voices change chord every two bars in the Dorian mode, mostly heard in a
// very long room; now and then a few notes of a felt piano fall like dust. Under
// the music: air moving up the well, footsteps on a stone stair somewhere above
// or below, a page turned far off.
import type { Band, SoundKit } from '../../audio';

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** The voices' chords, two bars each, over the organ's D: Dm9, G6, Am7, Cadd9. */
const CHORDS = [
  [57, 60, 64, 65],
  [59, 62, 64, 67],
  [57, 60, 64, 67],
  [55, 60, 62, 64],
];
/** The notes that fall: D Dorian, high up. */
const DUST = [74, 76, 77, 81, 84, 86, 88];

export interface LibraryBand extends Band {
  /** A footstep on the stone stair: how loud (0..1) and where (-1 left .. 1 right). */
  footstep(vol: number, pan: number): void;
  /** A page turning, near or far. */
  page(vol: number): void;
  /** A book slid home on its shelf. */
  shelve(vol: number): void;
}

export function buildBand(): LibraryBand {
  let kit: SoundKit | null = null;
  /** The ambience's own room, so it rings on with the tape off. */
  let hall: GainNode | null = null;

  /** An organ pipe rank: sines on the harmonics, slow to speak and slow to fade. */
  const organ = (k: SoundKit, at: number, midi: number, len: number, vel: number) => {
    const ctx = k.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + 3.5);
    out.gain.setValueAtTime(vel, at + len - 4);
    out.gain.linearRampToValueAtTime(0, at + len);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    lp.connect(out);
    out.connect(k.music);
    const wet = ctx.createGain();
    wet.gain.value = 1.2;
    out.connect(wet).connect(k.verb);
    for (const [mult, amp, cents] of [
      [0.5, 0.22, 0],
      [1, 1, -2],
      [1, 0.5, 3],
      [2, 0.42, 0],
      [3, 0.16, 1],
      [4, 0.1, -1],
      [6, 0.035, 0],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      o.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(lp);
      o.start(at);
      o.stop(at + len + 0.1);
    }
  };

  /**
   * A choir note: two buzzing saws, a little apart, through the formants of a
   * soft "oo" or "ah", breathing in slowly and fading slowly, mostly heard in
   * the room. Slower to speak than a chant: these are pads.
   */
  const choir = (k: SoundKit, at: number, midi: number, len: number, vel: number, vowel: 'oo' | 'ah') => {
    const ctx = k.ctx;
    const formants = vowel === 'oo' ? [[350, 1, 7], [720, 0.35, 9], [2400, 0.08, 12]] : [[700, 1, 6], [1100, 0.45, 8], [2700, 0.1, 12]];
    const out = ctx.createGain();
    const breathe = Math.min(2.8, len * 0.3);
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + breathe);
    out.gain.setValueAtTime(vel, at + len - 3);
    out.gain.linearRampToValueAtTime(0, at + len);
    out.connect(k.music);
    const wet = ctx.createGain();
    wet.gain.value = 1.8;
    out.connect(wet).connect(k.verb);
    const src = ctx.createGain();
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6 + Math.random() * 0.8;
    const depth = ctx.createGain();
    depth.gain.value = 6;
    vib.connect(depth);
    vib.start(at);
    vib.stop(at + len + 0.1);
    for (const cents of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(midi);
      o.detune.value = cents;
      depth.connect(o.detune);
      o.connect(src);
      o.start(at);
      o.stop(at + len + 0.1);
    }
    for (const [f, amp, q] of formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = amp;
      src.connect(bp).connect(g).connect(out);
    }
  };

  /** A felt piano: soft hammer, a few partials, a long ring into the room and the echo. */
  const felt = (k: SoundKit, at: number, midi: number, vel: number) => {
    const ctx = k.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(vel, at + 0.006);
    out.gain.exponentialRampToValueAtTime(vel * 0.35, at + 0.5);
    out.gain.exponentialRampToValueAtTime(0.0001, at + 4.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, at);
    lp.frequency.exponentialRampToValueAtTime(900, at + 3);
    lp.connect(out);
    out.connect(k.music);
    const wet = ctx.createGain();
    wet.gain.value = 0.9;
    out.connect(wet).connect(k.verb);
    const echo = ctx.createGain();
    echo.gain.value = 0.3;
    out.connect(echo).connect(k.echo);
    for (const [mult, amp, type] of [
      [1, 1, 'sine'],
      [1, 0.25, 'triangle'],
      [2, 0.16, 'sine'],
      [3, 0.05, 'sine'],
      [4.2, 0.02, 'sine'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(lp);
      o.start(at);
      o.stop(at + 4.6);
    }
  };

  /** A short burst of filtered noise into the hall. */
  const burst = (k: SoundKit, at: number, freq: number, q: number, vol: number, attack: number, decay: number, pan = 0, type: BiquadFilterType = 'bandpass') => {
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
    n.connect(f).connect(g).connect(p);
    p.connect(k.ambience);
    if (hall) p.connect(hall);
    n.start(at, Math.random() * 3, attack + decay + 0.05);
    return f;
  };

  const footstep = (k: SoundKit, at: number, vol: number, pan: number) => {
    // Heel, then the sole: a dull knock with a little grit, ringing in the stone.
    burst(k, at, 260, 1.1, vol * 0.5, 0.003, 0.13, pan);
    burst(k, at + 0.05, 1900, 1.6, vol * 0.08, 0.002, 0.05, pan);
  };

  /** Someone walking somewhere far off: a dozen steps, coming and going. */
  const walk = (k: SoundKit) => {
    const t0 = k.ctx.currentTime + 0.2;
    const n = 8 + Math.floor(Math.random() * 10);
    const pan = (Math.random() * 2 - 1) * 0.8;
    const pace = 0.55 + Math.random() * 0.15;
    for (let i = 0; i < n; i++) {
      const swell = Math.sin((i / (n - 1)) * Math.PI);
      footstep(k, t0 + i * pace + Math.random() * 0.03, 0.05 + swell * 0.07, pan + (i / n - 0.5) * 0.3);
    }
  };

  const page = (k: SoundKit, at: number, vol: number) => {
    // The leaf lifts (a rising hiss), sweeps over, and settles (a soft flap).
    const f = burst(k, at, 1200, 0.8, vol * 0.5, 0.18, 0.32);
    f.frequency.setValueAtTime(800, at);
    f.frequency.exponentialRampToValueAtTime(2600, at + 0.2);
    f.frequency.exponentialRampToValueAtTime(1400, at + 0.5);
    burst(k, at + 0.42, 500, 0.7, vol * 0.35, 0.004, 0.09, 0, 'lowpass');
  };

  const shelve = (k: SoundKit, at: number, vol: number) => {
    burst(k, at, 900, 0.9, vol * 0.25, 0.25, 0.1);
    burst(k, at + 0.32, 180, 1.2, vol * 0.6, 0.002, 0.16, 0, 'lowpass');
  };

  /** The air coming up the well: a low breath that rises and falls, and a thin whistle high in it. */
  const air = (k: SoundKit) => {
    const ctx = k.ctx;
    const bed = k.sound.loop(k.sound.noiseBuffer(6, true));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 340;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.031;
    const depth = ctx.createGain();
    depth.gain.value = 0.35;
    swell.connect(depth).connect(g.gain);
    swell.start();
    bed.connect(bp).connect(g).connect(k.weather);
    bed.start();
    const thin = k.sound.loop(k.noise);
    const tb = ctx.createBiquadFilter();
    tb.type = 'bandpass';
    tb.frequency.value = 1180;
    tb.Q.value = 9;
    const tg = ctx.createGain();
    tg.gain.value = 0.05;
    const tl = ctx.createOscillator();
    tl.frequency.value = 0.019;
    const td = ctx.createGain();
    td.gain.value = 0.04;
    tl.connect(td).connect(tg.gain);
    tl.start();
    thin.connect(tb).connect(tg).connect(k.weather);
    thin.start();
  };

  let chord = -1;
  return {
    bpm: 48,
    room: [7.5, 0.85],
    echoBeats: 1.5,
    outside: [0.05, 0.12],
    start(k) {
      kit = k;
      // A room of its own for the sounds of the library, separate from the music's.
      const verb = k.ctx.createConvolver();
      verb.buffer = k.sound.impulse(4.5);
      hall = k.ctx.createGain();
      hall.gain.value = 0.9;
      hall.connect(verb).connect(k.ambience);
      air(k);
      const later = (fn: () => void, lo: number, hi: number) => {
        const go = () => {
          if (!k.sound.muted) fn();
          window.setTimeout(go, (lo + Math.random() * (hi - lo)) * 1000);
        };
        window.setTimeout(go, (lo * 0.4 + Math.random() * lo * 0.4) * 1000);
      };
      later(() => walk(k), 30, 75);
      later(() => page(k, k.ctx.currentTime + 0.1, 0.06 + Math.random() * 0.05), 22, 55);
      later(() => shelve(k, k.ctx.currentTime + 0.1, 0.05), 40, 90);
    },
    play(k, at, step, bar, sixteenth) {
      const barLen = sixteenth * 16;
      // The organ: D and A, renewed every four bars, each overlapping the last.
      if (step === 0 && bar % 4 === 0) {
        organ(k, at, 38, barLen * 4 + 6, 0.05);
        organ(k, at + 0.4, 45, barLen * 4 + 6, 0.03);
      }
      // The voices: a new chord every two bars.
      if (step === 0 && bar % 2 === 0) {
        chord = (chord + 1) % CHORDS.length;
        // Each chord breathes in over the last one's fading, so they move like one slow breath.
        CHORDS[chord].forEach((n, i) => choir(k, at + i * 0.35, n, barLen * 2 + 4, i === 3 ? 0.014 : 0.02, i % 2 ? 'ah' : 'oo'));
      }
      // Dust: a note now and then, and sometimes a few falling together.
      if ((step === 0 || step === 6 || step === 11) && Math.random() < 0.22) {
        const i = Math.floor(Math.random() * DUST.length);
        if (Math.random() < 0.3) {
          for (let k2 = 0; k2 < 3 && i - k2 >= 0; k2++) felt(k, at + k2 * sixteenth * 2.2, DUST[i - k2], 0.03 - k2 * 0.006);
        } else felt(k, at, DUST[i], 0.028);
      }
    },
    footstep(vol, pan) {
      if (kit && !kit.sound.muted) footstep(kit, kit.ctx.currentTime + 0.02, vol, pan);
    },
    page(vol) {
      if (kit && !kit.sound.muted) page(kit, kit.ctx.currentTime + 0.02, vol);
    },
    shelve(vol) {
      if (kit && !kit.sound.muted) shelve(kit, kit.ctx.currentTime + 0.02, vol);
    },
  };
}
