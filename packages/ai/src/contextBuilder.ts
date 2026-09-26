// contextBuilder: compact JSON context for one citizen (bounded size for local LLM).
import type { Citizen } from "@echo/shared";
import type { WorldState } from "@echo/simulation-core";
import { relKey } from "@echo/shared";
export function buildCitizenContext(c: Citizen, s: WorldState): Record<string, unknown> {
  const mems = s.memories.filter((m) => m.citizenId === c.id).sort((a, b) => b.salience - a.salience).slice(0, 5)
    .map((m) => ({ day: m.day, text: m.text }));
  const rels = Object.values(s.relationships).filter((r) => r.aId === c.id || r.bId === c.id)
    .sort((a, b) => b.familiarity - a.familiarity).slice(0, 5)
    .map((r) => { const other = r.aId === c.id ? r.bId : r.aId; const o = s.citizens[other]; return { with: o ? `${o.firstName} ${o.lastName}` : other, type: r.type, trust: +r.trust.toFixed(2), affection: +r.affection.toFixed(2) }; });
  void relKey;
  const goals = c.goalIds.map((g) => s.goals[g]?.text).filter(Boolean).slice(0, 3);
  const job = c.jobId ? s.jobs[c.jobId]?.title : null;
  return {
    name: `${c.firstName} ${c.lastName}`, age: c.age, sex: c.sex, job,
    traits: { extraversion: +c.psychology.extraversion.toFixed(2), agreeableness: +c.psychology.agreeableness.toFixed(2), ambition: +c.psychology.ambition.toFixed(2), greed: +c.psychology.greed.toFixed(2), honesty: +c.psychology.honesty.toFixed(2) },
    emotions: c.emotions, needs: c.needs,
    money: { cash: Math.round(c.financial.cash), bank: Math.round(c.financial.bank), debt: c.financial.debt },
    activity: c.currentActivity, memories: mems, relationships: rels, goals,
  };
}
