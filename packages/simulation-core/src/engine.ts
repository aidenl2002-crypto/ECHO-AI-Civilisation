// engine.ts: SimulationEngine — deterministic tick order. LLM never blocks: cognition via drain/apply.
import { SimCommand, SimEvent, SimEventType, validateSimCommand } from "@echo/shared";
import { SimClock } from "./clock.js";
import { Rng, mulberry32 } from "./rng.js";
import { WorldMetrics, WorldState, createWorld, totalMoney } from "./world.js";
import { updateNeeds } from "./systems/needs.js";
import { moveTowards } from "./systems/movement.js";
import { schedule } from "./systems/scheduler.js";
import { economyTick } from "./systems/economy.js";
import { socialTick } from "./systems/social.js";
import { lifeTick } from "./systems/life.js";

export interface CognitionCandidate { citizenId: string; reason: string; tier: 2 | 3; }
export interface EngineSnapshot { tick: number; day: number; hour: number; population: number; events: number; }

export class SimulationEngine {
  state: WorldState;
  clock: SimClock;
  speed = 1;
  paused = false;
  rng: Rng;
  private rngFn: () => number;

  constructor(seed = 1337, cityName = "Echo City", citizens = 40) {
    this.state = createWorld(seed, cityName, citizens);
    this.clock = new SimClock(0);
    this.rng = new Rng(seed ^ 0x9e3779b9);
    this.rngFn = mulberry32(seed ^ 0x51ed);
  }

  private emit(type: SimEventType, summary: string, actorIds: string[], data: Record<string, unknown> = {}, buildingId?: string): void {
    const tick = this.clock.tick;
    this.state.eventSeq++;
    const e: SimEvent = {
      id: `e_${this.state.eventSeq}`, type, tick, timestamp: Date.now(),
      day: this.clock.day, actorIds, buildingId, summary, data,
    };
    this.state.events.push(e);
    if (this.state.events.length > 5000) this.state.events.splice(0, this.state.events.length - 5000);
  }

  /** Advance one tick (5 sim-minutes) through all systems in fixed order. */
  tick(): void {
    if (this.paused) return;
    const tick = this.clock.tick;
    const hour = this.clock.hour;
    const day = this.clock.day;
    schedule(this.state, tick, hour);
    for (const c of Object.values(this.state.citizens)) {
      if (!c.alive) continue;
      updateNeeds(c);
      if (c.destinationBuildingId) {
        const atDest = this.state.buildings[c.destinationBuildingId];
        if (atDest && Math.hypot(c.position.x - atDest.position.x, c.position.y - atDest.position.y) < 1) {
          c.destinationBuildingId = null;
        } else moveTowards(this.state, c.id);
      }
    }
    economyTick(this.state, tick, day, hour, (t, s, a, d, b) => this.emit(t as SimEventType, s, a, d, b));
    socialTick(this.state, tick, this.rngFn, (type, summary, actors, data) => this.emit(type, summary, actors, data));
    lifeTick(this.state, tick, day, this.rngFn, (t, s, a, d) => this.emit(t as SimEventType, s, a, d));
    // daily metrics snapshot at midnight
    if (tick % 288 === 0 && tick > 0) this.recordMetrics();
    this.clock.advance(1);
  }

  recordMetrics(): void {
    const alive = Object.values(this.state.citizens).filter((c) => c.alive);
    const n = Math.max(1, alive.length);
    const m: WorldMetrics = {
      day: this.clock.day, population: alive.length,
      totalWealth: alive.reduce((s, c) => s + c.financial.cash + c.financial.bank, 0),
      businesses: Object.values(this.state.buildings).filter((b) => b.workers.length > 0).length,
      avgHappiness: alive.reduce((s, c) => s + c.needs.happiness, 0) / n,
      avgHealth: alive.reduce((s, c) => s + c.needs.health, 0) / n,
      employmentRate: alive.filter((c) => c.jobId).length / n,
      moneySupply: totalMoney(this.state),
    };
    this.state.metricsHistory.push(m);
  }

  /** Non-blocking cognition: returns Tier2/3 candidates (high-salience citizens). AI applied later via applyAIDecision. */
  drainCognitionEvents(max = 8): CognitionCandidate[] {
    const out: CognitionCandidate[] = [];
    for (const c of Object.values(this.state.citizens)) {
      if (!c.alive) continue;
      if (c.needs.hunger < 20 || c.emotions.stress > 0.8 || c.needs.happiness < 20) {
        out.push({ citizenId: c.id, reason: `salience: hunger=${c.needs.hunger.toFixed(0)} stress=${c.emotions.stress.toFixed(2)}`, tier: 2 });
      } else if (c.psychology.ambition > 0.85 && out.length < max) {
        out.push({ citizenId: c.id, reason: "ambitious citizen seeks goal", tier: 3 });
      }
      if (out.length >= max) break;
    }
    return out;
  }

  /** Apply a validated AI decision to the world. Returns applied:boolean + reason. */
  applyAIDecision(citizenId: string, cmd: unknown): { applied: boolean; errors: string[] } {
    const v = validateSimCommand(cmd);
    if (!v.ok || !v.value) return { applied: false, errors: v.errors };
    const c = this.state.citizens[citizenId];
    if (!c || !c.alive) return { applied: false, errors: ["citizen dead or missing"] };
    const cmdv: SimCommand = v.value;
    const tick = this.clock.tick;
    // append memory of intervention
    this.state.memories.push({ id: `m_${tick}_${citizenId}`, citizenId, tick, day: this.clock.day, salience: 0.7, text: `AI decision ${cmdv.action}: ${cmdv.reason}`, tags: ["ai"] });
    switch (cmdv.action) {
      case "POST_ECHONET":
        this.state.posts.push({ id: `p_${tick}_${citizenId}`, authorId: citizenId, text: String(cmdv.text ?? "").slice(0, 280), tick, day: this.clock.day, likes: 0 });
        break;
      case "CHANGE_GOAL": {
        const gid = `g_${tick}_${citizenId}`;
        this.state.goals[gid] = { id: gid, citizenId, text: String(cmdv.text ?? "").slice(0, 200), priority: cmdv.confidence, done: false, createdTick: tick };
        c.goalIds.push(gid);
        break;
      }
      case "CONFRONT_PERSON":
      case "VOTE":
      case "BUY":
      case "NONE":
        this.emit("GodIntervention", `AI ${cmdv.action} for ${c.firstName}: ${cmdv.reason}`, [citizenId], { action: cmdv.action, target: cmdv.targetCitizenId ?? null });
        break;
    }
    return { applied: true, errors: [] };
  }

  snapshot(): EngineSnapshot {
    return { tick: this.clock.tick, day: this.clock.day, hour: this.clock.hour, population: Object.values(this.state.citizens).filter((c) => c.alive).length, events: this.state.events.length };
  }

  save(): string { return JSON.stringify({ tick: this.clock.tick, state: this.state }); }
  load(json: string): void {
    const o = JSON.parse(json) as { tick: number; state: WorldState };
    this.state = o.state; this.clock = new SimClock(o.tick);
  }
}
