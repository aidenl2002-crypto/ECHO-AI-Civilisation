// Fixtures: deterministic fictional citizens for cognition E2E tests.
export function makeCitizen(over = {}) {
  return {
    id: "c_marcus", firstName: "Marcus", lastName: "Webb", sex: "M", age: 34, alive: true,
    position: { x: 100, y: 100 }, homeId: "b_home0", workBuildingId: "b_fact", jobId: "j_3",
    destinationBuildingId: null, currentActivity: "working",
    physical: { height: 180, health: 80 },
    psychology: { openness: 0.5, conscientiousness: 0.7, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.4, ambition: 0.9, empathy: 0.5, greed: 0.3, honesty: 0.7, loyalty: 0.6, riskTaking: 0.4, patience: 0.5, curiosity: 0.5, discipline: 0.6, sociability: 0.5, aggression: 0.2, optimism: 0.5, religiosity: 0.2 },
    skills: { farming: 10, cooking: 10, medicine: 10, engineering: 60, trading: 20, leadership: 30, combat: 10, teaching: 10, crafting: 20, mining: 10, fishing: 10, building: 20, music: 10, science: 10 },
    emotions: { joy: 0.3, sadness: 0.5, anger: 0.4, fear: 0.2, love: 0.3, stress: 0.6 },
    needs: { hunger: 70, energy: 60, health: 75, happiness: 40 },
    financial: { cash: 800, bank: 200, debt: 0 },
    marriedToId: null, goalIds: [], tickBorn: 0, tickDied: null,
    ...over,
  };
}
export const sarah = () => makeCitizen({ id: "c_sarah", firstName: "Sarah", lastName: "Cole", sex: "F", ambition: 0.4 });
export const evelyn = () => makeCitizen({ id: "c_evelyn", firstName: "Evelyn", lastName: "Ward", sex: "F" });

/** Stub chat fn: returns canned JSON per type, records calls for concurrency checks. */
export function stubChat(map, stats = { calls: 0, maxActive: 0, active: 0 }) {
  return async (prompt, o = {}) => {
    stats.calls++; stats.active++;
    stats.maxActive = Math.max(stats.maxActive, stats.active);
    await new Promise((r) => setTimeout(r, 5));
    stats.active--;
    const body = map.default ?? '{"action":"NONE","targetId":null,"intensity":0,"reasonSummary":"stub calm","newGoalCandidate":null,"memoryCandidate":null}';
    return { text: body, model: o.model ?? "stub", durationMs: 5 };
  };
}
