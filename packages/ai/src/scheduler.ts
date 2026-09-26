// scheduler.ts: async worker pool (2-6) + priority queue + staleness/version check +
// 1 repair retry + circuit breaker + per-role fallback chain + load shedding + telemetry.
// AI returns DECISION INTENT only; validated intents flow to onApply for the sim to apply.
import type { ModelRole } from "./roles.js";
import { deterministicFallback, extractJson, validateResponse, type CognitionAction, type CognitionResponse } from "./envelope.js";

export type LoadLevel = "FULL" | "BALANCED" | "LIGHT" | "EMERGENCY";
export type RequestType = "reflex" | "social" | "planning" | "business" | "government" | "dialogue" | "narrator" | "historian";

export interface CognitionRequest {
  id: string; citizenId: string; type: RequestType; priority: number;
  createdAt: number; expiresAt: number; worldTick: number; citizenVersion: number;
  modelRole: ModelRole; context: string; schema: string;
  permittedActions: CognitionAction[]; knownIds: string[];
  envelopeVersion: string; attempt?: number;
}

export interface CognitionOutcome {
  req: CognitionRequest;
  response: CognitionResponse;
  model: string; latencyMs: number; retries: number;
  validated: boolean; fallback: boolean; stale: boolean;
  errors: string[];
}

export interface BrainTelemetry {
  queued: number; active: number;
  completed: number; parseFail: number; timeouts: number; retries: number;
  staleDropped: number; fallbackUsed: number;
  latencies: number[];
  byCategory: Record<string, number>;
  circuitOpen: boolean; loadLevel: LoadLevel;
  lastLatencyMs: number | null;
}

export type ChatFn = (prompt: string, o: { model?: string; agent?: string; timeoutMs?: number }) => Promise<{ text: string; model: string; durationMs: number } | null>;
export type ApplyFn = (o: CognitionOutcome) => void | Promise<void>;

const LOAD_BUDGET: Record<LoadLevel, { maxQueue: number; allowTypes: RequestType[] }> = {
  FULL: { maxQueue: 200, allowTypes: ["reflex", "social", "planning", "business", "government", "dialogue", "narrator", "historian"] },
  BALANCED: { maxQueue: 100, allowTypes: ["reflex", "social", "planning", "business", "government", "dialogue"] },
  LIGHT: { maxQueue: 40, allowTypes: ["reflex", "social", "planning"] },
  EMERGENCY: { maxQueue: 10, allowTypes: ["reflex"] },
};

export class CognitionScheduler {
  queue: CognitionRequest[] = [];
  active = 0;
  concurrency = 3;
  loadLevel: LoadLevel = "FULL";
  onApply: ApplyFn | null = null;
  chat: ChatFn;
  roleModel: (role: ModelRole) => { model: string; agent: string; timeoutMs: number; fallbackModels: string[]; enabled: boolean };
  feed: Array<{ id: string; citizenId: string; type: string; inputSummary: string; decision: string; reason: string; result: string; at: number; latencyMs: number }> = [];
  telemetry: BrainTelemetry = { queued: 0, active: 0, completed: 0, parseFail: 0, timeouts: 0, retries: 0, staleDropped: 0, fallbackUsed: 0, latencies: [], byCategory: {}, circuitOpen: false, loadLevel: "FULL", lastLatencyMs: null };
  private failTimes: number[] = [];
  private circuitUntil = 0;
  private seq = 0;

  constructor(chat: ChatFn, roleModel: CognitionScheduler["roleModel"]) { this.chat = chat; this.roleModel = roleModel; }

  setConcurrency(n: number): void { this.concurrency = Math.max(2, Math.min(6, n)); }
  setLoad(level: LoadLevel): void { this.loadLevel = level; this.telemetry.loadLevel = level; }

  private circuitCheck(now: number): boolean {
    if (now < this.circuitUntil) { this.telemetry.circuitOpen = true; return true; }
    this.failTimes = this.failTimes.filter((t) => now - t < 120000);
    if (this.failTimes.length >= 10) { this.circuitUntil = now + 60000; this.telemetry.circuitOpen = true; return true; }
    this.telemetry.circuitOpen = false;
    return false;
  }
  private recordFail(now: number): void { this.failTimes.push(now); }

  /** Enqueue with dedup (citizenId+type) and load-shedding. Returns id or null if shed. */
  enqueue(r: Omit<CognitionRequest, "id" | "createdAt" | "attempt"> & { id?: string }): string | null {
    const budget = LOAD_BUDGET[this.loadLevel];
    if (!budget.allowTypes.includes(r.type)) return null;
    if (this.queue.length >= budget.maxQueue) return null;
    const dup = this.queue.find((q) => q.citizenId === r.citizenId && q.type === r.type);
    if (dup) { if (r.priority > dup.priority) dup.priority = r.priority; return dup.id; }
    const id = r.id ?? `cog_${Date.now()}_${this.seq++}`;
    this.queue.push({ ...r, id, createdAt: Date.now(), attempt: 0 });
    this.queue.sort((a, b) => b.priority - a.priority);
    this.telemetry.queued = this.queue.length;
    void this.pump();
    return id;
  }

  /** Staleness/version check + dispatch loop. currentTick/currentVersion supplied by sim. */
  async pump(currentTick?: number, currentVersionOf?: (citizenId: string) => number): Promise<void> {
    if (this.active >= this.concurrency) return;
    const now = Date.now();
    if (this.circuitCheck(now)) { this.shedToFallback("circuit open"); return; }
    const req = this.queue.shift();
    if (!req) { this.telemetry.queued = 0; return; }
    this.telemetry.queued = this.queue.length;
    // staleness: expired or world moved on (>500 ticks) or citizen changed version
    const stale = now > req.expiresAt
      || (currentTick !== undefined && currentTick - req.worldTick > 500)
      || (currentVersionOf !== undefined && currentVersionOf(req.citizenId) !== req.citizenVersion);
    if (stale) {
      this.telemetry.staleDropped++;
      const o: CognitionOutcome = { req, response: deterministicFallback("stale request dropped"), model: "none", latencyMs: 0, retries: 0, validated: false, fallback: true, stale: true, errors: ["stale"] };
      await this.finish(o);
      void this.pump(currentTick, currentVersionOf);
      return;
    }
    this.active++;
    this.telemetry.active = this.active;
    const role = this.roleModel(req.modelRole);
    const t0 = Date.now();
    let lastErrors: string[] = [];
    let outcome: CognitionOutcome | null = null;
    if (!role.enabled) {
      outcome = { req, response: deterministicFallback("role disabled"), model: "none", latencyMs: 0, retries: 0, validated: false, fallback: true, stale: false, errors: ["role disabled"] };
      this.telemetry.fallbackUsed++;
    } else {
      const models = [role.model, ...role.fallbackModels];
      for (let mi = 0; mi < models.length && !outcome; mi++) {
        const model = models[mi] as string;
        for (let attempt = 0; attempt <= 1 && !outcome; attempt++) {
          const prompt = attempt === 0 ? req.context : `${req.context}\nREPAIR: last output invalid (${lastErrors.join("; ")}). Return ONLY corrected JSON.`;
          if (attempt === 1) this.telemetry.retries++;
          const res = await this.chat(prompt, { model, agent: role.agent, timeoutMs: role.timeoutMs });
          if (!res) { this.telemetry.timeouts++; lastErrors = [`no response from ${model}`]; continue; }
          const parsed = extractJson(res.text);
          if (!parsed) { this.telemetry.parseFail++; lastErrors = [`unparseable output from ${model}`]; continue; }
          const v = validateResponse(parsed, req.permittedActions, req.knownIds);
          if (!v.ok || !v.value) { this.telemetry.parseFail++; lastErrors = v.errors; continue; }
          outcome = { req, response: v.value, model, latencyMs: Date.now() - t0, retries: attempt + mi, validated: true, fallback: mi > 0, stale: false, errors: [] };
          if (mi > 0) this.telemetry.fallbackUsed++;
        }
      }
    }
    if (!outcome) {
      this.recordFail(Date.now());
      outcome = { req, response: deterministicFallback(lastErrors[0] ?? "all models failed"), model: "none", latencyMs: Date.now() - t0, retries: 1, validated: false, fallback: true, stale: false, errors: lastErrors };
      this.telemetry.fallbackUsed++;
    }
    await this.finish(outcome);
    this.active--;
    this.telemetry.active = this.active;
    void this.pump(currentTick, currentVersionOf);
  }

  private async finish(o: CognitionOutcome): Promise<void> {
    this.telemetry.completed++;
    this.telemetry.latencies.push(o.latencyMs);
    if (this.telemetry.latencies.length > 500) this.telemetry.latencies.shift();
    this.telemetry.lastLatencyMs = o.latencyMs;
    this.telemetry.byCategory[o.req.type] = (this.telemetry.byCategory[o.req.type] ?? 0) + 1;
    this.feed.unshift({ id: o.req.id, citizenId: o.req.citizenId, type: o.req.type, inputSummary: o.req.context.slice(0, 160), decision: o.response.action, reason: o.response.reasonSummary, result: o.fallback ? "fallback" : o.stale ? "stale" : "applied", at: Date.now(), latencyMs: o.latencyMs });
    if (this.feed.length > 100) this.feed.pop();
    if (this.onApply) await this.onApply(o);
  }

  private shedToFallback(why: string): void {
    // circuit open: drain reflex only via fallback, drop the rest
    while (this.queue.length > 0) {
      const req = this.queue.shift() as CognitionRequest;
      const o: CognitionOutcome = { req, response: deterministicFallback(why), model: "none", latencyMs: 0, retries: 0, validated: false, fallback: true, stale: false, errors: [why] };
      this.telemetry.fallbackUsed++;
      void this.finish(o);
    }
    this.telemetry.queued = 0;
  }

  percentile(p: number): number {
    const a = [...this.telemetry.latencies].sort((x, y) => x - y);
    if (a.length === 0) return 0;
    return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
  }
  status(): Record<string, unknown> {
    const t = this.telemetry;
    const total = t.completed || 1;
    return {
      queue: this.queue.length, activeRuns: this.active, concurrency: this.concurrency,
      latencyP50: this.percentile(50), latencyP95: this.percentile(95), lastLatencyMs: t.lastLatencyMs,
      successRate: (t.completed - t.fallbackUsed) / total, parseFail: t.parseFail, timeouts: t.timeouts,
      retries: t.retries, staleDropped: t.staleDropped, fallbackUsed: t.fallbackUsed,
      byCategory: t.byCategory, circuitOpen: t.circuitOpen, loadLevel: this.loadLevel,
    };
  }
}
