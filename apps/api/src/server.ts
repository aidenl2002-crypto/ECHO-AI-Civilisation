// server.ts: express + ws on PORT. All endpoints functional.
import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { engine, ai, afterTicks, subscribe, brainProvider, roleRouter, scheduler, aiConfig, enqueueFor, applyCognitionOutcome } from "./simManager.js";
import { loadSlot, saveSlot, listSlots, getThoughtFeed, loadAllRoleConfigs, saveRoleConfig, listBenchmarks, logBenchmark, dbSizeBytes } from "./db.js";
import { buildCitizenContext, answerHistory, generateEchoTimes, requestDecision } from "@echo/ai";
import { buildEnvelope, validateDialogue, buildDialoguePrompt, extractJson, deterministicFallback, ENVELOPE_VERSIONS, type CognitionAction } from "@echo/ai";
import { ensureMind, retrieveMemories, attentionScore, attentionClass, lodFor, getMind } from "@echo/ai";
import type { ModelRole } from "@echo/ai";
import { totalMoney } from "@echo/simulation-core";
import { adminAuth, registerAdminRoutes, requirePerm } from "./admin.js";

const PORT = Number(process.env.PORT ?? 4000);
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// background ticker
let ticksPerSec = 2;
setInterval(() => { if (!engine.paused) { for (let i = 0; i < engine.speed * ticksPerSec; i++) engine.tick(); afterTicks(engine.speed * ticksPerSec); } }, 1000).unref?.();

app.get("/api/state", (_req, res) => {
  const snap = engine.snapshot();
  res.json({
    clock: { year: engine.clock.year, day: engine.clock.day, hour: engine.clock.hour, season: engine.clock.season, totalHours: engine.clock.tick / 12 },
    speed: engine.speed, paused: engine.paused,
    counts: { population: snap.population, events: snap.events, buildings: Object.keys(engine.state.buildings).length },
    cityName: engine.state.cityName, seed: String(engine.state.seed),
    snapshot: snap, government: engine.state.government, metrics: engine.state.metricsHistory.slice(-30),
  });
});
app.get("/api/citizens", (_req, res) => {
  res.json(Object.values(engine.state.citizens).map((c) => ({
    id: c.id, name: `${c.firstName} ${c.lastName}`, age: c.age,
    job: c.jobId ? engine.state.jobs[c.jobId]?.title ?? "Working" : "Unemployed",
    wealth: c.financial.cash + c.financial.bank, x: c.position.x, y: c.position.y,
    health: c.needs.health, mood: Math.round(c.needs.happiness),
    alive: c.alive, activity: c.currentActivity,
  })));
});
app.get("/api/citizens/:id", (req, res) => {
  const c = engine.state.citizens[req.params.id];
  if (!c) { res.status(404).json({ error: "not found" }); return; }
  const rels = Object.values(engine.state.relationships ?? {}).filter((r: { aId: string; bId: string }) => r.aId === c.id || r.bId === c.id).slice(0, 10)
    .map((r: { aId: string; bId: string; trust?: number }) => {
      const oid = r.aId === c.id ? r.bId : r.aId;
      const o = engine.state.citizens[oid];
      return { id: oid, name: o ? `${o.firstName} ${o.lastName}` : oid, score: Math.round(((r.trust ?? 0.5) as number) * 100) };
    });
  const mems = engine.state.memories.filter((m) => m.citizenId === c.id).slice(-8).reverse()
    .map((m) => ({ text: m.text, day: m.day }));
  const evs = engine.state.events.filter((e) => e.actorIds.includes(c.id)).slice(-8).reverse()
    .map((e) => ({ text: e.summary, day: e.day }));
  const goals = c.goalIds.map((g) => engine.state.goals[g]?.text).filter(Boolean);
  res.json({
    id: c.id, name: `${c.firstName} ${c.lastName}`, age: c.age,
    job: c.jobId ? engine.state.jobs[c.jobId]?.title ?? "Working" : "Unemployed",
    wealth: c.financial.cash + c.financial.bank, x: c.position.x, y: c.position.y,
    health: c.needs.health, mood: Math.round(c.needs.happiness),
    home: c.homeId ? engine.state.buildings[c.homeId]?.name ?? c.homeId : "homeless",
    personality: c.psychology, skills: c.skills, relationships: rels, memories: mems,
    activity: c.currentActivity, goals, events: evs,
    employmentHistory: [], financialHistory: [{ amount: c.financial.cash, day: engine.clock.day, note: "cash" }],
    family: c.marriedToId && engine.state.citizens[c.marriedToId] ? [{ id: c.marriedToId, name: `${engine.state.citizens[c.marriedToId].firstName} ${engine.state.citizens[c.marriedToId].lastName}`, relation: "spouse" }] : [],
    posts: engine.state.posts.filter((p) => p.authorId === c.id).slice(-5).map((p) => ({ text: p.text, day: p.day })),
    raw: c,
  });
});
app.get("/api/buildings", (_req, res) => {
  res.json(Object.values(engine.state.buildings).map((b) => ({
    id: b.id, name: b.name, type: b.type, x: b.position.x, y: b.position.y,
    ownerId: b.ownerId, funds: b.economic.funds, capacity: b.capacity,
  })));
});
app.get("/api/events", (req, res) => {
  const limit = Math.min(500, Number(req.query.limit ?? 100));
  res.json(engine.state.events.slice(-limit).reverse().map((e) => ({
    id: e.id, day: e.day, hour: engine.clock.hour, tick: e.tick, type: e.type, text: e.summary, summary: e.summary,
  })));
});
app.get("/api/metrics", (_req, res) => {
  res.json(engine.state.metricsHistory.map((m, i) => ({
    day: m.day, population: m.population, wealth: m.totalWealth, gdp: m.totalWealth,
    unemployment: Math.round((1 - m.employmentRate) * 100), crime: 0,
    happiness: Math.round(m.avgHappiness), inequality: 0,
    businesses: m.businesses, avgHealth: m.avgHealth, moneySupply: m.moneySupply, _i: i,
  })));
});
app.get("/api/newspaper/:day", (req, res) => {
  const day = Number(req.params.day);
  const ed = generateEchoTimes(day, engine.state.events);
  res.json({ day: ed.day, title: "THE ECHO TIMES", headline: ed.headline, articles: ed.articles });
});
app.get("/api/echonet", (_req, res) => {
  res.json(engine.state.posts.slice(-100).reverse().map((p) => ({
    id: p.id, citizenId: p.authorId,
    citizenName: engine.state.citizens[p.authorId] ? `${engine.state.citizens[p.authorId].firstName} ${engine.state.citizens[p.authorId].lastName}` : "Unknown",
    text: p.text, day: p.day, likes: p.likes, replyToId: p.replyToId,
  })));
});
app.get("/api/ai/status", (_req, res) => { res.json(ai.status()); });
app.get("/api/timeline", (_req, res) => {
  res.json(engine.state.events.map((e) => ({ id: e.id, day: e.day, tick: e.tick, type: e.type, summary: e.summary })).slice(-500));
});

function hashSeed(s: unknown): number {
  if (Number.isFinite(Number(s))) return Number(s);
  const str = String(s ?? "echo");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

app.post("/api/world/new", (req, res) => {
  const { seed, cityName, citizens, population } = req.body as { seed?: number | string; cityName?: string; citizens?: number; population?: number };
  resetEngineTo(await_import_new(seed, cityName, citizens ?? population));
  res.json({ ok: true, seed: engine.state.seed, snapshot: engine.snapshot() });
});
// Frontend compat alias: POST /api/new {seed:string, cityName, population}
app.post("/api/new", (req, res) => {
  const { seed, cityName, citizens, population } = req.body as { seed?: number | string; cityName?: string; citizens?: number; population?: number };
  resetEngineTo(await_import_new(seed, cityName, citizens ?? population));
  res.json({ ok: true, seed: engine.state.seed, snapshot: engine.snapshot() });
});
// helper (sync): rebuild world in place
import { createWorld, SimClock, Rng, mulberry32 } from "@echo/simulation-core";
function await_import_new(seed?: number | string, cityName?: string, citizens?: number): typeof engine.state {
  const s = hashSeed(seed ?? Math.floor(Math.random() * 1e9));
  return createWorld(s, String(cityName ?? "Echo City"), Math.min(200, Math.max(5, Number(citizens ?? 40))));
}
function resetEngineTo(state: typeof engine.state): void {
  engine.state = state;
  engine.clock = new SimClock(0);
  engine.rng = new Rng(state.seed ^ 0x9e3779b9);
  (engine as unknown as { rngFn: () => number }).rngFn = mulberry32(state.seed ^ 0x51ed);
  engine.paused = false;
}

app.post("/api/save", (req, res) => {
  const slot = String((req.body as { slot?: string }).slot ?? "manual");
  saveSlot(slot, engine.save());
  res.json({ ok: true, slot });
});
app.post("/api/load", (req, res) => {
  const slot = String((req.body as { slot?: string }).slot ?? "manual");
  const data = loadSlot(slot);
  if (!data) { res.status(404).json({ error: "slot not found", slots: listSlots() }); return; }
  engine.load(data);
  res.json({ ok: true, snapshot: engine.snapshot() });
});
app.get("/api/slots", (_req, res) => { res.json(listSlots()); });
app.post("/api/tick", (req, res) => {
  const n = Math.min(1000, Math.max(1, Number((req.body as { n?: number }).n ?? 1)));
  for (let i = 0; i < n; i++) engine.tick();
  afterTicks(n);
  res.json({ ok: true, snapshot: engine.snapshot() });
});
app.post("/api/step", (_req, res) => {
  engine.paused = false;
  engine.tick(); afterTicks(1);
  engine.paused = true;
  res.json({ ok: true, snapshot: engine.snapshot() });
});
app.get("/api/debug", (_req, res) => {
  res.json({
    tick: engine.clock.tick, day: engine.clock.day, hour: engine.clock.hour,
    speed: engine.speed, paused: engine.paused,
    citizens: Object.keys(engine.state.citizens).length,
    businesses: Object.values(engine.state.buildings).filter((b) => b.workers.length > 0).length,
    events: engine.state.events.length, posts: engine.state.posts.length,
    moneySupply: totalMoney(engine.state),
    ai: ai.status(),
  });
});
app.post("/api/echonet", (req, res) => {
  const { citizenId, text } = req.body as { citizenId?: string | null; text?: string };
  const clean = String(text ?? "").slice(0, 280);
  if (!clean) { res.status(400).json({ error: "empty post" }); return; }
  const authorId = citizenId && engine.state.citizens[citizenId] ? citizenId : Object.keys(engine.state.citizens)[0];
  const p = { id: `p_${Date.now()}`, authorId, text: clean, tick: engine.clock.tick, day: engine.clock.day, likes: 0 };
  engine.state.posts.push(p);
  res.json({ id: p.id, citizenId: authorId, citizenName: engine.state.citizens[authorId] ? `${engine.state.citizens[authorId].firstName}` : "?", text: clean, day: p.day, likes: 0 });
});
app.post("/api/speed", (req, res) => {
  engine.speed = Math.min(100, Math.max(0, Number((req.body as { speed?: number }).speed ?? 1)));
  res.json({ ok: true, speed: engine.speed });
});
app.post("/api/pause", (req, res) => {
  if (typeof (req.body as { paused?: boolean }).paused === "boolean") engine.paused = Boolean((req.body as { paused?: boolean }).paused);
  else engine.paused = !engine.paused;
  res.json({ ok: true, paused: engine.paused });
});

// god interventions — all mutate real state + emit event
app.use("/api/god", adminAuth, requirePerm("world.modify"));
app.post("/api/god/give-money", (req, res) => {
  const { citizenId, amount } = req.body as { citizenId: string; amount: number };
  const c = engine.state.citizens[citizenId];
  if (!c) { res.status(404).json({ error: "citizen not found" }); return; }
  const amt = Math.max(-10000, Math.min(100000, Number(amount) || 0));
  c.financial.cash = Math.max(0, c.financial.cash + amt);
  engine.state.events.push({ id: `e_god_${Date.now()}`, type: "GodIntervention", tick: engine.clock.tick, timestamp: Date.now(), day: engine.clock.day, actorIds: [citizenId], summary: `God gave ${amt} to ${c.firstName}`, data: { amount: amt } });
  res.json({ ok: true, cash: c.financial.cash });
});
app.post("/api/god/spawn-business", (req, res) => {
  const { name, type } = req.body as { name?: string; type?: string };
  const id = `b_god_${Date.now()}`;
  engine.state.buildings[id] = { id, name: String(name ?? "God Shop"), type: (type as "shop") ?? "shop", position: { x: 500, y: 500 }, capacity: 10, ownerId: null, workers: [], inventory: { goods: 50, meal: 50 }, openingHours: { open: 6, close: 22 }, economic: { funds: 2000, priceLevel: 1, wagesOwed: 0 } };
  engine.state.events.push({ id: `e_god_${Date.now()}`, type: "BusinessCreated", tick: engine.clock.tick, timestamp: Date.now(), day: engine.clock.day, actorIds: [], buildingId: id, summary: `God created ${name ?? id}`, data: {} });
  res.json({ ok: true, id });
});
app.post("/api/god/recession", (_req, res) => {
  for (const b of Object.values(engine.state.buildings)) b.economic.funds = Math.round(b.economic.funds * 0.7);
  engine.state.events.push({ id: `e_god_${Date.now()}`, type: "GodIntervention", tick: engine.clock.tick, timestamp: Date.now(), day: engine.clock.day, actorIds: [], summary: "God sent a recession", data: { kind: "recession" } });
  res.json({ ok: true });
});
app.post("/api/god/boom", (_req, res) => {
  for (const b of Object.values(engine.state.buildings)) b.economic.funds = Math.round(b.economic.funds * 1.3);
  engine.state.events.push({ id: `e_god_${Date.now()}`, type: "GodIntervention", tick: engine.clock.tick, timestamp: Date.now(), day: engine.clock.day, actorIds: [], summary: "God sent a boom", data: { kind: "boom" } });
  res.json({ ok: true });
});
app.post("/api/god/outbreak", (_req, res) => {
  let n = 0;
  for (const c of Object.values(engine.state.citizens)) { if (c.alive && Math.random() < 0.2) { c.needs.health = Math.max(0, c.needs.health - 30); n++; } }
  engine.state.events.push({ id: `e_god_${Date.now()}`, type: "GodIntervention", tick: engine.clock.tick, timestamp: Date.now(), day: engine.clock.day, actorIds: [], summary: `God sent an outbreak (${n} sick)`, data: { kind: "outbreak", n } });
  res.json({ ok: true, sick: n });
});
app.post("/api/god/add-migrant", (_req, res) => {
  const id = `c_mig_${Date.now()}`;
  engine.state.citizens[id] = { id, firstName: "Migrant", lastName: "Newcomer", sex: "M", age: 25, alive: true, position: { x: 500, y: 500 }, homeId: "b_home0", workBuildingId: null, jobId: null, destinationBuildingId: null, currentActivity: "idle", physical: { height: 175, health: 80 }, psychology: { openness: .5, conscientiousness: .5, extraversion: .5, agreeableness: .5, neuroticism: .3, ambition: .6, empathy: .5, greed: .3, honesty: .6, loyalty: .5, riskTaking: .4, patience: .5, curiosity: .5, discipline: .5, sociability: .5, aggression: .2, optimism: .6, religiosity: .3 }, skills: { farming: 20, cooking: 20, medicine: 10, engineering: 20, trading: 20, leadership: 10, combat: 10, teaching: 10, crafting: 20, mining: 10, fishing: 10, building: 20, music: 10, science: 10 }, emotions: { joy: .5, sadness: .1, anger: 0, fear: .2, love: .3, stress: .3 }, needs: { hunger: 70, energy: 80, health: 80, happiness: 50 }, financial: { cash: 300, bank: 0, debt: 0 }, marriedToId: null, goalIds: [], tickBorn: engine.clock.tick, tickDied: null };
  engine.state.events.push({ id: `e_god_${Date.now()}`, type: "MigrantArrived", tick: engine.clock.tick, timestamp: Date.now(), day: engine.clock.day, actorIds: [id], summary: "A migrant arrived", data: {} });
  res.json({ ok: true, id });
});

app.post("/api/citizen/:id/ask", async (req, res) => {
  const c = engine.state.citizens[req.params.id];
  if (!c) { res.status(404).json({ error: "not found" }); return; }
  const question = String((req.body as { question?: string }).question ?? "");
  const turns = (req.body as { turns?: Array<{ role: string; text: string }> }).turns ?? [];
  const ctx = buildCitizenContext(c, engine.state);
  const grounded = answerHistory(question, engine.state.events, engine.state.metricsHistory);
  const mind = ensureMind(c);
  const memTexts = retrieveMemories(c.id, { limit: 8, nowTick: engine.clock.tick }).map((m) => m.text);
  const job = c.jobId ? engine.state.jobs[c.jobId] : null;
  const knownWorld = [`Works as ${job ? job.title : "unemployed"}${job ? ` at ${engine.state.buildings[job.buildingId]?.name ?? job.buildingId}` : ""}.`, `Lives at ${c.homeId ?? "unknown"}.`, `Current activity: ${c.currentActivity}.`, ...engine.state.events.slice(-10).map((e) => e.summary)];
  const traits = `extraversion ${c.psychology.extraversion.toFixed(2)}, honesty ${c.psychology.honesty.toFixed(2)}, optimism ${c.psychology.optimism.toFixed(2)}, mood ${mind.mood}`;
  const role = roleRouter.get("dialogue");
  const prompt = buildDialoguePrompt(c, traits, memTexts.length > 0 ? memTexts : [`Day ${engine.clock.day}: living in Echo City.`], knownWorld, turns.slice(-8).map((t) => ({ role: t.role === "player" ? "player" as const : "citizen" as const, text: String(t.text).slice(0, 300) })), question);
  const raw = await brainProvider.chat(prompt, { model: role.model, agent: role.agent, timeoutMs: role.timeoutMs });
  const parsed = raw ? extractJson(raw.text) : null;
  const v = parsed ? validateDialogue(parsed) : { ok: false as const, value: null };
  if (v.ok && v.value) {
    res.json({ answer: v.value.reply, mood: v.value.mood, grounded: grounded.answer.split("\n")[0], ctx });
    return;
  }
  // Grounded fallback: admit limits, never hallucinate.
  res.json({ answer: `(offline) ${c.firstName}: I don't know about that — ${grounded.answer.split("\n")[0]}`, mood: mind.mood, grounded: grounded.answer, ctx });
});
app.post("/api/citizen/:id/decide", async (req, res) => {
  const c = engine.state.citizens[req.params.id];
  if (!c) { res.status(404).json({ error: "not found" }); return; }
  const cmd = await requestDecision(ai, buildCitizenContext(c, engine.state));
  const r = engine.applyAIDecision(c.id, cmd);
  res.json({ cmd, ...r });
});
app.post("/api/goals", (req, res) => {
  const { citizenId, text, priority } = req.body as { citizenId: string; text: string; priority?: number };
  const c = engine.state.citizens[citizenId];
  if (!c) { res.status(404).json({ error: "citizen not found" }); return; }
  const gid = `g_${Date.now()}_${citizenId}`;
  const g = { id: gid, citizenId, text: String(text ?? "").slice(0, 200), priority: Number(priority ?? 0.5), done: false, createdTick: engine.clock.tick };
  engine.state.goals[gid] = g; c.goalIds.push(gid);
  res.json({ ok: true, goal: g });
});
app.get("/api/money", (_req, res) => { res.json({ supply: totalMoney(engine.state) }); });

app.get("/api/money", (_req, res) => { res.json({ supply: totalMoney(engine.state) }); });

// ---- ECHO BRAIN API ----
app.get("/api/ai/models", async (_req, res) => {
  try { res.json({ models: await brainProvider.models(false), cached: true }); }
  catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});
app.post("/api/ai/refresh-models", async (_req, res) => {
  try { res.json({ models: await brainProvider.models(true), refreshed: true }); }
  catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : String(e) }); }
});
app.get("/api/ai/roles", (_req, res) => { res.json(roleRouter.all()); });
app.put("/api/ai/roles", (req, res) => {
  const { role, patch } = req.body as { role: ModelRole; patch: Record<string, unknown> };
  try {
    const updated = roleRouter.set(role, patch);
    try { saveRoleConfig(role, JSON.stringify(updated)); } catch { /* ignore */ }
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
});
app.get("/api/brain/status", (_req, res) => {
  const brain = scheduler.status();
  res.json({ brain, provider: brainProvider.status(), online: brainProvider.enabled && !brain.circuitOpen && brainProvider.lastError === null, intensity: aiConfig.intensity, dbBytes: dbSizeBytes() });
});
app.get("/api/brain/feed", (req, res) => {
  const limit = Math.min(100, Number(req.query.limit ?? 30));
  res.json({ live: scheduler.feed.slice(0, limit), persisted: getThoughtFeed(limit) });
});
app.get("/api/ai/config", (_req, res) => {
  res.json({ ...aiConfig, provider: brainProvider.status(), concurrency: scheduler.concurrency });
});
app.put("/api/ai/config", (req, res) => {
  const b = req.body as Record<string, unknown>;
  if (typeof b.intensity === "number") aiConfig.intensity = Math.max(0, Math.min(1, b.intensity));
  if (typeof b.cooldownMs === "number") aiConfig.cooldownMs = b.cooldownMs;
  if (typeof b.narrativeEnabled === "boolean") aiConfig.narrativeEnabled = b.narrativeEnabled;
  if (typeof b.backgroundEnabled === "boolean") aiConfig.backgroundEnabled = b.backgroundEnabled;
  if (typeof b.concurrency === "number") scheduler.setConcurrency(b.concurrency);
  if (typeof b.timeoutMs === "number") brainProvider.timeoutMs = b.timeoutMs;
  if (typeof b.exePath === "string") brainProvider.exePath = b.exePath;
  if (typeof b.serverUrl === "string") brainProvider.serverUrl = b.serverUrl;
  if (typeof b.enabled === "boolean") brainProvider.enabled = b.enabled;
  if (typeof b.defaultModel === "string") brainProvider.defaultModel = b.defaultModel;
  if (typeof b.loadLevel === "string" && ["FULL", "BALANCED", "LIGHT", "EMERGENCY"].includes(b.loadLevel)) scheduler.setLoad(b.loadLevel as "FULL");
  if (b.thresholds && typeof b.thresholds === "object") Object.assign(aiConfig.thresholds, b.thresholds);
  res.json({ ok: true, config: { ...aiConfig, concurrency: scheduler.concurrency } });
});
app.get("/api/ai/connection", async (_req, res) => {
  const t0 = Date.now();
  const model = roleRouter.get("reflex").model;
  const r = await brainProvider.chat('ECHO ping. Return ONLY JSON: {"pong": true}', { model, timeoutMs: 30000 });
  res.json({ ok: !!r, latencyMs: Date.now() - t0, model, lastError: brainProvider.lastError });
});
app.post("/api/ai/intensity", (req, res) => {
  aiConfig.intensity = Math.max(0, Math.min(1, Number((req.body as { intensity?: number }).intensity ?? aiConfig.intensity)));
  res.json({ ok: true, intensity: aiConfig.intensity });
});
// Synchronous think: enqueue + await outcome (used by E2E tests + Prompt Lab apply).
app.post("/api/brain/think", async (req, res) => {
  const { citizenId, type } = req.body as { citizenId: string; type?: string };
  const c = engine.state.citizens[citizenId];
  if (!c) { res.status(404).json({ error: "citizen not found" }); return; }
  const rawType = String(type ?? "social");
  const allowed = ["reflex", "social", "planning", "business", "government", "dialogue", "narrator", "historian"] as const;
  const ttype: (typeof allowed)[number] = (allowed as readonly string[]).includes(rawType) ? (rawType as (typeof allowed)[number]) : "social";
  const roleMap = { reflex: "reflex", social: "social", planning: "planning", business: "business", government: "government" } as const;
  const role = (roleMap[ttype as keyof typeof roleMap] ?? "social") as ModelRole;
  const mems = retrieveMemories(c.id, { limit: 5, nowTick: engine.clock.tick }).map((m) => ({ id: m.id, text: m.text }));
  const rels = Object.values(engine.state.relationships).filter((r) => r.aId === c.id || r.bId === c.id).slice(0, 5)
    .map((r) => ({ id: r.aId === c.id ? r.bId : r.aId, label: r.type, trust: r.trust }));
  const knownIds = [...new Set([...rels.map((r) => r.id), ...Object.keys(engine.state.citizens).slice(0, 20)])];
  const permitted: CognitionAction[] = ["TALK_TO", "BEFRIEND", "HELP", "AVOID", "CONFRONT_PERSON", "SHARE_GOSSIP", "BEGIN_JOB_SEARCH", "APPLY_JOB", "SET_GOAL", "PLAN_DAY", "NONE"];
  const kind = (ttype === "planning" ? "planner" : ttype === "reflex" ? "reflex" : "social") as "planner" | "reflex" | "social";
  const context = buildEnvelope(kind, {
    citizen: c, personality: { extraversion: c.psychology.extraversion, honesty: c.psychology.honesty, ambition: c.psychology.ambition },
    state: { activity: c.currentActivity, mood: ensureMind(c).mood, cash: Math.round(c.financial.cash) },
    goals: c.goalIds.map((g) => engine.state.goals[g]?.text).filter(Boolean) as string[],
    relationships: rels, memories: mems,
    event: { id: "manual", kind: "manual-think", summary: "Manual think request via API" },
    permittedActions: permitted, knownIds,
  });
  const done = new Promise<unknown>((resolve) => {
    const prev = scheduler.onApply;
    scheduler.onApply = (o) => {
      if (prev) void prev(o);
      if (o.req.citizenId === citizenId) { scheduler.onApply = prev; resolve({ outcome: o }); }
    };
    setTimeout(() => { scheduler.onApply = prev; resolve({ timeout: true }); }, 120000);
  });
  const id = scheduler.enqueue({
    citizenId, type: ttype, priority: 1, expiresAt: Date.now() + 115000,
    worldTick: engine.clock.tick, citizenVersion: 0, modelRole: role,
    context, schema: "cognition-v1", permittedActions: permitted, knownIds,
    envelopeVersion: ENVELOPE_VERSIONS[kind],
  });
  if (!id) { res.status(503).json({ error: "shed by load level" }); return; }
  void scheduler.pump(engine.clock.tick, () => 0);
  const r = await done as { outcome?: { response: unknown; model: string; latencyMs: number; fallback: boolean } };
  res.json({ id, ...r });
});
app.post("/api/prompt-lab/run", async (req, res) => {
  const { citizenId, type, contextOverride } = req.body as { citizenId?: string; type?: string; contextOverride?: string };
  const c = citizenId ? engine.state.citizens[citizenId] : Object.values(engine.state.citizens)[0];
  if (!c) { res.status(404).json({ error: "no citizen" }); return; }
  const kind = (type === "planning" ? "planner" : type === "reflex" ? "reflex" : "social") as "planner" | "reflex" | "social";
  const permitted: CognitionAction[] = ["TALK_TO", "BEFRIEND", "HELP", "AVOID", "CONFRONT_PERSON", "SHARE_GOSSIP", "BEGIN_JOB_SEARCH", "APPLY_JOB", "SET_GOAL", "PLAN_DAY", "NONE"];
  const knownIds = Object.keys(engine.state.citizens).slice(0, 20);
  const context = typeof contextOverride === "string" && contextOverride.length > 0 ? contextOverride : buildEnvelope(kind, {
    citizen: c, personality: { extraversion: c.psychology.extraversion, honesty: c.psychology.honesty },
    state: { activity: c.currentActivity }, goals: [], relationships: [], memories: [],
    event: { id: "lab", kind: "dry-run", summary: "Prompt Lab dry run" }, permittedActions: permitted, knownIds,
  });
  const role = roleRouter.get(kind === "planner" ? "planning" : kind);
  const t0 = Date.now();
  const raw = await brainProvider.chat(context, { model: role.model, agent: role.agent, timeoutMs: role.timeoutMs });
  const latencyMs = Date.now() - t0;
  if (!raw) { res.json({ context, raw: null, validation: { ok: false, errors: [brainProvider.lastError ?? "no response"] }, latencyMs, action: deterministicFallback("offline").action }); return; }
  const { validateResponse } = await import("@echo/ai");
  const parsed = extractJson(raw.text);
  const validation = parsed ? validateResponse(parsed, permitted, knownIds) : { ok: false as const, errors: ["unparseable"], value: null };
  res.json({ context, raw: raw.text.slice(0, 2000), validation: { ok: validation.ok, errors: validation.errors ?? [] }, latencyMs, model: raw.model, action: validation.ok && validation.value ? validation.value.action : "NONE" });
});
app.get("/api/ai/benchmark", (_req, res) => { res.json(listBenchmarks()); });
app.post("/api/ai/benchmark", async (req, res) => {
  const { models, tasks } = req.body as { models?: string[]; tasks?: string[] };
  const ms = (models ?? [brainProvider.defaultModel]).slice(0, 6);
  const ts = (tasks ?? ["social", "planning", "dialogue"]).slice(0, 6);
  const results: Array<Record<string, unknown>> = [];
  for (const m of ms) {
    for (const t of ts) {
      const t0 = Date.now();
      const r = await brainProvider.chat(`ECHO benchmark ${t}. Return ONLY JSON: {"task":"${t}","score":0.8,"note":"benchmark probe"}`, { model: m, timeoutMs: 45000 });
      const latencyMs = Date.now() - t0;
      let score = 0;
      if (r) { const p = extractJson(r.text) as { score?: unknown } | null; if (p && typeof p.score === "number") score = Math.max(0, Math.min(1, p.score)); else score = 0.5; }
      const row = { id: `bm_${Date.now()}_${results.length}`, model: m, task: t, score, latencyMs };
      try { logBenchmark(row); } catch { /* ignore */ }
      results.push(row);
    }
  }
  // NO auto best-model selection: caller compares scores manually.
  res.json({ results });
});
app.get("/api/citizen/:id/mind", (req, res) => {
  const c = engine.state.citizens[req.params.id];
  if (!c) { res.status(404).json({ error: "not found" }); return; }
  const score = attentionScore(c, engine.state);
  const all = Object.values(engine.state.citizens);
  res.json({
    mind: ensureMind(c), stored: getMind(c.id),
    attention: score, class: attentionClass(score), lod: lodFor(all.findIndex((x) => x.id === c.id), all.length),
    memories: retrieveMemories(c.id, { limit: 10, nowTick: engine.clock.tick }),
  });
});
app.get("/api/brain/heatmap", (_req, res) => {
  const all = Object.values(engine.state.citizens).filter((c) => c.alive);
  res.json(all.map((c, i) => {
    const s = attentionScore(c, engine.state) * aiConfig.intensity;
    return { id: c.id, name: `${c.firstName} ${c.lastName}`, attention: +s.toFixed(3), class: attentionClass(s), lod: lodFor(i, all.length), x: c.position.x, y: c.position.y };
  }));
});

registerAdminRoutes(app, { engine, afterTicks, aiConfig, brainProvider, enqueueFor: enqueueFor as never, scheduler: scheduler as never });

const server = createServer(app);
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", snapshot: engine.snapshot() }));
  const unsub = subscribe((m) => { try { ws.send(m); } catch { /* ignore */ } });
  ws.on("close", unsub);
});

server.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
