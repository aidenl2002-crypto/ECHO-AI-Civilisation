// admin.console.test.mjs — OWNER GOD CONSOLE tests (node:test, no framework).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulationEngine } from "../../../packages/simulation-core/dist/index.js";
import {
  roleFromToken, hasPermission, adminAuth, requirePerm, audit, auditLog,
  adminGiveMoney, adminKill, adminRevive, adminSpawn, filterCitizens,
  verifyWorld, parseAdminCommand, makeCommand,
} from "../dist/admin.js";

process.env.OWNER_TOKEN = "test-owner-secret";
process.env.ADMIN_TOKENS = "test-admin-1";
process.env.OBSERVER_TOKENS = "test-obs-1";

const req = (token, body = {}, params = {}, query = {}) => ({
  headers: { authorization: token ? `Bearer ${token}` : "" }, body, params, query,
});
const res = () => {
  const r = { statusCode: 200, payload: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.payload = o; return r; };
  return r;
};
const runMw = (mw, q) => new Promise((resolve) => {
  const r = res();
  let nexted = false;
  mw(q, r, () => { nexted = true; resolve({ nexted, r }); });
  setTimeout(() => resolve({ nexted, r }), 10);
});

test("unauth rejected: no token -> 401, bad token -> 401", async () => {
  let out = await runMw(adminAuth, req(null));
  assert.equal(out.nexted, false); assert.equal(out.r.statusCode, 401);
  out = await runMw(adminAuth, req("wrong-token"));
  assert.equal(out.nexted, false); assert.equal(out.r.statusCode, 401);
});

test("roles resolve + observer forbidden from citizen.kill", async () => {
  assert.equal(roleFromToken("test-owner-secret"), "OWNER");
  assert.equal(roleFromToken("test-admin-1"), "ADMIN");
  assert.equal(roleFromToken("test-obs-1"), "OBSERVER");
  assert.ok(hasPermission("OWNER", "system.database"));
  assert.ok(!hasPermission("ADMIN", "system.database"));
  assert.ok(!hasPermission("OBSERVER", "citizen.kill"));
  const q = req("test-obs-1"); q.admin = { role: "OBSERVER", id: "o" };
  const out = await runMw(requirePerm("citizen.kill"), q);
  assert.equal(out.nexted, false); assert.equal(out.r.statusCode, 403);
});

test("give-money: ADMIN_MINT/ADMIN_REMOVE ledger kinds valid", () => {
  const e = new SimulationEngine(42, "T", 10);
  const id = Object.keys(e.state.citizens)[0];
  const before = e.state.citizens[id].financial.cash;
  const r1 = adminGiveMoney(e.state, id, 1000);
  assert.equal(r1.kind, "ADMIN_MINT");
  assert.equal(e.state.citizens[id].financial.cash, before + 1000);
  const r2 = adminGiveMoney(e.state, id, -200);
  assert.equal(r2.kind, "ADMIN_REMOVE");
  assert.equal(e.state.citizens[id].financial.cash, before + 800);
  assert.throws(() => adminGiveMoney(e.state, "nope", 5), /not found/);
});

test("kill -> real death event + stops acting + cleanup; revive emits CitizenRevivedByAdmin", () => {
  const e = new SimulationEngine(7, "T", 10);
  const id = Object.keys(e.state.citizens).find((k) => e.state.citizens[k].jobId) ?? Object.keys(e.state.citizens)[0];
  const hadJob = e.state.citizens[id].jobId;
  adminKill(e.state, e.clock.tick, e.clock.day, id, "test");
  const c = e.state.citizens[id];
  assert.equal(c.alive, false);
  assert.equal(c.currentActivity, "dead");
  assert.equal(c.jobId, null);
  assert.ok(c.tickDied !== null);
  assert.ok(e.state.citizens[id]); // no row delete
  const death = e.state.events.filter((x) => x.actorIds.includes(id) && x.type === "CitizenDied");
  assert.ok(death.length >= 1, "death event exists");
  assert.equal(death[death.length - 1].data.source, "ADMIN");
  if (hadJob && e.state.jobs[hadJob]) assert.equal(e.state.jobs[hadJob].workerId, null);
  // dead cannot act: engine tick skips dead
  const pos = { ...c.position };
  for (let i = 0; i < 50; i++) e.tick();
  assert.equal(c.alive, false);
  assert.deepEqual({ ...c.position }, pos);
  // revive
  adminRevive(e.state, e.clock.tick, e.clock.day, id);
  assert.equal(c.alive, true);
  assert.equal(c.tickDied, null);
  const rev = e.state.events.filter((x) => x.actorIds.includes(id) && x.data?.adminKind === "CitizenRevivedByAdmin");
  assert.ok(rev.length >= 1, "revive marker event exists");
});

test("bulk filter respected (q, wealth, ids, alive)", () => {
  const e = new SimulationEngine(11, "T", 20);
  const all = Object.values(e.state.citizens);
  const name = all[0].firstName;
  const byQ = filterCitizens(e.state, { q: name });
  assert.ok(byQ.length >= 1 && byQ.length <= all.length);
  assert.ok(byQ.every((c) => `${c.firstName} ${c.lastName} ${c.id}`.toLowerCase().includes(name.toLowerCase())));
  const rich = filterCitizens(e.state, { minWealth: 1e9 });
  assert.equal(rich.length, 0);
  const ids = filterCitizens(e.state, { ids: [all[0].id, all[1].id] });
  assert.equal(ids.length, 2);
  const dead = filterCitizens(e.state, { alive: false });
  assert.equal(dead.length, 0);
});

test("audit written with source ADMIN + before/after", () => {
  const fakeReq = { requestId: "r_test", admin: { id: "OWNER_x", role: "OWNER" } };
  const n0 = auditLog.length;
  const e = audit(fakeReq, "citizen.money", "c_001", { cash: 1 }, { cash: 2 }, "test reason");
  assert.equal(auditLog.length, n0 + 1);
  assert.equal(e.source, "ADMIN");
  assert.equal(e.action, "citizen.money");
  assert.deepEqual(e.before, { cash: 1 });
});

test("snapshot create/restore roundtrip", () => {
  const e = new SimulationEngine(99, "T", 10);
  const snap = e.save();
  const id = Object.keys(e.state.citizens)[0];
  adminKill(e.state, e.clock.tick, e.clock.day, id, "snap test");
  assert.equal(e.state.citizens[id].alive, false);
  e.load(snap);
  assert.equal(e.state.citizens[id].alive, true);
});

test("command parser: approved actions only, shell rejected", () => {
  const g = parseAdminCommand("give 500 to c_001");
  assert.equal(g.rejected, false);
  assert.equal(g.actions[0].type, "citizen.money");
  const bad = parseAdminCommand("rm -rf /; $(evil)");
  assert.equal(bad.rejected, true);
  const none = parseAdminCommand("do the thing xyzzy");
  assert.equal(none.rejected, true);
  const mc = makeCommand("citizen.kill", "owner", ["c_1"], {});
  assert.ok(mc.timestamp > 0 && mc.type === "citizen.kill");
});

test("spawn creates new UUID citizen; verifyWorld passes on fresh world", () => {
  const e = new SimulationEngine(5, "T", 10);
  const c = adminSpawn(e.state, e.clock.tick, { firstName: "Test" });
  assert.ok(c.id.startsWith("c_god_"));
  assert.ok(e.state.citizens[c.id]);
  const checks = verifyWorld(e.state);
  assert.ok(checks.every((x) => x.ok), JSON.stringify(checks.filter((x) => !x.ok)));
});
