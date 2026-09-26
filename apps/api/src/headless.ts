// headless.ts: CLI smoke/long-run + AI stress modes.
// Usage: npm run simulation:headless -- --citizens=100 --years=5 --ai=off|normal|high
import { SimulationEngine, totalMoney } from "@echo/simulation-core";
import { OpenCodeCognitionProvider, RoleRouter, CognitionScheduler, attentionScore, lodFor, type ModelRole } from "@echo/ai";

const rawArgs = process.argv.slice(2);
const argMap = new Map<string, string>();
for (const a of rawArgs) {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) argMap.set(m[1] as string, m[2] as string);
}
const get = (k: string, d: number): number => {
  const v = argMap.get(k);
  if (v !== undefined) return Number(v);
  const i = rawArgs.indexOf(`--${k}`);
  return i >= 0 && rawArgs[i + 1] && !String(rawArgs[i + 1]).startsWith("--") ? Number(rawArgs[i + 1]) : d;
};
const ticksArg = get("ticks", 100);
const citizens = get("citizens", 40);
const years = get("years", 0);
const aiMode = String(argMap.get("ai") ?? (rawArgs.includes("--ai") ? "normal" : "off")); // off | normal | high
const totalTicks = years > 0 ? years * 365 * 288 : ticksArg;

async function main(): Promise<void> {
  const t0 = Date.now();
  const eng = new SimulationEngine(1337, "Headless", citizens);
  const m0 = totalMoney(eng.state);
  let crashes = 0;

  let aiCalls = 0; let aiFailures = 0; let aiFallback = 0; let aiStale = 0;
  let latSum = 0; let latMax = 0;
  let scheduler: CognitionScheduler | null = null;
  if (aiMode !== "off") {
    const provider = new OpenCodeCognitionProvider({ enabled: true, maxConcurrent: aiMode === "high" ? 5 : 2, timeoutMs: 90000 });
    const router = new RoleRouter();
    scheduler = new CognitionScheduler(
      async (prompt, o) => { const r = await provider.chat(prompt, o); return r ? { text: r.text, model: r.model, durationMs: r.durationMs } : null; },
      (role: ModelRole) => router.get(role),
    );
    scheduler.setConcurrency(aiMode === "high" ? 5 : 2);
    scheduler.setLoad(aiMode === "high" ? "FULL" : "BALANCED");
    scheduler.onApply = (o) => {
      aiCalls++;
      latSum += o.latencyMs; latMax = Math.max(latMax, o.latencyMs);
      if (o.fallback) aiFallback++;
      if (o.stale) aiStale++;
      if (!o.validated) aiFailures++;
    };
  }
  const aiEvery = aiMode === "high" ? 50 : 200;
  try {
    for (let i = 0; i < totalTicks; i++) {
      eng.tick();
      if (scheduler && i % aiEvery === 0) {
        const all = Object.values(eng.state.citizens).filter((c) => c.alive);
        const top = all.map((c) => ({ c, s: attentionScore(c, eng.state) })).sort((a, b) => b.s - a.s).slice(0, 3);
        for (const { c } of top) {
          scheduler.enqueue({
            citizenId: c.id, type: "social", priority: 0.5, expiresAt: Date.now() + 300000,
            worldTick: eng.clock.tick, citizenVersion: 0, modelRole: "social",
            context: `CITIZEN ${c.firstName} (${c.id}). Decide next social intent. Return ONLY JSON.`,
            schema: "cognition-v1", permittedActions: ["TALK_TO", "HELP", "AVOID", "NONE"],
            knownIds: all.slice(0, 20).map((x) => x.id), envelopeVersion: "social-decision-v3",
          });
        }
        await scheduler.pump(eng.clock.tick, () => 0);
      }
    }
    // drain remaining queue (wait for in-flight runs too)
    if (scheduler) {
      for (let d = 0; d < 400 && (scheduler.queue.length > 0 || scheduler.active > 0); d++) {
        await scheduler.pump(eng.clock.tick, () => 0);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  } catch (e) {
    crashes++;
    console.error("CRASH at tick", eng.clock.tick, e);
  }
  const m1 = totalMoney(eng.state);
  const alive = Object.values(eng.state.citizens).filter((c) => c.alive).length;
  const biz = Object.values(eng.state.buildings).filter((b) => b.workers.length > 0).length;
  const all = Object.values(eng.state.citizens);
  const lod: Record<string, number> = { LOD0: 0, LOD1: 0, LOD2: 0, LOD3: 0 };
  all.forEach((c, i) => { lod[lodFor(i, all.length) as string] = (lod[lodFor(i, all.length) as string] ?? 0) + 1; });
  console.log(JSON.stringify({
    ticks: eng.clock.tick, runtimeMs: Date.now() - t0, aiMode,
    population: `${alive}/${all.length}`,
    wealth: Math.round(alive > 0 ? Object.values(eng.state.citizens).filter((c) => c.alive).reduce((s, c) => s + c.financial.cash + c.financial.bank, 0) : 0),
    businesses: biz, events: eng.state.events.length,
    moneyDrift: Math.round((m1 - m0) * 100) / 100, crashes,
    ai: scheduler ? { calls: aiCalls, avgLatencyMs: aiCalls > 0 ? Math.round(latSum / aiCalls) : 0, maxLatencyMs: latMax, queueLeft: scheduler.queue.length, failures: aiFailures, stale: aiStale, fallback: aiFallback, ...scheduler.status() } : { calls: 0, note: "ai=off" },
    lod,
  }, null, 2));
}

void main();
