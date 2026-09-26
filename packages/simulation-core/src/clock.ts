// SimClock: 1 tick = 5 sim-minutes. 288 ticks/day.
export const TICKS_PER_HOUR = 12;
export const TICKS_PER_DAY = 288;
export class SimClock {
  tick = 0;
  constructor(tick = 0) { this.tick = tick; }
  advance(n = 1): void { this.tick += n; }
  get minuteOfDay(): number { return (this.tick % TICKS_PER_DAY) * 5; }
  get hour(): number { return Math.floor(this.minuteOfDay / 60); }
  get day(): number { return Math.floor(this.tick / TICKS_PER_DAY) + 1; }
  get week(): number { return Math.floor((this.day - 1) / 7) + 1; }
  get month(): number { return Math.floor((this.day - 1) / 30) + 1; }
  get year(): number { return Math.floor((this.day - 1) / 365) + 1; }
  get season(): string { const m = ((this.month - 1) % 12); return m < 3 ? "spring" : m < 6 ? "summer" : m < 9 ? "autumn" : "winter"; }
  serialize(): number { return this.tick; }
  static deserialize(t: number): SimClock { return new SimClock(t); }
}
