// needs.ts: per-tick decay of hunger/energy/health/happiness + eating/sleeping.
import type { Citizen } from "@echo/shared";
// 1 tick = 5 min. Decay scaled so a full day matters but isn't lethal instantly.
export function updateNeeds(c: Citizen): void {
  if (!c.alive) return;
  c.needs.hunger = Math.max(0, c.needs.hunger - 0.06);
  c.needs.energy = Math.max(0, c.needs.energy - (c.currentActivity === "sleeping" ? -0.35 : 0.09));
  if (c.needs.energy > 100) c.needs.energy = 100;
  // health drifts toward state implied by hunger/energy
  if (c.needs.hunger < 10 || c.needs.energy <= 0) c.needs.health = Math.max(0, c.needs.health - 0.08);
  else if (c.needs.hunger > 30 && c.needs.energy > 20) c.needs.health = Math.min(100, c.needs.health + 0.05);
  // happiness follows health/hunger
  const target = (c.needs.health * 0.4 + c.needs.hunger * 0.3 + c.needs.energy * 0.3) / 100;
  c.emotions.stress = Math.max(0, Math.min(1, c.emotions.stress + (c.needs.hunger < 25 ? 0.002 : -0.001)));
  c.needs.happiness = Math.max(0, Math.min(100, c.needs.happiness + (target * 100 - c.needs.happiness) * 0.002));
  c.physical.health = Math.round(c.needs.health);
}
// Eat one meal unit: restores hunger. Returns true if ate.
export function eatMeal(c: Citizen): boolean {
  if (!c.alive || c.needs.hunger > 92) return false;
  c.needs.hunger = Math.min(100, c.needs.hunger + 32);
  c.needs.happiness = Math.min(100, c.needs.happiness + 3);
  c.currentActivity = "eating";
  return true;
}
