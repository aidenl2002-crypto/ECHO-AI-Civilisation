// scheduler.ts: deterministic daily routine by hour.
import type { WorldState } from "../world.js";
export function schedule(state: WorldState, tick: number, hour: number): void {
  for (const c of Object.values(state.citizens)) {
    if (!c.alive) { c.currentActivity = "dead"; continue; }
    // Activity follows the hour even while travelling (rest on the way home still restores energy).
    // Destination is only assigned when the citizen has arrived (no double-booking trips).
    const travelling = !!c.destinationBuildingId;
    if (hour >= 23 || hour < 7) {
      c.currentActivity = "sleeping";
      if (!travelling) c.destinationBuildingId = c.homeId;
    } else if (hour >= 9 && hour < 12 && c.workBuildingId) {
      c.currentActivity = "working";
      if (!travelling) c.destinationBuildingId = c.workBuildingId;
    } else if (hour >= 13 && hour < 17 && c.workBuildingId) {
      c.currentActivity = "working";
      if (!travelling) c.destinationBuildingId = c.workBuildingId;
    } else if (hour === 12) {
      c.currentActivity = "eating"; // lunch (does not cancel travel)
    } else if (hour >= 18 && hour < 22) {
      c.currentActivity = "leisure";
      if (!travelling) {
        const n = c.id.charCodeAt(c.id.length - 1) || 0;
        c.destinationBuildingId = n % 2 === 0 ? "b_park" : "b_bar";
      }
    } else {
      c.currentActivity = "idle";
    }
  }
}
