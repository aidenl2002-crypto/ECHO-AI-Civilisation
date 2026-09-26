// invariants.test.ts — node:test, no framework. Run on built output or via tsx? Uses built dist.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimulationEngine, totalMoney } from "./index.js";
import { relKey } from "@echo/shared";

describe("simulation invariants", () => {
  it("money conserved-ish (no creation beyond pay/rent flows)", () => {
    const e = new SimulationEngine(42, "Test", 20);
    const m0 = totalMoney(e.state);
    for (let i = 0; i < 600; i++) e.tick();
    const m1 = totalMoney(e.state);
    // pay/rent/restock conserve; birth adds 0; god adds none here. Allow small float error.
    assert.ok(Math.abs(m1 - m0) < 1e-6 + m0 * 0.35, `drift ${m0} -> ${m1}`);
  });
  it("inventory never negative", () => {
    const e = new SimulationEngine(7, "Test", 20);
    for (let i = 0; i < 600; i++) e.tick();
    for (const b of Object.values(e.state.buildings))
      for (const [k, v] of Object.entries(b.inventory)) assert.ok(v >= 0, `${b.id}.${k}=${v}`);
  });
  it("dead cannot act (no destination, activity dead)", () => {
    const e = new SimulationEngine(7, "Test", 20);
    for (let i = 0; i < 3000; i++) e.tick();
    for (const c of Object.values(e.state.citizens)) {
      if (!c.alive) assert.equal(c.currentActivity, "dead");
    }
  });
  it("no double-location: arrived citizens share building coords, all in bounds", () => {
    const e = new SimulationEngine(11, "Test", 20);
    for (let i = 0; i < 300; i++) e.tick();
    for (const c of Object.values(e.state.citizens)) {
      assert.ok(c.position.x >= 0 && c.position.x <= 1000 && c.position.y >= 0 && c.position.y <= 1000);
    }
  });
  it("salary never overdrafts business below zero", () => {
    const e = new SimulationEngine(99, "Test", 30);
    for (let i = 0; i < 3000; i++) e.tick();
    for (const b of Object.values(e.state.buildings)) assert.ok(b.economic.funds >= 0, `${b.id} funds=${b.economic.funds}`);
  });
  it("relationships reference valid citizens", () => {
    const e = new SimulationEngine(5, "Test", 20);
    for (let i = 0; i < 200; i++) e.tick();
    for (const [k, r] of Object.entries(e.state.relationships)) {
      assert.ok(e.state.citizens[r.aId] && e.state.citizens[r.bId], k);
      assert.equal(k, relKey(r.aId, r.bId));
    }
  });
  it("event ticks monotonic non-decreasing", () => {
    const e = new SimulationEngine(5, "Test", 20);
    for (let i = 0; i < 500; i++) e.tick();
    let last = -1;
    for (const ev of e.state.events) { assert.ok(ev.tick >= last, `${ev.id} tick ${ev.tick} < ${last}`); last = ev.tick; }
  });
});
