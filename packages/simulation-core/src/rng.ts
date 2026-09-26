// Seeded RNG: mulberry32 + helpers.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Rng {
  private f: () => number;
  constructor(public seed: number) { this.f = mulberry32(seed); }
  next(): number { return this.f(); }
  range(lo: number, hi: number): number { return lo + this.f() * (hi - lo); }
  int(lo: number, hi: number): number { return Math.floor(this.range(lo, hi + 1)); } // inclusive
  pick<T>(arr: T[]): T { return arr[Math.floor(this.f() * arr.length)]; }
  uuid(prefix = "id"): string {
    const h = () => Math.floor(this.f() * 0xffffffff).toString(16).padStart(8, "0");
    return `${prefix}_${h().slice(0, 8)}`;
  }
}
export const randRange = (rng: () => number, lo: number, hi: number): number => lo + rng() * (hi - lo);
