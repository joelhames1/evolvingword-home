// The line the night train runs on, and the train itself, as plain numbers so
// the tests can ride it without a browser. Five landscapes, one after another:
// at the end of each stretch a junction sends you down one of two lines, and
// the next landscape is whichever one that line leads to. The train keeps its
// own speed (slower through the city and over the pass), stops at the stations
// it comes to, and stops when someone pulls the emergency brake.

export type Land = 'fields' | 'gorge' | 'pass' | 'city' | 'lake';
export const LANDS: Land[] = ['fields', 'gorge', 'pass', 'city', 'lake'];

/** How each one is named on the lever's tabs, the map and in the captions. */
export const NAMES: Record<Land, string> = { fields: 'The fields', gorge: 'The gorge', pass: 'The high pass', city: 'The city', lake: 'The lake' };

/** At the end of every stretch, a junction: the two lines it can send you down. */
export const BRANCHES: Record<Land, [Land, Land]> = {
  fields: ['gorge', 'lake'],
  gorge: ['pass', 'city'],
  pass: ['lake', 'fields'],
  city: ['fields', 'gorge'],
  lake: ['city', 'pass'],
};

/** What's along each stretch, in meters from where it starts. */
export interface Layout {
  length: number;
  /** Top speed along it, m/s. */
  limit: number;
  station?: { at: number; name: string };
  /** A level crossing: a road over the line, with its barriers and bells. */
  crossing?: number;
  /** A stone viaduct over a gorge. */
  viaduct?: [number, number];
  /** A tunnel through the mountain. */
  tunnel?: [number, number];
  /** Avalanche sheds: a roof over the line, open on the valley side. */
  sheds?: [number, number][];
}

export const LAYOUT: Record<Land, Layout> = {
  fields: { length: 2200, limit: 25, crossing: 1000 },
  gorge: { length: 2000, limit: 21, viaduct: [760, 1120] },
  pass: { length: 2600, limit: 19, sheds: [[360, 520], [880, 1020]], tunnel: [1380, 1820], station: { at: 2160, name: 'HIGH PASS' } },
  city: { length: 2200, limit: 17, station: { at: 1150, name: 'CENTRAL' } },
  lake: { length: 2200, limit: 23, station: { at: 1250, name: 'LAKESIDE' } },
};

/** Half the length of the stretch where one landscape turns into the next, around the points. */
export const BLEND = 160;
/** The lever lights up this far before the points, and locks this far before them. */
export const LEVER_LIT = 1100;
export const LEVER_LOCK = 350;

/** The length of a rail: the wheels clack once over each joint between two. */
export const RAIL = 22.5;
/** The usual speed, m/s (a little under 90 km/h). */
export const CRUISE = 24;
/** Seconds between two rail joints at a speed; never, standing still. */
export const clackInterval = (v: number) => (v > 0.05 ? RAIL / v : Infinity);
/** Where the four wheels of the bogie under the compartment cross a joint, as shares of the time between joints: two axles, then the next car's two. */
export const AXLES = [0, 2.5 / RAIL, 16.9 / RAIL, 19.4 / RAIL];
/** The band's tempo: a beat for every rail joint while the wheels come at a tempo it can play, and a slow walk otherwise. */
export const bpmFor = (v: number) => Math.min(80, Math.max(40, (60 * v) / RAIL));
/** Whether the band's beat is the wheels' beat at this speed. */
export const inStep = (v: number) => (60 * v) / RAIL >= 40 && (60 * v) / RAIL <= 80;

export interface Leg {
  land: Land;
  start: number;
  end: number;
  /** Which of its two branches the junction at its end is set for. */
  set: 0 | 1;
  /** Who set it: the train picks unless you pull the lever. */
  by: 'train' | 'you';
  /** A number of its own, so no two visits to a landscape look quite the same. */
  seed: number;
}

export type Phase = 'running' | 'stopping' | 'dwell' | 'braking' | 'still' | 'easing';

export type TrainEvent =
  | { kind: 'points'; from: Leg; to: Leg }
  | { kind: 'lit'; leg: Leg }
  | { kind: 'locked'; leg: Leg }
  | { kind: 'arrive'; name: string; land: Land }
  | { kind: 'depart'; name: string }
  | { kind: 'stopped' }
  | { kind: 'release' }
  | { kind: 'away' };

const smooth = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** How long the train waits at a station, after an emergency stop, and while the brakes come off. */
export const DWELL = 16;
export const STILL = 7;
export const EASE = 2.6;
/** Braking: an emergency stop, the gentle stop at a platform, the usual slowing and pulling away. */
const EMERGENCY = 1.55;
const PULL_AWAY = 0.38;
const SLOW = 0.6;

export class Journey {
  /** Where the train is along the line (meters), and how fast it's going. */
  s: number;
  v = 0;
  phase: Phase = 'running';
  /** How long it's been in this phase. */
  held = 0;
  /** The stretches behind, the one we're on, and the ones the junctions ahead are set for. */
  legs: Leg[] = [];
  /** Goes up whenever the line ahead changes (a lever pulled): the land beyond `changedFrom` needs building again. */
  revision = 0;
  changedFrom = 0;
  private cur = 0;
  private lit = false;
  private locked = false;
  private served = -1;
  /** The station we're standing at, while we wait. */
  private stop: { at: number; name: string } | null = null;
  private rand: () => number;

  constructor(opts: { rand?: () => number; land?: Land; at?: number; speed?: number } = {}) {
    this.rand = opts.rand ?? Math.random;
    const land = opts.land ?? 'gorge';
    this.legs.push(this.leg(land, 0));
    this.s = opts.at ?? 0;
    this.v = opts.speed ?? LAYOUT[land].limit;
    this.extend();
  }

  private leg(land: Land, start: number): Leg {
    return { land, start, end: start + LAYOUT[land].length, set: this.rand() < 0.5 ? 0 : 1, by: 'train', seed: Math.floor(this.rand() * 1e6) };
  }

  /** Keeps the line laid well ahead, each stretch the one its junction is set for. */
  private extend() {
    while (this.legs[this.legs.length - 1].end < this.s + 6000) {
      const last = this.legs[this.legs.length - 1];
      this.legs.push(this.leg(BRANCHES[last.land][last.set], last.end));
    }
    // Forget stretches well behind us.
    while (this.cur > 2) {
      this.legs.shift();
      this.cur--;
    }
  }

  current(): Leg {
    return this.legs[this.cur];
  }

  /** The stretch beyond the next junction, as the junction is set now. */
  ahead(): Leg {
    return this.legs[this.cur + 1];
  }

  /** The stretch the line is on at u, if it's been laid. */
  legAt(u: number): Leg | undefined {
    for (const l of this.legs) if (u >= l.start && u < l.end) return l;
    return undefined;
  }

  /** The stretches shaping the land at u, and how much each does: one, or two where one turns into the next. */
  weights(u: number): { leg: Leg; w: number }[] {
    const i = this.legs.findIndex((l) => u >= l.start && u < l.end);
    if (i < 0) return [{ leg: u < this.legs[0].start ? this.legs[0] : this.legs[this.legs.length - 1], w: 1 }];
    const l = this.legs[i];
    if (i > 0 && u < l.start + BLEND) {
      const k = smooth((u - (l.start - BLEND)) / (2 * BLEND));
      return [
        { leg: this.legs[i - 1], w: 1 - k },
        { leg: l, w: k },
      ];
    }
    if (i < this.legs.length - 1 && u > l.end - BLEND) {
      const k = smooth((u - (l.end - BLEND)) / (2 * BLEND));
      return [
        { leg: l, w: 1 - k },
        { leg: this.legs[i + 1], w: k },
      ];
    }
    return [{ leg: l, w: 1 }];
  }

  /** The junction at the end of this stretch: where it can send us, which way it's set, and whether the lever can change it. */
  junction() {
    const l = this.current();
    const left = l.end - this.s;
    return { at: l.end, from: l.land, to: BRANCHES[l.land], set: l.set, by: l.by, live: left <= LEVER_LIT && left > LEVER_LOCK, left };
  }

  /** Throws the lever: the junction ahead is set for its other branch, and the line beyond is laid again. False if it can't be thrown now. */
  pull(): boolean {
    const j = this.junction();
    if (!j.live) return false;
    const l = this.current();
    l.set = l.set ? 0 : 1;
    l.by = 'you';
    this.legs.length = this.cur + 1;
    this.extend();
    this.revision++;
    this.changedFrom = l.end - BLEND;
    return true;
  }

  /** The next station on this stretch, if we haven't stopped there yet. */
  station() {
    const l = this.current();
    const st = LAYOUT[l.land].station;
    if (!st) return null;
    const at = l.start + st.at;
    return at > this.s - 1 && at !== this.served ? { at, name: st.name, land: l.land } : null;
  }

  /** The speed limit here: the lower of this stretch's and the next one's, near the points. */
  limit(): number {
    const l = this.current();
    const here = LAYOUT[l.land].limit;
    const next = this.ahead();
    return next && l.end - this.s < 400 ? Math.min(here, LAYOUT[next.land].limit) : here;
  }

  /** Pulls the emergency brake. False if we're already stopped or stopping for it. */
  brake(): boolean {
    if (this.phase === 'braking' || this.phase === 'still' || this.phase === 'easing' || this.phase === 'dwell' || this.v < 0.5) return false;
    this.phase = 'braking';
    this.held = 0;
    return true;
  }

  /** Moves the train on by dt seconds; returns what happened on the way. */
  step(dt: number): TrainEvent[] {
    const out: TrainEvent[] = [];
    this.held += dt;
    let accel = 0;
    const station = this.station();
    if (this.phase === 'braking') {
      accel = -EMERGENCY;
      if (this.v + accel * dt <= 0) {
        this.v = 0;
        accel = 0;
        this.phase = 'still';
        this.held = 0;
        out.push({ kind: 'stopped' });
      }
    } else if (this.phase === 'still') {
      if (this.held > STILL) {
        this.phase = 'easing';
        this.held = 0;
        out.push({ kind: 'release' });
      }
    } else if (this.phase === 'easing') {
      if (this.held > EASE) {
        this.phase = 'running';
        this.held = 0;
        out.push({ kind: 'away' });
      }
    } else if (this.phase === 'dwell') {
      if (this.held > DWELL) {
        this.phase = 'running';
        this.held = 0;
        out.push({ kind: 'depart', name: this.stop?.name ?? '' });
        this.stop = null;
      }
    } else {
      // Running, or drawing into a station: brake just hard enough to stop at the platform.
      const d = station ? station.at - this.s : Infinity;
      const need = d > 0.05 ? (this.v * this.v) / (2 * d) : Infinity;
      if (station && (this.phase === 'stopping' || need > 0.5)) {
        this.phase = 'stopping';
        accel = -Math.min(1.4, need);
        if (d < 0.4 || this.v + accel * dt <= 0.02) {
          this.s = Math.max(this.s, station.at - 0.01);
          this.v = 0;
          accel = 0;
          this.phase = 'dwell';
          this.held = 0;
          this.served = station.at;
          this.stop = station;
          out.push({ kind: 'arrive', name: station.name, land: station.land });
        }
      } else {
        this.phase = 'running';
        const limit = this.limit();
        accel = this.v < limit ? Math.min(PULL_AWAY, (limit - this.v) * 0.6 + 0.05) : -Math.min(SLOW, (this.v - limit) * 0.6 + 0.05);
      }
    }
    this.v = Math.max(0, this.v + accel * dt);
    this.s += this.v * dt;

    // The lever: it lights as the junction comes up, and locks before the points.
    const j = this.junction();
    if (j.live && !this.lit) {
      this.lit = true;
      out.push({ kind: 'lit', leg: this.current() });
    }
    if (j.left <= LEVER_LOCK && !this.locked) {
      this.locked = true;
      out.push({ kind: 'locked', leg: this.current() });
    }
    // Over the points and on to the next stretch.
    while (this.s >= this.current().end) {
      const from = this.current();
      this.cur++;
      this.lit = false;
      this.locked = false;
      this.extend();
      out.push({ kind: 'points', from, to: this.current() });
    }
    return out;
  }
}
