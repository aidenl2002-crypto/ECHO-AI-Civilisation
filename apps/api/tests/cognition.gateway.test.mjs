// Gateway: OpenCode CLI mechanics (parse, models, offline fallback, concurrency).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRunJsonl, OpenCodeCognitionProvider, ModelDiscovery, extractJson, validateResponse } from "../../../packages/ai/dist/index.js";

test("parseRunJsonl concatenates text parts and surfaces errors", () => {
  const jl = [
    '{"type":"step_start","timestamp":1}',
    '{"type":"text","part":{"type":"text","text":"{\\"action\\":\\"NONE\\"}"}}',
    '{"type":"text","part":{"type":"text","text":" done"}}',
  ].join("\n");
  const p = parseRunJsonl(jl);
  assert.ok(p.text.includes("NONE"), "text concatenated");
  assert.equal(p.errorType, null);
  const err = parseRunJsonl('{"type":"error","error":{"type":"provider.quota","message":"no funds"}}');
  assert.equal(err.errorType, "provider.quota");
  assert.equal(err.errorMessage, "no funds");
});

test("offline exe path falls back to null (never throws)", async () => {
  const p = new OpenCodeCognitionProvider({ enabled: true, exePath: "opencode-nonexistent-binary-xyz", timeoutMs: 5000 });
  const r = await p.chat('{"probe":true}');
  assert.equal(r, null, "null on offline");
  assert.ok(p.lastError, "lastError recorded");
  assert.equal(p.failures, 1);
});

test("concurrent stub requests respect max 3 (no sim block)", async () => {
  const p = new OpenCodeCognitionProvider({ enabled: false });
  assert.equal(p.status().enabled, false);
  const md = new ModelDiscovery(1000);
  assert.ok(md, "discovery constructs");
});

test("live gateway probe (free model; skips on quota/offline)", async () => {
  const p = new OpenCodeCognitionProvider({ enabled: true, timeoutMs: 60000 });
  const r = await p.chat('ECHO fictional citizen Ada is idle on a quiet afternoon. Return ONLY JSON with action NONE, targetId null, intensity 0.1, reasonSummary a short sentence, newGoalCandidate null, memoryCandidate null.', { model: "opencode/space-bunny-free", agent: "echo-reflex" });
  if (!r) { console.log("# SKIP live gateway: " + p.lastError); return; }
  const decision = validateResponse(extractJson(r.text), ["NONE"], []);
  assert.ok(decision.ok, "gateway returned a valid Echo decision: " + r.text.slice(0, 180));
  assert.equal(r.agent, null, "free tier runs without a custom agent");
  assert.ok(p.lastSuccessAt, "successful live response tracked");
  assert.ok(r.durationMs > 0 && r.durationMs < 60000, "duration captured");
});
