// mind.ts: Citizen MindState + Identity Core + Memory + Beliefs + Secrets +
// Reputation + Gossip + Emotion deltas + Goals + attention C0-C5 + LOD + cooldowns.
import type { Citizen } from "@echo/shared";
import type { WorldState } from "@echo/simulation-core";

export type MemoryKind = "episodic" | "semantic" | "social" | "emotional" | "procedural";
export interface MemoryRecord {
  id: string; citizenId: string; kind: MemoryKind; text: string;
  tags: string[]; entities: string[];
  importance: number; intensity: number; relevance: number; confidence: number;
  accessCount: number; createdTick: number; lastAccessTick: number;
}
export interface Belief { subject: string; claim: string; confidence: number; source: string; evidence: string[]; provenance: string[]; updatedTick: number; }
export interface Secret { id: string; holderId: string; aboutId: string | null; text: string; knownTo: string[]; createdTick: number; }
export interface IdentityCore { summary: string; values: string[]; temperament: string; updatedTick: number; }
export interface GoalNode { id: string; text: string; priority: number; parentId: string | null; done: boolean; }
export interface MindState {
  citizenId: string; citizenVersion: number;
  goals: GoalNode[]; concerns: string[]; mood: string;
  emotions: Record<string, number>; relationships: Record<string, { trust: number; affection: number; label: string }>;
  beliefs: Belief[]; unresolvedEvents: string[]; recentThoughts: string[]; plans: string[];
  identity: IdentityCore; reputation: number;
}
export type AttentionClass = "C0" | "C1" | "C2" | "C3" | "C4" | "C5";
export type LOD = "LOD0" | "LOD1" | "LOD2" | "LOD3";

const store = new Map<string, MindState>();
const memStore = new Map<string, MemoryRecord[]>();
const secretStore = new Map<string, Secret[]>();
const cooldowns = new Map<string, number>();
const versions = new Map<string, number>();

export function citizenVersion(id: string): number { return versions.get(id) ?? 0; }
export function bumpVersion(id: string): number { const v = citizenVersion(id) + 1; versions.set(id, v); return v; }

export function getMind(citizenId: string): MindState | null { return store.get(citizenId) ?? null; }
export function ensureMind(c: Citizen): MindState {
  let m = store.get(c.id);
  if (!m) {
    const traits = c.psychology;
    m = {
      citizenId: c.id, citizenVersion: citizenVersion(c.id),
      goals: [], concerns: [], mood: "steady",
      emotions: { ...c.emotions },
      relationships: {}, beliefs: [], unresolvedEvents: [], recentThoughts: [], plans: [],
      identity: { summary: `${c.firstName} ${c.lastName}, age ${c.age}.`, values: ["family", "work"], temperament: traits.extraversion > 0.6 ? "outgoing" : "reserved", updatedTick: 0 },
      reputation: 0.5,
    };
    store.set(c.id, m);
  }
  return m;
}

/** Deterministic emotion deltas from a world event. Returns applied delta map. */
export function applyEmotionDelta(m: MindState, kind: string, severity = 0.2): Record<string, number> {
  const d: Record<string, number> = {};
  const bump = (k: string, v: number): void => { d[k] = v; m.emotions[k] = Math.max(0, Math.min(1, (m.emotions[k] ?? 0.3) + v)); };
  if (kind === "passed_over" || kind === "fired") { bump("sadness", severity); bump("anger", severity * 0.8); bump("joy", -severity); }
  else if (kind === "hired" || kind === "praised") { bump("joy", severity); bump("stress", -severity * 0.5); }
  else if (kind === "betrayed" || kind === "stole") { bump("anger", severity); bump("fear", severity * 0.4); }
  else if (kind === "kindness") { bump("joy", severity * 0.7); bump("love", severity * 0.5); }
  else { bump("stress", severity * 0.3); }
  m.mood = (m.emotions.sadness ?? 0) > 0.6 ? "downcast" : (m.emotions.anger ?? 0) > 0.6 ? "bitter" : (m.emotions.joy ?? 0) > 0.6 ? "bright" : "steady";
  return d;
}

export function addMemory(citizenId: string, r: Omit<MemoryRecord, "id" | "citizenId" | "accessCount" | "lastAccessTick"> & { id?: string }): MemoryRecord {
  const rec: MemoryRecord = { id: r.id ?? `mem_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, citizenId, accessCount: 0, lastAccessTick: r.createdTick, ...r };
  const arr = memStore.get(citizenId) ?? [];
  arr.push(rec);
  if (arr.length > 300) arr.splice(0, arr.length - 300);
  memStore.set(citizenId, arr);
  return rec;
}

/** Top 5-15 retrieval: tag/entity/recency/emotion/goal scoring. Embeddings optional (not required). */
export function retrieveMemories(citizenId: string, q: { tags?: string[]; entities?: string[]; emotion?: string; goalTerms?: string[]; sinceTick?: number; limit?: number; nowTick?: number }): MemoryRecord[] {
  const arr = memStore.get(citizenId) ?? [];
  const now = q.nowTick ?? Math.max(...arr.map((m) => m.createdTick), 0);
  const scored = arr
    .filter((m) => (q.sinceTick == null || m.createdTick >= q.sinceTick))
    .map((m) => {
      let s = m.importance * 0.4 + m.relevance * 0.2 + m.confidence * 0.1;
      if (q.tags) for (const t of q.tags) if (m.tags.includes(t)) s += 0.3;
      if (q.entities) for (const e of q.entities) if (m.entities.includes(e)) s += 0.35;
      if (q.goalTerms) for (const g of q.goalTerms) if (m.text.toLowerCase().includes(g.toLowerCase())) s += 0.2;
      const age = Math.max(0, now - m.createdTick);
      s += Math.max(0, 0.25 - age / 20000); // recency
      s += Math.min(0.15, m.accessCount * 0.01);
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(5, Math.min(15, q.limit ?? 8)));
  for (const { m } of scored) { m.accessCount++; m.lastAccessTick = now; }
  return scored.map((x) => x.m);
}

/** Sleep consolidation: decay low-importance, merge duplicates, cap size. Returns summary. */
export function consolidateMemories(citizenId: string, nowTick: number): { kept: number; dropped: number; summary: string } {
  const arr = memStore.get(citizenId) ?? [];
  let dropped = 0;
  const seen = new Set<string>();
  const kept = arr.filter((m) => {
    const age = nowTick - m.createdTick;
    const decayed = m.importance * Math.exp(-age / 50000);
    if (decayed < 0.08 && m.accessCount === 0) { dropped++; return false; }
    const key = m.text.slice(0, 60).toLowerCase();
    if (seen.has(key)) { dropped++; return false; }
    seen.add(key);
    m.relevance = Math.max(0, m.relevance - 0.05);
    return true;
  });
  memStore.set(citizenId, kept);
  return { kept: kept.length, dropped, summary: `consolidated ${kept.length} kept, ${dropped} dropped` };
}

export function addBelief(citizenId: string, b: Omit<Belief, "updatedTick" | "provenance"> & { provenance?: string[] }, tick: number): Belief {
  const m = store.get(citizenId);
  const full: Belief = { ...b, provenance: b.provenance ?? [b.source], updatedTick: tick };
  m?.beliefs.push(full);
  return full;
}

/** Gossip with provenance chain A->B->C. Returns the new belief on the listener. */
export function shareGossip(speakerId: string, listenerId: string, claim: string, aboutId: string | null, confidence: number, tick: number): Belief {
  const speakerBelief = store.get(speakerId)?.beliefs.find((b) => b.claim === claim);
  const provenance = [...(speakerBelief?.provenance ?? [speakerId]), listenerId];
  // confidence decays one hop
  const heard: Belief = { subject: aboutId ?? "general", claim, confidence: Math.max(0.05, confidence * 0.8), source: speakerId, evidence: [], provenance, updatedTick: tick };
  store.get(listenerId)?.beliefs.push(heard);
  addMemory(listenerId, { kind: "social", text: `${speakerId} said: ${claim}`, tags: ["gossip"], entities: aboutId ? [aboutId] : [], importance: 0.5, intensity: 0.4, relevance: 0.6, confidence: heard.confidence, createdTick: tick });
  return heard;
}

export function addSecret(s: Omit<Secret, "id" | "knownTo"> & { id?: string }): Secret {
  const full: Secret = { id: s.id ?? `sec_${Date.now()}`, knownTo: [s.holderId], ...s };
  const arr = secretStore.get(s.holderId) ?? [];
  arr.push(full);
  secretStore.set(s.holderId, arr);
  return full;
}

export function adjustReputation(citizenId: string, delta: number): number {
  const m = store.get(citizenId);
  if (!m) return 0.5;
  m.reputation = Math.max(0, Math.min(1, m.reputation + delta));
  return m.reputation;
}

/** Attention score 0..1 from salience signals; thresholds map to C0-C5. */
export function attentionScore(c: Citizen, s: WorldState): number {
  let a = 0;
  if (c.needs.hunger < 25) a += 0.35;
  if (c.emotions.stress > 0.7) a += 0.3;
  if (c.needs.happiness < 25) a += 0.25;
  if (c.needs.health < 30) a += 0.3;
  a += c.psychology.ambition * 0.1 + c.psychology.neuroticism * 0.05;
  const recent = s.memories.filter((m) => m.citizenId === c.id).length;
  a += Math.min(0.15, recent * 0.01);
  return Math.max(0, Math.min(1, a));
}

export function attentionClass(score: number): AttentionClass {
  if (score < 0.08) return "C0";
  if (score < 0.25) return "C1";
  if (score < 0.45) return "C2";
  if (score < 0.65) return "C3";
  if (score < 0.85) return "C4";
  return "C5";
}

/** LOD by distance-to-camera proxy (crowd size here): 0 full, 3 frozen. */
export function lodFor(index: number, total: number): LOD {
  const f = total <= 0 ? 0 : index / total;
  if (f < 0.25) return "LOD0";
  if (f < 0.5) return "LOD1";
  if (f < 0.8) return "LOD2";
  return "LOD3";
}

export function cooldownGet(key: string, nowMs: number): boolean {
  const until = cooldowns.get(key) ?? 0;
  return nowMs < until;
}
export function cooldownSet(key: string, nowMs: number, ms: number): void { cooldowns.set(key, nowMs + ms); }

/** Group-event batching: one request per group instead of per citizen. */
export function batchGroup<T>(ids: string[], maxBatch: number, fn: (batch: string[]) => T): T[] {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += maxBatch) out.push(fn(ids.slice(i, i + maxBatch)));
  return out;
}
