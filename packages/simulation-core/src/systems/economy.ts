// Purchases, daily portions of weekly salaries, and monthly rent/tax transfers.
import type { WorldState } from "../world.js";
import { eatMeal } from "./needs.js";

export const MEAL_PRICE = 12;
export const RENT_MONTHLY = 150;

// Called every five simulated minutes; hourly payouts must run only on the first tick.
export function economyTick(state: WorldState, tick: number, day: number, hour: number, emit: (t: string, s: string, a: string[], d: Record<string, unknown>, b?: string) => void): void {
  const buildings = Object.values(state.buildings);
  if (tick % 288 === 0) for (const b of buildings) {
    b.economic.metricDay = day; b.economic.revenueToday = 0; b.economic.customersToday = 0;
  }
  // Food purchases at meal hours: hungry citizens with cash buy from grocery/restaurant
  if (hour === 12 || hour === 19) {
    const sellers = buildings.filter((b) => (b.inventory.meal ?? 0) > 0).map((b) => b.id);
    if (sellers.length > 0) {
      for (const c of Object.values(state.citizens)) {
        if (!c.alive || c.needs.hunger > 70) continue;
        // Tier1 utility: skip if broke; prefer cheapest seller (all same price -> nearest)
        if (c.financial.cash < MEAL_PRICE) continue;
        // nearest seller with stock
        let best = sellers[0], bd = Infinity;
        for (const s of sellers) {
          const b = state.buildings[s];
          if ((b.inventory.meal ?? 0) <= 0) continue;
          const d = Math.hypot(c.position.x - b.position.x, c.position.y - b.position.y);
          if (d < bd) { bd = d; best = s; }
        }
        if (!Number.isFinite(bd) || (state.layout && bd > 90)) continue;
        const shop = state.buildings[best];
        shop.inventory.meal = Math.max(0, (shop.inventory.meal ?? 0) - 1); // never negative
        c.financial.cash -= MEAL_PRICE;
        shop.economic.funds += MEAL_PRICE;
        if (shop.economic.metricDay !== day) { shop.economic.metricDay = day; shop.economic.revenueToday = 0; shop.economic.customersToday = 0; }
        shop.economic.revenueToday = (shop.economic.revenueToday ?? 0) + MEAL_PRICE;
        shop.economic.customersToday = (shop.economic.customersToday ?? 0) + 1;
        eatMeal(c);
        emit("MealEaten", `${c.firstName} bought a meal`, [c.id], { price: MEAL_PRICE }, best);
      }
    } else {
      // eat at home free (pantry) if starving
      for (const c of Object.values(state.citizens)) {
        if (c.alive && c.needs.hunger < 30) { eatMeal(c); }
      }
    }
    // Pantry fallback also covers hungry travellers who have not reached a seller yet.
    for (const c of Object.values(state.citizens)) {
      if (c.alive && c.needs.hunger < 30) eatMeal(c);
    }
  }
  // Daily wage slice, once at 09:00. Partial pay is recorded as wages owed.
  if (hour === 9 && tick % 12 === 0) {
    for (const j of Object.values(state.jobs)) {
      if (!j.workerId) continue;
      const w = state.citizens[j.workerId];
      const b = state.buildings[j.buildingId];
      if (!w || !w.alive || !b) continue;
      const pay = j.salary / 7; // daily slice of weekly salary
      const actual = Math.min(pay, b.economic.funds);
      b.economic.funds -= actual;
      b.economic.wagesOwed += pay - actual;
      w.financial.cash += actual;
      if (actual > 0) emit("Payday", `${w.firstName} paid ${actual.toFixed(0)}`, [w.id], { amount: actual, job: j.title }, b.id);
    }
  }
  // Monthly rent (day%30==1, 8h) + tax to treasury
  if (day % 30 === 1 && hour === 8 && tick % 12 === 0) {
    const residents = new Map<string, number>();
    for (const c of Object.values(state.citizens)) if (c.alive && c.homeId) residents.set(c.homeId, (residents.get(c.homeId) ?? 0) + 1);
    for (const c of Object.values(state.citizens)) {
      if (!c.alive) continue;
      const home = c.homeId ? state.buildings[c.homeId] : null;
      const monthlyShare = home?.rent ? home.rent / Math.max(1, residents.get(home.id) ?? 1) : RENT_MONTHLY;
      const rent = home?.ownerId === c.id ? 0 : Math.min(c.financial.cash, monthlyShare);
      c.financial.cash -= rent;
      const landlord = home?.ownerId ? state.citizens[home.ownerId] : null;
      if (landlord?.alive) landlord.financial.cash += rent;
      else state.government.treasury += rent;
      if (rent > 0) emit("RentPaid", `${c.firstName} paid ${rent.toFixed(0)} in rent`, [c.id], { amount: rent }, home?.id);
      const tax = Math.round(c.financial.cash * state.government.taxRate * 0.05);
      if (tax > 0 && c.financial.cash >= tax) {
        c.financial.cash -= tax;
        state.government.treasury += tax;
        emit("TaxCollected", `tax ${tax} from ${c.firstName}`, [c.id], { tax });
      }
    }
  }
  // Restock shops daily at 6h (goods cost business funds — conserved)
  if (hour === 6 && tick % 12 === 0) {
    for (const b of buildings.filter((b) => 'meal' in b.inventory)) {
      const need = 100 - (b.inventory.meal ?? 0);
      if (need > 0) {
        const units = Math.max(0, Math.min(need, Math.floor(b.economic.funds / 3)));
        const cost = units * 3;
        b.economic.funds -= cost;
        b.inventory.meal = (b.inventory.meal ?? 0) + units;
      }
    }
  }
}
