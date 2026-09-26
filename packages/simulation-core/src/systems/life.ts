// life.ts: aging, death, birth.
import type { WorldState } from "../world.js";
export function lifeTick(state: WorldState, tick: number, day: number, rng: () => number, emit: (t: string, s: string, a: string[], d: Record<string, unknown>) => void): void {
  // aging: +1 year each 365 days (checked daily at midnight tick)
  if (tick % 288 !== 0) { deathCheck(state, tick, day, rng, emit); return; }
  for (const c of Object.values(state.citizens)) {
    if (!c.alive) continue;
    if (day % 365 === 1) c.age += 1;
  }
  // birth: small chance per married couple per year
  if (day % 30 === 1) {
    for (const c of Object.values(state.citizens)) {
      if (!c.alive || !c.marriedToId || c.sex !== "F" || c.age > 42 || c.age < 20) continue;
      if (rng() < 0.02) {
        const id = `c_b${tick}_${c.id}`;
        state.citizens[id] = {
          id, firstName: rng() < 0.5 ? "New" : "Baby", lastName: c.lastName,
          sex: rng() < 0.5 ? "M" : "F", age: 0, alive: true,
          position: { ...c.position }, homeId: c.homeId, workBuildingId: null, jobId: null,
          destinationBuildingId: null, currentActivity: "idle",
          physical: { height: 50, health: 90 },
          psychology: { openness: .5, conscientiousness: .5, extraversion: .5, agreeableness: .6, neuroticism: .3, ambition: .3, empathy: .5, greed: .2, honesty: .6, loyalty: .5, riskTaking: .3, patience: .4, curiosity: .7, discipline: .3, sociability: .5, aggression: .2, optimism: .7, religiosity: .3 },
          skills: { farming: 0, cooking: 0, medicine: 0, engineering: 0, trading: 0, leadership: 0, combat: 0, teaching: 0, crafting: 0, mining: 0, fishing: 0, building: 0, music: 0, science: 0 },
          emotions: { joy: .7, sadness: 0, anger: 0, fear: 0, love: .8, stress: 0 },
          needs: { hunger: 80, energy: 80, health: 90, happiness: 70 },
          financial: { cash: 0, bank: 0, debt: 0 },
          marriedToId: null, goalIds: [], tickBorn: tick, tickDied: null,
        };
        emit("ChildBorn", `child born to ${c.firstName}`, [c.id, id], { motherId: c.id });
      }
    }
  }
  deathCheck(state, tick, day, rng, emit);
}
function deathCheck(state: WorldState, tick: number, day: number, rng: () => number, emit: (t: string, s: string, a: string[], d: Record<string, unknown>) => void): void {
  // daily roll (not per-tick) so mortality is sane: elder ~0.3%/day per year over 70, critical health 3%/day
  if (tick % 288 !== 0) return;
  for (const c of Object.values(state.citizens)) {
    if (!c.alive) continue;
    // base mortality rises with age + low health (daily probabilities)
    const ageRisk = c.age > 70 ? (c.age - 70) * 0.003 : 0;
    const healthRisk = c.needs.health < 10 ? 0.03 : 0;
    if (rng() < ageRisk + healthRisk) {
      c.alive = false; c.currentActivity = "dead"; c.tickDied = tick; c.jobId = null;
      if (c.workBuildingId && state.buildings[c.workBuildingId]) {
        state.buildings[c.workBuildingId].workers = state.buildings[c.workBuildingId].workers.filter((w) => w !== c.id);
      }
      // free job slot
      for (const j of Object.values(state.jobs)) if (j.workerId === c.id) j.workerId = null;
      emit("CitizenDied", `${c.firstName} ${c.lastName} died at ${c.age}`, [c.id], { age: c.age });
    }
  }
}
