// movement.ts: positions on 0..1000 grid, constant speed per tick.
import type { WorldState } from "../world.js";
export const WORLD_SIZE = 1000;
export const SPEED_PER_TICK = 9; // units per 5-min tick (cross-city trip < sleep window)
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function moveTowards(state: WorldState, citizenId: string): boolean {
  const c = state.citizens[citizenId];
  if (!c || !c.alive || !c.destinationBuildingId) return true;
  const b = state.buildings[c.destinationBuildingId];
  if (!b) { c.destinationBuildingId = null; return true; }
  const d = dist(c.position, b.position);
  if (d <= SPEED_PER_TICK) {
    c.position = { ...b.position }; // arrived: single location (no double-location)
    c.destinationBuildingId = null;
    return true;
  }
  const dx = (b.position.x - c.position.x) / d, dy = (b.position.y - c.position.y) / d;
  c.position = {
    x: Math.max(0, Math.min(WORLD_SIZE, c.position.x + dx * SPEED_PER_TICK)),
    y: Math.max(0, Math.min(WORLD_SIZE, c.position.y + dy * SPEED_PER_TICK)),
  };
  return false;
}
