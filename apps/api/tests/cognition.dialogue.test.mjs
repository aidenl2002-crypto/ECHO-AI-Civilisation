// (c) Talk-to-citizen grounded dialogue: knows knowns, admits unknowns, leaks nothing private.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDialoguePrompt, validateDialogue, extractJson, historianAnswer } from "../../../packages/ai/dist/index.js";
import { makeCitizen } from "./fixtures.mjs";

const SECRET = "owes 900 to the clinic";
const KNOWN = "works at the factory";

test("dialogue grounded: answers knowns, ignorant of unknowns, no private leaks", () => {
  const marcus = makeCitizen();
  const prompt = buildDialoguePrompt(
    marcus,
    "plain-spoken, extraversion 0.50",
    [KNOWN],
    ["It rained on Day 3."],
    [{ role: "player", text: "How are you?" }, { role: "citizen", text: "Getting by." }],
    "Do you work anywhere?",
  );
  assert.ok(!prompt.includes(SECRET), "prompt carries no private secrets");
  // Simulated grounded model reply (stub): answers from memories only
  const fake = JSON.stringify({ reply: "Aye, I work at the factory. Times are tight.", mood: "steady", revealedMemoryIds: [] });
  const v = validateDialogue(extractJson(fake));
  assert.ok(v.ok && v.value, "valid dialogue JSON");
  assert.ok(v.value.reply.includes("factory"), "uses known fact");
  assert.ok(!v.value.reply.includes(SECRET), "no leak");
});

test("dialogue ignorance: unknown topic admitted", () => {
  const v = validateDialogue(extractJson(JSON.stringify({ reply: "Never heard of that — I don't know.", mood: "steady", revealedMemoryIds: [] })));
  assert.ok(v.ok && v.value.reply.includes("don't know"), "admits ignorance");
});

test("historian marks missing evidence UNCERTAIN", () => {
  const r = historianAnswer("who invented the sky-train?", []);
  assert.ok(r.labels.includes("uncertain"), "uncertain label present");
  assert.ok(r.answer.includes("UNCERTAIN"), "explicit uncertainty");
});
