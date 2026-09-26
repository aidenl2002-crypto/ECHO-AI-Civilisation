// simManager.ts: SimulationEngine singleton + autosave + ECHO BRAIN wiring.
// Deterministic sim owns reality; the brain returns DECISION INTENT only via
// CognitionScheduler.onApply -> applyCognitionOutcome (whitelisted mutations).
import { SimulationEngine } from "@echo/simulation-core";
import {
  OpenCodeCognitionProvider, RoleRouter, CognitionScheduler,
  ensureMind, addMemory, applyEmotionDelta, attentionScore, attentionClass, bumpVersion, buildEnvelope,
  type CognitionOutcome, type ModelRole,
} from "@echo/ai";
import { AIProvider } from "@echo/ai";
import { saveSlot, logThought, recordMetric } from "./db.js";

const seed = Number(process.env.WORLD_SEED ?? 1337);
const city = process.env.CITY_NAME ?? "Echo City";
export const engine = new SimulationEngine(Number.isFinite(seed) ? seed : 1337, city, 40);

// Legacy local-LLM provider (kept for compat; OpenCode CLI is the primary gateway).
export const ai = new AIProvider({
  baseUrl: process.env.LOCAL_AI_BASE_URL ?? "http://localhost:1234/v1",
  model: process.env.LOCAL_AI_MODEL ?? "local-model",
  enabled: (process.env.LOCAL_AI_ENABLED ?? "false") === "true",
  maxConcurrent: 4,
});

// ---- ECHO BRAIN ----
export const brainProvider = new OpenCodeCognitionProvider();
export const roleRouter = new RoleRouter();
try { roleRouter.loadFile("packages/ai/roles.json"); } catch { /* defaults */ }

export const aiConfig = {
  intensity: Number(process.env.AI_INTENSITY ?? 0.5), // god/AI intensity 0..1
  thresholds: { c1: 0.08, c2: 0.25, c3: 0.45, c4: 0.65, c5: 0.85 },
  cooldownMs: Number(process.env.AI_COOLDOWN_MS ?? 30000),
  narrativeEnabled: (process.env.AI_NARRATIVE ?? "true") === "true",
  backgroundEnabled: (process.env.AI_BACKGROUND ?? "true") === "true",
  serviceMode: (process.env.OPENCODE_STANDALONE ?? "false") !== "true" ? "persistent-service" as const : "standalone" as const,
};

export const scheduler = new CognitionScheduler(
  async (prompt, o) => {
    const r = await brainProvider.chat(prompt, o);
    return r ? { text: r.text, model: r.model, durationMs: r.durationMs } : null;
  },
  (role: ModelRole) => roleRouter.get(role),
);
scheduler.setConcurrency(Number(process.env.OPENCODE_CONCURRENCY ?? 3));

/** Whitelisted application of a validated cognition outcome. Sim owns reality. */
export function applyCognitionOutcome(o: CognitionOutcome): { applied: boolean; errors: string[] } {
  const c = engine.state.citizens[o.req.citizenId];
  if (!c || !c.alive) return { applied: false, errors: ["citizen dead or missing"] };
  const m = ensureMind(c);
  const r = o.response;
  // memory candidate always recorded (grounded: tagged with trigger)
  if (r.memoryCandidate) {
    addMemory(c.id, { kind: "episodic", text: r.memoryCandidate.slice(0, 280), tags: ["cognition", o.req.type], entities: r.targetId ? [r.targetId] : [], importance: 0.5, intensity: r.intensity, relevance: 0.6, confidence: 0.7, createdTick: engine.clock.tick });
  }
  if (r.newGoalCandidate) {
    const gid = `g_${engine.clock.tick}_${c.id}`;
    engine.state.goals[gid] = { id: gid, citizenId: c.id, text: r.newGoalCandidate.slice(0, 200), priority: r.intensity, done: false, createdTick: engine.clock.tick };
    c.goalIds.push(gid);
  }
  switch (r.action) {
    case "BEGIN_JOB_SEARCH":
    case "APPLY_JOB":
    case "QUIT_JOB":
    case "SET_GOAL":
    case "PLAN_DAY":
    case "TALK_TO": case "BEFRIEND": case "HELP": case "AVOID": case "CONFRONT_PERSON": case "SHARE_GOSSIP":
      engine.state.memories.push({ id: `m_${engine.clock.tick}_${c.id}`, citizenId: c.id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.6, text: `Decided ${r.action}: ${r.reasonSummary}`, tags: ["ai"] });
      break;
    case "NONE":
      break;
    default:
      engine.state.memories.push({ id: `m_${engine.clock.tick}_${c.id}`, citizenId: c.id, tick: engine.clock.tick, day: engine.clock.day, salience: 0.4, text: `Considered ${r.action}: ${r.reasonSummary}`, tags: ["ai"] });
  }
  m.recentThoughts.unshift(`${r.action}: ${r.reasonSummary}`);
  if (m.recentThoughts.length > 10) m.recentThoughts.pop();
  bumpVersion(c.id);
  try {
    logThought({ id: o.req.id, citizenId: o.req.citizenId, type: o.req.type, decision: r.action, reason: r.reasonSummary, result: o.fallback ? "fallback" : o.stale ? "stale" : "applied", model: o.model, latencyMs: o.latencyMs });
    recordMetric("cognition.completed", 1);
  } catch { /* telemetry best-effort */ }
  return { applied: !o.fallback && !o.stale, errors: o.errors };
}
scheduler.onApply = (o) => { applyCognitionOutcome(o); };

/** Background cognition: pick highest-attention citizens, enqueue by class. No-op when disabled. */
let lastBg = 0;
export function backgroundCognition(): void {
  if (!aiConfig.backgroundEnabled || !brainProvider.enabled) return;
  const now = Date.now();
  if (now - lastBg < 5000) return;
  lastBg = now;
  const all = Object.values(engine.state.citizens).filter((c) => c.alive);
  const scored = all.map((c, i) => ({ c, score: attentionScore(c, engine.state) * aiConfig.intensity, i }))
    .sort((a, b) => b.score - a.score).slice(0, 6);
  for (const { c, score } of scored) {
    const cls = attentionClass(score);
    if (cls === "C0") continue;
    const type = cls === "C1" ? "reflex" : cls === "C2" ? "social" : cls === "C3" ? "planning" : cls === "C4" ? "planning" : "narrator";
    const role: ModelRole = type === "reflex" ? "reflex" : type === "social" ? "social" : type === "planning" ? "planning" : "narrator";
    enqueueFor(c.id, type as "reflex", role, `bg ${cls} score=${score.toFixed(2)}`);
  }
}

export function enqueueFor(citizenId: string, type: "reflex" | "social" | "planning" | "business" | "government" | "dialogue" | "narrator" | "historian", role: ModelRole, reason: string): string | null {
  const c = engine.state.citizens[citizenId];
  if (!c) return null;
  ensureMind(c);
  const rels = Object.values(engine.state.relationships).filter((r) => r.aId === c.id || r.bId === c.id).slice(0, 8)
    .map((r) => ({ id: r.aId === c.id ? r.bId : r.aId, label: r.type, trust: r.trust }));
  const knownIds = [...new Set(rels.map((r) => r.id))];
  const permittedActions = ["TALK_TO", "BEFRIEND", "HELP", "AVOID", "CONFRONT_PERSON", "SHARE_GOSSIP", "BEGIN_JOB_SEARCH", "APPLY_JOB", "SET_GOAL", "PLAN_DAY", "NONE"] as const;
  const kind = type === "planning" ? "planner" : type === "reflex" ? "reflex" : "social";
  const ctx = buildEnvelope(kind, {
    citizen: c,
    personality: { extraversion: c.psychology.extraversion, ambition: c.psychology.ambition, honesty: c.psychology.honesty },
    state: { activity: c.currentActivity, mood: ensureMind(c).mood, needs: c.needs, cash: Math.round(c.financial.cash) },
    goals: c.goalIds.map((id) => engine.state.goals[id]?.text).filter((text): text is string => Boolean(text)),
    relationships: rels,
    memories: engine.state.memories.filter((m) => m.citizenId === c.id).slice(-8).map((m) => ({ id: m.id, text: m.text })),
    event: { id: `background-${engine.clock.tick}`, kind: type, summary: reason },
    permittedActions: [...permittedActions], knownIds,
  });
  return scheduler.enqueue({
    citizenId, type, priority: 0.5, expiresAt: Date.now() + 120000,
    worldTick: engine.clock.tick, citizenVersion: 0, modelRole: role,
    context: ctx, schema: "cognition-v1",
    permittedActions: [...permittedActions],
    knownIds,
    envelopeVersion: "social-decision-v3",
  });
}

let sinceSave = 0;
export function afterTicks(n: number): void {
  sinceSave += n;
  backgroundCognition();
  if (sinceSave >= 500) { sinceSave = 0; try { saveSlot("autosave", engine.save()); } catch { /* ignore */ } }
}

// Broadcast subscribers (WebSocket)
export type Listener = (msg: string) => void;
const listeners = new Set<Listener>();
export function subscribe(l: Listener): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
export function broadcast(obj: unknown): void {
  const msg = JSON.stringify(obj);
  for (const l of listeners) { try { l(msg); } catch { /* ignore */ } }
}
setInterval(() => {
  broadcast({ type: "state", snapshot: engine.snapshot() });
}, 500).unref?.();
