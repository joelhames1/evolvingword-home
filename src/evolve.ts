// The billboard across the street evolves words, the way Richard Dawkins'
// "weasel program" (The Blind Watchmaker, 1986) showed evolution by selection:
// copy the phrase many times with random mistakes, keep the copy closest to
// the target, repeat. Random letters become words in a few dozen generations.

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789!&'";
/** The longest phrase the billboard can show and still be read from across the street. */
export const MAX_PHRASE = 16;

/** What someone typed, reduced to what the billboard can breed: capitals, digits, a little punctuation. */
export function clean(text: string): string {
  const up = text
    .toUpperCase()
    .replace(/[‘’]/g, "'")
    .split('')
    .filter((ch) => ALPHABET.includes(ch))
    .join('')
    .replace(/ +/g, ' ')
    .trim();
  return up.slice(0, MAX_PHRASE).trim();
}

export interface Generation {
  text: string;
  target: string;
  generation: number;
  /** 0..1: share of letters already right. */
  fitness: number;
  done: boolean;
}

export class Evolver {
  private text = '';
  private target = '';
  private gen = 0;

  constructor(
    private rand: () => number = Math.random,
    private offspring = 40,
    private mutation = 0.045,
  ) {}

  private letter() {
    return ALPHABET[Math.floor(this.rand() * ALPHABET.length)];
  }

  /** Aims at a new phrase, starting from whatever is showing now (or noise). */
  aim(target: string) {
    this.target = target.toUpperCase();
    const from = this.text || '';
    let next = '';
    for (let i = 0; i < this.target.length; i++) next += from[i] ?? this.letter();
    this.text = next;
    this.gen = 0;
  }

  /** Scrambles the current text completely: the very first phrase starts from noise. */
  scramble() {
    this.text = Array.from(this.target, () => this.letter()).join('');
  }

  private score(s: string) {
    let n = 0;
    for (let i = 0; i < s.length; i++) if (s[i] === this.target[i]) n++;
    return n;
  }

  step(): Generation {
    if (this.text !== this.target) {
      let best = this.text;
      let bestScore = -1;
      for (let k = 0; k < this.offspring; k++) {
        let child = '';
        for (const ch of this.text) child += this.rand() < this.mutation ? this.letter() : ch;
        const s = this.score(child);
        if (s > bestScore) {
          best = child;
          bestScore = s;
        }
      }
      this.text = best;
      this.gen++;
    }
    return this.state();
  }

  state(): Generation {
    const fitness = this.target.length ? this.score(this.text) / this.target.length : 1;
    return { text: this.text, target: this.target, generation: this.gen, fitness, done: this.text === this.target };
  }
}
