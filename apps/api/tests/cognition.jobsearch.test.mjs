// (a) MARCUS WEBB passed-over-twice -> BEGIN_JOB_SEARCH via full
// queue -> validate -> apply -> event/memory -> goal -> monitor.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CognitionScheduler, buildEnvelope, ensureMind, addMemory,
  applyEmotionDelta, attentionScore, attentionClass,
} from "../../../packages/ai/dist/index.js";
import { makeCitizen, stubChat } from "./fixtures.mjs";

test("marcus passed-over-twice begins job search (full pipeline)", async () => {
  const marcus = makeCitizen();
  const mind = ensureMind(marcus);
  // two deterministic passed-over events -> emotion deltas
  applyEmotionDelta(mind, "passed_over", 0.25);
  applyEmotionDelta(mind, "passed_over", 0.25);
  assert.ok(mind.emotions.sadness > 0.5, "sadness accumulated");
  addMemory(marcus.id, { kind: "episodic", text: "Passed over for promotion at the factory", tags: ["work"], entities: ["b_fact"], importance: 0.8, intensity: 0.7, relevance: 0.8, confidence: 0.9, createdTick: 100 });
  addMemory(marcus.id, { kind: "episodic", text: "Passed over a second time; supervisor praised someone else", tags: ["work"], entities: ["b_fact"], importance: 0.85, intensity: 0.8, relevance: 0.85, confidence: 0.9, createdTick: 200 });

  const stats = { calls: 0, maxActive: 0, active: 0 };
  const chat = stubChat({ default: JSON.stringify({ action: "BEGIN_JOB_SEARCH", targetId: null, intensity: 0.8, reasonSummary: "Passed over twice; ambition demands a better post", newGoalCandidate: "Find a senior engineering post", memoryCandidate: "Resolved to look for work elsewhere" }) }, stats);
  const applied = [];
  const s = new CognitionScheduler(chat, () => ({ model: "stub", agent: "echo-planner", timeoutMs: 5000, fallbackModels: [], enabled: true }));
  s.onApply = (o) => { applied.push(o); };
  const score = attentionScore(marcus, { memories: [] });
  assert.ok(score > 0, "attention positive");

  const permitted = ["BEGIN_JOB_SEARCH", "APPLY_JOB", "SET_GOAL", "PLAN_DAY", "NONE"];
  const context = buildEnvelope("planner", {
    citizen: marcus, personality: { ambition: 0.9 }, state: { mood: mind.mood },
    goals: [], relationships: [], memories: [{ id: "m1", text: "Passed over twice" }],
    event: { id: "e_pass2", kind: "passed_over", summary: "Passed over for promotion twice" },
    permittedActions: permitted, knownIds: [marcus.id],
  });
  const id = s.enqueue({
    citizenId: marcus.id, type: "planning", priority: 0.9, expiresAt: Date.now() + 60000,
    worldTick: 300, citizenVersion: 0, modelRole: "planning", context, schema: "cognition-v1",
    permittedActions: permitted, knownIds: [marcus.id], envelopeVersion: "planner-decision-v2",
  });
  assert.ok(id, "enqueued");
  await s.pump(300, () => 0);
  // drain async chain
  for (let i = 0; i < 10 && applied.length === 0; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(applied.length, 1, "one outcome applied");
  const o = applied[0];
  assert.equal(o.response.action, "BEGIN_JOB_SEARCH");
  assert.equal(o.validated, true);
  assert.equal(o.fallback, false);
  assert.ok(o.response.newGoalCandidate, "goal candidate present");
  const st = s.status();
  assert.equal(st.queue, 0);
  assert.ok(st.byCategory.planning >= 1, "monitor counts planning");
  assert.deepEqual(Object.keys(s.feed[0]).sort(), ["at", "citizenId", "decision", "id", "inputSummary", "latencyMs", "reason", "result", "type"], "feed exposes input/decision/reason/result only — no chain-of-thought field");
  void attentionClass;
});
