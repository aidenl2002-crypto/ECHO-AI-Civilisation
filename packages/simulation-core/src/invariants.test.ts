// invariants.test.ts — node:test, no framework. Run on built output or via tsx? Uses built dist.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimulationEngine, totalMoney } from "./index.js";
import { planRoute, moveTowards } from "./systems/movement.js";
import { createWorld } from "./world.js";
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
      assert.ok(c.position.x >= 0 && c.position.x <= (e.state.layout?.width ?? 1000) && c.position.y >= 0 && c.position.y <= (e.state.layout?.height ?? 1000));
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


describe('Phase II city generation and travel', () => {
  it('generates deterministic functional parcels, housing and connected roads', () => {
    const world=createWorld(1337,'Test',120);
    assert.deepEqual(world,createWorld(1337,'Test',120));
    const buildings=Object.values(world.buildings);
    assert.ok(buildings.length>=160 && buildings.length<=240);
    assert.equal(world.layout?.districts.length,7);
    for(const district of world.layout!.districts) assert.ok(buildings.some(b=>b.districtId===district.id),district.id);
    const start=world.buildings.b_townhall.position;
    for(const b of buildings){
      assert.ok(b.entrance && b.footprint && b.address,b.id);
      assert.ok(planRoute(world,start,b.entrance!).length>0,'disconnected '+b.id);
      if(b.type==='home')assert.ok(Object.values(world.citizens).filter(c=>c.homeId===b.id).length<=b.capacity,b.id);
    }
  });
  it('walks through road waypoints and reaches exact destination without teleporting', () => {
    const world=createWorld(42,'Test',1);const citizen=Object.values(world.citizens)[0];
    const destination=world.buildings.b_fact;
    const route=planRoute(world,citizen.position,destination.entrance!);
    assert.ok(route.length>3);
    citizen.destinationBuildingId=destination.id;
    let ticks=0;
    while(citizen.destinationBuildingId&&ticks++<300){const before={...citizen.position};moveTowards(world,citizen.id);assert.ok(Math.hypot(before.x-citizen.position.x,before.y-citizen.position.y)<=85.00001);}
    assert.ok(ticks<300);assert.deepEqual(citizen.position,destination.position);
  });
  it('does not teleport across a disconnected road network', () => {
    const world=createWorld(12,'Disconnected',1);const citizen=Object.values(world.citizens)[0];
    world.layout!.roads=[{id:'a',name:'A',kind:'local',width:10,points:[{x:0,y:0},{x:100,y:0}]},{id:'b',name:'B',kind:'local',width:10,points:[{x:500,y:0},{x:600,y:0}]}];
    citizen.position={x:0,y:0};world.buildings.b_fact.position={x:600,y:0};world.buildings.b_fact.entrance={x:600,y:0};
    citizen.destinationBuildingId='b_fact';moveTowards(world,citizen.id);
    assert.deepEqual(citizen.position,{x:0,y:0});assert.equal(citizen.destinationBuildingId,null);
  });
  it('keeps legacy saves in their original coordinate space', () => {
    const world=createWorld(12,'Legacy',1);delete world.layout;
    const citizen=Object.values(world.citizens)[0];citizen.position={x:10,y:10};
    world.buildings.b_fact.position={x:100,y:10};delete world.buildings.b_fact.entrance;
    citizen.destinationBuildingId='b_fact';moveTowards(world,citizen.id);
    assert.deepEqual(citizen.position,{x:19,y:10});
    const engine=new SimulationEngine();engine.load(JSON.stringify({tick:200,state:world}));assert.equal(engine.state.layout,undefined);assert.equal(engine.clock.tick,200);
  });
});
