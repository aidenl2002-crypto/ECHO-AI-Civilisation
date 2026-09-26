// brains.ts: Business Brain + Government Brain (individual actors, no omniscience),
// Narrator (events->prose, never invents), Historian (evidence-grounded), causal links.
import type { SimEvent } from "@echo/shared";

export interface BusinessView { buildingId: string; name: string; funds: number; inventory: Record<string, number>; workers: string[]; priceLevel: number; }
export function businessPrompt(v: BusinessView, rumors: string[], memos: string[]): string {
  return [
    `ECHO_COGNITION business-decision-v2. FICTIONAL sim data. Return ONLY JSON, no chain-of-thought.`,
    `YOUR SHOP ONLY: ${v.name} (${v.buildingId}) funds ${Math.round(v.funds)} inventory ${JSON.stringify(v.inventory)} workers ${v.workers.length} priceLevel ${v.priceLevel}.`,
    `PUBLIC RUMORS: ${JSON.stringify(rumors.slice(0, 5))}`,
    `YOUR MEMOS: ${JSON.stringify(memos.slice(0, 5))}`,
    `PERMITTED_ACTIONS SET_PRICE,RESTOCK,HIRE,FIRE,ADVERTISE,CLOSE_SHOP,NONE`,
    `SCHEMA {"action":string,"targetId":null,"intensity":0..1,"reasonSummary":"<=25 words","newGoalCandidate":null,"memoryCandidate":string-or-null}`,
  ].join("\n");
}

export interface GovernmentView { office: string; treasury: number; taxRate: number; laws: string[]; }
export function governmentPrompt(v: GovernmentView, events: string[], approval: number): string {
  return [
    `ECHO_COGNITION government-decision-v2. FICTIONAL sim data. Return ONLY JSON, no chain-of-thought.`,
    `YOUR OFFICE ONLY: ${v.office} treasury ${Math.round(v.treasury)} taxRate ${v.taxRate} laws ${JSON.stringify(v.laws.slice(0, 5))} approval ${approval}.`,
    `RECENT PUBLIC EVENTS: ${JSON.stringify(events.slice(0, 6))}`,
    `BOUNDS: taxRate 0..0.5, RELEASE_FUNDS <= 20% of treasury.`,
    `PERMITTED_ACTIONS PROPOSE_LAW,SET_TAX,RELEASE_FUNDS,CAMPAIGN,NONE`,
    `SCHEMA {"action":string,"targetId":null,"intensity":0..1,"reasonSummary":"<=25 words","newGoalCandidate":null,"memoryCandidate":string-or-null}`,
  ].join("\n");
}

/** Narrator: deterministic prose from events only (offline-safe). LLM polish optional. */
export function narrate(events: SimEvent[], polish: string | null = null): { prose: string; eventIds: string[] } {
  const ids = events.slice(0, 6).map((e) => e.id);
  const lines = events.slice(0, 6).map((e) => `Day ${e.day}: ${e.summary}`);
  let prose = lines.join(" ");
  if (polish) prose += ` ${polish.slice(0, 200)}`;
  return { prose: prose || "A quiet day passes over the city.", eventIds: ids };
}

export function narratorPrompt(events: SimEvent[]): string {
  return [
    `ECHO_COGNITION narrator-v1. Narrate ONLY these events. Never invent. Return ONLY JSON.`,
    ...events.slice(0, 6).map((e) => `EVENT [${e.id}] day ${e.day} ${e.type}: ${e.summary}`),
    `SCHEMA {"prose":"<=150 words, traceable to EVENT ids","eventIds":string[]}`,
  ].join("\n");
}

/** Historian: deterministic evidence-grounded answer with documented/interpretation/uncertain labels. */
export function historianAnswer(question: string, events: SimEvent[]): { answer: string; cites: string[]; labels: Array<"documented" | "interpretation" | "uncertain"> } {
  const q = question.toLowerCase();
  const keywords = q.split(/[^a-z]+/).filter((w) => w.length > 3);
  const scored = events.map((e) => {
    const s = `${e.summary} ${e.type}`.toLowerCase();
    let sc = 0; for (const k of keywords) if (s.includes(k)) sc++;
    return { e, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.e.tick - a.e.tick).slice(0, 8);
  if (scored.length === 0) {
    const recent = events.slice(-3);
    return { answer: `UNCERTAIN: no recorded evidence matches "${question}".`, cites: recent.map((e) => e.id), labels: recent.length > 0 ? recent.map(() => "uncertain" as const) : (["uncertain"] as Array<"documented" | "interpretation" | "uncertain">) };
  }
  return {
    answer: `DOCUMENTED: ${scored.map(({ e }) => `Day ${e.day} [${e.id}] ${e.summary}`).join("; ")}. INTERPRETATION: these records suggest the pattern above; treat causes as provisional.`,
    cites: scored.map(({ e }) => e.id), labels: scored.map(() => "documented" as const),
  };
}

/** Causal links between events sharing actors within a tick window. */
export function linkCauses(events: SimEvent[], windowTicks = 288): Array<{ from: string; to: string; via: string }> {
  const links: Array<{ from: string; to: string; via: string }> = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i] as SimEvent, b = events[j] as SimEvent;
      if (b.tick - a.tick > windowTicks) break;
      const shared = a.actorIds.find((id) => b.actorIds.includes(id));
      if (shared) links.push({ from: a.id, to: b.id, via: shared });
      if (links.length >= 200) return links;
    }
  }
  return links;
}
