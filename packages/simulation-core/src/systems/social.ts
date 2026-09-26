// social.ts: proximity encounters + relationship drift + Tier1 food decision scoring.
import { relKey, type Citizen, type SimEventType } from "@echo/shared";
import type { WorldState } from "../world.js";
import { dist } from "./movement.js";

type EmitSocial = (type: SimEventType, summary: string, actorIds: string[], data: Record<string, unknown>) => void;

function conversation(state: WorldState, speaker: Citizen, listener: Citizen, tick: number, emit?: EmitSocial): void {
  const day = Math.floor(tick / 288) + 1;
  const relationship = state.relationships[relKey(speaker.id, listener.id)];
  const workplace = speaker.workBuildingId ? state.buildings[speaker.workBuildingId]?.name : null;
  const publicStory = [...state.events].reverse().find((event) =>
    ["BusinessCreated", "BusinessClosed", "ElectionWon", "LawChanged", "CrimeCommitted", "GodIntervention", "MigrantArrived"].includes(event.type) && event.day >= day - 2,
  );
  const topics = [
    publicStory ? `Did you hear? ${publicStory.summary}` : `How is your day in ${state.cityName} going?`,
    workplace ? `It has been busy at ${workplace} today. How are things with you?` : `I've been looking around ${state.cityName} today. Anything new with you?`,
    speaker.needs.happiness < 40 ? `Today has been difficult. Have you had a better day?` : `It's good to run into you. What's been on your mind?`,
    speaker.financial.cash < 100 ? `Money is tight for me right now. How are you managing?` : `I finally have a little breathing room today. How about you?`,
  ];
  const opening = topics[Math.floor(tick / 72) % topics.length];
  const responses = relationship?.trust !== undefined && relationship.trust < 0.2
    ? ["I'm keeping my thoughts to myself for now.", "Maybe we can talk another time."]
    : listener.needs.happiness < 40
      ? ["I've had a rough day too. It helps to talk.", "I'm taking things one day at a time."]
      : ["I'm glad you asked. It's been an interesting day.", "Good to see you. Let's catch up again soon."];
  const reply = responses[Math.floor(tick / 144) % responses.length];
  const firstId = `p_talk_${tick}_${speaker.id}`;
  state.posts.push({ id: firstId, authorId: speaker.id, text: opening, tick, day, likes: 0 });
  state.posts.push({ id: `p_talk_${tick}_${listener.id}_reply`, authorId: listener.id, text: reply, tick, day, likes: 0, replyToId: firstId });
  if (state.posts.length > 1000) state.posts.splice(0, state.posts.length - 1000);
  emit?.("CitizenTalked", `${speaker.firstName} ${speaker.lastName} spoke with ${listener.firstName} ${listener.lastName}`, [speaker.id, listener.id], { firstPostId: firstId });
}

export function socialTick(state: WorldState, tick: number, rng: () => number, emit?: EmitSocial): void {
  const alive = Object.values(state.citizens).filter((c) => c.alive);
  // proximity encounters: sample pairs cheaply (each citizen checks 1 random other)
  for (const c of alive) {
    const o = alive[Math.floor(rng() * alive.length)];
    if (!o || o.id === c.id) continue;
    if (dist(c.position, o.position) > 60) continue;
    const key = relKey(c.id, o.id);
    let r = state.relationships[key];
    if (!r) {
      r = { aId: c.id, bId: o.id, familiarity: 0.05, trust: 0.3, affection: 0.1, attraction: 0, respect: 0.3, resentment: 0, fear: 0, dependency: 0, loyalty: 0.1, type: "stranger", interactions: 0, updatedTick: tick };
      state.relationships[key] = r;
    }
    r.interactions++;
    r.familiarity = Math.min(1, r.familiarity + 0.02);
    // drift by agreeableness
    const aff = (c.psychology.agreeableness + o.psychology.agreeableness) / 2;
    r.affection = Math.max(0, Math.min(1, r.affection + (aff > 0.5 ? 0.01 : -0.005)));
    r.trust = Math.max(0, Math.min(1, r.trust + (c.psychology.honesty - 0.5) * 0.01));
    if (r.familiarity > 0.7 && r.affection > 0.6) r.type = "friend";
    else if (r.familiarity > 0.3) r.type = "acquaintance";
    if (r.resentment > 0.8) r.type = "rival";
    r.updatedTick = tick;
  }
  // One public exchange every six simulated hours. Use nearby people so the
  // conversation belongs to the world, even when the AI gateway is offline.
  if (tick > 0 && tick % 72 === 0 && alive.length > 1) {
    const offset = Math.floor(rng() * alive.length);
    for (let i = 0; i < alive.length; i++) {
      const speaker = alive[(offset + i) % alive.length];
      const listener = alive.filter((other) => other.id !== speaker.id)
        .sort((a, b) => dist(speaker.position, a.position) - dist(speaker.position, b.position))[0];
      if (listener && dist(speaker.position, listener.position) <= 180) {
        conversation(state, speaker, listener, tick, emit);
        break;
      }
    }
  }
}

/** Tier1 utility food decision: returns scored choice. Deterministic. */
export function decideFood(citizenId: string, state: WorldState): "home" | "restaurant" | "groceries" | "skip" {
  const c = state.citizens[citizenId];
  if (!c || !c.alive) return "skip";
  if (c.needs.hunger > 75) return "skip";
  const wealth = c.financial.cash + c.financial.bank;
  const hungerUrgency = (100 - c.needs.hunger) / 100;
  const scoreHome = 0.4 + hungerUrgency * 0.3;
  const scoreGroceries = wealth > 50 ? 0.5 + hungerUrgency * 0.3 : 0;
  const scoreRestaurant = wealth > 300 ? 0.6 + c.psychology.extraversion * 0.3 : 0;
  let best: "home" | "restaurant" | "groceries" | "skip" = "home";
  let bs = scoreHome;
  if (scoreGroceries > bs) { bs = scoreGroceries; best = "groceries"; }
  if (scoreRestaurant > bs) { bs = scoreRestaurant; best = "restaurant"; }
  return best;
}
