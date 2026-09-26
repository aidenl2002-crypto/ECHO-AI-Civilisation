// (b) Sarah trusts Evelyn's false "Marcus stole money" claim: belief + propagation tracking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureMind, addBelief, shareGossip, adjustReputation } from "../../../packages/ai/dist/index.js";
import { sarah, evelyn, makeCitizen } from "./fixtures.mjs";

test("false gossip propagates with provenance A->B->C", () => {
  const m = makeCitizen(); const s = sarah(); const e = evelyn();
  ensureMind(m); ensureMind(s); ensureMind(e);
  // Evelyn originates false claim about Marcus (confidence 0.6, no evidence)
  addBelief(e.id, { subject: m.id, claim: "Marcus stole money", confidence: 0.6, source: e.id, evidence: [] }, 100);
  // Evelyn -> Sarah (high trust edge assumed: Sarah trusts Evelyn)
  const heard = shareGossip(e.id, s.id, "Marcus stole money", m.id, 0.6, 200);
  assert.ok(heard.confidence < 0.6, "confidence decays one hop");
  assert.deepEqual(heard.provenance, [e.id, s.id], "provenance A->B tracked");
  // Sarah -> Marcus's reputation drops; Marcus learns of rumor
  adjustReputation(m.id, -0.15);
  const heard2 = shareGossip(s.id, m.id, "Marcus stole money", m.id, heard.confidence, 300);
  assert.deepEqual(heard2.provenance, [e.id, s.id, m.id], "provenance A->B->C tracked");
  const sMind = ensureMind(s);
  const marcusMind = ensureMind(m);
  assert.ok(sMind.beliefs.some((b) => b.claim === "Marcus stole money"), "sarah holds belief");
  assert.ok(marcusMind.reputation < 0.5, "marcus reputation damaged");
  // Belief records source + no evidence -> downstream can flag as unverified
  assert.equal(heard.evidence.length, 0, "no evidence attached");
  assert.equal(heard.source, e.id, "source preserved across hops");
});
